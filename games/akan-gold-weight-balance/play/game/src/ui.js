// Drawing kit: looks (palettes), text helpers, flat buttons, tiles with soft depth, icons.
import { host } from './layout.js';

import { v3 } from './v3.js';
export const UI = 'Fredoka, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const NUM = '"Dela Gothic One", "Arial Black", Impact, sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- looks ----------------------------------------------------------------------------------------------------------
// wood = [light, dark] table planks; tray = the weight box lining; brass = [highlight, body, shade]; cloth = woven strip.
export const LOOKS = {
  dusk: { name: 'Dusk', dark: true, bg0: '#2b1a45', bg1: '#0b0716', glow: 'rgba(255,190,90,0.14)', shell: 'rgba(255,214,140,0.055)', panel: 'rgba(255,255,255,0.065)', line: 'rgba(255,236,200,0.16)', text: '#fbf0d8', dim: 'rgba(251,240,216,0.66)', wood: ['#6a3f22', '#2e170a'], tray: '#1a0d08', trayLit: '#34190c', rim: '#e3b049', brass: ['#fff0b8', '#e5b246', '#7b4a10'], ink: '#3a2006', accent: '#f2bf4f', onAccent: '#2a1604', good: '#6fe3a6', err: '#ff6f55', sel: '#ffd36b', btn: 'rgba(255,255,255,0.09)', cloth: ['#c0452b', '#e9b64d', '#1c2f5a'] },
  ember: { name: 'Ember', dark: true, bg0: '#4a1d10', bg1: '#150703', glow: 'rgba(255,150,70,0.16)', shell: 'rgba(255,200,130,0.05)', panel: 'rgba(255,255,255,0.065)', line: 'rgba(255,225,185,0.17)', text: '#fff0da', dim: 'rgba(255,240,218,0.66)', wood: ['#5a3018', '#241008'], tray: '#160a05', trayLit: '#331808', rim: '#f0b95a', brass: ['#fff3c4', '#eab44a', '#80470c'], ink: '#331a05', accent: '#f6c45a', onAccent: '#2a1604', good: '#78e3a8', err: '#ff7a5e', sel: '#ffd86f', btn: 'rgba(255,255,255,0.09)', cloth: ['#e0562e', '#f2c45a', '#3d1a6a'] },
  sand: { name: 'Sand', dark: false, bg0: '#f6ead0', bg1: '#dcc79a', glow: 'rgba(255,255,255,0.55)', shell: 'rgba(120,80,30,0.075)', panel: 'rgba(70,40,10,0.06)', line: 'rgba(70,40,10,0.2)', text: '#2d2012', dim: 'rgba(45,32,18,0.66)', wood: ['#a8703d', '#6a3f1a'], tray: '#3a2412', trayLit: '#5a3a1c', rim: '#a8741f', brass: ['#fff0b8', '#dca43a', '#7b4a10'], ink: '#3a2006', accent: '#a8421a', onAccent: '#ffffff', good: '#1a8f5e', err: '#c2301c', sel: '#c9810a', btn: 'rgba(70,40,10,0.07)', cloth: ['#b8402a', '#d9a23c', '#233a6a'] },
};
export const LOOK_IDS = Object.keys(LOOKS);
let T = LOOKS.dusk, T3 = null;
// With the 3D layer on, every plaque is dark carved wood and brass, so text is always light whatever the look.
const lit = (L) => ({ ...L, dark: true, text: '#fbf0d8', dim: 'rgba(251,240,216,0.72)', line: 'rgba(255,236,200,0.22)' });
export const setLook = (id) => { T = LOOKS[id] ?? LOOKS.dusk; T3 = T.dark ? T : lit(T); };
export const theme = () => (v3.on && T3 ? T3 : T);

// ---- colour helpers ---------------------------------------------------------------------------------------------------
const hexRgb = (h) => (h[0] === 'r' ? h.slice(h.indexOf('(') + 1, h.indexOf(')')).split(',').slice(0, 3).map(Number) : [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const mixCache = new Map();
export function mix(a, b, t) {
  const key = a + b + t, hit = mixCache.get(key);
  if (hit) return hit;
  const x = hexRgb(a), y = hexRgb(b);
  const out = `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
  mixCache.set(key, out);
  return out;
}
export const rgba = (hex, a) => { const c = hexRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

// ---- text ----------------------------------------------------------------------------------------------------------------
export const F = (n) => Math.max(n, 12 / (host.px || 0.55));   // never below ~12 css px
export const setFont = (ctx, size, weight = 500, fam = UI) => { ctx.font = `${weight} ${size}px ${fam}`; };
const wrapCache = new Map();
export function wrap(ctx, text, maxW, size, weight = 500) {
  const key = `${size}|${weight}|${Math.round(maxW)}|${text}`;
  let out = wrapCache.get(key);
  if (out) return out;
  setFont(ctx, size, weight);
  out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  if (wrapCache.size > 600) wrapCache.clear();
  wrapCache.set(key, out);
  return out;
}
// Single line, shrunk (never below `min`) to fit maxW.
export function txt(ctx, s, x, y, { size = 28, weight = 500, color = theme().text, align = 'left', base = 'middle', maxW = 0, min = 0, fam = UI } = {}) {
  s = String(s);
  setFont(ctx, size, weight, fam);
  if (maxW) {
    const floor = Math.max(min || 10, 11.5 / (host.px || 0.55));   // never shrink below ~11.5 css px: cut with an ellipsis instead
    let w = ctx.measureText(s).width;
    while (w > maxW && size > floor) { size -= 1; setFont(ctx, size, weight, fam); w = ctx.measureText(s).width; }
    if (w > maxW && s.length > 3) { while (s.length > 3 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1); s += '…'; }
  }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(s, x, y);
  return size;
}
// Wrapped paragraph; returns its height.
export function para(ctx, s, x, y, w, { size = 28, weight = 500, color = theme().text, align = 'left', lh = 1.32 } = {}) {
  const lines = wrap(ctx, s, w, size, weight), step = size * lh;
  setFont(ctx, size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  lines.forEach((l, i) => ctx.fillText(l, ax, y + i * step));
  return lines.length * step;
}
export const paraHeight = (ctx, s, w, size, weight = 500, lh = 1.32) => wrap(ctx, s, w, size, weight).length * size * lh;

// ---- shapes --------------------------------------------------------------------------------------------------------------
export const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); };
export function panel(ctx, r, { radius = 22, fill = T.panel, line = T.line, kind = 'plate' } = {}) {
  if (v3.on) { v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad: radius, kind, clip: v3.clip, flash: 0, dim: 0 }); return; }
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.lineWidth = 1.5; ctx.strokeStyle = line; ctx.stroke(); }
}
// A recorded 3D plaque (v3.on) or the old flat rounded rect. Returns true when the 3D layer took it (caller skips its own fill).
export function plate(ctx, r, radius, { kind = 'plate', flash = 0, dim = 0 } = {}) {
  if (!v3.on) return false;
  v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad: radius, kind, clip: v3.clip, flash, dim });
  return true;
}
export function background(ctx, w, h, t = 0) {
  if (v3.on) { ctx.clearRect(0, 0, w, h); return; }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, T.bg0); g.addColorStop(1, T.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = Math.max(w, h) * 0.75, gx = w * (0.5 + 0.04 * Math.sin(t * 0.15)), gy = h * 0.3;
  const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
  rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  // a woven-mat lattice: one path of small diamonds, very faint
  const d = Math.max(54, Math.min(w, h) / 8);
  ctx.beginPath();
  for (let y = -d; y < h + d; y += d) for (let x = ((Math.round(y / d) & 1) ? d / 2 : 0) - d; x < w + d; x += d) { ctx.moveTo(x, y - d * 0.36); ctx.lineTo(x + d * 0.36, y); ctx.lineTo(x, y + d * 0.36); ctx.lineTo(x - d * 0.36, y); ctx.closePath(); }
  ctx.lineWidth = 1.5; ctx.strokeStyle = T.shell; ctx.stroke();
}

// Flat, clean button (no gloss). kind: 'solid' | 'accent' | 'ghost'. active = toggled on.
export function button(ctx, r, label, { kind = 'solid', active = false, disabled = false, size = 30, weight = 600, sub = '', icon = '', flash = 0, radius = 18, align = 'center' } = {}) {
  const accent = kind === 'accent';
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.4;
  if (v3.on) v3.buttons.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad: radius, accent, active, disabled, ghost: kind === 'ghost', flash, clip: v3.clip });
  else {
    rr(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fillStyle = accent ? T.accent : active ? rgba(T.accent.length === 7 ? T.accent : '#ff9459', 0.22) : kind === 'ghost' ? 'rgba(0,0,0,0)' : T.btn;
    ctx.fill();
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.28 * flash})`; ctx.fill(); }
    ctx.lineWidth = active ? 2.5 : 1.5; ctx.strokeStyle = active ? T.accent : accent ? 'rgba(0,0,0,0)' : T.line; ctx.stroke();
  }
  // On the 3D plaques the label sits on lacquer: light text on the dark wood, dark text on the gold accent.
  const col = accent ? (v3.on ? '#2b1604' : theme().onAccent) : (v3.on ? '#fbf0d8' : T.text), fs = F(size);
  const pad = Math.min(24, r.w * 0.08), hasIcon = !!icon, isz = Math.min(r.h * 0.5, fs * 1.4);
  if (hasIcon && label) {
    const tw = Math.min(txtW(ctx, label, fs, weight), r.w - pad * 2 - isz - 12), total = isz + 12 + tw, x0 = r.x + r.w / 2 - total / 2;
    icons[icon]?.(ctx, x0 + isz / 2, r.y + r.h / 2, isz, col);
    txt(ctx, label, x0 + isz + 12, r.y + r.h / 2 + (sub ? -fs * 0.3 : 0), { size: fs, weight, color: col, align: 'left', maxW: tw + 2, min: 12 });
  } else if (hasIcon) icons[icon]?.(ctx, r.x + r.w / 2, r.y + r.h / 2, isz, col);
  else if (label) txt(ctx, label, align === 'center' ? r.x + r.w / 2 : r.x + pad, r.y + r.h / 2 + (sub ? -fs * 0.34 : 0), { size: fs, weight, color: col, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2, min: 12 });
  if (sub) txt(ctx, sub, align === 'center' ? r.x + r.w / 2 : r.x + pad, r.y + r.h / 2 + fs * 0.62, { size: F(Math.max(18, size * 0.62)), weight: 400, color: accent ? (v3.on ? "#2b1604" : T.onAccent) : theme().dim, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2, min: 11 });
  ctx.restore();
}
function txtW(ctx, s, size, weight) { setFont(ctx, size, weight); return ctx.measureText(s).width; }

// ---- icons (stroke paths, centred on cx, cy, within `s`) -----------------------------------------------------------------------
const stroke = (ctx, s, col, f) => { ctx.save(); ctx.lineWidth = Math.max(2, s * 0.11); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.beginPath(); f(); ctx.restore(); };
export const icons = {
  undo(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy + s * 0.04, s * 0.3, Math.PI * 1.1, Math.PI * 2.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.36, cy - s * 0.22); ctx.lineTo(cx - s * 0.3, cy + s * 0.02); ctx.lineTo(cx - s * 0.06, cy - s * 0.08); ctx.stroke(); }); },
  redo(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy + s * 0.04, s * 0.3, Math.PI * 0.9, Math.PI * -0.1, true); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.36, cy - s * 0.22); ctx.lineTo(cx + s * 0.3, cy + s * 0.02); ctx.lineTo(cx + s * 0.06, cy - s * 0.08); ctx.stroke(); }); },
  erase(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.1, cy + s * 0.3); ctx.lineTo(cx - s * 0.38, cy + s * 0.02); ctx.lineTo(cx - s * 0.04, cy - s * 0.32); ctx.lineTo(cx + s * 0.34, cy + s * 0.04); ctx.lineTo(cx + s * 0.08, cy + s * 0.3); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.28, cy + s * 0.12); ctx.lineTo(cx + s * 0.14, cy - s * 0.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.1, cy + s * 0.34); ctx.lineTo(cx + s * 0.38, cy + s * 0.34); ctx.stroke(); }); },
  pencil(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.32, cy + s * 0.34); ctx.lineTo(cx - s * 0.26, cy + s * 0.1); ctx.lineTo(cx + s * 0.16, cy - s * 0.32); ctx.lineTo(cx + s * 0.36, cy - s * 0.12); ctx.lineTo(cx - s * 0.06, cy + s * 0.3); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.06, cy - s * 0.22); ctx.lineTo(cx + s * 0.26, cy - s * 0.02); ctx.stroke(); }); },
  bulb(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy - s * 0.1, s * 0.28, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.14, cy + s * 0.26); ctx.lineTo(cx + s * 0.14, cy + s * 0.26); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.1, cy + s * 0.38); ctx.lineTo(cx + s * 0.1, cy + s * 0.38); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy + s * 0.12); ctx.lineTo(cx - s * 0.12, cy + s * 0.26); ctx.moveTo(cx + s * 0.2, cy + s * 0.12); ctx.lineTo(cx + s * 0.12, cy + s * 0.26); ctx.stroke(); }); },
  fill(ctx, cx, cy, s, col) { ctx.save(); ctx.fillStyle = col; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(cx + (j - 1) * s * 0.26, cy + (i - 1) * s * 0.26, s * 0.075, 0, 7); ctx.fill(); } ctx.restore(); },
  pause(ctx, cx, cy, s, col) { ctx.save(); ctx.fillStyle = col; rr(ctx, cx - s * 0.26, cy - s * 0.3, s * 0.17, s * 0.6, s * 0.05); ctx.fill(); rr(ctx, cx + s * 0.09, cy - s * 0.3, s * 0.17, s * 0.6, s * 0.05); ctx.fill(); ctx.restore(); },
  play(ctx, cx, cy, s, col) { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy - s * 0.3); ctx.lineTo(cx + s * 0.32, cy); ctx.lineTo(cx - s * 0.2, cy + s * 0.3); ctx.closePath(); ctx.fill(); ctx.restore(); },
  exit(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.26, cy - s * 0.26); ctx.lineTo(cx + s * 0.26, cy + s * 0.26); ctx.moveTo(cx + s * 0.26, cy - s * 0.26); ctx.lineTo(cx - s * 0.26, cy + s * 0.26); ctx.stroke(); }); },
  minus(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.28, cy); ctx.lineTo(cx + s * 0.28, cy); ctx.stroke(); }); },
  plus(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.28, cy); ctx.lineTo(cx + s * 0.28, cy); ctx.moveTo(cx, cy - s * 0.28); ctx.lineTo(cx, cy + s * 0.28); ctx.stroke(); }); },
  back(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx + s * 0.14, cy - s * 0.3); ctx.lineTo(cx - s * 0.16, cy); ctx.lineTo(cx + s * 0.14, cy + s * 0.3); ctx.stroke(); }); },
  next(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.14, cy - s * 0.3); ctx.lineTo(cx + s * 0.16, cy); ctx.lineTo(cx - s * 0.14, cy + s * 0.3); ctx.stroke(); }); },
  check(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.3, cy + s * 0.02); ctx.lineTo(cx - s * 0.08, cy + s * 0.24); ctx.lineTo(cx + s * 0.32, cy - s * 0.22); ctx.stroke(); }); },
  gear(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.moveTo(cx + Math.cos(a) * s * 0.26, cy + Math.sin(a) * s * 0.26); ctx.lineTo(cx + Math.cos(a) * s * 0.38, cy + Math.sin(a) * s * 0.38); } ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.24, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.09, 0, 7); ctx.stroke(); }); },
  star(ctx, cx, cy, s, col) { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? s * 0.18 : s * 0.4; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.98 + s * 0.02); } ctx.closePath(); ctx.fill(); ctx.restore(); },
  flame(ctx, cx, cy, s, col) { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.4); ctx.bezierCurveTo(cx + s * 0.1, cy - s * 0.15, cx + s * 0.36, cy - s * 0.05, cx + s * 0.26, cy + s * 0.22); ctx.bezierCurveTo(cx + s * 0.2, cy + s * 0.4, cx - s * 0.2, cy + s * 0.4, cx - s * 0.26, cy + s * 0.2); ctx.bezierCurveTo(cx - s * 0.32, cy, cx - s * 0.1, cy - s * 0.1, cx, cy - s * 0.4); ctx.fill(); ctx.restore(); },
  eye(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.4, cy); ctx.quadraticCurveTo(cx, cy - s * 0.4, cx + s * 0.4, cy); ctx.quadraticCurveTo(cx, cy + s * 0.4, cx - s * 0.4, cy); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.1, 0, 7); ctx.fill(); }); },
};
icons.pour = (ctx, cx, cy, s, col) => stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.34, cy - s * 0.3); ctx.lineTo(cx + s * 0.1, cy - s * 0.3); ctx.lineTo(cx + s * 0.1, cy - s * 0.02); ctx.lineTo(cx - s * 0.34, cy - s * 0.02); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.12, cy + s * 0.1); ctx.lineTo(cx - s * 0.12, cy + s * 0.38); ctx.moveTo(cx - s * 0.26, cy + s * 0.2); ctx.lineTo(cx - s * 0.26, cy + s * 0.38); ctx.moveTo(cx + s * 0.02, cy + s * 0.2); ctx.lineTo(cx + s * 0.02, cy + s * 0.38); ctx.stroke(); });
icons.clear = icons.erase;
export const clampN = clamp;
