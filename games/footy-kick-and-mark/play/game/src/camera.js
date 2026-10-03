// The match camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD (which projects pitch positions
// through it). One fixed broadcast camera behind the near goal: the pitch never moves, zooms, pans or tilts. Everything here is a
// function of constants, so the HUD and the picture can never disagree.
export const CAM = { x: 0, y: 24, z: -62, lx: 0, ly: 0, lz: -12, fov: 48 };       // fov: vertical degrees at the reference aspect 9:16
export const ASPECT_REF = 720 / 1280;

export function fovFor(aspect) {
  const t = Math.tan((CAM.fov * Math.PI) / 360) * Math.max(1, ASPECT_REF / Math.max(0.2, aspect));
  return (2 * Math.atan(t) * 180) / Math.PI;
}
// World point -> CSS pixels on a W x H screen showing the camera with that aspect
export function project(W, H, x, y, z, cam = CAM) {
  const aspect = W / H, fov = fovFor(aspect);
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;      // right = f x up(0,1,0)
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;           // up = r x f
  const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
  const xc = dx * rx + dy * ry + dz * rz, yc = dx * ux + dy * uy + dz * uz, zc = dx * fx + dy * fy + dz * fz;
  if (zc < 0.05) return null;
  const th = Math.tan((fov * Math.PI) / 360);
  const nx = xc / (zc * th * aspect), ny = yc / (zc * th);
  return { u: (nx + 1) * 0.5 * W, v: (1 - ny) * 0.5 * H, depth: zc };
}
// CSS pixels <-> virtual (720x1280, letterboxed) coordinates
export const toVirtual = (u, v, W, H) => { const s = Math.min(W / 720, H / 1280); return { x: (u - W / 2) / s + 360, y: (v - H / 2) / s + 640 }; };
export const fromVirtual = (x, y, W, H) => { const s = Math.min(W / 720, H / 1280); return { u: (x - 360) * s + W / 2, v: (y - 640) * s + H / 2 }; };
// the usual call: world -> virtual 720 x 1280 coordinates (the HUD draws in these). Pass the screen size the 3D picture is rendered at.
export function projectV(W, H, x, y, z) { const p = project(W, H, x, y, z); if (!p) return null; const v = toVirtual(p.u, p.v, W, H); return { x: v.x, y: v.y, depth: p.depth }; }
// the point on the plane y = h under a virtual-coordinate position
export function unprojectV(W, H, vx, vy, h = 0, cam = CAM) {
  const aspect = W / H, fov = fovFor(aspect), th = Math.tan((fov * Math.PI) / 360);
  const { u, v } = fromVirtual(vx, vy, W, H);
  const nx = (u / W) * 2 - 1, ny = 1 - (v / H) * 2;
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const dirx = fx + rx * nx * th * aspect + ux * ny * th, diry = fy + ry * nx * th * aspect + uy * ny * th, dirz = fz + rz * nx * th * aspect + uz * ny * th;
  if (Math.abs(diry) < 1e-6) return null;
  const t = (h - cam.y) / diry;
  if (t < 0) return null;
  return { x: cam.x + dirx * t, z: cam.z + dirz * t };
}
