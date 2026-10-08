// Pottery Wheel: the camera as plain maths, shared by the pure game (to turn a fingertip into clay coordinates) and the 3D presenter (to place the real
// camera identically). World: y up, the wheel head's top at y = 0, the pot's axis on the y axis, the camera in front (+z) looking slightly down.
export const CAM = { fov: 24 * Math.PI / 180, pitch: 0.2, worldW: 3.5, y0: -0.4, y1: 4.3 };

// Place the camera so the world box [-worldW/2, worldW/2] x [y0, y1] fits inside `rect` (virtual units) on a W x H screen.
export function camFor(W, H, rect, box = null) {
  const y1 = box?.y1 ?? CAM.y1, y0 = CAM.y0, wW = box?.worldW ?? CAM.worldW;
  const worldH = y1 - y0, sc = Math.max(1, Math.min(rect.w / wW, rect.h / worldH));
  const th = Math.tan(CAM.fov / 2), D = (H / sc) / (2 * th);
  const sp = Math.sin(CAM.pitch), cp = Math.cos(CAM.pitch);
  const right = [1, 0, 0], up = [0, cp, -sp], fwd = [0, -sp, -cp];
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, ty = (y0 + y1) / 2;
  const a = (cx - W / 2) / sc, b = (H / 2 - cy) / sc;
  const T = [-a * right[0] - b * up[0], ty - b * up[1], -b * up[2]];
  const pos = [T[0] + D * (-fwd[0]), T[1] + D * (-fwd[1]), T[2] + D * (-fwd[2])];
  return { W, H, sc, th, aspect: W / H, pos, target: T, right, up, fwd, fovDeg: CAM.fov * 180 / Math.PI };
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// World point -> screen (virtual units).
export function project(c, x, y, z = 0) {
  const v = [x - c.pos[0], y - c.pos[1], z - c.pos[2]];
  const xc = dot(v, c.right), yc = dot(v, c.up), zc = dot(v, c.fwd);
  const nx = xc / (zc * c.th * c.aspect), ny = yc / (zc * c.th);
  return { x: c.W / 2 + nx * c.W / 2, y: c.H / 2 - ny * c.H / 2, s: c.sc * (c.pos[2] / Math.max(zc, 1e-6)) };
}
// Screen point -> the vertical plane through the wheel axis (z = 0): { X, Y }.
export function unproject(c, sx, sy) {
  const nx = (sx - c.W / 2) / (c.W / 2), ny = -(sy - c.H / 2) / (c.H / 2);
  const d = [c.fwd[0] + nx * c.th * c.aspect * c.right[0] + ny * c.th * c.up[0], c.fwd[1] + nx * c.th * c.aspect * c.right[1] + ny * c.th * c.up[1], c.fwd[2] + nx * c.th * c.aspect * c.right[2] + ny * c.th * c.up[2]];
  const t = -c.pos[2] / d[2];
  return { X: c.pos[0] + t * d[0], Y: c.pos[1] + t * d[1] };
}
