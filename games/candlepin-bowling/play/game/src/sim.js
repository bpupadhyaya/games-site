// Candlepin physics, in metres. Pure and deterministic: no clock, no random numbers (the caller passes any jitter in).
// Lane geometry: x across (0 = centre, + = right of the bowler), y down the lane from the foul line (y = 0) to the head pin.
//
// Bodies: ONE ball (a light, hole-less, hand-sized sphere, almost as heavy as a pin) and ten pins. A pin is a circle while it
// stands. The first real touch tips it over: from then on it is a capsule (a lying pin) that slides, spins, bounces off the
// kickback boards and knocks other pins. A lying pin that stays on the deck is "wood": it is an obstacle and a deflector for
// every later ball of the frame. Pins and balls that reach a gutter or the pit leave play.

export const LANE = {
  halfW: 0.527,        // half width of the playing surface (41.5 in lane)
  headY: 18.29,        // foul line to head pin (60 ft)
  deckStart: 17.7,     // where the kickback boards begin
  deckHalf: 0.62,      // kickback board position
  pitY: 19.55,         // behind the last row: the pit
  gutterX: 0.58,       // centre of a gutter
  ballR: 0.057,        // 4.5 in ball
  pinR: 0.034,         // standing pin, widest part
  pinH: 0.387,         // 15.25 in
  woodHL: 0.15,        // lying pin: half length of the capsule axis
  woodR: 0.03,         // lying pin: capsule radius
};
export const BALL_M = 1.1, PIN_M = 1.0;
export const PACES = [{ id: 0, name: 'Soft', v: 6.9 }, { id: 1, name: 'Firm', v: 8.7 }, { id: 2, name: 'Fast', v: 10.7 }];
export const CURVE_A = 0.12;       // sideways acceleration per curve step (m/s^2)
export const MAX_CURVE = 2;
export const DT = 1 / 240;

const ROW = 0.264, COL = 0.3048;
// pin 1 is the head pin; rows of 1, 2, 3, 4
export const PIN_XY = [
  [0, 0], [-COL / 2, ROW], [COL / 2, ROW], [-COL, 2 * ROW], [0, 2 * ROW], [COL, 2 * ROW],
  [-1.5 * COL, 3 * ROW], [-COL / 2, 3 * ROW], [COL / 2, 3 * ROW], [1.5 * COL, 3 * ROW],
].map(([x, y]) => [x, LANE.headY + y]);

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const E_BALL_PIN = 0.5, E_PIN_PIN = 0.4, E_WALL = 0.35, MU_C = 0.22;
const SLIDE = 4.4;            // sliding friction deceleration of a lying pin (m/s^2)
const INV_I_WOOD = 1 / (PIN_M * (LANE.woodHL * LANE.woodHL / 3 + LANE.woodR * LANE.woodR / 2));

// ---- world ---------------------------------------------------------------------------------------
export function newRack() {
  return PIN_XY.map(([x, y], i) => ({ i, x, y, vx: 0, vy: 0, a: 0, w: 0, s: 0, wood: 0 }));
}
// s: 0 standing, 1 lying on the deck (wood), 2 gone (gutter / pit / off the back)
export function createWorld(pins = null) {
  return { ball: null, pins: pins ?? newRack(), t: 0, settled: true, idle: 0, ev: [], hits: 0 };
}
export function cloneWorld(w) {
  return { ball: w.ball ? { ...w.ball } : null, pins: w.pins.map((p) => ({ ...p })), t: w.t, settled: w.settled, idle: w.idle, ev: [], hits: w.hits };
}
export const standingCount = (w) => { let n = 0; for (const p of w.pins) if (p.s === 0) n++; return n; };
export const standingMask = (w) => w.pins.map((p) => (p.s === 0 ? 1 : 0));

// New rack with the given standing set and optional lying pins [{ i, x, y, a }] (puzzles, tests).
export function layout(standing, wood = []) {
  const pins = newRack();
  pins.forEach((p) => { p.s = 2; });
  for (const i of standing) pins[i].s = 0;
  for (const wd of wood) { const p = pins[wd.i]; p.s = 1; p.wood = 1; p.x = wd.x; p.y = wd.y; p.a = wd.a ?? 0; }
  return pins;
}

// Everything the player decides: start x on the foul line, aim x at the head-pin distance, pace, curve.
// Solves the launch heading so the path passes through (aimX, headY) whatever the curve; returns the ball.
export function aimHeading(x0, aimX, v, curve) {
  // path: x(y) with constant sideways accel ax: heading th, time to reach headY ~ headY / (v cos th)
  const ax = curve * CURVE_A;
  let th = Math.atan2(aimX - x0, LANE.headY);
  for (let k = 0; k < 6; k++) {
    const vy = v * Math.cos(th), t = LANE.headY / Math.max(0.5, vy);
    const x = x0 + v * Math.sin(th) * t + 0.5 * ax * t * t;
    const err = aimX - x;
    th += err / LANE.headY * 1.0;
  }
  return th;
}
export function newBall(x0, aimX, pace, curve, jitter = null) {
  const v = PACES[pace].v * (jitter ? 1 + jitter.v : 1);
  const th = aimHeading(x0, aimX + (jitter ? jitter.x : 0), PACES[pace].v, curve) + (jitter ? jitter.a : 0);
  return { x: x0, y: 0, vx: v * Math.sin(th), vy: v * Math.cos(th), ax: curve * CURVE_A, r: LANE.ballR, live: 1, gut: 0, gone: 0, rot: 0, slow: 0, lastHit: 0 };
}
export function launch(w, ball) {
  w.ball = ball; w.settled = false; w.idle = 0; w.hits = 0;
  for (const p of w.pins) if (p.s === 1) { p.vx = 0; p.vy = 0; p.w = 0; }
}

// Ball-only path preview (ignores pins): points every `stepY` metres until the head pin line.
export function previewPath(x0, aimX, pace, curve, stepY = 0.5) {
  const b = newBall(x0, aimX, pace, curve), pts = [[b.x, b.y]];
  let nextY = stepY;
  while (b.y < LANE.headY + 0.3) {
    b.vx += b.ax * DT; b.x += b.vx * DT; b.y += b.vy * DT;
    if (b.y >= nextY) { pts.push([b.x, b.y]); nextY += stepY; }
  }
  const gutter = pts.some(([x, y]) => y < LANE.deckStart && Math.abs(x) > LANE.halfW - 0.01);
  return { pts, gutter };
}

// ---- geometry helpers -----------------------------------------------------------------------------
const ends = (p) => { const c = Math.cos(p.a) * LANE.woodHL, s = Math.sin(p.a) * LANE.woodHL; return [p.x - c, p.y - s, p.x + c, p.y + s]; };
function closestOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return [ax + dx * t, ay + dy * t];
}
function segSeg(a0x, a0y, a1x, a1y, b0x, b0y, b1x, b1y) {
  const d1x = a1x - a0x, d1y = a1y - a0y, d2x = b1x - b0x, d2y = b1y - b0y, rx = a0x - b0x, ry = a0y - b0y;
  const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry;
  const c = d1x * rx + d1y * ry, b = d1x * d2x + d1y * d2y, den = a * e - b * b;
  let s = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0, t = (b * s + f) / e;
  if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
  return [a0x + d1x * s, a0y + d1y * s, b0x + d2x * t, b0y + d2y * t];
}

// Impulse between two bodies a, b at point (px, py) with normal n from a to b. A "body" is { x, y, vx, vy, w, im, ii }.
function contact(a, b, px, py, nx, ny, pen, e, kind, w) {
  const rax = px - a.x, ray = py - a.y, rbx = px - b.x, rby = py - b.y;
  const vax = a.vx - a.w * ray, vay = a.vy + a.w * rax, vbx = b.vx - b.w * rby, vby = b.vy + b.w * rbx;
  const rvx = vbx - vax, rvy = vby - vay, vn = rvx * nx + rvy * ny;
  const ran = rax * ny - ray * nx, rbn = rbx * ny - rby * nx;
  const k = a.im + b.im + ran * ran * a.ii + rbn * rbn * b.ii;
  if (k <= 0) return 0;
  // push apart
  if (pen > 0) {
    const sa = a.im / (a.im + b.im), sb = 1 - sa, c = pen + 0.0005;
    a.x -= nx * c * sa; a.y -= ny * c * sa; b.x += nx * c * sb; b.y += ny * c * sb;
  }
  if (vn >= 0) return 0;
  const j = -(1 + e) * vn / k;
  a.vx -= j * nx * a.im; a.vy -= j * ny * a.im; a.w -= (rax * ny - ray * nx) * j * a.ii;
  b.vx += j * nx * b.im; b.vy += j * ny * b.im; b.w += (rbx * ny - rby * nx) * j * b.ii;
  // a little Coulomb friction along the contact
  const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty, rat = rax * ty - ray * tx, rbt = rbx * ty - rby * tx;
  const kt = a.im + b.im + rat * rat * a.ii + rbt * rbt * b.ii;
  if (kt > 0) {
    const jt = clamp(-vt / kt, -MU_C * j, MU_C * j);
    a.vx -= jt * tx * a.im; a.vy -= jt * ty * a.im; a.w -= (rax * ty - ray * tx) * jt * a.ii;
    b.vx += jt * tx * b.im; b.vy += jt * ty * b.im; b.w += (rbx * ty - rby * tx) * jt * b.ii;
  }
  if (w && -vn > 0.25) w.ev.push({ t: 'hit', k: kind, v: -vn, x: px, y: py });
  return -vn;
}

const asBody = (o, im, ii) => { o.im = im; o.ii = ii; return o; };

function standDown(p, nx, ny) {
  // a pin that has just been struck lies down along its direction of travel
  const sp = Math.hypot(p.vx, p.vy);
  p.s = 1; p.wood = 1;
  p.a = sp > 0.15 ? Math.atan2(p.vy, p.vx) : Math.atan2(ny, nx);
}

function pinGone(p, why, ev) { p.s = 2; p.vx = p.vy = p.w = 0; ev.push({ t: why, x: p.x, y: p.y }); }
const WALL = { x: 0, y: 0, vx: 0, vy: 0, w: 0, im: 0, ii: 0 };
function boardPush(p, ex, ey, w) {
  const over = Math.abs(ex) + LANE.woodR - LANE.deckHalf;
  if (over <= 0) return;
  const sgn = Math.sign(ex);
  WALL.x = ex + sgn * 1; WALL.y = ey; WALL.vx = 0; WALL.vy = 0; WALL.w = 0;
  asBody(p, 1 / PIN_M, INV_I_WOOD);
  contact(WALL, p, ex, ey, -sgn, 0, 0, E_WALL, 'board', w);
  p.x -= sgn * over;
}

// ---- one fixed step ---------------------------------------------------------------------------------
export function step(w, dt = DT) {
  w.t += dt;
  const b = w.ball, pins = w.pins, ev = w.ev;
  // integrate the ball
  if (b && b.live) {
    if (!b.gut) { b.vx += b.ax * dt; }
    b.x += b.vx * dt; b.y += b.vy * dt; b.rot += Math.hypot(b.vx, b.vy) * dt / b.r;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0.01) { const k = Math.max(0, 1 - 0.035 * dt); b.vx *= k; b.vy *= k; }
    if (!b.gut && b.y < LANE.deckStart && Math.abs(b.x) > LANE.halfW + 0.005) { b.gut = Math.sign(b.x); b.vx = 0; ev.push({ t: 'gutter', x: b.x, y: b.y }); }
    if (b.gut) { b.x += (b.gut * LANE.gutterX - b.x) * Math.min(1, 14 * dt); b.vx = 0; b.ax = 0; }
    else if (b.y >= LANE.deckStart) {
      if (b.x > LANE.deckHalf - b.r) { b.x = LANE.deckHalf - b.r; if (b.vx > 0) { b.vx = -b.vx * E_WALL; ev.push({ t: 'wall', v: 1, x: b.x, y: b.y }); } }
      if (b.x < -LANE.deckHalf + b.r) { b.x = -LANE.deckHalf + b.r; if (b.vx < 0) { b.vx = -b.vx * E_WALL; ev.push({ t: 'wall', v: 1, x: b.x, y: b.y }); } }
      if (b.vy < 0 && b.y < LANE.deckStart + 0.1) b.vy = Math.abs(b.vy);
    }
    if (b.y > LANE.pitY) { b.live = 0; b.gone = 1; ev.push({ t: 'pit', x: b.x, y: b.y, ball: 1 }); }
    if (sp < 0.35 && b.y > 1) { b.slow += dt; if (b.slow > 0.6) { b.live = 0; b.gone = 1; } } else b.slow = 0;
  }
  // integrate lying pins
  for (const p of pins) {
    if (p.s !== 1) continue;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 0) {
      const d = Math.min(sp, SLIDE * dt);
      p.vx -= (p.vx / sp) * d; p.vy -= (p.vy / sp) * d;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    if (p.w !== 0) { p.a += p.w * dt; const wd = Math.min(Math.abs(p.w), 9 * dt); p.w -= Math.sign(p.w) * wd; }
  }
  // ball vs pins
  if (b && b.live && !b.gut) {
    const ballBody = asBody(b, 1 / BALL_M, 0); ballBody.w = 0;
    for (const p of pins) {
      if (p.s === 2) continue;
      if (p.s === 0) {
        const dx = p.x - b.x, dy = p.y - b.y, rr = b.r + LANE.pinR, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
        const pb = asBody(p, 1 / PIN_M, 0); pb.w = 0;
        contact(ballBody, pb, b.x + nx * b.r, b.y + ny * b.r, nx, ny, rr - d, E_BALL_PIN, 'bp', w);
        standDown(p, nx, ny); p.w = (nx * b.vy - ny * b.vx) * -0.8; b.lastHit = w.t; w.hits++;
      } else {
        const [ax, ay, bx, by] = ends(p);
        const [qx, qy] = closestOnSeg(b.x, b.y, ax, ay, bx, by);
        const dx = qx - b.x, dy = qy - b.y, rr = b.r + LANE.woodR, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
        const pb = asBody(p, 1 / PIN_M, INV_I_WOOD);
        contact(ballBody, pb, b.x + nx * b.r, b.y + ny * b.r, nx, ny, rr - d, E_BALL_PIN, 'bw', w);
        b.lastHit = w.t;
      }
    }
  }
  // pins vs pins (lying pin against standing or lying pins)
  for (let i = 0; i < pins.length; i++) {
    const p = pins[i];
    if (p.s !== 1) continue;
    const [ax, ay, bx, by] = ends(p);
    for (let j = 0; j < pins.length; j++) {
      const q = pins[j];
      if (j === i || q.s === 2) continue;
      if (q.s === 1) {
        if (j < i) continue;
        const dx = q.x - p.x, dy = q.y - p.y;
        if (dx * dx + dy * dy > 0.5) continue;
        const [cx, cy, ex, ey] = ends(q);
        const [u0, u1, v0, v1] = segSeg(ax, ay, bx, by, cx, cy, ex, ey);
        const ddx = v0 - u0, ddy = v1 - u1, rr = LANE.woodR * 2, d2 = ddx * ddx + ddy * ddy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2);
        let nx, ny;
        if (d > 1e-6) { nx = ddx / d; ny = ddy / d; } else { nx = dx; ny = dy; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; }
        const mx = (u0 + v0) / 2, my = (u1 + v1) / 2;
        const A = asBody(p, 1 / PIN_M, INV_I_WOOD), B = asBody(q, 1 / PIN_M, INV_I_WOOD);
        contact(A, B, mx, my, nx, ny, rr - d, E_PIN_PIN, 'ww', w);
      } else {
        const [qx, qy] = closestOnSeg(q.x, q.y, ax, ay, bx, by);
        const dx = q.x - qx, dy = q.y - qy, rr = LANE.pinR + LANE.woodR, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
        const A = asBody(p, 1 / PIN_M, INV_I_WOOD), B = asBody(q, 1 / PIN_M, 0); B.w = 0;
        contact(A, B, qx + nx * LANE.woodR, qy + ny * LANE.woodR, nx, ny, rr - d, E_PIN_PIN, 'wp', w);
        standDown(q, nx, ny); q.w = (nx * p.vy - ny * p.vx) * -0.8; w.hits++;
      }
    }
  }
  // boards, gutters, pit (no per-step allocation: this runs for every lying pin on every sub-step)
  for (const p of pins) {
    if (p.s !== 1) continue;
    if (p.y > LANE.pitY - 0.25 && p.vy > 0 || p.y > LANE.pitY) { pinGone(p, 'pit', ev); continue; }
    if (p.y < -0.2) { pinGone(p, 'back', ev); continue; }
    if (p.y < LANE.deckStart - 0.15) { if (Math.abs(p.x) > LANE.halfW + 0.02) pinGone(p, 'gutter', ev); continue; }
    // kickback boards: test both ends of the pin
    const c = Math.cos(p.a) * LANE.woodHL, sn = Math.sin(p.a) * LANE.woodHL;
    boardPush(p, p.x - c, p.y - sn, w);
    boardPush(p, p.x + c, p.y + sn, w);
  }
  // settle test
  if (b && !b.live || !b) {
    let moving = 0;
    for (const p of pins) if (p.s === 1 && (Math.abs(p.vx) + Math.abs(p.vy) > 0.04 || Math.abs(p.w) > 0.2)) moving++;
    if (!moving) { w.idle += dt; if (w.idle > 0.25) w.settled = true; } else w.idle = 0;
  } else w.idle = 0;
  if (w.t > 16) { w.settled = true; if (b) b.live = 0; for (const p of pins) { p.vx = 0; p.vy = 0; p.w = 0; } }
}

// Run a whole roll to rest (for the AI and tests). Returns the number of pins knocked by this ball.
export function simulate(w, maxSteps = 4400) {
  const before = standingCount(w);
  let n = 0;
  while (!w.settled && n++ < maxSteps) step(w, DT);
  w.ev.length = 0;
  return before - standingCount(w);
}
