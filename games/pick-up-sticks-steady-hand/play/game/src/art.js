// Drawing primitives: the lamp-lit room, the felt-and-brass mat (baked once) and the lacquered sticks (lit from the upper left,
// each one shaded as a cylinder, with value bands). Pure drawing, no game state. Everything is original and drawn in code.
import { LH, SR, TABLE } from './sim.js';

export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
const TAU = Math.PI * 2;
export const SIDE = [
  { name: 'celadon', glow: 'rgba(110,232,200,0.95)', hud: '#72e6c8', rib: '#e9fff7' },
  { name: 'vermilion', glow: 'rgba(255,150,108,0.95)', hud: '#ff9a6a', rib: '#fff0e4' },
];
// Per kind: base colour, highlight, shade, band colour and where the bands sit (fractions of the half length, width in units).
export const LOOK = {
  gold: { base: '#e9b93a', hi: '#fff3b0', sh: '#7a4c0c', band: '#1b130a', bands: [[-0.86, 11], [-0.52, 5], [0, 14], [0.52, 5], [0.86, 11]] },
  red: { base: '#c8282c', hi: '#ff9d8c', sh: '#4e0810', band: '#f1c255', bands: [[-0.1, 5], [0.06, 5], [0.22, 5]] },
  jade: { base: '#27a374', hi: '#c6ffe2', sh: '#0a4231', band: '#f6f1df', bands: [[-0.5, 7], [0.5, 7]] },
  indigo: { base: '#2c4cae', hi: '#a9c2ff', sh: '#0c1b55', band: '#dfe5f0', bands: [[0, 9]] },
  bamboo: { base: '#e8d29c', hi: '#fff8de', sh: '#85612c', band: '#7c4b22', bands: [[-0.62, 3], [0.1, 3], [0.7, 3]] },
  tool: { base: '#f0c24a', hi: '#fffbc8', sh: '#8a560c', band: '#2a1a08', bands: [[-0.85, 9], [0.85, 9]] },
};
const LIGHT = { x: -0.55, y: -0.83 };

// ---- host (off-screen surfaces) ----------------------------------------------------------------------------------
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
}
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };   // decoration only

// ---- backdrop: a dark room with a pool of lamp light ----------------------------------------------------------------
let grain;
function bakeGrain(ctx) {
  setHost(ctx);
  const c = makeCanvas(256, 256);
  if (!c) return null;
  const g = c.getContext('2d'), r = lcg(91);
  g.fillStyle = '#17141a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const x = r() * 256, y = r() * 256, l = 8 + r() * 30, k = r();
    g.strokeStyle = k < 0.5 ? `rgba(255,236,200,${0.015 + r() * 0.03})` : `rgba(0,0,0,${0.05 + r() * 0.08})`;
    g.lineWidth = 0.6 + r() * 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (r() - 0.5) * 3); g.stroke();
  }
  return c;
}
export function drawBackdrop(ctx, W, H, cx = W / 2, cy = H / 2) {
  if (grain === undefined) grain = bakeGrain(ctx);
  ctx.fillStyle = '#17141a'; ctx.fillRect(0, 0, W, H);
  if (grain) for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) ctx.drawImage(grain, x, y, 257, 257);
  const big = Math.max(W, H), g = ctx.createRadialGradient(cx, cy, 80, cx, cy, big * 0.8);
  g.addColorStop(0, 'rgba(255,214,150,0.30)'); g.addColorStop(0.45, 'rgba(120,70,40,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ---- the mat: felt inside a brass frame, baked once (origin = table centre) ----------------------------------------------
export const MAT_PX = 2 * (TABLE + 40);
let mat;
function roundRectPath(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function paintMat(g) {
  const r = lcg(3141), S = MAT_PX / 2, T = TABLE;
  g.translate(S, S);
  // soft shadow on the room floor
  roundRectPath(g, -T - 8 + 12, -T - 8 + 22, 2 * T + 16, 2 * T + 16, 46); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fill();
  // brass frame
  let gr = g.createLinearGradient(-T, -T, T, T);
  gr.addColorStop(0, '#f0d58a'); gr.addColorStop(0.25, '#b88a36'); gr.addColorStop(0.55, '#7a5518'); gr.addColorStop(0.8, '#c9a04a'); gr.addColorStop(1, '#6a4710');
  roundRectPath(g, -T - 18, -T - 18, 2 * T + 36, 2 * T + 36, 48); g.fillStyle = gr; g.fill();
  roundRectPath(g, -T - 9, -T - 9, 2 * T + 18, 2 * T + 18, 40); g.fillStyle = '#3b2a10'; g.fill();
  // felt
  roundRectPath(g, -T, -T, 2 * T, 2 * T, 34); g.save(); g.clip();
  gr = g.createRadialGradient(-40, -60, 40, 0, 0, T * 1.25);
  gr.addColorStop(0, '#34383f'); gr.addColorStop(0.55, '#262a31'); gr.addColorStop(1, '#16181d');
  g.fillStyle = gr; g.fillRect(-T, -T, 2 * T, 2 * T);
  for (let i = 0; i < 5200; i++) {
    const x = (r() * 2 - 1) * T, y = (r() * 2 - 1) * T, k = r();
    g.fillStyle = k < 0.5 ? `rgba(255,255,255,${0.02 + r() * 0.04})` : `rgba(0,0,0,${0.06 + r() * 0.1})`;
    g.fillRect(x, y, 1 + r() * 1.6, 1 + r() * 1.6);
  }
  // fine inlaid line and corner brackets
  g.strokeStyle = 'rgba(214,170,84,0.42)'; g.lineWidth = 2; roundRectPath(g, -T + 16, -T + 16, 2 * T - 32, 2 * T - 32, 24); g.stroke();
  g.strokeStyle = 'rgba(214,170,84,0.22)'; g.lineWidth = 1.2; roundRectPath(g, -T + 24, -T + 24, 2 * T - 48, 2 * T - 48, 18); g.stroke();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    g.save(); g.translate(sx * (T - 36), sy * (T - 36)); g.scale(sx, sy);
    g.strokeStyle = 'rgba(224,182,96,0.55)'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(26, 0); g.moveTo(0, 0); g.lineTo(0, 26); g.stroke();
    g.beginPath(); g.arc(9, 9, 5, 0, TAU); g.stroke();
    g.restore();
  }
  // a faint medallion in the middle
  g.strokeStyle = 'rgba(214,170,84,0.12)'; g.lineWidth = 2;
  for (const rad of [120, 175]) { g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.stroke(); }
  g.restore();
  // inner lip shade
  gr = g.createLinearGradient(0, -T, 0, -T + 30); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  roundRectPath(g, -T, -T, 2 * T, 2 * T, 34); g.save(); g.clip(); g.fillStyle = gr; g.fillRect(-T, -T, 2 * T, 30); g.restore();
}
export function drawMat(ctx) {   // origin = table centre
  if (mat === undefined) {
    setHost(ctx);
    const c = makeCanvas(MAT_PX, MAT_PX);
    if (c) { paintMat(c.getContext('2d')); mat = c; } else mat = null;
  }
  if (mat) ctx.drawImage(mat, -MAT_PX / 2, -MAT_PX / 2);
  else { ctx.fillStyle = '#262a31'; ctx.fillRect(-TABLE, -TABLE, 2 * TABLE, 2 * TABLE); }
}

// ---- sticks --------------------------------------------------------------------------------------------------------------
function bodyPath(ctx, L, R) {
  const tip = Math.min(30, L * 0.22);
  ctx.beginPath();
  ctx.moveTo(-L, 0); ctx.quadraticCurveTo(-L + tip * 0.3, -R * 0.8, -L + tip, -R); ctx.lineTo(L - tip, -R);
  ctx.quadraticCurveTo(L - tip * 0.3, -R * 0.8, L, 0); ctx.quadraticCurveTo(L - tip * 0.3, R * 0.8, L - tip, R); ctx.lineTo(-L + tip, R);
  ctx.quadraticCurveTo(-L + tip * 0.3, R * 0.8, -L, 0); ctx.closePath();
}
const clampS = (v) => Math.max(0.02, Math.min(0.98, v));
// o: { lift (extra height in units, shadow only), glow (css colour), warn (0..1 amber to red wobble), alpha, ghost }
export function drawStick(ctx, s, o = {}) {
  const look = LOOK[s.kind] ?? LOOK.bamboo, L = s.lh ?? LH, R = SR, c = Math.cos(s.a), sn = Math.sin(s.a);
  const facing = -sn * LIGHT.x + c * LIGHT.y;          // does the +y side of the stick face the lamp?
  const u = 0.5 + 0.27 * Math.max(-1, Math.min(1, facing * 1.6));
  const h = 2 + Math.min(s.z ?? 1, 5) * 1.5 + (o.lift ?? 0);
  const ox = h * 0.55 + 1, oy = h * 0.8 + 2;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.translate(s.x, s.y);
  // shadow: two soft passes
  ctx.save(); ctx.translate(ox, oy); ctx.rotate(s.a); bodyPath(ctx, L, R * 1.15); ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fill();
  ctx.translate(-ox * 0.5, -oy * 0.5); bodyPath(ctx, L, R * 1.02); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill(); ctx.restore();
  ctx.rotate(s.a);
  if (o.glow) { ctx.save(); ctx.shadowColor = o.glow; ctx.shadowBlur = 22; bodyPath(ctx, L, R + 1.5); ctx.fillStyle = o.glow; ctx.fill(); ctx.restore(); }
  bodyPath(ctx, L, R); ctx.fillStyle = look.base; ctx.fill();
  ctx.save(); bodyPath(ctx, L, R); ctx.clip();
  ctx.fillStyle = look.band;
  for (const [f, wd] of look.bands) ctx.fillRect(f * L - wd / 2, -R - 1, wd, 2 * R + 2);
  // cylinder shading overlay (dark edges, lit side highlight)
  const g = ctx.createLinearGradient(0, -R, 0, R);
  g.addColorStop(0, 'rgba(0,0,0,0.62)'); g.addColorStop(clampS(u - 0.34), 'rgba(0,0,0,0.12)'); g.addColorStop(clampS(u - 0.12), 'rgba(255,255,255,0.02)');
  g.addColorStop(clampS(u), 'rgba(255,255,255,0.55)'); g.addColorStop(clampS(u + 0.14), 'rgba(255,255,255,0.04)'); g.addColorStop(clampS(u + 0.42), 'rgba(0,0,0,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.66)');
  ctx.fillStyle = g; ctx.fillRect(-L, -R, 2 * L, 2 * R);
  // tinted core so the shade reads as the stick's own colour, not grey
  const t = ctx.createLinearGradient(0, -R, 0, R);
  t.addColorStop(0, look.sh); t.addColorStop(clampS(u), 'rgba(0,0,0,0)'); t.addColorStop(1, look.sh);
  ctx.globalAlpha *= 0.45; ctx.fillStyle = t; ctx.fillRect(-L, -R, 2 * L, 2 * R); ctx.globalAlpha = o.alpha ?? 1;
  // specular streak
  const sy = (u - 0.5) * 2 * R * 0.78, sg = ctx.createLinearGradient(-L, 0, L, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.12, 'rgba(255,255,255,0.85)'); sg.addColorStop(0.55, 'rgba(255,255,255,0.5)'); sg.addColorStop(0.9, 'rgba(255,255,255,0.8)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = sg; ctx.lineWidth = Math.max(1.4, R * 0.2); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-L * 0.86, sy); ctx.lineTo(L * 0.86, sy); ctx.stroke();
  ctx.restore();
  bodyPath(ctx, L, R); ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(8,4,0,0.55)'; ctx.stroke();
  if (o.warn > 0.02) {
    const k = Math.min(1, o.warn), col = k < 0.6 ? `rgba(255,${Math.round(210 - k * 150)},70,` : 'rgba(255,70,50,';
    ctx.save(); ctx.shadowColor = `${col}0.9)`; ctx.shadowBlur = 14; bodyPath(ctx, L, R + 1.5); ctx.lineWidth = 2.4; ctx.strokeStyle = `${col}${0.45 + 0.5 * k})`; ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}
// An outline of a stick drawn over everything (hint, free-stick marks): colour css, width in units, optional dash.
export function strokeStick(ctx, s, col, wd = 3, dash = null) {
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a); bodyPath(ctx, s.lh ?? LH, SR + 3);
  if (dash) ctx.setLineDash(dash);
  ctx.lineWidth = wd; ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.stroke(); ctx.restore();
}
// A stick as a small icon: `len` pixels long, tilted by `a`.
export function drawStickIcon(ctx, x, y, len, kind, a = -0.5) {
  const k = len / (2 * LH);
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  drawStick(ctx, { x: 0, y: 0, a, z: 0, lh: LH, kind }, { lift: -2 });
  ctx.restore();
}
