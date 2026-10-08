// Art: the raffia-green table, the hand-carved camwood board, and the seed sprites. Everything here is painted ONCE into cached
// layers (OffscreenCanvas); per frame we only blit. One light, warm low sun from the upper left.
// The indigo cloth bands are decoration only (resist-dyed cloth patterns of the Cameroon grasslands, drawn here as plain geometry).
import { PIT_R, TALL } from './layout.js';
const PITS = 14;

const TAU = Math.PI * 2, SS = 2;                      // board layer is painted at 2x for crisp phones
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

export const WOODS = {
  camwood: { name: 'Camwood', a: '#8a3a22', b: '#652414', c: '#42150b', face: ['#b9633c', '#d27d4c', '#b25b34'], grain: [58, 16, 6], hi: 'rgba(255,205,160,0.55)', pit: ['#1b0b06', '#3d1a0e', '#64301a', '#8a4a2a'], rim: 'rgba(255,214,170,0.55)' },
  ebony: { name: 'Dark ebony', a: '#3a2c20', b: '#281d14', c: '#16100a', face: ['#58402c', '#6e5038', '#503a28'], grain: [20, 12, 6], hi: 'rgba(255,214,170,0.35)', pit: ['#0d0805', '#241810', '#43301f', '#62472e'], rim: 'rgba(255,224,180,0.5)' },
};
export const SEEDSETS = { stones: 'River stones', nuts: 'Palm kernels', glass: 'Trade beads' };

// ---- helpers -----------------------------------------------------------------------------------------------
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(w, h); return { c, x: c.getContext('2d') }; }
  return null;
}

// indigo cloth band (decoration): deep indigo with white resist-dye diamonds, nested squares and zigzag rules, ochre thread edges
function band(ctx, y, h, seed, W = 720) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#1d2d63'); g.addColorStop(1, '#111b44');
  ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
  ctx.fillStyle = '#e0a63a'; ctx.fillRect(0, y + 4, W, 2.5); ctx.fillRect(0, y + h - 6.5, W, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(0, y, W, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y + h - 2, W, 2);
  const cy = y + h / 2, u = Math.max(8, (h - 26) / 2), step = u * 3.4, off = (seed % 3) * 7;
  ctx.lineJoin = 'miter';
  // zigzag rules above and below
  ctx.strokeStyle = 'rgba(240,244,255,0.78)'; ctx.lineWidth = 1.6;
  for (const yy of [y + 11, y + h - 11]) { ctx.beginPath(); for (let x = -8 + off, k = 0; x < W + 16; x += 8, k++) { const py = yy + (k % 2 ? 3 : -3); k ? ctx.lineTo(x, py) : ctx.moveTo(x, py); } ctx.stroke(); }
  for (let x = step / 2 + off, k = 0; x < W + step; x += step, k++) {
    ctx.save(); ctx.translate(x, cy);
    for (let n = 0; n < 3; n++) { const r = u * (1 - n * 0.3); ctx.strokeStyle = n === 1 ? '#e0a63a' : 'rgba(244,247,255,0.92)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.stroke(); }
    ctx.fillStyle = '#f4f7ff'; ctx.beginPath(); ctx.arc(0, 0, u * 0.1, 0, TAU); ctx.fill();
    // small stepped ticks between the diamonds
    ctx.fillStyle = 'rgba(244,247,255,0.8)';
    for (let t = -1; t <= 1; t++) ctx.fillRect(step / 2 - 3, t * 6 - 1.5, 6, 3);
    ctx.restore();
  }
  // woven thread texture on the band
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 4) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.stroke(); }
}

// The table is drawn for the LIVE screen size: a vertical gradient (per frame, one fill), a cached weave tile and cached woven bands.
const WEAVE = 1728;                                  // >= the widest screen (720 x 2.4)
function paintWeave(ctx) {
  const rnd = lcg(7);
  for (let y = 0; y < WEAVE; y += 3) { ctx.fillStyle = `rgba(${rnd() < 0.5 ? '210,255,190' : '0,22,6'},${0.03 + rnd() * 0.04})`; ctx.fillRect(0, y, WEAVE, 1.4); }
  for (let x = 0; x < WEAVE; x += 3) { ctx.fillStyle = `rgba(${rnd() < 0.5 ? '210,255,190' : '0,22,6'},${0.03 + rnd() * 0.04})`; ctx.fillRect(x, 0, 1.4, WEAVE); }
  for (let k = 0; k < 11; k++) { ctx.fillStyle = `rgba(0,0,0,${0.03 + (k % 2) * 0.03})`; ctx.fillRect(0, 150 + k * 165, WEAVE, 44); }
}
const plain = {};
function plainLayer(key, w, h, paint) {
  let c = plain[key];
  if (c === undefined) { const m = makeCanvas(w, h); if (m) { paint(m.x); c = m.c; } else c = null; plain[key] = c; }
  return c;
}
const bandLayer = (h, seed) => plainLayer(`band${h}_${seed}`, WEAVE, h, (c) => band(c, 0, h, seed, WEAVE));
function drawBand(ctx, r, seed) {
  const c = bandLayer(Math.round(r.h), seed);
  if (c) ctx.drawImage(c, 0, 0, Math.min(WEAVE, r.w), r.h, r.x, r.y, Math.min(WEAVE, r.w), r.h);
  else { ctx.fillStyle = '#1d2d63'; ctx.fillRect(r.x, r.y, r.w, r.h); }
}
const shade = (ctx, x, y, w, h) => { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h); ctx.restore(); };

function paintBoard(ctx, wood, G) {
  const WD = WOODS[wood] ?? WOODS.camwood, F = G.frame, PIT = G.pitR, MID_Y = G.mid.y;
  // shadow thrown by the board (down-right)
  ctx.save(); ctx.shadowColor = 'rgba(0,16,6,0.7)'; ctx.shadowBlur = 46; ctx.shadowOffsetX = 14; ctx.shadowOffsetY = 34;
  rr(ctx, F.x, F.y, F.w, F.h, 46); ctx.fillStyle = WD.b; ctx.fill(); ctx.restore();
  // frame wood
  const fg = ctx.createLinearGradient(F.x, F.y, F.x + F.w, F.y + F.h); fg.addColorStop(0, WD.a); fg.addColorStop(0.5, WD.b); fg.addColorStop(1, WD.c);
  rr(ctx, F.x, F.y, F.w, F.h, 46); ctx.fillStyle = fg; ctx.fill();
  // grain over the whole frame (clipped): long wavy strokes, mostly dark, some light
  ctx.save(); rr(ctx, F.x, F.y, F.w, F.h, 46); ctx.clip();
  const rnd = lcg(21), [gr, gg, gb] = WD.grain;
  for (let k = 0; k < 340; k++) {
    const y0 = F.y + rnd() * F.h, amp = 2 + rnd() * 6, ph = rnd() * 6, len = F.w;
    ctx.strokeStyle = rnd() < 0.72 ? `rgba(${gr},${gg},${gb},${0.14 + rnd() * 0.26})` : `rgba(255,214,160,${0.03 + rnd() * 0.07})`;
    ctx.lineWidth = 0.6 + rnd() * 2.2; ctx.beginPath();
    for (let x = 0; x <= len; x += 24) { const y = y0 + Math.sin(x / 90 + ph) * amp + Math.sin(x / 31 + ph * 2) * 1.2; x ? ctx.lineTo(F.x + x, y) : ctx.moveTo(F.x + x, y); }
    ctx.stroke();
  }
  // tool marks: short chisel nicks
  for (let k = 0; k < 140; k++) {
    const x = F.x + rnd() * F.w, y = F.y + rnd() * F.h, a = -0.5 + rnd() * 0.4, l = 8 + rnd() * 20;
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.13)' : 'rgba(255,220,170,0.10)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.restore();
  // oiled bevel: light on the top-left edges, dark on the bottom-right
  ctx.lineWidth = 4; ctx.strokeStyle = WD.hi; ctx.beginPath(); ctx.moveTo(F.x + 8, F.y + F.h - 50); ctx.arcTo(F.x + 2, F.y + 2, F.x + F.w - 60, F.y + 2, 44); ctx.lineTo(F.x + F.w - 50, F.y + 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.moveTo(F.x + F.w - 4, F.y + 60); ctx.arcTo(F.x + F.w - 2, F.y + F.h - 2, F.x + 60, F.y + F.h - 2, 44); ctx.lineTo(F.x + 60, F.y + F.h - 3); ctx.stroke();

  // carved zigzag border ring (decoration)
  const bx = F.x + 14, by = F.y + 14, bw = F.w - 28, bh = F.h - 28;
  ctx.save(); rr(ctx, bx, by, bw, bh, 34); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,214,150,0.28)'; ctx.lineWidth = 1.5; rr(ctx, bx + 2, by + 2, bw, bh, 34); ctx.stroke(); ctx.restore();
  const zig = (x0, y0, x1, y1) => {
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 18), dx = (x1 - x0) / n, dy = (y1 - y0) / n, nx = -dy / n * 0.0 - (y1 - y0) / Math.hypot(x1 - x0, y1 - y0) * 5, ny = (x1 - x0) / Math.hypot(x1 - x0, y1 - y0) * 5;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    for (let i = 1; i <= n; i++) ctx.lineTo(x0 + dx * i + (i % 2 ? nx : -nx), y0 + dy * i + (i % 2 ? ny : -ny));
    ctx.strokeStyle = 'rgba(25,9,2,0.8)'; ctx.lineWidth = 3.2; ctx.stroke();
    ctx.translate(0.8, 1.2); ctx.strokeStyle = 'rgba(255,214,150,0.5)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.translate(-0.8, -1.2);
  };
  zig(F.x + 60, F.y + 15, F.x + F.w - 60, F.y + 15); zig(F.x + 60, F.y + F.h - 15, F.x + F.w - 60, F.y + F.h - 15); zig(F.x + 17, F.y + 60, F.x + 17, F.y + F.h - 60); zig(F.x + F.w - 17, F.y + 60, F.x + F.w - 17, F.y + F.h - 60);
  // corner inlays: small cream-and-red diamonds (decoration)
  for (const [cx, cy] of [[F.x + 30, F.y + 30], [F.x + F.w - 30, F.y + 30], [F.x + 30, F.y + F.h - 30], [F.x + F.w - 30, F.y + F.h - 30]]) { ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = 'rgba(20,8,2,0.6)'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(13, 0); ctx.lineTo(0, 13); ctx.lineTo(-13, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(11, 0); ctx.lineTo(0, 11); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#d99a2a'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }

  // the recessed playing surface
  const px = F.x + 34, py = F.y + 30, pw = F.w - 68, ph = F.h - 60;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = -2; rr(ctx, px, py, pw, ph, 30); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  const sg = ctx.createLinearGradient(px, py, px + pw, py + ph); sg.addColorStop(0, WD.face[0]); sg.addColorStop(0.5, WD.face[1]); sg.addColorStop(1, WD.face[2]);
  rr(ctx, px, py, pw, ph, 30); ctx.fillStyle = sg; ctx.fill();
  ctx.save(); rr(ctx, px, py, pw, ph, 30); ctx.clip();
  const r2 = lcg(5);
  for (let k = 0; k < 120; k++) {
    const y0 = py + r2() * ph, amp = 1.5 + r2() * 4, ph2 = r2() * 6;
    ctx.strokeStyle = r2() < 0.7 ? `rgba(${gr},${gg},${gb},${0.05 + r2() * 0.1})` : `rgba(255,230,180,${0.04 + r2() * 0.06})`; ctx.lineWidth = 0.6 + r2() * 1.6; ctx.beginPath();
    for (let x = 0; x <= pw; x += 22) { const y = y0 + Math.sin(x / 80 + ph2) * amp; x ? ctx.lineTo(px + x, y) : ctx.moveTo(px + x, y); }
    ctx.stroke();
  }
  // inner-edge shadow (the surface sits below the frame) and the sun coming from the upper left
  const ie = ctx.createLinearGradient(px, py, px + 60, py + 60); ie.addColorStop(0, 'rgba(0,0,0,0.38)'); ie.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ie; ctx.fillRect(px, py, pw, ph);
  const sun = ctx.createRadialGradient(px + 90, py + 60, 20, px + 200, py + 200, 620); sun.addColorStop(0, 'rgba(255,225,160,0.34)'); sun.addColorStop(1, 'rgba(255,225,160,0)');
  ctx.fillStyle = sun; ctx.fillRect(px, py, pw, ph);
  ctx.restore();

  // stores: long carved troughs at both ends, one for each player
  for (const T of [G.tray[0], G.tray[1]]) {
    carve(ctx, (c) => rr(c, T.x, T.y, T.w, T.h, 44), T.x, T.y, T.w, T.h, WD, 0.9);
  }
  // the fourteen houses: deep bowls with a lit lower rim; each side's leftmost (guarded) house wears a carved ivory ring
  for (let i = 0; i < PITS; i++) { const p = G.pit(i); carve(ctx, (c) => { c.beginPath(); c.arc(p.x, p.y, PIT, 0, TAU); }, p.x - PIT, p.y - PIT, PIT * 2, PIT * 2, WD, 1); }
  for (const i of [6, 13]) { const p = G.pit(i); guardRing(ctx, p.x, p.y, PIT); }
  for (const i of [0, 7]) { const p = G.pit(i); firstMark(ctx, p.x, p.y, PIT); }
  // carved flow arrows between the rows: the top row runs right, the bottom row runs left (clockwise)
  for (const A of G.arrows) arrows(ctx, A.y, A.dir, A.x0, A.x1);
  // a hairline carved groove down the middle
  ctx.strokeStyle = 'rgba(30,12,4,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(G.rule.x0, MID_Y); ctx.lineTo(G.rule.x1, MID_Y); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,214,150,0.25)'; ctx.beginPath(); ctx.moveTo(G.rule.x0, MID_Y + 2); ctx.lineTo(G.rule.x1, MID_Y + 2); ctx.stroke();
}

// A concave carved hollow: dark wall on the lit side, warm oiled highlight along the opposite lip.
function carve(ctx, path, x, y, w, h, WD, k) {
  ctx.save();
  path(ctx); ctx.shadowColor = WD.rim; ctx.shadowBlur = 0; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3.5;
  ctx.fillStyle = WD.rim; ctx.fill(); ctx.restore();                         // lit lower rim
  ctx.save(); path(ctx); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w * 0.8, y + h * 0.95);
  g.addColorStop(0, WD.pit[0]); g.addColorStop(0.35, WD.pit[1]); g.addColorStop(0.8, WD.pit[2]); g.addColorStop(1, WD.pit[3]);
  ctx.fillStyle = g; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  // the bowl floor sags toward the centre: radial darkening
  const cg = ctx.createRadialGradient(x + w * 0.56, y + h * 0.58, 2, x + w / 2, y + h / 2, Math.max(w, h) * 0.55);
  cg.addColorStop(0, `rgba(120,72,34,${0.55 * k})`); cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg; ctx.fillRect(x, y, w, h);
  // tool rings inside the bowl
  const r = lcg(Math.floor(x * 7 + y)); ctx.strokeStyle = 'rgba(20,8,2,0.30)'; ctx.lineWidth = 1.2;
  for (let n = 0; n < (w > 200 ? 6 : 4); n++) { const cx = x + w / 2, cy = y + h / 2; ctx.beginPath(); ctx.ellipse(cx + 4, cy + 4, w / 2 - 7 - n * 5, h / 2 - 7 - n * 5, 0, 0, TAU); ctx.stroke(); }
  void r; ctx.restore();
  // dark upper-left wall edge
  ctx.save(); path(ctx); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,3,0,0.55)'; ctx.stroke(); ctx.restore();
}

// the first house of each row: four carved ivory diamonds round the bowl (a single landing seed never captures it)
function firstMark(ctx, x, y, R = PIT_R) {
  const r = R + 8;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4, cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r;
    for (const [dx, dy, col] of [[0.8, 1.2, 'rgba(20,6,0,0.55)'], [0, 0, '#efe6cf']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx + dx, cy - 6 + dy); ctx.lineTo(cx + 5 + dx, cy + dy); ctx.lineTo(cx + dx, cy + 6 + dy); ctx.lineTo(cx - 5 + dx, cy + dy); ctx.closePath(); ctx.fill(); }
  }
}

// the leftmost house: a carved ring of ivory dots round the bowl, so the special house is easy to see
function guardRing(ctx, x, y, R = PIT_R) {
  const n = 14, r = R + 7;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU, cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r;
    ctx.fillStyle = 'rgba(20,6,0,0.55)'; ctx.beginPath(); ctx.arc(cx + 0.8, cy + 1.2, 3.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(cx - 0.8, cy - 0.9, 0.9, 0, TAU); ctx.fill();
  }
}

function arrows(ctx, y, dir, x0 = 190, x1 = 530) {
  ctx.save();
  for (let x = x0; x <= x1; x += 40) {
    const p = () => { ctx.beginPath(); ctx.moveTo(x - dir * 9, y - 9); ctx.lineTo(x + dir * 9, y); ctx.lineTo(x - dir * 9, y + 9); };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    p(); ctx.translate(0.8, 1.4); ctx.strokeStyle = 'rgba(255,224,170,0.4)'; ctx.lineWidth = 4; ctx.stroke(); ctx.translate(-0.8, -1.4);
    p(); ctx.strokeStyle = 'rgba(40,16,4,0.6)'; ctx.lineWidth = 3.4; ctx.stroke();
  }
  ctx.restore();
}

const layers = {};
function layer(key, w, h, paint) {
  let L = layers[key];
  if (L === undefined) { const m = makeCanvas(w * SS, h * SS); if (m) { m.x.scale(SS, SS); paint(m.x); L = m.c; } else L = null; layers[key] = L; }
  return L;
}
// The table, bands included, for the layout L (layoutFor): the background always covers the whole screen.
export function drawTable(ctx, wood, L, withMid = true) {
  const { w, h } = L, bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2f6a45'); bg.addColorStop(0.5, '#215237'); bg.addColorStop(1, '#12301f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const wv = plainLayer('weave', WEAVE, WEAVE, paintWeave);
  if (wv) for (let y = 0; y < h; y += WEAVE) ctx.drawImage(wv, 0, 0, Math.min(WEAVE, w), WEAVE, 0, y, Math.min(WEAVE, w), WEAVE);
  drawBand(ctx, L.bands.top, 1); shade(ctx, 0, L.bands.top.h, w, 12);
  drawBand(ctx, L.bands.bottom, 2);
  if (withMid && L.bands.mid) { drawBand(ctx, L.bands.mid[0], 3); drawBand(ctx, L.bands.mid[1], 4); for (const m of L.bands.mid) { shade(ctx, 0, m.y + m.h, w, 10); } }
}
export function drawBoard(ctx, wood = 'camwood', G = TALL) {
  const b = layer(`board_${wood}_${G.key}`, G.W, G.H, (c) => paintBoard(c, wood, G));
  if (b) ctx.drawImage(b, 0, G.blit.y * SS, G.W * SS, G.blit.h * SS, 0, G.blit.y, G.W, G.blit.h);   // only the band of the canvas the board lives in
}

// ---- seeds -------------------------------------------------------------------------------------------------
const SEED_BOX = 40, SEED_SC = 3;
const TINTS = {
  stones: [['#efe3cf', '#a89478', '#4d4030'], ['#d9cdb8', '#8d7b64', '#3d3226'], ['#c8b8a0', '#78695a', '#30291f'], ['#e6d6bc', '#9b8366', '#44382a']],
  nuts: [['#c98a52', '#7c3f1a', '#2f1408'], ['#b4733c', '#64300f', '#260f05'], ['#8a5236', '#42200f', '#180a04'], ['#c27c44', '#6a3010', '#240e05']],
  glass: [['#c8f4ee', '#3fb0a8', '#10545a'], ['#d4e8ff', '#4f83d6', '#1a2f74'], ['#ffe6b0', '#e0902c', '#7a3d08'], ['#f1d0ff', '#a44fd0', '#4a1670']],
};
const sprites = {};
function paintSeed(set, v) {
  const m = makeCanvas(SEED_BOX * SEED_SC, SEED_BOX * SEED_SC); if (!m) return null;
  const c = m.x; c.scale(SEED_SC, SEED_SC); c.translate(SEED_BOX / 2, SEED_BOX / 2);
  // soft contact shadow, baked in
  c.fillStyle = 'rgba(15,4,0,0.34)'; c.beginPath(); c.ellipse(2.6, 4.2, 9.4, 6.4, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(15,4,0,0.22)'; c.beginPath(); c.ellipse(1.6, 3, 10.8, 7.2, 0, 0, TAU); c.fill();
  {
    const T = TINTS[set][v % 4], g = c.createRadialGradient(-3, -3.4, 0.6, 0, 0, set === 'glass' ? 8.6 : 10);
    g.addColorStop(0, T[0]); g.addColorStop(0.5, T[1]); g.addColorStop(1, T[2]);
    c.fillStyle = g; c.beginPath();
    if (set === 'glass') c.arc(0, 0, 8, 0, TAU); else if (set === 'stones') c.ellipse(0, 0, 9.6, 7.8, (v % 4) * 0.5, 0, TAU); else c.ellipse(0, 0, 9.2, 7.6, 0, 0, TAU);
    c.fill(); c.strokeStyle = 'rgba(15,4,0,0.45)'; c.lineWidth = 0.9; c.stroke();
    if (set === 'nuts') { c.strokeStyle = 'rgba(30,10,2,0.25)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-6, 2 + (v % 3) - 1); c.quadraticCurveTo(0, 4, 6, 1); c.stroke(); }
    if (set === 'stones') { c.fillStyle = 'rgba(40,28,18,0.35)'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(-5 + ((k * 7 + v * 3) % 11), -3 + ((k * 5 + v) % 7), 0.7, 0, TAU); c.fill(); } c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-6, 1); c.quadraticCurveTo(0, -2.5, 6, 0.5); c.stroke(); }
    if (set === 'glass') { c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.1; c.beginPath(); c.arc(0, 0, 5.2, 0.4, 2.6); c.stroke(); c.fillStyle = 'rgba(15,4,0,0.45)'; c.beginPath(); c.arc(0, 0, 1.6, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(255,248,230,0.88)'; c.beginPath(); c.ellipse(-3.1, -3.2, 2.9, 1.5, -0.6, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,240,200,0.28)'; c.beginPath(); c.ellipse(2.6, 3.2, 3.4, 1.1, -0.4, 0, TAU); c.fill();
  }
  return m.c;
}
export function drawSeed(ctx, set, v, x, y, rot = 0, s = 1) {
  const key = set + (v % 4);
  let sp = sprites[key];
  if (sp === undefined) sp = sprites[key] = paintSeed(set, v);
  if (!sp) { ctx.fillStyle = '#7a3a12'; ctx.beginPath(); ctx.arc(x, y, 8 * s, 0, TAU); ctx.fill(); return; }
  const w = SEED_BOX * s;
  if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(sp, -w / 2, -w / 2, w, w); ctx.restore(); }
  else ctx.drawImage(sp, x - w / 2, y - w / 2, w, w);
}
// where seed number k rests inside a pit of radius r (stable: adding a seed never moves the others)
export function slot(pit, k, r = PIT_R) {
  if (k < 26) {
    const rad = Math.min(r - 10, 7.9 * Math.sqrt(k + 0.4)), a = k * 2.399963 + pit * 1.1;
    return { x: Math.cos(a) * rad * 1.0, y: Math.sin(a) * rad * 0.94, rot: ((k * 137 + pit * 53) % 360) * Math.PI / 180, v: (k * 5 + pit) % 4 };
  }
  const a = k * 2.399963 + pit, rad = 6 + ((k * 7) % 16);
  return { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.9 - (k - 26) * 0.8, rot: ((k * 91) % 360) * Math.PI / 180, v: (k * 3 + pit) % 4 };
}
