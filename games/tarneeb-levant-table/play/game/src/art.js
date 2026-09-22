// Painted art: the cafe table (felt, walnut rail, geometric star border) and the cards. Static art is drawn once into
// cached layers/sprites (OffscreenCanvas), so a frame costs a handful of drawImage calls.
import { W, H } from './layout.js';
import { suitOf, rankOf, RANK_CH } from './rules.js';

const TAU = Math.PI * 2;
export const INK = '#1c1a22', RED = '#b5202c', CREAM = '#f7efdc';
export const suitColor = (s) => (s === 1 || s === 2 ? RED : INK);

// ---- suit shapes (filled around centre cx, cy, roughly `r` tall/2) ------------------------------------------
export function suitPath(ctx, s, cx, cy, r) {
  ctx.beginPath();
  if (s === 1) { // heart
    ctx.moveTo(cx, cy + r);
    ctx.bezierCurveTo(cx - r * 1.5, cy - r * 0.1, cx - r * 0.9, cy - r * 1.1, cx, cy - r * 0.35);
    ctx.bezierCurveTo(cx + r * 0.9, cy - r * 1.1, cx + r * 1.5, cy - r * 0.1, cx, cy + r);
  } else if (s === 2) { // diamond
    ctx.moveTo(cx, cy - r * 1.05); ctx.quadraticCurveTo(cx + r * 0.15, cy - r * 0.2, cx + r * 0.78, cy);
    ctx.quadraticCurveTo(cx + r * 0.15, cy + r * 0.2, cx, cy + r * 1.05); ctx.quadraticCurveTo(cx - r * 0.15, cy + r * 0.2, cx - r * 0.78, cy);
    ctx.quadraticCurveTo(cx - r * 0.15, cy - r * 0.2, cx, cy - r * 1.05);
  } else if (s === 0) { // spade
    ctx.moveTo(cx, cy - r);
    ctx.bezierCurveTo(cx + r * 0.3, cy - r * 0.55, cx + r * 1.35, cy - r * 0.15, cx + r * 0.95, cy + r * 0.4);
    ctx.bezierCurveTo(cx + r * 0.7, cy + r * 0.75, cx + r * 0.2, cy + r * 0.6, cx + r * 0.1, cy + r * 0.35);
    ctx.quadraticCurveTo(cx + r * 0.12, cy + r * 0.85, cx + r * 0.5, cy + r);
    ctx.lineTo(cx - r * 0.5, cy + r); ctx.quadraticCurveTo(cx - r * 0.12, cy + r * 0.85, cx - r * 0.1, cy + r * 0.35);
    ctx.bezierCurveTo(cx - r * 0.2, cy + r * 0.6, cx - r * 0.7, cy + r * 0.75, cx - r * 0.95, cy + r * 0.4);
    ctx.bezierCurveTo(cx - r * 1.35, cy - r * 0.15, cx - r * 0.3, cy - r * 0.55, cx, cy - r);
  } else { // club: three lobes and a stem
    const k = r * 0.5;
    ctx.arc(cx, cy - r * 0.42, k, 0, TAU); ctx.moveTo(cx - r * 0.42 + k, cy + r * 0.2); ctx.arc(cx - r * 0.42, cy + r * 0.2, k, 0, TAU);
    ctx.moveTo(cx + r * 0.42 + k, cy + r * 0.2); ctx.arc(cx + r * 0.42, cy + r * 0.2, k, 0, TAU);
    ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx + r * 0.05, cy + r * 0.7, cx + r * 0.5, cy + r); ctx.lineTo(cx - r * 0.5, cy + r); ctx.quadraticCurveTo(cx - r * 0.05, cy + r * 0.7, cx, cy);
  }
  ctx.closePath();
}
export function suit(ctx, s, cx, cy, r, color) { suitPath(ctx, s, cx, cy, r); ctx.fillStyle = color ?? suitColor(s); ctx.fill(); }

// ---- geometric ornament -------------------------------------------------------------------------------------
// The eight-pointed star (two squares) inside a ring: a purely geometric tile.
export function star8(ctx, cx, cy, r, stroke, fill) {
  ctx.save(); ctx.translate(cx, cy);
  for (let k = 0; k < 2; k++) { ctx.save(); ctx.rotate(k * Math.PI / 4); ctx.beginPath(); ctx.rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); if (fill && k === 0) { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = stroke; ctx.stroke(); ctx.restore(); }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, TAU); ctx.stroke();
  ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); } ctx.closePath(); ctx.stroke();
  ctx.restore();
}
// a lattice band between two rectangles
function band(ctx, x, y, w, h, vertical) {
  const g = ctx.createLinearGradient(x, y, vertical ? x + w : x, vertical ? y : y + h);
  g.addColorStop(0, '#5a3b1c'); g.addColorStop(0.5, '#7a5228'); g.addColorStop(1, '#4a2f15');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const n = Math.round((vertical ? h : w) / 46), step = (vertical ? h : w) / n;
  ctx.lineWidth = 1.6;
  for (let i = 0; i < n; i++) {
    const cx = vertical ? x + w / 2 : x + step * (i + 0.5), cy = vertical ? y + step * (i + 0.5) : y + h / 2;
    star8(ctx, cx, cy, Math.min(w, h) * 0.46, 'rgba(240,205,130,0.85)', i % 2 ? 'rgba(20,60,50,0.55)' : 'rgba(110,30,30,0.5)');
  }
}
function paintTable(c) {
  // felt: deep green with a warm lamp pool in the middle
  const g = c.createRadialGradient(360, 820, 60, 360, 820, 980);
  g.addColorStop(0, '#2f7a56'); g.addColorStop(0.55, '#1d5a41'); g.addColorStop(1, '#0d3527');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // woven texture: fine crossing diagonals
  c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.07)';
  c.beginPath(); for (let i = -H; i < W; i += 7) { c.moveTo(i, 0); c.lineTo(i + H, H); } c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.035)';
  c.beginPath(); for (let i = 0; i < W + H; i += 7) { c.moveTo(i, 0); c.lineTo(i - H, H); } c.stroke();
  // central inlay: a large star ring under the trick area
  c.save(); c.lineWidth = 2.4; c.globalAlpha = 0.5; star8(c, 360, 812, 300, 'rgba(240,205,130,0.55)'); c.lineWidth = 1.4; star8(c, 360, 812, 220, 'rgba(240,205,130,0.4)'); c.beginPath(); c.arc(360, 812, 330, 0, TAU); c.stroke(); c.restore();
  // walnut frame with a star band
  const B = 46; band(c, 0, 0, W, B, false); band(c, 0, H - B, W, B, false); band(c, 0, B, B, H - 2 * B, true); band(c, W - B, B, B, H - 2 * B, true);
  c.strokeStyle = '#e8c377'; c.lineWidth = 3; c.strokeRect(B, B, W - 2 * B, H - 2 * B); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 6; c.strokeRect(B + 4, B + 4, W - 2 * B - 8, H - 2 * B - 8);
  // corner medallions
  for (const [x, y] of [[B, B], [W - B, B], [B, H - B], [W - B, H - B]]) {
    c.fillStyle = '#3a2411'; c.beginPath(); c.arc(x, y, 34, 0, TAU); c.fill(); c.strokeStyle = '#e8c377'; c.lineWidth = 3; c.stroke(); c.lineWidth = 1.6; star8(c, x, y, 26, 'rgba(240,205,130,0.9)');
  }
  // walnut rail at the bottom for the buttons, with a brass edge
  const r = c.createLinearGradient(0, 1462, 0, H); r.addColorStop(0, '#4d2f16'); r.addColorStop(1, '#2a180a');
  c.fillStyle = r; c.fillRect(B, 1462, W - 2 * B, H - 1462 - B); c.fillStyle = '#e8c377'; c.fillRect(B, 1460, W - 2 * B, 3);
  // vignette
  const v = c.createRadialGradient(360, 780, 420, 360, 780, 1000); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}
const cache = {};
function layer(key, w, h, scale, paint, fallback) {
  if (!(key in cache)) {
    cache[key] = null;
    try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(w * scale, h * scale), cx = c.getContext('2d'); cx.scale(scale, scale); paint(cx); cache[key] = c; } } catch { cache[key] = null; }
  }
  return cache[key];
}
export function drawTable(ctx) {
  const l = layer('table', W, H, 2, paintTable);
  if (l) ctx.drawImage(l, 0, 0, W, H); else paintTable(ctx);
}
// warm lantern glow at the two top corners (animated by the caller through `t`)
export function drawLanterns(ctx, t, calm) {
  for (const x of [92, W - 92]) {
    const f = calm ? 1 : 0.85 + Math.sin(t * 2.3 + x) * 0.1 + Math.sin(t * 5.1 + x * 3) * 0.05;
    const g = ctx.createRadialGradient(x, 108, 4, x, 108, 150); g.addColorStop(0, `rgba(255,205,120,${0.42 * f})`); g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 160, 0, 320, 300);
  }
}

// ---- cards --------------------------------------------------------------------------------------------------
const PIPS = { // [x, y] in 0..1 of the pip area, y > 0.5 pips are drawn upside down
  1: [[0.5, 0.5]], 2: [[0.5, 0.12], [0.5, 0.88]], 3: [[0.5, 0.12], [0.5, 0.5], [0.5, 0.88]], 4: [[0.25, 0.12], [0.75, 0.12], [0.25, 0.88], [0.75, 0.88]],
  5: [[0.25, 0.12], [0.75, 0.12], [0.5, 0.5], [0.25, 0.88], [0.75, 0.88]], 6: [[0.25, 0.12], [0.75, 0.12], [0.25, 0.5], [0.75, 0.5], [0.25, 0.88], [0.75, 0.88]],
  7: [[0.25, 0.12], [0.75, 0.12], [0.5, 0.31], [0.25, 0.5], [0.75, 0.5], [0.25, 0.88], [0.75, 0.88]],
  8: [[0.25, 0.12], [0.75, 0.12], [0.5, 0.31], [0.25, 0.5], [0.75, 0.5], [0.5, 0.69], [0.25, 0.88], [0.75, 0.88]],
  9: [[0.25, 0.1], [0.75, 0.1], [0.25, 0.37], [0.75, 0.37], [0.5, 0.5], [0.25, 0.63], [0.75, 0.63], [0.25, 0.9], [0.75, 0.9]],
  10: [[0.25, 0.1], [0.75, 0.1], [0.5, 0.235], [0.25, 0.37], [0.75, 0.37], [0.25, 0.63], [0.75, 0.63], [0.5, 0.765], [0.25, 0.9], [0.75, 0.9]],
};
const FONT = '"Cormorant Garamond", Georgia, serif';
export const CW = 108, CH = 158;
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function paintFace(c, card, big) {
  const s = suitOf(card), r = rankOf(card), col = suitColor(s), label = RANK_CH[r];
  const g = c.createLinearGradient(0, 0, CW, CH); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#ece0c6');
  rr(c, 1, 1, CW - 2, CH - 2, 12); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(70,50,30,0.65)'; c.lineWidth = 2; c.stroke();
  rr(c, 6, 6, CW - 12, CH - 12, 8); c.strokeStyle = 'rgba(150,110,50,0.28)'; c.lineWidth = 1; c.stroke();
  // index (top-left), and mirrored bottom-right
  const idx = (flip) => {
    c.save(); if (flip) { c.translate(CW, CH); c.rotate(Math.PI); }
    c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const fs = big ? (label.length > 1 ? 40 : 46) : (label.length > 1 ? 30 : 34);
    c.font = `700 ${fs}px ${FONT}`; c.fillText(label, big ? 26 : 22, big ? 46 : 38);
    suit(c, s, big ? 26 : 22, big ? 74 : 60, big ? 15 : 11.5); c.restore();
  };
  idx(false); idx(true);
  // centre
  const ax = 44, ay = 18, aw = CW - 88, ah = CH - 36;
  if (big) { suit(c, s, CW * 0.58, CH * 0.52, r === 12 || r >= 9 ? 34 : 30 + 0); c.fillStyle = col; c.font = `700 26px ${FONT}`; c.textAlign = 'center'; c.fillText(r >= 9 ? ['J', 'Q', 'K', 'A'][r - 9] : '', CW * 0.58, CH * 0.9); return; }
  if (r >= 9 && r <= 11) { // court cards: a geometric medallion with the letter
    c.save(); c.translate(CW / 2 + 6, CH / 2); c.lineWidth = 2; c.strokeStyle = col;
    for (let i = 0; i < 2; i++) { c.save(); c.rotate(i * Math.PI / 4); rr(c, -26, -26, 52, 52, 4); c.fillStyle = i ? 'rgba(200,150,60,0.22)' : 'rgba(200,150,60,0.12)'; c.fill(); c.stroke(); c.restore(); }
    c.fillStyle = col; c.font = `700 40px ${FONT}`; c.textAlign = 'center'; c.fillText(label, 0, 13);
    suit(c, s, 0, -44, 9, col); suit(c, s, 0, 46, 9, col); c.restore(); return;
  }
  if (r === 12) { suit(c, s, CW / 2 + 6, CH / 2, 34, col); c.save(); c.translate(CW / 2 + 6, CH / 2); c.lineWidth = 1.5; c.strokeStyle = 'rgba(150,110,50,0.5)'; star8(c, 0, 0, 40, 'rgba(150,110,50,0.5)'); c.restore(); return; }
  const n = r + 2;
  for (const [px, py] of PIPS[n]) {
    const x = ax + px * aw + 6, y = ay + py * ah;
    c.save(); c.translate(x, y); if (py > 0.5) c.rotate(Math.PI); suit(c, s, 0, 0, n > 6 ? 12 : 14, col); c.restore();
  }
}
function paintBack(c, tint) {
  rr(c, 1, 1, CW - 2, CH - 2, 12); c.fillStyle = '#f4ead2'; c.fill(); c.strokeStyle = 'rgba(70,50,30,0.7)'; c.lineWidth = 2; c.stroke();
  rr(c, 7, 7, CW - 14, CH - 14, 7); const g = c.createLinearGradient(0, 0, CW, CH); g.addColorStop(0, tint[0]); g.addColorStop(1, tint[1]);
  c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(240,205,130,0.9)'; c.lineWidth = 2; c.stroke();
  c.save(); rr(c, 7, 7, CW - 14, CH - 14, 7); c.clip(); c.lineWidth = 1.2;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) star8(c, 18 + x * 36 + (y % 2) * 0, 26 + y * 36, 17, 'rgba(240,205,130,0.6)');
  star8(c, CW / 2, CH / 2, 30, 'rgba(255,225,150,0.95)', 'rgba(20,20,30,0.35)'); c.restore();
}
const BACKS = { garnet: ['#7a1f2b', '#4a1019'], teal: ['#1c6b6b', '#0e3d43'], indigo: ['#2a3f86', '#161f4d'] };
export function cardSprite(card, big) { return layer(`c${card}${big ? 'b' : ''}`, CW, CH, 2, (c) => paintFace(c, card, big)); }
export function backSprite(kind = 'garnet') { return layer(`back${kind}`, CW, CH, 1.5, (c) => paintBack(c, BACKS[kind] || BACKS.garnet)); }
export const BACK_KINDS = Object.keys(BACKS);
// Draw a card face (or back when card < 0) with its top-left at (x, y), size w x h; rot in radians about its centre.
export function drawCard(ctx, card, x, y, w, h, o = {}) {
  ctx.save();
  if (o.rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(o.rot); ctx.translate(-w / 2, -h / 2); } else ctx.translate(x, y);
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.roundRect(2, 4, w, h, 10); ctx.fill(); }
  const sp = card < 0 ? backSprite(o.back) : cardSprite(card, o.big);
  if (sp) ctx.drawImage(sp, 0, 0, w, h); else { ctx.save(); ctx.scale(w / CW, h / CH); if (card < 0) paintBack(ctx, BACKS.garnet); else paintFace(ctx, card, o.big); ctx.restore(); }
  if (o.dim) { ctx.fillStyle = 'rgba(30,22,10,0.42)'; ctx.beginPath(); ctx.roundRect(0, 0, w, h, 10); ctx.fill(); }
  if (o.glow) { ctx.lineWidth = 4; ctx.strokeStyle = o.glow; ctx.beginPath(); ctx.roundRect(1, 1, w - 2, h - 2, 11); ctx.stroke(); }
  ctx.restore();
}
