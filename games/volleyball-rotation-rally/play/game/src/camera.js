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
