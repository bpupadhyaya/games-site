// Small drawing helpers for the interface: text, flat buttons, panels, stars. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

export const minUnits = () => 11.5 / Math.max(0.2, host.px);          // text never goes below ~11 css px

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  const fam = o.font ?? UI, wt = o.weight ?? 600;
  let sz = Math.max(size, minUnits());
  ctx.font = `${wt} ${sz}px ${fam}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle';
  if (o.maxW && ctx.measureText(s).width > o.maxW) { sz = Math.max(sz * o.maxW / ctx.measureText(s).width, minUnits() * 0.9); ctx.font = `${wt} ${sz}px ${fam}`; }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(20,6,36,0.85)'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
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

export const rrect = (ctx, r, rad) => { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); };

// kind: primary (saffron), turq, ghost (outline), quiet (soft fill), on, danger, disabled
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(24, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.42);
  ctx.save();
  if (!o.noShadow && kind !== 'disabled') { ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, { x: r.x, y: r.y + 4, w: r.w, h: r.h }, rad); ctx.fill(); }
  let fill = 'rgba(255,255,255,0.1)', stroke = 'rgba(255,255,255,0.28)', col = PAL.text;
  if (kind === 'primary') { const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#ffd36a'); g.addColorStop(1, '#e8962a'); fill = g; stroke = null; col = '#2a1606'; }
  else if (kind === 'turq') { const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#46e0cf'); g.addColorStop(1, '#1a9a8a'); fill = g; stroke = null; col = '#062a26'; }
  else if (kind === 'quiet') { fill = 'rgba(255,230,255,0.14)'; stroke = null; }
  else if (kind === 'on') { fill = rgba(PAL.teal, 0.3); stroke = PAL.teal; }
  else if (kind === 'danger') { fill = 'rgba(255,125,143,0.16)'; stroke = PAL.miss; }
  else if (kind === 'disabled') { fill = 'rgba(255,255,255,0.05)'; stroke = null; col = 'rgba(255,255,255,0.3)'; }
  ctx.fillStyle = fill; rrect(ctx, r, rad); ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2.5; ctx.stroke(); }
  const cy = r.y + r.h / 2;
  if (o.sub) { txt(ctx, label, r.x + r.w / 2, cy - size * 0.28, size, col, { align: 'center', weight: 800, maxW: r.w - 28 }); txt(ctx, o.sub, r.x + r.w / 2, cy + size * 0.72, size * 0.58, kind === 'primary' || kind === 'turq' ? 'rgba(0,0,0,0.65)' : PAL.dim, { align: 'center', weight: 500, maxW: r.w - 28 }); }
  else txt(ctx, label, r.x + r.w / 2 + (o.icon ? size * 0.5 : 0), cy, size, col, { align: 'center', weight: 800, maxW: r.w - 28 - (o.icon ? size : 0) });
  if (o.icon === 'back') { ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; const ix = r.x + r.w / 2 - ctx.measureText(label).width / 2 - size * 0.6; ctx.beginPath(); ctx.moveTo(ix + 8, cy - 11); ctx.lineTo(ix, cy); ctx.lineTo(ix + 8, cy + 11); ctx.stroke(); }
  ctx.restore();
}

export function panel(ctx, r, o = {}) {
  ctx.save();
  ctx.fillStyle = o.fill ?? 'rgba(20,8,44,0.78)'; rrect(ctx, r, o.rad ?? 22); ctx.fill();
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}

export function star(ctx, x, y, r, on, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.46 : r; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
  if (on) { const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#ffe58a'); g.addColorStop(1, '#e8962a'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(80,40,0,0.7)'; ctx.lineWidth = r * 0.08; ctx.stroke(); }
  else { ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = r * 0.06; ctx.stroke(); }
  ctx.restore();
}

export const display = (size) => ({ font: DISPLAY, weight: 800, size });
