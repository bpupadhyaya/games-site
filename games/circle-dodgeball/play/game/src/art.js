// Circle Dodgeball: all painting that is not interface. A painted circle seen from above and in front (oblique view): lit floors per
// venue, people with run cycles and throwing poses, a ball whose shadow tells its height. Pure canvas 2D, no DOM, no clock, no
// Math.random: everything depends only on its arguments (noise comes from `hash`).
import { CX, CY, R, RIM, ARENA } from './engine.js';

export const PAL = {
  ink: '#0b1220', night: '#111b33', navy: '#16264a', chalk: '#f7f3ea', gold: '#ffd23f', goldDark: '#b88a00', sun: '#ff8a1c', sunLight: '#ffb35c', sunDark: '#c85a00',
  moon: '#2f66ff', moonLight: '#86a8ff', moonDark: '#16379c', red: '#ff4d3a', text: '#fff8ec', dim: 'rgba(255,248,236,0.68)', good: '#5ad08a', bad: '#ff6b5a',
};
export const DISPLAY = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
export const UI = '"Barlow", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const TAU = Math.PI * 2;
export const TILT = 0.88;
export const FIG = 1.5;          // people are drawn a little larger than true scale so they read on a phone
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = (v) => clamp(Math.round(v * f), 0, 255); return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`; };

// ---- camera ----------------------------------------------------------------------------------------------------------------------------
// World x in [-10, 1010], y in [-30, 1030]; people stand on the ground and rise by up to ~100 units, so the top needs a margin.
const WX0 = -10, WX1 = 1010, WY0 = -30, WY1 = 1030, TOPPAD = 118;
let glAspect = 0;   // the 3D court needs a shorter box than the oblique 2D one (set once by main.js when the 3D layer is live)
export const setArenaAspect = (a) => { glAspect = a; };
export const camAspect = () => glAspect || (TOPPAD + (WY1 - WY0) * TILT) / (WX1 - WX0);      // height / width of the arena rect
export function camFor(A) {
  const S = Math.min(A.w / (WX1 - WX0), A.h / (TOPPAD + (WY1 - WY0) * TILT));
  const w = (WX1 - WX0) * S, h = (TOPPAD + (WY1 - WY0) * TILT) * S;
  const ox = A.x + (A.w - w) / 2 - WX0 * S, oy = A.y + (A.h - h) / 2 + TOPPAD * S - WY0 * TILT * S;
  const cam = { A, S, ox, oy, X: (x) => ox + x * S, Y: (y) => oy + y * TILT * S, fs: (y) => S * (0.88 + 0.24 * clamp(y / 1000, 0, 1)) };
  cam.rect = { x: ox + WX0 * S, y: oy + WY0 * TILT * S - TOPPAD * S, w, h };
  cam.unX = (sx) => (sx - ox) / S; cam.unY = (sy) => (sy - oy) / (TILT * S);
  // The interface the overlay code uses on both cameras (this oblique one and the 3D one below).
  cam.gl = false; cam.marks = null;
  cam.P = (x, y, z = 0) => ({ x: ox + x * S, y: oy + y * TILT * S - z * S });     // court point (z = height in court units) -> screen
  cam.u = () => S;                                                                  // screen px per court unit along the ground here
  cam.unproject = (sx, sy) => ({ x: (sx - ox) / S, y: (sy - oy) / (TILT * S) });
  return cam;
}

// The 3D camera behind the canvas, seen through the same interface. `gl` is the presenter's projection (view.gl), `A` the arena rect.
// Rings on the ground are handed to the presenter as marks (it draws them in the scene so people stand in front of them); the 2D side
// keeps lines, numbers and words.
export function camFromGl(gl, A) {
  const cam = { gl: true, A, rect: A, marks: gl.marks };
  cam.P = (x, y, z = 0) => gl.project(x, y, z);
  cam.u = (x, y) => gl.scaleAt(x, y);
  cam.unproject = (sx, sy) => gl.toCourt(sx, sy);
  cam.S = gl.scaleAt(CX, CY);
  cam.fs = (y) => gl.scaleAt(CX, y);
  return cam;
}

// A circle of court radius r on the ground as a closed screen path (an ellipse in the oblique view, the projected circle in 3D).
export function groundPath(ctx, cam, x, y, r, n = 40) {
  ctx.beginPath();
  if (!cam.gl) { ctx.ellipse(cam.X(x), cam.Y(y), r * cam.S, r * cam.S * TILT, 0, 0, TAU); return; }
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, q = cam.P(x + Math.cos(a) * r, y + Math.sin(a) * r, 0);
    if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
  }
  ctx.closePath();
}

// ---- cached painting ----------------------------------------------------------------------------------------------------------------------
const caches = new Map();
function cached(key, w, h, paint) {
  if (typeof OffscreenCanvas !== 'function') return null;
  let c = caches.get(key);
  if (c === undefined) {
    if (caches.size > 10) caches.clear();
    try { c = new OffscreenCanvas(Math.max(2, Math.round(w)), Math.max(2, Math.round(h))); paint(c.getContext('2d'), c.width, c.height); } catch { c = null; }
    caches.set(key, c);
  }
  return c;
}

const FLOORS = {
  terracotta: { base: ['#c97a50', '#a95a37'], out: '#4a505c', line: '#fffdf4', inside: 'rgba(255,214,170,0.22)' },
  parquet: { base: ['#c99a62', '#a47240'], out: '#c99a62', line: '#fffdf4', inside: 'rgba(255,236,190,0.2)' },
  cobble: { base: ['#8d8a86', '#6d6a66'], out: '#6d6a66', line: '#f7f3ea', inside: 'rgba(255,240,200,0.16)' },
  sand: { base: ['#ecd29a', '#d9b877'], out: '#d9b877', line: '#fffdf4', inside: 'rgba(255,248,214,0.28)' },
};
export const SKY = { terracotta: ['#27324d', '#161d33'], parquet: ['#2a2036', '#16101f'], cobble: ['#1d2a46', '#0e1526'], sand: ['#1f4b66', '#102838'] };

// The band above the far edge of the ground: a school wall, gym wall, building front or sky.
function paintWall(g, v, cam, wpx, hpx) {
  const hBand = Math.max(0, (cam.oy + WY0 * TILT * cam.S) - cam.rect.y) + 2, S = cam.S;
  if (hBand < 4) return;
  const gr = g.createLinearGradient(0, 0, 0, hBand);
  const C = { terracotta: ['#e3cfa8', '#b99d74'], parquet: ['#efe4c8', '#cdb88e'], cobble: ['#c49a74', '#8f6d52'], sand: ['#7fd0ee', '#cdf0f8'] }[v.floor];
  gr.addColorStop(0, C[0]); gr.addColorStop(1, C[1]);
  g.fillStyle = gr; g.fillRect(0, 0, wpx, hBand);
  g.save(); g.beginPath(); g.rect(0, 0, wpx, hBand); g.clip();
  if (v.floor === 'terracotta') {
    g.strokeStyle = 'rgba(80,50,20,0.18)'; g.lineWidth = 1;
    for (let y = 6; y < hBand; y += 9 * S * 2.2) { g.beginPath(); g.moveTo(0, y); g.lineTo(wpx, y); g.stroke(); }
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(40,60,90,0.55)'; g.fillRect(wpx * (0.08 + i * 0.2), hBand * 0.18, wpx * 0.1, hBand * 0.5); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(wpx * (0.08 + i * 0.2), hBand * 0.18, wpx * 0.1, 3); }
  } else if (v.floor === 'parquet') {
    g.strokeStyle = 'rgba(120,80,30,0.45)'; g.lineWidth = Math.max(2, 3 * S);
    for (let x = 12; x < wpx; x += 18 * S * 2) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x, hBand); g.stroke(); }
    g.fillStyle = 'rgba(120,80,30,0.5)'; g.fillRect(0, hBand * 0.4, wpx, 3); g.fillRect(0, hBand * 0.75, wpx, 3);
  } else if (v.floor === 'cobble') {
    for (let i = 0; i < 6; i++) {
      const x = wpx * (0.05 + i * 0.16), ww = wpx * 0.09;
      g.fillStyle = 'rgba(255,214,120,0.8)'; g.beginPath(); g.roundRect(x, hBand * 0.16, ww, hBand * 0.62, [ww / 2, ww / 2, 3, 3]); g.fill();
      g.strokeStyle = 'rgba(60,30,10,0.55)'; g.lineWidth = 2; g.stroke();
    }
    g.fillStyle = 'rgba(255,200,90,0.9)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(wpx * (i + 0.5) / 14, hBand * 0.1 + Math.sin(i) * 3, 3, 0, TAU); g.fill(); }
  } else {
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(wpx * 0.82, hBand * 0.35, Math.min(14, hBand * 0.22), 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(wpx * 0.25, hBand * 0.45, 40 * S * 1.4, 7, 0, 0, TAU); g.fill();
  }
  g.restore();
}

// Paints the whole ground at the camera's scale. Drawn in world units under the oblique transform, so circles come out as ellipses.
function paintFloor(g, v, cam, wpx, hpx) {
  paintWall(g, v, cam, wpx, hpx);
  g.save();
  g.setTransform(cam.S, 0, 0, cam.S * TILT, cam.ox - cam.rect.x, cam.oy - cam.rect.y);
  paintGroundWorld(g, v, false);
  g.restore();
  // soft vignette and an upper-left light
  const vg = g.createRadialGradient(wpx * 0.5, hpx * 0.55, Math.min(wpx, hpx) * 0.3, wpx * 0.5, hpx * 0.55, Math.max(wpx, hpx) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)'); g.fillStyle = vg; g.fillRect(0, 0, wpx, hpx);
  const lg2 = g.createLinearGradient(0, 0, wpx, hpx); lg2.addColorStop(0, 'rgba(255,244,214,0.16)'); lg2.addColorStop(0.5, 'rgba(255,244,214,0)'); g.fillStyle = lg2; g.fillRect(0, 0, wpx, hpx);
}

// The ground itself in WORLD units (x -10..1010, y -30..1030): the caller has set the transform. `scene3d` leaves out the things the 3D
// scene builds for real (the sea, the wall strip), so the same painting serves the oblique 2D view and the texture of the 3D floor.
export function paintGroundWorld(g, v, scene3d = false) {
  const F = FLOORS[v.floor];
  const X0 = scene3d ? -420 : WX0, Y0 = scene3d ? -420 : WY0, X1 = scene3d ? 1420 : WX1, Y1 = scene3d ? 1420 : WY1;   // the 3D floor continues past the walls
  const RX = X1 - X0, RY = Y1 - Y0, grow = scene3d ? (RX * RY) / (1020 * 1060) : 1;
  const lg = g.createLinearGradient(0, Y0, 0, Y1); lg.addColorStop(0, F.base[0]); lg.addColorStop(1, F.base[1]);
  g.fillStyle = lg; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  if (v.floor === 'terracotta') {
    // asphalt schoolyard outside the court, hopscotch and cracks
    g.fillStyle = F.out; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    for (let i = 0; i < 260 * grow; i++) { g.fillStyle = `rgba(${hash(i, 1) > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + hash(i, 2) * 0.05})`; g.fillRect(X0 + hash(i, 3) * RX, Y0 + hash(i, 4) * RY, 6 + hash(i, 5) * 22, 3 + hash(i, 6) * 6); }
    g.strokeStyle = 'rgba(20,22,28,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(40, 120); g.lineTo(90, 170); g.lineTo(120, 150); g.moveTo(920, 880); g.lineTo(880, 930); g.lineTo(930, 960); g.stroke();
    // hopscotch in the lower-left corner
    g.strokeStyle = 'rgba(255,230,120,0.75)'; g.lineWidth = 5;
    for (let i = 0; i < 6; i++) g.strokeRect(34, 700 + i * 52, 50, 50);
    g.strokeRect(84, 804, 50, 50);
    // painted court floor (terracotta tiles)
    g.save(); g.beginPath(); g.arc(CX, CY, R + 8, 0, TAU); g.clip();
    const cg = g.createRadialGradient(CX - 80, CY - 100, 40, CX, CY, R + 20); cg.addColorStop(0, '#dd8d62'); cg.addColorStop(1, '#b4623e');
    g.fillStyle = cg; g.fillRect(0, 0, ARENA, ARENA);
    for (let y = 0; y < 1000; y += 55) for (let x = 0; x < 1000; x += 55) {
      const q = hash(x, y); g.fillStyle = `rgba(${q > 0.5 ? '255,226,190' : '70,20,0'},${0.05 + q * 0.07})`; g.fillRect(x + 1, y + 1, 53, 53);
    }
    g.strokeStyle = 'rgba(70,24,6,0.28)'; g.lineWidth = 2;
    for (let i = 0; i <= 1000; i += 55) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 1000); g.moveTo(0, i); g.lineTo(1000, i); g.stroke(); }
    g.restore();
  } else if (v.floor === 'parquet') {
    const T = scene3d ? 17 : 38, Lp = scene3d ? 190 : 260;   // finer boards in the 3D floor (about 25 cm wide, 3 m long)
    for (let y = Y0; y < Y1; y += T) {
      for (let x = X0 - ((Math.floor(y / T) * 97) % Lp); x < X1; x += Lp) {
        const q = hash(Math.floor(x / 10), Math.floor(y / T));
        g.fillStyle = `rgba(${q > 0.5 ? '255,232,190' : '70,36,10'},${0.06 + q * 0.12})`; g.fillRect(x, y, Lp - 2, T - 1);
        g.strokeStyle = 'rgba(60,30,8,0.35)'; g.lineWidth = scene3d ? 1.2 : 2; g.strokeRect(x, y, Lp, T);
      }
    }
    // gym walls: bench strip at the far edge and a darker band at the near edge
    if (!scene3d) { g.fillStyle = 'rgba(30,16,6,0.22)'; g.fillRect(X0, Y0, X1 - X0, 24); }
    const cg = g.createRadialGradient(CX, CY, 40, CX, CY, R + 20); cg.addColorStop(0, 'rgba(255,236,190,0.28)'); cg.addColorStop(1, 'rgba(255,236,190,0.06)');
    g.fillStyle = cg; g.beginPath(); g.arc(CX, CY, R + 6, 0, TAU); g.fill();
  } else if (v.floor === 'cobble') {
    for (let y = Y0; y < Y1; y += 34) for (let x = X0; x < X1; x += 38) {
      const q = hash(x, y), r = hash(y, x), ox = ((Math.floor(y / 34) % 2) * 19);
      const sx = x + ox + (r - 0.5) * 4, sy = y + (q - 0.5) * 4;
      g.fillStyle = `rgb(${Math.round(112 + q * 44)},${Math.round(108 + q * 40)},${Math.round(104 + q * 36)})`;
      g.beginPath(); g.roundRect(sx, sy, 35, 31, 9); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.roundRect(sx + 3, sy + 3, 20, 8, 4); g.fill();
    }
    g.fillStyle = 'rgba(20,14,10,0.28)'; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    const cg = g.createRadialGradient(CX, CY, 40, CX, CY, R + 20); cg.addColorStop(0, 'rgba(255,240,200,0.28)'); cg.addColorStop(1, 'rgba(255,240,200,0.04)');
    g.fillStyle = cg; g.beginPath(); g.arc(CX, CY, R + 6, 0, TAU); g.fill();
  } else if (v.floor === 'sand') {
    for (let i = 0; i < 120 * grow; i++) {
      const x = X0 + hash(i, 11) * RX, y = Y0 + hash(i, 12) * RY;
      g.strokeStyle = `rgba(${hash(i, 13) > 0.5 ? '150,110,50' : '255,246,214'},0.18)`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 40, y - 9, x + 90, y); g.stroke();
    }
    for (let i = 0; i < 900 * grow; i++) { g.fillStyle = `rgba(${hash(i, 21) > 0.5 ? '255,250,225' : '130,96,44'},0.22)`; g.fillRect(X0 + hash(i, 22) * RX, Y0 + hash(i, 23) * RY, 3, 3); }
    // the sea beyond the far edge
    if (!scene3d) {
      const sg = g.createLinearGradient(0, Y0, 0, Y0 + 70); sg.addColorStop(0, '#2aa7c4'); sg.addColorStop(0.75, '#4fc8d6'); sg.addColorStop(1, 'rgba(255,255,255,0.9)');
      g.fillStyle = sg; g.fillRect(X0, Y0, X1 - X0, 62);
      g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.moveTo(X0, 62); for (let x = X0; x <= X1; x += 30) g.lineTo(x, 62 + Math.sin(x * 0.05) * 7 + 5); g.lineTo(X1, 40); g.lineTo(X0, 40); g.fill();
    }
    const cg = g.createRadialGradient(CX, CY, 40, CX, CY, R + 20); cg.addColorStop(0, 'rgba(255,250,224,0.35)'); cg.addColorStop(1, 'rgba(255,250,224,0.08)');
    g.fillStyle = cg; g.beginPath(); g.arc(CX, CY, R + 6, 0, TAU); g.fill();
  }
  // lines: the circle, the centre line (court), the cemetery arcs, the rim band
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 16; g.beginPath(); g.arc(CX, CY + 4, R, 0, TAU); g.stroke();
  g.strokeStyle = F.line; g.lineWidth = 10; g.beginPath(); g.arc(CX, CY, R, 0, TAU); g.stroke();
  if (v.kind === 'court') {
    g.lineWidth = 8; g.beginPath(); g.moveTo(CX - R, CY); g.lineTo(CX + R, CY); g.stroke();
    g.beginPath(); g.arc(CX, CY, 46, 0, TAU); g.stroke();
    g.setLineDash([4, 22]); g.lineWidth = 16; g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.beginPath(); g.arc(CX, CY, RIM + 8, Math.PI + 0.22, TAU - 0.22); g.stroke();
    g.beginPath(); g.arc(CX, CY, RIM + 8, 0.22, Math.PI - 0.22); g.stroke();
    g.setLineDash([]);
  } else {
    g.lineWidth = 6; g.setLineDash([2, 18]); g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.beginPath(); g.arc(CX, CY, RIM + 8, 0, TAU); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 6; g.beginPath(); g.arc(CX, CY, 40, 0, TAU); g.stroke();
  }
}

// Draws the ground into cam.rect (already clipped by the caller if wanted).
export function drawFloor(ctx, v, cam) {
  const r = cam.rect, key = `${v.id}|${Math.round(r.w)}x${Math.round(r.h)}`;
  const c = cached(key, r.w, r.h, (g, w, h) => paintFloor(g, v, cam, w, h));
  if (c) { ctx.drawImage(c, r.x, r.y, r.w, r.h); return; }
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); ctx.translate(r.x, r.y);
  paintFloor(ctx, v, cam, r.w, r.h); ctx.restore();
}

export function drawBackdrop(ctx, w, h, t = 0, floor = 'terracotta') {
  const c = SKY[floor] ?? SKY.terracotta;
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
  ctx.fillStyle = g; ctx.fillRect(-10, -10, w + 20, h + 20);
  // slow, faint diagonal stripes (a sports-poster feel); a few cheap shapes only
  ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = '#fff';
  const off = (t * 12) % 180;
  for (let x = -h; x < w + 180; x += 180) { ctx.beginPath(); ctx.moveTo(x + off, 0); ctx.lineTo(x + off + 60, 0); ctx.lineTo(x + off + 60 - h * 0.6, h); ctx.lineTo(x + off - h * 0.6, h); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

// ---- people ---------------------------------------------------------------------------------------------------------------------------
const LIMB = (ctx, x0, y0, x1, y1, bend, w, col) => {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const ex = mx + (-dy / L) * bend, ey = my + (dx / L) * bend;
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(ex, ey, x1, y1); ctx.stroke();
};

export function teamLook(orig) {
  return orig === 0
    ? { shirt: PAL.sun, light: PAL.sunLight, dark: PAL.sunDark, shorts: '#1b2a52', sock: '#ffd9a0', cap: '#ffb35c' }
    : { shirt: PAL.moon, light: PAL.moonLight, dark: PAL.moonDark, shorts: '#f4f1e8', sock: '#cfdcff', cap: '#86a8ff' };
}

function drawBallIcon(ctx, x, y, r, spin = 0, glow = 0) {
  if (glow > 0) { ctx.fillStyle = `rgba(255,120,60,${0.28 * glow})`; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, TAU); ctx.fill(); }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r * 1.05);
  g.addColorStop(0, '#ff9a86'); g.addColorStop(0.45, '#e8352c'); g.addColorStop(1, '#8c1410');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = r * 0.32; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r * 0.46, spin, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(80,0,0,0.35)'; ctx.lineWidth = r * 0.1;
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.5, r * 1.1, spin + 0.9, 0, TAU); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.42, r * 0.28, r * 0.17, -0.6, 0, TAU); ctx.fill();
}

// One person. `o`: { t, you, ring (highlight colour), dim, hold (draw held ball), flash }
export function drawPlayer(ctx, cam, p, o = {}) {
  const sx = cam.X(p.x), sy = cam.Y(p.y), s = cam.fs(p.y) * p.tall * FIG;
  const L = teamLook(p.orig);
  const spd = Math.hypot(p.vx, p.vy), run = clamp(spd / 235, 0, 1), ph = p.gait;
  const fx = Math.cos(p.a), fy = Math.sin(p.a);
  const view = fy > 0.38 ? 'front' : fy < -0.38 ? 'back' : 'side';
  const dir = fx >= 0 ? 1 : -1;
  const kneel = p.stun > 0 ? 1 : 0;
  const recoil = p.hitT > 0 ? p.hitT / 0.7 : 0;
  const bob = Math.abs(Math.sin(ph)) * 3.2 * run;
  ctx.save();
  // ground shadow and the "you" ring are drawn in screen space so they stay flat
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(sx, sy + 1, 25 * s, 9 * s, 0, 0, TAU); ctx.fill();
  if (o.you) {
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = Math.max(2, 3 * s); ctx.beginPath(); ctx.ellipse(sx, sy + 1, 31 * s, 12 * s, 0, 0, TAU); ctx.stroke();
  }
  if (p.catchT > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(2, 3 * s); ctx.setLineDash([6 * s, 6 * s]);
    ctx.beginPath(); ctx.ellipse(sx, sy + 1, 54 * s, 54 * TILT * s, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.translate(sx, sy); ctx.scale(s, s);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (recoil > 0) ctx.rotate(Math.sin(recoil * 18) * 0.12 * recoil);
  const hipY = -36 + kneel * 12, legL = 34 - kneel * 12;

  // pose targets for the hands (shoulders at (+-14, -63))
  const shY = -63 + kneel * 12 + bob * 0.3;
  const holding = p.ball !== null;
  const swing = Math.sin(ph) * 10 * run;
  let lh, rh;             // left/right hand in local units (screen-left / screen-right)
  let ballAt = null;
  const wk = p.windT > 0 && p.windMax ? 1 - p.windT / p.windMax : 0;
  const tk = p.throwT > 0 ? 1 - p.throwT / 0.35 : 0;
  if (recoil > 0.2) { lh = [-24, -86 + Math.sin(recoil * 20) * 4]; rh = [24, -84 - Math.sin(recoil * 24) * 4]; }
  else if (p.catchT > 0) { lh = [-27, -60]; rh = [27, -60]; if (view === 'front') { lh = [-26, -56]; rh = [26, -56]; } }
  else if (p.windT > 0 && holding) {
    const back = view === 'front' ? 1 : -1;
    rh = [20 + wk * 5, -78 - wk * 14]; lh = [-14, -60 - wk * 3 * back]; ballAt = [rh[0], rh[1] - 7];
  }
  else if (tk > 0 && tk < 1) { rh = [20 - tk * 8, -92 + tk * 60]; lh = [-18, -48 + swing * 0.2]; }
  else if (holding) { lh = [-8, -50]; rh = [8, -50]; ballAt = [0, -52]; }
  else { lh = [-19 + swing * 0.1, -38 + swing * (view === 'side' ? 0.0 : 1)]; rh = [19 - swing * 0.1, -38 - swing * (view === 'side' ? 0.0 : 1)]; if (view === 'side') { lh = [dir * (10 + swing * 1.2), -42 + Math.abs(swing) * 0.3]; rh = [dir * (10 - swing * 1.2), -42 + Math.abs(swing) * 0.3]; } }

  const skin = p.skin, skinD = shade(skin, 0.78);
  const drawLegs = () => {
    for (const sgn of [-1, 1]) {
      let fxo, lift;
      if (view === 'side') { fxo = dir * Math.sin(ph + (sgn > 0 ? 0 : Math.PI)) * 12 * run; lift = Math.max(0, Math.cos(ph + (sgn > 0 ? 0 : Math.PI))) * 6 * run; }
      else { fxo = sgn * 7; lift = Math.max(0, Math.sin(ph + (sgn > 0 ? 0 : Math.PI))) * 9 * run; }
      const hx = sgn * 7 * (view === 'side' ? 0.3 : 1), fy2 = -lift + kneel * 0;
      LIMB(ctx, hx, hipY, hx + (view === 'side' ? fxo : fxo - hx) * 0.8, fy2 - 3, 2.2, 9.5, skinD);
      // sock and shoe
      const fx2 = hx + (view === 'side' ? fxo : fxo - hx) * 0.8;
      ctx.fillStyle = L.sock; ctx.beginPath(); ctx.roundRect(fx2 - 4.8, fy2 - 15, 9.6, 9, 3); ctx.fill();
      ctx.fillStyle = '#f8f8f8'; ctx.beginPath(); ctx.ellipse(fx2 + (view === 'side' ? dir * 2.5 : 0), fy2 - 2, 7, 4.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(fx2 - 6, fy2 - 1, 12, 1.6);
    }
  };
  const drawShorts = () => {
    ctx.fillStyle = L.shorts; ctx.beginPath(); ctx.roundRect(-14, hipY - 10, 28, 17, 6); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(-1, hipY - 2, 2, 9);
  };
  const drawTorso = () => {
    const top = shY - 6, bot = hipY - 8, w2 = view === 'side' ? 10.5 : 15;
    const g = ctx.createLinearGradient(-w2, 0, w2, 0); g.addColorStop(0, L.light); g.addColorStop(0.55, L.shirt); g.addColorStop(1, L.dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w2 + 3, top); ctx.quadraticCurveTo(0, top - 5, w2 - 3, top); ctx.lineTo(w2, bot - 8); ctx.quadraticCurveTo(w2, bot, w2 - 4, bot); ctx.lineTo(-w2 + 4, bot); ctx.quadraticCurveTo(-w2, bot, -w2, bot - 8); ctx.closePath(); ctx.fill();
    // chest stripe and collar
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-w2 + 1, top + 12, w2 * 2 - 2, 4.5);
    if (view === 'front') { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-5, top + 1); ctx.lineTo(0, top + 6); ctx.lineTo(5, top + 1); ctx.stroke(); }
    if (view === 'back') {
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = `800 15px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(p.num), 0, top + 15);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(-w2 * 0.45, top + 8, 3.5, 9, 0.2, 0, TAU); ctx.fill();
  };
  const drawArm = (side, hand, behind) => {
    const sh = [side * (view === 'side' ? 6 : 14.5), shY];
    ctx.save();
    // short sleeve then skin
    const bend = (side > 0 ? 1 : -1) * 4;
    LIMB(ctx, sh[0], sh[1], hand[0], hand[1], bend, 8.2, skin);
    const dx = hand[0] - sh[0], dy = hand[1] - sh[1], L2 = Math.hypot(dx, dy) || 1;
    LIMB(ctx, sh[0], sh[1], sh[0] + (dx / L2) * 9, sh[1] + (dy / L2) * 9, 0, 10.5, behind ? L.dark : L.shirt);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hand[0], hand[1], p.catchT > 0 ? 6 : 4.6, 0, TAU); ctx.fill();
    ctx.restore();
  };
  const drawHead = () => {
    const hy = shY - 15 + bob * 0.2, hr = 10.8;
    const hairC = p.hair;
    if (p.style === 1 && view !== 'front') { ctx.fillStyle = hairC; ctx.beginPath(); ctx.ellipse(-dir * (view === 'side' ? 10 : 0) + Math.sin(ph) * 3 * run, hy + 8, 4.5, 11, 0.2 * -dir, 0, TAU); ctx.fill(); }
    if (p.style === 1 && view === 'front') { ctx.fillStyle = hairC; ctx.beginPath(); ctx.ellipse(11 + Math.sin(ph) * 2 * run, hy + 5, 4, 9, -0.3, 0, TAU); ctx.fill(); }
    if (p.style === 2) { ctx.fillStyle = hairC; ctx.beginPath(); ctx.arc(0, hy - 1, hr + 3.2, 0, TAU); ctx.fill(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * (hr + 2.5), hy - 1 + Math.sin(a) * (hr + 2.5), 3.4, 0, TAU); ctx.fill(); } }
    const g = ctx.createRadialGradient(-3, hy - 4, 2, 0, hy, hr + 2); g.addColorStop(0, shade(skin, 1.08)); g.addColorStop(1, shade(skin, 0.86));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, hy, hr, hr * 1.08, 0, 0, TAU); ctx.fill();
    // hair cap
    if (p.style !== 3) {
      ctx.fillStyle = hairC; ctx.beginPath();
      if (view === 'back') ctx.ellipse(0, hy - 0.5, hr + 0.6, hr * 1.08, 0, 0, TAU);
      else ctx.ellipse(0, hy - 3.4, hr + 0.6, hr * 0.78, 0, Math.PI, TAU);
      ctx.fill();
      if (view === 'side') { ctx.beginPath(); ctx.ellipse(-dir * 4, hy - 1, hr * 0.55, hr * 0.9, 0, 0, TAU); ctx.fill(); }
    } else {
      ctx.fillStyle = L.cap; ctx.beginPath(); ctx.ellipse(0, hy - 3.6, hr + 1, hr * 0.8, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = L.dark; if (view === 'front') ctx.fillRect(-hr, hy - 4, hr * 2, 2.6); else if (view === 'side') ctx.fillRect(dir > 0 ? 3 : -hr - 5, hy - 4, hr + 4, 2.6);
    }
    // face
    ctx.fillStyle = '#2a1608';
    if (view === 'front') {
      ctx.beginPath(); ctx.arc(-3.8, hy + 0.8, 1.4, 0, TAU); ctx.arc(3.8, hy + 0.8, 1.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7a3a22'; ctx.lineWidth = 1.5; ctx.beginPath();
      if (p.windT > 0 || p.throwT > 0.15 || p.catchT > 0) { ctx.ellipse(0, hy + 6, 2.6, 2.1, 0, 0, TAU); ctx.fillStyle = '#5a1a10'; ctx.fill(); }
      else if (recoil > 0.2) { ctx.moveTo(-3, hy + 6.5); ctx.lineTo(3, hy + 5.5); ctx.stroke(); }
      else { ctx.arc(0, hy + 3.4, 3.4, 0.25, Math.PI - 0.25); ctx.stroke(); }
    } else if (view === 'side') {
      ctx.beginPath(); ctx.arc(dir * 4.8, hy + 0.8, 1.4, 0, TAU); ctx.fill();
      ctx.fillStyle = shade(skin, 0.9); ctx.beginPath(); ctx.arc(dir * 10.4, hy + 3, 1.6, 0, TAU); ctx.fill();
    }
  };
  // draw order by view
  const armsBehind = view === 'back';
  if (view === 'front' || view === 'side') {
    drawLegs(); drawShorts(); if (view === 'side') drawArm(-dir, dir > 0 ? lh : rh, true);
    drawTorso();
    if (view === 'front') { drawArm(-1, lh, false); drawArm(1, rh, false); } else drawArm(dir, dir > 0 ? rh : lh, false);
    drawHead();
  } else {
    drawLegs(); drawShorts(); drawHead(); drawTorso(); drawArm(-1, lh, armsBehind); drawArm(1, rh, armsBehind);
  }
  // the ball in the hands
  if (holding && !o.noBall) {
    const b = ballAt ?? [0, -52];
    drawBallIcon(ctx, b[0], b[1], 8.6, p.gait * 0.3);
  }
  // stunned: little stars circling the head
  if (p.stun > 0) {
    for (let i = 0; i < 3; i++) { const a = (o.t ?? 0) * 5 + i * TAU / 3; ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(Math.cos(a) * 14, shY - 32 + Math.sin(a) * 4, 3, 0, TAU); ctx.fill(); }
  }
  if (o.you) {
    const by = shY - 40 + Math.sin((o.t ?? 0) * 6) * 3;
    ctx.fillStyle = PAL.gold; ctx.strokeStyle = 'rgba(40,24,0,0.8)'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-8, by - 8); ctx.lineTo(8, by - 8); ctx.lineTo(0, by + 4); ctx.closePath(); ctx.stroke(); ctx.fill();
  }
  ctx.restore();
  if (o.flash) { /* reserved */ }
}

// ---- the ball ---------------------------------------------------------------------------------------------------------------------------
export function drawBallShadow(ctx, cam, b) {
  const k = clamp(1 - b.z / 260, 0.25, 1), sx = cam.X(b.x), sy = cam.Y(b.y), r = 16 * cam.S * (0.7 + 0.5 * k);
  ctx.fillStyle = `rgba(0,0,0,${0.12 + 0.2 * k})`; ctx.beginPath(); ctx.ellipse(sx, sy + 1, r * 1.3, r * 0.55, 0, 0, TAU); ctx.fill();
}
export function drawBall(ctx, cam, b, o = {}) {
  const sx = cam.X(b.x), sy = cam.Y(b.y) - b.z * cam.S, r = 16 * cam.S * (0.95 + 0.15 * clamp(b.y / 1000, 0, 1));
  if (b.live) {
    // streak behind a live ball
    const sp = Math.hypot(b.vx, b.vy), n = 5;
    for (let i = n; i >= 1; i--) {
      const k = i * 0.022, px = cam.X(b.x - b.vx * k), py = cam.Y(b.y - b.vy * k) - (b.z - b.vz * k) * cam.S;
      ctx.fillStyle = `rgba(255,140,90,${0.07 + 0.16 * (1 - i / n)})`; ctx.beginPath(); ctx.arc(px, py, r * (0.5 + 0.5 * (1 - i / n)), 0, TAU); ctx.fill();
    }
    void sp;
  }
  drawBallIcon(ctx, sx, sy, r, (b.x + b.y) * 0.04, b.live ? 0.8 + 0.2 * Math.sin((o.t ?? 0) * 18) : 0);
}

// ---- particles and pops -------------------------------------------------------------------------------------------------------------------
export function burst(list, rng, x, y, z, n, color, power = 1, kind = 'dot') {
  for (let i = 0; i < n; i++) {
    const a = rng.next() * TAU, sp = (60 + rng.next() * 260) * power;
    list.push({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 60 + rng.next() * 300 * power, life: 0.5 + rng.next() * 0.5, max: 1, col: color, size: 2.5 + rng.next() * 4, kind });
    list[list.length - 1].max = list[list.length - 1].life;
  }
  if (list.length > 160) list.splice(0, list.length - 160);
}
export function ringFx(list, x, y, color, r0 = 20, r1 = 90, life = 0.45) { list.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, life, max: life, col: color, size: r0, to: r1, kind: 'ring' }); }
export function stepParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i]; q.life -= dt;
    if (q.life <= 0) { list.splice(i, 1); continue; }
    q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 900 * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.3; q.vx *= 0.7; q.vy *= 0.7; }
  }
}
export function drawParticles(ctx, cam, list) {
  for (const q of list) {
    const a = clamp(q.life / q.max, 0, 1), p = cam.P(q.x, q.y, q.z), u = cam.u(q.x, q.y);
    if (q.kind === 'ring') {
      const r = q.size + (q.to - q.size) * (1 - a);
      ctx.strokeStyle = rgbaAny(q.col, a); ctx.lineWidth = Math.max(2, 5 * u * a);
      const g = cam.P(q.x, q.y, 0); ctx.save(); groundPath(ctx, cam, q.x, q.y, r); ctx.stroke(); ctx.restore(); void g;
    } else if (q.kind === 'star') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(q.life * 8); ctx.fillStyle = rgbaAny(q.col, a);
      const s = q.size * u * 1.6; ctx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? s * 0.45 : s; ctx.lineTo(Math.cos(i * Math.PI / 4) * rr, Math.sin(i * Math.PI / 4) * rr); } ctx.closePath(); ctx.fill(); ctx.restore();
    } else {
      ctx.fillStyle = rgbaAny(q.col, a); ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, q.size * u * 1.2), 0, TAU); ctx.fill();
    }
  }
}
function rgbaAny(col, a) { if (col[0] === '#') return rgba(col, a); return col; }
