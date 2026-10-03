// The broadcast camera as pure maths, shared by the 3D presenter (which renders with it) and the 2D HUD (which projects court
// positions through it). One fixed position: the court never pans, zooms, shakes or tilts. The picture is defined for the virtual
// 720 x 1280 rectangle; taller screens simply show more floor above and below, wider screens are pillarboxed.
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
