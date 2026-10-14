// Tractor Pull: state and flow. The pulling physics live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (session, daily, free, watch), result, collection (the Garage), settings, howto/about/rules, demolimit.
// Play phases: ready (rig on the line) -> run (the pull) -> settle (banner) -> next pull.
import {
  RIGS, GROUNDS, SESSION_PULLS, TRACK_FT, newPull, stepPull, advise, driver, makeTrack, seeded, clamp, ft, endLabel,
} from './sim.js';
import { stepFx, addPart, resetArt, rigLook } from './art.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect, leverValue } from './layout.js';
import { renderPlay, layoutOf } from './view.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderCollection,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit, rigOwned, groundOwned,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_PULLS = 3;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), runRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, textIdx: 0, thinkIdx: 1 },
    record: { bestPull: 0, bestSession: [0, 0, 0, 0], bestDaily: 0, dailyDay: -1, lifeFt: 0, pulls: 0, fullPulls: 0, rigSel: 0, groundSel: 0, demoRuns: 0 },
    run: null, aim: { lever: 0, drag: false, shift: 0 }, ws: null, att: null, attMem: {},
    hint: null, dec: null, pops: [], banner: null, shake: 0, toast: '', toastT: 0, auto: false,
    last: null, collSel: null, collBack: 'title', restoreMsg: '', restoreBusy: false, ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, hold: 0, settleT: 0, attT: 0, attN: 0,
  };
  syncSize();
  const newWorld = (rigIdx, ground, track, round) => ({ rigIdx, ground, track, p: newPull(rigIdx, track, round), parts: [], t: 0, cheer: false, seenEv: 0, smokeT: 0, dustT: 0, engT: 0 });
  state.ws = newWorld(0, 0, makeTrack(0, seeded(11)), 0);

  // ---- persistence ----------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const rec = state.record;
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(rec.bestSession) || rec.bestSession.length < 4) rec.bestSession = [0, 0, 0, 0];
    rec.rigSel = clamp(rec.rigSel | 0, 0, RIGS.length - 1); rec.groundSel = clamp(rec.groundSel | 0, 0, GROUNDS.length - 1);
    rec.lifeFt = Math.max(0, rec.lifeFt | 0);
    if (!rigOwned(rec, rec.rigSel)) rec.rigSel = 0;
    if (!groundOwned(rec, rec.groundSel)) rec.groundSel = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    launch: () => { tone({ freq: 90, to: 160, dur: 0.3, type: 'sawtooth', vol: 0.07 }); },
    shift: () => { tone({ freq: 140, to: 60, dur: 0.12, type: 'square', vol: 0.06 }); tone({ freq: 900, to: 400, dur: 0.05, type: 'triangle', vol: 0.03 }); },
    nose: () => { tone({ freq: 880, to: 440, dur: 0.18, type: 'square', vol: 0.05 }); },
    stall: () => { tone({ freq: 120, to: 40, dur: 0.5, type: 'sawtooth', vol: 0.09 }); },
    tick: () => tone({ freq: 900, dur: 0.035, type: 'triangle', vol: 0.045 }),
    full: () => [0, 4, 7, 12, 16].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.24 + i * 0.05, type: 'triangle', vol: 0.09 })),
    end: () => { tone({ freq: 220, to: 110, dur: 0.4, type: 'triangle', vol: 0.08 }); },
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };
  const pop = (text, fx, fy, col = '#fff', size = 1) => { if (state.pops.length < 6) state.pops.push({ text, fx, fy, col, size, t: 0, max: 1.1 }); };

  // ---- world effects (used by the track, the title demo and the shots) -----------------------------------------------------------
  const worldFx = (ws, dt, p, withSound) => {
    const look = rigLook(ws.rigIdx);
    ws.t += dt;
    ws.smokeT += dt; ws.dustT += dt; ws.engT += dt;
    const sx = p.x + (look.hood - 0.5) * look.s, sy = (1.65 + 0.6 + 0.45) * look.s;
    if (ws.smokeT >= 0.05) {
      ws.smokeT = 0;
      const rate = p.phase === 'ready' ? 0.3 : 0.6 + p.thr * 0.8;
      if (fxRng.next() < rate) addPart(ws.parts, fxRng, 'smoke', sx, sy, -0.4 - p.v * 0.35, 0.9 + fxRng.next() * 0.6, 0.9 + fxRng.next() * 0.4, 0.2 + p.thr * 0.2);
    }
    if (p.phase === 'run' && ws.dustT >= 0.04) {
      ws.dustT = 0;
      const dusty = GROUNDS[ws.ground].dust;
      if (p.v > 0.4 && fxRng.next() < 0.25 + dusty * 0.5) addPart(ws.parts, fxRng, 'dust', p.x - 0.4, 0.15, -p.v * 0.25 - 0.4, 0.3 + fxRng.next() * 0.5, 0.8 + fxRng.next() * 0.5, 0.2 + dusty * 0.3);
      if (p.slip > 0.26 && p.drive > 0 && p.cutT <= 0) {
        for (let k = 0; k < 2; k++) addPart(ws.parts, fxRng, 'clod', p.x - 0.5, 0.1, -(2 + p.slip * 7) * (0.6 + fxRng.next() * 0.8), 2 + fxRng.next() * 3.5, 0.9, 0.5 + fxRng.next());
        addPart(ws.parts, fxRng, 'dust', p.x - 0.5, 0.3, -2 - fxRng.next() * 2, 0.8, 1.0, 0.5);
      }
    }
    stepFx(ws.parts, dt);
    if (withSound && p.phase === 'run' && ws.engT >= 0.085) {
      ws.engT = 0;
      tone({ freq: 48 + p.rpm * 150 + p.thr * 18, dur: 0.1, type: 'sawtooth', vol: 0.012 + p.thr * 0.016 });
    }
  };

  // ---- the title-screen demo -------------------------------------------------------------------------------------------------------
  const newAttract = () => {
    const n = state.attN++, rig = [1, 3, 0, 2][n % 4], g = [0, 2, 1, 3][n % 4];
    state.att = newWorld(rig, g, makeTrack(g, seeded(500 + n)), n % 2);
    state.attMem = {};
    state.attT = 0;
  };
  const updateAttract = (dt) => {
    if (!state.att) newAttract();
    const ws = state.att, p = ws.p;
    state.attT += dt;
    if (p.phase === 'done') {
      ws.cheer = p.end === 'full';
      if (state.attT > 4.5) newAttract();
      worldFx(ws, dt, p, false);
      return;
    }
    if (state.attT < 0.8) { worldFx(ws, dt, p, false); return; }
    stepPull(p, dt, driver(p, state.attMem));
    worldFx(ws, dt, p, false);
    if (p.phase === 'done') state.attT = 0;
  };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  const trackFor = (run) => makeTrack(run.ground, run.mode === 'daily' ? seeded(state.day * 977 + run.idx * 31 + 5) : runRng);
  const beginPull = () => {
    const run = state.run;
    state.ws = newWorld(run.rig, run.ground, trackFor(run), run.mode === 'free' ? run.idx % 3 : Math.min(run.idx, 2));
    const A = state.aim;
    A.lever = 0; A.drag = false; A.shift = 0;
    run.phase = 'ready'; run.mem = {};
    state.hint = null; state.dec = null; state.banner = null; state.pops.length = 0; state.hold = 0.35;
    if (run.mode === 'watch') state.dec = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], adv: advise(state.ws.p) };
  };
  const startRun = (mode) => {
    const rec = state.record;
    if (state.demo && mode !== 'watch' && rec.demoRuns >= DEMO_PULLS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const ground = mode === 'daily' ? state.day % GROUNDS.length : rec.groundSel;
    state.run = { mode, rig: rec.rigSel, ground, idx: 0, pulls: [], total: 0, hints: 0, phase: 'ready', unlocks: [], mem: {} };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.last = null;
    beginPull();
    if (state.demo && mode !== 'watch') { rec.demoRuns++; save(); }
    toast(mode === 'watch' ? 'Watch & Learn: the game thinks before every pull' : 'Roll the lever on gently, then shift up as the engine climbs', 3.4);
  };
  const ownedSnapshot = () => ({ rigs: RIGS.map((_, i) => rigOwned(state.record, i)), grounds: GROUNDS.map((_, i) => groundOwned(state.record, i)) });
  const newUnlocks = (before) => {
    const out = [];
    RIGS.forEach((r, i) => { if (!before.rigs[i] && rigOwned(state.record, i)) out.push(r.name); });
    GROUNDS.forEach((g, i) => { if (!before.grounds[i] && groundOwned(state.record, i)) out.push(g.name); });
    return out;
  };
  const onEnd = () => {
    const run = state.run, rec = state.record, ws = state.ws, p = ws.p;
    const dist = p.end === 'full' ? TRACK_FT : Math.min(TRACK_FT - 1, Math.floor(ft(p.x)));
    run.phase = 'settle'; state.settleT = 0; state.shake = p.end === 'full' ? 0.15 : 0.3;
    run.pulls.push({ ft: dist, end: p.end, faults: p.faults });
    run.total += dist;
    ws.cheer = p.end === 'full';
    if (p.end === 'full') { for (let i = 0; i < 70; i++) addPart(ws.parts, fxRng, 'conf', p.x - 3 + fxRng.next() * 6, 2.5 + fxRng.next() * 3, (fxRng.next() - 0.5) * 9, 2 + fxRng.next() * 6, 2.2 + fxRng.next(), 1); }
    if (p.end === 'full') sfx.full(); else if (p.end === 'stalled') sfx.stall(); else sfx.end();
    const before = ownedSnapshot();
    const wasBest = dist > rec.bestPull;
    if (run.mode !== 'watch') {
      rec.pulls++; rec.lifeFt += dist; if (p.end === 'full') rec.fullPulls++;
      if (!run.hints && dist > rec.bestPull) rec.bestPull = dist;
      const unl = newUnlocks(before);
      if (unl.length) { run.unlocks = run.unlocks.concat(unl); sfx.win(); toast(`Unlocked: ${unl.join(', ')}`, 3.2); }
      save();
    }
    const best = wasBest && run.mode !== 'watch' && !run.hints;
    state.banner = { text: p.end === 'full' ? 'FULL PULL' : `${dist} ft`, sub: p.end === 'full' ? `${TRACK_FT} feet` : best ? 'New best pull!' : endLabel(p.end), col: p.end === 'full' || best ? '#ffd36a' : '#ffffff', t: 0, max: 2.8 };
  };
  const finishRun = () => {
    const run = state.run, rec = state.record, mode = run.mode;
    const fts = run.pulls.map((t) => t.ft);
    const r = { mode, total: run.total, pulls: run.pulls.slice(), bestPull: Math.max(0, ...fts), full: run.pulls.filter((t) => t.end === 'full').length, hints: run.hints, newBest: false, unlocks: run.unlocks, ground: run.ground, rig: run.rig };
    if (mode !== 'watch' && mode !== 'free') {
      if (!run.hints) {
        if (mode === 'session' && run.total > rec.bestSession[run.ground]) { rec.bestSession[run.ground] = run.total; r.newBest = run.total > 0; }
        if (mode === 'daily') { if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; } if (run.total > rec.bestDaily) { rec.bestDaily = run.total; r.newBest = run.total > 0; } }
      }
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.rev++;
    if (r.newBest) sfx.win();
  };
  const nextPull = () => {
    const run = state.run, rec = state.record;
    if (run.mode !== 'free' && run.pulls.length >= SESSION_PULLS) { finishRun(); return; }
    if (state.demo && run.mode !== 'watch') {
      if (rec.demoRuns >= DEMO_PULLS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
      rec.demoRuns++; save();
    }
    run.idx++;
    beginPull();
  };

  // ---- the Watch & Learn decision loop: THINK -> REVEAL -> ACT --------------------------------------------------------------------
  const updateWatch = (dt) => {
    const dec = state.dec, A = state.aim;
    if (!dec) return;
    dec.t += dt;
    if (dec.phase === 'think') {
      if (dec.t >= dec.dur) { dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; dec.adv = advise(state.ws.p); }
    } else if (dec.phase === 'reveal') {
      A.lever += (dec.adv.thr - A.lever) * Math.min(1, dt * 6);
      if (dec.t >= dec.dur) state.dec = null;
    }
  };

  // ---- think hint ---------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const run = state.run;
    if (!run || state.paused || run.mode === 'watch' || run.phase === 'settle') return;
    if (state.hint) { state.hint = null; sfx.tick(); return; }
    state.hint = { adv: advise(state.ws.p) };
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
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
    else if (id === 'quit') leaveRun();
  }
  const requestShift = (dir) => { const p = state.ws.p; if (state.run.phase === 'settle' || p.phase === 'done') return; state.aim.shift = dir; };

  const handleEvents = (ws) => {
    const p = ws.p;
    for (const e of p.ev) {
      if (e.n <= ws.seenEv) continue;
      ws.seenEv = e.n;
      if (e.type === 'launch') sfx.launch();
      else if (e.type === 'shift') sfx.shift();
      else if (e.type === 'nose') { sfx.nose(); state.shake = Math.max(state.shake, 0.25); pop('NOSE UP! Ease off', 0.5, 0.3, '#ff9a6a', 1.1); }
      else if (e.type === 'end') onEnd();
    }
  };

  const updatePlay = (dt, input) => {
    const run = state.run, ptr = input.pointer, keys = input.keys, watch = run.mode === 'watch', A = state.aim;
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
        if (inRect(L.think, ptr.x, ptr.y)) { requestThink(); A.drag = false; }
        else if (run.phase !== 'settle' && state.hold <= 0) {
          if (inRect(L.gears.up, ptr.x, ptr.y)) requestShift(1);
          else if (inRect(L.gears.down, ptr.x, ptr.y)) requestShift(-1);
          else if (inRect(L.lever, ptr.x, ptr.y)) { A.drag = true; A.lever = Math.round(leverValue(L.lever, ptr.y) * 50) / 50; }
        } else if (run.phase === 'settle' && state.settleT > 0.6) { nextPull(); return; }
      }
      if (A.drag && ptr.down && run.phase !== 'settle') A.lever = Math.round(leverValue(L.lever, ptr.y) * 50) / 50;
      if (ptr.released) A.drag = false;
      if (run.phase !== 'settle' && state.hold <= 0) {
        if (keys.pressed.has('ArrowUp') || keys.pressed.has('KeyW')) A.lever = clamp(A.lever + 0.1, 0, 1);
        if (keys.pressed.has('ArrowDown') || keys.pressed.has('KeyS')) A.lever = clamp(A.lever - 0.1, 0, 1);
        if (keys.down.has('Space')) A.lever = 1;
        if (keys.pressed.has('KeyD') || keys.pressed.has('KeyX') || keys.pressed.has('ArrowRight')) requestShift(1);
        if (keys.pressed.has('KeyA') || keys.pressed.has('KeyZ') || keys.pressed.has('ArrowLeft')) requestShift(-1);
      }
      if (keys.pressed.has('KeyH')) requestThink();
      if (run.phase === 'settle' && keys.pressed.has('Enter') && state.settleT > 0.4) { nextPull(); return; }
    }
    if (state.paused) return;
    // ---- time passes
    if (state.hold > 0) state.hold = Math.max(0, state.hold - dt);
    const ws = state.ws, p = ws.p;
    if (watch && run.phase !== 'settle' && state.dec && state.hold <= 0) updateWatch(dt);
    if (run.phase !== 'settle' && state.hold <= 0 && !(watch && state.dec)) {
      let ctl;
      if (watch || state.auto) { ctl = driver(p, run.mem); A.lever = ctl.thr; }
      else ctl = { thr: A.lever, shift: A.shift };
      A.shift = 0;
      const was = p.phase;
      stepPull(p, dt, ctl);
      if (was === 'ready' && p.phase === 'run') run.phase = 'run';
      handleEvents(ws);
    }
    worldFx(ws, dt, p, run.phase === 'run');
    if (state.hint && Math.floor(state.t * 5) !== Math.floor((state.t - dt) * 5) && p.phase !== 'done') state.hint.adv = advise(p);
    if (run.phase === 'settle') {
      state.settleT += dt;
      if (watch && state.settleT > 2.6) nextPull();
      else if (!watch && state.settleT > 12) nextPull();
    }
    for (const q of state.pops) q.t += dt;
    state.pops = state.pops.filter((q) => q.t < q.max);
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
      if (state.restoreBusy) { state.rev++; return; }
      state.restoreBusy = true;
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Full game unlocked. Thank you!' : 'No previous purchase found.'; state.rev++; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; state.rev++; }).finally(() => { state.restoreBusy = false; });
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
    else if (id === 'share' && r) { Promise.resolve(env.share?.(`I pulled the sled ${r.total} feet in one Tractor Pull session in Arcforge!`)).catch(() => {}); }
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
          if (h.kind === 'g' && same && groundOwned(rec, h.i) && rec.groundSel !== h.i) { rec.groundSel = h.i; save(); resetArt(); sfx.win(); }
          else if (h.kind === 'r' && same && rigOwned(rec, h.i) && rec.rigSel !== h.i) { rec.rigSel = h.i; save(); sfx.win(); }
          else sfx.tick();
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
  const shotScene = (name) => {
    const rec = state.record;
    rec.bestPull = 300; rec.bestDaily = 612; rec.bestSession = [748, 560, 410, 0]; rec.dailyDay = state.day; rec.lifeFt = 4100; rec.pulls = 96; rec.fullPulls = 12; rec.rigSel = 1; rec.groundSel = 1;
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { advance(380); return; }
    if (name === 'aim' || name === 'pull' || name === 'banner') {
      rec.rigSel = name === 'aim' ? 1 : 2; rec.groundSel = name === 'pull' ? 2 : 1;
      startRun('session'); state.toastT = 0; state.hold = 0;
      if (name === 'aim') { advance(5); requestThink(); advance(5); return; }
      state.auto = true;
      for (let i = 0; i < 60 * 40 && state.ws.p.phase !== 'done' && !(name === 'pull' && state.ws.p.x > 38); i++) advance(1);
      if (name === 'banner') advance(40);
      state.auto = false;
      return;
    }
    if (name === 'collection') { state.scene = 'collection'; state.collBack = 'title'; state.collSel = { kind: 'r', i: 2 }; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      state.last = { mode: 'session', total: 702, pulls: [{ ft: 300, end: 'full' }, { ft: 241, end: 'stalled' }, { ft: 161, end: 'stalled' }], bestPull: 300, full: 1, hints: 0, newBest: false, unlocks: [], ground: 0, rig: 1 };
      state.scene = 'result'; state.rev++; advance(3); return;
    }
    if (name === 'watch') {
      rec.rigSel = 3; rec.groundSel = 2; state.settings.thinkIdx = 1;
      startRun('watch'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 12 && !(state.dec && state.dec.phase === 'reveal' && state.dec.t > 0.8); i++) advance(1);
      return;
    }
    if (name === 'pause') { startRun('session'); state.toastT = 0; state.hold = 0; openPause(); advance(2); }
  };

  const api = {
    // Watch & Learn, the Garage and every menu are free; only real play counts against the free preview (a paused run does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.run && state.run.mode !== 'watch') || state.paused || state.hold > 0 || (state.run && state.run.phase === 'settle'),
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
      // The kit's preview pill sits top-centre by default, which is the score HUD here: during a pull park it in the
      // bottom-right of the track scene (plain dirt), elsewhere leave it at the default spot.
      if (state.scene === 'play' && state.run) { const S = layoutOf(state).stage; meta.previewBadge = { x: S.x + S.w - 10, y: S.y + S.h - 38, align: 'right' }; }
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
  return api;
}
