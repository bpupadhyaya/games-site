// All painted art: boteco wall with azulejo tiles, festive bunting, hanging bulbs, the felt table, the 40-card
// deck (faces, backs, manilha glow), gesture faces, buttons. Static art is painted ONCE into cached layers; a frame
// only draws them. No images: everything is canvas drawing.
import { W, H, CW, CH, TABLE } from './layout.js';
import { suitOf, rankOf, RANKS } from './rules.js';

export const FONT = '"Rockwell", "Rockwell Extra Bold", "Roboto Slab", Georgia, "Times New Roman", serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const GOLD = '#ffd23f', GOLD_D = '#c48a10', CREAM = '#fff6dd', GREEN = '#0f7a3f', BLUE = '#1c4fa0', INK = '#17120f', RED = '#c8102e';
const TAU = Math.PI * 2;

function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function layer(w, h, scale, paint) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const c = new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale));
  const g = c.getContext('2d'); g.scale(scale, scale); paint(g); return c;
}
export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

// ---- suits (ids here: 0 diamonds, 1 spades, 2 hearts, 3 clubs) -----------------------------------------------------
export const SUIT_INK = { std: ['#c8102e', '#17120f', '#c8102e', '#17120f'], four: ['#e07b00', '#17120f', '#c8102e', '#0e7a3a'] };
const PATH_ID = [2, 0, 1, 3]; // to the drawing routine's own numbering (0 spade, 1 heart, 2 diamond, 3 club)
export function suitPath(ctx, suit, cx, cy, s) {
  const u = s / 100, k = PATH_ID[suit]; ctx.beginPath();
  if (k === 1) {
    ctx.moveTo(cx, cy + 46 * u); ctx.bezierCurveTo(cx - 70 * u, cy - 4 * u, cx - 46 * u, cy - 56 * u, cx, cy - 20 * u);
    ctx.bezierCurveTo(cx + 46 * u, cy - 56 * u, cx + 70 * u, cy - 4 * u, cx, cy + 46 * u);
  } else if (k === 2) {
    ctx.moveTo(cx, cy - 50 * u); ctx.bezierCurveTo(cx + 12 * u, cy - 22 * u, cx + 34 * u, cy - 6 * u, cx + 42 * u, cy);
    ctx.bezierCurveTo(cx + 34 * u, cy + 6 * u, cx + 12 * u, cy + 22 * u, cx, cy + 50 * u);
    ctx.bezierCurveTo(cx - 12 * u, cy + 22 * u, cx - 34 * u, cy + 6 * u, cx - 42 * u, cy);
    ctx.bezierCurveTo(cx - 34 * u, cy - 6 * u, cx - 12 * u, cy - 22 * u, cx, cy - 50 * u);
  } else if (k === 0) {
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

// ---- ornament -----------------------------------------------------------------------------------------------------
export function star8(ctx, cx, cy, R, rot = 0, inner = 0.62) {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = rot + i * Math.PI / 8, r = i % 2 ? R * inner : R; ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  ctx.closePath();
}
// azulejo tile: four petals around a centre, quarter circles in the corners
function azulejo(g, x, y, s, col, lw) {
  g.save(); g.translate(x, y); g.strokeStyle = col; g.lineWidth = lw;
  g.strokeRect(2, 2, s - 4, s - 4);
  const c = s / 2;
  for (let i = 0; i < 4; i++) {
    g.save(); g.translate(c, c); g.rotate(i * Math.PI / 2);
    g.beginPath(); g.moveTo(0, -s * 0.06); g.bezierCurveTo(s * 0.2, -s * 0.12, s * 0.3, -s * 0.34, 0, -s * 0.42); g.bezierCurveTo(-s * 0.3, -s * 0.34, -s * 0.2, -s * 0.12, 0, -s * 0.06); g.stroke();
    g.restore();
  }
  g.beginPath(); g.arc(c, c, s * 0.06, 0, TAU); g.stroke();
  for (const [cx, cy, a] of [[0, 0, 0], [s, 0, 1], [s, s, 2], [0, s, 3]]) { g.beginPath(); g.arc(cx, cy, s * 0.2, a * Math.PI / 2, a * Math.PI / 2 + Math.PI / 2); g.stroke(); }
  g.restore();
}
export function tilePattern(g, x0, y0, w, h, cell, col, lw) {
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  for (let y = y0; y < y0 + h; y += cell) for (let x = x0; x < x0 + w; x += cell) azulejo(g, x, y, cell, col, lw);
  g.restore();
}
export function leaf(g, x, y, len, ang, col) {
  g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = col;
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * 0.25, -len * 0.28, len * 0.75, -len * 0.22, len, 0); g.bezierCurveTo(len * 0.75, len * 0.22, len * 0.25, len * 0.28, 0, 0); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.95, 0); g.stroke();
  g.restore();
}

// ---- backgrounds ----------------------------------------------------------------------------------------------------
let bgLayer = null, tableLayer = null;
function paintBackground(g) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#062f2a'); gr.addColorStop(0.55, '#0a4a3c'); gr.addColorStop(1, '#04221f');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  tilePattern(g, 0, 0, W, H, 120, 'rgba(120,180,255,0.17)', 1.6);
  tilePattern(g, 0, 0, W, H, 120, 'rgba(255,255,255,0.0)', 1);
  const rnd = lcg(11); g.fillStyle = 'rgba(0,0,0,0.07)'; for (let i = 0; i < 2000; i++) g.fillRect(rnd() * W, rnd() * H, 2, 1);
  // palm leaves in the lower corners
  for (const [x, y, flip] of [[0, H, 1], [W, H, -1]]) {
    for (let i = 0; i < 7; i++) leaf(g, x, y - 20, 330 + i * 12, -Math.PI / 2 + flip * (0.12 + i * 0.2) * -1 + (flip > 0 ? 0 : 0), `rgba(${12 + i * 3},${88 + i * 6},${52 + i * 4},0.5)`);
  }
  const v = g.createRadialGradient(W / 2, H * 0.48, 220, W / 2, H * 0.48, 1000); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.strokeStyle = GOLD; g.lineWidth = 3; g.strokeRect(10, 10, W - 20, H - 20); g.strokeStyle = 'rgba(255,210,63,0.4)'; g.lineWidth = 1.5; g.strokeRect(22, 22, W - 44, H - 44);
}
const FLAGS = ['#ffd23f', '#1c4fa0', '#fff6dd', '#0f9a4f', '#e8452c', '#ffd23f', '#1c4fa0', '#fff6dd', '#0f9a4f', '#e8452c'];
export function bunting(ctx, t, y0 = 0, amp = 1) {
  // two sagging strings of triangular flags
  for (const [ya, yb, sag, off] of [[18, 40, 46, 0], [10, 26, 34, 3]]) {
    const n = 13;
    ctx.strokeStyle = 'rgba(255,246,221,0.65)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const u = i / 40, x = u * W, y = y0 + ya + (yb - ya) * u + Math.sin(u * Math.PI) * sag; ctx[i ? 'lineTo' : 'moveTo'](x, y); }
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = u * W, y = y0 + ya + (yb - ya) * u + Math.sin(u * Math.PI) * sag;
      const sw = Math.sin(t * 1.6 + i * 0.9 + off) * 0.1 * amp;
      ctx.save(); ctx.translate(x, y); ctx.rotate(sw);
      ctx.fillStyle = FLAGS[(i + off) % FLAGS.length]; ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(17, 0); ctx.lineTo(0, 40); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
  }
}
function bulb(g, cx, top, s, t) {
  const flick = 0.88 + 0.12 * Math.sin(t * 5) * Math.sin(t * 2.3);
  const gl = g.createRadialGradient(cx, top + 60 * s, 4, cx, top + 60 * s, 140 * s); gl.addColorStop(0, `rgba(255,214,120,${0.5 * flick})`); gl.addColorStop(1, 'rgba(255,200,90,0)');
  g.fillStyle = gl; g.fillRect(cx - 150 * s, top - 30 * s, 300 * s, 300 * s);
  g.strokeStyle = '#20150a'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, top + 10 * s); g.stroke();
  g.fillStyle = '#3a2a16'; g.fillRect(cx - 9 * s, top + 8 * s, 18 * s, 18 * s);
  const b = g.createRadialGradient(cx - 6 * s, top + 44 * s, 2, cx, top + 52 * s, 30 * s); b.addColorStop(0, '#fffbe0'); b.addColorStop(0.5, `rgba(255,${200 + flick * 30},110,1)`); b.addColorStop(1, 'rgba(255,170,60,0.95)');
  g.fillStyle = b; g.beginPath(); g.arc(cx, top + 50 * s, 24 * s, 0, TAU); g.fill();
}
export function drawBackground(ctx, t) {
  if (!bgLayer) bgLayer = layer(W, H, 1.5, paintBackground);
  if (bgLayer) ctx.drawImage(bgLayer, 0, 0, W, H); else { ctx.fillStyle = '#073a31'; ctx.fillRect(0, 0, W, H); }
  bulb(ctx, 36, 84, 0.55, t); bulb(ctx, W - 36, 84, 0.55, t + 1.9);
}
function paintTable(g) {
  const { x, y, w, h } = TABLE, c = 90;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 36; g.shadowOffsetY = 14; rr(g, x - 22, y - 22, w + 44, h + 44, c + 20); g.fillStyle = '#2a170a'; g.fill(); g.restore();
  rr(g, x - 22, y - 22, w + 44, h + 44, c + 20);
  const wood = g.createLinearGradient(x, y, x + w, y + h); wood.addColorStop(0, '#9a5f2c'); wood.addColorStop(0.5, '#62381a'); wood.addColorStop(1, '#85502a'); g.fillStyle = wood; g.fill();
  const rnd = lcg(5); g.save(); rr(g, x - 22, y - 22, w + 44, h + 44, c + 20); g.clip(); g.strokeStyle = 'rgba(30,14,4,0.35)'; g.lineWidth = 1.5;
  for (let i = 0; i < 46; i++) { const yy = y - 22 + rnd() * (h + 44); g.beginPath(); g.moveTo(x - 22, yy); g.bezierCurveTo(x + w * 0.3, yy + rnd() * 10 - 5, x + w * 0.7, yy + rnd() * 10 - 5, x + w + 22, yy + rnd() * 8 - 4); g.stroke(); } g.restore();
  rr(g, x - 7, y - 7, w + 14, h + 14, c + 5); g.strokeStyle = GOLD; g.lineWidth = 4; g.stroke();
  rr(g, x, y, w, h, c);
  const f = g.createRadialGradient(x + w / 2, y + h / 2, 30, x + w / 2, y + h / 2, 400); f.addColorStop(0, '#12935a'); f.addColorStop(1, '#0a4a2c'); g.fillStyle = f; g.fill();
  g.save(); rr(g, x, y, w, h, c); g.clip();
  for (let i = 0; i < 4200; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},0.035)`; g.fillRect(x + rnd() * w, y + rnd() * h, 2, 1); }
  // inlaid rhombus and disc (colours of the flag, very soft)
  const cx = x + w / 2, cy = y + h / 2;
  g.strokeStyle = 'rgba(255,210,63,0.34)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy - 235); g.lineTo(cx + 275, cy); g.lineTo(cx, cy + 235); g.lineTo(cx - 275, cy); g.closePath(); g.stroke();
  g.strokeStyle = 'rgba(28,79,160,0.5)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 130, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(cx, cy, 142, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,210,63,0.12)'; star8(g, cx, cy, 40, 0, 0.5); g.fill();
  g.restore();
  rr(g, x, y, w, h, c); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.stroke();
}
export function drawTable(ctx, t) {
  if (!tableLayer) tableLayer = layer(W, H, 1.5, paintTable);
  if (tableLayer) ctx.drawImage(tableLayer, 0, 0, W, H);
  const cx = W / 2, cy = TABLE.y + TABLE.h / 2, f = 0.9 + 0.1 * Math.sin(t * 1.3);
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 340); g.addColorStop(0, `rgba(255,224,150,${0.15 * f})`); g.addColorStop(1, 'rgba(255,224,150,0)');
  ctx.fillStyle = g; ctx.fillRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h);
}

// ---- cards ------------------------------------------------------------------------------------------------------------
const faceCache = new Map();
let backLayer = null;
const SC = 2;
function pipLayout(r) {                    // r = rank index; returns pips as [col, row] with col 0 left, .5 middle, 1 right
  const L = 0, M = 0.5, Rr = 1;
  switch (RANKS[r]) {
    case 'A': return [[M, 0.5]];
    case '2': return [[M, 0.1], [M, 0.9]];
    case '3': return [[M, 0.1], [M, 0.5], [M, 0.9]];
    case '4': return [[L, 0.1], [Rr, 0.1], [L, 0.9], [Rr, 0.9]];
    case '5': return [[L, 0.1], [Rr, 0.1], [M, 0.5], [L, 0.9], [Rr, 0.9]];
    case '6': return [[L, 0.1], [Rr, 0.1], [L, 0.5], [Rr, 0.5], [L, 0.9], [Rr, 0.9]];
    default: return [[L, 0.1], [Rr, 0.1], [M, 0.3], [L, 0.5], [Rr, 0.5], [L, 0.9], [Rr, 0.9]]; // 7
  }
}
function crown(g, x, y, s, kind, ink) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#f2b705'; g.strokeStyle = '#7a4f17'; g.lineWidth = 1.6;
  if (kind === 'K') { g.beginPath(); g.moveTo(-26, 20); g.lineTo(-30, -14); g.lineTo(-14, 0); g.lineTo(0, -24); g.lineTo(14, 0); g.lineTo(30, -14); g.lineTo(26, 20); g.closePath(); }
  else if (kind === 'Q') { g.beginPath(); g.moveTo(-24, 20); g.quadraticCurveTo(-34, -6, -14, -12); g.quadraticCurveTo(0, -30, 14, -12); g.quadraticCurveTo(34, -6, 24, 20); g.closePath(); }
  else { g.beginPath(); g.moveTo(-24, 20); g.quadraticCurveTo(-28, -10, 0, -12); g.quadraticCurveTo(26, -10, 24, 20); g.closePath(); }
  g.fill(); g.stroke();
  g.fillStyle = ink; for (const [dx, dy] of kind === 'K' ? [[-30, -16], [0, -26], [30, -16]] : kind === 'Q' ? [[-14, -13], [0, -24], [14, -13]] : [[0, -6]]) { g.beginPath(); g.arc(dx, dy, 4, 0, TAU); g.fill(); }
  g.fillStyle = ink; g.fillRect(-26, 12, 52, 7);
  if (kind === 'J') { g.strokeStyle = '#1c4fa0'; g.lineWidth = 4; g.beginPath(); g.moveTo(8, -10); g.quadraticCurveTo(38, -40, 42, -6); g.stroke(); }
  g.restore();
}
function paintFace(g, card, big, four) {
  const s = suitOf(card), r = rankOf(card), col = (four ? SUIT_INK.four : SUIT_INK.std)[s], label = RANKS[r];
  const bg = g.createLinearGradient(0, 0, CW, CH); bg.addColorStop(0, '#fffdf4'); bg.addColorStop(1, '#f0e6c8');
  g.fillStyle = bg; rr(g, 1, 1, CW - 2, CH - 2, 14); g.fill();
  g.strokeStyle = 'rgba(60,40,20,0.6)'; g.lineWidth = 2; g.stroke();
  g.strokeStyle = 'rgba(28,79,160,0.35)'; g.lineWidth = 1.2; rr(g, 6, 6, CW - 12, CH - 12, 10); g.stroke();
  const rankPx = big ? 60 : 44, suitPx = big ? 38 : 26;
  g.textAlign = 'center'; g.fillStyle = col;
  g.font = `800 ${rankPx}px ${UI}`; g.fillText(label, 26, big ? 58 : 46);
  drawSuit(g, s, 26, big ? 58 + 8 + suitPx / 2 : 46 + 8 + suitPx / 2 - 2, suitPx, col);
  g.save(); g.translate(CW, CH); g.rotate(Math.PI);
  g.font = `800 ${rankPx}px ${UI}`; g.fillStyle = col; g.fillText(label, 26, big ? 58 : 46);
  drawSuit(g, s, 26, big ? 58 + 8 + suitPx / 2 : 46 + 8 + suitPx / 2 - 2, suitPx, col); g.restore();
  const isFace = label === 'J' || label === 'Q' || label === 'K';
  const cx0 = CW / 2 + 1;
  if (isFace) {
    g.fillStyle = 'rgba(242,183,5,0.22)'; rr(g, cx0 - 30, 26, 60, CH - 52, 10); g.fill(); g.strokeStyle = 'rgba(160,110,40,0.6)'; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = 'rgba(160,110,40,0.4)'; g.beginPath(); g.moveTo(cx0 - 30, CH / 2); g.lineTo(cx0 + 30, CH / 2); g.stroke();
    crown(g, cx0, 66, 0.95, label, col); drawSuit(g, s, cx0, 100, big ? 34 : 26, col);
    g.save(); g.translate(CW, CH); g.rotate(Math.PI); crown(g, CW - cx0, 66, 0.95, label, col); drawSuit(g, s, CW - cx0, 100, big ? 34 : 26, col); g.restore();
    return;
  }
  if (label === 'A') {
    g.strokeStyle = 'rgba(28,79,160,0.5)'; g.lineWidth = 2; star8(g, cx0, CH / 2, big ? 50 : 40, 0, 0.7); g.stroke();
    drawSuit(g, s, cx0, CH / 2, big ? 78 : 56, col); return;
  }
  const xl = 58, xr = 94, y0 = 34, y1 = CH - 34, pip = big ? 38 : 32;
  for (const [cx, cy] of pipLayout(r)) {
    const x = cx === 0.5 ? cx0 : cx === 0 ? xl : xr, y = y0 + (y1 - y0) * cy;
    g.save(); if (cy > 0.5) { g.translate(x, y); g.rotate(Math.PI); g.translate(-x, -y); } drawSuit(g, s, x, y, pip, col); g.restore();
  }
}
export function cardSprite(card, big, four) {
  const key = card + (big ? 100 : 0) + (four ? 200 : 0);
  let c = faceCache.get(key);
  if (c === undefined) { c = layer(CW, CH, SC, (g) => paintFace(g, card, big, four)) || null; faceCache.set(key, c); }
  return c;
}
function paintBack(g) {
  const w = CW, h = CH;
  g.fillStyle = '#fff6dd'; rr(g, 1, 1, w - 2, h - 2, 14); g.fill();
  rr(g, 9, 9, w - 18, h - 18, 9); g.save(); g.clip();
  const f = g.createLinearGradient(0, 0, w, h); f.addColorStop(0, '#1c4fa0'); f.addColorStop(1, '#10316c'); g.fillStyle = f; g.fillRect(0, 0, w, h);
  tilePattern(g, 9, 9, w - 18, h - 18, 44, 'rgba(255,246,221,0.7)', 1.4);
  g.fillStyle = GOLD; star8(g, w / 2, h / 2, 28, 0, 0.55); g.fill(); g.fillStyle = '#10316c'; star8(g, w / 2, h / 2, 15, Math.PI / 8, 0.55); g.fill();
  g.restore();
  g.strokeStyle = GOLD; g.lineWidth = 2.4; rr(g, 9, 9, w - 18, h - 18, 9); g.stroke();
  g.strokeStyle = 'rgba(60,40,20,0.6)'; g.lineWidth = 2; rr(g, 1, 1, w - 2, h - 2, 14); g.stroke();
}
export function backSprite() { if (backLayer === null) backLayer = layer(CW, CH, SC, paintBack) || undefined; return backLayer; }
// Draw a face-up (card >= 0) or face-down (card < 0) card with its top-left at (x, y), scale sc.
// opts: big, four, dim, glow, rot, noShadow, man (manilha shimmer, pass the clock in `t`)
export function drawCard(ctx, card, x, y, sc, opts = {}) {
  const w = CW * sc, h = CH * sc;
  ctx.save();
  if (opts.rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(opts.rot); ctx.translate(-w / 2, -h / 2); } else ctx.translate(x, y);
  if (!opts.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.32)'; rr(ctx, 3 * sc + 2, 6 * sc + 3, w, h, 14 * sc); ctx.fill(); }
  const spr = card < 0 ? backSprite() : cardSprite(card, !!opts.big, !!opts.four);
  if (spr) ctx.drawImage(spr, 0, 0, w, h); else { ctx.fillStyle = card < 0 ? '#1c4fa0' : '#fff6dd'; rr(ctx, 0, 0, w, h, 14 * sc); ctx.fill(); }
  if (opts.man && card >= 0) {
    const ph = ((opts.t ?? 0) * 0.7) % 1;
    ctx.save(); rr(ctx, 0, 0, w, h, 14 * sc); ctx.clip();
    const gx = -w + ph * w * 3, gg = ctx.createLinearGradient(gx, 0, gx + w * 0.5, h * 0.6); gg.addColorStop(0, 'rgba(255,230,120,0)'); gg.addColorStop(0.5, 'rgba(255,230,120,0.42)'); gg.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = gg; ctx.fillRect(0, 0, w, h); ctx.restore();
    ctx.strokeStyle = 'rgba(255,200,40,0.95)'; ctx.lineWidth = 3.4 * Math.max(sc, 0.5); ctx.shadowColor = '#ffc928'; ctx.shadowBlur = 10; rr(ctx, 0, 0, w, h, 14 * sc); ctx.stroke(); ctx.shadowBlur = 0;
  }
  if (opts.dim) { ctx.fillStyle = 'rgba(8,16,12,0.45)'; rr(ctx, 0, 0, w, h, 14 * sc); ctx.fill(); }
  if (opts.glow) { ctx.strokeStyle = opts.glow; ctx.lineWidth = 6 * sc + 2; ctx.shadowColor = opts.glow; ctx.shadowBlur = 18; rr(ctx, 0, 0, w, h, 14 * sc); ctx.stroke(); }
  ctx.restore();
}

// ---- gestures: the traditional faces that partners use at the table ----------------------------------------------------
export function drawGesture(ctx, kind, cx, cy, r) {
  ctx.save(); ctx.translate(cx, cy);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r); g.addColorStop(0, '#ffe9a8'); g.addColorStop(1, '#f2b705');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#7a4f17'; ctx.lineWidth = Math.max(2, r * 0.07); ctx.stroke();
  ctx.fillStyle = '#2a1606'; ctx.strokeStyle = '#2a1606'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2.5, r * 0.09);
  const ex = r * 0.36, ey = -r * 0.14, er = r * 0.11;
  const eye = (x, y) => { ctx.beginPath(); ctx.arc(x, y, er, 0, TAU); ctx.fill(); };
  if (kind === 'zap') {            // wink
    eye(-ex, ey); ctx.beginPath(); ctx.arc(ex, ey, er * 1.3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  } else if (kind === 'manilha') { // one raised brow
    eye(-ex, ey); eye(ex, ey);
    ctx.beginPath(); ctx.moveTo(-ex - r * 0.16, ey - r * 0.2); ctx.lineTo(-ex + r * 0.16, ey - r * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex - r * 0.16, ey - r * 0.42); ctx.quadraticCurveTo(ex, ey - r * 0.56, ex + r * 0.18, ey - r * 0.38); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, r * 0.14, r * 0.34, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  } else if (kind === 'three') {   // pursed lips pointing to one side
    eye(-ex, ey); eye(ex, ey);
    ctx.beginPath(); ctx.ellipse(r * 0.22, r * 0.42, r * 0.14, r * 0.17, 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8452c'; ctx.beginPath(); ctx.ellipse(r * 0.22, r * 0.42, r * 0.07, r * 0.09, 0.4, 0, TAU); ctx.fill();
  } else {                         // shrug: flat mouth, tilted brows
    eye(-ex, ey); eye(ex, ey);
    ctx.beginPath(); ctx.moveTo(-ex - r * 0.16, ey - r * 0.18); ctx.lineTo(-ex + r * 0.14, ey - r * 0.32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex + r * 0.16, ey - r * 0.18); ctx.lineTo(ex - r * 0.14, ey - r * 0.32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.4); ctx.quadraticCurveTo(0, r * 0.3, r * 0.3, r * 0.44); ctx.stroke();
  }
  ctx.restore();
}

// ---- buttons / plaques ---------------------------------------------------------------------------------------------------
// Pointer feedback for the pressed state: game.update() feeds this every frame (pure state, no DOM).
const ptr = { x: -1, y: -1, t: 0 };
export function feedPointer(p, dt) {
  if (p.pressed) { ptr.x = p.x; ptr.y = p.y; ptr.t = 0.16; }
  else if (p.down) { ptr.x = p.x; ptr.y = p.y; ptr.t = Math.max(ptr.t, 0.02); }
  else ptr.t = Math.max(0, ptr.t - dt);
}
// One button style for the whole game: a single flat-ish fill, one crisp border, soft shadow, clear pressed state.
export function button(ctx, r, label, o = {}) {
  ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
  const press = o.pulse ? Math.sin(o.pulse * 6) * 0.5 + 0.5 : 0;
  const down = ptr.t > 0 && ptr.x >= r.x && ptr.x <= r.x + r.w && ptr.y >= r.y && ptr.y <= r.y + r.h;
  const dy = down ? 3 : 0, R0 = 18;
  ctx.fillStyle = 'rgba(0,0,0,0.32)'; rr(ctx, r.x + 1, r.y + (down ? 3 : 6), r.w, r.h, R0); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  let edge;
  if (o.primary) { g.addColorStop(0, '#f6c93a'); g.addColorStop(1, '#e0a712'); edge = '#fff0b0'; }
  else if (o.danger) { g.addColorStop(0, '#c63a26'); g.addColorStop(1, '#a22a1a'); edge = '#ff9c88'; }
  else if (o.on) { g.addColorStop(0, '#1c9a58'); g.addColorStop(1, '#14804a'); edge = '#8ff0b8'; }
  else { g.addColorStop(0, '#1f5683'); g.addColorStop(1, '#17426b'); edge = 'rgba(255,224,140,0.85)'; }
  ctx.fillStyle = g; rr(ctx, r.x, r.y + dy, r.w, r.h, R0); ctx.fill();
  if (down) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; rr(ctx, r.x, r.y + dy, r.w, r.h, R0); ctx.fill(); }
  ctx.strokeStyle = o.glow ? `rgba(255,236,150,${0.6 + 0.4 * press})` : edge; ctx.lineWidth = o.glow ? 4 : 2;
  if (o.glow) { ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 16 * (0.5 + press); }
  rr(ctx, r.x, r.y + dy, r.w, r.h, R0); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = o.primary ? '#2a1606' : '#fff6dd'; ctx.textAlign = 'center';
  let size = o.size ?? 32;
  ctx.font = `800 ${size}px ${UI}`;
  while (size > 12 && ctx.measureText(label).width > r.w - 24) { size -= 1; ctx.font = `800 ${size}px ${UI}`; }
  const cy = r.y + dy;
  if (o.sub) {
    ctx.fillText(label, r.x + r.w / 2, cy + r.h / 2 - 2);
    let ss = Math.round(size * 0.56); ctx.font = `600 ${ss}px ${UI}`; while (ss > 10 && ctx.measureText(o.sub).width > r.w - 24) { ss -= 1; ctx.font = `600 ${ss}px ${UI}`; }
    ctx.fillStyle = o.primary ? 'rgba(42,22,6,0.8)' : 'rgba(255,246,221,0.88)'; ctx.fillText(o.sub, r.x + r.w / 2, cy + r.h / 2 + size * 0.78);
  } else ctx.fillText(label, r.x + r.w / 2, cy + r.h / 2 + size * 0.35);
  ctx.restore();
}
export function plaque(ctx, r, alpha = 0.72) {
  ctx.save(); ctx.fillStyle = `rgba(4,26,22,${alpha})`; rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.fill(); ctx.strokeStyle = 'rgba(255,210,63,0.75)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
}
