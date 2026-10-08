// Static art: the table, the board and the pegs. One lamp, from the upper left.
// The board and the peg sprites are painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where OffscreenCanvas
// does not exist (headless tests) the same painters draw directly.
import { host } from './layout.js';
import { geo, VARIANTS } from './rules.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);
export const FRAME = 0.5, SLAB = 22;

// ------------------------------------------------------------------------------------------------ boards
export const BOARDS = {
  maple:  { name: 'Maple', a: '#f3e1b6', b: '#e6cc92', grain: [150, 105, 50], frame: ['#a96f3a', '#85532a', '#5e381a'], edge: ['#6e4422', '#3a2010'], line: 'rgba(90,55,20,0.35)' },
  walnut: { name: 'Walnut', a: '#d3a874', b: '#bd8f5c', grain: [80, 44, 18], frame: ['#6b4126', '#4f2d18', '#341c0e'], edge: ['#46281a', '#241209'], line: 'rgba(50,25,8,0.4)' },
  jade:   { name: 'Jade', a: '#d9eadc', b: '#b9d4c1', grain: [40, 90, 70], frame: ['#2f6a5c', '#22524a', '#173a35'], edge: ['#1c463f', '#0e2420'], line: 'rgba(20,70,55,0.35)' },
};
export const BOARD_KEYS = ['maple', 'walnut', 'jade'];

// ------------------------------------------------------------------------------------------------ seat colours
export const SEAT = [
  null,
  { name: 'Blue',  hi: '#a9c8ff', mid: '#3a7bff', lo: '#1a3e9a', dk: '#0b1f5c', tint: '58,123,255' },
  { name: 'Red',   hi: '#ffaa9c', mid: '#e5483b', lo: '#9c1f17', dk: '#5a0d09', tint: '229,72,59' },
  { name: 'Green', hi: '#a4f2bf', mid: '#2fb86a', lo: '#14753f', dk: '#09401f', tint: '47,184,106' },
  { name: 'Gold',  hi: '#ffeaa0', mid: '#f3b92b', lo: '#b27a0c', dk: '#6a4505', tint: '243,185,43' },
];

// ------------------------------------------------------------------------------------------------ the table
export function drawTable(ctx, L, t = 0) {
  const { w, h } = L;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0f2f33'); bg.addColorStop(0.5, '#0a2227'); bg.addColorStop(1, '#06141a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const b = L.board, cx = b ? b.x + b.S / 2 : w / 2, cy = b ? b.y + b.S / 2 : h / 2, rad = Math.max(w, h) * 0.66;
  const lamp = ctx.createRadialGradient(cx - rad * 0.12, cy - rad * 0.2, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,224,160,0.20)'); lamp.addColorStop(0.45, 'rgba(255,200,130,0.06)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.lineWidth = 1; ctx.beginPath();              // felt weave
  for (let x = -h; x < w; x += 9) { ctx.moveTo(x, 0); ctx.lineTo(x + h, h); }
  for (let x = 0; x < w + h; x += 9) { ctx.moveTo(x, 0); ctx.lineTo(x - h, h); }
  ctx.stroke();
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one cell = 100 and the slab's top-left corner is (0,0): width = height = 100 * (n + 2 * FRAME) (+ SLAB below).
function paintBoard(ctx, boardKey, variant) {
  const G = geo(variant), n = G.n, pal = BOARDS[boardKey] || BOARDS.maple, W = (n + 2 * FRAME) * 100, H = W, f = FRAME * 100, G0 = n * 100, rnd = lcg(11 + n * 7 + boardKey.length);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  for (let k = 5; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.07 + (5 - k) * 0.012})`; rr(-4 * k + 10, 8 + SLAB - 2 + 2 * k, W + 8 * k - 12, H + 4 * k, 26 + 4 * k); ctx.fill(); }   // contact shadow
  const sg = ctx.createLinearGradient(0, H - 20, 0, H + SLAB); sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
  ctx.fillStyle = sg; rr(0, 20, W, H - 20 + SLAB, 18); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,180,0.18)'; ctx.fillRect(16, H + 1, W - 32, 2.5);
  const tg = ctx.createLinearGradient(0, 0, W, H); tg.addColorStop(0, pal.frame[0]); tg.addColorStop(0.5, pal.frame[1]); tg.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = tg; rr(0, 0, W, H, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,190,0.35)'; ctx.lineWidth = 3; rr(2, 2, W - 4, H - 4, 16); ctx.stroke();
  ctx.save(); rr(0, 0, W, H, 18); ctx.clip();                                                    // frame grain
  for (let k = 0; k < 70; k++) { const y = rnd() * H, a = 0.03 + rnd() * 0.07; ctx.strokeStyle = rnd() < 0.6 ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})` : `rgba(255,236,200,${a * 0.7})`; ctx.lineWidth = 0.8 + rnd() * 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 16, W * 0.7, y + (rnd() - 0.5) * 16, W, y + (rnd() - 0.5) * 10); ctx.stroke(); }
  ctx.restore();
  // playing surface, sunk into the frame
  const gx = f, gy = f;
  ctx.fillStyle = pal.a; rr(gx - 7, gy - 7, G0 + 14, G0 + 14, 6); ctx.fill();
  ctx.save(); rr(gx - 7, gy - 7, G0 + 14, G0 + 14, 6); ctx.clip();
  const cellRnd = lcg(91 + n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {                                      // checker squares with their own tone
    const t = cellRnd();
    ctx.fillStyle = (r + c) % 2 ? pal.b : pal.a; ctx.fillRect(gx + c * 100, gy + r * 100, 100, 100);
    ctx.fillStyle = t < 0.5 ? `rgba(255,248,220,${0.04 + t * 0.12})` : `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${0.02 + (t - 0.5) * 0.1})`; ctx.fillRect(gx + c * 100, gy + r * 100, 100, 100);
  }
  for (let k = 0; k < 120; k++) {                                                                // long soft grain streaks across the whole face
    const y = gy + rnd() * G0, a = 0.03 + rnd() * 0.07, w2 = 6 + rnd() * 14;
    ctx.strokeStyle = rnd() < 0.7 ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})` : `rgba(255,245,215,${a})`; ctx.lineWidth = 0.7 + rnd() * 2;
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.bezierCurveTo(gx + G0 * 0.3, y + (rnd() - 0.5) * w2, gx + G0 * 0.65, y + (rnd() - 0.5) * w2, gx + G0, y + (rnd() - 0.5) * w2 * 0.6); ctx.stroke();
  }
  // camps: a coloured tint on the squares each seat starts on, with a soft border around the whole camp
  for (let s = 1; s <= G.seats; s++) {
    const col = SEAT[s].tint, cells = G.camps[G.startC[s]], set = new Set(cells);
    for (const q of cells) {
      const r = (q / n) | 0, c = q % n, x = gx + c * 100, y = gy + r * 100;
      const g = ctx.createLinearGradient(x, y, x + 100, y + 100); g.addColorStop(0, `rgba(${col},0.52)`); g.addColorStop(1, `rgba(${col},0.34)`);
      ctx.fillStyle = g; ctx.fillRect(x, y, 100, 100);
    }
    ctx.strokeStyle = `rgba(${col},0.95)`; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath();
    for (const q of cells) {
      const r = (q / n) | 0, c = q % n, x = gx + c * 100, y = gy + r * 100;
      if (!set.has(q - n) || r === 0) { ctx.moveTo(x, y + 3); ctx.lineTo(x + 100, y + 3); }
      if (!set.has(q + n) || r === n - 1) { ctx.moveTo(x, y + 97); ctx.lineTo(x + 100, y + 97); }
      if (c === 0 || !set.has(q - 1)) { ctx.moveTo(x + 3, y); ctx.lineTo(x + 3, y + 100); }
      if (c === n - 1 || !set.has(q + 1)) { ctx.moveTo(x + 97, y); ctx.lineTo(x + 97, y + 100); }
    }
    ctx.stroke();
  }
  ctx.strokeStyle = pal.line; ctx.lineWidth = 2.2; ctx.beginPath();
  for (let i = 0; i <= n; i++) { ctx.moveTo(gx, gy + i * 100); ctx.lineTo(gx + G0, gy + i * 100); ctx.moveTo(gx + i * 100, gy); ctx.lineTo(gx + i * 100, gy + G0); }
  ctx.stroke();
  const is = ctx.createLinearGradient(0, gy - 7, 0, gy + 44); is.addColorStop(0, 'rgba(0,0,0,0.34)'); is.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = is; ctx.fillRect(gx - 7, gy - 7, G0 + 14, 52);
  const il = ctx.createLinearGradient(gx - 7, 0, gx + 44, 0); il.addColorStop(0, 'rgba(0,0,0,0.26)'); il.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = il; ctx.fillRect(gx - 7, gy - 7, 52, G0 + 14);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(gx - 7, gy - 7, G0 + 14, G0 + 14, 6); ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,205,0.6)'; ctx.font = `600 ${n > 12 ? 26 : 30}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';   // coordinates in the frame
  for (let i = 0; i < n; i++) { ctx.fillText('abcdefghijklmnop'[i], gx + i * 100 + 50, H - f / 2 + 2); ctx.fillText(String(n - i), f / 2 - 1, gy + i * 100 + 50); }
  ctx.textBaseline = 'alphabetic';
  const lg = ctx.createLinearGradient(0, 0, W, H); lg.addColorStop(0, 'rgba(255,245,215,0.14)'); lg.addColorStop(0.5, 'rgba(255,245,215,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = lg; rr(0, 0, W, H, 18); ctx.fill();
}
const boardCache = new Map();
export function drawBoard(ctx, b, boardKey = 'maple', variant = 'classic') {
  const n = VARIANTS[variant].n, OUT = n + 2 * FRAME, k = b.S / (OUT * 100), P = px(), wpx = Math.min(2300, Math.ceil(b.S * P / 64) * 64);
  const key = `${boardKey}|${variant}|${wpx}`;
  let layer = boardCache.get(key);
  if (layer === undefined) {
    layer = null;
    const u = wpx / (OUT * 100), m = mk(wpx + 8, (OUT * 100 + SLAB + 40) * u + 8);
    if (m) { m.x.save(); m.x.translate(4, 4); m.x.scale(u, u); paintBoard(m.x, boardKey, variant); m.x.restore(); layer = { c: m.c, u }; }
    boardCache.set(key, layer); if (boardCache.size > 8) boardCache.delete(boardCache.keys().next().value);
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
  if (layer) ctx.drawImage(layer.c, -4 / layer.u, -4 / layer.u, layer.c.width / layer.u, layer.c.height / layer.u);
  else paintBoard(ctx, boardKey, variant);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ pegs
export const PEG_STYLES = { lacquer: { name: 'Lacquer' }, glass: { name: 'Glass' } };
export const STYLE_KEYS = ['lacquer', 'glass'];
// The mark on top of each seat's pegs, so colour is never the only way to tell the sides apart.
function mark(ctx, seat, cx, cy, s) {
  ctx.beginPath();
  if (seat === 1) ctx.arc(cx, cy, s * 0.8, 0, TAU);
  else if (seat === 2) { ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy); ctx.closePath(); }
  else if (seat === 3) { ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s * 0.95, cy + s * 0.75); ctx.lineTo(cx - s * 0.95, cy + s * 0.75); ctx.closePath(); }
  else ctx.rect(cx - s * 0.75, cy - s * 0.75, s * 1.5, s * 1.5);
}
function paintPeg(ctx, seat, style) {
  const P = SEAT[seat];
  ctx.lineJoin = 'round';
  if (style === 'glass') {
    const cx = 0, cy = -3, R = 35;
    const body = ctx.createRadialGradient(cx - 8, cy - 12, 2, cx, cy + 4, R);
    body.addColorStop(0, P.hi); body.addColorStop(0.35, P.mid); body.addColorStop(0.85, P.lo); body.addColorStop(1, P.dk);
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    const inner = ctx.createRadialGradient(cx + 10, cy + 16, 2, cx + 6, cy + 12, 24); inner.addColorStop(0, 'rgba(255,255,255,0.38)'); inner.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(cx, cy, R - 1, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; mark(ctx, seat, cx, cy + 3, 13); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(cx - 13, cy - 17, 12, 6.5, -0.7, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(cx + 14, cy + 17, 3.4, 0, TAU); ctx.fill();
    return;
  }
  // lacquered peg: a short barrel with a domed top
  const top = -8, bot = 14, rx = 35, ry = 15;
  const sg = ctx.createLinearGradient(-rx, 0, rx, 0); sg.addColorStop(0, P.mid); sg.addColorStop(0.45, P.lo); sg.addColorStop(1, P.dk);
  ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(-rx, top); ctx.lineTo(-rx, bot); ctx.ellipse(0, bot, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(rx, top); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.moveTo(-rx, top); ctx.lineTo(-rx, bot); ctx.ellipse(0, bot, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(rx, top); ctx.closePath(); ctx.clip();
  const sh = ctx.createLinearGradient(0, top, 0, bot + ry); sh.addColorStop(0, 'rgba(255,255,255,0.14)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.4)'); ctx.fillStyle = sh; ctx.fillRect(-40, top - 4, 80, 50);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-rx, top); ctx.lineTo(-rx, bot); ctx.ellipse(0, bot, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(rx, top); ctx.stroke();
  const tg = ctx.createRadialGradient(-10, top - 8, 2, 0, top, rx + 4); tg.addColorStop(0, P.hi); tg.addColorStop(0.45, P.mid); tg.addColorStop(1, P.lo);
  ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(0, top, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, top, rx - 3.5, ry - 3, 0, Math.PI * 1.02, Math.PI * 1.7); ctx.stroke();   // lit rim, upper left
  const dome = ctx.createRadialGradient(-7, top - 11, 1, 0, top - 3, 22); dome.addColorStop(0, P.hi); dome.addColorStop(0.5, P.mid); dome.addColorStop(1, P.lo);   // the raised dome
  ctx.fillStyle = dome; ctx.beginPath(); ctx.ellipse(0, top - 3, 21, 11.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.36)'; mark(ctx, seat, 0.8, top - 1.4, 8.4); ctx.fill();                  // engraved mark: shadow, then light
  ctx.fillStyle = P.hi; mark(ctx, seat, 0, top - 2.4, 8); ctx.globalAlpha = 0.78; ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(-12, top - 9, 7.5, 3.2, -0.5, 0, TAU); ctx.fill();   // specular
}
const spriteCache = new Map();
function sprite(seat, style, cellPx) {
  const q = Math.max(24, Math.ceil(cellPx / 8) * 8), key = `${seat}|${style}|${q}`;
  let s = spriteCache.get(key);
  if (s === undefined) {
    s = null; const u = q / 100, m = mk(120 * u, 130 * u);
    if (m) { m.x.save(); m.x.translate(60 * u, 70 * u); m.x.scale(u, u); paintPeg(m.x, seat, style); m.x.restore(); s = m.c; }
    spriteCache.set(key, s); if (spriteCache.size > 60) spriteCache.delete(spriteCache.keys().next().value);
  }
  return s;
}
let blobC;
export function blob(ctx, x, y, rx, ry, a) {
  if (blobC === undefined) { blobC = null; const m = mk(128, 128); if (m) { const g = m.x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); m.x.fillStyle = g; m.x.fillRect(0, 0, 128, 128); blobC = m.c; } }
  const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a;
  if (blobC) ctx.drawImage(blobC, x - rx, y - ry, rx * 2, ry * 2);
  else { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y, rx * 0.7, ry * 0.7, 0, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = ga;
}

// Draws a peg standing on the cell centred (x, y). opts: { lift (0..1, in half-cells), alpha, scale, glow (0..1 halo), flash, shadow:false }
export function drawPeg(ctx, seat, style, x, y, cell, opts = {}) {
  const lift = opts.lift ?? 0, k = (cell / 100) * (opts.scale ?? 1);
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) {
    const gr = ctx.createRadialGradient(x, y + cell * 0.05, 0, x, y + cell * 0.05, cell * 0.78); gr.addColorStop(0, `rgba(${SEAT[seat].tint},${0.55 * opts.glow})`); gr.addColorStop(1, `rgba(${SEAT[seat].tint},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y + cell * 0.05, cell * 0.78, 0, TAU); ctx.fill();
  }
  if (opts.shadow !== false) {
    blob(ctx, x + cell * 0.03, y + cell * 0.3, cell * 0.42, cell * 0.1, 0.8 * (1 - lift * 0.8));
    blob(ctx, x + cell * (0.06 + lift * 0.1), y + cell * (0.24 + lift * 0.06), cell * (0.58 + lift * 0.1), cell * (0.22 + lift * 0.03), 0.5 - lift * 0.18);
  }
  ctx.translate(x, y - lift * cell * 0.3);
  const s = sprite(seat, style, cell * px() * (opts.scale ?? 1));
  if (s) ctx.drawImage(s, -60 * k, -70 * k, 120 * k, 130 * k);
  else { ctx.scale(k, k); paintPeg(ctx, seat, style); }
  if (opts.flash) { ctx.fillStyle = `rgba(255,255,255,${opts.flash})`; ctx.beginPath(); ctx.arc(0, 0, 32 * k, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// A little board for diagrams (Rules, How to Play): the real board colours and real pegs.
// spec: { rows: ['..1..', ...] (1-4 = a peg of that seat, . empty), camp: [[r,c,seat]...] tint, marks: [[r,c,'dot'|'hop'|'cross'|'target'|'star']], paths: [[[r,c],[r,c],...]], hl: [[r,c,color]] }
export function drawDiagram(ctx, spec, x, y, cellPx, boardKey = 'maple', style = 'lacquer') {
  const R = spec.rows.length, C = spec.rows[0].length, pal = BOARDS[boardKey] || BOARDS.maple, m = cellPx * 0.16, w = C * cellPx + 2 * m, h = R * cellPx + 2 * m;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 6, w, h, 8); ctx.fill();
  const fg = ctx.createLinearGradient(x, y, x + w, y + h); fg.addColorStop(0, pal.frame[0]); fg.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  const gx = x + m, gy = y + m;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { ctx.fillStyle = (r + c) % 2 ? pal.b : pal.a; ctx.fillRect(gx + c * cellPx, gy + r * cellPx, cellPx, cellPx); }
  for (const [r, c, s] of spec.camp || []) { ctx.fillStyle = `rgba(${SEAT[s].tint},0.45)`; ctx.fillRect(gx + c * cellPx, gy + r * cellPx, cellPx, cellPx); }
  for (const [r, c, col] of spec.hl || []) { ctx.fillStyle = col || 'rgba(255,236,150,0.55)'; ctx.fillRect(gx + c * cellPx, gy + r * cellPx, cellPx, cellPx); }
  ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1, cellPx * 0.03); ctx.beginPath();
  for (let i = 0; i <= R; i++) { ctx.moveTo(gx, gy + i * cellPx); ctx.lineTo(gx + C * cellPx, gy + i * cellPx); }
  for (let j = 0; j <= C; j++) { ctx.moveTo(gx + j * cellPx, gy); ctx.lineTo(gx + j * cellPx, gy + R * cellPx); }
  ctx.stroke();
  const at = (r, c) => ({ x: gx + (c + 0.5) * cellPx, y: gy + (r + 0.5) * cellPx });
  for (const path of spec.paths || []) {                                                         // a hop route: gold arcs with an arrowhead
    ctx.strokeStyle = 'rgba(214,120,10,0.95)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(2.5, cellPx * 0.08); ctx.lineCap = 'round';
    for (let i = 0; i + 1 < path.length; i++) {
      const a = at(path[i][0], path[i][1]), b = at(path[i + 1][0], path[i + 1][1]), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - cellPx * 0.45;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - cellPx * 0.1); ctx.quadraticCurveTo(mx, my, b.x, b.y - cellPx * 0.1); ctx.stroke();
      if (i === path.length - 2) { const ang = Math.atan2(b.y - my, b.x - mx), hd = cellPx * 0.2; ctx.beginPath(); ctx.moveTo(b.x, b.y - cellPx * 0.1); ctx.lineTo(b.x - Math.cos(ang - 0.5) * hd, b.y - cellPx * 0.1 - Math.sin(ang - 0.5) * hd); ctx.lineTo(b.x - Math.cos(ang + 0.5) * hd, b.y - cellPx * 0.1 - Math.sin(ang + 0.5) * hd); ctx.closePath(); ctx.fill(); }
    }
  }
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const ch = spec.rows[r][c], s = ch >= '1' && ch <= '4' ? +ch : 0;
    if (s) { const p = at(r, c); drawPeg(ctx, s, style, p.x, p.y, cellPx, { alpha: spec.dim && spec.dim.some((d) => d[0] === r && d[1] === c) ? 0.4 : 1 }); }
  }
  for (const [r, c, kind] of spec.marks || []) {
    const p = at(r, c); ctx.lineWidth = Math.max(2, cellPx * 0.07);
    if (kind === 'cross') { ctx.strokeStyle = '#d6291f'; const q = cellPx * 0.26; ctx.beginPath(); ctx.moveTo(p.x - q, p.y - q); ctx.lineTo(p.x + q, p.y + q); ctx.moveTo(p.x + q, p.y - q); ctx.lineTo(p.x - q, p.y + q); ctx.stroke(); }
    else if (kind === 'dot') { ctx.fillStyle = 'rgba(255,255,240,0.92)'; ctx.beginPath(); ctx.arc(p.x, p.y, cellPx * 0.14, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(60,40,10,0.55)'; ctx.stroke(); }
    else if (kind === 'hop') { ctx.strokeStyle = '#d6780a'; ctx.fillStyle = 'rgba(255,200,80,0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, cellPx * 0.3, 0, TAU); ctx.fill(); ctx.stroke(); }
    else if (kind === 'target') { ctx.strokeStyle = '#1f9e5a'; ctx.beginPath(); ctx.arc(p.x, p.y, cellPx * 0.34, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
  return { w, h };
}
export const diagramSize = (spec, cellPx) => ({ w: spec.rows[0].length * cellPx + cellPx * 0.32, h: spec.rows.length * cellPx + cellPx * 0.32 });
