// All the reusable painting: backdrops, the uncheckered lacquer board, the original pieces, buttons, text helpers.
// Pure drawing: nothing here reads or writes game state. Heavy unchanging art (backdrop, board plate, every piece) is
// baked once into an OffscreenCanvas and blitted; where OffscreenCanvas does not exist (the headless crash test) it is
// painted directly. A seeded LCG, never Math.random, so a frame is a pure function of its inputs.
import { BIA, MET, KHON, MA, RUA, KHUN, NGAI } from './rules.js';
import { W, H, SQ, FRAME } from './layout.js';

export const FONT = 'Georgia, "Times New Roman", serif';
export const DISPLAY = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
export const THEME_ORDER = ['jade', 'teak', 'indigo'];
export const THEMES = {
  jade: {
    name: 'Jade Lacquer',
    bg: ['#0f4a46', '#0a2f2d', '#041513'], glow: 'rgba(255,200,110,0.16)', motif: 'rgba(240,200,120,0.07)',
    plate: ['#1b7468', '#12574f', '#0b3b36'], grain: 'rgba(0,0,0,0.12)', sheen: 'rgba(200,255,240,0.07)',
    line: '#e6c36f', lineLo: 'rgba(0,0,0,0.45)', mark: 'rgba(230,195,111,0.9)', label: '#f0d896',
    frame: ['#6a4226', '#47281a', '#2a160d'], inlay: ['#f4d98c', '#b98a35'], ink: '#fbf0d4', sub: '#d8c690',
    panel: '#10302e', panelEdge: 'rgba(240,205,130,0.45)', accent: '#efbd4f', accentDark: '#c58f25', accentText: '#2a1a05',
  },
  teak: {
    name: 'Carved Teak',
    bg: ['#3c2416', '#26150d', '#0f0805'], glow: 'rgba(255,170,80,0.16)', motif: 'rgba(255,205,140,0.06)',
    plate: ['#d29a5c', '#b9803f', '#94602c'], grain: 'rgba(70,35,10,0.2)', sheen: 'rgba(255,230,180,0.14)',
    line: '#3a1f0e', lineLo: 'rgba(255,225,170,0.32)', mark: 'rgba(60,30,12,0.85)', label: '#f1d9a2',
    frame: ['#3a2113', '#251309', '#150a05'], inlay: ['#f0cd7c', '#a97a2e'], ink: '#fbefd6', sub: '#dcc08a',
    panel: '#2c1a10', panelEdge: 'rgba(240,200,140,0.4)', accent: '#efbd4f', accentDark: '#c58f25', accentText: '#2a1a05',
  },
  indigo: {
    name: 'Indigo Night',
    bg: ['#1b2352', '#111637', '#070a1c'], glow: 'rgba(170,190,255,0.14)', motif: 'rgba(200,210,255,0.06)',
    plate: ['#2f3f86', '#222f66', '#161e45'], grain: 'rgba(0,0,0,0.14)', sheen: 'rgba(210,225,255,0.08)',
    line: '#d9c27d', lineLo: 'rgba(0,0,0,0.45)', mark: 'rgba(217,194,125,0.9)', label: '#e5d59b',
    frame: ['#2a2220', '#1a1412', '#0c0907'], inlay: ['#f0d995', '#9e7b34'], ink: '#f3efe0', sub: '#c4bd9d',
    panel: '#141a40', panelEdge: 'rgba(225,205,140,0.4)', accent: '#efbd4f', accentDark: '#c58f25', accentText: '#2a1a05',
  },
};
export const themeOf = (name) => THEMES[name] || THEMES.jade;

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

// ---- baking -------------------------------------------------------------------------------------------------------------
const newCanvas = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null);
const bakeCache = new Map();
export function invalidateArt() { bakeCache.clear(); }
export function isBaked(key) { return bakeCache.has(key); }
// Paint `paint(ctx)` (drawing in local 0..w x 0..h) once, then blit at (x, y). `scale` bakes at higher resolution.
function getImage(key, srcW, srcH, paint, scale) {
  let img = bakeCache.get(key);
  if (!img) {
    const cv = newCanvas(Math.ceil(srcW * scale), Math.ceil(srcH * scale));
    if (!cv) return null;
    const c = cv.getContext('2d'); c.scale(scale, scale); paint(c); img = cv; bakeCache.set(key, img);
  }
  return img;
}
export function baked(ctx, key, x, y, w, h, paint, scale = 1, srcW = w, srcH = h) {
  const img = getImage(key, srcW, srcH, paint, scale);
  if (!img) { ctx.save(); ctx.translate(x, y); ctx.scale(w / srcW, h / srcH); paint(ctx); ctx.restore(); return; }
  ctx.drawImage(img, x, y, w, h);
}

// ---- motifs ----------------------------------------------------------------------------------------------------------------
// A flame-leaf: a pointed, double-curved leaf used in the backdrop lattice and the carved frame inlay.
export function flameLeaf(c, x, y, s, ang = 0) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.moveTo(0, 0);
  c.bezierCurveTo(s * 0.3, -s * 0.12, s * 0.3, -s * 0.5, s * 0.1, -s * 0.66);
  c.bezierCurveTo(s * 0.22, -s * 0.78, s * 0.05, -s * 0.92, 0, -s);
  c.bezierCurveTo(-s * 0.04, -s * 0.9, -s * 0.2, -s * 0.78, -s * 0.1, -s * 0.66);
  c.bezierCurveTo(-s * 0.3, -s * 0.5, -s * 0.3, -s * 0.12, 0, 0);
  c.closePath(); c.fill(); c.restore();
}

function paintBackdrop(c, T, w, h) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, T.bg[0]); g.addColorStop(0.55, T.bg[1]); g.addColorStop(1, T.bg[2]);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // a lattice of flame-leaves, very faint
  c.fillStyle = T.motif;
  const st = 84;
  for (let y = 0; y < h + st; y += st) for (let x = 0; x < w + st; x += st) {
    const ox = (Math.round(y / st) & 1) * (st / 2);
    flameLeaf(c, x + ox, y + st * 0.42, st * 0.5, 0); flameLeaf(c, x + ox, y + st * 0.58, st * 0.5, Math.PI);
    c.beginPath(); c.arc(x + ox + st / 2, y + st / 2, 2.2, 0, TAU); c.fill();
  }
  const rg = c.createRadialGradient(w / 2, h * 0.4, 60, w / 2, h * 0.4, h * 0.7);
  rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = rg; c.fillRect(0, 0, w, h);
  const vg = c.createRadialGradient(w / 2, h / 2, h * 0.33, w / 2, h / 2, h * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = vg; c.fillRect(0, 0, w, h);
}
let lastBd = '';
export function drawBackdrop(ctx, themeName) {
  const T = themeOf(themeName);
  const key = `bd:${themeName}:${W}x${H}`;
  if (key !== lastBd) { for (const k of [...bakeCache.keys()]) if (k.startsWith('bd:') && k !== key) bakeCache.delete(k); lastBd = key; }
  baked(ctx, key, 0, 0, W, H, (c) => paintBackdrop(c, T, W, H), 0.5);
}

// ---- the board --------------------------------------------------------------------------------------------------------------
// o: { S (square), F (frame), f0,f1 (file window), r0,r1 (rank window), labels, flip, round, seed, inlay }
export function boardBox(o) {
  const { S, F, f0 = 0, f1 = 7, r0 = 0, r1 = 7 } = o;
  return { w: (f1 - f0 + 1) * S + F * 2, h: (r1 - r0 + 1) * S + F * 2 };
}
// local top-left of a square in a painted board window (rank r1 at the top; flip puts r0 at the top and f1 on the left)
export function localSq(o, file, rank) {
  const { S, F, f0 = 0, f1 = 7, r0 = 0, r1 = 7, flip = false } = o;
  return flip ? { x: F + (f1 - file) * S, y: F + (rank - r0) * S } : { x: F + (file - f0) * S, y: F + (r1 - rank) * S };
}

function paintFrame(c, T, w, h, F, seed, round) {
  const grad = c.createLinearGradient(0, 0, w * 0.5, h);
  grad.addColorStop(0, T.frame[0]); grad.addColorStop(0.5, T.frame[1]); grad.addColorStop(1, T.frame[2]);
  rr(c, 0, 0, w, h, round); c.fillStyle = grad; c.fill();
  c.save(); rr(c, 0, 0, w, h, round); c.clip();
  const rnd = lcg(seed); c.strokeStyle = 'rgba(255,200,150,0.06)'; c.lineWidth = 1.3;
  for (let i = 0; i < 70; i++) { const x = rnd() * w; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + (rnd() - 0.5) * 30, h * 0.3, x + (rnd() - 0.5) * 30, h * 0.7, x + (rnd() - 0.5) * 20, h); c.stroke(); }
  c.restore();
  rr(c, 1.5, 1.5, w - 3, h - 3, round); c.lineWidth = 3; c.strokeStyle = 'rgba(255,225,180,0.16)'; c.stroke();
}
function paintInlay(c, T, w, h, F) {
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, T.inlay[0]); g.addColorStop(1, T.inlay[1]);
  c.fillStyle = g; c.strokeStyle = g;
  const m = F * 0.24;
  const step = Math.max(14, F * 0.78), leaf = F * 0.26;
  for (let x = F * 1.3; x < w - F * 1.1; x += step) { flameLeaf(c, x, m + leaf * 0.5, leaf, 0); flameLeaf(c, x, h - m - leaf * 0.5, leaf, Math.PI); }
  for (let y = F * 1.3; y < h - F * 1.1; y += step) { flameLeaf(c, m + leaf * 0.5, y, leaf, Math.PI / 2); flameLeaf(c, w - m - leaf * 0.5, y, leaf, -Math.PI / 2); }
  for (const [x, y] of [[m, m], [w - m, m], [m, h - m], [w - m, h - m]]) {
    c.save(); c.translate(x, y);
    for (let k = 0; k < 8; k++) { c.rotate(Math.PI / 4); flameLeaf(c, 0, 0, F * 0.36, 0); }
    c.beginPath(); c.arc(0, 0, F * 0.09, 0, TAU); c.fillStyle = T.frame[2]; c.fill(); c.restore();
  }
}
function paintPlate(c, T, o) {
  const { S, F, f0 = 0, f1 = 7, r0 = 0, r1 = 7 } = o, { w, h } = boardBox(o);
  const ix = F, iy = F, iw = w - F * 2, ih = h - F * 2;
  const pg = c.createLinearGradient(0, iy, iw * 0.4, iy + ih); pg.addColorStop(0, T.plate[0]); pg.addColorStop(0.5, T.plate[1]); pg.addColorStop(1, T.plate[2]);
  c.fillStyle = pg; c.fillRect(ix, iy, iw, ih);
  c.save(); c.beginPath(); c.rect(ix, iy, iw, ih); c.clip();
  const rg = lcg((o.seed ?? 7) * 3 + 11);
  for (let i = 0; i < 90; i++) { const x = ix + rg() * iw, wob = (rg() - 0.5) * 24; c.strokeStyle = T.grain; c.lineWidth = 0.6 + rg() * 1.8; c.beginPath(); c.moveTo(x, iy); c.bezierCurveTo(x + wob, iy + ih * 0.3, x - wob, iy + ih * 0.65, x + wob * 0.4, iy + ih); c.stroke(); }
  c.strokeStyle = T.sheen; c.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const x = ix + rg() * iw; c.lineWidth = 8 + rg() * 18; c.beginPath(); c.moveTo(x, iy + rg() * 30); c.bezierCurveTo(x + 24, iy + ih * 0.35, x - 24, iy + ih * 0.65, x + 8, iy + ih - rg() * 30); c.stroke(); }
  const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.66); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.34)');
  c.fillStyle = vg; c.fillRect(ix, iy, iw, ih);
  c.restore();
  // engraved grid: shadow pass then gold-leaf pass
  const nf = f1 - f0 + 1, nr = r1 - r0 + 1;
  const stroke = (style, wd, dx, dy) => {
    c.strokeStyle = style; c.lineWidth = wd; c.lineCap = 'square'; c.beginPath();
    for (let i = 0; i <= nf; i++) { c.moveTo(ix + i * S + dx, iy + dy); c.lineTo(ix + i * S + dx, iy + ih + dy); }
    for (let j = 0; j <= nr; j++) { c.moveTo(ix + dx, iy + j * S + dy); c.lineTo(ix + iw + dx, iy + j * S + dy); }
    c.stroke();
  };
  stroke(T.lineLo, Math.max(2.2, S * 0.032), 1.4, 1.8);
  stroke(T.line, Math.max(2, S * 0.028), 0, 0);
  c.strokeStyle = T.line; c.lineWidth = Math.max(3, S * 0.05); c.strokeRect(ix, iy, iw, ih);
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2; c.strokeRect(ix - 2, iy - 2, iw + 4, ih + 4);
}
function paintLabels(c, T, o) {
  const { S, F, f0 = 0, f1 = 7, r0 = 0, r1 = 7 } = o;
  c.fillStyle = T.label; c.font = `700 ${Math.round(F * 0.44)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.9;
  const bottom = F + (r1 - r0 + 1) * S + F * 0.32;
  for (let f = f0; f <= f1; f++) { const p = localSq(o, f, r0); c.fillText(String.fromCharCode(97 + f), p.x + S / 2, bottom); }
  for (let r = r0; r <= r1; r++) { const p = localSq(o, f0, r); c.fillText(String(r + 1), F * 0.7, p.y + S / 2); }
  c.globalAlpha = 1;
}
export function paintBoard(c, T, o) {
  const { w, h } = boardBox(o);
  paintFrame(c, T, w, h, o.F, o.seed ?? 7, o.round ?? 26);
  if (o.inlay !== false) paintInlay(c, T, w, h, o.F);
  paintPlate(c, T, o);
  if (o.labels) paintLabels(c, T, o);
}
export function drawBoard(ctx, themeName, x, y, o) {
  const T = themeOf(themeName), { w, h } = boardBox(o);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 14; rr(ctx, x, y, w, h, o.round ?? 26); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  baked(ctx, `board:${themeName}:${o.S}:${o.F}:${o.flip ? 'f' : 'n'}:${o.labels ? 'l' : 'x'}:${o.inlay === false ? 'n' : 'i'}`, x, y, w, h, (c) => paintBoard(c, T, o), 1.5);
}

// ---- the pieces (original art) -----------------------------------------------------------------------------------------------
export const PALETTE = {
  1: { hi: '#fff6d2', mid: '#efc766', lo: '#a9771f', rim: '#4f3209', trim: '#8a5a14', shine: 'rgba(255,255,255,0.7)', dark: '#5a3a0c' },
  '-1': { hi: '#ff9580', mid: '#cf2f36', lo: '#6a0e1d', rim: '#2a0510', trim: '#f7d57e', shine: 'rgba(255,225,205,0.55)', dark: '#2a0510' },
};
const PW = 120, PH = 132, PB = 122; // sprite box (units) and the baseline (bottom centre) inside it

function gradX(c, x0, x1, P) { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, P.hi); g.addColorStop(0.45, P.mid); g.addColorStop(1, P.lo); return g; }
function fillBody(c, P, x0, x1) { c.fillStyle = gradX(c, x0, x1, P); c.fill(); c.lineWidth = 2.4; c.lineJoin = 'round'; c.strokeStyle = P.rim; c.stroke(); }
function pedestal(c, P) {
  c.beginPath(); c.ellipse(0, -7, 36, 10, 0, 0, TAU); fillBody(c, P, -36, 36);
  rr(c, -28, -22, 56, 15, 6); fillBody(c, P, -28, 28);
  c.beginPath(); c.moveTo(-26, -15); c.lineTo(26, -15); c.lineWidth = 2.2; c.strokeStyle = P.trim; c.stroke();
}
function shine(c, P, x, y, rx, ry, ang = -0.6) { c.beginPath(); c.ellipse(x, y, rx, ry, ang, 0, TAU); c.fillStyle = P.shine; c.fill(); }
function band(c, P, x, y, w, h) { rr(c, x, y, w, h, h / 2); c.fillStyle = P.trim; c.fill(); c.lineWidth = 1.4; c.strokeStyle = P.rim; c.stroke(); }

function shapeBia(c, P, back) {
  c.beginPath(); c.ellipse(0, -30, 36, 26, 0, 0, TAU); fillBody(c, P, -36, 36);
  if (!back) {
    // the toothed slit along the shell
    c.beginPath(); c.moveTo(-28, -30); c.quadraticCurveTo(0, -38, 28, -30); c.quadraticCurveTo(0, -23, -28, -30); c.fillStyle = P.dark; c.fill();
    c.strokeStyle = P.hi; c.lineWidth = 1.7;
    for (let i = -22; i <= 22; i += 5.5) { const y0 = -33.5 + (i * i) / 600; c.beginPath(); c.moveTo(i, y0 + 0.5); c.lineTo(i, y0 + 3); c.stroke(); }
    shine(c, P, -12, -46, 14, 5, -0.2);
  } else {
    // the back of the shell: a domed, speckled surface and a diamond mark
    c.save(); c.beginPath(); c.ellipse(0, -30, 36, 26, 0, 0, TAU); c.clip();
    c.fillStyle = 'rgba(0,0,0,0.13)';
    for (const [x, y, r] of [[-22, -24, 3.2], [-10, -42, 2.6], [20, -38, 3], [24, -22, 2.2], [-26, -36, 2], [8, -20, 2.6], [-4, -46, 2]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.restore();
    c.save(); c.translate(0, -31); c.beginPath(); c.moveTo(0, -11); c.lineTo(10, 0); c.lineTo(0, 11); c.lineTo(-10, 0); c.closePath(); c.fillStyle = P.trim; c.fill(); c.lineWidth = 1.8; c.strokeStyle = P.rim; c.stroke();
    c.beginPath(); c.arc(0, 0, 2.6, 0, TAU); c.fillStyle = P.hi; c.fill(); c.restore();
    shine(c, P, -14, -46, 13, 5, -0.2);
  }
  c.beginPath(); c.ellipse(0, -4, 30, 5, 0, 0, TAU); c.fillStyle = 'rgba(0,0,0,0.0)'; c.fill();
}
function shapeMet(c, P) {
  pedestal(c, P);
  c.beginPath(); c.moveTo(-27, -22); c.bezierCurveTo(-32, -38, -17, -52, -11, -62); c.lineTo(11, -62); c.bezierCurveTo(17, -52, 32, -38, 27, -22); c.closePath(); fillBody(c, P, -30, 30);
  band(c, P, -23, -34, 46, 6);
  band(c, P, -14, -68, 28, 8);
  c.beginPath(); c.arc(0, -82, 15, 0, TAU); fillBody(c, P, -15, 15);
  c.beginPath(); c.arc(0, -101, 4.4, 0, TAU); fillBody(c, P, -5, 5);
  shine(c, P, -5, -86, 7, 4);
}
function shapeKhon(c, P) {
  pedestal(c, P);
  c.beginPath(); c.moveTo(-28, -22); c.bezierCurveTo(-27, -34, -22, -44, -19, -52); c.lineTo(19, -52); c.bezierCurveTo(22, -44, 27, -34, 28, -22); c.closePath(); fillBody(c, P, -28, 28);
  c.beginPath(); c.strokeStyle = P.trim; c.lineWidth = 3.2; c.lineCap = 'round'; c.moveTo(-14, -30); c.lineTo(0, -41); c.lineTo(14, -30); c.stroke();
  c.beginPath(); c.ellipse(0, -55, 28, 8, 0, 0, TAU); fillBody(c, P, -28, 28);
  c.beginPath(); c.moveTo(-17, -58); c.bezierCurveTo(-18, -78, -6, -92, 0, -104); c.bezierCurveTo(6, -92, 18, -78, 17, -58); c.closePath(); fillBody(c, P, -18, 18);
  band(c, P, -16, -66, 32, 5);
  shine(c, P, -6, -82, 3.5, 11, 0.2);
}
function shapeKhun(c, P) {
  pedestal(c, P);
  c.beginPath(); c.moveTo(-29, -22); c.bezierCurveTo(-27, -34, -22, -44, -20, -52); c.lineTo(20, -52); c.bezierCurveTo(22, -44, 27, -34, 29, -22); c.closePath(); fillBody(c, P, -29, 29);
  band(c, P, -24, -36, 48, 6);
  c.beginPath(); c.ellipse(0, -55, 24, 7, 0, 0, TAU); fillBody(c, P, -24, 24);
  // a crown: a wide band lifted into five flame-leaf points, the middle one tallest, with a jewel
  c.fillStyle = gradX(c, -26, 26, P); c.strokeStyle = P.rim; c.lineWidth = 2.2;
  for (const [x, s, a] of [[-22, 24, -0.55], [22, 24, 0.55], [-12, 36, -0.26], [12, 36, 0.26], [0, 50, 0]]) { c.save(); c.translate(0, 0); flameLeaf(c, x, -64, s, a); c.restore(); }
  for (const [x, s, a] of [[-22, 24, -0.55], [22, 24, 0.55], [-12, 36, -0.26], [12, 36, 0.26], [0, 50, 0]]) { c.save(); c.translate(x, -64); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(s * 0.55, -s * 0.12, s * 0.5, -s * 0.62, s * 0.08, -s * 0.78); c.bezierCurveTo(s * 0.2, -s * 0.9, s * 0.02, -s * 0.97, 0, -s); c.bezierCurveTo(-s * 0.02, -s * 0.97, -s * 0.2, -s * 0.9, -s * 0.08, -s * 0.78); c.bezierCurveTo(-s * 0.5, -s * 0.62, -s * 0.55, -s * 0.12, 0, 0); c.closePath(); c.stroke(); c.restore(); }
  rr(c, -25, -72, 50, 15, 5); fillBody(c, P, -25, 25);
  c.beginPath(); c.arc(0, -64.5, 4, 0, TAU); c.fillStyle = P.trim; c.fill(); c.lineWidth = 1.4; c.strokeStyle = P.rim; c.stroke();
  c.beginPath(); c.arc(-1, -65.5, 1.3, 0, TAU); c.fillStyle = P.hi; c.fill();
  shine(c, P, -9, -90, 3, 8, 0.3);
}
function shapeMa(c, P) {
  pedestal(c, P);
  c.beginPath(); c.moveTo(-26, -22); c.bezierCurveTo(-30, -44, -26, -66, -14, -80); c.lineTo(-13, -97); c.lineTo(-3, -85);
  c.bezierCurveTo(8, -90, 22, -78, 31, -60); c.bezierCurveTo(37, -52, 38, -44, 30, -40); c.bezierCurveTo(24, -39, 18, -43, 12, -47);
  c.bezierCurveTo(15, -38, 20, -30, 24, -22); c.closePath(); fillBody(c, P, -30, 36);
  // mane
  c.strokeStyle = P.dark; c.lineWidth = 3.4; c.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const t = i / 5, x = -25 + t * 11, y = -32 - t * 46; c.beginPath(); c.moveTo(x + 4, y); c.quadraticCurveTo(x - 6, y - 4, x - 7, y + 7); c.stroke(); }
  // bridle, eye, nostril
  c.beginPath(); c.strokeStyle = P.trim; c.lineWidth = 3; c.moveTo(4, -74); c.lineTo(24, -52); c.stroke();
  c.beginPath(); c.arc(11, -69, 3.6, 0, TAU); c.fillStyle = P.rim; c.fill(); c.beginPath(); c.arc(12, -70, 1.1, 0, TAU); c.fillStyle = '#fff'; c.fill();
  c.beginPath(); c.ellipse(31, -49, 2.2, 3.2, 0.5, 0, TAU); c.fillStyle = P.rim; c.fill();
  shine(c, P, 6, -80, 8, 3.2, 0.5);
}
function shapeRua(c, P) {
  // a boat: raised prow, canopy on posts, a band along the hull
  c.beginPath(); c.moveTo(-42, -50); c.bezierCurveTo(-39, -30, -32, -14, -14, -12); c.lineTo(22, -12); c.bezierCurveTo(38, -14, 46, -36, 48, -62);
  c.bezierCurveTo(38, -50, 30, -45, 22, -43); c.lineTo(-30, -43); c.bezierCurveTo(-36, -43, -40, -46, -42, -50); c.closePath(); fillBody(c, P, -42, 48);
  c.beginPath(); c.moveTo(-32, -32); c.quadraticCurveTo(0, -26, 36, -34); c.lineWidth = 3; c.strokeStyle = P.trim; c.lineCap = 'round'; c.stroke();
  c.strokeStyle = P.rim; c.lineWidth = 5; c.beginPath(); c.moveTo(-15, -43); c.lineTo(-15, -66); c.moveTo(15, -43); c.lineTo(15, -66); c.stroke();
  c.strokeStyle = P.mid; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-15, -43); c.lineTo(-15, -66); c.moveTo(15, -43); c.lineTo(15, -66); c.stroke();
  c.beginPath(); c.moveTo(-27, -64); c.bezierCurveTo(-24, -82, 24, -82, 27, -64); c.closePath(); fillBody(c, P, -27, 27);
  c.beginPath(); c.moveTo(-3, -78); c.lineTo(0, -94); c.lineTo(3, -78); c.closePath(); fillBody(c, P, -3, 3);
  band(c, P, -26, -70, 52, 5);
  shine(c, P, -10, -79, 7, 2.5, -0.1);
}
const SHAPES = { [BIA]: (c, P) => shapeBia(c, P, false), [NGAI]: (c, P) => shapeBia(c, P, true), [MET]: shapeMet, [KHON]: shapeKhon, [MA]: shapeMa, [RUA]: shapeRua, [KHUN]: shapeKhun };
function paintPiece(c, type, side) {
  c.save(); c.translate(PW / 2, PB);
  // contact shadow
  const sh = c.createRadialGradient(4, -2, 4, 4, -2, 46); sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sh; c.beginPath(); c.ellipse(4, -2, 46, 12, 0, 0, TAU); c.fill();
  SHAPES[type](c, PALETTE[side]);
  c.restore();
}
// Draw a piece standing with its base centred at (x, y). k = pixels per sprite unit. o: { lift, alpha, scale, glow }
export function drawPiece(ctx, type, side, x, y, k, o = {}) {
  const { lift = 0, alpha = 1, scale = 1, glow = null } = o, kk = k * scale;
  if (alpha <= 0 || kk <= 0) return;
  const yy = y - lift * 10;
  ctx.save(); ctx.globalAlpha = alpha;
  if (lift > 0) { const sh = ctx.createRadialGradient(x + 4, y + 4, 4, x + 4, y + 4, 40 * kk); sh.addColorStop(0, `rgba(0,0,0,${0.35 * lift})`); sh.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(x + 4, y + 4, 40 * kk, 12 * kk, 0, 0, TAU); ctx.fill(); }
  if (glow) { ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 22; ctx.globalAlpha = alpha * 0.5; ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(x, yy - 34 * kk, 28 * kk, 40 * kk, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  const key = `pc:${type}:${side}`;
  const px = x - (PW / 2) * kk, py = yy - PB * kk;
  baked(ctx, key, px, py, PW * kk, PH * kk, (c) => paintPiece(c, type, side), 2.4, PW, PH);
  ctx.restore();
}
// Bake one piece sprite (or the board) without drawing it, so the first real frame that needs it does not pay for it.
export function warmArt(i, themeName) {
  const list = [];
  for (const side of [1, -1]) for (const t of [KHUN, MET, KHON, MA, RUA, BIA, NGAI]) list.push(['pc', t, side]);
  list.push(['board', false], ['board', true]);
  const e = list[i]; if (!e) return false;
  if (e[0] === 'pc') getImage(`pc:${e[1]}:${e[2]}`, PW, PH, (c) => paintPiece(c, e[1], e[2]), 2.4);
  else { const T = themeOf(themeName), o = { S: SQ, F: FRAME, labels: true, flip: e[1] }, { w, h } = boardBox(o); getImage(`board:${themeName}:${SQ}:${FRAME}:${e[1] ? 'f' : 'n'}:l:i`, w, h, (c) => paintBoard(c, T, o), 1.5); }
  return i + 1 < list.length;
}
export const PIECE_FEET = 0; // y of the piece's base relative to the point passed to drawPiece

// ---- text helpers ------------------------------------------------------------------------------------------------------------
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
export function fitFont(ctx, text, weight, px, maxW, minPx = 12, family = FONT) {
  let s = px;
  for (;;) { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= maxW || s <= minPx) break; s -= 1; }
  return s;
}
export function textBlock(ctx, text, cx, y, maxW, lh, align = 'center') {
  const lines = wrapLines(ctx, text, maxW);
  ctx.textAlign = align;
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
  return lines.length;
}

// ---- buttons: clean flat fills, a thin edge and a soft drop shadow; pressed buttons sink a little -----------------------------
let pressAt = null;
export const setPress = (pt) => { pressAt = pt; };
export function drawButton(ctx, r, label, T, o = {}) {
  const { primary = false, active = false, disabled = false, sub = null, px = 34, subPx = 20 } = o;
  const pressed = !disabled && (o.pressed || (!!pressAt && pressAt.x >= r.x && pressAt.x <= r.x + r.w && pressAt.y >= r.y && pressAt.y <= r.y + r.h));
  ctx.save();
  if (pressed) ctx.translate(0, 2);
  if (disabled) ctx.globalAlpha = 0.45;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = pressed ? 3 : 12; ctx.shadowOffsetY = pressed ? 1 : 5;
  rr(ctx, r.x, r.y, r.w, r.h, 20);
  ctx.fillStyle = primary ? T.accent : active ? '#2d5b52' : T.panel; ctx.fill();
  ctx.shadowColor = 'transparent';
  if (pressed) { ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fill(); }
  ctx.lineWidth = 2; ctx.strokeStyle = primary ? T.accentDark : active ? 'rgba(255,225,160,0.9)' : T.panelEdge; ctx.stroke();
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
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 7;
  rr(ctx, r.x, r.y, r.w, r.h, o.round ?? 26); ctx.fillStyle = o.fill || T.panel; ctx.globalAlpha = o.alpha ?? 0.94; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.globalAlpha = 1;
  ctx.lineWidth = 2; ctx.strokeStyle = T.panelEdge; ctx.stroke();
  ctx.restore();
}
export function drawIcon(ctx, kind, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'undo') { ctx.beginPath(); ctx.arc(0, 2, s * 0.5, Math.PI * 1.1, Math.PI * 2.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.62, -s * 0.12); ctx.lineTo(-s * 0.5, -s * 0.5); ctx.lineTo(-s * 0.12, -s * 0.28); ctx.stroke(); }
  else if (kind === 'think') { ctx.beginPath(); ctx.arc(0, -s * 0.1, s * 0.42, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.2, s * 0.5); ctx.lineTo(s * 0.2, s * 0.5); ctx.moveTo(-s * 0.14, s * 0.68); ctx.lineTo(s * 0.14, s * 0.68); ctx.stroke(); }
  else if (kind === 'danger') { ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.55, s * 0.45); ctx.lineTo(-s * 0.55, s * 0.45); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -s * 0.15); ctx.lineTo(0, s * 0.12); ctx.stroke(); ctx.beginPath(); ctx.arc(0, s * 0.28, s * 0.03, 0, TAU); ctx.fill(); }
  else if (kind === 'flag') { ctx.beginPath(); ctx.moveTo(-s * 0.35, s * 0.55); ctx.lineTo(-s * 0.35, -s * 0.55); ctx.lineTo(s * 0.5, -s * 0.25); ctx.lineTo(-s * 0.35, s * 0.05); ctx.stroke(); }
  else if (kind === 'pause') { ctx.fillRect(-s * 0.32, -s * 0.42, s * 0.2, s * 0.84); ctx.fillRect(s * 0.12, -s * 0.42, s * 0.2, s * 0.84); }
  else if (kind === 'play') { ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.45); ctx.lineTo(s * 0.45, 0); ctx.lineTo(-s * 0.3, s * 0.45); ctx.closePath(); ctx.fill(); }
  else if (kind === 'sound') { ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.18); ctx.lineTo(-s * 0.22, -s * 0.18); ctx.lineTo(s * 0.12, -s * 0.5); ctx.lineTo(s * 0.12, s * 0.5); ctx.lineTo(-s * 0.22, s * 0.18); ctx.lineTo(-s * 0.5, s * 0.18); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(s * 0.12, 0, s * 0.32, -0.9, 0.9); ctx.stroke(); }
  else if (kind === 'mute') { ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.18); ctx.lineTo(-s * 0.22, -s * 0.18); ctx.lineTo(s * 0.12, -s * 0.5); ctx.lineTo(s * 0.12, s * 0.5); ctx.lineTo(-s * 0.22, s * 0.18); ctx.lineTo(-s * 0.5, s * 0.18); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.2); ctx.lineTo(s * 0.62, s * 0.2); ctx.moveTo(s * 0.62, -s * 0.2); ctx.lineTo(s * 0.3, s * 0.2); ctx.stroke(); }
  else if (kind === 'count') { ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(0, 0); ctx.lineTo(s * 0.22, s * 0.16); ctx.stroke(); }
  ctx.restore();
}
