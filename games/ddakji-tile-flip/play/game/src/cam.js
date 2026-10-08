// The camera: a fixed viewpoint behind the thrower looking down at the floor. Pure maths.
// makeCam(zone) fits the whole mat (and the thrower's hand) into a screen rectangle, so the same scene works in portrait and
// landscape, on phones and tablets. A tall, narrow zone gets a lower, closer camera (a deeper, more dramatic floor) and a wide
// one a higher camera. proj() puts a world point on screen; unproj() finds the floor point under a screen point.
import { MAT, HAND } from './sim.js';

const LOOK = { x: 0, y: 2.0, z: 0 };

export function makeCam(zone, pad = 0.02) {
  const aspect = zone.w / Math.max(1, zone.h), t = Math.max(0, Math.min(1, (1.15 - aspect) / 0.75));
  const C = { x: 0, y: -3.7 - 1.7 * t, z: 8.4 - 3.5 * t };
  const phi = Math.atan2(C.z - LOOK.z, LOOK.y - C.y), SP = Math.sin(phi), CP = Math.cos(phi);
  const base = (x, y, z) => {
    const rx = x - C.x, ry = y - C.y, rz = z - C.z;
    const zf = ry * CP - rz * SP, yu = ry * SP + rz * CP;
    return { x: rx / zf, y: -yu / zf, d: zf };
  };
  // fit to where play happens (the aim limits), not the whole sheet: the sheet's far corners may run off the sides
  const fx = 2.4, pts = [[-fx, MAT.y0 + 0.2, 0], [fx, MAT.y0 + 0.2, 0], [-fx, MAT.y1 - 0.2, 0], [fx, MAT.y1 - 0.2, 0], [HAND.x - 0.6, HAND.y, HAND.z], [HAND.x + 0.6, HAND.y, HAND.z], [HAND.x, HAND.y - 0.55, HAND.z - 0.25], [0, MAT.y1 + 0.3, 0.5]];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { const q = base(p[0], p[1], p[2]); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  const zw = zone.w * (1 - 2 * pad), zh = zone.h * (1 - 2 * pad);
  const S = Math.max(1, Math.min(zw / (x1 - x0), zh / (y1 - y0)));
  const ox = zone.x + zone.w / 2 - ((x0 + x1) / 2) * S, oy = zone.y + zone.h / 2 - ((y0 + y1) / 2) * S;
  return {
    S, ox, oy, zone, eye: C, nearY: C.y + (0.35 - C.z * SP) / CP,
    proj(x, y, z = 0) { const q = base(x, y, z); return { x: ox + q.x * S, y: oy + q.y * S, d: q.d }; },
    // pixels per world unit along x on the floor at depth y (used for sizes of effects)
    unit(y) { return S / base(0, y, 0).d; },
    unproj(sx, sy) {
      const nx = (sx - ox) / S, ny = (sy - oy) / S;
      const dz = CP * -ny - SP;
      if (dz >= -1e-6) return null;
      const dy = SP * -ny + CP, tt = -C.z / dz;
      return { x: C.x + tt * nx, y: C.y + tt * dy };
    },
  };
}
