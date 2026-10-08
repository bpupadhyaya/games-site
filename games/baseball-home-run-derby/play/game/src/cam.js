// The camera as a pure function of the round (sim frame: x right, y up, z toward centre field). The 3D presenter smooths it and the 2D
// fallback / HUD labels use the same numbers, so a floating label always sits on the thing it names.
import { clamp, lerp, smooth, DEG, FENCE_H } from './core.js';
import { WINDUP_T } from './engine.js';

const hfovFor = (aspect) => clamp(lerp(36, 68, (aspect - 0.45) / (1.8 - 0.45)), 36, 68);
export const vfovFor = (aspect, hfov = hfovFor(aspect)) => 2 * Math.atan(Math.tan(hfov * DEG / 2) / aspect) / DEG;

/** Resting camera behind the plate. */
export function baseCam(aspect, hand = 1) {
  const land = aspect >= 1;
  const h = hand;
  const pos = land ? [0.55 * h, 2.35, -6.4] : [0.15 * h, 2.5, -5.4];
  const look = land ? [-0.35 * h, 1.05, 14] : [-0.25 * h, 1.15, 12];
  return { pos, look, fov: vfovFor(aspect) };
}

const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const at = (f, ft) => { const k = clamp(ft * 60, 0, f.n - 1), i = Math.floor(k), a = k - i, j = Math.min(f.n - 1, i + 1); return [lerp(f.traj[i * 3], f.traj[j * 3], a), lerp(f.traj[i * 3 + 1], f.traj[j * 3 + 1], a), lerp(f.traj[i * 3 + 2], f.traj[j * 3 + 2], a)]; };
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The follow camera while the ball is in the air (ft = flight clock). */
export function followCam(r, aspect, hand, ft) {
  const base = baseCam(aspect, hand), f = r.fly;
  const bp = at(f, Math.max(0, ft - 0.06));
  const w = smooth(ft / 0.7);
  const slide = smooth(ft / 3.0);
  const pos = mix3(base.pos, [base.pos[0] * 0.3, 4.6, 3.0], slide);
  const last = [f.traj[(f.n - 1) * 3], 2, f.traj[(f.n - 1) * 3 + 2]];
  const aimPt = mix3([bp[0], bp[1] + 0.3, bp[2]], last, 0 * smooth(ft / 1.6));
  const look = mix3(base.look, aimPt, w);
  const d = dist3(pos, look);
  const zoom = clamp(26 / Math.max(26, d), 0.3, 1);
  const tanH = Math.tan(base.fov * DEG / 2) * lerp(1, zoom, w);
  return { pos, look, fov: 2 * Math.atan(tanH) / DEG };
}

export function cameraFor(r, aspect, hand = 1) {
  const base = baseCam(aspect, hand);
  if (!r) return base;
  switch (r.phase) {
    case 'ready': return base;
    case 'windup': { const k = smooth(r.pt / WINDUP_T); return { ...base, pos: [base.pos[0], base.pos[1] - 0.12 * k, base.pos[2] + 0.35 * k] }; }
    case 'flight': return r.fly ? followCam(r, aspect, hand, r.ft) : base;
    case 'result': {
      if (!r.fly || !r.res || r.res.kind !== 'ball') return base;
      const fe = r.ftEnd ?? Math.min(r.fly.n / 60, r.ft);
      const end = followCam(r, aspect, hand, r.res.hr ? Math.min(r.fly.fenceT + 0.9, fe) : fe);
      if (r.res.hr) return end;
      const k = smooth((r.pt - 0.3) / 0.8);
      return { pos: mix3(end.pos, base.pos, k), look: mix3(end.look, base.look, k), fov: lerp(end.fov, base.fov, k) };
    }
    default: return base;
  }
}

/** Orbiting camera for the title / menus behind the batter. */
export function titleCam(t, aspect, hand = 1) {
  const a = Math.sin(t * 0.18) * 0.35;
  if (aspect >= 1) {
    // landscape: the batter stands low and left, under the hero lettering; the buttons sit on the right
    const R = 7.2;
    return { pos: [Math.sin(a + 0.35) * R * 0.6 * hand + 2.2 * hand, 1.6, -Math.cos(a) * R], look: [3.0 * hand, 2.0, 0.2], fov: vfovFor(aspect, 56) };
  }
  const R = 6.2;
  return { pos: [Math.sin(a + 0.5 * hand) * R * hand * 0.7 + 0.8 * hand, 1.7, -Math.cos(a) * R], look: [-0.6 * hand, 0.5, 0.2], fov: vfovFor(aspect, 40) };
}

/** Project a sim point to virtual screen units. Returns { x, y, k, ok } where k = virtual units per metre at that depth. */
export function project(cam, w, h, p, out = {}) {
  const f = [cam.look[0] - cam.pos[0], cam.look[1] - cam.pos[1], cam.look[2] - cam.pos[2]];
  const fl = Math.hypot(f[0], f[1], f[2]) || 1; f[0] /= fl; f[1] /= fl; f[2] /= fl;
  // right = up x f
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
export { FENCE_H };
