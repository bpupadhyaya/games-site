// A true perspective view of the cancha, as pure maths. The 3D presenter builds its cameras from the same numbers, so every 2D overlay
// (aim ring, measuring labels, picking) lines up with the lit scene exactly. World axes: X = u (along the cancha), Z = v (across; the near
// board is +Z), Y = height. The camera looks toward -Z, pitched down, no yaw and no roll: screen y depends only on (v, z).
import { COURT } from './sim.js';

const RAD = Math.PI / 180;

// rect: where the view goes (virtual units). o: { uc, half (visible half width in metres at the focus), pitch (deg), fov (deg, vertical),
// axisV (v of the point the optical axis hits on the ground), minR }
export function makeView3(rect, o) {
  const pitch = (o.pitch ?? 40) * RAD, fov = (o.fov ?? 24) * RAD, uc = o.uc, axisV = o.axisV ?? 0;
  const f = rect.h / (2 * Math.tan(fov / 2)), cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const D = (2 * o.half * f) / rect.w;
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  const camY = D * sp, camZ = axisV + D * cp;
  const V = { rect, uc, f, cx, cy, pitch, fov, D, camY, camZ, axisV, p3: true, minR: o.minR ?? 0 };
  V.cam = { x: uc, y: camY, z: camZ, pitch, fovDeg: o.fov ?? 24, aspect: rect.w / rect.h };
  // depth (distance along the optical axis) and the "up" projection of a world point
  const depth = (v, z) => (camY - z) * sp + (camZ - v) * cp;
  const up = (v, z) => (z - camY) * cp + (camZ - v) * sp;
  const d0 = depth(0, 0);
  V.kx = f / d0;                       // px per metre across the screen at the cancha centreline
  V.ky = V.kx * sp * 0.98;             // px per metre in depth (kept for callers that size things by it)
  V.kz = V.kx * cp;                    // px per metre of height at the centreline
  V.s = (v) => d0 / depth(v, 0);       // relative size of the ground at lane v
  V.x = (u, v = 0, z = 0) => cx + (f * (u - uc)) / depth(v, z);
  V.y = (v, z = 0) => cy - (f * up(v, z)) / depth(v, z);
  V.rad = (r, v = 0, z = r) => Math.max(V.minR, (f * r) / depth(v, z));
  V.yFar = V.y(-COURT.half, 0);
  V.H = V.y(COURT.half, 0) - V.yFar;
  // screen point -> ground (z = 0): returns { u, v }
  V.inv = (sx, sy) => {
    const m = (cy - sy) / f;                 // (up component) / depth
    // up = (-camY) cp + q sp,  depth = camY sp + q cp  with q = camZ - v
    const den = m * cp - sp;
    const q = Math.abs(den) < 1e-6 ? camZ : (-camY * (cp + m * sp)) / den;
    const v = Math.max(-COURT.half - 3, Math.min(COURT.half + 3, camZ - q));
    return { u: uc + ((sx - cx) * depth(v, 0)) / f, v };
  };
  V.depth = depth;
  return V;
}
