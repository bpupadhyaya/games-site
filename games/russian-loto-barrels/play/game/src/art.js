// All reusable drawing: themes, the felt table, wooden kegs, the linen bag, cardboard cards, chips and small UI pieces.
// Pure: reads values, never mutates game state. Deterministic (no clock: animation time comes from the caller).
import { COLS, ROWS, CELLS } from './rules.js';

export const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const mix = (a, b, k) => { const x = hexRgb(a), y = hexRgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`; };
export const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const PI2 = Math.PI * 2;

export const THEMES = {
  felt: { name: 'Green felt', bg: ['#0c2a20', '#164a38', '#071a14'], glow: 'rgba(255,214,140,0.22)', accent: '#f2b84b', accent2: '#e0563c', text: '#fff4de', sub: 'rgba(255,244,222,0.72)', panel: 'rgba(5,24,18,0.62)', print: '#b8322c', print2: '#7a1d1a', paper: '#fff3d6', chip: ['#e0563c', '#8f2214'], stitch: 'rgba(255,230,170,0.22)' },
  midnight: { name: 'Midnight blue', bg: ['#0a1a3a', '#173a74', '#050c20'], glow: 'rgba(150,200,255,0.22)', accent: '#ffd36a', accent2: '#5fb3ff', text: '#eef5ff', sub: 'rgba(238,245,255,0.72)', panel: 'rgba(5,12,34,0.64)', print: '#1f4fa8', print2: '#12306a', paper: '#f6f4ea', chip: ['#ffd36a', '#b8861c'], stitch: 'rgba(170,210,255,0.2)' },
  samovar: { name: 'Samovar tea', bg: ['#2b0f12', '#5e2018', '#170608'], glow: 'rgba(255,190,110,0.26)', accent: '#ffc65a', accent2: '#e8d6a8', text: '#fff1dc', sub: 'rgba(255,241,220,0.72)', panel: 'rgba(30,8,8,0.6)', print: '#2f6b4a', print2: '#1c4430', paper: '#fff0cf', chip: ['#3d8bd8', '#1a4f90'], stitch: 'rgba(255,200,130,0.22)' },
};
export const THEME_IDS = Object.keys(THEMES);
export const themeOf = (id) => THEMES[id] ?? THEMES.felt;

// ---- generic helpers ----------------------------------------------------------------------------------------------------
export function roundPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
export const FONT = '"Rockwell", "Roboto Slab", "Georgia", "Times New Roman", serif';
export const NUMFONT = '"Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
// UI type is always upright (owner rule): the `italic` argument is kept for call-site compatibility and ignored.
export const font = (px, weight = 700, italic = false, fam = FONT) => `${weight} ${Math.round(px)}px ${fam}`;
// Smallest font size (virtual units) allowed right now: about 11 css px. view.js sets it per drawing space each frame.
export const fontFloor = { u: 10 };
export function fitPx(ctx, text, maxW, px, weight = 700, italic = false, min = 10, fam = FONT) {
  ctx.font = font(px, weight, italic, fam);
  const w = ctx.measureText(text).width;
  return w > maxW ? Math.max(min, Math.floor(px * (maxW / w))) : px;
}
export function wrapLines(ctx, text, maxW) {
  const words = String(text).split(' '), lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
// Pointer position while a finger/mouse is down (set by view.js each frame): the button under it draws pressed.
export const ptr = { down: false, x: 0, y: 0 };

// A flat button: one fill, one crisp border, soft shadow; pressed = darker and sunk. primary = gold, active = accent2.
export function drawButton(ctx, r, label, th, o = {}) {
  const { primary = false, active = false, disabled = false, sub = null, scale = 1, pulse = 0, danger = false } = o;
  const press = o.press ?? (ptr.down && !disabled && ptr.x >= r.x && ptr.x <= r.x + r.w && ptr.y >= r.y && ptr.y <= r.y + r.h);
  ctx.save(); ctx.globalAlpha = disabled ? 0.4 : 1;
  const y = r.y + (press ? 2 : 0);
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = press ? 4 : 12; ctx.shadowOffsetY = press ? 2 : 5;
  roundPath(ctx, r.x, y, r.w, r.h, Math.min(22, r.h / 2.5));
  const d = press ? 0.2 : 0;
  if (o.solid && !(primary || active || danger)) { ctx.fillStyle = mix(th.bg[2], th.bg[1], 0.3); ctx.fill(); }
  if (primary || active || danger) {
    const base = danger ? th.accent2 : primary ? th.accent : th.accent2;
    ctx.fillStyle = mix(base, '#000000', 0.08 + d);
  } else ctx.fillStyle = `rgba(255,255,255,${press ? 0.07 : 0.13})`;
  ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2; ctx.strokeStyle = primary ? 'rgba(20,10,0,0.7)' : active ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.38)'; ctx.stroke();
  if (pulse > 0) { roundPath(ctx, r.x - pulse * 7, y - pulse * 7, r.w + pulse * 14, r.h + pulse * 14, Math.min(26, r.h / 2.1)); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,240,170,${0.7 * (1 - pulse)})`; ctx.stroke(); }
  ctx.fillStyle = primary ? '#1c1004' : th.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const base = Math.min(Math.min(34, r.h * 0.42) * scale, r.h * (sub ? 0.36 : 0.6)), maxW = r.w - 20, fl = Math.min(fontFloor.u, r.h * 0.5);
  if (sub) {
    const s1 = fitPx(ctx, label, maxW, Math.max(fl, base * 0.9), 700, false, fl), s2 = fitPx(ctx, sub, maxW, Math.max(fl, base * 0.5), 400, false, fl);
    ctx.font = font(s1); ctx.fillText(label, r.x + r.w / 2, y + r.h * 0.4);
    ctx.globalAlpha *= 0.78; ctx.font = font(s2, 400); ctx.fillText(sub, r.x + r.w / 2, y + r.h * 0.76);
  } else { const s = fitPx(ctx, label, maxW, Math.max(fl, base), 700, false, fl); ctx.font = font(s); ctx.fillText(label, r.x + r.w / 2, y + r.h / 2 + 1); }
  ctx.restore();
}

// ---- the table backdrop ----------------------------------------------------------------------------------------------------
export const look = { flat: false };   // main.js sets flat for store screenshots (?shot=1): no felt grain, so the JPEGs stay small
let feltTile = null;
function felt() {
  if (feltTile !== null) return feltTile;
  feltTile = false;
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const c = new OffscreenCanvas(96, 96), x = c.getContext('2d');
      let s = 12345; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      for (let i = 0; i < 700; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; x.fillRect(rnd() * 96, rnd() * 96, 1.5, 1.5); }
      feltTile = c;
    } catch { feltTile = false; }
  }
  return feltTile;
}
export function drawBackdrop(ctx, th, t, w, h, o = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.5, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const tile = look.flat ? null : felt();
  if (tile) { const p = ctx.createPattern(tile, 'repeat'); if (p) { ctx.fillStyle = p; ctx.fillRect(0, 0, w, h); } }
  // lamp light from above, vignette, stitched border
  const rg = ctx.createRadialGradient(w / 2, h * 0.28, 20, w / 2, h * 0.34, Math.max(w, h) * 0.7);
  rg.addColorStop(0, th.glow); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  if (o.stitch !== false) {
    ctx.save(); ctx.strokeStyle = th.stitch; ctx.lineWidth = 2; ctx.setLineDash([10, 9]);
    roundPath(ctx, 10, 10, w - 20, h - 20, 26); ctx.stroke(); ctx.restore();
  }
  // drifting dust in the lamp light
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const x = ((i * 211 + t * (4 + (i % 4))) % (w + 40)) - 20, y = (i * 137 + Math.sin(t * 0.4 + i) * 30 + h * 0.1) % h, a = 0.06 + 0.04 * Math.sin(t + i);
    ctx.fillStyle = `rgba(255,236,190,${a})`; ctx.beginPath(); ctx.arc(x, y, 2 + (i % 3), 0, PI2); ctx.fill();
  }
  ctx.restore();
}

// ---- wooden keg ----------------------------------------------------------------------------------------------------------------
// A small turned wooden cask lying on its side, number painted on the belly. size = length. rot = tumble angle, spin = roll about its
// own axis (the painted number slides across the belly and fades round the back). dim 0..1 darkens. glow 0..1 adds a warm rim.
export function drawKeg(ctx, cx, cy, size, n, o = {}) {
  const { rot = 0, spin = 0, dim = 0, glow = 0, alpha = 1, shadow = true, label = true } = o;
  const L = size, H = size * 0.74, he = H * 0.4, hm = H * 0.5, ex = L * 0.075;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.globalAlpha *= alpha;
  if (shadow) { ctx.save(); ctx.rotate(-rot); ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(size * 0.04, size * 0.46, size * 0.46, size * 0.1, 0, 0, PI2); ctx.fill(); ctx.restore(); }
  if (glow > 0) { ctx.shadowColor = `rgba(255,214,120,${glow})`; ctx.shadowBlur = size * 0.5; }
  const body = () => {
    ctx.beginPath(); ctx.moveTo(-L / 2, -he); ctx.quadraticCurveTo(0, -(2 * hm - he), L / 2, -he); ctx.lineTo(L / 2, he);
    ctx.quadraticCurveTo(0, 2 * hm - he, -L / 2, he); ctx.closePath();
  };
  body();
  const wood = ctx.createLinearGradient(0, -hm, 0, hm);
  wood.addColorStop(0, '#f4dba6'); wood.addColorStop(0.28, '#e9c27a'); wood.addColorStop(0.62, '#c98f4a'); wood.addColorStop(1, '#7c4a22');
  ctx.fillStyle = wood; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); body(); ctx.clip();
  // grain
  ctx.strokeStyle = 'rgba(110,60,20,0.16)'; ctx.lineWidth = Math.max(1, size * 0.012);
  for (let k = 0; k < 6; k++) { const yy = -hm + (k + 0.6 + ((n * 7 + k * 3) % 5) * 0.1) * (H / 6.4); ctx.beginPath(); ctx.moveTo(-L / 2, yy); ctx.quadraticCurveTo(0, yy + (k % 2 ? 1 : -1) * size * 0.03, L / 2, yy); ctx.stroke(); }
  // two turned bands near the ends
  for (const sx of [-1, 1]) { ctx.fillStyle = 'rgba(120,40,24,0.55)'; ctx.fillRect(sx * L * 0.36 - L * 0.018, -hm, L * 0.036, H); ctx.fillStyle = 'rgba(255,230,180,0.28)'; ctx.fillRect(sx * L * 0.36 - L * 0.018, -hm, L * 0.012, H); }
  // soft light streak along the top
  const hl = ctx.createLinearGradient(0, -hm, 0, 0); hl.addColorStop(0, 'rgba(255,255,255,0.5)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(-L / 2, -hm, L, hm * 0.9);
  ctx.restore();
  // end grain caps
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(sx * L / 2, 0, ex, he, 0, 0, PI2); ctx.fillStyle = sx < 0 ? '#9a6a34' : '#d8a867'; ctx.fill();
    ctx.lineWidth = Math.max(1, size * 0.012); ctx.strokeStyle = 'rgba(70,36,12,0.55)'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(sx * L / 2, 0, ex * 0.5, he * 0.55, 0, 0, PI2); ctx.strokeStyle = 'rgba(70,36,12,0.28)'; ctx.stroke();
  }
  body(); ctx.lineWidth = Math.max(1.2, size * 0.02); ctx.strokeStyle = 'rgba(70,34,10,0.75)'; ctx.stroke();
  if (label && n) {
    const c = Math.cos(spin), vis = clamp01((c - 0.1) / 0.5);
    if (vis > 0) {
      const s = String(n), fs = size * (s.length > 1 ? 0.36 : 0.44);
      ctx.save(); ctx.translate(Math.sin(spin) * L * 0.2, 0); ctx.scale(Math.max(0.35, c), 1); ctx.globalAlpha *= vis;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font(fs, 800, false, NUMFONT);
      ctx.fillStyle = 'rgba(255,240,205,0.55)'; ctx.fillText(s, 0, fs * 0.04 + 1);
      ctx.fillStyle = '#26130a'; ctx.fillText(s, 0, fs * 0.04);
      if (n === 6 || n === 9 || n === 66 || n === 69 || n === 99) { ctx.fillRect(-fs * 0.3, fs * 0.5, fs * 0.6, Math.max(1.5, fs * 0.07)); }   // underline 6 and 9 like a real set
      ctx.restore();
    }
  }
  if (dim > 0) { body(); ctx.fillStyle = `rgba(10,6,2,${dim})`; ctx.fill(); }
  ctx.restore();
}

// ---- the linen bag -------------------------------------------------------------------------------------------------------------------
// shake 0..1 rocks the bag. (cx, cy) = the bag's centre, size = height.
export function drawBag(ctx, cx, cy, size, t, shake = 0, th) {
  const w = size * 0.82, h = size;
  ctx.save(); ctx.translate(cx, cy + h * 0.05); ctx.rotate(Math.sin(t * 38) * 0.07 * shake + Math.sin(t * 1.1) * 0.012);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, h * 0.5, w * 0.5, h * 0.07, 0, 0, PI2); ctx.fill();
  const bag = () => {
    ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.34);
    ctx.bezierCurveTo(-w * 0.6, -h * 0.12, -w * 0.62, h * 0.38, -w * 0.4, h * 0.48);
    ctx.quadraticCurveTo(0, h * 0.54, w * 0.4, h * 0.48);
    ctx.bezierCurveTo(w * 0.62, h * 0.38, w * 0.6, -h * 0.12, w * 0.2, -h * 0.34); ctx.closePath();
  };
  bag();
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, '#b89560'); g.addColorStop(0.35, '#e8d2a0'); g.addColorStop(0.7, '#d6b87c'); g.addColorStop(1, '#8f6e3c');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1.5, size * 0.014); ctx.strokeStyle = 'rgba(60,34,10,0.7)'; ctx.stroke();
  ctx.save(); bag(); ctx.clip(); ctx.strokeStyle = 'rgba(100,70,30,0.2)'; ctx.lineWidth = 1;
  for (let k = -5; k <= 5; k++) { ctx.beginPath(); ctx.moveTo(k * w * 0.1, -h * 0.4); ctx.quadraticCurveTo(k * w * 0.13, h * 0.1, k * w * 0.1, h * 0.55); ctx.stroke(); }
  // lumps of kegs inside
  ctx.fillStyle = 'rgba(80,50,20,0.1)';
  for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.ellipse(((k * 37) % 60 - 30) * w * 0.01, (((k * 53) % 60) - 8) * h * 0.008, w * 0.13, h * 0.09, k, 0, PI2); ctx.fill(); }
  ctx.restore();
  // gathered neck and drawstring
  ctx.fillStyle = '#c9a56a'; ctx.beginPath(); ctx.moveTo(-w * 0.26, -h * 0.32); ctx.lineTo(w * 0.26, -h * 0.32); ctx.lineTo(w * 0.2, -h * 0.42); ctx.lineTo(-w * 0.2, -h * 0.42); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = th.accent2; ctx.lineWidth = Math.max(2.5, size * 0.03); ctx.beginPath(); ctx.moveTo(-w * 0.24, -h * 0.34); ctx.lineTo(w * 0.24, -h * 0.34); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.24, -h * 0.34); ctx.quadraticCurveTo(w * 0.38, -h * 0.3, w * 0.34, -h * 0.18); ctx.moveTo(w * 0.24, -h * 0.34); ctx.quadraticCurveTo(w * 0.3, -h * 0.26, w * 0.2, -h * 0.14); ctx.stroke();
  ctx.restore();
}

// A wooden tray the current keg lands on. r = rect.
export function drawTray(ctx, r, th) {
  ctx.save();
  roundPath(ctx, r.x, r.y, r.w, r.h, Math.min(r.w, r.h) * 0.18);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#8a5a2c'); g.addColorStop(1, '#4a2c12');
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(20,10,0,0.7)'; ctx.stroke();
  const pad = Math.min(r.w, r.h) * 0.09;
  roundPath(ctx, r.x + pad, r.y + pad, r.w - pad * 2, r.h - pad * 2, Math.min(r.w, r.h) * 0.12);
  const g2 = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g2.addColorStop(0, 'rgba(30,60,44,0.95)'); g2.addColorStop(1, 'rgba(14,34,24,0.95)');
  ctx.fillStyle = g2; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,220,160,0.25)'; ctx.stroke();
  ctx.restore();
}

// ---- chips -------------------------------------------------------------------------------------------------------------------------------
// A cardboard-and-wood chip. t01: 0 = just dropped (big, falling) -> 1 = settled.
export function drawChip(ctx, cx, cy, size, th, t01 = 1, seed = 0) {
  const e = easeOutBack(clamp01(t01)), sc = 1 + (1 - clamp01(t01)) * 0.8, dy = (1 - e) * -size * 0.9, r = size / 2;
  ctx.save(); ctx.translate(cx, cy + dy); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(r * 0.08, r * 0.14, r * 0.98, r * 0.92, 0, 0, PI2); ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r);
  g.addColorStop(0, mix(th.chip[0], '#ffffff', 0.35)); g.addColorStop(0.5, th.chip[0]); g.addColorStop(1, th.chip[1]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, PI2); ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.strokeStyle = 'rgba(20,6,0,0.55)'; ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, PI2); ctx.stroke();
  ctx.rotate(seed * 0.7); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.moveTo(-r * 0.3, 0); ctx.lineTo(r * 0.3, 0); ctx.moveTo(0, -r * 0.3); ctx.lineTo(0, r * 0.3); ctx.stroke();
  ctx.restore();
}

// ---- cards -------------------------------------------------------------------------------------------------------------------------------------
// Geometry of a card drawn into rect r: padded frame, optional title strip, 9 x 3 cells.
export function cardGeom(r) {
  const pad = Math.max(4, Math.min(r.w, r.h) * 0.03);
  const cw = (r.w - pad * 2) / COLS, strip = !r.nostrip && Math.min(r.h * 0.14, cw * 0.46) > 14 ? Math.min(r.h * 0.12, cw * 0.4) : 0;
  const ch = (r.h - pad * 2 - strip) / ROWS;
  return { x: r.x, y: r.y, w: r.w, h: r.h, pad, cw, ch, strip, gx: r.x + pad, gy: r.y + pad + strip };
}
export const cellRectOf = (g, i) => ({ x: g.gx + (i % COLS) * g.cw, y: g.gy + Math.floor(i / COLS) * g.ch, w: g.cw, h: g.ch });
export function cellAtCard(g, px, py) {
  const x = px - g.gx, y = py - g.gy;
  if (x < 0 || y < 0 || x >= g.cw * COLS || y >= g.ch * ROWS) return -1;
  return Math.floor(y / g.ch) * COLS + Math.floor(x / g.cw);
}
// o: { marks, dead, chipT[], seed, hint:[cells], hintCol, flash:{cell,t,kind}, winRows:[rows], t, dim, label, open:[numbers] }
export function drawCard(ctx, r, card, th, o = {}) {
  const g = cardGeom(r), { marks = [], dead = [], chipT = [], t = 0 } = o;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = Math.min(18, r.h * 0.06); ctx.shadowOffsetY = Math.min(7, r.h * 0.03);
  roundPath(ctx, r.x, r.y, r.w, r.h, Math.min(14, g.cw * 0.4));
  ctx.fillStyle = th.paper; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(2, g.pad * 0.7); ctx.strokeStyle = th.print; ctx.stroke();
  if (g.strip > 0) {
    ctx.fillStyle = th.print; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const fs = Math.max(8, g.strip * 0.62); ctx.font = font(fs, 800, true);
    ctx.fillText('ЛОТО', g.gx + 2, r.y + g.pad + g.strip * 0.5);
    if (o.label) { ctx.textAlign = 'right'; ctx.font = font(fs * 0.9, 600, false, NUMFONT); ctx.fillText(o.label, g.gx + g.cw * COLS - 2, r.y + g.pad + g.strip * 0.5); }
    ctx.globalAlpha = 0.3; ctx.fillRect(g.gx, r.y + g.pad + g.strip - 1.5, g.cw * COLS, 1.5); ctx.globalAlpha = 1;
  }
  const fs = Math.min(g.cw * 0.66, g.ch * 0.6);
  for (let i = 0; i < CELLS; i++) {
    const c = cellRectOf(g, i), n = card[i], inset = 1.2;
    if (!n) {
      ctx.fillStyle = mixAlpha(th.print, 0.2); ctx.fillRect(c.x + inset, c.y + inset, c.w - inset * 2, c.h - inset * 2);
      ctx.save(); ctx.beginPath(); ctx.rect(c.x + inset, c.y + inset, c.w - inset * 2, c.h - inset * 2); ctx.clip();
      ctx.strokeStyle = mixAlpha(th.print, 0.28); ctx.lineWidth = 1; ctx.beginPath();
      for (let k = -c.h; k < c.w; k += 7) { ctx.moveTo(c.x + k, c.y + c.h); ctx.lineTo(c.x + k + c.h, c.y); }
      ctx.stroke(); ctx.restore();
      continue;
    }
    ctx.fillStyle = marks[i] ? mix(th.paper, th.print, 0.12) : th.paper; ctx.fillRect(c.x + inset, c.y + inset, c.w - inset * 2, c.h - inset * 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font(fs, 700, false, NUMFONT);
    ctx.fillStyle = dead[i] && !marks[i] ? 'rgba(60,30,20,0.35)' : mix(th.print2, '#000000', 0.25);
    ctx.fillText(String(n), c.x + c.w / 2, c.y + c.h / 2 + fs * 0.04);
    if (dead[i] && !marks[i]) { ctx.strokeStyle = 'rgba(120,40,30,0.55)'; ctx.lineWidth = Math.max(1.5, g.cw * 0.05); ctx.lineCap = 'round'; const d = Math.min(c.w, c.h) * 0.28; ctx.beginPath(); ctx.moveTo(c.x + c.w / 2 - d, c.y + c.h / 2 - d); ctx.lineTo(c.x + c.w / 2 + d, c.y + c.h / 2 + d); ctx.moveTo(c.x + c.w / 2 + d, c.y + c.h / 2 - d); ctx.lineTo(c.x + c.w / 2 - d, c.y + c.h / 2 + d); ctx.stroke(); }
    if (o.open && o.open.includes(n) && !marks[i]) {   // an open call: the cell wears a soft gold edge
      roundPath(ctx, c.x + 2, c.y + 2, c.w - 4, c.h - 4, Math.min(c.w, c.h) * 0.14); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(230,160,20,${0.55 + 0.25 * Math.sin(t * 6)})`; ctx.stroke();
    }
    if (marks[i]) drawChip(ctx, c.x + c.w / 2, c.y + c.h / 2, Math.min(c.w, c.h) * 0.9, th, (chipT[i] ?? 9) / 0.3, (o.seed ?? 0) + i);
  }
  // grid lines
  ctx.strokeStyle = mixAlpha(th.print, 0.55); ctx.lineWidth = 1.2; ctx.beginPath();
  for (let c = 0; c <= COLS; c++) { ctx.moveTo(g.gx + c * g.cw, g.gy); ctx.lineTo(g.gx + c * g.cw, g.gy + g.ch * ROWS); }
  for (let rr = 0; rr <= ROWS; rr++) { ctx.moveTo(g.gx, g.gy + rr * g.ch); ctx.lineTo(g.gx + g.cw * COLS, g.gy + rr * g.ch); }
  ctx.stroke();
  if (o.hintCol != null) {
    const a = 0.25 + 0.18 * Math.sin(t * 7);
    ctx.fillStyle = `rgba(255,214,90,${a})`; ctx.fillRect(g.gx + o.hintCol * g.cw, g.gy, g.cw, g.ch * ROWS);
  }
  if (o.hint) for (const i of o.hint) {
    const c = cellRectOf(g, i), k = 0.5 + 0.5 * Math.sin(t * 8);
    roundPath(ctx, c.x + 1, c.y + 1, c.w - 2, c.h - 2, Math.min(c.w, c.h) * 0.14); ctx.lineWidth = 4 + k * 2.5; ctx.strokeStyle = `rgba(255,214,60,${0.7 + 0.3 * k})`; ctx.stroke();
  }
  if (o.flash) {
    const c = cellRectOf(g, o.flash.cell), k = 1 - clamp01(o.flash.t / 0.5);
    ctx.fillStyle = o.flash.kind === 'wrong' ? `rgba(255,50,40,${0.55 * k})` : `rgba(255,255,255,${0.5 * k})`; ctx.fillRect(c.x, c.y, c.w, c.h);
  }
  if (o.winRows) for (const rr of o.winRows) {
    const k = 0.55 + 0.45 * Math.sin(t * 5 + rr);
    ctx.save(); ctx.shadowColor = 'rgba(255,210,70,0.95)'; ctx.shadowBlur = 14; roundPath(ctx, g.gx + 1, g.gy + rr * g.ch + 1, g.cw * COLS - 2, g.ch - 2, 6);
    ctx.lineWidth = 4; ctx.strokeStyle = `rgba(255,214,70,${0.6 + 0.4 * k})`; ctx.stroke(); ctx.restore();
  }
  if (o.dim) { roundPath(ctx, r.x, r.y, r.w, r.h, Math.min(14, g.cw * 0.4)); ctx.fillStyle = `rgba(10,6,2,${o.dim})`; ctx.fill(); }
  ctx.restore();
}
function mixAlpha(hex, a) { return rgba(hex, a); }

// A small card for an opponent: 27 dots, marked ones filled, with the best row outlined.
export function drawMini(ctx, x, y, w, card, marks, th, hot) {
  const cw = w / COLS, ch = cw * 0.8, h = ch * ROWS;
  ctx.save(); roundPath(ctx, x - 2, y - 2, w + 4, h + 4, 4); ctx.fillStyle = th.paper; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = th.print; ctx.stroke();
  for (let i = 0; i < CELLS; i++) {
    const cx = x + (i % COLS) * cw, cy = y + Math.floor(i / COLS) * ch;
    if (!card[i]) { ctx.fillStyle = rgba(th.print, 0.22); ctx.fillRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1); continue; }
    ctx.fillStyle = marks[i] ? th.chip[0] : 'rgba(0,0,0,0.12)'; ctx.fillRect(cx + 0.8, cy + 0.8, cw - 1.6, ch - 1.6);
  }
  if (hot) { roundPath(ctx, x - 4, y - 4, w + 8, h + 8, 6); ctx.lineWidth = 2.5; ctx.strokeStyle = th.accent; ctx.stroke(); }
  ctx.restore();
  return h;
}

export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const a = 1 - p.t / p.max; if (a <= 0) continue;
    ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.6); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
    if (p.kind === 'spark') { ctx.beginPath(); ctx.arc(0, 0, p.s * 0.5, 0, PI2); ctx.fill(); }
    else ctx.fillRect(-p.s / 2, -p.s * 0.3, p.s, p.s * 0.6);
    ctx.restore();
  }
}
