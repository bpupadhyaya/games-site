// The camera: a pinhole looking down the lane from behind and above the throwing circle.
// project(x, y, z) maps a world point to STAGE pixels; unproject* go the other way for the ground plane.
// The stage is a rectangle in "reference units" (the approved phone look is 720 wide, 1280 tall, circle at y = 950).
// Fluid layouts pick a different stage size per screen shape (layout.js `stage`), so W, H, CX and CY are live bindings
// that setStage() updates; the bake in art.js snapshots them (getStage / useStage) so a half-finished bake survives a resize.
// Everything is plain arithmetic, so it is deterministic and safe in the headless harness.
const CB = 1200, CH = 500, PHI = 0.9;
const COS = Math.cos(PHI), SIN = Math.sin(PHI);
const F = (330 / 100) * (CB * COS + CH * SIN);          // the lane's half-width is 330 stage units at the circle
const raw = (x, y, z) => {
  const fwd = y + CB, up = z - CH;
  const d = fwd * COS - up * SIN;
  const vy = fwd * SIN + up * COS;
  return { sx: (F * x) / d, sy: (-F * vy) / d, s: F / d };
};
const SY0 = raw(0, 0, 0).sy;

export let W = 720, H = 1280, CX = 360, CY = 950 - SY0;
let stageKey = '720x1280@950';
// st = { w, h, cy }: stage width / height in stage units and the stage y of the throwing circle.
export function setStage(st) {
  W = st.w; H = st.h; CX = st.w / 2; CY = st.cy - SY0;
  stageKey = `${st.w}x${st.h}@${st.cy}`;
}
export const getStage = () => ({ w: W, h: H, cy: CY + SY0 });
export const stageId = () => stageKey;

// world -> stage. `s` is stage units per world unit across the screen at that depth.
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
// stage point -> ground point
export function unprojectGround(px, py) {
  const y = groundY(py);
  const s = scaleAt(y);
  return { x: (px - CX) / s, y };
}
// Foreshortening of the ground at depth y: stage units per world unit along the lane.
export function depthScale(y) {
  const a = project(0, y).y, b = project(0, y + 1).y;
  return a - b;
}
