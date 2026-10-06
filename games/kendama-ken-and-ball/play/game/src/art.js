// Drawing for the ken, the ball, the string and the dusk scene behind them. Everything is canvas paths and gradients,
// no image files. The backdrop is painted once into an off-screen canvas (when the host has one) and then blitted.
import { R, L, W, H, anchorOf, CUPS } from './phys.js';

const TAU = Math.PI * 2;
export const COL = {
  big: '#3f78e0', small: '#2fb592', spike: '#f0bd3c', base: '#9a67d8', any: '#f0bd3c',
  ball: '#d9402b', ballDark: '#8d1c10', wood: '#e9cf9c', woodMid: '#c99f62', woodDark: '#8c6637', ink: '#232844',
};
export const FLOOR_Y = 1088;

// ---- off-screen canvas -------------------------------------------------------------------------
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
const newCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
};

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

// ---- backdrop ----------------------------------------------------------------------------------
function bamboo(ctx, x, top, bot, wdt, rnd, tilt = 0) {
  ctx.save();
  const seg = 150 + rnd() * 40;
  let y = bot;
  ctx.fillStyle = '#0c1a2c';
  while (y > top) {
    const y2 = Math.max(top, y - seg);
    const xo = (bot - y) * tilt, xo2 = (bot - y2) * tilt;
    ctx.beginPath(); ctx.moveTo(x - wdt / 2 + xo, y); ctx.lineTo(x - wdt / 2 + xo2, y2); ctx.lineTo(x + wdt / 2 + xo2, y2); ctx.lineTo(x + wdt / 2 + xo, y); ctx.closePath(); ctx.fill();
    // node band
    ctx.fillStyle = '#16304a';
    ctx.fillRect(x - wdt / 2 - 3 + xo2, y2 - 4, wdt + 6, 8);
    ctx.fillStyle = '#0c1a2c';
    // leaves
    if (y2 > top + 60 && rnd() < 0.8) {
      for (let k = 0; k < 3; k++) {
        const dir = rnd() < 0.5 ? -1 : 1, ln = 70 + rnd() * 50, ly = y2 + 4 + k * 6;
        ctx.beginPath(); ctx.moveTo(x + xo2, ly);
        ctx.quadraticCurveTo(x + xo2 + dir * ln * 0.55, ly - 18 - k * 4, x + xo2 + dir * ln, ly + 20 + k * 6);
        ctx.quadraticCurveTo(x + xo2 + dir * ln * 0.5, ly - 2, x + xo2, ly + 4); ctx.fill();
      }
    }
    y = y2;
  }
  ctx.restore();
}

export function paintBackdrop(ctx) {
  const rnd = lcg(11);
  // sky
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0f1538'); g.addColorStop(0.34, '#243472'); g.addColorStop(0.62, '#6a5a98'); g.addColorStop(0.8, '#d98a82'); g.addColorStop(0.9, '#f0b78a'); g.addColorStop(1, '#2a2438');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // stars
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W, y = rnd() * 560, a = 0.25 + rnd() * 0.6, r = 0.6 + rnd() * 1.4;
    ctx.fillStyle = `rgba(255,248,230,${a})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  // moon with a soft halo
  const mx = 548, my = 300;
  g = ctx.createRadialGradient(mx, my, 20, mx, my, 330);
  g.addColorStop(0, 'rgba(255,236,196,0.55)'); g.addColorStop(0.35, 'rgba(255,214,170,0.16)'); g.addColorStop(1, 'rgba(255,214,170,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 700);
  g = ctx.createRadialGradient(mx - 24, my - 28, 8, mx, my, 96);
  g.addColorStop(0, '#fffaf0'); g.addColorStop(0.75, '#f7e6c2'); g.addColorStop(1, '#ecd2a2');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 92, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(190,160,120,0.22)';
  [[-30, -10, 22], [26, 28, 16], [10, -38, 12], [-8, 44, 10]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, TAU); ctx.fill(); });
  // thin clouds
  for (let i = 0; i < 5; i++) {
    const cy = 220 + i * 120 + rnd() * 30, cx = rnd() * W;
    ctx.fillStyle = `rgba(255,236,220,${0.05 + rnd() * 0.06})`;
    rr(ctx, cx - 220, cy, 440 + rnd() * 100, 12 + rnd() * 10, 12); ctx.fill();
  }
  // far hills
  const hill = (base, amp, col, seed, steps = 36) => {
    const r2 = lcg(seed);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
    let ph = r2() * 6;
    for (let i = 0; i <= steps; i++) { const x = (i / steps) * W; const y = base - amp * (0.5 + 0.5 * Math.sin(ph + i * 0.37)) - amp * 0.5 * Math.sin(ph * 1.7 + i * 0.83); ctx.lineTo(x, y); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  };
  hill(930, 70, 'rgba(70,64,118,0.9)', 3);
  hill(985, 56, 'rgba(46,42,92,0.95)', 7);
  // mist
  g = ctx.createLinearGradient(0, 900, 0, 1100); g.addColorStop(0, 'rgba(255,214,190,0)'); g.addColorStop(0.5, 'rgba(255,214,190,0.22)'); g.addColorStop(1, 'rgba(255,214,190,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 900, W, 200);
  // wave pattern ribbon (seigaiha) along the horizon
  ctx.save(); ctx.beginPath(); ctx.rect(0, 1010, W, 90); ctx.clip();
  ctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) {
    for (let i = -1; i < 14; i++) {
      const cx = i * 56 + (row % 2 ? 28 : 0), cy = 1020 + row * 22;
      for (let k = 3; k >= 1; k--) {
        ctx.strokeStyle = `rgba(250,226,204,${0.1 + 0.04 * k})`;
        ctx.beginPath(); ctx.arc(cx, cy + 28, k * 9, Math.PI, 0); ctx.stroke();
      }
    }
  }
  ctx.restore();
  // bamboo left, small grove on the right edge
  bamboo(ctx, 44, 120, 1100, 24, rnd, 0.012);
  bamboo(ctx, 92, 300, 1100, 16, rnd, 0.02);
  bamboo(ctx, 676, 520, 1100, 18, rnd, -0.016);
  // veranda floor
  g = ctx.createLinearGradient(0, FLOOR_Y, 0, H); g.addColorStop(0, '#6b4a34'); g.addColorStop(0.15, '#4a3226'); g.addColorStop(1, '#2a1c18');
  ctx.fillStyle = g; ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  ctx.fillStyle = 'rgba(255,214,170,0.35)'; ctx.fillRect(0, FLOOR_Y, W, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, FLOOR_Y + 3, W, 6);
  for (let i = 0; i < 6; i++) { const y = FLOOR_Y + 12 + i * 34; ctx.fillStyle = 'rgba(20,10,8,0.35)'; ctx.fillRect(0, y, W, 2); }
  // wood grain on the floor
  ctx.strokeStyle = 'rgba(255,200,150,0.07)'; ctx.lineWidth = 1;
  for (let i = 0; i < 60; i++) { const y = FLOOR_Y + 10 + rnd() * (H - FLOOR_Y - 10), x = rnd() * W, ln = 60 + rnd() * 160; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ln, y + (rnd() - 0.5) * 3); ctx.stroke(); }
  // vignette
  g = ctx.createRadialGradient(W / 2, 600, 300, W / 2, 640, 880);
  g.addColorStop(0, 'rgba(8,10,30,0)'); g.addColorStop(1, 'rgba(8,10,30,0.5)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ---- the full-bleed surround (everything outside the stage) --------------------------------------
// Portrait: the sky / floor gradients of the backdrop continue above and below the stage window, seamlessly (same colours at the
// same world heights). Wide: the same palette stretched over the whole screen, with the stage as a framed window.
export function drawOuter(ctx, L, map = null) {
  const st = map ?? L.st;
  const sw = L.W, sh = L.H;
  let g;
  if (!L.land) {
    const y = (wy) => st.y + (wy - st.wy0) * st.s;
    g = ctx.createLinearGradient(0, y(0), 0, y(H));
    const fl = FLOOR_Y / H;
    [[0, '#0f1538'], [0.34, '#243472'], [0.62, '#6a5a98'], [0.8, '#d98a82'], [fl, '#e6a186'], [fl + 0.0002, '#6b4a34'], [fl + 0.15 * (1 - fl), '#4a3226'], [1, '#2a1c18']].forEach(([o, c]) => g.addColorStop(o, c));
  } else {
    drawWideBack(ctx, L);
    return;
  }
  ctx.fillStyle = g; ctx.fillRect(0, 0, sw, sh);
}

// A wide version of the dusk painting for landscape screens (the tall one cannot be stretched): same sky, moon, hills, bamboo and
// veranda, painted at the live size once and cached.
function paintWide(ctx, w, h) {
  const rnd = lcg(11), fy = Math.round(h * 0.86), k = h / 720;
  let g = ctx.createLinearGradient(0, 0, 0, h);
  [[0, '#0f1538'], [0.34, '#243472'], [0.62, '#6a5a98'], [0.8, '#d98a82'], [0.86, '#e6a186']].forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, fy);
  for (let i = 0; i < Math.round(w / 12); i++) { ctx.fillStyle = `rgba(255,248,230,${0.25 + rnd() * 0.6})`; ctx.beginPath(); ctx.arc(rnd() * w, rnd() * fy * 0.6, 0.6 + rnd() * 1.4, 0, TAU); ctx.fill(); }
  const mx = w * 0.64, my = h * 0.27, mr = 70 * k + 20;
  g = ctx.createRadialGradient(mx, my, 10, mx, my, mr * 3.6);
  g.addColorStop(0, 'rgba(255,236,196,0.55)'); g.addColorStop(0.35, 'rgba(255,214,170,0.16)'); g.addColorStop(1, 'rgba(255,214,170,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, fy);
  g = ctx.createRadialGradient(mx - mr * 0.26, my - mr * 0.3, 6, mx, my, mr * 1.04);
  g.addColorStop(0, '#fffaf0'); g.addColorStop(0.75, '#f7e6c2'); g.addColorStop(1, '#ecd2a2');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(190,160,120,0.22)';
  [[-0.33, -0.1, 0.24], [0.28, 0.3, 0.17], [0.1, -0.4, 0.13], [-0.08, 0.48, 0.1]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU); ctx.fill(); });
  for (let i = 0; i < 4; i++) { const cy = h * (0.22 + i * 0.12) + rnd() * 20, cx = rnd() * w; ctx.fillStyle = `rgba(255,236,220,${0.05 + rnd() * 0.06})`; rr(ctx, cx - 260, cy, 520 + rnd() * 120, 12 + rnd() * 10, 12); ctx.fill(); }
  const hill = (base, amp, col, seed) => {
    const r2 = lcg(seed), steps = Math.max(36, Math.round(w / 30));
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, fy + 4);
    let ph = r2() * 6;
    for (let i = 0; i <= steps; i++) { const x = (i / steps) * w; ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(ph + i * 0.37 * 36 / steps * 1.4)) - amp * 0.5 * Math.sin(ph * 1.7 + i * 0.83 * 36 / steps * 1.4)); }
    ctx.lineTo(w, fy + 4); ctx.closePath(); ctx.fill();
  };
  hill(fy - 40 * k, 70 * k, 'rgba(70,64,118,0.9)', 3);
  hill(fy - 12 * k, 56 * k, 'rgba(46,42,92,0.95)', 7);
  g = ctx.createLinearGradient(0, fy - 120 * k, 0, fy); g.addColorStop(0, 'rgba(255,214,190,0)'); g.addColorStop(0.5, 'rgba(255,214,190,0.2)'); g.addColorStop(1, 'rgba(255,214,190,0)');
  ctx.fillStyle = g; ctx.fillRect(0, fy - 120 * k, w, 120 * k);
  ctx.save(); ctx.beginPath(); ctx.rect(0, fy - 60 * k, w, 60 * k); ctx.clip(); ctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) for (let i = -1; i < w / 56 + 1; i++) {
    const cx = i * 56 + (row % 2 ? 28 : 0), cy = fy - 56 * k + row * 22 * k;
    for (let q = 3; q >= 1; q--) { ctx.strokeStyle = `rgba(250,226,204,${0.1 + 0.04 * q})`; ctx.beginPath(); ctx.arc(cx, cy + 28, q * 9, Math.PI, 0); ctx.stroke(); }
  }
  ctx.restore();
  bamboo(ctx, 44, h * 0.08, fy + 10, 24, rnd, 0.012); bamboo(ctx, 92, h * 0.3, fy + 10, 16, rnd, 0.02);
  bamboo(ctx, w - 48, h * 0.25, fy + 10, 20, rnd, -0.014); bamboo(ctx, w - 100, h * 0.5, fy + 10, 14, rnd, -0.02);
  g = ctx.createLinearGradient(0, fy, 0, h); g.addColorStop(0, '#6b4a34'); g.addColorStop(0.15, '#4a3226'); g.addColorStop(1, '#2a1c18');
  ctx.fillStyle = g; ctx.fillRect(0, fy, w, h - fy);
  ctx.fillStyle = 'rgba(255,214,170,0.35)'; ctx.fillRect(0, fy, w, 3); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, fy + 3, w, 6);
  ctx.strokeStyle = 'rgba(255,200,150,0.07)'; ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) { const y = fy + 10 + rnd() * (h - fy - 10), x = rnd() * w, ln = 60 + rnd() * 160; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ln, y + (rnd() - 0.5) * 3); ctx.stroke(); }
  g = ctx.createRadialGradient(w / 2, h * 0.5, h * 0.4, w / 2, h * 0.5, Math.max(w, h) * 0.7);
  g.addColorStop(0, 'rgba(8,10,30,0)'); g.addColorStop(1, 'rgba(8,10,30,0.45)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
let wideBack = { key: '', cv: null };
export function drawWideBack(ctx, L) {
  const w = Math.round(L.W), h = Math.round(L.H), key = `${w}x${h}`;
  if (wideBack.key !== key) {
    setHost(ctx);
    const cv = newCanvas(Math.round(w * 1.25), Math.round(h * 1.25));
    wideBack = { key, cv: null };
    if (cv) { const g = cv.getContext('2d'); g.scale(1.25, 1.25); paintWide(g, w, h); wideBack.cv = cv; }
  }
  if (wideBack.cv) ctx.drawImage(wideBack.cv, 0, 0, w, h); else paintWide(ctx, w, h);
}

// The painted 720 x 1280 backdrop through a stage map { x, y, s, wy0 }, clipped to `rect` (screen units, optional rounded corners).
export function drawBackdropIn(ctx, m, rect, round = 0) {
  ctx.save();
  if (round) rr(ctx, rect.x, rect.y, rect.w, rect.h, round); else { ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); }
  ctx.clip();
  ctx.translate(m.x, m.y - m.wy0 * m.s); ctx.scale(m.s, m.s);
  drawBackdrop(ctx);
  ctx.restore();
}
// Backdrop for the menu screens: portrait = the whole painting centred (the surround continues it); wide = the wide painting.
export function drawMenuBack(ctx, L) {
  if (!L.land) {
    const m = { x: (L.W - 720) / 2, y: (L.H - 1280) / 2, s: 1, wy0: 0 };
    drawOuter(ctx, L, m);
    drawBackdropIn(ctx, m, { x: m.x, y: Math.max(0, m.y), w: 720, h: Math.min(L.H, 1280) });
  } else {
    drawWideBack(ctx, L);
  }
}

let backdrop = null;      // off-screen canvas, or false when this host cannot make one
export function drawBackdrop(ctx) {
  if (backdrop === null) {
    setHost(ctx);
    const cv = newCanvas(Math.round(W * 1.5), Math.round(H * 1.5));
    if (cv) { const g = cv.getContext('2d'); g.scale(1.5, 1.5); paintBackdrop(g); backdrop = cv; } else backdrop = false;
  }
  if (backdrop) ctx.drawImage(backdrop, 0, 0, W, H);
  else paintBackdrop(ctx);
}

// ---- the ken -----------------------------------------------------------------------------------
function woodGrad(ctx, x0, x1) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, '#f3dfb4'); g.addColorStop(0.45, COL.wood); g.addColorStop(1, COL.woodMid);
  return g;
}

function drawCup(ctx, cu, tint, glow, alpha = 1) {
  const x0 = cu.x - cu.w / 2 - 7, x1 = cu.x + cu.w / 2 + 7, y = cu.y;
  // body (a bowl hanging below the rim line)
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x0, y - 2); ctx.bezierCurveTo(x0 + 2, y + 30, cu.x - cu.w * 0.35, y + 36, cu.x, y + 36);
  ctx.bezierCurveTo(cu.x + cu.w * 0.35, y + 36, x1 - 2, y + 30, x1, y - 2); ctx.closePath();
  let g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#f3dfb4'); g.addColorStop(0.5, '#d9b278'); g.addColorStop(1, '#a87a44');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(90,60,30,0.55)'; ctx.stroke();
  // lacquer ring painted on the bowl
  ctx.strokeStyle = tint; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x0 + 6, y + 10); ctx.bezierCurveTo(x0 + 10, y + 26, cu.x - cu.w * 0.3, y + 29, cu.x, y + 29); ctx.bezierCurveTo(cu.x + cu.w * 0.3, y + 29, x1 - 10, y + 26, x1 - 6, y + 10); ctx.stroke();
  // inner dish
  ctx.beginPath(); ctx.ellipse(cu.x, y - 2, (x1 - x0) / 2 - 3, 9, 0, 0, TAU);
  g = ctx.createLinearGradient(0, y - 11, 0, y + 7); g.addColorStop(0, '#5c3d22'); g.addColorStop(1, '#9a7141');
  ctx.fillStyle = g; ctx.fill();
  // rim
  ctx.lineWidth = 7; ctx.strokeStyle = '#f2dca8'; ctx.beginPath(); ctx.ellipse(cu.x, y - 2, (x1 - x0) / 2 - 4, 9, 0, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(100,70,34,0.6)'; ctx.beginPath(); ctx.ellipse(cu.x, y - 2, (x1 - x0) / 2 - 0.5, 12.5, 0, 0, TAU); ctx.stroke();
  if (glow > 0) {
    ctx.globalAlpha = glow * alpha; ctx.strokeStyle = tint; ctx.lineWidth = 6; ctx.shadowColor = tint; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.ellipse(cu.x, y - 2, (x1 - x0) / 2 + 6, 15, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

// opts: glow {big,small,spike,base} 0..1, ghost (draw faded)
export function drawKen(ctx, k, glow = {}, alpha = 1) {
  ctx.save();
  ctx.translate(k.x, k.y); ctx.rotate(k.th);
  ctx.globalAlpha = alpha;
  // soft shadow of the whole ken on the backdrop
  // handle
  let g = ctx.createLinearGradient(-11, 0, 11, 0); g.addColorStop(0, '#f3dfb4'); g.addColorStop(0.5, COL.wood); g.addColorStop(1, COL.woodMid);
  rr(ctx, -11, 4, 22, 190, 10); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(90,60,30,0.55)'; ctx.stroke();
  // grain
  ctx.strokeStyle = 'rgba(120,80,40,0.22)'; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-6 + i * 4, 14); ctx.bezierCurveTo(-8 + i * 4, 70, -3 + i * 4, 120, -6 + i * 4, 186); ctx.stroke(); }
  // lacquer band
  ctx.fillStyle = COL.ball; ctx.fillRect(-11, 128, 22, 9); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-11, 128, 5, 9);
  ctx.fillStyle = '#c99f62'; ctx.fillRect(-11, 142, 22, 3);
  // crossbar
  g = ctx.createLinearGradient(0, -5, 0, 14); g.addColorStop(0, '#f6e5bd'); g.addColorStop(0.5, COL.wood); g.addColorStop(1, '#b88b50');
  rr(ctx, -128, -3, 244, 17, 8); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(90,60,30,0.55)'; ctx.stroke();
  // spike
  ctx.beginPath(); ctx.moveTo(-9, 2); ctx.lineTo(-3.4, -60); ctx.quadraticCurveTo(0, -65, 3.4, -60); ctx.lineTo(9, 2); ctx.closePath();
  g = ctx.createLinearGradient(-9, 0, 9, 0); g.addColorStop(0, '#f6e4b8'); g.addColorStop(0.5, '#e2c48a'); g.addColorStop(1, '#a87a44');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(90,60,30,0.6)'; ctx.stroke();
  if (glow.spike > 0) { ctx.save(); ctx.globalAlpha = glow.spike * alpha; ctx.strokeStyle = COL.spike; ctx.shadowColor = COL.spike; ctx.shadowBlur = 20; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -62, 15, 0, TAU); ctx.stroke(); ctx.restore(); }
  else { ctx.fillStyle = COL.spike; ctx.beginPath(); ctx.arc(0, -62, 3.4, 0, TAU); ctx.fill(); }
  // cups
  drawCup(ctx, CUPS.big, COL.big, glow.big || 0, alpha);
  drawCup(ctx, CUPS.small, COL.small, glow.small || 0, alpha);
  // base cup: a dish at the foot of the handle, opening away from the handle
  {
    const cu = CUPS.base, y = cu.y;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-36, y - 14); ctx.bezierCurveTo(-38, y - 44, -20, y - 52, 0, y - 52); ctx.bezierCurveTo(20, y - 52, 38, y - 44, 36, y - 14); ctx.closePath();
    g = ctx.createLinearGradient(-36, 0, 36, 0); g.addColorStop(0, '#f3dfb4'); g.addColorStop(0.5, '#d9b278'); g.addColorStop(1, '#a87a44');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(90,60,30,0.55)'; ctx.stroke();
    ctx.strokeStyle = COL.base; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-30, y - 22); ctx.bezierCurveTo(-26, y - 40, -12, y - 44, 0, y - 44); ctx.bezierCurveTo(12, y - 44, 26, y - 40, 30, y - 22); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, y - 2, 35, 9, 0, 0, TAU);
    g = ctx.createLinearGradient(0, y - 11, 0, y + 7); g.addColorStop(0, '#9a7141'); g.addColorStop(1, '#5c3d22');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 7; ctx.strokeStyle = '#f2dca8'; ctx.beginPath(); ctx.ellipse(0, y - 2, 32, 9, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(100,70,34,0.6)'; ctx.beginPath(); ctx.ellipse(0, y - 2, 36, 12.5, 0, 0, TAU); ctx.stroke();
    if (glow.base > 0) { ctx.globalAlpha = glow.base * alpha; ctx.strokeStyle = COL.base; ctx.lineWidth = 6; ctx.shadowColor = COL.base; ctx.shadowBlur = 18; ctx.beginPath(); ctx.ellipse(0, y - 2, 42, 15, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  // string eye at the spike base
  ctx.fillStyle = '#6a4a28'; ctx.beginPath(); ctx.arc(0, -5, 3.2, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- the ball -----------------------------------------------------------------------------------
export function drawBall(ctx, b, alpha = 1, scale = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(b.x, b.y);
  const r = R * scale;
  // body
  let g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
  g.addColorStop(0, '#ff8a6a'); g.addColorStop(0.35, COL.ball); g.addColorStop(1, COL.ballDark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  // gold band (painted ring) and the hole, both turning with the ball
  ctx.save(); ctx.rotate(b.a);
  ctx.strokeStyle = 'rgba(244,196,90,0.9)'; ctx.lineWidth = r * 0.07;
  ctx.beginPath(); ctx.ellipse(r * 0.18, 0, r * 0.32, r * 0.86, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(244,196,90,0.5)'; ctx.lineWidth = r * 0.05;
  ctx.beginPath(); ctx.ellipse(-r * 0.36, 0, r * 0.2, r * 0.7, 0, 0, TAU); ctx.stroke();
  // the hole
  g = ctx.createRadialGradient(r * 0.68, 0, 1, r * 0.68, 0, r * 0.3);
  g.addColorStop(0, '#120604'); g.addColorStop(0.7, '#2a0f08'); g.addColorStop(1, '#5b2418');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(r * 0.7, 0, r * 0.2, r * 0.3, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,150,0.65)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(r * 0.7, 0, r * 0.2, r * 0.3, 0, 0, TAU); ctx.stroke();
  ctx.restore();
  // highlight and rim light
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-r * 0.36, -r * 0.42, r * 0.22, r * 0.13, -0.7, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,10,6,0.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.restore();
}

export function drawBallShadow(ctx, b, a = 1) {
  const h = Math.max(0, FLOOR_Y - b.y);
  const k = Math.max(0.35, 1 - h / 1000);
  ctx.save();
  ctx.globalAlpha = 0.35 * k * a;
  ctx.fillStyle = '#05060f';
  ctx.beginPath(); ctx.ellipse(b.x, FLOOR_Y + 22, R * 1.1 * (1.3 - k * 0.4), 9 * (1.3 - k * 0.4), 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- the string (a verlet rope, visual only) ----------------------------------------------------
const NODES = 14;
export function newRope() {
  return { x: new Float32Array(NODES + 1), y: new Float32Array(NODES + 1), px: new Float32Array(NODES + 1), py: new Float32Array(NODES + 1), init: false };
}
const REST = (L - R) / NODES;
export function stepRope(rp, ax, ay, bx, by) {
  if (!rp.init) {
    for (let i = 0; i <= NODES; i++) { const t = i / NODES; rp.x[i] = rp.px[i] = ax + (bx - ax) * t; rp.y[i] = rp.py[i] = ay + (by - ay) * t; }
    rp.init = true;
  }
  for (let i = 1; i < NODES; i++) {
    const vx = (rp.x[i] - rp.px[i]) * 0.985, vy = (rp.y[i] - rp.py[i]) * 0.985;
    rp.px[i] = rp.x[i]; rp.py[i] = rp.y[i];
    rp.x[i] += vx; rp.y[i] += vy + 0.9;
  }
  for (let it = 0; it < 7; it++) {
    rp.x[0] = ax; rp.y[0] = ay; rp.x[NODES] = bx; rp.y[NODES] = by;
    for (let i = 0; i < NODES; i++) {
      const dx = rp.x[i + 1] - rp.x[i], dy = rp.y[i + 1] - rp.y[i];
      const d = Math.hypot(dx, dy) || 1e-6;
      const diff = (d - REST) / d;
      if (diff <= 0 && d < REST) { /* slack: let it hang */ }
      const mv = diff * 0.5;
      if (i === 0) { rp.x[i + 1] -= dx * diff; rp.y[i + 1] -= dy * diff; }
      else if (i === NODES - 1) { rp.x[i] += dx * diff; rp.y[i] += dy * diff; }
      else { rp.x[i] += dx * mv; rp.y[i] += dy * mv; rp.x[i + 1] -= dx * mv; rp.y[i + 1] -= dy * mv; }
    }
  }
}
export function drawRope(ctx, rp, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = (ox, oy) => {
    ctx.beginPath(); ctx.moveTo(rp.x[0] + ox, rp.y[0] + oy);
    for (let i = 1; i < NODES; i++) { const mx = (rp.x[i] + rp.x[i + 1]) / 2 + ox, my = (rp.y[i] + rp.y[i + 1]) / 2 + oy; ctx.quadraticCurveTo(rp.x[i] + ox, rp.y[i] + oy, mx, my); }
    ctx.lineTo(rp.x[NODES] + ox, rp.y[NODES] + oy);
  };
  path(3, 5); ctx.strokeStyle = 'rgba(5,6,16,0.28)'; ctx.lineWidth = 4.5; ctx.stroke();
  path(0, 0); ctx.strokeStyle = '#efe3c6'; ctx.lineWidth = 4; ctx.stroke();
  path(-0.8, -0.8); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.restore();
}

// ---- particles -----------------------------------------------------------------------------------
// kinds: 0 petal, 1 spark, 2 ring, 3 dust
export function drawParticles(ctx, parts) {
  for (const q of parts) {
    const k = q.t / q.max, a = Math.max(0, 1 - k);
    ctx.save();
    ctx.translate(q.x, q.y);
    if (q.kind === 0) {
      ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, a * 1.6) * 0.9;
      ctx.fillStyle = q.col || '#ffc4d4';
      ctx.beginPath(); ctx.ellipse(0, 0, q.size, q.size * 0.55, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(-q.size * 0.2, -q.size * 0.1, q.size * 0.5, q.size * 0.2, 0, 0, TAU); ctx.fill();
    } else if (q.kind === 1) {
      ctx.globalAlpha = a; ctx.fillStyle = q.col || '#ffe08a';
      ctx.rotate(q.rot);
      const s = q.size * (1 - k * 0.6);
      ctx.beginPath(); for (let i = 0; i < 4; i++) { const an = (i / 4) * TAU; ctx.lineTo(Math.cos(an) * s, Math.sin(an) * s); ctx.lineTo(Math.cos(an + TAU / 8) * s * 0.3, Math.sin(an + TAU / 8) * s * 0.3); } ctx.closePath(); ctx.fill();
    } else if (q.kind === 2) {
      ctx.globalAlpha = a * 0.8; ctx.strokeStyle = q.col || '#ffe08a'; ctx.lineWidth = 4 * a + 1;
      ctx.beginPath(); ctx.arc(0, 0, q.size * (0.3 + k * 1.1), 0, TAU); ctx.stroke();
    } else {
      ctx.globalAlpha = a * 0.5; ctx.fillStyle = q.col || '#f1e3c4';
      ctx.beginPath(); ctx.arc(0, 0, q.size * (0.6 + k), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

export { anchorOf };
