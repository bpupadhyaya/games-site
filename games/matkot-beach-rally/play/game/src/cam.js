// Screen and court geometry. Virtual resolution 720 x 1280 (portrait). The court is measured in metres:
// x across (-4.2 .. 4.2), y along (0 = near baseline, 12 = far baseline, 6 = the line in the middle), z up.
// A simple pinhole view from behind the near baseline, looking down the court.
export const W = 720;
export const H = 1280;
export const COURT = { hw: 4.2, len: 12, mid: 6 };
const F = 780, CAMD = 10, CAMH = 15.5, HZ = -79;

export const scaleAt = (y) => F / (y + CAMD);
export function project(x, y, z = 0) {
  const s = F / (y + CAMD);
  return { x: W / 2 + x * s, y: HZ + (CAMH - z) * s, s };
}
// Screen point -> ground point (z = 0).
export function unproject(sx, sy) {
  const s = (sy - HZ) / CAMH;
  return { x: (sx - W / 2) / s, y: F / s - CAMD };
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
