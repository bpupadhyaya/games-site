// All drawing: the painted cloth board (baked once per board into a sprite), ladders, serpents, turned
// wooden pawns, the ivory die, buttons and the backdrop. Deterministic: a seeded LCG, never Math.random.
// The same functions draw the board in play AND the illustrations on the Rules pages.
import { W, H, FRAME, CELL, GRID, BOARD_SIZE, BOARD_X, BOARD_Y, GRID_X, GRID_Y, squareXY } from './layout.js';
import { cellOf, boardKey } from './rules.js';

export const FONT = 'Georgia, "Times New Roman", serif';
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const newCanvas = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null);

export function roundPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export function shade(c, k) { // k>0 lightens toward white, k<0 darkens toward black
  const [r, g, b] = hex(c), t = k < 0 ? 0 : 255, a = Math.abs(k);
  return `rgb(${Math.round(r + (t - r) * a)},${Math.round(g + (t - g) * a)},${Math.round(b + (t - b) * a)})`;
}
let ART_RES = null;
export function setArtRes(ctx) { ART_RES = null; ART_RES = resOf(ctx); }
export function resOf(ctx) {
  if (ART_RES) return ART_RES;
  try { const a = typeof ctx.getTransform === 'function' ? ctx.getTransform().a : 2; return Number.isFinite(a) ? Math.min(3, Math.max(1, Math.ceil(a * 2) / 2)) : 2; } catch { return 2; }
}

const cache = new Map();
export function invalidateArt() { cache.clear(); }
function sprite(key, w, h, res, paint) {
  const k = `${key}@${res}`;
  if (cache.has(k)) return cache.get(k);
  const cv = newCanvas(Math.ceil(w * res), Math.ceil(h * res));
  let out = null;
  if (cv) { const c = cv.getContext('2d'); c.scale(res, res); paint(c); out = cv; }
  if (cache.size > 12) cache.clear();
  cache.set(k, out);
  return out;
}

// ---- backdrop: a dark teak table with a pool of lamp light -------------------------------------------------
export function drawBackdrop(ctx) {
  const res = Math.min(resOf(ctx), 2);
  const cv = sprite('backdrop', W, H, res, (c) => paintBackdrop(c));
  if (cv) ctx.drawImage(cv, 0, 0, W, H); else paintBackdrop(ctx);
}
function paintBackdrop(c) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2c1b12'); g.addColorStop(0.5, '#1f120b'); g.addColorStop(1, '#130a06');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const rnd = lcg(77);
  c.lineCap = 'round';
  for (let i = 0; i < 70; i++) { // long soft wood grain
    const x = rnd() * W, y = rnd() * H, len = 200 + rnd() * 500;
    c.strokeStyle = rnd() < 0.5 ? 'rgba(255,200,140,0.035)' : 'rgba(0,0,0,0.10)'; c.lineWidth = 1 + rnd() * 3;
    c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 30, y + len * 0.3, x - 25, y + len * 0.6, x + 8, y + len); c.stroke();
  }
  const pool = c.createRadialGradient(W / 2, 470, 60, W / 2, 470, 760);
  pool.addColorStop(0, 'rgba(255,190,110,0.20)'); pool.addColorStop(1, 'rgba(255,190,110,0)');
  c.fillStyle = pool; c.fillRect(0, 0, W, H);
  const v = c.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 900);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}

// ---- the painted cloth board -----------------------------------------------------------------------------------
const DYES = ['#f2dca6', '#e39a55', '#79b3aa', '#d98782'];   // turmeric cream, ochre, teal, rose
const MARGIN = 34;

export function drawBoard(ctx, board) {
  const res = resOf(ctx);
  const cv = sprite('board:' + boardKey(board), BOARD_SIZE + MARGIN * 2, BOARD_SIZE + MARGIN * 2, res, (c) => {
    c.translate(MARGIN - BOARD_X, MARGIN - BOARD_Y); paintBoard(c, board);
  });
  if (cv) ctx.drawImage(cv, BOARD_X - MARGIN, BOARD_Y - MARGIN, BOARD_SIZE + MARGIN * 2, BOARD_SIZE + MARGIN * 2);
  else paintBoard(ctx, board);
}

function paintBoard(c, board) {
  const x0 = BOARD_X, y0 = BOARD_Y, S = BOARD_SIZE;
  // soft shadow of the cloth lying on the table
  c.save(); c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 26; c.shadowOffsetY = 12;
  c.fillStyle = '#e9d3a0'; roundPath(c, x0, y0, S, S, 10); c.fill(); c.restore();
  // cloth: warm cream with a faint weave and a diagonal fold of light
  const cg = c.createLinearGradient(x0, y0, x0 + S, y0 + S);
  cg.addColorStop(0, '#f6e8c4'); cg.addColorStop(0.5, '#eed9a6'); cg.addColorStop(1, '#e2c88f');
  c.fillStyle = cg; roundPath(c, x0, y0, S, S, 10); c.fill();
  c.save(); roundPath(c, x0, y0, S, S, 10); c.clip();
  c.lineWidth = 1;
  for (let i = 0; i < S; i += 3) {
    c.strokeStyle = i % 6 === 0 ? 'rgba(120,80,30,0.05)' : 'rgba(255,255,255,0.06)';
    c.beginPath(); c.moveTo(x0 + i, y0); c.lineTo(x0 + i, y0 + S); c.stroke();
    c.beginPath(); c.moveTo(x0, y0 + i); c.lineTo(x0 + S, y0 + i); c.stroke();
  }
  paintBorder(c, x0, y0, S);
  paintSquares(c);
  c.restore();
  // fabric edge: stitched hem
  c.strokeStyle = 'rgba(70,40,10,0.55)'; c.lineWidth = 2; roundPath(c, x0 + 1, y0 + 1, S - 2, S - 2, 10); c.stroke();
  c.setLineDash([6, 5]); c.strokeStyle = 'rgba(255,240,200,0.55)'; c.lineWidth = 1.4; roundPath(c, x0 + 5, y0 + 5, S - 10, S - 10, 8); c.stroke(); c.setLineDash([]);
  paintCreatures(c, board);
  paintNumbers(c);
  // light fold + vignette over everything for depth
  c.save(); roundPath(c, x0, y0, S, S, 10); c.clip();
  const fold = c.createLinearGradient(x0, y0, x0 + S, y0 + S * 0.7);
  fold.addColorStop(0, 'rgba(255,255,255,0.13)'); fold.addColorStop(0.45, 'rgba(255,255,255,0)'); fold.addColorStop(0.7, 'rgba(60,30,0,0.07)'); fold.addColorStop(1, 'rgba(60,30,0,0.18)');
  c.fillStyle = fold; c.fillRect(x0, y0, S, S);
  c.restore();
}

function paisley(c, x, y, s, rot, fill, dot) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.beginPath(); c.moveTo(0, -s);
  c.bezierCurveTo(s * 0.85, -s * 0.45, s * 0.95, s * 0.55, s * 0.05, s * 0.85);
  c.bezierCurveTo(-s * 0.7, s * 1.05, -s * 0.95, s * 0.15, -s * 0.38, -s * 0.28);
  c.bezierCurveTo(-s * 0.2, -s * 0.55, s * 0.1, -s * 0.5, 0, -s);
  c.closePath(); c.fillStyle = fill; c.fill();
  c.beginPath(); c.arc(s * 0.05, s * 0.18, s * 0.2, 0, TAU); c.fillStyle = dot; c.fill();
  c.restore();
}
function rosette(c, x, y, r, a, b, d) {
  c.save(); c.translate(x, y);
  for (let k = 0; k < 8; k++) { c.rotate(TAU / 8); c.beginPath(); c.ellipse(0, -r * 0.62, r * 0.2, r * 0.38, 0, 0, TAU); c.fillStyle = k % 2 ? a : b; c.fill(); }
  c.beginPath(); c.arc(0, 0, r * 0.28, 0, TAU); c.fillStyle = d; c.fill();
  c.beginPath(); c.arc(0, 0, r * 0.12, 0, TAU); c.fillStyle = a; c.fill();
  c.restore();
}
function paintBorder(c, x0, y0, S) {
  const inner = FRAME - 3;
  // indigo band, drawn as an even-odd ring
  const ring = (inset, w, fill) => {
    c.beginPath(); c.rect(x0 + inset, y0 + inset, S - inset * 2, S - inset * 2); c.rect(x0 + inset + w, y0 + inset + w, S - (inset + w) * 2, S - (inset + w) * 2);
    c.fillStyle = fill; c.fill('evenodd');
  };
  const bg = c.createLinearGradient(x0, y0, x0 + S, y0 + S); bg.addColorStop(0, '#2d3f7c'); bg.addColorStop(1, '#1b2658');
  ring(3, inner, bg);
  ring(3, 3, '#c68a2e'); ring(FRAME - 3, 3, '#c68a2e');
  // motif repeat along all four sides
  const n = 21, step = (S - FRAME * 2) / n, mid = FRAME / 2;
  for (let i = 0; i < n; i++) {
    const t = FRAME + step * (i + 0.5), alt = i % 2;
    const fill = alt ? '#f0cf7a' : '#e8e0c4', dot = alt ? '#a8431f' : '#2d3f7c';
    paisley(c, x0 + t, y0 + mid, 9, Math.PI / 2 * (alt ? 1 : 1) + (alt ? 0.2 : -0.2), fill, dot);
    paisley(c, x0 + t, y0 + S - mid, 9, -Math.PI / 2 + (alt ? 0.2 : -0.2), fill, dot);
    paisley(c, x0 + mid, y0 + t, 9, Math.PI + (alt ? 0.2 : -0.2), fill, dot);
    paisley(c, x0 + S - mid, y0 + t, 9, (alt ? 0.2 : -0.2), fill, dot);
  }
  for (const [cx, cy] of [[x0 + mid, y0 + mid], [x0 + S - mid, y0 + mid], [x0 + mid, y0 + S - mid], [x0 + S - mid, y0 + S - mid]]) {
    c.beginPath(); c.arc(cx, cy, 15, 0, TAU); c.fillStyle = '#17204a'; c.fill();
    rosette(c, cx, cy, 14, '#f0cf7a', '#d96a3b', '#a8431f');
  }
}

function paintSquares(c) {
  const rnd = lcg(4242);
  for (let n = 1; n <= 100; n++) {
    const { col, row } = cellOf(n);
    const x = GRID_X + col * CELL, y = GRID_Y + (9 - row) * CELL;
    const dye = DYES[(col + row * 2) % 4];
    const j = () => (rnd() - 0.5) * 2.2;
    const p = 2.2;
    // hand-painted square: slightly wobbly edges, dye gradient, dark ink outline
    c.beginPath();
    c.moveTo(x + p + j(), y + p + j()); c.lineTo(x + CELL - p + j(), y + p + j()); c.lineTo(x + CELL - p + j(), y + CELL - p + j()); c.lineTo(x + p + j(), y + CELL - p + j()); c.closePath();
    const g = c.createLinearGradient(x, y, x + CELL, y + CELL);
    g.addColorStop(0, shade(dye, 0.18)); g.addColorStop(1, shade(dye, -0.1));
    c.fillStyle = g; c.fill();
    c.lineWidth = 1.6; c.strokeStyle = 'rgba(70,35,12,0.55)'; c.stroke();
    // brush speckle
    for (let k = 0; k < 4; k++) { c.fillStyle = 'rgba(255,255,255,0.13)'; c.beginPath(); c.arc(x + 8 + rnd() * (CELL - 16), y + 8 + rnd() * (CELL - 16), 1 + rnd() * 2.2, 0, TAU); c.fill(); }
    // small block-print diamond in the corner opposite the number
    c.save(); c.translate(x + CELL - 14, y + CELL - 14); c.rotate(Math.PI / 4); c.fillStyle = 'rgba(70,35,12,0.18)'; c.fillRect(-4, -4, 8, 8); c.restore();
  }
  // the final square: gold, with a star
  const f = squareXY(100);
  const g = c.createRadialGradient(f.x, f.y, 3, f.x, f.y, 40); g.addColorStop(0, '#fff2b0'); g.addColorStop(1, '#d99b2a');
  c.beginPath(); c.rect(f.x - CELL / 2 + 2.2, f.y - CELL / 2 + 2.2, CELL - 4.4, CELL - 4.4); c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(120,60,10,0.8)'; c.stroke();
  rosette(c, f.x + 6, f.y + 8, 17, '#fff7d0', '#b4691b', '#7a3a10');
}
// Numbers go on top of the ladders and serpents, with a pale halo, so every square stays readable.
function paintNumbers(c) {
  c.font = `700 17px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
  for (let n = 1; n <= 100; n++) {
    const { col, row } = cellOf(n), x = GRID_X + col * CELL, y = GRID_Y + (9 - row) * CELL;
    c.lineWidth = 4; c.strokeStyle = 'rgba(255,246,222,0.9)'; c.strokeText(String(n), x + 6, y + 19);
    c.fillStyle = 'rgba(60,28,10,0.95)'; c.fillText(String(n), x + 6, y + 19);
  }
}

// ---- ladders ------------------------------------------------------------------------------------------------------
const LADDER_TONES = [['#e0b95e', '#9a6a22'], ['#b9763a', '#6e3d14']];
export function drawLadder(ctx, a, b, tone = 0, k = 1) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const [lite, dark] = LADDER_TONES[tone % 2], hw = 10 * k;
  const pa = { x: a.x + ux * 6, y: a.y + uy * 6 }, pb = { x: b.x - ux * 6, y: b.y - uy * 6 };
  const rails = [-hw, hw];
  ctx.save(); ctx.lineCap = 'round';
  // shadow
  ctx.strokeStyle = 'rgba(40,20,5,0.28)'; ctx.lineWidth = 6 * k;
  for (const o of rails) { ctx.beginPath(); ctx.moveTo(pa.x + nx * o + 3, pa.y + ny * o + 5); ctx.lineTo(pb.x + nx * o + 3, pb.y + ny * o + 5); ctx.stroke(); }
  // rungs
  const rungs = Math.max(2, Math.floor(len / 21));
  for (let i = 0; i <= rungs; i++) {
    const t = i / rungs, cx = pa.x + (pb.x - pa.x) * t, cy = pa.y + (pb.y - pa.y) * t;
    ctx.strokeStyle = 'rgba(40,20,5,0.25)'; ctx.lineWidth = 5 * k;
    ctx.beginPath(); ctx.moveTo(cx + nx * -hw + 2, cy + ny * -hw + 4); ctx.lineTo(cx + nx * hw + 2, cy + ny * hw + 4); ctx.stroke();
    ctx.strokeStyle = dark; ctx.lineWidth = 4.4 * k;
    ctx.beginPath(); ctx.moveTo(cx + nx * -hw, cy + ny * -hw); ctx.lineTo(cx + nx * hw, cy + ny * hw); ctx.stroke();
    ctx.strokeStyle = lite; ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.moveTo(cx + nx * -hw, cy + ny * -hw - 0.6); ctx.lineTo(cx + nx * hw, cy + ny * hw - 0.6); ctx.stroke();
  }
  // rails: bamboo with nodes and a bright highlight
  for (const o of rails) {
    ctx.strokeStyle = dark; ctx.lineWidth = 6.4 * k; ctx.beginPath(); ctx.moveTo(pa.x + nx * o, pa.y + ny * o); ctx.lineTo(pb.x + nx * o, pb.y + ny * o); ctx.stroke();
    ctx.strokeStyle = lite; ctx.lineWidth = 4.2 * k; ctx.beginPath(); ctx.moveTo(pa.x + nx * o, pa.y + ny * o); ctx.lineTo(pb.x + nx * o, pb.y + ny * o); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.moveTo(pa.x + nx * o - 1, pa.y + ny * o - 1); ctx.lineTo(pb.x + nx * o - 1, pb.y + ny * o - 1); ctx.stroke();
    for (let i = 1; i < rungs; i++) { // bamboo node rings between rungs
      const t = (i + 0.5) / (rungs + 1) * 1.0, cx = pa.x + (pb.x - pa.x) * t + nx * o, cy = pa.y + (pb.y - pa.y) * t + ny * o;
      ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - nx * 3.4, cy - ny * 3.4); ctx.lineTo(cx + nx * 3.4, cy + ny * 3.4); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---- serpents -----------------------------------------------------------------------------------------------------
export const SNAKE_PAL = [
  { body: '#3f9455', belly: '#d8e8a0', mark: '#f1d36b', dark: '#1b5a31' },
  { body: '#7a4aa6', belly: '#f0d6ea', mark: '#f3a7cf', dark: '#43235f' },
  { body: '#dc7a22', belly: '#ffe3a8', mark: '#3b1d0d', dark: '#8b4208' },
  { body: '#1f8790', belly: '#d7f0e6', mark: '#f4e4a0', dark: '#0d4a52' },
  { body: '#b03a33', belly: '#f7d9a6', mark: '#f6c667', dark: '#6a1613' },
];
// A serpent's path from head (`a`) to tail tip (`b`): an S-curve plus a second, finer wiggle.
export function snakePath(a, b, seed) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const sgn = seed % 2 ? 1 : -1, bend = Math.min(0.28, 18 / len + 0.12) * len * sgn;
  const c1 = { x: a.x + dx * 0.3 + nx * bend, y: a.y + dy * 0.3 + ny * bend }, c2 = { x: a.x + dx * 0.7 - nx * bend, y: a.y + dy * 0.7 - ny * bend };
  const N = Math.max(28, Math.min(96, Math.round(len / 5))), waves = 1.5 + (seed % 3) * 0.5, amp = Math.min(13, len * 0.09);
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    const x = u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x;
    const y = u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y;
    const w = Math.sin(t * TAU * waves) * amp * Math.min(1, t * 6) * (1 - t * 0.4);
    pts.push({ x: x + nx * w, y: y + ny * w });
  }
  return pts;
}
export function drawSnake(ctx, pts, pal, k = 1) {
  const N = pts.length - 1;
  const wAt = (i) => { const t = i / N; return (t < 0.08 ? 10 + 4 * (t / 0.08) : 14 * Math.pow(1 - (t - 0.08) / 0.92, 0.75) + 1.6) * k; };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const seg = (off, ox, oy, style, wMul) => {
    ctx.strokeStyle = style;
    for (let i = 0; i < N; i++) { ctx.lineWidth = Math.max(0.8, (wAt(i) + off) * wMul); ctx.beginPath(); ctx.moveTo(pts[i].x + ox, pts[i].y + oy); ctx.lineTo(pts[i + 1].x + ox, pts[i + 1].y + oy); ctx.stroke(); }
  };
  seg(1, 4, 6, 'rgba(40,20,5,0.26)', 1);           // cast shadow
  seg(2.4, 0, 0, pal.dark, 1);                     // outline
  seg(0, 0, 0, pal.body, 1);                       // body
  seg(-5.5 * k, 0, 1, pal.belly, 0.62);            // lighter belly line down the middle
  // pattern: bands across the body
  for (let i = 3; i < N - 1; i += 3) {
    const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, w = wAt(i) * 0.5;
    ctx.strokeStyle = pal.mark; ctx.lineWidth = Math.max(1, 3 * k * (1 - i / N * 0.6));
    ctx.beginPath(); ctx.moveTo(p.x + nx * w * 0.9, p.y + ny * w * 0.9); ctx.lineTo(p.x - nx * w * 0.9, p.y - ny * w * 0.9); ctx.stroke();
  }
  seg(-wAt(0) * 0.5, -1.5, -2, 'rgba(255,255,255,0.20)', 0.34); // glossy highlight (a thin line each side)
  // head
  const h = pts[0], nx0 = pts[1].x - h.x, ny0 = pts[1].y - h.y, ang = Math.atan2(ny0, nx0) + Math.PI;
  ctx.translate(h.x, h.y); ctx.rotate(ang);
  const hs = k * 1.0;
  ctx.strokeStyle = '#d1262c'; ctx.lineWidth = 2 * hs; // forked tongue
  ctx.beginPath(); ctx.moveTo(14 * hs, 0); ctx.lineTo(24 * hs, 0); ctx.lineTo(29 * hs, -4 * hs); ctx.moveTo(24 * hs, 0); ctx.lineTo(29 * hs, 4 * hs); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(2 * hs, 0, 17 * hs, 12 * hs, 0, 0, TAU);
  const hg = ctx.createRadialGradient(0, -4 * hs, 2, 0, 0, 17 * hs); hg.addColorStop(0, shade(pal.body, 0.3)); hg.addColorStop(1, pal.body);
  ctx.fillStyle = hg; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = pal.dark; ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(7 * hs, s * 6.2 * hs, 4.2 * hs, 0, TAU); ctx.fillStyle = '#fffbe8'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = pal.dark; ctx.stroke();
    ctx.beginPath(); ctx.arc(8.2 * hs, s * 6.2 * hs, 2.1 * hs, 0, TAU); ctx.fillStyle = '#16100a'; ctx.fill();
    ctx.beginPath(); ctx.arc(7.4 * hs, s * 5.6 * hs, 0.8 * hs, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
  }
  ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.arc(14.5 * hs, -2.2 * hs, 1, 0, TAU); ctx.arc(14.5 * hs, 2.2 * hs, 1, 0, TAU); ctx.fill();
  ctx.restore();
}

function paintCreatures(c, board) {
  board.ladders.forEach((l, i) => drawLadder(c, squareXY(l.from), squareXY(l.to), i));
  board.snakes.forEach((s, i) => drawSnake(c, snakePath(squareXY(s.from), squareXY(s.to), s.from + s.to), SNAKE_PAL[(s.from + i) % SNAKE_PAL.length]));
}

// ---- pawns: turned wooden tokens ---------------------------------------------------------------------------------------
export function drawPawn(ctx, x, y, color, r = 18, o = {}) {
  const lift = o.lift ?? 0, sq = o.squash ?? 1;
  ctx.save();
  // contact shadow stays on the cloth while the pawn is in the air
  const sh = Math.max(0.35, 1 - lift / 90);
  ctx.fillStyle = `rgba(30,14,4,${0.38 * sh})`; ctx.beginPath(); ctx.ellipse(x + 2, y + r * 0.78, r * 0.95 * sh, r * 0.34 * sh, 0, 0, TAU); ctx.fill();
  ctx.translate(x, y - lift); ctx.scale(1 / Math.sqrt(sq), sq);
  if (o.glow) { const g = ctx.createRadialGradient(0, -r * 0.2, r * 0.3, 0, -r * 0.2, r * 2.2); g.addColorStop(0, o.glow); g.addColorStop(1, 'rgba(255,230,150,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 2.2, 0, TAU); ctx.fill(); }
  const dk = shade(color, -0.5), md = shade(color, -0.1), lt = shade(color, 0.45);
  // base disc
  ctx.beginPath(); ctx.ellipse(0, r * 0.62, r * 0.98, r * 0.38, 0, 0, TAU); ctx.fillStyle = dk; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, r * 0.52, r * 0.98, r * 0.38, 0, 0, TAU);
  const bg = ctx.createLinearGradient(-r, 0, r, 0); bg.addColorStop(0, md); bg.addColorStop(0.35, lt); bg.addColorStop(1, dk); ctx.fillStyle = bg; ctx.fill();
  // waist
  ctx.beginPath(); ctx.moveTo(-r * 0.62, r * 0.5); ctx.bezierCurveTo(-r * 0.3, r * 0.1, -r * 0.3, -r * 0.2, -r * 0.34, -r * 0.34); ctx.lineTo(r * 0.34, -r * 0.34); ctx.bezierCurveTo(r * 0.3, -r * 0.2, r * 0.3, r * 0.1, r * 0.62, r * 0.5); ctx.closePath();
  const wg = ctx.createLinearGradient(-r * 0.6, 0, r * 0.6, 0); wg.addColorStop(0, md); wg.addColorStop(0.3, lt); wg.addColorStop(1, dk); ctx.fillStyle = wg; ctx.fill();
  // collar ring
  ctx.beginPath(); ctx.ellipse(0, -r * 0.34, r * 0.5, r * 0.15, 0, 0, TAU); ctx.fillStyle = '#e8c36a'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(80,40,0,0.6)'; ctx.stroke();
  // head sphere
  const hy = -r * 0.82, hr = r * 0.62;
  const hg = ctx.createRadialGradient(-hr * 0.35, hy - hr * 0.4, hr * 0.1, 0, hy, hr * 1.05); hg.addColorStop(0, '#fff'); hg.addColorStop(0.18, lt); hg.addColorStop(0.65, md); hg.addColorStop(1, dk);
  ctx.beginPath(); ctx.arc(0, hy, hr, 0, TAU); ctx.fillStyle = hg; ctx.fill();
  ctx.beginPath(); ctx.arc(-hr * 0.34, hy - hr * 0.4, hr * 0.2, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill();
  ctx.restore();
}

// ---- the die ----------------------------------------------------------------------------------------------------------------
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
export function drawDie(ctx, x, y, size, value, o = {}) {
  const ang = o.angle ?? 0, lift = o.lift ?? 0, scale = o.scale ?? 1, s = size * scale;
  ctx.save();
  const sh = Math.max(0.4, 1 - lift / 160);
  ctx.fillStyle = `rgba(20,8,2,${0.38 * sh})`; ctx.beginPath(); ctx.ellipse(x + 4, y + s * 0.42, s * 0.52 * sh, s * 0.22 * sh, 0, 0, TAU); ctx.fill();
  ctx.translate(x, y - lift); ctx.rotate(ang);
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 30; }
  roundPath(ctx, -s / 2, -s / 2 + s * 0.07, s, s, s * 0.2); ctx.fillStyle = '#b79b6a'; ctx.fill(); // thickness
  ctx.shadowBlur = 0;
  roundPath(ctx, -s / 2, -s / 2, s, s, s * 0.2);
  const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2); g.addColorStop(0, '#fffdf3'); g.addColorStop(0.6, '#f2e6c6'); g.addColorStop(1, '#d9c796');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(110,80,30,0.6)'; ctx.stroke();
  roundPath(ctx, -s / 2 + 3, -s / 2 + 3, s - 6, s - 6, s * 0.16); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
  const v = Math.max(1, Math.min(6, value || 1)), pr = s * 0.085, gap = s * 0.26;
  for (const [px, py] of PIPS[v]) {
    const cx = px * gap, cy = py * gap;
    const red = v === 1 || v === 4;
    const pg = ctx.createRadialGradient(cx - pr * 0.3, cy - pr * 0.3, 0.5, cx, cy, pr * 1.1); pg.addColorStop(0, red ? '#e0584a' : '#5a4a3c'); pg.addColorStop(1, red ? '#a3231a' : '#1a120c');
    ctx.beginPath(); ctx.arc(cx, cy, v === 1 ? pr * 1.5 : pr, 0, TAU); ctx.fillStyle = pg; ctx.fill();
  }
  if (o.ring) { roundPath(ctx, -s / 2 - 5, -s / 2 - 5, s + 10, s + 10, s * 0.25); ctx.lineWidth = 3; ctx.strokeStyle = o.ring; ctx.stroke(); }
  ctx.restore();
}

// ---- buttons & panels ------------------------------------------------------------------------------------------------------
// Pointer position while a finger/mouse is held down (set by view.render); drives the pressed look of every button.
let press = null;
export function setPress(p) { press = p; }
export function getPress() { return press; }
// One button style for the whole game: a single subtle vertical gradient, one crisp border, soft drop shadow,
// and a pressed state (darker, sinks 3px, shadow tucks in). No inner gloss shape.
export function drawButton(ctx, r, label, o = {}) {
  const { primary = false, disabled = false, fontPx = 28, sub = null, active = false, lines = null } = o;
  const pressed = !disabled && (o.pressed ?? (press && press.x >= r.x && press.x <= r.x + r.w && press.y >= r.y && press.y <= r.y + r.h));
  const dy = pressed ? 3 : 0;
  ctx.save(); ctx.globalAlpha = disabled ? 0.45 : 1;
  ctx.fillStyle = `rgba(0,0,0,${pressed ? 0.2 : 0.38})`; roundPath(ctx, r.x + 1, r.y + (pressed ? 3 : 5), r.w, r.h, 16); ctx.fill();
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, 16);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  if (primary) { g.addColorStop(0, '#eeb04a'); g.addColorStop(1, '#c4701f'); } else if (active) { g.addColorStop(0, '#3a56a0'); g.addColorStop(1, '#2a4084'); } else { g.addColorStop(0, '#47301f'); g.addColorStop(1, '#35210f'); }
  ctx.fillStyle = g; ctx.fill();
  if (pressed) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill(); }
  ctx.lineWidth = 2; ctx.strokeStyle = primary ? '#ffd88c' : active ? '#8fa7e6' : 'rgba(244,222,180,0.45)'; ctx.stroke();
  ctx.fillStyle = primary ? '#2b1204' : '#f9ecd0'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${fontPx}px ${FONT}`;
  const ls = lines ?? [label], lh = Math.round(fontPx * 1.2), total = ls.length * lh + (sub ? Math.round(fontPx * 0.9) : 0);
  let y = r.y + dy + (r.h - total) / 2 + fontPx * 0.92;
  for (const l of ls) { ctx.fillText(l, r.x + r.w / 2, y); y += lh; }
  if (sub) { ctx.font = `400 ${Math.round(fontPx * 0.62)}px ${FONT}`; ctx.globalAlpha *= 0.85; ctx.fillText(sub, r.x + r.w / 2, y - fontPx * 0.1); }
  ctx.restore();
}

export function wrapLines(ctx, text, maxW) {
  const words = String(text).split(' '), out = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  out.push(line); return out;
}
export function panel(ctx, r, o = {}) {
  ctx.save(); roundPath(ctx, r.x, r.y, r.w, r.h, o.r ?? 22);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, o.top ?? 'rgba(40,24,14,0.78)'); g.addColorStop(1, o.bot ?? 'rgba(18,10,6,0.82)');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = o.line ?? 'rgba(244,222,180,0.3)'; ctx.stroke(); ctx.restore();
}
export function ring(ctx, x, y, r, color, w = 3) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke(); ctx.restore(); }
