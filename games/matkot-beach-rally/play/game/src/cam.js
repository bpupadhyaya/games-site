// Screen and court geometry. The court is measured in metres: x across (-4.2 .. 4.2), y along (0 = near baseline, 12 = far baseline,
// 6 = the line in the middle), z up. A simple pinhole view from behind the near baseline, looking down the court.
// The camera follows the LIVE screen size (kit fluid viewport): layout.js computes a camera for every size and calls setCam().
// W and H are live bindings: every module that imports them sees the current virtual screen size.
export let W = 720;
export let H = 1280;
export const COURT = { hw: 4.2, len: 12, mid: 6 };
export const CAM0 = { F: 780, D: 10, CH: 15.5, HZ: -79, cx: 360 };
let CAM = { ...CAM0 };
export function setCam(cam, w, h) { CAM = cam; W = w; H = h; }
export const camNow = () => CAM;

export const scaleAt = (y) => CAM.F / (y + CAM.D);
export function project(x, y, z = 0) {
  const s = CAM.F / (y + CAM.D);
  return { x: CAM.cx + x * s, y: CAM.HZ + (CAM.CH - z) * s, s };
}
// Screen point -> ground point (z = 0).
export function unproject(sx, sy) {
  const s = (sy - CAM.HZ) / CAM.CH;
  return { x: (sx - CAM.cx) / s, y: CAM.F / s - CAM.D };
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
