// Static art: the table, the board, and the pieces. One light, from the upper left.
// The board and the piece sprites are painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where
// OffscreenCanvas does not exist (headless tests) the same painters draw directly.
// Look: a sheet of rice paper with brush-ink lines laid on a woven bamboo frame (or chalk on a pavement slab), lit by a paper lantern on a
// deep teal night table; pieces are glossy lacquer discs: a four-petal blossom for Red, a ringed seed for Jade.
import { host, BOARD_CELLS, BOARD_N } from './layout.js';

// Filled by view3d/presenter.js once WebGL is up: the real 3D pieces rendered to canvases (key `${side}|${style}`), used by the diagrams.
export const sprites = { ready: false, piece: {} };
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);

// ------------------------------------------------------------------------------------------------ boards
// The 3D look (view3d/world.js LOOKS) shares these keys; in 3D `paper` is a brown lacquer board with mother-of-pearl lines, so the flat
// palette (diagrams, the 2D fallback) matches: dark panel, pearl ink.
export const BOARDS = {
  paper: { name: 'Lacquer and pearl', top: ['#6b3d22', '#5a3320', '#46270f'], ink: '#f7f0e0', inkSoft: 'rgba(247,240,224,0.5)', dot: '#fff6e0', frame: ['#e3bd6a', '#c89a45', '#8f6a24'], edge: ['#5f4018', '#2b1a08'], band: '#7a5518', fibre: [255, 220, 170], cord: '#c8211a', groove: '#2b160b' },
  chalk: { name: 'Pavement chalk', top: ['#6b7077', '#585d64', '#464a51'], ink: '#f4f1e6', inkSoft: 'rgba(244,241,230,0.6)', dot: '#fbf8ee', frame: ['#9a9588', '#7f7a6e', '#625e54'], edge: ['#4a463e', '#1f1d19'], band: '#4f4b42', fibre: [20, 22, 26], cord: '#e8c24a', groove: '#2d3035' },
  lotus: { name: 'Lotus pink', top: ['#fbe6e4', '#f3cfd0', '#e6b1b8'], ink: '#5a1f3a', inkSoft: 'rgba(90,31,58,0.55)', dot: '#4a1530', frame: ['#c78a8a', '#a86470', '#7d4054'], edge: ['#5f2a3c', '#2c0f1b'], band: '#6a2f44', fibre: [120, 50, 70], cord: '#2c7f7a', groove: '#7a3a4c' },
};
export const BOARD_KEYS = ['paper', 'chalk', 'lotus'];

// ------------------------------------------------------------------------------------------------ the table
export function drawTable(ctx, L) {
  const { w, h } = L;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0f3a40'); bg.addColorStop(0.5, '#0a2a30'); bg.addColorStop(1, '#051519');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // a paper lantern above the board: a soft warm pool of light
  const b = L.board, cx = b ? b.x + b.S / 2 : w / 2, cy = b ? b.y + b.S / 2 : h / 2, rad = Math.max(w, h) * 0.6;
  const lamp = ctx.createRadialGradient(cx - rad * 0.1, cy - rad * 0.22, rad * 0.04, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,210,140,0.2)'); lamp.addColorStop(0.45, 'rgba(255,170,110,0.06)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  // woven mat: faint horizontal slats with a few joints, like a bamboo table mat
  ctx.strokeStyle = 'rgba(140,220,200,0.035)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let y = 7; y < h; y += 22) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let y = 18; y < h; y += 22) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,6,8,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one cell = 100 and the slab's top-left corner is (0,0): width 100*OUT, height 100*(OUT+0.22).
const OUT = BOARD_CELLS, NC = BOARD_N, SLAB = 22;
// The line figure of the board in cell coordinates (row, col): the square, the middle cross, the two long diagonals and the diamond.
export const FIGURE = (() => {
  const s = [], m = NC - 1, h = m / 2;
  for (let i = 0; i <= m; i++) { s.push([i, 0, i, m]); s.push([0, i, m, i]); }
  s.push([0, 0, m, m], [0, m, m, 0], [0, h, h, 0], [h, 0, m, h], [m, h, h, m], [h, m, 0, h]);
  return s;
})();

// One brush-ink stroke: a slightly uneven line that is a little heavier in the middle (deterministic wobble).
function brush(ctx, x0, y0, x1, y1, wdt, seed, col) {
  const r = lcg(seed), n = 10, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n, bulge = 0.85 + 0.3 * Math.sin(Math.PI * (t0 + t1) / 2), j0 = (r() - 0.5) * 1.4, j1 = (r() - 0.5) * 1.4;
    ctx.lineWidth = wdt * bulge * (0.9 + r() * 0.2);
    ctx.beginPath(); ctx.moveTo(x0 + dx * t0 + nx * j0, y0 + dy * t0 + ny * j0); ctx.lineTo(x0 + dx * t1 + nx * j1, y0 + dy * t1 + ny * j1); ctx.stroke();
  }
}

function paintBoard(ctx, kind) {
  const W = OUT * 100, H = W, pal = BOARDS[kind] || BOARDS.paper, rnd = lcg(11 + kind.length * 29);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  // contact shadow on the table
  for (let k = 5; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.08 + (5 - k) * 0.014})`; rr(-4 * k + 10, 8 + SLAB - 2 + 2 * k, W + 8 * k - 12, H + 4 * k, 24 + 4 * k); ctx.fill(); }
  // the thickness of the slab
  const sg = ctx.createLinearGradient(0, H - 20, 0, H + SLAB);
  sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
  ctx.fillStyle = sg; rr(0, 20, W, H - 20 + SLAB, 14); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,200,0.16)'; ctx.fillRect(14, H + 1, W - 28, 2.5);
  // the top face: the frame
  const tg = ctx.createLinearGradient(0, 0, W, H);
  tg.addColorStop(0, pal.frame[0]); tg.addColorStop(0.5, pal.frame[1]); tg.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = tg; rr(0, 0, W, H, 14); ctx.fill();
  ctx.save(); rr(0, 0, W, H, 14); ctx.clip();
  // woven slats: bamboo strips run along each side; thin dark seams, light edges, and a joint (node) now and then
  const f = 55, G = NC * 100;
  const slat = (x, y, w, h, vertical) => {
    const step = 13, n = Math.ceil((vertical ? w : h) / step);
    for (let i = 0; i < n; i++) {
      const o = i * step;
      ctx.fillStyle = `rgba(255,248,210,${0.05 + rnd() * 0.07})`; if (vertical) ctx.fillRect(x + o, y, step - 2, h); else ctx.fillRect(x, y + o, w, step - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; if (vertical) ctx.fillRect(x + o + step - 2, y, 2, h); else ctx.fillRect(x, y + o + step - 2, w, 2);
      if (rnd() < 0.5) { const j = 0.2 + rnd() * 0.6; ctx.fillStyle = pal.band; ctx.globalAlpha = 0.35; if (vertical) ctx.fillRect(x + o, y + j * h, step - 2, 4); else ctx.fillRect(x + j * w, y + o, 4, step - 2); ctx.globalAlpha = 1; }
    }
  };
  slat(0, 0, W, f, false); slat(0, H - f, W, f, false); slat(0, f, f, H - 2 * f, true); slat(W - f, f, f, H - 2 * f, true);
  // lit upper-left bevel and shaded lower-right
  ctx.strokeStyle = 'rgba(255,246,210,0.45)'; ctx.lineWidth = 3; rr(2, 2, W - 4, H - 4, 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 2; rr(5, 5, W - 10, H - 10, 10); ctx.stroke();
  // corner lashings: a little red cord wound round the frame corners, like a bound mat
  for (const [cx, cy] of [[f * 0.5, f * 0.5], [W - f * 0.5, f * 0.5], [f * 0.5, H - f * 0.5], [W - f * 0.5, H - f * 0.5]]) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(cx + 1.5, cy + 2.5, 13, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.cord; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 7.5, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 8, cy + 3); ctx.lineTo(cx + 8, cy - 3); ctx.stroke();
  }
  ctx.restore();

  // the sheet: a slightly raised paper (or slab) with a soft shadow, inset into the frame
  const gx = f, gy = f;
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; rr(gx - 6, gy - 4, G + 12, G + 12, 5); ctx.fill();
  const pg = ctx.createLinearGradient(gx, gy, gx + G, gy + G);
  pg.addColorStop(0, pal.top[0]); pg.addColorStop(0.55, pal.top[1]); pg.addColorStop(1, pal.top[2]);
  ctx.fillStyle = pg; rr(gx, gy, G, G, 4); ctx.fill();
  ctx.save(); rr(gx, gy, G, G, 4); ctx.clip();
  // paper fibres / slab grain
  const r2 = lcg(91 + kind.length);
  for (let k = 0; k < 340; k++) {
    const x = gx + r2() * G, y = gy + r2() * G, a = 0.03 + r2() * 0.08, len = 6 + r2() * 22, ang = r2() * TAU;
    ctx.strokeStyle = r2() < 0.6 ? `rgba(${pal.fibre[0]},${pal.fibre[1]},${pal.fibre[2]},${a})` : `rgba(255,255,255,${a * 1.2})`; ctx.lineWidth = 0.6 + r2() * 1.1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke();
  }
  // a soft pool of light from the upper left across the paper
  const lg = ctx.createRadialGradient(gx + G * 0.28, gy + G * 0.18, 10, gx + G * 0.5, gy + G * 0.5, G * 0.85);
  lg.addColorStop(0, 'rgba(255,250,225,0.28)'); lg.addColorStop(0.6, 'rgba(255,250,225,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = lg; ctx.fillRect(gx, gy, G, G);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2; rr(gx, gy, G, G, 4); ctx.stroke();

  // the lines (a faint wider under-stroke gives the ink its bleed), then a dot at every point
  const at = (r, c) => [gx + (c + 0.5) * 100, gy + (r + 0.5) * 100];
  ctx.save();
  FIGURE.forEach(([r0, c0, r1, c1], i) => {
    const [x0, y0] = at(r0, c0), [x1, y1] = at(r1, c1), edge = (r0 === r1 && (r0 === 0 || r0 === NC - 1)) || (c0 === c1 && (c0 === 0 || c0 === NC - 1));
    brush(ctx, x0, y0, x1, y1, edge ? 9 : 7, 300 + i * 17, pal.inkSoft.replace('0.55', '0.18').replace('0.6', '0.2'));
    brush(ctx, x0, y0, x1, y1, edge ? 4.6 : 3.6, 500 + i * 13, pal.ink);
  });
  for (let i = 0; i < NC * NC; i++) {
    const [x, y] = at((i / NC) | 0, i % NC), big = (((i / NC) | 0) + (i % NC)) % 2 === 0;
    ctx.fillStyle = pal.dot; ctx.beginPath(); ctx.arc(x, y, big ? 7.5 : 5.5, 0, TAU); ctx.fill();
  }
  // the heart of the board: a small ring round the centre point
  { const [x, y] = at(2, 2); ctx.strokeStyle = pal.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 19, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
const boardCache = new Map();
export function drawBoard(ctx, b, kind = 'paper') {
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
// A lacquer disc. Local units: one cell = 100, origin at the cell centre. Piece value v: 1 Red, 2 Jade.
export const PIECE_STYLES = {
  lacquer: { name: 'Red and jade', 1: { face: ['#ff7a58', '#d8321f', '#8a150d'], side: '#4a0b07', ink: '#ffe2a8', rim: 'rgba(255,214,170,0.45)', motif: 'blossom' }, 2: { face: ['#f6fff4', '#cfeadb', '#8fbea8'], side: '#4f7d6a', ink: '#1f6f62', rim: 'rgba(255,255,255,0.85)', motif: 'seed' } },
  ink: { name: 'Black and shell', 1: { face: ['#5a5f6b', '#2c2f38', '#12141a'], side: '#05060a', ink: '#f0cf80', rim: 'rgba(240,207,128,0.45)', motif: 'blossom' }, 2: { face: ['#ffffff', '#f1ece0', '#d3c9b2'], side: '#8c826a', ink: '#2b3a55', rim: 'rgba(255,255,255,0.9)', motif: 'seed' } },
};
export const STYLE_KEYS = ['lacquer', 'ink'];
const DEPTH = 12, RX = 39, RY = 32, TY = -4;

function paintPiece(ctx, v, style) {
  const pal = (PIECE_STYLES[style] || PIECE_STYLES.lacquer)[v === 2 ? 2 : 1], cy = TY + 4, rx = RX, ry = RY, depth = DEPTH;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // side wall: a lit band under the rim fading to the dark base
  for (let d = depth; d >= 0; d -= 1) {
    ctx.beginPath(); ctx.ellipse(0, cy + d, rx, ry, 0, 0, TAU); ctx.fillStyle = pal.side; ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.26 * (1 - d / depth)})`; ctx.fill();
  }
  // top face
  const g = ctx.createLinearGradient(-rx, cy - ry, rx, cy + ry);
  g.addColorStop(0, pal.face[0]); g.addColorStop(0.5, pal.face[1]); g.addColorStop(1, pal.face[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
  // raised rim, then a recessed field inside it
  const bg = ctx.createLinearGradient(-rx, cy - ry, rx, cy + ry); bg.addColorStop(0, 'rgba(255,255,255,0.85)'); bg.addColorStop(0.45, pal.rim); bg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.strokeStyle = bg; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.ellipse(0, cy, rx - 2.8, ry - 2.3, 0, 0, TAU); ctx.stroke();
  const ig = ctx.createLinearGradient(0, cy - ry * 0.7, 0, cy + ry * 0.7); ig.addColorStop(0, 'rgba(0,0,0,0.2)'); ig.addColorStop(1, 'rgba(255,255,255,0.14)');
  ctx.fillStyle = ig; ctx.beginPath(); ctx.ellipse(0, cy, rx * 0.74, ry * 0.74, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = pal.ink; ctx.globalAlpha = 0.85; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, cy, rx * 0.74, ry * 0.74, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  // motif: Red a four-petal blossom (solid), Jade a seed in a ring (open) - different shapes, not only colours
  ctx.fillStyle = pal.ink; ctx.strokeStyle = pal.ink;
  if (pal.motif === 'blossom') {
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4, ox = Math.cos(a) * rx * 0.2, oy = Math.sin(a) * ry * 0.2;
      ctx.beginPath(); ctx.ellipse(ox, cy + oy, rx * 0.16, ry * 0.2, a, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = pal.face[0]; ctx.beginPath(); ctx.ellipse(0, cy, rx * 0.07, ry * 0.07, 0, 0, TAU); ctx.fill();
  } else {
    ctx.lineWidth = 3.2; ctx.beginPath(); ctx.ellipse(0, cy, rx * 0.36, ry * 0.36, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, cy, rx * 0.12, ry * 0.12, 0, 0, TAU); ctx.fill();
  }
  // gloss: a soft window highlight on the upper left and a thin edge light on the lower right
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, TAU); ctx.clip();
  const sp = ctx.createRadialGradient(-rx * 0.38, cy - ry * 0.46, 0, -rx * 0.38, cy - ry * 0.46, rx * 0.95);
  sp.addColorStop(0, 'rgba(255,255,255,0.62)'); sp.addColorStop(0.5, 'rgba(255,255,255,0.12)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.fillRect(-rx, cy - ry, rx * 2, ry * 2);
  const sd = ctx.createLinearGradient(-rx, 0, rx, 0); sd.addColorStop(0, 'rgba(255,255,255,0.05)'); sd.addColorStop(0.6, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = sd; ctx.fillRect(-rx, cy - ry, rx * 2, ry * 2);
  ctx.restore();
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

// Draws a piece standing on the cell centred (x, y). opts: { lift (0..1, in half-cells), alpha, scale, glow, tilt, flash, sx }
// `sx` squeezes the piece sideways (1 = full, 0 = edge-on) for the flip.
export function drawPiece(ctx, v, style, x, y, cell, opts = {}) {
  const lift = opts.lift ?? 0, k = (cell / 100) * (opts.scale ?? 1) * 1.04, sx = opts.sx ?? 1;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) blob(ctx, x, y + cell * 0.1, cell * 0.95, cell * 0.66, opts.glow);
  blob(ctx, x + cell * 0.03, y + cell * 0.3, cell * 0.46 * (0.4 + 0.6 * sx), cell * 0.12, 0.8 * (1 - lift * 0.8));
  blob(ctx, x + cell * (0.07 + lift * 0.12), y + cell * (0.2 + lift * 0.1), cell * (0.66 + lift * 0.1) * (0.5 + 0.5 * sx), cell * (0.32 + lift * 0.04), 0.5 - lift * 0.18);
  ctx.translate(x, y - lift * cell * 0.3);
  if (opts.tilt) ctx.rotate(opts.tilt);
  if (sx !== 1) ctx.scale(Math.max(0.04, sx), 1);
  const s3 = sprites.ready ? sprites.piece[`${v}|${style}`] : null;
  if (s3) { const S = 1.78 * cell * (opts.scale ?? 1); ctx.drawImage(s3, -S / 2, -S / 2 - cell * 0.04, S, S); }
  else if (sprite(v, style, cell * px() * (opts.scale ?? 1))) { const s = sprite(v, style, cell * px() * (opts.scale ?? 1)); ctx.drawImage(s, -60 * k, -80 * k, 120 * k, 140 * k); }
  else { ctx.save(); ctx.scale(k, k); paintPiece(ctx, v, style); ctx.restore(); }
  if (opts.flash) { ctx.fillStyle = `rgba(255,255,255,${opts.flash})`; ctx.beginPath(); ctx.ellipse(0, (TY + 4) * k, RX * k, RY * k, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// A little board for diagrams (Rules, How to Play, lessons): the real line figure with real pieces.
// spec: { rows: ['..R..', ...] (R Red, J Jade, . empty), full: true if rows is the whole 5x5 board (the diagonals are drawn from the
//   real board's even points), r0/c0: top-left board coordinates of the crop (default 0,0),
//   marks: [[r,c,'ring'|'cross'|'dot'|'target']], hl: [[r,c,color]], arrows: [[r0,c0,r1,c1]] }
export function drawDiagram(ctx, spec, x, y, cellPx, kind = 'paper', style = 'lacquer') {
  const R = spec.rows.length, C = spec.rows[0].length, pal = BOARDS[kind] || BOARDS.paper, m = cellPx * 0.2, r0 = spec.r0 || 0, c0 = spec.c0 || 0;
  const w = C * cellPx + 2 * m, h = R * cellPx + 2 * m;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 6, w, h, 8); ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, pal.top[0]); g.addColorStop(0.6, pal.top[1]); g.addColorStop(1, pal.top[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  const gx = x + m, gy = y + m, P = (r, c) => [gx + (c + 0.5) * cellPx, gy + (r + 0.5) * cellPx];
  (spec.hl || []).forEach(([r, c, col]) => { ctx.fillStyle = col || 'rgba(255,214,90,0.5)'; ctx.beginPath(); ctx.arc(...P(r, c), cellPx * 0.42, 0, TAU); ctx.fill(); });
  // the line figure of the real board, clipped to this crop
  ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, w - 2, h - 2); ctx.clip();
  ctx.strokeStyle = pal.ink; ctx.lineWidth = Math.max(1.6, cellPx * 0.055); ctx.lineCap = 'round'; ctx.beginPath();
  for (const [ra, ca, rb, cb] of FIGURE) {
    const [xa, ya] = P(ra - r0, ca - c0), [xb, yb] = P(rb - r0, cb - c0);
    ctx.moveTo(xa, ya); ctx.lineTo(xb, yb);
  }
  ctx.stroke();
  ctx.fillStyle = pal.dot;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const [cx, cy] = P(r, c); ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.06, 0, TAU); ctx.fill(); }
  ctx.restore();
  const val = { R: 1, J: 2 };
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const ch = spec.rows[r][c];
    if (val[ch]) { const [cx, cy] = P(r, c); drawPiece(ctx, val[ch], style, cx, cy, cellPx * 0.94, { alpha: spec.dim && spec.dim.some((d) => d[0] === r && d[1] === c) ? 0.35 : 1 }); }
  }
  for (const [r, c, kind2] of spec.marks || []) {
    const [cx, cy] = P(r, c);
    ctx.lineWidth = Math.max(2, cellPx * 0.07);
    if (kind2 === 'cross') { ctx.strokeStyle = '#ff5a3c'; const q = cellPx * 0.28; ctx.beginPath(); ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q); ctx.moveTo(cx + q, cy - q); ctx.lineTo(cx - q, cy + q); ctx.stroke(); }
    else if (kind2 === 'ring') { ctx.strokeStyle = '#1f9e5a'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.3, 0, TAU); ctx.stroke(); }
    else if (kind2 === 'dot') { ctx.fillStyle = 'rgba(31,158,90,0.9)'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.14, 0, TAU); ctx.fill(); }
    else if (kind2 === 'flip') { ctx.strokeStyle = '#f2b81c'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.42, 0, TAU); ctx.stroke(); }
    else if (kind2 === 'target') { ctx.strokeStyle = '#ff5a3c'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.34, 0, TAU); ctx.stroke(); }
  }
  for (const a of spec.arrows || []) {
    const [ra, ca, rb, cb] = a, [x0, y0] = P(ra, ca), [x1, y1] = P(rb, cb), ang = Math.atan2(y1 - y0, x1 - x0), hd = cellPx * 0.2;
    ctx.strokeStyle = 'rgba(255,92,60,0.95)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(3, cellPx * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0 + Math.cos(ang) * cellPx * 0.3, y0 + Math.sin(ang) * cellPx * 0.3); ctx.lineTo(x1 - Math.cos(ang) * hd, y1 - Math.sin(ang) * hd); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(ang - 0.45) * hd * 1.4, y1 - Math.sin(ang - 0.45) * hd * 1.4); ctx.lineTo(x1 - Math.cos(ang + 0.45) * hd * 1.4, y1 - Math.sin(ang + 0.45) * hd * 1.4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  return { w, h };
}
export const diagramSize = (spec, cellPx) => ({ w: spec.rows[0].length * cellPx + cellPx * 0.4, h: spec.rows.length * cellPx + cellPx * 0.4 });
