// Static art: the table, the board, and the stones. One light, from the upper left.
// The board layer and the four stone sprites are painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where
// OffscreenCanvas does not exist (headless tests) the same painters draw directly.
import { host, boardGeom } from './layout.js';
import { POINTS, EDGES } from './rules.js';
import { v3 } from './v3.js';

// Pre-rendered 3D piece sprites (filled in by view3d/presenter.js once WebGL works; empty = the classic flat art).
export const sprites = { ready: false, piece: {}, anchor: null };

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);

// ------------------------------------------------------------------------------------------------ boards (earned with wins)
// A quilted cloth board with the lines worked in running stitch, the way a Bengal kantha is made: indigo (the default), madder red, and plain
// cotton with blue thread. Same keys as the other board games ("wood") so the shared settings and save code stays the same.
export const WOODS = {
  indigo: { name: 'Indigo cloth', top: ['#34499f', '#233680', '#16225a'], edge: ['#0e1640', '#070b26'], thread: '#fff1d2', accent: '#ffb23c', shade: 'rgba(5,8,34,0.55)', lit: 'rgba(170,190,255,0.22)', weave: [200, 215, 255] },
  madder: { name: 'Madder cloth', top: ['#c43c33', '#a02a26', '#741a19'], edge: ['#4d0f0d', '#2b0706'], thread: '#ffe9c4', accent: '#ffd45e', shade: 'rgba(50,6,6,0.55)', lit: 'rgba(255,200,170,0.24)', weave: [255, 215, 190] },
  cotton: { name: 'Plain cotton', top: ['#f6efdc', '#eadfc3', '#d6c7a2'], edge: ['#8a7a55', '#584a2d'], thread: '#22378a', accent: '#c4382a', shade: 'rgba(70,52,20,0.45)', lit: 'rgba(255,255,240,0.4)', weave: [120, 100, 60] },
};
export const WOOD_KEYS = ['indigo', 'madder', 'cotton'];

// ------------------------------------------------------------------------------------------------ the table
export function drawTable(ctx, L, t = 0) {
  const { w, h } = L;
  if (v3.on) { ctx.clearRect(0, 0, w, h); return; }            // the 3D scene is the table
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2d0f16'); bg.addColorStop(0.5, '#1d0a10'); bg.addColorStop(1, '#10050a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // a lamp: soft warm pool of light centred on the board
  const b = L.board, cx = b ? b.x + b.w / 2 : w / 2, cy = b ? b.y + b.h / 2 : h / 2, rad = Math.max(w, h) * 0.62;
  const lamp = ctx.createRadialGradient(cx - rad * 0.12, cy - rad * 0.2, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,170,120,0.18)'); lamp.addColorStop(0.45, 'rgba(255,120,90,0.05)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  // a stitched wrapper under the board: rows of faint running stitch
  ctx.strokeStyle = 'rgba(255,205,160,0.05)'; ctx.lineWidth = 2; ctx.setLineDash([9, 11]); ctx.beginPath();
  for (let y = 18; y < h; y += 30) { ctx.moveTo(0, y); for (let x = 0; x <= w; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.05 + y * 0.1) * 5); }
  ctx.stroke(); ctx.setLineDash([]);
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one board unit = 100 and the cloth's top-left corner is (0,0). The shape is an hourglass: two triangles that
// meet at a waist (board unit (0, 0)).
const SLAB = 12, BW = 610, BH = 720;
const HEX = [[-3.05, -3.6], [3.05, -3.6], [0.55, 0], [3.05, 3.6], [-3.05, 3.6], [-0.55, 0]];
const PAD = 30;
const mapper = (rot) => (ux, uy) => (rot ? [(uy + 3.6) * 100, (ux + 3.05) * 100] : [(ux + 3.05) * 100, (uy + 3.6) * 100]);
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
  const pal = WOODS[key] || WOODS.indigo, T = mapper(rot), W = rot ? BH : BW, H = rot ? BW : BH, rnd = lcg(31 + key.length * 37);
  const poly = HEX.map(([x, y]) => T(x, y)), R = 40;
  // contact shadow on the table
  ctx.save();
  for (let k = 6; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.07 + (6 - k) * 0.012})`; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = k * 8; ctx.lineJoin = 'round'; roundedPoly(ctx, poly, R, 6, SLAB + 6 + k * 2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // the thickness of the quilt: the outline swept down
  for (let d = SLAB; d >= 0; d -= 2) { ctx.fillStyle = d > SLAB * 0.5 ? pal.edge[1] : pal.edge[0]; roundedPoly(ctx, poly, R, 0, d); ctx.fill(); }
  // the top face
  const tg = ctx.createLinearGradient(0, 0, W, H);
  tg.addColorStop(0, pal.top[0]); tg.addColorStop(0.55, pal.top[1]); tg.addColorStop(1, pal.top[2]);
  ctx.fillStyle = tg; roundedPoly(ctx, poly, R); ctx.fill();
  ctx.save(); roundedPoly(ctx, poly, R); ctx.clip();
  // the weave: fine threads in both directions
  const wv = pal.weave;
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 6) { ctx.strokeStyle = `rgba(${wv[0]},${wv[1]},${wv[2]},${0.035 + rnd() * 0.05})`; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 6) { ctx.strokeStyle = `rgba(${wv[0]},${wv[1]},${wv[2]},${0.03 + rnd() * 0.05})`; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // the kantha ripple: long wavy rows of tiny running stitch worked across the whole cloth, which is what gives the cloth its soft puckered look
  ctx.setLineDash([7, 9]); ctx.lineCap = 'round'; ctx.lineWidth = 2.2; ctx.strokeStyle = pal.thread; ctx.globalAlpha = 0.17;
  const rows = rot ? W : H, span = rot ? H : W;
  for (let r = 16; r < rows; r += 27) {
    ctx.beginPath();
    for (let s = -10; s <= span + 10; s += 14) { const o = Math.sin(s * 0.045 + r * 0.07) * 4.5; if (rot) { if (s === -10) ctx.moveTo(r + o, s); else ctx.lineTo(r + o, s); } else if (s === -10) ctx.moveTo(s, r + o); else ctx.lineTo(s, r + o); }
    ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  // the cloth sunk a little into its quilted rim: shade along the upper left, light along the lower right
  const sh = ctx.createLinearGradient(0, 0, W * 0.3, H * 0.3); sh.addColorStop(0, pal.shade); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H);
  const lg = ctx.createLinearGradient(W, H, W * 0.55, H * 0.55); lg.addColorStop(0, pal.lit); lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // rim: a soft bevel and a double running-stitch border inside it
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,240,215,0.36)'; ctx.lineWidth = 3; roundedPoly(ctx, poly, R, 0, 1); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; roundedPoly(ctx, poly, R, 0, -1); ctx.stroke();
  const inset = (f) => HEX.map(([x, y]) => T(x * f, y * f));
  ctx.lineCap = 'round';
  ctx.setLineDash([11, 8]); ctx.strokeStyle = pal.thread; ctx.globalAlpha = 0.75; ctx.lineWidth = 4; roundedPoly(ctx, inset(0.93), R * 0.7); ctx.stroke();
  ctx.setLineDash([4, 10]); ctx.strokeStyle = pal.accent; ctx.globalAlpha = 0.85; ctx.lineWidth = 3; roundedPoly(ctx, inset(0.87), R * 0.55); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  // the board lines in running stitch: a dark groove under every thread, then the thread
  const P = POINTS.map(([x, y]) => T(x, y));
  const stitch = (a, b, pass) => {
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    if (pass === 0) { ctx.setLineDash([]); ctx.strokeStyle = pal.shade; ctx.lineWidth = 11; ctx.translate(1.5, 3); ctx.stroke(); ctx.translate(-1.5, -3); }
    else { ctx.setLineDash([17, 9]); ctx.strokeStyle = pal.thread; ctx.lineWidth = 5; ctx.stroke(); ctx.setLineDash([]); }
  };
  for (let pass = 0; pass < 2; pass++) for (const [a, b] of EDGES) stitch(P[a], P[b], pass);
  for (let k = 0; k < P.length; k++) {
    const p = P[k], big = k === 0;
    ctx.fillStyle = pal.shade; ctx.beginPath(); ctx.arc(p[0] + 1.5, p[1] + 3, big ? 30 : 21, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.top[1]; ctx.beginPath(); ctx.arc(p[0], p[1], big ? 28 : 19, 0, TAU); ctx.fill();
    ctx.setLineDash([]); ctx.strokeStyle = pal.thread; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p[0], p[1], big ? 28 : 19, 0, TAU); ctx.stroke();
    ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(p[0], p[1], big ? 8 : 5.5, 0, TAU); ctx.fill();
  }
  // an eight-pointed star stitched round the waist
  const c = P[0];
  ctx.strokeStyle = pal.accent; ctx.lineWidth = 3.5; ctx.setLineDash([]); ctx.globalAlpha = 0.9;
  for (let k = 0; k < 8; k++) {
    ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(k * TAU / 8 + TAU / 16);
    ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(7, -50); ctx.lineTo(0, -64); ctx.lineTo(-7, -50); ctx.closePath(); ctx.stroke(); ctx.restore();
  }
  ctx.globalAlpha = 1;
  // soft light over the whole top
  const l2 = ctx.createLinearGradient(0, 0, W, H);
  l2.addColorStop(0, 'rgba(255,245,225,0.12)'); l2.addColorStop(0.5, 'rgba(255,245,225,0)'); l2.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = l2; roundedPoly(ctx, poly, R); ctx.fill();
}
const boardCache = new Map();
// b: board geometry from boardGeom (x, y, w = width of the slab, cell, rot)
export function drawBoard(ctx, b, key = 'indigo') {
  if (v3.on && !b.diagram) return;                            // drawn by the 3D scene (diagrams keep the flat board)
  const rot = !!b.rot, P = px(), k = b.cell / 100, wpx = Math.min(2300, Math.ceil(b.w * P / 48) * 48);
  const ck = key + '|' + (rot ? 1 : 0) + '|' + wpx;
  let layer = boardCache.get(ck);
  if (layer === undefined) {
    layer = null;
    const W = rot ? BH : BW, H = rot ? BW : BH, u = wpx / W, m = mk((W + 2 * PAD) * u, (H + SLAB + 2 * PAD + 40) * u);
    if (m) { m.x.save(); m.x.scale(u, u); m.x.translate(PAD, PAD); paintBoard(m.x, key, rot); m.x.restore(); layer = { c: m.c, u }; }
    boardCache.set(ck, layer); if (boardCache.size > 14) boardCache.delete(boardCache.keys().next().value);
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
  if (layer) ctx.drawImage(layer.c, -PAD, -PAD, layer.c.width / layer.u, layer.c.height / layer.u);
  else { ctx.translate(0, 0); paintBoard(ctx, key, rot); }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ pieces
// A patch: a padded round of cloth worked in running stitch with a mirror at its heart, like the roundels sewn onto a kantha. Local units:
// one board unit = 100, origin at the point's centre. Gold carries a diamond, Ruby a ring, so the two sides never rely on colour alone.
export const PIECE_STYLES = {
  classic: { name: 'Stitched patches', stitched: true,
    1: { face: ['#ffe27a', '#f4ae24', '#c47a08'], side: '#7a4504', thread: '#fff4c8', ink: '#6d3600', rim: 'rgba(255,245,180,0.85)' },
    2: { face: ['#f5666a', '#c82c3d', '#86122a'], side: '#4a0613', thread: '#ffe3d4', ink: '#4a0613', rim: 'rgba(255,190,180,0.7)' } },
  bead: { name: 'Glass beads', stitched: false,
    1: { face: ['#fff0a0', '#f0b030', '#b86d06'], side: '#6a3a02', thread: '#fff4c8', ink: '#6d3600', rim: 'rgba(255,255,210,0.9)' },
    2: { face: ['#ff8a8c', '#d22e44', '#7a0f26'], side: '#42061a', thread: '#ffe3d4', ink: '#42061a', rim: 'rgba(255,210,205,0.8)' } },
};
export const STYLE_KEYS = ['classic', 'bead'];
export const setFaces = () => {};                                   // kept for the shared view code: this game has one face set
const DEPTH = 10, RAD = 28;
function paintPiece(ctx, side, style) {
  const st = PIECE_STYLES[style] || PIECE_STYLES.classic, pal = st[side], ty = -DEPTH / 2 + 2;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // thickness: the footprint swept down by DEPTH
  ctx.fillStyle = pal.side;
  for (let d = DEPTH; d >= 0; d -= 1) { ctx.beginPath(); ctx.arc(0, d - DEPTH / 2 + 2, RAD, 0, TAU); ctx.fill(); }
  const sh = ctx.createLinearGradient(0, ty, 0, ty + RAD + DEPTH);
  sh.addColorStop(0, 'rgba(255,255,255,0.16)'); sh.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = sh; ctx.fillRect(-60, -70, 120, 150); ctx.restore();
  // the top face: a domed round
  const g = ctx.createRadialGradient(-RAD * 0.35, ty - RAD * 0.4, RAD * 0.1, 0, ty, RAD * 1.05);
  g.addColorStop(0, pal.face[0]); g.addColorStop(0.55, pal.face[1]); g.addColorStop(1, pal.face[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, ty, RAD, 0, TAU); ctx.fill();
  const bg = ctx.createLinearGradient(-RAD, ty - RAD, RAD, ty + RAD); bg.addColorStop(0, 'rgba(255,255,255,0.7)'); bg.addColorStop(0.45, pal.rim); bg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.strokeStyle = bg; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, ty, RAD - 1.6, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, ty, RAD, 0, TAU); ctx.stroke();
  ctx.save(); ctx.translate(0, ty);
  if (st.stitched) {                                                // a ring of running stitch, with its shadow
    ctx.setLineDash([5.5, 4.2]);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0.6, 1.3, RAD - 6.5, 0, TAU); ctx.stroke();
    ctx.strokeStyle = pal.thread; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, RAD - 6.5, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  // the mirror at the heart: a small polished disc with the side's mark engraved on it
  const mr = st.stitched ? 12.5 : 11;
  const mg = ctx.createRadialGradient(-mr * 0.35, -mr * 0.4, mr * 0.1, 0, 0, mr * 1.1);
  mg.addColorStop(0, '#ffffff'); mg.addColorStop(0.5, '#d9dde6'); mg.addColorStop(1, '#8e95a8');
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(0.8, 1.6, mr + 1.5, 0, TAU); ctx.fill();
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(0, 0, mr, 0, TAU); ctx.fill();
  ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink; ctx.lineWidth = 2.6;
  if (side === 1) { ctx.beginPath(); ctx.moveTo(0, -mr * 0.6); ctx.lineTo(mr * 0.6, 0); ctx.lineTo(0, mr * 0.6); ctx.lineTo(-mr * 0.6, 0); ctx.closePath(); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(0, 0, mr * 0.5, 0, TAU); ctx.stroke(); }
  ctx.restore();
  // gloss: a window of light and a specular glint
  ctx.save(); ctx.beginPath(); ctx.arc(0, ty, RAD - 1, 0, TAU); ctx.clip();
  const hl = ctx.createLinearGradient(-RAD, ty - RAD, RAD * 0.2, ty); hl.addColorStop(0, `rgba(255,255,255,${st.stitched ? 0.3 : 0.5})`); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.beginPath(); ctx.ellipse(-RAD * 0.25, ty - RAD * 0.42, RAD * 0.75, RAD * 0.42, -0.5, 0, TAU); ctx.fill();
  const sp = ctx.createRadialGradient(-11, ty - 14, 0, -11, ty - 14, 13);
  sp.addColorStop(0, `rgba(255,255,255,${st.stitched ? 0.5 : 0.85})`); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.fillRect(-40, ty - 45, 70, 60);
  const sd = ctx.createLinearGradient(-RAD, 0, RAD, 0); sd.addColorStop(0, 'rgba(255,255,255,0.06)'); sd.addColorStop(0.6, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,0.28)');
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
  const sp3 = sprites.ready && sprites.piece[`${side}|${style}`];
  if (sp3) { const S = sprites.anchor.span * cell * (opts.scale ?? 1) * 1.02; ctx.drawImage(sp3, -sprites.anchor.x * S, cell * 0.2 * (opts.scale ?? 1) - sprites.anchor.y * S, S, S); }
  else {
    const s = sprite(side, style, cell * px() * (opts.scale ?? 1));
    if (s) ctx.drawImage(s, -60 * k, -80 * k, 120 * k, 140 * k);
    else { ctx.scale(k, k); paintPiece(ctx, side, style); }
  }
  if (opts.flash) { ctx.fillStyle = `rgba(255,255,255,${opts.flash})`; ctx.scale(k, k); ctx.beginPath(); ctx.arc(0, -DEPTH / 2 + 2, RAD, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// A little board for diagrams (Rules, How to Play, lessons): the real board art, laid on its side, with real stones.
// spec: { stones: { pointIndex: 1 | 2 }, marks: [[idx, 'ring'|'cross'|'dot'|'target']], hl: [[idx, colour]], arrows: [[fromIdx, toIdx]], cell }
export function diagramSize(spec, cell) { const g = boardGeom(0, 0, cell, true, false); return { w: g.w, h: g.h + g.thick }; }
export function drawDiagram(ctx, spec, x, y, cell, wood = 'indigo', style = 'classic') {
  const B = boardGeom(x, y, cell, true, false); B.diagram = true;
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
