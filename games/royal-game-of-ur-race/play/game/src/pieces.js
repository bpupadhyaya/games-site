// The playing pieces and the pyramid dice. Pieces are round inlaid counters (shell with lapis dots for side 0, jet with
// shell dots for side 1); the dice are tetrahedra seen from above, one corner of each marked with gold.
import { PAL } from './art.js';
const TAU = Math.PI * 2;
const SIDES = [
  { top: ['#ffffff', '#f3e8cf', '#cdb98d'], wall: ['#b8a274', '#8a7548'], dots: '#2a55b8', dotEdge: '#0f2560', rim: '#e2b24a' },
  { top: ['#5a5148', '#2a231d', '#0c0806'], wall: ['#1a1410', '#050302'], dots: '#f3e8cf', dotEdge: '#8a7548', rim: '#e2b24a' },
];
export const SIDE_NAMES = ['Shell', 'Jet'];

// A counter centred at (x, y) on the board, radius r. lift raises it (with a growing shadow); glow rings it in gold.
export function drawPiece(ctx, x, y, r, side, o = {}) {
  const S = SIDES[side], lift = (o.lift ?? 0) * r * 0.5, th = r * 0.22;
  ctx.save();
  if (o.dim) ctx.globalAlpha = 0.45;
  // soft shadow on the board
  ctx.fillStyle = `rgba(0,0,0,${0.42 - Math.min(0.18, lift / r * 0.3)})`; ctx.beginPath(); ctx.ellipse(x + 3 + lift * 0.3, y + th + 5 + lift * 0.5, r * (1.02 + lift / r * 0.15), r * 0.9, 0, 0, TAU); ctx.fill();
  const cy = y - lift;
  if (o.glow) {
    const pulse = 0.5 + 0.5 * Math.sin(o.glow * 5);
    ctx.strokeStyle = `rgba(255,222,120,${0.55 + pulse * 0.4})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, cy, r + 6 + pulse * 3, 0, TAU); ctx.stroke();
  }
  // the side wall of the counter
  const w = ctx.createLinearGradient(0, cy, 0, cy + th + r); w.addColorStop(0, S.wall[0]); w.addColorStop(1, S.wall[1]);
  ctx.fillStyle = w; ctx.beginPath(); ctx.arc(x, cy + th, r, 0, TAU); ctx.fill(); ctx.fillRect(x - r, cy, r * 2, th); 
  ctx.fillStyle = w; ctx.beginPath(); ctx.arc(x, cy, r, 0, TAU); ctx.fill();
  // the gold rim, then the top face
  const rim = ctx.createLinearGradient(x - r, cy - r, x + r, cy + r); rim.addColorStop(0, '#fff0b8'); rim.addColorStop(0.5, S.rim); rim.addColorStop(1, '#7a5010');
  ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(x, cy, r, 0, TAU); ctx.fill();
  const t = ctx.createRadialGradient(x - r * 0.35, cy - r * 0.4, r * 0.05, x, cy, r * 0.9);
  t.addColorStop(0, S.top[0]); t.addColorStop(0.55, S.top[1]); t.addColorStop(1, S.top[2]);
  ctx.fillStyle = t; ctx.beginPath(); ctx.arc(x, cy, r * 0.86, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; ctx.stroke();
  // five inlaid dots
  for (const [dx, dy] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = x + dx * r * 0.36, py = cy + dy * r * 0.36, pr = r * (dx || dy ? 0.14 : 0.18);
    ctx.fillStyle = S.dotEdge; ctx.beginPath(); ctx.arc(px, py + 1, pr + 1.2, 0, TAU); ctx.fill();
    ctx.fillStyle = S.dots; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
  }
  // a lamp highlight across the upper-left
  const h = ctx.createRadialGradient(x - r * 0.4, cy - r * 0.5, 1, x - r * 0.4, cy - r * 0.5, r * 0.6);
  h.addColorStop(0, 'rgba(255,255,255,0.45)'); h.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = h; ctx.beginPath(); ctx.arc(x, cy, r * 0.86, 0, TAU); ctx.fill();
  ctx.restore();
}

// A pyramid die seen from above: three faces meeting at the tip. `up` = the tip is marked (counts 1). `spin` in radians.
// While tumbling, squash < 1 flattens it as if it were turning over.
export function drawDie(ctx, x, y, size, up, spin = 0, squash = 1, lift = 0) {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.4 - lift * 0.15})`; ctx.beginPath(); ctx.ellipse(x + 4 + lift * 10, y + size * 0.5 + 6 + lift * 8, size * 0.62, size * 0.28, 0, 0, TAU); ctx.fill();
  ctx.translate(x, y - lift * 26); ctx.rotate(spin); ctx.scale(1, squash);
  const R = size * 0.62, pts = [0, 1, 2].map((k) => [Math.sin((k / 3) * TAU) * R, -Math.cos((k / 3) * TAU) * R]);
  const faces = [[pts[0], pts[1], '#fbf3df', '#d8c9a4'], [pts[1], pts[2], '#cdb98d', '#a08a5a'], [pts[2], pts[0], '#e9dab8', '#bba57a']];
  for (const [a, b, c0, c1] of faces) {
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(70,45,15,0.75)'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[2][0], pts[2][1]); ctx.closePath(); ctx.stroke();
  for (const p of pts) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
  // lapis inlay on each of the three base corners, and the marked tip in gold when it counts
  ctx.fillStyle = PAL.lapis[1]; for (const p of pts) { ctx.beginPath(); ctx.arc(p[0] * 0.8, p[1] * 0.8, size * 0.07, 0, TAU); ctx.fill(); }
  if (up) {
    const g = ctx.createRadialGradient(-size * 0.05, -size * 0.06, 1, 0, 0, size * 0.22); g.addColorStop(0, '#fff6c8'); g.addColorStop(0.5, '#e2b24a'); g.addColorStop(1, '#8a5e16');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, size * 0.2, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(70,40,5,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
  } else { ctx.fillStyle = 'rgba(60,40,15,0.55)'; ctx.beginPath(); ctx.arc(0, 0, size * 0.05, 0, TAU); ctx.fill(); }
  ctx.restore();
}
