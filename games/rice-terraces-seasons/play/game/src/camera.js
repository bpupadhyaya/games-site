// The play camera as pure maths: the same numbers place the WebGL camera (view3d/presenter.js) and project gate and plot positions to the screen (taps, rings, labels).
// A fixed oblique view from the valley looking up the slope, fitted to the free part of the screen (the rectangle the HUD leaves open).
import { mapBounds, tierY, plotZ, HD } from './geom.js';

export const FOV = 36;
export const elevFor = (aspect) => (aspect < 1 ? 50 : 38) * Math.PI / 180;       // steeper from above on a tall screen so the slope fills it
const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

function basis(dist, target, elev, az = 0) {
  const dir = { x: Math.sin(az) * Math.cos(elev), y: Math.sin(elev), z: Math.cos(az) * Math.cos(elev) };      // from the target towards the camera
  const pos = { x: target.x + dir.x * dist, y: target.y + dir.y * dist, z: target.z + dir.z * dist };
  const fwd = norm({ x: -dir.x, y: -dir.y, z: -dir.z });
  const right = norm(cross(fwd, { x: 0, y: 1, z: 0 }));
  const up = cross(right, fwd);
  return { pos, fwd, right, up };
}

// rect = the free screen area in virtual units { x, y, w, h }; SW x H = the whole screen
export function fitCamera(lv, SW, H, rect, az = 0, elevOverride = 0) {
  const pts = mapBounds(lv);
  const tanH = Math.tan(FOV * Math.PI / 360), asp = SW / H;
  const project = (b, p) => {
    const d = { x: p.x - b.pos.x, y: p.y - b.pos.y, z: p.z - b.pos.z };
    const zc = dot(d, b.fwd);
    const xc = dot(d, b.right), yc = dot(d, b.up);
    const nx = xc / (zc * tanH * asp), ny = yc / (zc * tanH);
    return { x: (nx * 0.5 + 0.5) * SW, y: (0.5 - ny * 0.5) * H, z: zc };
  };
  const elev = elevOverride || elevFor(asp);
  let target = { x: 0, y: tierY(lv, 0) * 0.5 + 0.4, z: plotZ(lv, 0) * 0.5 + plotZ(lv, lv.R - 1) * 0.5 - 0.4 };
  let dist = 30;
  for (let it = 0; it < 14; it++) {
    const b = basis(dist, target, elev, az);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { const q = project(b, p); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const k = Math.max((x1 - x0) / rect.w, (y1 - y0) / rect.h);
    dist *= Math.min(1.35, Math.max(0.74, k));
    const b2 = basis(dist, target, elev, az);
    x0 = 1e9; x1 = -1e9; y0 = 1e9; y1 = -1e9;
    for (const p of pts) { const q = project(b2, p); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const dx = (x0 + x1) / 2 - (rect.x + rect.w / 2), dy = (y0 + y1) / 2 - (rect.y + rect.h / 2);
    const wpp = (2 * dist * tanH) / H;
    target = { x: target.x + b2.right.x * dx * wpp - b2.up.x * dy * wpp, y: target.y + b2.right.y * dx * wpp - b2.up.y * dy * wpp, z: target.z + b2.right.z * dx * wpp - b2.up.z * dy * wpp };
  }
  const b = basis(dist, target, elev, az);
  return { ...b, target, dist, fov: FOV, aspect: asp, SW, H, project: (p) => project(b, p), px: (SW) => SW };
}
