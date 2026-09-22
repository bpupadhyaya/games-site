// The cows: two hand-carved standing tokens, dark ebony and pale bone, painted once into sprites and reused for every piece.
// Reference space: origin at the centre of the base, x right, y up is negative; the cow is about 110 units wide. Light from the upper left.
import { lcg } from './art.js';
const TAU = Math.PI * 2;
const BOX = { x: -64, y: -96, w: 128, h: 118 }, SCALE = 4;

const PAL = {
  1: { name: 'Dark', hi: '#7a5a52', mid: '#3a2622', lo: '#170c0c', edge: '#0a0404', patch: '#e9d6b4', horn: ['#f6ead0', '#b79f74'], base: ['#5a3a2c', '#2a170f'], grain: 'rgba(255,220,190,0.10)', nose: '#c98c7a' },
  2: { name: 'Light', hi: '#fff6de', mid: '#e3cfa3', lo: '#a98a5c', edge: '#5a3f22', patch: '#9a5a34', horn: ['#5a4030', '#22140c'], base: ['#e8d3a4', '#9c7a4a'], grain: 'rgba(90,60,30,0.10)', nose: '#d9a08a' },
};

function paintCow(ctx, side) {
  const P = PAL[side];
  // soft contact shadow and the carved base (a low oval plinth)
  ctx.fillStyle = 'rgba(10,2,0,0.38)'; ctx.beginPath(); ctx.ellipse(6, 5, 52, 13, 0, 0, TAU); ctx.fill();
  let g = ctx.createLinearGradient(0, -14, 0, 8); g.addColorStop(0, P.base[0]); g.addColorStop(1, P.base[1]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 46, 12, 0, 0, Math.PI); ctx.lineTo(-46, -5); ctx.ellipse(0, -5, 46, 12, 0, Math.PI, TAU, false); ctx.closePath(); ctx.fill();
  g = ctx.createRadialGradient(-14, -12, 2, 0, -5, 50); g.addColorStop(0, P.hi); g.addColorStop(1, P.mid);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -5, 46, 12, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = P.edge; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, -5, 46, 12, 0, 0, TAU); ctx.stroke();
  // incised ring on the plinth
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -5, 38, 9, 0, 0, TAU); ctx.stroke();

  const body = new Path2DLike(ctx);
  // legs (far pair first, darker)
  const leg = (x, top, w, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + w, top); ctx.lineTo(x + w * 0.8, -9); ctx.lineTo(x + w * 0.1, -9); ctx.closePath(); ctx.fill(); };
  leg(-19, -36, 9, P.lo); leg(6, -36, 9, P.lo);
  // tail
  ctx.strokeStyle = P.mid; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-36, -50); ctx.bezierCurveTo(-48, -46, -50, -34, -46, -22); ctx.stroke();
  ctx.fillStyle = P.lo; ctx.beginPath(); ctx.ellipse(-46, -19, 3.6, 7, 0.1, 0, TAU); ctx.fill();
  // torso
  g = ctx.createLinearGradient(-30, -66, 10, -26); g.addColorStop(0, P.hi); g.addColorStop(0.45, P.mid); g.addColorStop(1, P.lo);
  ctx.fillStyle = g; ctx.strokeStyle = P.edge; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-38, -42); ctx.bezierCurveTo(-42, -58, -32, -64, -18, -62); ctx.bezierCurveTo(-4, -60, 8, -66, 22, -62); ctx.bezierCurveTo(32, -60, 34, -46, 30, -38); ctx.bezierCurveTo(26, -28, 8, -26, -10, -27); ctx.bezierCurveTo(-28, -28, -36, -32, -38, -42); ctx.closePath(); ctx.fill(); ctx.stroke();
  // hide pattern: patches (clipped to the torso)
  ctx.save(); ctx.clip();
  ctx.fillStyle = P.patch; ctx.globalAlpha = side === 1 ? 0.95 : 0.9;
  ctx.beginPath(); ctx.ellipse(-20, -36, 11, 8, 0.3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, -56, 9, 6, -0.2, 0, TAU); ctx.fill();
  if (side === 1) { ctx.beginPath(); ctx.ellipse(20, -34, 6, 4, 0, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  // carved wood grain along the body
  const r = lcg(side * 91); ctx.strokeStyle = P.grain; ctx.lineWidth = 1.1;
  for (let i = 0; i < 14; i++) { const y = -62 + r() * 34; ctx.beginPath(); ctx.moveTo(-40, y); ctx.bezierCurveTo(-20, y - 3 + r() * 6, 8, y - 3 + r() * 6, 36, y + (r() - 0.5) * 4); ctx.stroke(); }
  // belly shade + lit back
  g = ctx.createLinearGradient(0, -64, 0, -26); g.addColorStop(0, 'rgba(255,240,220,0.28)'); g.addColorStop(0.35, 'rgba(255,240,220,0)'); g.addColorStop(0.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g; ctx.fillRect(-46, -70, 90, 50);
  ctx.restore();
  // near legs
  leg(-31, -38, 10, P.mid); leg(17, -38, 10, P.mid);
  ctx.fillStyle = P.hi; ctx.globalAlpha = 0.5; ctx.fillRect(-30.5, -36, 2, 22); ctx.fillRect(17.5, -36, 2, 22); ctx.globalAlpha = 1;
  ctx.fillStyle = P.lo; for (const x of [-31, 17]) { ctx.beginPath(); ctx.moveTo(x + 0.4, -12); ctx.lineTo(x + 9, -12); ctx.lineTo(x + 9.6, -8); ctx.lineTo(x - 0.4, -8); ctx.closePath(); ctx.fill(); }
  // neck and head
  g = ctx.createLinearGradient(24, -70, 60, -30); g.addColorStop(0, P.hi); g.addColorStop(0.5, P.mid); g.addColorStop(1, P.lo);
  ctx.fillStyle = g; ctx.strokeStyle = P.edge; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(20, -64); ctx.bezierCurveTo(30, -68, 38, -66, 44, -60); ctx.bezierCurveTo(52, -56, 60, -46, 60, -38); ctx.bezierCurveTo(60, -31, 55, -29, 50, -30); ctx.bezierCurveTo(44, -30, 40, -33, 36, -36); ctx.bezierCurveTo(32, -30, 28, -28, 22, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
  // muzzle, nostril, eye, ear
  ctx.fillStyle = P.nose; ctx.beginPath(); ctx.ellipse(56, -35, 5.4, 5, -0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = P.edge; ctx.beginPath(); ctx.ellipse(58, -37, 1.4, 1.1, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.ellipse(47, -52, 3.4, 2.6, 0.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#100604'; ctx.beginPath(); ctx.arc(47.6, -52, 1.7, 0, TAU); ctx.fill();
  ctx.fillStyle = P.mid; ctx.strokeStyle = P.edge; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(38, -62); ctx.quadraticCurveTo(28, -62, 25, -55); ctx.quadraticCurveTo(33, -54, 39, -57); ctx.closePath(); ctx.fill(); ctx.stroke();
  // long lyre horns: a pale (or dark) crescent, two of them, one behind the other
  const horn = (dx, dy, k) => {
    g = ctx.createLinearGradient(dx + 34, dy - 82, dx + 50, dy - 60); g.addColorStop(0, P.horn[0]); g.addColorStop(1, P.horn[1]);
    ctx.fillStyle = g; ctx.strokeStyle = P.edge; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(dx + 40, dy - 63); ctx.bezierCurveTo(dx + 32, dy - 74, dx + 34, dy - 84, dx + 44 + k, dy - 92); ctx.bezierCurveTo(dx + 38, dy - 82, dx + 42, dy - 72, dx + 47, dy - 64); ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  horn(-3, 0, -2); horn(4, 1, 6);
  // a bright rim light on the upper left edges (sun)
  ctx.strokeStyle = 'rgba(255,235,200,0.35)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-38, -44); ctx.bezierCurveTo(-41, -57, -32, -63, -18, -61); ctx.stroke();
  void body;
}
class Path2DLike { constructor() {} }

const sprites = {};
function sprite(side) {
  if (!(side in sprites)) {
    sprites[side] = null;
    try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(BOX.w * SCALE, BOX.h * SCALE), l = c.getContext('2d'); l.scale(SCALE, SCALE); l.translate(-BOX.x, -BOX.y); paintCow(l, side); sprites[side] = c; } } catch { sprites[side] = null; }
  }
  return sprites[side];
}
// Draws a cow whose base centre is at (x, y). r = half the cow's width in pixels. face = 1 looks right, -1 looks left.
export function drawCow(ctx, x, y, r, side, o = {}) {
  const k = r / 55, face = o.face ?? (side === 1 ? 1 : -1);
  ctx.save(); ctx.translate(x, y - (o.lift ?? 0) * r); ctx.scale(k * face, k);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  const c = sprite(side);
  if (c) ctx.drawImage(c, BOX.x, BOX.y, BOX.w, BOX.h); else { ctx.save(); paintCow(ctx, side); ctx.restore(); }
  ctx.restore();
}
export const SIDE_NAME = { 1: 'Dark', 2: 'Light' };
