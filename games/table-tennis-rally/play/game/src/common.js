// Shared drawing helpers for the screens: backdrop, header, avatars, flags, level pips.
import { COL, FONT_D, FONT_B, R, icon, textZoomBar } from './ui.js';
import { brandGradient } from './brand.js';

export function backdrop(ctx, L, t) {
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, '#0b1a38'); g.addColorStop(0.55, '#08122a'); g.addColorStop(1, '#050b18');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
  // soft brand glows
  const r1 = ctx.createRadialGradient(L.w * 0.12, L.h * 0.08, 10, L.w * 0.12, L.h * 0.08, Math.max(L.w, L.h) * 0.6);
  r1.addColorStop(0, 'rgba(110,90,255,0.30)'); r1.addColorStop(1, 'rgba(110,90,255,0)'); ctx.fillStyle = r1; ctx.fillRect(0, 0, L.w, L.h);
  const r2 = ctx.createRadialGradient(L.w * 0.95, L.h * 0.9, 10, L.w * 0.95, L.h * 0.9, Math.max(L.w, L.h) * 0.6);
  r2.addColorStop(0, 'rgba(30,170,210,0.26)'); r2.addColorStop(1, 'rgba(30,170,210,0)'); ctx.fillStyle = r2; ctx.fillRect(0, 0, L.w, L.h);
  // faint table-tennis table lines
  ctx.save(); ctx.strokeStyle = 'rgba(160,200,255,0.05)'; ctx.lineWidth = 3;
  const s = Math.max(L.w, L.h);
  ctx.translate(L.w * 0.5, L.h * 0.55); ctx.rotate(-0.22);
  ctx.strokeRect(-s * 0.55, -s * 0.3, s * 1.1, s * 0.6); ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(0, s * 0.3); ctx.stroke();
  ctx.restore();
}

// a darkening gradient over the 3D picture so panels and text stay readable
export function veil(ctx, L, o = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, `rgba(4,8,18,${o.top ?? 0.65})`); g.addColorStop(0.35, `rgba(4,8,18,${o.mid ?? 0.1})`); g.addColorStop(1, `rgba(4,8,18,${o.bottom ?? 0.7})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
}
export function sideVeil(ctx, L, x0, x1, a) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, `rgba(4,8,18,${a})`); g.addColorStop(0.7, `rgba(4,8,18,${a * 0.5})`); g.addColorStop(1, 'rgba(4,8,18,0)');
  ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), L.h);
}

// Header bar for the text/menu screens. Returns the content rectangle under it.
export function header(ctx, G, title, o = {}) {
  const { L, ui, state } = G;
  const U = L.U, back = L.back.w ? L.back.w + 6 : 0;
  const h = 84, y = U.y + 10, z0 = ui.zoom;
  ui.zoom = 1;
  ui.text(ctx, title, U.x + 16 + back, y + 56, 54, { disp: true, weight: 800, fixed: true, shadow: true });
  let rx = U.x + U.w - 14;
  if (o.close !== false) { const b = R(rx - 64, y + 4, 64, 64); ui.button(ctx, 'back', b, '', { kind: 'chip', icon: 'close', size: 30 }); rx -= 74; }
  if (o.zoom) {
    const zw = Math.min(300, U.w * 0.42), zr = R(rx - zw, y + 8, zw, 56);
    textZoomBar(ctx, ui, zr, state.prefs.zoomIdx, G.TEXT_SCALES.length);
    ui.text(ctx, `${Math.round(G.zoom * 100)}%`, zr.x + zr.w / 2, zr.y + 38, 26, { align: 'center', weight: 700, fixed: true, color: COL.dim });
  }
  ctx.save(); ctx.strokeStyle = brandGradient(ctx, U.x, 0, U.x + U.w, 0, 0.55); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(U.x + 12, y + h); ctx.lineTo(U.x + U.w - 12, y + h); ctx.stroke(); ctx.restore();
  ui.zoom = z0;
  return R(U.x, y + h + 8, U.w, U.y + U.h - (y + h + 8));
}

export function avatar(ctx, cx, cy, r, text, hue, o = {}) {
  ctx.save();
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, `hsl(${hue},70%,52%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360},70%,28%)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.3); ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.08); ctx.strokeStyle = o.ring ?? 'rgba(255,255,255,0.55)'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `800 ${r * 0.95}px ${FONT_D}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + r * 0.06);
  ctx.restore();
}
export const initials = (name) => name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();

export function flagChip(ctx, x, y, w, h, cc, hue) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, `hsl(${hue},62%,46%)`); g.addColorStop(1, `hsl(${(hue + 50) % 360},62%,30%)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, h * 0.28); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `800 ${h * 0.58}px ${FONT_B}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(cc, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

export function levelPips(ctx, x, y, w, level, max = 10, color = COL.orange) {
  const gap = 3, pw = (w - gap * (max - 1)) / max;
  ctx.save();
  for (let i = 0; i < max; i++) { ctx.fillStyle = i < level ? color : 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(x + i * (pw + gap), y, pw, 8, 3); ctx.fill(); }
  ctx.restore();
}

export function pips(ctx, x, y, n, total, r = 6, color = COL.gold, align = 'left') {
  ctx.save();
  const w = total * r * 2.7;
  let sx = align === 'right' ? x - w : x;
  for (let i = 0; i < total; i++) {
    ctx.beginPath(); ctx.arc(sx + r + i * r * 2.7, y, r, 0, 6.3);
    if (i < n) { ctx.fillStyle = color; ctx.fill(); } else { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  ctx.restore();
  return w;
}

export function toast(ctx, G, text) {
  const { L, ui } = G;
  const w = Math.min(L.U.w - 40, 640), h = Math.max(58, ui.fs(24) * 2.1), x = L.U.x + (L.U.w - w) / 2, y = L.U.y + L.U.h - h - 24 - L.ins.b;
  ui.panel(ctx, R(x, y, w, h), { fill: 'rgba(14,26,50,0.95)', radius: 18 });
  ui.text(ctx, text, x + w / 2, y + h / 2 + ui.fs(24) * 0.32, 24, { align: 'center' });
}

export function ballIcon(ctx, cx, cy, r) {
  ctx.save(); ctx.fillStyle = '#fff6e6'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.3); ctx.fill();
  ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = r * 0.22; ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0.3, 2.3); ctx.stroke(); ctx.restore();
}
export { icon, FONT_D };
