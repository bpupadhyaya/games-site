// Static art: the table, the felt board, and the discs. One light, from the upper left.
// The board and the disc sprites are painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where
// OffscreenCanvas does not exist (headless tests) the same painters draw directly. Discs that are mid-flip are painted live.
import { host, boardCells } from './layout.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);

// ------------------------------------------------------------------------------------------------ cloths (board surface + frame)
export const CLOTHS = {
  emerald:  { name: 'Emerald', felt: ['#37a06a', '#278356', '#1a6a43'], nap: [200, 255, 220], shade: [4, 36, 20], frame: ['#6b4126', '#4e2d18', '#35200f'], edge: ['#43281a', '#1f120a'], grain: [30, 14, 6], line: 'rgba(3,32,18,0.62)', glow: 'rgba(150,255,200,0.30)' },
  midnight: { name: 'Midnight', felt: ['#3a6fb0', '#2b5791', '#1e426f'], nap: [190, 215, 255], shade: [6, 20, 44], frame: ['#2f2c34', '#211f26', '#15131a'], edge: ['#1b1a20', '#0a090d'], grain: [150, 160, 190], line: 'rgba(5,16,40,0.62)', glow: 'rgba(160,200,255,0.30)' },
  wine:     { name: 'Wine', felt: ['#ad3c52', '#8b2b40', '#6a1d2f'], nap: [255, 205, 215], shade: [44, 6, 16], frame: ['#5a3a22', '#3f2515', '#2a170d'], edge: ['#35200f', '#160b05'], grain: [20, 8, 2], line: 'rgba(44,6,16,0.6)', glow: 'rgba(255,190,205,0.30)' },
};
export const CLOTH_KEYS = ['emerald', 'midnight', 'wine'];

// ------------------------------------------------------------------------------------------------ the table
export function drawTable(ctx, L, t = 0) {
  const { w, h } = L;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#102226'); bg.addColorStop(0.5, '#0a171b'); bg.addColorStop(1, '#050b0e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const b = L.board, cx = b ? b.x + b.S / 2 : w / 2, cy = b ? b.y + b.S / 2 : h / 2, rad = Math.max(w, h) * 0.62;
  const lamp = ctx.createRadialGradient(cx - rad * 0.12, cy - rad * 0.2, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,226,170,0.20)'); lamp.addColorStop(0.45, 'rgba(255,200,130,0.05)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  // a faint lattice of fine rings, like an engraved tabletop
  ctx.strokeStyle = 'rgba(120,230,200,0.022)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = -h; x < w; x += 14) { ctx.moveTo(x, 0); ctx.lineTo(x + h, h); }
  for (let x = 0; x < w + h; x += 14) { ctx.moveTo(x, 0); ctx.lineTo(x - h, h); }
  ctx.stroke();
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one cell = 100 and the slab's top-left corner is (0,0): width 100*OUT, height 100*(OUT+0.22).
const SLAB = 22;
function paintBoard(ctx, cloth, n) {
  const OUT = boardCells(n), W = OUT * 100, H = W, pal = CLOTHS[cloth] || CLOTHS.emerald, rnd = lcg(11 + cloth.length * 31 + n);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  // contact shadow on the table
  for (let k = 5; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.07 + (5 - k) * 0.012})`; rr(-4 * k + 10, 8 + SLAB - 2 + 2 * k, W + 8 * k - 12, H + 4 * k, 26 + 4 * k); ctx.fill(); }
  // front of the slab (thickness)
  const sg = ctx.createLinearGradient(0, H - 20, 0, H + SLAB); sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
  ctx.fillStyle = sg; rr(0, 20, W, H - 20 + SLAB, 18); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,180,0.16)'; ctx.fillRect(14, H + 1, W - 28, 2.5);
  // the frame
  const tg = ctx.createLinearGradient(0, 0, W, H); tg.addColorStop(0, pal.frame[0]); tg.addColorStop(0.5, pal.frame[1]); tg.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = tg; rr(0, 0, W, H, 18); ctx.fill();
  ctx.save(); rr(0, 0, W, H, 18); ctx.clip();
  for (let k = 0; k < 110; k++) {                                              // wood grain
    const y = rnd() * H, a = 0.04 + rnd() * 0.08, dark = rnd() < 0.62;
    ctx.strokeStyle = dark ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})` : `rgba(255,235,205,${a * 0.5})`; ctx.lineWidth = 0.8 + rnd() * 2.2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 16, W * 0.7, y + (rnd() - 0.5) * 16, W, y + (rnd() - 0.5) * 10); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,236,200,0.30)'; ctx.lineWidth = 3; rr(2, 2, W - 4, H - 4, 16); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; rr(5, 5, W - 10, H - 10, 14); ctx.stroke();
  // brass inlay line round the playing surface, with a small diamond at each corner
  ctx.strokeStyle = 'rgba(232,196,106,0.85)'; ctx.lineWidth = 3; rr(21, 21, W - 42, H - 42, 8); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,245,200,0.35)'; ctx.lineWidth = 1; rr(19.5, 19.5, W - 39, H - 39, 9); ctx.stroke();
  ctx.fillStyle = '#e8c46a';
  for (const [dx, dy] of [[21, 21], [W - 21, 21], [21, H - 21], [W - 21, H - 21]]) { ctx.beginPath(); ctx.moveTo(dx, dy - 9); ctx.lineTo(dx + 9, dy); ctx.lineTo(dx, dy + 9); ctx.lineTo(dx - 9, dy); ctx.closePath(); ctx.fill(); }
  // the felt, sunk into the frame
  const f = 55, gx = f, gy = f, G = n * 100;
  const pg = ctx.createLinearGradient(gx, gy, gx + G, gy + G); pg.addColorStop(0, pal.felt[0]); pg.addColorStop(0.55, pal.felt[1]); pg.addColorStop(1, pal.felt[2]);
  ctx.fillStyle = pg; rr(gx - 10, gy - 10, G + 20, G + 20, 6); ctx.fill();
  ctx.save(); rr(gx - 10, gy - 10, G + 20, G + 20, 6); ctx.clip();
  // felt nap: thousands of tiny light and dark specks
  for (let k = 0; k < 2600; k++) {
    const x = gx - 10 + rnd() * (G + 20), y = gy - 10 + rnd() * (G + 20), light = rnd() < 0.5, a = 0.025 + rnd() * 0.07;
    ctx.fillStyle = light ? `rgba(${pal.nap[0]},${pal.nap[1]},${pal.nap[2]},${a})` : `rgba(${pal.shade[0]},${pal.shade[1]},${pal.shade[2]},${a * 1.3})`;
    ctx.fillRect(x, y, 1.6 + rnd() * 2.4, 1.1 + rnd() * 1.4);
  }
  // soft pool of light and darker edges
  const pool = ctx.createRadialGradient(gx + G * 0.4, gy + G * 0.35, G * 0.05, gx + G * 0.5, gy + G * 0.5, G * 0.8);
  pool.addColorStop(0, 'rgba(255,255,230,0.05)'); pool.addColorStop(0.6, 'rgba(255,255,230,0)'); pool.addColorStop(1, `rgba(${pal.shade[0]},${pal.shade[1]},${pal.shade[2]},0.35)`);
  ctx.fillStyle = pool; ctx.fillRect(gx - 10, gy - 10, G + 20, G + 20);
  const is = ctx.createLinearGradient(0, gy - 10, 0, gy + 46); is.addColorStop(0, 'rgba(0,0,0,0.42)'); is.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = is; ctx.fillRect(gx - 10, gy - 10, G + 20, 56);
  const il = ctx.createLinearGradient(gx - 10, 0, gx + 46, 0); il.addColorStop(0, 'rgba(0,0,0,0.34)'); il.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = il; ctx.fillRect(gx - 10, gy - 10, 56, G + 20);
  const ib = ctx.createLinearGradient(0, gy + G + 10, 0, gy + G - 30); ib.addColorStop(0, 'rgba(255,255,230,0.18)'); ib.addColorStop(1, 'rgba(255,255,230,0)'); ctx.fillStyle = ib; ctx.fillRect(gx - 10, gy + G - 30, G + 20, 40);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2.5; rr(gx - 10, gy - 10, G + 20, G + 20, 6); ctx.stroke();
  // grid: engraved lines (dark line, light line a hair below)
  ctx.lineCap = 'round';
  for (const [off, col, lw] of [[1.6, pal.glow, 1.6], [0, pal.line, 3.4]]) {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
    for (let i = 0; i <= n; i++) { ctx.moveTo(gx, gy + i * 100 + off); ctx.lineTo(gx + G, gy + i * 100 + off); ctx.moveTo(gx + i * 100 + off, gy); ctx.lineTo(gx + i * 100 + off, gy + G); }
    ctx.stroke();
  }
  // brass studs at the four inner crossings
  const q = n === 8 ? [2, 6] : [2, 4];
  for (const i of q) for (const j of q) {
    const sx = gx + i * 100, sy = gy + j * 100, sgd = ctx.createRadialGradient(sx - 2, sy - 2, 0, sx, sy, 10); sgd.addColorStop(0, '#fff3c0'); sgd.addColorStop(0.5, '#e8c46a'); sgd.addColorStop(1, '#8a6a22');
    ctx.fillStyle = sgd; ctx.beginPath(); ctx.arc(sx, sy, 8.5, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  const lg = ctx.createLinearGradient(0, 0, W, H); lg.addColorStop(0, 'rgba(255,245,215,0.07)'); lg.addColorStop(0.5, 'rgba(255,245,215,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = lg; rr(0, 0, W, H, 18); ctx.fill();
}
const boardCache = new Map();
export function drawBoard(ctx, b, cloth = 'emerald', n = 8) {
  const OUT = boardCells(n), k = b.S / (OUT * 100), P = px(), wpx = Math.min(2300, Math.ceil(b.S * P / 64) * 64);
  const key = cloth + '|' + n + '|' + wpx;
  let layer = boardCache.get(key);
  if (layer === undefined) {
    layer = null;
    const u = wpx / (OUT * 100), m = mk(wpx + 8, (OUT * 100 + SLAB + 40) * u + 8);
    if (m) { m.x.save(); m.x.translate(4, 4); m.x.scale(u, u); paintBoard(m.x, cloth, n); m.x.restore(); layer = { c: m.c, u }; }
    boardCache.set(key, layer); if (boardCache.size > 8) boardCache.delete(boardCache.keys().next().value);
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
  if (layer) ctx.drawImage(layer.c, -4 / layer.u, -4 / layer.u, layer.c.width / layer.u, layer.c.height / layer.u);
  else paintBoard(ctx, cloth, n);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ discs
// A thick lacquered disc seen from above and a little in front. Local units: one cell = 100, origin at the disc's centre on the felt.
export const DISC_STYLES = {
  gloss: { name: 'Jet and pearl', 1: { hi: '#5a626e', mid: '#1f242b', lo: '#07090c', side: '#05070a', rim: 'rgba(210,225,255,0.45)', ring: 'rgba(255,255,255,0.10)' }, 2: { hi: '#ffffff', mid: '#f1ede2', lo: '#c9c2af', side: '#9d967f', rim: 'rgba(255,255,255,0.9)', ring: 'rgba(120,100,60,0.18)' } },
  coral: { name: 'Coral and ivory', 1: { hi: '#ff8a70', mid: '#d6442f', lo: '#8f1d12', side: '#611008', rim: 'rgba(255,220,200,0.55)', ring: 'rgba(255,255,255,0.14)' }, 2: { hi: '#fffdf2', mid: '#efe3c4', lo: '#c9b88c', side: '#8f7f56', rim: 'rgba(255,255,255,0.9)', ring: 'rgba(120,90,40,0.2)' } },
};
export const STYLE_KEYS = ['gloss', 'coral'];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const RAD = 41, DEPTH = 10, FOR = 0.9;          // radius, thickness, foreshortening of the top face (1 = seen from straight above)

// Paints a disc. sy = how flat the top face is squashed (1 resting, 0 edge-on), dy = vertical offset of the face above its resting place.
function paintDisc(ctx, side, style, sy = 1, withEdge = true) {
  const pal = (DISC_STYLES[style] || DISC_STYLES.gloss)[side], ry = RAD * FOR * Math.max(0.03, sy);
  const top = -DEPTH * 0.5 * Math.max(0.15, sy);                                   // the face sits above the centre by half the thickness
  ctx.lineJoin = 'round';
  if (withEdge) {                                                                    // the rim, swept from the face down to the base, lit from above
    const base = DEPTH * 0.5 + (1 - Math.max(0.15, sy)) * DEPTH * 1.0, rgb = hex(pal.side), span = Math.max(1, base - top);
    for (let d = base; d >= top; d -= 1) {
      const f = 1.55 - 1.05 * ((d - top) / span);
      ctx.fillStyle = `rgb(${Math.min(255, rgb[0] * f) | 0},${Math.min(255, rgb[1] * f) | 0},${Math.min(255, rgb[2] * f) | 0})`;
      ctx.beginPath(); ctx.ellipse(0, d, RAD, ry, 0, 0, TAU); ctx.fill();
    }
  }
  // the top face
  const g = ctx.createRadialGradient(-RAD * 0.35, top - ry * 0.4, RAD * 0.05, 0, top, RAD * 1.1);
  g.addColorStop(0, pal.hi); g.addColorStop(0.55, pal.mid); g.addColorStop(1, pal.lo);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, top, RAD, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
  if (sy < 0.2) return;
  // a bevelled rim: lit upper left, dark lower right
  const bg = ctx.createLinearGradient(-RAD, top - ry, RAD, top + ry); bg.addColorStop(0, pal.rim); bg.addColorStop(0.5, 'rgba(255,255,255,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.strokeStyle = bg; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, top, RAD - 2.2, ry - 2.2 * FOR, 0, 0, TAU); ctx.stroke();
  // the shallow dish in the face
  ctx.strokeStyle = pal.ring; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, top, RAD * 0.62, ry * 0.62, 0, 0, TAU); ctx.stroke();
  // specular glint
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, top, RAD - 3, ry - 3, 0, 0, TAU); ctx.clip();
  const sp = ctx.createRadialGradient(-RAD * 0.38, top - ry * 0.5, 0, -RAD * 0.38, top - ry * 0.5, RAD * 0.7);
  sp.addColorStop(0, `rgba(255,255,255,${side === 1 ? 0.5 : 0.7})`); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.fillRect(-RAD, top - ry, RAD * 2, ry * 2);
  const lower = ctx.createLinearGradient(0, top - ry, 0, top + ry); lower.addColorStop(0.5, 'rgba(0,0,0,0)'); lower.addColorStop(1, side === 1 ? 'rgba(120,150,200,0.18)' : 'rgba(90,70,30,0.14)');
  ctx.fillStyle = lower; ctx.fillRect(-RAD, top - ry, RAD * 2, ry * 2);
  ctx.restore();
}
const spriteCache = new Map();
function sprite(side, style, cellPx) {
  const q = Math.max(24, Math.ceil(cellPx / 8) * 8), key = `${side}|${style}|${q}`;
  let s = spriteCache.get(key);
  if (s === undefined) {
    s = null; const u = q / 100, m = mk(110 * u, 100 * u);
    if (m) { m.x.save(); m.x.translate(55 * u, 52 * u); m.x.scale(u, u); paintDisc(m.x, side, style, 1, true); m.x.restore(); s = m.c; }
    spriteCache.set(key, s); if (spriteCache.size > 24) spriteCache.delete(spriteCache.keys().next().value);
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

// A resting disc on the cell centred (x, y). opts: { alpha, scale, glow (0..1 light halo), lift (0..1 half-cells) }
export function drawDisc(ctx, side, style, x, y, cell, opts = {}) {
  const lift = opts.lift ?? 0, k = (cell / 100) * (opts.scale ?? 1);
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  blob(ctx, x + cell * 0.02, y + cell * 0.1, cell * 0.5, cell * 0.2, 0.7 * (1 - lift * 0.5));
  blob(ctx, x + cell * (0.05 + lift * 0.1), y + cell * (0.16 + lift * 0.1), cell * (0.58 + lift * 0.1), cell * (0.26), 0.45 - lift * 0.15);
  if (opts.glow) { ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(x, y - lift * cell * 0.3, cell * 0.2, x, y - lift * cell * 0.3, cell * 0.8); gr.addColorStop(0, `rgba(255,236,170,${0.5 * opts.glow})`); gr.addColorStop(1, 'rgba(255,236,170,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - lift * cell * 0.3, cell * 0.8, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
  ctx.translate(x, y - lift * cell * 0.3);
  const s = sprite(side, style, cell * px() * (opts.scale ?? 1));
  if (s) ctx.drawImage(s, -55 * k, -52 * k, 110 * k, 100 * k);
  else { ctx.scale(k, k); paintDisc(ctx, side, style, 1, true); }
  ctx.restore();
}

// A disc turning over. from/to = the sides; f = 0..1 progress. The disc rises, turns end over end (its face squashes and switches colour at the middle) and settles.
export function drawFlip(ctx, from, to, style, x, y, cell, f, opts = {}) {
  const th = f * Math.PI, c = Math.cos(th), s = Math.abs(Math.sin(th)), side = c >= 0 ? from : to, sy = Math.abs(c);
  const h = Math.sin(th) * (opts.height ?? 1);                                       // 0..1..0 rise
  const k = cell / 100;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  blob(ctx, x + cell * 0.02, y + cell * 0.1, cell * 0.5 * (1 - 0.18 * h), cell * 0.2, 0.7 - 0.25 * h);
  blob(ctx, x + cell * (0.05 + h * 0.08), y + cell * (0.16 + h * 0.06), cell * 0.6, cell * 0.26, 0.45 - 0.15 * h);
  ctx.translate(x, y - h * cell * 0.42); ctx.scale(k * (1 + 0.1 * h), k * (1 + 0.1 * h));
  paintDisc(ctx, side, style, sy, true);
  if (s > 0.15) { ctx.globalAlpha *= Math.min(1, s) * 0.5; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -DEPTH * 0.5 * Math.max(0.15, sy), RAD, RAD * FOR * Math.max(0.03, sy), 0, 0, TAU); ctx.globalCompositeOperation = 'soft-light'; ctx.fill(); }
  ctx.restore();
}

// A little board for diagrams (Rules, How to Play, lessons): a crop of the real felt with real discs.
// spec: { rows: ['..B..', ...] (B black, W white, . empty), marks: [[r,c,'ring'|'dot'|'cross'|'target']], hl: [[r,c]], arrows: [[r0,c0,r1,c1]] }
export function drawDiagram(ctx, spec, x, y, cellPx, cloth = 'emerald', style = 'gloss') {
  const R = spec.rows.length, C = spec.rows[0].length, pal = CLOTHS[cloth] || CLOTHS.emerald, m = cellPx * 0.18;
  const w = C * cellPx + 2 * m, h = R * cellPx + 2 * m;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 6, w, h, 10); ctx.fill();
  const fg = ctx.createLinearGradient(x, y, x + w, y + h); fg.addColorStop(0, pal.frame[0]); fg.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  const gx = x + m, gy = y + m, gw = C * cellPx, gh = R * cellPx;
  const g = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh); g.addColorStop(0, pal.felt[0]); g.addColorStop(0.6, pal.felt[1]); g.addColorStop(1, pal.felt[2]);
  ctx.fillStyle = g; ctx.fillRect(gx, gy, gw, gh);
  ctx.strokeStyle = 'rgba(232,196,106,0.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(gx - 1, gy - 1, gw + 2, gh + 2);
  (spec.hl || []).forEach(([r, c, col]) => { ctx.fillStyle = col || 'rgba(255,236,150,0.4)'; ctx.fillRect(gx + c * cellPx, gy + r * cellPx, cellPx, cellPx); });
  ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1.2, cellPx * 0.035); ctx.beginPath();
  for (let i = 0; i <= R; i++) { ctx.moveTo(gx, gy + i * cellPx); ctx.lineTo(gx + gw, gy + i * cellPx); }
  for (let j = 0; j <= C; j++) { ctx.moveTo(gx + j * cellPx, gy); ctx.lineTo(gx + j * cellPx, gy + gh); }
  ctx.stroke();
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const ch = spec.rows[r][c];
    if (ch === 'B' || ch === 'W') drawDisc(ctx, ch === 'B' ? 1 : 2, style, gx + (c + 0.5) * cellPx, gy + (r + 0.5) * cellPx, cellPx, { alpha: spec.dim && spec.dim.some((d) => d[0] === r && d[1] === c) ? 0.4 : 1 });
  }
  for (const [r, c, kind] of spec.marks || []) {
    const cx = gx + (c + 0.5) * cellPx, cy = gy + (r + 0.5) * cellPx;
    ctx.lineWidth = Math.max(2, cellPx * 0.07);
    if (kind === 'cross') { ctx.strokeStyle = '#ff5a44'; const q = cellPx * 0.26; ctx.beginPath(); ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q); ctx.moveTo(cx + q, cy - q); ctx.lineTo(cx - q, cy + q); ctx.stroke(); }
    else if (kind === 'ring') { ctx.strokeStyle = '#ffe07a'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.34, 0, TAU); ctx.stroke(); }
    else if (kind === 'dot') { ctx.fillStyle = 'rgba(255,240,170,0.9)'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.14, 0, TAU); ctx.fill(); }
    else if (kind === 'target') { ctx.strokeStyle = '#ffe07a'; ctx.setLineDash([cellPx * 0.12, cellPx * 0.1]); ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.36, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  }
  for (const a of spec.arrows || []) {
    const [r0, c0, r1, c1] = a, x0 = gx + (c0 + 0.5) * cellPx, y0 = gy + (r0 + 0.5) * cellPx, x1 = gx + (c1 + 0.5) * cellPx, y1 = gy + (r1 + 0.5) * cellPx, ang = Math.atan2(y1 - y0, x1 - x0), hd = cellPx * 0.22;
    ctx.strokeStyle = 'rgba(255,224,122,0.95)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(3, cellPx * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0 + Math.cos(ang) * cellPx * 0.3, y0 + Math.sin(ang) * cellPx * 0.3); ctx.lineTo(x1 - Math.cos(ang) * hd, y1 - Math.sin(ang) * hd); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(ang - 0.45) * hd * 1.4, y1 - Math.sin(ang - 0.45) * hd * 1.4); ctx.lineTo(x1 - Math.cos(ang + 0.45) * hd * 1.4, y1 - Math.sin(ang + 0.45) * hd * 1.4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  return { w, h };
}
export const diagramSize = (spec, cellPx) => ({ w: spec.rows[0].length * cellPx + cellPx * 0.36, h: spec.rows.length * cellPx + cellPx * 0.36 });
