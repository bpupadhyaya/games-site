// The table and the inlaid board (static: painted once into a cached layer). One lamp, upper left.
// Materials: bitumen (the dark ground), lapis lazuli blue with gold flecks, shell, red limestone, gold.
// The rows of small wedges are a decorative pattern only: they are not writing.
import { W, H, CW, CH, X0, YB, YT, cellRect, isPlayable } from './layout.js';

const TAU = Math.PI * 2;
export const PAL = { lapis: ['#3a68c8', '#22449a', '#142b6b'], shell: ['#fbf3df', '#e9dab8', '#c9b48a'], red: ['#c4573a', '#9a3b26', '#6d2416'], gold: ['#fff0b8', '#e2b24a', '#8a5e16'], bit: ['#2b2117', '#17110b', '#0a0705'] };
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// One wedge: a small triangular head with a tail, the stroke a reed makes in wet clay. dir in radians.
function wedge(ctx, x, y, len, dir, wd) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(wd, -wd * 0.62); ctx.lineTo(wd, wd * 0.62); ctx.closePath(); ctx.fill();
  ctx.fillRect(wd - 0.5, -wd * 0.13, len - wd, wd * 0.26);
  ctx.restore();
}
// A band of wedge groups running along x from x0 to x1 (or y when vertical), seeded so it never changes.
export function wedgeBand(ctx, x0, y, x1, size, seed, color) {
  const rnd = lcg(seed); ctx.fillStyle = color;
  let x = x0;
  while (x < x1) {
    const n = 1 + Math.floor(rnd() * 3), kind = Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const gx = x + k * size * 0.62;
      if (kind === 0) wedge(ctx, gx, y - size * 0.5, size, Math.PI / 2, size * 0.3);
      else if (kind === 1) wedge(ctx, gx - size * 0.3, y, size * 0.9, 0, size * 0.3);
      else { wedge(ctx, gx, y - size * 0.55, size * 0.7, Math.PI / 2, size * 0.28); wedge(ctx, gx - size * 0.2, y + size * 0.25, size * 0.7, 0, size * 0.28); }
    }
    x += n * size * 0.62 + size * 0.8;
  }
}

function petal(ctx, ang, r0, r1, wd, fill) {
  ctx.save(); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(0, r0); ctx.quadraticCurveTo(wd, (r0 + r1) / 2, 0, r1); ctx.quadraticCurveTo(-wd, (r0 + r1) / 2, 0, r0); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
}
// An eight-petal rosette centred at (x, y), radius r. The central rosette is drawn richer.
export function rosette(ctx, x, y, r, rich = false, spin = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(1.5, 2.5, r * 1.02, 0, TAU); ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, g = ctx.createLinearGradient(0, 0, 0, r);
    const shell = i % 2 === 0;
    g.addColorStop(0, shell ? PAL.shell[0] : PAL.red[0]); g.addColorStop(1, shell ? PAL.shell[2] : PAL.red[2]);
    petal(ctx, a, r * 0.28, r, r * 0.34, g);
    ctx.strokeStyle = rich ? PAL.gold[1] : 'rgba(40,25,10,0.55)'; ctx.lineWidth = rich ? 2.4 : 1.4;
    ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, r * 0.28); ctx.quadraticCurveTo(r * 0.34, r * 0.64, 0, r); ctx.quadraticCurveTo(-r * 0.34, r * 0.64, 0, r * 0.28); ctx.stroke(); ctx.restore();
  }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + TAU / 16; ctx.fillStyle = PAL.lapis[2]; ctx.beginPath(); ctx.arc(Math.sin(a) * r * 0.5, Math.cos(a) * r * 0.5, r * 0.09, 0, TAU); ctx.fill(); }
  const c = ctx.createRadialGradient(-r * 0.08, -r * 0.1, 1, 0, 0, r * 0.3);
  c.addColorStop(0, PAL.gold[0]); c.addColorStop(0.5, PAL.gold[1]); c.addColorStop(1, PAL.gold[2]);
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, r * 0.27, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(80,45,5,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}

function lapisField(ctx, x, y, w, h, rnd) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, PAL.lapis[0]); g.addColorStop(0.55, PAL.lapis[1]); g.addColorStop(1, PAL.lapis[2]);
  ctx.fillStyle = g; rr(ctx, x, y, w, h, 9); ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, 9); ctx.clip();
  for (let k = 0; k < 26; k++) {                                     // pale veins and gold flecks of the stone
    ctx.fillStyle = `rgba(255,224,140,${0.25 + rnd() * 0.5})`; ctx.fillRect(x + rnd() * w, y + rnd() * h, 1.5 + rnd() * 1.8, 1.5 + rnd() * 1.8);
  }
  ctx.strokeStyle = 'rgba(190,215,255,0.14)'; ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + rnd() * w, y); ctx.bezierCurveTo(x + rnd() * w, y + h * 0.3, x + rnd() * w, y + h * 0.6, x + rnd() * w, y + h); ctx.stroke(); }
  ctx.restore();
}
function shellField(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, PAL.shell[0]); g.addColorStop(0.6, PAL.shell[1]); g.addColorStop(1, PAL.shell[2]);
  ctx.fillStyle = g; rr(ctx, x, y, w, h, 9); ctx.fill();
}
function redField(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, PAL.red[0]); g.addColorStop(0.6, PAL.red[1]); g.addColorStop(1, PAL.red[2]);
  ctx.fillStyle = g; rr(ctx, x, y, w, h, 9); ctx.fill();
}
const dot = (ctx, x, y, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke(); };

// One square. `kind` picks the inlay design; rosette squares are lapis with a rosette.
function tile(ctx, lane, c, rnd) {
  const R = cellRect(lane, c), x = R.x + 6, y = R.y + 6, w = R.w - 12, h = R.h - 12, cx = x + w / 2, cy = y + h / 2;
  const rosetteSq = (c === 0 && lane !== 1) || (c === 6 && lane !== 1) || (lane === 1 && c === 3);
  const central = lane === 1 && c === 3;
  const kind = rosetteSq ? 9 : (lane * 3 + c * 5) % 4;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(ctx, x - 1, y + 1, w + 3, h + 3, 10); ctx.fill();              // the inlay sits in a cut recess
  if (kind === 0) { lapisField(ctx, x, y, w, h, rnd); for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) dot(ctx, cx + sx * w * 0.34, cy + sy * h * 0.3, 7, PAL.shell[0]); dot(ctx, cx, cy, 11, PAL.gold[1]); dot(ctx, cx, cy, 5, PAL.red[1]); }
  else if (kind === 1) {
    shellField(ctx, x, y, w, h); ctx.save(); rr(ctx, x, y, w, h, 9); ctx.clip();
    ctx.fillStyle = PAL.red[1]; for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { ctx.beginPath(); ctx.moveTo(x + sx * w, y + sy * h); ctx.lineTo(x + sx * w + (sx ? -1 : 1) * w * 0.34, y + sy * h); ctx.lineTo(x + sx * w, y + sy * h + (sy ? -1 : 1) * h * 0.4); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = PAL.lapis[1]; ctx.beginPath(); ctx.moveTo(cx, cy - h * 0.26); ctx.lineTo(cx + w * 0.2, cy); ctx.lineTo(cx, cy + h * 0.26); ctx.lineTo(cx - w * 0.2, cy); ctx.closePath(); ctx.fill();
    dot(ctx, cx, cy, 7, PAL.gold[1]);
  } else if (kind === 2) {
    redField(ctx, x, y, w, h);
    ctx.fillStyle = PAL.shell[1]; ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.34, h * 0.24, 0, 0, TAU); ctx.fill();
    dot(ctx, cx, cy, h * 0.15, PAL.lapis[1]); dot(ctx, cx - 4, cy - 4, 4, PAL.shell[0]);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) dot(ctx, cx + sx * w * 0.4, cy + sy * h * 0.33, 5, PAL.gold[1]);
  } else if (kind === 3) {
    lapisField(ctx, x, y, w, h, rnd);
    ctx.strokeStyle = PAL.shell[1]; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx - w * 0.3, cy + k * h * 0.24 + h * 0.06); ctx.lineTo(cx, cy + k * h * 0.24 - h * 0.08); ctx.lineTo(cx + w * 0.3, cy + k * h * 0.24 + h * 0.06); ctx.stroke(); }
    dot(ctx, x + 16, y + 16, 5, PAL.gold[1]); dot(ctx, x + w - 16, y + h - 16, 5, PAL.gold[1]);
  } else {
    lapisField(ctx, x, y, w, h, rnd);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) dot(ctx, cx + sx * (w / 2 - 15), cy + sy * (h / 2 - 15), 5, PAL.gold[1]);
    rosette(ctx, cx, cy, central ? 54 : 46, central);
    if (central) { ctx.strokeStyle = PAL.gold[1]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 60, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
  // bevel: a bright upper-left edge, a shadow lower-right, and a fine gold keyline
  ctx.save(); ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,245,215,0.5)'; ctx.beginPath(); ctx.moveTo(x + 4, y + h - 6); ctx.lineTo(x + 4, y + 4); ctx.lineTo(x + w - 6, y + 4); ctx.stroke();
  ctx.strokeStyle = 'rgba(10,5,0,0.5)'; ctx.beginPath(); ctx.moveTo(x + w - 3, y + 6); ctx.lineTo(x + w - 3, y + h - 3); ctx.lineTo(x + 6, y + h - 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(226,178,74,0.75)'; ctx.lineWidth = 1.5; rr(ctx, x + 1, y + 1, w - 2, h - 2, 9); ctx.stroke();
  ctx.restore();
}

function paintTable(ctx) {
  // the table: bitumen-dark wood with a faint grain, and pooled lamp light
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1b130c'); bg.addColorStop(0.5, '#100b07'); bg.addColorStop(1, '#070504');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const rnd = lcg(4600);
  for (let n = 0; n < 160; n++) { ctx.strokeStyle = `rgba(${90 + Math.floor(rnd() * 60)},${60 + Math.floor(rnd() * 30)},30,${0.012 + rnd() * 0.026})`; ctx.lineWidth = 1 + rnd() * 2; const x = rnd() * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 30, H * 0.3, x - 30, H * 0.6, x + rnd() * 20 - 10, H); ctx.stroke(); }
  const lamp = ctx.createRadialGradient(600, 160, 30, 420, 560, 1100); lamp.addColorStop(0, 'rgba(255,190,100,0.26)'); lamp.addColorStop(0.5, 'rgba(255,170,80,0.08)'); lamp.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, H);
  // wedge friezes top and bottom
  wedgeBand(ctx, 10, 104, W - 10, 22, 11, 'rgba(226,178,74,0.30)');
  wedgeBand(ctx, 10, 1548, W - 10, 18, 29, 'rgba(226,178,74,0.22)');
}
function paintBoard(ctx) {

  // the board frame: two blocks and the bridge between them, in dark bitumen with a gold keyline
  const F = 16, bx0 = X0 - F, bx1 = X0 + 3 * CW + F;
  const shapes = [[bx0, YB - 4 * CH - F, bx1 - bx0, 4 * CH + 2 * F], [X0 + CW - F, YB - 6 * CH - F, CW + 2 * F, 2 * CH + 2 * F], [bx0, YT - F, bx1 - bx0, 2 * CH + 2 * F]];
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; for (const [x, y, w, h] of shapes) { rr(ctx, x - 8, y + 18, w, h, 22); ctx.fill(); }
  for (const [x, y, w, h] of shapes) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#5a4028'); g.addColorStop(0.5, '#33230f'); g.addColorStop(1, '#1b1207');
    ctx.fillStyle = g; rr(ctx, x, y, w, h, 20); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,150,0.5)'; ctx.lineWidth = 2; rr(ctx, x + 1, y + 1, w - 2, h - 2, 20); ctx.stroke();
    ctx.strokeStyle = 'rgba(226,178,74,0.55)'; ctx.lineWidth = 1.5; rr(ctx, x + 7, y + 7, w - 14, h - 14, 15); ctx.stroke();
  }
  // a wedge frieze along the outer edges of the two blocks
  ctx.save(); ctx.fillStyle = 'rgba(226,178,74,0.38)';
  for (const [x, y, w, h] of [shapes[0], shapes[2]]) { ctx.save(); ctx.beginPath(); ctx.rect(x + 8, y + 1, w - 16, 6); ctx.clip(); wedgeBand(ctx, x + 12, y + 8, x + w - 12, 7, 5 + Math.floor(y), 'rgba(226,178,74,0.38)'); ctx.restore(); }
  ctx.restore();
  // the 20 inlaid squares
  const trnd = lcg(2600);
  for (let lane = 0; lane < 3; lane++) for (let c = 0; c < 8; c++) if (isPlayable(lane, c)) tile(ctx, lane, c, trnd);
  // lamp light across the whole board, and the far corner falling into shade
  ctx.save(); ctx.beginPath(); for (const [x, y, w, h] of shapes) ctx.roundRect(x, y, w, h, 20); ctx.clip();
  const sheen = ctx.createRadialGradient(640, 330, 20, 560, 480, 760); sheen.addColorStop(0, 'rgba(255,225,160,0.20)'); sheen.addColorStop(1, 'rgba(255,225,160,0)');
  ctx.fillStyle = sheen; ctx.fillRect(0, 0, W, H);
  const shade = ctx.createLinearGradient(X0, YT, X0 + 3 * CW, YB); shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H); ctx.restore();
  // brass studs on the frame corners
  for (const [x, y] of [[bx0 + 8, YB + F - 9], [bx1 - 8, YB + F - 9], [bx0 + 8, YT - F + 9], [bx1 - 8, YT - F + 9]]) {
    const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 7); g.addColorStop(0, '#fff2c0'); g.addColorStop(1, '#8a5e16'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
  }
}

const layers = {};
function cached(key, paint) {
  if (!(key in layers)) {
    layers[key] = null;
    try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(W * 2, H * 2), lc = c.getContext('2d'); lc.scale(2, 2); paint(lc); layers[key] = c; } } catch { layers[key] = null; }
  }
  if (layers[key]) return (ctx) => ctx.drawImage(layers[key], 0, 0, W, H);
  return paint;
}
export function drawTableAndBoard(ctx, withBoard = true) {
  cached('table', paintTable)(ctx);
  if (withBoard) cached('board', paintBoard)(ctx);
}
