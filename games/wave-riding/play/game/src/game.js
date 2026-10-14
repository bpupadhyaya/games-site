// Wave Riding: state and flow. The ride physics live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (session, daily, free, watch), result, collection, settings, howto/about/rules, demolimit.
// Play phases: line (choose a board, read the wave) -> paddle (catch it and pop up) -> ride -> done (banner) -> next wave.
import {
  BOARDS, BEACHES, RIDES_PER_SESSION, STEP, makeWave, newRide, stepRide, pilot, scout, adviceNow, newPaddle, stepPaddle, PADDLE, seeded, clamp,
} from './sim.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect, W, H } from './layout.js';
import { renderPlay, layoutOf } from './view.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderCollection,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit, boardOwned, beachOwned,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_RUNS = 2;
const FLICK_DX = 18;            // sideways finger travel per tick that counts as a flick in the air

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), runRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, textIdx: 0, thinkIdx: 1 },
    record: { bestRide: 0, bestDist: 0, bestTube: 0, bestSession: [0, 0, 0, 0], bestDaily: 0, dailyDay: -1, rides: 0, sessions: 0, airs: 0, beachSel: 0, boardSel: 0, demoRuns: 0 },
    run: null, aim: { board: 0, drag: null, kty: null, lastX: -1, flickCd: 0, wasAir: false }, ws: null, att: null,
    hint: false, dec: null, pops: [], banner: null, toast: '', toastT: 0, scoreShown: 0, scoutLines: [], thinkText: '', ownedBoards: [true, false, false, false],
    ridesPer: RIDES_PER_SESSION, last: null, collSel: null, collBack: 'title', restoreMsg: '', ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, hold: 0, settleT: 0, attN: 0,
  };
  syncSize();

  // ---- worlds ---------------------------------------------------------------------------------------------------------------
  const newWorld = (beach, wave, boardIdx, q = 0.7) => ({
    beach, wave, r: newRide(wave, BOARDS[boardIdx], q), t: 0, fx: [], trail: [], fig: { crouch: 0.4, lean: 0, arms: 0, pitch: 0 },
    phase: 'line', paddle: null, rise: 0.5, shake: 0, wipeT: 0, tubeA: 0, trailT: 0, doneT: 0,
  });
  state.ws = newWorld(0, makeWave(0, seeded(7)), 0);

  // ---- persistence ----------------------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  const refreshOwned = () => { state.ownedBoards = BOARDS.map((_, i) => boardOwned(state.record, i)); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const rec = state.record;
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(rec.bestSession) || rec.bestSession.length < 4) rec.bestSession = [0, 0, 0, 0];
    rec.beachSel = clamp(rec.beachSel | 0, 0, BEACHES.length - 1);
    if (!beachOwned(rec, rec.beachSel)) rec.beachSel = 0;
    rec.boardSel = clamp(rec.boardSel | 0, 0, BOARDS.length - 1);
    if (!boardOwned(rec, rec.boardSel)) rec.boardSel = 0;
    refreshOwned();
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const PENTA = [0, 2, 4, 7, 9];
  const sfx = {
    gate: (combo) => { const k = Math.max(0, combo - 1), semis = PENTA[k % 5] + 12 * Math.min(2, Math.floor(k / 5)); tone({ freq: 440 * Math.pow(2, semis / 12), dur: 0.14, type: 'sine', vol: 0.1 }); },
    miss: () => tone({ freq: 220, to: 150, dur: 0.12, type: 'triangle', vol: 0.05 }),
    burst: () => { tone({ freq: 160, to: 60, dur: 0.3, type: 'sawtooth', vol: 0.09 }); tone({ freq: 900, to: 200, dur: 0.18, type: 'triangle', vol: 0.04 }); },
    air: () => tone({ freq: 300, to: 900, dur: 0.3, type: 'sine', vol: 0.09 }),
    spin: () => tone({ freq: 700, to: 1100, dur: 0.1, type: 'triangle', vol: 0.06 }),
    land: (good) => { tone({ freq: good ? 520 : 180, to: good ? 780 : 90, dur: 0.22, type: 'triangle', vol: 0.11 }); if (good) tone({ freq: 1040, dur: 0.18, type: 'sine', vol: 0.06 }); },
    tube: () => [0, 4, 7].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.5 + i * 0.1, type: 'sine', vol: 0.06 })),
    wipe: () => { tone({ freq: 340, to: 50, dur: 0.6, type: 'sawtooth', vol: 0.1 }); tone({ freq: 120, to: 40, dur: 0.5, type: 'triangle', vol: 0.1 }); },
    tick: () => tone({ freq: 900, dur: 0.035, type: 'triangle', vol: 0.045 }),
    paddle: () => tone({ freq: 260 + fxRng.next() * 40, to: 180, dur: 0.1, type: 'triangle', vol: 0.05 }),
    pop: () => { tone({ freq: 330, to: 880, dur: 0.18, type: 'sine', vol: 0.1 }); tone({ freq: 660, to: 1320, dur: 0.18, type: 'triangle', vol: 0.05 }); },
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };
  const pop = (text, y, col = '#ffffff', size = 1, dx = 0) => { if (state.pops.length < 8) state.pops.push({ text, y, dx, col, size, t: 0, max: 1.0 }); };
  const smooth01 = (t) => { const v = clamp(t, 0, 1); return v * v * (3 - 2 * v); };

  // ---- world stepping (used by the play screen, the title backdrop and the shots) ------------------------------------------------
  const spawn = (ws, s, fy, vs, vfy, life, r, col) => { if (ws.fx.length < 170) ws.fx.push({ s, fy, vs, vfy, t: 0, life, r, col }); };
  const splash = (ws, s, fy, n, power = 1) => { for (let i = 0; i < n; i++) spawn(ws, s + (fxRng.next() - 0.5) * 3, fy, (fxRng.next() - 0.5) * 7 * power, 0.7 + fxRng.next() * 1.8 * power, 0.6 + fxRng.next() * 0.6, 3 + fxRng.next() * 5); };
  function tickWorld(ws, inp, dt) {
    ws.t += dt;
    const r = ws.r, B = BOARDS[r.board];
    if (ws.phase === 'ride' && !r.done) {
      stepRide(r, ws.wave, inp, dt);
      // wake: spray thrown off the tail and a carve line on the face
      if (!r.air && !r.done) {
        if (fxRng.next() < 0.7) spawn(ws, r.s - 0.8, r.y + 0.04, -2 - fxRng.next() * 3, 0.5 + Math.abs(r.vy) * 0.8 + fxRng.next() * 0.8, 0.45 + fxRng.next() * 0.35, 2.4 + fxRng.next() * 3.2);
        ws.trailT += dt;
        if (ws.trailT >= 0.05) { ws.trailT = 0; ws.trail.push({ s: r.s, y: r.y }); if (ws.trail.length > 26) ws.trail.shift(); }
      } else if (r.air && fxRng.next() < 0.4) spawn(ws, r.s, 1.1, -1 - fxRng.next() * 2, 0.2, 0.5, 2.5);
      // the figure's pose follows the carve, smoothed so it is never jerky
      const f = ws.fig, k = Math.min(1, dt * 7);
      const crouchT = clamp(0.8 - 0.55 * r.y - 0.18 * r.vy / Math.max(0.5, B.turn), 0, 1);
      f.crouch += (crouchT - f.crouch) * k;
      f.lean += (clamp(r.vy / Math.max(0.5, B.turn), -1, 1) - f.lean) * k;
      f.arms += (clamp(-r.vy / Math.max(0.5, B.turn), -1, 1) - f.arms) * Math.min(1, dt * 5);
      f.pitch += (clamp(-r.vy * 0.22, -0.4, 0.4) - f.pitch) * k;
    }
    if (r.wiped) ws.wipeT += dt;
    ws.tubeA += ((r.tubeNow && ws.phase === 'ride' ? 1 : 0) - ws.tubeA) * Math.min(1, dt * 4);
    if (ws.shake > 0) ws.shake = Math.max(0, ws.shake - dt * 2.4);
    for (const p of ws.fx) { p.t += dt; p.s += p.vs * dt; p.fy += p.vfy * dt; p.vfy -= 2.2 * dt; }
    ws.fx = ws.fx.filter((p) => p.t < p.life);
    if (ws.trail.length && ws.phase !== 'ride') ws.trail.length = 0;
  }

  // ---- the title-screen backdrop: a pilot rides a wave on its own --------------------------------------------------------------------
  const newAttract = () => {
    const beach = state.attN++ % 4;
    const wave = makeWave(beach, seeded(100 + state.attN * 17));
    const ws = newWorld(beach, wave, state.attN % 2 ? 0 : 1, 0.85);
    ws.phase = 'ride'; ws.rise = 1;
    state.att = ws;
  };
  const updateAttract = (dt) => {
    if (!state.att) newAttract();
    const ws = state.att;
    if (ws.r.done) { ws.doneT += dt; if (ws.doneT > 1.4) newAttract(); else tickWorld(ws, { ty: null, flick: false }, dt); return; }
    const p = pilot(ws.r, ws.wave, 0.92);
    tickWorld(ws, { ty: p.ty, flick: p.flick }, dt);
    ws.r.events.length = 0;
  };

  // ---- runs --------------------------------------------------------------------------------------------------------------------
  const waveRng = (run) => (run.mode === 'daily' ? seeded(state.day * 977 + run.idx * 31 + 5) : runRng);
  const beginRide = () => {
    const run = state.run;
    const wave = makeWave(run.beach, waveRng(run));
    state.ws = newWorld(run.beach, wave, run.board, 0.7);
    state.ws.phase = 'line';
    run.phase = 'line'; state.hint = false; state.dec = null; state.banner = null; state.pops.length = 0; state.hold = 0.35;
    state.scoreShown = 0; state.aim.drag = null; state.aim.kty = null; state.settleT = 0;
    state.scoutLines = scout(wave).slice(0, 4).map((x) => x.text);
    if (!state.scoutLines.length) state.scoutLines = ['A clean, open wall: carve through the glints and enjoy the ride.'];
    state.thinkText = '';
    if (run.mode === 'watch') state.dec = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx] };
  };
  const startRun = (mode) => {
    const rec = state.record;
    if (state.demo && mode !== 'watch' && rec.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const beach = mode === 'daily' ? state.day % BEACHES.length : rec.beachSel;
    const board = mode === 'watch' ? (boardOwned(rec, 1) ? 1 : 0) : rec.boardSel;
    state.run = { mode, beach, board, idx: 0, rides: [], total: 0, hints: 0, phase: 'line', unlocks: [] };
    state.aim.board = board;
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.last = null;
    if (state.demo && mode !== 'watch') { rec.demoRuns++; save(); }
    beginRide();
    toast(mode === 'watch' ? 'Watch & Learn: the game scouts the wave before every ride' : 'Pick a board, then paddle out. Tap to paddle, tap inside the ring to pop up.', 3.6);
  };
  const startPaddle = () => {
    const run = state.run, ws = state.ws;
    run.board = state.aim.board; state.record.boardSel = state.aim.board;
    ws.r.board = run.board;
    ws.phase = 'paddle'; ws.paddle = newPaddle(); ws.rise = 0.5; run.phase = 'paddle';
    state.hint = false; state.scoutLines = []; state.thinkText = '';
    sfx.tick();
  };
  const startRide = () => {
    const run = state.run, ws = state.ws, p = ws.paddle;
    const q = p ? p.q : 0.5;
    ws.r = newRide(ws.wave, BOARDS[run.board], q);
    ws.phase = 'ride'; ws.rise = 1; run.phase = 'ride'; ws.fig = { crouch: 0.6, lean: 0, arms: 0, pitch: 0 };
    state.aim.drag = null; state.aim.kty = null;
    sfx.pop();
    state.banner = null;
    pop(q > 0.78 ? 'Perfect pop-up!' : q > 0.5 ? 'Up!' : 'Late pop-up', 0.5, q > 0.78 ? '#9affc4' : '#ffffff', 0.9);
    if (run.mode !== 'watch' && state.record.rides < 3) toast('Drag up and down to carve. Follow the glints and stay ahead of the foam.', 3.4);
    splash(ws, 0, 0.1, 10);
  };
  const ownedSnapshot = () => ({ boards: BOARDS.map((_, i) => boardOwned(state.record, i)), beaches: BEACHES.map((_, i) => beachOwned(state.record, i)) });
  const newUnlocks = (before) => {
    const out = [];
    BOARDS.forEach((b, i) => { if (!before.boards[i] && boardOwned(state.record, i)) out.push(b.name); });
    BEACHES.forEach((b, i) => { if (!before.beaches[i] && beachOwned(state.record, i)) out.push(b.name); });
    return out;
  };
  const handleEvents = (ws) => {
    const r = ws.r;
    for (const e of r.events) {
      if (e.type === 'gate') { sfx.gate(r.combo); pop(`+${e.pts}`, e.y, e.mult >= 4 ? '#ffd36a' : '#ffffff', 0.7 + 0.08 * e.mult, 40); splash(ws, r.s + 1, e.y, 4, 0.6); }
      else if (e.type === 'miss') { sfx.miss(); }
      else if (e.type === 'burst') { sfx.burst(); ws.shake = Math.max(ws.shake, 0.5); pop(e.kind === 'low' ? 'Bogged!' : 'Crashed!', r.y, '#ffb199', 1.1); splash(ws, r.s, r.y, 20, 1.3); }
      else if (e.type === 'tube-in') { sfx.tube(); pop('In the tube', 0.45, '#8ff0ff', 1.0); }
      else if (e.type === 'tube-out') { sfx.win(); pop(`Barrel +${e.pts}`, 0.5, '#8ff0ff', 1.15); }
      else if (e.type === 'tube-lost') { pop('Missed the tube', 0.4, '#dff3ff', 0.8); }
      else if (e.type === 'air') { sfx.air(); pop('Air!', 1.0, '#ffe36a', 1.1); }
      else if (e.type === 'spin') { sfx.spin(); }
      else if (e.type === 'land') {
        sfx.land(e.kind === 'clean' || e.kind === 'fakie');
        splash(ws, r.s, r.y, 14, 1.1);
        ws.fig.crouch = Math.min(1, ws.fig.crouch + 0.4);   // knees take the landing; the smoothing eases it back
        pop(e.kind === 'sloppy' ? 'Sloppy landing' : e.kind === 'rough' ? 'Rough landing' : `${e.turns >= 1 ? `${e.turns} turn${e.turns > 1 ? 's' : ''}` : 'Clean'} +${e.pts}`, 0.6, e.kind === 'sloppy' ? '#ffb199' : '#ffe36a', 1.1);
      } else if (e.type === 'wipe') { sfx.wipe(); ws.shake = 0.7; splash(ws, r.s, r.y, 36, 1.8); }
    }
    r.events.length = 0;
  };
  const onRideEnd = () => {
    const run = state.run, ws = state.ws, r = ws.r, rec = state.record;
    run.phase = 'done'; ws.phase = 'done'; state.settleT = 0;
    const res = { score: Math.round(r.score), dist: Math.round(r.s), tube: r.tubeTotal, airs: r.stats.clean, combo: r.stats.bestCombo, wiped: r.wiped, board: r.board };
    const prevBest = rec.bestRide;
    run.rides.push(res); run.total += res.score;
    state.scoreShown = res.score;
    const before = ownedSnapshot();
    if (run.mode !== 'watch') {
      rec.rides++; rec.airs += res.airs;
      if (!run.hints) {
        if (res.score > rec.bestRide) rec.bestRide = res.score;
        if (res.dist > rec.bestDist) rec.bestDist = res.dist;
        if (res.tube > rec.bestTube) rec.bestTube = res.tube;
      }
      const unl = newUnlocks(before);
      if (unl.length) { run.unlocks = run.unlocks.concat(unl); sfx.win(); toast(`Unlocked: ${unl.join(', ')}`, 3.4); }
      refreshOwned();
      save();
    }
    const wasBest = run.mode !== 'watch' && !run.hints && res.score > prevBest && prevBest > 0;
    if (r.wiped) state.banner = { text: 'Wipeout', sub: `${res.score} points · ${res.dist} m`, col: '#ffb199', t: 0, max: 2.6 };
    else { sfx.win(); state.banner = { text: wasBest ? 'Best ride!' : 'Ride complete', sub: `${res.score} points · ${res.dist} m`, col: wasBest ? '#ffd36a' : '#ffffff', t: 0, max: 2.6 }; }
  };
  const finishRun = () => {
    const run = state.run, rec = state.record, mode = run.mode;
    const best = Math.max(0, ...run.rides.map((x) => x.score));
    const r = { mode, total: run.total, rides: run.rides.slice(), best, hints: run.hints, newBest: false, unlocks: run.unlocks, beach: run.beach };
    if (mode !== 'watch' && mode !== 'free') {
      rec.sessions++;
      if (!run.hints) {
        if (mode === 'session' && run.total > rec.bestSession[run.beach]) { rec.bestSession[run.beach] = run.total; r.newBest = run.total > 0; }
        if (mode === 'daily') { if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; } if (run.total > rec.bestDaily) { rec.bestDaily = run.total; r.newBest = run.total > 0; } }
      }
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.rev++;
    if (r.newBest) sfx.win();
  };
  const nextRide = () => {
    const run = state.run;
    if (run.mode !== 'free' && run.rides.length >= RIDES_PER_SESSION) { finishRun(); return; }
    run.idx++;
    beginRide();
  };

  // ---- Watch & Learn: THINK (scout the wave) -> REVEAL (the plan) -> ACT (paddle and ride) --------------------------------------------
  const updateWatchLine = (dt) => {
    const dec = state.dec; if (!dec) return;
    dec.t += dt;
    const ws = state.ws;
    if (dec.phase === 'think') {
      state.thinkText = 'Scouting the wave…';
      if (dec.t >= dec.dur) {
        dec.phase = 'reveal'; dec.t = 0; dec.dur = 2;
        state.scoutLines = scout(ws.wave).slice(0, 4).map((x) => x.text);
        if (!state.scoutLines.length) state.scoutLines = ['A clean, open wall: carve through the glints.'];
        state.hint = true;
        state.thinkText = 'The plan: follow the glints, and stall before a tube.';
      }
    } else if (dec.phase === 'reveal') {
      if (dec.t >= dec.dur) { state.dec = null; startPaddle(); }
    }
  };
  const updateWatchPaddle = () => {
    const p = state.ws.paddle; if (!p || p.done) return;
    // a steady rhythm of strokes, then the pop-up on the beat
    const stroke = p.t < PADDLE.ring[0] - 0.2 && Math.floor(p.t / 0.36) !== Math.floor((p.t - STEP) / 0.36);
    const pop2 = p.t >= PADDLE.ideal && p.t < PADDLE.ideal + STEP * 1.5;
    if (stroke || pop2) { stepPaddle(p, 'tap', 0); if (stroke && !p.done) sfx.paddle(); }
  };

  // ---- hint (Think) --------------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const run = state.run, ws = state.ws;
    if (!run || (run.phase !== 'ride' && run.phase !== 'line') || state.paused || run.mode === 'watch') return;
    if (state.hint) { state.hint = false; sfx.tick(); return; }
    state.hint = true;
    if (run.mode !== 'free') run.hints++;
    sfx.tick();
    if (run.phase === 'ride') toast(adviceNow(ws.r, ws.wave), 3.4);
    else toast('The yellow glints show the line a good rider takes: carve down the face, then up.', 3.4);
  };

  // ---- pause ------------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRun = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hint = false; state.dec = null; state.rev++; };

  // ---- the play scene --------------------------------------------------------------------------------------------------------------------
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
  const steerRange = () => Math.max(160, Math.min(W, H) * 0.5);
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
    let steer = { ty: null, flick: false };
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
      const onHud = ptr.pressed && (inRect(L.pause, ptr.x, ptr.y) || inRect(L.think, ptr.x, ptr.y));
      if (ptr.pressed && inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
      if (ptr.pressed && inRect(L.think, ptr.x, ptr.y)) { requestThink(); A.drag = null; }
      if (run.phase === 'line' && state.hold <= 0 && ptr.pressed && !onHud) {
        let hit = -1;
        L.tray.forEach((rc, k) => { if (inRect(rc, ptr.x, ptr.y)) hit = k; });
        if (hit >= 0) { if (state.ownedBoards[hit]) { if (A.board !== hit) { A.board = hit; sfx.tick(); } } else { sfx.tick(); toast(`${BOARDS[hit].name}: ride ${BOARDS[hit].need} points in one ride to unlock.`, 2.6); } }
        else if (inRect(L.go, ptr.x, ptr.y)) startPaddle();
      }
      if (run.phase === 'line') {
        for (let k = 0; k < 4; k++) if (keys.pressed.has(`Digit${k + 1}`) && state.ownedBoards[k]) { A.board = k; sfx.tick(); }
        if (keys.pressed.has('Enter') || keys.pressed.has('Space')) startPaddle();
      }
      if (run.phase === 'paddle' && ws.paddle) {
        const p = ws.paddle;
        if ((ptr.pressed && !onHud) || keys.pressed.has('Space') || keys.pressed.has('ArrowUp')) { stepPaddle(p, 'tap', 0); if (!p.done) sfx.paddle(); }
      }
      if (run.phase === 'ride') {
        const r = ws.r;
        if (ptr.pressed && !onHud) A.drag = { y0: ptr.y, ty0: r.air ? 0.5 : r.y };
        if (A.wasAir && !r.air && ptr.down) A.drag = { y0: ptr.y, ty0: r.y };   // after a landing the finger re-anchors where the rider is
        A.wasAir = !!r.air;
        if (A.drag && ptr.down) steer.ty = clamp(A.drag.ty0 + (A.drag.y0 - ptr.y) / steerRange() * 1.25, 0, 1);
        if (ptr.released) A.drag = null;
        // flicks in the air: a tap, or a quick sideways swipe
        A.flickCd = Math.max(0, A.flickCd - dt);
        if (r.air) {
          if (ptr.pressed && !onHud) { steer.flick = true; A.flickCd = 0.2; }
          else if (ptr.down && A.lastX >= 0 && Math.abs(ptr.x - A.lastX) > FLICK_DX && A.flickCd <= 0) { steer.flick = true; A.flickCd = 0.3; }
          if (keys.pressed.has('Space') || keys.pressed.has('ArrowLeft') || keys.pressed.has('ArrowRight')) steer.flick = true;
        }
        A.lastX = ptr.down ? ptr.x : -1;
        // keyboard: up and down carve
        const up = keys.down.has('ArrowUp') || keys.down.has('KeyW'), dn = keys.down.has('ArrowDown') || keys.down.has('KeyS');
        if (up || dn) { if (A.kty == null) A.kty = r.y; A.kty = clamp(A.kty + (up ? 1 : -1) * dt * 1.7, 0, 1); if (steer.ty == null) steer.ty = A.kty; } else A.kty = null;
        if (keys.pressed.has('KeyH')) requestThink();
      }
    }
    if (state.paused) return;
    // ---- time passes
    if (state.hold > 0) state.hold = Math.max(0, state.hold - dt);
    if (run.phase === 'line') {
      if (watch && state.hold <= 0) updateWatchLine(dt);
      ws.rise = 0.5;
      tickWorld(ws, steer, dt);
    } else if (run.phase === 'paddle') {
      if (watch) updateWatchPaddle();
      const p = ws.paddle;
      stepPaddle(p, null, dt);
      p.stroke = (p.stroke || 0) + dt * (0.5 + 1.5 * p.power);
      ws.rise = 0.5 + 0.5 * smooth01(p.t / PADDLE.ideal);
      tickWorld(ws, steer, dt);
      if (p.done) startRide();
    } else if (run.phase === 'ride') {
      if (watch) { const pl = pilot(ws.r, ws.wave, 0.92); steer = { ty: pl.ty, flick: pl.flick }; }
      tickWorld(ws, steer, dt);
      handleEvents(ws);
      if (ws.r.done) onRideEnd();
    } else if (run.phase === 'done') {
      tickWorld(ws, { ty: null, flick: false }, dt);
      state.settleT += dt;
      if (ptr.pressed && state.settleT > 0.7 && !watch && !inRect(L.pause, ptr.x, ptr.y)) { nextRide(); return; }
      if (keys.pressed.has('Enter') && state.settleT > 0.5 && !watch) { nextRide(); return; }
      if (watch && state.settleT > 3) nextRide();
      else if (!watch && state.settleT > 9) nextRide();
    }
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
    if (run.phase === 'ride' && ws.phase === 'ride') state.scoreShown = Math.round(ws.r.score);
  };

  // ---- menus ---------------------------------------------------------------------------------------------------------------------------
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
    else if (id === 'share' && r) { Promise.resolve(env.share?.(`I scored ${r.total} points over ${r.rides.length} waves in Wave Riding in Arcforge!`)).catch(() => {}); }
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
          if (same && h.kind === 'p' && beachOwned(rec, h.i) && rec.beachSel !== h.i) { rec.beachSel = h.i; save(); sfx.win(); }
          else if (same && h.kind === 's' && boardOwned(rec, h.i) && rec.boardSel !== h.i) { rec.boardSel = h.i; state.aim.board = h.i; save(); sfx.win(); }
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

  // ---- store screenshots (main.js calls shotScene only for ?shot=1&scene=...) -----------------------------------------------------
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  const rideUntil = (cond, cap = 60 * 150) => {
    for (let i = 0; i < cap; i++) {
      const ws = state.ws; if (cond(ws, ws.r)) return true;
      if (ws.r.done) return false;
      advance(1);
    }
    return false;
  };
  const shotScene0 = (name) => {
    const rec = state.record;
    rec.bestRide = 3900; rec.bestDaily = 6200; rec.bestSession = [7400, 5200, 3100, 0]; rec.dailyDay = state.day; rec.bestDist = 640; rec.rides = 140; rec.sessions = 24; rec.bestTube = 9.5;
    state.loaded = true; refreshOwned(); state.rev++;
    advance(10);
    if (name === 'title') { advance(240); return; }
    const begin = (beach, mode) => { rec.beachSel = beach; startRun(mode); state.toastT = 0; state.hold = 0; };
    if (name === 'line') { begin(1, 'session'); advance(5); return; }
    if (name === 'paddle') { begin(0, 'session'); startPaddle(); advance(130); return; }
    const driven = (beach, cond) => {
      begin(beach, 'watch'); state.settings.thinkIdx = 0; state.dec = null; startPaddle();
      for (let i = 0; i < 60 * 8 && state.ws.phase !== 'ride'; i++) advance(1);
      rideUntil(cond);
      state.toastT = 0; state.pops.length = 0;
    };
    if (name === 'ride') { driven(0, (ws, r) => r.s > 150 && r.combo >= 5); return; }
    if (name === 'tube') { driven(1, (ws, r) => r.tubeNow && r.curTubeT > 1.2); return; }
    if (name === 'air') { driven(2, (ws, r) => r.air && r.air.t > 0.35); return; }
    if (name === 'burst') { driven(3, (ws, r) => ws.wave.bursts.some((b) => b.s - r.s < 26 && b.s - r.s > 12)); return; }
    if (name === 'banner') { driven(0, (ws, r) => r.done); advance(60); return; }
    if (name === 'collection') { state.scene = 'collection'; state.collBack = 'title'; state.collSel = { kind: 's', i: 2 }; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      state.last = { mode: 'session', total: 7420, best: 3100, hints: 0, newBest: false, unlocks: [], beach: 0, rides: [{ score: 2450, dist: 520, tube: 6.2, airs: 1, combo: 12, wiped: false, board: 0 }, { score: 3100, dist: 520, tube: 8.4, airs: 2, combo: 17, wiped: false, board: 1 }, { score: 1870, dist: 410, tube: 3.1, airs: 0, combo: 8, wiped: true, board: 1 }] };
      state.scene = 'result'; state.rev++; advance(3); return;
    }
    if (name === 'watch') {
      begin(0, 'watch'); state.settings.thinkIdx = 1;
      for (let i = 0; i < 60 * 12 && !(state.dec && state.dec.phase === 'reveal' && state.dec.t > 0.8); i++) advance(1);
      return;
    }
    if (name === 'wipe') {
      begin(1, 'session'); startPaddle();
      for (let i = 0; i < 60 * 8 && state.ws.phase !== 'ride'; i++) advance(1);
      rideUntil((ws, r) => r.wiped); advance(32); state.toastT = 0; state.pops.length = 0; return;
    }
    if (name === 'pause') { startRun('session'); state.toastT = 0; state.hold = 0; openPause(); advance(2); }
  };
  const shotScene = (name) => { shotScene0(name); state.frozen = true; };

  const api = {
    // Watch & Learn, the Collection, the line-up and every menu are free; only real riding counts against the free preview.
    isPreviewExempt: () => !(state.scene === 'play' && state.run && state.run.mode !== 'watch') || state.paused || state.hold > 0 || (state.run && state.run.phase === 'line'),
    update(dt, input) {
      if (state.frozen) return;
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
      // The preview pill sits under the Think button while riding so it never covers the score, combo or controls.
      if (state.scene === 'play' && state.run) { const L = layoutOf(state); meta.previewBadge = { x: L.think.x + L.think.w, y: L.think.y + L.think.h + 6, align: 'right' }; }
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
