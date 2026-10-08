// Djembe Drum Circle: state and flow. Rhythm engine: rhythm.js. Drawing: view.js + art.js. Buttons: buttons.js. Words: content.js.
//
// The song clock `S.t` (seconds) is advanced only by dt. Sounds the program makes are scheduled one tick ahead with a small
// delay so they land on their exact moment in the audio clock; the player's own strokes sound immediately.
import { layoutFor, host, TEXT_SCALES, THINK_STEPS, inRect, clamp } from './layout.js';
import { RHYTHMS, rhythmById, buildLearn, buildEcho, buildCircle, buildAuto, stepCircle, judgeHit, sweepMisses, roundAccuracy, accuracyOf, meanError, strokeAt, stars as starsOf, DIFFICULTY, ECHO_ROUNDS, LAYERS, VOICES, quantise } from './rhythm.js';
import { strike, chime } from './sound.js';
import { zoneOf } from './art.js';
import { buttonsFor, pickLayout, resultLayout, RULES_CHAPTERS } from './buttons.js';
import { render, metrics } from './view.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
// Multitouch strikes collected by main.js (virtual units, with the age in seconds since the finger landed). Empty in headless runs.
export const drumInput = { queue: [], native: false };
export const wheelInput = { dy: 0 };

const DEMO_SESSIONS = 3;
const AUTO_REVEAL_SECS = 2;
const LEAD_IN = -0.7;                                      // the song clock starts a little before zero so the first bar is seen coming
const KEYS = { Space: 'B', KeyF: 'B', KeyJ: 'B', KeyD: 'T', KeyK: 'T', KeyS: 'S', KeyL: 'S' };
const FREE_LAYERS = 3;
const CAL_BEATS = 12, CAL_GAP = 0.75, CAL_SKIP = 4;

export function createGame(env) {
  const { storage, audio, monetization, config, rng } = env;
  const lay = () => { host.zoom = TEXT_SCALES[state.prefs.textScaleIdx] ?? 1; return layoutFor(meta.width, meta.height); };
  const state = {
    scene: 'title', sceneT: 0, t: 0,
    prefs: { diff: 1, latency: 0, guide: true, calm: false, sound: true, textScaleIdx: 0, autoThinkIdx: 1 },
    prog: { stars: {}, circle: {}, echoBest: 0, sessions: 0 },
    pick: { mode: 'learn', sel: 0 },
    mode: 'learn', rhId: 'yankadi', S: null, paused: false, started: false,
    fx: { hands: [], ripples: [], glow: { B: 0, T: 0, S: 0 }, shake: { x: 0, y: 0, k: 0 }, sparks: [], pops: [], chips: {}, flash: 0 },
    hud: { bar: null, combo: 0, acc: 0, msg: '', msgT: 0, roundMsg: null, bi: 0 },
    free: { phase: 'idle', bpm: 90, click: true, quant: true, layers: [], clock: 0, loopStart: 0, countStart: 0, rec: null },
    auto: { on: false, idx: 0, phase: 'think', timer: 0, step: 0 },
    result: null, calib: { phase: 'idle', t: 0, taps: [], beats: [], fired: 0, offset: 0, n: 0 },
    page: { scroll: 0, chapter: 0, drag: null },
    demoSessions: 0, dev: config.dev === true,
    unlocked: (i) => i === 0 || state.dev || (state.prog.stars[RHYTHMS[i - 1].id] ?? 0) >= 1,
  };
  config.textScale = 1;
  let lastScene = state.scene;

  // ---- persistence ----------------------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textScaleIdx = clamp(state.prefs.textScaleIdx | 0, 0, TEXT_SCALES.length - 1); config.textScale = TEXT_SCALES[state.prefs.textScaleIdx]; audio.setMuted?.(!state.prefs.sound); } });
  storage.get('prog', null).then((v) => { if (v) state.prog = { ...state.prog, ...v, stars: { ...(v.stars || {}) }, circle: { ...(v.circle || {}) } }; });
  storage.get('demoSessions', 0).then((v) => { state.demoSessions = Math.max(state.demoSessions, v); });
  const savePrefs = () => { config.textScale = TEXT_SCALES[state.prefs.textScaleIdx]; storage.set('prefs', { ...state.prefs }); };
  const saveProg = () => storage.set('prog', state.prog);

  // ---- helpers --------------------------------------------------------------------------------------------------------------
  const rh = () => rhythmById(state.rhId);
  const snd = (voice, stroke, vel = 0.9, delay = 0) => { if (state.prefs.sound) strike(env, voice, stroke, vel, delay); };
  const setScene = (s) => { state.scene = s; state.page.scroll = 0; state.page.drag = null; };
  // A pleasing, repeatable spot on the skin for a stroke played by the program (not the player).
  const spot = (g, stroke, step) => {
    const a = (step * 2.399 + (stroke === 'B' ? 0.4 : stroke === 'T' ? 1.9 : 3.4)) % (Math.PI * 2), k = stroke === 'B' ? 0.18 : stroke === 'T' ? 0.66 : 0.92;
    return { x: g.cx + Math.cos(a) * g.rx * k, y: g.cy + Math.sin(a) * g.ry * k };
  };
  function hitFx(g, stroke, x, y, vel, hand = false) {
    const fx = state.fx, calm = state.prefs.calm;
    if (hand) { fx.hands.push({ x, y, age: 0, stroke, ang: Math.atan2(x - g.cx, g.cy - y + g.ry * 3) * 0.5 }); if (fx.hands.length > 3) fx.hands.shift(); }
    fx.ripples.push({ x, y, age: 0, stroke }); if (fx.ripples.length > 18) fx.ripples.shift();
    fx.glow[stroke] = Math.min(1, 0.55 + vel * 0.45);
    if (!calm) {
      fx.shake.k = Math.max(fx.shake.k, stroke === 'B' ? 1 : stroke === 'S' ? 0.6 : 0.4);
      const n = stroke === 'S' ? 7 : stroke === 'B' ? 5 : 4;
      for (let i = 0; i < n; i++) fx.sparks.push({ x, y, vx: rng.range(-170, 170), vy: rng.range(-260, -40), age: 0, life: rng.range(0.35, 0.7), stroke });
      if (fx.sparks.length > 80) fx.sparks.splice(0, fx.sparks.length - 80);
    }
  }
  const pop = (text, color, big = false) => { state.fx.pops = [{ text, color, age: 0, big }]; };
  const resetHud = () => { state.fx.ripples = []; state.fx.hands = []; state.fx.sparks = []; state.fx.pops = []; state.hud = { bar: null, combo: 0, acc: 0, msg: '', msgT: 0, roundMsg: null, bi: 0 }; };

  // ---- starting things --------------------------------------------------------------------------------------------------------
  function enterPlay(mode, rhId) {
    if (config.demo && state.demoSessions >= DEMO_SESSIONS) { setScene('demo-limit'); return; }
    if (config.demo) { state.demoSessions += 1; storage.set('demoSessions', state.demoSessions); }
    state.mode = mode; state.rhId = rhId ?? state.rhId; state.paused = false; state.auto.on = false; state.started = true;
    resetHud();
    const o = { diff: state.prefs.diff, latency: state.prefs.latency };
    if (mode === 'learn') state.S = buildLearn(rh(), o);
    else if (mode === 'circle') state.S = buildCircle(rh(), o);
    else if (mode === 'echo') state.S = buildEcho(rhythmById('strokes'), rng, o);
    else { state.S = null; state.free = { phase: 'idle', bpm: state.free.bpm, click: state.free.click, quant: state.free.quant, layers: [], clock: 0, loopStart: 0, countStart: 0, rec: null }; }
    if (state.S) state.S.t = LEAD_IN;
    state.hud.msg = { echo: 'Listen to the phrase, then play it back', learn: 'Listen first. Then follow the lit place on the drum.', circle: 'Hold your part. Play well and the next drummer joins.', free: 'Play freely. Press Record to loop.' }[mode] ?? ''; state.hud.msgT = 3.2;
    setScene('play');
    monetization.track('session_start', { mode, rhythm: state.rhId });
  }
  function startAuto() {
    state.auto = { on: true, idx: state.auto.idx % RHYTHMS.length, phase: 'think', timer: THINK_STEPS[state.prefs.autoThinkIdx], step: 0 };
    state.mode = 'auto'; state.paused = false; state.S = null; state.rhId = RHYTHMS[state.auto.idx].id;
    resetHud(); setScene('play');
  }
  function autoNext() {
    state.auto.idx = (state.auto.idx + 1) % RHYTHMS.length; state.auto.phase = 'think'; state.auto.timer = THINK_STEPS[state.prefs.autoThinkIdx]; state.auto.step = 0;
    state.S = null; state.rhId = RHYTHMS[state.auto.idx].id; state.fx.ripples = []; state.hud.bi = 0;
  }
  function leaveToMenu() { state.auto.on = false; state.paused = false; state.S = null; setScene('title'); }

  // ---- finishing ----------------------------------------------------------------------------------------------------------------
  function finish() {
    const S = state.S; if (!S || S.done) return; S.done = true;
    const st = S.stats, acc = accuracyOf(st);
    let nStars = starsOf(acc), extra = {};
    if (S.mode === 'echo') extra = { rounds: Array.from({ length: ECHO_ROUNDS }, (_, i) => roundAccuracy(S, i + 1)) };
    if (S.mode === 'circle') { const full = S.layers.length >= LAYERS.length; extra = { drummers: S.layers.length + 1, full }; if (!full) nStars = Math.min(nStars, 1); }
    const id = S.rhId;
    let nextOk = false, unlock = null;
    if (S.mode === 'learn') {
      const before = state.prog.stars[id] ?? 0;
      state.prog.stars[id] = Math.max(before, nStars);
      const i = RHYTHMS.findIndex((r) => r.id === id);
      nextOk = i + 1 < RHYTHMS.length && nStars >= 1;
      if (before < 1 && nStars >= 1 && i + 1 < RHYTHMS.length) unlock = RHYTHMS[i + 1].name;
    } else if (S.mode === 'circle') {
      const c = state.prog.circle[id] ?? { best: 0, drummers: 0 };
      state.prog.circle[id] = { best: Math.max(c.best, acc), drummers: Math.max(c.drummers, extra.drummers) };
    } else if (S.mode === 'echo') state.prog.echoBest = Math.max(state.prog.echoBest, acc);
    state.prog.sessions += 1; saveProg();
    state.result = { mode: S.mode, rhId: id, acc, stars: nStars, stats: { ...st }, meanMs: Math.round(meanError(st) * 1000), nextOk, unlock, ...extra };
    chime(env, 'win'); setScene('result');
    monetization.track('session_end', { mode: S.mode, acc: Math.round(acc * 100) });
  }

  // ---- strikes ------------------------------------------------------------------------------------------------------------------
  function strikeAt(stroke, x, y, vel, age) {
    const L = lay(), g = L.play.drum, S = state.S;
    if (state.scene === 'title') { snd('djA', stroke, vel); hitFx(L.title.drum, stroke, x, y, vel); return; }
    if (state.mode === 'free') { freeStrike(stroke, x, y, vel, age, g); return; }
    let v = vel;
    if (S) {
      const th = S.t - age - state.prefs.latency / 1000;
      const res = judgeHit(S, stroke, th);
      if (res) {
        if (res.note.vel < 0.7) v *= 0.6;
        const label = { perfect: 'Perfect', good: 'Good', ok: 'OK', wrong: 'Wrong spot' }[res.grade];
        const color = { perfect: '#ffe07a', good: '#8de6b0', ok: '#9ec5ff', wrong: '#ff8f8f' }[res.grade];
        const when = res.grade === 'perfect' || res.grade === 'wrong' ? '' : res.err < 0 ? ' · early' : ' · late';
        pop(label + when, color, res.grade === 'perfect');
        res.note.hitAt = S.t;
        if (res.grade === 'wrong') chime(env, 'miss');
      }
    }
    snd('djA', stroke, v);
    hitFx(g, stroke, x, y, v);
  }
  const freeLen = () => (8 * 60) / state.free.bpm;
  function freeStrike(stroke, x, y, vel, age, g) {
    const F = state.free;
    snd('djA', stroke, vel); hitFx(g, stroke, x, y, vel);
    if (F.phase === 'rec' && F.rec) {
      const len = freeLen(); let t = ((F.clock - F.loopStart) % len) - age - state.prefs.latency / 1000;
      if (t < 0) t += len;
      if (F.quant) t = quantise(t, len, 60 / F.bpm / 4);
      F.rec.push({ t, stroke, vel });
    }
  }

  // Everything the player did this tick: multitouch strikes, the mouse/touch fallback, and the keyboard.
  function collectStrikes(input, L, avoid) {
    const g = state.scene === 'title' ? L.title.drum : L.play.drum, out = [];
    const add = (x, y, vel, age) => {
      if (avoid.some((r) => inRect(r, x, y))) return;
      const { r } = zoneOf(g, x, y), s = strokeAt(r);
      if (s) out.push({ stroke: s, x, y, vel, age });
    };
    if (drumInput.queue.length) { drumInput.native = true; for (const h of drumInput.queue.splice(0)) add(h.x, h.y, h.vel ?? 0.9, h.age ?? 0); }
    else if (!drumInput.native && input.pointer.pressed) add(input.pointer.x, input.pointer.y, 0.85, 0);
    for (const k of input.keys.pressed) {
      const s = KEYS[k]; if (!s) continue;
      const a = s === 'B' ? 0 : s === 'T' ? 0.64 : 0.92;
      out.push({ stroke: s, x: g.cx + (s === 'S' ? -1 : 1) * g.rx * a * 0.9, y: g.cy, vel: 0.9, age: 0 });
    }
    return out;
  }

  // ---- the song clock ---------------------------------------------------------------------------------------------------------------
  function fireEvent(e, delay) {
    const g = lay().play.drum;
    if (e.voice === 'click') { snd('click', 'X', e.vel, delay); return; }
    snd(e.voice, e.stroke, e.vel * (e.voice === 'lead' ? 1 : 0.8), delay);
    state.fx.chips[e.voice] = 1;
    if (e.voice === 'lead') { const p = spot(g, e.stroke, e.step); hitFx(g, e.stroke, p.x, p.y, e.vel, true); }
  }
  function advanceSong(dt) {
    const S = state.S; if (!S || S.done) return;
    while (S.fi < S.events.length && S.events[S.fi].t < S.t + dt) { const e = S.events[S.fi++]; if (e.t >= S.t - 0.02) fireEvent(e, Math.max(0, e.t - S.t)); }
    S.t += dt;
    sweepMisses(S);
    if (S.mode === 'circle') {
      stepCircle(S, rh());
      const C = S.circle;
      if (C.joined && S.t >= C.joined.at && S.joinShown !== C.joined.at) { S.joinShown = C.joined.at; pop(`${VOICES[C.joined.voice].name} joins`, '#ffe07a', true); chime(env, 'join'); }
    }
    while (S.bars[state.hud.bi] && S.t >= S.bars[state.hud.bi].t1) {
      const b = S.bars[state.hud.bi];
      if (S.mode === 'echo' && b.kind === 'play') state.hud.roundMsg = { round: b.round, acc: roundAccuracy(S, b.round), age: 0 };
      state.hud.bi += 1;
    }
    state.hud.bar = S.bars[Math.min(state.hud.bi, S.bars.length - 1)];
    state.hud.combo = S.stats.combo; state.hud.acc = accuracyOf(S.stats);
    if (S.t >= S.endT) { if (state.auto.on) S.done = true; else finish(); }
  }

  // ---- free drum ----------------------------------------------------------------------------------------------------------------------
  function freeAdvance(dt) {
    const F = state.free, len = freeLen(), beat = 60 / F.bpm;
    const c0 = F.clock; F.clock += dt;
    const clickAt = (a, b, origin) => { const k0 = Math.ceil((a - origin) / beat - 1e-9), k1 = Math.ceil((b - origin) / beat - 1e-9); for (let k = k0; k < k1; k++) snd('click', 'X', k % 4 === 0 ? 1 : 0.6, Math.max(0, origin + k * beat - a)); };
    if (F.phase === 'idle') return;
    if (F.phase === 'count') {
      clickAt(c0, Math.min(F.clock, F.countStart + 4 * beat), F.countStart);
      if (F.clock >= F.countStart + 4 * beat) { F.phase = 'rec'; F.loopStart = F.countStart + 4 * beat; F.rec = []; }
      return;
    }
    const origin = F.loopStart;
    if (F.click) clickAt(c0, F.clock, origin);
    const l0 = c0 - origin, l1 = F.clock - origin;
    for (const layer of F.layers) {
      for (const e of layer) {
        for (let w = Math.max(0, Math.floor(l0 / len)); w <= Math.floor(l1 / len); w++) {
          const at = e.t + w * len;
          if (at >= l0 && at < l1 && at >= 0) {
            snd('djA', e.stroke, e.vel * 0.85, at - l0); state.fx.chips.djA = 0.6;
            const g = lay().play.drum, p = spot(g, e.stroke, Math.round(e.t * 10)); hitFx(g, e.stroke, p.x, p.y, e.vel * 0.7, true);
          }
        }
      }
    }
    if (F.phase === 'rec' && F.clock - origin >= len) {
      if (F.rec.length) F.layers.push(F.rec);
      F.rec = null; F.loopStart = origin + len; F.phase = F.layers.length ? 'loop' : 'idle';
    } else if (F.phase === 'wait') {
      const nextWrap = origin + (Math.floor((c0 - origin) / len) + 1) * len;
      if (F.clock >= nextWrap) { F.phase = 'rec'; F.loopStart = nextWrap; F.rec = []; }
    }
  }
  function freeButton(id) {
    const F = state.free;
    if (id === 'rec') {
      if (F.phase === 'idle') { F.phase = 'count'; F.countStart = F.clock + 0.05; F.loopStart = F.clock; }
      else if (F.phase === 'loop' && F.layers.length < FREE_LAYERS) F.phase = 'wait';
      else if (F.phase === 'wait') F.phase = 'loop';
      else if (F.phase === 'count') F.phase = 'idle';
    } else if (id === 'undo') { F.layers.pop(); if (!F.layers.length && F.phase !== 'rec' && F.phase !== 'count') F.phase = 'idle'; }
    else if (id === 'clear') { F.layers = []; F.rec = null; F.phase = 'idle'; }
    else if (id === 'click') F.click = !F.click;
    else if (id === 'quant') F.quant = !F.quant;
    else if (id === 'bpmDec') F.bpm = clamp(F.bpm - 5, 60, 140);
    else if (id === 'bpmInc') F.bpm = clamp(F.bpm + 5, 60, 140);
  }

  // ---- auto play ---------------------------------------------------------------------------------------------------------------------
  function autoUpdate(dt) {
    const A = state.auto, R = RHYTHMS[A.idx];
    if (state.paused) return;                                      // Pause freezes the whole loop: timers, the song clock, every animation that reads them
    if (A.phase === 'think') { A.timer -= dt; if (A.timer <= 0) { A.phase = 'reveal'; A.timer = AUTO_REVEAL_SECS; A.step = 0; } }
    else if (A.phase === 'reveal') {
      A.timer -= dt;
      const strokes = [...R.parts.djA].filter((c) => c !== '.').length, per = AUTO_REVEAL_SECS / strokes;
      A.step = Math.min(strokes - 1, Math.floor((AUTO_REVEAL_SECS - A.timer) / per));
      if (A.timer <= 0) { A.phase = 'act'; state.S = buildAuto(R); state.S.t = LEAD_IN; state.hud.bi = 0; }
    } else if (A.phase === 'act') {
      advanceSong(dt);
      if (!state.S || state.S.done) autoNext();
    }
  }

  // ---- calibration ---------------------------------------------------------------------------------------------------------------------
  function calibUpdate(dt, taps) {
    const C = state.calib;
    if (C.phase === 'idle') { if (taps.length) { C.phase = 'run'; C.t = 0; C.taps = []; C.fired = 0; C.beats = Array.from({ length: CAL_BEATS }, (_, i) => 1.2 + i * CAL_GAP); } return; }
    if (C.phase !== 'run') return;
    const t0 = C.t; C.t += dt;
    while (C.fired < C.beats.length && C.beats[C.fired] < C.t) { snd('bell', 'X', 0.9, Math.max(0, C.beats[C.fired] - t0)); C.fired += 1; }
    for (const h of taps) { C.taps.push(t0 - (h.age ?? 0)); snd('djA', 'T', 0.7); }
    if (C.t > C.beats[CAL_BEATS - 1] + 0.6) {
      const errs = [];
      for (const tp of C.taps) {
        let best = null; C.beats.forEach((b, i) => { if (i >= CAL_SKIP && (best === null || Math.abs(tp - b) < Math.abs(tp - best))) best = b; });
        if (best !== null && Math.abs(tp - best) < 0.3) errs.push(tp - best);
      }
      errs.sort((a, b) => a - b);
      C.n = errs.length;
      C.offset = errs.length >= 4 ? clamp(Math.round(errs[errs.length >> 1] * 1000), -250, 250) : null;
      C.phase = 'done';
    }
  }

  // ---- generic scrolling for text areas -------------------------------------------------------------------------------------------------
  function scrollUpdate(input, body) {
    const pg = state.page, p = input.pointer, keys = input.keys.pressed, max = () => Math.max(0, metrics.total - metrics.view);
    const set = (v) => { pg.scroll = clamp(v, 0, max()); };
    if (wheelInput.dy) { set(pg.scroll + wheelInput.dy); wheelInput.dy = 0; }
    if (keys.has('ArrowDown')) set(pg.scroll + 70);
    if (keys.has('ArrowUp')) set(pg.scroll - 70);
    if (keys.has('PageDown')) set(pg.scroll + metrics.view * 0.9);
    if (keys.has('PageUp')) set(pg.scroll - metrics.view * 0.9);
    if (p.pressed && inRect(body, p.x, p.y)) pg.drag = { y0: p.y, s0: pg.scroll, moved: false };
    if (pg.drag) { if (!p.down) pg.drag = null; else { if (Math.abs(p.y - pg.drag.y0) > 8) pg.drag.moved = true; set(pg.drag.s0 - (p.y - pg.drag.y0)); } }
    pg.scroll = clamp(pg.scroll, 0, max());
  }

  // ---- buttons ---------------------------------------------------------------------------------------------------------------------------
  const lastUnlocked = () => { let k = 0; RHYTHMS.forEach((_, i) => { if (state.unlocked(i)) k = i; }); return k; };
  const firstOpen = () => { for (let i = RHYTHMS.length - 1; i >= 0; i--) if (state.unlocked(i) && (state.prog.stars[RHYTHMS[i].id] ?? 0) < 1) return i; return lastUnlocked(); };
  // Learn: jump to the start of the next phase (listen -> practice -> play).
  function skipAhead() {
    const S = state.S; if (!S) return;
    const cur = state.hud.bar?.kind, i = S.bars.findIndex((x) => x.t0 > S.t && x.kind !== cur && x.kind !== 'count');
    if (i < 0) return;
    S.t = S.bars[i].t0 - 0.35;
    S.fi = S.events.findIndex((e) => e.t >= S.t); if (S.fi < 0) S.fi = S.events.length;
    state.hud.bi = Math.max(0, S.bars.findIndex((x) => x.t1 > S.t));
  }
  function press(id) {
    const sc = state.scene, tap = () => chime(env, 'tap');
    if (id === 'zoomDec' || id === 'zoomInc') { state.prefs.textScaleIdx = clamp(state.prefs.textScaleIdx + (id === 'zoomInc' ? 1 : -1), 0, TEXT_SCALES.length - 1); state.page.scroll = 0; savePrefs(); tap(); return; }
    if (sc === 'title') {
      if (id === 'echo') enterPlay('echo');
      else if (id === 'free') enterPlay('free');
      else if (id === 'circle' || id === 'learn') { state.pick.mode = id; state.pick.sel = id === 'learn' ? firstOpen() : lastUnlocked(); setScene('pick'); tap(); }
      else if (id === 'auto') startAuto();
      else if (id === 'how') { setScene('how'); tap(); } else if (id === 'rules') { state.page.chapter = 0; setScene('rules'); tap(); }
      else if (id === 'about') { setScene('about'); tap(); } else if (id === 'settings') { setScene('settings'); tap(); }
      else if (id === 'home') env.openArcforgeHome?.();
    } else if (sc === 'pick') {
      if (id.startsWith('rh:')) { state.pick.sel = Number(id.slice(3)); state.page.scroll = 0; tap(); }
      else if (id === 'start') { if (state.unlocked(state.pick.sel)) enterPlay(state.pick.mode, RHYTHMS[state.pick.sel].id); }
      else if (id === 'back') setScene('title');
    } else if (sc === 'play') {
      if (id === 'pause') { if (state.auto.on) leaveToMenu(); else state.paused = true; }
      else if (id === 'resume') state.paused = false;
      else if (id === 'restart') { state.paused = false; if (config.demo) state.demoSessions = Math.max(0, state.demoSessions - 1); enterPlay(state.mode, state.rhId); }
      else if (id === 'quit') leaveToMenu();
      else if (id === 'guide') { state.prefs.guide = !state.prefs.guide; savePrefs(); }
      else if (id === 'skip') skipAhead();
      else if (id === 'autoPause') state.paused = !state.paused;
      else if (id === 'thinkDec' || id === 'thinkInc') { state.prefs.autoThinkIdx = clamp(state.prefs.autoThinkIdx + (id === 'thinkInc' ? 1 : -1), 0, THINK_STEPS.length - 1); savePrefs(); if (state.auto.phase === 'think') state.auto.timer = Math.min(state.auto.timer, THINK_STEPS[state.prefs.autoThinkIdx]); }
      else if (id === 'autoSkip') autoNext();
      else freeButton(id);
    } else if (sc === 'result') {
      const r = state.result;
      if (id === 'again') enterPlay(r.mode, r.rhId);
      else if (id === 'next') { const i = RHYTHMS.findIndex((x) => x.id === r.rhId); enterPlay('learn', RHYTHMS[i + 1].id); }
      else if (id === 'menu') setScene('title');
      else if (id === 'home') env.openArcforgeHome?.();
    } else if (sc === 'rules') {
      if (id === 'back') setScene('title');
      else if (id === 'chPrev') { state.page.chapter = Math.max(0, state.page.chapter - 1); state.page.scroll = 0; tap(); }
      else if (id === 'chNext') { if (state.page.chapter >= RULES_CHAPTERS - 1) setScene('title'); else { state.page.chapter += 1; state.page.scroll = 0; } tap(); }
    } else if (sc === 'about' || sc === 'how') { if (id === 'back') setScene('title'); }
    else if (sc === 'settings') {
      const P = state.prefs;
      if (id === 'back') setScene('title');
      else if (id === 's:diff') P.diff = (P.diff + 1) % DIFFICULTY.length;
      else if (id === 's:calibrate') { state.calib = { phase: 'idle', t: 0, taps: [], beats: [], fired: 0, offset: 0, n: 0 }; setScene('calibrate'); }
      else if (id === 's:offDec') P.latency = clamp(P.latency - 10, -250, 250);
      else if (id === 's:offInc') P.latency = clamp(P.latency + 10, -250, 250);
      else if (id === 's:guide') P.guide = !P.guide;
      else if (id === 's:calm') P.calm = !P.calm;
      else if (id === 's:sound') { P.sound = !P.sound; audio.setMuted?.(!P.sound); }
      savePrefs(); if (id !== 'back') tap();
    } else if (sc === 'calibrate') {
      if (id === 'back') setScene('settings');
      else if (id === 'cal:apply') { if (state.calib.offset !== null) state.prefs.latency = state.calib.offset; savePrefs(); setScene('settings'); }
      else if (id === 'cal:retry') state.calib = { phase: 'idle', t: 0, taps: [], beats: [], fired: 0, offset: 0, n: 0 };
    } else if (sc === 'demo-limit') { if (id === 'back') setScene('title'); }
  }
  function hitButton(list, x, y) {
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (b.passive || (b.disabled && !b.row)) continue;
      if (inRect(b.r, x, y)) return b;
    }
    return null;
  }

  // ---- main update ---------------------------------------------------------------------------------------------------------------------------
  function update(dt, input) {
    state.t += dt;
    if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
    const L = lay(), p = input.pointer, fx = state.fx;
    if (!state.paused) {
      for (const r of fx.ripples) r.age += dt; fx.ripples = fx.ripples.filter((r) => r.age < 0.8);
      for (const s of ['B', 'T', 'S']) fx.glow[s] = Math.max(0, fx.glow[s] - dt * 5);
      fx.shake.k = Math.max(0, fx.shake.k - dt * 7);
      for (const sp of fx.sparks) { sp.age += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 700 * dt; } fx.sparks = fx.sparks.filter((sp) => sp.age < sp.life);
      for (const hd of fx.hands) hd.age += dt; fx.hands = fx.hands.filter((hd) => hd.age < 0.4);
      for (const pp of fx.pops) pp.age += dt; fx.pops = fx.pops.filter((pp) => pp.age < 0.85);
      for (const k of Object.keys(fx.chips)) fx.chips[k] = Math.max(0, fx.chips[k] - dt * 4);
      if (state.hud.msgT > 0) state.hud.msgT -= dt;
      if (state.hud.roundMsg) { state.hud.roundMsg.age += dt; if (state.hud.roundMsg.age > 2.4) state.hud.roundMsg = null; }
    }
    let tap = p.pressed ? { x: p.x, y: p.y } : null;
    if (input.keys.pressed.has('Escape')) {
      if (state.scene === 'play') { if (state.auto.on) leaveToMenu(); else state.paused = !state.paused; }
      else if (state.scene === 'calibrate') setScene('settings');
      else if (state.scene !== 'title') setScene('title');
      tap = null;
    }
    const buttons = buttonsFor(state, L);
    let consumed = false;
    if (tap) {
      const b = hitButton(buttons, tap.x, tap.y);
      if (b && b.modal) consumed = true;
      else if (b) {
        const bodyOnly = state.scene === 'settings' && (b.row || b.scrolled);
        if (!bodyOnly || inRect(L.page.body, tap.x, tap.y)) {
          if (!(state.scene === 'settings' && state.page.drag?.moved)) press(b.id);
          consumed = true;
        }
      }
    }
    const avoid = buttons.filter((b) => !b.modal && (!b.invisible || b.id === 'home')).map((b) => b.r);

    if (state.scene === 'title') {
      for (const h of collectStrikes(input, L, avoid)) strikeAt(h.stroke, h.x, h.y, h.vel, h.age);
    } else if (state.scene === 'play') {
      if (state.paused || state.auto.on) drumInput.queue.length = 0;
      if (state.auto.on) autoUpdate(dt);
      else if (!state.paused) {
        for (const h of collectStrikes(input, L, avoid)) strikeAt(h.stroke, h.x, h.y, h.vel, h.age);
        if (state.mode === 'free') freeAdvance(dt); else advanceSong(dt);
      }
    } else if (state.scene === 'calibrate') {
      const raw = drumInput.queue.splice(0).map((h) => ({ age: h.age ?? 0 }));
      if (!raw.length && !drumInput.native && tap && !consumed) raw.push({ age: 0 });
      for (const k of input.keys.pressed) if (KEYS[k]) raw.push({ age: 0 });
      calibUpdate(dt, raw);
    } else {
      drumInput.queue.length = 0;
      if (state.scene === 'rules' || state.scene === 'about' || state.scene === 'how' || state.scene === 'settings' || state.scene === 'pick') scrollUpdate(input, state.scene === 'pick' ? pickLayout(L).det : L.page.body);
      else if (state.scene === 'result') scrollUpdate(input, resultLayout(state, L).region);
      else wheelInput.dy = 0;
    }
  }

  return {
    update,
    render(ctx) { const L = lay(), s = L.play.status; meta.previewBadge = { x: s.x + 2, y: s.y + s.h * 0.5 - 14, align: 'left' }; render(ctx, state, L); },
    getState: () => state,
    // Real play only counts toward the free-preview timer: menus, pages, Auto Play, results and a paused game are exempt.
    isPreviewExempt() { return !(state.scene === 'play' && !state.auto.on && !state.paused); },
  };
}
