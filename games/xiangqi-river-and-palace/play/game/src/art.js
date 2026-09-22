// The table, the board and the lanterns. One warm light from the upper left, lanterns at the top corners.
// Static art is painted ONCE into cached layers. If fonts arrive late, game.js calls invalidateArt() and it repaints.
import { W, H, D, GX, GY, BOARD } from './layout.js';
import { CJK, LATIN, blob } from './pieces.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

export const BOARD_THEMES = ['paper', 'night'];
export const BOARD_THEME_NAMES = { paper: 'Paper and boxwood', night: 'Night lacquer' };
const BT = {
  paper: { frame: ['#7a4322', '#4f2810', '#341808'], inlay: '#e2b661', face: ['#f3dca6', '#ead092', '#dcb877'], ink: '#3a2212', inkSoft: 'rgba(58,34,18,0.55)', river: 'rgba(74,132,150,0.20)', riverInk: 'rgba(58,34,18,0.82)', grain: 'rgba(120,76,28,0.07)', mark: '#3a2212' },
  night: { frame: ['#2a1a14', '#170d0a', '#0b0605'], inlay: '#d9b25e', face: ['#33231c', '#241610', '#1a0f0b'], ink: '#d9b866', inkSoft: 'rgba(217,184,102,0.55)', river: 'rgba(60,110,140,0.30)', riverInk: 'rgba(240,214,140,0.85)', grain: 'rgba(255,220,160,0.035)', mark: '#d9b866' },
};

function newCanvas(w, h) { return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null; }
const layers = {};
export function invalidateArt() { for (const k of Object.keys(layers)) delete layers[k]; }
function layer(key, w, h, res, paint) {
  if (!(key in layers)) {
    layers[key] = null;
    try { const c = newCanvas(w * res, h * res); if (c) { const lctx = c.getContext('2d'); lctx.scale(res, res); paint(lctx); layers[key] = c; } } catch { layers[key] = null; }
  }
  return layers[key];
}

// ---- table --------------------------------------------------------------------------------------------------------
function paintTable(ctx) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#34160f'); bg.addColorStop(0.35, '#26100c'); bg.addColorStop(0.7, '#1a0b09'); bg.addColorStop(1, '#0f0605');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // long grain of a lacquered table
  const rnd = lcg(7);
  for (let i = 0; i < 90; i++) {
    const y = rnd() * H, len = 200 + rnd() * 520, x = rnd() * W - 100;
    ctx.strokeStyle = `rgba(255,200,150,${0.012 + rnd() * 0.02})`; ctx.lineWidth = 0.6 + rnd() * 1.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + len * 0.3, y + (rnd() - 0.5) * 16, x + len * 0.7, y + (rnd() - 0.5) * 16, x + len, y + (rnd() - 0.5) * 8); ctx.stroke();
  }
  // lamp light pooling on the table, and lantern glows in the corners
  const lamp = ctx.createRadialGradient(340, 760, 40, 360, 800, 820);
  lamp.addColorStop(0, 'rgba(255,190,120,0.20)'); lamp.addColorStop(0.55, 'rgba(255,150,80,0.06)'); lamp.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, H);
  for (const cx of [110, 610]) { const g = ctx.createRadialGradient(cx, 90, 10, cx, 110, 330); g.addColorStop(0, 'rgba(255,120,60,0.30)'); g.addColorStop(1, 'rgba(255,120,60,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 460); }
  // vignette
  const vg = ctx.createRadialGradient(360, 780, 420, 360, 780, 1000); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // a thin key-fret band top and bottom
  for (const y of [14, H - 22]) fret(ctx, y);
}
function fret(ctx, y) {
  ctx.save(); ctx.strokeStyle = 'rgba(226,182,97,0.42)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, y + 4); ctx.lineTo(W, y + 4); ctx.moveTo(0, y + 14); ctx.lineTo(W, y + 14); ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let x = 6; x < W; x += 22) { ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x, y + 4); ctx.lineTo(x + 14, y + 4); ctx.lineTo(x + 14, y + 11); ctx.lineTo(x + 6, y + 11); ctx.lineTo(x + 6, y + 8); ctx.stroke(); }
  ctx.restore();
}

// ---- board --------------------------------------------------------------------------------------------------------
const BY0 = BOARD.y - 34, BH = BOARD.h + 96;
function paintBoard(ctx, themeName, lang = 'zh') {
  const T = BT[themeName] ?? BT.paper;
  ctx.translate(0, -BY0);
  const { x, y, w, h } = BOARD;
  // shadow thrown down and right
  for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(0,0,0,0.07)'; rr(ctx, x + 6 + i, y + 14 + i * 2.6, w, h, 26 + i); ctx.fill(); }
  // frame
  const fg = ctx.createLinearGradient(x, y, x + w * 0.4, y + h); fg.addColorStop(0, T.frame[0]); fg.addColorStop(0.5, T.frame[1]); fg.addColorStop(1, T.frame[2]);
  ctx.fillStyle = fg; rr(ctx, x, y, w, h, 24); ctx.fill();
  const rnd = lcg(31);
  ctx.save(); rr(ctx, x, y, w, h, 24); ctx.clip();
  for (let i = 0; i < 40; i++) { const yy = y + rnd() * h; ctx.strokeStyle = `rgba(255,190,130,${0.03 + rnd() * 0.04})`; ctx.lineWidth = 0.8 + rnd() * 1.4; ctx.beginPath(); ctx.moveTo(x, yy); ctx.bezierCurveTo(x + w * 0.3, yy + (rnd() - 0.5) * 10, x + w * 0.7, yy + (rnd() - 0.5) * 10, x + w, yy + (rnd() - 0.5) * 6); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,220,170,0.42)'; ctx.lineWidth = 2; rr(ctx, x + 1, y + 1, w - 2, h - 2, 23); ctx.stroke();
  // gold inlay line around the face
  ctx.strokeStyle = T.inlay; ctx.lineWidth = 2.2; rr(ctx, x + 12, y + 12, w - 24, h - 24, 14); ctx.stroke();
  // corner brackets in the inlay
  ctx.lineWidth = 3.4; const cl = 26;
  for (const [cx, cy, sx, sy] of [[x + 12, y + 12, 1, 1], [x + w - 12, y + 12, -1, 1], [x + 12, y + h - 12, 1, -1], [x + w - 12, y + h - 12, -1, -1]]) { ctx.beginPath(); ctx.moveTo(cx + sx * cl, cy + sy * 5); ctx.lineTo(cx + sx * 5, cy + sy * 5); ctx.lineTo(cx + sx * 5, cy + sy * cl); ctx.stroke(); }
  // face
  const fx = x + 20, fy = y + 20, fw = w - 40, fh = h - 40;
  const face = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh); face.addColorStop(0, T.face[0]); face.addColorStop(0.5, T.face[1]); face.addColorStop(1, T.face[2]);
  ctx.fillStyle = face; rr(ctx, fx, fy, fw, fh, 8); ctx.fill();
  ctx.save(); rr(ctx, fx, fy, fw, fh, 8); ctx.clip();
  const r2 = lcg(99);
  for (let i = 0; i < 70; i++) { const yy = fy + r2() * fh, xx = fx - 20 + r2() * fw * 0.6, len = 140 + r2() * 420; ctx.strokeStyle = T.grain; ctx.lineWidth = 0.6 + r2() * 1.8; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.bezierCurveTo(xx + len * 0.3, yy + (r2() - 0.5) * 9, xx + len * 0.7, yy + (r2() - 0.5) * 9, xx + len, yy + (r2() - 0.5) * 5); ctx.stroke(); }
  // uneven aging
  for (let i = 0; i < 7; i++) { const g = ctx.createRadialGradient(fx + r2() * fw, fy + r2() * fh, 10, fx + r2() * fw, fy + r2() * fh, 160); g.addColorStop(0, themeName === 'night' ? 'rgba(255,190,120,0.03)' : 'rgba(140,90,30,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(fx, fy, fw, fh); }
  ctx.restore();
  // ---- the lines
  const px = (i) => GX + i * D, py = (j) => GY + j * D;
  ctx.strokeStyle = T.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = 4.2; ctx.strokeRect(px(0) - 9, py(0) - 9, 8 * D + 18, 9 * D + 18);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let j = 0; j < 10; j++) { ctx.moveTo(px(0), py(j)); ctx.lineTo(px(8), py(j)); }
  ctx.moveTo(px(0), py(0)); ctx.lineTo(px(0), py(9)); ctx.moveTo(px(8), py(0)); ctx.lineTo(px(8), py(9));
  for (let i = 1; i < 8; i++) { ctx.moveTo(px(i), py(0)); ctx.lineTo(px(i), py(4)); ctx.moveTo(px(i), py(5)); ctx.lineTo(px(i), py(9)); }
  for (const [a, b, c, d] of [[3, 0, 5, 2], [5, 0, 3, 2], [3, 7, 5, 9], [5, 7, 3, 9]]) { ctx.moveTo(px(a), py(b)); ctx.lineTo(px(c), py(d)); }
  ctx.stroke();
  // cannon and soldier marks
  ctx.lineWidth = 2.2; const g = 6, l = 14;
  const mark = (i, j) => { for (const sx of [-1, 1]) for (const sy of [-1, 1]) { if ((i === 0 && sx < 0) || (i === 8 && sx > 0)) continue; const cx = px(i) + sx * g, cy = py(j) + sy * g; ctx.beginPath(); ctx.moveTo(cx + sx * l, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * l); ctx.stroke(); } };
  for (const [i, j] of [[1, 2], [7, 2], [1, 7], [7, 7], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3], [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]]) mark(i, j);
  // ---- the river
  const ry0 = py(4) + 3, ry1 = py(5) - 3, rx0 = px(0) + 3, rx1 = px(8) - 3;
  const rg = ctx.createLinearGradient(0, ry0, 0, ry1); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.5, T.river); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
  ctx.strokeStyle = T.inkSoft; ctx.lineWidth = 1.4;
  const r3 = lcg(5);
  for (let k = 0; k < 7; k++) { const yy = (r3() < 0.5 ? ry0 + 9 : ry1 - 9) + (r3() - 0.5) * 5, x0 = rx0 + 10 + r3() * 500; ctx.beginPath(); ctx.moveTo(x0, yy); for (let s = 0; s <= 8; s++) ctx.lineTo(x0 + s * 11, yy + Math.sin(s * 1.3 + k) * 3.2); ctx.stroke(); }
  const cy = (py(4) + py(5)) / 2 + 2;
  if (lang === 'en') {
    ctx.font = `italic 700 32px ${LATIN}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = T.riverInk;
    ctx.fillText('CHU RIVER', x + w * 0.27, cy); ctx.fillText('HAN BORDER', x + w * 0.73, cy);
  } else {
    ctx.font = `700 46px ${CJK}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = T.riverInk;
    ctx.fillText('楚', px(1) + 6, cy); ctx.fillText('河', px(2) + 20, cy); ctx.fillText('漢', px(5) + 4 + 14, cy); ctx.fillText('界', px(6) + 18 + 14, cy);
  }
  // sheen from the lamp
  const sh = ctx.createLinearGradient(x, y, x + w, y + h * 0.7); sh.addColorStop(0, 'rgba(255,240,210,0.18)'); sh.addColorStop(0.35, 'rgba(255,240,210,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = sh; rr(ctx, x, y, w, h, 24); ctx.fill();
}

export function drawTable(ctx) {
  const c = layer('table', W, H, 1.5, paintTable);
  if (c) ctx.drawImage(c, 0, 0, W, H); else paintTable(ctx);
}
export function drawBoard(ctx, theme = 'paper', lang = 'zh') {
  const c = layer('board-' + theme + '-' + lang, W, BH, 2, (l) => paintBoard(l, theme, lang));
  if (c) ctx.drawImage(c, 0, BY0, W, BH); else { ctx.save(); paintBoard(ctx, theme, lang); ctx.restore(); }
}

// ---- lantern ------------------------------------------------------------------------------------------------------
function paintLantern(ctx) {
  const cx = 55;
  ctx.strokeStyle = '#d9b25e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, 34); ctx.stroke();
  const body = ctx.createRadialGradient(cx - 10, 84, 6, cx, 96, 58);
  body.addColorStop(0, '#ffb070'); body.addColorStop(0.35, '#f0492c'); body.addColorStop(0.8, '#b3160f'); body.addColorStop(1, '#6e0806');
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(cx, 92, 45, 52, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(70,4,2,0.38)'; ctx.lineWidth = 1.6;
  for (const k of [-0.62, -0.3, 0, 0.3, 0.62]) { ctx.beginPath(); ctx.ellipse(cx, 92, 45 * Math.abs(k) + 0.1, 52, 0, -Math.PI / 2, Math.PI / 2, k < 0); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,220,150,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(cx, 92, 45, 52, 0, 0, TAU); ctx.stroke();
  for (const [y, ry] of [[36, 6], [148, 6]]) { const g = ctx.createLinearGradient(cx - 26, 0, cx + 26, 0); g.addColorStop(0, '#8a6220'); g.addColorStop(0.4, '#f2d57a'); g.addColorStop(1, '#8a6220'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(cx - 26, y - 6, 52, 14, 4); ctx.fill(); }
  ctx.strokeStyle = '#e2b661'; ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 6, 156); ctx.lineTo(cx + i * 6.5, 196 - Math.abs(i) * 3); ctx.stroke(); }
  ctx.fillStyle = '#f2d57a'; ctx.beginPath(); ctx.arc(cx, 158, 5, 0, TAU); ctx.fill();
}
export function drawLantern(ctx, x, y, t, phase, scale = 1) {
  const c = layer('lantern', 110, 200, 2, paintLantern), ang = Math.sin(t * 1.25 + phase) * 0.055;
  blob(ctx, x, y + 96 * scale, 150 * scale, 150 * scale, '255,110,50', 0.42 + Math.sin(t * 2.1 + phase) * 0.06);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  if (c) ctx.drawImage(c, -55 * scale, 0, 110 * scale, 200 * scale); else { ctx.scale(scale, scale); ctx.translate(-55, 0); paintLantern(ctx); }
  ctx.restore();
}
