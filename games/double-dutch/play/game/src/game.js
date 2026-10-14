// Double Dutch: state and flow. Drawing is in view.js / playview.js / stage.js / docview.js; the constants and the routines are in moves.js.
//
// Timing model: run time `r.t` is the sum of the dt values handed to update() (deterministic, pausable). A hop is judged at the
// tick the tap arrives (minus the Latency setting): the top of the hop (tap + air/2) against the moment the rope reaches the ground.
import {
  LEVELS, TRICKS, TRICK_BY_ID, JUDGE, TIMING, SCORE, WEIGHT, LIVES, STYLE_SHARE, COUNT_IN, PRACTICE_SPEED, THINK, SWIPE,
  routineOf, airOf, clearWindow, comboMult, starsOf, gradeOf,
} from './moves.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { geo3 } from './stage3d.js';
import { burst, dust, stepParticles, stageGeo, ELEV, clamp, smooth } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const DEMO_RUNS = 6, DEMO_LEVELS = 2;
const GRADE_TEXT = { perfect: 'PERFECT', good: 'GOOD', ok: 'OKAY' };
const GRADE_COL = { perfect: '#ffc83d', good: '#7be26a', ok: '#8fd8ff', miss: '#ff5a5f' };
const COMBO_NOTE = [4, 8, 16, 24];
const BASS = [[55, 55, 65.4, 55, 73.4, 55, 65.4, 49], [58.3, 58.3, 65.4, 58.3, 77.8, 58.3, 65.4, 51.9]];

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, timingIdx: 1, calm: false, textIdx: 0, lat: 0, thinkSec: THINK.def },
    best: {}, demoRuns: 0, run: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    owned: false, restoreBusy: false,
    toast: null, dev: config.dev === true, demo: config.demo === true,
  };
  let lastScene = state.scene, drag = null, gesture = null;

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = Math.min(Math.max(state.prefs.textIdx | 0, 0), TEXT_SCALES.length - 1); state.prefs.thinkSec = Math.min(THINK.max, Math.max(THINK.min, state.prefs.thinkSec | 0)); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const geo = () => (state.has3d ? { ...geo3(lay().play.stage), za: 0 } : stageGeo(lay().play.stage));
  const tk = () => TIMING[state.prefs.timingIdx].k;
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result') state.run = null; gesture = null; };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  const unlocked = (i) => i === 0 || state.dev || !!state.best[LEVELS[i - 1].id];
  const openLevel = (i) => (!state.demo || i < DEMO_LEVELS) && unlocked(i);

  // ---- sound -------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.prefs.sound) env.audio.tone?.(o); };
  const later = (r, delay, o) => { r.sfx.push({ at: r.t + delay, o }); };

  // ---- a run -------------------------------------------------------------------------------------------------------------------
  function newRun(li, mode) {
    const level = LEVELS[li], speed = mode === 'practice' ? PRACTICE_SPEED : 1;
    const rt = routineOf(level, speed);
    const ai = mode === 'auto' ? rt.scored.map(() => rng.range(-0.05, 0.05)) : null;
    return {
      li, mode, level, speed, rt, passes: rt.passes, scored: rt.scored, t: 0, phase: mode === 'auto' ? 'think' : 'play', phaseT: 0,
      nextJ: 0, nextR: 0, nextHit: 0, nextSnd: 0, aiI: 0, hop: null,
      J: { t0: -9, dur: 0.3, trick: null, x: -1.35, depth: 1, stumble: 0, run: 0 },
      lives: LIVES, tangles: 0, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, good: 0, ok: 0, miss: 0 }, calls: { hit: 0, miss: 0 }, stray: 0, accSum: 0,
      ai, hit: null, pops: [], parts: [], banner: null, shake: 0, flash: 0, sfx: [], guide: false,
      paused: false, over: false, failed: false,
    };
  }
  function startRun(li, mode) {
    if (state.demo && mode !== 'auto' && (li >= DEMO_LEVELS || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (state.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.sel = li; state.result = null; state.run = newRun(li, mode);
    state.scene = 'play'; state.sceneT = 0; gesture = null;
    env.monetization.track?.('level_start', { level: LEVELS[li].id, mode });
  }
  const pauseRun = () => { const r = state.run; if (r && !r.paused && !r.over) r.paused = true; };
  const resumeRun = () => { const r = state.run; if (r) r.paused = false; };

  const popup = (r, text, col, size = 1) => { r.pops.push({ text, col, size, age: 0, slot: r.pops.filter((q) => q.age < 0.35).length }); if (r.pops.length > 5) r.pops.shift(); };
  const sparkle = (r, n, power) => { if (state.prefs.calm) return; const g = geo(); burst(r.parts, rng, g.jx, g.gy - g.k * 0.6, n, power); };

  // The hop: judged against the nearest pass this hop can cover. Returns false when the tap is ignored (still going up).
  function hopAt(r, tau, byAi = false) {
    if (r.hop) { const s = (r.t - r.hop.t0) / r.hop.dur; if (s >= 0 && s < 0.5) return false; }
    const k = tk();
    let best = null, bestErr = 0;
    for (let i = r.nextJ; i < r.scored.length; i++) {
      const p = r.scored[i];
      if (p.t > tau + 0.6) break;
      if (p.j) continue;
      const air = airOf(p.gap), err = tau + air / 2 - p.t;
      if (Math.abs(err) <= clearWindow(air) && (!best || Math.abs(err) < Math.abs(bestErr))) { best = p; bestErr = err; }
    }
    const air = best ? airOf(best.gap) : airOf(r.rt.beat * 0.8);
    const J = r.J; J.t0 = r.t; J.dur = air; J.trick = null;
    r.hop = { t0: r.t, dur: air, pass: best ? best.i : null };
    tone({ freq: 330 + 14 * (0.4 / air) * 10, to: 520, dur: 0.07, type: 'triangle', vol: 0.09 });
    // landing: sneaker thud and squeak when the feet come back down
    later(r, air, { freq: 120, to: 55, dur: 0.07, type: 'triangle', vol: 0.11 });
    later(r, air + 0.01, { freq: 1500 + 400 * (air * 3 % 1), to: 2300, dur: 0.045, type: 'square', vol: 0.028 });
    const g = geo(); dust(r.parts, rng, g.jx, g.gy + 4, 3, g.k * 0.08);
    if (best) {
      const ae = Math.abs(bestErr), ok = clearWindow(air);
      const grade = ae <= Math.min(JUDGE.perfect * k, ok) ? 'perfect' : ae <= Math.min(JUDGE.good * k, ok) ? 'good' : 'ok';
      best.j = grade; best.err = bestErr; best.hopT = r.t;
      r.score += SCORE[grade] * comboMult(r.combo); r.combo += 1; r.maxCombo = Math.max(r.maxCombo, r.combo);
      r.counts[grade] += 1; r.accSum += WEIGHT[grade];
      popup(r, GRADE_TEXT[grade], GRADE_COL[grade], grade === 'perfect' ? 1.15 : 1);
      sparkle(r, grade === 'perfect' ? 6 : grade === 'good' ? 3 : 1, grade === 'perfect' ? 0.9 : 0.6);
      if (grade === 'perfect') tone({ freq: 1568, to: 2093, dur: 0.07, type: 'sine', vol: 0.06 });
      r.flash = Math.max(r.flash, grade === 'perfect' ? 0.4 : 0.15);
      if (COMBO_NOTE.includes(r.combo) && r.mode !== 'auto') { r.banner = { text: `${r.combo} IN A ROW`, t: 0 }; sparkle(r, 16, 1.3); }
    } else if (!byAi && r.t >= r.rt.T0 - r.rt.beat * 0.5) {
      r.stray += 1; r.combo = 0;
    }
    return true;
  }

  // A trick on the hop in progress.
  function trickNow(r, id) {
    const hop = r.hop;
    if (!hop || r.t - hop.t0 > SWIPE.window || r.J.trick) return;
    r.J.trick = id;
    const T = TRICK_BY_ID[id];
    tone({ freq: 660, to: 990, dur: 0.1, type: 'triangle', vol: 0.1 });
    if (hop.pass === null) return;
    const p = r.scored[hop.pass];
    if (!p.call || p.callOk !== null) return;
    if (p.call === id) {
      p.callOk = true; r.calls.hit += 1;
      r.score += SCORE.trick * comboMult(r.combo);
      popup(r, `${T.name.toUpperCase()}!`, T.col, 1.25); sparkle(r, 14, 1.2); r.flash = Math.max(r.flash, 0.5);
      later(r, 0, { freq: 784, dur: 0.1, type: 'triangle', vol: 0.12 }); later(r, 0.08, { freq: 988, dur: 0.1, type: 'triangle', vol: 0.12 }); later(r, 0.16, { freq: 1319, dur: 0.16, type: 'triangle', vol: 0.12 });
    } else {
      p.callOk = false; r.calls.miss += 1; r.combo = 0;
      popup(r, 'WRONG CALL', GRADE_COL.miss, 1);
    }
  }

  function tangle(r, p) {
    p.j = 'miss'; r.counts.miss += 1; r.combo = 0; r.tangles += 1; r.lives -= 1;
    if (p.call) { p.callOk = false; r.calls.miss += 1; }
    popup(r, 'TANGLED', GRADE_COL.miss, 1.1);
    r.J.stumble = 1; r.shake = 1; r.hit = { rope: p.rope, v: 1, age: 0 };
    tone({ freq: 190, to: 80, dur: 0.26, type: 'sawtooth', vol: 0.14 });
    if (r.mode === 'play' && r.lives <= 0) endRun(true);
  }

  function updateRun(dt, tap, input) {
    const r = state.run, P = lay().play;
    if (r.paused || r.over) { updatePauseMenu(tap, input); return; }
    // buttons
    if (tap && inRect(P.pause, tap.x, tap.y)) { pauseRun(); gesture = null; return; }
    if (input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) { pauseRun(); return; }
    const onHint = tap && inRect(P.hint, tap.x, tap.y);
    if (onHint) {
      if (r.mode === 'auto') { if (r.phase === 'think') { r.phase = 'reveal'; r.phaseT = 0; } }
      else { r.guide = !r.guide; say(r.guide ? 'Guide on: a ring closes when to tap' : 'Guide off', 1.4); }
      return;
    }
    // input: tap anywhere = hop, swipe = trick on that hop, keys the same
    if (r.mode !== 'auto' && r.phase === 'play' && r.t >= r.rt.T0 - r.rt.beat * 0.7) {
      const tau = r.t - state.prefs.lat / 1000;
      if (tap) { hopAt(r, tau); gesture = { x0: tap.x, y0: tap.y, t0: r.t, used: false }; }
      if (input.keys.pressed.has('Space')) hopAt(r, tau);
      for (const T of TRICKS) if (input.keys.pressed.has(T.code)) { if (!r.hop || r.t - r.hop.t0 > 0.05) hopAt(r, tau); trickNow(r, T.id); }
      if (gesture && !gesture.used) {
        const p = input.pointer;
        if (r.t - gesture.t0 > SWIPE.window) gesture = null;
        else if (p.down || p.released) {
          const dx = p.x - gesture.x0, dy = p.y - gesture.y0;
          if (Math.hypot(dx, dy) >= SWIPE.dist) {
            const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
            gesture.used = true; trickNow(r, TRICKS.find((q) => q.dir === dir).id);
          }
        }
      }
    }
    stepAnim(r, dt);
    if (r.phase === 'think') { r.phaseT += dt; if (r.phaseT >= state.prefs.thinkSec) { r.phase = 'reveal'; r.phaseT = 0; } return; }
    if (r.phase === 'reveal') { r.phaseT += dt; if (r.phaseT >= THINK.reveal) { r.phase = 'play'; r.phaseT = 0; } return; }
    r.t += dt;
    for (let i = r.sfx.length - 1; i >= 0; i--) if (r.sfx[i].at <= r.t) { tone(r.sfx[i].o); r.sfx.splice(i, 1); }
    // the ropes touch the pavement: the sounds fire on the tick nearest the pass (half a tick early at most), so the 60 Hz
    // quantisation error is +-8 ms instead of 0..16 ms late; the picture (dust, pulse, rope phase) uses the exact pass time.
    while (r.nextSnd < r.passes.length && r.passes[r.nextSnd].t <= r.t + dt * 0.5) {
      const p = r.passes[r.nextSnd]; r.nextSnd += 1;
      const A = p.rope === 'A';
      tone({ freq: A ? 170 : 205, to: A ? 70 : 85, dur: 0.11, type: 'triangle', vol: 0.2 });
      tone({ freq: 2200, to: 700, dur: 0.035, type: 'square', vol: 0.035 });
      if (!p.scored) tone({ freq: p.n === COUNT_IN - 1 ? 1175 : 784, dur: 0.07, type: 'square', vol: 0.05 });
      const prev = r.passes[p.n - 1], half = p.pepper && prev && prev.pepper && prev.beatIdx === p.beatIdx;
      if (!half) {
        const bl = BASS[(r.li >> 2) & 1], note = bl[((p.beatIdx % 8) + 8) % 8];
        tone({ freq: note * 2, dur: 0.2, type: 'triangle', vol: 0.12 });
        if (((p.beatIdx % 4) + 4) % 4 === 0 && p.scored) { tone({ freq: note * 8, dur: 0.14, type: 'sawtooth', vol: 0.03 }); tone({ freq: note * 10, dur: 0.14, type: 'sawtooth', vol: 0.025 }); }
        if (!p.pepper) later(r, r.rt.beat / 2, { freq: 6200, dur: 0.02, type: 'square', vol: 0.014 });
      }
    }
    while (r.nextHit < r.passes.length && r.passes[r.nextHit].t <= r.t) {
      const p = r.passes[r.nextHit]; r.nextHit += 1;
      const A = p.rope === 'A';
      const g = geo(); dust(r.parts, rng, g.jx + (A ? -1 : 1) * g.k * 0.06, g.gy + (A ? g.za : -g.za) * ELEV + 2, 3, g.k * 0.5);
      if (!r.hit || r.hit.v < 0.5) r.hit = { rope: p.rope, v: 0.8, age: 0 };
    }
    // the computer jumper
    if (r.mode === 'auto' && r.t >= r.rt.T0 - r.rt.beat * 0.7) {
      while (r.aiI < r.scored.length) {
        const p = r.scored[r.aiI], tau = p.t - airOf(p.gap) / 2 + r.ai[r.aiI];
        if (r.t < tau) break;
        if (!hopAt(r, r.t, true)) break;
        r.aiI += 1;
        if (p.call) trickNow(r, p.call);
      }
    }
    // the jumper walks in during the count-in and out after the last pass
    const beat = r.rt.beat, e0 = r.rt.T0 - beat * 2.2, e1 = r.rt.T0 - beat * 0.7, lastT = r.scored[r.scored.length - 1].t;
    const J = r.J;
    if (r.t < e1) { const u = clamp((r.t - e0) / (e1 - e0), 0, 1); J.x = -1.35 * (1 - smooth(u)); J.depth = 1 - smooth(u); J.run = u > 0 && u < 1 ? (r.t * 2.2) % 1 : 0; }
    else if (r.t > lastT + beat * 0.55) { const u = clamp((r.t - (lastT + beat * 0.55)) / (beat * 1.2), 0, 1); J.x = 1.5 * smooth(u); J.depth = smooth(u); J.run = u > 0 && u < 1 ? (r.t * 2.2) % 1 : 0; }
    else { J.x = 0; J.depth = 0; J.run = 0; }
    // passes nobody covered: the rope catches the jumper
    for (let i = r.nextJ; i < r.scored.length; i++) {
      const p = r.scored[i], win = clearWindow(airOf(p.gap));
      if (p.t - win > r.t) break;
      if (p.j) { if (i === r.nextJ) r.nextJ += 1; continue; }
      if (p.t + win < r.t) { tangle(r, p); if (r.over) return; if (i === r.nextJ) r.nextJ += 1; }
    }
    // calls that were not made in time
    for (let i = r.nextR; i < r.scored.length; i++) {
      const p = r.scored[i];
      if (p.t > r.t + 0.5 || p.j === null) break;
      const doneAt = p.j === 'miss' ? p.t : Math.max(p.t + 0.06, (p.hopT ?? p.t) + SWIPE.window);
      if (r.t < doneAt) break;
      if (p.call && p.callOk === null) { p.callOk = false; r.calls.miss += 1; r.combo = 0; popup(r, 'MISSED CALL', GRADE_COL.miss, 1); }
      r.nextR = i + 1;
    }
    if (r.nextR >= r.scored.length && r.t > r.rt.end) endRun(false);
  }

  function stepAnim(r, dt) {
    const J = r.J;
    J.stumble = Math.max(0, J.stumble - dt * 1.8);
    for (const p of r.pops) p.age += dt;
    r.pops = r.pops.filter((p) => p.age < 0.85);
    stepParticles(r.parts, dt);
    r.shake = Math.max(0, r.shake - dt * 4); r.flash = Math.max(0, r.flash - dt * 2.5);
    if (r.hit) { r.hit.age += dt; r.hit.v = Math.max(0, r.hit.v - dt * 3.5); if (r.hit.v <= 0) r.hit = null; }
    if (r.banner) { r.banner.t += dt; if (r.banner.t > 1.4) r.banner = null; }
  }

  function endRun(failed) {
    const r = state.run;
    r.over = true; r.failed = failed;
    const n = r.scored.length, acc = n ? r.accSum / n : 0, style = r.rt.calls ? r.calls.hit / r.rt.calls : 1;
    const value = r.rt.calls ? acc * (1 - STYLE_SHARE) + style * STYLE_SHARE : acc;
    const stars = failed ? 0 : Math.max(1, starsOf(value));
    const id = r.level.id, old = state.best[id] ?? {};
    const res = { li: r.li, mode: r.mode, failed, score: r.score, acc, style, value, stars, grade: gradeOf(value), maxCombo: r.maxCombo, counts: { ...r.counts }, calls: { ...r.calls }, callTotal: r.rt.calls, tangles: r.tangles, newBest: false };
    if (r.mode === 'play' && !failed) {
      res.newBest = !old.score || r.score > old.score;
      state.best[id] = { score: Math.max(old.score || 0, r.score), acc: Math.max(old.acc || 0, value), stars: Math.max(old.stars || 0, stars), combo: Math.max(old.combo || 0, r.maxCombo) };
      storage.set('best', state.best);
    }
    env.monetization.track?.('level_end', { level: id, mode: r.mode, stars, failed });
    r.sfx = [];
    if (!failed) { later(r, 0, { freq: 523, dur: 0.12, type: 'triangle', vol: 0.14 }); later(r, 0.12, { freq: 659, dur: 0.12, type: 'triangle', vol: 0.14 }); later(r, 0.24, { freq: 784, dur: 0.12, type: 'triangle', vol: 0.14 }); later(r, 0.36, { freq: 1047, dur: 0.3, type: 'triangle', vol: 0.16 }); }
    state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  function pauseItems(r) { return r.mode === 'auto' ? ['resume', 'replay', 'next', 'quit'] : ['resume', 'restart', 'quit']; }
  function updatePauseMenu(tap, input) {
    const r = state.run, items = pauseItems(r);
    const M = menuRects(lay(), items.length);
    if ((input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) && !r.over) { resumeRun(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumeRun();
      else if (it === 'restart' || it === 'replay') startRun(r.li, r.mode);
      else if (it === 'next') startRun((r.li + 1) % LEVELS.length, 'auto');
      else go('prep');
    });
  }

  // ---- menus and documents -------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'timing') p.timingIdx = cyc(p.timingIdx, TIMING.length);
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'latDec') p.lat = Math.max(-100, p.lat - 10);
    else if (id === 'latInc') p.lat = Math.min(300, p.lat + 10);
    else if (id === 'thinkDec') p.thinkSec = Math.max(THINK.min, p.thinkSec - 1);
    else if (id === 'thinkInc') p.thinkSec = Math.min(THINK.max, p.thinkSec + 1);
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') { restorePurchase(); return; }
    savePrefs();
  }
  const mon = env.monetization;
  const syncOwned = () => { state.owned = !!mon?.owns?.('unlock_game'); };
  mon?.onChange?.(syncOwned); syncOwned();
  function restorePurchase() {
    if (state.demo || !mon?.restore) return;
    if (state.owned) { say('Full game unlocked', 1.8); return; }
    if (state.restoreBusy) { say('Still checking with the store...', 1.8); return; }
    state.restoreBusy = true; say('Checking with the store...', 2);
    Promise.resolve().then(() => mon.restore()).then((res) => {
      state.restoreBusy = false; syncOwned();
      if (res && res.ok === false) say('Could not reach the store. Try again later.', 2.8);
      else say(state.owned ? 'Purchase restored. Full game unlocked' : 'No earlier purchase found', 2.8);
    }).catch(() => { state.restoreBusy = false; say('Could not reach the store. Try again later.', 2.8); });
  }
  function updateDoc(input) {
    const p = input.pointer, max = docMetrics.max, view = ui.view;
    const setScroll = (v) => { state.docScroll = Math.max(0, Math.min(v, max)); };
    const wy = input.wheel?.dy || 0;
    if (wy) setScroll(state.docScroll + wy);
    const k = input.keys.pressed;
    if (k.has('ArrowDown')) setScroll(state.docScroll + 70);
    if (k.has('ArrowUp')) setScroll(state.docScroll - 70);
    if (k.has('PageDown')) setScroll(state.docScroll + docMetrics.view * 0.9);
    if (k.has('PageUp')) setScroll(state.docScroll - docMetrics.view * 0.9);
    if (k.has('Escape')) { go(state.backTo); return; }
    if (p.pressed) drag = { x0: p.x, y0: p.y, s0: state.docScroll, moved: false, inView: inRect(view, p.x, p.y) };
    if (drag && p.down) {
      if (Math.abs(p.y - drag.y0) > 14) drag.moved = true;
      if (drag.moved && drag.inView) setScroll(drag.s0 - (p.y - drag.y0));
    }
    if (drag && p.released) {
      const d = drag; drag = null;
      if (d.moved) return;
      for (const h of ui.hits) {
        if (!inRect(h.r, d.x0, d.y0)) continue;
        if (h.clip && !inRect(h.clip, d.x0, d.y0)) continue;
        docAction(h.id); return;
      }
    }
  }
  function docAction(id) {
    if (id === 'back') { go(state.backTo); return; }
    if (id === 'textDec' || id === 'textInc') {
      const n = state.prefs.textIdx + (id === 'textInc' ? 1 : -1);
      if (n < 0 || n >= TEXT_SCALES.length) return;
      state.docFrac = docMetrics.max > 0 ? state.docScroll / docMetrics.max : 0; state.docRescale = true;
      state.prefs.textIdx = n; savePrefs(); return;
    }
    if (id === 'prev') { if (state.rulesPage > 0) { state.rulesPage -= 1; state.docScroll = 0; } return; }
    if (id === 'next') { if (state.rulesPage < RULES.length - 1) { state.rulesPage += 1; state.docScroll = 0; } else go(state.backTo); return; }
    if (id.startsWith('set:')) settingsAction(id.slice(4));
  }

  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.play)) go('levels');
    else if (hit(T.auto)) startRun(Math.min(state.sel, LEVELS.length - 1), 'auto');
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 90 && Math.abs(tap.x - T.credit.x) < 190) env.openArcforgeHome?.();
  }
  function updateLevels(tap, input) {
    if (input.keys.pressed.has('Escape')) { go('title'); return; }
    if (!tap) return;
    const G = lay().levels;
    if (inRect(G.back, tap.x, tap.y)) { go('title'); return; }
    G.cards.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { state.sel = i; if (openLevel(i)) go('prep'); else say(state.demo && i >= DEMO_LEVELS ? 'In the full game' : `Finish ${LEVELS[i - 1].name} first`, 1.8); } });
  }
  function updatePrep(tap, input) {
    if (input.keys.pressed.has('Escape')) { go('levels'); return; }
    if (!tap) return;
    const D = lay().prep;
    if (inRect(D.back, tap.x, tap.y)) go('levels');
    else if (inRect(D.play, tap.x, tap.y)) startRun(state.sel, 'play');
    else if (inRect(D.practice, tap.x, tap.y)) startRun(state.sel, 'practice');
    else if (inRect(D.watch, tap.x, tap.y)) startRun(state.sel, 'auto');
  }
  function updateResult(tap, dt) {
    const r = state.run;
    if (r && r.sfx) { r.t += dt; for (let i = r.sfx.length - 1; i >= 0; i--) if (r.sfx[i].at <= r.t) { tone(r.sfx[i].o); r.sfx.splice(i, 1); } }
    if (!tap) return;
    const Rr = lay().result, res = state.result;
    const canNext = !res.failed && res.mode === 'play' && state.sel + 1 < LEVELS.length;
    if (inRect(Rr.again, tap.x, tap.y)) startRun(res.li, res.mode);
    else if (inRect(Rr.next, tap.x, tap.y)) { if (canNext && openLevel(state.sel + 1)) { state.sel += 1; go('prep'); } else go('levels'); }
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see ------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      if (state.hold) return;                          // dev only: freeze the picture for screenshots
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'levels') updateLevels(tap, input);
      else if (sc === 'prep') updatePrep(tap, input);
      else if (sc === 'play') updateRun(dt, tap, input);
      else if (sc === 'result') updateResult(tap, dt);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
    // The 3D presenter (web/view3d) switches this on; without it the 2D street is drawn exactly as before.
    setStage3d(on) { state.has3d = !!on; },
    // Called by main.js when the app goes to the background.
    autoPause() { if (state.scene === 'play') pauseRun(); },
    // Everything except real play is free: menus, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const r = state.run;
      return !(state.scene === 'play' && r && r.mode !== 'auto' && r.phase === 'play' && !r.paused && !r.over);
    },
    // Tester tools (?dev=1): jump to a screen and fast-forward.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.level !== undefined) state.sel = o.level;
        const sc = o.scene ?? 'title';
        if (sc === 'play') startRun(state.sel, o.mode ?? 'play');
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startRun(state.sel, 'play'); const r = state.run; r.score = 6150; r.maxCombo = 21; r.counts = { perfect: 22, good: 9, ok: 3, miss: 0 }; r.accSum = 30.1; r.calls = { hit: 6, miss: 1 }; r.tangles = 0; endRun(false);
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.run) pauseRun();
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) {
            const r = state.run;
            // dev play-through: hop every pass on time and call every trick so the picture shows a good run
            if (r && state.scene === 'play' && o.play && r.mode !== 'auto' && r.phase === 'play' && !r.paused && r.t >= r.rt.T0 - r.rt.beat) {
              const p = r.scored[r.nextJ];
              if (p && !p.j && r.t >= p.t - airOf(p.gap) / 2) { if (hopAt(r, r.t) && p.call) trickNow(r, p.call); }
            }
            api.update(1 / 60, idle);
          }
        }
        if (o.hint && state.run) state.run.guide = true;
        if (o.hold) state.hold = true;
      },
    },
  };
  return api;
}
