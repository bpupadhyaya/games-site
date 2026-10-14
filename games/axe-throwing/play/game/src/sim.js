// Axe Throwing: the pure, deterministic simulation. No drawing, no clock, no DOM.
// A square timber board (BS x BS units, centred on 0,0) with painted rings. The player presses to aim a reticle, the swing meter
// sweeps while the finger is down, and letting go throws: the swing speed decides how many times the axe turns before it reaches
// the board (slow swing = more turns). The blade bites only when the turns are a whole number (half turns for the double-bit) within
// the window of the level; otherwise the axe bounces. Where it lands is the reticle plus hand sway, wind and a sliding board.
export const BS = 1000, HALF = 500;
export const ROUNDS = 3, PER = 3;              // axes per player per round
export const STUCK_GAP = 46;                    // an axe closer than this to a stuck head deflects
export const MIN_HOLD = 0.14;                   // seconds a finger must be down for a throw
export const FLIGHT = 0.95;                     // seconds of flight at a mid swing
export const WAIT_READY = 0.7, WAIT_SETTLE = 1.0, WAIT_ROUND = 2.0, RIVAL_AIM = 1.1;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Tiny seeded generator for the daily round and tests (same wind and board for everybody); the rest uses env.rng.
export function seeded(seed) {
  let s = (seed | 0) ^ 0x9e3779b9;
  const next = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, range: (a, b) => a + next() * (b - a), int: (n) => Math.floor(next() * n), chance: (p) => next() < p, pick: (a) => a[Math.floor(next() * a.length)] };
}

// ---- content -------------------------------------------------------------------------------------------------------------
// ring points by radius (board units); the two clutch spots sit in the upper corners.
export const RINGS = [
  { pts: 6, r: 64, name: 'Bull' }, { pts: 4, r: 150, name: 'Inner' }, { pts: 3, r: 244, name: 'Middle' },
  { pts: 2, r: 338, name: 'Outer' }, { pts: 1, r: 440, name: 'Rim' },
];
export const CLUTCH = [{ x: -400, y: -400, r: 48, pts: 7 }, { x: 400, y: -400, r: 48, pts: 7 }];

// tm: turns of the axe at a mid swing (the distance); wind: sideways drift amplitude in board units; rail: board slide amplitude.
export const VENUES = [
  { id: 0, name: 'Pine Camp', tm: 1.0, wind: 0, windPeriod: 1, rail: 0, railPeriod: 1, need: 0, blurb: 'A short lane in a lumber-camp shed on a bright day. Still air, a steady board: the place to learn the swing.' },
  { id: 1, name: 'Cedar Lodge', tm: 1.3, wind: 0, windPeriod: 1, rail: 0, railPeriod: 1, need: 1, blurb: 'Log walls and lantern light. You stand a step further back, so the axe turns more and the good swing is a faster one.' },
  { id: 2, name: 'Open Yard', tm: 1.0, wind: 95, windPeriod: 4.6, rail: 0, railPeriod: 1, need: 3, blurb: 'An outdoor lane at dusk. A crosswind pushes the axe sideways: read the pennants and aim into it.' },
  { id: 3, name: 'Night League', tm: 2.0, wind: 0, windPeriod: 1, rail: 85, railPeriod: 6.2, need: 6, blurb: 'The league hall under spotlights. A long lane with two turns, and the board slides on a rail: lead it.' },
];
// spin: turns per swing (x the venue), win: window multiplier, sway: hand sway multiplier, dbl: sticks on half turns too.
export const AXES = [
  { id: 0, name: 'Camp Hatchet', spin: 1.0, win: 1.0, sway: 1.0, dbl: false, need: 0, note: 'The all-rounder: balanced turn, balanced window, a steady hand.' },
  { id: 1, name: 'Long Felling Axe', spin: 0.8, win: 1.15, sway: 1.15, dbl: false, need: 12, note: 'A long handle turns slowly and forgives timing, but it is heavy to hold still.' },
  { id: 2, name: 'Double-Bit', spin: 1.0, win: 0.9, sway: 1.2, dbl: true, need: 30, note: 'Two blades: it sticks on half turns too, so there are twice the bands. Heavier to hold.' },
  { id: 3, name: 'Light Hand Axe', spin: 1.25, win: 0.88, sway: 0.82, dbl: false, need: 60, note: 'Quick to turn and steady in the hand, with a narrow margin.' },
];
export const LEVELS = [
  { id: 0, name: 'Casual', win: 0.11, sway: 20, period: 2.2, rival: 1.15, ghost: true, blurb: 'Wide windows, a slow swing and a mark that shows where the wind will put the axe.' },
  { id: 1, name: 'League', win: 0.075, sway: 32, period: 1.8, rival: 1.0, ghost: false, blurb: 'Tighter windows and a faster swing. Read the wind yourself.' },
  { id: 2, name: 'Pro', win: 0.05, sway: 46, period: 1.4, rival: 0.85, ghost: false, blurb: 'Narrow windows, a quick swing, a restless hand.' },
];
// skill 0..1, gamble: how willing it is to go for a clutch spot when behind
export const RIVALS = [
  { id: 0, name: 'Birch', skill: 0.55, gamble: 0.25, col: '#5fb4a0', blurb: 'A friendly newcomer to the lane.' },
  { id: 1, name: 'Marit', skill: 0.7, gamble: 0.5, col: '#d9a441', blurb: 'Steady, and not afraid of a corner shot.' },
  { id: 2, name: 'Tomas', skill: 0.82, gamble: 0.35, col: '#c0603c', blurb: 'A league regular who rarely wastes an axe.' },
  { id: 3, name: 'Hollis', skill: 0.88, gamble: 0.6, col: '#7d86d6', blurb: 'The hall champion. Reads wind and rail like a book.' },
];
export const RANKS = [[0, 'First flight'], [10, 'Steady wrist'], [20, 'Camp regular'], [30, 'League thrower'], [40, 'Bull seeker'], [48, 'Master of the line']];
export const rankFor = (score) => { let r = RANKS[0][1]; for (const [n, name] of RANKS) if (score >= n) r = name; return r; };

export const venueOwned = (rec, i) => (rec.wins | 0) >= VENUES[i].need;
export const axeOwned = (rec, k) => (rec.sticks | 0) >= AXES[k].need;

// tuning (the Rules page reads these)
export const TUNE = { velMin: 0.6, velMax: 1.4, swayRamp: 2.5, swayFloor: 0.45, deflect: STUCK_GAP, driftDivisor: 1 };

// ---- physics helpers -------------------------------------------------------------------------------------------------------
export const velOf = (p) => TUNE.velMin + (TUNE.velMax - TUNE.velMin) * p;
export const tmOf = (venue, axe) => VENUES[venue].tm * AXES[axe].spin;
export const turnsAt = (tm, p) => tm / velOf(p);
export const flightTime = (p) => FLIGHT / velOf(p);
export const windowOf = (level, axe) => LEVELS[level].win * AXES[axe].win;
export function stickErr(turns, axe) {
  const step = AXES[axe].dbl ? 0.5 : 1, f = turns / step;
  return Math.abs(f - Math.round(f)) * step;
}
// signed distance (in turns) to the nearest stick position; positive = turned too far (swing too slow)
export function stickDelta(turns, axe) {
  const step = AXES[axe].dbl ? 0.5 : 1, f = turns / step;
  return (f - Math.round(f)) * step;
}
// the swing marker, 0..1..0: sweeps up in period/2 seconds
export function meterP(mt, period) {
  const m = (mt / (period / 2)) % 2;
  return m <= 1 ? m : 2 - m;
}
export const windAt = (V, t) => (V.wind ? V.wind * (0.8 * Math.sin((t * Math.PI * 2) / V.windPeriod) + 0.2 * Math.sin((t * Math.PI * 2) / (V.windPeriod * 0.37) + 1)) : 0);
export const boardOffset = (V, t) => (V.rail ? V.rail * Math.sin((t * Math.PI * 2) / V.railPeriod) : 0);
export const swayAmp = (w) => LEVELS[w.level].sway * AXES[w.axe].sway;
export function sway(w, mt) {
  const a = swayAmp(w) * (TUNE.swayFloor + (1 - TUNE.swayFloor) * Math.min(1, mt / TUNE.swayRamp));
  const u = mt * 1.0;
  return { x: a * (Math.sin(u * 1.9) + 0.6 * Math.sin(u * 3.3 + 1.1)) / 1.6, y: a * (Math.cos(u * 1.45) + 0.5 * Math.sin(u * 2.9 + 2.0)) / 1.5 };
}

// the swing bands for this venue, axe and level: centre c, half width hw (all 0..1 of the meter), sorted by closeness to mid swing
export function bandsOf(w) {
  const tm = tmOf(w.venue, w.axe), win = windowOf(w.level, w.axe), step = AXES[w.axe].dbl ? 0.5 : 1, out = [];
  const nMax = Math.ceil((tm / TUNE.velMin) / step) + 1;
  for (let i = 1; i <= nMax; i++) {
    const n = i * step, v = tm / n, c = (v - TUNE.velMin) / (TUNE.velMax - TUNE.velMin);
    if (c < -0.03 || c > 1.03) continue;
    const hw = (win * v * v) / ((TUNE.velMax - TUNE.velMin) * tm);
    out.push({ n, c: clamp(c, 0, 1), hw, lo: clamp(c - hw, 0, 1), hi: clamp(c + hw, 0, 1) });
  }
  return out.sort((a, b) => Math.abs(a.c - 0.5) - Math.abs(b.c - 0.5));
}
export const inBand = (w, p) => bandsOf(w).some((b) => p >= b.lo && p <= b.hi);

export function pointsAt(x, y) {
  if (Math.abs(x) > HALF || Math.abs(y) > HALF) return { pts: 0, ring: -2 };
  for (let i = 0; i < CLUTCH.length; i++) { const c = CLUTCH[i]; if (Math.hypot(x - c.x, y - c.y) <= c.r) return { pts: c.pts, ring: 10 + i }; }
  const d = Math.hypot(x, y);
  for (let i = 0; i < RINGS.length; i++) if (d <= RINGS[i].r) return { pts: RINGS[i].pts, ring: i };
  return { pts: 0, ring: -1 };
}

// ---- the world --------------------------------------------------------------------------------------------------------------
// mode: match | daily | free | watch (watch plays a match with the game as "you")
export function makeWorld({ mode = 'match', venue = 0, level = 1, axe = 0, rival = null }) {
  const solo = mode === 'daily' || mode === 'free';
  return {
    mode, solo, endless: mode === 'free', venue, level, axe, rival: rival === null ? venue : rival,
    t: 0, phase: 'ready', wait: WAIT_READY, side: 'you', round: 0, turn: 0, sd: false,
    board: [], sc: { you: 0, rival: 0 }, cur: { you: 0, rival: 0 }, hist: [],
    aim: { down: false, x: 0, y: 90, mt: 0 }, rv: null, f: null, ev: [], over: false, result: null,
    throws: 0, sticks: 0, bulls: 0, clutch: 0, streak: 0, bounces: 0, best: 0, last: null, yourThrows: 0,
  };
}
export const throwsPerRound = (w) => (w.solo ? PER : w.sd ? 2 : PER * 2);
export const totalRounds = (w) => w.rounds ?? ROUNDS;
export const starter = (w) => (w.solo ? 'you' : w.round % 2 === 0 ? 'you' : 'rival');
export const sideFor = (w, turn) => (w.solo ? 'you' : (turn % 2 === 0) === (starter(w) === 'you') ? 'you' : 'rival');
export const youTotal = (w) => w.sc.you + w.cur.you;
export const rivalTotal = (w) => w.sc.rival + w.cur.rival;
export const axesLeft = (w, side) => {
  if (w.endless) return 99;
  const per = w.solo ? PER : w.sd ? 1 : PER;
  let used = 0;
  for (let k = 0; k < w.turn; k++) if (sideFor(w, k) === side) used++;
  return Math.max(0, per - used);
};

// Decide the whole throw at release time (no hidden randomness): where it lands and whether it sticks.
function resolve(w, side, rx, ry, p) {
  const V = VENUES[w.venue], tm = tmOf(w.venue, w.axe), tf = flightTime(p), turns = turnsAt(tm, p), tland = w.t + tf;
  const ix = rx + windAt(V, w.t), iy = ry, bo = boardOffset(V, tland), rel = { x: ix - bo, y: iy };
  const err = stickErr(turns, w.axe), win = windowOf(w.level, w.axe), delta = stickDelta(turns, w.axe);
  let out = 'stick', pts = 0, ring = -1;
  if (Math.abs(rel.x) > HALF + 20 || Math.abs(rel.y) > HALF + 20) out = 'miss';
  else if (err > win) out = 'bounce';
  else if (w.board.some((a) => Math.hypot(a.x - rel.x, a.y - rel.y) < STUCK_GAP)) out = 'deflect';
  else ({ pts, ring } = pointsAt(rel.x, rel.y));
  return { side, t: 0, dur: tf, p, turns, err, win, delta, rx, ry, ix, iy, bo, rel, out, pts, ring, w0: windAt(V, w.t) };
}

// ---- player input ---------------------------------------------------------------------------------------------------------
const lim = (v) => clamp(v, -HALF - 90, HALF + 90);
export function press(w, x, y) {
  if (w.phase !== 'aim' || w.side !== 'you' || w.over || w.aim.down) return false;
  const a = w.aim; a.down = true; a.x = lim(x); a.y = lim(y); a.mt = 0;
  w.ev.push({ type: 'grip' });
  return true;
}
export function move(w, x, y) { if (w.aim.down) { w.aim.x = lim(x); w.aim.y = lim(y); } }
export function release(w) {
  const a = w.aim;
  if (!a.down || w.phase !== 'aim' || w.side !== 'you') return false;
  a.down = false;
  if (a.mt < MIN_HOLD) { w.ev.push({ type: 'cancel' }); a.mt = 0; return false; }
  const p = meterP(a.mt, LEVELS[w.level].period), s = sway(w, a.mt);
  launch(w, resolve(w, 'you', a.x + s.x, a.y + s.y, p));
  return true;
}
function launch(w, f) {
  w.f = f; w.phase = 'flight'; w.throws++; if (f.side === 'you') w.yourThrows++;
  w.ev.push({ type: 'throw', side: f.side, p: f.p, turns: f.turns });
}

// The best free spot: the highest-scoring point that is clear of every stuck head (bull first, then points on the inner rings).
export function bestTarget(w, allowClutch = false) {
  const cand = [{ x: 0, y: 0 }];
  [[107, 0.2], [197, 0.6], [291, 0.1], [389, 0.5]].forEach(([r, off]) => { for (let k = 0; k < 8; k++) { const a = off + (k * Math.PI) / 4; cand.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); } });
  if (allowClutch) CLUTCH.forEach((c) => cand.push({ x: c.x, y: c.y }));
  let best = null;
  for (const c of cand) {
    if (w.board.some((a) => Math.hypot(a.x - c.x, a.y - c.y) < STUCK_GAP + 16)) continue;
    const pts = pointsAt(c.x, c.y).pts;
    if (!best || pts > best.pts || (pts === best.pts && Math.hypot(c.x, c.y) < Math.hypot(best.x, best.y))) best = { x: c.x, y: c.y, pts };
  }
  return best || { x: 0, y: 0, pts: 6 };
}

// ---- the rival -----------------------------------------------------------------------------------------------------------
const gauss = (rng) => (rng.next() + rng.next() + rng.next() - 1.5) * 2;
function planRival(w, rng) {
  const R = RIVALS[w.rival], L = LEVELS[w.level], V = VENUES[w.venue], skill = R.skill;
  const bands = bandsOf(w), band = bands[0] || { c: 0.5, hw: 0.1 };
  // choose a target: the bull, or a clutch spot when behind late in the match
  const bt = bestTarget(w);
  let tx = bt.x, ty = bt.y, gamble = false;
  const left = axesLeft(w, 'rival'), behind = youTotal(w) - rivalTotal(w);
  const late = (w.round >= totalRounds(w) - 1 || w.sd) && left <= 1;
  if (!w.solo && late && behind >= 5 && rng.next() < 0.35 + R.gamble * 0.6) { const c = CLUTCH[rng.next() < 0.5 ? 0 : 1]; tx = c.x; ty = c.y; gamble = true; }
  const dur = RIVAL_AIM + rng.next() * 0.5, tRel = w.t + dur;
  const pRaw = band.c + gauss(rng) * (1.12 - skill) * 0.2 * L.rival;
  const p = clamp(pRaw, 0, 1);
  const tf = flightTime(p), comp = 0.35 + 0.6 * skill, wind = windAt(V, tRel), bo = boardOffset(V, tRel + tf);
  const sa = (1.15 - skill) * 130 * L.rival * (gamble ? 0.8 : 1);
  const ax = tx + bo * comp - wind * comp + gauss(rng) * sa, ay = ty + gauss(rng) * sa * 0.8;
  const from = { x: (rng.next() - 0.5) * 300, y: 520 };
  return { t: 0, dur, ax: clamp(ax, -HALF - 80, HALF + 80), ay: clamp(ay, -HALF - 80, HALF + 80), p, gamble, from };
}

// ---- advice and the Watch & Learn player -------------------------------------------------------------------------------------
export function advise(w) {
  const V = VENUES[w.venue], L = LEVELS[w.level], bands = bandsOf(w);
  if (!bands.length) return null;
  const b = bands[0], tc = (b.c * L.period) / 2, tRel = w.t + tc, tf = flightTime(b.c);
  const wind = windAt(V, tRel), bo = boardOffset(V, tRel + tf), s = sway(w, tc);
  const bt = bestTarget(w), spot = bt.pts === 6 ? 'the bull' : `the ${bt.pts} ring${bt.y < -20 ? ' above' : bt.y > 20 ? ' below' : ''}${bt.x < -20 ? ' left' : bt.x > 20 ? ' right' : ''} of the bull`;
  const hx = bt.x + bo - wind, hy = bt.y;
  let why = `Aim at ${spot} and let go with the marker in the green band${bands.length > 1 ? ' (the one nearest the middle)' : ''}.`;
  const bits = [];
  if (Math.abs(wind) > 18) bits.push(`the wind pushes ${wind > 0 ? 'right' : 'left'}, so aim ${Math.round(Math.abs(wind) / 10) * 10} units ${wind > 0 ? 'left' : 'right'}`);
  if (Math.abs(bo) > 18) bits.push(`the board will be ${bo > 0 ? 'right' : 'left'} of centre when it arrives`);
  if (bits.length) why = `Aim at ${spot}: ${bits.join('; ')}. Let go with the marker in the green band.`;
  return { id: 'spot', tx: bt.x, ty: bt.y, hx, hy, x: hx - s.x, y: hy - s.y, p: b.c, tc, band: b, why };
}
export function newAuto() { return { cool: 0, plan: null, pref: null }; }
export function autoStep(w, ap, rng, dt) {
  if (w.phase !== 'aim' || w.side !== 'you' || w.over) { ap.plan = null; return; }
  const L = LEVELS[w.level];
  if (!w.aim.down) {
    if (ap.cool > 0) { ap.cool -= dt; return; }
    const a = advise(w); if (!a) return;
    const ex = gauss(rng) * 15, ey = gauss(rng) * 15, ep = gauss(rng) * a.band.hw * 0.25;
    ap.plan = { tcRel: ((a.p + ep) * L.period) / 2 };
    press(w, a.x + ex, a.y + ey);
    return;
  }
  if (ap.plan && w.aim.mt >= ap.plan.tcRel) { release(w); ap.plan = null; ap.cool = 0.25; }
}

// ---- time -------------------------------------------------------------------------------------------------------------------
function nextTurn(w) {
  const per = throwsPerRound(w);
  w.turn++;
  if (!w.endless && w.turn >= per) return endRound(w);
  if (w.endless && w.board.length >= 6) { w.ev.push({ type: 'clear' }); w.board.length = 0; }
  w.phase = 'ready'; w.wait = WAIT_READY; w.side = sideFor(w, w.turn); w.rv = null;
}
function endRound(w) {
  w.hist.push({ you: w.cur.you, rival: w.cur.rival, sd: w.sd });
  w.sc.you += w.cur.you; w.sc.rival += w.cur.rival;
  w.ev.push({ type: 'round', n: w.round + 1, you: w.cur.you, rival: w.cur.rival });
  w.cur = { you: 0, rival: 0 };
  let finishing;
  if (w.solo) finishing = w.round + 1 >= ROUNDS;
  else if (!w.sd && w.round + 1 < ROUNDS) finishing = false;
  else {
    finishing = w.sc.you !== w.sc.rival || w.hist.filter((h) => h.sd).length >= 3;
    if (!finishing) w.sd = true;
  }
  w.phase = 'round'; w.wait = WAIT_ROUND; w.finishing = finishing;
}
function startRound(w) {
  w.ev.push({ type: 'clear' }); w.board.length = 0;
  w.round++; w.turn = 0; w.side = sideFor(w, 0); w.phase = 'ready'; w.wait = WAIT_READY; w.rv = null;
}
function finish(w) {
  w.over = true; w.phase = 'over';
  const you = w.sc.you, rival = w.sc.rival;
  w.result = { you, rival, won: w.solo ? null : you > rival, draw: !w.solo && you === rival };
  w.ev.push({ type: 'over' });
}

function land(w) {
  const f = w.f, side = f.side;
  w.f = null;
  if (side === 'you') { w.last = { out: f.out, pts: f.pts, delta: f.delta, p: f.p, turns: f.turns, err: f.err, win: f.win }; }
  if (f.out === 'stick') {
    w.board.push({ born: w.t, x: f.rel.x, y: f.rel.y, side, ang: ((w.board.length * 0.61 + w.turn * 0.37) % 1) - 0.5, pts: f.pts, ring: f.ring });
    w.cur[side] += f.pts;
    if (side === 'you') {
      w.sticks++; w.streak++; w.best = Math.max(w.best, f.pts);
      if (f.ring === 0) w.bulls++;
      if (f.ring >= 10) w.clutch++;
    }
    w.ev.push({ type: 'stick', side, x: f.rel.x, y: f.rel.y, sx: f.ix, sy: f.iy, pts: f.pts, ring: f.ring, streak: w.streak, turns: f.turns });
  } else {
    if (side === 'you') { w.streak = 0; w.bounces++; }
    w.ev.push({ type: f.out, side, x: f.rel.x, y: f.rel.y, sx: f.ix, sy: f.iy, delta: f.delta, turns: f.turns });
  }
  w.phase = 'settle'; w.wait = WAIT_SETTLE;
}

export function stepWorld(w, dt, rng) {
  w.t += dt;
  if (w.over) return;
  if (w.phase === 'ready') {
    w.wait -= dt;
    if (w.wait <= 0) {
      w.phase = 'aim'; w.aim.down = false; w.aim.mt = 0;
      w.side = sideFor(w, w.turn);
      if (w.side === 'rival') w.rv = planRival(w, rng);
    }
  } else if (w.phase === 'aim') {
    if (w.side === 'you') { if (w.aim.down) w.aim.mt += dt; }
    else if (w.rv) {
      w.rv.t += dt;
      if (w.rv.t >= w.rv.dur) launch(w, resolve(w, 'rival', w.rv.ax, w.rv.ay, w.rv.p));
    }
  } else if (w.phase === 'flight') {
    w.f.t += dt;
    if (w.f.t >= w.f.dur) land(w);
  } else if (w.phase === 'settle') {
    w.wait -= dt;
    if (w.wait <= 0) nextTurn(w);
  } else if (w.phase === 'round') {
    w.wait -= dt;
    if (w.wait <= 0) { if (w.finishing) finish(w); else startRound(w); }
  }
}

// the reticle the player sees: the aim plus hand sway
export function reticle(w) {
  const a = w.aim;
  if (w.side === 'rival' && w.rv && w.phase === 'aim') {
    const k = clamp(w.rv.t / w.rv.dur, 0, 1), e = k * k * (3 - 2 * k);
    return { x: w.rv.from.x + (w.rv.ax - w.rv.from.x) * e, y: w.rv.from.y + (w.rv.ay - w.rv.from.y) * e, rival: true };
  }
  if (!a.down) return null;
  const s = sway(w, a.mt);
  return { x: a.x + s.x, y: a.y + s.y, rival: false };
}
