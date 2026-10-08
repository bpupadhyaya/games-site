// Drawing kit: looks (palettes), text helpers, flat buttons, icons. Nothing here knows about crosswords.
import { host } from './layout.js';

export const UI = 'Barlow, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const SERIF = 'Cormorant, Georgia, "Times New Roman", serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- looks ----------------------------------------------------------------------------------------------------------
export const LOOKS = {
  newsprint: { name: 'Newsprint', dark: true, bg0: '#17505c', bg1: '#071820', glow: 'rgba(120,230,230,0.14)', grid: 'rgba(255,255,255,0.035)', panel: 'rgba(255,255,255,0.07)', line: 'rgba(255,255,255,0.16)', text: '#f6f1e4', dim: 'rgba(246,241,228,0.66)', frame: '#0c242c', rim: '#2f7280', paper: '#f8f2e2', paperLo: '#e9e0c8', ink: '#1d2332', gridLine: 'rgba(29,35,50,0.5)', block: '#1b2130', blockHi: '#343c52', word: '#c8e4f4', sel: '#ffc84a', letter: '#1b2233', pencil: '#8b8f9c', num: 'rgba(27,34,51,0.78)', err: '#d73a30', errTint: '#f7c4bd', accent: '#ffb53f', onAccent: '#2a1805', good: '#37c88f', btn: 'rgba(255,255,255,0.1)', key: '#f4ecd8', keyLo: '#cdc2a4', keyInk: '#1d2332' },
  sunday: { name: 'Sunday', dark: false, bg0: '#f6ecd3', bg1: '#dccfa8', glow: 'rgba(255,255,255,0.55)', grid: 'rgba(80,60,20,0.05)', panel: 'rgba(60,40,10,0.07)', line: 'rgba(60,40,10,0.2)', text: '#2b2a33', dim: 'rgba(43,42,51,0.64)', frame: '#6d5c3c', rim: '#a8946a', paper: '#fffdf6', paperLo: '#f1e8cf', ink: '#232734', gridLine: 'rgba(35,39,52,0.5)', block: '#232734', blockHi: '#444b63', word: '#cfe5f6', sel: '#ffc23c', letter: '#1c2234', pencil: '#8e929e', num: 'rgba(35,39,52,0.78)', err: '#d23a30', errTint: '#f6c4bc', accent: '#d9531e', onAccent: '#ffffff', good: '#1d9d6b', btn: 'rgba(60,40,10,0.08)', key: '#fffdf6', keyLo: '#d9cfae', keyInk: '#232734' },
  midnight: { name: 'Midnight', dark: true, bg0: '#1a1b3a', bg1: '#05050f', glow: 'rgba(130,120,255,0.13)', grid: 'rgba(255,255,255,0.03)', panel: 'rgba(255,255,255,0.06)', line: 'rgba(255,255,255,0.15)', text: '#eceefb', dim: 'rgba(236,238,251,0.62)', frame: '#08081a', rim: '#2a2f5c', paper: '#2b3358', paperLo: '#1f2645', ink: '#0c0e1e', gridLine: 'rgba(160,170,230,0.32)', block: '#080913', blockHi: '#222645', word: '#46508a', sel: '#ffb347', letter: '#f2f4ff', pencil: '#9aa3d0', num: 'rgba(235,238,255,0.72)', err: '#ff6b5e', errTint: '#6d2c33', accent: '#7fd6ff', onAccent: '#03141f', good: '#5ae3ad', btn: 'rgba(255,255,255,0.09)', key: '#394272', keyLo: '#1e2447', keyInk: '#f2f4ff' },
  contrast: { name: 'Contrast', dark: true, bg0: '#101010', bg1: '#000000', glow: 'rgba(255,255,255,0.05)', grid: 'rgba(255,255,255,0.03)', panel: 'rgba(255,255,255,0.09)', line: 'rgba(255,255,255,0.3)', text: '#ffffff', dim: 'rgba(255,255,255,0.78)', frame: '#000000', rim: '#ffffff', paper: '#ffffff', paperLo: '#e8e8e8', ink: '#000000', gridLine: 'rgba(0,0,0,0.85)', block: '#000000', blockHi: '#333333', word: '#9fd0ff', sel: '#ffe000', letter: '#000000', pencil: '#5a5a5a', num: 'rgba(0,0,0,0.92)', err: '#d00000', errTint: '#ffb0b0', accent: '#ffe000', onAccent: '#000000', good: '#00d27a', btn: 'rgba(255,255,255,0.14)', key: '#ffffff', keyLo: '#bdbdbd', keyInk: '#000000' },
};
export const LOOK_IDS = Object.keys(LOOKS);
let T = LOOKS.newsprint;
export const setLook = (id) => { T = LOOKS[id] ?? LOOKS.newsprint; };
export const theme = () => T;

// ---- colour helpers ---------------------------------------------------------------------------------------------------
const hexRgb = (h) => (h[0] === 'r' ? h.slice(h.indexOf('(') + 1, h.indexOf(')')).split(',').slice(0, 3).map(Number) : [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const mixCache = new Map();
export function mix(a, b, t) {
  const key = a + b + t, hit = mixCache.get(key);
  if (hit) return hit;
  const x = hexRgb(a), y = hexRgb(b);
  const out = `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
  if (mixCache.size > 4000) mixCache.clear();
  mixCache.set(key, out);
  return out;
}
export const rgba = (hex, a) => { const c = hexRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

// ---- text ----------------------------------------------------------------------------------------------------------------
export const F = (n) => Math.max(n, 12 / (host.px || 0.55));   // never below ~12 css px
export const setFont = (ctx, size, weight = 600, serif = false) => { ctx.font = serif ? `700 ${size}px ${SERIF}` : `${weight} ${size}px ${UI}`; };
const wrapCache = new Map();
export function wrap(ctx, text, maxW, size, weight = 600) {
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
  if (wrapCache.size > 800) wrapCache.clear();
  wrapCache.set(key, out);
  return out;
}
// Single line, shrunk (never below `min`) to fit maxW, then cut with an ellipsis.
export function txt(ctx, s, x, y, { size = 28, weight = 600, color = T.text, align = 'left', base = 'middle', maxW = 0, min = 0, serif = false } = {}) {
  s = String(s);
  setFont(ctx, size, weight, serif);
  if (maxW) {
    const floor = Math.max(min || 10, 11.5 / (host.px || 0.55));
    let w = ctx.measureText(s).width;
    while (w > maxW && size > floor) { size -= 1; setFont(ctx, size, weight, serif); w = ctx.measureText(s).width; }
    if (w > maxW && s.length > 3) { while (s.length > 3 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1); s += '…'; }
  }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(s, x, y);
  return size;
}
// Wrapped paragraph; returns its height. `maxLines` cuts with an ellipsis.
export function para(ctx, s, x, y, w, { size = 28, weight = 600, color = T.text, align = 'left', lh = 1.3, maxLines = 0 } = {}) {
  let lines = wrap(ctx, s, w, size, weight);
  if (maxLines && lines.length > maxLines) { lines = lines.slice(0, maxLines); let last = lines[maxLines - 1]; setFont(ctx, size, weight); while (last.length > 2 && ctx.measureText(last + '…').width > w) last = last.slice(0, -1); lines[maxLines - 1] = last + '…'; }
  const step = size * lh;
  setFont(ctx, size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  lines.forEach((l, i) => ctx.fillText(l, ax, y + i * step));
  return lines.length * step;
}
export const paraHeight = (ctx, s, w, size, weight = 600, lh = 1.3) => wrap(ctx, s, w, size, weight).length * size * lh;

// ---- shapes --------------------------------------------------------------------------------------------------------------
export const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); };
export function panel(ctx, r, { radius = 22, fill = T.panel, line = T.line } = {}) {
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.lineWidth = 1.5; ctx.strokeStyle = line; ctx.stroke(); }
}
// The desk behind the paper: a deep gradient with a faint printed grid and a soft lamp glow.
export function background(ctx, w, h, t = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, T.bg0); g.addColorStop(1, T.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = Math.max(w, h) * 0.7, gx = w * (0.28 + 0.04 * Math.sin(t * 0.15)), gy = h * 0.14;
  const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
  rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  // faint graph-paper lattice (one path, cheap)
  const s = 64;
  ctx.beginPath();
  for (let x = s; x < w; x += s) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = s; y < h; y += s) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.lineWidth = 1.5; ctx.strokeStyle = T.grid; ctx.stroke();
}

// Flat, clean button (no gloss). kind: 'solid' | 'accent' | 'ghost'. active = toggled on.
export function button(ctx, r, label, { kind = 'solid', active = false, disabled = false, size = 30, weight = 700, sub = '', icon = '', flash = 0, radius = 18, align = 'center' } = {}) {
  const accent = kind === 'accent';
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.4;
  rr(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = accent ? T.accent : active ? rgba(T.accent, 0.24) : kind === 'ghost' ? 'rgba(0,0,0,0)' : T.btn;
  ctx.fill();
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.3 * flash})`; ctx.fill(); }
  ctx.lineWidth = active ? 2.5 : 1.5; ctx.strokeStyle = active ? T.accent : accent ? 'rgba(0,0,0,0)' : T.line; ctx.stroke();
  const col = accent ? T.onAccent : T.text, fs = F(size);
  const pad = Math.min(24, r.w * 0.08), hasIcon = !!icon, isz = Math.min(r.h * 0.5, fs * 1.4);
  if (hasIcon && label) {
    const tw = Math.min(txtW(ctx, label, fs, weight), r.w - pad * 2 - isz - 12), total = isz + 12 + tw, x0 = r.x + r.w / 2 - total / 2;
    icons[icon]?.(ctx, x0 + isz / 2, r.y + r.h / 2, isz, col);
    txt(ctx, label, x0 + isz + 12, r.y + r.h / 2 + (sub ? -fs * 0.3 : 0), { size: fs, weight, color: col, align: 'left', maxW: tw + 2, min: 12 });
  } else if (hasIcon) icons[icon]?.(ctx, r.x + r.w / 2, r.y + r.h / 2, isz, col);
  else if (label) txt(ctx, label, align === 'center' ? r.x + r.w / 2 : r.x + pad, r.y + r.h / 2 + (sub ? -fs * 0.34 : 0), { size: fs, weight, color: col, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2, min: 12 });
  if (sub) txt(ctx, sub, align === 'center' ? r.x + r.w / 2 : r.x + pad, r.y + r.h / 2 + fs * 0.62, { size: F(Math.max(18, size * 0.62)), weight: 500, color: accent ? T.onAccent : T.dim, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2, min: 11 });
  ctx.restore();
}
function txtW(ctx, s, size, weight) { setFont(ctx, size, weight); return ctx.measureText(s).width; }

// A keyboard key: one flat cap with a soft drop shadow, no inner shapes.
export function keycap(ctx, r, label, { pressed = 0, disabled = false, accent = false, size = 0, icon = '' } = {}) {
  const rad = Math.min(r.w, r.h) * 0.2, dy = pressed * 3, fh = r.h - 5;
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.45;
  rr(ctx, r.x, r.y + 4, r.w, fh, rad); ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fill();
  rr(ctx, r.x, r.y + dy, r.w, fh, rad); ctx.fillStyle = accent ? T.accent : T.key; ctx.fill();
  const cx = r.x + r.w / 2, cy = r.y + dy + fh / 2, col = accent ? T.onAccent : T.keyInk;
  if (icon) icons[icon](ctx, cx, cy, Math.min(r.w, r.h) * 0.5, col);
  else txt(ctx, label, cx, cy + 1, { size: size || Math.min(r.w * 0.58, fh * 0.52), weight: 800, color: col, align: 'center' });
  ctx.restore();
}

// ---- icons (stroke paths, centred on cx, cy, within `s`) -----------------------------------------------------------------------
const stroke = (ctx, s, col, f) => { ctx.save(); ctx.lineWidth = Math.max(2, s * 0.11); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.beginPath(); f(); ctx.restore(); };
export const icons = {
  zoom(ctx, cx, cy, s, col) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, s * 0.1); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx - s * 0.06, cy - s * 0.06, s * 0.27, 0, 7); ctx.moveTo(cx + s * 0.14, cy + s * 0.14); ctx.lineTo(cx + s * 0.36, cy + s * 0.36); ctx.moveTo(cx - s * 0.18, cy - s * 0.06); ctx.lineTo(cx + s * 0.06, cy - s * 0.06); ctx.moveTo(cx - s * 0.06, cy - s * 0.18); ctx.lineTo(cx - s * 0.06, cy + s * 0.06); ctx.stroke(); ctx.restore(); },
  undo(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy + s * 0.04, s * 0.3, Math.PI * 1.1, Math.PI * 2.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.36, cy - s * 0.22); ctx.lineTo(cx - s * 0.3, cy + s * 0.02); ctx.lineTo(cx - s * 0.06, cy - s * 0.08); ctx.stroke(); }); },
  redo(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy + s * 0.04, s * 0.3, Math.PI * 0.9, Math.PI * -0.1, true); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.36, cy - s * 0.22); ctx.lineTo(cx + s * 0.3, cy + s * 0.02); ctx.lineTo(cx + s * 0.06, cy - s * 0.08); ctx.stroke(); }); },
  pencil(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.32, cy + s * 0.34); ctx.lineTo(cx - s * 0.26, cy + s * 0.1); ctx.lineTo(cx + s * 0.16, cy - s * 0.32); ctx.lineTo(cx + s * 0.36, cy - s * 0.12); ctx.lineTo(cx - s * 0.06, cy + s * 0.3); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.06, cy - s * 0.22); ctx.lineTo(cx + s * 0.26, cy - s * 0.02); ctx.stroke(); }); },
  bulb(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy - s * 0.1, s * 0.28, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.14, cy + s * 0.26); ctx.lineTo(cx + s * 0.14, cy + s * 0.26); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.1, cy + s * 0.38); ctx.lineTo(cx + s * 0.1, cy + s * 0.38); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy + s * 0.12); ctx.lineTo(cx - s * 0.12, cy + s * 0.26); ctx.moveTo(cx + s * 0.2, cy + s * 0.12); ctx.lineTo(cx + s * 0.12, cy + s * 0.26); ctx.stroke(); }); },
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
  eye(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.4, cy); ctx.quadraticCurveTo(cx, cy - s * 0.4, cx + s * 0.4, cy); ctx.quadraticCurveTo(cx, cy + s * 0.4, cx - s * 0.4, cy); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.1, 0, 7); ctx.fill(); }); },
  list(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { for (let i = -1; i <= 1; i++) { ctx.moveTo(cx - s * 0.12, cy + i * s * 0.26); ctx.lineTo(cx + s * 0.36, cy + i * s * 0.26); ctx.moveTo(cx - s * 0.36, cy + i * s * 0.26); ctx.lineTo(cx - s * 0.28, cy + i * s * 0.26); } ctx.stroke(); }); },
  del(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.42, cy); ctx.lineTo(cx - s * 0.16, cy - s * 0.3); ctx.lineTo(cx + s * 0.4, cy - s * 0.3); ctx.lineTo(cx + s * 0.4, cy + s * 0.3); ctx.lineTo(cx - s * 0.16, cy + s * 0.3); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.02, cy - s * 0.12); ctx.lineTo(cx + s * 0.22, cy + s * 0.12); ctx.moveTo(cx + s * 0.22, cy - s * 0.12); ctx.lineTo(cx - s * 0.02, cy + s * 0.12); ctx.stroke(); }); },
  mark(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.32, cy + s * 0.02); ctx.lineTo(cx - s * 0.1, cy + s * 0.26); ctx.lineTo(cx + s * 0.32, cy - s * 0.26); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, 0, 7); ctx.stroke(); }); },
  swap(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.36, cy - s * 0.12); ctx.lineTo(cx + s * 0.34, cy - s * 0.12); ctx.moveTo(cx + s * 0.18, cy - s * 0.28); ctx.lineTo(cx + s * 0.34, cy - s * 0.12); ctx.lineTo(cx + s * 0.18, cy + s * 0.04); ctx.moveTo(cx + s * 0.36, cy + s * 0.2); ctx.lineTo(cx - s * 0.34, cy + s * 0.2); ctx.moveTo(cx - s * 0.18, cy + s * 0.04); ctx.lineTo(cx - s * 0.34, cy + s * 0.2); ctx.lineTo(cx - s * 0.18, cy + s * 0.36); ctx.stroke(); }); },
};
export const clampN = clamp;
