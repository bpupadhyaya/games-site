// Small drawing helpers for the interface: text, flat buttons, panels, icons, chips. Pure canvas.
import { host } from './layout.js';

export const PAL = {
  ink: '#17110d', text: '#f6ead0', dim: 'rgba(246,234,208,0.62)', gold: '#e8b84a', amber: '#e0a030', lapis: '#3a72c4', turq: '#27a79d', terra: '#c4573a',
  ok: '#86d493', bad: '#ff8a76', warn: '#f2c04c', panel: 'rgba(24,16,11,0.9)', panel2: 'rgba(255,236,200,0.07)', line: 'rgba(255,230,190,0.2)', parch: '#f1e2bf',
};
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const DISPLAY = '"Cinzel", "Trajan Pro", Georgia, serif';
export const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Text never goes below ~11.5 css px.
export const minUnits = () => 11.5 / Math.max(0.2, host.px);

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  const fs = Math.max(size, minUnits()), w = o.weight ?? 600, f = o.font ?? UI;
  ctx.font = `${w} ${fs}px ${f}`; ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  let size2 = fs;
  if (o.maxW && ctx.measureText(s).width > o.maxW) { size2 = Math.max(fs * o.maxW / ctx.measureText(s).width, minUnits() * 0.85); ctx.font = `${w} ${size2}px ${f}`; }
  if (o.maxW && ctx.measureText(s).width > o.maxW + 1) { let t = s; while (t.length > 2 && ctx.measureText(t + '\u2026').width > o.maxW) t = t.slice(0, -1); s = t.trimEnd() + '\u2026'; }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(14,8,4,0.85)'; ctx.strokeText(s, x, y); }
  ctx.fillText(s, x, y);
  return size2;
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
export const rrect = (ctx, r, rad) => { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); };

// Flat buttons. kind: primary (amber), ghost (outline), quiet (soft fill), on (teal), danger, gold, disabled.
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(22, r.h * 0.3), size = o.size ?? Math.min(32, r.h * 0.4);
  ctx.save();
  if (!o.noShadow && kind !== 'disabled') { ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, { x: r.x, y: r.y + 4, w: r.w, h: r.h }, rad); ctx.fill(); }
  const fills = { primary: '#e0a030', ghost: 'rgba(255,240,215,0.08)', quiet: 'rgba(255,240,215,0.15)', on: '#27a79d', danger: '#b9304a', gold: '#e8b84a', disabled: 'rgba(255,255,255,0.05)', lapis: '#2f66b8', menu: 'rgba(26,16,10,0.82)' };
  ctx.fillStyle = fills[kind] ?? fills.ghost; rrect(ctx, r, rad); ctx.fill();
  if (kind === 'menu') { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(232,184,74,0.45)'; rrect(ctx, r, rad); ctx.stroke(); }
  if (kind === 'ghost' || kind === 'quiet' || kind === 'disabled') { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,190,0.3)'; rrect(ctx, r, rad); ctx.stroke(); }
  if (o.glow) { ctx.lineWidth = 4; ctx.strokeStyle = `rgba(255,214,110,${0.55 + 0.4 * Math.sin((o.t ?? 0) * 5)})`; rrect(ctx, { x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8 }, rad + 4); ctx.stroke(); }
  if (o.press) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; rrect(ctx, r, rad); ctx.fill(); }
  const dark = kind === 'primary' || kind === 'on' || kind === 'gold';
  const col = kind === 'disabled' ? 'rgba(255,240,215,0.38)' : kind === 'primary' || kind === 'gold' || kind === 'on' ? '#1d1209' : kind === 'danger' || kind === 'lapis' ? '#fff' : PAL.text;
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, r.y + r.h / 2, r.h * 0.34, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  txt(ctx, label, cx, r.y + r.h * (hasSub ? 0.38 : 0.5), size, col, { align: 'center', weight: 700, maxW: r.w - pad - 12 });
  if (hasSub) txt(ctx, o.sub, cx, r.y + r.h * 0.72, size * 0.62, dark ? 'rgba(30,18,9,0.78)' : PAL.dim, { align: 'center', weight: 600, maxW: r.w - pad - 12 });
  ctx.restore();
}
export function panel(ctx, r, o = {}) {
  ctx.save(); const rad = o.rad ?? 22;
  ctx.fillStyle = o.fill ?? PAL.panel; rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = o.stroke ?? PAL.line; rrect(ctx, r, rad); ctx.stroke(); ctx.restore();
}
export function bar(ctx, r, v, col, bg = 'rgba(255,255,255,0.12)') {
  ctx.save(); ctx.fillStyle = bg; rrect(ctx, r, r.h / 2); ctx.fill();
  const w = Math.max(r.h, r.w * Math.max(0, Math.min(1, v))); if (v > 0.001) { ctx.fillStyle = col; rrect(ctx, { x: r.x, y: r.y, w, h: r.h }, r.h / 2); ctx.fill(); } ctx.restore();
}
export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `${o.weight ?? 700} ${Math.max(size, minUnits())}px ${UI}`;
  const iw = o.icon ? size * 1.4 : 0, w = ctx.measureText(label).width + size * 1.1 + iw, h = size * 1.75;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.fillStyle = o.fill ?? 'rgba(20,12,8,0.62)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill();
  if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  if (o.icon) icon(ctx, o.icon, rx + size * 0.95, y, size * 0.5, o.color ?? PAL.text);
  txt(ctx, label, rx + iw + (w - iw) / 2, y + size * 0.03, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 700 });
  return { x: rx, y: y - h / 2, w, h };
}

// Icons (line style): pause play back plus minus map book bulb coin water food camel guard rest speak news sun gear check lock caret skip
export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.2, s * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const L = (...pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(cx + p[0] * s, cy + p[1] * s) : ctx.moveTo(cx + p[0] * s, cy + p[1] * s))); ctx.stroke(); };
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'back') L([0.35, -0.6], [-0.35, 0], [0.35, 0.6]);
  else if (name === 'plus') { L([-0.55, 0], [0.55, 0]); L([0, -0.55], [0, 0.55]); }
  else if (name === 'minus') L([-0.55, 0], [0.55, 0]);
  else if (name === 'skip') { ctx.beginPath(); ctx.moveTo(cx - s * 0.6, cy - s * 0.55); ctx.lineTo(cx + s * 0.1, cy); ctx.lineTo(cx - s * 0.6, cy + s * 0.55); ctx.closePath(); ctx.fill(); ctx.fillRect(cx + s * 0.25, cy - s * 0.55, s * 0.3, s * 1.1); }
  else if (name === 'map') { ctx.beginPath(); ctx.moveTo(cx - s * 0.7, cy - s * 0.45); ctx.lineTo(cx - s * 0.25, cy - s * 0.6); ctx.lineTo(cx + s * 0.25, cy - s * 0.45); ctx.lineTo(cx + s * 0.7, cy - s * 0.6); ctx.lineTo(cx + s * 0.7, cy + s * 0.5); ctx.lineTo(cx + s * 0.25, cy + s * 0.65); ctx.lineTo(cx - s * 0.25, cy + s * 0.5); ctx.lineTo(cx - s * 0.7, cy + s * 0.65); ctx.closePath(); ctx.stroke(); L([-0.25, -0.6], [-0.25, 0.5]); L([0.25, -0.45], [0.25, 0.65]); }
  else if (name === 'book') { ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.5); ctx.quadraticCurveTo(cx - s * 0.45, cy - s * 0.7, cx - s * 0.75, cy - s * 0.5); ctx.lineTo(cx - s * 0.75, cy + s * 0.55); ctx.quadraticCurveTo(cx - s * 0.45, cy + s * 0.35, cx, cy + s * 0.55); ctx.quadraticCurveTo(cx + s * 0.45, cy + s * 0.35, cx + s * 0.75, cy + s * 0.55); ctx.lineTo(cx + s * 0.75, cy - s * 0.5); ctx.quadraticCurveTo(cx + s * 0.45, cy - s * 0.7, cx, cy - s * 0.5); ctx.moveTo(cx, cy - s * 0.5); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'bulb') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.15, s * 0.5, Math.PI * 0.8, Math.PI * 2.2); ctx.lineTo(cx + s * 0.22, cy + s * 0.35); ctx.lineTo(cx - s * 0.22, cy + s * 0.35); ctx.closePath(); ctx.stroke(); L([-0.18, 0.56], [0.18, 0.56]); }
  else if (name === 'coin') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.6, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.28, 0, Math.PI * 2); ctx.stroke(); }
  else if (name === 'water') { ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.7); ctx.quadraticCurveTo(cx + s * 0.7, cy + s * 0.1, cx, cy + s * 0.65); ctx.quadraticCurveTo(cx - s * 0.7, cy + s * 0.1, cx, cy - s * 0.7); ctx.fill(); }
  else if (name === 'food') { ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.15, s * 0.65, s * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.25); ctx.quadraticCurveTo(cx + s * 0.15, cy - s * 0.65, cx + s * 0.5, cy - s * 0.6); ctx.stroke(); }
  else if (name === 'camel') { ctx.beginPath(); ctx.moveTo(cx - s * 0.8, cy + s * 0.55); ctx.lineTo(cx - s * 0.8, cy - s * 0.05); ctx.quadraticCurveTo(cx - s * 0.55, cy - s * 0.55, cx - s * 0.3, cy - s * 0.15); ctx.quadraticCurveTo(cx - s * 0.05, cy - s * 0.6, cx + s * 0.25, cy - s * 0.1); ctx.lineTo(cx + s * 0.4, cy - s * 0.75); ctx.lineTo(cx + s * 0.85, cy - s * 0.65); ctx.lineTo(cx + s * 0.4, cy + s * 0.05); ctx.lineTo(cx + s * 0.4, cy + s * 0.55); ctx.moveTo(cx - s * 0.4, cy + s * 0.55); ctx.lineTo(cx - s * 0.4, cy + s * 0.05); ctx.stroke(); }
  else if (name === 'guard') { ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.75); ctx.lineTo(cx + s * 0.6, cy - s * 0.45); ctx.lineTo(cx + s * 0.5, cy + s * 0.25); ctx.quadraticCurveTo(cx + s * 0.35, cy + s * 0.6, cx, cy + s * 0.78); ctx.quadraticCurveTo(cx - s * 0.35, cy + s * 0.6, cx - s * 0.5, cy + s * 0.25); ctx.lineTo(cx - s * 0.6, cy - s * 0.45); ctx.closePath(); ctx.stroke(); }
  else if (name === 'rest') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.55, Math.PI * 0.2, Math.PI * 1.45); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + s * 0.25, cy - s * 0.15, s * 0.45, Math.PI * 0.35, Math.PI * 1.3); ctx.stroke(); }
  else if (name === 'speak') { ctx.beginPath(); ctx.roundRect(cx - s * 0.75, cy - s * 0.6, s * 1.5, s * 1.0, s * 0.3); ctx.stroke(); L([-0.25, 0.4], [-0.45, 0.8], [0.05, 0.4]); }
  else if (name === 'news') { ctx.beginPath(); ctx.roundRect(cx - s * 0.7, cy - s * 0.6, s * 1.4, s * 1.2, s * 0.15); ctx.stroke(); L([-0.4, -0.2], [0.4, -0.2]); L([-0.4, 0.1], [0.4, 0.1]); L([-0.4, 0.4], [0.1, 0.4]); }
  else if (name === 'sun') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.36, 0, Math.PI * 2); ctx.fill(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; L([Math.cos(a) * 0.62, Math.sin(a) * 0.62], [Math.cos(a) * 0.9, Math.sin(a) * 0.9]); } }
  else if (name === 'gear') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; L([Math.cos(a) * 0.5, Math.sin(a) * 0.5], [Math.cos(a) * 0.8, Math.sin(a) * 0.8]); } }
  else if (name === 'check') L([-0.6, 0.05], [-0.15, 0.5], [0.65, -0.45]);
  else if (name === 'lock') { ctx.beginPath(); ctx.roundRect(cx - s * 0.5, cy - s * 0.1, s, s * 0.7, s * 0.12); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - s * 0.1, s * 0.32, Math.PI, 0); ctx.stroke(); }
  else if (name === 'caret') L([-0.5, -0.2], [0, 0.3], [0.5, -0.2]);
  else if (name === 'menu') { L([-0.6, -0.4], [0.6, -0.4]); L([-0.6, 0], [0.6, 0]); L([-0.6, 0.4], [0.6, 0.4]); }
  else if (name === 'west') L([0.6, 0], [-0.6, 0], [-0.2, -0.4]), L([-0.6, 0], [-0.2, 0.4]);
  else if (name === 'east') L([-0.6, 0], [0.6, 0], [0.2, -0.4]), L([0.6, 0], [0.2, 0.4]);
  ctx.restore();
}
