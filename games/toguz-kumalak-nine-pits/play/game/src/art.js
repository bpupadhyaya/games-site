// Art: the felt table with its kilim and yurt-lattice bands, the carved board, and the pebble sprites. Everything here is
// painted ONCE into cached layers (OffscreenCanvas); per frame we only blit. One light: a warm lamp hanging above the board.
// The geometric bands, horn scrolls and lattice are decoration only.
import { W, H, RX, RY, FRAME, TRAY, MID_Y, pitPos } from './layout.js';

const TAU = Math.PI * 2, SS = 2;                      // layers are painted at 2x for crisp phones
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

export const WOODS = {
  walnut: { name: 'Walnut', a: '#5f3a22', b: '#472a18', c: '#2f1a0e', face: ['#8a5a34', '#a56f40', '#80502e'], grain: [30, 14, 6], hi: 'rgba(255,214,150,0.5)' },
  birch: { name: 'Pale birch', a: '#b98f5e', b: '#94704a', c: '#6d4d2c', face: ['#dcbc8e', '#efd3a4', '#d0af7e'], grain: [110, 74, 38], hi: 'rgba(255,240,200,0.6)' },
};
export const SEEDSETS = { stones: 'River stones', bone: 'Bone pieces', turquoise: 'Turquoise' };

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(w, h); return { c, x: c.getContext('2d') }; }
  return null;
}

// ---- decoration ---------------------------------------------------------------------------------------------
// a ram's-horn scroll (a double spiral), a classic steppe ornament; used only as decoration
export function horn(ctx, x, y, s, color, lw = 2, flip = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(flip, 1); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const side of [1, -1]) {
    ctx.save(); ctx.scale(side, 1); ctx.beginPath();
    const cx = s * 0.9, R0 = s * 0.9, turns = 2.1;
    for (let t = 0; t <= 1.0001; t += 0.04) {
      const r = R0 * (1 - t * 0.9), a = Math.PI - t * turns * TAU, px = cx + Math.cos(a) * r, py = -Math.sin(a) * r;
      t === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

// woven kilim band: a dark red ground, cream stepped medallions, ochre hooks, sawtooth edges (decoration only)
function kilim(ctx, y, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#5a1d18'); g.addColorStop(1, '#42130f');
  ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
  // sawtooth edges
  const tooth = (yy, dir) => { ctx.fillStyle = '#e6c98a'; for (let x = 0; x < W; x += 16) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + 8, yy + dir * 9); ctx.lineTo(x + 16, yy); ctx.closePath(); ctx.fill(); } };
  tooth(y + 7, 1); tooth(y + h - 7, -1);
  ctx.fillStyle = '#d29a3c'; ctx.fillRect(0, y + 4, W, 3); ctx.fillRect(0, y + h - 7, W, 3);
  const cy = y + h / 2, u = (h - 34) / 2;
  const dia = (r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill(); };
  for (let x = u + 10; x < W + u; x += u * 3.4) {
    ctx.save(); ctx.translate(x, cy);
    dia(u, '#1e2a4d'); dia(u * 0.86, '#ecd9b0'); dia(u * 0.62, '#b03a2a'); dia(u * 0.4, '#1e2a4d'); dia(u * 0.2, '#d29a3c');
    // stepped shoulders on the medallion
    ctx.fillStyle = '#d29a3c'; for (let s = 0; s < 3; s++) { ctx.fillRect(u * 1.02 + s * 4, -3 - s * 4, 4, 6 + s * 8); ctx.fillRect(-u * 1.02 - s * 4 - 4, -3 - s * 4, 4, 6 + s * 8); }
    ctx.restore();
    horn(ctx, x + u * 1.7, cy, u * 0.5, '#e6c98a', 2.2);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 3) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y + h - 2, W, 2);
}

// the folding lattice wall of a yurt (kerege): crossed wooden slats pinned together, over dark felt
function lattice(ctx, y, h) {
  ctx.fillStyle = '#1b120d'; ctx.fillRect(0, y, W, h);
  ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, h); ctx.clip();
  const step = 46, slat = (x0, y0, x1, y1) => {
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#100906'; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(x0, y0 + 2); ctx.lineTo(x1, y1 + 2); ctx.stroke();
    ctx.strokeStyle = '#6a4225'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#a86f3e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 - 1.5, y0 - 2); ctx.lineTo(x1 - 1.5, y1 - 2); ctx.stroke();
  };
  for (let a = -4; a < W / step + 4; a++) slat(a * step, y - 8, a * step + h + 16, y + h + 8);           // one way
  for (let b = 0; b < W / step + 6; b++) slat(b * step + h + 16, y - 8, b * step, y + h + 8);           // the other, over the first
  // hide-thong ties at the crossings
  for (let a = -4; a < W / step + 6; a++) for (let b = 0; b < W / step + 8; b++) {
    // slat A: x = a*step + t, y = (y-8) + t ; slat B: x = b*step + h + 16 - t2, y = (y-8) + t2  ->  t = (b*step + h + 16 - a*step) / 2
    const t = (b * step + h + 16 - a * step) / 2, cx = a * step + t, cy = y - 8 + t;
    if (cy > y + 6 && cy < y + h - 6 && cx > -6 && cx < W + 6) { ctx.fillStyle = '#e8d3a2'; ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(cx + 0.8, cy + 1, 1.4, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  ctx.fillStyle = '#4a2c18'; ctx.fillRect(0, y, W, 5); ctx.fillRect(0, y + h - 5, W, 5);
  ctx.fillStyle = 'rgba(255,214,150,0.35)'; ctx.fillRect(0, y + 5, W, 1.5);
}

// the smoke-ring crown of a yurt (shanyrak), painted on its own small layer for the title
function paintShanyrak(ctx, R) {
  ctx.translate(R, R); ctx.lineCap = 'round';
  const ring = (r, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); };
  ring(R - 10, 14, '#2a170b'); ring(R - 10, 9, '#8a5a34'); ring(R - 10, 2, '#c99460');
  ring(R * 0.42, 9, '#2a170b'); ring(R * 0.42, 6, '#7a4c2b');
  // two crossed pairs of struts, and short spokes with pinned ends
  for (let k = 0; k < 12; k++) {
    const a = k * TAU / 12; ctx.save(); ctx.rotate(a);
    ctx.strokeStyle = '#2a170b'; ctx.lineWidth = k % 3 === 0 ? 11 : 7; ctx.beginPath(); ctx.moveTo(R * 0.42, 0); ctx.lineTo(R - 12, 0); ctx.stroke();
    ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = k % 3 === 0 ? 7 : 4; ctx.beginPath(); ctx.moveTo(R * 0.42, 0); ctx.lineTo(R - 12, 0); ctx.stroke();
    ctx.fillStyle = '#e8d3a2'; ctx.beginPath(); ctx.arc(R * 0.72, 0, 3, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// ---- the felt table ----------------------------------------------------------------------------------------------
function paintTable(ctx) {
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2b3d68'); bg.addColorStop(0.5, '#26365e'); bg.addColorStop(1, '#1b2748');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // felt: short crossing wool fibres, with a slow irregular tint
  const rnd = lcg(11);
  for (let k = 0; k < 9000; k++) {
    const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI, l = 3 + rnd() * 7;
    ctx.strokeStyle = rnd() < 0.5 ? `rgba(190,205,240,${0.03 + rnd() * 0.05})` : `rgba(8,12,30,${0.05 + rnd() * 0.08})`; ctx.lineWidth = 0.8 + rnd() * 0.9;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  // a stitched appliqué border in ochre wool, running round the felt
  ctx.save(); ctx.strokeStyle = 'rgba(214,168,86,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([9, 7]);
  rr(ctx, 14, 108, W - 28, 1345, 26); ctx.stroke(); ctx.restore();
  kilim(ctx, 1468, 92);
  lattice(ctx, 0, 92);
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.fillRect(0, 92, W, 10); ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.fillRect(0, 1458, W, 10); ctx.restore();
  // lamplight from above the board, and a soft dark edge to the felt
  const lamp = ctx.createRadialGradient(360, 720, 60, 360, 720, 980); lamp.addColorStop(0, 'rgba(255,196,110,0.34)'); lamp.addColorStop(0.45, 'rgba(255,170,80,0.12)'); lamp.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 102, W, 1356);
  const vg = ctx.createRadialGradient(360, 780, 420, 360, 780, 1000); vg.addColorStop(0, 'rgba(4,6,18,0)'); vg.addColorStop(1, 'rgba(4,6,18,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 102, W, 1356);
}

// ---- the carved board -----------------------------------------------------------------------------------------------
function ellipsePath(x, y, rx, ry) { return (c) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); }; }

function paintBoard(ctx, wood) {
  const WD = WOODS[wood] ?? WOODS.walnut, F = FRAME;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,10,0.7)'; ctx.shadowBlur = 46; ctx.shadowOffsetX = 12; ctx.shadowOffsetY = 34;
  rr(ctx, F.x, F.y, F.w, F.h, 40); ctx.fillStyle = WD.b; ctx.fill(); ctx.restore();
  const fg = ctx.createLinearGradient(F.x, F.y, F.x + F.w, F.y + F.h); fg.addColorStop(0, WD.a); fg.addColorStop(0.5, WD.b); fg.addColorStop(1, WD.c);
  rr(ctx, F.x, F.y, F.w, F.h, 40); ctx.fillStyle = fg; ctx.fill();
  ctx.save(); rr(ctx, F.x, F.y, F.w, F.h, 40); ctx.clip();
  const rnd = lcg(21), [gr, gg, gb] = WD.grain;
  for (let k = 0; k < 360; k++) {
    const y0 = F.y + rnd() * F.h, amp = 2 + rnd() * 6, ph = rnd() * 6;
    ctx.strokeStyle = rnd() < 0.72 ? `rgba(${gr},${gg},${gb},${0.14 + rnd() * 0.26})` : `rgba(255,214,160,${0.03 + rnd() * 0.07})`;
    ctx.lineWidth = 0.6 + rnd() * 2.2; ctx.beginPath();
    for (let x = 0; x <= F.w; x += 24) { const y = y0 + Math.sin(x / 90 + ph) * amp + Math.sin(x / 31 + ph * 2) * 1.2; x ? ctx.lineTo(F.x + x, y) : ctx.moveTo(F.x + x, y); }
    ctx.stroke();
  }
  for (let k = 0; k < 120; k++) {
    const x = F.x + rnd() * F.w, y = F.y + rnd() * F.h, a = -0.5 + rnd() * 0.4, l = 8 + rnd() * 20;
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.13)' : 'rgba(255,220,170,0.10)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = WD.hi; ctx.beginPath(); ctx.moveTo(F.x + 8, F.y + F.h - 50); ctx.arcTo(F.x + 2, F.y + 2, F.x + F.w - 60, F.y + 2, 40); ctx.lineTo(F.x + F.w - 50, F.y + 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.moveTo(F.x + F.w - 4, F.y + 60); ctx.arcTo(F.x + F.w - 2, F.y + F.h - 2, F.x + 60, F.y + F.h - 2, 40); ctx.lineTo(F.x + 60, F.y + F.h - 3); ctx.stroke();
  // corner inlays: bone and madder diamonds (decoration)
  for (const [cx, cy] of [[F.x + 20, F.y + 20], [F.x + F.w - 20, F.y + 20], [F.x + 20, F.y + F.h - 20], [F.x + F.w - 20, F.y + F.h - 20]]) {
    ctx.save(); ctx.translate(cx, cy);
    const d = (r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill(); };
    d(11, 'rgba(15,6,2,0.7)'); d(9, '#ecd9b0'); d(5.5, '#a83a26'); d(2, '#ecd9b0'); ctx.restore();
  }
  // the recessed playing surface
  const px = F.x + 26, py = F.y + 26, pw = F.w - 52, ph = F.h - 52;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = -2; rr(ctx, px, py, pw, ph, 26); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  const sg = ctx.createLinearGradient(px, py, px + pw, py + ph); sg.addColorStop(0, WD.face[0]); sg.addColorStop(0.5, WD.face[1]); sg.addColorStop(1, WD.face[2]);
  rr(ctx, px, py, pw, ph, 26); ctx.fillStyle = sg; ctx.fill();
  ctx.save(); rr(ctx, px, py, pw, ph, 26); ctx.clip();
  const r2 = lcg(5);
  for (let k = 0; k < 130; k++) {
    const y0 = py + r2() * ph, amp = 1.5 + r2() * 4, ph2 = r2() * 6;
    ctx.strokeStyle = r2() < 0.7 ? `rgba(${gr},${gg},${gb},${0.05 + r2() * 0.1})` : `rgba(255,230,180,${0.04 + r2() * 0.06})`; ctx.lineWidth = 0.6 + r2() * 1.6; ctx.beginPath();
    for (let x = 0; x <= pw; x += 22) { const y = y0 + Math.sin(x / 80 + ph2) * amp; x ? ctx.lineTo(px + x, y) : ctx.moveTo(px + x, y); }
    ctx.stroke();
  }
  const ie = ctx.createLinearGradient(px, py, px + 60, py + 60); ie.addColorStop(0, 'rgba(0,0,0,0.38)'); ie.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ie; ctx.fillRect(px, py, pw, ph);
  const sun = ctx.createRadialGradient(360, MID_Y - 30, 20, 360, MID_Y - 30, 520); sun.addColorStop(0, 'rgba(255,215,140,0.32)'); sun.addColorStop(1, 'rgba(255,215,140,0)');
  ctx.fillStyle = sun; ctx.fillRect(px, py, pw, ph);
  ctx.restore();

  // the two kazans: carved troughs with brass studs round the rim
  for (const T of [TRAY.top, TRAY.bottom]) {
    carve(ctx, (c) => rr(c, T.x, T.y, T.w, T.h, 46), T.x, T.y, T.w, T.h, WD, 0.9);
    for (let x = T.x + 30; x <= T.x + T.w - 30; x += 22) for (const yy of [T.y + 7, T.y + T.h - 7]) stud(ctx, x, yy);
    for (let y = T.y + 30; y <= T.y + T.h - 30; y += 22) for (const xx of [T.x + 7, T.x + T.w - 7]) stud(ctx, xx, y);
  }
  // the eighteen pits: deep oval bowls with a lit lower rim
  for (let i = 0; i < 18; i++) { const p = pitPos(i); carve(ctx, ellipsePath(p.x, p.y, RX, RY), p.x - RX, p.y - RY, RX * 2, RY * 2, WD, 1); }
  // the middle strip: an inlay of bone with horn scrolls, between two carved flow arrows
  const sy = MID_Y - 17, sx = px + 26, sw = pw - 52;
  ctx.save(); rr(ctx, sx, sy, sw, 34, 12); ctx.fillStyle = 'rgba(20,8,2,0.55)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,214,150,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  rr(ctx, sx + 4, sy + 4, sw - 8, 26, 9); ctx.clip();
  const ig = ctx.createLinearGradient(0, sy, 0, sy + 34); ig.addColorStop(0, '#e9d7ad'); ig.addColorStop(1, '#c9b07c'); ctx.fillStyle = ig; ctx.fillRect(sx, sy, sw, 34);
  ctx.restore();
  for (let x = sx + 40; x < sx + sw - 20; x += 70) horn(ctx, x, MID_Y, 10, '#7a2a1c', 2.2);
  for (let x = sx + 75; x < sx + sw - 20; x += 70) { ctx.fillStyle = '#7a2a1c'; ctx.beginPath(); ctx.moveTo(x, MID_Y - 8); ctx.lineTo(x + 8, MID_Y); ctx.lineTo(x, MID_Y + 8); ctx.lineTo(x - 8, MID_Y); ctx.closePath(); ctx.fill(); }
  arrows(ctx, MID_Y - 40, -1); arrows(ctx, MID_Y + 40, 1);
}
function stud(ctx, x, y) {
  const g = ctx.createRadialGradient(x - 1, y - 1.2, 0.5, x, y, 4); g.addColorStop(0, '#ffe9a8'); g.addColorStop(0.6, '#c99a3a'); g.addColorStop(1, '#6b4a14');
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x + 0.8, y + 1.2, 3.6, 0, TAU); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, TAU); ctx.fill();
}

// A concave carved hollow: dark wall on the lit side, warm oiled highlight along the opposite lip.
function carve(ctx, path, x, y, w, h, WD, k) {
  ctx.save();
  path(ctx); ctx.shadowColor = 'rgba(255,214,150,0.55)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3.5;
  ctx.fillStyle = 'rgba(255,224,170,0.55)'; ctx.fill(); ctx.restore();
  ctx.save(); path(ctx); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w * 0.8, y + h * 0.95);
  g.addColorStop(0, '#1c0d05'); g.addColorStop(0.35, '#3d2010'); g.addColorStop(0.8, '#5e381c'); g.addColorStop(1, '#7c4f2a');
  ctx.fillStyle = g; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  const cg = ctx.createRadialGradient(x + w * 0.56, y + h * 0.58, 2, x + w / 2, y + h / 2, Math.max(w, h) * 0.55);
  cg.addColorStop(0, `rgba(120,72,34,${0.5 * k})`); cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(20,8,2,0.28)'; ctx.lineWidth = 1.2;
  const rings = w > 200 ? 5 : 3;
  for (let n = 0; n < rings; n++) { ctx.beginPath(); ctx.ellipse(x + w / 2 + 3, y + h / 2 + 3, Math.max(4, w / 2 - 7 - n * 5), Math.max(4, h / 2 - 7 - n * 5), 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
  ctx.save(); path(ctx); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,3,0,0.55)'; ctx.stroke(); ctx.restore();
}

function arrows(ctx, y, dir) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (let x = 190; x <= 530; x += 38) {
    const p = () => { ctx.beginPath(); ctx.moveTo(x - dir * 8, y - 8); ctx.lineTo(x + dir * 8, y); ctx.lineTo(x - dir * 8, y + 8); };
    p(); ctx.translate(0.8, 1.4); ctx.strokeStyle = 'rgba(255,224,170,0.4)'; ctx.lineWidth = 4; ctx.stroke(); ctx.translate(-0.8, -1.4);
    p(); ctx.strokeStyle = 'rgba(40,16,4,0.6)'; ctx.lineWidth = 3.2; ctx.stroke();
  }
  ctx.restore();
}

const layers = {};
function layer(key, paint, w = W, h = H) {
  let L = layers[key];
  if (L === undefined) { const m = makeCanvas(w * SS, h * SS); if (m) { m.x.scale(SS, SS); paint(m.x); L = m.c; } else L = null; layers[key] = L; }
  return L;
}
export function drawTable(ctx) {
  const t = layer('table', paintTable);
  if (!t) { ctx.fillStyle = '#26365e'; ctx.fillRect(0, 0, W, H); return; }
  ctx.drawImage(t, 0, 0, W, H);
}
export function drawBoard(ctx, wood = 'walnut') {
  const b = layer('board_' + wood, (c) => paintBoard(c, wood)); if (b) ctx.drawImage(b, 0, 0, W, H);
}
export function drawShanyrak(ctx, x, y, R, rot, alpha = 1) {
  const s = layer('shanyrak', (c) => paintShanyrak(c, 250), 500, 500);
  if (!s) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(s, -R, -R, R * 2, R * 2); ctx.restore();
}

// ---- pebbles -------------------------------------------------------------------------------------------------------
const SEED_BOX = 40, SEED_SC = 3;
const TINTS = {
  stones: [['#e4ddcb', '#a49c88', '#514b3f'], ['#d3bea0', '#95805e', '#453823'], ['#a9b2ae', '#66726f', '#2a3230'], ['#cf9a7c', '#93583e', '#40201a']],
  bone: [['#fff7e0', '#e3d0a2', '#8f7b52'], ['#fdf0d0', '#dcc593', '#84704a'], ['#f6e8c6', '#d4bb88', '#7b6743'], ['#fffaf0', '#e9d8ae', '#93805a']],
  turquoise: [['#9fe8dc', '#2fa79a', '#0f5450'], ['#8fdcf0', '#2a8fb0', '#0d4560'], ['#b6efd8', '#3fae8c', '#14574a'], ['#a5e4e6', '#3a9ea6', '#12525a']],
};
const sprites = {};
function paintSeed(set, v) {
  const m = makeCanvas(SEED_BOX * SEED_SC, SEED_BOX * SEED_SC); if (!m) return null;
  const c = m.x; c.scale(SEED_SC, SEED_SC); c.translate(SEED_BOX / 2, SEED_BOX / 2);
  const rot = (v % 4) * 0.55 - 0.7, rx = 9.6 + (v % 2) * 0.8, ry = 7.6 - (v % 3) * 0.4;
  c.fillStyle = 'rgba(15,4,0,0.34)'; c.beginPath(); c.ellipse(2.6, 4.2, rx, ry - 0.6, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(15,4,0,0.22)'; c.beginPath(); c.ellipse(1.6, 3, rx + 1.2, ry, 0, 0, TAU); c.fill();
  const T = TINTS[set][v % 4], g = c.createRadialGradient(-3, -3.4, 0.6, 0, 0, 10.5);
  g.addColorStop(0, T[0]); g.addColorStop(0.55, T[1]); g.addColorStop(1, T[2]);
  c.save(); c.rotate(rot); c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(15,4,0,0.45)'; c.lineWidth = 0.9; c.stroke();
  const r = lcg(v * 13 + set.length * 7);
  if (set === 'stones') { c.fillStyle = 'rgba(40,30,20,0.32)'; for (let k = 0; k < 9; k++) { c.beginPath(); c.arc((r() - 0.5) * rx * 1.4, (r() - 0.5) * ry * 1.3, 0.5 + r() * 0.5, 0, TAU); c.fill(); } if (v % 2) { c.strokeStyle = 'rgba(255,250,235,0.5)'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-rx * 0.8, ry * 0.15); c.quadraticCurveTo(0, -ry * 0.4, rx * 0.8, ry * 0.05); c.stroke(); } }
  if (set === 'bone') { c.strokeStyle = 'rgba(110,86,50,0.35)'; c.lineWidth = 0.7; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(-rx * 0.7, k * 2.2); c.quadraticCurveTo(0, k * 2.2 + 1.2, rx * 0.7, k * 2.2 - 0.4); c.stroke(); } }
  if (set === 'turquoise') { c.strokeStyle = 'rgba(20,50,50,0.5)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-rx * 0.6, -1); c.lineTo(-2, 1); c.lineTo(0.5, -1.5); c.lineTo(rx * 0.6, 1.5); c.stroke(); }
  c.restore();
  c.fillStyle = 'rgba(255,250,235,0.88)'; c.beginPath(); c.ellipse(-3.1, -3.2, 2.9, 1.5, -0.6, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,240,200,0.24)'; c.beginPath(); c.ellipse(2.6, 3.2, 3.4, 1.1, -0.4, 0, TAU); c.fill();
  return m.c;
}
export function drawSeed(ctx, set, v, x, y, rot = 0, s = 1) {
  const key = set + (v % 4);
  let sp = sprites[key];
  if (sp === undefined) sp = sprites[key] = paintSeed(set, v);
  if (!sp) { ctx.fillStyle = '#9a9384'; ctx.beginPath(); ctx.arc(x, y, 7 * s, 0, TAU); ctx.fill(); return; }
  const w = SEED_BOX * s;
  if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(sp, -w / 2, -w / 2, w, w); ctx.restore(); }
  else ctx.drawImage(sp, x - w / 2, y - w / 2, w, w);
}
// where pebble number k rests inside a pit (stable: adding a pebble never moves the others)
export function slot(pit, k, rx = RX - 8, ry = RY - 9) {
  const a = k * 2.399963 + pit * 1.1;
  if (k < 30) { const r = Math.sqrt((k + 0.6) / 30); return { x: Math.cos(a) * rx * r, y: Math.sin(a) * ry * r, rot: ((k * 137 + pit * 53) % 360) * Math.PI / 180, v: (k * 5 + pit) % 4 }; }
  const r = 0.25 + ((k * 7) % 10) / 14;
  return { x: Math.cos(a) * rx * r, y: Math.sin(a) * ry * r * 0.9 - (k - 30) * 0.9, rot: ((k * 91) % 360) * Math.PI / 180, v: (k * 3 + pit) % 4 };
}
