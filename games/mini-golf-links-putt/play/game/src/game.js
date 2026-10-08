// Mini Golf Links Putt: state and flow. Physics lives in sim.js, the courses in courses.js, the computer golfers in ai.js,
// drawing in view.js and menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// A putt: drag back from anywhere (a slingshot: the ball goes the opposite way, farther pull = harder), release to putt.
// Order of play: honors on the tee (lowest score on the last hole first), then whoever is farthest from the cup goes next.
import { compileHole, newBall, launchBall, stepBall, simulate, distField, H as STEP, SINK_T, clamp } from './sim.js';
import { COURSE_BY_ID, courseHoles, holeById, HOLES } from './courses.js';
import { PROFILES, ADVISOR, createPlanner, explainPlan, shaky } from './ai.js';
import { inRect, setSize, TEXT_DEC, TEXT_INC, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { renderPlay, layoutFor, camFor, cardRectFor, scoreName } from './view.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderReason, renderPages, renderDemoLimit,
  hitScreen, flowMeta, READER, refCloseRect, ensureLayout, resetMenus, lockupZone, stepAttract, newAttract,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

// Fluid viewport: the short side is always 720 units; meta.width / meta.height follow the real screen.
export const wheelInput = { dy: 0 };
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_HOLE_CAP = 3;       // holes of real play in the free web demo
const STROKE_CAP = 7;          // a hole is capped at this many strokes
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
const DRAG_DEAD = 16, DRAG_MAX = 190;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const gauss = () => (aiRng.next() + aiRng.next() + aiRng.next() - 1.5) * 2;

  const state = {
    scene: 'title', back: 'title', t: 0, clock: 0, paused: false, pauseMenu: false, reasonOpen: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, guide: 0, confirm: false },
    record: { rounds: 0, wins: [0, 0, 0, 0, 0], aces: 0, holes: 0, demoHoles: 0, best: {} },
    setup: { mode: 'ai', opp: 1, course: 'heather' }, setupMsg: '',
    ui: { scroll: 0, drag: null }, page: 0,
    m: null, balls: [], phase: 'aim', humanTurn: false, holeEnd: null,
    aim: { ang: 0, pow: 0, placed: false }, guide: null, drag: null, ff: false,
    parts: [], pops: [], fx: { bump: {} }, toast: '', toastT: 0, card: null, think: null, hintBusy: false, wlabel: '',
    settleT: 0, camRot: 0, saved: null, loaded: false, restoreMsg: '', att: null, shotMode: null, lay: null, cam: null,
  };
  let planner = null, hintPlanner = null, guideKey = '';

  // ---- persistence -------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('match', null)]).then(([s, r, mt]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    if (!state.saved) state.saved = validSnapshot(mt);
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.settings.guide = clamp(state.settings.guide | 0, 0, 2);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    if (!state.record.best || typeof state.record.best !== 'object') state.record.best = {};
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  function validSnapshot(sn) {
    try {
      if (!sn || sn.v !== 1 || !sn.cfg || !['ai', 'two', 'solo'].includes(sn.cfg.mode)) return null;
      const c = sn.cfg;
      if (!num(c.opp, 0, 4) || !num(c.seed, 0, 4294967295) || !(c.course === 'grand' || COURSE_BY_ID[c.course])) return null;
      if (!Array.isArray(sn.holeIds) || sn.holeIds.length < 1 || sn.holeIds.length > 18 || !sn.holeIds.every((id) => holeById(id))) return null;
      if (!num(sn.idx, 0, sn.holeIds.length - 1) || !Array.isArray(sn.scores) || sn.scores.length < 1 || sn.scores.length > 4) return null;
      if (!sn.scores.every((row) => Array.isArray(row) && row.length === sn.idx && row.every((v) => num(v, 1, 9)))) return null;
      return sn;
    } catch { return null; }
  }
  const snapshot = () => {
    const { m } = state;
    return { v: 1, cfg: { mode: m.cfg.mode, opp: m.cfg.opp, course: m.cfg.course, seed: m.cfg.seed }, holeIds: m.holeIds.slice(), idx: m.idx, scores: m.scores.map((r) => r.slice()), order: m.order.slice() };
  };
  const persistMatch = () => { if (state.m && state.m.cfg.mode !== 'watch' && !state.m.over) { state.saved = snapshot(); storage.set('match', state.saved); } };
  const clearSaved = () => { if (state.saved) { state.saved = null; storage.set('match', null); } };

  // ---- sound -------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    putt: (p) => { tone({ freq: 200 + 120 * p, to: 80, dur: 0.1, type: 'triangle', vol: 0.12 }); tone({ freq: 1400, to: 600, dur: 0.04, type: 'square', vol: 0.03 }); },
    wall: (v) => { const q = Math.min(1, v / 14); tone({ freq: 520 + fx.next() * 120, to: 260, dur: 0.06, type: 'triangle', vol: 0.03 + 0.07 * q }); },
    bump: () => { tone({ freq: 300, to: 760, dur: 0.14, type: 'sine', vol: 0.09 }); tone({ freq: 1200, to: 1800, dur: 0.05, type: 'square', vol: 0.02 }); },
    sand: () => tone({ freq: 2600 + fx.next() * 900, to: 1500, dur: 0.07, type: 'sawtooth', vol: 0.006 }),
    splash: () => { tone({ freq: 700, to: 140, dur: 0.3, type: 'sine', vol: 0.1 }); tone({ freq: 2200, to: 400, dur: 0.18, type: 'sawtooth', vol: 0.02 }); },
    sink: () => { tone({ freq: 380, to: 150, dur: 0.22, type: 'sine', vol: 0.12 }); [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.08 })); },
    tunnel: () => tone({ freq: 160, to: 640, dur: 0.22, type: 'sine', vol: 0.08 }),
    boost: () => tone({ freq: 300, to: 1100, dur: 0.2, type: 'sawtooth', vol: 0.03 }),
    lip: () => tone({ freq: 500, to: 300, dur: 0.15, type: 'triangle', vol: 0.07 }),
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.06 }),
    win: () => [0, 2, 4, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- particles ---------------------------------------------------------------------------------------------
  const MAX_PARTS = 160;
  const add = (q) => { if (state.parts.length < MAX_PARTS) state.parts.push(q); };
  const sparks = (x, y, n, speed, col) => { for (let i = 0; i < n; i++) { const a = fx.next() * Math.PI * 2, s = (0.5 + fx.next() * 1.6) * speed; add({ kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.3 + fx.next() * 0.3, size: 1.5 + fx.next() * 2, col }); } };
  const ring = (x, y, size, col) => add({ kind: 2, x, y, vx: 0, vy: 0, t: 0, max: 0.5, size, col });
  const confetti = (x, y, n) => { const cols = ['#ffd24a', '#ff6a4a', '#5ec8ff', '#7be38a', '#ff8fb5', '#ffffff']; for (let i = 0; i < n; i++) { const a = fx.next() * Math.PI * 2, s = 1.5 + fx.next() * 4.5; add({ kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, t: 0, max: 1.1 + fx.next() * 0.8, size: 1, col: cols[fx.int(cols.length)], spin: 6 + fx.next() * 10 }); } };
  const stepParts = (dt) => {
    for (const q of state.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; if (q.kind === 3) q.vy += 5 * dt; }
    for (let i = state.parts.length - 1; i >= 0; i--) if (state.parts[i].t >= state.parts[i].max) state.parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size = 30) => { state.pops.push({ x, y, text, col, size, t: 0, max: 1.5 }); if (state.pops.length > 8) state.pops.shift(); };

  // ---- the match ------------------------------------------------------------------------------------------------
  const curHole = () => compileHole(state.m.holes[state.m.idx]);
  const curDef = () => state.m.holes[state.m.idx];
  const isAI = (i) => state.m.players[i].ai >= 0;
  const profOf = (i) => PROFILES[state.m.players[i].ai];
  const holesFor = (course) => (course === 'grand' ? HOLES.slice() : courseHoles(course));

  function newMatch(cfg) {
    const seed = cfg.seed ?? aiRng.int(1000000);
    let players;
    if (cfg.mode === 'watch') players = [{ name: PROFILES[cfg.watchA].name, ai: cfg.watchA }, { name: PROFILES[cfg.opp].name, ai: cfg.opp }];
    else if (cfg.mode === 'two') players = [{ name: 'Player 1', ai: -1 }, { name: 'Player 2', ai: -1 }];
    else if (cfg.mode === 'solo') players = [{ name: 'You', ai: -1 }];
    else if (cfg.opp === 4) players = [{ name: 'You', ai: -1 }, { name: PROFILES[1].name, ai: 1 }, { name: PROFILES[2].name, ai: 2 }, { name: PROFILES[3].name, ai: 3 }];
    else players = [{ name: 'You', ai: -1 }, { name: PROFILES[cfg.opp].name, ai: cfg.opp }];
    const defs = cfg.mode === 'watch' ? cfg.watchHoles.map(holeById) : holesFor(cfg.course);
    const m = {
      cfg: { mode: 'ai', opp: 1, course: 'heather', watchA: 3, ...cfg, seed }, players, holeIds: defs.map((d) => d.id), idx: 0, cur: 0,
      scores: players.map(() => []), totals: players.map(() => 0), parSoFar: 0, over: null, order: players.map((_, i) => i),
    };
    delete m.cfg.watchHoles;
    Object.defineProperty(m, 'holes', { value: defs, enumerable: false, writable: true });
    return m;
  }

  function beginHole(resumed = false) {
    const m = state.m, def = curDef(), h = curHole();
    state.balls = m.players.map(() => ({ ball: newBall(h.tee.x, h.tee.y), strokes: 0, done: false, pickup: false, prev: { x: h.tee.x, y: h.tee.y }, trail: [], sunkShown: 0 }));
    state.phase = 'aim'; state.holeEnd = null; state.card = null; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false;
    state.aim = { ang: 0, pow: 0, placed: false }; state.guide = null; state.drag = null; guideKey = ''; state.ff = false;
    state.parts = []; state.pops = []; state.fx = { bump: {} }; state.settleT = 0;
    nextPlayerForHole();
    toast(def.tip, 4.2);
    if (!resumed && m.cfg.mode !== 'watch') persistMatch();
  }

  // who putts next: on the tee, the honors order; afterwards, whoever is farthest from the cup
  function nextPlayerForHole() {
    const m = state.m, h = curHole(), fld = distField(h);
    const live = m.players.map((_, i) => i).filter((i) => !state.balls[i].done);
    if (!live.length) return -1;
    let pick;
    if (live.every((i) => state.balls[i].strokes === 0)) pick = m.order.find((i) => live.includes(i));
    else {
      let far = -1;
      for (const i of live) { const d = fld.at(state.balls[i].ball.x, state.balls[i].ball.y); if (d > far + 1e-6) { far = d; pick = i; } }
    }
    m.cur = pick;
    startTurn();
    return pick;
  }
  function startTurn() {
    const m = state.m, b = state.balls[m.cur];
    state.phase = 'aim'; state.drag = null; state.guide = null; guideKey = ''; state.card = null; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false;
    state.aim = { ang: 0, pow: 0, placed: false };
    state.humanTurn = !isAI(m.cur) && m.cfg.mode !== 'watch';
    b.trail = [];
    if (!state.humanTurn) state.wlabel = m.cfg.mode === 'watch' ? `${m.players[m.cur].name} is thinking…` : '';
    if (m.players.length > 1) toast(`${m.players[m.cur].name}${state.humanTurn ? ': your putt' : ' is up'}`, 1.8);
  }

  function startMatch(cfg) {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoHoles >= DEMO_HOLE_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.m = newMatch(cfg);
    if (state.demo && cfg.mode !== 'watch') { state.m.holeIds = state.m.holeIds.slice(0, DEMO_HOLE_CAP); state.m.holes = state.m.holes.slice(0, DEMO_HOLE_CAP); }
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.ui.scroll = 0; state.clock = 0;
    beginHole();
  }
  function resumeMatch() {
    const sn = state.saved; if (!sn) return;
    if (state.demo && state.record.demoHoles >= DEMO_HOLE_CAP) { clearSaved(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const m = newMatch({ ...sn.cfg, seed: sn.cfg.seed });
    m.holeIds = sn.holeIds.slice(); m.holes = sn.holeIds.map(holeById); m.idx = sn.idx;
    m.scores = sn.scores.map((r) => r.slice()); m.totals = m.scores.map((r) => r.reduce((a, b) => a + b, 0));
    m.parSoFar = m.holes.slice(0, m.idx).reduce((a, d) => a + d.par, 0); m.order = Array.isArray(sn.order) && sn.order.length === m.players.length ? sn.order.slice() : m.order;
    state.m = m; state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.ui.scroll = 0; state.clock = 0;
    beginHole(true);
    toast('Round restored. Press Resume to carry on', 3.2);
    openPause();    // always resumes paused
  }
  function startWatch() {
    const picks = [2, 3, 1];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    const pool = HOLES.map((d) => d.id), ids = [];
    while (ids.length < 3) ids.push(pool.splice(aiRng.int(pool.length), 1)[0]);
    startMatch({ mode: 'watch', watchA: a, opp: b, watchHoles: ids, course: 'heather' });
  }

  // ---- aiming ------------------------------------------------------------------------------------------------------
  function updateGuide(force = false) {
    const m = state.m, b = state.balls[m.cur], a = state.aim;
    const key = `${m.idx}|${m.cur}|${b.ball.x.toFixed(2)}|${b.ball.y.toFixed(2)}|${a.ang.toFixed(4)}|${a.pow.toFixed(3)}|${a.placed}|${state.settings.guide}`;
    if (!force && key === guideKey) return;
    guideKey = key;
    state.guide = null;
    if (!a.placed || state.settings.guide === 2) return;
    const r = simulate(curHole(), b.ball, a.ang, a.pow, state.clock, { path: true, noMovers: true, until: state.settings.guide === 1 ? 'wall' : null, maxT: 10 });
    state.guide = { pts: r.path, end: { x: r.x, y: r.y }, hitWall: r.bounces + r.bump > 0 };
  }
  const setAimFromDrag = (px, py) => {
    const d = state.drag, cam = state.cam;
    const dx = px - d.sx, dy = py - d.sy, len = Math.hypot(dx, dy);
    if (len < DRAG_DEAD) { state.aim.placed = false; d.live = false; return; }
    const [mx, my] = cam.dirFromScreen(-dx, -dy);
    state.aim.ang = Math.atan2(my, mx);
    state.aim.pow = clamp((len - DRAG_DEAD) / (DRAG_MAX - DRAG_DEAD), 0, 1);
    state.aim.placed = true; d.live = true;
    const b = state.balls[state.m.cur], [bx, by] = cam.m2s(b.ball.x, b.ball.y);
    d.px = bx + dx; d.py = by + dy;
  };

  // ---- putting ---------------------------------------------------------------------------------------------------------
  function putt(i, ang, pow) {
    const b = state.balls[i], p = clamp(pow, 0.03, 1);
    b.prev = { x: b.ball.x, y: b.ball.y };
    b.strokes++;
    launchBall(b.ball, ang, p);
    b.trail = [];
    state.phase = 'roll'; state.ff = false; state.humanTurn = false; state.drag = null; state.guide = null; guideKey = ''; state.card = null; state.think = null; state.settleT = 0; state.hintBusy = false; hintPlanner = null;
    sfx.putt(p);
    sparks(b.ball.x - Math.cos(ang) * 0.2, b.ball.y - Math.sin(ang) * 0.2, 5, 1.5, '#ffffff');
  }
  const humanPutt = () => {
    if (!state.humanTurn || state.phase !== 'aim' || state.paused) return;
    if (!state.aim.placed || state.aim.pow < 0.03) { toast('Pull back on the screen to aim, then let go', 2.2); sfx.no(); return; }
    putt(state.m.cur, state.aim.ang, state.aim.pow);
  };

  const bumperIndex = (h, e) => { let k = 0; for (const c of h.circles) { if (c.kind !== 'bumper') continue; if (Math.abs(c.x - e.x) < 0.01 && Math.abs(c.y - e.y) < 0.01) return k; k++; } return -1; };
  function worldEvents(h, b, ev) {
    for (const e of ev) {
      if (e.k === 'wall') { sparks(e.x, e.y, Math.min(7, 2 + Math.floor(e.v / 3)), 1.5, e.mat === 'hedge' ? '#8fe08f' : '#ffe3b0'); sfx.wall(e.v); }
      else if (e.k === 'bumper') { const i = bumperIndex(h, e); if (i >= 0) state.fx.bump[i] = 0; ring(e.x, e.y, e.r + 0.8, '#ffb0a0'); sparks(e.x, e.y, 6, 2, '#ff9a8a'); sfx.bump(); }
      else if (e.k === 'sand') { add({ kind: 4, x: e.x, y: e.y, vx: (fx.next() - 0.5) * 0.8, vy: (fx.next() - 0.5) * 0.8, t: 0, max: 0.55, size: 0.5, col: '#e8d5a0' }); sfx.sand(); }
      else if (e.k === 'splash') { for (let i = 0; i < 12; i++) { const a = fx.next() * Math.PI * 2, s = 1 + fx.next() * 2.4; add({ kind: 0, x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.6, size: 2.2, col: '#bfe6ff' }); } ring(e.x, e.y, 1.6, '#e6f6ff'); ring(e.x, e.y, 0.9, '#bfe6ff'); sfx.splash(); }
      else if (e.k === 'tunnel') { ring(e.x, e.y, 1.5, '#7be3d0'); ring(e.x2, e.y2, 1.5, '#ffd08a'); sfx.tunnel(); b.trail = []; }
      else if (e.k === 'boost') { sfx.boost(); }
      else if (e.k === 'lip') { pop(e.x, e.y - 0.8, 'Lip out!', '#ffd0a0', 28); sfx.lip(); }
      else if (e.k === 'sink') { sfx.sink(); ring(h.cup.x, h.cup.y, 2, '#ffe9a0'); sparks(h.cup.x, h.cup.y, 14, 2.5, '#ffe9a0'); }
    }
  }

  function updateRoll() {
    const m = state.m, h = curHole(), b = state.balls[m.cur];
    const n = 2 * (state.ff ? 3 : 1);
    const ev = [];
    for (let k = 0; k < n; k++) {
      ev.length = 0;
      stepBall(h, b.ball, state.clock, ev);
      state.clock += STEP;
      if (ev.length) worldEvents(h, b, ev);
      if ((k & 1) === 0 && b.ball.mode === 'roll') { b.trail.push([b.ball.x, b.ball.y]); if (b.trail.length > 18) b.trail.shift(); }
      if (b.ball.mode !== 'roll') break;
    }
    if (b.ball.mode !== 'roll') { state.phase = 'settle'; state.settleT = 0; }
  }
  function stepBalls(dt) {
    for (const b of state.balls) {
      if (b.ball.mode === 'sunk') { b.ball.sink = Math.min(1, b.ball.sink + dt); if (b.ball.sink >= SINK_T) b.sunkShown = Math.min(1, b.sunkShown + dt * 4); }
      if (b.trail.length && b.ball.mode !== 'roll') b.trail.shift();
    }
    for (const k of Object.keys(state.fx.bump)) state.fx.bump[k] += dt;
  }

  function updateSettle(dt) {
    const m = state.m, h = curHole(), b = state.balls[m.cur];
    state.settleT += dt * (state.ff ? 2 : 1);
    const wait = b.ball.mode === 'sunk' ? 0.85 : b.ball.mode === 'water' ? 0.9 : 0.35;
    if (state.settleT < wait) return;
    const bl = b.ball, who = m.players[m.cur].name;
    if (bl.mode === 'sunk') {
      b.done = true;
      const par = curDef().par, name = scoreName(b.strokes, par);
      pop(h.cup.x, h.cup.y - 1.4, name, b.strokes === 1 ? '#ffd24a' : '#ffffff', b.strokes === 1 ? 44 : 34);
      if (b.strokes === 1) confetti(h.cup.x, h.cup.y, 46); else if (b.strokes < par) confetti(h.cup.x, h.cup.y, 18);
    } else if (bl.mode === 'water') {
      b.strokes += 1;
      toast(`${who === 'You' ? 'Splash' : `${who}: splash`}! One penalty stroke, back to the last spot`, 3);
      bl.x = b.prev.x; bl.y = b.prev.y; bl.vx = 0; bl.vy = 0; bl.mode = 'rest'; b.trail = [];
      ring(bl.x, bl.y, 1.2, '#ffffff');
    }
    if (!b.done && b.strokes >= STROKE_CAP) { b.done = true; b.pickup = true; toast(`${who === 'You' ? 'You pick' : `${who} picks`} up: ${STROKE_CAP} strokes is the most on a hole`, 3); }
    if (m.cfg.mode === 'watch') state.wlabel = '';
    if (state.balls.every((q) => q.done)) endHole(); else nextPlayerForHole();
  }

  function endHole() {
    const m = state.m, def = curDef();
    const res = state.balls.map((b) => ({ strokes: Math.min(b.strokes, STROKE_CAP), name: b.pickup ? 'Picked up' : scoreName(b.strokes, def.par) }));
    res.forEach((r, i) => { m.scores[i].push(r.strokes); m.totals[i] += r.strokes; });
    m.parSoFar += def.par;
    const best = Math.min(...res.map((r) => r.strokes)), leaders = res.map((r, i) => (r.strokes === best ? i : -1)).filter((i) => i >= 0);
    const lead = leaders.length === 1 ? leaders[0] : -1;
    const solo = m.players.length === 1;
    let title;
    if (solo) title = res[0].name;
    else if (lead >= 0) title = `${m.players[lead].name} ${m.players[lead].name === 'You' ? 'win' : 'wins'} the hole`;
    else title = 'The hole is halved';
    state.holeEnd = { t: 0, title, results: res, lead };
    state.phase = 'holeend'; state.humanTurn = false;
    // next hole's honors: lowest score first, ties keep the old order
    m.order = m.order.slice().sort((a, b) => res[a].strokes - res[b].strokes || m.order.indexOf(a) - m.order.indexOf(b));
    if (m.cfg.mode !== 'watch') {
      state.record.holes++;
      state.record.demoHoles = (state.record.demoHoles | 0) + 1;
      m.players.forEach((p, i) => { if (p.ai < 0 && res[i].strokes === 1 && def.par > 1 && !state.balls[i].pickup) state.record.aces++; });
      save();
    }
    if (lead >= 0 && m.players[lead].ai < 0) sfx.win();
  }

  function finishMatch() {
    const m = state.m;
    const totals = m.totals.slice();
    const best = Math.min(...totals), winners = totals.map((t, i) => (t === best ? i : -1)).filter((i) => i >= 0);
    m.over = { totals, winners, par: m.parSoFar };
    state.scene = 'result'; state.ui.scroll = 0; state.phase = 'aim';
    if (m.cfg.mode !== 'watch') {
      const humans = m.players.map((p, i) => (p.ai < 0 ? i : -1)).filter((i) => i >= 0);
      state.record.rounds++;
      if (m.cfg.mode === 'ai' && winners.length === 1 && winners[0] === 0) { state.record.wins[Math.min(4, m.cfg.opp)]++; sfx.win(); }
      const key = m.cfg.course, mine = Math.min(...humans.map((i) => totals[i]));
      if (m.holes.length === holesFor(m.cfg.course).length && (state.record.best[key] == null || mine < state.record.best[key])) { state.record.best[key] = mine; m.over.newBest = true; }
      clearSaved(); save();
    }
  }
  function nextHole() {
    const m = state.m;
    if (state.demo && m.cfg.mode !== 'watch' && state.record.demoHoles >= DEMO_HOLE_CAP) { clearSaved(); save(); state.scene = 'demolimit'; state.ui.scroll = 0; state.holeEnd = null; return; }
    if (m.idx >= m.holes.length - 1) { state.holeEnd = null; finishMatch(); return; }
    m.idx++; beginHole();
  }

  // ---- computer players ----------------------------------------------------------------------------------------------
  function updateAI(dt) {
    const m = state.m;
    if (state.phase !== 'aim' || state.humanTurn || state.paused || state.holeEnd) return;
    const i = m.cur, prof = profOf(i), watch = m.cfg.mode === 'watch', h = curHole(), b = state.balls[i];
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      const reveal = watch ? 2 : 0.8;
      state.think = { t: 0, dur, reveal, phase: 'think', plan: null };
      planner = createPlanner(h, b.ball, state.clock + dur + reveal, prof, aiRng, {});
      if (watch) { state.wlabel = `${m.players[i].name} is thinking…`; toast(`${m.players[i].name} is thinking…`, Math.min(dur, 3)); }
    }
    const th = state.think;
    th.t += dt * (state.ff ? 3 : 1);
    if (planner && !planner.done) { planner.step(state.ff ? 90 : 36); if (planner.done) { th.plan = planner.result; planner = null; } }
    if (th.phase === 'think' && th.t >= th.dur && th.plan) {
      th.phase = 'reveal'; th.t = 0; th.dur = th.reveal;
      const p = th.plan;
      state.aim = { ang: p.ang, pow: p.pow, placed: true };
      state.guide = { pts: p.path, end: { x: p.end.x, y: p.end.y }, hitWall: p.info.bounces + p.info.bump > 0 };
      if (watch) {
        const ex = explainPlan(h, b.ball, p);
        state.card = { title: `${m.players[i].name}: ${ex.title}`, text: `${ex.reason}${p.alts && p.alts.length ? ' It also weighed a safer line.' : ''}`, sticky: true };
        state.wlabel = `${m.players[i].name} will play: ${ex.title}`;
      }
    } else if (th.phase === 'reveal' && th.t >= th.dur && state.clock + 1e-6 >= th.plan.tLaunch) {
      state.card = null;
      const sh = shaky(th.plan, prof, gauss(), gauss());
      putt(i, sh.ang, sh.pow);
      if (watch) state.wlabel = `${m.players[i].name} putts`;
    }
  }

  // ---- Think (the hint for the player) --------------------------------------------------------------------------------
  function requestHint() {
    if (state.hintBusy || state.phase !== 'aim' || !state.humanTurn || state.paused) return;
    state.hintBusy = true;
    hintPlanner = createPlanner(curHole(), state.balls[state.m.cur].ball, state.clock + 1.5, ADVISOR, aiRng, {});
  }
  function updateHint() {
    if (!hintPlanner) return;
    hintPlanner.step(70);
    if (hintPlanner.done) {
      const p = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.phase !== 'aim' || !state.humanTurn) return;
      const h = curHole(), b = state.balls[state.m.cur];
      state.aim = { ang: p.ang, pow: p.pow, placed: true };
      state.guide = { pts: p.path, end: { x: p.end.x, y: p.end.y }, hitWall: p.info.bounces + p.info.bump > 0 };
      guideKey = `hint|${state.aim.ang}|${state.aim.pow}`;
      const ex = explainPlan(h, b.ball, p);
      const timing = h.hasMovers ? ' Watch the moving parts and putt when the way is clear.' : '';
      state.card = { title: `Think: ${ex.title}`, text: `${ex.reason}${timing} The aim is set: press Putt, or pull back to change it.`, sticky: true };
    }
  }

  // ---- the play scene ----------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.reasonOpen = false; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => {
    state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.ui.scroll = 0;
    state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; state.card = null; state.holeEnd = null;
  };
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  }
  function modalInput(ptr, key, handler) {
    ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10 && flowMeta().key === key) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
    }
  }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    const st = state.settings;
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); save(); }
    else if (id === 'p-guide') { st.guide = (st.guide + 1) % 3; save(); guideKey = ''; updateGuide(true); }
    else if (id === 'p-txtdec') { st.textIdx = Math.max(0, st.textIdx - 1); save(); }
    else if (id === 'p-txtinc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); save(); }
    else if (id === 'quit') leaveMatch();
  }

  function updatePlay(dt, input) {
    const m = state.m, ptr = input.pointer, keys = input.keys;
    const watch = m.cfg.mode === 'watch';
    const lay = layoutFor(state);
    state.lay = lay;
    const cam = camFor(state, lay);
    state.camRot = cam.rot; state.cam = cam;
    if (config.dev && keys.pressed.has('KeyK') && !state.holeEnd) { state.balls.forEach((b) => { if (!b.done) { b.done = true; b.strokes = Math.max(1, b.strokes); } }); endHole(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) {
      if (state.pauseMenu) closePause(); else if (state.reasonOpen) state.reasonOpen = false; else if (!watch && state.phase !== 'roll') openPause(); else state.paused = !state.paused;
    }
    if (state.pauseMenu) { modalInput(ptr, 'pause', handlePauseTap); return; }
    if (state.reasonOpen) { modalInput(ptr, 'reason', (id) => { if (id === 'reason-close') state.reasonOpen = false; }); return; }

    const c = lay.ctrl, kind = state.phase;
    if (ptr.pressed) {
      const hit = (id) => c[id] && inRect(c[id], ptr.x, ptr.y);
      if (hit('menu')) { openPause(); sfx.tick(); return; }
      if (hit('pause')) { state.paused = !state.paused; sfx.tick(); }
      else if (hit('fast')) { state.ff = !state.ff; sfx.tick(); }
      else if (hit('next') && state.holeEnd && state.holeEnd.t > 0.5) { sfx.tick(); nextHole(); return; }
      else if (hit('dec')) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
      else if (hit('inc')) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
      else if (hit('exit')) { leaveMatch(); return; }
      else if (hit('think')) { requestHint(); sfx.tick(); }
      else if (hit('putt')) { humanPutt(); return; }
      else if (state.card && inRect(cardRectFor(state, lay), ptr.x, ptr.y)) { state.reasonOpen = true; state.ui.scroll = 0; return; }
      else if (state.humanTurn && !state.paused && kind === 'aim' && !state.holeEnd && inRect(lay.sheet, ptr.x, ptr.y)) {
        state.drag = { on: true, sx: ptr.x, sy: ptr.y, px: ptr.x, py: ptr.y, live: false };
      }
    }
    if (state.drag && state.humanTurn && !state.paused && kind === 'aim') {
      if (ptr.down) { setAimFromDrag(ptr.x, ptr.y); updateGuide(); if (state.card && state.card.sticky && state.drag.live) state.card = null; }
      if (ptr.released || !ptr.down) {
        const live = state.drag.live;
        state.drag = null;
        if (live && !state.settings.confirm && state.aim.placed && state.aim.pow >= 0.04) humanPutt();
        else updateGuide(true);
      }
    } else if (state.drag) state.drag = null;
    // keyboard
    if (state.humanTurn && !state.paused && kind === 'aim' && !state.holeEnd) {
      const a = state.aim, h = curHole(), b = state.balls[m.cur];
      let touched = false;
      const first = () => { if (!a.placed) { a.ang = Math.atan2(h.cup.y - b.ball.y, h.cup.x - b.ball.x); a.pow = 0.4; a.placed = true; } };
      const spin = keys.down.has('ShiftLeft') || keys.down.has('ShiftRight') ? 0.003 : 0.014;
      if (keys.down.has('ArrowLeft')) { first(); a.ang -= spin; touched = true; }
      if (keys.down.has('ArrowRight')) { first(); a.ang += spin; touched = true; }
      if (keys.down.has('ArrowUp')) { first(); a.pow = clamp(a.pow + 0.008, 0.02, 1); touched = true; }
      if (keys.down.has('ArrowDown')) { first(); a.pow = clamp(a.pow - 0.008, 0.02, 1); touched = true; }
      if (touched) { if (state.card && state.card.sticky) state.card = null; updateGuide(); }
      if (keys.pressed.has('KeyH')) requestHint();
      if (keys.pressed.has('Space') || keys.pressed.has('Enter')) humanPutt();
    }
    if (state.holeEnd) {
      if (!state.paused) state.holeEnd.t += dt;
      if (!watch && (keys.pressed.has('Enter') || keys.pressed.has('Space')) && state.holeEnd.t > 0.6) { nextHole(); return; }
      if (watch && state.holeEnd.t > 4.8 && !state.paused) { nextHole(); return; }
    }
    if (state.paused) return;
    if (state.phase !== 'roll') state.clock += dt;
    stepParts(dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    stepBalls(dt);
    updateHint();
    if (state.phase === 'aim') updateAI(dt);
    else if (state.phase === 'roll') updateRoll();
    else if (state.phase === 'settle') updateSettle(dt);
  }

  // ---- menus -------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'resume') resumeMatch();
    else if (id === 'play') { state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('mode-')) { s.mode = id.slice(5); state.setupMsg = ''; }
    else if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('crs-')) { const c = id.slice(4); if (state.demo && c !== 'heather') { state.setupMsg = 'That course is in the full game.'; return; } s.course = c; state.setupMsg = ''; }
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, course: s.course });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-guide') { st.guide = (st.guide + 1) % 3; guideKey = ''; }
    else if (id === 'set-confirm') st.confirm = !st.confirm;
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
    if (id === 'again') { if (cfg.mode === 'watch') startWatch(); else startMatch({ ...cfg, seed: undefined }); }
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'ai' : cfg.mode; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta(), scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (wheelInput.dy) { state.ui.scroll = clamp(state.ui.scroll + wheelInput.dy, 0, max); wheelInput.dy = 0; }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
    void dt;
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; state.ui.scroll = 0; state.ui.drag = null; };
    const setScroll = (v) => { state.ui.scroll = clamp(v, 0, READER.max); };
    if (ptr.pressed) {
      if (inRect(refCloseRect(), ptr.x, ptr.y)) { close(); return; }
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
      else if (ptr.y >= READER.y0 && ptr.y <= READER.y1) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll };
    }
    if (state.ui.drag && ptr.down) setScroll(state.ui.drag.s0 - (ptr.y - state.ui.drag.y0));
    if (ptr.released) state.ui.drag = null;
    if (wheelInput.dy) { setScroll(state.ui.scroll + wheelInput.dy); wheelInput.dy = 0; }
    const step = 70, pgs = Math.max(100, READER.view - 80);
    if (keys.pressed.has('ArrowDown')) setScroll(state.ui.scroll + step);
    if (keys.pressed.has('ArrowUp')) setScroll(state.ui.scroll - step);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) setScroll(state.ui.scroll + pgs);
    if (keys.pressed.has('PageUp')) setScroll(state.ui.scroll - pgs);
    if (keys.pressed.has('Home')) setScroll(0);
    if (keys.pressed.has('End')) setScroll(READER.max);
    if (keys.pressed.has('Escape') || keys.pressed.has('Enter')) close();
  };

  // ---- showcase (store screenshots: ?shot=1 plays a scripted, real position instead of the random player) ----------------------
  const SHOWCASE = [
    { hole: 'dunes-5', ang: -1.36, pow: 0.55 }, { hole: 'harbour-4', ang: -1.9, pow: 0.7 }, { hole: 'mill-1', ang: -1.57, pow: 0.5 },
    { hole: 'harbour-5', ang: 2.35, pow: 0.45 }, { hole: 'dunes-6', ang: -0.5, pow: 0.45 }, { hole: 'mill-6', ang: -1.2, pow: 0.7 },
  ];
  function setupShowcase(kind) {
    const q0 = (k) => { try { const mm = new RegExp(`[?&]${k}=([a-z0-9-]+)`).exec(globalThis.location.search); return mm ? mm[1] : null; } catch { return null; } };
    const sc = SHOWCASE[kind % SHOWCASE.length];
    if (q0('hole') && holeById(q0('hole'))) sc.hole = q0('hole');
    const course = holeById(sc.hole).course;
    state.shotMode = { kind, tick: 0, sc };
    state.m = newMatch({ mode: 'ai', opp: 2, course, seed: 4242 + kind });
    state.m.idx = state.m.holes.findIndex((d) => d.id === sc.hole);
    state.scene = 'play'; state.clock = 0;
    beginHole(true);
    state.toastT = 0;
  }
  function showcaseStep() {
    const sm = state.shotMode; sm.tick++;
    if (sm.tick === 2) {
      state.aim = { ang: sm.sc.ang, pow: sm.sc.pow, placed: true };
      state.humanTurn = true; guideKey = ''; updateGuide(true);
    }
  }

  for (const key of ['lay', 'cam']) Object.defineProperty(state, key, { value: null, writable: true, enumerable: false });
  state.att = newAttract();
  resetMenus();
  function finishDemoResult() {
    const m = state.m;
    m.holes.forEach((d, i) => { m.scores.forEach((row, p) => { row.push(Math.max(1, d.par + ((i + p) % 3) - 1)); }); });
    m.totals = m.scores.map((r) => r.reduce((a, b) => a + b, 0));
    m.parSoFar = m.holes.reduce((a, d) => a + d.par, 0);
    finishMatch();
  }
  if (SHOT_MODE) {
    setupShowcase((Number(config.seed) | 0) % SHOWCASE.length);
    const q = (k) => { try { const mm = new RegExp(`[?&]${k}=([a-z0-9]+)`).exec(globalThis.location.search); return mm ? mm[1] : null; } catch { return null; } };
    if (q('zoom')) state.settings.textIdx = clamp(Number(q('zoom')) | 0, 0, 4);
    const v = q('view');
    if (v) {
      state.shotMode = v === 'pause' ? state.shotMode : null;
      if (v === 'pause') openPause();
      else if (v === 'result') finishDemoResult();
      else if (v === 'rules' || v === 'about' || v === 'howto') { state.scene = v; state.back = 'title'; state.page = 0; state.ui.scroll = (Number(q('page')) | 0) * 900; }
      else if (v === 'watch') { startWatch(); state.shotMode = null; }
      else if (v === 'holeend') { state.shotMode = null; for (const b of state.balls) { b.done = true; b.strokes = 2; } endHole(); }
      else state.scene = v;
    }
    const adv = Number(q('ticks')) | 0;
    if (adv > 0 && state.scene === 'play') {
      const blank = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
      for (let i = 0; i < adv; i++) { state.t += 1 / 60; if (state.shotMode) showcaseStep(); updatePlay(1 / 60, blank); }
    }
  }

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused round does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.m && state.m.cfg.mode !== 'watch') || state.paused,
    update(dt, input) {
      if (SHOT_MODE) input = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };   // store screenshots ignore the seeded random player
      setSize(meta.width, meta.height);
      config.textScale = TEXT_SCALES[state.settings.textIdx];
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.att && state.scene !== 'play') stepAttract(state.att, dt);
      if (state.shotMode) {
        const blank = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
        showcaseStep();
        if (state.scene === 'play') updatePlay(dt, blank);
        return;
      }
      switch (state.scene) {
        case 'title': if (input.keys.pressed.has('Enter')) { handleTitle('play'); break; } updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
      wheelInput.dy = 0;
    },
    render(ctx, view) {
      setSize(view?.width ?? meta.width, view?.height ?? meta.height);
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
          else if (state.reasonOpen) renderReason(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
  };
}
