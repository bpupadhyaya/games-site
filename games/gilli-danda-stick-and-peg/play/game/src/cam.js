// The camera as a pure function of the round (sim frame: x right, y up, z down the field). The 3D presenter uses these numbers, the 2D fallback
// and the HUD projections use the same ones, so a floating label always sits on the thing it names.
import { clamp, lerp, smooth, DEG, STRIKER_Z, AIM_MAX } from './core.js';
import { gilliNow } from './engine.js';

const hfovFor = (aspect) => clamp(lerp(44, 74, (aspect - 0.45) / (1.8 - 0.45)), 44, 74);
export const vfovFor = (aspect, hfov = hfovFor(aspect)) => 2 * Math.atan(Math.tan(hfov * DEG / 2) / aspect) / DEG;

/** Resting camera behind and to the right of the striker, looking down the field; it turns toward the aim (radians, + right) so the gap you aim at is in view. */
export function baseCam(aspect, aim = 0) {
  const k = smooth((aspect - 0.75) / 0.5);                    // 0 portrait .. 1 landscape (blended through the tablet shapes)
  const yaw = clamp(aim, -1, 1) * 0.55, sy = Math.sin(yaw), cy = Math.cos(yaw);
  const pos = [lerp(1.2, 1.7, k) - lerp(1.0, 1.2, k) * sy, lerp(2.7, 3.3, k), lerp(-4.9, -7.4, k)];
  const L = lerp(13, 13.4, k), lx = lerp(-1.4, -3.4, k), ly = lerp(0.15, 0.4, k);
  const look = [pos[0] + sy * L + lx * cy, ly, pos[2] + cy * L];
  return { pos, look, fov: vfovFor(aspect) };
}
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Camera while the gilli travels (ft = flight clock) and after it. */
function followCam(r, aspect, ft, aim) {
  const base = baseCam(aspect, aim), f = r.fly;
  const i = clamp(Math.round(ft * 60), 0, f.n - 1);
  const g = [f.traj[i * 3], f.traj[i * 3 + 1], f.traj[i * 3 + 2]];
  const w = smooth(ft / 0.4), up = smooth(ft / 1.3);
  const pos = mix3(base.pos, [base.pos[0] * 0.3 + g[0] * 0.12, 3.6, -7.2], up);
  const ground = [g[0], 1.0, g[2]];
  const aimP = mix3([g[0], Math.max(0.6, g[1]), g[2]], ground, 0.3 + 0.35 * up);
  const look = mix3(base.look, aimP, w);
  const d = Math.hypot(look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]);
  const zoom = lerp(1, clamp(15 / Math.max(15, d), 0.42, 1), w);
  return { pos, look, fov: base.fov * zoom };
}

export function cameraFor(r, aspect, aim = null) {
  const a = aim ?? (r ? r.az * AIM_MAX * DEG : 0);
  const base = baseCam(aspect, a / (AIM_MAX * DEG));
  if (!r) return base;
  switch (r.phase) {
    case 'swing': { const k = smooth(r.fp / 0.5); return { ...base, pos: [base.pos[0], base.pos[1] - 0.06 * k, base.pos[2] + 0.2 * k] }; }
    case 'fly': return r.fly ? followCam(r, aspect, r.ft, a / (AIM_MAX * DEG)) : base;
    case 'result': {
      if (!r.fly) return base;
      const fe = Math.min(r.fly.tEnd, (r.fly.n - 1) / 60);
      const end = followCam(r, aspect, fe, a / (AIM_MAX * DEG));
      // settle on the catch or the landing, closer in
      const tgt = r.fly.caught ? [r.fly.caught.x, 1.2, r.fly.caught.z] : [r.fly.land.x, 0.8, r.fly.land.z];
      const dd = Math.hypot(tgt[0] - end.pos[0], tgt[2] - end.pos[2]);
      const near = { pos: mix3(end.pos, [end.pos[0] * 0.6 + tgt[0] * 0.25, 2.4, end.pos[2] * 0.55 + tgt[2] * 0.45 - 1], 0.5), look: tgt, fov: base.fov * clamp(14 / Math.max(14, dd), 0.4, 1) };
      const k1 = smooth(r.pt / 0.7), k = smooth((r.pt - 1.4) / 0.9);
      const mid = { pos: mix3(end.pos, near.pos, k1), look: mix3(end.look, near.look, k1), fov: lerp(end.fov, near.fov, k1) };
      return { pos: mix3(mid.pos, base.pos, k), look: mix3(mid.look, base.look, k), fov: lerp(mid.fov, base.fov, k) };
    }
    default: return base;
  }
}

/** Orbiting camera for the title and menus: the striker from the front, the lane behind him. */
export function titleCam(t, aspect) {
  const a = Math.sin(t * 0.2) * 0.3;
  if (aspect >= 1) return { pos: [0.8 + Math.sin(a) * 0.9, 1.55, 6.4], look: [-1.5, 0.75, STRIKER_Z - 0.1], fov: vfovFor(aspect, 46) };
  return { pos: [0.9 + Math.sin(a) * 0.6, 1.7, 4.6 - Math.cos(a) * 0.2], look: [0, -0.75, STRIKER_Z - 0.1], fov: vfovFor(aspect, 40) };
}

/** Project a sim point to virtual screen units. Returns { x, y, k, ok } where k = virtual units per metre at that depth. */
export function project(cam, w, h, p, out = {}) {
  const f = [cam.look[0] - cam.pos[0], cam.look[1] - cam.pos[1], cam.look[2] - cam.pos[2]];
  const fl = Math.hypot(f[0], f[1], f[2]) || 1; f[0] /= fl; f[1] /= fl; f[2] /= fl;
  let rx = f[2], ry = 0, rz = -f[0]; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const ux = f[1] * rz - f[2] * ry, uy = f[2] * rx - f[0] * rz, uz = f[0] * ry - f[1] * rx;
  const dx = p[0] - cam.pos[0], dy = p[1] - cam.pos[1], dz = p[2] - cam.pos[2];
  const depth = dx * f[0] + dy * f[1] + dz * f[2];
  const focal = (h / 2) / Math.tan(cam.fov * DEG / 2);
  out.ok = depth > 0.2;
  const k = focal / Math.max(0.2, depth);
  out.x = w / 2 + (dx * rx + dz * rz) * k; out.y = h / 2 - (dx * ux + dy * uy + dz * uz) * k; out.k = k; out.depth = depth;
  return out;
}
export { gilliNow };
