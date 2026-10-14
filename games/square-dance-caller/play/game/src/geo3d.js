// Shared geometry of the 3D floor: floor units -> metres, and one pure pinhole camera that both the 3D presenter (web/view3d) and the 2D overlay
// (arrows, number tags, confetti drawn on the kit canvas) use, so the overlay always lands exactly on the 3D picture. No DOM, no three.js.
export const S = 1.75;                       // metres per floor unit: couples stand about 0.8 m apart, the ring radius is 1.8 m
export const HALF = 1.35;                    // half the floor (floor units); the plank floor with its rail spans 2 * HALF
export const EL = (62 * Math.PI) / 180;      // camera elevation above the floor
export const FOV = (31 * Math.PI) / 180;     // vertical field of view
const T = [0, 0.7, 0];                       // look-at point (metres)
const CACHE = new Map();

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// a taller-than-wide rectangle (portrait phones) gets a steeper look-down so the floor fills the height instead of leaving empty bands
const elFor = (aspect) => EL + ((78 - 62) * Math.PI / 180) * Math.max(0, Math.min(1, (1 / aspect - 1) / 0.06));
function camAt(d, aspect) {
  const el = elFor(aspect);
  const C = [T[0], T[1] + Math.sin(el) * d, T[2] + Math.cos(el) * d];
  const f = norm([T[0] - C[0], T[1] - C[1], T[2] - C[2]]);
  const r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  return { C, T, f, r, u, th: Math.tan(FOV / 2), aspect, d };
}
function ndc(cam, p) {
  const v = [p[0] - cam.C[0], p[1] - cam.C[1], p[2] - cam.C[2]], z = dot(v, cam.f);
  return { x: dot(v, cam.r) / (z * cam.th * cam.aspect), y: dot(v, cam.u) / (z * cam.th), z };
}
// the points that must stay inside the rectangle: the floor with its rail, and head height above the far half of the ring
const FIT_POINTS = (() => {
  const h = HALF * S, out = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { out.push([sx * h, 0, sz * h]); }
  for (const sx of [-1, 0, 1]) out.push([sx * 1.2 * S, 2.0, -1.2 * S], [sx * 1.2 * S, 0, 1.2 * S]);
  out.push([-1.25 * S, 2.0, 0], [1.25 * S, 2.0, 0], [-1.25 * S, 0, 0], [1.25 * S, 0, 0]);
  return out;
})();

// camera for a rectangle of w x h (any unit): the nearest distance at which everything above is inside, with a small margin
export function fitCamera(w, h) {
  const aspect = Math.max(0.2, w / Math.max(1, h)), key = `${aspect.toFixed(3)}`;
  let c = CACHE.get(key);
  if (c) return c;
  let lo = 4, hi = 80;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2, cam = camAt(mid, aspect);
    let ok = true;
    for (const p of FIT_POINTS) { const n = ndc(cam, p); if (n.z <= 0.2 || Math.abs(n.x) > 0.985 || Math.abs(n.y) > 0.985) { ok = false; break; } }
    if (ok) hi = mid; else lo = mid;
  }
  c = camAt(hi, aspect);
  if (CACHE.size > 20) CACHE.clear();
  CACHE.set(key, c);
  return c;
}
// world point (metres) -> position in rectangle R {x,y,w,h}; k = pixels per metre at that depth
export function project(cam, R, x, y, z) {
  const n = ndc(cam, [x, y, z]);
  const px = R.x + R.w / 2 + n.x * R.w / 2, py = R.y + R.h / 2 - n.y * R.h / 2;
  const k = (R.h / 2) / (n.z * cam.th);
  return { x: px, y: py, k };
}
// floor units (x right, y up the screen) + height in metres -> screen
export const floorPoint = (cam, R, fx, fy, hm = 0) => project(cam, R, fx * S, hm, -fy * S);
