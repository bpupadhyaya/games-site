// The match camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD (which projects pitch positions
// through it). One fixed broadcast camera per screen shape: the pitch never moves, zooms, pans or tilts during play. Fluid layout: the
// camera is a function of the live virtual screen size (camFor), so the HUD and the picture can never disagree.
//   portrait (aspect < ~1): the original view from behind the near goal, the whole oval between the scoreboard and the controls;
//   wide (landscape): a side-on broadcast view so the long axis of the oval runs across the screen and the players stay readable.
import { HW, HL, ZG, GHW, BHW } from './consts.js';
import { isWide, pitchBand, host } from './layout.js';

export const CAM = { x: 0, y: 24, z: -62, lx: 0, ly: 0, lz: -12, fov: 48 };       // the original portrait camera at 9:16 (kept for dev tools)
export const SIDE = { dist: 62, h: 27 };                                          // the side camera stands this far off the touchline, this high (m)
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
function basis(cam) {
  const f = norm({ x: cam.lx - cam.x, y: cam.ly - cam.y, z: cam.lz - cam.z });
  const r = norm({ x: -f.z, y: 0, z: f.x });
  const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
  return { f, r, u };
}
const mk = (o) => { const c = { ...o }; Object.defineProperty(c, '_b', { value: null, writable: true, enumerable: false }); return c; };

// World point -> screen units on a W x H screen showing the camera (virtual units or CSS pixels: same shape).
export function project(cam, W, H, x, y, z) {
  const aspect = W / H, { f, r, u } = cam._b || (cam._b = basis(cam));
  const d = { x: x - cam.x, y: y - cam.y, z: z - cam.z };
  const zc = dot(d, f);
  if (zc < 0.05) return null;
  const th = Math.tan((cam.fov * Math.PI) / 360);
  const nx = dot(d, r) / (zc * th * aspect), ny = dot(d, u) / (zc * th);
  return { u: (nx + 1) * 0.5 * W, v: (1 - ny) * 0.5 * H, depth: zc };
}
// The screen IS the virtual space (the 3D canvas covers exactly the virtual rectangle), so this is a plain projection.
export function projectV(cam, W, H, x, y, z) { const p = project(cam, W, H, x, y, z); return p ? { x: p.u, y: p.v, depth: p.depth } : null; }

function solveEnd(w, h, band) {
  const pos = { x: CAM.x, y: CAM.y, z: CAM.z };
  const avail = Math.max(60, band.bottom - band.top), S = Math.min(380, Math.max(110, avail)), top = band.top + (avail - S) / 2;
  const at = (fov, lz) => { const c = mk({ ...pos, lx: 0, ly: 0, lz, fov }); return [project(c, w, h, 0, 0, 22), project(c, w, h, 0, 0, -22)]; };
  const lzFor = (fov) => {
    let a = -45, b = 45;
    for (let i = 0; i < 40; i++) { const m = (a + b) / 2, p = at(fov, m)[0]; if (!p || p.v < top) a = m; else b = m; }       // the far end's y rises with the target distance
    return (a + b) / 2;
  };
  let a = 12, b = 95;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2, [pf, pn] = at(m, lzFor(m)); if (pf && pn && pn.v - pf.v > S) a = m; else b = m; }     // a bigger fov makes the pitch smaller
  const fov = (a + b) / 2, lz = lzFor(fov);
  return mk({ ...pos, lx: 0, ly: 0, lz, fov, side: false, rx: -1, rz: 0, ux: 0, uz: 1 });
}

function solveSide(w, h, band) {
  const pos = { x: -SIDE.dist, y: SIDE.h, z: 0 };
  const pts = [];
  const RX = HW + 2, RZ = HL + 2;
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; pts.push({ x: Math.cos(a) * RX, y: 0, z: Math.sin(a) * RZ }); }
  for (const sg of [-1, 1]) for (const x of [-BHW, -GHW, GHW, BHW]) pts.push({ x, y: Math.abs(x) < 4 ? 6 : 3, z: sg * ZG });
  pts.push({ x: HW, y: 2.6, z: 0 }, { x: HW, y: 2.6, z: ZG }, { x: HW, y: 2.6, z: -ZG });         // heads of players on the far touchline
  const aspect = w / h;
  const cnx = ((band.left + band.right) / 2 / w) * 2 - 1, cny = 1 - (band.top + band.bottom) / h;
  const hnx = (band.right - band.left) / w, hny = (band.bottom - band.top) / h;
  let tg = { x: 0, y: 0, z: 0 }, th = 0.3;
  for (let it = 0; it < 14; it++) {
    const cam = { ...pos, lx: tg.x, ly: tg.y, lz: tg.z }, { f, r, u } = basis(cam);
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const p of pts) { const d = sub(p, pos), zc = dot(d, f); if (zc < 0.5) continue; const tu = dot(d, r) / zc, tv = dot(d, u) / zc; u0 = Math.min(u0, tu); u1 = Math.max(u1, tu); v0 = Math.min(v0, tv); v1 = Math.max(v1, tv); }
    th = Math.max((u1 - u0) / (2 * hnx * aspect), (v1 - v0) / (2 * hny));
    const eu = (u0 + u1) / 2 - cnx * th * aspect, ev = (v0 + v1) / 2 - cny * th, dist = Math.hypot(tg.x - pos.x, tg.y - pos.y, tg.z - pos.z);
    tg = { x: tg.x + r.x * eu * dist + u.x * ev * dist, y: tg.y + r.y * eu * dist + u.y * ev * dist, z: tg.z + r.z * eu * dist + u.z * ev * dist };
  }
  const fov = (2 * Math.atan(th) * 180) / Math.PI;
  return mk({ ...pos, lx: tg.x, ly: tg.y, lz: tg.z, fov: Math.min(80, Math.max(14, fov)), side: true, rx: 0, rz: 1, ux: 1, uz: 0 });
}

const camCache = new Map();
/** The match camera for a virtual screen of w x h units. cam.side tells which view it is; (rx,rz) / (ux,uz) are the ground directions of screen-right / screen-up. */
export function camFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${host.t},${host.b},${host.l},${host.r}`;
  let c = camCache.get(key);
  if (c) return c;
  const band = pitchBand(w, h);
  c = isWide(w, h) ? solveSide(w, h, band) : solveEnd(w, h, band);
  camCache.set(key, c);
  if (camCache.size > 50) camCache.delete(camCache.keys().next().value);
  return c;
}
