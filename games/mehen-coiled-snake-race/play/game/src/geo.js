// The coiled snake as geometry. One spiral, defined in the unit square: the tail on the outside (bottom), the body winding inwards
// clockwise, the head in the middle. Cell centres, tangent angles and the arc-length table are shared by the drawing code and by the
// baked relief (bake.js), so a lion always stands exactly on a carved cell. Pure math, no drawing.
import { TRACK } from './rules.js';
import { v3 } from './v3.js';

export const SPIRAL = {
  rOut: 0.415,          // radius of the centre line at the tail end
  rEnd: 0.158,          // radius of the centre line at the last body cell
  turns: 2.5,
  phi0: Math.PI / 2,    // the tail starts at the bottom of the board
  half: 0.047,          // half width of the snake body
  headR: 0.108,         // radius of the head disc at the middle
};
const CELLS = TRACK - 1;                                  // body cells 1..29; cell 30 is the head
const TH = SPIRAL.turns * Math.PI * 2;
const K = (SPIRAL.rOut - SPIRAL.rEnd) / TH;               // radius lost per radian
export const radiusAt = (th) => SPIRAL.rOut - K * th;
export const slope = K;

// arc length table s(theta), theta from -0.9 (the tail tip) to TH + 0.3
const T0 = -1.1, T1 = TH + 0.35, NSAMP = 1400;
const sTab = new Float32Array(NSAMP + 1);
{
  let s = 0;
  for (let i = 0; i <= NSAMP; i++) {
    const th = T0 + ((T1 - T0) * i) / NSAMP;
    if (i > 0) {
      const thm = T0 + ((T1 - T0) * (i - 0.5)) / NSAMP, r = radiusAt(thm);
      s += Math.hypot(r, K) * ((T1 - T0) / NSAMP);
    }
    sTab[i] = s;
  }
}
const s0 = (() => { const i = (0 - T0) / (T1 - T0) * NSAMP; const k = Math.floor(i); return sTab[k] + (sTab[k + 1] - sTab[k]) * (i - k); })();
export const sOf = (th) => {
  const i = ((th - T0) / (T1 - T0)) * NSAMP, k = Math.max(0, Math.min(NSAMP - 1, Math.floor(i)));
  return sTab[k] + (sTab[k + 1] - sTab[k]) * (i - k) - s0;
};
export const thetaOf = (s) => {
  const target = s + s0;
  let lo = 0, hi = NSAMP;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (sTab[m] <= target) lo = m; else hi = m; }
  const f = (target - sTab[lo]) / Math.max(1e-9, sTab[hi] - sTab[lo]);
  return T0 + ((T1 - T0) * (lo + f)) / NSAMP;
};
export const LENGTH = sOf(TH);                           // arc length of the whole centre line (to the last cell's end)
export const CELL_LEN = LENGTH / CELLS;
export const TAIL_TH = T0, END_TH = TH;

// point on the centre line (unit square) at angle parameter th, and the travel direction there
export function pointAt(th) {
  const r = radiusAt(th), a = SPIRAL.phi0 + th;
  const x = 0.5 + r * Math.cos(a), y = 0.5 + r * Math.sin(a);
  // d/dth of (x, y) = (-K cos a - r sin a, -K sin a + r cos a)
  const dx = -K * Math.cos(a) - r * Math.sin(a), dy = -K * Math.sin(a) + r * Math.cos(a);
  return { x, y, ang: Math.atan2(dy, dx) };
}

// centres of cells 0..30 (cell 0 is the pen position just outside the tail) in unit coordinates
export const CELL_PTS = (() => {
  const pts = [];
  pts[0] = pointAt(thetaOf(-0.62 * CELL_LEN));
  for (let i = 1; i <= CELLS; i++) pts[i] = pointAt(thetaOf((i - 0.5) * CELL_LEN));
  pts[TRACK] = { x: 0.5, y: 0.5, ang: pts[CELLS].ang };
  return pts;
})();

const cache = new Map();
// board geometry in canvas units for a square board at (x, y) of size `side`. While the 3D scene is on (v3.proj) the points are the
// projection of the tilted 3D board instead (same fields, so taps, trails and highlights use exactly what is on screen); `flat`
// forces the plain square (the title's attract art).
export function trackGeo(x, y, side, flat = false) {
  const p3 = !flat && v3.on && v3.proj;
  const key = p3 ? `3d|${v3.key}|${Math.round(side)}` : `${Math.round(x * 4)}|${Math.round(y * 4)}|${Math.round(side * 4)}`;
  let g = cache.get(key);
  if (g) return g;
  if (p3) {
    const pj = v3.proj, E = 0.004;
    const P = (p) => {
      const a = pj(p.x, p.y), b = pj(p.x + Math.cos(p.ang) * E, p.y + Math.sin(p.ang) * E);
      return { x: a[0], y: a[1], ang: Math.atan2(b[1] - a[1], b[0] - a[0]), ux: p.x, uy: p.y, uang: p.ang };
    };
    const cells = CELL_PTS.map(P);
    const dist = (u, w) => Math.hypot(u[0] - w[0], u[1] - w[1]);
    let cw = 0, cl = 0;
    for (let i = 1; i < TRACK; i++) {
      const p = CELL_PTS[i], c = Math.cos(p.ang), s = Math.sin(p.ang), h = SPIRAL.half, l = CELL_LEN / 2;
      cw += dist(pj(p.x - s * h, p.y + c * h), pj(p.x + s * h, p.y - c * h)); cl += dist(pj(p.x - c * l, p.y - s * l), pj(p.x + c * l, p.y + s * l));
    }
    cw /= TRACK - 1; cl /= TRACK - 1;
    const hc = pj(0.5, 0.5), hr = SPIRAL.headR, hx = dist(pj(0.5 - hr, 0.5), pj(0.5 + hr, 0.5)) / 2, hy = dist(pj(0.5, 0.5 - hr), pj(0.5, 0.5 + hr)) / 2;
    g = { x, y, side, p3: true, cells, cellW: cw, cellL: cl, lion: cw * 1.05, head: { x: hc[0], y: hc[1], r: (hx + hy) / 2 }, spiral: null, pt: (ux, uy) => pj(ux, uy) };
    cells[TRACK].ang = cells[CELLS].ang;
  } else {
    const P = (p) => ({ x: x + p.x * side, y: y + p.y * side, ang: p.ang, ux: p.x, uy: p.y, uang: p.ang });
    g = {
      x, y, side, cells: CELL_PTS.map(P),
      cellW: SPIRAL.half * 2 * side, cellL: CELL_LEN * side, lion: Math.min(SPIRAL.half * 2.05, CELL_LEN * 0.8) * side,
      head: { x: x + 0.5 * side, y: y + 0.5 * side, r: SPIRAL.headR * side },
      spiral: null,
    };
  }
  if (cache.size > 24) cache.delete(cache.keys().next().value);
  cache.set(key, g);
  return g;
}

// A polyline along the centre line between two cells (for rolling marbles and sliding lions): points in canvas units.
export function pathBetween(g, a, b, steps = 6) {
  const out = [];
  const th = (c) => (c <= 0 ? thetaOf(-0.62 * CELL_LEN) : c >= TRACK ? END_TH + 0.28 : thetaOf((c - 0.5) * CELL_LEN));
  const t0 = th(a), t1 = th(b);
  const n = Math.max(2, Math.ceil(Math.abs(b - a) * steps));
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n, p = pointAt(t);
    if (g.p3) { const q = g.pt(p.x, p.y); out.push({ x: q[0], y: q[1], ang: p.ang, ux: p.x, uy: p.y, uang: p.ang }); }
    else out.push({ x: g.x + p.x * g.side, y: g.y + p.y * g.side, ang: p.ang, ux: p.x, uy: p.y, uang: p.ang });
  }
  // end exactly on the cell centres
  out[0] = { ...g.cells[Math.max(0, Math.min(TRACK, a))] };
  out[out.length - 1] = { ...g.cells[Math.max(0, Math.min(TRACK, b))] };
  return out;
}

// Which cell is nearest to a canvas point? Returns { cell, d } (cell 1..30) using a generous radius.
export function cellNear(g, px, py) {
  let best = -1, bd = Infinity;
  for (let i = 1; i <= TRACK; i++) {
    const c = g.cells[i], d = Math.hypot(px - c.x, py - c.y) / (i === TRACK ? 1.25 : 1);
    if (d < bd) { bd = d; best = i; }
  }
  return { cell: best, d: bd };
}
