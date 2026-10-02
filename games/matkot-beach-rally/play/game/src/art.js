// The beach: sky, sun, sea, the baked sand layer (grain, dunes, court grooves, stakes, props) and the light presets.
// Static art is baked once into an offscreen canvas in small slices (a fixed amount of work per frame, no clock), so the
// menu appears at once and the sand fades in a moment later. Nothing here reads the clock or the DOM.
import { W, H, project, COURT } from './cam.js';
import { clamp } from './cam.js';

// ---- offscreen host ---------------------------------------------------------------------------------
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
export const canBake = () => typeof OffscreenCanvas !== 'undefined' || hostDoc !== null;
export const newCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
};
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const TAU = Math.PI * 2;

// ---- light presets ----------------------------------------------------------------------------------------
// Colours are [r,g,b]. The beach interpolates between these: in Beach Rally the sky moves from afternoon to dusk.
export const LIGHTS = [
  { name: 'Morning', skyTop: [92, 168, 232], skyMid: [150, 205, 240], skyHor: [214, 238, 250], sunX: 0.28, sunY: 128, sun: [255, 246, 220], glow: 0.5, seaFar: [24, 132, 188], seaNear: [66, 202, 208], tint: [190, 225, 255, 0.07], shade: [-0.5, 0.35] },
  { name: 'Afternoon', skyTop: [54, 140, 226], skyMid: [112, 184, 238], skyHor: [182, 224, 246], sunX: 0.64, sunY: 96, sun: [255, 250, 226], glow: 0.55, seaFar: [18, 118, 190], seaNear: [52, 196, 202], tint: [255, 255, 255, 0], shade: [0.35, 0.3] },
  { name: 'Golden hour', skyTop: [50, 98, 170], skyMid: [236, 160, 118], skyHor: [255, 212, 150], sunX: 0.68, sunY: 176, sun: [255, 198, 112], glow: 0.8, seaFar: [30, 88, 150], seaNear: [72, 166, 180], tint: [255, 150, 64, 0.15], shade: [-0.7, 0.28] },
  { name: 'Dusk', skyTop: [30, 40, 98], skyMid: [190, 86, 112], skyHor: [255, 150, 96], sunX: 0.7, sunY: 222, sun: [255, 160, 86], glow: 1, seaFar: [28, 46, 108], seaNear: [66, 104, 148], tint: [255, 104, 76, 0.2], shade: [-0.9, 0.24] },
];
const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mixN = (a, b, t) => a + (b - a) * t;
// pos: 0 = Morning ... 3 = Dusk, fractional values blend
export function lightAt(pos) {
  const p = clamp(pos, 0, LIGHTS.length - 1), i = Math.min(LIGHTS.length - 2, Math.floor(p)), t = p - i;
  const A = LIGHTS[i], B = LIGHTS[i + 1];
  return {
    skyTop: mixC(A.skyTop, B.skyTop, t), skyMid: mixC(A.skyMid, B.skyMid, t), skyHor: mixC(A.skyHor, B.skyHor, t), sunX: mixN(A.sunX, B.sunX, t), sunY: mixN(A.sunY, B.sunY, t),
    sun: mixC(A.sun, B.sun, t), glow: mixN(A.glow, B.glow, t), seaFar: mixC(A.seaFar, B.seaFar, t), seaNear: mixC(A.seaNear, B.seaNear, t),
    tint: [mixN(A.tint[0], B.tint[0], t), mixN(A.tint[1], B.tint[1], t), mixN(A.tint[2], B.tint[2], t), mixN(A.tint[3], B.tint[3], t)],
    shade: [mixN(A.shade[0], B.shade[0], t), mixN(A.shade[1], B.shade[1], t)],
  };
}
export const rgb = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

export const HORIZON = 232;     // screen y of the sea horizon
export const SHORE = 326;       // screen y of the waterline
const SAND_TOP = 318;

// ---- sky, sea (drawn every frame, cheap) -----------------------------------------------------------------------------
const CLOUDS = [[0.1, 70, 1.1, 0.5], [0.42, 118, 0.8, 0.38], [0.78, 58, 1.0, 0.45], [0.95, 140, 0.7, 0.3], [0.6, 36, 0.6, 0.35]];
export function drawSky(ctx, L, t) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, rgb(L.skyTop)); g.addColorStop(0.55, rgb(L.skyMid)); g.addColorStop(1, rgb(L.skyHor));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZON + 2);
  const sx = L.sunX * W, sy = L.sunY;
  const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 360);
  glow.addColorStop(0, rgb(L.sun, 0.75 * L.glow)); glow.addColorStop(0.25, rgb(L.sun, 0.28 * L.glow)); glow.addColorStop(1, rgb(L.sun, 0));
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, HORIZON + 2);
  // clouds
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, HORIZON + 1); ctx.clip();
  for (let i = 0; i < CLOUDS.length; i++) {
    const [fx, cy, sc, al] = CLOUDS[i];
    const x = ((fx * W + t * (4 + i * 1.7)) % (W + 360)) - 180;
    const warm = mixC([255, 255, 255], L.skyHor, 0.5);
    ctx.fillStyle = rgb(warm, al * 0.9);
    for (const [dx, dy, r] of [[-70, 6, 30], [-30, -8, 42], [18, -2, 48], [66, 8, 34], [0, 14, 56]]) {
      ctx.beginPath(); ctx.ellipse(x + dx * sc, cy + dy * sc, r * sc * 1.25, r * sc * 0.55, 0, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  // sun disc
  ctx.fillStyle = rgb(L.sun, 0.95); ctx.beginPath(); ctx.arc(sx, sy, 34, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(sx, sy, 24, 0, TAU); ctx.fill();
  // gulls
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const gx = ((i * 211 + t * (22 + i * 5)) % (W + 120)) - 60, gy = 60 + i * 24 + Math.sin(t * 0.7 + i) * 8, fl = Math.sin(t * 5 + i * 2) * 5;
    ctx.beginPath(); ctx.moveTo(gx - 12, gy + fl); ctx.quadraticCurveTo(gx - 5, gy - 6, gx, gy); ctx.quadraticCurveTo(gx + 5, gy - 6, gx + 12, gy + fl); ctx.stroke();
  }
}

// distant skyline, a sail and the sea
export function drawSea(ctx, L, t) {
  const hz = HORIZON;
  // far shore: a hazy skyline of towers on the left
  ctx.fillStyle = rgb(mixC(L.seaFar, L.skyHor, 0.55), 0.5);
  const tw = [[20, 22, 18], [44, 40, 14], [60, 26, 20], [84, 52, 12], [98, 30, 16], [118, 44, 14], [136, 20, 22], [166, 34, 12]];
  for (const [x, h, w] of tw) ctx.fillRect(x, hz - h, w, h + 2);
  const g = ctx.createLinearGradient(0, hz, 0, SHORE + 8);
  g.addColorStop(0, rgb(L.seaFar)); g.addColorStop(1, rgb(L.seaNear));
  ctx.fillStyle = g; ctx.fillRect(0, hz, W, SHORE - hz + 10);
  // sun path glints
  const sx = L.sunX * W;
  ctx.fillStyle = rgb(L.sun, 0.18 * L.glow + 0.05);
  ctx.beginPath(); ctx.moveTo(sx - 18, hz); ctx.lineTo(sx + 18, hz); ctx.lineTo(sx + 90, SHORE); ctx.lineTo(sx - 90, SHORE); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 46; i++) {
    const k = (i * 37 + Math.floor(t * 3 + i * 0.7)) % 100 / 100, yy = hz + 4 + (i % 23) / 23 * (SHORE - hz - 10);
    const spread = 16 + (yy - hz) * 0.75, xx = sx + (((i * 53) % 100) / 100 - 0.5) * spread * 2;
    const a = 0.25 + 0.5 * Math.abs(Math.sin(t * 2.2 + i)), wdt = 5 + (yy - hz) * 0.12 * (k + 0.4);
    ctx.fillStyle = rgb(L.sun, a * L.glow); ctx.fillRect(xx - wdt / 2, yy, wdt, 1.8);
  }
  // wave lines
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 9; i++) {
    const f = i / 8, yy = hz + 8 + f * f * (SHORE - hz - 24) + f * 6;
    ctx.strokeStyle = `rgba(255,255,255,${0.1 + f * 0.16})`;
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 20) {
      const y = yy + Math.sin(x * 0.022 + t * (0.7 + f * 0.5) + i * 1.9) * (1.2 + f * 2.6);
      if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // a small sail
  const bx = 520 + Math.sin(t * 0.05) * 20, by = hz + 14;
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(bx, by - 26); ctx.lineTo(bx + 14, by); ctx.lineTo(bx, by); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,214,190,0.8)'; ctx.beginPath(); ctx.moveTo(bx - 2, by - 20); ctx.lineTo(bx - 12, by); ctx.lineTo(bx - 2, by); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(40,50,70,0.7)'; ctx.fillRect(bx - 14, by, 30, 3);
}

// lapping foam and the wet strip, drawn over the baked sand
export function drawShore(ctx, L, t) {
  const base = SHORE + Math.sin(t * 0.6) * 5;
  // wet sand
  ctx.fillStyle = 'rgba(120,96,64,0.28)';
  ctx.beginPath(); ctx.moveTo(0, base);
  for (let x = 0; x <= W; x += 24) ctx.lineTo(x, base + 14 + Math.sin(x * 0.03 + t * 0.6) * 4 + 8 + Math.sin(t * 0.6) * 4);
  ctx.lineTo(W, base); ctx.closePath(); ctx.fill();
  // foam
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath(); ctx.moveTo(0, base - 8);
  for (let x = 0; x <= W; x += 18) ctx.lineTo(x, base + Math.sin(x * 0.045 + t * 0.9) * 4 + Math.sin(x * 0.11 + t * 1.3) * 2);
  ctx.lineTo(W, base - 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.moveTo(0, base + 4);
  for (let x = 0; x <= W; x += 18) ctx.lineTo(x, base + 8 + Math.sin(x * 0.04 + t * 0.9 + 1) * 4);
  ctx.lineTo(W, base + 4); ctx.closePath(); ctx.fill();
}

// ---- baked sand -----------------------------------------------------------------------------------------------------
export const BAKE_K = 1.5;

function drawPalm(ctx, x, y, h, lean) {
  const p0 = project(x, y, 0), s = p0.s;
  const top = { x: p0.x + lean * s, y: p0.y - h * s };
  ctx.strokeStyle = '#6e4a2a'; ctx.lineCap = 'round';
  ctx.lineWidth = 0.34 * s; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(p0.x + lean * s * 0.1, p0.y - h * s * 0.55, top.x, top.y); ctx.stroke();
  ctx.lineWidth = 0.34 * s * 0.5; ctx.strokeStyle = '#8d6238'; ctx.beginPath(); ctx.moveTo(p0.x - 0.07 * s, p0.y); ctx.quadraticCurveTo(p0.x + lean * s * 0.1, p0.y - h * s * 0.55, top.x, top.y); ctx.stroke();
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.3, len = (2.4 + (i % 3) * 0.35) * s;
    const ex = top.x + Math.cos(a) * len, ey = top.y + Math.sin(a) * len * 0.45 + len * 0.28;
    ctx.fillStyle = i % 2 ? '#2f8a4c' : '#3aa35c';
    ctx.beginPath(); ctx.moveTo(top.x, top.y);
    ctx.quadraticCurveTo(top.x + Math.cos(a) * len * 0.55, top.y + Math.sin(a) * len * 0.3 - 0.5 * s, ex, ey);
    ctx.quadraticCurveTo(top.x + Math.cos(a) * len * 0.5, top.y + Math.sin(a) * len * 0.3 + 0.2 * s, top.x, top.y); ctx.fill();
  }
  ctx.fillStyle = '#5b3d20'; ctx.beginPath(); ctx.arc(top.x - 3, top.y + 6, 0.12 * s, 0, TAU); ctx.arc(top.x + 5, top.y + 8, 0.12 * s, 0, TAU); ctx.fill();
}

function drawUmbrella(ctx, x, y, cols, tilt = 0.12) {
  const b = project(x, y, 0), s = b.s, topY = b.y - 2.1 * s, r = 1.15 * s;
  // towel
  ctx.save(); ctx.translate(b.x, b.y); ctx.transform(1, 0, -0.05, 0.32, 0, 0);
  ctx.fillStyle = cols[2] ?? '#ffffff'; ctx.fillRect(-1.0 * s, 0.2 * s, 1.9 * s, 1.2 * s);
  ctx.fillStyle = cols[0]; for (let i = 0; i < 5; i++) ctx.fillRect(-1.0 * s + i * 0.4 * s, 0.2 * s, 0.2 * s, 1.2 * s);
  ctx.restore();
  ctx.fillStyle = 'rgba(70,50,20,0.18)'; ctx.beginPath(); ctx.ellipse(b.x + 0.5 * s, b.y + 0.15 * s, 1.5 * s, 0.4 * s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#d8d2c4'; ctx.lineWidth = 0.07 * s; ctx.beginPath(); ctx.moveTo(b.x, b.y + 0.1 * s); ctx.lineTo(b.x + tilt * s, topY); ctx.stroke();
  const cx = b.x + tilt * s;
  const seg = 6;
  for (let i = 0; i < seg; i++) {
    const a0 = Math.PI + (i / seg) * Math.PI, a1 = Math.PI + ((i + 1) / seg) * Math.PI;
    ctx.fillStyle = i % 2 ? cols[1] : cols[0];
    ctx.beginPath(); ctx.moveTo(cx, topY - 0.38 * s);
    ctx.lineTo(cx + Math.cos(a0) * r, topY + Math.sin(a0) * -0.0 + 0.0);
    ctx.quadraticCurveTo(cx + Math.cos((a0 + a1) / 2) * r * 1.02, topY + 0.1 * s, cx + Math.cos(a1) * r, topY);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(cx, topY, r, 0.2 * s, 0, 0, Math.PI); ctx.fill();
}

function drawHut(ctx, x, y) {
  const b = project(x, y, 0), s = b.s;
  const px = (u) => u * s;
  ctx.fillStyle = 'rgba(70,50,20,0.2)'; ctx.beginPath(); ctx.ellipse(b.x + px(0.8), b.y + px(0.2), px(2), px(0.45), 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7d5a36';
  for (const dx of [-1.0, 1.0]) ctx.fillRect(b.x + px(dx) - px(0.09), b.y - px(1.7), px(0.18), px(1.7));
  ctx.fillStyle = '#9b7348'; ctx.fillRect(b.x - px(1.5), b.y - px(1.85), px(3), px(0.2));
  // ladder
  ctx.strokeStyle = '#7d5a36'; ctx.lineWidth = px(0.08);
  ctx.beginPath(); ctx.moveTo(b.x + px(1.1), b.y); ctx.lineTo(b.x + px(1.45), b.y - px(1.8)); ctx.moveTo(b.x + px(1.4), b.y); ctx.lineTo(b.x + px(1.7), b.y - px(1.8)); ctx.stroke();
  for (let i = 1; i < 6; i++) { const u = i / 6; ctx.beginPath(); ctx.moveTo(b.x + px(1.1 + 0.35 * u), b.y - px(1.8 * u)); ctx.lineTo(b.x + px(1.4 + 0.3 * u), b.y - px(1.8 * u)); ctx.stroke(); }
  ctx.fillStyle = '#f7f1e4'; ctx.fillRect(b.x - px(1.3), b.y - px(3.55), px(2.6), px(1.7));
  ctx.fillStyle = '#1fa3b5'; ctx.fillRect(b.x - px(1.3), b.y - px(2.15), px(2.6), px(0.3));
  ctx.fillStyle = '#2d5a73'; ctx.fillRect(b.x - px(0.95), b.y - px(3.2), px(0.8), px(0.7)); ctx.fillRect(b.x + px(0.15), b.y - px(3.2), px(0.8), px(0.7));
  ctx.fillStyle = '#ff6a4a'; ctx.beginPath(); ctx.moveTo(b.x - px(1.6), b.y - px(3.55)); ctx.lineTo(b.x, b.y - px(4.35)); ctx.lineTo(b.x + px(1.6), b.y - px(3.55)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5d4630'; ctx.lineWidth = px(0.06); ctx.beginPath(); ctx.moveTo(b.x, b.y - px(4.3)); ctx.lineTo(b.x, b.y - px(5.1)); ctx.stroke();
  ctx.fillStyle = '#ffc24b'; ctx.beginPath(); ctx.moveTo(b.x, b.y - px(5.1)); ctx.lineTo(b.x + px(0.8), b.y - px(4.88)); ctx.lineTo(b.x, b.y - px(4.66)); ctx.closePath(); ctx.fill();
}

function drawStake(ctx, x, y, col) {
  const b = project(x, y, 0), s = b.s;
  ctx.fillStyle = 'rgba(70,50,20,0.28)'; ctx.beginPath(); ctx.ellipse(b.x + 0.12 * s, b.y + 0.03 * s, 0.22 * s, 0.07 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8b6234'; ctx.fillRect(b.x - 0.055 * s, b.y - 0.95 * s, 0.11 * s, 0.95 * s);
  ctx.fillStyle = '#b48650'; ctx.fillRect(b.x - 0.055 * s, b.y - 0.95 * s, 0.04 * s, 0.95 * s);
  const d = x > 0 ? -1 : 1;
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(b.x + d * 0.055 * s, b.y - 0.92 * s); ctx.quadraticCurveTo(b.x + d * 0.3 * s, b.y - 0.96 * s, b.x + d * 0.5 * s, b.y - 0.84 * s); ctx.quadraticCurveTo(b.x + d * 0.3 * s, b.y - 0.78 * s, b.x + d * 0.055 * s, b.y - 0.66 * s); ctx.closePath(); ctx.fill();
}

function groove(ctx, pts, wm = 0.07) {
  const q = pts.map(([x, y]) => project(x, y, 0));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [dy, col, wf] of [[1.4, 'rgba(255,248,226,0.5)', 1.0], [0, 'rgba(112,80,40,0.5)', 1.0]]) {
    ctx.strokeStyle = col;
    for (let i = 1; i < q.length; i++) {
      const a = q[i - 1], b = q[i], s = (a.s + b.s) / 2;
      ctx.lineWidth = Math.max(1.2, wm * s * wf);
      ctx.beginPath(); ctx.moveTo(a.x, a.y + dy); ctx.lineTo(b.x, b.y + dy); ctx.stroke();
    }
  }
}

function footprints(ctx, rnd, x0, y0, x1, y1, n) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x = x0 + (x1 - x0) * t + (i % 2 ? 0.16 : -0.16), y = y0 + (y1 - y0) * t;
    const p = project(x, y, 0), s = p.s;
    ctx.fillStyle = 'rgba(120,90,50,0.22)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.12 * s, 0.05 * s * 1.6, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,246,222,0.35)'; ctx.beginPath(); ctx.ellipse(p.x - 1, p.y - 1.2, 0.09 * s, 0.035 * s * 1.6, 0.2, 0, TAU); ctx.fill();
  }
}

function drawTowelBag(ctx, x, y, c1, c2, sc = 1) {
  const b = project(x, y, 0), s = b.s * sc;
  ctx.save(); ctx.translate(b.x, b.y); ctx.transform(1, 0, -0.12, 0.34, 0, 0);
  ctx.fillStyle = c1; ctx.fillRect(-1.0 * s, -0.7 * s, 2.0 * s, 1.5 * s);
  ctx.fillStyle = c2; for (let i = 0; i < 6; i++) ctx.fillRect(-1.0 * s + i * 0.34 * s, -0.7 * s, 0.17 * s, 1.5 * s);
  ctx.restore();
}
function drawSandals(ctx, x, y, sc = 1) {
  const b = project(x, y, 0), s = b.s * sc;
  for (const dx of [-0.2, 0.2]) {
    ctx.fillStyle = 'rgba(60,40,20,0.3)'; ctx.beginPath(); ctx.ellipse(b.x + dx * s + 1.5, b.y + 2, 0.15 * s, 0.07 * s * 1.5, 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff6a4a'; ctx.beginPath(); ctx.ellipse(b.x + dx * s, b.y, 0.14 * s, 0.07 * s * 1.5, 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff2d6'; ctx.beginPath(); ctx.ellipse(b.x + dx * s, b.y - 1, 0.1 * s, 0.045 * s * 1.5, 0.1, 0, TAU); ctx.fill();
  }
}
function drawBottle(ctx, x, y) {
  const b = project(x, y, 0), s = b.s;
  ctx.fillStyle = 'rgba(60,40,20,0.25)'; ctx.beginPath(); ctx.ellipse(b.x + 0.15 * s, b.y + 0.02 * s, 0.2 * s, 0.06 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#58c7d6'; roundRect(ctx, b.x - 0.08 * s, b.y - 0.38 * s, 0.16 * s, 0.38 * s, 0.05 * s); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(b.x - 0.04 * s, b.y - 0.46 * s, 0.08 * s, 0.1 * s);
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function distantPeople(ctx, rnd) {
  const cols = ['#e85d4a', '#2f7fb8', '#f0b53a', '#3aa39a', '#a35bb0', '#ffffff'];
  for (let i = 0; i < 9; i++) {
    const x = -10 + rnd() * 20, y = 16.5 + rnd() * 3.2;
    if (Math.abs(x) < 3.5) continue;
    const p = project(x, y, 0), s = p.s;
    ctx.fillStyle = 'rgba(70,50,20,0.22)'; ctx.beginPath(); ctx.ellipse(p.x + 0.2 * s, p.y, 0.3 * s, 0.08 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(p.x - 0.14 * s, p.y - 0.95 * s, 0.28 * s, 0.5 * s);
    ctx.fillStyle = '#3a4660'; ctx.fillRect(p.x - 0.13 * s, p.y - 0.45 * s, 0.26 * s, 0.4 * s);
    ctx.fillStyle = i % 2 ? '#c98e66' : '#7a5238'; ctx.beginPath(); ctx.arc(p.x, p.y - 1.08 * s, 0.13 * s, 0, TAU); ctx.fill();
  }
}

// The list of bake steps. Each is a function(ctx, rnd); the job runs a few per frame.
function bakeSteps() {
  const steps = [];
  const rnd = lcg(90210);
  steps.push((c) => {
    const g = c.createLinearGradient(0, SAND_TOP, 0, H);
    g.addColorStop(0, '#ecd6a0'); g.addColorStop(0.18, '#f1dcab'); g.addColorStop(0.6, '#f4dfae'); g.addColorStop(1, '#e8cf96');
    c.fillStyle = g; c.fillRect(0, SAND_TOP, W, H - SAND_TOP);
    // a soft darker band behind the court ends on the water side (damp sand)
    const g2 = c.createLinearGradient(0, SAND_TOP, 0, SAND_TOP + 90);
    g2.addColorStop(0, 'rgba(150,118,70,0.30)'); g2.addColorStop(1, 'rgba(150,118,70,0)');
    c.fillStyle = g2; c.fillRect(0, SAND_TOP, W, 90);
  });
  steps.push((c) => {
    for (let i = 0; i < 22; i++) {
      const x = rnd() * W, y = SAND_TOP + 40 + rnd() * (H - SAND_TOP - 40), r = 60 + rnd() * 160;
      const g = c.createRadialGradient(x, y, 4, x, y, r);
      const dark = rnd() < 0.5;
      g.addColorStop(0, dark ? 'rgba(160,126,76,0.14)' : 'rgba(255,248,226,0.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r * 1.4, r * 0.38, 0, 0, TAU); c.fill();
    }
  });
  const cols = ['rgba(140,104,56,0.5)', 'rgba(255,250,236,0.7)', 'rgba(190,150,96,0.45)', 'rgba(255,238,200,0.6)', 'rgba(110,80,44,0.4)'];
  for (let k = 0; k < 10; k++) {
    steps.push((c) => {
      for (let i = 0; i < 520; i++) {
        const f = Math.pow(rnd(), 0.8), y = SAND_TOP + f * (H - SAND_TOP), x = rnd() * W, sz = 0.8 + f * 1.9 * rnd() + 0.3;
        c.fillStyle = cols[(i + k) % cols.length]; c.fillRect(x, y, sz, sz * (0.7 + rnd() * 0.5));
      }
    });
  }
  steps.push((c) => {
    // court grooves, in metres: the near/far lines, sidelines and the line in the middle
    const hw = COURT.hw, L = COURT.len, m = COURT.mid;
    groove(c, [[-hw, 0], [hw, 0]]); groove(c, [[-hw, L], [hw, L]]); groove(c, [[-hw, m], [hw, m]], 0.06);
    groove(c, [[-hw, 0], [-hw, L]]); groove(c, [[hw, 0], [hw, L]]);
    // little marks where the shots land best
    for (const sx of [-2.8, 0, 2.8]) for (const yy of [2.6, 9.4]) { const p = project(sx, yy, 0); c.strokeStyle = 'rgba(112,80,40,0.22)'; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x - 0.12 * p.s, p.y); c.lineTo(p.x + 0.12 * p.s, p.y); c.moveTo(p.x, p.y - 0.04 * p.s); c.lineTo(p.x, p.y + 0.04 * p.s); c.stroke(); }
  });
  steps.push((c) => { footprints(c, rnd, 6.2, 26, 5.0, 5, 16); footprints(c, rnd, -5.8, 20, -5.4, -1.5, 14); footprints(c, rnd, 7.6, 13, 10.4, 17, 8); });
  steps.push((c) => {
    for (let i = 0; i < 26; i++) {
      const x = -9 + rnd() * 18, y = -1.6 + rnd() * 24, p = project(x, y, 0);
      c.fillStyle = i % 3 ? 'rgba(255,238,226,0.8)' : 'rgba(255,170,150,0.7)';
      c.beginPath(); c.ellipse(p.x, p.y, 0.1 * p.s, 0.04 * p.s * 1.5, rnd() * 3, 0, TAU); c.fill();
    }
  });
  steps.push((c) => { distantPeople(c, rnd); });
  steps.push((c) => { drawHut(c, -7.6, 18.0); drawPalm(c, -9.4, 17.0, 6.6, 0.8); drawPalm(c, 10.2, 15.8, 5.6, -0.7); });
  steps.push((c) => { drawUmbrella(c, 7.4, 14.8, ['#ff6a4a', '#fff7e2', '#f7e0a8']); drawUmbrella(c, -6.4, 13.8, ['#14a3b4', '#fff7e2', '#d6f0f0'], -0.1); drawUmbrella(c, 9.8, 19.5, ['#ffc24b', '#ffffff', '#ffe9b0']); drawUmbrella(c, -3.4, 21.5, ['#a35bb0', '#ffffff', '#ead7f0'], 0.1); });
  steps.push((c) => { drawPalm(c, -11.5, 12.6, 7.0, 0.9); drawPalm(c, 11.8, 10.6, 6.4, -0.8); });
  steps.push((c) => {
    const hw = COURT.hw;
    drawStake(c, -hw, 12, '#ff6a4a'); drawStake(c, hw, 12, '#14a3b4'); drawStake(c, -hw, 6, '#ffc24b'); drawStake(c, hw, 6, '#ffc24b');
    drawStake(c, -hw, 0, '#ff6a4a'); drawStake(c, hw, 0, '#14a3b4');
  });
  steps.push((c) => {
    drawTowelBag(c, -6.6, -0.2, '#14a3b4', '#ffffff', 1.0); drawSandals(c, -5.5, -0.9, 1.2); drawBottle(c, -5.0, -0.5);
    drawTowelBag(c, 6.4, -0.4, '#ff6a4a', '#fff7e2', 0.9); drawSandals(c, 5.2, -1.1, 1.1);
  });
  steps.push((c) => {
    // vignette: the foreground falls into shade, matching the letterbox colour
    const g = c.createLinearGradient(0, H - 190, 0, H);
    g.addColorStop(0, 'rgba(24,36,58,0)'); g.addColorStop(1, 'rgba(24,36,58,0.55)');
    c.fillStyle = g; c.fillRect(0, H - 190, W, 190);
    const gl = c.createLinearGradient(0, 0, 70, 0); gl.addColorStop(0, 'rgba(24,36,58,0.3)'); gl.addColorStop(1, 'rgba(24,36,58,0)'); c.fillStyle = gl; c.fillRect(0, SAND_TOP, 70, H - SAND_TOP);
    const gr = c.createLinearGradient(W, 0, W - 70, 0); gr.addColorStop(0, 'rgba(24,36,58,0.3)'); gr.addColorStop(1, 'rgba(24,36,58,0)'); c.fillStyle = gr; c.fillRect(W - 70, SAND_TOP, 70, H - SAND_TOP);
  });
  return steps;
}

export function startBake() {
  const cv = newCanvas(Math.round(W * BAKE_K), Math.round(H * BAKE_K));
  if (!cv) return { failed: true };
  const c = cv.getContext('2d');
  if (!c) return { failed: true };
  c.scale(BAKE_K, BAKE_K);
  const steps = bakeSteps();
  let i = 0;
  return {
    failed: false,
    step(n) { for (let k = 0; k < n && i < steps.length; k++, i++) steps[i](c); return i >= steps.length ? cv : null; },
  };
}
export const BAKE_STEPS = bakeSteps().length;
