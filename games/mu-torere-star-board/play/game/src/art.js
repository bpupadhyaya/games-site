// All the art. Everything static is painted ONCE into cached layers (background, board, stone sprites); a frame only
// draws those and the moving light. Motifs (koru spirals, a kowhaiwhai-style band) are pure decoration, used sparingly.
import { W, H, PR, TIP, NOTCH, STONE_R, angleOf, pointPos } from './layout.js';

const TAU = Math.PI * 2;
export const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function layer(w, h, scale, paint) {
  try {
    if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(w * scale, h * scale), x = c.getContext('2d'); x.scale(scale, scale); paint(x); return c; }
  } catch { /* fall through: paint directly each time */ }
  return null;
}

// ---- koru: a spiral frond. Pure decoration. ------------------------------------------------------------------------
export function koru(ctx, x, y, size, rot, color, width, flip = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(flip, 1);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath();
  const turns = 2.35 * TAU, n = 40;
  for (let k = 0; k <= n; k++) {
    const s = k / n, a = Math.PI * 0.5 + s * turns, r = size * (1 - s * 0.94);
    const px = Math.cos(a) * r, py = Math.sin(a) * r - size * 0.15;
    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, size * 0.85 - size * 0.15, width * 0.95, 0, TAU); ctx.fill();   // the bulb where the frond starts
  ctx.beginPath(); ctx.moveTo(0, size * 0.85 - size * 0.15); ctx.quadraticCurveTo(-size * 0.2, size * 1.5, -size * 0.65, size * 1.75); ctx.stroke();
  ctx.restore();
}
// A kowhaiwhai-style band: a row of alternating koru along a line (title and panels).
export function band(ctx, x0, x1, y, size, color, width) {
  const step = size * 2.3; let i = 0;
  for (let x = x0 + step / 2; x < x1; x += step, i++) koru(ctx, x, y, size * 0.5, i % 2 ? Math.PI : 0, color, width, i % 2 ? -1 : 1);
}

// ---- sky and sea (cached) -----------------------------------------------------------------------------------------
function paintBackground(c) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1e4a5a'); g.addColorStop(0.28, '#2b6a72'); g.addColorStop(0.5, '#215a62'); g.addColorStop(0.78, '#12343c'); g.addColorStop(1, '#0a1e24');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // low warm sun, seen through haze
  let r = c.createRadialGradient(150, 250, 10, 150, 250, 560);
  r.addColorStop(0, 'rgba(255,224,168,0.55)'); r.addColorStop(0.4, 'rgba(255,196,140,0.16)'); r.addColorStop(1, 'rgba(255,196,140,0)');
  c.fillStyle = r; c.fillRect(0, 0, W, 900);
  // far hills
  c.fillStyle = 'rgba(14,44,52,0.55)'; c.beginPath(); c.moveTo(0, 470);
  for (let x = 0; x <= W; x += 20) c.lineTo(x, 430 + Math.sin(x * 0.012) * 26 + Math.sin(x * 0.03 + 1) * 10);
  c.lineTo(W, 520); c.lineTo(0, 520); c.fill();
  // sea swell lines
  for (let k = 0; k < 40; k++) {
    const y = 520 + k * 27; c.strokeStyle = `rgba(190,235,230,${0.03 + (k / 40) * 0.02})`; c.lineWidth = 1.5; c.beginPath();
    for (let x = 0; x <= W; x += 16) { const yy = y + Math.sin(x * 0.02 + k * 1.7) * (3 + k * 0.15); if (x === 0) c.moveTo(x, yy); else c.lineTo(x, yy); }
    c.stroke();
  }
  // vignette
  r = c.createRadialGradient(W / 2, H * 0.55, 380, W / 2, H * 0.55, 1000);
  r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,10,14,0.55)'); c.fillStyle = r; c.fillRect(0, 0, W, H);
}
let bg = null, bgTried = false;
export function drawBackground(ctx, t, calm) {
  if (!bgTried) { bgTried = true; bg = layer(W, H, 1, paintBackground); }
  if (bg) ctx.drawImage(bg, 0, 0, W, H); else paintBackground(ctx);
  // drifting glints on the water and slow light bands (cheap: a few strokes)
  ctx.save();
  const sp = calm ? 0.2 : 1;
  for (let k = 0; k < 7; k++) {
    const y = 560 + k * 170 + Math.sin(t * 0.3 * sp + k) * 10, x = ((k * 233 + t * 14 * sp) % (W + 200)) - 100, a = 0.05 + 0.05 * Math.sin(t * 0.8 * sp + k * 2);
    ctx.strokeStyle = `rgba(255,236,200,${Math.max(0.01, a)})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 50, y); ctx.quadraticCurveTo(x, y - 5, x + 50, y); ctx.stroke();
  }
  // a few motes of light drifting up from the water
  for (let k = 0; k < 16; k++) {
    const x = (k * 97 + Math.sin(t * 0.25 * sp + k) * 30) % W, y = H - ((k * 211 + t * 12 * sp) % (H - 500)), a2 = 0.10 + 0.08 * Math.sin(t * 0.9 + k * 1.3);
    ctx.fillStyle = `rgba(255,240,205,${Math.max(0.02, a2)})`; ctx.beginPath(); ctx.arc(x < 0 ? x + W : x, y, 2 + (k % 3), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- the board (cached) ------------------------------------------------------------------------------------------
function starPath(c, k = 1) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = angleOf(i), n = a + Math.PI / 8;
    c.lineTo(Math.cos(a) * TIP * k, Math.sin(a) * TIP * k);
    c.lineTo(Math.cos(n) * NOTCH * k, Math.sin(n) * NOTCH * k);
  }
  c.closePath();
}
export const BOARD_BOX = 400;   // half-size of the cached square
function paintBoard(c) {
  c.translate(BOARD_BOX, BOARD_BOX);
  // soft shadow on the water
  c.save(); c.shadowColor = 'rgba(0,10,12,0.6)'; c.shadowBlur = 40; c.shadowOffsetY = 26; c.fillStyle = '#000'; starPath(c); c.lineJoin = 'round'; c.lineWidth = 16; c.strokeStyle = '#000'; c.fill(); c.stroke(); c.restore();
  // body of the carving
  c.lineJoin = 'round';
  const body = c.createRadialGradient(-70, -90, 20, 0, 0, TIP * 1.05);
  body.addColorStop(0, '#a56a3c'); body.addColorStop(0.55, '#7a4626'); body.addColorStop(1, '#44230f');
  starPath(c); c.fillStyle = body; c.strokeStyle = body; c.lineWidth = 16; c.fill(); c.stroke();
  // grain, clipped to the star
  c.save(); starPath(c); c.clip();
  for (let y = -TIP - 20; y < TIP + 20; y += 5) {
    const dark = 0.05 + 0.09 * (0.5 + 0.5 * Math.sin(y * 0.37 + Math.sin(y * 0.11) * 3));
    c.strokeStyle = `rgba(36,16,6,${dark})`; c.lineWidth = 1 + 1.6 * (0.5 + 0.5 * Math.sin(y * 0.9)); c.beginPath();
    for (let x = -TIP - 20; x <= TIP + 20; x += 12) { const yy = y + Math.sin(x * 0.014 + y * 0.09) * 5 + Math.sin(x * 0.05 + y) * 1.2; if (x < -TIP) c.moveTo(x, yy); else c.lineTo(x, yy); }
    c.stroke();
  }
  for (let y = -TIP; y < TIP; y += 23) { c.strokeStyle = 'rgba(255,214,160,0.06)'; c.lineWidth = 2; c.beginPath(); for (let x = -TIP; x <= TIP; x += 12) { const yy = y + Math.sin(x * 0.02 + y * 0.3) * 6; if (x === -TIP) c.moveTo(x, yy); else c.lineTo(x, yy); } c.stroke(); }
  // soft light from the upper left across the carving
  const li = c.createLinearGradient(-TIP, -TIP, TIP, TIP); li.addColorStop(0, 'rgba(255,230,190,0.22)'); li.addColorStop(0.5, 'rgba(255,230,190,0)'); li.addColorStop(1, 'rgba(0,0,0,0.3)');
  c.fillStyle = li; c.fillRect(-TIP, -TIP, TIP * 2, TIP * 2);
  c.restore();
  // bevel: lit edge top-left, shade bottom-right
  c.save(); starPath(c); c.clip(); c.lineWidth = 9;
  c.translate(3, 3); c.strokeStyle = 'rgba(20,8,2,0.55)'; starPath(c); c.stroke(); c.translate(-6, -6); c.strokeStyle = 'rgba(255,225,180,0.5)'; starPath(c); c.stroke(); c.restore();
  starPath(c); c.strokeStyle = 'rgba(30,12,4,0.9)'; c.lineWidth = 2.5; c.stroke();
  // inlaid greenstone line following the star
  starPath(c, 0.915); c.strokeStyle = 'rgba(10,30,22,0.7)'; c.lineWidth = 8; c.stroke();
  starPath(c, 0.915); c.strokeStyle = '#7fc9a5'; c.lineWidth = 3.4; c.stroke();
  starPath(c, 0.915); c.strokeStyle = 'rgba(230,255,240,0.55)'; c.lineWidth = 1; c.translate(-1, -1); c.stroke(); c.translate(1, 1);
  // koru in each notch: carved shadow, then the lit fill
  for (let i = 0; i < 8; i++) {
    const a = angleOf(i) + Math.PI / 8, x = Math.cos(a) * 118, y = Math.sin(a) * 118;
    koru(c, x + 1.5, y + 2, 26, a + Math.PI / 2, 'rgba(255,220,170,0.28)', 6, i % 2 ? 1 : -1);
    koru(c, x, y, 26, a + Math.PI / 2, '#2b1408', 6, i % 2 ? 1 : -1);
  }
  // carved grooves: the rim between neighbouring points and the eight lines to the putahi
  const P = Array.from({ length: 8 }, (_, i) => ({ x: Math.cos(angleOf(i)) * PR, y: Math.sin(angleOf(i)) * PR }));
  const line = (draw) => { c.lineCap = 'round'; for (const [w, col, ox, oy] of [[13, 'rgba(255,214,160,0.3)', 1, 2], [12, '#24110a', 0, 0], [5.5, '#3f9c78', 0, 0], [1.6, 'rgba(225,255,240,0.6)', -1, -1.4]]) { c.lineWidth = w; c.strokeStyle = col; c.save(); c.translate(ox, oy); draw(); c.stroke(); c.restore(); } };
  line(() => { c.beginPath(); for (let i = 0; i < 8; i++) { const p = P[i]; if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); } c.closePath(); });
  line(() => { c.beginPath(); for (let i = 0; i < 8; i++) { c.moveTo(0, 0); c.lineTo(P[i].x, P[i].y); } });
  // the putahi and the eight hollows
  const hollow = (x, y, r) => {
    let g = c.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r * 1.1);
    g.addColorStop(0, '#0f0704'); g.addColorStop(0.75, '#2a140a'); g.addColorStop(1, '#3d2010');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,220,170,0.5)'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r + 1.5, Math.PI * 0.05, Math.PI * 0.95); c.stroke();
    c.strokeStyle = 'rgba(10,4,2,0.8)'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r + 1.5, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
  };
  for (const p of P) { hollow(p.x, p.y, 51); c.strokeStyle = 'rgba(127,201,165,0.55)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, 58, 0, TAU); c.stroke(); }
  hollow(0, 0, 66); c.strokeStyle = '#7fc9a5'; c.lineWidth = 3.4; c.beginPath(); c.arc(0, 0, 76, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(20,50,38,0.7)'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 82, 0, TAU); c.stroke();
}
let brd = null, brdTried = false;
export function drawBoard(ctx, cx, cy, k = 1) {
  if (!brdTried) { brdTried = true; brd = layer(BOARD_BOX * 2, BOARD_BOX * 2, 2, paintBoard); }
  if (brd) ctx.drawImage(brd, cx - BOARD_BOX * k, cy - BOARD_BOX * k, BOARD_BOX * 2 * k, BOARD_BOX * 2 * k);
  else { ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); paintBoard(ctx); ctx.restore(); }
}

// ---- stones (sprites): pale shell and greenstone ------------------------------------------------------------------
const S = 64;   // sprite half-size in units at scale 2
function paintStone(c, kind) {
  c.translate(S, S); const R = STONE_R;
  // contact shadow inside the sprite
  c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(4, R * 0.32 + 8, R * 0.95, R * 0.55, 0, 0, TAU); c.fill();
  let g;
  if (kind === 1) {
    g = c.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.05);
    g.addColorStop(0, '#fffdf6'); g.addColorStop(0.55, '#f0e4cc'); g.addColorStop(0.92, '#c9b490'); g.addColorStop(1, '#a38d68');
  } else {
    g = c.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.05);
    g.addColorStop(0, '#8fd8b0'); g.addColorStop(0.45, '#3f9a72'); g.addColorStop(0.9, '#1c5c45'); g.addColorStop(1, '#0f3a2c');
  }
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
  c.save(); c.beginPath(); c.arc(0, 0, R - 0.5, 0, TAU); c.clip();
  if (kind === 1) {
    // shell: nacre bands and fine growth ridges
    for (let k = 1; k < 7; k++) { c.strokeStyle = `rgba(${k % 2 ? '255,190,200' : '170,225,235'},0.22)`; c.lineWidth = 3.2; c.beginPath(); c.arc(-R * 0.15, R * 0.1, R * (0.2 + k * 0.13), Math.PI * 0.15, Math.PI * 1.25); c.stroke(); }
    for (let k = 0; k < 9; k++) { c.strokeStyle = 'rgba(140,110,70,0.13)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, R * (0.25 + k * 0.09), 0, TAU); c.stroke(); }
  } else {
    // greenstone: cloudy translucent veins
    for (let k = 0; k < 6; k++) { c.strokeStyle = `rgba(190,245,215,${0.1 + 0.05 * (k % 3)})`; c.lineWidth = 2 + (k % 3); c.beginPath(); c.moveTo(-R, -R * 0.5 + k * 13); c.bezierCurveTo(-R * 0.3, -R * 0.9 + k * 10, R * 0.2, R * 0.2 - k * 6, R, -R * 0.2 + k * 8); c.stroke(); }
    c.fillStyle = 'rgba(8,40,30,0.25)'; c.beginPath(); c.ellipse(R * 0.3, R * 0.45, R * 0.7, R * 0.35, -0.4, 0, TAU); c.fill();
  }
  c.restore();
  // rim light and specular
  c.strokeStyle = kind === 1 ? 'rgba(120,96,60,0.55)' : 'rgba(4,28,20,0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, R - 1, 0, TAU); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.ellipse(-R * 0.36, -R * 0.42, R * 0.22, R * 0.12, -0.7, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.ellipse(R * 0.32, R * 0.4, R * 0.28, R * 0.08, -0.5, 0, TAU); c.fill();
}
const stones = {};
export function drawStone(ctx, kind, x, y, r = STONE_R, o = {}) {
  if (!(kind in stones)) stones[kind] = layer(S * 2, S * 2, 2, (c) => paintStone(c, kind));
  const k = r / STONE_R, lift = o.lift || 0;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (lift) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 3, y + r * 0.62 + 4, r * 0.8, r * 0.36, 0, 0, TAU); ctx.fill(); }
  if (stones[kind]) ctx.drawImage(stones[kind], x - S * k, y - S * k - lift, S * 2 * k, S * 2 * k);
  else { ctx.translate(x, y - lift); ctx.scale(k, k); paintStone(ctx, kind); }
  ctx.restore();
}
export { pointPos };
