// Camera model shared by the 3D presenter and the 2D HUD: where the main camera and the sight-lens camera are for the current moment, and how to project a point
// of the world into either of them (so the reticle drawn on the 2D canvas sits exactly where the 3D scene says the arrow will go).
import { ZOOMS } from './consts.js';
import { boardZ, standZ, standX, rightX, originOf } from './ballistics.js';

const D2R = Math.PI / 180;
export const V3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const sub = (a, b) => V3(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return V3(a.x / l, a.y / l, a.z / l); };
const cross = (a, b) => V3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerp3 = (a, b, t) => V3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
export const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

// camera = { pos, look, fov (vertical degrees) }
export function basis(cam) {
  const f = norm(sub(cam.look, cam.pos)), r = norm(cross(f, V3(0, 1, 0))), u = cross(r, f);
  return { f, r, u };
}
// normalised device coordinates (x right, y up, both -1..1 at the frame edge) or null behind the camera
export function project(cam, aspect, p) {
  const b = basis(cam), d = sub(p, cam.pos), z = dot(d, b.f);
  if (z <= 0.05) return null;
  const th = Math.tan((cam.fov * D2R) / 2);
  return { x: dot(d, b.r) / z / (th * aspect), y: dot(d, b.u) / z / th, z };
}

// ---- places -------------------------------------------------------------------------------------------------------------------------------------------------
export const stand = (dir) => V3(standX(dir), 0, standZ(dir));
export const board = (dir) => V3(0, 0, boardZ(dir));                        // the board being shot at
export const ownBoard = (dir) => V3(0, 0, standZ(dir));
export const fwd = (dir) => V3(0, 0, dir);
export const rgt = (dir) => V3(rightX(dir), 0, 0);
const at = (p, f, fk, r, rk, y) => V3(p.x + f.x * fk + r.x * rk, y, p.z + f.z * fk + r.z * rk);

// where the dancers stand and where their camera is (shared by the presenter, which places the figures)
export function danceSpot(dir) {
  const S = stand(dir), F = fwd(dir), R = rgt(dir);
  const c = at(S, F, 8.5, R, -0.5, 0);
  return { c, face: -dir, cam: at(c, F, 8.2, R, 1.0, 1.55), look: at(c, F, 0, R, 0, 1.25) };
}

// the lens: sits at the bow and looks at the middle of the board; the zoom is the width of the picture at the board
export function lensCam(E) {
  const o = originOf(E.dir), dist = Math.abs(boardZ(E.dir) - o.z), span = ZOOMS[E.zoom];
  return { pos: V3(o.x, o.y + 0.05, o.z), look: V3(0, 0.7, boardZ(E.dir)), fov: (2 * Math.atan(span / 2 / dist)) / D2R };
}
export const worldOfAim = (dir, u, h) => V3(u * rightX(dir), h, boardZ(dir));

// main camera for the moment. aspect = width / height of the region the picture fills. `k` is the phase time.
export function mainCam(E, aspect) {
  const dir = E.dir, S = stand(dir), F = fwd(dir), R = rgt(dir), tall = aspect < 1;
  const fov = tall ? 66 : 46;
  const shoulder = (push = 0) => ({
    pos: at(S, F, -(tall ? 4.6 : 3.9) + push * 0.5, R, (tall ? 1.7 : 1.5) - push * 0.1, 1.72 - push * 0.05),
    look: at(S, F, 14, R, tall ? -2.4 - push * 1.0 : -0.6, 1.25),
    fov: fov - push * (tall ? 6 : 8),
  });
  switch (E.phase) {
    case 'endintro': {
      const k = smooth(E.pt / 1.9), a = { pos: at(S, F, -6, R, 7, 6.5), look: at(S, F, 60, R, 0, 1), fov: fov + 6 }, b = shoulder();
      return { pos: lerp3(a.pos, b.pos, k), look: lerp3(a.look, b.look, k), fov: lerp(a.fov, b.fov, k) };
    }
    case 'draw': return shoulder(E.draw ? smooth(E.draw.t / 1.4) : 0);
    case 'flight': {
      const a = E.arrow;
      if (!a) return shoulder();
      const sp = Math.hypot(a.vx, a.vy, a.vz) || 1, d = V3(a.vx / sp, a.vy / sp, a.vz / sp), P = V3(a.x, a.y, a.z);
      const chase = { pos: V3(P.x - d.x * 4.4 + R.x * 0.9, P.y - d.y * 4.4 + 0.75, P.z - d.z * 4.4 + R.z * 0.9), look: V3(P.x + d.x * 16, P.y + d.y * 16 - 0.3, P.z + d.z * 16), fov: 52 };
      const res = resultCam(E), left = Math.abs(boardZ(dir) - a.z), w = smooth((32 - left) / 18);
      return { pos: lerp3(chase.pos, res.pos, w), look: lerp3(chase.look, res.look, w), fov: lerp(chase.fov, res.fov, w) };
    }
    case 'result': return resultCam(E);
    case 'dance': { const d = danceSpot(dir), k = smooth(E.pt / 0.9); const rc = resultCam(E); return { pos: lerp3(rc.pos, d.cam, k), look: lerp3(rc.look, d.look, k), fov: lerp(rc.fov, 36, k) }; }
    case 'walk': return { pos: at(S, F, -4, R, 3.5, 2.4), look: at(S, F, 30, R, 0, 1), fov: fov + 4 };
    case 'endscore': return shoulder(0);
    default: return shoulder();
  }
}
function resultCam(E) {
  const dir = E.dir, B = board(dir), F = fwd(dir), R = rgt(dir);
  return { pos: at(B, F, -5.2, R, -1.9, 1.15), look: at(B, F, 0, R, 0.1, 0.62), fov: 30 };
}
