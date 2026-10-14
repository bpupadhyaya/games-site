// The camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD (which projects ring and
// cue markers through it), so the picture and the HUD can never disagree. Everything is a function of the live virtual
// screen shape (W x H, short side 720) and the stage rectangle that the HUD leaves free.
import { RING } from './sim.js';

export const FOV = 36;                      // vertical degrees
const ELEV = 27 * Math.PI / 180;            // camera elevation above the ground plane
const TARGET = { x: 0, y: 0.75, z: 0 };

// stage = { x, y, w, h } in virtual units: where the ring of dancers should sit on screen.
export function rigFor(W, H, stage) {
  const th = Math.tan((FOV * Math.PI) / 360);
  const needW = 2 * (RING + 0.62), needH = 2 * (RING + 0.45) * Math.sin(ELEV) + 2.0 * Math.cos(ELEV) + 0.35;
  const pxPerM = Math.min(stage.w / needW, stage.h / needH) * 0.94;
  const D = H / 2 / (Math.max(pxPerM, 20) * th);
  const pos = { x: TARGET.x, y: TARGET.y + D * Math.sin(ELEV), z: TARGET.z - D * Math.cos(ELEV) };
  const cx = stage.x + stage.w / 2, cy = stage.y + stage.h / 2;
  // the ring's centre (a little above the floor) lands in the middle of the stage rectangle
  const ox = (cx - W / 2) / (W / 2), oy = -(cy - H / 2) / (H / 2);
  return { pos, target: { ...TARGET }, fov: FOV, aspect: W / H, W, H, ox, oy, D, key: `${W}x${H}|${Math.round(stage.x)},${Math.round(stage.y)},${Math.round(stage.w)},${Math.round(stage.h)}` };
}

// World point -> virtual screen coordinates { x, y, s } (s = virtual units per metre at that depth), or null behind the camera.
export function project(rig, x, y, z) {
  const px = rig.pos.x, py = rig.pos.y, pz = rig.pos.z;
  let fx = rig.target.x - px, fy = rig.target.y - py, fz = rig.target.z - pz;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  // right = f x up(0,1,0) = (-fz, 0, fx)
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;       // up = r x f
  const dx = x - px, dy = y - py, dz = z - pz;
  const xc = dx * rx + dz * rz, yc = dx * ux + dy * uy + dz * uz, zc = dx * fx + dy * fy + dz * fz;
  if (zc < 0.05) return null;
  const th = Math.tan((rig.fov * Math.PI) / 360);
  const nx = xc / (zc * th * rig.aspect) + rig.ox, ny = yc / (zc * th) + rig.oy;
  return { x: (nx + 1) * 0.5 * rig.W, y: (1 - ny) * 0.5 * rig.H, s: rig.H / 2 / (zc * th), depth: zc };
}
