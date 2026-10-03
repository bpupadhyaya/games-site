// Ball physics: gravity, quadratic air drag, Magnus curve from side spin, bounces, rolling friction, goal frame and net.
// Pure and deterministic (fixed step). Also the small solvers the sim and the AI share (how hard to pass, where a lob lands).
import { G, BR, HL, GOAL_HW, GOAL_H, GOAL_D, POST_R } from './consts.js';

export const DRAG = 0.0125;        // air: a = -DRAG * |v| * v
export const MAG = 0.30;           // curve: a = MAG * sp * (vz, -vx)   (sp in -1..1; + curves to the left of a ball travelling +z)
export const F0 = 1.05, F1 = 0.17; // rolling: a = F0 + F1 * v
export const REST = 0.60;          // bounce restitution

export const newBall = () => ({ x: 0, y: BR, z: 0, vx: 0, vy: 0, vz: 0, sp: 0, owner: -1, last: -1, lastTeam: -1, held: -1, rx: 0, rz: 0 });

export function stepBall(b, dt) {
  const grounded = b.y <= BR + 1e-5 && Math.abs(b.vy) < 1e-4;
  if (!grounded) {
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
    const k = DRAG * sp;
    b.vx += (-k * b.vx + MAG * b.sp * b.vz) * dt;
    b.vz += (-k * b.vz - MAG * b.sp * b.vx) * dt;
    b.vy += (-G - k * b.vy) * dt;
    b.sp *= Math.exp(-0.30 * dt);
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.y < BR) {
      b.y = BR;
      if (b.vy < -1.1) {
        b.vy = -b.vy * REST; b.vx *= 0.8; b.vz *= 0.8; b.sp *= 0.6;
        return 'bounce';
      }
      b.vy = 0;
    }
    return null;
  }
  // rolling on the grass
  const v = Math.hypot(b.vx, b.vz);
  if (v > 1e-6) {
    const nv = Math.max(0, v - (F0 + F1 * v) * dt);
    const s = nv / v;
    b.vx *= s; b.vz *= s;
    const lat = MAG * 0.35 * b.sp;
    b.vx += lat * b.vz * dt; b.vz -= lat * b.vx * dt;
  }
  b.sp *= Math.exp(-2.2 * dt);
  b.x += b.vx * dt; b.z += b.vz * dt; b.y = BR; b.vy = 0;
  return null;
}

// distance a rolling ball covers while slowing from v0 to v1; time likewise
export function rollDist(v0, v1) {
  if (v0 <= v1) return 0;
  return (1 / F1) * ((v0 - v1) - (F0 / F1) * Math.log((F0 + F1 * v0) / (F0 + F1 * v1)));
}
export function rollTime(v0, v1) { return v0 <= v1 ? 0 : (1 / F1) * Math.log((F0 + F1 * v0) / (F0 + F1 * v1)); }
// launch speed so a ground pass over distance d arrives with speed varr
export function groundSpeed(d, varr) {
  let lo = varr, hi = 45;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (rollDist(m, varr) < d) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
// seconds for a ground pass to travel d metres starting at v0
export function groundTime(v0, d) {
  let lo = 0, hi = v0;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (rollDist(v0, m) > d) lo = m; else hi = m; }
  return rollTime(v0, (lo + hi) / 2);
}

// Flight over horizontal distance d (from release height y0) taking about T seconds. Returns { vh, vy, T, d }.
export function lobSolve(d, T, y0 = 0.3) {
  let vh = d / T;
  const vy = (BR - y0) / T + 0.5 * G * T;
  let landed = d;
  for (let it = 0; it < 3; it++) {
    const b = { x: 0, y: y0, z: 0, vx: vh, vy, vz: 0, sp: 0 };
    let t = 0;
    for (; t < 4; t += 1 / 30) { const r = stepBall(b, 1 / 30); if (r === 'bounce' || (b.y <= BR + 1e-4 && t > 0.1)) break; }
    landed = b.x;
    if (landed > 0.1) vh *= d / landed;
  }
  return { vh, vy, T, d: landed };
}

// A cheap look-ahead of a free ball: positions every dt seconds for n steps (no players, no goals).
export function predictPath(b, n, dt, out = []) {
  const c = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, sp: b.sp };
  const sub = 3, h = dt / sub;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < sub; k++) { stepBall(c, h); if (Math.abs(c.z) > HL + GOAL_D + 1) { c.vx = c.vz = 0; } }
    const o = out[i] || (out[i] = {});
    o.t = (i + 1) * dt; o.x = c.x; o.y = c.y; o.z = c.z; o.vx = c.vx; o.vz = c.vz; o.vy = c.vy;
  }
  out.length = n;
  return out;
}

// ---- goal frame -----------------------------------------------------------------------------------------------------------------
const segPoint = (px, py, pz, ax, ay, az, bx, by, bz) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz;
  let u = ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / l2; u = u < 0 ? 0 : u > 1 ? 1 : u;
  return [ax + dx * u, ay + dy * u, az + dz * u];
};
// returns 'post' | 'bar' when the ball hit the frame this step, and reflects it
export function collideFrame(b) {
  for (const gz of [-HL, HL]) {
    if (Math.abs(b.z - gz) > 0.4) continue;
    const segs = [
      [GOAL_HW, 0, gz, GOAL_HW, GOAL_H, gz, 'post'], [-GOAL_HW, 0, gz, -GOAL_HW, GOAL_H, gz, 'post'], [-GOAL_HW, GOAL_H, gz, GOAL_HW, GOAL_H, gz, 'bar'],
    ];
    for (const s of segs) {
      const q = segPoint(b.x, b.y, b.z, s[0], s[1], s[2], s[3], s[4], s[5]);
      let nx = b.x - q[0], ny = b.y - q[1], nz = b.z - q[2];
      const d = Math.hypot(nx, ny, nz), R = BR + POST_R;
      if (d < R && d > 1e-6) {
        nx /= d; ny /= d; nz /= d;
        b.x = q[0] + nx * R; b.y = q[1] + ny * R; b.z = q[2] + nz * R;
        const vn = b.vx * nx + b.vy * ny + b.vz * nz;
        if (vn < 0) { const e = 1.62; b.vx -= e * vn * nx; b.vy -= e * vn * ny; b.vz -= e * vn * nz; b.vx *= 0.92; b.vz *= 0.92; }
        return s[6];
      }
    }
  }
  return null;
}
// Inside the goal volume (behind the line, between the posts, under the bar) the net stops the ball
export function netBounds(b) {
  const gz = b.z > 0 ? HL : -HL, s = b.z > 0 ? 1 : -1;
  const depth = (b.z - gz) * s;
  if (depth <= 0 || depth > GOAL_D + BR) return false;
  if (Math.abs(b.x) > GOAL_HW + 0.2 || b.y > GOAL_H + 0.25) return false;
  const back = gz + s * (GOAL_D - BR);
  if ((b.z - back) * s > 0) { b.z = back; b.vz *= -0.12; b.vx *= 0.3; b.vy *= 0.3; }
  if (b.x > GOAL_HW - BR + 0.15) { b.x = GOAL_HW - BR + 0.15; b.vx *= -0.15; }
  if (b.x < -(GOAL_HW - BR + 0.15)) { b.x = -(GOAL_HW - BR + 0.15); b.vx *= -0.15; }
  if (b.y > GOAL_H + 0.15) { b.y = GOAL_H + 0.15; b.vy = Math.min(0, b.vy) * 0.2; }
  const damp = Math.exp(-3 * (1 / 60));
  b.vx *= damp; b.vz *= damp;
  return true;
}
