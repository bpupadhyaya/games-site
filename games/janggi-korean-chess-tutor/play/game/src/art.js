// The table and the board. One warm light from the upper left. Korean craft feel: a dark lacquered table with a faint window-lattice
// pattern, a pine-wood board with black ink lines, and a fine five-colour (obangsaek) border band top and bottom.
// Static art is painted ONCE into cached layers. If fonts arrive late, game.js calls invalidateArt() and it repaints.
import { D, GX, GY, BOARD } from './layout.js';
import { CJK, LATIN, blob } from './pieces.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

export const BOARD_THEMES = ['hanji', 'night'];
export const BOARD_THEME_NAMES = { hanji: 'Pine and ink', night: 'Night lacquer' };
const BT = {
  hanji: { frame: ['#7a4a26', '#52301a', '#341b0c'], inlay: '#d9ae5a', face: ['#f5dfaa', '#ecd39a', '#ddbb7e'], ink: '#2d1b0e', inkSoft: 'rgba(45,27,14,0.5)', palace: 'rgba(120,70,20,0.10)', grain: 'rgba(120,76,28,0.07)', water: 'rgba(60,40,20,0.07)' },
  night: { frame: ['#1d2a26', '#10191a', '#080d0e'], inlay: '#d9b25e', face: ['#2c332e', '#222922', '#181d19'], ink: '#d9c07a', inkSoft: 'rgba(217,192,122,0.5)', palace: 'rgba(217,192,122,0.07)', grain: 'rgba(255,240,190,0.035)', water: 'rgba(255,240,190,0.04)' },
};

function newCanvas(w, h) { return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null; }
const layers = {};
export function invalidateArt() { for (const k of Object.keys(layers)) delete layers[k]; tableKey = ''; }
function layer(key, w, h, res, paint) {
  if (!(key in layers)) {
    layers[key] = null;
    try { const c = newCanvas(w * res, h * res); if (c) { const lctx = c.getContext('2d'); lctx.scale(res, res); paint(lctx); layers[key] = c; } } catch { layers[key] = null; }
  }
  return layers[key];
}

// ---- table --------------------------------------------------------------------------------------------------------
function lattice(ctx, x0, y0, w, h) {                      // a Korean window lattice (kkotsal-like): squares with diagonal crossings
  ctx.save(); ctx.strokeStyle = 'rgba(226,190,120,0.055)'; ctx.lineWidth = 1.2;
  const u = 54;
  for (let y = y0; y < y0 + h; y += u) for (let x = x0; x < x0 + w; x += u) {
    ctx.strokeRect(x + 4, y + 4, u - 8, u - 8);
    ctx.beginPath(); ctx.moveTo(x + u / 2, y + 4); ctx.lineTo(x + u - 4, y + u / 2); ctx.lineTo(x + u / 2, y + u - 4); ctx.lineTo(x + 4, y + u / 2); ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}
const OBANG = ['#2f6fb8', '#c9372d', '#e7b93c', '#efe7d2', '#161616'];
function band(ctx, y, W) {                                   // five-colour hairline band
  ctx.save();
  for (let k = 0; k < 5; k++) { ctx.fillStyle = OBANG[k]; ctx.globalAlpha = 0.62; ctx.fillRect(0, y + k * 2.2, W, 1.6); }
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#e7b93c';
  for (let x = 14; x < W; x += 44) { ctx.beginPath(); ctx.moveTo(x, y + 13); ctx.lineTo(x + 4, y + 17); ctx.lineTo(x, y + 21); ctx.lineTo(x - 4, y + 17); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function paintTable(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#16302b'); bg.addColorStop(0.4, '#10231f'); bg.addColorStop(0.75, '#0b1815'); bg.addColorStop(1, '#070f0d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  lattice(ctx, 0, 0, W, H);
  const rnd = lcg(7);
  for (let i = 0; i < 70; i++) {
    const y = rnd() * H, len = 200 + rnd() * 520, x = rnd() * W - 100;
    ctx.strokeStyle = `rgba(200,255,230,${0.01 + rnd() * 0.016})`; ctx.lineWidth = 0.6 + rnd() * 1.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + len * 0.3, y + (rnd() - 0.5) * 16, x + len * 0.7, y + (rnd() - 0.5) * 16, x + len, y + (rnd() - 0.5) * 8); ctx.stroke();
  }
  // lamp light pooling on the table
  const m = Math.max(W, H), lamp = ctx.createRadialGradient(W / 2 - 20, H * 0.49, 40, W / 2, H * 0.51, m * 0.55);
  lamp.addColorStop(0, 'rgba(255,214,150,0.20)'); lamp.addColorStop(0.55, 'rgba(255,190,110,0.06)'); lamp.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.58, W / 2, H / 2, m * 0.64); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  band(ctx, 3, W); band(ctx, H - 25, W);
}

// ---- board --------------------------------------------------------------------------------------------------------
const BY0 = BOARD.y - 34, BH = BOARD.h + 96;
function paintBoard(ctx, themeName, lang = 'ko') {
  const T = BT[themeName] ?? BT.hanji;
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
  for (let i = 0; i < 7; i++) { const g = ctx.createRadialGradient(fx + r2() * fw, fy + r2() * fh, 10, fx + r2() * fw, fy + r2() * fh, 160); g.addColorStop(0, themeName === 'night' ? 'rgba(255,230,160,0.03)' : 'rgba(140,90,30,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(fx, fy, fw, fh); }
  ctx.restore();
  // ---- the lines
  const px = (i) => GX + i * D, py = (j) => GY + j * D;
  // the two palaces get a faint tint
  ctx.fillStyle = T.palace;
  for (const j0 of [0, 7]) { ctx.fillRect(px(3), py(j0), 2 * D, 2 * D); }
  ctx.strokeStyle = T.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = 4.2; ctx.strokeRect(px(0) - 9, py(0) - 9, 8 * D + 18, 9 * D + 18);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let j = 0; j < 10; j++) { ctx.moveTo(px(0), py(j)); ctx.lineTo(px(8), py(j)); }
  for (let i = 0; i < 9; i++) { ctx.moveTo(px(i), py(0)); ctx.lineTo(px(i), py(9)); }
  for (const [a, b, c, d] of [[3, 0, 5, 2], [5, 0, 3, 2], [3, 7, 5, 9], [5, 7, 3, 9]]) { ctx.moveTo(px(a), py(b)); ctx.lineTo(px(c), py(d)); }
  ctx.stroke();
  // cannon and soldier marks
  ctx.lineWidth = 2.2; const g = 6, l = 14;
  const mark = (i, j) => { for (const sx of [-1, 1]) for (const sy of [-1, 1]) { if ((i === 0 && sx < 0) || (i === 8 && sx > 0)) continue; const cx = px(i) + sx * g, cy = py(j) + sy * g; ctx.beginPath(); ctx.moveTo(cx + sx * l, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * l); ctx.stroke(); } };
  for (const [i, j] of [[1, 2], [7, 2], [1, 7], [7, 7], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3], [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]]) mark(i, j);
  // palace centre dots
  ctx.fillStyle = T.ink; for (const j of [1, 8]) { ctx.beginPath(); ctx.arc(px(4), py(j), 3.4, 0, TAU); ctx.fill(); }
  // a faint watermark across the middle: Janggi, in the traditional characters (or Hangul in the native mode's partner)
  const cy = (py(4) + py(5)) / 2 + 2;
  ctx.save(); ctx.globalAlpha = themeName === 'night' ? 0.10 : 0.075; ctx.fillStyle = T.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (lang === 'en') { ctx.font = `700 54px ${LATIN}`; ctx.fillText('JANGGI', px(4), cy); }
  else { ctx.font = `700 64px ${CJK}`; ctx.fillText('將', px(2) + 6, cy); ctx.fillText('棋', px(6) - 6, cy); }
  ctx.restore();
  // the playing surface sits slightly below the frame: inner shadow along its edges, then a lit top-left lip
  { const fx = x + 20, fy = y + 20, fw = w - 40, fh = h - 40; ctx.save(); rr(ctx, fx, fy, fw, fh, 8); ctx.clip();
    for (let i = 0; i < 6; i++) { ctx.strokeStyle = `rgba(0,0,0,${0.10 - i * 0.015})`; ctx.lineWidth = 3; rr(ctx, fx + i * 3 + 1, fy + i * 3 + 1, fw - i * 6 - 2, fh - i * 6 - 2, 6); ctx.stroke(); }
    ctx.restore(); ctx.strokeStyle = 'rgba(255,248,225,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(fx + fw, fy + fh); ctx.lineTo(fx + fw, fy); ctx.lineTo(fx, fy); ctx.stroke(); }
  // sheen from the lamp
  const sh = ctx.createLinearGradient(x, y, x + w, y + h * 0.7); sh.addColorStop(0, 'rgba(255,240,210,0.20)'); sh.addColorStop(0.35, 'rgba(255,240,210,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.09)');
  ctx.fillStyle = sh; rr(ctx, x, y, w, h, 24); ctx.fill();
}

// The table fills the live screen (any aspect): one cached layer per size, resolution capped so a big window stays cheap.
let tableKey = '';
export function drawTable(ctx, W, H) {
  const key = `table-${Math.round(W)}x${Math.round(H)}`;
  if (key !== tableKey) { delete layers[tableKey]; tableKey = key; }
  const c = layer(key, W, H, Math.min(1.5, 2200 / Math.max(W, H)), (l) => paintTable(l, W, H));
  if (c) ctx.drawImage(c, 0, 0, W, H); else paintTable(ctx, W, H);
}
export function drawBoard(ctx, theme = 'hanji', lang = 'ko') {
  const c = layer('board-' + theme + '-' + lang, 720, BH, 2, (l) => paintBoard(l, theme, lang));
  if (c) ctx.drawImage(c, 0, BY0, 720, BH); else { ctx.save(); paintBoard(ctx, theme, lang); ctx.restore(); }
}
