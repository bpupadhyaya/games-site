// Small drawing helpers for the interface: text, flat buttons, panels, icons. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

export const minUnits = () => 11.5 / Math.max(0.2, host.px);     // text never goes below ~11 css px

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  ctx.font = `${o.weight ?? 600} ${Math.max(size, minUnits())}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(14,8,28,0.85)'; ctx.strokeText(s, x, y); }
  if (o.maxW && ctx.measureText(s).width > o.maxW) {
    const k = o.maxW / ctx.measureText(s).width; ctx.font = `${o.weight ?? 600} ${Math.max(size * k, minUnits())}px ${o.font ?? UI}`;
  }
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

// ---- carved-wood and lacquer chrome: every panel and button is a lit object (bevel, depth, grain, brass edge) -----------------------------
const hsh = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const BRASS = ['#f6d98a', '#c9953a', '#8a5a18', '#d9ad55'];
export function brassEdge(ctx, r, rad, lw = 2.5) {
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, BRASS[0]); g.addColorStop(0.45, BRASS[1]); g.addColorStop(0.55, BRASS[2]); g.addColorStop(1, BRASS[3]);
  ctx.lineWidth = lw; ctx.strokeStyle = g; rrect(ctx, { x: r.x + lw / 2, y: r.y + lw / 2, w: r.w - lw, h: r.h - lw }, Math.max(0, rad - lw / 2)); ctx.stroke();
}
function grain(ctx, r, rad, seed, a = 0.07) {
  ctx.save(); rrect(ctx, r, rad); ctx.clip();
  const n = Math.max(3, Math.round(r.h / 7));
  for (let i = 0; i < n; i++) {
    const y = r.y + (i + hsh(seed + i)) / n * r.h, w = r.w * (0.4 + 0.6 * hsh(seed + i * 3)), x = r.x + hsh(seed + i * 7) * (r.w - w);
    ctx.strokeStyle = hsh(seed + i * 11) > 0.5 ? `rgba(255,214,160,${a})` : `rgba(10,4,2,${a * 1.6})`; ctx.lineWidth = 1 + hsh(seed + i * 5) * 1.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + w * 0.3, y + 1.5, x + w * 0.7, y - 1.5, x + w, y + 0.5); ctx.stroke();
  }
  ctx.restore();
}
const seedOf = (r) => Math.round(r.x * 0.37 + r.y * 0.91 + r.w * 0.13);

// Buttons. kind: primary (saffron lacquer), ghost / quiet (carved walnut), on (teal lacquer), danger, gold (brass), disabled.
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(22, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.4);
  const depth = Math.max(3, Math.min(7, r.h * 0.09)), dn = o.press ? depth * 0.7 : 0;
  ctx.save();
  const top = { x: r.x, y: r.y + dn, w: r.w, h: r.h - depth + 0 };
  // cast shadow + the visible side of the slab (depth)
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; rrect(ctx, { x: r.x + 1, y: r.y + depth + 3, w: r.w - 2, h: r.h - depth }, rad); ctx.fill();
  const faces = {
    primary: ['#ffb04e', '#ee7d1e', '#c4560d', '#7c2f08'], on: ['#5fe0c9', '#2fb6a3', '#1f8a7a', '#0f4f48'], danger: ['#e05a74', '#b9304a', '#8e2036', '#52101e'],
    gold: ['#ffe39a', '#f0b94a', '#c98a1e', '#7a4f0a'], ghost: ['#5a3724', '#3d2314', '#2c180d', '#150a05'], quiet: ['#664029', '#472a18', '#321b0e', '#180b05'], disabled: ['#3a2a22', '#2c201a', '#231913', '#120c09'],
  };
  const f = faces[kind] ?? faces.ghost;
  const side = { x: r.x, y: r.y + dn + depth, w: r.w, h: r.h - depth };
  ctx.fillStyle = f[3]; rrect(ctx, side, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, top.y, 0, top.y + top.h);
  g.addColorStop(0, f[0]); g.addColorStop(0.5, f[1]); g.addColorStop(1, f[2]);
  ctx.fillStyle = g; rrect(ctx, top, rad); ctx.fill();
  const wood = kind === 'ghost' || kind === 'quiet' || kind === 'disabled';
  if (wood) grain(ctx, top, rad, seedOf(r)); else {
    // lacquer: a soft specular band across the upper half
    ctx.save(); rrect(ctx, top, rad); ctx.clip();
    const sp = ctx.createLinearGradient(0, top.y, 0, top.y + top.h * 0.55); sp.addColorStop(0, 'rgba(255,255,255,0.38)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sp; ctx.fillRect(top.x, top.y, top.w, top.h * 0.55);
    ctx.restore();
  }
  // bevel: bright top edge, dark bottom edge
  ctx.save(); rrect(ctx, top, rad); ctx.clip();
  ctx.fillStyle = 'rgba(255,240,210,0.35)'; ctx.fillRect(top.x, top.y, top.w, 1.5);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(top.x, top.y + top.h - 2, top.w, 2);
  ctx.restore();
  if (wood || kind === 'primary') brassEdge(ctx, top, rad, wood ? 2 : 2.5);
  else { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,240,210,0.45)'; rrect(ctx, top, rad); ctx.stroke(); }
  if (o.press) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; rrect(ctx, top, rad); ctx.fill(); }
  const dark = kind === 'on' || kind === 'gold';
  const col = kind === 'disabled' ? 'rgba(255,240,220,0.42)' : dark ? '#10101e' : kind === 'primary' ? '#fff' : PAL.text;
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14;
  const midY = top.y + top.h / 2;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, midY, r.h * 0.4, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  const ty = (k) => top.y + top.h * k;
  const tcol = kind === 'primary' ? { stroke: 5, strokeColor: 'rgba(110,40,4,0.55)' } : {};
  txt(ctx, label, cx, ty(hasSub ? 0.36 : 0.5), size, col, { align: 'center', weight: 800, maxW: r.w - pad - 14, ...tcol });
  if (hasSub) txt(ctx, o.sub, cx, ty(0.74), size * 0.6, dark ? 'rgba(0,0,0,0.7)' : 'rgba(255,240,220,0.85)', { align: 'center', weight: 600, maxW: r.w - pad - 14 });
  ctx.restore();
}

export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  // dark walnut plaque under the scene: translucent so the courtyard still shows, with a brass edge, an inner shadow and a top highlight
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, { x: r.x + 1, y: r.y + 5, w: r.w - 2, h: r.h }, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  const m = o.fill && /([0-9.]+)\)$/.exec(o.fill), al = m ? Math.min(1, Math.max(0.5, parseFloat(m[1]) / 0.9)) : 1;
  g.addColorStop(0, `rgba(58,32,20,${0.88 * al})`); g.addColorStop(0.5, `rgba(36,18,12,${0.9 * al})`); g.addColorStop(1, `rgba(22,10,8,${0.92 * al})`); ctx.fillStyle = g;
  rrect(ctx, r, rad); ctx.fill();
  grain(ctx, r, rad, seedOf(r), 0.045);
  ctx.save(); rrect(ctx, r, rad); ctx.clip();
  const ih = ctx.createLinearGradient(0, r.y, 0, r.y + 18); ih.addColorStop(0, 'rgba(255,225,170,0.22)'); ih.addColorStop(1, 'rgba(255,225,170,0)');
  ctx.fillStyle = ih; ctx.fillRect(r.x, r.y, r.w, 18);
  ctx.restore();
  if (o.stroke) { ctx.lineWidth = 2.5; ctx.strokeStyle = o.stroke; rrect(ctx, r, rad); ctx.stroke(); } else brassEdge(ctx, r, rad, 2.5);
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

// The balance bar: a rounded track, a bright "in line" band in the middle, and a marker at `bal` (-1.3..1.3). `ghost` draws the
// finger-steer target as a small tick. Used in play and in the Rules book.
export function drawGauge(ctx, r, bal, o = {}) {
  const { safe = 0.4, fall = 1.0 } = o, span = 1.3;
  const X = (v) => r.x + r.w / 2 + (Math.max(-span, Math.min(span, v)) / span) * (r.w / 2 - r.h * 0.5);
  ctx.save();
  const tg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); tg.addColorStop(0, 'rgba(10,4,2,0.92)'); tg.addColorStop(1, 'rgba(48,26,14,0.9)');
  ctx.fillStyle = tg; rrect(ctx, r, r.h / 2); ctx.fill();
  brassEdge(ctx, r, r.h / 2, 3);
  // fall zones
  ctx.fillStyle = 'rgba(224,80,60,0.26)';
  ctx.beginPath(); ctx.roundRect(r.x + 4, r.y + 4, X(-fall) - r.x - 4, r.h - 8, r.h / 2 - 4); ctx.fill();
  ctx.beginPath(); ctx.roundRect(X(fall), r.y + 4, r.x + r.w - 4 - X(fall), r.h - 8, r.h / 2 - 4); ctx.fill();
  const band = { x: X(-safe), y: r.y + 5, w: X(safe) - X(-safe), h: r.h - 10 };
  ctx.fillStyle = 'rgba(79,230,200,0.38)'; rrect(ctx, band, band.h / 2); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(142,240,220,0.9)'; rrect(ctx, band, band.h / 2); ctx.stroke();
  if (o.ghost !== undefined) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(X(o.ghost) - 1.5, r.y + 6, 3, r.h - 12); }
  const mx = X(bal), inLine = Math.abs(bal) <= safe, slipping = Math.abs(bal) >= fall;
  ctx.fillStyle = slipping ? '#ff5a4a' : inLine ? '#fff3c4' : '#ffb43c';
  ctx.beginPath(); ctx.arc(mx, r.y + r.h / 2, r.h * 0.34, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,14,10,0.7)'; ctx.stroke();
  ctx.restore();
}
