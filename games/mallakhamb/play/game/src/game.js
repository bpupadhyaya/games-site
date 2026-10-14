// Mallakhamb: state and flow. Drawing is in view.js / playview.js / docview.js; the rules as data are in routine.js.
//
// Timing model: song time `pl.t` is the sum of the dt values handed to update() (deterministic, pausable). Every move has a time on
// that clock; a gesture is judged by the tick it is recognised on. Think/Reveal in Watch and Learn and the Learn hint stop the clock.
import {
  MOVES, ROUTINES, buildRoutine, moveTime, beatSeconds, COUNT_IN, JUDGE, TIMING, LEARN_WINDOW, LEARN_DRIFT, SWIPE_MIN, STEER_RANGE, BAL, SCORE, HOLD_SCORE,
  WEIGHT, FLOW, comboMult, starsOf, holdGrade, gradeFromErr, drift, THINK_CHOICES, REVEAL_SECONDS, PHRASE, DEMO_RUNS,
} from './routine.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, stageCam } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { rulesPages } from './content.js';
import { buildEvents, perfState, GRADE_TEXT, GRADE_COL } from './playview.js';
import { jointScreen } from './figure.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const KEY_SWIPE = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, timingIdx: 1, thinkIdx: 2, labels: true, calm: false, textIdx: 0 },
    best: {}, demoRuns: 0, pl: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
    restoreMsg: '', restoreBusy: false,
  };
  const owns = () => !!env.monetization?.owns?.('unlock_game');
  Object.defineProperty(state, 'owns', { value: owns, enumerable: false });
  let lastScene = state.scene, drag = null;
  const autoRng = rng.fork();

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    Object.assign(state.prefs, v);
    state.prefs.textIdx = clamp(state.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.prefs.thinkIdx = clamp(state.prefs.thinkIdx | 0, 0, THINK_CHOICES.length - 1);
    state.prefs.timingIdx = clamp(state.prefs.timingIdx | 0, 0, TIMING.length - 1);
    applyPrefs();
  });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const tone = (o) => { if (state.prefs.sound) env.audio.tone?.(o); };

  // ---- a performance ---------------------------------------------------------------------------------------------------------------
  function newPlay(ri, mode) {
    const cfg = ROUTINES[ri], speed = mode === 'learn' ? 0.75 : 1, beatDur = beatSeconds(cfg.bpm, speed);
    const moves = buildRoutine(ri).map((m) => ({ ...m, t: moveTime(m, cfg.bpm, speed), name: MOVES[m.id].name, j: null, tj: 0, err: 0, auto: null }));
    for (const m of moves) {            // the virtual performer's plan (Watch and Learn): small human errors, an occasional late one
      const late = autoRng.chance(0.08);
      m.auto = { err: late ? autoRng.range(0.1, 0.15) * (autoRng.chance(0.5) ? 1 : -1) : autoRng.range(-0.04, 0.04), wob: autoRng.range(0, 6.28) };
    }
    const last = moves[moves.length - 1];
    const k = TIMING[state.prefs.timingIdx].k * (mode === 'learn' ? LEARN_WINDOW : 1);
    return {
      mode, ri, speed, beatDur, moves, ev: buildEvents(moves, beatDur), t: 0, clock: 0, countEnd: COUNT_IN * beatDur,
      k: mode === 'auto' ? 1 : k, endT: last.t + last.dur * beatDur + 1.0, paused: false, over: false, failed: false,
      score: 0, chain: 0, maxChain: 0, flow: FLOW.start, counts: { perfect: 0, great: 0, good: 0, miss: 0 }, accSum: 0,
      hold: null, touch: null, parts: [], pops: [], pulse: 0, shake: 0, slipT: 0, chalk: 0, banner: null, beatIdx: -1,
      hint: null, reveal: null, bot: mode === 'auto' ? 'human' : null, labels: state.prefs.labels, keySteer: 0,
      auto: mode === 'auto' ? { phase: 'think', timer: THINK_CHOICES[state.prefs.thinkIdx], phrase: 0, names: [] } : null,
    };
  }
  const phraseCount = (pl) => Math.ceil(pl.moves.length / PHRASE);
  const phraseMoves = (pl, p) => pl.moves.slice(p * PHRASE, (p + 1) * PHRASE);
  const phraseTrigger = (pl, p) => (p === 0 ? 0 : phraseMoves(pl, p)[0].t - pl.beatDur * 1.0);
  function beginThink(pl, p) {
    pl.auto.phase = 'think'; pl.auto.phrase = p; pl.auto.timer = THINK_CHOICES[state.prefs.thinkIdx];
    pl.auto.names = phraseMoves(pl, p).map((m) => m.name);
    pl.reveal = null;
  }
  function startPlay(mode, ri = state.sel) {
    const limited = config.demo && mode !== 'auto';
    if (limited && (ri > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (limited) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    state.sel = ri;
    const pl = newPlay(ri, mode); state.pl = pl; state.result = null;
    if (pl.auto) beginThink(pl, 0);
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('routine_start', { routine: ROUTINES[ri].id, mode });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.paused && !pl.over) pl.paused = true; };
  const resumePlay = () => { const pl = state.pl; if (pl) pl.paused = false; };

  // ---- judging ---------------------------------------------------------------------------------------------------------------------
  function fx(pl, grade, m) {
    const c = stageCam(lay().play.stage), ps = perfState(pl.ev, pl.t);
    const hp = jointScreen(ps.pose, ps.phi, 'handR', { x: c.poleX, y: c.anchorY, k: c.k });
    const calm = state.prefs.calm;
    if (grade !== 'miss' && grade !== 'slip') {
      burst(pl.parts, rng, hp.x, hp.y, calm ? 5 : grade === 'perfect' ? 18 : 10, grade === 'perfect' ? '#ffe9a8' : '#fff4e0', 0.9, 1);
      pl.chalk = 1;
    } else burst(pl.parts, rng, hp.x, hp.y + 20, 6, '#c8a57a', 0.5, 0);
    pl.pops.push({ text: GRADE_TEXT[grade] ?? grade.toUpperCase(), col: GRADE_COL[grade] ?? '#fff', size: grade === 'perfect' ? 54 : 46, age: 0, dx: (m.i % 3 - 1) * 14 });
    if (pl.pops.length > 4) pl.pops.shift();
  }
  function judgeMove(pl, m, grade, err, slip = false) {
    if (m.j) return;
    m.j = grade; m.tj = pl.t; m.err = err;
    const mult = comboMult(pl.chain);
    if (grade === 'miss') {
      pl.counts.miss += 1; pl.chain = 0; pl.slipT = 0.6; pl.shake = 0.5;
      if (pl.mode === 'perform') pl.flow = Math.max(0, pl.flow + FLOW.miss);
      tone({ freq: 190, to: 110, dur: 0.2, type: 'sawtooth', vol: 0.09 });
    } else {
      const pts = m.g === 'hold' ? HOLD_SCORE * WEIGHT[grade] : SCORE[grade];
      pl.score += pts * mult; pl.chain += 1; pl.maxChain = Math.max(pl.maxChain, pl.chain);
      pl.counts[grade] += 1; pl.accSum += WEIGHT[grade];
      pl.flow = Math.min(1, pl.flow + FLOW[grade]);
      if (pl.chain > 0 && pl.chain % 8 === 0) pl.banner = { text: `CHAIN x${pl.chain}`, t: 0 };
      const f = grade === 'perfect' ? 1 : grade === 'great' ? 0.85 : 0.7;
      tone({ freq: 660 * f, to: 990 * f, dur: 0.17, type: 'sine', vol: 0.16 });
      tone({ freq: 990 * f, dur: 0.1, type: 'triangle', vol: 0.05 });
    }
    fx(pl, slip ? 'slip' : grade, m);
    if (pl.mode === 'perform' && pl.flow <= 0 && !pl.failed) { pl.failed = true; pl.banner = { text: 'THE FLOW BROKE', t: 0 }; }
  }
  const outer = (pl) => JUDGE.good * pl.k;
  const nearest = (pl, t, pred) => {
    let best = null;
    for (const m of pl.moves) {
      if (m.j || !pred(m)) continue;
      const e = Math.abs(m.t - t);
      if (e <= outer(pl) && (!best || e < Math.abs(best.t - t))) best = m;
    }
    return best;
  };

  // a recognised gesture at song time t
  function gestureSwipe(pl, dir, t) {
    tone({ freq: 280, to: 760, dur: 0.09, type: 'triangle', vol: 0.05 });
    const m = nearest(pl, t, (q) => q.g !== 'hold' && q.g !== 'tap');
    if (!m) return;
    const err = t - m.t;
    if (m.g !== dir) { judgeMove(pl, m, 'miss', err, true); return; }
    judgeMove(pl, m, gradeFromErr(err, pl.k) ?? 'miss', err);
  }
  function gesturePress(pl, t, x) {
    const m = nearest(pl, t, () => true);
    if (!m) return;
    const err = t - m.t;
    if (m.g === 'tap') { judgeMove(pl, m, gradeFromErr(err, pl.k) ?? 'miss', err); tone({ freq: 440, dur: 0.12, type: 'sine', vol: 0.12 }); }
    else if (m.g === 'hold' && !pl.hold) startHold(pl, m, x, false);
  }
  function startHold(pl, m, x, auto) {
    pl.hold = { mi: m.i, x0: x, t0: pl.t, inT: 0, outT: 0, bal: 0, auto, steer: 0 };
    tone({ freq: 300, to: 420, dur: 0.22, type: 'sine', vol: 0.1 });
    pl.chalk = 1;
  }
  function endHold(pl) {
    const h = pl.hold; if (!h) return;
    const m = pl.moves[h.mi], dur = m.dur * pl.beatDur;
    pl.hold = null;
    if (h.outT >= BAL.fallTime) { judgeMove(pl, m, 'miss', 0, true); return; }
    judgeMove(pl, m, holdGrade(clamp(h.inT / dur, 0, 1)), 0);
  }
  function stepHold(pl, dt, input) {
    const h = pl.hold; if (!h) return;
    const m = pl.moves[h.mi], dur = m.dur * pl.beatDur, u = Math.max(0, pl.t - m.t);
    const amp = ROUTINES[pl.ri].bal * (pl.mode === 'learn' ? LEARN_DRIFT : 1);
    let steer;
    if (h.auto) steer = clamp(drift(m, u, amp) / BAL.gain + 0.1 * Math.sin(u * 2.1 + m.auto.wob) * (pl.bot === 'perfect' ? 0 : 1), -1, 1);
    else {
      const p = input.pointer;
      if (input.keys.down.has('Space') && !p.down) {
        const want = (input.keys.down.has('ArrowRight') ? 1 : 0) - (input.keys.down.has('ArrowLeft') ? 1 : 0);
        pl.keySteer += clamp(want - pl.keySteer, -3 * dt, 3 * dt);
        steer = pl.keySteer;
      } else steer = clamp((p.x - h.x0) / STEER_RANGE, -1, 1);
    }
    h.steer = steer;
    h.bal = clamp(drift(m, u, amp) - BAL.gain * steer, -1.4, 1.4);
    if (Math.abs(h.bal) <= BAL.safe) h.inT += dt;
    if (Math.abs(h.bal) >= BAL.fall) h.outT += dt;
    if (h.outT >= BAL.fallTime) { pl.slipT = 0.7; endHold(pl); return; }
    if (pl.t >= m.t + dur) endHold(pl);
  }

  // the virtual performer (Watch and Learn, and the dev "play" toggle)
  function botStep(pl) {
    for (const m of pl.moves) {
      if (m.j) continue;
      const at = m.t + (pl.bot === 'perfect' ? 0 : m.auto.err);
      if (pl.t < at) break;
      if (m.g === 'hold') { if (!pl.hold) startHold(pl, m, 0, true); break; }
      judgeMove(pl, m, gradeFromErr(at - m.t, pl.k) ?? 'miss', at - m.t);
    }
  }

  function stepAnim(pl, dt) {
    pl.pulse = Math.max(0, pl.pulse - dt * 4); pl.shake = Math.max(0, pl.shake - dt * 3); pl.slipT = Math.max(0, pl.slipT - dt);
    pl.chalk = Math.max(0, pl.chalk - dt * 1.2);
    for (const p of pl.pops) p.age += dt;
    pl.pops = pl.pops.filter((p) => p.age < 0.85);
    stepParticles(pl.parts, dt);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 1.5) pl.banner = null; }
  }

  function showHint(pl) {
    if (pl.mode !== 'learn' || pl.hint || pl.hold) return;
    const next = pl.moves.filter((m) => !m.j).slice(0, 3);
    if (!next.length) return;
    pl.hint = { timer: REVEAL_SECONDS + 0.5, names: next.map((m) => m.name) };
    pl.reveal = next.map((m) => m.i);
  }

  function updatePlay(dt, tap, input) {
    const pl = state.pl, L = lay().play;
    if (pl.freeze) return;     // dev only: ?dev=1&freeze=1 holds the picture at an exact song time
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    const k = input.keys.pressed;
    if (tap) {
      if (inRect(L.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (pl.mode === 'learn' && inRect(L.hint, tap.x, tap.y)) { showHint(pl); return; }
    }
    if (k.has('Escape') || k.has('KeyP')) { pausePlay(); return; }
    if (k.has('KeyH')) showHint(pl);
    pl.clock += dt;
    stepAnim(pl, dt);
    // Learn hint: the clock stands still while the next moves are lit
    if (pl.hint) { pl.hint.timer -= dt; if (pl.hint.timer <= 0) { pl.hint = null; pl.reveal = null; } return; }
    // Watch and Learn: Think then Reveal before each phrase, with the clock stopped
    if (pl.auto && pl.auto.phase !== 'act') {
      const a = pl.auto; a.timer -= dt;
      if (a.timer <= 0) {
        if (a.phase === 'think') { a.phase = 'reveal'; a.timer = REVEAL_SECONDS; pl.reveal = phraseMoves(pl, a.phrase).map((m) => m.i); }
        else { a.phase = 'act'; pl.reveal = null; }
      }
      return;
    }
    if (pl.auto) {
      const np = pl.auto.phrase + 1;
      if (np < phraseCount(pl) && pl.t + dt >= phraseTrigger(pl, np) && phraseMoves(pl, np - 1).every((m) => m.j) && !pl.hold) { beginThink(pl, np); return; }
    }
    pl.t += dt;
    const bi = Math.floor(pl.t / pl.beatDur);
    if (bi !== pl.beatIdx && pl.t >= 0) {
      pl.beatIdx = bi; pl.pulse = bi % 4 === 0 ? 1 : 0.6;
      tone(bi % 4 === 0 ? { freq: 520, dur: 0.07, type: 'triangle', vol: 0.1 } : { freq: 760, dur: 0.045, type: 'triangle', vol: 0.05 });
    }
    if (pl.bot) botStep(pl);
    else playerInput(pl, input, tap);
    stepHold(pl, dt, input);
    for (const m of pl.moves) { if (!m.j && !(pl.hold && pl.hold.mi === m.i) && m.t + outer(pl) < pl.t) judgeMove(pl, m, 'miss', 0); }
    if (pl.failed && pl.banner && pl.banner.t > 1.2) { finishRun(); return; }
    if (pl.t >= pl.endT && pl.moves.every((m) => m.j) && !pl.hold) finishRun();
  }

  function playerInput(pl, input, tap) {
    const p = input.pointer, k = input.keys.pressed, L = lay().play;
    for (const code of k) {
      if (!KEY_SWIPE[code]) continue;
      if (pl.hold && input.keys.down.has('Space')) continue;   // Left / Right steer while Space is held
      gestureSwipe(pl, KEY_SWIPE[code], pl.t);
    }
    if (k.has('Space')) { pl.keySteer = 0; gesturePress(pl, pl.t, 0); }
    if (pl.hold && !pl.hold.auto && !p.down && !input.keys.down.has('Space')) endHold(pl);
    if (tap && !inRect(L.pause, tap.x, tap.y) && !inRect(L.hint, tap.x, tap.y)) {
      pl.touch = { x0: tap.x, y0: tap.y };
      gesturePress(pl, pl.t, tap.x);
    }
    if (pl.touch && p.down && !pl.hold) {
      const dx = p.x - pl.touch.x0, dy = p.y - pl.touch.y0;
      if (Math.hypot(dx, dy) >= SWIPE_MIN) {
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        gestureSwipe(pl, dir, pl.t);
        pl.touch.x0 = p.x; pl.touch.y0 = p.y;      // a long drag can chain several swipes
      }
    }
    if (p.released) pl.touch = null;
  }

  function finishRun() {
    const pl = state.pl;
    const n = pl.moves.length, acc = pl.accSum / n;
    const stars = pl.failed ? 0 : starsOf(acc);
    const id = ROUTINES[pl.ri].id, old = state.best[id] ?? {};
    const res = { ri: pl.ri, mode: pl.mode, score: pl.score, acc, stars, maxChain: pl.maxChain, counts: { ...pl.counts }, failed: pl.failed, newBest: false };
    if (pl.mode === 'perform') {
      res.newBest = !pl.failed && (!old.score || pl.score > old.score);
      state.best[id] = { ...old, score: Math.max(old.score || 0, pl.failed ? 0 : pl.score), acc: Math.max(old.acc || 0, pl.failed ? 0 : acc), stars: Math.max(old.stars || 0, stars), chain: Math.max(old.chain || 0, pl.maxChain) };
      storage.set('best', state.best);
    }
    env.monetization.track?.('routine_end', { routine: id, mode: pl.mode, stars });
    pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  function pauseItems(pl) { return pl.over ? ['again', 'next', 'exit'] : ['resume', 'restart', 'quit']; }
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems(pl), M = menuRects(lay(), items.length, 96);
    if ((input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart' || it === 'again') startPlay(pl.mode, pl.ri);
      else go('routines');
    });
  }

  // ---- menus and documents ------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'timing') p.timingIdx = cyc(p.timingIdx, TIMING.length);
    else if (id === 'think') p.thinkIdx = cyc(p.thinkIdx, THINK_CHOICES.length);
    else if (id === 'labels') p.labels = !p.labels;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') { restorePurchase(); return; }
    savePrefs();
  }
  // Settings > Restore purchase: asks the store again for what this account owns (hidden in the web demo).
  function restorePurchase() {
    if (state.demo || state.restoreBusy || owns()) return;
    state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
    Promise.resolve(env.monetization.restore()).then(() => {
      state.restoreMsg = owns() ? 'Purchase restored. Thank you!' : 'No earlier purchase found.';
    }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
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
    const pages = rulesPages().length;
    if (id === 'prev') { if (state.rulesPage > 0) { state.rulesPage -= 1; state.docScroll = 0; } return; }
    if (id === 'next') { if (state.rulesPage < pages - 1) { state.rulesPage += 1; state.docScroll = 0; } else go(state.backTo); return; }
    if (id.startsWith('set:')) settingsAction(id.slice(4));
  }

  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.play)) go('routines');
    else if (hit(T.auto)) startPlay('auto', 0);
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 66 && Math.abs(tap.x - T.credit.x) < 200) env.openArcforgeHome?.();
  }
  function updateRoutines(tap) {
    if (!tap) return;
    const G = lay().routines;
    if (inRect(G.back, tap.x, tap.y)) { go('title'); return; }
    G.cards.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { state.sel = i; go('detail'); } });
  }
  function updateDetail(tap) {
    if (!tap) return;
    const D = lay().detail;
    if (inRect(D.back, tap.x, tap.y)) go('routines');
    else if (inRect(D.learn, tap.x, tap.y)) startPlay('learn');
    else if (inRect(D.perform, tap.x, tap.y)) startPlay('perform');
    else if (inRect(D.watch, tap.x, tap.y)) startPlay('auto');
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay(state.result.mode, state.result.ri);
    else if (inRect(Rr.routines, tap.x, tap.y)) go('routines');
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see ----------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'routines') updateRoutines(tap);
      else if (sc === 'detail') updateDetail(tap);
      else if (sc === 'play') updatePlay(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
    // Called by main.js when the app goes to the background.
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except real play is free: menus, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !(state.scene === 'play' && pl && pl.mode !== 'auto' && !pl.paused && !pl.over);
    },
    // Tester tools (?dev=1): jump to a screen and fast-forward.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.routine !== undefined) state.sel = o.routine;
        const sc = o.scene ?? 'title';
        if (sc === 'play') { startPlay(o.mode ?? 'perform', state.sel); if (o.play && state.pl) state.pl.bot = 'perfect'; }
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('perform', state.sel); const pl = state.pl;
          pl.accSum = pl.moves.length * 0.9; pl.score = 41250; pl.maxChain = 17; pl.counts = { perfect: 9, great: 6, good: 2, miss: 1 };
          finishRun(); state.result.newBest = true;
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) api.update(1 / 60, idle);
        }
        if (o.pause && state.pl) pausePlay();
        if (o.freeze && state.pl && config.dev) state.pl.freeze = true;
      },
    },
  };
  return api;
}
