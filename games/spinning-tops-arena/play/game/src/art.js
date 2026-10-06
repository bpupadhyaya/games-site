// Drawing the table, the dish, the tops and the effects. Pure canvas, lit from the upper left.
// The table and dish are painted once into a cached layer (OffscreenCanvas where there is one); tops are drawn live.
import { ARENA, BODIES, TIPS, BALLAST, ARENAS, derive, tiltOf, clamp } from './sim.js';
import { VIEW } from './layout.js';

const TAU = Math.PI * 2;
export const CAM = { sy: ARENA.sy };
export const toScreen = (x, y) => ({ x: ARENA.cx + x, y: ARENA.cy + y * ARENA.sy });
export const toWorld = (sx, sy) => ({ x: sx - ARENA.cx, y: (sy - ARENA.cy) / ARENA.sy });

// ---- colour helpers -----------------------------------------------------------------------------------------------
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const shade = (c, k) => { const [r, g, b] = hex(c); const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
const WOOD = ['#e3b878', '#c28b4a', '#8d5a2a'];

// ---- the table and the dish ----------------------------------------------------------------------------------------
function drawTable(ctx, TW = 720, TH = 1280) {
  const g = ctx.createLinearGradient(0, 0, 0, TH);
  g.addColorStop(0, '#3a2216'); g.addColorStop(0.45, '#4d2f1d'); g.addColorStop(1, '#2a180f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, TW, TH);
  // plank grain: long gentle curves, a fixed pattern
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const y0 = (i * 53 + 17) % (TH + 20) - 10, amp = 4 + (i % 5) * 2.2, ph = i * 1.7;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(255,214,160,0.05)' : 'rgba(10,4,0,0.12)';
    ctx.lineWidth = 1 + (i % 4) * 0.7;
    ctx.beginPath();
    for (let x = -10; x <= TW + 10; x += 24) { const y = y0 + Math.sin(x * 0.012 + ph) * amp + Math.sin(x * 0.041 + ph * 2) * 1.5; if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // plank seams
  for (let x = 180; x < TW; x += 180) { ctx.strokeStyle = 'rgba(8,3,0,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, TH); ctx.stroke(); ctx.strokeStyle = 'rgba(255,214,160,0.06)'; ctx.beginPath(); ctx.moveTo(x + 2, 0); ctx.lineTo(x + 2, TH); ctx.stroke(); }
  ctx.restore();
  const v = ctx.createRadialGradient(TW / 2, TH / 2, 200, TW / 2, TH / 2, Math.max(900, Math.max(TW, TH) * 0.7));
  v.addColorStop(0, 'rgba(255,200,120,0.16)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, TW, TH);
}

const ellipse = (ctx, x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); };

function drawDish(ctx, arenaId) {
  const { cx, cy, R, sy } = ARENA;
  const deep = arenaId === 'bowl', flat = arenaId === 'plate';
  const rimW = flat ? 20 : 34, depth = flat ? 14 : deep ? 40 : 26;
  const Ro = R + rimW;
  // contact shadow on the table
  ctx.save();
  ellipse(ctx, cx + 12, cy + depth + 22, Ro * 1.02, Ro * sy * 1.02);
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.filter = 'none'; ctx.fill();
  ellipse(ctx, cx + 8, cy + depth + 14, Ro * 1.0, Ro * sy * 1.0);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  ctx.restore();
  // outer wall (the side of the dish below the rim)
  const side = ctx.createLinearGradient(cx - Ro, 0, cx + Ro, 0);
  side.addColorStop(0, '#7a2f1c'); side.addColorStop(0.3, '#a9452a'); side.addColorStop(0.6, '#6e2717'); side.addColorStop(1, '#3a120a');
  ctx.fillStyle = side;
  ctx.beginPath(); ctx.ellipse(cx, cy + depth, Ro, Ro * sy, 0, 0, Math.PI); ctx.lineTo(cx - Ro, cy); ctx.ellipse(cx, cy, Ro, Ro * sy, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy + depth, Ro, Ro * sy, 0, 0, Math.PI); ctx.stroke();
  // a gold line round the outer wall
  ctx.strokeStyle = 'rgba(240,196,92,0.75)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, cy + depth * 0.55, Ro - 1, (Ro - 1) * sy, 0, 0.05, Math.PI - 0.05); ctx.stroke();
  // top of the rim (lacquer)
  const rim = ctx.createLinearGradient(cx - Ro, cy - Ro * sy, cx + Ro, cy + Ro * sy);
  rim.addColorStop(0, '#d86c46'); rim.addColorStop(0.5, '#a63a22'); rim.addColorStop(1, '#6a2112');
  ellipse(ctx, cx, cy, Ro, Ro * sy); ctx.fillStyle = rim; ctx.fill();
  ctx.strokeStyle = 'rgba(40,10,0,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  // lacquer shine along the upper left of the rim
  ctx.strokeStyle = 'rgba(255,230,200,0.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(cx, cy, Ro - rimW * 0.35, (Ro - rimW * 0.35) * sy, 0, Math.PI * 0.95, Math.PI * 1.45); ctx.stroke();
  // gold inlay line on the rim top
  ctx.strokeStyle = 'rgba(244,204,110,0.85)'; ctx.lineWidth = 2.4;
  ellipse(ctx, cx, cy, Ro - rimW * 0.5, (Ro - rimW * 0.5) * sy); ctx.stroke();
  // the inside: a wall that curves down into the floor
  ellipse(ctx, cx, cy, R, R * sy);
  const wall = ctx.createRadialGradient(cx - 40, cy - 30 * sy, R * 0.2, cx, cy, R);
  if (flat) { wall.addColorStop(0, '#f2dcae'); wall.addColorStop(0.85, '#dcbc84'); wall.addColorStop(1, '#a87e48'); }
  else { wall.addColorStop(0, '#f4dfb2'); wall.addColorStop(0.5, '#e2c48c'); wall.addColorStop(0.82, '#bd9157'); wall.addColorStop(1, '#6f4524'); }
  ctx.fillStyle = wall; ctx.fill();
  // shadow cast by the rim on the far inside edge
  ctx.save(); ellipse(ctx, cx, cy, R, R * sy); ctx.clip();
  const sh = ctx.createLinearGradient(0, cy - R * sy, 0, cy - R * sy * 0.55);
  sh.addColorStop(0, 'rgba(40,16,4,0.5)'); sh.addColorStop(1, 'rgba(40,16,4,0)');
  ctx.fillStyle = sh; ctx.fillRect(cx - R, cy - R * sy, 2 * R, R * sy * 0.5);
  // floor rings: slope grooves
  ctx.lineWidth = 1.6;
  for (const f of flat ? [0.5, 0.86] : [0.28, 0.5, 0.7, 0.86]) { ctx.strokeStyle = 'rgba(88,48,16,0.2)'; ellipse(ctx, cx, cy, R * f, R * f * sy); ctx.stroke(); ctx.strokeStyle = 'rgba(255,240,205,0.22)'; ellipse(ctx, cx, cy + 2, R * f, R * f * sy); ctx.stroke(); }
  // small painted centre mark
  ctx.strokeStyle = 'rgba(150,50,28,0.55)'; ctx.lineWidth = 3; ellipse(ctx, cx, cy, 26, 26 * sy); ctx.stroke();
  ctx.fillStyle = 'rgba(150,50,28,0.35)'; ellipse(ctx, cx, cy, 8, 8 * sy); ctx.fill();
  ctx.restore();
  ellipse(ctx, cx, cy, R, R * sy); ctx.strokeStyle = 'rgba(60,24,8,0.55)'; ctx.lineWidth = 2; ctx.stroke();
}

const baked = {};
let makeCanvasOk = null;
// Bake a layer of `bw` x `bh` units (origin at ox, oy) at `S` pixels per unit. Returns null where there is no OffscreenCanvas.
function bakeOne(paint, bw, bh, ox = 0, oy = 0, S = 2) {
  if (makeCanvasOk === false) return null;
  if (typeof OffscreenCanvas === 'undefined') { makeCanvasOk = false; return null; }
  try {
    const c = new OffscreenCanvas(Math.round(bw * S), Math.round(bh * S));
    const x = c.getContext('2d');
    x.scale(S, S); x.translate(-ox, -oy);
    paint(x);
    makeCanvasOk = true;
    return c;
  } catch (e) { makeCanvasOk = false; return null; }
}
// The table fills the WHOLE screen (any size): one cached layer for the current screen size.
let tableKey = '', tableLayer = null;
const tableScale = (w, h) => Math.min(1.5, 2600 / Math.max(w, h));
export function drawTableLayer(ctx, w = VIEW.w, h = VIEW.h) {
  const key = `${Math.round(w)}x${Math.round(h)}`;
  if (key !== tableKey) { tableKey = key; tableLayer = bakeOne((x) => drawTable(x, w, h), w, h, 0, 0, tableScale(w, h)); }
  if (tableLayer) ctx.drawImage(tableLayer, 0, 0, w, h); else drawTable(ctx, w, h);
}
// The dish is baked once per kind, cropped to where it lives (design units), at 2 px per unit so it stays sharp when scaled up.
const DISH_BOX = { x: 30, y: 380, w: 660, h: 650 };
export function drawDishLayer(ctx, arenaId = 'shallow') {
  const key = `dish:${arenaId}`;
  let L = baked[key];
  if (L === undefined) { L = bakeOne((x) => drawDish(x, arenaId), DISH_BOX.w, DISH_BOX.h, DISH_BOX.x, DISH_BOX.y, 2); baked[key] = L; }
  if (L) ctx.drawImage(L, DISH_BOX.x, DISH_BOX.y, DISH_BOX.w, DISH_BOX.h); else drawDish(ctx, arenaId);
}
// the dish alone (the caller has drawn the table and set the transform)
export const drawBackdrop = (ctx, arenaId = 'shallow') => drawDishLayer(ctx, arenaId);
// warm the caches (called while a menu is up, so tapping Play has nothing left to paint)
export function prebake(arenaId) { const key = `dish:${arenaId}`; if (baked[key] === undefined) baked[key] = bakeOne((x) => drawDish(x, arenaId), DISH_BOX.w, DISH_BOX.h, DISH_BOX.x, DISH_BOX.y, 2); }

// ---- the tops --------------------------------------------------------------------------------------------------------
// Profiles are (height share, radius share) from the shoulder at the tip end up to the crown.
const PROFILE = {
  disc: [[0, 0.1], [0.06, 0.4], [0.2, 0.93], [0.34, 1], [0.5, 0.98], [0.64, 0.7], [0.8, 0.42], [0.92, 0.28], [1, 0.24]],
  pear: [[0, 0.1], [0.1, 0.44], [0.28, 0.82], [0.45, 0.98], [0.6, 0.92], [0.78, 0.6], [0.92, 0.32], [1, 0.24]],
  spire: [[0, 0.08], [0.12, 0.38], [0.3, 0.8], [0.42, 0.95], [0.56, 0.82], [0.78, 0.46], [0.95, 0.2], [1, 0.15]],
  dome: [[0, 0.12], [0.08, 0.62], [0.2, 0.98], [0.34, 1], [0.55, 0.9], [0.78, 0.6], [0.92, 0.34], [1, 0.26]],
};
const BANDS = {
  disc: [[0.1, 0.2, 2], [0.28, 0.5, 1], [0.58, 0.68, 2], [0.7, 1, 1]],
  pear: [[0.16, 0.3, 2], [0.3, 0.62, 1], [0.62, 0.7, 2], [0.7, 1, 1]],
  spire: [[0.16, 0.28, 2], [0.28, 0.6, 1], [0.6, 0.66, 2], [0.66, 1, 1]],
  dome: [[0.1, 0.24, 2], [0.24, 0.55, 1], [0.55, 0.64, 2], [0.64, 1, 1]],
};
const VIEWK = 0.34;
const bodyDims = (b) => {
  const d = derive(b);
  const H = 1.7 * d.h + 22;
  const tipLen = b.tip === 'steel' ? 17 : b.tip === 'pebble' ? 11 : 8;
  return { r: d.r, H, tipLen, d };
};
const profAt = (prof, z) => {
  for (let i = 1; i < prof.length; i++) if (z <= prof[i][0]) { const a = prof[i - 1], c = prof[i], k = (z - a[0]) / Math.max(1e-6, c[0] - a[0]); return a[1] + (c[1] - a[1]) * k; }
  return prof[prof.length - 1][1];
};

// the upright top, tip at (0,0), drawn upward. spin in 0..1 (blur), pipA the visible painted mark's angle.
function upright(ctx, build, look, o = {}) {
  const { r, H, tipLen } = bodyDims(build);
  const prof = PROFILE[build.body];
  const spin = o.spin ?? 0, pipA = o.pipA ?? 0, vk = o.vk ?? VIEWK, alpha = o.alpha ?? 1;
  const y0 = -tipLen;
  const X = (rho) => rho * r;
  const Y = (z) => y0 - z * H;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // --- the tip
  const tip = build.tip;
  const tw = tip === 'steel' ? r * 0.2 : tip === 'pebble' ? r * 0.24 : r * 0.3;
  const tg = ctx.createLinearGradient(-tw, 0, tw, 0);
  tg.addColorStop(0, '#f4f6f8'); tg.addColorStop(0.35, '#b9c0c8'); tg.addColorStop(1, '#5d646e');
  ctx.fillStyle = tg; ctx.beginPath();
  if (tip === 'steel') { ctx.moveTo(-tw, y0 + 2); ctx.lineTo(0, 0); ctx.lineTo(tw, y0 + 2); }
  else if (tip === 'pebble') { ctx.moveTo(-tw, y0 + 2); ctx.quadraticCurveTo(-tw * 1.25, y0 * 0.35, 0, 0); ctx.quadraticCurveTo(tw * 1.25, y0 * 0.35, tw, y0 + 2); }
  else { ctx.moveTo(-tw, y0 + 2); ctx.lineTo(-tw * 0.9, 0); ctx.lineTo(tw * 0.9, 0); ctx.lineTo(tw, y0 + 2); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(20,24,30,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillRect(-tw * 0.45, y0 * 0.82, tw * 0.28, -y0 * 0.55);
  // --- the silhouette
  const pts = [];
  const N = 22;
  for (let i = 0; i <= N; i++) { const z = i / N; pts.push([X(profAt(prof, z)), Y(z)]); }
  const sil = () => {
    ctx.beginPath();
    ctx.moveTo(-pts[0][0], pts[0][1]);
    for (let i = 1; i <= N; i++) ctx.lineTo(-pts[i][0], pts[i][1]);
    // the crown rim (back half of the top ellipse) and down the right side
    ctx.lineTo(pts[N][0], pts[N][1]);
    for (let i = N - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1]);
    // the bottom curve (front half of the first ellipse)
    ctx.quadraticCurveTo(0, y0 + X(prof[0][1]) * vk * 2, -pts[0][0], pts[0][1]);
    ctx.closePath();
  };
  // bare wood base
  const wood = ctx.createLinearGradient(-r, 0, r, 0);
  wood.addColorStop(0, WOOD[0]); wood.addColorStop(0.5, WOOD[1]); wood.addColorStop(1, WOOD[2]);
  sil(); ctx.fillStyle = wood; ctx.fill();
  ctx.save(); sil(); ctx.clip();
  // painted bands (each is a curved strip, as the rings of a turned top look from above)
  for (const [z0, z1, which] of BANDS[build.body]) {
    const col = which === 1 ? look.c1 : look.c2;
    const rA = profAt(prof, z0), rB = profAt(prof, z1);
    const ya = Y(z0), yb = Y(z1), wA = X(Math.max(rA, 0.3)) + 4, wB = X(Math.max(rB, 0.3)) + 4;
    ctx.beginPath();
    ctx.moveTo(-wA, ya); ctx.quadraticCurveTo(0, ya + X(rA) * vk * 2, wA, ya);
    ctx.lineTo(wB, yb); ctx.quadraticCurveTo(0, yb + X(rB) * vk * 2, -wB, yb); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
  }
  // a thin gold pinstripe where the colours meet
  const zp = BANDS[build.body][1][1];
  ctx.strokeStyle = 'rgba(244,208,120,0.9)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-r, Y(zp)); ctx.quadraticCurveTo(0, Y(zp) + X(profAt(prof, zp)) * vk * 2, r, Y(zp)); ctx.stroke();
  // the rim ring weight
  if (build.ballast === 'heavy') {
    const zr = build.body === 'spire' ? 0.42 : 0.36, rr = profAt(prof, zr), yy = Y(zr), hh = 8;
    const rg = ctx.createLinearGradient(-r, 0, r, 0);
    rg.addColorStop(0, '#f0f2f4'); rg.addColorStop(0.3, '#aeb5bd'); rg.addColorStop(1, '#4e555e');
    ctx.fillStyle = rg; ctx.beginPath();
    ctx.moveTo(-X(rr) - 3, yy - hh / 2); ctx.quadraticCurveTo(0, yy - hh / 2 + X(rr) * vk * 2, X(rr) + 3, yy - hh / 2);
    ctx.lineTo(X(rr) + 3, yy + hh / 2); ctx.quadraticCurveTo(0, yy + hh / 2 + X(rr) * vk * 2, -X(rr) - 3, yy + hh / 2); ctx.closePath(); ctx.fill();
  } else if (build.ballast === 'light') {
    // hollowed rim: three small carved slots
    ctx.fillStyle = 'rgba(30,14,4,0.55)';
    for (const f of [-0.5, 0, 0.5]) { const zz = 0.4, rr = profAt(prof, zz); ctx.beginPath(); ctx.ellipse(f * X(rr) * 1.1, Y(zz) + X(rr) * vk * (1 - f * f * 0.6), 4.4, 2.4, 0, 0, TAU); ctx.fill(); }
  }
  // cylindrical shading: light from the left
  const sh = ctx.createLinearGradient(-r, 0, r, 0);
  sh.addColorStop(0, 'rgba(255,248,230,0.42)'); sh.addColorStop(0.28, 'rgba(255,248,230,0.08)'); sh.addColorStop(0.62, 'rgba(25,10,0,0.12)'); sh.addColorStop(1, 'rgba(15,5,0,0.58)');
  ctx.fillStyle = sh; ctx.fillRect(-r - 2, Y(1) - 4, 2 * r + 4, H + 12);
  // the lacquer highlight streak
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 3; i <= N - 4; i++) { const z = i / N, xx = -X(profAt(prof, z)) * 0.58; if (i === 3) ctx.moveTo(xx, Y(z)); else ctx.lineTo(xx, Y(z)); }
  ctx.stroke();
  // fast spin: the paint smears into soft rings
  if (spin > 0.02) {
    ctx.globalAlpha *= 0.5 * Math.min(1, spin);
    for (let k = 0; k < 5; k++) { const z = 0.2 + k * 0.17; ctx.strokeStyle = k % 2 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-r, Y(z)); ctx.quadraticCurveTo(0, Y(z) + X(profAt(prof, z)) * vk * 2, r, Y(z)); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // outline
  sil(); ctx.strokeStyle = 'rgba(38,16,4,0.7)'; ctx.lineWidth = 1.6; ctx.stroke();
  // a painted mark that turns with the top (clear when slow, a smear when fast)
  const pa = 1 - clamp(spin * 1.5, 0, 0.88);
  const ca = Math.cos(pipA);
  if (ca > 0.02) {
    const zz = 0.5, rr = X(profAt(prof, zz)), px = rr * Math.sin(pipA), py = Y(zz) + rr * vk * ca;
    ctx.fillStyle = `rgba(255,252,240,${0.95 * pa})`; ctx.beginPath(); ctx.ellipse(px, py, 5 * ca + 1.4, 8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(60,24,6,${0.6 * pa})`; ctx.lineWidth = 1; ctx.stroke();
  }
  // crown: the flat top and the handle stem
  const topR = X(prof[N === 22 ? prof.length - 1 : 0][1]);
  const yt = Y(1);
  const stemH = build.body === 'spire' ? 24 : build.body === 'dome' ? 14 : 18;
  const sg = ctx.createLinearGradient(-topR * 0.55, 0, topR * 0.55, 0);
  sg.addColorStop(0, WOOD[0]); sg.addColorStop(0.5, WOOD[1]); sg.addColorStop(1, '#6a4020');
  ctx.fillStyle = sg; ctx.fillRect(-topR * 0.5, yt - stemH, topR, stemH + 1);
  ctx.strokeStyle = 'rgba(38,16,4,0.6)'; ctx.lineWidth = 1.2; ctx.strokeRect(-topR * 0.5, yt - stemH, topR, stemH + 1);
  const cap = ctx.createLinearGradient(-topR, 0, topR, 0);
  cap.addColorStop(0, shade(look.c1, 0.35)); cap.addColorStop(1, shade(look.c1, -0.3));
  ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(0, yt, topR * 1.05, topR * 1.05 * vk, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(38,16,4,0.6)'; ctx.stroke();
  ctx.fillStyle = WOOD[0]; ctx.beginPath(); ctx.ellipse(0, yt - stemH, topR * 0.56, topR * 0.56 * vk, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
  return { H: H + tipLen + stemH, r };
}

// A top at its place in the dish, with its lean, wobble, shadow and effects. t: the sim top; look: { c1, c2 }.
export function drawTop(ctx, top, look, clock, o = {}) {
  const d = derive(top.build);
  const p = toScreen(top.x, top.y);
  const spin = top.st === 0 ? clamp(top.w / (top.w0 || 1), 0, 1) : 0;
  const lean = tiltOf(top);
  const dims = bodyDims(top.build);
  let px = p.x, py = p.y, lift = 0, rot = 0, fade = 1, sc = 1;
  // a freshly thrown top drops onto the dish
  if (top.st === 0 && o.age !== undefined && o.age < 0.3) lift = 70 * Math.pow(1 - o.age / 0.3, 2);
  if (top.st === 2) {
    // knocked out: hops over the rim and drops to the table
    const k = clamp(top.stT / 1.1, 0, 1.4);
    lift = Math.sin(clamp(k, 0, 1) * Math.PI) * 120;
    px += top.vx * 0.22 * Math.min(top.stT, 1.1); py += top.vy * 0.2 * Math.min(top.stT, 1.1) * ARENA.sy + (k >= 1 ? 0 : 0);
    rot = top.stT * 5 * (top.sg || 1); fade = clamp(1.7 - top.stT, 0, 1); sc = 1 + lift / 260;
  }
  if (fade <= 0.01) return;
  // shadow on the floor
  ctx.save();
  const shk = top.st === 2 ? clamp(1 - lift / 140, 0.3, 1) : clamp(1 - lift / 110, 0.3, 1);
  ctx.globalAlpha = 0.42 * fade * shk;
  ctx.fillStyle = '#1a0c04';
  ctx.beginPath(); ctx.ellipse(px + 9 + lean * 14, py + 3, d.r * 0.95 * (top.st === 1 ? 1.2 : 1), d.r * 0.3, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.25 * fade * shk; ctx.beginPath(); ctx.ellipse(px + 3, py + 1.5, d.r * 0.5, d.r * 0.16, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(px, py - lift);
  if (top.st === 0) {
    // lean about the tip: tilting sideways swings the top, tilting toward the viewer foreshortens and opens the crown
    const tx = top.tx, ty = top.ty;
    ctx.rotate(clamp(tx, -1.3, 1.3) * 1.05);
    ctx.scale(1, 1 - 0.28 * clamp(Math.abs(ty), 0, 1) * Math.sign(ty > 0 ? 1 : 0.2));
    // the whole top shakes a little as it wobbles
    const wob = clamp(lean, 0, 1) * 1.2 * Math.sin(clock * 38);
    ctx.translate(wob, 0);
    upright(ctx, top.build, look, { spin, pipA: top.ang, vk: VIEWK + 0.5 * clamp(ty, -0.5, 0.7) });
    // spin haze round the body at speed
    if (spin > 0.35) {
      ctx.globalAlpha = 0.16 * spin * fade; ctx.strokeStyle = '#fff'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.ellipse(0, -dims.tipLen - dims.H * 0.36, d.r * 1.06, d.r * 1.06 * VIEWK, 0, 0, TAU); ctx.stroke();
    }
  } else {
    // fallen: lies on its side and rolls round its tip
    const k = top.st === 1 ? clamp(top.stT / 0.55, 0, 1) : 1;
    const side = top.sg || 1;
    const ang = (1 - Math.pow(1 - k, 3)) * 1.45 * side + (top.st === 1 ? Math.sin(top.stT * 9) * 0.05 * (1 - k) : 0);
    ctx.rotate(ang + rot);
    ctx.scale(sc, sc);
    upright(ctx, top.build, look, { spin: 0, pipA: top.ang, vk: VIEWK });
  }
  ctx.restore();
}

// ---- trails and particles --------------------------------------------------------------------------------------------
export function drawTrails(ctx, trails, looks) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  trails.forEach((tr, i) => {
    if (tr.length < 2) return;
    for (let k = 1; k < tr.length; k++) {
      const a = tr[k - 1], b = tr[k], f = k / tr.length;
      ctx.strokeStyle = i === 0 ? `rgba(255,236,200,${0.34 * f})` : `rgba(255,214,170,${0.28 * f})`;
      ctx.lineWidth = 2 + 5 * f;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  });
  void looks;
  ctx.restore();
}

export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const f = 1 - p.t / p.max;
    if (f <= 0) continue;
    ctx.save();
    if (p.kind === 'spark') {
      ctx.globalAlpha = Math.min(1, f * 1.4); ctx.strokeStyle = f > 0.55 ? '#fff4c8' : '#ffb347'; ctx.lineWidth = 2.4 * f + 0.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); ctx.stroke();
    } else if (p.kind === 'dust') {
      ctx.globalAlpha = 0.3 * f; const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (1.3 - f * 0.5));
      g.addColorStop(0, 'rgba(238,214,170,0.9)'); g.addColorStop(1, 'rgba(238,214,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.3 - f * 0.5), 0, TAU); ctx.fill();
    } else if (p.kind === 'ring') {
      ctx.globalAlpha = 0.7 * f; ctx.strokeStyle = '#fff1d0'; ctx.lineWidth = 3 + 5 * f;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * (1 - f) + 8, (p.size * (1 - f) + 8) * 0.45, 0, 0, TAU); ctx.stroke();
    } else if (p.kind === 'chip') {
      ctx.globalAlpha = Math.min(1, f * 2); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.col; ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
    }
    ctx.restore();
  }
}

// ---- illustrations (for rules, the workshop and the menus) ----------------------------------------------------------------
export function drawTopPreview(ctx, build, look, x, y, scale = 1, clock = 0, o = {}) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale);
  const spin = o.spin ?? 0.5;
  // floor shadow
  const d = derive(build);
  ctx.globalAlpha = 0.4; ctx.fillStyle = '#120802'; ctx.beginPath(); ctx.ellipse(10, 4, d.r * 0.95, d.r * 0.3, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  upright(ctx, build, look, { spin, pipA: (build.hand === -1 ? -1 : 1) * clock * (o.rate ?? 2.2), vk: o.vk ?? VIEWK });
  ctx.restore();
}
export const topHeight = (build) => { const b = bodyDims(build); return b.H + b.tipLen + 26; };

// the little dish used in the rules illustrations
export function drawMiniDish(ctx, w, h, arenaId = 'shallow') {
  ctx.save();
  const cx = w / 2, cy = h / 2, rx = w * 0.46, ry = h * 0.42;
  const rim = ctx.createLinearGradient(0, 0, w, h);
  rim.addColorStop(0, '#d86c46'); rim.addColorStop(1, '#6a2112');
  ctx.fillStyle = rim; ctx.beginPath(); ctx.ellipse(cx, cy, rx + 9, ry + 9, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(cx - 10, cy - 8, 6, cx, cy, rx);
  g.addColorStop(0, '#f4dfb2'); g.addColorStop(0.6, '#e0c288'); g.addColorStop(1, arenaId === 'plate' ? '#c9a468' : '#8b5a30');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(88,48,16,0.25)'; ctx.lineWidth = 1.5;
  for (const f of [0.35, 0.65]) { ctx.beginPath(); ctx.ellipse(cx, cy, rx * f, ry * f, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

export const LOOKS = [
  { c1: '#c4472b', c2: '#f3d9a4' }, { c1: '#2b7f9e', c2: '#f3d9a4' }, { c1: '#d49a2a', c2: '#4a2a1a' }, { c1: '#5a8f3c', c2: '#f3e6c0' }, { c1: '#6b3a8c', c2: '#f0c75e' }, { c1: '#222a3a', c2: '#e8c35a' },
];
export const lookOf = (i) => LOOKS[((i % LOOKS.length) + LOOKS.length) % LOOKS.length];
export { BODIES, TIPS, BALLAST, ARENAS };
