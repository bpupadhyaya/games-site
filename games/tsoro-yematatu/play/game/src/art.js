// Static art: the night wall, the carved stone slab, and the striped pebbles. One light, from the upper left.
// The board and the pebble sprites are painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where
// OffscreenCanvas does not exist (headless tests) the same painters draw directly.
// Look: a dry-stone wall at night (courses of dressed granite with a chevron frieze), a soapstone slab with a triangle cut into it and thin
// gold inlay in the grooves, and smooth river pebbles: Sun pebbles are amber with dark chevron stripes, River pebbles are slate-blue with
// cream stripes.
import { host, BOARD_CELLS, BOARD_N } from './layout.js';
import { variantOf } from './rules.js';
import { v3 } from './v3.js';

// Pre-rendered 3D stone sprites (filled in by view3d/presenter.js once WebGL works; empty = classic flat art).
export const sprites = { ready: false, stone: {} };

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);

// ------------------------------------------------------------------------------------------------ boards
export const BOARDS = {
  granite: { name: 'Granite', top: ['#c9d2c8', '#b2beb3', '#9aa89c'], strata: [58, 74, 66], frame: ['#6a7776', '#47524f', '#2c3534'], edge: ['#2e3837', '#111918'], groove: '#2b3633', lip: 'rgba(255,255,255,0.45)', inlay: '#f0c15a', trim: '#e7c46c', sock: '#4a5754' },
  soap:    { name: 'Soapstone', top: ['#aebb9c', '#98a886', '#7f9170'], strata: [44, 62, 38], frame: ['#58654a', '#3c4733', '#242c1f'], edge: ['#27301f', '#0f140b'], groove: '#26301f', lip: 'rgba(255,255,230,0.38)', inlay: '#f2cf6a', trim: '#dcc572', sock: '#475239' },
  copper:  { name: 'Copper', top: ['#e1c3a2', '#cfa682', '#b88660'], strata: [96, 56, 30], frame: ['#9a5a3a', '#74402a', '#4a2619'], edge: ['#4d2a1b', '#1d0e08'], groove: '#4a2a1a', lip: 'rgba(255,240,215,0.42)', inlay: '#ffe08a', trim: '#f0c27a', sock: '#6a4430' },
};
export const BOARD_KEYS = ['granite', 'soap', 'copper'];

// ------------------------------------------------------------------------------------------------ the table: a dry-stone wall at night
function paintWall(ctx, w, h, cx, cy) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#12302f'); bg.addColorStop(0.55, '#0c2020'); bg.addColorStop(1, '#061110');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const rnd = lcg(4177), course = Math.max(30, Math.round(Math.min(w, h) / 17));
  let y = -course * 0.4;
  for (let c = 0; y < h; c++) {                                    // courses of dressed stones, a little different in every row
    const ch = course * (0.8 + rnd() * 0.45);
    let x = -rnd() * course * 2;
    while (x < w) {
      const bw = course * (1.5 + rnd() * 1.9), t = rnd(), tone = 26 + Math.floor(t * 20);
      const g = ctx.createLinearGradient(x, y, x + bw, y + ch);
      g.addColorStop(0, `rgba(${tone + 24},${tone + 52},${tone + 46},0.5)`); g.addColorStop(1, `rgba(${tone},${tone + 22},${tone + 20},0.5)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, bw - 4, ch - 4, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(160,230,215,0.07)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + bw - 8, y + 4); ctx.stroke();
      x += bw;
    }
    y += ch;
  }
  // the chevron frieze (top and bottom edge): two rows of lozenges, the pattern of the great enclosure walls
  const fr = Math.max(14, course * 0.55);
  const frieze = (y0) => {
    ctx.fillStyle = 'rgba(6,16,15,0.78)'; ctx.fillRect(0, y0, w, fr * 2.1);
    ctx.strokeStyle = 'rgba(240,193,90,0.38)'; ctx.lineWidth = 2;
    for (let row = 0; row < 2; row++) {
      ctx.beginPath();
      for (let x = -fr; x < w + fr; x += fr) { const yy = y0 + fr * (0.35 + row * 0.9); ctx.moveTo(x, yy + fr * 0.6); ctx.lineTo(x + fr / 2, yy); ctx.lineTo(x + fr, yy + fr * 0.6); }
      ctx.stroke();
    }
  };
  frieze(0); frieze(h - fr * 2.1);
  // a lamp: a soft warm pool of light on the board
  const rad = Math.max(w, h) * 0.62, lamp = ctx.createRadialGradient(cx - rad * 0.1, cy - rad * 0.2, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,205,120,0.26)'); lamp.addColorStop(0.45, 'rgba(255,170,90,0.07)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0.12)'); vg.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}
const tableCache = new Map();
export function drawTable(ctx, L) {
  if (v3.on) { ctx.clearRect(0, 0, L.w, L.h); return; }
  const { w, h } = L, b = L.board, cx = b ? b.x + b.S / 2 : w / 2, cy = b ? b.y + b.S / 2 : h / 2;
  const key = `${w}x${h}|${Math.round(cx / 8)}|${Math.round(cy / 8)}|${Math.round(px() * 4)}`;
  let layer = tableCache.get(key);
  if (layer === undefined) {
    layer = null; const q = Math.min(1, Math.max(0.35, 1100 / Math.max(w, h))), m = mk(w * q, h * q);
    if (m) { m.x.save(); m.x.scale(q, q); paintWall(m.x, w, h, cx, cy); m.x.restore(); layer = { c: m.c, q }; }
    tableCache.set(key, layer); if (tableCache.size > 4) tableCache.delete(tableCache.keys().next().value);
  }
  if (layer) ctx.drawImage(layer.c, 0, 0, w, h); else paintWall(ctx, w, h, cx, cy);
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one cell = 100: the slab is OUT*100 wide, the playing surface starts at FRAME*100.
const OUT = BOARD_CELLS, NC = BOARD_N, SLAB = 22, FRM = (OUT - NC) * 50;
const hullOf = (pts) => {                                          // the outer corners of the triangle: apex, bottom-left, bottom-right
  let top = pts[0], l = pts[0], r = pts[0];
  for (const p of pts) { if (p.y < top.y) top = p; }
  const by = Math.max(...pts.map((p) => p.y));
  for (const p of pts) if (Math.abs(p.y - by) < 0.01) { if (l.y !== by || p.x < l.x) l = p; if (r.y !== by || p.x > r.x) r = p; }
  return [top, r, l];
};
// Unit coordinates -> local board units
const at = (p) => ({ x: FRM + p.x * NC * 100, y: FRM + p.y * NC * 100 });

function paintSurface(ctx, pal, V, rnd, local) {
  // the triangle terrace, grooves with a lit lip, gold inlay, sockets
  const hull = hullOf(V.pts).map(local), cxm = (hull[0].x + hull[1].x + hull[2].x) / 3, cym = (hull[0].y + hull[1].y + hull[2].y) / 3;
  const grow = (p, k) => ({ x: cxm + (p.x - cxm) * k, y: cym + (p.y - cym) * k });
  const tri = (k, fn) => { const a = grow(hull[0], k), b = grow(hull[1], k), c = grow(hull[2], k); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath(); fn(); };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // the terrace the triangle sits on: a slightly darker fill with a soft lit edge (no outline: the lines themselves are the grooves)
  tri(1.16, () => { ctx.fillStyle = `rgba(${pal.strata[0]},${pal.strata[1]},${pal.strata[2]},0.22)`; ctx.fill(); });
  // the lines between points: groove, lit lip beneath, thin gold inlay on top
  const line = (a, b, wd, st) => { ctx.strokeStyle = st; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
  for (const l of V.lines) {
    const a = local(V.pts[l[0]]), b = local(V.pts[l[l.length - 1]]);
    line({ x: a.x + 1.5, y: a.y + 3 }, { x: b.x + 1.5, y: b.y + 3 }, 13, pal.lip);
    line(a, b, 12, pal.groove);
    line(a, b, 3, pal.inlay);
  }
  // sockets
  for (const p0 of V.pts) {
    const p = local(p0), r = 38 * V.pieceScale;
    ctx.fillStyle = pal.lip; ctx.beginPath(); ctx.arc(p.x + 1.5, p.y + 3.5, r + 1, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.sock; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    const g = ctx.createLinearGradient(p.x - r * 0.7, p.y - r * 0.7, p.x + r * 0.7, p.y + r * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0.1)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.inlay; ctx.lineWidth = 3.5; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(p.x, p.y, r - 3, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  }
}
function paintBoard(ctx, kind, variant) {
  const W = OUT * 100, H = W, pal = BOARDS[kind] || BOARDS.granite, rnd = lcg(11 + kind.length * 31), V = variantOf(variant);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  for (let k = 5; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.08 + (5 - k) * 0.012})`; rr(-4 * k + 10, 8 + SLAB - 2 + 2 * k, W + 8 * k - 12, H + 4 * k, 26 + 4 * k); ctx.fill(); }
  const sg = ctx.createLinearGradient(0, H - 20, 0, H + SLAB); sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
  ctx.fillStyle = sg; rr(0, 20, W, H - 20 + SLAB, 18); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,210,0.16)'; ctx.fillRect(14, H + 1, W - 28, 2.5);
  const tg = ctx.createLinearGradient(0, 0, W, H); tg.addColorStop(0, pal.frame[0]); tg.addColorStop(0.5, pal.frame[1]); tg.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = tg; rr(0, 0, W, H, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,245,215,0.32)'; ctx.lineWidth = 3; rr(2, 2, W - 4, H - 4, 16); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; rr(5, 5, W - 10, H - 10, 14); ctx.stroke();
  ctx.save(); rr(0, 0, W, H, 18); ctx.clip();
  for (let k = 0; k < 360; k++) {                                  // grain in the frame
    const x = rnd() * W, y = rnd() * H, a = 0.05 + rnd() * 0.1, s = 0.8 + rnd() * 2;
    ctx.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,248,225,${a * 0.6})`; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
  }
  // the chevron band round the frame: a zig-zag cut in gold, two strokes
  const mid = FRM / 2, z = 18, n = Math.round((W - 2 * FRM * 0.5) / z);
  ctx.strokeStyle = pal.trim; ctx.lineWidth = 3; ctx.globalAlpha = 0.65;
  for (const off of [-5, 5]) {
    ctx.beginPath();
    for (let k = 0; k <= n; k++) { const x = FRM * 0.5 + k * z; ctx.lineTo(x, mid + off + (k % 2 ? 6 : -6)); }
    for (let k = 0; k <= n; k++) { const x = FRM * 0.5 + k * z; ctx.lineTo(x, H - mid + off + (k % 2 ? 6 : -6)); }
    ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k <= n; k++) { const y = FRM * 0.5 + k * z; ctx.lineTo(mid + off + (k % 2 ? 6 : -6), y); }
    ctx.stroke(); ctx.beginPath();
    for (let k = 0; k <= n; k++) { const y = FRM * 0.5 + k * z; ctx.lineTo(W - mid + off + (k % 2 ? 6 : -6), y); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.restore();
  // the playing surface: soapstone with long strata
  const gx = FRM, gy = FRM, G = NC * 100;
  ctx.fillStyle = pal.groove; rr(gx - 8, gy - 8, G + 16, G + 16, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(gx - 8, gy - 8, G + 16, G + 16, 8); ctx.stroke();
  const pg = ctx.createLinearGradient(gx, gy, gx + G, gy + G); pg.addColorStop(0, pal.top[0]); pg.addColorStop(0.55, pal.top[1]); pg.addColorStop(1, pal.top[2]);
  ctx.fillStyle = pg; rr(gx, gy, G, G, 6); ctx.fill();
  ctx.save(); rr(gx, gy, G, G, 6); ctx.clip();
  for (let k = 0; k < 34; k++) {                                   // strata: long soft bands, a little wavy
    const y = gy + (k + rnd() * 0.6) * (G / 34), a = 0.04 + rnd() * 0.09, th = 3 + rnd() * 8, ph = rnd() * 6;
    ctx.strokeStyle = `rgba(${pal.strata[0]},${pal.strata[1]},${pal.strata[2]},${a})`; ctx.lineWidth = th; ctx.beginPath();
    for (let x = 0; x <= G; x += 25) ctx.lineTo(gx + x, y + Math.sin(x / 70 + ph) * 3);
    ctx.stroke();
  }
  for (let k = 0; k < 220; k++) { const a = 0.03 + rnd() * 0.08; ctx.fillStyle = rnd() < 0.5 ? `rgba(${pal.strata[0]},${pal.strata[1]},${pal.strata[2]},${a})` : `rgba(255,255,245,${a})`; ctx.beginPath(); ctx.arc(gx + rnd() * G, gy + rnd() * G, 0.8 + rnd() * 1.8, 0, TAU); ctx.fill(); }
  const hi = ctx.createLinearGradient(gx, gy, gx, gy + G * 0.5); hi.addColorStop(0, 'rgba(255,255,245,0.2)'); hi.addColorStop(1, 'rgba(255,255,245,0)');
  ctx.fillStyle = hi; ctx.fillRect(gx, gy, G, G * 0.5);
  paintSurface(ctx, pal, V, rnd, at);
  ctx.restore();
  const lg = ctx.createLinearGradient(0, 0, W, H); lg.addColorStop(0, 'rgba(255,245,215,0.14)'); lg.addColorStop(0.5, 'rgba(255,245,215,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = lg; rr(0, 0, W, H, 18); ctx.fill();
}
const boardCache = new Map();
export function drawBoard(ctx, b, kind = 'granite', variant = 'classic') {
  const k = b.S / (OUT * 100), P = px(), wpx = Math.min(2300, Math.ceil(b.S * P / 64) * 64), key = kind + '|' + variant + '|' + wpx;
  let layer = boardCache.get(key);
  if (layer === undefined) {
    layer = null;
    const u = wpx / (OUT * 100), m = mk(wpx + 8, (OUT * 100 + SLAB + 40) * u + 8);
    if (m) { m.x.save(); m.x.translate(4, 4); m.x.scale(u, u); paintBoard(m.x, kind, variant); m.x.restore(); layer = { c: m.c, u }; }
    boardCache.set(key, layer); if (boardCache.size > 9) boardCache.delete(boardCache.keys().next().value);
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
  if (layer) ctx.drawImage(layer.c, -4 / layer.u, -4 / layer.u, layer.c.width / layer.u, layer.c.height / layer.u);
  else paintBoard(ctx, kind, variant);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ pebbles
// Local units: one cell = 100, origin at the point's centre. Piece value v: 1 Sun, 2 River.
export const PIECE_STYLES = {
  pebble: { name: 'Striped pebbles', 1: { face: ['#ffdf8f', '#f0a93a', '#b4601a'], side: '#6a3410', ink: 'rgba(86,36,8,0.78)', rim: 'rgba(255,238,190,0.5)' }, 2: { face: ['#8fb2dc', '#4a6ea0', '#22365e'], side: '#101c34', ink: 'rgba(250,242,220,0.86)', rim: 'rgba(210,230,255,0.45)' } },
  ring:   { name: 'Ringed discs', 1: { face: ['#f6d58a', '#d9953a', '#9a5516'], side: '#5a2c0c', ink: 'rgba(70,28,6,0.8)', rim: 'rgba(255,238,190,0.5)' }, 2: { face: ['#d9e7ee', '#a6bccb', '#6f8ba0'], side: '#34495a', ink: 'rgba(20,40,70,0.82)', rim: 'rgba(255,255,255,0.7)' } },
};
export const STYLE_KEYS = ['pebble', 'ring'];
const DEPTH = 16, RX = 40, RY = 33, TY = -6;

function pebble(ctx, pal, style, v) {
  const cy = TY + 2;
  for (let d = DEPTH; d >= 0; d -= 1) {
    ctx.beginPath(); ctx.ellipse(0, cy + d, RX, RY, 0, 0, TAU); ctx.fillStyle = pal.side; ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.18 * (1 - d / DEPTH)})`; ctx.fill();
  }
  const g = ctx.createLinearGradient(-RX, cy - RY, RX, cy + RY);
  g.addColorStop(0, pal.face[0]); g.addColorStop(0.5, pal.face[1]); g.addColorStop(1, pal.face[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, cy, RX, RY, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, cy, RX, RY, 0, 0, TAU); ctx.clip();
  ctx.strokeStyle = pal.ink; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (style === 'ring') {
    ctx.lineWidth = 3.4; for (const k of [0.78, 0.5]) { ctx.beginPath(); ctx.ellipse(0, cy, RX * k, RY * k, 0, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = pal.ink; ctx.beginPath(); ctx.ellipse(0, cy, RX * 0.14, RY * 0.14, 0, 0, TAU); ctx.fill();
  } else {                                                         // two chevron stripes across the face
    ctx.lineWidth = 7;
    for (const off of [-0.34, 0.3]) {
      ctx.beginPath();
      for (let k = -4; k <= 4; k++) ctx.lineTo(k * RX * 0.27, cy + off * RY + (k % 2 ? -1 : 1) * RY * 0.2);
      ctx.stroke();
    }
  }
  // lit from the upper left: a broad specular, then a shade on the lower right
  const sp = ctx.createRadialGradient(-RX * 0.38, cy - RY * 0.45, 0, -RX * 0.38, cy - RY * 0.45, RX * 0.95);
  sp.addColorStop(0, 'rgba(255,255,255,0.55)'); sp.addColorStop(0.5, 'rgba(255,255,255,0.12)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.fillRect(-RX, cy - RY, RX * 2, RY * 2);
  const sd = ctx.createLinearGradient(-RX, 0, RX, 0); sd.addColorStop(0, 'rgba(255,255,255,0.05)'); sd.addColorStop(0.6, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = sd; ctx.fillRect(-RX, cy - RY, RX * 2, RY * 2);
  ctx.restore();
  const bg = ctx.createLinearGradient(-RX, cy - RY, RX, cy + RY); bg.addColorStop(0, 'rgba(255,255,255,0.85)'); bg.addColorStop(0.45, pal.rim); bg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.strokeStyle = bg; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, cy, RX - 2.4, RY - 2, 0, 0, TAU); ctx.stroke();
}
function paintPiece(ctx, v, style) { pebble(ctx, (PIECE_STYLES[style] || PIECE_STYLES.pebble)[v === 2 ? 2 : 1], style, v); }
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
let blobC;
function blob(ctx, x, y, rx, ry, a) {
  if (blobC === undefined) { blobC = null; const m = mk(128, 128); if (m) { const g = m.x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); m.x.fillStyle = g; m.x.fillRect(0, 0, 128, 128); blobC = m.c; } }
  const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a;
  if (blobC) ctx.drawImage(blobC, x - rx, y - ry, rx * 2, ry * 2);
  else { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y, rx * 0.7, ry * 0.7, 0, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = ga;
}
export { blob };

// A pebble resting at (x, y). `cell` is its size (a full pebble is about 0.8 cell wide). opts: { lift (half-cells), alpha, scale, glow, flash }
export function drawPiece(ctx, v, style, x, y, cell, opts = {}) {
  const lift = opts.lift ?? 0, k = (cell / 100) * (opts.scale ?? 1) * 1.04;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) blob(ctx, x, y + cell * 0.1, cell * 0.95, cell * 0.66, opts.glow);
  blob(ctx, x + cell * 0.03, y + cell * 0.3, cell * 0.46, cell * 0.12, 0.8 * (1 - Math.min(1, lift) * 0.8));
  blob(ctx, x + cell * (0.07 + lift * 0.12), y + cell * (0.2 + lift * 0.1), cell * (0.66 + lift * 0.1), cell * (0.32 + lift * 0.04), 0.5 - Math.min(1, lift) * 0.18);
  ctx.translate(x, y - lift * cell * 0.3);
  const s3 = sprites.ready && sprites.stone[`${v === 2 ? 2 : 1}|${style}`];
  if (s3) { const Wd = cell * (opts.scale ?? 1) * 1.4; ctx.drawImage(s3, -Wd / 2, -Wd * 0.56, Wd, Wd); }
  else {
  const s = sprite(v, style, cell * px() * (opts.scale ?? 1));
  if (s) ctx.drawImage(s, -60 * k, -80 * k, 120 * k, 140 * k);
  else { ctx.save(); ctx.scale(k, k); paintPiece(ctx, v, style); ctx.restore(); }
  }
  if (opts.flash) { ctx.fillStyle = `rgba(255,255,255,${opts.flash})`; ctx.beginPath(); ctx.ellipse(0, (TY + 2) * k, RX * k, RY * k, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ diagrams (Rules, How to Play, lessons)
// spec: { variant, stones: { point: 1|2 }, marks: [[point,'ring'|'cross'|'dot'|'target']], arrows: [[from,to]], line: [a,b,c] }
function bbox(V) {
  let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
  for (const p of V.pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
}
export function diagramSize(spec, width) {
  const b = bbox(variantOf(spec.variant)), m = 0.2;
  return { w: width, h: width * (b.h + 2 * m) / (b.w + 2 * m) };
}
export function drawDiagram(ctx, spec, x, y, width, kind = 'granite', style = 'pebble') {
  const V = variantOf(spec.variant), b = bbox(V), pal = BOARDS[kind] || BOARDS.granite, m = 0.2, sz = diagramSize(spec, width), u = width / (b.w + 2 * m);
  const P = (i) => ({ x: x + (V.pts[i].x - b.x0 + m) * u, y: y + (V.pts[i].y - b.y0 + m) * u });
  const cell = V.gap * u * 1.0, pc = Math.min(cell * 0.9, u * 0.3), r = Math.max(8, pc * 0.42);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 6, sz.w, sz.h, 12); ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + sz.w, y + sz.h); g.addColorStop(0, pal.top[0]); g.addColorStop(0.6, pal.top[1]); g.addColorStop(1, pal.top[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, sz.w, sz.h, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineCap = 'round';
  for (const l of V.lines) {
    const a = P(l[0]), c = P(l[l.length - 1]);
    ctx.strokeStyle = pal.groove; ctx.lineWidth = Math.max(3, r * 0.45); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    ctx.strokeStyle = pal.inlay; ctx.lineWidth = Math.max(1.2, r * 0.14); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
  }
  if (spec.line) {
    const a = P(spec.line[0]), c = P(spec.line[2]);
    ctx.strokeStyle = 'rgba(255,224,110,0.85)'; ctx.lineWidth = Math.max(6, r * 0.9); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
  }
  for (let i = 0; i < V.n; i++) {
    const p = P(i);
    ctx.fillStyle = pal.sock; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = pal.inlay; ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.88, 0, TAU); ctx.stroke();
  }
  if (spec.paint) spec.paint(ctx, P, pc, r);
  for (const [i, side] of Object.entries(spec.stones || {})) { const p = P(+i); drawPiece(ctx, side, style, p.x, p.y, pc * 1.25, {}); }
  for (const [i, kind2] of spec.marks || []) {
    const p = P(i); ctx.lineWidth = Math.max(2.5, r * 0.22);
    if (kind2 === 'cross') { ctx.strokeStyle = '#e0352b'; const q = r * 0.6; ctx.beginPath(); ctx.moveTo(p.x - q, p.y - q); ctx.lineTo(p.x + q, p.y + q); ctx.moveTo(p.x + q, p.y - q); ctx.lineTo(p.x - q, p.y + q); ctx.stroke(); }
    else if (kind2 === 'ring') { ctx.strokeStyle = '#18a65a'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.15, 0, TAU); ctx.stroke(); }
    else if (kind2 === 'dot') { ctx.fillStyle = 'rgba(24,166,90,0.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.42, 0, TAU); ctx.fill(); }
    else if (kind2 === 'target') { ctx.strokeStyle = '#e0352b'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.2, 0, TAU); ctx.stroke(); }
  }
  for (const [a0, a1] of spec.arrows || []) {
    const A = P(a0), B = P(a1), ang = Math.atan2(B.y - A.y, B.x - A.x), hd = r * 0.7;
    ctx.strokeStyle = 'rgba(224,53,43,0.95)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(3, r * 0.3);
    ctx.beginPath(); ctx.moveTo(A.x + Math.cos(ang) * r * 0.9, A.y + Math.sin(ang) * r * 0.9); ctx.lineTo(B.x - Math.cos(ang) * (r * 0.9 + hd), B.y - Math.sin(ang) * (r * 0.9 + hd)); ctx.stroke();
    const ex = B.x - Math.cos(ang) * r * 0.9, ey = B.y - Math.sin(ang) * r * 0.9;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(ang - 0.5) * hd * 1.5, ey - Math.sin(ang - 0.5) * hd * 1.5); ctx.lineTo(ex - Math.cos(ang + 0.5) * hd * 1.5, ey - Math.sin(ang + 0.5) * hd * 1.5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  return sz;
}
