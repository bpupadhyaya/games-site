// Interface helpers: text, flat buttons, panels, icons, chips. Pure canvas.
import { PAL, UI, DISPLAY, rr, TAU } from './art.js';
import { host } from './layout.js';
import { v3 } from './v3.js';

export const minUnits = () => 11.5 / Math.max(0.2, host.px);     // text never goes below ~11 css px

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  const fam = o.font ?? UI, sz = Math.max(size, minUnits());
  ctx.font = `${fam === DISPLAY ? 400 : 600} ${sz}px ${fam}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  const w = ctx.measureText(s).width;
  if (o.maxW && w > o.maxW) ctx.font = `${fam === DISPLAY ? 400 : 600} ${Math.max(sz * (o.maxW / w), minUnits())}px ${fam}`;
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(8,10,14,0.85)'; ctx.strokeText(s, x, y); }
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

export const rrect = (ctx, r, rad) => rr(ctx, r.x, r.y, r.w, r.h, rad);

// Flat buttons. kind: primary (jade), ghost, quiet, gold, parch, disabled, danger.
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(20, r.h * 0.28), size = o.size ?? Math.min(34, r.h * 0.4);
  ctx.save();
  const solid = v3.on && !o.flat;
  if (solid) v3.buttons.push({ r, rad: Math.min(rad, r.h * 0.34), kind, hot: !!o.hot, small: r.h < 70, ov: v3.scrim > 0 });
  if (!solid && !o.noShadow && kind !== 'disabled') { ctx.fillStyle = 'rgba(0,0,0,0.36)'; rrect(ctx, { x: r.x, y: r.y + 4, w: r.w, h: r.h }, rad); ctx.fill(); }
  const fills = { primary: '#1f8a62', ghost: 'rgba(244,236,216,0.07)', quiet: 'rgba(244,236,216,0.14)', gold: '#e8b645', parch: '#f1e4c6', disabled: 'rgba(255,255,255,0.05)', danger: '#8a2a1a', sel: '#3a6fd0' };
  if (!solid) { ctx.fillStyle = fills[kind] ?? fills.ghost; rrect(ctx, r, rad); ctx.fill(); }
  if (solid) { /* the 3D plaque is the body */ }
  else if (kind === 'primary') { ctx.lineWidth = 2.5; ctx.strokeStyle = PAL.goldHi; rrect(ctx, r, rad); ctx.stroke(); }
  else if (kind === 'ghost' || kind === 'quiet' || kind === 'disabled') { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,236,216,0.3)'; rrect(ctx, r, rad); ctx.stroke(); }
  else if (kind === 'parch') { ctx.lineWidth = 2; ctx.strokeStyle = PAL.ink; rrect(ctx, r, rad); ctx.stroke(); }
  if (o.hot && !solid) { ctx.lineWidth = 4; ctx.strokeStyle = PAL.goldHi; rrect(ctx, { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 }, rad + 3); ctx.stroke(); }
  const dark = kind === 'gold' || kind === 'parch';
  const col = kind === 'disabled' ? 'rgba(244,236,216,0.4)' : dark ? PAL.ink : '#fffaf0';
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, r.y + r.h / 2, r.h * 0.4, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  const lsz = hasSub ? Math.min(size, r.h * 0.34) : size;
  txt(ctx, label, cx, r.y + r.h * (hasSub ? 0.34 : 0.5), lsz, col, { align: 'center', maxW: r.w - pad - 14 });
  if (hasSub) txt(ctx, o.sub, cx, r.y + r.h * 0.74, lsz * 0.7, dark ? 'rgba(43,26,13,0.82)' : o.subColor ?? 'rgba(255,250,240,0.82)', { align: 'center', maxW: r.w - pad - 14 });
  ctx.restore();
}

export function panel(ctx, r, o = {}) {
  if (v3.on) { v3.panels.push({ r, rad: o.rad ?? 20, kind: o.kind ?? 'slate', ov: v3.scrim > 0 }); return; }
  ctx.save();
  ctx.fillStyle = o.fill ?? 'rgba(12,16,20,0.62)'; rrect(ctx, r, o.rad ?? 20); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = o.stroke ?? 'rgba(232,182,69,0.35)'; rrect(ctx, r, o.rad ?? 20); ctx.stroke();
  ctx.restore();
}

// Icons: pause, play, back, plus, minus, restart, bulb (hint), eye (watch), beans, menu, next.
export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.17); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'back') { ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.35, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'next') { ctx.beginPath(); ctx.moveTo(cx - s * 0.35, cy - s * 0.6); ctx.lineTo(cx + s * 0.35, cy); ctx.lineTo(cx - s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'plus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'minus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke(); }
  else if (name === 'restart') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, -0.4, Math.PI * 1.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.55, cy - s * 0.55); ctx.lineTo(cx + s * 0.55, cy - s * 0.05); ctx.lineTo(cx + s * 0.05, cy - s * 0.15); ctx.stroke(); }
  else if (name === 'bulb') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.15, s * 0.5, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.22, cy + s * 0.55); ctx.lineTo(cx + s * 0.22, cy + s * 0.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.15, cy + s * 0.78); ctx.lineTo(cx + s * 0.15, cy + s * 0.78); ctx.stroke(); }
  else if (name === 'eye') { ctx.beginPath(); ctx.moveTo(cx - s * 0.75, cy); ctx.quadraticCurveTo(cx, cy - s * 0.85, cx + s * 0.75, cy); ctx.quadraticCurveTo(cx, cy + s * 0.85, cx - s * 0.75, cy); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.24, 0, TAU); ctx.fill(); }
  else if (name === 'beans') { for (const [dx, dy, a] of [[-0.35, -0.2, -0.5], [0.35, -0.1, 0.4], [0, 0.45, 0.1]]) { ctx.beginPath(); ctx.ellipse(cx + dx * s, cy + dy * s, s * 0.42, s * 0.26, a, 0, TAU); ctx.stroke(); } }
  else if (name === 'menu') { for (const dy of [-0.45, 0, 0.45]) { ctx.beginPath(); ctx.moveTo(cx - s * 0.6, cy + dy * s); ctx.lineTo(cx + s * 0.6, cy + dy * s); ctx.stroke(); } }
  ctx.restore();
}

export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `600 ${Math.max(size * 1.05, minUnits())}px ${UI}`;
  const w = ctx.measureText(label).width + size * 1.1, h = size * 1.7;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.fillStyle = o.fill ?? 'rgba(244,236,216,0.12)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill();
  if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center' });
  return { x: rx, y: y - h / 2, w, h };
}

export { PAL, UI, DISPLAY };

// A card on a screen (player cards, seat cards, option rows). In 3D it becomes a carved plaque; flat otherwise.
// o: { on (light parchment / lit), ring (seat colour edge), rad }
export function plate(ctx, r, o = {}) {
  const rad = o.rad ?? 14;
  if (v3.on) { v3.panels.push({ r, rad, kind: o.on ? 'plateOn' : 'plateOff', ring: o.ring ?? null }); return; }
  ctx.fillStyle = o.on ? 'rgba(241,228,198,0.96)' : 'rgba(12,16,20,0.66)'; rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = o.lw ?? (o.on ? 3.5 : 1.5); ctx.strokeStyle = o.ring ?? 'rgba(232,182,69,0.3)'; rrect(ctx, r, rad); ctx.stroke();
}
