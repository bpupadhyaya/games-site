// Krar Lyre: state and flow. Drawing is in view.js / playview.js / docview.js; the music and the rule constants are in music.js.
//
// Timing model: song time `pl.t` is the sum of the dt values handed to update() (deterministic, pausable). When the browser gives us an
// audio engine (env.rhythm, see web/audio/engine.js) accompaniment sounds are scheduled on the audio clock a little ahead of pl.t, and a
// player's touch is time-stamped on the audio clock and converted back to song time before it is judged. Headless runs have no engine:
// the same code runs with touches taken at the tick time.
//
// Gestures: a PLUCK is a tap on a string, a STRUM is a finger swept across four strings, a DAMP is a palm laid on the bowl. Notes are one
// flat list per session (pl.notes); each is { t, k, kind: 'p' | 's' | 'd', ks, soft, j (grade), err }.
import { PIECES, DUEL_PIECE, DUEL, QENETS, JUDGE, STRUM_WIDEN, TIMING, SPEEDS, SCORE, WEIGHT, ENSEMBLE, LEARN, LOOKAHEAD, STRING_COUNT, STRUM_GAP, buildRun, makeCall, accuracyToStars, gradeOf, comboMult, barDur, stepDur } from './music.js';
import { layoutFor, lyreXAt, stringHit, bowlHit, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { burst, stepParticles, CUE } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const NO_RHYTHM = { available: false, play() {}, sync() {}, flush() {}, toSong: () => NaN, setMuted() {}, setMode() {}, now: () => 0, haptic() {} };
const DEMO_RUNS = 6;
const KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH'];
const DAMP_KEYS = ['KeyZ', 'KeyX', 'ArrowDown'];
const STRUM_KEY = 'KeyW';
const GRADE_TEXT = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };
const GRADE_COL = { perfect: '#ffe07a', great: '#a8f0d4', good: '#9fc4ff', miss: '#ff8a8a' };
const SOUNDS = 12;
const newSv = () => Array.from({ length: SOUNDS }, () => ({ amp: 0, fireT: -9, teach: false }));
const GROOVE12 = { drum: 'm..t..t..t..', bass: '0..0..0..0..' };

export function createGame(env) {
  const { rng, storage, config } = env;
  const R = env.rhythm ?? NO_RHYTHM;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, pick: 'play', backTo: 'title',
    prefs: { sound: true, speedIdx: 1, timingIdx: 1, labels: true, click: true, haptics: true, calm: false, textIdx: 0, cal: 0, autoSlow: false },
    best: {}, demoRuns: 0, pl: null, free: null, cal: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true, owned: false, restoreBusy: false, restoreMsg: '',
  };
  let lastScene = state.scene, drag = null;

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = Math.min(Math.max(state.prefs.textIdx | 0, 0), TEXT_SCALES.length - 1); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const mon = env.monetization;
  const syncOwned = () => { state.owned = !!(mon && mon.owns && mon.owns('unlock_game')); };
  syncOwned(); mon?.onChange?.(syncOwned);
  function restorePurchase() {
    if (state.restoreBusy || state.owned || state.demo || !mon?.restore) return;
    state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
    Promise.resolve().then(() => mon.restore()).then(() => {
      syncOwned(); state.restoreMsg = state.owned ? 'Purchase restored. Thank you!' : 'Nothing to restore on this store account.';
    }).catch(() => { state.restoreMsg = 'Store not reachable. Try again later.'; }).finally(() => { state.restoreBusy = false; });
  }
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { R.setMuted(!state.prefs.sound); env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const pStage = () => { const P = lay().play; return state.pl && state.pl.mode === 'auto' ? P.stageCap : P.stage; };
  const tk = () => TIMING[state.prefs.timingIdx].k;
  const win = (pl) => (pl && pl.mode === 'duel' ? { p: 0.09, g: 0.14, o: DUEL.window } : { p: JUDGE.perfect * tk(), g: JUDGE.great * tk(), o: JUDGE.good * tk() });
  const go = (scene) => { if (state.scene === 'play' || state.scene === 'free' || state.scene === 'calib') R.flush(); state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  const songAt = (audioTime, fallback) => { const s = R.available ? R.toSong(audioTime) : NaN; return Number.isFinite(s) ? s : fallback; };
  const vel = (e) => (e.soft ? 0.5 : 0.88);

  // ---- a play session -------------------------------------------------------------------------------------------------------------------
  function newPlay(piece, mode, pieceIdx) {
    return {
      mode, pi: pieceIdx, piece, t: 0, ev: [], notes: [], np: 0, si: 0, fi: 0, endT: 0.5, bars: [], chunks: [], cur: null,
      speed: mode === 'auto' && state.prefs.autoSlow ? 0.75 : 1,
      ens: mode === 'perform' ? ENSEMBLE.start : mode === 'auto' ? ENSEMBLE.max : 0, streak: 0, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 }, accSum: 0, accN: 0,
      paused: false, over: false, resync: true, strays: 0,
      learn: mode === 'learn' ? { phrase: 0, attempt: 1, final: false, acc: [], tries: [] } : null,
      duel: mode === 'duel' ? { round: 1, lives: DUEL.lives, calls: [], hints: 0, best: 0, history: [], score: 0 } : null,
      sv: newSv(), pops: [], parts: [], pulse: 0, banner: null, shake: 0, layerFlash: 0, glow: 0, damp: 0, down: {}, strumTouch: {},
    };
  }
  function append(pl, segments, extra = {}) {
    const run = buildRun(pl.piece, segments, pl.endT, { click: state.prefs.click && (pl.mode === 'learn'), speed: pl.speed });
    const id = pl.chunks.length, chunk = { id, t0: run.T0, t1: run.end, sum: 0, n: 0, done: false, ...extra };
    for (const e of run.events) {
      e.ch = id;
      pl.ev.push(e);
      if (e.who === 'note') { pl.notes.push(e); chunk.n += 1; }
    }
    pl.bars.push(...run.bars);
    pl.chunks.push(chunk); pl.cur = chunk; pl.endT = run.end;
    return chunk;
  }
  const beatOf = (pl) => barDur(pl.piece, pl.speed) / 4;
  function learnStep(pl) {
    const L = pl.learn, b0 = L.phrase * 2;
    if (L.final) { pl.ens = ENSEMBLE.start; pl.streak = 0; }
    if (L.final) return append(pl, [{ kind: 'count' }, { kind: 'play', b0: 0, b1: 8 }], { kind: 'final' });
    return append(pl, [{ kind: 'count' }, { kind: 'listen', b0, b1: b0 + 2 }, { kind: 'echo', b0, b1: b0 + 2 }], { kind: 'pair', phrase: L.phrase, attempt: L.attempt });
  }
  function duelStep(pl) {
    const D = pl.duel;
    if (!D.calls[D.round]) D.calls[D.round] = makeCall(rng, D.round);
    const pats = D.calls[D.round];
    return append(pl, [{ kind: 'count' }, { kind: 'listen', pats }, { kind: 'echo', pats }], { kind: 'duel', round: D.round, hints: 0 });
  }
  function startPlay(mode, idx = state.sel) {
    const demoBlocked = config.demo && mode !== 'auto' && (idx > 0 || state.demoRuns >= DEMO_RUNS);
    if (demoBlocked) { go('demo-limit'); return; }
    if (config.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush();
    const base = PIECES[idx];
    const piece = mode === 'duel' ? { ...DUEL_PIECE, id: base.id, name: base.name, qenet: base.qenet } : base;
    R.setMode(piece.qenet);
    state.sel = idx;
    const pl = newPlay(piece, mode, idx); state.pl = pl; state.result = null;
    if (mode === 'learn') learnStep(pl);
    else if (mode === 'duel') duelStep(pl);
    else if (mode === 'perform') append(pl, [{ kind: 'count' }, { kind: 'play', b0: 0, b1: piece.bars }], { kind: 'whole' });
    else append(pl, [{ kind: 'count' }, { kind: 'auto', b0: 0, b1: piece.bars }], { kind: 'whole' });
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('piece_start', { piece: base.id, mode });
  }
  function pausePlay() {
    const pl = state.pl; if (!pl || pl.paused || pl.over) return;
    pl.paused = true; R.flush();
    while (pl.si > 0 && pl.ev[pl.si - 1].t > pl.t) pl.si -= 1;      // what was scheduled but not yet heard will be scheduled again
    for (let i = pl.si; i < pl.ev.length; i++) if (pl.ev[i].t > pl.t) pl.ev[i].on = undefined;
  }
  function resumePlay() { const pl = state.pl; if (!pl) return; pl.paused = false; pl.resync = true; }
  // Drop everything still to come (used by Listen again).
  function truncateFuture(pl) {
    let k = pl.ev.length; while (k > 0 && pl.ev[k - 1].t > pl.t) k -= 1;
    pl.ev.length = k; pl.si = Math.min(pl.si, k); pl.fi = Math.min(pl.fi, k);
    pl.notes = pl.notes.filter((n) => n.t <= pl.t); pl.np = Math.min(pl.np, pl.notes.length);
    pl.bars = pl.bars.filter((b) => b.t0 <= pl.t); pl.endT = pl.t;
    R.flush(); pl.resync = true;
  }
  function listenAgain() {
    const pl = state.pl;
    if (!pl || pl.paused || pl.over) return;
    if (pl.mode === 'learn' && !pl.learn.final) {
      if (pl.cur) pl.cur.cancel = true;
      truncateFuture(pl); pl.endT = pl.t + beatOf(pl) * 1.5;
      learnStep(pl); say('Listen again', 1.4);
    } else if (pl.mode === 'duel') {
      const hints = pl.cur && pl.cur.kind === 'duel' ? pl.cur.hints + 1 : 1;
      if (pl.cur) pl.cur.cancel = true;
      truncateFuture(pl); pl.endT = pl.t + beatOf(pl) * 1.5;
      duelStep(pl); pl.cur.hints = hints; pl.duel.hints += 1; say('Listen again: this round scores less', 1.8);
    }
  }

  // ---- what a gesture looks and sounds like -------------------------------------------------------------------------------------------
  function strike(sess, k, soft, by, teach) {
    if (k < 0 || k >= SOUNDS) return;
    const sv = sess.sv[k];
    sv.amp = soft ? 0.55 : 1; sv.fireT = sess.t; sv.teach = !!teach;
    sess.glow = Math.min(1, (sess.glow || 0) + (soft ? 0.1 : 0.2));
    if (sess.parts && k >= 1 && k <= STRING_COUNT) { const G = state.scene === 'free' ? lay().free.stage : pStage(); if (!state.prefs.calm && (by === 'player' || teach)) burst(sess.parts, rng, lyreXAt(G, k - 1, G.pluckY), G.pluckY, soft ? 4 : 8, soft ? CUE.soft : CUE.p, 1); }
    if (by === 'player' && state.prefs.haptics) R.haptic?.(soft ? 5 : 9);
  }
  function dampFx(sess) {
    sess.damp = 1;
    for (const sv of sess.sv) sv.amp = Math.min(sv.amp, 0.15);
  }
  const pop = (sess, x, y, text, col, size) => {
    sess.pops = sess.pops.filter((q) => Math.abs(q.x - x) > 170 || Math.abs(q.y - y) > 60);
    sess.pops.push({ x: Math.max(70, Math.min(meta.width - 70, x)), y, text, col, size, age: 0 });
    if (sess.pops.length > 12) sess.pops.shift();
  };
  const cuePos = (n) => {
    const G = pStage();
    if (n.kind === 'd') return { x: G.cx, y: G.bowlCy };
    if (n.kind === 's') { const a = n.ks[0], b = n.ks[n.ks.length - 1]; return { x: (lyreXAt(G, a - 1, G.pluckY) + lyreXAt(G, b - 1, G.pluckY)) / 2, y: G.pluckY }; }
    return { x: lyreXAt(G, n.k - 1, G.pluckY), y: G.pluckY };
  };

  // ---- judging -----------------------------------------------------------------------------------------------------------------------------
  const wideKind = (n) => (n.kind === 'p' ? 1 : STRUM_WIDEN);
  function gradeFor(err, w, widen) {
    const e = Math.abs(err);
    return e <= w.p * widen ? 'perfect' : e <= w.g * widen ? 'great' : 'good';
  }
  function award(pl, n, g) {
    n.j = g;
    const mult = comboMult(pl.combo);
    pl.score += SCORE[g] * mult; pl.combo += 1; pl.maxCombo = Math.max(pl.maxCombo, pl.combo);
    pl.counts[g] += 1; pl.accSum += WEIGHT[g]; pl.accN += 1; pl.streak += 1;
    const ch = pl.chunks[n.ch]; if (ch) ch.sum += WEIGHT[g];
    if (pl.mode === 'perform' || (pl.learn && pl.learn.final)) {
      if (pl.streak % ENSEMBLE.every === 0 && pl.ens < ENSEMBLE.max) { pl.ens += 1; pl.layerFlash = 1; pl.banner = { text: 'MORE VOICES JOIN', t: 0 }; }
    }
    const p = cuePos(n);
    pop(pl, p.x, p.y - 12, GRADE_TEXT[g], GRADE_COL[g], g === 'perfect' ? 40 : 34);
  }
  function missNote(pl, n) {
    n.j = 'miss'; pl.counts.miss += 1; pl.accN += 1; pl.combo = 0; pl.streak = 0;
    if (pl.mode === 'perform' || (pl.learn && pl.learn.final)) pl.ens = Math.max(0, pl.ens - 1);
    const p = cuePos(n);
    pop(pl, p.x, p.y - 12, 'MISS', GRADE_COL.miss, 30);
  }
  function findPluck(pl, k, tAdj) {
    const w = win(pl).o; let best = null;
    for (let i = pl.np; i < pl.notes.length && pl.notes[i].t <= tAdj + w; i++) {
      const n = pl.notes[i]; if (n.j || n.kind !== 'p' || n.k !== k) continue;
      const e = Math.abs(n.t - tAdj); if (e <= w && (!best || e < Math.abs(best.t - tAdj))) best = n;
    }
    return best;
  }
  function findStrum(pl, k, tAdj) {
    const w = win(pl).o * STRUM_WIDEN; let best = null;
    for (let i = pl.np; i < pl.notes.length && pl.notes[i].t <= tAdj + w; i++) {
      const n = pl.notes[i]; if (n.j || n.kind !== 's' || !n.ks.includes(k)) continue;
      if (n.cross && n.cross.some((c) => c.k === k)) continue;
      const span = (n.ks.length - 1) * STRUM_GAP;
      if (tAdj < n.t - w || tAdj > n.t + span + w * 1.6) continue;
      if (!best || n.t < best.t) best = n;
    }
    return best;
  }
  function findDamp(pl, tAdj) {
    const w = win(pl).o * STRUM_WIDEN; let best = null;
    for (let i = pl.np; i < pl.notes.length && pl.notes[i].t <= tAdj + w; i++) {
      const n = pl.notes[i]; if (n.j || n.kind !== 'd') continue;
      const e = Math.abs(n.t - tAdj); if (e <= w && (!best || e < Math.abs(best.t - tAdj))) best = n;
    }
    return best;
  }
  // A strum is judged when all its strings are crossed, or when its time has run out.
  function resolveStrum(pl, n) {
    const need = Math.ceil(n.ks.length * 0.75), got = n.cross ? n.cross : [];
    const uniq = new Set(got.map((c) => c.k));
    if (uniq.size < need) { missNote(pl, n); return; }
    const first = Math.min(...got.map((c) => c.t)), w = win(pl);
    let g = gradeFor(first - n.t, w, STRUM_WIDEN);
    // direction: crossings in time order should follow the strum's own order
    const seq = got.slice().sort((a, b) => a.t - b.t || n.ks.indexOf(a.k) - n.ks.indexOf(b.k)).map((c) => n.ks.indexOf(c.k));
    let inOrder = 0; for (let i = 1; i < seq.length; i++) if (seq[i] >= seq[i - 1]) inOrder += 1;
    const ordered = seq.length < 2 || inOrder >= (seq.length - 1) * 0.75;
    if (!ordered && g !== 'good') g = 'good';
    if (uniq.size < n.ks.length && g === 'perfect') g = 'great';
    n.err = first - n.t;
    award(pl, n, g);
  }
  function playerPluck(sess, k, tSong, byDrag = false) {
    if (state.prefs.sound) R.play(k, 'P', byDrag ? 0.6 : 0.9, null);
    let note = null;
    if (sess === state.pl && sess.mode !== 'auto' && !sess.paused && !sess.over) {
      const tAdj = tSong - state.prefs.cal / 1000;
      const sn = findStrum(sess, k, tAdj);
      const pn = byDrag ? null : findPluck(sess, k, tAdj);
      if (pn && (!sn || Math.abs(pn.t - tAdj) <= Math.abs(sn.t - tAdj))) { pn.err = tAdj - pn.t; award(sess, pn, gradeFor(pn.err, win(sess), 1)); note = pn; }
      else if (sn) {
        (sn.cross = sn.cross || []).push({ k, t: tAdj });
        if (sn.cross.length >= sn.ks.length) resolveStrum(sess, sn);
        note = sn;
      } else if (!byDrag) sess.strays += 1;
    }
    strike(sess, k, byDrag || !!(note && note.soft), 'player', false);
    return note;
  }
  function playerDamp(sess, tSong) {
    if (state.prefs.sound) R.play(-2, 'D', 0.8, null);
    dampFx(sess);
    if (sess === state.pl && sess.mode !== 'auto' && !sess.paused && !sess.over) {
      const n = findDamp(sess, tSong - state.prefs.cal / 1000);
      if (n) { n.err = tSong - state.prefs.cal / 1000 - n.t; award(sess, n, gradeFor(n.err, win(sess), STRUM_WIDEN)); }
    }
  }

  // ---- per-tick play update -----------------------------------------------------------------------------------------------------------------
  function evOn(pl, e) {
    if (e.on !== undefined) return e.on;
    if (e.who === 'ens') return e.layer <= pl.ens;
    if (e.who === 'teach') return true;
    if (e.who === 'click') return !!e.cnt || (pl.mode === 'learn' && state.prefs.click);
    return false;
  }
  function stepAnim(sess, dt) {
    for (const sv of sess.sv) sv.amp = Math.max(0, sv.amp - dt * 1.7);
    for (const p of sess.pops) p.age += dt;
    sess.pops = sess.pops.filter((p) => p.age < 0.8);
    stepParticles(sess.parts, dt);
    sess.pulse = Math.max(0, sess.pulse - dt * 4); sess.layerFlash = Math.max(0, (sess.layerFlash || 0) - dt * 1.5);
    sess.glow = Math.max(0, (sess.glow || 0) - dt * 1.4); sess.damp = Math.max(0, (sess.damp || 0) - dt * 4);
    if (sess.banner) { sess.banner.t += dt; if (sess.banner.t > 1.6) sess.banner = null; }
  }
  const playKeys = (sess, input, tNow, handler) => {
    for (let i = 0; i < KEYS.length; i++) if (input.keys.pressed.has(KEYS[i])) handler.pluck(sess, i + 1, tNow);
    for (const dk of DAMP_KEYS) if (input.keys.pressed.has(dk)) { handler.damp(sess, tNow); break; }
  };
  function keyStrum(pl, tNow) {                                                      // keyboard: sweep the strum that is due now
    const w = win(pl).o * STRUM_WIDEN; let best = null;
    for (let i = pl.np; i < pl.notes.length && pl.notes[i].t <= tNow + w; i++) {
      const n = pl.notes[i]; if (n.j || n.kind !== 's') continue;
      if (!best || Math.abs(n.t - tNow) < Math.abs(best.t - tNow)) best = n;
    }
    if (best) for (const k of best.ks) playerPluck(pl, k, tNow, true);
  }
  function updatePlay(dt, tap, input) {
    const pl = state.pl, L = lay().play;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    if (pl.hold) { stepAnim(pl, 0); return; }
    if (tap) {
      if (inRect(L.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (pl.mode !== 'auto' && !(pl.mode === 'learn' && pl.learn.final) && inRect(L.hint, tap.x, tap.y)) { listenAgain(); return; }
      if (!R.available) {
        const k = stringHit(L.stage, tap.x, tap.y);
        if (k > 0) playerPluck(pl, k, pl.t); else if (bowlHit(L.stage, tap.x, tap.y)) playerDamp(pl, pl.t);
      }
    }
    playKeys(pl, input, pl.t, { pluck: (s, k, t) => playerPluck(s, k, t), damp: (s, t) => playerDamp(s, t) });
    if (input.keys.pressed.has(STRUM_KEY)) keyStrum(pl, pl.t);
    if (input.keys.pressed.has('Space') || input.keys.pressed.has('Escape')) { pausePlay(); return; }
    pl.t += dt;
    if (R.available) { R.sync(pl.t, pl.resync); pl.resync = false; }
    const horizon = pl.t + LOOKAHEAD;
    while (pl.si < pl.ev.length && pl.ev[pl.si].t <= horizon) {
      const e = pl.ev[pl.si++];
      if (e.on === undefined) e.on = evOn(pl, e);
      if (!e.on || !state.prefs.sound) continue;
      if (e.who === 'click') R.play(-1, e.accent ? 'accent' : 'beat', 0.8, e.t);
      else if (e.kind === 'd') R.play(-2, 'D', 0.8, e.t);
      else R.play(e.k, 'beat', e.who === 'ens' ? vel(e) * 0.8 : vel(e), e.t);
    }
    while (pl.fi < pl.ev.length && pl.ev[pl.fi].t <= pl.t) {
      const e = pl.ev[pl.fi++];
      if (e.on === undefined) e.on = evOn(pl, e);
      if (e.who === 'click') { if (e.on) pl.pulse = e.accent ? 1 : 0.6; continue; }
      if (e.who === 'note' || !e.on) continue;
      if (e.kind === 'd') dampFx(pl);
      else strike(pl, e.k, e.soft, 'ens', e.who === 'teach');
      if (pl.mode === 'auto' && e.who === 'teach' && !e.part) {
        pl.score += SCORE.perfect * comboMult(pl.combo); pl.combo += 1; pl.maxCombo = Math.max(pl.maxCombo, pl.combo); pl.counts.perfect += 1; pl.accN += 1; pl.accSum += 1;
      }
    }
    // gestures nobody made
    const w = win(pl).o * STRUM_WIDEN + state.prefs.cal / 1000;
    while (pl.np < pl.notes.length) {
      const n = pl.notes[pl.np];
      if (n.j) { pl.np += 1; continue; }
      const span = n.kind === 's' ? (n.ks.length - 1) * STRUM_GAP : 0;
      const limit = n.t + span + (n.kind === 'p' ? win(pl).o + state.prefs.cal / 1000 : w * 1.2);
      if (limit < pl.t) { if (n.kind === 's') resolveStrum(pl, n); else missNote(pl, n); pl.np += 1; } else break;
    }
    stepAnim(pl, dt);
    // what happens when a call-and-response pair, a whole piece or the final take is over
    const c = pl.cur;
    if (c && !c.done && !c.cancel && pl.t >= c.t1 + 0.25) {
      c.done = true;
      const acc = c.n ? c.sum / c.n : 1;
      if (pl.mode === 'auto') { pl.over = true; R.flush(); return; }
      if (pl.mode === 'perform' || c.kind === 'final') { finishRun(); return; }
      if (pl.mode === 'duel') { duelRoundDone(pl, c, acc); return; }
      const L2 = pl.learn;
      L2.tries[c.phrase] = c.attempt;
      if (acc < LEARN.pass && L2.attempt < LEARN.tries) { L2.attempt += 1; pl.banner = { text: 'ONCE MORE', t: 0 }; }
      else { L2.acc[c.phrase] = acc; L2.phrase += 1; L2.attempt = 1; if (L2.phrase >= 4) L2.final = true; pl.banner = { text: acc >= 0.75 ? 'NICE' : 'ON TO THE NEXT', t: 0 }; }
      pl.endT = Math.max(pl.endT, pl.t) + beatOf(pl);
      learnStep(pl);
    }
  }
  function duelRoundDone(pl, c, acc) {
    const D = pl.duel, adj = acc * Math.pow(DUEL.hintCost, c.hints || 0), pass = adj >= DUEL.pass;
    D.history.push({ round: D.round, acc: adj, pass, hints: c.hints || 0 });
    if (pass) {
      D.score += Math.round(100 * D.round * adj) ; D.best = Math.max(D.best, D.round);
      pl.banner = { text: adj >= 0.9 ? 'FLAWLESS' : 'ANSWERED', t: 0 };
      D.round += 1;
      if (D.round > DUEL.rounds) { finishDuel(true); return; }
    } else {
      D.lives -= 1; pl.banner = { text: D.lives > 0 ? 'NOT QUITE: AGAIN' : 'THE DUEL ENDS', t: 0 };
      if (D.lives <= 0) { finishDuel(false); return; }
    }
    pl.endT = Math.max(pl.endT, pl.t) + beatOf(pl) * 1.5;
    duelStep(pl);
  }
  function finishDuel(won) {
    const pl = state.pl, D = pl.duel;
    const stars = D.best >= DUEL.starRounds[2] ? 3 : D.best >= DUEL.starRounds[1] ? 2 : D.best >= DUEL.starRounds[0] ? 1 : 0;
    const id = pl.piece.id, old = state.best[id] ?? {};
    const hist = D.history, acc = hist.length ? hist.reduce((s, h) => s + h.acc, 0) / hist.length : 0;
    const res = { piece: pl.pi, mode: 'duel', score: D.score, acc, stars, grade: gradeOf(acc), maxCombo: pl.maxCombo, counts: { ...pl.counts }, rounds: D.best, won, lives: D.lives, newBest: !old.duelScore || D.score > old.duelScore };
    state.best[id] = { ...old, duelScore: Math.max(old.duelScore || 0, D.score), duelRounds: Math.max(old.duelRounds || 0, D.best), duelStars: Math.max(old.duelStars || 0, stars) };
    storage.set('best', state.best);
    env.monetization.track?.('piece_end', { piece: id, mode: 'duel', stars });
    R.flush(); pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }
  function finishRun() {
    const pl = state.pl;
    const fc = pl.chunks.find((c) => c.kind === 'final' || c.kind === 'whole');
    const acc = fc && fc.n ? fc.sum / fc.n : 0;
    const stars = accuracyToStars(acc);
    const id = pl.piece.id, old = state.best[id] ?? {};
    const res = { piece: pl.pi, mode: pl.mode, score: pl.score, acc, stars, grade: gradeOf(acc), maxCombo: pl.maxCombo, counts: { ...pl.counts }, learn: pl.learn ? { acc: [...pl.learn.acc], tries: [...pl.learn.tries] } : null, newBest: false };
    if (pl.mode === 'perform') {
      res.newBest = !old.score || pl.score > old.score;
      state.best[id] = { ...old, score: Math.max(old.score || 0, pl.score), acc: Math.max(old.acc || 0, acc), stars: Math.max(old.stars || 0, stars), combo: Math.max(old.combo || 0, pl.maxCombo) };
    } else state.best[id] = { ...old, learn: Math.max(old.learn || 0, stars) };
    storage.set('best', state.best);
    env.monetization.track?.('piece_end', { piece: id, mode: pl.mode, stars });
    R.flush(); pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  function pauseItems(pl) {
    return pl.over ? ['again', 'next', 'exit']
      : pl.mode === 'learn' && !pl.learn.final ? ['resume', 'listen', 'restart', 'quit']
        : pl.mode === 'duel' ? ['resume', 'listen', 'restart', 'quit']
          : pl.mode === 'auto' ? ['resume', 'speed', 'next', 'quit'] : ['resume', 'restart', 'quit'];
  }
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems(pl);
    const M = menuRects(lay(), items.length);
    if (input.keys.pressed.has('Escape') && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart' || it === 'again') startPlay(pl.mode, pl.pi);
      else if (it === 'listen') { resumePlay(); listenAgain(); }
      else if (it === 'speed') { state.prefs.autoSlow = !state.prefs.autoSlow; savePrefs(); startPlay('auto', pl.pi); }
      else if (it === 'next') { state.sel = (state.sel + 1) % PIECES.length; startPlay('auto', state.sel); }
      else go('piece');
    });
  }

  // ---- compose (free play): a playable lyre and a two-bar loop of 12 steps ----------------------------------------------------------
  const STEPS = 12, LOOP = 24;
  function startFree() {
    if (config.demo && state.demoRuns >= DEMO_RUNS) { go('demo-limit'); return; }
    if (config.demo) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush();
    const cells = new Array(LOOP).fill(0);
    const seed = ['1', '', '3', '', '5', '', '3', '', '', '', '2', ''];     // a gentle starting phrase on bar 1 so the grid is never blank
    seed.forEach((s, i) => { if (s) cells[i] |= 1 << (+s - 1); });
    state.free = { t: 0, qi: 0, bpm: 84, page: 0, cells, playing: false, groove: true, pos: 0, nextStep: 0, nextT: 0, q: [], sv: newSv(), pops: [], parts: [], pulse: 0, glow: 0, damp: 0, banner: null, layerFlash: 0, hits: 0, down: {}, flash: -1, answered: 0, resync: true };
    R.setMode(0);
    storage.get('composeSong', null).then((v) => { if (v && state.free && Array.isArray(v.cells) && v.cells.length === LOOP) { state.free.cells = v.cells.slice(); state.free.qi = Math.min(QENETS.length - 1, v.qi | 0); state.free.bpm = Math.max(50, Math.min(150, v.bpm | 0 || 84)); R.setMode(state.free.qi); } });
    state.scene = 'free'; state.sceneT = 0;
  }
  const saveSong = () => { const f = state.free; storage.set('composeSong', { cells: f.cells, qi: f.qi, bpm: f.bpm }); };
  const stepLen = (f) => 60 / f.bpm / 3;
  function freePluck(k, soft = false) {
    const f = state.free;
    if (state.prefs.sound) R.play(k, 'P', soft ? 0.55 : 0.9, null);
    strike(f, k, soft, 'player', false);
    f.hits += 1;
  }
  function freeDamp() { const f = state.free; if (state.prefs.sound) R.play(-2, 'D', 0.8, null); dampFx(f); }
  function azmariAnswers() {
    const f = state.free, from = f.page, to = 1 - f.page, out = new Array(STEPS).fill(0);
    let any = false;
    for (let s = 0; s < STEPS; s++) {
      const m = f.cells[from * STEPS + s]; if (!m) continue;
      any = true;
      const shift = rng.chance(0.5) ? 1 : -1;
      let nm = 0;
      for (let k = 1; k <= STRING_COUNT; k++) if (m & (1 << (k - 1))) { let nk = k + (rng.chance(0.7) ? shift : 0); if (nk < 1) nk = 2; if (nk > STRING_COUNT) nk = STRING_COUNT - 1; nm |= 1 << (nk - 1); }
      if (rng.chance(0.82)) out[s] = nm;
    }
    if (!any) { say('Play something first, then the azmari answers'); return; }
    let last = STEPS - 1; while (last > 0 && !out[last]) last -= 1;
    out[Math.min(STEPS - 1, last + 1 > STEPS - 1 ? last : last + 1)] |= 1 << (rng.int(3) * 2);        // a small flourish at the end of the answer
    for (let s = 0; s < STEPS; s++) f.cells[to * STEPS + s] = out[s];
    f.page = to; f.answered += 1; saveSong();
    say('The azmari answered on bar ' + (to + 1));
  }
  function updateFree(dt, tap, input) {
    const f = state.free, F = lay().free;
    if (f.hold) return;
    if (tap) {
      if (inRect(F.exit, tap.x, tap.y)) { saveSong(); go('title'); state.free = null; return; }
      const c = F.ctrl;
      if (inRect(c[0], tap.x, tap.y)) { f.playing = !f.playing; f.nextStep = 0; f.nextT = f.t + 0.1; f.pos = 0; f.q = []; R.flush(); f.resync = true; }
      else if (inRect(c[1], tap.x, tap.y)) { f.bpm = Math.max(50, f.bpm - 5); saveSong(); }
      else if (inRect(c[2], tap.x, tap.y)) { f.bpm = Math.min(150, f.bpm + 5); saveSong(); }
      else if (inRect(c[3], tap.x, tap.y)) f.page = 1 - f.page;
      else if (inRect(c[4], tap.x, tap.y)) { f.qi = (f.qi + 1) % QENETS.length; R.setMode(f.qi); say(QENETS[f.qi].name + ': ' + QENETS[f.qi].mood); saveSong(); }
      else if (inRect(c[5], tap.x, tap.y)) f.groove = !f.groove;
      else if (inRect(c[6], tap.x, tap.y)) azmariAnswers();
      else if (inRect(c[7], tap.x, tap.y)) { f.cells.fill(0); saveSong(); }
      else if (inRect(F.grid, tap.x, tap.y)) {
        const col = Math.floor((tap.x - F.grid.x) / (F.grid.w / STEPS)), row = Math.floor((tap.y - F.grid.y) / (F.grid.h / STRING_COUNT));
        if (col >= 0 && col < STEPS && row >= 0 && row < STRING_COUNT) {
          const k = STRING_COUNT - row, idx = f.page * STEPS + col;      // the top row is the highest string, as on the lyre
          f.cells[idx] ^= 1 << (k - 1); if (f.cells[idx] & (1 << (k - 1))) freePluck(k, true);
          saveSong();
        }
      } else if (!R.available) {
        const k = stringHit(lay().free.stage, tap.x, tap.y);
        if (k > 0) freePluck(k); else if (bowlHit(lay().free.stage, tap.x, tap.y)) freeDamp();
      }
    }
    for (let i = 0; i < KEYS.length; i++) if (input.keys.pressed.has(KEYS[i])) freePluck(i + 1);
    for (const dk of DAMP_KEYS) if (input.keys.pressed.has(dk)) { freeDamp(); break; }
    if (input.keys.pressed.has('Escape')) { saveSong(); go('title'); state.free = null; return; }
    if (input.keys.pressed.has('Space')) { f.playing = !f.playing; f.nextStep = 0; f.nextT = f.t + 0.1; f.pos = 0; f.q = []; R.flush(); f.resync = true; }
    f.t += dt;
    if (R.available) { R.sync(f.t, f.resync); f.resync = false; }
    if (f.playing) {
      const sl = stepLen(f);
      while (f.nextT <= f.t + LOOKAHEAD) {
        const s = f.nextStep % LOOP, inBar = s % STEPS, m = f.cells[s];
        for (let k = 1; k <= STRING_COUNT; k++) if (m & (1 << (k - 1))) f.q.push({ t: f.nextT, k, vel: 0.85, snd: false, vis: true });
        if (f.groove) {
          const dc = GROOVE12.drum[inBar], bc = GROOVE12.bass[inBar];
          if (dc === 't') f.q.push({ t: f.nextT, k: 10, vel: 0.7, snd: false, vis: false });
          if (dc === 'm') f.q.push({ t: f.nextT, k: 11, vel: 0.8, snd: false, vis: false });
          if (bc === '0') f.q.push({ t: f.nextT, k: 0, vel: 0.7, snd: false, vis: false });
        }
        f.q.push({ t: f.nextT, k: -3, step: s, snd: true, vis: true });      // marker for the playhead
        f.nextT += sl; f.nextStep += 1;
      }
    }
    for (let i = f.q.length - 1; i >= 0; i--) {
      const e = f.q[i];
      if (!e.snd && e.t - LOOKAHEAD <= f.t) { e.snd = true; if (state.prefs.sound) R.play(e.k, 'beat', e.vel, e.t); }
      if (e.t <= f.t) {
        if (e.k === -3) { f.pos = e.step; if (e.step % 3 === 0) f.pulse = e.step % STEPS === 0 ? 1 : 0.5; }
        else if (e.vis) strike(f, e.k, true, 'ens', true);
        f.q.splice(i, 1);
      }
    }
    stepAnim(f, dt);
  }

  // ---- calibration -------------------------------------------------------------------------------------------------------------------------------------
  function startCal() {
    R.flush();
    state.cal = { t: 0, T0: 1.8, n: 12, bpm: 90, taps: [], next: 0, pulse: 0, flash: 0, phase: 'run', result: null, resync: true, lastBeat: -1 };
    state.scene = 'calib'; state.sceneT = 0;
  }
  const calBeat = (c, i) => c.T0 + i * 60 / c.bpm;
  function calTap(tSong) {
    const c = state.cal; if (!c || c.phase !== 'run') return;
    if (state.prefs.sound) R.play(3, 'P', 0.8, null);
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
      } else if (!R.available) calTap(c.t);
    }
    if (input.keys.pressed.has('Space')) calTap(c.t);
    c.t += dt;
    if (R.available) { R.sync(c.t, c.resync); c.resync = false; }
    while (c.next < c.n && calBeat(c, c.next) - LOOKAHEAD <= c.t) { if (state.prefs.sound) R.play(-1, c.next % 4 === 0 ? 'accent' : 'beat', 0.8, calBeat(c, c.next)); c.next += 1; }
    c.flash = Math.max(0, c.flash - dt * 5);
    const bi = Math.floor((c.t - c.T0) * c.bpm / 60);
    if (c.t >= c.T0 && bi >= 0 && bi !== c.lastBeat && bi < c.n) { c.lastBeat = bi; c.pulse = 1; }
    c.pulse = Math.max(0, c.pulse - dt * 3);
    if (c.phase === 'run' && c.t > calBeat(c, c.n - 1) + 0.6) calFinish(c);
  }

  // ---- menus and documents ------------------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'speed') p.speedIdx = cyc(p.speedIdx, SPEEDS.length);
    else if (id === 'timing') p.timingIdx = cyc(p.timingIdx, TIMING.length);
    else if (id === 'labels') p.labels = !p.labels;
    else if (id === 'click') p.click = !p.click;
    else if (id === 'haptics') p.haptics = !p.haptics;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'calDec') p.cal = Math.max(-100, p.cal - 5);
    else if (id === 'calInc') p.cal = Math.min(400, p.cal + 5);
    else if (id === 'calibrate') { startCal(); return; }
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') { restorePurchase(); return; }
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
    if (hit(T.play)) { state.pick = 'play'; go('songs'); }
    else if (hit(T.duel)) { state.pick = 'duel'; go('songs'); }
    else if (hit(T.free)) startFree();
    else if (hit(T.auto)) { state.sel = 5; startPlay('auto', 5); }
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
    G.cards.forEach((r, i) => { if (inRect(r, tap.x, tap.y)) { state.sel = i; if (state.pick === 'duel') startPlay('duel', i); else go('piece'); } });
  }
  function updatePiece(tap) {
    if (!tap) return;
    const D = lay().piece;
    if (inRect(D.back, tap.x, tap.y)) go('songs');
    else if (inRect(D.learn, tap.x, tap.y)) startPlay('learn');
    else if (inRect(D.perform, tap.x, tap.y)) startPlay('perform');
    else if (inRect(D.duel, tap.x, tap.y)) startPlay('duel');
    else if (inRect(D.watch, tap.x, tap.y)) startPlay('auto');
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay(state.result.mode, state.result.piece);
    else if (inRect(Rr.songs, tap.x, tap.y)) { state.pick = 'play'; go('songs'); }
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see ----------------------------------------------------------------------------------------------------------
  const sessionFor = () => (state.scene === 'free' ? state.free : state.pl);
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
      else if (sc === 'calib') updateCal(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
    // Multi-touch from main.js (the kit input only has one pointer). Returns true when the game used the touch.
    touch(x, y, audioTime, pointerId = 0) {
      const sc = state.scene;
      if (sc === 'play') {
        const pl = state.pl, L = lay().play;
        if (!pl || pl.paused || pl.over) return false;
        if (inRect(L.pause, x, y) || inRect(L.hint, x, y)) return false;
        const k = stringHit(L.stage, x, y), t = songAt(audioTime, pl.t);
        if (k > 0) { pl.down[pointerId] = k; playerPluck(pl, k, t); return true; }
        if (bowlHit(L.stage, x, y)) { playerDamp(pl, t); return true; }
        return false;
      }
      if (sc === 'free') {
        const F = lay().free, f = state.free;
        for (const r of [F.exit, ...F.ctrl, F.grid]) if (inRect(r, x, y)) return false;
        const k = stringHit(F.stage, x, y);
        if (k > 0) { f.down[pointerId] = k; freePluck(k); return true; }
        if (bowlHit(F.stage, x, y)) { freeDamp(); return true; }
        return false;
      }
      if (sc === 'calib') {
        const c = state.cal, C = lay().calib;
        if (!c) return false;
        for (const r of [C.back, C.use, C.retry]) if (inRect(r, x, y)) return false;
        calTap(songAt(audioTime, c.t));
        return true;
      }
      return false;
    },
    // A finger sliding across the strings: every string crossed sounds (a strum), and counts toward a strum cue.
    drag(x, y, audioTime, pointerId = 0) {
      const sc = state.scene, sess = sessionFor();
      if (!sess || (sc !== 'play' && sc !== 'free') || sess.down[pointerId] === undefined) return;
      if (sc === 'play' && (sess.paused || sess.over)) return;
      const G = lay()[sc === 'play' ? 'play' : 'free'].stage, k = stringHit(G, x, y), prev = sess.down[pointerId];
      if (k <= 0 || k === prev) return;
      sess.down[pointerId] = k;
      const t = songAt(audioTime, sess.t), dir = k > prev ? 1 : -1;
      for (let s = prev + dir; dir > 0 ? s <= k : s >= k; s += dir) {
        if (sc === 'play') playerPluck(sess, s, t, true); else freePluck(s, true);
      }
    },
    release(pointerId = 0) { if (state.pl) delete state.pl.down[pointerId]; if (state.free) delete state.free.down[pointerId]; },
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except real play is free: menus, Rules, calibration, Watch and Learn, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !((state.scene === 'play' && pl && pl.mode !== 'auto' && !pl.paused && !pl.over) || state.scene === 'free');
    },
    // Tester tools (?dev=1): jump to a screen and fast-forward.
    dev: {
      layout: () => lay(),
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.piece !== undefined) state.sel = o.piece;
        const sc = o.scene ?? 'title';
        if (sc === 'play') startPlay(o.mode ?? 'perform', state.sel);
        else if (sc === 'free') startFree();
        else if (sc === 'calib') startCal();
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay(o.mode === 'duel' ? 'duel' : 'perform', state.sel); const pl = state.pl;
          if (pl.mode === 'duel') { pl.duel.best = 6; pl.duel.score = 1840; pl.duel.lives = 1; pl.duel.history = [{ acc: 0.9 }, { acc: 0.8 }]; pl.counts = { perfect: 20, great: 9, good: 4, miss: 3 }; finishDuel(false); }
          else { pl.score = 123450; pl.maxCombo = 41; pl.counts = { perfect: 88, great: 31, good: 9, miss: 3 }; pl.chunks[0].sum = 118; pl.chunks[0].n = 135; finishRun(); }
        } else if (sc === 'songs') { state.pick = o.pick ?? 'play'; state.scene = sc; state.sceneT = 0; }
        else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) {
            const pl = state.pl;
            // dev play-through: make every gesture on time so the picture shows a good run
            if (pl && state.scene === 'play' && o.play && !pl.paused && pl.mode !== 'auto') {
              for (let j = pl.np; j < pl.notes.length && pl.notes[j].t <= pl.t + 0.02 + state.prefs.cal / 1000; j++) {
                const nt = pl.notes[j]; if (nt.j || nt.done) continue;
                nt.done = true;
                if (nt.kind === 'p') playerPluck(pl, nt.k, pl.t); else if (nt.kind === 'd') playerDamp(pl, pl.t); else for (const k of nt.ks) playerPluck(pl, k, pl.t, true);
              }
            }
            if (state.scene === 'free' && o.play && i % 14 === 0) { state.free.playing = true; freePluck([1, 3, 4, 5, 6, 4, 3, 2][(i / 14) % 8 | 0]); }
            api.update(1 / 60, idle);
          }
        }
        if (o.hold && state.pl) state.pl.hold = true;
        if (o.hold && state.free) { state.free.hold = true; }
      },
    },
  };
  return api;
}
