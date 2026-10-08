// Drawing that is not UI: the 2D stand-in for the 3D scene (used only when WebGL is not available), shared scrims, spin gauge.
import { FONT, roundPath } from './ui.js';
import { YO, DB } from './phys.js';
export const gfx = { has3d: false };
const TAU = Math.PI * 2;

// Studio backdrop for the 2D fallback: dark teal wall, warm pool of light, wood floor band
export function drawBackdrop(ctx, L, cam) {
  const W = L.W, H = L.H;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04141a'); g.addColorStop(0.55, '#0c3640'); g.addColorStop(1, '#165560');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const fy = cam ? cam.project(0, -1.3, 0).y : H * 0.7;
  const r = ctx.createRadialGradient(W / 2, fy - 200, 20, W / 2, fy - 200, Math.max(W, H) * 0.6);
  r.addColorStop(0, 'rgba(255,214,150,0.4)'); r.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  const f = ctx.createLinearGradient(0, fy, 0, H); f.addColorStop(0, '#6a4a38'); f.addColorStop(1, '#3a281e');
  ctx.fillStyle = f; ctx.fillRect(0, fy, W, H - fy);
  ctx.strokeStyle = 'rgba(20,10,4,0.5)'; ctx.lineWidth = 2;
  for (let i = 1; i < 7; i++) { const y = fy + (i * i) * (H - fy) / 49; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}
export function scrim(ctx, L, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, L.H);
  g.addColorStop(0, `rgba(4,16,22,${a * 0.75})`); g.addColorStop(0.5, `rgba(4,16,22,${a})`); g.addColorStop(1, `rgba(4,16,22,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.W, L.H);
}

// 2D toy: yo-yo disc or diabolo cups with the string, hands as soft circles
export function drawToy2D(ctx, cam, w, alpha = 1) {
  const H = w.hand, P = (x, y) => cam.project(x, y, 0);
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round';
  const hand = (x, y) => { const p = P(x, y), r = 0.08 * p.s; const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 2, p.x, p.y, r); g.addColorStop(0, '#f0c8a2'); g.addColorStop(1, '#b57e55'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); };
  if (w.toy === 'yoyo') {
    const y = w.yy, a = P(H.x, H.y), b = P(y.x, y.y);
    ctx.strokeStyle = '#f4ead2'; ctx.lineWidth = Math.max(2, 0.006 * a.s); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    const r = YO.R * 2.9 * b.s, rr = r * 1.0;
    const g = ctx.createRadialGradient(b.x - rr * 0.3, b.y - rr * 0.3, rr * 0.1, b.x, b.y, rr); g.addColorStop(0, '#ff8a6a'); g.addColorStop(0.55, '#d23a2a'); g.addColorStop(1, '#6e130c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(b.x, b.y, rr, rr, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#f0bd4a'; ctx.lineWidth = Math.max(2, rr * 0.12); ctx.beginPath(); ctx.arc(b.x, b.y, rr * 0.9, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#f0bd4a'; ctx.beginPath(); ctx.arc(b.x, b.y, rr * 0.22, 0, TAU); ctx.fill();
    hand(H.x, H.y);
  } else {
    const d = w.db, c = H.sp, f1 = P(H.x - c, H.y), f2 = P(H.x + c, H.y), b = P(d.x, d.y);
    ctx.strokeStyle = '#8a4a24'; ctx.lineWidth = Math.max(4, 0.03 * f1.s);
    for (const [f, sg] of [[f1, -1], [f2, 1]]) { ctx.beginPath(); ctx.moveTo(f.x - sg * 0.1 * f.s, f.y + 0.3 * f.s); ctx.lineTo(f.x, f.y - 0.02 * f.s); ctx.stroke(); }
    ctx.strokeStyle = '#f4ead2'; ctx.lineWidth = Math.max(2, 0.006 * f1.s); ctx.beginPath(); ctx.moveTo(f1.x, f1.y);
    if (d.air) ctx.quadraticCurveTo((f1.x + f2.x) / 2, f1.y + 0.5 * f1.s, f2.x, f2.y); else { ctx.lineTo(b.x, b.y + 0.03 * b.s); ctx.lineTo(f2.x, f2.y); }
    ctx.stroke();
    const rr = 0.075 * 2.2 * b.s;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(d.tilt * 0.6);
    const g = ctx.createRadialGradient(-rr * 0.3, -rr * 0.3, rr * 0.1, 0, 0, rr * 1.3); g.addColorStop(0, '#ff8a6a'); g.addColorStop(0.6, '#d23a2a'); g.addColorStop(1, '#6e130c');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-rr * 1.0, -rr); ctx.lineTo(-rr * 0.12, 0); ctx.lineTo(-rr * 1.0, rr); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(rr * 1.0, -rr); ctx.lineTo(rr * 0.12, 0); ctx.lineTo(rr * 1.0, rr); ctx.closePath(); ctx.fill();
    ctx.restore();
    hand(H.x - c - 0.1, H.y - 0.3); hand(H.x + c + 0.1, H.y - 0.3);
  }
  ctx.restore();
}

// "Spin" gauge: a rounded bar with a tick at the level that matters (the yo-yo needs spin to climb back, the diabolo to stay steady)
export function drawSpinGauge(ctx, r, w, label = 'Spin') {
  const isY = w.toy === 'yoyo', t = isY ? w.yy : w.db, max = isY ? YO.wmax : DB.wmax, tick = (isY ? YO.wBind : DB.wRef) / max;
  const f = Math.max(0, Math.min(1, t.w / max));
  ctx.save();
  roundPath(ctx, r.x, r.y, r.w, r.h, r.h / 2); ctx.fillStyle = 'rgba(4,16,22,0.62)'; ctx.fill();
  const lab = 66;
  roundPath(ctx, r.x + lab, r.y + 4, Math.max(0, (r.w - lab - 6) * f), r.h - 8, (r.h - 8) / 2);
  const g = ctx.createLinearGradient(r.x + lab, 0, r.x + r.w, 0); g.addColorStop(0, '#f0bd4a'); g.addColorStop(1, '#6fe8ee'); ctx.fillStyle = g; ctx.fill();
  const tx = r.x + lab + (r.w - lab - 6) * tick;
  ctx.fillStyle = '#fff'; ctx.fillRect(tx - 1.5, r.y + 2, 3, r.h - 4);
  ctx.font = `700 ${Math.round(r.h * 0.78)}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#e6f6f6'; ctx.fillText(label, r.x + 12, r.y + r.h / 2 + 1);
  ctx.restore();
}
