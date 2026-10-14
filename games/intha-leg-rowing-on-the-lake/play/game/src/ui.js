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

// Lacquered buttons: a lit top edge, a darker bottom edge, a thin brass rim on the dark kinds and a pressed state (lower + dimmer).
// kind: primary (saffron), ghost (dark glass), quiet (soft glass), on (teal), danger, gold, disabled.
const BTN = {
  primary: ['#ffb04a', '#ee7d1c', '#b9540a'], on: ['#5fe0cc', '#2fb6a3', '#1b7f72'], danger: ['#e0546c', '#b9304a', '#7a1a30'], gold: ['#ffe39a', '#f0b94a', '#b9801f'],
  ghost: ['rgba(34,86,108,0.92)', 'rgba(14,52,72,0.92)', 'rgba(8,34,50,0.94)'], quiet: ['rgba(56,118,138,0.9)', 'rgba(28,78,98,0.9)', 'rgba(16,52,70,0.92)'], disabled: ['rgba(40,60,70,0.7)', 'rgba(30,48,58,0.7)', 'rgba(24,38,46,0.7)'],
};
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(24, r.h * 0.32), size = o.size ?? Math.min(34, r.h * 0.4);
  ctx.save();
  const dy = o.press ? 3 : 0, rr = { x: r.x, y: r.y + dy, w: r.w, h: r.h - dy * 0.0 };
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,10,20,0.42)'; rrect(ctx, { x: r.x + 1, y: r.y + 5 - dy, w: r.w - 2, h: r.h }, rad); ctx.fill(); }
  const c = BTN[kind] ?? BTN.ghost, g = ctx.createLinearGradient(0, rr.y, 0, rr.y + rr.h);
  g.addColorStop(0, c[0]); g.addColorStop(0.55, c[1]); g.addColorStop(1, c[2]);
  ctx.fillStyle = g; rrect(ctx, rr, rad); ctx.fill();
  // lit top edge + dark lower edge (a bevel) clipped inside the shape
  ctx.save(); rrect(ctx, rr, rad); ctx.clip();
  const hl = ctx.createLinearGradient(0, rr.y, 0, rr.y + rr.h * 0.5); hl.addColorStop(0, 'rgba(255,255,255,0.30)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(rr.x, rr.y, rr.w, rr.h * 0.5);
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(rr.x, rr.y + rr.h - 4, rr.w, 4);
  ctx.restore();
  const rim = kind === 'primary' || kind === 'gold' ? 'rgba(255,236,190,0.65)' : kind === 'on' ? 'rgba(210,255,246,0.55)' : 'rgba(235,205,140,0.5)';
  ctx.lineWidth = 2; ctx.strokeStyle = rim; rrect(ctx, { x: rr.x + 1, y: rr.y + 1, w: rr.w - 2, h: rr.h - 2 }, rad); ctx.stroke();
  if (o.press) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; rrect(ctx, rr, rad); ctx.fill(); }
  const dark = kind === 'gold' || kind === 'on';
  const col = kind === 'disabled' ? 'rgba(255,240,220,0.4)' : dark ? '#10202a' : '#fff';
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, rr.y + r.h / 2, r.h * 0.42, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  txt(ctx, label, cx, rr.y + r.h * (hasSub ? 0.36 : 0.5), size, col, { align: 'center', weight: 700, maxW: r.w - pad - 14, stroke: dark || kind === 'disabled' ? 0 : 4, strokeColor: 'rgba(10,24,34,0.55)' });
  if (hasSub) txt(ctx, o.sub, cx, rr.y + r.h * 0.72, size * 0.6, dark ? 'rgba(10,32,42,0.8)' : 'rgba(255,255,255,0.82)', { align: 'center', weight: 500, maxW: r.w - pad - 14 });
  ctx.restore();
}

// Panels: smoked-lacquer plaques with a brass hairline and a soft top sheen (the same look over the 3D lake and the flat fallback).
export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,8,16,0.35)'; rrect(ctx, { x: r.x + 1, y: r.y + 4, w: r.w - 2, h: r.h }, rad); ctx.fill(); }
  const am = o.fill && /rgba?\([^)]*,\s*([\d.]+)\)/.exec(o.fill), al = am ? Number(am[1]) : 0.88;
  { const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, `rgba(22,76,98,${Math.min(1, al + 0.04)})`); g.addColorStop(1, `rgba(6,28,44,${Math.min(1, al + 0.06)})`); ctx.fillStyle = g; rrect(ctx, r, rad); ctx.fill(); }
  ctx.save(); rrect(ctx, r, rad); ctx.clip();
  const sh = ctx.createLinearGradient(0, r.y, 0, r.y + Math.min(r.h, 46)); sh.addColorStop(0, 'rgba(255,255,255,0.14)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(r.x, r.y, r.w, Math.min(r.h, 46));
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = o.stroke && o.stroke !== 'rgba(255,230,200,0.18)' ? o.stroke : 'rgba(232,200,130,0.5)'; rrect(ctx, r, rad); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.1)'; rrect(ctx, { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }, Math.max(2, rad - 3)); ctx.stroke();
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
  ctx.fillStyle = o.fill ?? 'rgba(255,240,220,0.12)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill();
  if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 700 });
  return { x: rx, y: y - h / 2, w, h };
}

export { PAL, UI, DISPLAY, rgba };

