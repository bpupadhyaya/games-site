// Interface drawing helpers in the ship's own materials: carved teak plaques with a brass rim, lacquered vermilion buttons,
// slate panels with a brass edge, lit from the top left (the sun). Pure canvas; every shape is a function of its arguments.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

// Text that never goes below ~11 css px.
export const minUnits = () => 11.5 / Math.max(0.2, host.px);

// Pointer state the interface can show as a pressed button (set by game.update from the input; never read by the sim).
export const press = { down: false, x: -1, y: -1 };
const hit = (r) => press.down && press.x >= r.x && press.x <= r.x + r.w && press.y >= r.y && press.y <= r.y + r.h;

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

// ---- materials -------------------------------------------------------------------------------------------------------------------------
let grain = null;
function grainTile() {
  if (grain || typeof OffscreenCanvas === 'undefined') return grain;
  const c = new OffscreenCanvas(256, 96);
  const x = c.getContext('2d'); let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 46; i++) {
    const y = r() * 96, a = 0.05 + r() * 0.12, amp = 1 + r() * 3, f = 0.02 + r() * 0.03, ph = r() * 6.28;
    x.strokeStyle = r() < 0.65 ? `rgba(20,8,0,${a})` : `rgba(255,225,170,${a * 0.7})`; x.lineWidth = 0.6 + r() * 1.6; x.beginPath();
    for (let k = 0; k <= 256; k += 8) { const yy = y + Math.sin(k * f + ph) * amp; k ? x.lineTo(k, yy) : x.moveTo(k, yy); }
    x.stroke();
  }
  grain = c; return c;
}
const BRASS = ['#fbe9a8', '#d9ad4e', '#8d6522'];
function brassStroke(ctx, r) {
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.4, r.y + r.h);
  g.addColorStop(0, BRASS[0]); g.addColorStop(0.5, BRASS[1]); g.addColorStop(1, BRASS[2]); return g;
}
const FILLS = {
  primary: ['#ff8a63', '#e0472b', '#a8281a'],        // lacquered vermilion
  on: ['#58d6c3', '#1fa593', '#0f6b62'],              // teal lacquer
  gold: ['#ffe7a0', '#e8b84a', '#a8761c'],
  danger: ['#e05a74', '#b9304a', '#7a1a2e'],
  ghost: ['#6b4727', '#4c3019', '#33200f'],           // carved teak
  quiet: ['#765031', '#583820', '#3b2412'],
  disabled: ['#3d332a', '#2e261f', '#241e19'],
};

// Buttons. kind: primary (lacquer), ghost / quiet (teak plaque), on (teal lacquer), gold, danger, disabled.
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(22, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.4);
  const pr = o.press ?? hit(r), dy = pr ? Math.min(3, r.h * 0.05) : 0;
  const R = { x: r.x, y: r.y + dy, w: r.w, h: r.h };
  ctx.save();
  if (!o.noShadow && !pr) { ctx.fillStyle = 'rgba(0,0,0,0.32)'; rrect(ctx, { x: r.x + 1, y: r.y + Math.min(5, r.h * 0.08), w: r.w - 2, h: r.h }, rad); ctx.fill(); }
  const f = FILLS[kind] ?? FILLS.ghost, lac = kind === 'primary' || kind === 'on' || kind === 'gold' || kind === 'danger';
  const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
  g.addColorStop(0, f[0]); g.addColorStop(0.48, f[1]); g.addColorStop(1, f[2]);
  ctx.fillStyle = g; rrect(ctx, R, rad); ctx.fill();
  const tile = !lac && kind !== 'disabled' ? grainTile() : null;       // wood grain on the teak plaques
  if (tile) { ctx.save(); rrect(ctx, R, rad); ctx.clip(); ctx.globalAlpha = 0.9; ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.translate(R.x, R.y); ctx.fillRect(0, 0, R.w, R.h); ctx.restore(); }
  const bv = Math.max(2, Math.min(4, R.h * 0.05));                      // top-lit bevel
  ctx.save(); rrect(ctx, R, rad); ctx.clip();
  const hl = ctx.createLinearGradient(0, R.y, 0, R.y + R.h * 0.5); hl.addColorStop(0, lac ? 'rgba(255,255,255,0.36)' : 'rgba(255,230,190,0.22)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(R.x, R.y, R.w, R.h * 0.5);
  const sh = ctx.createLinearGradient(0, R.y + R.h * 0.7, 0, R.y + R.h); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = sh; ctx.fillRect(R.x, R.y + R.h * 0.7, R.w, R.h * 0.3);
  ctx.restore();
  ctx.lineWidth = kind === 'disabled' ? 1.5 : (lac ? 3 : 2.4); ctx.strokeStyle = kind === 'disabled' ? 'rgba(180,150,100,0.35)' : brassStroke(ctx, R);
  rrect(ctx, { x: R.x + 1, y: R.y + 1, w: R.w - 2, h: R.h - 2 }, rad); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; rrect(ctx, { x: R.x + bv + 1, y: R.y + bv + 1, w: R.w - 2 * bv - 2, h: R.h - 2 * bv - 2 }, Math.max(2, rad - bv)); ctx.stroke();
  const col = kind === 'disabled' ? 'rgba(235,215,180,0.4)' : kind === 'gold' ? '#2a1a06' : '#fff8e8';
  const ih = Math.min(R.h, 120), hasSub = !!o.sub, pad = o.icon ? ih * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, R.x + ih * 0.5, R.y + R.h / 2, ih * 0.42, col);
  const cx = R.x + (o.icon ? ih * 0.9 + (R.w - ih * 0.9) / 2 : R.w / 2), ty = R.y + R.h * (hasSub ? 0.36 : 0.5);
  if (kind !== 'disabled' && kind !== 'gold') txt(ctx, label, cx, ty + 2, size, 'rgba(20,6,0,0.45)', { align: 'center', weight: 800, maxW: R.w - pad - 14 });
  txt(ctx, label, cx, ty, size, col, { align: 'center', weight: 800, maxW: R.w - pad - 14 });
  if (hasSub) txt(ctx, o.sub, cx, R.y + R.h * 0.72, size * 0.6, kind === 'disabled' ? 'rgba(235,215,180,0.35)' : 'rgba(255,245,225,0.82)', { align: 'center', weight: 600, maxW: R.w - pad - 14 });
  ctx.restore();
}

// Slate panel with a brass edge and four rivets.
export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 24;
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; rrect(ctx, { x: r.x, y: r.y + 5, w: r.w, h: r.h }, rad); ctx.fill(); }
  ctx.fillStyle = o.fill ?? PAL.panel; rrect(ctx, r, rad); ctx.fill();
  ctx.save(); rrect(ctx, r, rad); ctx.clip();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, 'rgba(255,230,180,0.09)'); g.addColorStop(0.2, 'rgba(255,230,180,0.02)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.restore();
  ctx.lineWidth = 2.2; ctx.strokeStyle = o.stroke ?? brassStroke(ctx, r); ctx.globalAlpha = o.stroke ? 1 : 0.8; rrect(ctx, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, rad); ctx.stroke(); ctx.globalAlpha = 1;
  if (!o.noRivets && r.w > 140 && r.h > 90) {
    const k = Math.min(rad * 0.45, 12);
    for (const [px, py] of [[r.x + k + 5, r.y + k + 5], [r.x + r.w - k - 5, r.y + k + 5], [r.x + k + 5, r.y + r.h - k - 5], [r.x + r.w - k - 5, r.y + r.h - k - 5]]) {
      const rg = ctx.createRadialGradient(px - 1.5, py - 1.5, 0.5, px, py, 4.2); rg.addColorStop(0, '#fff2c0'); rg.addColorStop(1, '#8d6522');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, 3.6, 0, 6.3); ctx.fill();
    }
  }
  ctx.restore();
}

// An inlaid bar (hull, voyage progress, craft): dark trough with a lit fill.
export function bar(ctx, r, frac, color = PAL.gold) {
  const f = Math.max(0, Math.min(1, frac)), h = r.h;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrect(ctx, r, h / 2); ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,230,170,0.35)'; rrect(ctx, r, h / 2); ctx.stroke();
  if (f > 0) {
    const w = Math.max(h, (r.w - 4) * f), fr = { x: r.x + 2, y: r.y + 2, w, h: h - 4 };
    ctx.fillStyle = color; rrect(ctx, fr, (h - 4) / 2); ctx.fill();
    ctx.save(); rrect(ctx, fr, (h - 4) / 2); ctx.clip(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#fff'; ctx.fillRect(fr.x, fr.y, fr.w, fr.h * 0.45); ctx.restore();
  }
  ctx.restore();
}

// Icons: pause, back, play, plus, minus, restart, think, eye, skip, book, gear, info, help.
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
  else if (name === 'book') { ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.45); ctx.quadraticCurveTo(cx - s * 0.5, cy - s * 0.65, cx - s * 0.75, cy - s * 0.4); ctx.lineTo(cx - s * 0.75, cy + s * 0.5); ctx.quadraticCurveTo(cx - s * 0.5, cy + s * 0.28, cx, cy + s * 0.55); ctx.quadraticCurveTo(cx + s * 0.5, cy + s * 0.28, cx + s * 0.75, cy + s * 0.5); ctx.lineTo(cx + s * 0.75, cy - s * 0.4); ctx.quadraticCurveTo(cx + s * 0.5, cy - s * 0.65, cx, cy - s * 0.45); ctx.moveTo(cx, cy - s * 0.45); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'gear') { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.moveTo(cx + Math.cos(a) * s * 0.42, cy + Math.sin(a) * s * 0.42); ctx.lineTo(cx + Math.cos(a) * s * 0.7, cy + Math.sin(a) * s * 0.7); } ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.15, 0, 6.3); ctx.fill(); }
  else if (name === 'info') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.7, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - s * 0.32, s * 0.09, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.08); ctx.lineTo(cx, cy + s * 0.38); ctx.stroke(); }
  else if (name === 'help') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.7, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy - s * 0.15); ctx.quadraticCurveTo(cx - s * 0.2, cy - s * 0.42, cx, cy - s * 0.42); ctx.quadraticCurveTo(cx + s * 0.25, cy - s * 0.42, cx + s * 0.22, cy - s * 0.12); ctx.quadraticCurveTo(cx + s * 0.18, cy + s * 0.05, cx, cy + s * 0.12); ctx.lineTo(cx, cy + s * 0.2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy + s * 0.42, s * 0.08, 0, 6.3); ctx.fill(); }
  ctx.restore();
}

// A capsule with text (lacquered dark by default).
export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `${o.weight ?? 800} ${Math.max(size, minUnits())}px ${UI}`;
  const w = ctx.measureText(label).width + size * 1.2, h = size * 1.7;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  const r = { x: rx, y: y - h / 2, w, h };
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; rrect(ctx, { x: r.x, y: r.y + 2, w, h }, h / 2); ctx.fill();
  ctx.fillStyle = o.fill ?? 'rgba(10,30,38,0.88)'; rrect(ctx, r, h / 2); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + h); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = g; rrect(ctx, r, h / 2); ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = o.stroke ?? 'rgba(236,196,100,0.65)'; rrect(ctx, r, h / 2); ctx.stroke();
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 800 });
  ctx.restore();
  return r;
}

export { PAL, UI, DISPLAY, rgba };

// Trim a string with an ellipsis so it fits maxW at the given size (never squeezes below the readable minimum).
export function fitText(ctx, str, maxW, size, weight = 600) {
  ctx.font = `${weight} ${Math.max(size, minUnits())}px ${UI}`;
  if (ctx.measureText(str).width <= maxW) return str;
  let t = str;
  while (t.length > 4 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

// Embossed display lettering: an extruded dark-teak body, a brass face, and a lit upper edge.
export function lettering(ctx, label, cx, cy, size, maxW) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let s = size; ctx.font = `700 ${s}px ${DISPLAY}`;
  const m = ctx.measureText(label).width; if (maxW && m > maxW) { s = size * maxW / m; ctx.font = `700 ${s}px ${DISPLAY}`; }
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255,170,70,0.55)'; ctx.shadowBlur = s * 0.28; ctx.fillStyle = 'rgba(255,200,100,0.35)'; ctx.fillText(label, cx, cy); ctx.shadowBlur = 0;
  const depth = Math.max(3, Math.round(s * 0.08));
  for (let i = depth; i >= 1; i--) {
    ctx.fillStyle = '#2a1204'; ctx.strokeStyle = '#2a1204'; ctx.lineWidth = s * 0.09;
    ctx.strokeText(label, cx + i * 0.35, cy + i); ctx.fillText(label, cx + i * 0.35, cy + i);
  }
  ctx.strokeStyle = '#1d0c03'; ctx.lineWidth = s * 0.09; ctx.strokeText(label, cx, cy);
  const g = ctx.createLinearGradient(0, cy - s * 0.5, 0, cy + s * 0.5);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(0.3, '#ffe08a'); g.addColorStop(0.56, '#e0a838'); g.addColorStop(0.84, '#b07a22'); g.addColorStop(1, '#ffd878');
  ctx.fillStyle = g; ctx.fillText(label, cx, cy);
  ctx.strokeStyle = 'rgba(255,255,230,0.6)'; ctx.lineWidth = Math.max(1, s * 0.012); ctx.strokeText(label, cx - 0.5, cy - 1);
  ctx.restore();
}
