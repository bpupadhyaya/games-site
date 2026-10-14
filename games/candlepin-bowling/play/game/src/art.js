// Drawing of the game's own pieces: the slim candlepin, the lying pin (wood) and the hand-sized ball, plus the alley palettes.
// Presentation only: it reads sim state and never changes it.
import { LANE } from './sim.js';

export const ALLEYS = {
  harbor: { name: 'Harbor Lanes', sub: 'Honey maple, warm lights', maple: ['#f0c27a', '#c98f3f'], board: 'rgba(120,70,20,0.16)', wall: ['#1f3550', '#0d1a2c'], carpet: ['#2b3f63', '#16233d'], glow: '#ffd27a', sign: '#ffb23a', trim: '#e8b04a' },
  neon: { name: 'Neon Night', sub: 'Dark lane, teal and pink glow', maple: ['#d8a65e', '#8b5a26'], board: 'rgba(30,10,40,0.2)', wall: ['#1b1040', '#08051a'], carpet: ['#27124a', '#110826'], glow: '#5ff0e4', sign: '#ff4fa3', trim: '#37e0d4' },
  oldwood: { name: 'Old Wood', sub: 'Worn lane, brick and brass', maple: ['#d9a566', '#9a6a30'], board: 'rgba(70,35,10,0.22)', wall: ['#4a2b1e', '#241008'], carpet: ['#3b2a22', '#1e130e'], glow: '#ffe3a8', sign: '#e8c25a', trim: '#c9953c' },
};
export const ALLEY_IDS = ['harbor', 'neon', 'oldwood'];
let current = ALLEYS.harbor;
export const setAlley = (id) => { current = ALLEYS[id] ?? ALLEYS.harbor; };
export const alley = () => current;

const TAU = Math.PI * 2;

// pin silhouette: [height m, radius m]
const PROFILE = [[0, 0.021], [0.012, 0.027], [0.06, 0.032], [0.12, 0.0345], [0.19, 0.03], [0.25, 0.022], [0.29, 0.0185], [0.325, 0.0215], [0.358, 0.0225], [0.378, 0.015], [0.387, 0.004]];

// A standing pin at ground point `b` (screen), pixels per metre `s`.
export function drawPin(ctx, bx, by, s, o = {}) {
  const { alpha = 1, lit = 1 } = o;
  const H = LANE.pinH * s;
  if (H < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  // soft contact shadow
  const sg = ctx.createRadialGradient(bx, by, 0, bx, by, LANE.pinR * 2.3 * s);
  sg.addColorStop(0, 'rgba(0,0,0,0.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(bx, by, LANE.pinR * 2.3 * s, LANE.pinR * 1.25 * s, 0, 0, TAU); ctx.fill();
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i < PROFILE.length; i++) { const [z, r] = PROFILE[i]; ctx.lineTo(bx - r * s, by - z * s); }
    for (let i = PROFILE.length - 1; i >= 0; i--) { const [z, r] = PROFILE[i]; ctx.lineTo(bx + r * s, by - z * s); }
    ctx.closePath();
  };
  path();
  const g = ctx.createLinearGradient(bx - LANE.pinR * s, 0, bx + LANE.pinR * s, 0);
  g.addColorStop(0, '#fff9ea'); g.addColorStop(0.35, '#f1e7cf'); g.addColorStop(0.75, '#cdbf9f'); g.addColorStop(1, '#8e8366');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // two red bands on the neck
  ctx.fillStyle = '#c6252f';
  ctx.fillRect(bx - 0.04 * s, by - 0.318 * s, 0.08 * s, 0.026 * s);
  ctx.fillRect(bx - 0.04 * s, by - 0.274 * s, 0.08 * s, 0.014 * s);
  // roundness
  const sh = ctx.createLinearGradient(bx - LANE.pinR * s, 0, bx + LANE.pinR * s, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(0.3, 'rgba(255,255,255,0)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = sh; ctx.fillRect(bx - 0.05 * s, by - H - 2, 0.1 * s, H + 4);
  ctx.restore();
  ctx.lineWidth = Math.max(0.6, s * 0.0016); ctx.strokeStyle = 'rgba(60,45,20,0.55)'; path(); ctx.stroke();
  if (lit < 1) { path(); ctx.fillStyle = `rgba(10,10,30,${1 - lit})`; ctx.fill(); }
  ctx.restore();
}

// A pin lying on the deck: capsule from screen point a (foot end) to b (head end).
export function drawLying(ctx, ax, ay, bx, by, s, o = {}) {
  const { alpha = 1 } = o;
  const w = LANE.woodR * 2 * s;
  ctx.save();
  ctx.globalAlpha = alpha; ctx.lineCap = 'round';
  // shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = w * 1.15;
  ctx.beginPath(); ctx.moveTo(ax + w * 0.18, ay + w * 0.34); ctx.lineTo(bx + w * 0.18, by + w * 0.34); ctx.stroke();
  ctx.strokeStyle = '#8c7f60'; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.strokeStyle = '#eadfc4'; ctx.lineWidth = w * 0.78;
  ctx.beginPath(); ctx.moveTo(ax, ay - w * 0.07); ctx.lineTo(bx, by - w * 0.07); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = w * 0.22;
  ctx.beginPath(); ctx.moveTo(ax, ay - w * 0.24); ctx.lineTo(bx, by - w * 0.24); ctx.stroke();
  // red bands near the head end
  const lerp = (t) => [ax + (bx - ax) * t, ay + (by - ay) * t];
  ctx.strokeStyle = '#c6252f'; ctx.lineCap = 'butt';
  for (const [t0, t1] of [[0.66, 0.74], [0.8, 0.83]]) { const p = lerp(t0), q = lerp(t1); ctx.lineWidth = w * 0.7; ctx.beginPath(); ctx.moveTo(p[0], p[1] - w * 0.07); ctx.lineTo(q[0], q[1] - w * 0.07); ctx.stroke(); }
  ctx.restore();
}

// The ball: dark, glossy, a window reflected in it. (bx, by) is the centre, r in pixels, rot spins a small mark.
export function drawBall(ctx, bx, by, r, o = {}) {
  const { rot = 0, shadowY = null, alpha = 1 } = o;
  if (r < 1) return;
  ctx.save(); ctx.globalAlpha = alpha;
  if (shadowY !== null) {
    const sg = ctx.createRadialGradient(bx, shadowY, 0, bx, shadowY, r * 1.5);
    sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(bx, shadowY, r * 1.5, r * 0.7, 0, 0, TAU); ctx.fill();
  }
  const g = ctx.createRadialGradient(bx - r * 0.34, by - r * 0.38, r * 0.05, bx, by, r * 1.05);
  g.addColorStop(0, '#8d93b2'); g.addColorStop(0.18, '#3a3f5c'); g.addColorStop(0.6, '#10131f'); g.addColorStop(1, '#03040a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
  // rolling mark
  const ma = rot, mx = Math.cos(ma) * r * 0.62, my = Math.sin(ma) * r * 0.5 - r * 0.05, depth = Math.cos(ma * 0.5 + 0.8);
  if (depth > -0.2) { ctx.fillStyle = 'rgba(200,210,255,0.35)'; ctx.beginPath(); ctx.arc(bx + mx, by + my, r * 0.11, 0, TAU); ctx.fill(); }
  // window reflection
  ctx.save(); ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath(); ctx.roundRect(bx - r * 0.62, by - r * 0.66, r * 0.55, r * 0.34, r * 0.07); ctx.fill();
  ctx.fillStyle = 'rgba(160,190,255,0.22)'; ctx.beginPath(); ctx.ellipse(bx + r * 0.2, by + r * 0.62, r * 0.7, r * 0.22, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// icons for menus and rules (screen space, no perspective)
export function pinIcon(ctx, cx, baseY, h, o = {}) {
  drawPin(ctx, cx, baseY, h / LANE.pinH, o);
}
export function ballIcon(ctx, cx, cy, r, rot = 0.8) { drawBall(ctx, cx, cy, r, { rot, shadowY: cy + r * 1.05 }); }
export function lyingIcon(ctx, cx, cy, len, ang = 0) {
  const s = len / (LANE.woodHL * 2 + LANE.woodR * 2), dx = Math.cos(ang) * LANE.woodHL * s, dy = Math.sin(ang) * LANE.woodHL * s;
  drawLying(ctx, cx - dx, cy - dy, cx + dx, cy + dy, s);
}

// Deterministic pseudo-noise for textures (no Math.random in src)
export function hash2(a, b) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
