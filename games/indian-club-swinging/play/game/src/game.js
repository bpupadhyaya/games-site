// Indian Club Swinging: state and flow. Drawing is in view.js / playview.js / docview.js; moves, routines and the judging numbers are in moves.js.
//
// Time model: session time `pl.t` is the sum of the dt values handed to update() (deterministic, pausable). The beat position is
// b = t * bpm / 60. A routine is a list of segments (a short gap, then a move). The marker runs round the move's path; the player's
// finger sets where the lead club WANTS to be and the club follows with a spring lag (the club weight). Every tick the distance
// between the lead club head and the marker gives a quality 0..1 that feeds the flow meter and the score.
import {
  MOVES, MOVE_ORDER, ROUTINES, dailyRoutine, compile, leadPoint, pairOf, quality, multOf, starsOf, gradeOf,
  TIMING, WEIGHT, THINK_TIMES, JUDGE, SCORE, FLOW, REACH,
} from './moves.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const DEMO_RUNS = 6;
const AUTO_SEGS = 4;
const REVEAL_SECONDS = 2;
const REST = { x: 0.12, y: 0.95 };
const TRAIL = 26;
const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const IDLE = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

export function createGame(env) {
  const { rng, storage, config, audio } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, move: 'front', backTo: 'title',
    prefs: { sound: true, weightIdx: 1, timingIdx: 1, trail: true, calm: false, thinkIdx: 1, practiceBpm: 60, textIdx: 0 },
    best: {}, demoRuns: 0, pl: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
    owned: false, restoreMsg: '', restoreBusy: false,
  };
  let lastScene = state.scene, drag = null;

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = clamp(state.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const mon = env.monetization;
  state.owned = !!mon?.owns?.('unlock_game');
  mon?.onChange?.(() => { state.owned = !!mon.owns('unlock_game'); });

  const lay = () => layoutFor(meta.width, meta.height);
  const tk = () => TIMING[state.prefs.timingIdx].k;
  const go = (scene) => { state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  const tone = (o) => { if (state.prefs.sound) audio.tone(o); };
  const routineAt = (i) => (i < ROUTINES.length ? ROUTINES[i] : dailyRoutine(config.day));
  const routineCount = () => ROUTINES.length + 1;

  // ---- a session -------------------------------------------------------------------------------------------------------------------------
  function newPlay(mode, routine) {
    const tl = compile(routine);
    if (mode === 'auto') { tl.segs = tl.segs.slice(0, AUTO_SEGS); tl.total = tl.segs[tl.segs.length - 1].end; }
    return {
      mode, routine: { id: routine.id, name: routine.name, bpm: routine.bpm }, tl, t: 0, b: 0, seg: 0, lastBeat: -1, count: 0,
      h: { x: REST.x, y: REST.y }, h2: { x: -REST.x, y: REST.y }, ang: Math.PI / 2, ang2: Math.PI / 2, speed: 0,
      trail: [], trail2: [], holding: false, hold: false, fx: 0, fy: 0,
      mk: { x: 0, y: -1, k: 'gap', turns: 0 },
      score: 0, flow: 0, mult: 1, qSum: 0, qT: 0, run: 0, bestRun: 0, counts: { smooth: 0, good: 0, off: 0 }, segAcc: [], last: null,
      paused: false, over: false, pre: null, preDone: -1, hintT: 0, hints: 0, cheat: false,
      pops: [], parts: [], pulse: 0, banner: null, glow: 0, whoosh: 0,
      ai: { x: 0, y: -1, ph: [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)] },
    };
  }
  function startPlay(mode, idx = state.sel) {
    if (config.demo && mode !== 'auto' && ((mode === 'play' && idx > 0) || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (config.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    let routine;
    if (mode === 'practice') {
      const m = MOVES[state.move];
      routine = { id: 'practice', name: `Practice: ${m.name}`, bpm: state.prefs.practiceBpm, moves: [[m.id, 400]] };
    } else { routine = routineAt(idx); state.sel = idx; }
    state.pl = newPlay(mode, routine); state.result = null;
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('routine_start', { routine: routine.id, mode });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.over) { pl.paused = true; pl.hold = false; pl.holding = false; } };
  const resumePlay = () => { const pl = state.pl; if (pl) pl.paused = false; };
  const curSeg = (pl) => pl.tl.segs[Math.min(pl.seg, pl.tl.segs.length - 1)];

  // The marker for the current moment (pad units) and which phase it is in.
  function markerNow(pl) {
    const seg = curSeg(pl), m = seg.move;
    if (pl.pre) {
      const turns = pl.pre.kind === 'reveal' ? (pl.pre.t / REVEAL_SECONDS) * 0.5 : 0, p = leadPoint(m, turns);
      return { x: p.x, y: p.y, k: pl.pre.kind, turns };
    }
    if (pl.b >= seg.start && pl.b < seg.end + 1e-9) {
      const turns = (pl.b - seg.start) * m.speed, p = leadPoint(m, turns);
      return { x: p.x, y: p.y, k: 'swing', turns };
    }
    const p = leadPoint(m, 0);
    return { x: p.x, y: p.y, k: 'gap', turns: 0 };
  }

  // The computer swinger (Watch and Learn, and dev play-throughs): glides to each start, then leads the marker by the club's lag.
  function aiFinger(pl, dt) {
    const seg = curSeg(pl), m = seg.move, a = pl.ai, spb = 60 / pl.tl.bpm, tau = WEIGHT[state.prefs.weightIdx].tau;
    let p;
    if (!pl.pre && pl.b >= seg.start && pl.b < seg.end) p = leadPoint(m, (pl.b + (tau * 0.9) / spb - seg.start) * m.speed);
    else p = leadPoint(m, pl.pre && pl.pre.kind === 'reveal' ? pl.mk.turns : 0);
    const amp = 0.05 + 0.2 * Math.pow(Math.max(0, Math.sin(0.37 * pl.t + a.ph[4])), 14);
    const nx = amp * (Math.sin(2.1 * pl.t + a.ph[0]) * 0.7 + Math.sin(5.3 * pl.t + a.ph[1]) * 0.3);
    const ny = amp * (Math.sin(1.7 * pl.t + a.ph[2]) * 0.7 + Math.sin(4.6 * pl.t + a.ph[3]) * 0.3);
    const k = 1 - Math.exp(-dt / 0.09);
    a.x += (p.x + nx - a.x) * k; a.y += (p.y + ny - a.y) * k;
    return a;
  }

  // ---- per-tick play update ---------------------------------------------------------------------------------------------------------------
  function stepClubs(pl, dt, tx, ty, down) {
    const w = WEIGHT[state.prefs.weightIdx].tau, m = curSeg(pl).move;
    const tau = down ? w : 0.2, gx = down ? tx : REST.x, gy = down ? ty : REST.y;
    const a = 1 - Math.exp(-dt / tau), ox = pl.h.x, oy = pl.h.y;
    pl.h.x += (gx - pl.h.x) * a; pl.h.y += (gy - pl.h.y) * a;
    const p2 = down ? pairOf(m, pl.h) : { x: -REST.x, y: REST.y }, a2 = 1 - Math.exp(-dt / (down ? w * 0.8 + 0.01 : 0.22));
    pl.h2.x += (p2.x - pl.h2.x) * a2; pl.h2.y += (p2.y - pl.h2.y) * a2;
    pl.speed = Math.hypot(pl.h.x - ox, pl.h.y - oy) / dt;
    for (const [h, key] of [[pl.h, 'ang'], [pl.h2, 'ang2']]) {
      if (Math.hypot(h.x, h.y) > 0.28) pl[key] += wrapAngle(Math.atan2(h.y, h.x) - pl[key]) * (1 - Math.exp(-dt / 0.05));
    }
    pl.trail.push({ x: pl.h.x, y: pl.h.y }); if (pl.trail.length > TRAIL) pl.trail.shift();
    pl.trail2.push({ x: pl.h2.x, y: pl.h2.y }); if (pl.trail2.length > TRAIL) pl.trail2.shift();
  }

  function stepAnim(pl, dt) {
    for (const p of pl.pops) p.age += dt;
    pl.pops = pl.pops.filter((p) => p.age < 0.9);
    stepParticles(pl.parts, dt);
    pl.pulse = Math.max(0, pl.pulse - dt * 3.5); pl.glow = Math.max(0, pl.glow - dt * 3);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 1.5) pl.banner = null; }
    if (pl.last) pl.last.t += dt;
    if (pl.hintT > 0) pl.hintT = Math.max(0, pl.hintT - dt);
  }

  function onBeat(pl, idx) {
    const seg = curSeg(pl), accent = idx % 4 === 0;
    pl.pulse = accent ? 1 : 0.6;
    if (idx < seg.start) {                                                   // counting in: clicks
      pl.count = seg.start - idx;
      tone({ freq: accent ? 1100 : 880, dur: 0.05, type: 'square', vol: 0.05 });
      return;
    }
    if (idx >= seg.end) return;
    tone({ freq: accent ? 190 : 250, to: accent ? 90 : 120, dur: 0.1, type: 'triangle', vol: accent ? 0.2 : 0.12 });
    // the beat judgement: how close the lead club head is to the marker right now
    const mk = pl.mk, d = Math.hypot(pl.h.x - mk.x, pl.h.y - mk.y), k = tk();
    const g = pl.holding && d <= JUDGE.smooth * k ? 'smooth' : pl.holding && d <= JUDGE.good * k ? 'good' : 'off';
    pl.counts[g] += 1;
    if (g === 'off') pl.run = 0; else { pl.run += 1; pl.bestRun = Math.max(pl.bestRun, pl.run); }
    pl.score += (g === 'smooth' ? SCORE.smooth : g === 'good' ? SCORE.good : 0) * pl.mult;
    if (g === 'smooth') {
      pl.glow = 1; tone({ freq: 740 + pl.mult * 110, dur: 0.2, type: 'sine', vol: 0.08 });
      if (!state.prefs.calm) burst(pl.parts, rng, pl.h.x, pl.h.y, 8, '#ffd45a', 1);
    }
    pl.last = { g, t: 0, x: pl.h.x, y: pl.h.y };
  }

  function updatePlay(dt, input) {
    const pl = state.pl, L = lay().play, p = input.pointer;
    const tap = p.pressed ? { x: p.x, y: p.y } : null;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    const keys = input.keys.pressed;
    if (keys.has('Space') || keys.has('Escape')) { pausePlay(); return; }
    if (tap && inRect(L.pause, tap.x, tap.y)) { pausePlay(); return; }
    if ((tap && inRect(L.hint, tap.x, tap.y)) || keys.has('KeyH')) {
      pl.hintT = 4; pl.hints += 1;
      if (pl.pre && pl.pre.kind === 'reveal') pl.pre = { kind: 'think', t: 0, dur: THINK_TIMES[state.prefs.thinkIdx], seg: pl.pre.seg };
    }
    // the finger
    const P = L.pad;
    if (tap && !inRect(L.pause, tap.x, tap.y) && !inRect(L.hint, tap.x, tap.y)) pl.hold = true;
    if (p.released || !p.down) pl.hold = false;
    let ux, uy, down;
    if (pl.mode === 'auto' || pl.cheat) { const a = aiFinger(pl, dt); ux = a.x; uy = a.y; down = true; }
    else {
      down = pl.hold;
      const vx = (p.x - P.lx) / P.pr, vy = (p.y - P.cy) / P.pr, len = Math.hypot(vx, vy), s = len > REACH ? REACH / len : 1;
      ux = vx * s; uy = vy * s;
    }
    pl.holding = down; pl.fx = ux; pl.fy = uy;
    // Watch and Learn: think, then reveal, before each move. The whole session clock waits.
    if (pl.mode === 'auto') {
      if (!pl.pre && pl.preDone < pl.seg && pl.b >= curSeg(pl).gap0 - 1e-9) { pl.pre = { kind: 'think', t: 0, dur: THINK_TIMES[state.prefs.thinkIdx], seg: pl.seg }; pl.preDone = pl.seg; }
      if (pl.pre) {
        pl.pre.t += dt;
        if (pl.pre.t >= pl.pre.dur) pl.pre = pl.pre.kind === 'think' ? { kind: 'reveal', t: 0, dur: REVEAL_SECONDS, seg: pl.pre.seg } : null;
        pl.mk = markerNow(pl);
        stepClubs(pl, dt, ux, uy, true);
        stepAnim(pl, dt);
        return;
      }
    }
    pl.t += dt;
    pl.b = (pl.t * pl.tl.bpm) / 60;
    const segs = pl.tl.segs;
    while (pl.seg < segs.length - 1 && pl.b >= segs[pl.seg].end) {
      const s = segs[pl.seg], acc = s.qT ? s.qSum / s.qT : 0;
      pl.segAcc[pl.seg] = acc;
      pl.banner = { text: `${s.move.name}: ${Math.round(acc * 100)}%`, t: 0 };
      tone({ freq: 523, dur: 0.12, type: 'triangle', vol: 0.1 }); tone({ freq: 784, dur: 0.22, type: 'triangle', vol: 0.1 });
      pl.seg += 1;
    }
    pl.mk = markerNow(pl);
    stepClubs(pl, dt, ux, uy, down);
    const seg = curSeg(pl);
    const bi = Math.floor(pl.b + 1e-9);
    while (pl.lastBeat < bi) { pl.lastBeat += 1; onBeat(pl, pl.lastBeat); }
    if (pl.mk.k === 'swing') {
      const d = Math.hypot(pl.h.x - pl.mk.x, pl.h.y - pl.mk.y), q = down ? quality(d, tk()) : 0;
      pl.qSum += q * dt; pl.qT += dt; seg.qSum = (seg.qSum || 0) + q * dt; seg.qT = (seg.qT || 0) + dt;
      if (!down) pl.flow = Math.max(0, pl.flow - FLOW.drop * dt);
      else if (q >= FLOW.qOk) pl.flow = Math.min(1, pl.flow + FLOW.gain * q * dt);
      else pl.flow = Math.max(0, pl.flow - FLOW.loss * dt);
      const m = multOf(pl.flow);
      if (m > pl.mult) { pl.banner = { text: `FLOW x${m}`, t: 0 }; tone({ freq: 660 + m * 60, to: 990 + m * 60, dur: 0.25, type: 'sine', vol: 0.1 }); pl.glow = 1; }
      pl.mult = m;
      pl.score += SCORE.perSec * q * pl.mult * dt;
      pl.whoosh -= dt;
      if (pl.whoosh <= 0 && pl.speed > 1.2 && down) { pl.whoosh = 0.18; tone({ freq: 150 + pl.speed * 70, to: 110 + pl.speed * 40, dur: 0.12, type: 'sine', vol: 0.025 + Math.min(0.04, pl.speed * 0.006) }); }
    } else if (pl.flow > 0) {
      pl.flow = Math.max(0, pl.flow - 0.05 * dt); pl.mult = multOf(pl.flow);
    }
    stepAnim(pl, dt);
    if (pl.b >= pl.tl.total + 1) {
      const s = segs[segs.length - 1];
      pl.segAcc[segs.length - 1] = s.qT ? s.qSum / s.qT : 0;
      if (pl.mode === 'auto') { pl.over = true; return; }
      finishRun();
    }
  }

  function finishRun() {
    const pl = state.pl, acc = pl.qT ? pl.qSum / pl.qT : 0, stars = starsOf(acc), id = pl.routine.id, old = state.best[id] ?? {};
    const res = {
      mode: pl.mode, id, name: pl.routine.name, score: Math.round(pl.score), acc, stars, grade: gradeOf(acc), bestRun: pl.bestRun, counts: { ...pl.counts },
      segs: pl.tl.segs.map((s, i) => ({ name: s.move.name, acc: pl.segAcc[i] ?? 0 })), hints: pl.hints, newBest: false,
    };
    if (pl.mode === 'play') {
      res.newBest = !old.score || res.score > old.score;
      state.best[id] = { score: Math.max(old.score || 0, res.score), acc: Math.max(old.acc || 0, acc), stars: Math.max(old.stars || 0, stars), run: Math.max(old.run || 0, pl.bestRun) };
      storage.set('best', state.best);
    }
    env.monetization.track?.('routine_end', { routine: id, mode: pl.mode, stars });
    pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0; pl.paused = false;
  }

  function pauseItems(pl) {
    return pl.over ? ['again', 'next', 'exit'] : pl.mode === 'auto' ? ['resume', 'think', 'next', 'quit'] : ['resume', 'restart', 'quit'];
  }
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems(pl);
    const M = menuRects(lay(), items.length);
    if (input.keys.pressed.has('Escape') && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart') startPlay(pl.mode, state.sel);
      else if (it === 'again') startPlay('auto', state.sel);
      else if (it === 'think') { state.prefs.thinkIdx = (state.prefs.thinkIdx + 1) % THINK_TIMES.length; savePrefs(); say(`Think time ${THINK_TIMES[state.prefs.thinkIdx]} s`); resumePlay(); }
      else if (it === 'next') { state.sel = (state.sel + 1) % routineCount(); startPlay('auto', state.sel); }
      else go('title');
    });
  }

  // ---- menus and documents ---------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'weight') p.weightIdx = cyc(p.weightIdx, WEIGHT.length);
    else if (id === 'timing') p.timingIdx = cyc(p.timingIdx, TIMING.length);
    else if (id === 'trail') p.trail = !p.trail;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'think') p.thinkIdx = cyc(p.thinkIdx, THINK_TIMES.length);
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') {
      if (state.owned || state.restoreBusy || state.demo || !mon) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(mon.restore()).then(() => {
        state.owned = !!mon.owns('unlock_game');
        state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
      return;
    }
    savePrefs();
  }
  function updateDoc(input) {
    const p = input.pointer, max = docMetrics.max, view = ui.view;
    const setScroll = (v) => { state.docScroll = clamp(v, 0, max); };
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
    if (hit(T.play)) go('routines');
    else if (hit(T.practice)) go('moves');
    else if (hit(T.auto)) startPlay('auto', state.sel);
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 90 && Math.abs(tap.x - T.credit.x) < 190) env.openArcforgeHome?.();
  }
  function updateRoutines(tap) {
    if (!tap) return;
    const G = lay().routines;
    if (inRect(G.back, tap.x, tap.y)) { go('title'); return; }
    G.cards.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) startPlay('play', i); });
  }
  function updateMoves(tap) {
    if (!tap) return;
    const G = lay().moves;
    if (inRect(G.back, tap.x, tap.y)) { go('title'); return; }
    if (inRect(G.tempoDec, tap.x, tap.y)) { state.prefs.practiceBpm = Math.max(40, state.prefs.practiceBpm - 5); savePrefs(); return; }
    if (inRect(G.tempoInc, tap.x, tap.y)) { state.prefs.practiceBpm = Math.min(110, state.prefs.practiceBpm + 5); savePrefs(); return; }
    G.cards.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { state.move = MOVE_ORDER[i]; startPlay('practice'); } });
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) { const m = state.result.mode; if (m === 'practice') startPlay('practice'); else startPlay(m, state.sel); }
    else if (inRect(Rr.routines, tap.x, tap.y)) go(state.result.mode === 'practice' ? 'moves' : 'routines');
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see -------------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'routines') updateRoutines(tap);
      else if (sc === 'moves') updateMoves(tap);
      else if (sc === 'play') updatePlay(dt, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, { pauseItems, routineAt, routineCount }); },
    getState: () => state,
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except real swinging is free: menus, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !(state.scene === 'play' && pl && pl.mode !== 'auto' && !pl.paused && !pl.over);
    },
    // Tester tools (?dev=1 and ?shot=1): jump to a screen and fast-forward with a computer swinger.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.clean) state.clean = true;
        if (o.sel !== undefined) state.sel = o.sel;
        if (o.move) state.move = o.move;
        const sc = o.scene ?? 'title';
        if (sc === 'play') { startPlay(o.mode ?? 'play', state.sel); if (o.play && state.pl) state.pl.cheat = true; }
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('play', state.sel); state.pl.cheat = true;
          for (let i = 0; i < 60 * 600 && state.scene === 'play'; i++) api.update(1 / 60, IDLE);
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.advance) for (let i = 0; i < o.advance * 60; i++) api.update(1 / 60, IDLE);
        if (o.pause && state.pl) pausePlay();
      },
    },
  };
  return api;
}
