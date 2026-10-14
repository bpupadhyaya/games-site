// Elastic Jump: state and flow. Drawing is in view.js / playview.js / stage.js / docview.js; the constants and the routines are in moves.js.
//
// Timing model: run time `run.t` is the sum of the dt values handed to update() (deterministic, pausable). A tap is judged at the tick
// it arrives (minus the Latency setting). The beat sounds are played from the same clock.
import { LEVELS, JUDGE, TIMING, SCORE, WEIGHT, TRIES, COUNT_IN, PRACTICE_SPEED, THINK, routineOf, comboMult, starsOf, gradeOf } from './moves.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { burst, stepParticles, stageGeo } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const DEMO_RUNS = 6, DEMO_LEVELS = 2;
const KEYS = [['ArrowLeft', 'KeyA'], ['ArrowDown', 'KeyS'], ['ArrowRight', 'KeyD'], ['ArrowUp', 'KeyF']];
const GRADE_TEXT = { perfect: 'PERFECT', good: 'GOOD', ok: 'OKAY', miss: 'TRIP' };
const GRADE_COL = { perfect: '#ffd23f', good: '#8ef0b8', ok: '#9fc4ff', miss: '#ff7d8f' };
const COMBO_NOTE = [4, 8, 16, 24];

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, timingIdx: 1, calm: false, textIdx: 0, lat: 0, thinkSec: THINK.def },
    best: {}, demoRuns: 0, run: null, result: null, sfx: [],
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
    owned: !!env.monetization?.owns?.('unlock_game'), restoreMsg: '', restoreBusy: false,
  };
  let lastScene = state.scene, drag = null;
  // 3D credits: the shared view3d licence text, shown under About (the 3D layer is optional; no file or no network means no section)
  state.credits = [];
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) state.credits = [{ h: 'Credits and licences' }, ...paras.map((p) => ({ p }))];
    }).catch(() => {});
  }

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = Math.min(Math.max(state.prefs.textIdx | 0, 0), TEXT_SCALES.length - 1); state.prefs.thinkSec = Math.min(THINK.max, Math.max(THINK.min, state.prefs.thinkSec | 0)); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  env.monetization?.onChange?.(() => { state.owned = !!env.monetization.owns('unlock_game'); });
  const lay = () => layoutFor(meta.width, meta.height);
  const geo = () => stageGeo(lay().play.stage);
  const tk = () => TIMING[state.prefs.timingIdx].k;
  const win = () => ({ p: JUDGE.perfect * tk(), g: JUDGE.good * tk(), o: JUDGE.ok * tk() });
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result') state.run = null; };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  const unlocked = (i) => i === 0 || state.dev || !!state.best[LEVELS[i - 1].id];
  const openLevel = (i) => (!state.demo || i < DEMO_LEVELS) && unlocked(i);

  // ---- sound -------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.prefs.sound) env.audio.tone?.(o); };
  const later = (delay, o) => { state.sfx.push({ at: state.t + delay, o }); };
  const landSound = (pose) => {
    if (pose === 0) tone({ freq: 300, to: 190, dur: 0.12, type: 'triangle', vol: 0.2 });
    else if (pose === 1) tone({ freq: 392, to: 262, dur: 0.12, type: 'triangle', vol: 0.2 });
    else if (pose === 2) { tone({ freq: 440, to: 587, dur: 0.1, type: 'triangle', vol: 0.18 }); tone({ freq: 720, to: 300, dur: 0.16, type: 'sawtooth', vol: 0.05 }); }
    else { tone({ freq: 262, to: 196, dur: 0.14, type: 'triangle', vol: 0.18 }); tone({ freq: 392, to: 294, dur: 0.14, type: 'triangle', vol: 0.14 }); }
  };

  // ---- a run -------------------------------------------------------------------------------------------------------------------
  function newRun(li, mode) {
    const level = LEVELS[li], speed = mode === 'practice' ? PRACTICE_SPEED : 1;
    const rt = routineOf(level, speed);
    const ai = mode === 'auto' ? rt.moves.map(() => rng.range(-0.04, 0.04)) : null;
    return {
      li, mode, level, speed, rt, moves: rt.moves, mi: 0, t: 0, beat: -1, phase: mode === 'auto' ? 'think' : 'play', phaseT: 0,
      score: 0, combo: 0, maxCombo: 0, trips: 0, counts: { perfect: 0, good: 0, ok: 0, miss: 0 }, accSum: 0, n: 0, hintTo: 0,
      jumper: { pose: 0, from: 0, jt: 9, jdur: 0.3, apexK: 0.1 + 0.16 * (li / (LEVELS.length - 1)), stumble: 0, sinceLand: 9 },
      wob: 0, wobPh: 0, pops: [], parts: [], pads: [0, 0, 0, 0], banner: null, shake: 0, flash: 0,
      paused: false, over: false, failed: false, ai, aiI: 0, said: 0, taps: [], tapN: 0,
    };
  }
  function startRun(li, mode) {
    if (state.demo && mode !== 'auto' && (li >= DEMO_LEVELS || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (state.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.sel = li; state.result = null; state.run = newRun(li, mode);
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('level_start', { level: LEVELS[li].id, mode });
  }
  const pauseRun = () => { const r = state.run; if (r && !r.paused && !r.over) r.paused = true; };
  const resumeRun = () => { const r = state.run; if (r) r.paused = false; };

  function startJump(r, pose) {
    const j = r.jumper;
    r.tapN += 1; r.taps.push({ t: r.t, pose, n: r.tapN }); if (r.taps.length > 8) r.taps.shift();   // read by the 3D presenter: when and where the feet were asked to land
    j.from = j.pose; j.pose = pose; j.jt = 0; j.jdur = r.mode === 'practice' ? 0.34 : 0.28; j.stumble = Math.max(0, j.stumble - 0.4);
    j.sinceLand = 9; r.pads[pose] = 1;
    landSound(pose);
  }
  const popup = (r, text, col, size = 1) => { r.pops.push({ text, col, size, age: 0 }); if (r.pops.length > 6) r.pops.shift(); };
  const confetti = (r, n, power) => { if (state.prefs.calm) return; const g = geo(); burst(r.parts, rng, g.jx, g.gy - g.Bh * 0.55, n, power); };

  function judge(r, m, tAdj, pose) {
    const w = win(), err = tAdj - m.t, ae = Math.abs(err);
    if (pose !== m.pose) { trip(r, m, 'WRONG STEP'); return; }
    const g = ae <= w.p ? 'perfect' : ae <= w.g ? 'good' : 'ok';
    m.j = g; m.err = err;
    r.score += SCORE[g] * comboMult(r.combo); r.combo += 1; r.maxCombo = Math.max(r.maxCombo, r.combo);
    r.counts[g] += 1; r.accSum += WEIGHT[g]; r.n += 1;
    popup(r, GRADE_TEXT[g], GRADE_COL[g], g === 'perfect' ? 1.15 : 1);
    confetti(r, g === 'perfect' ? 7 : g === 'good' ? 4 : 2, g === 'perfect' ? 1 : 0.7);
    if (g === 'perfect') tone({ freq: 1568, to: 2093, dur: 0.07, type: 'sine', vol: 0.07 });
    r.flash = Math.max(r.flash, g === 'perfect' ? 0.5 : 0.2);
    if (COMBO_NOTE.includes(r.combo)) { r.banner = { text: `${r.combo} IN A ROW`, t: 0 }; confetti(r, 18, 1.4); }
  }
  function trip(r, m, why) {
    m.j = 'miss'; r.counts.miss += 1; r.n += 1; r.combo = 0; r.trips += 1;
    popup(r, why, GRADE_COL.miss, 1.05);
    r.jumper.stumble = 1; r.wob = Math.max(r.wob, 0.05); r.shake = 1;
    tone({ freq: 190, to: 90, dur: 0.24, type: 'sawtooth', vol: 0.14 });
    if (r.mode === 'play' && r.trips >= TRIES) endRun(true);
  }
  function press(r, pose) {
    startJump(r, pose);
    if (r.phase !== 'play' || r.over || r.mode === 'auto') return;
    const tAdj = r.t - state.prefs.lat / 1000, w = win().o;
    let best = null;
    for (let i = r.mi; i < r.moves.length && r.moves[i].t <= tAdj + w; i++) {
      const m = r.moves[i]; if (m.j) continue;
      const e = Math.abs(m.t - tAdj); if (e <= w && (!best || e < Math.abs(best.t - tAdj))) best = m;
    }
    if (best) judge(r, best, tAdj, pose);
  }

  function updateRun(dt, tap, input) {
    const r = state.run, P = lay().play;
    if (r.paused || r.over) { updatePauseMenu(tap, input); return; }
    if (tap) {
      if (inRect(P.pause, tap.x, tap.y)) { pauseRun(); return; }
      if (r.mode === 'auto') { if ((r.phase === 'think') && inRect(P.hint, tap.x, tap.y)) { r.phase = 'reveal'; r.phaseT = 0; return; } }
      else if (inRect(P.hint, tap.x, tap.y)) { r.hintTo = r.mi + 4; say('Hint on: watch the lit pads', 1.4); }
      else P.pads.forEach((pr, i) => { if (inRect(pr, tap.x, tap.y)) press(r, i); });
    }
    if (r.mode !== 'auto') for (let i = 0; i < 4; i++) if (KEYS[i].some((k) => input.keys.pressed.has(k))) press(r, i);
    if (input.keys.pressed.has('Space') || input.keys.pressed.has('Escape')) { pauseRun(); return; }
    stepAnim(r, dt);
    if (r.phase === 'think') { r.phaseT += dt; if (r.phaseT >= state.prefs.thinkSec) { r.phase = 'reveal'; r.phaseT = 0; } return; }
    if (r.phase === 'reveal') { r.phaseT += dt; if (r.phaseT >= THINK.reveal) { r.phase = 'play'; r.phaseT = 0; } return; }
    r.t += dt;
    // the beat: a click on every beat of the count-in and every beat after it
    const b = Math.floor(r.t / r.rt.beat + 1e-9);
    if (b > r.beat && b >= 0) {
      r.beat = b;
      if (b < COUNT_IN) { tone({ freq: b === COUNT_IN - 1 ? 1175 : 784, dur: 0.07, type: 'square', vol: 0.07 }); r.said = b; }
      else tone({ freq: (b - COUNT_IN) % 4 === 0 ? 880 : 660, dur: 0.04, type: 'square', vol: 0.04 });
    }
    // the computer jumper
    if (r.ai) {
      while (r.aiI < r.moves.length && r.t >= r.moves[r.aiI].t + r.ai[r.aiI]) {
        const m = r.moves[r.aiI], e = r.ai[r.aiI]; r.aiI += 1;
        startJump(r, m.pose);
        const g = Math.abs(e) <= win().p ? 'perfect' : 'good';
        m.j = g; m.err = e; r.score += SCORE[g] * comboMult(r.combo); r.combo += 1; r.maxCombo = Math.max(r.maxCombo, r.combo); r.counts[g] += 1; r.accSum += WEIGHT[g]; r.n += 1;
        popup(r, GRADE_TEXT[g], GRADE_COL[g], 1);
        confetti(r, 4, 0.8);
      }
    }
    // steps nobody landed: a trip once the window is over
    const w = win().o + state.prefs.lat / 1000;
    while (r.mi < r.moves.length) {
      const m = r.moves[r.mi];
      if (m.j) { r.mi += 1; continue; }
      if (m.t + w < r.t) { trip(r, m, 'TRIP'); if (r.over) return; r.mi += 1; } else break;
    }
    if (r.mi >= r.moves.length && r.t > r.rt.end) endRun(false);
  }

  function stepAnim(r, dt) {
    const j = r.jumper, was = j.jt;
    j.jt += dt; j.stumble = Math.max(0, j.stumble - dt * 1.8); j.sinceLand = Math.min(9, j.sinceLand + dt);
    if (was < j.jdur && j.jt >= j.jdur) { j.sinceLand = 0; r.wob = Math.max(r.wob, j.pose === 2 ? 0.035 : 0.02); r.wobPh = 0; }
    r.wob *= Math.pow(0.02, dt); r.wobPh += dt * 18;
    for (let i = 0; i < 4; i++) r.pads[i] = Math.max(0, r.pads[i] - dt * 5);
    for (const p of r.pops) p.age += dt;
    r.pops = r.pops.filter((p) => p.age < 0.85);
    stepParticles(r.parts, dt);
    r.shake = Math.max(0, r.shake - dt * 4); r.flash = Math.max(0, r.flash - dt * 2.5);
    if (r.banner) { r.banner.t += dt; if (r.banner.t > 1.4) r.banner = null; }
  }

  function endRun(failed) {
    const r = state.run;
    r.over = true; r.failed = failed;
    const acc = r.moves.length ? r.accSum / r.moves.length : 0;
    const stars = failed ? 0 : Math.max(1, starsOf(acc));
    const id = r.level.id, old = state.best[id] ?? {};
    const res = { li: r.li, mode: r.mode, failed, score: r.score, acc, stars, grade: gradeOf(acc), maxCombo: r.maxCombo, counts: { ...r.counts }, trips: r.trips, newBest: false };
    if (r.mode === 'play' && !failed) {
      res.newBest = !old.score || r.score > old.score;
      state.best[id] = { score: Math.max(old.score || 0, r.score), acc: Math.max(old.acc || 0, acc), stars: Math.max(old.stars || 0, stars), combo: Math.max(old.combo || 0, r.maxCombo) };
      storage.set('best', state.best);
    }
    env.monetization.track?.('level_end', { level: id, mode: r.mode, stars, failed });
    if (!failed) { later(0, { freq: 523, dur: 0.12, type: 'triangle', vol: 0.14 }); later(0.12, { freq: 659, dur: 0.12, type: 'triangle', vol: 0.14 }); later(0.24, { freq: 784, dur: 0.12, type: 'triangle', vol: 0.14 }); later(0.36, { freq: 1047, dur: 0.3, type: 'triangle', vol: 0.16 }); }
    state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  function pauseItems(r) {
    return r.mode === 'auto' ? ['resume', 'replay', 'next', 'quit'] : ['resume', 'restart', 'quit'];
  }
  function updatePauseMenu(tap, input) {
    const r = state.run, items = pauseItems(r);
    const M = menuRects(lay(), items.length);
    if (input.keys.pressed.has('Escape') && !r.over) { resumeRun(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumeRun();
      else if (it === 'restart' || it === 'replay') startRun(r.li, r.mode);
      else if (it === 'next') startRun((r.li + 1) % LEVELS.length, 'auto');
      else go('prep');
    });
  }

  // ---- menus and documents ------------------------------------------------------------------------------------------------------------------
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
    else if (id === 'restore') {
      if (state.restoreBusy || state.owned || state.demo) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(env.monetization.restore()).then(() => {
        state.owned = !!env.monetization.owns('unlock_game');
        state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
      return;
    }
    savePrefs();
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
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result, res = state.result;
    const canNext = !res.failed && res.mode === 'play' && state.sel + 1 < LEVELS.length;
    if (inRect(Rr.again, tap.x, tap.y)) startRun(res.li, res.mode);
    else if (inRect(Rr.next, tap.x, tap.y)) { if (canNext && openLevel(state.sel + 1)) { state.sel += 1; go('prep'); } else go('levels'); }
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see ----------------------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      if (state.hold) return;                          // dev only: freeze the picture for screenshots
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      for (let i = state.sfx.length - 1; i >= 0; i--) if (state.sfx[i].at <= state.t) { tone(state.sfx[i].o); state.sfx.splice(i, 1); }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'levels') updateLevels(tap, input);
      else if (sc === 'prep') updatePrep(tap, input);
      else if (sc === 'play') updateRun(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
    // Called by main.js when the app goes to the background.
    autoPause() { if (state.scene === 'play') pauseRun(); },
    // Everything except real play is free: menus, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const r = state.run;
      return !(state.scene === 'play' && r && r.mode !== 'auto' && r.phase === 'play' && !r.paused && !r.over);
    },
    // Tester tools (?dev=1): jump to a screen and fast-forward.
    dev: {
      // advance the run by `sec` seconds; play: land every step on time (a good run). Used by the screenshot tools.
      step(sec, play) {
        const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
        const hold = state.hold; state.hold = false;
        for (let i = 0; i < Math.round(sec * 60); i++) {
          const r = state.run;
          if (r && state.scene === 'play' && play && r.mode !== 'auto' && r.phase === 'play' && !r.paused) {
            const m = r.moves[r.mi];
            if (m && !m.j && m.t <= r.t + 0.01 + state.prefs.lat / 1000) press(r, m.pose);
          }
          api.update(1 / 60, idle);
        }
        state.hold = hold;
      },
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.level !== undefined) state.sel = o.level;
        const sc = o.scene ?? 'title';
        if (sc === 'play') startRun(state.sel, o.mode ?? 'play');
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startRun(state.sel, 'play'); const r = state.run; r.score = 4350; r.maxCombo = 14; r.counts = { perfect: 9, good: 5, ok: 2, miss: 0 }; r.n = 16; r.accSum = 13.2; r.trips = 0; endRun(false);
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.run) pauseRun();
        if (o.advance) api.dev.step(o.advance, !!o.play);
        if (o.hint && state.run) state.run.hintTo = state.run.mi + 4;
        if (o.hold) state.hold = true;
      },
    },
  };
  return api;
}
