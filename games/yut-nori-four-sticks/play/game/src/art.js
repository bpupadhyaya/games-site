// The table: woven straw mat, indigo cloth binding, a hanji-paper board with the inked circle-and-cross track,
// a felt throwing pad and the two token trays. Painted ONCE into a cached layer (never per frame).
import { W, H, POINTS, BX0, BX1, BY0, BY1, PAD, TRAY, isBig } from './layout.js';

const TAU = Math.PI * 2;
const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

function paintMat(ctx) {
  const r = lcg(11);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8d6a3a'); g.addColorStop(0.5, '#b58f52'); g.addColorStop(1, '#8a6535');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // over-under weave of straw strands
  const cw = 20;
  for (let j = 0; j * cw < H + cw; j++) for (let i = 0; i * cw < W + cw; i++) {
    const x = i * cw, y = j * cw, over = (i + j) % 2 === 0, tone = r();
    const base = 168 + Math.floor(tone * 34);
    if (over) {                                           // a horizontal strand passes over
      const gg = ctx.createLinearGradient(0, y, 0, y + cw);
      gg.addColorStop(0, `rgb(${base + 22},${base - 8},${base - 64})`); gg.addColorStop(0.5, `rgb(${base + 6},${base - 20},${base - 78})`); gg.addColorStop(1, `rgb(${base - 38},${base - 58},${base - 100})`);
      ctx.fillStyle = gg; ctx.fillRect(x, y + 1, cw + 1, cw - 2);
      ctx.fillStyle = 'rgba(255,240,190,0.16)'; ctx.fillRect(x + 2, y + 4, cw - 5, 1.5);
    } else {
      const gg = ctx.createLinearGradient(x, 0, x + cw, 0);
      gg.addColorStop(0, `rgb(${base - 34},${base - 54},${base - 96})`); gg.addColorStop(0.5, `rgb(${base + 2},${base - 24},${base - 80})`); gg.addColorStop(1, `rgb(${base + 14},${base - 14},${base - 70})`);
      ctx.fillStyle = gg; ctx.fillRect(x + 1, y, cw - 2, cw + 1);
      ctx.fillStyle = 'rgba(255,240,190,0.12)'; ctx.fillRect(x + 4, y + 2, 1.5, cw - 5);
    }
  }
  // fine fibres
  ctx.lineWidth = 1;
  for (let k = 0; k < 900; k++) { const x = r() * W, y = r() * H, l = 10 + r() * 30, v = r() < 0.5; ctx.strokeStyle = r() < 0.5 ? 'rgba(255,235,170,0.10)' : 'rgba(60,35,10,0.10)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(v ? x : x + l, v ? y + l : y); ctx.stroke(); }
}

function paintBoard(ctx) {
  const r = lcg(29);
  // soft shadow of the board on the mat
  ctx.save(); ctx.shadowColor = 'rgba(30,14,0,0.6)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#1d2a4a'; rr(ctx, 26, 370, 668, 668, 26); ctx.fill(); ctx.restore();
  // indigo cloth binding with a stitched edge
  const cg = ctx.createLinearGradient(0, 370, 0, 1038); cg.addColorStop(0, '#2c3d6b'); cg.addColorStop(1, '#17223f');
  ctx.fillStyle = cg; rr(ctx, 26, 370, 668, 668, 26); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for (let k = 0; k < 160; k++) { const y = 372 + k * 4.2; ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(690, y); ctx.stroke(); }
  ctx.setLineDash([9, 7]); ctx.strokeStyle = 'rgba(232,206,150,0.55)'; ctx.lineWidth = 2; rr(ctx, 33, 377, 654, 654, 20); ctx.stroke(); ctx.setLineDash([]);
  // hanji paper
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
  const pg = ctx.createLinearGradient(50, 392, 670, 1016); pg.addColorStop(0, '#f6ecd2'); pg.addColorStop(0.5, '#efe1bf'); pg.addColorStop(1, '#e2d0a6');
  ctx.fillStyle = pg; rr(ctx, 46, 388, 628, 632, 10); ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, 46, 388, 628, 632, 10); ctx.clip();
  for (let k = 0; k < 1500; k++) {                         // paper fibres
    const x = 46 + r() * 628, y = 388 + r() * 632, a = r() * TAU, l = 6 + r() * 26;
    ctx.strokeStyle = r() < 0.55 ? 'rgba(255,255,245,0.55)' : 'rgba(150,110,50,0.14)'; ctx.lineWidth = 0.6 + r();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + r() * 4, y + Math.sin(a) * l * 0.5 + r() * 4, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  const vg = ctx.createRadialGradient(360, 692, 200, 360, 692, 460); vg.addColorStop(0, 'rgba(255,240,200,0)'); vg.addColorStop(1, 'rgba(120,80,30,0.28)');
  ctx.fillStyle = vg; ctx.fillRect(46, 388, 628, 632);
  ctx.restore();
  // an inked double rule inside the paper edge, with small corner curls
  ctx.strokeStyle = 'rgba(60,40,25,0.55)'; ctx.lineWidth = 1.5; rr(ctx, 56, 398, 608, 612, 6); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,40,25,0.3)'; ctx.lineWidth = 1; rr(ctx, 61, 403, 598, 602, 4); ctx.stroke();
  for (const [cx, cy, sx, sy] of [[76, 418, 1, 1], [644, 418, -1, 1], [76, 994, 1, -1], [644, 994, -1, -1]]) {
    ctx.strokeStyle = 'rgba(170,45,35,0.55)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let t = 0; t < 9; t += 0.2) { const rad = 2 + t * 1.5; ctx.lineTo(cx + sx * Math.cos(t) * rad, cy + sy * Math.sin(t) * rad); } ctx.stroke();
  }
}

// One brush stroke: two slightly different passes so the ink has body
function ink(ctx, pts, w, alpha = 0.92) {
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = `rgba(28,18,12,${pass ? alpha * 0.55 : alpha})`; ctx.lineWidth = pass ? w * 1.25 : w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x + (pass ? 0.8 : 0), p.y + (pass ? -0.6 : 0)) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  }
}

function paintTrack(ctx) {
  const P = POINTS;
  // the outer square and the two diagonals
  ink(ctx, [{ x: BX0, y: BY0 }, { x: BX1, y: BY0 }, { x: BX1, y: BY1 }, { x: BX0, y: BY1 }, { x: BX0, y: BY0 }], 9);
  ink(ctx, [P[5], P[15]], 8); ink(ctx, [P[10], P[0]], 8);
  // direction chevrons between points along the ring (the way tokens travel: up the right side first)
  ctx.fillStyle = 'rgba(150,40,30,0.75)';
  for (let i = 0; i < 20; i++) {
    const a = P[i], b = P[(i + 1) % 20], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -7); ctx.lineTo(-2, 0); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // the points
  for (let i = 0; i < 29; i++) {
    if (i === 0) continue;
    const p = P[i], big = isBig(i), R = big ? 30 : 17;
    ctx.save(); ctx.shadowColor = 'rgba(60,35,10,0.4)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#f2e6c6'; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(28,18,12,0.9)'; ctx.lineWidth = big ? 5 : 4; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.stroke();
    if (big) {
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, R - 8, 0, TAU); ctx.stroke();
      ctx.fillStyle = i === 22 ? 'rgba(178,44,34,0.9)' : 'rgba(178,44,34,0.78)'; ctx.beginPath(); ctx.arc(p.x, p.y, i === 22 ? 14 : 9, 0, TAU); ctx.fill();
      if (i === 22) { ctx.strokeStyle = 'rgba(178,44,34,0.8)'; ctx.lineWidth = 2; for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * 33, p.y + Math.sin(a) * 33); ctx.lineTo(p.x + Math.cos(a) * 39, p.y + Math.sin(a) * 39); ctx.stroke(); } }
    }
  }
  // the start / finish corner
  const s = P[0];
  ctx.save(); ctx.shadowColor = 'rgba(60,35,10,0.45)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#f2e6c6'; ctx.beginPath(); ctx.arc(s.x, s.y, 34, 0, TAU); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(28,18,12,0.92)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(s.x, s.y, 34, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(s.x, s.y, 25, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(30,60,120,0.85)'; ctx.beginPath(); ctx.arc(s.x, s.y, 12, 0, TAU); ctx.fill();
}

function paintPad(ctx) {
  const p = PAD;
  ctx.save(); ctx.shadowColor = 'rgba(20,8,0,0.55)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#5a3a1a'; rr(ctx, p.x - 12, p.y - 12, p.w + 24, p.h + 24, 30); ctx.fill(); ctx.restore();
  const wg = ctx.createLinearGradient(0, p.y - 12, 0, p.y + p.h + 12); wg.addColorStop(0, '#8b5a2b'); wg.addColorStop(1, '#4b2c12');
  ctx.fillStyle = wg; rr(ctx, p.x - 12, p.y - 12, p.w + 24, p.h + 24, 30); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,150,0.35)'; ctx.lineWidth = 2; rr(ctx, p.x - 11, p.y - 11, p.w + 22, p.h + 22, 29); ctx.stroke();
  // felt
  const fg = ctx.createRadialGradient(360, p.y + p.h * 0.45, 40, 360, p.y + p.h * 0.5, 420); fg.addColorStop(0, '#2b3f6e'); fg.addColorStop(1, '#131d3a');
  ctx.fillStyle = fg; rr(ctx, p.x, p.y, p.w, p.h, 22); ctx.fill();
  ctx.save(); rr(ctx, p.x, p.y, p.w, p.h, 22); ctx.clip();
  ctx.strokeStyle = 'rgba(200,215,255,0.06)'; ctx.lineWidth = 1.5;
  for (let k = -20; k < 40; k++) { ctx.beginPath(); ctx.moveTo(p.x + k * 34, p.y); ctx.lineTo(p.x + k * 34 + 264, p.y + 264); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x + k * 34 + 264, p.y); ctx.lineTo(p.x + k * 34, p.y + 264); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(230,200,140,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); rr(ctx, p.x + 10, p.y + 10, p.w - 20, p.h - 20, 16); ctx.stroke(); ctx.setLineDash([]);
}

function paintTrays(ctx) {
  for (const T of TRAY) {
    const a = T.wait(0), b = T.home(3);
    for (const [x0, x1] of [[a.x, T.wait(3).x], [T.home(0).x, b.x]]) {
      ctx.fillStyle = 'rgba(30,14,4,0.55)'; rr(ctx, x0 - 34, a.y - 32, x1 - x0 + 68, 64, 32); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,150,0.25)'; ctx.lineWidth = 1.5; rr(ctx, x0 - 34, a.y - 32, x1 - x0 + 68, 64, 32); ctx.stroke();
    }
    for (let k = 0; k < 4; k++) for (const p of [T.wait(k), T.home(k)]) {
      ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 3, 22, 19, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,160,0.22)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
}

export function paintStatic(ctx) {
  paintMat(ctx);
  const v = ctx.createRadialGradient(360, 700, 260, 360, 700, 1000); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,8,0,0.62)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  paintBoard(ctx); paintTrack(ctx); paintPad(ctx); paintTrays(ctx);
}

let layer, tried = false;
export function drawTable(ctx) {
  if (!tried) {
    tried = true;
    try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(W * 2, H * 2), l = c.getContext('2d'); l.scale(2, 2); paintStatic(l); layer = c; } } catch { layer = null; }
  }
  if (layer) ctx.drawImage(layer, 0, 0, W, H); else paintStatic(ctx);
}
