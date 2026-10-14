// Small drawing helpers for the interface: text, flat buttons, panels, icons, chips. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

// Text never goes below ~11.5 css px.
export const minUnits = () => 11.5 / Math.max(0.2, host.px);

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  s = String(s);
  ctx.font = `${o.weight ?? 600} ${Math.max(size, minUnits())}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  if (o.maxW) {
    const mw = ctx.measureText(s).width;
    if (mw > o.maxW) ctx.font = `${o.weight ?? 600} ${Math.max(size * (o.maxW / mw), minUnits() * 0.8)}px ${o.font ?? UI}`;
  }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(20,8,24,0.85)'; ctx.strokeText(s, x, y); }
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

// Pointer for the pressed look of a button (set by game.js each update; presentation only).
export const ptr = { x: -1, y: -1, down: false };
const inR = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Lacquered buttons: a lit gradient face, a bright top edge, a darker lower lip, a brass rim and a drop shadow; pressed buttons sink.
// kind: primary (rose lacquer), ghost (smoked glass), quiet (soft plum), on (sage), gold, danger, disabled, sel.
const FACE = {
  primary: ['#e0698b', '#b9486b', '#8c2f4f'], on: ['#7cc08a', '#5a9a6a', '#3f7650'], danger: ['#d9546c', '#b9304a', '#8a2036'],
  gold: ['#fff0b8', '#e8c26a', '#b8861f'], sel: ['#fff0b8', '#e8c26a', '#b8861f'],
  ghost: ['rgba(88,74,132,0.78)', 'rgba(52,42,92,0.82)', 'rgba(32,26,62,0.9)'], quiet: ['rgba(120,100,160,0.72)', 'rgba(76,62,116,0.8)', 'rgba(48,40,84,0.88)'],
  disabled: ['rgba(60,56,84,0.5)', 'rgba(46,42,70,0.5)', 'rgba(36,32,58,0.5)'],
};
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(22, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.4);
  const pressed = ptr.down && inR(r, ptr.x, ptr.y) && kind !== 'disabled';
  const dy = pressed ? 3 : 0;
  ctx.save();
  if (!o.noShadow && !pressed) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; rrect(ctx, { x: r.x, y: r.y + 5, w: r.w, h: r.h }, rad); ctx.fill(); }
  const f = FACE[kind] ?? FACE.ghost;
  const rr = { x: r.x, y: r.y + dy, w: r.w, h: r.h };
  // lower lip (the thickness of the button)
  if (!pressed && kind !== 'disabled') { ctx.fillStyle = f[2]; rrect(ctx, { x: rr.x, y: rr.y + 3, w: rr.w, h: rr.h }, rad); ctx.fill(); }
  const g = ctx.createLinearGradient(0, rr.y, 0, rr.y + rr.h);
  g.addColorStop(0, f[0]); g.addColorStop(0.5, f[1]); g.addColorStop(1, f[2]);
  ctx.fillStyle = g; rrect(ctx, rr, rad); ctx.fill();
  // top light and a soft gloss band (no hard inner shape)
  const hl = ctx.createLinearGradient(0, rr.y, 0, rr.y + rr.h * 0.55);
  hl.addColorStop(0, 'rgba(255,255,255,0.28)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save(); rrect(ctx, rr, rad); ctx.clip(); ctx.fillStyle = hl; ctx.fillRect(rr.x, rr.y, rr.w, rr.h * 0.55); ctx.restore();
  // rim: brass for glass buttons, a bright edge for solid ones
  const solid = kind === 'primary' || kind === 'on' || kind === 'danger' || kind === 'gold' || kind === 'sel';
  ctx.lineWidth = 2;
  const rim = ctx.createLinearGradient(0, rr.y, 0, rr.y + rr.h);
  if (solid) { rim.addColorStop(0, 'rgba(255,255,255,0.65)'); rim.addColorStop(1, 'rgba(0,0,0,0.35)'); } else { rim.addColorStop(0, 'rgba(255,226,150,0.85)'); rim.addColorStop(0.5, 'rgba(180,140,60,0.5)'); rim.addColorStop(1, 'rgba(120,90,30,0.55)'); }
  ctx.strokeStyle = rim; rrect(ctx, { x: rr.x + 1, y: rr.y + 1, w: rr.w - 2, h: rr.h - 2 }, rad); ctx.stroke();
  const dark = kind === 'gold' || kind === 'sel';
  const col = kind === 'disabled' ? 'rgba(251,241,220,0.38)' : dark ? '#2a1a08' : '#fff';
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, rr.y + r.h / 2, r.h * 0.4, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  if (!dark && kind !== 'disabled') { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1.5; }
  txt(ctx, label, cx, rr.y + r.h * (hasSub ? 0.36 : 0.5), size, col, { align: 'center', weight: 800, maxW: r.w - pad - 14, font: o.font });
  ctx.shadowColor = 'transparent';
  if (hasSub) txt(ctx, o.sub, cx, rr.y + r.h * 0.74, size * 0.6, dark ? 'rgba(42,26,8,0.8)' : PAL.dim, { align: 'center', weight: 500, maxW: r.w - pad - 14 });
  ctx.restore();
}

// Panels: a carved plaque. Lit from above, a dark inner bevel, a brass rim and four small studs.
export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  const base = o.fill ?? 'rgba(24,18,48,0.86)';
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, { x: r.x, y: r.y + 4, w: r.w, h: r.h }, rad); ctx.fill();
  ctx.fillStyle = base; rrect(ctx, r, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(255,230,170,0.12)'); g.addColorStop(0.18, 'rgba(255,230,170,0.03)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = g; rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = 2.5;
  const rim = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  rim.addColorStop(0, o.stroke ?? 'rgba(255,226,150,0.8)'); rim.addColorStop(0.5, 'rgba(160,120,50,0.45)'); rim.addColorStop(1, 'rgba(255,214,120,0.6)');
  ctx.strokeStyle = rim; rrect(ctx, r, rad); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; rrect(ctx, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, Math.max(4, rad - 4)); ctx.stroke();
  if (!o.noStuds && r.w > 120 && r.h > 90) {
    const k = Math.min(rad * 0.55 + 6, 16);
    for (const [sx, sy] of [[r.x + k, r.y + k], [r.x + r.w - k, r.y + k], [r.x + k, r.y + r.h - k], [r.x + r.w - k, r.y + r.h - k]]) {
      const sg = ctx.createRadialGradient(sx - 1.2, sy - 1.2, 0.5, sx, sy, 4.2); sg.addColorStop(0, '#fff3c4'); sg.addColorStop(1, '#8f6a1c');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 3.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// Icons: pause, back, play, plus, minus, restart, hint, ear (listen), hand (reach), clap.
export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'back') { ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.35, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'plus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'minus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke(); }
  else if (name === 'ear') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.1, s * 0.5, Math.PI * 0.9, Math.PI * 2.2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - s * 0.05, s * 0.2, Math.PI, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.15, cy + s * 0.2); ctx.quadraticCurveTo(cx - s * 0.05, cy + s * 0.65, cx + s * 0.25, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'restart') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, -0.4, Math.PI * 1.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.55, cy - s * 0.55); ctx.lineTo(cx + s * 0.55, cy - s * 0.05); ctx.lineTo(cx + s * 0.05, cy - s * 0.15); ctx.stroke(); }
  else if (name === 'hint') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.15, s * 0.42, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.18, cy + s * 0.45); ctx.lineTo(cx + s * 0.18, cy + s * 0.45); ctx.stroke(); }
  else if (name === 'clap') {
    ctx.save(); ctx.translate(cx, cy);
    for (const sg of [-1, 1]) { ctx.save(); ctx.rotate(sg * 0.5); ctx.beginPath(); ctx.roundRect(sg * s * 0.1 - s * 0.2, -s * 0.55, s * 0.4, s * 0.95, s * 0.18); ctx.stroke(); ctx.restore(); }
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.45, -s * 0.78); ctx.lineTo(i * s * 0.6, -s * 1.0); ctx.stroke(); }
    ctx.restore();
  }
  else if (name === 'book') { ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.45); ctx.quadraticCurveTo(cx - s * 0.45, cy - s * 0.7, cx - s * 0.75, cy - s * 0.5); ctx.lineTo(cx - s * 0.75, cy + s * 0.5); ctx.quadraticCurveTo(cx - s * 0.45, cy + s * 0.3, cx, cy + s * 0.55); ctx.quadraticCurveTo(cx + s * 0.45, cy + s * 0.3, cx + s * 0.75, cy + s * 0.5); ctx.lineTo(cx + s * 0.75, cy - s * 0.5); ctx.quadraticCurveTo(cx + s * 0.45, cy - s * 0.7, cx, cy - s * 0.45); ctx.moveTo(cx, cy - s * 0.45); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'scroll') { ctx.beginPath(); ctx.roundRect(cx - s * 0.5, cy - s * 0.6, s * 1.0, s * 1.2, s * 0.14); ctx.stroke(); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx - s * 0.28, cy + i * s * 0.28); ctx.lineTo(cx + s * 0.28, cy + i * s * 0.28); ctx.stroke(); } }
  else if (name === 'info') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - s * 0.28, s * 0.07, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.06); ctx.lineTo(cx, cy + s * 0.34); ctx.stroke(); }
  else if (name === 'gear') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.26, 0, Math.PI * 2); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * s * 0.42, cy + Math.sin(a) * s * 0.42); ctx.lineTo(cx + Math.cos(a) * s * 0.62, cy + Math.sin(a) * s * 0.62); ctx.stroke(); } ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2); ctx.stroke(); }
  else if (name === 'hand') {
    ctx.beginPath(); ctx.roundRect(cx - s * 0.4, cy - s * 0.05, s * 0.8, s * 0.65, s * 0.18); ctx.stroke();
    for (let i = 0; i < 4; i++) { const fx = cx - s * 0.3 + i * s * 0.2; ctx.beginPath(); ctx.moveTo(fx, cy); ctx.lineTo(fx, cy - s * (0.45 + (i === 1 || i === 2 ? 0.1 : 0))); ctx.stroke(); }
  }
  ctx.restore();
}

// A rounded chip with text. Returns its rect.
export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `${o.weight ?? 700} ${Math.max(size, minUnits())}px ${UI}`;
  const w = Math.min(o.maxW ?? 1e9, ctx.measureText(label).width + size * 1.1), h = size * 1.7;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.fillStyle = o.fill ?? 'rgba(251,241,220,0.14)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill();
  if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 700, maxW: w - size * 0.6 });
  return { x: rx, y: y - h / 2, w, h };
}

export { PAL, UI, DISPLAY, rgba };
