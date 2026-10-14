// The side-on tracking camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD / input (which project
// field points through it and turn a finger position back into a field point). The camera rides along the field on the near side and
// looks across the lanes; `cam = { z, span }` (field position and visible width in metres) is smoothed by game.js from the sim.
// Sim axes: x = lane axis (+x near the camera), y up, z along the field (screen RIGHT). Three space mirrors x (x_three = -x_sim).
import { clamp } from './util.js';
import { LANES } from './consts.js';

const T = Math.tan, A = Math.atan;
export function viewFor(aspect) {
  if (globalThis.__viewOverride) return globalThis.__viewOverride;     // dev only: icon / art renders
  return aspect < 1.05
    ? { dist: 22, height: 15, frac: 0.52, spanMin: 15, spanMax: 40, behind: true, tilt: 28, vfov: 40, width: 9.4 }
    : { dist: 17, height: 7, frac: 0.64, spanMin: 11, spanMax: 36 };
}
// aspect = width / height of the 3D canvas; cam = { z, span }
export function rigFor(aspect, cam) {
  const v = viewFor(aspect), span = Math.max(3, cam.span);
  if (v.behind) return portraitRig(v, aspect, cam, span);
  const dLook = Math.hypot(v.dist, v.height - 1.5);
  const tanH = (span / 2) / dLook, tanV = tanH / aspect;
  const half = A(tanV);
  const thetaG = A(v.height / v.dist);
  const thetaC = thetaG - A((v.frac - 0.5) * 2 * T(half));      // centre ray pitch so the middle lane lands at `frac` of the height
  const lookY = cam.ly !== undefined ? cam.ly : v.height - v.dist * T(thetaC);
  const rig = { pos: [-v.dist, v.height, cam.z], look: [0, lookY, cam.z], fov: (2 * half * 180) / Math.PI, aspect, tanH, tanV, span, kind: aspect < 1.05 ? 'portrait' : 'land' };
  return globalThis.__rigOverride ? globalThis.__rigOverride(rig) : rig;      // dev only: icon / art renders
}
// Portrait: the field runs UP the tall screen. The camera stands behind the -z end, tilted down about 43 degrees, looking along +z; the three
// lanes sit side by side across the width (sim +x = screen right) and the riders get the whole height of the phone to run in.
function portraitRig(v, aspect, cam, span) {
  const tv = T((v.vfov * Math.PI) / 360), th = tv * aspect, tilt = (v.tilt * Math.PI) / 180;
  const dW = (v.width / 2) / th;                                     // distance at which the lanes fill the width
  const dD = (span * 1.18 * Math.sin(tilt)) / (2 * tv);              // distance at which the field depth fills the height
  const d = Math.max(dW, dD);
  const ly = 1.0, lz = cam.z + 0.12 * span * 0;
  const cx = 1.3;                                    // lanes sit right of the pace bar on the left edge
  const pos = [cx, ly + d * Math.sin(tilt), lz - d * Math.cos(tilt)];
  // shift the picture so the action sits at `frac` of the height (HUD above and below): rotate the centre ray
  const shift = A((v.frac - 0.5) * 2 * tv);
  const pitch = -tilt + shift;                                        // downward look angle (negative = down)
  const look = [cx, pos[1] + Math.sin(pitch) * d, pos[2] + Math.cos(pitch) * d];
  const rig = { pos, look, fov: v.vfov, aspect, tanH: th, tanV: tv, span, kind: 'portrait', dist: d };
  return globalThis.__rigOverride ? globalThis.__rigOverride(rig) : rig;
}
function basis(rig) {
  const [px, py, pz] = rig.pos, [lx, ly, lz] = rig.look;
  let fx = lx - px, fy = ly - py, fz = lz - pz; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  // right = f x up(0,1,0)
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  return { fx, fy, fz, rx, ry, rz, ux, uy, uz };
}
// sim point -> css pixels on a W x H canvas
export function project(rig, W, H, x, y, z) {
  const b = basis(rig), [px, py, pz] = rig.pos;
  const dx = -x - px, dy = y - py, dz = z - pz;
  const zc = dx * b.fx + dy * b.fy + dz * b.fz;
  if (zc < 0.2) return null;
  const xc = dx * b.rx + dy * b.ry + dz * b.rz, yc = dx * b.ux + dy * b.uy + dz * b.uz;
  return { u: (xc / (zc * rig.tanH) + 1) * 0.5 * W, v: (1 - yc / (zc * rig.tanV)) * 0.5 * H, depth: zc };
}
// css pixels -> the sim point where that pixel's ray meets the horizontal plane y = plane
export function unproject(rig, W, H, u, v, plane = 0) {
  const b = basis(rig), [px, py, pz] = rig.pos;
  const nx = (u / W) * 2 - 1, ny = 1 - (v / H) * 2;
  const dx = b.fx + nx * rig.tanH * b.rx + ny * rig.tanV * b.ux, dy = b.fy + nx * rig.tanH * b.ry + ny * rig.tanV * b.uy, dz = b.fz + nx * rig.tanH * b.rz + ny * rig.tanV * b.uz;
  if (dy > -1e-4) return null;
  const t = (plane - py) / dy;
  return { x: -(px + dx * t), z: pz + dz * t };
}
// css px (u, v) on a W x H screen to virtual units of the live fluid viewport vw x vh (one scale for both axes, centred)
export const toVirtual = (u, v, W, H, vw, vh) => { const s = Math.min(W / vw, H / vh); return { x: (u - W / 2) / s + vw / 2, y: (v - H / 2) / s + vh / 2 }; };
export const fromVirtual = (x, y, W, H, vw, vh) => { const s = Math.min(W / vw, H / vh); return { u: (x - vw / 2) * s + W / 2, v: (y - vh / 2) * s + H / 2 }; };

// where the camera wants to be for a sim state: between the two riders with some room ahead of the action
export function camTarget(s, aspect, ext = null) {
  const v = viewFor(aspect);
  const a = s.riders[s.act[0]], b = s.riders[s.act[1]];
  let lo = Math.min(a.z, b.z), hi = Math.max(a.z, b.z);
  if (ext !== null && (s.phase === 'pass')) { lo = Math.min(lo, ext); hi = Math.max(hi, ext); }   // keep the aim ring in the picture
  let zc = (lo + hi) / 2, sep = hi - lo;
  const pad = aspect < 1.05 ? 6 : 6;
  let span = clamp(sep + pad * 1.4, v.spanMin, v.spanMax);
  if (s.phase === 'intro' || s.phase === 'pass' || s.phase === 'reset') zc += s.dir * Math.min(0.05 * span, 1.2);
  if (s.phase === 'wheel') span = Math.max(span, v.spanMin + (v.spanMax - v.spanMin) * 0.45);
  return { z: zc, span };
}
export const laneRows = (rig, W, H, z) => LANES.map((x) => project(rig, W, H, x, 0, z));
