// Static art: the walnut table, the parqués board (cream surface, tinted arms, seguros, coloured home lanes, cárcel
// corners, the four-colour centre with its corona), the felt dice tray, plus the cached piece and dice sprites.
// Everything heavy is painted ONCE into an OffscreenCanvas layer; per frame it is only blitted.
import { W, H, BOARD, TRAY, CS, trackOffset, homeOffset, jailOffset, gridXY, rot } from './layout.js';
import { A, R, T, SAFE_J } from './rules.js';

export const SEAT = ['#f4c20d', '#2e6fd8', '#e0393e', '#22a45d'];
export const LIGHT = ['#ffe678', '#79aaf7', '#ff8a86', '#72d9a0'];
export const DARK = ['#9a7200', '#16397f', '#861820', '#0f5c32'];
export const INK = '#2a1b12';
const TAU = Math.PI * 2;

export function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
export function mix(hex, to, f) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = (s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// ---- shared little shapes -----------------------------------------------------------------------------------
export function star5(ctx, x, y, r, r2 = r * 0.42) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r2 : r; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  ctx.closePath();
}
// the emblem each seat wears on top of its pieces: disc, diamond, triangle, star
export function emblemPath(ctx, kind, x, y, s) {
  ctx.beginPath();
  if (kind === 0) ctx.arc(x, y, s, 0, TAU);
  else if (kind === 1) { ctx.moveTo(x, y - s * 1.15); ctx.lineTo(x + s * 0.95, y); ctx.lineTo(x, y + s * 1.15); ctx.lineTo(x - s * 0.95, y); ctx.closePath(); }
  else if (kind === 2) { ctx.moveTo(x, y - s * 1.1); ctx.lineTo(x + s * 1.05, y + s * 0.8); ctx.lineTo(x - s * 1.05, y + s * 0.8); ctx.closePath(); }
  else star5(ctx, x, y, s * 1.25);
}
export function crown(ctx, x, y, s, fill = '#f7d062', stroke = '#8a5a10') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-1, 0.6); ctx.lineTo(-1.1, -0.7); ctx.lineTo(-0.5, -0.1); ctx.lineTo(0, -0.95); ctx.lineTo(0.5, -0.1); ctx.lineTo(1.1, -0.7); ctx.lineTo(1, 0.6); ctx.closePath();
  const g = ctx.createLinearGradient(0, -1, 0, 0.7); g.addColorStop(0, '#fff2b0'); g.addColorStop(1, fill);
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 0.1; ctx.strokeStyle = stroke; ctx.stroke();
  for (const px of [-1.1, 0, 1.1]) { ctx.beginPath(); ctx.arc(px, px === 0 ? -0.95 : -0.7, 0.12, 0, TAU); ctx.fillStyle = '#e0393e'; ctx.fill(); }
  ctx.restore();
}
// a woven-textile style zigzag band along a rectangle's perimeter (triangles alternating the four seat colours)
function zigzag(ctx, x, y, w, h, tri, depth) {
  const cols = SEAT; let n = 0;
  const run = (x0, y0, dx, dy, len, nx, ny) => {
    const count = Math.max(1, Math.round(len / tri)), step = len / count;
    for (let k = 0; k < count; k++, n++) {
      const ax = x0 + dx * step * k, ay = y0 + dy * step * k, bx = ax + dx * step, by = ay + dy * step;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo((ax + bx) / 2 + nx * depth, (ay + by) / 2 + ny * depth); ctx.closePath();
      ctx.fillStyle = cols[n % 4]; ctx.fill();
    }
  };
  run(x, y, 1, 0, w, 0, 1); run(x + w, y, 0, 1, h, -1, 0); run(x + w, y + h, -1, 0, w, 0, -1); run(x, y + h, 0, -1, h, 1, 0);
}

// ---- table -----------------------------------------------------------------------------------------------------------
function paintFloor(ctx) {
  const r = lcg(7);
  ctx.fillStyle = '#1d0f08'; ctx.fillRect(0, 0, W, H);
  const pw = 104;
  for (let x = -20, k = 0; x < W; x += pw, k++) {
    const w = pw - (k % 3) * 8, rr0 = 62 + r() * 24, gg = 33 + r() * 12, bb = 18 + r() * 8;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, `rgb(${rr0 * 0.78},${gg * 0.78},${bb * 0.78})`); g.addColorStop(0.5, `rgb(${rr0},${gg},${bb})`); g.addColorStop(1, `rgb(${rr0 * 0.82},${gg * 0.82},${bb * 0.82})`);
    ctx.fillStyle = g; ctx.fillRect(x, 0, w, H);
    for (let n = 0; n < 30; n++) {
      const gx = x + 4 + r() * (w - 8), wob = (r() - 0.5) * 12;
      ctx.strokeStyle = r() < 0.6 ? 'rgba(18,7,2,0.2)' : 'rgba(200,130,70,0.08)'; ctx.lineWidth = 0.8 + r() * 1.2;
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.bezierCurveTo(gx + wob, H * 0.3, gx - wob, H * 0.65, gx + wob * 0.4, H); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x + w - 2, 0, 3, H);
    ctx.fillStyle = 'rgba(255,205,140,0.08)'; ctx.fillRect(x + w + 1, 0, 1.5, H);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  let g = ctx.createRadialGradient(W / 2, 560, 40, W / 2, 560, 900); g.addColorStop(0, 'rgba(255,170,80,0.30)'); g.addColorStop(0.5, 'rgba(220,120,40,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  g = ctx.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 1050); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ---- board ------------------------------------------------------------------------------------------------------------
const P = (x, y) => gridXY(x, y);

// one board square in its real style: kind = plain | salida | seguro | lane, a = seat colour index
export function paintCell(ctx, cx, cy, s, kind, a) {
  const fill = kind === 'lane' ? mix(SEAT[a], '#ffffff', 0.18) : kind === 'salida' ? SEAT[a] : kind === 'seguro' ? '#ffe9a6' : mix(SEAT[a], '#ffffff', 0.82);
  const stroke = kind === 'lane' || kind === 'salida' ? DARK[a] : kind === 'seguro' ? '#b58a22' : 'rgba(70,45,20,0.45)';
  rr(ctx, cx - s / 2 + 1.4, cy - s / 2 + 1.4, s - 2.8, s - 2.8, 6 * s / CS); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = stroke; ctx.stroke();
  if (kind === 'seguro') {
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.3, 0, TAU); ctx.fillStyle = '#e9b73a'; ctx.fill(); ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 1.5; ctx.stroke();
    star5(ctx, cx, cy, s * 0.2); ctx.fillStyle = '#fff6d0'; ctx.fill();
  } else if (kind === 'salida') {
    star5(ctx, cx, cy, s * 0.3); ctx.fillStyle = '#fffbe8'; ctx.fill(); ctx.strokeStyle = DARK[a]; ctx.lineWidth = 1.4; ctx.stroke();
  } else if (kind === 'lane') {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-a * Math.PI / 2 + Math.PI); ctx.beginPath(); ctx.moveTo(-s * 0.2, s * 0.1); ctx.lineTo(0, -s * 0.14); ctx.lineTo(s * 0.2, s * 0.1);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
}

function paintBoard(ctx) {
  const half = BOARD.S / 2, x0 = BOARD.cx - half, y0 = BOARD.cy - half, r = lcg(11);
  // frame
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 14;
  let g = ctx.createLinearGradient(x0, y0, x0 + BOARD.S, y0 + BOARD.S); g.addColorStop(0, '#8a5430'); g.addColorStop(0.5, '#5b3219'); g.addColorStop(1, '#3a1e0e');
  rr(ctx, x0 - 14, y0 - 14, BOARD.S + 28, BOARD.S + 28, 26); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(255,215,160,0.35)'; ctx.lineWidth = 2; rr(ctx, x0 - 12.5, y0 - 12.5, BOARD.S + 25, BOARD.S + 25, 25); ctx.stroke();
  // surface
  g = ctx.createLinearGradient(x0, y0, x0 + BOARD.S, y0 + BOARD.S); g.addColorStop(0, '#fff6dc'); g.addColorStop(1, '#efe0b8');
  rr(ctx, x0, y0, BOARD.S, BOARD.S, 14); ctx.fillStyle = g; ctx.fill();
  // textile band round the edge
  ctx.save(); rr(ctx, x0, y0, BOARD.S, BOARD.S, 14); ctx.clip();
  ctx.fillStyle = '#1b2742'; ctx.fillRect(x0, y0, BOARD.S, 16); ctx.fillRect(x0, y0 + BOARD.S - 16, BOARD.S, 16); ctx.fillRect(x0, y0, 16, BOARD.S); ctx.fillRect(x0 + BOARD.S - 16, y0, 16, BOARD.S);
  zigzag(ctx, x0 + 1, y0 + 1, BOARD.S - 2, BOARD.S - 2, 17, 13);
  ctx.restore();
  ctx.strokeStyle = '#f3dca0'; ctx.lineWidth = 2; ctx.strokeRect(x0 + 17.5, y0 + 17.5, BOARD.S - 35, BOARD.S - 35);

  // cárcel corners
  for (let a = 0; a < 4; a++) {
    const [ux, uy] = jailOffset(a), p = P(ux, uy), sz = CS * 5.7;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
    g = ctx.createLinearGradient(p.x - sz / 2, p.y - sz / 2, p.x + sz / 2, p.y + sz / 2); g.addColorStop(0, LIGHT[a]); g.addColorStop(1, SEAT[a]);
    rr(ctx, p.x - sz / 2, p.y - sz / 2, sz, sz, CS * 1.1); ctx.fillStyle = g; ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; rr(ctx, p.x - sz / 2 + 4, p.y - sz / 2 + 4, sz - 8, sz - 8, CS * 0.95); ctx.stroke();
    ctx.strokeStyle = DARK[a]; ctx.lineWidth = 2; rr(ctx, p.x - sz / 2, p.y - sz / 2, sz, sz, CS * 1.1); ctx.stroke();
    g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, sz * 0.6); g.addColorStop(0, mix(DARK[a], '#000000', 0.15)); g.addColorStop(1, DARK[a]);
    rr(ctx, p.x - sz * 0.42, p.y - sz * 0.42, sz * 0.84, sz * 0.84, CS * 0.75); ctx.fillStyle = g; ctx.fill();
    for (let k = 0; k < 4; k++) { const s = 1.2, o = [[-s, -s], [s, -s], [-s, s], [s, s]][k], q = P(ux + o[0], uy + o[1]); ctx.beginPath(); ctx.ellipse(q.x, q.y + 3, CS * 0.52, CS * 0.34, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  // the cells
  const cells = [];
  for (let t = 0; t < T; t++) { const [x, y] = trackOffset(t), a = Math.floor(t / A), j = t % A; cells.push({ x, y, a, kind: j === 9 ? 'salida' : SAFE_J.includes(j) ? 'seguro' : 'plain' }); }
  for (let a = 0; a < 4; a++) for (let row = 1; row <= R - 1; row++) { const [x, y] = homeOffset(a, row); cells.push({ x, y, a, kind: 'lane' }); }
  for (const c of cells) { const p = P(c.x, c.y); paintCell(ctx, p.x, p.y, CS, c.kind, c.a); }
  // centre
  const c0 = P(0, 0), ce = CS * 1.5;
  for (let a = 0; a < 4; a++) {
    const [x1, y1] = rot(-1.5, 1.5, a), [x2, y2] = rot(1.5, 1.5, a), p1 = P(x1, y1), p2 = P(x2, y2);
    g = ctx.createLinearGradient(c0.x, c0.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2); g.addColorStop(0, LIGHT[a]); g.addColorStop(1, SEAT[a]);
    ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5;
  for (let a = 0; a < 4; a++) { const [x1, y1] = rot(-1.5, 1.5, a), p1 = P(x1, y1); ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
  ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 3; ctx.strokeRect(c0.x - ce, c0.y - ce, ce * 2, ce * 2);
  ctx.beginPath(); ctx.arc(c0.x, c0.y, CS * 0.46, 0, TAU); ctx.fillStyle = '#fff7de'; ctx.fill(); ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 2.5; ctx.stroke();
  crown(ctx, c0.x, c0.y + 1, CS * 0.27);
  // paper sheen and fibres
  ctx.save(); rr(ctx, x0, y0, BOARD.S, BOARD.S, 14); ctx.clip();
  for (let n = 0; n < 900; n++) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,240,0.10)' : 'rgba(120,80,30,0.05)'; ctx.fillRect(x0 + r() * BOARD.S, y0 + r() * BOARD.S, 1.5, 1.5); }
  g = ctx.createLinearGradient(x0, y0, x0 + BOARD.S, y0 + BOARD.S); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(60,20,0,0.18)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, BOARD.S, BOARD.S); ctx.restore();
}

function paintTray(ctx) {
  const { x, y, w, h } = TRAY;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  let g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#7a4a28'); g.addColorStop(1, '#45240f');
  rr(ctx, x - 12, y - 12, w + 24, h + 24, 30); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(255,215,160,0.4)'; ctx.lineWidth = 2; rr(ctx, x - 10.5, y - 10.5, w + 21, h + 21, 29); ctx.stroke();
  g = ctx.createRadialGradient(x + w / 2, y + h / 2, 30, x + w / 2, y + h / 2, w * 0.6); g.addColorStop(0, '#2b8a5a'); g.addColorStop(1, '#0f4a30');
  rr(ctx, x, y, w, h, 20); ctx.fillStyle = g; ctx.fill();
  const r = lcg(5);
  ctx.save(); rr(ctx, x, y, w, h, 20); ctx.clip();
  for (let n = 0; n < 2200; n++) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,30,10,0.12)'; ctx.fillRect(x + r() * w, y + r() * h, 1.6, 1.6); }
  ctx.strokeStyle = 'rgba(255,230,160,0.35)'; ctx.lineWidth = 2; rr(ctx, x + 12, y + 12, w - 24, h - 24, 14); ctx.stroke();
  zigzag(ctx, x + 2, y + 2, w - 4, h - 4, 18, 8);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; rr(ctx, x, y, w, h, 20); ctx.stroke();
}

const layers = {};
function layer(key, paint, ss = 2) {
  key += `|${W}x${H}|${Math.round(BOARD.cx)},${Math.round(BOARD.cy)},${Math.round(BOARD.S)}|${Math.round(TRAY.x)},${Math.round(TRAY.y)},${Math.round(TRAY.w)},${Math.round(TRAY.h)}`;
  let L = layers[key];
  if (L === undefined) {
    L = null;
    for (const k of Object.keys(layers)) if (Object.keys(layers).length >= 4) delete layers[k]; // keep only the few most recent sizes
    try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(W * ss, H * ss), lc = c.getContext('2d'); lc.scale(ss, ss); paint(lc); L = c; } } catch { L = null; }
    layers[key] = L;
  }
  return L;
}
export function drawStatic(ctx, withTray = true) {
  const paint = (c) => { paintFloor(c); paintBoard(c); if (withTray) paintTray(c); };
  const L = layer(withTray ? 'board' : 'boardNoTray', paint);
  if (L) ctx.drawImage(L, 0, 0, W, H); else paint(ctx);
}
export function drawFloorOnly(ctx) {
  const L = layer('floor', paintFloor);
  if (L) ctx.drawImage(L, 0, 0, W, H); else paintFloor(ctx);
}

// a cream card with a woven zigzag border (every text screen)
export function drawPanel(ctx, x, y, w, h) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 12;
  rr(ctx, x, y, w, h, 24); ctx.fillStyle = '#1b2742'; ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, x, y, w, h, 24); ctx.clip(); zigzag(ctx, x + 1, y + 1, w - 2, h - 2, 18, 13); ctx.restore();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#fff6dc'); g.addColorStop(1, '#ecdcb0');
  rr(ctx, x + 16, y + 16, w - 32, h - 32, 12); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#c9a85a'; ctx.lineWidth = 2; rr(ctx, x + 16, y + 16, w - 32, h - 32, 12); ctx.stroke();
}

// ---- pieces (cached sprites) ----------------------------------------------------------------------------------
export const PIECE = { w: 46, h: 58, ax: 23, ay: 47 };
const SS = 3, cache = {};
function sprite(key, w, h, paint) {
  if (cache[key] !== undefined) return cache[key];
  let c = null;
  try { if (typeof OffscreenCanvas !== 'undefined') { const oc = new OffscreenCanvas(w * SS, h * SS), x = oc.getContext('2d'); x.scale(SS, SS); paint(x); c = oc; } } catch { c = null; }
  return (cache[key] = c);
}
function paintPiece(ctx, a) {
  const col = SEAT[a], lt = LIGHT[a], dk = DARK[a], bx = PIECE.ax, by = PIECE.ay, rx = 16, ry = 7, top = by - 24, bot = by - 4;
  const body = ctx.createLinearGradient(bx - rx, 0, bx + rx, 0); body.addColorStop(0, dk); body.addColorStop(0.25, lt); body.addColorStop(0.5, col); body.addColorStop(0.85, dk); body.addColorStop(1, mix(dk, '#000000', 0.4));
  ctx.beginPath(); ctx.moveTo(bx - rx, top); ctx.lineTo(bx - rx, bot); ctx.ellipse(bx, bot, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(bx + rx, top); ctx.closePath(); ctx.fillStyle = body; ctx.fill();
  ctx.beginPath(); ctx.ellipse(bx, (top + bot) / 2 + 1, rx, ry * 0.95, 0, 0.05 * Math.PI, 0.95 * Math.PI); ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(bx, (top + bot) / 2 + 2.2, rx, ry * 0.95, 0, 0.1 * Math.PI, 0.9 * Math.PI); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(bx, top, rx, ry, 0, 0, TAU); ctx.fillStyle = dk; ctx.fill();
  const cap = ctx.createRadialGradient(bx - 5, top - 3, 1, bx, top, rx); cap.addColorStop(0, '#ffffff'); cap.addColorStop(0.25, lt); cap.addColorStop(1, col);
  ctx.beginPath(); ctx.ellipse(bx, top - 0.8, rx - 0.6, ry - 0.3, 0, 0, TAU); ctx.fillStyle = cap; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.save(); ctx.translate(bx, top - 0.8); ctx.scale(1, 0.47); emblemPath(ctx, a, 0, 0, 7.4); ctx.fillStyle = 'rgba(255,255,255,0.93)'; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = dk; ctx.stroke(); ctx.restore();
  ctx.beginPath(); ctx.ellipse(bx - 9, (top + bot) / 2, 1.8, 6, 0.05, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
}
// draw a piece standing at (x, y) (its foot), scale k, optional lift (pixels) and a soft shadow
export function drawPiece(ctx, arm, x, y, k = 1, lift = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = 0.36 * alpha; ctx.fillStyle = '#140a04';
  ctx.beginPath(); ctx.ellipse(x + 2, y + 2, 17 * k * (1 - lift * 0.004), 6.5 * k, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = alpha;
  const sp = sprite('piece' + arm, PIECE.w, PIECE.h, (c) => paintPiece(c, arm)), dx = x - PIECE.ax * k, dy = y - lift - PIECE.ay * k;
  if (sp) ctx.drawImage(sp, dx, dy, PIECE.w * k, PIECE.h * k);
  else { ctx.translate(dx, dy); ctx.scale(k, k); paintPiece(ctx, arm); }
  ctx.restore();
}

// ---- dice ---------------------------------------------------------------------------------------------------------------
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
export function drawDie(ctx, x, y, rotA, face, z = 0, k = 1, o = {}) {
  const s = 78 * k, { glow = 0, used = false } = o;
  ctx.save();
  ctx.globalAlpha = (used ? 0.18 : 0.38) / (1 + z * 0.02); ctx.fillStyle = '#031a0e'; rr(ctx, x - s / 2 + 7 + z * 0.2, y - s / 2 + 9 + z * 0.4, s, s, 15 * k); ctx.fill();
  ctx.globalAlpha = used ? 0.45 : 1; ctx.translate(x, y - z); ctx.rotate(rotA);
  if (glow > 0) { ctx.save(); ctx.shadowColor = '#ffd45a'; ctx.shadowBlur = 24 * glow; rr(ctx, -s / 2, -s / 2, s, s, 15 * k); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); }
  const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#f4ecd8'); g.addColorStop(1, '#cfc2a0');
  rr(ctx, -s / 2, -s / 2, s, s, 15 * k); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = glow > 0 ? '#ffd45a' : 'rgba(80,60,30,0.55)'; ctx.lineWidth = glow > 0 ? 4 : 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; rr(ctx, -s / 2 + 4, -s / 2 + 4, s - 8, s - 8, 12 * k); ctx.stroke();
  for (const [px, py] of PIPS[face] || []) {
    const cx = px * s * 0.25, cy = py * s * 0.25, rad = s * 0.075;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.fillStyle = face === 1 ? '#d02a2e' : '#1d2a44'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx - rad * 0.3, cy - rad * 0.3, rad * 0.35, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  }
  ctx.restore();
}
