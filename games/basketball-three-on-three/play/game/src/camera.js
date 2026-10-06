// The broadcast camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD (which projects court
// positions through it). One fixed position and direction: the camera never pans, tilts or shakes. FLUID LAYOUT: the screen is any
// shape (portrait, landscape, tablets), so the FRAMING is solved from the live size: `fitCamera(w, h, rect)` picks the field of view and
// a small principal-point shift so the whole half court (floor, hoop, head height) fills the rectangle `rect` of the screen, centred and
// never stretched. The 3D canvas covers the screen; the HUD projects through the same numbers (`projectL`).
export const ASPECT_REF = 720 / 1280;
// A telephoto broadcast view from beside the court, high above the near sideline: the WHOLE half court (corners, wings, sidelines, the
// half-court line) is inside the picture. Screen right is world -z (towards the hoop, which stands at the right); screen up is world -x
// (the far sideline). True perspective, never moves: the near sideline is about 1.5 times larger than the far one.
export const CAM = { x: 32.9, y: 14.6, z: 3.8, lx: 2, ly: 0, lz: 3.8, hfov: 26 };
// stick / key direction on the screen (right, down) -> world direction (x, z) on the floor
export function screenToWorld(sx, sy, cam = CAM) {
  let fx = cam.lx - cam.x, fz = cam.lz - cam.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
  const rx = -fz, rz = fx;                         // right = forward x up, flattened
  return { x: rx * sx - fx * sy, z: rz * sx - fz * sy };
}
// The whole half court is inside the picture, so players only stay inside the lines (kept for the AI and the sim: same call as before)
export function visHalfWidth() { return 7.35; }

export function project(cam, W, H, x, y, z) {
  // W x H = the CSS size of the (pillarboxed) 3D canvas; returns CSS pixels in that canvas
  const thx = Math.tan((cam.hfov * Math.PI) / 360);
  const aspect = W / H, thy = thx / aspect;
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
  const xc = dx * rx + dy * ry + dz * rz, yc = dx * ux + dy * uy + dz * uz, zc = dx * fx + dy * fy + dz * fz;
  if (zc < 0.05) return null;
  const nx = xc / (zc * thx), ny = yc / (zc * thy);
  return { u: (nx + 1) * 0.5 * W, v: (1 - ny) * 0.5 * H, depth: zc, scale: W / (2 * thx * zc) };
}
// CSS pixels of the 3D canvas -> virtual (720 x 1280) coordinates and back. The 3D canvas is as wide as the virtual rect (scaled).
export const toVirtual = (u, v, W, H) => { const s = Math.min(W / 720, H / 1280); return { x: (u - W / 2) / s + 360, y: (v - H / 2) / s + 640 }; };
export const fromVirtual = (x, y, W, H) => { const s = Math.min(W / 720, H / 1280); return { u: (x - 360) * s + W / 2, v: (y - 640) * s + H / 2 }; };
// For the HUD: project with the reference 720 x 1280 canvas so the result is directly in virtual units (the real screen scales it uniformly)
export function projectV(cam, x, y, z) { const p = project(cam, 720, 1280, x, y, z); return p ? { x: p.u, y: p.v, depth: p.depth, scale: p.scale } : null; }
// Inverse: the floor point under a virtual coordinate
export function unprojectV(cam, vx, vy, h = 0) {
  const thx = Math.tan((cam.hfov * Math.PI) / 360), thy = thx / ASPECT_REF;
  const nx = (vx / 720) * 2 - 1, ny = 1 - (vy / 1280) * 2;
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const dirx = fx + rx * nx * thx + ux * ny * thy, diry = fy + ry * nx * thx + uy * ny * thy, dirz = fz + rz * nx * thx + uz * ny * thy;
  if (Math.abs(diry) < 1e-6) return null;
  const t = (h - cam.y) / diry;
  if (t < 0) return null;
  return { x: cam.x + dirx * t, z: cam.z + dirz * t };
}

// ---- fluid framing ---------------------------------------------------------------------------------------------------------------
// The points that must stay on screen: the floor corners, head height above them (a jumping player), and the top of the backboard.
const FIT_PTS = (() => {
  const a = [];
  for (const x of [-7.5, 7.5]) for (const z of [-1.575, 9.425]) { a.push([x, 0, z], [x, 2.9, z]); }
  a.push([-2.1, 5.15, -0.9], [2.1, 5.15, -0.9]);
  return a;
})();
function basis(cam) {
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  return { fx, fy, fz, rx, ry, rz, ux, uy, uz };
}
const BASIS = basis(CAM);
function normalized(x, y, z, aspect) {   // x/y in "per thx" units: screen = (n * S + offset)
  const B = BASIS, dx = x - CAM.x, dy = y - CAM.y, dz = z - CAM.z;
  const xc = dx * B.rx + dy * B.ry + dz * B.rz, yc = dx * B.ux + dy * B.uy + dz * B.uz, zc = dx * B.fx + dy * B.fy + dz * B.fz;
  return { nx: xc / zc, ny: (yc / zc) * aspect, zc };
}
// The live camera: the HUD and the presenter both read it. thx = tan(half horizontal fov); ox / oy = principal-point shift in NDC.
export const CAMV = { w: 720, h: 1280, thx: Math.tan((CAM.hfov * Math.PI) / 360), ox: 0, oy: 0, key: '' };
export function fitCamera(w, h, r) {
  const aspect = w / h;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of FIT_PTS) { const q = normalized(p[0], p[1], p[2], aspect); x0 = Math.min(x0, q.nx); x1 = Math.max(x1, q.nx); y0 = Math.min(y0, q.ny); y1 = Math.max(y1, q.ny); }
  const rw = Math.max(40, r.x1 - r.x0), rh = Math.max(40, r.y1 - r.y0);
  const S = Math.min((rw * 2) / (w * (x1 - x0)), (rh * 2) / (h * (y1 - y0)));
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  return { w, h, thx: 1 / S, ox: (2 * cx) / w - 1 - ((x0 + x1) / 2) * S, oy: 1 - (2 * cy) / h - ((y0 + y1) / 2) * S };
}
export function setCamera(c) {
  const key = `${c.w}|${c.h}|${c.thx.toFixed(5)}|${c.ox.toFixed(4)}|${c.oy.toFixed(4)}`;
  if (key === CAMV.key) return false;
  Object.assign(CAMV, { w: c.w, h: c.h, thx: c.thx, ox: c.ox, oy: c.oy, key });
  return true;
}
// vertical field of view in degrees for the live camera (the 3D camera uses this with aspect = w / h)
export const vfovOf = (c = CAMV) => (2 * Math.atan(c.thx / (c.w / c.h)) * 180) / Math.PI;
// HUD projection in virtual units (the live screen size), through the live framing
export function projectL(x, y, z) {
  const c = CAMV, q = normalized(x, y, z, c.w / c.h);
  if (q.zc < 0.05) return null;
  const nx = q.nx / c.thx + c.ox, ny = q.ny / c.thx + c.oy;
  return { x: (nx + 1) * 0.5 * c.w, y: (1 - ny) * 0.5 * c.h, depth: q.zc, scale: c.w / (2 * c.thx * q.zc) };
}
