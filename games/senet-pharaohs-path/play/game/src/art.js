// The chamber and the board, painted ONCE into a cached layer (plaster wall, woven reed mat, ebony-and-ivory board with gilded inlay),
// plus cached sprites for the pieces and the throw sticks. All ornament is pure geometry: no writing, no figures.
// One light: a warm lamp from the upper left, so every bevel and highlight agrees.
import { W, H, CW, CH, BX, BY, cell, TRAY, EXIT } from './layout.js';

const TAU = Math.PI * 2;
export const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

// Make an offscreen bitmap and paint into it once. Returns null where OffscreenCanvas does not exist (headless tests draw nothing).
export function bitmap(w, h, scale, paint) {
  try {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const c = new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale)), x = c.getContext('2d');
    x.scale(scale, scale); paint(x); return c;
  } catch { return null; }
}
const GOLD = ['#fff0b0', '#e6b84a', '#a8761c'];
function goldGrad(c, y0, y1) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, GOLD[0]); g.addColorStop(0.45, GOLD[1]); g.addColorStop(1, GOLD[2]); return g; }

// ---------------------------------------------------------------------------------------------------------------------
// Wall and mat
// ---------------------------------------------------------------------------------------------------------------------
function paintWall(c) {
  const R = lcg(7);
  // painted plaster: warm sand, mottled, darker toward the edges
  const g = c.createLinearGradient(0, 0, 0, 340); g.addColorStop(0, '#b98a58'); g.addColorStop(0.5, '#d7b283'); g.addColorStop(1, '#a87b4c');
  c.fillStyle = g; c.fillRect(0, 0, W, 340);
  for (let i = 0; i < 260; i++) {
    const x = R() * W, y = R() * 340, r = 10 + R() * 46;
    c.fillStyle = R() < 0.5 ? `rgba(255,236,190,${0.05 + R() * 0.06})` : `rgba(96,58,28,${0.05 + R() * 0.07})`;
    c.beginPath(); c.ellipse(x, y, r, r * (0.4 + R() * 0.5), R() * 3, 0, TAU); c.fill();
  }
  c.strokeStyle = 'rgba(80,46,20,0.22)'; c.lineWidth = 1.2;                    // hairline cracks
  for (let k = 0; k < 7; k++) { let x = R() * W, y = R() * 300; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (R() - 0.5) * 34; y += 8 + R() * 16; c.lineTo(x, y); } c.stroke(); }
  // top frieze: a row of painted rectangles with rounded tops (blue, red, green, gold), between black-and-gold rules
  const rule = (y, h) => { c.fillStyle = '#231710'; c.fillRect(0, y, W, h); c.fillStyle = goldGrad(c, y, y + h); c.fillRect(0, y + h * 0.3, W, h * 0.4); };
  rule(12, 8);
  const cols = ['#1f5f9e', '#a3382a', '#2a8a7a', '#d8a736'];
  for (let i = 0, x = -6; x < W + 20; i++, x += 30) {
    c.fillStyle = cols[i % 4]; rr(c, x, 24, 22, 44, [11, 11, 2, 2]); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.20)'; rr(c, x + 3, 28, 5, 34, 3); c.fill();
    c.strokeStyle = 'rgba(30,16,8,0.7)'; c.lineWidth = 1.4; rr(c, x, 24, 22, 44, [11, 11, 2, 2]); c.stroke();
  }
  rule(74, 8);
  // lower band: a lattice of diamonds in the same four colours
  for (let i = 0, x = 0; x < W + 40; i++, x += 40) {
    c.save(); c.translate(x, 122);
    c.fillStyle = cols[i % 4]; c.beginPath(); c.moveTo(0, -20); c.lineTo(20, 0); c.lineTo(0, 20); c.lineTo(-20, 0); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,240,200,0.5)'; c.beginPath(); c.moveTo(0, -8); c.lineTo(8, 0); c.lineTo(0, 8); c.lineTo(-8, 0); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(30,16,8,0.65)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, -20); c.lineTo(20, 0); c.lineTo(0, 20); c.lineTo(-20, 0); c.closePath(); c.stroke();
    c.restore();
  }
  rule(154, 7);
  // dado: broad red field with a thin blue-and-white stripe above the table
  c.fillStyle = '#8f2f22'; c.fillRect(0, 168, W, 120);
  for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '255,200,150' : '40,10,6'},${0.03 + R() * 0.05})`; c.fillRect(R() * W, 168 + R() * 120, 20 + R() * 60, 2 + R() * 4); }
  c.strokeStyle = 'rgba(232,190,90,0.85)'; c.lineWidth = 3; c.lineJoin = 'miter';
  for (const y0 of [186, 268]) { c.beginPath(); for (let x = 0; x <= W; x += 24) c.lineTo(x, y0 + ((x / 24) % 2 ? 9 : -9)); c.stroke(); }
  for (let x = 12; x < W; x += 72) { c.fillStyle = 'rgba(30,16,8,0.35)'; c.fillRect(x, 208, 26, 42); c.fillStyle = 'rgba(232,190,90,0.6)'; c.fillRect(x + 8, 216, 10, 26); }
  c.fillStyle = '#231710'; c.fillRect(0, 288, W, 8); c.fillStyle = goldGrad(c, 288, 296); c.fillRect(0, 290, W, 3);
  for (let x = 0; x < W; x += 26) { c.fillStyle = (x / 26) % 2 ? '#1f5f9e' : '#f0e2bd'; c.fillRect(x, 300, 26, 12); }
  c.fillStyle = '#231710'; c.fillRect(0, 312, W, 5);
}
function paintMat(c) {
  const R = lcg(19);
  c.fillStyle = '#a97d43'; c.fillRect(0, 317, W, H - 317);
  // basket weave of reed strips, 15 px cells, alternate direction
  for (let gy = 0; gy * 15 + 317 < H; gy++) for (let gx = 0; gx * 15 < W; gx++) {
    const x = gx * 15, y = 317 + gy * 15, horiz = (gx + gy) % 2 === 0, t = R();
    const g = horiz ? c.createLinearGradient(0, y, 0, y + 15) : c.createLinearGradient(x, 0, x + 15, 0);
    const tone = 150 + t * 40;
    g.addColorStop(0, `rgb(${tone + 30},${tone - 10},${tone - 70})`); g.addColorStop(0.5, `rgb(${tone + 8},${tone - 32},${tone - 92})`); g.addColorStop(1, `rgb(${tone - 34},${tone - 62},${tone - 112})`);
    c.fillStyle = g; c.fillRect(x, y, 15, 15);
    c.strokeStyle = 'rgba(50,28,10,0.32)'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, 14, 14);
    c.strokeStyle = 'rgba(255,225,160,0.18)'; c.beginPath();
    if (horiz) { c.moveTo(x + 1, y + 5); c.lineTo(x + 14, y + 5); } else { c.moveTo(x + 5, y + 1); c.lineTo(x + 5, y + 14); }
    c.stroke();
  }
  // the ledge where the wall meets the table, with a soft shadow on the mat
  const sh = c.createLinearGradient(0, 317, 0, 380); sh.addColorStop(0, 'rgba(20,8,2,0.6)'); sh.addColorStop(1, 'rgba(20,8,2,0)');
  c.fillStyle = sh; c.fillRect(0, 317, W, 63);
}
const LAMPS = [[44, 800], [676, 800], [44, 1180], [676, 1180]];
function paintLamps(c) {
  for (const [x, y] of LAMPS) {
    c.fillStyle = 'rgba(20,8,0,0.5)'; c.beginPath(); c.ellipse(x + 5, y + 26, 28, 9, 0, 0, TAU); c.fill();
    const g = c.createLinearGradient(x - 20, 0, x + 20, 0); g.addColorStop(0, '#b9a37a'); g.addColorStop(0.4, '#f6ead0'); g.addColorStop(1, '#a58f66');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - 20, y + 24); c.lineTo(x - 7, y + 2); c.lineTo(x + 7, y + 2); c.lineTo(x + 20, y + 24); c.ellipse(x, y + 24, 20, 6, 0, 0, Math.PI); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(80,50,20,0.7)'; c.lineWidth = 1.5; c.stroke();
    c.beginPath(); c.ellipse(x, y - 4, 26, 12, 0, 0, Math.PI); c.lineTo(x - 26, y - 4); c.closePath(); c.fillStyle = g; c.fill(); c.stroke();
    c.beginPath(); c.ellipse(x, y - 4, 26, 8, 0, 0, TAU); c.fillStyle = '#f2e3bf'; c.fill(); c.stroke();
    c.beginPath(); c.ellipse(x, y - 4, 18, 5, 0, 0, TAU); c.fillStyle = '#5a3a14'; c.fill();
    c.strokeStyle = goldGrad(c, y - 10, y + 6); c.lineWidth = 2.2; c.beginPath(); c.ellipse(x, y - 4, 26, 8, 0, 0.1, Math.PI - 0.1); c.stroke();
  }
}
function paintVignette(c) {
  const v = c.createRadialGradient(W / 2, 800, 380, W / 2, 800, 1000); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,3,0,0.62)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------------------------------------------------
const goldStroke = (c, w) => { c.strokeStyle = goldGrad(c, 0, H); c.lineWidth = w; };
function rosette(c, x, y, r) {                        // eight petals and a boss, pure geometry
  c.save(); c.translate(x, y);
  for (let k = 0; k < 8; k++) { c.save(); c.rotate((k * TAU) / 8); c.beginPath(); c.moveTo(0, -r * 0.25); c.quadraticCurveTo(r * 0.45, -r * 0.65, 0, -r); c.quadraticCurveTo(-r * 0.45, -r * 0.65, 0, -r * 0.25); c.fillStyle = goldGrad(c, -r, 0); c.fill(); c.strokeStyle = 'rgba(60,34,8,0.7)'; c.lineWidth = 1; c.stroke(); c.restore(); }
  c.beginPath(); c.arc(0, 0, r * 0.26, 0, TAU); c.fillStyle = '#1f5f9e'; c.fill(); c.strokeStyle = GOLD[1]; c.lineWidth = 2; c.stroke();
  c.restore();
}
function diamond(c, x, y, r) {
  c.save(); c.translate(x, y); c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.75, 0); c.lineTo(0, r); c.lineTo(-r * 0.75, 0); c.closePath();
  c.fillStyle = goldGrad(c, -r, r); c.fill(); c.strokeStyle = 'rgba(60,34,8,0.75)'; c.lineWidth = 1.2; c.stroke();
  c.beginPath(); c.moveTo(0, -r * 0.5); c.lineTo(r * 0.38, 0); c.lineTo(0, r * 0.5); c.lineTo(-r * 0.38, 0); c.closePath(); c.fillStyle = '#a3382a'; c.fill(); c.restore();
}
function zigzag(c, x, y, w) {                        // three water-like zigzag lines
  for (let k = 0; k < 3; k++) { c.beginPath(); const yy = y - 14 + k * 14; c.moveTo(x - w / 2, yy); for (let j = 1; j <= 4; j++) c.lineTo(x - w / 2 + (w * j) / 4, yy + (j % 2 ? -5 : 5)); c.strokeStyle = '#1f5f9e'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); c.strokeStyle = 'rgba(200,235,255,0.55)'; c.lineWidth = 1.2; c.stroke(); }
}
function dots(c, x, y, n) {
  for (let k = 0; k < n; k++) { const yy = y + (k - (n - 1) / 2) * 20; const g = c.createRadialGradient(x - 3, yy - 3, 1, x, yy, 9); g.addColorStop(0, '#fff3bd'); g.addColorStop(0.5, '#e0b040'); g.addColorStop(1, '#8a5c14'); c.fillStyle = g; c.beginPath(); c.arc(x, yy, 8.5, 0, TAU); c.fill(); c.strokeStyle = 'rgba(50,28,6,0.8)'; c.lineWidth = 1; c.stroke(); }
}
function chevron(c, x, y, dir) {                     // a small gilded arrowhead in the groove; dir 0 down, 1 up, 2 right
  c.save(); c.translate(x, y); c.rotate(dir === 0 ? 0 : dir === 1 ? Math.PI : -Math.PI / 2);
  c.beginPath(); c.moveTo(-8, -3); c.lineTo(0, 4); c.lineTo(8, -3); c.lineTo(5, -4); c.lineTo(0, 1); c.lineTo(-5, -4); c.closePath();
  c.fillStyle = goldGrad(c, -6, 5); c.fill(); c.restore();
}

function paintBoard(c) {
  const bx = BX, by = BY, bw = CW * 3, bh = CH * 10, F = 26, R = lcg(3);
  // soft shadow on the mat
  c.save(); c.shadowColor = 'rgba(15,5,0,0.7)'; c.shadowBlur = 34; c.shadowOffsetX = 10; c.shadowOffsetY = 18;
  c.fillStyle = '#1a110b'; rr(c, bx - F, by - F, bw + 2 * F, bh + 2 * F + 20, 14); c.fill(); c.restore();
  // ebony frame with grain, an ivory-dash inlay and gilt lines
  const fg = c.createLinearGradient(bx - F, by - F, bx + bw + F, by + bh + F); fg.addColorStop(0, '#3a281c'); fg.addColorStop(0.5, '#1d130d'); fg.addColorStop(1, '#0f0906');
  c.fillStyle = fg; rr(c, bx - F, by - F, bw + 2 * F, bh + 2 * F + 20, 14); c.fill();
  c.save(); rr(c, bx - F, by - F, bw + 2 * F, bh + 2 * F + 20, 14); c.clip();
  for (let i = 0; i < 160; i++) { c.strokeStyle = `rgba(${R() < 0.5 ? '120,84,54' : '0,0,0'},${0.08 + R() * 0.12})`; c.lineWidth = 0.6 + R() * 1.2; const x = bx - F + R() * (bw + 2 * F); c.beginPath(); c.moveTo(x, by - F); c.bezierCurveTo(x + 6, by + bh * 0.3, x - 8, by + bh * 0.7, x + 3, by + bh + F + 20); c.stroke(); }
  c.restore();
  c.strokeStyle = 'rgba(255,225,180,0.3)'; c.lineWidth = 2; rr(c, bx - F + 1, by - F + 1, bw + 2 * F - 2, bh + 2 * F + 18, 13); c.stroke();      // upper-left bevel light
  goldStroke(c, 2.4); rr(c, bx - 9, by - 9, bw + 18, bh + 18, 6); c.stroke();
  // ivory dashes inlaid along the frame
  c.fillStyle = '#efe0bd';
  for (let x = bx - 6; x < bx + bw + 6; x += 24) { c.fillRect(x, by - 21, 14, 7); c.fillRect(x, by + bh + 14, 14, 7); }
  for (let y = by + 4; y < by + bh - 4; y += 24) { c.fillRect(bx - 21, y, 7, 14); c.fillRect(bx + bw + 14, y, 7, 14); }
  for (const [x, y] of [[bx - 15, by - 15], [bx + bw + 15, by - 15], [bx - 15, by + bh + 17], [bx + bw + 15, by + bh + 17]]) rosette(c, x, y, 13);
  // the playing field: a dark groove with an ivory tile for every square
  c.fillStyle = '#150d08'; c.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
  for (let i = 0; i < 30; i++) paintSquare(c, i, R);
  // arrows in the grooves show the way round
  for (let i = 0; i < 29; i++) {
    const a = cell(i), b = cell(i + 1);
    if (a.x === b.x) chevron(c, a.cx, (a.y + b.y) / 2 + CH / 2, b.y > a.y ? 0 : 1);
    else chevron(c, (a.x + b.x) / 2 + CW / 2, a.cy, 2);
  }
  // the exit slot under square 30
  const e = EXIT; const eg = c.createLinearGradient(0, e.y, 0, e.y + e.h); eg.addColorStop(0, '#2b1b10'); eg.addColorStop(1, '#0f0906');
  c.fillStyle = eg; rr(c, e.x, e.y - 8, e.w, e.h + 8, [0, 0, 14, 14]); c.fill(); goldStroke(c, 2); rr(c, e.x + 4, e.y - 4, e.w - 8, e.h + 0, [0, 0, 10, 10]); c.stroke();
  c.save(); c.translate(e.cx, e.cy - 2); c.beginPath(); c.moveTo(-22, -8); c.lineTo(22, -8); c.lineTo(0, 14); c.closePath(); c.fillStyle = goldGrad(c, -8, 14); c.fill(); c.restore();
}
function paintSquare(c, i, R) {
  const k = cell(i), x = k.x + 4, y = k.y + 4, w = k.w - 8, h = k.h - 8, alt = i % 2;
  const sq = i + 1, special = [14, 25, 26, 27, 28, 29].includes(i);
  c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
  const g = c.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, alt ? '#f6ead0' : '#f1e2c2'); g.addColorStop(1, alt ? '#dccb9f' : '#d2bf90');
  c.fillStyle = g; rr(c, x, y, w, h, 7); c.fill(); c.restore();
  c.save(); rr(c, x, y, w, h, 7); c.clip();
  for (let j = 0; j < 9; j++) { c.strokeStyle = `rgba(${R() < 0.5 ? '120,86,40' : '255,255,245'},${0.06 + R() * 0.1})`; c.lineWidth = 0.6 + R() * 0.9; const yy = y + R() * h; c.beginPath(); c.moveTo(x, yy); c.bezierCurveTo(x + w * 0.3, yy + (R() - 0.5) * 8, x + w * 0.7, yy + (R() - 0.5) * 8, x + w, yy + (R() - 0.5) * 5); c.stroke(); }
  if (special) {                                                       // a wash of colour behind the ornament
    const tint = i === 26 ? 'rgba(40,120,210,0.42)' : i === 14 || i === 25 ? 'rgba(230,180,70,0.22)' : 'rgba(210,150,60,0.16)';
    c.fillStyle = tint; c.fillRect(x, y, w, h);
  }
  c.restore();
  c.strokeStyle = 'rgba(255,255,245,0.65)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 7, y + 1); c.lineTo(x + w - 7, y + 1); c.stroke();   // lit top edge
  c.strokeStyle = 'rgba(90,60,25,0.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 7, y + h - 1); c.lineTo(x + w - 7, y + h - 1); c.stroke();
  // ornaments sit on both sides of the middle so a piece standing there never hides them
  const lx = k.cx - 58, rx = k.cx + 58, cy = k.cy;
  if (!special) { c.strokeStyle = 'rgba(70,44,20,0.28)'; c.lineWidth = 1.2; rr(c, x + 6, y + 6, w - 12, h - 12, 4); c.stroke(); for (const [px, py] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) { c.fillStyle = 'rgba(200,150,50,0.75)'; c.beginPath(); c.arc(px, py, 2, 0, TAU); c.fill(); } }
  if (special) { goldStroke(c, 2.2); rr(c, x + 3, y + 3, w - 6, h - 6, 5); c.stroke(); }
  if (i === 14 || i === 25) { const f = i === 14 ? rosette : diamond; f(c, lx, cy, i === 14 ? 24 : 21); f(c, rx, cy, i === 14 ? 24 : 21); }
  else if (i === 26) { zigzag(c, lx, cy, 40); zigzag(c, rx, cy, 40); }
  else if (i >= 27) { const n = 30 - i; dots(c, lx, cy, n); dots(c, rx, cy, n); }
  c.font = '600 15px system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.fillStyle = 'rgba(90,58,26,0.62)'; c.fillText(String(sq), x + 9, y + 20);
}

// ---------------------------------------------------------------------------------------------------------------------
// The stick tray
// ---------------------------------------------------------------------------------------------------------------------
function paintTray(c) {
  const t = TRAY, R = lcg(41);
  c.save(); c.shadowColor = 'rgba(10,3,0,0.7)'; c.shadowBlur = 22; c.shadowOffsetY = 10; c.fillStyle = '#1a110b'; rr(c, t.x, t.y, t.w, t.h, 22); c.fill(); c.restore();
  const g = c.createLinearGradient(0, t.y, 0, t.y + t.h); g.addColorStop(0, '#5b2418'); g.addColorStop(1, '#3a140d');
  c.fillStyle = g; rr(c, t.x + 6, t.y + 6, t.w - 12, t.h - 12, 18); c.fill();
  c.save(); rr(c, t.x + 6, t.y + 6, t.w - 12, t.h - 12, 18); c.clip();                            // dyed linen: fine crossed threads
  for (let x = t.x; x < t.x + t.w; x += 5) { c.fillStyle = `rgba(255,190,140,${0.03 + R() * 0.05})`; c.fillRect(x, t.y, 2, t.h); }
  for (let y = t.y; y < t.y + t.h; y += 5) { c.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.06})`; c.fillRect(t.x, y, t.w, 2); }
  const inner = c.createRadialGradient(t.x + t.w / 2, t.y + t.h / 2, 30, t.x + t.w / 2, t.y + t.h / 2, 330); inner.addColorStop(0, 'rgba(0,0,0,0)'); inner.addColorStop(1, 'rgba(0,0,0,0.5)');
  c.fillStyle = inner; c.fillRect(t.x, t.y, t.w, t.h); c.restore();
  goldStroke(c, 2.2); rr(c, t.x + 12, t.y + 12, t.w - 24, t.h - 24, 14); c.stroke();
  c.strokeStyle = 'rgba(255,225,180,0.35)'; c.lineWidth = 1.5; rr(c, t.x + 1, t.y + 1, t.w - 2, t.h - 2, 22); c.stroke();
}

let layers = null;
export function drawScene(ctx, t, calm = false) {
  if (!layers) layers = bitmap(W, H, 2, (c) => { paintWall(c); paintMat(c); paintLamps(c); paintBoard(c); paintTray(c); paintVignette(c); }) || 'none';
  if (layers === 'none') { ctx.fillStyle = '#5a3a20'; ctx.fillRect(0, 0, W, H); return; }
  ctx.drawImage(layers, 0, 0, W, H);
  lampLight(ctx, t, calm);
}
// Lamp: a warm pool of light that breathes; a few motes of dust drift through it. Drawn every frame (one gradient, cheap).
export function lampLight(ctx, t, calm = false) {
  const fl = calm ? 0.16 : 0.13 + 0.025 * Math.sin(t * 5.3) + 0.015 * Math.sin(t * 13.1 + 1) + 0.01 * Math.sin(t * 2.1);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(250, 260, 30, 330, 700, 900); g.addColorStop(0, `rgba(255,190,100,${fl * 1.5})`); g.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  for (const [i, [x, y]] of LAMPS.entries()) {                    // four small flames on the mat, each with its own flicker
    const f = calm ? 1 : 1 + 0.12 * Math.sin(t * 9 + i * 2) + 0.08 * Math.sin(t * 17 + i);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(x, y - 24, 2, x, y - 24, 90 * f); gl.addColorStop(0, 'rgba(255,190,90,0.22)'); gl.addColorStop(1, 'rgba(255,170,70,0)'); ctx.fillStyle = gl; ctx.fillRect(x - 100, y - 124, 200, 200);
    ctx.restore();
    ctx.save(); ctx.translate(x + (calm ? 0 : Math.sin(t * 7 + i) * 1.5), y - 8);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-9, -8, -5, -20 * f, 0, -30 * f); ctx.bezierCurveTo(5, -20 * f, 9, -8, 0, 0); ctx.fillStyle = '#ffb347'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-4, -5, -2, -11 * f, 0, -16 * f); ctx.bezierCurveTo(2, -11 * f, 4, -5, 0, 0); ctx.fillStyle = '#fff3c0'; ctx.fill(); ctx.restore();
  }
  if (!calm) for (let k = 0; k < 14; k++) {
    const ph = (t * 0.03 + k * 0.0713) % 1, x = (k * 173 + Math.sin(t * 0.4 + k) * 24 + ph * 60) % W, y = H - ph * H * 0.9;
    ctx.fillStyle = `rgba(255,230,170,${0.35 * Math.sin(ph * Math.PI)})`; ctx.beginPath(); ctx.arc(x, y, 1.4 + (k % 3) * 0.6, 0, TAU); ctx.fill();
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Pieces and sticks (sprites)
// ---------------------------------------------------------------------------------------------------------------------
// Sprite box: 70 x 92 virtual units, the base ellipse centre at (35, 74).
export const PBOX = { w: 70, h: 92, bx: 35, by: 74 };
function faience(c, top, mid, dark, speck) {
  const g = c.createLinearGradient(PBOX.bx - 26, 0, PBOX.bx + 26, 0); g.addColorStop(0, dark); g.addColorStop(0.28, top); g.addColorStop(0.55, mid); g.addColorStop(1, dark);
  return g;
}
function paintCone(c) {
  const { bx, by } = PBOX, R = lcg(5);
  const body = () => { c.beginPath(); c.moveTo(bx - 25, by); c.bezierCurveTo(bx - 24, by - 26, bx - 12, by - 52, bx - 4, by - 62); c.quadraticCurveTo(bx, by - 67, bx + 4, by - 62); c.bezierCurveTo(bx + 12, by - 52, bx + 24, by - 26, bx + 25, by); c.ellipse(bx, by, 25, 9, 0, 0, Math.PI); c.closePath(); };
  body(); c.fillStyle = faience(c, '#9cf0df', '#33b6a4', '#0d5c5a'); c.fill();
  c.save(); body(); c.clip();
  for (let i = 0; i < 90; i++) { c.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.13)' : 'rgba(0,50,60,0.16)'; c.beginPath(); c.arc(bx - 25 + R() * 50, by - 66 + R() * 76, 0.6 + R() * 1.1, 0, TAU); c.fill(); }
  for (const yy of [12, 27, 42]) {                                     // carved rings
    const w = 25 - (yy / 66) * 22; c.strokeStyle = 'rgba(6,60,62,0.75)'; c.lineWidth = 2.2; c.beginPath(); c.ellipse(bx, by - yy, w, w * 0.34, 0, 0.05, Math.PI - 0.05); c.stroke();
    c.strokeStyle = 'rgba(190,255,240,0.5)'; c.lineWidth = 1.3; c.beginPath(); c.ellipse(bx, by - yy + 2.4, w, w * 0.34, 0, 0.1, Math.PI - 0.1); c.stroke();
  }
  const gl = c.createLinearGradient(bx - 20, 0, bx - 5, 0); gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,255,0.75)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gl; c.beginPath(); c.moveTo(bx - 17, by - 6); c.quadraticCurveTo(bx - 14, by - 34, bx - 5, by - 55); c.lineTo(bx - 3, by - 54); c.quadraticCurveTo(bx - 10, by - 30, bx - 10, by - 6); c.fill();
  c.restore();
  c.strokeStyle = goldGrad(c, by - 12, by + 4); c.lineWidth = 3; c.beginPath(); c.ellipse(bx, by, 25, 9, 0, 0.02, Math.PI - 0.02); c.stroke();   // gilt foot ring
  c.strokeStyle = 'rgba(0,40,44,0.8)'; c.lineWidth = 1.4; body(); c.stroke();
}
function paintReel(c) {
  const { bx, by } = PBOX, R = lcg(9);
  const lap = ['#8fb0ff', '#2f56c4', '#0b1650'];
  const flange = (yTop, rx, h) => {                              // a drum: lit top, shaded side
    c.beginPath(); c.moveTo(bx - rx, yTop); c.lineTo(bx - rx, yTop + h); c.ellipse(bx, yTop + h, rx, rx * 0.36, 0, Math.PI, 0, true); c.lineTo(bx + rx, yTop); c.ellipse(bx, yTop, rx, rx * 0.36, 0, 0, TAU); c.closePath();
    c.fillStyle = faience(c, ...lap); c.fill(); c.strokeStyle = 'rgba(2,8,40,0.9)'; c.lineWidth = 1.4; c.stroke();
    c.strokeStyle = 'rgba(160,190,255,0.5)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(bx, yTop + h, rx - 1, (rx - 1) * 0.36, 0, 0.15, Math.PI - 0.15); c.stroke();
  };
  // waist (a slim cylinder between the flanges), then the foot flange, then the top flange over it
  c.beginPath(); c.moveTo(bx - 14, by - 46); c.lineTo(bx - 14, by - 14); c.ellipse(bx, by - 14, 14, 5, 0, Math.PI, 0, true); c.lineTo(bx + 14, by - 46); c.closePath();
  c.fillStyle = faience(c, '#a3bfff', '#3a62d0', '#0a1450'); c.fill(); c.strokeStyle = 'rgba(2,8,40,0.9)'; c.lineWidth = 1.4; c.stroke();
  c.strokeStyle = goldGrad(c, by - 40, by - 20); c.lineWidth = 2; c.beginPath(); c.ellipse(bx, by - 30, 14, 4.6, 0, 0.1, Math.PI - 0.1); c.stroke();
  flange(by - 20, 25, 20);
  flange(by - 66, 25, 22);
  const tg = c.createRadialGradient(bx - 9, by - 70, 2, bx, by - 66, 28); tg.addColorStop(0, '#c4d6ff'); tg.addColorStop(0.55, '#4468d4'); tg.addColorStop(1, '#18287a');
  c.beginPath(); c.ellipse(bx, by - 66, 25, 9, 0, 0, TAU); c.fillStyle = tg; c.fill();
  c.strokeStyle = goldGrad(c, by - 76, by - 56); c.lineWidth = 2.4; c.beginPath(); c.ellipse(bx, by - 66, 20, 7, 0, 0, TAU); c.stroke();
  c.strokeStyle = goldGrad(c, by - 20, by); c.lineWidth = 2.6; c.beginPath(); c.ellipse(bx, by, 24.5, 8.8, 0, 0.04, Math.PI - 0.04); c.stroke();
  c.save(); c.beginPath(); c.rect(bx - 26, by - 66, 52, 68); c.clip();
  for (let i = 0; i < 80; i++) { c.fillStyle = R() < 0.5 ? 'rgba(210,225,255,0.24)' : 'rgba(0,0,30,0.26)'; c.beginPath(); c.arc(bx - 24 + R() * 48, by - 62 + R() * 62, 0.6 + R() * 1, 0, TAU); c.fill(); }
  c.restore();
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(bx - 21, by - 60, 3, 16); c.fillRect(bx - 21, by - 14, 3, 12);
}
const sprites = {};
export function pieceSprite(kind) {
  if (!(kind in sprites)) sprites[kind] = bitmap(PBOX.w, PBOX.h, 3.5, kind === 1 ? paintCone : paintReel);
  return sprites[kind];
}
export function drawPiece(ctx, kind, x, y, o = {}) {           // (x, y) = centre of the piece's foot on the square
  const s = o.scale ?? 1, lift = o.lift ?? 0, sp = pieceSprite(kind);
  ctx.save();
  ctx.fillStyle = `rgba(20,8,0,${0.42 - Math.min(0.25, lift * 0.004)})`; ctx.beginPath(); ctx.ellipse(x + 6, y + 4, 26 * s * (1 - lift * 0.004), 8 * s, 0, 0, TAU); ctx.fill();
  if (o.glow) { const g = ctx.createRadialGradient(x, y - 26 * s, 6, x, y - 26 * s, 62 * s); g.addColorStop(0, o.glow + '0.55)'); g.addColorStop(1, o.glow + '0)'); ctx.fillStyle = g; ctx.fillRect(x - 70 * s, y - 100 * s, 140 * s, 140 * s); }
  if (o.dim) ctx.globalAlpha = 0.45;
  if (sp) ctx.drawImage(sp, x - PBOX.bx * s, y - lift - PBOX.by * s, PBOX.w * s, PBOX.h * s);
  ctx.restore();
}

// Sticks: a flat stave with a light (ivory) face and a dark (ebony) face.
const SBOX = { w: 150, h: 34 };
function paintStick(c, light) {
  const R = lcg(light ? 11 : 12);
  const g = c.createLinearGradient(0, 3, 0, 31);
  if (light) { g.addColorStop(0, '#fffaf0'); g.addColorStop(0.5, '#efe0bd'); g.addColorStop(1, '#c8b184'); } else { g.addColorStop(0, '#4a3226'); g.addColorStop(0.5, '#241610'); g.addColorStop(1, '#0d0806'); }
  c.fillStyle = g; rr(c, 3, 3, 144, 28, 14); c.fill();
  c.save(); rr(c, 3, 3, 144, 28, 14); c.clip();
  for (let i = 0; i < 14; i++) { c.strokeStyle = light ? `rgba(130,96,50,${0.10 + R() * 0.12})` : `rgba(160,120,90,${0.10 + R() * 0.12})`; c.lineWidth = 0.7; const y = 6 + R() * 22; c.beginPath(); c.moveTo(3, y); c.bezierCurveTo(50, y + (R() - 0.5) * 5, 100, y + (R() - 0.5) * 5, 147, y + (R() - 0.5) * 4); c.stroke(); }
  if (light) { c.fillStyle = 'rgba(212,160,60,0.9)'; for (const x of [30, 120]) c.fillRect(x, 3, 3, 28); }      // gilt bands
  else { c.fillStyle = 'rgba(232,200,120,0.85)'; for (const x of [30, 120]) c.fillRect(x, 3, 3, 28); for (let k = 0; k < 5; k++) c.fillRect(64 + k * 6, 14, 2, 6); }  // carved notches
  c.fillStyle = 'rgba(255,255,255,0.35)'; rr(c, 10, 6, 130, 5, 3); c.fill();
  c.restore();
  c.strokeStyle = light ? 'rgba(90,60,20,0.8)' : 'rgba(0,0,0,0.9)'; c.lineWidth = 1.4; rr(c, 3, 3, 144, 28, 14); c.stroke();
}
const sticks = {};
export function stickSprite(light) { const k = light ? 1 : 0; if (!(k in sticks)) sticks[k] = bitmap(SBOX.w, SBOX.h, 2, (c) => paintStick(c, light)); return sticks[k]; }
export const STICK = SBOX;
