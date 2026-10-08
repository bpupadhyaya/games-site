// Camera framing (pure). The game decides the camera, the presenter just sets it. project() maps a world point to virtual
// screen units with exactly the same maths as the presenter, so the HUD can pin markers to the 3D scene.
import { clamp, lerp, smooth, HALF_LEN } from './common.js';

export function chaseCam(w, L, extra = {}) {
  const me = w.boats[0];
  const wide = L.mode === 'wide';
  const asp = L.w / L.h;
  const focus = me.x * 0.82;
  const dist = (wide ? 12.5 : 21) + (extra.back ?? 0);
  const eye = [focus + clamp(me.vx, -3, 3) * 0.25, wide ? 3.6 : 6.0, me.z - dist];
  const at = [me.x * 0.92, 0.6, me.z + (wide ? 16 : 12)];
  return { eye, at, fov: wide ? 44 : clamp(52 + (0.5 - Math.min(asp, 0.5)) * 20, 48, 62), ox: 0, oy: wide ? 0.02 : 0.14, roll: -clamp(me.vx, -3, 3) * 0.006 };
}

// count-in swing: from a low front-quarter view over the dragon head round to the chase position
export function introCam(w, L) {
  const me = w.boats[0], k = smooth(clamp((w.t + 3) / 3, 0, 1));
  const c = chaseCam(w, L);
  const ang = (1 - k) * 2.5, rad = lerp(13, 17.5, k), h = lerp(2.6, 5.4, k);
  const sd = me.x >= 0 ? -1 : 1;
  const eye = [me.x + Math.sin(ang) * rad * sd, h, me.z + HALF_LEN - Math.cos(ang) * rad + (1 - k) * 8];
  const at = [lerp(me.x, c.at[0], k), lerp(1.4, 0.6, k), lerp(me.z + 5, c.at[2], k)];
  return { eye, at, fov: lerp(46, c.fov, k), ox: 0, oy: c.oy * k, roll: 0 };
}

// after the line: slow orbit around the winner's bow
export function finishCam(w, L, tAfter) {
  const me = w.boats[0], a = 0.6 + tAfter * 0.35, rad = 15;
  return { eye: [me.x + Math.sin(a) * rad, 3.2 + Math.sin(tAfter * 0.7) * 0.6, me.z + 2 - Math.cos(a) * rad * 0.7], at: [me.x, 1.2, me.z + 4], fov: 46, ox: 0, oy: L.mode === 'wide' ? 0 : 0.1, roll: 0 };
}

// menu backdrop: a low head-on sweep of the leading crew, framed in the free region beside / above the menu
export function titleCam(w, L, t) {
  const wide = L.mode === 'wide';
  let star = w.boats[0]; for (const b of w.boats) if (b.z > star.z) star = b;
  const a = t * 0.12;
  const eye = [star.x + (wide ? 4.2 : 3.4) + Math.sin(a) * 2.2, 1.7 + Math.sin(a * 1.3) * 0.25, star.z + HALF_LEN + (wide ? 15 : 17) + Math.cos(a * 0.7) * 2];
  return { eye, at: [star.x - 0.4, 1.7, star.z + 1], fov: wide ? 36 : 40, ox: wide ? 0.42 : 0, oy: wide ? 0.0 : 0.44, roll: 0 };
}

export function project(cam, L, x, y, z) {
  const e = cam.eye, a = cam.at;
  let fx = a[0] - e[0], fy = a[1] - e[1], fz = a[2] - e[2];
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const dx = x - e[0], dy = y - e[1], dz = z - e[2];
  const vz = dx * fx + dy * fy + dz * fz;
  if (vz < 0.2) return null;
  const vx = dx * rx + dy * ry + dz * rz, vy = dx * ux + dy * uy + dz * uz;
  const f = 1 / Math.tan((cam.fov * Math.PI) / 360), asp = L.w / L.h;
  const ndcX = (f / asp) * vx / vz + (cam.ox || 0), ndcY = f * vy / vz + (cam.oy || 0);
  return { x: (ndcX * 0.5 + 0.5) * L.w, y: (0.5 - ndcY * 0.5) * L.h, d: vz };
}
