// Pure geometry for Kintsugi: vessel silhouettes, fracture patterns (jagged Voronoi cells), hit masks and gilding seams.
// Everything here is a deterministic function of a vessel definition (no env.rng): every player gets the same vessels.
export const WORLD = 1000;
export const CX = 500, CY = 500;
export const MASK = 5;   // hit-mask cell size in world units

export function rngOf(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function pip(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
function spline(ctrl, per = 8) {
  const out = [], n = ctrl.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = ctrl[Math.max(i - 1, 0)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(i + 2, n - 1)];
    for (let s = 0; s < per; s++) { const t = s / per; out.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t)]); }
  }
  out.push(ctrl[n - 1].slice());
  return out;
}

// Silhouette in vessel space (centred near 0,0), then scaled/translated into the world.
function rawShape(def) {
  if (def.kind === 'disc') {
    const pts = [], n = 160, lobes = def.lobes ?? 0, amp = def.lobeAmp ?? 0;
    for (let i = 0; i < n; i++) { const th = (i / n) * Math.PI * 2, r = 1 + amp * Math.cos(lobes * th); pts.push([Math.cos(th) * r * 100, Math.sin(th) * r * 100]); }
    return { pts, open: null };
  }
  const prof = spline(def.prof, 8), top = prof[0], bot = prof[prof.length - 1];   // each [y, r]
  const rimRy = top[1] * (def.rimRy ?? 0.16), baseRy = bot[1] * 0.1, pts = [];
  for (const p of prof) pts.push([p[1], p[0]]);
  for (let i = 0; i <= 16; i++) { const th = (i / 16) * Math.PI; pts.push([bot[1] * Math.cos(th), bot[0] + baseRy * Math.sin(th)]); }
  for (let i = prof.length - 1; i >= 0; i--) pts.push([-prof[i][1], prof[i][0]]);
  for (let i = 0; i <= 24; i++) { const th = Math.PI - (i / 24) * Math.PI; pts.push([top[1] * Math.cos(th), top[0] - rimRy * Math.sin(th)]); }
  return { pts, open: { x: 0, y: top[0], rx: top[1], ry: rimRy }, baseRy };
}

export function buildShape(def) {
  const raw = rawShape(def);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of raw.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const k = def.D / Math.max(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const tr = ([x, y]) => [CX + (x - mx) * k, CY + (y - my) * k];
  const sil = raw.pts.map(tr);
  const b = { x0: CX + (x0 - mx) * k, x1: CX + (x1 - mx) * k, y0: CY + (y0 - my) * k, y1: CY + (y1 - my) * k };
  b.w = b.x1 - b.x0; b.h = b.y1 - b.y0; b.cx = (b.x0 + b.x1) / 2; b.cy = (b.y0 + b.y1) / 2;
  const open = raw.open ? { x: CX + (raw.open.x - mx) * k, y: CY + (raw.open.y - my) * k, rx: raw.open.rx * k, ry: raw.open.ry * k } : null;
  return { def, sil, bounds: b, open, k, mx, my, baseRy: (raw.baseRy ?? 0) * k, disc: def.kind === 'disc', R: def.kind === 'disc' ? 100 * k : 0 };
}

// ---- fracture -----------------------------------------------------------------------------------------------------------------
function clipCell(poly, a, b, j) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = b[0] - a[0], ny = b[1] - a[1];
  const side = (p) => (p.x - mx) * nx + (p.y - my) * ny;   // <= 0 keeps the half closer to a
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const cur = poly[i], nxt = poly[(i + 1) % n], sc = side(cur), sn = side(nxt), cin = sc <= 0, nin = sn <= 0;
    const hit = () => { const t = sc / (sc - sn); return { x: cur.x + (nxt.x - cur.x) * t, y: cur.y + (nxt.y - cur.y) * t }; };
    if (cin && nin) out.push(cur);
    else if (cin && !nin) { out.push(cur); const h = hit(); out.push({ x: h.x, y: h.y, nb: j }); }
    else if (!cin && nin) { const h = hit(); out.push({ x: h.x, y: h.y, nb: cur.nb }); }
  }
  return out;
}

function jag(A, B, rnd) {
  const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const n = Math.max(2, Math.round(len / 15)), amp = 3 + len * 0.05, pts = [A];
  let off = 0;
  for (let k = 1; k < n; k++) {
    const t = k / n;
    off = off * 0.45 + (rnd() - 0.5) * amp * 2.2;
    if (rnd() < 0.14) off += (rnd() - 0.5) * amp * 3.4;
    const taper = Math.min(1, Math.sin(Math.PI * t) * 2.2);
    pts.push([A[0] + dx * t + nx * off * taper, A[1] + dy * t + ny * off * taper]);
  }
  pts.push(B);
  return pts;
}

function resample(pts, step) {
  const out = [pts[0].slice()];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = step - carry;
    while (d <= L) { const t = d / L; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); d += step; }
    carry = L - (d - step);
  }
  return out;
}

const cache = new Map();
export function buildVessel(def) {
  if (cache.has(def.id)) return cache.get(def.id);
  const V = buildShape(def), rnd = rngOf(def.seed), N = def.N, b = V.bounds, sil = V.sil;
  // sample points inside the silhouette
  const samples = [];
  for (let y = b.y0 + 4; y < b.y1; y += 8) for (let x = b.x0 + 4; x < b.x1; x += 8) if (pip(sil, x, y)) samples.push([x, y]);
  // blue-noise sites (best candidate), then a little Lloyd relaxation
  const sites = [samples[Math.floor(rnd() * samples.length)]];
  while (sites.length < N) {
    let best = null, bd = -1;
    for (let c = 0; c < 70; c++) {
      const s = samples[Math.floor(rnd() * samples.length)];
      let md = 1e9; for (const t of sites) md = Math.min(md, Math.hypot(s[0] - t[0], s[1] - t[1]));
      if (md > bd) { bd = md; best = s; }
    }
    sites.push(best);
  }
  for (let it = 0; it < 3; it++) {
    const sum = sites.map(() => [0, 0, 0]);
    for (const s of samples) {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < N; i++) { const d = (s[0] - sites[i][0]) ** 2 + (s[1] - sites[i][1]) ** 2; if (d < bd) { bd = d; bi = i; } }
      sum[bi][0] += s[0]; sum[bi][1] += s[1]; sum[bi][2] += 1;
    }
    for (let i = 0; i < N; i++) if (sum[i][2]) sites[i] = [sum[i][0] / sum[i][2], sum[i][1] / sum[i][2]];
  }
  for (const s of sites) { s[0] += (rnd() - 0.5) * 16; s[1] += (rnd() - 0.5) * 16; }
  // convex cells with labelled edges
  const box = [{ x: b.x0 - 30, y: b.y0 - 30, nb: -1 }, { x: b.x1 + 30, y: b.y0 - 30, nb: -1 }, { x: b.x1 + 30, y: b.y1 + 30, nb: -1 }, { x: b.x0 - 30, y: b.y1 + 30, nb: -1 }];
  const cells = sites.map((s, i) => {
    let poly = box.map((p) => ({ ...p }));
    for (let j = 0; j < N; j++) if (j !== i) poly = clipCell(poly, s, sites[j], j);
    return poly;
  });
  // one jagged polyline per neighbouring pair, generated from the lower index's direction
  const edges = new Map();
  const key = (i, j) => (i < j ? `${i},${j}` : `${j},${i}`);
  cells.forEach((poly, i) => poly.forEach((p, k) => {
    const q = poly[(k + 1) % poly.length], j = p.nb;
    if (j > i && !edges.has(key(i, j))) edges.set(key(i, j), jag([p.x, p.y], [q.x, q.y], rngOf(def.seed * 131 + i * 17 + j * 7919)));
  }));
  const polys = cells.map((poly, i) => {
    const out = [];
    poly.forEach((p, k) => {
      const q = poly[(k + 1) % poly.length], j = p.nb;
      if (j === undefined || j < 0 || !edges.has(key(i, j))) { out.push([p.x, p.y]); return; }
      const e = edges.get(key(i, j)), seg = j > i ? e : e.slice().reverse();
      for (let m = 0; m < seg.length - 1; m++) out.push(seg[m]);
      void q;
    });
    return out;
  });
  // hit masks, centroids, areas
  const pts = sites.map(() => []);
  for (let y = b.y0; y < b.y1; y += MASK) for (let x = b.x0; x < b.x1; x += MASK) {
    if (!pip(sil, x, y)) continue;
    const order = sites.map((s, i) => [(x - s[0]) ** 2 + (y - s[1]) ** 2, i]).sort((p, q) => p[0] - q[0]);
    for (let m = 0; m < Math.min(4, N); m++) if (pip(polys[order[m][1]], x, y)) { pts[order[m][1]].push([x, y]); break; }
  }
  const pieces = polys.map((poly, i) => {
    const P = pts[i].length ? pts[i] : [sites[i]];
    let cx = 0, cy = 0; for (const p of P) { cx += p[0]; cy += p[1]; }
    cx /= P.length; cy /= P.length;
    let ox = 1e9, oy = 1e9, mx = -1e9, my = -1e9, r = 0;
    for (const p of P) { ox = Math.min(ox, p[0] - cx); oy = Math.min(oy, p[1] - cy); mx = Math.max(mx, p[0] - cx); my = Math.max(my, p[1] - cy); r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy)); }
    ox -= MASK * 2; oy -= MASK * 2;
    const gw = Math.ceil((mx - ox) / MASK) + 3, gh = Math.ceil((my - oy) / MASK) + 3, data = new Uint8Array(gw * gh);
    for (const p of P) { const gx = Math.round((p[0] - cx - ox) / MASK), gy = Math.round((p[1] - cy - oy) / MASK); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) data[(gy + dy) * gw + gx + dx] = 1; }
    return { id: i, site: sites[i], poly: poly.map(([x, y]) => [x - cx, y - cy]), hx: cx, hy: cy, r: r + 8, area: P.length * MASK * MASK, mask: { ox, oy, gw, gh, data }, nbrs: [], bb: { x0: ox, y0: oy, x1: ox + gw * MASK, y1: oy + gh * MASK } };
  });
  // gilding seams: the jagged polylines clipped to the silhouette, resampled
  const seams = [];
  for (const [k, e] of edges) {
    const [i, j] = k.split(',').map(Number), rs = resample(e, 3.5);
    let run = [];
    const flush = () => { if (run.length >= 5) seams.push({ a: i, b: j, pts: run }); run = []; };
    for (const p of rs) { if (pip(sil, p[0], p[1])) run.push(p); else flush(); }
    flush();
    pieces[i].nbrs.push(j); pieces[j].nbrs.push(i);
  }
  seams.sort((p, q) => (p.a - q.a) || (p.b - q.b));
  V.pieces = pieces; V.seams = seams; V.cells = polys;
  V.seamCount = seams.reduce((n, s) => n + s.pts.length, 0);
  cache.set(def.id, V);
  return V;
}

export function maskHit(pc, lx, ly) {
  const m = pc.mask, gx = Math.round((lx - m.ox) / MASK), gy = Math.round((ly - m.oy) / MASK);
  return gx >= 0 && gy >= 0 && gx < m.gw && gy < m.gh && m.data[gy * m.gw + gx] === 1;
}
