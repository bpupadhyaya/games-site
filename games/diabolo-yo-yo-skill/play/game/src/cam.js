// The camera, shared by the 3D presenter and the 2D overlays/fallback so a point in the world lands on the same pixel in both.
// The camera orbits the point (0, yc, 0) at yaw/pitch; the zoom is chosen so a window of the world (WIN_W wide, yBot..yTop tall)
// fits the stage rectangle, and the image is shifted so the window's centre lands at the centre of that rectangle.
export const WIN_W = 1.8;
export const FOV = 34 * Math.PI / 180;
export const YAW = 0.42, PITCH = 0.04;
export const WIN = { yoyo: { bot: -1.45, top: 1.5 }, diabolo: { bot: -1.5, top: 1.7 } };
export const WIN_TIGHT = { yoyo: { bot: -1.3, top: 0.5 }, diabolo: { bot: -1.35, top: 0.75 } };

// W, H = virtual size of the whole screen (units); rect = stage rectangle in the same units
export function makeCam(W, H, rect, toy, camTop, tight = false) {
  const win = tight ? WIN_TIGHT[toy] : WIN[toy], top = tight ? win.top : Math.max(win.top, camTop ?? win.top), bot = win.bot;
  const k = Math.min(rect.w / WIN_W, rect.h / (top - bot));             // units per metre at the target depth
  const yc = (top + bot) / 2;
  const tf = Math.tan(FOV / 2);
  const D = (H / 2) / (k * tf);
  const cp = Math.cos(PITCH), dir = [Math.sin(YAW) * cp, Math.sin(PITCH), Math.cos(YAW) * cp];
  const pos = [dir[0] * D, yc + dir[1] * D, dir[2] * D];
  // basis
  const f = [-dir[0], -dir[1], -dir[2]];
  let r = [f[1] * 0 - f[2] * 1 * 0, 0, 0];
  // right = normalize(cross(f, up)) with up = (0,1,0): cross(f, up) = (f.y*0 - f.z*1, f.z*0 - f.x*0, f.x*1 - f.y*0) = (-f.z, 0, f.x)
  r = [-f[2], 0, f[0]]; const rl = Math.hypot(r[0], r[2]); r = [r[0] / rl, 0, r[2] / rl];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const sx = rect.x + rect.w / 2 - W / 2, sy = rect.y + rect.h / 2 - H / 2;
  const foc = (H / 2) / tf;
  const cam = {
    W, H, k, yc, D, pos, target: [0, yc, 0], shiftX: sx, shiftY: sy, foc, top, bot,
    // world (x, y, z) -> { x, y } in screen units, plus s = units per metre at that depth
    project(x, y, z = 0) {
      const vx = x - pos[0], vy = y - pos[1], vz = z - pos[2];
      const xc = vx * r[0] + vy * r[1] + vz * r[2], yc2 = vx * u[0] + vy * u[1] + vz * u[2], zc = vx * f[0] + vy * f[1] + vz * f[2];
      const s = foc / zc;
      return { x: W / 2 + sx + xc * s, y: H / 2 + sy - yc2 * s, s };
    },
  };
  return cam;
}
