// Ball physics: pure, deterministic, fixed sub-step. Gravity, drag, a little lift from spin, and impacts on the floor, front wall,
// left wall and back wall with restitution and friction that exchanges spin with velocity (a rigid sphere with moment kappa m R^2).
// The same function advances the live ball and every forecast, so a forecast is exactly what will happen.
import { HW, L, WALL_H, BACK_H, BR, G, PHYS, TIN, TOP } from './consts.js';

export const newBall = (x = 0, y = 1, z = 1, vx = 0, vy = 0, vz = 0, wx = 0, wy = 0, wz = 0) => ({ x, y, z, vx, vy, vz, wx, wy, wz });
export const cloneBall = (b) => ({ x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, wx: b.wx, wy: b.wy, wz: b.wz });

// Impact of a sphere on a plane with inward normal (nx, ny, nz); e = restitution. Returns the speed of the approach (m/s) along the normal.
function impact(b, nx, ny, nz, e) {
  const vn = b.vx * nx + b.vy * ny + b.vz * nz;
  if (vn >= 0) return 0;
  // tangential velocity of the contact point: v + w x r, r = -n R (w x r is perpendicular to n)
  const rx = -nx * BR, ry = -ny * BR, rz = -nz * BR;
  let ux = b.vx + (b.wy * rz - b.wz * ry), uy = b.vy + (b.wz * rx - b.wx * rz), uz = b.vz + (b.wx * ry - b.wy * rx);
  const un = ux * nx + uy * ny + uz * nz;
  ux -= un * nx; uy -= un * ny; uz -= un * nz;
  const ul = Math.hypot(ux, uy, uz);
  const rest = Math.abs(vn) < 0.9 ? 0.2 : e;                                // soft landings do not bounce high
  // normal
  b.vx -= (1 + rest) * vn * nx; b.vy -= (1 + rest) * vn * ny; b.vz -= (1 + rest) * vn * nz;
  if (ul > 1e-6) {
    const k = PHYS.kappa;
    const jStick = ul / (1 + 1 / k);
    const jMax = PHYS.mu * (1 + rest) * -vn;
    const j = Math.min(jStick, jMax);
    const tx = -ux / ul, ty = -uy / ul, tz = -uz / ul;
    b.vx += j * tx; b.vy += j * ty; b.vz += j * tz;
    // w += (r x J) / (kappa R^2)
    const jx = j * tx, jy = j * ty, jz = j * tz;
    const k2 = 1 / (k * BR * BR);
    b.wx += (ry * jz - rz * jy) * k2; b.wy += (rz * jx - rx * jz) * k2; b.wz += (rx * jy - ry * jx) * k2;
  }
  return -vn;
}

/**
 * Advance the ball by one sub-step h. Calls `hit(kind, speed, b)` for every impact: 'floor' | 'front' | 'left' | 'back' | 'tin' (front wall below the
 * tin) | 'out' (left the court: past the open side, over a wall top, or into the ceiling). Returns the list of impacts (usually empty).
 */
const NONE = [];
export function stepBall(b, h = PHYS.h, out = null) {
  // forces
  const sp = Math.hypot(b.vx, b.vy, b.vz);
  const dr = PHYS.drag * sp;
  // Magnus: a = c (w x v)
  const mx = b.wy * b.vz - b.wz * b.vy, my = b.wz * b.vx - b.wx * b.vz, mz = b.wx * b.vy - b.wy * b.vx;
  b.vx += (-dr * b.vx + PHYS.magnus * mx) * h;
  b.vy += (-G - dr * b.vy + PHYS.magnus * my) * h;
  b.vz += (-dr * b.vz + PHYS.magnus * mz) * h;
  const dec = Math.max(0, 1 - PHYS.spinDecay * h);
  b.wx *= dec; b.wy *= dec; b.wz *= dec;
  b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
  let ev = NONE;
  const add = (kind, speed) => { if (ev === NONE) ev = []; ev.push({ kind, speed, x: b.x, y: b.y, z: b.z }); };
  // floor
  if (b.y < BR && b.vy < 0) {
    b.y = BR;
    if (-b.vy < 0.5) { b.vy = 0; b.vx *= 1 - 0.8 * h; b.vz *= 1 - 0.8 * h; }       // rolling: no impact event
    else add('floor', impact(b, 0, 1, 0, PHYS.eFloor));
  }
  // left wall (x = +HW), inward normal -x
  if (b.x > HW - BR && b.vx > 0) {
    if (b.y - BR > WALL_H) add('out', 0);
    else { b.x = HW - BR; add('left', impact(b, -1, 0, 0, PHYS.eLeft)); }
  }
  // front wall (z = L), inward normal -z
  if (b.z > L - BR && b.vz > 0) {
    if (b.y > WALL_H + 0.6) add('out', 0);
    else {
      const yy = b.y, low = yy < TIN;
      b.z = L - BR;
      add(low ? 'tin' : yy > TOP ? 'high' : 'front', impact(b, 0, 0, -1, low ? 0.35 : PHYS.eFront));
    }
  }
  // back wall (z = 0), inward normal +z; a ball above it leaves the court
  if (b.z < BR && b.vz < 0) {
    if (b.y - BR > BACK_H) add('out', 0);
    else { b.z = BR; add('back', impact(b, 0, 0, 1, PHYS.eBack)); }
  }
  // the open side (x = -HW): leaving the court
  if (b.x < -HW - 3.0) add('out', 0);                   // far into the stands (a ball is out when it LANDS beyond the right line, see plan.js)
  if (b.y > WALL_H + 3) add('out', 0);
  return ev;
}

/**
 * Forecast: run the ball forward from its present state until the rally logic says it is dead. `rules` is a stateful object the caller
 * advances with each impact (see sim.js); here we only need the trajectory and the impacts. Returns { n, h, xs, ys, zs, vx, vy, vz, impacts:[{k, t, kind, ...}] }.
 * The run stops after `maxT` seconds, at the second floor bounce after a front-wall hit, or when the ball leaves the court.
 */
export function forecast(ball0, { maxT = 4, frontHit = false, bounces = 0, t0 = 0 } = {}) {
  const b = cloneBall(ball0), h = PHYS.h;
  const N = Math.ceil(maxT / h);
  const xs = new Float32Array(N + 1), ys = new Float32Array(N + 1), zs = new Float32Array(N + 1);
  const vx = new Float32Array(N + 1), vy = new Float32Array(N + 1), vz = new Float32Array(N + 1);
  const impacts = [];
  let fh = frontHit, bc = bounces, end = N;
  xs[0] = b.x; ys[0] = b.y; zs[0] = b.z; vx[0] = b.vx; vy[0] = b.vy; vz[0] = b.vz;
  for (let k = 1; k <= N; k++) {
    const ev = stepBall(b, h);
    xs[k] = b.x; ys[k] = b.y; zs[k] = b.z; vx[k] = b.vx; vy[k] = b.vy; vz[k] = b.vz;
    if (ev !== NONE) for (const e of ev) {
      impacts.push({ k, t: t0 + k * h, kind: e.kind, speed: e.speed, x: e.x, y: e.y, z: e.z });
      if (e.kind === 'front') fh = true;
      if (e.kind === 'floor' && fh) bc++;
      if (e.kind === 'out' || e.kind === 'tin' || e.kind === 'high' || (e.kind === 'floor' && !fh) || bc >= 2) end = Math.min(end, e.kind === 'out' ? k : k + 30);
    }
    if (k >= end) { end = k; break; }
  }
  const n = Math.min(end, N);
  return { n, h, t0, xs, ys, zs, vx, vy, vz, impacts, last: n };
}
export const at = (f, k) => { const i = Math.max(0, Math.min(f.n, k)); return { x: f.xs[i], y: f.ys[i], z: f.zs[i], vx: f.vx[i], vy: f.vy[i], vz: f.vz[i] }; };
export const idxOf = (f, t) => Math.round((t - f.t0) / f.h);

export { TIN, TOP };
