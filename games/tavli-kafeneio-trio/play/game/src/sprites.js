// Checkers and dice, painted once into cached sprites (never per frame). Drawn with a Greek-key (meander) ring.
import { D } from './layout.js';
const TAU = Math.PI * 2, SC = 2;

const lin = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const rad = (c, x, y, r0, x1, y1, r1, stops) => { const g = c.createRadialGradient(x, y, r0, x1, y1, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };

// Palettes: side 0 = the player at the bottom, side 1 = the rival. `ring` = the meander ring colour.
export const SETS = {
  marble: [
    { hi: '#ffffff', mid: '#efe8d6', lo: '#b9ad92', edge: '#7e7358', groove: 'rgba(70,60,40,0.4)', ring: '#1d5a9a', rim: '#ffffff', vein: 'rgba(120,130,150,0.35)' },
    { hi: '#6b5a48', mid: '#3a2d22', lo: '#18110c', edge: '#0b0705', groove: 'rgba(0,0,0,0.6)', ring: '#e6c56a', rim: '#d9bf86', vein: 'rgba(230,200,140,0.18)' },
  ],
  amber: [
    { hi: '#ffe9a8', mid: '#e8a83a', lo: '#a85c14', edge: '#6a360a', groove: 'rgba(90,40,0,0.45)', ring: '#fff3cf', rim: '#fff3cf', vein: 'rgba(255,255,255,0.3)' },
    { hi: '#4f6fb8', mid: '#23366e', lo: '#0c1636', edge: '#050a1c', groove: 'rgba(0,0,0,0.6)', ring: '#9fc4f2', rim: '#9fc0ee', vein: 'rgba(170,200,255,0.2)' },
  ],
};
export const SET_NAMES = { marble: 'Marble and olive wood', amber: 'Amber and indigo' };

function paintChecker(c, p, cx, cy) {
  const r = D / 2;
  c.fillStyle = 'rgba(0,0,0,0.38)'; c.beginPath(); c.ellipse(cx + 3, cy + 6, r + 1, r - 1, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(cx + 5, cy + 9, r, r - 2, 0, 0, TAU); c.fill();
  c.fillStyle = lin(c, cx, cy, cx, cy + r + 5, [[0, p.edge], [1, p.lo]]); c.beginPath(); c.arc(cx, cy + 4, r, 0, TAU); c.fill();
  c.fillStyle = rad(c, cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05, [[0, p.hi], [0.55, p.mid], [1, p.lo]]); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
  c.strokeStyle = p.edge; c.lineWidth = 1.5; c.stroke();
  // stone veining
  c.save(); c.beginPath(); c.arc(cx, cy, r - 1, 0, TAU); c.clip(); c.strokeStyle = p.vein; c.lineWidth = 1.1;
  for (const [a, b, d] of [[-0.7, -0.2, 0.5], [0.2, 0.7, -0.4], [-0.3, 0.5, 0.9]]) { c.beginPath(); c.moveTo(cx - r, cy + a * r); c.bezierCurveTo(cx - r * 0.3, cy + b * r, cx + r * 0.2, cy + d * r, cx + r, cy + (a + b) * r * 0.5); c.stroke(); }
  c.restore();
  c.strokeStyle = p.rim; c.globalAlpha = 0.7; c.lineWidth = 1.6; c.beginPath(); c.arc(cx, cy, r - 2.5, Math.PI * 0.95, Math.PI * 1.75); c.stroke(); c.globalAlpha = 1;
  // the Greek-key ring: a square wave running round the face
  const r1 = r * 0.58, r2 = r * 0.74, N = 24;
  c.strokeStyle = p.ring; c.lineWidth = 2.1; c.lineJoin = 'miter'; c.beginPath();
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU, rr = i % 2 ? r2 : r1, rn = i % 2 ? r1 : r2;
    if (i === 0) c.moveTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr);
    c.arc(cx, cy, rr, a0, a1); c.lineTo(cx + Math.cos(a1) * rn, cy + Math.sin(a1) * rn);
  }
  c.closePath(); c.stroke();
  c.strokeStyle = p.groove; c.lineWidth = 1.2; c.beginPath(); c.arc(cx, cy, r * 0.88, 0, TAU); c.stroke(); c.beginPath(); c.arc(cx, cy, r * 0.46, 0, TAU); c.stroke();
  c.fillStyle = p.ring; c.beginPath(); c.arc(cx, cy, r * 0.17, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(cx - r * 0.42, cy - r * 0.5, r * 0.22, r * 0.1, -0.7, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(cx - r * 0.5, cy - r * 0.55, r * 0.05, 0, TAU); c.fill();
}

const cache = {};
const PAD = 14;
export function checkerSprite(set, side) {
  const k = set + side; if (k in cache) return cache[k];
  let cv = null;
  if (typeof OffscreenCanvas !== 'undefined') { try { const S = D + PAD * 2; cv = new OffscreenCanvas(S * SC, S * SC); const c = cv.getContext('2d'); c.scale(SC, SC); paintChecker(c, (SETS[set] || SETS.marble)[side], S / 2, S / 2 - 2); } catch { cv = null; } }
  return (cache[k] = cv);
}
// draw a checker centred at (x, y); s = scale, lift = px above the board (shadow stays down)
export function drawChecker(ctx, set, side, x, y, s = 1, lift = 0) {
  const sp = checkerSprite(set, side); if (!sp) return;
  const S = (D + PAD * 2) * s;
  if (lift) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 10, D / 2 * s, D / 2 * s * 0.8, 0, 0, TAU); ctx.fill(); }
  ctx.drawImage(sp, x - S / 2, y - lift - S / 2 + 2, S, S);
}
// a checker seen edge-on (in the off trays)
export function drawChip(ctx, set, side, x, y) {
  const p = (SETS[set] || SETS.marble)[side];
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - 15, y - 14, 34, 32);
  ctx.fillStyle = lin(ctx, x - 16, 0, x + 16, 0, [[0, p.lo], [0.3, p.hi], [0.7, p.mid], [1, p.lo]]); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 17, y - 16, 34, 32, 5) : ctx.rect(x - 17, y - 16, 34, 32); ctx.fill();
  ctx.strokeStyle = p.edge; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = p.ring; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 17, y - 6); ctx.lineTo(x + 17, y - 6); ctx.moveTo(x - 17, y + 6); ctx.lineTo(x + 17, y + 6); ctx.stroke();
}
// A small brass padlock drawn over a pinned checker.
export function drawLock(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(2, 12, 13, 5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#e9d089'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(0, -3, 6.5, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = '#6b4510'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -3, 8.2, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = lin(ctx, 0, -2, 0, 12, [[0, '#f6dc8a'], [1, '#b4802f']]); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-9, -2, 18, 14, 3) : ctx.rect(-9, -2, 18, 14); ctx.fill();
  ctx.strokeStyle = '#5a3a0a'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#3a2208'; ctx.beginPath(); ctx.arc(0, 4, 2.2, 0, TAU); ctx.fill(); ctx.fillRect(-0.9, 4, 1.8, 4);
  ctx.restore();
}

// ---- dice ----------------------------------------------------------------------------------------------------------------------
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
export const DIE = 66;
function paintDie(c, v, ivory) {
  const S = DIE, q = S / 2, rr = (x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
  c.fillStyle = 'rgba(0,0,0,0.35)'; rr(-q + 4, -q + 8, S, S, 14); c.fill();
  c.fillStyle = ivory ? '#b8a272' : '#0a2548'; rr(-q, -q + 4, S, S, 14); c.fill();
  c.fillStyle = lin(c, -q, -q, q, q, ivory ? [[0, '#fffcf0'], [0.6, '#f1e6c6'], [1, '#d6c28f']] : [[0, '#2f6cb0'], [0.6, '#1b4a85'], [1, '#0f2f5c']]); rr(-q, -q, S, S, 14); c.fill();
  c.strokeStyle = ivory ? 'rgba(120,90,36,0.7)' : 'rgba(5,15,40,0.8)'; c.lineWidth = 1.4; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-q + 9, -q + 3); c.lineTo(q - 12, -q + 3); c.stroke();
  const pr = v === 1 ? 8.5 : 6.4, sp = 16;
  for (const [x, y] of PIPS[v]) {
    const px = x * sp, py = y * sp;
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(px + 0.6, py + 1.4, pr, 0, TAU); c.fill();
    c.fillStyle = v === 1 ? '#b3402a' : (ivory ? '#143a6a' : '#f7ecd0'); c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(px - pr * 0.3, py - pr * 0.35, pr * 0.28, 0, TAU); c.fill();
  }
}
const dcache = {};
export function dieSprite(v, ivory = true) {
  const k = v + (ivory ? 'i' : 'r'); if (k in dcache) return dcache[k];
  let cv = null;
  if (typeof OffscreenCanvas !== 'undefined') { try { const S = DIE + 30; cv = new OffscreenCanvas(S * SC, S * SC); const c = cv.getContext('2d'); c.scale(SC, SC); c.translate(S / 2, S / 2); paintDie(c, v, ivory); } catch { cv = null; } }
  return (dcache[k] = cv);
}
export function drawDie(ctx, v, x, y, { rot = 0, sq = 1, lift = 0, dim = false, ivory = true } = {}) {
  const sp = dieSprite(v, ivory); if (!sp) return;
  const S = DIE + 30;
  ctx.save(); if (dim) ctx.globalAlpha = 0.38;
  ctx.translate(x, y - lift); ctx.rotate(rot); ctx.scale(1, sq);
  ctx.drawImage(sp, -S / 2, -S / 2, S, S);
  ctx.restore();
}
