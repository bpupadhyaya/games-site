// Small drawing helpers for the interface: text, flat buttons, panels, icons. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

export const minUnits = () => 11.5 / Math.max(0.2, host.px);     // text never goes below ~11 css px

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  ctx.font = `${o.weight ?? 600} ${Math.max(size, minUnits())}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(14,8,28,0.85)'; ctx.strokeText(s, x, y); }
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

// Flat buttons. kind: primary (rose), ghost (outline), quiet (soft fill), on (teal), danger, gold, disabled.
export function button(ctx, r, label, o = {}) {
  const r0 = r;
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(22, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.4);
  ctx.save();
  // lacquered / wooden button with real depth: a darker lip under a lit face, a top highlight and a pressed state
  const depth = Math.max(4, Math.min(9, r.h * 0.11)), dn = o.press ? depth * 0.7 : 0;
  const face = { x: r.x, y: r.y + dn, w: r.w, h: r.h - depth };
  const tones = {
    primary: ['#ff7f98', '#e8486a', '#a8203f', '#6e1028'], on: ['#6fe0d4', '#2fb3a8', '#1a7d76', '#0f4f4b'], gold: ['#ffe08a', '#f0b94a', '#b97d1c', '#7a4c0c'],
    danger: ['#e0566e', '#b9304a', '#7d1a30', '#4a0d1c'], quiet: ['#8a7550', '#6d5a3a', '#4c3d26', '#2c2316'], ghost: ['#6f5e44', '#54462f', '#3a301f', '#231c12'],
    disabled: ['#4a4a52', '#3a3a42', '#2a2a30', '#1c1c20'],
  };
  const tn = tones[kind] ?? tones.ghost;
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; rrect(ctx, { x: r.x + 1, y: r.y + depth * 0.9 + 3, w: r.w - 2, h: r.h - depth }, rad); ctx.fill(); }
  ctx.fillStyle = tn[3]; rrect(ctx, { x: face.x, y: face.y + depth, w: face.w, h: face.h }, rad); ctx.fill();         // the lip
  ctx.fillStyle = tn[2]; rrect(ctx, { x: face.x, y: face.y + depth * 0.55, w: face.w, h: face.h }, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, face.y, 0, face.y + face.h);
  g.addColorStop(0, tn[0]); g.addColorStop(0.18, tn[1]); g.addColorStop(1, tn[2]);
  ctx.fillStyle = g; rrect(ctx, face, rad); ctx.fill();
  ctx.save(); rrect(ctx, face, rad); ctx.clip();
  const hl = ctx.createLinearGradient(0, face.y, 0, face.y + face.h * 0.5);
  hl.addColorStop(0, 'rgba(255,255,255,0.34)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(face.x, face.y, face.w, face.h * 0.5);
  ctx.restore();
  ctx.lineWidth = 1.5; ctx.strokeStyle = kind === 'ghost' || kind === 'quiet' ? 'rgba(255,214,150,0.55)' : 'rgba(255,255,255,0.35)'; rrect(ctx, { x: face.x + 0.75, y: face.y + 0.75, w: face.w - 1.5, h: face.h - 1.5 }, rad); ctx.stroke();
  if (o.press) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; rrect(ctx, face, rad); ctx.fill(); }
  r = { x: face.x, y: face.y, w: face.w, h: face.h };
  const dark = kind === 'primary' || kind === 'on' || kind === 'gold';
  const col = kind === 'disabled' ? 'rgba(255,240,220,0.4)' : dark ? (kind === 'primary' ? '#fff' : '#10101e') : PAL.text;
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, r.y + r.h / 2, r.h * 0.42, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  txt(ctx, label, cx, r.y + r.h * (hasSub ? 0.36 : 0.5), size, col, { align: 'center', weight: 700, maxW: r.w - pad - 14 });
  if (hasSub) txt(ctx, o.sub, cx, r.y + r.h * 0.72, size * 0.6, dark ? 'rgba(255,255,255,0.82)' : PAL.dim, { align: 'center', weight: 500, maxW: r.w - pad - 14 });
  ctx.restore();
}

export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  ctx.fillStyle = o.fill ?? 'rgba(16,22,48,0.74)'; rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = o.stroke ?? 'rgba(255,240,220,0.2)'; rrect(ctx, r, rad); ctx.stroke();
  ctx.restore();
}

// Icons: pause, play, back, plus, minus, restart, bulb (hint), eye (watch), arrows (up, down, left, right), tap, hold.
export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.17); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const arrow = (dx, dy) => {
    const px = -dy, py = dx;
    ctx.beginPath(); ctx.moveTo(cx - dx * s * 0.7, cy - dy * s * 0.7); ctx.lineTo(cx + dx * s * 0.7, cy + dy * s * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + dx * s * 0.7 + (px - dx) * s * 0.5, cy + dy * s * 0.7 + (py - dy) * s * 0.5); ctx.lineTo(cx + dx * s * 0.72, cy + dy * s * 0.72); ctx.lineTo(cx + dx * s * 0.7 + (-px - dx) * s * 0.5, cy + dy * s * 0.7 + (-py - dy) * s * 0.5); ctx.stroke();
  };
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'back') { ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.35, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'plus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'minus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke(); }
  else if (name === 'restart') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, -0.4, Math.PI * 1.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.55, cy - s * 0.55); ctx.lineTo(cx + s * 0.55, cy - s * 0.05); ctx.lineTo(cx + s * 0.05, cy - s * 0.15); ctx.stroke(); }
  else if (name === 'bulb') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.15, s * 0.5, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.22, cy + s * 0.55); ctx.lineTo(cx + s * 0.22, cy + s * 0.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.15, cy + s * 0.78); ctx.lineTo(cx + s * 0.15, cy + s * 0.78); ctx.stroke(); }
  else if (name === 'eye') { ctx.beginPath(); ctx.moveTo(cx - s * 0.75, cy); ctx.quadraticCurveTo(cx, cy - s * 0.85, cx + s * 0.75, cy); ctx.quadraticCurveTo(cx, cy + s * 0.85, cx - s * 0.75, cy); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.24, 0, Math.PI * 2); ctx.fill(); }
  else if (name === 'up') arrow(0, -1);
  else if (name === 'down') arrow(0, 1);
  else if (name === 'left') arrow(-1, 0);
  else if (name === 'right') arrow(1, 0);
  else if (name === 'tap') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.2, 0, Math.PI * 2); ctx.fill(); }
  else if (name === 'hold') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.fillRect(cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.6); }
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
