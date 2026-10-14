// Static art: the table, the board, and the stones. One light, from the upper left.
// The board layer and the four stone sprites are painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where
// OffscreenCanvas does not exist (headless tests) the same painters draw directly.
import { host, boardGeom } from './layout.js';
import { POINTS, EDGES } from './rules.js';

const TAU = Math.PI * 2;

// Pre-rendered 3D stone sprites (filled in by view3d/presenter.js once WebGL works; empty = the classic painted stones).
// Key: `${style}|${side}`. Square canvas, SPR.w board steps wide; the base centre sits at (SPR.bx, SPR.by) of it.
export const sprites = { ready: false, map: {} };
export const SPR = { w: 1.55, bx: 0.5, by: 0.68 };
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);

// ------------------------------------------------------------------------------------------------ boards (earned with wins)
// clay: a sun-baked courtyard floor with chalk lines (how the game is drawn in villages); slate: a school slate; teak: a polished teak board with inlay.
export const WOODS = {
  clay:  { name: 'Courtyard clay', top: ['#e69363', '#cf7544', '#b05d31'], grain: [92, 38, 14], edge: ['#8d4723', '#4c2210'], chalk: '#fff6e2', groove: 'rgba(70,26,8,0.55)', lit: 'rgba(255,226,190,0.32)', bg: ['#10302d', '#08201e', '#041312'] },
  slate: { name: 'School slate', top: ['#46585a', '#37484a', '#2a3739'], grain: [10, 18, 20], edge: ['#1c2628', '#0d1415'], chalk: '#f6f8ee', groove: 'rgba(0,0,0,0.5)', lit: 'rgba(210,240,235,0.22)', bg: ['#10302d', '#08201e', '#041312'] },
  teak:  { name: 'Polished teak', top: ['#c98f51', '#b0793c', '#8e5d2b'], grain: [64, 34, 10], edge: ['#6d4421', '#3a2210'], chalk: '#ffe8a8', groove: 'rgba(40,16,2,0.6)', lit: 'rgba(255,236,190,0.34)', bg: ['#10302d', '#08201e', '#041312'] },
};
export const WOOD_KEYS = ['clay', 'slate', 'teak'];

// ------------------------------------------------------------------------------------------------ the table
export function drawTable(ctx, L, t = 0) {
  const { w, h } = L;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#12332f'); bg.addColorStop(0.5, '#0b2523'); bg.addColorStop(1, '#051614');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // a lamp: soft warm pool of light centred on the board
  const b = L.board, cx = b ? b.x + b.w / 2 : w / 2, cy = b ? b.y + b.h / 2 : h / 2, rad = Math.max(w, h) * 0.62;
  const lamp = ctx.createRadialGradient(cx - rad * 0.12, cy - rad * 0.2, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,196,120,0.20)'); lamp.addColorStop(0.45, 'rgba(255,170,90,0.06)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  // a woven mat: two sets of very faint strokes
  ctx.strokeStyle = 'rgba(255,230,180,0.022)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = -h; x < w; x += 12) { ctx.moveTo(x, 0); ctx.lineTo(x + h, h); }
  for (let x = 0; x < w + h; x += 12) { ctx.moveTo(x, 0); ctx.lineTo(x - h, h); }
  ctx.stroke();
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one board unit = 100 and the slab's top-left corner is (0,0). The shape is an elongated hexagon: the 5 x 5 grid
// with a triangular block of six points on its top and bottom edges.
const SLAB = 22, HEX = [[2, -2.92], [4.55, -0.11], [4.55, 4.11], [2, 6.92], [-0.55, 4.11], [-0.55, -0.11]];
const PAD = 30;
const mapper = (rot) => (ux, uy) => (rot ? [(uy + 2.92) * 100, (ux + 0.55) * 100] : [(ux + 0.55) * 100, (uy + 2.92) * 100]);
function roundedPoly(ctx, pts, r, dx = 0, dy = 0) {
  const n = pts.length; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const a = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    if (i === 0) ctx.moveTo(a[0] + dx, a[1] + dy);
    else ctx.lineTo(a[0] + dx, a[1] + dy);
    ctx.arcTo(p1[0] + dx, p1[1] + dy, (p1[0] + p2[0]) / 2 + dx, (p1[1] + p2[1]) / 2 + dy, r);
  }
  ctx.closePath();
}
function paintBoard(ctx, key, rot) {
  const pal = WOODS[key] || WOODS.clay, T = mapper(rot), W = rot ? 984 : 510, H = rot ? 510 : 984, rnd = lcg(11 + key.length * 37);
  const poly = HEX.map(([x, y]) => T(x, y)), R = 46;
  // contact shadow on the table
  ctx.save();
  for (let k = 6; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.06 + (6 - k) * 0.01})`; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = k * 9; ctx.lineJoin = 'round'; roundedPoly(ctx, poly, R, 8, SLAB + 8 + k * 2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // the thickness: the outline swept down
  for (let d = SLAB; d >= 0; d -= 2) { ctx.fillStyle = d > SLAB * 0.5 ? pal.edge[1] : pal.edge[0]; roundedPoly(ctx, poly, R, 0, d); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,230,180,0.16)'; roundedPoly(ctx, poly, R, 0, SLAB - 1.5); ctx.fill();
  // the top face
  const tg = ctx.createLinearGradient(0, 0, W, H);
  tg.addColorStop(0, pal.top[0]); tg.addColorStop(0.55, pal.top[1]); tg.addColorStop(1, pal.top[2]);
  ctx.fillStyle = tg; roundedPoly(ctx, poly, R); ctx.fill();
  // texture (clipped to the face): speckle, trowel sweeps, a little mottling
  ctx.save(); roundedPoly(ctx, poly, R); ctx.clip();
  for (let k = 0; k < 70; k++) {
    const x = rnd() * W, y = rnd() * H, a = 0.025 + rnd() * 0.05;
    ctx.strokeStyle = rnd() < 0.55 ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})` : `rgba(255,240,210,${a * 0.8})`; ctx.lineWidth = 6 + rnd() * 22;
    ctx.beginPath(); ctx.arc(x, y, 60 + rnd() * 160, rnd() * TAU, rnd() * TAU + 0.9); ctx.stroke();
  }
  for (let k = 0; k < 900; k++) {
    const x = rnd() * W, y = rnd() * H, r = 0.8 + rnd() * 2.6, dark = rnd() < 0.62, a = 0.05 + rnd() * 0.16;
    ctx.fillStyle = dark ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})` : `rgba(255,236,200,${a * 0.8})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  if (key === 'teak') for (let k = 0; k < 90; k++) {
    const y = rnd() * H, a = 0.04 + rnd() * 0.07;
    ctx.strokeStyle = `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})`; ctx.lineWidth = 0.8 + rnd() * 2.2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 16, W * 0.7, y + (rnd() - 0.5) * 16, W, y + (rnd() - 0.5) * 10); ctx.stroke();
  }
  // the surface sunk a little into the rim: shade along the upper left, light along the lower right
  const sh = ctx.createLinearGradient(0, 0, W * 0.28, H * 0.28); sh.addColorStop(0, 'rgba(0,0,0,0.22)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H);
  const lg = ctx.createLinearGradient(W, H, W * 0.55, H * 0.55); lg.addColorStop(0, pal.lit); lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // rim bevel
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,236,196,0.5)'; ctx.lineWidth = 3; roundedPoly(ctx, poly, R, 0, 1); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; roundedPoly(ctx, poly, R, 0, -1); ctx.stroke();
  // a chalked border inside the rim
  const inset = HEX.map(([x, y]) => T(2 + (x - 2) * 0.94, 2 + (y - 2) * 0.935));
  ctx.setLineDash([4, 9]); ctx.strokeStyle = pal.chalk; ctx.globalAlpha = 0.34; ctx.lineWidth = 3; roundedPoly(ctx, inset, R * 0.8); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  // the lines, scratched in: a dark groove and a chalk line on top, slightly wobbling like a hand-drawn board
  const P = POINTS.map(([x, y]) => T(x, y)), jr = lcg(404);
  const scratch = (a, b, pass) => {
    const n = 5; ctx.beginPath(); ctx.moveTo(a[0], a[1]);
    for (let i = 1; i < n; i++) { const f = i / n; ctx.lineTo(a[0] + (b[0] - a[0]) * f + (jr() - 0.5) * 2.2, a[1] + (b[1] - a[1]) * f + (jr() - 0.5) * 2.2); }
    ctx.lineTo(b[0], b[1]);
    if (pass === 0) { ctx.strokeStyle = pal.groove; ctx.lineWidth = 8; ctx.translate(1.5, 2.5); ctx.stroke(); ctx.translate(-1.5, -2.5); }
    else if (pass === 1) { ctx.strokeStyle = pal.chalk; ctx.globalAlpha = 0.92; ctx.lineWidth = 4.2; ctx.stroke(); ctx.globalAlpha = 1; }
    else { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.4; ctx.translate(-1, -1); ctx.stroke(); ctx.translate(1, 1); }
  };
  ctx.lineCap = 'round';
  for (let pass = 0; pass < 3; pass++) for (const [a, b] of EDGES) scratch(P[a], P[b], pass);
  for (const p of P) {
    ctx.fillStyle = pal.groove; ctx.beginPath(); ctx.arc(p[0] + 1.5, p[1] + 2, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.chalk; ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(p[0], p[1], 9.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  // a small chalk flower round the centre point (an alpona: the village floor painting that the board is often drawn beside)
  const c = P[12];
  ctx.strokeStyle = pal.chalk; ctx.globalAlpha = 0.75; ctx.lineWidth = 3;
  for (let k = 0; k < 8; k++) { ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(k * TAU / 8); ctx.beginPath(); ctx.ellipse(0, -30, 8, 15, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  ctx.beginPath(); ctx.arc(c[0], c[1], 17, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  // soft light over the whole top
  const l2 = ctx.createLinearGradient(0, 0, W, H);
  l2.addColorStop(0, 'rgba(255,245,215,0.14)'); l2.addColorStop(0.5, 'rgba(255,245,215,0)'); l2.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = l2; roundedPoly(ctx, poly, R); ctx.fill();
}
const boardCache = new Map();
// b: board geometry from boardGeom (x, y, w = width of the slab, cell, rot)
export function drawBoard(ctx, b, key = 'clay') {
  const rot = !!b.rot, P = px(), k = b.cell / 100, wpx = Math.min(2300, Math.ceil(b.w * P / 48) * 48);
  const ck = key + '|' + (rot ? 1 : 0) + '|' + wpx;
  let layer = boardCache.get(ck);
  if (layer === undefined) {
    layer = null;
    const W = rot ? 984 : 510, H = rot ? 510 : 984, u = wpx / W, m = mk((W + 2 * PAD) * u, (H + SLAB + 2 * PAD + 40) * u);
    if (m) { m.x.save(); m.x.scale(u, u); m.x.translate(PAD, PAD); paintBoard(m.x, key, rot); m.x.restore(); layer = { c: m.c, u }; }
    boardCache.set(ck, layer); if (boardCache.size > 14) boardCache.delete(boardCache.keys().next().value);
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
  if (layer) ctx.drawImage(layer.c, -PAD, -PAD, layer.c.width / layer.u, layer.c.height / layer.u);
  else { ctx.translate(0, 0); paintBoard(ctx, key, rot); }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ stones
// A guti: a round, polished stone with thickness. Local units: one board unit = 100, origin at the point's centre.
// Ivory carries a ringed engraving, Indigo a six-petal flower, so the two sides never rely on colour alone.
export const PIECE_STYLES = {
  classic: { name: 'Ivory and indigo', 1: { face: ['#fffaf0', '#f0e3c5', '#d9c89d'], side: '#9d8b5f', ink: '#9a6f2c', rim: 'rgba(255,255,255,0.8)' }, 2: { face: ['#4a5cc0', '#2c3a8c', '#18205a'], side: '#0a0e33', ink: '#ffd878', rim: 'rgba(170,190,255,0.5)' } },
  marigold: { name: 'Marigold and jade', 1: { face: ['#ffd95c', '#f4a91c', '#c97a08'], side: '#7a4504', ink: '#7a3c00', rim: 'rgba(255,240,170,0.8)' }, 2: { face: ['#52c9a0', '#239a76', '#126c50'], side: '#06352a', ink: '#e0fff2', rim: 'rgba(190,255,230,0.6)' } },
};
export const STYLE_KEYS = ['classic', 'marigold'];
export const setFaces = () => {};                                   // kept for the shared view code: this game has one face set
const DEPTH = 13, RAD = 30;
function paintPiece(ctx, side, style) {
  const pal = (PIECE_STYLES[style] || PIECE_STYLES.classic)[side], ty = -DEPTH / 2 + 2;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // thickness: the footprint swept down by DEPTH
  ctx.fillStyle = pal.side;
  for (let d = DEPTH; d >= 0; d -= 1) { ctx.beginPath(); ctx.arc(0, d - DEPTH / 2 + 2, RAD, 0, TAU); ctx.fill(); }
  const sh = ctx.createLinearGradient(0, ty, 0, ty + RAD + DEPTH);
  sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = sh; ctx.fillRect(-60, -70, 120, 150); ctx.restore();
  // the top face: a domed lens
  const g = ctx.createRadialGradient(-RAD * 0.35, ty - RAD * 0.4, RAD * 0.1, 0, ty, RAD * 1.05);
  g.addColorStop(0, pal.face[0]); g.addColorStop(0.55, pal.face[1]); g.addColorStop(1, pal.face[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, ty, RAD, 0, TAU); ctx.fill();
  const bg = ctx.createLinearGradient(-RAD, ty - RAD, RAD, ty + RAD); bg.addColorStop(0, 'rgba(255,255,255,0.8)'); bg.addColorStop(0.45, pal.rim); bg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.strokeStyle = bg; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, ty, RAD - 1.6, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, ty, RAD, 0, TAU); ctx.stroke();
  // engraving: a dark line under a light line makes it look cut into the stone
  const engrave = (draw) => {
    ctx.save(); ctx.translate(0.8, 1.6); ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.fillStyle = 'rgba(0,0,0,0.38)'; draw(); ctx.restore();
    ctx.save(); ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink; draw(); ctx.restore();
  };
  ctx.save(); ctx.translate(0, ty);
  if (side === 1) engrave(() => { ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill(); });
  else engrave(() => { ctx.lineWidth = 2.6; for (let k = 0; k < 6; k++) { ctx.save(); ctx.rotate(k * TAU / 6); ctx.beginPath(); ctx.ellipse(0, -11.5, 5.2, 9.5, 0, 0, TAU); ctx.stroke(); ctx.restore(); } ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill(); });
  ctx.restore();
  // gloss: a window of light and a specular glint
  ctx.save(); ctx.beginPath(); ctx.arc(0, ty, RAD - 1, 0, TAU); ctx.clip();
  const hl = ctx.createLinearGradient(-RAD, ty - RAD, RAD * 0.2, ty); hl.addColorStop(0, 'rgba(255,255,255,0.4)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.beginPath(); ctx.ellipse(-RAD * 0.25, ty - RAD * 0.42, RAD * 0.75, RAD * 0.42, -0.5, 0, TAU); ctx.fill();
  const sp = ctx.createRadialGradient(-12, ty - 15, 0, -12, ty - 15, 14);
  sp.addColorStop(0, `rgba(255,255,255,${side === 2 ? 0.75 : 0.6})`); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.fillRect(-40, ty - 45, 70, 60);
  const sd = ctx.createLinearGradient(-RAD, 0, RAD, 0); sd.addColorStop(0, 'rgba(255,255,255,0.06)'); sd.addColorStop(0.6, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = sd; ctx.fillRect(-RAD, ty - RAD, RAD * 2, RAD * 2);
  ctx.restore();
}
const spriteCache = new Map();
function sprite(side, style, cellPx) {
  const q = Math.max(24, Math.ceil(cellPx / 8) * 8), key = `${side}|${style}|${q}`;
  let s = spriteCache.get(key);
  if (s === undefined) {
    s = null; const u = q / 100, m = mk(120 * u, 140 * u);
    if (m) { m.x.save(); m.x.translate(60 * u, 80 * u); m.x.scale(u, u); paintPiece(m.x, side, style); m.x.restore(); s = m.c; }
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

// Draws a stone standing on the point centred (x, y). `cell` is one board unit in screen units.
// opts: { lift (0..1, in half-units), alpha, scale, glow, tilt, flash }
export function drawPiece(ctx, side, style, x, y, cell, opts = {}) {
  const lift = opts.lift ?? 0, k = (cell / 100) * (opts.scale ?? 1);
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) blob(ctx, x, y + cell * 0.1, cell * 0.95, cell * 0.62, opts.glow);
  blob(ctx, x + cell * 0.03, y + cell * 0.27, cell * 0.4, cell * 0.075, 0.75 * (1 - lift * 0.8));
  blob(ctx, x + cell * (0.07 + lift * 0.12), y + cell * (0.19 + lift * 0.1), cell * (0.6 + lift * 0.1), cell * (0.26 + lift * 0.04), 0.55 - lift * 0.18);
  ctx.translate(x, y - lift * cell * 0.3);
  if (opts.tilt) ctx.rotate(opts.tilt);
  const s3 = sprites.ready && sprites.map[`${style}|${side}`];
  if (s3) {
    const W = SPR.w * cell * (opts.scale ?? 1);
    ctx.drawImage(s3, -SPR.bx * W, cell * 0.16 * (opts.scale ?? 1) - SPR.by * W, W, W);
    if (opts.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${opts.flash * 0.6})`; ctx.beginPath(); ctx.ellipse(0, 0, cell * 0.36, cell * 0.28, 0, 0, TAU); ctx.fill(); }
    ctx.restore(); return;
  }
  const s = sprite(side, style, cell * px() * (opts.scale ?? 1));
  if (s) ctx.drawImage(s, -60 * k, -80 * k, 120 * k, 140 * k);
  else { ctx.scale(k, k); paintPiece(ctx, side, style); }
  if (opts.flash) { ctx.fillStyle = `rgba(255,255,255,${opts.flash})`; ctx.scale(k, k); ctx.beginPath(); ctx.arc(0, -DEPTH / 2 + 2, RAD, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// A little board for diagrams (Rules, How to Play, lessons): the real board art, laid on its side, with real stones.
// spec: { stones: { pointIndex: 1 | 2 }, marks: [[idx, 'ring'|'cross'|'dot'|'target']], hl: [[idx, colour]], arrows: [[fromIdx, toIdx]], cell }
export function diagramSize(spec, cell) { const g = boardGeom(0, 0, cell, true, false); return { w: g.w, h: g.h + g.thick }; }
export function drawDiagram(ctx, spec, x, y, cell, wood = 'clay', style = 'classic') {
  const B = boardGeom(x, y, cell, true, false);
  drawBoard(ctx, B, wood);
  for (const [i, col] of spec.hl || []) { const p = B.pt(i); ctx.fillStyle = col || 'rgba(255,236,150,0.55)'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.42, 0, TAU); ctx.fill(); }
  const order = Object.keys(spec.stones || {}).map(Number).sort((a, b) => B.pt(a).y - B.pt(b).y);
  for (const i of order) { const p = B.pt(i); drawPiece(ctx, spec.stones[i], style, p.x, p.y, cell, { alpha: spec.dim && spec.dim.includes(i) ? 0.35 : 1 }); }
  for (const [i, kind] of spec.marks || []) {
    const p = B.pt(i);
    ctx.lineWidth = Math.max(2, cell * 0.07);
    if (kind === 'cross') { ctx.strokeStyle = '#ff3b2a'; const q = cell * 0.26; ctx.beginPath(); ctx.moveTo(p.x - q, p.y - q); ctx.lineTo(p.x + q, p.y + q); ctx.moveTo(p.x + q, p.y - q); ctx.lineTo(p.x - q, p.y + q); ctx.stroke(); }
    else if (kind === 'ring') { ctx.strokeStyle = '#8dffb0'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.32, 0, TAU); ctx.stroke(); }
    else if (kind === 'dot') { ctx.fillStyle = 'rgba(190,255,205,0.95)'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.13, 0, TAU); ctx.fill(); }
    else if (kind === 'target') { ctx.strokeStyle = '#ff3b2a'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.36, 0, TAU); ctx.stroke(); }
  }
  for (const [a, b] of spec.arrows || []) {
    const pa = B.pt(a), pb = B.pt(b), ang = Math.atan2(pb.y - pa.y, pb.x - pa.x), hd = cell * 0.2;
    ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(3, cell * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pa.x + Math.cos(ang) * cell * 0.3, pa.y + Math.sin(ang) * cell * 0.3); ctx.lineTo(pb.x - Math.cos(ang) * hd, pb.y - Math.sin(ang) * hd); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pb.x, pb.y); ctx.lineTo(pb.x - Math.cos(ang - 0.45) * hd * 1.4, pb.y - Math.sin(ang - 0.45) * hd * 1.4); ctx.lineTo(pb.x - Math.cos(ang + 0.45) * hd * 1.4, pb.y - Math.sin(ang + 0.45) * hd * 1.4); ctx.closePath(); ctx.fill();
  }
  return { w: B.w, h: B.h + B.thick };
}

// A cached grain pattern for the HUD plaques: dark teak with chalk-pale streaks (null where no canvas exists, e.g. headless tests).
let woodPat;
export function woodPattern(ctx) {
  if (woodPat === undefined) {
    woodPat = null; const m = mk(256, 256);
    if (m) {
      const x = m.x, r = lcg(11), g = x.createLinearGradient(0, 0, 256, 90); g.addColorStop(0, '#5a2f1a'); g.addColorStop(0.5, '#7b4526'); g.addColorStop(1, '#5a2f1a');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 90; i++) {
        const y = r() * 256, a = 0.05 + r() * 0.15; x.strokeStyle = r() < 0.65 ? `rgba(30,12,4,${a})` : `rgba(255,214,150,${a * 0.6})`; x.lineWidth = 0.6 + r() * 1.8;
        const e = (r() - 0.5) * 8; x.beginPath(); x.moveTo(0, y + e); x.bezierCurveTo(70, y + (r() - 0.5) * 14, 180, y + (r() - 0.5) * 14, 256, y + e); x.stroke();
      }
      for (let i = 0; i < 400; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,230,190,0.07)' : 'rgba(0,0,0,0.10)'; x.fillRect(r() * 256, r() * 256, 1.5, 1.5); }
      try { woodPat = ctx.createPattern(m.c, 'repeat'); } catch { woodPat = null; }
    }
  }
  return woodPat;
}
