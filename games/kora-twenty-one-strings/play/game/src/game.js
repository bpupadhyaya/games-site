// Kora: state and flow. Drawing is in view.js / playview.js / docview.js; the music and the rule constants are in music.js.
//
// Timing model: song time `pl.t` is the sum of the dt values handed to update() (deterministic, pausable). When the browser gives us an
// audio engine (env.rhythm, see web/audio/engine.js) accompaniment sounds are scheduled on the audio clock a little ahead of pl.t, and a
// player's touch is time-stamped on the audio clock and converted back to song time before it is judged. Headless runs have no engine:
// the same code runs with touches taken at the tick time.
import { PIECES, JUDGE, TIMING, SPEEDS, SCORE, WEIGHT, ENSEMBLE, LEARN, LOOKAHEAD, STRING_COUNT, buildRun, accuracyToStars, gradeOf, comboMult, barDur, fingerId } from './music.js';
import { layoutFor, laneHit, stringHit, stringMap, inRect, TEXT_SCALES, menuRects } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const NO_RHYTHM = { available: false, play() {}, sync() {}, flush() {}, toSong: () => NaN, setMuted() {}, now: () => 0, haptic() {} };
const DEMO_RUNS = 6;
const KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH'];
const FREE_KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'], FREE_STRINGS = [4, 5, 7, 8, 9, 11, 12, 14, 15];
const GRADE_TEXT = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };
const GRADE_COL = { perfect: '#ffe07a', great: '#8ef0dc', good: '#9fc4ff', miss: '#ff8a8a' };
const newSv = () => Array.from({ length: STRING_COUNT }, () => ({ amp: 0, fireT: -9 }));
const newFg = () => Array.from({ length: 4 }, () => ({ x: null, tx: null, lift: 0, glow: 0, last: -9 }));

export function createGame(env) {
  const { rng, storage, config } = env;
  const R = env.rhythm ?? NO_RHYTHM;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, speedIdx: 1, timingIdx: 1, labels: true, click: true, haptics: true, calm: false, textIdx: 0, cal: 0, autoSlow: false },
    best: {}, demoRuns: 0, pl: null, free: null, cal: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
  };
  let lastScene = state.scene, drag = null;

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = Math.min(Math.max(state.prefs.textIdx | 0, 0), TEXT_SCALES.length - 1); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { R.setMuted(!state.prefs.sound); env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const tk = () => TIMING[state.prefs.timingIdx].k;
  const win = () => ({ p: JUDGE.perfect * tk(), g: JUDGE.great * tk(), o: JUDGE.good * tk() });
  const go = (scene) => { if (state.scene === 'play' || state.scene === 'free' || state.scene === 'calib') R.flush(); state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  // Touch time on the song clock: from the audio clock when the engine can tell, else the tick time.
  const songAt = (audioTime, fallback) => { const s = R.available ? R.toSong(audioTime) : NaN; return Number.isFinite(s) ? s : fallback; };
  const vel = (e) => (e.soft ? 0.5 : 0.88);

  // ---- a play session -------------------------------------------------------------------------------------------------------------------
  function newPlay(pieceIdx, mode) {
    const piece = PIECES[pieceIdx], n = piece.lanes.length;
    return {
      mode, pi: pieceIdx, piece, t: 0, ev: [], nd: Array.from({ length: n }, () => []), np: new Array(n).fill(0), si: 0, fi: 0, endT: 0.5, bars: [], chunks: [], cur: null,
      speed: mode === 'auto' && state.prefs.autoSlow ? 0.75 : 1,
      ens: mode === 'perform' ? ENSEMBLE.start : mode === 'auto' ? ENSEMBLE.max : 0, streak: 0, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 }, accSum: 0, accN: 0,
      paused: false, over: false, resync: true,
      learn: mode === 'learn' ? { phrase: 0, attempt: 1, final: false, acc: [], tries: [] } : null,
      sv: newSv(), fg: newFg(), pops: [], parts: [], pulse: 0, banner: null, shake: 0, layerFlash: 0, glow: 0,
    };
  }
  function append(pl, segments, extra = {}) {
    const run = buildRun(pl.piece, segments, pl.endT, { click: state.prefs.click && pl.mode === 'learn', speed: pl.speed });
    const id = pl.chunks.length, chunk = { id, t0: run.T0, t1: run.end, sum: 0, n: 0, done: false, ...extra };
    for (const e of run.events) {
      e.ch = id;
      pl.ev.push(e);
      if (e.who === 'note') { pl.nd[e.lane].push(e); chunk.n += 1; }
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
  function startPlay(mode) {
    if (config.demo && mode !== 'auto' && (state.sel > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (config.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush();
    const pl = newPlay(state.sel, mode); state.pl = pl; state.result = null;
    if (mode === 'learn') learnStep(pl);
    else if (mode === 'perform') append(pl, [{ kind: 'count' }, { kind: 'play', b0: 0, b1: pl.piece.bars }], { kind: 'whole' });
    else append(pl, [{ kind: 'count' }, { kind: 'auto', b0: 0, b1: pl.piece.bars }], { kind: 'whole' });
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('piece_start', { piece: pl.piece.id, mode });
  }
  function pausePlay() {
    const pl = state.pl; if (!pl || pl.paused || pl.over) return;
    pl.paused = true; R.flush();
    while (pl.si > 0 && pl.ev[pl.si - 1].t > pl.t) pl.si -= 1;      // what was scheduled but not yet heard will be scheduled again
    for (let i = pl.si; i < pl.ev.length; i++) if (pl.ev[i].t > pl.t) pl.ev[i].on = undefined;
  }
  function resumePlay() { const pl = state.pl; if (!pl) return; pl.paused = false; pl.resync = true; }
  // Drop everything still to come (used by Listen).
  function truncateFuture(pl) {
    let k = pl.ev.length; while (k > 0 && pl.ev[k - 1].t > pl.t) k -= 1;
    pl.ev.length = k; pl.si = Math.min(pl.si, k); pl.fi = Math.min(pl.fi, k);
    for (let d = 0; d < pl.nd.length; d++) { pl.nd[d] = pl.nd[d].filter((n) => n.t <= pl.t); pl.np[d] = Math.min(pl.np[d], pl.nd[d].length); }
    pl.bars = pl.bars.filter((b) => b.t0 <= pl.t); pl.endT = pl.t;
    R.flush(); pl.resync = true;
  }
  function listenAgain() {
    const pl = state.pl;
    if (!pl || pl.mode !== 'learn' || pl.learn.final || pl.paused || pl.over) return;
    if (pl.cur) pl.cur.cancel = true;
    truncateFuture(pl); pl.endT = pl.t + beatOf(pl) * 1.5;
    learnStep(pl); say('Listen again', 1.4);
  }

  // ---- plucks (what a pluck looks and sounds like) ---------------------------------------------------------------------------------
  const xsFor = (sess, scene) => (scene === 'free' ? stringMap(lay().free.stage, null) : stringMap(lay().play.stage, sess.piece));
  function strike(sess, str, soft, by, scene, fingerSrc) {
    if (str < 0 || str >= STRING_COUNT) return;
    const sv = sess.sv[str], now = sess.t, S = scene === 'free' ? lay().free.stage : lay().play.stage, xs = xsFor(sess, scene);
    sv.amp = soft ? 0.55 : 1; sv.fireT = now;
    sess.glow = Math.min(1, (sess.glow || 0) + (soft ? 0.12 : 0.25));
    const hand = str % 2 === 0 ? 'L' : 'R';
    if (!state.prefs.calm) burst(sess.parts, rng, xs.x[str], S.bridgeY - 6, soft ? 4 : 9, hand, 1);
    if (fingerSrc) {                                                                  // the finger that plays this string
      const f = sess.fg[fingerId(str)]; f.lift = 1; f.glow = 1; f.last = now; f.tx = xs.x[str]; if (f.x === null) f.x = f.tx;
    }
    if (by === 'player' && state.prefs.haptics) R.haptic?.(soft ? 5 : 9);
  }
  const pop = (sess, lane, text, col, size) => {
    const S = lay().play.stage, lns = S.lanesFor(sess.piece.lanes.length)[lane]; if (!lns) return;
    sess.pops = sess.pops.filter((q) => q.lane !== lane);
    sess.pops.push({ lane, x: Math.max(60, Math.min(meta.width - 60, lns.cx)), y: S.bridgeY - 110, text, col, size: Math.max(16, Math.min(size, lns.lw * 0.23)), age: 0 });
    if (sess.pops.length > 12) sess.pops.shift();
  };

  // ---- judging --------------------------------------------------------------------------------------------------------------------------------
  function judgeNote(pl, n, tAdj) {
    const w = win(), err = Math.abs(n.t - tAdj);
    const g = err <= w.p ? 'perfect' : err <= w.g ? 'great' : 'good';
    n.j = g; n.err = tAdj - n.t;
    const mult = comboMult(pl.combo);
    pl.score += SCORE[g] * mult; pl.combo += 1; pl.maxCombo = Math.max(pl.maxCombo, pl.combo);
    pl.counts[g] += 1; pl.accSum += WEIGHT[g]; pl.accN += 1; pl.streak += 1;
    const ch = pl.chunks[n.ch]; if (ch) ch.sum += WEIGHT[g];
    if (pl.mode === 'perform' || (pl.learn && pl.learn.final)) {
      if (pl.streak % ENSEMBLE.every === 0 && pl.ens < ENSEMBLE.max) { pl.ens += 1; pl.layerFlash = 1; pl.banner = { text: 'MORE VOICES JOIN', t: 0 }; }
    }
    pop(pl, n.lane, GRADE_TEXT[g], GRADE_COL[g], g === 'perfect' ? 40 : 34);
  }
  function missNote(pl, n) {
    n.j = 'miss'; pl.counts.miss += 1; pl.accN += 1; pl.combo = 0; pl.streak = 0;
    if (pl.mode === 'perform' || (pl.learn && pl.learn.final)) pl.ens = Math.max(0, pl.ens - 1);
    pop(pl, n.lane, 'MISS', GRADE_COL.miss, 30);
  }
  function findNote(pl, lane, tAdj) {
    const arr = pl.nd[lane], w = win().o; let best = null;
    for (let i = pl.np[lane]; i < arr.length && arr[i].t <= tAdj + w; i++) {
      const n = arr[i]; if (n.j) continue;
      const e = Math.abs(n.t - tAdj); if (e <= w && (!best || e < Math.abs(best.t - tAdj))) best = n;
    }
    return best;
  }
  function playerHit(sess, lane, tSong) {
    const str = sess.piece.lanes[lane];
    if (state.prefs.sound) R.play(str, 'P', 0.9, null);
    let note = null;
    if (sess === state.pl && sess.mode !== 'auto' && !sess.paused && !sess.over) {
      const tAdj = tSong - state.prefs.cal / 1000;
      note = findNote(sess, lane, tAdj);
      if (note) judgeNote(sess, note, tAdj);
    }
    strike(sess, str, !!(note && note.soft), 'player', 'play', true);
    return note;
  }

  // ---- per-tick play update -----------------------------------------------------------------------------------------------------------------
  function evOn(pl, e) {
    if (e.on !== undefined) return e.on;
    if (e.who === 'ens') return e.layer <= pl.ens;
    if (e.who === 'teach') return true;
    if (e.who === 'click') return !!e.cnt || (pl.mode === 'learn' && state.prefs.click);
    return false;
  }
  // The four fingers glide to the string they will pluck next and lift when they pluck.
  function guideFingers(pl, xs) {                                                    // upcoming teacher plucks pull their finger into place
    const hor = pl.t + 0.32, seen = [false, false, false, false];
    for (let i = pl.fi; i < pl.ev.length && pl.ev[i].t < hor; i++) {
      const e = pl.ev[i]; if (e.str < 0 || e.who !== 'teach') continue;
      const f = fingerId(e.str); if (seen[f]) continue; seen[f] = true;
      const fg = pl.fg[f]; fg.tx = xs.x[e.str];
      const until = e.t - pl.t; if (until < 0.16) fg.lift = Math.max(fg.lift, 0.45 * (1 - until / 0.16));
    }
  }
  function stepAnim(sess, dt, scene) {
    for (const sv of sess.sv) sv.amp = Math.max(0, sv.amp - dt * 1.5);
    for (const p of sess.pops) p.age += dt;
    sess.pops = sess.pops.filter((p) => p.age < 0.8);
    stepParticles(sess.parts, dt);
    sess.pulse = Math.max(0, sess.pulse - dt * 4); sess.layerFlash = Math.max(0, (sess.layerFlash || 0) - dt * 1.5);
    sess.glow = Math.max(0, (sess.glow || 0) - dt * 1.4);
    if (sess.banner) { sess.banner.t += dt; if (sess.banner.t > 1.6) sess.banner = null; }
    const xs = xsFor(sess, scene);
    if (scene === 'play') guideFingers(sess, xs);
    for (const fg of sess.fg) {
      fg.lift = Math.max(0, fg.lift - dt * 6.5); fg.glow = Math.max(0, fg.glow - dt * 5);
      if (fg.tx !== null) { if (fg.x === null) fg.x = fg.tx; else fg.x += (fg.tx - fg.x) * Math.min(1, dt * 16); }
    }
  }
  function updatePlay(dt, tap, input) {
    const pl = state.pl, L = lay().play;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    const n = pl.piece.lanes.length;
    if (tap) {
      if (inRect(L.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (pl.mode === 'learn' && !pl.learn.final && inRect(L.hint, tap.x, tap.y)) { listenAgain(); return; }
      if (!R.available) { const h = laneHit(L.stage, n, tap.x, tap.y); if (h >= 0) playerHit(pl, h, pl.t); }
    }
    for (let i = 0; i < n && i < KEYS.length; i++) if (input.keys.pressed.has(KEYS[i])) playerHit(pl, i, pl.t);
    if (input.keys.pressed.has('Space') || input.keys.pressed.has('Escape')) { pausePlay(); return; }
    pl.t += dt;
    if (R.available) { R.sync(pl.t, pl.resync); pl.resync = false; }
    // audio scheduling, a little ahead of the song clock
    const horizon = pl.t + LOOKAHEAD;
    while (pl.si < pl.ev.length && pl.ev[pl.si].t <= horizon) {
      const e = pl.ev[pl.si++];
      if (e.on === undefined) e.on = evOn(pl, e);
      if (e.on && state.prefs.sound) R.play(e.str, e.accent ? 'accent' : 'beat', e.who === 'ens' ? vel(e) * 0.8 : vel(e), e.t);
    }
    // visuals at the moment of the pluck
    while (pl.fi < pl.ev.length && pl.ev[pl.fi].t <= pl.t) {
      const e = pl.ev[pl.fi++];
      if (e.on === undefined) e.on = evOn(pl, e);
      if (e.who === 'click') { if (e.on) pl.pulse = e.accent ? 1 : 0.6; continue; }
      if (e.who === 'note' || !e.on) continue;
      strike(pl, e.str, e.soft, 'ens', 'play', e.who === 'teach');
      if (pl.mode === 'auto' && e.who === 'teach') {
        pl.score += SCORE.perfect * comboMult(pl.combo); pl.combo += 1; pl.maxCombo = Math.max(pl.maxCombo, pl.combo); pl.counts.perfect += 1; pl.accN += 1; pl.accSum += 1;
        if (e.lane >= 0) pop(pl, e.lane, 'PERFECT', GRADE_COL.perfect, 24);
      }
    }
    // notes nobody played
    const w = win().o + state.prefs.cal / 1000;
    for (let d = 0; d < n; d++) {
      const arr = pl.nd[d];
      while (pl.np[d] < arr.length) {
        const nt = arr[pl.np[d]];
        if (nt.j) { pl.np[d] += 1; continue; }
        if (nt.t + w < pl.t) { missNote(pl, nt); pl.np[d] += 1; } else break;
      }
    }
    stepAnim(pl, dt, 'play');
    // chunk logic: what happens when a call-and-response pair, a whole piece or the final take is over
    const c = pl.cur;
    if (c && !c.done && !c.cancel && pl.t >= c.t1 + 0.2) {
      c.done = true;
      const acc = c.n ? c.sum / c.n : 1;
      if (pl.mode === 'auto') { pl.over = true; R.flush(); return; }
      if (pl.mode === 'perform' || c.kind === 'final') { finishRun(); return; }
      const L2 = pl.learn;
      L2.tries[c.phrase] = c.attempt;
      if (acc < LEARN.pass && L2.attempt < LEARN.tries) { L2.attempt += 1; pl.banner = { text: 'ONCE MORE', t: 0 }; }
      else { L2.acc[c.phrase] = acc; L2.phrase += 1; L2.attempt = 1; if (L2.phrase >= 4) L2.final = true; pl.banner = { text: acc >= 0.75 ? 'NICE' : 'ON TO THE NEXT', t: 0 }; }
      pl.endT = Math.max(pl.endT, pl.t) + beatOf(pl);
      learnStep(pl);
    }
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
      else go('piece');
    });
  }

  // ---- free play ---------------------------------------------------------------------------------------------------------------------------------------
  function startFree() {
    if (config.demo && state.demoRuns >= DEMO_RUNS) { go('demo-limit'); return; }
    if (config.demo) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush();
    state.free = { t: 0, sv: newSv(), fg: newFg(), pops: [], parts: [], pulse: 0, glow: 0, metro: false, bpm: 90, echo: true, phrase: [], lastHit: -9, q: [], nextClick: 0, beat: 0, resync: true, banner: null, layerFlash: 0, hits: 0, down: {}, piece: null };
    state.scene = 'free'; state.sceneT = 0;
  }
  function freePluck(str, tSong, soft = false) {
    const f = state.free;
    if (state.prefs.sound) R.play(str, 'P', soft ? 0.55 : 0.9, null);
    strike(f, str, soft, 'player', 'free', true);
    if (f.t - f.lastHit > 1.0) f.phrase = [];
    f.phrase.push({ t: tSong, str }); if (f.phrase.length > 24) f.phrase.shift();
    f.lastHit = f.t; f.hits += 1;
  }
  function freeTouch(x, y, tSong, pointerId = 0) {
    const f = state.free, str = stringHit(lay().free.stage, x, y);
    if (str < 0) return false;
    f.down[pointerId] = str;
    freePluck(str, tSong);
    return true;
  }
  function freeDrag(x, y, tSong, pointerId = 0) {                                    // a finger sliding across the strings plucks each one it crosses
    const f = state.free; if (!f || f.down[pointerId] === undefined) return;
    const str = stringHit(lay().free.stage, x, y);
    if (str >= 0 && str !== f.down[pointerId]) { f.down[pointerId] = str; freePluck(str, tSong, true); }
  }
  function updateFree(dt, tap, input) {
    const f = state.free, F = lay().free;
    if (tap) {
      if (inRect(F.exit, tap.x, tap.y)) { go('title'); state.free = null; return; }
      if (inRect(F.metro, tap.x, tap.y)) { f.metro = !f.metro; f.nextClick = f.t + 0.15; f.beat = 0; f.q = f.q.filter((e) => e.str !== -1); R.flush(); f.resync = true; }
      else if (inRect(F.tempoDec, tap.x, tap.y)) f.bpm = Math.max(50, f.bpm - 5);
      else if (inRect(F.tempoInc, tap.x, tap.y)) f.bpm = Math.min(180, f.bpm + 5);
      else if (inRect(F.echo, tap.x, tap.y)) f.echo = !f.echo;
      else if (!R.available) freeTouch(tap.x, tap.y, f.t);
    }
    if (!input.pointer.down && !R.available) f.down = {};
    FREE_KEYS.forEach((k, i) => { if (input.keys.pressed.has(k)) freePluck(FREE_STRINGS[i], f.t); });
    if (input.keys.pressed.has('Escape')) { go('title'); state.free = null; return; }
    f.t += dt;
    if (R.available) { R.sync(f.t, f.resync); f.resync = false; }
    if (f.metro) {
      while (f.nextClick <= f.t + LOOKAHEAD) { f.q.push({ t: f.nextClick, str: -1, accent: f.beat % 4 === 0, vel: 0.7, snd: false }); f.nextClick += 60 / f.bpm; f.beat += 1; }
    }
    if (f.echo && f.phrase.length >= 2 && f.t - f.lastHit > 1.0) {                    // the partner answers the phrase you just played
      const base = f.t + 0.25, t0 = f.phrase[0].t;
      for (const r of f.phrase) f.q.push({ t: base + r.t - t0, str: r.str, vel: 0.6, snd: false, echo: true });
      f.phrase = [];
    }
    for (let i = f.q.length - 1; i >= 0; i--) {
      const e = f.q[i];
      if (!e.snd && e.t - LOOKAHEAD <= f.t) { e.snd = true; if (state.prefs.sound) R.play(e.str, e.accent ? 'accent' : 'beat', e.vel, e.t); }
      if (e.t <= f.t) {
        if (e.str === -1) f.pulse = e.accent ? 1 : 0.6; else strike(f, e.str, true, 'ens', 'free', false);
        f.q.splice(i, 1);
      }
    }
    stepAnim(f, dt, 'free');
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
    if (state.prefs.sound) R.play(11, 'P', 0.8, null);
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
    else if (hit(T.auto)) { state.sel = 5; startPlay('auto'); }
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
      else if (sc === 'calib') updateCal(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
    // Multi-touch plucks from main.js (the kit input only has one pointer). Returns true when the game used the touch.
    touch(x, y, audioTime, pointerId = 0) {
      const sc = state.scene;
      if (sc === 'play') {
        const pl = state.pl, L = lay().play;
        if (!pl || pl.paused || pl.over) return false;
        if (inRect(L.pause, x, y) || inRect(L.hint, x, y)) return false;
        const h = laneHit(L.stage, pl.piece.lanes.length, x, y);
        if (h >= 0) playerHit(pl, h, songAt(audioTime, pl.t));
        return true;
      }
      if (sc === 'free') {
        const F = lay().free;
        for (const r of [F.exit, F.metro, F.tempoDec, F.tempoInc, F.echo]) if (inRect(r, x, y)) return false;
        freeTouch(x, y, songAt(audioTime, state.free.t), pointerId);
        return true;
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
    // A finger sliding across the strings in free play.
    drag(x, y, audioTime, pointerId = 0) { if (state.scene === 'free') freeDrag(x, y, songAt(audioTime, state.free.t), pointerId); },
    release(pointerId = 0) { if (state.free) delete state.free.down[pointerId]; },
    // Called by main.js when the app goes to the background.
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
        else if (sc === 'free') startFree();
        else if (sc === 'calib') startCal();
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('perform'); const pl = state.pl; pl.score = 123450; pl.maxCombo = 41; pl.counts = { perfect: 88, great: 31, good: 9, miss: 3 }; pl.chunks[0].sum = 118; pl.chunks[0].n = 135; finishRun();
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) {
            // dev play-through: pluck every note on time so the picture shows a good run
            const pl = state.pl;
            if (pl && state.scene === 'play' && o.play && !pl.paused) for (let d = 0; d < pl.nd.length; d++) { const nt = pl.nd[d][pl.np[d]]; if (nt && !nt.j && nt.t <= pl.t + 0.01 + state.prefs.cal / 1000) playerHit(pl, d, pl.t); }
            if (state.scene === 'free' && o.play && i % 14 === 0) freePluck(FREE_STRINGS[(i / 14) % FREE_STRINGS.length | 0], state.free.t);
            api.update(1 / 60, idle);
          }
        }
      },
    },
  };
  return api;
}
