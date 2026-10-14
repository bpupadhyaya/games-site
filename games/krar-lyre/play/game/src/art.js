// Krar Lyre: all the painting that is not UI. A highland dawn, a bowl lyre of wood and hide with a crossbar of coloured tuning wraps,
// six strings that shimmer when plucked, approach rings, sparks. Pure canvas 2D; no DOM. Everything is a function of its arguments (and the
// clock the caller passes), so it is deterministic.
import { STRING_COUNT } from './music.js';
import { v3 } from './v3.js';

export const PAL = {
  ink: '#08201e', night: '#0d2e2b', deep: '#144b44', teal: '#1f7a6e', leaf: '#46b27a', sun: '#ffc94a', sunHi: '#fff0b8', saffron: '#f2a93b',
  clay: '#c8553d', crimson: '#b8324a', coral: '#ff7d6b', mint: '#a8f0d4', hide: '#ecd7a6', hideDeep: '#b99a62', wood: '#8a4a22', woodDark: '#3a1c0c',
  woodLight: '#d49a5e', cream: '#fff6e0', text: '#fff7e6', dim: 'rgba(255,247,230,0.68)', gold: '#ffd869', line: 'rgba(255,240,200,0.2)',
};
export const DISPLAY = '"Dela Gothic One", "Arial Black", Impact, system-ui, sans-serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (x) => x * x * (3 - 2 * x);
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
// the six tuning-wrap colours (bright cloth and leather on the crossbar), low string to high
export const WRAPS = ['#e8b23a', '#2fa58a', '#c8553d', '#4f8fe0', '#e7864a', '#9b6fd0'];
// cue colours per kind of gesture: loud pluck, soft pluck, strum, damp
export const CUE = { p: '255,209,77', soft: '168,240,212', s: '255,125,107', d: '236,215,166' };
const mkRand = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

const caches = new Map();
function cached(key, w, h, scale, paint) {
  if (typeof OffscreenCanvas !== 'function') return null;
  let c = caches.get(key);
  if (c === undefined) {
    if (caches.size > 8) caches.clear();
    try { c = new OffscreenCanvas(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale))); const g = c.getContext('2d'); g.scale(scale, scale); paint(g, w, h); } catch { c = null; }
    caches.set(key, c);
  }
  return c;
}

// ---- the highland dawn ------------------------------------------------------------------------------------------------------------------------
export function paintDawn(g, w, h) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0a2a2c'); sky.addColorStop(0.28, '#14504d'); sky.addColorStop(0.5, '#3d8a73'); sky.addColorStop(0.64, '#e8b86a'); sky.addColorStop(0.7, '#ffcf7a'); sky.addColorStop(1, '#0d2a26');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const R = mkRand(4242), hy = h * 0.64;
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,250,225,${0.15 + R() * 0.45})`; g.beginPath(); g.arc(R() * w, R() * h * 0.3, 0.6 + R() * 1.1, 0, TAU); g.fill(); }
  const sx = w * 0.7, sr = Math.min(w, h) * 0.12;
  const halo = g.createRadialGradient(sx, hy, sr * 0.4, sx, hy, Math.max(w, h) * 0.6);
  halo.addColorStop(0, 'rgba(255,230,150,0.85)'); halo.addColorStop(0.2, 'rgba(255,190,90,0.38)'); halo.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = halo; g.fillRect(0, 0, w, h);
  const disc = g.createRadialGradient(sx, hy, 2, sx, hy, sr);
  disc.addColorStop(0, '#fffbe0'); disc.addColorStop(1, '#ffd36a');
  g.fillStyle = disc; g.beginPath(); g.arc(sx, hy, sr, 0, TAU); g.fill();
  // three ridges of highland, each paler into the mist
  const ridge = (base, amp, col, seed, step) => {
    const rr = mkRand(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
    let y = base; for (let x = 0; x <= w + step; x += step) { y = base + (rr() - 0.5) * amp + Math.sin(x * 0.006 + seed) * amp * 0.5; g.lineTo(x, y); }
    g.lineTo(w + step, h); g.closePath(); g.fill();
  };
  ridge(hy - 6, 46, 'rgba(60,140,116,0.75)', 3, 38);
  ridge(hy + 26, 52, 'rgba(32,104,90,0.9)', 8, 34);
  ridge(hy + 64, 40, 'rgba(18,70,62,0.96)', 15, 30);
  // flat-topped acacia on the right ridge, a round thatched hut on the left
  const tx = w * 0.88, ty = hy + 40;
  g.fillStyle = 'rgba(6,28,24,0.95)'; g.strokeStyle = 'rgba(6,28,24,0.95)'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(tx, ty + 30); g.quadraticCurveTo(tx - 8, ty - 10, tx - 2, ty - 46); g.stroke();
  g.beginPath(); g.ellipse(tx, ty - 58, 78, 20, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(tx - 34, ty - 48, 40, 14, 0, 0, TAU); g.fill();
  const hx = w * 0.14, hyy = hy + 52;
  g.beginPath(); g.moveTo(hx - 46, hyy); g.lineTo(hx - 46, hyy - 24); g.lineTo(hx, hyy - 74); g.lineTo(hx + 46, hyy - 24); g.lineTo(hx + 46, hyy); g.closePath(); g.fill();
  // woven band across the foot (a basketry zigzag), kept dark and quiet
  const bandH = Math.max(46, h * 0.045), by = h - bandH;
  g.fillStyle = 'rgba(8,30,26,0.92)'; g.fillRect(0, by, w, bandH);
  const cols = ['rgba(242,169,59,0.5)', 'rgba(200,85,61,0.5)', 'rgba(47,165,138,0.5)'];
  for (let x = 0, i = 0; x < w + 30; x += 30, i++) {
    g.fillStyle = cols[i % 3]; g.beginPath(); g.moveTo(x, by + bandH); g.lineTo(x + 15, by + 8); g.lineTo(x + 30, by + bandH); g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(242,169,59,0.5)'; g.fillRect(0, by - 3, w, 3);
  const v = g.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(2,14,12,0.6)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
}
// `pulse` 0..1 is the beat: the sun breathes a little. `dim` 0..1 darkens it so play surfaces read cleanly.
export function drawBackdrop(ctx, w, h, t, pulse = 0, dim = 0) {
  if (v3.on) {
    // The 3D world is behind this transparent canvas: clear it, record the request, and (while fading in) paint the flat dawn at the remaining opacity.
    ctx.clearRect(0, 0, w, h); v3.back = { w, h, t, pulse, dim };
    if (v3.fade >= 0.999) return;
    ctx.save(); ctx.globalAlpha = 1 - v3.fade; drawFlatBackdrop(ctx, w, h, t, pulse, dim); ctx.restore();
    return;
  }
  drawFlatBackdrop(ctx, w, h, t, pulse, dim);
}
function drawFlatBackdrop(ctx, w, h, t, pulse, dim) {
  const c = cached(`bg${Math.round(w)}x${Math.round(h)}`, w, h, 1.1, paintDawn);
  if (c) ctx.drawImage(c, 0, 0, w, h);
  else { const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a2a2c'); gr.addColorStop(0.6, '#3d8a73'); gr.addColorStop(1, '#0d2a26'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); }
  if (pulse > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(w * 0.7, h * 0.64, 4, w * 0.7, h * 0.64, h * 0.4); g.addColorStop(0, `rgba(255,214,120,${0.18 * pulse})`); g.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore(); }
  drawMotes(ctx, w, h, t);
  if (dim > 0) { ctx.fillStyle = `rgba(4,18,16,${dim})`; ctx.fillRect(0, 0, w, h); }
}
function drawMotes(ctx, w, h, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const x = ((i * 173.7 + t * (6 + (i % 4) * 3)) % (w + 40)) - 20, y = h * (0.12 + 0.6 * ((i * 0.31) % 1)) + Math.sin(t * 0.6 + i * 1.7) * 14;
    const a = 0.25 + 0.25 * Math.sin(t * 1.3 + i * 2.1), r = 1.5 + (i % 3) * 0.6;
    ctx.fillStyle = `rgba(255,236,170,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- the lyre -----------------------------------------------------------------------------------------------------------------------------------------
// Geometry (from layout.lyreFor): { cx, barY, bridgeY, tailY, botY, halfTop, rx, ry, bowlCy, xs[6] at the bridge, xt[6] at the crossbar, pluckY }
// lyrePoint(G, i, y): the x of string i at height y (between the bridge and the crossbar; clamped).
export function lyreX(G, i, y) {
  const k = clamp01((G.bridgeY - y) / Math.max(1, G.bridgeY - G.barY));
  return G.xs[i] + (G.xt[i] - G.xs[i]) * k;
}
export function paintBowl(g, rx, ry) {
  const W = rx * 2 + 40, H = ry * 2 + 40, cx = W / 2, cy = H / 2, R = mkRand(77);
  const sh = g.createLinearGradient(cx - rx, cy - ry, cx + rx * 0.8, cy + ry);
  sh.addColorStop(0, '#d9915a'); sh.addColorStop(0.4, '#9a5228'); sh.addColorStop(1, '#3a1c0c');
  g.fillStyle = sh; g.beginPath(); g.ellipse(cx, cy, rx * 1.03, ry * 1.03, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(40,16,6,0.28)'; g.lineWidth = 1.3;
  for (let k = 0; k < 14; k++) { const a = R() * TAU; g.beginPath(); g.ellipse(cx, cy, rx * (0.9 + R() * 0.1), ry * (0.9 + R() * 0.1), 0, a, a + 0.5 + R()); g.stroke(); }
  // a painted band of triangles round the rim (basketry colours, no symbols)
  const n = 36, cols = ['#e8b23a', '#c8553d', '#2fa58a'];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU, am = (a0 + a1) / 2;
    g.fillStyle = cols[i % 3];
    g.beginPath();
    g.moveTo(cx + Math.cos(a0) * rx * 0.97, cy + Math.sin(a0) * ry * 0.97);
    g.lineTo(cx + Math.cos(a1) * rx * 0.97, cy + Math.sin(a1) * ry * 0.97);
    g.lineTo(cx + Math.cos(am) * rx * 0.86, cy + Math.sin(am) * ry * 0.86);
    g.closePath(); g.fill();
  }
  const fx = rx * 0.84, fy = ry * 0.84;
  const sk = g.createRadialGradient(cx - fx * 0.25, cy - fy * 0.3, fx * 0.1, cx, cy, fx * 1.1);
  sk.addColorStop(0, '#fbf0d0'); sk.addColorStop(0.6, '#ecd7a6'); sk.addColorStop(1, '#b99a62');
  g.fillStyle = sk; g.beginPath(); g.ellipse(cx, cy, fx, fy, 0, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.ellipse(cx, cy, fx, fy, 0, 0, TAU); g.clip();
  for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(120,84,40,${0.04 + R() * 0.07})`; g.beginPath(); g.ellipse(cx + (R() - 0.5) * fx * 2, cy + (R() - 0.5) * fy * 2, 2 + R() * 11, 1 + R() * 5, R() * 3, 0, TAU); g.fill(); }
  const inner = g.createRadialGradient(cx, cy, fx * 0.5, cx, cy, fx * 1.05); inner.addColorStop(0, 'rgba(60,24,8,0)'); inner.addColorStop(1, 'rgba(60,24,8,0.38)');
  g.fillStyle = inner; g.fillRect(0, 0, W, H);
  g.restore();
  const tacks = 30;
  for (let i = 0; i < tacks; i++) {
    const a = (i / tacks) * TAU, x = cx + Math.cos(a) * fx * 0.97, y = cy + Math.sin(a) * fy * 0.97, r = Math.max(2, rx * 0.011);
    const tg = g.createRadialGradient(x - r * 0.3, y - r * 0.35, 0.3, x, y, r * 1.1); tg.addColorStop(0, '#fff2b8'); tg.addColorStop(0.5, '#d9a63e'); tg.addColorStop(1, '#7a5214');
    g.fillStyle = tg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
}

// Draws the lyre. o: { vib[0..9] amplitude per sound k (1..6 are the strings), t, glow 0..1 (bowl warms when sounding), labels (array of 6 names or null),
//   dimStrings (Set or array of string numbers drawn quiet), damp 0..1 (palm flash on the bowl), hint (string numbers drawn with a soft halo) }
export function drawLyre(ctx, G, o = {}) {
  if (v3.on) {
    v3.lyre = { G, o };
    if (v3.fade < 0.999) { ctx.save(); ctx.globalAlpha = 1 - v3.fade; drawFlatLyre(ctx, G, o); ctx.restore(); } else drawLyreLabels(ctx, G, o);
    return;
  }
  drawFlatLyre(ctx, G, o);
}
function drawFlatLyre(ctx, G, o) {
  const { cx, barY, bridgeY, tailY, botY, halfTop, rx, ry, bowlCy } = G;
  const t = o.t ?? 0, vib = o.vib ?? [], armW = Math.max(14, rx * 0.12);
  ctx.save();
  const aura = ctx.createRadialGradient(cx, (barY + bowlCy) / 2, rx * 0.3, cx, (barY + bowlCy) / 2, halfTop * 1.6); aura.addColorStop(0, 'rgba(255,214,130,0.16)'); aura.addColorStop(1, 'rgba(255,214,130,0)');
  ctx.fillStyle = aura; ctx.fillRect(cx - halfTop * 1.7, barY - 40, halfTop * 3.4, botY - barY + 80);
  // ground shadow
  const sg = ctx.createRadialGradient(cx, botY + ry * 0.05, rx * 0.2, cx, botY + ry * 0.05, rx * 1.3); sg.addColorStop(0, 'rgba(2,12,10,0.6)'); sg.addColorStop(1, 'rgba(2,12,10,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(cx, botY + ry * 0.05, rx * 1.3, ry * 0.45, 0, 0, TAU); ctx.fill();
  // arms: from the bowl sides up to the crossbar, bowing outward
  const arm = (s) => {
    const x0 = cx + s * rx * 0.88, y0 = bowlCy - ry * 0.25, x1 = cx + s * halfTop, y1 = barY;
    const c1x = cx + s * (rx * 1.02), c1y = (y0 + y1) / 2 + 20;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(2,12,10,0.45)'; ctx.lineWidth = armW + 6; ctx.beginPath(); ctx.moveTo(x0 + 4, y0 + 5); ctx.quadraticCurveTo(c1x + 4, c1y + 5, x1 + 4, y1 + 5); ctx.stroke();
    const gg = ctx.createLinearGradient(x0 - armW, 0, x0 + armW, 0); gg.addColorStop(0, '#d9915a'); gg.addColorStop(0.5, '#8a4a22'); gg.addColorStop(1, '#3a1c0c');
    ctx.strokeStyle = gg; ctx.lineWidth = armW; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(c1x, c1y, x1, y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,225,180,0.35)'; ctx.lineWidth = Math.max(1.5, armW * 0.18); ctx.beginPath(); ctx.moveTo(x0 - armW * 0.2, y0); ctx.quadraticCurveTo(c1x - armW * 0.2, c1y, x1 - armW * 0.2, y1); ctx.stroke();
  };
  arm(-1); arm(1);
  // the bowl: first its wall (a deep dish below the hide), then the painted rim and the hide
  const wall = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0); wall.addColorStop(0, '#b87440'); wall.addColorStop(0.35, '#7a3f1c'); wall.addColorStop(1, '#2c1408');
  ctx.fillStyle = wall; ctx.beginPath(); ctx.ellipse(cx, bowlCy + ry * 0.24, rx * 1.01, ry * 1.0, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,225,180,0.22)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, bowlCy + ry * 0.24, rx * 0.97, ry * 0.93, 0, 0.35, Math.PI - 0.35); ctx.stroke();
  const sc = rx > 420 ? 0.8 : 1.1, c = cached(`bowl${Math.round(rx / 3)}x${Math.round(ry / 3)}`, rx * 2 + 40, ry * 2 + 40, sc, (g) => paintBowl(g, rx, ry));
  if (c) ctx.drawImage(c, cx - rx - 20, bowlCy - ry - 20, rx * 2 + 40, ry * 2 + 40);
  else { ctx.fillStyle = '#9a5228'; ctx.beginPath(); ctx.ellipse(cx, bowlCy, rx, ry, 0, 0, TAU); ctx.fill(); ctx.fillStyle = PAL.hide; ctx.beginPath(); ctx.ellipse(cx, bowlCy, rx * 0.84, ry * 0.84, 0, 0, TAU); ctx.fill(); }
  const glow = Math.max(o.glow ?? 0, o.damp ?? 0);
  if (glow > 0.01) { ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(cx, bowlCy, 4, cx, bowlCy, rx * 0.85); gg.addColorStop(0, `rgba(${o.damp > 0.01 ? '236,215,166' : '255,200,110'},${0.34 * glow})`); gg.addColorStop(1, 'rgba(255,190,100,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(cx, bowlCy, rx * 0.84, ry * 0.84, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
  // crossbar with its coloured tuning wraps and little tails
  const barH = Math.max(18, armW * 1.15), bx0 = cx - halfTop - armW * 0.7, bw = halfTop * 2 + armW * 1.4;
  ctx.fillStyle = 'rgba(2,12,10,0.4)'; ctx.beginPath(); ctx.roundRect(bx0 + 3, barY - barH / 2 + 6, bw, barH, barH / 2); ctx.fill();
  const bg = ctx.createLinearGradient(0, barY - barH / 2, 0, barY + barH / 2); bg.addColorStop(0, '#e2a76a'); bg.addColorStop(0.45, '#9a5228'); bg.addColorStop(1, '#4a230f');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(bx0, barY - barH / 2, bw, barH, barH / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,190,0.45)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(bx0 + barH / 2, barY - barH / 2 + 2.5); ctx.lineTo(bx0 + bw - barH / 2, barY - barH / 2 + 2.5); ctx.stroke();
  for (let i = 0; i < STRING_COUNT; i++) {
    const x = G.xt[i], ww = Math.max(14, barH * 0.8), sway = Math.sin(t * 1.1 + i * 1.3) * 2 + (vib[i + 1] ?? 0) * 3 * Math.sin(t * 60 + i);
    ctx.fillStyle = WRAPS[i]; ctx.beginPath(); ctx.roundRect(x - ww / 2, barY - barH * 0.7, ww, barH * 1.4, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.5; for (let q = 1; q < 4; q++) { const yy = barY - barH * 0.7 + (barH * 1.4 * q) / 4; ctx.beginPath(); ctx.moveTo(x - ww / 2, yy); ctx.lineTo(x + ww / 2, yy + 2); ctx.stroke(); }
    ctx.strokeStyle = WRAPS[i]; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(x - 2, barY + barH * 0.7); ctx.quadraticCurveTo(x - 4 + sway, barY + barH * 1.5, x + sway * 1.5, barY + barH * 2.3); ctx.stroke();
  }
  // bridge and tailpiece on the hide
  const bxL = G.xs[0] - 22, bxR = G.xs[STRING_COUNT - 1] + 22, bh = Math.max(12, armW * 0.8);
  ctx.fillStyle = 'rgba(30,10,4,0.4)'; ctx.beginPath(); ctx.ellipse((bxL + bxR) / 2, bridgeY + bh * 0.7, (bxR - bxL) / 2 + 6, bh * 0.45, 0, 0, TAU); ctx.fill();
  const brg = ctx.createLinearGradient(0, bridgeY - bh / 2, 0, bridgeY + bh / 2); brg.addColorStop(0, '#e2a76a'); brg.addColorStop(0.4, '#a8622d'); brg.addColorStop(1, '#4d230e');
  ctx.fillStyle = brg; ctx.beginPath(); ctx.roundRect(bxL, bridgeY - bh / 2, bxR - bxL, bh, bh * 0.4); ctx.fill();
  const tpw = bxR - bxL + 10;
  ctx.fillStyle = '#5a2c18'; ctx.beginPath(); ctx.roundRect(cx - tpw / 2, tailY - bh * 0.35, tpw, bh * 0.7, bh * 0.35); ctx.fill();
  // strings: tailpiece -> bridge -> crossbar
  const dimSet = o.dimStrings ?? [];
  for (let i = 0; i < STRING_COUNT; i++) {
    const amp = vib[i + 1] ?? 0, dim = dimSet.includes && dimSet.includes(i + 1) ? 0.35 : 1, thick = Math.max(2.2, rx * 0.012) * (1.3 - 0.5 * i / (STRING_COUNT - 1));
    const tx = cx + (G.xs[i] - cx) * 0.55;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,246,224,${0.7 * dim})`; ctx.lineWidth = thick; ctx.beginPath(); ctx.moveTo(tx, tailY); ctx.lineTo(G.xs[i], bridgeY); ctx.stroke();
    if (amp > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,214,120,${0.4 * amp})`; ctx.lineWidth = thick * 3.2; ctx.beginPath(); ctx.moveTo(G.xs[i], bridgeY); ctx.lineTo(G.xt[i], barY); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      const dx = G.xt[i] - G.xs[i], dy = barY - bridgeY, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, segs = 16;
      ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = thick * (1 + 0.5 * amp); ctx.beginPath();
      for (let k = 0; k <= segs; k++) {
        const u = k / segs, off = Math.sin(u * Math.PI) * Math.sin(t * 90 + i * 1.7 + u * 6) * 7 * amp;
        const x = G.xs[i] + dx * u + nx * off, y = bridgeY + dy * u + ny * off; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    } else {
      const fade = ctx.createLinearGradient(G.xs[i], bridgeY, G.xt[i], barY); fade.addColorStop(0, `rgba(255,250,232,${0.95 * dim})`); fade.addColorStop(1, `rgba(255,244,214,${0.7 * dim})`);
      ctx.strokeStyle = fade; ctx.lineWidth = thick; ctx.beginPath(); ctx.moveTo(G.xs[i], bridgeY); ctx.lineTo(G.xt[i], barY); ctx.stroke();
    }
    ctx.restore();
  }
  drawLyreLabels(ctx, G, o);
  ctx.restore();
}
function drawLyreLabels(ctx, G, o) {
  const rx = G.rx;
  if (o.labels) {
    ctx.save();
    ctx.font = `700 ${Math.max(15, rx * 0.058)}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < STRING_COUNT; i++) {
      const x = lyreX(G, i, G.pluckY + (G.bridgeY - G.pluckY) * 0.55), y = G.pluckY + (G.bridgeY - G.pluckY) * 0.55;
      ctx.fillStyle = 'rgba(8,32,30,0.82)'; ctx.beginPath(); ctx.arc(x, y, Math.max(14, rx * 0.052), 0, TAU); ctx.fill();
      ctx.fillStyle = PAL.cream; ctx.fillText(o.labels[i], x, y + 1);
    }
    ctx.restore();
  }
}

// ---- cues (the approach rings) ----------------------------------------------------------------------------------------------------------------------
// A ring closing onto the string at the pluck point. k: 0 far .. 1 at the string. kind 'p' pluck, 'soft', 'd' damp (a rounded square on the bowl),
// 's' strum (a pill spanning the strings; arrow shows direction). `r` is the target radius.
export function drawCue(ctx, x, y, r, k, kind, o = {}) {
  const e = ease(clamp01(k)), outer = r * (1 + 2.1 * (1 - e)), a = (0.25 + 0.75 * e) * (o.alpha ?? 1);
  const rgb = CUE[kind] ?? CUE.p;
  ctx.save();
  if (o.ghost) { ctx.strokeStyle = `rgba(${rgb},${0.35 * a})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore(); return; }
  // the target: a faint filled disc the ring closes onto
  ctx.fillStyle = `rgba(${rgb},${0.12 + 0.12 * e})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(8,32,30,0.8)`; ctx.lineWidth = r * 0.2 + 4; ctx.beginPath(); ctx.arc(x, y, outer, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = r * 0.2 + (kind === 'soft' ? 0 : 1.5); ctx.beginPath(); ctx.arc(x, y, outer, 0, TAU); ctx.stroke();
  if (o.label) { ctx.font = `800 ${Math.round(r * 0.8)}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = `rgba(255,247,230,${a})`; ctx.fillText(o.label, x, y + 1); }
  ctx.restore();
}
// A strum cue: a pill from the first to the last string at the pluck point, with a travelling chevron; k closes it like a ring.
export function drawStrumCue(ctx, xa, xb, y, r, k, o = {}) {
  const e = ease(clamp01(k)), pad = r * (0.9 + 1.8 * (1 - e)), a = (0.3 + 0.7 * e) * (o.alpha ?? 1), rgb = CUE.s;
  const x0 = Math.min(xa, xb) - pad, x1 = Math.max(xa, xb) + pad, h = r * 1.5 + (1 - e) * r * 1.6;
  ctx.save();
  ctx.fillStyle = `rgba(${rgb},${0.14 + 0.1 * e})`; ctx.beginPath(); ctx.roundRect(x0, y - h / 2, x1 - x0, h, h / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(8,32,30,0.8)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.roundRect(x0, y - h / 2, x1 - x0, h, h / 2); ctx.stroke();
  ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = 5; ctx.stroke();
  const dir = xb >= xa ? 1 : -1, n = 3;
  ctx.strokeStyle = `rgba(255,247,230,${a})`; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const cxm = (xa + xb) / 2 + dir * (i - 1) * Math.abs(xb - xa) * 0.28, s = r * 0.32;
    ctx.beginPath(); ctx.moveTo(cxm - dir * s, y - s); ctx.lineTo(cxm + dir * s * 0.6, y); ctx.lineTo(cxm - dir * s, y + s); ctx.stroke();
  }
  ctx.restore();
}
// A damp cue on the bowl: a rounded-square ring that closes, with a flat palm mark.
export function drawDampCue(ctx, x, y, r, k, o = {}) {
  const e = ease(clamp01(k)), outer = r * (1 + 0.9 * (1 - e)), a = (0.3 + 0.7 * e) * (o.alpha ?? 1), rgb = CUE.d;
  ctx.save();
  ctx.fillStyle = `rgba(${rgb},${0.18 + 0.15 * e})`; ctx.beginPath(); ctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.45); ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,8,0.75)'; ctx.lineWidth = r * 0.22 + 4; ctx.beginPath(); ctx.roundRect(x - outer, y - outer, outer * 2, outer * 2, outer * 0.45); ctx.stroke();
  ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = r * 0.22; ctx.stroke();
  // palm: a flat hand shape (rounded palm plus four fingers)
  ctx.fillStyle = `rgba(60,34,14,${0.85 * a})`; const s = r * 0.52;
  ctx.beginPath(); ctx.roundRect(x - s * 0.8, y - s * 0.05, s * 1.6, s * 1.1, s * 0.4); ctx.fill();
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(x - s * 0.8 + i * s * 0.43, y - s * 1.0, s * 0.34, s * 1.1, s * 0.17); ctx.fill(); }
  ctx.restore();
}
// A soft glow where the teacher plucks (a fingertip of light).
export function drawTip(ctx, x, y, r, a, rgb = '255,214,120') {
  if (a < 0.02) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 1, x, y, r * 2.2); g.addColorStop(0, `rgba(${rgb},${0.85 * a})`); g.addColorStop(0.4, `rgba(${rgb},${0.3 * a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawPopup(ctx, p) {
  const k = clamp01(p.age / 0.8), a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, up = ease(Math.min(1, k * 1.6)) * 46;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sz = p.size * (1 + 0.25 * (1 - Math.min(1, p.age / 0.12)));
  ctx.font = `${sz}px ${DISPLAY}`; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, sz * 0.2); ctx.strokeStyle = 'rgba(4,22,20,0.92)';
  const hw = ctx.measureText(p.text).width / 2 + 6, px = Math.max(hw, Math.min(720 - hw, p.x));   // never clipped at a screen edge
  ctx.strokeText(p.text, px, p.y - up); ctx.fillStyle = p.col; ctx.fillText(p.text, px, p.y - up);
  ctx.restore();
}

export function drawParticles(ctx, list) {
  // two flat discs per spark (a soft halo and a core): no per-spark gradient objects, so a burst of plucks stays cheap on a mid phone
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of list) {
    const k = p.life / p.max, a = Math.max(0, k), r = p.size * (0.4 + 0.6 * k);
    ctx.fillStyle = `rgba(${p.c},${0.22 * a})`; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${p.c},${0.85 * a})`; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.85, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
export function stepParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt; if (p.life <= 0) { list.splice(i, 1); continue; }
    p.vy += (p.g ?? 260) * dt; p.vx *= 1 - 1.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
export function burst(list, rng, x, y, n, rgb = CUE.p, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(-Math.PI * 0.95, -Math.PI * 0.05), sp = rng.range(90, 320) * power;
    list.push({ x: x + rng.range(-8, 8), y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: rng.range(0.35, 0.8), max: 0.8, size: rng.range(2.5, 6), c: rng.chance(0.25) ? '255,248,226' : rgb });
  }
  while (list.length > 110) list.shift();
}

export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.15) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * gap * 1.2;
    ctx.save(); ctx.translate(x, cy);
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? size * 0.22 : size * 0.5; k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    if (i < n) { const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5); g.addColorStop(0, '#fff2b0'); g.addColorStop(1, '#e0a62e'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#7a5410'; ctx.lineWidth = 1.5; ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,240,210,0.3)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.restore();
  }
}
