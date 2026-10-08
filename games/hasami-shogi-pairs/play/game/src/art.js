// Static art: the table, the board, and the pieces. One light, from the upper left.
// The board and the four piece sprites are painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where
// OffscreenCanvas does not exist (headless tests) the same painters draw directly.
import { host, BOARD_CELLS } from './layout.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FONT_JP = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", "Noto Serif JP", "Hiragino Sans", "Yu Gothic", "Noto Sans CJK JP", serif';

// ------------------------------------------------------------------------------------------------ woods
export const WOODS = {
  kaya:   { name: 'Kaya', top: ['#f0cf86', '#e3b862', '#d3a050'], grain: [120, 78, 30], frame: ['#c98f47', '#a8702f', '#7d4f1e'], edge: ['#9a6428', '#5d3814'], line: '#4a2d12' },
  walnut: { name: 'Walnut', top: ['#c78d56', '#b27741', '#9a6232'], grain: [70, 38, 14], frame: ['#7a4a26', '#5d3518', '#3f2210'], edge: ['#53301a', '#2c180b'], line: '#2e1a0b' },
  cherry: { name: 'Cherry', top: ['#e1a273', '#d08a5c', '#bb7449'], grain: [110, 50, 28], frame: ['#a8552f', '#843c1d', '#5b2410'], edge: ['#7b3b1f', '#3d1c0d'], line: '#3d1a0c' },
};
export const WOOD_KEYS = ['kaya', 'walnut', 'cherry'];

// ------------------------------------------------------------------------------------------------ the table
export function drawTable(ctx, L, t = 0) {
  const { w, h } = L;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#16213d'); bg.addColorStop(0.5, '#0f1830'); bg.addColorStop(1, '#080d1c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // a lamp: soft warm pool of light centred on the board
  const b = L.board, cx = b ? b.x + b.S / 2 : w / 2, cy = b ? b.y + b.S / 2 : h / 2, rad = Math.max(w, h) * 0.62;
  const lamp = ctx.createRadialGradient(cx - rad * 0.12, cy - rad * 0.2, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,214,150,0.20)'); lamp.addColorStop(0.45, 'rgba(255,190,120,0.06)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  // woven cloth: very faint diagonal strokes
  ctx.strokeStyle = 'rgba(255,255,255,0.018)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = -h; x < w; x += 10) { ctx.moveTo(x, 0); ctx.lineTo(x + h, h); }
  ctx.stroke();
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one cell = 100 and the slab's top-left corner is (0,0): width 100*OUT, height 100*(OUT+0.22).
const OUT = BOARD_CELLS, SLAB = 22;
function paintBoard(ctx, wood) {
  const W = OUT * 100, H = W, pal = WOODS[wood] || WOODS.kaya, rnd = lcg(7 + wood.length * 31);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  // contact shadow on the table
  ctx.save(); ctx.filter = 'none';
  for (let k = 5; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.07 + (5 - k) * 0.012})`; rr(-4 * k + 10, 8 + SLAB - 2 + 2 * k, W + 8 * k - 20 + 8, H + 2 * 0 + 4 * k, 26 + 4 * k); ctx.fill(); }
  ctx.restore();
  // front of the slab (thickness)
  const sg = ctx.createLinearGradient(0, H - 20, 0, H + SLAB);
  sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
  ctx.fillStyle = sg; rr(0, 20, W, H - 20 + SLAB, 16); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,180,0.18)'; ctx.fillRect(14, H + 1, W - 28, 2.5);       // lit lower edge
  // the top face
  const tg = ctx.createLinearGradient(0, 0, W, H);
  tg.addColorStop(0, pal.frame[0]); tg.addColorStop(0.5, pal.frame[1]); tg.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = tg; rr(0, 0, W, H, 16); ctx.fill();
  // frame bevel
  ctx.strokeStyle = 'rgba(255,236,190,0.35)'; ctx.lineWidth = 3; rr(2, 2, W - 4, H - 4, 14); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; rr(5, 5, W - 10, H - 10, 12); ctx.stroke();
  // frame grain
  ctx.save(); rr(0, 0, W, H, 16); ctx.clip();
  for (let k = 0; k < 90; k++) {
    const y = rnd() * H, a = 0.03 + rnd() * 0.07, dark = rnd() < 0.6;
    ctx.strokeStyle = dark ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})` : `rgba(255,236,200,${a * 0.7})`; ctx.lineWidth = 0.8 + rnd() * 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 16, W * 0.7, y + (rnd() - 0.5) * 16, W, y + (rnd() - 0.5) * 10); ctx.stroke();
  }
  ctx.restore();
  // playing surface (inset): lighter wood
  const f = 55, gx = f, gy = f, G = 900;
  const pg = ctx.createLinearGradient(gx, gy, gx + G, gy + G);
  pg.addColorStop(0, pal.top[0]); pg.addColorStop(0.55, pal.top[1]); pg.addColorStop(1, pal.top[2]);
  ctx.fillStyle = pg; rr(gx - 10, gy - 10, G + 20, G + 20, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2.5; rr(gx - 10, gy - 10, G + 20, G + 20, 6); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,200,0.4)'; ctx.lineWidth = 1.5; rr(gx - 8.5, gy - 8.5, G + 17, G + 17, 5); ctx.stroke();
  // surface grain: long soft streaks with a few ring figures
  ctx.save(); rr(gx - 10, gy - 10, G + 20, G + 20, 6); ctx.clip();
  for (let k = 0; k < 160; k++) {
    const y = gy - 10 + rnd() * (G + 20), a = 0.025 + rnd() * 0.08, dark = rnd() < 0.7, wob = 6 + rnd() * 14;
    ctx.strokeStyle = dark ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})` : `rgba(255,240,205,${a * 0.9})`; ctx.lineWidth = 0.7 + rnd() * 2.2;
    ctx.beginPath(); ctx.moveTo(gx - 10, y); ctx.bezierCurveTo(gx + G * 0.3, y + (rnd() - 0.5) * wob, gx + G * 0.65, y + (rnd() - 0.5) * wob, gx + G + 10, y + (rnd() - 0.5) * wob * 0.6); ctx.stroke();
  }
  for (let k = 0; k < 3; k++) {                                              // a few ring figures like a cut log
    const cx = gx + rnd() * G, cy = gy + rnd() * G;
    for (let j = 1; j < 7; j++) { ctx.strokeStyle = `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${0.05 - j * 0.004})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(cx, cy, j * 22, j * 8, 0, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
  // cell-to-cell variation in the wood, and the playing surface sunk into the frame (shadow on the top and left, light on the bottom and right)
  { const r2 = lcg(91); ctx.save(); rr(gx - 10, gy - 10, G + 20, G + 20, 6); ctx.clip();
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const t = r2(); ctx.fillStyle = t < 0.5 ? `rgba(255,236,190,${0.03 + t * 0.08})` : `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${0.02 + (t - 0.5) * 0.09})`; ctx.fillRect(gx + i * 100, gy + j * 100, 100, 100); }
    const is = ctx.createLinearGradient(0, gy - 10, 0, gy + 40); is.addColorStop(0, 'rgba(0,0,0,0.32)'); is.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = is; ctx.fillRect(gx - 10, gy - 10, G + 20, 50);
    const il = ctx.createLinearGradient(gx - 10, 0, gx + 40, 0); il.addColorStop(0, 'rgba(0,0,0,0.26)'); il.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = il; ctx.fillRect(gx - 10, gy - 10, 50, G + 20);
    const ib = ctx.createLinearGradient(0, gy + G + 10, 0, gy + G - 30); ib.addColorStop(0, 'rgba(255,240,200,0.28)'); ib.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = ib; ctx.fillRect(gx - 10, gy + G - 30, G + 20, 40);
    ctx.restore(); }
  // cell lines
  ctx.strokeStyle = pal.line; ctx.lineCap = 'round';
  ctx.lineWidth = 3.2; ctx.beginPath();
  for (let i = 0; i <= 9; i++) { ctx.moveTo(gx, gy + i * 100); ctx.lineTo(gx + G, gy + i * 100); ctx.moveTo(gx + i * 100, gy); ctx.lineTo(gx + i * 100, gy + G); }
  ctx.stroke();
  ctx.lineWidth = 5.5; ctx.strokeRect(gx, gy, G, G);
  ctx.fillStyle = pal.line;
  for (const [i, j] of [[3, 3], [3, 6], [6, 3], [6, 6]]) { ctx.beginPath(); ctx.arc(gx + i * 100, gy + j * 100, 7, 0, TAU); ctx.fill(); }
  // coordinates in the frame (files 9..1 along the top, ranks a..i down the right), the shogi way
  ctx.fillStyle = 'rgba(255,236,196,0.55)'; ctx.font = '600 24px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 9; i++) { ctx.fillText(String(9 - i), gx + i * 100 + 50, 27); ctx.fillText('abcdefghi'[i], W - 27, gy + i * 100 + 50); }
  ctx.textBaseline = 'alphabetic';
  // soft light across the whole top
  const lg = ctx.createLinearGradient(0, 0, W, H);
  lg.addColorStop(0, 'rgba(255,245,215,0.16)'); lg.addColorStop(0.5, 'rgba(255,245,215,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = lg; rr(0, 0, W, H, 16); ctx.fill();
}
const boardCache = new Map();
export function drawBoard(ctx, b, wood = 'kaya') {
  // b: board geometry from layout (x, y, S). Painted layer is cached per (wood, pixel size bucket).
  const k = b.S / (OUT * 100), P = px(), wpx = Math.min(2300, Math.ceil(b.S * P / 64) * 64);
  const key = wood + '|' + wpx;
  let layer = boardCache.get(key);
  if (layer === undefined) {
    layer = null;
    const u = wpx / (OUT * 100), m = mk(wpx + 8, (OUT * 100 + SLAB + 40) * u + 8);
    if (m) { m.x.save(); m.x.translate(4, 4); m.x.scale(u, u); paintBoard(m.x, wood); m.x.restore(); layer = { c: m.c, u }; }
    boardCache.set(key, layer); if (boardCache.size > 8) boardCache.delete(boardCache.keys().next().value);
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
  if (layer) ctx.drawImage(layer.c, -4 / layer.u, -4 / layer.u, layer.c.width / layer.u, layer.c.height / layer.u);
  else paintBoard(ctx, wood);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ pieces
// A shogi-style piece (koma): a five-sided wedge, tip toward the opponent, with thickness. Local units: one cell = 100, origin at the cell centre.
// Faces: English letters (B for Black, W for White) by default; the traditional shogi pawn characters are an option in Settings.
export const PIECE_STYLES = {
  classic: { name: 'Ebony and boxwood', 1: { face: ['#4b3a2c', '#33261b', '#241a12'], side: '#150e08', ink: '#f1cf78', rim: 'rgba(255,225,170,0.30)' }, 2: { face: ['#fbeec9', '#efd9a2', '#dcc084'], side: '#a98a50', ink: '#3a1f12', rim: 'rgba(255,255,255,0.7)' } },
  lacquer: { name: 'Lacquer', 1: { face: ['#c7392e', '#a02a22', '#7d1d18'], side: '#4d0f0c', ink: '#ffe3a0', rim: 'rgba(255,200,170,0.35)' }, 2: { face: ['#f4f4f2', '#dfe0e0', '#c7c9cb'], side: '#8b8e92', ink: '#1c2c52', rim: 'rgba(255,255,255,0.8)' } },
};
export const STYLE_KEYS = ['classic', 'lacquer'];
let FACES = 'en';                                                   // piece faces: 'en' = the letters B and W, 'jp' = the traditional shogi characters
export const setFaces = (f) => { FACES = f === 'jp' ? 'jp' : 'en'; };
const DEPTH = 15;
const SHAPE = [[0, -47], [24, -31], [34, 40], [-34, 40], [-24, -31]];            // pointing up; mirrored vertically for 'down'
function shape(dir, inset = 0) {
  const pts = SHAPE.map(([x, y]) => [x, dir === 'down' ? -y : y]);
  if (!inset) return pts;
  return pts.map(([x, y]) => [x * (1 - inset / 34), y * (1 - inset / 47)]);
}
function pathOf(ctx, pts, dx = 0, dy = 0) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy))); ctx.closePath(); }

function paintPiece(ctx, side, style, dir) {
  const pal = (PIECE_STYLES[style] || PIECE_STYLES.classic)[side];
  const pts = shape(dir);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // thickness: the footprint swept down by DEPTH
  ctx.fillStyle = pal.side; ctx.strokeStyle = pal.side; ctx.lineWidth = 5;
  for (let d = DEPTH; d >= 0; d -= 1) { pathOf(ctx, pts, 0, d - DEPTH / 2 + 2); ctx.fill(); ctx.stroke(); }
  const sh = ctx.createLinearGradient(0, DEPTH / 2 - 14, 0, DEPTH / 2 + 46);          // the side catches less light toward the bottom
  sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = sh; ctx.fillRect(-60, -70, 120, 150); ctx.restore();
  // the top face
  const ty = -DEPTH / 2 + 2;
  const g = ctx.createLinearGradient(-34, ty - 47, 34, ty + 40);
  g.addColorStop(0, pal.face[0]); g.addColorStop(0.5, pal.face[1]); g.addColorStop(1, pal.face[2]);
  ctx.fillStyle = g; pathOf(ctx, pts, 0, ty); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.6; pathOf(ctx, pts, 0, ty); ctx.stroke();
  { const bg = ctx.createLinearGradient(-34, ty - 47, 34, ty + 40); bg.addColorStop(0, 'rgba(255,255,255,0.75)'); bg.addColorStop(0.45, pal.rim); bg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.strokeStyle = bg; ctx.lineWidth = 3.2; pathOf(ctx, shape(dir, 3.5), 0, ty); ctx.stroke(); }      // bevel: lit on the upper left, dark on the lower right
  // a wood-grain hint on the face
  ctx.save(); pathOf(ctx, pts, 0, ty); ctx.clip();
  const r = lcg(side * 97 + (dir === 'up' ? 1 : 2));
  for (let k = 0; k < 9; k++) { const y = ty - 46 + r() * 90; ctx.strokeStyle = side === 1 ? `rgba(255,220,160,${0.03 + r() * 0.05})` : `rgba(110,70,20,${0.04 + r() * 0.07})`; ctx.lineWidth = 0.8 + r(); ctx.beginPath(); ctx.moveTo(-36, y); ctx.bezierCurveTo(-10, y + (r() - 0.5) * 5, 12, y + (r() - 0.5) * 5, 36, y + (r() - 0.5) * 4); ctx.stroke(); }
  const hl = ctx.createLinearGradient(-30, ty - 46, 20, ty + 10); hl.addColorStop(0, 'rgba(255,255,255,0.32)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(-40, ty - 50, 80, 70);
  const sp = ctx.createRadialGradient(-12, ty - 24, 0, -12, ty - 24, 30);                     // specular glint (glossier on the lacquer set)
  sp.addColorStop(0, `rgba(255,255,255,${style === 'lacquer' ? 0.6 : 0.34})`); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.fillRect(-45, ty - 55, 90, 90);
  const sd = ctx.createLinearGradient(-34, 0, 34, 0); sd.addColorStop(0, 'rgba(255,255,255,0.08)'); sd.addColorStop(0.6, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = sd; ctx.fillRect(-40, ty - 50, 80, 100);
  ctx.restore();
  // the character, cut into the face (a dark line under it and a light line over it make it look engraved)
  ctx.save(); ctx.translate(0, ty + 4); if (dir === 'down' && FACES === 'jp') ctx.rotate(Math.PI);   // English letters always stay upright
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const en = FACES === 'en', ch = en ? (side === 1 ? 'B' : 'W') : side === 1 ? '歩' : 'と', fs = en ? 66 : side === 1 ? 50 : 56;
  ctx.font = en ? `700 ${fs}px "Cormorant Garamond", Georgia, "Times New Roman", serif` : `700 ${fs}px ${FONT_JP}`;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(ch, 1, 2.4);
  ctx.fillStyle = pal.ink; ctx.fillText(ch, 0, 0);
  ctx.restore();
}
const spriteCache = new Map();
function sprite(side, style, dir, cellPx) {
  const q = Math.max(24, Math.ceil(cellPx / 8) * 8), key = `${side}|${style}|${dir}|${q}|${FACES}`;
  let s = spriteCache.get(key);
  if (s === undefined) {
    s = null; const u = q / 100, m = mk(120 * u, 140 * u);
    if (m) { m.x.save(); m.x.translate(60 * u, 80 * u); m.x.scale(u, u); paintPiece(m.x, side, style, dir); m.x.restore(); s = m.c; }
    spriteCache.set(key, s); if (spriteCache.size > 40) spriteCache.delete(spriteCache.keys().next().value);
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

// Draws a piece standing on the cell centred (x, y). opts: { lift (0..1, in half-cells), alpha, scale, glow, flip (board turned round), tilt, flash }
export function drawPiece(ctx, side, style, x, y, cell, opts = {}) {
  const dir = (side === 1) !== !!opts.flip ? 'up' : 'down', lift = opts.lift ?? 0, k = (cell / 100) * (opts.scale ?? 1);
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) blob(ctx, x, y + cell * 0.12, cell * 0.95, cell * 0.62, opts.glow);
  blob(ctx, x + cell * 0.03, y + cell * 0.31, cell * 0.42, cell * 0.075, 0.75 * (1 - lift * 0.8));            // tight contact shadow right under the base
  blob(ctx, x + cell * (0.07 + lift * 0.12), y + cell * (0.2 + lift * 0.1), cell * (0.62 + lift * 0.1), cell * (0.26 + lift * 0.04), 0.55 - lift * 0.18);
  ctx.translate(x, y - lift * cell * 0.3);
  if (opts.tilt) ctx.rotate(opts.tilt);
  const s = sprite(side, style, dir, cell * px() * (opts.scale ?? 1));
  if (s) ctx.drawImage(s, -60 * k, -80 * k, 120 * k, 140 * k);
  else { ctx.scale(k, k); paintPiece(ctx, side, style, dir); }
  if (opts.flash) { ctx.fillStyle = `rgba(255,255,255,${opts.flash})`; ctx.scale(k, k); pathOf(ctx, shape(dir), 0, -DEPTH / 2 + 2); ctx.fill(); }
  ctx.restore();
}

// A little board for diagrams (Rules, How to Play, lessons): a crop of the real board art with real pieces.
// spec: { rows: ['..B..', ...] (B black, W white, . empty), marks: [[r,c,'ring'|'cross'|'dot'|'arrow-r'...]], hl: [[r,c]] }
const miniLayer = new Map();
export function drawDiagram(ctx, spec, x, y, cellPx, wood = 'kaya', style = 'classic') {
  const R = spec.rows.length, C = spec.rows[0].length, pal = WOODS[wood] || WOODS.kaya, m = cellPx * 0.18;
  const w = C * cellPx + 2 * m, h = R * cellPx + 2 * m;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 6, w, h, 8); ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, pal.top[0]); g.addColorStop(0.6, pal.top[1]); g.addColorStop(1, pal.top[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  const gx = x + m, gy = y + m;
  (spec.hl || []).forEach(([r, c, col]) => { ctx.fillStyle = col || 'rgba(255,236,150,0.55)'; ctx.fillRect(gx + c * cellPx, gy + r * cellPx, cellPx, cellPx); });
  ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1.2, cellPx * 0.03); ctx.beginPath();
  for (let i = 0; i <= R; i++) { ctx.moveTo(gx, gy + i * cellPx); ctx.lineTo(gx + C * cellPx, gy + i * cellPx); }
  for (let j = 0; j <= C; j++) { ctx.moveTo(gx + j * cellPx, gy); ctx.lineTo(gx + j * cellPx, gy + R * cellPx); }
  ctx.stroke();
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const ch = spec.rows[r][c];
    if (ch === 'B' || ch === 'W') drawPiece(ctx, ch === 'B' ? 1 : 2, style, gx + (c + 0.5) * cellPx, gy + (r + 0.5) * cellPx, cellPx, { alpha: spec.dim && spec.dim.some((d) => d[0] === r && d[1] === c) ? 0.35 : 1 });
  }
  for (const [r, c, kind] of spec.marks || []) {
    const cx = gx + (c + 0.5) * cellPx, cy = gy + (r + 0.5) * cellPx;
    ctx.lineWidth = Math.max(2, cellPx * 0.07);
    if (kind === 'cross') { ctx.strokeStyle = '#d6291f'; const q = cellPx * 0.28; ctx.beginPath(); ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q); ctx.moveTo(cx + q, cy - q); ctx.lineTo(cx - q, cy + q); ctx.stroke(); }
    else if (kind === 'ring') { ctx.strokeStyle = '#1f9e5a'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.3, 0, TAU); ctx.stroke(); }
    else if (kind === 'dot') { ctx.fillStyle = 'rgba(31,158,90,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.14, 0, TAU); ctx.fill(); }
    else if (kind === 'target') { ctx.strokeStyle = '#d6291f'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.34, 0, TAU); ctx.stroke(); }
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
