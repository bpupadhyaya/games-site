// Drawing kit: palette, text helpers, flat buttons, panels and small icons. Pure canvas, no DOM.
import { host } from './layout.js';
import { v3, place } from './v3.js';

export const UI = 'Barlow, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const NUM = '"Barlow Condensed", Barlow, system-ui, sans-serif';
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// One look: a night street stall. Iron, ember, warm paper, awning red, brass.
export const T = {
  bg0: '#2a1712', bg1: '#0d0706', lamp: 'rgba(255,184,96,0.20)',
  panel: 'rgba(255,240,215,0.07)', line: 'rgba(255,225,190,0.18)',
  text: '#fbf1dc', dim: 'rgba(251,241,220,0.70)', faint: 'rgba(251,241,220,0.42)',
  accent: '#f2a93b', onAccent: '#2a1304', accent2: '#e2483a', good: '#8be08a', bad: '#ff6a55',
  btn: 'rgba(255,240,215,0.09)', iron0: '#3b3b41', iron1: '#17171b', rim: '#6c6c76',
  paper: '#f6ecd5', paperDim: '#e3d3b0', ink: '#2a1b12', red: '#d6402f', cream: '#f8ecd2',
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
// Height of a shift-list stall header at text scale sc: the name, then the blurb wrapped to the card width (so 300% text never touches the card edge).
let _mctx = null;
export function shiftHeads(stalls, bodyW, sc) {
  if (!_mctx && typeof OffscreenCanvas !== 'undefined') _mctx = new OffscreenCanvas(4, 4).getContext('2d');
  const k = Math.min(sc, 1.5), nameS = F(36 * k), blurbS = F(21 * k);
  return stalls.map((st) => 18 + nameS * 1.2 + 6 + (_mctx ? paraHeight(_mctx, st.blurb, bodyW - 36, blurbS, 500) : Math.ceil(st.blurb.length * blurbS * 0.52 / (bodyW - 36)) * blurbS * 1.32) + 16);
}
export const paraHeight = (ctx, s, w, size, weight = 500, lh = 1.32, fam = UI) => wrap(ctx, s, w, size, weight, fam).length * size * lh;

// ---- shapes ----------------------------------------------------------------------------------------------------------------------
export const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); };
export function panel(ctx, r, { radius = 22, fill = T.panel, line = T.line, kind = 'ink' } = {}) {
  if (v3.on) { v3.panels.push({ layer: v3.layer, r: place(r), clip: v3.clip, rad: radius, kind, tint: fill }); return; }   // the 3D layer draws the lit plaque
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.lineWidth = 1.5; ctx.strokeStyle = line; ctx.stroke(); }
}
// A plain rounded fill (banner, toasts, tickets...). 3D layer: registered as a lit plaque of `kind`; flat 2D: drawn as given.
export function slab(ctx, r, { radius = 16, fill = 'rgba(0,0,0,0.32)', line = null, lineWidth = 1.5, kind = 'ink', hdr = null, hdrSide = 'top', hdrH = 0, alpha = 1, urgent = false, hot = false } = {}) {
  if (v3.on) { v3.panels.push({ layer: v3.layer, r: place(r), clip: v3.clip, rad: radius, kind, hdr, hdrSide, hdrH, tint: fill, alpha, urgent, hot }); return; }
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.lineWidth = lineWidth; ctx.strokeStyle = line; ctx.stroke(); }
}
export function background(ctx, w, h, t = 0) {
  if (v3.on) return;   // the lit stall behind the transparent canvas is the background
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
  const accent = kind === 'accent';
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.4;
  if (v3.on) v3.buttons.push({ layer: v3.layer, r: place(r), clip: v3.clip, primary: accent, on: active, dim: disabled, flash, radius });
  else {
    rr(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fillStyle = accent ? T.accent : active ? 'rgba(242,169,59,0.22)' : kind === 'ghost' ? 'rgba(0,0,0,0)' : T.btn;
    ctx.fill();
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.28 * flash})`; ctx.fill(); }
    ctx.lineWidth = active ? 2.5 : 1.5; ctx.strokeStyle = active ? T.accent : accent ? 'rgba(0,0,0,0)' : T.line; ctx.stroke();
  }
  const col = accent ? T.onAccent : T.text, fs = F(size);
  const pad = Math.min(24, r.w * 0.08), isz = Math.min(r.h * 0.52, fs * 1.5);
  if (icon && label) {
    setFont(ctx, fs, weight);
    const tw = Math.min(ctx.measureText(label).width, r.w - pad * 2 - isz - 10), total = isz + 10 + tw, x0 = r.x + r.w / 2 - total / 2;
    icons[icon]?.(ctx, x0 + isz / 2, r.y + r.h / 2, isz, iconColor ?? col);
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
  flame(ctx, cx, cy, s, col) { fillIcon(ctx, col, () => { ctx.moveTo(cx, cy - s * 0.44); ctx.bezierCurveTo(cx + s * 0.1, cy - s * 0.15, cx + s * 0.36, cy - s * 0.05, cx + s * 0.28, cy + s * 0.22); ctx.bezierCurveTo(cx + s * 0.22, cy + s * 0.42, cx - s * 0.22, cy + s * 0.42, cx - s * 0.28, cy + s * 0.2); ctx.bezierCurveTo(cx - s * 0.34, cy, cx - s * 0.1, cy - s * 0.1, cx, cy - s * 0.44); }); },
  ladle(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx + s * 0.36, cy - s * 0.36); ctx.lineTo(cx - s * 0.02, cy + s * 0.02); ctx.stroke(); ctx.beginPath(); ctx.arc(cx - s * 0.16, cy + s * 0.16, s * 0.2, 0, 7); ctx.stroke(); }); },
  picks(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.36, cy + s * 0.36); ctx.lineTo(cx + s * 0.1, cy - s * 0.36); ctx.moveTo(cx - s * 0.1, cy + s * 0.36); ctx.lineTo(cx + s * 0.36, cy - s * 0.3); ctx.stroke(); }); },
  gear(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.moveTo(cx + Math.cos(a) * s * 0.26, cy + Math.sin(a) * s * 0.26); ctx.lineTo(cx + Math.cos(a) * s * 0.38, cy + Math.sin(a) * s * 0.38); } ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.24, 0, 7); ctx.stroke(); }); },
};
// Small filling pictograms (also reused as the ticket and tool icons). Drawn at (cx, cy) within `s`.
export function fillingIcon(ctx, id, cx, cy, s) {
  ctx.save();
  if (id === 'cheese') {
    ctx.fillStyle = '#ffcf3d'; ctx.beginPath(); ctx.moveTo(cx - s * 0.42, cy + s * 0.26); ctx.lineTo(cx + s * 0.42, cy + s * 0.26); ctx.lineTo(cx + s * 0.42, cy - s * 0.02); ctx.lineTo(cx - s * 0.42, cy - s * 0.3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e0a21a'; for (const [x, y, r] of [[-0.15, 0.12, 0.08], [0.18, 0.1, 0.06], [0.25, -0.03, 0.05]]) { ctx.beginPath(); ctx.arc(cx + x * s, cy + y * s, r * s, 0, 7); ctx.fill(); }
  } else if (id === 'corn') {
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.2, s * 0.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d9a31a'; for (let i = -2; i <= 2; i++) for (let j = -3; j <= 3; j += 2) { ctx.beginPath(); ctx.arc(cx + i * s * 0.07, cy + j * s * 0.1 + (i % 2) * s * 0.05, s * 0.025, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#6cae3e'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy + s * 0.34); ctx.quadraticCurveTo(cx - s * 0.05, cy + s * 0.02, cx - s * 0.16, cy - s * 0.2); ctx.stroke();
  } else if (id === 'mushroom') {
    ctx.fillStyle = '#efe0c8'; rr(ctx, cx - s * 0.1, cy, s * 0.2, s * 0.36, s * 0.05); ctx.fill();
    ctx.fillStyle = '#b7824f'; ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.02, s * 0.42, s * 0.3, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#e8c9a0'; for (const [x, y] of [[-0.16, -0.14], [0.12, -0.2], [0.2, -0.08]]) { ctx.beginPath(); ctx.arc(cx + x * s, cy + y * s, s * 0.04, 0, 7); ctx.fill(); }
  } else if (id === 'onion') {
    ctx.fillStyle = '#7bd35a'; for (const [x, a] of [[-0.18, -0.25], [0, 0.0], [0.18, 0.25]]) { ctx.save(); ctx.translate(cx + x * s, cy + s * 0.3); ctx.rotate(a); rr(ctx, -s * 0.06, -s * 0.7, s * 0.12, s * 0.7, s * 0.06); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#f2f6dc'; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.32, s * 0.2, s * 0.08, 0, 0, 7); ctx.fill();
  } else { // plain: a little batter dot
    ctx.fillStyle = '#f2dfae'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.28, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(120,80,20,0.5)'; ctx.lineWidth = s * 0.05; ctx.stroke();
  }
  ctx.restore();
}
