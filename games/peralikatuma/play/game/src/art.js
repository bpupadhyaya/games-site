// Static art: the table, the octagon board, and the gem pieces. One light, from the upper left.
// The board and the piece sprites are painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where
// OffscreenCanvas does not exist (headless tests) the same painters draw directly.
import { host, BOARD_CELLS } from './layout.js';
import { POINTS, NB, rowOf, colOf } from './rules.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);

// Pre-rendered 3D piece sprites (filled in by view3d/presenter.js once WebGL works; empty = the classic painted pieces).
// Key: `${style}|${code}`. Square canvas, SPR.w cells wide; the base centre sits at (SPR.bx, SPR.by) of it.
export const sprites = { ready: false, map: {} };
export const SPR = { w: 1.9, bx: 0.5, by: 0.7 };

// A cached carved-teak grain pattern for the HUD plaques (null where no canvas exists, e.g. headless tests).
let woodPat;
export function woodPattern(ctx) {
  if (woodPat === undefined) {
    woodPat = null; const m = mk(256, 256);
    if (m) {
      const x = m.x, r = lcg(11), g = x.createLinearGradient(0, 0, 256, 90); g.addColorStop(0, '#4a2412'); g.addColorStop(0.5, '#6a3a1c'); g.addColorStop(1, '#4a2412');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 90; i++) {
        const y = r() * 256, a = 0.05 + r() * 0.15; x.strokeStyle = r() < 0.65 ? `rgba(24,8,2,${a})` : `rgba(255,190,130,${a * 0.6})`; x.lineWidth = 0.6 + r() * 1.8;
        const e = (r() - 0.5) * 8; x.beginPath(); x.moveTo(0, y + e); x.bezierCurveTo(70, y + (r() - 0.5) * 14, 180, y + (r() - 0.5) * 14, 256, y + e); x.stroke();
      }
      try { woodPat = ctx.createPattern(m.c, 'repeat'); } catch { woodPat = null; }
    }
  }
  return woodPat;
}

// ------------------------------------------------------------------------------------------------ boards
export const WOODS = {
  satin:      { name: 'Satinwood', top: ['#f3d995', '#e6bf6c', '#d3a351'], grain: [130, 84, 30], frame: ['#4a362a', '#33241a', '#1f150d'], edge: ['#2a1c12', '#120b06'], line: '#4a2d12', inlay: '#e2bb5f', rivet: '#7a4a1a' },
  calamander: { name: 'Calamander', top: ['#d9a778', '#bd8556', '#9d6a41'], grain: [60, 28, 12], frame: ['#2c2a30', '#1d1b20', '#111014'], edge: ['#1c1a1e', '#09080a'], line: '#2f1a0c', inlay: '#e9d089', rivet: '#2f1a0c' },
  jade:       { name: 'Jade lacquer', top: ['#3f9a82', '#2c806b', '#1f6554'], grain: [10, 60, 44], frame: ['#27493f', '#1a3a31', '#0f251f'], edge: ['#15302a', '#07130f'], line: '#e8d79a', inlay: '#f0d98c', rivet: '#f6e7b0' },
};
export const WOOD_KEYS = ['satin', 'calamander', 'jade'];

// ------------------------------------------------------------------------------------------------ the table
export function drawTable(ctx, L, t = 0) {
  const { w, h } = L;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#103a40'); bg.addColorStop(0.5, '#0a2a30'); bg.addColorStop(1, '#051a1f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // a lamp: soft warm pool of light centred on the board
  const b = L.board, cx = b ? b.x + b.S / 2 : w / 2, cy = b ? b.y + b.S / 2 : h / 2, rad = Math.max(w, h) * 0.62;
  const lamp = ctx.createRadialGradient(cx - rad * 0.12, cy - rad * 0.2, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,226,160,0.20)'); lamp.addColorStop(0.45, 'rgba(255,200,120,0.06)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  // woven mat: faint cross hatching
  ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = -h; x < w; x += 12) { ctx.moveTo(x, 0); ctx.lineTo(x + h, h); }
  for (let x = 0; x < w + h; x += 12) { ctx.moveTo(x, 0); ctx.lineTo(x - h, h); }
  ctx.stroke();
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one cell = 100 and the slab's top-left corner is (0,0): width 100*OUT. Point (row, col) is at
// (OFF + 100 * col, OFF + 100 * row) with OFF = 105 (the frame margin 55 plus half a cell).
const OUT = BOARD_CELLS, SLAB = 22, OFF = 105;
const HULL = [[3, 0], [5, 0], [8, 3], [8, 5], [5, 8], [3, 8], [0, 5], [0, 3]];       // (col, row) corners of the octagon of points
const pt = (c, r) => [OFF + 100 * c, OFF + 100 * r];
// A path around the octagon, pushed out by `rad` with round corners (usable for fill, stroke and clip). dy shifts it down (slab front).
function hullPath(ctx, rad, dy = 0) {
  const V = HULL.map(([c, r]) => pt(c, r)), n = V.length;
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const p = V[(k + n - 1) % n], a = V[k], q = V[(k + 1) % n];
    // the outward normal of an edge (dx, dy) of this clockwise polygon is (dy, -dx)
    const a0 = Math.atan2(-(a[0] - p[0]), a[1] - p[1]), a1 = Math.atan2(-(q[0] - a[0]), q[1] - a[1]);
    let e = a1; while (e < a0) e += TAU;
    if (k === 0) ctx.moveTo(a[0] + Math.cos(a0) * rad, a[1] + dy + Math.sin(a0) * rad);
    ctx.arc(a[0], a[1] + dy, rad, a0, e, false);
  }
  ctx.closePath();
}
function paintBoard(ctx, wood) {
  const W = OUT * 100, pal = WOODS[wood] || WOODS.satin, rnd = lcg(11 + wood.length * 31);
  const FR = 100, SF = 66;                                                    // frame and playing-surface radii around the octagon
  // contact shadow on the table
  for (let k = 5; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.07 + (5 - k) * 0.012})`; hullPath(ctx, FR + 4 * k, SLAB + 6 + 2 * k); ctx.fill(); }
  // the slab's side
  const sg = ctx.createLinearGradient(0, 700, 0, 1000 + SLAB);
  sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
  ctx.fillStyle = sg; hullPath(ctx, FR, SLAB); ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,180,0.16)'; ctx.lineWidth = 2.5; hullPath(ctx, FR - 1, SLAB); ctx.stroke();
  // the frame's top face
  const tg = ctx.createLinearGradient(0, 0, W, W);
  tg.addColorStop(0, pal.frame[0]); tg.addColorStop(0.5, pal.frame[1]); tg.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = tg; hullPath(ctx, FR); ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,190,0.32)'; ctx.lineWidth = 3; hullPath(ctx, FR - 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; hullPath(ctx, FR - 5); ctx.stroke();
  // frame grain
  ctx.save(); hullPath(ctx, FR); ctx.clip();
  for (let k = 0; k < 110; k++) {
    const y = rnd() * W, a = 0.04 + rnd() * 0.09, light = rnd() < 0.5;
    ctx.strokeStyle = light ? `rgba(255,226,180,${a * 0.55})` : `rgba(0,0,0,${a})`; ctx.lineWidth = 0.8 + rnd() * 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 18, W * 0.7, y + (rnd() - 0.5) * 18, W, y + (rnd() - 0.5) * 10); ctx.stroke();
  }
  ctx.restore();
  // a brass line inlaid in the frame, and a stud at each corner of the octagon
  ctx.strokeStyle = pal.inlay; ctx.globalAlpha = 0.85; ctx.lineWidth = 3.5; hullPath(ctx, FR - 20); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; hullPath(ctx, FR - 23); ctx.stroke();
  HULL.forEach(([c, r]) => {
    const [x, y] = pt(c, r), cx0 = 4, cy0 = 4, d = Math.hypot(c - cx0, r - cy0) || 1, ux = (c - cx0) / d, uy = (r - cy0) / d, sx = x + ux * 82, sy = y + uy * 82;
    const sgd = ctx.createRadialGradient(sx - 3, sy - 3, 1, sx, sy, 11); sgd.addColorStop(0, '#fff3c8'); sgd.addColorStop(0.5, pal.inlay); sgd.addColorStop(1, '#5a3d12');
    ctx.fillStyle = sgd; ctx.beginPath(); ctx.arc(sx, sy, 10.5, 0, TAU); ctx.fill();
  });
  // the playing surface, sunk into the frame
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; hullPath(ctx, SF + 7); ctx.fill();
  const pg = ctx.createLinearGradient(100, 100, W - 100, W - 100);
  pg.addColorStop(0, pal.top[0]); pg.addColorStop(0.55, pal.top[1]); pg.addColorStop(1, pal.top[2]);
  ctx.fillStyle = pg; hullPath(ctx, SF); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,200,0.4)'; ctx.lineWidth = 1.5; hullPath(ctx, SF + 1); ctx.stroke();
  // surface grain and a few ring figures, clipped to the surface
  ctx.save(); hullPath(ctx, SF); ctx.clip();
  for (let k = 0; k < 170; k++) {
    const y = 60 + rnd() * (W - 120), a = 0.025 + rnd() * 0.08, dark = rnd() < 0.7, wob = 6 + rnd() * 14;
    ctx.strokeStyle = dark ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})` : `rgba(255,240,205,${a * 0.9})`; ctx.lineWidth = 0.7 + rnd() * 2.2;
    ctx.beginPath(); ctx.moveTo(40, y); ctx.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * wob, W * 0.65, y + (rnd() - 0.5) * wob, W - 40, y + (rnd() - 0.5) * wob * 0.6); ctx.stroke();
  }
  for (let k = 0; k < 3; k++) {
    const cx = 160 + rnd() * 780, cy = 160 + rnd() * 780;
    for (let j = 1; j < 7; j++) { ctx.strokeStyle = `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${0.05 - j * 0.004})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(cx, cy, j * 24, j * 9, 0, 0, TAU); ctx.stroke(); }
  }
  // soft pools of light and shade around the points, so the surface is not flat
  { const r2 = lcg(91); for (const i of POINTS) { const [x, y] = pt(colOf(i), rowOf(i)), t = r2(); ctx.fillStyle = t < 0.5 ? `rgba(255,240,200,${0.03 + t * 0.07})` : `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${0.02 + (t - 0.5) * 0.08})`; ctx.beginPath(); ctx.arc(x, y, 62, 0, TAU); ctx.fill(); } }
  // inset shadow on the upper left rim, light on the lower right
  { const is = ctx.createLinearGradient(0, 40, 0, 220); is.addColorStop(0, 'rgba(0,0,0,0.30)'); is.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = is; ctx.fillRect(0, 40, W, 190);
    const il = ctx.createLinearGradient(40, 0, 220, 0); il.addColorStop(0, 'rgba(0,0,0,0.26)'); il.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = il; ctx.fillRect(40, 0, 190, W);
    const ib = ctx.createLinearGradient(0, W - 40, 0, W - 220); ib.addColorStop(0, 'rgba(255,240,200,0.26)'); ib.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = ib; ctx.fillRect(0, W - 230, W, 190); }
  // the carved eight-point star in the middle of the board (a heritage motif: purely decorative)
  { const [x, y] = pt(4, 4); ctx.save(); ctx.translate(x, y); ctx.beginPath();
    for (let k = 0; k < 16; k++) { const a = -Math.PI / 2 + k * Math.PI / 8, rr = k % 2 ? 62 : 188; k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},0.13)`; ctx.fill(); ctx.strokeStyle = pal.inlay; ctx.globalAlpha = 0.55; ctx.lineWidth = 2.5; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(0, 0, 214, 0, TAU); ctx.strokeStyle = `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},0.25)`; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
  ctx.restore();
  // an inlaid brass line just inside the surface edge
  ctx.strokeStyle = pal.inlay; ctx.globalAlpha = 0.75; ctx.lineWidth = 2.6; hullPath(ctx, SF - 14); ctx.stroke(); ctx.globalAlpha = 1;
  // the lines: straight everywhere, diagonal from the points where row + column is even
  ctx.strokeStyle = pal.line; ctx.lineCap = 'round'; ctx.lineWidth = 3.4; ctx.beginPath();
  for (const i of POINTS) {
    const [x, y] = pt(colOf(i), rowOf(i));
    for (const d of [1, 3, 5, 7]) { const q = NB[i][d]; if (q < 0) continue; const [x2, y2] = pt(colOf(q), rowOf(q)); ctx.moveTo(x, y); ctx.lineTo(x2, y2); }   // S, E, NE, SE: each line once
  }
  ctx.stroke();
  // a point: a small pit with a lit lip (a brass rivet on the jade board)
  for (const i of POINTS) {
    const [x, y] = pt(colOf(i), rowOf(i)), even = (rowOf(i) + colOf(i)) % 2 === 0;
    const rr = even ? 11 : 8;
    const g = ctx.createRadialGradient(x - 2, y - 2, 0.5, x, y, rr);
    g.addColorStop(0, wood === 'jade' ? '#fff6cc' : '#8b5a22'); g.addColorStop(1, wood === 'jade' ? '#b99a3c' : pal.rivet);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,245,215,0.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y + 0.8, rr, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  // soft light across the whole top
  const lg = ctx.createLinearGradient(0, 0, W, W);
  lg.addColorStop(0, 'rgba(255,245,215,0.14)'); lg.addColorStop(0.5, 'rgba(255,245,215,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = lg; hullPath(ctx, FR); ctx.fill();
}
const boardCache = new Map();
export function drawBoard(ctx, b, wood = 'satin') {
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
// A gem set in a thick base. Ruby men are round, Sapphire men are eight-sided, so the two sides differ by shape as well as colour.
// A Star is the same gem with a gold bezel and a raised eight-point star. Local units: one cell = 100, origin at the point.
export const PIECE_STYLES = {
  faceted: { name: 'Faceted', cab: false },
  cabochon: { name: 'Cabochon', cab: true },
};
export const STYLE_KEYS = ['faceted', 'cabochon'];
const GEMS = {
  1: { top: ['#ff8e96', '#e02a43', '#8c0b24'], mid: '#ff4d63', deep: '#5a0618', side: ['#8b1026', '#3d0510'], glint: 'rgba(255,225,225,0.9)', rim: 'rgba(255,190,190,0.55)' },
  2: { top: ['#a6d2ff', '#3d82f0', '#143c97'], mid: '#5da0ff', deep: '#0b2260', side: ['#1b4aa8', '#071b4f'], glint: 'rgba(225,240,255,0.95)', rim: 'rgba(190,220,255,0.55)' },
};
const DEPTH = 17, RAD = 37;
function gemPath(ctx, side, rad, dy = 0) {
  ctx.beginPath();
  if (side === 1) { ctx.arc(0, dy, rad, 0, TAU); return; }
  for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4, r = rad * 1.045; k ? ctx.lineTo(Math.cos(a) * r, dy + Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, dy + Math.sin(a) * r); }
  ctx.closePath();
}
function starPath(ctx, r0, r1, dy = 0) {
  ctx.beginPath();
  for (let k = 0; k < 16; k++) { const a = -Math.PI / 2 + k * Math.PI / 8, r = k % 2 ? r0 : r1; k ? ctx.lineTo(Math.cos(a) * r, dy + Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, dy + Math.sin(a) * r); }
  ctx.closePath();
}
function paintPiece(ctx, code, style) {
  const side = ((code - 1) & 1) + 1, star = code > 2, P = GEMS[side], cab = (PIECE_STYLES[style] || PIECE_STYLES.faceted).cab;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // the thick base: the footprint swept down by DEPTH
  const sg = ctx.createLinearGradient(0, -RAD, 0, RAD + DEPTH);
  sg.addColorStop(0, P.side[0]); sg.addColorStop(1, P.side[1]);
  ctx.fillStyle = sg; ctx.strokeStyle = P.side[1]; ctx.lineWidth = 3;
  for (let d = DEPTH; d >= 0; d -= 1) { gemPath(ctx, side, RAD, d - DEPTH / 2 + 2); ctx.fill(); ctx.stroke(); }
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  const sh = ctx.createLinearGradient(0, DEPTH / 2 - 8, 0, DEPTH / 2 + RAD + 10); sh.addColorStop(0, 'rgba(255,255,255,0.20)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = sh; ctx.fillRect(-60, -70, 120, 150); ctx.restore();
  // the top face
  const ty = -DEPTH / 2 + 2;
  const g = ctx.createLinearGradient(-RAD, ty - RAD, RAD, ty + RAD);
  g.addColorStop(0, P.top[0]); g.addColorStop(0.5, P.top[1]); g.addColorStop(1, P.top[2]);
  ctx.fillStyle = g; gemPath(ctx, side, RAD, ty); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.8; gemPath(ctx, side, RAD, ty); ctx.stroke();
  ctx.save(); gemPath(ctx, side, RAD - 1, ty); ctx.clip();
  if (!cab) {
    // eight cut facets fanning out from the centre, then a flat table in the middle
    for (let k = 0; k < 8; k++) {
      const a0 = -Math.PI / 2 + (k - 0.5) * Math.PI / 4, a1 = a0 + Math.PI / 4, light = (k + (side === 2 ? 1 : 0)) % 2 === 0;
      const lit = Math.cos(a0 + Math.PI / 8 + Math.PI * 0.75) * 0.5 + 0.5;                       // facets facing the upper left catch the lamp
      ctx.beginPath(); ctx.moveTo(0, ty); ctx.arc(0, ty, RAD + 6, a0, a1); ctx.closePath();
      ctx.fillStyle = light ? `rgba(255,255,255,${0.10 + lit * 0.34})` : `rgba(0,0,0,${0.10 + (1 - lit) * 0.30})`; ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
    for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + (k - 0.5) * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 15, ty + Math.sin(a) * 15); ctx.lineTo(Math.cos(a) * (RAD + 4), ty + Math.sin(a) * (RAD + 4)); ctx.stroke(); }
    const tab = ctx.createLinearGradient(-15, ty - 15, 15, ty + 15); tab.addColorStop(0, P.mid); tab.addColorStop(1, P.deep);
    ctx.fillStyle = tab; gemPath(ctx, side, 17, ty); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.4; gemPath(ctx, side, 17, ty); ctx.stroke();
  } else {
    // a smooth dome: a broad highlight and a deeper rim
    const dm = ctx.createRadialGradient(-12, ty - 14, 3, 0, ty, RAD + 4);
    dm.addColorStop(0, 'rgba(255,255,255,0.55)'); dm.addColorStop(0.35, 'rgba(255,255,255,0.05)'); dm.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = dm; ctx.fillRect(-RAD - 6, ty - RAD - 6, 2 * RAD + 12, 2 * RAD + 12);
  }
  // specular glint
  const sp = ctx.createRadialGradient(-13, ty - 15, 0, -13, ty - 15, 17);
  sp.addColorStop(0, P.glint); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.fillRect(-40, ty - 40, 60, 60);
  ctx.restore();
  // bevel: lit on the upper left, dark on the lower right
  { const bg = ctx.createLinearGradient(-RAD, ty - RAD, RAD, ty + RAD); bg.addColorStop(0, 'rgba(255,255,255,0.8)'); bg.addColorStop(0.45, P.rim); bg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.strokeStyle = bg; ctx.lineWidth = 3.2; gemPath(ctx, side, RAD - 3.5, ty); ctx.stroke(); }
  if (star) {
    // gold bezel and a raised star
    const gg = ctx.createLinearGradient(-RAD, ty - RAD, RAD, ty + RAD); gg.addColorStop(0, '#fff2b8'); gg.addColorStop(0.5, '#e7b43c'); gg.addColorStop(1, '#8a5a12');
    ctx.strokeStyle = gg; ctx.lineWidth = 5.5; gemPath(ctx, side, RAD - 6.5, ty); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; starPath(ctx, 8, 25, ty + 2.4); ctx.fill();
    ctx.fillStyle = gg; starPath(ctx, 8, 25, ty); ctx.fill();
    ctx.strokeStyle = 'rgba(70,40,5,0.65)'; ctx.lineWidth = 1.2; starPath(ctx, 8, 25, ty); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-2, ty - 3, 2.6, 0, TAU); ctx.fill();
  }
}
const spriteCache = new Map();
function sprite(code, style, cellPx) {
  const q = Math.max(24, Math.ceil(cellPx / 8) * 8), key = `${code}|${style}|${q}`;
  let s = spriteCache.get(key);
  if (s === undefined) {
    s = null; const u = q / 100, m = mk(120 * u, 140 * u);
    if (m) { m.x.save(); m.x.translate(60 * u, 80 * u); m.x.scale(u, u); paintPiece(m.x, code, style); m.x.restore(); s = m.c; }
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

// Draws a piece (code 1..4) standing on the point at (x, y). opts: { lift (0..1, in half-cells), alpha, scale, glow, tilt, flash }
export function drawPiece(ctx, code, style, x, y, cell, opts = {}) {
  const lift = opts.lift ?? 0, k = (cell / 100) * (opts.scale ?? 1);
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) blob(ctx, x, y + cell * 0.12, cell * 0.95, cell * 0.62, opts.glow);
  blob(ctx, x + cell * 0.03, y + cell * 0.33, cell * 0.42, cell * 0.08, 0.75 * (1 - lift * 0.8));            // tight contact shadow right under the base
  blob(ctx, x + cell * (0.07 + lift * 0.12), y + cell * (0.22 + lift * 0.1), cell * (0.62 + lift * 0.1), cell * (0.26 + lift * 0.04), 0.55 - lift * 0.18);
  ctx.translate(x, y - lift * cell * 0.3);
  if (opts.tilt) ctx.rotate(opts.tilt);
  const s3 = sprites.ready && sprites.map[`${style}|${code}`];
  if (s3) {
    const Wd = SPR.w * cell * (opts.scale ?? 1);
    ctx.drawImage(s3, -SPR.bx * Wd, cell * 0.1 * (opts.scale ?? 1) - SPR.by * Wd, Wd, Wd);
    if (opts.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${opts.flash * 0.6})`; ctx.beginPath(); ctx.ellipse(0, 0, cell * 0.36, cell * 0.3, 0, 0, TAU); ctx.fill(); }
    ctx.restore(); return;
  }
  const s = sprite(code, style, cell * px() * (opts.scale ?? 1));
  if (s) ctx.drawImage(s, -60 * k, -80 * k, 120 * k, 140 * k);
  else { ctx.scale(k, k); paintPiece(ctx, code, style); }
  if (opts.flash) { ctx.fillStyle = `rgba(255,255,255,${opts.flash})`; ctx.scale(k, k); gemPath(ctx, ((code - 1) & 1) + 1, RAD, -DEPTH / 2 + 2); ctx.fill(); }
  ctx.restore();
}

// A little board for diagrams (Rules, How to Play, lessons): the same lines and the same pieces on a few points.
// spec: { rows: ['..R..', ...] (R Ruby man, S Sapphire man, r Ruby star, s Sapphire star, . point, space = no point),
//         oy, ox: where the corner of the diagram sits on the real board (keeps the diagonals true: they run from points where row + col is even),
//         marks: [[r,c,'ring'|'cross'|'dot'|'target']], hl: [[r,c,colour]], arrows: [[r0,c0,r1,c1]], dim: [[r,c]] }
export function drawDiagram(ctx, spec, x, y, cellPx, wood = 'satin', style = 'faceted') {
  const R = spec.rows.length, C = spec.rows[0].length, pal = WOODS[wood] || WOODS.satin, m = cellPx * 0.3;
  const w = C * cellPx + 2 * m, h = R * cellPx + 2 * m;
  const oy = spec.oy || 0, ox = spec.ox || 0;
  const has = (r, c) => r >= 0 && r < R && c >= 0 && c < C && spec.rows[r][c] !== ' ';
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 6, w, h, 12); ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, pal.top[0]); g.addColorStop(0.6, pal.top[1]); g.addColorStop(1, pal.top[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  // point centres: the plate has a margin m around the lattice of centres, which are cellPx apart
  const px0 = (c) => x + w / 2 + (c - (C - 1) / 2) * cellPx, py0 = (r) => y + h / 2 + (r - (R - 1) / 2) * cellPx;
  (spec.hl || []).forEach(([r, c, col]) => { ctx.fillStyle = col || 'rgba(255,236,150,0.55)'; ctx.beginPath(); ctx.arc(px0(c), py0(r), cellPx * 0.42, 0, TAU); ctx.fill(); });
  ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1.4, cellPx * 0.04); ctx.lineCap = 'round'; ctx.beginPath();
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (!has(r, c)) continue;
    if (has(r, c + 1)) { ctx.moveTo(px0(c), py0(r)); ctx.lineTo(px0(c + 1), py0(r)); }
    if (has(r + 1, c)) { ctx.moveTo(px0(c), py0(r)); ctx.lineTo(px0(c), py0(r + 1)); }
    if ((r + c + oy + ox) % 2 === 0) {
      if (has(r + 1, c + 1)) { ctx.moveTo(px0(c), py0(r)); ctx.lineTo(px0(c + 1), py0(r + 1)); }
      if (has(r + 1, c - 1)) { ctx.moveTo(px0(c), py0(r)); ctx.lineTo(px0(c - 1), py0(r + 1)); }
    }
  }
  ctx.stroke();
  ctx.fillStyle = pal.line;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (has(r, c)) { ctx.beginPath(); ctx.arc(px0(c), py0(r), Math.max(2, cellPx * 0.075), 0, TAU); ctx.fill(); }
  const dim = (r, c) => spec.dim && spec.dim.some((d) => d[0] === r && d[1] === c);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const ch = spec.rows[r][c], code = ch === 'R' ? 1 : ch === 'S' ? 2 : ch === 'r' ? 3 : ch === 's' ? 4 : 0;
    if (code) drawPiece(ctx, code, style, px0(c), py0(r), cellPx * 0.96, { alpha: dim(r, c) ? 0.35 : 1 });
  }
  for (const [r, c, kind] of spec.marks || []) {
    const mx = px0(c), my = py0(r);
    ctx.lineWidth = Math.max(2, cellPx * 0.07);
    if (kind === 'cross') { ctx.strokeStyle = '#d6291f'; const q = cellPx * 0.28; ctx.beginPath(); ctx.moveTo(mx - q, my - q); ctx.lineTo(mx + q, my + q); ctx.moveTo(mx + q, my - q); ctx.lineTo(mx - q, my + q); ctx.stroke(); }
    else if (kind === 'ring') { ctx.strokeStyle = '#17a35a'; ctx.beginPath(); ctx.arc(mx, my, cellPx * 0.32, 0, TAU); ctx.stroke(); }
    else if (kind === 'dot') { ctx.fillStyle = 'rgba(20,150,80,0.9)'; ctx.beginPath(); ctx.arc(mx, my, cellPx * 0.15, 0, TAU); ctx.fill(); }
    else if (kind === 'target') { ctx.strokeStyle = '#d6291f'; ctx.beginPath(); ctx.arc(mx, my, cellPx * 0.36, 0, TAU); ctx.stroke(); }
  }
  for (const a of spec.arrows || []) {
    const [r0, c0, r1, c1] = a, x0 = px0(c0), y0 = py0(r0), x1 = px0(c1), y1 = py0(r1), ang = Math.atan2(y1 - y0, x1 - x0), hd = cellPx * 0.2;
    ctx.strokeStyle = 'rgba(214,41,31,0.92)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(3, cellPx * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0 + Math.cos(ang) * cellPx * 0.3, y0 + Math.sin(ang) * cellPx * 0.3); ctx.lineTo(x1 - Math.cos(ang) * hd, y1 - Math.sin(ang) * hd); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(ang - 0.45) * hd * 1.4, y1 - Math.sin(ang - 0.45) * hd * 1.4); ctx.lineTo(x1 - Math.cos(ang + 0.45) * hd * 1.4, y1 - Math.sin(ang + 0.45) * hd * 1.4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  return { w, h };
}
export const diagramSize = (spec, cellPx) => ({ w: spec.rows[0].length * cellPx + cellPx * 0.6, h: spec.rows.length * cellPx + cellPx * 0.6 });
