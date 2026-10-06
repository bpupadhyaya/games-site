// The match camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD (which projects court
// positions through it). It is a function of the SCREEN ASPECT only (never of the simulation), so the HUD and the picture can never disagree.
//   portrait / squarish (aspect < 1): the approved phone camera, behind the near end line looking down the pitch (own goal at the bottom).
//   landscape (aspect >= 1): a side-on broadcast camera on the near sideline, own goal LEFT, attacking RIGHT. The 28 m pitch runs along
//   the long side of the screen, so the players are about twice the size they would be if the portrait camera were just letterboxed.
//   The distance is solved so the whole pitch, both goals and the players' heads stay inside a band that leaves room for the scoreboard
//   above and the thumb controls below (see SIDE_BAND).
import { HW, HL, GOAL_HW, BAR, POST_H, NET_D } from './consts.js';

export const FOV_BASE = 44;            // vertical degrees at the reference aspect 9:16
export const ASPECT_REF = 720 / 1280;

export function fovFor(aspect, base = FOV_BASE) {
  const t = Math.tan((base * Math.PI) / 360) * Math.max(1, ASPECT_REF / Math.max(0.2, aspect));
  return (2 * Math.atan(t) * 180) / Math.PI;
}

export function initialCam() { return { x: 0, y: 28, z: -42, lx: 0, ly: 0, lz: -2, fov: 34 }; }
// the sim keeps its own copy of the fixed camera for save files and tests; the live camera is camFor(aspect)
export function camTarget() { return initialCam(); }
export function stepCam(cam) { Object.assign(cam, camTarget()); }

// Where the pitch may be on a landscape screen, as fractions of the height: below the scoreboard, above the controls.
export const SIDE_BAND = { top: 0.19, bottom: 0.16, side: 0.02 };
let SIDE_FOV = 32, SIDE_PITCH = 30 * Math.PI / 180;
export const tuneSide = (fov, pitchDeg) => { SIDE_FOV = fov; SIDE_PITCH = pitchDeg * Math.PI / 180; cache.clear(); };

const cache = new Map();
export const isSide = (aspect) => aspect >= 1;
export function camFor(aspect) {
  const key = Math.round(aspect * 200);
  let c = cache.get(key);
  if (!c) { c = isSide(aspect) ? solveSide(aspect) : tallCam(aspect); cache.set(key, c); if (cache.size > 80) cache.delete(cache.keys().next().value); }
  return c;
}
function tallCam(aspect) { const c = initialCam(); c.fov = fovFor(aspect, c.fov); c.side = false; return c; }

// ---- projection (scene coordinates: the scene's x is the mirror of the simulation's x) --------------------------------------------
function basis(cam) {
  const px = -cam.x, py = cam.y, pz = cam.z;
  let fx = -cam.lx - px, fy = cam.ly - py, fz = cam.lz - pz;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;               // right = f x up(0,1,0)
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;                                   // up = r x f
  return { px, py, pz, fx, fy, fz, rx, rz, ux, uy, uz };
}
// A simulation point -> CSS pixels on a W x H screen that shows the camera with that screen's aspect.
export function project(cam, W, H, x, y, z) {
  const aspect = W / H, B = basis(cam);
  const dx = -x - B.px, dy = y - B.py, dz = z - B.pz;
  const xc = dx * B.rx + dz * B.rz, yc = dx * B.ux + dy * B.uy + dz * B.uz, zc = dx * B.fx + dy * B.fy + dz * B.fz;
  if (zc < 0.05) return null;
  const th = Math.tan((cam.fov * Math.PI) / 360);
  return { u: (xc / (zc * th * aspect) + 1) * 0.5 * W, v: (1 - yc / (zc * th)) * 0.5 * H, depth: zc };
}
// CSS pixels <-> virtual units (the kit's fluid mapping: short side = 720 units, centred when the aspect exceeds the kit's cap)
export function viewMap(cssW, cssH, vw, vh) { const s = Math.min(cssW / vw, cssH / vh); return { s, ox: (cssW - vw * s) / 2, oy: (cssH - vh * s) / 2 }; }
// Simulation point -> virtual units. cssW x cssH = the canvas in CSS pixels, vw x vh = the kit's virtual size.
export function projectV(cam, cssW, cssH, vw, vh, x, y, z) {
  const p = project(cam, cssW, cssH, x, y, z); if (!p) return null;
  const m = viewMap(cssW, cssH, vw, vh);
  return { x: (p.u - m.ox) / m.s, y: (p.v - m.oy) / m.s, depth: p.depth };
}

// ---- the side camera ---------------------------------------------------------------------------------------------------------------
// Key points (simulation coordinates) the picture must contain: the pitch, the nets behind both end lines, the post tops and a player's head over each corner.
const KEY = (() => {
  const pts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push([sx * (HW + 0.6), 0, sz * (HL + NET_D + 0.3)]);
    pts.push([sx * (HW + 0.6), 2.3, sz * (HL + 0.5)]);
  }
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) { pts.push([sx * GOAL_HW, POST_H, sz * HL]); pts.push([sx * GOAL_HW, BAR, sz * HL]); }
  return pts;
})();
// camera on the scene's -x side (the simulation's +x side), `d` metres from the look-at point (0, ty, 0), looking slightly down
function sideCam(d, ty) {
  return { x: d * Math.cos(SIDE_PITCH), y: ty + d * Math.sin(SIDE_PITCH), z: 0, lx: 0, ly: ty, lz: 0, fov: SIDE_FOV, side: true };
}
function extent(cam, aspect) {
  let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
  const B = basis(cam), t = Math.tan((cam.fov * Math.PI) / 360);
  for (const [x, y, z] of KEY) {
    const dx = -x - B.px, dy = y - B.py, dz = z - B.pz;
    const xc = dx * B.rx + dz * B.rz, yc = dx * B.ux + dy * B.uy + dz * B.uz, zc = dx * B.fx + dy * B.fy + dz * B.fz;
    const nx = xc / (zc * t * aspect), ny = yc / (zc * t);
    x0 = Math.min(x0, nx); x1 = Math.max(x1, nx); y0 = Math.min(y0, ny); y1 = Math.max(y1, ny);
  }
  return { x0, x1, y0, y1 };
}
function solveSide(aspect) {
  const bandTop = 1 - 2 * SIDE_BAND.top, bandBot = -1 + 2 * SIDE_BAND.bottom;      // allowed ny range (top of the picture is +1)
  const cy = (bandTop + bandBot) / 2, span = bandTop - bandBot, lim = 1 - 2 * SIDE_BAND.side;
  const fits = (d) => {
    // vertical placement: move the look-at height until the content is centred in the band
    let ty = 0, e = extent(sideCam(d, ty), aspect);
    for (let k = 0; k < 10; k++) { const c = (e.y0 + e.y1) / 2; ty += (c - cy) * 0.5 * d * Math.tan((SIDE_FOV * Math.PI) / 360); e = extent(sideCam(d, ty), aspect); }
    return { ok: e.y1 - e.y0 <= span && e.x1 <= lim && e.x0 >= -lim, ty };
  };
  let lo = 8, hi = 160;
  for (let k = 0; k < 28; k++) { const mid = (lo + hi) / 2; if (fits(mid).ok) hi = mid; else lo = mid; }
  return sideCam(hi, fits(hi).ty);
}
