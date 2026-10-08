// Koto: state and flow. Drawing is in view.js / playview.js / docview.js; the music and the rule constants are in music.js.
//
// Timing model: song time `pl.t` is the sum of the dt values handed to update() (deterministic, pausable). When the browser gives us an
// audio engine (env.rhythm, see web/audio/engine.js) accompaniment sounds are scheduled on the audio clock a little ahead of pl.t, and
// a player's touch is time-stamped on the audio clock and converted back to song time before it is judged. Headless runs have no
// engine: the same code runs with touches taken at the tick time.
//
// Strings run along the long side of the stage (see layout.js). A touch below a string's bridge plucks it, a touch above the bridge
// presses it (oshide), a drag across strings sweeps them. Pointers arrive through pdown / pmove / pup (main.js, multi-touch) or, with
// no engine (tests), through the kit's single pointer as plain taps.
import {
  NSTR, SCALES, scaleById, baseSemi, hzOf, bridgeU, semiFromU, GEO, PIECES, JUDGE, SWEEP_K, BEND_WINDOW, TIMING, SPEEDS, SCORE, WEIGHT, ENSEMBLE, LEARN, MA, THINK,
  LOOKAHEAD, buildRun, beatDur, accuracyToStars, gradeOf, comboMult, noteName,
} from './music.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, stringTouch, host } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const NO_RHYTHM = { available: false, play() { return null; }, click() {}, sync() {}, flush() {}, toSong: () => NaN, setMuted() {}, now: () => 0, haptic() {} };
const DEMO_RUNS = 6;
const KEYS = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'];
const GRADE_TEXT = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', off: 'NEAR', miss: 'MISS' };
const GRADE_COL = { perfect: '#ffe07a', great: '#8ef0dc', good: '#9fc4ff', off: '#d9b3ff', miss: '#ff7d8f' };
const TAU = Math.PI * 2;
const newSS = () => Array.from({ length: NSTR }, () => ({ vib: 0, ph: 0, glow: 0, press: 0, flash: 0, hit: -9 }));

export function createGame(env) {
  const { rng, storage, config } = env;
  const R = env.rhythm ?? NO_RHYTHM;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, speedIdx: 1, timingIdx: 1, labels: true, click: true, haptics: true, calm: false, textIdx: 0, cal: 0, autoSlow: false, think: THINK.def, scale: 'hirajoshi' },
    best: {}, demoRuns: 0, pl: null, free: null, cal: null, result: null, tv: [],
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    toast: null, dev: config.dev === true, demo: config.demo === true,
  };
  let lastScene = state.scene, drag = null;
  const voices = new Array(NSTR).fill(null);          // ringing strings of the player (audio handles; never part of the state)
  const ptrs = new Map();                              // active touches on the instrument

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = Math.min(Math.max(state.prefs.textIdx | 0, 0), TEXT_SCALES.length - 1); state.prefs.think = Math.min(THINK.max, Math.max(THINK.min, state.prefs.think | 0)); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { R.setMuted(!state.prefs.sound); env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => { host.tz = TEXT_SCALES[state.prefs.textIdx] ?? 1; return layoutFor(meta.width, meta.height); };
  const tk = () => TIMING[state.prefs.timingIdx].k;
  const approach = () => SPEEDS[state.prefs.speedIdx].approach;
  const go = (scene) => { if (state.scene === 'play' || state.scene === 'free' || state.scene === 'calib') { R.flush(); ptrs.clear(); state.tv = []; } state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  const songAt = (audioTime, fallback) => { const s = R.available ? R.toSong(audioTime) : NaN; return Number.isFinite(s) ? s : fallback; };

  // ---- tuning ------------------------------------------------------------------------------------------------------------------------
  const semiOf = (sess, s, press = 0) => baseSemi(scaleById(sess.scale), s) + (sess.tune ? sess.tune[s] : 0) + press;
  const bridgeArr = (sess) => Array.from({ length: NSTR }, (_, s) => bridgeU(semiOf(sess, s)));
  const instOf = () => (state.scene === 'free' ? lay().free.inst : lay().play.inst);
  const pressLevel = (sess, s) => {
    let lv = 0;
    for (const p of ptrs.values()) if (p.kind === 'press' && p.s === s && p.level > lv) lv = p.level;
    const kp = sess.kp?.[s]; if (kp && kp.until > sess.t) lv = Math.max(lv, kp.lvl);
    return lv;
  };
  const syncTv = () => { state.tv = [...ptrs.values()].filter((p) => p.x !== undefined).map((p) => ({ x: p.x, y: p.y, press: p.kind === 'press' })); };

  // ---- a play session ---------------------------------------------------------------------------------------------------------------------
  function newSess(extra) { return { t: 0, ss: newSS(), pops: [], parts: [], pulse: 0, banner: null, kp: {}, amb: 1, hintT: 0, ...extra }; }
  function newPlay(pieceIdx, mode) {
    const piece = PIECES[pieceIdx];
    return newSess({
      mode, pi: pieceIdx, piece, scale: piece.scale, tune: null, ev: [], nd: Array.from({ length: NSTR }, () => []), np: new Array(NSTR).fill(0), mas: [], mi: 0, pend: [], si: 0, fi: 0, endT: 0.5,
      bars: [], segs: [], chunks: [], cur: null, speed: mode === 'auto' && state.prefs.autoSlow ? 0.75 : 1,
      ens: mode === 'perform' ? ENSEMBLE.start : mode === 'auto' ? ENSEMBLE.max : 0, streak: 0, score: 0, combo: 0, maxCombo: 0,
      counts: { perfect: 0, great: 0, good: 0, off: 0, miss: 0 }, bends: 0, bendMiss: 0, still: 0, stillBroken: 0, accSum: 0, accN: 0, touches: [],
      paused: false, over: false, resync: true, layerFlash: 0, shake: 0,
      hand: { sf: 6, down: 0, e: null, on: false },
      learn: mode === 'learn' ? { phrase: 0, attempt: 1, final: false, acc: [], tries: [] } : null,
      auto: mode === 'auto' ? { phase: 'think', k: 0, timer: state.prefs.think, total: state.prefs.think } : null,
    });
  }
  function append(pl, segments, extra = {}) {
    const run = buildRun(pl.piece, segments, pl.endT, { speed: pl.speed });
    const id = pl.chunks.length, chunk = { id, t0: run.T0, t1: run.end, sum: 0, n: 0, done: false, ...extra };
    for (const e of run.events) {
      e.ch = id; pl.ev.push(e);
      if (e.who === 'note') { pl.nd[e.s].push(e); chunk.n += e.p ? 2 : 1; } else if (e.who === 'ma') { pl.mas.push(e); chunk.n += 1; }
    }
    pl.bars.push(...run.bars); pl.segs.push(...run.segs.map((g) => ({ ...g, ch: id })));
    pl.chunks.push(chunk); pl.cur = chunk; pl.endT = run.end;
    return chunk;
  }
  const beatOf = (pl) => beatDur(pl.piece, pl.speed);
  function learnStep(pl) {
    const L = pl.learn, b0 = L.phrase * 2;
    if (L.final) { pl.ens = ENSEMBLE.start; pl.streak = 0; return append(pl, [{ kind: 'count' }, { kind: 'play', b0: 0, b1: 8 }], { kind: 'final' }); }
    return append(pl, [{ kind: 'count' }, { kind: 'listen', b0, b1: b0 + 2 }, { kind: 'echo', b0, b1: b0 + 2 }], { kind: 'pair', phrase: L.phrase, attempt: L.attempt });
  }
  function autoPhrase(pl) {
    const k = pl.auto.k;
    pl.endT = pl.t + approach() + 0.35;
    return append(pl, [{ kind: 'auto', b0: k * 2, b1: k * 2 + 2 }], { kind: 'auto', phrase: k });
  }
  function startPlay(mode) {
    if (config.demo && mode !== 'auto' && (state.sel > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (config.demo && mode !== 'auto') { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush(); ptrs.clear(); state.tv = [];
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
    for (let s = 0; s < NSTR; s++) { pl.nd[s] = pl.nd[s].filter((n) => n.t <= pl.t); pl.np[s] = Math.min(pl.np[s], pl.nd[s].length); }
    pl.mas = pl.mas.filter((m) => m.t <= pl.t); pl.mi = Math.min(pl.mi, pl.mas.length);
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
  function ring(sess, s, power, by, px, py) {
    const st = sess.ss[s]; st.vib = Math.min(1, st.vib * 0.4 + power); st.glow = 1; st.flash = 1; st.hit = sess.t;
    if (!state.prefs.calm) {
      const inst = instOf(), p = px !== undefined ? { x: px, y: py } : inst.pt(GEO.uHit + 0.04, s);
      burst(sess.parts, rng, p.x, p.y, by === 'player' ? 7 : 4, power, inst.across);
    }
    if (by === 'player' && state.prefs.haptics) R.haptic?.(6);
  }
  const pop = (sess, s, text, col, size) => {
    const inst = instOf(), p = inst.pt(GEO.uHit - 0.045, s), S = lay().S;
    sess.pops = sess.pops.filter((q) => q.s !== s);
    sess.pops.push({ s, x: Math.max(S.x + 90, Math.min(S.x + S.w - 90, p.x)), y: p.y, text, col, size, age: 0 });
    if (sess.pops.length > 12) sess.pops.shift();
  };

  // ---- judging -------------------------------------------------------------------------------------------------------------------------------------
  const win = (n) => { const k = tk() * (n.sw ? SWEEP_K : 1); return { p: JUDGE.perfect * k, g: JUDGE.great * k, o: JUDGE.good * k }; };
  function judgeNote(pl, n, tAdj, near) {
    const w = win(n), err = Math.abs(n.t - tAdj);
    let g = err <= w.p ? 'perfect' : err <= w.g ? 'great' : 'good';
    if (near) g = 'off';
    n.j = g; n.err = tAdj - n.t;
    pl.score += SCORE[g] * comboMult(pl.combo); pl.combo += 1; pl.maxCombo = Math.max(pl.maxCombo, pl.combo);
    pl.counts[g] += 1; pl.accSum += WEIGHT[g]; pl.accN += 1; pl.streak += 1;
    const ch = pl.chunks[n.ch]; if (ch) ch.sum += WEIGHT[g];
    if (pl.mode === 'perform' || (pl.learn && pl.learn.final)) {
      if (pl.streak % ENSEMBLE.every === 0 && pl.ens < ENSEMBLE.max) { pl.ens += 1; pl.layerFlash = 1; pl.banner = { text: pl.ens === 1 ? 'A SECOND KOTO JOINS' : 'THE ROOM FILLS WITH SOUND', t: 0 }; }
    }
    if (!(n.sw && n.si > 0)) pop(pl, n.s, GRADE_TEXT[g], GRADE_COL[g], g === 'perfect' ? 40 : 34);
    if (n.p > 0) { n.pend = pl.t + BEND_WINDOW; pl.pend.push(n); }
  }
  function missNote(pl, n) {
    n.j = 'miss'; pl.counts.miss += 1; pl.accN += n.p ? 2 : 1; pl.combo = 0; pl.streak = 0;
    if (pl.mode === 'perform' || (pl.learn && pl.learn.final)) pl.ens = Math.max(0, pl.ens - 1);
    if (!(n.sw && n.si > 0)) pop(pl, n.s, 'MISS', GRADE_COL.miss, 30);
  }
  function findNote(pl, s, tAdj) {
    const arr = pl.nd[s]; let best = null;
    for (let i = pl.np[s]; i < arr.length; i++) {
      const n = arr[i]; if (n.t > tAdj + win(n).o) break;
      if (n.j) continue;
      const e = Math.abs(n.t - tAdj); if (e <= win(n).o && (!best || e < Math.abs(best.t - tAdj))) best = n;
    }
    return best;
  }
  function judgePluck(pl, s, tSong) {
    pl.touches.push(pl.t); if (pl.touches.length > 24) pl.touches.shift();
    if (pl.mode === 'auto' || pl.paused || pl.over) return;
    const tAdj = tSong - state.prefs.cal / 1000;
    let note = findNote(pl, s, tAdj), near = false;
    if (!note) {                                                    // a neighbouring string at the right moment counts a little
      let bestE = 9;
      for (const d of [-1, 1]) { const q = s + d; if (q < 0 || q >= NSTR) continue; const m = findNote(pl, q, tAdj); if (m) { const e = Math.abs(m.t - tAdj); if (e < bestE) { bestE = e; note = m; near = true; } } }
    }
    if (note) judgeNote(pl, note, tAdj, near);
  }
  // A string is plucked by the player (touch, drag or key).
  function pluckAt(sess, s, tSong, px, py) {
    const lvl = pressLevel(sess, s), semi = semiOf(sess, s, lvl);
    if (state.prefs.sound) { const h = R.play(s, hzOf(semi), 0.9, null); if (h) voices[s] = { h, lvl, t0: sess.t }; }
    ring(sess, s, 1, 'player', px, py);
    sess.ss[s].press = lvl;
    if (sess === state.pl) judgePluck(sess, s, tSong); else sess.hits = (sess.hits ?? 0) + 1;
  }

  // ---- pointers on the instrument ------------------------------------------------------------------------------------------------------------------------
  const uiRects = () => { if (state.scene === 'play') { const P = lay().play; return [P.pause, P.hint]; } const F = lay().free; return [F.exit, F.scale, F.reset]; };
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
    const inst = instOf(), bu = bridgeArr(sess), tt = stringTouch(inst, x, y, (s) => bu[s]);
    if (!tt) return false;
    const tSong = sc === 'play' ? songAt(audioTime, sess.t) : sess.t;
    if (sc === 'free' && tt.u > tt.b - 0.035 && tt.u < tt.b + 0.012 && Math.abs(tt.sf - tt.s) < 0.45) {
      ptrs.set(id, { kind: 'bridge', s: tt.s, grab: tt.u - tt.b, x, y, moved: false, y0: x * inst.along.x + y * inst.along.y });
    } else if (tt.zone === 'pluck') {
      ptrs.set(id, { kind: 'pluck', s: tt.s, cur: tt.s, sf: tt.sf, x, y });
      pluckAt(sess, tt.s, tSong, x, y);
    } else {
      ptrs.set(id, { kind: 'press', s: tt.s, level: tt.press, x, y });
      if (sess === state.pl) { sess.touches.push(sess.t); if (sess.touches.length > 24) sess.touches.shift(); }
      if (state.prefs.haptics) R.haptic?.(4);
    }
    syncTv();
    return true;
  }
  function pmove(id, x, y, audioTime) {
    const p = ptrs.get(id); if (!p) return;
    const sess = playable(); if (!sess) { ptrs.delete(id); syncTv(); return; }
    const inst = instOf(), bu = bridgeArr(sess), tSong = state.scene === 'play' ? songAt(audioTime, sess.t) : sess.t;
    const now = inst.uv(x, y);
    if (p.kind === 'pluck') {
      const prev = p.sf, sf = now.sf, up = sf > prev, ks = [];
      for (let k = Math.ceil(Math.min(prev, sf)); k <= Math.floor(Math.max(prev, sf)); k++) if (k >= 0 && k < NSTR && k !== p.cur && (up ? k > prev && k <= sf : k < prev && k >= sf)) ks.push(k);
      if (!up) ks.reverse();
      for (const k of ks) {
        if (now.u < bu[k]) continue;                               // the finger is behind that string's bridge: no pluck
        p.cur = k; pluckAt(sess, k, tSong, x, y);
      }
      p.sf = sf;
    } else if (p.kind === 'press') {
      const s = Math.max(0, Math.min(NSTR - 1, Math.round(now.sf)));
      p.s = s; const b = bu[s]; p.level = now.u >= b ? 0 : b - now.u <= GEO.halfBand ? 1 : 2;
    } else if (p.kind === 'bridge') {
      const along = x * inst.along.x + y * inst.along.y;
      if (Math.abs(along - p.y0) > 8) p.moved = true;
      if (p.moved) {
        const sc = scaleById(sess.scale), want = Math.round(semiFromU(now.u - p.grab)) - baseSemi(sc, p.s), v = Math.max(GEO.tune[0], Math.min(GEO.tune[1], want));
        if (v !== sess.tune[p.s]) {
          sess.tune[p.s] = v; sess.custom = true; const semi = semiOf(sess, p.s);
          if (state.prefs.sound) R.play(p.s, hzOf(semi), 0.55, null);
          ring(sess, p.s, 0.5, 'player'); sess.label = { s: p.s, text: noteName(semi), t: 0 };
          if (state.prefs.haptics) R.haptic?.(3);
        }
      }
    }
    p.x = x; p.y = y; syncTv();
  }
  function pup(id) { ptrs.delete(id); syncTv(); }

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
    const bend = e.p ? { semi: e.p, at: Math.min(0.16, e.dur * 0.35), glide: 0.24 } : null;
    R.play(e.s, hzOf(semiOf(pl, e.s)), e.who === 'ens' ? e.vel : e.vel * 0.9, e.t, bend);
  }
  function stepAnim(sess, dt) {
    for (let s = 0; s < NSTR; s++) {
      const st = sess.ss[s];
      st.vib = st.vib * Math.exp(-dt * (1.15 + s * 0.07)); if (st.vib < 0.01) st.vib = 0;
      st.ph = (st.ph + dt * (46 + s * 2.4)) % TAU; st.glow = Math.max(0, st.glow - dt * 2.6); st.flash = Math.max(0, st.flash - dt * 4);
      const lv = pressLevel(sess, s);
      if (lv !== st.press) {
        if (voices[s] && sess.t - voices[s].t0 < 3) voices[s].h.bend(lv - voices[s].lvl, 0.1);
        st.press = lv;
      }
    }
    for (const p of sess.pops) p.age += dt;
    sess.pops = sess.pops.filter((p) => p.age < 0.8);
    stepParticles(sess.parts, dt);
    sess.pulse = Math.max(0, sess.pulse - dt * 4); sess.shake = Math.max(0, (sess.shake || 0) - dt * 4); sess.layerFlash = Math.max(0, (sess.layerFlash || 0) - dt * 1.5);
    if (sess.banner) { sess.banner.t += dt; if (sess.banner.t > 1.6) sess.banner = null; }
    if (sess.label) { sess.label.t += dt; if (sess.label.t > 1.4) sess.label = null; }
    sess.hintT = Math.max(0, (sess.hintT || 0) - dt);
    if (!state.prefs.calm) {                                       // a few petals drifting through the room
      sess.amb -= dt;
      if (sess.amb <= 0) {
        sess.amb = rng.range(1.4, 3.0); const S = lay().S;
        sess.parts.push({ x: S.x + rng.range(0, S.w), y: S.y + rng.range(0, 60), vx: rng.range(-20, 20), vy: rng.range(20, 50), life: 9, max: 9, size: rng.range(6, 10), c: '#ffc2d4', petal: true, rot: rng.range(0, 6), spin: rng.range(-1.5, 1.5), g: 6 });
      }
    }
  }
  // the teacher's hand follows the next teacher / hint event
  function stepHand(pl, dt) {
    const h = pl.hand; let e = null;
    const wantTeach = pl.mode === 'auto' || (pl.mode === 'learn' && !pl.learn.final), wantHint = pl.hintT > 0;
    if (wantTeach || wantHint) {
      for (let i = Math.max(0, pl.fi - 2); i < pl.ev.length; i++) {
        const q = pl.ev[i]; if (q.t < pl.t - 0.2) continue;
        if ((wantTeach && q.who === 'teach') || (wantHint && q.who === 'note' && !q.j)) { e = q; break; }
        if (q.t > pl.t + 4) break;
      }
    }
    if (e) { h.sf += (e.s - h.sf) * Math.min(1, dt * 14); h.e = e; h.on = true; } else { h.e = null; h.on = false; }
    if (e && Math.abs(e.t - pl.t) < 0.09) h.down = 1;
    h.down = Math.max(0, h.down - dt * 7);
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
    pl.hand.e = null; pl.hand.on = false;
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
      if (e.on && state.prefs.sound && e.who !== 'note' && e.who !== 'ma' && e.who !== 'mat') soundEvent(pl, e);
    }
    while (pl.fi < pl.ev.length && pl.ev[pl.fi].t <= pl.t) {
      const e = pl.ev[pl.fi++];
      if (e.on === undefined) e.on = evOn(pl, e);
      if (e.who === 'click') { if (e.on) pl.pulse = e.k === 'accent' ? 1 : 0.6; continue; }
      if (e.who === 'note' || e.who === 'ma' || e.who === 'mat' || !e.on) continue;
      ring(pl, e.s, e.who === 'ens' ? 0.35 : 0.9, 'ens');
    }
    // notes nobody played
    for (let s = 0; s < NSTR; s++) {
      const arr = pl.nd[s];
      while (pl.np[s] < arr.length) {
        const n = arr[pl.np[s]];
        if (n.j) { pl.np[s] += 1; continue; }
        if (n.t + win(n).o + state.prefs.cal / 1000 < pl.t) { missNote(pl, n); pl.np[s] += 1; } else break;
      }
    }
    // bends (oshide) that were asked for
    for (let i = pl.pend.length - 1; i >= 0; i--) {
      const n = pl.pend[i];
      if (pressLevel(pl, n.s) === n.p) {
        pl.pend.splice(i, 1); pl.bends += 1; pl.score += SCORE.bend * comboMult(pl.combo); pl.accSum += 1; pl.accN += 1;
        const ch = pl.chunks[n.ch]; if (ch) ch.sum += 1;
        pop(pl, n.s, 'BEND', '#f6d98a', 34);
      } else if (pl.t > n.pend) { pl.pend.splice(i, 1); pl.bendMiss += 1; pl.accN += 1; pop(pl, n.s, 'FLAT', '#ff9a8a', 28); }
    }
    // silences (ma)
    while (pl.mi < pl.mas.length && pl.mas[pl.mi].t + pl.mas[pl.mi].dur - MA.tail <= pl.t) {
      const m = pl.mas[pl.mi++], a = m.t + MA.lead, b = m.t + m.dur - MA.tail, broke = pl.touches.some((q) => q >= a && q <= b);
      const ch = pl.chunks[m.ch];
      if (!broke) { m.j = 'still'; pl.still += 1; pl.score += SCORE.ma * comboMult(pl.combo); pl.accSum += 1; pl.accN += 1; if (ch) ch.sum += 1; pl.banner = { text: 'MA', t: 0, tea: true }; }
      else { m.j = 'broken'; pl.stillBroken += 1; pl.accN += 1; }
    }
    stepAnim(pl, dt); stepHand(pl, dt);
    // chunk logic: what happens when a call-and-response pair, a whole piece or the final take is over
    const c = pl.cur;
    if (c && !c.done && !c.cancel && pl.t >= c.t1 + 0.2) {
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
  function keysTick(sess, input) {
    const k = input.keys, lvl = k.down.has('ShiftLeft') || k.down.has('ShiftRight') ? 1 : k.down.has('ControlLeft') || k.down.has('ControlRight') ? 2 : 0;
    for (let s = 0; s < NSTR; s++) {
      if (!k.pressed.has(KEYS[s])) continue;
      if (lvl) sess.kp[s] = { lvl, until: sess.t + BEND_WINDOW + 0.3 };
      pluckAt(sess, s, sess.t);
    }
  }

  function finishRun() {
    const pl = state.pl;
    const fc = pl.chunks.find((c) => c.kind === 'final' || c.kind === 'whole');
    const acc = fc && fc.n ? fc.sum / fc.n : 0, stars = accuracyToStars(acc);
    const id = pl.piece.id, old = state.best[id] ?? {};
    const res = { piece: pl.pi, mode: pl.mode, score: pl.score, acc, stars, grade: gradeOf(acc), maxCombo: pl.maxCombo, counts: { ...pl.counts }, bends: pl.bends, bendMiss: pl.bendMiss, still: pl.still, stillBroken: pl.stillBroken, learn: pl.learn ? { acc: [...pl.learn.acc], tries: [...pl.learn.tries] } : null, newBest: false };
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
    R.flush(); ptrs.clear(); state.tv = [];
    state.free = newSess({ scale: state.prefs.scale, tune: new Array(NSTR).fill(0), custom: false, hits: 0, label: null });
    state.scene = 'free'; state.sceneT = 0;
  }
  function updateFree(dt, tap, input) {
    const f = state.free, F = lay().free;
    if (tap) {
      if (inRect(F.exit, tap.x, tap.y)) { go('title'); state.free = null; return; }
      if (inRect(F.scale, tap.x, tap.y)) {
        const i = SCALES.findIndex((q) => q.id === f.scale), nx = SCALES[(i + 1) % SCALES.length].id;
        f.scale = nx; f.tune.fill(0); f.custom = false; state.prefs.scale = nx; storage.set('prefs', state.prefs);
        if (state.prefs.sound) [0, 2, 4].forEach((s) => R.play(s, hzOf(semiOf(f, s)), 0.5, null));
        for (let s = 0; s < NSTR; s++) ring(f, s, 0.5, 'ens');
      } else if (inRect(F.reset, tap.x, tap.y)) { f.tune.fill(0); f.custom = false; say('Bridges reset'); }
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
    if (state.prefs.sound) R.play(6, hzOf(24), 0.7, null);
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
    else if (id === 'labels') p.labels = !p.labels;
    else if (id === 'click') p.click = !p.click;
    else if (id === 'haptics') p.haptics = !p.haptics;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'thinkDec') p.think = Math.max(THINK.min, p.think - 1);
    else if (id === 'thinkInc') p.think = Math.min(THINK.max, p.think + 1);
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
    render(ctx, view) { host.tz = TEXT_SCALES[state.prefs.textIdx] ?? 1; render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems, { bridgeArr, semiOf, approach: approach() }); },
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
        else if (sc === 'free') { startFree(); if (o.scale) state.free.scale = o.scale; if (o.tune) o.tune.forEach((v, i) => { state.free.tune[i] = v; }); }
        else if (sc === 'calib') startCal();
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay('perform'); const pl = state.pl; pl.score = 123450; pl.maxCombo = 41; pl.counts = { perfect: 88, great: 31, good: 9, off: 4, miss: 3 }; pl.bends = 3; pl.still = 4; pl.chunks[0].sum = 118; pl.chunks[0].n = 135; finishRun();
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) {
            const pl = state.pl;
            if (pl && state.scene === 'play' && o.play && !pl.paused && pl.mode !== 'auto') {
              for (let s = 0; s < NSTR; s++) {
                const n = pl.nd[s][pl.np[s]];
                if (n && !n.j && n.t <= pl.t + 0.01 + state.prefs.cal / 1000) { if (n.p) pl.kp[s] = { lvl: n.p, until: pl.t + 1.2 }; pluckAt(pl, s, pl.t); }
              }
            }
            api.update(1 / 60, idle);
          }
        }
      },
    },
  };
  return api;
}
