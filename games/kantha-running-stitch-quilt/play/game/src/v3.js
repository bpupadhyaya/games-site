// Hand-off between the flat UI layer and the 3D presenter. Pure data and pure math: nothing here touches the simulation.
// The 3D scene and the 2D layout agree on ONE camera, built here from the cloth rectangle the layout hands out, so every marker,
// chip, tap and spark lands exactly on the 3D cloth.
//
// World: metres, y up. Cloth unit (x, y) -> world (X, Z) = ((x - size/2) * UNIT, (y - size/2) * UNIT); the cloth top is y = 0.
// Screen right = +X, screen down = +Z (camera on the +Z side).
export const UNIT = 0.03;   // metres per cloth unit: the 10 x 10 patch is a 30 cm panel; a stitch dash is 11 mm, the thread 4.8 mm (bold kantha)
export const v3 = {
  on: false,          // the WebGL scene is behind the transparent canvas (false: flat fallback draws everything)
  W: 720, H: 1560,    // layout size the cameras are built for (kept current by game.update / render)
  hero: null,         // title hero rectangle (set by the title drawing code)
  gauge: null,        // rectangle where the 3D spool is drawn { x, y, w, h, frac, slot }
  figure: null,       // baked figure sprites by kind (once the presenter has made them)
  tiles: null,        // baked quilt tile sprites
  t: 0,
  makeCanvas: null,   // (w, h) => canvas, installed by main.js (src never touches the DOM)
  frame: null, dim: 0, bake: null,
};
export const PITCH = (58 * Math.PI) / 180, FOV = (28 * Math.PI) / 180;

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// A look-at camera with a final affine in NDC (zoom + shift) that makes a set of world points fill a target rectangle.
//   o: { yaw, pitch, dist, fov, target }, W/H: layout size; rect: target rectangle in layout units; pts: world points to fit
export function makeCamera(o, W, H, rect, pts) {
  const yaw = o.yaw ?? 0, pitch = o.pitch ?? PITCH, dist = o.dist ?? 1.6, fov = o.fov ?? FOV;
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
    cam.s = s; cam.ox = (tx0 + tx1) / 2 - (s * (x0 + x1)) / 2; cam.oy = (ty0 + ty1) / 2 - (s * (y0 + y1)) / 2;
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
export function cameraFromParams(p, W, H) {
  const c = makeCamera({ yaw: p.yaw, pitch: p.pitch, dist: p.dist, fov: p.fov, target: p.T }, W, H, null, null);
  c.s = p.s; c.ox = p.ox; c.oy = p.oy; return c;
}
export const parOf = (c) => ({ yaw: c.yaw, pitch: c.pitch, dist: c.dist, fov: c.fov, T: c.T, s: c.s, ox: c.ox, oy: c.oy });

// The cloth camera: a pure function of the flat cloth rectangle (layout.patchGeo's rect) and the layout size, cached.
const cache = new Map();
export function clothCamera(rect, size, W, H, o = {}) {
  const key = `${W}|${H}|${Math.round(rect.x * 4)}|${Math.round(rect.y * 4)}|${Math.round(rect.w * 4)}|${Math.round(rect.h * 4)}|${size}|${o.pitch ?? 0}|${o.yaw ?? 0}|${o.up ?? 0}`;
  let c = cache.get(key);
  if (c) return c;
  const h = (size / 2) * UNIT, y = o.up ?? 0;
  c = makeCamera({ pitch: o.pitch ?? PITCH, yaw: o.yaw ?? 0, dist: 1.1, fov: FOV }, W, H, rect, [[-h, y, -h], [h, y, -h], [h, y, h], [-h, y, h]]);
  c.size = size;
  cache.set(key, c);
  if (cache.size > 48) cache.delete(cache.keys().next().value);
  return c;
}
export const toWorld = (x, y, size = 10) => [(x - size / 2) * UNIT, (y - size / 2) * UNIT];
// cloth units -> layout units through the cloth camera (h: height above the cloth in metres)
export function clothToScreen(cam, x, y, h = 0) { const w = toWorld(x, y, cam.size); return cam.project(w[0], h, w[1]); }
// layout units -> cloth units (on the cloth plane)
export function screenToCloth(cam, sx, sy) { const p = cam.pick(sx, sy, 0); return { x: p.X / UNIT + cam.size / 2, y: p.Z / UNIT + cam.size / 2 }; }
