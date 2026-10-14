// The three ice chutes. Each is generated ONCE from a fixed seed into samples every SEG metres: curvature k (1/m, + = right bend), slope g,
// bank (rad, + = right bend: the outside, left wall, is higher), heading and position. Everything is pure and deterministic.
import { clamp } from './util.js';

export const SEG = 2;          // metres between samples
export const HW = 3.0;         // half width of the ice floor, metres

const lcg = (seed) => { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };

export const TRACK_LIST = [
  { id: 'village', name: 'Village Natural Run', blurb: 'Wide, friendly bends on a snow-banked village chute. 18 bends.',
    seed: 7, curves: 18, rad: [34, 62], arc: [22, 42], gap: [10, 26], slope: 0.102, hairpin: false, par: 0,
    pal: { sky0: '#7fb0d8', sky1: '#d9ecf7', floor: [214, 236, 246], wall: [236, 242, 247], wallDark: [150, 176, 204], rim: '#2f6fb5', fog: [196, 218, 234], snow: [244, 248, 251], tree: [44, 82, 78], mount: [126, 152, 180] } },
  { id: 'alpine', name: 'Alpine Ice Chute', blurb: 'A banked artificial run with a hairpin and a tight S-bend labyrinth. 20 bends.',
    seed: 23, curves: 20, rad: [30, 56], arc: [24, 46], gap: [8, 20], slope: 0.118, hairpin: true, par: 1,
    pal: { sky0: '#4f86c4', sky1: '#bcd9ee', floor: [196, 224, 240], wall: [188, 210, 232], wallDark: [86, 120, 164], rim: '#d63f2c', fog: [168, 198, 224], snow: [232, 241, 248], tree: [30, 66, 66], mount: [92, 122, 160] } },
  { id: 'glacier', name: 'Glacier Giant', blurb: 'Long fast sweepers and sharp turns on a blue glacier run. 24 bends.',
    seed: 41, curves: 24, rad: [28, 60], arc: [24, 52], gap: [6, 18], slope: 0.132, hairpin: true, par: 2,
    pal: { sky0: '#2f5f9e', sky1: '#a8cbe6', floor: [182, 218, 240], wall: [150, 190, 226], wallDark: [60, 98, 152], rim: '#f2b42e', fog: [150, 188, 220], snow: [222, 236, 247], tree: [24, 52, 60], mount: [70, 104, 148] } },
];
export const trackInfo = (id) => TRACK_LIST.find((t) => t.id === id) || TRACK_LIST[0];

const cache = new Map();
export function buildTrack(id) {
  if (cache.has(id)) return cache.get(id);
  const spec = trackInfo(id), r = lcg(spec.seed);
  const pieces = [{ len: 46, k: 0 }];
  let head = 0, dirLast = 1;
  const hair = spec.hairpin ? Math.floor(spec.curves * 0.55) : -1;
  for (let c = 0; c < spec.curves; c++) {
    pieces.push({ len: spec.gap[0] + r() * (spec.gap[1] - spec.gap[0]), k: 0 });
    let dir = r() < 0.74 ? -dirLast : dirLast;
    if (head > 1.3) dir = -1; else if (head < -1.3) dir = 1;
    let rad = spec.rad[0] + r() * (spec.rad[1] - spec.rad[0]), arc = spec.arc[0] + r() * (spec.arc[1] - spec.arc[0]);
    if (c === hair) { rad = 27; arc = 44; }
    if (spec.par === 2 && c % 6 === 4) { rad = 44 + r() * 30; arc = 50 + r() * 16; }
    head += dir * arc / rad; dirLast = dir;
    pieces.push({ len: arc, k: dir / rad });
  }
  pieces.push({ len: 70, k: 0 });
  // raw samples
  let raw = [];
  for (const p of pieces) { const n = Math.max(1, Math.round(p.len / SEG)); for (let i = 0; i < n; i++) raw.push(p.k); }
  // ease every change of curvature (a real run's bends are spirals, not arcs): two box-filter passes
  const box = (a, w) => a.map((_, i) => { let s = 0, c = 0; for (let j = -w; j <= w; j++) { const x = a[i + j]; if (x !== undefined) { s += x; c++; } else { s += 0; c++; } } return s / c; });
  let k = box(box(raw, 3), 3);
  const N = k.length, L = N * SEG;
  const g = new Array(N), bank = new Array(N), psi = new Array(N + 1), px = new Array(N + 1), py = new Array(N + 1), H = new Array(N + 1);
  psi[0] = 0; px[0] = 0; py[0] = 0; H[0] = 0;
  for (let i = 0; i < N; i++) {
    const s = i * SEG;
    g[i] = spec.slope * (0.9 + 0.2 * Math.min(1, s / 300)) + 0.014 * Math.sin(s / 61 + spec.seed) + (s < 60 ? 0.03 : 0);
    bank[i] = clamp(k[i] * 46, -1.0, 1.0);
    psi[i + 1] = psi[i] + k[i] * SEG;
    px[i + 1] = px[i] + Math.sin(psi[i]) * SEG; py[i + 1] = py[i] + Math.cos(psi[i]) * SEG;
    H[i + 1] = H[i] - g[i] * SEG;
  }
  // bends: contiguous runs where |k| is above a small threshold
  const curves = [];
  let cur = null;
  for (let i = 0; i < N; i++) {
    const on = Math.abs(k[i]) > 0.0075;
    if (on && !cur) cur = { i0: i, kmax: 0, ia: i };
    if (cur && on) { if (Math.abs(k[i]) > Math.abs(k[cur.ia])) cur.ia = i; }
    if (cur && (!on || i === N - 1)) {
      cur.i1 = i; cur.s0 = cur.i0 * SEG; cur.s1 = cur.i1 * SEG; cur.sA = cur.ia * SEG; cur.k = k[cur.ia]; cur.dir = Math.sign(cur.k); cur.rad = 1 / Math.abs(cur.k);
      cur.deg = Math.round(Math.abs(psi[cur.i1] - psi[cur.i0]) * 180 / Math.PI);
      if (cur.s1 - cur.s0 >= 10) curves.push(cur);
      cur = null;
    }
  }
  curves.forEach((c, i) => { c.n = i + 1; });
  // the racing line: smoothed curvature, saturating at the inner limit (what Think and Watch & Learn draw and what the pilot follows)
  const INNER = HW - 0.95;
  const kk = box(box(box(k, 5), 5), 3);
  const nref = kk.map((v) => clamp((v / 0.026) * 1.25, -1, 1) * INNER);
  const T = { id, spec, N, L: L - 64, S0: 8, k, g, bank, psi, px, py, H, curves, nref, INNER, pal: spec.pal, name: spec.name };
  cache.set(id, T);
  return T;
}

// linear interpolation of a per-sample array at metre s
export function at(arr, s) {
  const f = clamp(s / SEG, 0, arr.length - 1.001), i = Math.floor(f), t = f - i;
  return arr[i] + (arr[i + 1] - arr[i]) * t;
}
export const nrefAt = (T, s) => at(T.nref, s);

// the first bend whose end is still ahead of s (null after the last)
export function nextCurve(T, s) {
  for (const c of T.curves) if (c.s1 > s) return c;
  return null;
}

// Ice ruts: a few seeded places where a patch of rough ice kicks the sled sideways. Fixed per track; the Daily Run reseeds them.
export function makeRuts(T, seed) {
  const r = lcg((seed * 2654435761) >>> 0 || 99);
  const out = [];
  const n = 7;
  for (let i = 0; i < n; i++) out.push({ s: 70 + (T.L - 150) * ((i + r() * 0.8) / n), imp: (r() < 0.5 ? -1 : 1) * (0.9 + r() * 0.9), n: (r() * 2 - 1) * 1.6 });
  return out;
}
