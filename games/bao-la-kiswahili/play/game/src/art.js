// Art: a kanga-style cloth table, a carved teak board with brass studs and chain-carved borders, and seed sprites.
// Everything is painted ONCE into cached layers (OffscreenCanvas); per frame we only blit. Warm light from the upper left.
// The patterns are original geometric decoration only.
import { PIT_R, GEOMS, pitLocal, geom } from './layout.js';
import { NYUMBA } from './rules.js';

const TAU = Math.PI * 2, SS = 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

export const WOODS = {
  teak: { name: 'Teak', a: '#6f4220', b: '#4f2c13', c: '#33190a', face: ['#8f5a2c', '#a8703a', '#84522a'], grain: [48, 22, 6], hi: 'rgba(255,214,150,0.5)' },
  ebony: { name: 'Dark ebony', a: '#33231a', b: '#241710', c: '#150d08', face: ['#4a3223', '#5d3f2c', '#432c1e'], grain: [14, 8, 3], hi: 'rgba(255,200,140,0.32)' },
};
export const SEEDSETS = { mbono: 'Grey mbono seeds', cowries: 'Cowries', amber: 'Amber beads' };
const BRASS = ['#f7e3a1', '#d9a93c', '#8d6119'];

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(w, h); return { c, x: c.getContext('2d') }; }
  return null;
}

// ---- the cloth (kanga-inspired): indigo ground, ochre leaf motifs, white dots, a coral border with white teeth --------
function leaf(ctx, x, y, s, rot, fill, line) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, -26); ctx.bezierCurveTo(22, -14, 24, 14, 0, 26); ctx.bezierCurveTo(-16, 14, -14, -8, 0, -26); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(7, 0, 0, 16); ctx.strokeStyle = line; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, TAU); ctx.fillStyle = line; ctx.fill();
  ctx.restore();
}
function border(ctx, W, y, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#d2553a'); g.addColorStop(1, '#a93a26');
  ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
  ctx.fillStyle = '#f6e7c4'; ctx.fillRect(0, y + 6, W, 3); ctx.fillRect(0, y + h - 9, W, 3);
  const tw = 30;
  ctx.fillStyle = '#f6e7c4';
  for (let x = 0; x < W + tw; x += tw) { ctx.beginPath(); ctx.moveTo(x, y + h - 12); ctx.lineTo(x + tw / 2, y + 14); ctx.lineTo(x + tw, y + h - 12); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#1a2b4d';
  for (let x = tw / 2; x < W + tw; x += tw) { ctx.beginPath(); ctx.arc(x, y + h / 2 + 4, 4, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(0, y, W, 2); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y + h - 2, W, 2);
}
function paintTable(ctx, W, H, bd) {
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1f3459'); bg.addColorStop(0.5, '#182a4a'); bg.addColorStop(1, '#101e38');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const rnd = lcg(11);
  for (let y = 0; y < H; y += 3) { ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,20'},${0.02 + rnd() * 0.035})`; ctx.fillRect(0, y, W, 1.4); }
  for (let x = 0; x < W; x += 3) { ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,20'},${0.02 + rnd() * 0.035})`; ctx.fillRect(x, 0, 1.4, H); }
  // rows of leaf motifs alternating colour, with white dot rows between them (printed-cloth look)
  const fills = [['#e0a93a', '#7d4d10'], ['#d2553a', '#6e1f12'], ['#f2e4c0', '#8a6a3a']];
  let k = 0;
  for (let y = 32; y < H - 40; y += 118, k++) {
    for (let x = (k % 2) * 45 + 44; x < W; x += 90) { const f = fills[(k + Math.floor(x / 90)) % 3]; leaf(ctx, x, y, 0.82, (k % 2 ? 0.5 : -0.5) * 0.4 + ((x / 90) % 2 ? 0.25 : -0.25), f[0], f[1]); }
    ctx.fillStyle = 'rgba(246,231,196,0.55)';
    for (let x = 8; x < W; x += 24) { ctx.beginPath(); ctx.arc(x, y + 59, 2.4, 0, TAU); ctx.fill(); }
  }
  // gentle vignette so the board reads
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72); vg.addColorStop(0, 'rgba(0,0,10,0)'); vg.addColorStop(1, 'rgba(0,0,10,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (bd.side === 'tb') {
    border(ctx, W, 0, bd.t); border(ctx, W, H - bd.t, bd.t);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.fillRect(0, bd.t, W, 10); ctx.fillRect(0, H - bd.t - 10, W, 10); ctx.restore();
  } else {
    ctx.save(); ctx.translate(bd.t, 0); ctx.rotate(Math.PI / 2); border(ctx, H, 0, bd.t); ctx.restore();
    ctx.save(); ctx.translate(W, 0); ctx.rotate(Math.PI / 2); border(ctx, H, 0, bd.t); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.fillRect(bd.t, 0, 10, H); ctx.fillRect(W - bd.t - 10, 0, 10, H); ctx.restore();
  }
}

// ---- the board ---------------------------------------------------------------------------------------------------
function stud(ctx, x, y, r) {
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x + 1.5, y + 2.5, r, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r); g.addColorStop(0, BRASS[0]); g.addColorStop(0.55, BRASS[1]); g.addColorStop(1, BRASS[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.25, 0, TAU); ctx.fill(); ctx.restore();
}
// chain-carved border: a row of linked rings, like the carving on Zanzibar doors
function chain(ctx, x0, y0, x1, y1) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.round(len / 22), ux = (x1 - x0) / len, uy = (y1 - y0) / len, a = Math.atan2(uy, ux);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.translate(0.8, 1.2); ctx.strokeStyle = 'rgba(255,214,150,0.4)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(0, 0, 9.5, 5.2, 0, 0, TAU); ctx.stroke(); ctx.translate(-0.8, -1.2);
    ctx.strokeStyle = 'rgba(15,6,0,0.78)'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.ellipse(0, 0, 9.5, 5.2, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}
function carve(ctx, path, x, y, w, h, WD, k) {
  ctx.save(); path(ctx); ctx.shadowColor = 'rgba(255,214,150,0.5)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3.5;
  ctx.fillStyle = 'rgba(255,224,170,0.5)'; ctx.fill(); ctx.restore();
  ctx.save(); path(ctx); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w * 0.8, y + h * 0.95);
  g.addColorStop(0, '#150a04'); g.addColorStop(0.35, '#2e170a'); g.addColorStop(0.8, '#4d2c14'); g.addColorStop(1, '#6a4120');
  ctx.fillStyle = g; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  const cg = ctx.createRadialGradient(x + w * 0.56, y + h * 0.58, 2, x + w / 2, y + h / 2, Math.max(w, h) * 0.55);
  cg.addColorStop(0, `rgba(110,66,30,${0.5 * k})`); cg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = cg; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(20,8,2,0.30)'; ctx.lineWidth = 1.2;
  for (let n = 0; n < (w > 200 ? 5 : 3); n++) { ctx.beginPath(); ctx.ellipse(x + w / 2 + 3, y + h / 2 + 3, Math.max(2, w / 2 - 6 - n * 5), Math.max(2, h / 2 - 6 - n * 5), 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
  ctx.save(); path(ctx); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,3,0,0.55)'; ctx.stroke(); ctx.restore();
}
function paintBoard(ctx, wood, g) {
  const WD = WOODS[wood] ?? WOODS.teak, F = g.FRAME, TRAY = g.TRAY, pitPos = (p, r) => pitLocal(p, r, g);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,12,0.7)'; ctx.shadowBlur = 44; ctx.shadowOffsetX = 12; ctx.shadowOffsetY = 30;
  rr(ctx, F.x, F.y, F.w, F.h, 40); ctx.fillStyle = WD.b; ctx.fill(); ctx.restore();
  const fg = ctx.createLinearGradient(F.x, F.y, F.x + F.w, F.y + F.h); fg.addColorStop(0, WD.a); fg.addColorStop(0.5, WD.b); fg.addColorStop(1, WD.c);
  rr(ctx, F.x, F.y, F.w, F.h, 40); ctx.fillStyle = fg; ctx.fill();
  ctx.save(); rr(ctx, F.x, F.y, F.w, F.h, 40); ctx.clip();
  const rnd = lcg(31), [gr, gg, gb] = WD.grain;
  for (let k = 0; k < 330; k++) {
    const y0 = F.y + rnd() * F.h, amp = 2 + rnd() * 6, ph = rnd() * 6;
    ctx.strokeStyle = rnd() < 0.72 ? `rgba(${gr},${gg},${gb},${0.14 + rnd() * 0.26})` : `rgba(255,214,160,${0.03 + rnd() * 0.07})`;
    ctx.lineWidth = 0.6 + rnd() * 2.2; ctx.beginPath();
    for (let x = 0; x <= F.w; x += 24) { const y = y0 + Math.sin(x / 90 + ph) * amp + Math.sin(x / 31 + ph * 2) * 1.2; x ? ctx.lineTo(F.x + x, y) : ctx.moveTo(F.x + x, y); }
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = WD.hi; ctx.beginPath(); ctx.moveTo(F.x + 8, F.y + F.h - 46); ctx.arcTo(F.x + 2, F.y + 2, F.x + F.w - 60, F.y + 2, 40); ctx.lineTo(F.x + F.w - 50, F.y + 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.moveTo(F.x + F.w - 4, F.y + 56); ctx.arcTo(F.x + F.w - 2, F.y + F.h - 2, F.x + 60, F.y + F.h - 2, 40); ctx.lineTo(F.x + 60, F.y + F.h - 3); ctx.stroke();
  // chain-carved border and brass corner studs
  chain(ctx, F.x + 50, F.y + 16, F.x + F.w - 50, F.y + 16); chain(ctx, F.x + 50, F.y + F.h - 16, F.x + F.w - 50, F.y + F.h - 16);
  chain(ctx, F.x + 16, F.y + 50, F.x + 16, F.y + F.h - 50); chain(ctx, F.x + F.w - 16, F.y + 50, F.x + F.w - 16, F.y + F.h - 50);
  for (const [cx, cy] of [[F.x + 28, F.y + 28], [F.x + F.w - 28, F.y + 28], [F.x + 28, F.y + F.h - 28], [F.x + F.w - 28, F.y + F.h - 28]]) stud(ctx, cx, cy, 10);
  for (let i = 1; i < 6; i++) { stud(ctx, F.x + F.w * i / 6, F.y + 8, 3.4); stud(ctx, F.x + F.w * i / 6, F.y + F.h - 8, 3.4); }
  // the recessed playing surface
  const px = F.x + 34, py = F.y + 32, pw = F.w - 68, ph = F.h - 64;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = -2; rr(ctx, px, py, pw, ph, 26); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  const sg = ctx.createLinearGradient(px, py, px + pw, py + ph); sg.addColorStop(0, WD.face[0]); sg.addColorStop(0.5, WD.face[1]); sg.addColorStop(1, WD.face[2]);
  rr(ctx, px, py, pw, ph, 26); ctx.fillStyle = sg; ctx.fill();
  ctx.save(); rr(ctx, px, py, pw, ph, 26); ctx.clip();
  const r2 = lcg(5);
  for (let k = 0; k < 110; k++) {
    const y0 = py + r2() * ph, amp = 1.5 + r2() * 4, ph2 = r2() * 6;
    ctx.strokeStyle = r2() < 0.7 ? `rgba(${gr},${gg},${gb},${0.05 + r2() * 0.1})` : `rgba(255,230,180,${0.04 + r2() * 0.06})`; ctx.lineWidth = 0.6 + r2() * 1.6; ctx.beginPath();
    for (let x = 0; x <= pw; x += 22) { const y = y0 + Math.sin(x / 80 + ph2) * amp; x ? ctx.lineTo(px + x, y) : ctx.moveTo(px + x, y); }
    ctx.stroke();
  }
  const ie = ctx.createLinearGradient(px, py, px + 60, py + 60); ie.addColorStop(0, 'rgba(0,0,0,0.38)'); ie.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = ie; ctx.fillRect(px, py, pw, ph);
  const sun = ctx.createRadialGradient(px + 90, py + 60, 20, px + 200, py + 200, 620); sun.addColorStop(0, 'rgba(255,225,160,0.3)'); sun.addColorStop(1, 'rgba(255,225,160,0)'); ctx.fillStyle = sun; ctx.fillRect(px, py, pw, ph);
  ctx.restore();
  // brass inlay down the middle (between the two fronts) with a row of small diamonds
  const my = (pitPos(0, 0).y + pitPos(1, 0).y) / 2;
  const bl = ctx.createLinearGradient(0, my - 3, 0, my + 3); bl.addColorStop(0, BRASS[0]); bl.addColorStop(0.5, BRASS[1]); bl.addColorStop(1, BRASS[2]);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px + 20, my - 2, pw - 40, 8); ctx.fillStyle = bl; ctx.fillRect(px + 20, my - 3, pw - 40, 5);
  for (let i = 0; i < 9; i++) { const x = px + 20 + (pw - 40) * (i + 0.5) / 9; ctx.fillStyle = BRASS[1]; ctx.beginPath(); ctx.moveTo(x, my - 10); ctx.lineTo(x + 8, my); ctx.lineTo(x, my + 10); ctx.lineTo(x - 8, my); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(40,18,2,0.7)'; ctx.lineWidth = 1.2; ctx.stroke(); }
  // stores
  for (const T of [TRAY.n, TRAY.s]) carve(ctx, (c) => rr(c, T.x, T.y, T.w, T.h, 38), T.x, T.y, T.w, T.h, WD, 0.9);
  // the 32 pits: round bowls, and the square nyumba (house) of each player with a brass rim
  for (let p = 0; p < 2; p++) for (let r = 0; r < 16; r++) {
    const q = pitPos(p, r);
    if (r === NYUMBA) {
      const s = PIT_R * 1.72;
      ctx.save(); ctx.strokeStyle = BRASS[1]; ctx.lineWidth = 4; rr(ctx, q.x - s / 2 - 3, q.y - s / 2 - 3, s + 6, s + 6, 15); ctx.stroke(); ctx.strokeStyle = 'rgba(255,240,190,0.5)'; ctx.lineWidth = 1.4; rr(ctx, q.x - s / 2 - 5, q.y - s / 2 - 5, s + 10, s + 10, 17); ctx.stroke(); ctx.restore();
      carve(ctx, (c) => rr(c, q.x - s / 2, q.y - s / 2, s, s, 12), q.x - s / 2, q.y - s / 2, s, s, WD, 1);
    } else carve(ctx, (c) => { c.beginPath(); c.arc(q.x, q.y, PIT_R, 0, TAU); }, q.x - PIT_R, q.y - PIT_R, PIT_R * 2, PIT_R * 2, WD, 1);
  }
}

// Layers are painted lazily, at most ONE per frame, so the first paint never stalls a phone: until a layer is ready the
// caller draws a flat stand-in (the table colour) and the real art appears a frame later.
const layers = {};
let baked = 0;
export function beginFrame() { baked = 0; }
export function artReady() { return [...Object.keys(layers)].some((k) => k.startsWith('table')) && Object.keys(layers).some((k) => k.startsWith('board_')); }
// paint one layer lazily (at most one per frame); `w x h` virtual units, baked at SS x
function layer(key, w, h, paint) {
  let L = layers[key];
  if (L === undefined) {
    if (baked >= 1) return null; baked++;
    const m = makeCanvas(Math.ceil(w * SS), Math.ceil(h * SS)); if (m) { m.x.scale(SS, SS); paint(m.x); L = m.c; } else L = null;
    layers[key] = L;
    const tk = Object.keys(layers).filter((k) => k.startsWith('table')); if (tk.length > 3) delete layers[tk[0]];   // a rotation leaves the old size behind
  }
  return L;
}
// the cloth fills the whole screen of the current layout `L` (any size); `calm` dims it
export function drawTable(ctx, L, calm = false) {
  const w = L.w, h = L.h, bd = L.border, key = `table_${w}x${h}_${bd.side}${bd.t}`;
  const t = layer(key, w, h, (c) => paintTable(c, w, h, bd));
  if (!t) { ctx.fillStyle = '#182a4a'; ctx.fillRect(0, 0, w, h); return; }
  ctx.drawImage(t, 0, 0, w, h);
  if (calm) { ctx.fillStyle = 'rgba(6,12,28,0.55)'; if (bd.side === 'tb') ctx.fillRect(0, bd.t + 10, w, h - 2 * bd.t - 20); else ctx.fillRect(bd.t + 10, 0, w - 2 * bd.t - 20, h); }
}
// the board for the current group shape, in group space (call inside the group transform). Margin M leaves room for the drop shadow.
const BM = 110;
export function drawBoard(ctx, wood = 'teak') {
  const g = geom(), F = g.FRAME;
  const b = layer(`board_${wood}_${g.name}`, F.w + 2 * BM, F.h + 2 * BM, (c) => { c.translate(BM - F.x, BM - F.y); paintBoard(c, wood, g); });
  if (b) ctx.drawImage(b, F.x - BM, F.y - BM, F.w + 2 * BM, F.h + 2 * BM);
}

// ---- seeds -------------------------------------------------------------------------------------------------------
const SEED_BOX = 40, SEED_SC = 3;
const TINTS = {
  mbono: [['#cfd6d3', '#7f8c8a', '#2f3a3a'], ['#c3ccc9', '#6f7d7e', '#26302f'], ['#b8c2c0', '#5f6e70', '#1f2828'], ['#d8d9d1', '#8a8f86', '#363b36']],
  amber: [['#ffe2a0', '#e0902c', '#6e3606'], ['#ffd27a', '#cf7a1c', '#5c2a04'], ['#ffeab8', '#e8a23a', '#7a3d08'], ['#ffc86a', '#c46a14', '#521f02']],
};
const sprites = {};
function paintSeed(set, v) {
  const m = makeCanvas(SEED_BOX * SEED_SC, SEED_BOX * SEED_SC); if (!m) return null;
  const c = m.x; c.scale(SEED_SC, SEED_SC); c.translate(SEED_BOX / 2, SEED_BOX / 2);
  c.fillStyle = 'rgba(15,4,0,0.34)'; c.beginPath(); c.ellipse(2.6, 4.2, set === 'cowries' ? 10.4 : 9, 6.2, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(15,4,0,0.22)'; c.beginPath(); c.ellipse(1.6, 3, 10.4, 7, 0, 0, TAU); c.fill();
  if (set === 'cowries') {
    const g = c.createRadialGradient(-3, -3, 1, 0, 0, 11); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.55, '#f1dcaa'); g.addColorStop(1, '#b9986a');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 9.8, 7.2, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(90,60,30,0.6)'; c.lineWidth = 0.8; c.stroke();
    c.strokeStyle = '#5a3a1c'; c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-6.2, 0.2 + (v % 2) * 0.4); c.quadraticCurveTo(0, -1.4, 6.2, 0.2); c.stroke();
    c.lineWidth = 0.9; for (let k = -5; k <= 5; k += 2.5) { c.beginPath(); c.moveTo(k, -0.9); c.lineTo(k, 1.9); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.ellipse(-3.4, -3.6, 3.2, 1.3, -0.4, 0, TAU); c.fill();
  } else {
    const T = TINTS[set][v % 4], g = c.createRadialGradient(-3, -3.4, 0.6, 0, 0, 10);
    g.addColorStop(0, T[0]); g.addColorStop(0.5, T[1]); g.addColorStop(1, T[2]);
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, set === 'mbono' ? 8.6 : 8.2, set === 'mbono' ? 8 : 8.2, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(15,4,0,0.45)'; c.lineWidth = 0.9; c.stroke();
    if (set === 'mbono') { c.fillStyle = 'rgba(40,52,52,0.28)'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(-3 + ((k * 5 + v * 3) % 7), -2 + ((k * 3 + v) % 6), 0.9, 0, TAU); c.fill(); } }
    c.fillStyle = 'rgba(255,252,240,0.9)'; c.beginPath(); c.ellipse(-3, -3.1, 2.8, 1.5, -0.6, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,240,200,0.25)'; c.beginPath(); c.ellipse(2.6, 3.2, 3.4, 1.1, -0.4, 0, TAU); c.fill();
  }
  return m.c;
}
export function drawSeed(ctx, set, v, x, y, rot = 0, s = 1) {
  const key = set + (v % 4);
  let sp = sprites[key];
  if (sp === undefined) sp = sprites[key] = paintSeed(set, v);
  if (!sp) { ctx.fillStyle = '#8a9692'; ctx.beginPath(); ctx.arc(x, y, 8 * s, 0, TAU); ctx.fill(); return; }
  const w = SEED_BOX * s;
  if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(sp, -w / 2, -w / 2, w, w); ctx.restore(); }
  else ctx.drawImage(sp, x - w / 2, y - w / 2, w, w);
}
// where seed k rests in a pit (stable: adding a seed never moves the others)
export function slot(pit, k, r = PIT_R) {
  if (k < 24) {
    const rad = Math.min(r - 11, 8 * Math.sqrt(k + 0.4)), a = k * 2.399963 + pit * 1.1;
    return { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.94, rot: ((k * 137 + pit * 53) % 360) * Math.PI / 180, v: (k * 5 + pit) % 4 };
  }
  const a = k * 2.399963 + pit, rad = 5 + ((k * 7) % 14);
  return { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.9 - (k - 24) * 0.7, rot: ((k * 91) % 360) * Math.PI / 180, v: (k * 3 + pit) % 4 };
}
