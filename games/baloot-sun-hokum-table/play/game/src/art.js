// All painted art: majlis carpet, card table, lanterns, coffee pot (pure decoration), card faces and backs, buttons.
// Static art is painted ONCE into cached layers; a frame only draws them. The geometric ornament is decoration only.
import { W, H, CW, CH } from './layout.js';
import { suitOf, rankOf, RANK_LABEL } from './rules.js';

export const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const BRASS = '#e0b25a', BRASS_D = '#9a6a24', CREAM = '#f6ead0', INK = '#22140c';
const TAU = Math.PI * 2;

function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function layer(w, h, scale, paint) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const c = new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale));
  const g = c.getContext('2d'); g.scale(scale, scale); paint(g); return c;
}
export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

// ---- ornament ---------------------------------------------------------------------------------------------
export function star8(ctx, cx, cy, R, rot = 0, inner = 0.62) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = rot + i * Math.PI / 8, r = i % 2 ? R * inner : R; ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  ctx.closePath();
}
function rosette(ctx, cx, cy, R, col, lw) {
  ctx.strokeStyle = col; ctx.lineWidth = lw;
  star8(ctx, cx, cy, R, 0); ctx.stroke(); star8(ctx, cx, cy, R * 0.72, Math.PI / 8, 0.7); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.28, 0, TAU); ctx.stroke();
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + Math.PI / 8; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.28, cy + Math.sin(a) * R * 0.28); ctx.lineTo(cx + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.72); ctx.stroke(); }
}
export function tilePattern(ctx, x0, y0, w, h, cell, col, lw) {
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  for (let y = y0; y < y0 + h + cell; y += cell) for (let x = x0; x < x0 + w + cell; x += cell) {
    rosette(ctx, x + cell / 2, y + cell / 2, cell * 0.46, col, lw);
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x + cell, y + cell * 0.5 - cell * 0.09); ctx.lineTo(x + cell + cell * 0.09, y + cell * 0.5); ctx.lineTo(x + cell, y + cell * 0.5 + cell * 0.09); ctx.lineTo(x + cell - cell * 0.09, y + cell * 0.5); ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}

// ---- suits -----------------------------------------------------------------------------------------------
export const SUIT_INK = { std: ['#15110f', '#c4171d', '#c4171d', '#15110f'], four: ['#15110f', '#c4171d', '#1a56b8', '#12793a'] };
// fills the current path style; (cx, cy) = centre, s = height
export function suitPath(ctx, suit, cx, cy, s) {
  const u = s / 100; ctx.beginPath();
  if (suit === 1) {
    ctx.moveTo(cx, cy + 46 * u); ctx.bezierCurveTo(cx - 70 * u, cy - 4 * u, cx - 46 * u, cy - 56 * u, cx, cy - 20 * u);
    ctx.bezierCurveTo(cx + 46 * u, cy - 56 * u, cx + 70 * u, cy - 4 * u, cx, cy + 46 * u);
  } else if (suit === 2) {
    ctx.moveTo(cx, cy - 50 * u); ctx.bezierCurveTo(cx + 12 * u, cy - 22 * u, cx + 34 * u, cy - 6 * u, cx + 42 * u, cy);
    ctx.bezierCurveTo(cx + 34 * u, cy + 6 * u, cx + 12 * u, cy + 22 * u, cx, cy + 50 * u);
    ctx.bezierCurveTo(cx - 12 * u, cy + 22 * u, cx - 34 * u, cy + 6 * u, cx - 42 * u, cy);
    ctx.bezierCurveTo(cx - 34 * u, cy - 6 * u, cx - 12 * u, cy - 22 * u, cx, cy - 50 * u);
  } else if (suit === 0) {
    ctx.moveTo(cx, cy - 50 * u); ctx.bezierCurveTo(cx + 30 * u, cy - 14 * u, cx + 62 * u, cy + 4 * u, cx + 40 * u, cy + 30 * u);
    ctx.bezierCurveTo(cx + 26 * u, cy + 42 * u, cx + 8 * u, cy + 28 * u, cx + 6 * u, cy + 20 * u);
    ctx.bezierCurveTo(cx + 8 * u, cy + 38 * u, cx + 12 * u, cy + 46 * u, cx + 22 * u, cy + 50 * u); ctx.lineTo(cx - 22 * u, cy + 50 * u);
    ctx.bezierCurveTo(cx - 12 * u, cy + 46 * u, cx - 8 * u, cy + 38 * u, cx - 6 * u, cy + 20 * u);
    ctx.bezierCurveTo(cx - 8 * u, cy + 28 * u, cx - 26 * u, cy + 42 * u, cx - 40 * u, cy + 30 * u);
    ctx.bezierCurveTo(cx - 62 * u, cy + 4 * u, cx - 30 * u, cy - 14 * u, cx, cy - 50 * u);
  } else {
    ctx.arc(cx, cy - 22 * u, 21 * u, 0, TAU); ctx.moveTo(cx + 44 * u, cy + 14 * u); ctx.arc(cx + 25 * u, cy + 14 * u, 21 * u, 0, TAU);
    ctx.moveTo(cx - 4 * u, cy + 14 * u); ctx.arc(cx - 25 * u, cy + 14 * u, 21 * u, 0, TAU);
    ctx.moveTo(cx - 6 * u, cy + 8 * u); ctx.lineTo(cx + 6 * u, cy + 8 * u); ctx.lineTo(cx + 12 * u, cy + 50 * u); ctx.lineTo(cx - 12 * u, cy + 50 * u);
  }
  ctx.fill();
}
export const drawSuit = (ctx, suit, cx, cy, s, col) => { ctx.fillStyle = col; suitPath(ctx, suit, cx, cy, s); };

// ---- backgrounds ------------------------------------------------------------------------------------------
let bgLayer = null;
function paintBackground(g) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#3a0f18'); gr.addColorStop(0.5, '#5b1a22'); gr.addColorStop(1, '#2e0d15');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  tilePattern(g, 0, 0, W, H, 120, 'rgba(232,178,92,0.16)', 1.6);
  // woven noise
  const rnd = lcg(7); g.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 2400; i++) g.fillRect(rnd() * W, rnd() * H, 2, 1);
  // carpet borders
  for (const [inset, col, lw] of [[10, '#e0b25a', 3], [22, 'rgba(224,178,90,0.5)', 1.5]]) { g.strokeStyle = col; g.lineWidth = lw; g.strokeRect(inset, inset, W - 2 * inset, H - 2 * inset); }
  const v = g.createRadialGradient(W / 2, H * 0.48, 200, W / 2, H * 0.48, 1000); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}
let tableLayer = null;
const TABLE = { x: 96, y: 470, w: 528, h: 570 };
export { TABLE };
function octPath(g, x, y, w, h, c) {
  g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c); g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h); g.lineTo(x, y + h - c); g.lineTo(x, y + c); g.closePath();
}
function paintTable(g) {
  const { x, y, w, h } = TABLE, c = 120;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 36; g.shadowOffsetY = 14; octPath(g, x - 22, y - 22, w + 44, h + 44, c + 20); g.fillStyle = '#3a2210'; g.fill(); g.restore();
  // wooden rim
  octPath(g, x - 22, y - 22, w + 44, h + 44, c + 20);
  const wood = g.createLinearGradient(x, y, x + w, y + h); wood.addColorStop(0, '#8a5a2c'); wood.addColorStop(0.5, '#5a3616'); wood.addColorStop(1, '#7b4c22'); g.fillStyle = wood; g.fill();
  const rnd = lcg(3); g.save(); octPath(g, x - 22, y - 22, w + 44, h + 44, c + 20); g.clip(); g.strokeStyle = 'rgba(30,14,4,0.35)'; g.lineWidth = 1.5;
  for (let i = 0; i < 46; i++) { const yy = y - 22 + rnd() * (h + 44); g.beginPath(); g.moveTo(x - 22, yy); g.bezierCurveTo(x + w * 0.3, yy + rnd() * 10 - 5, x + w * 0.7, yy + rnd() * 10 - 5, x + w + 22, yy + rnd() * 8 - 4); g.stroke(); } g.restore();
  // brass inlay line
  octPath(g, x - 6, y - 6, w + 12, h + 12, c + 4); g.strokeStyle = BRASS; g.lineWidth = 4; g.stroke();
  // felt
  octPath(g, x, y, w, h, c);
  const f = g.createRadialGradient(x + w / 2, y + h / 2, 30, x + w / 2, y + h / 2, 380); f.addColorStop(0, '#1f7a55'); f.addColorStop(1, '#0d4030');
  g.fillStyle = f; g.fill();
  g.save(); octPath(g, x, y, w, h, c); g.clip();
  for (let i = 0; i < 4200; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},0.035)`; g.fillRect(x + rnd() * w, y + rnd() * h, 2, 1); }
  // inlaid rosette in the middle
  const cx = x + w / 2, cy = y + h / 2 + 4;
  g.strokeStyle = 'rgba(232,190,110,0.30)'; g.lineWidth = 2; rosette(g, cx, cy, 250, 'rgba(232,190,110,0.26)', 2);
  g.beginPath(); g.arc(cx, cy, 262, 0, TAU); g.stroke();
  g.restore();
  octPath(g, x, y, w, h, c); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.stroke();
}

// lantern and coffee pot: decoration
function lantern(g, cx, top, s, glowT) {
  const flick = 0.85 + 0.15 * Math.sin(glowT * 7) * Math.sin(glowT * 3.1);
  const gl = g.createRadialGradient(cx, top + 70 * s, 4, cx, top + 70 * s, 150 * s); gl.addColorStop(0, `rgba(255,205,110,${0.55 * flick})`); gl.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = gl; g.fillRect(cx - 160 * s, top - 40 * s, 320 * s, 330 * s);
  g.strokeStyle = BRASS_D; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, top + 8 * s); g.stroke();
  g.fillStyle = BRASS; g.beginPath(); g.moveTo(cx - 8 * s, top + 24 * s); g.lineTo(cx, top); g.lineTo(cx + 8 * s, top + 24 * s); g.fill();
  g.beginPath(); g.moveTo(cx - 30 * s, top + 42 * s); g.lineTo(cx - 8 * s, top + 22 * s); g.lineTo(cx + 8 * s, top + 22 * s); g.lineTo(cx + 30 * s, top + 42 * s); g.closePath(); g.fillStyle = '#b98634'; g.fill();
  const body = g.createLinearGradient(cx - 26 * s, 0, cx + 26 * s, 0); body.addColorStop(0, `rgba(255,${190 + flick * 40},90,0.95)`); body.addColorStop(1, `rgba(255,${150 + flick * 30},60,0.9)`);
  g.fillStyle = body; g.beginPath(); g.moveTo(cx - 26 * s, top + 42 * s); g.lineTo(cx + 26 * s, top + 42 * s); g.lineTo(cx + 20 * s, top + 108 * s); g.lineTo(cx - 20 * s, top + 108 * s); g.closePath(); g.fill();
  g.strokeStyle = BRASS_D; g.lineWidth = 2.5 * s; g.stroke(); g.beginPath(); g.moveTo(cx, top + 42 * s); g.lineTo(cx, top + 108 * s); g.moveTo(cx - 13 * s, top + 42 * s); g.lineTo(cx - 10 * s, top + 108 * s); g.moveTo(cx + 13 * s, top + 42 * s); g.lineTo(cx + 10 * s, top + 108 * s); g.stroke();
  g.fillStyle = '#b98634'; g.beginPath(); g.moveTo(cx - 24 * s, top + 108 * s); g.lineTo(cx + 24 * s, top + 108 * s); g.lineTo(cx + 10 * s, top + 128 * s); g.lineTo(cx - 10 * s, top + 128 * s); g.closePath(); g.fill();
}
function dallah(g, x, y, s) {   // an Arabian coffee pot on a small brass tray with two cups
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 78, 78, 12, 0, 0, TAU); g.fill();
  const b = g.createLinearGradient(-40, 0, 40, 0); b.addColorStop(0, '#c9993d'); b.addColorStop(0.45, '#f0cf82'); b.addColorStop(1, '#8b5f1f');
  g.fillStyle = b; g.beginPath(); g.moveTo(-30, 70); g.bezierCurveTo(-52, 30, -36, -10, -16, -22); g.lineTo(16, -22); g.bezierCurveTo(36, -10, 52, 30, 30, 70); g.closePath(); g.fill();
  g.strokeStyle = '#6d4712'; g.lineWidth = 2; g.stroke();
  g.beginPath(); g.moveTo(28, 40); g.bezierCurveTo(60, 20, 70, -20, 86, -52); g.lineTo(90, -46); g.bezierCurveTo(80, -10, 76, 34, 34, 60); g.closePath(); g.fillStyle = '#d9ab4d'; g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-30, 60); g.bezierCurveTo(-72, 58, -66, -8, -32, -6); g.lineWidth = 6; g.strokeStyle = '#7a4f17'; g.stroke();
  g.fillStyle = '#e6be6a'; g.beginPath(); g.moveTo(-18, -22); g.lineTo(18, -22); g.lineTo(10, -46); g.lineTo(-10, -46); g.closePath(); g.fill(); g.strokeStyle = '#6d4712'; g.lineWidth = 2; g.stroke();
  g.beginPath(); g.arc(0, -52, 7, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#f4ead4'; for (const cx of [-54, -78]) { g.beginPath(); g.moveTo(cx - 10, 60); g.lineTo(cx + 10, 60); g.lineTo(cx + 7, 76); g.lineTo(cx - 7, 76); g.closePath(); g.fill(); }
  g.restore();
}

export function drawBackground(ctx, t) {
  if (!bgLayer) bgLayer = layer(W, H, 1.5, paintBackground);
  if (bgLayer) ctx.drawImage(bgLayer, 0, 0, W, H); else { ctx.fillStyle = '#4a1520'; ctx.fillRect(0, 0, W, H); }
  lantern(ctx, 52, 0, 0.8, t); lantern(ctx, W - 52, 0, 0.8, t + 1.7);
}
export function drawTable(ctx, t) {
  if (!tableLayer) tableLayer = layer(W, H, 1.5, paintTable);
  if (tableLayer) ctx.drawImage(tableLayer, 0, 0, W, H);
  // warm light pool that breathes slowly
  const cx = W / 2, cy = 760, f = 0.9 + 0.1 * Math.sin(t * 1.3);
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 380); g.addColorStop(0, `rgba(255,214,140,${0.16 * f})`); g.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = g; ctx.fillRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h);
}
export function drawCoffee(ctx, x, y, t, s = 0.55) {
  dallah(ctx, x, y, s);
  ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  for (let k = 0; k < 2; k++) { const ph = (t * 0.5 + k * 0.5) % 1; ctx.globalAlpha = 0.28 * (1 - ph); ctx.beginPath(); const bx = x + 90 * s + k * 8, by = y - 56 * s - ph * 50; ctx.moveTo(bx, by + 30); ctx.bezierCurveTo(bx - 12, by + 14, bx + 12, by + 6, bx, by - 6); ctx.stroke(); }
  ctx.restore();
}

// ---- cards ------------------------------------------------------------------------------------------------
const faceCache = new Map();
let backLayer = null;
const SC = 2;
function pipLayout(r) {           // r = rank 0..7 -> list of [col, row] where col in {0,.5,1}
  const L = 0, M = 0.5, Rr = 1;
  if (r === 7) return [[M, 0.5]];
  if (r === 0) return [[L, 0.06], [Rr, 0.06], [L, 0.5], [Rr, 0.5], [M, 0.28], [L, 0.94], [Rr, 0.94]];
  if (r === 1) return [[L, 0.06], [Rr, 0.06], [L, 0.35], [Rr, 0.35], [L, 0.65], [Rr, 0.65], [L, 0.94], [Rr, 0.94]];
  if (r === 2) return [[L, 0.06], [Rr, 0.06], [L, 0.35], [Rr, 0.35], [M, 0.5], [L, 0.65], [Rr, 0.65], [L, 0.94], [Rr, 0.94]];
  return [[L, 0.06], [Rr, 0.06], [L, 0.31], [Rr, 0.31], [M, 0.185], [L, 0.69], [Rr, 0.69], [M, 0.815], [L, 0.94], [Rr, 0.94]];
}
function crown(g, x, y, s, kind, ink) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#e0b25a'; g.strokeStyle = '#7a4f17'; g.lineWidth = 1.6;
  if (kind === 'K') { g.beginPath(); g.moveTo(-26, 20); g.lineTo(-30, -14); g.lineTo(-14, 0); g.lineTo(0, -24); g.lineTo(14, 0); g.lineTo(30, -14); g.lineTo(26, 20); g.closePath(); }
  else if (kind === 'Q') { g.beginPath(); g.moveTo(-24, 20); g.quadraticCurveTo(-34, -6, -14, -12); g.quadraticCurveTo(0, -30, 14, -12); g.quadraticCurveTo(34, -6, 24, 20); g.closePath(); }
  else { g.beginPath(); g.moveTo(-24, 20); g.quadraticCurveTo(-28, -10, 0, -12); g.quadraticCurveTo(26, -10, 24, 20); g.closePath(); }
  g.fill(); g.stroke();
  g.fillStyle = ink; for (const [dx, dy] of kind === 'K' ? [[-30, -16], [0, -26], [30, -16]] : kind === 'Q' ? [[-14, -13], [0, -24], [14, -13]] : [[0, -6]]) { g.beginPath(); g.arc(dx, dy, 4, 0, TAU); g.fill(); }
  g.fillStyle = ink; g.fillRect(-26, 12, 52, 7);
  if (kind === 'J') { g.strokeStyle = '#a02020'; g.lineWidth = 4; g.beginPath(); g.moveTo(8, -10); g.quadraticCurveTo(38, -40, 42, -6); g.stroke(); }
  g.restore();
}
function paintFace(g, card, big, four) {
  const s = suitOf(card), r = rankOf(card), col = (four ? SUIT_INK.four : SUIT_INK.std)[s];
  const bg = g.createLinearGradient(0, 0, CW, CH); bg.addColorStop(0, '#fffaf0'); bg.addColorStop(1, '#efe2c4');
  g.fillStyle = bg; rr(g, 1, 1, CW - 2, CH - 2, 14); g.fill();
  g.strokeStyle = 'rgba(80,50,20,0.55)'; g.lineWidth = 2; g.stroke();
  g.strokeStyle = 'rgba(190,140,60,0.5)'; g.lineWidth = 1.2; rr(g, 6, 6, CW - 12, CH - 12, 10); g.stroke();
  const label = RANK_LABEL[r];
  const rankPx = big ? 66 : 50, suitPx = big ? 42 : 30;
  g.textAlign = 'center'; g.fillStyle = col;
  g.font = `800 ${rankPx}px ${UI}`; g.fillText(label, big ? 36 : 31, big ? 64 : 52);
  drawSuit(g, s, big ? 36 : 31, big ? 64 + 8 + suitPx / 2 : 52 + 8 + suitPx / 2 - 2, suitPx, col);
  g.save(); g.translate(CW, CH); g.rotate(Math.PI);
  g.font = `800 ${rankPx * 0.8}px ${UI}`; g.fillStyle = col; g.fillText(label, 30, 44);
  drawSuit(g, s, 30, 44 + 6 + suitPx * 0.4, suitPx * 0.8, col); g.restore();
  // centre art
  if (big) {
    if (r >= 4 && r <= 6) { g.fillStyle = 'rgba(224,178,90,0.25)'; rr(g, 66, 36, 70, 136, 10); g.fill(); crown(g, 101, 82, 1.1, ['J', 'Q', 'K'][r - 4], col); drawSuit(g, s, 101, 140, 46, col); }
    else drawSuit(g, s, 100, 108, r === 7 ? 96 : 78, col);
    return;
  }
  const x0 = 78, x1 = 128, y0 = 30, y1 = CH - 30;
  if (r >= 4 && r <= 6) {
    g.fillStyle = 'rgba(224,178,90,0.22)'; rr(g, 62, 22, 76, CH - 44, 10); g.fill(); g.strokeStyle = 'rgba(160,110,40,0.6)'; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = 'rgba(160,110,40,0.4)'; g.beginPath(); g.moveTo(62, CH / 2); g.lineTo(138, CH / 2); g.stroke();
    const kind = ['J', 'Q', 'K'][r - 4];
    crown(g, 100, 62, 1.15, kind, col); drawSuit(g, s, 100, 100, 30, col);
    g.save(); g.translate(CW, CH); g.rotate(Math.PI); crown(g, 100 - 2, 62, 1.15, kind, col); drawSuit(g, s, 100 - 2, 100, 30, col); g.restore();
    return;
  }
  if (r === 7) {
    g.strokeStyle = 'rgba(190,140,60,0.7)'; g.lineWidth = 2; star8(g, 100, CH / 2, 50, 0, 0.7); g.stroke();
    drawSuit(g, s, 100, CH / 2, 64, col); return;
  }
  for (const [cx, cy] of pipLayout(r)) {
    const x = x0 + (x1 - x0) * cx, y = y0 + (y1 - y0) * cy;
    g.save(); if (cy > 0.5) { g.translate(x, y); g.rotate(Math.PI); g.translate(-x, -y); } drawSuit(g, s, x, y, 34, col); g.restore();
  }
}
export function cardSprite(card, big, four) {
  const key = card + (big ? 100 : 0) + (four ? 200 : 0);
  let c = faceCache.get(key);
  if (c === undefined) { c = layer(CW, CH, SC, (g) => paintFace(g, card, big, four)); faceCache.set(key, c); }
  return c;
}
function paintBack(g) {
  const w = CW, h = CH;
  g.fillStyle = '#f4ead4'; rr(g, 1, 1, w - 2, h - 2, 14); g.fill();
  rr(g, 8, 8, w - 16, h - 16, 9); g.save(); g.clip();
  const f = g.createLinearGradient(0, 0, w, h); f.addColorStop(0, '#7d1d2b'); f.addColorStop(1, '#4b0f1d'); g.fillStyle = f; g.fillRect(0, 0, w, h);
  tilePattern(g, 8, 8, w - 16, h - 16, 44, 'rgba(232,190,110,0.75)', 1.4);
  g.fillStyle = 'rgba(224,178,90,0.9)'; star8(g, w / 2, h / 2, 30, 0, 0.6); g.fill(); g.fillStyle = '#7d1d2b'; star8(g, w / 2, h / 2, 17, Math.PI / 8, 0.6); g.fill();
  g.restore();
  g.strokeStyle = BRASS; g.lineWidth = 2; rr(g, 8, 8, w - 16, h - 16, 9); g.stroke();
  g.strokeStyle = 'rgba(80,50,20,0.6)'; g.lineWidth = 2; rr(g, 1, 1, w - 2, h - 2, 14); g.stroke();
}
export function backSprite() { if (backLayer === null) backLayer = layer(CW, CH, SC, paintBack) || undefined; return backLayer; }
// draw a face-up (or back) card with its top-left at (x, y), scale sc, rotation rot around its centre
export function drawCard(ctx, card, x, y, sc, opts = {}) {
  const w = CW * sc, h = CH * sc;
  ctx.save();
  if (opts.rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(opts.rot); ctx.translate(-w / 2, -h / 2); } else ctx.translate(x, y);
  if (!opts.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.32)'; rr(ctx, 3 * sc + 2, 6 * sc + 3, w, h, 14 * sc); ctx.fill(); }
  const spr = card < 0 ? backSprite() : cardSprite(card, !!opts.big, !!opts.four);
  if (spr) ctx.drawImage(spr, 0, 0, w, h); else { ctx.fillStyle = card < 0 ? '#6d1a28' : '#f6ead0'; rr(ctx, 0, 0, w, h, 14 * sc); ctx.fill(); }
  if (opts.dim) { ctx.fillStyle = 'rgba(20,10,10,0.42)'; rr(ctx, 0, 0, w, h, 14 * sc); ctx.fill(); }
  if (opts.glow) { ctx.strokeStyle = opts.glow; ctx.lineWidth = 6 * sc + 2; ctx.shadowColor = opts.glow; ctx.shadowBlur = 18; rr(ctx, 0, 0, w, h, 14 * sc); ctx.stroke(); }
  ctx.restore();
}

// ---- buttons / plaques ------------------------------------------------------------------------------------
export function button(ctx, r, label, o = {}) {
  ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
  const press = o.pulse ? Math.sin(o.pulse * 6) * 0.5 + 0.5 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; rr(ctx, r.x + 3, r.y + 7, r.w, r.h, 20); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  if (o.primary) { g.addColorStop(0, '#f6d47f'); g.addColorStop(1, '#c48a2a'); } else if (o.danger) { g.addColorStop(0, '#8b2a2a'); g.addColorStop(1, '#4d1414'); } else { g.addColorStop(0, '#6e2a35'); g.addColorStop(1, '#3d1119'); }
  ctx.fillStyle = g; rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fill();
  ctx.strokeStyle = o.glow ? `rgba(255,236,150,${0.6 + 0.4 * press})` : 'rgba(255,214,140,0.6)'; ctx.lineWidth = o.glow ? 5 : 2.5; if (o.glow) { ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 16 * (0.5 + press); } rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.stroke();
  ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,214,140,0.25)'; ctx.lineWidth = 1.2; rr(ctx, r.x + 6, r.y + 6, r.w - 12, r.h - 12, 15); ctx.stroke();
  ctx.fillStyle = o.primary ? '#2a1606' : '#f8e6bd'; ctx.textAlign = 'center';
  const size = o.size ?? 32;
  if (o.sub) { ctx.font = `800 ${size}px ${UI}`; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 - 2); ctx.font = `600 ${Math.round(size * 0.55)}px ${UI}`; ctx.fillStyle = o.primary ? 'rgba(42,22,6,0.8)' : 'rgba(248,230,189,0.8)'; ctx.fillText(o.sub, r.x + r.w / 2, r.y + r.h / 2 + size * 0.75); }
  else { ctx.font = `800 ${size}px ${UI}`; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + size * 0.35); }
  ctx.restore();
}
export function plaque(ctx, r, alpha = 0.72) {
  ctx.save(); ctx.fillStyle = `rgba(22,8,10,${alpha})`; rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.fill(); ctx.strokeStyle = 'rgba(224,178,90,0.75)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
}
export { star8 as ornamentStar, rosette };
