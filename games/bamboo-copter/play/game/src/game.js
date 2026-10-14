// Bamboo Copter: state and flow. Physics live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the flight step.
//
// Scenes: title, play (session, daily, free, watch), result, collection, settings, howto/about/rules, demolimit.
// Play phases: aim (choose a rotor, set the lean, rub the shaft, let go) -> fly (stepped live, leaning with the finger)
// -> settle (banner) -> next flight.
import {
  ROTORS, SCENES, SESSION_FLIGHTS, DT, RUB_GAIN, RUB_V_FULL, RUB_V_SLIP, COOL, CHARGE_MAX, OVERHEAT, HOLD_HOT, START_H,
  makeConditions, launch, stepFlight, scoreOf, policy, simulate, advise, adviceWhy, drawTray, seeded, groundAt, rankFor, clamp,
} from './sim.js';
import { stepFx, burst, seedLeaves, resetArt, FIT_M } from './art.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect, trackOf } from './layout.js';
import { renderPlay, layoutOf, cradleCenter } from './view.js';
import { v3 } from './v3.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderCollection,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit, rotorOwned, sceneOwned,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_RUNS = 3;
const FAST = 3;
const ATT_SCENES = [0, 1, 2, 3];
const DIARY_MAX = 40;
const LAND_WORD = ['Gentle landing', 'Outer ring', 'Inner ring', 'Bullseye'];

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), runRng = rng.fork(), flyRng = rng.fork(), attRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, textIdx: 0, thinkIdx: 1 },
    record: { bestFlight: 0, bestHeight: 0, bestSession: [0, 0, 0, 0], bestDaily: 0, dailyDay: -1, flights: 0, sessions: 0, lanterns: 0, sceneSel: 0, demoRuns: 0, diary: [] },
    run: null, aim: { tray: [0, 1, 2], sel: 0, lean: 0, charge: 0, rev: 0, rubDir: 0, drag: null, hotT: 0, speed: 0, perfectNow: false, slip: 0, lastDir: 0, keyRub: false },
    ws: null, att: null, hint: null, dec: null, pops: [], banner: null, shake: 0, toast: '', toastT: 0, scoreShown: 0,
    last: null, collSel: null, collBack: 'title', restoreMsg: '', ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, hold: 0, settleT: 0, attN: 0,
  };
  syncSize();
  const newWorld = (scene, cond) => ({ scene, cond: cond || null, t: 0, cam: { x: 0, y: 0 }, f: null, parts: [], blend: 1 });
  state.ws = newWorld(0, null);

  // ---- persistence ----------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const rec = state.record;
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(rec.bestSession) || rec.bestSession.length < 4) rec.bestSession = [0, 0, 0, 0];
    if (!Array.isArray(rec.diary)) rec.diary = [];
    rec.sceneSel = clamp(rec.sceneSel | 0, 0, SCENES.length - 1);
    if (!sceneOwned(rec, rec.sceneSel)) rec.sceneSel = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });
  const ownedList = () => ROTORS.map((_, i) => rotorOwned(state.record, i));

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const PENTA = [0, 2, 4, 7, 9];
  const sfx = {
    rub: (c) => tone({ freq: 140 + c * 420, to: 160 + c * 460, dur: 0.07, type: 'triangle', vol: 0.03 }),
    whirr: (s) => tone({ freq: 120 + s * 260, dur: 0.12, type: 'sawtooth', vol: 0.012 }),
    go: () => tone({ freq: 300, to: 760, dur: 0.3, type: 'sine', vol: 0.06 }),
    chime: (n) => { const semis = PENTA[n % 5] + 12; tone({ freq: 523 * Math.pow(2, semis / 12), dur: 0.3, type: 'sine', vol: 0.1 }); tone({ freq: 1046 * Math.pow(2, semis / 12), dur: 0.12, type: 'triangle', vol: 0.03 }); },
    land: (r) => { const semis = [0, 4, 7, 12][r]; tone({ freq: 330 * Math.pow(2, semis / 12), dur: 0.35, type: 'sine', vol: 0.11 }); if (r > 0) tone({ freq: 660 * Math.pow(2, semis / 12), dur: 0.25, type: 'triangle', vol: 0.05 }); },
    tick: () => tone({ freq: 900, dur: 0.035, type: 'triangle', vol: 0.045 }),
    slide: (v) => tone({ freq: 400 + v * 500, dur: 0.03, type: 'sine', vol: 0.025 }),
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })),
    slip: () => tone({ freq: 220, to: 90, dur: 0.18, type: 'sawtooth', vol: 0.03 }),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };
  const pop = (text, x, y, col = '#fff', size = 1) => { if (state.pops.length < 8) state.pops.push({ text, x, y, col, size, t: 0, max: 0.9 }); };

  // ---- camera ----------------------------------------------------------------------------------------------------
  const visHOf = () => { const st = layoutOf(state).stage; return st.h / (st.w / FIT_M); };
  const baseCamY = (cond, vis) => (cond ? groundAt(cond, 0) : 0) + 0.36 * vis;
  const followCam = (ws, dt, vis) => {
    const f = ws.f, cam = ws.cam;
    if (!f) { cam.x += (0 - cam.x) * Math.min(1, dt * 4); cam.y += (baseCamY(ws.cond, vis) - cam.y) * Math.min(1, dt * 4); return; }
    const tx = f.x + clamp(f.vx * 0.9, -9, 9);
    const ty = Math.max(baseCamY(ws.cond, vis), f.y - 0.04 * vis, groundAt(ws.cond, f.x) + 0.2 * vis);
    cam.x += (tx - cam.x) * Math.min(1, dt * 2.6);
    cam.y += (ty - cam.y) * Math.min(1, dt * 2.2);
  };

  // ---- the title-screen demo -------------------------------------------------------------------------------------------------------
  const newAttract = () => {
    const scene = ATT_SCENES[state.attN++ % ATT_SCENES.length], cond = makeConditions(scene, attRng);
    const ro = ROTORS[[0, 3, 1, 5][state.attN % 4]], mid = (ro.sweet[0] + ro.sweet[1]) / 2;
    const ws = newWorld(scene, cond);
    ws.plan = { rotor: ro.id, charge: mid, lean: attRng.next() * 0.8 - 0.4 };
    ws.aim = cond.targets[0].x; ws.cam.x = 0; ws.cam.y = baseCamY(cond, 70); ws.rest = 0;
    ws.rubT = 0; ws.rubRev = 0; ws.charge = 0; ws.rubDir = 0;
    // with the 3D layer the demo starts in two hands rubbing the shaft; the 2D art launches at once
    if (v3.on) { ws.f = null; ws.blend = 0; } else { ws.f = launch(ws.plan, cond, attRng); ws.blend = 0; }
    seedLeaves(ws.parts, fxRng, ws.cam, scene, 12);
    state.att = ws;
  };
  const updateAttract = (dt) => {
    if (!state.att) newAttract();
    const ws = state.att;
    ws.t += dt;
    if (!ws.f) {
      ws.rubT += dt;
      const k = clamp(ws.rubT / 2.5, 0, 1);
      ws.charge = ws.plan.charge * (k * k * (3 - 2 * k));
      ws.rubDir = Math.sin(ws.rubT * 12.5) * (0.35 + 0.55 * Math.min(1, ws.rubT / 0.5));
      ws.rubRev += (1.2 + 9 * ws.charge) * dt * (0.4 + Math.abs(ws.rubDir));
      if (ws.rubT >= 2.9) { ws.f = launch(ws.plan, ws.cond, attRng); ws.f.rev = ws.rubRev; ws.blend = 1; }
    } else {
      const f = ws.f;
      if (ws.blend > 0) ws.blend = Math.max(0, ws.blend - dt * 2.2);
      if (!f.landed) stepFlight(f, ws.cond, policy(f, ws.cond, ws.aim), DT);
      else ws.rest += dt;
      if (f.landed && ws.rest > 2.2) newAttract();
    }
    followCam(ws, dt, 70);
    stepFx(ws.parts, dt, ws.cond, ws.t, ws.cam); seedLeaves(ws.parts, fxRng, ws.cam, ws.scene, 12);
  };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  const trayFor = (run) => {
    const src = run.mode === 'daily' ? ROTORS.map(() => true) : ownedList();
    const r = run.mode === 'daily' ? seeded(state.day * 613 + run.idx * 17 + 3) : runRng;
    const tray = drawTray(src, r, 3, run.mode === 'free' ? [] : run.used);
    while (tray.length < 3) tray.push(tray[0] ?? 0);
    return tray;
  };
  const flightCond = (run) => makeConditions(run.scene, run.mode === 'daily' ? seeded(state.day * 977 + run.idx * 31 + 5) : runRng);
  const plan4 = (adv, cond) => simulate({ rotor: adv.rotor.id, charge: adv.charge, lean: adv.lean }, cond, adv.aim, seeded(9), true).path;
  const beginFlight = () => {
    const run = state.run, cond = flightCond(run), A = state.aim;
    state.ws = newWorld(run.scene, cond);
    state.ws.cam.y = baseCamY(cond, visHOf());
    seedLeaves(state.ws.parts, fxRng, state.ws.cam, run.scene, 14);
    A.tray = trayFor(run); A.sel = 0; A.charge = 0; A.hotT = 0; A.drag = null; A.perfectNow = false; A.speed = 0; A.slip = 0; A.rubDir = 0; A.keyRub = false;
    run.phase = 'aim'; run.cond = cond; run.fast = false; run.aimX = null;
    state.hint = null; state.dec = null; state.banner = null; state.pops.length = 0; state.hold = 0.35;
    state.scoreShown = run.mode === 'free' ? 0 : run.total;
    if (run.mode === 'watch') {
      const adv = advise(A.tray.map((i) => ROTORS[i]), cond);
      state.dec = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], adv, path: plan4(adv, cond) };
    }
  };
  const startRun = (mode) => {
    const rec = state.record;
    if (state.demo && mode !== 'watch' && rec.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const scene = mode === 'daily' ? state.day % SCENES.length : rec.sceneSel;
    state.run = { mode, scene, idx: 0, flights: [], used: [], total: 0, hints: 0, phase: 'aim', cond: null, unlocks: [], lanterns: 0, highest: 0, fast: false, aimX: null };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.last = null;
    state.aim.lean = 0;
    if (state.demo && mode !== 'watch') { rec.demoRuns++; save(); }
    beginFlight();
    toast(mode === 'watch' ? 'Watch & Learn: the game thinks before every flight' : 'Pick a rotor, set the lean, then rub the shaft and let go', 3.4);
  };
  const doLaunch = (charge) => {
    const run = state.run, A = state.aim;
    if (!run || run.phase !== 'aim') return;
    const plan = { rotor: A.tray[A.sel], charge: clamp(charge, 0, CHARGE_MAX), lean: A.lean };
    const f = launch(plan, run.cond, flyRng);
    state.ws.f = f; state.ws.blend = 1;
    f.rev = A.rev;
    run.phase = 'fly'; run.plan = plan; run.aimX = run.mode === 'watch' && state.dec ? state.dec.adv.aim : null;
    A.drag = null; A.charge = 0; A.hotT = 0; A.keyRub = false; state.hint = null; state.hold = 0;
    sfx.go();
    if (f.perfect) { pop('Perfect', 0, f.y + 4, '#ffe36a', 1); sfx.chime(2); }
    if (f.hot) { toast('The grip slipped: too hot', 1.8); sfx.slip(); }
  };
  const ownedSnapshot = () => ({ rotors: ROTORS.map((_, i) => rotorOwned(state.record, i)), scenes: SCENES.map((_, i) => sceneOwned(state.record, i)) });
  const newUnlocks = (before) => {
    const out = [];
    ROTORS.forEach((s, i) => { if (!before.rotors[i] && rotorOwned(state.record, i)) out.push(s.name); });
    SCENES.forEach((p, i) => { if (!before.scenes[i] && sceneOwned(state.record, i)) out.push(p.name); });
    return out;
  };
  const onLand = () => {
    const run = state.run, f = state.ws.f, rec = state.record, sc = scoreOf(f);
    const hgt = Math.max(0, f.peak - f.g0 - START_H), rank = f.landing ? f.landing.rank : 0;
    run.phase = 'settle'; state.settleT = 0; state.shake = 0.18;
    run.flights.push({ score: sc.total, height: Math.round(hgt), lanterns: f.got, ring: rank, rotor: f.rotor });
    run.used.push(f.rotor); run.total += sc.total; run.lanterns += f.got; run.highest = Math.max(run.highest, Math.round(hgt));
    state.scoreShown = run.mode === 'free' ? sc.total : run.total;
    const wasBest = sc.total > rec.bestFlight, before = ownedSnapshot();
    sfx.land(rank);
    if (run.mode !== 'watch') {
      rec.flights++; rec.lanterns += f.got;
      if (!run.hints) {
        if (sc.total > rec.bestFlight) rec.bestFlight = sc.total;
        if (hgt > rec.bestHeight) rec.bestHeight = Math.round(hgt * 10) / 10;
      }
      rec.diary.push({ n: rec.flights, s: run.scene, r: f.rotor, h: Math.round(hgt), d: Math.round(Math.abs(f.x)), l: rank, sc: sc.total });
      if (rec.diary.length > DIARY_MAX) rec.diary.shift();
      const unl = newUnlocks(before);
      if (unl.length) { run.unlocks = run.unlocks.concat(unl); sfx.win(); toast(`Unlocked: ${unl.join(', ')}`, 3.2); }
      save();
    }
    const best = wasBest && !run.hints && run.mode !== 'watch';
    state.banner = {
      text: String(sc.total), col: best ? '#ffd36a' : '#ffffff', t: 0, max: 3,
      sub: [`${Math.round(hgt)} m high · ${f.got} lantern${f.got === 1 ? '' : 's'}${best ? ' · new best!' : ''}`, `${LAND_WORD[rank]}${rank ? ` +${sc.landing}` : ''}${sc.perfect ? ` · perfect +${sc.perfect}` : ''}`],
    };
    burst(state.ws.parts, fxRng, f.x, f.y + 1, rank > 0 ? 18 : 6, rank === 3 ? '#ffd23c' : '#ffffff');
  };
  const finishRun = () => {
    const run = state.run, rec = state.record, mode = run.mode;
    const counts = run.flights.map((t) => t.score);
    const r = { mode, total: run.total, flights: run.flights.slice(), bestFlight: Math.max(0, ...counts), highest: run.highest, lanterns: run.lanterns, hints: run.hints, newBest: false, unlocks: run.unlocks, scene: run.scene };
    if (mode !== 'watch' && mode !== 'free') {
      rec.sessions++;
      if (!run.hints) {
        if (mode === 'session' && run.total > rec.bestSession[run.scene]) { rec.bestSession[run.scene] = run.total; r.newBest = run.total > 0; }
        if (mode === 'daily') { if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; } if (run.total > rec.bestDaily) { rec.bestDaily = run.total; r.newBest = run.total > 0; } }
      }
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.rev++;
    if (r.newBest) sfx.win();
  };
  const nextFlight = () => {
    const run = state.run;
    if (run.mode !== 'free' && run.flights.length >= SESSION_FLIGHTS) { finishRun(); return; }
    run.idx++;
    beginFlight();
  };

  // ---- the Watch & Learn decision loop: THINK -> REVEAL -> ACT ---------------------------------------------------------------
  const updateWatch = (dt) => {
    const dec = state.dec, A = state.aim;
    if (!dec) return;
    dec.t += dt;
    if (dec.phase === 'think') {
      A.sel = Math.floor(dec.t / 0.7) % 3;
      if (dec.t >= dec.dur) { dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; A.sel = Math.max(0, A.tray.findIndex((i) => i === dec.adv.rotor.id)); }
    } else if (dec.phase === 'reveal') {
      A.lean += (dec.adv.lean - A.lean) * Math.min(1, dt * 6);
      if (dec.t >= dec.dur) { dec.phase = 'go'; dec.t = 0; dec.dur = 1.5; A.lean = dec.adv.lean; }
    } else if (dec.phase === 'go') {
      const k = clamp(dec.t / dec.dur, 0, 1);
      A.charge = dec.adv.charge * k; A.rubDir = Math.sin(dec.t * 16);
      if (Math.floor(dec.t * 12) !== Math.floor((dec.t - dt) * 12)) sfx.rub(A.charge);
      if (dec.t >= dec.dur) doLaunch(dec.adv.charge);
    }
  };

  // ---- hint -------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const run = state.run;
    if (!run || run.phase !== 'aim' || state.paused || run.mode === 'watch') return;
    if (state.hint) { state.hint = null; sfx.tick(); return; }
    const adv = advise(state.aim.tray.map((i) => ROTORS[i]), run.cond);
    state.hint = { adv, why: adviceWhy(adv, run.cond), path: plan4(adv, run.cond) };
    state.aim.sel = Math.max(0, state.aim.tray.findIndex((i) => i === adv.rotor.id));
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
  const setLean = (x) => {
    const L = layoutOf(state), t = trackOf(L.lean), v = clamp((x - t.x) / t.w, 0, 1), A = state.aim;
    let q = Math.round((v * 2 - 1) * 20) / 20;
    if (Math.abs(q) < 0.06) q = 0;
    if (A.lean !== q) { A.lean = q; sfx.slide((q + 1) / 2); }
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
  const screenX = (L, ws, wx) => L.stage.x + L.stage.w / 2 + (wx - ws.cam.x) * (L.stage.w / FIT_M);
  const stepFlightFrame = (dt, input, L, watch) => {
    const run = state.run, ws = state.ws, f = ws.f, ptr = input.pointer, keys = input.keys;
    let steer = 0;
    if (watch) steer = policy(f, run.cond, run.aimX);
    else {
      if (ptr.down && inRect(L.stage, ptr.x, ptr.y)) steer = clamp((ptr.x - screenX(L, ws, f.x)) / (L.stage.w * 0.22), -1, 1);
      if (keys.down.has('ArrowLeft') || keys.down.has('KeyA')) steer = -1;
      if (keys.down.has('ArrowRight') || keys.down.has('KeyD')) steer = 1;
    }
    const n = run.fast ? FAST : 1, got0 = f.got;
    for (let i = 0; i < n && !f.landed; i++) { stepFlight(f, run.cond, steer, DT); ws.t += dt; }
    for (let k = got0; k < f.got; k++) { sfx.chime(k); burst(ws.parts, fxRng, f.x, f.y, 10, '#ffd870'); pop('+10', f.x, f.y + 3, '#ffe36a', 1); }
    state.scoreShown = (run.mode === 'free' ? 0 : run.total) + scoreOf(f).total;
    if (Math.floor(ws.t * 6) !== Math.floor((ws.t - dt) * 6) && f.s > 0.1) sfx.whirr(f.s);
    if (f.landed) onLand();
  };
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
        if (inRect(L.think, ptr.x, ptr.y)) { requestThink(); A.drag = null; }
        else if (run.phase === 'aim' && state.hold <= 0) {
          let tray = -1;
          L.tray.forEach((r, k) => { if (inRect(r, ptr.x, ptr.y)) tray = k; });
          if (tray >= 0 && tray < A.tray.length) { if (A.sel !== tray) { A.sel = tray; sfx.tick(); } }
          else if (inRect(L.lean, ptr.x, ptr.y)) { A.drag = { kind: 'lean' }; setLean(ptr.x); }
          else if (inRect(L.stage, ptr.x, ptr.y) && ptr.y > L.stage.y + L.stage.h * 0.3) A.drag = { kind: 'rub', x: ptr.x };
        } else if (run.phase === 'fly' && inRect(L.hint, ptr.x, ptr.y)) { run.fast = !run.fast; sfx.tick(); }
        else if (run.phase === 'settle' && state.settleT > 0.6) { nextFlight(); return; }
      }
      if (run.phase === 'aim' && A.drag && ptr.down) {
        if (A.drag.kind === 'lean') setLean(ptr.x);
        else if (A.drag.kind === 'rub') {
          const v = Math.abs(ptr.x - A.drag.x) / dt;
          A.speed += (v - A.speed) * 0.4; A.drag.x = ptr.x;
          const c = cradleCenter(L.stage);
          A.rubDir = clamp((ptr.x - c.x) / 70, -1, 1);
          let gain = 0;
          if (A.speed > RUB_V_SLIP) { if (A.slip <= 0) sfx.slip(); A.slip = 0.4; }
          else if (A.speed > 120) gain = RUB_GAIN * Math.min(A.speed, RUB_V_FULL) / RUB_V_FULL;
          A.charge = clamp(A.charge + gain * dt, 0, CHARGE_MAX);
          const dir = Math.sign(ptr.x - c.x);
          if (dir !== 0 && dir !== A.lastDir && gain > 0) { A.lastDir = dir; sfx.rub(A.charge); }
        }
      }
      if (ptr.released && A.drag) {
        const d = A.drag; A.drag = null;
        if (d.kind === 'rub' && run.phase === 'aim') {
          if (A.charge >= 0.12) doLaunch(A.charge);
          else { A.charge = 0; toast('Rub the shaft side to side, then let go', 2.2); }
        }
      }
      if (run.phase === 'aim' && state.hold <= 0) {
        if (keys.pressed.has('KeyA') || keys.pressed.has('ArrowLeft')) { A.lean = clamp(A.lean - 0.1, -1, 1); sfx.slide((A.lean + 1) / 2); }
        if (keys.pressed.has('KeyD') || keys.pressed.has('ArrowRight')) { A.lean = clamp(A.lean + 0.1, -1, 1); sfx.slide((A.lean + 1) / 2); }
        for (let k = 0; k < 3; k++) if (keys.pressed.has(`Digit${k + 1}`)) { A.sel = k; sfx.tick(); }
        if (keys.down.has('Space')) { A.charge = clamp(A.charge + RUB_GAIN * 0.85 * dt, 0, CHARGE_MAX); A.rubDir = Math.sin(state.t * 20); A.keyRub = true; }
        else if (A.keyRub) { A.keyRub = false; if (A.charge >= 0.12) doLaunch(A.charge); else A.charge = 0; }
      }
      if (keys.pressed.has('KeyH')) requestThink();
      if (run.phase === 'settle' && keys.pressed.has('Enter') && state.settleT > 0.4) { nextFlight(); return; }
    }
    if (state.paused) return;
    // ---- time passes
    if (state.hold > 0) state.hold = Math.max(0, state.hold - dt);
    A.slip = Math.max(0, A.slip - dt);
    if (run.phase === 'aim') {
      if (watch && state.hold <= 0) updateWatch(dt);
      else if (!A.drag && !A.keyRub) { A.charge = Math.max(0, A.charge - COOL * dt); A.rubDir *= 0.9; }
      A.speed *= 0.9;
      A.rev += (1.2 + 9 * A.charge) * dt * (0.4 + Math.abs(A.rubDir));
      const ro = ROTORS[A.tray[A.sel] ?? 0];
      A.perfectNow = A.charge >= ro.sweet[0] && A.charge <= ro.sweet[1];
      if (A.charge > OVERHEAT && (A.drag || A.keyRub || (watch && state.dec && state.dec.phase === 'go'))) {
        A.hotT += dt;
        if (A.hotT >= HOLD_HOT && !watch) doLaunch(A.charge);
      } else A.hotT = Math.max(0, A.hotT - dt * 2);
      ws.t += dt;
      followCam(ws, dt, visHOf());
    } else if (run.phase === 'fly') {
      if (ws.blend > 0) ws.blend = Math.max(0, ws.blend - dt * 2.2);
      stepFlightFrame(dt, input, L, watch);
      followCam(ws, dt, visHOf());
    } else if (run.phase === 'settle') {
      ws.t += dt;
      state.settleT += dt;
      if (ws.blend > 0) ws.blend = Math.max(0, ws.blend - dt * 2.2);
      followCam(ws, dt, visHOf());
      if (watch && state.settleT > 2.6) nextFlight();
      else if (!watch && state.settleT > 9) nextFlight();
    }
    stepFx(ws.parts, dt, ws.cond, ws.t, ws.cam); seedLeaves(ws.parts, fxRng, ws.cam, ws.scene, 14);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.6);
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
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; state.rev++; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; state.rev++; });
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
    else if (id === 'share' && r) { Promise.resolve(env.share?.(`I scored ${r.total} points in one Bamboo Copter session in Arcforge (${rankFor(r.total)})!`)).catch(() => {}); }
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
          if (h.kind === 's' && same && sceneOwned(rec, h.i) && rec.sceneSel !== h.i) { rec.sceneSel = h.i; save(); resetArt(); sfx.win(); } else sfx.tick();
          state.collSel = { kind: h.kind, i: h.i }; state.rev++;
        } else if (hitScreen(ptr.x, ptr.y, state.ui.scroll) === 'back') { state.scene = state.collBack; state.ui.scroll = 0; state.rev++; sfx.tick(); }
      }
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    state.ui.scroll = clamp(state.ui.scroll, 0, max);
    if (input.keys.pressed.has('Escape')) { state.scene = state.collBack; state.ui.scroll = 0; state.rev++; }
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
  for (let i = 0; i < 60 * 3; i++) updateAttract(1 / 60);

  // Store screenshots (main.js calls this only for ?shot=1&scene=...): put the game in a named moment and run it forward.
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  const shotScene = (name, sel) => {
    const rec = state.record;
    rec.bestFlight = 236; rec.bestDaily = 188; rec.bestSession = [612, 540, 330, 0]; rec.dailyDay = state.day; rec.bestHeight = 41.5; rec.flights = 38; rec.sessions = 9; rec.lanterns = 61;
    rec.diary = [
      { n: 33, s: 0, r: 0, h: 28, d: 41, l: 1, sc: 118 }, { n: 34, s: 1, r: 3, h: 36, d: 66, l: 2, sc: 176 }, { n: 35, s: 1, r: 2, h: 41, d: 30, l: 0, sc: 122 },
      { n: 36, s: 2, r: 4, h: 33, d: 52, l: 3, sc: 214 }, { n: 37, s: 0, r: 5, h: 38, d: 70, l: 2, sc: 190 }, { n: 38, s: 1, r: 0, h: 30, d: 48, l: 1, sc: 140 },
    ];
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { newAttract(); advance(110); return; }
    if (name === 'aim') {
      rec.sceneSel = sel ?? 1; startRun('session'); state.toastT = 0; state.hold = 0; state.aim.lean = 0.3;
      advance(5); requestThink(); state.aim.charge = 0.7; state.aim.rubDir = 0.5; return;
    }
    if (name === 'fly' || name === 'banner') {
      rec.sceneSel = sel ?? (name === 'fly' ? 1 : 0); startRun('session'); state.toastT = 0; state.hold = 0;
      const A = state.aim, run = state.run;
      const adv = advise(A.tray.map((i) => ROTORS[i]), run.cond);
      A.sel = Math.max(0, A.tray.findIndex((i) => i === adv.rotor.id)); A.lean = adv.lean;
      doLaunch(adv.charge);
      run.mode = 'watch'; run.aimX = adv.aim;      // lets the helper hand steer the flight for the picture
      if (name === 'fly') advance(60 * 6);
      else { for (let i = 0; i < 60 * 80 && run.phase !== 'settle'; i++) advance(1); advance(30); }
      run.mode = 'session';
      return;
    }
    if (name === 'collection') { state.scene = 'collection'; state.collBack = 'title'; state.collSel = { kind: 'r', i: 4 }; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      state.last = { mode: 'session', total: 742, flights: [{ score: 188, height: 31, lanterns: 3, ring: 2, rotor: 0 }, { score: 124, height: 26, lanterns: 1, ring: 1, rotor: 3 }, { score: 176, height: 36, lanterns: 2, ring: 2, rotor: 2 }, { score: 96, height: 24, lanterns: 1, ring: 0, rotor: 1 }, { score: 158, height: 33, lanterns: 2, ring: 1, rotor: 4 }], bestFlight: 188, highest: 36, lanterns: 9, hints: 0, newBest: false, unlocks: [], scene: 0 };
      state.scene = 'result'; state.rev++; advance(3); return;
    }
    if (name === 'watch') {
      rec.sceneSel = 0; state.settings.thinkIdx = 1;
      startRun('watch'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 12 && !(state.dec && state.dec.phase === 'reveal' && state.dec.t > 0.8); i++) advance(1);
      return;
    }
    if (name === 'pause') { startRun('session'); state.toastT = 0; state.hold = 0; openPause(); advance(2); }
  };

  const api = {
    // Watch & Learn, the Collection and every menu are free; only real play counts against the free preview (a paused run does not).
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
      v3.view = null; v3.toy = null; v3.W = meta.width; v3.H = meta.height;
      if (v3.on) ctx.clearRect(0, 0, meta.width, meta.height); else { ctx.fillStyle = '#0d2417'; ctx.fillRect(0, 0, meta.width, meta.height); }
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
  void RUB_V_FULL;
  return api;
}
