// Geometry of Paper Cutting, all pure and deterministic: the sheets, the mirror-line folds that bring a sheet down to one wedge, the punch
// stamps, and the grid that says which part of the unfolded sheet is cut away (used for the match score, par and "does it hold together").
//
// Coordinates: the sheet lives in its own (u, v) space inside [-0.5, 0.5]^2 with y pointing DOWN. Every fold line passes through the sheet
// centre (the origin), so folds are mirror lines of the sheet. Angles are degrees measured like atan2(y, x): -90 is straight up.
// A fold to the wedge of order n (n mirror lines, 2n layers) leaves the sector between -90 - 180/n and -90 degrees.
import { newSheet, planFold, commitFold, withCreases, mInv, mApply, clipHalf, area } from './paper.js';

const D2R = Math.PI / 180;
const regular = (n, r, start = -90) => Array.from({ length: n }, (_, k) => [r * Math.cos((start + (360 / n) * k) * D2R), r * Math.sin((start + (360 / n) * k) * D2R)]);

// folds: the orders n a sheet can be folded to (1 = in half, 2 = quarters, 3 = sixths, 4 = eighths, 5 = tenths, 6 = twelfths)
export const SHEETS = {
  square: { id: 'square', name: 'Square', pts: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], folds: [1, 2, 4], aspect: 1 },
  banner: { id: 'banner', name: 'Banner', pts: [[-0.5, -0.36], [0.5, -0.36], [0.5, 0.36], [-0.5, 0.36]], folds: [1, 2], aspect: 0.72 },
  hex: { id: 'hex', name: 'Hexagon', pts: regular(6, 0.5), folds: [1, 3, 6], aspect: 1 },
  pent: { id: 'pent', name: 'Pentagon', pts: regular(5, 0.5), folds: [1, 5], aspect: 1 },
};
export const SHEET_IDS = Object.keys(SHEETS);
export const foldName = (n) => `x${2 * n}`;
export const foldWords = (n) => ({ 1: 'in half', 2: 'in quarters', 3: 'in sixths', 4: 'in eighths', 5: 'in tenths', 6: 'in twelfths' }[n]);

// ---- fold plans ----------------------------------------------------------------------------------------------------------------------
// The first fold brings the right half over onto the left half. Odd factors then fold the half like an accordion; every factor of two
// halves the sector again. All folds are valley folds with a line through the centre.
export function foldSpecs(n) {
  const spec = (alpha, toHigher) => {
    const a = alpha * D2R;
    return { a: [0, 0], n: toHigher ? [-Math.sin(a), Math.cos(a)] : [Math.sin(a), -Math.cos(a)], kind: 'valley', pick: 'all' };
  };
  const specs = [spec(-90, true)];
  let m = n, p = 0;
  while (m % 2 === 0) { m /= 2; p++; }
  const w = 180 / m;
  for (let j = 1; j < m; j++) specs.push(spec(-270 + j * w, false));
  let span = w;
  for (let i = 0; i < p; i++) { specs.push(spec(-90 - span / 2, false)); span /= 2; }
  return specs;
}

const planCache = new Map();
// states[0] = flat sheet, states[k+1] = after fold k; plans[k] = how fold k moves state k to state k+1 (with creasesAll for drawing).
export function foldPlan(sheetId, n) {
  const key = `${sheetId}:${n}`;
  let r = planCache.get(key);
  if (r) return r;
  const specs = foldSpecs(n);
  const states = [newSheet(SHEETS[sheetId].pts)], plans = [];
  for (const spec of specs) {
    const st = states[states.length - 1];
    const pl = planFold(st, spec);
    pl.dir = 1; pl.creasesAll = withCreases(st.creases, pl);
    plans.push(pl);
    states.push(commitFold(st, pl, { keepHist: false }));
  }
  const fin = states[states.length - 1];
  r = { sheetId, n, specs, states, plans, final: fin, wedge: fin.polys[0].pts, creases: fin.creases };
  if (planCache.size > 40) planCache.clear();
  planCache.set(key, r);
  return r;
}

// The angle (degrees) of the sector the wedge occupies.
export const wedgeAngles = (n) => [-90 - 180 / n, -90];
// How much the view is turned so the wedge points upwards on screen (radians).
export const viewRoll = (n) => (n >= 3 ? (90 / n) * D2R : 0);

// distance from the centre to the sheet boundary along an angle (degrees)
export function rayDist(sheetId, ang) {
  const pts = SHEETS[sheetId].pts, c = Math.cos(ang * D2R), s = Math.sin(ang * D2R);
  let best = 1e9;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], ex = q[0] - p[0], ey = q[1] - p[1];
    const den = c * ey - s * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = (p[0] * ey - p[1] * ex) / den, u = (p[0] * s - p[1] * c) / den;
    if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
  }
  return best;
}

// wedge warp: (t, f) with t = 0 at the centre and 1 at the paper edge, f = 0 at the far mirror line and 1 at the vertical mirror line
export function wedgePoint(sheetId, n, t, f) {
  const [a0, a1] = wedgeAngles(n), ang = a0 + (a1 - a0) * f, R = rayDist(sheetId, ang) * t;
  return [R * Math.cos(ang * D2R), R * Math.sin(ang * D2R)];
}

// ---- punches -------------------------------------------------------------------------------------------------------------------------
export const SHAPES = ['petal', 'circle', 'diamond', 'drop', 'tri', 'moon'];
export const SHAPE_NAMES = { petal: 'Petal', circle: 'Circle', diamond: 'Diamond', drop: 'Drop', tri: 'Triangle', moon: 'Crescent' };
export const SIZES = [0.034, 0.055, 0.085, 0.125];
export const SIZE_NAMES = ['XS', 'S', 'M', 'L'];
export const TURNS = 8;

const unitCache = {};
export function unitShape(name) {
  if (unitCache[name]) return unitCache[name];
  let pts = [];
  const circ = (cx, cy, r, n = 28, a0 = 0, a1 = 360) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + ((a1 - a0) * i) / n) * D2R; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; });
  if (name === 'circle') pts = circ(0, 0, 1, 28).slice(0, -1);
  else if (name === 'diamond') pts = [[0, -1.4], [0.74, 0], [0, 1.4], [-0.74, 0]];
  else if (name === 'tri') pts = [[0, -1.3], [1.08, 0.86], [-1.08, 0.86]];
  else if (name === 'petal') {
    const L = [], R = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14, y = -1.5 + 2.6 * t, w = 0.88 * Math.sin(Math.PI * t ** 0.78); R.push([w, y]); L.unshift([-w, y]); }
    pts = [...R, ...L].filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-6);
  } else if (name === 'drop') {
    const r = 0.78, cy = 0.5, tip = -1.45, d = cy - tip, psi = (Math.acos(r / d) * 180) / Math.PI;
    pts = [[0, tip], ...circ(0, cy, r, 22, psi, 360 - psi)];
  } else if (name === 'moon') {
    const o = circ(0, 0, 1, 40).slice(0, -1), c2 = [0.42, -0.1], r2 = 0.8;
    const outer = o.filter((p) => Math.hypot(p[0] - c2[0], p[1] - c2[1]) >= r2);
    const inner = circ(c2[0], c2[1], r2, 40).slice(0, -1).filter((p) => Math.hypot(p[0], p[1]) <= 1);
    // rotate the outer arc so it starts after the gap, then close with the inner arc running back
    let start = 0;
    for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; if (Math.hypot(a[0] - c2[0], a[1] - c2[1]) < r2 && Math.hypot(b[0] - c2[0], b[1] - c2[1]) >= r2) { start = (i + 1) % o.length; break; } }
    const arc = [];
    for (let i = 0; i < o.length; i++) { const p = o[(start + i) % o.length]; if (Math.hypot(p[0] - c2[0], p[1] - c2[1]) >= r2) arc.push(p); }
    const last = arc[arc.length - 1];
    const ang = (p) => Math.atan2(p[1] - c2[1], p[0] - c2[0]);
    const sorted = inner.slice().sort((p, q) => ang(p) - ang(q));
    const d0 = Math.hypot(sorted[0][0] - last[0], sorted[0][1] - last[1]), d1 = Math.hypot(sorted[sorted.length - 1][0] - last[0], sorted[sorted.length - 1][1] - last[1]);
    pts = [...arc, ...(d0 < d1 ? sorted : sorted.slice().reverse())];
    // recentre
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy2 = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    pts = pts.map((p) => [p[0] - cx, p[1] - cy2]);
  }
  unitCache[name] = pts;
  return pts;
}

// the outline of a cut in flat (wedge) coordinates
export function cutPoly(cut) {
  if (cut.k === 's') {
    const out = [];
    for (let i = 0; i + 1 < cut.p.length; i += 2) out.push([cut.p[i], cut.p[i + 1]]);
    return out;
  }
  const a = (cut.a * 2 * Math.PI) / TURNS, c = Math.cos(a), s = Math.sin(a), r = SIZES[cut.z] ?? SIZES[1];
  return unitShape(cut.s).map(([x, y]) => [cut.x + (x * c - y * s) * r, cut.y + (x * s + y * c) * r]);
}
export const punch = (s, x, y, z, a = 0) => ({ k: 'p', s, x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000, z, a });

// ---- point tests ---------------------------------------------------------------------------------------------------------------------
export function pointInPoly(x, y, poly) {
  let wn = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    if (a[1] <= y) { if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) wn++; }
    else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) wn--;
  }
  return wn !== 0;
}
const inConvex = (x, y, poly, eps = 1e-7) => {
  const sgn = area(poly) >= 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (sgn * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) < -eps) return false;
  }
  return true;
};

// ---- the cut grid --------------------------------------------------------------------------------------------------------------------
export const GRID = 96;
const mapCache = new Map();
// For every grid cell of the sheet: is it paper, and where does it sit in the folded wedge (fx, fy)?
export function cellMap(sheetId, n) {
  const key = `${sheetId}:${n}`;
  let M = mapCache.get(key);
  if (M) return M;
  const plan = foldPlan(sheetId, n), layers = plan.final.polys, sheet = SHEETS[sheetId].pts;
  const G = GRID, inside = new Uint8Array(G * G), fx = new Float32Array(G * G), fy = new Float32Array(G * G);
  let count = 0;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const u = (i + 0.5) / G - 0.5, v = (j + 0.5) / G - 0.5, k = j * G + i;
    if (!inConvex(u, v, sheet, 0)) continue;
    inside[k] = 1; count++;
    for (const P of layers) {
      const q = mApply(P.m, u, v);
      if (inConvex(q[0], q[1], P.pts, 1e-6)) { fx[k] = q[0]; fy[k] = q[1]; break; }
    }
  }
  M = { G, inside, fx, fy, count, sheetId, n };
  if (mapCache.size > 40) mapCache.clear();
  mapCache.set(key, M);
  return M;
}

// which cells are cut away by these cuts (applied to the folded wedge, repeated on every layer)
export function holesOf(M, cuts) {
  const holes = new Uint8Array(M.G * M.G);
  for (const c of cuts) {
    const poly = cutPoly(c);
    if (poly.length < 3) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of poly) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    for (let k = 0; k < holes.length; k++) {
      if (!M.inside[k] || holes[k]) continue;
      const x = M.fx[k], y = M.fy[k];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      if (pointInPoly(x, y, poly)) holes[k] = 1;
    }
  }
  return holes;
}

// How well two cut-away areas match, 0..1. A forgiving overlap: a cut-away cell counts as matched when the other cut-out has a cut-away cell
// within one grid cell of it, so a careful finger that lands a hair off still scores, while a missing, misplaced or wrong-shaped cut costs.
const grow = (a, G) => {
  const t = new Uint8Array(a.length), o = new Uint8Array(a.length);
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { const k = y * G + x; t[k] = a[k] || (x > 0 && a[k - 1]) || (x < G - 1 && a[k + 1]) ? 1 : 0; }
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { const k = y * G + x; o[k] = t[k] || (y > 0 && t[k - G]) || (y < G - 1 && t[k + G]) ? 1 : 0; }
  return o;
};
export function overlap(a, b) {
  const G = Math.round(Math.sqrt(a.length)), ga = grow(a, G), gb = grow(b, G);
  let n = 0, m = 0;
  for (let k = 0; k < a.length; k++) { if (a[k]) { n++; if (gb[k]) m++; } if (b[k]) { n++; if (ga[k]) m++; } }
  return n ? m / n : 0;
}
export const holeFraction = (holes, M) => { let h = 0; for (let k = 0; k < holes.length; k++) h += holes[k]; return h / Math.max(1, M.count); };

// how many separate pieces of paper are left (4-connected), and how many cells the largest one has
export function pieces(M, holes) {
  const G = M.G, seen = new Uint8Array(G * G);
  let n = 0, biggest = 0;
  const stack = [];
  for (let s = 0; s < G * G; s++) {
    if (!M.inside[s] || holes[s] || seen[s]) continue;
    n++; let size = 0;
    stack.push(s); seen[s] = 1;
    while (stack.length) {
      const k = stack.pop(); size++;
      const x = k % G, y = (k / G) | 0;
      const nb = [x > 0 ? k - 1 : -1, x < G - 1 ? k + 1 : -1, y > 0 ? k - G : -1, y < G - 1 ? k + G : -1];
      for (const q of nb) if (q >= 0 && M.inside[q] && !holes[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
    }
    biggest = Math.max(biggest, size);
  }
  return { n, biggest };
}

// ---- for drawing ---------------------------------------------------------------------------------------------------------------------
// every layer of the wedge as { poly in sheet space, matrix sheet->flat }: used to bake the cuts into the paper texture
export function layersOf(sheetId, n) {
  return foldPlan(sheetId, n).final.polys.map((P) => ({ flat: P.pts, m: P.m, inv: mInv(P.m), sheet: P.pts.map((p) => mApply(mInv(P.m), p[0], p[1])) }));
}
export { clipHalf };
