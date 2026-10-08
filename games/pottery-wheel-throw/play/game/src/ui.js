// Small drawing helpers for the interface: text, flat buttons, panels, icons. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

export const minUnits = () => 11.5 / Math.max(0.2, host.px);

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  ctx.font = `${o.weight ?? 600} ${Math.max(size, minUnits())}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(20,10,6,0.8)'; ctx.strokeText(s, x, y); }
  if (o.maxW && ctx.measureText(s).width > o.maxW) {
    const k = o.maxW / ctx.measureText(s).width; ctx.font = `${o.weight ?? 600} ${Math.max(size * k, minUnits())}px ${o.font ?? UI}`;
  }
  ctx.fillText(s, x, y);
}
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

// kind: primary (terracotta), ghost (outline), quiet (soft fill), on (teal), danger, gold, disabled. Flat: no inner gloss.
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(22, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.4);
  ctx.save();
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, { x: r.x, y: r.y + 4, w: r.w, h: r.h }, rad); ctx.fill(); }
  const fills = { primary: '#e2753d', ghost: 'rgba(255,240,220,0.07)', quiet: 'rgba(255,240,220,0.13)', on: '#49b5a4', danger: '#b9404a', gold: '#f3c984', disabled: 'rgba(255,255,255,0.05)' };
  ctx.fillStyle = fills[kind] ?? fills.ghost; rrect(ctx, r, rad); ctx.fill();
  if (kind === 'ghost' || kind === 'quiet' || kind === 'disabled') { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,200,0.3)'; rrect(ctx, r, rad); ctx.stroke(); }
  if (o.press) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; rrect(ctx, r, rad); ctx.fill(); }
  if (o.pulse) { ctx.lineWidth = 4; ctx.strokeStyle = `rgba(255,214,160,${0.4 + 0.4 * o.pulse})`; rrect(ctx, { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 }, rad + 3); ctx.stroke(); }
  const dark = kind === 'primary' || kind === 'on' || kind === 'gold';
  const col = kind === 'disabled' ? 'rgba(255,240,220,0.4)' : dark ? (kind === 'primary' ? '#fff' : '#1d1410') : PAL.text;
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, r.y + r.h / 2, r.h * 0.4, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  txt(ctx, label, cx, r.y + r.h * (hasSub ? 0.36 : 0.5), size, col, { align: 'center', weight: 700, maxW: r.w - pad - 14 });
  if (hasSub) txt(ctx, o.sub, cx, r.y + r.h * 0.72, size * 0.6, dark ? 'rgba(255,255,255,0.82)' : PAL.dim, { align: 'center', weight: 500, maxW: r.w - pad - 14 });
  ctx.restore();
}
export function iconButton(ctx, r, name, o = {}) {
  const kind = o.kind ?? 'quiet';
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, { x: r.x, y: r.y + 3, w: r.w, h: r.h }, r.h * 0.3); ctx.fill();
  ctx.fillStyle = kind === 'primary' ? '#e2753d' : 'rgba(40,26,20,0.82)'; rrect(ctx, r, r.h * 0.3); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,200,0.3)'; rrect(ctx, r, r.h * 0.3); ctx.stroke();
  icon(ctx, name, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.3, o.color ?? PAL.text);
  ctx.restore();
}
export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  ctx.fillStyle = o.fill ?? 'rgba(30,20,16,0.78)'; rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = o.stroke ?? 'rgba(255,230,200,0.16)'; rrect(ctx, r, rad); ctx.stroke();
  ctx.restore();
}

export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'back') { ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.35, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'next') { ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy - s * 0.55); ctx.lineTo(cx + s * 0.1, cy); ctx.lineTo(cx - s * 0.5, cy + s * 0.55); ctx.moveTo(cx + s * 0.1, cy - s * 0.55); ctx.lineTo(cx + s * 0.7, cy); ctx.lineTo(cx + s * 0.1, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'undo') { ctx.beginPath(); ctx.arc(cx + s * 0.05, cy + s * 0.05, s * 0.5, Math.PI * 1.15, Math.PI * 2.35); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.62, cy - s * 0.5); ctx.lineTo(cx - s * 0.5, cy - s * 0.08); ctx.lineTo(cx - s * 0.1, cy - s * 0.35); ctx.stroke(); }
  else if (name === 'hint') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.15, s * 0.5, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.22, cy + s * 0.48); ctx.lineTo(cx + s * 0.22, cy + s * 0.48); ctx.moveTo(cx - s * 0.15, cy + s * 0.7); ctx.lineTo(cx + s * 0.15, cy + s * 0.7); ctx.stroke(); }
  else if (name === 'skip') { ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy - s * 0.55); ctx.lineTo(cx + s * 0.35, cy); ctx.lineTo(cx - s * 0.5, cy + s * 0.55); ctx.closePath(); ctx.fill(); ctx.fillRect(cx + s * 0.45, cy - s * 0.55, s * 0.18, s * 1.1); }
  else if (name === 'plus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'minus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke(); }
  else if (name === 'eye') { ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.8, s * 0.48, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2); ctx.fill(); }
  else if (name === 'pot') { ctx.beginPath(); ctx.moveTo(cx - s * 0.35, cy - s * 0.65); ctx.quadraticCurveTo(cx - s * 0.2, cy - s * 0.3, cx - s * 0.6, cy + s * 0.1); ctx.quadraticCurveTo(cx - s * 0.6, cy + s * 0.7, cx, cy + s * 0.7); ctx.quadraticCurveTo(cx + s * 0.6, cy + s * 0.7, cx + s * 0.6, cy + s * 0.1); ctx.quadraticCurveTo(cx + s * 0.2, cy - s * 0.3, cx + s * 0.35, cy - s * 0.65); ctx.stroke(); }
  else if (name === 'shelf') { ctx.beginPath(); ctx.moveTo(cx - s * 0.7, cy + s * 0.5); ctx.lineTo(cx + s * 0.7, cy + s * 0.5); ctx.moveTo(cx - s * 0.5, cy + s * 0.5); ctx.lineTo(cx - s * 0.5, cy - s * 0.2); ctx.lineTo(cx - s * 0.1, cy - s * 0.2); ctx.lineTo(cx - s * 0.1, cy + s * 0.5); ctx.moveTo(cx + s * 0.15, cy + s * 0.5); ctx.lineTo(cx + s * 0.15, cy - s * 0.5); ctx.lineTo(cx + s * 0.55, cy - s * 0.5); ctx.lineTo(cx + s * 0.55, cy + s * 0.5); ctx.stroke(); }
  else if (name === 'close') { ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy - s * 0.5); ctx.lineTo(cx + s * 0.5, cy + s * 0.5); ctx.moveTo(cx + s * 0.5, cy - s * 0.5); ctx.lineTo(cx - s * 0.5, cy + s * 0.5); ctx.stroke(); }
  else if (name === 'restart') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, -0.4, Math.PI * 1.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.55, cy - s * 0.55); ctx.lineTo(cx + s * 0.55, cy - s * 0.05); ctx.lineTo(cx + s * 0.05, cy - s * 0.15); ctx.stroke(); }
  ctx.restore();
}
export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `${o.weight ?? 700} ${Math.max(size, minUnits())}px ${UI}`;
  const w = ctx.measureText(label).width + size * 1.1, h = size * 1.7;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.fillStyle = o.fill ?? 'rgba(255,240,220,0.12)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill();
  if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 700 });
  return { x: rx, y: y - h / 2, w, h };
}
export { PAL, UI, DISPLAY, rgba };
