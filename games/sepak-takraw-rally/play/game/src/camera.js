// The match camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD (which projects court
// positions through it). Everything is a function of the simulation state and the live screen shape, so the HUD and the picture can never disagree.
import { clamp } from './util.js';

export const FOV_BASE = 48;            // vertical degrees at the reference aspect 9:16
export const ASPECT_REF = 720 / 1280;

// Live shape of the HUD canvas in virtual units (layout.js keeps it current) and the share of the screen WIDTH that is free for the court
// when side panels are shown (landscape). Both only affect drawing, never the simulation.
export const VIRT = { w: 720, h: 1280, side: 1 };
export function setVirtual(w, h, side = 1) { VIRT.w = w; VIRT.h = h; VIRT.side = side; }

// Framing per aspect (the camera position never moves; only the lens does, so the court never pans or zooms during play):
//  - portrait (aspect < 1): the horizontal field of view is held at its 9:16 value on narrow phones (more sky above and floor below on tall
//    phones), and the vertical one at 48 degrees on squarer portrait screens, so both sides of the net stay in frame;
//  - landscape: the court has to sit between the side control panels, so the lens is widened until the court (about 7.4 m with the
//    players' reach) fits the middle `side` share of the width, between 48 and 62 degrees vertically.
export function fovFor(aspect, side = VIRT.side) {
  const t24 = Math.tan((FOV_BASE * Math.PI) / 360);
  let t;
  if (aspect < 1) t = t24 * Math.max(1, ASPECT_REF / Math.max(0.2, aspect));
  else {
    const need = 3.7 / 9.5 / clamp(side, 0.3, 1) / aspect;           // tan of the half vertical angle that fits the court in `side` of the width
    t = clamp(need, t24, Math.tan((62 * Math.PI) / 360));
  }
  return (2 * Math.atan(t) * 180) / Math.PI;
}

export function initialCam() { return { x: 0, y: 6.6, z: -10.6, lx: 0, ly: 0.1, lz: -0.2 }; }

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
// CSS pixels -> virtual coordinates and back
// (the kit's fluid view maps virtual units to CSS pixels with one uniform scale, centred; bars only appear beyond its maximum aspect)
export const toVirtual = (u, v, W, H) => { const s = Math.min(W / VIRT.w, H / VIRT.h); return { x: (u - W / 2) / s + VIRT.w / 2, y: (v - H / 2) / s + VIRT.h / 2 }; };
export const fromVirtual = (x, y, W, H) => { const s = Math.min(W / VIRT.w, H / VIRT.h); return { u: (x - VIRT.w / 2) * s + W / 2, v: (y - VIRT.h / 2) * s + H / 2 }; };
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
