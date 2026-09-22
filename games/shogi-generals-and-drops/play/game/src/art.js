// The table, the two piece stands (komadai) and the board (shogiban). Painted ONCE into cached layers.
// One light: a paper lantern above and slightly left of the board.
import { W, H, geom, STAND } from './layout.js';
import { JP } from './pieces.js';

const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

function paintTable(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1b1109'); g.addColorStop(0.45, '#2c1c10'); g.addColorStop(1, '#170e08');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // table grain (long soft strokes)
  const rnd = lcg(7);
  for (let i = 0; i < 140; i++) {
    const y = rnd() * H, x = rnd() * W - 100, len = 200 + rnd() * 520;
    ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '255,200,130' : '0,0,0'},${0.018 + rnd() * 0.035})`; ctx.lineWidth = 1 + rnd() * 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + len * 0.3, y + (rnd() - 0.5) * 10, x + len * 0.7, y + (rnd() - 0.5) * 10, x + len, y + (rnd() - 0.5) * 6); ctx.stroke();
  }
  // the lantern: a warm pool of light on the table
  const glow = ctx.createRadialGradient(330, 620, 40, 350, 700, 820);
  glow.addColorStop(0, 'rgba(255,196,120,0.30)'); glow.addColorStop(0.5, 'rgba(240,150,70,0.10)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(360, 760, 380, 360, 780, 1000);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
function paintStands(ctx) { for (const which of ['top', 'bot']) paintStand(ctx, STAND[which], which === 'top'); }

function paintStand(ctx, s, top) {
  // a low walnut tray with a recessed felt-less bed for the captured pieces
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = top ? -6 : 10;
  const wood = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  wood.addColorStop(0, '#7a5028'); wood.addColorStop(1, '#4b2e14');
  rrect(ctx, s.x, s.y, s.w, s.h, 18); ctx.fillStyle = wood; ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,214,150,0.35)'; ctx.lineWidth = 2; rrect(ctx, s.x + 1, s.y + 1, s.w - 2, s.h - 2, 18); ctx.stroke();
  const bed = ctx.createLinearGradient(0, s.y + 10, 0, s.y + s.h - 10);
  bed.addColorStop(0, '#2a180a'); bed.addColorStop(1, '#3d2411');
  rrect(ctx, s.x + 12, s.y + 12, s.w - 24, s.h - 24, 12); ctx.fillStyle = bed; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rrect(ctx, s.x + 12, s.y + 12, s.w - 24, s.h - 24, 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,205,140,0.18)'; ctx.lineWidth = 1.5; rrect(ctx, s.x + 13.5, s.y + s.h - 13.5 - 1, s.w - 27, 1, 1); ctx.stroke();
  // faint slots
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let i = 0; i < 7; i++) { const gap = (s.w - 60) / 7; ctx.beginPath(); ctx.ellipse(s.x + 30 + gap * (i + 0.5), s.y + s.h - 26, 28, 5, 0, 0, TAU); ctx.fill(); }
  // title on the tray
  ctx.save();
  ctx.translate(s.x + s.w - 34, s.y + s.h / 2); if (top) ctx.rotate(Math.PI);
  ctx.font = `700 22px ${JP}`; ctx.fillStyle = 'rgba(250,220,160,0.22)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('持駒', 0, 0);
  ctx.restore();
}

function paintBoard(ctx, g) {
  const { slab, gx, gy, gw, cell, n, thick } = g;
  // shadow on the table
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 26; ctx.shadowOffsetX = 6;
  rrect(ctx, slab.x, slab.y + 8, slab.w, slab.h + thick - 8, 12); ctx.fillStyle = '#6b4a22'; ctx.fill();
  ctx.restore();
  // the thick front and the sides (a solid block of kaya wood seen from above and in front)
  const front = ctx.createLinearGradient(0, slab.y + slab.h, 0, slab.y + slab.h + thick);
  front.addColorStop(0, '#c99a4c'); front.addColorStop(0.15, '#b98a3f'); front.addColorStop(1, '#6c4720');
  rrect(ctx, slab.x, slab.y + 6, slab.w, slab.h + thick - 6, 12); ctx.fillStyle = front; ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,4,0.6)'; ctx.lineWidth = 2; rrect(ctx, slab.x, slab.y + 6, slab.w, slab.h + thick - 6, 12); ctx.stroke();
  // front grain
  const r0 = lcg(31);
  ctx.save(); rrect(ctx, slab.x, slab.y + slab.h - 6, slab.w, thick + 6, 12); ctx.clip();
  for (let i = 0; i < 26; i++) { const y = slab.y + slab.h + r0() * thick; ctx.strokeStyle = `rgba(60,30,4,${0.1 + r0() * 0.15})`; ctx.lineWidth = 0.8 + r0() * 1.6; ctx.beginPath(); ctx.moveTo(slab.x, y); ctx.bezierCurveTo(slab.x + slab.w * 0.3, y + (r0() - 0.5) * 6, slab.x + slab.w * 0.7, y + (r0() - 0.5) * 6, slab.x + slab.w, y); ctx.stroke(); }
  ctx.restore();
  // the playing surface
  const top = ctx.createLinearGradient(slab.x, slab.y, slab.x + slab.w, slab.y + slab.h);
  top.addColorStop(0, '#f0cf82'); top.addColorStop(0.5, '#e6c072'); top.addColorStop(1, '#d8ac5c');
  rrect(ctx, slab.x, slab.y, slab.w, slab.h, 12); ctx.fillStyle = top; ctx.fill();
  ctx.save(); rrect(ctx, slab.x, slab.y, slab.w, slab.h, 12); ctx.clip();
  // grain: long wavy strokes along the board
  const rnd = lcg(19 + n);
  for (let i = 0; i < 90; i++) {
    const x = slab.x + rnd() * slab.w, wob = (rnd() - 0.5) * 34, dark = rnd() < 0.62;
    ctx.strokeStyle = dark ? `rgba(120,74,22,${0.05 + rnd() * 0.13})` : `rgba(255,240,200,${0.08 + rnd() * 0.12})`; ctx.lineWidth = 0.7 + rnd() * (dark ? 2.6 : 3.2);
    ctx.beginPath(); ctx.moveTo(x, slab.y); ctx.bezierCurveTo(x + wob, slab.y + slab.h * 0.3, x - wob * 1.4, slab.y + slab.h * 0.65, x + wob * 0.5, slab.y + slab.h); ctx.stroke();
  }
  // a few cathedral rings
  for (let k = 0; k < 2; k++) {
    const cxk = slab.x + slab.w * (0.25 + 0.5 * rnd()), cyk = slab.y + slab.h * (0.2 + 0.6 * rnd());
    for (let i = 1; i < 6; i++) { ctx.strokeStyle = `rgba(130,84,28,${0.05 + 0.02 * i})`; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.ellipse(cxk, cyk, 14 * i, 34 * i, 0, 0, TAU); ctx.stroke(); }
  }
  // lacquer sheen from the lantern
  const sheen = ctx.createRadialGradient(slab.x + slab.w * 0.35, slab.y + slab.h * 0.28, 20, slab.x + slab.w * 0.4, slab.y + slab.h * 0.4, slab.w * 0.8);
  sheen.addColorStop(0, 'rgba(255,248,220,0.30)'); sheen.addColorStop(1, 'rgba(255,248,220,0)');
  ctx.fillStyle = sheen; ctx.fillRect(slab.x, slab.y, slab.w, slab.h);
  ctx.restore();
  // edge bevel on the surface
  ctx.strokeStyle = 'rgba(255,240,200,0.7)'; ctx.lineWidth = 2; rrect(ctx, slab.x + 1, slab.y + 1, slab.w - 2, slab.h - 2, 11); ctx.stroke();
  ctx.strokeStyle = 'rgba(70,40,8,0.55)'; ctx.lineWidth = 2; rrect(ctx, slab.x, slab.y, slab.w, slab.h, 12); ctx.stroke();
  // grid: thin ink lines with a heavier border
  ctx.strokeStyle = 'rgba(40,24,6,0.88)'; ctx.lineCap = 'round';
  ctx.lineWidth = 1.7;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath(); ctx.moveTo(gx + i * cell, gy); ctx.lineTo(gx + i * cell, gy + gw); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, gy + i * cell); ctx.lineTo(gx + gw, gy + i * cell); ctx.stroke();
  }
  ctx.lineWidth = 3.2; ctx.strokeRect(gx, gy, gw, gw);
  // star points
  ctx.fillStyle = 'rgba(30,18,4,0.92)';
  const stars = n === 9 ? [[3, 3], [3, 6], [6, 3], [6, 6]] : [];
  for (const [r, c] of stars) { ctx.beginPath(); ctx.arc(gx + c * cell, gy + r * cell, 4.6, 0, TAU); ctx.fill(); }
}

const layers = {};
export function paintLayers(ctx, kind, arg, draw) {
  const key = kind + arg;
  let l = layers[key];
  if (l === undefined) {
    l = null;
    try {
      if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(W * 2, H * 2), lc = c.getContext('2d'); lc.scale(2, 2); draw(lc); l = c; }
    } catch { l = null; }
    layers[key] = l;
  }
  if (l) ctx.drawImage(l, 0, 0, W, H); else draw(ctx);
}
export const drawTable = (ctx) => paintLayers(ctx, 'table', '', paintTable);
export const drawStands = (ctx) => paintLayers(ctx, 'stands', '', paintStands);
export const drawBoard = (ctx, n) => paintLayers(ctx, 'board', n, (c) => paintBoard(c, geom(n)));
