// The match camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD (which projects field positions through
// it). Two fixed rigs, chosen by the live screen shape; the field never pans, zooms or tilts during play (fixed surface rule):
//   'end'  portrait: behind the near end line looking up the field (the approved phone look). Screen right = +x, screen up = +z.
//   'side' landscape: a broadcast camera on the side line, the field runs along the long screen axis. Screen right = +z (toward the red
//          team's goal), screen up = -x. The stick is mapped through screenDir() so "right" always means screen-right.
// Sim axes: x = right in the end view, z = up the field. Three.js axes are mirrored in x (the rig's +X is the avatar's left), so world x_three = -x_sim.
export const CAM = { x: 0, y: 32, z: -31, lx: 0, ly: 0, lz: -4 };
export const SIDE_CAM = { x: -22, y: 23, z: 0.4, lx: 0, ly: 0, lz: 0.4 };
export const FOV_BASE = 36;
export const ASPECT_REF = 720 / 1280;
export const SIDE_TAN_H = 0.64;                       // half the horizontal field of view (tangent) the side rig keeps, so the whole field length always fits

export function fovFor(aspect) {
  const t = Math.tan((FOV_BASE * Math.PI) / 360) * Math.max(1, ASPECT_REF / Math.max(0.2, aspect));
  return (2 * Math.atan(t) * 180) / Math.PI;
}
export function sideFov(aspect) {
  const t = Math.min(0.72, SIDE_TAN_H / Math.max(1, aspect));
  return (2 * Math.atan(t) * 180) / Math.PI;
}
// the rig for a screen shape: portrait (and square) uses the end rig, landscape the side rig
export function rigFor(aspect) {
  return aspect > 1.02 ? { key: 'side', cam: SIDE_CAM, fov: sideFov(aspect), right: [0, 1], up: [-1, 0] } : { key: 'end', cam: CAM, fov: fovFor(aspect), right: [1, 0], up: [0, 1] };
}
// A stick / arrow-key direction in screen terms (dx right, dz up) to sim axes for the rig (pure input mapping; the simulation is unchanged)
export function screenDir(rig, dx, dz) { return { x: rig.right[0] * dx + rig.up[0] * dz, z: rig.right[1] * dx + rig.up[1] * dz }; }

// project a SIM point (x right, y up, z far) to CSS pixels on a W x H screen
export function project(W, H, x, y, z, rig = rigFor(W / H)) {
  const aspect = W / H, fov = rig.fov, cam = rig.cam;
  const px = -x;                                                     // to three space
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;      // right = f x up
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const dx = px - cam.x, dy = y - cam.y, dz = z - cam.z;
  const xc = dx * rx + dy * ry + dz * rz, yc = dx * ux + dy * uy + dz * uz, zc = dx * fx + dy * fy + dz * fz;
  if (zc < 0.05) return null;
  const th = Math.tan((fov * Math.PI) / 360);
  const nx = xc / (zc * th * aspect), ny = yc / (zc * th);
  return { u: (nx + 1) * 0.5 * W, v: (1 - ny) * 0.5 * H, depth: zc };
}
// css px (u, v) on a W x H screen to virtual units of the live fluid viewport vw x vh (one scale for both axes, centred)
export const toVirtual = (u, v, W, H, vw = 720, vh = 1280) => { const s = Math.min(W / vw, H / vh); return { x: (u - W / 2) / s + vw / 2, y: (v - H / 2) / s + vh / 2 }; };
export const fromVirtual = (x, y, W, H, vw = 720, vh = 1280) => { const s = Math.min(W / vw, H / vh); return { u: (x - vw / 2) * s + W / 2, v: (y - vh / 2) * s + H / 2 }; };
export function projectV(W, H, x, y, z, vw = 720, vh = 1280) { const p = project(W, H, x, y, z); if (!p) return null; const v = toVirtual(p.u, p.v, W, H, vw, vh); return { x: v.x, y: v.y, depth: p.depth }; }
// virtual units per metre on the screen around a field point
export function scaleAt(W, H, x, z, vw = 720, vh = 1280) { const a = projectV(W, H, x - 0.5, 0, z, vw, vh), b = projectV(W, H, x + 0.5, 0, z, vw, vh), c = projectV(W, H, x, 0, z - 0.5, vw, vh), d = projectV(W, H, x, 0, z + 0.5, vw, vh); return a && b && c && d ? Math.max(Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(d.x - c.x, d.y - c.y)) : 30; }

// The Rules-page formation camera (a close three-quarter view of the whole field from behind our end line) and a generic projector for it,
// so the 2D page can put labels exactly over the real 3D riders. Window size w x h in CSS px, vertical field of view fov.
export const SHOW_CAM = { x: 0, y: 21, z: -31, lx: 0, ly: 0, lz: -1.5, fov: 40 };
export function projectWith(cam, fov, w, h, x, y, z) {
  const aspect = w / h, px = -x;
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const dx = px - cam.x, dy = y - cam.y, dz = z - cam.z;
  const xc = dx * rx + dz * rz, yc = dx * ux + dy * uy + dz * uz, zc = dx * fx + dy * fy + dz * fz;
  if (zc < 0.05) return null;
  const th = Math.tan((fov * Math.PI) / 360);
  return { x: (xc / (zc * th * aspect) + 1) * 0.5 * w, y: (1 - yc / (zc * th)) * 0.5 * h };
}
