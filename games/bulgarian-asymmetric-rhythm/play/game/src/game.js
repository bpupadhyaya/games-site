// Bulgarian Asymmetric Rhythm: state and flow. Drawing is in view.js / docview.js; music and the rule constants are in music.js.
//
// Timing model: song time `pl.t` is the sum of the dt values handed to update() (deterministic, pausable). When the browser gives us an
// audio engine (env.rhythm, see web/audio/engine.js) the band's sounds are scheduled on the audio clock a little ahead of pl.t. A player's
// tap is judged at the tick it is recognised. Headless runs have no engine and run the same code.
// One bar = one row of the sash; each pulse is a cell; each cue sits in a cell and is played on one of three pads (drum, clap, step).
import { PIECES, JUDGE, TIMING, SCORE, WEIGHT, FLOW, LEARN, ACCENT, DANCERS, LOOKAHEAD, buildRun, accuracyToStars, gradeOf, comboMult, barOf } from './music.js';
import { layoutFor, inRect, padAt, TEXT_SCALES } from './layout.js';
import { burst, stepParticles, KIND_COL } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const NO_RHYTHM = { available: false, play() {}, sync() {}, flush() {}, toSong: () => NaN, setMuted() {}, now: () => 0, haptic() {} };
const DEMO_RUNS = 6;
export const LEARN_BARS = 8, LEARN_PHRASE = 2, AUTO_PHRASE = 4;
const GRADE_TEXT = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', off: 'OFF', miss: 'MISS' };
const GRADE_COL = { perfect: '#ffe07a', great: '#8ef0dc', good: '#9fc4ff', off: '#d9b3ff', miss: '#ff7d8f' };
const KEY_PAD = { Space: 'drum', KeyJ: 'drum', KeyC: 'clap', KeyK: 'clap', KeyS: 'step', KeyL: 'step' };

export function createGame(env) {
  const { rng, storage, config } = env;
  const R = env.rhythm ?? NO_RHYTHM;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, timingIdx: 1, thinkSec: 5, cal: 0, labels: true, calm: false, haptics: true, textIdx: 0 },
    best: {}, demoRuns: 0, pl: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    restore: { busy: false, owned: false, msg: '' }, calib: null, toast: null, dev: config.dev === true, demo: config.demo === true,
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
  const go = (scene) => { if (state.scene === 'play') R.flush(); state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  const haptic = (ms) => { if (state.prefs.haptics) R.haptic?.(ms); };
  const nBars = (p) => p.bars.length;

  // ---- a play session -------------------------------------------------------------------------------------------------------------------
  function newPlay(pi, mode) {
    const piece = PIECES[pi];
    return {
      mode, pi, piece, t: 0, cues: [], np: 0, ev: [], si: 0, fi: 0, endT: 0.5, bars: [], chunks: [], cur: null,
      speed: mode === 'learn' ? LEARN.speed : 1, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, off: 0, miss: 0 }, accSum: 0, accN: 0,
      flow: mode === 'auto' ? 0.3 : 0, layer: 0, horoN: DANCERS[0], paused: false, over: false, resync: true,
      pad: { drum: 0, clap: 0, step: 0 }, pulse: 0, stamp: 0, pops: [], parts: [], shake: 0, banner: null, hintT: 0, flash: 0, stray: 0,
      bi: 0, barF: 0, phase: 0, gap: true, role: 'count', curBar: -1, lastLabel: null, lastK: -1, beatN: 0,
      learn: mode === 'learn' ? { phrase: 0, attempt: 1, final: false, acc: [], tries: [] } : null,
      auto: mode === 'auto' ? { phase: 'think', timer: state.prefs.thinkSec, phrase: 0, n: Math.ceil(nBars(piece) / AUTO_PHRASE), reveal: 0 } : null,
    };
  }
  function append(pl, segments, extra = {}, speed = pl.speed) {
    const startT = pl.endT;
    const run = buildRun(pl.piece, segments, startT, { speed });
    const id = pl.chunks.length, chunk = { id, t0: startT, t1: run.end, sum: 0, n: 0, done: false, ...extra };
    for (const c of run.cues) {
      c.ch = id;
      if (!c.demo) chunk.n += 1; else run.events.push({ t: c.t, who: 'move', voice: c.kind, vel: 0.85, layer: 0 });
      pl.cues.push(c);
    }
    run.events.sort((a, b) => a.t - b.t);
    const base = pl.bars.length;
    run.bars.forEach((b, k) => { b.ch = id; b.k = base + k; for (const q of b.cues) q.bk = base + k; });
    for (const e of run.events) { e.ch = id; pl.ev.push(e); }
    pl.bars.push(...run.bars);
    pl.chunks.push(chunk); pl.cur = chunk; pl.endT = run.end;
    return chunk;
  }
  function learnStep(pl) {
    const L = pl.learn, b0 = L.phrase * LEARN_PHRASE, b1 = Math.min(b0 + LEARN_PHRASE, LEARN_BARS, nBars(pl.piece));
    if (L.final) { pl.speed = 1; return append(pl, [{ kind: 'count' }, { kind: 'play', b0: 0, b1: nBars(pl.piece) }], { kind: 'final' }, 1); }
    return append(pl, [{ kind: 'count' }, { kind: 'watch', b0, b1 }, { kind: 'echo', b0, b1 }], { kind: 'pair', phrase: L.phrase, attempt: L.attempt });
  }
  const learnPhrases = (pl) => Math.ceil(Math.min(LEARN_BARS, nBars(pl.piece)) / LEARN_PHRASE);
  function startPlay(mode) {
    if (config.demo && mode !== 'auto' && (state.sel > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (config.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush();
    const pl = newPlay(state.sel, mode); state.pl = pl; state.result = null;
    if (mode === 'learn') learnStep(pl);
    else if (mode === 'perform') append(pl, [{ kind: 'count' }, { kind: 'play', b0: 0, b1: nBars(pl.piece) }], { kind: 'whole' });
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
  function truncateFuture(pl) {
    let k = pl.ev.length; while (k > 0 && pl.ev[k - 1].t > pl.t) k -= 1;
    pl.ev.length = k; pl.si = Math.min(pl.si, k); pl.fi = Math.min(pl.fi, k);
    pl.cues = pl.cues.filter((c) => c.t <= pl.t); pl.np = Math.min(pl.np, pl.cues.length);
    pl.bars = pl.bars.filter((b) => b.t0 <= pl.t); pl.endT = pl.t; pl.bi = Math.min(pl.bi, Math.max(0, pl.bars.length - 1));
    R.flush(); pl.resync = true;
  }
  function listenAgain() {
    const pl = state.pl;
    if (!pl || pl.mode !== 'learn' || pl.learn.final || pl.paused || pl.over) return;
    if (pl.cur) pl.cur.cancel = true;
    truncateFuture(pl); pl.endT = pl.t + 0.4;
    learnStep(pl); say('Listen again', 1.4);
  }
  function peekHint() { const pl = state.pl; if (pl && !pl.paused && !pl.over) pl.hintT = 4; }

  // ---- effects --------------------------------------------------------------------------------------------------------------------------
  const padSpot = (pad) => { const P = lay().play[pad]; return { x: P.x + P.w / 2, y: P.y + P.h * 0.4 }; };
  function effects(pl, pad, strong) {
    pl.pad[pad] = 1;
    if (pad === 'step') pl.stamp = Math.max(pl.stamp, 1);
    if (pad === 'drum') pl.pulse = Math.max(pl.pulse, strong ? 1 : 0.6);
    if (state.prefs.calm) return;
    const p = padSpot(pad);
    burst(pl.parts, rng, p.x, p.y, strong ? 12 : 6, KIND_COL[pad], 0.9);
    if (pad === 'drum') pl.shake = Math.max(pl.shake, strong ? 0.45 : 0.2);
  }
  function pop(pl, c, text, col, size) {
    pl.pops.push({ bk: c.bk, i: c.i, text, col, size, age: 0 });
    if (pl.pops.length > 5) pl.pops.shift();
  }

  // ---- judging ------------------------------------------------------------------------------------------------------------------------
  function finalize(pl, c, g) {
    if (c.done) return;
    c.done = true; c.j = g; c.at = pl.t;
    const mult = comboMult(pl.combo) * (c.kind === 'drum' ? ACCENT : 1);
    if (g === 'miss') pl.combo = 0; else { pl.combo += 1; pl.maxCombo = Math.max(pl.maxCombo, pl.combo); }
    pl.score += Math.round(SCORE[g] * mult); pl.counts[g] += 1; pl.accSum += WEIGHT[g]; pl.accN += 1;
    const ch = pl.chunks[c.ch]; if (ch) ch.sum += WEIGHT[g];
    pl.flow = Math.max(0, Math.min(1, pl.flow + FLOW[g]));
    pop(pl, c, GRADE_TEXT[g], GRADE_COL[g], g === 'perfect' ? 40 : 34);
    if (g === 'miss') { if (!state.prefs.calm) pl.flash = Math.max(pl.flash, 0.22); R.play('miss', 0.6); }
  }
  const gradeByErr = (err) => { const w = win(); return err <= w.p ? 'perfect' : err <= w.g ? 'great' : 'good'; };
  function findCue(pl, now, test, reach = win().o) {
    let best = null;
    for (let i = pl.np; i < pl.cues.length && pl.cues[i].t <= now + reach; i++) {
      const c = pl.cues[i]; if (c.done || c.demo || !test(c)) continue;
      const e = Math.abs(c.t - now); if (e <= reach && (!best || e < Math.abs(best.t - now))) best = c;
    }
    return best;
  }
  function onPad(pl, pad, now) {
    R.play(pad, 0.9); haptic(pad === 'drum' ? 14 : 10);
    const c = findCue(pl, now, (q) => q.pad === pad);
    if (c) { effects(pl, pad, true); finalize(pl, c, gradeByErr(Math.abs(c.t - now))); return; }
    // the wrong pad at a moment that had a cue counts as OFF
    const wrong = findCue(pl, now, (q) => q.pad !== pad, win().g);
    if (wrong) { effects(pl, pad, false); finalize(pl, wrong, 'off'); return; }
    // a tap with nothing near it: a stray
    effects(pl, pad, false);
    pl.flow = Math.max(0, pl.flow + FLOW.stray); pl.stray += 1;
  }
  function runInput(pl, input) {
    const p = input.pointer, k = input.keys, P = lay().play, tAdj = pl.t - state.prefs.cal / 1000;
    for (const code of Object.keys(KEY_PAD)) if (k.pressed.has(code)) onPad(pl, KEY_PAD[code], tAdj);
    if (p.pressed && !inRect(P.pause, p.x, p.y) && !inRect(P.hint, p.x, p.y)) {
      const pad = padAt(P, p.x, p.y);
      if (pad) onPad(pl, pad, tAdj);
    }
  }

  // ---- per-tick play update -----------------------------------------------------------------------------------------------------------
  function stepAnim(pl, dt) {
    for (const k of Object.keys(pl.pad)) pl.pad[k] = Math.max(0, pl.pad[k] - dt * 5);
    for (const q of pl.pops) q.age += dt;
    pl.pops = pl.pops.filter((q) => q.age < 0.6);
    stepParticles(pl.parts, dt);
    pl.pulse = Math.max(0, pl.pulse - dt * 3.2); pl.shake = Math.max(0, pl.shake - dt * 4); pl.flash = Math.max(0, pl.flash - dt * 2);
    pl.stamp = Math.max(0, pl.stamp - dt * 3);
    pl.hintT = Math.max(0, pl.hintT - dt);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 1.6) pl.banner = null; }
    const th = FLOW.layers; let L = pl.layer;
    while (L < 3 && pl.flow >= th[L]) L += 1;
    while (L > 0 && pl.flow < th[L - 1] - 0.04) L -= 1;
    if (L > pl.layer && pl.mode !== 'auto') pl.banner = { text: L === 3 ? 'THE WHOLE BAND' : 'THE HORO GROWS', t: 0 };
    pl.layer = L;
    const target = DANCERS[pl.mode === 'auto' ? Math.max(1, L) : L];
    pl.horoN += (target - pl.horoN) * Math.min(1, dt * 2.5);
  }
  const evOn = (pl, e) => {
    if (e.on !== undefined) return e.on;
    if (e.who === 'ens') return pl.mode === 'auto' ? e.layer <= Math.max(1, pl.layer) : e.layer <= pl.layer;
    return true;
  };
  function performDemo(pl, c) { c.done = true; c.j = 'perfect'; effects(pl, c.pad, true); }
  // Where the needle is: the bar entry that contains the song time and the continuous bar position used to scroll the rows.
  function trackBar(pl) {
    const bars = pl.bars; if (!bars.length) return;
    let i = Math.max(0, Math.min(pl.bi, bars.length - 1));
    while (i + 1 < bars.length && bars[i + 1].t0 <= pl.t) i += 1;
    const b = bars[i];
    pl.gap = pl.t < b.t0 || pl.t >= b.t1;
    pl.phase = pl.gap ? 0 : (pl.t - b.t0) / (b.t1 - b.t0);
    pl.barF = i + (pl.t >= b.t1 ? 1 : pl.t < b.t0 ? 0 : pl.phase);
    pl.bi = i; pl.role = b.role; pl.curBar = b.bar;
    if (!pl.gap && pl.lastK !== i) {
      if (!b.count && pl.lastLabel && pl.lastLabel !== b.label && pl.mode !== 'auto' && (b.role === 'play' || b.role === 'echo')) pl.banner = { text: `NOW ${b.label}`, t: 0 };
      if (!b.count) pl.lastLabel = b.label;
      pl.lastK = i;
    }
  }
  function updatePlay(dt, input) {
    const pl = state.pl, L = lay().play;
    const tap = input.pointer.pressed ? { x: input.pointer.x, y: input.pointer.y } : null;
    if (pl.frozen) return;                       // dev screenshots only
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    if (input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) { pausePlay(); return; }
    if (input.keys.pressed.has('KeyH')) { if (pl.mode === 'learn') listenAgain(); else peekHint(); }
    if (tap) {
      if (inRect(L.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (inRect(L.hint, tap.x, tap.y)) { if (pl.mode === 'learn' && !pl.learn.final) listenAgain(); else peekHint(); }
    }
    // Watch and Learn: THINK and REVEAL do not advance song time (the music waits); ACT plays one phrase.
    if (pl.mode === 'auto') {
      const A = pl.auto;
      if (A.phase === 'think') {
        if (tap && inRect(L.sash, tap.x, tap.y)) A.timer = 0;
        A.timer -= dt; stepAnim(pl, dt); pl.phase = 0; pl.gap = true;
        if (A.timer <= 0) { A.phase = 'reveal'; A.reveal = 0; }
        return;
      }
      if (A.phase === 'reveal') {
        A.reveal += dt; stepAnim(pl, dt); pl.phase = 0; pl.gap = true;
        if (A.reveal >= 2) {
          const b0 = A.phrase * AUTO_PHRASE, b1 = Math.min(b0 + AUTO_PHRASE, nBars(pl.piece));
          R.flush(); pl.resync = true; pl.endT = pl.t + 0.35;
          append(pl, [{ kind: 'auto', b0, b1 }], { kind: 'auto', phrase: A.phrase });
          A.phase = 'act';
        }
        return;
      }
    } else runInput(pl, input);
    pl.t += dt;
    if (R.available) { R.sync(pl.t, pl.resync); pl.resync = false; }
    const horizon = pl.t + LOOKAHEAD;
    while (pl.si < pl.ev.length && pl.ev[pl.si].t <= horizon) {
      const e = pl.ev[pl.si++];
      if (e.on === undefined) e.on = evOn(pl, e);
      if (e.on && state.prefs.sound) R.play(e.voice, e.vel, e.t, e.pitch ?? 1, e.dur ?? 0.3);
    }
    while (pl.fi < pl.ev.length && pl.ev[pl.fi].t <= pl.t) {
      const e = pl.ev[pl.fi++];
      if (e.on === undefined) e.on = evOn(pl, e);
      if (e.who === 'click') { pl.pulse = e.voice === 'accent' ? 1 : 0.6; pl.beatN = e.cnt; }
    }
    // cues the band or the lead drummer plays by itself
    for (let i = pl.np; i < pl.cues.length && pl.cues[i].t <= pl.t; i++) {
      const c = pl.cues[i];
      if (c.demo && !c.done) performDemo(pl, c);
    }
    // cues nobody played
    const w = win().o + Math.max(0, state.prefs.cal / 1000);
    for (let i = pl.np; i < pl.cues.length && pl.cues[i].t <= pl.t; i++) {
      const c = pl.cues[i]; if (c.done || c.demo) continue;
      if (c.j === null && pl.t > c.t + w) finalize(pl, c, 'miss');
    }
    while (pl.np < pl.cues.length && pl.cues[pl.np].done) pl.np += 1;
    if (pl.mode === 'auto') pl.flow = Math.min(1, 0.3 + 0.7 * ((pl.auto.phrase + 1) / pl.auto.n));    // the band grows as the piece goes on
    stepAnim(pl, dt);
    trackBar(pl);
    chunkLogic(pl);
  }
  // what happens when a watch-and-echo pair, a whole piece or the final take is over
  function chunkLogic(pl) {
    const c = pl.cur;
    if (!c || c.done || c.cancel || pl.t < c.t1 + 0.25) return;
    if (pl.t < c.t1 + 1.5 && pl.cues.some((q) => !q.done && q.ch === c.id)) return;
    c.done = true;
    const acc = c.n ? c.sum / c.n : 1;
    if (pl.mode === 'auto') {
      const A = pl.auto; A.phrase += 1;
      if (A.phrase >= A.n) { pl.over = true; R.flush(); finishAuto(); return; }
      A.phase = 'think'; A.timer = state.prefs.thinkSec; R.flush(); pl.resync = true;
      return;
    }
    if (pl.mode === 'perform' || c.kind === 'final') { finishRun(); return; }
    const L2 = pl.learn;
    L2.tries[c.phrase] = c.attempt;
    if (acc < LEARN.pass && L2.attempt < LEARN.tries) { L2.attempt += 1; pl.banner = { text: 'ONCE MORE', t: 0 }; }
    else { L2.acc[c.phrase] = acc; L2.phrase += 1; L2.attempt = 1; if (L2.phrase >= learnPhrases(pl)) L2.final = true; pl.banner = { text: acc >= 0.75 ? 'NICE' : 'ON TO THE NEXT', t: 0 }; }
    pl.endT = Math.max(pl.endT, pl.t) + 0.5;
    learnStep(pl);
  }
  function finishAuto() {
    // Watch and Learn ends back on the piece page with a toast; nothing is scored or stored.
    state.scene = 'piece'; state.sceneT = 0; state.pl = null; say('That was the whole piece. Try it yourself.', 3);
  }
  // the grades of the final take, bar by bar, for the embroidered summary on the result screen
  function sashRows(pl) {
    const rows = [], byBar = new Map();
    for (const c of pl.cues) if (c.seg === 'play' && !c.demo) { if (!byBar.has(c.bar)) byBar.set(c.bar, new Map()); byBar.get(c.bar).set(c.i, c); }
    pl.piece.bars.forEach((spec, b) => {
      const m = byBar.get(b), bar = barOf(pl.piece, b);
      rows.push({ spec, cells: bar.cells.map((cell) => { const q = m?.get(cell.i); return q ? { kind: q.kind, j: q.j ?? 'miss' } : null; }) });
    });
    return rows;
  }
  function finishRun() {
    const pl = state.pl;
    const fc = pl.chunks.find((c) => c.kind === 'final' || c.kind === 'whole');
    const acc = fc && fc.n ? fc.sum / fc.n : 0;
    const stars = accuracyToStars(acc);
    const id = pl.piece.id, old = state.best[id] ?? {};
    const res = { piece: pl.pi, mode: pl.mode, score: pl.score, acc, stars, grade: gradeOf(acc), maxCombo: pl.maxCombo, counts: { ...pl.counts }, newBest: false, rows: sashRows(pl) };
    if (pl.mode === 'perform') {
      res.newBest = !old.score || pl.score > old.score;
      state.best[id] = { ...old, score: Math.max(old.score || 0, pl.score), acc: Math.max(old.acc || 0, acc), stars: Math.max(old.stars || 0, stars), combo: Math.max(old.combo || 0, pl.maxCombo) };
    } else state.best[id] = { ...old, learn: Math.max(old.learn || 0, stars) };
    storage.set('best', state.best);
    env.monetization.track?.('piece_end', { piece: id, mode: pl.mode, stars });
    R.flush(); pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  function pauseItems(pl) {
    return pl.mode === 'learn' && !pl.learn.final ? ['resume', 'listen', 'restart', 'quit'] : pl.mode === 'auto' ? ['resume', 'next', 'quit'] : ['resume', 'restart', 'quit'];
  }
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems(pl), M = lay().menu(items.length);
    if (input.keys.pressed.has('Escape') && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart') startPlay(pl.mode);
      else if (it === 'listen') { resumePlay(); listenAgain(); }
      else if (it === 'next') { state.sel = state.demo ? 0 : (state.sel + 1) % PIECES.length; startPlay('auto'); }
      else go('piece');
    });
  }

  // ---- menus and documents ------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  // Settings > Purchases: ask the store for earlier purchases; clear busy / found / not found / failed messages.
  const mon = () => env.monetization;
  const syncOwned = () => { state.restore.owned = !!mon()?.owns?.('unlock_game'); };
  mon()?.onChange?.(syncOwned); syncOwned();
  function restorePurchase() {
    const r = state.restore, m = mon();
    if (state.demo || !m || r.busy) return;
    syncOwned();
    if (r.owned) { r.msg = 'Full game unlocked'; return; }
    r.busy = true; r.msg = 'Checking with the store...';
    m.restore().then(() => {
      syncOwned();
      r.msg = r.owned ? 'Purchase restored. Full game unlocked.' : 'No earlier purchase found for this account.';
    }).catch(() => { r.msg = 'Could not reach the store. Try again later.'; }).finally(() => { r.busy = false; });
  }
  // Latency check: ten ticks 0.6 s apart; the player taps with each; the median of (tap - tick) becomes the Latency setting.
  const CAL_BEATS = Array.from({ length: 10 }, (_, i) => 1.2 + i * 0.6);
  function openCalib() { state.calib = { t: 0, taps: [], si: 0, resync: true, done: false, msg: '', beats: CAL_BEATS }; go('calib'); }
  function updateCalib(dt, input, tap) {
    const c = state.calib;
    if (!c) { go('settings'); return; }
    if (input.keys.pressed.has('Escape') || (tap && inRect(lay().songs.back, tap.x, tap.y))) { R.flush(); openDoc('settings', 'title'); return; }
    if (c.done) { if (tap) { R.flush(); openDoc('settings', 'title'); } return; }
    c.t += dt;
    if (R.available) {
      R.sync(c.t, c.resync); c.resync = false;
      while (c.si < c.beats.length && c.beats[c.si] <= c.t + LOOKAHEAD) { if (state.prefs.sound) R.play(c.si === 0 ? 'drum' : 'tick', 0.9, c.beats[c.si]); c.si += 1; }
    }
    if (tap || input.keys.pressed.has('Space')) { c.taps.push(c.t); c.flash = 1; }
    c.flash = Math.max(0, (c.flash || 0) - dt * 4);
    if (c.t > c.beats[c.beats.length - 1] + 0.9) {
      const diffs = [];
      for (const tt of c.taps) {
        let best = null;
        c.beats.forEach((b, i) => { if (i >= 2 && (best === null || Math.abs(tt - b) < Math.abs(best)) ) best = tt - b; });
        if (best !== null && Math.abs(best) < 0.3) diffs.push(best);
      }
      if (diffs.length < 4) c.msg = 'Not enough taps in time. Tap anywhere to leave, then try again.';
      else {
        diffs.sort((a, b) => a - b);
        const med = diffs[diffs.length >> 1] * 1000;
        state.prefs.cal = Math.max(-100, Math.min(400, Math.round(med / 10) * 10));
        savePrefs(); c.msg = `Latency set to ${state.prefs.cal} ms. Tap anywhere to continue.`;
      }
      c.done = true; R.flush();
    }
  }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'timing') p.timingIdx = cyc(p.timingIdx, TIMING.length);
    else if (id === 'labels') p.labels = !p.labels;
    else if (id === 'haptics') p.haptics = !p.haptics;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'thinkDec') p.thinkSec = Math.max(2, p.thinkSec - 1);
    else if (id === 'thinkInc') p.thinkSec = Math.min(10, p.thinkSec + 1);
    else if (id === 'calDec') p.cal = Math.max(-100, p.cal - 10);
    else if (id === 'calInc') p.cal = Math.min(400, p.cal + 10);
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') { restorePurchase(); return; }
    else if (id === 'calib') { openCalib(); return; }
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
    else if (hit(T.auto)) { state.sel = state.demo ? 0 : 1; startPlay('auto'); }
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

  // ---- the object the kit and main.js see -----------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'songs') updateSongs(tap);
      else if (sc === 'piece') updatePiece(tap);
      else if (sc === 'play') updatePlay(dt, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'calib') updateCalib(dt, input, tap);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
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
        if (o.piece !== undefined) state.sel = o.piece;
        const sc = o.scene ?? 'title';
        if (sc === 'play') startPlay(o.mode ?? 'perform');
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('perform'); const pl = state.pl; pl.score = 123450; pl.maxCombo = 41; pl.counts = { perfect: 88, great: 31, good: 9, off: 4, miss: 3 };
          const rnd = ['perfect', 'perfect', 'perfect', 'great', 'good', 'perfect', 'miss', 'perfect', 'great'];
          pl.cues.forEach((c, i) => { c.done = true; c.j = rnd[i % rnd.length]; });   // plausible stitches on the summary
          pl.chunks[0].sum = 118; pl.chunks[0].n = 135; finishRun();
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) {
            const pl = state.pl;
            if (pl && state.scene === 'play' && o.play && !pl.paused && pl.mode !== 'auto') {   // dev play-through: play every cue on time
              for (let j = pl.np; j < pl.cues.length && pl.cues[j].t <= pl.t + 0.02; j++) {
                const c = pl.cues[j]; if (c.done || c.demo) continue;
                effects(pl, c.pad, true); finalize(pl, c, i % 37 === 5 ? 'good' : 'perfect');
              }
            }
            api.update(1 / 60, idle);
          }
        }
        if (o.hint && state.pl) state.pl.hintT = 30;
        if (o.freeze && state.pl) state.pl.frozen = true;
      },
    },
  };
  return api;
}
