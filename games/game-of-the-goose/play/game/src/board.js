// The spiral, as unit coordinates (the board has radius 1). Space 1 is outermost at the lower left, the Garden (63) is the centre disc.
// Spaces 1..62 sit on an Archimedean spiral at equal arc length; index 0 is the start marker just outside space 1.
import { FINAL } from './engine.js';

const TURNS = 2.7, R_OUT = 0.88, R_IN = 0.4, START_ANGLE = Math.PI * 0.78;
export const GARDEN_R = 0.27;

function build() {
  const k = (R_OUT - R_IN) / (Math.PI * 2 * TURNS);
  const total = Math.PI * 2 * TURNS;
  const steps = 4000, dth = total / steps;
  // arc length table
  const s = new Float64Array(steps + 1);
  for (let i = 1; i <= steps; i++) { const th = (i - 0.5) * dth, r = R_OUT - k * th; s[i] = s[i - 1] + Math.sqrt(r * r + k * k) * dth; }
  const L = s[steps], ds = L / (FINAL - 2);
  const at = (target) => {
    // target arc length -> theta (may be negative: extrapolate outward for the start)
    if (target <= 0) { const th = target / Math.sqrt(R_OUT * R_OUT + k * k); return th; }
    let lo = 0, hi = steps;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (s[mid] < target) lo = mid; else hi = mid; }
    const f = (target - s[lo]) / Math.max(1e-9, s[hi] - s[lo]);
    return (lo + f) * dth;
  };
  const pts = [];
  for (let i = 0; i <= FINAL - 1; i++) {
    const th = at((i - 1) * ds), r = R_OUT - k * th, a = START_ANGLE + th;
    const x = r * Math.cos(a), y = r * Math.sin(a);
    // tangent (direction of travel)
    const tx = -k * Math.cos(a) - r * Math.sin(a), ty = -k * Math.sin(a) + r * Math.cos(a);
    pts.push({ i, x, y, ang: Math.atan2(ty, tx), r });
  }
  pts.push({ i: FINAL, x: 0, y: 0, ang: 0, r: 0 });
  return { pts, along: ds * 0.93, across: Math.PI * 2 * k * 0.93 };
}

const B = build();
export const SPOT = B.pts;                 // SPOT[n] for n = 0..63, unit coordinates
export const TILE_W = B.along;             // along the path
export const TILE_H = B.across;            // across the path
