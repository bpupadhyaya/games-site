// Small drawing helpers for the interface: text, flat buttons, panels, icons. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

// Text that never goes below ~11 css px.
export const minUnits = () => 11.5 / Math.max(0.2, host.px);

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  ctx.font = `${o.weight ?? 600} ${Math.max(size, minUnits())}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(4,22,20,0.88)'; ctx.strokeText(s, x, y); }
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

// Lacquered buttons and carved plaques: a lit gradient face, a bright top edge, a dark under-edge and a soft drop shadow, so every control sits in
// the same world as the 3D lyre. kind: primary (saffron lacquer), ghost / quiet (dark teal lacquer with a brass hairline), on (green), danger, gold.
const LAC = {
  primary: ['#ffe08a', '#f4b03e', '#c8741a'], gold: ['#fff0b0', '#ffd869', '#c9972b'], on: ['#7fe0a6', '#46b27a', '#23744d'], danger: ['#e0607a', '#b8324a', '#7a1730'],
  quiet: ['rgba(60,108,98,0.96)', 'rgba(24,66,60,0.96)', 'rgba(9,36,32,0.97)'], ghost: ['rgba(40,84,76,0.9)', 'rgba(16,52,47,0.92)', 'rgba(7,30,27,0.94)'],
  disabled: ['rgba(60,70,68,0.5)', 'rgba(40,48,46,0.5)', 'rgba(30,36,34,0.5)'],
};
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(22, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.4);
  const dn = o.press ? 2 : 0, y = r.y + dn, h = r.h;
  ctx.save();
  const c = LAC[kind] ?? LAC.ghost, light = kind === 'primary' || kind === 'on' || kind === 'gold';
  if (!o.noShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = o.press ? 4 : 10; ctx.shadowOffsetY = o.press ? 2 : 5;
    ctx.fillStyle = c[2]; rrect(ctx, { x: r.x, y, w: r.w, h }, rad); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }
  // under-edge (the thickness of the lacquer)
  ctx.fillStyle = light ? 'rgba(70,32,6,0.85)' : 'rgba(0,0,0,0.55)'; rrect(ctx, { x: r.x, y: y + 3, w: r.w, h }, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c[0]); g.addColorStop(0.5, c[1]); g.addColorStop(1, c[2]);
  ctx.fillStyle = g; rrect(ctx, { x: r.x, y, w: r.w, h }, rad); ctx.fill();
  // lit top edge + brass hairline
  ctx.lineWidth = 1.6; ctx.strokeStyle = light ? 'rgba(255,255,255,0.7)' : 'rgba(255,230,160,0.45)';
  rrect(ctx, { x: r.x + 1.2, y: y + 1.2, w: r.w - 2.4, h: h - 2.4 }, Math.max(2, rad - 1)); ctx.stroke();
  if (!light) { ctx.lineWidth = 1.2; const bg = ctx.createLinearGradient(0, y, 0, y + h); bg.addColorStop(0, 'rgba(255,224,150,0.7)'); bg.addColorStop(1, 'rgba(160,110,40,0.35)'); ctx.strokeStyle = bg; rrect(ctx, { x: r.x + 0.6, y: y + 0.6, w: r.w - 1.2, h: h - 1.2 }, rad); ctx.stroke(); }
  if (o.press) { ctx.fillStyle = 'rgba(0,0,0,0.16)'; rrect(ctx, { x: r.x, y, w: r.w, h }, rad); ctx.fill(); }
  const col = kind === 'disabled' ? 'rgba(255,247,230,0.4)' : light ? '#2a1604' : PAL.text;
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14, ty = y;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, ty + h / 2, r.h * 0.42, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  txt(ctx, label, cx, ty + h * (hasSub ? 0.36 : 0.5), size, col, { align: 'center', weight: 800, maxW: r.w - pad - 14, stroke: light ? 0 : 5, strokeColor: 'rgba(0,10,8,0.55)' });
  if (hasSub) txt(ctx, o.sub, cx, ty + h * 0.72, size * 0.6, light ? 'rgba(40,20,4,0.82)' : PAL.dim, { align: 'center', weight: 600, maxW: r.w - pad - 14 });
  ctx.restore();
}

// A carved plaque: dark wood-teal face, a dark outer line, a brass inner hairline, a lit top edge and a drop shadow.
export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
  ctx.fillStyle = o.fill ?? 'rgba(6,30,28,0.86)'; rrect(ctx, r, rad); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, 'rgba(255,240,200,0.10)'); g.addColorStop(0.18, 'rgba(255,240,200,0.02)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = g; rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(2,12,10,0.8)'; rrect(ctx, r, rad); ctx.stroke();
  const bg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); bg.addColorStop(0, 'rgba(255,224,150,0.62)'); bg.addColorStop(1, 'rgba(180,126,48,0.3)');
  ctx.lineWidth = 1.4; ctx.strokeStyle = o.stroke ?? bg; rrect(ctx, { x: r.x + 3.5, y: r.y + 3.5, w: r.w - 7, h: r.h - 7 }, Math.max(3, rad - 3)); ctx.stroke();
  ctx.restore();
}

// Icons: pause, back, ear (listen), play, plus, minus, metronome, echo, restart, strings.
export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'back') { ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.35, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'plus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'minus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke(); }
  else if (name === 'ear') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.1, s * 0.5, Math.PI * 0.9, Math.PI * 2.2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - s * 0.05, s * 0.2, Math.PI, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.15, cy + s * 0.2); ctx.quadraticCurveTo(cx - s * 0.05, cy + s * 0.65, cx + s * 0.25, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'metro') { ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy + s * 0.6); ctx.lineTo(cx - s * 0.2, cy - s * 0.6); ctx.lineTo(cx + s * 0.2, cy - s * 0.6); ctx.lineTo(cx + s * 0.5, cy + s * 0.6); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.3); ctx.lineTo(cx + s * 0.25, cy - s * 0.4); ctx.stroke(); }
  else if (name === 'echo') { for (let i = 0; i < 3; i++) { ctx.globalAlpha = 1 - i * 0.28; ctx.beginPath(); ctx.arc(cx - s * 0.5, cy, s * (0.3 + i * 0.3), -0.9, 0.9); ctx.stroke(); } }
  else if (name === 'restart') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, -0.4, Math.PI * 1.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.55, cy - s * 0.55); ctx.lineTo(cx + s * 0.55, cy - s * 0.05); ctx.lineTo(cx + s * 0.05, cy - s * 0.15); ctx.stroke(); }
  else if (name === 'hand') { ctx.beginPath(); ctx.roundRect(cx - s * 0.55, cy - s * 0.05, s * 1.1, s * 0.75, s * 0.2); ctx.stroke(); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(cx - s * 0.4 + k * s * 0.27, cy - s * 0.05); ctx.lineTo(cx - s * 0.4 + k * s * 0.27, cy - s * 0.7); ctx.stroke(); } }
  else if (name === 'grid') { for (let a = -1; a <= 1; a++) { ctx.beginPath(); ctx.moveTo(cx - s * 0.6, cy + a * s * 0.4); ctx.lineTo(cx + s * 0.6, cy + a * s * 0.4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + a * s * 0.4, cy - s * 0.6); ctx.lineTo(cx + a * s * 0.4, cy + s * 0.6); ctx.stroke(); } }
  else if (name === 'heart') { ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.55); ctx.bezierCurveTo(cx - s * 0.9, cy - s * 0.05, cx - s * 0.5, cy - s * 0.75, cx, cy - s * 0.25); ctx.bezierCurveTo(cx + s * 0.5, cy - s * 0.75, cx + s * 0.9, cy - s * 0.05, cx, cy + s * 0.55); ctx.fill(); }
  else if (name === 'strings') { for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(cx + k * s * 0.3, cy - s * 0.6); ctx.lineTo(cx + k * s * 0.3, cy + s * 0.45); ctx.stroke(); } ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.6, s * 0.75, s * 0.22, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

// A rounded chip with text.
export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `${o.weight ?? 700} ${Math.max(size, minUnits())}px ${UI}`;
  const w = ctx.measureText(label).width + size * 1.1, h = size * 1.7;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.fillStyle = o.fill ?? 'rgba(255,247,230,0.13)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,230,160,0.28)'; rrect(ctx, { x: rx + 0.6, y: y - h / 2 + 0.6, w: w - 1.2, h: h - 1.2 }, h / 2); ctx.stroke();
  if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 700 });
  return { x: rx, y: y - h / 2, w, h };
}

export { PAL, UI, DISPLAY, rgba };
