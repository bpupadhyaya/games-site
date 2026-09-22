// The turned pawns (four head shapes, so colour is never the only cue), the cowry shells and the die.
// Each is painted ONCE into a small cached sprite (OffscreenCanvas); per frame they are only blitted.
import { ARM_COLOURS, ARM_LIGHT, ARM_DARK, lcg } from './art.js';

const TAU = Math.PI * 2;
export const SHAPES = ['sphere', 'cone', 'crown', 'cube'];
export const PAWN_BOX = { w: 44, h: 70, ax: 22, ay: 58 };
const SS = 3;
const cache = {};

function sprite(key, w, h, paint) {
  if (cache[key] !== undefined) return cache[key];
  let c = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined') { const oc = new OffscreenCanvas(w * SS, h * SS), x = oc.getContext('2d'); x.scale(SS, SS); paint(x); c = oc; }
  } catch { c = null; }
  return (cache[key] = c);
}

function metal(ctx, x0, x1) { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#7a5314'); g.addColorStop(0.3, '#f7dc8c'); g.addColorStop(0.55, '#c99a2e'); g.addColorStop(1, '#5d3c0b'); return g; }

function paintPawn(ctx, arm) {
  const col = ARM_COLOURS[arm], lt = ARM_LIGHT[arm], dk = ARM_DARK[arm], bx = PAWN_BOX.ax, by = PAWN_BOX.ay;
  const body = (x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, dk); g.addColorStop(0.28, lt); g.addColorStop(0.5, col); g.addColorStop(1, dk); return g; };
  // base disc
  ctx.beginPath(); ctx.ellipse(bx, by, 15.5, 6, 0, 0, TAU); ctx.fillStyle = dk; ctx.fill();
  ctx.beginPath(); ctx.ellipse(bx, by - 2.4, 15.5, 6, 0, 0, TAU); ctx.fillStyle = body(bx - 15, bx + 15); ctx.fill();
  ctx.strokeStyle = 'rgba(255,235,190,0.5)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(bx, by - 2.4, 15, 5.6, 0, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
  // turned stem
  ctx.beginPath(); ctx.moveTo(bx - 11, by - 3.5); ctx.bezierCurveTo(bx - 10, by - 12, bx - 4.4, by - 14, bx - 4.6, by - 22); ctx.lineTo(bx - 4.6, by - 27);
  ctx.lineTo(bx + 4.6, by - 27); ctx.lineTo(bx + 4.6, by - 22); ctx.bezierCurveTo(bx + 4.4, by - 14, bx + 10, by - 12, bx + 11, by - 3.5); ctx.closePath();
  ctx.fillStyle = body(bx - 11, bx + 11); ctx.fill();
  // brass collar
  ctx.beginPath(); ctx.ellipse(bx, by - 27, 9.4, 3.1, 0, 0, TAU); ctx.fillStyle = '#5d3c0b'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(bx, by - 28.2, 9.4, 3.1, 0, 0, TAU); ctx.fillStyle = metal(ctx, bx - 9, bx + 9); ctx.fill();
  const hy = by - 30, shape = SHAPES[arm];
  if (shape === 'sphere') {
    const g = ctx.createRadialGradient(bx - 4, hy - 13, 1.5, bx, hy - 9, 13); g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, lt); g.addColorStop(0.6, col); g.addColorStop(1, dk);
    ctx.beginPath(); ctx.arc(bx, hy - 10, 11.5, 0, TAU); ctx.fillStyle = g; ctx.fill();
  } else if (shape === 'cone') {
    ctx.beginPath(); ctx.moveTo(bx - 10.5, hy); ctx.bezierCurveTo(bx - 9, hy - 10, bx - 3, hy - 20, bx, hy - 27); ctx.bezierCurveTo(bx + 3, hy - 20, bx + 9, hy - 10, bx + 10.5, hy); ctx.closePath();
    ctx.fillStyle = body(bx - 10.5, bx + 10.5); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx, hy, 10.5, 3, 0, 0, Math.PI); ctx.fillStyle = dk; ctx.fill();
    ctx.beginPath(); ctx.arc(bx, hy - 27, 2.6, 0, TAU); ctx.fillStyle = metal(ctx, bx - 3, bx + 3); ctx.fill();
  } else if (shape === 'crown') {
    [[hy - 1, 11.5, 3.6], [hy - 6.5, 9.5, 3.1], [hy - 11.5, 7.5, 2.7]].forEach(([y, rx, ry], k) => {
      ctx.beginPath(); ctx.ellipse(bx, y + 2.5, rx, ry, 0, 0, TAU); ctx.fillStyle = dk; ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx, y, rx, ry, 0, 0, TAU); ctx.fillStyle = body(bx - rx, bx + rx); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,200,0.45)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(bx, y, rx - 0.5, ry - 0.3, 0, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(bx, hy - 17.5, 4.2, 0, TAU); ctx.fillStyle = metal(ctx, bx - 4, bx + 4); ctx.fill();
  } else {
    // cube (seen corner-on)
    const s = 10.5, cy = hy - 12;
    ctx.beginPath(); ctx.moveTo(bx, cy - s * 1.15); ctx.lineTo(bx + s, cy - s * 0.55); ctx.lineTo(bx, cy + 0.05 * s); ctx.lineTo(bx - s, cy - s * 0.55); ctx.closePath(); ctx.fillStyle = lt; ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - s, cy - s * 0.55); ctx.lineTo(bx, cy + 0.05 * s); ctx.lineTo(bx, cy + s * 1.05); ctx.lineTo(bx - s, cy + s * 0.45); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx + s, cy - s * 0.55); ctx.lineTo(bx, cy + 0.05 * s); ctx.lineTo(bx, cy + s * 1.05); ctx.lineTo(bx + s, cy + s * 0.45); ctx.closePath(); ctx.fillStyle = dk; ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(bx - s, cy - s * 0.55); ctx.lineTo(bx, cy - s * 1.15); ctx.lineTo(bx + s, cy - s * 0.55); ctx.stroke();
  }
  // specular gleam on the stem
  ctx.beginPath(); ctx.ellipse(bx - 3, by - 16, 1.2, 5, 0.1, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.fill();
}

// draw a pawn standing at (x, y) (its foot), scale k, with an optional lift (pixels) and a soft shadow on the cloth
export function drawPawn(ctx, arm, x, y, k = 1, lift = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = 0.34 * alpha; ctx.fillStyle = '#1a0806';
  ctx.beginPath(); ctx.ellipse(x + 2, y + 3, 14 * k * (1 - lift * 0.004), 5 * k, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = alpha;
  const sp = sprite('pawn' + arm, PAWN_BOX.w, PAWN_BOX.h, (c) => paintPawn(c, arm));
  const dx = x - PAWN_BOX.ax * k, dy = y - lift - PAWN_BOX.ay * k;
  if (sp) ctx.drawImage(sp, dx, dy, PAWN_BOX.w * k, PAWN_BOX.h * k);
  else { ctx.translate(dx, dy); ctx.scale(k, k); paintPawn(ctx, arm); }
  ctx.restore();
}

// ---- cowries -------------------------------------------------------------------------------------
export const COWRY = { w: 44, h: 64 };
function paintCowry(ctx, mouth) {
  const cx = COWRY.w / 2, cy = COWRY.h / 2, r = lcg(mouth ? 3 : 9);
  const body = () => { ctx.beginPath(); ctx.ellipse(cx, cy, 17.5, 26, 0, 0, TAU); };
  if (!mouth) {
    let g = ctx.createRadialGradient(cx - 6, cy - 11, 2, cx, cy, 28); g.addColorStop(0, '#fff8e2'); g.addColorStop(0.35, '#f1d9a4'); g.addColorStop(0.75, '#d3a466'); g.addColorStop(1, '#8b5a2a');
    body(); ctx.fillStyle = g; ctx.fill();
    ctx.save(); body(); ctx.clip();
    for (let n = 0; n < 14; n++) { ctx.beginPath(); ctx.ellipse(cx + (r() - 0.5) * 30, cy + (r() - 0.5) * 46, 1.5 + r() * 3, 1 + r() * 2.2, r() * 3, 0, TAU); ctx.fillStyle = `rgba(120,70,30,${0.12 + r() * 0.22})`; ctx.fill(); }
    ctx.strokeStyle = 'rgba(130,80,40,0.45)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx, cy - 22); ctx.bezierCurveTo(cx - 3, cy - 8, cx + 3, cy + 8, cx, cy + 22); ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(cx - 6, cy - 10, 4, 10, 0.35, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
    body(); ctx.strokeStyle = 'rgba(80,40,10,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
  } else {
    let g = ctx.createRadialGradient(cx - 4, cy - 8, 2, cx, cy, 28); g.addColorStop(0, '#fdf3d6'); g.addColorStop(0.6, '#ecd3a0'); g.addColorStop(1, '#b9874a');
    body(); ctx.fillStyle = g; ctx.fill();
    // rolled lips and the toothed slit
    ctx.beginPath(); ctx.ellipse(cx, cy, 6.5, 22.5, 0, 0, TAU); ctx.fillStyle = 'rgba(150,100,55,0.55)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy, 3.2, 20.5, 0, 0, TAU); ctx.fillStyle = '#2f170b'; ctx.fill();
    ctx.strokeStyle = '#fbf0d0'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (let y = cy - 18; y <= cy + 18; y += 3.2) { ctx.beginPath(); ctx.moveTo(cx - 6.4, y); ctx.lineTo(cx - 2.6, y + 0.4); ctx.moveTo(cx + 6.4, y); ctx.lineTo(cx + 2.6, y + 0.4); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(cx - 9, cy - 8, 3, 9, 0.25, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
    body(); ctx.strokeStyle = 'rgba(80,40,10,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
}
// x,y = centre; rot = spin on the mat; phi = flip angle (cos > 0: back showing; cos < 0: mouth showing); z = height
export function drawCowry(ctx, x, y, rot, phi, z = 0, k = 1) {
  const cph = Math.cos(phi), mouth = cph < 0, sq = Math.max(0.16, Math.abs(cph));
  ctx.save();
  ctx.globalAlpha = 0.35 / (1 + z * 0.02); ctx.fillStyle = '#1a0806';
  ctx.beginPath(); ctx.ellipse(x + 5 + z * 0.15, y + 6 + z * 0.35, 17 * k * (1 - z * 0.003), 24 * k * (0.5 + 0.5 * sq) * (1 - z * 0.003), rot, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1; ctx.translate(x, y - z); ctx.rotate(rot); ctx.scale(k, k * sq);
  if (sq < 0.4) { ctx.beginPath(); ctx.ellipse(0, 0, 18.5, 27, 0, 0, TAU); ctx.fillStyle = '#b47c40'; ctx.fill(); }
  const sp = sprite(mouth ? 'cmouth' : 'cback', COWRY.w, COWRY.h, (c) => paintCowry(c, mouth));
  if (sp) ctx.drawImage(sp, -COWRY.w / 2, -COWRY.h / 2, COWRY.w, COWRY.h);
  else { ctx.translate(-COWRY.w / 2, -COWRY.h / 2); paintCowry(ctx, mouth); }
  ctx.restore();
}

// ---- the die (Ludo mode) --------------------------------------------------------------------------
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
export function drawDie(ctx, x, y, rot, face, z = 0, k = 1) {
  const s = 62 * k;
  ctx.save();
  ctx.globalAlpha = 0.35 / (1 + z * 0.02); ctx.fillStyle = '#1a0806'; ctx.beginPath(); ctx.roundRect(x - s / 2 + 6 + z * 0.2, y - s / 2 + 8 + z * 0.4, s, s, 12); ctx.fill();
  ctx.globalAlpha = 1; ctx.translate(x, y - z); ctx.rotate(rot);
  const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#dcc59a');
  ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, 12); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(90,55,20,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  for (const [px, py] of PIPS[face] || []) { ctx.beginPath(); ctx.arc(px * s * 0.26, py * s * 0.26, s * 0.075, 0, TAU); ctx.fillStyle = face === 1 ? '#a3282d' : '#3a1a0c'; ctx.fill(); }
  ctx.restore();
}
