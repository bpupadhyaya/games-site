// Drawing kit: looks, colour helpers, text, flat buttons, icons. No game state in here.
import { host } from './layout.js';
import { v3 } from './v3.js';

export const UI = 'Barlow, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const DISPLAY = '"Dela Gothic One", Barlow, system-ui, sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const LOOKS = {
  workshop: { name: 'Timber', dark: true, bg0: '#4a2c17', bg1: '#1d0f08', glow: 'rgba(255,190,100,0.22)', panel: 'rgba(255,238,210,0.08)', line: 'rgba(255,226,180,0.2)', text: '#fbf1dc', dim: 'rgba(251,241,220,0.68)', accent: '#f4b63a', onAccent: '#2a1606', good: '#7fe0a0', err: '#ff6a55', btn: 'rgba(255,238,210,0.1)', plank1: '#6a4224', plank2: '#573419', grain: 'rgba(30,12,4,0.30)', timber: '#e3c593', timberDark: '#b08a55', wood: '#7a4a24', woodDark: '#4a2a12' },
  daylight: { name: 'Daylight', dark: false, bg0: '#f6e7c8', bg1: '#e1c690', glow: 'rgba(255,255,255,0.55)', panel: 'rgba(80,45,10,0.08)', line: 'rgba(80,45,10,0.22)', text: '#2c1b0a', dim: 'rgba(44,27,10,0.66)', accent: '#b8330f', onAccent: '#ffffff', good: '#157a49', err: '#c0261a', btn: 'rgba(80,45,10,0.09)', plank1: '#e9d3a2', plank2: '#dcc28b', grain: 'rgba(120,80,30,0.16)', timber: '#ecd2a0', timberDark: '#b89358', wood: '#a46b36', woodDark: '#6e431c' },
  night: { name: 'Night', dark: true, bg0: '#1c2440', bg1: '#080b18', glow: 'rgba(120,150,255,0.15)', panel: 'rgba(255,255,255,0.07)', line: 'rgba(255,255,255,0.16)', text: '#eef1fb', dim: 'rgba(238,241,251,0.64)', accent: '#ffb957', onAccent: '#241405', good: '#62dca6', err: '#ff7a68', btn: 'rgba(255,255,255,0.1)', plank1: '#2a3150', plank2: '#222947', grain: 'rgba(0,0,12,0.34)', timber: '#d9c3a0', timberDark: '#9b8362', wood: '#5a4a3c', woodDark: '#33291f' },
};
export const LOOK_IDS = Object.keys(LOOKS);
let LK = LOOKS.workshop, LKID = 'workshop';
export const setLook = (id) => { LK = LOOKS[id] ?? LOOKS.workshop; LKID = LOOKS[id] ? id : 'workshop'; v3.look = LKID; };
// In 3D the plaques are always dark timber, so the light look keeps the dark text palette (the daylight only changes the scene light).
const cur = () => (v3.on && !LK.dark ? LOOKS.workshop : LK);
const T = new Proxy({}, { get: (_, k) => cur()[k] });
export const theme = () => cur();

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

export const F = (n) => Math.max(n, 12 / (host.px || 0.55));   // never below about 12 css px
export const setFont = (ctx, size, weight = 600, face = UI) => { ctx.font = `${weight} ${size}px ${face}`; };
const wrapCache = new Map();
export function wrap(ctx, text, maxW, size, weight = 600) {
  const key = `${size}|${weight}|${Math.round(maxW)}|${text}`;
  let out = wrapCache.get(key);
  if (out) return out;
  setFont(ctx, size, weight);
  out = [];
  for (const par of String(text).split('\n')) {
    let line = '';
    for (const word of par.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  if (wrapCache.size > 700) wrapCache.clear();
  wrapCache.set(key, out);
  return out;
}
// One line, shrunk to fit (never below `min` or ~11.5 css px), cut with an ellipsis if still too long.
export function txt(ctx, s, x, y, { size = 28, weight = 600, color = T.text, align = 'left', base = 'middle', maxW = 0, min = 0, face = UI } = {}) {
  s = String(s);
  setFont(ctx, size, weight, face);
  if (maxW) {
    const floor = Math.max(min || 10, 11.5 / (host.px || 0.55));
    let w = ctx.measureText(s).width;
    while (w > maxW && size > floor) { size -= 1; setFont(ctx, size, weight, face); w = ctx.measureText(s).width; }
    if (w > maxW && s.length > 3) { while (s.length > 3 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1); s += '…'; }
  }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(s, x, y);
  return size;
}
export function para(ctx, s, x, y, w, { size = 28, weight = 600, color = T.text, align = 'left', lh = 1.32 } = {}) {
  const lines = wrap(ctx, s, w, size, weight), step = size * lh;
  setFont(ctx, size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  lines.forEach((l, i) => ctx.fillText(l, ax, y + i * step));
  return lines.length * step;
}
export const paraHeight = (ctx, s, w, size, weight = 600, lh = 1.32) => wrap(ctx, s, w, size, weight).length * size * lh;

export const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); };
const alphaOf = (c) => { if (typeof c !== 'string' || c[0] !== 'r') return 1; const p = c.slice(c.indexOf('(') + 1, c.indexOf(')')).split(','); return p.length > 3 ? Number(p[3]) : 1; };
export function panel(ctx, r, { radius = 22, fill = T.panel, line = T.line } = {}) {
  if (v3.on && ctx.globalAlpha > 0.9) { v3.panels.push({ r: { x: r.x, y: r.y + v3.off, w: r.w, h: r.h }, rad: radius, kind: alphaOf(fill) < 0.6 ? 'inset' : 'plaque', clip: v3.clip }); return; }
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.lineWidth = 1.5; ctx.strokeStyle = line; ctx.stroke(); }
}

// Flat button (no gloss). kind: 'solid' | 'accent' | 'ghost'.
export function button(ctx, r, label, { kind = 'solid', active = false, disabled = false, size = 30, weight = 700, sub = '', icon = '', flash = 0, radius = 18, face = UI } = {}) {
  const accent = kind === 'accent', in3 = v3.on && ctx.globalAlpha > 0.9 && kind !== 'ghost';
  ctx.save();
  if (in3) v3.buttons.push({ r: { x: r.x, y: r.y + v3.off, w: r.w, h: r.h }, rad: radius, accent, active, disabled, flash, clip: v3.clip });
  if (disabled) ctx.globalAlpha = 0.4;
  if (!in3) {
    rr(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fillStyle = accent ? T.accent : active ? rgba(T.accent, 0.24) : kind === 'ghost' ? 'rgba(0,0,0,0)' : T.btn;
    ctx.fill();
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.28 * flash})`; ctx.fill(); }
    ctx.lineWidth = active ? 2.5 : 1.5; ctx.strokeStyle = active ? T.accent : accent ? 'rgba(0,0,0,0)' : T.line; ctx.stroke();
  }
  const col = accent ? T.onAccent : T.text, fs = F(size), pad = Math.min(24, r.w * 0.08), isz = Math.min(r.h * 0.5, fs * 1.4);
  const cx = r.x + r.w / 2;
  if (icon && label) {
    setFont(ctx, fs, weight, face);
    const tw = Math.min(ctx.measureText(label).width, r.w - pad * 2 - isz - 12), total = isz + 12 + tw, x0 = cx - total / 2;
    icons[icon]?.(ctx, x0 + isz / 2, r.y + r.h / 2, isz, col);
    txt(ctx, label, x0 + isz + 12, r.y + r.h / 2 + (sub ? -fs * 0.3 : 0), { size: fs, weight, color: col, maxW: tw + 2, min: 12, face });
  } else if (icon) icons[icon]?.(ctx, cx, r.y + r.h / 2, isz, col);
  else if (label) txt(ctx, label, cx, r.y + r.h / 2 + (sub ? -fs * 0.34 : 0), { size: fs, weight, color: col, align: 'center', maxW: r.w - pad * 2, min: 12, face });
  if (sub) txt(ctx, sub, cx, r.y + r.h / 2 + fs * 0.66, { size: F(Math.max(18, size * 0.6)), weight: 500, color: accent ? T.onAccent : T.dim, align: 'center', maxW: r.w - pad * 2, min: 11 });
  ctx.restore();
}

export function background(ctx, w, h, t = 0, calm = false) {
  if (v3.on) { ctx.clearRect(0, 0, w, h); return; }   // the 3D table is behind the transparent canvas
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, T.bg0); g.addColorStop(1, T.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // horizontal planks with grain
  const ph = Math.max(64, Math.min(120, h / 11));
  for (let i = 0, y = 0; y < h; i++, y += ph) {
    ctx.fillStyle = i % 2 ? T.plank1 : T.plank2; ctx.globalAlpha = 0.55; ctx.fillRect(0, y, w, ph); ctx.globalAlpha = 1;
    ctx.fillStyle = T.grain; ctx.fillRect(0, y, w, 2);
    for (let k = 0; k < 6; k++) { const gy = y + ph * (0.15 + 0.14 * k) + ((i * 7 + k * 13) % 9), gx = ((i * 131 + k * 89) % 100) / 100 * w * 0.6; ctx.fillRect(gx, gy, w * (0.22 + ((k * 37) % 30) / 100), 1.2); }
  }
  const r = Math.max(w, h) * 0.75, gx = w * (0.32 + (calm ? 0 : 0.05 * Math.sin(t * 0.15))), gy = h * 0.2;
  const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
  rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, T.dark ? 'rgba(0,0,0,0.5)' : 'rgba(60,30,0,0.22)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

const stroke = (ctx, s, col, f) => { ctx.save(); ctx.lineWidth = Math.max(2, s * 0.11); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.beginPath(); f(); ctx.restore(); };
export const icons = {
  undo(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy + s * 0.04, s * 0.3, Math.PI * 1.1, Math.PI * 2.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.36, cy - s * 0.22); ctx.lineTo(cx - s * 0.3, cy + s * 0.02); ctx.lineTo(cx - s * 0.06, cy - s * 0.08); ctx.stroke(); }); },
  redo(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy + s * 0.04, s * 0.3, Math.PI * 0.9, Math.PI * -0.1, true); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.36, cy - s * 0.22); ctx.lineTo(cx + s * 0.3, cy + s * 0.02); ctx.lineTo(cx + s * 0.06, cy - s * 0.08); ctx.stroke(); }); },
  erase(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.1, cy + s * 0.3); ctx.lineTo(cx - s * 0.38, cy + s * 0.02); ctx.lineTo(cx - s * 0.04, cy - s * 0.32); ctx.lineTo(cx + s * 0.34, cy + s * 0.04); ctx.lineTo(cx + s * 0.08, cy + s * 0.3); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.28, cy + s * 0.12); ctx.lineTo(cx + s * 0.14, cy - s * 0.2); ctx.stroke(); }); },
  brush(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.3, cy + s * 0.34); ctx.lineTo(cx + s * 0.28, cy - s * 0.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.1, cy - s * 0.12); ctx.lineTo(cx + s * 0.4, cy - s * 0.4); ctx.stroke(); ctx.beginPath(); ctx.arc(cx - s * 0.26, cy + s * 0.3, s * 0.1, 0, 7); ctx.fill(); }); },
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
  save(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.3, cy + s * 0.05); ctx.lineTo(cx - s * 0.3, cy + s * 0.3); ctx.lineTo(cx + s * 0.3, cy + s * 0.3); ctx.lineTo(cx + s * 0.3, cy + s * 0.05); ctx.moveTo(cx, cy - s * 0.32); ctx.lineTo(cx, cy + s * 0.12); ctx.moveTo(cx - s * 0.16, cy - s * 0.04); ctx.lineTo(cx, cy + s * 0.12); ctx.lineTo(cx + s * 0.16, cy - s * 0.04); ctx.stroke(); }); },
  cal(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.rect(cx - s * 0.32, cy - s * 0.26, s * 0.64, s * 0.58); ctx.moveTo(cx - s * 0.32, cy - s * 0.06); ctx.lineTo(cx + s * 0.32, cy - s * 0.06); ctx.moveTo(cx - s * 0.14, cy - s * 0.38); ctx.lineTo(cx - s * 0.14, cy - s * 0.18); ctx.moveTo(cx + s * 0.14, cy - s * 0.38); ctx.lineTo(cx + s * 0.14, cy - s * 0.18); ctx.stroke(); }); },
  wheel(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy, s * 0.36, 0, 7); ctx.stroke(); ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * s * 0.36, cy + Math.sin(a) * s * 0.36); } ctx.stroke(); }); },
};
export const clampN = clamp;

// Raised lettering for titles: a lit face over a stack of darker offsets and a soft drop shadow (reads as carved, painted lettering).
export function embossText(ctx, s, x, y, { size = 40, face = DISPLAY, weight = 400, maxW = 0, color = '#fff3d2', edge = '#7a2410', depth = 0.07, align = 'center', hi = '#ffffff' } = {}) {
  ctx.save();
  setFont(ctx, size, weight, face);
  if (maxW) { while (ctx.measureText(s).width > maxW && size > 12) { size -= 1; setFont(ctx, size, weight, face); } }
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  const d = Math.max(1.5, size * depth), steps = Math.max(2, Math.round(d));
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillText(s, x + d * 0.7, y + d * 1.7);
  ctx.fillStyle = edge;
  for (let i = steps; i >= 1; i--) ctx.fillText(s, x + (i / steps) * d * 0.5, y + (i / steps) * d);
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, hi); g.addColorStop(0.45, color); g.addColorStop(1, mix('#f4b63a', '#c8792a', 0.5));
  ctx.fillStyle = g; ctx.fillText(s, x, y);
  ctx.lineWidth = Math.max(1, size * 0.018); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.strokeText(s, x - size * 0.004, y - size * 0.008);
  ctx.restore();
}
