// The match camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD (which projects pitch positions
// through it), so the HUD and the picture can never disagree. The camera never pans, tilts or shakes (fixed-surface rule); FLUID LAYOUT
// only changes WHICH fixed camera is used and how it is framed for the live screen size:
//   end   portrait (any taller-than-wide screen): the approved phone look, a high broadcast view from behind the near baseline; the
//         pitch runs up the screen and you attack towards the top. Screen right is world -x, screen up is world +z.
//   side  landscape (and squarish windows): the same height and distance, but from beside the near touchline, so the long pitch runs
//         ACROSS the wide screen and you attack towards the right. Screen right is world +z, screen up is world +x (away from you).
// `fitCamera(mode, w, h, rect)` solves the field of view and a small principal-point shift so the whole pitch (goals, nets, head height
// above every corner) fills the free rectangle `rect` of the screen, centred and never stretched.
import { HL, HW, GOAL_D } from './consts.js';

export const ASPECT_REF = 720 / 1280;
export const CAMS = {
  end: { x: 0, y: 54, z: -86, lx: 0, ly: 0, lz: -2 },
  side: { x: -86, y: 54, z: 0, lx: 0, ly: 0, lz: 0 },
};
export const initialCam = () => ({ ...CAMS.end });
export const modeFor = (w, h) => (w >= h ? 'side' : 'end');

// A screen vector (sx right, sy down) as a world direction (x, z) for the camera mode: stick, swipes.
export function screenToWorldDir(mode, sx, sy) {
  return mode === 'side' ? { x: -sy, z: sx } : { x: -sx, z: -sy };
}

// The points that must stay on screen: pitch corners and the goal nets, with head height above each.
const FIT_PTS = (() => {
  const a = [], X = HW + 0.8, Z = HL + GOAL_D + 0.4;
  for (const x of [-X, X]) for (const z of [-Z, Z]) a.push([x, 0, z], [x, 2.9, z]);
  return a;
})();
function basis(cam) {
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  return { fx, fy, fz, rx, ry, rz, ux, uy, uz };
}
const BASIS = { end: basis(CAMS.end), side: basis(CAMS.side) };
function normalized(mode, x, y, z, aspect) {      // x / y in "per thx" units: screen = n * S + offset
  const cam = CAMS[mode], B = BASIS[mode], dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
  const xc = dx * B.rx + dy * B.ry + dz * B.rz, yc = dx * B.ux + dy * B.uy + dz * B.uz, zc = dx * B.fx + dy * B.fy + dz * B.fz;
  return { nx: xc / zc, ny: (yc / zc) * aspect, zc };
}

// The live camera: the HUD and the presenter both read it. thx = tan(half horizontal fov); ox / oy = principal-point shift in NDC.
export const CAMV = { mode: 'end', w: 720, h: 1280, thx: 0.27, ox: 0, oy: 0, key: '' };
export function fitCamera(mode, w, h, r) {
  const aspect = w / h;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of FIT_PTS) { const q = normalized(mode, p[0], p[1], p[2], aspect); x0 = Math.min(x0, q.nx); x1 = Math.max(x1, q.nx); y0 = Math.min(y0, q.ny); y1 = Math.max(y1, q.ny); }
  const rw = Math.max(40, r.x1 - r.x0), rh = Math.max(40, r.y1 - r.y0);
  const S = Math.min((rw * 2) / (w * (x1 - x0)), (rh * 2) / (h * (y1 - y0)));
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  return { mode, w, h, thx: 1 / S, ox: (2 * cx) / w - 1 - ((x0 + x1) / 2) * S, oy: 1 - (2 * cy) / h - ((y0 + y1) / 2) * S };
}
export function setCamera(c) {
  const key = `${c.mode}|${c.w}|${c.h}|${c.thx.toFixed(5)}|${c.ox.toFixed(4)}|${c.oy.toFixed(4)}`;
  if (key === CAMV.key) return false;
  Object.assign(CAMV, { mode: c.mode, w: c.w, h: c.h, thx: c.thx, ox: c.ox, oy: c.oy, key });
  return true;
}
// vertical field of view in degrees for the live camera (the 3D camera uses this with aspect = w / h)
export const vfovOf = (c = CAMV) => (2 * Math.atan(c.thx / (c.w / c.h)) * 180) / Math.PI;
// HUD projection in virtual units (the live screen size), through the live framing
export function projectL(x, y, z, c = CAMV) {
  const q = normalized(c.mode, x, y, z, c.w / c.h);
  if (q.zc < 0.05) return null;
  const nx = q.nx / c.thx + c.ox, ny = q.ny / c.thx + c.oy;
  return { x: (nx + 1) * 0.5 * c.w, y: (1 - ny) * 0.5 * c.h, depth: q.zc, scale: c.w / (2 * c.thx * q.zc) };
}
