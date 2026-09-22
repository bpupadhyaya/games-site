// Static art: the wooden floor, the embroidered cloth cross-board (chaupar), the brass yards and the throwing rug.
// Painted ONCE into a cached layer (one per mode). One warm lamp light from the upper left.
import { geo } from './rules.js';
import { W, H, BOARD, MAT, cellSize, trackOffset, homeOffset, yardOffset, gridXY, rot } from './layout.js';

export const ARM_COLOURS = ['#b3202a', '#2e7d43', '#d9a21b', '#2a3b86'];
export const ARM_LIGHT = ['#e0525a', '#5fb072', '#f3cc59', '#6577c4'];
export const ARM_DARK = ['#6b1018', '#17492a', '#8a6209', '#141f4d'];
const TAU = Math.PI * 2;
const OCHRE = '#d59b34', CREAM = '#efdcae', RED = '#8e1b22';

export function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

export function mix(hex, to, f) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = (s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }

// the twelve corners of the cross, arm half-width l and extent e (in squares)
function crossPts(mode, l, e) {
  const q = [[-l, -e], [l, -e], [l, -l], [e, -l], [e, l], [l, l], [l, e], [-l, e], [-l, l], [-e, l], [-e, -l], [-l, -l]];
  return q.map(([x, y]) => { const p = gridXY(mode, x, y); return [p.x, p.y]; });
}

function paintFloor(ctx) {
  const r = lcg(7);
  ctx.fillStyle = '#26130a'; ctx.fillRect(0, 0, W, H);
  const pw = 96;
  for (let x = -20, k = 0; x < W; x += pw, k++) {
    const w = pw - (k % 3) * 6;
    const rr = 66 + r() * 22, gg = 36 + r() * 12, bb = 19 + r() * 8;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, `rgb(${rr * 0.8},${gg * 0.8},${bb * 0.8})`); g.addColorStop(0.5, `rgb(${rr},${gg},${bb})`); g.addColorStop(1, `rgb(${rr * 0.85},${gg * 0.85},${bb * 0.85})`);
    ctx.fillStyle = g; ctx.fillRect(x, 0, w, H);
    // grain
    for (let n = 0; n < 34; n++) {
      const gx = x + 4 + r() * (w - 8), wob = (r() - 0.5) * 10;
      ctx.strokeStyle = r() < 0.6 ? 'rgba(18,7,2,0.20)' : 'rgba(190,120,60,0.09)'; ctx.lineWidth = 0.8 + r() * 1.2;
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.bezierCurveTo(gx + wob, H * 0.3, gx - wob, H * 0.65, gx + wob * 0.4, H); ctx.stroke();
    }
    // knots
    for (let n = 0; n < 2; n++) { const kx = x + 12 + r() * (w - 24), ky = r() * H; for (let q = 3; q > 0; q--) { ctx.strokeStyle = `rgba(20,8,2,${0.16 * q / 3})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(kx, ky, 4 + q * 3, 9 + q * 6, 0, 0, TAU); ctx.stroke(); } }
    // seam
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + w - 2, 0, 3, H);
    ctx.fillStyle = 'rgba(255,205,140,0.09)'; ctx.fillRect(x + w + 1, 0, 1.5, H);
  }
  // lamp light
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  let g = ctx.createRadialGradient(90, 120, 20, 90, 120, 980); g.addColorStop(0, 'rgba(255,160,60,0.36)'); g.addColorStop(0.5, 'rgba(230,120,40,0.13)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(680, 1480, 10, 680, 1480, 780); g.addColorStop(0, 'rgba(255,150,50,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  g = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1000); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function star(ctx, x, y, s, col, lw) {
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
  ctx.fillStyle = col;
  for (const [dx, dy] of [[-s, -s], [s, -s], [-s, s], [s, s]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, lw * 0.9, 0, TAU); ctx.fill(); }
}

function paintBoard(ctx, mode) {
  const G = geo(mode), cs = cellSize(mode), R = G.R, r = lcg(11);
  const P = (x, y) => gridXY(mode, x, y);
  const outer = crossPts(mode, 2, R + 2), inner = crossPts(mode, 1.5, R + 1.5), mid = crossPts(mode, 1.75, R + 1.75);
  // fringe under the cloth
  for (let a = 0; a < 4; a++) for (let n = -22; n <= 22; n++) {
    const [ux, uy] = rot(n * 0.09, R + 2, a), [vx, vy] = rot(n * 0.09 + (r() - 0.5) * 0.06, R + 2.42 + r() * 0.08, a), p = P(ux, uy), q = P(vx, vy);
    ctx.strokeStyle = n % 2 ? OCHRE : '#a3282d'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  }
  // shadow + base
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 30; ctx.shadowOffsetX = 7; ctx.shadowOffsetY = 12;
  poly(ctx, outer); ctx.fillStyle = RED; ctx.fill(); ctx.restore();
  poly(ctx, inner); ctx.fillStyle = CREAM; ctx.fill();
  // beaded ochre stitch and cream line in the woven band
  ctx.save(); poly(ctx, mid); ctx.strokeStyle = OCHRE; ctx.lineWidth = cs * 0.2; ctx.lineCap = 'round'; ctx.setLineDash([0.02, cs * 0.34]); ctx.stroke(); ctx.setLineDash([]);
  poly(ctx, crossPts(mode, 1.92, R + 1.92)); ctx.strokeStyle = 'rgba(239,220,174,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
  poly(ctx, crossPts(mode, 1.58, R + 1.58)); ctx.strokeStyle = 'rgba(239,220,174,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();

  // the cells
  const cell = (x, y, fill) => { const p = P(x, y); ctx.fillStyle = fill; ctx.fillRect(p.x - cs / 2, p.y - cs / 2, cs, cs); };
  const stitch = (x, y) => { const p = P(x, y); ctx.strokeStyle = 'rgba(120,28,32,0.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(p.x - cs / 2, p.y - cs / 2, cs, cs); };
  const cells = [];
  for (let t = 0; t < G.T; t++) { const [x, y] = trackOffset(mode, t); cells.push({ x, y, t, kind: G.safe.has(t) ? ((t % G.A) === R + 1 ? 'start' : 'safe') : 'plain' }); }
  for (let a = 0; a < 4; a++) for (let row = 1; row <= R - 1; row++) { const [x, y] = homeOffset(mode, a, row); cells.push({ x, y, a, kind: 'home' }); }
  for (const c of cells) {
    const chk = ((Math.round(c.x) + Math.round(c.y)) & 1) ? '#f4e3b6' : '#e3c98f';
    if (c.kind === 'home') { cell(c.x, c.y, mix(ARM_COLOURS[c.a], '#efdcae', 0.55)); }
    else if (c.kind === 'start') cell(c.x, c.y, ARM_COLOURS[Math.floor(c.t / G.A)]);
    else if (c.kind === 'safe') cell(c.x, c.y, '#e6bd66');
    else cell(c.x, c.y, chk);
  }
  // centre block
  const c0 = P(0, 0), ce = cs * 1.5;
  for (let a = 0; a < 4; a++) {
    const [x1, y1] = rot(-1.5, 1.5, a), [x2, y2] = rot(1.5, 1.5, a), p1 = P(x1, y1), p2 = P(x2, y2);
    const g = ctx.createLinearGradient(c0.x, c0.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2); g.addColorStop(0, ARM_LIGHT[a]); g.addColorStop(1, ARM_COLOURS[a]);
    ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  }
  ctx.strokeStyle = 'rgba(250,225,160,0.9)'; ctx.lineWidth = 2;
  for (let a = 0; a < 4; a++) { const [x1, y1] = rot(-1.5, 1.5, a), p1 = P(x1, y1); ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
  ctx.strokeStyle = '#f0c56a'; ctx.lineWidth = 3; ctx.strokeRect(c0.x - ce, c0.y - ce, ce * 2, ce * 2);
  // rosette
  ctx.save(); ctx.translate(c0.x, c0.y);
  for (let k = 0; k < 8; k++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.ellipse(0, -cs * 0.5, cs * 0.14, cs * 0.3, 0, 0, TAU); ctx.fillStyle = k % 2 ? '#f6dc8e' : '#fff3cf'; ctx.fill(); ctx.strokeStyle = 'rgba(90,40,10,0.6)'; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, cs * 0.3, 0, TAU); ctx.fillStyle = '#c93b2e'; ctx.fill(); ctx.strokeStyle = '#f6dc8e'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, cs * 0.12, 0, TAU); ctx.fillStyle = '#f6dc8e'; ctx.fill(); ctx.restore();
  // stitches over the fills, then the X marks
  for (const c of cells) stitch(c.x, c.y);
  for (const c of cells) {
    const p = P(c.x, c.y);
    if (c.kind === 'safe') star(ctx, p.x, p.y, cs * 0.27, '#8e1b22', 2.2);
    if (c.kind === 'start') { star(ctx, p.x, p.y, cs * 0.24, '#fbe7b0', 2.2); }
  }
  // arm arrows (small chevrons in the middle lane, pointing to the centre)
  for (let a = 0; a < 4; a++) {
    const [x, y] = rot(0, R + 1, a), p = P(x, y);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-a * Math.PI / 2 + Math.PI); ctx.fillStyle = mix(ARM_COLOURS[a], '#000000', 0.15);
    ctx.beginPath(); ctx.moveTo(0, -cs * 0.28); ctx.lineTo(cs * 0.26, cs * 0.22); ctx.lineTo(0, cs * 0.08); ctx.lineTo(-cs * 0.26, cs * 0.22); ctx.closePath(); ctx.fillStyle = 'rgba(120,28,32,0.9)'; ctx.fill(); ctx.restore();
  }
  // weave texture and light, clipped to the cloth
  ctx.save(); poly(ctx, outer); ctx.clip();
  ctx.strokeStyle = 'rgba(60,20,10,0.045)'; ctx.lineWidth = 1;
  const x0 = BOARD.cx - BOARD.S / 2, y0 = BOARD.cy - BOARD.S / 2;
  for (let y = y0; y < y0 + BOARD.S; y += 2.5) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + BOARD.S, y); ctx.stroke(); }
  for (let x = x0; x < x0 + BOARD.S; x += 2.5) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + BOARD.S); ctx.stroke(); }
  for (let n = 0; n < 1600; n++) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,240,200,0.07)' : 'rgba(60,20,10,0.06)'; ctx.fillRect(x0 + r() * BOARD.S, y0 + r() * BOARD.S, 1.6, 1.6); }
  let g = ctx.createLinearGradient(x0, y0, x0 + BOARD.S, y0 + BOARD.S); g.addColorStop(0, 'rgba(255,220,150,0.20)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,8,0,0.30)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, BOARD.S, BOARD.S); ctx.restore();

  // the four brass yards
  for (let a = 0; a < 4; a++) {
    const [ux, uy] = yardOffset(mode, a), p = P(ux, uy), rad = (R / 2 - 0.5) * cs;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 9;
    let gg = ctx.createLinearGradient(p.x - rad, p.y - rad, p.x + rad, p.y + rad); gg.addColorStop(0, '#f6d98b'); gg.addColorStop(0.45, '#b98526'); gg.addColorStop(1, '#6e4a12');
    ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TAU); ctx.fillStyle = gg; ctx.fill(); ctx.restore();
    gg = ctx.createRadialGradient(p.x - rad * 0.25, p.y - rad * 0.3, rad * 0.05, p.x, p.y, rad * 0.86);
    gg.addColorStop(0, ARM_LIGHT[a]); gg.addColorStop(0.7, ARM_COLOURS[a]); gg.addColorStop(1, ARM_DARK[a]);
    ctx.beginPath(); ctx.arc(p.x, p.y, rad * 0.86, 0, TAU); ctx.fillStyle = gg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,160,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 0.9, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.setLineDash([3, 7]); ctx.beginPath(); ctx.arc(p.x, p.y, rad * 0.7, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    for (let k = 0; k < 4; k++) { const s = 1.15, o = [[-s, -s], [s, -s], [-s, s], [s, s]][k], q = P(ux + o[0], uy + o[1]); ctx.beginPath(); ctx.ellipse(q.x, q.y + 3, cs * 0.5, cs * 0.34, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,225,150,0.35)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 0.96, Math.PI * 1.05, Math.PI * 1.4); ctx.stroke();
  }
}

function paintMat(ctx) {
  const { x, y, w, h } = MAT, r = lcg(5);
  // fringe on the short ends
  for (const ex of [x, x + w]) for (let yy = y + 6; yy < y + h - 4; yy += 5) { const dir = ex === x ? -1 : 1; ctx.strokeStyle = (yy / 5 | 0) % 2 ? OCHRE : '#efdcae'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex, yy); ctx.lineTo(ex + dir * (14 + r() * 5), yy + (r() - 0.5) * 3); ctx.stroke(); }
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10; ctx.shadowOffsetX = 4;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fillStyle = '#7a1a20'; ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.clip();
  const bands = [[0, 18, RED], [18, 8, OCHRE], [26, 6, CREAM], [32, 30, '#a3282d'], [62, 5, OCHRE]];
  for (const [o, t, c] of bands) { ctx.fillStyle = c; ctx.fillRect(x, y + o, w, t); ctx.fillRect(x, y + h - o - t, w, t); }
  // side bands
  for (const [o, t, c] of bands) { ctx.fillStyle = c; ctx.fillRect(x + o, y, t, h); ctx.fillRect(x + w - o - t, y, t, h); }
  // field
  const fx = x + 72, fy = y + 72, fw = w - 144, fh = h - 144;
  let g = ctx.createRadialGradient(x + w / 2, y + h / 2, 20, x + w / 2, y + h / 2, w * 0.5); g.addColorStop(0, '#c04a3a'); g.addColorStop(1, '#8f2229');
  ctx.fillStyle = g; ctx.fillRect(fx, fy, fw, fh);
  // diamond lattice
  ctx.strokeStyle = 'rgba(245,205,120,0.30)'; ctx.lineWidth = 2;
  for (let k = -fh; k < fw; k += 44) { ctx.beginPath(); ctx.moveTo(fx + k, fy); ctx.lineTo(fx + k + fh, fy + fh); ctx.moveTo(fx + k + fh, fy); ctx.lineTo(fx + k, fy + fh); ctx.stroke(); }
  // border diamonds on the woven bands
  for (let k = x + 40; k < x + w - 30; k += 26) for (const yy of [y + 45, y + h - 45]) { ctx.beginPath(); ctx.moveTo(k, yy - 8); ctx.lineTo(k + 8, yy); ctx.lineTo(k, yy + 8); ctx.lineTo(k - 8, yy); ctx.closePath(); ctx.fillStyle = '#efdcae'; ctx.fill(); }
  ctx.strokeStyle = 'rgba(60,15,10,0.06)'; ctx.lineWidth = 1;
  for (let yy = y; yy < y + h; yy += 2.5) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
  g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, 'rgba(255,215,140,0.18)'); g.addColorStop(1, 'rgba(20,0,0,0.28)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
}

const layers = {};
export function drawStatic(ctx, mode) {
  let L = layers[mode];
  if (L === undefined) {
    L = null;
    const paint = (c) => { paintFloor(c); paintBoard(c, mode); paintMat(c); };
    try {
      if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(W * 2, H * 2), lc = c.getContext('2d'); lc.scale(2, 2); paint(lc); L = c; }
    } catch { L = null; }
    layers[mode] = L;
  }
  if (L) ctx.drawImage(L, 0, 0, W, H); else { paintFloor(ctx); paintBoard(ctx, mode); paintMat(ctx); }
}

let floorLayer;
export function drawFloorOnly(ctx) {
  if (floorLayer === undefined) {
    floorLayer = null;
    try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(W * 2, H * 2), lc = c.getContext('2d'); lc.scale(2, 2); paintFloor(lc); floorLayer = c; } } catch { floorLayer = null; }
  }
  if (floorLayer) ctx.drawImage(floorLayer, 0, 0, W, H); else paintFloor(ctx);
}

// a cream embroidered panel (used by every text screen)
export function drawPanel(ctx, x, y, w, h) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 12;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 22); ctx.fillStyle = RED; ctx.fill(); ctx.restore();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#f6e8c0'); g.addColorStop(1, '#e5cf9b');
  ctx.beginPath(); ctx.roundRect(x + 16, y + 16, w - 32, h - 32, 12); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 18); ctx.strokeStyle = OCHRE; ctx.lineWidth = 6; ctx.setLineDash([0.1, 14]); ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
  ctx.beginPath(); ctx.roundRect(x + 12, y + 12, w - 24, h - 24, 14); ctx.strokeStyle = 'rgba(239,220,174,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(x + 16, y + 16, w - 32, h - 32, 12); ctx.strokeStyle = 'rgba(142,27,34,0.85)'; ctx.lineWidth = 2; ctx.stroke();
}
