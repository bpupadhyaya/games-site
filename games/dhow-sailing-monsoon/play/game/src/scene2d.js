// The 2D sea: used behind the menus when the 3D layer is not available (no WebGL2, 3D still loading) and as a safety net. Pure drawing.
import { clamp, lerp, smooth, DEG } from './core.js';

const KEYS = [[0, '#050a1c', '#0c1a3a'], [0.19, '#07102a', '#1b2a58'], [0.25, '#4f78c0', '#f6b987'], [0.34, '#3f86d6', '#a8cfee'], [0.5, '#2c78d8', '#9fd0f0'], [0.66, '#3a82d4', '#b2d4ee'], [0.74, '#4a6fb8', '#f4b07a'], [0.8, '#0b1230', '#2b2a5c'], [1, '#050a1c', '#0c1a3a']];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; };
export function skyColors(tod) {
  tod = ((tod % 1) + 1) % 1; let i = 1; while (i < KEYS.length - 1 && tod > KEYS[i][0]) i++;
  const a = KEYS[i - 1], b = KEYS[i], t = clamp((tod - a[0]) / (b[0] - a[0]), 0, 1);
  return [mixc(a[1], b[1], t), mixc(a[2], b[2], t)];
}

export function drawSea2d(ctx, W, H, o) {
  const { t = 0, tod = 0.4, ship = null, wind = 8, storm = 0 } = o ?? {};
  const [zen, hor] = skyColors(tod), hy = H * 0.46;
  let g = ctx.createLinearGradient(0, 0, 0, hy); g.addColorStop(0, zen); g.addColorStop(1, hor); ctx.fillStyle = g; ctx.fillRect(0, 0, W, hy + 2);
  const night = tod < 0.2 || tod > 0.8;
  if (night) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 70; i++) { const x = (i * 197) % W, y = ((i * 89) % 100) / 100 * hy * 0.9; ctx.fillRect(x, y, 1.6, 1.6); } }
  else { const sx = W * (0.15 + 0.7 * smooth((tod - 0.25) / 0.5)), sy = hy * (0.85 - 0.7 * Math.sin(clamp((tod - 0.25) / 0.5, 0, 1) * Math.PI)); const gg = ctx.createRadialGradient(sx, sy, 2, sx, sy, 90); gg.addColorStop(0, 'rgba(255,245,210,0.95)'); gg.addColorStop(1, 'rgba(255,220,150,0)'); ctx.fillStyle = gg; ctx.fillRect(sx - 90, sy - 90, 180, 180); }
  g = ctx.createLinearGradient(0, hy, 0, H); g.addColorStop(0, hor); g.addColorStop(0.12, '#2a8fa6'); g.addColorStop(1, '#06304a'); ctx.fillStyle = g; ctx.fillRect(0, hy, W, H - hy);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) { const k = (i + 1) / 26, y = hy + (H - hy) * k * k, amp = 3 + 14 * k, ph = t * (0.6 + wind * 0.05) + i * 1.7; ctx.beginPath(); for (let x = -10; x <= W + 10; x += 20) { const yy = y + Math.sin(x * 0.02 / (0.4 + k) + ph) * amp * 0.5; if (x < 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke(); }
  if (storm > 0.02) { ctx.fillStyle = `rgba(20,30,44,${0.5 * storm})`; ctx.fillRect(0, 0, W, H); }
  if (ship) drawDhow2d(ctx, W * 0.5, H * 0.58, Math.min(W, H) * 0.0016 * 330, ship, t);
}
export function drawDhow2d(ctx, x, y, s, ship, t) {
  const bob = Math.sin(t * 1.7) * 4 * s, roll = (ship.heel ?? 0) * 0.5 * DEG;
  ctx.save(); ctx.translate(x, y + bob); ctx.rotate(roll); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,10,20,0.3)'; ctx.beginPath(); ctx.ellipse(0, 18, 150, 12, 0, 0, 7); ctx.fill();
  const hg = ctx.createLinearGradient(0, -10, 0, 30); hg.addColorStop(0, '#b27a43'); hg.addColorStop(1, '#5a3418');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(-150, -6); ctx.quadraticCurveTo(-120, 30, -20, 30); ctx.lineTo(90, 30); ctx.quadraticCurveTo(140, 24, 165, -34); ctx.lineTo(150, -18); ctx.lineTo(-135, -14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e9d8b0'; ctx.fillRect(-135, -18, 285, 6);
  ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(10, -14); ctx.lineTo(0, -190); ctx.stroke();
  const fl = ship.flap ?? 0, belly = 26 * (ship.eff ?? 0.8) + Math.sin(t * 12) * 8 * fl;
  const sg = ctx.createLinearGradient(-120, -180, 80, -20); sg.addColorStop(0, '#fff4dc'); sg.addColorStop(1, '#e2d0a8');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(-132, -34); ctx.quadraticCurveTo(-40, -90 - belly, 110, -178); ctx.quadraticCurveTo(90 + belly * 0.2, -96, 118, -30); ctx.quadraticCurveTo(0, -20 + belly * 0.3, -132, -34); ctx.fill();
  ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-138, -30); ctx.lineTo(112, -184); ctx.stroke();
  ctx.restore();
}
