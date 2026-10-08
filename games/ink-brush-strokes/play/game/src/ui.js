// Small drawing helpers for the interface: text, flat buttons, panels, icons. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

// Text that never goes below ~11 css px.
export const minUnits = () => 11.5 / Math.max(0.2, host.px);

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  ctx.font = `${o.weight ?? 600} ${Math.max(size, minUnits())}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(8,12,14,0.85)'; ctx.strokeText(s, x, y); }
  if (o.maxW && ctx.measureText(s).width > o.maxW) {                      // squeeze to fit rather than overflow
    const k = o.maxW / ctx.measureText(s).width; ctx.font = `${o.weight ?? 600} ${Math.max(size * k, minUnits())}px ${o.font ?? UI}`;
  }
  ctx.fillText(s, x, y);
}

// Greedy word wrap into lines no wider than maxW at the font currently set on ctx.
export function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}

export function rrect(ctx, r, rad) { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); }

// Flat buttons. kind: primary (ember), ghost (outline), quiet (soft fill), on (teal when a toggle is on), danger.
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(22, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.4);
  ctx.save();
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; rrect(ctx, { x: r.x, y: r.y + 4, w: r.w, h: r.h }, rad); ctx.fill(); }
  const fills = { primary: '#c8412f', ghost: 'rgba(244,236,216,0.08)', quiet: 'rgba(244,236,216,0.14)', on: '#2f9c82', danger: '#b9304a', gold: '#e2c37a', disabled: 'rgba(255,255,255,0.05)' };
  ctx.fillStyle = fills[kind] ?? fills.ghost; rrect(ctx, r, rad); ctx.fill();
  if (kind === 'ghost' || kind === 'quiet' || kind === 'disabled') { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,236,216,0.32)'; rrect(ctx, r, rad); ctx.stroke(); }
  if (o.press) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; rrect(ctx, r, rad); ctx.fill(); }
  const dark = kind === 'primary' || kind === 'on' || kind === 'gold';
  const col = kind === 'disabled' ? 'rgba(244,236,216,0.4)' : dark ? (kind === 'primary' ? '#fff' : '#10101e') : PAL.text;
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, r.y + r.h / 2, r.h * 0.42, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  txt(ctx, label, cx, r.y + r.h * (hasSub ? 0.36 : 0.5), size, col, { align: 'center', weight: 700, maxW: r.w - pad - 14 });
  if (hasSub) txt(ctx, o.sub, cx, r.y + r.h * 0.72, size * 0.6, dark ? 'rgba(255,255,255,0.8)' : PAL.dim, { align: 'center', weight: 500, maxW: r.w - pad - 14 });
  ctx.restore();
}

export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  ctx.fillStyle = o.fill ?? 'rgba(14,22,24,0.78)'; rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = o.stroke ?? 'rgba(244,236,216,0.18)'; rrect(ctx, r, rad); ctx.stroke();
  ctx.restore();
}

// Icons: pause, play, back, plus, minus, restart, and the brush-and-ink tools.
export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const T = Math.PI * 2;
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'back') { ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.35, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'next') { ctx.beginPath(); ctx.moveTo(cx - s * 0.35, cy - s * 0.6); ctx.lineTo(cx + s * 0.35, cy); ctx.lineTo(cx - s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'plus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'minus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke(); }
  else if (name === 'restart') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, -0.4, Math.PI * 1.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.55, cy - s * 0.55); ctx.lineTo(cx + s * 0.55, cy - s * 0.05); ctx.lineTo(cx + s * 0.05, cy - s * 0.15); ctx.stroke(); }
  else if (name === 'dip') { ctx.beginPath(); ctx.moveTo(cx - s * 0.6, cy + s * 0.05); ctx.lineTo(cx - s * 0.5, cy + s * 0.6); ctx.lineTo(cx + s * 0.5, cy + s * 0.6); ctx.lineTo(cx + s * 0.6, cy + s * 0.05); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.05, s * 0.6, s * 0.18, 0, 0, T); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.25, cy - s * 0.95); ctx.lineTo(cx - s * 0.05, cy + s * 0.05); ctx.stroke(); }
  else if (name === 'water') { ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.75); ctx.bezierCurveTo(cx + s * 0.75, cy + s * 0.1, cx + s * 0.55, cy + s * 0.75, cx, cy + s * 0.75); ctx.bezierCurveTo(cx - s * 0.55, cy + s * 0.75, cx - s * 0.75, cy + s * 0.1, cx, cy - s * 0.75); ctx.stroke(); }
  else if (name === 'grind') { ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.3, s * 0.7, s * 0.34, 0, 0, T); ctx.stroke(); ctx.beginPath(); ctx.roundRect(cx - s * 0.15, cy - s * 0.85, s * 0.3, s * 0.9, 3); ctx.fill(); }
  else if (name === 'size') { ctx.beginPath(); ctx.arc(cx - s * 0.4, cy, s * 0.18, 0, T); ctx.fill(); ctx.beginPath(); ctx.arc(cx + s * 0.25, cy, s * 0.4, 0, T); ctx.fill(); }
  else if (name === 'guide') { ctx.beginPath(); ctx.rect(cx - s * 0.6, cy - s * 0.6, s * 1.2, s * 1.2); ctx.stroke(); ctx.setLineDash([s * 0.2, s * 0.15]); ctx.beginPath(); ctx.moveTo(cx - s * 0.6, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy + s * 0.6); ctx.moveTo(cx + s * 0.6, cy - s * 0.6); ctx.lineTo(cx - s * 0.6, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'undo') { ctx.beginPath(); ctx.moveTo(cx - s * 0.6, cy - s * 0.1); ctx.lineTo(cx - s * 0.1, cy - s * 0.55); ctx.moveTo(cx - s * 0.6, cy - s * 0.1); ctx.lineTo(cx - s * 0.1, cy + s * 0.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy - s * 0.1); ctx.bezierCurveTo(cx + s * 0.4, cy - s * 0.2, cx + s * 0.7, cy + s * 0.2, cx + s * 0.4, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'hint') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.2, s * 0.45, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy + s * 0.5); ctx.lineTo(cx + s * 0.2, cy + s * 0.5); ctx.moveTo(cx - s * 0.12, cy + s * 0.8); ctx.lineTo(cx + s * 0.12, cy + s * 0.8); ctx.stroke(); }
  else if (name === 'seal') { ctx.beginPath(); ctx.roundRect(cx - s * 0.5, cy - s * 0.2, s, s * 0.8, 3); ctx.stroke(); ctx.beginPath(); ctx.roundRect(cx - s * 0.2, cy - s * 0.85, s * 0.4, s * 0.6, 3); ctx.fill(); }
  else if (name === 'clear') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy - s * 0.45); ctx.lineTo(cx + s * 0.55, cy - s * 0.45); ctx.moveTo(cx - s * 0.35, cy - s * 0.45); ctx.lineTo(cx - s * 0.28, cy + s * 0.6); ctx.lineTo(cx + s * 0.28, cy + s * 0.6); ctx.lineTo(cx + s * 0.35, cy - s * 0.45); ctx.moveTo(cx - s * 0.15, cy - s * 0.7); ctx.lineTo(cx + s * 0.15, cy - s * 0.7); ctx.stroke(); }
  else if (name === 'save') { ctx.beginPath(); ctx.roundRect(cx - s * 0.6, cy - s * 0.6, s * 1.2, s * 1.2, 4); ctx.stroke(); ctx.beginPath(); ctx.rect(cx - s * 0.3, cy - s * 0.6, s * 0.6, s * 0.4); ctx.fill(); ctx.beginPath(); ctx.rect(cx - s * 0.35, cy + s * 0.1, s * 0.7, s * 0.5); ctx.stroke(); }
  else if (name === 'left') { ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.35, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'right') { ctx.beginPath(); ctx.moveTo(cx - s * 0.35, cy - s * 0.6); ctx.lineTo(cx + s * 0.35, cy); ctx.lineTo(cx - s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'eye') { ctx.beginPath(); ctx.moveTo(cx - s * 0.75, cy); ctx.quadraticCurveTo(cx, cy - s * 0.8, cx + s * 0.75, cy); ctx.quadraticCurveTo(cx, cy + s * 0.8, cx - s * 0.75, cy); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.22, 0, T); ctx.fill(); }
  else if (name === 'brush') { ctx.beginPath(); ctx.moveTo(cx + s * 0.7, cy - s * 0.7); ctx.lineTo(cx - s * 0.1, cy + s * 0.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.15, cy - s * 0.05); ctx.quadraticCurveTo(cx - s * 0.55, cy + s * 0.1, cx - s * 0.7, cy + s * 0.75); ctx.quadraticCurveTo(cx - s * 0.1, cy + s * 0.55, cx + s * 0.1, cy + s * 0.15); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

// A rounded chip with text.
export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `${o.weight ?? 700} ${Math.max(size, minUnits())}px ${UI}`;
  const w = ctx.measureText(label).width + size * 1.1, h = size * 1.7;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.fillStyle = o.fill ?? 'rgba(244,236,216,0.12)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill();
  if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 700 });
  return { x: rx, y: y - h / 2, w, h };
}

export { PAL, UI, DISPLAY, rgba };
