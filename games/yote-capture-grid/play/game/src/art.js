// Static art: the table, the board, and the pebbles. One light, from the upper left.
// The board and the pebble sprites are painted ONCE (OffscreenCanvas) at the resolution the screen needs and drawn scaled; where
// OffscreenCanvas does not exist (headless tests) the same painters draw directly.
// Look: a deep-indigo mud-cloth table (printed bands of crosses and zig-zags), a sand tray in a clay frame set with cowrie-white studs,
// raked ripples in the sand and 30 round scooped PITS; pebbles are sphere-shaded river stones that sit in the pits.
import { host, FRAME, THICK } from './layout.js';
import { ROWS, COLS } from './rules.js';
import { sprites } from './v3.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);

// ------------------------------------------------------------------------------------------------ boards
export const BOARDS = {
  laterite: { name: 'Laterite', top: ['#e0a468', '#cf8a4f', '#b8723b'], pit: ['#6e4524', '#a8774a'], lip: 'rgba(255,230,190,0.55)', grain: [96, 46, 18], frame: ['#8d4a2b', '#6b3820', '#4b2414'], edge: ['#4e2515', '#25100a'], stud: '#f6ead0' },
  dune:     { name: 'Dune', top: ['#f1dcae', '#e3c68b', '#d0ab6c'], pit: ['#8a6a38', '#c4a468'], lip: 'rgba(255,248,226,0.7)', grain: [110, 74, 34], frame: ['#7c5a3a', '#5c4028', '#3d2917'], edge: ['#3f2a18', '#1d1209'], stud: '#fbf1d6' },
  rose:     { name: 'Rose clay', top: ['#e9bfae', '#d79f8c', '#bf8270'], pit: ['#74483e', '#a87868'], lip: 'rgba(255,234,222,0.6)', grain: [120, 54, 40], frame: ['#6a2f5a', '#4a1f40', '#2f1228'], edge: ['#33152c', '#160812'], stud: '#f9e9e0' },
};
export const BOARD_KEYS = ['laterite', 'dune', 'rose'];

// ------------------------------------------------------------------------------------------------ the table: indigo mud cloth
function paintCloth(ctx, w, h) {
  const bg = ctx.createLinearGradient(0, 0, w * 0.4, h);
  bg.addColorStop(0, '#182e57'); bg.addColorStop(0.55, '#10213f'); bg.addColorStop(1, '#09142a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // woven threads: fine vertical lines and a few uneven horizontal ones
  const rnd = lcg(5);
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 5) { ctx.strokeStyle = `rgba(160,190,255,${0.012 + rnd() * 0.02})`; ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
  // printed bands, one motif per band, drawn in cream with a slightly uneven hand
  const ink = 'rgba(244,228,190,0.085)', ink2 = 'rgba(244,228,190,0.05)';
  const bandH = 120, n = Math.ceil(h / bandH) + 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let b = 0; b < n; b++) {
    const y0 = b * bandH + 8, kind = b % 4;
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 3;
    ctx.fillStyle = ink2; ctx.fillRect(0, y0, w, 3); ctx.fillRect(0, y0 + bandH - 22, w, 3);
    if (kind === 0) {                                              // crosses
      for (let x = 20; x < w; x += 44) { const cy = y0 + bandH / 2 - 8, s = 8; ctx.beginPath(); ctx.moveTo(x - s, cy); ctx.lineTo(x + s, cy); ctx.moveTo(x, cy - s); ctx.lineTo(x, cy + s); ctx.stroke(); }
    } else if (kind === 1) {                                       // zig-zag
      ctx.beginPath(); for (let x = 0; x <= w + 40; x += 30) { const yy = y0 + bandH / 2 - 8 + ((x / 30) % 2 ? -14 : 14); if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke();
    } else if (kind === 2) {                                       // dots and dashes
      for (let x = 14; x < w; x += 32) { const cy = y0 + bandH / 2 - 8; if ((x / 32 | 0) % 2) { ctx.beginPath(); ctx.arc(x, cy, 5, 0, TAU); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(x - 9, cy); ctx.lineTo(x + 9, cy); ctx.stroke(); } }
    } else {                                                       // diamonds
      for (let x = 22; x < w + 30; x += 52) { const cy = y0 + bandH / 2 - 8; ctx.beginPath(); ctx.moveTo(x, cy - 15); ctx.lineTo(x + 15, cy); ctx.lineTo(x, cy + 15); ctx.lineTo(x - 15, cy); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(x, cy, 3, 0, TAU); ctx.fill(); }
    }
  }
}
const clothCache = new Map();
export function drawTable(ctx, L) {
  const { w, h } = L, s = clamp(px() * 0.8, 0.5, 2), key = `${w}x${h}|${Math.round(s * 10)}`;
  let layer = clothCache.get(key);
  if (layer === undefined) {
    layer = null; const m = mk(w * s, h * s);
    if (m) { m.x.scale(s, s); paintCloth(m.x, w, h); layer = m.c; }
    clothCache.set(key, layer); if (clothCache.size > 4) clothCache.delete(clothCache.keys().next().value);
  }
  if (layer) ctx.drawImage(layer, 0, 0, w, h); else paintCloth(ctx, w, h);
  // a lamp: soft pool of light on the board, and a dark vignette
  const b = L.board, cx = b ? b.x + b.W / 2 : w / 2, cy = b ? b.y + b.h / 2 : h / 2, rad = Math.max(w, h) * 0.6;
  const lamp = ctx.createRadialGradient(cx - rad * 0.1, cy - rad * 0.18, rad * 0.05, cx, cy, rad);
  lamp.addColorStop(0, 'rgba(255,214,150,0.2)'); lamp.addColorStop(0.5, 'rgba(255,190,120,0.05)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------------------------------------ the board
// Painted in local units where one pit cell = 100 and the slab's top-left corner is (0,0): width 100*(sc+2F), height 100*(sr+2F), plus the slab.
const PIT = 41;                                                    // pit radius
function paintBoard(ctx, kind, sc, sr) {
  const F = FRAME * 100, SL = THICK * 100, W = sc * 100 + 2 * F, H = sr * 100 + 2 * F, pal = BOARDS[kind] || BOARDS.laterite, rnd = lcg(11 + kind.length * 17 + sc);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  // contact shadow on the cloth
  for (let k = 5; k >= 1; k--) { ctx.fillStyle = `rgba(0,0,0,${0.08 + (5 - k) * 0.012})`; rr(-4 * k + 10, 8 + SL - 2 + 2 * k, W + 8 * k - 12, H + 4 * k, 30 + 4 * k); ctx.fill(); }
  // the slab's front (thickness)
  const sg = ctx.createLinearGradient(0, H - 20, 0, H + SL);
  sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
  ctx.fillStyle = sg; rr(0, 20, W, H - 20 + SL, 26); ctx.fill();
  ctx.fillStyle = 'rgba(255,225,180,0.16)'; ctx.fillRect(18, H + 1, W - 36, 2.5);
  // the frame's top face
  const tg = ctx.createLinearGradient(0, 0, W, H);
  tg.addColorStop(0, pal.frame[0]); tg.addColorStop(0.5, pal.frame[1]); tg.addColorStop(1, pal.frame[2]);
  ctx.fillStyle = tg; rr(0, 0, W, H, 26); ctx.fill();
  ctx.strokeStyle = 'rgba(255,226,180,0.32)'; ctx.lineWidth = 3; rr(2.5, 2.5, W - 5, H - 5, 24); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; rr(6, 6, W - 12, H - 12, 21); ctx.stroke();
  // clay speckle on the frame
  ctx.save(); rr(0, 0, W, H, 26); ctx.clip();
  for (let k = 0; k < 360; k++) { const a = 0.04 + rnd() * 0.1; ctx.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,226,190,${a * 0.6})`; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 0.8 + rnd() * 2, 0, TAU); ctx.fill(); }
  ctx.restore();
  // cowrie-white studs set into the frame: small ovals with a dark slit, one per half cell along each side
  const stud = (x, y, ang) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(1.5, 2.5, 9.5, 6.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.stud; ctx.beginPath(); ctx.ellipse(0, 0, 9.5, 6.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(70,40,20,0.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-3, -2.6, 3, 1.4, 0, 0, TAU); ctx.fill();
    ctx.restore();
  };
  const mid = F / 2;
  for (let k = 0; k < sc * 2; k++) { const t = F + (k + 0.5) * 50; stud(t, mid, 0); stud(t, H - mid, 0); }
  for (let k = 0; k < sr * 2; k++) { const t = F + (k + 0.5) * 50; stud(mid, t, Math.PI / 2); stud(W - mid, t, Math.PI / 2); }
  // the sand bed: sunken, with a lit lower lip
  const gx = F, gy = F, GW = sc * 100, GH = sr * 100;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(gx - 7, gy - 7, GW + 14, GH + 14, 12); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,190,0.35)'; rr(gx - 5.5, gy - 3, GW + 11, GH + 11, 11); ctx.fill();
  const bed = ctx.createLinearGradient(gx, gy, gx + GW, gy + GH);
  bed.addColorStop(0, pal.top[0]); bed.addColorStop(0.55, pal.top[1]); bed.addColorStop(1, pal.top[2]);
  ctx.fillStyle = bed; rr(gx - 3, gy - 3, GW + 6, GH + 6, 9); ctx.fill();
  ctx.save(); rr(gx - 3, gy - 3, GW + 6, GH + 6, 9); ctx.clip();
  // raked ripples: long soft waves across the bed, a dark and a light line each
  for (let y = gy + 12; y < gy + GH; y += 17) {
    const ph = rnd() * 6, amp = 2 + rnd() * 2.5;
    for (const [dy, col] of [[0, `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},0.13)`], [3.5, 'rgba(255,244,220,0.16)']]) {
      ctx.strokeStyle = col; ctx.lineWidth = 1.7; ctx.beginPath();
      for (let x = gx - 3; x <= gx + GW + 3; x += 10) { const yy = y + dy + Math.sin(x * 0.045 + ph) * amp; if (x === gx - 3) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
      ctx.stroke();
    }
  }
  for (let k = 0; k < Math.round(sc * sr * 34); k++) {                // sand grains
    const a = 0.05 + rnd() * 0.12;
    ctx.fillStyle = rnd() < 0.5 ? `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${a})` : `rgba(255,248,230,${a * 1.2})`;
    ctx.beginPath(); ctx.arc(gx + rnd() * GW, gy + rnd() * GH, 0.7 + rnd() * 1.5, 0, TAU); ctx.fill();
  }
  // the pits: scooped hollows, shaded dark on the upper-left wall and lit on the lower-right lip
  for (let i = 0; i < sc; i++) for (let j = 0; j < sr; j++) {
    const cx = gx + (i + 0.5) * 100, cy = gy + (j + 0.5) * 100;
    ctx.fillStyle = pal.lip; ctx.beginPath(); ctx.arc(cx + 1.6, cy + 2.6, PIT + 2.4, 0, TAU); ctx.fill();       // lit lip on the lower right
    const bowl = ctx.createRadialGradient(cx + PIT * 0.32, cy + PIT * 0.34, PIT * 0.1, cx, cy, PIT);
    bowl.addColorStop(0, pal.pit[1]); bowl.addColorStop(0.75, pal.pit[0]); bowl.addColorStop(1, 'rgba(40,18,6,0.95)');
    ctx.fillStyle = bowl; ctx.beginPath(); ctx.arc(cx, cy, PIT, 0, TAU); ctx.fill();
    const wall = ctx.createLinearGradient(cx - PIT, cy - PIT, cx + PIT * 0.6, cy + PIT * 0.6);               // the shadowed upper-left wall
    wall.addColorStop(0, 'rgba(20,8,2,0.62)'); wall.addColorStop(0.5, 'rgba(20,8,2,0.1)'); wall.addColorStop(1, 'rgba(20,8,2,0)');
    ctx.fillStyle = wall; ctx.beginPath(); ctx.arc(cx, cy, PIT, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,12,4,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, PIT, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  // soft light across the whole top
  const lg = ctx.createLinearGradient(0, 0, W, H);
  lg.addColorStop(0, 'rgba(255,240,205,0.16)'); lg.addColorStop(0.5, 'rgba(255,240,205,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = lg; rr(0, 0, W, H, 26); ctx.fill();
}
const boardCache = new Map();
export function drawBoard(ctx, b, kind = 'laterite') {
  // b: board geometry from layout (x, y, W, sc, sr). The painted layer is cached per (board, pixel size bucket).
  const unitsW = b.sc + 2 * FRAME, k = b.W / (unitsW * 100), P = px(), wpx = Math.min(2300, Math.ceil(b.W * P / 64) * 64);
  const key = `${kind}|${b.sc}x${b.sr}|${wpx}`;
  let layer = boardCache.get(key);
  if (layer === undefined) {
    layer = null;
    const u = wpx / (unitsW * 100), m = mk(wpx + 8, ((b.sr + 2 * FRAME + THICK) * 100 + 40) * u + 8);
    if (m) { m.x.save(); m.x.translate(4, 4); m.x.scale(u, u); paintBoard(m.x, kind, b.sc, b.sr); m.x.restore(); layer = { c: m.c, u }; }
    boardCache.set(key, layer); if (boardCache.size > 8) boardCache.delete(boardCache.keys().next().value);
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
  if (layer) ctx.drawImage(layer.c, -4 / layer.u, -4 / layer.u, layer.c.width / layer.u, layer.c.height / layer.u);
  else paintBoard(ctx, kind, b.sc, b.sr);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ pebbles
// A sphere-shaded river pebble. Local units: one pit cell = 100, origin at the pit centre. Piece value v: 1 or 2 (the side).
export const PIECE_STYLES = {
  river: { name: 'River pebbles', side: ['', 'Indigo', 'Ivory'],
    1: { hi: '#6f86c4', mid: '#2c3f86', lo: '#0d1638', under: '#070c22', vein: 'rgba(170,190,255,0.35)', mark: '#d9e2ff', spec: 0.75 },
    2: { hi: '#fffdf4', mid: '#eadfc4', lo: '#b9a67f', under: '#7e6e4c', vein: 'rgba(110,86,50,0.30)', mark: '#25428c', spec: 0.9 } },
  clay: { name: 'Clay and bone', side: ['', 'Clay', 'Bone'],
    1: { hi: '#f09068', mid: '#bb4c26', lo: '#62200c', under: '#3c1306', vein: 'rgba(255,200,160,0.30)', mark: '#ffe4bf', spec: 0.6 },
    2: { hi: '#ffffff', mid: '#f1ead6', lo: '#c7bb99', under: '#8d835f', vein: 'rgba(120,100,70,0.28)', mark: '#8c3a1c', spec: 0.9 } },
};
export const STYLE_KEYS = ['river', 'clay'];
export const sideName = (style, side) => (PIECE_STYLES[style] || PIECE_STYLES.river).side[side] || '';
const RX = 34, RY = 29, TY = -7, UNDER = 8;

function paintPiece(ctx, v, style) {
  const pal = (PIECE_STYLES[style] || PIECE_STYLES.river)[v === 2 ? 2 : 1];
  const r = lcg(v * 977 + 13);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // the underside: a darker lower body so the stone reads as a dome with weight
  ctx.fillStyle = pal.under; ctx.beginPath(); ctx.ellipse(0, TY + UNDER, RX, RY, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.beginPath(); ctx.ellipse(0, TY + UNDER, RX, RY, 0, 0, TAU); ctx.fill();
  // body
  const g = ctx.createRadialGradient(-RX * 0.38, TY - RY * 0.5, RX * 0.06, -RX * 0.1, TY, RX * 1.12);
  g.addColorStop(0, pal.hi); g.addColorStop(0.5, pal.mid); g.addColorStop(1, pal.lo);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, TY, RX, RY, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, TY, RX - 0.5, RY - 0.5, 0, 0, TAU); ctx.clip();
  // veins and speckle
  ctx.strokeStyle = pal.vein; ctx.lineWidth = 1.5;
  for (let k = 0; k < 2; k++) { ctx.beginPath(); const y0 = TY + (r() - 0.5) * RY; ctx.moveTo(-RX, y0 + 5); ctx.bezierCurveTo(-RX * 0.3, y0 - 9 + r() * 6, RX * 0.3, y0 + 9 - r() * 6, RX, y0 - 4); ctx.stroke(); }
  for (let k = 0; k < 26; k++) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc((r() - 0.5) * RX * 2, TY + (r() - 0.5) * RY * 2, 0.7 + r() * 1.4, 0, TAU); ctx.fill(); }
  // shade on the lower right
  const sd = ctx.createLinearGradient(-RX, TY - RY, RX, TY + RY); sd.addColorStop(0, 'rgba(255,255,255,0.05)'); sd.addColorStop(0.55, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = sd; ctx.fillRect(-RX, TY - RY, RX * 2, RY * 2);
  // an inlaid dot so the sides read without colour
  ctx.fillStyle = pal.mark; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(RX * 0.18, TY + RY * 0.22, 3.4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
  // the specular highlight
  ctx.fillStyle = `rgba(255,255,255,${pal.spec})`; ctx.beginPath(); ctx.ellipse(-RX * 0.42, TY - RY * 0.5, RX * 0.3, RY * 0.16, -0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(RX * 0.38, TY + RY * 0.62, RX * 0.22, RY * 0.07, 0.2, 0, TAU); ctx.fill();
}
const spriteCache = new Map();
function sprite(v, style, cellPx) {
  const q = Math.max(24, Math.ceil(cellPx / 8) * 8), key = `${v}|${style}|${q}`;
  let s = spriteCache.get(key);
  if (s === undefined) {
    s = null; const u = q / 100, m = mk(120 * u, 120 * u);
    if (m) { m.x.save(); m.x.translate(60 * u, 70 * u); m.x.scale(u, u); paintPiece(m.x, v, style); m.x.restore(); s = m.c; }
    spriteCache.set(key, s); if (spriteCache.size > 48) spriteCache.delete(spriteCache.keys().next().value);
  }
  return s;
}
// soft shadow blob (one cached radial sprite)
let blobC;
export function blob(ctx, x, y, rx, ry, a) {
  if (blobC === undefined) { blobC = null; const m = mk(128, 128); if (m) { const g = m.x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); m.x.fillStyle = g; m.x.fillRect(0, 0, 128, 128); blobC = m.c; } }
  const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a * (sprites.ready ? 0.4 : 1);
  if (blobC) ctx.drawImage(blobC, x - rx, y - ry, rx * 2, ry * 2);
  else { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y, rx * 0.7, ry * 0.7, 0, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = ga;
}

// a warm light pool (selected / moving pebble): one cached radial sprite
let lightC;
function light(ctx, x, y, r, a) {
  if (lightC === undefined) { lightC = null; const m = mk(128, 128); if (m) { const g = m.x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,226,150,0.85)'); g.addColorStop(0.5, 'rgba(255,200,110,0.35)'); g.addColorStop(1, 'rgba(255,190,90,0)'); m.x.fillStyle = g; m.x.fillRect(0, 0, 128, 128); lightC = m.c; } }
  const ga = ctx.globalAlpha; ctx.globalAlpha = ga * Math.min(1, a);
  if (lightC) ctx.drawImage(lightC, x - r, y - r, r * 2, r * 2);
  else { ctx.fillStyle = 'rgba(255,214,130,0.4)'; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = ga;
}

// Draws a pebble resting in the pit centred (x, y). opts: { lift (0..1, in half-cells), alpha, scale, glow, tilt, flash, squash }
export function drawPiece(ctx, v, style, x, y, cell, opts = {}) {
  const lift = opts.lift ?? 0, k = (cell / 100) * (opts.scale ?? 1) * 1.04;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) light(ctx, x, y + cell * 0.02, cell * 0.78, sprites.ready ? opts.glow * 0.45 : opts.glow);
  blob(ctx, x + cell * 0.02, y + cell * 0.2, cell * 0.42, cell * 0.14, 0.75 * (1 - lift * 0.8));                  // tight contact shadow in the pit
  blob(ctx, x + cell * (0.07 + lift * 0.12), y + cell * (0.17 + lift * 0.1), cell * (0.6 + lift * 0.1), cell * (0.3 + lift * 0.04), 0.4 - lift * 0.14);
  ctx.translate(x, y - lift * cell * 0.3);
  if (opts.tilt) ctx.rotate(opts.tilt);
  if (opts.squash) ctx.scale(1 + opts.squash * 0.12, 1 - opts.squash * 0.16);
  const p3 = sprites.ready && sprites.pebble[`${style}|${v}`];
  if (p3) ctx.drawImage(p3, -60 * k * 1.0, -73 * k, 120 * k, 120 * k);
  else { const s = sprite(v, style, cell * px() * (opts.scale ?? 1));
  if (s) ctx.drawImage(s, -60 * k, -70 * k, 120 * k, 120 * k);
  else { ctx.save(); ctx.scale(k, k); paintPiece(ctx, v, style); ctx.restore(); } }
  if (opts.flash) { ctx.fillStyle = `rgba(255,255,255,${opts.flash})`; ctx.beginPath(); ctx.ellipse(0, (TY + 2) * k, RX * k, RY * k, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// A little board for diagrams (Rules, How to Play, lessons): round pits in a sand patch with real pebbles.
// spec: { rows: ['..B...', ...] (B Indigo, W Ivory, . empty), marks: [[r,c,'ring'|'cross'|'dot'|'target']], hl: [[r,c,color]], arrows: [[r0,c0,r1,c1]] }
export function drawDiagram(ctx, spec, x, y, cellPx, kind = 'laterite', style = 'river') {
  const R = spec.rows.length, C = spec.rows[0].length, pal = BOARDS[kind] || BOARDS.laterite, m = cellPx * 0.18;
  const w = C * cellPx + 2 * m, h = R * cellPx + 2 * m;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 6, w, h, 10); ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, pal.top[0]); g.addColorStop(0.6, pal.top[1]); g.addColorStop(1, pal.top[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  const gx = x + m, gy = y + m;
  (spec.hl || []).forEach(([r, c, col]) => { ctx.fillStyle = col || 'rgba(255,236,150,0.55)'; ctx.beginPath(); ctx.arc(gx + (c + 0.5) * cellPx, gy + (r + 0.5) * cellPx, cellPx * 0.47, 0, TAU); ctx.fill(); });
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {                                     // the pits
    const cx = gx + (c + 0.5) * cellPx, cy = gy + (r + 0.5) * cellPx, pr = cellPx * 0.41;
    ctx.fillStyle = pal.lip; ctx.beginPath(); ctx.arc(cx + pr * 0.04, cy + pr * 0.07, pr + 1.5, 0, TAU); ctx.fill();
    const bowl = ctx.createRadialGradient(cx + pr * 0.3, cy + pr * 0.32, pr * 0.1, cx, cy, pr);
    bowl.addColorStop(0, pal.pit[1]); bowl.addColorStop(0.8, pal.pit[0]); bowl.addColorStop(1, 'rgba(40,18,6,0.9)');
    ctx.fillStyle = bowl; ctx.beginPath(); ctx.arc(cx, cy, pr, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,12,4,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  const val = { B: 1, W: 2 };
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const ch = spec.rows[r][c];
    if (val[ch]) drawPiece(ctx, val[ch], style, gx + (c + 0.5) * cellPx, gy + (r + 0.5) * cellPx, cellPx);
  }
  for (const [r, c, kind2] of spec.marks || []) {
    const cx = gx + (c + 0.5) * cellPx, cy = gy + (r + 0.5) * cellPx;
    ctx.lineWidth = Math.max(2, cellPx * 0.07);
    if (kind2 === 'cross') { ctx.strokeStyle = '#d6291f'; const q = cellPx * 0.28; ctx.beginPath(); ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q); ctx.moveTo(cx + q, cy - q); ctx.lineTo(cx - q, cy + q); ctx.stroke(); }
    else if (kind2 === 'ring') { ctx.strokeStyle = '#1f9e5a'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.3, 0, TAU); ctx.stroke(); }
    else if (kind2 === 'dot') { ctx.fillStyle = 'rgba(255,248,214,0.92)'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.13, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(70,40,10,0.6)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    else if (kind2 === 'target') { ctx.strokeStyle = '#d6291f'; ctx.beginPath(); ctx.arc(cx, cy, cellPx * 0.34, 0, TAU); ctx.stroke(); }
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
export { ROWS, COLS };
