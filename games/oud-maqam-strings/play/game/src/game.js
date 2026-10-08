// Oud Maqam Strings: state and flow. Drawing is in view.js / playview.js / docview.js; the music and the rule constants are in music.js.
//
// Timing model: song time `pl.t` is the sum of the dt values handed to update() (deterministic, pausable). When the browser gives us an
// audio engine (env.rhythm, see web/audio/engine.js) the computer's notes and the rhythm are scheduled on the audio clock a little ahead
// of pl.t, and a player's touch is time-stamped on the audio clock and converted back to song time before it is judged. Headless runs
// have no engine: the same code runs with touches taken at the tick time.
//
// Pitch model: a finger on the neck has a pitch in cents above the open string (its position through the real string law, see music.js),
// optionally pulled toward the nearest scale degree (pitch assist). A pluck is judged on the time AND the pitch at that instant.
import {
  PIECES, FORM, MAQAMAT, IQA, JUDGE, TIMING, PITCH_WINDOW, ASSIST, SCORE, WEIGHT, ENSEMBLE, LEARN, LOOKAHEAD, SLIDE_GRACE, JOURNEY,
  buildRun, slotDur, pieceSpan, centsOfPos, posOfCents, assisted, comboMult, accuracyToStars, gradeOf, captionFor, fingerAt, parsePhrase, degLabel, GRADES,
} from './music.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';
import { GRADE_TEXT, GRADE_COL } from './playview.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const NO_RHYTHM = {
  available: false, pluck: () => 0, play: () => 0, bend() {}, release() {}, drum() {}, click() {}, shimmer() {}, drone() {}, sync() {}, flush() {},
  toSong: () => NaN, setMuted() {}, now: () => 0, haptic() {},
};
const DEMO_RUNS = 6;
const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'];
const TONIC = { rast: 196, bayati: 220, hijaz: 220, nahawand: 261.63 };
const MAQ_ORDER = ['rast', 'bayati', 'hijaz', 'nahawand'];
const newFx = () => ({ vib: null, pops: [], parts: [], pulse: 0, shake: 0, banner: null, hint: 0, pluckAt: null, calm: false });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(env) {
  const { rng, storage, config } = env;
  const R = env.rhythm ?? NO_RHYTHM;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, backing: true, haptics: true, windowIdx: 0, assistIdx: 1, timingIdx: 1, cal: 0, thinkSec: 5, marks: true, labels: true, calm: false, textIdx: 0, autoSlow: false },
    best: {}, demoRuns: 0, pl: null, free: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
  };
  let lastScene = state.scene, drag = null;

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = clamp(state.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1); state.prefs.thinkSec = clamp(state.prefs.thinkSec | 0, 2, 10); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { R.setMuted(!state.prefs.sound); env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const tk = () => TIMING[state.prefs.timingIdx].k;
  const win = () => ({ p: JUDGE.perfect * tk(), g: JUDGE.great * tk(), o: JUDGE.good * tk() });
  const pwin = () => PITCH_WINDOW[state.prefs.windowIdx];
  const go = (scene) => {
    if (state.scene === 'play' || state.scene === 'free' || state.scene === 'calib') { R.flush(); R.drone(false); }
    state.scene = scene;
    if (scene !== 'play' && scene !== 'result') state.pl = null;
    if (scene !== 'free') state.free = null;
  };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  const songAt = (audioTime, fallback) => { const s = R.available ? R.toSong(audioTime) : NaN; return Number.isFinite(s) ? s : fallback; };

  // ---- a play session -------------------------------------------------------------------------------------------------------------------
  function newPlay(pieceIdx, mode) {
    const piece = PIECES[pieceIdx];
    return {
      mode, pi: pieceIdx, piece, span: pieceSpan(piece), t: 0, ev: [], si: 0, fi: 0, notes: [], np: 0, dm: [], endT: 0.5, bars: [], chunks: [], cur: null, cw: [],
      speed: mode === 'auto' && state.prefs.autoSlow ? 0.75 : 1, formStart: 0, formEnd: 0,
      ens: mode === 'auto' ? ENSEMBLE.max : ENSEMBLE.start, streak: 0, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, off: 0, miss: 0 }, pitchSum: 0, pitchN: 0,
      paused: false, over: false, resync: true, counting: false, listening: false, droneOn: false,
      learn: mode === 'learn' ? { phrase: 0, attempt: 1, final: false, acc: [], tries: [] } : null,
      auto: mode === 'auto' ? { phase: 'think', pt: 0, dur: 0, idx: 0, seen: {}, title: '', text: '', route: [], chunk: null } : null,
      fingers: {}, fid: null, ghost: null, caption: '', capIdx: -1, slides: [], fx: newFx(), marks: true, labels: true,
    };
  }
  function append(pl, segs, extra = {}) {
    const run = buildRun(pl.piece, segs, pl.endT, { speed: pl.speed, backing: state.prefs.backing });
    const id = pl.chunks.length, chunk = { id, t0: run.T0, t1: run.end, sum: 0, n: 0, done: false, ...extra };
    for (const e of run.events) {
      e.ch = id;
      pl.ev.push(e);
      if (e.who === 'note') { pl.notes.push(e); chunk.n += e.to !== undefined ? 2 : 1; }
      if (e.who === 'demo') pl.dm.push(e);
    }
    if (segs.some((s) => s.kind === 'count')) pl.cw.push({ t0: run.T0, t1: run.T0 + 8 * slotDur(pl.piece, pl.speed) });
    pl.bars.push(...run.bars);
    if (run.bars.length) { pl.formStart = run.bars[0].t0; pl.formEnd = run.bars[run.bars.length - 1].t1; }
    pl.chunks.push(chunk); pl.cur = chunk; pl.endT = run.end;
    return chunk;
  }
  const beatOf = (pl) => slotDur(pl.piece, pl.speed) * 2;
  function learnStep(pl, first) {
    const L = pl.learn, ph = L.phrase;
    if (L.final) { pl.ens = ENSEMBLE.start; pl.streak = 0; return append(pl, [{ kind: 'count' }, { kind: 'play', ph: FORM }], { kind: 'final' }); }
    const segs = [...(first ? [{ kind: 'count' }] : []), { kind: 'listen', ph: [ph] }, { kind: 'echo', ph: [ph] }];
    return append(pl, segs, { kind: 'pair', phrase: ph, attempt: L.attempt });
  }
  function startPlay(mode) {
    if (config.demo && mode !== 'auto' && (state.sel > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (config.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush(); R.drone(false);
    const pl = newPlay(state.sel, mode); state.pl = pl; state.result = null;
    if (mode === 'learn') learnStep(pl, true);
    else if (mode === 'perform') append(pl, [{ kind: 'count' }, { kind: 'play', ph: FORM }], { kind: 'whole' });
    else autoPhase(pl, 'think');
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('piece_start', { piece: pl.piece.id, mode });
  }
  function pausePlay() {
    const pl = state.pl; if (!pl || pl.paused || pl.over) return;
    pl.paused = true; R.flush(); R.drone(false); pl.droneOn = false;
    for (const id in pl.fingers) if (pl.fingers[id].voice) R.release(pl.fingers[id].voice);
    pl.fingers = {}; pl.fid = null;
    while (pl.si > 0 && pl.ev[pl.si - 1].t > pl.t) pl.si -= 1;      // what was scheduled but not yet heard will be scheduled again
  }
  function resumePlay() { const pl = state.pl; if (!pl) return; pl.paused = false; pl.resync = true; }
  function truncateFuture(pl) {
    let k = pl.ev.length; while (k > 0 && pl.ev[k - 1].t > pl.t) k -= 1;
    pl.ev.length = k; pl.si = Math.min(pl.si, k); pl.fi = Math.min(pl.fi, k);
    pl.notes = pl.notes.filter((n) => n.t <= pl.t); pl.np = Math.min(pl.np, pl.notes.length);
    pl.dm = pl.dm.filter((n) => n.t <= pl.t);
    pl.bars = pl.bars.filter((b) => b.t0 <= pl.t); pl.cw = pl.cw.filter((c) => c.t0 <= pl.t); pl.endT = pl.t;
    R.flush(); pl.resync = true;
  }
  function listenAgain() {
    const pl = state.pl;
    if (!pl || pl.mode !== 'learn' || pl.learn.final || pl.paused || pl.over) return;
    if (pl.cur) pl.cur.cancel = true;
    truncateFuture(pl); pl.endT = pl.t + beatOf(pl) * 1.5;
    learnStep(pl, false); say('Listen again', 1.4);
  }
  function hintNow() {
    const pl = state.pl; if (!pl || pl.paused || pl.over) return;
    if (pl.mode === 'learn') { listenAgain(); return; }
    if (pl.mode === 'perform') pl.fx.hint = 4;
  }

  // ---- Watch and Learn: Think -> Reveal -> Act, phrase by phrase --------------------------------------------------------------------------------
  function describePhrase(pl, pi) {
    const sl = parsePhrase(pl.piece.phrases[pi]).filter(Boolean), M = MAQAMAT[pl.piece.maqam];
    const first = sl[0].deg, hi = Math.max(...sl.map((s) => Math.max(s.deg, s.to ?? 0))), slides = sl.filter((s) => s.to !== undefined).length;
    const q = sl.find((s) => M.q.includes(s.deg) || (s.to !== undefined && M.q.includes(s.to)));
    let text = `It starts on degree ${degLabel(pl.piece.maqam, first)} and reaches up to ${degLabel(pl.piece.maqam, hi)}.`;
    if (slides) text += ` ${slides === 1 ? 'One note slides' : slides + ' notes slide'} while the string rings.`;
    if (q) text += ` Listen for the quarter-tone, degree ${degLabel(pl.piece.maqam, M.q.includes(q.deg) ? q.deg : q.to)}.`;
    return { text, route: sl.slice(0, 8).map((s) => M.deg[s.deg]) };
  }
  function autoPhase(pl, phase) {
    const a = pl.auto, pi = FORM[a.idx];
    a.phase = phase; a.pt = 0;
    if (phase === 'think') {
      const d = describePhrase(pl, pi);
      a.title = `Phrase ${a.idx + 1} of ${FORM.length}`; a.text = d.text; a.route = d.route;
      a.dur = a.seen[pi] ? 1.2 : clamp(state.prefs.thinkSec, 2, 10);
      pl.caption = '';
    } else if (phase === 'reveal') a.dur = 2;
    else {
      a.seen[pi] = true; pl.endT = Math.max(pl.endT, pl.t + 0.3);
      a.chunk = append(pl, [{ kind: 'auto', ph: [pi] }], { kind: 'auto', phrase: pi });
      a.dur = 0;
    }
  }
  function updateAuto(pl, dt) {
    const a = pl.auto;
    if (a.phase === 'think' || a.phase === 'reveal') {
      a.pt += dt;
      if (a.pt >= a.dur) autoPhase(pl, a.phase === 'think' ? 'reveal' : 'act');
    } else if (a.chunk && pl.t >= a.chunk.t1 + 0.3) {
      a.idx += 1;
      if (a.idx >= FORM.length) { pl.over = true; R.flush(); R.drone(false); } else autoPhase(pl, 'think');
    }
  }

  // ---- geometry helpers ------------------------------------------------------------------------------------------------------------------------
  const geo = (sess) => { const G = sess === state.free ? lay().free.inst : lay().play.inst; G.span = sess.span; return G; };
  const uOfC = (G, c) => posOfCents(Math.min(c, G.span), G.span) * G.Lneck;
  const maqamOf = (sess) => (sess === state.free ? sess.maqam : sess.piece.maqam);
  const tonicOf = (sess) => (sess === state.free ? sess.tonic : sess.piece.tonic);
  function pitchAt(sess, G, loc) {
    const raw = loc.u < 12 ? 0 : centsOfPos(loc.u / G.Lneck, G.span);
    return { raw, c: assisted(raw, maqamOf(sess), state.prefs.assistIdx) };
  }

  // ---- judging --------------------------------------------------------------------------------------------------------------------------------
  const pop = (sess, c, text, sub, col, size) => {
    sess.fx.pops = sess.fx.pops.filter((q) => Math.abs(q.c - c) > 40);
    sess.fx.pops.push({ c, text, sub, col, size, age: 0 }); if (sess.fx.pops.length > 8) sess.fx.pops.shift();
  };
  const ensUp = (pl) => { if (pl.mode === 'perform' || (pl.learn && pl.learn.final)) { if (pl.streak % ENSEMBLE.every === 0 && pl.ens < ENSEMBLE.max) { pl.ens += 1; pl.fx.banner = { text: 'THE ROOM LIGHTS UP', t: 0 }; } } };
  function addResult(pl, g, chunkId, c, extra) {
    pl.score += SCORE[g] * comboMult(pl.combo); pl.combo += 1; pl.maxCombo = Math.max(pl.maxCombo, pl.combo);
    pl.counts[g] += 1; pl.streak += 1;
    const ch = pl.chunks[chunkId]; if (ch) ch.sum += WEIGHT[g];
    ensUp(pl);
    pop(pl, c, GRADE_TEXT[g], extra, GRADE_COL[g], g === 'perfect' ? 40 : 34);
  }
  function judgePluck(pl, c, tSong, fid) {
    const w = win(), pw = pwin(), tAdj = tSong - state.prefs.cal / 1000;
    let best = null;
    for (let i = pl.np; i < pl.notes.length && pl.notes[i].t <= tAdj + w.o; i++) {
      const n = pl.notes[i]; if (n.j) continue;
      const e = Math.abs(n.t - tAdj); if (e <= w.o && (!best || e < Math.abs(best.t - tAdj))) best = n;
    }
    if (!best) return null;
    const n = best, terr = tAdj - n.t, perr = c - n.c, ta = Math.abs(terr), pa = Math.abs(perr);
    const tg = ta <= w.p ? 0 : ta <= w.g ? 1 : 2, pg = pa <= pw.p ? 0 : pa <= pw.g ? 1 : pa <= pw.o ? 2 : 3;
    const level = pa > 120 ? 3 : Math.max(tg, pg), g = GRADES[level];
    n.j = g; n.err = terr; n.perr = perr; n.fc = c; n.jt = pl.t; n.fid = fid;
    pl.pitchSum += perr; pl.pitchN += 1;
    let sub = '';
    if (pa > pw.p * 0.7) sub = `${perr > 0 ? 'sharp' : 'flat'} ${Math.round(pa)}`; else if (ta > w.p) sub = terr > 0 ? 'late' : 'early';
    if (n.to !== undefined) { n.sl = { done: false, best: Infinity, fid }; pl.slides.push(n); }
    addResult(pl, g, n.ch, n.c, sub);
    if (pl.ens >= 3 && state.prefs.sound) R.shimmer(n.c, pl.piece.tonic);
    return n;
  }
  function judgeSlide(pl, n) {
    const pw = pwin(), s = n.sl; s.done = true;
    const b = s.best, g = !Number.isFinite(b) ? 'miss' : b <= pw.p ? 'perfect' : b <= pw.g ? 'great' : b <= pw.o ? 'good' : 'off';
    if (g === 'miss') { pl.counts.miss += 1; pl.combo = 0; pl.streak = 0; if (pl.mode === 'perform' || (pl.learn && pl.learn.final)) pl.ens = Math.max(0, pl.ens - 1); pop(pl, n.to, 'SLIDE MISSED', '', GRADE_COL.miss, 28); return; }
    n.sj = g;
    addResult(pl, g, n.ch, n.to, b > pw.p * 0.7 ? `landing ${Math.round(b)} off` : 'landing');
  }
  function missNote(pl, n) {
    n.j = 'miss'; pl.counts.miss += 1; pl.combo = 0; pl.streak = 0;
    if (n.to !== undefined) n.sl = { done: true, best: Infinity };
    if (pl.mode === 'perform' || (pl.learn && pl.learn.final)) pl.ens = Math.max(0, pl.ens - 1);
    pop(pl, n.c, 'MISS', '', GRADE_COL.miss, 30);
  }

  // ---- plucking (what a touch looks and sounds like) -----------------------------------------------------------------------------------------------
  function sparks(sess, G, c, n) { if (!state.prefs.calm) { const p = G.toScreen(uOfC(G, c), 0); burst(sess.fx.parts, rng, p.x, p.y, n, '#ffd88a'); } }
  function pluckCore(sess, G, c, tSong, fid) {
    const vid = state.prefs.sound ? R.pluck(c, tonicOf(sess), 0.85) : 0;
    sess.fx.vib = { age: 0 }; sess.fx.pluckAt = { u: uOfC(G, c), v: 0, age: 0 };
    if (state.prefs.haptics) R.haptic(8);
    sparks(sess, G, c, 7);
    if (sess === state.pl) { if (sess.mode !== 'auto' && !sess.paused && !sess.over) judgePluck(sess, c, tSong, fid); }
    else if (sess === state.free) freePluck(c);
    return vid;
  }
  const playableNow = (sess) => !!sess && (sess === state.free || (sess === state.pl && !sess.paused && !sess.over && sess.mode !== 'auto'));
  function neckDown(sess, G, id, loc, tSong) {
    const { c } = pitchAt(sess, G, loc);
    const f = { id, c, down: true, voice: 0 };
    sess.fingers[id] = f; sess.fid = id;
    f.voice = pluckCore(sess, G, c, tSong, id);
  }
  function padTap(sess, G, tSong) {
    const held = sess.fid !== null && sess.fingers[sess.fid] ? sess.fingers[sess.fid] : null;
    const vid = pluckCore(sess, G, held ? held.c : 0, tSong, held ? held.id : null);
    if (held) { if (held.voice) R.release(held.voice); held.voice = vid; }
  }
  function pointerDown(id, x, y, audioTime) {
    if (state.scene === 'calib' && state.cal) { const C = lay().calib; if (!R.available || inRect(C.back, x, y) || inRect(C.retry, x, y) || inRect(C.done, x, y) || !inRect(C.pad, x, y)) return false; calibTap(audioTime); return true; }
    const sc = state.scene, sess = sc === 'play' ? state.pl : sc === 'free' ? state.free : null;
    if (!playableNow(sess)) return false;
    const Lo = sc === 'play' ? lay().play : lay().free, G = geo(sess);
    if (sc === 'play' && (inRect(Lo.pause, x, y) || inRect(Lo.hint, x, y))) return false;
    if (!inRect(G.area, x, y)) return false;
    const loc = G.toLocal(x, y), tSong = songAt(audioTime, sess.t);
    if (loc.u <= G.uPad) neckDown(sess, G, id, loc, tSong); else padTap(sess, G, tSong);
    return true;
  }
  function pointerMove(id, x, y) {
    const sess = state.scene === 'play' ? state.pl : state.scene === 'free' ? state.free : null;
    const f = sess && sess.fingers[id]; if (!f || !f.down) return;
    const G = geo(sess), { c } = pitchAt(sess, G, G.toLocal(x, y));
    f.c = c; if (f.voice) R.bend(f.voice, c);
  }
  function pointerUp(id) {
    const sess = state.scene === 'play' ? state.pl : state.scene === 'free' ? state.free : null;
    const f = sess && sess.fingers[id]; if (!f) return;
    f.down = false; if (f.voice) R.release(f.voice);
    delete sess.fingers[id];
    if (sess.fid === id) { const rest = Object.keys(sess.fingers); sess.fid = rest.length ? +rest[rest.length - 1] : null; }
  }
  function keyPluck(sess, d) { pluckCore(sess, geo(sess), MAQAMAT[maqamOf(sess)].deg[d], sess.t, null); }

  // ---- per-tick play update -----------------------------------------------------------------------------------------------------------------
  function stepFx(sess, dt) {
    const fx = sess.fx;
    for (const p of fx.pops) p.age += dt;
    fx.pops = fx.pops.filter((p) => p.age < 1.0);
    stepParticles(fx.parts, dt);
    fx.pulse = Math.max(0, fx.pulse - dt * 4); fx.shake = Math.max(0, fx.shake - dt * 4);
    if (fx.vib) { fx.vib.age += dt; if (fx.vib.age > 1.6) fx.vib = null; }
    if (fx.pluckAt) fx.pluckAt.age += dt;
    if (fx.hint > 0) fx.hint = Math.max(0, fx.hint - dt);
    if (fx.banner) { fx.banner.t += dt; if (fx.banner.t > 1.6) fx.banner = null; }
  }
  // The kit's single pointer, used when there is no audio engine (headless runs).
  function pointerFallback(input, sess) {
    const p = input.pointer;
    if (p.pressed) pointerDown(-1, p.x, p.y, NaN);
    else if (p.down && sess.fingers[-1]) pointerMove(-1, p.x, p.y);
    if (p.released) pointerUp(-1);
  }
  function updatePlay(dt, tap, input) {
    const pl = state.pl, L = lay().play;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    if (tap) {
      if (inRect(L.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (pl.mode !== 'auto' && inRect(L.hint, tap.x, tap.y)) { hintNow(); return; }
    }
    if (!R.available) pointerFallback(input, pl);
    for (let i = 0; i < 8; i++) if (input.keys.pressed.has(KEYS[i]) && pl.mode !== 'auto') keyPluck(pl, i);
    if (input.keys.pressed.has('KeyH')) hintNow();
    if (input.keys.pressed.has('Space') || input.keys.pressed.has('Escape')) { pausePlay(); return; }
    pl.t += dt;
    if (R.available) { R.sync(pl.t, pl.resync); pl.resync = false; }
    if (pl.mode === 'auto') updateAuto(pl, dt);
    if (pl.over) return;
    const tonic = pl.piece.tonic;
    const wantDrone = pl.ens >= 1;
    if (wantDrone !== pl.droneOn) { pl.droneOn = wantDrone; if (state.prefs.sound) R.drone(wantDrone, tonic); }
    // audio scheduling, a little ahead of the song clock
    const horizon = pl.t + LOOKAHEAD;
    while (pl.si < pl.ev.length && pl.ev[pl.si].t <= horizon) {
      const e = pl.ev[pl.si++];
      if (!state.prefs.sound) continue;
      if (e.who === 'click') R.click(e.k === 'accent', e.t);
      else if (e.who === 'back') { if (!e.ghost || pl.ens >= 2) R.drum(e.k, e.k === 'dum' ? 0.8 : e.k === 'tak' ? 0.65 : 0.4, e.t); }
      else if (e.who === 'demo') R.play(e.c, tonic, 0.8, e.t, e.to, e.dur);
    }
    // visuals at the moment of the event
    while (pl.fi < pl.ev.length && pl.ev[pl.fi].t <= pl.t) {
      const e = pl.ev[pl.fi++];
      if (e.who === 'click') pl.fx.pulse = e.k === 'accent' ? 1 : 0.6;
      else if (e.who === 'back') { if (!e.ghost) pl.fx.pulse = Math.max(pl.fx.pulse, e.k === 'dum' ? 0.9 : 0.55); }
      else if (e.who === 'demo') { const G = geo(pl); pl.fx.vib = { age: 0 }; pl.fx.pluckAt = { u: uOfC(G, e.c), v: 0, age: 0 }; sparks(pl, G, e.c, 5); }
    }
    // where we are
    const bar = pl.bars.find((b) => pl.t >= b.t0 && pl.t < b.t1);
    pl.listening = !!bar && bar.kind === 'listen';
    pl.counting = pl.cw.some((c) => pl.t >= c.t0 && pl.t < c.t1);
    // the ghost finger and its caption
    const list = pl.mode === 'auto' || pl.listening ? pl.dm : pl.fx.hint > 0 ? pl.notes : null;
    pl.ghost = list ? fingerAt(list, pl.t) : null;
    if (pl.ghost && list) {
      const g = pl.ghost, e = g.next && g.next.t - pl.t < 0.4 ? g.next : g.note, k = list.indexOf(e);
      if (k !== pl.capIdx) { pl.capIdx = k; pl.caption = captionFor(pl.piece, e, k > 0 ? list[k - 1] : null); }
    }
    // slides: watch the landing
    for (const n of pl.slides) {
      if (n.sl.done) continue;
      const tl = n.t + n.dur;
      if (pl.t >= tl - SLIDE_GRACE) { const f = pl.fingers[n.sl.fid]; if (f && f.down) n.sl.best = Math.min(n.sl.best, Math.abs(f.c - n.to)); }
      if (pl.t >= tl + SLIDE_GRACE) judgeSlide(pl, n);
    }
    pl.slides = pl.slides.filter((n) => !n.sl.done);
    // notes nobody played
    const w = win().o + state.prefs.cal / 1000;
    while (pl.np < pl.notes.length) {
      const n = pl.notes[pl.np];
      if (n.j) { pl.np += 1; continue; }
      if (n.t + w < pl.t) { missNote(pl, n); pl.np += 1; } else break;
    }
    stepFx(pl, dt);
    // chunk logic: what happens when a call-and-response pair, a whole piece or the final take is over
    const c = pl.cur;
    if (pl.mode !== 'auto' && c && !c.done && !c.cancel && pl.t >= c.t1 + 0.35) {
      c.done = true;
      const acc = c.n ? c.sum / c.n : 1;
      if (pl.mode === 'perform' || c.kind === 'final') { finishRun(); return; }
      const L2 = pl.learn;
      L2.tries[c.phrase] = c.attempt;
      if (acc < LEARN.pass && L2.attempt < LEARN.tries) { L2.attempt += 1; pl.fx.banner = { text: 'ONCE MORE', t: 0 }; }
      else { L2.acc[c.phrase] = acc; L2.phrase += 1; L2.attempt = 1; if (L2.phrase >= 4) L2.final = true; pl.fx.banner = { text: acc >= 0.75 ? 'NICE' : 'ON TO THE NEXT', t: 0 }; }
      pl.endT = Math.max(pl.endT, pl.t) + beatOf(pl);
      learnStep(pl, false);
    }
  }

  function finishRun() {
    const pl = state.pl;
    const fc = pl.chunks.find((c) => c.kind === 'final' || c.kind === 'whole');
    const acc = fc && fc.n ? fc.sum / fc.n : 0;
    const stars = accuracyToStars(acc);
    const id = pl.piece.id, old = state.best[id] ?? {};
    const res = { piece: pl.pi, mode: pl.mode, score: pl.score, acc, stars, grade: gradeOf(acc), maxCombo: pl.maxCombo, counts: { ...pl.counts }, newBest: false, pitchN: pl.pitchN, meanCents: pl.pitchN ? pl.pitchSum / pl.pitchN : 0 };
    res.newBest = !old.score || pl.score > old.score;
    state.best[id] = { ...old, score: Math.max(old.score || 0, Math.round(pl.score)), acc: Math.max(old.acc || 0, acc), stars: Math.max(old.stars || 0, stars), combo: Math.max(old.combo || 0, pl.maxCombo) };
    storage.set('best', state.best);
    env.monetization.track?.('piece_end', { piece: id, mode: pl.mode, stars });
    R.flush(); R.drone(false); pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  function pauseItems(pl) {
    return pl.over ? ['again', 'next', 'exit'] : pl.mode === 'learn' && !pl.learn.final ? ['resume', 'listen', 'restart', 'quit'] : pl.mode === 'auto' ? ['resume', 'speed', 'next', 'quit'] : ['resume', 'restart', 'quit'];
  }
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems(pl);
    const M = menuRects(lay(), items.length);
    if (input.keys.pressed.has('Escape') && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart' || it === 'again') startPlay(pl.mode);
      else if (it === 'listen') { resumePlay(); listenAgain(); }
      else if (it === 'speed') { state.prefs.autoSlow = !state.prefs.autoSlow; savePrefs(); startPlay('auto'); }
      else if (it === 'next') { state.sel = (state.sel + 1) % PIECES.length; startPlay('auto'); }
      else go('songs');
    });
  }

  // ---- free play and taqsim -----------------------------------------------------------------------------------------------------------------
  function startFree() {
    if (config.demo && state.demoRuns >= DEMO_RUNS) { go('demo-limit'); return; }
    if (config.demo) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush(); R.drone(false);
    state.free = { t: 0, maqam: 'rast', iqa: 'maqsum', tonic: TONIC.rast, drone: false, rhythm: false, bpm: 84, journey: true, stage: 0, fingers: {}, fid: null, ghost: null, ans: null, q: [], nextT: 0, slot: 0, fx: newFx(), marks: true, labels: true, resync: true, hits: 0, span: 1250 };
    state.scene = 'free'; state.sceneT = 0;
  }
  function freePluck(c) {
    const f = state.free; f.hits += 1;
    if (!f.journey || f.stage >= JOURNEY.length) return;
    const M = MAQAMAT[f.maqam];
    if (JOURNEY[f.stage].degs.some((d) => Math.abs(c - M.deg[d]) <= 45)) {
      f.stage += 1;
      if (f.stage >= JOURNEY.length) {
        f.fx.banner = { text: 'TAQSIM COMPLETE', t: 0 };
        f.ans = [4, 3, 2, 1, 0].map((d, i) => ({ t: f.t + 0.7 + i * 0.42, c: M.deg[d], deg: d }));
        for (const n of f.ans) f.q.push({ t: n.t, c: n.c, ans: true, snd: false });
      } else f.fx.banner = { text: `STEP ${f.stage + 1}`, t: 0 };
    }
  }
  function freeAction(id) {
    const f = state.free;
    if (id === 'exit') { go('title'); return; }
    if (id === 'maqam') { f.maqam = MAQ_ORDER[(MAQ_ORDER.indexOf(f.maqam) + 1) % MAQ_ORDER.length]; f.tonic = TONIC[f.maqam]; f.stage = 0; f.ans = null; if (f.drone) R.drone(true, f.tonic); }
    else if (id === 'journey') { f.journey = !f.journey; f.stage = 0; f.ans = null; }
    else if (id === 'drone') { f.drone = !f.drone; R.drone(f.drone && state.prefs.sound, f.tonic); }
    else if (id === 'rhythm') { f.rhythm = !f.rhythm; f.nextT = f.t + 0.2; f.slot = 0; f.q = f.q.filter((e) => e.ans); R.flush(); f.resync = true; if (f.drone) R.drone(true, f.tonic); }
    else if (id === 'tdec') f.bpm = Math.max(50, f.bpm - 6);
    else if (id === 'tinc') f.bpm = Math.min(150, f.bpm + 6);
  }
  function updateFree(dt, tap, input) {
    const f = state.free, F = lay().free;
    if (tap) {
      for (const id of ['exit', 'maqam', 'journey', 'drone', 'rhythm', 'tdec', 'tinc']) {
        if (inRect(F[id], tap.x, tap.y)) { freeAction(id); if (state.scene !== 'free') return; tap = null; break; }
      }
    }
    if (!R.available) {
      const p = input.pointer;
      if (p.pressed && tap) pointerDown(-1, p.x, p.y, NaN);
      else if (p.down && f.fingers[-1]) pointerMove(-1, p.x, p.y);
      if (p.released) pointerUp(-1);
    }
    for (let i = 0; i < 8; i++) if (input.keys.pressed.has(KEYS[i])) keyPluck(f, i);
    if (input.keys.pressed.has('Escape')) { go('title'); return; }
    f.t += dt;
    if (R.available) { R.sync(f.t, f.resync); f.resync = false; }
    if (f.rhythm) {
      const sd = 30 / f.bpm, iq = IQA[f.iqa].slots;
      while (f.nextT <= f.t + LOOKAHEAD) {
        const ch = iq[f.slot % 8], k = ch === 'D' ? 'dum' : ch === 'T' ? 'tak' : null;
        if (k) f.q.push({ t: f.nextT, k, snd: false }); else if (f.slot % 2) f.q.push({ t: f.nextT, k: 'sak', snd: false, ghost: true });
        f.nextT += sd; f.slot += 1;
      }
    }
    for (let i = f.q.length - 1; i >= 0; i--) {
      const e = f.q[i];
      if (!e.snd && e.t - LOOKAHEAD <= f.t) { e.snd = true; if (state.prefs.sound) { if (e.ans) R.play(e.c, f.tonic, 0.75, e.t); else R.drum(e.k, e.k === 'dum' ? 0.7 : 0.55, e.t); } }
      if (e.t <= f.t) {
        if (e.ans) { f.fx.vib = { age: 0 }; f.fx.pluckAt = { u: uOfC(geo(f), e.c), v: 0, age: 0 }; } else if (!e.ghost) f.fx.pulse = e.k === 'dum' ? 0.9 : 0.5;
        f.q.splice(i, 1);
      }
    }
    f.ghost = f.ans && f.t < f.ans[f.ans.length - 1].t + 0.9 ? fingerAt(f.ans, f.t) : null;
    stepFx(f, dt);
  }

  // ---- menus and documents ------------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'backing') p.backing = !p.backing;
    else if (id === 'haptics') p.haptics = !p.haptics;
    else if (id === 'window') p.windowIdx = cyc(p.windowIdx, PITCH_WINDOW.length);
    else if (id === 'assist') p.assistIdx = cyc(p.assistIdx, ASSIST.length);
    else if (id === 'timing') p.timingIdx = cyc(p.timingIdx, TIMING.length);
    else if (id === 'marks') p.marks = !p.marks;
    else if (id === 'labels') p.labels = !p.labels;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'calDec') p.cal = Math.max(-100, p.cal - 5);
    else if (id === 'calInc') p.cal = Math.min(400, p.cal + 5);
    else if (id === 'thinkDec') p.thinkSec = Math.max(2, p.thinkSec - 1);
    else if (id === 'thinkInc') p.thinkSec = Math.min(10, p.thinkSec + 1);
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'calibrate') { startCalib(); return; }
    savePrefs();
  }
  // ---- latency calibration: tap along to a steady click; the median of the tap errors becomes the offset -----------------------------------
  const CAL_BEAT = 0.75, CAL_TAPS = 8;
  function startCalib() {
    R.flush(); state.cal = { t: 0, nextT: 0.8, taps: [], errs: [], result: null, flash: 0, ev: [], resync: true }; state.backTo = 'settings'; go('calib');
  }
  function calibTap(audioTime) {
    const c = state.cal; if (!c || c.result !== null) return;
    const ts = songAt(audioTime, c.t), k = Math.round((ts - 0.8) / CAL_BEAT), err = ts - (0.8 + k * CAL_BEAT);
    if (k < 1) return;                                        // ignore taps before the first click was heard
    c.errs.push(err); c.flash = 1;
    if (c.errs.length >= CAL_TAPS) {
      const a = [...c.errs].sort((x, y) => x - y), med = a[a.length >> 1], keep = a.filter((e) => Math.abs(e - med) < 0.09);
      const mean = keep.reduce((s, e) => s + e, 0) / Math.max(1, keep.length);
      c.result = { ms: clamp(Math.round(mean * 1000 / 5) * 5, -100, 400), spread: Math.round((Math.max(...keep) - Math.min(...keep)) * 1000), used: keep.length };
      state.prefs.cal = c.result.ms; savePrefs();
    }
  }
  function updateCalib(dt, tap) {
    const c = state.cal, C = lay().calib;
    if (tap) {
      if (inRect(C.back, tap.x, tap.y) || (c.result && inRect(C.done, tap.x, tap.y))) { R.flush(); go('settings'); state.docKey = 'settings'; return; }
      if (inRect(C.retry, tap.x, tap.y)) { startCalib(); return; }
      if (!R.available && !inRect(C.pad, tap.x, tap.y)) return;
      if (!R.available) calibTap(NaN);
    }
    c.t += dt; if (R.available) { R.sync(c.t, c.resync); c.resync = false; }
    while (c.nextT <= c.t + LOOKAHEAD && c.result === null) { if (state.prefs.sound) R.click(false, c.nextT); c.ev.push(c.nextT); c.nextT += CAL_BEAT; }
    c.flash = Math.max(0, c.flash - dt * 4);
    if (c.result !== null && c.ev.length) c.ev.length = 0;
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

  // ---- the object the kit and main.js see ----------------------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'songs') updateSongs(tap);
      else if (sc === 'piece') updatePiece(tap);
      else if (sc === 'play') updatePlay(dt, tap, input);
      else if (sc === 'free') updateFree(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'calib') updateCalib(dt, tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height);
      // keep the kit's preview pill out of the way of the controls: bottom left corner
      const k = view?.cssPerUnit || meta.cssPerUnit || 0.5, ph = Math.max(16, 11.5 / k) * 1.7;
      meta.previewBadge = { x: L.S.x + 16, y: L.S.y + L.S.h - ph - 10, align: 'left' };
      render(ctx, state, L, view, meta, pauseItems);
    },
    getState: () => state,
    // Multi-touch from main.js (the kit input only has one pointer). pointerDown returns true when the game used the touch.
    pointerDown, pointerMove, pointerUp,
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except real play is free: menus, Rules, Watch and Learn, results, pause.
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
        else if (sc === 'free') { startFree(); if (o.maqam) { state.free.maqam = o.maqam; state.free.tonic = TONIC[o.maqam]; } if (o.drone) state.free.drone = true; }
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'calib') startCalib();
        else if (sc === 'result') {
          startPlay('perform'); const pl = state.pl; pl.score = 12345; pl.maxCombo = 41; pl.counts = { perfect: 58, great: 21, good: 9, off: 4, miss: 3 }; pl.pitchN = 90; pl.pitchSum = 90 * 9; pl.chunks[0].sum = 80; pl.chunks[0].n = 95; finishRun();
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) {
            const pl = state.pl;
            if (pl && state.scene === 'play' && o.play && !pl.paused && pl.mode !== 'auto') {            // dev play-through: pluck every note on time, a touch off
              const n = pl.notes[pl.np];
              if (n && !n.j && n.t <= pl.t + 0.01) pluckCore(pl, geo(pl), n.c + (((pl.np * 7) % 11) - 5) * 3, pl.t, null);
            }
            api.update(1 / 60, idle);
          }
        }
        if (o.hold && state.pl) { const pl = state.pl; const n = pl.notes[pl.np] ?? pl.notes[pl.notes.length - 1]; if (n) { pl.fingers[7] = { id: 7, c: n.c + 10, down: true, voice: 0 }; pl.fid = 7; } }
      },
    },
  };
  return api;
}
