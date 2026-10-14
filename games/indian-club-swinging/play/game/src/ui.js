// Small drawing helpers for the interface: text, flat buttons, panels, icons. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

// Text that never goes below ~11 css px.
export const minUnits = () => 11.5 / Math.max(0.2, host.px);

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  ctx.font = `${o.weight ?? 600} ${Math.max(size, minUnits())}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(10,6,24,0.85)'; ctx.strokeText(s, x, y); }
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

// Buttons and panels belong to the courtyard: lacquered saffron and carved-slate plates with a brass edge and a real thickness (a darker
// lower edge under the face; pressed buttons sink onto it). No gloss shapes.
const BTN = {
  primary: { top: '#ffb94a', bot: '#e8761c', edge: '#8c3a08', line: 'rgba(255,236,190,0.75)', txt: '#fff' },
  gold: { top: '#ffe08a', bot: '#e0a030', edge: '#7a5410', line: 'rgba(255,255,230,0.8)', txt: '#2a1a06' },
  on: { top: '#47d0ba', bot: '#1c8f7c', edge: '#0a4a40', line: 'rgba(210,255,240,0.7)', txt: '#04201c' },
  danger: { top: '#e0506a', bot: '#a02a44', edge: '#52121f', line: 'rgba(255,200,210,0.6)', txt: '#fff' },
  quiet: { top: '#2f6a66', bot: '#173f42', edge: '#0a2326', line: 'rgba(230,200,120,0.55)', txt: PAL.text },
  ghost: { top: '#1d4a4d', bot: '#0f2c30', edge: '#06171a', line: 'rgba(230,200,120,0.4)', txt: PAL.text },
  disabled: { top: '#2a3a3c', bot: '#1c282a', edge: '#0c1416', line: 'rgba(255,255,255,0.12)', txt: 'rgba(255,240,220,0.4)' },
};
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(22, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.4);
  const c = BTN[kind] ?? BTN.ghost, depth = Math.max(3, Math.min(7, r.h * 0.07)), sink = o.press ? depth * 0.7 : 0;
  ctx.save();
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.34)'; rrect(ctx, { x: r.x + 1, y: r.y + depth + 4, w: r.w - 2, h: r.h }, rad); ctx.fill(); }
  // the lower edge (thickness)
  ctx.fillStyle = c.edge; rrect(ctx, { x: r.x, y: r.y + depth - sink, w: r.w, h: r.h }, rad); ctx.fill();
  // the face
  const face = { x: r.x, y: r.y + sink, w: r.w, h: r.h };
  const g = ctx.createLinearGradient(0, face.y, 0, face.y + face.h); g.addColorStop(0, c.top); g.addColorStop(1, c.bot);
  ctx.fillStyle = g; rrect(ctx, face, rad); ctx.fill();
  // the brass hairline around the face and a light line along the top lip
  ctx.lineWidth = 1.6; ctx.strokeStyle = c.line; rrect(ctx, { x: face.x + 0.8, y: face.y + 0.8, w: face.w - 1.6, h: face.h - 1.6 }, rad); ctx.stroke();
  if (o.press) { ctx.fillStyle = 'rgba(0,0,0,0.14)'; rrect(ctx, face, rad); ctx.fill(); }
  const col = c.txt;
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14, ty = face.y + face.h * (hasSub ? 0.36 : 0.5);
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, face.y + face.h / 2, r.h * 0.42, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  txt(ctx, label, cx, ty, size, col, { align: 'center', weight: 700, maxW: r.w - pad - 14 });
  if (hasSub) txt(ctx, o.sub, cx, face.y + face.h * 0.72, size * 0.6, kind === 'primary' || kind === 'on' || kind === 'gold' ? 'rgba(255,255,255,0.8)' : PAL.dim, { align: 'center', weight: 500, maxW: r.w - pad - 14 });
  ctx.restore();
}

export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, { x: r.x + 2, y: r.y + 6, w: r.w - 4, h: r.h }, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, o.fillTop ?? 'rgba(26,66,68,0.9)'); g.addColorStop(1, o.fillBot ?? 'rgba(7,24,28,0.93)');
  ctx.fillStyle = g; rrect(ctx, r, rad); ctx.fill();
  const bg = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  bg.addColorStop(0, 'rgba(255,224,150,0.7)'); bg.addColorStop(0.5, 'rgba(180,130,50,0.45)'); bg.addColorStop(1, 'rgba(255,214,130,0.6)');
  ctx.lineWidth = 2.4; ctx.strokeStyle = o.stroke ?? bg; rrect(ctx, r, rad); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,240,200,0.12)'; rrect(ctx, { x: r.x + 5, y: r.y + 5, w: r.w - 10, h: r.h - 10 }, Math.max(4, rad - 5)); ctx.stroke();
  ctx.restore();
}

// Icons: pause, back, ear, play, plus, minus, restart, club, hint, path.
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
  else if (name === 'club') { ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.6); ctx.beginPath(); ctx.moveTo(0, -s * 0.75); ctx.lineTo(-s * 0.1, -s * 0.3); ctx.lineTo(-s * 0.3, s * 0.35); ctx.quadraticCurveTo(0, s * 0.8, s * 0.3, s * 0.35); ctx.lineTo(s * 0.1, -s * 0.3); ctx.closePath(); ctx.stroke(); ctx.restore(); }
  else if (name === 'hint') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.15, s * 0.42, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.18, cy + s * 0.45); ctx.lineTo(cx + s * 0.18, cy + s * 0.45); ctx.stroke(); }
  else if (name === 'path') { ctx.beginPath(); ctx.moveTo(cx - s * 0.6, cy + s * 0.3); ctx.bezierCurveTo(cx - s * 0.6, cy - s * 0.7, cx + s * 0.1, cy - s * 0.7, cx + s * 0.1, cy); ctx.bezierCurveTo(cx + s * 0.1, cy + s * 0.7, cx + s * 0.6, cy + s * 0.7, cx + s * 0.6, cy - s * 0.3); ctx.stroke(); }
  ctx.restore();
}

// A rounded chip with text.
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
