// The camera: a pinhole looking down the court from behind and above the throwing end, fitted to a screen rectangle.
// project(x, y, z) -> screen { x, y, s } (s = pixels per metre at that depth); ground(sx, sy) goes the other way for the floor plane.
// Pure arithmetic, so it is deterministic and safe in the headless harness.
import { COURT, HALF } from './sim.js';

const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function buildFrom(eye, target) {
  const f = norm([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]), r = norm(cross(f, [0, 0, 1])), u = cross(r, f);
  const raw = (x, y, z) => { const d = [x - eye[0], y - eye[1], z - eye[2]]; const zc = dot(d, f); return { sx: dot(d, r) / zc, sy: -dot(d, u) / zc, zc }; };
  return { eye, f, r, u, raw };
}
const build = (ez, ey, ty) => buildFrom([0, ey, ez], [0, ty, 0]);

// Fit the court into rect {x, y, w, h}.
// mode 'back' (portrait): behind and above the throwing end, the court runs up the screen; opts.fillW = share of the rect width the near end may use.
// mode 'side' (landscape): from beside the court and a little behind the thrower, so the court runs left to right and fills a wide screen.
export function makeCamera(rect, opts = {}) {
  const fillW = opts.fillW ?? 0.84, yNear = opts.yNear ?? 1.6, side = opts.mode === 'side';
  let best = null;
  const cands = [];
  if (!side) for (const ez of opts.eyes ?? [5.2, 6.2, 7.4, 9]) { const ey = -(ez * 0.95 + 1.2); cands.push(build(ez, ey, opts.ty ?? 11.5)); }
  else for (const phi of [4, 8, 12, 16, 20, 26]) for (const H of [6, 8, 10, 12]) {
    const pr = (phi * Math.PI) / 180, D = 17;
    cands.push(buildFrom([D * Math.cos(pr), 9 - D * Math.sin(pr), H], [0, 9.5, 0]));
  }
  for (const c of cands) {
    const wl = COURT.wallH, rl = COURT.railH;
    const pts = [[-HALF, yNear, 0], [HALF, yNear, 0], [-HALF, COURT.L, 0], [HALF, COURT.L, 0], [-HALF, COURT.L, wl + 0.3], [HALF, COURT.L, wl + 0.3], [-HALF, yNear, rl], [HALF, yNear, rl], [HALF, COURT.L, rl]];
    if (!side) pts.push([-HALF - 0.5, COURT.L, 0], [HALF + 0.5, COURT.L, 0]);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { const q = c.raw(p[0], p[1], p[2]); x0 = Math.min(x0, q.sx); x1 = Math.max(x1, q.sx); y0 = Math.min(y0, q.sy); y1 = Math.max(y1, q.sy); }
    let k;
    if (!side) { const nearW = c.raw(HALF, yNear, 0).sx - c.raw(-HALF, yNear, 0).sx; k = Math.min((rect.w * fillW) / nearW, rect.h / (y1 - y0)); }
    else k = Math.min((rect.w * fillW) / (x1 - x0), rect.h / (y1 - y0));
    // prefer a bigger court; in the side view a higher eye keeps the near rail from hiding the floor
    let score = k;
    if (side) {
      const a = c.raw(0, yNear, 0), b = c.raw(0, COURT.L, 0), slope = Math.abs((b.sy - a.sy) / (b.sx - a.sx || 1e-6)), lim = opts.maxSlope ?? 0.2;
      score = k * (1 - Math.max(0, 8 - c.eye[2]) * 0.03) * (1 - 1.5 * Math.max(0, slope - lim));
    }
    if (!best || score > best.score) best = { score, k, c, x0, x1, y0, y1 };
  }
  const { k, c, x0, x1, y0, y1 } = best;
  const ox = rect.x + rect.w / 2 - ((x0 + x1) / 2) * k;
  const oy = rect.y + (rect.h - (y1 - y0) * k) / 2 - y0 * k;
  const project = (x, y, z = 0) => { const q = c.raw(x, y, z); return { x: ox + q.sx * k, y: oy + q.sy * k, s: k / q.zc }; };
  const ground = (px, py) => {
    const sx = (px - ox) / k, sy = (py - oy) / k;
    const dir = [c.f[0] + sx * c.r[0] - sy * c.u[0], c.f[1] + sx * c.r[1] - sy * c.u[1], c.f[2] + sx * c.r[2] - sy * c.u[2]];
    const t = -c.eye[2] / dir[2];
    return { x: c.eye[0] + t * dir[0], y: c.eye[1] + t * dir[1] };
  };
  return { project, ground, k, ox, oy, rect, ez: c.eye[2], eye: c.eye, side, fwd: c.f };
}
