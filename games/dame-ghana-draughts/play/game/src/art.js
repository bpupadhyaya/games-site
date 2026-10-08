// The table and the carved board. One light, from the upper left.
// Both are painted once into cached layers (the board per wood, size and grid; the table per screen size) and drawn scaled.
// The woven strips are plain geometry in the spirit of strip-woven cloth patterns: craft only, no symbols.
export const WOODS = ['teak', 'ebony'];
export const WOOD_NAMES = { teak: 'Teak', ebony: 'Ebony' };
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const WEAVE = ['#e8b23a', '#b8322a', '#2e7d4f', '#17100c', '#f1e2bd'];

// The board is painted in a 1000-unit square; the playing grid sits inside a frame of F units.
export const SLAB = 1000, FRAME = 76;
export const cellOf = (n) => (SLAB - 2 * FRAME) / n;

// A strip of woven tiles from (x0,y0) to (x1,y1) (axis aligned), `rows` tiles thick. Phase offsets the pattern.
function weaveStrip(c, x, y, w, h, tile, phase = 0) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  const cols = Math.ceil(w / tile), rows = Math.ceil(h / tile);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = (i + phase + j * 2) % 10, base = WEAVE[[3, 0, 3, 1, 3, 2, 3, 0, 3, 4][k]], mark = WEAVE[[0, 3, 1, 3, 2, 3, 4, 3, 0, 3][(k + j) % 10]];
    const tx = x + i * tile, ty = y + j * tile;
    c.fillStyle = base; c.fillRect(tx, ty, tile, tile);
    c.fillStyle = mark; c.beginPath(); c.moveTo(tx + tile / 2, ty + tile * 0.14); c.lineTo(tx + tile * 0.86, ty + tile / 2); c.lineTo(tx + tile / 2, ty + tile * 0.86); c.lineTo(tx + tile * 0.14, ty + tile / 2); c.closePath(); c.fill();
  }
  // a little thread shading so it reads as cloth, not flat tiles
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
  c.fillStyle = g; c.fillRect(x, y, w, h);
  c.restore();
}

function grain(c, x, y, w, h, seed, alpha, dark) {
  const rnd = lcg(seed);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  for (let i = 0; i < 70; i++) {
    const yy = y + rnd() * h, amp = 2 + rnd() * 8, ph = rnd() * 6, len = 0.3 + rnd() * 0.7, x0 = x + rnd() * w * (1 - len);
    c.strokeStyle = rnd() < 0.5 ? `rgba(0,0,0,${alpha * (0.4 + rnd())})` : `rgba(${dark ? '255,220,170' : '255,236,200'},${alpha * 0.55 * (0.4 + rnd())})`;
    c.lineWidth = 0.6 + rnd() * 2.2; c.beginPath();
    for (let t = 0; t <= 24; t++) { const px = x0 + (w * len * t) / 24, py = yy + Math.sin(ph + t * 0.5) * amp; if (t) c.lineTo(px, py); else c.moveTo(px, py); }
    c.stroke();
  }
  c.restore();
}

// ---- the board, in 1000-unit space -----------------------------------------------------------------------------------
function paintBoard(c, wood, n) {
  const ebony = wood === 'ebony', cell = cellOf(n), F = FRAME;
  const rr = (x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
  // slab + frame wood
  rr(0, 0, SLAB, SLAB, 34);
  const fg = c.createLinearGradient(0, 0, SLAB, SLAB);
  if (ebony) { fg.addColorStop(0, '#4a3529'); fg.addColorStop(0.5, '#2a1c14'); fg.addColorStop(1, '#17100b'); } else { fg.addColorStop(0, '#a56a32'); fg.addColorStop(0.5, '#7b4a20'); fg.addColorStop(1, '#4e2c12'); }
  c.fillStyle = fg; c.fill();
  c.save(); rr(0, 0, SLAB, SLAB, 34); c.clip(); grain(c, 0, 0, SLAB, SLAB, ebony ? 31 : 17, ebony ? 0.16 : 0.2, ebony); c.restore();
  // bevel: bright top-left edge, dark bottom-right edge
  c.lineWidth = 5; rr(3, 3, SLAB - 6, SLAB - 6, 31);
  const bg = c.createLinearGradient(0, 0, SLAB, SLAB); bg.addColorStop(0, 'rgba(255,230,180,0.5)'); bg.addColorStop(0.5, 'rgba(255,230,180,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.strokeStyle = bg; c.stroke();
  // woven band
  const b0 = 18, bw = 30, tile = 15;
  c.save(); c.beginPath(); c.rect(b0, b0, SLAB - 2 * b0, SLAB - 2 * b0); c.rect(b0 + bw, b0 + bw, SLAB - 2 * (b0 + bw), SLAB - 2 * (b0 + bw)); c.clip('evenodd');
  weaveStrip(c, b0, b0, SLAB - 2 * b0, bw, tile, 0);
  weaveStrip(c, b0, SLAB - b0 - bw, SLAB - 2 * b0, bw, tile, 3);
  weaveStrip(c, b0, b0 + bw, bw, SLAB - 2 * (b0 + bw), tile, 1);
  weaveStrip(c, SLAB - b0 - bw, b0 + bw, bw, SLAB - 2 * (b0 + bw), tile, 5);
  c.restore();
  for (const [o, col, w] of [[b0, 'rgba(0,0,0,0.55)', 3], [b0 + bw, 'rgba(0,0,0,0.6)', 3], [b0 - 3, 'rgba(255,230,180,0.35)', 2]]) { c.strokeStyle = col; c.lineWidth = w; c.strokeRect(o, o, SLAB - 2 * o, SLAB - 2 * o); }
  // inner wood strip (carries the file and rank letters) - a slightly darker, recessed ledge
  const ledge = b0 + bw + 2;
  c.fillStyle = ebony ? 'rgba(0,0,0,0.28)' : 'rgba(40,18,4,0.3)'; c.fillRect(ledge, ledge, SLAB - 2 * ledge, SLAB - 2 * ledge);
  // the playing field
  const fx = F, fs = SLAB - 2 * F;
  c.save(); c.shadowColor = 'rgba(0,0,0,0.65)'; c.shadowBlur = 14; c.shadowOffsetX = 3; c.shadowOffsetY = 4; c.fillStyle = '#000'; c.fillRect(fx - 2, fx - 2, fs + 4, fs + 4); c.restore();
  const lg = c.createLinearGradient(fx, fx, fx + fs, fx + fs); lg.addColorStop(0, '#f1dba8'); lg.addColorStop(1, '#d8b878');
  c.fillStyle = lg; c.fillRect(fx, fx, fs, fs);
  grain(c, fx, fx, fs, fs, 9, 0.09, false);
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) {
    if ((r + q) % 2 !== 1) continue;
    const x = fx + q * cell, y = fx + r * cell;
    const dg = c.createLinearGradient(x, y, x + cell, y + cell);
    if (ebony) { dg.addColorStop(0, '#3a271a'); dg.addColorStop(1, '#52382a'); } else { dg.addColorStop(0, '#5b3517'); dg.addColorStop(1, '#7a4a22'); }
    c.fillStyle = dg; c.fillRect(x, y, cell, cell);
    // carved in: shadow along the top and left walls, light catching the bottom and right walls
    const w = Math.max(2, cell * 0.075);
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x, y, cell, w); c.fillRect(x, y, w, cell);
    c.fillStyle = 'rgba(255,225,170,0.22)'; c.fillRect(x, y + cell - w * 0.6, cell, w * 0.6); c.fillRect(x + cell - w * 0.6, y, w * 0.6, cell);
    // a faint carved diamond in the floor of each dark square
    c.strokeStyle = 'rgba(255,225,170,0.07)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + cell / 2, y + cell * 0.2); c.lineTo(x + cell * 0.8, y + cell / 2); c.lineTo(x + cell / 2, y + cell * 0.8); c.lineTo(x + cell * 0.2, y + cell / 2); c.closePath(); c.stroke();
  }
  grain(c, fx, fx, fs, fs, 23, 0.07, true);
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3; c.strokeRect(fx, fx, fs, fs);
  // a light glaze from the upper left
  const gl = c.createLinearGradient(0, 0, SLAB, SLAB); gl.addColorStop(0, 'rgba(255,240,210,0.16)'); gl.addColorStop(0.45, 'rgba(255,240,210,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.18)');
  c.fillStyle = gl; rr(0, 0, SLAB, SLAB, 34); c.fill();
}

const layers = new Map();
// Draws the board slab with its top-left corner at (x,y), `size` units wide. `px` = device pixels per unit (sets the cache resolution).
export function drawBoard(ctx, wood, n, x, y, size, px = 2) {
  const want = Math.min(2200, Math.max(500, Math.round((size * px) / 100) * 100)), key = `${wood}|${n}|${want}`;
  let layer = layers.get(key);
  if (layer === undefined) {
    layer = null;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const c = new OffscreenCanvas(want, want), cx = c.getContext('2d'); cx.scale(want / SLAB, want / SLAB); paintBoard(cx, wood, n); layer = c;
      }
    } catch { layer = null; }
    layers.set(key, layer);
    if (layers.size > 8) layers.delete(layers.keys().next().value);
  }
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const g = i * size * 0.012; ctx.fillStyle = `rgba(0,0,0,${0.075})`; ctx.beginPath(); ctx.roundRect(x - g + size * 0.012, y - g + size * 0.03, size + 2 * g, size + 2 * g, size * 0.04 + g); ctx.fill();
  }
  ctx.restore();
  // the slab's front lip (its thickness), then a soft shadow of the slab on the table
  ctx.save(); ctx.fillStyle = wood === 'ebony' ? '#0d0805' : '#2e1808'; ctx.beginPath(); ctx.roundRect(x + size * 0.004, y + size * 0.016, size * 0.992, size * 0.99, size * 0.036); ctx.fill(); ctx.restore();
  if (layer) ctx.drawImage(layer, x, y, size, size);
  else { ctx.save(); ctx.translate(x, y); ctx.scale(size / SLAB, size / SLAB); paintBoard(ctx, wood, n); ctx.restore(); }
}

// ---- the table --------------------------------------------------------------------------------------------------------
const tables = new Map();
function paintTable(c, w, h) {
  const g = c.createRadialGradient(w * 0.35, h * 0.3, 40, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
  g.addColorStop(0, '#34200f'); g.addColorStop(0.55, '#1e120a'); g.addColorStop(1, '#0d0704');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // a fine diagonal twill, like cloth under the board
  c.save(); c.globalAlpha = 0.05; c.strokeStyle = '#ffd89a'; c.lineWidth = 1;
  for (let d = -h; d < w; d += 7) { c.beginPath(); c.moveTo(d, 0); c.lineTo(d + h, h); c.stroke(); }
  c.globalAlpha = 0.035; for (let d = 0; d < w + h; d += 11) { c.beginPath(); c.moveTo(d, 0); c.lineTo(d - h, h); c.stroke(); }
  c.restore();
  // woven bands along the top and bottom edges (the long edges of the screen)
  const land = w > h, bandH = 24, tile = 12;
  for (const [x, y, ww, hh, ph] of land ? [[0, 0, w, bandH, 0], [0, h - bandH, w, bandH, 4]] : [[0, 0, w, bandH, 0], [0, h - bandH, w, bandH, 4]]) {
    c.save(); c.globalAlpha = 0.55; weaveStrip(c, x, y, ww, hh, tile, ph); c.restore();
  }
  c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, bandH, w, 3); c.fillRect(0, h - bandH - 3, w, 3);
  const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  c.fillStyle = v; c.fillRect(0, 0, w, h);
}
export function drawTable(ctx, w, h, px = 1.5) {
  const k = Math.min(2, Math.max(1, px)), key = `${Math.round(w)}x${Math.round(h)}@${k}`;
  let layer = tables.get(key);
  if (layer === undefined) {
    layer = null;
    try {
      if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.ceil(w * k), Math.ceil(h * k)), cx = c.getContext('2d'); cx.scale(k, k); paintTable(cx, w, h); layer = c; }
    } catch { layer = null; }
    tables.set(key, layer);
    if (tables.size > 5) tables.delete(tables.keys().next().value);
  }
  if (layer) ctx.drawImage(layer, 0, 0, w, h);
  else paintTable(ctx, w, h);
}

// A narrow woven rule used on panels (cheap: drawn live, small).
export function weaveRule(ctx, x, y, w, h = 10) { ctx.save(); ctx.globalAlpha = 0.9; weaveStrip(ctx, x, y, w, h, h / 2, 0); ctx.restore(); }
export { TAU };
