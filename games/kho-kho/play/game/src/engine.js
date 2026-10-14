// Kho-Kho: the rule book and the simulation. Pure and deterministic: no DOM, no clock, no randomness after a batch is set up.
// The court is in canonical units (see COURT). Everything the player can see is computed here; art.js and view.js only draw it.
//
// One BATCH is three runners against the chasing team for at most `limit` seconds. A turn is three batches.
//   mode 'chase'  the player steers the active chaser; the computer's runners evade
//   mode 'defend' the player steers one picked runner; the computer's chaser hunts
//   mode 'auto'   the computer does both (title attract screen and Auto Play)

export const COURT = { w: 640, h: 1000, x0: 70, x1: 570, y0: 90, y1: 910, spine: 320, end: 56 };
export const SEATS = 8;
export const RUNNERS = 3;
export const BATCHES = 2;          // batches in one turn (one team chasing)
export const INNINGS = 2;          // each team chases once per inning
export const HINTS = 6;
export const TAG = 28;             // centre distance at which a touch counts
export const KHO_REACH = 46;       // how close to a seat's back the chaser must be to give Kho
export const HINT_FREEZE = 2.4;    // seconds the world is held while a hint is shown
export const CHASER_SPEED = 232;
export const TURN_TIME = 0.9;       // seconds a full about-turn costs a chaser at speed
export const CHASER_ACCEL = 620, RUNNER_ACCEL = 1100;
export const BODY = 14;
const LANE_SAFE = 150, KHO_FEAR = 0.9;   // runners keep off the lane when the chaser can give Kho            // keep this far from the central lane

export const LEVELS = [
  { name: 'Village', runner: 192, limit: 32, lead: 0.25, think: 0.5, kho: 0, cspeed: 0.4, dirs: 8, look: 0.9, react: 0.32 },
  { name: 'School', runner: 214, limit: 30, lead: 0.6, think: 0.3, kho: 0, cspeed: 0.48, dirs: 12, look: 1.3, react: 0.22 },
  { name: 'Champions', runner: 238, limit: 25, lead: 1.0, think: 0.16, kho: 0.25, cspeed: 0.6, dirs: 16, look: 1.7, react: 0.14 },
];

export const SEAT_Y = Array.from({ length: SEATS }, (_, i) => COURT.y0 + COURT.end + (i + 0.5) * ((COURT.y1 - COURT.y0 - 2 * COURT.end) / SEATS));
export const POLE_Y = [COURT.y0 + 26, COURT.y1 - 26];

const hypot = Math.hypot, sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const inEnd = (y) => y <= COURT.y0 + COURT.end || y >= COURT.y1 - COURT.end;
const sideOf = (x) => (x < COURT.spine ? -1 : 1);

// ---------------------------------------------------------------- set-up
// `opts`: { level, mode, index (batch number in the turn), inning }
export function newBatch(rng, opts = {}) {
  const lvl = LEVELS[opts.level ?? 0] ?? LEVELS[0];
  const lvlC = LEVELS[opts.cl ?? opts.level ?? 0] ?? lvl, lvlR = LEVELS[opts.rl ?? opts.level ?? 0] ?? lvl;
  const seats = SEAT_Y.map((y, i) => ({ i, y, face: i % 2 === 0 ? 1 : -1 }));   // face +1 looks at the right half, -1 at the left
  // runners are spread over the court; at least one on each half, none right next to the chaser's start
  const runners = [];
  const slots = rng.shuffle([0, 1, 2]);
  for (let k = 0; k < RUNNERS; k++) {
    const band = slots[k];
    const y = COURT.y0 + COURT.end + 250 + band * 150 + rng.range(-40, 40);
    const half = k === 0 ? -1 : k === 1 ? 1 : (rng.chance(0.5) ? -1 : 1);
    const x = COURT.spine + half * rng.range(70, 210);
    runners.push({ id: k, x, y, vx: 0, vy: 0, tx: x, ty: y, out: false, outT: 0, ang: Math.PI, phase: k * 1.7, moving: false, plan: null, planT: 0.05 * k });
  }
  const start = (opts.index ?? 0) % 2 === 0 ? 0 : 1;      // the chaser starts at the pole the batch number picks
  const ay = POLE_Y[start] + (start === 0 ? 8 : -8);
  const active = { x: COURT.spine - 24 + 48 * (((opts.index ?? 0) + (opts.inning ?? 0)) % 2), y: ay, vx: 0, vy: 0, lock: 0, dyAcc: 0, ang: start === 0 ? Math.PI : 0, phase: 0, moving: false, seat: -1, tx: null, ty: null };
  return {
    mode: opts.mode ?? 'chase', level: opts.level ?? 0, lvl, lvlC, lvlR, cspeed: (opts.mode ?? 'chase') === 'chase' ? CHASER_SPEED : CHASER_SPEED * lvlC.cspeed, t: 0, limit: lvl.limit, seats, active, runners, sel: 1,
    outs: 0, khos: 0, timeSum: 0, result: null, ev: [], hintT: 0, plan: null, planT: 0, ai: { khoSeat: -1 }, trail: [],
  };
}

// ---------------------------------------------------------------- rules that the player can query
export function legalKho(b, j) {
  const a = b.active, s = b.seats[j];
  if (!s) return false;
  if (Math.abs(a.y - s.y) > KHO_REACH) return false;
  if (Math.abs(a.x - COURT.spine) > 88) return false;
  if (inEnd(a.y)) return false;
  // the chaser must reach the BACK of the seated player: the side the seat does not face
  const dx = a.x - COURT.spine;
  return dx * s.face < 0 || Math.abs(dx) < 1;
}
export const legalSeats = (b) => b.seats.filter((s) => legalKho(b, s.i)).map((s) => s.i);

// A chaser at (x, y) with lock `lock` is not allowed to move towards the side it came from.
const reverseBlocked = (lock, dy) => lock !== 0 && dy * lock < -1;

export function giveKho(b, j) {
  if (b.result || !legalKho(b, j)) return false;
  const a = b.active, s = b.seats[j];
  const f = s.face;
  // the seated player gets up and runs; the old chaser sits in that place, facing the same way
  b.khos += 1;
  b.ev.push({ t: 'kho', seat: j, x: COURT.spine, y: s.y, face: f });
  a.x = COURT.spine + f * (BODY + 6); a.y = s.y; a.vx = 0; a.vy = 0; a.lock = 0; a.dyAcc = 0; a.seat = j; a.tx = null; a.ty = null;
  a.ang = f > 0 ? Math.PI / 2 : -Math.PI / 2;
  b.plan = null; b.planT = 0; b.ai.khoSeat = -1;
  return true;
}

// ---------------------------------------------------------------- estimating times (shared by both computer players)
// Seconds the chaser needs to be able to touch point q (same half, or after a Kho). `lead` shifts nothing; it is a pure distance model.
// turning costs time: a chaser at full speed needs a moment to swing round to a new heading
function turnCost(a, qx, qy) {
  const sp = hypot(a.vx, a.vy);
  if (sp < 30) return 0;
  const dx = qx - a.x, dy = qy - a.y, d = hypot(dx, dy) || 1;
  const cos = (a.vx * dx + a.vy * dy) / (sp * d);
  return (1 - cos) * 0.5 * (sp / CHASER_SPEED) * TURN_TIME;
}
function directTime(a, qx, qy, speed) {
  const dy = qy - a.y;
  const sameSide = inEnd(a.y) || inEnd(qy) || sideOf(a.x) === sideOf(qx) || Math.abs(qx - COURT.spine) < TAG * 0.5;
  if (!sameSide) return Infinity;
  if (reverseBlocked(a.lock, dy) && Math.abs(dy) > 14) {
    // would have to turn back: run on to the pole, round it and return
    const endY = a.lock > 0 ? COURT.y1 - COURT.end : COURT.y0 + COURT.end;
    return (Math.abs(endY - a.y) + Math.abs(endY - qy) + Math.abs(qx - a.x)) / speed + 0.35;
  }
  return hypot(qx - a.x, dy) / speed + turnCost(a, qx, qy);
}
export function chaseTime(b, qx, qy, speed = b.cspeed) {
  const a = b.active;
  let best = directTime(a, qx, qy, speed), seat = -1;
  for (const s of b.seats) {
    // reaching the back of seat s from the half the chaser is on now
    const dxs = a.x - COURT.spine;
    const onBack = inEnd(a.y) || dxs * s.face < 0 || Math.abs(dxs) < 1;
    if (!onBack) continue;
    if (reverseBlocked(a.lock, s.y - a.y) && Math.abs(s.y - a.y) > 14) continue;
    const px = COURT.spine - s.face * (BODY + 14), py = s.y;
    const t1 = hypot(px - a.x, py - a.y) / speed + 0.16;
    // after the Kho the new chaser stands on the side the seat faces
    if (sideOf(qx) !== s.face && Math.abs(qx - COURT.spine) > TAG * 0.5) continue;
    const t2 = hypot(qx - (COURT.spine + s.face * (BODY + 6)), qy - s.y) / speed;
    if (t1 + t2 < best) { best = t1 + t2; seat = s.i; }
  }
  return { time: best, seat };
}

// ---------------------------------------------------------------- the computer chaser
// Returns { kind: 'chase', rid, x, y } or { kind: 'kho', seat, rid, x, y } : where to run and what to do.
export function planChaser(b) {
  const a = b.active, L = b.lvlC;
  let best = null;
  for (const r of b.runners) {
    if (r.out) continue;
    // lead the runner by what it is doing now
    const d = hypot(r.x - a.x, r.y - a.y), tl = Math.min(0.9, d / b.cspeed) * L.lead;
    const qx = clamp(r.x + r.vx * tl, COURT.x0 + 12, COURT.x1 - 12), qy = clamp(r.y + r.vy * tl, COURT.y0 + 12, COURT.y1 - 12);
    const direct = directTime(a, qx, qy, b.cspeed);
    if (Number.isFinite(direct) && (!best || direct < best.time)) best = { time: direct, kind: 'chase', rid: r.id, x: qx, y: qy, seat: -1 };
    if (L.kho > 0) {
      const c = chaseTime(b, qx, qy);
      if (c.seat >= 0 && (!best || c.time * (2 - L.kho) < best.time)) {
        const s = b.seats[c.seat];
        best = { time: c.time, kind: 'kho', rid: r.id, x: COURT.spine - s.face * (BODY + 14), y: s.y, seat: c.seat };
      }
    }
  }
  if (!best) {
    // nothing reachable at all: run to the pole end the lock allows
    const y = a.lock > 0 ? COURT.y1 - COURT.end : COURT.y0 + COURT.end;
    return { kind: 'chase', rid: -1, x: a.x, y, time: 0, seat: -1 };
  }
  return best;
}

// ---------------------------------------------------------------- the computer runner
// A runner looks a short way ahead: for each direction it could run it plays the next moments out (the chaser hunting as the
// computer chaser would) and keeps the direction that is touched last, or never.
function cloneForRollout(b) {
  return {
    ...b, active: { ...b.active }, runners: b.runners.map((r) => ({ ...r, plan: null })), ev: [], plan: b.plan ? { ...b.plan } : null,
    mode: 'auto', noPlan: true, result: null, trail: null,
  };
}
// How far a runner could run straight away from the chaser before it hits the boundary (a dead end is no escape).
function awayRoom(me, a) {
  let ux = me.x - a.x, uy = me.y - a.y; const d = hypot(ux, uy) || 1; ux /= d; uy /= d;
  const tx = ux > 0.01 ? (COURT.x1 - me.x) / ux : ux < -0.01 ? (COURT.x0 - me.x) / ux : 1e9;
  const ty = uy > 0.01 ? (COURT.y1 - me.y) / uy : uy < -0.01 ? (COURT.y0 - me.y) / uy : 1e9;
  return Math.min(Math.min(tx, ty), 300);
}
function planRunner(b, r) {
  const L = b.lvlR, a = b.active;
  const nDir = L.dirs, horizon = L.look, dtR = 0.05, steps = Math.round(horizon / dtR);
  let best = null;
  const tryDir = (qx, qy) => {
    const c = cloneForRollout(b);
    const me = c.runners[r.id];
    me.tx = qx; me.ty = qy;
    let capT = -1, minD = 1e9;
    for (let k = 0; k < steps; k++) {
      step(c, dtR);
      if (me.out) { capT = c.t; break; }
      minD = Math.min(minD, hypot(me.x - c.active.x, me.y - c.active.y));
    }
    const wall = Math.min(me.x - COURT.x0, COURT.x1 - me.x, me.y - COURT.y0, COURT.y1 - me.y);
    const corner = Math.min(me.x - COURT.x0, COURT.x1 - me.x) + Math.min(me.y - COURT.y0, COURT.y1 - me.y);
    let score;
    if (capT >= 0) score = capT * 120 - 400;
    else {
      const tc = Math.min(chaseTime(c, me.x, me.y).time, 3.5);
      score = tc * 70 + Math.min(wall, 120) * 0.9 + Math.min(corner, 220) * 0.25 + Math.min(minD, 220) * 0.15 + awayRoom(me, c.active) * 0.5
        - Math.max(0, LANE_SAFE - Math.abs(me.x - COURT.spine)) * KHO_FEAR * (a.lock === 0 ? 0.5 : 1);   // a Kho puts the chaser on the lane in a blink: stay off it
    }
    if (!best || score > best.score) best = { score, x: qx, y: qy };
  };
  for (let k = 0; k < nDir; k++) {
    const an = (k / nDir) * Math.PI * 2;
    tryDir(clamp(r.x + Math.cos(an) * 160, COURT.x0 + 14, COURT.x1 - 14), clamp(r.y + Math.sin(an) * 160, COURT.y0 + 14, COURT.y1 - 14));
  }
  tryDir(r.x, r.y);
  return best;
}

// ---------------------------------------------------------------- one tick
// cmd (only the fields you have): { target: {x,y} for the human-controlled mover, sel: runner id, kho: seat }
export function setTarget(b, x, y) {
  const tx = clamp(x, COURT.x0 + 8, COURT.x1 - 8), ty = clamp(y, COURT.y0 + 8, COURT.y1 - 8);
  if (b.mode === 'chase') { b.active.tx = tx; b.active.ty = ty; }
  else if (b.mode === 'defend') { const r = b.runners[b.sel]; if (r && !r.out) { r.tx = tx; r.ty = ty; r.human = true; } }
}
export function selectRunner(b, id) { const r = b.runners[id]; if (r && !r.out) { b.sel = id; return true; } return false; }
export function nextRunner(b) {
  for (let k = 1; k <= RUNNERS; k++) { const r = b.runners[(b.sel + k) % RUNNERS]; if (!r.out) { b.sel = r.id; return; } }
}

const approach = (v, to, d) => (v < to ? Math.min(to, v + d) : Math.max(to, v - d));

function moveChaser(b, dt, tx, ty) {
  const a = b.active, C = COURT;
  let dx = 0, dy = 0;
  if (tx != null) {
    // a target behind a locked chaser: run on to the pole, round it (the lock clears there) and come back
    if (a.lock !== 0 && (ty - a.y) * a.lock < -14 && !inEnd(a.y)) ty = a.lock > 0 ? C.y1 - C.end + 6 : C.y0 + C.end - 6;
    dx = tx - a.x; dy = ty - a.y;
    const d = hypot(dx, dy);
    if (d < 4) { dx = 0; dy = 0; } else { dx /= d; dy /= d; }
  }
  // no turning back: a chaser who has committed to a direction cannot run the other way
  // (dy is a unit-vector component here, so the test is on its sign, not on the 1-unit slack used for distances)
  if (a.lock !== 0 && dy * a.lock < -0.02) { dy = 0; const m = Math.abs(dx); dx = m > 0.25 ? sgn(dx) : 0; }
  const want = b.cspeed;
  const wvx = dx * want, wvy = dy * want, acc = 1500 * dt;
  a.vx = approach(a.vx, wvx, acc); a.vy = approach(a.vy, wvy, acc);
  // the run commits the lock after a few units of travel in one direction
  let nx = a.x + a.vx * dt, ny = clamp(a.y + a.vy * dt, C.y0 + 10, C.y1 - 10);
  if (Math.abs(a.vy) > 20) { a.dyAcc += a.vy * dt; if (a.lock === 0 && Math.abs(a.dyAcc) > 16) a.lock = sgn(a.dyAcc); }
  if (!inEnd(ny)) {
    if (a.x < C.spine || (a.x === C.spine && nx <= C.spine)) nx = Math.min(nx, C.spine - BODY);
    else nx = Math.max(nx, C.spine + BODY);
    // came out of the end zone onto one side: keep that side
  }
  // rounding the pole: in the end zone the lock is cleared and the chaser may cross
  if (inEnd(ny)) { a.lock = 0; a.dyAcc = 0; }
  nx = clamp(nx, C.x0 + 10, C.x1 - 10);
  a.moving = hypot(a.vx, a.vy) > 25;
  if (a.moving) { a.ang = Math.atan2(a.vx, -a.vy); a.phase += dt * hypot(a.vx, a.vy) / 22; }
  a.x = nx; a.y = ny;
}

function moveRunner(b, r, dt, speed) {
  let dx = r.tx - r.x, dy = r.ty - r.y;
  const d = hypot(dx, dy);
  if (d < 4) { dx = 0; dy = 0; } else { dx /= d; dy /= d; }
  const acc = RUNNER_ACCEL * dt;
  r.vx = approach(r.vx, dx * speed, acc); r.vy = approach(r.vy, dy * speed, acc);
  r.x = clamp(r.x + r.vx * dt, COURT.x0 + 10, COURT.x1 - 10);
  r.y = clamp(r.y + r.vy * dt, COURT.y0 + 10, COURT.y1 - 10);
  r.moving = hypot(r.vx, r.vy) > 25;
  if (r.moving) { r.ang = Math.atan2(r.vx, -r.vy); r.phase += dt * hypot(r.vx, r.vy) / 20; }
}

export function step(b, dt) {
  if (b.result) return;
  const LC = b.lvlC, LR = b.lvlR;
  b.t += dt;
  // ---- the chaser
  if (b.mode !== 'chase') {
    b.planT -= dt;
    if (b.planT <= 0) {
      const p = planChaser(b), cur = b.plan;
      // keep the current plan unless the new one is clearly better (no dithering)
      if (!cur || cur.kind !== p.kind || cur.rid !== p.rid || cur.seat !== p.seat) {
        if (!cur || p.time < cur.time * 0.85 || b.runners[cur.rid]?.out || cur.rid < 0) b.plan = p; else { cur.x = p.x; cur.y = p.y; }
      } else b.plan = p;
      b.planT = LC.think;
    } else if (b.plan && b.plan.kind === 'chase') {
      const r = b.runners[b.plan.rid];
      if (r && !r.out) { b.plan.x = clamp(r.x + r.vx * 0.2, COURT.x0 + 12, COURT.x1 - 12); b.plan.y = clamp(r.y + r.vy * 0.2, COURT.y0 + 12, COURT.y1 - 12); }
    }
    const p = b.plan;
    if (p) {
      if (p.kind === 'kho' && legalKho(b, p.seat)) { giveKho(b, p.seat); }
      else moveChaser(b, dt, p.x, p.y);
    } else moveChaser(b, dt, null, null);
  } else moveChaser(b, dt, b.active.tx, b.active.ty);
  const a = b.active;
  if (a.tx != null && hypot(a.tx - a.x, a.ty - a.y) < 5) { a.tx = null; a.ty = null; }
  // ---- the runners
  for (const r of b.runners) {
    if (r.out) continue;
    const human = b.mode === 'defend' && r.id === b.sel;
    if (!human && !b.noPlan) {
      r.planT -= dt;
      if (r.planT <= 0) { const p = planRunner(b, r); r.tx = p.x; r.ty = p.y; r.planT = LR.react + 0.03 * r.id; }
    }
    moveRunner(b, r, dt, LR.runner);
  }
  // ---- touches
  for (const r of b.runners) {
    if (r.out) continue;
    const d = hypot(r.x - a.x, r.y - a.y);
    if (d > TAG) continue;
    const same = inEnd(a.y) || inEnd(r.y) || sideOf(a.x) === sideOf(r.x) || Math.abs(r.x - COURT.spine) < TAG * 0.4;
    if (!same) continue;
    r.out = true; r.outT = b.t; b.outs += 1; b.timeSum += b.t;
    b.ev.push({ t: 'tag', id: r.id, x: r.x, y: r.y });
    r.vx = 0; r.vy = 0; r.moving = false;
    if (b.mode === 'defend' && b.sel === r.id) nextRunner(b);
  }
  if (b.outs >= RUNNERS) b.result = { kind: 'cleared', outs: b.outs, time: b.t };
  else if (b.t >= b.limit) b.result = { kind: 'time', outs: b.outs, time: b.limit };
}

// The advice a hint shows for a human: what the computer would do now.
export function advise(b) {
  if (b.mode === 'chase') return planChaser(b);
  const r = b.runners[b.sel];
  if (!r || r.out) return null;
  const p = planRunner(b, r);
  return { kind: 'run', x: p.x, y: p.y, rid: r.id };
}

// Quick offline simulation used by the tuning script and the tests: computer vs computer.
export function simulate(rng, opts = {}) {
  const b = newBatch(rng, { ...opts, mode: 'auto' });
  let guard = 0;
  while (!b.result && guard++ < 20000) { step(b, 1 / 60); b.ev.length = 0; }
  return b;
}
