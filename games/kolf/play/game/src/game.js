// Kolf: state and flow. Physics lives in sim.js, the courts in courts.js, the computer players in ai.js, drawing in view.js, hud.js
// and menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// A stroke: drag on the court to turn the aim (the view turns with it), tap Swing, then tap Strike! when the bar shows the power
// you want. Strokes are alternate; whoever reaches the post in fewer strokes wins the leg; most legs wins the match.
import { compileCourt, newBall, launchBall, stepBall, simulate, STEP, clamp, onSnow, BR } from './sim.js';
import { COURT_BY_ID, legsForVenue, legById, ALL_LEGS } from './courts.js';
import { PROFILES, ADVISOR, createPlanner, explainPlan, shaky } from './ai.js';
import { inRect, setSize, TEXT_DEC, TEXT_INC, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { drawScene, drawFrame, drawMini, BALL_COLORS, normAng } from './view.js';
import { badgeSlot, layoutFor, controlKind, drawHud, drawMeter, drawCard, drawToast, drawPops, drawLegEnd, drawControls, cardRectFor, scoreName } from './hud.js';
import {
  renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderReason, renderPages, renderDemoLimit,
  hitScreen, flowMeta, READER, refCloseRect, ensureLayout, resetMenus, lockupZone, stepAttract, newAttract,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

// Fluid viewport: the short side is always 720 units; meta.width / meta.height follow the real screen.
export const wheelInput = { dy: 0 };
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_LEG_CAP = 3;        // legs of real play in the free web demo
const STROKE_CAP = 8;          // a player picks up after this many strokes in a leg
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
const AIM_SENS = 0.0016;       // radians of aim per virtual unit dragged
const SWING_UP = 1.15;         // seconds for the bar to fill
const STRIKE_DELAY = 0.14;     // seconds from the tap to the club meeting the ball
const SCATTER = 0.035;         // radians of possible stray at 100 % power (none up to 90 %)

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const gauss = () => (aiRng.next() + aiRng.next() + aiRng.next() - 1.5) * 2;

  const state = {
    scene: 'title', back: 'title', t: 0, clock: 0, paused: false, pauseMenu: false, reasonOpen: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, guide: 1 },
    record: { matches: 0, wins: [0, 0, 0, 0], inOne: 0, legs: 0, demoLegs: 0, best: {} },
    setup: { mode: 'ai', opp: 1, venue: 'canal' }, setupMsg: '',
    ui: { scroll: 0, drag: null }, page: 0,
    m: null, court: null, balls: [], phase: 'aim', humanTurn: false, holeEnd: null,
    aim: { ang: 0, pow: 0.7, placed: true }, sw: { p: 0, dir: 1, auto: null, t: 0, locked: 0, fired: false }, guide: null, drag: null, hold: null, ff: false,
    evq: [], hintPow: null, reachPow: null, distToPost: null, figAt: null, camv: { x: 0, y: 0, yaw: 0, dist: 60 }, fig: { ang: 0.25 },
    parts: [], pops: [], toast: '', toastT: 0, card: null, think: null, hintBusy: false, wlabel: '',
    settleT: 0, saved: null, loaded: false, restoreMsg: '', att: null, shotMode: null, lay: null, strikeT: 9, lastPow: 0.7,
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
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 4) state.record.wins = [0, 0, 0, 0];
    if (!state.record.best || typeof state.record.best !== 'object') state.record.best = {};
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  function validSnapshot(sn) {
    try {
      if (!sn || sn.v !== 1 || !sn.cfg || !['ai', 'two', 'solo'].includes(sn.cfg.mode)) return null;
      const c = sn.cfg;
      if (!num(c.opp, 0, 3) || !num(c.seed, 0, 4294967295) || !(c.venue === 'cup' || ['canal', 'mill', 'harbour'].includes(c.venue))) return null;
      if (!Array.isArray(sn.legIds) || sn.legIds.length < 1 || sn.legIds.length > 12 || !sn.legIds.every((id) => legById(id))) return null;
      if (!num(sn.idx, 0, sn.legIds.length - 1) || !Array.isArray(sn.scores) || sn.scores.length < 1 || sn.scores.length > 2) return null;
      if (!sn.scores.every((row) => Array.isArray(row) && row.length === sn.idx && row.every((v) => num(v, 1, 9)))) return null;
      if (!Array.isArray(sn.wins) || sn.wins.length !== sn.scores.length || !sn.wins.every((v) => num(v, 0, 12))) return null;
      return sn;
    } catch { return null; }
  }
  const snapshot = () => {
    const { m } = state;
    return { v: 1, cfg: { mode: m.cfg.mode, opp: m.cfg.opp, venue: m.cfg.venue, seed: m.cfg.seed }, legIds: m.legs.map((l) => l.id), idx: m.idx, scores: m.scores.map((r) => r.slice()), wins: m.wins.slice(), order: m.order.slice() };
  };
  const persistMatch = () => { if (state.m && state.m.cfg.mode !== 'watch' && !state.m.over) { state.saved = snapshot(); storage.set('match', state.saved); } };
  const clearSaved = () => { if (state.saved) { state.saved = null; storage.set('match', null); } };

  // ---- sound -------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    swing: (p) => tone({ freq: 140 + 260 * p, to: 80 + 120 * p, dur: 0.16, type: 'sawtooth', vol: 0.025 }),
    strike: (p) => { tone({ freq: 220 + 140 * p, to: 70, dur: 0.12, type: 'triangle', vol: 0.14 }); tone({ freq: 1500, to: 700, dur: 0.04, type: 'square', vol: 0.03 }); },
    wall: (v) => { const q = Math.min(1, v / 16); tone({ freq: 380 + fx.next() * 90, to: 190, dur: 0.07, type: 'triangle', vol: 0.03 + 0.08 * q }); },
    thud: (v) => { const q = Math.min(1, v / 16); tone({ freq: 160, to: 90, dur: 0.1, type: 'triangle', vol: 0.04 + 0.1 * q }); },
    sledge: () => { tone({ freq: 260, to: 150, dur: 0.12, type: 'triangle', vol: 0.1 }); tone({ freq: 900, to: 500, dur: 0.05, type: 'square', vol: 0.025 }); },
    snow: () => tone({ freq: 2400 + fx.next() * 700, to: 1300, dur: 0.06, type: 'sawtooth', vol: 0.005 }),
    crack: () => { tone({ freq: 900, to: 120, dur: 0.35, type: 'sawtooth', vol: 0.05 }); tone({ freq: 200, to: 60, dur: 0.4, type: 'sine', vol: 0.1 }); },
    post: () => { tone({ freq: 330, to: 300, dur: 0.18, type: 'triangle', vol: 0.14 }); [0, 4, 7, 12].forEach((n, i) => tone({ freq: 587 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.07 })); },
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    win: () => [0, 2, 4, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- particles ---------------------------------------------------------------------------------------------
  const MAX_PARTS = 140;
  const add = (q) => { if (state.parts.length < MAX_PARTS) state.parts.push(q); };
  const sparks = (x, y, n, speed, col, z = 0.3) => { for (let i = 0; i < n; i++) { const a = fx.next() * Math.PI * 2, s = (0.5 + fx.next() * 1.6) * speed; add({ kind: 0, x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.3 + fx.next() * 0.3, size: 1.6 + fx.next() * 1.6, col }); } };
  const ring = (x, y, size, col) => add({ kind: 2, x, y, z: 0.05, vx: 0, vy: 0, t: 0, max: 0.55, size, col });
  const confetti = (x, y, n) => { const cols = ['#e8c273', '#b8412e', '#2d5b8c', '#f1e6c8', '#7f9a5e']; for (let i = 0; i < n; i++) { const a = fx.next() * Math.PI * 2, s = 1.5 + fx.next() * 4.5; add({ kind: 3, x, y, z: 1.2 + fx.next(), vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 1.1 + fx.next() * 0.8, size: 1, col: cols[fx.int(cols.length)], spin: 6 + fx.next() * 10 }); } };
  const stepParts = (dt) => {
    for (const q of state.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; }
    for (let i = state.parts.length - 1; i >= 0; i--) if (state.parts[i].t >= state.parts[i].max) state.parts.splice(i, 1);
  };
  const pop = (x, y, text, col, size = 34) => { state.pops.push({ x, y, z: 2.4, text, col, size, t: 0, max: 1.6 }); if (state.pops.length > 6) state.pops.shift(); };

  // ---- the match ------------------------------------------------------------------------------------------------
  const curLeg = () => state.m.legs[state.m.idx];
  const isAI = (i) => state.m.players[i].ai >= 0;
  const profOf = (i) => PROFILES[state.m.players[i].ai];
  const courtOf = (leg) => compileCourt(COURT_BY_ID[leg.court], leg.dir);

  function newMatch(cfg) {
    const seed = cfg.seed ?? aiRng.int(1000000);
    let players;
    if (cfg.mode === 'watch') players = [{ name: PROFILES[cfg.watchA].name, ai: cfg.watchA }, { name: PROFILES[cfg.opp].name, ai: cfg.opp }];
    else if (cfg.mode === 'two') players = [{ name: 'Player 1', ai: -1 }, { name: 'Player 2', ai: -1 }];
    else if (cfg.mode === 'solo') players = [{ name: 'You', ai: -1 }];
    else players = [{ name: 'You', ai: -1 }, { name: PROFILES[cfg.opp].name, ai: cfg.opp }];
    const legs = cfg.mode === 'watch' ? cfg.watchLegs.map(legById) : legsForVenue(cfg.venue);
    const m = {
      cfg: { mode: 'ai', opp: 1, venue: 'canal', watchA: 3, ...cfg, seed }, players, legs, idx: 0, cur: 0,
      scores: players.map(() => []), totals: players.map(() => 0), wins: players.map(() => 0), parSoFar: 0, over: null, order: players.map((_, i) => i), limit: Infinity,
    };
    delete m.cfg.watchLegs;
    return m;
  }

  function beginLeg(resumed = false) {
    const m = state.m, leg = curLeg();
    state.court = courtOf(leg);
    const c = state.court;
    state.balls = m.players.map(() => ({ ball: newBall(c.tee.x, c.tee.y), strokes: 0, done: false, out: false, pickup: false, prev: { x: c.tee.x, y: c.tee.y }, trail: [] }));
    state.phase = 'aim'; state.holeEnd = null; state.card = null; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false;
    state.guide = null; state.drag = null; state.hold = null; guideKey = ''; state.ff = false; state.hintPow = null; state.reachPow = null;
    state.parts = []; state.pops = []; state.settleT = 0; state.strikeT = 9;
    m.limit = Infinity;
    m.cur = m.order[0];
    const b = state.balls[m.cur].ball;
    state.camv = { x: b.x, y: b.y, yaw: Math.atan2(c.post.x - b.x, c.post.y - b.y), dist: Math.hypot(c.post.x - b.x, c.post.y - b.y) };
    startTurn(true);
    toast(c.tip ?? COURT_BY_ID[leg.court].tip, 4.6);
    if (!resumed && m.cfg.mode !== 'watch') persistMatch();
  }

  // the next player: whoever is next in the order among those still allowed to play
  const live = (i) => { const b = state.balls[i]; return !b.done && b.strokes < Math.min(STROKE_CAP, state.m.limit); };
  function nextPlayer() {
    const m = state.m, n = m.players.length;
    const pos = m.order.indexOf(m.cur);
    for (let k = 1; k <= n; k++) { const i = m.order[(pos + k) % n]; if (live(i)) { m.cur = i; return true; } }
    return false;
  }
  function startTurn(first = false) {
    const m = state.m, b = state.balls[m.cur], c = state.court;
    state.phase = 'aim'; state.drag = null; state.hold = null; state.guide = null; guideKey = ''; state.card = null; state.think = null; planner = null; hintPlanner = null; state.hintBusy = false;
    state.hintPow = null; state.strikeT = 9;
    state.sw = { p: 0, dir: 1, auto: null, t: 0, locked: 0, fired: false };
    state.figAt = { x: b.ball.x, y: b.ball.y };
    state.humanTurn = !isAI(m.cur) && m.cfg.mode !== 'watch';
    b.trail = [];
    const base = Math.atan2(c.post.x - b.ball.x, c.post.y - b.ball.y);
    state.aim = { ang: base, pow: state.lastPow, placed: true };
    if (!state.humanTurn) state.wlabel = m.cfg.mode === 'watch' ? `${m.players[m.cur].name} is thinking…` : '';
    if (m.players.length > 1 && !first) toast(`${m.players[m.cur].name}${state.humanTurn ? ': your stroke' : ' is up'}`, 1.8);
    updateGuide(true);
  }

  function startMatch(cfg) {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoLegs >= DEMO_LEG_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.m = newMatch(cfg);
    if (state.demo && cfg.mode !== 'watch') state.m.legs = state.m.legs.slice(0, DEMO_LEG_CAP);
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.ui.scroll = 0; state.clock = 0;
    beginLeg();
  }
  function resumeMatch() {
    const sn = state.saved; if (!sn) return;
    if (state.demo && state.record.demoLegs >= DEMO_LEG_CAP) { clearSaved(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const m = newMatch({ ...sn.cfg, seed: sn.cfg.seed });
    m.legs = sn.legIds.map(legById); m.idx = sn.idx;
    m.scores = sn.scores.map((r) => r.slice()); m.totals = m.scores.map((r) => r.reduce((a, b) => a + b, 0)); m.wins = sn.wins.slice();
    m.parSoFar = m.legs.slice(0, m.idx).reduce((a, d) => a + d.par, 0); m.order = Array.isArray(sn.order) && sn.order.length === m.players.length ? sn.order.slice() : m.order;
    state.m = m; state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.ui.scroll = 0; state.clock = 0;
    beginLeg(true);
    toast('Match restored. Press Resume to carry on', 3.2);
    openPause();    // always resumes paused
  }
  function startWatch() {
    const picks = [2, 3, 1];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    const pool = ALL_LEGS.map((l) => l.id), ids = [];
    while (ids.length < 3) ids.push(pool.splice(aiRng.int(pool.length), 1)[0]);
    startMatch({ mode: 'watch', watchA: a, opp: b, watchLegs: ids, venue: 'canal' });
  }

  // ---- aiming ------------------------------------------------------------------------------------------------------
  const ballNow = () => state.balls[state.m.cur].ball;
  function updateGuide(force = false) {
    const m = state.m, c = state.court; if (!m || !c) return;
    const b = ballNow(), a = state.aim;
    state.distToPost = Math.hypot(c.post.x - b.x, c.post.y - b.y);
    const key = `${m.idx}|${m.cur}|${b.x.toFixed(2)}|${b.y.toFixed(2)}|${a.ang.toFixed(4)}|${state.settings.guide}`;
    if (!force && key === guideKey) return;
    guideKey = key;
    state.guide = null; state.reachPow = null;
    if (state.settings.guide === 2) return;
    // a full-power stroke along the aim shows the line of flight; weaker strokes stop earlier along it
    const r = simulate(c, b, a.ang, 1, state.clock, { path: true, noMovers: true, until: state.settings.guide === 0 ? null : 'wall', maxT: 7 });
    state.guide = { pts: r.path, end: { x: r.x, y: r.y }, hitsPost: r.mode === 'post' };
    // the power that just reaches the post straight along this aim, if it does
    const s1 = simulate(c, b, a.ang, 1, state.clock, { noMovers: true, until: 'wall', maxT: 7 });
    if (s1.mode === 'post') {
      let lo = 0.02, hi = 1;
      for (let k = 0; k < 9; k++) { const mid = (lo + hi) / 2; const q = simulate(c, b, a.ang, mid, state.clock, { noMovers: true, until: 'wall', maxT: 7 }); if (q.mode === 'post') hi = mid; else lo = mid; }
      state.reachPow = hi;
    }
  }
  const turnAim = (ang) => { state.aim.ang = normAng(ang); if (state.card && state.card.sticky) state.card = null; state.hintPow = null; updateGuide(); };

  // ---- the swing ---------------------------------------------------------------------------------------------------------
  function beginSwing(auto = null) {
    if (state.phase !== 'aim' || state.paused || globalThis.__kolfFigBusy) return;   // the player is still skating to the ball
    state.phase = 'swing'; state.sw = { p: 0, dir: 1, auto, t: 0, locked: 0, fired: false };
    state.card = null; state.hintBusy = false; hintPlanner = null; state.drag = null; state.hold = null;
    sfx.swing(0.4);
  }
  function lockStrike(p) {
    if (state.phase !== 'swing') return;
    state.phase = 'strike'; state.sw.locked = clamp(p, 0.02, 1); state.sw.t = 0; state.sw.fired = false;
    sfx.swing(0.6 + 0.4 * p);   // the club whooshes through the air on the way down
  }
  const humanStrike = () => { if (state.phase === 'swing' && state.humanTurn) lockStrike(state.sw.p); };
  function stroke(i, ang, pow) {
    const b = state.balls[i], p = clamp(pow, 0.02, 1);
    let a = ang;
    if (p > 0.9) a += (fx.next() - 0.5) * 2 * SCATTER * ((p - 0.9) / 0.1);
    b.prev = { x: b.ball.x, y: b.ball.y };
    b.strokes++;
    launchBall(b.ball, a, p);
    b.trail = [];
    state.lastPow = p;
    state.phase = 'roll'; state.ff = false; state.humanTurn = false; state.drag = null; state.hold = null; state.guide = null; guideKey = ''; state.card = null; state.think = null;
    state.settleT = 0; state.hintBusy = false; hintPlanner = null; state.hintPow = null; state.strikeT = 0;
    sfx.strike(p);
    sparks(b.ball.x, b.ball.y, 6, 1.5, '#ffffff', 0.2);
  }
  function updateSwing(dt) {
    const sw = state.sw;
    sw.t += dt;
    const k = state.ff ? 2 : 1;
    if (sw.auto != null) {
      sw.p = Math.min(sw.auto, sw.p + (dt * k) / 0.9);
      if (sw.p >= sw.auto - 1e-6) lockStrike(sw.auto);
    } else {
      sw.p += (sw.dir * dt) / SWING_UP;
      if (sw.p >= 1) { sw.p = 1; sw.dir = -1; } else if (sw.p <= 0) { sw.p = 0; sw.dir = 1; }
    }
  }
  function updateStrike(dt) {
    const sw = state.sw;
    sw.t += dt;
    if (!sw.fired && sw.t >= STRIKE_DELAY) {
      sw.fired = true;
      const m = state.m;
      let ang = state.aim.ang, pow = sw.locked;
      if (isAI(m.cur) && sw.shaky) { ang = sw.shaky.ang; pow = sw.shaky.pow; }
      stroke(m.cur, ang, pow);
    }
  }
  const humanSwingBegin = () => {
    if (!state.humanTurn || state.phase !== 'aim' || state.paused) return;
    beginSwing(null);
  };

  // ---- rolling -----------------------------------------------------------------------------------------------------------
  function worldEvents(c, b, ev) {
    for (const e of ev) {
      state.evq.push(e); if (state.evq.length > 40) state.evq.shift();
      if (e.k === 'wall') { sparks(e.x, e.y, Math.min(7, 2 + Math.floor(e.v / 3)), 1.6, '#eef6fb', 0.4); sfx.wall(e.v); }
      else if (e.k === 'pillar' || e.k === 'block') { sparks(e.x, e.y, 5, 1.4, '#e8dcc0', 0.5); sfx.thud(e.v); }
      else if (e.k === 'sledge') { sparks(e.x, e.y, 6, 1.8, '#e0b85a', 0.6); sfx.sledge(); }
      else if (e.k === 'crack') {
        for (let i = 0; i < 14; i++) { const a = fx.next() * Math.PI * 2, s = 1 + fx.next() * 2.4; add({ kind: 0, x: e.x, y: e.y, z: 0.1, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.7, size: 2, col: '#cfe8f2' }); }
        ring(e.x, e.y, 1.6, '#e6f6ff'); ring(e.x, e.y, 0.9, '#bfe6ff'); sfx.crack();
      } else if (e.k === 'post') { sfx.post(); ring(c.post.x, c.post.y, 2, '#e8c273'); sparks(c.post.x, c.post.y, 14, 2.5, '#e8c273', 0.8); }
    }
  }
  function updateRoll() {
    const m = state.m, c = state.court, b = state.balls[m.cur];
    const n = 2 * (state.ff ? 3 : 1);
    const ev = [];
    for (let k = 0; k < n; k++) {
      ev.length = 0;
      stepBall(c, b.ball, state.clock, ev);
      state.clock += STEP;
      if (ev.length) worldEvents(c, b, ev);
      if ((k & 1) === 0 && b.ball.mode === 'roll') {
        b.trail.push([b.ball.x, b.ball.y]); if (b.trail.length > 20) b.trail.shift();
        if (onSnow(c, b.ball.x, b.ball.y) && fx.next() < 0.25) { add({ kind: 0, x: b.ball.x, y: b.ball.y, z: 0.2, vx: (fx.next() - 0.5) * 1.2, vy: (fx.next() - 0.5) * 1.2, t: 0, max: 0.5, size: 2.4, col: '#f7f4ea' }); sfx.snow(); }
      }
      if (b.ball.mode !== 'roll') break;
    }
    if (b.ball.mode !== 'roll') { state.phase = 'settle'; state.settleT = 0; }
  }
  function stepBalls(dt) {
    for (const b of state.balls) {
      if (b.ball.mode === 'thin') b.ball.sink = Math.min(1.2, b.ball.sink + dt);
      if (b.trail.length && b.ball.mode !== 'roll') b.trail.shift();
    }
  }
  function updateSettle(dt) {
    const m = state.m, b = state.balls[m.cur];
    state.settleT += dt * (state.ff ? 2 : 1);
    const wait = b.ball.mode === 'post' ? 0.9 : b.ball.mode === 'thin' ? 1.0 : 0.35;
    if (state.settleT < wait) return;
    const bl = b.ball, who = m.players[m.cur].name, c = state.court;
    if (bl.mode === 'post') {
      b.done = true;
      m.limit = Math.min(m.limit, b.strokes);
      const par = curLeg().par, name = scoreName(b.strokes, par);
      pop(c.post.x, c.post.y, name, b.strokes === 1 ? '#e8c273' : '#ffffff', b.strokes === 1 ? 44 : 36);
      if (b.strokes === 1) confetti(c.post.x, c.post.y, 46); else if (b.strokes <= par) confetti(c.post.x, c.post.y, 18);
    } else if (bl.mode === 'thin') {
      b.strokes += 1;
      toast(`${who === 'You' ? 'Through the ice' : `${who}: through the ice`}! One stroke added, played again from the same spot`, 3.2);
      bl.x = b.prev.x; bl.y = b.prev.y; bl.vx = 0; bl.vy = 0; bl.mode = 'rest'; bl.sink = 0; b.trail = [];
      ring(bl.x, bl.y, 1.2, '#ffffff');
    }
    if (!b.done && b.strokes >= STROKE_CAP) { b.done = true; b.pickup = true; b.out = true; toast(`${who === 'You' ? 'You pick' : `${who} picks`} up: ${STROKE_CAP} strokes is the most in a leg`, 3); }
    if (m.cfg.mode === 'watch') state.wlabel = '';
    if (nextPlayer()) startTurn();
    else endLeg();
  }

  function endLeg() {
    const m = state.m, leg = curLeg(), n = m.players.length;
    const res = state.balls.map((b) => {
      if (b.done && !b.pickup) return { strokes: b.strokes, name: scoreName(b.strokes, leg.par), out: false };
      const s = Math.min(STROKE_CAP, m.limit === Infinity ? STROKE_CAP : m.limit + 1);
      return { strokes: s, name: b.pickup ? 'Picked up' : 'Out', out: true };
    });
    res.forEach((r, i) => { m.scores[i].push(r.strokes); m.totals[i] += r.strokes; });
    m.parSoFar += leg.par;
    const finished = res.map((r, i) => (r.out ? -1 : i)).filter((i) => i >= 0);
    let lead = -1;
    if (finished.length) {
      const best = Math.min(...finished.map((i) => res[i].strokes));
      const top = finished.filter((i) => res[i].strokes === best);
      if (top.length === 1) lead = top[0];
    }
    let title;
    if (n === 1) title = res[0].out ? 'Picked up' : res[0].name;
    else if (lead >= 0) title = `${m.players[lead].name} ${m.players[lead].name === 'You' ? 'win' : 'wins'} the leg`;
    else title = 'The leg is halved';
    if (lead >= 0 && n > 1) m.wins[lead]++;
    state.holeEnd = { t: 0, title, results: res, lead };
    state.phase = 'legend'; state.humanTurn = false;
    // the winner of a leg strikes first in the next one; after a halved leg the order stays
    if (lead >= 0 && n > 1) m.order = [lead, ...m.order.filter((i) => i !== lead)];
    if (m.cfg.mode !== 'watch') {
      state.record.legs++;
      state.record.demoLegs = (state.record.demoLegs | 0) + 1;
      m.players.forEach((p, i) => { if (p.ai < 0 && res[i].strokes === 1 && !res[i].out) state.record.inOne++; });
      save();
    }
    if (lead >= 0 && m.players[lead].ai < 0) sfx.win();
  }

  function finishMatch() {
    const m = state.m, n = m.players.length;
    const totals = m.totals.slice();
    let winners;
    if (n === 1) winners = [0];
    else {
      const bw = Math.max(...m.wins), byWins = m.wins.map((w, i) => (w === bw ? i : -1)).filter((i) => i >= 0);
      if (byWins.length === 1) winners = byWins;
      else { const bt = Math.min(...byWins.map((i) => totals[i])); winners = byWins.filter((i) => totals[i] === bt); }
    }
    m.over = { totals, winners, par: m.parSoFar };
    state.scene = 'result'; state.ui.scroll = 0; state.phase = 'aim';
    if (m.cfg.mode !== 'watch') {
      const humans = m.players.map((p, i) => (p.ai < 0 ? i : -1)).filter((i) => i >= 0);
      state.record.matches++;
      if (m.cfg.mode === 'ai' && winners.length === 1 && winners[0] === 0) { state.record.wins[Math.min(3, m.cfg.opp)]++; sfx.win(); }
      const key = m.cfg.venue, mine = Math.min(...humans.map((i) => totals[i]));
      if (m.legs.length === legsForVenue(m.cfg.venue).length && (state.record.best[key] == null || mine < state.record.best[key])) { state.record.best[key] = mine; m.over.newBest = true; }
      clearSaved(); save();
    }
  }
  function nextLeg() {
    const m = state.m;
    if (state.demo && m.cfg.mode !== 'watch' && state.record.demoLegs >= DEMO_LEG_CAP) { clearSaved(); save(); state.scene = 'demolimit'; state.ui.scroll = 0; state.holeEnd = null; return; }
    if (m.idx >= m.legs.length - 1) { state.holeEnd = null; finishMatch(); return; }
    m.idx++; beginLeg();
  }

  // ---- computer players ----------------------------------------------------------------------------------------------
  function updateAI(dt) {
    const m = state.m;
    if (state.phase !== 'aim' || state.humanTurn || state.paused || state.holeEnd) return;
    const i = m.cur, prof = profOf(i), watch = m.cfg.mode === 'watch', c = state.court, b = state.balls[i];
    if (!state.think) {
      const dur = watch ? THINK_STEPS[state.settings.thinkIdx] : prof.think[0] + aiRng.next() * (prof.think[1] - prof.think[0]);
      const reveal = watch ? 2 : 0.8;
      state.think = { t: 0, dur, reveal, phase: 'think', plan: null };
      planner = createPlanner(c, b.ball, state.clock + dur + reveal + 1.2, prof, aiRng, {});
      if (watch) { state.wlabel = `${m.players[i].name} is thinking…`; toast(`${m.players[i].name} is thinking…`, Math.min(dur, 3)); }
    }
    const th = state.think;
    th.t += dt * (state.ff ? 3 : 1);
    if (planner && !planner.done) { planner.step(state.ff ? 90 : 36); if (planner.done) { th.plan = planner.result; planner = null; } }
    if (th.phase === 'think' && th.t >= th.dur && th.plan) {
      th.phase = 'reveal'; th.t = 0; th.dur = th.reveal;
      const p = th.plan;
      state.aim = { ang: p.ang, pow: p.pow, placed: true };
      state.guide = { pts: p.path, end: { x: p.end.x, y: p.end.y }, hitsPost: p.hit };
      state.hintPow = p.pow;
      th.shaky = shaky(p, prof, gauss(), gauss());
      if (watch) {
        const ex = explainPlan(c, b.ball, p);
        state.card = { title: `${m.players[i].name}: ${ex.title}`, text: `${ex.reason}${p.alts && p.alts.length ? ' It also weighed another line.' : ''}`, sticky: true };
        state.wlabel = `${m.players[i].name} will play: ${ex.title}`;
      }
    } else if (th.phase === 'reveal' && th.t >= th.dur) {
      const p = th.plan, sh = th.shaky;
      const lead = sh.pow * 0.9 + STRIKE_DELAY;
      if (state.clock + 1e-6 >= p.tLaunch - lead) {
        state.card = null; state.hintPow = null;
        beginSwing(sh.pow);
        state.sw.shaky = { ang: sh.ang, pow: sh.pow };
        if (watch) state.wlabel = `${m.players[i].name} swings`;
      }
    }
  }

  // ---- Think (the hint for the player) --------------------------------------------------------------------------------
  function requestHint() {
    if (state.hintBusy || state.phase !== 'aim' || !state.humanTurn || state.paused) return;
    state.hintBusy = true;
    hintPlanner = createPlanner(state.court, ballNow(), state.clock + 1.5, ADVISOR, aiRng, {});
  }
  function updateHint() {
    if (!hintPlanner) return;
    hintPlanner.step(70);
    if (hintPlanner.done) {
      const p = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
      if (state.phase !== 'aim' || !state.humanTurn) return;
      const c = state.court, b = ballNow();
      state.aim = { ang: p.ang, pow: p.pow, placed: true };
      state.guide = { pts: p.path, end: { x: p.end.x, y: p.end.y }, hitsPost: p.hit };
      guideKey = `hint|${state.aim.ang}`;
      state.hintPow = p.pow; state.reachPow = null;
      const ex = explainPlan(c, b, p);
      const timing = c.hasMovers ? ' Watch the sledge and swing when the way is clear.' : '';
      state.card = { title: `Think: ${ex.title}`, text: `${ex.reason}${timing} The aim is set and the green marker shows the power: tap Swing, then Strike! when the bar reaches it.`, sticky: true };
    }
  }

  // ---- camera and figure ---------------------------------------------------------------------------------------------
  function stepCamera(dt) {
    const m = state.m, c = state.court, v = state.camv; if (!m || !c) return;
    const b = state.balls[m.cur].ball;
    const k = 1 - Math.exp(-dt * (state.phase === 'roll' ? 7 : 4.5));
    v.x += (b.x - v.x) * k; v.y += (b.y - v.y) * k;
    let ty = v.yaw;
    if (state.phase === 'aim' || state.phase === 'swing' || state.phase === 'strike') ty = state.aim.ang;
    else if (state.phase === 'settle' || state.phase === 'legend') ty = Math.atan2(c.post.x - b.x, c.post.y - b.y);
    v.yaw = normAng(v.yaw + normAng(ty - v.yaw) * (1 - Math.exp(-dt * (state.phase === 'aim' && state.drag ? 14 : 5))));
    const d = Math.hypot(c.post.x - b.x, c.post.y - b.y);
    v.dist += (d - v.dist) * (1 - Math.exp(-dt * 3));
  }
  // Where the stroke is, for presenters that animate a body: back-swing power, down-swing progress, follow-through time.
  function figPhase() {
    const sw = state.sw;
    if (state.phase === 'swing') return { ph: 'back', u: sw.p };
    if (state.phase === 'strike') { const u = clamp(sw.t / STRIKE_DELAY, 0, 1); return { ph: 'down', u: u * u * (3 - 2 * u), from: sw.locked }; }
    if (state.phase === 'roll' || state.phase === 'settle') return { ph: 'follow', u: Math.min(state.strikeT, 9) };
    return { ph: 'idle', u: 0 };
  }
  function figureAngle() {
    const REST = 0.25;
    const sw = state.sw;
    if (state.phase === 'swing') return REST - 2.5 * sw.p;
    if (state.phase === 'strike') { const back = REST - 2.5 * sw.locked, u = clamp(sw.t / STRIKE_DELAY, 0, 1); return back + (REST - back) * (u * u * (3 - 2 * u)); }
    if (state.phase === 'roll' || state.phase === 'settle') { const u = state.strikeT; return u < 0.3 ? REST + 1.1 * (u / 0.3) : REST + 1.1 * Math.max(0, 1 - (u - 0.3) / 0.9); }
    return REST + 0.04 * Math.sin(state.t * 2);
  }

  // ---- the play scene ----------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.reasonOpen = false; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => {
    state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.reasonOpen = false; state.ui.scroll = 0;
    state.think = null; planner = null; hintPlanner = null; state.hintBusy = false; state.drag = null; state.hold = null; state.card = null; state.holeEnd = null;
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
    if (config.dev && keys.pressed.has('KeyK') && !state.holeEnd) { state.balls.forEach((b) => { if (!b.done) { b.done = true; b.strokes = Math.max(1, b.strokes); } }); m.limit = 1; endLeg(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) {
      if (state.pauseMenu) closePause(); else if (state.reasonOpen) state.reasonOpen = false; else if (!watch && state.phase !== 'roll') openPause(); else state.paused = !state.paused;
    }
    if (state.pauseMenu) { modalInput(ptr, 'pause', handlePauseTap); return; }
    if (state.reasonOpen) { modalInput(ptr, 'reason', (id) => { if (id === 'reason-close') state.reasonOpen = false; }); return; }

    const c = lay.ctrl;
    const aimOk = state.humanTurn && !state.paused && state.phase === 'aim' && !state.holeEnd;
    if (ptr.pressed) {
      const hit = (id) => c[id] && inRect(c[id], ptr.x, ptr.y);
      if (hit('menu')) { openPause(); sfx.tick(); return; }
      if (hit('pause')) { state.paused = !state.paused; sfx.tick(); }
      else if (hit('fast')) { state.ff = !state.ff; sfx.tick(); }
      else if (hit('next') && state.holeEnd && state.holeEnd.t > 0.5) { sfx.tick(); nextLeg(); return; }
      else if (hit('dec')) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
      else if (hit('inc')) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, 1.6); }
      else if (hit('exit')) { leaveMatch(); return; }
      else if (hit('think')) { requestHint(); sfx.tick(); }
      else if (hit('swing')) { if (state.phase === 'swing') humanStrike(); else humanSwingBegin(); return; }
      else if ((hit('left') || hit('right')) && aimOk) { state.hold = { id: hit('left') ? 'left' : 'right', t: 0 }; turnAim(state.aim.ang + (hit('left') ? -0.002 : 0.002)); }
      else if (state.card && inRect(cardRectFor(state, lay), ptr.x, ptr.y)) { state.reasonOpen = true; state.ui.scroll = 0; return; }
      else if (state.phase === 'swing' && state.humanTurn && !state.paused && inRect(lay.sheet, ptr.x, ptr.y)) { humanStrike(); return; }
      else if (aimOk && inRect(lay.sheet, ptr.x, ptr.y)) { state.drag = { sx: ptr.x, a0: state.aim.ang, moved: 0 }; }
    }
    if (state.hold) {
      if (ptr.down && aimOk) {
        state.hold.t += dt;
        const rate = 0.05 + Math.min(0.5, state.hold.t * 0.35);
        if (state.hold.t > 0.22) turnAim(state.aim.ang + (state.hold.id === 'left' ? -1 : 1) * rate * dt);
      } else state.hold = null;
    }
    if (state.drag) {
      if (aimOk && ptr.down) { state.drag.moved = Math.max(state.drag.moved, Math.abs(ptr.x - state.drag.sx)); turnAim(state.drag.a0 + (ptr.x - state.drag.sx) * AIM_SENS); }
      else state.drag = null;
    }
    // keyboard
    if (aimOk) {
      const fine = keys.down.has('ShiftLeft') || keys.down.has('ShiftRight');
      const sp = fine ? 0.12 : 0.6;
      if (keys.down.has('ArrowLeft')) turnAim(state.aim.ang - sp * dt);
      if (keys.down.has('ArrowRight')) turnAim(state.aim.ang + sp * dt);
      if (keys.pressed.has('KeyH')) requestHint();
    }
    if (state.humanTurn && !state.paused && !state.holeEnd) {
      if (keys.pressed.has('Space') || keys.pressed.has('Enter')) { if (state.phase === 'swing') humanStrike(); else if (state.phase === 'aim') humanSwingBegin(); }
    }
    if (state.holeEnd) {
      if (!state.paused) state.holeEnd.t += dt;
      if (!watch && (keys.pressed.has('Enter') || keys.pressed.has('Space')) && state.holeEnd.t > 0.6) { nextLeg(); return; }
      if (watch && state.holeEnd.t > 4.8 && !state.paused) { nextLeg(); return; }
    }
    if (state.paused) return;
    if (state.phase !== 'roll') state.clock += dt * (state.ff && !state.humanTurn ? 3 : 1);
    stepParts(dt);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.strikeT < 9) state.strikeT += dt;
    stepBalls(dt);
    updateHint();
    if (state.phase === 'aim') { updateAI(dt); if (state.phase === 'aim') updateGuide(); }
    else if (state.phase === 'swing') updateSwing(dt);
    else if (state.phase === 'strike') updateStrike(dt);
    else if (state.phase === 'roll') updateRoll();
    else if (state.phase === 'settle') updateSettle(dt);
    stepCamera(dt);
    state.fig.ang = figureAngle();
  }

  // ---- rendering ---------------------------------------------------------------------------------------------------------
  function renderPlay(ctx) {
    const m = state.m, c = state.court;
    const lay = layoutFor(state);
    state.lay = lay;
    const S = {
      court: c, v: state.camv, t: state.t, clock: state.clock, cur: m.cur, ring: state.humanTurn && state.phase === 'aim',
      balls: state.balls.map((b, i) => ({ ball: b.ball, color: BALL_COLORS[i % 4], trail: b.trail, done: b.done })),
      guide: state.phase === 'aim' && !state.holeEnd && (state.humanTurn || state.think) ? state.guide : null,
      parts: state.parts, events: state.evq.splice(0),
      fig: { show: true, at: state.figAt, swing: state.fig.ang, color: BALL_COLORS[m.cur % 4], lean: state.phase === 'swing' ? state.sw.p : 0, ...figPhase() },
    };
    const cam = drawScene(ctx, lay.sheet, S);
    drawFrame(ctx, lay.sheet);
    drawPops(ctx, state, cam);
    drawMini(ctx, lay.mini, { court: c, balls: S.balls, cur: m.cur, clock: state.clock, aim: { show: state.phase === 'aim' || state.phase === 'swing', ang: state.aim.ang } });
    drawHud(ctx, state, lay);
    if (controlKind(state) === 'aim' && !state.holeEnd) drawMeter(ctx, state, lay);
    drawCard(ctx, state, lay);
    drawToast(ctx, state, lay);
    drawLegEnd(ctx, state, lay);
    drawControls(ctx, state, lay);
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
    else if (id.startsWith('crs-')) { const v = id.slice(4); if (state.demo && v !== 'canal') { state.setupMsg = 'That venue is in the full game.'; return; } s.venue = v; state.setupMsg = ''; }
    else if (id === 'start') startMatch({ mode: s.mode, opp: s.opp, venue: s.venue });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-guide') { st.guide = (st.guide + 1) % 3; guideKey = ''; }
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
    { leg: 'canal-run:0', at: null, ang: 0.01 },
    { leg: 'lock-gate:0', at: { x: 7, y: 22 }, ang: -0.24 },
    { leg: 'bollard-field:0', at: { x: 5.5, y: 30 }, ang: 0.28 },
    { leg: 'windmill-reach:0', at: { x: 9, y: 40 }, ang: 0.0 },
    { leg: 'boat-yard:1', at: { x: 13, y: 78 }, ang: 3.3 },
    { leg: 'long-reach:0', at: { x: 8, y: 60 }, ang: 0.0 },
  ];
  const q0 = (k) => { try { const mm = new RegExp(`[?&]${k}=([a-z0-9:.-]+)`).exec(globalThis.location.search); return mm ? mm[1] : null; } catch { return null; } };
  function setupShowcase(kind) {
    const sc = { ...SHOWCASE[kind % SHOWCASE.length] };
    if (q0('leg') && legById(q0('leg'))) sc.leg = q0('leg');
    state.shotMode = { kind, tick: 0, sc };
    const leg = legById(sc.leg);
    state.m = newMatch({ mode: 'ai', opp: 2, venue: 'cup', seed: 4242 + kind });
    state.m.legs = [leg];
    state.scene = 'play'; state.clock = 0;
    beginLeg(true);
    if (sc.at) { const b = state.balls[0].ball; b.x = sc.at.x; b.y = sc.at.y; state.camv.x = b.x; state.camv.y = b.y; state.figAt = { x: b.x, y: b.y }; }
    state.toastT = 0;
    state.humanTurn = true;
    state.aim = { ang: sc.ang, pow: 0.7, placed: true };
    state.camv.yaw = sc.ang;
    updateGuide(true);
  }
  function showcaseStep() { state.shotMode.tick++; }
  for (const key of ['lay']) Object.defineProperty(state, key, { value: null, writable: true, enumerable: false });
  state.att = newAttract();
  resetMenus();
  function finishDemoResult() {
    const m = state.m;
    m.legs.forEach((d, i) => { m.scores.forEach((row, p) => { row.push(Math.max(1, d.par + ((i + p) % 3) - 1)); }); });
    m.totals = m.scores.map((r) => r.reduce((a, b) => a + b, 0));
    m.parSoFar = m.legs.reduce((a, d) => a + d.par, 0);
    m.wins = m.players.map((_, i) => (i === 0 ? 2 : 1));
    finishMatch();
  }
  if (SHOT_MODE) {
    setupShowcase((Number(config.seed) | 0) % SHOWCASE.length);
    // Store screenshots: seed = scene + 6 x moment (0 aiming, 1 mid-swing, 2 ball in flight (use ~110 ticks), 3 leg won).
    const moment = Math.floor((Number(config.seed) | 0) / SHOWCASE.length) % 4;
    if (moment === 1) { state.shotMode = null; beginSwing(null); state.sw.p = 0.66; }
    else if (moment === 2) { state.shotMode = null; beginSwing(0.72); }
    else if (moment === 3) { state.shotMode = null; state.balls[0].done = true; state.balls[0].strokes = 3; state.balls[1].done = true; state.balls[1].strokes = 4; state.m.limit = 3; endLeg(); }
    const q = (k) => { try { const mm = new RegExp(`[?&]${k}=([a-z0-9]+)`).exec(globalThis.location.search); return mm ? mm[1] : null; } catch { return null; } };
    if (q('zoom')) state.settings.textIdx = clamp(Number(q('zoom')) | 0, 0, 4);
    const v = q('view');
    if (v) {
      state.shotMode = v === 'pause' ? state.shotMode : null;
      if (v === 'pause') openPause();
      else if (v === 'result') { state.m = newMatch({ mode: 'ai', opp: 2, venue: 'canal', seed: 5 }); finishDemoResult(); }
      else if (v === 'rules' || v === 'about' || v === 'howto') { state.scene = v; state.back = 'title'; state.page = 0; state.ui.scroll = (Number(q('page')) | 0) * 900; }
      else if (v === 'watch') { startWatch(); state.shotMode = null; }
      else if (v === 'legend') { state.shotMode = null; state.balls[0].done = true; state.balls[0].strokes = 3; state.balls[1].done = true; state.balls[1].strokes = 4; state.m.limit = 3; endLeg(); }
      else if (v === 'swing') { state.shotMode = null; beginSwing(null); state.sw.p = 0.62; }
      else state.scene = v;
    }
    const adv = Number(q('ticks')) | 0;
    if (adv > 0 && state.scene === 'play') {
      const blank = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
      for (let i = 0; i < adv; i++) { state.t += 1 / 60; if (state.shotMode) showcaseStep(); updatePlay(1 / 60, blank); }
    }
  }

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused match does not).
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
      badgeSlot.ok = false; badgeSlot.k = meta.cssPerUnit > 0 ? meta.cssPerUnit : Math.min(globalThis.innerWidth / meta.width, globalThis.innerHeight / meta.height) || 0.5;
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
          if (state.m) renderPlay(ctx);
          if (state.pauseMenu) renderPause(ctx, state);
          else if (state.reasonOpen) renderReason(ctx, state);
          break;
        default: break;
      }
      // Preview pill: on the play screen it moves into the scoreboard's free corner; elsewhere the kit's top-centre default.
      if (badgeSlot.ok) {
        const ph = Math.max(16, 11.5 / badgeSlot.k) * 1.7;
        meta.previewBadge = { x: badgeSlot.x, y: badgeSlot.y - ph / 2, align: 'right' };
      } else meta.previewBadge = null;
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
  };
}
