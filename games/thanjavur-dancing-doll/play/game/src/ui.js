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
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(255,247,228,0.95)'; ctx.strokeText(s, x, y); }
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

// Lacquered buttons with a visible side (depth) and a pressed state. kind: primary (vermilion), ghost (ivory), quiet (gold), on (emerald), danger, gold, disabled.
const LAC = {
  primary: ['#ff7a52', '#d9402a', '#9c2412', '#6a140a'], on: ['#4fc890', '#1f8a5b', '#12633f', '#0a3f28'], danger: ['#d9503c', '#a52418', '#751208', '#4a0a04'],
  gold: ['#fff0a0', '#eaa91c', '#b87a0c', '#7a4c04'], quiet: ['#fff6cf', '#ffdf8a', '#e2b048', '#a8741a'], ghost: ['#fffdf4', '#fff3da', '#ecd8ae', '#b99a60'],
};
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(24, r.h * 0.32), size = o.size ?? Math.min(34, r.h * 0.4);
  const dis = kind === 'disabled', down = !!o.press, dep = dis ? 0 : Math.max(3, Math.min(7, r.h * 0.08)), dy = down ? dep * 0.7 : 0;
  ctx.save();
  const c = LAC[kind] ?? LAC.ghost;
  if (!o.noShadow && !dis) { ctx.fillStyle = 'rgba(40,12,6,0.3)'; rrect(ctx, { x: r.x + 1, y: r.y + dep + 5, w: r.w - 2, h: r.h }, rad); ctx.fill(); }
  if (dis) {
    ctx.fillStyle = 'rgba(58,22,32,0.06)'; rrect(ctx, r, rad); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(58,22,32,0.3)'; rrect(ctx, r, rad); ctx.stroke();
  } else {
    // the side of the button: a darker slab below the face
    ctx.fillStyle = c[3]; rrect(ctx, { x: r.x, y: r.y + dep, w: r.w, h: r.h - dy * 0 }, rad); ctx.fill();
    const face = { x: r.x, y: r.y + dy, w: r.w, h: r.h - dep + (down ? 0 : 0) };
    const g = ctx.createLinearGradient(0, face.y, 0, face.y + face.h);
    g.addColorStop(0, c[0]); g.addColorStop(0.18, c[1]); g.addColorStop(0.78, c[1]); g.addColorStop(1, c[2]);
    ctx.fillStyle = g; rrect(ctx, face, rad); ctx.fill();
    // brass rim and a bright top edge (a gradient edge, not an inner shape)
    ctx.lineWidth = 2; ctx.strokeStyle = kind === 'ghost' || kind === 'quiet' ? 'rgba(168,111,12,0.75)' : 'rgba(255,214,120,0.7)'; rrect(ctx, face, rad); ctx.stroke();
    const e = ctx.createLinearGradient(0, face.y, 0, face.y + Math.min(14, face.h * 0.3));
    e.addColorStop(0, 'rgba(255,255,255,0.55)'); e.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); rrect(ctx, face, rad); ctx.clip(); ctx.fillStyle = e; ctx.fillRect(face.x, face.y, face.w, Math.min(14, face.h * 0.3)); ctx.restore();
    if (down) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; rrect(ctx, face, rad); ctx.fill(); }
  }
  const light = kind === 'primary' || kind === 'on' || kind === 'danger';
  const col = dis ? 'rgba(58,22,32,0.38)' : light ? PAL.cream : PAL.text;
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14, ty = r.y + dy - (dis ? 0 : dep * 0.25);
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, ty + r.h / 2, r.h * 0.4, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  if (light) { ctx.save(); ctx.shadowColor = 'rgba(40,6,0,0.55)'; ctx.shadowOffsetY = 2; ctx.shadowBlur = 0; }
  txt(ctx, label, cx, ty + r.h * (hasSub ? 0.36 : 0.5), size, col, { align: 'center', weight: 800, maxW: r.w - pad - 14 });
  if (light) ctx.restore();
  if (hasSub) txt(ctx, o.sub, cx, ty + r.h * 0.72, size * 0.6, light ? 'rgba(255,247,228,0.88)' : PAL.dim, { align: 'center', weight: 600, maxW: r.w - pad - 14 });
  ctx.restore();
}

// Carved-teak plaque with a brass inlay line and an ivory face (o.fill overrides the face colour).
export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24, fr = Math.max(4, Math.min(8, Math.min(r.w, r.h) * 0.07));
  ctx.fillStyle = 'rgba(40,12,6,0.26)'; rrect(ctx, { x: r.x, y: r.y + 6, w: r.w, h: r.h }, rad); ctx.fill();
  const tg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  tg.addColorStop(0, '#c98a4c'); tg.addColorStop(0.5, '#8c4a22'); tg.addColorStop(1, '#5a2c12');
  ctx.fillStyle = tg; rrect(ctx, r, rad); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,225,170,0.55)'; rrect(ctx, { x: r.x + 0.75, y: r.y + 0.75, w: r.w - 1.5, h: r.h - 1.5 }, rad); ctx.stroke();
  const f = { x: r.x + fr, y: r.y + fr, w: r.w - fr * 2, h: r.h - fr * 2 }, frad = Math.max(4, rad - fr * 0.7);
  ctx.fillStyle = 'rgba(40,12,6,0.55)'; rrect(ctx, f, frad); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(234,169,28,0.95)'; rrect(ctx, { x: f.x + 1, y: f.y + 1, w: f.w - 2, h: f.h - 2 }, frad); ctx.stroke();
  const p = { x: f.x + 3, y: f.y + 3, w: f.w - 6, h: f.h - 6 };
  ctx.fillStyle = o.fill ?? 'rgba(255,247,228,0.96)'; rrect(ctx, p, Math.max(3, frad - 2)); ctx.fill();
  // sheen at the top of the face and a soft inner shadow
  ctx.save(); rrect(ctx, p, Math.max(3, frad - 2)); ctx.clip();
  const sg = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
  sg.addColorStop(0, 'rgba(255,255,255,0.35)'); sg.addColorStop(0.35, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(150,80,20,0.14)');
  ctx.fillStyle = sg; ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(90,40,10,0.22)'; rrect(ctx, { x: p.x + 1.5, y: p.y + 1.5, w: p.w - 3, h: p.h - 3 }, Math.max(3, frad - 3)); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// Icons: pause, play, back, plus, minus, restart, bulb (hint), eye (watch), arrows, tap, hold, next.
export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.17); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const arrow = (dx, dy) => {
    const px = -dy, py = dx;
    ctx.beginPath(); ctx.moveTo(cx - dx * s * 0.7, cy - dy * s * 0.7); ctx.lineTo(cx + dx * s * 0.7, cy + dy * s * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + dx * s * 0.7 + (px - dx) * s * 0.5, cy + dy * s * 0.7 + (py - dy) * s * 0.5); ctx.lineTo(cx + dx * s * 0.72, cy + dy * s * 0.72); ctx.lineTo(cx + dx * s * 0.7 + (-px - dx) * s * 0.5, cy + dy * s * 0.7 + (-py - dy) * s * 0.5); ctx.stroke();
  };
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'next') { ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy - s * 0.55); ctx.lineTo(cx + s * 0.25, cy); ctx.lineTo(cx - s * 0.5, cy + s * 0.55); ctx.closePath(); ctx.fill(); ctx.fillRect(cx + s * 0.4, cy - s * 0.55, s * 0.2, s * 1.1); }
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
  else if (name === 'tap') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.2, 0, Math.PI * 2); ctx.fill(); }
  else if (name === 'sun') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.36, 0, Math.PI * 2); ctx.fill(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * s * 0.55, cy + Math.sin(a) * s * 0.55); ctx.lineTo(cx + Math.cos(a) * s * 0.78, cy + Math.sin(a) * s * 0.78); ctx.stroke(); } }
  ctx.restore();
}

export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `${o.weight ?? 800} ${Math.max(size, minUnits())}px ${UI}`;
  const w = ctx.measureText(label).width + size * 1.1, h = size * 1.7;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.fillStyle = o.fill ?? 'rgba(255,247,228,0.92)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke ?? 'rgba(168,111,12,0.6)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke();
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 800 });
  return { x: rx, y: y - h / 2, w, h };
}

export { PAL, UI, DISPLAY, rgba };
