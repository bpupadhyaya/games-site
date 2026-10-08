// Pottery Wheel: painting that is not UI. A warm studio backdrop, a lit 2D lathe pot painter (shelf thumbnails, Rules figures, the no-WebGL
// fallback), the target outline, the fingertip. Pure canvas 2D; no DOM; a function of its arguments only.
import { N, roAt, targetR } from './sim.js';
import { project } from './cam.js';
import { TRADITIONS } from './content.js';

export const PAL = {
  ink: '#150f0d', night: '#241915', wall: '#3a2a22', glow: '#6b4a38', clay: '#c98355', terracotta: '#e2753d', terraHi: '#ffb27d', gold: '#f3c984',
  cream: '#f7ecd9', text: '#f8eddc', dim: 'rgba(248,237,220,0.62)', teal: '#49b5a4', tealDeep: '#2b7f73', danger: '#cf4a4a', skin: '#e8b998', skinDark: '#c48b6a',
};
export const DISPLAY = '"Fredoka", "Trebuchet MS", system-ui, sans-serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(k >= 1 ? c + (255 - c) * (k - 1) : c * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ---- backdrop: a warm wall with a window of soft light -------------------------------------------------------------------------------------------
const caches = new Map();
export function drawBackdrop(ctx, w, h, t = 0) {
  const key = `${Math.round(w)}x${Math.round(h)}`;
  let c = caches.get(key);
  if (c === undefined && typeof OffscreenCanvas === 'function') {
    try {
      c = new OffscreenCanvas(Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2)));
      const g = c.getContext('2d'); g.scale(0.5, 0.5);
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a1d18'); gr.addColorStop(0.55, '#3b2a22'); gr.addColorStop(1, '#1b1310');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const r = g.createRadialGradient(w * 0.5, h * 0.36, 10, w * 0.5, h * 0.36, Math.max(w, h) * 0.6);
      r.addColorStop(0, 'rgba(255,196,130,0.34)'); r.addColorStop(0.5, 'rgba(210,130,80,0.12)'); r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
      const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.8);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(8,4,2,0.62)');
      g.fillStyle = v; g.fillRect(0, 0, w, h);
    } catch { c = null; }
    if (caches.size > 4) caches.clear();
    caches.set(key, c);
  }
  if (c) ctx.drawImage(c, 0, 0, w, h);
  else {
    const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a1d18'); gr.addColorStop(0.55, '#3b2a22'); gr.addColorStop(1, '#1b1310');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  }
}

// ---- the 2D pot painter -------------------------------------------------------------------------------------------------------------------------
// pot: { Ro[], Ri[], yc[], y0[], h[], H }. glaze: { trad, base, acc, bands[] } or null for raw clay. (cx, baseY) = the centre of the foot, scale = px per world unit.
export function drawPot2D(ctx, pot, glaze, cx, baseY, scale, o = {}) {
  const tilt = o.tilt ?? 0.24;
  const T = glaze ? TRADITIONS[glaze.trad] : null;
  const base = o.color ?? (T ? T.base[glaze.base] : (o.wet ? '#9a6a48' : '#c98355'));
  let rmax = 0; for (let i = 0; i < N; i++) rmax = Math.max(rmax, pot.Ro[i]);
  const pts = [];
  for (let i = 0; i < N; i++) pts.push([pot.Ro[i], pot.yc[i]]);
  const ytop = pot.H, rtop = pot.Ro[N - 1], rit = pot.Ri[N - 1];
  ctx.save();
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(cx + scale * 0.05, baseY + scale * 0.02, rmax * scale * 1.05, rmax * scale * tilt * 1.05, 0, 0, TAU); ctx.fill();
  }
  // silhouette
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx - pot.Ro[0] * scale, baseY);
    for (let i = 0; i < N; i++) ctx.lineTo(cx - pts[i][0] * scale, baseY - pts[i][1] * scale);
    ctx.lineTo(cx - rtop * scale, baseY - ytop * scale);
    ctx.lineTo(cx + rtop * scale, baseY - ytop * scale);
    for (let i = N - 1; i >= 0; i--) ctx.lineTo(cx + pts[i][0] * scale, baseY - pts[i][1] * scale);
    ctx.lineTo(cx + pot.Ro[0] * scale, baseY);
    ctx.ellipse(cx, baseY, pot.Ro[0] * scale, pot.Ro[0] * scale * tilt, 0, 0, Math.PI);
    ctx.closePath();
  };
  const gx = ctx.createLinearGradient(cx - rmax * scale, 0, cx + rmax * scale, 0);
  gx.addColorStop(0, shade(base, 0.5)); gx.addColorStop(0.22, shade(base, 0.95)); gx.addColorStop(0.4, shade(base, 1.22)); gx.addColorStop(0.62, shade(base, 0.95)); gx.addColorStop(1, shade(base, 0.42));
  path(); ctx.fillStyle = gx; ctx.fill();
  // bands (clipped to the silhouette), each a horizontal stripe in the accent colour with a simple motif
  if (glaze && glaze.bands && glaze.bands.length) {
    ctx.save(); path(); ctx.clip();
    for (const b of glaze.bands) {
      const acc = T.accent[b.acc ?? 0], y1 = baseY - (b.y - b.half) * scale, y2 = baseY - (b.y + b.half) * scale;
      ctx.fillStyle = acc; ctx.globalAlpha = b.motif === 'solid' ? 0.95 : 0.5; ctx.fillRect(cx - rmax * scale, y2, rmax * 2 * scale, y1 - y2);
      ctx.globalAlpha = 1;
      motif2D(ctx, b.motif, acc, cx - rmax * scale, rmax * 2 * scale, y2, y1 - y2);
    }
    // the cylinder light over the paint
    ctx.globalCompositeOperation = 'source-over';
    const sh = ctx.createLinearGradient(cx - rmax * scale, 0, cx + rmax * scale, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(0.3, 'rgba(255,255,255,0.12)'); sh.addColorStop(0.45, 'rgba(255,255,255,0.18)'); sh.addColorStop(0.7, 'rgba(0,0,0,0.12)'); sh.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = sh; ctx.fillRect(cx - rmax * scale, baseY - ytop * scale - 4, rmax * 2 * scale, ytop * scale + 8);
    ctx.restore();
  }
  // glaze sheen
  if (glaze && o.sheen !== false) {
    ctx.save(); path(); ctx.clip();
    const sg = ctx.createLinearGradient(cx - rmax * scale, 0, cx + rmax * scale, 0);
    sg.addColorStop(0.28, 'rgba(255,255,255,0)'); sg.addColorStop(0.36, `rgba(255,255,255,${0.35 * (1 - (T?.gloss ?? 0.3))})`); sg.addColorStop(0.42, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(cx - rmax * scale, baseY - ytop * scale - 4, rmax * 2 * scale, ytop * scale + 8);
    ctx.restore();
  }
  // rim: top ellipse, the inside dark, the lip lit
  if (o.rim !== false) {
    const ry = Math.max(2, rtop * scale * tilt), ty = baseY - ytop * scale;
    ctx.fillStyle = shade(base, 1.18); ctx.beginPath(); ctx.ellipse(cx, ty, rtop * scale, ry, 0, 0, TAU); ctx.fill();
    if (rit > 0.03) {
      const ir = rit * scale;
      const ig = ctx.createLinearGradient(cx - ir, 0, cx + ir, 0); ig.addColorStop(0, shade(base, 0.32)); ig.addColorStop(0.5, shade(base, 0.62)); ig.addColorStop(1, shade(base, 0.3));
      ctx.fillStyle = ig; ctx.beginPath(); ctx.ellipse(cx, ty, ir, Math.max(1.5, rit * scale * tilt), 0, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
function motif2D(ctx, m, col, x, w, y, h) {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1.5, h * 0.09); ctx.globalAlpha = 0.9;
  const n = Math.max(6, Math.round(w / Math.max(8, h * 0.55)));
  if (m === 'dots' || m === 'speckle') { for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x + (i + 0.5) * w / n, y + h * (0.5 + (i % 2 ? 0.14 : -0.14)), Math.max(1.5, h * 0.09), 0, TAU); ctx.fill(); } }
  else if (m === 'zigzag' || m === 'waves' || m === 'scroll' || m === 'comb' || m === 'meander') { ctx.beginPath(); for (let i = 0; i <= n * 2; i++) { const px = x + i * w / (n * 2), py = y + h * (m === 'waves' || m === 'scroll' || m === 'comb' ? 0.5 + 0.28 * Math.sin(i * 1.4) : (i % 2 ? 0.28 : 0.72)); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); }
  else if (m === 'lines') { for (let k = 0; k < 3; k++) { const yy = y + h * (0.22 + k * 0.28); ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); } }
  else if (m === 'triangles' || m === 'petals' || m === 'leaves' || m === 'scallops' || m === 'drips') { for (let i = 0; i < n; i++) { const px = x + (i + 0.5) * w / n; ctx.beginPath(); ctx.moveTo(px - w / n * 0.35, y + h * 0.85); ctx.lineTo(px, y + h * (m === 'drips' ? 1.0 : 0.15)); ctx.lineTo(px + w / n * 0.35, y + h * 0.85); ctx.closePath(); if (m === 'triangles') ctx.fill(); else ctx.stroke(); } }
  ctx.restore();
}

// The target outline projected through the camera, drawn on the 2D layer over the 3D pot (both sides, dashed, with a soft glow).
export function drawTarget(ctx, cam, target, t = 0) {
  const S = 36, L = [], R = [];
  for (let k = 0; k <= S; k++) {
    const y = k / S * target.H, r = targetR(target, Math.min(y, target.H - 1e-6));
    L.push(project(cam, -r, y, 0)); R.push(project(cam, r, y, 0));
  }
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const pass of [0, 1]) {
    ctx.lineWidth = pass ? 2.5 : 7; ctx.strokeStyle = pass ? 'rgba(255,240,200,0.92)' : 'rgba(255,200,120,0.18)'; ctx.setLineDash(pass ? [10, 8] : []); ctx.lineDashOffset = -t * 14;
    for (const side of [L, R]) { ctx.beginPath(); side.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(L[S].x, L[S].y); ctx.lineTo(R[S].x, R[S].y); ctx.stroke();
  }
  ctx.restore();
}

// A fingertip: a rounded finger coming in from the side with a nail, pressing at (x, y). dir = +1 from the left, -1 from the right.
export function drawFinger(ctx, x, y, dir, size, press = 0, ghost = false) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(-0.28);
  const L = size * 4.6, W = size * 0.95;
  ctx.globalAlpha = ghost ? 0.82 : 0.95;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.roundRect(-L + 6, -W / 2 + 12, L, W, W / 2); ctx.fill();
  const g = ctx.createLinearGradient(0, -W / 2, 0, W / 2); g.addColorStop(0, '#f2c9a8'); g.addColorStop(0.55, PAL.skin); g.addColorStop(1, PAL.skinDark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-L, -W / 2, L, W, W / 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.roundRect(-W * 0.9, -W * 0.38, W * 0.78, W * 0.34, W * 0.17); ctx.fill();   // nail
  if (press > 0.01) { ctx.strokeStyle = `rgba(255,250,235,${0.4 * press})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, size * (0.6 + press * 0.7), 0, TAU); ctx.stroke(); }
  ctx.restore();
}

export function drawStars(ctx, cx, cy, size, n, max = 3) {
  for (let i = 0; i < max; i++) {
    const x = cx + (i - (max - 1) / 2) * size * 1.15;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? size * 0.23 : size * 0.5, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = i < n ? PAL.gold : 'rgba(255,240,220,0.14)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = i < n ? '#b98932' : 'rgba(255,240,220,0.22)'; ctx.stroke(); ctx.restore();
  }
}
export { roAt };
