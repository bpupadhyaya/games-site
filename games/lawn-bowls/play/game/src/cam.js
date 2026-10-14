// The camera over the green. World: x across the rink (+ = bowler's right), y along it (0 = front of the mat, + = toward the ditch), metres.
// Portrait: the rink runs UP the screen (mat at the bottom). Landscape: it runs ACROSS (mat at the left), turned clockwise, so the
// bowler's right is the bottom of the screen. A camera is { cx, cy, s }: the world point at the centre of `rect` and pixels per metre
// at that point.
//
// Two projectors share this interface: the flat top-down one (the 2D fallback) and a true perspective one (3D presenter). The 3D
// presenter builds its WebGL camera from camera3() below, the very numbers the perspective projector uses, so every 2D overlay (aim
// label, measuring lines, picking the target by touch) lines up with the lit scene exactly.
import { v3 } from './v3.js';

export const S_MIN = 9, S_MAX = 230;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RAD = Math.PI / 180;
export const FOV = 30;       // vertical field of view, degrees

// The perspective camera for a rect and a { cx, cy, s } camera. Ground point (x, y) at the centre of the rect is `cam.cx, cam.cy`.
export function camera3(rect, wide, cam) {
  const f = (rect.h / 2) / Math.tan((FOV * RAD) / 2);
  const s = clamp(cam.s, 4, 400);
  const D = f / s;
  const k = clamp((Math.log(s) - Math.log(24)) / (Math.log(120) - Math.log(24)), 0, 1);   // zoomed out: high and steep; close: low and flat
  const pitch = (54 - 14 * k) * RAD;
  const hx = wide ? -1 : 0, hy = wide ? 0 : 1;          // horizontal viewing direction on the ground
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return {
    f, D, pitch, hx, hy, ox: rect.x + rect.w / 2, oy: rect.y + rect.h / 2,
    px: cam.cx - hx * D * cp, py: cam.cy - hy * D * cp, ph: D * sp,
    cp, sp, rx: hy, ry: -hx,                              // screen-right on the ground
    fov: FOV, aspect: rect.w / rect.h,
  };
}

function perspective(rect, wide, cam) {
  const c = camera3(rect, wide, cam);
  const { f, ox, oy, px, py, ph, cp, sp, hx, hy, rx, ry } = c;
  // depth along the optical axis and the "up" component for a point at height z above the ground
  const proj = (x, y, z) => {
    const dx = x - px, dy = y - py, dz = z - ph;
    const fwd = (dx * hx + dy * hy) * cp - dz * sp;
    const up = (dx * hx + dy * hy) * sp + dz * cp;
    const rt = dx * rx + dy * ry;
    return { d: Math.max(0.05, fwd), up, rt };
  };
  return {
    s: cam.s, wide, c, persp: true,
    p: (x, y, z = 0) => { const q = proj(x, y, z); return { x: ox + (f * q.rt) / q.d, y: oy - (f * q.up) / q.d, d: q.d }; },
    // pixels per metre at a ground point
    sAt: (x, y) => f / proj(x, y, 0).d,
    inv: (sx, sy) => {
      // ray through the pixel, intersected with the ground plane
      const a = (sx - ox) / f, b = -(sy - oy) / f;
      const dirF = { h: cp, z: -sp }, dirU = { h: sp, z: cp };
      const dh = dirF.h + b * dirU.h, dz = dirF.z + b * dirU.z;          // along the horizontal viewing direction and vertical
      let t = dz < -0.02 ? -ph / dz : 1e3;
      t = Math.min(t, 1e3);
      const gx = px + hx * dh * t + rx * a * t, gy = py + hy * dh * t + ry * a * t;
      return { x: gx, y: gy };
    },
    fwd: wide ? { x: 1, y: 0 } : { x: 0, y: -1 }, right: wide ? { x: 0, y: 1 } : { x: 1, y: 0 },
  };
}

function flat(rect, wide, cam) {
  const ox = rect.x + rect.w / 2, oy = rect.y + rect.h / 2, s = cam.s;
  if (!wide) {
    return {
      s, wide,
      p: (x, y) => ({ x: ox + (x - cam.cx) * s, y: oy - (y - cam.cy) * s }),
      sAt: () => s,
      inv: (sx, sy) => ({ x: cam.cx + (sx - ox) / s, y: cam.cy - (sy - oy) / s }),
      fwd: { x: 0, y: -1 }, right: { x: 1, y: 0 },
    };
  }
  return {
    s, wide,
    p: (x, y) => ({ x: ox + (y - cam.cy) * s, y: oy + (x - cam.cx) * s }),
    sAt: () => s,
    inv: (sx, sy) => ({ x: cam.cx + (sy - oy) / s, y: cam.cy + (sx - ox) / s }),
    fwd: { x: 1, y: 0 }, right: { x: 0, y: 1 },
  };
}

export function projector(rect, wide, cam) { return v3.on ? perspective(rect, wide, cam) : flat(rect, wide, cam); }

// The camera that shows a world box { x0, x1, y0, y1 } inside `rect` (with a margin in px), as large as it can be.
export function fitBox(rect, wide, box, o = {}) {
  const m = o.margin ?? 14;
  const lo = o.min ?? S_MIN, hi = o.max ?? S_MAX;
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  if (!v3.on) {
    const bw = Math.max(0.2, box.x1 - box.x0), bh = Math.max(0.2, box.y1 - box.y0);
    const aw = Math.max(40, rect.w - 2 * m), ah = Math.max(40, rect.h - 2 * m);
    const sx = wide ? aw / bh : aw / bw, sy = wide ? ah / bw : ah / bh;
    return { cx, cy, s: clamp(Math.min(sx, sy), lo, hi) };
  }
  // perspective: find the largest scale at which every corner of the box (and a bowl's height above it) is inside the rect
  const fits = (s) => {
    const pr = perspective(rect, wide, { cx, cy, s });
    for (const x of [box.x0, box.x1]) for (const y of [box.y0, box.y1]) {
      const p = pr.p(x, y, 0);
      if (p.x < rect.x + m || p.x > rect.x + rect.w - m || p.y < rect.y + m || p.y > rect.y + rect.h - m) return false;
    }
    return true;
  };
  let a = lo, b = hi;
  if (fits(b)) return { cx, cy, s: b };
  for (let i = 0; i < 16; i++) { const mid = Math.sqrt(a * b); if (fits(mid)) a = mid; else b = mid; }
  return { cx, cy, s: clamp(a, lo, hi) };
}
