// Static art: the table, the sand board, and the carved stones. One light, from the upper left.
// The board and the stone sprites are painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where
// OffscreenCanvas does not exist (headless tests) the same painters draw directly.
import { host, FRAME } from './layout.js';
import { v3, sprites } from './v3.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);

// ------------------------------------------------------------------------------------------------ surfaces
export const SURFACES = {
  sand:  { name: 'Sand', top: ['#efdba9', '#e2c68c', '#d1ab6b'], grain: [128, 88, 40], frame: ['#c08c52', '#9c6c34', '#704c22'], edge: ['#80582a', '#47300f'], line: '#5c3d19' },
  clay:  { name: 'Clay', top: ['#e2a174', '#d08a5e', '#b9714a'], grain: [110, 52, 30], frame: ['#a8553a', '#823d27', '#582616'], edge: ['#6e3322', '#3a1a10'], line: '#4a2012' },
  slate: { name: 'Night slate', top: ['#aebcc2', '#94a5ae', '#7a8d98'], grain: [28, 50, 62], frame: ['#566670', '#3f4d57', '#28343c'], edge: ['#2e3a43', '#161e24'], line: '#1e2a32' },
};
export const SURFACE_KEYS = ['sand', 'clay', 'slate'];

// ------------------------------------------------------------------------------------------------ the table
export function drawTable(ctx, L, t = 0) {
  const { w, h } = L;
  if (v3.on) {                              // the 3D scene is behind this canvas: only a soft edge vignette here
    const vg0 = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    vg0.addColorStop(0, 'rgba(10,4,16,0)'); vg0.addColorStop(1, 'rgba(10,4,16,0.42)');
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = vg0; ctx.fillRect(0, 0, w, h);
    return;
  }
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#3b2315'); bg.addColorStop(0.55, '#26150c'); bg.addColorStop(1, '#130a05');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // a lamp: warm pool of light centred on the board
  const b = L.board, cx = b ? b.x + b.S / 2 : w / 2, cy = b ? b.y + b.S / 2 : h / 2, rad = Math.max(w, h) * 0.62;
  const lamp = ctx.createRadialGradient(cx - rad * 0.12, cy - rad * 0.2, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,196,120,0.24)'); lamp.addColorStop(0.45, 'rgba(255,160,90,0.07)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  // dune ripples: a few long soft curves across the table
  ctx.strokeStyle = 'rgba(255,214,150,0.035)'; ctx.lineWidth = 2;
  for (let k = 0; k < 9; k++) {
    const y0 = (k + 0.5) * h / 9;
    ctx.beginPath(); ctx.moveTo(-10, y0);
    for (let x = 0; x <= w + 20; x += 40) ctx.lineTo(x, y0 + Math.sin(x * 0.011 + k * 1.7) * 14 + Math.sin(x * 0.027 + k) * 5);
    ctx.stroke();
  }
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one cell = 100 and the slab's top-left corner is (0,0): width 100*OUT, height 100*OUT + SLAB.
// The points sit at the centres of the n x n cells; the lines run from point to point.
const SLAB = 22;
export function boardLines(n, alq, fn) {         // calls fn(r0, c0, r1, c1) once per line of the net
  for (let r = 0; r < n; r++) fn(r, 0, r, n - 1);
  for (let c = 0; c < n; c++) fn(0, c, n - 1, c);
  for (let k = -(n - 1); k <= n - 1; k++) {       // diagonals r - c = k
    if (alq && (k & 1)) continue;
    const r0 = Math.max(0, k), c0 = r0 - k, len = n - Math.abs(k);
    if (len >= 2) fn(r0, c0, r0 + len - 1, c0 + len - 1);
  }
  for (let s = 1; s <= 2 * (n - 1) - 1; s++) {    // anti-diagonals r + c = s
    if (alq && (s & 1)) continue;
    const r0 = Math.min(s, n - 1), c0 = s - r0, len = Math.min(s, 2 * (n - 1) - s) + 1;
    if (len >= 2) fn(r0, c0, r0 - len + 1, c0 + len - 1);
  }
}
function paintBoard(ctx, surface, n, alq) {
  const OUT = n + 2 * FRAME, W = OUT * 100, H = W, pal = SURFACES[surface] || SURFACES.sand, rnd = lcg(11 + surface.length * 31 + n);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  ctx.save();
  for (let k = 5; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.07 + (5 - k) * 0.012})`; rr(-4 * k + 10, 8 + SLAB - 2 + 2 * k, W + 8 * k - 12, H + 4 * k, 26 + 4 * k); ctx.fill(); }
  ctx.restore();
  const sg = ctx.createLinearGradient(0, H - 20, 0, H + SLAB);
  sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
  ctx.fillStyle = sg; rr(0, 20, W, H - 20 + SLAB, 16); ctx.fill();
  ctx.fillStyle = 'rgba(255,225,170,0.18)'; ctx.fillRect(14, H + 1, W - 28, 2.5);
  const tg = ctx.createLinearGradient(0, 0, W, H);
  tg.addColorStop(0, pal.frame[0]); tg.addColorStop(0.5, pal.frame[1]); tg.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = tg; rr(0, 0, W, H, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,232,190,0.35)'; ctx.lineWidth = 3; rr(2, 2, W - 4, H - 4, 14); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; rr(5, 5, W - 10, H - 10, 12); ctx.stroke();
  // frame: sandstone speckle
  ctx.save(); rr(0, 0, W, H, 16); ctx.clip();
  for (let k = 0; k < 900; k++) {
    const x = rnd() * W, y = rnd() * H, s = 0.8 + rnd() * 2.2, dark = rnd() < 0.55;
    ctx.fillStyle = dark ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${0.08 + rnd() * 0.16})` : `rgba(255,236,200,${0.05 + rnd() * 0.12})`;
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
  const f = FRAME * 100, gx = f, gy = f, G = n * 100;
  // a carved band of triangles round the frame, the Saharan way
  {
    ctx.save(); rr(0, 0, W, H, 16); ctx.clip();
    const tri = (cx, cy, up, horiz) => {
      const s = 9;
      ctx.beginPath();
      if (horiz) { ctx.moveTo(cx - s, cy + (up ? s * 0.8 : -s * 0.8)); ctx.lineTo(cx + s, cy + (up ? s * 0.8 : -s * 0.8)); ctx.lineTo(cx, cy + (up ? -s * 0.8 : s * 0.8)); }
      else { ctx.moveTo(cx + (up ? s * 0.8 : -s * 0.8), cy - s); ctx.lineTo(cx + (up ? s * 0.8 : -s * 0.8), cy + s); ctx.lineTo(cx + (up ? -s * 0.8 : s * 0.8), cy); }
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,230,180,0.30)'; ctx.lineWidth = 1.2; ctx.stroke();
    };
    const step = 26, mid = f / 2;
    for (let x = f + 4; x < W - f; x += step) { const up = ((x - f) / step | 0) % 2 === 0; tri(x, mid, up, true); tri(x, H - mid, !up, true); }
    for (let y = f + 4; y < H - f; y += step) { const up = ((y - f) / step | 0) % 2 === 0; tri(mid, y, up, false); tri(W - mid, y, !up, false); }
    ctx.restore();
  }
  // the sunken playing surface
  const pg = ctx.createLinearGradient(gx, gy, gx + G, gy + G);
  pg.addColorStop(0, pal.top[0]); pg.addColorStop(0.55, pal.top[1]); pg.addColorStop(1, pal.top[2]);
  ctx.fillStyle = pg; rr(gx - 10, gy - 10, G + 20, G + 20, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2.5; rr(gx - 10, gy - 10, G + 20, G + 20, 6); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,200,0.4)'; ctx.lineWidth = 1.5; rr(gx - 8.5, gy - 8.5, G + 17, G + 17, 5); ctx.stroke();
  ctx.save(); rr(gx - 10, gy - 10, G + 20, G + 20, 6); ctx.clip();
  // wind ripples and grains of sand
  for (let k = 0; k < 70; k++) {
    const y = gy - 10 + rnd() * (G + 20), a = 0.03 + rnd() * 0.06, amp = 3 + rnd() * 8, ph = rnd() * 6, fr = 0.006 + rnd() * 0.01;
    ctx.strokeStyle = rnd() < 0.6 ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})` : `rgba(255,244,215,${a * 1.3})`; ctx.lineWidth = 1 + rnd() * 2;
    ctx.beginPath(); ctx.moveTo(gx - 10, y);
    for (let x = gx - 10; x <= gx + G + 10; x += 30) ctx.lineTo(x, y + Math.sin(x * fr + ph) * amp);
    ctx.stroke();
  }
  for (let k = 0; k < 2600; k++) {
    const x = gx - 10 + rnd() * (G + 20), y = gy - 10 + rnd() * (G + 20), s = 0.7 + rnd() * 1.6;
    ctx.fillStyle = rnd() < 0.5 ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${0.08 + rnd() * 0.2})` : `rgba(255,248,226,${0.1 + rnd() * 0.25})`;
    ctx.fillRect(x, y, s, s);
  }
  const is = ctx.createLinearGradient(0, gy - 10, 0, gy + 40); is.addColorStop(0, 'rgba(0,0,0,0.34)'); is.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = is; ctx.fillRect(gx - 10, gy - 10, G + 20, 50);
  const il = ctx.createLinearGradient(gx - 10, 0, gx + 40, 0); il.addColorStop(0, 'rgba(0,0,0,0.27)'); il.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = il; ctx.fillRect(gx - 10, gy - 10, 50, G + 20);
  const ib = ctx.createLinearGradient(0, gy + G + 10, 0, gy + G - 30); ib.addColorStop(0, 'rgba(255,240,200,0.28)'); ib.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = ib; ctx.fillRect(gx - 10, gy + G - 30, G + 20, 40);
  ctx.restore();
  // the lines, scratched into the sand: a dark groove with a light lip below and to the right
  const P = (r, c) => [gx + (c + 0.5) * 100, gy + (r + 0.5) * 100];
  ctx.lineCap = 'round';
  const stroke = (dx, dy, col, w) => {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
    boardLines(n, alq, (r0, c0, r1, c1) => { const a = P(r0, c0), b = P(r1, c1); ctx.moveTo(a[0] + dx, a[1] + dy); ctx.lineTo(b[0] + dx, b[1] + dy); });
    ctx.stroke();
  };
  stroke(1.6, 2, 'rgba(255,244,214,0.55)', 5);
  stroke(0, 0, pal.line, 4.2);
  stroke(-0.4, -0.5, 'rgba(0,0,0,0.35)', 1.6);
  // a hollow at every point
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const [x, y] = P(r, c), hg = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 13);
    hg.addColorStop(0, 'rgba(0,0,0,0.55)'); hg.addColorStop(0.7, 'rgba(0,0,0,0.28)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,244,214,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 9.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  // the centre point, where the game opens, carries a ring
  { const [x, y] = P((n - 1) / 2, (n - 1) / 2); ctx.strokeStyle = pal.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 24, 0, TAU); ctx.stroke(); ctx.strokeStyle = 'rgba(255,244,214,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + 1, y + 1.5, 24, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke(); }
  const lg = ctx.createLinearGradient(0, 0, W, H);
  lg.addColorStop(0, 'rgba(255,245,215,0.16)'); lg.addColorStop(0.5, 'rgba(255,245,215,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = lg; rr(0, 0, W, H, 16); ctx.fill();
}
const boardCache = new Map();
export function drawBoard(ctx, b, surface = 'sand', n = 5, alq = false) {
  // b: board geometry from layout (x, y, S). Painted layer is cached per (surface, size, pixel size bucket).
  const OUT = n + 2 * FRAME, k = b.S / (OUT * 100), P = px(), wpx = Math.min(2300, Math.ceil(b.S * P / 64) * 64);
  const key = `${surface}|${n}|${alq ? 1 : 0}|${wpx}`;
  let layer = boardCache.get(key);
  if (layer === undefined) {
    layer = null;
    const u = wpx / (OUT * 100), m = mk(wpx + 8, (OUT * 100 + SLAB + 40) * u + 8);
    if (m) { m.x.save(); m.x.translate(4, 4); m.x.scale(u, u); paintBoard(m.x, surface, n, alq); m.x.restore(); layer = { c: m.c, u }; }
    boardCache.set(key, layer); if (boardCache.size > 8) boardCache.delete(boardCache.keys().next().value);
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
  if (layer) ctx.drawImage(layer.c, -4 / layer.u, -4 / layer.u, layer.c.width / layer.u, layer.c.height / layer.u);
  else paintBoard(ctx, surface, n, alq);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ stones
// A round carved stone with thickness. Local units: one cell = 100, origin at the cell centre. A man carries one incised ring;
// a Sultan carries an eight-pointed star inside two rings.
export const PIECE_STYLES = {
  stone: { name: 'Basalt and limestone', 1: { face: ['#5a5650', '#3a3733', '#222020'], side: '#121110', ink: '#e9d9b0', rim: 'rgba(255,240,210,0.30)' }, 2: { face: ['#fdf6e2', '#eadcb6', '#d3c196'], side: '#9d8a5c', ink: '#5e4a26', rim: 'rgba(255,255,255,0.7)' } },
  glaze: { name: 'Glazed ceramic', 1: { face: ['#4466c4', '#2a4399', '#172a66'], side: '#0c1638', ink: '#ffe4a0', rim: 'rgba(200,220,255,0.40)' }, 2: { face: ['#f0b46c', '#d98a42', '#b0642a'], side: '#6c3a16', ink: '#3a1d0a', rim: 'rgba(255,230,190,0.6)' } },
};
export const STYLE_KEYS = ['stone', 'glaze'];
const DEPTH = 15, RX = 37, RY = 33, CY = 7;                      // the footprint ellipse, centred (0, CY); the top face sits DEPTH higher
function paintStone(ctx, side, style, king) {
  const pal = (PIECE_STYLES[style] || PIECE_STYLES.stone)[side];
  const ty = CY - DEPTH;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = pal.side; ctx.strokeStyle = pal.side; ctx.lineWidth = 3;
  for (let d = DEPTH; d >= 0; d -= 1) { ctx.beginPath(); ctx.ellipse(0, ty + d, RX, RY, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
  const sh = ctx.createLinearGradient(0, ty, 0, CY + RY);
  sh.addColorStop(0, 'rgba(255,255,255,0.16)'); sh.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = sh; ctx.fillRect(-60, -70, 120, 150); ctx.restore();
  // top face
  const g = ctx.createLinearGradient(-RX, ty - RY, RX, ty + RY);
  g.addColorStop(0, pal.face[0]); g.addColorStop(0.5, pal.face[1]); g.addColorStop(1, pal.face[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, ty, RX, RY, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.6; ctx.stroke();
  { const bg = ctx.createLinearGradient(-RX, ty - RY, RX, ty + RY); bg.addColorStop(0, 'rgba(255,255,255,0.8)'); bg.addColorStop(0.45, pal.rim); bg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.strokeStyle = bg; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, ty, RX - 3, RY - 3, 0, 0, TAU); ctx.stroke(); }
  // stone texture
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, ty, RX, RY, 0, 0, TAU); ctx.clip();
  const r = lcg(side * 97 + (style === 'glaze' ? 5 : 1));
  for (let k = 0; k < 60; k++) { const x = (r() - 0.5) * 2 * RX, y = ty + (r() - 0.5) * 2 * RY, s = 0.8 + r() * 1.6; ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.14)'; ctx.fillRect(x, y, s, s); }
  const hl = ctx.createRadialGradient(-12, ty - 14, 0, -12, ty - 14, 30);
  hl.addColorStop(0, `rgba(255,255,255,${style === 'glaze' ? 0.6 : 0.34})`); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(-RX, ty - RY, RX * 2, RY * 2);
  const sd = ctx.createLinearGradient(-RX, 0, RX, 0); sd.addColorStop(0, 'rgba(255,255,255,0.06)'); sd.addColorStop(0.6, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,0.24)');
  ctx.fillStyle = sd; ctx.fillRect(-RX, ty - RY, RX * 2, RY * 2);
  ctx.restore();
  // carving: a dark cut with a light lip under it, so it reads as engraved
  const cut = (fn, w) => {
    ctx.save(); ctx.translate(0, ty);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = w; ctx.save(); ctx.translate(0.9, 1.4); fn(); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = side === 1 ? 'rgba(0,0,0,0.55)' : 'rgba(40,25,5,0.4)'; ctx.lineWidth = w; fn(); ctx.stroke();
    ctx.strokeStyle = pal.ink; ctx.globalAlpha = 0.75; ctx.lineWidth = w * 0.45; fn(); ctx.stroke();
    ctx.restore();
  };
  const ellipse = (k) => () => { ctx.beginPath(); ctx.ellipse(0, 0, RX * k, RY * k, 0, 0, TAU); };
  cut(ellipse(0.7), 3.2);
  if (king) {
    cut(ellipse(0.46), 2.6);
    cut(() => {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 8, rad = i % 2 ? 0.2 : 0.44; ctx.lineTo(Math.cos(a) * RX * rad, Math.sin(a) * RY * rad); }
      ctx.closePath();
    }, 2.2);
  } else {
    ctx.save(); ctx.translate(0, ty); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(0.8, 1.2, 5.5, 0, TAU); ctx.fill();
    ctx.fillStyle = side === 1 ? 'rgba(0,0,0,0.6)' : 'rgba(60,40,10,0.5)'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill(); ctx.restore();
  }
}
const spriteCache = new Map();
function sprite(side, style, king, cellPx) {
  const q = Math.max(24, Math.ceil(cellPx / 8) * 8), key = `${side}|${style}|${king ? 1 : 0}|${q}`;
  let s = spriteCache.get(key);
  if (s === undefined) {
    s = null; const u = q / 100, m = mk(120 * u, 140 * u);
    if (m) { m.x.save(); m.x.translate(60 * u, 80 * u); m.x.scale(u, u); paintStone(m.x, side, style, king); m.x.restore(); s = m.c; }
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

// Draws a stone standing on the point centred (x, y). opts: { king, lift (0..1, in half-cells), alpha, scale, glow, tilt, flash }
export function drawPiece(ctx, side, style, x, y, cell, opts = {}) {
  const lift = opts.lift ?? 0, k = (cell / 100) * (opts.scale ?? 1), king = !!opts.king;
  const spr = v3.on && sprites.ready ? sprites.stone[`${side}|${style}|${king ? 1 : 0}`] : null;
  if (spr) {                                  // 3D stone, rendered once from the real model
    ctx.save();
    if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
    if (opts.glow) blob(ctx, x, y + cell * 0.1, cell * 0.95, cell * 0.62, opts.glow);
    blob(ctx, x + cell * 0.04, y + cell * 0.24, cell * 0.42, cell * 0.1, 0.55 * (1 - lift * 0.7));
    const size = cell * 1.55 * (opts.scale ?? 1);
    ctx.translate(x, y - lift * cell * 0.3); if (opts.tilt) ctx.rotate(opts.tilt);
    ctx.drawImage(spr, -size / 2, -size * 0.58, size, size);
    if (opts.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= opts.flash; ctx.drawImage(spr, -size / 2, -size * 0.58, size, size); }
    ctx.restore(); return;
  }
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) blob(ctx, x, y + cell * 0.12, cell * 0.95, cell * 0.62, opts.glow);
  blob(ctx, x + cell * 0.03, y + cell * 0.3, cell * 0.42, cell * 0.085, 0.75 * (1 - lift * 0.8));
  blob(ctx, x + cell * (0.07 + lift * 0.12), y + cell * (0.2 + lift * 0.1), cell * (0.62 + lift * 0.1), cell * (0.26 + lift * 0.04), 0.55 - lift * 0.18);
  ctx.translate(x, y - lift * cell * 0.3);
  if (opts.tilt) ctx.rotate(opts.tilt);
  const s = sprite(side, style, king, cell * px() * (opts.scale ?? 1));
  if (s) ctx.drawImage(s, -60 * k, -80 * k, 120 * k, 140 * k);
  else { ctx.scale(k, k); paintStone(ctx, side, style, king); }
  if (opts.flash) { ctx.fillStyle = `rgba(255,255,255,${opts.flash})`; ctx.scale(k, k); ctx.beginPath(); ctx.ellipse(0, CY - DEPTH, RX, RY, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// A little board for diagrams (Rules, How to Play, lessons): a crop of the real board art with real stones.
// spec: { rows: ['..b..', ...] (b / w a Basalt / Limestone man, B / W a Sultan, . empty), diag: 'all' | 'alq' | undefined,
//         marks: [[r,c,'ring'|'cross'|'dot'|'target']], hl: [[r,c,colour]], arrows: [[r0,c0,r1,c1]] }
export function drawDiagram(ctx, spec, x, y, cellPx, surface = 'sand', style = 'stone') {
  const R = spec.rows.length, C = spec.rows[0].length, pal = SURFACES[surface] || SURFACES.sand, m = cellPx * 0.18;
  const w = C * cellPx + 2 * m, h = R * cellPx + 2 * m;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 6, w, h, 8); ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, pal.top[0]); g.addColorStop(0.6, pal.top[1]); g.addColorStop(1, pal.top[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  const gx = x + m, gy = y + m;
  (spec.hl || []).forEach(([r, c, col]) => { ctx.fillStyle = col || 'rgba(255,236,150,0.55)'; ctx.beginPath(); ctx.arc(gx + (c + 0.5) * cellPx, gy + (r + 0.5) * cellPx, cellPx * 0.46, 0, TAU); ctx.fill(); });
  ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1.4, cellPx * 0.04); ctx.lineCap = 'round'; ctx.beginPath();
  const at = (r, c) => [gx + (c + 0.5) * cellPx, gy + (r + 0.5) * cellPx];
  for (let r = 0; r < R; r++) { const a = at(r, 0), b = at(r, C - 1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  for (let c = 0; c < C; c++) { const a = at(0, c), b = at(R - 1, c); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  if (spec.diag) {
    const alq = spec.diag === 'alq';
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (alq && ((r + c) & 1)) continue;
      for (const [dr, dc] of [[1, 1], [1, -1]]) { const r2 = r + dr, c2 = c + dc; if (r2 < R && c2 >= 0 && c2 < C) { const a = at(r, c), b = at(r2, c2); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } }
    }
  }
  ctx.stroke();
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const ch = spec.rows[r][c], p = at(r, c);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(p[0], p[1], cellPx * 0.07, 0, TAU); ctx.fill();
    if (ch === 'b' || ch === 'w' || ch === 'B' || ch === 'W') drawPiece(ctx, ch === 'b' || ch === 'B' ? 1 : 2, style, p[0], p[1], cellPx, { king: ch === 'B' || ch === 'W', alpha: spec.dim && spec.dim.some((d) => d[0] === r && d[1] === c) ? 0.35 : 1 });
  }
  for (const [r, c, kind] of spec.marks || []) {
    const [cx, cy] = at(r, c);
    ctx.lineWidth = Math.max(2, cellPx * 0.07);
    if (kind === 'cross') { ctx.strokeStyle = '#d6291f'; const q = cellPx * 0.28; ctx.beginPath(); ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q); ctx.moveTo(cx + q, cy - q); ctx.lineTo(cx - q, cy + q); ctx.stroke(); }
    else if (kind === 'ring') { ctx.strokeStyle = '#1f8f5a'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.3, 0, TAU); ctx.stroke(); }
    else if (kind === 'dot') { ctx.fillStyle = 'rgba(20,140,110,0.9)'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.14, 0, TAU); ctx.fill(); }
    else if (kind === 'target') { ctx.strokeStyle = '#d6291f'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.34, 0, TAU); ctx.stroke(); }
  }
  for (const a of spec.arrows || []) {
    const [r0, c0, r1, c1] = a, p0 = at(r0, c0), p1 = at(r1, c1), ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), hd = cellPx * 0.22;
    ctx.strokeStyle = 'rgba(200,40,30,0.92)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(3, cellPx * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p0[0] + Math.cos(ang) * cellPx * 0.3, p0[1] + Math.sin(ang) * cellPx * 0.3); ctx.lineTo(p1[0] - Math.cos(ang) * hd, p1[1] - Math.sin(ang) * hd); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p1[0] - Math.cos(ang - 0.45) * hd * 1.4, p1[1] - Math.sin(ang - 0.45) * hd * 1.4); ctx.lineTo(p1[0] - Math.cos(ang + 0.45) * hd * 1.4, p1[1] - Math.sin(ang + 0.45) * hd * 1.4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  return { w, h };
}
export const diagramSize = (spec, cellPx) => ({ w: spec.rows[0].length * cellPx + cellPx * 0.36, h: spec.rows.length * cellPx + cellPx * 0.36 });
