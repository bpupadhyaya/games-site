// All the reusable painting: backdrops, the carved board, stones, buttons, text helpers. Pure drawing: nothing here
// reads or writes game state. The heavy, unchanging pieces (the whole board plate, the backdrop) are baked once into
// an OffscreenCanvas and blitted; where OffscreenCanvas does not exist (the headless crash test) they paint directly.
// Seeded LCG, never Math.random, so a frame is a pure function of its inputs.
import { ROWS, COLS, DIRS, isStrong, idx, NEI } from './rules.js';

export const FONT = 'Georgia, "Times New Roman", serif';
export const THEME_ORDER = ['rosewood', 'ebony', 'paper'];
export const THEMES = {
  rosewood: {
    name: 'Rosewood',
    bg: ['#4a1a12', '#240c0a', '#0e0505'], glow: 'rgba(255,150,80,0.22)',
    plate: ['#9a5532', '#74391f', '#4e2312'], grain: 'rgba(34,9,4,0.22)', sheen: 'rgba(255,205,150,0.12)',
    line: '#1b0a05', lineHi: 'rgba(255,220,180,0.30)', dot: '#e3b068', dotRing: 'rgba(255,214,150,0.55)',
    frame: ['#3f1c12', '#2a120b', '#150805'], inlay: ['#f3c97a', '#a06c2b'], ink: '#f6e7c8', sub: '#e0b98a', panel: ['rgba(46,18,12,0.86)', 'rgba(24,9,6,0.9)'],
    light: ['#fffaf0', '#f0e3c2', '#bda57a'], lightRim: '#6a5230', dark: ['#6c5049', '#2c1b17', '#0b0605'], darkRim: '#d9a96a',
    accent: ['#f0b24a', '#c46a1c'], accentText: '#2a1204',
  },
  ebony: {
    name: 'Ebony & Brass',
    bg: ['#1f2530', '#10141b', '#07090c'], glow: 'rgba(120,170,255,0.14)',
    plate: ['#40362f', '#2b231d', '#17120e'], grain: 'rgba(0,0,0,0.30)', sheen: 'rgba(255,230,190,0.07)',
    line: '#d9b068', lineHi: 'rgba(0,0,0,0.5)', dot: '#f1d392', dotRing: 'rgba(241,211,146,0.45)',
    frame: ['#241d18', '#15110d', '#0a0806'], inlay: ['#f1d392', '#8d6a2a'], ink: '#f2ead8', sub: '#bfae8e', panel: ['rgba(26,30,40,0.88)', 'rgba(10,12,18,0.92)'],
    light: ['#ffffff', '#ece8de', '#aaa392'], lightRim: '#7a7360', dark: ['#a8484a', '#5e1f26', '#2a0a10'], darkRim: '#f1d392',
    accent: ['#e8c36e', '#b4852f'], accentText: '#231707',
  },
  paper: {
    name: 'Antaimoro Paper',
    bg: ['#365a52', '#1d3a36', '#0b1b19'], glow: 'rgba(255,230,160,0.18)',
    plate: ['#f1e5c4', '#e3d1a2', '#cdb780'], grain: 'rgba(120,84,40,0.16)', sheen: 'rgba(255,255,255,0.22)',
    line: '#5b2a1c', lineHi: 'rgba(255,255,255,0.45)', dot: '#8a3d22', dotRing: 'rgba(138,61,34,0.4)',
    frame: ['#7d4a2b', '#5a3320', '#3a2014'], inlay: ['#f3d99a', '#a97b3a'], ink: '#fbf1d8', sub: '#d9c79a', panel: ['rgba(30,56,50,0.88)', 'rgba(12,28,26,0.92)'],
    light: ['#ffffff', '#f6f1e6', '#b9b09a'], lightRim: '#8a7c58', dark: ['#5a68b4', '#27306a', '#0d1136'], darkRim: '#c9d0ff',
    accent: ['#f3c76a', '#c98a22'], accentText: '#2a1a05',
  },
};
export const themeOf = (name) => THEMES[name] || THEMES.rosewood;

export const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeBack = (t) => { t = clamp(t, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---- baking ------------------------------------------------------------------------------------------------------------
const newCanvas = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null);
const bakeCache = new Map();
export function invalidateArt() { bakeCache.clear(); }
// Paint `paint(ctx)` (drawing in local 0..w x 0..h) once, then blit at (x, y). `scale` bakes at higher resolution.
export function baked(ctx, key, x, y, w, h, paint, scale = 1) {
  let img = bakeCache.get(key);
  if (!img) {
    const cv = newCanvas(Math.ceil(w * scale), Math.ceil(h * scale));
    if (!cv) { ctx.save(); ctx.translate(x, y); paint(ctx); ctx.restore(); return; }
    const c = cv.getContext('2d'); c.scale(scale, scale); paint(c); img = cv; bakeCache.set(key, img);
  }
  ctx.drawImage(img, x, y, w, h);
}

// ---- backdrops -------------------------------------------------------------------------------------------------------
function paintBackdrop(c, T, w, h) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, T.bg[0]); g.addColorStop(0.55, T.bg[1]); g.addColorStop(1, T.bg[2]);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // woven raffia diamonds, very faint
  c.save(); c.globalAlpha = 0.07; c.strokeStyle = T.sub; c.lineWidth = 2;
  const st = 48;
  for (let y = -st; y < h + st; y += st) for (let x = -st; x < w + st; x += st) {
    const ox = (Math.round(y / st) & 1) * (st / 2);
    c.beginPath(); c.moveTo(x + ox, y - st / 2); c.lineTo(x + ox + st / 2, y); c.lineTo(x + ox, y + st / 2); c.lineTo(x + ox - st / 2, y); c.closePath(); c.stroke();
  }
  c.restore();
  const rg = c.createRadialGradient(w / 2, h * 0.42, 60, w / 2, h * 0.42, h * 0.7);
  rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = rg; c.fillRect(0, 0, w, h);
  const vg = c.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  c.fillStyle = vg; c.fillRect(0, 0, w, h);
}
// The backdrop fills the live screen; it is baked once per (theme, size) and older sizes are dropped.
export function drawBackdrop(ctx, themeName, W, H) {
  const T = themeOf(themeName), key = `bd:${themeName}:${Math.round(W)}x${Math.round(H)}`;
  if (!bakeCache.has(key)) for (const k of [...bakeCache.keys()]) if (k.startsWith('bd:')) bakeCache.delete(k);
  baked(ctx, key, 0, 0, W, H, (c) => paintBackdrop(c, T, W, H), 0.5);
}

// A baobab silhouette (the tree the island is known for): a swollen bottle trunk and a flat crown of branches.
export function drawBaobab(ctx, x, y, h, color, lean = 0) {
  const w = h * 0.22;
  ctx.save(); ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.55, y);
  ctx.bezierCurveTo(x - w * 0.9, y - h * 0.18, x - w * 0.35, y - h * 0.5, x - w * 0.3 + lean, y - h * 0.72);
  ctx.lineTo(x + w * 0.3 + lean, y - h * 0.72);
  ctx.bezierCurveTo(x + w * 0.35, y - h * 0.5, x + w * 0.9, y - h * 0.18, x + w * 0.55, y);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  const top = y - h * 0.72, rnd = lcg(Math.round(x * 7 + h));
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.34 + (rnd() - 0.5) * 0.15, len = h * (0.2 + rnd() * 0.14);
    const ex = x + lean + Math.cos(a) * len * 1.4, ey = top + Math.sin(a) * len * 0.8;
    ctx.lineWidth = Math.max(2, h * 0.034);
    ctx.beginPath(); ctx.moveTo(x + lean + (i - 4) * w * 0.05, top + 6); ctx.quadraticCurveTo(x + lean + (ex - x) * 0.5, top - len * 0.5, ex, ey); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ex, ey - 4, h * 0.075, h * 0.034, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- the board ----------------------------------------------------------------------------------------------------------
// Local geometry of a (window of the) board painted at spacing S inside a frame of thickness F.
export function boardBox(o) {
  const { S, F, r0 = 0, r1 = ROWS - 1, c0 = 0, c1 = COLS - 1 } = o;
  return { w: (r1 - r0) * S + F * 2, h: (c1 - c0) * S + F * 2 };
}
// local position of point (r, c) in a painted board window (vertical orientation, c = c1 at the top)
export const localXY = (o, r, c) => ({ x: o.F + (r - (o.r0 ?? 0)) * o.S, y: o.F + ((o.c1 ?? COLS - 1) - c) * o.S });

function paintPlate(c, T, w, h, F, seed, round) {
  const grad = c.createLinearGradient(0, 0, w * 0.4, h);
  grad.addColorStop(0, T.frame[0]); grad.addColorStop(0.5, T.frame[1]); grad.addColorStop(1, T.frame[2]);
  rr(c, 0, 0, w, h, round); c.fillStyle = grad; c.fill();
  c.save(); rr(c, 0, 0, w, h, round); c.clip();
  const rnd = lcg(seed);
  // frame grain
  c.strokeStyle = 'rgba(255,200,150,0.07)'; c.lineWidth = 1.2;
  for (let i = 0; i < 60; i++) { const x = rnd() * w; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + (rnd() - 0.5) * 30, h * 0.3, x + (rnd() - 0.5) * 30, h * 0.7, x + (rnd() - 0.5) * 20, h); c.stroke(); }
  c.restore();
  // inner playing surface
  const ix = F * 0.55, iy = F * 0.55, iw = w - F * 1.1, ih = h - F * 1.1;
  const pg = c.createLinearGradient(0, iy, w * 0.3, iy + ih);
  pg.addColorStop(0, T.plate[0]); pg.addColorStop(0.5, T.plate[1]); pg.addColorStop(1, T.plate[2]);
  rr(c, ix, iy, iw, ih, Math.max(6, round * 0.45)); c.fillStyle = pg; c.fill();
  c.save(); rr(c, ix, iy, iw, ih, Math.max(6, round * 0.45)); c.clip();
  // grain along the long axis, plus a few knots of lighter figure
  const rg = lcg(seed * 3 + 11);
  for (let i = 0; i < 110; i++) {
    const x = ix + rg() * iw, wob = (rg() - 0.5) * 26;
    c.strokeStyle = T.grain; c.lineWidth = 0.8 + rg() * 2.2;
    c.beginPath(); c.moveTo(x, iy); c.bezierCurveTo(x + wob, iy + ih * 0.3, x - wob, iy + ih * 0.65, x + wob * 0.4, iy + ih); c.stroke();
  }
  c.strokeStyle = T.sheen; c.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const x = ix + rg() * iw; c.lineWidth = 8 + rg() * 20; c.beginPath(); c.moveTo(x, iy + rg() * 40); c.bezierCurveTo(x + 30, iy + ih * 0.35, x - 30, iy + ih * 0.65, x + 10, iy + ih - rg() * 40); c.stroke(); }
  const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  c.fillStyle = vg; c.fillRect(ix, iy, iw, ih);
  c.restore();
  // bevel: dark lip then lit lip
  rr(c, ix, iy, iw, ih, Math.max(6, round * 0.45)); c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.55)'; c.stroke();
  rr(c, ix + 2, iy + 2, iw - 4, ih - 4, Math.max(5, round * 0.4)); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,230,190,0.18)'; c.stroke();
}
// zigzag diamond inlay band running around the frame (a nod to woven Malagasy textile borders)
function paintInlay(c, T, w, h, F) {
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, T.inlay[0]); g.addColorStop(1, T.inlay[1]);
  c.fillStyle = g; c.strokeStyle = g;
  const m = F * 0.26, step = Math.max(14, F * 0.62), d = Math.max(4, F * 0.13);
  rr(c, m, m, w - m * 2, h - m * 2, 10); c.lineWidth = 1.6; c.globalAlpha = 0.85; c.stroke();
  const diamond = (x, y) => { c.beginPath(); c.moveTo(x, y - d); c.lineTo(x + d, y); c.lineTo(x, y + d); c.lineTo(x - d, y); c.closePath(); c.fill(); };
  const cy = F * 0.27, cx = F * 0.27;
  for (let x = F * 0.9; x < w - F * 0.8; x += step) { diamond(x, cy * 0.85 + 0); diamond(x, h - cy * 0.85); }
  for (let y = F * 0.9; y < h - F * 0.8; y += step) { diamond(cx * 0.85, y); diamond(w - cx * 0.85, y); }
  c.globalAlpha = 1;
  // corner rosettes: eight-point stars
  for (const [x, y] of [[F * 0.5, F * 0.5], [w - F * 0.5, F * 0.5], [F * 0.5, h - F * 0.5], [w - F * 0.5, h - F * 0.5]]) {
    c.save(); c.translate(x, y); c.fillStyle = g;
    for (let k = 0; k < 8; k++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(0, -F * 0.34); c.lineTo(F * 0.07, -F * 0.1); c.lineTo(-F * 0.07, -F * 0.1); c.closePath(); c.fill(); }
    c.beginPath(); c.arc(0, 0, F * 0.09, 0, TAU); c.fillStyle = T.frame[2]; c.fill();
    c.restore();
  }
}
function paintLines(c, T, o) {
  const { S, F, r0 = 0, r1 = ROWS - 1, c0 = 0, c1 = COLS - 1 } = o;
  const pt = (r, cc) => localXY(o, r, cc);
  const segs = [];
  for (let r = r0; r <= r1; r++) for (let cc = c0; cc <= c1; cc++) {
    const p = idx(r, cc);
    for (const { to } of NEI[p]) {
      if (to < p) continue;
      const tr = (to / COLS) | 0, tc = to % COLS;
      if (tr < r0 || tr > r1 || tc < c0 || tc > c1) continue;
      segs.push([pt(r, cc), pt(tr, tc)]);
    }
  }
  c.lineCap = 'round';
  const stroke = (style, wd, dx, dy) => { c.strokeStyle = style; c.lineWidth = wd; c.beginPath(); for (const [a, b] of segs) { c.moveTo(a.x + dx, a.y + dy); c.lineTo(b.x + dx, b.y + dy); } c.stroke(); };
  stroke(T.lineHi, Math.max(2.5, S * 0.034), 1.2, 1.6);       // lit lower edge of the engraving
  stroke(T.line, Math.max(2.4, S * 0.03), 0, 0);              // the engraving itself
  for (let r = r0; r <= r1; r++) for (let cc = c0; cc <= c1; cc++) {
    const q = pt(r, cc);
    if (isStrong(idx(r, cc))) {
      c.beginPath(); c.arc(q.x, q.y, S * 0.085, 0, TAU); c.fillStyle = T.dot; c.fill();
      c.lineWidth = 1.6; c.strokeStyle = T.line; c.stroke();
      c.beginPath(); c.arc(q.x, q.y, S * 0.14, 0, TAU); c.lineWidth = 1.4; c.strokeStyle = T.dotRing; c.stroke();
    } else {
      c.beginPath(); c.arc(q.x, q.y, S * 0.05, 0, TAU); c.fillStyle = T.line; c.fill();
    }
  }
}
// The complete board, painted in local coordinates (0,0 = top-left of the frame).
export function paintBoard(c, T, o) {
  const { w, h } = boardBox(o);
  paintPlate(c, T, w, h, o.F, o.seed ?? 7, o.round ?? 26);
  if (o.inlay !== false) paintInlay(c, T, w, h, o.F);
  paintLines(c, T, o);
}
// Draw the whole 5x9 board at (x, y), baked.
export function drawBoard(ctx, themeName, x, y, o) {
  const T = themeOf(themeName), { w, h } = boardBox(o);
  // soft drop shadow onto the table
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 14; rr(ctx, x, y, w, h, 26); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  baked(ctx, `board:${themeName}:${o.S}:${o.F}:${o.r0 ?? 0}${o.r1 ?? 4}${o.c0 ?? 0}${o.c1 ?? 8}${o.inlay === false ? 'n' : 'i'}`, x, y, w, h, (c) => paintBoard(c, T, o), 2);
}

// ---- stones --------------------------------------------------------------------------------------------------------
// o: { lift (0..1 raised), scale, alpha, glow (colour string), pulse, ghost }
export function drawStone(ctx, x, y, R, side, T, o = {}) {
  const { lift = 0, scale = 1, alpha = 1, glow = null } = o;
  const r = R * scale;
  if (r <= 0.5 || alpha <= 0) return;
  const set = side === 1 ? T.light : T.dark;
  ctx.save(); ctx.globalAlpha = alpha;
  // contact shadow
  const sh = ctx.createRadialGradient(x + 5, y + 10 + lift * 14, r * 0.2, x + 5, y + 10 + lift * 14, r * (1.25 + lift * 0.3));
  sh.addColorStop(0, `rgba(0,0,0,${0.5 - lift * 0.12})`); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(x + 5, y + 10 + lift * 14, r * (1.25 + lift * 0.3), r * (1.1 + lift * 0.3), 0, 0, TAU); ctx.fill();
  const cy = y - lift * 12;
  if (glow) { ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 26; ctx.beginPath(); ctx.arc(x, cy, r * 1.02, 0, TAU); ctx.fillStyle = glow; ctx.globalAlpha = alpha * 0.55; ctx.fill(); ctx.restore(); }
  // body
  const g = ctx.createRadialGradient(x - r * 0.36, cy - r * 0.42, r * 0.08, x, cy, r * 1.08);
  g.addColorStop(0, set[0]); g.addColorStop(0.5, set[1]); g.addColorStop(1, set[2]);
  ctx.beginPath(); ctx.arc(x, cy, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1.6, r * 0.05); ctx.strokeStyle = side === 1 ? T.lightRim : T.darkRim; ctx.globalAlpha = alpha * (side === 1 ? 0.85 : 0.55); ctx.stroke(); ctx.globalAlpha = alpha;
  // carved inner ring + specular
  ctx.beginPath(); ctx.arc(x, cy, r * 0.66, 0, TAU); ctx.lineWidth = Math.max(1.2, r * 0.035); ctx.strokeStyle = side === 1 ? 'rgba(110,80,40,0.28)' : 'rgba(255,230,190,0.16)'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x - r * 0.3, cy - r * 0.42, r * 0.3, r * 0.16, -0.7, 0, TAU); ctx.fillStyle = side === 1 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.32)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.34, cy + r * 0.4, r * 0.34, 0.1, 1.5); ctx.lineWidth = r * 0.12; ctx.strokeStyle = side === 1 ? 'rgba(120,90,50,0.16)' : 'rgba(0,0,0,0.28)'; ctx.stroke();
  ctx.restore();
}

// ---- text helpers --------------------------------------------------------------------------------------------------
export function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}
// Set a font and shrink it until `text` fits one line of maxW (never below minPx).
// The smallest type, in virtual units, that is still about 11 css pixels on this device (set each frame by view.js).
let MIN_PX = 12;
export const setMinPx = (v) => { MIN_PX = Math.max(11, v); };
export const minPx = () => MIN_PX;
export function fitFont(ctx, text, weight, px, maxW, minPx = 12) {
  minPx = Math.min(Math.max(minPx, MIN_PX), px);
  let s = px;
  for (;;) { ctx.font = `${weight} ${s}px ${FONT}`; if (ctx.measureText(text).width <= maxW || s <= minPx) break; s -= 1; }
  return s;
}
export function textBlock(ctx, text, cx, y, maxW, lh, align = 'center') {
  const lines = wrapLines(ctx, text, maxW);
  ctx.textAlign = align;
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
  return lines.length;
}

// ---- buttons -------------------------------------------------------------------------------------------------------
// While a finger or the mouse is down, the button under it is drawn pressed: lower, flatter shadow, a little darker.
let pressAt = null;
export const setPress = (pt) => { pressAt = pt; };
export function drawButton(ctx, r, label, T, o = {}) {
  const { primary = false, active = false, disabled = false, sub = null, px = 34, subPx = 20 } = o;
  const pressed = !disabled && (o.pressed || (!!pressAt && pressAt.x >= r.x && pressAt.x <= r.x + r.w && pressAt.y >= r.y && pressAt.y <= r.y + r.h));
  ctx.save();
  if (pressed) ctx.translate(0, 2);
  if (disabled) ctx.globalAlpha = 0.45;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = pressed ? 4 : 14; ctx.shadowOffsetY = pressed ? 2 : 6;
  rr(ctx, r.x, r.y, r.w, r.h, 22);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  if (primary) { g.addColorStop(0, T.accent[0]); g.addColorStop(1, T.accent[1]); }
  else if (active) { g.addColorStop(0, 'rgba(255,214,150,0.30)'); g.addColorStop(1, 'rgba(255,170,90,0.16)'); }
  else { g.addColorStop(0, T.panel[0]); g.addColorStop(1, T.panel[1]); }
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  if (pressed) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill(); }
  ctx.lineWidth = 2; ctx.strokeStyle = primary ? 'rgba(255,240,200,0.7)' : active ? 'rgba(255,214,150,0.85)' : 'rgba(255,225,180,0.28)'; ctx.stroke();
  ctx.fillStyle = primary ? T.accentText : T.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const maxW = r.w - 24;
  if (sub) {
    const s1 = fitFont(ctx, label, 700, px, maxW, 14); ctx.fillText(label, r.x + r.w / 2, r.y + r.h * 0.4);
    ctx.globalAlpha = (disabled ? 0.45 : 1) * 0.8; fitFont(ctx, sub, 400, subPx, maxW, 11); ctx.fillText(sub, r.x + r.w / 2, r.y + r.h * 0.4 + s1 * 0.78);
  } else { fitFont(ctx, label, 700, px, maxW, 14); ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1); }
  ctx.restore();
}
export function drawPanel(ctx, r, T, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
  rr(ctx, r.x, r.y, r.w, r.h, o.round ?? 26);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, T.panel[0]); g.addColorStop(1, T.panel[1]);
  ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,225,180,0.3)'; ctx.stroke();
  ctx.restore();
}
// little carved icons for the bar buttons
export function drawIcon(ctx, kind, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'undo') { ctx.beginPath(); ctx.arc(0, 2, s * 0.5, Math.PI * 1.1, Math.PI * 2.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.62, -s * 0.12); ctx.lineTo(-s * 0.5, -s * 0.5); ctx.lineTo(-s * 0.12, -s * 0.28); ctx.stroke(); }
  else if (kind === 'think') { ctx.beginPath(); ctx.arc(0, -s * 0.1, s * 0.42, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.2, s * 0.5); ctx.lineTo(s * 0.2, s * 0.5); ctx.moveTo(-s * 0.14, s * 0.68); ctx.lineTo(s * 0.14, s * 0.68); ctx.stroke(); }
  else if (kind === 'danger') { ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.55, s * 0.45); ctx.lineTo(-s * 0.55, s * 0.45); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -s * 0.15); ctx.lineTo(0, s * 0.12); ctx.stroke(); ctx.beginPath(); ctx.arc(0, s * 0.28, s * 0.03, 0, TAU); ctx.fill(); }
  else if (kind === 'stop') { ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.lineTo(-s * 0.1, s * 0.4); ctx.lineTo(s * 0.55, -s * 0.4); ctx.stroke(); }
  else if (kind === 'flag') { ctx.beginPath(); ctx.moveTo(-s * 0.35, s * 0.55); ctx.lineTo(-s * 0.35, -s * 0.55); ctx.lineTo(s * 0.5, -s * 0.25); ctx.lineTo(-s * 0.35, s * 0.05); ctx.stroke(); }
  else if (kind === 'pause') { ctx.fillRect(-s * 0.32, -s * 0.42, s * 0.2, s * 0.84); ctx.fillRect(s * 0.12, -s * 0.42, s * 0.2, s * 0.84); }
  else if (kind === 'play') { ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.45); ctx.lineTo(s * 0.45, 0); ctx.lineTo(-s * 0.3, s * 0.45); ctx.closePath(); ctx.fill(); }
  else if (kind === 'menu') { for (const dy of [-0.32, 0, 0.32]) { ctx.beginPath(); ctx.moveTo(-s * 0.45, dy * s); ctx.lineTo(s * 0.45, dy * s); ctx.stroke(); } }
  else if (kind === 'sound') { ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.18); ctx.lineTo(-s * 0.22, -s * 0.18); ctx.lineTo(s * 0.12, -s * 0.5); ctx.lineTo(s * 0.12, s * 0.5); ctx.lineTo(-s * 0.22, s * 0.18); ctx.lineTo(-s * 0.5, s * 0.18); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(s * 0.12, 0, s * 0.32, -0.9, 0.9); ctx.stroke(); }
  else if (kind === 'mute') { ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.18); ctx.lineTo(-s * 0.22, -s * 0.18); ctx.lineTo(s * 0.12, -s * 0.5); ctx.lineTo(s * 0.12, s * 0.5); ctx.lineTo(-s * 0.22, s * 0.18); ctx.lineTo(-s * 0.5, s * 0.18); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.2); ctx.lineTo(s * 0.62, s * 0.2); ctx.moveTo(s * 0.62, -s * 0.2); ctx.lineTo(s * 0.3, s * 0.2); ctx.stroke(); }
  ctx.restore();
}
export { DIRS };
