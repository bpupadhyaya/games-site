// The camera: a pinhole looking down the lane from behind and above the throwing circle.
// project(x, y, z) maps a world point to virtual screen pixels; unproject* go the other way for the
// ground plane. Everything is plain arithmetic, so it is deterministic and safe in the headless harness.
export const W = 720, H = 1280;
const CB = 1200, CH = 500, PHI = 0.9;
const COS = Math.cos(PHI), SIN = Math.sin(PHI);
const F = (330 / 100) * (CB * COS + CH * SIN);          // the lane's half-width fills the screen at the circle
const raw = (x, y, z) => {
  const fwd = y + CB, up = z - CH;
  const d = fwd * COS - up * SIN;
  const vy = fwd * SIN + up * COS;
  return { sx: (F * x) / d, sy: (-F * vy) / d, s: F / d };
};
const CY = 950 - raw(0, 0, 0).sy;
export const CX = W / 2;

// world -> screen. `s` is pixels per world unit across the screen at that depth.
export function project(x, y, z = 0) {
  const r = raw(x, y, z);
  return { x: CX + r.sx, y: CY + r.sy, s: r.s };
}
export function scaleAt(y) { return raw(0, y, 0).s; }
// ground row -> world y, for strip-wise texture mapping (pitch bake)
export function groundY(sy) {
  const t = (CY - sy) / F;
  return (CH * (COS + t * SIN)) / (SIN - t * COS) - CB;
}
// screen point -> ground point
export function unprojectGround(px, py) {
  const y = groundY(py);
  const s = scaleAt(y);
  return { x: (px - CX) / s, y };
}
// Foreshortening of the ground at depth y: screen px per world unit along the lane.
export function depthScale(y) {
  const a = project(0, y).y, b = project(0, y + 1).y;
  return a - b;
}
