// Art: the batik-patterned ground, the carved boat-shaped board, and the shell sprites. Everything static is painted ONCE into
// cached layers (OffscreenCanvas); per frame we only blit. One warm tropical sun from the upper left. Patterns are decoration only.
import { W, H, PIT_R, HULL, STORE_BOX, posXY } from './layout.js';

const TAU = Math.PI * 2, SS = 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

export const WOODS = {
  teak: { name: 'Teak', a: '#a4692f', b: '#7d4a20', c: '#55300f', face: ['#c98a4a', '#deA060', '#bf7d3c'], grain: [72, 36, 10], hi: 'rgba(255,220,160,0.6)' },
  dark: { name: 'Dark mahogany', a: '#5e3320', b: '#452314', c: '#2b140a', face: ['#83502f', '#996038', '#774626'], grain: [26, 10, 4], hi: 'rgba(255,200,150,0.4)' },
};
export const SEEDSETS = { cowries: 'Cowrie shells', saga: 'Red saga seeds', pebbles: 'River pebbles' };

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(w, h); return { c, x: c.getContext('2d') }; }
  return null;
}

// ---- the batik ground: kawung (four overlapping ovals) on indigo, gold and cream borders -------------------------------
function kawung(ctx, cx, cy, r, fill, line) {
  ctx.save(); ctx.translate(cx, cy);
  for (let k = 0; k < 4; k++) {
    ctx.save(); ctx.rotate(k * Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, -r * 0.5, r * 0.3, r * 0.5, 0, 0, TAU);
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -r * 0.5, r * 0.13, r * 0.28, 0, 0, TAU); ctx.strokeStyle = line; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, TAU); ctx.fillStyle = line; ctx.fill();
  ctx.restore();
}
function paintGround(ctx) {
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#1f2f5c'); bg.addColorStop(0.5, '#182449'); bg.addColorStop(1, '#241d3d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const rnd = lcg(3), R = 66;
  for (let j = -1; j * R * 1.0 < H + R; j++) for (let i = -1; i * R * 1.0 < W + R; i++) {
    const cx = i * R, cy = j * R, alt = (i + j) % 2 === 0;
    kawung(ctx, cx, cy, R * 1.0, alt ? 'rgba(96,120,190,0.16)' : 'rgba(150,100,60,0.16)', alt ? 'rgba(232,206,150,0.30)' : 'rgba(232,190,130,0.22)');
    if (rnd() < 0.25) { ctx.fillStyle = 'rgba(232,206,150,0.28)'; ctx.beginPath(); ctx.arc(cx + R / 2, cy + R / 2, 3, 0, TAU); ctx.fill(); }
  }
  // fine wax-resist crackle
  for (let k = 0; k < 500; k++) { const x = rnd() * W, y = rnd() * H, a = rnd() * TAU, l = 6 + rnd() * 24; ctx.strokeStyle = `rgba(230,210,160,${0.03 + rnd() * 0.05})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.4); ctx.stroke(); }
  // warm light pooling in from the upper left, and shade toward the lower right
  const sun = ctx.createRadialGradient(120, 160, 30, 200, 300, 1100); sun.addColorStop(0, 'rgba(255,200,110,0.42)'); sun.addColorStop(0.5, 'rgba(255,170,80,0.10)'); sun.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
  const sh = ctx.createLinearGradient(0, H * 0.5, W, H); sh.addColorStop(0, 'rgba(8,6,20,0)'); sh.addColorStop(1, 'rgba(8,6,20,0.5)'); ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H);
  // parang-style diagonal bands top and bottom
  for (const [y, h] of [[0, 92], [H - 54, 54]]) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, h); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#5a2f17'); g.addColorStop(1, '#3a1c0d'); ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
    for (let x = -h; x < W + h; x += 46) {
      ctx.beginPath(); ctx.moveTo(x, y + h); ctx.bezierCurveTo(x + 10, y + h * 0.4, x + 40, y + h * 0.9, x + 60, y + 4); ctx.strokeStyle = '#e6b24e'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 22, y + h); ctx.bezierCurveTo(x + 32, y + h * 0.4, x + 62, y + h * 0.9, x + 82, y + 4); ctx.strokeStyle = 'rgba(240,222,180,0.75)'; ctx.lineWidth = 2.6; ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#e6b24e'; ctx.fillRect(0, y === 0 ? h - 5 : y, W, 5);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 92, W, 8); ctx.fillRect(0, H - 62, W, 8);
}

// ---- the hull -----------------------------------------------------------------------------------------------------------
// half-width of the boat at height y (inset shrinks it evenly); shaped like a dugout: full amidships, drawn in to a prow at each end
function hw(y, inset = 0) {
  const a = Math.abs((y - HULL.cy) / ((HULL.bot - HULL.top) / 2 - inset * 0.9));
  if (a >= 1) return 0;
  return Math.max(0, HULL.A * Math.pow(1 - Math.pow(a, 3.2), 0.8) - inset);
}
function hullPath(ctx, inset = 0) {
  const y0 = HULL.top + inset * 0.9, y1 = HULL.bot - inset * 0.9, n = 90;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const y = y0 + (y1 - y0) * i / n; const x = HULL.cx + hw(y, inset); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  for (let i = n; i >= 0; i--) { const y = y0 + (y1 - y0) * i / n; ctx.lineTo(HULL.cx - hw(y, inset), y); }
  ctx.closePath();
}
function wave(ctx, x, y, s, dir) {                   // one carved wave scroll: a crest that curls over into a spiral
  ctx.beginPath(); ctx.moveTo(x - 13 * s, y + 8 * s); ctx.bezierCurveTo(x - 8 * s, y - 10 * s, x + 10 * s * dir, y - 12 * s, x + 12 * s * dir, y - 2 * s);
  ctx.bezierCurveTo(x + 13 * s * dir, y + 5 * s, x + 4 * s * dir, y + 6 * s, x + 3 * s * dir, y - 1 * s); ctx.bezierCurveTo(x + 3 * s * dir, y - 4 * s, x + 8 * s * dir, y - 4 * s, x + 8 * s * dir, y - 1 * s);
}
function carve(ctx, path, x, y, w, h, k) {            // a concave carved hollow lit from the upper left
  ctx.save(); path(ctx); ctx.shadowColor = 'rgba(255,214,150,0.6)'; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3.5; ctx.fillStyle = 'rgba(255,224,170,0.6)'; ctx.fill(); ctx.restore();
  ctx.save(); path(ctx); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w * 0.8, y + h * 0.95);
  g.addColorStop(0, '#190b04'); g.addColorStop(0.35, '#3d1f0d'); g.addColorStop(0.8, '#63391a'); g.addColorStop(1, '#88562b');
  ctx.fillStyle = g; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  const cg = ctx.createRadialGradient(x + w * 0.58, y + h * 0.6, 2, x + w / 2, y + h / 2, Math.max(w, h) * 0.55);
  cg.addColorStop(0, `rgba(130,80,38,${0.6 * k})`); cg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = cg; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(20,8,2,0.28)'; ctx.lineWidth = 1.2;
  for (let n = 0; n < 5; n++) { ctx.beginPath(); ctx.ellipse(x + w / 2 + 3, y + h / 2 + 3, Math.max(4, w / 2 - 6 - n * 5), Math.max(4, h / 2 - 6 - n * 5), 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
  ctx.save(); path(ctx); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,3,0,0.6)'; ctx.stroke(); ctx.restore();
}
function grain(ctx, x0, y0, w, h, WD, seed, count, alpha) {
  const rnd = lcg(seed), [gr, gg, gb] = WD.grain;
  for (let k = 0; k < count; k++) {
    const x = x0 + rnd() * w, amp = 2 + rnd() * 6, ph = rnd() * 6;
    ctx.strokeStyle = rnd() < 0.72 ? `rgba(${gr},${gg},${gb},${(0.12 + rnd() * 0.24) * alpha})` : `rgba(255,214,160,${0.03 + rnd() * 0.07})`;
    ctx.lineWidth = 0.6 + rnd() * 2.2; ctx.beginPath();
    for (let y = 0; y <= h; y += 24) { const xx = x + Math.sin(y / 110 + ph) * amp + Math.sin(y / 33 + ph * 2) * 1.2; y ? ctx.lineTo(xx, y0 + y) : ctx.moveTo(xx, y0 + y); }
    ctx.stroke();
  }
}
function paintBoard(ctx, wood) {
  const WD = WOODS[wood] ?? WOODS.teak, T = HULL.top, B = HULL.bot;
  // shadow on the ground
  ctx.save(); ctx.shadowColor = 'rgba(8,4,16,0.7)'; ctx.shadowBlur = 44; ctx.shadowOffsetX = 16; ctx.shadowOffsetY = 30; hullPath(ctx); ctx.fillStyle = WD.b; ctx.fill(); ctx.restore();
  // prow pieces: a carved horn curling up at each end
  for (const [ty, d] of [[T, 1], [B, -1]]) {
    ctx.save(); ctx.translate(HULL.cx, ty); ctx.scale(0.62, 0.62 * d);   // the horn is drawn upward; flipped at the bottom end
    ctx.beginPath(); ctx.moveTo(-26, 4); ctx.bezierCurveTo(-30, -26, -6, -44, 24, -38); ctx.bezierCurveTo(46, -34, 50, -14, 34, -12); ctx.bezierCurveTo(22, -10, 16, -22, 26, -26); ctx.bezierCurveTo(4, -28, 6, -8, 26, 4); ctx.closePath();
    ctx.shadowColor = 'rgba(8,4,16,0.55)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6; ctx.fillStyle = WD.b; ctx.fill(); ctx.shadowColor = 'transparent';
    const pg = ctx.createLinearGradient(-30, -40, 40, 6); pg.addColorStop(0, WD.a); pg.addColorStop(1, WD.c); ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(20,8,2,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  // hull body
  const fg = ctx.createLinearGradient(HULL.cx - HULL.A, T, HULL.cx + HULL.A, B); fg.addColorStop(0, WD.a); fg.addColorStop(0.5, WD.b); fg.addColorStop(1, WD.c);
  hullPath(ctx); ctx.fillStyle = fg; ctx.fill();
  ctx.save(); hullPath(ctx); ctx.clip();
  grain(ctx, HULL.cx - HULL.A, T, HULL.A * 2, B - T, WD, 21, 300, 1);
  const rnd = lcg(9);
  for (let k = 0; k < 120; k++) { const x = HULL.cx - HULL.A + rnd() * HULL.A * 2, y = T + rnd() * (B - T), a = 1.2 + rnd() * 0.5, l = 8 + rnd() * 20; ctx.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.13)' : 'rgba(255,220,170,0.10)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
  ctx.restore();
  // oiled bevel
  ctx.save(); hullPath(ctx); ctx.clip(); hullPath(ctx); ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(15,5,0,0.55)'; ctx.stroke(); ctx.restore();
  ctx.save(); hullPath(ctx); ctx.clip(); ctx.translate(2.5, 3); hullPath(ctx); ctx.lineWidth = 4; ctx.strokeStyle = WD.hi; ctx.stroke(); ctx.restore();
  // carved rim band: gold-lined groove with wave curls all round
  ctx.save(); hullPath(ctx, 12); ctx.strokeStyle = 'rgba(20,8,2,0.7)'; ctx.lineWidth = 3; ctx.stroke(); ctx.translate(1.2, 1.6); ctx.strokeStyle = 'rgba(255,214,150,0.4)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
  ctx.save(); hullPath(ctx, 12); ctx.clip();
  const y0 = T + 40, y1 = B - 40;
  for (let y = y0; y <= y1; y += 36) {
    for (const s of [-1, 1]) {
      const x = HULL.cx + s * (hw(y, 26)); const tilt = (hw(y + 6, 26) - hw(y - 6, 26)) / 12;
      ctx.save(); ctx.translate(x + s * 0, y); ctx.rotate(s * Math.atan(tilt) * -1 + (s > 0 ? 0 : 0)); wave(ctx, 0, 0, 1.6, s);
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(22,8,2,0.9)'; ctx.lineWidth = 4.6; ctx.stroke(); ctx.translate(1.1, 1.6); ctx.strokeStyle = 'rgba(255,214,150,0.6)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
  }
  ctx.restore();
  ctx.save(); hullPath(ctx, 40); ctx.strokeStyle = 'rgba(20,8,2,0.7)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  // mother-of-pearl inlays on the prows
  for (const y of [T + 34, B - 34]) { ctx.save(); ctx.translate(HULL.cx, y); ctx.fillStyle = 'rgba(20,8,2,0.6)'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill(); const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 11); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.6, '#f0d9b0'); g.addColorStop(1, '#b8946a'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#a53a24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.stroke(); ctx.restore(); }

  // the recessed playing surface
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = -2; hullPath(ctx, 46); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  const sg = ctx.createLinearGradient(HULL.cx - 200, T, HULL.cx + 200, B); sg.addColorStop(0, WD.face[0]); sg.addColorStop(0.5, WD.face[1]); sg.addColorStop(1, WD.face[2]);
  hullPath(ctx, 46); ctx.fillStyle = sg; ctx.fill();
  ctx.save(); hullPath(ctx, 46); ctx.clip();
  grain(ctx, HULL.cx - 240, T, 480, B - T, WD, 5, 110, 0.55);
  const ie = ctx.createLinearGradient(HULL.cx - 220, T, HULL.cx - 150, T + 80); ie.addColorStop(0, 'rgba(0,0,0,0.4)'); ie.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = ie; ctx.fillRect(HULL.cx - 260, T, 520, B - T);
  const sun = ctx.createRadialGradient(HULL.cx - 120, T + 200, 20, HULL.cx - 60, T + 340, 720); sun.addColorStop(0, 'rgba(255,225,160,0.38)'); sun.addColorStop(1, 'rgba(255,225,160,0)'); ctx.fillStyle = sun; ctx.fillRect(HULL.cx - 260, T, 520, B - T);
  ctx.restore();
  ctx.save(); hullPath(ctx, 46); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(15,5,0,0.6)'; ctx.stroke(); ctx.restore();
  // stores: deep carved troughs at the two ends
  for (const S of STORE_BOX) carve(ctx, (c) => rr(c, S.x, S.y, S.w, S.h, 50), S.x, S.y, S.w, S.h, 0.9);
  // the fourteen houses
  for (let i = 0; i < 15; i++) { if (i === 7) continue; const p = posXY(i); carve(ctx, (c) => { c.beginPath(); c.arc(p.x, p.y, PIT_R, 0, TAU); }, p.x - PIT_R, p.y - PIT_R, PIT_R * 2, PIT_R * 2, 1); }
  // a carved centre line with a small diamond-and-wave motif between the columns
  const cy0 = posXY(6).y - 28, cy1 = posXY(0).y + 28;
  ctx.strokeStyle = 'rgba(30,12,4,0.5)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(360, cy0); ctx.lineTo(360, cy1); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,214,150,0.35)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(362, cy0); ctx.lineTo(362, cy1); ctx.stroke();
  for (let i = 0; i < 7; i++) { const y = posXY(i).y - PITCH_HALF; drop(ctx, 360, y + 0); }
}
const PITCH_HALF = 44;
function drop(ctx, x, y) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = 'rgba(25,9,2,0.65)'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(9, 0); ctx.lineTo(0, 9); ctx.lineTo(-9, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8cf9c'; ctx.beginPath(); ctx.moveTo(0, -6.5); ctx.lineTo(6.5, 0); ctx.lineTo(0, 6.5); ctx.lineTo(-6.5, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#a53a24'; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, TAU); ctx.fill(); ctx.restore();
}

const layers = {};
function layer(key, paint) {
  let L = layers[key];
  if (L === undefined) { const m = makeCanvas(W * SS, H * SS); if (m) { m.x.scale(SS, SS); paint(m.x); L = m.c; } else L = null; layers[key] = L; }
  return L;
}
export function drawGround(ctx) {
  const t = layer('ground', paintGround);
  if (!t) { ctx.fillStyle = '#1b2850'; ctx.fillRect(0, 0, W, H); return; }
  ctx.drawImage(t, 0, 0, W, H);
}
export function drawBoard(ctx, wood = 'teak') { const b = layer('board_' + wood, (c) => paintBoard(c, wood)); if (b) ctx.drawImage(b, 0, 0, W, H); }

// ---- shells and seeds --------------------------------------------------------------------------------------------------
const BOX = 44, SC = 3;
const sprites = {};
function paintShell(set, v) {
  const m = makeCanvas(BOX * SC, BOX * SC); if (!m) return null;
  const c = m.x; c.scale(SC, SC); c.translate(BOX / 2, BOX / 2);
  c.fillStyle = 'rgba(15,4,0,0.30)'; c.beginPath(); c.ellipse(2.8, 4.6, set === 'cowries' ? 11.6 : 9.6, 7, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(15,4,0,0.2)'; c.beginPath(); c.ellipse(1.7, 3.2, 12, 8, 0, 0, TAU); c.fill();
  if (set === 'cowries') {
    const tint = [['#fffaf0', '#f3dfb4', '#bf9c6e'], ['#fff4e6', '#f1d2a8', '#b98d62'], ['#fbf6ea', '#e8dcb8', '#a8a078'], ['#fff2e0', '#f6d6b0', '#c39a6e']][v % 4];
    const g = c.createRadialGradient(-3.5, -3.5, 1, 0, 0, 13); g.addColorStop(0, tint[0]); g.addColorStop(0.55, tint[1]); g.addColorStop(1, tint[2]);
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 11, 7.8, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(95,62,32,0.7)'; c.lineWidth = 0.9; c.stroke();
    // the mouth: a long toothed slit down the belly-side of the shell
    c.strokeStyle = '#4e3018'; c.lineWidth = 1.7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-7, 0.4); c.quadraticCurveTo(0, -1.6, 7, 0.4); c.stroke();
    c.lineWidth = 0.9; for (let k = -6; k <= 6; k += 2.2) { c.beginPath(); c.moveTo(k, -1); c.lineTo(k, 2.3); c.stroke(); }
    c.strokeStyle = 'rgba(190,140,90,0.35)'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(0, 0, 8.2, 5.2, 0, 0.3, Math.PI - 0.3); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.ellipse(-4.2, -4.1, 3.6, 1.4, -0.45, 0, TAU); c.fill();
  } else if (set === 'saga') {
    const g = c.createRadialGradient(-3, -3.4, 0.6, 0, 0, 10); g.addColorStop(0, '#ff8a6a'); g.addColorStop(0.5, '#c8281c'); g.addColorStop(1, '#5a0a08');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 8.6, 7.4, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(20,4,0,0.55)'; c.lineWidth = 0.9; c.stroke();
    c.fillStyle = 'rgba(30,6,2,0.6)'; c.beginPath(); c.ellipse(0.6, 0.6, 3.2, 2.6, 0.5, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,235,220,0.9)'; c.beginPath(); c.ellipse(-3.2, -3.2, 2.9, 1.5, -0.6, 0, TAU); c.fill();
  } else {
    const T = [['#dcd6cb', '#8d8a86', '#3e3c3c'], ['#d2d8d8', '#7f8c8e', '#333e40'], ['#e0d4c2', '#9a8878', '#443a30'], ['#cbd0d8', '#7d8598', '#333a4a']][v % 4];
    const g = c.createRadialGradient(-3, -3.4, 0.6, 0, 0, 11); g.addColorStop(0, T[0]); g.addColorStop(0.5, T[1]); g.addColorStop(1, T[2]);
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 9.4, 7.6, 0.2, 0, TAU); c.fill(); c.strokeStyle = 'rgba(15,4,0,0.45)'; c.lineWidth = 0.9; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(-3.2, -3.3, 2.8, 1.4, -0.6, 0, TAU); c.fill();
  }
  return m.c;
}
export function drawSeed(ctx, set, v, x, y, rot = 0, s = 1) {
  const key = set + (v % 4);
  let sp = sprites[key]; if (sp === undefined) sp = sprites[key] = paintShell(set, v);
  if (!sp) { ctx.fillStyle = '#e8d3a0'; ctx.beginPath(); ctx.arc(x, y, 8 * s, 0, TAU); ctx.fill(); return; }
  const w = BOX * s;
  if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(sp, -w / 2, -w / 2, w, w); ctx.restore(); } else ctx.drawImage(sp, x - w / 2, y - w / 2, w, w);
}
// where shell number k rests inside a house (stable: adding a shell never moves the others)
export function slot(pit, k, r = PIT_R) {
  if (k < 24) { const rad = Math.min(r - 15, 8.6 * Math.sqrt(k + 0.4)), a = k * 2.399963 + pit * 1.1; return { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.94, rot: ((k * 137 + pit * 53) % 360) * Math.PI / 180, v: (k * 5 + pit) % 4 }; }
  const a = k * 2.399963 + pit, rad = 5 + ((k * 7) % 16);
  return { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.9 - (k - 24) * 0.8, rot: ((k * 91) % 360) * Math.PI / 180, v: (k * 3 + pit) % 4 };
}
