// Painting the bonsai: wall and light, shelf, glazed pots, bark with lit edges, foliage sprites that change with the season, wire, buds, forecast.
// All canvas 2D, no external assets. Drawing only reads the tree; nothing here changes game state.
import { geo, seasonIdx, UP } from './tree.js';
import { SPECIES, SEASON, YEAR, GROW, POTS } from './species.js';

export const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c, f) => [Math.max(0, Math.min(255, c[0] * f)), Math.max(0, Math.min(255, c[1] * f)), Math.max(0, Math.min(255, c[2] * f))];
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const hasOff = typeof OffscreenCanvas !== 'undefined';
const mkc = (w, h) => new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
function lcg(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

// ---- season state --------------------------------------------------------------------------------------------------------
// Leaf colour and fullness (0..1) for species `sp` at year time yt (seconds into the year).
export function leafState(sp, yt) {
  const s = Math.min(3, Math.floor(yt / SEASON)), p = (yt % SEASON) / SEASON, c = sp.col;
  if (s === 0) return { col: mix(mix(c.spring, [210, 230, 150], 0.18), c.summer, ease(p) * 0.6), full: sp.evergreen ? 1 : 0.28 + 0.72 * ease(clamp01(p * 1.5)), new: 1 - p };
  if (s === 1) return { col: mix(mix(c.spring, c.summer, 0.7), c.summer, ease(p)), full: 1, new: 0.1 };
  if (s === 2) { const q = ease(clamp01(p * 1.4)); return { col: mix(c.summer, c.autumn, sp.evergreen ? 0 : q), full: sp.evergreen ? 1 : 1 - 0.45 * clamp01((p - 0.45) / 0.55), new: 0 }; }
  return { col: mix(c.autumn, c.winter, sp.evergreen ? 1 : ease(clamp01(p * 3))), full: sp.evergreen ? 1 : 0.55 * (1 - ease(clamp01(p * 3))), new: 0 };
}
// Look of the room through the year: wall tint, light colour, light strength.
const ROOM = [
  { wall: [244, 232, 216], deep: [214, 196, 176], light: [255, 244, 226], g: 0.5 },   // spring
  { wall: [248, 238, 214], deep: [222, 202, 168], light: [255, 242, 208], g: 0.62 },  // summer
  { wall: [238, 214, 178], deep: [196, 160, 120], light: [255, 220, 160], g: 0.6 },   // autumn
  { wall: [214, 220, 226], deep: [168, 176, 190], light: [230, 238, 252], g: 0.42 },  // winter
];
export function room(yt) {
  const s = Math.min(3, Math.floor(yt / SEASON)), p = (yt % SEASON) / SEASON, a = ROOM[s], b = ROOM[(s + 1) % 4], t = ease(clamp01((p - 0.6) / 0.4));
  return { wall: mix(a.wall, b.wall, t), deep: mix(a.deep, b.deep, t), light: mix(a.light, b.light, t), g: a.g + (b.g - a.g) * t };
}

// ---- backdrop -----------------------------------------------------------------------------------------------------------------
export function drawRoom(ctx, r, yt, t = 0) {
  const R = room(yt);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, rgb(shade(R.wall, 1.03))); g.addColorStop(0.7, rgb(R.wall)); g.addColorStop(1, rgb(R.deep));
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  // paper screen (shoji): faint grid of panels with light coming through from the upper left
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const gl = ctx.createRadialGradient(r.x + r.w * 0.18, r.y + r.h * 0.12, 10, r.x + r.w * 0.18, r.y + r.h * 0.12, Math.max(r.w, r.h) * 0.95);
  gl.addColorStop(0, rgb(R.light, 0.85 * R.g + 0.15)); gl.addColorStop(0.45, rgb(R.light, 0.22)); gl.addColorStop(1, rgb(R.light, 0));
  ctx.fillStyle = gl; ctx.fillRect(r.x, r.y, r.w, r.h);
  const cw = Math.max(90, r.w / 5), step = cw;
  ctx.strokeStyle = rgb(shade(R.deep, 0.7), 0.16); ctx.lineWidth = 3;
  for (let x = r.x + ((r.w % step) / 2); x < r.x + r.w; x += step) { ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h * 0.84); ctx.stroke(); }
  for (let y = r.y + step * 0.6; y < r.y + r.h * 0.84; y += step * 1.2) { ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke(); }
  // soft vignette
  const v = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.5, Math.min(r.w, r.h) * 0.3, r.x + r.w / 2, r.y + r.h * 0.5, Math.max(r.w, r.h) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,24,10,0.22)'); ctx.fillStyle = v; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  void t;
}

// The wooden shelf the pot stands on: a slab in world coordinates at y = top.
export function drawShelfBoard(ctx, cx, top, halfW, yt) {
  const R = room(yt), w = halfW * 2, h = 46;
  const g = ctx.createLinearGradient(0, top, 0, top + h); g.addColorStop(0, '#9b7048'); g.addColorStop(0.18, '#845a38'); g.addColorStop(1, '#4e3320');
  ctx.fillStyle = g; ctx.fillRect(cx - halfW, top, w, h);
  ctx.fillStyle = rgb(R.light, 0.38 * R.g + 0.1); ctx.fillRect(cx - halfW, top, w, 3.4);
  ctx.strokeStyle = 'rgba(40,22,10,0.35)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) { const y = top + 8 + i * 4.3; ctx.beginPath(); ctx.moveTo(cx - halfW, y); ctx.bezierCurveTo(cx - halfW * 0.4, y + 2, cx + halfW * 0.3, y - 2, cx + halfW, y + 1); ctx.stroke(); }
  ctx.fillStyle = 'rgba(30,16,6,0.45)'; ctx.fillRect(cx - halfW, top + h, w, 6);
}

// ---- pots ------------------------------------------------------------------------------------------------------------------------
function body(ctx, kind, w, d) {
  const h = w / 2;
  ctx.beginPath();
  if (kind === 'oval') { ctx.moveTo(-h * 0.96, 0); ctx.bezierCurveTo(-h * 1.02, d * 0.7, -h * 0.7, d, 0, d); ctx.bezierCurveTo(h * 0.7, d, h * 1.02, d * 0.7, h * 0.96, 0); }
  else if (kind === 'round') { ctx.moveTo(-h * 0.98, 0); ctx.bezierCurveTo(-h * 1.0, d * 0.9, -h * 0.5, d * 1.05, 0, d * 1.02); ctx.bezierCurveTo(h * 0.5, d * 1.05, h * 1.0, d * 0.9, h * 0.98, 0); }
  else if (kind === 'tall') { ctx.moveTo(-h * 0.9, 0); ctx.lineTo(-h * 0.78, d * 0.92); ctx.quadraticCurveTo(-h * 0.76, d, -h * 0.6, d); ctx.lineTo(h * 0.6, d); ctx.quadraticCurveTo(h * 0.76, d, h * 0.78, d * 0.92); ctx.lineTo(h * 0.9, 0); }
  else if (kind === 'drum') { ctx.moveTo(-h, 0); ctx.lineTo(-h * 0.94, d * 0.92); ctx.quadraticCurveTo(-h * 0.93, d, -h * 0.82, d); ctx.lineTo(h * 0.82, d); ctx.quadraticCurveTo(h * 0.93, d, h * 0.94, d * 0.92); ctx.lineTo(h, 0); }
  else if (kind === 'slab') { ctx.moveTo(-h, 0); ctx.lineTo(-h, d * 0.8); ctx.quadraticCurveTo(-h, d, -h * 0.94, d); ctx.lineTo(h * 0.94, d); ctx.quadraticCurveTo(h, d, h, d * 0.8); ctx.lineTo(h, 0); }
  else { ctx.moveTo(-h, 0); ctx.lineTo(-h * 0.92, d * 0.9); ctx.quadraticCurveTo(-h * 0.9, d, -h * 0.78, d); ctx.lineTo(h * 0.78, d); ctx.quadraticCurveTo(h * 0.9, d, h * 0.92, d * 0.9); ctx.lineTo(h, 0); }
  ctx.closePath();
}
// Pot with its soil surface at y = 0 and rim centre x = 0. Draws the back half of the soil too so the trunk can stand in it.
export function drawPotBack(ctx, pot, yt) {
  const w = pot.w, h = w / 2, R = room(yt);
  const soil = ctx.createLinearGradient(0, -9, 0, 6); soil.addColorStop(0, '#5a4636'); soil.addColorStop(1, '#2f2218');
  ctx.fillStyle = soil; ctx.beginPath(); ctx.ellipse(0, -2, h * 0.94, 8.5, 0, 0, Math.PI * 2); ctx.fill();
  void R;
}
export function drawPot(ctx, pot, yt, tree = null) {
  const w = pot.w, d = pot.d, h = w / 2, R = room(yt), gc = pot.glaze, rc = pot.rim;
  // contact shadow on the shelf
  ctx.save(); ctx.fillStyle = 'rgba(30,16,6,0.34)'; ctx.beginPath(); ctx.ellipse(10, d + 3, h * 0.95, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // feet
  if (pot.kind !== 'slab' && pot.kind !== 'tall') { ctx.fillStyle = rgb(shade(gc, 0.55)); ctx.fillRect(-h * 0.7, d - 1, 20, 8); ctx.fillRect(h * 0.7 - 20, d - 1, 20, 8); }
  ctx.save(); body(ctx, pot.kind, w, d);
  const lg = ctx.createLinearGradient(-h, 0, h, 0); lg.addColorStop(0, rgb(shade(gc, 1.18))); lg.addColorStop(0.28, rgb(shade(gc, 1.05))); lg.addColorStop(0.72, rgb(shade(gc, 0.82))); lg.addColorStop(1, rgb(shade(gc, 0.58)));
  ctx.fillStyle = lg; ctx.fill(); ctx.clip();
  // glaze: darker drip toward the foot, window sheen on the upper left, fired speckles
  const vg = ctx.createLinearGradient(0, 0, 0, d); vg.addColorStop(0, 'rgba(255,255,255,0.08)'); vg.addColorStop(0.55, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = vg; ctx.fillRect(-h, 0, w, d + 4);
  const sh = ctx.createLinearGradient(-h * 0.8, 0, -h * 0.35, 0); sh.addColorStop(0, rgb(R.light, 0)); sh.addColorStop(0.45, rgb(R.light, 0.35 * R.g + 0.1)); sh.addColorStop(1, rgb(R.light, 0)); ctx.fillStyle = sh; ctx.fillRect(-h, 0, w, d);
  const rnd = lcg(pot.w * 7 + pot.d); ctx.fillStyle = 'rgba(30,18,10,0.22)'; for (let i = 0; i < 46; i++) { ctx.beginPath(); ctx.arc((rnd() - 0.5) * w * 0.9, rnd() * d, 0.6 + rnd() * 1.1, 0, 7); ctx.fill(); }
  if (pot.kind === 'drum' || pot.kind === 'tall') { ctx.fillStyle = rgb(rc, 0.9); ctx.fillRect(-h, d * 0.12, w, 4); ctx.fillRect(-h, d * 0.82, w, 4); }
  ctx.restore();
  // rim lip
  ctx.save(); ctx.lineWidth = 6.5; ctx.lineCap = 'round'; ctx.strokeStyle = rgb(rc); ctx.beginPath(); ctx.moveTo(-h, 1); ctx.lineTo(h, 1); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = rgb(R.light, 0.6); ctx.beginPath(); ctx.moveTo(-h + 4, -1.4); ctx.lineTo(h * 0.2, -1.4); ctx.stroke();
  ctx.restore();
  void tree;
}
// Front half of the soil: moss, pebbles. Drawn after the trunk base so the trunk seems planted.
export function drawSoilFront(ctx, pot, yt, seed = 3) {
  const h = pot.w / 2, rnd = lcg(seed + pot.w);
  const g = ctx.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, '#6d6a3a'); g.addColorStop(1, '#3c4020');
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, -1.5, h * 0.92, 7, 0, 0, Math.PI); ctx.lineTo(h * 0.92, -2.5); ctx.ellipse(0, -2.5, h * 0.92, 5, 0, 0, Math.PI, true); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  for (let i = 0; i < 70; i++) { const a = rnd() * Math.PI, rr = 0.15 + rnd() * 0.8; const x = Math.cos(a) * h * 0.9 * rr * (rnd() < 0.5 ? 1 : -1), y = -3 + Math.sin(a) * 5 * rr; ctx.fillStyle = `rgba(${90 + rnd() * 50 | 0},${120 + rnd() * 60 | 0},${40 + rnd() * 30 | 0},0.8)`; ctx.beginPath(); ctx.arc(x, y, 1.2 + rnd() * 2.2, 0, 7); ctx.fill(); }
  for (let i = 0; i < 6; i++) { const x = (rnd() - 0.5) * h * 1.5, y = -1 + rnd() * 3; ctx.fillStyle = `rgb(${120 + rnd() * 40 | 0},${112 + rnd() * 30 | 0},${100 + rnd() * 30 | 0})`; ctx.beginPath(); ctx.ellipse(x, y, 2.4 + rnd() * 2, 1.6, 0, 0, 7); ctx.fill(); }
  void yt;
}

// ---- foliage sprites -------------------------------------------------------------------------------------------------------------
const sprites = new Map();
function leafShape(g, kind, x, y, s, a) {
  g.save(); g.translate(x, y); g.rotate(a);
  if (kind === 'maple') {
    g.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? s * 0.38 : s, an = (k * Math.PI) / 5 - Math.PI / 2; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.closePath(); g.fill();
  } else if (kind === 'needle') {
    g.lineWidth = Math.max(0.8, s * 0.12); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(k * 0.22) * s * 1.7, -Math.cos(k * 0.22) * s * 1.7); g.stroke(); }
  } else if (kind === 'scale') {
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.9, -s * 0.5, s * 1.9, -s * 0.2); g.quadraticCurveTo(s * 0.9, s * 0.35, 0, 0); g.fill();
  } else { g.beginPath(); g.ellipse(0, 0, s * 0.9, s * 0.5, 0, 0, 7); g.fill(); }
  g.restore();
}
function bakeSprite(sp, col, variant, big) {
  const S = big ? 192 : 128, c = mkc(S, S), g = c.getContext('2d'), rnd = lcg(variant * 977 + 13), cx = S / 2, cy = S / 2, R = S * 0.46;
  const kind = sp.leaf, n = kind === 'maple' ? 46 : kind === 'small' ? 120 : kind === 'needle' ? 38 : 90, ls = kind === 'maple' ? S * 0.085 : kind === 'small' ? S * 0.045 : kind === 'needle' ? S * 0.085 : S * 0.06;
  // dark underside mass gives the cloud depth
  const sh = g.createRadialGradient(cx + R * 0.12, cy + R * 0.2, R * 0.1, cx, cy, R); sh.addColorStop(0, rgb(shade(col, 0.45), 0.95)); sh.addColorStop(0.85, rgb(shade(col, 0.5), 0.9)); sh.addColorStop(1, rgb(shade(col, 0.5), 0));
  g.fillStyle = sh; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
  const pts = []; for (let i = 0; i < n; i++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * R * 0.92; pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.92, a]); }
  pts.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]) + (rnd() - 0.5) * 20);   // paint lower-right first, then upper-left on top
  for (const [x, y, a] of pts) {
    const lit = clamp01(0.5 + ((cx - x) * 0.6 + (cy - y) * 0.8) / (R * 1.5)), j = 0.86 + rnd() * 0.28;
    const c2 = shade(mix(col, [255, 250, 200], 0.28 * lit * lit), 0.55 + 0.6 * lit);
    g.fillStyle = rgb([c2[0] * j, c2[1] * j, c2[2] * j]); g.strokeStyle = g.fillStyle; leafShape(g, kind, x, y, ls * (0.85 + rnd() * 0.4), kind === 'needle' ? (rnd() - 0.5) * 2.2 + (y - cy) * 0.004 : a);
  }
  // soft rim light, upper left
  const hl = g.createRadialGradient(cx - R * 0.42, cy - R * 0.45, 2, cx - R * 0.3, cy - R * 0.3, R * 0.7); hl.addColorStop(0, 'rgba(255,255,225,0.22)'); hl.addColorStop(1, 'rgba(255,255,225,0)');
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = hl; g.fillRect(0, 0, S, S); g.globalCompositeOperation = 'source-over';
  return c;
}
function spriteFor(spId, col, variant, big) {
  if (!hasOff) return null;
  const key = spId + ':' + (col[0] >> 3) + ':' + (col[1] >> 3) + ':' + (col[2] >> 3) + ':' + variant + (big ? 'b' : '');
  let s = sprites.get(key);
  if (!s) { if (sprites.size > 360) sprites.clear(); s = bakeSprite(SPECIES[spId], col, variant, big); sprites.set(key, s); }
  return s;
}

// ---- bark ---------------------------------------------------------------------------------------------------------------------------
function limbWidths(L) {
  const n = L.segs.length, w = [];
  for (let i = 0; i <= n; i++) w.push((i < n ? L.segs[i].th : L.segs[n - 1].th * 0.55) * 0.5);
  return w;
}
function ribbon(ctx, pts, w, off = 0, scale = 1, lx = -0.6, ly = -0.8) {
  const n = pts.length, Lp = [], Rp = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    let nx = -dy, ny = dx; const sgn = nx * lx + ny * ly >= 0 ? 1 : -1;     // normal facing the light
    const ww = w[i] * scale, o = off * w[i] * sgn;
    Lp.push([pts[i].x + nx * (ww + o), pts[i].y + ny * (ww + o)]); Rp.push([pts[i].x - nx * (ww - o), pts[i].y - ny * (ww - o)]);
  }
  ctx.beginPath(); ctx.moveTo(Lp[0][0], Lp[0][1]);
  for (let i = 1; i < n; i++) { const mx = (Lp[i - 1][0] + Lp[i][0]) / 2, my = (Lp[i - 1][1] + Lp[i][1]) / 2; ctx.quadraticCurveTo(Lp[i - 1][0], Lp[i - 1][1], mx, my); }
  ctx.lineTo(Lp[n - 1][0], Lp[n - 1][1]); ctx.lineTo(Rp[n - 1][0], Rp[n - 1][1]);
  for (let i = n - 1; i >= 1; i--) { const mx = (Rp[i - 1][0] + Rp[i][0]) / 2, my = (Rp[i - 1][1] + Rp[i][1]) / 2; ctx.quadraticCurveTo(Rp[i][0], Rp[i][1], mx, my); }
  ctx.lineTo(Rp[0][0], Rp[0][1]); ctx.closePath();
}
function drawLimbBark(ctx, L, sp, T, opt) {
  const pts = L.g.pts, w = limbWidths(L), thin = L.segs[0].th < 2.6;
  const bark = L.ord === 0 || L.segs[0].th > 3.4 ? sp.bark : mix(sp.bark, sp.twig, 0.55);
  const dim = opt.back ? 0.62 : 1;
  ribbon(ctx, pts, w); ctx.fillStyle = rgb(shade(bark, 0.62 * dim)); ctx.fill();
  ribbon(ctx, pts, w, 0.34, 0.66); ctx.fillStyle = rgb(shade(bark, 1.02 * dim)); ctx.fill();
  if (!thin) { ribbon(ctx, pts, w, 0.55, 0.24); ctx.fillStyle = rgb(shade(mix(bark, [255, 236, 200], 0.22), 1.12 * dim), 0.6); ctx.fill(); }
  // bark fissures along thick limbs
  if (L.segs[0].th > 4.4) {
    ctx.save(); ctx.strokeStyle = rgb(shade(bark, 0.34), 0.5); ctx.lineWidth = 0.9; const rnd = lcg(L.id * 31 + 7);
    for (let k = 0; k < 5; k++) { const o = (rnd() - 0.5) * 1.3; ctx.beginPath(); for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, ww = w[i] * 0.85 * o + Math.sin(i * 1.7 + k) * 0.8; ctx.lineTo(a.x + nx * ww, a.y + ny * ww); } ctx.stroke(); }
    ctx.restore();
  }
  // soft growing tip: fresh green-tinted
  if (L.tip && T.t < 20) { const n = L.segs.length, a = pts[n - 1], b = pts[n]; const gt = ctx.createLinearGradient(a.x, a.y, b.x, b.y); gt.addColorStop(0, 'rgba(160,190,90,0)'); gt.addColorStop(1, 'rgba(160,196,92,0.85)'); ctx.strokeStyle = gt; ctx.lineWidth = Math.max(1.4, w[n - 1] * 1.1); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  if (L.scar && L.cm) { const e = pts[pts.length - 1], r = Math.max(1.5, w[w.length - 1] * 1.05); ctx.fillStyle = 'rgb(232,206,160)'; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(80,50,30,0.7)'; ctx.lineWidth = 0.9; ctx.stroke(); }
}
function drawBase(ctx, T, sp) {
  const L = T.limbs[0], th = L.segs[0].th, w = th * 0.5;
  const flare = (s) => { ctx.beginPath(); ctx.moveTo(-w * 0.9 * s, -th * 1.2); ctx.bezierCurveTo(-w * 1.5 * s, -w * 0.4, -w * 2.4 * s, 1.5, -w * 3.4 * s, 2); ctx.lineTo(-w * 3.4 * s, 3.6); ctx.bezierCurveTo(-w * 2.2 * s, 4.6, -w * 0.8 * s, 1, 0, 2.5); ctx.closePath(); };
  ctx.save(); ctx.fillStyle = rgb(shade(sp.bark, 0.78));
  flare(1); ctx.fill(); ctx.scale(-1, 1); flare(0.85); ctx.fill(); ctx.restore();
}

// ---- the whole tree -------------------------------------------------------------------------------------------------------------------
// o: { yt, forecast, mode ('all'|...), pulse, season override { col, full } }
export function drawTree(ctx, T, o = {}) {
  const sp = SPECIES[T.species], G = geo(T), yt = o.yt ?? T.t, ls = o.leaf ?? leafState(sp, yt);
  const back = (L) => L.ord > 0 && L.id % 3 === 0;
  drawBase(ctx, T, sp);
  // back pass: limbs behind the trunk and their foliage
  for (const L of T.limbs) if (back(L)) drawLimbBark(ctx, L, sp, T, { back: true });
  drawPads(ctx, T, G, sp, ls, (p) => back(G.by.get(p.limb)), 0.82);
  for (const L of T.limbs) if (!back(L)) { drawLimbBark(ctx, L, sp, T, {}); }
  // smoothing discs where limbs leave their parent
  for (const L of T.limbs) if (L.par >= 0 && !back(L)) { const p = L.g.pts[0], r = L.segs[0].th * 0.52; ctx.fillStyle = rgb(shade(mix(sp.bark, sp.twig, 0.4), 0.85)); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); }
  if (o.wires !== false) drawWires(ctx, T, sp, o.t ?? 0);
  if (o.buds !== false) drawBuds(ctx, T, o.budPulse ?? 0, yt);
  drawPads(ctx, T, G, sp, ls, (p) => !back(G.by.get(p.limb)), 1);
}
function drawPads(ctx, T, G, sp, ls, pick, alpha) {
  if (ls.full < 0.04) return;
  const fs = Math.pow(ls.full, 0.7);
  ctx.save(); ctx.globalAlpha = alpha;
  const sorted = G.pads.filter(pick);
  for (const p of sorted) {
    const r = p.r * fs * (p.soft ? 0.78 : 1), v = (p.limb * 5 + p.seg) % 4, tint = p.soft && ls.new > 0.05 ? mix(ls.col, [190, 220, 120], 0.45 * ls.new) : ls.col;
    const spr = spriteFor(T.species, tint, v, r > 30);
    if (spr) { ctx.drawImage(spr, p.x - r * 1.18, p.y - r * 1.18, r * 2.36, r * 2.36); }
    else { const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r); g.addColorStop(0, rgb(shade(tint, 1.2))); g.addColorStop(1, rgb(shade(tint, 0.5))); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); }
  }
  ctx.restore();
  void sp;
}
function drawBuds(ctx, T, pulse, yt) {
  const s = Math.min(3, Math.floor(yt / SEASON));
  for (const L of T.limbs) L.segs.forEach((sg, i) => {
    if (!sg.b) return;
    const p = L.g.pts[i + 1], a = L.g.ang[i] + sg.bs * 1.15, x = p.x + Math.cos(a) * (sg.th * 0.45 + 2), y = p.y + Math.sin(a) * (sg.th * 0.45 + 2), r = 1.9 + pulse * 1.4 + (s === 3 ? 0.6 : 0);
    ctx.fillStyle = s === 0 ? 'rgb(176,210,110)' : 'rgb(214,190,150)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(70,44,24,0.8)'; ctx.lineWidth = 0.8; ctx.stroke();
  });
}
function drawWires(ctx, T, sp, t) {
  for (const L of T.limbs) {
    const w = L.wire; if (!w) continue;
    const a = w.s, b = Math.min(L.segs.length, w.s + 3 + 1);
    ctx.save(); ctx.lineCap = 'round';
    const path = () => { ctx.beginPath(); for (let i = a; i <= b; i++) { const p = L.g.pts[i]; if (!p) break; if (i === a) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); } };
    const thick = Math.max(...L.segs.slice(a, b).map((s) => s.th), 1.5) + 1.6;
    path(); ctx.strokeStyle = 'rgba(70,32,10,0.9)'; ctx.lineWidth = thick + 1.6; ctx.setLineDash([2.4, 3.6]); ctx.stroke();
    path(); ctx.strokeStyle = w.bite ? 'rgb(200,90,70)' : 'rgb(222,142,70)'; ctx.lineWidth = thick; ctx.setLineDash([2.2, 3.8]); ctx.stroke();
    path(); ctx.strokeStyle = 'rgba(255,224,170,0.85)'; ctx.lineWidth = Math.max(0.8, thick * 0.34); ctx.setLineDash([1.4, 4.6]); ctx.lineDashOffset = -1; ctx.stroke();
    ctx.setLineDash([]);
    // set meter: amber ring until the bend has set, green when set, red when it is about to bite
    const mid = L.g.pts[Math.min(L.segs.length, a + 1)], frac = Math.min(1, w.age / 6), red = w.age > 11;
    if (!w.end) {
      const rr = thick + 5.5; ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(40,24,10,0.5)'; ctx.beginPath(); ctx.arc(mid.x, mid.y, rr, 0, 7); ctx.stroke();
      ctx.strokeStyle = w.bite ? 'rgb(214,70,60)' : red ? 'rgb(228,120,60)' : w.set ? 'rgb(100,190,110)' : 'rgb(236,184,70)';
      ctx.beginPath(); ctx.arc(mid.x, mid.y, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (w.set ? 1 : Math.max(0.06, frac))); ctx.stroke();
    }
    ctx.restore();
  }
  void t; void sp;
}

// Faint dotted lines showing where each growing tip is heading by the end of the season.
export function drawForecast(ctx, T, speciesId, alpha = 0.55) {
  const sp = SPECIES[speciesId], si = seasonIdx(T); if (GROW[si] <= 0.01) return;
  const sLeft = SEASON - (T.t % SEASON), tips = T.limbs.filter((L) => L.tip).length, res = 1 / Math.pow(1 + tips / 20, 0.55);
  ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash([2, 6]); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  for (const L of T.limbs) {
    if (!L.tip) continue;
    const n = L.segs.length, p = L.g.pts[n], ang = L.g.ang[n - 1], len = Math.min(70, sp.rate * res * GROW[si] * sLeft * (L.ord === 0 ? 1 : 0.8)), up = (L.ord === 0 ? UP : UP + L.side * 0.95) - ang;
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    const steps = 4; let x = p.x, y = p.y, a = ang; for (let i = 0; i < steps; i++) { a += Math.atan2(Math.sin(up), Math.cos(up)) * 0.05; x += Math.cos(a) * len / steps; y += Math.sin(a) * len / steps; ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// A limb outline (used for fallen cuttings and the "this will be removed" tint).
export function strokePoly(ctx, pts, widths, color, alpha = 1) {
  if (pts.length < 2) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < pts.length - 1; i++) { ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = Math.max(1.2, (widths[Math.min(i, widths.length - 1)] ?? 2)); ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y); ctx.stroke(); }
  ctx.restore();
}

// A silhouette of a saved tree (shelf thumbnails): { l: [{p:[[x,y]...], w:[...]}], d: [[x,y,r]...] }
export function drawSnap(ctx, snap, cx, by, k, col = [60, 100, 70], bark = [90, 66, 48]) {
  ctx.save(); ctx.translate(cx, by); ctx.scale(k, k); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const l of snap.l) { for (let i = 0; i < l.p.length - 1; i++) { ctx.strokeStyle = rgb(bark); ctx.lineWidth = Math.max(1.2, l.w[Math.min(i, l.w.length - 1)]); ctx.beginPath(); ctx.moveTo(l.p[i][0], l.p[i][1]); ctx.lineTo(l.p[i + 1][0], l.p[i + 1][1]); ctx.stroke(); } }
  for (const d of snap.d) { const g = ctx.createRadialGradient(d[0] - d[2] * 0.3, d[1] - d[2] * 0.3, d[2] * 0.1, d[0], d[1], d[2]); g.addColorStop(0, rgb(shade(col, 1.25))); g.addColorStop(1, rgb(shade(col, 0.55))); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d[0], d[1], d[2], 0, 7); ctx.fill(); }
  ctx.restore();
}
export function snapOf(T) {
  const G = geo(T);
  return { l: T.limbs.map((L) => ({ p: L.g.pts.map((p) => [Math.round(p.x), Math.round(p.y)]), w: L.segs.map((s) => Math.round(s.th * 10) / 10) })), d: G.pads.map((p) => [Math.round(p.x), Math.round(p.y), Math.round(p.r)]), b: [G.bounds.x0, G.bounds.y0, G.bounds.x1, G.bounds.y1].map(Math.round) };
}
export const POT_LIST = POTS;
void YEAR;
