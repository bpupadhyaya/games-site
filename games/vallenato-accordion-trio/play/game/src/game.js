// Vallenato Accordion Trio: state and flow. Drawing is in view.js / playview.js / docview.js / art.js; the music and every rule constant is in
// music.js; the geometry in layout.js.
//
// Timing model: song time `pl.t` is the sum of the dt values handed to update() (deterministic, pausable). When the browser gives us an audio
// engine (env.rhythm, see web/audio/engine.js) the band's sounds are scheduled on the audio clock a little ahead of pl.t, and a player's touch
// is time-stamped on the audio clock and converted back to song time before it is judged. Headless runs have no engine: the same code runs with
// touches taken at the tick time.
import {
  PARTS, PART, PIECES, WHY, STRAY_COST, JUDGE, TIMING, SPEEDS, BELLOWS, SCORE, WEIGHT, STROKE_UNITS, TAP_STROKE_CAP, LOOKAHEAD, TOGETHER,
  buildTimeline, bandTime, sectionAt, describeNext, comboMult, starsOf, buttonFreq, focusPart,
} from './music.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, accGeom, guaGeom } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { render } from './view.js';
import { RULES } from './content.js';
import { GRADE_TEXT, GRADE_COL } from './playview.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const NO_RHYTHM = { available: false, play() {}, reedOn: () => 0, reedOff() {}, sync() {}, flush() {}, toSong: () => NaN, setMuted() {}, now: () => 0, haptic() {} };
const DEMO_RUNS = 6;
const ACC_KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ'];
const GRADE_ORDER = ['perfect', 'great', 'good'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const emptyFx = () => ({ acc: [0, 0, 0, 0, 0, 0, 0], accAny: 0, caja: 0, gua: 0, tum: 0, tak: 0, bell: 0, held: false, guaV: { fork: 0, lean: 0, glow: 0, trail: [] } });

export function createGame(env) {
  const { rng, storage, config } = env;
  const R = env.rhythm ?? NO_RHYTHM;
  const state = {
    scene: 'title', sceneT: 0, t: 0, sel: 0, backTo: 'title',
    prefs: { sound: true, speedIdx: 0, timingIdx: 1, labels: true, click: false, haptics: true, calm: false, textIdx: 0, cal: 0, bellows: 'hold' },
    best: {}, takes: {}, demoRuns: 0, pl: null, cal: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    owned: false, restoreMsg: '', restoreBusy: false,
    toast: null, dev: config.dev === true, demo: config.demo === true,
  };
  state.owned = !!env.monetization?.owns?.('unlock_game');
  env.monetization?.onChange?.(() => { state.owned = !!env.monetization.owns('unlock_game'); });
  let lastScene = state.scene, drag = null, kp = { x: 0, y: 0 };

  storage.get('prefs', null).then((v) => {
    if (v) {
      Object.assign(state.prefs, v);
      state.prefs.textIdx = clamp(state.prefs.textIdx | 0, 0, TEXT_SCALES.length - 1);
      state.prefs.timingIdx = clamp(state.prefs.timingIdx | 0, 0, TIMING.length - 1);
      state.prefs.speedIdx = clamp(state.prefs.speedIdx | 0, 0, SPEEDS.length - 1);
      if (!BELLOWS.some((b) => b.id === state.prefs.bellows)) state.prefs.bellows = 'hold';
      applyPrefs();
    }
  });
  storage.get('best', null).then((v) => { if (v) state.best = v; });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { R.setMuted(!state.prefs.sound); env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();

  const lay = () => layoutFor(meta.width, meta.height);
  const win = () => { const k = TIMING[state.prefs.timingIdx].k; return { p: JUDGE.perfect * k, g: JUDGE.great * k, o: JUDGE.good * k }; };
  const go = (scene) => { if (state.scene === 'play' || state.scene === 'calib') R.flush(); state.scene = scene; if (scene !== 'play' && scene !== 'result') state.pl = null; };
  const say = (text, hold = 2.2) => { state.toast = { text, t: 0, hold }; };
  const songAt = (audioTime, fallback) => { const s = R.available ? R.toSong(audioTime) : NaN; return Number.isFinite(s) ? s : fallback; };

  // ---- a play session -----------------------------------------------------------------------------------------------------------------
  const indexHits = (hits) => { const m = {}; for (const h of hits ?? []) m[h.i] = h; return m; };
  function newSession(mode, pi, seat, source) {
    const piece = PIECES[pi], speed = SPEEDS[state.prefs.speedIdx].k, tl = buildTimeline(piece, speed);
    const store = state.takes[piece.id] ?? {};
    const recorded = { gua: false, caja: false, acc: false }, recHits = { gua: {}, caja: {}, acc: {} };
    if (mode === 'take') for (const p of PARTS) { const t = store[p]; if (p !== seat && t && t.speed === speed) { recorded[p] = true; recHits[p] = indexHits(t.hits); } }
    if (mode === 'replay') {
      if (source === 'live' && store.live && store.live.speed === speed) for (const p of PARTS) { recorded[p] = true; recHits[p] = indexHits(store.live.hits[p]); }
      else for (const p of PARTS) { const t = store[p]; if (t && t.speed === speed) { recorded[p] = true; recHits[p] = indexHits(t.hits); } }
    }
    // which notes the player is graded on
    for (const p of PARTS) for (const n of tl.notes[p]) {
      n.j = undefined;
      if (mode === 'take') n.mine = p === seat;
      else if (mode === 'live') { const s = tl.sections[Math.min(tl.sections.length - 1, Math.floor(n.b / 2))]; n.mine = s.seat === p && n.t >= s.judgeFrom; }
      else n.mine = false;
    }
    const pl = {
      mode, pi, piece, tl, seat: seat ?? null, source: source ?? null, t: 0, over: false, paused: false, resync: true,
      recorded, recHits, rec: { gua: [], caja: [], acc: [] },
      mineTotal: 0, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, off: 0, miss: 0 }, accSum: 0, strays: 0,
      ev: [], si: 0, fi: 0, np: { gua: 0, caja: 0, acc: 0 }, ptr: {}, padIds: [], pull: false, kbSpace: false,
      fx: emptyFx(), pops: [], parts: [], pulse: 0, shake: 0, banner: null, caption: '', secK: -1, hintOn: false, hintT: 0, hintText: '', lastBeat: -1,
    };
    pl.mineTotal = PARTS.reduce((s, p) => s + tl.notes[p].filter((n) => n.mine).length, 0);
    buildEvents(pl);
    return pl;
  }
  const VEL = { perfect: 0.95, great: 0.88, good: 0.78, off: 0.7 };
  function buildEvents(pl) {
    const ev = [], tl = pl.tl, clickAll = state.prefs.click && (pl.mode === 'take' || pl.mode === 'live');
    for (const part of PARTS) {
      for (const n of tl.notes[part]) {
        if (n.mine) continue;                                            // the player makes this sound
        let t = bandTime(n), vel = n.soft ? 0.55 : 0.9, freq = n.freq;
        if (pl.recorded[part]) {
          const h = pl.recHits[part][n.i];
          if (!h) continue;                                              // a note the player missed stays missing
          t = h.t; vel = VEL[h.g] ?? 0.8; if (part === 'acc') freq = h.f ?? n.freq;
        }
        const e = { t, part, i: n.i, vel };
        if (part === 'acc') Object.assign(e, { kind: 'reed', o: { freq, dur: n.dur, pull: n.pull, vel: 0.7 }, btn: n.btn });
        else if (part === 'caja') Object.assign(e, { kind: n.kind, o: { vel: vel * 0.95 }, hit: n.kind });
        else Object.assign(e, { kind: 'scrape', o: { vel: n.acc ? 0.8 : 0.55, dir: n.dir, accent: n.acc }, dir: n.dir });
        ev.push(e);
      }
    }
    for (const b of tl.bass) ev.push({ t: b.t, part: null, kind: 'bajo', o: { freq: b.freq, vel: b.vel } });
    for (const c of tl.clicks) if (c.cnt || clickAll) ev.push({ t: c.t, part: null, kind: 'click', o: { accent: c.accent }, tick: true, cnt: c.cnt });
    ev.sort((a, b) => a.t - b.t);
    pl.ev = ev;
  }
  const hasTakes = (id, source) => { const s = state.takes[id]; if (!s) return false; return source === 'live' ? !!s.live : PARTS.some((p) => s[p]); };

  function startPlay(mode, seat, source) {
    const countable = mode === 'take' || mode === 'live';
    if (config.demo && countable && (state.sel > 0 || state.demoRuns >= DEMO_RUNS)) { go('demo-limit'); return; }
    if (mode === 'replay' && !hasTakes(PIECES[state.sel].id, source)) { say('Record a take first'); return; }
    if (config.demo && countable) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    R.flush();
    state.pl = newSession(mode, state.sel, seat, source); state.result = null;
    state.scene = 'play'; state.sceneT = 0;
    env.monetization.track?.('piece_start', { piece: PIECES[state.sel].id, mode, seat: seat ?? '' });
  }

  function pausePlay() {
    const pl = state.pl; if (!pl || pl.paused || pl.over) return;
    pl.paused = true; R.flush();
    while (pl.si > 0 && pl.ev[pl.si - 1].t > pl.t) pl.si -= 1;     // what was scheduled but not yet heard will be scheduled again
    pl.ptr = {}; pl.padIds = []; pl.fx.held = false;
  }
  function resumePlay() { const pl = state.pl; if (!pl) return; pl.paused = false; pl.resync = true; }

  // ---- what a hit looks and sounds like ----------------------------------------------------------------------------------------------------
  function flashPart(pl, part, by, info = {}) {
    const fx = pl.fx;
    if (part === 'acc') { if (info.btn !== undefined) fx.acc[info.btn] = 1; fx.accAny = 1; }
    else if (part === 'caja') { fx.caja = 1; if (info.kind === 'tum') fx.tum = 1; else fx.tak = 1; }
    else {
      fx.gua = 1; fx.guaV.glow = 1;
      if (info.dir) { const k = info.dir === 'R' ? 1 : -1; fx.guaV.lean = k; if (by === 'band') fx.guaV.fork = k * 0.8; fx.guaV.trail.push({ x: info.x ?? 0, dy: 0, a: 1 }); if (fx.guaV.trail.length > 10) fx.guaV.trail.shift(); }
    }
    if (!state.prefs.calm && by === 'player') {
      const L = lay().play;
      burst(pl.parts, rng, L.ribbon.x + L.ribbon.w * 0.2, L.ribbon.y + L.ribbon.h * (part === 'acc' ? 0.3 : part === 'caja' ? 0.68 : 0.88), 8, PART[part].col, 1);
    }
  }
  const pop = (pl, part, text, col) => { pl.pops = pl.pops.filter((q) => q.part !== part); pl.pops.push({ part, text, col, age: 0 }); };

  // ---- judging ------------------------------------------------------------------------------------------------------------------------------
  function gradeFor(err) { const w = win(), a = Math.abs(err); return a <= w.p ? 'perfect' : a <= w.g ? 'great' : 'good'; }
  function findNote(pl, part, tAdj, pred) {
    const arr = pl.tl.notes[part], w = win().o; let best = null;
    for (let i = pl.np[part]; i < arr.length && arr[i].t <= tAdj + w; i++) {
      const n = arr[i]; if (n.j || !n.mine) continue;
      const e = Math.abs(n.t - tAdj);
      if (e <= w && pred(n) && (!best || e < Math.abs(best.t - tAdj))) best = n;
    }
    return best;
  }
  function award(pl, n, g, tAdj, f) {
    n.j = g; n.err = tAdj - n.t;
    pl.score += SCORE[g] * comboMult(pl.combo); pl.combo += 1; pl.maxCombo = Math.max(pl.maxCombo, pl.combo);
    pl.counts[g] += 1; pl.accSum += WEIGHT[g];
    pl.rec[n.part].push({ i: n.i, t: tAdj, g, f });
    pop(pl, n.part, GRADE_TEXT[g], GRADE_COL[g]);
    if (g === 'perfect' || g === 'great') pl.pulse = 1;
  }
  function missNote(pl, n) {
    n.j = 'miss'; pl.counts.miss += 1; pl.combo = 0;
    pop(pl, n.part, 'MISS', GRADE_COL.miss);
  }
  // A press with no note of yours near it: it still sounds, but it breaks the combo and costs a little accuracy (so mashing cannot win).
  function stray(pl, part, tAdj) {
    const near = pl.tl.notes[part].some((n) => n.mine && !n.j && Math.abs(n.t - tAdj) < 0.45);
    if (!near) return;
    pl.strays += 1; pl.combo = 0;
    pop(pl, part, 'EXTRA', '#c9b8a0');
  }
  const isLive = (pl) => !!pl && state.scene === 'play' && !pl.paused && !pl.over && (pl.mode === 'take' || pl.mode === 'live');
  const adj = (t) => t - state.prefs.cal / 1000;
  const vib = (ms) => { if (state.prefs.haptics) R.haptic?.(ms); };

  // The accordion: a button press with the bellows in `pull`. Returns the sound's handle for the release (0 in headless runs).
  function accHit(pl, btn, pull, tSong) {
    const tAdj = adj(tSong);
    if (isLive(pl)) {
      const note = findNote(pl, 'acc', tAdj, (n) => n.btn === btn);
      if (note && state.prefs.bellows === 'auto') { pull = note.pull; pl.pull = pull; }
      if (note) award(pl, note, note.pull === pull ? gradeFor(note.t - tAdj) : 'off', tAdj, buttonFreq(btn, pull));
      else stray(pl, 'acc', tAdj);
    }
    const handle = state.prefs.sound ? (R.reedOn?.(buttonFreq(btn, pull), 0.85, pull) ?? 0) : 0;
    flashPart(pl, 'acc', 'player', { btn });
    vib(8);
    return handle;
  }
  function cajaHit(pl, kind, tSong) {
    const tAdj = adj(tSong);
    if (isLive(pl)) {
      let note = findNote(pl, 'caja', tAdj, (n) => n.kind === kind), off = false;
      if (!note) { note = findNote(pl, 'caja', tAdj, () => true); off = !!note; }
      if (note) award(pl, note, off ? 'off' : gradeFor(note.t - tAdj), tAdj);
      else stray(pl, 'caja', tAdj);
    }
    if (state.prefs.sound) R.play(kind, { vel: 0.9 });
    flashPart(pl, 'caja', 'player', { kind });
    vib(10);
  }
  function guaHit(pl, dir, tSong, tap = false, x = 0) {
    const tAdj = adj(tSong);
    if (isLive(pl)) {
      let note = tap ? findNote(pl, 'gua', tAdj, () => true) : findNote(pl, 'gua', tAdj, (n) => n.dir === dir), off = false;
      if (!note && !tap) { note = findNote(pl, 'gua', tAdj, () => true); off = !!note; }
      if (note) {
        let g = off ? 'off' : gradeFor(note.t - tAdj);
        if (tap && g !== 'off' && GRADE_ORDER.indexOf(g) < GRADE_ORDER.indexOf(TAP_STROKE_CAP)) g = TAP_STROKE_CAP;
        if (tap && !dir) dir = note.dir;
        award(pl, note, g, tAdj);
      } else stray(pl, 'gua', tAdj);
    }
    const d = dir ?? 'R';
    if (state.prefs.sound) R.play('scrape', { vel: 0.75, dir: d, accent: false });
    flashPart(pl, 'gua', 'player', { dir: d, x });
    vib(5);
  }

  // ---- pointers (every finger is its own touch; main.js feeds this directly when the engine exists) -----------------------------
  const currentPull = (pl) => (state.prefs.bellows === 'hold' ? pl.padIds.length > 0 || pl.kbSpace : pl.pull);
  function nearestBtn(G, x, y) {
    if (y < G.panel.y - 20 || y > G.panel.y + G.panel.h + 8) return -1;
    let best = -1, bd = 1;
    for (const b of G.btns) { const d = Math.abs(x - b.cx) / (G.cell * 0.56); if (d < bd) { bd = d; best = b.i; } }
    return best;
  }
  function playerPointer(type, id, x, y, tSong) {
    const pl = state.pl;
    if (!pl || pl.paused || pl.over || state.scene !== 'play') return false;
    if (pl.mode === 'auto' || pl.mode === 'replay') return false;
    const L = lay().play, a = L.inst;
    if (type === 'down') {
      if (inRect(L.pause, x, y) || inRect(L.hint, x, y)) return false;
      if (!inRect(a, x, y)) return false;
      const part = focusPart(pl, pl.t);
      if (part === 'acc') {
        const G = accGeom(a), mode = state.prefs.bellows;
        if (inRect(G.pad, x, y)) {
          if (mode === 'hold') { pl.padIds.push(id); pl.ptr[id] = { kind: 'pad' }; R.play('swish', { pull: true, vel: 0.5 }); }
          else if (mode === 'toggle') { pl.pull = !pl.pull; R.play('swish', { pull: pl.pull, vel: 0.5 }); pl.ptr[id] = { kind: 'tog' }; }
          pl.fx.held = currentPull(pl);
          return true;
        }
        const btn = nearestBtn(G, x, y);
        if (btn >= 0) { const handle = accHit(pl, btn, currentPull(pl), tSong); pl.ptr[id] = { kind: 'btn', handle }; }
        return true;
      }
      if (part === 'caja') {
        cajaHit(pl, x < a.x + a.w / 2 ? 'tum' : 'tak', tSong); pl.ptr[id] = { kind: 'caja' };
        return true;
      }
      const G = guaGeom(a);
      pl.ptr[id] = { kind: 'gua', ax: x, x0: x, y0: y, fired: 0, travel: 0 };
      pl.fx.guaV.fork = clamp((x - (G.tube.x + G.tube.w / 2)) / (G.tube.w / 2 - 60), -1, 1);
      return true;
    }
    const p = pl.ptr[id];
    if (!p) return false;
    if (type === 'move') {
      if (p.kind === 'gua') {
        const G = guaGeom(a), dx = x - p.ax;
        p.travel = Math.max(p.travel, Math.abs(x - p.x0) + Math.abs(y - p.y0));
        pl.fx.guaV.fork = clamp((x - (G.tube.x + G.tube.w / 2)) / (G.tube.w / 2 - 60), -1, 1);
        if (Math.abs(dx) >= STROKE_UNITS) {
          if (focusPart(pl, pl.t) === 'gua') guaHit(pl, dx > 0 ? 'R' : 'L', tSong, false, x);
          p.ax = x; p.fired += 1;
        }
      }
      return true;
    }
    // up / cancel
    delete pl.ptr[id];
    if (p.kind === 'pad') { pl.padIds = pl.padIds.filter((q) => q !== id); pl.fx.held = currentPull(pl); }
    else if (p.kind === 'btn' && p.handle) R.reedOff(p.handle);
    else if (p.kind === 'gua' && p.fired === 0 && p.travel < 16 && focusPart(pl, pl.t) === 'gua') guaHit(pl, null, tSong, true, x);
    return true;
  }

  // ---- per-tick play update ---------------------------------------------------------------------------------------------------------------
  function updateHint(pl) { if (pl.hintOn) pl.hintText = describeNext(pl.tl, focusPart(pl, pl.t), pl.t - state.prefs.cal / 1000); }
  function stepAnim(pl, dt) {
    const fx = pl.fx, k = dt * 5;
    for (let i = 0; i < 7; i++) fx.acc[i] = Math.max(0, fx.acc[i] - k * 0.9);
    fx.accAny = Math.max(0, fx.accAny - k); fx.caja = Math.max(0, fx.caja - k); fx.gua = Math.max(0, fx.gua - k);
    fx.tum = Math.max(0, fx.tum - k * 0.8); fx.tak = Math.max(0, fx.tak - k * 0.8);
    const target = currentPull(pl) ? 1 : 0; fx.bell += (target - fx.bell) * Math.min(1, dt * 14);
    const gv = fx.guaV; gv.glow = Math.max(0, gv.glow - k * 0.7); gv.lean += (0 - gv.lean) * Math.min(1, dt * 8);
    if (!Object.values(pl.ptr).some((p) => p.kind === 'gua')) gv.fork += (0 - gv.fork) * Math.min(1, dt * 4);
    for (const s of gv.trail) s.a -= dt * 3;
    gv.trail = gv.trail.filter((s) => s.a > 0);
    for (const p of pl.pops) p.age += dt;
    pl.pops = pl.pops.filter((p) => p.age < 0.8);
    stepParticles(pl.parts, dt);
    pl.pulse = Math.max(0, pl.pulse - dt * 4); pl.shake = Math.max(0, pl.shake - dt * 4);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 1.6) pl.banner = null; }
    if (pl.hintOn) { pl.hintT += dt; if (pl.hintT > 5) pl.hintOn = false; }
  }
  function sectionChange(pl) {
    if (pl.mode === 'take' || pl.t < pl.tl.T0 - 0.001) return;
    const s = sectionAt(pl.tl, pl.t);
    if (s.k === pl.secK) return;
    pl.secK = s.k;
    pl.banner = { text: `${PART[s.seat].name}${pl.mode === 'live' ? ': your turn' : ''}`, t: 0, col: PART[s.seat].col };
    if (pl.mode === 'auto') pl.caption = `${PART[s.seat].name}: ${WHY[s.seat][pl.piece.aire]}`;
  }
  function updatePlay(dt, input, tap) {
    const pl = state.pl, L = lay().play;
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    const auto = pl.mode === 'auto' || pl.mode === 'replay';
    if (tap) {
      if (inRect(L.pause, tap.x, tap.y)) { pausePlay(); return; }
      if (inRect(L.hint, tap.x, tap.y)) {
        if (auto) { startPlay(pl.mode, pl.seat, pl.source); return; }
        pl.hintOn = !pl.hintOn; pl.hintT = 0; updateHint(pl);
      }
    }
    if (input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) { pausePlay(); return; }
    const k = input.keys;
    if (state.prefs.bellows === 'toggle' && k.pressed.has('Space')) pl.pull = !pl.pull;
    pl.kbSpace = k.down.has('Space');
    if (!auto) {
      const part = focusPart(pl, pl.t), t = pl.t;
      if (part === 'acc') ACC_KEYS.forEach((c, i) => { if (k.pressed.has(c)) accHit(pl, i, currentPull(pl), t); });
      else if (part === 'caja') { if (k.pressed.has('KeyZ')) cajaHit(pl, 'tum', t); if (k.pressed.has('KeyX')) cajaHit(pl, 'tak', t); }
      else { if (k.pressed.has('ArrowRight')) guaHit(pl, 'R', t); if (k.pressed.has('ArrowLeft')) guaHit(pl, 'L', t); }
    }
    pl.t += dt;
    if (R.available) { R.sync(pl.t, pl.resync); pl.resync = false; }
    // audio scheduling, a little ahead of the song clock
    const horizon = pl.t + LOOKAHEAD;
    while (pl.si < pl.ev.length && pl.ev[pl.si].t <= horizon) {
      const e = pl.ev[pl.si++];
      if (state.prefs.sound) R.play(e.kind, e.o, e.t);
    }
    // visuals at the moment of the band's hit
    while (pl.fi < pl.ev.length && pl.ev[pl.fi].t <= pl.t) {
      const e = pl.ev[pl.fi++];
      if (e.tick) { pl.pulse = Math.max(pl.pulse, e.o.accent ? 0.8 : 0.4); continue; }
      if (e.part) flashPart(pl, e.part, 'band', { btn: e.btn, kind: e.hit, dir: e.dir });
    }
    // notes nobody played
    const w = win().o + state.prefs.cal / 1000;
    for (const part of PARTS) {
      const arr = pl.tl.notes[part];
      while (pl.np[part] < arr.length) {
        const n = arr[pl.np[part]];
        if (!n.mine || n.j) { pl.np[part] += 1; continue; }
        if (n.t + w < pl.t) { missNote(pl, n); pl.np[part] += 1; } else break;
      }
    }
    sectionChange(pl);
    stepAnim(pl, dt);
    if (pl.hintOn && Math.floor(pl.t / pl.tl.beat) !== pl.lastBeat) { pl.lastBeat = Math.floor(pl.t / pl.tl.beat); updateHint(pl); }
    if (pl.t >= pl.tl.end) finishRun();
  }

  // ---- the end of a take, a live run or a playback -------------------------------------------------------------------------------
  function actualTime(pl, part, n) {
    if (n.mine) { const h = pl.rec[part].find((q) => q.i === n.i); return h ? h.t : undefined; }
    if (pl.recorded[part]) { const h = pl.recHits[part][n.i]; return h ? h.t : undefined; }
    return bandTime(n);
  }
  function togetherOf(pl) {
    const groups = new Map();
    for (const part of PARTS) for (const n of pl.tl.notes[part]) { const key = n.b * 100 + n.s; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(n); }
    let sum = 0, cnt = 0;
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      for (const a of list) {
        if (!a.mine) continue;
        const ta = actualTime(pl, a.part, a);
        for (const m of list) {
          if (m === a || m.part === a.part) continue;
          const tm = actualTime(pl, m.part, m);
          cnt += 1;
          if (ta === undefined || tm === undefined) continue;          // a part that did not sound there is not together with anything
          const d = Math.abs(ta - tm);
          sum += d <= TOGETHER.tight ? 1 : d >= TOGETHER.loose ? 0 : 1 - (d - TOGETHER.tight) / (TOGETHER.loose - TOGETHER.tight);
        }
      }
    }
    return cnt ? sum / cnt : null;
  }
  function finishRun() {
    const pl = state.pl; if (!pl || pl.over) return;
    R.flush();
    pl.over = true;
    if (pl.mode === 'auto' || pl.mode === 'replay') return;                  // the pause menu offers what next
    const acc = pl.mineTotal ? Math.max(0, pl.accSum - STRAY_COST * pl.strays) / pl.mineTotal : 0, stars = starsOf(acc), together = togetherOf(pl), id = pl.piece.id;
    const old = state.best[id] ?? {};
    const res = { piece: pl.pi, mode: pl.mode, seat: pl.seat, score: pl.score, acc, stars, maxCombo: pl.maxCombo, counts: { ...pl.counts }, strays: pl.strays, together, newBest: false, hint: '', actions: [] };
    const speed = pl.tl.speed, bestNew = { ...old, take: { ...(old.take ?? {}) } };
    if (pl.mode === 'take') {
      const prev = old.take?.[pl.seat];
      res.newBest = !prev || pl.score > prev.score;
      bestNew.take[pl.seat] = { score: Math.max(prev?.score ?? 0, pl.score), stars: Math.max(prev?.stars ?? 0, stars), acc: Math.max(prev?.acc ?? 0, acc) };
      if (!state.takes[id]) state.takes[id] = {};
      state.takes[id][pl.seat] = { hits: pl.rec[pl.seat].slice(), stars, acc, score: pl.score, together, speed };
    } else {
      res.newBest = !old.liveScore || pl.score > old.liveScore;
      bestNew.live = Math.max(old.live ?? 0, stars); bestNew.liveScore = Math.max(old.liveScore ?? 0, pl.score);
      if (!state.takes[id]) state.takes[id] = {};
      state.takes[id].live = { hits: { gua: pl.rec.gua.slice(), caja: pl.rec.caja.slice(), acc: pl.rec.acc.slice() }, stars, acc, score: pl.score, together, speed };
    }
    if (together !== null) bestNew.together = Math.max(old.together ?? 0, together);
    state.best[id] = bestNew;
    storage.set('best', state.best);
    env.monetization.track?.('piece_end', { piece: id, mode: pl.mode, stars });
    if (pl.mode === 'take') {
      const tk = state.takes[id], missing = PARTS.find((p) => !tk[p] || tk[p].speed !== speed);
      res.actions.push(missing ? { id: 'next', label: `Next: ${PART[missing].name}`, kind: 'primary', seat: missing } : { id: 'hear', label: 'Hear my trio', kind: 'primary' });
      res.actions.push({ id: 'redo', label: 'Redo this take', kind: 'quiet' });
      if (missing) res.actions.push({ id: 'hear', label: 'Hear my trio', kind: 'quiet' });
      res.actions.push({ id: 'piece', label: 'Piece menu', kind: 'ghost' });
      res.hint = missing ? '' : 'All three takes are in. Play them together.';
    } else {
      res.actions = [{ id: 'again', label: 'Play again', kind: 'primary' }, { id: 'hearlive', label: 'Hear my run', kind: 'quiet' }, { id: 'piece', label: 'Piece menu', kind: 'ghost' }];
    }
    state.result = res; state.scene = 'result'; state.sceneT = 0;
  }

  function pauseItems(pl) {
    if (pl.over) return pl.mode === 'auto' ? ['restart', 'next', 'quit'] : ['restart', 'quit'];
    return pl.mode === 'auto' ? ['resume', 'restart', 'slow', 'quit'] : ['resume', 'restart', 'quit'];
  }
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems(pl), M = menuRects(lay(), items.length);
    if (input.keys.pressed.has('Escape') && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart') startPlay(pl.mode, pl.seat, pl.source);
      else if (it === 'slow') { state.prefs.speedIdx = (state.prefs.speedIdx + 1) % SPEEDS.length; savePrefs(); startPlay('auto'); }
      else if (it === 'next') { state.sel = (state.sel + 1) % PIECES.length; startPlay('auto'); }
      else go('piece');
    });
  }

  // ---- calibration ----------------------------------------------------------------------------------------------------------------------------
  function startCal() {
    R.flush();
    state.cal = { t: 0, T0: 1.8, n: 12, bpm: 90, taps: [], next: 0, pulse: 0, flash: 0, phase: 'run', result: null, resync: true, lastBeat: -1 };
    state.scene = 'calib'; state.sceneT = 0;
  }
  const calBeat = (c, i) => c.T0 + i * 60 / c.bpm;
  function calTap(tSong) {
    const c = state.cal; if (!c || c.phase !== 'run') return;
    if (state.prefs.sound) R.play('tum', { vel: 0.8 });
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
        if (inRect(C.use, tap.x, tap.y)) { if (c.result.ms !== null) { state.prefs.cal = clamp(c.result.ms, -100, 400); savePrefs(); say(`Latency set to ${state.prefs.cal} ms`); } leaveCal(); return; }
      } else if (!R.available) calTap(c.t);
    }
    if (input.keys.pressed.has('Space')) calTap(c.t);
    c.t += dt;
    if (R.available) { R.sync(c.t, c.resync); c.resync = false; }
    while (c.next < c.n && calBeat(c, c.next) - LOOKAHEAD <= c.t) { if (state.prefs.sound) R.play('click', { accent: c.next % 4 === 0 }, calBeat(c, c.next)); c.next += 1; }
    c.flash = Math.max(0, c.flash - dt * 5);
    const bi = Math.floor((c.t - c.T0) * c.bpm / 60);
    if (c.t >= c.T0 && bi >= 0 && bi !== c.lastBeat && bi < c.n) { c.lastBeat = bi; c.pulse = 1; }
    c.pulse = Math.max(0, c.pulse - dt * 3);
    if (c.phase === 'run' && c.t > calBeat(c, c.n - 1) + 0.6) calFinish(c);
  }

  // ---- menus and documents -----------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function restorePurchase() {
    const mon = env.monetization;
    if (state.restoreBusy || state.owned || state.demo || !mon?.restore) return;
    state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
    Promise.resolve(mon.restore()).then(() => {
      state.owned = !!mon.owns?.('unlock_game');
      state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
    }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
  }
  function settingsAction(id) {
    const p = state.prefs, cyc = (v, n) => (v + 1) % n;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'speed') p.speedIdx = cyc(p.speedIdx, SPEEDS.length);
    else if (id === 'timing') p.timingIdx = cyc(p.timingIdx, TIMING.length);
    else if (id === 'bellows') p.bellows = BELLOWS[(BELLOWS.findIndex((b) => b.id === p.bellows) + 1) % BELLOWS.length].id;
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
    if (hit(T.play)) go('songs');
    else if (hit(T.watch)) { state.sel = 0; startPlay('auto'); }
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
    if (inRect(D.back, tap.x, tap.y)) { go('songs'); return; }
    for (let i = 0; i < 3; i++) if (inRect(D.seats[i], tap.x, tap.y)) { startPlay('take', PARTS[i]); return; }
    if (inRect(D.live, tap.x, tap.y)) startPlay('live');
    else if (inRect(D.hear, tap.x, tap.y)) startPlay('replay', null, 'takes');
    else if (inRect(D.watch, tap.x, tap.y)) startPlay('auto');
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result, res = state.result, n = res.actions.length, rects = Rr.b.slice(Rr.b.length - n);
    if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) { env.openArcforgeHome?.(); return; }
    for (let i = 0; i < n; i++) {
      if (!inRect(rects[i], tap.x, tap.y)) continue;
      const a = res.actions[i];
      if (a.id === 'next') startPlay('take', a.seat);
      else if (a.id === 'redo') startPlay('take', res.seat);
      else if (a.id === 'hear') startPlay('replay', null, 'takes');
      else if (a.id === 'hearlive') startPlay('replay', null, 'live');
      else if (a.id === 'again') startPlay('live');
      else go('piece');
      return;
    }
  }

  // ---- the object the kit and main.js see -------------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      if (sc === 'play' && !R.available && state.pl && !state.pl.paused && !state.pl.over) {
        // no audio engine (headless, or a browser without Web Audio): the kit's single pointer drives the instruments
        const t = state.pl.t;
        if (p.pressed) playerPointer('down', 0, p.x, p.y, t);
        else if (p.down && (p.x !== kp.x || p.y !== kp.y)) playerPointer('move', 0, p.x, p.y, t);
        if (p.released) playerPointer('up', 0, p.x, p.y, t);
        kp = { x: p.x, y: p.y };
      }
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'songs') updateSongs(tap);
      else if (sc === 'piece') updatePiece(tap);
      else if (sc === 'play') updatePlay(dt, input, tap);
      else if (sc === 'calib') updateCal(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
    // Multi-touch from main.js (the kit input only has one pointer). type: 'down' | 'move' | 'up'. Returns true when the game used it.
    pointer(type, id, x, y, audioTime) {
      const sc = state.scene;
      if (sc === 'play') {
        const pl = state.pl; if (!pl) return false;
        return playerPointer(type, id, x, y, songAt(audioTime, pl.t));
      }
      if (sc === 'calib' && type === 'down') {
        const c = state.cal, C = lay().calib;
        if (!c) return false;
        for (const r of [C.back, C.use, C.retry]) if (inRect(r, x, y)) return false;
        calTap(songAt(audioTime, c.t));
        return true;
      }
      return false;
    },
    autoPause() { if (state.scene === 'play') pausePlay(); },
    // Everything except real play is free: menus, Rules, calibration, Watch and Learn, playback, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !(state.scene === 'play' && pl && (pl.mode === 'take' || pl.mode === 'live') && !pl.paused && !pl.over);
    },
    // Tester tools (?dev=1): jump to a screen and fast-forward.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.piece !== undefined) state.sel = o.piece;
        const sc = o.scene ?? 'title';
        const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
        const perfect = () => {
          const pl = state.pl;
          if (!pl || state.scene !== 'play' || pl.paused || pl.over || pl.mode === 'auto' || pl.mode === 'replay') return;
          for (const part of PARTS) {
            const n = pl.tl.notes[part][pl.np[part]];
            if (n && n.mine && !n.j && n.t <= pl.t + 0.01 + state.prefs.cal / 1000) {
              if (part === 'acc') accHit(pl, n.btn, n.pull, n.t);
              else if (part === 'caja') cajaHit(pl, n.kind, n.t);
              else guaHit(pl, n.dir, n.t, false, 0);
            }
          }
        };
        if (sc === 'play') startPlay(o.mode ?? 'take', o.seat ?? 'acc', o.source);
        else if (sc === 'calib') startCal();
        else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          startPlay(o.mode ?? 'take', o.seat ?? 'acc');
          for (let i = 0; i < 60 * 90 && state.scene === 'play'; i++) { perfect(); api.update(1 / 60, idle); }
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.pause && state.pl) pausePlay();
        if (o.advance) for (let i = 0; i < o.advance * 60; i++) { if (o.play) perfect(); api.update(1 / 60, idle); }
        if (o.hint && state.pl) { state.pl.hintOn = true; state.pl.hintT = 0; updateHint(state.pl); }
      },
    },
  };
  return api;
}
