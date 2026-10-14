// Drawing primitives for the winter village green: sky, spruce forest, log houses, birch trees, fence, snow, the painted town square,
// painted pins and the bat. Everything is lit geometry projected through the one fixed camera (view.js). Pure drawing, no state.
import { SQ, BOUNDS, PIN_R, LIE_R, PIN_LEN, BAT_HL, BAT_R } from './sim.js';

const TAU = Math.PI * 2;
export const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

// ---- host (off-screen surfaces) ---------------------------------------------------------------------------------
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
export const canBake = () => typeof OffscreenCanvas !== 'undefined' || hostDoc !== null;
export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
}

export const PAL = {
  red: '#c8312b', redDark: '#8f1d1a', gold: '#e8b84a', goldHi: '#ffe08a', wood: '#e6bd78', woodDark: '#9a6a34', ink: '#2a1d16',
  snow: '#f4f8fc', ice: '#cfe0ee', spruce: '#2c4752', pine: '#2a5b4a',
};
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };

// ---- the backdrop -------------------------------------------------------------------------------------------------------
function sky(ctx, cam, W, H) {
  const hy = cam.P(0, 0, 90)[1];
  const g = ctx.createLinearGradient(0, 0, 0, hy);
  g.addColorStop(0, '#86b2dc'); g.addColorStop(0.62, '#cfe1f0'); g.addColorStop(1, '#fbefdc');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, hy + 2);
  // low sun with a halo
  const sx = W * 0.22, sy = hy - Math.max(30, (hy) * 0.22), r = Math.max(26, Math.min(W, H) * 0.045);
  const h = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 4.5);
  h.addColorStop(0, 'rgba(255,244,214,0.95)'); h.addColorStop(0.25, 'rgba(255,236,190,0.5)'); h.addColorStop(1, 'rgba(255,236,190,0)');
  ctx.fillStyle = h; ctx.fillRect(sx - r * 5, sy - r * 5, r * 10, r * 10);
  ctx.beginPath(); ctx.arc(sx, sy, r * 0.7, 0, TAU); ctx.fillStyle = '#fff6dc'; ctx.fill();
  // thin clouds
  const rnd = lcg(11);
  for (let i = 0; i < 6; i++) {
    const x = rnd() * W, y = hy * (0.12 + rnd() * 0.5), w = W * (0.18 + rnd() * 0.25), hh = 8 + rnd() * 12;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(x, y, w / 2, hh, 0, 0, TAU); ctx.fill();
  }
  return hy;
}

function spruce(ctx, x, base, h, w, c1, c2) {
  ctx.fillStyle = c1;
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4, t1 = (i + 1.35) / 4;
    const yb = base - h * t0 * 0.8, yt = base - h * Math.min(1, t1 * 0.8 + 0.12);
    const hw = w * (0.5 - t0 * 0.3);
    ctx.beginPath(); ctx.moveTo(x - hw, yb); ctx.lineTo(x, yt); ctx.lineTo(x + hw, yb); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = c2;   // a light edge of snow
  ctx.beginPath(); ctx.moveTo(x, base - h); ctx.lineTo(x + w * 0.18, base - h * 0.62); ctx.lineTo(x, base - h * 0.66); ctx.closePath(); ctx.fill();
}

// One belt of spruce trees standing at depth z (far belts are paler: hazy winter air).
function forest(ctx, cam, W, z, col, tall, seed) {
  const rnd = lcg(seed), k = cam.k(z), base = cam.P(0, 0, z)[1];
  const x0 = cam.P(-9, 0, z)[0], x1 = cam.P(9, 0, z)[0];
  for (let x = Math.min(-30, x0); x < Math.max(W + 30, x1); x += 0.95 * k * (0.7 + rnd() * 0.6)) {
    const h = tall * (0.75 + rnd() * 0.5) * k, w = h * 0.46;
    spruce(ctx, x, base + 6, h, w, col, 'rgba(255,255,255,0.7)');
  }
}

function house(ctx, cam, x, z, wM, hM, palette) {
  const k = cam.k(z), L = x - wM / 2, R = x + wM / 2;
  const bl = cam.P(L, 0, z), br = cam.P(R, 0, z), tl = cam.P(L, hM, z), tr = cam.P(R, hM, z);
  const ridge = cam.P(x, hM + wM * 0.34, z), eL = cam.P(L - 0.22, hM - 0.05, z), eR = cam.P(R + 0.22, hM - 0.05, z);
  // walls with log lines
  ctx.fillStyle = palette.wall; poly(ctx, [bl, br, tr, tl]); ctx.fill();
  ctx.strokeStyle = palette.log; ctx.lineWidth = Math.max(1, k * 0.03);
  for (let i = 1; i < 7; i++) { const a = cam.P(L, hM * i / 7, z), b = cam.P(R, hM * i / 7, z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  // roof with snow
  ctx.fillStyle = palette.roof; poly(ctx, [eL, ridge, eR]); ctx.fill();
  ctx.fillStyle = '#f7fbff';
  const s0 = cam.P(L - 0.22, hM - 0.05, z), s1 = cam.P(x, hM + wM * 0.34, z), s2 = cam.P(R + 0.22, hM - 0.05, z);
  const rise = 0.07 * k;
  poly(ctx, [[s0[0], s0[1] + rise], s1, [s2[0], s2[1] + rise], [s2[0] - (s2[0] - s1[0]) * 0.1, s2[1] + rise * 2.4], [x < 0 ? s1[0] : s1[0], s1[1] + rise * 4], [s0[0] + (s1[0] - s0[0]) * 0.1, s0[1] + rise * 2.4]]); ctx.fill();
  // red carved trim under the eaves
  ctx.fillStyle = PAL.red;
  const t0 = cam.P(L, hM, z), t1 = cam.P(R, hM, z);
  ctx.fillRect(t0[0], t0[1], t1[0] - t0[0], Math.max(2, k * 0.07));
  // windows (warm light) with white frames, and a door
  const wn = wM > 2.2 ? 2 : 1;
  for (let i = 0; i < wn; i++) {
    const cx = L + wM * ((i + 1) / (wn + 1)) + (wn === 1 ? wM * 0.18 : 0), a = cam.P(cx - 0.28, hM * 0.62, z), b = cam.P(cx + 0.28, hM * 0.2, z);
    ctx.fillStyle = '#fff'; ctx.fillRect(a[0] - k * 0.04, a[1] - k * 0.04, b[0] - a[0] + k * 0.08, b[1] - a[1] + k * 0.08);
    const g = ctx.createLinearGradient(0, a[1], 0, b[1]); g.addColorStop(0, '#ffe7a0'); g.addColorStop(1, '#ffb64a');
    ctx.fillStyle = g; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, k * 0.03);
    ctx.beginPath(); ctx.moveTo((a[0] + b[0]) / 2, a[1]); ctx.lineTo((a[0] + b[0]) / 2, b[1]); ctx.moveTo(a[0], (a[1] + b[1]) / 2); ctx.lineTo(b[0], (a[1] + b[1]) / 2); ctx.stroke();
  }
  const d0 = cam.P(x - wM * 0.34, hM * 0.62, z), d1 = cam.P(x - wM * 0.34 + 0.46, 0, z);
  if (wn === 1) { ctx.fillStyle = palette.door; ctx.fillRect(d0[0], d0[1], d1[0] - d0[0], d1[1] - d0[1]); }
  // chimney
  const c0 = cam.P(x + wM * 0.22, hM + wM * 0.2, z), c1 = cam.P(x + wM * 0.22 + 0.3, hM + wM * 0.34, z);
  ctx.fillStyle = '#7a4b34'; ctx.fillRect(c0[0], c1[1] - k * 0.05, c1[0] - c0[0], (c0[1] - c1[1]) + k * 0.2);
  ctx.fillStyle = '#fff'; ctx.fillRect(c0[0] - 2, c1[1] - k * 0.1, c1[0] - c0[0] + 4, Math.max(3, k * 0.1));
}

function birch(ctx, cam, x, z, hM) {
  const k = cam.k(z), b = cam.P(x, 0, z), t = cam.P(x, hM, z), w = Math.max(3, k * 0.17);
  ctx.fillStyle = '#f2efe6'; ctx.fillRect(b[0] - w / 2, t[1], w, b[1] - t[1]);
  ctx.fillStyle = '#2d2a28';
  const rnd = lcg(Math.floor(x * 100 + z * 10));
  for (let i = 0; i < 7; i++) { const y = t[1] + (b[1] - t[1]) * (0.1 + rnd() * 0.85); ctx.fillRect(b[0] - w / 2, y, w * (0.35 + rnd() * 0.5), Math.max(1.5, k * 0.025)); }
  // bare twigs with snow
  ctx.strokeStyle = '#5b4d44'; ctx.lineWidth = Math.max(1, k * 0.03);
  for (let i = 0; i < 6; i++) {
    const a = rnd() * 2 - 1, y = t[1] + (b[1] - t[1]) * (0.04 + i * 0.07);
    ctx.beginPath(); ctx.moveTo(b[0], y + 6); ctx.quadraticCurveTo(b[0] + a * k * 0.5, y - k * 0.25, b[0] + a * k * 0.9, y - k * 0.55); ctx.stroke();
  }
}

function fence(ctx, cam, z, x0, x1) {
  const k = cam.k(z), h = 0.58;
  const rail1 = [cam.P(x0, h * 0.78, z), cam.P(x1, h * 0.78, z)], rail2 = [cam.P(x0, h * 0.34, z), cam.P(x1, h * 0.34, z)];
  ctx.strokeStyle = '#8a6a49'; ctx.lineWidth = Math.max(2, k * 0.07);
  for (const r of [rail1, rail2]) { ctx.beginPath(); ctx.moveTo(r[0][0], r[0][1]); ctx.lineTo(r[1][0], r[1][1]); ctx.stroke(); }
  const n = Math.round((x1 - x0) / 0.2);
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, b = cam.P(x, 0, z), t = cam.P(x, h, z), w = Math.max(3, k * 0.09);
    ctx.fillStyle = i % 2 ? '#b08a5a' : '#a37e4f'; ctx.fillRect(b[0] - w / 2, t[1], w, b[1] - t[1]);
    ctx.beginPath(); ctx.moveTo(b[0] - w / 2, t[1]); ctx.lineTo(b[0], t[1] - w * 0.7); ctx.lineTo(b[0] + w / 2, t[1]); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(b[0] - w / 2 - 1, t[1] - w * 0.9, w + 2, Math.max(2, k * 0.05));
  }
}

function ground(ctx, cam, W, H, hy) {
  const g = ctx.createLinearGradient(0, hy, 0, H);
  g.addColorStop(0, '#e6eef6'); g.addColorStop(0.35, '#f1f6fb'); g.addColorStop(1, '#fbfdff');
  ctx.fillStyle = g; ctx.fillRect(0, hy - 1, W, H - hy + 1);
  // soft drifts: broad, gentle light and shade, no hard rims
  const rnd = lcg(77);
  for (let i = 0; i < 22; i++) {
    const z = -1.6 + rnd() * 9, x = (rnd() * 2 - 1) * 5.5, k = cam.k(z), p = cam.P(x, 0, z);
    const rx = k * (0.9 + rnd() * 1.8), ry = rx * 0.2;
    ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(1, ry / rx);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    sh.addColorStop(0, `rgba(140,172,212,${0.16 + rnd() * 0.1})`); sh.addColorStop(1, 'rgba(140,172,212,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
    ctx.translate(-rx * 0.08, -rx * 0.35);
    const hi = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 0.8);
    hi.addColorStop(0, 'rgba(255,255,255,0.8)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi; ctx.beginPath(); ctx.arc(0, 0, rx * 0.8, 0, TAU); ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < 380; i++) {
    const z = -1.6 + rnd() * 9.5, x = (rnd() * 2 - 1) * 6, k = cam.k(z), p = cam.P(x, 0, z);
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(176,196,222,0.5)';
    ctx.fillRect(p[0], p[1], Math.max(1, k * 0.04), Math.max(1, k * 0.02));
  }
}

function bank(ctx, cam, side) {   // a low snow bank along each side of the green
  const x = side * (BOUNDS.x1 + 0.2);
  const pts = [];
  for (let z = BOUNDS.z0 - 0.4; z <= BOUNDS.z1 + 0.5; z += 0.4) pts.push(cam.P(x + side * 0.3, 0, z));
  const top = [];
  for (let z = BOUNDS.z0 - 0.4; z <= BOUNDS.z1 + 0.5; z += 0.4) top.push(cam.P(x - side * 0.1, 0.28 + 0.08 * Math.sin(z * 2.1), z));
  const g = ctx.createLinearGradient(side > 0 ? top[0][0] : pts[0][0], 0, side > 0 ? pts[0][0] : top[0][0], 0);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c9d9ea');
  poly(ctx, [...top, ...pts.slice().reverse()]); ctx.fillStyle = g; ctx.fill();
}

function square(ctx, cam) {
  const c = (x, z) => cam.P(x, 0, z);
  const q = [c(SQ.x0, SQ.z0), c(SQ.x1, SQ.z0), c(SQ.x1, SQ.z1), c(SQ.x0, SQ.z1)];
  // packed snow inside the town
  poly(ctx, q);
  const g = ctx.createLinearGradient(0, q[2][1], 0, q[0][1]); g.addColorStop(0, '#d3e1ee'); g.addColorStop(1, '#c4d6e8');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); poly(ctx, q); ctx.clip();
  ctx.strokeStyle = 'rgba(120,150,190,0.18)'; ctx.lineWidth = 1.5;
  for (let i = -10; i <= 10; i++) { const a = c(i * 0.2 - 1.4, SQ.z0), b = c(i * 0.2 + 0.6, SQ.z1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  ctx.restore();
  // the painted line: a red band with a white inner edge
  const o = 0.075;
  const outer = [c(SQ.x0 - o, SQ.z0 - o), c(SQ.x1 + o, SQ.z0 - o), c(SQ.x1 + o, SQ.z1 + o), c(SQ.x0 - o, SQ.z1 + o)];
  ctx.save();
  poly(ctx, outer); ctx.fillStyle = PAL.red; ctx.fill();
  poly(ctx, q); ctx.fillStyle = '#c9dbec'; ctx.fill();
  ctx.restore();
  // redraw the inner packed snow over the band's inside edge
  poly(ctx, q); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1.5, cam.k(1) * 0.016); poly(ctx, q); ctx.stroke();
  // gold studs at the corners
  for (const p of q) { ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(3, cam.k(1) * 0.04), 0, TAU); ctx.fillStyle = PAL.gold; ctx.fill(); }
}

// Footprints leading in from the thrower's side, so the empty foreground says where the bat comes from.
function tracks(ctx, cam) {
  for (let i = 0; i < 9; i++) {
    const z = -0.75 - i * 0.42, side = i % 2 ? 1 : -1, x = side * 0.13 + Math.sin(i * 1.7) * 0.05;
    const p = cam.P(x, 0, z), k = cam.k(z);
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(side * 0.1);
    ctx.fillStyle = `rgba(110,140,185,${0.34 - i * 0.02})`;
    ctx.beginPath(); ctx.ellipse(0, 0, k * 0.075, k * 0.034, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(-k * 0.01, -k * 0.012, k * 0.06, k * 0.02, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// Everything that never changes during play, painted into `ctx` at the full canvas size W x H.
export function paintBackdrop(ctx, cam, W, H) {
  const hy = sky(ctx, cam, W, H);
  ground(ctx, cam, W, H, Math.max(0, hy));
  forest(ctx, cam, W, 16, '#8fa9b6', 3.6, 5);
  forest(ctx, cam, W, 9, '#6f8c98', 3.4, 6);
  // a small painted hamlet just behind the fence, like a diorama
  forest(ctx, cam, W, 5.3, '#4c7a78', 1.5, 7);
  const cabins = [
    { x: -1.75, z: 4.55, w: 1.5, h: 0.8, p: { wall: '#9a6236', log: '#6d4322', roof: '#7a2c26', door: '#5a3320' } },
    { x: 1.95, z: 4.75, w: 1.4, h: 0.75, p: { wall: '#a8723f', log: '#764b27', roof: '#31505a', door: '#5a3320' } },
  ];
  for (const c of cabins) house(ctx, cam, c.x, c.z, c.w, c.h, c.p);
  forest(ctx, cam, W, 4.15, '#2f5a56', 1.05, 8);
  fence(ctx, cam, BOUNDS.z1 + 0.3, -4.2, 4.2);
  bank(ctx, cam, -1); bank(ctx, cam, 1);
  square(ctx, cam);
  tracks(ctx, cam);
}

// ---- pins and the bat -------------------------------------------------------------------------------------------------------
const mixc = (c1, c2, t) => {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const f = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return `rgb(${f(16)},${f(8)},${f(0)})`;
};
const BANDS = [PAL.red, PAL.pine, '#2e5fa3'];   // each pin carries its own painted colour

export function drawShadow(ctx, cam, x, z, r, a = 0.3, lift = 0) {
  const p = cam.P(x + 0.06 + lift * 0.4, 0, z + 0.02), k = cam.k(z);
  ctx.save(); ctx.globalAlpha = a * Math.max(0.35, 1 - lift * 0.8);
  ctx.fillStyle = '#4a6283';
  ctx.beginPath(); ctx.ellipse(p[0], p[1], r * k * 1.1, r * k * 0.5, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawStandingPin(ctx, cam, p, o = {}) {
  const b = cam.P(p.x, 0, p.z), t = cam.P(p.x, PIN_LEN, p.z), k = cam.k(p.z);
  const w = PIN_R * 2 * k, h = b[1] - t[1], x = b[0];
  const col = BANDS[p.id % BANDS.length];
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  drawShadow(ctx, cam, p.x, p.z, PIN_R * 1.5, 0.34);
  // body: slight taper, rounded head, a lit left edge
  const wb = w * 0.5, wm = w * 0.58, wt = w * 0.32;
  const g = ctx.createLinearGradient(x - wm, 0, x + wm, 0);
  g.addColorStop(0, '#fff3d8'); g.addColorStop(0.35, PAL.wood); g.addColorStop(1, '#a87b3e');
  ctx.beginPath();
  ctx.moveTo(x - wb, b[1]); ctx.lineTo(x - wm, b[1] - h * 0.5); ctx.lineTo(x - wt, t[1] + h * 0.12);
  ctx.quadraticCurveTo(x - wt, t[1], x, t[1]); ctx.quadraticCurveTo(x + wt, t[1], x + wt, t[1] + h * 0.12);
  ctx.lineTo(x + wm, b[1] - h * 0.5); ctx.lineTo(x + wb, b[1]);
  ctx.quadraticCurveTo(x, b[1] + w * 0.22, x - wb, b[1]); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // painted bands
  ctx.fillStyle = col; ctx.fillRect(x - w, t[1] + h * 0.38, w * 2, h * 0.16);
  ctx.fillStyle = PAL.gold; ctx.fillRect(x - w, t[1] + h * 0.6, w * 2, h * 0.05);
  ctx.fillStyle = col; ctx.fillRect(x - w, t[1] + h * 0.1, w * 2, h * 0.07);
  // shading across the bands
  const s = ctx.createLinearGradient(x - wm, 0, x + wm, 0);
  s.addColorStop(0, 'rgba(255,255,255,0.35)'); s.addColorStop(0.45, 'rgba(255,255,255,0)'); s.addColorStop(1, 'rgba(30,18,10,0.42)');
  ctx.fillStyle = s; ctx.fillRect(x - w, t[1], w * 2, h + 4);
  ctx.restore();
  ctx.lineWidth = Math.max(1, k * 0.012); ctx.strokeStyle = 'rgba(70,40,15,0.65)';
  ctx.beginPath();
  ctx.moveTo(x - wb, b[1]); ctx.lineTo(x - wm, b[1] - h * 0.5); ctx.lineTo(x - wt, t[1] + h * 0.12);
  ctx.quadraticCurveTo(x - wt, t[1], x, t[1]); ctx.quadraticCurveTo(x + wt, t[1], x + wt, t[1] + h * 0.12);
  ctx.lineTo(x + wm, b[1] - h * 0.5); ctx.lineTo(x + wb, b[1]); ctx.stroke();
  if (o.mark) { ctx.beginPath(); ctx.ellipse(x, b[1] + w * 0.1, w * 0.9, w * 0.38, 0, 0, TAU); ctx.lineWidth = Math.max(2, k * 0.03); ctx.strokeStyle = o.mark; ctx.stroke(); }
  ctx.restore();
}

// A bar-like body lying on the ground (a pin or the bat) between two world points, drawn as a lit capsule with painted bands.
function capsule(ctx, cam, a, b, y, radius, o) {
  const pa = cam.P(a[0], y, a[1]), pb = cam.P(b[0], y, b[1]);
  const km = cam.k((a[1] + b[1]) / 2), wpx = Math.max(3, radius * 2 * km);
  const dx = pb[0] - pa[0], dy = pb[1] - pa[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.lineCap = 'round';
  ctx.strokeStyle = o.edge; ctx.lineWidth = wpx + Math.max(1.5, km * 0.02); ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
  ctx.strokeStyle = o.base; ctx.lineWidth = wpx; ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
  // lit side
  ctx.strokeStyle = o.hi; ctx.lineWidth = wpx * 0.34; ctx.globalAlpha = (o.alpha ?? 1) * 0.8;
  ctx.beginPath(); ctx.moveTo(pa[0] - nx * wpx * 0.22, pa[1] - ny * wpx * 0.22); ctx.lineTo(pb[0] - nx * wpx * 0.22, pb[1] - ny * wpx * 0.22); ctx.stroke();
  ctx.globalAlpha = o.alpha ?? 1;
  // painted bands across the body
  ctx.lineCap = 'butt';
  for (const [t, col, wd] of o.bands) {
    const cx = pa[0] + dx * t, cy = pa[1] + dy * t, hw = wpx * 0.5;
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, len * wd);
    ctx.beginPath(); ctx.moveTo(cx - nx * hw, cy - ny * hw); ctx.lineTo(cx + nx * hw, cy + ny * hw); ctx.stroke();
  }
  ctx.restore();
}

export function drawLyingPin(ctx, cam, p, o = {}) {
  const hx = Math.cos(p.ang) * PIN_LEN / 2, hz = Math.sin(p.ang) * PIN_LEN / 2;
  drawShadow(ctx, cam, p.x, p.z, LIE_R * 1.6, 0.26);
  const col = BANDS[p.id % BANDS.length];
  capsule(ctx, cam, [p.x - hx, p.z - hz], [p.x + hx, p.z + hz], PIN_R * 0.9, PIN_R * 0.95, {
    base: PAL.wood, hi: '#fff0cf', edge: 'rgba(70,40,15,0.7)', alpha: o.alpha,
    bands: [[0.5, col, 0.2], [0.72, PAL.gold, 0.06], [0.2, col, 0.1]],
  });
  if (o.mark) { const c = cam.P(p.x, 0, p.z), k = cam.k(p.z); ctx.save(); ctx.beginPath(); ctx.ellipse(c[0], c[1], k * 0.18, k * 0.08, 0, 0, TAU); ctx.lineWidth = Math.max(2, k * 0.03); ctx.strokeStyle = o.mark; ctx.stroke(); ctx.restore(); }
}

export function drawBat(ctx, cam, b, t) {
  const bands = [[0.5, PAL.red, 0.14], [0.22, PAL.gold, 0.06], [0.78, PAL.gold, 0.06], [0.08, PAL.red, 0.08]];
  const look = { base: '#b9783a', hi: '#f0c783', edge: 'rgba(40,20,8,0.8)', bands };
  if (b.mode === 'fly') {
    const c = cam.P(b.x, b.y, b.z), k = cam.k(b.z);
    drawShadow(ctx, cam, b.x, b.z, BAT_HL * 0.9, 0.34, b.y);
    const hl = BAT_HL * k * 0.95, ph = b.spinPhase, w = BAT_R * 2 * k;
    for (let i = 3; i >= 1; i--) {   // motion ghosts
      const a = ph - i * 0.45, cx = c[0], cy = c[1] + i * 3;
      ctx.save(); ctx.globalAlpha = 0.12; ctx.strokeStyle = '#9a6a34'; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * hl, cy - Math.sin(a) * hl * 0.55); ctx.lineTo(cx + Math.cos(a) * hl, cy + Math.sin(a) * hl * 0.55); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.lineCap = 'round';
    const x0 = c[0] - Math.cos(ph) * hl, y0 = c[1] - Math.sin(ph) * hl * 0.55, x1 = c[0] + Math.cos(ph) * hl, y1 = c[1] + Math.sin(ph) * hl * 0.55;
    ctx.strokeStyle = look.edge; ctx.lineWidth = w + 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = look.base; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = PAL.red; ctx.lineWidth = w; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(c[0] - (x1 - x0) * 0.06, c[1] - (y1 - y0) * 0.06); ctx.lineTo(c[0] + (x1 - x0) * 0.06, c[1] + (y1 - y0) * 0.06); ctx.stroke();
    ctx.restore();
    void t;
    return;
  }
  const c = Math.cos(b.th), s = Math.sin(b.th);
  drawShadow(ctx, cam, b.x, b.z, BAT_HL * 0.8, 0.22);
  capsule(ctx, cam, [b.x - c * BAT_HL, b.z - s * BAT_HL], [b.x + c * BAT_HL, b.z + s * BAT_HL], BAT_R, BAT_R, look);
}

// A ring drawn flat on the snow.
export function groundRing(ctx, cam, x, z, r, col, lw = 3, dash = null) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) { const a = (i / 32) * TAU, p = cam.P(x + Math.cos(a) * r, 0.01, z + Math.sin(a) * r); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
  ctx.stroke(); ctx.restore();
}
export const hexMix = mixc;
