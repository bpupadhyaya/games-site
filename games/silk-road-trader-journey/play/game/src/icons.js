// Lit icons for the six trade goods and small cached thumbnails. Pure canvas.
import { shade } from './paint.js';
const TAU = Math.PI * 2;

// Draws good `id` centred on (cx, cy) inside a box of about s x s.
export function drawGood(ctx, id, cx, cy, s) {
  ctx.save(); ctx.translate(cx, cy); const u = s / 100; ctx.scale(u, u);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 40, 40, 7, 0, 0, TAU); ctx.fill();
  if (id === 'silk') {
    // a bolt of cloth: a cylinder lying on its side with a coloured wrap and a loose end
    const g = ctx.createLinearGradient(0, -34, 0, 38); g.addColorStop(0, '#f27a9c'); g.addColorStop(0.45, '#c8365e'); g.addColorStop(1, '#6e1a34');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-46, -30, 80, 66, 10); ctx.fill();
    ctx.fillStyle = '#e8cf8a'; ctx.beginPath(); ctx.ellipse(34, 3, 12, 33, 0, 0, TAU); ctx.fill();
    const eg = ctx.createRadialGradient(31, -8, 2, 34, 3, 30); eg.addColorStop(0, '#f4e0a8'); eg.addColorStop(1, '#b8994c'); ctx.fillStyle = eg; ctx.beginPath(); ctx.ellipse(34, 3, 12, 33, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(120,70,20,0.55)'; ctx.lineWidth = 2; for (let r = 7; r < 30; r += 7) { ctx.beginPath(); ctx.ellipse(34, 3, 12 * r / 33, r, 0, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; for (let i = 0; i < 4; i++) ctx.fillRect(-46 + i * 20, -30, 5, 66);
    ctx.fillStyle = '#f8e6c0'; ctx.fillRect(-18, -8, 20, 22); ctx.fillStyle = '#b8342c'; ctx.fillRect(-14, -3, 12, 3); ctx.fillRect(-14, 4, 8, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.roundRect(-42, -26, 70, 8, 4); ctx.fill();
  } else if (id === 'paper') {
    for (let i = 0; i < 5; i++) { const y = 18 - i * 6; ctx.fillStyle = i % 2 ? '#e6d9b6' : '#f3e9c9'; ctx.beginPath(); ctx.moveTo(-40 + i, y); ctx.lineTo(34 + i, y - 4); ctx.lineTo(44 + i, y + 6); ctx.lineTo(-30 + i, y + 10); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(120,90,40,0.5)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    const g = ctx.createLinearGradient(-40, -20, 44, 6); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#e4d3a4'); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-36, -10); ctx.lineTo(32, -18); ctx.lineTo(42, -8); ctx.lineTo(-26, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(120,90,40,0.55)'; ctx.stroke();
    ctx.strokeStyle = 'rgba(90,60,30,0.6)'; ctx.lineWidth = 1.6; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-26 + i * 4, -8 + i * 0.5 - 0.2); ctx.lineTo(28 + i * 2, -15 + i * 1.5); ctx.stroke(); }
    ctx.fillStyle = '#b8342c'; ctx.fillRect(14, -40, 7, 26); ctx.fillStyle = '#e0a030'; ctx.fillRect(14, -40, 7, 5);
  } else if (id === 'spice') {
    const g = ctx.createLinearGradient(-30, -30, 34, 40); g.addColorStop(0, '#d8be92'); g.addColorStop(1, '#8a6a3c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-14, -34); ctx.bezierCurveTo(-48, -10, -46, 34, -24, 40); ctx.lineTo(24, 40); ctx.bezierCurveTo(46, 34, 48, -10, 14, -34); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(70,45,20,0.4)'; ctx.lineWidth = 1.5; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 9, -20); ctx.lineTo(i * 12, 38); ctx.stroke(); }
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-16, -38, 32, 9); ctx.fillStyle = '#a07a46'; ctx.fillRect(-16, -38, 32, 3);
    const cols = ['#c8501e', '#e0a030', '#a02a1a'], px = [-28, -10, 14, 30];
    for (let i = 0; i < 4; i++) { ctx.fillStyle = cols[i % 3]; ctx.beginPath(); ctx.ellipse(px[i], 38, 14, 7, 0, Math.PI, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(-12, -4, 7, 18, 0.3, 0, TAU); ctx.fill();
  } else if (id === 'glass') {
    const g = ctx.createLinearGradient(-30, 0, 30, 0); g.addColorStop(0, 'rgba(120,214,226,0.9)'); g.addColorStop(0.5, 'rgba(60,160,184,0.85)'); g.addColorStop(1, 'rgba(24,96,130,0.95)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-9, -42); ctx.lineTo(-9, -18); ctx.bezierCurveTo(-34, -6, -34, 38, -20, 40); ctx.lineTo(20, 40); ctx.bezierCurveTo(34, 38, 34, -6, 9, -18); ctx.lineTo(9, -42); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(210,250,255,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-15, 8, 4, 18, 0.18, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b88a4a'; ctx.beginPath(); ctx.roundRect(-8, -50, 16, 10, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,140,0.55)'; ctx.beginPath(); ctx.moveTo(-18, 30); ctx.quadraticCurveTo(0, 20, 18, 30); ctx.lineTo(18, 38); ctx.lineTo(-18, 38); ctx.fill();
  } else if (id === 'horse') {
    const g = ctx.createLinearGradient(-30, -40, 30, 40); g.addColorStop(0, '#b98050'); g.addColorStop(1, '#5a3418');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-26, 40); ctx.bezierCurveTo(-32, 10, -28, -20, -12, -34); ctx.lineTo(-6, -46); ctx.lineTo(2, -34);
    ctx.bezierCurveTo(14, -32, 30, -18, 40, 6); ctx.bezierCurveTo(44, 14, 36, 20, 28, 16); ctx.bezierCurveTo(22, 14, 16, 8, 8, 8); ctx.bezierCurveTo(10, 22, 12, 32, 20, 40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a1608'; ctx.beginPath(); ctx.moveTo(-12, -34); ctx.bezierCurveTo(-30, -22, -34, 6, -28, 30); ctx.lineTo(-20, 28); ctx.bezierCurveTo(-24, 6, -20, -18, -6, -30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#120a04'; ctx.beginPath(); ctx.arc(14, -14, 3, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(13, -16, 1.6, 1.6);
    ctx.fillStyle = 'rgba(255,225,170,0.25)'; ctx.beginPath(); ctx.ellipse(10, -4, 6, 16, -0.5, 0, TAU); ctx.fill();
  } else if (id === 'jade') {
    const g = ctx.createRadialGradient(-12, -14, 4, 0, 0, 48); g.addColorStop(0, '#bfe8c6'); g.addColorStop(0.45, '#4fa070'); g.addColorStop(1, '#1c5a40');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.fill();
    ctx.fillStyle = '#17110d'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(210,255,225,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 33, Math.PI * 0.9, Math.PI * 1.7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-18, -20, 9, 5, -0.7, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Cache a drawing into an offscreen canvas where the platform has one; otherwise call fn directly. Returns true when drawn.
const store = new Map();
export function cached(ctx, key, x, y, w, h, fn) {
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
  if (typeof globalThis.OffscreenCanvas === 'function') {
    const k = `${key}|${W}x${H}`; let c = store.get(k);
    if (!c) { c = new globalThis.OffscreenCanvas(W, H); fn(c.getContext('2d'), { x: 0, y: 0, w: W, h: H }); if (store.size > 60) store.clear(); store.set(k, c); }
    ctx.drawImage(c, x, y, w, h); return true;
  }
  ctx.save(); ctx.translate(x, y); fn(ctx, { x: 0, y: 0, w: W, h: H }); ctx.restore(); return false;
}
