// Small drawing helpers for the interface: text, flat buttons, panels, icons, chips. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

// Text never goes below ~11.5 css px.
export const minUnits = () => 11.5 / Math.max(0.2, host.px);

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  s = String(s);
  const font = o.font ?? UI;
  ctx.font = `${o.weight ?? 600} ${Math.max(size, minUnits())}px ${font}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  if (o.maxW) {
    const mw = ctx.measureText(s).width;
    if (mw > o.maxW) ctx.font = `${o.weight ?? 600} ${Math.max(size * (o.maxW / mw), minUnits() * 0.8)}px ${font}`;
  }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(8,12,24,0.85)'; ctx.strokeText(s, x, y); }
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

// Lacquered buttons with depth: a lit vertical gradient, a dark under-edge (the button stands on the plate), a thin light bevel on top.
// kind: primary (sun orange), ghost (outline), quiet (soft fill), on (green), gold, danger, disabled, moon (cobalt).
const LACQ = { primary: ['#ffe27a', '#ffc83a', '#c98a0e'], on: ['#5cd091', '#3fae74', '#2a8556'], danger: ['#e9565f', '#c8353f', '#8f1f2a'], gold: ['#ffe27a', '#ffd23f', '#d9a31a'], sel: ['#ffe27a', '#ffd23f', '#d9a31a'], moon: ['#5d8bff', '#2f66ff', '#1c3fb8'] };
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(22, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.4);
  ctx.save();
  const depth = Math.min(7, Math.max(3, r.h * 0.07));
  const lac = LACQ[kind];
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; rrect(ctx, { x: r.x, y: r.y + depth + 2, w: r.w, h: r.h }, rad); ctx.fill(); }
  if (lac) {
    ctx.fillStyle = lac[2]; rrect(ctx, { x: r.x, y: r.y + depth, w: r.w, h: r.h }, rad); ctx.fill();            // the thick under-edge
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, lac[0]); g.addColorStop(0.55, lac[1]); g.addColorStop(1, lac[2]);
    ctx.fillStyle = g; rrect(ctx, r, rad); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, Math.max(2, rad - 1)); ctx.stroke();
  } else {
    const fills = { ghost: 'rgba(255,248,236,0.08)', quiet: 'rgba(255,248,236,0.16)', disabled: 'rgba(255,255,255,0.05)' };
    ctx.fillStyle = 'rgba(6,10,24,0.55)'; rrect(ctx, { x: r.x, y: r.y + depth * 0.6, w: r.w, h: r.h }, rad); ctx.fill();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, 'rgba(255,248,236,0.20)'); g.addColorStop(0.5, fills[kind] ?? fills.ghost); g.addColorStop(1, 'rgba(255,248,236,0.04)');
    ctx.fillStyle = g; rrect(ctx, r, rad); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = kind === 'disabled' ? 'rgba(255,210,63,0.22)' : 'rgba(255,210,63,0.55)'; rrect(ctx, r, rad); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, Math.max(2, rad - 3)); ctx.stroke();
  }
  const dark = kind === 'gold' || kind === 'sel' || kind === 'primary';
  const col = kind === 'disabled' ? 'rgba(255,248,236,0.38)' : dark ? '#2a1a00' : kind === 'ghost' || kind === 'quiet' ? PAL.text : '#fff';
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, r.y + r.h / 2, r.h * 0.4, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  txt(ctx, label, cx, r.y + r.h * (hasSub ? 0.36 : 0.5), size, col, { align: 'center', weight: 700, maxW: r.w - pad - 14, font: o.font, stroke: lac && !dark ? 3 : 0, strokeColor: lac ? lac[2] : undefined });
  if (hasSub) txt(ctx, o.sub, cx, r.y + r.h * 0.74, size * 0.6, dark ? 'rgba(42,26,0,0.8)' : PAL.dim, { align: 'center', weight: 500, maxW: r.w - pad - 14 });
  ctx.restore();
}

// Panels: a carved slate with a brass rim (dark outer line, bright inner line) and a soft top sheen.
export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, { x: r.x, y: r.y + 4, w: r.w, h: r.h }, rad); ctx.fill();
  ctx.fillStyle = o.fill ?? 'rgba(36,24,18,0.88)'; rrect(ctx, r, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + Math.min(r.h, 60)); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = o.stroke ?? 'rgba(90,62,18,0.9)'; rrect(ctx, r, rad); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke ? o.stroke : 'rgba(255,214,102,0.7)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, Math.max(2, rad - 2)); ctx.stroke();
  ctx.restore();
}

// Icons: pause, back, play, plus, minus, restart, hint, catch, lob, fast, watch.
export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'back') { ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.35, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'plus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'minus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke(); }
  else if (name === 'restart') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, -0.4, Math.PI * 1.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.55, cy - s * 0.55); ctx.lineTo(cx + s * 0.55, cy - s * 0.05); ctx.lineTo(cx + s * 0.05, cy - s * 0.15); ctx.stroke(); }
  else if (name === 'hint') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.15, s * 0.42, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.18, cy + s * 0.45); ctx.lineTo(cx + s * 0.18, cy + s * 0.45); ctx.stroke(); }
  else if (name === 'catch') {
    // two open hands facing a ball
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.26, 0, Math.PI * 2); ctx.fill();
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sg * s * 0.95, cy - s * 0.55); ctx.quadraticCurveTo(cx + sg * s * 0.9, cy + s * 0.6, cx + sg * s * 0.4, cy + s * 0.55); ctx.stroke(); }
  }
  else if (name === 'lob') { ctx.beginPath(); ctx.moveTo(cx - s * 0.8, cy + s * 0.5); ctx.quadraticCurveTo(cx, cy - s * 1.2, cx + s * 0.8, cy + s * 0.5); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + s * 0.8, cy + s * 0.5, s * 0.14, 0, Math.PI * 2); ctx.fill(); }
  else if (name === 'fast') { ctx.beginPath(); ctx.moveTo(cx - s * 0.8, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.2, cy - s * 0.4); ctx.lineTo(cx + s * 0.8, cy); ctx.lineTo(cx + s * 0.2, cy + s * 0.4); ctx.stroke(); }
  else if (name === 'watch') { ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.85, s * 0.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// A rounded chip with text. Returns its rect.
export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `${o.weight ?? 700} ${Math.max(size, minUnits())}px ${UI}`;
  const w = Math.min(o.maxW ?? 1e9, ctx.measureText(label).width + size * 1.1), h = size * 1.7;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.fillStyle = o.fill ?? 'rgba(255,248,236,0.14)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill();
  if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 700, maxW: w - size * 0.6 });
  return { x: rx, y: y - h / 2, w, h };
}

export { PAL, UI, DISPLAY, rgba };
