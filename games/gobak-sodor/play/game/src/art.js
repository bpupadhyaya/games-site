// Gobak Sodor art. A sun-baked schoolyard seen from above: swept sand, white chalk lines, a woven home mat and a bamboo fence at
// the far end. The court is painted ONCE per size into a cached layer; the players are drawn live with simple lit shapes.
// One warm light from the upper left. Every function draws in canonical court units (720 wide, height from layout.courtDims).
import { CW, CELL, GX, PAD, courtDims, cellX, cellY } from './layout.js';
import { W, MID } from './engine.js';

const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

export const KIND_COLORS = {
  walker: { shirt: ['#6f7cff', '#3a3fb8'], sash: '#e8ecff', name: 'Walker' },
  shadow: { shirt: ['#ff6a5c', '#b3201a'], sash: '#fff1d6', name: 'Shadow' },
  sprinter: { shirt: ['#b47cff', '#6a2fc0'], sash: '#ffe27a', name: 'Sprinter' },
  sodor: { shirt: ['#2d2d38', '#0e0e16'], sash: '#ffffff', name: 'Sodor' },
};
export const RUNNER_COLORS = { shirt: ['#ffd24a', '#f09a00'], sash: '#fff8dc' };
const SKINS = ['#d99a6c', '#c58a5c', '#b47a4e', '#e3ad80'];

const mk = (w, h, scale, fn) => {
  try {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const c = new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale)), g = c.getContext('2d'); g.scale(scale, scale); fn(g); return c;
  } catch { return null; }
};
const cache = new Map();
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

// --- backdrop: deep palm green with a faint batik lattice, tiled across the whole screen -------------------------
function paintTile(g) {
  const r = lcg(9);
  g.fillStyle = '#0d2b24'; g.fillRect(0, 0, 200, 200);
  g.strokeStyle = 'rgba(120,230,190,0.07)'; g.lineWidth = 2;
  for (let y = 0; y < 200; y += 100) for (let x = 0; x < 200; x += 100) {
    g.beginPath(); g.moveTo(x + 50, y + 8); g.lineTo(x + 92, y + 50); g.lineTo(x + 50, y + 92); g.lineTo(x + 8, y + 50); g.closePath(); g.stroke();
    g.beginPath(); g.arc(x + 50, y + 50, 14, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,210,90,0.06)'; g.beginPath(); g.arc(x + 50, y + 50, 4, 0, TAU); g.fill();
  }
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${0.01 + r() * 0.025})`; g.beginPath(); g.arc(r() * 200, r() * 200, 0.6 + r() * 1.6, 0, TAU); g.fill(); }
}
const tile = layer('tile', 200, 200, 1, paintTile);
let tilePattern = null, tileCtx = null;
export function drawBackdrop(ctx, W_, H_, tint = 0) {
  if (tileCtx !== ctx) {
    tilePattern = null; tileCtx = ctx; tile(ctx, -9999, -9999, 1);
    const e = cache.get('tile');
    if (e && e.c && ctx.createPattern) tilePattern = ctx.createPattern(e.c, 'repeat');
  }
  ctx.fillStyle = tilePattern ?? '#0d2b24'; ctx.fillRect(0, 0, W_, H_);
  const vg = ctx.createRadialGradient(W_ / 2, H_ / 2, Math.min(W_, H_) * 0.25, W_ / 2, H_ / 2, Math.max(W_, H_) * 0.8);
  vg.addColorStop(0, 'rgba(70,200,150,0.10)'); vg.addColorStop(1, `rgba(2,12,10,${0.55 + tint})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W_, H_);
}

// --- the court -------------------------------------------------------------------------------------------------
function paintCourt(g, lines, pitch) {
  const D = courtDims(lines, pitch), H = D.ch, r = lcg(31 + lines), rows = D.rows, PH = pitch;
  const cy_ = (row) => cellY(row, lines, pitch);
  const x0 = GX - 16, x1 = GX + W * CELL + 16, y0 = PAD - 18, y1 = H - PAD + 18;
  // swept sand, a lighter rectangle with a soft shadow
  g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 30; g.shadowOffsetY = 8;
  const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#e9c47e'); gr.addColorStop(0.5, '#e2b86c'); gr.addColorStop(1, '#d6a85c');
  g.fillStyle = gr; g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, 26); g.fill(); g.restore();
  g.save(); g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, 26); g.clip();
  // lane bands: base lanes get a tint (home blue-green, end jade), other lanes a soft light band, so the rows read at a glance
  for (let row = 0; row < rows; row++) {
    const y = cy_(row) - PH / 2;
    if (row === 0) { g.fillStyle = 'rgba(60,140,175,0.34)'; g.fillRect(x0, y, x1 - x0, PH); }
    else if (row === rows - 1) { g.fillStyle = 'rgba(50,170,100,0.36)'; g.fillRect(x0, y, x1 - x0, PH); }
    else if (row % 2 === 0) { g.fillStyle = 'rgba(255,244,205,0.30)'; g.fillRect(x0, y, x1 - x0, PH); }
    else { g.fillStyle = 'rgba(110,60,10,0.16)'; g.fillRect(x0, y, x1 - x0, PH); }
  }
  // grit, footprints, rake marks
  for (let i = 0; i < 1100; i++) { const dark = r() > 0.5; g.fillStyle = dark ? `rgba(120,80,30,${0.03 + r() * 0.06})` : `rgba(255,250,225,${0.05 + r() * 0.09})`; g.beginPath(); g.ellipse(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 0.8 + r() * 5, 0.6 + r() * 2.4, r() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(140,90,40,${0.04 + r() * 0.06})`; g.lineWidth = 1 + r() * 1.6; const y = y0 + r() * (y1 - y0), x = x0 + r() * (x1 - x0 - 200); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 60, y - 6 + r() * 12, x + 120, y + r() * 10, x + 190, y - 4 + r() * 8); g.stroke(); }
  g.restore();
  // chalk: border, a thick line on every line row, dashed centre column (the sodor's line), faint lane ticks
  const chalk = (a) => `rgba(255,253,244,${a})`;
  g.lineCap = 'round';
  g.strokeStyle = chalk(0.9); g.lineWidth = 6; g.beginPath(); g.roundRect(GX - 4, cy_(rows - 1) - PH / 2, W * CELL + 8, rows * PH, 6); g.stroke();
  for (let k = 0; k < lines; k++) {
    const y = cy_(2 * k + 1);
    g.strokeStyle = 'rgba(80,50,10,0.25)'; g.lineWidth = 9; g.beginPath(); g.moveTo(GX, y + 2); g.lineTo(GX + W * CELL, y + 2); g.stroke();
    g.strokeStyle = chalk(0.96); g.lineWidth = 7; g.beginPath(); g.moveTo(GX, y); g.lineTo(GX + W * CELL, y); g.stroke();
  }
  const cx = cellX(MID);
  g.strokeStyle = chalk(0.7); g.lineWidth = 5; g.setLineDash([2, 16]);
  g.beginPath(); g.moveTo(cx, cy_(rows - 1) + PH * 0.1); g.lineTo(cx, cy_(0) - PH * 0.1); g.stroke(); g.setLineDash([]);
  // lane ticks: a small tick on each cell centre of the lane rows so cells read as a grid
  g.fillStyle = 'rgba(120,80,30,0.22)';
  for (let row = 0; row < rows; row += 2) for (let c = 0; c < W; c++) { g.beginPath(); g.arc(cellX(c), cy_(row), 3, 0, TAU); g.fill(); }
  // home mat (bottom): woven reeds
  const my = H - PAD + 18, mh = PAD - 18 - 4;
  g.save(); g.beginPath(); g.roundRect(GX - 6, my + 6, W * CELL + 12, mh - 12, 14); g.clip();
  g.fillStyle = '#7d4d28'; g.fillRect(0, my, CW, mh);
  for (let i = 0; i < 60; i++) { g.fillStyle = i % 2 ? '#a06a3a' : '#8c5a30'; g.fillRect(GX - 6 + i * 11, my, 6, mh); }
  for (let j = 0; j < 4; j++) { g.fillStyle = 'rgba(40,20,5,0.25)'; g.fillRect(GX - 6, my + j * 12 + 5, W * CELL + 12, 3); }
  g.restore();
  g.strokeStyle = 'rgba(255,230,160,0.75)'; g.lineWidth = 3; g.beginPath(); g.roundRect(GX - 6, my + 6, W * CELL + 12, mh - 12, 14); g.stroke();
  // far fence (top): bamboo posts with a jade rail and bunting
  const fy = PAD - 18, fh = 62;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(GX - 8, fy - fh + 6, W * CELL + 16, 10);
  for (let i = 0; i <= 14; i++) {
    const x = GX - 6 + i * ((W * CELL + 12) / 14), pg = g.createLinearGradient(x - 7, 0, x + 7, 0);
    pg.addColorStop(0, '#6d8a2c'); pg.addColorStop(0.45, '#c9de6a'); pg.addColorStop(1, '#5a7420');
    g.fillStyle = pg; g.beginPath(); g.roundRect(x - 7, fy - fh + 8, 14, fh - 6, 5); g.fill();
    g.fillStyle = 'rgba(40,60,10,0.55)'; g.fillRect(x - 7, fy - fh + 26, 14, 3); g.fillRect(x - 7, fy - fh + 44, 14, 3);
  }
  g.fillStyle = '#1b7a5a'; g.fillRect(GX - 8, fy - 26, W * CELL + 16, 9); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(GX - 8, fy - 26, W * CELL + 16, 2);
  const flags = ['#ffd24a', '#ff6a5c', '#38c9a8', '#6f7cff', '#ff9ec2'];
  for (let i = 0; i < 12; i++) { const x = GX + 20 + i * ((W * CELL - 40) / 11); g.fillStyle = flags[i % flags.length]; g.beginPath(); g.moveTo(x - 9, fy - 17); g.lineTo(x + 9, fy - 17); g.lineTo(x, fy + 1); g.closePath(); g.fill(); }
  // soft shade down the left and right so the court reads as a lit table
  const sh = g.createLinearGradient(x0, 0, x0 + 40, 0); sh.addColorStop(0, 'rgba(60,30,0,0.22)'); sh.addColorStop(1, 'rgba(60,30,0,0)');
  g.fillStyle = sh; g.fillRect(x0, y0, 40, y1 - y0);
  const sh2 = g.createLinearGradient(x1, 0, x1 - 40, 0); sh2.addColorStop(0, 'rgba(60,30,0,0.22)'); sh2.addColorStop(1, 'rgba(60,30,0,0)');
  g.fillStyle = sh2; g.fillRect(x1 - 40, y0, 40, y1 - y0);
}
const courtLayers = new Map();
export function drawCourt(ctx, lines, pitch = CELL) {
  const key = lines + ':' + pitch, D = courtDims(lines, pitch);
  let fn = courtLayers.get(key);
  if (!fn) { fn = layer('court' + key, CW, D.ch, 1.4, (g) => paintCourt(g, lines, pitch)); courtLayers.set(key, fn); if (courtLayers.size > 10) { const k0 = courtLayers.keys().next().value; courtLayers.delete(k0); cache.delete('court' + k0); } }
  fn(ctx, 0, 0);
}

// --- players, seen from above ----------------------------------------------------------------------------------
// o: { shirt:[hi,lo], sash, skin, ang (facing, radians, 0 = up the court), phase (stride cycle), moving, scale, alpha, out, num, big }
export function drawPlayer(ctx, x, y, o) {
  const s = (o.scale ?? 1) * 1.0, ang = o.ang ?? 0, ph = o.phase ?? 0, mv = o.moving ? 1 : 0, sw = Math.sin(ph * 7) * mv;
  const skin = o.skin ?? SKINS[0];
  ctx.save(); ctx.globalAlpha *= o.alpha ?? 1; ctx.translate(x, y); ctx.scale(s, s);
  // ground shadow
  ctx.fillStyle = 'rgba(40,20,0,0.30)'; ctx.beginPath(); ctx.ellipse(5, 8, 25, 17, 0, 0, TAU); ctx.fill();
  ctx.rotate(ang);
  // feet
  ctx.fillStyle = '#f4efe6';
  ctx.beginPath(); ctx.ellipse(-8, -12 - sw * 8, 5.5, 8, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(8, -12 + sw * 8, 5.5, 8, 0, 0, TAU); ctx.fill();
  // arms/hands swing
  ctx.strokeStyle = skin; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-23, -2 + sw * 9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(23, -2 - sw * 9); ctx.stroke();
  // shoulders / torso
  const sh = ctx.createLinearGradient(-20, -12, 20, 14); sh.addColorStop(0, o.shirt[0]); sh.addColorStop(1, o.shirt[1]);
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(0, 0, 21, 14, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.6; ctx.stroke();
  // sash across the chest
  ctx.strokeStyle = o.sash ?? '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(-15, -8); ctx.lineTo(14, 9); ctx.stroke();
  // head: ears and a little hair at the back, then a cap in the team colour with a visor towards the front
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(-11.5, 0, 3, 4.2, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(11.5, 0, 3, 4.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = o.hair ?? '#1f1410'; ctx.beginPath(); ctx.ellipse(0, 4, 11.5, 9, 0, 0, TAU); ctx.fill();
  const cg = ctx.createRadialGradient(-3.5, -3, 1, 0, -1, 12.5); cg.addColorStop(0, o.shirt[0]); cg.addColorStop(0.7, o.shirt[0]); cg.addColorStop(1, o.shirt[1]);
  ctx.fillStyle = o.shirt[1]; ctx.beginPath(); ctx.ellipse(0, -15.5, 8.5, 5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, -1, 11.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.strokeStyle = o.sash ?? '#fff'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 10); ctx.stroke();
  ctx.fillStyle = o.sash ?? '#fff'; ctx.beginPath(); ctx.arc(0, -1, 2.4, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(-4, -5, 4.5, 2.4, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
  if (o.num) {
    ctx.save(); ctx.translate(x, y - 33 * s); ctx.fillStyle = 'rgba(10,20,18,0.8)'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#fff6dc'; ctx.font = '800 17px "Barlow Condensed", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(o.num), 0, 6); ctx.restore();
  }
}
export const skinFor = (i) => SKINS[i % SKINS.length];

// a small kind glyph (above each guard): walker arrows, shadow eye, sprinter bolt
export function drawGlyph(ctx, kind, x, y, s = 1, a = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(8,16,14,0.82)'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
  ctx.strokeStyle = KIND_COLORS[kind].shirt[0]; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'walker') { ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(-8, 0); ctx.lineTo(-3, -5); ctx.moveTo(-8, 0); ctx.lineTo(-3, 5); ctx.moveTo(8, 0); ctx.lineTo(3, -5); ctx.moveTo(8, 0); ctx.lineTo(3, 5); ctx.stroke(); }
  else if (kind === 'shadow') { ctx.beginPath(); ctx.moveTo(-9, 0); ctx.quadraticCurveTo(0, -9, 9, 0); ctx.quadraticCurveTo(0, 9, -9, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill(); }
  else if (kind === 'sprinter') { ctx.beginPath(); ctx.moveTo(2, -9); ctx.lineTo(-5, 1); ctx.lineTo(0, 1); ctx.lineTo(-2, 9); ctx.lineTo(6, -2); ctx.lineTo(1, -2); ctx.closePath(); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.moveTo(0, -9); ctx.lineTo(-4, -4); ctx.moveTo(0, -9); ctx.lineTo(4, -4); ctx.moveTo(0, 9); ctx.lineTo(-4, 4); ctx.moveTo(0, 9); ctx.lineTo(4, 4); ctx.stroke(); }
  ctx.restore();
}
