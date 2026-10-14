// Drawing kit: looks (cloth palettes), text helpers, flat buttons, icons.
import { host } from './layout.js';
import { v3 } from './v3.js';

export const UI = 'Fredoka, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const NUM = '"Cormorant Garamond", "Iowan Old Style", Georgia, serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- looks ----------------------------------------------------------------------------------------------------------------------------------------
// bg0/bg1 = the dark cloth the patch lies on, patch0/patch1 = the patch cloth, weave = its thread lines, chalk = unsewn rows,
// thread = the five thread slots, layer = the two cloth layers under the patch.
export const LOOKS = {
  ivory: {
    name: 'Ivory', dark: true, bg0: '#5b2f26', bg1: '#1d100c', glow: 'rgba(255,214,150,0.16)', rows: 'rgba(255,236,200,0.075)',
    panel: 'rgba(255,255,255,0.07)', line: 'rgba(255,240,215,0.17)', text: '#f7f0df', dim: 'rgba(247,240,223,0.68)', accent: '#f0c05a', onAccent: '#2a1c05',
    good: '#76e0a8', err: '#ff7a5e', btn: 'rgba(255,255,255,0.09)',
    patch0: '#efe3c1', patch1: '#dccb9f', weave: 'rgba(120,96,56,0.10)', edge: 'rgba(110,84,44,0.35)', chalk: 'rgba(80,66,46,0.34)', ink: '#3a2e1c',
    layer: ['#c9b98f', '#a99a73'], marker: '#fff9ea',
    thread: ['#b52a2c', '#2b4fa2', '#d99a14', '#2a2622', '#2d8a5b'],
  },
  indigo: {
    name: 'Indigo', dark: true, bg0: '#20404f', bg1: '#0a181f', glow: 'rgba(190,230,255,0.14)', rows: 'rgba(200,235,255,0.07)',
    panel: 'rgba(255,255,255,0.07)', line: 'rgba(255,228,196,0.18)', text: '#fbeedd', dim: 'rgba(251,238,221,0.68)', accent: '#f2b24f', onAccent: '#2a1604',
    good: '#7fe3a8', err: '#ff7f62', btn: 'rgba(255,255,255,0.09)',
    patch0: '#2c3d7a', patch1: '#1d2a5c', weave: 'rgba(170,190,255,0.10)', edge: 'rgba(150,170,240,0.35)', chalk: 'rgba(200,215,255,0.32)', ink: '#dfe7ff',
    layer: ['#3e5aa8', '#27407f'], marker: '#c9d6ff',
    thread: ['#ff6a57', '#a9c9ff', '#ffc93c', '#f6f0dd', '#6fe0a8'],
  },
  madder: {
    name: 'Madder', dark: true, bg0: '#34302a', bg1: '#100e0b', glow: 'rgba(255,225,170,0.14)', rows: 'rgba(255,240,215,0.07)',
    panel: 'rgba(255,255,255,0.07)', line: 'rgba(225,250,240,0.17)', text: '#effaf4', dim: 'rgba(239,250,244,0.68)', accent: '#f3c25c', onAccent: '#2b1d05',
    good: '#7fe8b0', err: '#ff8068', btn: 'rgba(255,255,255,0.09)',
    patch0: '#a8342b', patch1: '#7e231d', weave: 'rgba(255,200,170,0.11)', edge: 'rgba(255,190,160,0.35)', chalk: 'rgba(255,225,205,0.34)', ink: '#ffeede',
    layer: ['#c4574a', '#923229'], marker: '#ffe6d2',
    thread: ['#fbf1d6', '#8fb0ff', '#ffb534', '#1c1210', '#9ae8b8'],
  },
};
export const LOOK_IDS = Object.keys(LOOKS);
let T = LOOKS.ivory;
let lookId = 'ivory';
export const setLook = (id) => { T = LOOKS[id] ?? LOOKS.ivory; lookId = LOOKS[id] ? id : 'ivory'; };
export const lookKey = () => lookId;
export const theme = () => T;
export const threadColor = (slot) => T.thread[slot % T.thread.length];
export const THREAD_NAMES = ['Red', 'Blue', 'Gold', 'Plain', 'Green'];

// ---- colour helpers ---------------------------------------------------------------------------------------------------------------------------
const hexRgb = (h) => (h[0] === 'r' ? h.slice(h.indexOf('(') + 1, h.indexOf(')')).split(',').slice(0, 3).map(Number) : [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const mixCache = new Map();
export function mix(a, b, t) {
  const key = a + b + t, hit = mixCache.get(key);
  if (hit) return hit;
  const x = hexRgb(a), y = hexRgb(b);
  const out = `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
  if (mixCache.size > 400) mixCache.clear();
  mixCache.set(key, out);
  return out;
}
export const rgba = (hex, a) => { const c = hexRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

// ---- text ----------------------------------------------------------------------------------------------------------------------------------------
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
// Wrapped paragraph; returns its height.
export function para(ctx, s, x, y, w, { size = 28, weight = 500, color = T.text, align = 'left', lh = 1.32 } = {}) {
  const lines = wrap(ctx, s, w, size, weight), step = size * lh;
  setFont(ctx, size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  lines.forEach((l, i) => ctx.fillText(l, ax, y + i * step));
  return lines.length * step;
}
export const paraHeight = (ctx, s, w, size, weight = 500, lh = 1.32) => wrap(ctx, s, w, size, weight).length * size * lh;

// ---- shapes --------------------------------------------------------------------------------------------------------------------------------------
export const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); };
// ---- premium chrome: carved teak plaques with a brass rim and a stitched border -------------------------------------------------------------
let WOOD = null, WOOD_TRIED = false;
function woodPattern(ctx) {
  if (WOOD) return WOOD;
  if (WOOD_TRIED || !v3.makeCanvas) return null;
  WOOD_TRIED = true;
  try {
    const c = v3.makeCanvas(192, 192);
    const g = c.getContext('2d');
    g.fillStyle = '#6d4426'; g.fillRect(0, 0, 192, 192);
    for (let i = 0; i < 70; i++) {
      const y = (i * 29.3) % 192, a = 2 + (i % 5), ph = i * 1.7;
      g.beginPath();
      for (let x = 0; x <= 192; x += 8) { const yy = y + Math.sin((x / 192) * 6.283 + ph) * a * 0.45; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); }
      g.strokeStyle = i % 3 ? `rgba(30,12,4,${0.14 + (i % 4) * 0.05})` : 'rgba(255,214,150,0.08)'; g.lineWidth = 0.7 + (i % 3) * 0.7; g.stroke();
    }
    WOOD = ctx.createPattern(c, 'repeat');
  } catch { WOOD = null; }
  return WOOD;
}
const PRESS = { x: -1, y: -1, on: false };
export function setPress(pt) { if (pt) { PRESS.x = pt.x; PRESS.y = pt.y; PRESS.on = true; } else PRESS.on = false; }
const pressedOn = (r) => PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
function brass(ctx, x, y, w, h, rad, lo = '#f2d68a', hi = '#9a6a1c') {
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, lo); g.addColorStop(0.5, hi); g.addColorStop(1, lo);
  rr(ctx, x, y, w, h, rad); ctx.fillStyle = g; ctx.fill();
}
// A carved plaque. tone: 'wood' (teak), 'dark' (deeper, for text pages), 'gold' (lacquered mustard). o.dy sinks it (pressed).
export function plaque(ctx, r, { radius = 22, tone = 'wood', alpha = 0.92, dy = 0, stitch = true, shadow = true } = {}) {
  ctx.save();
  const rad = Math.min(radius, r.h / 2, r.w / 2), y = r.y + dy;
  if (shadow) { for (let k = 3; k >= 1; k--) { rr(ctx, r.x - k, y + 1 + k * 2.2, r.w + 2 * k, r.h + k, rad + k); ctx.fillStyle = `rgba(6,3,1,${0.12 + (dy ? 0 : 0.04)})`; ctx.fill(); } }
  ctx.globalAlpha = alpha;
  const gold = tone === 'gold';
  brass(ctx, r.x, y, r.w, r.h, rad, gold ? '#fff0b4' : '#f0d488', gold ? '#b9801f' : '#8c5f1a');
  const e = Math.max(2, Math.min(3.5, r.h * 0.06)), x = r.x + e, yy = y + e, w = r.w - 2 * e, h = r.h - 2 * e, ir = Math.max(2, rad - e);
  rr(ctx, x, yy, w, h, ir);
  const g = ctx.createLinearGradient(0, yy, 0, yy + h);
  if (gold) { g.addColorStop(0, '#ffd877'); g.addColorStop(0.55, '#e0a02a'); g.addColorStop(1, '#a8701a'); }
  else if (tone === 'dark') { g.addColorStop(0, '#3a2514'); g.addColorStop(1, '#1d1008'); }
  else { g.addColorStop(0, '#6b4426'); g.addColorStop(1, '#341f10'); }
  ctx.fillStyle = g; ctx.fill();
  if (!gold) { const p = woodPattern(ctx); if (p) { ctx.globalAlpha = alpha * (tone === 'dark' ? 0.4 : 0.55); ctx.fillStyle = p; ctx.fill(); ctx.globalAlpha = alpha; } }
  // bevel: light edge top-left, shadow bottom-right
  ctx.save(); rr(ctx, x, yy, w, h, ir); ctx.clip();
  const hl = ctx.createLinearGradient(0, yy, 0, yy + Math.min(h * 0.5, 40)); hl.addColorStop(0, gold ? 'rgba(255,255,255,0.45)' : 'rgba(255,230,190,0.2)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(x, yy, w, Math.min(h * 0.5, 40));
  const sh = ctx.createLinearGradient(0, yy + h * 0.55, 0, yy + h); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = sh; ctx.fillRect(x, yy + h * 0.55, w, h * 0.45);
  ctx.restore();
  rr(ctx, x + 0.5, yy + 0.5, w - 1, h - 1, ir); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,240,205,0.28)'; ctx.stroke();
  // a kantha running stitch inside the carved edge
  if (stitch && r.w > 150 && r.h > 54) {
    rr(ctx, x + 7, yy + 7, w - 14, h - 14, Math.max(2, ir - 6));
    ctx.setLineDash([7, 6]); ctx.lineWidth = 1.6; ctx.strokeStyle = gold ? 'rgba(90,50,10,0.42)' : 'rgba(255,214,140,0.2)'; ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}
export function panel(ctx, r, { radius = 22, fill = T.panel, line = T.line, tone = 'wood' } = {}) {
  if (!v3.makeCanvas) {   // headless: keep it simple
    rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = fill; ctx.fill();
    if (line) { ctx.lineWidth = 1.5; ctx.strokeStyle = line; ctx.stroke(); }
    return;
  }
  void fill; void line;
  plaque(ctx, r, { radius, tone: tone === 'wood' ? 'dark' : tone, alpha: 0.9 });
}
// The dark cloth under everything: a gradient, a soft glow and many faint rows of running stitch across the whole screen.
export function background(ctx, w, h, t = 0) {
  if (v3.on) { ctx.clearRect(0, 0, w, h); return; }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, T.bg0); g.addColorStop(1, T.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = Math.max(w, h) * 0.7, gx = w * (0.5 + 0.05 * Math.sin(t * 0.15)), gy = h * 0.1;
  const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
  rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  const st = Math.max(44, Math.min(w, h) / 14);
  ctx.beginPath();
  for (let y = st * 0.6, row = 0; y < h; y += st, row++) {
    const ph = row * 1.7, amp = st * 0.16;
    for (let x = -12 + ((row * 17) % 26); x < w; x += 26) {
      const yy = y + Math.sin(x * 0.012 + ph) * amp, y2 = y + Math.sin((x + 13) * 0.012 + ph) * amp;
      ctx.moveTo(x, yy); ctx.lineTo(x + 13, y2);
    }
  }
  ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = T.rows; ctx.stroke(); ctx.lineCap = 'butt';
}

// A glossy thread bead (a coloured sphere with a highlight): used for colour swatches and the order strip.
export function bead(ctx, x, y, r, color) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x + r * 0.08, y + r * 0.16, r * 1.02, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, mix(color, '#ffffff', 0.55)); g.addColorStop(0.45, color); g.addColorStop(1, mix(color, '#000000', 0.5));
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.1); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.42, r * 0.28, r * 0.16, -0.5, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  ctx.restore();
}
// Embossed gold lettering: a dark outline, a deep shadow and a vertical gold gradient with a thin highlight on top.
export function embossText(ctx, str, x, y, { size = 80, maxW = 0, fam = NUM, weight = 700, align = 'center' } = {}) {
  let sz = size;
  setFont(ctx, sz, weight, fam);
  if (maxW) { while (ctx.measureText(str).width > maxW && sz > 16) { sz -= 1; setFont(ctx, sz, weight, fam); } }
  ctx.save(); ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const lw = Math.max(2, sz * 0.06);
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = sz * 0.12; ctx.shadowOffsetY = sz * 0.05;
  ctx.lineWidth = lw * 2.4; ctx.strokeStyle = '#2a1306'; ctx.strokeText(str, x, y + sz * 0.03);
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = lw * 1.3; ctx.strokeStyle = '#8a5612'; ctx.strokeText(str, x, y);
  ctx.fillStyle = 'rgba(255,252,225,0.9)'; ctx.fillText(str, x - sz * 0.014, y - sz * 0.02);
  const g = ctx.createLinearGradient(0, y - sz * 0.5, 0, y + sz * 0.5);
  g.addColorStop(0, '#ffe9a0'); g.addColorStop(0.4, '#ffc94f'); g.addColorStop(0.7, '#e19a22'); g.addColorStop(1, '#a8651a');
  ctx.fillStyle = g; ctx.fillText(str, x, y);
  ctx.restore();
  return sz;
}

// Carved wooden button with a brass rim; the accent kind is lacquered gold. Pressed buttons sink 3 units.
export function button(ctx, r, label, { kind = 'solid', active = false, disabled = false, size = 30, weight = 600, sub = '', icon = '', flash = 0, radius = 18, align = 'center' } = {}) {
  const accent = kind === 'accent';
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.45;
  const press = !disabled && pressedOn(r), dy = press ? 3 : 0;
  if (kind === 'ghost') { rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke(); }
  else {
    plaque(ctx, r, { radius, tone: accent ? 'gold' : 'wood', alpha: 1, dy, stitch: r.w > 150 && r.h > 54, shadow: !disabled });
    if (active) { rr(ctx, r.x + 5, r.y + dy + 5, r.w - 10, r.h - 10, Math.max(2, radius - 4)); ctx.lineWidth = 3; ctx.strokeStyle = '#ffd36b'; ctx.stroke(); rr(ctx, r.x + 5, r.y + dy + 5, r.w - 10, r.h - 10, Math.max(2, radius - 4)); ctx.fillStyle = 'rgba(255,205,90,0.16)'; ctx.fill(); }
    if (flash > 0) { rr(ctx, r.x, r.y + dy, r.w, r.h, radius); ctx.fillStyle = `rgba(255,255,255,${0.3 * flash})`; ctx.fill(); }
    if (press) { rr(ctx, r.x, r.y + dy, r.w, r.h, radius); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill(); }
  }
  const col = accent ? T.onAccent : '#fbeedd', fs = F(size);
  const ry = r.y + dy;
  const pad = Math.min(24, r.w * 0.08), hasIcon = !!icon, isz = Math.min(r.h * 0.5, fs * 1.4);
  const shade = (f) => { if (accent) f(); else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1.5; f(); ctx.restore(); } };
  if (hasIcon && label) {
    const tw = Math.min(txtW(ctx, label, fs, weight), r.w - pad * 2 - isz - 12), total = isz + 12 + tw, x0 = r.x + r.w / 2 - total / 2;
    shade(() => { icons[icon]?.(ctx, x0 + isz / 2, ry + r.h / 2, isz, col); txt(ctx, label, x0 + isz + 12, ry + r.h / 2 + (sub ? -fs * 0.3 : 0), { size: fs, weight, color: col, align: 'left', maxW: tw + 2, min: 12 }); });
  } else if (hasIcon) shade(() => icons[icon]?.(ctx, r.x + r.w / 2, ry + r.h / 2, isz, col));
  else if (label) shade(() => txt(ctx, label, align === 'center' ? r.x + r.w / 2 : r.x + pad, ry + r.h / 2 + (sub ? -fs * 0.34 : 0), { size: fs, weight, color: col, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2, min: 12 }));
  if (sub) txt(ctx, sub, align === 'center' ? r.x + r.w / 2 : r.x + pad, ry + r.h / 2 + fs * 0.62, { size: F(Math.max(18, size * 0.62)), weight: 400, color: accent ? 'rgba(42,28,5,0.82)' : 'rgba(251,238,221,0.78)', align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2, min: 11 });
  ctx.restore();
}
function txtW(ctx, s, size, weight) { setFont(ctx, size, weight); return ctx.measureText(s).width; }

// ---- icons (stroke paths, centred on cx, cy, within `s`) -----------------------------------------------------------------------------------
const stroke = (ctx, s, col, f) => { ctx.save(); ctx.lineWidth = Math.max(2, s * 0.11); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.beginPath(); f(); ctx.restore(); };
export const icons = {
  undo(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy + s * 0.04, s * 0.3, Math.PI * 1.1, Math.PI * 2.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.36, cy - s * 0.22); ctx.lineTo(cx - s * 0.3, cy + s * 0.02); ctx.lineTo(cx - s * 0.06, cy - s * 0.08); ctx.stroke(); }); },
  erase(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy, s * 0.3, Math.PI * 0.2, Math.PI * 1.75); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.22, cy - s * 0.46); ctx.lineTo(cx + s * 0.18, cy - s * 0.2); ctx.lineTo(cx - s * 0.06, cy - s * 0.26); ctx.stroke(); }); },
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
  // a needle: slanted, with an eye at the top and a point at the bottom
  needle(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx + s * 0.32, cy - s * 0.34); ctx.lineTo(cx - s * 0.34, cy + s * 0.34); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx + s * 0.27, cy - s * 0.28, s * 0.045, s * 0.12, Math.PI / 4, 0, 7); ctx.stroke(); }); },
  // a stitch row: three dashes
  stitch(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { for (let i = -1; i <= 1; i++) { ctx.moveTo(cx + i * s * 0.3 - s * 0.1, cy); ctx.lineTo(cx + i * s * 0.3 + s * 0.1, cy); } ctx.stroke(); }); },
  quilt(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.rect(cx - s * 0.32, cy - s * 0.32, s * 0.64, s * 0.64); ctx.moveTo(cx, cy - s * 0.32); ctx.lineTo(cx, cy + s * 0.32); ctx.moveTo(cx - s * 0.32, cy); ctx.lineTo(cx + s * 0.32, cy); ctx.stroke(); }); },
  flip(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.3, cy - s * 0.1); ctx.lineTo(cx + s * 0.3, cy - s * 0.1); ctx.moveTo(cx + s * 0.3, cy + s * 0.1); ctx.lineTo(cx - s * 0.3, cy + s * 0.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.12, cy - s * 0.26); ctx.lineTo(cx + s * 0.3, cy - s * 0.1); ctx.lineTo(cx + s * 0.12, cy + s * 0.06); ctx.stroke(); }); },
};
export const clampN = clamp;
