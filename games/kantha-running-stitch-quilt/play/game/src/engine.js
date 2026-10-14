// Kantha engine: cloth patches (rows of running stitch), the thread-length rules, an exact solver, hints, and Steady Hand rounds.
// Pure and deterministic: no DOM, no clock, no Math.random (seeded generators only).
//
// A PATCH is a square of cloth (SIZE x SIZE cloth units) with RUNS: rows of running stitch, each one open (two ends) or closed
// (a ring or petal: four entry points). To sew a run the needle starts at one of its OPTIONS (an end or an entry point), travels
// along it and finishes at the option's end. The thread rule (see "thread length" below):
//   - a thread is C units long; the first thread starts anywhere;
//   - sewing a run uses the run's length, and the hop under the cloth to its start uses thread too;
//   - when the next run does not fit (or is another colour) a new thread starts there and the rest of the old one is wasted;
//   - fewer threads is better. At most MAX_RUNS runs per patch lets an exact bitmask DP solve every patch.

export const SIZE = 10;
export const MAX_RUNS = 12;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const r1 = (v) => Math.round(v * 10) / 10;

export function seeded(seed) {
  let a = (seed | 0) ^ 0x9e3779b9;
  const next = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n), range: (lo, hi) => lo + next() * (hi - lo), pick: (arr) => arr[Math.floor(next() * arr.length)], chance: (p) => next() < p };
}

// ---- geometry ---------------------------------------------------------------------------------------------------------------------
const STEP = 0.11;
export function circle(cx, cy, r, a0 = -Math.PI / 2) {
  const n = Math.max(24, Math.ceil((TAU * r) / STEP)), out = [];
  for (let i = 0; i < n; i++) { const a = a0 + (TAU * i) / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
export function ellipse(cx, cy, rx, ry, rot = 0) {
  const n = Math.max(32, Math.ceil((TAU * Math.max(rx, ry)) / STEP)), out = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = Math.PI + (TAU * i) / n, x = Math.cos(a) * rx, y = Math.sin(a) * ry; out.push([cx + x * c - y * s, cy + x * s + y * c]); }
  return out;
}
export function line(x0, y0, x1, y1) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.ceil(len / STEP)), out = [];
  for (let i = 0; i <= n; i++) out.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  return out;
}
// A horizontal wavy row: y = y0 + amp * sin(TAU * x / period + phase).
export function waveRow(xa, xb, y0, amp, period, phase = 0) {
  const n = Math.max(2, Math.ceil((xb - xa) / STEP)), out = [];
  for (let i = 0; i <= n; i++) { const x = xa + ((xb - xa) * i) / n; out.push([x, y0 + amp * Math.sin((TAU * x) / period + phase)]); }
  return out;
}
export function poly(vs, closed = false) {
  const out = [], m = closed ? vs.length : vs.length - 1;
  for (let i = 0; i < m; i++) {
    const a = vs[i], b = vs[(i + 1) % vs.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / STEP));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  if (!closed) out.push(vs[vs.length - 1].slice());
  return out;
}
export function arc(cx, cy, r, a0, a1) {
  const n = Math.max(6, Math.ceil((Math.abs(a1 - a0) * r) / STEP)), out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
// A closed teardrop petal whose base sits at (cx, cy) and whose tip points along `ang`.
export function petal(cx, cy, ang, len, wid) {
  const n = Math.max(32, Math.ceil((len * 2.4 + wid) / STEP)), out = [], c = Math.cos(ang), s = Math.sin(ang);
  for (let i = 0; i < n; i++) {
    const t = (TAU * i) / n, u = (1 - Math.cos(t)) / 2, side = Math.sin(t) * (wid / 2) * (1 - 0.55 * u), x = u * len;
    out.push([cx + x * c - side * s, cy + x * s + side * c]);
  }
  return out;
}
// A row of scallops (half circles) across, bumps up.
export function scallopRow(xa, xb, y, r) {
  const n = Math.max(1, Math.round((xb - xa) / (2 * r))), w = (xb - xa) / n, out = [];
  for (let k = 0; k < n; k++) { const a = arc(xa + w * (k + 0.5), y, w / 2, Math.PI, TAU); out.push(...(k ? a.slice(1) : a)); }
  return out;
}

// ---- runs and options -----------------------------------------------------------------------------------------------------------------
export function makeRun(i, def) {
  const pts = def.pts.map((p) => [p[0], p[1]]);
  if (def.closed) pts.push([pts[0][0], pts[0][1]]);
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + dist(pts[k - 1], pts[k]));
  const run = { i, name: def.name, color: def.color, closed: !!def.closed, pts, cum, len: cum[cum.length - 1], opts: [], mark: def.mark ?? null };
  if (!run.closed) {
    run.opts.push({ run: i, s0: 0, dir: 1, from: pts[0], to: pts[pts.length - 1], end: 'first' });
    run.opts.push({ run: i, s0: run.len, dir: -1, from: pts[pts.length - 1], to: pts[0], end: 'last' });
  } else {
    const fr = def.entries ?? [0, 0.25, 0.5, 0.75];
    for (const f of fr) { const s0 = f * run.len, p = pointAt(run, s0); run.opts.push({ run: i, s0, dir: 1, from: p, to: p, end: 'ring' }); }
  }
  return run;
}
// Point at arc length s (wraps on closed runs).
export function pointAt(run, s) {
  let q = s;
  if (run.closed) { q = ((s % run.len) + run.len) % run.len; } else q = clamp(s, 0, run.len);
  const c = run.cum;
  let lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (c[mid] <= q) lo = mid; else hi = mid; }
  const seg = c[hi] - c[lo], t = seg > 0 ? (q - c[lo]) / seg : 0, a = run.pts[lo], b = run.pts[hi];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
// Arc length (along the sewing direction) -> position on the run for option `opt`.
export const sewPoint = (run, opt, u) => pointAt(run, opt.s0 + opt.dir * u);

// ---- patch builders ---------------------------------------------------------------------------------------------------------------------
const ORD = ['top', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const DIAG = ['upper right', 'upper left', 'lower left', 'lower right'];
const polar = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
const deg = (d) => (d * Math.PI) / 180;
const D = (name, color, pts, closed = false, entries) => ({ name, color, pts, closed, entries });
const rowYs = (n, y0 = 1.7, y1 = 8.3) => Array.from({ length: n }, (_, i) => (n === 1 ? (y0 + y1) / 2 : y0 + ((y1 - y0) * i) / (n - 1)));

function fish(tag, cx, cy, sz, dir, color, tailColor = color) {
  const body = ellipse(cx, cy, sz, sz * 0.5), bx = cx - dir * sz * 1.1, ex = cx - dir * sz * 1.9;
  return [D(`${tag} fish body`, color, body, true), D(`${tag} fish tail`, tailColor, [[ex, cy - sz * 0.56], [bx, cy], [ex, cy + sz * 0.56]])];
}
function sail(name, color, vs) { return D(name, color, poly(vs, true), true, [0, 0.34, 0.67]); }

// Each builder returns run definitions in a stable order. Colours are thread slots 0..4.
const B = {
  rows(o) {
    const ys = rowYs(o.n, o.y0 ?? 1.7, o.y1 ?? 8.3), defs = [];
    ys.forEach((y, i) => {
      const color = o.colors[i % o.colors.length], amp = o.amp ?? 0, ph = (o.phase ?? 0.9) * i;
      const x0 = o.xs ? o.xs[i][0] : 1, x1 = o.xs ? o.xs[i][1] : 9, name = `${ORD[i]} row`;
      const cuts = (o.split ?? {})[i];
      if (cuts) {
        const xa = [x0, ...cuts.map((c) => c[1])], xb = [...cuts.map((c) => c[0]), x1];
        xa.forEach((a, k) => defs.push(D(`${name}, ${k === 0 ? 'left' : k === xa.length - 1 ? 'right' : 'middle'} part`, color, waveRow(a, xb[k], y, amp, o.period ?? 4, ph))));
      } else defs.push(D(name, color, waveRow(x0, x1, y, amp, o.period ?? 4, ph)));
    });
    if (o.sides) { defs.push(D('left edge', o.sides, line(0.8, 1.2, 0.8, 8.8))); defs.push(D('right edge', o.sides, line(9.2, 1.2, 9.2, 8.8))); }
    return defs;
  },
  diagonals(o) {
    const defs = [];
    o.cs.forEach((c, i) => {
      const xa = Math.max(0.8, c - 9.2), xb = Math.min(9.2, c - 0.8);
      defs.push(D(`diagonal ${i + 1}`, o.colors[i % o.colors.length], line(xa, c - xa, xb, c - xb)));
    });
    return defs;
  },
  rings(o) {
    const defs = [], cx = o.cx ?? 5, cy = o.cy ?? 5;
    o.rs.forEach((r, i) => defs.push(D(`${['inner', 'second', 'third', 'fourth', 'fifth'][i] ?? 'outer'} ring`, o.ringColors[i % o.ringColors.length], circle(cx, cy, r), true)));
    if (o.spokes) {
      const sp = o.spokes;
      for (let k = 0; k < sp.n; k++) {
        const a = deg(sp.a0 + (360 * k) / sp.n), name = `spoke ${k + 1}`;
        defs.push(D(name, sp.colors[k % sp.colors.length], line(...polar(cx, cy, sp.r0, a), ...polar(cx, cy, sp.r1, a))));
      }
    }
    return defs;
  },
  lotus(o) {
    const defs = [], cx = o.cx ?? 5, cy = o.cy ?? 5;
    for (const set of o.sets) {
      for (let k = 0; k < set.n; k++) {
        const a = deg(set.a0 + (360 * k) / set.n);
        defs.push(D(`${set.tag} ${k + 1}`, set.color, petal(...polar(cx, cy, set.base ?? 0, a), a, set.len, set.wid), true, [0.25, 0.5, 0.75]));
      }
    }
    if (o.ring) defs.push(D('centre ring', o.ring.color, circle(cx, cy, o.ring.r), true));
    if (o.outer) defs.push(D('outer ring', o.outer.color, circle(cx, cy, o.outer.r), true));
    if (o.diamond) defs.push(D('border diamond', o.diamond.color, poly([polar(cx, cy, o.diamond.r, -Math.PI / 2), polar(cx, cy, o.diamond.r, 0), polar(cx, cy, o.diamond.r, Math.PI / 2), polar(cx, cy, o.diamond.r, Math.PI)], true), true, [0, 0.25, 0.5, 0.75]));
    return defs;
  },
};

// ---- the 30 patches ---------------------------------------------------------------------------------------------------------------------
export const CHAPTERS = [
  { id: 'rows', name: 'Border Rows', blurb: 'Straight and wavy rows: the heart of kantha.', count: 6, loose: 0.1 },
  { id: 'rings', name: 'Rings and Spokes', blurb: 'Closed rings can be entered at four points.', count: 6, loose: 0.04 },
  { id: 'lotus', name: 'Lotus', blurb: 'Petals meet at the middle of the flower.', count: 6, loose: 0.0 },
  { id: 'fish', name: 'Fish and Waves', blurb: 'Tails, bodies and ripples in three colours.', count: 6, loose: 0.0 },
  { id: 'tree', name: 'Tree of Life', blurb: 'Trunk, branches and leaves with little to spare.', count: 6, loose: 0.0 },
];

function treePieces(o) {
  const defs = [], cx = o.cx ?? 5;
  defs.push(D('trunk', o.trunk, line(cx, o.y1 ?? 8.6, cx, o.y0 ?? 2.6)));
  const leafR = o.leaf ?? 1.7;
  (o.pairs ?? []).forEach((p, i) => {
    for (const side of [-1, 1]) {
      const ex = cx + side * p.d, ey = p.y - p.d * 0.85;
      defs.push(D(`${side < 0 ? 'left' : 'right'} branch ${i + 1}`, o.branch, line(cx, p.y, ex, ey)));
      if (p.leaf) defs.push(D(`${side < 0 ? 'left' : 'right'} leaf ${i + 1}`, o.leafColor, petal(ex, ey, Math.atan2(-0.85, side), leafR, leafR * 0.55), true, [0, 0.5]));
    }
  });
  if (o.topLeaf) defs.push(D('top leaf', o.leafColor, petal(cx, (o.y0 ?? 2.6) + 0.1, -Math.PI / 2, leafR * 1.15, leafR * 0.6), true, [0, 0.5]));
  return defs;
}

const SPECS = [
  // Chapter 1: Border Rows
  () => B.rows({ n: 4, colors: [0] }),
  () => B.rows({ n: 5, colors: [1], split: { 2: [[4.2, 5.8]] } }),
  () => B.rows({ n: 5, colors: [0], amp: 0.32, period: 3.2, split: { 1: [[4.6, 5.4]], 3: [[4.2, 5.8]] } }),
  () => B.rows({ n: 6, colors: [2], xs: [[0.9, 8.2], [1.8, 9.1], [0.9, 8.2], [1.8, 9.1], [0.9, 8.2], [1.8, 9.1]], sides: 2 }),
  () => B.rows({ n: 6, colors: [0, 1], amp: 0.25, period: 4.5 }),
  () => B.diagonals({ cs: [4, 6, 8, 10, 12, 14, 16], colors: [0, 0, 1, 1, 0, 0, 1] }),
  // Chapter 2: Rings and Spokes
  () => B.rings({ rs: [1.4, 3, 4.4], ringColors: [0], spokes: { n: 4, a0: 45, r0: 0.5, r1: 4.7, colors: [1] } }),
  () => B.rings({ rs: [1, 2.2, 3.3, 4.4], ringColors: [0, 1], spokes: { n: 4, a0: 0, r0: 3.3, r1: 4.4, colors: [2] } }),
  () => B.rings({ rs: [2, 4], ringColors: [0], spokes: { n: 8, a0: 22.5, r0: 2, r1: 4, colors: [1, 2] } }),
  () => [D('centre ring', 0, circle(5, 5, 1.0), true), D('middle ring', 0, circle(4.3, 5.4, 2.5), true), D('wide ring', 0, circle(5.8, 4.6, 3.9), true),
    D('slash', 1, line(0.9, 0.9, 9.1, 9.1)), D('backslash', 1, line(9.1, 0.9, 0.9, 9.1)),
    D('top left ring', 2, circle(1.7, 1.7, 0.8), true), D('top right ring', 2, circle(8.3, 1.7, 0.8), true), D('bottom left ring', 2, circle(1.7, 8.3, 0.8), true), D('bottom right ring', 2, circle(8.3, 8.3, 0.8), true)],
  () => {
    const defs = [D('centre ring', 1, circle(5, 5, 1.6), true)];
    for (let k = 0; k < 6; k++) { const a = deg(30 + 60 * k), p = polar(5, 5, 2.9, a); defs.push(D(`petal ring ${k + 1}`, k % 2 ? 2 : 0, circle(p[0], p[1], 1.5), true)); }
    defs.push(D('outer ring', 3, circle(5, 5, 4.7), true));
    return defs;
  },
  () => B.rings({ rs: [1.5, 3.1, 4.6], ringColors: [0, 1, 0], spokes: { n: 8, a0: 0, r0: 1.5, r1: 4.6, colors: [2, 3] } }),
  // Chapter 3: Lotus
  () => B.lotus({ sets: [{ tag: 'petal', n: 6, a0: -90, len: 3.6, wid: 1.9, color: 0, base: 0.4 }], ring: { r: 0.7, color: 1 } }),
  () => B.lotus({ sets: [{ tag: 'petal', n: 8, a0: -90, len: 3.5, wid: 1.4, color: 0, base: 0.5 }], ring: { r: 0.7, color: 1 }, outer: { r: 4.6, color: 2 } }),
  () => B.lotus({ sets: [{ tag: 'big petal', n: 5, a0: -90, len: 4, wid: 2, color: 0, base: 0.4 }, { tag: 'leaf', n: 5, a0: -54, len: 2.3, wid: 1.1, color: 2, base: 0.4 }], ring: { r: 0.6, color: 1 } }),
  () => B.lotus({ sets: [{ tag: 'long petal', n: 4, a0: -90, len: 4.1, wid: 2.2, color: 0, base: 0.4 }, { tag: 'short petal', n: 4, a0: -45, len: 3, wid: 1.4, color: 2, base: 0.4 }], ring: { r: 0.6, color: 1 }, diamond: { r: 4.6, color: 3 } }),
  () => B.lotus({ sets: [{ tag: 'inner petal', n: 5, a0: -90, len: 2.2, wid: 1.2, color: 0, base: 0.3 }, { tag: 'outer petal', n: 5, a0: -54, len: 4.2, wid: 1.8, color: 1, base: 0.3 }], ring: { r: 0.45, color: 2 } }),
  () => [...B.lotus({ cy: 4, sets: [{ tag: 'petal', n: 6, a0: -90, len: 3, wid: 1.6, color: 0, base: 0.4 }], ring: { r: 0.6, color: 2 } }),
    D('wave 1', 1, waveRow(0.9, 9.1, 7.6, 0.3, 3, 0)), D('wave 2', 1, waveRow(0.9, 9.1, 8.5, 0.3, 3, 1.4)), D('wave 3', 1, waveRow(0.9, 9.1, 9.3, 0.3, 3, 2.8))],
  // Chapter 4: Fish and Waves
  () => [...fish('left', 4, 2.9, 1.4, 1, 0), ...fish('right', 6.4, 5.6, 1.4, -1, 2), D('wave 1', 1, waveRow(0.9, 9.1, 7.8, 0.3, 3, 0)), D('wave 2', 1, waveRow(0.9, 9.1, 8.9, 0.3, 3, 1.5))],
  () => [...fish('upper', 4.6, 2, 1.3, 1, 0), ...fish('middle', 5.4, 4.5, 1.3, 1, 2), ...fish('lower', 4.6, 7, 1.3, 1, 0), D('wave 1', 1, waveRow(0.9, 9.1, 3.3, 0.25, 3, 0)), D('wave 2', 1, waveRow(0.9, 9.1, 5.8, 0.25, 3, 1.5)), D('wave 3', 1, waveRow(0.9, 9.1, 8.5, 0.25, 3, 3))],
  () => [...fish('big', 4.2, 2.6, 1.7, 1, 0, 3), ...fish('small left', 2.6, 6.4, 0.95, 1, 2), ...fish('small mid', 6.4, 6, 0.95, -1, 2), ...fish('small right', 7, 8.2, 0.8, 1, 4), D('wave 1', 1, waveRow(0.9, 9.1, 4.7, 0.25, 3, 0.8)), D('wave 2', 1, waveRow(0.9, 9.1, 9.3, 0.25, 3, 2.2))],
  () => [D('hull', 0, arc(5, 1.4, 5, deg(55), deg(125))), sail('big sail', 3, [[5.2, 0.9], [5.2, 4.9], [8.3, 4.9]]), sail('small sail', 2, [[4.8, 2.2], [4.8, 4.9], [2.3, 4.9]]), D('mast', 0, line(5, 0.7, 5, 5.7)),
    D('wave 1', 1, waveRow(0.9, 9.1, 6.9, 0.3, 3, 0)), D('wave 2', 1, waveRow(0.9, 9.1, 7.8, 0.3, 3, 1.5)), D('wave 3', 1, waveRow(0.9, 9.1, 8.7, 0.3, 3, 3)), D('wave 4', 4, waveRow(0.9, 9.1, 9.5, 0.3, 3, 4.2))],
  () => [D('scallops 1', 1, scallopRow(0.9, 9.1, 2.2, 0.55)), D('scallops 2', 4, scallopRow(0.9, 9.1, 3.6, 0.55)), D('scallops 3', 1, scallopRow(0.9, 9.1, 5, 0.55)), D('scallops 4', 4, scallopRow(0.9, 9.1, 6.4, 0.55)),
    ...fish('left', 3.4, 8.2, 0.9, 1, 0), ...fish('right', 7, 8.2, 0.9, -1, 2)],
  () => [...fish('great', 5, 4.2, 2.3, 1, 0, 3), D('scale ring 1', 2, circle(4.2, 4.2, 0.55), true), D('scale ring 2', 2, circle(5.4, 4.2, 0.55), true), D('eye ring', 3, circle(6.4, 3.7, 0.28), true),
    D('wave 1', 1, waveRow(0.9, 9.1, 7.5, 0.3, 3, 0)), D('wave 2', 1, waveRow(0.9, 9.1, 8.4, 0.3, 3, 1.5)), D('wave 3', 4, waveRow(0.9, 9.1, 9.3, 0.3, 3, 3)), D('wave 4', 4, waveRow(0.9, 9.1, 0.8, 0.3, 3, 4.5))],
  // Chapter 5: Tree of Life
  () => [...treePieces({ trunk: 0, branch: 0, leafColor: 1, y1: 8.4, y0: 2.8, pairs: [{ y: 6.4, d: 2.4, leaf: true }, { y: 4.4, d: 1.8, leaf: true }] }), D('ground', 2, waveRow(1, 9, 9.2, 0.2, 2.5, 0))],
  () => [...treePieces({ trunk: 0, branch: 0, leafColor: 1, y1: 8.5, y0: 1.8, pairs: [{ y: 6.8, d: 2.6, leaf: true }, { y: 5, d: 2.1, leaf: true }, { y: 3.4, d: 1.5, leaf: false }], leaf: 1.5 }), D('ground', 2, waveRow(1, 9, 9.3, 0.2, 2.5, 0))],
  () => [D('frame', 3, poly([[0.8, 0.8], [9.2, 0.8], [9.2, 9.2], [0.8, 9.2]], true), true, [0, 0.25, 0.5, 0.75]), ...treePieces({ trunk: 0, branch: 0, leafColor: 1, y1: 8.4, y0: 3, pairs: [{ y: 6.6, d: 2.3, leaf: true }, { y: 4.8, d: 1.7, leaf: true }] }), D('sun ring', 2, circle(8, 2, 0.8), true)],
  () => [...treePieces({ cx: 3, trunk: 0, branch: 0, leafColor: 1, y1: 8.3, y0: 4, pairs: [{ y: 6.6, d: 1.9, leaf: false }], topLeaf: true, leaf: 1.5 }),
    ...treePieces({ cx: 7.2, trunk: 0, branch: 0, leafColor: 4, y1: 8.3, y0: 3, pairs: [{ y: 6.2, d: 2, leaf: false }], topLeaf: true, leaf: 1.6 }).map((d, i) => ({ ...d, name: `${d.name} (second tree)` })),
    D('sun ring', 2, circle(5.1, 1.7, 0.7), true), D('ground', 3, waveRow(1, 9, 9.3, 0.2, 2.5, 0))],
  () => [...treePieces({ trunk: 0, branch: 0, leafColor: 1, y1: 8.4, y0: 2.4, pairs: [{ y: 6.3, d: 2.5 }, { y: 4.3, d: 1.9 }] }), ...[[2.5, 3.4], [7.5, 3.4], [3.2, 1.6], [6.8, 1.6], [5, 1]].map((p, i) => D(`fruit ${i + 1}`, 2, circle(p[0], p[1], 0.5), true)), D('ground', 3, waveRow(1, 9, 9.3, 0.2, 2.5, 0))],
  () => [D('frame', 3, poly([[0.8, 0.8], [9.2, 0.8], [9.2, 9.2], [0.8, 9.2]], true), true, [0, 0.25, 0.5, 0.75]), ...treePieces({ trunk: 0, branch: 4, leafColor: 1, y1: 8.4, y0: 2.8, pairs: [{ y: 6.2, d: 2.5, leaf: true }, { y: 4.4, d: 1.7, leaf: true }], topLeaf: true }), D('sun ring', 2, circle(2, 2, 0.7), true)],
];

// Thread length per patch (flat index): the smallest length that allows the patch's target thread count, plus the chapter's looseness.
const CAPS = [20.1, 24.8, 28.4, 36.6, 32.4, 36.8, 60.7, 45.5, 41.4, 51.5, 34.7, 43.2, 59, 72.2, 55.3, 46.6, 56.5, 49.5, 18.7, 30.9, 21.8, 28.1, 28.6, 26.2, 22.6, 27.3, 33.7, 25.1, 21.7, 33.7];
export const targetThreads = (P) => Math.max(P.colors.length, 2, Math.ceil(P.total / 42));
const patchCache = new Map();
export function buildFromDefs(key, name, defs, extra = {}) {
  const defs2 = defs.slice(0, MAX_RUNS);
  const runs = defs2.map((d, i) => makeRun(i, d));
  const opts = [];
  for (const r of runs) for (const o of r.opts) { o.g = opts.length; o.color = r.color; opts.push(o); }
  return { key, name, runs, opts, size: SIZE, colors: [...new Set(runs.map((r) => r.color))].sort(), ...extra };
}
export function chapterOf(ci) { return CHAPTERS[ci]; }
export function patch(ci, i) {
  const key = `${ci}:${i}`;
  let P = patchCache.get(key);
  if (!P) {
    const flat = ci * 6 + i;
    P = buildFromDefs(key, `${CHAPTERS[ci].name} ${i + 1}`, SPECS[flat](), { ci, i });
    finishPatch(P);
    P.C = CAPS[flat] ?? roundTenth(minCapacity(P, targetThreads(P)) * (1 + CHAPTERS[ci].loose));
    patchCache.set(key, P);
  }
  return P;
}

// ---- daily patch --------------------------------------------------------------------------------------------------------------------------
export function dailyPatch(day) {
  const key = `day:${day}`;
  let P = patchCache.get(key);
  if (P) return P;
  const rg = seeded(day * 2654435 + 17), fam = ((day % 5) + 5) % 5, colors = () => { const n = 1 + rg.int(3); return Array.from({ length: n }, () => rg.int(5)); };
  let defs;
  if (fam === 0) {
    const n = 4 + rg.int(3), split = {};
    for (let i = 0; i < n; i++) if (rg.chance(0.4) && n + Object.keys(split).length < 10) { const c = rg.range(3.2, 6.4); split[i] = [[c, c + rg.range(0.8, 1.6)]]; }
    defs = B.rows({ n, colors: colors(), amp: rg.pick([0, 0.25, 0.35]), period: rg.range(3, 5), phase: rg.range(0.4, 1.4), split, sides: rg.chance(0.3) && n + Object.keys(split).length <= 9 ? rg.int(5) : undefined });
  } else if (fam === 1) {
    const nr = 3 + rg.int(2), rs = Array.from({ length: nr }, (_, i) => 1 + ((3.4 * i) / (nr - 1)) + rg.range(-0.1, 0.1));
    const ns = rg.pick([0, 4, 6, 8]), room = MAX_RUNS - nr;
    defs = B.rings({ rs, ringColors: colors(), spokes: ns ? { n: Math.min(ns, room), a0: rg.pick([0, 22.5, 45]), r0: rs[0] * 0.6, r1: rs[nr - 1] + 0.3, colors: colors() } : undefined });
  } else if (fam === 2) {
    const n = rg.pick([5, 6, 7, 8]), withSmall = n <= 5;
    const sets = [{ tag: 'petal', n, a0: -90, len: rg.range(3.2, 4), wid: rg.range(1.4, 2), color: rg.int(5), base: 0.4 }];
    if (withSmall) sets.push({ tag: 'leaf', n, a0: -90 + 180 / n, len: 2.2, wid: 1.1, color: rg.int(5), base: 0.4 });
    defs = B.lotus({ sets, ring: { r: 0.6, color: rg.int(5) }, outer: !withSmall && rg.chance(0.6) ? { r: 4.6, color: rg.int(5) } : undefined });
  } else if (fam === 3) {
    const nf = 2 + rg.int(2), ys = rowYs(nf, 2, 5.6);
    defs = [];
    ys.forEach((y, i) => defs.push(...fish(['upper', 'middle', 'lower'][i], 4.6 + rg.range(-0.6, 0.8), y, rg.range(1.1, 1.5), i % 2 ? -1 : 1, rg.int(5), rg.int(5))));
    for (let k = 0; k < 3; k++) defs.push(D(`wave ${k + 1}`, rg.int(5), waveRow(0.9, 9.1, 7.2 + k * 1.0, 0.28, 3, k * 1.4)));
  } else {
    const np = 2 + rg.int(2), ys = [6.6, 4.8, 3.3].slice(0, np), ds = [2.5, 1.9, 1.4];
    defs = [...treePieces({ trunk: rg.int(5), branch: rg.int(5), leafColor: rg.int(5), y1: 8.4, y0: 2.4, pairs: ys.map((y, i) => ({ y, d: ds[i], leaf: np < 3 || i < 2 })) }), D('ground', rg.int(5), waveRow(1, 9, 9.3, 0.2, 2.5, 0))];
    if (rg.chance(0.5)) defs.push(D('sun ring', rg.int(5), circle(rg.pick([2, 8]), 1.7, 0.7), true));
  }
  P = buildFromDefs(key, 'Daily Patch', defs.slice(0, 10), { ci: fam, i: 0, daily: true });
  finishPatch(P);
  P.C = roundTenth(minCapacity(P, targetThreads(P)) * (1 + CHAPTERS[fam].loose + 0.03));
  if (patchCache.size > 60) patchCache.delete(patchCache.keys().next().value);
  patchCache.set(key, P);
  return P;
}

// ---- thread length and the exact solver -------------------------------------------------------------------------------------------------
// One thread is C units long. Sewing a run uses its length; the hop under the cloth from where the needle stopped to where
// the next run starts uses thread too. When the next run does not fit (or is another colour), a new thread is started there
// (free start anywhere) and what was left of the old one is wasted. Fewer threads is better.
const EPS = 1e-6;
const INF = 32000;

function distMatrix(P) {
  if (P._D) return P._D;
  const G = P.opts.length, D = new Float32Array(G * G);
  for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) D[a * G + b] = dist(P.opts[a].to, P.opts[b].from);
  P._D = D;
  return D;
}

// A step from state (last option, remaining thread) to option g: what it costs and whether it needs a new thread.
export function stepOutcome(P, last, rem, g) {
  const o = P.opts[g], L = P.runs[o.run].len, C = P.C;
  if (last < 0) return { nw: true, reason: 'first', hop: 0, len: L, rem: C - L, need: L, wasted: 0 };
  const lo = P.opts[last], hop = dist(lo.to, o.from);
  if (lo.color !== o.color) return { nw: true, reason: 'colour', hop: 0, len: L, rem: C - L, need: hop + L, wasted: rem };
  if (rem >= hop + L - EPS) return { nw: false, reason: 'fits', hop, len: L, rem: rem - hop - L, need: hop + L, wasted: 0 };
  return { nw: true, reason: 'length', hop: 0, len: L, rem: C - L, need: hop + L, wasted: rem, hopWas: hop };
}

// The session state after a list of steps ({ g }).
export function walk(P, steps) {
  let t = 0, rem = 0, last = -1, mask = 0, hops = 0, wasted = 0;
  const log = [];
  for (const st of steps) {
    const out = stepOutcome(P, last, rem, st.g);
    if (out.nw) { t += 1; wasted += out.wasted; } else hops += out.hop;
    rem = out.rem; last = st.g; mask |= 1 << P.opts[st.g].run;
    log.push({ ...out, t });
  }
  const full = (1 << P.runs.length) - 1;
  return { t, rem: Math.max(0, rem), last, mask, hops, wasted: wasted, log, count: steps.length, done: mask === full, pos: last >= 0 ? P.opts[last].to : null, color: last >= 0 ? P.opts[last].color : null };
}

// Best way to finish from a state (or from scratch when st is null): fewest threads, then the most thread left.
export function completion(P, C, st) {
  const m = P.runs.length, G = P.opts.length, size = 1 << m, full = size - 1;
  const L = P.runs.map((r) => r.len), D = distMatrix(P);
  if (st && st.done) return { t: st.t, rem: st.rem, path: [] };
  const T = new Int16Array(size * G).fill(INF), R = new Float32Array(size * G), PAR = new Int32Array(size * G).fill(-1);
  let startMask = 1, init = -1;
  if (!st || st.last < 0) for (const o of P.opts) { const i = (1 << o.run) * G + o.g; T[i] = 1; R[i] = C - L[o.run]; }
  else { init = st.mask * G + st.last; T[init] = Math.max(1, st.t); R[init] = st.rem; startMask = st.mask; }
  const byRun = P.runs.map((r) => r.opts);
  for (let mask = startMask; mask < full; mask++) {
    for (let g = 0; g < G; g++) {
      const i = mask * G + g, t = T[i];
      if (t === INF) continue;
      const rem = R[i], col = P.opts[g].color;
      for (let r = 0; r < m; r++) {
        if (mask & (1 << r)) continue;
        const nm = (mask | (1 << r)) * G;
        for (const o of byRun[r]) {
          const hop = D[g * G + o.g];
          let nt = t, nr;
          if (o.color === col && rem >= hop + L[r] - EPS) nr = rem - hop - L[r]; else { nt = t + 1; nr = C - L[r]; }
          const j = nm + o.g;
          if (nt < T[j] || (nt === T[j] && nr > R[j] + 1e-7)) { T[j] = nt; R[j] = nr; PAR[j] = i; }
        }
      }
    }
  }
  let bt = INF, br = -1, bj = -1;
  for (let g = 0; g < G; g++) { const j = full * G + g; if (T[j] < bt || (T[j] === bt && R[j] > br)) { bt = T[j]; br = R[j]; bj = j; } }
  const path = [];
  for (let j = bj; j >= 0 && j !== init; j = PAR[j]) { path.push(j % G); if (PAR[j] < 0) break; }
  path.reverse();
  return { t: bt, rem: br, path };
}
function finishPatch(P) {
  P.total = P.runs.reduce((a, r) => a + r.len, 0);
  P.Lmax = Math.max(...P.runs.map((r) => r.len));
  Object.defineProperty(P, 'sol', { get() { return P._sol ?? (P._sol = completion(P, P.C, null)); }, enumerable: false });
  Object.defineProperty(P, 'opt', { get() { return P.sol.t; }, enumerable: false });
}
// Smallest thread length (to 0.05) at which the patch can be sewn with at most `T` threads.
export function minCapacity(P, T) {
  let lo = P.Lmax, hi = P.total + 30;
  if (completion(P, lo, null).t <= T) return lo;
  while (hi - lo > 0.05) { const mid = (lo + hi) / 2; if (completion(P, mid, null).t <= T) hi = mid; else lo = mid; }
  return hi;
}
export const roundTenth = (v) => Math.ceil(v * 10 - 1e-9) / 10;
export function previewStep(P, st, g) { return stepOutcome(P, st.last, st.rem, g); }
export const starsFor = (P, t) => (t <= P.opt ? 3 : t <= P.opt + 1 ? 2 : 1);

// Every legal next option with the thread count of its best finish.
const the = (name) => (/\d$/.test(name) || /^(left|right|top|bottom|upper|lower|middle|big|small)/.test(name) && false ? name : `the ${name}`);
const endWord = (o) => (o.end === 'ring' ? 'point' : o.end === 'first' ? 'start' : 'end');
const SIDE = (p) => {
  const h = p[0] < 3.6 ? 'left' : p[0] > 6.4 ? 'right' : '', v = p[1] < 3.6 ? 'top' : p[1] > 6.4 ? 'bottom' : '';
  return `${v} ${h}`.trim() || 'middle';
};
const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1);
const stateAfter = (P, st, g) => { const o = stepOutcome(P, st.last, st.rem, g); return { t: st.t + (o.nw ? 1 : 0), rem: o.rem, last: g, mask: st.mask | (1 << P.opts[g].run), done: false, _o: o }; };

export function findHint(P, steps) {
  const st = walk(P, steps);
  if (st.done) return null;
  const best = completion(P, P.C, st.last < 0 ? null : st);
  const g = best.path[0];
  const o = P.opts[g], run = P.runs[o.run], out = stepOutcome(P, st.last, st.rem, g), place = `${SIDE(o.from)} ${endWord(o)}`;
  let look, why;
  if (st.last < 0) {
    look = `Look at ${the(run.name)}, near the ${place}. A good first thread begins there.`;
    why = `This patch can be sewn with ${P.opt} thread${P.opt === 1 ? '' : 's'} if every one is used well. Beginning at this ${endWord(o)} keeps the other rows within a short hop.`;
  } else if (out.reason === 'colour') {
    look = `The needle has finished what it can with this colour. Look at ${the(run.name)}, near the ${place}.`;
    why = `That row is another colour, so it needs a new thread. Starting it at the ${place} keeps the rows after it close together.`;
  } else if (out.reason === 'length') {
    look = `Look at ${the(run.name)}, near the ${place}.`;
    why = `The thread has ${fmt(st.rem)} left but this row needs ${fmt(out.need)} including the hop, so a new thread starts here. The rest of the old one (${fmt(st.rem)}) is wasted, which is part of the best plan.`;
  } else {
    look = `Look at ${the(run.name)}, near the ${place}. It is within reach of the needle.`;
    why = `A hop of ${fmt(out.hop)} reaches it and the thread keeps ${fmt(out.rem)} for the rest.`;
  }
  // The closest end that fits, if it is a different choice: does it cost an extra thread by the end?
  let near = null;
  if (st.last >= 0) {
    const D = distMatrix(P);
    for (const c of P.opts) { if (st.mask & (1 << c.run)) continue; const d = D[st.last * P.opts.length + c.g]; if (!near || d < near.d - 1e-9) near = { g: c.g, d }; }
  }
  let note = '';
  if (near && near.g !== g && out.reason === 'fits') {
    const alt = completion(P, P.C, stateAfter(P, st, near.g));
    if (alt.t > best.t) note = ` The closest end looks easier right now, but it would need ${alt.t - best.t} more thread${alt.t - best.t === 1 ? '' : 's'} in the end.`;
  }
  return { g, run: o.run, name: run.name, look, why: why + note, hop: out.hop, nw: out.nw, reason: out.reason, finish: best.t };
}

// The fewest threads this state can still finish with (compared with the patch best, for the optional path check).
export function bestFinish(P, steps) {
  const st = walk(P, steps);
  if (!st.count) return P.opt;
  return completion(P, P.C, st).t;
}

// A complete best sequence (tests, Watch and Learn reel).
export function solveSteps(P) { return P.sol.path.map((g) => ({ g })); }

// ---- Steady Hand ------------------------------------------------------------------------------------------------------------------------------
// Windows are in seconds either side of a mark; they include a little allowance for touch and screen latency.
export const RHYTHM = [
  { id: 'calm', name: 'Calm', rows: 4, speed: 1.0, pitch: [0.8], win: [0.12, 0.22, 0.34], blurb: 'Even stitches, four rows' },
  { id: 'steady', name: 'Steady', rows: 5, speed: 1.3, pitch: [0.7, 1.1], win: [0.11, 0.2, 0.3], blurb: 'Long and short, five rows' },
  { id: 'swift', name: 'Swift', rows: 6, speed: 1.6, pitch: null, win: [0.1, 0.18, 0.27], blurb: 'Free rhythm, six rows' },
];
export const POINTS = [100, 70, 35];
export const STITCH = 0.44;   // length of one stitch in cloth units
// A round: rows of marks along wavy rows. The needle runs along each row at `speed`; the player taps as it reaches each mark
// and a stitch is laid where the needle is at that moment.
export function makeRhythm(tierIdx, seed) {
  const T = RHYTHM[tierIdx], rg = seeded(seed * 31 + tierIdx), ys = rowYs(T.rows, 1.6, 8.4), rows = [];
  let t = 2;
  ys.forEach((y, r) => {
    const amp = r % 2 ? 0.3 : 0.18, ph = rg.range(0, 6), dirR = r % 2 === 1;
    const raw = waveRow(0.8, 9.2, y, amp, 3.2 + (r % 3) * 0.4, ph), pts = dirR ? raw.slice().reverse() : raw;
    const run = makeRun(r, { name: `row ${r + 1}`, color: r % 3, pts, closed: false });
    const holes = [];
    let s = 0.75, k = 0;
    while (s < run.len - 0.5) {
      holes.push(s);
      s += T.pitch ? T.pitch[k % T.pitch.length] : rg.pick([0.6, 0.9, 1.2]);
      k += 1;
    }
    const start = t, dur = run.len / T.speed;
    rows.push({ run, y, dir: dirR ? -1 : 1, holes: holes.map((hs) => ({ s: hs, t: start + hs / T.speed })), start, dur });
    t = start + dur + 1.6;
  });
  return { tier: tierIdx, T, rows, end: t - 0.8 };
}
export function judge(T, err) {
  const a = Math.abs(err);
  return a <= T.win[0] ? 0 : a <= T.win[1] ? 1 : a <= T.win[2] ? 2 : 3;
}
export const roundStars = (acc) => (acc >= 0.88 ? 3 : acc >= 0.7 ? 2 : acc >= 0.45 ? 1 : 0);
