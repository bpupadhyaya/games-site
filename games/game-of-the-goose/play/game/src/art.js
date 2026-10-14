// Drawing: the walnut table, the parchment sheet, spaces and their little engraved pictures, pawns, dice, feathers, particles.
// Everything is plain canvas paths drawn in code (an original illustrated manner: ink outline, engraved hatching, watercolour wash).
// Pictures are centred at (x, y) and sized by s = half the space (so they fit a space whatever the screen).

export const PAL = {
  ink: '#2a1809', sepia: '#5a3a1f', sepiaSoft: 'rgba(90,58,31,0.55)', parch: '#efdfb8', parchHi: '#f8edcf', parchLo: '#d6bd8a',
  walnut: '#2a1a10', walnutHi: '#4b301c', oxblood: '#8f2a22', oxbloodHi: '#bd4a3e', verd: '#2f7a6e', verdHi: '#5db09f', ochre: '#c68a22',
  gold: '#e3ae3f', goldHi: '#f8d983', indigo: '#2e437c', indigoHi: '#5877bd', text: '#f7e9c8', dim: '#c9b58a', rose: '#e8806f', cream: '#fff6dc',
};
export const DISPLAY = '"Cinzel", "Cormorant Garamond", Georgia, "Times New Roman", serif';
export const UI = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
import { v3 } from './v3.js';
export const sprites = { pawn: {}, ready: false };   // 3D renders of the pawns, filled by the presenter (2D layer uses them when present)
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
export const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const TAU = Math.PI * 2;
// A cheap deterministic hash: the same input always gives the same "random" number in 0..1 (grain, stains, fibres never flicker).
export const hash = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; x -= Math.floor(x); return x; };

export const PLAYER_COLORS = ['#b3262b', '#2c58a8', '#2f8a5b', '#d6a021', '#7a3a8c', '#e9e0c8'];
export const PLAYER_DARK = ['#6a1216', '#142e5e', '#14502f', '#8a6208', '#44194f', '#8f8668'];

// ---- the table and the sheet ----------------------------------------------------------------------------------------------------------
export function drawDesk(ctx, w, h) {
  if (v3.on) { ctx.clearRect(0, 0, w, h); return; }   // the 3D table shows through
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#3a2414'); g.addColorStop(0.5, '#2a1a10'); g.addColorStop(1, '#1d120a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // wood grain: long soft wavy lines
  ctx.lineWidth = 1.2;
  const n = Math.ceil(h / 26);
  for (let i = 0; i < n; i++) {
    const y = i * 26 + hash(i) * 14, a = 0.05 + hash(i + 40) * 0.07;
    ctx.strokeStyle = `rgba(${hash(i + 9) > 0.5 ? '0,0,0' : '255,210,150'},${a})`;
    ctx.beginPath(); ctx.moveTo(0, y);
    const ph = hash(i + 3) * 6, amp = 2 + hash(i + 7) * 5;
    for (let x = 0; x <= w + 40; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.008 + ph) * amp);
    ctx.stroke();
  }
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(255,200,120,0.07)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

export function drawSheet(ctx, r, seed = 1) {
  if (v3.on) { v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad: 14, kind: 'parch' }); return; }
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 8;
  ctx.fillStyle = PAL.parch; rr(ctx, r.x, r.y, r.w, r.h, 14); ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, 14); ctx.clip();
  const g = ctx.createRadialGradient(r.x + r.w * 0.35, r.y + r.h * 0.3, r.w * 0.1, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.78);
  g.addColorStop(0, '#f7ecc8'); g.addColorStop(0.65, '#ead7a6'); g.addColorStop(1, '#cdb078');
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  // stains and foxing
  for (let i = 0; i < 9; i++) {
    const px = r.x + hash(seed * 7 + i) * r.w, py = r.y + hash(seed * 11 + i * 3) * r.h, pr = r.w * (0.05 + hash(i + seed) * 0.12);
    const sg = ctx.createRadialGradient(px, py, 0, px, py, pr);
    sg.addColorStop(0, 'rgba(140,96,40,0.10)'); sg.addColorStop(1, 'rgba(140,96,40,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
  }
  // paper fibres
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(110,76,36,0.13)';
  ctx.beginPath();
  for (let i = 0; i < 110; i++) {
    const px = r.x + hash(i * 1.7 + seed) * r.w, py = r.y + hash(i * 2.9 + 5) * r.h, a = hash(i + 77) * TAU, l = 5 + hash(i + 3) * 14;
    ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l * 0.5);
  }
  ctx.stroke();
  ctx.restore();
  // plate border: a heavy rule and a hairline, like a copper-plate print
  const m = Math.max(8, r.w * 0.014);
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3;
  rr(ctx, r.x + m, r.y + m, r.w - m * 2, r.h - m * 2, 6); ctx.stroke();
  ctx.lineWidth = 1; rr(ctx, r.x + m + 6, r.y + m + 6, r.w - (m + 6) * 2, r.h - (m + 6) * 2, 4); ctx.stroke();
}

// ---- hatching helpers ----------------------------------------------------------------------------------------------------------------
function hatch(ctx, x0, y0, w, h, gap, ang, color, lw = 1) {
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
  const d = Math.hypot(w, h), cx = x0 + w / 2, cy = y0 + h / 2, ca = Math.cos(ang), sa = Math.sin(ang);
  for (let o = -d / 2; o <= d / 2; o += gap) {
    const px = cx - sa * o, py = cy + ca * o;
    ctx.moveTo(px - ca * d, py - sa * d); ctx.lineTo(px + ca * d, py + sa * d);
  }
  ctx.stroke(); ctx.restore();
}
const ink = (ctx, lw = 1.6) => { ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; };
// A shape with a wash fill and an ink outline: path is built by `fn`.
function shape(ctx, fill, fn, lw = 1.5, hat = null) {
  ctx.beginPath(); fn(); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (hat) { ctx.save(); ctx.clip(); hatch(ctx, -2, -2, 4, 4, hat[0], hat[1], hat[2], lw * 0.7); ctx.restore(); ctx.beginPath(); fn(); }
  ink(ctx, lw); ctx.stroke();
}

// ---- spaces -----------------------------------------------------------------------------------------------------------------------------
const WASH = ['#ecd09a', '#d3dcae', '#eabfa6', '#bfd6d4'];
const KIND_WASH = {
  goose: '#fbf4dc', bridge: '#c4dbe6', inn: '#f0cf8d', well: '#bcd3dc', maze: '#d8c4e0', prison: '#cdbfae', skeleton: '#d6a99a', garden: '#cfe3a6', road: '#efd7a2', start: '#e6ddb8',
};
export function drawTile(ctx, n, x, y, w, h, ang, kind, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const fill = KIND_WASH[kind] ?? WASH[n % 4];
  shape(ctx, fill, () => ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.16), 2.2);
  // engraved shading on one side of the space
  ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.16); ctx.clip();
  hatch(ctx, -w / 2, -h / 2, w, h, Math.max(4, h * 0.11), -0.9, 'rgba(90,58,31,0.20)', 1);
  const shade = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  shade.addColorStop(0, 'rgba(255,255,255,0.28)'); shade.addColorStop(1, 'rgba(90,58,31,0.18)');
  ctx.fillStyle = shade; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  if (o.glow) {
    ctx.lineWidth = 4; ctx.strokeStyle = o.glow; rr(ctx, -w / 2 - 1, -h / 2 - 1, w + 2, h + 2, Math.min(w, h) * 0.18); ctx.stroke();
  }
  ctx.restore();
}

// ---- pictures ---------------------------------------------------------------------------------------------------------------------------
// A white goose facing right. s = overall half size.
export function drawGoose(ctx, x, y, s, o = {}) {
  const flip = o.flip ?? 1, flap = o.flap ?? 0, white = o.fill ?? '#fffaf0';
  ctx.save(); ctx.translate(x, y); ctx.scale(s * flip, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lw = 1.5 / s;
  // legs and feet
  ctx.fillStyle = '#e08a2a';
  for (const lx of [-0.12, 0.2]) {
    ctx.beginPath(); ctx.moveTo(lx, 0.4); ctx.lineTo(lx + 0.02, 0.78);
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 0.1 + lw * 2.4; ctx.stroke();
    ctx.strokeStyle = '#e08a2a'; ctx.lineWidth = 0.1; ctx.stroke();
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw * 1.2;
    ctx.beginPath(); ctx.moveTo(lx - 0.06, 0.76); ctx.lineTo(lx + 0.28, 0.86); ctx.lineTo(lx - 0.04, 0.9); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // tail
  shape(ctx, white, () => { ctx.moveTo(-0.5, 0.0); ctx.lineTo(-0.98, -0.16 - flap * 0.1); ctx.lineTo(-0.9, 0.12); ctx.lineTo(-0.5, 0.3); ctx.closePath(); }, lw);
  // body
  shape(ctx, white, () => {
    ctx.moveTo(-0.62, 0.05);
    ctx.bezierCurveTo(-0.5, 0.58, 0.05, 0.62, 0.4, 0.42);
    ctx.bezierCurveTo(0.62, 0.28, 0.58, 0.0, 0.5, -0.12);
    ctx.bezierCurveTo(0.2, -0.3, -0.45, -0.3, -0.62, 0.05);
    ctx.closePath();
  }, lw * 1.2);
  // neck
  ctx.beginPath(); ctx.moveTo(0.38, -0.08); ctx.bezierCurveTo(0.7, -0.15, 0.62, -0.62, 0.68, -0.74);
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 0.27 + lw * 2.4; ctx.stroke();
  ctx.strokeStyle = white; ctx.lineWidth = 0.27; ctx.stroke();
  // head and beak
  shape(ctx, white, () => ctx.ellipse(0.7, -0.8, 0.17, 0.14, -0.2, 0, TAU), lw);
  shape(ctx, '#e8892b', () => { ctx.moveTo(0.82, -0.86); ctx.lineTo(1.08, -0.78); ctx.lineTo(0.84, -0.7); ctx.closePath(); }, lw);
  ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(0.74, -0.84, 0.032, 0, TAU); ctx.fill();
  // wing with feather lines
  const wy = -flap * 0.22;
  shape(ctx, '#f1e6c9', () => {
    ctx.moveTo(-0.38, -0.1); ctx.bezierCurveTo(-0.3, -0.5 + wy, 0.2, -0.46 + wy, 0.34, -0.14 + wy * 0.4);
    ctx.bezierCurveTo(0.2, 0.18, -0.2, 0.28, -0.52, 0.12); ctx.closePath();
  }, lw);
  ctx.strokeStyle = PAL.sepiaSoft; ctx.lineWidth = lw * 0.9; ctx.beginPath();
  for (let i = 0; i < 4; i++) { const t = i / 3; ctx.moveTo(-0.3 + t * 0.5, -0.12 + wy * 0.5); ctx.quadraticCurveTo(-0.15 + t * 0.4, 0.06, -0.38 + t * 0.62, 0.18); }
  ctx.stroke();
  ctx.restore();
}

export function drawBridge(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const lw = 1.6 / s; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // river
  ctx.strokeStyle = '#3e72a8'; ctx.lineWidth = lw * 1.3;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-0.9, 0.5 + i * 0.17); for (let k = 0; k < 6; k++) ctx.quadraticCurveTo(-0.9 + k * 0.3 + 0.075, 0.45 + i * 0.17, -0.9 + (k + 1) * 0.3, 0.5 + i * 0.17); ctx.stroke(); }
  // deck and arch
  shape(ctx, '#d9c08c', () => { ctx.moveTo(-0.9, 0.12); ctx.quadraticCurveTo(0, -0.62, 0.9, 0.12); ctx.lineTo(0.9, 0.36); ctx.lineTo(0.62, 0.36); ctx.quadraticCurveTo(0, -0.1, -0.62, 0.36); ctx.lineTo(-0.9, 0.36); ctx.closePath(); }, lw, [0.07, 0.6, 'rgba(90,58,31,0.4)']);
  ctx.restore();
}

export function drawInn(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const lw = 1.6 / s; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  shape(ctx, '#f1dfb4', () => ctx.rect(-0.62, -0.1, 1.24, 0.82), lw, [0.08, 0.7, 'rgba(90,58,31,0.3)']);
  shape(ctx, PAL.oxblood, () => { ctx.moveTo(-0.78, -0.08); ctx.lineTo(0, -0.7); ctx.lineTo(0.78, -0.08); ctx.closePath(); }, lw);
  shape(ctx, '#7a5a3c', () => ctx.rect(0.36, -0.62, 0.15, 0.3), lw);
  shape(ctx, '#7a4a22', () => ctx.roundRect(-0.12, 0.28, 0.26, 0.44, 0.1), lw);
  shape(ctx, '#ffdc7a', () => ctx.rect(-0.5, 0.04, 0.26, 0.26), lw);
  shape(ctx, '#ffdc7a', () => ctx.rect(0.26, 0.04, 0.26, 0.26), lw);
  // a hanging sign with a tankard
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(0.62, 0.1); ctx.lineTo(0.9, 0.1); ctx.stroke();
  shape(ctx, '#e3ae3f', () => ctx.roundRect(0.7, 0.14, 0.26, 0.26, 0.04), lw);
  ctx.restore();
}

export function drawWell(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const lw = 1.6 / s; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // stone cylinder
  shape(ctx, '#cfc7b5', () => { ctx.moveTo(-0.5, 0.2); ctx.lineTo(-0.5, 0.62); ctx.ellipse(0, 0.62, 0.5, 0.16, 0, Math.PI, 0, true); ctx.lineTo(0.5, 0.2); ctx.ellipse(0, 0.2, 0.5, 0.16, 0, 0, Math.PI, true); ctx.closePath(); }, lw, [0.07, 1.1, 'rgba(60,50,40,0.35)']);
  shape(ctx, '#1d3a52', () => ctx.ellipse(0, 0.2, 0.5, 0.16, 0, 0, TAU), lw);
  // posts, roof beam, rope and bucket
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw * 2.4;
  ctx.beginPath(); ctx.moveTo(-0.5, 0.28); ctx.lineTo(-0.5, -0.5); ctx.moveTo(0.5, 0.28); ctx.lineTo(0.5, -0.5); ctx.stroke();
  shape(ctx, PAL.oxblood, () => { ctx.moveTo(-0.72, -0.46); ctx.lineTo(0, -0.84); ctx.lineTo(0.72, -0.46); ctx.closePath(); }, lw);
  ctx.strokeStyle = PAL.sepia; ctx.lineWidth = lw * 1.2; ctx.beginPath(); ctx.moveTo(0, -0.46); ctx.lineTo(0, 0.0); ctx.stroke();
  shape(ctx, '#a67a44', () => { ctx.moveTo(-0.14, 0.0); ctx.lineTo(0.14, 0.0); ctx.lineTo(0.1, 0.2); ctx.lineTo(-0.1, 0.2); ctx.closePath(); }, lw);
  ctx.restore();
}

export function drawMaze(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const lw = 1.7 / s; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  shape(ctx, '#efe2f0', () => ctx.roundRect(-0.74, -0.74, 1.48, 1.48, 0.1), lw);
  // a square labyrinth: nested rings with gaps, drawn as one wandering path
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw * 1.5; ctx.beginPath();
  const P = [[-0.6, 0.6], [-0.6, -0.6], [0.6, -0.6], [0.6, 0.42], [-0.42, 0.42], [-0.42, -0.42], [0.42, -0.42], [0.42, 0.24], [-0.24, 0.24], [-0.24, -0.24], [0.24, -0.24], [0.24, 0.06], [0.0, 0.06], [0.0, -0.06]];
  ctx.moveTo(P[0][0], P[0][1]); for (const p of P.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.stroke();
  ctx.fillStyle = PAL.oxblood; ctx.beginPath(); ctx.arc(0.0, 0.0, 0.08, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawPrison(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const lw = 1.6 / s; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  shape(ctx, '#b9ad98', () => {
    ctx.moveTo(-0.5, 0.78); ctx.lineTo(-0.5, -0.5); ctx.lineTo(-0.58, -0.5); ctx.lineTo(-0.58, -0.8); ctx.lineTo(-0.36, -0.8); ctx.lineTo(-0.36, -0.66); ctx.lineTo(-0.18, -0.66); ctx.lineTo(-0.18, -0.8);
    ctx.lineTo(0.18, -0.8); ctx.lineTo(0.18, -0.66); ctx.lineTo(0.36, -0.66); ctx.lineTo(0.36, -0.8); ctx.lineTo(0.58, -0.8); ctx.lineTo(0.58, -0.5); ctx.lineTo(0.5, -0.5); ctx.lineTo(0.5, 0.78); ctx.closePath();
  }, lw);
  hatch(ctx, -0.5, -0.8, 1, 1.6, 0.08, 0.9, 'rgba(50,40,30,0.3)', lw * 0.7);
  // barred window and door
  shape(ctx, '#2a2118', () => { ctx.moveTo(-0.24, -0.1); ctx.lineTo(-0.24, -0.3); ctx.arc(0, -0.3, 0.24, Math.PI, 0); ctx.lineTo(0.24, -0.1); ctx.closePath(); }, lw);
  ctx.strokeStyle = '#d9c8a0'; ctx.lineWidth = lw * 1.2; ctx.beginPath(); for (const bx of [-0.12, 0, 0.12]) { ctx.moveTo(bx, -0.1); ctx.lineTo(bx, -0.52); } ctx.stroke();
  shape(ctx, '#5a3a1f', () => { ctx.moveTo(-0.2, 0.78); ctx.lineTo(-0.2, 0.42); ctx.arc(0, 0.42, 0.2, Math.PI, 0); ctx.lineTo(0.2, 0.78); ctx.closePath(); }, lw);
  ctx.restore();
}

export function drawSkull(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const lw = 1.6 / s; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // crossed bones behind
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 0.17 + lw * 2.4;
  ctx.beginPath(); ctx.moveTo(-0.7, 0.55); ctx.lineTo(0.7, -0.05); ctx.moveTo(0.7, 0.55); ctx.lineTo(-0.7, -0.05); ctx.stroke();
  ctx.strokeStyle = '#f5ecd2'; ctx.lineWidth = 0.17; ctx.stroke();
  for (const [bx, by] of [[-0.7, 0.55], [0.7, 0.55], [-0.7, -0.05], [0.7, -0.05]]) { shape(ctx, '#f5ecd2', () => { ctx.arc(bx - 0.05, by, 0.1, 0, TAU); ctx.arc(bx + 0.05, by, 0.1, 0, TAU); }, lw); }
  // skull
  shape(ctx, '#f5ecd2', () => {
    ctx.moveTo(-0.46, 0.04); ctx.bezierCurveTo(-0.5, -0.62, 0.5, -0.62, 0.46, 0.04);
    ctx.bezierCurveTo(0.46, 0.2, 0.3, 0.22, 0.3, 0.34); ctx.lineTo(-0.3, 0.34); ctx.bezierCurveTo(-0.3, 0.22, -0.46, 0.2, -0.46, 0.04); ctx.closePath();
  }, lw * 1.2);
  ctx.fillStyle = PAL.ink;
  ctx.beginPath(); ctx.ellipse(-0.18, -0.06, 0.12, 0.14, 0, 0, TAU); ctx.ellipse(0.18, -0.06, 0.12, 0.14, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 0.04); ctx.lineTo(-0.06, 0.16); ctx.lineTo(0.06, 0.16); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; ctx.beginPath(); for (const tx of [-0.15, -0.05, 0.05, 0.15]) { ctx.moveTo(tx, 0.24); ctx.lineTo(tx, 0.34); } ctx.stroke();
  ctx.restore();
}

export function drawGarden(ctx, x, y, s, t = 0, noGoose = false) {
  // drawn in real units (no scale transform) because drawGoose sizes its own outlines
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lw = Math.max(1.2, s * 0.012);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + t * 0.1, rx = Math.cos(a) * 0.9 * s, ry = Math.sin(a) * 0.9 * s;
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(a + Math.PI / 2);
    shape(ctx, i % 2 ? '#6ea34f' : '#4f8a4a', () => ctx.ellipse(0, 0, 0.09 * s, 0.2 * s, 0, 0, TAU), lw);
    ctx.restore();
  }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; shape(ctx, i % 2 ? PAL.oxblood : PAL.gold, () => ctx.arc(Math.cos(a) * 0.78 * s, Math.sin(a) * 0.78 * s, 0.07 * s, 0, TAU), lw); }
  ctx.restore();
  if (!noGoose) drawGoose(ctx, x - s * 0.02, y + s * 0.06, s * 0.5, { fill: '#fffdf4' });
}

export function drawSignpost(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const lw = 1.6 / s; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  shape(ctx, '#8a5a2c', () => ctx.rect(-0.07, -0.7, 0.14, 1.4), lw);
  shape(ctx, '#e9c77f', () => { ctx.moveTo(-0.6, -0.62); ctx.lineTo(0.28, -0.62); ctx.lineTo(0.62, -0.46); ctx.lineTo(0.28, -0.3); ctx.lineTo(-0.6, -0.3); ctx.closePath(); }, lw);
  shape(ctx, '#e9c77f', () => { ctx.moveTo(0.6, -0.16); ctx.lineTo(-0.28, -0.16); ctx.lineTo(-0.62, 0.0); ctx.lineTo(-0.28, 0.16); ctx.lineTo(0.6, 0.16); ctx.closePath(); }, lw);
  ctx.restore();
}

export function drawFeather(ctx, x, y, s, rot = -0.6, col = '#f7f1e2') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); const lw = 1.5 / s; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  shape(ctx, col, () => { ctx.moveTo(-1, 0); ctx.bezierCurveTo(-0.5, -0.5, 0.5, -0.5, 1, 0); ctx.bezierCurveTo(0.5, 0.42, -0.5, 0.42, -1, 0); ctx.closePath(); }, lw);
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(-1.25, 0.02); ctx.lineTo(0.8, 0); ctx.stroke();
  ctx.strokeStyle = PAL.sepiaSoft; ctx.lineWidth = lw * 0.7; ctx.beginPath();
  for (let i = -3; i <= 3; i++) { ctx.moveTo(i * 0.22, 0); ctx.lineTo(i * 0.22 + 0.2, -0.3 + Math.abs(i) * 0.04); ctx.moveTo(i * 0.22, 0); ctx.lineTo(i * 0.22 + 0.2, 0.28 - Math.abs(i) * 0.04); }
  ctx.stroke();
  ctx.restore();
}

export function drawFlag(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const lw = 1.6 / s; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  shape(ctx, '#7a5a3c', () => ctx.rect(-0.55, -0.8, 0.1, 1.5), lw);
  shape(ctx, PAL.oxblood, () => { ctx.moveTo(-0.45, -0.78); ctx.quadraticCurveTo(0.1, -0.55, 0.6, -0.8); ctx.lineTo(0.5, -0.4); ctx.quadraticCurveTo(0.1, -0.15, -0.45, -0.4); ctx.closePath(); }, lw);
  ctx.restore();
}

const PICS = { goose: 1, bridge: 1, inn: 1, well: 1, maze: 1, prison: 1, skeleton: 1, garden: 1, road: 1, start: 1 };
export function drawPicture(ctx, kind, x, y, s, o = {}) {
  if (!PICS[kind]) return;
  if (kind === 'goose') drawGoose(ctx, x, y + s * 0.02, s * 0.62, o);
  else if (kind === 'bridge') drawBridge(ctx, x, y, s * 0.72);
  else if (kind === 'inn') drawInn(ctx, x, y - s * 0.04, s * 0.68);
  else if (kind === 'well') drawWell(ctx, x, y, s * 0.66);
  else if (kind === 'maze') drawMaze(ctx, x, y, s * 0.62);
  else if (kind === 'prison') drawPrison(ctx, x, y, s * 0.66);
  else if (kind === 'skeleton') drawSkull(ctx, x, y, s * 0.66);
  else if (kind === 'garden') drawGarden(ctx, x, y, s * 0.62, o.t ?? 0);
  else if (kind === 'road') drawSignpost(ctx, x, y, s * 0.64);
  else if (kind === 'start') drawFlag(ctx, x, y, s * 0.62);
}

// ---- pawns, dice ----------------------------------------------------------------------------------------------------------------------
export function drawPawn(ctx, x, y, size, idx, o = {}) {
  const col = PLAYER_COLORS[idx % 6], dk = PLAYER_DARK[idx % 6], lift = o.lift ?? 0, a = o.alpha ?? 1;
  ctx.save(); ctx.globalAlpha = a;
  // shadow on the board
  ctx.fillStyle = `rgba(30,18,6,${0.32 - Math.min(0.2, lift / (size * 4))})`;
  ctx.beginPath(); ctx.ellipse(x + lift * 0.18, y + size * 0.12, size * (0.46 - lift / (size * 14)), size * 0.16, 0, 0, TAU); ctx.fill();
  const by = y - lift;
  const spr = sprites.ready && !o.noSprite ? sprites.pawn[idx % 6] : null;
  if (spr) {
    const sz = size * 1.9;
    ctx.drawImage(spr, x - sz / 2, by + size * 0.14 - sz * 0.8, sz, sz);
    if (o.num) {
      ctx.fillStyle = idx % 6 === 5 || idx % 6 === 3 ? PAL.ink : '#fff7e0'; ctx.font = `700 ${size * 0.3}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = size * 0.08; ctx.strokeStyle = 'rgba(20,8,0,0.55)'; ctx.lineJoin = 'round'; ctx.strokeText(String(o.num), x, by - size * 0.03); ctx.fillText(String(o.num), x, by - size * 0.03);
    }
    if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + size * 0.1, size * 0.6, size * 0.22, 0, 0, TAU); ctx.stroke(); }
    ctx.restore(); return;
  }
  // body: a turned pawn
  const g = ctx.createLinearGradient(x - size * 0.4, 0, x + size * 0.4, 0);
  g.addColorStop(0, dk); g.addColorStop(0.35, col); g.addColorStop(1, dk);
  ctx.fillStyle = g; ctx.strokeStyle = PAL.ink; ctx.lineWidth = Math.max(1.4, size * 0.05); ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size * 0.42, by + size * 0.08);
  ctx.quadraticCurveTo(x - size * 0.42, by - size * 0.02, x - size * 0.2, by - size * 0.08);
  ctx.quadraticCurveTo(x - size * 0.12, by - size * 0.4, x - size * 0.2, by - size * 0.5);
  ctx.lineTo(x + size * 0.2, by - size * 0.5);
  ctx.quadraticCurveTo(x + size * 0.12, by - size * 0.4, x + size * 0.2, by - size * 0.08);
  ctx.quadraticCurveTo(x + size * 0.42, by - size * 0.02, x + size * 0.42, by + size * 0.08);
  ctx.quadraticCurveTo(x, by + size * 0.2, x - size * 0.42, by + size * 0.08);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // head
  const hg = ctx.createRadialGradient(x - size * 0.1, by - size * 0.76, size * 0.03, x, by - size * 0.68, size * 0.3);
  hg.addColorStop(0, '#ffffffcc'); hg.addColorStop(0.25, col); hg.addColorStop(1, dk);
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, by - size * 0.68, size * 0.27, 0, TAU); ctx.fill(); ctx.stroke();
  // number on the chest so players can be told apart without colour
  if (o.num) {
    ctx.fillStyle = idx % 6 === 5 || idx % 6 === 3 ? PAL.ink : '#fff7e0';
    ctx.font = `700 ${size * 0.34}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(o.num), x, by - size * 0.22);
  }
  if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + size * 0.1, size * 0.6, size * 0.22, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

const PIPS = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
export function drawDie(ctx, cx, cy, size, v, o = {}) {
  const rot = o.rot ?? 0, used = o.used ?? true, glow = o.glow;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  const h = size / 2, rad = size * 0.2;
  ctx.fillStyle = 'rgba(20,10,0,0.35)'; rr(ctx, -h + size * 0.04, -h + size * 0.08, size, size, rad); ctx.fill();
  const g = ctx.createLinearGradient(-h, -h, h, h);
  g.addColorStop(0, used ? '#fffaf0' : '#e0d6bc'); g.addColorStop(1, used ? '#e6d6aa' : '#bfb08a');
  ctx.fillStyle = g; rr(ctx, -h, -h, size, size, rad); ctx.fill();
  ctx.lineWidth = Math.max(1.5, size * 0.035); ctx.strokeStyle = PAL.ink; rr(ctx, -h, -h, size, size, rad); ctx.stroke();
  if (glow) { ctx.lineWidth = 4; ctx.strokeStyle = glow; rr(ctx, -h - 3, -h - 3, size + 6, size + 6, rad + 3); ctx.stroke(); }
  const pr = size * 0.085, sp = size * 0.26;
  ctx.fillStyle = v === 1 ? PAL.oxblood : PAL.ink;
  for (const [px, py] of PIPS[v] ?? []) { ctx.beginPath(); ctx.arc(px * sp, py * sp, v === 1 ? pr * 1.35 : pr, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---- particles -------------------------------------------------------------------------------------------------------------------------
// kind 'feather' (drifting white quills) or 'spark' (gold dots)
export function burst(parts, rng, x, y, n, kind = 'spark', power = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), sp = rng.range(40, 220) * power;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * power, life: rng.range(0.6, 1.3), age: 0, kind, rot: rng.range(0, TAU), vr: rng.range(-4, 4), s: rng.range(0.6, 1.2) });
  }
  if (parts.length > 160) parts.splice(0, parts.length - 160);
}
export function stepParticles(parts, dt) {
  for (const p of parts) {
    p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'feather' ? 70 : 220) * dt; p.vx *= 1 - Math.min(1, dt * (p.kind === 'feather' ? 1.8 : 0.8)); p.rot += p.vr * dt;
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
}
export function drawParticles(ctx, parts, unit) {
  for (const p of parts) {
    const a = 1 - p.age / p.life;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.4));
    if (p.kind === 'feather') drawFeather(ctx, p.x, p.y, unit * 0.2 * p.s, p.rot);
    else { ctx.fillStyle = PAL.goldHi; ctx.beginPath(); ctx.arc(p.x, p.y, unit * 0.045 * p.s, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}
