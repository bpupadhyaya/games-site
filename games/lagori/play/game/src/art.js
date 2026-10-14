// Lagori art. Court, stones and ball are painted ONCE into cached layers; the kids are drawn live with simple lit shapes.
// One warm late-afternoon light from the upper left. Every function draws in canonical court units (720 x 960).
import { COURT, TOWER, LINE_Y, stoneR } from './engine.js';

const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

export const STONE_COLORS = [
  ['#ffcf5a', '#f0a31b', '#a96a06'],   // saffron
  ['#ff7a5c', '#e2412f', '#8f1d12'],   // vermilion
  ['#ff6fa5', '#d6336c', '#7e1239'],   // rose
  ['#b682e8', '#8a46c4', '#4c1d79'],   // plum
  ['#6fb6ff', '#2b7fe0', '#124b94'],   // cobalt
  ['#5fe0c4', '#17b394', '#0a6a58'],   // teal
  ['#b7e26a', '#7fb52e', '#46701a'],   // lime
];
export const TEAM = {
  H: { shirt: ['#ffb02e', '#e88a00'], pants: '#3a3f8f', hair: '#2a1a12', skin: '#d99a6c' },
  C: { shirt: ['#2fd0c2', '#0f9a90'], pants: '#2a2a3a', hair: '#1b1b1b', skin: '#c58a5c' },
};

const mk = (w, h, scale, fn) => {
  try {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const c = new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale)), g = c.getContext('2d'); g.scale(scale, scale); fn(g); return c;
  } catch { return null; }
};
const cache = new Map();
// A cached layer: draw(ctx, x, y, s, alpha) puts its top-left at (x, y). Without OffscreenCanvas it paints directly.
function layer(key, w, h, scale, paint) {
  let e = cache.get(key);
  if (!e) { e = { c: mk(w, h, scale, paint), w, h, paint }; cache.set(key, e); }
  return (ctx, x, y, s = 1, alpha = 1) => {
    if (alpha !== 1) { ctx.save(); ctx.globalAlpha *= alpha; }
    if (e.c) ctx.drawImage(e.c, x, y, e.w * s, e.h * s);
    else { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); e.paint(ctx); ctx.restore(); }
    if (alpha !== 1) ctx.restore();
  };
}

// --- ground tile: swept dirt with fine dust and a few pebbles, tiled across the whole screen (the court is the lighter rectangle on top) ----
function paintTile(g) {
  const r = lcg(5);
  g.fillStyle = '#cf8c5c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 520; i++) { const dark = r() > 0.5; g.fillStyle = dark ? `rgba(100,46,20,${0.04 + r() * 0.07})` : `rgba(255,224,184,${0.05 + r() * 0.08})`; g.beginPath(); g.ellipse(r() * 256, r() * 256, 0.8 + r() * 5, 0.6 + r() * 2.4, r() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(110,52,24,${0.05 + r() * 0.07})`; g.lineWidth = 1 + r() * 1.5; g.beginPath(); const y = r() * 256, x = r() * 256; g.moveTo(x, y); g.bezierCurveTo(x + 30, y - 6 + r() * 12, x + 60, y + r() * 10 - 5, x + 90 + r() * 40, y + r() * 8 - 4); g.stroke(); }
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(70,32,14,${0.2 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * 256, r() * 256, 1 + r() * 2, 0.8 + r() * 1.4, 0, 0, TAU); g.fill(); }
}
const tile = layer('tile', 256, 256, 1, paintTile);

let tilePattern = null, tileCtx = null;
export function drawBackdrop(ctx, W, H, tint = 0) {
  // The pattern is rebuilt per context (a 2d context owns its patterns); cheap.
  if (tileCtx !== ctx) {
    tilePattern = null; tileCtx = ctx;
    const e = cache.get('tile');
    if (e && e.c && ctx.createPattern) tilePattern = ctx.createPattern(e.c, 'repeat');
  }
  if (tilePattern) { ctx.fillStyle = tilePattern; ctx.fillRect(0, 0, W, H); }
  else { ctx.fillStyle = '#c8774a'; ctx.fillRect(0, 0, W, H); }
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(255,200,120,0.12)'); vg.addColorStop(1, `rgba(40,12,4,${0.55 + tint})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// --- the court ----------------------------------------------------------------------------------------------
function paintCourt(g) {
  const r = lcg(31), W = COURT.w, H = COURT.h;
  // swept dirt court, a lighter rectangle with soft edges
  let gr = g.createLinearGradient(0, 100, 0, H); gr.addColorStop(0, '#e6a678'); gr.addColorStop(0.5, '#efb98c'); gr.addColorStop(1, '#dc9a6c');
  g.save(); g.shadowColor = 'rgba(60,20,6,0.5)'; g.shadowBlur = 26; g.fillStyle = gr; g.beginPath(); g.roundRect(24, 104, W - 48, H - 128, 34); g.fill(); g.restore();
  g.save(); g.beginPath(); g.roundRect(24, 104, W - 48, H - 128, 34); g.clip();
  for (let i = 0; i < 900; i++) { const dark = r() > 0.55; g.fillStyle = dark ? `rgba(110,52,24,${0.03 + r() * 0.06})` : `rgba(255,236,200,${0.04 + r() * 0.08})`; g.beginPath(); g.ellipse(r() * W, 100 + r() * H, 1 + r() * 7, 0.7 + r() * 3, r() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(120,60,28,${0.05 + r() * 0.07})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const y = 130 + r() * 780, x = 40 + r() * 600; g.moveTo(x, y); g.bezierCurveTo(x + 60, y - 14 + r() * 28, x + 120, y + r() * 20 - 10, x + 160 + r() * 80, y + r() * 12 - 6); g.stroke(); }
  g.restore();
  // chalk
  const chalk = (a) => `rgba(255,252,240,${a})`;
  g.lineCap = 'round';
  g.strokeStyle = chalk(0.82); g.lineWidth = 5; g.beginPath(); g.roundRect(44, 124, W - 88, H - 168, 22); g.stroke();
  g.strokeStyle = chalk(0.95); g.lineWidth = 7; g.beginPath(); g.moveTo(60, LINE_Y + 8); g.lineTo(W - 60, LINE_Y + 8); g.stroke();
  // dashes beside the line (the runners' start)
  g.strokeStyle = chalk(0.6); g.lineWidth = 3; for (let x = 76; x < W - 70; x += 38) { g.beginPath(); g.moveTo(x, LINE_Y + 34); g.lineTo(x + 20, LINE_Y + 34); g.stroke(); }
  // the tower circle
  g.fillStyle = 'rgba(120,56,24,0.16)'; g.beginPath(); g.ellipse(TOWER.x, TOWER.y + 4, 72, 46, 0, 0, TAU); g.fill();
  g.strokeStyle = chalk(0.9); g.lineWidth = 5; g.beginPath(); g.ellipse(TOWER.x, TOWER.y + 4, 72, 46, 0, 0, TAU); g.stroke();
  g.strokeStyle = chalk(0.5); g.lineWidth = 3; g.setLineDash([2, 12]); g.beginPath(); g.ellipse(TOWER.x, TOWER.y + 4, 130, 84, 0, 0, TAU); g.stroke(); g.setLineDash([]);
  // the wall at the far end
  const wall = g.createLinearGradient(0, 0, 0, 112); wall.addColorStop(0, '#ffd9a0'); wall.addColorStop(1, '#f0a867');
  g.fillStyle = wall; g.fillRect(0, 0, W, 112);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 106, W, 6);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(150,70,30,${0.04 + r() * 0.05})`; g.fillRect(r() * W, r() * 106, 10 + r() * 40, 2 + r() * 4); }
  // arched doorway and two windows
  const arch = (x, w, h, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x - w / 2, 112); g.lineTo(x - w / 2, 112 - h + w / 2); g.arc(x, 112 - h + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w / 2, 112); g.closePath(); g.fill(); };
  arch(180, 70, 86, '#7a2e22'); arch(180, 54, 70, '#3b1a18');
  arch(540, 70, 86, '#1f6f7a'); arch(540, 54, 70, '#12353b');
  for (const x of [360]) { g.fillStyle = '#6a3a2a'; g.fillRect(x - 28, 26, 56, 40); g.fillStyle = '#ffe9a8'; g.fillRect(x - 24, 30, 48, 32); g.fillStyle = 'rgba(80,40,20,0.8)'; g.fillRect(x - 1.5, 30, 3, 32); g.fillRect(x - 24, 45, 48, 3); }
  // bunting
  const flags = ['#e2412f', '#f0a31b', '#2b7fe0', '#17b394', '#d6336c', '#8a46c4'];
  g.strokeStyle = 'rgba(60,30,10,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 20); g.quadraticCurveTo(W / 2, 92, W, 20); g.stroke();
  for (let i = 1; i < 18; i++) { const t = i / 18, x = W * t, y = 20 + 2 * 72 * 0.5 * (1 - Math.pow(2 * t - 1, 2)) * 0.98 + 0; g.fillStyle = flags[i % flags.length]; g.beginPath(); g.moveTo(x - 11, y - 1); g.lineTo(x + 11, y - 1); g.lineTo(x, y + 26); g.closePath(); g.fill(); }
  // side kerbs / shade
  const sh = g.createLinearGradient(0, 0, 60, 0); sh.addColorStop(0, 'rgba(40,12,4,0.45)'); sh.addColorStop(1, 'rgba(40,12,4,0)');
  g.fillStyle = sh; g.fillRect(0, 112, 60, H);
  const sh2 = g.createLinearGradient(W, 0, W - 60, 0); sh2.addColorStop(0, 'rgba(40,12,4,0.45)'); sh2.addColorStop(1, 'rgba(40,12,4,0)'); g.fillStyle = sh2; g.fillRect(W - 60, 112, 60, H);
}
const court = layer('court', COURT.w, COURT.h, 1.5, paintCourt);
export const drawCourt = (ctx) => court(ctx, 0, 0);

// A tall wall for the strip above the court on tall phones (just the same wall colour fading, drawn by the caller as a gradient).

// --- stones ---------------------------------------------------------------------------------------------------
const THICK = 12;
function paintStone(g, i) {
  const r = stoneR(i), [hi, mid, lo] = STONE_COLORS[i], cx = r + 6, cy = r * 0.5 + 6;
  // side
  g.fillStyle = lo; g.beginPath(); g.ellipse(cx, cy + THICK, r, r * 0.5, 0, 0, TAU); g.fill();
  const side = g.createLinearGradient(cx - r, 0, cx + r, 0); side.addColorStop(0, mid); side.addColorStop(0.5, hi); side.addColorStop(1, lo);
  g.fillStyle = side; g.fillRect(cx - r, cy, r * 2, THICK);
  g.beginPath(); g.ellipse(cx, cy + THICK, r, r * 0.5, 0, 0, Math.PI); g.fill();
  // top
  const top = g.createRadialGradient(cx - r * 0.35, cy - r * 0.2, 2, cx, cy, r * 1.05); top.addColorStop(0, hi); top.addColorStop(0.7, mid); top.addColorStop(1, lo);
  g.fillStyle = top; g.beginPath(); g.ellipse(cx, cy, r, r * 0.5, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(cx, cy, r - 1.5, r * 0.5 - 1, 0, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(cx, cy, r, r * 0.5, 0, 0, TAU); g.stroke();
  // painted band
  g.strokeStyle = 'rgba(255,248,225,0.7)'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(cx, cy, r * 0.6, r * 0.3, 0, 0, TAU); g.stroke();
}
const stoneLayers = [0, 1, 2, 3, 4, 5, 6].map((i) => layer('stone' + i, 2 * stoneR(i) + 12, stoneR(i) + THICK + 14, 2, (g) => paintStone(g, i)));
// A stone with its centre at (x, y) on the ground (the slab's centre of mass), `lift` raises it.
export function drawStone(ctx, i, x, y, lift = 0, rot = 0, alpha = 1, scale = 1) {
  const r = stoneR(i) * scale;
  if (lift < 40) { ctx.save(); ctx.globalAlpha *= 0.5 * alpha; ctx.fillStyle = '#4a1d0a'; ctx.beginPath(); ctx.ellipse(x + 3, y + 5, r * 1.05, r * 0.5, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  stoneLayers[i](ctx, x - (stoneR(i) + 6) * scale, y - lift - (stoneR(i) * 0.5 + 6) * scale - THICK * 0.5 * scale, scale, alpha);
  void rot;
}
export const STONE_THICK = THICK;

// --- ball ----------------------------------------------------------------------------------------------------
function paintBall(g) {
  const gr = g.createRadialGradient(10, 9, 1, 14, 14, 14); gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.35, '#ffe14a'); gr.addColorStop(1, '#c58a00');
  g.fillStyle = gr; g.beginPath(); g.arc(14, 14, 12, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.8; g.beginPath(); g.arc(14, 14, 8.5, -0.6, 1.4); g.stroke(); g.beginPath(); g.arc(14, 14, 8.5, 2.5, 4.5); g.stroke();
  g.strokeStyle = 'rgba(90,50,0,0.55)'; g.lineWidth = 1; g.beginPath(); g.arc(14, 14, 12, 0, TAU); g.stroke();
}
const ballLayer = layer('ball', 28, 28, 3, paintBall);
export function drawBall(ctx, x, y, z, s = 1) {
  ctx.save(); ctx.globalAlpha *= Math.max(0.2, 0.55 - z / 400); ctx.fillStyle = '#3a1406'; ctx.beginPath(); ctx.ellipse(x + 2, y + 4, 11 * s, 5 * s, 0, 0, TAU); ctx.fill(); ctx.restore();
  ballLayer(ctx, x - 14 * s, y - z - 14 * s, s);
}

// --- the kids ------------------------------------------------------------------------------------------------
// A jointed figure seen from the side: thigh / shin / upper arm / forearm each with its own angle (0 = hanging straight down, + =
// swinging toward the way the kid faces). The run cycle swings arm against leg, the knee folds on the recovery stride, the torso
// leans with speed and the whole figure is lowered so the planted foot stays on the ground.
// o: { team 'H'|'C', face -1|1, phase (run cycle), moving, speed, carry, dodge 0..1, dodgeDir, alpha, scale, throwAnim, pose 'ready'|'wind'|'sit', look (variety) }
const SKINS = ['#e3a877', '#c98c5d', '#a9724b', '#8a5a3a', '#efbb8c'];
const HAIRS = ['#1b1410', '#2a1a12', '#3a2416', '#120d0a'];
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), c = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`; };
export function drawKid(ctx, x, y, o) {
  const T = TEAM[o.team], sc = (o.scale ?? 1) * 0.98, face = (o.face ?? 1) >= 0 ? 1 : -1, ph = o.phase ?? 0, alpha = o.alpha ?? 1;
  const look = o.look ?? 0, skin = SKINS[look % SKINS.length], hair = HAIRS[(look * 3 + 1) % HAIRS.length];
  const run = o.moving ? Math.min(1.35, Math.max(0.45, (o.speed ?? 180) / 180)) : 0, pose = o.pose || '';
  const c = ph * 0.25 * TAU, breathe = Math.sin(ph * 2.2) * 0.5;
  const THIGH = 25, SHIN = 24, TORSO = 35, UA = 17, FA = 17;
  // joint angles
  const leg = [0, 1].map((i) => {
    const cc = c + i * Math.PI;
    if (pose === 'sit') return { th: 1.45 - i * 0.12, kn: 0.15 + i * 0.1 };
    if (run) { const sw = Math.sin(cc); return { th: 0.95 * run * sw + 0.08, kn: 0.2 + 1.05 * run * Math.max(0, Math.sin(cc + 1.25)) }; }
    if (pose === 'ready' || pose === 'wind') return { th: 0.5 + (i ? 0.18 : -0.1), kn: 0.95 + i * 0.1 };
    return { th: 0.06 * (i ? 1 : -1), kn: 0.08 };
  });
  let lean = run ? 0.16 + 0.2 * run : pose === 'ready' ? 0.45 : pose === 'wind' ? -0.18 : pose === 'sit' ? 0.05 : 0.04;
  if (o.dodge) lean += 0.12;
  const arm = [0, 1].map((i) => {
    const cc = c + (i ? 0 : Math.PI);                 // arms swing against the legs
    if (o.carry >= 0 && o.carry !== undefined) return { ua: 1.15, fa: 1.1 };
    if (o.throwAnim > 0 && i === 0) return { ua: 2.45 - (0.35 - Math.min(0.35, o.throwAnim)) * 7, fa: 2.0 };
    if (pose === 'wind') return i === 0 ? { ua: -2.2, fa: -2.9 } : { ua: 1.5, fa: 1.45 };
    if (pose === 'ready') return { ua: 0.55, fa: 0.8 };
    if (pose === 'sit') return { ua: 0.7 + i * 0.2, fa: 1.1 };
    if (o.dodge) return { ua: i ? 1.9 : -1.2, fa: i ? 1.7 : -1.0 };
    if (run) { const sw = Math.sin(cc); return { ua: 0.95 * run * sw, fa: 0.95 * run * sw + 0.75 + 0.7 * run }; }
    return { ua: 0.08 * (i ? 1 : -1) + breathe * 0.02, fa: 0.2 };
  });
  const pt = (x0, y0, a, l) => [x0 + Math.sin(a) * l, y0 + Math.cos(a) * l];
  // hip height so the lower foot rests on the ground
  const rel = leg.map((l) => { const k = pt(0, 0, l.th, THIGH), a = pt(k[0], k[1], l.th - l.kn, SHIN); return { k, a }; });
  let hipY = -Math.max(rel[0].a[1], rel[1].a[1]) - 1.5;
  if (pose === 'sit') hipY = -9;
  const bob = run ? Math.abs(Math.cos(c)) * -3.2 * run : 0;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y);
  // soft ground shadow (stretches with the stride)
  ctx.fillStyle = 'rgba(50,16,4,0.36)'; ctx.beginPath(); ctx.ellipse(2, 3, 22 + run * 4, 7, 0, 0, TAU); ctx.fill();
  if (o.dodge) ctx.rotate((o.dodgeDir ?? face) * 0.28);
  ctx.scale(face * sc, sc); ctx.translate(0, hipY + bob);
  const limb = (p0, p1, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); };
  const sh = [Math.sin(lean) * TORSO, -Math.cos(lean) * TORSO + breathe * 0.3];   // shoulder relative to the hip
  const far = 0.72;                                                                // the far side of the body is a little darker
  const drawLeg = (i, dark) => {
    const l = leg[i], k = pt(0, 0, l.th, THIGH), a = pt(k[0], k[1], l.th - l.kn, SHIN), f = dark ? far : 1;
    limb([0, 0], k, 10.5, shade(T.pants, f)); limb(k, a, 8, shade(skin, f * 0.97));
    // sock band and shoe, pointing the way the shin points
    limb(pt(a[0], a[1], l.th - l.kn, -6), a, 8.4, shade('#f4f0e6', f));
    ctx.fillStyle = shade('#f7f4ec', f); ctx.beginPath(); ctx.ellipse(a[0] + 4, a[1] + 1, 7.2, 3.6, -0.05, 0, TAU); ctx.fill();
    ctx.fillStyle = shade('#c8c0b0', f); ctx.fillRect(a[0] - 3, a[1] + 2.4, 13, 1.6);
  };
  const drawArm = (i, dark) => {
    const q = arm[i], e = pt(sh[0], sh[1], q.ua, UA), h = pt(e[0], e[1], q.fa, FA), f = dark ? far : 1;
    limb(sh, e, 7.5, shade(skin, f * 0.98)); limb(e, h, 6.4, shade(skin, f)); ctx.fillStyle = shade(skin, f * 0.95); ctx.beginPath(); ctx.arc(h[0], h[1], 3.7, 0, TAU); ctx.fill();
  };
  drawArm(1, true); drawLeg(1, true);
  // shorts and torso
  ctx.save(); ctx.rotate(0);
  ctx.fillStyle = shade(T.pants, 1); ctx.beginPath(); ctx.roundRect(-9.5, -4, 19, 16, 5); ctx.fill();
  ctx.translate(0, 0); ctx.rotate(lean);
  const g = ctx.createLinearGradient(-10, 0, 11, 0); g.addColorStop(0, shade(T.shirt[0], 0.78)); g.addColorStop(0.45, T.shirt[0]); g.addColorStop(1, T.shirt[1]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-9.5, -TORSO - 2, 19.5, TORSO + 4, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-9.5, -TORSO * 0.52, 19.5, 3.4);        // chest band
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(-9.5, -TORSO - 2, 19.5, TORSO + 4, 8); ctx.stroke();
  ctx.restore();
  // head on a short neck, hair, ear, eye toward the way the kid faces
  const nk = [sh[0] + Math.sin(lean * 0.6) * 5, sh[1] - Math.cos(lean * 0.6) * 5], hd = [nk[0] + Math.sin(lean * 0.4) * 8 + 1.5, nk[1] - 9];
  limb(sh, nk, 5.4, shade(skin, 0.95));
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hd[0], hd[1], 9.6, 0, TAU); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(hd[0] - 1, hd[1] - 1.6, 10.1, Math.PI * 0.92, TAU * 1.0 + 0.18); ctx.fill();
  ctx.fillStyle = shade(skin, 0.86); ctx.beginPath(); ctx.ellipse(hd[0] - 2.5, hd[1] + 1, 2, 3, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.arc(hd[0] + 4.6, hd[1] - 0.6, 1.3, 0, TAU); ctx.fill();
  drawLeg(0, false); drawArm(0, false);
  ctx.restore();
}
