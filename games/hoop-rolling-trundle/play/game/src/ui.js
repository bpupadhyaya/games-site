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

// ---- the world's chrome: walnut plaques with brass edges, lacquered buttons with real depth and a pressed state -------------------------------
let woodPat = null;
function wood(ctx) {
  if (woodPat) return woodPat;
  const c = ctx.canvas.ownerDocument ? ctx.canvas.ownerDocument.createElement('canvas') : null; if (!c) return 'rgba(58,36,20,1)'; c.width = c.height = 160;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#4a2f1b'); gr.addColorStop(0.5, '#3b2414'); gr.addColorStop(1, '#4a2f1b');
  g.fillStyle = gr; g.fillRect(0, 0, 160, 160);
  let s = 12345; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 46; i++) { g.strokeStyle = r() < 0.5 ? 'rgba(20,10,4,0.5)' : 'rgba(160,110,64,0.28)'; g.lineWidth = 0.6 + r() * 1.4; const y = r() * 160; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(50, y + (r() - 0.5) * 8, 110, y + (r() - 0.5) * 8, 160, y + (r() - 0.5) * 3); g.stroke(); }
  woodPat = ctx.createPattern(c, 'repeat');
  return woodPat;
}
function brassStroke(ctx, r, rad, w = 3) {
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, '#ffe39a'); g.addColorStop(0.45, '#c8902f'); g.addColorStop(1, '#6f4a14');
  ctx.lineWidth = w; ctx.strokeStyle = g; rrect(ctx, r, rad); ctx.stroke();
}

// Buttons. kind: primary (red lacquer), ghost / quiet (walnut), on (teal enamel), danger, gold, disabled. Depth: a darker edge under the face
// that closes when pressed. No gloss shape: the light is one top-to-bottom gradient and a thin highlight on the upper edge.
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(22, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.4);
  const depth = o.press ? 1 : Math.min(7, r.h * 0.1);
  const face = { x: r.x, y: r.y + (o.press ? depth * 0.7 : 0), w: r.w, h: r.h - depth };
  ctx.save();
  const lacq = { primary: ['#ff6a4a', '#e8472f', '#a8281a', '#6e1810'], on: ['#59d9c4', '#2fb6a3', '#1b7f72', '#0f4e46'], danger: ['#e0506a', '#b9304a', '#80182c', '#4e0c18'], gold: ['#ffe08a', '#f0b94a', '#b97e1a', '#6e4a0c'] }[kind];
  const dark = kind === 'primary' || kind === 'on' || kind === 'gold';
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, { x: r.x + 1, y: r.y + depth + 2, w: r.w - 2, h: r.h - depth }, rad); ctx.fill(); }
  if (lacq) {
    // the lower edge (depth), then the face
    ctx.fillStyle = lacq[3]; rrect(ctx, { x: r.x, y: r.y + depth, w: r.w, h: r.h - depth }, rad); ctx.fill();
    const g = ctx.createLinearGradient(0, face.y, 0, face.y + face.h);
    g.addColorStop(0, lacq[0]); g.addColorStop(0.5, lacq[1]); g.addColorStop(1, lacq[2]);
    ctx.fillStyle = g; rrect(ctx, face, rad); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; rrect(ctx, { x: face.x + 1.5, y: face.y + 1.5, w: face.w - 3, h: face.h - 3 }, rad - 1); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(30,8,4,0.55)'; rrect(ctx, face, rad); ctx.stroke();
  } else if (kind === 'disabled') {
    ctx.fillStyle = 'rgba(20,16,12,0.55)'; rrect(ctx, face, rad); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,200,0.2)'; rrect(ctx, face, rad); ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(14,8,4,0.8)'; rrect(ctx, { x: r.x, y: r.y + depth, w: r.w, h: r.h - depth }, rad); ctx.fill();
    ctx.fillStyle = wood(ctx); rrect(ctx, face, rad); ctx.fill();
    ctx.fillStyle = kind === 'quiet' ? 'rgba(10,6,3,0.42)' : 'rgba(10,6,3,0.58)'; rrect(ctx, face, rad); ctx.fill();
    brassStroke(ctx, face, rad, 2.5);
  }
  if (o.press) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; rrect(ctx, face, rad); ctx.fill(); }
  const col = kind === 'disabled' ? 'rgba(255,240,220,0.4)' : dark ? (kind === 'primary' ? '#fff' : '#0d1b26') : PAL.text;
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14, fy = face.y, fh = face.h;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, fy + fh / 2, r.h * 0.4, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  txt(ctx, label, cx, fy + fh * (hasSub ? 0.36 : 0.5), size, col, { align: 'center', weight: 700, maxW: r.w - pad - 14 });
  if (hasSub) txt(ctx, o.sub, cx, fy + fh * 0.72, size * 0.6, dark ? 'rgba(255,255,255,0.85)' : PAL.dim, { align: 'center', weight: 500, maxW: r.w - pad - 14 });
  ctx.restore();
}

// A walnut plaque with a brass border and four rivets (the dark wash keeps text readable over the live 3D scene).
export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, { x: r.x + 1, y: r.y + 5, w: r.w, h: r.h }, rad); ctx.fill();
  ctx.fillStyle = wood(ctx); rrect(ctx, r, rad); ctx.fill();
  ctx.fillStyle = o.fill ?? 'rgba(16,10,6,0.66)'; rrect(ctx, r, rad); ctx.fill();
  if (o.stroke === undefined || o.stroke === null || /255,\s*230,\s*200|255,214,150/.test(String(o.stroke))) brassStroke(ctx, r, rad, 3);
  else { ctx.lineWidth = 2; ctx.strokeStyle = o.stroke; rrect(ctx, r, rad); ctx.stroke(); }
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; rrect(ctx, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, Math.max(2, rad - 4)); ctx.stroke();
  if (r.w > 160 && r.h > 90 && !o.noRivets) {
    for (const [x, y] of [[r.x + 11, r.y + 11], [r.x + r.w - 11, r.y + 11], [r.x + 11, r.y + r.h - 11], [r.x + r.w - 11, r.y + r.h - 11]]) {
      const g = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, 4.5); g.addColorStop(0, '#fff0b8'); g.addColorStop(1, '#8a5e18');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
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

