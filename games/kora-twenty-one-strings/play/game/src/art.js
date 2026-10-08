// Kora: all the painting that is not UI. A warm evening courtyard, a lit calabash with a cowhide face and a wooden bridge, strings that
// shimmer when plucked, glowing notes, fingers. Pure canvas 2D; no DOM. Everything is a function of its arguments (and the clock the
// caller passes), so it is deterministic.
import { STRING_COUNT, handOf } from './music.js';

export const PAL = {
  ink: '#120c20', night: '#1d1233', dusk: '#4b2140', plum: '#6a2c43', clay: '#9a4d33', ember: '#e8743b', emberHi: '#ffc9a0', ice: '#5fd6c8', iceHi: '#d8fbf5',
  gold: '#f6d98a', goldDeep: '#c99a3e', cream: '#fff1d6', wood: '#8a4b25', woodDark: '#3a1f0f', woodLight: '#d49a5e',
  skin: '#ecd9ae', skinMid: '#d3b987', skinWorn: '#a98d5e', leather: '#6b3a22', string: '#f6ecd0',
  left: '#ffb347', leftHi: '#ffe0a8', right: '#5fd6c8', rightHi: '#d8fbf5',
  text: '#fff1d9', dim: 'rgba(255,241,217,0.64)',
};
export const DISPLAY = '"Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export const handColor = (h) => (h === 'L' ? PAL.left : PAL.right);
export const handRGB = (h) => (h === 'L' ? '255,179,71' : '95,214,200');

// A tiny deterministic generator for painted texture (never touches Math.random).
const mkRand = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

// ---- a cache for the heavy static pieces (OffscreenCanvas when the browser has one; otherwise it is simply skipped) -----------------------------
const caches = new Map();
function cached(key, w, h, scale, paint) {
  if (typeof OffscreenCanvas !== 'function') return null;
  let c = caches.get(key);
  if (c === undefined) {
    if (caches.size > 8) caches.clear();
    try { c = new OffscreenCanvas(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale))); const g = c.getContext('2d'); g.scale(scale, scale); paint(g, w, h); } catch { c = null; }
    caches.set(key, c);
  }
  return c;
}

// ---- the evening courtyard ------------------------------------------------------------------------------------------------------------------------
function paintCourtyard(g, w, h) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#120c27'); sky.addColorStop(0.32, '#2a1537'); sky.addColorStop(0.58, '#5a2540'); sky.addColorStop(0.78, '#a2442f'); sky.addColorStop(1, '#3a1810');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const R = mkRand(77);
  for (let i = 0; i < 70; i++) {                                                   // stars in the upper sky
    const x = R() * w, y = R() * h * 0.42, r = 0.6 + R() * 1.3;
    g.fillStyle = `rgba(255,240,220,${0.25 + R() * 0.5})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  const hy = h * 0.66;                                                               // horizon: a low sun glow behind the compound wall
  const sun = g.createRadialGradient(w * 0.72, hy, 4, w * 0.72, hy, Math.max(w, h) * 0.55);
  sun.addColorStop(0, 'rgba(255,196,110,0.75)'); sun.addColorStop(0.25, 'rgba(255,140,70,0.32)'); sun.addColorStop(1, 'rgba(255,120,60,0)');
  g.fillStyle = sun; g.fillRect(0, 0, w, h);
  // far baobab and palm silhouettes
  g.fillStyle = 'rgba(30,12,22,0.9)';
  const bx = w * 0.14, by = hy + 4;
  g.beginPath(); g.moveTo(bx - 34, by); g.quadraticCurveTo(bx - 20, by - 70, bx - 15, by - 128); g.lineTo(bx + 15, by - 128); g.quadraticCurveTo(bx + 20, by - 70, bx + 34, by); g.closePath(); g.fill();
  for (const [dx, dy, rr] of [[-56, -150, 34], [-22, -176, 40], [18, -178, 40], [56, -150, 34], [0, -150, 44]]) { g.beginPath(); g.ellipse(bx + dx, by + dy, rr, rr * 0.62, 0, 0, TAU); g.fill(); }
  const px = w * 0.92;
  g.strokeStyle = 'rgba(30,12,22,0.9)'; g.lineWidth = 7; g.beginPath(); g.moveTo(px, by); g.quadraticCurveTo(px - 14, by - 90, px - 6, by - 190); g.stroke();
  g.lineWidth = 5;
  for (let k = 0; k < 7; k++) { const a = -2.6 + k * 0.52; g.beginPath(); g.moveTo(px - 6, by - 190); g.quadraticCurveTo(px - 6 + Math.cos(a) * 44, by - 190 + Math.sin(a) * 30 - 14, px - 6 + Math.cos(a) * 82, by - 190 + Math.sin(a) * 52 + 22); g.stroke(); }
  // mud-brick compound wall with an arched doorway lit from inside
  const wallTop = hy - 6;
  const wall = g.createLinearGradient(0, wallTop, 0, h);
  wall.addColorStop(0, '#6f3426'); wall.addColorStop(0.5, '#4b2219'); wall.addColorStop(1, '#2a120e');
  g.fillStyle = wall; g.fillRect(0, wallTop, w, h - wallTop);
  g.fillStyle = 'rgba(40,16,10,0.9)';
  for (let x = -10; x < w + 30; x += 46) { g.fillRect(x, wallTop - 11, 30, 11); }       // the crenellated top
  g.strokeStyle = 'rgba(20,6,4,0.35)'; g.lineWidth = 1.5;                                  // brick courses
  for (let y = wallTop + 26, r = 0; y < h; y += 26, r++) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (r % 2) * 32; x < w; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 26); g.stroke(); } }
  const dw = Math.min(150, w * 0.2), dx = w * 0.3, dTop = wallTop + 18, dBot = wallTop + 190;
  const door = g.createLinearGradient(0, dTop, 0, dBot); door.addColorStop(0, '#ffcf86'); door.addColorStop(1, '#e8862e');
  g.fillStyle = door; g.beginPath(); g.moveTo(dx - dw / 2, dBot); g.lineTo(dx - dw / 2, dTop + dw / 2); g.arc(dx, dTop + dw / 2, dw / 2, Math.PI, 0); g.lineTo(dx + dw / 2, dBot); g.closePath(); g.fill();
  g.fillStyle = 'rgba(30,10,6,0.35)'; g.fillRect(dx - dw / 2, dBot - 10, dw, 10);
  const glow = g.createRadialGradient(dx, dBot, 6, dx, dBot, dw * 2.4); glow.addColorStop(0, 'rgba(255,170,80,0.38)'); glow.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = glow; g.fillRect(0, wallTop, w, h - wallTop);
  const v = g.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.78);   // vignette
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(8,3,10,0.62)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
}

// The courtyard behind everything. `pulse` 0..1 is the beat; the string of lamps and the fireflies move.
export function drawBackdrop(ctx, w, h, t, pulse = 0, opt = {}) {
  const c = cached(`bg${Math.round(w)}x${Math.round(h)}`, w, h, 1.15, paintCourtyard);
  if (c) ctx.drawImage(c, 0, 0, w, h);
  else { const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#120c27'); gr.addColorStop(0.6, '#5a2540'); gr.addColorStop(1, '#3a1810'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); }
  if (!opt.noLamps) drawLamps(ctx, w, h, t, pulse);
  if (!opt.noFlies) drawFireflies(ctx, w, h, t, opt.flies ?? 18);
}

// A string of little lamps swaying across the top of the courtyard.
function drawLamps(ctx, w, h, t, pulse) {
  ctx.save();
  const n = Math.max(7, Math.round(w / 90)), y0 = h * 0.012 + 8, sag = Math.min(70, w * 0.07);
  ctx.strokeStyle = 'rgba(40,18,12,0.8)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const k = i / 40, x = k * w, y = y0 + Math.sin(k * Math.PI) * sag; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n, x = k * w, y = y0 + Math.sin(k * Math.PI) * sag + 8 + Math.sin(t * 0.8 + i) * 1.5;
    const a = 0.55 + 0.2 * Math.sin(t * 2.1 + i * 1.9) + 0.15 * pulse;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 22); g.addColorStop(0, `rgba(255,214,140,${a})`); g.addColorStop(0.35, `rgba(255,160,70,${a * 0.4})`); g.addColorStop(1, 'rgba(255,140,50,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function drawFireflies(ctx, w, h, t, n = 18) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const bx = ((i * 211.3) % w), by = h * (0.3 + 0.55 * ((i * 0.37) % 1));
    const x = bx + Math.sin(t * 0.35 + i * 2.1) * 46 + Math.sin(t * 0.9 + i) * 10, y = by + Math.cos(t * 0.3 + i * 1.3) * 34;
    const a = Math.max(0, Math.sin(t * 1.1 + i * 2.7)) ** 2 * 0.8, r = 1.8 + (i % 3) * 0.7;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, `rgba(210,255,150,${a})`); g.addColorStop(1, 'rgba(180,255,110,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// A woven mat on the ground with the lamp-light pooling on it (under the calabash on the stage).
export function drawMat(ctx, w, h, topY, cx, pulse = 0) {
  const g = ctx.createLinearGradient(0, topY, 0, h);
  g.addColorStop(0, 'rgba(60,24,16,0)'); g.addColorStop(0.22, 'rgba(78,34,20,0.78)'); g.addColorStop(1, 'rgba(26,10,10,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, topY, w, h - topY);
  ctx.save(); ctx.beginPath(); ctx.rect(0, topY, w, h - topY); ctx.clip();
  ctx.lineWidth = 2;
  for (let k = 1; k < 9; k++) { const y = topY + 10 + (h - topY - 10) * Math.pow(k / 9, 1.6); ctx.strokeStyle = `rgba(255,200,140,${0.035 + 0.02 * k / 9})`; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  for (let i = -14; i <= 14; i++) { ctx.strokeStyle = 'rgba(255,200,140,0.04)'; ctx.beginPath(); ctx.moveTo(cx + i * 36, topY + 10); ctx.lineTo(cx + i * 120, h); ctx.stroke(); }
  const sp = ctx.createRadialGradient(cx, topY + (h - topY) * 0.3, 10, cx, topY + (h - topY) * 0.3, Math.max(w * 0.6, 300));
  sp.addColorStop(0, `rgba(255,190,120,${0.3 + 0.08 * pulse})`); sp.addColorStop(0.5, 'rgba(255,150,90,0.09)'); sp.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = sp; ctx.fillRect(0, topY, w, h - topY);
  ctx.restore();
}

// ---- the calabash --------------------------------------------------------------------------------------------------------------------------------------
// The face of the instrument seen from above: an elliptical gourd rim, a cowhide face laced with brass tacks, two sound holes.
function paintGourd(g, rx, ry) {
  const W = rx * 2 + 40, H = ry * 2 + 40, cx = W / 2, cy = H / 2, R = mkRand(31);
  // the gourd shell: warm amber varnish, brighter on the upper left
  const sh = g.createLinearGradient(cx - rx, cy - ry, cx + rx * 0.8, cy + ry);
  sh.addColorStop(0, '#f2b873'); sh.addColorStop(0.35, '#c27a35'); sh.addColorStop(0.75, '#7a3d18'); sh.addColorStop(1, '#3d1c0a');
  g.fillStyle = sh; g.beginPath(); g.ellipse(cx, cy, rx * 1.04, ry * 1.04, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(60,24,8,0.28)'; g.lineWidth = 1.2;
  for (let k = 0; k < 16; k++) { const a = R() * TAU, rr = 0.9 + R() * 0.1; g.beginPath(); g.ellipse(cx, cy, rx * rr, ry * rr, 0, a, a + 0.5 + R()); g.stroke(); }
  // the face
  const fx = rx * 0.92, fy = ry * 0.92;
  const sk = g.createRadialGradient(cx - fx * 0.25, cy - fy * 0.3, fx * 0.1, cx, cy, fx * 1.1);
  sk.addColorStop(0, '#f6e8c4'); sk.addColorStop(0.55, '#e3cb98'); sk.addColorStop(1, '#b89a64');
  g.fillStyle = sk; g.beginPath(); g.ellipse(cx, cy, fx, fy, 0, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.ellipse(cx, cy, fx, fy, 0, 0, TAU); g.clip();
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(120,84,40,${0.04 + R() * 0.07})`; g.beginPath(); g.ellipse(cx + (R() - 0.5) * fx * 2, cy + (R() - 0.5) * fy * 2, 2 + R() * 12, 1 + R() * 5, R() * 3, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(130,90,48,0.16)'; g.lineWidth = 1.2;                           // faint creases of the hide
  for (let i = 0; i < 7; i++) { const x0 = cx + (R() - 0.5) * fx * 1.6, y0 = cy + (R() - 0.5) * fy * 1.6; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + (R() - 0.5) * 80, y0 + (R() - 0.5) * 40, x0 + (R() - 0.5) * 140, y0 + (R() - 0.5) * 60); g.stroke(); }
  const inner = g.createRadialGradient(cx, cy, fx * 0.5, cx, cy, fx * 1.05); inner.addColorStop(0, 'rgba(60,24,8,0)'); inner.addColorStop(1, 'rgba(60,24,8,0.4)');
  g.fillStyle = inner; g.fillRect(0, 0, W, H);
  g.restore();
  // a ring of brass tacks
  const tacks = 34;
  for (let i = 0; i < tacks; i++) {
    const a = (i / tacks) * TAU, x = cx + Math.cos(a) * rx * 0.865, y = cy + Math.sin(a) * ry * 0.865, r = Math.max(2.2, rx * 0.0105);
    g.fillStyle = 'rgba(40,16,6,0.55)'; g.beginPath(); g.arc(x + 1, y + 1.6, r * 1.1, 0, TAU); g.fill();
    const tg = g.createRadialGradient(x - r * 0.3, y - r * 0.35, 0.3, x, y, r * 1.1); tg.addColorStop(0, '#fff2b8'); tg.addColorStop(0.5, '#d9a63e'); tg.addColorStop(1, '#7a5214');
    g.fillStyle = tg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  // two sound holes in the shell below the face edge: dark with a lit lip
  for (const s of [-1, 1]) {
    const hx = cx + s * rx * 0.46, hy = cy + ry * 0.38, hr = rx * 0.085;
    g.fillStyle = 'rgba(40,16,6,0.4)'; g.beginPath(); g.ellipse(hx, hy + 2, hr * 1.25, hr * 0.7, 0, 0, TAU); g.fill();
    const hg = g.createRadialGradient(hx, hy, 1, hx, hy, hr); hg.addColorStop(0, '#0a0404'); hg.addColorStop(1, '#2a1208');
    g.fillStyle = hg; g.beginPath(); g.ellipse(hx, hy, hr, hr * 0.56, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,210,150,0.5)'; g.lineWidth = 1.8; g.beginPath(); g.ellipse(hx, hy, hr, hr * 0.56, 0, 0.15, Math.PI - 0.15); g.stroke();
  }
  // soft sheen on the upper left of the shell
  const sheen = g.createRadialGradient(cx - rx * 0.55, cy - ry * 0.75, 2, cx - rx * 0.55, cy - ry * 0.75, rx * 0.6); sheen.addColorStop(0, 'rgba(255,230,190,0.28)'); sheen.addColorStop(1, 'rgba(255,230,190,0)');
  g.fillStyle = sheen; g.beginPath(); g.ellipse(cx, cy, rx * 1.04, ry * 1.04, 0, 0, TAU); g.fill();
}

// Draw the calabash face centred at (cx, cy). `glow` 0..1 warms the skin when strings sound. Returns nothing.
export function drawCalabash(ctx, cx, cy, rx, ry, glow = 0) {
  const sc = rx > 500 ? 0.8 : 1.15, key = `gourd${Math.round(rx / 4)}x${Math.round(ry / 4)}`;
  const c = cached(key, rx * 2 + 40, ry * 2 + 40, sc, (g) => paintGourd(g, rx, ry));
  // ground shadow
  ctx.save();
  const sg = ctx.createRadialGradient(cx, cy + ry * 1.0, rx * 0.2, cx, cy + ry * 1.0, rx * 1.2); sg.addColorStop(0, 'rgba(10,3,4,0.55)'); sg.addColorStop(1, 'rgba(10,3,4,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(cx, cy + ry * 1.0, rx * 1.2, ry * 0.5, 0, 0, TAU); ctx.fill();
  if (c) ctx.drawImage(c, cx - rx - 20, cy - ry - 20, rx * 2 + 40, ry * 2 + 40);
  else { ctx.fillStyle = '#c27a35'; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill(); ctx.fillStyle = PAL.skin; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, 0, TAU); ctx.fill(); }
  if (glow > 0.01) { ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(cx, cy - ry * 0.3, 4, cx, cy - ry * 0.3, rx * 0.95); gg.addColorStop(0, `rgba(255,190,100,${0.3 * glow})`); gg.addColorStop(1, 'rgba(255,190,100,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// The bridge: a carved wooden bar standing on the skin, two rows of notches for the two rows of strings. x0..x1 spans the strings.
export function drawBridge(ctx, x0, x1, y, h, glow = 0) {
  ctx.save();
  const w = x1 - x0;
  ctx.fillStyle = 'rgba(30,10,4,0.45)'; ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, y + h * 0.9, w / 2 + 10, h * 0.5, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, y - h * 0.5, 0, y + h * 0.6);
  g.addColorStop(0, '#e2a76a'); g.addColorStop(0.3, '#a8622d'); g.addColorStop(1, '#4d230e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x0 - 8, y - h * 0.5, w + 16, h, h * 0.4); ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,190,0.5)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x0 + 6, y - h * 0.5 + 2); ctx.lineTo(x1 - 6, y - h * 0.5 + 2); ctx.stroke();
  if (glow > 0.01) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,190,100,${0.35 * glow})`; ctx.beginPath(); ctx.roundRect(x0 - 8, y - h * 0.5, w + 16, h, h * 0.4); ctx.fill(); }
  ctx.restore();
}

// A hand post: a wooden rod with a leather-wrapped grip, from (x0, y0) at the base to (x1, y1) at the tip.
export function drawPost(ctx, x0, y0, x1, y1, thick) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(20,6,2,0.5)'; ctx.lineWidth = thick + 4; ctx.beginPath(); ctx.moveTo(x0 + 3, y0 + 4); ctx.lineTo(x1 + 3, y1 + 4); ctx.stroke();
  const g = ctx.createLinearGradient(x0 - thick, 0, x0 + thick, 0); g.addColorStop(0, '#c88b52'); g.addColorStop(0.5, '#8a4b25'); g.addColorStop(1, '#3f200f');
  ctx.strokeStyle = g; ctx.lineWidth = thick; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,225,180,0.35)'; ctx.lineWidth = Math.max(1.5, thick * 0.18); ctx.beginPath(); ctx.moveTo(x0 - thick * 0.22, y0); ctx.lineTo(x1 - thick * 0.22, y1); ctx.stroke();
  const wraps = 5;
  for (let i = 0; i < wraps; i++) { const k = 0.18 + i * 0.05, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k; ctx.strokeStyle = '#5b2f1a'; ctx.lineWidth = thick * 0.3; ctx.beginPath(); ctx.moveTo(x - thick * 0.55, y); ctx.lineTo(x + thick * 0.55, y); ctx.stroke(); }
  ctx.restore();
}

// ---- strings -----------------------------------------------------------------------------------------------------------------------------------------------
// One string from (x0, y0) (far end) to (x1, y1) (the bridge). amp 0..1 is how much it is sounding; hand picks the glow colour.
export function drawString(ctx, x0, y0, x1, y1, idx, amp, t, o = {}) {
  const thick = (o.thick ?? 3.4) * (1.45 - 0.9 * (idx / (STRING_COUNT - 1))), dim = o.dim ?? 1;
  ctx.save(); ctx.lineCap = 'round';
  const fade = ctx.createLinearGradient(x0, y0, x1, y1);
  fade.addColorStop(0, `rgba(246,236,208,0)`); fade.addColorStop(0.35, `rgba(246,236,208,${0.5 * dim})`); fade.addColorStop(1, `rgba(255,248,226,${0.92 * dim})`);
  if (amp > 0.02) {
    const col = handRGB(handOf(idx)), segs = 14;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${col},${(dim < 1 ? 0.22 : 0.5) * amp})`; ctx.lineWidth = thick * (dim < 1 ? 3 : 5.5); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    ctx.strokeStyle = dim < 1 ? 'rgba(255,251,232,0.7)' : '#fffbe8'; ctx.lineWidth = thick * (1 + 0.5 * amp); ctx.beginPath();
    for (let k = 0; k <= segs; k++) {
      const u = k / segs, off = Math.sin(u * Math.PI) * Math.sin(t * 95 + idx * 1.7 + u * 6) * 5.5 * amp * (0.5 + 0.5 * u);
      const x = x0 + dx * u + nx * off, y = y0 + dy * u + ny * off; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  } else {
    ctx.strokeStyle = fade; ctx.lineWidth = thick; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * dim})`; ctx.lineWidth = Math.max(0.8, thick * 0.3); ctx.beginPath(); ctx.moveTo(x0 - thick * 0.25, y0); ctx.lineTo(x1 - thick * 0.25, y1); ctx.stroke();
  }
  ctx.restore();
}

// ---- notes -------------------------------------------------------------------------------------------------------------------------------------------------------
// A pluck bead sliding down its string. hand 'L' | 'R' picks amber or teal; soft = smaller/paler; ghost = the teacher's note (a ring only).
export function drawNote(ctx, x, y, r, hand, soft = false, label = null, alpha = 1, ghost = false) {
  const rr = soft ? r * 0.8 : r, col = handColor(hand), rgb = handRGB(hand);
  ctx.save(); ctx.globalAlpha = alpha;
  if (ghost) {
    ctx.strokeStyle = `rgba(${rgb},0.8)`; ctx.lineWidth = Math.max(2.5, rr * 0.2); ctx.beginPath(); ctx.arc(x, y, rr * 0.9, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(${rgb},0.16)`; ctx.beginPath(); ctx.arc(x, y, rr * 0.9, 0, TAU); ctx.fill();
  } else {
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(x, y, rr * 0.4, x, y, rr * 1.9); hg.addColorStop(0, `rgba(${rgb},${soft ? 0.3 : 0.5})`); hg.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, rr * 1.9, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(14,6,10,0.55)'; ctx.beginPath(); ctx.arc(x + rr * 0.06, y + rr * 0.14, rr * 1.02, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(x - rr * 0.32, y - rr * 0.38, rr * 0.08, x, y, rr);
    if (hand === 'L') { g.addColorStop(0, soft ? '#fff0cf' : '#fff6dc'); g.addColorStop(0.45, soft ? '#ffc477' : '#ffb347'); g.addColorStop(1, soft ? '#c07a28' : '#b8661a'); }
    else { g.addColorStop(0, soft ? '#ecfffb' : '#f2fffd'); g.addColorStop(0.45, soft ? '#86e2d6' : '#5fd6c8'); g.addColorStop(1, soft ? '#2f8c85' : '#1f7d77'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(2, rr * 0.1); ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = Math.max(1.2, rr * 0.06); ctx.beginPath(); ctx.arc(x, y, rr * 0.7, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
  }
  if (label && !ghost && rr > 15) {
    ctx.font = `700 ${Math.round(rr * 0.7)}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = hand === 'L' ? '#4a2406' : '#06332f'; ctx.fillText(label, x, y + rr * 0.05);
  }
  void col;
  ctx.restore();
}

// ---- fingers -----------------------------------------------------------------------------------------------------------------------------------------------------
// A thumb or an index finger seen from the player's side, rising from below the instrument with its tip up at the strings.
// (x, tipY) is the fingertip; the finger tapers down to bottomY where it fades into the shadow of the hands. glow 0..1 lights the tip.
export function drawFinger(ctx, x, tipY, size, kind, hand, bottomY, glow = 0) {
  const thumb = kind === 'thumb', w = size * (thumb ? 1.0 : 0.74), w2 = w * 1.45;
  ctx.save();
  const path = () => {
    ctx.beginPath(); ctx.moveTo(x - w / 2, tipY + w / 2);
    ctx.arc(x, tipY + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w2 / 2, bottomY); ctx.lineTo(x - w2 / 2, bottomY); ctx.closePath();
  };
  ctx.save(); ctx.translate(7, 9); ctx.fillStyle = 'rgba(12,4,6,0.38)'; path(); ctx.fill(); ctx.restore();
  const g = ctx.createLinearGradient(x - w2 / 2, 0, x + w2 / 2, 0);
  g.addColorStop(0, '#d79c6c'); g.addColorStop(0.32, '#b97a4e'); g.addColorStop(0.75, '#8a5233'); g.addColorStop(1, '#5d3322');
  ctx.fillStyle = g; path(); ctx.fill();
  ctx.strokeStyle = 'rgba(40,16,8,0.5)'; ctx.lineWidth = 1.5; path(); ctx.stroke();
  ctx.save(); path(); ctx.clip();
  // the nail catches the light, the pad is a little paler, knuckle creases
  const nail = ctx.createLinearGradient(0, tipY, 0, tipY + w);
  nail.addColorStop(0, 'rgba(255,240,222,0.9)'); nail.addColorStop(1, 'rgba(240,206,176,0.55)');
  ctx.fillStyle = nail; ctx.beginPath(); ctx.roundRect(x - w * 0.28, tipY + w * 0.16, w * 0.56, w * 0.7, w * 0.22); ctx.fill();
  ctx.strokeStyle = 'rgba(60,26,12,0.28)'; ctx.lineWidth = 1.6;
  const len = bottomY - tipY;
  for (const k of thumb ? [0.45] : [0.38, 0.62]) { const yy = tipY + len * k, ww = w * (1 + 0.45 * k) * 0.42; ctx.beginPath(); ctx.moveTo(x - ww, yy); ctx.quadraticCurveTo(x, yy + 5, x + ww, yy); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,230,200,0.16)'; ctx.fillRect(x - w * 0.34, tipY + w, w * 0.12, len);
  const fade = ctx.createLinearGradient(0, bottomY - len * 0.5, 0, bottomY); fade.addColorStop(0, 'rgba(26,10,12,0)'); fade.addColorStop(1, 'rgba(26,10,12,0.92)');
  ctx.fillStyle = fade; ctx.fillRect(x - w2, bottomY - len * 0.5, w2 * 2, len * 0.5);
  ctx.restore();
  if (glow > 0.01) { ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(x, tipY + w * 0.3, 2, x, tipY + w * 0.3, w * 1.7); gg.addColorStop(0, `rgba(${handRGB(hand)},${0.75 * glow})`); gg.addColorStop(1, `rgba(${handRGB(hand)},0)`); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, tipY + w * 0.3, w * 1.7, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// The judgement word that floats up from a string.
export function drawPopup(ctx, p) {
  const k = clamp01(p.age / 0.8), a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, up = ease(Math.min(1, k * 1.6)) * 46;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sz = p.size * (1 + 0.25 * (1 - Math.min(1, p.age / 0.12)));
  ctx.font = `700 ${sz}px ${DISPLAY}`; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, sz * 0.2); ctx.strokeStyle = 'rgba(16,6,12,0.9)';
  ctx.strokeText(p.text, p.x, p.y - up); ctx.fillStyle = p.col; ctx.fillText(p.text, p.x, p.y - up);
  ctx.restore();
}

// ---- particles ---------------------------------------------------------------------------------------------------------------------------------------------------
export function drawParticles(ctx, list) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of list) {
    const k = p.life / p.max, a = Math.max(0, k), r = p.size * (0.4 + 0.6 * k);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
    g.addColorStop(0, `rgba(${p.c},${0.9 * a})`); g.addColorStop(1, `rgba(${p.c},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
export function stepParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt; if (p.life <= 0) { list.splice(i, 1); continue; }
    p.vy += (p.g ?? 260) * dt; p.vx *= 1 - 1.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
// Sparks that rise from a plucked string; hand picks the colour.
export function burst(list, rng, x, y, n, hand, power = 1) {
  const c = handRGB(hand);
  for (let i = 0; i < n; i++) {
    const a = rng.range(-Math.PI * 0.95, -Math.PI * 0.05), sp = rng.range(90, 330) * power;
    list.push({ x: x + rng.range(-8, 8), y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: rng.range(0.35, 0.8), max: 0.8, size: rng.range(2.5, 6), c: rng.chance(0.25) ? '255,244,214' : c });
  }
  while (list.length > 320) list.shift();
}

// Stars (for results and piece cards): n of 3 filled.
export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.15) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * gap * 1.2;
    ctx.save(); ctx.translate(x, cy);
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? size * 0.22 : size * 0.5; k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    if (i < n) { const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5); g.addColorStop(0, '#fff2b0'); g.addColorStop(1, '#e0a62e'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#7a5410'; ctx.lineWidth = 1.5; ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,240,210,0.3)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.restore();
  }
}

// ---- the hero kora (title, piece cards): the whole instrument seen from the front -----------------------------------------------------------------
// r = radius of the calabash face. vib[0..20] = how much each string is sounding. Strings run from two rows of notches on the bridge up to
// leather rings on the neck: the left row (even strings) to rings on the left of the neck, the right row to rings on the right.
export function drawKoraHero(ctx, cx, cy, r, t, vib = [], o = {}) {
  const neckH = r * 3.0, neckTop = cy - r * 0.2 - neckH, neckW = r * 0.19;
  ctx.save();
  // soft light behind
  const aura = ctx.createRadialGradient(cx, cy - r * 1.2, r * 0.3, cx, cy - r * 1.2, r * 3.2); aura.addColorStop(0, 'rgba(255,170,90,0.28)'); aura.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = aura; ctx.fillRect(cx - r * 3.4, cy - r * 4.6, r * 6.8, r * 6.2);
  // the neck pole (passes behind the face)
  const ng = ctx.createLinearGradient(cx - neckW, 0, cx + neckW, 0); ng.addColorStop(0, '#d39a62'); ng.addColorStop(0.45, '#8f5129'); ng.addColorStop(1, '#3d200f');
  ctx.fillStyle = ng; ctx.beginPath(); ctx.roundRect(cx - neckW, neckTop, neckW * 2, neckH + r * 0.3, neckW * 0.5); ctx.fill();
  ctx.strokeStyle = 'rgba(255,225,180,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - neckW * 0.45, neckTop + 4); ctx.lineTo(cx - neckW * 0.45, cy - r * 0.4); ctx.stroke();
  ctx.fillStyle = '#5b2f1a'; ctx.beginPath(); ctx.roundRect(cx - neckW * 1.25, neckTop - 6, neckW * 2.5, neckW * 1.1, neckW * 0.4); ctx.fill();
  // hand posts, one each side
  drawPost(ctx, cx - r * 0.8, cy - r * 0.05, cx - r * 0.66, cy - r * 1.9, r * 0.075);
  drawPost(ctx, cx + r * 0.8, cy - r * 0.05, cx + r * 0.66, cy - r * 1.9, r * 0.075);
  // the face
  const ry = r * 0.9;
  drawCalabash(ctx, cx, cy, r, ry, o.glow ?? 0);
  // strings: two rows
  const by = cy - ry * 0.4, bw = r * 0.95, ringTop = neckTop + r * 0.3, ringBot = cy - r * 1.0;
  drawBridge(ctx, cx - bw / 2, cx + bw / 2, by, r * 0.11, o.glow ?? 0);
  for (let i = 0; i < STRING_COUNT; i++) {
    const left = i % 2 === 0, row = (i - (left ? 0 : 1)) / 2, rowN = left ? 11 : 10;
    const bx = cx - bw / 2 + 6 + (bw - 12) * (i / (STRING_COUNT - 1)), byi = by - r * 0.045 + (left ? 0 : r * 0.02);
    const rx2 = cx + (left ? -1 : 1) * (neckW * 1.45), ry2 = ringBot - (ringBot - ringTop) * (row / (rowN - 1));
    // leather ring on the neck
    ctx.strokeStyle = '#7b4326'; ctx.lineWidth = Math.max(2, r * 0.018); ctx.beginPath(); ctx.ellipse(cx + (left ? -1 : 1) * neckW * 1.05, ry2, neckW * 0.55, neckW * 0.26, 0, 0, TAU); ctx.stroke();
    drawString(ctx, rx2, ry2, bx, byi, i, vib[i] ?? 0, t, { thick: Math.max(1.4, r * 0.012) });
  }
  ctx.restore();
}
