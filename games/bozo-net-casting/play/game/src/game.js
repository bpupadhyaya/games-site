// Bozo Net Casting: state and flow. The river and the judging live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (session, daily, free, watch), result, collection (the Logbook), settings, howto/about/rules, demolimit.
// Play phases: aim (choose net and depth, press the water) -> swing (hold, the net opens and closes) -> cast (flight, sink,
// haul, release: the fish are counted and let go) -> settle (banner) -> next cast.
import {
  NETS, DEPTHS, SPECIES, WATERS, SEASONS, SESSION_CASTS, TRAY_SIZE, FLIGHT, Z_MIN, Z_MAX, HOLD_MIN, WIDE_OPEN,
  makeConditions, evaluateCast, advise, adviceWhy, openness, seeded, clamp,
} from './sim.js';
import { makeCam, resetArt, FISHER, netState, castDuration } from './art.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect, depthSegs } from './layout.js';
import { renderPlay, layoutOf } from './view.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderCollection,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit, netOwned, waterOwned, bestOf,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_RUNS = 3;
const FAST = 2.6;        // playback speed while the player holds a finger down to hurry a cast
const FINGER_UP = 64;    // the landing spot rides this far above the finger so the hand does not hide it
const TAU = Math.PI * 2;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), runRng = rng.fork(), attRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, textIdx: 0, thinkIdx: 1 },
    record: { bestCast: 0, bestDaily: 0, dailyDay: -1, bestSession: [0, 0, 0, 0], casts: 0, sessions: 0, fish: 0, wide: 0, species: SPECIES.map(() => 0), waterSel: 0, seasonSel: 1, demoRuns: 0 },
    run: null,
    aim: { tray: [0, 1, 2], sel: 0, depth: 1, x: 0, z: 10, fx: 0, fy: 0, hold: 0, open: 0, has: false, drag: false, swinging: false, kbd: false, openWas: false },
    ws: null, att: null, attPose: { mode: 'idle', net: 0 }, pose: { mode: 'idle', net: 0 },
    hint: null, dec: null, pops: [], banner: null, shake: 0, toast: '', toastT: 0, scoreShown: 0,
    last: null, collSel: null, collBack: 'title', restoreMsg: '', ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, hold: 0, settleT: 0, attN: 0, hintAge: 0,
  };
  Object.defineProperty(state, 'monetization', { value: monetization, enumerable: false });
  syncSize();
  const newWorld = (water, world) => ({ water, world, t: 0, cast: null, ripples: [], parts: [], wait: 0 });
  state.ws = newWorld(0, makeConditions(0, 1, attRng));

  // ---- persistence ----------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const rec = state.record;
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(rec.bestSession) || rec.bestSession.length < 4) rec.bestSession = [0, 0, 0, 0];
    if (!Array.isArray(rec.species) || rec.species.length < SPECIES.length) rec.species = SPECIES.map((_, i) => (rec.species && rec.species[i]) | 0);
    rec.waterSel = clamp(rec.waterSel | 0, 0, WATERS.length - 1);
    rec.seasonSel = clamp(rec.seasonSel | 0, 0, SEASONS.length - 1);
    if (!waterOwned(rec, rec.waterSel)) rec.waterSel = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });
  const ownedNets = () => NETS.map((_, i) => i).filter((i) => netOwned(state.record, i));

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const PENTA = [0, 2, 4, 7, 9];
  const sfx = {
    whoosh: () => tone({ freq: 200, to: 620, dur: 0.3, type: 'sawtooth', vol: 0.022 }),
    swing: (v) => tone({ freq: 140 + v * 260, dur: 0.05, type: 'sine', vol: 0.02 }),
    splash: (s = 1) => { tone({ freq: 220, to: 70, dur: 0.28, type: 'triangle', vol: 0.11 * Math.min(1.3, s) }); tone({ freq: 1800 + fxRng.next() * 700, to: 700, dur: 0.07, type: 'triangle', vol: 0.03 }); },
    haul: () => tone({ freq: 120, to: 180, dur: 0.5, type: 'sawtooth', vol: 0.02 }),
    fish: (n) => { const semis = PENTA[n % 5] + 12 * Math.min(2, Math.floor(n / 5)); tone({ freq: 392 * Math.pow(2, semis / 12), dur: 0.14, type: 'sine', vol: 0.1 }); },
    tick: () => tone({ freq: 900, dur: 0.035, type: 'triangle', vol: 0.045 }),
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })),
    open: () => tone({ freq: 880, dur: 0.09, type: 'sine', vol: 0.05 }),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };
  const pop = (text, x, z, y, col = '#fff', size = 1) => { if (state.pops.length < 10) state.pops.push({ text, x, z, y, col, size, t: 0, max: 1.1 }); };
  const spray = (list, x, z, n, power = 1) => {
    for (let i = 0; i < n && list.length < 100; i++) {
      const a = fxRng.next() * TAU, v = (0.25 + fxRng.next() * 0.9) * power;
      list.push({ x, y: 0.02, z, vx: Math.cos(a) * v * 0.7, vy: 0.8 + fxRng.next() * 1.6 * power, vz: Math.sin(a) * v * 0.7, t: 0, max: 0.6 + fxRng.next() * 0.5, size: 0.025 + fxRng.next() * 0.025 });
    }
  };
  const stepParts = (list, dt) => {
    for (const q of list) { q.t += dt; q.vy -= 9.8 * dt * 0.8; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; }
    for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= list[i].max || list[i].y < -0.05) list.splice(i, 1);
  };
  const addRipple = (ws, x, z, s) => { ws.ripples.push({ x, z, t0: ws.t, s }); if (ws.ripples.length > 40) ws.ripples.shift(); };

  // ---- casting ---------------------------------------------------------------------------------------------------
  const makeCast = (world, x, z, net, depth, open, tRel) => {
    const res = evaluateCast(world, { x, z, net, depth, open, tRel }, true);
    const caughtIdx = {};
    for (const c of res.caught) caughtIdx[c.shoal * 100 + c.fish] = c;
    return { x, z, net, depth, open, tRel, t0: tRel, res, caughtIdx, ev: 0 };
  };
  // Fires the one-off events of a cast (landing, closing, hauling, releasing) as its clock passes them.
  const castEvents = (ws, onRelease) => {
    const c = ws.cast;
    if (!c) return;
    const tt = ws.t - c.t0, res = c.res;
    if (c.ev < 1 && tt >= FLIGHT) {
      c.ev = 1;
      addRipple(ws, c.x, c.z, 0.7 + res.R * 0.5); spray(ws.parts, c.x, c.z, 14, 1.1); sfx.splash(1);
      if (ws === state.ws) state.shake = Math.max(state.shake, 0.18);
    }
    if (c.ev < 2 && tt >= FLIGHT + res.sinkDur) { c.ev = 2; sfx.haul(); }
    if (c.ev < 3 && tt >= FLIGHT + res.sinkDur + 1.5) {
      c.ev = 3;
      const ns = netState(c, tt);
      addRipple(ws, ns.x, ns.z, 0.9); spray(ws.parts, ns.x, ns.z, 10 + Math.min(20, res.count * 2), 1.0);
      if (onRelease) onRelease(c, ns);
    }
  };
  const castDone = (ws) => !!ws.cast && ws.t - ws.cast.t0 >= castDuration(ws.cast);

  // ---- pose of the fisher -------------------------------------------------------------------------------------------
  const poseOf = (ws, A) => {
    const c = ws.cast;
    if (c) {
      const tt = ws.t - c.t0, res = c.res;
      const dir = clamp((c.x - FISHER.x) / (0.3 * (c.z + 3)), -1, 1);
      if (tt < 0.5) return { mode: 'throw', u: tt / 0.5, aim: dir, net: c.net };
      if (tt < FLIGHT + res.sinkDur) return { mode: 'throw', u: 1, aim: dir, net: c.net };
      if (tt < FLIGHT + res.sinkDur + 1.5) return { mode: 'haul', u: (tt - FLIGHT - res.sinkDur) / 1.5, net: c.net };
      return { mode: 'release', u: Math.min(1, (tt - FLIGHT - res.sinkDur - 1.5) / 1.6), net: c.net };
    }
    if (A && A.has && A.swinging) {
      const T = NETS[A.tray[A.sel]].T;
      return { mode: 'swing', p: A.hold / T, s: A.open, net: A.tray[A.sel] };
    }
    return { mode: 'idle', net: A ? A.tray[A.sel] : 0 };
  };

  // ---- the title-screen demo -------------------------------------------------------------------------------------------------------
  const ATT_WATERS = [0, 2, 1, 3];
  const newAttract = () => {
    const w = ATT_WATERS[state.attN++ % ATT_WATERS.length];
    state.att = newWorld(w, makeConditions(w, 1, attRng));
    state.att.wait = 1.6;
  };
  const updateAttract = (dt) => {
    if (!state.att) newAttract();
    const a = state.att;
    a.t += dt; stepParts(a.parts, dt);
    if (!a.cast) {
      a.wait -= dt;
      if (a.wait <= 0) {
        const adv = advise(a.world, [0, 1, 2], a.t);
        if (adv) a.cast = makeCast(a.world, adv.x, adv.z, adv.net, adv.depth, 1, a.t + adv.T * 0.5);
        else newAttract();
      }
    } else {
      castEvents(a, null);
      if (a.t - a.cast.t0 > castDuration(a.cast) + 1.0) newAttract();
    }
    state.attPose = state.att.cast ? poseOf(state.att, null) : { mode: 'idle', net: 0 };
  };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  const castRng = (run) => (run.mode === 'daily' ? seeded(state.day * 977 + run.idx * 31 + 5) : runRng);
  const trayFor = (run) => {
    const src = run.mode === 'daily' ? NETS.map((_, i) => i) : ownedNets();
    const r = run.mode === 'daily' ? seeded(state.day * 613 + run.idx * 17 + 3) : runRng;
    const tray = r.shuffle(src).slice(0, TRAY_SIZE);
    while (tray.length < TRAY_SIZE) tray.push(tray[0] ?? 0);
    return tray;
  };
  const beginCast = () => {
    const run = state.run, A = state.aim;
    const world = makeConditions(run.water, run.season, castRng(run));
    state.ws = newWorld(run.water, world);
    A.tray = trayFor(run); A.sel = 0; A.has = false; A.drag = false; A.swinging = false; A.kbd = false; A.hold = 0; A.open = 0;
    run.phase = 'aim'; run.fast = false;
    state.hint = null; state.dec = null; state.banner = null; state.pops.length = 0; state.hold = 0.35; state.hintAge = 0;
    state.scoreShown = run.mode === 'free' ? 0 : run.total;
    if (run.mode === 'watch') {
      const adv = advise(world, A.tray, 0.5);
      state.dec = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], adv };
    }
  };
  const startRun = (mode) => {
    const rec = state.record;
    if (state.demo && mode !== 'watch' && rec.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const water = mode === 'daily' ? state.day % WATERS.length : rec.waterSel;
    const season = mode === 'daily' ? (state.day * 7 + 1) % SEASONS.length : rec.seasonSel;
    state.run = { mode, water, season, idx: 0, casts: [], total: 0, hints: 0, fish: 0, phase: 'aim', unlocks: [], fast: false, res: null, netId: 0 };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.last = null;
    state.aim.depth = 1;
    if (state.demo && mode !== 'watch') { rec.demoRuns++; save(); }
    beginCast();
    toast(mode === 'watch' ? 'Watch & Learn: the game thinks before every cast' : 'Pick a net and a depth, then press the water, hold and let go', 3.4);
  };
  const ownedSnapshot = () => ({ nets: NETS.map((_, i) => netOwned(state.record, i)), waters: WATERS.map((_, i) => waterOwned(state.record, i)) });
  const newUnlocks = (before) => {
    const out = [];
    NETS.forEach((n, i) => { if (!before.nets[i] && netOwned(state.record, i)) out.push(n.name); });
    WATERS.forEach((w, i) => { if (!before.waters[i] && waterOwned(state.record, i)) out.push(w.name); });
    return out;
  };
  const doCast = () => {
    const run = state.run, A = state.aim, ws = state.ws;
    if (!run || run.phase !== 'swing') return;
    const c = makeCast(ws.world, A.x, A.z, A.tray[A.sel], A.depth, A.open, ws.t);
    ws.cast = c; run.phase = 'cast'; A.has = false; A.swinging = false; A.drag = false; A.kbd = false; state.hint = null; state.hold = 0;
    run.res = c.res; run.netId = c.net;
    sfx.whoosh();
  };
  // The net has come in and the fish are counted: score it, show the tally, and (in a moment) the fish swim away again.
  const onRelease = (c, ns) => {
    const run = state.run, rec = state.record, res = c.res;
    const tally = {};
    res.caught.forEach((f) => { tally[f.sp] = (tally[f.sp] || 0) + 1; });
    const kinds = Object.keys(tally).sort((a, b) => tally[b] * SPECIES[b].pts - tally[a] * SPECIES[a].pts);
    kinds.forEach((k, i) => pop(`+${tally[k] * SPECIES[k].pts}`, ns.x + (i - (kinds.length - 1) / 2) * 0.9, ns.z + 0.5, 0.8 + 0.25 * i, i === 0 ? '#ffe36a' : '#ffffff', 1));
    for (let i = 0; i < Math.min(res.count, 8); i++) sfx.fish(i);
    const wasBest = res.score > rec.bestCast, before = ownedSnapshot();
    run.casts.push({ score: res.score, count: res.count, wide: res.wide, net: c.net });
    run.fish += res.count; run.total += res.score;
    state.scoreShown = run.mode === 'free' ? res.score : run.total;
    if (run.mode !== 'watch') {
      rec.casts++; rec.fish += res.count; if (res.wide) rec.wide++;
      kinds.forEach((k) => { rec.species[k] += tally[k]; });
      if (!run.hints && res.score > rec.bestCast) rec.bestCast = res.score;
      const unl = newUnlocks(before);
      if (unl.length) { run.unlocks = run.unlocks.concat(unl); sfx.win(); toast(`Unlocked: ${unl.join(', ')}`, 3.2); }
      save();
    }
    const note = res.count === 0 ? 'Empty net: lead the shoal, or sink faster' : wasBest && !run.hints && run.mode !== 'watch' ? 'New best cast!' : res.wide ? 'Wide open' : `net ${Math.round(c.open * 100)}% open`;
    state.banner = {
      text: String(res.score), sub: `${res.count} fish · ${note}`, col: res.score >= 15 || (wasBest && !run.hints) ? '#ffd36a' : '#ffffff', t: 0, max: 3.4,
      tally: kinds.map((k) => `${tally[k]} × ${SPECIES[k].name}`),
    };
    state.shake = Math.max(state.shake, 0.12);
  };
  const finishRun = () => {
    const run = state.run, rec = state.record, mode = run.mode;
    const scores = run.casts.map((c) => c.score);
    const r = { mode, total: run.total, casts: run.casts.slice(), bestCast: Math.max(0, ...scores), fish: run.fish, hints: run.hints, newBest: false, unlocks: run.unlocks, water: run.water };
    if (mode !== 'watch' && mode !== 'free') {
      rec.sessions++;
      if (!run.hints) {
        if (mode === 'session' && run.total > rec.bestSession[run.water]) { rec.bestSession[run.water] = run.total; r.newBest = run.total > 0; }
        if (mode === 'daily') { if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; } if (run.total > rec.bestDaily) { rec.bestDaily = run.total; r.newBest = run.total > 0; } }
      }
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.rev++;
    if (r.newBest) sfx.win();
  };
  const nextCast = () => {
    const run = state.run;
    if (run.mode !== 'free' && run.casts.length >= SESSION_CASTS) { finishRun(); return; }
    run.idx++;
    beginCast();
  };

  // ---- the Watch & Learn decision loop: THINK -> REVEAL -> ACT -----------------------------------------------------------------
  const updateWatch = (dt) => {
    const dec = state.dec, A = state.aim, run = state.run;
    if (!dec) return;
    dec.t += dt;
    if (dec.phase === 'think') {
      A.sel = Math.floor(dec.t / 0.7) % TRAY_SIZE;
      if (dec.t >= dec.dur) { dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; A.sel = Math.max(0, A.tray.findIndex((i) => i === dec.adv.net)); A.depth = dec.adv.depth; }
    } else if (dec.phase === 'reveal') {
      if (dec.t >= dec.dur) {
        dec.phase = 'go'; dec.t = 0; dec.dur = 0.5;
        // pick the landing spot again for the real moment of the cast (the shoals have moved on)
        const fresh = advise(state.ws.world, [A.tray[A.sel]], state.ws.t);
        if (fresh) { dec.adv = fresh; A.depth = fresh.depth; A.x = fresh.x; A.z = fresh.z; }
        A.has = true; A.swinging = true; A.hold = 0; A.open = 0; run.phase = 'swing';
      }
    }
  };
  const updateWatchSwing = (dt) => {
    const A = state.aim, net = NETS[A.tray[A.sel]];
    A.hold += dt;
    const target = net.T * 0.5;
    A.open = openness(Math.min(A.hold, target), net.T);
    if (A.hold >= target) { A.hold = target; A.open = 1; state.dec = null; doCast(); }
  };

  // ---- hint -------------------------------------------------------------------------------------------------------------
  const refreshHint = () => {
    const A = state.aim;
    const adv = advise(state.ws.world, A.tray, state.ws.t + 0.4);
    if (!adv) { state.hint = null; return; }
    state.hint = { adv, why: adviceWhy(adv, state.ws.world) };
    A.sel = Math.max(0, A.tray.findIndex((i) => i === adv.net));
    A.depth = adv.depth;
    state.hintAge = 0;
  };
  const requestThink = () => {
    const run = state.run;
    if (!run || run.phase !== 'aim' || state.paused || run.mode === 'watch') return;
    if (state.hint) { state.hint = null; sfx.tick(); return; }
    refreshHint();
    if (run.mode !== 'free') run.hints++;
    sfx.tick();
  };

  // ---- pause ------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRun = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hint = null; state.dec = null; state.rev++; };

  // ---- the play scene --------------------------------------------------------------------------------------------------------
  const scrollFlow = (ptr) => {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  };
  // Where on the water a finger at (px, py) points the net (the spot rides above the finger), kept inside the river.
  const aimFrom = (L, px, py) => {
    const cam = makeCam(L.stage);
    const w = cam.toWorld(px, py - FINGER_UP);
    const z = clamp(w.z, Z_MIN, Z_MAX), half = (((L.stage.w / 2) * (z + 3)) / cam.f) * 0.9;
    return { x: clamp(w.x, -half, half), z };
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
    else if (id === 'quit') leaveRun();
  }
  const cancelSwing = (run, A, msg) => { run.phase = 'aim'; A.has = false; A.swinging = false; A.drag = false; A.kbd = false; A.hold = 0; A.open = 0; if (msg) toast(msg, 2.4); };
  const updatePlay = (dt, input) => {
    const run = state.run, ptr = input.pointer, keys = input.keys, watch = run.mode === 'watch', A = state.aim, ws = state.ws;
    const L = layoutOf(state);
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    // ---- input
    if (watch) {
      if (ptr.pressed) {
        const D = L.demo, st = state.settings;
        const setThink = (v) => { st.thinkIdx = clamp(v, 0, THINK_STEPS.length - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[st.thinkIdx]} s`, 1.6); if (state.dec && state.dec.phase === 'think') state.dec.dur = THINK_STEPS[st.thinkIdx]; };
        if (inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) setThink(st.thinkIdx - 1);
        else if (inRect(D.inc, ptr.x, ptr.y)) setThink(st.thinkIdx + 1);
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveRun(); return; }
      }
    } else {
      if (ptr.pressed) {
        if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(L.think, ptr.x, ptr.y)) { requestThink(); }
        else if (run.phase === 'aim' && state.hold <= 0) {
          let tray = -1;
          L.tray.forEach((r, k) => { if (inRect(r, ptr.x, ptr.y)) tray = k; });
          if (tray >= 0 && tray < A.tray.length) { if (A.sel !== tray) { A.sel = tray; sfx.tick(); } }
          else if (inRect(L.depth, ptr.x, ptr.y)) {
            depthSegs(L.depth).forEach((s, i) => { if (inRect(s, ptr.x, ptr.y) && A.depth !== i) { A.depth = i; sfx.tick(); } });
          } else if (inRect(L.stage, ptr.x, ptr.y) && !inRect(L.river, ptr.x, ptr.y)) {
            // press the water: the net starts to swing and its landing spot follows the finger
            const p = aimFrom(L, ptr.x, ptr.y);
            A.x = p.x; A.z = p.z; A.fx = ptr.x; A.fy = ptr.y; A.hold = 0; A.open = 0; A.has = true; A.swinging = true; A.drag = true; A.openWas = false; run.phase = 'swing'; state.hint = null;
          }
        } else if (run.phase === 'cast') { run.fast = true; }
        else if (run.phase === 'settle' && state.settleT > 0.6) { nextCast(); return; }
      }
      if (run.phase === 'swing' && A.drag) {
        if (ptr.down) { const p = aimFrom(L, ptr.x, ptr.y); A.x = p.x; A.z = p.z; A.fx = ptr.x; A.fy = ptr.y; }
        if (ptr.released || !ptr.down) {
          A.drag = false;
          if (A.hold >= HOLD_MIN) doCast();
          else cancelSwing(run, A, 'Hold to swing the net, then let go when it is wide open');
        }
      }
      if (!ptr.down) run.fast = false;
      if (run.phase === 'aim' && state.hold <= 0) {
        for (let k = 0; k < TRAY_SIZE; k++) if (keys.pressed.has(`Digit${k + 1}`)) { A.sel = k; sfx.tick(); }
        if (keys.pressed.has('KeyQ')) { A.depth = Math.max(0, A.depth - 1); sfx.tick(); }
        if (keys.pressed.has('KeyE')) { A.depth = Math.min(DEPTHS.length - 1, A.depth + 1); sfx.tick(); }
        if (keys.pressed.has('Space')) { A.has = true; A.swinging = true; A.kbd = true; A.hold = 0; A.open = 0; A.openWas = false; run.phase = 'swing'; state.hint = null; A.z = clamp(A.z, Z_MIN, Z_MAX); }
      }
      if (run.phase === 'swing' && A.kbd) {
        const kx = (keys.down.has('ArrowLeft') || keys.down.has('KeyA') ? -1 : 0) + (keys.down.has('ArrowRight') || keys.down.has('KeyD') ? 1 : 0);
        const kz = (keys.down.has('ArrowUp') || keys.down.has('KeyW') ? 1 : 0) + (keys.down.has('ArrowDown') || keys.down.has('KeyS') ? -1 : 0);
        A.x = clamp(A.x + kx * dt * 4, -6, 6); A.z = clamp(A.z + kz * dt * 5, Z_MIN, Z_MAX);
        if (!keys.down.has('Space')) { A.kbd = false; if (A.hold >= HOLD_MIN) doCast(); else cancelSwing(run, A, null); }
      }
      if (keys.pressed.has('KeyH')) requestThink();
      if (run.phase === 'settle' && keys.pressed.has('Enter') && state.settleT > 0.4) { nextCast(); return; }
    }
    if (state.paused) return;
    // ---- time passes
    if (state.hold > 0) state.hold = Math.max(0, state.hold - dt);
    if (watch && run.phase === 'aim' && state.hold <= 0) updateWatch(dt);
    if (run.phase === 'swing') {
      const T = NETS[A.tray[A.sel]].T;
      if (!watch) {
        A.hold += dt; A.open = openness(A.hold, T);
        const was = Math.floor(((A.hold - dt) / T) * 2), now = Math.floor((A.hold / T) * 2);
        if (now !== was) sfx.swing(now % 2);
        const wide = A.open >= WIDE_OPEN;
        if (wide && !A.openWas) sfx.open();
        A.openWas = wide;
      } else updateWatchSwing(dt);
    }
    const sdt = run.phase === 'cast' && run.fast ? dt * FAST : dt;
    ws.t += sdt;
    stepParts(ws.parts, sdt);
    if (run.phase === 'cast') {
      castEvents(ws, onRelease);
      if (castDone(ws)) { run.phase = 'settle'; state.settleT = 0; }
    }
    if (run.phase === 'settle') {
      state.settleT += dt;
      if (watch && state.settleT > 2.4) nextCast();
      else if (!watch && state.settleT > 9) nextCast();
    }
    if (state.hint && run.phase === 'aim') { state.hintAge += dt; if (state.hintAge > 0.7) refreshHint(); }
    for (const p of state.pops) p.t += sdt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.6);
    state.pose = poseOf(ws, A);
  };

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'session' || id === 'daily' || id === 'free' || id === 'watch') startRun(id);
    else if (id === 'collection') { state.collBack = 'title'; state.collSel = null; state.scene = 'collection'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (state.restoreMsg === 'Checking with the store…') return;   // already busy
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found for this store account.'; state.rev++; }).catch(() => { state.restoreMsg = 'The store is not available right now. Please try again.'; state.rev++; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.rev++; save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.last;
    if (id === 'again') startRun(r ? r.mode : 'session');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'collection') { state.collBack = 'result'; state.collSel = null; state.scene = 'collection'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) { Promise.resolve(env.share?.(`I netted ${r.total} points of fish in one Bozo Net Casting session in Arcforge!`)).catch(() => {}); }
  };
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    ensureLayout(state, key);
    { const m0 = flowMeta(); state.ui.scroll = clamp(state.ui.scroll, 0, m0.lay ? Math.max(0, m0.lay.contentH - (m0.bottom - m0.top)) : 0); }
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta(), scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.rev++; save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.rev++; save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
    void dt;
  };
  const updateCollection = (dt, input) => {
    const ptr = input.pointer, rec = state.record;
    ensureLayout(state, 'collection');
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10) {
        const h = collectionHit(ptr.x, ptr.y);
        if (h) {
          const same = state.collSel && state.collSel.kind === h.kind && state.collSel.i === h.i;
          if (h.kind === 'w' && same && waterOwned(rec, h.i) && rec.waterSel !== h.i) { rec.waterSel = h.i; save(); resetArt(); sfx.win(); } else sfx.tick();
          state.collSel = { kind: h.kind, i: h.i }; state.rev++;
        } else {
          const id = hitScreen(ptr.x, ptr.y, state.ui.scroll);
          if (id === 'back') { state.scene = state.collBack; state.ui.scroll = 0; state.rev++; sfx.tick(); }
          else if (id && id.startsWith('season-')) { rec.seasonSel = clamp(+id.slice(7), 0, SEASONS.length - 1); save(); sfx.tick(); state.rev++; }
        }
      }
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    state.ui.scroll = clamp(state.ui.scroll, 0, max);
    if (input.keys.pressed.has('Escape')) { state.scene = state.collBack; state.ui.scroll = 0; state.rev++; }
    void dt;
  };
  let refDrag = null, wheelHooked = false;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, RL = refLayout(), set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y) || inRect(RL.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(RL.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.refScroll = 0; state.rev++; save(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.refScroll = 0; state.rev++; save(); }
      else if (inRect(RL.panel, ptr.x, ptr.y)) refDrag = { y0: ptr.y, s0: state.refScroll };
    }
    if (refDrag) { if (ptr.down) set(refDrag.s0 - (ptr.y - refDrag.y0)); else refDrag = null; }
    if (keys.pressed.has('ArrowDown')) set(state.refScroll + 70);
    if (keys.pressed.has('ArrowUp')) set(state.refScroll - 70);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) set(state.refScroll + REF.view * 0.9);
    if (keys.pressed.has('PageUp')) set(state.refScroll - REF.view * 0.9);
    if (keys.pressed.has('Home')) set(0);
    if (keys.pressed.has('End')) set(1e9);
    if (keys.pressed.has('Escape')) close();
  };

  resetMenus();
  newAttract();
  for (let i = 0; i < 60 * 2; i++) updateAttract(1 / 60);

  // Store screenshots (main.js calls this only for ?shot=1&scene=...): put the game in a named moment and run it forward.
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  const shotScene = (name) => {
    const rec = state.record;
    rec.bestCast = 33; rec.bestDaily = 24; rec.bestSession = [88, 71, 52, 0]; rec.dailyDay = state.day; rec.casts = 140; rec.sessions = 24; rec.fish = 620; rec.wide = 41;
    rec.species = [86, 71, 44, 21, 18, 9, 6, 2];
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { advance(150); return; }
    const startCast = (water, season) => { rec.waterSel = water; rec.seasonSel = season; startRun('session'); state.toastT = 0; state.hold = 0; };
    if (name === 'aim') { startCast(2, 1); advance(200); requestThink(); advance(5); return; }
    if (name === 'swing') {
      startCast(0, 1); advance(120);
      const L = layoutOf(state), cam = makeCam(L.stage), sh = state.ws.world.shoals[0];
      const sx = cam.X(sh.c0.x, sh.c0.z), sy = cam.Y(0, sh.c0.z) + FINGER_UP;
      state.aim.depth = 1; state.aim.x = sh.c0.x; state.aim.z = sh.c0.z; state.aim.fx = sx; state.aim.fy = sy;
      state.aim.has = true; state.aim.swinging = true; state.aim.hold = NETS[state.aim.tray[0]].T * 0.46; state.aim.open = 0.95; state.run.phase = 'swing'; state.aim.drag = false;
      state.pose = poseOf(state.ws, state.aim);
      return;
    }
    if (name === 'cast' || name === 'banner') {
      startCast(name === 'cast' ? 1 : 2, 1);
      advance(120);
      const adv = advise(state.ws.world, state.aim.tray, state.ws.t);
      state.aim.sel = Math.max(0, state.aim.tray.indexOf(adv.net)); state.aim.depth = adv.depth;
      const ws = state.ws;
      const c = makeCast(ws.world, adv.x, adv.z, adv.net, adv.depth, 1, ws.t);
      ws.cast = c; state.run.phase = 'cast'; state.run.res = c.res; state.aim.has = false; state.aim.swinging = false;
      const total = castDuration(c), target = name === 'cast' ? FLIGHT + Math.min(c.res.sinkDur * 0.55, 1.2) : total - 1.1;
      for (let i = 0; i < 60 * 20 && ws.t - c.t0 < target; i++) advance(1);
      return;
    }
    if (name === 'collection') { state.scene = 'collection'; state.collBack = 'title'; state.collSel = { kind: 'f', i: 6 }; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      state.last = { mode: 'session', total: 71, casts: [{ score: 14, count: 12, wide: true }, { score: 9, count: 8, wide: false }, { score: 17, count: 11, wide: true }, { score: 6, count: 5, wide: false }, { score: 15, count: 9, wide: true }, { score: 10, count: 8, wide: false }], bestCast: 17, fish: 53, hints: 0, newBest: false, unlocks: [], water: 0 };
      state.scene = 'result'; state.rev++; advance(3); return;
    }
    if (name === 'watch') {
      rec.waterSel = 0; state.settings.thinkIdx = 1;
      startRun('watch'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 12 && !(state.dec && state.dec.phase === 'reveal' && state.dec.t > 0.8); i++) advance(1);
      return;
    }
    if (name === 'pause') { startRun('session'); state.toastT = 0; state.hold = 0; openPause(); advance(2); }
  };

  const api = {
    // Watch & Learn, the Logbook and every menu are free; only real play counts against the free preview (a paused run does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.run && state.run.mode !== 'watch') || state.paused || state.hold > 0,
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'settings', 'result', 'demolimit', 'collection'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      syncSize();
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'collection': updateCollection(dt, input); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      // The preview pill rides on the top edge of the river, below the score and current strips (never over the HUD).
      if (state.scene === 'play' && state.run) { const st = layoutOf(state).stage; meta.previewBadge = { x: st.x + st.w / 2, y: st.y + 6, align: 'center' }; }
      else meta.previewBadge = null;
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'collection': renderCollection(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.run) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
    shotScene,
  };
  void bestOf;
  return api;
}
