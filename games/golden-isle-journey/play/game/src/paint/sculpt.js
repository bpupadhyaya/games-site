// Relief painter: turns flat vector colour ("albedo") into modelled, lit volume - once, at sprite-cache time.
// A part is painted with the normal canvas API into a scratch layer; its alpha is inflated into a rounded
// height field, sculpting blobs (muscle, brow, folds) are added, and every pixel is then lit with a warm key,
// cool ambient, bounce, rim, soft subsurface warmth and specular. Nothing here runs per frame.
import { TAU } from './kit.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const hash1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }

// three-pass box blur (close to gaussian) on a Float32Array, radius r px
function blur(src, w, h, r) {
  r = Math.max(1, Math.round(r)); const a = Float32Array.from(src), tmp = new Float32Array(src.length), n = 2 * r + 1;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) { let s = 0; const o = y * w; for (let x = -r; x <= r; x++) s += a[o + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { tmp[o + x] = s / n; s += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = s / n; s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  }
  return a;
}

// materials: wrap (soft terminator), sss (warm terminator glow), spec/shine, rim, metal (environment bands)
export const MAT = {
  skin:    { wrap: 0.45, sss: 0.2, spec: 0.16, shine: 26, rim: 0.55, ao: 0.9, mottle: 0.05 },
  fur:     { wrap: 0.26, sss: 0.12, spec: 0.07, shine: 8, rim: 0.95, ao: 1.0, mottle: 0.06 },
  cloth:   { wrap: 0.4, sss: 0.05, spec: 0.05, shine: 10, rim: 0.5, ao: 1.0, mottle: 0.04 },
  silk:    { wrap: 0.35, sss: 0.04, spec: 0.38, shine: 14, rim: 0.6, ao: 1.0, mottle: 0.03 },
  gold:    { wrap: 0.1, sss: 0, spec: 1.1, shine: 46, rim: 0.5, ao: 1.1, metal: 1, mottle: 0.02 },
  iron:    { wrap: 0.1, sss: 0, spec: 0.7, shine: 30, rim: 0.4, ao: 1.1, metal: 0.7, mottle: 0.04 },
  feather: { wrap: 0.6, sss: 0.1, spec: 0.12, shine: 10, rim: 1.1, ao: 0.9, mottle: 0.03 },
  stone:   { wrap: 0.3, sss: 0, spec: 0.04, shine: 8, rim: 0.4, ao: 1.2, mottle: 0.1 },
  wood:    { wrap: 0.3, sss: 0, spec: 0.2, shine: 18, rim: 0.4, ao: 1.0, mottle: 0.08 },
};

// key light from the upper front (the way the figure faces), cool sky ambient, warm bounce, warm back rim
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const LK = norm([0.42, -0.58, 0.7]), HV = norm([LK[0], LK[1], LK[2] + 1]);

// relief(g, o): g is a sprite context (kit.sprite sets g._sp). o = {
//   paint(c)       draw the flat colours + silhouette (alpha) in sprite units
//   inflate, depth pillow radius and height (units); profile 'round' | 'soft'
//   blobs          [{x,y,rx,ry,rot,z}] or [{cap:[x0,y0,r0,x1,y1,r1],z}] smooth additive bumps (z<0 carves)
//   heightFn(x,y)  extra height in units;  bump: albedo-luminance relief (strands, embroidery)
//   mat            material name or object;  over(g) crisp details drawn after lighting }
export function relief(g, o) {
  const sp = g._sp;
  if (!sp || !sp.make) { o.paint(g); if (o.over) o.over(g); return; }
  const { cw, ch } = sp, M = g.getTransform(), det = M.a * M.d - M.b * M.c, res = Math.sqrt(Math.abs(det));
  const ia = M.d / det, ib = -M.b / det, ic = -M.c / det, id = M.a / det, ie = (M.c * M.f - M.d * M.e) / det, jf = (M.b * M.e - M.a * M.f) / det;
  const lay = sp.make(cw, ch), a = lay.getContext('2d', { willReadFrequently: true }); a.setTransform(M); a.lineCap = 'round'; a.lineJoin = 'round'; a._sp = sp;
  o.paint(a);
  const img = a.getImageData(0, 0, cw, ch), D = img.data;
  // bounding box of the painted alpha
  let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
  for (let y = 0; y < ch; y++) for (let x = 0, i = y * cw * 4 + 3; x < cw; x++, i += 4) if (D[i] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return;
  const pad = Math.ceil((o.inflate ?? 6) * res * 1.5) + 3; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(cw - 1, x1 + pad); y1 = Math.min(ch - 1, y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, n = w * h;
  const A = new Float32Array(n), Lm = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((y + y0) * cw + x + x0) * 4, j = y * w + x; A[j] = D[i + 3] / 255; Lm[j] = (D[i] * 0.3 + D[i + 1] * 0.59 + D[i + 2] * 0.11) / 255; }
  const H = new Float32Array(n);
  // 1. pillow inflate of the silhouette
  const depth = (o.depth ?? (o.inflate ?? 6) * 0.8) * res;
  if ((o.inflate ?? 6) > 0) {
    const B = blur(A, w, h, (o.inflate ?? 6) * res / 1.7);
    for (let j = 0; j < n; j++) { const t = clamp01((B[j] - 0.16) / 0.8); H[j] = depth * (o.profile === 'soft' ? t * t * (3 - 2 * t) : Math.sqrt(t * (2 - t))); }
  }
  // 2. sculpting blobs
  for (const b of o.blobs ?? []) {
    const z = b.z * res;
    if (b.cap) {
      const [ax, ay, r0, bx, by, r1] = b.cap, rm = Math.max(r0, r1), dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      const pax = M.a * ax + M.c * ay + M.e, pay = M.b * ax + M.d * ay + M.f, pbx = M.a * bx + M.c * by + M.e, pby = M.b * bx + M.d * by + M.f, pr = rm * res + 2;
      const X0 = Math.max(0, Math.floor(Math.min(pax, pbx) - pr) - x0), X1 = Math.min(w - 1, Math.ceil(Math.max(pax, pbx) + pr) - x0), Y0 = Math.max(0, Math.floor(Math.min(pay, pby) - pr) - y0), Y1 = Math.min(h - 1, Math.ceil(Math.max(pay, pby) + pr) - y0);
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) { const PX = x + x0, PY = y + y0, ux = ia * PX + ic * PY + ie - ax, uy = ib * PX + id * PY + jf - ay, t = clamp01((ux * dx + uy * dy) / L2), r = r0 + (r1 - r0) * t, ex = ux - dx * t, ey = uy - dy * t, d = 1 - (ex * ex + ey * ey) / (r * r); if (d > 0) H[y * w + x] += z * (b.sharp ? Math.sqrt(d) : d * d * (3 - 2 * d)) * (r / rm); }
    } else {
      const rm = Math.max(b.rx, b.ry), cs = Math.cos(b.rot ?? 0), sn = Math.sin(b.rot ?? 0);
      const pcx = M.a * b.x + M.c * b.y + M.e, pcy = M.b * b.x + M.d * b.y + M.f, pr = rm * res + 2;
      const X0 = Math.max(0, Math.floor(pcx - pr) - x0), X1 = Math.min(w - 1, Math.ceil(pcx + pr) - x0), Y0 = Math.max(0, Math.floor(pcy - pr) - y0), Y1 = Math.min(h - 1, Math.ceil(pcy + pr) - y0);
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) { const PX = x + x0, PY = y + y0, ux = ia * PX + ic * PY + ie - b.x, uy = ib * PX + id * PY + jf - b.y, px = ux * cs + uy * sn, py = -ux * sn + uy * cs, d = 1 - (px * px) / (b.rx * b.rx) - (py * py) / (b.ry * b.ry); if (d > 0) H[y * w + x] += z * (b.sharp ? Math.sqrt(d) : d * d * (3 - 2 * d)); }
    }
  }
  if (o.heightFn) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const j = y * w + x; if (A[j] > 0) { const PX = x + x0, PY = y + y0; H[j] += o.heightFn(ia * PX + ic * PY + ie, ib * PX + id * PY + jf) * res; } }
  if (o.bump) { const Lb = blur(Lm, w, h, Math.max(1, res * 0.5)); for (let j = 0; j < n; j++) H[j] += (Lm[j] - Lb[j]) * o.bump * res * A[j]; }
  // 3. light it
  const m = { ...(typeof o.mat === 'object' ? { ...MAT.cloth, ...o.mat } : MAT[o.mat ?? 'skin']), ...(o.rim != null ? { rim: o.rim } : {}) };
  const aoR = Math.max(2, (o.aoR ?? 5) * res), Hb = m.ao ? blur(H, w, h, aoR) : null;
  const key = o.key ?? [1.18, 1.05, 0.87], amb = o.amb ?? [0.33, 0.28, 0.36], rimC = [1.0, 0.7, 0.42];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = y * w + x; if (A[j] <= 0) continue;
    const xl = x > 0 ? j - 1 : j, xr = x < w - 1 ? j + 1 : j, yu = y > 0 ? j - w : j, yd = y < h - 1 ? j + w : j;
    let nx = -(H[xr] - H[xl]) * 0.5, ny = -(H[yd] - H[yu]) * 0.5, nz = 1; const il = 1 / Math.sqrt(nx * nx + ny * ny + 1); nx *= il; ny *= il; nz *= il;
    const ndl = nx * LK[0] + ny * LK[1] + nz * LK[2], dif = clamp01((ndl + m.wrap) / (1 + m.wrap));
    const ao = Hb ? clamp01(1 - m.ao * Math.max(0, Hb[j] - H[j]) / (aoR * 0.9)) : 1;
    const bounce = clamp01(ny * 0.8 + 0.1) * 0.22, fres = 1 - nz, rim = fres * fres * clamp01(-nx * 0.75 - ny * 0.45 + 0.35) * m.rim * 1.5;
    const ndh = Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]); let spec = Math.pow(ndh, m.shine) * m.spec;
    const sss = m.sss ? Math.exp(-((ndl - 0.05) * (ndl - 0.05)) / 0.09) * m.sss : 0;
    const i = ((y + y0) * cw + x + x0) * 4, ux = (x + x0) / res, uy = (y + y0) / res;
    const mo = 1 + (vnoise(ux * 0.35, uy * 0.35) - 0.5) * 2 * m.mottle + (vnoise(ux * 1.3, uy * 1.3) - 0.5) * m.mottle;
    let r = D[i] / 255, gg = D[i + 1] / 255, b = D[i + 2] / 255;
    let lr, lg, lb;
    if (m.metal) {
      // fake environment: bright warm sky above a dark horizon, reflected
      const ry = 2 * nz * ny, rx = 2 * nz * nx, sky = clamp01(-ry * 1.6 + 0.35), band = Math.exp(-(ry + 0.05) * (ry + 0.05) / 0.012) * 0.9, env = 0.46 + sky * 0.85 + band * 0.7 + clamp01(rx) * 0.25;
      const k = (1 - m.metal) * (amb[0] + dif) + m.metal * env; lr = k * 1.08; lg = k * 0.97; lb = k * 0.8;
    } else { lr = amb[0] + key[0] * dif + bounce * 1.0; lg = amb[1] + key[1] * dif + bounce * 0.62; lb = amb[2] + key[2] * dif + bounce * 0.36; }
    lr *= ao * mo; lg *= ao * mo; lb *= (ao * 0.9 + 0.1) * mo;
    r = r * lr + sss * 0.62 * r + rim * rimC[0] * (0.35 + r * 0.65) + spec; gg = gg * lg + sss * 0.2 * gg + rim * rimC[1] * (0.35 + gg * 0.65) + spec * 0.93; b = b * lb + sss * 0.08 * b + rim * rimC[2] * (0.35 + b * 0.65) + spec * 0.78;
    D[i] = r > 1 ? 255 : r * 255; D[i + 1] = gg > 1 ? 255 : gg * 255; D[i + 2] = b > 1 ? 255 : b * 255;
  }
  if (o.alphaFn) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (A[y * w + x] <= 0) continue; const PX = x + x0, PY = y + y0, i = (PY * cw + PX) * 4 + 3; D[i] = D[i] * clamp01(o.alphaFn(ia * PX + ic * PY + ie, ib * PX + id * PY + jf)); }
  a.putImageData(img, 0, 0);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(lay, 0, 0); g.restore();
  if (o.over) o.over(g);
}

// ---- fur: thousands of short tapered strokes following a flow field, dark to light, drawn once ----
// o = { box:[x0,y0,x1,y1], inside(x,y)->bool, n, len, wid, flow(x,y)->angle (0 = +x, PI/2 = down), cols:[...dark..light],
//       colAt(x,y,k)->css (optional override), seed, jitter, tuft (chance of a longer lock) }
export function furCoat(c, o) {
  const [bx0, by0, bx1, by1] = o.box, seed = o.seed ?? 1, n = o.n ?? 800, jit = o.jitter ?? 0.35, layers = o.cols.length;
  for (let L = 0; L < layers; L++) {
    const cnt = Math.round(n * (L === 0 ? 1 : L === layers - 1 ? 0.45 : 0.8)), pts = [];
    for (let i = 0; i < cnt; i++) { const x = bx0 + hash1(seed + i * 3.1 + L * 977) * (bx1 - bx0), y = by0 + hash1(seed + i * 7.7 + L * 313 + 5) * (by1 - by0); if (!o.inside || o.inside(x, y)) pts.push([x, y, i]); }
    pts.sort((p, q) => p[1] - q[1]);
    for (const [x, y, i] of pts) {
      const an = o.flow(x, y) + (hash1(seed + i * 1.37 + L) - 0.5) * 2 * jit, tuft = hash1(seed + i * 9.1) < (o.tuft ?? 0.08) ? 1.7 : 1;
      const len = o.len * (0.65 + hash1(seed + i * 2.9) * 0.7) * tuft * (1 - L * 0.12), wd = o.wid * (0.7 + hash1(seed + i * 4.3) * 0.6) * (1 - L * 0.15);
      const dx = Math.cos(an), dy = Math.sin(an), bend = (hash1(seed + i * 5.9) - 0.5) * len * 0.5, ex = x + dx * len, ey = y + dy * len, mx = x + dx * len * 0.5 - dy * bend, my = y + dy * len * 0.5 + dx * bend;
      c.fillStyle = o.colAt ? o.colAt(x, y, L, hash1(seed + i * 6.7)) : o.cols[L];
      c.beginPath(); c.moveTo(x - dy * wd, y + dx * wd); c.quadraticCurveTo(mx - dy * wd * 0.6, my + dx * wd * 0.6, ex, ey); c.quadraticCurveTo(mx + dy * wd * 0.6, my - dx * wd * 0.6, x + dy * wd, y - dx * wd); c.closePath(); c.fill();
    }
  }
}
// inside-test helper from a list of ellipses/capsules (cheap, works without Path2D)
export const insideOf = (shapes) => (x, y) => { for (const s of shapes) { if (s.cap) { const [ax, ay, r0, bx, by, r1] = s.cap, dx = bx - ax, dy = by - ay, t = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)), r = r0 + (r1 - r0) * t, ex = x - ax - dx * t, ey = y - ay - dy * t; if (ex * ex + ey * ey < r * r) return true; } else { const cs = Math.cos(s.rot ?? 0), sn = Math.sin(s.rot ?? 0), ux = x - s.x, uy = y - s.y, px = ux * cs + uy * sn, py = -ux * sn + uy * cs; if ((px * px) / (s.rx * s.rx) + (py * py) / (s.ry * s.ry) < 1) return true; } } return false; };
// fill a list of ellipses/capsules as one silhouette
export function fillShapes(c, shapes, style) {
  c.fillStyle = style;
  for (const s of shapes) {
    c.beginPath();
    if (s.cap) { const [ax, ay, r0, bx, by, r1] = s.cap, an = Math.atan2(by - ay, bx - ax); c.arc(ax, ay, r0, an + Math.PI / 2, an - Math.PI / 2); c.arc(bx, by, r1, an - Math.PI / 2, an + Math.PI / 2); c.closePath(); }
    else c.ellipse(s.x, s.y, s.rx, s.ry, s.rot ?? 0, 0, TAU);
    c.fill();
  }
}
