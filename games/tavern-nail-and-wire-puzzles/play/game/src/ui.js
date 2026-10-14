// Drawing kit: looks (palettes), text helpers, flat buttons, tiles with soft depth, icons.
import { host } from './layout.js';
import { v3 } from './v3.js';

export const UI = 'Barlow, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const DISPLAY = 'Cinzel, Georgia, "Times New Roman", serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- looks ----------------------------------------------------------------------------------------------------------
// bg/panel/text = interface; mat* = the table mat the wire lies on; metals = edge/body/light/spec for the lit tubes.
const METALS_DARK = {
  iron: { edge: '#07090d', body: '#363c47', light: '#8793a7', spec: '#e8f0ff' },
  brass: { edge: '#2f1e05', body: '#b78624', light: '#f6d77c', spec: '#fffbe8' },
  copper: { edge: '#33120a', body: '#b35329', light: '#f5a577', spec: '#fff0e6' },
  steel: { edge: '#121a24', body: '#8795a6', light: '#e6eef7', spec: '#ffffff' },
};
export const LOOKS = {
  taproom: { name: 'Taproom', dark: true, bg0: '#33200f', bg1: '#0e0804', glow: 'rgba(255,184,92,0.18)', panel: 'rgba(255,230,190,0.07)', line: 'rgba(255,218,160,0.2)', text: '#f7ebd8', dim: 'rgba(247,235,216,0.68)', btn: 'rgba(255,232,196,0.09)', accent: '#eba43c', onAccent: '#2a1604', good: '#8fdc9f', err: '#e5683f',
    mat0: '#4a301b', mat1: '#2a190c', matEdge: '#8a5f2a', wood: true, matLine: 'rgba(255,236,190,0.06)', zone: '#f1c15a', gold: '#ffd25a', metals: METALS_DARK, shadow: 'rgba(0,0,0,0.38)', loops: ['iron', 'brass', 'copper', 'steel'] },
  slate: { name: 'Slate', dark: true, bg0: '#1f2a3b', bg1: '#080c14', glow: 'rgba(120,170,255,0.16)', panel: 'rgba(255,255,255,0.06)', line: 'rgba(255,255,255,0.15)', text: '#eef2fa', dim: 'rgba(238,242,250,0.66)', btn: 'rgba(255,255,255,0.09)', accent: '#6fd0c4', onAccent: '#04201c', good: '#7fe0a8', err: '#ff7a5e',
    mat0: '#3d4a5e', mat1: '#1d2533', matEdge: '#56688a', matLine: 'rgba(210,225,255,0.13)', zone: '#8fe3d6', gold: '#ffe08a', metals: METALS_DARK, shadow: 'rgba(0,0,0,0.4)', loops: ['iron', 'brass', 'copper', 'steel'] },
  chalk: { name: 'Chalk', dark: false, bg0: '#f4ecda', bg1: '#d9cdb1', glow: 'rgba(255,255,255,0.55)', panel: 'rgba(60,40,10,0.06)', line: 'rgba(60,40,10,0.18)', text: '#2c2113', dim: 'rgba(44,33,19,0.66)', btn: 'rgba(60,40,10,0.07)', accent: '#b8561a', onAccent: '#ffffff', good: '#1d8a52', err: '#c43a28',
    mat0: '#e0d5b9', mat1: '#c7b992', matEdge: '#a08a58', matLine: 'rgba(60,40,10,0.16)', zone: '#9a6a12', gold: '#d79a14', shadow: 'rgba(40,24,6,0.32)', loops: ['iron', 'brass', 'copper', 'steel'],
    metals: {
      iron: { edge: '#0c0e12', body: '#2f353f', light: '#7c889c', spec: '#ffffff' },
      brass: { edge: '#4a3008', body: '#c89530', light: '#fbe08a', spec: '#ffffff' },
      copper: { edge: '#4a1a0b', body: '#c0602f', light: '#f8b184', spec: '#ffffff' },
      steel: { edge: '#25303c', body: '#8493a5', light: '#eef4fa', spec: '#ffffff' },
    } },
};
export const LOOK_IDS = Object.keys(LOOKS);
let T = LOOKS.taproom;
export const setLook = (id) => { T = LOOKS[id] ?? LOOKS.taproom; };
export const theme = () => T;

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
export function txt(ctx, s, x, y, { size = 28, weight = 500, color = T.text, align = 'left', base = 'middle', maxW = 0, min = 0, display = false } = {}) {
  s = String(s);
  const fam = display ? DISPLAY : UI;
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

// ---- shapes --------------------------------------------------------------------------------------------------------------
export const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); };
// ---- carved plaques and forged buttons -------------------------------------------------------------------------------------
// Oak grain pattern (offscreen, deterministic) used under plaques and buttons; palettes per look.
const PAL = {
  taproom: { top: '#5a3a1f', bot: '#2c1a0c', hi: 'rgba(255,224,170,0.38)', lo: 'rgba(0,0,0,0.55)', brass0: '#ffe39a', brass1: '#d9a43a', brass2: '#8a5a14', grain: 'rgba(20,8,0,0.22)', rivet: '#d9a43a' },
  slate: { top: '#3f4a5c', bot: '#1b2230', hi: 'rgba(210,228,255,0.34)', lo: 'rgba(0,0,0,0.55)', brass0: '#e9f4ff', brass1: '#9cb4cc', brass2: '#4d6178', grain: 'rgba(0,0,10,0.2)', rivet: '#9cb4cc' },
  chalk: { top: '#f1e6cc', bot: '#cdbd98', hi: 'rgba(255,255,255,0.7)', lo: 'rgba(60,40,10,0.35)', brass0: '#f6b98a', brass1: '#c0602f', brass2: '#7a3412', grain: 'rgba(80,50,10,0.14)', rivet: '#c0602f' },
};
let grainPat = null, grainCtxKey = null;
function grain(ctx) {
  if (grainPat && grainCtxKey === T.name) return grainPat;
  if (typeof OffscreenCanvas === 'undefined' || typeof ctx.createPattern !== 'function') return 'rgba(0,0,0,0)';
  const c = new OffscreenCanvas(256, 128);
  const g = c.getContext('2d'), P = PAL[T.name.toLowerCase()] ?? PAL.taproom;
  const hsh = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let k = 0; k < 46; k++) {
    const y = hsh(k, 1) * 128, amp = 1 + hsh(k, 2) * 3.5, ph = hsh(k, 3) * 6.28;
    g.beginPath();
    for (let x = 0; x <= 256; x += 16) { const yy = y + Math.sin(x / 256 * 6.2832 * (1 + (k % 2)) + ph) * amp; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); }
    g.strokeStyle = P.grain; g.lineWidth = 0.7 + hsh(k, 4) * 1.6; g.stroke();
  }
  grainPat = ctx.createPattern(c, 'repeat'); grainCtxKey = T.name;
  return grainPat;
}
const pal = () => PAL[T.name.toLowerCase()] ?? PAL.taproom;

// A carved plaque: oak slab with a bevel, a brass keyline and soft drop shadow. alpha: how opaque (lets the bar-top show through).
export function plaque(ctx, r, { radius = 22, alpha = 1, raised = 1, brass = true } = {}) {
  const P = pal(), rad = Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
  ctx.save();
  if (raised) {
    rr(ctx, r.x + 1, r.y + 5 * raised, r.w - 2, r.h, rad); ctx.fillStyle = `rgba(0,0,0,${0.35 * alpha})`; ctx.fill();
    rr(ctx, r.x + 2, r.y + 2 * raised, r.w - 4, r.h, rad); ctx.fillStyle = `rgba(0,0,0,${0.35 * alpha})`; ctx.fill();
  }
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, P.top); g.addColorStop(1, P.bot);
  rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.clip();
  ctx.translate(r.x, r.y); ctx.fillStyle = grain(ctx); ctx.fillRect(0, 0, r.w, r.h);
  // sheen from the candle side
  const sh = ctx.createLinearGradient(0, 0, r.w, r.h * 0.6); sh.addColorStop(0, 'rgba(255,196,120,0.14)'); sh.addColorStop(0.5, 'rgba(255,196,120,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, r.w, r.h);
  ctx.restore();
  // bevel: light on the top/left edge, dark on the bottom
  ctx.lineWidth = 2;
  rr(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, Math.max(0, rad - 1.5)); ctx.strokeStyle = P.hi; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r.x + rad * 0.6, r.y + r.h - 1.5); ctx.lineTo(r.x + r.w - rad * 0.6, r.y + r.h - 1.5); ctx.strokeStyle = P.lo; ctx.lineWidth = 3; ctx.stroke();
  rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.stroke();
  if (brass && r.w > 60 && r.h > 40) {
    const ins = Math.min(9, r.h * 0.12), bg = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    bg.addColorStop(0, P.brass0); bg.addColorStop(0.5, P.brass1); bg.addColorStop(1, P.brass2);
    rr(ctx, r.x + ins, r.y + ins, r.w - ins * 2, r.h - ins * 2, Math.max(2, rad - ins * 0.7)); ctx.lineWidth = 1.6; ctx.strokeStyle = bg; ctx.globalAlpha = alpha * 0.8; ctx.stroke();
  }
  ctx.restore();
}
export function panel(ctx, r, { radius = 22, fill = null, line = T.line } = {}) {
  if (v3.on || true) { void line; plaque(ctx, r, { radius, alpha: fill ? 0.97 : 0.72, raised: 1 }); return; }
}
export function background(ctx, w, h, t = 0) {
  if (v3.on) {
    // the lit bar-top scene is behind this canvas: only a soft vignette (keeps text legible, pulls the eye to the middle)
    ctx.clearRect(0, 0, w, h);
    const r = Math.hypot(w, h) * 0.62, rg = ctx.createRadialGradient(w / 2, h * 0.46, r * 0.35, w / 2, h * 0.46, r);
    rg.addColorStop(0, 'rgba(8,3,0,0)'); rg.addColorStop(1, 'rgba(8,3,0,0.62)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
    const tp = ctx.createLinearGradient(0, 0, 0, h * 0.2); tp.addColorStop(0, 'rgba(6,2,0,0.55)'); tp.addColorStop(1, 'rgba(6,2,0,0)');
    ctx.fillStyle = tp; ctx.fillRect(0, 0, w, h * 0.2);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, T.bg0); g.addColorStop(1, T.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = Math.max(w, h) * 0.7, gx = w * (0.3 + 0.05 * Math.sin(t * 0.15)), gy = h * 0.18;
  const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
  rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
}

// Embossed metal lettering (brass by default): dark drop, light top edge, gradient fill.
export function embossText(ctx, s, x, y, { size = 60, maxW = 0, align = 'center', family = DISPLAY, weight = 700, tone = 'brass' } = {}) {
  const P = pal();
  setFont(ctx, size, weight, family);
  if (maxW) { while (size > 12 && ctx.measureText(s).width > maxW) { size -= 1; setFont(ctx, size, weight, family); } }
  ctx.save(); ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const o = Math.max(1.5, size * 0.04);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(s, x + o * 1.3, y + o * 2.2);
  ctx.strokeStyle = 'rgba(20,8,0,0.9)'; ctx.lineWidth = Math.max(2, size * 0.09); ctx.strokeText(s, x, y);
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  if (tone === 'brass') { g.addColorStop(0, P.brass0); g.addColorStop(0.45, P.brass1); g.addColorStop(0.55, P.brass2); g.addColorStop(1, P.brass1); }
  else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#cfd6de'); g.addColorStop(1, '#7c8794'); }
  ctx.fillStyle = g; ctx.fillText(s, x, y);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.restore();
  ctx.save(); ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillText(s, x - o * 0.5, y - o * 0.9);
  ctx.restore();
  return size;
}

// Forged button: oak/iron body with a bevel and a pressed state; the accent (primary) button is polished brass.
// kind: 'solid' | 'accent' | 'ghost'. active = toggled on.
export function button(ctx, r, label, { kind = 'solid', active = false, disabled = false, size = 30, weight = 600, sub = '', icon = '', flash = 0, radius = 18, align = 'center' } = {}) {
  const accent = kind === 'accent', P = pal();
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.45;
  const press = flash > 0 ? flash : 0, dy = press * 3, rad = Math.min(radius, r.h / 2, r.w / 2);
  const R0 = { x: r.x, y: r.y + dy, w: r.w, h: r.h - dy * 0.4 };
  // drop shadow (shrinks when pressed)
  rr(ctx, R0.x + 1, R0.y + 5 - dy, R0.w - 2, R0.h, rad); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  const g = ctx.createLinearGradient(0, R0.y, 0, R0.y + R0.h);
  if (accent) { g.addColorStop(0, P.brass0); g.addColorStop(0.35, P.brass1); g.addColorStop(1, P.brass2); }
  else if (kind === 'ghost') { g.addColorStop(0, 'rgba(60,40,20,0.35)'); g.addColorStop(1, 'rgba(20,10,4,0.5)'); }
  else { g.addColorStop(0, active ? mix(P.top, P.brass1, 0.28) : P.top); g.addColorStop(1, active ? mix(P.bot, P.brass2, 0.3) : P.bot); }
  rr(ctx, R0.x, R0.y, R0.w, R0.h, rad); ctx.fillStyle = g; ctx.fill();
  if (!accent && kind !== 'ghost') {
    ctx.save(); rr(ctx, R0.x, R0.y, R0.w, R0.h, rad); ctx.clip(); ctx.translate(R0.x, R0.y); ctx.fillStyle = grain(ctx); ctx.fillRect(0, 0, R0.w, R0.h); ctx.restore();
  }
  if (flash > 0) { rr(ctx, R0.x, R0.y, R0.w, R0.h, rad); ctx.fillStyle = `rgba(255,236,190,${0.3 * flash})`; ctx.fill(); }
  // bevel
  rr(ctx, R0.x + 1.5, R0.y + 1.5, R0.w - 3, R0.h - 3, Math.max(0, rad - 1.5)); ctx.lineWidth = 2; ctx.strokeStyle = accent ? 'rgba(255,250,225,0.75)' : P.hi; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(R0.x + rad * 0.5, R0.y + R0.h - 2); ctx.lineTo(R0.x + R0.w - rad * 0.5, R0.y + R0.h - 2); ctx.lineWidth = 3; ctx.strokeStyle = accent ? 'rgba(70,36,0,0.55)' : P.lo; ctx.stroke();
  rr(ctx, R0.x, R0.y, R0.w, R0.h, rad); ctx.lineWidth = active ? 2.5 : 1.5; ctx.strokeStyle = active ? T.accent : accent ? 'rgba(60,28,0,0.85)' : 'rgba(0,0,0,0.8)'; ctx.stroke();
  if (!accent && kind !== 'ghost' && R0.w > 260 && R0.h > 50) {   // forged rivets on wide plates
    for (const sx of [R0.x + 13, R0.x + R0.w - 13]) {
      const cy = R0.y + R0.h / 2, rg = ctx.createRadialGradient(sx - 1.2, cy - 1.5, 0.5, sx, cy, 5);
      rg.addColorStop(0, P.brass0); rg.addColorStop(1, P.brass2); ctx.beginPath(); ctx.arc(sx, cy, 4.2, 0, 7); ctx.fillStyle = rg; ctx.fill();
    }
  }
  const col = accent ? T.onAccent : T.text, fs = F(size), rc = { x: R0.x, y: R0.y, w: R0.w, h: R0.h };
  let pad = Math.min(24, rc.w * 0.08), hasIcon = !!icon, isz = Math.min(rc.h * 0.5, fs * 1.4), gap = 12;
  // a narrow button (five across on a small landscape phone): a smaller icon and gap, so the label is never cut with an ellipsis
  if (hasIcon && label && txtW(ctx, label, fs, weight) > rc.w - pad * 2 - isz - gap) { pad = Math.min(pad, rc.w * 0.05); isz = Math.min(isz, rc.h * 0.4, fs * 1.1); gap = 6; }
  if (hasIcon && label) {
    const tw = Math.min(txtW(ctx, label, fs, weight), rc.w - pad * 2 - isz - gap), total = isz + gap + tw, x0 = rc.x + rc.w / 2 - total / 2;
    icons[icon]?.(ctx, x0 + isz / 2, rc.y + rc.h / 2, isz, col);
    txt(ctx, label, x0 + isz + gap, rc.y + rc.h / 2 + (sub ? -fs * 0.3 : 0), { size: fs, weight, color: col, align: 'left', maxW: tw + 2, min: 12 });
  } else if (hasIcon) icons[icon]?.(ctx, rc.x + rc.w / 2, rc.y + rc.h / 2, isz, col);
  else if (label) txt(ctx, label, align === 'center' ? rc.x + rc.w / 2 : rc.x + pad, rc.y + rc.h / 2 + (sub ? -fs * 0.34 : 0), { size: fs, weight, color: col, align: align === 'center' ? 'center' : 'left', maxW: rc.w - pad * 2, min: 12 });
  if (sub) txt(ctx, sub, align === 'center' ? rc.x + rc.w / 2 : rc.x + pad, rc.y + rc.h / 2 + fs * 0.62, { size: F(Math.max(18, size * 0.62)), weight: 500, color: accent ? T.onAccent : T.dim, align: align === 'center' ? 'center' : 'left', maxW: rc.w - pad * 2, min: 11 });
  ctx.restore();
}
function txtW(ctx, s, size, weight) { setFont(ctx, size, weight); return ctx.measureText(s).width; }

// ---- tiles: soft raised slabs --------------------------------------------------------------------------------------------
// (x, y, s) is the slab's box. `lift` 0..1 raises it (selected / celebrating). Returns the face rect for content.
export function tile(ctx, x, y, s, face, side, lift = 0, { shadow = true, flat = false } = {}, h = s) {
  const m = Math.min(s, h), r = m * 0.17, d = flat ? m * 0.03 : m * 0.075 + lift * m * 0.03, up = lift * m * 0.05;
  if (shadow && !flat) {
    rr(ctx, x - m * 0.01, y + d + m * 0.035 - up * 0.2, s + m * 0.02, h - d + m * 0.02, r + 2); ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fill();
    rr(ctx, x + m * 0.01, y + d + m * 0.012, s - m * 0.02, h - d, r); ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.fill();
  }
  const fh = h - d;
  rr(ctx, x, y + d - up, s, fh, r); ctx.fillStyle = side; ctx.fill();
  const fy = y - up;
  const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
  g.addColorStop(0, mix(face, '#ffffff', 0.34)); g.addColorStop(0.45, face); g.addColorStop(1, mix(face, '#000000', 0.07));
  rr(ctx, x, fy, s, fh, r); ctx.fillStyle = g; ctx.fill();
  if (!flat) {
    ctx.beginPath(); ctx.moveTo(x + r * 0.9, fy + 1.2); ctx.lineTo(x + s - r * 0.9, fy + 1.2);
    ctx.lineWidth = Math.max(1.2, m * 0.028); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.62)'; ctx.stroke();
  }
  return { x, y: fy, w: s, h: fh };
}

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
  turnCW(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { const r = s * 0.3; ctx.arc(cx, cy, r, Math.PI * 1.15, Math.PI * 2.55); ctx.stroke(); const a = Math.PI * 2.55, ex = cx + Math.cos(a) * r, ey = cy + Math.sin(a) * r; ctx.beginPath(); ctx.moveTo(ex + s * 0.02, ey - s * 0.2); ctx.lineTo(ex, ey); ctx.lineTo(ex + s * 0.2, ey + s * 0.02); ctx.stroke(); }); },
  turnCCW(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { const r = s * 0.3; ctx.arc(cx, cy, r, Math.PI * 1.85, Math.PI * 0.45, true); ctx.stroke(); const a = Math.PI * 0.45, ex = cx + Math.cos(a) * r, ey = cy + Math.sin(a) * r; ctx.beginPath(); ctx.moveTo(ex - s * 0.02, ey - s * 0.2); ctx.lineTo(ex, ey); ctx.lineTo(ex - s * 0.2, ey + s * 0.02); ctx.stroke(); }); },
  arrowL(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx + s * 0.3, cy); ctx.lineTo(cx - s * 0.3, cy); ctx.moveTo(cx - s * 0.06, cy - s * 0.24); ctx.lineTo(cx - s * 0.3, cy); ctx.lineTo(cx - s * 0.06, cy + s * 0.24); ctx.stroke(); }); },
  arrowR(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.3, cy); ctx.lineTo(cx + s * 0.3, cy); ctx.moveTo(cx + s * 0.06, cy - s * 0.24); ctx.lineTo(cx + s * 0.3, cy); ctx.lineTo(cx + s * 0.06, cy + s * 0.24); ctx.stroke(); }); },
  swap(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx - s * 0.12, cy, s * 0.2, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + s * 0.14, cy, s * 0.2, 0, 7); ctx.stroke(); }); },
};
export const clampN = clamp;
