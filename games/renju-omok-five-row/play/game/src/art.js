// Static art, painted once and cached: the table, the wooden board and the stones. Everything is procedural (no image files).
// Light comes from the top left; stones cast a soft shadow to the lower right. If OffscreenCanvas is missing (old WebView, headless
// tests) every function falls back to plain gradients drawn directly, so nothing depends on the cache.
const TAU = Math.PI * 2;

export const WOODS = {
  kaya: { name: 'Kaya', hi: '#f0cd86', mid: '#dfb06a', lo: '#bf8b45', grain: '90,55,15', line: '#2e2112', bevel: '#7d5322', bg0: '#233039', bg1: '#0c1218' },
  walnut: { name: 'Walnut', hi: '#b98255', mid: '#9a6538', lo: '#74461f', grain: '40,20,5', line: '#1d130a', bevel: '#3c2410', bg0: '#2e2a33', bg1: '#0e0d12' },
  rosewood: { name: 'Rosewood', hi: '#a45a4a', mid: '#82402f', lo: '#5d2a1e', grain: '30,8,4', line: '#1c0d09', bevel: '#33150f', bg0: '#2b2b35', bg1: '#0d0c12' },
};
export const WOOD_IDS = ['kaya', 'walnut', 'rosewood'];
export const STONES = {
  slate: { name: 'Slate & shell', b0: '#6a707a', b1: '#23272d', b2: '#07080a', w0: '#ffffff', w1: '#f0eadb', w2: '#b9b09b' },
  jade: { name: 'Jade & pearl', b0: '#4f8f78', b1: '#1b4a3e', b2: '#06201b', w0: '#fffdf6', w1: '#f2ecdc', w2: '#c8bfa6' },
};
export const STONE_IDS = ['slate', 'jade'];

const canvasOf = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))) : null);
// device pixels per unit under the current transform (1 when unknown, as in headless runs)
export const pxScale = (ctx) => { const m = ctx.getTransform?.(); return m && m.a > 0 ? m.a : 1; };

// deterministic 0..1 noise
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

// ---- table background: a dark linen-topped table under a lamp, painted once per size at half resolution and cached ---------------
const tables = new Map();
function paintTable(c, w, h, W) {
  let g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, W.bg0); g.addColorStop(1, W.bg1); c.fillStyle = g; c.fillRect(0, 0, w, h);
  // woven linen: fine horizontal and vertical threads of uneven strength
  c.lineWidth = 1;
  for (let y = 0; y < h; y += 3) { c.strokeStyle = `rgba(255,255,255,${0.012 + hash(y, 7) * 0.03})`; c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(w, y + 0.5); c.stroke(); }
  for (let x = 0; x < w; x += 3) { c.strokeStyle = `rgba(0,0,0,${0.02 + hash(x, 9) * 0.05})`; c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, h); c.stroke(); }
  // lamp: a warm pool of light over the playing area, a cool falloff beyond it
  const m = Math.min(w, h);
  g = c.createRadialGradient(w * 0.46, h * 0.4, m * 0.05, w * 0.5, h * 0.46, Math.max(w, h) * 0.7);
  g.addColorStop(0, 'rgba(255,214,150,0.22)'); g.addColorStop(0.4, 'rgba(255,200,130,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  g = c.createRadialGradient(w * 0.5, h * 0.5, m * 0.45, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
}
export function drawTable(ctx, w, h, wood) {
  const W = WOODS[wood] ?? WOODS.kaya, k = 0.5, key = `${Math.round(w)}x${Math.round(h)}|${wood}`;
  let cv = tables.get(key);
  if (cv === undefined) {
    const o = canvasOf(w * k, h * k);
    if (o) { const c = o.getContext('2d'); c.scale(k, k); paintTable(c, w, h, W); cv = o; } else cv = null;
    tables.set(key, cv); if (tables.size > 6) tables.delete(tables.keys().next().value);
  }
  if (cv) ctx.drawImage(cv, 0, 0, w, h);
  else { const g = ctx.createRadialGradient(w * 0.5, h * 0.42, Math.min(w, h) * 0.1, w * 0.5, h * 0.5, Math.max(w, h) * 0.75); g.addColorStop(0, W.bg0); g.addColorStop(1, W.bg1); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
}

// ---- the board layer -------------------------------------------------------------------------------------------------------------
// Board geometry in units of the outer side S: margin m = 0.062 S (room for the coordinates), grid span = S - 2m.
export const boardGeom = (n) => { const m = n > 15 ? 0.056 : 0.062; return { m, span: 1 - 2 * m, cell: (1 - 2 * m) / (n - 1) }; };
const starPoints = (n) => { const a = n === 19 ? [3, 9, 15] : n === 15 ? [3, 7, 11] : [n >> 1]; const out = []; if (n === 15) { out.push([3, 3], [11, 3], [3, 11], [11, 11], [7, 7]); } else for (const x of a) for (const y of a) out.push([x, y]); return out; };

function paintBoard(c, S, n, wood, coords) {
  const W = WOODS[wood] ?? WOODS.kaya, geo = boardGeom(n), r = S * 0.026;
  c.save();
  // slab
  c.beginPath(); c.roundRect(0, 0, S, S, r); c.clip();
  const g = c.createLinearGradient(0, 0, S, S); g.addColorStop(0, W.hi); g.addColorStop(0.5, W.mid); g.addColorStop(1, W.lo);
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  // grain: long wavy strokes with varying width and strength, plus a few darker growth lines
  for (let i = 0; i < 90; i++) {
    const y0 = (i / 90) * S + (hash(i, 1) - 0.5) * S * 0.02, amp = S * (0.004 + hash(i, 2) * 0.012), ph = hash(i, 3) * TAU, fr = 1.5 + hash(i, 4) * 3.5;
    c.beginPath();
    for (let k = 0; k <= 24; k++) { const x = (k / 24) * S; const y = y0 + Math.sin(ph + (k / 24) * TAU * fr * 0.5) * amp + Math.sin(x * 0.02 + i) * amp * 0.4; if (k) c.lineTo(x, y); else c.moveTo(x, y); }
    c.strokeStyle = `rgba(${W.grain},${0.025 + hash(i, 5) * 0.075})`; c.lineWidth = S * (0.0015 + hash(i, 6) * 0.004); c.stroke();
  }
  for (let i = 0; i < 16; i++) { c.beginPath(); const y0 = hash(i, 11) * S; c.moveTo(0, y0); c.bezierCurveTo(S * 0.3, y0 + (hash(i, 12) - 0.5) * S * 0.06, S * 0.7, y0 + (hash(i, 13) - 0.5) * S * 0.06, S, y0 + (hash(i, 14) - 0.5) * S * 0.03); c.strokeStyle = `rgba(${W.grain},0.10)`; c.lineWidth = S * 0.0012; c.stroke(); }
  // soft light from the top left, shade at the bottom right
  const lg = c.createRadialGradient(S * 0.2, S * 0.15, 0, S * 0.3, S * 0.3, S * 0.95); lg.addColorStop(0, 'rgba(255,248,225,0.30)'); lg.addColorStop(0.5, 'rgba(255,248,225,0)'); lg.addColorStop(1, 'rgba(20,8,0,0.22)');
  c.fillStyle = lg; c.fillRect(0, 0, S, S);
  // lacquer sheen: a soft diagonal band where the lamp reflects in the varnish
  const sh = c.createLinearGradient(S * 0.05, S * 0.55, S * 0.75, S * 0.0); sh.addColorStop(0, 'rgba(255,250,235,0)'); sh.addColorStop(0.45, 'rgba(255,250,235,0.0)'); sh.addColorStop(0.62, 'rgba(255,250,235,0.11)'); sh.addColorStop(0.78, 'rgba(255,250,235,0)');
  c.fillStyle = sh; c.fillRect(0, 0, S, S);
  c.restore();
  // bevel: bright top-left edge, dark bottom-right edge
  c.save(); c.beginPath(); c.roundRect(S * 0.003, S * 0.003, S * 0.994, S * 0.994, r); c.lineWidth = S * 0.006;
  const bg = c.createLinearGradient(0, 0, S, S); bg.addColorStop(0, 'rgba(255,245,215,0.65)'); bg.addColorStop(0.5, 'rgba(255,245,215,0.08)'); bg.addColorStop(1, 'rgba(0,0,0,0.5)'); c.strokeStyle = bg; c.stroke(); c.restore();
  // grid
  const x0 = S * geo.m, cell = S * geo.cell, x1 = x0 + cell * (n - 1), lw = Math.max(S * 0.0021, 1);
  c.save(); c.lineCap = 'butt';
  for (const [col, off] of [['rgba(255,240,200,0.42)', lw * 0.7], [W.line, 0]]) {
    c.strokeStyle = col; c.lineWidth = lw;
    c.beginPath();
    for (let i = 0; i < n; i++) { const p = x0 + i * cell + off; c.moveTo(p, x0 + off); c.lineTo(p, x1 + off); c.moveTo(x0 + off, p); c.lineTo(x1 + off, p); }
    c.stroke();
  }
  c.strokeStyle = W.line; c.lineWidth = lw * 2.1; c.strokeRect(x0, x0, x1 - x0, x1 - x0);
  c.restore();
  // star points
  c.fillStyle = W.line;
  for (const [sx, sy] of starPoints(n)) { c.beginPath(); c.arc(x0 + sx * cell, x0 + sy * cell, cell * 0.105, 0, TAU); c.fill(); }
  // coordinates, engraved
  if (coords) {
    const fs = Math.max(cell * 0.3, 7), letters = 'ABCDEFGHJKLMNOPQRST';
    c.font = `600 ${fs}px "Cormorant Garamond", Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = `rgba(${W.grain},0.62)`;
    for (let i = 0; i < n; i++) {
      const p = x0 + i * cell, a = x0 * 0.5;
      c.fillText(letters[i], p, a); c.fillText(letters[i], p, S - a);
      c.fillText(String(n - i), a, p); c.fillText(String(n - i), S - a, p);
    }
    c.textBaseline = 'alphabetic';
  }
}
const layers = new Map();
// draws the board with its outer square at (x, y), side S units; `k` = device px per unit
export function drawBoard(ctx, x, y, S, n, wood, coords = true) {
  const k = pxScale(ctx), px = Math.min(2200, Math.max(64, Math.round(S * k))), key = `${px}|${n}|${wood}|${coords ? 1 : 0}`;
  let cv = layers.get(key);
  if (cv === undefined) {
    const o = canvasOf(px, px);
    if (o) { const c = o.getContext('2d'); c.scale(px / S, px / S); paintBoard(c, S, n, wood, coords); cv = o; } else cv = null;
    layers.set(key, cv); if (layers.size > 8) layers.delete(layers.keys().next().value);
  }
  // soft contact shadow under the slab
  ctx.save();
  const Wd = WOODS[wood] ?? WOODS.kaya;
  for (let i = 0; i < 5; i++) { const e = i / 4; ctx.fillStyle = `rgba(0,0,0,${0.075 - e * 0.03})`; ctx.beginPath(); ctx.roundRect(x - S * (0.012 + e * 0.02), y + S * (0.03 + e * 0.02), S * (1.024 + e * 0.04), S * 1.0, S * (0.04 + e * 0.02)); ctx.fill(); }   // ambient occlusion on the table
  ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.beginPath(); ctx.roundRect(x - S * 0.004, y + S * 0.02, S * 1.008, S * 1.0, S * 0.03); ctx.fill();
  const th = ctx.createLinearGradient(0, y + S * 0.9, 0, y + S * 1.026); th.addColorStop(0, Wd.lo); th.addColorStop(0.35, Wd.bevel); th.addColorStop(1, '#120a04');      // the slab's thickness, seen as a dark edge below
  ctx.fillStyle = th; ctx.beginPath(); ctx.roundRect(x + S * 0.001, y + S * 0.018, S * 0.998, S * 1.0, S * 0.026); ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,180,0.28)'; ctx.lineWidth = Math.max(1, S * 0.0018); ctx.beginPath(); ctx.roundRect(x + S * 0.004, y + S * 0.02, S * 0.992, S * 1.0, S * 0.026); ctx.stroke();   // lit lower lip
  ctx.restore();
  if (cv) ctx.drawImage(cv, x, y, S, S);
  else { ctx.save(); ctx.translate(x, y); paintBoard(ctx, S, n, wood, coords); ctx.restore(); }
}

// ---- stones ----------------------------------------------------------------------------------------------------------------------
function paintStone(c, black, r, set) {
  const P = STONES[set] ?? STONES.slate, cx = r, cy = r;
  // body: a sphere lit from the top left
  let g = c.createRadialGradient(cx - r * 0.34, cy - r * 0.4, r * 0.04, cx + r * 0.05, cy + r * 0.05, r * 1.02);
  if (black) { g.addColorStop(0, P.b0); g.addColorStop(0.5, P.b1); g.addColorStop(0.92, P.b2); g.addColorStop(1, '#000'); }
  else { g.addColorStop(0, P.w0); g.addColorStop(0.55, P.w1); g.addColorStop(0.92, P.w2); g.addColorStop(1, '#8f8670'); }
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
  c.save(); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
  // warm bounce light from the wood on the lower right, a thin cool fill on the lower left
  g = c.createRadialGradient(cx + r * 0.55, cy + r * 0.62, 0, cx + r * 0.55, cy + r * 0.62, r * 0.75);
  g.addColorStop(0, black ? 'rgba(210,170,110,0.26)' : 'rgba(255,214,150,0.36)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 2 * r, 2 * r);
  // fresnel: the edge darkens, so the stone reads as round
  g = c.createRadialGradient(cx, cy, r * 0.62, cx, cy, r);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, black ? 'rgba(0,0,0,0.5)' : 'rgba(70,55,30,0.26)'); c.fillStyle = g; c.fillRect(0, 0, 2 * r, 2 * r);
  c.restore();
  // soft broad highlight, then a small sharp specular glint with a faint window-shaped reflection
  g = c.createRadialGradient(cx - r * 0.34, cy - r * 0.4, 0, cx - r * 0.34, cy - r * 0.4, r * 0.62);
  g.addColorStop(0, black ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.beginPath(); c.arc(cx - r * 0.34, cy - r * 0.4, r * 0.62, 0, TAU); c.fill();
  c.save(); c.translate(cx - r * 0.38, cy - r * 0.44); c.rotate(-0.7);
  g = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.3); g.addColorStop(0, 'rgba(255,255,255,0.98)'); g.addColorStop(0.35, black ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, r * 0.3, r * 0.17, 0, 0, TAU); c.fill(); c.restore();
  // a faint secondary glint low on the right
  g = c.createRadialGradient(cx + r * 0.4, cy + r * 0.45, 0, cx + r * 0.4, cy + r * 0.45, r * 0.18); g.addColorStop(0, black ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.beginPath(); c.arc(cx + r * 0.4, cy + r * 0.45, r * 0.18, 0, TAU); c.fill();
  c.lineWidth = Math.max(r * 0.03, 0.5); c.strokeStyle = black ? 'rgba(0,0,0,0.6)' : 'rgba(110,95,70,0.4)'; c.beginPath(); c.arc(cx, cy, r - c.lineWidth * 0.5, 0, TAU); c.stroke();
}
const sprites = new Map();
function spriteFor(black, rPx, set) {
  const key = `${black ? 1 : 0}|${Math.round(rPx)}|${set}`;
  let s = sprites.get(key);
  if (s === undefined) {
    const o = canvasOf(rPx * 2, rPx * 2);
    if (o) { const c = o.getContext('2d'); paintStone(c, black, rPx, set); s = o; } else s = null;
    sprites.set(key, s); if (sprites.size > 16) sprites.delete(sprites.keys().next().value);
  }
  return s;
}
let shadowSprite = null, shadowPx = 0;
function shadowFor(rPx) {
  if (shadowSprite !== undefined && shadowSprite !== null && Math.abs(shadowPx - rPx) < rPx * 0.2) return shadowSprite;
  const o = canvasOf(rPx * 4, rPx * 4);
  if (!o) { shadowSprite = null; return null; }
  const c = o.getContext('2d'); let g = c.createRadialGradient(rPx * 2, rPx * 2, rPx * 0.3, rPx * 2, rPx * 2, rPx * 1.95);   // broad, very soft penumbra
  g.addColorStop(0, 'rgba(20,10,0,0.42)'); g.addColorStop(0.45, 'rgba(20,10,0,0.18)'); g.addColorStop(1, 'rgba(20,10,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, rPx * 4, rPx * 4);
  g = c.createRadialGradient(rPx * 2, rPx * 2, rPx * 0.55, rPx * 2, rPx * 2, rPx * 1.15);                                    // tight contact shadow
  g.addColorStop(0, 'rgba(10,5,0,0.55)'); g.addColorStop(1, 'rgba(10,5,0,0)'); c.fillStyle = g; c.fillRect(0, 0, rPx * 4, rPx * 4);
  shadowSprite = o; shadowPx = rPx; return o;
}
// A stone centred at (cx, cy) with radius r (units). `lift` 0..1 raises it (bigger, softer shadow); `alpha` fades it.
export function drawStone(ctx, black, cx, cy, r, set = 'slate', { alpha = 1, lift = 0, shadow = true } = {}) {
  const k = pxScale(ctx), rPx = Math.max(3, Math.round(r * k * (1 + lift * 0.0))), rr = r * (1 + lift * 0.28);
  ctx.save(); ctx.globalAlpha *= alpha;
  if (shadow) {
    const sh = shadowFor(Math.max(3, Math.round(r * k))), off = r * (0.16 + lift * 0.45);
    if (sh) { const s = rr * 2.0; ctx.globalAlpha *= 1 - lift * 0.35; ctx.drawImage(sh, cx + off * 0.7 - s, cy + off - s, s * 2, s * 2); ctx.globalAlpha = alpha; }
    else { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(cx + off * 0.7, cy + off, rr * 1.02, 0, TAU); ctx.fill(); }
  }
  const sp = spriteFor(black, rPx, set);
  if (sp) ctx.drawImage(sp, cx - rr, cy - rr, rr * 2, rr * 2);
  else { ctx.save(); ctx.translate(cx - rr, cy - rr); ctx.scale(rr / rr, rr / rr); paintStone(ctx, black, rr, set); ctx.restore(); }
  ctx.restore();
}

// soft glow dot / ring helpers used by the overlays
export function glow(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

// ---- a turned wooden stone bowl with a heap of stones, centred at (cx, cy) with outer radius R (units) ---------------------------
// Seen from above at a slant: the rim is a ring, the heap is a handful of stones at fixed jittered spots (deterministic).
const bowls = new Map();
function paintBowl(c, R, black, wood, set) {
  const W = WOODS[wood] ?? WOODS.kaya, cx = R * 1.25, cy = R * 1.2, r = R;
  let g = c.createRadialGradient(cx + r * 0.12, cy + r * 0.18, r * 0.2, cx + r * 0.1, cy + r * 0.16, r * 1.45);   // soft shadow on the table
  g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(0.6, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, R * 2.5, R * 2.5);
  g = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g.addColorStop(0, W.hi); g.addColorStop(0.5, W.mid); g.addColorStop(1, W.bevel);   // the rim
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = r * 0.025; c.beginPath(); c.arc(cx, cy, r * 0.985, 0, TAU); c.stroke();
  g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 0.84); g.addColorStop(0, '#2a1a0c'); g.addColorStop(1, '#0a0502');   // the dark inside
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r * 0.8, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,236,190,0.35)'; c.lineWidth = r * 0.02; c.beginPath(); c.arc(cx, cy, r * 0.8, Math.PI * 0.95, Math.PI * 1.65); c.stroke();
  const sr = r * 0.2, spots = [[-0.42, 0.12], [0.4, 0.2], [-0.12, 0.38], [0.14, -0.4], [-0.44, -0.24], [0.5, -0.12], [0, 0.02], [-0.26, -0.5], [0.3, 0.46], [-0.02, -0.18], [0.22, 0.1], [-0.2, 0.14]];
  const P = STONES[set] ?? STONES.slate;
  spots.forEach(([dx, dy], i) => {
    const sx = cx + dx * r * 0.95, sy = cy + dy * r * 0.95 - (i > 6 ? r * 0.05 : 0);
    c.save(); c.translate(sx - sr, sy - sr); c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.arc(sr * 1.12, sr * 1.18, sr * 1.02, 0, TAU); c.fill(); paintStone(c, black, sr, set); c.restore();
  });
  g = c.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 0.82); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.4)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r * 0.8, 0, TAU); c.fill();   // the rim shades the stones
  c.strokeStyle = 'rgba(255,240,200,0.5)'; c.lineWidth = r * 0.03; c.beginPath(); c.arc(cx, cy, r * 0.975, Math.PI * 1.05, Math.PI * 1.55); c.stroke();   // specular on the lip
}
export function drawBowl(ctx, cx, cy, R, black, wood, set) {
  const k = pxScale(ctx), px = Math.max(32, Math.round(R * 2.5 * k)), key = `${black ? 1 : 0}|${px}|${wood}|${set}`;
  let cv = bowls.get(key);
  if (cv === undefined) {
    const o = canvasOf(px, px);
    if (o) { const c = o.getContext('2d'); c.scale(px / (R * 2.5), px / (R * 2.5)); paintBowl(c, R, black, wood, set); cv = o; } else cv = null;
    bowls.set(key, cv); if (bowls.size > 6) bowls.delete(bowls.keys().next().value);
  }
  if (cv) ctx.drawImage(cv, cx - R * 1.25, cy - R * 1.2, R * 2.5, R * 2.5);
  else { ctx.save(); ctx.translate(cx - R * 1.25, cy - R * 1.2); paintBowl(ctx, R, black, wood, set); ctx.restore(); }
}
