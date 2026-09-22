// Art: the woven table, the hand-carved board, and the seed sprites. Everything here is painted ONCE into cached
// layers (OffscreenCanvas); per frame we only blit. One light, warm afternoon sun from the upper left.
// The geometric bands are decoration only.
import { W, H, PIT_R, FRAME, TRAY, pitPos, MID_Y } from './layout.js';

const TAU = Math.PI * 2, SS = 2;                      // board layer is painted at 2x for crisp phones
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

export const WOODS = {
  iroko: { name: 'Iroko', a: '#8a5326', b: '#6b3a19', c: '#4c2610', face: ['#b97a3c', '#d59650', '#b47238'], grain: [70, 34, 10], hi: 'rgba(255,214,150,0.55)' },
  ebony: { name: 'Dark ebony', a: '#3a2618', b: '#2a1a10', c: '#1a0f08', face: ['#5d3d26', '#734a2c', '#553520'], grain: [20, 10, 4], hi: 'rgba(255,200,140,0.35)' },
};
export const SEEDSETS = { nuts: 'Polished nuts', cowries: 'Cowries', glass: 'Glass beads' };

// ---- helpers -----------------------------------------------------------------------------------------------
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(w, h); return { c, x: c.getContext('2d') }; }
  return null;
}

// woven geometric band (decoration): a strip of indigo with cream stepped diamonds and ochre rules
function band(ctx, y, h, seed) {
  const rnd = lcg(seed);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#22346a'); g.addColorStop(1, '#16224a');
  ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
  ctx.fillStyle = '#e9b64a'; ctx.fillRect(0, y + 4, W, 3); ctx.fillRect(0, y + h - 7, W, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(0, y, W, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y + h - 2, W, 2);
  const cy = y + h / 2, u = (h - 24) / 2;
  for (let x = u + 8, k = 0; x < W + u; x += u * 3.2, k++) {
    ctx.save(); ctx.translate(x, cy);
    ctx.fillStyle = '#f1dcae'; ctx.beginPath(); ctx.moveTo(0, -u); ctx.lineTo(u, 0); ctx.lineTo(0, u); ctx.lineTo(-u, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c4452a'; const v = u * 0.62; ctx.beginPath(); ctx.moveTo(0, -v); ctx.lineTo(v, 0); ctx.lineTo(0, v); ctx.lineTo(-v, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#16224a'; ctx.beginPath(); ctx.arc(0, 0, u * 0.2, 0, TAU); ctx.fill();
    // small stepped marks between the diamonds
    ctx.fillStyle = '#e9b64a';
    for (let s = 0; s < 3; s++) ctx.fillRect(u * 1.6 - s * 3 + 4, -6 + s * 5 - 2, 7 + s * 3, 3);
    ctx.restore();
  }
  // woven thread texture on the band
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 4) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.stroke(); }
  void rnd;
}

function paintTable(ctx) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#b2532d'); bg.addColorStop(0.5, '#953f22'); bg.addColorStop(1, '#6e2a16');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // weave: fine crossing threads, with slow irregular tint
  const rnd = lcg(7);
  for (let y = 0; y < H; y += 3) { ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,220,170' : '40,10,0'},${0.03 + rnd() * 0.04})`; ctx.fillRect(0, y, W, 1.4); }
  for (let x = 0; x < W; x += 3) { ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,220,170' : '40,10,0'},${0.03 + rnd() * 0.04})`; ctx.fillRect(x, 0, 1.4, H); }
  // wide soft stripes like a woven cloth
  for (let k = 0; k < 9; k++) { ctx.fillStyle = `rgba(0,0,0,${0.03 + (k % 2) * 0.03})`; ctx.fillRect(0, 150 + k * 165, W, 44); }
  band(ctx, 0, 92, 1); band(ctx, 1468, 92, 2);
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.fillRect(0, 92, W, 12); ctx.restore();
}
function paintMid(ctx) {                            // the two narrower bands that frame the board scenes
  band(ctx, 326, 50, 3); band(ctx, 1130, 56, 4);
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.fillRect(0, 376, W, 10); ctx.fillRect(0, 1186, W, 10); ctx.restore();
}

function paintBoard(ctx, wood) {
  const WD = WOODS[wood] ?? WOODS.iroko, F = FRAME;
  // shadow thrown by the board (down-right)
  ctx.save(); ctx.shadowColor = 'rgba(30,8,0,0.65)'; ctx.shadowBlur = 46; ctx.shadowOffsetX = 14; ctx.shadowOffsetY = 34;
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
  for (const [cx, cy] of [[F.x + 30, F.y + 30], [F.x + F.w - 30, F.y + 30], [F.x + 30, F.y + F.h - 30], [F.x + F.w - 30, F.y + F.h - 30]]) { ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = 'rgba(20,8,2,0.6)'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(13, 0); ctx.lineTo(0, 13); ctx.lineTo(-13, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#f1dcae'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(11, 0); ctx.lineTo(0, 11); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#b8402a'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }

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
  for (const T of [TRAY.top, TRAY.bottom]) {
    carve(ctx, (c) => rr(c, T.x, T.y, T.w, T.h, 44), T.x, T.y, T.w, T.h, WD, 0.9);
  }
  // the twelve pits: deep bowls with a lit lower rim
  for (let i = 0; i < 12; i++) { const p = pitPos(i); carve(ctx, (c) => { c.beginPath(); c.arc(p.x, p.y, PIT_R, 0, TAU); }, p.x - PIT_R, p.y - PIT_R, PIT_R * 2, PIT_R * 2, WD, 1); }
  // carved flow arrows between the rows: top row runs left, bottom row runs right (counter-clockwise)
  arrows(ctx, MID_Y - 26, -1); arrows(ctx, MID_Y + 26, 1);
  // pit numbers are not needed; a hairline carved groove down the middle
  ctx.strokeStyle = 'rgba(30,12,4,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 30, MID_Y); ctx.lineTo(px + pw - 30, MID_Y); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,214,150,0.25)'; ctx.beginPath(); ctx.moveTo(px + 30, MID_Y + 2); ctx.lineTo(px + pw - 30, MID_Y + 2); ctx.stroke();
}

// A concave carved hollow: dark wall on the lit side, warm oiled highlight along the opposite lip.
function carve(ctx, path, x, y, w, h, WD, k) {
  ctx.save();
  path(ctx); ctx.shadowColor = 'rgba(255,214,150,0.55)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3.5;
  ctx.fillStyle = 'rgba(255,224,170,0.55)'; ctx.fill(); ctx.restore();                         // lit lower rim
  ctx.save(); path(ctx); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w * 0.8, y + h * 0.95);
  g.addColorStop(0, '#1c0d05'); g.addColorStop(0.35, '#3f200e'); g.addColorStop(0.8, '#63391a'); g.addColorStop(1, '#84532a');
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

function arrows(ctx, y, dir) {
  ctx.save();
  for (let x = 200; x <= 520; x += 40) {
    const p = () => { ctx.beginPath(); ctx.moveTo(x - dir * 9, y - 9); ctx.lineTo(x + dir * 9, y); ctx.lineTo(x - dir * 9, y + 9); };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    p(); ctx.translate(0.8, 1.4); ctx.strokeStyle = 'rgba(255,224,170,0.4)'; ctx.lineWidth = 4; ctx.stroke(); ctx.translate(-0.8, -1.4);
    p(); ctx.strokeStyle = 'rgba(40,16,4,0.6)'; ctx.lineWidth = 3.4; ctx.stroke();
  }
  ctx.restore();
}

const layers = {};
function layer(key, paint) {
  let L = layers[key];
  if (L === undefined) { const m = makeCanvas(W * SS, H * SS); if (m) { m.x.scale(SS, SS); paint(m.x); L = m.c; } else L = null; layers[key] = L; }
  return L;
}
// scene: 'board' = table + bands + board; 'title' = table + a smaller board (drawn by the caller with a transform)
export function drawTable(ctx, wood = 'iroko', withMid = true) {
  const t = layer('table', paintTable);
  if (!t) { ctx.fillStyle = '#953f22'; ctx.fillRect(0, 0, W, H); return; }
  ctx.drawImage(t, 0, 0, W, H);
  if (withMid) ctx.drawImage(layer('mid', paintMid), 0, 0, W, H);
}
export function drawBoard(ctx, wood = 'iroko') {
  const b = layer('board_' + wood, (c) => paintBoard(c, wood)); if (b) ctx.drawImage(b, 0, 0, W, H);
}

// ---- seeds -------------------------------------------------------------------------------------------------
const SEED_BOX = 40, SEED_SC = 3;
const TINTS = {
  nuts: [['#e6a05a', '#94481c', '#3d1a08'], ['#d68a3c', '#7d3812', '#2f1206'], ['#9a5a3a', '#4c2312', '#1d0b04'], ['#c8763a', '#6e2e10', '#280f05']],
  glass: [['#c8f4ee', '#3fb0a8', '#10545a'], ['#d4e8ff', '#4f83d6', '#1a2f74'], ['#ffe6b0', '#e0902c', '#7a3d08'], ['#f1d0ff', '#a44fd0', '#4a1670']],
};
const sprites = {};
function paintSeed(set, v) {
  const m = makeCanvas(SEED_BOX * SEED_SC, SEED_BOX * SEED_SC); if (!m) return null;
  const c = m.x; c.scale(SEED_SC, SEED_SC); c.translate(SEED_BOX / 2, SEED_BOX / 2);
  // soft contact shadow, baked in
  c.fillStyle = 'rgba(15,4,0,0.34)'; c.beginPath(); c.ellipse(2.6, 4.2, set === 'cowries' ? 10.4 : 9.4, 6.4, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(15,4,0,0.22)'; c.beginPath(); c.ellipse(1.6, 3, 10.8, 7.2, 0, 0, TAU); c.fill();
  if (set === 'cowries') {
    const g = c.createRadialGradient(-3, -3, 1, 0, 0, 11); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.55, '#f1dcaa'); g.addColorStop(1, '#b9986a');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 9.8, 7.2, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(90,60,30,0.6)'; c.lineWidth = 0.8; c.stroke();
    c.strokeStyle = '#5a3a1c'; c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-6.2, 0.2 + (v % 2) * 0.4); c.quadraticCurveTo(0, -1.4, 6.2, 0.2); c.stroke();
    c.lineWidth = 0.9; for (let k = -5; k <= 5; k += 2.5) { c.beginPath(); c.moveTo(k, -0.9); c.lineTo(k, 1.9); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.ellipse(-3.4, -3.6, 3.2, 1.3, -0.4, 0, TAU); c.fill();
  } else {
    const T = TINTS[set][v % 4], g = c.createRadialGradient(-3, -3.4, 0.6, 0, 0, set === 'glass' ? 8.6 : 10);
    g.addColorStop(0, T[0]); g.addColorStop(0.5, T[1]); g.addColorStop(1, T[2]);
    c.fillStyle = g; c.beginPath();
    if (set === 'glass') c.arc(0, 0, 8, 0, TAU); else c.ellipse(0, 0, 9.2, 7.6, 0, 0, TAU);
    c.fill(); c.strokeStyle = 'rgba(15,4,0,0.45)'; c.lineWidth = 0.9; c.stroke();
    // a faint band of darker wood grain across a nut
    if (set === 'nuts') { c.strokeStyle = 'rgba(30,10,2,0.25)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-6, 2 + (v % 3) - 1); c.quadraticCurveTo(0, 4, 6, 1); c.stroke(); }
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
    const rad = Math.min(r - 12, 8.6 * Math.sqrt(k + 0.4)), a = k * 2.399963 + pit * 1.1;
    return { x: Math.cos(a) * rad * 1.0, y: Math.sin(a) * rad * 0.94, rot: ((k * 137 + pit * 53) % 360) * Math.PI / 180, v: (k * 5 + pit) % 4 };
  }
  const a = k * 2.399963 + pit, rad = 6 + ((k * 7) % 16);
  return { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.9 - (k - 26) * 0.8, rot: ((k * 91) % 360) * Math.PI / 180, v: (k * 3 + pit) % 4 };
}
