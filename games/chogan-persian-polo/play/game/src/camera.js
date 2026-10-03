// The match camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD (which projects field positions through
// it). One fixed camera behind the near end line: the field never pans, zooms or tilts (fixed surface rule).
// Sim axes: x = screen right, z = up the field. Three.js axes are mirrored in x (the rig's +X is the avatar's left), so world x_three = -x_sim.
export const CAM = { x: 0, y: 32, z: -31, lx: 0, ly: 0, lz: -4 };
export const FOV_BASE = 36;
export const ASPECT_REF = 720 / 1280;

export function fovFor(aspect) {
  const t = Math.tan((FOV_BASE * Math.PI) / 360) * Math.max(1, ASPECT_REF / Math.max(0.2, aspect));
  return (2 * Math.atan(t) * 180) / Math.PI;
}

// project a SIM point (x right, y up, z far) to CSS pixels on a W x H screen
export function project(W, H, x, y, z, cam = CAM) {
  const aspect = W / H, fov = fovFor(aspect);
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
export const toVirtual = (u, v, W, H) => { const s = Math.min(W / 720, H / 1280); return { x: (u - W / 2) / s + 360, y: (v - H / 2) / s + 640 }; };
export const fromVirtual = (x, y, W, H) => { const s = Math.min(W / 720, H / 1280); return { u: (x - 360) * s + W / 2, v: (y - 640) * s + H / 2 }; };
export function projectV(W, H, x, y, z) { const p = project(W, H, x, y, z); if (!p) return null; const v = toVirtual(p.u, p.v, W, H); return { x: v.x, y: v.y, depth: p.depth }; }
// pixels per metre at a field point (lateral), in virtual units
export function scaleAt(W, H, x, z) { const a = projectV(W, H, x - 0.5, 0, z), b = projectV(W, H, x + 0.5, 0, z); return a && b ? Math.abs(b.x - a.x) : 30; }

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
