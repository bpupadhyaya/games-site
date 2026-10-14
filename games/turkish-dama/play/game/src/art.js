// Static art: the table, the board, and the pieces. One light, from the upper left.
// The board and the piece sprites are painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where
// OffscreenCanvas does not exist (headless tests) the same painters draw directly.
import { host, BOARD_CELLS } from './layout.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);

// ------------------------------------------------------------------------------------------------ boards (glazed tile, three looks)
export const BOARDS = {
  iznik:   { name: 'Iznik', a: ['#38b9b4', '#23999c'], b: ['#145f68', '#0c4a53'], frame: ['#7a4a26', '#573018', '#38200f'], edge: ['#4a2a12', '#24130a'], inlay: '#e2bd69', line: 'rgba(5,40,46,0.85)', glaze: [210, 255, 250], dark: [0, 30, 36] },
  saffron: { name: 'Saffron', a: ['#f0d9a0', '#e2c27c'], b: ['#c99a4f', '#b4833a'], frame: ['#6e2f22', '#4d1e15', '#31120c'], edge: ['#42180f', '#1f0a06'], inlay: '#f0cf80', line: 'rgba(60,30,8,0.8)', glaze: [255, 244, 210], dark: [50, 24, 4] },
  lapis:   { name: 'Lapis', a: ['#4a7cd0', '#3563b5'], b: ['#2a4a96', '#1d3678'], frame: ['#3a3446', '#272233', '#15121f'], edge: ['#201b2c', '#0c0a14'], inlay: '#d8c27a', line: 'rgba(8,16,48,0.85)', glaze: [215, 232, 255], dark: [4, 10, 40] },
};
export const BOARD_KEYS = ['iznik', 'saffron', 'lapis'];

// Pre-rendered 3D piece sprites (filled in by view3d/presenter.js once WebGL works; empty = the classic painted pieces).
// Key: `${style}|${side}|${king ? 1 : 0}`. Square canvas, SPR.w cells wide; the base centre sits at (SPR.bx, SPR.by) of it.
export const sprites = { ready: false, map: {} };
export const SPR = { w: 1.7, bx: 0.5, by: 0.74 };

// A cached walnut-grain pattern for the carved HUD plaques (null where no canvas exists, e.g. headless tests).
let woodPat;
export function woodPattern(ctx) {
  if (woodPat === undefined) {
    woodPat = null; const m = mk(256, 256);
    if (m) {
      const x = m.x, r = lcg(11), g = x.createLinearGradient(0, 0, 256, 90); g.addColorStop(0, '#5a3519'); g.addColorStop(0.5, '#7a4b26'); g.addColorStop(1, '#5a3519');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 90; i++) {
        const y = r() * 256, a = 0.05 + r() * 0.15; x.strokeStyle = r() < 0.65 ? `rgba(30,14,4,${a})` : `rgba(255,214,150,${a * 0.6})`; x.lineWidth = 0.6 + r() * 1.8;
        const e = (r() - 0.5) * 8; x.beginPath(); x.moveTo(0, y + e); x.bezierCurveTo(70, y + (r() - 0.5) * 14, 180, y + (r() - 0.5) * 14, 256, y + e); x.stroke();
      }
      try { woodPat = ctx.createPattern(m.c, 'repeat'); } catch { woodPat = null; }
    }
  }
  return woodPat;
}

// ------------------------------------------------------------------------------------------------ the table
export function drawTable(ctx, L, t = 0) {
  const { w, h } = L;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0b2d36'); bg.addColorStop(0.5, '#08212b'); bg.addColorStop(1, '#04131a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // a lamp: soft warm pool of light centred on the board
  const b = L.board, cx = b ? b.x + b.S / 2 : w / 2, cy = b ? b.y + b.S / 2 : h / 2, rad = Math.max(w, h) * 0.62;
  const lamp = ctx.createRadialGradient(cx - rad * 0.12, cy - rad * 0.2, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,214,150,0.18)'); lamp.addColorStop(0.45, 'rgba(255,190,120,0.05)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  // a faint lattice of lozenges, like tile work seen in lamplight
  ctx.strokeStyle = 'rgba(120,230,225,0.035)'; ctx.lineWidth = 1.2; ctx.beginPath();
  const st = 56;
  for (let x = -h; x < w + h; x += st) { ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.moveTo(x + h, 0); ctx.lineTo(x, h); }
  ctx.stroke();
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

// A tulip silhouette (the lale), centred at (x, y), about 2s tall, pointing up before the rotation.
function tulip(ctx, x, y, s, rot, fill) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-0.62, -0.92); ctx.lineTo(-0.28, -0.34); ctx.lineTo(0, -1); ctx.lineTo(0.28, -0.34); ctx.lineTo(0.62, -0.92);
  ctx.bezierCurveTo(0.78, -0.1, 0.5, 0.62, 0, 0.78); ctx.bezierCurveTo(-0.5, 0.62, -0.78, -0.1, -0.62, -0.92);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one cell = 100 and the slab's top-left corner is (0,0).
const OUT = BOARD_CELLS, SLAB = 22;
function paintBoard(ctx, key) {
  const W = OUT * 100, H = W, pal = BOARDS[key] || BOARDS.iznik, rnd = lcg(7 + key.length * 31);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  // contact shadow on the table
  for (let k = 5; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.07 + (5 - k) * 0.012})`; rr(-4 * k + 10, 8 + SLAB - 2 + 2 * k, W + 8 * k - 12, H + 4 * k, 26 + 4 * k); ctx.fill(); }
  // front of the slab (thickness)
  const sg = ctx.createLinearGradient(0, H - 20, 0, H + SLAB);
  sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
  ctx.fillStyle = sg; rr(0, 20, W, H - 20 + SLAB, 16); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,180,0.18)'; ctx.fillRect(14, H + 1, W - 28, 2.5);
  // the top face (the frame)
  const tg = ctx.createLinearGradient(0, 0, W, H);
  tg.addColorStop(0, pal.frame[0]); tg.addColorStop(0.5, pal.frame[1]); tg.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = tg; rr(0, 0, W, H, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,190,0.35)'; ctx.lineWidth = 3; rr(2, 2, W - 4, H - 4, 14); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; rr(5, 5, W - 10, H - 10, 12); ctx.stroke();
  // frame grain
  ctx.save(); rr(0, 0, W, H, 16); ctx.clip();
  for (let k = 0; k < 70; k++) {
    const y = rnd() * H, a = 0.03 + rnd() * 0.06;
    ctx.strokeStyle = rnd() < 0.6 ? `rgba(0,0,0,${a})` : `rgba(255,220,170,${a * 0.7})`; ctx.lineWidth = 0.8 + rnd() * 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 16, W * 0.7, y + (rnd() - 0.5) * 16, W, y + (rnd() - 0.5) * 10); ctx.stroke();
  }
  ctx.restore();
  const f = 55, gx = f, gy = f, G = 800;
  // brass inlay line round the playing surface, and tulips along the frame
  ctx.strokeStyle = pal.inlay; ctx.globalAlpha = 0.85; ctx.lineWidth = 3.5; rr(gx - 22, gy - 22, G + 44, G + 44, 8); ctx.stroke(); ctx.globalAlpha = 1;
  { const mid = (f - 22) / 2 - 1;
    for (let k = 0; k < 4; k++) {
      const o = 100 + k * 200;
      tulip(ctx, gx + o, mid + 1, 10, 0, pal.inlay); tulip(ctx, gx + o, H - mid - 1, 10, Math.PI, pal.inlay);
      tulip(ctx, mid + 1, gy + o, 10, -Math.PI / 2, pal.inlay); tulip(ctx, W - mid - 1, gy + o, 10, Math.PI / 2, pal.inlay);
    } }
  // playing surface: 8 x 8 glazed tiles
  ctx.save(); rr(gx - 6, gy - 6, G + 12, G + 12, 4); ctx.clip();
  const r2 = lcg(91);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const dark = (i + j) % 2 === 1, c = dark ? pal.b : pal.a, x = gx + i * 100, y = gy + j * 100;
    const tg2 = ctx.createLinearGradient(x, y, x + 100, y + 100); tg2.addColorStop(0, c[0]); tg2.addColorStop(1, c[1]);
    ctx.fillStyle = tg2; ctx.fillRect(x, y, 100, 100);
    const t = r2(), gl = ctx.createRadialGradient(x + 28, y + 24, 2, x + 28, y + 24, 80);
    gl.addColorStop(0, `rgba(${pal.glaze[0]},${pal.glaze[1]},${pal.glaze[2]},${0.12 + t * 0.07})`); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(x, y, 100, 100);
    ctx.strokeStyle = `rgba(${pal.dark[0]},${pal.dark[1]},${pal.dark[2]},0.22)`; ctx.lineWidth = 2; ctx.strokeRect(x + 5, y + 5, 90, 90);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 7, y + 7, 86, 86);
    // a small four-petal flower in the middle of every tile, barely there
    ctx.fillStyle = `rgba(${pal.glaze[0]},${pal.glaze[1]},${pal.glaze[2]},0.07)`;
    for (let q = 0; q < 4; q++) { ctx.save(); ctx.translate(x + 50, y + 50); ctx.rotate(q * Math.PI / 2 + (dark ? 0.4 : 0)); ctx.beginPath(); ctx.ellipse(0, -15, 6, 12, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  }
  // sunk into the frame: shadow top and left, light bottom and right
  const is = ctx.createLinearGradient(0, gy - 6, 0, gy + 40); is.addColorStop(0, 'rgba(0,0,0,0.38)'); is.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = is; ctx.fillRect(gx - 6, gy - 6, G + 12, 46);
  const il = ctx.createLinearGradient(gx - 6, 0, gx + 40, 0); il.addColorStop(0, 'rgba(0,0,0,0.3)'); il.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = il; ctx.fillRect(gx - 6, gy - 6, 46, G + 12);
  const ib = ctx.createLinearGradient(0, gy + G + 6, 0, gy + G - 30); ib.addColorStop(0, 'rgba(255,240,200,0.22)'); ib.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = ib; ctx.fillRect(gx - 6, gy + G - 30, G + 12, 36);
  ctx.restore();
  ctx.strokeStyle = pal.line; ctx.lineWidth = 3.5; rr(gx - 3, gy - 3, G + 6, G + 6, 3); ctx.stroke();
  // soft light across the whole top
  const lg = ctx.createLinearGradient(0, 0, W, H);
  lg.addColorStop(0, 'rgba(255,245,215,0.14)'); lg.addColorStop(0.5, 'rgba(255,245,215,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = lg; rr(0, 0, W, H, 16); ctx.fill();
}
const boardCache = new Map();
export function drawBoard(ctx, b, key = 'iznik') {
  // b: board geometry from layout (x, y, S). Painted layer is cached per (board look, pixel size bucket).
  const k = b.S / (OUT * 100), P = px(), wpx = Math.min(2300, Math.ceil(b.S * P / 64) * 64);
  const ck = key + '|' + wpx;
  let layer = boardCache.get(ck);
  if (layer === undefined) {
    layer = null;
    const u = wpx / (OUT * 100), m = mk(wpx + 8, (OUT * 100 + SLAB + 40) * u + 8);
    if (m) { m.x.save(); m.x.translate(4, 4); m.x.scale(u, u); paintBoard(m.x, key); m.x.restore(); layer = { c: m.c, u }; }
    boardCache.set(ck, layer); if (boardCache.size > 8) boardCache.delete(boardCache.keys().next().value);
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
  if (layer) ctx.drawImage(layer.c, -4 / layer.u, -4 / layer.u, layer.c.width / layer.u, layer.c.height / layer.u);
  else paintBoard(ctx, key);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ pieces
// A round draughts piece with thickness; a king has a gold rim and a crown. Local units: one cell = 100, origin at the cell centre.
export const PIECE_STYLES = {
  classic: { name: 'Ivory and ruby', 1: { face: ['#fffaf0', '#f2e7c9', '#d8c598'], side: '#8a7646', ink: '#a67c1a', rim: 'rgba(255,255,255,0.8)' }, 2: { face: ['#ea5148', '#c02c2c', '#8c1a20'], side: '#47090d', ink: '#ffdf9a', rim: 'rgba(255,190,170,0.5)' } },
  night:   { name: 'Pearl and onyx', 1: { face: ['#f7faff', '#dbe5f4', '#b4c5de'], side: '#566883', ink: '#3b5b92', rim: 'rgba(255,255,255,0.85)' }, 2: { face: ['#666b78', '#3a3d47', '#1c1d24'], side: '#0a0a0e', ink: '#f2d27a', rim: 'rgba(200,210,240,0.35)' } },
};
export const STYLE_KEYS = ['classic', 'night'];
const DEPTH = 15, RAD = 38, GOLD = ['#fff0b0', '#e6b84a', '#a8761c'];
function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }

function crown(ctx, cx, cy, s) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-15, 9); ctx.lineTo(-17, -9); ctx.lineTo(-8, -1); ctx.lineTo(0, -13); ctx.lineTo(8, -1); ctx.lineTo(17, -9); ctx.lineTo(15, 9); ctx.closePath();
  const g = ctx.createLinearGradient(0, -14, 0, 10); g.addColorStop(0, GOLD[0]); g.addColorStop(0.5, GOLD[1]); g.addColorStop(1, GOLD[2]);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(60,30,0,0.75)'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = 'rgba(60,30,0,0.55)'; ctx.fillRect(-14, 5, 28, 3);
  for (const [x, y] of [[-17, -10], [0, -14.5], [17, -10]]) { ctx.fillStyle = GOLD[0]; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(60,30,0,0.7)'; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.restore();
}

function paintPiece(ctx, side, style, king) {
  const pal = (PIECE_STYLES[style] || PIECE_STYLES.classic)[side];
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // thickness: the disc swept down by DEPTH
  ctx.fillStyle = pal.side; ctx.strokeStyle = pal.side; ctx.lineWidth = 3;
  for (let d = DEPTH; d >= 0; d -= 1) { circ(ctx, 0, d - DEPTH / 2 + 2, RAD); ctx.fill(); ctx.stroke(); }
  const sh = ctx.createLinearGradient(0, DEPTH / 2 - 14, 0, DEPTH / 2 + 46);
  sh.addColorStop(0, 'rgba(255,255,255,0.16)'); sh.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = sh; ctx.fillRect(-60, -70, 120, 150); ctx.restore();
  // the top face
  const ty = -DEPTH / 2 + 2;
  const g = ctx.createRadialGradient(-12, ty - 14, 4, 0, ty, RAD + 6);
  g.addColorStop(0, pal.face[0]); g.addColorStop(0.55, pal.face[1]); g.addColorStop(1, pal.face[2]);
  ctx.fillStyle = g; circ(ctx, 0, ty, RAD); ctx.fill();
  ctx.strokeStyle = king ? 'rgba(80,45,0,0.75)' : 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.8; circ(ctx, 0, ty, RAD); ctx.stroke();
  const rimG = ctx.createLinearGradient(-RAD, ty - RAD, RAD, ty + RAD);
  if (king) { rimG.addColorStop(0, GOLD[0]); rimG.addColorStop(0.5, GOLD[1]); rimG.addColorStop(1, GOLD[2]); ctx.strokeStyle = rimG; ctx.lineWidth = 4.5; circ(ctx, 0, ty, RAD - 3.4); ctx.stroke(); }
  else { rimG.addColorStop(0, 'rgba(255,255,255,0.75)'); rimG.addColorStop(0.45, pal.rim); rimG.addColorStop(1, 'rgba(0,0,0,0.4)'); ctx.strokeStyle = rimG; ctx.lineWidth = 3; circ(ctx, 0, ty, RAD - 3); ctx.stroke(); }
  // engraved ring (a dark line under it and a light line over it make it look cut into the face)
  const ringR = king ? 26 : 25;
  ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 2.4; circ(ctx, 0.8, ty + 1, ringR); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.4; circ(ctx, -0.4, ty - 0.6, ringR); ctx.stroke();
  if (!king) {
    // eight small petals round a boss
    ctx.fillStyle = pal.ink; ctx.globalAlpha = 0.9;
    for (let k = 0; k < 8; k++) { ctx.save(); ctx.translate(0, ty); ctx.rotate(k * TAU / 8); ctx.beginPath(); ctx.ellipse(0, -14, 3.6, 7.5, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.globalAlpha = 1;
    const bs = ctx.createRadialGradient(-2, ty - 3, 1, 0, ty, 8); bs.addColorStop(0, '#ffffff'); bs.addColorStop(1, pal.ink);
    ctx.fillStyle = bs; circ(ctx, 0, ty, 6.4); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
  } else crown(ctx, 0, ty + 1, 1.05);
  // glint
  ctx.save(); circ(ctx, 0, ty, RAD); ctx.clip();
  const hl = ctx.createLinearGradient(-30, ty - 40, 14, ty + 6); hl.addColorStop(0, 'rgba(255,255,255,0.32)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(-40, ty - 44, 80, 70);
  const sp = ctx.createRadialGradient(-14, ty - 18, 0, -14, ty - 18, 24);
  sp.addColorStop(0, `rgba(255,255,255,${side === 2 && style === 'classic' ? 0.55 : 0.38})`); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.fillRect(-45, ty - 50, 90, 90);
  const sd = ctx.createLinearGradient(-RAD, 0, RAD, 0); sd.addColorStop(0, 'rgba(255,255,255,0.06)'); sd.addColorStop(0.6, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = sd; ctx.fillRect(-40, ty - 44, 80, 90);
  ctx.restore();
}
const spriteCache = new Map();
function sprite(side, style, king, cellPx) {
  const q = Math.max(24, Math.ceil(cellPx / 8) * 8), key = `${side}|${style}|${king ? 1 : 0}|${q}`;
  let s = spriteCache.get(key);
  if (s === undefined) {
    s = null; const u = q / 100, m = mk(120 * u, 140 * u);
    if (m) { m.x.save(); m.x.translate(60 * u, 80 * u); m.x.scale(u, u); paintPiece(m.x, side, style, king); m.x.restore(); s = m.c; }
    spriteCache.set(key, s); if (spriteCache.size > 48) spriteCache.delete(spriteCache.keys().next().value);
  }
  return s;
}
// soft shadow blob (one cached radial sprite)
let blobC;
function blob(ctx, x, y, rx, ry, a) {
  if (blobC === undefined) { blobC = null; const m = mk(128, 128); if (m) { const g = m.x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); m.x.fillStyle = g; m.x.fillRect(0, 0, 128, 128); blobC = m.c; } }
  const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a;
  if (blobC) ctx.drawImage(blobC, x - rx, y - ry, rx * 2, ry * 2);
  else { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y, rx * 0.7, ry * 0.7, 0, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = ga;
}
export { blob };

// Draws a piece standing on the cell centred (x, y). opts: { king, lift (0..1, in 0.3 cells), alpha, scale, glow, tilt, flash }
export function drawPiece(ctx, side, style, x, y, cell, opts = {}) {
  const lift = opts.lift ?? 0, k = (cell / 100) * (opts.scale ?? 1), king = !!opts.king;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) blob(ctx, x, y + cell * 0.12, cell * 0.95, cell * 0.62, opts.glow);
  blob(ctx, x + cell * 0.03, y + cell * 0.3, cell * 0.44, cell * 0.1, 0.8 * (1 - lift * 0.8));
  blob(ctx, x + cell * (0.07 + lift * 0.12), y + cell * (0.2 + lift * 0.1), cell * (0.62 + lift * 0.1), cell * (0.26 + lift * 0.04), 0.5 - lift * 0.18);
  ctx.translate(x, y - lift * cell * 0.3);
  if (opts.tilt) ctx.rotate(opts.tilt);
  const s3 = sprites.ready && sprites.map[`${style}|${side}|${king ? 1 : 0}`];
  if (s3) {
    const W = SPR.w * cell * (opts.scale ?? 1);
    ctx.drawImage(s3, -SPR.bx * W, cell * 0.12 * (opts.scale ?? 1) - SPR.by * W, W, W);
    if (opts.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${opts.flash * 0.6})`; ctx.beginPath(); ctx.ellipse(0, 0, cell * 0.36, cell * 0.3, 0, 0, TAU); ctx.fill(); }
    ctx.restore(); return;
  }
  const s = sprite(side, style, king, cell * px() * (opts.scale ?? 1));
  if (s) ctx.drawImage(s, -60 * k, -80 * k, 120 * k, 140 * k);
  else { ctx.save(); ctx.scale(k, k); paintPiece(ctx, side, style, king); ctx.restore(); }
  if (opts.flash) { ctx.fillStyle = `rgba(255,255,255,${opts.flash})`; ctx.beginPath(); ctx.arc(0, (-DEPTH / 2 + 2) * k, RAD * k, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// A little board for diagrams (Rules, How to Play): the real tile colours with real pieces.
// spec: { rows: ['..I..', ...] (I ivory man, i ivory king, R ruby man, r ruby king, . empty), marks: [[r,c,'ring'|'cross'|'dot'|'target']], hl: [[r,c,colour]], arrows: [[r0,c0,r1,c1]] }
export function drawDiagram(ctx, spec, x, y, cellPx, board = 'iznik', style = 'classic') {
  const R = spec.rows.length, C = spec.rows[0].length, pal = BOARDS[board] || BOARDS.iznik, m = cellPx * 0.18;
  const w = C * cellPx + 2 * m, h = R * cellPx + 2 * m;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 6, w, h, 8); ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, pal.frame[0]); g.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  const gx = x + m, gy = y + m;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { ctx.fillStyle = ((r + c) % 2 ? pal.b : pal.a)[0]; ctx.fillRect(gx + c * cellPx, gy + r * cellPx, cellPx, cellPx); }
  (spec.hl || []).forEach(([r, c, col]) => { ctx.fillStyle = col || 'rgba(255,236,150,0.55)'; ctx.fillRect(gx + c * cellPx, gy + r * cellPx, cellPx, cellPx); });
  ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1.2, cellPx * 0.03); ctx.strokeRect(gx, gy, C * cellPx, R * cellPx);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const ch = spec.rows[r][c], dim = spec.dim && spec.dim.some((d) => d[0] === r && d[1] === c);
    if (ch === '.' || ch === ' ') continue;
    const side = ch === 'I' || ch === 'i' ? 1 : 2, king = ch === 'i' || ch === 'r';
    drawPiece(ctx, side, style, gx + (c + 0.5) * cellPx, gy + (r + 0.5) * cellPx, cellPx, { king, alpha: dim ? 0.35 : 1 });
  }
  for (const [r, c, kind] of spec.marks || []) {
    const cx = gx + (c + 0.5) * cellPx, cy = gy + (r + 0.5) * cellPx;
    ctx.lineWidth = Math.max(2, cellPx * 0.07);
    if (kind === 'cross') { ctx.strokeStyle = '#ff5a4a'; const q = cellPx * 0.28; ctx.beginPath(); ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q); ctx.moveTo(cx + q, cy - q); ctx.lineTo(cx - q, cy + q); ctx.stroke(); }
    else if (kind === 'ring') { ctx.strokeStyle = '#7dff9a'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.3, 0, TAU); ctx.stroke(); }
    else if (kind === 'dot') { ctx.fillStyle = 'rgba(255,248,214,0.9)'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.14, 0, TAU); ctx.fill(); }
    else if (kind === 'target') { ctx.strokeStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.34, 0, TAU); ctx.stroke(); }
  }
  for (const a of spec.arrows || []) {
    const [r0, c0, r1, c1] = a, x0 = gx + (c0 + 0.5) * cellPx, y0 = gy + (r0 + 0.5) * cellPx, x1 = gx + (c1 + 0.5) * cellPx, y1 = gy + (r1 + 0.5) * cellPx, ang = Math.atan2(y1 - y0, x1 - x0), hd = cellPx * 0.22;
    ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(3, cellPx * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0 + Math.cos(ang) * cellPx * 0.3, y0 + Math.sin(ang) * cellPx * 0.3); ctx.lineTo(x1 - Math.cos(ang) * hd, y1 - Math.sin(ang) * hd); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(ang - 0.45) * hd * 1.4, y1 - Math.sin(ang - 0.45) * hd * 1.4); ctx.lineTo(x1 - Math.cos(ang + 0.45) * hd * 1.4, y1 - Math.sin(ang + 0.45) * hd * 1.4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  return { w, h };
}
export const diagramSize = (spec, cellPx) => ({ w: spec.rows[0].length * cellPx + cellPx * 0.36, h: spec.rows.length * cellPx + cellPx * 0.36 });
