// Ball physics: pure, deterministic, fixed sub-step. Gravity, drag, lift from spin, the net, and bounces on the floor with restitution and
// friction that exchanges spin with velocity (a hollow ball with moment kappa m R^2). The same function advances the live ball and every
// forecast, so a forecast is exactly what will happen.
import { BR, G, PHYS, NET_HW, netTop, SURFACES } from './consts.js';

export const newBall = (x = 0, y = 1, z = 0, vx = 0, vy = 0, vz = 0, wx = 0, wy = 0, wz = 0) => ({ x, y, z, vx, vy, vz, wx, wy, wz });
export const cloneBall = (b) => ({ x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, wx: b.wx, wy: b.wy, wz: b.wz });

// Impact of a sphere on the floor (normal +y) with restitution e and friction mu. Returns the approach speed along the normal.
function floorImpact(b, e, mu) {
  const vn = b.vy;
  if (vn >= 0) return 0;
  const rx = 0, ry = -BR, rz = 0;
  // tangential velocity of the contact point: v + w x r
  let ux = b.vx + (b.wy * rz - b.wz * ry), uz = b.vz + (b.wx * ry - b.wy * rx);
  const ul = Math.hypot(ux, uz);
  const rest = Math.abs(vn) < 1.2 ? 0.25 : e;                               // soft landings do not bounce high
  b.vy = -rest * vn;
  if (ul > 1e-6) {
    const k = PHYS.kappa;
    const jStick = ul / (1 + 1 / k);
    const jMax = mu * (1 + rest) * -vn;
    const j = Math.min(jStick, jMax);
    const tx = -ux / ul, tz = -uz / ul;
    b.vx += j * tx; b.vz += j * tz;
    // w += (r x J) / (kappa R^2), J = (j tx, 0, j tz)
    const k2 = 1 / (k * BR * BR);
    b.wx += (ry * (j * tz) - rz * 0) * k2; b.wy += (rz * (j * tx) - rx * (j * tz)) * k2; b.wz += (rx * 0 - ry * (j * tx)) * k2;
  }
  return -vn;
}

const NONE = [];
/**
 * Advance the ball by one sub-step h on the surface `surf`. Returns the list of impacts (usually empty):
 * 'floor' | 'net' (stopped by the net) | 'cord' (clipped the tape and carried on) | 'out' (far outside the court).
 */
export function stepBall(b, h = PHYS.h, surf = SURFACES.lawn) {
  const sp = Math.hypot(b.vx, b.vy, b.vz);
  const dr = PHYS.drag * sp;
  const mx = b.wy * b.vz - b.wz * b.vy, my = b.wz * b.vx - b.wx * b.vz, mz = b.wx * b.vy - b.wy * b.vx;
  b.vx += (-dr * b.vx + PHYS.magnus * mx) * h;
  b.vy += (-G - dr * b.vy + PHYS.magnus * my) * h;
  b.vz += (-dr * b.vz + PHYS.magnus * mz) * h;
  const dec = Math.max(0, 1 - PHYS.spinDecay * h);
  b.wx *= dec; b.wy *= dec; b.wz *= dec;
  const pz = b.z, py = b.y, px = b.x;
  b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
  let ev = NONE;
  const add = (kind, speed) => { if (ev === NONE) ev = []; ev.push({ kind, speed, x: b.x, y: b.y, z: b.z }); };
  // the net: the ball crosses the plane z = 0
  if ((pz < 0) !== (b.z < 0) && pz !== b.z) {
    const u = pz / (pz - b.z), cx = px + (b.x - px) * u, cy = py + (b.y - py) * u;
    if (Math.abs(cx) <= NET_HW) {
      const d = cy - BR * 0.82 - netTop(cx);                           // gap between the bottom of the ball and the top tape (negative: below it)
      if (d < -0.05) { b.z = pz > 0 ? 0.1 : -0.1; b.x = cx; b.y = cy; const v = Math.hypot(b.vx, b.vy, b.vz); b.vz = -b.vz * 0.12; b.vx *= 0.3; b.vy = Math.min(b.vy, 0) * 0.3; add('net', v); }
      else if (d < 0) { b.vz *= 0.5; b.vx *= 0.8; b.vy = Math.abs(b.vy) * 0.25 + 1.3; add('cord', Math.hypot(b.vx, b.vy, b.vz)); }
    }
  }
  // floor
  if (b.y < BR && b.vy < 0) {
    b.y = BR;
    if (-b.vy < 0.5) { b.vy = 0; b.vx *= 1 - 0.8 * h; b.vz *= 1 - 0.8 * h; }       // rolling: no impact event
    else add('floor', floorImpact(b, surf.eFloor, surf.mu));
  }
  if (Math.abs(b.x) > 14 || Math.abs(b.z) > 18 || b.y > 22) add('out', 0);
  return ev;
}

/**
 * Forecast: run the ball forward from its present state. Stops at the net, when it leaves the court area, after the second floor impact, or after maxT.
 * Returns { n, h, t0, xs, ys, zs, vx, vy, vz, impacts:[{k, t, kind, speed, x, y, z}], last }.
 */
export function forecast(ball0, { maxT = 4, t0 = 0, surf = SURFACES.lawn } = {}) {
  const b = cloneBall(ball0), h = PHYS.h;
  const N = Math.ceil(maxT / h);
  const xs = new Float32Array(N + 1), ys = new Float32Array(N + 1), zs = new Float32Array(N + 1);
  const vx = new Float32Array(N + 1), vy = new Float32Array(N + 1), vz = new Float32Array(N + 1);
  const impacts = [];
  let floors = 0, end = N;
  xs[0] = b.x; ys[0] = b.y; zs[0] = b.z; vx[0] = b.vx; vy[0] = b.vy; vz[0] = b.vz;
  for (let k = 1; k <= N; k++) {
    const ev = stepBall(b, h, surf);
    xs[k] = b.x; ys[k] = b.y; zs[k] = b.z; vx[k] = b.vx; vy[k] = b.vy; vz[k] = b.vz;
    if (ev !== NONE) for (const e of ev) {
      impacts.push({ k, t: t0 + k * h, kind: e.kind, speed: e.speed, x: e.x, y: e.y, z: e.z });
      if (e.kind === 'floor') floors++;
      if (e.kind === 'out' || e.kind === 'net') end = Math.min(end, k + 4);
      if (floors >= 2) end = Math.min(end, k + 4);
    }
    if (k >= end) { end = k; break; }
  }
  const n = Math.min(end, N);
  return { n, h, t0, xs, ys, zs, vx, vy, vz, impacts, last: n };
}
export const at = (f, k) => { const i = Math.max(0, Math.min(f.n, k)); return { x: f.xs[i], y: f.ys[i], z: f.zs[i], vx: f.vx[i], vy: f.vy[i], vz: f.vz[i] }; };
export const idxOf = (f, t) => Math.round((t - f.t0) / f.h);
