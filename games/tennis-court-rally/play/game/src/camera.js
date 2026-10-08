// The match camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD (which projects court
// positions through it). It never moves during play: the court is a fixed surface. Fluid layout: the picture is a function of the live
// screen aspect (camFor), so the 3D canvas fills a portrait or a landscape screen of any shape; the HUD and the aim taps use the same camera.
import { clamp } from './util.js';

export const FOV_BASE = 44;            // vertical degrees at the reference aspect 9:16
export const ASPECT_REF = 720 / 1280;

export function fovFor(aspect) {
  const t = Math.tan((FOV_BASE * Math.PI) / 360) * Math.max(1, ASPECT_REF / Math.max(0.2, aspect));
  return (2 * Math.atan(t) * 180) / Math.PI;
}

export function initialCam() { return { x: 0, y: 11, z: -20, lx: 0, ly: 0, lz: -1.5 }; }
export const camTarget = initialCam;
export function stepCam(cam) { Object.assign(cam, initialCam()); }

// Landscape camera: lower and further back so the whole court fits the short side, with the stands
// to the left and right of the court left free for the thumbs. Portrait keeps the approved phone camera. In between (tablets,
// squarish windows) the two blend smoothly with the aspect.
const LAND = { x: 0.0, y: 8.8, z: -19.0, lx: 0, ly: 0, lz: 0.5, fov: 34.5 };
const camCache = new Map();
export function camFor(aspect) {
  const key = Math.round(aspect * 1000);
  let c = camCache.get(key);
  if (c) return c;
  const t0 = clamp((aspect - 0.9) / (1.5 - 0.9), 0, 1), t = t0 * t0 * (3 - 2 * t0);
  const P = initialCam(), f0 = fovFor(aspect);
  const mix = (a, b) => a + (b - a) * t;
  c = { x: mix(P.x, LAND.x), y: mix(P.y, LAND.y), z: mix(P.z, LAND.z), lx: mix(P.lx, LAND.lx), ly: mix(P.ly, LAND.ly), lz: mix(P.lz, LAND.lz), fov: mix(f0, LAND.fov) };
  camCache.set(key, c);
  if (camCache.size > 60) camCache.delete(camCache.keys().next().value);
  return c;
}

// Project a world point to screen units on a W x H screen (virtual units or CSS pixels: same shape) showing the camera.
export function project(cam, W, H, x, y, z) {
  const aspect = W / H;
  const fov = cam.fov || fovFor(aspect);
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx;      // f x (0,1,0)
  const rl = Math.hypot(rx, ry, rz); rx /= rl; ry /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
  const xc = dx * rx + dy * ry + dz * rz, yc = dx * ux + dy * uy + dz * uz, zc = dx * fx + dy * fy + dz * fz;
  if (zc < 0.05) return null;
  const th = Math.tan((fov * Math.PI) / 360);
  const nx = xc / (zc * th * aspect), ny = yc / (zc * th);
  return { u: (nx + 1) * 0.5 * W, v: (1 - ny) * 0.5 * H, depth: zc };
}
// The screen IS the virtual space now (the 3D canvas covers exactly the virtual rectangle), so these are plain projections.
export function projectV(cam, W, H, x, y, z) { const p = project(cam, W, H, x, y, z); if (!p) return null; return { x: p.u, y: p.v, depth: p.depth }; }

function dirAt(cam, W, H, vx, vy) {
  const aspect = W / H, fov = cam.fov || fovFor(aspect), th = Math.tan((fov * Math.PI) / 360);
  const nx = (vx / W) * 2 - 1, ny = 1 - (vy / H) * 2;
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  return [fx + rx * nx * th * aspect + ux * ny * th, fy + ry * nx * th * aspect + uy * ny * th, fz + rz * nx * th * aspect + uz * ny * th];
}
// Inverse: the point on the plane y = h under a tap (virtual coordinates)
export function unprojectV(cam, W, H, vx, vy, h = 0) {
  const [dirx, diry, dirz] = dirAt(cam, W, H, vx, vy);
  if (Math.abs(diry) < 1e-6) return null;
  const t = (h - cam.y) / diry;
  if (t < 0) return null;
  return { x: cam.x + dirx * t, z: cam.z + dirz * t };
}
// The camera ray through a tap (virtual coordinates): { o: origin, d: unit direction }
export function rayAt(cam, W, H, vx, vy) {
  let [dx, dy, dz] = dirAt(cam, W, H, vx, vy);
  const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
  return { o: { x: cam.x, y: cam.y, z: cam.z }, d: { x: dx, y: dy, z: dz } };
}
