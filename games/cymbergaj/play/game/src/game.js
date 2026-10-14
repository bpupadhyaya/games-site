// Cymbergaj: state and flow. Physics lives in sim.js, the computer player in ai.js, rules in match.js, drawing in view.js, art.js
// and menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto/about/rules, demolimit.
// Playing: the table is live. Your paddle follows your finger (or mouse, or the arrow keys / WASD) on your half; the puck
// bounces, the first side to the goal total wins.
import {
  createWorld, placeServe, resetPads, stepWorld, clamp, R_PAD, R_PUCK, HW, HH, shotLine,
} from './sim.js';
import { newMatch, goalFor, LENGTHS, HOVER_LIMIT } from './match.js';
import { createBrain, brainStep, planShot, describeShot, coach } from './ai.js';
import { PROFILES } from './opponents.js';
import { inRect, TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, toWorld, toScreen } from './layout.js';
import { renderPlay, layoutOf, sideName } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, REF, ensureLayout, resetMenus, setupPinRects, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const TAU = Math.PI * 2;
const DEMO_MATCH_CAP = 1;
const GOAL_T = 2.1;          // seconds of celebration
const READY_T = 1.8;         // the 3-2-1 before a serve
const KEY_SPEED = 520;       // paddle speed with the keyboard, units per second
const WATCH_GOALS = 3;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const hintRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, calm: false, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, demoMatches: 0, goals: 0, fastest: 0 },
    setup: { mode: 'ai', opp: 0, goalsTo: LENGTHS[0] }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    att: null, w: null, m: null,
    parts: [], pops: [], trail: [], toast: '', toastT: 0, goalT: 0, pocket: 0, freeze: null, mark: null,
    pendingPlan: null, pendingSide: 0,
    ctl: { px: -1, py: -1, active: false, owners: {} },
    loaded: false, restoreMsg: '', serveWait: 0, hoverT: [0, 0], lastHoverMsg: false,
  };
  Object.defineProperty(state, 'owned', { get: () => !!monetization.owns('unlock_game'), enumerable: false });
  // Store-screenshot capture (?shot=1): the kit's random input plays a real match; menus and pause never take over the frame.
  const SHOT = /[?&]shot=/.test(String(globalThis.location?.search ?? ''));
  let brains = [null, null];
  let attBrains = null;

  const flowMax = () => { const mt = flowMeta(); return mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0; };

  // ---- persistence -----------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < PROFILES.length) state.record.wins = [0, 0, 0, 0, 0];
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound -----------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    pad: (v) => { const q = Math.min(1, v / 1100); tone({ freq: 880 + fx.next() * 140, to: 420, dur: 0.06, type: 'square', vol: 0.025 + 0.05 * q }); tone({ freq: 210 + fx.next() * 40, to: 110, dur: 0.1, type: 'triangle', vol: 0.05 + 0.1 * q }); },
    wall: (v) => { const q = Math.min(1, v / 900); tone({ freq: 330, to: 150, dur: 0.07, type: 'sine', vol: 0.03 + 0.09 * q }); },
    post: (v) => tone({ freq: 1750 + fx.next() * 200, to: 1500, dur: 0.24, type: 'sine', vol: 0.04 + 0.06 * Math.min(1, v / 700) }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    count: (go) => tone({ freq: go ? 880 : 520, dur: go ? 0.22 : 0.09, type: 'triangle', vol: 0.08 }),
    horn: () => { [262, 330, 392].forEach((f, i) => tone({ freq: f, to: f * 0.99, dur: 0.6 + i * 0.05, type: 'sawtooth', vol: 0.045 })); tone({ freq: 523, dur: 0.8, type: 'square', vol: 0.02 }); },
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
    seven: () => tone({ freq: 300, to: 200, dur: 0.3, type: 'triangle', vol: 0.06 }),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- particles -------------------------------------------------------------------------------
  const MAX_PARTS = 160;
  const addPart = (parts, q) => { if (parts.length < MAX_PARTS) parts.push(q); };
  const puff = (parts, x, y, n, col = 'rgba(255,248,230,0.9)', sp = 90) => {
    for (let i = 0; i < n; i++) { const a = fx.next() * TAU, s = 20 + fx.next() * sp; addPart(parts, { kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.35 + fx.next() * 0.35, size: 2.2 + fx.next() * 3.2, col }); }
  };
  const sparks = (parts, x, y, n) => {
    for (let i = 0; i < n; i++) { const a = fx.next() * TAU, s = 160 + fx.next() * 320; addPart(parts, { kind: 1, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.16 + fx.next() * 0.16 }); }
  };
  const petals = (parts, x, y, n) => {
    const cols = ['#d63f28', '#e9b74a', '#1f8479', '#fff3d6', '#ff8a6a'];
    for (let i = 0; i < n; i++) {
      const a = fx.next() * TAU, s = 120 + fx.next() * 380;
      addPart(parts, { kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 1.0 + fx.next() * 0.8, size: 7 + fx.next() * 6, leaf: i % 2 === 0, rot: fx.next() * 6, col: cols[i % cols.length] });
    }
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.2 }); if (state.pops.length > 6) state.pops.shift(); };

  const worldEvents = (parts, ev, live) => {
    for (const e of ev) {
      if (e.t === 'pad') {
        sparks(parts, e.x, e.y, Math.min(9, 2 + Math.floor(e.v / 120)));
        puff(parts, e.x, e.y, 2 + Math.floor(e.v / 260));
        addPart(parts, { kind: 2, x: e.x, y: e.y, vx: 0, vy: 0, t: 0, max: 0.3, size: 22, col: '#fff3c0' });
        if (live) sfx.pad(e.v);
      } else if (e.t === 'wall') {
        puff(parts, e.x, e.y, 2 + Math.floor(e.v / 260), 'rgba(255,240,200,0.9)', 60);
        if (live) sfx.wall(e.v);
      } else if (e.t === 'post') {
        sparks(parts, e.x, e.y, 6); addPart(parts, { kind: 2, x: e.x, y: e.y, vx: 0, vy: 0, t: 0, max: 0.3, size: 26, col: '#ffd36a' });
        if (live) sfx.post(e.v);
      } else if (e.t === 'goal') {
        petals(parts, e.x, e.y > 0 ? HH - 30 : -HH + 30, 44);
        if (live) sfx.horn();
      }
    }
  };

  // The computer players think at a fixed 60 Hz whatever the display rate (same reaction delay in seconds at 30/60/120 Hz).
  const BRAIN_DT = 1 / 60;
  const thinkTicks = (owner, dt) => {
    owner.bAcc = Math.min((owner.bAcc || 0) + dt, 0.1);
    let n = 0;
    while (owner.bAcc >= BRAIN_DT - 1e-9) { owner.bAcc -= BRAIN_DT; n++; }
    return n;
  };
  // Puck trail: a short comet of fading points laid every ~9 units of travel, so it follows speed (nothing when slow,
  // longer and brighter when fast) and looks the same at any frame rate.
  const fadeTrail = (trail, w, dt) => {
    const u = w.puck, sp = Math.hypot(u.vx, u.vy);
    for (const q of trail) q.a -= dt * 4;
    while (trail.length && trail[0].a <= 0) trail.shift();
    const last = trail[trail.length - 1];
    if (sp > 260 && (!last || Math.hypot(u.x - last.x, u.y - last.y) >= 9)) {
      trail.push({ x: u.x, y: u.y, a: Math.min(1, (sp - 200) / 520) });
      if (trail.length > 7) trail.shift();
    }
  };

  // ---- the attract table behind the menus ------------------------------------------------------
  const startAttract = () => {
    const w = createWorld(); placeServe(w, fx.int(2)); resetPads(w, true);
    attBrains = [createBrain(0, PROFILES[2], fx.fork()), createBrain(1, PROFILES[1], fx.fork())];
    state.att = { w, parts: [], trail: [], wait: 1.0, rest: 0 };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    if (a.wait > 0) { a.wait -= dt; a.w.hold = a.wait > 0; stepWorld(a.w, dt); return; }
    for (let n = thinkTicks(a, dt); n > 0; n--) attBrains.forEach((b) => brainStep(b, a.w, BRAIN_DT, {}));
    const ev = stepWorld(a.w, dt);
    if (ev.length) worldEvents(a.parts, ev, false);
    if (a.w.goal) {
      a.wait = 1.4; placeServe(a.w, 1 - a.w.goal.side); resetPads(a.w, false); a.w.hold = true;
      attBrains.forEach((b) => { b.phase = 'idle'; b.plan = null; b.cool = 0; });
      a.trail = []; a.rest = 0;
    } else {
      const sp = Math.hypot(a.w.puck.vx, a.w.puck.vy), half = a.w.puck.y > 0 ? 0 : 1;
      if (sp < 40) { a.rest += dt; if (a.rest > 5) { a.rest = 0; placeServe(a.w, 1 - half); } } else a.rest = 0;
    }
    stepParts(a.parts, dt); fadeTrail(a.trail, a.w, dt);
  };

  // ---- match flow --------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);

  const makeBrains = () => {
    brains = [null, null];
    for (const s of [0, 1]) if (isAI(s)) brains[s] = createBrain(s, profOf(s), aiRng.fork());
  };

  // Put the puck on the server's half and bring the paddles home; then count in (or, in Watch & Learn, think first).
  const beginServe = (first = false) => {
    const m = state.m, w = state.w;
    placeServe(w, m.server); resetPads(w, first);
    w.hold = true; w.puck.scale = 0;
    m.phase = 'ready'; m.readyT = 0; m.countN = -1;
    state.freeze = null; state.trail = []; state.hoverT = [0, 0]; state.lastHoverMsg = false;
    state.pendingPlan = null;
    for (const b of brains) if (b) { b.phase = 'idle'; b.plan = null; b.cool = 0; b.hist.length = 0; }
    state.serveWait = 0;
    if (mode() === 'watch') beginThink();
  };

  const planFor = (side) => {
    const w = state.w, f = side === 0 ? 1 : -1, pu = w.puck, opp = w.pads[1 - side];
    return planShot(profOf(side), aiRng, { x: pu.x, y: pu.y * f }, { x: opp.x, y: opp.y * f });
  };
  const beginThink = () => {
    const m = state.m, side = m.server;
    const plan = planFor(side);
    state.freeze = { kind: 'think', side, t: 0, dur: THINK_STEPS[state.settings.thinkIdx], plan, coach: null };
    toast(`${sideName(state, side)} is thinking about the serve…`, state.freeze.dur);
  };
  const stepFreeze = (dt) => {
    const f = state.freeze;
    f.t += dt;
    if (f.kind === 'think' && f.t >= f.dur) {
      const side = f.side, w = state.w, fr = side === 0 ? 1 : -1, pl = f.plan, pu = w.puck;
      const ang = Math.atan2(pl.aim.y - pu.y * fr, pl.aim.x - pu.x) + pl.errAng;
      const line = shotLine(pu.x, pu.y, Math.cos(ang), Math.sin(ang) * fr);
      const back = { x: pu.x - Math.cos(ang) * (R_PAD + R_PUCK + 12), y: pu.y - Math.sin(ang) * fr * (R_PAD + R_PUCK + 12) };
      state.freeze = { kind: 'reveal', side, t: 0, dur: 2, plan: pl, coach: { kind: 'strike', line: line.pts, stand: back } };
      toast(`${sideName(state, side)}: ${describeShot(pl)}`, 2.1);
      sfx.tick();
    } else if (f.kind === 'reveal' && f.t >= f.dur) {
      state.freeze = null; state.pendingPlan = f.plan; state.pendingSide = f.side;
      state.m.phase = 'ready'; state.m.readyT = READY_T - 0.35;   // straight on to the serve
    } else if (f.kind === 'hint' && f.t >= f.dur) { state.freeze = null; }
  };

  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.w = createWorld();
    state.m = newMatch({ mode: 'ai', opp: 0, goalsTo: LENGTHS[0], first: aiRng.int(2), ...cfg });
    state.m.lastGoal = null;
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.pops = []; state.trail = []; state.goalT = 0; state.pocket = 0; state.freeze = null; state.pendingPlan = null;
    state.ctl = { px: -1, py: -1, active: false, owners: {} };
    makeBrains();
    beginServe(true);
    const who = sideName(state, state.m.server);
    if (mode() !== 'watch') toast(`${who} ${who === 'You' || who.startsWith('Player') ? 'serve' : 'serves'} first`, 2.2);
  };
  const startWatch = () => {
    const picks = [0, 1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, goalsTo: WATCH_GOALS });
  };

  const onGoal = () => {
    const { m, w } = state;
    const side = w.goal.side;
    m.phase = 'goal'; state.goalT = 0; m.lastGoal = side;
    state.pocket = side === 0 ? -1 : 1;
    goalFor(m, side, w.goal.speed);
    if (!isAI(side) && mode() !== 'watch') state.record.goals = (state.record.goals | 0) + 1;
    const who = sideName(state, side);
    toast(`${who} ${who === 'You' ? 'score' : 'scores'}! ${m.scores[0]}–${m.scores[1]}`, 2.0);
    pop(0, state.pocket * (HH - 120), '+1', '#ffe08a', 56);
    state.freeze = null;
  };
  const finishMatch = () => {
    const m = state.m;
    state.scene = 'result'; state.ui.scroll = 0; state.paused = false;
    if (m.cfg.mode === 'ai') {
      state.record.played++;
      if (m.over.win === 0) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); sfx.win(); } else state.record.streak = 0;
    }
    if (m.cfg.mode !== 'watch') state.record.demoMatches++;
    save();
  };

  // ---- human control ----------------------------------------------------------------------------
  const setTarget = (side, wx, wy, down, L) => {
    const pad = state.w.pads[side];
    const off = down ? clamp(56 / L.s, 26, 90) : 0;    // the paddle rides a little ahead of the finger so the thumb never hides it
    pad.tx = wx; pad.ty = wy + (side === 0 ? -off : off);
  };
  const controlHumans = (dt, input, L) => {
    const m = state.m, ptr = input.pointer, keys = input.keys;
    const two = m.cfg.mode === 'two';
    const touches = input.touches;
    const inCtrl = (x, y) => inRect(L.ctrl, x, y) || inRect(L.sb, x, y);
    if (two && touches && touches.length) {
      // real multi-touch: each finger takes the paddle of the half it first lands on
      const own = state.ctl.owners, live = {};
      for (const tc of touches) {
        live[tc.id] = true;
        if (own[tc.id] === undefined) {
          if (inCtrl(tc.x, tc.y)) continue;
          const p = toWorld(L, tc.x, tc.y), side = p.y > 0 ? 0 : 1;
          if (Object.values(own).includes(side)) continue;
          own[tc.id] = side;
        }
      }
      for (const id of Object.keys(own)) if (!live[id]) delete own[id];
      for (const tc of touches) {
        const side = own[tc.id];
        if (side === undefined) continue;
        const p = toWorld(L, tc.x, tc.y);
        setTarget(side, p.x, p.y, true, L);
      }
    } else {
      const moved = ptr.x !== state.ctl.px || ptr.y !== state.ctl.py || ptr.down;
      state.ctl.px = ptr.x; state.ctl.py = ptr.y;
      if (moved && state.ctl.active && !inCtrl(ptr.x, ptr.y)) {
        const p = toWorld(L, ptr.x, ptr.y);
        setTarget(0, p.x, p.y, ptr.down, L);
      }
      if (moved) state.ctl.active = true;
    }
    // keyboard: arrows move your paddle; WASD is the second player's (or yours as well against the computer)
    const kd = (c) => keys.down.has(c);
    const k0 = [kd('ArrowLeft') ? -1 : 0, kd('ArrowRight') ? 1 : 0, kd('ArrowUp') ? -1 : 0, kd('ArrowDown') ? 1 : 0];
    const k1 = [kd('KeyA') ? -1 : 0, kd('KeyD') ? 1 : 0, kd('KeyW') ? -1 : 0, kd('KeyS') ? 1 : 0];
    const key = (side, k) => {
      const dx = k[0] + k[1], dy = k[2] + k[3];
      if (!dx && !dy) return;
      const pad = state.w.pads[side];
      pad.tx = clamp(pad.tx + dx * KEY_SPEED * dt, -HW, HW);
      pad.ty = clamp(pad.ty + dy * KEY_SPEED * dt, -HH, HH);
    };
    key(0, k0);
    if (two) key(1, k1); else key(0, k1);
  };

  // ---- the play scene ----------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const requestHint = () => {
    const m = state.m;
    if (state.freeze || m.cfg.mode === 'watch' || m.over || m.phase === 'goal') return;
    const c = coach(state.w, 0, PROFILES[4], hintRng);
    state.freeze = { kind: 'hint', side: 0, t: 0, dur: 6, coach: c };
    toast(c.text, 6);
    sfx.tick();
  };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch', two = m.cfg.mode === 'two';
    const L = layoutOf(state);
    if (config.dev && keys.pressed.has('KeyK')) { m.scores[0] = m.cfg.goalsTo; m.over = { win: 0 }; finishMatch(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) {
        const d = state.ui.drag; state.ui.drag = null;
        if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      }
      return;
    }
    if (watch) {
      if (ptr.pressed) {
        const D = L.demo;
        if (inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(D.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (ptr.pressed && inRect(L.menu, ptr.x, ptr.y)) { openPause(); return; }
    else if (ptr.pressed && L.hint && inRect(L.hint, ptr.x, ptr.y)) {
      if (state.freeze && state.freeze.kind === 'hint') { state.freeze = null; sfx.tick(); } else requestHint();
    } else if (keys.pressed.has('KeyH') && !two) {
      if (state.freeze && state.freeze.kind === 'hint') state.freeze = null; else requestHint();
    } else if (ptr.pressed && state.freeze && state.freeze.kind === 'hint' && state.freeze.t > 0.4) state.freeze = null;
    if (state.paused) return;

    // everything below is the live game
    const w = state.w;
    w.calm = state.settings.calm;
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;

    if (state.freeze) {
      // coaching freeze: the puck waits, paddles may still be positioned
      w.puck.scale = Math.min(1, w.puck.scale + dt * 4);
      stepFreeze(dt);
      if (!watch) controlHumans(dt, input, L);
      if (state.freeze || m.phase === 'ready') { w.hold = true; stepWorld(w, dt); }
      stepParts(state.parts, dt);
      return;
    }

    if (!watch) controlHumans(dt, input, L);
    stepParts(state.parts, dt);
    fadeTrail(state.trail, w, dt);

    if (m.phase === 'goal') {
      w.hold = false;
      const ev = stepWorld(w, dt); if (ev.length) worldEvents(state.parts, ev, true);
      state.goalT += dt;
      if (state.goalT >= GOAL_T || (ptr.pressed && state.goalT > 1.0)) { if (m.over) finishMatch(); else beginServe(false); }
      return;
    }
    if (m.phase === 'ready') {
      m.readyT += dt;
      w.puck.scale = Math.min(1, w.puck.scale + dt * 4);
      const n = m.readyT < 0.6 ? 3 : m.readyT < 1.2 ? 2 : 1;
      if (m.countN !== n && m.readyT < READY_T) { m.countN = n; sfx.count(false); }
      w.hold = true;
      for (let n = thinkTicks(state, dt); n > 0; n--) for (const b of brains) if (b) brainStep(b, w, BRAIN_DT, { hold: true });
      stepWorld(w, dt);
      if (m.readyT >= READY_T) {
        m.phase = 'live'; w.hold = false; w.puck.scale = 1; sfx.count(true);
        const pf = PROFILES[m.cfg.opp];
        state.serveWait = isAI(m.server) && mode() !== 'watch' ? pf.think[0] + aiRng.next() * (pf.think[1] - pf.think[0]) : 0;
      }
      return;
    }
    // live
    w.hold = false;
    const waitingServe = w.rallyHits === 0 && Math.hypot(w.puck.vx, w.puck.vy) < 5;
    if (state.serveWait > 0 && waitingServe) state.serveWait -= dt;
    for (let n = thinkTicks(state, dt); n > 0; n--) {
      for (const b of brains) {
        if (!b) continue;
        const ctx = {};
        if (waitingServe && state.pendingPlan && b.side === state.pendingSide) ctx.plan = state.pendingPlan;
        if (waitingServe && state.serveWait > 0 && b.side === m.server) ctx.hold = true;
        brainStep(b, w, BRAIN_DT, ctx);
      }
    }
    const ev = stepWorld(w, dt);
    if (ev.length) worldEvents(state.parts, ev, true);
    if (w.goal) { onGoal(); return; }
    const half = w.puck.y > 0 ? 0 : 1, sp = Math.hypot(w.puck.vx, w.puck.vy);
    if (sp > 20) state.pendingPlan = null;
    // the seven-second rule: a puck left resting on one half goes to the other side
    if (sp < 40 && !(waitingServe && state.serveWait > 0)) {
      state.hoverT[half] += dt; state.hoverT[1 - half] = 0;
      if (state.hoverT[half] > HOVER_LIMIT) {
        state.hoverT = [0, 0]; state.lastHoverMsg = false; placeServe(w, 1 - half); w.puck.scale = 1; sfx.seven();
        toast('Seven seconds: the puck goes to the other side', 2.4);
      } else if (state.hoverT[half] > HOVER_LIMIT - 3 && !isAI(half) && !state.lastHoverMsg) { state.lastHoverMsg = true; toast('Play the puck: after seven seconds on one side it goes over', 2.2); }
    } else { state.hoverT = [0, 0]; state.lastHoverMsg = false; }
  };

  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.freeze = null; };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-calm') { state.settings.calm = !state.settings.calm; save(); }
    else if (id === 'quit') leaveMatch();
  }

  // ---- menus ------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag;
    const mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, flowMax());
  }
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'play') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'two') { state.setup.mode = 'two'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id === 'len5') s.goalsTo = LENGTHS[0];
    else if (id === 'len7') s.goalsTo = LENGTHS[1];
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, goalsTo: s.goalsTo });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-calm') st.calm = !st.calm;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (monetization.owns('unlock_game')) { state.restoreMsg = 'Full game unlocked.'; return; }
      if (state.restoreBusy) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.())
        .then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; })
        .catch(() => { state.restoreMsg = 'The store is not available right now. Please try again.'; })
        .finally(() => { state.restoreBusy = false; });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.m.cfg;
    if (id === 'again') startMatch({ ...cfg, first: aiRng.int(2) });
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    state.ui.scroll = clamp(state.ui.scroll, 0, flowMax());
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta();
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const max = flowMax();
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };

  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('KeyO') && state.setup.mode === 'ai') state.setup.opp = (state.setup.opp + 1) % (state.demo ? 2 : PROFILES.length);
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    ensureLayout(state, 'setup');
    const pins = setupPinRects(state);
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) {
      handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  let refDrag = null, wheelHooked = false;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const RL = refLayout(), set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y) || inRect(RL.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(RL.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.refScroll = 0; save(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.refScroll = 0; save(); }
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

  startAttract();
  resetMenus();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match, a coaching
    // freeze and the goal celebration do not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused || !!state.freeze || (!!state.m && state.m.phase === 'goal'),
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'setup', 'settings', 'result', 'demolimit'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, flowMax());
        });
      }
      syncSize();
      if (SHOT && state.scene !== 'play') startMatch({ mode: 'ai', opp: (config.seed | 0) % 4 + 1, goalsTo: LENGTHS[0], first: 0 });
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
      if (SHOT) { state.paused = false; state.pauseMenu = false; }
    },
    render(ctx) {
      syncSize();
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.m) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
    dev: config.dev ? { project: (x, y) => toScreen(layoutOf(state), x, y), startMatch, startWatch, handleTitle, setScene: (n) => { state.scene = n; state.ui.scroll = 0; state.refScroll = 0; state.back = 'title'; } } : null,
  };
}
