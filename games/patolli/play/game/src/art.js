// Patolli art: palette, fonts and the small painters (table, beads, beans, panels). Everything is drawn in code; no images.
export const DISPLAY = '"Dela Gothic One", "Arial Black", system-ui, sans-serif';
export const UI = '"Fredoka", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
import { v3, sprites } from './v3.js';
const TAU = Math.PI * 2;

export const PAL = {
  night0: '#0c1014', night1: '#18212a', night2: '#243240',
  stone: '#dcc194', stoneHi: '#f4e3bd', stoneLo: '#a9854f', clay: '#7b4a2a', clayDark: '#4a2a16', clayHi: '#a8693c',
  ink: '#2b1a0d', sepia: '#6a4d2f', paper: '#f1e4c6', paperLo: '#d8c299',
  text: '#f4ecd8', dim: '#b9ae98', gold: '#e8b645', goldHi: '#ffdc7d', goldLo: '#a8741a',
  jade: '#2aa070', turquoise: '#26a7b5', cochineal: '#cf4a2d', obsidian: '#15171c', danger: '#a8321f', good: '#2d8f6a',
};
// Seat colours: jade, cochineal red, Maya blue, amaranth. Each seat also has its own shape so colour is never the only cue.
export const SEAT = [
  { name: 'Jade', base: '#27a06e', hi: '#8ff0be', lo: '#0c5a3a', shape: 'circle' },
  { name: 'Cochineal', base: '#d44a2b', hi: '#ffa37c', lo: '#7a210f', shape: 'diamond' },
  { name: 'Maya blue', base: '#3f73dc', hi: '#a6c4ff', lo: '#173b8a', shape: 'square' },
  { name: 'Amaranth', base: '#b63f9a', hi: '#f2a2de', lo: '#661a55', shape: 'triangle' },
];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// The table behind everything: dark basalt with a soft light and a few speckles.
export function drawDesk(ctx, w, h) {
  if (v3.on) { ctx.clearRect(0, 0, w, h); return; }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PAL.night2); g.addColorStop(0.45, PAL.night1); g.addColorStop(1, PAL.night0);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = ctx.createRadialGradient(w * 0.5, h * 0.38, 10, w * 0.5, h * 0.38, Math.max(w, h) * 0.7);
  r.addColorStop(0, 'rgba(120,150,170,0.20)'); r.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = r; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let i = 0; i < 70; i++) { const x = hash(i) * w, y = hash(i + 91) * h, s = 1 + hash(i + 7) * 2.5; ctx.fillRect(x, y, s, s); }
}

// Stepped-fret band (a plain geometric stair pattern) along a horizontal strip.
export function fretBand(ctx, x, y, w, h, col = 'rgba(232,182,69,0.55)') {
  const step = h / 3, n = Math.max(1, Math.floor(w / (step * 6)));
  const unit = w / n;
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, h * 0.12); ctx.lineJoin = 'miter'; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x0 = x + i * unit, u = unit / 6;
    ctx.moveTo(x0, y + h);
    ctx.lineTo(x0, y + h - 2 * step); ctx.lineTo(x0 + u, y + h - 2 * step); ctx.lineTo(x0 + u, y + step); ctx.lineTo(x0 + 3 * u, y + step);
    ctx.lineTo(x0 + 3 * u, y + h - step); ctx.lineTo(x0 + 2 * u, y + h - step); ctx.lineTo(x0 + 2 * u, y + h - 2 * step);
    ctx.moveTo(x0 + 3 * u, y + h); ctx.lineTo(x0 + 4 * u, y + h); ctx.lineTo(x0 + 4 * u, y + step * 2); ctx.lineTo(x0 + 5 * u, y + step * 2); ctx.lineTo(x0 + 5 * u, y + h);
  }
  ctx.stroke(); ctx.restore();
}

// A carved parchment-like panel (bark-paper sheet) for text screens.
export function drawSheet(ctx, r, rad = 18) {
  if (v3.on) { v3.panels.push({ r, rad, kind: 'sheet' }); return; }
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 7;
  ctx.fillStyle = PAL.paper; rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.fill();
  ctx.restore();
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.clip();
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, 'rgba(255,250,232,0.7)'); g.addColorStop(1, 'rgba(190,150,90,0.35)');
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  fretBand(ctx, r.x + 10, r.y + 6, r.w - 20, 14, 'rgba(123,74,42,0.35)');
  ctx.restore();
  ctx.lineWidth = 2.5; ctx.strokeStyle = PAL.clayDark; rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.stroke();
}

// A seat's bead: a lit, polished stone with the seat's shape inlaid on top. (x, y) = where it rests on the board.
export function drawBead(ctx, x, y, s, seat, o = {}) {
  const c = SEAT[seat % 4], lift = o.lift ?? 0, R = s * 0.42;
  if (sprites.ready && sprites.bead[seat % 4]) {
    ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
    if (o.ring) { ctx.lineWidth = Math.max(3, s * 0.1); ctx.strokeStyle = o.ring; ctx.beginPath(); ctx.arc(x, y - lift - R * 0.12, R * 1.22, 0, TAU); ctx.stroke(); }
    const d = s * 1.18; ctx.drawImage(sprites.bead[seat % 4], x - d / 2, y - lift - R * 0.12 - d * 0.56, d, d); ctx.restore(); return;
  }
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath(); ctx.ellipse(x, y + R * 0.55, R * (1 - Math.min(0.3, lift / (s * 3))), R * 0.42, 0, 0, TAU); ctx.fill();
  const cy = y - lift - R * 0.12;
  if (o.ring) {
    ctx.lineWidth = Math.max(3, s * 0.1); ctx.strokeStyle = o.ring; ctx.beginPath(); ctx.arc(x, cy, R * 1.22, 0, TAU); ctx.stroke();
  }
  const g = ctx.createRadialGradient(x - R * 0.38, cy - R * 0.42, R * 0.1, x, cy, R * 1.08);
  g.addColorStop(0, c.hi); g.addColorStop(0.5, c.base); g.addColorStop(1, c.lo);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, R, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.strokeStyle = c.lo; ctx.stroke();
  // inlay
  ctx.fillStyle = 'rgba(255,248,226,0.92)'; ctx.strokeStyle = 'rgba(40,20,5,0.55)'; ctx.lineWidth = Math.max(1, s * 0.03);
  const k = R * 0.42; ctx.beginPath();
  if (c.shape === 'circle') ctx.arc(x, cy, k * 0.95, 0, TAU);
  else if (c.shape === 'diamond') { ctx.moveTo(x, cy - k * 1.25); ctx.lineTo(x + k * 1.05, cy); ctx.lineTo(x, cy + k * 1.25); ctx.lineTo(x - k * 1.05, cy); ctx.closePath(); }
  else if (c.shape === 'square') ctx.rect(x - k * 0.9, cy - k * 0.9, k * 1.8, k * 1.8);
  else { ctx.moveTo(x, cy - k * 1.1); ctx.lineTo(x + k * 1.15, cy + k * 0.85); ctx.lineTo(x - k * 1.15, cy + k * 0.85); ctx.closePath(); }
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(x - R * 0.36, cy - R * 0.5, R * 0.32, R * 0.16, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

// A bean: a flat oval. marked = the face with the drilled dot shows. flip (0..1 turn) squashes it while it tumbles.
export function drawBean(ctx, x, y, w, marked, o = {}) {
  const rot = o.rot ?? 0, flip = o.flip ?? 0, sq = Math.max(0.18, Math.abs(Math.cos(flip * TAU)));
  const spr = sprites.ready && sprites.bean[marked ? 'on' : 'off'];
  if (spr) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); const d = w * 1.25; ctx.drawImage(spr, -d / 2, -d / 2, d, d); ctx.restore(); return; }
  const rx = w * 0.5, ry = w * 0.34;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(w * 0.04, ry * 0.5 + (o.lift ?? 0), rx * 0.95, ry * 0.7 * sq, 0, 0, TAU); ctx.fill();
  ctx.translate(0, -(o.lift ?? 0)); ctx.scale(1, sq);
  const faceMarked = marked;
  const g = ctx.createRadialGradient(-rx * 0.3, -ry * 0.4, ry * 0.1, 0, 0, rx);
  if (faceMarked) { g.addColorStop(0, '#fffaf0'); g.addColorStop(0.7, '#eadbb6'); g.addColorStop(1, '#b8a174'); }
  else { g.addColorStop(0, '#9a6a3d'); g.addColorStop(0.7, '#6a3f1d'); g.addColorStop(1, '#3a2010'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1.5, w * 0.04); ctx.strokeStyle = faceMarked ? '#5b4423' : '#1f1008'; ctx.stroke();
  if (faceMarked) {
    ctx.fillStyle = '#2b1a0d'; ctx.beginPath(); ctx.arc(0, 0, ry * 0.34, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(1, w * 0.03); ctx.strokeStyle = 'rgba(43,26,13,0.5)'; ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.64, ry * 0.62, 0, 0, TAU); ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(255,220,170,0.28)'; ctx.lineWidth = Math.max(1, w * 0.035);
    ctx.beginPath(); ctx.moveTo(-rx * 0.55, 0); ctx.quadraticCurveTo(0, -ry * 0.28, rx * 0.55, 0); ctx.stroke();
  }
  ctx.restore();
}

// Small glyphs for special squares, centred on (x, y) with half-size s.
export function drawGlyph(ctx, kind, x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y);
  if (kind === 'trap') {
    // a dark pit with jagged teeth round it
    ctx.fillStyle = PAL.obsidian; ctx.beginPath(); ctx.arc(0, 0, s * 0.62, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3b0e08'; ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e6d6b0'; const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, b = a + TAU / n / 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.88, Math.sin(a) * s * 0.88); ctx.lineTo(Math.cos(a - 0.2) * s * 0.58, Math.sin(a - 0.2) * s * 0.58); ctx.lineTo(Math.cos(a + 0.2) * s * 0.58, Math.sin(a + 0.2) * s * 0.58); ctx.closePath(); ctx.fill();
      void b;
    }
  } else if (kind === 'boost') {
    // a cut turquoise stone
    const g = ctx.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, '#b4fff4'); g.addColorStop(0.5, '#27b3bd'); g.addColorStop(1, '#0d5e6e');
    ctx.fillStyle = g; ctx.strokeStyle = '#073743'; ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.beginPath(); ctx.moveTo(0, -s * 0.9); ctx.lineTo(s * 0.8, 0); ctx.lineTo(0, s * 0.9); ctx.lineTo(-s * 0.8, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.moveTo(-s * 0.8, 0); ctx.lineTo(s * 0.8, 0); ctx.moveTo(0, -s * 0.9); ctx.lineTo(-s * 0.25, 0); ctx.lineTo(0, s * 0.9); ctx.stroke();
  } else if (kind === 'entry') {
    ctx.strokeStyle = o.color ?? PAL.gold; ctx.lineWidth = Math.max(2, s * 0.16);
    ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 0.2); ctx.lineTo(0, s * 0.35); ctx.lineTo(s * 0.55, -s * 0.2); ctx.stroke();
  }
  ctx.restore();
}

export { TAU };
