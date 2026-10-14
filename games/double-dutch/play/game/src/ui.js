// Small drawing helpers for the interface: text, flat buttons, panels, icons. Pure canvas.
import { PAL, UI, DISPLAY, BODY, rgba } from './art.js';
import { host } from './layout.js';

// Text that never goes below ~11 css px.
export const minUnits = () => 11.5 / Math.max(0.2, host.px);

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  ctx.font = `${o.weight ?? 600} ${Math.max(size, minUnits())}px ${o.font ?? DISPLAY}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  if (o.maxW && ctx.measureText(s).width > o.maxW) {                      // squeeze to fit rather than overflow
    const k = o.maxW / ctx.measureText(s).width; ctx.font = `${o.weight ?? 600} ${Math.max(size * k, minUnits())}px ${o.font ?? DISPLAY}`;
  }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(15,7,32,0.9)'; ctx.strokeText(s, x, y); }
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

// Keycap buttons: a lit face on a darker edge (real depth, pressed state sinks into the edge), a drop shadow and a fine rim light.
// kind: primary (orange), ghost (plum), quiet (soft plum), on (mint when a toggle is on), gold, disabled.
const KEY = {
  primary: { top: '#ffb24d', bot: '#ff7a12', edge: '#a8470a', rim: 'rgba(255,240,205,0.85)' },
  ghost: { top: '#3d2a6e', bot: '#22143f', edge: '#0c0620', rim: 'rgba(255,214,150,0.5)' },
  quiet: { top: '#4a3a7a', bot: '#2c1f52', edge: '#0f0824', rim: 'rgba(255,255,255,0.4)' },
  on: { top: '#6ff3cc', bot: '#22c795', edge: '#0f7a5c', rim: 'rgba(255,255,255,0.8)' },
  gold: { top: '#ffdb7a', bot: '#ffb61f', edge: '#9a6a05', rim: 'rgba(255,255,230,0.85)' },
  disabled: { top: '#2b2144', bot: '#1d1532', edge: '#0c0720', rim: 'rgba(255,255,255,0.18)' },
};
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', K = KEY[kind] ?? KEY.ghost, rad = o.rad ?? Math.min(24, r.h * 0.32), size = o.size ?? Math.min(34, r.h * 0.4);
  const edge = Math.max(3, Math.min(7, r.h * 0.09)), sink = o.press ? edge * 0.8 : 0;
  const face = { x: r.x, y: r.y + sink, w: r.w, h: r.h - edge };
  ctx.save();
  if (!o.noShadow) { ctx.fillStyle = 'rgba(4,1,12,0.45)'; rrect(ctx, { x: r.x + 1, y: r.y + edge + 3, w: r.w - 2, h: r.h - edge }, rad); ctx.fill(); }
  ctx.fillStyle = K.edge; rrect(ctx, { x: r.x, y: r.y + edge - sink * 0.0, w: r.w, h: r.h - edge }, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, face.y, 0, face.y + face.h); g.addColorStop(0, K.top); g.addColorStop(1, K.bot);
  ctx.fillStyle = g; rrect(ctx, face, rad); ctx.fill();
  // fine rim light along the top edge and a hairline dark outline (no gloss shape)
  ctx.lineWidth = 1.5; ctx.strokeStyle = K.rim; ctx.beginPath(); ctx.roundRect(face.x + 1.5, face.y + 1.5, face.w - 3, face.h - 3, Math.max(2, rad - 1.5)); ctx.save(); ctx.clip(); ctx.beginPath(); ctx.rect(face.x, face.y, face.w, Math.max(4, face.h * 0.34)); ctx.clip(); ctx.beginPath(); ctx.roundRect(face.x + 1.5, face.y + 1.5, face.w - 3, face.h - 3, Math.max(2, rad - 1.5)); ctx.stroke(); ctx.restore();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(8,3,20,0.7)'; rrect(ctx, face, rad); ctx.stroke();
  const dark = kind === 'on' || kind === 'gold' || kind === 'primary';
  const col = kind === 'disabled' ? 'rgba(255,244,228,0.42)' : dark ? '#1a0f33' : PAL.text;
  const hasSub = !!o.sub, pad = o.icon ? face.h * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, face.x + face.h * 0.5, face.y + face.h / 2, face.h * 0.38, col);
  const cx = face.x + (o.icon ? face.h * 0.9 + (face.w - face.h * 0.9) / 2 : face.w / 2);
  txt(ctx, label, cx, face.y + face.h * (hasSub ? 0.37 : 0.5), size, col, { align: 'center', weight: 700, maxW: face.w - pad - 14 });
  if (hasSub) txt(ctx, o.sub, cx, face.y + face.h * 0.72, size * 0.6, dark ? 'rgba(26,15,51,0.8)' : PAL.dim, { align: 'center', weight: 500, maxW: face.w - pad - 14 });
  ctx.restore();
}

// Panels: smoked plum glass on a thin brass-lit rim with a soft drop shadow.
export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  ctx.shadowColor = 'rgba(4,1,12,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
  ctx.fillStyle = o.fill ?? 'rgba(26,15,51,0.8)'; rrect(ctx, r, rad); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, 'rgba(255,255,255,0.09)'); g.addColorStop(0.22, 'rgba(255,255,255,0.02)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = g; rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = o.stroke ?? 'rgba(255,208,140,0.38)'; rrect(ctx, r, rad); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(6,2,16,0.6)'; rrect(ctx, { x: r.x + 2.5, y: r.y + 2.5, w: r.w - 5, h: r.h - 5 }, Math.max(2, rad - 2.5)); ctx.stroke();
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
  ctx.save(); ctx.shadowColor = 'rgba(4,1,12,0.45)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; ctx.fillStyle = o.fill ?? 'rgba(26,15,51,0.7)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill(); ctx.restore();
  { const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.2)'); ctx.fillStyle = g; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill(); }
  if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 700 });
  return { x: rx, y: y - h / 2, w, h };
}

export { PAL, UI, DISPLAY, rgba };
