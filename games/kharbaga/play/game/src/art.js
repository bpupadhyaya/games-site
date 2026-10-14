// Static art: the table, the board, and the pieces. One light, from the upper left.
// The board and the piece sprites are painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where
// OffscreenCanvas does not exist (headless tests) the same painters draw directly.
// Look: a carved clay-and-sand game slab (tiles with grooves between them, a zig-zag border in the frame) with round stone pieces;
// a Master is a double stack with a lozenge cut into the crown.
import { host, BOARD_CELLS, BOARD_N } from './layout.js';
import { v3 } from './v3.js';

// Pre-rendered 3D piece sprites (filled in by view3d/presenter.js once WebGL works; empty = the classic flat art).
export const sprites = { ready: false, piece: {}, anchor: null };

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);

// ------------------------------------------------------------------------------------------------ boards
export const BOARDS = {
  sand:  { name: 'Sand', top: ['#f1dcae', '#e6c88f', '#d4ae72'], tile: ['#efd8a2', '#dcbb7e'], groove: '#8c6a3c', grain: [110, 74, 34], frame: ['#c8794a', '#a85a32', '#7a3d1f'], edge: ['#8f4a26', '#4c2410'], line: '#5a3217', trim: '#f2cf8c' },
  dusk:  { name: 'Dusk', top: ['#cdd3d8', '#b3bcc6', '#97a2b0'], tile: ['#dde3e8', '#b6c0cb'], groove: '#4e5866', grain: [52, 62, 78], frame: ['#566a86', '#3f5069', '#2a3750'], edge: ['#2f3d56', '#151d2e'], line: '#222c3f', trim: '#e6c88a' },
  rose:  { name: 'Rose', top: ['#f0cfc0', '#e2b09e', '#cd917e'], tile: ['#f7dccf', '#dfab98'], groove: '#8a4a3c', grain: [120, 54, 40], frame: ['#a8453a', '#86312a', '#5c1d1a'], edge: ['#6a2822', '#34100e'], line: '#4a1a15', trim: '#f4d49a' },
};
export const BOARD_KEYS = ['sand', 'dusk', 'rose'];

// ------------------------------------------------------------------------------------------------ the table
export function drawTable(ctx, L) {
  const { w, h } = L;
  if (v3.on) { ctx.clearRect(0, 0, w, h); return; }            // the 3D scene is the table
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#33211a'); bg.addColorStop(0.5, '#23150f'); bg.addColorStop(1, '#0f0805');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // a lamp: soft warm pool of light centred on the board
  const b = L.board, cx = b ? b.x + b.S / 2 : w / 2, cy = b ? b.y + b.S / 2 : h / 2, rad = Math.max(w, h) * 0.62;
  const lamp = ctx.createRadialGradient(cx - rad * 0.12, cy - rad * 0.2, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,200,130,0.22)'); lamp.addColorStop(0.45, 'rgba(255,170,100,0.07)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  // woven mat: very faint diagonal strokes both ways
  ctx.strokeStyle = 'rgba(255,225,180,0.02)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = -h; x < w; x += 12) { ctx.moveTo(x, 0); ctx.lineTo(x + h, h); }
  for (let x = 0; x < w + h; x += 12) { ctx.moveTo(x, 0); ctx.lineTo(x - h, h); }
  ctx.stroke();
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one cell = 100 and the slab's top-left corner is (0,0): width 100*OUT, height 100*(OUT+0.22).
const OUT = BOARD_CELLS, NC = BOARD_N, SLAB = 22;
function diamond(ctx, x, y, r, sq = 1.25) { ctx.beginPath(); ctx.moveTo(x, y - r * sq); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * sq); ctx.lineTo(x - r, y); ctx.closePath(); }
function paintBoard(ctx, kind) {
  const W = OUT * 100, H = W, pal = BOARDS[kind] || BOARDS.sand, rnd = lcg(7 + kind.length * 31);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  // contact shadow on the table
  for (let k = 5; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.07 + (5 - k) * 0.012})`; rr(-4 * k + 10, 8 + SLAB - 2 + 2 * k, W + 8 * k - 12, H + 4 * k, 26 + 4 * k); ctx.fill(); }
  // front of the slab (thickness)
  const sg = ctx.createLinearGradient(0, H - 20, 0, H + SLAB);
  sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
  ctx.fillStyle = sg; rr(0, 20, W, H - 20 + SLAB, 18); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,180,0.18)'; ctx.fillRect(14, H + 1, W - 28, 2.5);       // lit lower edge
  // the top face (the frame)
  const tg = ctx.createLinearGradient(0, 0, W, H);
  tg.addColorStop(0, pal.frame[0]); tg.addColorStop(0.5, pal.frame[1]); tg.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = tg; rr(0, 0, W, H, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,190,0.35)'; ctx.lineWidth = 3; rr(2, 2, W - 4, H - 4, 16); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; rr(5, 5, W - 10, H - 10, 14); ctx.stroke();
  // clay speckle on the frame
  ctx.save(); rr(0, 0, W, H, 18); ctx.clip();
  for (let k = 0; k < 420; k++) {
    const x = rnd() * W, y = rnd() * H, a = 0.05 + rnd() * 0.12, dark = rnd() < 0.55, s = 0.8 + rnd() * 2.2;
    ctx.fillStyle = dark ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})` : `rgba(255,236,200,${a * 0.6})`;
    ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // playing surface (inset)
  const f = 55, gx = f, gy = f, G = NC * 100;
  // zig-zag trim in the frame, all round: a row of small triangles in the pale trim colour with a dark line under it
  ctx.save(); rr(0, 0, W, H, 18); ctx.clip();
  const mid = f / 2 - 1, tri = 16;
  ctx.fillStyle = pal.trim; ctx.globalAlpha = 0.55;
  for (let k = 0; k < NC * 3; k++) {
    const t = gx + (k + 0.5) * (G / (NC * 3));
    for (const side of ['t', 'b', 'l', 'r']) {
      ctx.beginPath();
      if (side === 't') { ctx.moveTo(t - tri * 0.55, mid + tri * 0.55); ctx.lineTo(t + tri * 0.55, mid + tri * 0.55); ctx.lineTo(t, mid - tri * 0.55); }
      else if (side === 'b') { ctx.moveTo(t - tri * 0.55, H - mid - tri * 0.55); ctx.lineTo(t + tri * 0.55, H - mid - tri * 0.55); ctx.lineTo(t, H - mid + tri * 0.55); }
      else if (side === 'l') { ctx.moveTo(mid + tri * 0.55, t - tri * 0.55); ctx.lineTo(mid + tri * 0.55, t + tri * 0.55); ctx.lineTo(mid - tri * 0.55, t); }
      else { ctx.moveTo(W - mid - tri * 0.55, t - tri * 0.55); ctx.lineTo(W - mid - tri * 0.55, t + tri * 0.55); ctx.lineTo(W - mid + tri * 0.55, t); }
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  // the sunken surface: groove colour first, then a carved tile per cell
  const pg = ctx.createLinearGradient(gx, gy, gx + G, gy + G);
  pg.addColorStop(0, pal.top[0]); pg.addColorStop(0.55, pal.top[1]); pg.addColorStop(1, pal.top[2]);
  ctx.fillStyle = pal.groove; rr(gx - 9, gy - 9, G + 18, G + 18, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(gx - 9, gy - 9, G + 18, G + 18, 6); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,200,0.4)'; ctx.lineWidth = 1.5; rr(gx - 7.5, gy - 7.5, G + 15, G + 15, 5); ctx.stroke();
  const r2 = lcg(91);
  for (let i = 0; i < NC; i++) for (let j = 0; j < NC; j++) {
    const x = gx + i * 100 + 4, y = gy + j * 100 + 4, s = 92, t = r2();
    const tgd = ctx.createLinearGradient(x, y, x + s, y + s);
    tgd.addColorStop(0, pal.tile[0]); tgd.addColorStop(1, pal.tile[1]);
    ctx.fillStyle = tgd; rr(x, y, s, s, 9); ctx.fill();
    ctx.save(); rr(x, y, s, s, 9); ctx.clip();
    ctx.fillStyle = t < 0.5 ? `rgba(255,246,220,${0.04 + t * 0.12})` : `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${0.03 + (t - 0.5) * 0.12})`; ctx.fillRect(x, y, s, s);
    for (let k = 0; k < 26; k++) {                                   // sand grains
      const a = 0.04 + r2() * 0.1;
      ctx.fillStyle = r2() < 0.5 ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})` : `rgba(255,248,230,${a * 1.2})`;
      ctx.beginPath(); ctx.arc(x + r2() * s, y + r2() * s, 0.8 + r2() * 1.6, 0, TAU); ctx.fill();
    }
    const hi = ctx.createLinearGradient(x, y, x, y + s * 0.5); hi.addColorStop(0, 'rgba(255,255,240,0.28)'); hi.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.fillStyle = hi; ctx.fillRect(x, y, s, s * 0.5);
    const lo = ctx.createLinearGradient(x, y + s, x, y + s * 0.6); lo.addColorStop(0, 'rgba(0,0,0,0.18)'); lo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lo; ctx.fillRect(x, y + s * 0.6, s, s * 0.4);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,248,225,0.45)'; ctx.lineWidth = 1.6; rr(x + 1, y + 1, s - 2, s - 2, 8); ctx.stroke();
  }
  // carved lozenges: the heart of the board and the four corners
  ctx.strokeStyle = pal.line; ctx.globalAlpha = 0.55; ctx.lineWidth = 3;
  const c0 = (NC - 1) / 2;
  diamond(ctx, gx + (c0 + 0.5) * 100, gy + (c0 + 0.5) * 100, 22); ctx.stroke();
  diamond(ctx, gx + (c0 + 0.5) * 100, gy + (c0 + 0.5) * 100, 11); ctx.stroke();
  ctx.lineWidth = 2;
  for (const [i, j] of [[0, 0], [NC - 1, 0], [0, NC - 1], [NC - 1, NC - 1]]) { diamond(ctx, gx + (i + 0.5) * 100, gy + (j + 0.5) * 100, 9); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // soft light across the whole top
  const lg = ctx.createLinearGradient(0, 0, W, H);
  lg.addColorStop(0, 'rgba(255,245,215,0.16)'); lg.addColorStop(0.5, 'rgba(255,245,215,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = lg; rr(0, 0, W, H, 18); ctx.fill();
}
const boardCache = new Map();
export function drawBoard(ctx, b, kind = 'sand') {
  if (v3.on) return;                                          // drawn by the 3D scene
  // b: board geometry from layout (x, y, S). Painted layer is cached per (board, pixel size bucket).
  const k = b.S / (OUT * 100), P = px(), wpx = Math.min(2300, Math.ceil(b.S * P / 64) * 64);
  const key = kind + '|' + wpx;
  let layer = boardCache.get(key);
  if (layer === undefined) {
    layer = null;
    const u = wpx / (OUT * 100), m = mk(wpx + 8, (OUT * 100 + SLAB + 40) * u + 8);
    if (m) { m.x.save(); m.x.translate(4, 4); m.x.scale(u, u); paintBoard(m.x, kind); m.x.restore(); layer = { c: m.c, u }; }
    boardCache.set(key, layer); if (boardCache.size > 8) boardCache.delete(boardCache.keys().next().value);
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
  if (layer) ctx.drawImage(layer.c, -4 / layer.u, -4 / layer.u, layer.c.width / layer.u, layer.c.height / layer.u);
  else paintBoard(ctx, kind);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ pieces
// A round stone piece. Local units: one cell = 100, origin at the cell centre. Piece value v: 1 Dark man, 2 Light man, 3 Dark Master, 4 Light Master.
export const PIECE_STYLES = {
  stone: { name: 'Basalt and limestone', 1: { face: ['#6a6055', '#463e36', '#2d2722'], side: '#17120e', ink: '#e9c987', rim: 'rgba(255,225,170,0.30)' }, 2: { face: ['#fdf6e4', '#eadcbc', '#d2c09a'], side: '#a2916c', ink: '#6a4624', rim: 'rgba(255,255,255,0.75)' } },
  clay:  { name: 'Terracotta and cream', 1: { face: ['#d9774a', '#b45a2e', '#8a3f1b'], side: '#4d1e0d', ink: '#ffe3b0', rim: 'rgba(255,205,170,0.4)' }, 2: { face: ['#f4f3ec', '#dedbcf', '#bfbba9'], side: '#85816e', ink: '#24466a', rim: 'rgba(255,255,255,0.8)' } },
};
export const STYLE_KEYS = ['stone', 'clay'];
const DEPTH = 17, RX = 38, RY = 31, TY = -6;

function puck(ctx, pal, cy, rx, ry, depth, master, style, seed) {
  // the side of the stack: lighter just under the rim, darker toward the base
  for (let d = depth; d >= 0; d -= 1) {
    ctx.beginPath(); ctx.ellipse(0, cy + d, rx, ry, 0, 0, TAU); ctx.fillStyle = pal.side; ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.2 * (1 - d / depth)})`; ctx.fill();
  }
  // the top face
  const g = ctx.createLinearGradient(-rx, cy - ry, rx, cy + ry);
  g.addColorStop(0, pal.face[0]); g.addColorStop(0.5, pal.face[1]); g.addColorStop(1, pal.face[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.6; ctx.stroke();
  const bg = ctx.createLinearGradient(-rx, cy - ry, rx, cy + ry); bg.addColorStop(0, 'rgba(255,255,255,0.8)'); bg.addColorStop(0.45, pal.rim); bg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.strokeStyle = bg; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, cy, rx - 2.6, ry - 2.2, 0, 0, TAU); ctx.stroke();
  // stone speckle
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, TAU); ctx.clip();
  const r = lcg(seed);
  for (let k = 0; k < 40; k++) { ctx.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.05 + r() * 0.1})` : `rgba(0,0,0,${0.05 + r() * 0.12})`; ctx.beginPath(); ctx.arc((r() - 0.5) * rx * 2, cy + (r() - 0.5) * ry * 2, 0.7 + r() * 1.5, 0, TAU); ctx.fill(); }
  const sp = ctx.createRadialGradient(-rx * 0.35, cy - ry * 0.4, 0, -rx * 0.35, cy - ry * 0.4, rx * 0.9);
  sp.addColorStop(0, `rgba(255,255,255,${style === 'clay' ? 0.5 : 0.36})`); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.fillRect(-rx, cy - ry, rx * 2, ry * 2);
  const sd = ctx.createLinearGradient(-rx, 0, rx, 0); sd.addColorStop(0, 'rgba(255,255,255,0.06)'); sd.addColorStop(0.6, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,0.24)');
  ctx.fillStyle = sd; ctx.fillRect(-rx, cy - ry, rx * 2, ry * 2);
  ctx.restore();
  // cut (engraved) marks: a ring, and a lozenge; the Master's crown has a larger lozenge
  const cut = (fn) => { ctx.save(); ctx.translate(1, 2); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; fn(); ctx.restore(); ctx.strokeStyle = pal.ink; fn(); };
  ctx.lineWidth = 2.6;
  cut(() => { ctx.beginPath(); ctx.ellipse(0, cy, rx * 0.74, ry * 0.74, 0, 0, TAU); ctx.stroke(); });
  if (master) { ctx.lineWidth = 3; cut(() => { diamond(ctx, 0, cy, rx * 0.38, 1.2); ctx.stroke(); }); ctx.fillStyle = pal.ink; diamond(ctx, 0, cy, rx * 0.14, 1.2); ctx.fill(); }
  else { ctx.lineWidth = 2.2; cut(() => { diamond(ctx, 0, cy, rx * 0.2, 1.2); ctx.stroke(); }); }
}
function paintPiece(ctx, v, style) {
  const side = v & 1 ? 1 : 2, master = v > 2, pal = (PIECE_STYLES[style] || PIECE_STYLES.stone)[side];
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (!master) puck(ctx, pal, TY + 2, RX, RY, DEPTH, false, style, v * 97);
  else {
    puck(ctx, pal, TY + 14, RX, RY, 13, false, style, v * 97);          // the lower stone
    puck(ctx, pal, TY - 8, RX * 0.84, RY * 0.84, 12, true, style, v * 31);  // the crown stone
  }
}
const spriteCache = new Map();
function sprite(v, style, cellPx) {
  const q = Math.max(24, Math.ceil(cellPx / 8) * 8), key = `${v}|${style}|${q}`;
  let s = spriteCache.get(key);
  if (s === undefined) {
    s = null; const u = q / 100, m = mk(120 * u, 140 * u);
    if (m) { m.x.save(); m.x.translate(60 * u, 80 * u); m.x.scale(u, u); paintPiece(m.x, v, style); m.x.restore(); s = m.c; }
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

// Draws a piece standing on the cell centred (x, y). opts: { lift (0..1, in half-cells), alpha, scale, glow, tilt, flash }
export function drawPiece(ctx, v, style, x, y, cell, opts = {}) {
  const lift = opts.lift ?? 0, k = (cell / 100) * (opts.scale ?? 1) * 1.04;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) blob(ctx, x, y + cell * 0.1, cell * 0.95, cell * 0.66, opts.glow);
  blob(ctx, x + cell * 0.03, y + cell * 0.3, cell * 0.46, cell * 0.12, 0.8 * (1 - lift * 0.8));            // tight contact shadow right under the base
  blob(ctx, x + cell * (0.07 + lift * 0.12), y + cell * (0.2 + lift * 0.1), cell * (0.66 + lift * 0.1), cell * (0.32 + lift * 0.04), 0.5 - lift * 0.18);
  ctx.translate(x, y - lift * cell * 0.3);
  if (opts.tilt) ctx.rotate(opts.tilt);
  const sp3 = sprites.ready && sprites.piece[`${v}|${style}`];
  if (sp3) { const S = sprites.anchor.span * cell * 0.9 * (opts.scale ?? 1) * 1.04; ctx.drawImage(sp3, -sprites.anchor.x * S, cell * 0.16 * (opts.scale ?? 1) - sprites.anchor.y * S, S, S); }
  else { const s = sprite(v, style, cell * px() * (opts.scale ?? 1));
  if (s) ctx.drawImage(s, -60 * k, -80 * k, 120 * k, 140 * k);
  else { ctx.save(); ctx.scale(k, k); paintPiece(ctx, v, style); ctx.restore(); } }
  if (opts.flash) { ctx.fillStyle = `rgba(255,255,255,${opts.flash})`; ctx.beginPath(); ctx.ellipse(0, (TY + 2) * k, RX * k, RY * k, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// A little board for diagrams (Rules, How to Play, lessons): a crop of the real board art with real pieces.
// spec: { rows: ['..B..', ...] (B Dark man, W Light man, M Dark Master, N Light Master, . empty), marks: [[r,c,'ring'|'cross'|'dot'|'target']], hl: [[r,c,color]], arrows: [[r0,c0,r1,c1]] }
export function drawDiagram(ctx, spec, x, y, cellPx, kind = 'sand', style = 'stone') {
  const R = spec.rows.length, C = spec.rows[0].length, pal = BOARDS[kind] || BOARDS.sand, m = cellPx * 0.18;
  const w = C * cellPx + 2 * m, h = R * cellPx + 2 * m;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 6, w, h, 8); ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, pal.top[0]); g.addColorStop(0.6, pal.top[1]); g.addColorStop(1, pal.top[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  const gx = x + m, gy = y + m;
  (spec.hl || []).forEach(([r, c, col]) => { ctx.fillStyle = col || 'rgba(255,236,150,0.55)'; ctx.fillRect(gx + c * cellPx, gy + r * cellPx, cellPx, cellPx); });
  ctx.strokeStyle = pal.groove; ctx.lineWidth = Math.max(1.2, cellPx * 0.03); ctx.beginPath();
  for (let i = 0; i <= R; i++) { ctx.moveTo(gx, gy + i * cellPx); ctx.lineTo(gx + C * cellPx, gy + i * cellPx); }
  for (let j = 0; j <= C; j++) { ctx.moveTo(gx + j * cellPx, gy); ctx.lineTo(gx + j * cellPx, gy + R * cellPx); }
  ctx.stroke();
  const val = { B: 1, W: 2, M: 3, N: 4 };
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const ch = spec.rows[r][c];
    if (val[ch]) drawPiece(ctx, val[ch], style, gx + (c + 0.5) * cellPx, gy + (r + 0.5) * cellPx, cellPx, { alpha: spec.dim && spec.dim.some((d) => d[0] === r && d[1] === c) ? 0.35 : 1 });
  }
  for (const [r, c, kind2] of spec.marks || []) {
    const cx = gx + (c + 0.5) * cellPx, cy = gy + (r + 0.5) * cellPx;
    ctx.lineWidth = Math.max(2, cellPx * 0.07);
    if (kind2 === 'cross') { ctx.strokeStyle = '#d6291f'; const q = cellPx * 0.28; ctx.beginPath(); ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q); ctx.moveTo(cx + q, cy - q); ctx.lineTo(cx - q, cy + q); ctx.stroke(); }
    else if (kind2 === 'ring') { ctx.strokeStyle = '#1f9e5a'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.3, 0, TAU); ctx.stroke(); }
    else if (kind2 === 'dot') { ctx.fillStyle = 'rgba(31,158,90,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.14, 0, TAU); ctx.fill(); }
    else if (kind2 === 'target') { ctx.strokeStyle = '#d6291f'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.34, 0, TAU); ctx.stroke(); }
  }
  for (const a of spec.arrows || []) {
    const [r0, c0, r1, c1] = a, x0 = gx + (c0 + 0.5) * cellPx, y0 = gy + (r0 + 0.5) * cellPx, x1 = gx + (c1 + 0.5) * cellPx, y1 = gy + (r1 + 0.5) * cellPx, ang = Math.atan2(y1 - y0, x1 - x0), hd = cellPx * 0.22;
    ctx.strokeStyle = 'rgba(214,41,31,0.92)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(3, cellPx * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0 + Math.cos(ang) * cellPx * 0.3, y0 + Math.sin(ang) * cellPx * 0.3); ctx.lineTo(x1 - Math.cos(ang) * hd, y1 - Math.sin(ang) * hd); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(ang - 0.45) * hd * 1.4, y1 - Math.sin(ang - 0.45) * hd * 1.4); ctx.lineTo(x1 - Math.cos(ang + 0.45) * hd * 1.4, y1 - Math.sin(ang + 0.45) * hd * 1.4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  return { w, h };
}
export const diagramSize = (spec, cellPx) => ({ w: spec.rows[0].length * cellPx + cellPx * 0.36, h: spec.rows.length * cellPx + cellPx * 0.36 });
