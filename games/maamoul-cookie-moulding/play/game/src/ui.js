// Drawing kit: palette, text helpers, flat buttons, panels and small icons. Pure canvas, no DOM.
import { host } from './layout.js';
import { active as isActive, put } from './v3.js';

export const UI = 'Fredoka, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const NUM = 'Fredoka, system-ui, sans-serif';
export const DISP = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// One look: a Levantine bakery bench. Deep teal tile, walnut wood, flour cream, saffron and terracotta.
export const T = {
  bg0: '#12474a', bg1: '#071f22', lamp: 'rgba(255,214,140,0.20)',
  panel: 'rgba(255,246,226,0.08)', line: 'rgba(255,236,200,0.20)',
  text: '#fdf3df', dim: 'rgba(253,243,223,0.72)', faint: 'rgba(253,243,223,0.45)',
  accent: '#f2b640', accentSoft: 'rgba(242,182,64,0.24)', onAccent: '#2b1a05', accent2: '#cf5a3f', good: '#8fe0a0', bad: '#ff7a63',
  btn: 'rgba(255,246,226,0.10)', wood0: '#9a6638', wood1: '#5b3a1e', woodDark: '#3b2412', tile0: '#1c7c7e', tile1: '#0e4f53',
  dough: '#f1dcb0', flour: '#fff8e8', steel0: '#d8dde0', steel1: '#8b949a', ink: '#2b1a05', cream: '#fbf1dc',
};

// ---- colour helpers --------------------------------------------------------------------------------------------------------------
const hexRgb = (h) => (h[0] === 'r' ? h.slice(h.indexOf('(') + 1, h.indexOf(')')).split(',').slice(0, 3).map(Number) : [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const mixCache = new Map();
export function mix(a, b, t) {
  t = Math.round(clamp(t, 0, 1) * 50) / 50;
  const key = a + b + t, hit = mixCache.get(key);
  if (hit) return hit;
  const x = hexRgb(a), y = hexRgb(b);
  const out = `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
  if (mixCache.size > 3000) mixCache.clear();
  mixCache.set(key, out);
  return out;
}
export const rgba = (hex, a) => { const c = hexRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

// ---- text ------------------------------------------------------------------------------------------------------------------------
export const F = (n) => Math.max(n, 12 / (host.px || 0.55));   // never below ~12 css px
export const setFont = (ctx, size, weight = 600, fam = UI) => { ctx.font = `${weight} ${size}px ${fam}`; };
const wrapCache = new Map();
export function wrap(ctx, text, maxW, size, weight = 600, fam = UI) {
  const key = `${size}|${weight}|${fam}|${Math.round(maxW)}|${text}`;
  let out = wrapCache.get(key);
  if (out) return out;
  setFont(ctx, size, weight, fam);
  out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  if (wrapCache.size > 800) wrapCache.clear();
  wrapCache.set(key, out);
  return out;
}
// Single line, shrunk (never below ~11.5 css px) to fit maxW, then cut with an ellipsis.
export function txt(ctx, s, x, y, { size = 28, weight = 600, color = T.text, align = 'left', base = 'middle', maxW = 0, fam = UI, shadow = false } = {}) {
  s = String(s);
  setFont(ctx, size, weight, fam);
  if (maxW) {
    const floor = Math.max(10, 11.5 / (host.px || 0.55));
    let w = ctx.measureText(s).width;
    while (w > maxW && size > floor) { size -= 1; setFont(ctx, size, weight, fam); w = ctx.measureText(s).width; }
    if (w > maxW && s.length > 3) { while (s.length > 3 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1); s += '…'; }
  }
  ctx.textAlign = align; ctx.textBaseline = base;
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(s, x, y + Math.max(1.5, size * 0.06)); }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  return size;
}
export function para(ctx, s, x, y, w, { size = 28, weight = 500, color = T.text, align = 'left', lh = 1.32, fam = UI } = {}) {
  const lines = wrap(ctx, s, w, size, weight, fam), step = size * lh;
  setFont(ctx, size, weight, fam); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  lines.forEach((l, i) => ctx.fillText(l, ax, y + i * step));
  return lines.length * step;
}
export const paraHeight = (ctx, s, w, size, weight = 500, lh = 1.32, fam = UI) => wrap(ctx, s, w, size, weight, fam).length * size * lh;

// ---- shapes ----------------------------------------------------------------------------------------------------------------------
export const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); };
export function panel(ctx, r, { radius = 22, fill = T.panel, line = T.line } = {}) {
  if (isActive()) { put(ctx, { k: 'panel', r, radius, fill }); return; }
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.lineWidth = 1.5; ctx.strokeStyle = line; ctx.stroke(); }
}
export function background(ctx, w, h, t = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, T.bg0); g.addColorStop(1, T.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = Math.max(w, h) * 0.75, gx = w * (0.5 + 0.04 * Math.sin(t * 0.2)), gy = h * 0.04;
  const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
  rg.addColorStop(0, T.lamp); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
}

// Flat, clean button (no gloss). kind: 'solid' | 'accent' | 'ghost'. active = toggled on.
export function button(ctx, r, label, { kind = 'solid', active = false, disabled = false, size = 30, weight = 700, sub = '', icon = '', flash = 0, radius = 18, align = 'center', iconColor = null } = {}) {
  const accent = kind === 'accent', active3 = isActive();
  ctx.save();
  if (active3) put(ctx, { k: 'btn', r, radius, kind, on: active, disabled, flash });
  if (disabled) ctx.globalAlpha = 0.4;
  if (!active3) {
    rr(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fillStyle = accent ? T.accent : active ? T.accentSoft : kind === 'ghost' ? 'rgba(0,0,0,0)' : T.btn;
    ctx.fill();
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.28 * flash})`; ctx.fill(); }
    ctx.lineWidth = active ? 2.5 : 1.5; ctx.strokeStyle = active ? T.accent : accent ? 'rgba(0,0,0,0)' : T.line; ctx.stroke();
  }
  const col = accent ? T.onAccent : T.text, fs = F(size);
  const pad = Math.min(24, r.w * 0.08), isz = Math.min(r.h * 0.52, fs * 1.5);
  if (icon && label) {
    setFont(ctx, fs, weight);
    const tw = Math.min(ctx.measureText(label).width, r.w - pad * 2 - isz - 10), total = isz + 10 + tw, x0 = r.x + r.w / 2 - total / 2;
    icons[icon]?.(ctx, x0 + isz / 2, r.y + r.h / 2 + (sub ? -fs * 0.3 : 0), sub ? Math.min(isz, fs * 1.2) : isz, iconColor ?? col);
    txt(ctx, label, x0 + isz + 10, r.y + r.h / 2 + (sub ? -fs * 0.3 : 0), { size: fs, weight, color: col, maxW: tw + 2 });
  } else if (icon) icons[icon]?.(ctx, r.x + r.w / 2, r.y + r.h / 2, isz, iconColor ?? col);
  else if (label) txt(ctx, label, align === 'center' ? r.x + r.w / 2 : r.x + pad, r.y + r.h / 2 + (sub ? -fs * 0.34 : 0), { size: fs, weight, color: col, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2 });
  if (sub) txt(ctx, sub, align === 'center' ? r.x + r.w / 2 : r.x + pad, r.y + r.h / 2 + fs * 0.62, { size: F(Math.max(17, size * 0.6)), weight: 500, color: accent ? T.onAccent : T.dim, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2 });
  ctx.restore();
}

// ---- icons (centred on cx, cy, within `s`) -----------------------------------------------------------------------------------------
const stroke = (ctx, s, col, f) => { ctx.save(); ctx.lineWidth = Math.max(2, s * 0.11); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.beginPath(); f(); ctx.restore(); };
const fillIcon = (ctx, col, f) => { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); f(); ctx.fill(); ctx.restore(); };
export const icons = {
  pause(ctx, cx, cy, s, col) { ctx.save(); ctx.fillStyle = col; rr(ctx, cx - s * 0.26, cy - s * 0.3, s * 0.17, s * 0.6, s * 0.05); ctx.fill(); rr(ctx, cx + s * 0.09, cy - s * 0.3, s * 0.17, s * 0.6, s * 0.05); ctx.fill(); ctx.restore(); },
  play(ctx, cx, cy, s, col) { fillIcon(ctx, col, () => { ctx.moveTo(cx - s * 0.2, cy - s * 0.3); ctx.lineTo(cx + s * 0.32, cy); ctx.lineTo(cx - s * 0.2, cy + s * 0.3); ctx.closePath(); }); },
  exit(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.26, cy - s * 0.26); ctx.lineTo(cx + s * 0.26, cy + s * 0.26); ctx.moveTo(cx + s * 0.26, cy - s * 0.26); ctx.lineTo(cx - s * 0.26, cy + s * 0.26); ctx.stroke(); }); },
  minus(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.28, cy); ctx.lineTo(cx + s * 0.28, cy); ctx.stroke(); }); },
  plus(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.28, cy); ctx.lineTo(cx + s * 0.28, cy); ctx.moveTo(cx, cy - s * 0.28); ctx.lineTo(cx, cy + s * 0.28); ctx.stroke(); }); },
  back(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx + s * 0.14, cy - s * 0.3); ctx.lineTo(cx - s * 0.16, cy); ctx.lineTo(cx + s * 0.14, cy + s * 0.3); ctx.stroke(); }); },
  next(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.14, cy - s * 0.3); ctx.lineTo(cx + s * 0.16, cy); ctx.lineTo(cx - s * 0.14, cy + s * 0.3); ctx.stroke(); }); },
  check(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.3, cy + s * 0.02); ctx.lineTo(cx - s * 0.08, cy + s * 0.24); ctx.lineTo(cx + s * 0.32, cy - s * 0.22); ctx.stroke(); }); },
  bulb(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy - s * 0.1, s * 0.28, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.14, cy + s * 0.26); ctx.lineTo(cx + s * 0.14, cy + s * 0.26); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.1, cy + s * 0.38); ctx.lineTo(cx + s * 0.1, cy + s * 0.38); ctx.stroke(); }); },
  eye(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.4, cy); ctx.quadraticCurveTo(cx, cy - s * 0.4, cx + s * 0.4, cy); ctx.quadraticCurveTo(cx, cy + s * 0.4, cx - s * 0.4, cy); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.1, 0, 7); ctx.fill(); }); },
  star(ctx, cx, cy, s, col) { fillIcon(ctx, col, () => { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? s * 0.18 : s * 0.4; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.98 + s * 0.02); } ctx.closePath(); }); },
  heart(ctx, cx, cy, s, col) { fillIcon(ctx, col, () => { ctx.moveTo(cx, cy + s * 0.34); ctx.bezierCurveTo(cx - s * 0.5, cy, cx - s * 0.38, cy - s * 0.4, cx, cy - s * 0.14); ctx.bezierCurveTo(cx + s * 0.38, cy - s * 0.4, cx + s * 0.5, cy, cx, cy + s * 0.34); }); },
  gear(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.moveTo(cx + Math.cos(a) * s * 0.26, cy + Math.sin(a) * s * 0.26); ctx.lineTo(cx + Math.cos(a) * s * 0.38, cy + Math.sin(a) * s * 0.38); } ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.24, 0, 7); ctx.stroke(); }); },
  oven(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.roundRect(cx - s * 0.4, cy - s * 0.34, s * 0.8, s * 0.7, s * 0.1); ctx.stroke(); ctx.beginPath(); ctx.roundRect(cx - s * 0.26, cy - s * 0.14, s * 0.52, s * 0.34, s * 0.06); ctx.stroke(); }); },
  mould(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy - s * 0.04, s * 0.3, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.26); ctx.lineTo(cx, cy + s * 0.46); ctx.stroke(); }); },
  book(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.roundRect(cx - s * 0.34, cy - s * 0.36, s * 0.68, s * 0.72, s * 0.08); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.12, cy - s * 0.36); ctx.lineTo(cx - s * 0.12, cy + s * 0.36); ctx.stroke(); }); },
  lock(ctx, cx, cy, s, col) { fillIcon(ctx, col, () => { ctx.roundRect(cx - s * 0.3, cy - s * 0.04, s * 0.6, s * 0.42, s * 0.08); }); stroke(ctx, s, col, () => { ctx.arc(cx, cy - s * 0.06, s * 0.2, Math.PI, 0); ctx.stroke(); }); },
};

// A raised plaque for custom boxes (rack buttons, level tiles, banners). 2D fallback paints the flat look; 3D records a lacquered slab.
// kind: 'tile' | 'dark' | 'gold'. on = selected, line = flat outline colour, dim = locked.
export function slab(ctx, r, { radius = 16, kind = 'tile', on = false, flash = 0, fill = null, line = null, lw = 1.5, dim = false } = {}) {
  if (isActive()) { put(ctx, { k: 'slab', r, radius, kind, on, flash, dim }); return; }
  rr(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = fill ?? (on ? T.accentSoft : kind === 'dark' ? 'rgba(0,0,0,0.34)' : T.btn); ctx.fill();
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.25 * flash})`; ctx.fill(); }
  ctx.lineWidth = on ? 3 : lw; ctx.strokeStyle = line ?? (on ? T.accent : T.line); ctx.stroke();
}
