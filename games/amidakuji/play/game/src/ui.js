// Drawing kit: looks (palettes), text helpers, flat buttons, tiles with soft depth, icons.
import { host } from './layout.js';
import { v3 } from './v3.js';

export const UI = 'Fredoka, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const NUM = '"Dela Gothic One", Fredoka, system-ui, sans-serif';
export const CJK = '"Hiragino Mincho ProN", "Hiragino Sans", "Yu Mincho", "Noto Serif CJK JP", "Noto Sans CJK JP", "Yu Gothic", "PingFang SC", serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- looks ----------------------------------------------------------------------------------------------------------
// ink = ladder lines, rung = brush rungs, lamp = colour list index shift is not used (lantern colours are shared by every look).
export const LOOKS = {
  indigo: { name: 'Indigo', dark: true, bg0: '#1b2352', bg1: '#080b21', glow: 'rgba(255,200,110,0.14)', shell: 'rgba(255,225,160,0.05)', panel: 'rgba(255,255,255,0.065)', line: 'rgba(255,255,255,0.16)', text: '#f6efdc', dim: 'rgba(246,239,220,0.68)', ink: '#e9dcb4', inkDim: 'rgba(233,220,180,0.4)', rung: '#f4d27a', fixed: '#fff3d0', paper: '#2a3366', paperLine: '#c9b574', accent: '#f2c35b', onAccent: '#2b1d05', good: '#6fe3a8', err: '#ff7058', btn: 'rgba(255,255,255,0.09)', slot: 'rgba(255,230,160,0.22)' },
  washi: { name: 'Washi', dark: false, bg0: '#f6efde', bg1: '#dccfae', glow: 'rgba(255,255,255,0.6)', shell: 'rgba(120,90,40,0.07)', panel: 'rgba(60,40,10,0.06)', line: 'rgba(60,40,10,0.2)', text: '#2a2118', dim: 'rgba(42,33,24,0.66)', ink: '#2b2622', inkDim: 'rgba(43,38,34,0.36)', rung: '#c2301f', fixed: '#2b2622', paper: '#fbf5e4', paperLine: '#8a6d36', accent: '#c2301f', onAccent: '#ffffff', good: '#1d8f62', err: '#c4281a', btn: 'rgba(60,40,10,0.07)', slot: 'rgba(60,40,10,0.18)' },
  ember: { name: 'Ember', dark: true, bg0: '#4a1a14', bg1: '#170605', glow: 'rgba(255,150,90,0.15)', shell: 'rgba(255,190,120,0.05)', panel: 'rgba(255,255,255,0.065)', line: 'rgba(255,225,190,0.18)', text: '#fbeed6', dim: 'rgba(251,238,214,0.67)', ink: '#f1d9b4', inkDim: 'rgba(241,217,180,0.38)', rung: '#ffb347', fixed: '#fff1d6', paper: '#3a1511', paperLine: '#d9a85a', accent: '#ffb347', onAccent: '#2a1204', good: '#7fe3a8', err: '#ff6f58', btn: 'rgba(255,255,255,0.09)', slot: 'rgba(255,210,150,0.22)' },
};
export const LOOK_IDS = Object.keys(LOOKS);
let T = LOOKS.indigo;
export const setLook = (id) => { T = LOOKS[id] ?? LOOKS.indigo; };
export const theme = () => T;

// Lantern colours, shared by every look: [light, body, shade].
export const LAMP = [
  ['#ff9a8c', '#e5483c', '#8a1a12'], ['#ffd27a', '#f2a31f', '#8f5600'], ['#8ff0c0', '#2fb67c', '#0a5c3a'], ['#9ac7ff', '#3b8be8', '#14407f'],
  ['#c9a8ff', '#8a5be0', '#43218f'], ['#ffb3d3', '#f06fa8', '#8f2457'], ['#c4cedd', '#7d8aa0', '#38425a'], ['#8fe8ee', '#1fb5c4', '#0a5a63'],
];

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
export function txt(ctx, s, x, y, { size = 28, weight = 500, color = T.text, align = 'left', base = 'middle', maxW = 0, min = 0, fam = UI } = {}) {
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
// Embossed gold lettering: an extruded dark body, a lit gold face and a thin top highlight (title wordmark).
export function emboss(ctx, text, x, y, { size = 60, maxW = 0, fam = NUM, depth = 0.07 } = {}) {
  text = String(text);
  setFont(ctx, size, 400, fam);
  if (maxW) while (ctx.measureText(text).width > maxW && size > 14) { size -= 1; setFont(ctx, size, 400, fam); }
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const d = Math.max(2, size * depth), edge = T.dark ? '#5a2a06' : '#3a1208';
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = size * 0.2; ctx.shadowOffsetY = d + 2;
  ctx.fillStyle = edge; ctx.strokeStyle = edge; ctx.lineWidth = size * 0.08;
  for (let k = d; k >= 1; k -= 1) ctx.fillText(text, x, y + k);
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.strokeText(text, x, y);
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  if (T.dark) { g.addColorStop(0, '#fff6c8'); g.addColorStop(0.45, '#ffd25c'); g.addColorStop(0.55, '#f0a21e'); g.addColorStop(1, '#ffcf6a'); }
  else { g.addColorStop(0, '#ffb09a'); g.addColorStop(0.45, '#e04a30'); g.addColorStop(0.55, '#b3261a'); g.addColorStop(1, '#e8573e'); }
  ctx.fillStyle = g; ctx.fillText(text, x, y);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.restore();
}
// Wrapped paragraph; returns its height.
export function para(ctx, s, x, y, w, { size = 28, weight = 500, color = T.text, align = 'left', lh = 1.32 } = {}) {
  const lines = wrap(ctx, s, w, size, weight), step = size * lh;
  setFont(ctx, size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  lines.forEach((l, i) => ctx.fillText(l, ax, y + i * step));
  return lines.length * step;
}
export const paraHeight = (ctx, s, w, size, weight = 500, lh = 1.32) => wrap(ctx, s, w, size, weight).length * size * lh;

// ---- shapes --------------------------------------------------------------------------------------------------------------
export const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); };
export function panel(ctx, r, { radius = 22, fill = T.panel, line = T.line } = {}) {
  ctx.save();
  // soft drop shadow so cards sit above the scene, then the card, then a lit top edge (carved-lacquer look)
  ctx.shadowColor = T.dark ? 'rgba(0,0,0,0.5)' : 'rgba(60,40,10,0.28)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
  if (line) { rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.lineWidth = 1.5; ctx.strokeStyle = line; ctx.stroke(); }
  if (r.h > 40) {
    ctx.save(); rr(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, Math.max(2, radius - 1.5)); ctx.clip();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + Math.min(r.h, 70));
    g.addColorStop(0, T.dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, Math.min(r.h, 70)); ctx.restore();
  }
}
export function background(ctx, w, h, t = 0) {
  if (v3.on) { ctx.clearRect(0, 0, w, h); return; }   // the 3D room is behind the transparent canvas
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, T.bg0); g.addColorStop(1, T.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = Math.max(w, h) * 0.7, gx = w * (0.5 + 0.05 * Math.sin(t * 0.15)), gy = h * 0.12;
  const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
  rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  // faint paper-screen lattice (shoji): thin vertical and horizontal hairlines, one path
  const st = Math.max(70, Math.min(w, h) / 6);
  ctx.beginPath();
  for (let x = st / 2; x < w; x += st) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = st / 2; y < h; y += st) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.lineWidth = 1.5; ctx.strokeStyle = T.shell; ctx.stroke();
}

// Flat, clean button (no gloss). kind: 'solid' | 'accent' | 'ghost'. active = toggled on.
export function button(ctx, r, label, { kind = 'solid', active = false, disabled = false, size = 30, weight = 600, sub = '', icon = '', flash = 0, radius = 18, align = 'center' } = {}) {
  const accent = kind === 'accent', ghost = kind === 'ghost';
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.4;
  const press = flash > 0 ? 1 : 0, oy = press * 2;   // pressed state: sinks 2 units, shadow tightens
  if (!ghost) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = press ? 5 : 14; ctx.shadowOffsetY = press ? 2 : 6;
    rr(ctx, r.x, r.y + oy, r.w, r.h, radius); ctx.fillStyle = accent ? T.accent : T.dark ? '#1c2142' : '#cdbf9a'; ctx.fill();
    ctx.restore();
  }
  rr(ctx, r.x, r.y + oy, r.w, r.h, radius);
  if (ghost) ctx.fillStyle = 'rgba(0,0,0,0)';
  else {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (accent) { g.addColorStop(0, mix(T.accent, '#ffffff', 0.38)); g.addColorStop(0.5, T.accent); g.addColorStop(1, mix(T.accent, '#000000', 0.28)); }
    else if (active) { g.addColorStop(0, rgba(T.accent, 0.42)); g.addColorStop(1, rgba(T.accent, 0.16)); }
    else if (T.dark) { g.addColorStop(0, 'rgba(255,255,255,0.20)'); g.addColorStop(0.5, 'rgba(255,255,255,0.09)'); g.addColorStop(1, 'rgba(255,255,255,0.04)'); }
    else { g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(120,90,40,0.16)'); }
    ctx.fillStyle = g;
  }
  ctx.fill();
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.28 * flash})`; ctx.fill(); }
  ctx.lineWidth = active ? 2.5 : 1.5; ctx.strokeStyle = active ? T.accent : accent ? mix(T.accent, '#000000', 0.45) : T.line; ctx.stroke();
  if (!ghost && r.h > 30) {   // lit top bevel
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + oy + 2, r.w - 4, r.h - 4, Math.max(2, Math.min(radius, r.w / 2, r.h / 2) - 2)); ctx.clip();
    ctx.strokeStyle = accent ? 'rgba(255,255,255,0.7)' : T.dark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(r.x + radius * 0.7, r.y + oy + 2.2); ctx.lineTo(r.x + r.w - radius * 0.7, r.y + oy + 2.2); ctx.stroke(); ctx.restore();
  }
  const rr0 = { x: r.x, y: r.y + oy, w: r.w, h: r.h };
  const col = accent ? T.onAccent : T.text, fs = F(size);
  const pad = Math.min(24, r.w * 0.08), hasIcon = !!icon, isz = Math.min(r.h * 0.5, fs * 1.4);
  if (hasIcon && label) {
    const tw = Math.min(txtW(ctx, label, fs, weight), r.w - pad * 2 - isz - 12), total = isz + 12 + tw, x0 = r.x + r.w / 2 - total / 2;
    icons[icon]?.(ctx, x0 + isz / 2, rr0.y + r.h / 2, isz, col);
    txt(ctx, label, x0 + isz + 12, rr0.y + r.h / 2 + (sub ? -fs * 0.3 : 0), { size: fs, weight, color: col, align: 'left', maxW: tw + 2, min: 12 });
  } else if (hasIcon) icons[icon]?.(ctx, r.x + r.w / 2, rr0.y + r.h / 2, isz, col);
  else if (label) txt(ctx, label, align === 'center' ? r.x + r.w / 2 : r.x + pad, rr0.y + r.h / 2 + (sub ? -fs * 0.34 : 0), { size: fs, weight, color: col, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2, min: 12 });
  if (sub) txt(ctx, sub, align === 'center' ? r.x + r.w / 2 : r.x + pad, rr0.y + r.h / 2 + fs * 0.62, { size: F(Math.max(18, size * 0.62)), weight: 400, color: accent ? T.onAccent : T.dim, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2, min: 11 });
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
  down(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx, cy - s * 0.32); ctx.lineTo(cx, cy + s * 0.3); ctx.moveTo(cx - s * 0.22, cy + s * 0.08); ctx.lineTo(cx, cy + s * 0.32); ctx.lineTo(cx + s * 0.22, cy + s * 0.08); ctx.stroke(); }); },
  eye(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.4, cy); ctx.quadraticCurveTo(cx, cy - s * 0.4, cx + s * 0.4, cy); ctx.quadraticCurveTo(cx, cy + s * 0.4, cx - s * 0.4, cy); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.1, 0, 7); ctx.fill(); }); },
};
export const clampN = clamp;
