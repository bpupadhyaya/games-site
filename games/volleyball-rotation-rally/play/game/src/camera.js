// The match camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD (which projects court
// positions through it). Everything is a function of the simulation state, so the HUD and the picture can never disagree.
import { clamp } from './util.js';

export const FOV_BASE = 30;
export const ASPECT_REF = 720 / 1280;

export function fovFor(aspect) {
  const t = Math.tan((FOV_BASE * Math.PI) / 360) * Math.max(1, ASPECT_REF / Math.max(0.2, aspect));
  return (2 * Math.atan(t) * 180) / Math.PI;
}

export function initialCam() { return { x: 0, y: 22.5, z: -28, lx: 0, ly: 0, lz: -1 }; }

// Desired camera: a fixed broadcast position behind the near baseline, high enough to see over the net. The court never pans,
// zooms or pushes in (fixed surface rule); only the ball and the players move.
export function camTarget() { return initialCam(); }
export function stepCam(cam) { Object.assign(cam, camTarget()); }

// Project a world point to CSS pixels on a W x H screen showing the camera with the given aspect.
export function project(cam, W, H, x, y, z) {
  const aspect = W / H;
  const fov = fovFor(aspect);
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  // right = f x up(0,1,0)
  let rx = fy * 0 - fz * 1, ry = fz * 0 - fx * 0, rz = fx * 1 - fy * 0;      // f x (0,1,0) = (-fz, 0, fx)
  const rl = Math.hypot(rx, ry, rz); rx /= rl; ry /= rl; rz /= rl;
  // true up = r x f
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
  const xc = dx * rx + dy * ry + dz * rz, yc = dx * ux + dy * uy + dz * uz, zc = dx * fx + dy * fy + dz * fz;
  if (zc < 0.05) return null;
  const th = Math.tan((fov * Math.PI) / 360);
  const nx = xc / (zc * th * aspect), ny = yc / (zc * th);
  return { u: (nx + 1) * 0.5 * W, v: (1 - ny) * 0.5 * H, depth: zc };
}
// CSS pixels -> virtual (720x1280, letterboxed) coordinates and back
export const toVirtual = (u, v, W, H) => { const s = Math.min(W / 720, H / 1280); return { x: (u - W / 2) / s + 360, y: (v - H / 2) / s + 640 }; };
export const fromVirtual = (x, y, W, H) => { const s = Math.min(W / 720, H / 1280); return { u: (x - 360) * s + W / 2, v: (y - 640) * s + H / 2 }; };
export function projectV(cam, W, H, x, y, z) { const p = project(cam, W, H, x, y, z); if (!p) return null; const v = toVirtual(p.u, p.v, W, H); return { x: v.x, y: v.y, depth: p.depth }; }

// Inverse: the point on the plane y = h under a virtual-coordinate tap
export function unprojectV(cam, W, H, vx, vy, h = 0) {
  const aspect = W / H, fov = fovFor(aspect), th = Math.tan((fov * Math.PI) / 360);
  const { u, v } = fromVirtual(vx, vy, W, H);
  const nx = (u / W) * 2 - 1, ny = 1 - (v / H) * 2;
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const dirx = fx + rx * nx * th * aspect + ux * ny * th, diry = fy + ry * nx * th * aspect + uy * ny * th, dirz = fz + rz * nx * th * aspect + uz * ny * th;
  if (Math.abs(diry) < 1e-6) return null;
  const t = (h - cam.y) / diry;
  if (t < 0) return null;
  return { x: cam.x + dirx * t, z: cam.z + dirz * t };
}

// ------------------------------------------------------------------------------------------------------------------------------
// Fluid layout (1.1.0): the camera is a pure function of the live screen size. The picture always fills the whole screen; the 2D HUD
// and the 3D presenter both read the same frame, so they can never disagree.
//   tall  (portrait, aspect <= 9:16): the approved look, unchanged (fov follows the width).
//   fit   (squarer portrait: tablets, 3:4): same camera spot, zoom and aim solved so the court fills the free area between the HUD bars.
//   wide  (landscape): a lower, closer camera (still on the centre line behind the near baseline, so screen right stays world -x and up
//         stays +z) and a zoom / aim solved so the whole court sits in the middle, between the side panels.
const HWC = 4.5, HLC = 9.0;
const WIDE_CAM = { x: 0, y: 17, z: -27 };
function basis(cam) {
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  return { fx, fy, fz, rx, ry: 0, rz, ux: -rz * fy, uy: rz * fx - rx * fz, uz: rx * fy };
}
// Points that must stay on screen: the court with a little run-off, the far side at head height, the net posts.
const FIT_PTS = [[-HWC - 1, 0, -HLC - 1.4], [HWC + 1, 0, -HLC - 1.4], [-HWC - 1, 2.3, HLC + 0.6], [HWC + 1, 2.3, HLC + 0.6], [-HWC - 0.6, 2.7, 0], [HWC + 0.6, 2.7, 0], [-HWC - 1, 0, 0], [HWC + 1, 0, 0]];
function fitFov(cam, aspect, rn) {
  const b = basis(cam); let th = 0;
  for (const [x, y, z] of FIT_PTS) {
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    const zc = dx * b.fx + dy * b.fy + dz * b.fz; if (zc < 0.5) return Infinity;
    const a = (dx * b.rx + dz * b.rz) / zc / aspect, c = (dx * b.ux + dy * b.uy + dz * b.uz) / zc;
    if (a > 0) th = Math.max(th, a / rn.r); else th = Math.max(th, a / rn.l);
    if (c > 0) th = Math.max(th, c / rn.t); else th = Math.max(th, c / rn.b);
  }
  return th;
}
// rect = where the court may be drawn, in virtual units {x0, y0, x1, y1} on a W x H screen.
export function frameFor(W, H, rect, mode, baseOverride) {
  const aspect = W / H;
  if (mode === 'tall') return { ...initialCam(), fov: fovFor(aspect) };
  const rn = { l: (2 * rect.x0) / W - 1, r: (2 * rect.x1) / W - 1, t: 1 - (2 * rect.y0) / H, b: 1 - (2 * rect.y1) / H };
  const base = baseOverride || (mode === 'wide' ? WIDE_CAM : initialCam());
  let best = null;
  for (let lz = -12; lz <= 12.001; lz += 0.25) {
    const cam = { x: base.x, y: base.y, z: base.z, lx: 0, ly: 0, lz };
    const th = fitFov(cam, aspect, rn);
    if (!isFinite(th)) continue;
    if (!best || th < best.th) best = { th, cam };
  }
  const th = Math.max(Math.tan((12 * Math.PI) / 360), Math.min(best.th, Math.tan((60 * Math.PI) / 360)));
  return { ...best.cam, fov: (2 * Math.atan(th) * 180) / Math.PI };
}
// World point -> virtual (HUD) coordinates for a frame; the virtual space is exactly the screen (no letterbox).
export function projectF(fr, W, H, x, y, z) {
  const aspect = W / H, b = basis(fr), th = Math.tan((fr.fov * Math.PI) / 360);
  const dx = x - fr.x, dy = y - fr.y, dz = z - fr.z;
  const zc = dx * b.fx + dy * b.fy + dz * b.fz; if (zc < 0.05) return null;
  const nx = (dx * b.rx + dz * b.rz) / (zc * th * aspect), ny = (dx * b.ux + dy * b.uy + dz * b.uz) / (zc * th);
  return { x: (nx + 1) * 0.5 * W, y: (1 - ny) * 0.5 * H, depth: zc };
}
