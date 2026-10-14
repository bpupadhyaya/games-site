// Three Voices: state and flow. Drawing is in view.js / playview.js / docview.js; the music and every rule constant are in music.js.
//
// Timing model: song time `pl.t` is the sum of the dt values handed to update() (deterministic, pausable). When the browser gives us an
// audio engine (env.rhythm, web/audio/engine.js) the friends' voices are scheduled on the audio clock a little ahead of pl.t, and the
// player's own voices are driven live: every frame a finger is down, its height sets the pitch of that voice. Headless runs have no
// engine: the same code runs with the pointer taken at the tick.
//
// A finger claims the voice (of the ones the player sings) whose ribbon is nearest to where it touched, and keeps it until it lifts.
// Pointers arrive through pdown / pmove / pup (main.js, multi-touch) or, with no engine (tests), through the kit's single pointer.
import {
  NPART, PARTS, PIECES, SCALE_LIST, scaleOf, scaleFor, hzOf, ASSIST, JUDGE, SCORE, WEIGHT, CADENCE_K, PARTS_K, RESONANCE, BREATH, LEARN, THINK, LOOKAHEAD,
  buildRun, beatSec, phraseBeats, pieceRange, ladderLines, assist, nearestPart, nearestInterval, accuracyToStars, gradeOf, comboLabel, describePhrase, PREFS_DEFAULT, LAB_WIN,
} from './music.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, host, pitchY, pitchC, FIELD_PAD } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const NO_RHYTHM = { available: false, sing() {}, live() {}, click() {}, lock() {}, setKey() {}, sync() {}, flush() {}, toSong: () => NaN, setMuted() {}, now: () => 0, haptic() {} };
const DEMO_RUNS = 6;
const GRADE_COL = { perfect: '#ffe07a', great: '#8ef0dc', good: '#9fc4ff', off: '#d9b3ff', miss: '#ff8d8f' };
const LAB_REF = [-1000, 150, 800];
const LAB_TONIC = 207.65;
const newVS = () => ({ c: null, amp: 0, disp: null, err: null, on: false, ok: false });

export function createGame(env) {
  const { rng, storage, config } = env;
  const R = env.rhythm ?? NO_RHYTHM;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { ...PREFS_DEFAULT, parts: [...PREFS_DEFAULT.parts], guide: true },
    best: {}, demoRuns: 0, pl: null, lab: null, result: null, tv: [],
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
    owned: false, restoreMsg: '', restoreBusy: false,
  };
  const mon = env.monetization;
  state.owned = !!mon?.owns?.('unlock_game');
  mon?.onChange?.(() => { state.owned = !!mon.owns('unlock_game'); });
  let lastScene = state.scene, drag = null, devAuto = false, pin = -1;
  const ptrs = new Map();                              // active fingers: id -> { part, x, y }

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    Object.assign(state.prefs, v);
    const p = state.prefs;
    p.textIdx = Math.min(Math.max(p.textIdx | 0, 0), TEXT_SCALES.length - 1); p.think = Math.min(THINK.max, Math.max(THINK.min, p.think | 0));
    p.assistIdx = Math.min(Math.max(p.assistIdx | 0, 0), ASSIST.length - 1);
    if (!Array.isArray(p.parts) || p.parts.length !== NPART || !p.parts.some(Boolean)) p.parts = [...PREFS_DEFAULT.parts];
    applyPrefs();
  });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { R.setMuted(!state.prefs.sound); env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => { host.tz = TEXT_SCALES[state.prefs.textIdx] ?? 1; return layoutFor(meta.width, meta.height); };
  const A = () => ASSIST[state.prefs.assistIdx] ?? ASSIST[1];
  const go = (scene) => {
    if (state.scene === 'play' || state.scene === 'lab') { R.flush(); ptrs.clear(); state.tv = []; }
    state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; if (scene !== 'lab') state.lab = null;
  };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };

  // ---- pitch <-> screen ------------------------------------------------------------------------------------------------------------
  const stage = () => (state.scene === 'lab' ? lay().lab : lay().play);
  const winOf = () => (state.scene === 'lab' ? LAB_WIN : state.pl.win);
  const yOfC = (c) => pitchY(stage().field, winOf(), c);
  const cOfY = (y) => pitchC(stage().field, winOf(), y);
  // The cents windows: the setting's, widened so that "in tune" is never narrower than a finger on this screen.
  const tolerance = (win) => {
    const F = lay().play.field, upc = Math.max(0.05, (F.h - 2 * FIELD_PAD) / (win.hi - win.lo)), a = A();
    return { lock: Math.max(a.lock, 15 / upc), near: Math.max(a.near, 32 / upc), pull: a.pull };
  };
  const syncTv = () => { state.tv = [...ptrs.values()].map((p) => ({ x: p.x, y: p.y, part: p.part })); };

  // ---- a play session -------------------------------------------------------------------------------------------------------------
  function newPlay(pieceIdx, mode) {
    const piece = PIECES[pieceIdx], range = pieceRange(piece), win = { lo: range.lo - 190, hi: range.hi + 190 };
    return {
      t: 0, mode, pi: pieceIdx, piece, win, lines: ladderLines(scaleFor(piece), win.lo, win.hi), can: state.prefs.parts.slice(),
      notes: [], nd: [[], [], []], np: [0, 0, 0], ev: [], si: 0, rests: [], bars: [], segs: [], chunks: [], cur: null, endT: 0.5, speed: 1,
      vs: [newVS(), newVS(), newVS()], now: [null, null, null], trail: [[], [], []],
      res: 1, lockRun: 0, lockHold: 0, unl: 0, broke: false, locked: false, lockT: 0, maxRes: 1, glow: 0.1,
      score: 0, counts: { perfect: 0, great: 0, good: 0, off: 0, miss: 0 }, accSum: 0, accN: 0, cads: {}, breathKept: 0, breathBroken: 0, streak: 0,
      pops: [], parts: [], banner: null, hintT: 0, paused: false, over: false, resync: true, revive: false, pulse: 0, amb: 1,
      learn: mode === 'learn' ? { phrase: 0, attempt: 1, final: false, acc: [], tries: [] } : null,
      auto: mode === 'auto' ? { phase: 'think', k: 0, timer: state.prefs.think, total: state.prefs.think, lines: describePhrase(piece, 0) } : null,
    };
  }
  function append(pl, segments, extra = {}) {
    const parts = pl.mode === 'auto' ? state.prefs.parts : pl.can;
    const run = buildRun(pl.piece, segments, pl.endT, { speed: pl.speed, parts });
    const id = pl.chunks.length, chunk = { id, t0: run.T0, t1: run.end, sum: 0, n: 0, done: false, ...extra };
    for (const n of run.notes) {
      n.ch = id; n.inT = 0; n.nearT = 0; n.lat = undefined; n.j = undefined; pl.notes.push(n); pl.nd[n.part].push(n);
      if (n.who === 'ens') pl.ev.push({ t: n.t, k: 'ens', n });
      else if (state.prefs.guide) pl.ev.push({ t: n.t, k: 'guide', n });
    }
    for (const c of run.clicks) pl.ev.push({ t: c.t, k: 'click', accent: c.accent });
    for (const r of run.rests) pl.rests.push({ ...r, ch: id, sung: 0, done: false });
    pl.ev.sort((a, b) => a.t - b.t);
    pl.bars.push(...run.bars); pl.segs.push(...run.segs.map((g) => ({ ...g, ch: id })));
    pl.chunks.push(chunk); pl.cur = chunk; pl.endT = run.end;
    return chunk;
  }
  const beatOf = (pl) => beatSec(pl.piece, pl.speed);
  function learnStep(pl, first) {
    const L = pl.learn, bpp = phraseBeats(pl.piece), b0 = L.phrase * bpp;
    if (L.final) { pl.streak = 0; return append(pl, [{ kind: 'count' }, { kind: 'play', b0: 0, b1: bpp * 4 }], { kind: 'final' }); }
    return append(pl, [{ kind: first ? 'count' : 'gap' }, { kind: 'listen', b0, b1: b0 + bpp }, { kind: 'gap' }, { kind: 'echo', b0, b1: b0 + bpp }], { kind: 'pair', phrase: L.phrase, attempt: L.attempt });
  }
  function autoPhrase(pl) {
    const k = pl.auto.k, bpp = phraseBeats(pl.piece);
    pl.endT = pl.t + 0.9;
    return append(pl, [{ kind: 'auto', b0: k * bpp, b1: (k + 1) * bpp }], { kind: 'auto', phrase: k });
  }
  function startPlay(mode) {
    if (config.demo && mode !== 'auto' && (state.sel > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (config.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush(); ptrs.clear(); state.tv = [];
    const pl = newPlay(state.sel, mode); state.pl = pl; state.result = null;
    R.setKey(pl.piece.tonicHz);
    if (mode === 'learn') learnStep(pl, true);
    else if (mode === 'perform') append(pl, [{ kind: 'count' }, { kind: 'play', b0: 0, b1: phraseBeats(pl.piece) * 4 }], { kind: 'whole' });
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('song_start', { piece: pl.piece.id, mode });
  }
  function pausePlay() {
    const pl = state.pl; if (!pl || pl.paused || pl.over) return;
    pl.paused = true; R.flush(); ptrs.clear(); state.tv = [];
    while (pl.si > 0 && pl.ev[pl.si - 1].t > pl.t) pl.si -= 1;
  }
  function resumePlay() {
    const pl = state.pl; if (!pl) return;
    pl.paused = false; pl.resync = true; pl.revive = true;
  }
  function truncateFuture(pl) {
    let k = pl.ev.length; while (k > 0 && pl.ev[k - 1].t > pl.t) k -= 1;
    pl.ev.length = k; pl.si = Math.min(pl.si, k);
    for (let p = 0; p < NPART; p++) { pl.nd[p] = pl.nd[p].filter((n) => n.t <= pl.t); pl.np[p] = Math.min(pl.np[p], pl.nd[p].length); }
    pl.notes = pl.notes.filter((n) => n.t <= pl.t); pl.rests = pl.rests.filter((r) => r.t <= pl.t);
    pl.bars = pl.bars.filter((b) => b.t <= pl.t); pl.segs = pl.segs.filter((g) => g.t0 <= pl.t); pl.endT = pl.t;
    R.flush(); pl.resync = true;
  }
  function listenAgain() {
    const pl = state.pl;
    if (!pl || pl.mode !== 'learn' || pl.learn.final || pl.paused || pl.over) return;
    if (pl.cur) pl.cur.cancel = true;
    truncateFuture(pl); pl.endT = pl.t + beatOf(pl) * 1.5;
    learnStep(pl, false); say('Listen again', 1.4);
  }

  // ---- the voices ----------------------------------------------------------------------------------------------------------------------
  const refCents = (pl, p) => {
    const arr = pl.nd[p];
    for (let i = pl.np[p]; i < arr.length; i++) { const n = arr[i]; if (n.t + n.dur > pl.t) return n.c; }
    return pl.vs[p].disp ?? (arr.length ? arr[arr.length - 1].c : 0);
  };
  const partOf = (p) => { for (const q of ptrs.values()) if (q.part === p) return q; return null; };
  const syllableOf = (pl, p) => {
    const arr = pl.nd[p];
    for (let i = Math.max(0, pl.np[p] - 1); i < arr.length; i++) { const n = arr[i]; if (n.t + n.dur > pl.t - 0.05) return n.syl; }
    return 'na';
  };

  function pdown(id, x, y) {
    const sc = state.scene;
    if (sc !== 'play' && sc !== 'lab') return false;
    const P = stage();
    for (const r of [P.pause, P.hint, P.exit, P.scale, P.drone]) if (r && inRect(r, x, y)) return false;
    if (!inRect(P.field, x, y)) return false;
    let can, ref;
    if (sc === 'play') {
      const pl = state.pl;
      if (!pl || pl.paused || pl.over || pl.mode === 'auto') return false;
      can = pl.can.map((v, p) => v && !partOf(p)); ref = [0, 1, 2].map((p) => refCents(pl, p));
    } else {
      const lab = state.lab;
      can = [!lab.drone && !partOf(0), !partOf(1), !partOf(2)]; ref = [0, 1, 2].map((p) => lab.vs[p].disp ?? LAB_REF[p]);
    }
    const part = pin >= 0 && can[pin] ? pin : nearestPart(ref, can, cOfY(y));
    if (part < 0) return false;
    ptrs.set(id, { part, x, y });
    syncTv();
    if (state.prefs.haptics) R.haptic?.(4);
    return true;
  }
  function pmove(id, x, y) { const p = ptrs.get(id); if (!p) return; p.x = x; p.y = y; syncTv(); }
  function pup(id) { ptrs.delete(id); syncTv(); }

  // One voice's pitch for this frame from its finger. Returns cents or null.
  const fingerCents = (p, lines, pull) => { const q = partOf(p); return q ? assist(cOfY(q.y), lines, pull) : null; };

  const popAt = (sess, p, text, col, size = 34) => {
    sess.pops = sess.pops.filter((q) => q.p !== p);
    sess.pops.push({ p, text, col, size, age: 0 });
  };

  // ---- judging -----------------------------------------------------------------------------------------------------------------------
  function finalizeNote(pl, n) {
    if (n.who !== 'note' || n.j) return;
    const grace = Math.min(JUDGE.grace, n.dur * 0.4), eff = Math.max(0.1, n.dur - grace);
    const cov = Math.min(1, (n.inT + n.nearT * JUDGE.nearWeight) / eff);
    let g = 'miss';
    if (cov >= JUDGE.perfectCov && n.lat !== undefined && n.lat <= JUDGE.perfectLat + n.dur * 0.05) g = 'perfect';
    else if (cov >= JUDGE.greatCov) g = 'great';
    else if (cov >= JUDGE.goodCov) g = 'good';
    else if (cov >= JUDGE.offCov) g = 'off';
    n.j = g; n.cov = cov;
    const beats = n.dur / beatSec(pl.piece, pl.speed);
    const k = RESONANCE.mult(pl.res) * PARTS_K[Math.max(1, pl.can.filter(Boolean).length)] * (n.cad ? CADENCE_K : 1) * (0.6 + 0.4 * Math.min(beats, 4) / 4);
    const pts = Math.round(SCORE[g] * k);
    pl.score += pts; pl.counts[g] += 1; pl.accSum += WEIGHT[g]; pl.accN += 1;
    const ch = pl.chunks[n.ch]; if (ch) { ch.sum += WEIGHT[g]; ch.n += 1; }
    if (g === 'miss') pl.streak = 0; else pl.streak += 1;
    if (n.cad) { const c = pl.cads[n.ph] ?? (pl.cads[n.ph] = { need: 0, good: 0 }); c.need += 1; if (g === 'perfect' || g === 'great') c.good += 1; }
    popAt(pl, n.part, comboLabel(g), GRADE_COL[g], g === 'perfect' ? 40 : 34);
    if ((g === 'perfect' || g === 'great') && !state.prefs.calm) {
      const x = lay().play.playX, y = pitchY(lay().play.field, pl.win, n.c);
      burst(pl.parts, rng, x, y, g === 'perfect' ? 9 : 5, 1, PARTS[n.part].hi);
    }
  }
  function judgeStep(pl, dt) {
    const tol = tolerance(pl.win);
    // pitches of the player's voices this frame
    for (let p = 0; p < NPART; p++) {
      const vs = pl.vs[p], playable = pl.can[p] && pl.mode !== 'auto';
      const c = playable ? fingerCents(p, pl.lines, tol.pull) : null;
      vs.c = c; vs.on = c !== null;
      vs.amp += ((vs.on ? 1 : 0) - vs.amp) * Math.min(1, dt * 14);
      if (R.available && playable) R.live(p, vs.on ? hzOf(pl.piece.tonicHz, c) : null, syllableOf(pl, p), 1);
    }
    // the current note of each part; accumulate time in tune on judged notes
    for (let p = 0; p < NPART; p++) {
      const arr = pl.nd[p], vs = pl.vs[p];
      let n = arr[pl.np[p]];
      while (n && n.t + n.dur <= pl.t) { finalizeNote(pl, n); pl.np[p] += 1; n = arr[pl.np[p]]; }
      const act = n && n.t <= pl.t ? n : null;
      pl.now[p] = act;
      vs.ok = false; vs.err = null;
      if (act && act.who === 'note' && vs.c !== null) {
        const err = Math.abs(vs.c - act.c); vs.err = vs.c - act.c;
        if (err <= tol.lock) { act.inT += dt; vs.ok = true; if (act.lat === undefined) act.lat = pl.t - act.t; }
        else if (err <= tol.near) { act.nearT += dt; if (act.lat === undefined) act.lat = pl.t - act.t; }
      }
    }
    // breaths: a long rest of the player's voice should be silent
    for (const r of pl.rests) {
      if (r.done) continue;
      const a = r.t + BREATH.lead, b = r.t + r.dur - BREATH.tail;
      if (pl.t >= a && pl.t <= b && pl.vs[r.part].on) r.sung += dt;
      if (pl.t >= r.t + r.dur) {
        r.done = true; const broken = r.sung > BREATH.maxSung;
        pl.accN += 1; if (!broken) { pl.accSum += 1; pl.breathKept += 1; } else pl.breathBroken += 1;
        const ch = pl.chunks[r.ch]; if (ch) { ch.n += 1; if (!broken) ch.sum += 1; }
        popAt(pl, r.part, broken ? 'BREATH' : 'BREATHED', broken ? '#ff9a8a' : '#cfeee8', 28);
      }
    }
    // the chord lock: every sounding voice in tune together
    let sounding = 0, allIn = true;
    for (let p = 0; p < NPART; p++) {
      const n = pl.now[p]; if (!n) continue;
      sounding += 1;
      if (n.who === 'note' && !pl.vs[p].ok) allIn = false;
    }
    pl.locked = sounding > 0 && allIn;
    // resonance only builds while the player's voices are being judged (Sing, the echo of Learn); Listen and Watch only show the lock
    const seg = pl.segs.find((s) => pl.t >= s.t0 && pl.t < s.t1);
    const scoring = !!seg && (seg.kind === 'play' || seg.kind === 'echo');
    if (scoring && sounding > 0) {
      if (pl.locked) {
        pl.unl = 0; pl.lockHold += dt; pl.broke = false;
        if (pl.lockHold >= RESONANCE.lockHold) { pl.lockRun += dt; pl.lockT += dt; }
      } else {
        pl.lockHold = 0; pl.unl += dt;
        if (pl.unl >= RESONANCE.breakAfter && !pl.broke) { pl.broke = true; pl.lockRun = Math.max(0, pl.lockRun - RESONANCE.step); }
      }
    }
    pl.res = Math.min(RESONANCE.max, 1 + Math.floor(pl.lockRun / RESONANCE.step));
    if (pl.res > pl.maxRes) { pl.maxRes = pl.res; if (pl.res >= 2) pl.banner = { text: pl.res >= RESONANCE.max ? 'THE HALL RINGS' : 'RESONANCE x' + pl.res, t: 0 }; }
    const base = scoring ? ((pl.res - 1) / (RESONANCE.max - 1)) * 0.8 : 0.1;
    pl.glow += (base + (pl.locked ? (scoring ? 0.2 : 0.45) : 0) - pl.glow) * Math.min(1, dt * 3);
    if (R.available) R.lock(pl.locked && pl.res >= 2 ? (pl.res - 1) / (RESONANCE.max - 1) : 0);
  }

  // ---- per-tick play update ----------------------------------------------------------------------------------------------------------
  const velOf = (pl, e) => (e.k === 'guide' ? 0.3 : 0.62 + 0.07 * (pl.res - 1));
  function soundNote(pl, e, from) {
    const n = e.n, t = Math.max(n.t, from), dur = n.t + n.dur - t;
    if (dur > 0.05) R.sing(n.part, hzOf(pl.piece.tonicHz, n.c), n.syl, t, dur, velOf(pl, e));
  }
  function stepAnim(pl, dt) {
    for (const p of pl.pops) p.age += dt;
    pl.pops = pl.pops.filter((p) => p.age < 0.9);
    stepParticles(pl.parts, dt);
    pl.pulse = Math.max(0, pl.pulse - dt * 4);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 1.7) pl.banner = null; }
    pl.hintT = Math.max(0, pl.hintT - dt);
    // where each voice has been (the trail left of the now line)
    for (let p = 0; p < NPART; p++) {
      const vs = pl.vs[p], tr = pl.trail[p], c = vs.on ? vs.c : pl.now[p] && (!pl.can[p] || pl.mode === 'auto') ? vs.disp : null;
      if (c !== null && c !== undefined) { tr.push({ t: pl.t, c }); }
      while (tr.length && tr[0].t < pl.t - 1.8) tr.shift();
    }
    // a friend's bead glides to its note; the player's lifted bead waits at its next note
    for (let p = 0; p < NPART; p++) {
      const vs = pl.vs[p], n = pl.now[p];
      if (!pl.can[p] || pl.mode === 'auto') {
        const target = n ? n.c : vs.disp;
        if (target !== null && target !== undefined) vs.disp = vs.disp === null ? target : vs.disp + (target - vs.disp) * Math.min(1, dt * 16);
        vs.amp += ((n ? 1 : 0) - vs.amp) * Math.min(1, dt * 10);
      } else if (vs.c !== null) vs.disp = vs.c;
      else {
        const nx = n ?? pl.nd[p][pl.np[p]];
        if (vs.disp === null && nx) vs.disp = nx.c;
        else if (nx && vs.disp !== null) vs.disp += (nx.c - vs.disp) * Math.min(1, dt * 3);
      }
    }
    if (!state.prefs.calm) {
      pl.amb -= dt;
      if (pl.amb <= 0) {
        pl.amb = rng.range(0.8, 1.8); const F = lay().play.field;
        pl.parts.push({ x: F.x + rng.range(0, F.w), y: F.y + F.h * rng.range(0.3, 1), vx: rng.range(-8, 8), vy: rng.range(-26, -10), life: 5, max: 5, size: rng.range(1.6, 3.2), c: 'rgba(255,214,150,0.55)', g: 0 });
      }
    }
  }
  function autoStep(pl, dt, tap) {
    const a = pl.auto, P = lay().play;
    if (tap && inRect(P.hint, tap.x, tap.y)) a.timer = 0;
    a.timer -= dt;
    if (a.timer <= 0) {
      if (a.phase === 'think') { a.phase = 'reveal'; a.timer = THINK.reveal; a.total = THINK.reveal; }
      else if (a.phase === 'reveal') { a.phase = 'act'; autoPhrase(pl); pl.resync = true; }
    }
    stepAnim(pl, dt);
  }
  function updatePlay(dt, tap, input) {
    const pl = state.pl, P = lay().play;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    if (tap) {
      if (inRect(P.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (pl.mode === 'learn' && !pl.learn.final && inRect(P.hint, tap.x, tap.y)) { listenAgain(); return; }
      if (pl.mode !== 'auto' && inRect(P.hint, tap.x, tap.y)) { pl.hintT = 4; return; }
    }
    if (!R.available && pl.mode !== 'auto') pointerFallback(input);
    if (input.keys.pressed.has('Space') || input.keys.pressed.has('Escape')) { pausePlay(); return; }
    if (pl.auto && pl.auto.phase !== 'act') { autoStep(pl, dt, tap); return; }
    pl.t += dt;
    if (R.available) {
      R.sync(pl.t, pl.resync); pl.resync = false;
      if (pl.revive) {                                                                // after a pause: sing again the notes that are mid-way
        pl.revive = false;
        for (const e of pl.ev) if ((e.k === 'ens' || e.k === 'guide') && e.n.t <= pl.t && e.n.t + e.n.dur > pl.t + 0.1) soundNote(pl, e, pl.t + 0.02);
        while (pl.si < pl.ev.length && pl.ev[pl.si].t <= pl.t) pl.si += 1;
      }
    }
    const horizon = pl.t + LOOKAHEAD;
    while (pl.si < pl.ev.length && pl.ev[pl.si].t <= horizon) {
      const e = pl.ev[pl.si++];
      if (!state.prefs.sound) continue;
      if (e.k === 'click') R.click(e.accent, e.t); else soundNote(pl, e, e.t);
    }
    for (const e of pl.ev) if (e.k === 'click' && Math.abs(e.t - pl.t) < dt / 2) pl.pulse = e.accent ? 1 : 0.6;
    judgeStep(pl, dt);
    stepAnim(pl, dt);
    chunkLogic(pl);
  }
  function chunkLogic(pl) {
    const c = pl.cur;
    if (!(c && !c.done && !c.cancel && pl.t >= c.t1 + 0.25)) return;
    c.done = true;
    const acc = c.n ? c.sum / c.n : 1;
    if (pl.mode === 'auto') {
      pl.auto.k += 1;
      if (pl.auto.k >= 4) { pl.over = true; R.flush(); return; }
      pl.auto.phase = 'think'; pl.auto.timer = state.prefs.think; pl.auto.total = state.prefs.think; pl.auto.lines = describePhrase(pl.piece, pl.auto.k);
      R.flush(); pl.resync = true; return;
    }
    if (pl.mode === 'perform' || c.kind === 'final') { finishRun(); return; }
    const L = pl.learn;
    L.tries[c.phrase] = c.attempt;
    if (acc < LEARN.pass && L.attempt < LEARN.tries) { L.attempt += 1; pl.banner = { text: 'ONCE MORE', t: 0 }; }
    else { L.acc[c.phrase] = acc; L.phrase += 1; L.attempt = 1; if (L.phrase >= 4) L.final = true; pl.banner = { text: acc >= 0.75 ? 'LOVELY' : 'ON TO THE NEXT', t: 0 }; }
    pl.endT = Math.max(pl.endT, pl.t) + beatOf(pl);
    learnStep(pl, false);
  }
  // No audio engine (tests): the kit's one pointer is one finger.
  function pointerFallback(input) {
    const p = input.pointer;
    if (p.pressed) pdown(-1, p.x, p.y);
    if (p.down && ptrs.has(-1)) pmove(-1, p.x, p.y);
    if (!p.down && !p.pressed && ptrs.has(-1)) pup(-1);
  }

  function finishRun() {
    const pl = state.pl;
    const fc = pl.chunks.find((c) => c.kind === 'final' || c.kind === 'whole');
    const acc = fc && fc.n ? fc.sum / fc.n : 0, stars = accuracyToStars(acc);
    const id = pl.piece.id, old = state.best[id] ?? {};
    const cs = Object.values(pl.cads).filter((c) => c.need > 0), cadTotal = cs.length, cadHeld = cs.filter((c) => c.good === c.need).length;
    const res = {
      piece: pl.pi, mode: pl.mode, score: pl.score, acc, stars, grade: gradeOf(acc), maxRes: pl.maxRes, lockT: pl.lockT, counts: { ...pl.counts },
      cadHeld, cadTotal, breathKept: pl.breathKept, breathBroken: pl.breathBroken, parts: pl.can.slice(), learn: pl.learn ? { acc: [...pl.learn.acc], tries: [...pl.learn.tries] } : null, newBest: false,
    };
    if (pl.mode === 'perform') {
      res.newBest = !old.score || pl.score > old.score;
      state.best[id] = { ...old, score: Math.max(old.score || 0, pl.score), acc: Math.max(old.acc || 0, acc), stars: Math.max(old.stars || 0, stars), res: Math.max(old.res || 0, pl.maxRes) };
    } else state.best[id] = { ...old, learn: Math.max(old.learn || 0, stars) };
    storage.set('best', state.best);
    env.monetization.track?.('song_end', { piece: id, mode: pl.mode, stars });
    R.flush(); ptrs.clear(); state.tv = []; pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  function pauseItems(pl) {
    return pl.over ? ['again', 'next', 'exit'] : pl.mode === 'learn' && !pl.learn.final ? ['resume', 'listen', 'restart', 'quit'] : pl.mode === 'auto' ? ['resume', 'next', 'quit'] : ['resume', 'restart', 'quit'];
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
      else if (it === 'next') { state.sel = (state.sel + 1) % PIECES.length; startPlay('auto'); }
      else go('piece');
    });
  }

  // ---- Harmony Lab -----------------------------------------------------------------------------------------------------------------
  function startLab() {
    if (config.demo && state.demoRuns >= DEMO_RUNS) { go('demo-limit'); return; }
    if (config.demo) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush(); ptrs.clear(); state.tv = [];
    state.lab = { t: 0, scale: state.prefs.scale, drone: true, vs: [newVS(), newVS(), newVS()], pops: [], parts: [], trail: [[], [], []], glow: 0.1, pure: false, info: [], droneAt: 0, locked: false, pureT: 0, amb: 1 };
    R.setKey(LAB_TONIC);
    state.scene = 'lab'; state.sceneT = 0;
  }
  function updateLab(dt, tap, input) {
    const lab = state.lab, P = lay().lab;
    if (tap) {
      if (inRect(P.exit, tap.x, tap.y)) { go('title'); return; }
      if (inRect(P.scale, tap.x, tap.y)) {
        const i = SCALE_LIST.findIndex((q) => q.id === lab.scale); lab.scale = SCALE_LIST[(i + 1) % SCALE_LIST.length].id;
        state.prefs.scale = lab.scale; storage.set('prefs', state.prefs); say(`${scaleOf(lab.scale).name}: ${scaleOf(lab.scale).blurb}`, 2.4);
      } else if (inRect(P.drone, tap.x, tap.y)) {
        lab.drone = !lab.drone; R.flush(); lab.droneAt = lab.t;
        for (const [id, q] of ptrs) if (q.part === 0 && lab.drone) ptrs.delete(id);
        syncTv();
      }
    }
    if (input.keys.pressed.has('Escape')) { go('title'); return; }
    if (!R.available) pointerFallback(input);
    lab.t += dt;
    if (R.available) R.sync(lab.t, false);
    const sc = scaleOf(lab.scale), lines = ladderLines(sc, LAB_WIN.lo, LAB_WIN.hi), a = A();
    if (lab.drone && R.available && state.prefs.sound && lab.t >= lab.droneAt) { R.sing(0, hzOf(LAB_TONIC, -1200), 'o', lab.t + 0.01, 3.2, 0.55); lab.droneAt = lab.t + 3.1; }
    const cs = [null, null, null];
    for (let p = 0; p < NPART; p++) {
      const vs = lab.vs[p];
      if (p === 0 && lab.drone) { vs.c = -1200; vs.on = true; vs.disp = -1200; vs.amp += (1 - vs.amp) * Math.min(1, dt * 6); cs[0] = -1200; continue; }
      const c = fingerCents(p, lines, a.pull);
      vs.c = c; vs.on = c !== null; vs.amp += ((vs.on ? 1 : 0) - vs.amp) * Math.min(1, dt * 14);
      if (c !== null) { vs.disp = c; cs[p] = c; }
      if (R.available) R.live(p, c === null ? null : hzOf(LAB_TONIC, c), p === 0 ? 'o' : p === 1 ? 'a' : 'e', 1);
    }
    // the intervals between the voices that sound, lowest to highest
    const ids = [0, 1, 2].filter((p) => cs[p] !== null).sort((x, y) => cs[x] - cs[y]);
    lab.info = [];
    for (let i = 0; i + 1 < ids.length; i++) {
      const lo = ids[i], hi = ids[i + 1], iv = nearestInterval(cs[hi] - cs[lo]);
      const f1 = hzOf(LAB_TONIC, cs[lo]), f2 = hzOf(LAB_TONIC, cs[hi]), beat = Math.abs(iv.b * f2 - iv.a * f1);
      lab.info.push({ lo, hi, name: iv.name, ratio: iv.ratio, off: iv.off, ok: iv.ok, pure: iv.ok && Math.abs(iv.off) <= 9, beat });
    }
    lab.pure = lab.info.length > 0 && lab.info.every((q) => q.pure);
    lab.pureT = lab.pure ? lab.pureT + dt : 0;
    lab.locked = lab.pureT > 0.3;
    lab.glow += ((lab.locked ? 0.95 : 0.15) - lab.glow) * Math.min(1, dt * 3);
    if (R.available) R.lock(lab.locked ? 0.9 : 0);
    for (let p = 0; p < NPART; p++) {
      const tr = lab.trail[p], v = lab.vs[p];
      if (v.on && v.c !== null) tr.push({ t: lab.t, c: v.c });
      while (tr.length && tr[0].t < lab.t - 1.8) tr.shift();
    }
    for (const p of lab.pops) p.age += dt;
    lab.pops = lab.pops.filter((p) => p.age < 0.9);
    stepParticles(lab.parts, dt);
    if (!state.prefs.calm) {
      lab.amb -= dt;
      if (lab.amb <= 0) {
        lab.amb = rng.range(0.7, 1.5); const F = lay().lab.field;
        lab.parts.push({ x: F.x + rng.range(0, F.w), y: F.y + F.h * rng.range(0.3, 1), vx: rng.range(-8, 8), vy: rng.range(-26, -10), life: 5, max: 5, size: rng.range(1.6, 3.2), c: 'rgba(255,214,150,0.55)', g: 0 });
      }
    }
  }

  // ---- menus and documents ----------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'assist') p.assistIdx = (p.assistIdx + 1) % ASSIST.length;
    else if (id === 'guide') p.guide = !p.guide;
    else if (id === 'haptics') p.haptics = !p.haptics;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'thinkDec') p.think = Math.max(THINK.min, p.think - 1);
    else if (id === 'thinkInc') p.think = Math.min(THINK.max, p.think + 1);
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
    else if (hit(T.free)) startLab();
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
    const D = lay().piece, pr = state.prefs;
    if (inRect(D.back, tap.x, tap.y)) go('songs');
    else if (inRect(D.learn, tap.x, tap.y)) startPlay('learn');
    else if (inRect(D.perform, tap.x, tap.y)) startPlay('perform');
    else if (inRect(D.watch, tap.x, tap.y)) startPlay('auto');
    else {
      D.parts.forEach((r, i) => {
        if (!inRect(r, tap.x, tap.y)) return;
        const next = pr.parts.slice(); next[i] = !next[i];
        if (next.some(Boolean)) { pr.parts = next; savePrefs(); } else say('Sing at least one voice');
      });
    }
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) startPlay(state.result.mode);
    else if (inRect(Rr.songs, tap.x, tap.y)) go('songs');
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // ---- the object the kit and main.js see -----------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      if (devAuto) {                                                         // tester autopilot (?dev=1 with play): a perfect singer keeps going
        if (state.scene === 'play' && state.pl && !state.pl.paused && state.pl.mode !== 'auto') api.dev.sing(state.pl);
        else if (state.scene === 'lab') api.dev.labSing();
      }
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'play' || sc === 'lab') {                                  // keyboard: 1 / 2 / 3 pin the mouse to Bass / Middle / Top (again to unpin)
        ['Digit1', 'Digit2', 'Digit3'].forEach((code, i) => {
          if (!input.keys.pressed.has(code)) return;
          pin = pin === i ? -1 : i; say(pin < 0 ? 'The mouse sings the nearest voice' : `The mouse sings ${PARTS[i].name}`, 1.6);
        });
      } else pin = -1;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'songs') updateSongs(tap);
      else if (sc === 'piece') updatePiece(tap);
      else if (sc === 'play') updatePlay(dt, tap, input);
      else if (sc === 'lab') updateLab(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { ctx.clearRect(-2000, -2000, 6000, 6000); host.tz = TEXT_SCALES[state.prefs.textIdx] ?? 1; render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems, { tolerance, A: A(), yOfC }); },
    getState: () => state,
    // Multi-touch from main.js (the kit input only has one pointer). pdown returns true when the game used the touch.
    pdown, pmove, pup,
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except real singing is free: menus, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !((state.scene === 'play' && pl && pl.mode !== 'auto' && !pl.paused && !pl.over) || state.scene === 'lab');
    },
    yOfC: (c) => (state.scene === 'play' || state.scene === 'lab' ? yOfC(c) : 0),
    // Tester tools (?dev=1): jump to a screen and fast-forward. `play` sings every judged note perfectly.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.parts) state.prefs.parts = o.parts;
        if (o.piece !== undefined) state.sel = o.piece;
        const sc = o.scene ?? 'title';
        if (sc === 'play') startPlay(o.mode ?? 'perform');
        else if (sc === 'lab') { startLab(); if (o.scale) state.lab.scale = o.scale; }
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          state.sel = o.piece ?? 1; startPlay('perform'); const pl = state.pl;
          pl.score = 184250; pl.maxRes = 4; pl.lockT = 21.4; pl.counts = { perfect: 41, great: 17, good: 6, off: 2, miss: 1 }; pl.breathKept = 5; pl.breathBroken = 1;
          pl.cads = { 0: { need: 1, good: 1 }, 1: { need: 1, good: 1 }, 2: { need: 1, good: 0 }, 3: { need: 1, good: 1 } };
          pl.chunks[0].sum = 58; pl.chunks[0].n = 67; finishRun();
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) {
          devAuto = !!o.play && !o.release;
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) {
            api.update(1 / 60, idle);
          }
          if (o.release) { devAuto = false; api.dev.clear(); }
        }
      },
      // A perfect singer: every part the player sings is held on its current note (a finger per part).
      sing(pl) {
        const F = lay().play.field;
        for (let p = 0; p < NPART; p++) {
          if (!pl.can[p]) continue;
          const arr = pl.nd[p]; let n = null;
          for (let i = pl.np[p]; i < arr.length; i++) { if (arr[i].t + arr[i].dur > pl.t + 1 / 60) { n = arr[i]; break; } }
          const id = 900 + p;
          if (n && n.t - pl.t < 0.02) ptrs.set(id, { part: p, x: lay().play.playX, y: pitchY(F, pl.win, n.c) }); else ptrs.delete(id);
        }
        syncTv();
      },
      // The lab: middle on the tonic, top a major third above it (a pure chord with the drone).
      labSing() {
        const F = lay().lab.field, x = lay().lab.playX, lab = state.lab, st = scaleOf(lab.scale).steps;
        ptrs.set(901, { part: 1, x, y: pitchY(F, LAB_WIN, st[0]) });
        ptrs.set(902, { part: 2, x, y: pitchY(F, LAB_WIN, st[2]) });
        syncTv();
      },
      clear() { ptrs.clear(); syncTv(); },
    },
  };
  return api;
}
