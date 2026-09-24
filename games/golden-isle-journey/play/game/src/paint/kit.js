// Painting kit: colour maths, shaded primitives (tubes, gems, pearls, cloth) and the sprite cache.
// Every character part is authored as vector drawing code, rasterised ONCE into an offscreen canvas
// (see `sprite`), and then posed by drawing those cached sprites - no gradients are built per frame.
export const TAU = Math.PI * 2;

// ---- colour ----
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
export const lighten = (c, t) => mix(c, '#fff4dc', t);
export const darken = (c, t) => mix(c, '#1c0a12', t);
export const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
// A skin/fur/cloth ramp from one base colour: lit (warm light), base, shade (cool core shadow), deep.
export const ramp = (base) => ({ base, lit: mix(base, '#ffd9a0', 0.42), hi: mix(base, '#fff0d0', 0.7), shade: mix(darken(base, 0.32), '#5a2a5a', 0.16), deep: darken(base, 0.62) });

export const GOLDS = ['#fff2b8', '#f6cf6a', '#c98a22', '#8a5510'];
export function lin(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
export function rad(ctx, x, y, r0, r1, stops, fx = x, fy = y) { const g = ctx.createRadialGradient(fx, fy, r0, x, y, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
export const goldFill = (ctx, x0, y0, x1, y1) => lin(ctx, x0, y0, x1, y1, [[0, '#fff0b0'], [0.35, '#f2c04e'], [0.7, '#b57a1c'], [1, '#f8d97e']]);

// ---- sprite cache ----
const cache = new Map();
export const stats = { sprites: 0, texels: 0, blits: 0 };
let factory = null;
// Sprites need an offscreen canvas of the same kind as the screen: derive the factory from the first ctx we draw with.
export function bindCanvas(ctx) {
  if (factory || !ctx || !ctx.canvas) return;
  const cv = ctx.canvas;
  if (cv.ownerDocument && cv.ownerDocument.createElement) factory = (w, h) => { const c = cv.ownerDocument.createElement('canvas'); c.width = w; c.height = h; return c; };
  else if (typeof cv.constructor === 'function' && cv.constructor.name === 'OffscreenCanvas') factory = (w, h) => new cv.constructor(w, h);
}
const makeCanvas = (w, h) => (factory ? factory(w, h) : null);
// Render `fn(ctx)` once into a w x h (game units) canvas whose local origin sits at (ox, oy); res = px per unit.
export function sprite(key, w, h, ox, oy, res, fn) {
  let s = cache.get(key);
  if (s) return s;
  const cw = Math.ceil(w * res), ch = Math.ceil(h * res), c = makeCanvas(cw, ch);
  s = { c, w: cw / res, h: ch / res, ox, oy, fn, key };
  if (c) {
    const g = c.getContext('2d', { willReadFrequently: false }); g.scale(res, res); g.translate(ox, oy); g.lineCap = 'round'; g.lineJoin = 'round'; g._sp = { cw, ch, res, ox, oy, make: makeCanvas };
    fn(g); stats.sprites++; stats.texels += cw * ch;
  }
  cache.set(key, s);
  return s;
}
// Draw a sprite with its origin at the current transform origin.
export function blit(ctx, s, alpha = 1) {
  stats.blits++;
  if (s.c) { if (alpha !== 1) ctx.globalAlpha *= alpha; ctx.drawImage(s.c, -s.ox, -s.oy, s.w, s.h); if (alpha !== 1) ctx.globalAlpha /= alpha; }
  // no offscreen canvas (headless test harness): painting is skipped, the simulation does not depend on it
}
// A darkened/tinted copy of a sprite (for silhouettes, hit flashes and far-away LOD).
export function tinted(s, color, a) {
  const k = s.key + '|' + color + '|' + a; let t = cache.get(k); if (t) return t;
  if (!s.c) return s;
  const c = makeCanvas(s.c.width, s.c.height), g = c.getContext('2d');
  g.drawImage(s.c, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  t = { ...s, c }; cache.set(k, t); stats.sprites++; stats.texels += c.width * c.height; return t;
}
export const cacheInfo = () => ({ ...stats, MB: +(stats.texels * 4 / 1048576).toFixed(2) });

// ---- shaded primitives ----
// A tapered limb hanging down from (0,0) to (0,len): width w0 at the top, w1 at the end.
export function tube(ctx, len, w0, w1, p, { round = true, fur = 0 } = {}) {
  const a = w0 / 2, b = w1 / 2;
  ctx.beginPath();
  ctx.moveTo(-a, 0); ctx.quadraticCurveTo(-(a + b) / 2 - 1.2, len * 0.45, -b, len);
  if (round) ctx.arc(0, len, b, Math.PI, 0, true); else ctx.lineTo(b, len);
  ctx.quadraticCurveTo((a + b) / 2 + 1.2, len * 0.45, a, 0);
  if (round) ctx.arc(0, 0, a, 0, Math.PI, true); else ctx.closePath();
  ctx.fillStyle = lin(ctx, -a - 1, 0, a + 1, 0, [[0, p.shade], [0.3, p.base], [0.68, p.lit], [0.92, p.base], [1, p.shade]]);
  ctx.fill();
  ctx.save(); ctx.clip();
  // core shadow under the joint, warm highlight streak along the lit side
  ctx.fillStyle = lin(ctx, 0, len * 0.72, 0, len + b, [[0, 'rgba(0,0,0,0)'], [1, rgba(p.deep, 0.32)]]); ctx.fillRect(-a - 2, len * 0.72, a * 2 + 4, len);
  ctx.strokeStyle = rgba(p.hi, 0.5); ctx.lineWidth = Math.max(1.2, w0 * 0.1);
  ctx.beginPath(); ctx.moveTo(a * 0.32, a * 0.6); ctx.quadraticCurveTo(a * 0.5, len * 0.45, b * 0.36, len - b * 0.4); ctx.stroke();
  if (fur) { ctx.strokeStyle = rgba(p.deep, 0.38); ctx.lineWidth = 0.9; for (let i = 0; i < fur; i++) { const y = (i + 0.5) / fur * len, s = i % 2 ? 1 : -1, x = s * (a * 0.5 + (i % 3)); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * -1.6, y + 3.4); ctx.stroke(); } }
  ctx.restore();
  ctx.strokeStyle = rgba(p.deep, 0.5); ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(-a, 0); ctx.quadraticCurveTo(-(a + b) / 2 - 1.2, len * 0.45, -b, len); ctx.stroke();
}


// A shaped limb: width profile prof = [[u, width], ...] (u 0..1 along the length), muscle-shaded.
export function limb(ctx, len, prof, p, { fur = 0, hiAt = 0.35, crease = 0 } = {}) {
  const wAt = (u) => { let i = 0; while (i < prof.length - 2 && u > prof[i + 1][0]) i++; const [u0, w0] = prof[i], [u1, w1] = prof[i + 1], k = Math.min(1, Math.max(0, (u - u0) / (u1 - u0))), m = (1 - Math.cos(k * Math.PI)) / 2; return w0 + (w1 - w0) * m; };
  const N = 14, L = [], R = [];
  for (let i = 0; i <= N; i++) { const u = i / N, w = wAt(u) / 2; L.push([-w, u * len]); R.push([w, u * len]); }
  const path = () => {
    ctx.beginPath(); ctx.moveTo(L[0][0], 0);
    for (let i = 1; i <= N; i++) ctx.lineTo(L[i][0], L[i][1]);
    ctx.arc(0, len, R[N][0], Math.PI, 0, true);
    for (let i = N; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.arc(0, 0, R[0][0], 0, Math.PI, true); ctx.closePath();
  };
  const wm = Math.max(...prof.map((q) => q[1])) / 2;
  path(); ctx.fillStyle = lin(ctx, -wm - 1, 0, wm + 1, 0, [[0, p.shade], [0.28, p.base], [0.66, p.lit], [0.9, p.base], [1, p.shade]]); ctx.fill();
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = lin(ctx, 0, len * 0.74, 0, len + wm, [[0, 'rgba(0,0,0,0)'], [1, rgba(p.deep, 0.34)]]); ctx.fillRect(-wm - 2, len * 0.74, wm * 2 + 4, len);
  // muscle belly highlight and core shadow line
  const hy = len * hiAt, hw = wAt(hiAt) / 2;
  ctx.fillStyle = rad(ctx, hw * 0.35, hy, 0, hw * 1.1, [[0, rgba(p.hi, 0.5)], [1, 'rgba(255,255,255,0)']]); ctx.beginPath(); ctx.ellipse(hw * 0.35, hy, hw * 0.8, len * 0.2, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(p.deep, 0.34); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-hw * 0.2, len * 0.12); ctx.quadraticCurveTo(-hw * 0.45, hy + len * 0.15, -wAt(0.8) * 0.3, len * 0.9); ctx.stroke();
  if (crease) { ctx.strokeStyle = rgba(p.deep, 0.5); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-wAt(0) / 2, 2); ctx.quadraticCurveTo(0, 5, wAt(0) / 2, 2); ctx.stroke(); }
  if (fur) { ctx.strokeStyle = rgba(p.deep, 0.3); ctx.lineWidth = 0.55; for (let i = 0; i < fur * 3; i++) { const y = ((i * 0.618) % 1) * len, s = i % 2 ? 1 : -1, x = s * wAt(y / len) * (0.1 + ((i * 7) % 5) * 0.08); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 0.6, y + 2.8); ctx.stroke(); } }
  ctx.restore();
  ctx.strokeStyle = rgba(p.deep, 0.6); ctx.lineWidth = 0.7;
  ctx.beginPath(); for (let i = 0; i <= N; i++) ctx[i ? 'lineTo' : 'moveTo'](L[i][0], L[i][1]); ctx.stroke();
  ctx.strokeStyle = rgba(p.deep, 0.32); ctx.beginPath(); for (let i = 0; i <= N; i++) ctx[i ? 'lineTo' : 'moveTo'](R[i][0], R[i][1]); ctx.stroke();
}

export function pearl(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(40,10,10,0.35)'; ctx.beginPath(); ctx.arc(x + r * 0.15, y + r * 0.2, r * 1.05, 0, TAU); ctx.fill();
  ctx.fillStyle = rad(ctx, x, y, 0, r, [[0, '#ffffff'], [0.45, '#f1e9dc'], [1, '#a9987f']], x - r * 0.35, y - r * 0.35); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
export function gem(ctx, x, y, r, col) {
  ctx.fillStyle = rgba(darken(col, 0.7), 0.95); ctx.beginPath(); ctx.arc(x, y, r * 1.18, 0, TAU); ctx.fill();
  ctx.fillStyle = rad(ctx, x, y, 0, r, [[0, lighten(col, 0.55)], [0.5, col], [1, darken(col, 0.5)]], x - r * 0.3, y - r * 0.35); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba(lighten(col, 0.7), 0.5); ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.1); ctx.lineTo(x, y - r * 0.85); ctx.lineTo(x + r * 0.55, y - r * 0.15); ctx.lineTo(x, y + r * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.38, Math.max(0.5, r * 0.2), 0, TAU); ctx.fill();
}
// a gold setting (petalled rosette) around a gem
export function rosette(ctx, x, y, r, col, petals = 6, pearlsOn = true) {
  ctx.fillStyle = goldFill(ctx, x - r, y - r, x + r, y + r);
  for (let i = 0; i < petals; i++) { const a = (i / petals) * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78, r * 0.42, 0, TAU); ctx.fill(); }
  ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,10,0.7)'; ctx.lineWidth = 0.6; ctx.stroke();
  if (pearlsOn) for (let i = 0; i < petals; i++) { const a = ((i + 0.5) / petals) * TAU; pearl(ctx, x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, r * 0.17); }
  gem(ctx, x, y, r * 0.5, col);
}
// a string of beads along a quadratic curve
export function beads(ctx, x0, y0, cx, cy, x1, y1, n, r, colors) {
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1, y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1, c = colors[i % colors.length];
    if (c === 'pearl') pearl(ctx, x, y, r); else gem(ctx, x, y, r * 0.9, c);
  }
}
// gold bangle stack across a limb at (0,y): count bands of width w
export function bangles(ctx, y, w, count, pearls = false) {
  for (let i = 0; i < count; i++) {
    const yy = y + i * 2.6;
    ctx.fillStyle = pearls && i % 2 ? '#efe6d6' : goldFill(ctx, -w / 2, yy, w / 2, yy + 2);
    ctx.beginPath(); ctx.ellipse(0, yy, w / 2 + 0.6, 1.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(90,50,8,0.6)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,230,0.8)'; ctx.fillRect(-w * 0.16, yy - 0.9, w * 0.26, 0.7);
  }
}
export function flower(ctx, x, y, r, col, core) {
  ctx.fillStyle = col;
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.42, r * 0.26, a, 0, TAU); ctx.fill(); }
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, r * 0.24, 0, TAU); ctx.fill();
}
// A patterned border strip filling the rectangle (x, y, w, h) with repeating gold diamonds.
export function borderStrip(ctx, x, y, w, h, base, motif = '#f6cf6a') {
  ctx.fillStyle = lin(ctx, 0, y, 0, y + h, [[0, lighten(base, 0.1)], [1, darken(base, 0.25)]]); ctx.fillRect(x, y, w, h);
  ctx.fillStyle = goldFill(ctx, 0, y, 0, y + h); ctx.fillRect(x, y, w, Math.max(1, h * 0.14)); ctx.fillRect(x, y + h * 0.86, w, Math.max(1, h * 0.14));
  ctx.fillStyle = motif; const step = h * 0.95;
  for (let px = x + step / 2; px < x + w; px += step) { ctx.beginPath(); ctx.moveTo(px, y + h * 0.26); ctx.lineTo(px + step * 0.32, y + h / 2); ctx.lineTo(px, y + h * 0.74); ctx.lineTo(px - step * 0.32, y + h / 2); ctx.fill(); }
}
// a soft additive glow used to bake rim-light into sprites
export function glowEdge(ctx, x, y, r, rgb, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }

// ---- tapered ink strokes -------------------------------------------------------------------------------
// bez(P): point-on-cubic function for P = [x0,y0, c1x,c1y, c2x,c2y, x3,y3]; quad(P) for a quadratic [x0,y0,cx,cy,x1,y1]
export const bez = (P) => (t) => { const u = 1 - t; return [u * u * u * P[0] + 3 * u * u * t * P[2] + 3 * u * t * t * P[4] + t * t * t * P[6], u * u * u * P[1] + 3 * u * u * t * P[3] + 3 * u * t * t * P[5] + t * t * t * P[7]]; };
export const quad = (P) => (t) => { const u = 1 - t; return [u * u * P[0] + 2 * u * t * P[2] + t * t * P[4], u * u * P[1] + 2 * u * t * P[3] + t * t * P[5]]; };
// join two point functions end to end; k = where the first one ends (0..1)
export const chain = (a, b, k) => (t) => (t < k ? a(t / k) : b((t - k) / (1 - k)));
// width profiles: peak(k) swells to full width at t = k and tapers to nothing at both ends;
// head(k) = a thick rounded head that thins into a long fine tail (a brow); fade = full -> nothing
export const peak = (k) => (t) => (t <= k ? Math.sin((t / k) * Math.PI / 2) : Math.cos(((t - k) / (1 - k)) * Math.PI / 2));
export const head = (k, tail = 0.12) => (t) => (t <= k ? Math.sqrt(t / k) : 1 - (1 - tail) * ((t - k) / (1 - k)));
export const fade = (t) => 1 - t;
// ink(g, pt, wMax, col, prof): fill the ribbon around the curve pt(t) whose half-width is wMax * prof(t) / 2
export function ink(g, pt, wMax, col, prof = peak(0.5), n = 26) {
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = pt(t), q = pt(Math.min(1, t + 0.02)), r = pt(Math.max(0, t - 0.02));
    const dx = q[0] - r[0], dy = q[1] - r[1], l = Math.hypot(dx, dy) || 1, w = wMax * Math.max(0, prof(t)) * 0.5;
    L.push([p[0] - dy / l * w, p[1] + dx / l * w]); R.push([p[0] + dy / l * w, p[1] - dx / l * w]);
  }
  g.fillStyle = col; g.beginPath(); g.moveTo(L[0][0], L[0][1]);
  for (const p of L) g.lineTo(p[0], p[1]); for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
  g.closePath(); g.fill();
}

