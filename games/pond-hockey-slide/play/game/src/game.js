// Pond Hockey Slide: state and flow. Physics lives in sim.js, rules in match.js, drawing in view.js, art.js and menus.js, the
// opponent in ai.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto/about/rules, demolimit.
// Shooting: press one of your skaters and drag back like a slingshot; pull length = power, pull direction = aim; release.
import {
  createWorld, resetWorld, launch, stepWorld, previewShot, skatersOf, puckOf, clamp, STEP, HH, R_SKATER,
} from './sim.js';
import { newMatch, afterShot, goalFor, LENGTHS } from './match.js';
import { createPlanner, executePlan, describePlan } from './ai.js';
import { PROFILES } from './opponents.js';
import { inRect, PULL, TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, toWorld, toScreen } from './layout.js';
import { renderPlay, layoutOf, sideName } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, REF, ensureLayout, resetMenus, setupPinRects, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export { meta };
const DEMO_MATCH_CAP = 1;
const GOAL_T = 2.4;         // seconds of celebration
const RESET_T = 1.0;        // seconds the skaters take to skate back to their spots
export const STRAY_JUMP = 220;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const potRng = rng.fork();     // drift layouts
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, calm: false, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0], played: 0, streak: 0, best: 0, demoMatches: 0, goals: 0, shots: 0 },
    setup: { mode: 'ai', opp: 0, goalsTo: LENGTHS[0] }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    att: null, w: null, m: null,
    aim: { id: null, ang: -Math.PI / 2, power: 0.5, active: false }, preview: null, hint: null, hintPreview: null, hintBusy: false,
    parts: [], pops: [], trails: [], toast: '', toastT: 0, humanTurn: false, pass: null, lastSide: -1,
    think: null, drag: null, kbOn: false, loaded: false, restoreMsg: '', ff: 1, flyT: 0, restT: 0, goalT: 0, resetT: 0, reset: null, suddenSaid: false,
  };
  let planner = null, hintPlanner = null, previewKey = '';
  const flowMax = () => { const mt = flowMeta(); return mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0; };

  // ---- persistence -----------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < PROFILES.length) state.record.wins = [0, 0, 0, 0];
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound -----------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    push: (p = 0.5) => { tone({ freq: 700 - p * 300, to: 220, dur: 0.22, type: 'sawtooth', vol: 0.03 }); tone({ freq: 3000, to: 1800, dur: 0.12, type: 'square', vol: 0.012 }); },
    stick: (v) => { const q = Math.min(1, v / 700); tone({ freq: 1250 + fx.next() * 260, to: 640, dur: 0.05, type: 'square', vol: 0.03 + 0.06 * q }); tone({ freq: 360 + fx.next() * 60, to: 180, dur: 0.09, type: 'triangle', vol: 0.05 + 0.1 * q }); },
    bank: (v) => { const q = Math.min(1, v / 600); tone({ freq: 150, to: 70, dur: 0.14, type: 'sine', vol: 0.05 + 0.1 * q }); tone({ freq: 420, to: 200, dur: 0.07, type: 'triangle', vol: 0.03 * q }); },
    check: (v) => tone({ freq: 190, to: 90, dur: 0.12, type: 'sine', vol: 0.04 + 0.08 * Math.min(1, v / 500) }),
    post: (v) => tone({ freq: 1900 + fx.next() * 200, to: 1700, dur: 0.22, type: 'sine', vol: 0.04 + 0.06 * Math.min(1, v / 500) }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    horn: () => { [262, 330, 392].forEach((f, i) => tone({ freq: f, to: f * 0.99, dur: 0.7 + i * 0.05, type: 'sawtooth', vol: 0.05 })); tone({ freq: 520, to: 520, dur: 0.9, type: 'square', vol: 0.02 }); },
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- particles -------------------------------------------------------------------------------
  const MAX_PARTS = 180;
  const addPart = (parts, q) => { if (parts.length < MAX_PARTS) parts.push(q); };
  const puff = (parts, x, y, n, col = 'rgba(255,255,255,0.9)', sp = 90) => {
    for (let i = 0; i < n; i++) { const a = fx.next() * Math.PI * 2, s = 20 + fx.next() * sp; addPart(parts, { kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.4 + fx.next() * 0.4, size: 2.2 + fx.next() * 3.4, col }); }
  };
  const sparks = (parts, x, y, n) => {
    for (let i = 0; i < n; i++) { const a = fx.next() * Math.PI * 2, s = 140 + fx.next() * 300; addPart(parts, { kind: 1, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.16 + fx.next() * 0.16 }); }
  };
  const confetti = (parts, x, y, n) => {
    const cols = ['#ff6a4d', '#ffd35a', '#4aa8ff', '#ffffff', '#6fe0c0'];
    for (let i = 0; i < n; i++) {
      const a = fx.next() * Math.PI * 2, s = 140 + fx.next() * 360, toque = i % 3 === 0;
      addPart(parts, { kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 1.0 + fx.next() * 0.7, size: toque ? 9 + fx.next() * 4 : 3 + fx.next() * 2.5, leaf: toque, rot: fx.next() * 6, col: cols[i % cols.length] });
    }
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.95; q.vy *= 0.95; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.2 }); if (state.pops.length > 8) state.pops.shift(); };

  const worldEvents = (parts, ev, live) => {
    for (const e of ev) {
      if (e.t === 'stick') {
        sparks(parts, e.x, e.y, Math.min(8, 2 + Math.floor(e.v / 110)));
        puff(parts, e.x, e.y, 3 + Math.floor(e.v / 200), 'rgba(235,248,255,0.95)');
        addPart(parts, { kind: 2, x: e.x, y: e.y, vx: 0, vy: 0, t: 0, max: 0.32, size: 24, col: '#ffffff' });
        if (live) sfx.stick(e.v);
      } else if (e.t === 'bank') {
        puff(parts, e.x, e.y, 3 + Math.floor(e.v / 160), 'rgba(255,255,255,0.95)', 70);
        if (live) sfx.bank(e.v);
      } else if (e.t === 'check') {
        puff(parts, e.x, e.y, 3, 'rgba(235,245,255,0.9)', 60);
        if (live) sfx.check(e.v);
      } else if (e.t === 'post') {
        sparks(parts, e.x, e.y, 5); addPart(parts, { kind: 2, x: e.x, y: e.y, vx: 0, vy: 0, t: 0, max: 0.3, size: 26, col: '#ff8a7a' });
        if (live) sfx.post(e.v);
      } else if (e.t === 'goal') {
        confetti(parts, e.x, e.y < 0 ? -HH + 20 : HH - 20, 46);
        if (live) sfx.horn();
      }
    }
  };

  // skate trails: a line segment per moving skater per frame
  const addTrails = (w, dt) => {
    for (const b of w.bodies) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 70 && b.kind === 'skater') {
        const nx = -b.vy / sp, ny = b.vx / sp;
        for (const o of [-9, 9]) state.trails.push({ x0: b.x - b.vx * dt + nx * o, y0: b.y - b.vy * dt + ny * o, x1: b.x + nx * o, y1: b.y + ny * o, a: 1 });
      }
    }
    if (state.trails.length > 700) state.trails.splice(0, state.trails.length - 700);
  };
  const fadeTrails = (list, dt) => {
    for (const q of list) q.a -= dt * 0.16;
    while (list.length && list[0].a <= 0) list.shift();
  };
  // standing skaters turn to watch the puck
  const idleFaces = (w, dt) => {
    const p = puckOf(w);
    for (const b of w.bodies) {
      if (b.kind !== 'skater' || Math.hypot(b.vx, b.vy) > 30) continue;
      const target = Math.atan2(p.y - b.y, p.x - b.x);
      let d = target - b.face; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      b.face += d * Math.min(1, dt * 4);
    }
  };

  // ---- the attract pond behind the menus ---------------------------------------------------------
  const startAttract = () => {
    const w = createWorld(); resetWorld(w, fx.fork());
    state.att = { w, parts: [], trails: [], wait: 1.2, n: 0 };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.wait -= dt;
    if (a.wait <= 0 && a.w.settled) {
      a.wait = 3.0 + fx.next() * 1.4;
      const side = a.n++ % 2, list = skatersOf(a.w, side), b = list[fx.int(list.length)], p = puckOf(a.w);
      const ang = Math.atan2(p.y - b.y, p.x - b.x) + (fx.next() - 0.5) * 0.5, d = Math.hypot(p.x - b.x, p.y - b.y);
      launch(a.w, b.id, ang, clamp((d * 0.95 + 60 - 150) / 810, 0.1, 0.9));
    }
    if (!a.w.settled) {
      for (let i = 0; i < 2; i++) { const ev = stepWorld(a.w, STEP); if (ev.length) worldEvents(a.parts, ev, false); }
      if (a.w.goal) { resetWorld(a.w, fx.fork()); a.trails = []; a.wait = 1.4; }
      else {
        for (const b of a.w.bodies) {
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > 70 && b.kind === 'skater') { const nx = -b.vy / sp, ny = b.vx / sp; for (const o of [-9, 9]) a.trails.push({ x0: b.x - b.vx * dt + nx * o, y0: b.y - b.vy * dt + ny * o, x1: b.x + nx * o, y1: b.y + ny * o, a: 1 }); }
        }
        if (a.trails.length > 500) a.trails.splice(0, a.trails.length - 500);
      }
    } else idleFaces(a.w, dt);
    for (const b of a.w.bodies) { if (b.swing > 0) b.swing = Math.max(0, b.swing - dt * 1.7); if (b.hit > 0) b.hit = Math.max(0, b.hit - dt * 2.6); }
    stepParts(a.parts, dt);
    fadeTrails(a.trails, dt);
  };

  // ---- match flow --------------------------------------------------------------------------------
  const mode = () => state.m.cfg.mode;
  const isAI = (side) => mode() === 'watch' || (mode() === 'ai' && side === 1);
  const profOf = (side) => (mode() === 'watch' ? PROFILES[side === 0 ? state.m.cfg.watchA : state.m.cfg.opp] : PROFILES[state.m.cfg.opp]);

  const beginTurn = () => {
    const m = state.m, side = m.turn;
    m.phase = 'aim';
    state.humanTurn = !isAI(side);
    state.hint = null; state.hintPreview = null; state.think = null; state.preview = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; state.kbOn = false;
    state.pass = (m.cfg.mode === 'two' && state.lastSide >= 0 && state.lastSide !== side) ? { side, t: 0 } : null;
    state.lastSide = side;
    state.aim = { id: null, ang: side === 0 ? -Math.PI / 2 : Math.PI / 2, power: 0.5, active: false };
    if (state.humanTurn) toast(m.cfg.mode === 'two' ? `${sideName(state, side)}: press a skater and pull back` : 'Your shot: press a skater and pull back', 2.6);
    else if (m.cfg.mode !== 'watch') toast(`${sideName(state, side)} is thinking…`, 2.0);
  };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.w = createWorld();
    state.m = newMatch({ mode: 'ai', opp: 0, goalsTo: LENGTHS[0], first: aiRng.int(2), ...cfg });
    resetWorld(state.w, potRng);
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.parts = []; state.pops = []; state.trails = []; state.pass = null; state.lastSide = -1; state.goalT = 0; state.reset = null; state.ff = 1; state.suddenSaid = false;
    beginTurn();
    const who = sideName(state, state.m.turn);
    toast(`${who} ${who === 'You' ? 'shoot' : 'shoots'} first`, 2.4);
  };
  const startWatch = () => {
    const picks = [0, 1, 2, 3];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, goalsTo: LENGTHS[0] });
  };

  const throwSkater = (side, p) => {
    const { m, w } = state;
    launch(w, p.id, p.ang, p.power);
    m.phase = 'fly';
    if (!isAI(side)) state.record.shots = (state.record.shots | 0) + 1;
    state.humanTurn = false; state.preview = null; state.hint = null; state.hintPreview = null; state.drag = null; state.think = null; state.kbOn = false;
    state.aim.active = false;
    planner = null; hintPlanner = null; state.hintBusy = false;
    state.restT = 0; state.flyT = 0;
    sfx.push(p.power);
  };

  const onSettled = () => {
    const { m } = state;
    afterShot(m);
    if (m.over) { finishMatch(); return; }
    if (m.sudden && !state.suddenSaid) { state.suddenSaid = true; beginTurn(); toast('Sudden death: the next goal wins', 3); return; }
    beginTurn();
  };
  const onGoal = () => {
    const { m, w } = state;
    const side = w.goal.side;
    m.phase = 'goal'; state.goalT = 0;
    goalFor(m, side);
    if (!isAI(side) && mode() !== 'watch') state.record.goals = (state.record.goals | 0) + 1;
    const who = sideName(state, side);
    toast(`${who} ${who === 'You' ? 'score' : 'scores'}! ${m.scores[0]}–${m.scores[1]}`, 2.2);
    pop(0, side === 0 ? -HH + 110 : HH - 110, '+1', '#ffe08a', 56);
    state.humanTurn = false; state.think = null; state.preview = null; state.hint = null;
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
  const startReset = () => {
    // everyone skates back to the kick-off spots while the drifts are laid out afresh
    const fresh = createWorld();
    const from = state.w.bodies.map((b) => ({ id: b.id, x: b.x, y: b.y }));
    const to = fresh.bodies.map((b) => ({ id: b.id, x: b.x, y: b.y }));
    state.reset = { from, to }; state.resetT = 0;
    for (const b of state.w.bodies) { b.vx = 0; b.vy = 0; }
    state.m.phase = 'reset';
  };
  const stepReset = (dt) => {
    const r = state.reset; state.resetT += dt;
    const k = Math.min(1, state.resetT / RESET_T), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    for (const b of state.w.bodies) {
      const f = r.from.find((q) => q.id === b.id), t = r.to.find((q) => q.id === b.id);
      const px = b.x, py = b.y;
      b.x = f.x + (t.x - f.x) * e; b.y = f.y + (t.y - f.y) * e;
      const sp = Math.hypot(b.x - px, b.y - py) / dt;
      b.glide = Math.min(1, sp / 420);
      if (b.kind === 'skater' && sp > 20) { let d = Math.atan2(b.y - py, b.x - px) - b.face; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; b.face += d * Math.min(1, dt * 9); }
    }
    if (k >= 1) { resetWorld(state.w, potRng); state.trails = []; state.reset = null; beginTurn(); }
  };

  // ---- aiming ------------------------------------------------------------------------------------
  const updatePreview = () => {
    const { w, aim } = state;
    if (!aim.id) return;
    const key = `${aim.id}|${aim.ang.toFixed(3)}|${aim.power.toFixed(3)}`;
    if (key === previewKey && state.preview) return;
    previewKey = key;
    state.preview = previewShot(w, aim.id, aim.ang, aim.power, 1.5);
  };
  const pickSkater = (L, x, y) => {
    const p = toWorld(L, x, y);
    let best = null, bd = 1e9;
    for (const b of skatersOf(state.w, state.m.turn)) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < bd) { bd = d; best = b; } }
    return best && bd <= R_SKATER + 38 ? best : null;
  };
  const dragAim = (dr, ptr, L) => {
    const vx = dr.sx - ptr.x, vy = dr.sy - ptr.y;   // pull vector on screen; the skater glides along it
    const c = Math.cos(-L.rot), s = Math.sin(-L.rot), wx = vx * c - vy * s, wy = vx * s + vy * c;
    const len = Math.hypot(vx, vy);
    dr.len = len; dr.valid = len >= PULL.min;
    if (len > 4) state.aim.ang = Math.atan2(wy, wx);
    state.aim.power = clamp((len - PULL.min) / (PULL.max - PULL.min), 0, 1);
    state.aim.active = len >= PULL.min;
    if (dr.valid) updatePreview(); else state.preview = null;
  };

  // ---- AI turn -----------------------------------------------------------------------------------
  const beginPull = (th) => {
    const prof = profOf(state.m.turn);
    th.p = executePlan(th.plan, prof, aiRng);
    th.phase = 'pull'; th.t = 0; th.dur = 0.6; state.hint = null; state.preview = null;
  };
  const updateAI = (dt) => {
    const { m } = state;
    if (m.phase !== 'aim' || !isAI(m.turn) || state.paused) return;
    const prof = profOf(m.turn), watch = mode() === 'watch', side = m.turn;
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      state.think = { t: 0, dur, phase: 'think', plan: null, p: null };
      planner = createPlanner(state.w, side, prof, aiRng, {});
      if (watch) toast(`${sideName(state, side)} is thinking…`, dur);
    }
    const th = state.think;
    th.t += dt;
    if (planner && !planner.done) { planner.step(10); if (planner.done) { th.plan = planner.result; planner = null; } }
    if (th.phase === 'think' && th.t >= th.dur && th.plan) {
      if (watch) {
        th.phase = 'reveal'; th.t = 0; th.dur = 2;
        state.hint = th.plan;
        state.aim = { id: th.plan.id, ang: th.plan.ang, power: th.plan.power, active: false };
        state.preview = previewShot(state.w, th.plan.id, th.plan.ang, th.plan.power, 1.5);
        toast(`${sideName(state, side)}: ${describePlan(th.plan, state.w, side)}`, 2.1);
      } else beginPull(th);
    } else if (th.phase === 'reveal' && th.t >= th.dur) beginPull(th);
    else if (th.phase === 'pull') {
      const k = Math.min(1, th.t / th.dur), e = 1 - Math.pow(1 - k, 3);
      state.aim = { id: th.p.id, ang: th.p.ang, power: th.p.power * e, active: true };
      if (th.t >= th.dur) throwSkater(side, th.p);
    }
  };

  // ---- hint --------------------------------------------------------------------------------------
  const requestHint = () => {
    const m = state.m;
    if (state.hintBusy || m.phase !== 'aim' || !state.humanTurn) return;
    state.hintBusy = true;
    hintPlanner = createPlanner(state.w, m.turn, PROFILES[PROFILES.length - 1], aiRng, { perfect: true });
  };
  const updateHint = () => {
    if (!hintPlanner) return;
    hintPlanner.step(10);
    if (hintPlanner.done) {
      const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.m.phase !== 'aim' || !state.humanTurn) return;
      state.hint = r;
      state.hintPreview = previewShot(state.w, r.id, r.ang, r.power, 1.5);
      state.aim = { id: r.id, ang: r.ang, power: r.power, active: false }; state.preview = null;
      toast(`Hint: ${describePlan(r, state.w, state.m.turn)}`, 4);
    }
  };

  // ---- the play scene ----------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };

  const updatePlay = (dt, input) => {
    const { m } = state;
    const ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const L = layoutOf(state);
    const passUp = !!state.pass && m.phase === 'aim' && !state.paused;
    if (passUp) state.pass.t += dt;
    if (config.dev && keys.pressed.has('KeyK')) { m.scores[0] = m.cfg.goalsTo; m.over = { win: 0, byCap: false }; finishMatch(); return; }
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
    state.ff = (m.phase === 'fly') && ptr.down && !state.paused && !inRect(L.ctrl, ptr.x, ptr.y) ? 2 : 1;

    if (state.humanTurn && !state.paused && m.phase === 'aim' && !state.pass) {
      if (ptr.pressed) {
        if (inRect(L.hint, ptr.x, ptr.y)) { requestHint(); sfx.tick(); }
        else if (!inRect(L.ctrl, ptr.x, ptr.y)) {
          const b = pickSkater(L, ptr.x, ptr.y);
          if (b) { state.drag = { sx: ptr.x, sy: ptr.y, lx: ptr.x, ly: ptr.y, len: 0, valid: false, id: b.id }; state.aim = { id: b.id, ang: state.aim.ang, power: 0, active: false }; state.hint = null; state.hintPreview = null; state.kbOn = false; state.preview = null; sfx.tick(); }
          else { state.aim.active = false; state.preview = null; }
        }
      }
      if (state.drag) {
        const d0 = state.drag;
        const stray = Math.hypot(ptr.x - d0.lx, ptr.y - d0.ly) > STRAY_JUMP;
        if (ptr.down && !stray) { d0.lx = ptr.x; d0.ly = ptr.y; dragAim(d0, ptr, L); }
        if (ptr.released && stray) { state.drag = null; state.aim.active = false; state.preview = null; toast('Second touch ignored: pull again', 1.8); }
        else if (ptr.released) {
          const d = state.drag; state.drag = null; state.aim.active = false;
          if (d.valid) throwSkater(m.turn, { id: d.id, ang: state.aim.ang, power: state.aim.power });
          else { state.preview = null; if (d.len > 8) toast('Pull back further, then let go', 1.8); }
        }
      }
      // keyboard: A/D choose a skater, arrows aim and power, Space shoots, H hint
      const side = m.turn, mine = skatersOf(state.w, side);
      let touched = false;
      if (keys.pressed.has('KeyA') || keys.pressed.has('KeyD') || keys.pressed.has('Tab')) {
        const i = mine.findIndex((b) => b.id === state.aim.id), step = keys.pressed.has('KeyA') ? -1 : 1;
        state.aim.id = mine[(i + step + mine.length * 2) % mine.length].id; touched = true;
      }
      if (keys.down.has('ArrowLeft')) { state.aim.ang -= 0.02; touched = true; }
      if (keys.down.has('ArrowRight')) { state.aim.ang += 0.02; touched = true; }
      if (keys.down.has('ArrowUp')) { state.aim.power = clamp(state.aim.power + 0.015, 0.02, 1); touched = true; }
      if (keys.down.has('ArrowDown')) { state.aim.power = clamp(state.aim.power - 0.015, 0.02, 1); touched = true; }
      if (keys.pressed.has('KeyH')) requestHint();
      if (touched) { if (!state.aim.id) state.aim.id = mine[0].id; state.kbOn = true; state.aim.active = true; state.hint = null; state.hintPreview = null; updatePreview(); }
      if (keys.pressed.has('Space') && state.kbOn && !state.drag && state.aim.id) throwSkater(side, { id: state.aim.id, ang: state.aim.ang, power: state.aim.power });
    } else if (state.drag && !state.humanTurn) { state.drag = null; state.aim.active = false; }
    if (passUp && state.pass.t > 0.35 && ptr.pressed) { state.pass = null; sfx.tick(); }
    if (state.paused) return;
    updateHint();
    updateAI(dt);
    // physics
    const w = state.w;
    if (m.phase === 'fly') {
      for (let i = 0; i < 2 * state.ff; i++) {
        const ev = stepWorld(w, STEP);
        if (ev.length) worldEvents(state.parts, ev, true);
        if (w.goal) { onGoal(); break; }
        state.flyT += STEP;
        if (state.flyT > 14) for (const b of w.bodies) { b.vx = 0; b.vy = 0; }   // safety: nothing may slide forever
        if (w.settled) { state.restT += STEP; if (state.restT > 0.25) { onSettled(); break; } } else state.restT = 0;
      }
      addTrails(w, dt * state.ff);
    } else if (m.phase === 'goal') {
      for (let i = 0; i < 2; i++) { const ev = stepWorld(w, STEP); if (ev.length) worldEvents(state.parts, ev, true); }
      state.goalT += dt;
      if (state.goalT >= GOAL_T) { if (m.over) finishMatch(); else startReset(); }
      else if (ptr.pressed && state.goalT > 1.2) state.goalT = GOAL_T;
    } else if (m.phase === 'reset') stepReset(dt);
    else idleFaces(w, dt);
    for (const b of w.bodies) { if (m.phase !== 'fly' && m.phase !== 'goal' && b.swing > 0) b.swing = Math.max(0, b.swing - dt * 1.7); if (b.hit > 0 && m.phase !== 'fly') b.hit = Math.max(0, b.hit - dt * 2.6); }
    fadeTrails(state.trails, dt);
    stepParts(state.parts, dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
  };

  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; };
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
    else if (id === 'len3') s.goalsTo = LENGTHS[0];
    else if (id === 'len5') s.goalsTo = LENGTHS[1];
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
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
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
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused || !!state.pass || (!!state.m && state.m.phase === 'goal'),
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'setup', 'settings', 'result', 'demolimit'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, flowMax());
        });
      }
      syncSize();
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
