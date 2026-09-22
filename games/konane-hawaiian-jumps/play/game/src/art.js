// The world of the game, painted with canvas paths only: a dawn sky, ridges and sea, dark volcanic ground, and the carved lava-stone
// slab (papamu) with a tapa-inspired geometric border (pure decoration). Static layers are painted ONCE into cached canvases.
// Light comes from the horizon glow at the top right. Stones are cached sprites (basalt and coral).
import { W, H, SLAB, GRID, cellSize, cellCenter, stoneRadius } from './layout.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mkCanvas = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); } catch { /* headless */ } return null; };
const cached = {};
function layer(key, w, h, paint) {
  if (key in cached) return cached[key];
  const c = mkCanvas(w, h); cached[key] = null;
  if (c) { try { paint(c.getContext('2d')); cached[key] = c; } catch { cached[key] = null; } }
  return cached[key];
}
const lin = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const rad = (ctx, x, y, r0, r1, stops, x1 = x, y1 = y) => { const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const soft = (ctx, x, y, rx, ry, rgb, a) => { ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.fillStyle = rad(ctx, 0, 0, 0, rx, [[0, `rgba(${rgb},${a})`], [1, `rgba(${rgb},0)`]]); ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore(); };

// ---- the sky (animated parts are drawn each frame in drawWorld) -------------------------------------------
export const SUN = { x: 500, y: 372 };
function paintSky(ctx) {
  ctx.fillStyle = lin(ctx, 0, 0, 0, 440, [[0, '#15163f'], [0.3, '#3d2170'], [0.55, '#a63d7f'], [0.78, '#f0745a'], [1, '#ffc27a']]);
  ctx.fillRect(0, 0, W, 460);
  const r = lcg(7);
  for (let i = 0; i < 46; i++) { ctx.fillStyle = `rgba(255,240,220,${0.15 + r() * 0.5})`; const s = 0.8 + r() * 1.4; ctx.fillRect(r() * W, r() * 190, s, s); }
}
// ---- ridges, sea, ground, slab (one cached layer per board size) ---------------------------------------
function ridge(ctx, pts, base, fill) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], base);
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[i + 1] || p; if (i === 0) ctx.lineTo(p[0], p[1]); ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  ctx.lineTo(pts[pts.length - 1][0], base); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function paintLand(ctx, n) {
  // far island and headland, lit from behind by the dawn
  ridge(ctx, [[300, 392], [380, 372], [440, 368], [520, 376], [600, 366], [720, 380]], 420, '#7a3b6a');
  ridge(ctx, [[0, 210], [60, 205], [130, 240], [200, 300], [280, 350], [340, 392]], 420, '#2c1a45');
  ridge(ctx, [[0, 300], [90, 300], [170, 340], [240, 385]], 420, '#1a1030');
  // the sea
  ctx.fillStyle = lin(ctx, 0, 384, 0, 440, [[0, '#ffb26a'], [0.3, '#c45a72'], [1, '#2a2857']]); ctx.fillRect(0, 386, W, 60);
  ctx.fillStyle = 'rgba(255,210,150,0.45)'; ctx.beginPath(); ctx.moveTo(SUN.x - 46, 386); ctx.lineTo(SUN.x + 46, 386); ctx.lineTo(SUN.x + 120, 446); ctx.lineTo(SUN.x - 120, 446); ctx.fill();
  // ground: dark volcanic rock with a warm rim where the dawn touches it
  const r = lcg(31);
  ctx.beginPath(); ctx.moveTo(0, 444);
  for (let x = 0; x <= W; x += 24) ctx.lineTo(x, 436 + Math.sin(x * 0.05) * 5 + r() * 8);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, 430, 0, H, [[0, '#4a2f33'], [0.08, '#2b1f22'], [0.5, '#1c1516'], [1, '#0f0b0c']]); ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,110,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 440); for (let x = 0; x <= W; x += 24) ctx.lineTo(x, 437 + Math.sin(x * 0.05) * 5); ctx.stroke();
  ctx.save(); ctx.clip();
  for (let i = 0; i < 900; i++) { const x = r() * W, y = 440 + r() * (H - 440), s = 1 + r() * 3; ctx.fillStyle = r() < 0.5 ? `rgba(255,190,140,${0.03 + r() * 0.06})` : `rgba(0,0,0,${0.15 + r() * 0.25})`; ctx.fillRect(x, y, s * 1.6, s); }
  ctx.restore();
  // coral fragments and a few fern leaves lying on the ground below the slab
  for (let i = 0; i < 9; i++) {
    const x = r() * W, y = 1110 + r() * 430, s = 3 + r() * 9; ctx.fillStyle = `rgba(0,0,0,0.35)`; ctx.beginPath(); ctx.ellipse(x + 2, y + 3, s, s * 0.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = lin(ctx, x - s, y - s, x + s, y + s, [[0, '#fff3dc'], [1, '#c9b48e']]); ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.72, r() * 3, 0, TAU); ctx.fill();
  }
  fern(ctx, 0, 1300, 1.0, 0.5, '#1d3a2a'); fern(ctx, W, 1250, -1.0, 0.55, '#1d3a2a'); fern(ctx, 30, 1560, 0.85, -0.5, '#245038');
  if (n) paintSlab(ctx, n);
}
function fern(ctx, x, y, dir, tilt, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(-tilt);
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(90, -60, 230, -40); ctx.stroke();
  for (let i = 1; i < 14; i++) { const t = i / 14, px = 230 * t * 0.95, py = -40 * t * t * 1 - 60 * (t * (1 - t)) * 1.5, len = 42 * (1 - t * 0.6);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 6, py - len * 0.7, px + 22, py - len); ctx.quadraticCurveTo(px + 8, py - len * 0.4, px, py); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 6, py + len * 0.7, px + 22, py + len); ctx.quadraticCurveTo(px + 8, py + len * 0.4, px, py); ctx.fill(); }
  ctx.restore();
}

function paintSlab(ctx, n) {
  const { x, y, w, h } = SLAB, r = lcg(101 + n);
  // shadow on the ground, then the slab's thick edge, then its top face
  soft(ctx, x + w / 2 + 10, y + h + 26, w * 0.62, 46, '0,0,0', 0.7);
  ctx.fillStyle = lin(ctx, 0, y + h - 30, 0, y + h + 30, [[0, '#231d1e'], [1, '#0e0b0c']]); ctx.beginPath(); ctx.roundRect(x, y + 20, w, h, 30); ctx.fill();
  ctx.fillStyle = lin(ctx, x, y, x + w, y + h, [[0, '#5a504e'], [0.5, '#413a3a'], [1, '#2a2424']]); ctx.beginPath(); ctx.roundRect(x, y, w, h, 30); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 30); ctx.clip();
  for (let i = 0; i < 2600; i++) { const px = x + r() * w, py = y + r() * h, s = 0.8 + r() * 2.6; ctx.fillStyle = r() < 0.5 ? `rgba(255,236,214,${0.04 + r() * 0.1})` : `rgba(0,0,0,${0.12 + r() * 0.22})`; ctx.fillRect(px, py, s, s * (0.6 + r())); }
  for (let i = 0; i < 160; i++) {                               // vesicles: the small gas pits of lava rock
    const px = x + r() * w, py = y + r() * h, s = 1.5 + r() * 3.5;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(px, py, s, s * 0.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,225,200,0.16)'; ctx.beginPath(); ctx.ellipse(px + 0.6, py + s * 0.55, s * 0.85, s * 0.35, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,205,160,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 29); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + 8, y + 8, w - 16, h - 16, 24); ctx.stroke();
  tapa(ctx);
  // the playing field: a slightly darker, polished panel, engraved grid lines, and a carved dish for each stone
  const g = GRID, c = cellSize(n);
  ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(g.x - 4, g.y - 4, g.size + 8, g.size + 8);
  ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 3; ctx.strokeRect(g.x - 2, g.y - 2, g.size + 4, g.size + 4);
  ctx.strokeStyle = 'rgba(255,215,180,0.25)'; ctx.lineWidth = 1.5; ctx.strokeRect(g.x, g.y, g.size, g.size);
  for (let i = 1; i < n; i++) for (const [ax, ay, bx, by] of [[g.x + i * c, g.y, g.x + i * c, g.y + g.size], [g.x, g.y + i * c, g.x + g.size, g.y + i * c]]) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,215,180,0.2)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ax + 1.6, ay + 1.6); ctx.lineTo(bx + 1.6, by + 1.6); ctx.stroke();
  }
  for (let i = 0; i < n * n; i++) {
    const p = cellCenter(n, i), R = c * 0.4;
    ctx.fillStyle = rad(ctx, p.x + R * 0.25, p.y + R * 0.3, R * 0.1, R * 1.1, [[0, '#2d2726'], [0.7, '#1b1717'], [1, '#100d0d']]); ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, R, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,215,180,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, R, -Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
  }
}
// Tapa-inspired band: cream ground, bold triangle rows and a diamond chain, in the natural browns, rust and black. Decoration only.
function tapa(ctx) {
  const { x, y, w, h } = SLAB, B = 36, ix = x + B - 4, iy = y + B - 4, iw = w - 2 * B + 8, ih = h - 2 * B + 8;
  ctx.save(); ctx.beginPath(); ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 22); ctx.rect(ix + iw, iy, -iw, ih); ctx.clip('evenodd');
  ctx.fillStyle = lin(ctx, x, y, x + w, y + h, [[0, '#e9d3a2'], [1, '#c9ac76']]); ctx.fillRect(x, y, w, h);
  const r = lcg(5); for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(120,80,40,${0.04 + r() * 0.06})`; ctx.fillRect(x + r() * w, y + r() * h, 1 + r() * 5, 0.8); }
  const tri = (ax, ay, bx, by, cx, cy, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); };
  const S = 18, mid = B / 2 + 6;
  const side = (x0, y0, dx, dy, len) => {                    // a strip running along direction (dx,dy), pattern facing inward
    const nx = -dy, ny = dx;
    for (let t = 14; t < len - 14; t += S * 2) {
      const px = x0 + dx * t, py = y0 + dy * t;
      tri(px, py, px + dx * S * 2, py + dy * S * 2, px + dx * S + nx * S, py + dy * S + ny * S, '#3a2416');          // outer sawtooth
      tri(px + dx * S * 2 + nx * 0, py + dy * S * 2, px + dx * S * 3 + nx * 0, py + dy * S * 3, px + dx * S * 2.5 + nx * S * 0.9, py + dy * S * 2.5 + ny * S * 0.9, '#a8492b');
      const cx = px + dx * S + nx * (B - 26), cy = py + dy * S + ny * (B - 26);
      ctx.fillStyle = '#a8492b'; ctx.beginPath(); ctx.moveTo(cx + nx * 8, cy + ny * 8); ctx.lineTo(cx + dx * 9, cy + dy * 9); ctx.lineTo(cx - nx * 8, cy - ny * 8); ctx.lineTo(cx - dx * 9, cy - dy * 9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a2416'; ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, TAU); ctx.fill();
    }
  };
  side(x + 12, y + 12, 1, 0, w - 24); side(x + w - 12, y + h - 12, -1, 0, w - 24); side(x + 12, y + h - 12, 0, -1, h - 24); side(x + w - 12, y + 12, 0, 1, h - 24);
  ctx.restore();
  ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 3; ctx.strokeRect(ix - 0.5, iy - 0.5, iw + 1, ih + 1);
  for (const [cx, cy] of [[x + 30, y + 30], [x + w - 30, y + 30], [x + 30, y + h - 30], [x + w - 30, y + h - 30]]) {       // corner squares
    ctx.fillStyle = '#3a2416'; ctx.fillRect(cx - 15, cy - 15, 30, 30); ctx.fillStyle = '#e9d3a2'; ctx.fillRect(cx - 10, cy - 10, 20, 20); ctx.fillStyle = '#a8492b'; ctx.fillRect(cx - 5, cy - 5, 10, 10);
  }
  void mid;
}

// ---- stones ----------------------------------------------------------------------------------------------
const SPRITE = 160;
function paintStone(ctx, kind, v) {
  const r = lcg(kind * 97 + v * 13), cx = SPRITE / 2, cy = SPRITE / 2, R = 62;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(v * 0.9);
  const pts = []; for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; pts.push([Math.cos(a) * R * (1 + 0.05 * Math.sin(a * 2 + v) + (r() - 0.5) * 0.03), Math.sin(a) * R * 0.93 * (1 + 0.04 * Math.cos(a * 3 + v))]); }
  const path = () => { ctx.beginPath(); pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; if (i === 0) ctx.moveTo((pts[27][0] + p[0]) / 2, (pts[27][1] + p[1]) / 2); ctx.quadraticCurveTo(p[0], p[1], mx, my); }); ctx.closePath(); };
  ctx.rotate(-v * 0.9);
  if (kind === 1) {                                                             // black basalt: glossy, with pin-prick pores
    path(); ctx.fillStyle = rad(ctx, -18, -24, 4, R * 1.2, [[0, '#6b7079'], [0.35, '#2d3036'], [0.8, '#0f1013'], [1, '#050506']]); ctx.fill();
    ctx.save(); path(); ctx.clip();
    for (let i = 0; i < 26; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * 0.85, px = Math.cos(a) * d, py = Math.sin(a) * d, s = 1 + r() * 2.4; ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.arc(px, py, s, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(160,175,200,0.22)'; ctx.beginPath(); ctx.arc(px + 0.6, py + 1, s * 0.6, 0, TAU); ctx.fill(); }
    ctx.fillStyle = rad(ctx, 22, 30, 4, 46, [[0, 'rgba(90,120,170,0.35)'], [1, 'rgba(90,120,170,0)']]); ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.restore();
    ctx.save(); ctx.translate(-20, -26); ctx.rotate(-0.5); ctx.fillStyle = rad(ctx, 0, 0, 0, 26, [[0, 'rgba(255,255,255,0.75)'], [0.5, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]); ctx.scale(1.4, 0.8); ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(-27, -31, 5.5, 3, -0.6, 0, TAU); ctx.fill();
    path(); ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 2; ctx.stroke();
  } else {                                                                     // white coral: warm, porous, matte
    path(); ctx.fillStyle = rad(ctx, -16, -20, 4, R * 1.25, [[0, '#fffef7'], [0.45, '#f1e6cf'], [0.85, '#d6c4a1'], [1, '#b8a47c']]); ctx.fill();
    ctx.save(); path(); ctx.clip();
    for (let i = 0; i < 90; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * 0.95, px = Math.cos(a) * d, py = Math.sin(a) * d, s = 0.8 + r() * 2.6; ctx.fillStyle = `rgba(140,116,78,${0.18 + r() * 0.3})`; ctx.beginPath(); ctx.ellipse(px, py, s, s * 0.8, r() * 3, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(px - 0.7, py - 0.9, s * 0.45, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(150,120,80,0.22)'; ctx.lineWidth = 1.6; for (let i = 0; i < 4; i++) { ctx.beginPath(); const a = r() * TAU; ctx.arc(Math.cos(a) * 18, Math.sin(a) * 18, 14 + r() * 26, a, a + 1 + r()); ctx.stroke(); }
    ctx.fillStyle = rad(ctx, 24, 30, 4, 50, [[0, 'rgba(200,140,110,0.3)'], [1, 'rgba(200,140,110,0)']]); ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.restore();
    ctx.save(); ctx.translate(-20, -24); ctx.fillStyle = rad(ctx, 0, 0, 0, 24, [[0, 'rgba(255,255,255,0.85)'], [1, 'rgba(255,255,255,0)']]); ctx.scale(1.3, 0.85); ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill(); ctx.restore();
    path(); ctx.strokeStyle = 'rgba(90,70,40,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}
const stoneSprite = (kind, v) => layer(`stone${kind}-${v}`, SPRITE, SPRITE, (c) => paintStone(c, kind, v));
const blob = (ctx, x, y, rx, ry, rgb, a) => {
  const c = layer('blob' + rgb, 128, 128, (b) => soft(b, 64, 64, 64, 64, rgb, 1));
  if (!c) { soft(ctx, x, y, rx, ry, rgb, a); return; }
  const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a; ctx.drawImage(c, x - rx, y - ry, rx * 2, ry * 2); ctx.globalAlpha = ga;
};
// kind 1 black / 2 white; v picks one of three pebble shapes; opts: lift (0..1), alpha, glow (rgb string), shadow (false to skip)
export function drawStone(ctx, kind, x, y, r, opts = {}) {
  const lift = opts.lift ?? 0, v = (opts.v ?? 0) % 3;
  ctx.save(); if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glow) blob(ctx, x, y, r * 1.9, r * 1.9, opts.glow, 0.9);
  if (opts.shadow !== false) blob(ctx, x + r * 0.22 + lift * r * 0.25, y + r * 0.34 + lift * r * 0.45, r * 1.12, r * 0.9, '0,0,0', 0.62 - lift * 0.2);
  const s = stoneSprite(kind, v), sz = r * 2 * (SPRITE / 124), yy = y - lift * r * 0.55;
  if (s) ctx.drawImage(s, x - sz / 2, yy - sz / 2, sz, sz);
  ctx.restore();
}
export const stoneVariant = (i) => (i * 7 + (i >> 2)) % 3;
export function drawSquareRing(ctx, x, y, r, rgb, a, fillA = 0.22) {
  ctx.fillStyle = `rgba(${rgb},${a * fillA})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
}

// ---- the whole world, animated ---------------------------------------------------------------------------
export function drawWorld(ctx, t, n, calm) {
  const sky = layer('sky', W, 460, paintSky);
  if (sky) ctx.drawImage(sky, 0, 0); else paintSky(ctx);
  const k = calm ? 0 : t;
  // sun: soft glow that breathes, and slow rays
  const pulse = 0.85 + 0.15 * Math.sin(k * 0.8);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rad(ctx, SUN.x, SUN.y, 10, 230 * pulse, [[0, 'rgba(255,220,150,0.95)'], [0.25, 'rgba(255,150,90,0.5)'], [1, 'rgba(255,90,90,0)']]); ctx.fillRect(SUN.x - 240, SUN.y - 240, 480, 300);
  for (let i = 0; i < 7; i++) { const a = -Math.PI + (i + 0.5) * (Math.PI / 7) + Math.sin(k * 0.3 + i) * 0.03; ctx.fillStyle = 'rgba(255,190,120,0.07)'; ctx.beginPath(); ctx.moveTo(SUN.x, SUN.y); ctx.arc(SUN.x, SUN.y, 420, a - 0.06, a + 0.06); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = rad(ctx, SUN.x, SUN.y, 6, 48, [[0, '#fff4d0'], [0.7, '#ffd07a'], [1, 'rgba(255,190,110,0)']]); ctx.beginPath(); ctx.arc(SUN.x, SUN.y, 48, Math.PI, TAU); ctx.fill();
  // drifting clouds
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 190 + k * (5 + i * 2.2)) % 900) - 90, cy = 120 + i * 46 + (i % 2) * 14, s = 1 + (i % 3) * 0.4;
    ctx.fillStyle = `rgba(255,${170 + i * 10},${150 + i * 6},${0.16 + (i % 3) * 0.05})`;
    for (const [dx, dy, rx, ry] of [[0, 0, 70, 12], [-40, 4, 50, 9], [45, 3, 56, 10]]) { ctx.beginPath(); ctx.ellipse(cx + dx * s, cy + dy, rx * s, ry * s, 0, 0, TAU); ctx.fill(); }
  }
  const land = layer('land' + n, W, H, (c) => paintLand(c, n));
  if (land) ctx.drawImage(land, 0, 0); else paintLand(ctx, n);
  // sea shimmer and two gulls
  ctx.fillStyle = 'rgba(255,225,170,0.5)';
  for (let i = 0; i < 12; i++) { const y = 392 + i * 4.4, w = 8 + (i % 4) * 8 + Math.sin(k * 1.4 + i * 2) * 6, x = SUN.x + Math.sin(k * 0.7 + i * 1.7) * (14 + i * 6); ctx.fillRect(x - w / 2, y, w, 1.6); }
  ctx.strokeStyle = 'rgba(40,16,40,0.75)'; ctx.lineWidth = 2.4;
  for (let i = 0; i < 2; i++) { const bx = ((k * 12 + i * 260) % 900) - 90, by = 250 + i * 44 + Math.sin(k * 1.3 + i) * 6, fl = Math.sin(k * 5 + i * 2) * 4; ctx.beginPath(); ctx.moveTo(bx - 14, by - 4 + fl); ctx.quadraticCurveTo(bx - 6, by - 8, bx, by); ctx.quadraticCurveTo(bx + 6, by - 8, bx + 14, by - 4 + fl); ctx.stroke(); }
}
// Petals drifting past in front of everything (skipped in reduced motion).
export function drawPetals(ctx, t) {
  for (let i = 0; i < 6; i++) {
    const ph = (t * 0.045 + i * 0.167) % 1, x = ((i * 137) % 700) + Math.sin(t * 0.8 + i * 2) * 36, y = -30 + ph * (H + 60), a = t * 1.3 + i;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = i % 2 ? 'rgba(255,240,215,0.55)' : 'rgba(255,190,200,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 4.5 + Math.sin(a * 2) * 1.5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,214,90,0.6)'; ctx.beginPath(); ctx.arc(-4, 0, 2, 0, TAU); ctx.fill(); ctx.restore();
  }
}
export { stoneRadius };
// The slab on its own (the title screen draws it smaller, with a live demonstration game on it).
export function drawSlab(ctx, n) {
  const c = layer('slab' + n, W, H, (b) => paintSlab(b, n));
  if (c) ctx.drawImage(c, 0, 0); else paintSlab(ctx, n);
}
