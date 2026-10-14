// All the reusable painting: backdrops, the uncheckered sandalwood board, the carved-token pieces, panels, buttons, text helpers.
// Pure drawing: nothing here reads or writes game state. Heavy unchanging art (backdrop, board plate, every piece) is baked once
// into an OffscreenCanvas and blitted; where OffscreenCanvas does not exist (the headless crash test) it is painted directly.
// A seeded LCG, never Math.random, so a frame is a pure function of its inputs.
//
// Art direction: Indian miniature painting. A maroon court-hall backdrop with a gold lattice (jali), parchment panels edged
// in red and gold, a sandalwood board with engraved lines and the old ashtapada cross-marks, and carved game tokens (ivory and
// vermilion lacquer) with an original silhouette each: parasol king, turbaned counsellor, elephant, horse, chariot, foot soldier.
import { PADATI, ASHVA, GAJA, RATHA, MANTRI, RAJA } from './rules.js';
import { W, H, SQ, FRAME } from './layout.js';
import { v3, sprites } from './v3.js';

export const FONT = 'Georgia, "Times New Roman", serif';
export const DISPLAY = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
export const THEME_ORDER = ['sandal', 'lapis', 'ebony'];
export const THEMES = {
  sandal: {
    name: 'Sandalwood',
    bg: ['#6a1a2a', '#40101d', '#1d0610'], glow: 'rgba(255,190,100,0.18)', motif: 'rgba(240,190,110,0.09)',
    plate: ['#e0b070', '#c98f4a', '#a8702f'], grain: 'rgba(80,38,8,0.22)', sheen: 'rgba(255,235,190,0.16)',
    line: '#4e2a0e', lineHi: 'rgba(255,236,190,0.5)', mark: 'rgba(78,42,14,0.7)', label: '#f3d9a0',
    frame: ['#7a1f26', '#541319', '#310a0e'], inlay: ['#f7de93', '#b98a35'], dark: false,
    panel: '#f3e3bd', panelIn: '#e9d3a0', panelEdge: '#8d3a1d', ink: '#2f1708', sub: '#6e4a26', hi: '#c0392b', gold: '#a87418',
    btn: '#27306a', btnEdge: '#e4b955', btnText: '#fff3d0', accent: '#f1a638', accentDark: '#b9741a', accentText: '#2d1503', title: ['#fff2c0', '#f2c45a', '#b9791f'],
  },
  lapis: {
    name: 'Lapis Court',
    bg: ['#1c2c66', '#101c47', '#070d26'], glow: 'rgba(150,190,255,0.16)', motif: 'rgba(200,215,255,0.08)',
    plate: ['#3b5fae', '#2b4a92', '#1e3573'], grain: 'rgba(0,10,50,0.28)', sheen: 'rgba(200,220,255,0.12)',
    line: '#e9cf86', lineHi: 'rgba(0,0,0,0.4)', mark: 'rgba(233,207,134,0.8)', label: '#efd9a0',
    frame: ['#35241c', '#24160f', '#150b07'], inlay: ['#f7de93', '#b98a35'], dark: true,
    panel: '#16255a', panelIn: '#1d3070', panelEdge: '#d9b862', ink: '#fbf1d6', sub: '#c9bd95', hi: '#ffcf5a', gold: '#f0cd78',
    btn: '#25356f', btnEdge: '#e4b955', btnText: '#fff3d0', accent: '#f1a638', accentDark: '#b9741a', accentText: '#2d1503', title: ['#fff2c0', '#f2c45a', '#b9791f'],
  },
  ebony: {
    name: 'Ebony and Gold',
    bg: ['#2b1b22', '#1a0f15', '#0a0508'], glow: 'rgba(255,190,110,0.12)', motif: 'rgba(240,190,110,0.07)',
    plate: ['#4a362c', '#3a2a22', '#2a1d17'], grain: 'rgba(0,0,0,0.3)', sheen: 'rgba(255,225,180,0.1)',
    line: '#d9b862', lineHi: 'rgba(0,0,0,0.5)', mark: 'rgba(217,184,98,0.85)', label: '#e8cf8c',
    frame: ['#6c4a2a', '#4a3019', '#2a1a0c'], inlay: ['#f7de93', '#b98a35'], dark: true,
    panel: '#2a1a1c', panelIn: '#35232a', panelEdge: '#d9b862', ink: '#fbf1d6', sub: '#cdb98e', hi: '#ffcf5a', gold: '#f0cd78',
    btn: '#40243a', btnEdge: '#e4b955', btnText: '#fff3d0', accent: '#f1a638', accentDark: '#b9741a', accentText: '#2d1503', title: ['#fff2c0', '#f2c45a', '#b9791f'],
  },
};
export const themeOf = (name) => THEMES[name] || THEMES.sandal;

export const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---- baking ---------------------------------------------------------------------------------------------------------------
const newCanvas = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null);
const bakeCache = new Map();
export function invalidateArt() { bakeCache.clear(); }
// Paint `paint(ctx)` (drawing in local 0..w x 0..h) once, then blit at (x, y). `scale` bakes at higher resolution.
function getImage(key, srcW, srcH, paint, scale) {
  let img = bakeCache.get(key);
  if (!img) {
    const cv = newCanvas(Math.ceil(srcW * scale), Math.ceil(srcH * scale));
    if (!cv) return null;
    const c = cv.getContext('2d'); c.scale(scale, scale); paint(c); img = cv; bakeCache.set(key, img);
    if (bakeCache.size > 90) bakeCache.delete(bakeCache.keys().next().value);
  }
  return img;
}
export function baked(ctx, key, x, y, w, h, paint, scale = 1, srcW = w, srcH = h) {
  const img = getImage(key, srcW, srcH, paint, scale);
  if (!img) { ctx.save(); ctx.translate(x, y); ctx.scale(w / srcW, h / srcH); paint(ctx); ctx.restore(); return; }
  ctx.drawImage(img, x, y, w, h);
}

// ---- motifs -------------------------------------------------------------------------------------------------------------------
// A lotus petal: a pointed vesica, base at the origin, tip at (0, -s).
export function petal(c, x, y, s, ang = 0) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(s * 0.46, -s * 0.28, s * 0.3, -s * 0.78, 0, -s); c.bezierCurveTo(-s * 0.3, -s * 0.78, -s * 0.46, -s * 0.28, 0, 0); c.closePath(); c.fill();
  c.restore();
}
// A multi-foil (cusped) arch outline, used for the title window and panel headers.
export function cuspedArch(c, x, y, w, h, cusps = 5) {
  const hw = w / 2, spring = y + h * 0.4;
  c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, spring);
  // left shoulder up to the top through small scallops
  const n = cusps * 2 + 1;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (Math.PI * i) / n, a1 = Math.PI + (Math.PI * (i + 1)) / n;
    const p1 = { x: x + hw + Math.cos(a1) * hw, y: spring + Math.sin(a1) * (spring - y) };
    const pm = { x: x + hw + Math.cos((a0 + a1) / 2) * hw * 1.07, y: spring + Math.sin((a0 + a1) / 2) * (spring - y) * 1.07 };
    c.quadraticCurveTo(pm.x, pm.y, p1.x, p1.y);
  }
  c.lineTo(x + w, y + h); c.closePath();
}

function paintBackdrop(c, T, w, h) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, T.bg[0]); g.addColorStop(0.55, T.bg[1]); g.addColorStop(1, T.bg[2]);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // a gold lattice (jali) of diamonds with a small flower at every crossing, very faint
  const st = 76;
  c.strokeStyle = T.motif; c.lineWidth = 1.4; c.fillStyle = T.motif;
  c.beginPath();
  for (let k = -h; k < w + h; k += st) { c.moveTo(k, 0); c.lineTo(k + h, h); c.moveTo(k + h, 0); c.lineTo(k, h); }
  c.stroke();
  for (let y = 0; y <= h + st; y += st) for (let x = 0; x <= w + st; x += st) {
    c.save(); c.translate(x - (y % (2 * st) ? 0 : 0), y);
    for (let a = 0; a < 4; a++) { c.rotate(Math.PI / 2); petal(c, 0, -1, 9, 0); }
    c.restore();
  }
  const rg = c.createRadialGradient(w / 2, h * 0.38, 40, w / 2, h * 0.38, h * 0.7);
  rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = rg; c.fillRect(0, 0, w, h);
  const vg = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = vg; c.fillRect(0, 0, w, h);
}
let lastBd = '';
export function drawBackdrop(ctx, themeName) {
  if (v3.on) {   // the lit 3D courtyard shows through; only a soft shade keeps the header and the bottom bar readable
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(12,4,2,0.55)'); g.addColorStop(0.16, 'rgba(12,4,2,0)'); g.addColorStop(0.8, 'rgba(12,4,2,0)'); g.addColorStop(1, 'rgba(12,4,2,0.6)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return;
  }
  const T = themeOf(themeName), key = `bd:${themeName}:${W}x${H}`;
  if (key !== lastBd) { for (const k of [...bakeCache.keys()]) if (k.startsWith('bd:') && k !== key) bakeCache.delete(k); lastBd = key; }
  baked(ctx, key, 0, 0, W, H, (c) => paintBackdrop(c, T, W, H), 0.5);
}

// ---- the board ----------------------------------------------------------------------------------------------------------------
// o: { S (square), F (frame), labels, flip, seed }
export const boardBox = (o) => ({ w: ((o.f1 ?? 7) - (o.f0 ?? 0) + 1) * o.S + o.F * 2, h: ((o.r1 ?? 7) - (o.r0 ?? 0) + 1) * o.S + o.F * 2 });
// top-left of a square (file, rank) inside a painted board window (rank r1 is at the top)
export const localSq = (o, file, rank) => ({ x: o.F + (file - (o.f0 ?? 0)) * o.S, y: o.F + ((o.r1 ?? 7) - rank) * o.S });

function paintFrame(c, T, w, h, F, seed, round) {
  const grad = c.createLinearGradient(0, 0, w * 0.5, h);
  grad.addColorStop(0, T.frame[0]); grad.addColorStop(0.5, T.frame[1]); grad.addColorStop(1, T.frame[2]);
  rr(c, 0, 0, w, h, round); c.fillStyle = grad; c.fill();
  c.save(); rr(c, 0, 0, w, h, round); c.clip();
  const rnd = lcg(seed); c.strokeStyle = 'rgba(255,210,170,0.07)'; c.lineWidth = 1.2;
  for (let i = 0; i < 60; i++) { const x = rnd() * w; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + (rnd() - 0.5) * 30, h * 0.3, x + (rnd() - 0.5) * 30, h * 0.7, x + (rnd() - 0.5) * 20, h); c.stroke(); }
  c.restore();
  // gold inlay: an outer line, an inner line and a lotus rosette in every corner
  const ig = c.createLinearGradient(0, 0, w, h); ig.addColorStop(0, T.inlay[0]); ig.addColorStop(1, T.inlay[1]);
  c.strokeStyle = ig; c.lineWidth = Math.max(1.5, F * 0.07);
  rr(c, F * 0.16, F * 0.16, w - F * 0.32, h - F * 0.32, round * 0.7); c.stroke();
  c.lineWidth = Math.max(1, F * 0.04); c.strokeStyle = 'rgba(255,225,160,0.55)';
  c.strokeRect(F * 0.86, F * 0.86, w - F * 1.72, h - F * 1.72);
  c.fillStyle = ig;
  for (const [x, y] of [[F * 0.5, F * 0.5], [w - F * 0.5, F * 0.5], [F * 0.5, h - F * 0.5], [w - F * 0.5, h - F * 0.5]]) {
    c.save(); c.translate(x, y); for (let k = 0; k < 8; k++) { c.rotate(Math.PI / 4); petal(c, 0, 0, F * 0.34, 0); }
    c.beginPath(); c.arc(0, 0, F * 0.07, 0, TAU); c.fillStyle = T.frame[2]; c.fill(); c.restore(); c.fillStyle = ig;
  }
  rr(c, 1.2, 1.2, w - 2.4, h - 2.4, round); c.lineWidth = 2.4; c.strokeStyle = 'rgba(255,225,190,0.16)'; c.stroke();
}
function paintPlate(c, T, o, w, h) {
  const { S, F } = o, f0 = o.f0 ?? 0, r0 = o.r0 ?? 0, nf = (o.f1 ?? 7) - f0 + 1, nr = (o.r1 ?? 7) - r0 + 1, ix = F, iy = F, iw = w - F * 2, ih = h - F * 2;
  const pg = c.createLinearGradient(ix, iy, ix + iw * 0.5, iy + ih); pg.addColorStop(0, T.plate[0]); pg.addColorStop(0.5, T.plate[1]); pg.addColorStop(1, T.plate[2]);
  c.fillStyle = pg; c.fillRect(ix, iy, iw, ih);
  c.save(); c.beginPath(); c.rect(ix, iy, iw, ih); c.clip();
  const rg = lcg((o.seed ?? 5) * 7 + 3);
  // the wood: every square is a slightly different cut of the same board
  for (let r = 0; r < nr; r++) for (let f = 0; f < nf; f++) {
    c.fillStyle = rg() > 0.5 ? 'rgba(255,230,180,0.07)' : 'rgba(60,25,0,0.07)';
    c.fillRect(ix + f * S, iy + r * S, S, S);
  }
  for (let i = 0; i < 110; i++) {
    const x = ix + rg() * iw, wob = (rg() - 0.5) * 22; c.strokeStyle = T.grain; c.lineWidth = 0.5 + rg() * 1.5;
    c.beginPath(); c.moveTo(x, iy); c.bezierCurveTo(x + wob, iy + ih * 0.3, x - wob, iy + ih * 0.65, x + wob * 0.4, iy + ih); c.stroke();
  }
  c.strokeStyle = T.sheen; c.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const x = ix + rg() * iw; c.lineWidth = 8 + rg() * 16; c.beginPath(); c.moveTo(x, iy + rg() * 30); c.bezierCurveTo(x + 24, iy + ih * 0.35, x - 24, iy + ih * 0.65, x + 8, iy + ih - rg() * 30); c.stroke(); }
  const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.66); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)');
  c.fillStyle = vg; c.fillRect(ix, iy, iw, ih);
  c.restore();
  // the ashtapada: engraved lines (a light edge under a dark groove), cross-marks in the corner and centre squares
  const grid = (style, wd, dx, dy) => {
    c.strokeStyle = style; c.lineWidth = wd; c.lineCap = 'butt'; c.beginPath();
    for (let i = 0; i <= nf; i++) { c.moveTo(ix + i * S + dx, iy + dy); c.lineTo(ix + i * S + dx, iy + ih + dy); }
    for (let i = 0; i <= nr; i++) { c.moveTo(ix + dx, iy + i * S + dy); c.lineTo(ix + iw + dx, iy + i * S + dy); }
    c.stroke();
  };
  grid(T.lineHi, Math.max(1.6, S * 0.03), 1.2, 1.6);
  grid(T.line, Math.max(1.8, S * 0.034), 0, 0);
  c.strokeStyle = T.line; c.lineWidth = Math.max(3, S * 0.06); c.strokeRect(ix, iy, iw, ih);
  c.strokeStyle = T.mark; c.lineWidth = Math.max(1.4, S * 0.028);
  const cross = (fa, ra) => { const f = fa - f0, r = (o.r1 ?? 7) - ra; if (f < 0 || f >= nf || r < 0 || r >= nr) return; const x = ix + f * S, y = iy + r * S, m = S * 0.22; c.beginPath(); c.moveTo(x + m, y + m); c.lineTo(x + S - m, y + S - m); c.moveTo(x + S - m, y + m); c.lineTo(x + m, y + S - m); c.stroke(); };
  for (const [f, r] of [[0, 0], [7, 0], [0, 7], [7, 7]]) cross(f, r);
  void r0;
  c.fillStyle = T.mark;
  for (const [fa, ra] of [[3, 3], [4, 3], [3, 4], [4, 4]]) {
    const f = fa - f0, r = (o.r1 ?? 7) - ra; if (f < 0 || f >= nf || r < 0 || r >= nr) continue;
    c.save(); c.translate(ix + (f + 0.5) * S, iy + (r + 0.5) * S); for (let k = 0; k < 8; k++) { c.rotate(Math.PI / 4); petal(c, 0, 0, S * 0.2, 0); } c.restore(); }
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2; c.strokeRect(ix - 1.5, iy - 1.5, iw + 3, ih + 3);
}
function paintLabels(c, T, o, w, h) {
  const { S, F, flip } = o;
  c.fillStyle = T.label; c.font = `700 ${Math.round(F * 0.44)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.92;
  for (let i = 0; i < 8; i++) {
    const letter = String.fromCharCode(97 + (flip ? 7 - i : i)), num = String(flip ? i + 1 : 8 - i);
    c.fillText(letter, F + i * S + S / 2, h - F * 0.46);
    c.fillText(num, F * 0.5, F + i * S + S / 2);
  }
  c.globalAlpha = 1; void w;
}
export function paintBoard(c, T, o) {
  const { w, h } = boardBox(o);
  paintFrame(c, T, w, h, o.F, o.seed ?? 7, Math.max(8, o.F * 0.8));
  paintPlate(c, T, o, w, h);
  if (o.labels) paintLabels(c, T, o, w, h);
}
export function drawBoard(ctx, themeName, x, y, o) {
  const T = themeOf(themeName), { w, h } = boardBox(o);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12; rr(ctx, x, y, w, h, Math.max(8, o.F * 0.8)); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  baked(ctx, `board:${themeName}:${o.S}:${o.F}:${o.flip ? 'f' : 'n'}:${o.labels ? 'l' : 'x'}:${o.f0 ?? 0}${o.f1 ?? 7}${o.r0 ?? 0}${o.r1 ?? 7}`, x, y, w, h, (c) => paintBoard(c, T, o), 1.5);
}

// ---- the pieces (original art) --------------------------------------------------------------------------------------------------------
// Each piece is a thick carved token seen from a slight angle: a lit top face, a dark rim and an inlaid figure.
export const PALETTE = {
  1: { hi: '#fffdf2', mid: '#f4e6c0', lo: '#d3ba86', edge: '#8a6a3a', edgeLo: '#5c421f', ring: '#b98a3c', fig: '#7a2a16', cut: '#f1dfb0', shine: 'rgba(255,255,255,0.8)' },
  '-1': { hi: '#ff8560', mid: '#d8381f', lo: '#8a170f', edge: '#561008', edgeLo: '#2e0603', ring: '#f2c35c', fig: '#ffe8a8', cut: '#c8321a', shine: 'rgba(255,225,200,0.6)' },
};
const PW = 100, PH = 100, CX = 50, CY = 44, RX = 40, RY = 35, THICK = 9;

function figRaja(c, P) {
  c.fillStyle = P.fig;
  // the parasol: a dome with a scalloped hem
  c.beginPath(); c.moveTo(-26, -5); c.bezierCurveTo(-26, -27, 26, -27, 26, -5);
  for (let i = 0; i < 4; i++) { const x1 = 26 - (i + 1) * 13; c.quadraticCurveTo(26 - i * 13 - 6.5, 1, x1, -5); }
  c.closePath(); c.fill();
  c.beginPath(); c.arc(0, -27, 2.6, 0, TAU); c.fill(); c.fillRect(-1.3, -26, 2.6, 8);
  c.strokeStyle = P.cut; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -23); c.lineTo(0, -6); c.moveTo(-13, -22); c.quadraticCurveTo(-14, -12, -18, -6); c.moveTo(13, -22); c.quadraticCurveTo(14, -12, 18, -6); c.stroke();
  // the king beneath: head, a three-point crown, shoulders
  c.fillStyle = P.fig;
  c.beginPath(); c.arc(0, 6, 6.6, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(-6.5, 3); c.lineTo(-6.5, -3); c.lineTo(-3, 0); c.lineTo(0, -4.5); c.lineTo(3, 0); c.lineTo(6.5, -3); c.lineTo(6.5, 3); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-23, 28); c.bezierCurveTo(-23, 15, -13, 13, 0, 13); c.bezierCurveTo(13, 13, 23, 15, 23, 28); c.closePath(); c.fill();
  c.strokeStyle = P.cut; c.lineWidth = 1.7; c.beginPath(); c.moveTo(-9, 15); c.quadraticCurveTo(0, 25, 9, 15); c.stroke();
  c.beginPath(); c.arc(0, 21, 2.2, 0, TAU); c.fillStyle = P.cut; c.fill();
}
function figMantri(c, P) {
  c.fillStyle = P.fig;
  c.beginPath(); c.moveTo(-23, 28); c.bezierCurveTo(-23, 11, -13, 7, 0, 7); c.bezierCurveTo(13, 7, 23, 11, 23, 28); c.closePath(); c.fill();
  c.beginPath(); c.arc(0, -3, 8.2, 0, TAU); c.fill();
  // the turban: layered wraps and a plume
  c.beginPath(); c.ellipse(0, -13, 14, 9, 0, 0, TAU); c.fill();
  c.strokeStyle = P.cut; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-11, -9); c.quadraticCurveTo(0, -19, 11, -14); c.moveTo(-13, -13); c.quadraticCurveTo(-2, -22, 12, -19); c.stroke();
  c.strokeStyle = P.fig; c.lineWidth = 3.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(8, -20); c.quadraticCurveTo(14, -30, 22, -24); c.stroke();
  c.beginPath(); c.arc(22, -24, 2.6, 0, TAU); c.fill();
  c.strokeStyle = P.cut; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 8); c.lineTo(-6, 17); c.moveTo(0, 8); c.lineTo(6, 17); c.stroke();
  // a rolled scroll across the chest
  c.save(); c.translate(0, 21); c.rotate(-0.25); rr(c, -9, -3.4, 18, 6.8, 3.4); c.fillStyle = P.cut; c.fill(); c.restore();
}
function figGaja(c, P) {
  c.save(); c.translate(0, 3);
  c.fillStyle = P.fig; c.strokeStyle = P.fig; c.lineCap = 'round'; c.lineJoin = 'round';
  // legs with rounded feet, behind the body
  for (const x of [12, 2, -10, -21]) { rr(c, x, 8, 8.5, 20, 3.2); c.fill(); c.beginPath(); c.ellipse(x + 4.25, 27.5, 5.6, 2.8, 0, 0, TAU); c.fill(); }
  // body, head and trunk as one silhouette
  c.beginPath(); c.moveTo(-27, 14); c.bezierCurveTo(-31, 6, -30, -4, -24, -9); c.bezierCurveTo(-16, -14, -8, -14, 0, -11);
  c.bezierCurveTo(4, -17, 9, -21, 15, -20); c.bezierCurveTo(21, -19, 24, -12, 24, -4); c.bezierCurveTo(24, 1, 25, 4, 25, 8);
  c.bezierCurveTo(31, 11, 33, 19, 28, 24); c.bezierCurveTo(26, 27, 21, 26, 21, 22); c.bezierCurveTo(22, 23.5, 25, 22, 25, 19);
  c.bezierCurveTo(25.5, 15, 22, 14, 19, 12); c.bezierCurveTo(14, 15, 4, 15, -6, 15); c.bezierCurveTo(-14, 15, -22, 16, -27, 14); c.closePath(); c.fill();
  // brow bumps
  c.beginPath(); c.arc(11, -20, 4.4, Math.PI, 0); c.arc(18.5, -17, 3.6, Math.PI * 1.1, Math.PI * 0.1); c.fill();
  // caparison cloth with a scalloped hem and a gold border
  c.beginPath(); c.moveTo(-19, -12); c.lineTo(3, -13); c.lineTo(5, 7);
  for (let i = 0; i < 5; i++) { c.quadraticCurveTo(5 - i * 4.8 - 2.4, 12, 5 - (i + 1) * 4.8, 7); }
  c.lineTo(-19, -12); c.closePath(); c.fillStyle = P.cut; c.fill();
  c.strokeStyle = P.fig; c.lineWidth = 1.6; c.stroke();
  c.beginPath(); c.moveTo(-15, -6); c.lineTo(1, -7); c.moveTo(-15, -1); c.lineTo(2, -2); c.lineWidth = 1.2; c.stroke();
  // howdah: floor, rails, canopy on posts, finial
  c.fillStyle = P.fig; c.strokeStyle = P.fig;
  rr(c, -19, -18, 25, 6.4, 2); c.fill();
  c.lineWidth = 2; c.beginPath(); c.moveTo(-17, -18); c.lineTo(-17, -24); c.moveTo(4, -18); c.lineTo(4, -24); c.stroke();
  c.beginPath(); c.moveTo(-21, -23); c.bezierCurveTo(-21, -33, 8, -33, 8, -23); c.quadraticCurveTo(-6.5, -26, -21, -23); c.closePath(); c.fill();
  c.beginPath(); c.arc(-6.5, -33.5, 2, 0, TAU); c.fill();
  // ear, tusk, eye, toenails, tail
  c.strokeStyle = P.cut; c.lineWidth = 1.7;
  c.beginPath(); c.moveTo(11, -14); c.bezierCurveTo(1, -16, 0, 0, 8, 3); c.bezierCurveTo(13, 1, 14, -8, 11, -14); c.stroke();
  c.lineWidth = 2.6; c.beginPath(); c.moveTo(20, 4); c.bezierCurveTo(24, 11, 31, 8, 32, 3); c.stroke();
  c.lineWidth = 1.2; for (const x of [12, 2, -10, -21]) { c.beginPath(); c.moveTo(x + 2, 27); c.lineTo(x + 2, 28.5); c.moveTo(x + 6.4, 27); c.lineTo(x + 6.4, 28.5); c.stroke(); }
  c.beginPath(); c.arc(19, -9, 1.9, 0, TAU); c.fillStyle = P.cut; c.fill();
  c.strokeStyle = P.fig; c.lineWidth = 2; c.beginPath(); c.moveTo(-27, 0); c.quadraticCurveTo(-33, 8, -30, 18); c.stroke();
  c.beginPath(); c.arc(-30, 19, 2.4, 0, TAU); c.fill();
  c.restore();
}
function figAshva(c, P) {
  c.fillStyle = P.fig; c.strokeStyle = P.fig; c.lineCap = 'round'; c.lineJoin = 'round';
  // neck and head in one arched silhouette facing right, two pricked ears
  c.beginPath(); c.moveTo(-22, 29); c.bezierCurveTo(-26, 12, -26, -8, -14, -21); c.bezierCurveTo(-12, -24, -10, -26, -9, -28);
  c.lineTo(-7, -34); c.lineTo(-2, -28); c.lineTo(1, -34); c.lineTo(4, -26);
  c.bezierCurveTo(12, -19, 19, -7, 26, 4); c.bezierCurveTo(30, 10, 30, 17, 25, 19); c.bezierCurveTo(20, 20, 16, 15, 12, 14);
  c.bezierCurveTo(10, 15, 6, 12, 2, 8); c.bezierCurveTo(3, 15, 8, 22, 11, 29); c.closePath(); c.fill();
  // flowing mane along the crest
  c.strokeStyle = P.cut; c.lineWidth = 2.1;
  for (let i = 0; i < 5; i++) { const y = -18 + i * 9, x = -22 + (i === 0 ? 7 : i === 1 ? 2 : 0); c.beginPath(); c.moveTo(x + 1, y); c.quadraticCurveTo(x + 9, y - 1, x + 11, y + 6); c.stroke(); }
  // forelock, cheek line, bridle straps, noseband
  c.lineWidth = 1.7; c.beginPath(); c.moveTo(4, -22); c.quadraticCurveTo(10, -16, 9, -9); c.stroke();
  c.beginPath(); c.moveTo(1, -4); c.quadraticCurveTo(7, 4, 9, 12); c.stroke();
  c.beginPath(); c.moveTo(-1, -14); c.lineTo(9, -3); c.moveTo(15, -2); c.lineTo(20, 12); c.stroke();
  c.beginPath(); c.arc(9, -8, 2.1, 0, TAU); c.fillStyle = P.cut; c.fill();      // eye
  c.beginPath(); c.arc(24.5, 12.5, 1.4, 0, TAU); c.fill();                       // nostril
  c.fillStyle = P.cut; c.beginPath(); c.arc(17, 16, 1.6, 0, TAU); c.fill();      // bit ring
}
function figRatha(c, P) {
  c.save(); c.translate(-2, 1);
  c.fillStyle = P.fig; c.strokeStyle = P.fig; c.lineCap = 'round'; c.lineJoin = 'round';
  // the horse in harness, in front
  for (const [x0, x1, y1] of [[14, 11, 25], [18, 19, 26], [26, 30, 22], [30, 35, 25]]) { c.lineWidth = 3.1; c.beginPath(); c.moveTo(x0, 7); c.quadraticCurveTo((x0 + x1) / 2 + 1, 16, x1, y1); c.stroke(); }
  c.beginPath(); c.ellipse(23, 4, 11.5, 6.8, -0.05, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(29, 1); c.bezierCurveTo(33, -6, 34, -13, 37, -16); c.lineTo(40, -14); c.bezierCurveTo(43, -11, 44, -8, 42, -6); c.bezierCurveTo(39, -6, 37, -3, 36, 1); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(36, -16); c.lineTo(36.5, -21); c.lineTo(39, -16); c.fill();
  c.lineWidth = 2.3; c.beginPath(); c.moveTo(13, 1); c.quadraticCurveTo(7, 5, 8, 16); c.stroke();      // tail
  c.strokeStyle = P.cut; c.lineWidth = 1.5; c.beginPath(); c.moveTo(30, 0); c.quadraticCurveTo(34, -9, 37, -15); c.stroke(); // mane
  c.beginPath(); c.moveTo(24, -1.5); c.lineTo(24, 9); c.stroke();                                         // harness strap
  // pole and yoke from horse to car
  c.strokeStyle = P.fig; c.lineWidth = 2.8; c.beginPath(); c.moveTo(-6, 8); c.lineTo(20, 3); c.stroke();
  // car body, canopy on posts with a pennant
  rr(c, -30, 0, 28, 9, 3); c.fill();
  c.lineWidth = 2.2; c.beginPath(); c.moveTo(-27, 0); c.lineTo(-27, -9); c.moveTo(-5, 0); c.lineTo(-5, -9); c.stroke();
  c.beginPath(); c.moveTo(-32, -8); c.bezierCurveTo(-32, -22, 1, -22, 1, -8); c.quadraticCurveTo(-15.5, -12, -32, -8); c.closePath(); c.fill();
  c.lineWidth = 1.6; c.beginPath(); c.moveTo(-15.5, -19); c.lineTo(-15.5, -29); c.stroke();
  c.beginPath(); c.moveTo(-15.5, -29); c.lineTo(-7, -26.5); c.lineTo(-15.5, -24); c.closePath(); c.fill();
  // spoked wheel
  c.beginPath(); c.arc(-16, 14, 11.5, 0, TAU); c.lineWidth = 3.8; c.stroke();
  c.lineWidth = 1.6; c.beginPath();
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; c.moveTo(-16, 14); c.lineTo(-16 + Math.cos(a) * 11, 14 + Math.sin(a) * 11); }
  c.stroke();
  c.beginPath(); c.arc(-16, 14, 3.4, 0, TAU); c.fill();
  c.strokeStyle = P.cut; c.lineWidth = 1.2; c.beginPath(); c.arc(-16, 14, 5.8, 0, TAU); c.stroke();
  c.restore();
}
function figPadati(c, P) {
  c.fillStyle = P.fig; c.strokeStyle = P.fig; c.lineCap = 'round';
  // spear
  c.lineWidth = 2.6; c.beginPath(); c.moveTo(17, -17); c.lineTo(17, 27); c.stroke();
  c.beginPath(); c.moveTo(17, -29); c.lineTo(12.5, -17); c.lineTo(21.5, -17); c.closePath(); c.fill();
  // soldier: legs, tunic, head and helmet
  rr(c, -8, 12, 6, 15, 2); c.fill(); rr(c, 1, 12, 6, 15, 2); c.fill();
  c.beginPath(); c.moveTo(-9, -4); c.lineTo(9, -4); c.lineTo(11, 14); c.lineTo(-11, 14); c.closePath(); c.fill();
  c.beginPath(); c.arc(0, -11, 7, 0, TAU); c.fill();
  c.beginPath(); c.arc(0, -13, 9, Math.PI, 0); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(0, -27); c.lineTo(-2.6, -20); c.lineTo(2.6, -20); c.closePath(); c.fill();
  // round shield
  c.beginPath(); c.arc(-12, 4, 11, 0, TAU); c.fillStyle = P.fig; c.fill();
  c.strokeStyle = P.cut; c.lineWidth = 1.8; c.beginPath(); c.arc(-12, 4, 6.6, 0, TAU); c.stroke();
  c.beginPath(); c.arc(-12, 4, 2.2, 0, TAU); c.fillStyle = P.cut; c.fill();
}
const FIGS = { [RAJA]: figRaja, [MANTRI]: figMantri, [GAJA]: figGaja, [ASHVA]: figAshva, [RATHA]: figRatha, [PADATI]: figPadati };

function paintPiece(c, type, side) {
  const P = PALETTE[side];
  // contact shadow
  const sh = c.createRadialGradient(CX + 3, CY + THICK + 6, 6, CX + 3, CY + THICK + 6, 46); sh.addColorStop(0, 'rgba(0,0,0,0.42)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sh; c.beginPath(); c.ellipse(CX + 3, CY + THICK + 6, 46, 14, 0, 0, TAU); c.fill();
  // the thick rim
  const eg = c.createLinearGradient(CX - RX, 0, CX + RX, 0); eg.addColorStop(0, P.edge); eg.addColorStop(0.5, P.lo); eg.addColorStop(1, P.edgeLo);
  c.beginPath(); c.ellipse(CX, CY + THICK, RX, RY, 0, 0, TAU); c.fillStyle = P.edgeLo; c.fill();
  c.beginPath(); c.moveTo(CX - RX, CY); c.lineTo(CX - RX, CY + THICK); c.ellipse(CX, CY + THICK, RX, RY, 0, Math.PI, 0, true); c.lineTo(CX + RX, CY); c.closePath(); c.fillStyle = eg; c.fill();
  // the lit top face
  const fg = c.createRadialGradient(CX - 12, CY - 14, 4, CX, CY, 56); fg.addColorStop(0, P.hi); fg.addColorStop(0.55, P.mid); fg.addColorStop(1, P.lo);
  c.beginPath(); c.ellipse(CX, CY, RX, RY, 0, 0, TAU); c.fillStyle = fg; c.fill();
  c.lineWidth = 2; c.strokeStyle = P.edge; c.stroke();
  c.beginPath(); c.ellipse(CX, CY, RX - 5, RY - 4.4, 0, 0, TAU); c.lineWidth = 1.7; c.strokeStyle = P.ring; c.stroke();
  // the figure, squashed a touch to sit on the angled face
  c.save(); c.translate(CX, CY + 1); c.scale(0.93, 0.85);
  // carved inlay: a pale lip below-right of the figure, then the figure itself
  c.save(); c.translate(0.9, 1.3); FIGS[type](c, { ...P, fig: side === 1 ? 'rgba(255,255,255,0.75)' : 'rgba(255,200,160,0.4)', cut: 'rgba(0,0,0,0)' }); c.restore();
  FIGS[type](c, P); c.restore();
  // a soft highlight on the upper-left of the face
  c.beginPath(); c.ellipse(CX - 14, CY - 20, 15, 5, -0.5, 0, TAU); c.fillStyle = P.shine; c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1;
}
// Draw a piece with its token centred at (x, y) (the square's centre). k = pixels per sprite unit. o: { lift, alpha, scale, glow }
export function drawPiece(ctx, type, side, x, y, k, o = {}) {
  const { lift = 0, alpha = 1, scale = 1, glow = null } = o, kk = k * scale;
  if (alpha <= 0 || kk <= 0) return;
  const yy = y - lift * 9 * kk;
  ctx.save(); ctx.globalAlpha = alpha;
  if (lift > 0) { const q = ctx.createRadialGradient(x + 5 * kk, y + 12 * kk, 3, x + 5 * kk, y + 12 * kk, 44 * kk); q.addColorStop(0, `rgba(0,0,0,${0.38 * lift})`); q.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = q; ctx.beginPath(); ctx.ellipse(x + 5 * kk, y + 12 * kk, 44 * kk, 15 * kk, 0, 0, TAU); ctx.fill(); }
  if (glow) { ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 22; ctx.globalAlpha = alpha * 0.5; ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(x, yy, 38 * kk, 34 * kk, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  const img = sprites.ready ? sprites.img[`${type}:${side}`] : null;
  if (img) {   // the sculpted 3D piece, rendered once from the same models as the board scene
    const S = 1.9 * 91 * kk;
    ctx.drawImage(img, x - S / 2, yy + 0.16 * 91 * kk - 0.88 * S, S, S);
    ctx.restore(); return;
  }
  const px = x - CX * kk, py = yy - (CY + 2) * kk;
  baked(ctx, `pc:${type}:${side}`, px, py, PW * kk, PH * kk, (c) => paintPiece(c, type, side), 2.4, PW, PH);
  ctx.restore();
}
// Bake one sprite (or the board) without drawing it, so the first frame that needs it does not pay for it.
export function warmArt(i, themeName) {
  const list = [];
  for (const side of [1, -1]) for (const t of [RAJA, MANTRI, GAJA, ASHVA, RATHA, PADATI]) list.push(['pc', t, side]);
  list.push(['board', false], ['board', true]);
  const e = list[i]; if (!e) return false;
  if (e[0] === 'pc') getImage(`pc:${e[1]}:${e[2]}`, PW, PH, (c) => paintPiece(c, e[1], e[2]), 2.4);
  else { const T = themeOf(themeName), o = { S: SQ, F: FRAME, labels: true, flip: e[1] }, { w, h } = boardBox(o); getImage(`board:${themeName}:${SQ}:${FRAME}:${e[1] ? 'f' : 'n'}:l`, w, h, (c) => paintBoard(c, T, o), 1.5); }
  return i + 1 < list.length;
}

// ---- text helpers --------------------------------------------------------------------------------------------------------------------
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

// ---- panels and buttons -----------------------------------------------------------------------------------------------------------------
let pressAt = null;
export const setPress = (pt) => { pressAt = pt; };
// ---- carved-wood / brass / lacquer chrome (same world as the 3D board) ----------------------------------------------------------------
const hex2 = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const shade = (h, f) => { const [r, g, b] = hex2(h), m = f < 0 ? 0 : 255, t = Math.abs(f); return `rgb(${Math.round(r + (m - r) * t)},${Math.round(g + (m - g) * t)},${Math.round(b + (m - b) * t)})`; };
function brassGrad(ctx, x, y, h) { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#ffe9a6'); g.addColorStop(0.35, '#e2b04a'); g.addColorStop(0.7, '#a97420'); g.addColorStop(1, '#6e4a12'); return g; }
// A button: a lacquered face with a lit top edge and a dark lower edge, a brass bezel and a soft drop shadow; a pressed button sinks.
export function drawButton(ctx, r, label, T, o = {}) {
  const { primary = false, active = false, disabled = false, sub = null, px = 32, subPx = 20 } = o;
  const pressed = !disabled && (o.pressed || (!!pressAt && pressAt.x >= r.x && pressAt.x <= r.x + r.w && pressAt.y >= r.y && pressAt.y <= r.y + r.h));
  const base = primary ? T.accent : active ? T.hi : T.btn, rad = Math.min(18, r.h * 0.3);
  ctx.save();
  if (pressed) ctx.translate(0, 2);
  if (disabled) ctx.globalAlpha = 0.45;
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = pressed ? 3 : 12; ctx.shadowOffsetY = pressed ? 1 : 5;
  rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.fillStyle = primary ? T.accentDark : shade(base, -0.5); ctx.fill();   // the dark underside
  ctx.shadowColor = 'transparent';
  const bz = Math.max(2.5, Math.min(4, r.h * 0.06));
  rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.fillStyle = brassGrad(ctx, r.x, r.y, r.h); ctx.fill();                  // the brass bezel
  const fx = r.x + bz, fy = r.y + bz, fw = r.w - bz * 2, fh = r.h - bz * 2 - (pressed ? 0 : 2);
  const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
  g.addColorStop(0, shade(base, pressed ? -0.1 : 0.22)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, pressed ? -0.3 : -0.28));
  rr(ctx, fx, fy, fw, fh, rad - bz * 0.6); ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(ctx, fx, fy, fw, fh, rad - bz * 0.6); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(fx + rad, fy + 1.6); ctx.lineTo(fx + fw - rad, fy + 1.6); ctx.stroke();   // lit top edge
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(fx + rad, fy + fh - 1.4); ctx.lineTo(fx + fw - rad, fy + fh - 1.4); ctx.stroke();                     // shaded lower edge
  ctx.restore();
  if (pressed) { rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill(); }
  ctx.fillStyle = primary ? T.accentText : T.btnText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = primary ? 'rgba(255,240,200,0.35)' : 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 1;
  const maxW = r.w - 22;
  if (sub) {
    const s1 = fitFont(ctx, label, 700, px, maxW, 13); ctx.fillText(label, r.x + r.w / 2, r.y + r.h * 0.4);
    ctx.globalAlpha = (disabled ? 0.45 : 1) * 0.85; fitFont(ctx, sub, 400, subPx, maxW, 10); ctx.fillText(sub, r.x + r.w / 2, r.y + r.h * 0.4 + s1 * 0.8);
  } else { fitFont(ctx, label, 700, px, maxW, 12); ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1); }
  ctx.restore();
}
// A panel: a carved rosewood frame with a brass line, a parchment (or dark lacquer) inset and brass rivets in the corners.
export function drawPanel(ctx, r, T, o = {}) {
  const round = o.round ?? 22, bw = Math.max(4, Math.min(7, r.h * 0.085, r.w * 0.05));
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 7;
  rr(ctx, r.x, r.y, r.w, r.h, round);
  const wg = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.4, r.y + r.h); wg.addColorStop(0, '#7a4222'); wg.addColorStop(0.5, '#4a230f'); wg.addColorStop(1, '#2d1408');
  ctx.globalAlpha = o.alpha ?? 0.98; ctx.fillStyle = wg; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.globalAlpha = 1;
  ctx.lineWidth = 1.6; ctx.strokeStyle = brassGrad(ctx, r.x, r.y, r.h); ctx.stroke();
  if (r.w > 60 && r.h > 36) {
    const ix = r.x + bw, iy = r.y + bw, iw = r.w - bw * 2, ih = r.h - bw * 2, ir = Math.max(4, round - bw * 0.8);
    rr(ctx, ix, iy, iw, ih, ir); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
    rr(ctx, ix + 1, iy + 1.5, iw - 2, ih - 2.5, ir);
    const pg = ctx.createLinearGradient(0, iy, 0, iy + ih); const base = o.fill || T.panel; pg.addColorStop(0, shade(base, T.dark ? 0.12 : 0.1)); pg.addColorStop(1, shade(base, T.dark ? -0.1 : -0.06));
    ctx.fillStyle = pg; ctx.globalAlpha = o.alpha ?? 0.97; ctx.fill(); ctx.globalAlpha = 1;
    rr(ctx, ix + 4, iy + 4, iw - 8, ih - 8, Math.max(3, ir - 4)); ctx.lineWidth = 1; ctx.strokeStyle = T.dark ? 'rgba(240,205,130,0.35)' : 'rgba(168,116,24,0.5)'; ctx.stroke();
    if (r.h > 56 && r.w > 120) for (const [x, y] of [[r.x + bw * 0.5, r.y + bw * 0.5], [r.x + r.w - bw * 0.5, r.y + bw * 0.5], [r.x + bw * 0.5, r.y + r.h - bw * 0.5], [r.x + r.w - bw * 0.5, r.y + r.h - bw * 0.5]]) {
      ctx.beginPath(); ctx.arc(x, y, Math.max(1.8, bw * 0.28), 0, TAU); ctx.fillStyle = '#f0c868'; ctx.fill();
    }
  }
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
  ctx.restore();
}
