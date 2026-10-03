// Snooker physics: a deterministic, fixed-step simulation of balls on cloth in real metres.
// Every ball carries a velocity and a 3-axis spin; cloth friction turns sliding into rolling; ball-ball impacts transfer
// spin and "throw"; cushions have friction (side spin changes the rebound angle), speed-dependent bounce and rounded
// jaws at the pockets. No clock and no randomness: the same shot always gives the same result.
//
// Table (playing area inside the cushions): TW x TL = 1.778 x 3.569 m. y runs from the baulk cushion (0, near the
// player) to the top cushion (TL). Balls are drawn and played 1.7x their real size so they stay readable on a phone;
// pockets keep the real ratio to the ball. Coordinates: x right, y away from the player, z up (counter-clockwise
// spin seen from above is positive wz).

export const TW = 1.778, TL = 3.569;
export const R = 0.0446;                       // ball radius (real 0.02625 m, played 1.7x)
export const STEP = 1 / 240;                   // physics sub-step (s)
export const G = 9.81;

// ---- ball ids ------------------------------------------------------------------------------------------------------
export const CUE = 0;
export const YELLOW = 16, GREEN = 17, BROWN = 18, BLUE = 19, PINK = 20, BLACK = 21;
export const COLOURS = [YELLOW, GREEN, BROWN, BLUE, PINK, BLACK];
export const isRed = (id) => id >= 1 && id <= 15;
export const isColour = (id) => id >= 16;
export const VALUE = (id) => (isRed(id) ? 1 : id >= 16 ? id - 14 : 0);   // yellow 2 .. black 7
export const NAMES = { 0: 'White', 16: 'Yellow', 17: 'Green', 18: 'Brown', 19: 'Blue', 20: 'Pink', 21: 'Black' };
export const nameOf = (id) => (isRed(id) ? 'Red' : NAMES[id] ?? '?');

// ---- table layout (real positions) -----------------------------------------------------------------------------------
export const BAULK_Y = 0.737, D_R = 0.292, MID_X = TW / 2;
export const SPOT = {
  16: { x: MID_X + D_R, y: BAULK_Y }, 17: { x: MID_X - D_R, y: BAULK_Y }, 18: { x: MID_X, y: BAULK_Y },
  19: { x: MID_X, y: TL / 2 }, 20: { x: MID_X, y: TL - 0.892 }, 21: { x: MID_X, y: TL - 0.324 },
};

// ---- materials -----------------------------------------------------------------------------------------------------
export const MAT = {
  muSlide: 0.2,          // ball on cloth, sliding
  aRoll: 0.19,           // rolling deceleration (m/s^2)
  aSpin: 14,             // spin about the vertical axis decays (rad/s^2) while moving
  aSpinStop: 60,         // ... and quickly once the ball is nearly still
  eBall: 0.95,           // ball-ball restitution
  muBall: 0.06,          // ball-ball friction (throw and spin transfer)
  muCush: 0.2,           // cushion friction (side spin changes the angle)
};
export const V_MAX = 8.6;

// ---- pockets and cushions --------------------------------------------------------------------------------------------
const RK = 0.014;                                    // radius of the rounded jaw tip
const CORNER_MOUTH = 1.62 * 2 * R, MID_MOUTH = 1.9 * 2 * R;   // real mouth-to-ball ratios
const CE = (CORNER_MOUTH + 2 * RK) / Math.SQRT2 + RK;          // corner: cushion ends this far from the corner
const MG = MID_MOUTH + 2 * RK;                                  // middle: distance between the two jaw centres
export const POCKETS = [
  { x: -0.04, y: -0.04, r: 0.12, kind: 'c' }, { x: TW + 0.04, y: -0.04, r: 0.12, kind: 'c' },
  { x: -0.04, y: TL + 0.04, r: 0.12, kind: 'c' }, { x: TW + 0.04, y: TL + 0.04, r: 0.12, kind: 'c' },
  { x: -0.045, y: TL / 2, r: 0.088, kind: 'm' }, { x: TW + 0.045, y: TL / 2, r: 0.088, kind: 'm' },
];
// Straight cushion faces: { n: inward normal, axis: 'x'|'y' fixed coord, c: coord of the face, lo/hi: extent along the face }
const FACES = [
  { nx: 0, ny: 1, c: 0, axis: 'y', lo: CE, hi: TW - CE },                         // baulk cushion
  { nx: 0, ny: -1, c: TL, axis: 'y', lo: CE, hi: TW - CE },                       // top cushion
  { nx: 1, ny: 0, c: 0, axis: 'x', lo: CE, hi: TL / 2 - MG / 2 },                 // left, lower
  { nx: 1, ny: 0, c: 0, axis: 'x', lo: TL / 2 + MG / 2, hi: TL - CE },            // left, upper
  { nx: -1, ny: 0, c: TW, axis: 'x', lo: CE, hi: TL / 2 - MG / 2 },               // right, lower
  { nx: -1, ny: 0, c: TW, axis: 'x', lo: TL / 2 + MG / 2, hi: TL - CE },          // right, upper
];
export const JAWS = [];   // rounded cushion tips (circle centres)
for (const f of FACES) {
  for (const t of [f.lo, f.hi]) {
    JAWS.push(f.axis === 'y' ? { x: t, y: f.c + (f.ny > 0 ? RK : -RK) } : { x: f.c + (f.nx > 0 ? RK : -RK), y: t });
  }
}
export const GEOM = { CE, MG, RK, CORNER_MOUTH, MID_MOUTH };

// ---- balls and worlds ---------------------------------------------------------------------------------------------------
export function newBall(id, x, y) {
  return { id, x, y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, on: true, mx: 0, my: 0, mz: 1, pk: -1, pt: 0, lx: x, ly: y };
}
export const createWorld = () => ({ b: [], t: 0, ev: [] });
export const ballById = (w, id) => w.b.find((q) => q.id === id) ?? null;
export function addBall(w, id, x, y) { const q = newBall(id, x, y); w.b.push(q); return q; }
export function cloneWorld(w) {
  return { b: w.b.map((q) => ({ ...q })), t: w.t, ev: [] };
}
export const onTable = (w) => w.b.filter((q) => q.on);

// A ball is at rest when it neither translates nor spins fast enough to matter.
export const isMoving = (q) => q.on && (q.vx !== 0 || q.vy !== 0 || q.wx !== 0 || q.wy !== 0);
export const anyMoving = (w) => { for (const q of w.b) if (q.on && (q.vx !== 0 || q.vy !== 0 || q.wx !== 0 || q.wy !== 0)) return true; return false; };

// ---- the strike -----------------------------------------------------------------------------------------------------------
// power 0..1, angle (radians, 0 = +x, pi/2 = up the table), a = side offset (-1 left .. 1 right, fraction of the usable
// range), b = vertical offset (-1 draw .. 1 follow).
export const MAX_OFFSET = 0.62;      // fraction of R the tip may be from the centre
export const powerToSpeed = (p) => 0.18 + (V_MAX - 0.18) * Math.pow(Math.max(0, Math.min(1, p)), 1.7);
export function strike(w, shot) {
  const q = ballById(w, CUE);
  if (!q || !q.on) return false;
  let a = shot.a ?? 0, b = shot.b ?? 0;
  const len = Math.hypot(a, b);
  if (len > 1) { a /= len; b /= len; }
  const ao = a * MAX_OFFSET, bo = b * MAX_OFFSET;                       // in units of R
  const squirt = -0.03 * ao;                                             // small deflection away from the side hit
  const ang = shot.angle + squirt;
  const V = powerToSpeed(shot.power);
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const f = 1 + 2.5 * (ao * ao + bo * bo);
  const Vf = V * f;
  q.vx = V * dx; q.vy = V * dy;
  q.wx = -2.5 * bo * Vf * dy / R;
  q.wy = 2.5 * bo * Vf * dx / R;
  q.wz = 2.5 * ao * Vf / R;
  return true;
}

// ---- stepping -------------------------------------------------------------------------------------------------------------
// ev records: { k:'hit', a, b, v, x, y } ball-ball impact; { k:'cush', id, v, x, y }; { k:'pot', id, p, x, y }
function cloth(q, h) {
  // contact point velocity of the ball on the cloth
  const ux = q.vx - R * q.wy, uy = q.vy + R * q.wx;
  const un = Math.hypot(ux, uy);
  let t = h;
  if (un > 1e-4) {
    const tSlide = un / (3.5 * MAT.muSlide * G);       // slip speed falls at 3.5 mu g
    const ts = Math.min(h, tSlide);
    const ex = ux / un, ey = uy / un;
    const dv = MAT.muSlide * G * ts;
    q.vx -= dv * ex; q.vy -= dv * ey;
    const dw = 2.5 * MAT.muSlide * G / R * ts;
    q.wx -= dw * ey; q.wy += dw * ex;
    t = h - ts;
    if (tSlide <= h) { q.wy = q.vx / R; q.wx = -q.vy / R; }      // slip ended: pure rolling
  }
  if (t > 0) {
    const s2 = Math.hypot(q.vx, q.vy);
    if (s2 > 0) {
      const ns = s2 - MAT.aRoll * t;
      if (ns <= 0) { q.vx = 0; q.vy = 0; q.wx = 0; q.wy = 0; }
      else { const k = ns / s2; q.vx *= k; q.vy *= k; q.wy = q.vx / R; q.wx = -q.vy / R; }
    } else { q.wx = 0; q.wy = 0; }
  }
  // spin about the vertical axis
  if (q.wz !== 0) {
    const a = (q.vx === 0 && q.vy === 0 ? MAT.aSpinStop : MAT.aSpin) * h;
    if (Math.abs(q.wz) <= a) q.wz = 0; else q.wz -= Math.sign(q.wz) * a;
  }
}

// collide a ball with a fixed surface whose inward normal is (nx, ny); the contact is at -R n from the centre
function bounceFixed(q, nx, ny, w, kind) {
  const vn = q.vx * nx + q.vy * ny;
  if (vn >= 0) return false;
  const e = Math.max(0.52, Math.min(0.86, 0.88 - 0.07 * -vn));
  const jn = -(1 + e) * vn;
  q.vx += jn * nx; q.vy += jn * ny;
  const tx = -ny, ty = nx;
  const s = q.vx * tx + q.vy * ty - R * q.wz;                   // slip along the surface
  let jt = -s / 3.5;
  const lim = MAT.muCush * jn;
  if (jt > lim) jt = lim; else if (jt < -lim) jt = -lim;
  q.vx += jt * tx; q.vy += jt * ty;
  q.wz += -jt * R / (0.4 * R * R);
  w.ev.push({ k: kind, id: q.id, v: -vn, x: q.x, y: q.y, t: w.t });
  return true;
}

function ballBall(a, b, w) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d2 = dx * dx + dy * dy, rr = 2 * R;
  if (d2 >= rr * rr || d2 === 0) return false;
  const d = Math.sqrt(d2);
  const nx = dx / d, ny = dy / d;
  // separate
  const ov = (rr - d) / 2;
  a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return false;                    // already separating
  const jn = -(1 + MAT.eBall) * vn / 2;          // impulse on b (and -jn on a), unit mass
  a.vx -= jn * nx; a.vy -= jn * ny; b.vx += jn * nx; b.vy += jn * ny;
  // tangential: slip at the contact includes both balls' vertical-axis spin
  const tx = -ny, ty = nx;
  const slip = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty - R * (a.wz + b.wz);
  let jt = -slip / 7;
  const lim = MAT.muBall * jn;
  if (jt > lim) jt = lim; else if (jt < -lim) jt = -lim;
  b.vx += jt * tx; b.vy += jt * ty; a.vx -= jt * tx; a.vy -= jt * ty;
  const dw = -R * jt / (0.4 * R * R);
  b.wz += dw; a.wz += dw;
  w.ev.push({ k: 'hit', a: a.id, b: b.id, v: -vn, x: a.x + nx * R, y: a.y + ny * R, t: w.t });
  return true;
}

function walls(q, w) {
  // straight cushions
  for (const f of FACES) {
    const along = f.axis === 'y' ? q.x : q.y;
    if (along < f.lo || along > f.hi) continue;
    const dist = f.axis === 'y' ? (q.y - f.c) * f.ny : (q.x - f.c) * f.nx;
    if (dist < R && dist > -R) {
      if (f.axis === 'y') q.y = f.c + f.ny * R; else q.x = f.c + f.nx * R;
      bounceFixed(q, f.nx, f.ny, w, 'cush');
    }
  }
  // rounded jaws
  for (const j of JAWS) {
    const dx = q.x - j.x, dy = q.y - j.y;
    const rr = R + RK;
    const d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0) {
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      q.x = j.x + nx * rr; q.y = j.y + ny * rr;
      bounceFixed(q, nx, ny, w, 'jaw');
    }
  }
}

// A ball drops once its centre has crossed the line between the two jaw tips of a pocket.
const CK = CE + RK - 0.012;
function pockets(q, w) {
  let hit = -1;
  for (let i = 0; i < 4; i++) {
    const u = Math.abs(q.x - (i & 1 ? TW : 0)), v = Math.abs(q.y - (i & 2 ? TL : 0));
    if (u + v < CK && u < CE && v < CE) { hit = i; break; }
  }
  if (hit < 0) {
    for (let i = 4; i < 6; i++) {
      const u = Math.abs(q.x - (i === 5 ? TW : 0));
      if (u < RK - 0.002 && Math.abs(q.y - TL / 2) < MG / 2) { hit = i; break; }
    }
  }
  if (hit < 0) return false;
  q.on = false; q.pk = hit; q.pt = 0;
  q.vx = 0; q.vy = 0; q.wx = 0; q.wy = 0; q.wz = 0;
  w.ev.push({ k: 'pot', id: q.id, p: hit, x: q.x, y: q.y, t: w.t });
  return true;
}

function spinMark(q, h) {
  // the visual spin mark: a point on the ball surface carried by the spin (display only)
  const wx = q.wx, wy = q.wy, wz = q.wz;
  if (wx === 0 && wy === 0 && wz === 0) return;
  let mx = q.mx, my = q.my, mz = q.mz;
  const nx = mx + (wy * mz - wz * my) * h, ny = my + (wz * mx - wx * mz) * h, nz = mz + (wx * my - wy * mx) * h;
  const l = Math.hypot(nx, ny, nz) || 1;
  q.mx = nx / l; q.my = ny / l; q.mz = nz / l;
}

export function stepWorld(w, h = STEP) {
  const b = w.b;
  const n = b.length;
  for (let i = 0; i < n; i++) {
    const q = b[i];
    if (!q.on) continue;
    q.lx = q.x; q.ly = q.y;
    if (q.vx !== 0 || q.vy !== 0 || q.wx !== 0 || q.wy !== 0 || q.wz !== 0) {
      cloth(q, h);
      q.x += q.vx * h; q.y += q.vy * h;
      spinMark(q, h);
    }
  }
  // ball-ball: a few passes so a break resolves several touching balls
  for (let pass = 0; pass < 3; pass++) {
    let any = false;
    for (let i = 0; i < n; i++) {
      const a = b[i];
      if (!a.on) continue;
      for (let j = i + 1; j < n; j++) {
        const c = b[j];
        if (!c.on) continue;
        if (a.vx === 0 && a.vy === 0 && c.vx === 0 && c.vy === 0) continue;
        const dx = c.x - a.x;
        if (dx > 2 * R || dx < -2 * R) continue;
        if (ballBall(a, c, w)) any = true;
      }
    }
    if (!any) break;
  }
  for (let i = 0; i < n; i++) {
    const q = b[i];
    if (!q.on) continue;
    if (q.vx !== 0 || q.vy !== 0) { walls(q, w); pockets(q, w); }
    if (q.on && (q.x < -0.3 || q.x > TW + 0.3 || q.y < -0.3 || q.y > TL + 0.3)) {   // never lose a ball
      q.x = Math.max(R, Math.min(TW - R, q.x)); q.y = Math.max(R, Math.min(TL - R, q.y)); q.vx = 0; q.vy = 0;
    }
  }
  w.t += h;
}

// Run until everything stops (or maxT seconds). Returns the events.
export function settle(w, maxT = 40) {
  let n = Math.floor(maxT / STEP);
  const ev = [];
  while (n-- > 0 && anyMoving(w)) {
    stepWorld(w);
    if (w.ev.length) { for (const e of w.ev) ev.push(e); w.ev.length = 0; }
  }
  if (anyMoving(w)) for (const q of w.b) { q.vx = 0; q.vy = 0; }
  for (const q of w.b) { q.wx = 0; q.wy = 0; q.wz = 0; }
  return ev;
}

// ---- geometry helpers -----------------------------------------------------------------------------------------------------
// Does the straight path of a ball centre from (x0,y0) to (x1,y1) stay clear of the other balls (by 2R)? skip = ids to ignore.
export function pathClear(w, x0, y0, x1, y1, skip, clear = 2 * R - 0.0005) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
  for (const q of w.b) {
    if (!q.on || skip.includes(q.id)) continue;
    let t = L2 > 0 ? ((q.x - x0) * dx + (q.y - y0) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + dx * t - q.x, py = y0 + dy * t - q.y;
    if (px * px + py * py < clear * clear) return false;
  }
  return true;
}
export const inD = (x, y) => y <= BAULK_Y && Math.hypot(x - MID_X, y - BAULK_Y) <= D_R;
// Is a cue-ball position free of the other balls (and inside the table)?
export function spotFree(w, x, y, skipId = -1) {
  if (x < R || x > TW - R || y < R || y > TL - R) return false;
  for (const q of w.b) { if (q.on && q.id !== skipId && Math.hypot(q.x - x, q.y - y) < 2 * R + 0.0005) return false; }
  return true;
}
// The nearest free position for the cue ball inside the D (used when a position is blocked).
export function nearestInD(w, x, y) {
  const clampD = (px, py) => {
    py = Math.min(BAULK_Y - R, Math.max(R, py));
    const dx = px - MID_X, dy = py - BAULK_Y, d = Math.hypot(dx, dy);
    const lim = D_R - R;
    if (d > lim) { px = MID_X + dx / d * lim; py = BAULK_Y + dy / d * lim; }
    if (py > BAULK_Y - R) py = BAULK_Y - R;
    return [px, py];
  };
  let [px, py] = clampD(x, y);
  if (spotFree(w, px, py, CUE)) return { x: px, y: py };
  for (let r = 0.01; r < 0.4; r += 0.01) {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const [cx, cy] = clampD(x + Math.cos(a) * r, y + Math.sin(a) * r);
      if (spotFree(w, cx, cy, CUE)) return { x: cx, y: cy };
    }
  }
  return { x: MID_X, y: BAULK_Y - R * 2 };
}

// ---- standard set-up ----------------------------------------------------------------------------------------------------------
export function rackWorld(nReds = 15) {
  const w = createWorld();
  for (const id of COLOURS) { const s = SPOT[id]; addBall(w, id, s.x, s.y); }
  const rows = nReds === 15 ? 5 : nReds === 6 ? 3 : nReds === 10 ? 4 : 2;
  let id = 1;
  const ax = MID_X, ay = SPOT[PINK].y + 2 * R + 0.0006;
  for (let r = 0; r < rows && id <= nReds; r++) {
    for (let c = 0; c <= r && id <= nReds; c++) {
      addBall(w, id++, ax + (c - r / 2) * (2 * R + 0.0004), ay + r * (Math.sqrt(3) * R + 0.0004));
    }
  }
  addBall(w, CUE, MID_X + 0.1, BAULK_Y - 0.15);
  return w;
}

// Re-spot position for a coloured ball: its own spot, else the highest free spot, else the nearest free place up the table.
export function respotPosition(w, id) {
  const free = (p) => spotFree(w, p.x, p.y);
  if (free(SPOT[id])) return { x: SPOT[id].x, y: SPOT[id].y };
  for (const c of [BLACK, PINK, BLUE, BROWN, GREEN, YELLOW]) if (free(SPOT[c])) return { x: SPOT[c].x, y: SPOT[c].y };
  const s = SPOT[id];
  for (let d = 0.003; d < TL; d += 0.003) {
    if (spotFree(w, s.x, s.y + d)) return { x: s.x, y: s.y + d };
  }
  for (let d = 0.003; d < TL; d += 0.003) {
    if (spotFree(w, s.x, s.y - d)) return { x: s.x, y: s.y - d };
  }
  return { x: s.x, y: s.y };
}
