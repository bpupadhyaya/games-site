// The art: cast brass weights, the leather bag, gold dust and the pan balance. Pure drawing, no state.
// Weights are drawn in a unit box (plate width = 1, origin = bottom centre of the plate, y up is negative) and scaled by `s`.
import { theme, mix, rgba, rr, NUM, F } from './ui.js';
import { v3 } from './v3.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b = 0) => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; return (h >>> 0) / 4294967296; };
const TAU = Math.PI * 2;

// ---- brass -----------------------------------------------------------------------------------------------------------------
function brassGrad(ctx, x0, y0, x1, y1, k = 1) {
  const b = theme().brass, g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, b[0]); g.addColorStop(0.42, b[1]); g.addColorStop(1, mix(b[2], '#000000', 0.15 * k));
  return g;
}
const INK = '#3a2006';
function cast(ctx, lw = 0.03) {
  const T = theme();
  ctx.fillStyle = brassGrad(ctx, -0.4, -1, 0.4, 0);
  ctx.fill();
  ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = mix(T.brass[2], '#000000', 0.45); ctx.stroke();
  // cast-metal lighting: top light falling to a dark underside, a bevel lit on the upper-left edge and shaded lower-right
  ctx.save(); ctx.clip();
  const lg = ctx.createLinearGradient(0, -0.95, 0, 0.02);
  lg.addColorStop(0, 'rgba(255,248,215,0.42)'); lg.addColorStop(0.45, 'rgba(255,230,160,0.04)'); lg.addColorStop(1, 'rgba(40,18,0,0.38)');
  ctx.fillStyle = lg; ctx.fillRect(-1, -1.2, 2, 1.3);
  ctx.lineJoin = 'round'; ctx.lineWidth = lw * 2.2;
  ctx.translate(lw * 0.9, lw * 0.9); ctx.strokeStyle = 'rgba(40,18,0,0.35)'; ctx.stroke();
  ctx.translate(-lw * 1.8, -lw * 1.8); ctx.strokeStyle = 'rgba(255,250,225,0.5)'; ctx.stroke();
  ctx.restore();
}
function incise(ctx, lw = 0.016) { ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(58,32,6,0.72)'; ctx.stroke(); }
function shine(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = 'rgba(255,252,225,0.75)'; ctx.fill(); }

// ---- the figures (unit coordinates, base at y = 0, about 0.84 wide and 0.8 high) -----------------------------------------------
export const FIGS = ['rosette', 'disc', 'fish', 'bird', 'tortoise', 'pyramid', 'croc', 'drum', 'coil', 'cowrie'];
export const figOf = (v) => FIGS[((v % 10) + 10) % 10];
export const FIG_NAMES = { rosette: 'rosette', disc: 'sun disc', fish: 'mudfish', bird: 'bird', tortoise: 'tortoise', pyramid: 'stepped pyramid', croc: 'crocodile', drum: 'drum', coil: 'twisted ring', cowrie: 'cowrie shell' };
export const FIG = {
  disc(ctx) {
    ctx.beginPath(); ctx.arc(0, -0.4, 0.4, 0, TAU); cast(ctx);
    ctx.beginPath(); ctx.arc(0, -0.4, 0.29, 0, TAU); incise(ctx, 0.02);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 0.345, -0.4 + Math.sin(a) * 0.345, 0.022, 0, TAU); ctx.fillStyle = 'rgba(58,32,6,0.7)'; ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, -0.4, 0.11, 0, TAU); ctx.fillStyle = brassGrad(ctx, -0.1, -0.5, 0.1, -0.3, 0.4); ctx.fill(); incise(ctx, 0.016);
    shine(ctx, -0.17, -0.58, 0.03);
  },
  rosette(ctx) {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 0.24, -0.4 + Math.sin(a) * 0.24, 0.15, 0, TAU); cast(ctx, 0.026); }
    ctx.beginPath(); ctx.arc(0, -0.4, 0.17, 0, TAU); cast(ctx, 0.026);
    ctx.beginPath(); ctx.arc(0, -0.4, 0.07, 0, TAU); incise(ctx, 0.02);
    shine(ctx, -0.06, -0.47, 0.025);
  },
  fish(ctx) {
    ctx.beginPath(); ctx.moveTo(-0.46, -0.4);
    ctx.bezierCurveTo(-0.32, -0.7, 0.12, -0.74, 0.26, -0.46); ctx.lineTo(0.46, -0.7); ctx.lineTo(0.38, -0.4); ctx.lineTo(0.46, -0.1); ctx.lineTo(0.26, -0.34);
    ctx.bezierCurveTo(0.1, -0.1, -0.32, -0.1, -0.46, -0.4); ctx.closePath(); cast(ctx);
    ctx.beginPath(); ctx.arc(-0.31, -0.46, 0.04, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.arc(-0.2, -0.4, 0.17, -1.1, 1.1); incise(ctx, 0.018);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { ctx.beginPath(); ctx.arc(-0.02 + c * 0.1 + r * 0.05, -0.43 + r * 0.1 - 0.06, 0.05, 0.2, Math.PI - 0.2); incise(ctx, 0.014); }
    ctx.beginPath(); ctx.moveTo(-0.1, -0.66); ctx.lineTo(0.06, -0.78); ctx.lineTo(0.14, -0.62); ctx.closePath(); cast(ctx, 0.024);
    shine(ctx, -0.22, -0.58, 0.028);
  },
  bird(ctx) {
    // the bird that looks back over its shoulder
    for (const a of [-0.5, 0.1]) { ctx.beginPath(); ctx.moveTo(0.22, -0.3); ctx.quadraticCurveTo(0.42, -0.3 + a * 0.2, 0.52, -0.3 + a * 0.55); ctx.lineTo(0.46, -0.22 + a * 0.5); ctx.lineTo(0.24, -0.22); ctx.closePath(); cast(ctx, 0.022); }
    ctx.beginPath(); ctx.ellipse(-0.02, -0.28, 0.32, 0.2, -0.15, 0, TAU); cast(ctx);
    ctx.beginPath(); ctx.moveTo(-0.14, -0.3); ctx.quadraticCurveTo(0.08, -0.46, 0.24, -0.28); ctx.moveTo(-0.08, -0.24); ctx.quadraticCurveTo(0.08, -0.34, 0.18, -0.24); incise(ctx, 0.016);
    ctx.beginPath(); ctx.moveTo(-0.2, -0.36); ctx.bezierCurveTo(-0.46, -0.6, -0.14, -0.9, 0.12, -0.66);
    ctx.lineWidth = 0.13; ctx.lineCap = 'round'; ctx.strokeStyle = mix(theme().brass[2], '#000000', 0.45); ctx.stroke();
    ctx.lineWidth = 0.1; ctx.strokeStyle = brassGrad(ctx, -0.4, -0.9, 0.1, -0.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(0.13, -0.66, 0.095, 0, TAU); cast(ctx, 0.022);
    ctx.beginPath(); ctx.moveTo(0.19, -0.72); ctx.lineTo(0.4, -0.54); ctx.lineTo(0.17, -0.58); ctx.closePath(); cast(ctx, 0.02);
    ctx.beginPath(); ctx.arc(0.12, -0.69, 0.02, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-0.08, -0.1); ctx.lineTo(-0.1, 0); ctx.moveTo(0.08, -0.1); ctx.lineTo(0.1, 0); ctx.strokeStyle = mix(theme().brass[2], '#000000', 0.3); ctx.lineWidth = 0.045; ctx.stroke();
    shine(ctx, -0.16, -0.36, 0.028);
  },
  tortoise(ctx) {
    ctx.beginPath(); ctx.moveTo(-0.34, -0.15); ctx.bezierCurveTo(-0.34, -0.66, 0.34, -0.66, 0.34, -0.15); ctx.closePath(); cast(ctx);
    ctx.beginPath(); ctx.moveTo(-0.1, -0.52); ctx.lineTo(0.1, -0.52); ctx.lineTo(0.17, -0.36); ctx.lineTo(0.1, -0.22); ctx.lineTo(-0.1, -0.22); ctx.lineTo(-0.17, -0.36); ctx.closePath(); incise(ctx, 0.018);
    ctx.beginPath(); ctx.moveTo(-0.1, -0.52); ctx.lineTo(-0.2, -0.6); ctx.moveTo(0.1, -0.52); ctx.lineTo(0.2, -0.6); ctx.moveTo(0.17, -0.36); ctx.lineTo(0.3, -0.34); ctx.moveTo(-0.17, -0.36); ctx.lineTo(-0.3, -0.34); ctx.moveTo(0.1, -0.22); ctx.lineTo(0.2, -0.16); ctx.moveTo(-0.1, -0.22); ctx.lineTo(-0.2, -0.16); incise(ctx, 0.015);
    ctx.beginPath(); ctx.arc(-0.43, -0.27, 0.08, 0, TAU); cast(ctx, 0.022);
    ctx.beginPath(); ctx.arc(-0.45, -0.285, 0.014, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    for (const x of [-0.26, 0.14]) { ctx.beginPath(); ctx.roundRect(x, -0.17, 0.12, 0.17, 0.04); cast(ctx, 0.022); }
    ctx.beginPath(); ctx.moveTo(0.34, -0.2); ctx.lineTo(0.46, -0.12); ctx.lineTo(0.33, -0.12); ctx.closePath(); cast(ctx, 0.02);
    shine(ctx, -0.16, -0.5, 0.028);
  },
  pyramid(ctx) {
    const steps = [[0.84, 0.18], [0.62, 0.17], [0.42, 0.17], [0.22, 0.17]];
    let y = 0;
    for (const [w, h] of steps) { ctx.beginPath(); ctx.roundRect(-w / 2, y - h, w, h, 0.02); cast(ctx, 0.024); y -= h; }
    ctx.beginPath(); ctx.arc(0, y - 0.05, 0.06, 0, TAU); cast(ctx, 0.02);
    ctx.beginPath(); ctx.moveTo(-0.3, -0.09); ctx.lineTo(0.3, -0.09); ctx.moveTo(-0.2, -0.26); ctx.lineTo(0.2, -0.26); incise(ctx, 0.012);
    shine(ctx, -0.32, -0.12, 0.022);
  },
  croc(ctx) {
    ctx.beginPath(); ctx.moveTo(-0.5, -0.2); ctx.lineTo(-0.5, -0.28); ctx.lineTo(-0.32, -0.31); ctx.lineTo(-0.27, -0.38); ctx.lineTo(-0.2, -0.31);
    let x = -0.1;
    for (let i = 0; i < 6; i++) { ctx.lineTo(x, -0.43); ctx.lineTo(x + 0.04, -0.33); x += 0.08; }
    ctx.bezierCurveTo(0.42, -0.34, 0.5, -0.4, 0.52, -0.58); ctx.bezierCurveTo(0.44, -0.46, 0.36, -0.26, 0.26, -0.18);
    ctx.lineTo(0.2, -0.18); ctx.lineTo(0.22, 0); ctx.lineTo(0.1, 0); ctx.lineTo(0.08, -0.16); ctx.lineTo(-0.1, -0.16); ctx.lineTo(-0.12, 0); ctx.lineTo(-0.24, 0); ctx.lineTo(-0.22, -0.16); ctx.lineTo(-0.4, -0.16); ctx.closePath(); cast(ctx);
    ctx.beginPath(); ctx.arc(-0.27, -0.35, 0.022, 0, TAU); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-0.5, -0.22); ctx.lineTo(-0.34, -0.23); incise(ctx, 0.014);
    shine(ctx, -0.42, -0.26, 0.02);
  },
  drum(ctx) {
    ctx.beginPath(); ctx.moveTo(-0.27, -0.74); ctx.quadraticCurveTo(-0.07, -0.4, -0.25, -0.06); ctx.lineTo(0.25, -0.06); ctx.quadraticCurveTo(0.07, -0.4, 0.27, -0.74); ctx.closePath(); cast(ctx);
    ctx.beginPath(); ctx.ellipse(0, -0.74, 0.27, 0.07, 0, 0, TAU); ctx.fillStyle = brassGrad(ctx, -0.2, -0.8, 0.2, -0.68, 0.2); ctx.fill(); incise(ctx, 0.018);
    ctx.beginPath(); ctx.moveTo(-0.24, -0.7); ctx.lineTo(-0.1, -0.1); ctx.lineTo(-0.02, -0.7); ctx.lineTo(0.06, -0.1); ctx.lineTo(0.14, -0.7); ctx.lineTo(0.22, -0.1); incise(ctx, 0.014);
    shine(ctx, -0.17, -0.62, 0.024);
  },
  coil(ctx) {
    ctx.beginPath(); ctx.arc(0, -0.4, 0.31, 0, TAU); ctx.lineWidth = 0.18; ctx.strokeStyle = mix(theme().brass[2], '#000000', 0.45); ctx.stroke();
    ctx.lineWidth = 0.14; ctx.strokeStyle = brassGrad(ctx, -0.3, -0.7, 0.3, -0.1); ctx.stroke();
    for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU, c = Math.cos(a), s2 = Math.sin(a); ctx.beginPath(); ctx.moveTo(c * 0.26, -0.4 + s2 * 0.26 - 0); ctx.lineTo(c * 0.36, -0.4 + s2 * 0.36); ctx.lineWidth = 0.014; ctx.strokeStyle = 'rgba(58,32,6,0.6)'; ctx.stroke(); }
    shine(ctx, -0.2, -0.62, 0.028);
  },
  cowrie(ctx) {
    ctx.save(); ctx.translate(0, -0.34); ctx.rotate(-0.25);
    ctx.beginPath(); ctx.ellipse(0, 0, 0.4, 0.27, 0, 0, TAU); cast(ctx);
    ctx.beginPath(); ctx.moveTo(-0.3, 0.02); ctx.quadraticCurveTo(0, -0.1, 0.3, 0.02); ctx.quadraticCurveTo(0, 0.1, -0.3, 0.02); ctx.fillStyle = INK; ctx.fill();
    for (let i = -5; i <= 5; i++) { const x = i * 0.055; ctx.beginPath(); ctx.moveTo(x, -0.075 + Math.abs(i) * 0.005); ctx.lineTo(x, 0.13 - Math.abs(i) * 0.012); incise(ctx, 0.012); }
    shine(ctx, -0.2, -0.17, 0.03);
    ctx.restore();
  },
};

// A cast weight standing on its engraved plate. (x, y) = bottom centre of the plate, s = plate width.
export function drawWeight(ctx, x, y, s, value, o = {}) {
  const T = theme(), { alpha = 1, glow = 0, lift = 0, shadow = true, tint = null } = o;
  if (v3.on) { v3.items.push({ k: 'w', v: value, x, y, s, lift, glow, dim: 1 - alpha * (ctx.globalAlpha ?? 1), z: o.z ?? 0, clip: v3.clip, shadow, stand: o.stand ?? true }); return; }
  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow) { ctx.beginPath(); ctx.ellipse(x, y + s * 0.01, s * (0.5 + lift * 0.04), s * 0.075, 0, 0, TAU); ctx.fillStyle = `rgba(0,0,0,${0.32 - lift * 0.1})`; ctx.fill(); }
  y -= lift * s * 0.16;
  if (glow > 0) {
    const g = ctx.createRadialGradient(x, y - s * 0.5, s * 0.1, x, y - s * 0.5, s * 0.95);
    g.addColorStop(0, rgba(T.sel, 0.55 * glow)); g.addColorStop(1, rgba(T.sel, 0));
    ctx.fillStyle = g; ctx.fillRect(x - s, y - s * 1.5, s * 2, s * 2);
  }
  ctx.translate(x, y); ctx.scale(s, s);
  // plate
  ctx.beginPath(); ctx.roundRect(-0.48, -0.3, 0.96, 0.3, 0.07); cast(ctx, 0.022);
  ctx.beginPath(); ctx.roundRect(-0.43, -0.265, 0.86, 0.23, 0.05); ctx.fillStyle = 'rgba(58,32,6,0.2)'; ctx.fill();
  // figure
  ctx.save(); ctx.translate(0, -0.29); ctx.scale(0.92, 0.92); FIG[figOf(value)](ctx); ctx.restore();
  ctx.restore();
  if (tint) { ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = tint; ctx.beginPath(); ctx.roundRect(x - s * 0.5, y - s * 1.2, s, s * 1.22, s * 0.1); ctx.fill(); ctx.restore(); }
  // the number, cut into the plate
  const fs = Math.max(s * 0.25, 8);
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = `400 ${fs}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ny = y - lift * s * 0.16 * 0 - s * 0.15;
  ctx.fillStyle = 'rgba(255,248,214,0.55)'; ctx.fillText(String(value), x + s * 0.012, ny + s * 0.018);
  ctx.fillStyle = '#3a2006'; ctx.fillText(String(value), x, ny);
  ctx.restore();
}

// ---- the bag --------------------------------------------------------------------------------------------------------------------
// (x, y) = bottom centre, s = width. fill 0..1 shows how close the bag is to the order.
export function drawBag(ctx, x, y, s, amount, o = {}) {
  const T = theme(), { alpha = 1, glow = 0, lift = 0, fill = 0, shadow = true } = o;
  if (v3.on) { v3.items.push({ k: 'bag', v: amount, x, y, s, lift, glow, fill, dim: 1 - alpha * (ctx.globalAlpha ?? 1), z: o.z ?? 0, clip: v3.clip, shadow, stand: o.stand ?? true }); return; }
  ctx.save(); ctx.globalAlpha = alpha;
  if (shadow) { ctx.beginPath(); ctx.ellipse(x, y + s * 0.01, s * 0.46, s * 0.075, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); }
  y -= lift * s * 0.14;
  if (glow > 0) { const g = ctx.createRadialGradient(x, y - s * 0.5, s * 0.1, x, y - s * 0.5, s * 0.9); g.addColorStop(0, rgba(T.sel, 0.5 * glow)); g.addColorStop(1, rgba(T.sel, 0)); ctx.fillStyle = g; ctx.fillRect(x - s, y - s * 1.5, s * 2, s * 2); }
  ctx.translate(x, y); ctx.scale(s, s);
  // body
  ctx.beginPath(); ctx.moveTo(-0.14, -0.74); ctx.bezierCurveTo(-0.5, -0.5, -0.56, -0.02, -0.28, 0); ctx.lineTo(0.28, 0); ctx.bezierCurveTo(0.56, -0.02, 0.5, -0.5, 0.14, -0.74); ctx.closePath();
  const g = ctx.createLinearGradient(-0.5, -0.7, 0.5, 0); g.addColorStop(0, '#c98852'); g.addColorStop(0.5, '#8e5528'); g.addColorStop(1, '#4e2810');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 0.025; ctx.strokeStyle = '#2a1206'; ctx.lineJoin = 'round'; ctx.stroke();
  // stitching
  ctx.setLineDash([0.04, 0.04]); ctx.beginPath(); ctx.moveTo(-0.2, -0.62); ctx.bezierCurveTo(-0.42, -0.44, -0.46, -0.1, -0.24, -0.06); ctx.moveTo(0.2, -0.62); ctx.bezierCurveTo(0.42, -0.44, 0.46, -0.1, 0.24, -0.06); ctx.lineWidth = 0.014; ctx.strokeStyle = 'rgba(255,230,180,0.55)'; ctx.stroke(); ctx.setLineDash([]);
  // gold at the mouth: more of it as the bag fills
  const k = clamp(fill, 0, 1);
  if (amount > 0) {
    ctx.beginPath(); ctx.ellipse(0, -0.86, 0.2 + 0.05 * k, 0.07 + 0.04 * k, 0, 0, TAU);
    const gg = ctx.createLinearGradient(0, -0.95, 0, -0.78); gg.addColorStop(0, '#fff0a0'); gg.addColorStop(1, '#d09a22'); ctx.fillStyle = gg; ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc((hash(i, 3) - 0.5) * 0.3, -0.9 - hash(i, 4) * 0.05 * (0.4 + k), 0.016, 0, TAU); ctx.fillStyle = '#fff6c0'; ctx.fill(); }
  }
  // neck, cord and flare
  ctx.beginPath(); ctx.moveTo(-0.2, -0.86); ctx.lineTo(-0.15, -0.72); ctx.lineTo(0.15, -0.72); ctx.lineTo(0.2, -0.86); ctx.quadraticCurveTo(0.12, -0.8, 0, -0.8); ctx.quadraticCurveTo(-0.12, -0.8, -0.2, -0.86); ctx.closePath();
  ctx.fillStyle = '#7a4520'; ctx.fill(); ctx.lineWidth = 0.02; ctx.strokeStyle = '#2a1206'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.17, -0.74); ctx.quadraticCurveTo(0, -0.68, 0.17, -0.74); ctx.lineWidth = 0.035; ctx.strokeStyle = brassGrad(ctx, -0.2, -0.8, 0.2, -0.7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.1, -0.71); ctx.quadraticCurveTo(0.2, -0.6, 0.15, -0.54); ctx.moveTo(0.04, -0.7); ctx.quadraticCurveTo(0.1, -0.56, 0.02, -0.5); ctx.lineWidth = 0.025; ctx.stroke();
  ctx.restore();
  // amount on the leather
  const fs = Math.max(s * 0.28, 9);
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = `400 ${fs}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(String(amount), x + s * 0.01, y - s * 0.3 + s * 0.02);
  ctx.fillStyle = '#fff3cf'; ctx.fillText(String(amount), x, y - s * 0.3);
  ctx.restore();
}

// ---- gold dust --------------------------------------------------------------------------------------------------------------------
// A heap of grains standing on baseY, centred on cx, at most `halfW` wide each side.
export function drawDust(ctx, cx, baseY, halfW, amount, t = 0, seed = 1, o = {}) {
  if (amount <= 0) return;
  const n = Math.round(clamp(10 + Math.sqrt(amount) * 12, 10, 200)), hh = halfW * (0.2 + 0.55 * (1 - Math.exp(-amount / 30))), wd = halfW * (0.4 + 0.6 * (1 - Math.exp(-amount / 14)));
  const gr = Math.max(1.8, halfW * 0.05), calm = o.calm;
  ctx.save();
  // the mound itself
  ctx.beginPath(); ctx.moveTo(cx - wd, baseY);
  for (let i = 0; i <= 16; i++) { const x = -wd + (i / 16) * 2 * wd, k = 1 - (x / wd) ** 2; ctx.lineTo(cx + x, baseY - hh * Math.pow(Math.max(0, k), 0.8)); }
  ctx.lineTo(cx + wd, baseY); ctx.closePath();
  const g = ctx.createLinearGradient(0, baseY - hh, 0, baseY); g.addColorStop(0, '#ffe27a'); g.addColorStop(0.5, '#e0a52c'); g.addColorStop(1, '#8c5a12');
  ctx.fillStyle = g; ctx.fill();
  for (let i = 0; i < n; i++) {
    const a = hash(i, seed), b = hash(i, seed + 17), c = hash(i, seed + 31);
    const x = (a * 2 - 1) * wd * 0.98, prof = Math.pow(Math.max(0, 1 - (x / wd) ** 2), 0.8), y = -(prof * hh * (0.55 + 0.5 * b));
    ctx.fillStyle = c > 0.7 ? '#fff6b8' : c > 0.35 ? '#f6c548' : '#b9801a';
    ctx.beginPath(); ctx.arc(cx + x, baseY + y, gr * (0.6 + 0.7 * hash(i, seed + 5)), 0, TAU); ctx.fill();
  }
  if (!calm) for (let i = 0; i < 5; i++) {
    const a = hash(i, seed + 99), ph = Math.sin(t * 3 + i * 1.7 + a * 6), x = (hash(i, seed + 7) * 2 - 1) * wd * 0.8, prof = Math.pow(Math.max(0, 1 - (x / wd) ** 2), 0.8);
    if (ph > 0.5) { const px = cx + x, py = baseY - prof * hh * 0.85 - gr; ctx.strokeStyle = `rgba(255,252,220,${(ph - 0.5) * 2})`; ctx.lineWidth = Math.max(1.4, gr * 0.5); ctx.beginPath(); ctx.moveTo(px - gr * 2, py); ctx.lineTo(px + gr * 2, py); ctx.moveTo(px, py - gr * 2); ctx.lineTo(px, py + gr * 2); ctx.stroke(); }
  }
  ctx.restore();
}

// ---- the balance -----------------------------------------------------------------------------------------------------------------------
// Geometry for a scene rectangle and a beam angle (radians, positive = left pan down).
export function balanceGeo(rect, ang = 0) {
  const cx = rect.x + rect.w / 2, hl = Math.min(rect.w * 0.325, rect.h * 0.6), piv = { x: cx, y: rect.y + Math.max(hl * 0.3, rect.h * 0.17) };
  const chain = Math.min(rect.h * 0.3, hl * 0.95), dw = hl * 0.5, ca = Math.cos(ang), sa = Math.sin(ang);
  const le = { x: cx - hl * ca, y: piv.y + hl * sa }, re = { x: cx + hl * ca, y: piv.y - hl * sa };
  const L = { x: le.x, y: le.y + chain }, R = { x: re.x, y: re.y + chain };
  const item = clamp(dw * 0.66, 26, 160), tableY = rect.y + rect.h * 0.9;
  return { rect, cx, hl, piv, chain, dw, ang, le, re, L, R, item, tableY };
}
// k-th item (0 = first placed) on a pan: bottom centre of its plate. 3 across, rows going up.
export function slotPos(G, side, k, count = 1) {
  const P = side === 'left' ? G.L : G.R, s = G.item, cols = 3, row = Math.floor(k / cols), inRow = k % cols;
  const rowCount = Math.min(cols, count - row * cols), pitch = s * 0.98;
  const x = P.x + (inRow - (rowCount - 1) / 2) * pitch, y = P.y + G.dw * 0.05 - row * s * 0.36;
  return { x, y, s, row };
}
export function panRect(G, side) { const P = side === 'left' ? G.L : G.R; return { x: P.x - G.dw * 1.05, y: P.y - G.item * 2.2, w: G.dw * 2.1, h: G.item * 2.2 + G.dw * 0.6 }; }

function dish(ctx, G, P, hot, T) {
  const dw = G.dw, ry = dw * 0.42;
  // chains
  ctx.lineWidth = Math.max(1.5, G.hl * 0.011); ctx.strokeStyle = mix(T.brass[2], '#ffffff', 0.12);
  const end = P === G.L ? G.le : G.re;
  ctx.beginPath(); ctx.moveTo(end.x, end.y); ctx.lineTo(P.x - dw, P.y); ctx.moveTo(end.x, end.y); ctx.lineTo(P.x + dw, P.y); ctx.moveTo(end.x, end.y); ctx.lineTo(P.x, P.y + ry * 0.55); ctx.stroke();
  ctx.setLineDash([G.hl * 0.018, G.hl * 0.018]); ctx.lineWidth = Math.max(2.5, G.hl * 0.02); ctx.strokeStyle = 'rgba(255,240,190,0.45)'; ctx.stroke(); ctx.setLineDash([]);
  // bowl
  ctx.beginPath(); ctx.moveTo(P.x - dw, P.y); ctx.bezierCurveTo(P.x - dw * 0.92, P.y + ry * 1.25, P.x + dw * 0.92, P.y + ry * 1.25, P.x + dw, P.y); ctx.ellipse(P.x, P.y, dw, dw * 0.1, 0, 0, Math.PI, true); ctx.closePath();
  ctx.fillStyle = brassGrad(ctx, P.x - dw, P.y, P.x + dw, P.y + ry); ctx.fill(); ctx.lineWidth = Math.max(1.5, G.hl * 0.012); ctx.strokeStyle = mix(T.brass[2], '#000000', 0.4); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(P.x, P.y, dw, dw * 0.1, 0, 0, TAU); ctx.fillStyle = hot ? rgba(T.sel, 0.5) : mix(T.brass[1], '#000000', 0.45); ctx.fill(); ctx.lineWidth = Math.max(1.5, G.hl * 0.012); ctx.strokeStyle = hot ? T.sel : mix(T.brass[0], T.brass[1], 0.4); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(P.x - dw * 0.25, P.y + ry * 0.55, dw * 0.35, dw * 0.04, -0.15, 0, TAU); ctx.fillStyle = 'rgba(255,250,215,0.4)'; ctx.fill();
}

// m: { ang, items: { left: [keys], right: [keys] }, value(key), dust, calm, t, hot: 'left'|'right'|null, skip: key|null, glow: {key: n}, bagFill, lift }
export function drawBalance(ctx, G, m) {
  const T = theme(), r = G.rect, hl = G.hl;
  if (v3.on) {
    v3.balances.push({ G, m, table: !m.mini, clip: v3.clip });
    if (m.chips) for (const side of ['left', 'right']) {
      const P = side === 'left' ? G.L : G.R, tot = m.chips[side];
      const cw = Math.max(G.dw * 1.0, 60), ch = Math.max(G.dw * 0.34, 28), cx = P.x, cy = P.y + G.dw * 0.62;
      v3.panels.push({ r: { x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch }, rad: ch * 0.5, kind: 'chip', clip: v3.clip, flash: 0, dim: 0 });
      ctx.font = `600 ${F(ch * 0.58)}px Fredoka, system-ui, sans-serif`; ctx.fillStyle = '#fff7e0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${side === 'left' ? 'Left' : 'Right'} ${tot}`, cx, cy + 1, cw - 8);
    }
    return;
  }
  // table and base
  drawTable(ctx, G);
  // pillar + base
  const pw = hl * 0.075;
  ctx.beginPath(); ctx.moveTo(G.cx - pw, G.piv.y); ctx.lineTo(G.cx + pw, G.piv.y); ctx.lineTo(G.cx + pw * 1.4, G.tableY - hl * 0.12); ctx.lineTo(G.cx - pw * 1.4, G.tableY - hl * 0.12); ctx.closePath();
  ctx.fillStyle = brassGrad(ctx, G.cx - pw, 0, G.cx + pw, 0); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = mix(T.brass[2], '#000000', 0.4); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(G.cx - hl * 0.36, G.tableY - hl * 0.14, hl * 0.72, hl * 0.14, hl * 0.04); ctx.fillStyle = brassGrad(ctx, G.cx - hl * 0.3, G.tableY - hl * 0.14, G.cx + hl * 0.3, G.tableY); ctx.fill(); ctx.stroke();
  // level scale on the pillar and the swinging pointer
  const sy = G.piv.y + hl * 0.2, pr = hl * 0.3;
  ctx.beginPath(); ctx.arc(G.cx, G.piv.y, pr + hl * 0.1, Math.PI * 0.62, Math.PI * 0.38, true); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(58,32,6,0.6)'; ctx.stroke();
  for (let i = -3; i <= 3; i++) { const a = Math.PI / 2 + i * 0.07, c = Math.cos(a), s2 = Math.sin(a); ctx.beginPath(); ctx.moveTo(G.cx + c * (pr + hl * 0.1), G.piv.y + s2 * (pr + hl * 0.1)); ctx.lineTo(G.cx + c * (pr + hl * 0.13 + (i === 0 ? hl * 0.04 : 0)), G.piv.y + s2 * (pr + hl * 0.13 + (i === 0 ? hl * 0.04 : 0))); ctx.stroke(); }
  const pa = Math.PI / 2 + G.ang * 1.0 * -1 * 0 + (-G.ang) * -1 * 0;
  ctx.beginPath(); ctx.moveTo(G.cx, G.piv.y); ctx.lineTo(G.cx + Math.sin(G.ang) * (pr + hl * 0.06), G.piv.y + Math.cos(G.ang) * (pr + hl * 0.06)); ctx.lineWidth = Math.max(2, hl * 0.014); ctx.strokeStyle = m.level ? T.good : T.err; ctx.stroke();
  void sy; void pa;
  // beam
  ctx.save(); ctx.translate(G.piv.x, G.piv.y); ctx.rotate(-G.ang);
  const bh = hl * 0.055;
  ctx.beginPath(); ctx.moveTo(-hl, 0); ctx.quadraticCurveTo(-hl * 0.5, -bh * 1.5, 0, -bh * 1.9); ctx.quadraticCurveTo(hl * 0.5, -bh * 1.5, hl, 0); ctx.quadraticCurveTo(hl * 0.5, bh * 1.5, 0, bh * 1.9); ctx.quadraticCurveTo(-hl * 0.5, bh * 1.5, -hl, 0); ctx.closePath();
  ctx.fillStyle = brassGrad(ctx, 0, -bh * 2, 0, bh * 2); ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = mix(T.brass[2], '#000000', 0.4); ctx.stroke();
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * hl, 0, hl * 0.045, 0, TAU); ctx.fillStyle = brassGrad(ctx, sx * hl - 8, -8, sx * hl + 8, 8); ctx.fill(); ctx.stroke(); }
  for (let i = -3; i <= 3; i++) if (i) { ctx.beginPath(); ctx.arc(i * hl * 0.24, 0, hl * 0.014, 0, TAU); ctx.fillStyle = 'rgba(58,32,6,0.65)'; ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, 0, hl * 0.085, 0, TAU); ctx.fillStyle = brassGrad(ctx, -hl * 0.08, -hl * 0.08, hl * 0.08, hl * 0.08); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, hl * 0.032, 0, TAU); ctx.fillStyle = mix(T.brass[2], '#000000', 0.3); ctx.fill();
  ctx.restore();
  // pans: back of dish, items, dust, front lip
  for (const side of ['left', 'right']) {
    const P = side === 'left' ? G.L : G.R;
    dish(ctx, G, P, m.hot === side, T);
    const keys = m.items[side];
    if (side === 'left' && m.dust > 0) drawDust(ctx, P.x, P.y + G.dw * 0.12, G.dw * 0.9, m.dust, m.t, 7, { calm: m.calm });
    keys.forEach((key, k) => {
      if (key === m.skip) return;
      const sp = slotPos(G, side, k, keys.length), gl = m.glow?.[key] ?? 0;
      if (key === 'bag') drawBag(ctx, sp.x, sp.y, sp.s * 1.02, m.bagShown, { glow: gl, fill: m.bagFill });
      else drawWeight(ctx, sp.x, sp.y, sp.s, key, { glow: gl });
    });
    if (m.chips) {
      const tot = m.chips[side];
      const cw = Math.max(G.dw * 1.0, 60), ch = Math.max(G.dw * 0.34, 28), cx = P.x, cy = P.y + G.dw * 0.62;
      rr(ctx, cx - cw / 2, cy - ch / 2, cw, ch, ch * 0.5); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(T.rim, 0.7); ctx.stroke();
      ctx.font = `600 ${F(ch * 0.58)}px Fredoka, system-ui, sans-serif`; ctx.fillStyle = T.dark ? '#fbf0d8' : '#fff7e0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${side === 'left' ? 'Left' : 'Right'} ${tot}`, cx, cy + 1, cw - 8);
    }
  }
  void r;
}

export function drawTable(ctx, G) {
  const T = theme(), r = G.rect, y0 = G.tableY - G.hl * 0.02, h = r.y + r.h - y0 + 6;
  if (h <= 0) return;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, T.wood[0]); g.addColorStop(1, T.wood[1]);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(r.x, y0, r.w, h + 40, 16); ctx.clip();
  ctx.fillStyle = g; ctx.fillRect(r.x, y0, r.w, h + 40);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(r.x, y0 + h * i / 5); ctx.lineTo(r.x + r.w, y0 + h * i / 5); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(r.x, y0, r.w, 3);
  ctx.restore();
  // a soft shadow under the base
  ctx.beginPath(); ctx.ellipse(G.cx, G.tableY + 4, G.hl * 0.5, G.hl * 0.05, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
}

// A small scene for the Rules pages and the title: weights on pans, optional bag and dust. `m` as drawBalance, plus ang.
export function drawMini(ctx, rect, m) {
  const G = balanceGeo(rect, m.ang ?? 0);
  drawBalance(ctx, G, { t: 0, calm: true, items: { left: [], right: [] }, dust: 0, bagShown: 0, bagFill: 0, ...m });
  return G;
}
export { hash, clamp, TAU };
