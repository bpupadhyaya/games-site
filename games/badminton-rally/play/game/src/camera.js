// The broadcast cameras as pure maths, shared by the 3D presenter (which renders with them) and the 2D HUD (which projects court positions
// through them). Two fixed positions, chosen by the screen shape:
//   'B'  portrait: high behind the near baseline, looking down the court. Screen right = world +x, screen up = towards the opponent.
//   'S'  landscape: high beside the court. Screen right = world -z (towards the computer's end), screen up = world -x. Your end is at the left.
// Neither camera moves. The FRAMING is solved from the live screen size: `fitCamera(w, h, rect)` picks the field of view and a small
// principal-point shift so the whole court (floor corners, head height, a high shuttle) fills the rectangle `rect` of the screen.
export const CAMS = {
  B: { x: 0, y: 21, z: 13.5, lx: 0, ly: 0.2, lz: -0.8, hfov: 22 },
  S: { x: 21, y: 13.5, z: 3.2, lx: 0, ly: 0.3, lz: 0, hfov: 26 },
};
export let MODE = 'B';
// The portrait camera tilts with the screen shape: a tall phone gets a steep, high view (the court fills the height), a squarish tablet a
// lower, more oblique one (the court is wide and short on screen and fills the width).
export function setAspect(a) {
  const t = Math.max(0, Math.min(1, (a - 0.5) / 0.3));
  const b = CAMS.B, y = 21 + (13.5 - 21) * t, z = 13.5 + (19.5 - 13.5) * t, lz = -0.8 + (-1.8 + 0.8) * t;
  if (Math.abs(b.y - y) < 1e-3 && Math.abs(b.z - z) < 1e-3) return false;
  b.y = y; b.z = z; b.lz = lz; BASIS = basis(CAMS[MODE]);
  return true;
}
export function setMode(m) { if (m !== MODE && CAMS[m]) { MODE = m; BASIS = basis(CAMS[MODE]); return true; } return false; }
export const cam = () => CAMS[MODE];

// swipe on the screen (dx right, dy down, in screen units) -> court terms: F towards the opponent, Lx towards +x
export function swipeToCourt(dx, dy) {
  return MODE === 'B' ? { F: -dy, Lx: dx } : { F: dx, Lx: dy };
}
// court point -> an approximate screen direction of "forward" (for the stroke-guide arrows): [sx, sy] unit
export const forwardOnScreen = () => (MODE === 'B' ? [0, -1] : [1, 0]);

function basis(c) {
  let fx = c.lx - c.x, fy = c.ly - c.y, fz = c.lz - c.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  return { fx, fy, fz, rx, ry, rz, ux, uy, uz };
}
let BASIS = basis(CAMS[MODE]);

// The points that must stay on screen.
const FIT = {
  B: (() => { const a = []; for (const x of [-3.05, 3.05]) { a.push([x, 0, 6.9], [x, 2.5, 7.3], [x, 0, -6.7], [x, 2.2, -6.7]); } return a; })(),
  S: (() => { const a = []; for (const z of [-6.7, 6.7]) for (const x of [-3.05, 3.05]) { a.push([x, 0, z * 1.12], [x, 2.5, z * 1.12]); } return a; })(),
};

function normalized(x, y, z, aspect) {
  const B = BASIS, c = CAMS[MODE], dx = x - c.x, dy = y - c.y, dz = z - c.z;
  const xc = dx * B.rx + dy * B.ry + dz * B.rz, yc = dx * B.ux + dy * B.uy + dz * B.uz, zc = dx * B.fx + dy * B.fy + dz * B.fz;
  return { nx: xc / zc, ny: (yc / zc) * aspect, zc };
}
// The live camera: thx = tan(half horizontal fov); ox / oy = principal-point shift in NDC.
export const CAMV = { w: 720, h: 1280, thx: Math.tan((CAMS.B.hfov * Math.PI) / 360), ox: 0, oy: 0, key: '', mode: 'B' };
export function fitCamera(w, h, r) {
  const aspect = w / h;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of FIT[MODE]) { const q = normalized(p[0], p[1], p[2], aspect); x0 = Math.min(x0, q.nx); x1 = Math.max(x1, q.nx); y0 = Math.min(y0, q.ny); y1 = Math.max(y1, q.ny); }
  const rw = Math.max(40, r.x1 - r.x0), rh = Math.max(40, r.y1 - r.y0);
  const S = Math.min((rw * 2) / (w * (x1 - x0)), (rh * 2) / (h * (y1 - y0)));
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  return { w, h, mode: MODE, thx: 1 / S, ox: (2 * cx) / w - 1 - ((x0 + x1) / 2) * S, oy: 1 - (2 * cy) / h - ((y0 + y1) / 2) * S };
}
export function setCamera(c) {
  const key = `${c.mode}|${c.w}|${c.h}|${c.thx.toFixed(5)}|${c.ox.toFixed(4)}|${c.oy.toFixed(4)}`;
  if (key === CAMV.key) return false;
  Object.assign(CAMV, { w: c.w, h: c.h, thx: c.thx, ox: c.ox, oy: c.oy, mode: c.mode, key });
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
