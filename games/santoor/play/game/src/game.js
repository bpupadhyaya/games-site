// Santoor: state and flow. Drawing is in view.js / playview.js / docview.js; the music and the rule constants are in music.js.
//
// Timing model: song time `pl.t` is the sum of the dt values handed to update() (deterministic, pausable). When the browser gives us an
// audio engine (env.rhythm, see web/audio/engine.js) accompaniment sounds are scheduled on the audio clock a little ahead of pl.t, and
// a player's touch is time-stamped on the audio clock and converted back to song time before it is judged. Headless runs have no
// engine: the same code runs with touches taken at the tick time.
//
// The board has 16 playing spots (8 courses x left and right). A touch on a spot strikes it; a touch held on a spot becomes a tremolo
// roll; a finger dragged across spots strikes each one it enters (a run). Pointers arrive through pdown / pmove / pup (main.js,
// multi-touch) or, with no engine (tests), through the kit's single pointer as plain taps.
import {
  NNOTE, SCALES, scaleById, semiOf, hzOf, PIECES, JUDGE, RUN_K, TIMING, SPEEDS, SCORE, WEIGHT, ENSEMBLE, LEARN, THINK, ROLL,
  LOOKAHEAD, buildRun, beatDur, accuracyToStars, gradeOf, comboMult, HANDS,
} from './music.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, host } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const NO_RHYTHM = { available: false, play() {}, drone() {}, tab() {}, click() {}, sync() {}, flush() {}, toSong: () => NaN, setMuted() {}, now: () => 0, haptic() {} };
const DEMO_RUNS = 6;
const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY'];
const GRADE_TEXT = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', off: 'NEAR', miss: 'MISS' };
const GRADE_COL = { perfect: '#ffe07a', great: '#8ef0dc', good: '#9fc4ff', off: '#d9b3ff', miss: '#ff7d8f' };
const TAU = Math.PI * 2;
const LABEL_MODES = ['sargam', 'number', 'off'];
const newSS = () => Array.from({ length: NNOTE }, () => ({ vib: 0, ph: 0, glow: 0, flash: 0, hit: -9 }));

export function createGame(env) {
  const { rng, storage, config } = env;
  const R = env.rhythm ?? NO_RHYTHM;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, speedIdx: 1, timingIdx: 1, labelIdx: 0, click: true, haptics: true, calm: false, textIdx: 0, cal: 0, autoSlow: false, think: THINK.def, scale: 'pahadi' },
    best: {}, demoRuns: 0, pl: null, free: null, cal: null, result: null, tv: [],
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true, owned: false, restoreMsg: '', restoreBusy: false,
  };
  let lastScene = state.scene, drag = null;
  const ptrs = new Map();                              // active touches on the instrument
  const heldKeys = new Set();

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = Math.min(Math.max(state.prefs.textIdx | 0, 0), TEXT_SCALES.length - 1); state.prefs.think = Math.min(THINK.max, Math.max(THINK.min, state.prefs.think | 0)); state.prefs.labelIdx = Math.min(Math.max(state.prefs.labelIdx | 0, 0), LABEL_MODES.length - 1); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const mon = env.monetization;
  state.owned = !!mon?.owns?.('unlock_game');
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { R.setMuted(!state.prefs.sound); env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => { host.tz = TEXT_SCALES[state.prefs.textIdx] ?? 1; return layoutFor(meta.width, meta.height); };
  const tk = () => TIMING[state.prefs.timingIdx].k;
  const approach = () => SPEEDS[state.prefs.speedIdx].approach;
  const go = (scene) => { if (state.scene === 'play' || state.scene === 'free' || state.scene === 'calib') { R.flush(); ptrs.clear(); heldKeys.clear(); state.tv = []; } state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  const songAt = (audioTime, fallback) => { const s = R.available ? R.toSong(audioTime) : NaN; return Number.isFinite(s) ? s : fallback; };
  const labelMode = () => LABEL_MODES[state.prefs.labelIdx];

  const hzFor = (sess, n) => hzOf(semiOf(scaleById(sess.scale), n));
  const instOf = () => (state.scene === 'free' ? lay().free.inst : lay().play.inst);
  const syncTv = () => { state.tv = [...ptrs.values()].filter((p) => p.x !== undefined).map((p) => ({ x: p.x, y: p.y, side: p.side ?? 0 })); };

  // ---- a play session ---------------------------------------------------------------------------------------------------------------------
  function newSess(extra) { return { t: 0, ss: newSS(), pops: [], parts: [], pulse: 0, banner: null, amb: 1, hintT: 0, mal: [null, null], ...extra }; }
  function newPlay(pieceIdx, mode) {
    const piece = PIECES[pieceIdx];
    return newSess({
      mode, pi: pieceIdx, piece, scale: piece.scale, ev: [], nd: Array.from({ length: NNOTE }, () => []), np: new Array(NNOTE).fill(0), si: 0, fi: 0, endT: 0.5,
      bars: [], segs: [], chunks: [], cur: null, speed: mode === 'auto' && state.prefs.autoSlow ? 0.75 : 1, rolls: [],
      ens: mode === 'perform' ? ENSEMBLE.start : mode === 'auto' ? ENSEMBLE.max : 0, streak: 0, score: 0, combo: 0, maxCombo: 0,
      counts: { perfect: 0, great: 0, good: 0, off: 0, miss: 0 }, rollOk: 0, rollShort: 0, runN: 0, accSum: 0, accN: 0,
      paused: false, over: false, resync: true, layerFlash: 0, shake: 0,
      hand: [{ n: -1, down: 0, on: false }, { n: -1, down: 0, on: false }],
      learn: mode === 'learn' ? { phrase: 0, attempt: 1, final: false, acc: [], tries: [] } : null,
      auto: mode === 'auto' ? { phase: 'think', k: 0, timer: state.prefs.think, total: state.prefs.think } : null,
    });
  }
  function append(pl, segments, extra = {}) {
    const run = buildRun(pl.piece, segments, pl.endT, { speed: pl.speed });
    const id = pl.chunks.length, chunk = { id, t0: run.T0, t1: run.end, sum: 0, n: 0, done: false, ...extra };
    for (const e of run.events) {
      e.ch = id; pl.ev.push(e);
      if (e.who === 'note') { pl.nd[e.n].push(e); chunk.n += e.kind === 'roll' ? 2 : 1; }
    }
    pl.bars.push(...run.bars); pl.segs.push(...run.segs.map((g) => ({ ...g, ch: id })));
    pl.chunks.push(chunk); pl.cur = chunk; pl.endT = run.end;
    return chunk;
  }
  const beatOf = (pl) => beatDur(pl.piece, pl.speed);
  function learnStep(pl) {
    const L = pl.learn, b0 = L.phrase * 2;
    if (L.final) { pl.ens = ENSEMBLE.start; pl.streak = 0; return append(pl, [{ kind: 'count' }, { kind: 'play', b0: 0, b1: 8 }], { kind: 'final' }); }
    return append(pl, [{ kind: 'count' }, { kind: 'listen', b0, b1: b0 + 2 }, { kind: 'echo', b0, b1: b0 + 2, blind: L.attempt === 1 }], { kind: 'pair', phrase: L.phrase, attempt: L.attempt });
  }
  function autoPhrase(pl) {
    const k = pl.auto.k;
    pl.endT = pl.t + approach() + 0.35;
    return append(pl, [{ kind: 'auto', b0: k * 2, b1: k * 2 + 2 }], { kind: 'auto', phrase: k });
  }
  function startPlay(mode) {
    if (config.demo && mode !== 'auto' && (state.sel > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (config.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush(); ptrs.clear(); heldKeys.clear(); state.tv = [];
    const pl = newPlay(state.sel, mode); state.pl = pl; state.result = null;
    if (mode === 'learn') learnStep(pl);
    else if (mode === 'perform') append(pl, [{ kind: 'count' }, { kind: 'play', b0: 0, b1: 8 }], { kind: 'whole' });
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('piece_start', { piece: pl.piece.id, mode });
  }
  function pausePlay() {
    const pl = state.pl; if (!pl || pl.paused || pl.over) return;
    pl.paused = true; R.flush();
    while (pl.si > 0 && pl.ev[pl.si - 1].t > pl.t) pl.si -= 1;
    for (let i = pl.si; i < pl.ev.length; i++) if (pl.ev[i].t > pl.t) pl.ev[i].on = undefined;
  }
  function resumePlay() { const pl = state.pl; if (!pl) return; pl.paused = false; pl.resync = true; }
  function truncateFuture(pl) {
    let k = pl.ev.length; while (k > 0 && pl.ev[k - 1].t > pl.t) k -= 1;
    pl.ev.length = k; pl.si = Math.min(pl.si, k); pl.fi = Math.min(pl.fi, k);
    for (let n = 0; n < NNOTE; n++) { pl.nd[n] = pl.nd[n].filter((e) => e.t <= pl.t); pl.np[n] = Math.min(pl.np[n], pl.nd[n].length); }
    pl.bars = pl.bars.filter((b) => b.t0 <= pl.t); pl.segs = pl.segs.filter((g) => g.t0 <= pl.t); pl.endT = pl.t;
    R.flush(); pl.resync = true;
  }
  function listenAgain() {
    const pl = state.pl;
    if (!pl || pl.mode !== 'learn' || pl.learn.final || pl.paused || pl.over) return;
    if (pl.cur) pl.cur.cancel = true;
    truncateFuture(pl); pl.endT = pl.t + beatOf(pl) * 1.5;
    learnStep(pl); say('Listen again', 1.4);
  }

  // ---- what a sounding string looks like -------------------------------------------------------------------------------------------------------------
  function ring(sess, n, power, by, px, py, side) {
    const st = sess.ss[n]; st.vib = Math.min(1, st.vib * 0.4 + power); st.glow = 1; st.flash = 1; st.hit = sess.t;
    const inst = instOf(), p = px !== undefined ? { x: px, y: py } : inst.pt(n);
    if (!state.prefs.calm) burst(sess.parts, rng, p.x, p.y, by === 'player' ? 7 : 4, power, inst.across);
    sess.mal[side ?? (n & 1)] = { x: p.x, y: p.y, down: 1, age: 0 };
    if (by === 'player' && state.prefs.haptics) R.haptic?.(6);
  }
  const pop = (sess, n, text, col, size) => {
    const inst = instOf(), p = inst.pt(n), S = lay().S, off = (n & 1 ? 1 : -1) * 0;
    sess.pops = sess.pops.filter((q) => q.n !== n);
    sess.pops.push({ n, x: Math.max(S.x + 90, Math.min(S.x + S.w - 90, p.x + off)), y: p.y - inst.rh * 0.35, text, col, size, age: 0 });
    if (sess.pops.length > 12) sess.pops.shift();
  };

  // ---- judging -------------------------------------------------------------------------------------------------------------------------------------
  const win = (e) => { const k = tk() * (e.sw ? RUN_K : 1); return { p: JUDGE.perfect * k, g: JUDGE.great * k, o: JUDGE.good * k }; };
  const isFinalLike = (pl) => pl.mode === 'perform' || (pl.learn && pl.learn.final);
  function judgeNote(pl, e, tAdj, near) {
    const w = win(e), err = Math.abs(e.t - tAdj);
    let g = err <= w.p ? 'perfect' : err <= w.g ? 'great' : 'good';
    if (near) g = 'off';
    e.j = g; e.err = tAdj - e.t;
    pl.score += SCORE[g] * comboMult(pl.combo); pl.combo += 1; pl.maxCombo = Math.max(pl.maxCombo, pl.combo);
    pl.counts[g] += 1; pl.accSum += WEIGHT[g]; pl.accN += 1; pl.streak += 1;
    const ch = pl.chunks[e.ch]; if (ch) ch.sum += WEIGHT[g];
    if (isFinalLike(pl)) {
      if (pl.streak % ENSEMBLE.every === 0 && pl.ens < ENSEMBLE.max) { pl.ens += 1; pl.layerFlash = 1; pl.banner = { text: pl.ens === 1 ? 'A DRONE JOINS' : 'THE DRUM JOINS', t: 0 }; }
    }
    if (e.sw) pl.runN += 1;
    if (!(e.sw && e.si > 0)) pop(pl, e.n, GRADE_TEXT[g], GRADE_COL[g], g === 'perfect' ? 40 : 34);
  }
  function missNote(pl, e) {
    e.j = 'miss'; pl.counts.miss += 1; pl.accN += e.kind === 'roll' ? 2 : 1; pl.combo = 0; pl.streak = 0;
    if (isFinalLike(pl)) pl.ens = Math.max(0, pl.ens - 1);
    if (!(e.sw && e.si > 0)) pop(pl, e.n, 'MISS', GRADE_COL.miss, 30);
    if (e.blind) { pl.showMiss = pl.showMiss ?? []; pl.showMiss.push({ n: e.n, age: 0 }); }   // the blind echo shows where the note was
  }
  function findNote(pl, n, tAdj) {
    const arr = pl.nd[n]; let best = null;
    for (let i = pl.np[n]; i < arr.length; i++) {
      const e = arr[i]; if (e.t > tAdj + win(e).o) break;
      if (e.j) continue;
      const d = Math.abs(e.t - tAdj); if (d <= win(e).o && (!best || d < Math.abs(best.t - tAdj))) best = e;
    }
    return best;
  }
  function judgeStrike(pl, n, tSong, id) {
    if (pl.mode === 'auto' || pl.paused || pl.over) return;
    const tAdj = tSong - state.prefs.cal / 1000;
    let e = findNote(pl, n, tAdj), near = false;
    if (!e) {                                                      // a neighbouring spot at the right moment counts a little
      let bestE = 9;
      for (const d of [-2, -1, 1, 2]) { const q = n + d; if (q < 0 || q >= NNOTE) continue; const m = findNote(pl, q, tAdj); if (m) { const er = Math.abs(m.t - tAdj); if (er < bestE) { bestE = er; e = m; near = true; } } }
    }
    if (!e) return;
    judgeNote(pl, e, tAdj, near);
    if (e.kind === 'roll') { e.hid = id; e.hold0 = pl.t; e.heldTo = pl.t; pl.rolls.push(e); }
  }
  function finishRoll(pl, e) {
    const i = pl.rolls.indexOf(e); if (i < 0) return;
    pl.rolls.splice(i, 1);
    const need = e.dur * ROLL.hold - ROLL.grace, held = (e.heldTo ?? e.hold0) - e.hold0;
    const ch = pl.chunks[e.ch];
    if (held >= need - 1e-6) {
      pl.rollOk += 1; pl.score += SCORE.roll * comboMult(pl.combo); pl.accSum += 1; pl.accN += 1; if (ch) ch.sum += 1;
      pop(pl, e.n, 'ROLL', '#f6d98a', 34);
    } else { pl.rollShort += 1; pl.accN += 1; pop(pl, e.n, 'SHORT', '#ff9a8a', 28); }
  }
  // A spot is struck by the player (touch, drag or key).
  function strikeAt(sess, n, tSong, id, px, py) {
    if (state.prefs.sound) R.play(n, hzFor(sess, n), 0.9, null);
    ring(sess, n, 1, 'player', px, py, n & 1);
    if (sess === state.pl) judgeStrike(sess, n, tSong, id); else sess.hits = (sess.hits ?? 0) + 1;
  }

  // ---- pointers on the instrument ------------------------------------------------------------------------------------------------------------------------
  const uiRects = () => { if (state.scene === 'play') { const P = lay().play; return [P.pause, P.hint]; } const F = lay().free; return [F.exit, F.scale, F.reset, F.labels]; };
  function playable() {
    if (state.scene === 'free') return state.free;
    const pl = state.pl;
    return state.scene === 'play' && pl && !pl.paused && !pl.over && pl.mode !== 'auto' ? pl : null;
  }
  function pdown(id, x, y, audioTime) {
    const sc = state.scene;
    if (sc === 'calib') {
      const c = state.cal, C = lay().calib; if (!c) return false;
      for (const r of [C.back, C.use, C.retry]) if (inRect(r, x, y)) return false;
      calTap(songAt(audioTime, c.t)); return true;
    }
    const sess = playable(); if (!sess) return false;
    for (const r of uiRects()) if (inRect(r, x, y)) return false;
    const inst = instOf(), h = inst.hit(x, y);
    if (!h) return false;
    const tSong = sc === 'play' ? songAt(audioTime, sess.t) : sess.t;
    ptrs.set(id, { n: h.n, side: h.side, x, y, t0: sess.t, lastTr: sess.t });
    strikeAt(sess, h.n, tSong, id, x, y);
    syncTv();
    return true;
  }
  function releaseRolls(id) { const pl = state.pl; if (pl) for (const e of [...pl.rolls]) if (e.hid === id) finishRoll(pl, e); }
  function pmove(id, x, y, audioTime) {
    const p = ptrs.get(id); if (!p) return;
    const sess = playable(); if (!sess) { ptrs.delete(id); syncTv(); return; }
    const inst = instOf(), tSong = state.scene === 'play' ? songAt(audioTime, sess.t) : sess.t;
    // sample the segment so a fast drag does not skip a spot
    const dx = x - p.x, dy = y - p.y, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(10, inst.rh * 0.25)));
    for (let i = 1; i <= steps; i++) {
      const sx = p.x + (dx * i) / steps, sy = p.y + (dy * i) / steps, h = inst.hit(sx, sy);
      if (!h || h.n === p.n) continue;
      releaseRolls(id); p.n = h.n; p.side = h.side; p.t0 = sess.t; p.lastTr = sess.t;
      strikeAt(sess, h.n, tSong, id, sx, sy);
    }
    p.x = x; p.y = y; syncTv();
  }
  function pup(id) { releaseRolls(id); ptrs.delete(id); syncTv(); }

  // ---- per-tick play update ------------------------------------------------------------------------------------------------------------------------------
  function evOn(pl, e) {
    if (e.on !== undefined) return e.on;
    if (e.who === 'ens') return e.layer <= pl.ens;
    if (e.who === 'teach') return true;
    if (e.who === 'click') return !!e.cnt || (pl.mode === 'learn' && state.prefs.click);
    return false;
  }
  function soundEvent(pl, e) {
    if (e.who === 'click') { R.click(e.k === 'accent', e.t); return; }
    if (e.drone !== undefined) { R.drone(hzOf(e.drone), e.vel, e.dur, e.t); return; }
    if (e.tab) { R.tab(e.tab, e.vel, e.t); return; }
    R.play(e.n, hzFor(pl, e.n), e.vel * 0.9, e.t, !!e.tr || e.kind === 'roll');
  }
  function stepAnim(sess, dt) {
    for (let n = 0; n < NNOTE; n++) {
      const st = sess.ss[n];
      st.vib = st.vib * Math.exp(-dt * (0.9 + (n >> 1) * 0.08)); if (st.vib < 0.01) st.vib = 0;
      st.ph = (st.ph + dt * (52 + n * 2.8)) % TAU; st.glow = Math.max(0, st.glow - dt * 2.2); st.flash = Math.max(0, st.flash - dt * 4);
    }
    // a finger resting on a spot becomes a tremolo
    for (const p of ptrs.values()) {
      if (p.n === undefined || sess.t - p.t0 < 0.2 || sess.t - p.lastTr < ROLL.rate) continue;
      p.lastTr = sess.t;
      if (state.prefs.sound) R.play(p.n, hzFor(sess, p.n), 0.42, null, true);
      const st = sess.ss[p.n]; st.vib = Math.min(1, st.vib + 0.12); st.glow = Math.max(st.glow, 0.7);
    }
    for (const m of sess.mal) if (m) { m.age += dt; m.down = Math.max(0, m.down - dt * 6); }
    for (let s = 0; s < 2; s++) if (sess.mal[s] && sess.mal[s].age > 1.2 && sess.mode !== 'auto') sess.mal[s] = null;
    for (const p of sess.pops) p.age += dt;
    sess.pops = sess.pops.filter((p) => p.age < 0.8);
    if (sess.showMiss) { for (const m of sess.showMiss) m.age += dt; sess.showMiss = sess.showMiss.filter((m) => m.age < 1.1); }
    stepParticles(sess.parts, dt);
    sess.pulse = Math.max(0, sess.pulse - dt * 4); sess.shake = Math.max(0, (sess.shake || 0) - dt * 4); sess.layerFlash = Math.max(0, (sess.layerFlash || 0) - dt * 1.5);
    if (sess.banner) { sess.banner.t += dt; if (sess.banner.t > 1.6) sess.banner = null; }
    sess.hintT = Math.max(0, (sess.hintT || 0) - dt);
    if (!state.prefs.calm) {                                       // a few marigold petals drifting through the room
      sess.amb -= dt;
      if (sess.amb <= 0) {
        sess.amb = rng.range(1.4, 3.0); const S = lay().S;
        sess.parts.push({ x: S.x + rng.range(0, S.w), y: S.y + rng.range(0, 60), vx: rng.range(-20, 20), vy: rng.range(20, 50), life: 9, max: 9, size: rng.range(6, 10), c: rng.chance(0.5) ? '#ffb23c' : '#ff7a2a', petal: true, rot: rng.range(0, 6), spin: rng.range(-1.5, 1.5), g: 6 });
      }
    }
  }
  // the teacher's mallets follow the next teacher / hint event on their side
  function stepHand(pl, dt) {
    const wantTeach = pl.mode === 'auto' || (pl.mode === 'learn' && !pl.learn.final), wantHint = pl.hintT > 0;
    for (let s = 0; s < 2; s++) {
      const h = pl.hand[s]; let e = null;
      if (wantTeach || wantHint) {
        for (let i = Math.max(0, pl.fi - 3); i < pl.ev.length; i++) {
          const q = pl.ev[i]; if (q.t < pl.t - 0.2 || q.side !== s || q.tr) continue;
          if ((wantTeach && q.who === 'teach') || (wantHint && q.who === 'note' && !q.j)) { e = q; break; }
          if (q.t > pl.t + 4) break;
        }
      }
      if (e) { h.n = e.n; h.on = true; h.e = e; } else { h.on = false; h.e = null; }
      if (e && Math.abs(e.t - pl.t) < 0.08) h.down = 1;
      h.down = Math.max(0, h.down - dt * 7);
    }
  }
  function autoStep(pl, dt, tap) {
    const A = pl.auto, P = lay().play;
    if (tap && inRect(P.hint, tap.x, tap.y)) A.timer = 0;
    A.timer -= dt;
    if (A.timer <= 0) {
      if (A.phase === 'think') { A.phase = 'reveal'; A.timer = THINK.reveal; A.total = THINK.reveal; }
      else if (A.phase === 'reveal') { A.phase = 'act'; autoPhrase(pl); pl.resync = true; }
    }
    stepAnim(pl, dt);
    for (const h of pl.hand) { h.e = null; h.on = false; }
  }
  function updatePlay(dt, tap, input) {
    const pl = state.pl, P = lay().play;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    if (tap) {
      if (inRect(P.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (pl.mode === 'learn' && !pl.learn.final && inRect(P.hint, tap.x, tap.y)) { listenAgain(); return; }
      if (pl.mode !== 'auto' && inRect(P.hint, tap.x, tap.y)) { pl.hintT = 4; return; }
      if (!R.available && pl.mode !== 'auto' && !inRect(P.hint, tap.x, tap.y)) { const used = pdown(-1, tap.x, tap.y, 0); if (used) pup(-1); }
    }
    if (input.keys.pressed.has('Space') || input.keys.pressed.has('Escape')) { pausePlay(); return; }
    if (pl.mode !== 'auto') keysTick(pl, input);
    if (pl.auto && pl.auto.phase !== 'act') { autoStep(pl, dt, tap); return; }
    pl.t += dt;
    if (R.available) { R.sync(pl.t, pl.resync); pl.resync = false; }
    const horizon = pl.t + LOOKAHEAD;
    while (pl.si < pl.ev.length && pl.ev[pl.si].t <= horizon) {
      const e = pl.ev[pl.si++];
      if (e.on === undefined) e.on = evOn(pl, e);
      if (e.on && state.prefs.sound && e.who !== 'note') soundEvent(pl, e);
    }
    while (pl.fi < pl.ev.length && pl.ev[pl.fi].t <= pl.t) {
      const e = pl.ev[pl.fi++];
      if (e.on === undefined) e.on = evOn(pl, e);
      if (e.who === 'click') { if (e.on) pl.pulse = e.k === 'accent' ? 1 : 0.6; continue; }
      if (e.who === 'note' || !e.on) continue;
      if (e.who === 'ens') { if (e.tab === 'dha' || e.drone !== undefined) pl.pulse = Math.max(pl.pulse, 0.35); continue; }
      ring(pl, e.n, e.tr ? 0.2 : 0.9, 'ens', undefined, undefined, e.side);
    }
    // notes nobody played
    for (let n = 0; n < NNOTE; n++) {
      const arr = pl.nd[n];
      while (pl.np[n] < arr.length) {
        const e = arr[pl.np[n]];
        if (e.j) { pl.np[n] += 1; continue; }
        if (e.t + win(e).o + state.prefs.cal / 1000 < pl.t) { missNote(pl, e); pl.np[n] += 1; } else break;
      }
    }
    // rolls being held
    for (const e of [...pl.rolls]) {
      if (ptrs.has(e.hid) && ptrs.get(e.hid).n === e.n) e.heldTo = Math.min(pl.t, e.t + e.dur);
      if (pl.t >= e.t + e.dur) finishRoll(pl, e);
    }
    stepAnim(pl, dt); stepHand(pl, dt);
    // chunk logic: what happens when a call-and-response pair, a whole piece or the final take is over
    const c = pl.cur;
    if (c && !c.done && !c.cancel && pl.t >= c.t1 + 0.2) {
      for (const e of [...pl.rolls]) finishRoll(pl, e);
      c.done = true;
      const acc = c.n ? c.sum / c.n : 1;
      if (pl.mode === 'auto') {
        pl.auto.k += 1;
        if (pl.auto.k >= 4) { pl.over = true; R.flush(); return; }
        pl.auto.phase = 'think'; pl.auto.timer = state.prefs.think; pl.auto.total = state.prefs.think; R.flush(); pl.resync = true; return;
      }
      if (pl.mode === 'perform' || c.kind === 'final') { finishRun(); return; }
      const L2 = pl.learn;
      L2.tries[c.phrase] = c.attempt;
      if (acc < LEARN.pass && L2.attempt < LEARN.tries) { L2.attempt += 1; pl.banner = { text: 'ONCE MORE', t: 0 }; }
      else { L2.acc[c.phrase] = acc; L2.phrase += 1; L2.attempt = 1; if (L2.phrase >= 4) L2.final = true; pl.banner = { text: acc >= 0.75 ? 'LOVELY' : 'ON TO THE NEXT', t: 0 }; }
      pl.endT = Math.max(pl.endT, pl.t) + beatOf(pl);
      learnStep(pl);
    }
  }
  // Keyboard: keys 1 2 3 4 5 6 7 8 9 0 Q W E R T Y are notes 1 to 16; holding a key is a roll.
  function keysTick(sess, input) {
    const k = input.keys;
    for (let n = 0; n < NNOTE; n++) {
      const id = `k${n}`;
      if (k.pressed.has(KEYS[n])) {
        heldKeys.add(n);
        const inst = instOf(), p = inst.pt(n);
        ptrs.set(id, { n, side: n & 1, x: p.x, y: p.y, t0: sess.t, lastTr: sess.t });
        strikeAt(sess, n, sess.t, id, p.x, p.y);
      } else if (heldKeys.has(n) && !k.down.has(KEYS[n])) { heldKeys.delete(n); pup(id); }
    }
    syncTv();
  }

  function finishRun() {
    const pl = state.pl;
    const fc = pl.chunks.find((c) => c.kind === 'final' || c.kind === 'whole');
    const acc = fc && fc.n ? fc.sum / fc.n : 0, stars = accuracyToStars(acc);
    const id = pl.piece.id, old = state.best[id] ?? {};
    const res = { piece: pl.pi, mode: pl.mode, score: pl.score, acc, stars, grade: gradeOf(acc), maxCombo: pl.maxCombo, counts: { ...pl.counts }, rollOk: pl.rollOk, rollShort: pl.rollShort, runN: pl.runN, learn: pl.learn ? { acc: [...pl.learn.acc], tries: [...pl.learn.tries] } : null, newBest: false };
    if (pl.mode === 'perform') {
      res.newBest = !old.score || pl.score > old.score;
      state.best[id] = { ...old, score: Math.max(old.score || 0, pl.score), acc: Math.max(old.acc || 0, acc), stars: Math.max(old.stars || 0, stars), combo: Math.max(old.combo || 0, pl.maxCombo) };
    } else state.best[id] = { ...old, learn: Math.max(old.learn || 0, stars) };
    storage.set('best', state.best);
    env.monetization.track?.('piece_end', { piece: id, mode: pl.mode, stars });
    R.flush(); pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  function pauseItems(pl) {
    return pl.over ? ['again', 'next', 'exit'] : pl.mode === 'learn' && !pl.learn.final ? ['resume', 'listen', 'restart', 'quit'] : pl.mode === 'auto' ? ['resume', 'speed', 'next', 'quit'] : ['resume', 'restart', 'quit'];
  }
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems(pl), M = menuRects(lay(), items.length);
    if (input.keys.pressed.has('Escape') && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart' || it === 'again') startPlay(pl.mode);
      else if (it === 'listen') { resumePlay(); listenAgain(); }
      else if (it === 'speed') { state.prefs.autoSlow = !state.prefs.autoSlow; savePrefs(); startPlay('auto'); }
      else if (it === 'next') { state.sel = (state.sel + 1) % PIECES.length; startPlay('auto'); }
      else go('piece');
    });
  }

  // ---- free play ---------------------------------------------------------------------------------------------------------------------------------------
  function startFree() {
    if (config.demo && state.demoRuns >= DEMO_RUNS) { go('demo-limit'); return; }
    if (config.demo) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush(); ptrs.clear(); heldKeys.clear(); state.tv = [];
    state.free = newSess({ scale: state.prefs.scale, hits: 0 });
    state.scene = 'free'; state.sceneT = 0;
  }
  function updateFree(dt, tap, input) {
    const f = state.free, F = lay().free;
    if (tap) {
      if (inRect(F.exit, tap.x, tap.y)) { go('title'); state.free = null; return; }
      if (inRect(F.scale, tap.x, tap.y)) {
        const i = SCALES.findIndex((q) => q.id === f.scale), nx = SCALES[(i + 1) % SCALES.length].id;
        f.scale = nx; state.prefs.scale = nx; storage.set('prefs', state.prefs);
        if (state.prefs.sound) [0, 2, 4].forEach((n, k) => R.play(n, hzFor(f, n), 0.5, f.t + 0.05 + k * 0.12));
        for (let n = 0; n < NNOTE; n++) ring(f, n, 0.5, 'ens');
      } else if (inRect(F.labels, tap.x, tap.y)) { state.prefs.labelIdx = (state.prefs.labelIdx + 1) % LABEL_MODES.length; savePrefs(); }
      else if (inRect(F.reset, tap.x, tap.y)) { f.scale = 'pahadi'; state.prefs.scale = 'pahadi'; say('Pahadi, the default scale'); }
      else if (!R.available) { const used = pdown(-1, tap.x, tap.y, 0); if (used) pup(-1); }
    }
    if (input.keys.pressed.has('Escape')) { go('title'); state.free = null; return; }
    keysTick(f, input);
    f.t += dt;
    if (R.available) R.sync(f.t, false);
    stepAnim(f, dt);
  }

  // ---- calibration ---------------------------------------------------------------------------------------------------------------------------------------
  function startCal() {
    R.flush(); ptrs.clear();
    state.cal = { t: 0, T0: 1.8, n: 12, bpm: 90, taps: [], next: 0, pulse: 0, flash: 0, phase: 'run', result: null, resync: true, lastBeat: -1 };
    state.scene = 'calib'; state.sceneT = 0;
  }
  const calBeat = (c, i) => c.T0 + (i * 60) / c.bpm;
  function calTap(tSong) {
    const c = state.cal; if (!c || c.phase !== 'run') return;
    if (state.prefs.sound) R.play(8, hzOf(24), 0.7, null);
    c.flash = 1; c.taps.push(tSong);
  }
  function calFinish(c) {
    const errs = [];
    for (const t of c.taps) {
      let best = null; for (let i = 4; i < c.n; i++) { const e = t - calBeat(c, i); if (best === null || Math.abs(e) < Math.abs(best)) best = e; }
      if (best !== null && Math.abs(best) < 0.35) errs.push(best);
    }
    errs.sort((a, b) => a - b);
    c.phase = 'done';
    c.result = errs.length >= 5 ? { ms: Math.round(errs[Math.floor(errs.length / 2)] * 1000), n: errs.length } : { ms: null, n: errs.length };
  }
  function leaveCal() { go('settings'); state.docKey = 'settings'; state.backTo = 'title'; state.docScroll = 0; state.cal = null; }
  function updateCal(dt, tap, input) {
    const c = state.cal, C = lay().calib;
    if (tap) {
      if (inRect(C.back, tap.x, tap.y)) { leaveCal(); return; }
      if (c.phase === 'done') {
        if (inRect(C.retry, tap.x, tap.y)) { startCal(); return; }
        if (c.result.ms !== null && inRect(C.use, tap.x, tap.y)) { state.prefs.cal = Math.max(-100, Math.min(400, c.result.ms)); savePrefs(); leaveCal(); say(`Latency set to ${state.prefs.cal} ms`); return; }
        if (c.result.ms === null && inRect(C.use, tap.x, tap.y)) { leaveCal(); return; }
      } else if (!R.available) calTap(c.t);
    }
    if (input.keys.pressed.has('Space')) calTap(c.t);
    c.t += dt;
    if (R.available) { R.sync(c.t, c.resync); c.resync = false; }
    while (c.next < c.n && calBeat(c, c.next) - LOOKAHEAD <= c.t) { if (state.prefs.sound) R.click(c.next % 4 === 0, calBeat(c, c.next)); c.next += 1; }
    c.flash = Math.max(0, c.flash - dt * 5);
    const bi = Math.floor(((c.t - c.T0) * c.bpm) / 60);
    if (c.t >= c.T0 && bi >= 0 && bi !== c.lastBeat && bi < c.n) { c.lastBeat = bi; c.pulse = 1; }
    c.pulse = Math.max(0, c.pulse - dt * 3);
    if (c.phase === 'run' && c.t > calBeat(c, c.n - 1) + 0.6) calFinish(c);
  }

  // ---- menus and documents ----------------------------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'speed') p.speedIdx = cyc(p.speedIdx, SPEEDS.length);
    else if (id === 'timing') p.timingIdx = cyc(p.timingIdx, TIMING.length);
    else if (id === 'labels') p.labelIdx = cyc(p.labelIdx, LABEL_MODES.length);
    else if (id === 'click') p.click = !p.click;
    else if (id === 'haptics') p.haptics = !p.haptics;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'thinkDec') p.think = Math.max(THINK.min, p.think - 1);
    else if (id === 'thinkInc') p.think = Math.min(THINK.max, p.think + 1);
    else if (id === 'calDec') p.cal = Math.max(-100, p.cal - 5);
    else if (id === 'calInc') p.cal = Math.min(400, p.cal + 5);
    else if (id === 'calibrate') { startCal(); return; }
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') {
      if (state.restoreBusy || state.owned || state.demo || !mon) return;
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
    if (hit(T.play)) go('songs');
    else if (hit(T.free)) startFree();
    else if (hit(T.auto)) { state.sel = 0; startPlay('auto'); }
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 90 && Math.abs(tap.x - T.credit.x) < 190) env.openArcforgeHome?.();
  }
  function updateSongs(tap) {
    if (!tap) return;
    const G = lay().songs;
    if (inRect(G.back, tap.x, tap.y)) { go('title'); return; }
    G.cards.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { state.sel = i; go('piece'); } });
  }
  function updatePiece(tap) {
    if (!tap) return;
    const D = lay().piece;
    if (inRect(D.back, tap.x, tap.y)) go('songs');
    else if (inRect(D.learn, tap.x, tap.y)) startPlay('learn');
    else if (inRect(D.perform, tap.x, tap.y)) startPlay('perform');
    else if (inRect(D.watch, tap.x, tap.y)) startPlay('auto');
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay(state.result.mode);
    else if (inRect(Rr.songs, tap.x, tap.y)) go('songs');
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see ---------------------------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (mon?.owns) state.owned = !!mon.owns('unlock_game');
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'songs') updateSongs(tap);
      else if (sc === 'piece') updatePiece(tap);
      else if (sc === 'play') updatePlay(dt, tap, input);
      else if (sc === 'free') updateFree(dt, tap, input);
      else if (sc === 'calib') updateCal(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { host.tz = TEXT_SCALES[state.prefs.textIdx] ?? 1; render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems, { approach: approach(), labelMode: labelMode(), hzFor }); },
    getState: () => state,
    // Multi-touch from main.js (the kit input only has one pointer). pdown returns true when the game used the touch.
    pdown, pmove, pup,
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except real play is free: menus, Rules, calibration, Watch and Learn, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !((state.scene === 'play' && pl && pl.mode !== 'auto' && !pl.paused && !pl.over) || state.scene === 'free');
    },
    // Tester tools (?dev=1): jump to a screen and fast-forward.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.piece !== undefined) state.sel = o.piece;
        const sc = o.scene ?? 'title';
        if (sc === 'play') startPlay(o.mode ?? 'perform');
        else if (sc === 'free') { startFree(); if (o.scale) state.free.scale = o.scale; }
        else if (sc === 'calib') startCal();
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('perform'); const pl = state.pl; pl.score = 123450; pl.maxCombo = 41; pl.counts = { perfect: 88, great: 31, good: 9, off: 4, miss: 3 }; pl.rollOk = 3; pl.runN = 14; pl.chunks[0].sum = 118; pl.chunks[0].n = 135; finishRun();
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.strike && state.free) o.strike.forEach((n) => strikeAt(state.free, n, 0, `dev${n}`));
        if (o.pause && state.pl) pausePlay();
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) {
            const pl = state.pl;
            if (pl && state.scene === 'play' && o.play && !pl.paused && pl.mode !== 'auto') {
              for (let n = 0; n < NNOTE; n++) {
                const e = pl.nd[n][pl.np[n]];
                if (e && !e.j && e.t <= pl.t + 0.01 + state.prefs.cal / 1000) { strikeAt(pl, n, pl.t, `dev${n}`); if (e.kind === 'roll') { ptrs.set(`dev${n}`, { n, side: n & 1, x: 0, y: 0, t0: pl.t, lastTr: pl.t }); } }
              }
              for (const [id, p] of [...ptrs]) if (String(id).startsWith('dev')) { const e = pl.rolls.find((r) => r.hid === id); if (!e || pl.t >= e.t + e.dur - 0.05) { pup(id); } else if (p.y !== undefined) { /* keep holding */ } }
            }
            api.update(1 / 60, idle);
          }
        }
      },
    },
  };
  void HANDS;
  return api;
}
