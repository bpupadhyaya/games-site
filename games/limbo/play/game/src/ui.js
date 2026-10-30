// Small drawing helpers for the interface: text, flat buttons, panels, icons. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

// Text that never goes below ~11 css px.
export const minUnits = () => 11.5 / Math.max(0.2, host.px);

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  ctx.font = `${o.weight ?? 600} ${Math.max(size, minUnits())}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(10,6,24,0.85)'; ctx.strokeText(s, x, y); }
  if (o.maxW && ctx.measureText(s).width > o.maxW) {                      // squeeze to fit rather than overflow
    const k = o.maxW / ctx.measureText(s).width; ctx.font = `${o.weight ?? 600} ${Math.max(size * k, minUnits())}px ${o.font ?? UI}`;
  }
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

// ---- lacquered buttons, teak plaques ---------------------------------------------------------------------------------------------
// The interface belongs to the same world as the beach: dark teak plaques with a brass edge, lacquered buttons with a lip of real depth and
// a pressed state. kind: primary (red lacquer), ghost / quiet (teak), on (teal lacquer), danger, gold, disabled.
let grain = null;
function grainPattern(ctx) {
  if (grain === null) {
    grain = false;
    try {
      if (typeof OffscreenCanvas === 'function') {
        const c = new OffscreenCanvas(160, 96), g = c.getContext('2d');
        g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 160, 96);
        let s = 7;
        const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
        for (let i = 0; i < 46; i++) {
          const y = r() * 96, a = 0.04 + r() * 0.07;
          g.strokeStyle = r() < 0.5 ? `rgba(255,220,170,${a})` : `rgba(0,0,0,${a * 1.6})`; g.lineWidth = 0.6 + r() * 1.2;
          g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(50, y + (r() - 0.5) * 6, 110, y + (r() - 0.5) * 6, 160, y + (r() - 0.5) * 3); g.stroke();
        }
        grain = c;
      }
    } catch { grain = false; }
  }
  return grain ? ctx.createPattern(grain, 'repeat') : null;
}
const brassGrad = (ctx, r) => { const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h); g.addColorStop(0, '#ffeaa6'); g.addColorStop(0.45, '#d9a43c'); g.addColorStop(1, '#8a5a1c'); return g; };

function teak(ctx, r, rad, alpha = 0.94) {
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, `rgba(78,44,30,${alpha})`); g.addColorStop(0.5, `rgba(52,28,22,${alpha})`); g.addColorStop(1, `rgba(34,18,18,${alpha})`);
  ctx.fillStyle = g; rrect(ctx, r, rad); ctx.fill();
  const p = grainPattern(ctx);
  if (p) { ctx.save(); rrect(ctx, r, rad); ctx.clip(); ctx.fillStyle = p; ctx.globalAlpha = 0.9; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.restore(); }
}

export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(24, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.4);
  const pressed = !!o.press, lip = kind === 'disabled' ? 0 : Math.max(3, Math.min(7, r.h * 0.075)), dy = pressed ? lip * 0.7 : 0;
  ctx.save();
  const body = { x: r.x, y: r.y + dy, w: r.w, h: r.h - lip + (pressed ? 0 : 0) };
  const lacquer = { primary: ['#ffeaa6', '#f4cf6a', '#c99a38', '#8a5e1c'], on: ['#4fe3cf', '#18b7a6', '#0f8b86', '#08605f'], danger: ['#e86a85', '#b9304a', '#8c2038', '#5c1426'], gold: ['#ffeaa6', '#f4cf6a', '#c99a38', '#8a5e1c'] }[kind];
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.32)'; rrect(ctx, { x: r.x + 1, y: r.y + lip + 3 - (pressed ? 2 : 0), w: r.w - 2, h: r.h - lip }, rad); ctx.fill(); }
  if (lacquer) {
    // lip (the thickness of the button) then the face
    ctx.fillStyle = lacquer[3]; rrect(ctx, { x: r.x, y: r.y + lip, w: r.w, h: r.h - lip }, rad); ctx.fill();
    const g = ctx.createLinearGradient(0, body.y, 0, body.y + body.h);
    g.addColorStop(0, lacquer[0]); g.addColorStop(0.18, lacquer[1]); g.addColorStop(0.82, lacquer[2]); g.addColorStop(1, lacquer[2]);
    ctx.fillStyle = g; rrect(ctx, body, rad); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.38)'; rrect(ctx, { x: body.x + 1.5, y: body.y + 1.5, w: body.w - 3, h: body.h - 3 }, Math.max(2, rad - 1.5)); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,224,150,0.85)'; rrect(ctx, body, rad); ctx.stroke();
  } else {
    const dis = kind === 'disabled';
    ctx.fillStyle = 'rgba(14,6,10,0.9)'; rrect(ctx, { x: r.x, y: r.y + lip, w: r.w, h: r.h - lip }, rad); ctx.fill();
    teak(ctx, body, rad, dis ? 0.55 : kind === 'quiet' ? 0.97 : 0.88);
    ctx.lineWidth = 2; ctx.strokeStyle = dis ? 'rgba(255,230,200,0.2)' : brassGrad(ctx, body); rrect(ctx, body, rad); ctx.stroke();
    if (!dis) { ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,240,200,0.18)'; rrect(ctx, { x: body.x + 2.5, y: body.y + 2.5, w: body.w - 5, h: body.h - 5 }, Math.max(2, rad - 2.5)); ctx.stroke(); }
  }
  if (pressed) { ctx.fillStyle = 'rgba(0,0,0,0.14)'; rrect(ctx, body, rad); ctx.fill(); }
  const dark = kind === 'gold' || kind === 'primary';
  const col = kind === 'disabled' ? 'rgba(255,240,220,0.4)' : dark ? '#2a1408' : '#fff6e6';
  const hasSub = !!o.sub, pad = o.icon ? body.h * 0.9 : 14;
  const cy = body.y + body.h / 2;
  if (o.icon) icon(ctx, o.icon, body.x + body.h * 0.5, cy, body.h * 0.4, col);
  const cx = body.x + (o.icon ? body.h * 0.9 + (body.w - body.h * 0.9) / 2 : body.w / 2);
  txt(ctx, label, cx, body.y + body.h * (hasSub ? 0.36 : 0.5) + 1, size, col, { align: 'center', weight: 800, maxW: body.w - pad - 14, stroke: lacquer ? size * 0.12 : 0, strokeColor: lacquer ? (dark ? 'rgba(255,240,190,0.35)' : 'rgba(60,8,12,0.45)') : undefined });
  if (hasSub) txt(ctx, o.sub, cx, body.y + body.h * 0.72, size * 0.6, dark ? 'rgba(40,20,8,0.8)' : 'rgba(255,240,215,0.78)', { align: 'center', weight: 600, maxW: body.w - pad - 14 });
  ctx.restore();
}

export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, { x: r.x + 2, y: r.y + 6, w: r.w - 4, h: r.h }, rad); ctx.fill();
  let alpha = 0.9;
  if (typeof o.fill === 'string') { const m = /rgba?\([^)]*?,\s*([\d.]+)\)$/.exec(o.fill); if (m) alpha = Math.max(0.78, Math.min(0.97, Number(m[1]) + 0.12)); }
  teak(ctx, r, rad, alpha);
  ctx.lineWidth = 3; ctx.strokeStyle = o.stroke ? o.stroke : brassGrad(ctx, r); rrect(ctx, r, rad); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,236,190,0.22)'; rrect(ctx, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, Math.max(2, rad - 4)); ctx.stroke();
  // brass rivets at the corners of larger plaques
  if (r.w > 160 && r.h > 90) {
    for (const [dx, dy] of [[11, 11], [r.w - 11, 11], [11, r.h - 11], [r.w - 11, r.h - 11]]) {
      const g = ctx.createRadialGradient(r.x + dx - 1.2, r.y + dy - 1.4, 0.5, r.x + dx, r.y + dy, 4.2);
      g.addColorStop(0, '#fff2c2'); g.addColorStop(0.6, '#c9922e'); g.addColorStop(1, '#6a4410');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r.x + dx, r.y + dy, 3.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// Icons: pause, back, play, plus, minus, restart, think, eye.
export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'back') { ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.35, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'plus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'minus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke(); }
  else if (name === 'restart') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, -0.4, Math.PI * 1.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.55, cy - s * 0.55); ctx.lineTo(cx + s * 0.55, cy - s * 0.05); ctx.lineTo(cx + s * 0.05, cy - s * 0.15); ctx.stroke(); }
  else if (name === 'think') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.15, s * 0.5, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.22, cy + s * 0.5); ctx.lineTo(cx + s * 0.22, cy + s * 0.5); ctx.moveTo(cx - s * 0.16, cy + s * 0.75); ctx.lineTo(cx + s * 0.16, cy + s * 0.75); ctx.stroke(); }
  else if (name === 'eye') { ctx.beginPath(); ctx.moveTo(cx - s * 0.7, cy); ctx.quadraticCurveTo(cx, cy - s * 0.75, cx + s * 0.7, cy); ctx.quadraticCurveTo(cx, cy + s * 0.75, cx - s * 0.7, cy); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2); ctx.fill(); }
  else if (name === 'skip') { ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy - s * 0.55); ctx.lineTo(cx + s * 0.15, cy); ctx.lineTo(cx - s * 0.5, cy + s * 0.55); ctx.closePath(); ctx.fill(); ctx.fillRect(cx + s * 0.3, cy - s * 0.55, s * 0.2, s * 1.1); }
  ctx.restore();
}

// A rounded chip with text (a small teak label with a brass edge).
export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `${o.weight ?? 800} ${Math.max(size, minUnits())}px ${UI}`;
  const w = ctx.measureText(label).width + size * 1.2, h = size * 1.75;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  const rr = { x: rx, y: y - h / 2, w, h };
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, { x: rr.x, y: rr.y + 3, w, h }, h / 2); ctx.fill();
  const solid = o.fill && /^#/.test(o.fill);
  if (solid) {
    const g = ctx.createLinearGradient(0, rr.y, 0, rr.y + h); g.addColorStop(0, '#ff7a5e'); g.addColorStop(1, o.fill);
    ctx.fillStyle = g; rrect(ctx, rr, h / 2); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,230,160,0.85)'; rrect(ctx, rr, h / 2); ctx.stroke();
  } else {
    teak(ctx, rr, h / 2, 0.93);
    ctx.lineWidth = 1.8; ctx.strokeStyle = o.stroke && o.stroke !== 'rgba(255,216,115,0.6)' ? o.stroke : brassGrad(ctx, rr); rrect(ctx, rr, h / 2); ctx.stroke();
  }
  ctx.restore();
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 800 });
  return rr;
}

export { PAL, UI, DISPLAY, rgba };
