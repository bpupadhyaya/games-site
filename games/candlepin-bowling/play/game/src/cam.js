// The lane camera: a pinhole that is moved between two poses (behind the foul line looking down the lane, and close
// to the pin deck) and eased between them while the ball rolls. Pure arithmetic, presentation only.
import { LANE } from './sim.js';

const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function frame(eye, tgt) {
  const f = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]), r = norm(cross(f, [0, 0, 1])), u = cross(r, f);
  return { f, r, u };
}
function rawProject(eye, fr, x, y, z) {
  const d = [x - eye[0], y - eye[1], z - eye[2]], zc = dot(d, fr.f);
  return { sx: dot(d, fr.r) / zc, sy: -dot(d, fr.u) / zc, zc };
}

// Fit a pose so that the 3D points fit rect = { x, y, w, h }; align 'bottom' puts the lowest point at the rect bottom.
function fit(rect, eye, tgt, pts, fillW, fillH, align) {
  const fr = frame(eye, tgt);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of pts) { const q = rawProject(eye, fr, p[0], p[1], p[2]); x0 = Math.min(x0, q.sx); x1 = Math.max(x1, q.sx); y0 = Math.min(y0, q.sy); y1 = Math.max(y1, q.sy); }
  const k = Math.min((rect.w * fillW) / (x1 - x0), (rect.h * fillH) / (y1 - y0));
  const ox = rect.x + rect.w / 2 - ((x0 + x1) / 2) * k;
  const oy = align === 'bottom' ? rect.y + rect.h - y1 * k - 4 : rect.y + (rect.h - (y1 - y0) * k) / 2 - y0 * k;
  return { eye, tgt, k, ox, oy, score: k };
}

const H = LANE.headY;
// The aim pose: the whole lane from the foul line to the pit, as seen over the bowler's shoulder.
export function aimPose(rect) {
  const pts = [[-0.9, 0.2, 0], [0.9, 0.2, 0], [-LANE.deckHalf, H + 1.2, 0], [LANE.deckHalf, H + 1.2, 0], [0, H + 0.8, 0.45], [0, H + 1.0, 1.0]];
  let best = null;
  for (const ez of [2.6, 3.0, 3.4]) for (const ey of [-3.4, -4.4]) {
    const c = fit(rect, [0, ey, ez], [0, H * 0.5, 0.2], pts, 0.96, 0.97, 'bottom');
    if (!best || c.score > best.score) best = c;
  }
  return best;
}
// The deck pose: behind and above the front of the rack so the pins fill the view.
export function deckPose(rect) {
  const pts = [[-LANE.deckHalf - 0.02, H - 0.55, 0], [LANE.deckHalf + 0.02, H - 0.55, 0], [-LANE.deckHalf, H + 1.15, 0], [LANE.deckHalf, H + 1.15, 0], [-0.5, H + 0.8, 0.45], [0.5, H + 0.8, 0.45], [0, H, 0.45]];
  return fit(rect, [0, H - 3.4, 2.4], [0, H + 0.4, 0.0], pts, 0.97, 0.96, 'center');
}
export function lerpPose(a, b, t) {
  const m = (u, v) => u + (v - u) * t;
  return { eye: [m(a.eye[0], b.eye[0]), m(a.eye[1], b.eye[1]), m(a.eye[2], b.eye[2])], tgt: [m(a.tgt[0], b.tgt[0]), m(a.tgt[1], b.tgt[1]), m(a.tgt[2], b.tgt[2])], k: a.k * Math.pow(b.k / a.k, t), ox: m(a.ox, b.ox), oy: m(a.oy, b.oy) };
}
export function makeCam(p) {
  const fr = frame(p.eye, p.tgt), { eye, k, ox, oy } = p;
  const project = (x, y, z = 0) => { const q = rawProject(eye, fr, x, y, z); return { x: ox + q.sx * k, y: oy + q.sy * k, s: k / q.zc, d: q.zc }; };
  // screen point -> floor (z = 0)
  const ground = (px, py) => {
    const sx = (px - ox) / k, sy = (py - oy) / k;
    const dir = [fr.f[0] + sx * fr.r[0] - sy * fr.u[0], fr.f[1] + sx * fr.r[1] - sy * fr.u[1], fr.f[2] + sx * fr.r[2] - sy * fr.u[2]];
    const t = -eye[2] / dir[2];
    return { x: eye[0] + t * dir[0], y: eye[1] + t * dir[1] };
  };
  return { project, ground, k, pose: p };
}
