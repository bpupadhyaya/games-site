// Small drawing helpers for the interface: text, flat buttons, panels, icons. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

export const minUnits = () => 11.5 / Math.max(0.2, host.px);     // text never goes below ~11 css px

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  let sz = Math.max(size, minUnits());
  ctx.font = `${o.weight ?? 600} ${sz}px ${o.font ?? UI}`;
  if (o.maxW) {
    const w = ctx.measureText(s).width;
    if (w > o.maxW) { sz = Math.max(sz * o.maxW / w, minUnits()); ctx.font = `${o.weight ?? 600} ${sz}px ${o.font ?? UI}`; }
  }
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(14,8,28,0.85)'; ctx.strokeText(s, x, y); }
  ctx.fillText(s, x, y);
}

// A header title beside a Back button: centred on screen when it clears the button, else centred in the free space to its right, else shrunk to fit.
export function headerTitle(ctx, s, back, S, y, size, o = {}) {
  const left = back.x + back.w + 16, right = S.x + S.w - 12 - (o.rightPad ?? 0), free = right - left;
  ctx.font = `${o.weight ?? 400} ${Math.max(size, minUnits())}px ${o.font ?? UI}`;
  const tw = Math.min(ctx.measureText(s).width, free), mid = S.x + S.w / 2;
  const cx = mid - tw / 2 >= left && mid + tw / 2 <= right ? mid : left + free / 2;
  txt(ctx, s, cx, y, size, o.color ?? PAL.gold, { ...o, align: 'center', maxW: free });
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

// Lacquered buttons with depth: a lit top edge, a darker base, a brass rim and a pressed state (no flat pills).
// kind: primary (saffron lacquer), ghost / quiet (indigo glass with a brass rim), on (teal), danger, gold, disabled.
const BTN = {
  primary: { top: '#ffe08a', mid: '#ffb52e', bot: '#e07a12', rim: '#7a3d00', text: '#2a1400' },
  gold: { top: '#ffe9a0', mid: '#ffc94d', bot: '#d29a2e', rim: '#6a4a00', text: '#06182c' },
  on: { top: '#7ff0e6', mid: '#27c4c0', bot: '#13827f', rim: '#064a48', text: '#06182c' },
  danger: { top: '#ff8a9a', mid: '#d03a5a', bot: '#8a1630', rim: '#4a0816', text: '#fff4de' },
  ghost: { top: 'rgba(52,84,140,0.82)', mid: 'rgba(22,44,88,0.88)', bot: 'rgba(8,20,46,0.92)', rim: 'rgba(255,214,122,0.55)', text: PAL.text },
  quiet: { top: 'rgba(60,100,150,0.86)', mid: 'rgba(26,56,100,0.9)', bot: 'rgba(10,28,56,0.94)', rim: 'rgba(143,240,230,0.6)', text: PAL.text },
  disabled: { top: 'rgba(60,70,90,0.5)', mid: 'rgba(40,48,68,0.55)', bot: 'rgba(24,30,46,0.6)', rim: 'rgba(255,255,255,0.14)', text: 'rgba(255,240,220,0.4)' },
};
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(26, r.h * 0.34), size = o.size ?? Math.min(34, r.h * 0.4);
  const k = BTN[kind] ?? BTN.ghost, dn = o.press ? 3 : 0;
  ctx.save();
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; rrect(ctx, { x: r.x + 2, y: r.y + 6, w: r.w - 4, h: r.h }, rad); ctx.fill(); }
  const y = r.y + dn, R = { x: r.x, y, w: r.w, h: r.h };
  const g = ctx.createLinearGradient(0, y, 0, y + r.h);
  g.addColorStop(0, k.top); g.addColorStop(0.45, k.mid); g.addColorStop(1, k.bot);
  ctx.fillStyle = g; rrect(ctx, R, rad); ctx.fill();
  // lit upper bevel and a soft sheen
  ctx.save(); rrect(ctx, R, rad); ctx.clip();
  const sh = ctx.createLinearGradient(0, y, 0, y + r.h * 0.5); sh.addColorStop(0, 'rgba(255,255,255,0.34)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(R.x, y, R.w, r.h * 0.5);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(R.x, y + r.h - Math.max(3, r.h * 0.08), R.w, Math.max(3, r.h * 0.08));
  ctx.restore();
  ctx.lineWidth = 2.5; ctx.strokeStyle = k.rim; rrect(ctx, R, rad); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.28)'; rrect(ctx, { x: R.x + 2.5, y: y + 2.5, w: R.w - 5, h: R.h - 5 }, Math.max(2, rad - 2.5)); ctx.stroke();
  const col = k.text, dark = kind === 'primary' || kind === 'on' || kind === 'gold';
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, y + r.h / 2, r.h * 0.42, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  txt(ctx, label, cx, y + r.h * (hasSub ? 0.36 : 0.5), size, col, { align: 'center', weight: 800, maxW: r.w - pad - 14, ...(dark ? {} : { stroke: 5, strokeColor: 'rgba(4,10,30,0.55)' }) });
  if (hasSub) txt(ctx, o.sub, cx, y + r.h * 0.72, size * 0.6, dark ? 'rgba(42,20,0,0.78)' : PAL.dim, { align: 'center', weight: 600, maxW: r.w - pad - 14 });
  ctx.restore();
}

// Panels: indigo glass with a double brass hairline and a soft drop shadow.
export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, { x: r.x + 2, y: r.y + 5, w: r.w - 4, h: r.h }, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  if (o.fill) { ctx.fillStyle = o.fill; } else { g.addColorStop(0, 'rgba(18,36,72,0.82)'); g.addColorStop(1, 'rgba(6,16,38,0.86)'); ctx.fillStyle = g; }
  rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = o.stroke ?? 'rgba(255,214,122,0.5)'; rrect(ctx, r, rad); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; rrect(ctx, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, Math.max(2, rad - 4)); ctx.stroke();
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
  else if (name === 'bump') { ctx.beginPath(); ctx.arc(cx - s * 0.35, cy, s * 0.42, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + s * 0.35, cy, s * 0.42, 0, Math.PI * 2); ctx.stroke(); }
  else if (name === 'tap') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.2, 0, Math.PI * 2); ctx.fill(); }
  else if (name === 'hold') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.fillRect(cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.6); }
  ctx.restore();
}

export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `${o.weight ?? 700} ${Math.max(size, minUnits())}px ${UI}`;
  const w = ctx.measureText(label).width + size * 1.1, h = size * 1.7;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.fillStyle = o.fill ?? 'rgba(143,240,230,0.12)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill();
  if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 700 });
  return { x: rx, y: y - h / 2, w, h };
}

export { PAL, UI, DISPLAY, rgba };


// Wrap text with exactly the font txt() will draw it in (txt never goes below ~11 css px), so wrapped lines never overflow.
export function wrapFit(ctx, s, maxW, size, weight = 600, font = UI) {
  const sz = Math.max(size, minUnits());
  ctx.font = `${weight} ${sz}px ${font}`;
  return { lines: wrap(ctx, s, maxW), size: sz };
}
