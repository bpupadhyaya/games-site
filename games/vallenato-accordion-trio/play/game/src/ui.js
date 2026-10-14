// Small drawing helpers for the interface: text, flat buttons, panels, icons. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';
import { v3 } from './v3.js';

// Text that never goes below ~11.5 css px.
export const minUnits = () => 11.5 / Math.max(0.2, host.px);

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  ctx.font = `${o.weight ?? 600} ${Math.max(size, minUnits())}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  let sz = Math.max(size, minUnits());
  if (o.maxW && ctx.measureText(s).width > o.maxW) {                      // squeeze to fit rather than overflow
    const k = o.maxW / ctx.measureText(s).width; sz = Math.max(size * k, minUnits()); ctx.font = `${o.weight ?? 600} ${sz}px ${o.font ?? UI}`;
  }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(6,20,26,0.9)'; ctx.strokeText(s, x, y); }
  ctx.fillText(s, x, y);
}

// Embossed metal lettering: a stacked dark extrusion, a lit gold face with a vertical gradient, and a thin top highlight.
export function embossText(ctx, s, x, y, size, o = {}) {
  const font = o.font ?? DISPLAY, depth = Math.max(2, size * 0.075), top = o.top ?? '#fff1b8', mid = o.mid ?? '#ffc43d', bot = o.bot ?? '#c1701a';
  ctx.save();
  ctx.font = `400 ${Math.max(size, minUnits())}px ${font}`;
  if (o.maxW && ctx.measureText(s).width > o.maxW) { size = Math.max(size * (o.maxW / ctx.measureText(s).width), minUnits()); ctx.font = `400 ${size}px ${font}`; }
  ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = depth; i > 0; i -= 1) ctx.fillText(s, x + i * 0.35, y + i + depth * 0.4);
  ctx.strokeStyle = '#3a1604'; ctx.lineWidth = Math.max(4, size * 0.13); ctx.strokeText(s, x, y);
  for (let i = depth; i >= 1; i -= 1) { ctx.fillStyle = i > depth * 0.5 ? '#7a3a08' : '#a8560e'; ctx.fillText(s, x, y + i); }
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, top); g.addColorStop(0.45, mid); g.addColorStop(0.55, '#ffb52a'); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillText(s, x, y);
  ctx.strokeStyle = 'rgba(255,250,220,0.55)'; ctx.lineWidth = Math.max(1, size * 0.018); ctx.strokeText(s, x, y - 0.5);
  ctx.restore();
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

// Flat buttons. kind: primary (mango), ghost (outline), quiet (soft fill), on (mint), danger, disabled.
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(22, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.4);
  ctx.save();
  if (v3.on && !o.flat) {
    // 3D layer on: the lacquered 3D button is drawn behind this text
    v3.buttons.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad, kind, top: !!o.top });
  } else {
    if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, { x: r.x, y: r.y + 4, w: r.w, h: r.h }, rad); ctx.fill(); }
    const fills = { primary: '#ffb02e', ghost: 'rgba(255,244,224,0.08)', quiet: 'rgba(255,244,224,0.15)', on: '#35d6c6', danger: '#ff6b57', gold: '#ffd166', disabled: 'rgba(255,255,255,0.05)', coral: '#ff6b57' };
    ctx.fillStyle = fills[kind] ?? fills.ghost; rrect(ctx, r, rad); ctx.fill();
    if (kind === 'ghost' || kind === 'quiet' || kind === 'disabled') { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,238,210,0.34)'; rrect(ctx, r, rad); ctx.stroke(); }
    if (o.press) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; rrect(ctx, r, rad); ctx.fill(); }
  }
  const dark = kind === 'primary' || kind === 'on' || kind === 'gold' || kind === 'coral' || kind === 'danger';
  const col = kind === 'disabled' ? 'rgba(255,244,224,0.4)' : dark ? '#1c0a04' : PAL.text;
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, r.y + r.h / 2, r.h * 0.4, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  txt(ctx, label, cx, r.y + r.h * (hasSub ? 0.36 : 0.5), size, col, { align: 'center', weight: 800, maxW: r.w - pad - 14 });
  if (hasSub) txt(ctx, o.sub, cx, r.y + r.h * 0.72, size * 0.6, dark ? 'rgba(28,10,4,0.75)' : PAL.dim, { align: 'center', weight: 600, maxW: r.w - pad - 14 });
  ctx.restore();
}

export function panel(ctx, r, o = {}) {
  const rad = o.rad ?? 24;
  if (v3.on && !o.flat) { v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad, kind: o.kind ?? 'slate', col: o.col, fill: o.pfill, top: !!o.top }); return; }
  ctx.save();
  ctx.fillStyle = o.fill ?? 'rgba(5,24,30,0.78)'; rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = o.stroke ?? 'rgba(255,238,210,0.2)'; rrect(ctx, r, rad); ctx.stroke();
  ctx.restore();
}

// Icons: pause, back, play, plus, minus, restart, bulb (hint), ear (listen).
export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'back') { ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.35, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'plus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'minus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke(); }
  else if (name === 'restart') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, -0.4, Math.PI * 1.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.55, cy - s * 0.55); ctx.lineTo(cx + s * 0.55, cy - s * 0.05); ctx.lineTo(cx + s * 0.05, cy - s * 0.15); ctx.stroke(); }
  else if (name === 'bulb') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.12, s * 0.46, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy + s * 0.5); ctx.lineTo(cx + s * 0.2, cy + s * 0.5); ctx.moveTo(cx - s * 0.14, cy + s * 0.72); ctx.lineTo(cx + s * 0.14, cy + s * 0.72); ctx.stroke(); }
  else if (name === 'ear') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.1, s * 0.5, Math.PI * 0.9, Math.PI * 2.2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - s * 0.05, s * 0.2, Math.PI, Math.PI * 2); ctx.stroke(); }
  else if (name === 'book') { ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.45); ctx.lineTo(cx, cy + s * 0.55); ctx.moveTo(cx, cy - s * 0.45); ctx.quadraticCurveTo(cx - s * 0.45, cy - s * 0.7, cx - s * 0.7, cy - s * 0.4); ctx.lineTo(cx - s * 0.7, cy + s * 0.5); ctx.quadraticCurveTo(cx - s * 0.45, cy + s * 0.25, cx, cy + s * 0.55); ctx.quadraticCurveTo(cx + s * 0.45, cy + s * 0.25, cx + s * 0.7, cy + s * 0.5); ctx.lineTo(cx + s * 0.7, cy - s * 0.4); ctx.quadraticCurveTo(cx + s * 0.45, cy - s * 0.7, cx, cy - s * 0.45); ctx.stroke(); }
  else if (name === 'info') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.02); ctx.lineTo(cx, cy + s * 0.34); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - s * 0.28, s * 0.05, 0, Math.PI * 2); ctx.fill(); }
  else if (name === 'gear') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2); ctx.stroke(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5); ctx.lineTo(cx + Math.cos(a) * s * 0.72, cy + Math.sin(a) * s * 0.72); ctx.stroke(); } }
  else if (name === 'list') { for (const dy of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy + s * dy); ctx.lineTo(cx + s * 0.65, cy + s * dy); ctx.stroke(); ctx.beginPath(); ctx.arc(cx - s * 0.55, cy + s * dy, s * 0.06, 0, Math.PI * 2); ctx.fill(); } }
  else if (name === 'rec') { ctx.fillStyle = '#ff6b57'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,244,224,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

// A rounded chip with text. Returns its rect.
export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `${o.weight ?? 800} ${Math.max(size, minUnits())}px ${UI}`;
  const w = ctx.measureText(label).width + size * 1.1, h = size * 1.7;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  if (v3.on && !o.flat) v3.buttons.push({ r: { x: rx, y: y - h / 2, w, h }, rad: h / 2, kind: (o.fill && /255,\s*176|255,176/.test(String(o.fill))) || o.gold ? 'primary' : 'quiet', top: !!o.top });
  else { ctx.fillStyle = o.fill ?? 'rgba(255,244,224,0.13)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill(); }
  if (o.stroke && !(v3.on && !o.flat)) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 800 });
  return { x: rx, y: y - h / 2, w, h };
}

export { PAL, UI, DISPLAY, rgba };
