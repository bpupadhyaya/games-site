// The tavern: a stone wall with a round arch, an oak table, and the carved board. Painted ONCE into cached layers.
// Light comes from the two candles (left and right) and from the upper left.
import { W, H, project, PT, pointAt, UNIT } from './layout.js';

const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
const rect = (U0, U1, V0, V1) => [project(U0, V0), project(U1, V0), project(U1, V1), project(U0, V1)];
export const TABLE_TOP = 690;

// Board woods: face gradient, frame, grain colour, groove colour
export const WOODS = {
  oak:    { face: ['#c69a5a', '#d8b071', '#b98a4c'], frame: ['#8a5a2e', '#6a4220', '#4a2c13'], grain: [110, 66, 26], groove: '#2b170a' },
  walnut: { face: ['#9c6a3e', '#b07c4a', '#875a32'], frame: ['#5a3620', '#41250f', '#2b1508'], grain: [60, 32, 14], groove: '#1d0e05' },
  ash:    { face: ['#e8d3a6', '#f3e2bb', '#d9c08c'], frame: ['#b08d5c', '#8f6d40', '#6b4f2c'], grain: [150, 112, 62], groove: '#4a3016' },
};
export const WOOD_NAMES = { oak: 'Oak', walnut: 'Walnut', ash: 'Pale ash' };

function stone(ctx, x, y, w, h, rnd, tone) {
  const base = 56 + rnd() * 26 + tone, r = base + 6, g = base - 2, b = base - 12;
  const gr = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  gr.addColorStop(0, `rgb(${r + 22},${g + 20},${b + 16})`); gr.addColorStop(0.5, `rgb(${r},${g},${b})`); gr.addColorStop(1, `rgb(${r - 22},${g - 20},${b - 18})`);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 5); ctx.fill();
  // chisel marks and pits
  ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) { const px = x + 8 + rnd() * (w - 16), py = y + 8 + rnd() * (h - 16); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 6 + rnd() * 14, py + (rnd() - 0.5) * 4); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,235,200,0.07)'; ctx.fillRect(x + 4, y + 3, w - 8, 2);
}

function paintWall(ctx) {
  const rnd = lcg(7);
  ctx.fillStyle = '#1b1612'; ctx.fillRect(0, 0, W, TABLE_TOP + 40);
  // ashlar blocks, running bond
  const rows = Math.ceil(TABLE_TOP / 58) + 1;
  for (let r = 0; r < rows; r++) {
    let x = -((r % 2) * 46) - rnd() * 20; const y = r * 58;
    while (x < W) { const w = 92 + rnd() * 70; stone(ctx, x, y, w, 58, rnd, (r < 3 ? -8 : 0)); x += w; }
  }
  // the arch: a deep recess with voussoirs
  const cx = 360, cy = 392, R = 262, baseY = TABLE_TOP;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(cx - R, baseY); ctx.lineTo(cx - R, cy); ctx.arc(cx, cy, R, Math.PI, 0); ctx.lineTo(cx + R, baseY); ctx.closePath(); ctx.clip();
  const rec = ctx.createLinearGradient(0, cy - R, 0, baseY); rec.addColorStop(0, '#0a0706'); rec.addColorStop(0.6, '#1a110c'); rec.addColorStop(1, '#2c1c11');
  ctx.fillStyle = rec; ctx.fillRect(cx - R, cy - R, R * 2, baseY);
  // rough back wall inside the recess
  for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(90,66,44,${0.03 + rnd() * 0.04})`; ctx.fillRect(cx - R + rnd() * R * 2, cy - R + rnd() * (baseY - cy + R), 60 + rnd() * 80, 24); }
  ctx.restore();
  // voussoir ring
  for (let i = 0; i < 15; i++) {
    const a0 = Math.PI + (i / 15) * Math.PI, a1 = Math.PI + ((i + 1) / 15) * Math.PI, r0 = R, r1 = R + 44;
    const gr = ctx.createLinearGradient(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0, cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
    const t = 74 + rnd() * 24; gr.addColorStop(0, `rgb(${t + 26},${t + 20},${t + 6})`); gr.addColorStop(1, `rgb(${t - 12},${t - 16},${t - 24})`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, r1, a0 + 0.012, a1 - 0.012); ctx.arc(cx, cy, r0, a1 - 0.012, a0 + 0.012, true); ctx.closePath(); ctx.fill();
  }
  // jambs
  for (let y = baseY - 62; y > cy - 10; y -= 62) for (const sx of [-1, 1]) { const x = sx < 0 ? cx - R - 44 : cx + R; stone(ctx, x, y, 44, 62, rnd, 14); }
  // a shallow stone shelf at the table's back edge
  const shelf = ctx.createLinearGradient(0, TABLE_TOP - 26, 0, TABLE_TOP + 20); shelf.addColorStop(0, '#8b7b62'); shelf.addColorStop(0.5, '#5e5040'); shelf.addColorStop(1, '#221912');
  ctx.fillStyle = shelf; ctx.fillRect(0, TABLE_TOP - 26, W, 46);
  ctx.fillStyle = 'rgba(255,240,205,0.25)'; ctx.fillRect(0, TABLE_TOP - 26, W, 2);
  // an iron lantern hook and a hanging herb bundle in the arch, for life
  ctx.strokeStyle = '#0d0907'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, cy - R + 4); ctx.lineTo(cx, cy - R + 80); ctx.stroke();
}

function paintTable(ctx) {
  const rnd = lcg(21);
  let y = TABLE_TOP + 20, i = 0;
  const bands = [];
  while (y < H + 40) { const h = 88 + i * 14 + rnd() * 16; bands.push([y, h]); y += h; i++; }
  for (const [y0, h] of bands) {
    const t = rnd() * 16;
    const gr = ctx.createLinearGradient(0, y0, 0, y0 + h);
    gr.addColorStop(0, `rgb(${92 + t},${58 + t * 0.6},${28 + t * 0.3})`); gr.addColorStop(0.45, `rgb(${112 + t},${72 + t * 0.6},${36 + t * 0.3})`); gr.addColorStop(1, `rgb(${70 + t},${43 + t * 0.5},${20 + t * 0.3})`);
    ctx.fillStyle = gr; ctx.fillRect(0, y0, W, h);
    // grain
    for (let k = 0; k < 34; k++) {
      const gy = y0 + 6 + rnd() * (h - 12), amp = 1.5 + rnd() * 3.5, ph = rnd() * 6, len = 200 + rnd() * 520, gx = rnd() * (W - len * 0.4) - 40;
      ctx.strokeStyle = rnd() < 0.5 ? `rgba(40,20,6,${0.10 + rnd() * 0.16})` : `rgba(230,170,100,${0.04 + rnd() * 0.07})`; ctx.lineWidth = 0.8 + rnd() * 1.4;
      ctx.beginPath(); ctx.moveTo(gx, gy); for (let s = 1; s <= 12; s++) ctx.lineTo(gx + (len * s) / 12, gy + Math.sin(ph + s * 0.7) * amp); ctx.stroke();
    }
    // plank joint
    ctx.fillStyle = 'rgba(8,4,1,0.75)'; ctx.fillRect(0, y0, W, 3); ctx.fillStyle = 'rgba(255,215,160,0.16)'; ctx.fillRect(0, y0 + 3, W, 2);
    // knots
    if (rnd() < 0.7) { const kx = 40 + rnd() * 640, ky = y0 + h * (0.3 + rnd() * 0.4), kr = 8 + rnd() * 10; for (let q = 3; q >= 0; q--) { ctx.strokeStyle = `rgba(35,17,5,${0.2 + (3 - q) * 0.08})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(kx, ky, kr * (0.4 + q * 0.3) * 1.8, kr * (0.4 + q * 0.3), 0, 0, TAU); ctx.stroke(); } }
  }
  // wear: scratches, a mug ring, a wax drip
  ctx.strokeStyle = 'rgba(20,10,4,0.28)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(628, 1490, 44, 0.3, 5.7); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,170,0.10)'; ctx.lineWidth = 1; for (let k = 0; k < 60; k++) { const x = rnd() * W, yy = TABLE_TOP + 40 + rnd() * (H - TABLE_TOP - 40); ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + (rnd() - 0.5) * 60, yy + (rnd() - 0.5) * 12); ctx.stroke(); }
  // shadow under the stone shelf
  const sh = ctx.createLinearGradient(0, TABLE_TOP + 20, 0, TABLE_TOP + 110); sh.addColorStop(0, 'rgba(0,0,0,0.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sh; ctx.fillRect(0, TABLE_TOP + 20, W, 90);
}

// A brass candlestick with a wax candle; the flame is drawn each frame (view.js).
export const CANDLES = [{ x: 74, y: 720, top: 610 }, { x: 646, y: 720, top: 610 }];
function paintCandles(ctx) {
  for (const c of CANDLES) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(c.x + 14, c.y + 8, 44, 12, 0, 0, TAU); ctx.fill();
    const wax = ctx.createLinearGradient(c.x - 12, 0, c.x + 12, 0); wax.addColorStop(0, '#d9c7a0'); wax.addColorStop(0.45, '#f6ead0'); wax.addColorStop(1, '#a8946a');
    ctx.fillStyle = wax; ctx.beginPath(); ctx.roundRect(c.x - 12, c.top, 24, c.y - c.top - 14, 4); ctx.fill();
    ctx.fillStyle = 'rgba(246,234,208,0.9)'; ctx.beginPath(); ctx.ellipse(c.x, c.top, 12, 4, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a2016'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c.x, c.top); ctx.lineTo(c.x, c.top - 8); ctx.stroke();
    const br = ctx.createLinearGradient(c.x - 34, 0, c.x + 34, 0); br.addColorStop(0, '#6a4a12'); br.addColorStop(0.35, '#f0cf78'); br.addColorStop(1, '#5a3d0c');
    ctx.fillStyle = br; ctx.beginPath(); ctx.ellipse(c.x, c.y, 34, 10, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.roundRect(c.x - 9, c.y - 30, 18, 30, 4); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x, c.y - 30, 17, 5, 0, 0, TAU); ctx.fill();
  }
}

function paintBoard(ctx, wood) {
  const WD = WOODS[wood] ?? WOODS.oak, rnd = lcg(99);
  const outer = rect(-3.62, 3.62, -0.62, 6.62), face = rect(-3.46, 3.46, -0.46, 6.46);
  // shadow on the table
  for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(0,0,0,0.07)'; poly(ctx, outer.map((p) => ({ x: p.x + 8 + i * 2.6, y: p.y + 20 + i * 4.5 }))); ctx.fill(); }
  // the board's thick edge (seen at the near side)
  const nearL = outer[3], nearR = outer[2], th = 26;
  ctx.fillStyle = WD.frame[2]; poly(ctx, [nearL, nearR, { x: nearR.x, y: nearR.y + th }, { x: nearL.x, y: nearL.y + th }]); ctx.fill();
  const eg = ctx.createLinearGradient(0, nearL.y, 0, nearL.y + th); eg.addColorStop(0, WD.frame[1]); eg.addColorStop(1, '#1c0f06'); ctx.fillStyle = eg; poly(ctx, [nearL, nearR, { x: nearR.x, y: nearR.y + th }, { x: nearL.x, y: nearL.y + th }]); ctx.fill();
  // frame
  const fg = ctx.createLinearGradient(0, outer[0].y, 0, outer[3].y); fg.addColorStop(0, WD.frame[0]); fg.addColorStop(0.6, WD.frame[1]); fg.addColorStop(1, WD.frame[2]);
  ctx.fillStyle = fg; poly(ctx, outer); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,160,0.35)'; ctx.lineWidth = 2; poly(ctx, outer); ctx.stroke();
  // the carved panel face
  const pg = ctx.createLinearGradient(face[0].x, face[0].y, face[2].x, face[2].y); pg.addColorStop(0, WD.face[1]); pg.addColorStop(0.5, WD.face[0]); pg.addColorStop(1, WD.face[2]);
  ctx.save(); poly(ctx, face); ctx.clip(); ctx.fillStyle = pg; ctx.fillRect(0, 0, W, H);
  // grain along the board
  const [gr, gg, gb] = WD.grain;
  for (let k = 0; k < 120; k++) {
    const v0 = -0.5 + rnd() * 7, amp = 0.02 + rnd() * 0.06, ph = rnd() * 6, u0 = -3.6 + rnd() * 2, u1 = u0 + 2 + rnd() * 5;
    ctx.strokeStyle = `rgba(${gr},${gg},${gb},${0.05 + rnd() * 0.14})`; ctx.lineWidth = (0.7 + rnd() * 1.6) * UNIT;
    ctx.beginPath(); for (let s = 0; s <= 12; s++) { const u = u0 + ((u1 - u0) * s) / 12, p = project(u, v0 + Math.sin(ph + s * 0.8) * amp); if (s) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); } ctx.stroke();
  }
  // candle warmth, brighter at the far corners, and dark edges of use
  for (const [u, v] of [[-3.4, -0.4], [3.4, -0.4]]) { const p = project(u, v), g2 = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 380); g2.addColorStop(0, 'rgba(255,214,140,0.30)'); g2.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H); }
  const ctr = project(0, 3), vg = ctx.createRadialGradient(ctr.x, ctr.y, 150, ctr.x, ctr.y, 470); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,18,4,0.32)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // fine cracks and dents
  for (let k = 0; k < 26; k++) { const u = -3.3 + rnd() * 6.6, v = -0.3 + rnd() * 6.6, p = project(u, v); ctx.strokeStyle = 'rgba(40,20,6,0.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + (rnd() - 0.5) * 34, p.y + (rnd() - 0.5) * 8); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(30,14,4,0.75)'; ctx.lineWidth = 3; poly(ctx, face); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,225,170,0.4)'; ctx.lineWidth = 1.5; poly(ctx, face.map((p, i) => ({ x: p.x + (i === 0 || i === 3 ? 2.5 : -2.5), y: p.y + 2.5 }))); ctx.stroke();

  // carved grooves: three squares and four spokes
  const segs = [];
  for (let r = 0; r < 3; r++) for (let k = 0; k < 8; k++) segs.push([r * 8 + k, r * 8 + ((k + 1) % 8)]);
  for (let k = 1; k < 8; k += 2) { segs.push([k, 8 + k]); segs.push([8 + k, 16 + k]); }
  const groove = (a, b, w, col, dx = 0, dy = 0) => { const p = pointAt(a), q = pointAt(b); ctx.strokeStyle = col; ctx.lineWidth = w * ((p.s + q.s) / 2) * UNIT; ctx.beginPath(); ctx.moveTo(p.x + dx, p.y + dy); ctx.lineTo(q.x + dx, q.y + dy); ctx.stroke(); };
  ctx.lineCap = 'round';
  for (const [a, b] of segs) groove(a, b, 12, 'rgba(255,228,175,0.42)', 1.2, 2.6);       // lit lower lip
  for (const [a, b] of segs) groove(a, b, 11, WD.groove);                                     // the cut
  for (const [a, b] of segs) groove(a, b, 5.2, 'rgba(0,0,0,0.55)', -0.5, 0.8);              // deepest part
  for (const [a, b] of segs) groove(a, b, 1.8, 'rgba(255,220,160,0.14)', -3, -2.2);         // worn upper edge
  ctx.lineCap = 'butt';
  // worn spots along the grooves (bright where hands pass)
  for (let k = 0; k < 40; k++) { const [a, b] = segs[Math.floor(rnd() * segs.length)], t = rnd(), p = pointAt(a), q = pointAt(b), x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t; ctx.fillStyle = `rgba(255,225,170,${0.06 + rnd() * 0.08})`; ctx.beginPath(); ctx.ellipse(x, y, 10 * p.s, 5 * p.s, 0, 0, TAU); ctx.fill(); }
  // carved pits at the 24 points
  for (let i = 0; i < 24; i++) {
    const p = pointAt(i), r = 19 * p.s * UNIT;
    ctx.fillStyle = 'rgba(255,228,175,0.38)'; ctx.beginPath(); ctx.ellipse(p.x + 1, p.y + 3, r + 2, r * 0.86 + 2, 0, 0, TAU); ctx.fill();
    const g3 = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 1, p.x, p.y, r);
    g3.addColorStop(0, '#0b0503'); g3.addColorStop(0.7, WD.groove); g3.addColorStop(1, 'rgba(70,36,12,0.9)');
    ctx.fillStyle = g3; ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.86, 0, 0, TAU); ctx.fill();
  }
  // brass studs in the corners of the frame
  for (const c of outer.map((p, i) => ({ x: p.x + (i === 0 || i === 3 ? 20 : -20) * p.s, y: p.y + (i < 2 ? 18 : -18) * p.s, s: p.s }))) {
    const g4 = ctx.createRadialGradient(c.x - 3, c.y - 3, 1, c.x, c.y, 9 * c.s); g4.addColorStop(0, '#fff0b0'); g4.addColorStop(1, '#8a6218'); ctx.fillStyle = g4; ctx.beginPath(); ctx.arc(c.x, c.y, 9 * c.s, 0, TAU); ctx.fill();
  }
}

const layers = {};
function cached(key, paint) {
  if (!(key in layers)) {
    layers[key] = null;
    try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(W * 2, H * 2), l = c.getContext('2d'); l.scale(2, 2); paint(l); layers[key] = c; } } catch { layers[key] = null; }
  }
  return layers[key];
}
export function drawRoom(ctx) {
  const c = cached('room', (l) => { paintWall(l); paintTable(l); paintCandles(l); });
  if (c) ctx.drawImage(c, 0, 0, W, H); else { paintWall(ctx); paintTable(ctx); paintCandles(ctx); }
}
export function drawBoard(ctx, wood = 'oak') {
  const c = cached('board-' + wood, (l) => paintBoard(l, wood));
  if (c) ctx.drawImage(c, 0, 0, W, H); else paintBoard(ctx, wood);
}
