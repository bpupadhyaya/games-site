// Carved wooden checkers and hand-made dice, painted once into cached sprites (never per frame).
import { D } from './layout.js';
const TAU = Math.PI * 2, SC = 2;

const lin = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const rad = (c, x, y, r0, x1, y1, r1, stops) => { const g = c.createRadialGradient(x, y, r0, x1, y1, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };

// Palettes: side 0 = pale boxwood (the player), side 1 = dark rosewood. `inlay` is the carved rosette colour.
export const SETS = {
  classic: [
    { hi: '#fff3d0', mid: '#e8cd8e', lo: '#b98f4c', edge: '#8c6a30', groove: 'rgba(110,70,20,0.45)', inlay: '#9a6a2a', rim: '#fff0c0' },
    { hi: '#8a4a34', mid: '#57281a', lo: '#2b120a', edge: '#160a05', groove: 'rgba(0,0,0,0.55)', inlay: '#d8ac52', rim: '#e6c56a' },
  ],
  pearl: [
    { hi: '#ffffff', mid: '#e9eef2', lo: '#a9b7c4', edge: '#6e7f8f', groove: 'rgba(60,80,110,0.35)', inlay: '#5f8ea6', rim: '#ffffff' },
    { hi: '#3e4a5e', mid: '#232c3b', lo: '#0e131b', edge: '#05080d', groove: 'rgba(0,0,0,0.6)', inlay: '#7fc4c0', rim: '#a8d8d4' },
  ],
};
export const SET_NAMES = { classic: 'Boxwood and rosewood', pearl: 'Pearl and ebony' };

function paintChecker(c, p, cx, cy) {
  const r = D / 2;
  // cast shadow
  c.fillStyle = 'rgba(0,0,0,0.38)'; c.beginPath(); c.ellipse(cx + 3, cy + 6, r + 1, r - 1, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(cx + 5, cy + 9, r, r - 2, 0, 0, TAU); c.fill();
  // the turned edge (thickness)
  c.fillStyle = lin(c, cx, cy, cx, cy + r + 5, [[0, p.edge], [1, p.lo]]); c.beginPath(); c.arc(cx, cy + 4, r, 0, TAU); c.fill();
  // face
  c.fillStyle = rad(c, cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05, [[0, p.hi], [0.55, p.mid], [1, p.lo]]); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
  c.strokeStyle = p.edge; c.lineWidth = 1.5; c.stroke();
  // rim ring (a bright bevel catching the lamp)
  c.strokeStyle = p.rim; c.globalAlpha = 0.7; c.lineWidth = 1.6; c.beginPath(); c.arc(cx, cy, r - 2.5, Math.PI * 0.95, Math.PI * 1.75); c.stroke(); c.globalAlpha = 1;
  // lathe grooves
  c.strokeStyle = p.groove; c.lineWidth = 1.4;
  for (const k of [0.8, 0.66]) { c.beginPath(); c.arc(cx, cy, r * k, 0, TAU); c.stroke(); }
  c.strokeStyle = p.rim; c.globalAlpha = 0.28; c.lineWidth = 1; c.beginPath(); c.arc(cx + 0.8, cy + 0.8, r * 0.8, Math.PI * 1.1, Math.PI * 1.7); c.stroke(); c.globalAlpha = 1;
  // carved eight-petal rosette in the middle
  c.save(); c.translate(cx, cy);
  c.fillStyle = p.inlay;
  for (let i = 0; i < 8; i++) { c.save(); c.rotate(i * TAU / 8); c.beginPath(); c.ellipse(0, -r * 0.3, r * 0.1, r * 0.17, 0, 0, TAU); c.fill(); c.restore(); }
  c.beginPath(); c.arc(0, 0, r * 0.1, 0, TAU); c.fill();
  c.strokeStyle = p.groove; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, r * 0.5, 0, TAU); c.stroke();
  c.restore();
  // specular glint
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(cx - r * 0.42, cy - r * 0.5, r * 0.22, r * 0.1, -0.7, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(cx - r * 0.5, cy - r * 0.55, r * 0.05, 0, TAU); c.fill();
}

const cache = {};
const PAD = 14;
export function checkerSprite(set, side) {
  const k = set + side; if (k in cache) return cache[k];
  let cv = null;
  if (typeof OffscreenCanvas !== 'undefined') { try { const S = D + PAD * 2; cv = new OffscreenCanvas(S * SC, S * SC); const c = cv.getContext('2d'); c.scale(SC, SC); paintChecker(c, (SETS[set] || SETS.classic)[side], S / 2, S / 2 - 2); } catch { cv = null; } }
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
  const p = (SETS[set] || SETS.classic)[side];
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - 15, y - 14, 34, 32);
  ctx.fillStyle = lin(ctx, x - 16, 0, x + 16, 0, [[0, p.lo], [0.3, p.hi], [0.7, p.mid], [1, p.lo]]); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 17, y - 16, 34, 32, 5) : ctx.rect(x - 17, y - 16, 34, 32); ctx.fill();
  ctx.strokeStyle = p.edge; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = p.groove; ctx.beginPath(); ctx.moveTo(x - 17, y - 5); ctx.lineTo(x + 17, y - 5); ctx.moveTo(x - 17, y + 5); ctx.lineTo(x + 17, y + 5); ctx.stroke();
}

// ---- dice ----------------------------------------------------------------------------------------------------
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
export const DIE = 66;
function paintDie(c, v, ivory) {
  const S = DIE, q = S / 2, rr = (x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
  c.fillStyle = 'rgba(0,0,0,0.35)'; rr(-q + 4, -q + 8, S, S, 14); c.fill();
  c.fillStyle = ivory ? '#b89a62' : '#7a1f24'; rr(-q, -q + 4, S, S, 14); c.fill();               // the side of the cube
  c.fillStyle = lin(c, -q, -q, q, q, ivory ? [[0, '#fffaea'], [0.6, '#f0e2bd'], [1, '#d6bd86']] : [[0, '#c94a4a'], [0.6, '#a12a2e'], [1, '#7a1a20']]); rr(-q, -q, S, S, 14); c.fill();
  c.strokeStyle = ivory ? 'rgba(120,84,30,0.7)' : 'rgba(50,5,10,0.7)'; c.lineWidth = 1.4; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-q + 9, -q + 3); c.lineTo(q - 12, -q + 3); c.stroke();
  const pr = v === 1 ? 8.5 : 6.4, sp = 16;
  for (const [x, y] of PIPS[v]) {
    const px = x * sp, py = y * sp;
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.arc(px + 0.6, py + 1.4, pr, 0, TAU); c.fill();
    c.fillStyle = v === 1 ? '#a01c24' : (ivory ? '#22120a' : '#f7e9c8'); c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill();
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
// draw a die: rotation, squash (to fake the tumble) and a lift that also moves the shadow
export function drawDie(ctx, v, x, y, { rot = 0, sq = 1, lift = 0, dim = false, ivory = true } = {}) {
  const sp = dieSprite(v, ivory); if (!sp) return;
  const S = DIE + 30;
  ctx.save(); if (dim) ctx.globalAlpha = 0.38;
  ctx.translate(x, y - lift); ctx.rotate(rot); ctx.scale(1, sq);
  ctx.drawImage(sp, -S / 2, -S / 2, S, S);
  ctx.restore();
}
