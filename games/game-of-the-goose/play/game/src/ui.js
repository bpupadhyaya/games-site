// Small drawing helpers for the interface: text, flat buttons, panels, icons. Pure canvas.
import { PAL, UI, DISPLAY } from './art.js';
import { host } from './layout.js';
import { v3 } from './v3.js';

export const minUnits = () => 11.5 / Math.max(0.2, host.px);     // text never goes below ~11 css px

// Text in the book face (Cormorant Garamond Bold) or the display face (Cinzel). Cormorant has a small x-height, so sizes are lifted a little.
export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  const fam = o.font ?? UI, sz = Math.max(size * (fam === UI ? 1.1 : 1), minUnits());
  ctx.font = `700 ${sz}px ${fam}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  let w = ctx.measureText(s).width, k = 1;
  if (o.maxW && w > o.maxW) { k = o.maxW / w; ctx.font = `700 ${Math.max(sz * k, minUnits())}px ${fam}`; }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(20,10,2,0.85)'; ctx.strokeText(s, x, y); }
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

// Flat buttons. kind: primary (oxblood + gold rule), ghost (outline), quiet (soft fill), on (verdigris), parch (paper), disabled.
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(20, r.h * 0.28), size = o.size ?? Math.min(34, r.h * 0.4);
  ctx.save();
  const flat = !v3.on || o.v3rect === null;      // with the 3D layer on, the lacquered 3D button is drawn behind this text
  if (!flat) { const vr = o.v3rect ?? r; v3.buttons.push({ r: { x: vr.x, y: vr.y, w: vr.w, h: vr.h }, rad, kind, hot: !!o.hot }); }
  if (flat && !o.noShadow && kind !== 'disabled') { ctx.fillStyle = 'rgba(0,0,0,0.32)'; rrect(ctx, { x: r.x, y: r.y + 4, w: r.w, h: r.h }, rad); ctx.fill(); }
  const fills = { primary: '#8f2a22', ghost: 'rgba(247,233,200,0.07)', quiet: 'rgba(247,233,200,0.14)', on: '#2f7a6e', gold: '#e3ae3f', parch: '#efdfb8', disabled: 'rgba(255,255,255,0.05)', danger: '#6a1a1a' };
  if (flat) { ctx.fillStyle = fills[kind] ?? fills.ghost; rrect(ctx, r, rad); ctx.fill(); }
  if (!flat) { /* 3D plate */ }
  else if (kind === 'primary') { ctx.lineWidth = 2.5; ctx.strokeStyle = '#e3ae3f'; rrect(ctx, r, rad); ctx.stroke(); }
  else if (kind === 'ghost' || kind === 'quiet' || kind === 'disabled') { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(247,233,200,0.3)'; rrect(ctx, r, rad); ctx.stroke(); }
  else if (kind === 'parch') { ctx.lineWidth = 2; ctx.strokeStyle = PAL.ink; rrect(ctx, r, rad); ctx.stroke(); }
  if (o.hot) { ctx.lineWidth = 4; ctx.strokeStyle = PAL.goldHi; rrect(ctx, { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 }, rad + 3); ctx.stroke(); }
  const dark = kind === 'gold' || kind === 'parch';
  const col = kind === 'disabled' ? 'rgba(247,233,200,0.4)' : dark ? PAL.ink : kind === 'primary' || kind === 'on' ? '#fff6dc' : PAL.text;
  if (o.stack && o.icon) {      // icon over a small label (compact tile)
    icon(ctx, o.icon, r.x + r.w / 2, r.y + r.h * 0.38, Math.min(r.h * 0.26, r.w * 0.2), col);
    txt(ctx, label, r.x + r.w / 2, r.y + r.h * 0.79, size, col, { align: 'center', maxW: r.w - 8 });
    ctx.restore(); return;
  }
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, r.y + r.h / 2, r.h * 0.4, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  const lsz = hasSub ? Math.min(size, r.h * 0.34) : size;
  txt(ctx, label, cx, r.y + r.h * (hasSub ? 0.34 : 0.5), lsz, col, { align: 'center', maxW: r.w - pad - 14 });
  if (hasSub) txt(ctx, o.sub, cx, r.y + r.h * 0.74, lsz * 0.66, dark ? 'rgba(42,24,9,0.8)' : o.subColor ?? PAL.dim, { align: 'center', maxW: r.w - pad - 14 });
  ctx.restore();
}

export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 20;
  if (v3.on) { v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad, kind: o.kind ?? 'slate' }); ctx.restore(); return; }
  ctx.fillStyle = o.fill ?? 'rgba(24,14,6,0.72)'; rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = o.stroke ?? 'rgba(227,174,63,0.35)'; rrect(ctx, r, rad); ctx.stroke();
  ctx.restore();
}

// Icons: pause, play, back, plus, minus, restart, bulb (hint), eye (watch), dice, menu.
export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.17); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'back') { ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.35, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'plus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'minus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke(); }
  else if (name === 'restart') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, -0.4, Math.PI * 1.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.55, cy - s * 0.55); ctx.lineTo(cx + s * 0.55, cy - s * 0.05); ctx.lineTo(cx + s * 0.05, cy - s * 0.15); ctx.stroke(); }
  else if (name === 'bulb') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.15, s * 0.5, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.22, cy + s * 0.55); ctx.lineTo(cx + s * 0.22, cy + s * 0.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.15, cy + s * 0.78); ctx.lineTo(cx + s * 0.15, cy + s * 0.78); ctx.stroke(); }
  else if (name === 'eye') { ctx.beginPath(); ctx.moveTo(cx - s * 0.75, cy); ctx.quadraticCurveTo(cx, cy - s * 0.85, cx + s * 0.75, cy); ctx.quadraticCurveTo(cx, cy + s * 0.85, cx - s * 0.75, cy); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.24, 0, Math.PI * 2); ctx.fill(); }
  else if (name === 'dice') { ctx.beginPath(); ctx.roundRect(cx - s * 0.6, cy - s * 0.6, s * 1.2, s * 1.2, s * 0.22); ctx.stroke(); for (const [px, py] of [[-0.25, -0.25], [0.25, 0.25], [0, 0]]) { ctx.beginPath(); ctx.arc(cx + px * s, cy + py * s, s * 0.1, 0, Math.PI * 2); ctx.fill(); } }
  else if (name === 'book') { ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.5); ctx.quadraticCurveTo(cx - s * 0.45, cy - s * 0.75, cx - s * 0.85, cy - s * 0.55); ctx.lineTo(cx - s * 0.85, cy + s * 0.55); ctx.quadraticCurveTo(cx - s * 0.45, cy + s * 0.35, cx, cy + s * 0.6); ctx.quadraticCurveTo(cx + s * 0.45, cy + s * 0.35, cx + s * 0.85, cy + s * 0.55); ctx.lineTo(cx + s * 0.85, cy - s * 0.55); ctx.quadraticCurveTo(cx + s * 0.45, cy - s * 0.75, cx, cy - s * 0.5); ctx.moveTo(cx, cy - s * 0.5); ctx.lineTo(cx, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'rules') { ctx.beginPath(); ctx.roundRect(cx - s * 0.55, cy - s * 0.75, s * 1.1, s * 1.5, s * 0.14); ctx.stroke(); for (const dy of [-0.35, 0, 0.35]) { ctx.beginPath(); ctx.moveTo(cx - s * 0.3, cy + dy * s); ctx.lineTo(cx + s * 0.3, cy + dy * s); ctx.stroke(); } }
  else if (name === 'info') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.8, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - s * 0.38, s * 0.1, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.1); ctx.lineTo(cx, cy + s * 0.45); ctx.stroke(); }
  else if (name === 'gear') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.38, 0, Math.PI * 2); ctx.stroke(); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * s * 0.55, cy + Math.sin(a) * s * 0.55); ctx.lineTo(cx + Math.cos(a) * s * 0.82, cy + Math.sin(a) * s * 0.82); ctx.stroke(); } }
  else if (name === 'menu') { for (const dy of [-0.45, 0, 0.45]) { ctx.beginPath(); ctx.moveTo(cx - s * 0.6, cy + dy * s); ctx.lineTo(cx + s * 0.6, cy + dy * s); ctx.stroke(); } }
  ctx.restore();
}

export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `700 ${Math.max(size * 1.1, minUnits())}px ${UI}`;
  const w = ctx.measureText(label).width + size * 1.1, h = size * 1.7;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.fillStyle = o.fill ?? 'rgba(247,233,200,0.12)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill();
  if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center' });
  return { x: rx, y: y - h / 2, w, h };
}

export { PAL, UI, DISPLAY };
