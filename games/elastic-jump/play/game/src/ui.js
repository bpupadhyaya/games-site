// Small drawing helpers for the interface: text, flat buttons, panels, icons. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

// Text that never goes below ~11 css px.
export const minUnits = () => 11.5 / Math.max(0.2, host.px);

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  ctx.font = `${o.weight ?? 600} ${Math.max(size, minUnits())}px ${o.font ?? DISPLAY}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  if (o.maxW && ctx.measureText(s).width > o.maxW) {                      // squeeze to fit rather than overflow
    const k = o.maxW / ctx.measureText(s).width; ctx.font = `${o.weight ?? 600} ${Math.max(size * k, minUnits())}px ${o.font ?? DISPLAY}`;
  }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(12,20,51,0.85)'; ctx.strokeText(s, x, y); }
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

// Lacquered buttons: a thick darker edge underneath (depth), a body with a top-lit gradient, a thin bright rim and a pressed state that
// sinks onto its edge. kind: primary (pink), ghost (dark enamel), quiet (soft slate), on (teal when a toggle is on), gold, disabled.
const LAC = {
  primary: ['#ff7aa9', '#ff4f8b', '#d92a69', '#8e1241'], ghost: ['#32457f', '#233669', '#182750', '#0c1433'], quiet: ['#4a5b92', '#38497f', '#2a3a6a', '#141f45'],
  on: ['#5ee6e0', '#25c7c2', '#16a3a0', '#0a5f63'], gold: ['#ffe57a', '#ffd23f', '#e8aa16', '#8f5f06'], disabled: ['#2b3560', '#222c52', '#1a2243', '#0c1433'],
};
export function mixHex(a, b, k) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), m = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k); return `rgb(${m(16)},${m(8)},${m(0)})`; }
export function lacquer(ctx, r, rad, c, o = {}) {
  const d = o.depth ?? Math.max(4, Math.min(9, r.h * 0.09)), p = o.pressed ? d * 0.7 : 0;
  ctx.save();
  if (!o.noShadow) { ctx.fillStyle = 'rgba(6,10,30,0.42)'; rrect(ctx, { x: r.x + 2, y: r.y + d + 5, w: r.w - 4, h: r.h }, rad); ctx.fill(); }
  ctx.fillStyle = c[3]; rrect(ctx, { x: r.x, y: r.y + d - p * 0.2, w: r.w, h: r.h }, rad); ctx.fill();               // the edge
  const body = { x: r.x, y: r.y + p, w: r.w, h: r.h };
  const g = ctx.createLinearGradient(0, body.y, 0, body.y + body.h);
  g.addColorStop(0, c[0]); g.addColorStop(0.5, c[1]); g.addColorStop(1, c[2]);
  ctx.fillStyle = g; rrect(ctx, body, rad); ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.38)';                                                    // lit rim, brighter on top
  ctx.beginPath(); ctx.roundRect(body.x + 1, body.y + 1, body.w - 2, body.h - 2, Math.max(2, rad - 1)); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(body.x + 0.5, body.y + 0.5, body.w - 1, body.h - 1, rad); ctx.stroke();
  ctx.restore();
  return body;
}

export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(26, r.h * 0.34), size = o.size ?? Math.min(34, r.h * 0.4);
  ctx.save();
  const col = LAC[kind] ?? LAC.ghost;
  const body = lacquer(ctx, r, rad, col, { pressed: !!o.press, noShadow: o.noShadow });
  const dark = kind === 'on' || kind === 'gold';
  const tcol = kind === 'disabled' ? 'rgba(255,248,236,0.42)' : dark ? '#14204a' : '#fff';
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14, ry = body.y;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, ry + r.h / 2, r.h * 0.36, tcol);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  if (!dark && kind !== 'disabled') { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowOffsetY = 2; ctx.shadowBlur = 3; txt(ctx, label, cx, ry + r.h * (hasSub ? 0.37 : 0.5), size, tcol, { align: 'center', weight: 700, maxW: r.w - pad - 14 }); ctx.restore(); }
  else txt(ctx, label, cx, ry + r.h * (hasSub ? 0.37 : 0.5), size, tcol, { align: 'center', weight: 700, maxW: r.w - pad - 14 });
  if (hasSub) txt(ctx, o.sub, cx, ry + r.h * 0.72, size * 0.6, dark ? 'rgba(20,32,74,0.8)' : 'rgba(255,255,255,0.82)', { align: 'center', weight: 500, maxW: r.w - pad - 14 });
  ctx.restore();
}

// Enamel plaques: dark lacquered slate with a bevel, a pink hairline and a soft shadow.
export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  if (!o.noShadow) { ctx.fillStyle = 'rgba(4,8,26,0.4)'; rrect(ctx, { x: r.x + 2, y: r.y + 6, w: r.w - 4, h: r.h }, rad); ctx.fill(); }
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, o.fillTop ?? 'rgba(34,48,98,0.9)'); g.addColorStop(1, o.fill ?? 'rgba(14,22,58,0.92)');
  ctx.fillStyle = g; rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = o.stroke ?? 'rgba(255,248,236,0.26)'; rrect(ctx, r, rad); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,79,139,0.55)';
  ctx.beginPath(); ctx.roundRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8, Math.max(2, rad - 4)); ctx.stroke();
  ctx.restore();
}

// Icons: pause, play, back, plus, minus, bulb (hint), restart, ladder (levels), eye (watch).
export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'back') { ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.35, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'plus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'minus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke(); }
  else if (name === 'bulb') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.15, s * 0.45, Math.PI * 0.8, Math.PI * 2.2); ctx.lineTo(cx + s * 0.2, cy + s * 0.4); ctx.lineTo(cx - s * 0.2, cy + s * 0.4); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.18, cy + s * 0.62); ctx.lineTo(cx + s * 0.18, cy + s * 0.62); ctx.stroke(); }
  else if (name === 'restart') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, -0.4, Math.PI * 1.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.55, cy - s * 0.55); ctx.lineTo(cx + s * 0.55, cy - s * 0.05); ctx.lineTo(cx + s * 0.05, cy - s * 0.15); ctx.stroke(); }
  else if (name === 'eye') { ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.7, s * 0.4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.17, 0, Math.PI * 2); ctx.fill(); }
  else if (name === 'ladder') { ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy - s * 0.6); ctx.lineTo(cx - s * 0.5, cy + s * 0.6); ctx.moveTo(cx + s * 0.5, cy - s * 0.6); ctx.lineTo(cx + s * 0.5, cy + s * 0.6); for (let i = -1; i <= 1; i++) { ctx.moveTo(cx - s * 0.5, cy + i * s * 0.4); ctx.lineTo(cx + s * 0.5, cy + i * s * 0.4); } ctx.stroke(); }
  ctx.restore();
}

// A rounded chip with text.
export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `${o.weight ?? 700} ${Math.max(size, minUnits())}px ${DISPLAY}`;
  const w = ctx.measureText(label).width + size * 1.1, h = size * 1.7;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.fillStyle = o.fill ?? 'rgba(14,22,58,0.62)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.roundRect(rx + 2, y - h / 2 + 2, w - 4, h * 0.42, h * 0.2); ctx.fill();
  if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 700 });
  return { x: rx, y: y - h / 2, w, h };
}

export { PAL, UI, DISPLAY, rgba };
