// Painted-cloth art: appliqué cut-outs with stitched edges and soft shadows, kente-inspired stripe bands, Adinkra-inspired patterns
// (decoration only), and a layered 2.5D story window (sky, far hills, mid hills, ground, characters) that drifts with a slow sway
// and with the pointer. Everything is canvas drawing; nothing here changes game state.
import { TALES, PATTERNS } from './content.js';
import { DISPLAY, UI, rr } from './ui.js';

export const KENTE = ['#f2c14e', '#2f9d62', '#c8352b', '#1c1a33', '#e9893a'];
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mixc = (a, b, t) => { const x = hx(a), y = hx(b); return `rgb(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))})`; };

// ---- appliqué shape: soft drop shadow, flat fill, dark edge, inset stitches ------------------------------------------------------------
export function appl(ctx, path, fill, o = {}) {
  const { sh = 3, edge = 'rgba(20,8,18,0.55)', lw = 1.6, stitch = 'rgba(255,240,210,0.55)', dash = 5 } = o;
  if (sh) { ctx.save(); ctx.translate(sh, sh * 1.5); ctx.beginPath(); path(ctx); ctx.fillStyle = 'rgba(10,4,22,0.30)'; ctx.fill(); ctx.restore(); }
  ctx.beginPath(); path(ctx); ctx.fillStyle = fill; ctx.fill();
  if (stitch) { ctx.save(); ctx.clip(); ctx.setLineDash([dash, dash * 0.9]); ctx.lineWidth = Math.max(2, lw * 2.2); ctx.strokeStyle = stitch; ctx.stroke(); ctx.restore(); }
  ctx.lineWidth = lw; ctx.strokeStyle = edge; ctx.setLineDash([]); ctx.beginPath(); path(ctx); ctx.stroke();
}
const ell = (cx, cy, rx, ry, rot = 0) => (ctx) => ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
const poly = (pts) => (ctx) => { pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };

// ---- cloth: woven ground with fine weave lines, and kente-style stripe bands -----------------------------------------------------------------
export function weave(ctx, r, alpha = 0.06, step = 7) {
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.lineWidth = 1; ctx.strokeStyle = `rgba(255,255,255,${alpha})`; ctx.beginPath();
  for (let x = r.x; x < r.x + r.w; x += step) { ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); }
  ctx.stroke(); ctx.strokeStyle = `rgba(0,0,0,${alpha})`; ctx.beginPath();
  for (let y = r.y; y < r.y + r.h; y += step) { ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); }
  ctx.stroke(); ctx.restore();
}
// A band of woven blocks: alternating stripe colours with small diamond accents. dir 'h' fills a horizontal band.
export function band(ctx, x, y, w, h, seed = 0, colors = KENTE) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const u = h * 0.8; let cx = x, i = seed;
  while (cx < x + w) {
    const c = colors[i % colors.length], bw = u * (1 + ((i * 7) % 3) * 0.5);
    ctx.fillStyle = c; ctx.fillRect(cx, y, bw, h);
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.moveTo(cx + bw / 2, y + h * 0.2); ctx.lineTo(cx + bw * 0.8, y + h / 2); ctx.lineTo(cx + bw / 2, y + h * 0.8); ctx.lineTo(cx + bw * 0.2, y + h / 2); ctx.closePath(); ctx.fill(); }
    cx += bw; i += 1;
  }
  weave(ctx, { x, y, w, h }, 0.1, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + h - 2, w, 2); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w, 1.5);
  ctx.restore();
}

// ---- Adinkra-inspired patterns (decoration only; sayings are credited in About) -----------------------------------------------------------
export function pattern(ctx, id, cx, cy, s, col, lw = 0) {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = lw || Math.max(2, s * 0.09);
  const h = s / 2;
  if (id === 'akoma') {   // a heart
    ctx.beginPath(); ctx.moveTo(cx, cy + h * 0.85); ctx.bezierCurveTo(cx - h * 1.5, cy + h * 0.05, cx - h * 0.95, cy - h * 0.95, cx, cy - h * 0.3);
    ctx.bezierCurveTo(cx + h * 0.95, cy - h * 0.95, cx + h * 1.5, cy + h * 0.05, cx, cy + h * 0.85); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + h * 0.3); ctx.lineTo(cx, cy - h * 0.1); ctx.stroke();
  } else if (id === 'sankofa') {   // a bird looking back over its body, egg in the beak
    ctx.beginPath(); ctx.moveTo(cx - h * 0.7, cy + h * 0.6); ctx.bezierCurveTo(cx - h * 1.0, cy - h * 0.1, cx + h * 0.2, cy - h * 0.2, cx + h * 0.6, cy + h * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - h * 0.7, cy + h * 0.6); ctx.quadraticCurveTo(cx - h * 0.2, cy + h * 0.8, cx + h * 0.35, cy + h * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - h * 0.15, cy - h * 0.08); ctx.bezierCurveTo(cx - h * 0.5, cy - h * 0.85, cx + h * 0.45, cy - h * 0.95, cx + h * 0.3, cy - h * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + h * 0.42, cy - h * 0.18, h * 0.14, 0, TAU); ctx.fill();
  } else if (id === 'dwennimmen') {   // two ram horns curling in, joined by a bar
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sg * h * 0.12, cy - h * 0.6); ctx.bezierCurveTo(cx + sg * h * 1.2, cy - h * 0.9, cx + sg * h * 1.2, cy + h * 0.6, cx + sg * h * 0.45, cy + h * 0.5); ctx.bezierCurveTo(cx + sg * h * 0.1, cy + h * 0.45, cx + sg * h * 0.25, cy + h * 0.05, cx + sg * h * 0.5, cy + h * 0.12); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - h * 0.1, cy - h * 0.6); ctx.lineTo(cx + h * 0.1, cy - h * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - h * 0.3, cy + h * 0.85); ctx.lineTo(cx + h * 0.3, cy + h * 0.85); ctx.stroke();
  } else if (id === 'nkyinkyim') {   // a twisting path
    ctx.beginPath(); ctx.moveTo(cx - h * 0.7, cy - h * 0.8); ctx.lineTo(cx + h * 0.7, cy - h * 0.45); ctx.lineTo(cx - h * 0.7, cy + h * 0.05); ctx.lineTo(cx + h * 0.7, cy + h * 0.5); ctx.lineTo(cx - h * 0.4, cy + h * 0.85); ctx.stroke();
    for (const [x, y] of [[-0.7, -0.8], [0.7, -0.45], [-0.7, 0.05], [0.7, 0.5]]) { ctx.beginPath(); ctx.arc(cx + x * h, cy + y * h, h * 0.1, 0, TAU); ctx.fill(); }
  } else {   // duafe: a comb
    rr(ctx, cx - h * 0.8, cy - h * 0.15, h * 1.6, h * 0.5, h * 0.18); ctx.stroke();
    for (let i = 0; i < 5; i++) { const x = cx - h * 0.62 + i * h * 0.31; ctx.beginPath(); ctx.moveTo(x, cy + h * 0.35); ctx.lineTo(x, cy + h * 0.85); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx, cy - h * 0.15); ctx.lineTo(cx, cy - h * 0.85); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - h * 0.85, h * 0.14, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- characters ----------------------------------------------------------------------------------------------------------------------------------
const SKIN = ['#8a5632', '#6e3f24', '#a46a3e', '#5a3320'];
// Anansi: round kente-striped body, warm face, little cap, eight legs. look = {x, y} unit vector the eyes glance towards.
export function anansi(ctx, x, y, k, t, { pose = 'idle', look = { x: 0, y: 0 }, flip = 1, hop = 0 } = {}) {
  const bob = Math.sin(t * 2.4) * k * 0.03 - hop * k * 0.35;
  y += bob;
  ctx.save(); ctx.translate(x, y); ctx.scale(flip, 1);
  // legs: four each side, bent at the knee
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 8; i++) {
    const sg = i < 4 ? -1 : 1, n = i % 4, a0 = [-0.9, -0.35, 0.2, 0.7][n], lift = Math.sin(t * 2 + i) * k * 0.04;
    const kx = sg * k * (0.75 + n * 0.1), ky = k * (-0.55 + n * 0.28) + lift, fx = sg * k * (1.05 + (n === 1 || n === 2 ? 0.2 : 0)), fy = k * (0.55 + (n === 3 ? 0.18 : 0.05) - (n === 0 ? 0.9 : 0)) + lift * 0.4;
    void a0;
    ctx.beginPath(); ctx.moveTo(sg * k * 0.35, k * (0.05 + n * 0.1)); ctx.quadraticCurveTo(kx, ky, fx, fy);
    ctx.lineWidth = k * 0.13; ctx.strokeStyle = 'rgba(10,4,20,0.28)'; ctx.save(); ctx.translate(2, 3); ctx.stroke(); ctx.restore();
    ctx.lineWidth = k * 0.11; ctx.strokeStyle = '#2a1710'; ctx.stroke();
    ctx.lineWidth = k * 0.03; ctx.strokeStyle = 'rgba(255,220,170,0.35)'; ctx.setLineDash([k * 0.08, k * 0.07]); ctx.stroke(); ctx.setLineDash([]);
  }
  // abdomen with kente bands
  appl(ctx, ell(0, k * 0.18, k * 0.62, k * 0.56), '#7a2a1c', { sh: k * 0.05, lw: k * 0.03, stitch: 'rgba(255,230,180,0.5)', dash: k * 0.09 });
  ctx.save(); ctx.beginPath(); ell(0, k * 0.18, k * 0.62, k * 0.56)(ctx); ctx.clip();
  [['#f2c14e', 0.0], ['#2f9d62', 0.2], ['#1c1a33', 0.4]].forEach(([c, o], i) => { ctx.fillStyle = c; ctx.fillRect(-k * 0.7, k * (0.0 + o * 1.1), k * 1.4, k * 0.1); if (i === 0) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let j = -3; j <= 3; j++) ctx.fillRect(j * k * 0.2 - k * 0.04, k * 0.02, k * 0.08, k * 0.06); } });
  const g = ctx.createRadialGradient(-k * 0.2, k * -0.05, k * 0.05, 0, k * 0.2, k * 0.7); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0.28)'); ctx.fillStyle = g; ctx.fillRect(-k * 0.7, -k * 0.5, k * 1.4, k * 1.4);
  ctx.restore();
  // arms
  const wave = pose === 'cheer' ? Math.sin(t * 9) * 0.35 : pose === 'think' ? 0.2 : Math.sin(t * 1.7) * 0.08;
  for (const sg of [-1, 1]) {
    const up = pose === 'cheer' ? -1.15 : pose === 'think' && sg === 1 ? -0.5 : -0.2;
    ctx.beginPath(); ctx.moveTo(sg * k * 0.3, -k * 0.05); ctx.quadraticCurveTo(sg * k * 0.62, k * up * 0.5 + k * wave * 0.2, sg * k * 0.5, k * (up - 0.15) + k * wave * 0.3);
    ctx.lineWidth = k * 0.1; ctx.strokeStyle = '#2a1710'; ctx.stroke();
  }
  // head
  const hy = -k * 0.48;
  appl(ctx, ell(0, hy, k * 0.4, k * 0.37), '#cf7a32', { sh: k * 0.04, lw: k * 0.03, stitch: 'rgba(255,235,190,0.5)', dash: k * 0.08 });
  appl(ctx, (c) => { c.moveTo(-k * 0.38, hy - k * 0.12); c.quadraticCurveTo(0, hy - k * 0.8, k * 0.38, hy - k * 0.12); c.quadraticCurveTo(0, hy - k * 0.28, -k * 0.38, hy - k * 0.12); }, '#243a7a', { sh: k * 0.03, lw: k * 0.025, stitch: 'rgba(255,230,160,0.7)', dash: k * 0.07 });
  ctx.fillStyle = '#f2c14e'; ctx.fillRect(-k * 0.34, hy - k * 0.17, k * 0.68, k * 0.05);
  // eyes glance towards `look`
  for (const sg of [-1, 1]) {
    const ex = sg * k * 0.16, ey = hy + k * 0.02;
    ctx.fillStyle = '#fff8e6'; ctx.beginPath(); ctx.ellipse(ex, ey, k * 0.115, k * 0.14, 0, 0, TAU); ctx.fill(); ctx.lineWidth = k * 0.02; ctx.strokeStyle = 'rgba(40,16,10,0.7)'; ctx.stroke();
    ctx.fillStyle = '#1b0e0a'; ctx.beginPath(); ctx.arc(ex + look.x * k * 0.05, ey + look.y * k * 0.06, k * 0.06, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + look.x * k * 0.05 - k * 0.02, ey + look.y * k * 0.06 - k * 0.025, k * 0.018, 0, TAU); ctx.fill();
  }
  ctx.lineWidth = k * 0.03; ctx.strokeStyle = '#3a1608'; ctx.lineCap = 'round'; ctx.beginPath();
  if (pose === 'think') { ctx.moveTo(-k * 0.1, hy + k * 0.2); ctx.lineTo(k * 0.12, hy + k * 0.19); } else { ctx.moveTo(-k * 0.15, hy + k * 0.17); ctx.quadraticCurveTo(0, hy + (pose === 'cheer' ? 0.38 : 0.28) * k, k * 0.15, hy + k * 0.17); }
  ctx.stroke();
  ctx.restore();
}

// A listener seen from the front: robe, head wrap, bobbing to the drum. cheer in 0..1 raises the arms.
export function listener(ctx, x, y, k, t, { robe = '#c8352b', wrap = '#f2c14e', skin = 0, phase = 0, cheer = 0, child = false } = {}) {
  const s = child ? 0.78 : 1, kk = k * s, bob = Math.sin(t * 3.2 + phase) * kk * 0.035 - cheer * kk * 0.22 * Math.abs(Math.sin(t * 10 + phase));
  ctx.save(); ctx.translate(x, y + bob);
  appl(ctx, (c) => { c.moveTo(-kk * 0.62, 0); c.quadraticCurveTo(-kk * 0.6, -kk * 0.85, -kk * 0.2, -kk * 0.95); c.lineTo(kk * 0.2, -kk * 0.95); c.quadraticCurveTo(kk * 0.6, -kk * 0.85, kk * 0.62, 0); c.closePath(); }, robe, { sh: kk * 0.05, lw: kk * 0.03, dash: kk * 0.09 });
  band(ctx, -kk * 0.5, -kk * 0.42, kk, kk * 0.12, phase * 3 | 0);
  if (cheer > 0.01) for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sg * kk * 0.5, -kk * 0.7); ctx.lineTo(sg * kk * 0.72, -kk * (1.15 + 0.1 * Math.sin(t * 10 + sg))); ctx.lineWidth = kk * 0.1; ctx.lineCap = 'round'; ctx.strokeStyle = SKIN[skin % 4]; ctx.stroke(); }
  appl(ctx, ell(0, -kk * 1.12, kk * 0.3, kk * 0.33), SKIN[skin % 4], { sh: kk * 0.04, lw: kk * 0.03, stitch: '' });
  appl(ctx, (c) => { c.moveTo(-kk * 0.32, -kk * 1.18); c.quadraticCurveTo(0, -kk * 1.75, kk * 0.32, -kk * 1.18); c.quadraticCurveTo(0, -kk * 1.32, -kk * 0.32, -kk * 1.18); }, wrap, { sh: kk * 0.03, lw: kk * 0.025, dash: kk * 0.07 });
  ctx.fillStyle = '#1b0e0a'; for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(sg * kk * 0.11, -kk * 1.08, kk * 0.035, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#1b0e0a'; ctx.lineWidth = kk * 0.025; ctx.beginPath(); ctx.arc(0, -kk * 1.0, kk * 0.1, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}

// The storyteller: an elder in indigo cloth with a tall head wrap, mouth that opens while speaking, one hand gesturing, one on a talking drum.
export function storyteller(ctx, x, y, k, t, { speak = 0, beat = 0 } = {}) {
  ctx.save(); ctx.translate(x, y);
  const sway = Math.sin(t * 1.3) * k * 0.025, m = speak * (0.5 + 0.5 * Math.sin(t * 17));
  // robe
  appl(ctx, (c) => { c.moveTo(-k * 0.95, 0); c.quadraticCurveTo(-k * 0.85, -k * 1.15, -k * 0.28 + sway, -k * 1.5); c.lineTo(k * 0.28 + sway, -k * 1.5); c.quadraticCurveTo(k * 0.85, -k * 1.15, k * 0.95, 0); c.closePath(); }, '#243a7a', { sh: k * 0.06, lw: k * 0.03, dash: k * 0.11, stitch: 'rgba(255,230,160,0.5)' });
  band(ctx, -k * 0.8, -k * 0.62, k * 1.6, k * 0.15, 1);
  band(ctx, -k * 0.55, -k * 1.2, k * 1.1, k * 0.09, 3);
  // gesturing arm
  const ga = -0.4 + Math.sin(t * 2.1) * 0.25 * (0.4 + speak);
  ctx.beginPath(); ctx.moveTo(k * 0.52, -k * 1.15); ctx.quadraticCurveTo(k * 0.95, -k * (1.1 - ga), k * 1.05, -k * (1.55 + ga * 0.4)); ctx.lineWidth = k * 0.16; ctx.lineCap = 'round'; ctx.strokeStyle = '#243a7a'; ctx.stroke();
  ctx.beginPath(); ctx.arc(k * 1.05, -k * (1.58 + ga * 0.4), k * 0.1, 0, TAU); ctx.fillStyle = SKIN[1]; ctx.fill();
  // head
  appl(ctx, ell(sway, -k * 1.78, k * 0.34, k * 0.38), SKIN[0], { sh: k * 0.04, lw: k * 0.03, stitch: '' });
  appl(ctx, (c) => { c.moveTo(sway - k * 0.38, -k * 1.82); c.quadraticCurveTo(sway - k * 0.42, -k * 2.45, sway, -k * 2.62); c.quadraticCurveTo(sway + k * 0.5, -k * 2.4, sway + k * 0.38, -k * 1.82); c.quadraticCurveTo(sway, -k * 1.98, sway - k * 0.38, -k * 1.82); c.closePath(); }, '#c8352b', { sh: k * 0.04, lw: k * 0.03, dash: k * 0.09 });
  band(ctx, sway - k * 0.36, -k * 2.22, k * 0.72, k * 0.1, 0);
  ctx.fillStyle = '#1b0e0a'; for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sway + sg * k * 0.13, -k * 1.8, k * 0.04, k * (0.05 + 0.02 * (1 - m)), 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#5a1810'; ctx.beginPath(); ctx.ellipse(sway, -k * 1.62, k * 0.1, k * (0.03 + 0.09 * m), 0, 0, TAU); ctx.fill();
  // drum on the lap
  ctx.save(); ctx.translate(-k * 0.45, -k * 0.35); ctx.rotate(-0.15);
  appl(ctx, (c) => { c.moveTo(-k * 0.3, -k * 0.34); c.quadraticCurveTo(-k * 0.08, -k * 0.02, -k * 0.3, k * 0.34); c.lineTo(k * 0.3, k * 0.34); c.quadraticCurveTo(k * 0.08, -k * 0.02, k * 0.3, -k * 0.34); c.closePath(); }, '#a05a2a', { sh: k * 0.04, lw: k * 0.03, dash: k * 0.07 });
  ctx.fillStyle = '#f0d9a8'; ctx.beginPath(); ctx.ellipse(0, -k * 0.34, k * 0.3, k * 0.07, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, k * 0.34, k * 0.3, k * 0.07, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3a1608'; ctx.lineWidth = k * 0.02; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * k * 0.12, -k * 0.34); ctx.lineTo(i * k * 0.08, k * 0.34); ctx.stroke(); }
  if (beat > 0) { ctx.strokeStyle = `rgba(255,230,160,${beat})`; ctx.lineWidth = k * 0.03; ctx.beginPath(); ctx.arc(0, -k * 0.34, k * (0.4 + (1 - beat) * 0.4), 0, TAU); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}

function fire(ctx, x, y, k, t) {
  const f = (i) => 1 + 0.12 * Math.sin(t * 9 + i * 2);
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createRadialGradient(0, -k * 0.2, 0, 0, -k * 0.2, k * 2.4); g.addColorStop(0, 'rgba(255,170,60,0.35)'); g.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = g; ctx.fillRect(-k * 2.4, -k * 2.6, k * 4.8, k * 4.8);
  appl(ctx, ell(0, 0, k * 0.5, k * 0.14), '#3a2214', { sh: 0, stitch: '' });
  [['#e0481e', 0.42, 0.95], ['#f28a2b', 0.3, 0.7], ['#ffd25a', 0.16, 0.42]].forEach(([c, w, hh], i) => appl(ctx, (cc) => { cc.moveTo(-k * w, 0); cc.quadraticCurveTo(-k * w * 0.2, -k * hh * f(i) * 0.6, 0, -k * hh * f(i)); cc.quadraticCurveTo(k * w * 0.4, -k * hh * 0.5, k * w, 0); cc.closePath(); }, c, { sh: 0, stitch: '', lw: 1 }));
  ctx.restore();
}

// ---- cast: the props and animals of the tales. s = 0 before the trick, 1 once it is solved. ------------------------------------------------
const CAST = {
  python(ctx, x, y, k, t, s) {
    const len = k * 2.6, th = k * 0.2;
    if (s) { ctx.save(); appl(ctx, (c) => { c.rect(x - len * 0.55, y - k * 0.08, len * 1.1, k * 0.1); }, '#6b4a2a', { sh: 2, stitch: '' }); ctx.restore(); }
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pts = []; for (let i = 0; i <= 28; i++) { const u = i / 28; pts.push([x - len / 2 + u * len, y - th * 0.6 + (s ? 0 : Math.sin(u * 9 - t * 3) * k * 0.28 * (0.4 + u * 0.6)) ]); }
    const stroke = (w, c, dash) => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.lineWidth = w; ctx.strokeStyle = c; ctx.setLineDash(dash ?? []); ctx.stroke(); ctx.setLineDash([]); };
    ctx.save(); ctx.translate(2, 4); stroke(th * 1.2, 'rgba(10,4,22,0.3)'); ctx.restore();
    stroke(th * 1.2, '#2b6a3a'); stroke(th * 0.75, '#4a9a52'); stroke(th * 0.3, '#e8c24a', [k * 0.06, k * 0.14]);
    const hd = pts[pts.length - 1]; appl(ctx, ell(hd[0] + k * 0.12, hd[1], k * 0.22, k * 0.14), '#4a9a52', { sh: 2, lw: 1.5, stitch: '' });
    ctx.fillStyle = '#fff8e0'; ctx.beginPath(); ctx.arc(hd[0] + k * 0.16, hd[1] - k * 0.04, k * 0.04, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hd[0] + k * 0.17, hd[1] - k * 0.04, k * 0.02, 0, TAU); ctx.fill();
    if (Math.sin(t * 5) > 0.4) { ctx.strokeStyle = '#d83b3b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hd[0] + k * 0.32, hd[1]); ctx.lineTo(hd[0] + k * 0.46, hd[1]); ctx.stroke(); }
    if (s) { ctx.strokeStyle = '#c8a45a'; ctx.lineWidth = k * 0.05; for (let i = 1; i < 5; i++) { const px = x - len / 2 + (i / 5) * len; ctx.beginPath(); ctx.moveTo(px, y - th * 1.3); ctx.lineTo(px, y + th * 0.3); ctx.stroke(); } }
    ctx.restore();
  },
  leopard(ctx, x, y, k, t, s) {
    if (s) { appl(ctx, ell(x, y + k * 0.05, k * 0.85, k * 0.22), '#1a0f0a', { sh: 0, stitch: '' }); appl(ctx, ell(x, y - k * 0.05, k * 0.3, k * 0.3), '#e1a247', { sh: 2, stitch: '' }); ctx.fillStyle = '#fff'; for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sg * k * 0.1, y - k * 0.1, k * 0.045, 0, TAU); ctx.fill(); } ctx.fillStyle = '#111'; for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sg * k * 0.1, y - k * 0.1, k * 0.02, 0, TAU); ctx.fill(); } return; }
    appl(ctx, ell(x, y - k * 0.45, k * 0.75, k * 0.38), '#e1a247', { sh: 3, lw: 1.6, dash: 6 });
    ctx.fillStyle = 'rgba(70,32,10,0.8)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(x + (i % 4 - 1.5) * k * 0.26, y - k * (0.5 + (i < 4 ? -0.12 : 0.1)), k * 0.06, 0, TAU); ctx.fill(); }
    for (const dx of [-0.5, -0.2, 0.25, 0.55]) appl(ctx, (c) => c.roundRect(x + dx * k - k * 0.06, y - k * 0.2, k * 0.12, k * 0.24, k * 0.04), '#d4903a', { sh: 2, stitch: '' });
    appl(ctx, ell(x + k * 0.82, y - k * 0.6, k * 0.3, k * 0.27), '#e1a247', { sh: 3, dash: 5 });
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + k * 0.9, y - k * 0.64, k * 0.035, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - k * 0.72, y - k * 0.55); ctx.quadraticCurveTo(x - k * 1.2, y - k * (0.9 + 0.1 * Math.sin(t * 3)), x - k * 1.05, y - k * 0.2); ctx.lineWidth = k * 0.1; ctx.lineCap = 'round'; ctx.strokeStyle = '#e1a247'; ctx.stroke();
    if (!s) { /* open pit in front */ appl(ctx, ell(x + k * 1.55, y + k * 0.02, k * 0.55, k * 0.12), 'rgba(40,20,10,0.55)', { sh: 0, stitch: '', lw: 1 }); }
  },
  hornets(ctx, x, y, k, t, s) {
    appl(ctx, (c) => { c.moveTo(x, y - k * 1.25); c.lineTo(x, y - k * 0.95); }, 'rgba(0,0,0,0)', { sh: 0, stitch: '' });
    ctx.strokeStyle = '#4a3320'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - k * 0.5, y - k * 1.7); ctx.lineTo(x - k * 0.5, y - k * 1.25); ctx.stroke();
    appl(ctx, ell(x - k * 0.5, y - k * 0.95, k * 0.34, k * 0.42), '#c9a45a', { sh: 3, dash: 5 });
    ctx.strokeStyle = 'rgba(80,50,20,0.5)'; ctx.lineWidth = 1.5; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x - k * 0.5, y - k * 0.95, k * (0.1 + i * 0.08), 0.2, 3.0); ctx.stroke(); }
    // gourd on the ground
    appl(ctx, ell(x + k * 0.55, y - k * 0.2, k * 0.35, k * 0.32), '#8fb04a', { sh: 3, dash: 5 }); appl(ctx, ell(x + k * 0.55, y - k * 0.62, k * 0.17, k * 0.2), '#8fb04a', { sh: 3, dash: 5 });
    const n = s ? 3 : 7;
    for (let i = 0; i < n; i++) {
      const a = t * (2 + i * 0.3) + i * 1.7, r = s ? lerp(k * 0.5, 0.05, (Math.sin(t + i) + 1) / 2) : k * (0.5 + 0.18 * (i % 3)), bx = (s ? x + k * 0.55 : x - k * 0.5) + Math.cos(a) * r * 1.2, by = (s ? y - k * 0.62 : y - k * 0.95) + Math.sin(a * 1.3) * r * 0.7;
      appl(ctx, ell(bx, by, k * 0.075, k * 0.055), '#f2c14e', { sh: 1, stitch: '', lw: 1 });
      ctx.fillStyle = '#111'; ctx.fillRect(bx - k * 0.025, by - k * 0.05, k * 0.025, k * 0.1);
      ctx.fillStyle = 'rgba(220,240,255,0.75)'; ctx.beginPath(); ctx.ellipse(bx, by - k * 0.07, k * 0.05, k * 0.03, Math.sin(t * 40 + i) * 0.5, 0, TAU); ctx.fill();
    }
  },
  doll(ctx, x, y, k, t, s) {
    appl(ctx, (c) => c.roundRect(x - k * 0.2, y - k * 0.95, k * 0.4, k * 0.95, k * 0.1), '#b87a3a', { sh: 3, dash: 5 });
    appl(ctx, ell(x, y - k * 1.15, k * 0.26, k * 0.28), '#b87a3a', { sh: 3, dash: 5 });
    ctx.fillStyle = 'rgba(240,230,150,0.85)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(x + Math.cos(i * 2.3) * k * 0.15, y - k * (0.15 + (i % 5) * 0.17), k * 0.04, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#111'; for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sg * k * 0.09, y - k * 1.18, k * 0.03, 0, TAU); ctx.fill(); }
    appl(ctx, ell(x + k * 0.55, y - k * 0.12, k * 0.3, k * 0.1), '#5a3a1e', { sh: 2, stitch: '' });   // the bowl
    appl(ctx, ell(x + k * 0.55, y - k * 0.2, k * 0.24, k * 0.06), '#f2c14e', { sh: 0, stitch: '', lw: 1 });
    const fx = x + k * (s ? 0.28 : 1.2), fy = y - k * (s ? 0.8 : 0.5) + Math.sin(t * 4) * k * 0.05;
    appl(ctx, ell(fx, fy, k * 0.1, k * 0.14), '#6aa7d8', { sh: 2, stitch: '' }); appl(ctx, ell(fx, fy - k * 0.2, k * 0.09, k * 0.09), SKIN[2], { sh: 1, stitch: '' });
    for (const sg of [-1, 1]) { ctx.fillStyle = 'rgba(200,230,255,0.7)'; ctx.beginPath(); ctx.ellipse(fx + sg * k * 0.14, fy - k * 0.08, k * 0.1, k * 0.05, sg * 0.6 + Math.sin(t * 30) * 0.2, 0, TAU); ctx.fill(); }
  },
  pot(ctx, x, y, k, t, s) {
    if (s) {
      for (const sg of [-1, 1]) appl(ctx, (c) => { c.moveTo(x + sg * k * 0.1, y); c.quadraticCurveTo(x + sg * k * 0.65, y - k * 0.1, x + sg * k * 0.55, y - k * 0.45); c.quadraticCurveTo(x + sg * k * 0.35, y - k * 0.5, x + sg * k * 0.12, y - k * 0.2); c.closePath(); }, '#b5532e', { sh: 3, dash: 5 });
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + t * 0.5, r = k * (0.5 + 0.35 * ((i * 7) % 3) / 2 + 0.1 * Math.sin(t * 2 + i)); ctx.fillStyle = `rgba(255,230,140,${0.55 + 0.25 * Math.sin(t * 3 + i)})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y - k * 0.5 + Math.sin(a) * r * 0.6, k * 0.04, 0, TAU); ctx.fill(); }
      return;
    }
    appl(ctx, (c) => { c.moveTo(x - k * 0.2, y - k * 0.95); c.quadraticCurveTo(x - k * 0.75, y - k * 0.7, x - k * 0.55, y - k * 0.2); c.quadraticCurveTo(x - k * 0.4, y, x, y); c.quadraticCurveTo(x + k * 0.4, y, x + k * 0.55, y - k * 0.2); c.quadraticCurveTo(x + k * 0.75, y - k * 0.7, x + k * 0.2, y - k * 0.95); c.closePath(); }, '#b5532e', { sh: 3, dash: 6 });
    band(ctx, x - k * 0.45, y - k * 0.58, k * 0.9, k * 0.12, 2);
    appl(ctx, ell(x, y - k * 0.97, k * 0.26, k * 0.07), '#8c3c1e', { sh: 1, stitch: '' });
    ctx.fillStyle = `rgba(255,230,140,${0.35 + 0.2 * Math.sin(t * 3)})`; ctx.beginPath(); ctx.arc(x, y - k * 1.1, k * 0.06, 0, TAU); ctx.fill();
  },
  tree(ctx, x, y, k, t, s) {
    appl(ctx, (c) => { c.moveTo(x - k * 0.3, y); c.quadraticCurveTo(x - k * 0.2, y - k * 1.3, x - k * 0.14, y - k * 2.6); c.lineTo(x + k * 0.14, y - k * 2.6); c.quadraticCurveTo(x + k * 0.2, y - k * 1.3, x + k * 0.3, y); c.closePath(); }, '#6b4426', { sh: 3, dash: 6 });
    [[-0.7, -2.7, 0.7], [0, -3.1, 0.85], [0.75, -2.7, 0.68]].forEach(([dx, dy, r], i) => appl(ctx, ell(x + dx * k + Math.sin(t * 0.8 + i) * k * 0.03, y + dy * k, r * k, r * k * 0.62), i === 1 ? '#3f8a4a' : '#2f7340', { sh: 3, dash: 7 }));
  },
  huts(ctx, x, y, k, t, s, w) {
    const hut = (hx, hy, c) => { appl(ctx, (cc) => cc.roundRect(hx - k * 0.42, hy - k * 0.52, k * 0.84, k * 0.52, k * 0.04), c, { sh: 3, dash: 5 }); appl(ctx, (cc) => { cc.moveTo(hx - k * 0.58, hy - k * 0.48); cc.lineTo(hx, hy - k * 1.05); cc.lineTo(hx + k * 0.58, hy - k * 0.48); cc.closePath(); }, '#c9a45a', { sh: 3, dash: 6 }); appl(ctx, (cc) => cc.roundRect(hx - k * 0.1, hy - k * 0.3, k * 0.2, k * 0.3, k * 0.05), '#3a1e10', { sh: 0, stitch: '' }); };
    const sx = k * (w ?? 2.6);
    hut(x - sx, y - k * 0.1, '#c8603a'); hut(x - sx + k * 0.9, y + k * 0.05, '#b5532e'); hut(x + sx, y - k * 0.1, '#2f9d62'); hut(x + sx - k * 0.9, y + k * 0.05, '#27824f');
    ctx.fillStyle = 'rgba(255,220,150,0.5)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x - sx + k * 0.1 * i + Math.sin(t + i) * 4, y - k * (1.3 + i * 0.18), k * 0.04, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x + sx - k * 0.1 * i + Math.sin(t + i) * 4, y - k * (1.3 + i * 0.18), k * 0.04, 0, TAU); ctx.fill(); }
  },
  rope(ctx, x, y, k, t, s, w) {
    const sx = k * (w ?? 2.6), sag = s ? k * 0.02 : k * 0.22 + Math.sin(t * 1.5) * k * 0.02;
    ctx.beginPath(); ctx.moveTo(x - sx, y - k * 0.2); ctx.quadraticCurveTo(x, y - k * 0.2 + sag, x + sx, y - k * 0.2); ctx.lineWidth = k * 0.07; ctx.strokeStyle = '#e8d3a2'; ctx.stroke(); ctx.lineWidth = k * 0.02; ctx.setLineDash([k * 0.07, k * 0.07]); ctx.strokeStyle = '#8a6a3a'; ctx.stroke(); ctx.setLineDash([]);
  },
  rock(ctx, x, y, k, t, s) {
    appl(ctx, (c) => { c.moveTo(x - k * 0.95, y); c.quadraticCurveTo(x - k * 1.0, y - k * 0.9, x - k * 0.2, y - k * 1.0); c.quadraticCurveTo(x + k * 0.7, y - k * 1.1, x + k * 0.95, y - k * 0.2); c.quadraticCurveTo(x + k * 1.05, y, x + k * 0.5, y); c.closePath(); }, '#6e7270', { sh: 4, dash: 7 });
    ctx.save(); ctx.beginPath(); ctx.rect(x - k, y - k * 1.1, k * 2.1, k * 1.1); ctx.clip();
    for (let i = 0; i < 9; i++) { const mx = x + Math.cos(i * 1.9) * k * 0.7, my = y - k * (0.15 + (i * 0.37) % 0.8); appl(ctx, ell(mx, my, k * 0.22, k * 0.1, Math.sin(i) * 0.5), i % 2 ? '#4f8a3a' : '#6ea24a', { sh: 0, stitch: '', lw: 1 }); }
    ctx.restore();
  },
  tortoise(ctx, x, y, k, t, s) {
    const down = s ? 1 : 0;
    appl(ctx, ell(x, y - k * 0.28, k * 0.55, k * 0.35), '#5a7a3a', { sh: 3, dash: 6 });
    ctx.strokeStyle = 'rgba(20,40,10,0.6)'; ctx.lineWidth = 1.5; for (const dx of [-0.25, 0, 0.25]) { ctx.beginPath(); ctx.moveTo(x + dx * k, y - k * 0.58); ctx.lineTo(x + dx * k, y - k * 0.1); ctx.stroke(); }
    appl(ctx, ell(x + k * 0.58, y - k * (0.22 - down * 0.0), k * 0.18, k * 0.13), '#8a9a52', { sh: 2, stitch: '' });
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + k * 0.65, y - k * 0.25, k * 0.025, 0, TAU); ctx.fill();
    if (down) { ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + k * 0.6, y - k * 0.26); ctx.lineTo(x + k * 0.7, y - k * 0.24); ctx.stroke(); }
    for (const dx of [-0.35, 0.3]) appl(ctx, (c) => c.roundRect(x + dx * k - k * 0.08, y - k * 0.1, k * 0.16, k * 0.1, k * 0.03), '#8a9a52', { sh: 1, stitch: '' });
  },
  deer(ctx, x, y, k, t, s) {
    appl(ctx, ell(x, y - k * 0.7, k * 0.5, k * 0.28), '#c9873f', { sh: 3, dash: 6 });
    for (const dx of [-0.32, -0.15, 0.22, 0.38]) { ctx.beginPath(); ctx.moveTo(x + dx * k, y - k * 0.55); ctx.lineTo(x + dx * k + (dx > 0 ? 0.04 : -0.04) * k, y); ctx.lineWidth = k * 0.07; ctx.lineCap = 'round'; ctx.strokeStyle = '#a56a2a'; ctx.stroke(); }
    appl(ctx, (c) => { c.moveTo(x + k * 0.32, y - k * 0.78); c.lineTo(x + k * 0.55, y - k * 1.2); c.lineTo(x + k * 0.8, y - k * 1.1); c.lineTo(x + k * 0.78, y - k * 0.98); c.lineTo(x + k * 0.5, y - k * 0.7); c.closePath(); }, '#c9873f', { sh: 2, dash: 5 });
    appl(ctx, (c) => { c.moveTo(x + k * 0.5, y - k * 1.18); c.lineTo(x + k * 0.46, y - k * 1.45); c.lineTo(x + k * 0.62, y - k * 1.2); c.closePath(); }, '#a56a2a', { sh: 1, stitch: '' });
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + k * 0.64, y - k * 1.08, k * 0.03, 0, TAU); ctx.fill();
    if (Math.sin(t * 2) > 0.2 && !s) { ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + k * 0.6, y - k * 1.08); ctx.lineTo(x + k * 0.68, y - k * 1.08); ctx.stroke(); }
  },
  loom(ctx, x, y, k, t, s) {
    ctx.strokeStyle = '#5a3a1e'; ctx.lineCap = 'round'; ctx.lineWidth = k * 0.12;
    ctx.beginPath(); ctx.moveTo(x - k * 0.9, y); ctx.lineTo(x - k * 0.9, y - k * 1.6); ctx.moveTo(x + k * 0.9, y); ctx.lineTo(x + k * 0.9, y - k * 1.6); ctx.moveTo(x - k * 0.95, y - k * 1.6); ctx.lineTo(x + k * 0.95, y - k * 1.6); ctx.stroke();
    const f = clamp(s ? 1 : 0.62 + 0.05 * Math.sin(t), 0, 1);
    band(ctx, x - k * 0.8, y - k * 1.5, k * 1.6, k * 0.3 * f + k * 0.04, 0); ctx.save(); ctx.beginPath(); ctx.rect(x - k * 0.8, y - k * 1.5, k * 1.6, k * 1.4); ctx.clip();
    ctx.strokeStyle = 'rgba(240,225,190,0.85)'; ctx.lineWidth = 1.4; for (let i = 0; i < 17; i++) { ctx.beginPath(); ctx.moveTo(x - k * 0.8 + i * k * 0.1, y - k * 1.5); ctx.lineTo(x - k * 0.8 + i * k * 0.1, y - k * 0.2); ctx.stroke(); }
    for (let r = 0; r < 4; r++) { const yy = y - k * (1.2 - r * 0.2 + (0.62 - f) * 0.4); band(ctx, x - k * 0.8, yy, k * 1.6, k * 0.12, r * 2); }
    ctx.restore();
  },
  web(ctx, x, y, k, t, s) {
    ctx.strokeStyle = 'rgba(255,248,230,0.75)'; ctx.lineWidth = Math.max(1.5, k * 0.025);
    const cx = x, cy = y - k * 1.25, R = k * 1.0, sp = 12;
    ctx.beginPath(); for (let i = 0; i < sp; i++) { const a = (i / sp) * TAU; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } ctx.stroke();
    const rings = s ? 6 : 4; for (let r = 1; r <= rings; r++) { ctx.beginPath(); for (let i = 0; i <= sp; i++) { const a = (i / sp) * TAU, rr2 = (R * r) / rings * (1 + 0.04 * Math.sin(t * 2 + i + r)); ctx.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(cx + Math.cos(i * 1.7 + t * 0.2) * R * 0.6, cy + Math.sin(i * 1.3) * R * 0.6, 2, 0, TAU); ctx.fill(); }
  },
};

// ---- the story window: layered scenes ---------------------------------------------------------------------------------------------------------
const SCENES = {
  sky: { top: '#2b2060', mid: '#c4542f', hor: '#ffb04a', far: '#3a2a6e', near: '#6a3a6e', ground: '#a8582c', sun: [0.78, 0.36, '#ffd36a'], trees: 'palm' },
  pot: { top: '#f0a85a', mid: '#f8d68a', hor: '#fff0c4', far: '#c9803a', near: '#a85a2a', ground: '#8a4a24', sun: [0.2, 0.3, '#fff2c0'], trees: 'baobab' },
  feast: { top: '#1d5a6a', mid: '#e08a5a', hor: '#ffc27a', far: '#2f6a5a', near: '#3f8a4a', ground: '#7a8a3a', sun: [0.5, 0.45, '#ffe19a'], trees: 'palm' },
  rock: { top: '#10243a', mid: '#1e4a4a', hor: '#3a7a5a', far: '#173a3a', near: '#1f5a3a', ground: '#2a5a30', sun: [0.2, 0.22, '#e9f1d8'], trees: 'baobab' },
  loom: { top: '#e66a7a', mid: '#f7b07a', hor: '#ffe0a0', far: '#b0526a', near: '#8a6a3a', ground: '#a5683a', sun: [0.76, 0.4, '#fff0b8'], trees: 'palm' },
};
function hills(ctx, r, y0, amp, col, ph, par) {
  ctx.beginPath(); ctx.moveTo(r.x - 40, r.y + r.h + 10);
  for (let i = 0; i <= 24; i++) { const u = i / 24; ctx.lineTo(r.x - 40 + u * (r.w + 80), y0 + Math.sin(u * 5.2 + ph) * amp + Math.sin(u * 11 + ph * 2) * amp * 0.35 - par * 0); }
  ctx.lineTo(r.x + r.w + 40, r.y + r.h + 10); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}
function palm(ctx, x, y, h, t, col) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + h * 0.1, y - h * 0.5, x + h * 0.04, y - h); ctx.lineWidth = h * 0.06; ctx.strokeStyle = '#4a2c1c'; ctx.lineCap = 'round'; ctx.stroke();
  for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.95 + i * (Math.PI * 0.9 / 6), L = h * 0.42, wob = Math.sin(t + i) * 0.05; ctx.beginPath(); ctx.moveTo(x + h * 0.04, y - h); ctx.quadraticCurveTo(x + h * 0.04 + Math.cos(a + wob) * L * 0.6, y - h + Math.sin(a + wob) * L * 0.6 - L * 0.25, x + h * 0.04 + Math.cos(a + wob) * L, y - h + Math.sin(a + wob) * L + L * 0.15); ctx.lineWidth = h * 0.05; ctx.strokeStyle = col; ctx.stroke(); }
}
function baobab(ctx, x, y, h, t, col) {
  appl(ctx, (c) => { c.moveTo(x - h * 0.16, y); c.quadraticCurveTo(x - h * 0.1, y - h * 0.5, x - h * 0.2, y - h * 0.82); c.lineTo(x + h * 0.2, y - h * 0.82); c.quadraticCurveTo(x + h * 0.1, y - h * 0.5, x + h * 0.16, y); c.closePath(); }, '#5a3a24', { sh: 0, stitch: '', lw: 1 });
  for (let i = 0; i < 6; i++) { const a = -Math.PI + (i / 5) * Math.PI; appl(ctx, ell(x + Math.cos(a) * h * 0.3 + Math.sin(t * 0.7 + i) * h * 0.01, y - h * 0.9 + Math.sin(a) * h * 0.14, h * 0.2, h * 0.12), col, { sh: 0, stitch: '', lw: 1 }); }
}
function skyGrad(ctx, r, S) { const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.75); g.addColorStop(0, S.top); g.addColorStop(0.55, S.mid); g.addColorStop(1, S.hor); ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h); }

// drawVision(ctx, rect, scene, cast, t, o) paints the story window. o: { solved, pose, look, px (pointer parallax -1..1), hop, w: separation for huts }
export function drawVision(ctx, r, sceneId, cast, t, o = {}) {
  const S = SCENES[sceneId] ?? SCENES.sky, px = (o.px ?? 0) + Math.sin(t * 0.22) * 0.5, k = Math.min(r.w * 0.2, r.h * 0.34);
  ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.clip();
  skyGrad(ctx, r, S);
  // sun or moon with rings
  const sx = r.x + r.w * S.sun[0] + px * 6, sy = r.y + r.h * S.sun[1], sr = Math.min(r.w, r.h) * 0.12;
  for (let i = 3; i >= 0; i--) { ctx.fillStyle = `rgba(255,240,200,${0.06 + (3 - i) * 0.04})`; ctx.beginPath(); ctx.arc(sx, sy, sr * (1 + i * 0.45), 0, TAU); ctx.fill(); }
  appl(ctx, ell(sx, sy, sr, sr), S.sun[2], { sh: 0, stitch: 'rgba(255,255,255,0.4)', lw: 1.2, dash: 6 });
  // clouds (cloth strips)
  for (let i = 0; i < 3; i++) { const cx = r.x + ((r.w * (0.2 + i * 0.35) + t * (6 + i * 3) + px * 14) % (r.w + 160)) - 80, cy = r.y + r.h * (0.14 + i * 0.07); appl(ctx, (c) => c.roundRect(cx - 50, cy - 9, 100, 18, 9), 'rgba(255,245,225,0.55)', { sh: 0, stitch: '', lw: 0.8, edge: 'rgba(255,255,255,0.3)' }); }
  const gy = r.y + r.h * 0.78;
  hills(ctx, r, r.y + r.h * 0.56 + px * 3, r.h * 0.05, S.far, 1, 0.2);
  if (S.trees === 'palm') { palm(ctx, r.x + r.w * 0.1 + px * 8, r.y + r.h * 0.66, r.h * 0.32, t, '#245a3a'); palm(ctx, r.x + r.w * 0.93 + px * 8, r.y + r.h * 0.68, r.h * 0.26, t + 2, '#245a3a'); } else baobab(ctx, r.x + r.w * 0.9 + px * 8, r.y + r.h * 0.7, r.h * 0.42, t, '#245a3a');
  hills(ctx, r, r.y + r.h * 0.66 + px * 6, r.h * 0.045, S.near, 3, 0.5);
  ctx.fillStyle = S.ground; ctx.fillRect(r.x, gy, r.w, r.h - (gy - r.y));
  const gg = ctx.createLinearGradient(0, gy, 0, r.y + r.h); gg.addColorStop(0, 'rgba(255,255,255,0.14)'); gg.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = gg; ctx.fillRect(r.x, gy, r.w, r.h - (gy - r.y));
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(r.x + r.w * 0.45, gy + r.h * 0.07, r.w * 0.5, r.h * 0.05, 0, 0, TAU); ctx.fill();
  // foreground: the cast, then Anansi
  const solved = !!o.solved, ax = r.x + r.w * (cast.includes('huts') ? 0.5 : cast.length > 1 ? 0.24 : 0.34) + px * 14, ay = gy + r.h * 0.04 - k * 0.0;
  const cx = r.x + r.w * 0.72 + px * 18;
  for (const c of cast) {
    const f = CAST[c]; if (!f) continue;
    if (c === 'huts') f(ctx, r.x + r.w * 0.5, gy - k * 0.1, k * 0.62, t, solved, 2.0 + (r.w / r.h > 1 ? 0.3 : 0));
    else if (c === 'rope') f(ctx, r.x + r.w * 0.5, gy + k * 0.1, k * 0.62, t, solved, 2.0 + (r.w / r.h > 1 ? 0.3 : 0));
    else if (c === 'tree') f(ctx, r.x + r.w * 0.78 + px * 10, gy + k * 0.1, k * 0.8, t, solved);
    else if (c === 'web' || c === 'loom') f(ctx, r.x + r.w * 0.72 + px * 14, gy + k * 0.05, k * (c === 'web' ? 0.9 : 0.85), t, solved);
    else if (c === 'pot') f(ctx, r.x + r.w * (cast.includes('tree') ? 0.58 : 0.7) + px * 16, gy + k * 0.05, k * 0.7, t, solved);
    else if ((c === 'tortoise' || c === 'deer') && cast.includes('rock')) f(ctx, r.x + r.w * 0.53 + px * 18, gy + k * 0.12, k * 0.7, t, solved);
    else if (c === 'rock') f(ctx, r.x + r.w * 0.76 + px * 18, gy + k * 0.05, k * 0.72, t, solved);
    else f(ctx, cx, gy + k * 0.05, k * 0.72, t, solved);
  }
  anansi(ctx, ax, ay - k * 0.25, k * 0.55, t, { pose: o.pose ?? 'idle', look: o.look ?? { x: 0.6, y: -0.1 }, flip: 1, hop: o.hop ?? 0 });
  weave(ctx, r, 0.05, 6);
  const vg = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.4, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,4,22,0.4)'); ctx.fillStyle = vg; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

// The framed scene used in play and on the title: story window above, storyteller and listeners below around a small fire.
export function drawStage(ctx, r, sceneId, cast, t, o = {}) {
  const tall = r.h / r.w > 1.25, frameH = r.h * (tall ? 0.66 : 0.62), V = { x: r.x + r.w * 0.035, y: r.y + r.h * 0.03, w: r.w * 0.93, h: frameH };
  // cloth ground behind the circle
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, o.bg0 ?? '#2b1b3d'); g.addColorStop(1, o.bg1 ?? '#140c22');
  ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 22); ctx.fillStyle = g; ctx.fill(); ctx.clip();
  weave(ctx, r, 0.05, 6);
  drawVision(ctx, V, sceneId, cast, t, o);
  // frame of woven bands round the window
  const bw = Math.max(6, r.w * 0.016);
  ctx.save(); ctx.lineWidth = bw; ctx.strokeStyle = '#1c1a33'; ctx.beginPath(); ctx.roundRect(V.x - bw / 2, V.y - bw / 2, V.w + bw, V.h + bw, 22); ctx.stroke(); ctx.lineWidth = bw * 0.35; ctx.strokeStyle = '#f2c14e'; ctx.setLineDash([bw * 0.9, bw * 0.55]); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  if (o.motif) { const mx = V.x + V.w / 2, my = V.y; appl(ctx, ell(mx, my, bw * 2.3, bw * 2.3), '#1c1a33', { sh: 2, stitch: '#f2c14e', lw: 1.2 }); pattern(ctx, o.motif, mx, my, bw * 3, '#f2c14e', Math.max(1.5, bw * 0.28)); }
  // circle: fire, storyteller, listeners
  const zone = r.h - (V.y + V.h - r.y), baseY = r.y + r.h - zone * 0.1, ks = Math.min(r.w * (tall ? 0.125 : 0.1), zone * 0.34, r.h * 0.14), cxm = r.x + r.w * 0.5, cheer = o.cheer ?? 0, beat = o.beat ?? 0;
  const L = [[-0.30, '#c8352b', '#f2c14e', 0, 0.3], [-0.18, '#2f9d62', '#e9893a', 1, 1.1, true], [0.20, '#e9893a', '#1c1a33', 2, 2.0], [0.34, '#7a4ab8', '#f2c14e', 3, 2.8, true]];
  for (const [dx, robe, wrap, skin, ph, child] of L) listener(ctx, cxm + dx * r.w * 1.0 * 0.95 + (dx < 0 ? -r.w * 0.04 : r.w * 0.04), baseY - ks * 0.2, ks * 1.05, t, { robe, wrap, skin, phase: ph, cheer, child });
  fire(ctx, cxm + r.w * 0.13, baseY, ks * 0.7, t);
  storyteller(ctx, cxm - r.w * 0.06, baseY - ks * 0.05, ks * 1.15, t, { speak: o.speak ?? 0, beat });
  ctx.restore();
}

// A woven story-cloth panel for the Gallery and the result screen. locked = not yet told.
export function drawCloth(ctx, r, taleIdx, t, { locked = false, stars = 0, glow = 0 } = {}) {
  const tale = TALES[taleIdx], tint = tale.tint;
  ctx.save();
  appl(ctx, (c) => c.roundRect(r.x, r.y, r.w, r.h, 14), locked ? '#4a4258' : mixc(tint, '#2a1a30', 0.55), { sh: 5, lw: 2, dash: 7, stitch: 'rgba(255,240,210,0.4)' });
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.clip();
  weave(ctx, r, 0.07, 5);
  const bh = Math.max(10, r.h * 0.07);
  if (!locked) { band(ctx, r.x, r.y, r.w, bh, taleIdx); band(ctx, r.x, r.y + r.h - bh, r.w, bh, taleIdx + 2); } else { ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(r.x, r.y, r.w, bh); ctx.fillRect(r.x, r.y + r.h - bh, r.w, bh); }
  const W = { x: r.x + r.w * 0.08, y: r.y + bh * 1.8, w: r.w * 0.84, h: (r.h - bh * 3.6) * 0.8 };
  if (locked) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(W.x, W.y, W.w, W.h, 12); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(); ctx.setLineDash([8, 7]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,240,210,0.4)'; ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    pattern(ctx, tale.motif, W.x + W.w / 2, W.y + W.h / 2, Math.min(W.w, W.h) * 0.45, 'rgba(255,240,210,0.35)');
  } else {
    drawVision(ctx, W, tale.scene, tale.beats[0].cast.slice(0, 1), t, { solved: true, pose: 'cheer' });
    ctx.beginPath(); ctx.roundRect(W.x, W.y, W.w, W.h, 12); ctx.lineWidth = 3; ctx.strokeStyle = '#f2c14e'; ctx.stroke();
  }
  const my = W.y + W.h + (r.h - bh * 1.8 - (W.y - r.y) - W.h) * 0.45;
  for (let i = 0; i < 3; i++) pattern(ctx, i === 1 ? tale.motif : (tale.motif === 'akoma' ? 'duafe' : 'akoma'), r.x + r.w / 2 + (i - 1) * r.w * 0.22, my, Math.min(r.h * 0.1, r.w * 0.12), locked ? 'rgba(255,240,210,0.25)' : '#f2c14e');
  if (glow > 0) { ctx.fillStyle = `rgba(255,236,170,${0.25 * glow})`; ctx.fillRect(r.x, r.y, r.w, r.h); }
  ctx.restore();
  void stars; void DISPLAY; void UI;
}

// ---- figures for the Rules / How to Play / About pages (the game's own cards, buttons and art) -----------------------------------------------
export function drawFigure(ctx, r, kind, t, T) {
  const card = (x, y, w, h, label, o = {}) => {
    appl(ctx, (c) => c.roundRect(x, y, w, h, 12), o.fill ?? T.card, { sh: 2, lw: 1.5, dash: 5, stitch: 'rgba(120,70,30,0.25)', edge: o.edge ?? T.cardLine });
    ctx.fillStyle = o.ink ?? T.cardInk; ctx.font = `600 ${Math.min(h * 0.34, 22)}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    let s = label; while (s.length > 3 && ctx.measureText(s).width > w - 28) s = s.slice(0, -2); if (s !== label) s += '…';
    ctx.fillText(s, x + 14, y + h / 2);
    if (o.badge) { ctx.fillStyle = o.badgeBg ?? '#2f9d62'; ctx.beginPath(); ctx.arc(x + w - 20, y + h / 2, 12, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `700 14px ${UI}`; ctx.fillText(o.badge, x + w - 20, y + h / 2 + 1); }
  };
  ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.clip();
  ctx.fillStyle = T.panel; ctx.fillRect(r.x, r.y, r.w, r.h);
  const pad = 16, w = r.w - 2 * pad, ch = clamp((r.h - 2 * pad) / 5, 40, 56), nCards = { order: 3, match: 3, choose: 3, trap: 4.2, learn: 2.6, hint: 2.6 }[kind], oy = nCards ? Math.max(0, (r.h - 2 * pad - nCards * (ch + 8)) / 2) : 0;
  r = { x: r.x, y: r.y + oy, w: r.w, h: r.h - oy };
  if (kind === 'hero' || kind === 'beats') drawStage(ctx, r, 'sky', ['python'], t, { speak: 0.7, motif: 'sankofa', bg0: T.bg0, bg1: T.bg1, look: { x: 0.6, y: 0 } });
  else if (kind === 'patterns') {
    const ids = ['akoma', 'sankofa', 'dwennimmen', 'nkyinkyim', 'duafe'], cw = (w - 8 * 4) / 5;
    ids.forEach((id, i) => { const x = r.x + pad + i * (cw + 8); appl(ctx, (c) => c.roundRect(x, r.y + pad, cw, r.h - 2 * pad, 12), T.card, { sh: 2, lw: 1.5, stitch: '', edge: T.cardLine }); pattern(ctx, id, x + cw / 2, r.y + r.h * 0.4, Math.min(cw * 0.7, r.h * 0.4), T.cardInk); ctx.fillStyle = T.cardInk; ctx.font = `700 ${Math.max(13, Math.min(22, cw * 0.19))}px ${UI}`; ctx.textAlign = 'center'; ctx.fillText(PATTERNS[id].name, x + cw / 2, r.y + r.h * 0.74); });
  } else if (kind === 'gallery') { const cw = (w - 20) / 3; for (let i = 0; i < 3; i++) drawCloth(ctx, { x: r.x + pad + i * (cw + 10), y: r.y + pad, w: cw, h: r.h - 2 * pad }, i, t, { locked: i === 2 }); }
  else if (kind === 'order') { ['Cut a long branch', 'Argue out loud', 'Python stretches out'].forEach((s, i) => card(r.x + pad, r.y + pad + i * (ch + 8), w, ch, s, { badge: i < 2 ? String(i + 1) : '', fill: i < 2 ? '#e9f6e6' : T.card })); }
  else if (kind === 'match') { const cw = (w - 40) / 2; [['Sticky gum', 'Holds on'], ['Bowl of yams', 'Draws her close'], ['Tall grass', 'Waits and ties']].forEach(([a, b], i) => { card(r.x + pad, r.y + pad + i * (ch + 8), cw, ch, a, { fill: i === 0 ? '#e9f6e6' : T.card }); card(r.x + pad + cw + 40, r.y + pad + i * (ch + 8), cw, ch, b, { fill: i === 0 ? '#e9f6e6' : T.card }); }); ctx.strokeStyle = '#2f9d62'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(r.x + pad + cw, r.y + pad + ch / 2); ctx.lineTo(r.x + pad + cw + 40, r.y + pad + ch / 2); ctx.stroke(); }
  else if (kind === 'choose') { ['Hit the nest and run', 'Make rain, offer the gourd', 'Hide under a leaf'].forEach((s, i) => card(r.x + pad, r.y + pad + i * (ch + 8), w, ch, s, { fill: i === 1 ? '#e9f6e6' : i === 0 ? '#f3d8d0' : T.card, badge: i === 1 ? '✓' : i === 0 ? '✗' : '', badgeBg: i === 0 ? '#c8352b' : '#2f9d62' })); }
  else if (kind === 'trap') { const labs = ['Pit dug', 'Pit hidden', 'Osebo lured']; const cw = (w - 16) / 3; labs.forEach((s, i) => card(r.x + pad + i * (cw + 8), r.y + pad, cw, ch * 0.9, s, { fill: i < 2 ? '#f6e3a8' : T.panel, ink: i < 2 ? '#3a2414' : T.dim })); ['Dig a deep pit', 'Cover it with leaves', 'Trail of yams'].forEach((s, i) => card(r.x + pad, r.y + pad + (i + 1.1) * (ch + 8), w, ch, s, { badge: i < 2 ? '✓' : '' })); }
  else if (kind === 'stars') { [0, 1, 2].forEach((i) => { ctx.fillStyle = i < 2 ? '#ffc93c' : 'rgba(128,128,128,0.4)'; ctx.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + (j * Math.PI) / 5, rad = j % 2 ? 14 : 34; ctx.lineTo(r.x + r.w / 2 + (i - 1) * 84 + Math.cos(a) * rad, r.y + r.h * 0.4 + Math.sin(a) * rad); } ctx.closePath(); ctx.fill(); }); ctx.fillStyle = T.text; ctx.font = `600 ${Math.min(24, r.w * 0.05)}px ${UI}`; ctx.textAlign = 'center'; ctx.fillText('Fewer wrong picks and hints, more stars', r.x + r.w / 2, r.y + r.h * 0.78); }
  else if (kind === 'learn' || kind === 'hint') { card(r.x + pad, r.y + pad, w, ch * 1.4, kind === 'learn' ? 'THINK   REVEAL   ACT' : 'A nudge in the storyteller\'s voice', { fill: T.card }); card(r.x + pad, r.y + pad + ch * 1.6, w, ch, kind === 'learn' ? 'Pause freezes the whole loop' : 'Then the right card glows', { fill: '#f6e3a8' }); }
  else drawStage(ctx, r, 'pot', ['pot'], t, { bg0: T.bg0, bg1: T.bg1 });
  ctx.restore();
}
