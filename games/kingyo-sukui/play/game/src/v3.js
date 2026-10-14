// Hand-off between the flat UI layer and the 3D presenter. Pure data and pure math: nothing here touches the simulation.
// The 3D scene and the 2D layout agree on ONE camera, built here from the tank rectangle the layout hands out, so the finger,
// the ripples, the score pops and the Think ring all land exactly where the 3D water is.
//
// World: metres, y up. Tank unit (x, y) -> world (X, Z) = ((x - 500) * 0.001, (y - 400) * 0.001), the water surface is y = 0.
// Flat tank: screen right = +X, screen down = +Z (yaw 0, camera on the +Z side). Quarter-turned tank (tr.rot): screen down = +X
// (yaw 90 degrees, camera on the +X side), which is exactly layout.tankToScreen's rotated mapping.
import { TW, TH } from './sim.js';

export const WS = 0.001;
export const v3 = {
  on: false,             // the WebGL scene is behind the transparent canvas (false: flat fallback draws everything)
  hero: null,            // title / menu hero rectangle { x, y, w, h } in layout units, set by the menu drawing code
  sprites: null,         // pre-rendered goldfish portraits (canvas per kind) once the presenter has made them
  t: 0,
  makeCanvas: null,      // (w, h) => canvas, installed by main.js (src never touches the DOM)
};

// Tub geometry shared by the presenter and the camera fit (metres).
export const TUB = { hx: 0.5, hz: 0.4, rim: 0.058, rimY: 0.05, floorY: -0.13 };

const D2R = Math.PI / 180;
export const CAM = { fov: 30 * D2R, pitch: 62 * D2R, dist: 1.9 };

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// A look-at camera with a final affine in NDC (zoom + shift) that makes a chosen set of world points fill a target rectangle.
//   o: { yaw, pitch, dist, fov, target:[x,y,z] }, W/H: layout size; rect: target rectangle in layout units;
//   pts: world points that must fit inside rect (default: the tub rim)
export function makeCamera(o, W, H, rect, pts) {
  const yaw = o.yaw ?? 0, pitch = o.pitch ?? CAM.pitch, dist = o.dist ?? CAM.dist, fov = o.fov ?? CAM.fov;
  const T = o.target ?? [0, 0, 0];
  const C = [T[0] + dist * Math.sin(yaw) * Math.cos(pitch), T[1] + dist * Math.sin(pitch), T[2] + dist * Math.cos(yaw) * Math.cos(pitch)];
  const f = norm([T[0] - C[0], T[1] - C[1], T[2] - C[2]]);
  const r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  const th = Math.tan(fov / 2), asp = W / H;
  const cam = { C, f, r, u, fov, aspect: asp, yaw, pitch, dist, T, s: 1, ox: 0, oy: 0, W, H };
  const raw = (X, Y, Z) => {
    const v = [X - C[0], Y - C[1], Z - C[2]], zc = dot(v, f);
    return { x: dot(v, r) / zc / (th * asp), y: dot(v, u) / zc / th };
  };
  if (rect && pts) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { const q = raw(p[0], p[1], p[2]); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const tx0 = (rect.x / W) * 2 - 1, tx1 = ((rect.x + rect.w) / W) * 2 - 1, ty0 = 1 - ((rect.y + rect.h) / H) * 2, ty1 = 1 - (rect.y / H) * 2;
    const s = Math.min((tx1 - tx0) / Math.max(1e-6, x1 - x0), (ty1 - ty0) / Math.max(1e-6, y1 - y0));
    cam.s = s; cam.ox = (tx0 + tx1) / 2 - s * (x0 + x1) / 2; cam.oy = (ty0 + ty1) / 2 - s * (y0 + y1) / 2;
  }
  cam.project = (X, Y, Z) => { const q = raw(X, Y, Z); return { x: ((q.x * cam.s + cam.ox + 1) / 2) * W, y: ((1 - (q.y * cam.s + cam.oy)) / 2) * H }; };
  // the world point where the ray through layout (sx, sy) meets the horizontal plane at height Y
  cam.pick = (sx, sy, Y = 0) => {
    const nx = ((sx / W) * 2 - 1 - cam.ox) / cam.s, ny = (1 - (sy / H) * 2 - cam.oy) / cam.s;
    const d = [f[0] + r[0] * nx * th * asp + u[0] * ny * th, f[1] + r[1] * nx * th * asp + u[1] * ny * th, f[2] + r[2] * nx * th * asp + u[2] * ny * th];
    const k = (Y - C[1]) / (d[1] || -1e-6);
    return { X: C[0] + d[0] * k, Z: C[2] + d[2] * k };
  };
  return cam;
}

// Rebuild a camera from explicit parameters (used to blend between two cameras without a refit).
export function cameraFromParams(p, W, H) {
  const c = makeCamera({ yaw: p.yaw, pitch: p.pitch, dist: p.dist, fov: p.fov, target: p.T }, W, H, null, null);
  c.s = p.s; c.ox = p.ox; c.oy = p.oy; return c;
}
export const tubCorners = (inset = 0) => {
  const hx = TUB.hx + TUB.rim - inset, hz = TUB.hz + TUB.rim - inset, y = TUB.rimY;
  return [[-hx, y, -hz], [hx, y, -hz], [hx, y, hz], [-hx, y, hz]];
};

// The play camera: a pure function of the tank rectangle and the layout size, cached.
const cache = new Map();
export function playCamera(tr, W, H) {
  const key = `${W}|${H}|${Math.round(tr.x * 10)}|${Math.round(tr.y * 10)}|${Math.round(tr.w * 10)}|${Math.round(tr.h * 10)}|${tr.rot ? 1 : 0}`;
  let c = cache.get(key);
  if (c) return c;
  const pad = (TUB.rim / (tr.rot ? 2 * TUB.hz : 2 * TUB.hx)) * tr.w;   // rim width in layout units
  const rect = { x: tr.x - pad, y: tr.y - pad, w: tr.w + 2 * pad, h: tr.h + 2 * pad };
  c = makeCamera({ yaw: tr.rot ? Math.PI / 2 : 0 }, W, H, rect, tubCorners());
  c.tr = tr;
  cache.set(key, c);
  if (cache.size > 24) cache.delete(cache.keys().next().value);
  return c;
}

// tank units <-> layout units through the play camera
export const toWorld = (x, y) => [(x - TW / 2) * WS, (y - TH / 2) * WS];
export function tankToScreen3(tr, W, H, x, y, h = 0) {
  const c = playCamera(tr, W, H), w = toWorld(x, y);
  return c.project(w[0], h, w[1]);
}
export function toTank3(tr, W, H, sx, sy) {
  const c = playCamera(tr, W, H), p = c.pick(sx, sy, 0);
  return { x: p.X / WS + TW / 2, y: p.Z / WS + TH / 2 };
}
