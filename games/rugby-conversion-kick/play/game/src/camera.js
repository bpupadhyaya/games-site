// The one camera: the same function places the 3D camera (presenter) and projects HUD marks onto the picture (aim marker, ring, ghost path),
// so the two can never disagree. Sim axes: x to the kicker's right, y up, z toward the posts. The WebGL scene mirrors x (three.js is right handed).
import { GOAL_HW } from './consts.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Camera for a screen of w x h virtual units. `band` is the part of the screen the picture should be composed in (the rest holds controls).
 * s: the sim state (spot, aim, phase, ball). Returns the world camera (sim axes) and the pixel-space projection: f (focal, units), cx, cy.
 */
export function camFor(w, h, s, band) {
  const b = band || { left: 0, top: 0, right: w, bottom: h };
  const bw = b.right - b.left, bh = b.bottom - b.top, wide = bw > bh * 1.15;
  const sx = s.spot.sx, d = s.spot.d;
  const ux = -sx, uz = d, ul = Math.hypot(ux, uz) || 1, dx = ux / ul, dz = uz / ul;         // from the tee toward the middle of the posts
  const back = wide ? 9.6 : 9.4, hc = wide ? 2.5 : 2.4;
  const C = [sx - dx * back, hc, -d - dz * back];
  const dist = d + back;
  const aimExt = Math.max(Math.abs(s.aimX) * 1.12 + 1.5, GOAL_HW * 2.2, 5.5);
  const fW = (bw / 2) * dist / aimExt;
  const fCap = bh / (2 * Math.tan((wide ? 17.5 : 18.5) * Math.PI / 180));
  let f = Math.min(fW, fCap);
  // look target: the posts (just above the bar line) until the ball is in the air, then follow it
  const k = s.phase === 'flight' ? 0.42 * sstep(0, 0.55, s.kickT || 0) : s.phase === 'result' ? 0.42 * (1 - sstep(0.9, 2.2, s.resultT || 0)) : 0;
  const T0 = [0, 3.6, 0];
  const bl = s.ball || { x: sx, y: 0, z: -d };
  const T = [T0[0] + (bl.x - T0[0]) * k, T0[1] + (bl.y + 1.2 - T0[1]) * k, T0[2] + (bl.z - T0[2]) * k * 0.9];
  const cx = b.left + bw / 2, cy = b.top + bh * (wide ? 0.37 : 0.46);
  // basis in three coordinates (x mirrored)
  const c3 = [-C[0], C[1], C[2]], t3 = [-T[0], T[1], T[2]];
  const fw = norm([t3[0] - c3[0], t3[1] - c3[1], t3[2] - c3[2]]);
  const rt = norm(cross(fw, [0, 1, 0])), up = cross(rt, fw);
  return { pos: C, look: T, f, cx, cy, fw, rt, up, c3, k, w, h };
}

/** Project a sim-axes point {x,y,z} to screen units. Returns { x, y, z (depth), s (units per metre at that depth) } or null when behind the camera. */
export function project(cam, p) {
  const rel = [-p.x - cam.c3[0], p.y - cam.c3[1], p.z - cam.c3[2]];
  const z = dot(rel, cam.fw);
  if (z < 0.3) return null;
  const X = dot(rel, cam.rt), Y = dot(rel, cam.up);
  return { x: cam.cx + (cam.f * X) / z, y: cam.cy - (cam.f * Y) / z, z, s: cam.f / z };
}

/** Where on the goal line (x metres) a screen x lands, for dragging the aim marker. */
export function goalXAt(cam, sx) {
  const z = cam.fw[2] !== 0 ? 0 : 0;
  void z;
  // intersect the ray through (sx, cy) with the plane z = 0 (the line of the posts) at the height of the bar
  const px = (sx - cam.cx) / cam.f;
  const ray = [cam.fw[0] + cam.rt[0] * px, cam.fw[1] + cam.rt[1] * px, cam.fw[2] + cam.rt[2] * px];
  const tt = (0 - cam.c3[2]) / (ray[2] || 1e-6);
  return -(cam.c3[0] + ray[0] * tt);
}
