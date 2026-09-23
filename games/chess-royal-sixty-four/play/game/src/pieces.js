// The pieces: turned, carved, lit objects — not flat glyphs and not gradient-filled silhouettes.
//
// Every piece body is a lathe profile (half-width r as a function of height h, the way a real Staunton
// piece is turned) and is rendered PER PIXEL as a surface of revolution: each pixel gets the true
// surface normal of the turned form and is lit with a key light (upper-left, in front), wrapped
// diffuse, a Blinn specular ridge, Fresnel edge darkening, profile-derived ambient occlusion under
// every collar, and (for the dark set) a warm rim light. Non-turned parts — the knight's horse head,
// the king's cross, the queen's coronet — are carved from a silhouette mask with a distance-field
// "pillow" (rounded bevel) and lit with the same model, so the whole piece reads as one material.
//
// Everything is painted ONCE per (type, colour, theme, size) into a cached sprite at RES x, then
// blitted with drawImage. No gradients or pixel work happen per frame. Deterministic: no randomness.
import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from './rules.js';

export const BOARD_THEMES = ['walnut', 'marble', 'rosewood'];

// ---- materials -------------------------------------------------------------------------------------
// base: albedo 0..1. amb/key: ambient and key-light strength. wrap: diffuse wrap (soft materials).
// spec/shin: Blinn highlight strength and exponent. gloss: a second, tighter highlight (polished
// ebony). rim/rimCol: warm rim light from the right/back. edge/edgeCol: how much and toward what
// colour the silhouette edge is pulled (a contour that never merges with a same-value square).
const MATERIAL = {
  walnut: {
    light: { name: 'Ivory', base: [0.965, 0.905, 0.760], amb: 0.36, key: 0.70, wrap: 0.22, bounce: 0.16, bounceCol: [0.95, 0.72, 0.45], spec: 0.30, shin: 18, gloss: 0.10, glossShin: 90, rim: 0.0, rimCol: [1, 1, 1], edge: 0.62, edgeCol: [0.52, 0.38, 0.22], groove: [0.42, 0.29, 0.15], mark: [0.30, 0.20, 0.10] },
    dark: { name: 'Ebony', base: [0.165, 0.105, 0.072], amb: 0.50, key: 0.74, wrap: 0.10, bounce: 0.12, bounceCol: [1.0, 0.70, 0.45], spec: 0.55, shin: 40, gloss: 0.55, glossShin: 160, rim: 0.60, rimCol: [1.0, 0.72, 0.45], edge: 0.55, edgeCol: [0.55, 0.40, 0.28], groove: [0.02, 0.01, 0.01], mark: [0.62, 0.50, 0.38] },
  },
  marble: {
    light: { name: 'Alabaster', base: [0.955, 0.950, 0.935], amb: 0.36, key: 0.68, wrap: 0.24, bounce: 0.14, bounceCol: [0.80, 0.82, 0.90], spec: 0.34, shin: 22, gloss: 0.12, glossShin: 100, rim: 0.0, rimCol: [1, 1, 1], edge: 0.62, edgeCol: [0.42, 0.42, 0.44], groove: [0.36, 0.36, 0.38], mark: [0.24, 0.24, 0.26] },
    dark: { name: 'Basalt', base: [0.155, 0.165, 0.185], amb: 0.50, key: 0.76, wrap: 0.10, bounce: 0.12, bounceCol: [0.80, 0.86, 1.0], spec: 0.55, shin: 40, gloss: 0.50, glossShin: 150, rim: 0.55, rimCol: [0.80, 0.86, 1.0], edge: 0.55, edgeCol: [0.50, 0.54, 0.60], groove: [0.02, 0.02, 0.03], mark: [0.62, 0.66, 0.72] },
  },
  rosewood: {
    light: { name: 'Bone', base: [0.940, 0.870, 0.700], amb: 0.36, key: 0.70, wrap: 0.22, bounce: 0.16, bounceCol: [0.95, 0.72, 0.45], spec: 0.30, shin: 18, gloss: 0.10, glossShin: 90, rim: 0.0, rimCol: [1, 1, 1], edge: 0.62, edgeCol: [0.50, 0.34, 0.18], groove: [0.40, 0.26, 0.12], mark: [0.28, 0.17, 0.08] },
    dark: { name: 'Obsidian', base: [0.130, 0.065, 0.085], amb: 0.50, key: 0.74, wrap: 0.10, bounce: 0.12, bounceCol: [1.0, 0.70, 0.45], spec: 0.60, shin: 40, gloss: 0.60, glossShin: 160, rim: 0.65, rimCol: [1.0, 0.62, 0.42], edge: 0.55, edgeCol: [0.55, 0.36, 0.32], groove: [0.02, 0.01, 0.01], mark: [0.66, 0.48, 0.42] },
  },
};
export const materialOf = (theme, white) => (MATERIAL[theme] ?? MATERIAL.walnut)[white ? 'light' : 'dark'];
export const materialName = (theme, white) => materialOf(theme, white).name;

const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---- lathe profiles --------------------------------------------------------------------------------
// Units: the king is 200 tall (cross tip) — everything else is proportioned to it, like a real set.
// A profile is [h, r] pairs bottom-to-top; the outline is smoothed through the midpoints (quadratic),
// so a repeated point makes a crisp turned edge and a single point a soft curve.
function foot(k) {
  // broad stepped base: rounded bottom edge, a flat step, then a rounded collar into the stem
  return [[0, 45 * k], [0, 45 * k], [1.5, 48.5 * k], [5, 50 * k], [9, 49.5 * k], [12, 47 * k], [14, 43 * k], [14, 43 * k], [16, 41 * k], [16, 41 * k], [19, 36 * k], [22, 34.5 * k], [26, 34.5 * k], [30, 31 * k]];
}
function ballPts(hc, R, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = -1 + (2 * i) / n; pts.push([hc + t * R, Math.sqrt(Math.max(0, 1 - t * t)) * R]); }
  return pts;
}
const PROFILES = {
  [PAWN]: [...foot(0.82), [34, 24], [42, 19], [56, 16.5], [70, 16.5], [77, 18], [82, 22], [85, 25], [85, 25], [88, 25], [88, 25], [90, 21], [92, 18.5], ...ballPts(105, 14).slice(1)],
  [ROOK]: [...foot(1.0), [34, 31], [46, 27.5], [70, 26], [96, 26], [108, 27], [114, 30], [119, 34], [122, 36.5], [122, 36.5], [128, 36.5], [130, 34.5], [130, 34.5], [133, 34.5], [133, 34.5], [152, 34.5], [152, 34.5], [152, 0]],
  [KNIGHT]: [...foot(0.98), [34, 30], [44, 26], [56, 24.5], [62, 24.5], [62, 24.5], [64, 27], [66, 27.5], [66, 27.5], [70, 27], [72, 26], [74, 0]],
  [BISHOP]: [...foot(0.94), [34, 27], [44, 21], [62, 18], [86, 17], [100, 19], [110, 23], [116, 27], [119, 29], [119, 29], [123, 29], [123, 29], [125, 25], [127, 23], [131, 25], [138, 27], [147, 25], [156, 19], [163, 11], [168, 4], [168, 0]],
  [QUEEN]: [...foot(0.96), [34, 29], [45, 23], [66, 20], [92, 19], [114, 22], [128, 27], [136, 31], [139, 33], [139, 33], [143, 33], [143, 33], [145, 29], [148, 28], [154, 30], [162, 34], [170, 38], [174, 39.5], [174, 39.5], [176, 39.5], [176, 0]],
  [KING]: [...foot(1.0), [34, 30], [46, 24], [70, 21], [96, 20], [118, 23], [132, 28], [140, 32], [143, 34], [143, 34], [147, 34], [147, 34], [149, 30], [152, 29], [158, 31], [166, 34], [172, 36.5], [174, 37], [174, 37], [176, 37], [177, 31], [178, 20], [178, 14], ...ballPts(183, 6.5, 8).slice(1)],
};
// Top of each piece in units (used to size the sprite box and by callers that lay pieces out).
export const PIECE_TOP = { [PAWN]: 120, [KNIGHT]: 178, [BISHOP]: 176, [ROOK]: 152, [QUEEN]: 194, [KING]: 200 };
const MAX_R = { [PAWN]: 48, [KNIGHT]: 60, [BISHOP]: 55, [ROOK]: 58, [QUEEN]: 56, [KING]: 58 };

// Sample the smoothed profile into r(h) at STEP units, plus dr/dh. Returns {r: Float32Array, hMax}.
function sampleProfile(pts) {
  // quadratic smoothing through midpoints (same construction as a canvas quadraticCurveTo chain)
  const dense = [];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  dense.push(pts[0]);
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = i === 1 ? pts[0] : mid(pts[i - 1], pts[i]), p1 = pts[i], p2 = i === pts.length - 2 ? pts[i + 1] : mid(pts[i], pts[i + 1]);
    for (let k = 1; k <= 8; k++) { const t = k / 8, mt = 1 - t; dense.push([mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0], mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]]); }
  }
  dense.push(pts[pts.length - 1]);
  const hMax = pts[pts.length - 1][0], N = Math.ceil(hMax * 4) + 1, r = new Float32Array(N);
  const WIDE = 1.16; // widen every turned profile (the sets are compressed into the square in height)
  // dense[] is monotone in h; resample by walking it
  let j = 0;
  for (let i = 0; i < N; i++) {
    const h = i / 4;
    while (j < dense.length - 2 && dense[j + 1][0] < h) j++;
    const a = dense[j], b = dense[j + 1], span = b[0] - a[0];
    r[i] = WIDE * (span <= 1e-6 ? Math.min(a[1], b[1]) : a[1] + (b[1] - a[1]) * clamp01((h - a[0]) / span));
  }
  // a lightly smoothed copy for the slope, so the shading has no stair-steps between samples
  const rs = new Float32Array(N);
  for (let i = 0; i < N; i++) { let acc = 0, wsum = 0; for (let k = -3; k <= 3; k++) { const j = Math.min(N - 1, Math.max(0, i + k)), wk = 4 - Math.abs(k); acc += r[j] * wk; wsum += wk; } rs[i] = acc / wsum; }
  return { r, rs, hMax, N };
}
const profileCache = new Map();
function profileOf(type) { let p = profileCache.get(type); if (!p) { p = sampleProfile(PROFILES[type]); profileCache.set(type, p); } return p; }
const rAt = (P, h) => { if (h <= 0) return P.r[0]; const i = h * 4; if (i >= P.N - 1) return 0; const k = Math.floor(i), t = i - k; return P.r[k] + (P.r[k + 1] - P.r[k]) * t; };
const rsAt = (P, h) => { if (h <= 0) return P.rs[0]; const i = h * 4; if (i >= P.N - 1) return 0; const k = Math.floor(i), t = i - k; return P.rs[k] + (P.rs[k + 1] - P.rs[k]) * t; };

// ---- lighting ---------------------------------------------------------------------------------------
const LX = -0.46, LY = -0.60, LZ = 0.655;            // key light: upper-left, in front (y down)
const HL = Math.hypot(LX, LY, LZ + 1), HX = LX / HL, HY = LY / HL, HZ = (LZ + 1) / HL; // half vector with the viewer
const RX = 0.78, RY = -0.30, RZ = 0.30;               // rim light: right, slightly above, from behind-ish
const BX = 0.55, BY = 0.62, BZ = 0.56;                // bounce light reflected off the board, from the lower right
// Shade one surface point. n = unit normal (y down, z toward viewer). ao 0..1. Writes into out[0..2].
function shade(nx, ny, nz, m, ao, out) {
  const ndl = nx * LX + ny * LY + nz * LZ;
  const d = clamp01((ndl + m.wrap) / (1 + m.wrap));
  const ndh = Math.max(0, nx * HX + ny * HY + nz * HZ);
  const spec = m.spec * Math.pow(ndh, m.shin) + m.gloss * Math.pow(ndh, m.glossShin);
  const fres = Math.pow(1 - Math.max(0, nz), 2.4);
  const rim = m.rim * fres * Math.max(0, nx * RX + ny * RY + nz * RZ);
  const bounce = m.bounce * Math.max(0, nx * BX + ny * BY + nz * BZ);
  const lit = (m.amb + m.key * d + bounce) * ao;
  const e = m.edge * fres;
  for (let c = 0; c < 3; c++) {
    let v = m.base[c] * lit;
    v = v * (1 - e) + m.edgeCol[c] * lit * e;   // pull the grazing edge toward the contour colour
    v += spec * (0.92 + 0.08 * m.base[c]) * ao + rim * m.rimCol[c] + bounce * m.bounceCol[c] * 0.5;
    out[c] = v;
  }
}

// ---- rasterisers ------------------------------------------------------------------------------------
function newCanvas(w, h) { return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null; }

// Surface of revolution: fills `img` (Uint8ClampedArray RGBA, w*h) with the lit body. s = px per unit.
// cx, baseY in px. mask(h, u) may return: 0 = normal surface, 1 = cut away entirely (rook notch: show
// the dark inner wall instead), so the rook's battlements are carved out of the true cylinder.
function rasterBody(img, w, h, P, s, cx, baseY, m, ao, mask) {
  const out = [0, 0, 0];
  for (let py = 0; py < h; py++) {
    const hu = (baseY - (py + 0.5)) / s;             // height in units at this row
    if (hu < 0 || hu >= P.hMax) continue;
    const r = rAt(P, hu);
    if (r <= 0.01) continue;
    const dr = (rsAt(P, Math.min(P.hMax, hu + 0.75)) - rsAt(P, Math.max(0, hu - 0.75))) / 1.5; // dr/dh
    const rpx = r * s, aoRow = ao(hu);
    const x0 = Math.max(0, Math.floor(cx - rpx - 1)), x1 = Math.min(w - 1, Math.ceil(cx + rpx + 1));
    for (let px = x0; px <= x1; px++) {
      const x = px + 0.5 - cx, cov = clamp01(rpx - Math.abs(x) + 0.5);
      if (cov <= 0) continue;
      let u = x / rpx; if (u > 1) u = 1; else if (u < -1) u = -1;
      const wz = Math.sqrt(1 - u * u);
      // normal of the revolution surface: (u, dr/dy, wz) with y down -> dr/dy = -dr/dh
      let nx = u, ny = -dr, nz = wz; const il = 1 / Math.hypot(nx, ny, nz); nx *= il; ny *= il; nz *= il;
      const k = (py * w + px) * 4;
      if (mask && mask(hu, u)) {
        // inner wall of the cup, seen through the notch: dark, a touch lighter toward the top rim
        const t = clamp01((hu - 138) / 14);
        img[k] = 255 * (m.base[0] * (0.16 + 0.12 * t)); img[k + 1] = 255 * (m.base[1] * (0.16 + 0.12 * t)); img[k + 2] = 255 * (m.base[2] * (0.16 + 0.12 * t)); img[k + 3] = 255 * cov;
        continue;
      }
      shade(nx, ny, nz, m, aoRow, out);
      img[k] = 255 * clamp01(out[0]); img[k + 1] = 255 * clamp01(out[1]); img[k + 2] = 255 * clamp01(out[2]); img[k + 3] = 255 * cov;
    }
  }
}

// Profile-derived ambient occlusion: a row is darkened by any wider ring a little above it (the
// underside of every collar, the neck under the base's shoulder), plus the contact zone at the floor.
function makeAO(P) {
  const cache = new Float32Array(P.N);
  for (let i = 0; i < P.N; i++) {
    const h = i / 4, r0 = P.r[i]; let occ = 0;
    for (let dh = 1; dh <= 14; dh += 1) {
      const rr = rAt(P, h + dh); if (rr <= 0) continue;
      const over = (rr - r0) / dh;                   // overhang slope
      if (over > 0) occ = Math.max(occ, Math.min(1, over * 1.4) * (1 - dh / 15));
    }
    const floor = h < 4 ? 0.35 * (1 - h / 4) : 0;
    cache[i] = 1 - 0.55 * occ - floor;
  }
  return (h) => { const i = h * 4; if (i <= 0) return cache[0]; if (i >= P.N - 1) return cache[P.N - 1]; const k = Math.floor(i), t = i - k; return cache[k] + (cache[k + 1] - cache[k]) * t; };
}

// Exact Euclidean distance (px) from every inside pixel to the nearest outside pixel, separable
// lower-envelope transform (Felzenszwalb & Huttenlocher) on the mask's alpha channel.
function edt(a, w, h) {
  const INF = 1e12, f = new Float32Array(Math.max(w, h)), d = new Float32Array(Math.max(w, h));
  const v = new Int32Array(Math.max(w, h)), z = new Float32Array(Math.max(w, h) + 1);
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = a[i * 4 + 3] > 127 ? INF : 0;
  const pass1d = (n, stride, base) => {
    for (let i = 0; i < n; i++) f[i] = g[base + i * stride];
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let sIn = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (sIn <= z[k]) { k--; sIn = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = sIn; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    for (let i = 0; i < n; i++) g[base + i * stride] = d[i];
  };
  for (let x = 0; x < w; x++) pass1d(h, w, x);
  for (let y = 0; y < h; y++) pass1d(w, 1, y * w);
  for (let i = 0; i < w * h; i++) g[i] = Math.sqrt(g[i]);
  return g;
}

// "Pillow" shading of an arbitrary silhouette: the mask's distance field becomes a rounded bevel of
// depth D px, giving a carved, rounded form with a proper normal at every pixel. `paint` draws the
// silhouette (in sprite pixel coords) on a 2d context. tint multiplies the material albedo.
function rasterPillow(img, w, h, m, D, paint, tint = 1, aoFn = null, blur = 0.25, gain = 1) {
  const c = newCanvas(w, h); if (!c) return;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; paint(g); g.fill();
  const a = g.getImageData(0, 0, w, h).data;
  const dist = edt(a, w, h);
  const zf = (d) => { const t = Math.min(1, d / D); return Math.sqrt(1 - (1 - t) * (1 - t)); };
  // height field, then a separable blur (3 box passes ~ Gaussian) so the form is a soft carved volume
  // with no medial-axis creases; the blur is confined to the silhouette (outside stays at height 0)
  let hf = new Float32Array(w * h); for (let i = 0; i < w * h; i++) hf[i] = dist[i] > 0 ? zf(dist[i]) : 0;
  const rad = Math.max(1, Math.round(D * blur));
  if (rad > 0) {
    let tmp = new Float32Array(w * h);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) { let acc = 0; for (let x = -rad; x <= rad; x++) acc += hf[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { tmp[y * w + x] = acc / (2 * rad + 1); acc += hf[y * w + Math.min(w - 1, x + rad + 1)] - hf[y * w + Math.max(0, x - rad)]; } }
      for (let x = 0; x < w; x++) { let acc = 0; for (let y = -rad; y <= rad; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { hf[y * w + x] = acc / (2 * rad + 1); acc += tmp[Math.min(h - 1, y + rad + 1) * w + x] - tmp[Math.max(0, y - rad) * w + x]; } }
    }
  }
  const z = (i) => hf[i];
  const out = [0, 0, 0], mm = tint === 1 ? m : { ...m, base: m.base.map((v) => v * tint) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, cov = a[i * 4 + 3] / 255; if (cov <= 0) continue;
    const dzx = (z(x < w - 1 ? i + 1 : i) - z(x > 0 ? i - 1 : i)) * 0.5 * D * gain;
    const dzy = (z(y < h - 1 ? i + w : i) - z(y > 0 ? i - w : i)) * 0.5 * D * gain;
    let nx = -dzx, ny = -dzy, nz = 1; const il = 1 / Math.hypot(nx, ny, nz); nx *= il; ny *= il; nz *= il;
    shade(nx, ny, nz, mm, aoFn ? aoFn(x, y) : 1, out);
    const k = i * 4, ca = cov, ia = 1 - ca;           // composite over what is already there
    img[k] = 255 * clamp01(out[0]) * ca + img[k] * ia; img[k + 1] = 255 * clamp01(out[1]) * ca + img[k + 1] * ia; img[k + 2] = 255 * clamp01(out[2]) * ca + img[k + 2] * ia;
    img[k + 3] = 255 * (ca + (img[k + 3] / 255) * ia);
  }
}

// ---- ornament geometry (in units; x right of the axis, h up) ---------------------------------------
// The knight's head faces left. A real horse-head profile: a full throat and jaw, a defined muzzle with
// a slightly open mouth, the nose bridge rising to the forehead, one alert ear, and a crest that
// arches down the back of the neck into the chest.
function knightHeadPath(g, X, Y) {
  g.beginPath();
  g.moveTo(X(-18), Y(60));                                             // chest, front
  g.bezierCurveTo(X(-16), Y(84), X(-26), Y(96), X(-36), Y(106));       // throat: concave, rising to the jaw
  g.bezierCurveTo(X(-44), Y(110), X(-49), Y(116), X(-46), Y(121));     // rounded jaw and chin
  g.bezierCurveTo(X(-42), Y(122), X(-42), Y(125), X(-47), Y(127));     // lower lip / mouth
  g.bezierCurveTo(X(-55), Y(131), X(-56), Y(143), X(-49), Y(149));     // muzzle: the nose
  g.bezierCurveTo(X(-42), Y(154), X(-26), Y(158), X(-14), Y(163));     // nose bridge up to the forehead
  g.bezierCurveTo(X(-12), Y(168), X(-9), Y(176), X(-5), Y(182));       // ear, front edge
  g.bezierCurveTo(X(-1), Y(176), X(1), Y(169), X(2), Y(163));          // ear tip -> back
  g.bezierCurveTo(X(6), Y(160), X(12), Y(158), X(16), Y(154));         // poll
  // crest: a scalloped mane down the back of the neck (each scallop a carved lock)
  const c0 = [16, 154], c1 = [31, 136], c2 = [32, 96], c3 = [26, 60];
  const B = (t) => { const mt = 1 - t; return [mt * mt * mt * c0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t * t * t * c3[0], mt * mt * mt * c0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t * t * t * c3[1]]; };
  const N = 6;
  for (let i = 1; i <= N; i++) {
    const a = B((i - 1) / N), b = B(i / N), mx = (a[0] + b[0]) / 2 + 5.5, my = (a[1] + b[1]) / 2 - 2;
    g.quadraticCurveTo(X(mx), Y(my), X(b[0]), Y(b[1]));
  }
  g.closePath();
}

// ---- the sprite painter ---------------------------------------------------------------------------
// Paints one piece with the centre of its foot at (cx, baseY) in sprite pixels; s = px per unit.
function paintPieceInto(ctx, w, h, type, white, theme, s, cx, baseY) {
  const m = materialOf(theme, white), P = profileOf(type), ao = makeAO(P);
  const img = new Uint8ClampedArray(w * h * 4);
  const X = (x) => cx + x * s, Y = (hh) => baseY - hh * s;
  // rook: battlement notches carved out of the top cylinder (6 merlons around; 3 notches visible)
  const mask = type === ROOK ? (hu, u) => {
    if (hu < 138) return 0;
    const th = Math.asin(u) * 180 / Math.PI;           // -90..90 across the visible front
    const a = Math.abs(th);
    return (a < 14 || (a > 46 && a < 74)) ? 1 : 0;
  } : null;
  rasterBody(img, w, h, P, s, cx, baseY, m, ao, mask);
  if (type === KNIGHT) {
    // shadow the collar under the head, then carve the head and its crest
    rasterPillow(img, w, h, m, 24 * s, (g) => knightHeadPath(g, X, Y), 1, (x, y) => {
      const hh = (baseY - y) / s; return hh < 74 ? 0.72 + 0.28 * clamp01((hh - 60) / 14) : 1;
    }, 0.3, 1.15);
  } else if (type === KING) {
    rasterPillow(img, w, h, m, 3.2 * s, (g) => {
      g.beginPath(); g.rect(X(-3.6), Y(200), 7.2 * s, 12 * s); g.rect(X(-11), Y(195.5), 22 * s, 7 * s); g.rect(X(-3.6), Y(200), 7.2 * s, 21 * s); }, 1);
  } else if (type === QUEEN) {
    // coronet: 8 points around the rim, 5 in view (the two at the sides foreshortened), each with a bead
    const rim = 39.5, pts = [-90, -45, 0, 45, 90];
    rasterPillow(img, w, h, m, 3 * s, (g) => {
      g.beginPath();
      for (const th of pts) {
        const x = Math.sin(th * Math.PI / 180) * rim, half = 7 * (0.55 + 0.45 * Math.cos(th * Math.PI / 180)), hp = 12 + 3 * Math.cos(th * Math.PI / 180);
        g.moveTo(X(x - half), Y(173)); g.lineTo(X(x), Y(174 + hp)); g.lineTo(X(x + half), Y(173)); g.closePath();
      }
      g.fill();
    }, 1);
    rasterPillow(img, w, h, m, 4 * s, (g) => {
      g.beginPath();
      for (const th of pts) { const x = Math.sin(th * Math.PI / 180) * rim, hp = 12 + 3 * Math.cos(th * Math.PI / 180); g.moveTo(X(x) + 3.4 * s, Y(176 + hp)); g.arc(X(x), Y(176 + hp), 3.4 * s, 0, TAU); }
      g.fill();
    }, 1);
    rasterPillow(img, w, h, m, 7 * s, (g) => { g.beginPath(); g.arc(X(0), Y(186), 7.5 * s, 0, TAU); g.fill(); }, 1);
  }
  ctx.putImageData(new ImageData(img, w, h), 0, 0);

  // ---- canvas-drawn details on top: open cups, grooves, eye/nostril ----
  const gc = (c) => `rgb(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0})`;
  ctx.save();
  if (type === ROOK) {
    // the open top: a dark well with a lit rim, seen from slightly above
    const rx = 34.5 * s, ry = rx * 0.26, ty = Y(152);
    const g = ctx.createRadialGradient(X(0), ty + ry * 0.3, rx * 0.1, X(0), ty, rx);
    g.addColorStop(0, gc(m.base.map((v) => v * 0.22))); g.addColorStop(0.8, gc(m.base.map((v) => v * 0.30))); g.addColorStop(1, gc(m.base.map((v) => v * 0.55)));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(X(0), ty, rx * 0.86, ry * 0.86, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = white ? 'rgba(255,255,255,0.55)' : 'rgba(255,225,190,0.35)'; ctx.lineWidth = 1.2 * s;
    ctx.beginPath(); ctx.ellipse(X(0), ty, rx * 0.93, ry * 0.93, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  } else if (type === QUEEN) {
    const rx = 39.5 * s, ry = rx * 0.24, ty = Y(176);
    ctx.fillStyle = gc(m.base.map((v) => v * 0.30)); ctx.beginPath(); ctx.ellipse(X(0), ty, rx * 0.72, ry * 0.72, 0, 0, TAU); ctx.fill();
  } else if (type === BISHOP) {
    // the mitre slit: a bold angled groove with a lit upper lip
    ctx.lineCap = 'round';
    ctx.strokeStyle = gc(m.groove); ctx.lineWidth = 4.2 * s; ctx.beginPath(); ctx.moveTo(X(-10), Y(158)); ctx.lineTo(X(8), Y(136)); ctx.stroke();
    ctx.strokeStyle = white ? 'rgba(255,255,255,0.55)' : 'rgba(255,220,190,0.28)'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(X(-9.5), Y(160.5)); ctx.lineTo(X(8.5), Y(138.5)); ctx.stroke();
  } else if (type === KNIGHT) {
    // eye (almond, with a catchlight), nostril, mouth groove, carved mane notches
    ctx.fillStyle = gc(m.mark);
    ctx.save(); ctx.translate(X(-27), Y(142)); ctx.rotate(-0.45); ctx.beginPath(); ctx.ellipse(0, 0, 4.2 * s, 2.4 * s, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = white ? 'rgba(255,255,255,0.8)' : 'rgba(255,240,220,0.75)'; ctx.beginPath(); ctx.arc(X(-28.5), Y(142.2), 1.1 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = gc(m.mark); ctx.beginPath(); ctx.ellipse(X(-49), Y(139), 2.4 * s, 3.2 * s, 0.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = gc(m.groove); ctx.lineCap = 'round'; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(X(-48), Y(125)); ctx.quadraticCurveTo(X(-42), Y(124.5), X(-37), Y(125.5)); ctx.stroke();
    // a groove where the mane meets the neck, with a lit edge beside it
    ctx.globalAlpha = 0.8; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(X(12), Y(152)); ctx.bezierCurveTo(X(22), Y(134), X(23), Y(98), X(19), Y(66)); ctx.stroke();
    ctx.strokeStyle = white ? 'rgba(255,255,255,0.45)' : 'rgba(255,225,190,0.22)'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(X(13.5), Y(152)); ctx.bezierCurveTo(X(23.5), Y(134), X(24.5), Y(98), X(20.5), Y(66)); ctx.stroke();
  }
  ctx.restore();
}

const sprites = new Map();
export function invalidatePieces() { sprites.clear(); }

// Sprite for a piece whose on-board footprint radius is R (CSS px). R is SQ*0.40 on the board, so with
// KING_H = 2.25 the king (200 units, cross included) stands 0.90 of a square tall and, standing on the
// FLOOR_LINE, its finial stays inside its own square: nothing ever reaches the pawn on the rank
// behind or the frame on rank 8. Every other piece is shorter, so the same holds for all of them.
const KING_H = 2.25;
// Where a piece's foot sits inside its square, as a fraction of SQ below the square's centre.
export const FLOOR_LINE = 0.42;
function sprite(type, white, theme, R, RES = 2) {
  const key = `${type}|${white ? 1 : 0}|${theme}|${R}|${RES}`;
  let sp = sprites.get(key);
  if (sp === undefined) {
    sp = null;
    try {
      const s = (R * KING_H) / 200;                      // px per unit
      const halfW = (type === KNIGHT ? 66 : MAX_R[type] + 6) * s, top = (PIECE_TOP[type] + 8) * s, pad = 6;
      const w = Math.ceil((halfW * 2 + pad * 2) * RES), h = Math.ceil((top + pad * 2) * RES);
      const c = newCanvas(w, h);
      if (c) {
        const cx = w / 2, baseY = h - pad * RES;
        paintPieceInto(c.getContext('2d'), w, h, type, white, theme, s * RES, cx, baseY);
        sp = { c, w: w / RES, h: h / RES, cx: cx / RES, baseY: baseY / RES };
      }
    } catch { sp = null; }
    sprites.set(key, sp);
  }
  return sp;
}
export function warmPiece(type, white, theme, R, res = 2) { sprite(type, white, theme, R, res); }

// Soft radial blob (cached per colour) for the contact shadow under a piece.
const blobs = new Map();
export function blob(ctx, x, y, rx, ry, rgb, alpha) {
  let c = blobs.get(rgb);
  if (c === undefined) {
    c = null;
    try { const cv = newCanvas(160, 160); if (cv) { const b = cv.getContext('2d'), g = b.createRadialGradient(80, 80, 0, 80, 80, 80); g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.45, `rgba(${rgb},0.55)`); g.addColorStop(1, `rgba(${rgb},0)`); b.fillStyle = g; b.fillRect(0, 0, 160, 160); c = cv; } } catch { c = null; }
    blobs.set(rgb, c);
  }
  ctx.save(); ctx.globalAlpha = alpha;
  if (c) ctx.drawImage(c, x - rx, y - ry, rx * 2, ry * 2);
  else { ctx.fillStyle = `rgba(${rgb},0.5)`; ctx.beginPath(); ctx.ellipse(x, y, rx * 0.7, ry * 0.7, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// Draw a piece with the centre of its FOOT at (x, y) — y is the square's floor line, not its centre.
// o: { R, theme, scale, alpha, lift (0..1, raised off the board for a pick-up feel), res (sprite bake
//      resolution in device px per virtual px, default 2) }
export function drawPiece(ctx, type, white, x, y, o = {}) {
  const R = o.R ?? 34, scale = o.scale ?? 1, theme = o.theme ?? 'walnut', lift = o.lift ?? 0, alpha = o.alpha ?? 1;
  const s = (R * KING_H) / 200, baseR = MAX_R[type] * s * scale;
  // contact shadow: a tight dark core under the foot plus a soft cast shadow offset to the lower right
  blob(ctx, x + baseR * 0.28 + lift * 12, y + lift * 14, baseR * (1.40 + lift * 0.3), baseR * (0.40 + lift * 0.12), '0,0,0', alpha * (0.36 - lift * 0.12));
  blob(ctx, x, y - 1, baseR * 1.06, baseR * 0.26, '0,0,0', alpha * (0.42 - lift * 0.25));
  const sp = sprite(type, white, theme, R, o.res ?? 2);
  const ly = y - lift * 16 * scale;
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
  if (sp) ctx.drawImage(sp.c, x - sp.cx * scale, ly - sp.baseY * scale, sp.w * scale, sp.h * scale);
  ctx.restore();
}
export const pieceFootprint = (type, R) => MAX_R[type] * 2 * ((R * KING_H) / 200);
