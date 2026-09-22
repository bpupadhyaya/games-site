// The room, the board and the pieces. Everything static is painted ONCE into cached layers/sprites.
// One light: a hearth low on the left, so highlights sit up-left of every shape and shadows fall down-right.
import { W, H, BX, BY, BS, cell, centerOf } from './layout.js';
import { throne, corners, isCorner } from './rules.js';

const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// ---- knotwork: two ribbons weaving over and under, used for the frame and the title band ----------------
export function braid(ctx, x0, y0, len, amp, wid, cols, period = 46) {
  // horizontal band starting at (x0, y0) running `len` to the right. cols = [dark, mid, light]
  const half = period / 2, steps = Math.ceil(len / 2);
  const path = (ph, a, b) => { ctx.beginPath(); for (let i = a; i <= b; i++) { const x = i * 2, y = Math.sin((x / period) * Math.PI + ph) * amp; i === a ? ctx.moveTo(x0 + x, y0 + y) : ctx.lineTo(x0 + x, y0 + y); } };
  const stroke = (ph, a, b) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    path(ph, a, b); ctx.strokeStyle = cols[0]; ctx.lineWidth = wid + 5; ctx.stroke();
    path(ph, a, b); ctx.strokeStyle = cols[1]; ctx.lineWidth = wid; ctx.stroke();
    path(ph, a, b); ctx.strokeStyle = cols[2]; ctx.lineWidth = wid * 0.32; ctx.translate(-0.8, -1.2); ctx.stroke(); ctx.translate(0.8, 1.2);
  };
  stroke(0, 0, steps); stroke(Math.PI, 0, steps);
  // at every crossing (x = k*half) redraw one ribbon over the other, alternating
  for (let k = 0; k * half <= len; k++) {
    const a = Math.max(0, Math.floor((k * half - 9) / 2)), b = Math.min(steps, Math.ceil((k * half + 9) / 2));
    stroke(k % 2 ? 0 : Math.PI, a, b);
  }
}

// ---- static scene ----------------------------------------------------------------------------------------
function paintRoom(ctx) {
  const rnd = lcg(7);
  // timber wall: vertical planks in dark smoked oak
  const plank = 90;
  for (let i = 0; i * plank < W + plank; i++) {
    const x = i * plank, sh = 0.85 + rnd() * 0.3;
    const g = ctx.createLinearGradient(x, 0, x + plank, 0);
    g.addColorStop(0, `rgb(${34 * sh | 0},${22 * sh | 0},${15 * sh | 0})`); g.addColorStop(0.5, `rgb(${44 * sh | 0},${29 * sh | 0},${19 * sh | 0})`); g.addColorStop(1, `rgb(${28 * sh | 0},${18 * sh | 0},${12 * sh | 0})`);
    ctx.fillStyle = g; ctx.fillRect(x, 0, plank, H);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    for (let k = 0; k < 26; k++) { ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '10,5,2' : '80,55,30'},${0.10 + rnd() * 0.12})`; ctx.lineWidth = 1 + rnd(); const gx = x + 6 + rnd() * (plank - 12); ctx.beginPath(); ctx.moveTo(gx, rnd() * H); ctx.bezierCurveTo(gx + 6, rnd() * H, gx - 6, rnd() * H, gx + 2, rnd() * H); ctx.stroke(); }
  }
  // roof beam across the top with a braid band, and a hearth-stone ledge at the bottom
  const beam = ctx.createLinearGradient(0, 0, 0, 120);
  beam.addColorStop(0, '#1a0f09'); beam.addColorStop(0.6, '#3a2415'); beam.addColorStop(1, '#180d07');
  ctx.fillStyle = beam; ctx.fillRect(0, 0, W, 118);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 118, W, 8);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 20, W, 78); ctx.clip();
  braid(ctx, -10, 59, W + 20, 15, 11, ['#1a0e06', '#8c6a34', '#d9b56a'], 60); ctx.restore();
  const floor = ctx.createLinearGradient(0, H - 190, 0, H);
  floor.addColorStop(0, 'rgba(0,0,0,0)'); floor.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = floor; ctx.fillRect(0, H - 190, W, 190);
}

function paintBoard(ctx, n) {
  const cs = cell(n), rnd = lcg(31 + n);
  const FR = 34;                                       // width of the carved frame
  const ox = BX - FR, oy = BY - FR, ow = BS + FR * 2;
  // drop shadow on the table
  for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(0,0,0,0.09)'; rr(ctx, ox + 6 + i * 3, oy + 14 + i * 4, ow, ow, 26); ctx.fill(); }
  // frame slab: dark oak
  const fg = ctx.createLinearGradient(ox, oy, ox + ow, oy + ow);
  fg.addColorStop(0, '#4b2f1a'); fg.addColorStop(0.5, '#33200f'); fg.addColorStop(1, '#22140a');
  ctx.fillStyle = fg; rr(ctx, ox, oy, ow, ow, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,150,0.35)'; ctx.lineWidth = 2; rr(ctx, ox + 1, oy + 1, ow - 2, ow - 2, 22); ctx.stroke();
  // braid on the four sides of the frame
  const cols = ['#150b05', '#a07a3c', '#e8c77e'];
  for (let s = 0; s < 4; s++) {
    ctx.save(); ctx.translate(ox + ow / 2, oy + ow / 2); ctx.rotate((s * Math.PI) / 2); ctx.translate(-ow / 2, -ow / 2);
    ctx.beginPath(); ctx.rect(30, 3, ow - 60, FR - 6); ctx.clip();
    braid(ctx, 30, FR / 2, ow - 60, 6.5, 6.5, cols, 34);
    ctx.restore();
  }
  // corner bosses of the frame
  for (const [cx, cy] of [[ox + FR / 2, oy + FR / 2], [ox + ow - FR / 2, oy + FR / 2], [ox + FR / 2, oy + ow - FR / 2], [ox + ow - FR / 2, oy + ow - FR / 2]]) {
    const g = ctx.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, 17);
    g.addColorStop(0, '#f1d590'); g.addColorStop(0.6, '#a57d3b'); g.addColorStop(1, '#4a3016');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,10,4,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(20,10,4,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU); ctx.stroke();
  }
  // playing surface: recessed dark oak
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; rr(ctx, BX - 5, BY - 5, BS + 10, BS + 10, 6); ctx.fill();
  const face = ctx.createLinearGradient(BX, BY, BX + BS, BY + BS);
  face.addColorStop(0, '#6b4526'); face.addColorStop(0.5, '#573719'); face.addColorStop(1, '#442a12');
  ctx.fillStyle = face; ctx.fillRect(BX, BY, BS, BS);
  // grain
  ctx.save(); ctx.beginPath(); ctx.rect(BX, BY, BS, BS); ctx.clip();
  for (let k = 0; k < 90; k++) {
    ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '25,12,4' : '150,105,60'},${0.08 + rnd() * 0.12})`; ctx.lineWidth = 1 + rnd() * 1.6;
    const y = BY + rnd() * BS; ctx.beginPath(); ctx.moveTo(BX, y); ctx.bezierCurveTo(BX + BS * 0.3, y + (rnd() - 0.5) * 24, BX + BS * 0.6, y + (rnd() - 0.5) * 24, BX + BS, y + (rnd() - 0.5) * 12); ctx.stroke();
  }
  // squares: subtle checker of shade so each square reads as its own carved cell
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const px = BX + x * cs, py = BY + y * cs;
    ctx.fillStyle = (x + y) % 2 ? 'rgba(0,0,0,0.10)' : 'rgba(255,200,130,0.04)'; ctx.fillRect(px, py, cs, cs);
  }
  // carved grooves: dark line with a light lip below/right
  for (let i = 0; i <= n; i++) {
    const p = BX + i * cs, q = BY + i * cs;
    ctx.strokeStyle = 'rgba(12,5,1,0.85)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(p, BY); ctx.lineTo(p, BY + BS); ctx.moveTo(BX, q); ctx.lineTo(BX + BS, q); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,205,140,0.20)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(p + 1.8, BY); ctx.lineTo(p + 1.8, BY + BS); ctx.moveTo(BX, q + 1.8); ctx.lineTo(BX + BS, q + 1.8); ctx.stroke();
  }
  ctx.restore();
  // corner squares: deeper stain, a carved diamond with an inner knot
  const mark = (i, fill, inner) => {
    const c = centerOf(n, i), h = cs / 2 - 3;
    ctx.fillStyle = fill; ctx.fillRect(c.x - cs / 2 + 2, c.y - cs / 2 + 2, cs - 4, cs - 4);
    ctx.save(); ctx.translate(c.x, c.y);
    ctx.strokeStyle = 'rgba(240,200,120,0.75)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(0, -h + 2); ctx.lineTo(h - 2, 0); ctx.lineTo(0, h - 2); ctx.lineTo(-h + 2, 0); ctx.closePath(); ctx.stroke();
    const h2 = h * 0.56; ctx.strokeStyle = 'rgba(15,6,2,0.8)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(0, -h2); ctx.lineTo(h2, 0); ctx.lineTo(0, h2); ctx.lineTo(-h2, 0); ctx.closePath(); ctx.stroke();
    if (inner) { ctx.strokeStyle = 'rgba(240,200,120,0.6)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-h2, -h2 * 0.0); ctx.lineTo(h2, 0); ctx.moveTo(0, -h2); ctx.lineTo(0, h2); ctx.stroke(); }
    ctx.restore();
  };
  for (const c of corners(n)) mark(c, 'rgba(70,14,10,0.62)', false);
  mark(throne(n), 'rgba(140,90,20,0.30)', true);
}

// Cached layers, one per board size (2x resolution).
const layers = {};
function layer(n) {
  if (n in layers) return layers[n];
  layers[n] = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(W * 2, H * 2), l = c.getContext('2d'); l.scale(2, 2);
      paintRoom(l); if (n) paintBoard(l, n); layers[n] = c;
    }
  } catch { layers[n] = null; }
  return layers[n];
}
export function drawScene(ctx, n, t, calm) {
  const c = layer(n);
  if (c) ctx.drawImage(c, 0, 0, W, H); else { paintRoom(ctx); if (n) paintBoard(ctx, n); }
  // the hearth: a slow flicker of warm light from the lower left, and a few drifting embers
  const fl = calm ? 1 : 0.93 + 0.05 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 13.1 + 1);
  const g = ctx.createRadialGradient(40, 1420, 20, 40, 1420, 900);
  g.addColorStop(0, `rgba(255,150,60,${0.30 * fl})`); g.addColorStop(0.5, `rgba(255,110,30,${0.09 * fl})`); g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (!calm) for (let k = 0; k < 9; k++) {
    const ph = (t * (0.05 + (k % 3) * 0.02) + k * 0.113) % 1, x = 30 + ((k * 97) % 260) + Math.sin(t * 0.8 + k) * 22, y = 1500 - ph * 900;
    ctx.fillStyle = `rgba(255,${150 + (k % 4) * 20},70,${0.55 * (1 - ph) * Math.min(1, ph * 8)})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + (k % 3), 0, TAU); ctx.fill();
  }
}

// ---- pieces: carved bone and dark horn ----------------------------------------------------------------------
// attackers: round discs of dark horn, ringed. defenders: pale bone, eight-sided. king: taller bone, gilt crown.
function paintPiece(ctx, kind, R) {
  const cx = R * 1.35, cy = R * 1.25;                                          // sprite centre (room for shadow and lift)
  const light = (x, y, r, a, b, c) => { const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05); g.addColorStop(0, a); g.addColorStop(0.55, b); g.addColorStop(1, c); return g; };
  const octo = (x, y, r) => { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i + 0.5) * TAU / 8; i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); };
  const shape = kind === 'A' ? (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); } : octo;
  const T = R * 0.16;                                                           // thickness of the piece seen from above
  // edge (the side wall)
  ctx.fillStyle = kind === 'A' ? '#0d0a08' : kind === 'K' ? '#7a5d2c' : '#8f7f62';
  shape(cx, cy + T, R); ctx.fill();
  // top face
  const [a, b, c] = kind === 'A' ? ['#7a6d62', '#3a322c', '#161210'] : kind === 'K' ? ['#fff4d6', '#e6d3a0', '#a88f58'] : ['#fbf1d8', '#dccb9e', '#a8966c'];
  ctx.fillStyle = light(cx, cy, R, a, b, c); shape(cx, cy, R); ctx.fill();
  ctx.strokeStyle = kind === 'A' ? 'rgba(255,235,210,0.30)' : 'rgba(255,255,255,0.65)'; ctx.lineWidth = R * 0.05; shape(cx, cy, R - R * 0.03); ctx.stroke();
  ctx.strokeStyle = kind === 'A' ? 'rgba(0,0,0,0.75)' : 'rgba(70,45,15,0.55)'; ctx.lineWidth = R * 0.05; shape(cx, cy, R); ctx.stroke();
  // carved ring and grain
  ctx.strokeStyle = kind === 'A' ? 'rgba(0,0,0,0.6)' : 'rgba(90,60,25,0.5)'; ctx.lineWidth = R * 0.07; shape(cx, cy, R * 0.68); ctx.stroke();
  ctx.strokeStyle = kind === 'A' ? 'rgba(255,230,200,0.16)' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = R * 0.03; shape(cx + R * 0.02, cy + R * 0.03, R * 0.68); ctx.stroke();
  const rnd = lcg(kind.charCodeAt(0) * 13);
  ctx.save(); shape(cx, cy, R * 0.66); ctx.clip();
  for (let k = 0; k < 7; k++) { ctx.strokeStyle = kind === 'A' ? `rgba(200,180,160,${0.05 + rnd() * 0.06})` : `rgba(120,85,40,${0.10 + rnd() * 0.10})`; ctx.lineWidth = 1; const y = cy + (rnd() - 0.5) * R * 1.2; ctx.beginPath(); ctx.moveTo(cx - R, y); ctx.quadraticCurveTo(cx, y + (rnd() - 0.5) * R * 0.4, cx + R, y + (rnd() - 0.5) * R * 0.3); ctx.stroke(); }
  ctx.restore();
  if (kind === 'A') {                              // a raised boss in the middle
    ctx.fillStyle = light(cx, cy, R * 0.28, '#8d8074', '#3d352e', '#0f0c0a'); ctx.beginPath(); ctx.arc(cx, cy, R * 0.27, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = R * 0.05; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,225,190,0.3)'; ctx.lineWidth = R * 0.03; ctx.beginPath(); ctx.arc(cx - R * 0.02, cy - R * 0.02, R * 0.2, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
  } else if (kind === 'D') {                       // carved interlaced square
    ctx.strokeStyle = 'rgba(80,50,18,0.75)'; ctx.lineWidth = R * 0.07; ctx.lineJoin = 'round';
    const q = R * 0.27; ctx.strokeRect(cx - q, cy - q, q * 2, q * 2);
    ctx.beginPath(); ctx.moveTo(cx, cy - q * 1.5); ctx.lineTo(cx + q * 1.5, cy); ctx.lineTo(cx, cy + q * 1.5); ctx.lineTo(cx - q * 1.5, cy); ctx.closePath(); ctx.stroke();
  } else {                                         // the king: gilt band and a crown of points
    ctx.strokeStyle = '#c99a3c'; ctx.lineWidth = R * 0.12; shape(cx, cy, R * 0.86); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,180,0.7)'; ctx.lineWidth = R * 0.03; shape(cx - R * 0.02, cy - R * 0.03, R * 0.86); ctx.stroke();
    ctx.fillStyle = light(cx, cy, R * 0.5, '#ffe9a0', '#d9a648', '#8a5f1a');
    ctx.strokeStyle = 'rgba(60,35,8,0.85)'; ctx.lineWidth = R * 0.05; ctx.lineJoin = 'round';
    const u = R * 0.5; ctx.beginPath(); ctx.moveTo(cx - u, cy + u * 0.5); ctx.lineTo(cx - u, cy - u * 0.55); ctx.lineTo(cx - u * 0.45, cy - u * 0.1); ctx.lineTo(cx, cy - u * 0.85); ctx.lineTo(cx + u * 0.45, cy - u * 0.1); ctx.lineTo(cx + u, cy - u * 0.55); ctx.lineTo(cx + u, cy + u * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a1d18'; ctx.beginPath(); ctx.arc(cx, cy + u * 0.05, u * 0.18, 0, TAU); ctx.fill();
  }
  return { cx, cy, w: Math.ceil(cx * 2), h: Math.ceil(cy * 2 + T) };
}
const sprites = {};
export const pieceRadius = (n, kind) => cell(n) * (kind === 'K' ? 0.46 : 0.41);
function sprite(n, kind) {
  const k = n + kind;
  if (k in sprites) return sprites[k];
  sprites[k] = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const R = pieceRadius(n, kind), S = 2, box = Math.ceil(R * 2.9 * S), c = new OffscreenCanvas(box, box), s = c.getContext('2d');
      s.scale(S, S); const m = paintPiece(s, kind, R); sprites[k] = { c, m, S };
    }
  } catch { sprites[k] = null; }
  return sprites[k];
}
// Draw a piece centred on (x, y). opts: lift (0..1 raises it and grows the shadow), alpha, scale
export function drawPiece(ctx, n, kind, x, y, o = {}) {
  const R = pieceRadius(n, kind) * (o.scale ?? 1), lift = o.lift ?? 0;
  ctx.save(); if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.fillStyle = `rgba(0,0,0,${0.32 - lift * 0.1})`; ctx.beginPath(); ctx.ellipse(x + R * (0.16 + lift * 0.3), y + R * (0.28 + lift * 0.5), R * 1.02, R * 0.86, 0, 0, TAU); ctx.fill();
  const sp = sprite(n, kind), k = (o.scale ?? 1);
  if (sp) { const w = sp.c.width / sp.S * k, h = sp.c.height / sp.S * k, s = sp.S; ctx.drawImage(sp.c, x - sp.m.cx * k, y - R * 0.16 * k - lift * R * 0.5 - sp.m.cy * k + R * 0.16 * k, w, h); void s; }
  else { ctx.fillStyle = kind === 'A' ? '#2a2420' : '#e6d3a0'; ctx.beginPath(); ctx.arc(x, y - lift * R * 0.5, R, 0, TAU); ctx.fill(); }
  ctx.restore();
}
export { isCorner };
