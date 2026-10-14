// Plate Spinning: all the painting that is not UI. A lit theatre stage, bamboo poles that bend, plates with painted rings, shards and sparks.
// Pure canvas 2D; no DOM. Everything is a function of its arguments (and the clock the caller passes), so it is deterministic.
import { TUNE } from './engine.js';

export const PAL = {
  ink: '#0e0610', night: '#1a0a14', wine: '#3a1224', crimson: '#b3202f', crimsonHi: '#e0485a', lacquer: '#160a0c',
  gold: '#f4cf6a', goldHi: '#fff0b0', goldDeep: '#b8862a', jade: '#4fc79a', jadeDeep: '#1f6f55', cobalt: '#2c5aa8', porcelain: '#f4f1ea',
  bamboo: '#e6c978', bambooDark: '#7a5a22', text: '#fdf1da', dim: 'rgba(253,241,218,0.62)', good: '#ffc857', perfect: '#fff0b0', bad: '#ff6b6b',
};
export const DISPLAY = '"Cinzel", "Times New Roman", Georgia, serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => clamp(v, 0, 1);
const easeOut = (x) => 1 - (1 - x) * (1 - x);
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const mix = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); const c = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t); return `rgb(${c(16)},${c(8)},${c(0)})`; };

// ---- a cache for the heavy static background (OffscreenCanvas when the browser has one; otherwise it is painted directly) -----------------------
const caches = new Map();
function stat(ctx, key, w, h, scale, paint) {
  if (typeof OffscreenCanvas !== 'function') { paint(ctx, w, h); return; }
  let c = caches.get(key);
  if (c === undefined) {
    if (caches.size > 5) caches.clear();
    try { c = new OffscreenCanvas(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale))); const g = c.getContext('2d'); g.scale(scale, scale); paint(g, w, h); } catch { c = null; }
    caches.set(key, c);
  }
  if (c) ctx.drawImage(c, 0, 0, w, h); else paint(ctx, w, h);
}

// Smooth hill line from a few sines (deterministic).
function ridge(g, w, base, amp, seed, fill, step = 8) {
  g.beginPath(); g.moveTo(0, base + amp * 2);
  for (let x = 0; x <= w + step; x += step) {
    const u = x / w;
    const y = base - amp * (0.55 + 0.3 * Math.sin(u * 6.3 + seed) + 0.22 * Math.sin(u * 15.7 + seed * 2.1) + 0.12 * Math.sin(u * 31 + seed * 3.3));
    g.lineTo(x, y);
  }
  g.lineTo(w + step, base + amp * 2); g.closePath(); g.fillStyle = fill; g.fill();
}

function pagoda(g, x, y, s, col) {
  g.fillStyle = col;
  const tiers = 5;
  let yy = y, ww = s * 1.0;
  g.fillRect(x - ww * 0.55, yy - s * 0.12, ww * 1.1, s * 0.12);
  for (let i = 0; i < tiers; i++) {
    const bodyH = s * 0.16, roofH = s * 0.09, bw = ww * 0.62;
    g.fillRect(x - bw / 2, yy - s * 0.12 - bodyH, bw, bodyH);
    // roof with upturned corners
    const ry = yy - s * 0.12 - bodyH;
    g.beginPath();
    g.moveTo(x - ww * 0.62, ry - roofH * 0.9);
    g.quadraticCurveTo(x - ww * 0.42, ry + roofH * 0.15, x - ww * 0.3, ry);
    g.lineTo(x + ww * 0.3, ry);
    g.quadraticCurveTo(x + ww * 0.42, ry + roofH * 0.15, x + ww * 0.62, ry - roofH * 0.9);
    g.quadraticCurveTo(x + ww * 0.3, ry - roofH * 0.55, x, ry - roofH * 1.1);
    g.quadraticCurveTo(x - ww * 0.3, ry - roofH * 0.55, x - ww * 0.62, ry - roofH * 0.9);
    g.closePath(); g.fill();
    yy -= bodyH + roofH * 0.9; ww *= 0.8;
  }
  g.fillRect(x - s * 0.012, yy - s * 0.2, s * 0.024, s * 0.2);
}

function paintBackdrop(g, w, h, floorY) {
  // the painted wall behind the stage
  let gr = g.createLinearGradient(0, 0, 0, floorY);
  gr.addColorStop(0, '#12060f'); gr.addColorStop(0.45, '#33101f'); gr.addColorStop(1, '#6b2128');
  g.fillStyle = gr; g.fillRect(0, 0, w, floorY + 2);
  // a pale moon with a soft halo
  const mx = w * 0.3, my = floorY * 0.3, mr = Math.min(w, h) * 0.085;
  gr = g.createRadialGradient(mx, my, mr * 0.3, mx, my, mr * 3.2);
  gr.addColorStop(0, 'rgba(255,230,190,0.5)'); gr.addColorStop(1, 'rgba(255,200,150,0)');
  g.fillStyle = gr; g.fillRect(mx - mr * 3.3, my - mr * 3.3, mr * 6.6, mr * 6.6);
  g.fillStyle = '#ffe9c4'; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
  g.fillStyle = 'rgba(200,150,120,0.35)'; g.beginPath(); g.arc(mx - mr * 0.25, my + mr * 0.1, mr * 0.28, 0, TAU); g.arc(mx + mr * 0.3, my - mr * 0.25, mr * 0.16, 0, TAU); g.fill();
  // ink-wash mountains in three layers with mist between
  const span = floorY;
  ridge(g, w, span * 0.62, span * 0.16, 1.2, 'rgba(120,60,80,0.55)');
  pagoda(g, w * 0.74, span * 0.62 - span * 0.16 * 0.62, Math.min(w, h) * 0.26, 'rgba(40,12,26,0.78)');
  gr = g.createLinearGradient(0, span * 0.5, 0, span * 0.75); gr.addColorStop(0, 'rgba(255,200,170,0)'); gr.addColorStop(0.5, 'rgba(255,210,180,0.18)'); gr.addColorStop(1, 'rgba(255,200,170,0)');
  g.fillStyle = gr; g.fillRect(0, span * 0.5, w, span * 0.25);
  ridge(g, w, span * 0.78, span * 0.13, 4.1, 'rgba(70,24,44,0.8)');
  gr = g.createLinearGradient(0, span * 0.68, 0, span * 0.88); gr.addColorStop(0, 'rgba(255,190,160,0)'); gr.addColorStop(0.5, 'rgba(255,190,160,0.14)'); gr.addColorStop(1, 'rgba(255,190,160,0)');
  g.fillStyle = gr; g.fillRect(0, span * 0.68, w, span * 0.2);
  ridge(g, w, span * 0.96, span * 0.1, 7.7, 'rgba(34,10,22,0.92)');
  // the stage floor: lacquered boards in perspective
  const fh = h - floorY;
  gr = g.createLinearGradient(0, floorY, 0, h); gr.addColorStop(0, '#5a2414'); gr.addColorStop(0.35, '#3a160e'); gr.addColorStop(1, '#14070a');
  g.fillStyle = gr; g.fillRect(0, floorY, w, fh + 2);
  g.save(); g.beginPath(); g.rect(0, floorY, w, fh + 2); g.clip();
  const vx = w / 2, vy = floorY - fh * 0.9;
  g.strokeStyle = 'rgba(0,0,0,0.38)'; g.lineWidth = 2;
  for (let i = -16; i <= 16; i++) { const bx = w / 2 + i * (w / 11); g.beginPath(); g.moveTo(vx + (bx - vx) * (floorY - vy) / (h - vy) * 0.999, floorY); g.lineTo(bx, h); g.stroke(); }
  g.strokeStyle = 'rgba(255,190,150,0.07)';
  for (let i = -16; i <= 16; i++) { const bx = w / 2 + i * (w / 11) + 3; g.beginPath(); g.moveTo(vx + (bx - vx) * (floorY - vy) / (h - vy) * 0.999, floorY); g.lineTo(bx, h); g.stroke(); }
  // a soft sheen where the footlights fall
  gr = g.createRadialGradient(w / 2, floorY + fh * 0.55, 10, w / 2, floorY + fh * 0.55, w * 0.7);
  gr.addColorStop(0, 'rgba(255,190,120,0.22)'); gr.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = gr; g.fillRect(0, floorY, w, fh + 2);
  g.restore();
  // the front edge of the stage
  g.fillStyle = '#0c0405'; g.fillRect(0, floorY - 3, w, 5);
  g.fillStyle = 'rgba(244,207,106,0.55)'; g.fillRect(0, floorY - 1, w, 2);
}

function drape(g, x, w, h, side) {
  // vertical folds
  const n = Math.max(4, Math.round(w / 16));
  for (let i = 0; i < n; i++) {
    const x0 = x + (i / n) * w, ww = w / n + 1, ph = i * 1.7;
    const lit = 0.5 + 0.5 * Math.sin(ph);
    const gr = g.createLinearGradient(x0, 0, x0 + ww, 0);
    gr.addColorStop(0, mix('#4a0a14', '#9c1a2a', lit * 0.8)); gr.addColorStop(0.5, mix('#8a1424', '#d63a4c', lit)); gr.addColorStop(1, mix('#3a0710', '#7a1020', lit * 0.7));
    g.fillStyle = gr; g.fillRect(x0, 0, ww, h);
  }
  // darken towards the outer edge, lighten the inner edge a little
  const gr = g.createLinearGradient(x, 0, x + w, 0);
  const a = side < 0 ? [0.55, 0] : [0, 0.55];
  gr.addColorStop(0, `rgba(10,0,4,${a[0]})`); gr.addColorStop(1, `rgba(10,0,4,${a[1]})`);
  g.fillStyle = gr; g.fillRect(x, 0, w, h);
  // gold braid on the inner edge
  const ex = side < 0 ? x + w - 3 : x;
  g.fillStyle = PAL.gold; g.fillRect(ex, 0, 3, h);
  g.fillStyle = 'rgba(255,240,180,0.5)'; g.fillRect(ex + (side < 0 ? 0 : 2), 0, 1, h);
}

function paintFrame(g, w, h, floorY) {
  const cw = clamp(w * 0.11, 40, 150);
  drape(g, 0, cw, h, -1); drape(g, w - cw, cw, h, 1);
  // valance: scalloped swag with a gold fringe and a lacquer beam
  const vh = clamp(h * 0.045, 36, 74), n = Math.max(5, Math.round(w / 110)), sw = w / n;
  g.fillStyle = PAL.lacquer; g.fillRect(0, 0, w, vh * 0.55);
  g.fillStyle = PAL.gold; g.fillRect(0, vh * 0.55 - 3, w, 3);
  for (let i = 0; i < n; i++) {
    const x0 = i * sw, gr = g.createLinearGradient(0, 0, 0, vh * 1.5);
    gr.addColorStop(0, '#d63a4c'); gr.addColorStop(0.6, '#9c1a2a'); gr.addColorStop(1, '#5a0c18');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x0, vh * 0.5); g.quadraticCurveTo(x0 + sw / 2, vh * 1.9, x0 + sw, vh * 0.5); g.closePath(); g.fill();
    g.strokeStyle = PAL.gold; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, vh * 0.5); g.quadraticCurveTo(x0 + sw / 2, vh * 1.9, x0 + sw, vh * 0.5); g.stroke();
    // tassel at the join
    g.fillStyle = PAL.gold; g.beginPath(); g.arc(x0, vh * 0.55 + 6, 5, 0, TAU); g.fill();
    g.fillRect(x0 - 1.5, vh * 0.55 + 8, 3, 14);
  }
  // gold studs on the beam
  g.fillStyle = PAL.goldHi; for (let x = 12; x < w; x += 36) { g.beginPath(); g.arc(x, vh * 0.27, 2.2, 0, TAU); g.fill(); }
}

// The whole static stage: wall, floor, drapes, valance. `floorY` is where the floor starts (the front edge of the stage back wall).
export function drawStage(ctx, w, h, floorY) {
  const key = `stage|${Math.round(w)}x${Math.round(h)}|${Math.round(floorY)}`;
  stat(ctx, key, w, h, w > 1500 ? 0.5 : 1, (g, ww, hh) => { paintBackdrop(g, ww, hh, floorY); paintFrame(g, ww, hh, floorY); });
}

// Moving light: two soft cones from the valance, drifting dust, swaying lanterns.
export function drawLights(ctx, w, h, floorY, t, calm = false) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 2; k++) {
    const sx = w * (k ? 0.68 : 0.32), sway = calm ? 0 : Math.sin(t * 0.35 + k * 2) * w * 0.04, tx = sx + (k ? -1 : 1) * w * 0.08 + sway;
    const gr = ctx.createLinearGradient(sx, 0, tx, floorY);
    gr.addColorStop(0, 'rgba(255,225,170,0.16)'); gr.addColorStop(1, 'rgba(255,225,170,0.0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(sx - 18, 0); ctx.lineTo(sx + 18, 0); ctx.lineTo(tx + w * 0.2, floorY); ctx.lineTo(tx - w * 0.2, floorY); ctx.closePath(); ctx.fill();
  }
  if (!calm) {
    ctx.fillStyle = 'rgba(255,230,190,0.5)';
    for (let i = 0; i < 18; i++) {
      const u = (i * 0.618 + t * 0.012 * (1 + (i % 3))) % 1, x = (i * 97.3 % w), y = floorY * (0.1 + 0.8 * ((u + i * 0.37) % 1));
      ctx.globalAlpha = 0.15 + 0.25 * Math.abs(Math.sin(t * 0.7 + i));
      ctx.beginPath(); ctx.arc(x + Math.sin(t * 0.3 + i) * 12, y, 1.4 + (i % 3) * 0.6, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

export function drawLantern(ctx, x, y, r, t, glow = 0.6) {
  const sway = Math.sin(t * 0.9 + x * 0.01) * 0.06;
  ctx.save(); ctx.translate(x, y); ctx.rotate(sway);
  ctx.strokeStyle = PAL.goldDeep; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -r * 2.2); ctx.lineTo(0, -r * 0.95); ctx.stroke();
  const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 3);
  g.addColorStop(0, `rgba(255,150,80,${0.5 * glow})`); g.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = g; ctx.fillRect(-r * 3, -r * 3, r * 6, r * 6);
  const body = ctx.createRadialGradient(-r * 0.25, -r * 0.2, r * 0.1, 0, 0, r);
  body.addColorStop(0, '#ff9a6a'); body.addColorStop(0.55, '#e0302c'); body.addColorStop(1, '#8a0f1c');
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.82, r, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(80,0,10,0.5)'; ctx.lineWidth = 1.5;
  for (const k of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.ellipse(0, 0, r * 0.82 * Math.abs(k) + 0.01, r, 0, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = PAL.gold; ctx.fillRect(-r * 0.42, -r * 1.05, r * 0.84, r * 0.2); ctx.fillRect(-r * 0.42, r * 0.85, r * 0.84, r * 0.2);
  ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, r * 1.05); ctx.lineTo(Math.sin(t * 1.6) * 2, r * 1.7); ctx.stroke();
  ctx.restore();
}

// ---- plates ----------------------------------------------------------------------------------------------------------------------------------
const PLATE = {
  porcelain: { rim: '#f7f4ec', rimEdge: '#bfc8d8', face: '#eef2f8', faceLo: '#c9d6ea', ink: '#2c5aa8', ink2: '#5b86cf', side: '#aab6cc' },
  lacquer: { rim: '#e03a3a', rimEdge: '#6a0a14', face: '#c9202c', faceLo: '#7c0c18', ink: '#f4cf6a', ink2: '#ffe9a0', side: '#4a060e' },
  jade: { rim: '#8fe0b8', rimEdge: '#1f6f55', face: '#5fcf9c', faceLo: '#2f8f6c', ink: '#e8fff0', ink2: '#b8f0d4', side: '#175540' },
  gold: { rim: '#fff0a0', rimEdge: '#9a6a12', face: '#ffd45a', faceLo: '#d29a22', ink: '#fff8d0', ink2: '#b8821a', side: '#8a5a0c' },
};
export const plateColors = PLATE;

// Wobble amount from energy: 0 when healthy, 1 on the edge of falling.
export const wobbleOf = (e, jolt = 0) => clamp01(Math.pow(clamp01((0.55 - e) / 0.55), 1.25) + jolt * 0.7);

// A plate at (x, y) (centre of the top face), radius rx. st: { type, e, ph, spinA, jolt, flash, charge }. Painted as a circle in plate space,
// then squashed: tilt (wobble) rotates the circle and changes the squash, spin turns the pattern.
export function plateOffset(pl, rx, calm = false) {
  const aw = wobbleOf(pl.e, pl.jolt) * (calm ? 0.5 : 1);
  return { aw, ox: aw * rx * 0.3 * Math.sin(pl.ph + 0.6), oy: aw * rx * 0.1 * Math.cos(pl.ph * 2) };
}
export function drawPlate(ctx, x, y, rx, pl, o = {}) {
  const P = PLATE[pl.type], calm = !!o.calm;
  const { aw, ox, oy } = plateOffset(pl, rx, calm);
  const squash = clamp(0.32 + 0.16 * aw * Math.sin(pl.ph * 1.0 + 1.2), 0.2, 0.55);
  const rot = aw * 0.34 * Math.sin(pl.ph);
  const th = rx * 0.1;                                                      // plate thickness
  ctx.save();
  ctx.translate(x + ox, y + oy);
  if (o.scale && o.scale !== 1) ctx.scale(o.scale, o.scale);
  ctx.rotate(rot);
  // floor shadow is drawn by the caller; here: soft glow when attention is needed
  if (o.glow) {
    const g = ctx.createRadialGradient(0, 0, rx * 0.6, 0, 0, rx * 1.9);
    g.addColorStop(0, rgba(o.glow, o.glowA ?? 0.5)); g.addColorStop(1, rgba(o.glow, 0));
    ctx.fillStyle = g; ctx.fillRect(-rx * 2, -rx * 1.2, rx * 4, rx * 2.4);
  }
  ctx.save(); ctx.scale(1, squash);
  // underside / thickness
  ctx.fillStyle = P.side; ctx.beginPath(); ctx.arc(0, th / squash, rx, 0, TAU); ctx.fill();
  // rim
  let g = ctx.createLinearGradient(-rx, -rx, rx, rx);
  g.addColorStop(0, P.rim); g.addColorStop(1, P.rimEdge);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
  // the well
  g = ctx.createRadialGradient(-rx * 0.25, -rx * 0.25, rx * 0.1, 0, 0, rx * 0.82);
  g.addColorStop(0, P.face); g.addColorStop(1, P.faceLo);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx * 0.8, 0, TAU); ctx.fill();
  // the pattern turns with the spin
  ctx.save(); ctx.rotate(pl.spinA);
  const blur = clamp01((pl.e - 0.45) * 1.4);                               // fast plates smear the pattern
  ctx.globalAlpha = 1 - blur * 0.55;
  ctx.strokeStyle = P.ink; ctx.lineWidth = rx * 0.045;
  ctx.beginPath(); ctx.arc(0, 0, rx * 0.66, 0, TAU); ctx.stroke();
  ctx.lineWidth = rx * 0.025; ctx.strokeStyle = P.ink2; ctx.beginPath(); ctx.arc(0, 0, rx * 0.56, 0, TAU); ctx.stroke();
  const petals = pl.type === 'jade' ? 6 : pl.type === 'gold' ? 12 : 8;
  ctx.fillStyle = P.ink;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * TAU;
    ctx.save(); ctx.rotate(a); ctx.translate(rx * 0.4, 0);
    if (pl.type === 'porcelain') { ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.11, rx * 0.05, 0, 0, TAU); ctx.fill(); }
    else if (pl.type === 'lacquer') { ctx.beginPath(); ctx.arc(0, 0, rx * 0.045, 0, TAU); ctx.fill(); }
    else if (pl.type === 'jade') { ctx.strokeStyle = P.ink; ctx.lineWidth = rx * 0.03; ctx.beginPath(); ctx.arc(0, 0, rx * 0.08, 0.3, 4.6); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-rx * 0.09, 0); ctx.lineTo(0, rx * 0.04); ctx.lineTo(rx * 0.09, 0); ctx.lineTo(0, -rx * 0.04); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // medallion
  g = ctx.createRadialGradient(0, 0, 1, 0, 0, rx * 0.22);
  g.addColorStop(0, P.rim); g.addColorStop(1, P.ink);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx * 0.2, 0, TAU); ctx.fill();
  ctx.restore();
  // fast spin: a bright sheen ring that fades as the plate tires
  if (pl.e > 0.35) {
    ctx.globalAlpha = clamp01((pl.e - 0.35) * 1.1) * 0.35;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = rx * 0.07; ctx.beginPath(); ctx.arc(0, 0, rx * 0.9, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // rim highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = rx * 0.04; ctx.beginPath(); ctx.arc(0, 0, rx * 0.97, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
  ctx.restore();   // end squash
  // flash when whipped
  if (pl.flash > 0) {
    ctx.save(); ctx.scale(1, squash); ctx.globalAlpha = pl.flash * 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  return { x: x + ox, y: y + oy, squash, rot };
}

// Bamboo pole from the stand (bx, by) up to the underside of a plate at (tx, ty). `bend` is how far the tip has been pushed sideways.
export function drawPole(ctx, bx, by, tx, ty, w0, o = {}) {
  const cx = bx + (tx - bx) * 0.12, cy = by + (ty - by) * 0.55;
  const pt = (u) => { const m = 1 - u; return [m * m * bx + 2 * m * u * cx + u * u * tx, m * m * by + 2 * m * u * cy + u * u * ty]; };
  ctx.save(); ctx.lineCap = 'round';
  const wBase = w0, wTip = w0 * 0.62;
  // draw as short segments so the width can taper
  const N = 14;
  for (const pass of [0, 1]) {
    for (let i = 0; i < N; i++) {
      const a = pt(i / N), b = pt((i + 1) / N), wd = (wBase + (wTip - wBase) * (i / N)) * (pass ? 0.4 : 1);
      ctx.strokeStyle = pass ? PAL.bamboo : PAL.bambooDark; ctx.lineWidth = wd;
      ctx.beginPath(); ctx.moveTo(a[0] + (pass ? -wd * 0.45 : 0), a[1]); ctx.lineTo(b[0] + (pass ? -wd * 0.45 : 0), b[1]); ctx.stroke();
    }
  }
  // nodes
  ctx.strokeStyle = PAL.bambooDark; ctx.lineWidth = Math.max(1.5, w0 * 0.3);
  for (const u of [0.18, 0.36, 0.54, 0.72, 0.9]) {
    const p = pt(u), q = pt(u + 0.01), wd = (wBase + (wTip - wBase) * u) * 0.62;
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    ctx.beginPath(); ctx.moveTo(p[0] - nx * wd, p[1] - ny * wd); ctx.lineTo(p[0] + nx * wd, p[1] + ny * wd); ctx.stroke();
  }
  ctx.restore();
  return pt;
}

// A lacquered stand with a floor pool of light.
export function drawStand(ctx, x, y, rx, lit = 0.5) {
  ctx.save();
  const pr = rx * 1.5;
  let g = ctx.createRadialGradient(x, y, 2, x, y, pr);
  g.addColorStop(0, `rgba(255,214,150,${0.32 * lit + 0.1})`); g.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + 2, pr, pr * 0.3, 0, 0, TAU); ctx.fill();
  const bw = rx * 0.5, bh = rx * 0.22;
  ctx.fillStyle = '#1a0a0c'; ctx.beginPath(); ctx.ellipse(x, y + bh * 0.4, bw, bh * 0.7, 0, 0, TAU); ctx.fill();
  g = ctx.createLinearGradient(x - bw, 0, x + bw, 0); g.addColorStop(0, '#5a0c18'); g.addColorStop(0.45, '#d63a4c'); g.addColorStop(1, '#4a0a14');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - bw, y); ctx.lineTo(x - bw * 0.8, y - bh); ctx.lineTo(x + bw * 0.8, y - bh); ctx.lineTo(x + bw, y); ctx.ellipse(x, y, bw, bh * 0.5, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.ellipse(x, y - bh, bw * 0.8, bh * 0.38, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// The timing gauge shown under a stand: red | amber with a gold centre | dim green | pale. A white needle marks the plate.
export function drawGauge(ctx, x, y, w, e, hot = false) {
  const h = Math.max(7, w * 0.085), x0 = x - w / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(8,2,6,0.7)'; ctx.beginPath(); ctx.roundRect(x0 - 3, y - 3, w + 6, h + 6, (h + 6) / 2); ctx.fill();
  const seg = (a, b, c) => { ctx.fillStyle = c; ctx.fillRect(x0 + w * a, y, w * (b - a), h); };
  ctx.save(); ctx.beginPath(); ctx.roundRect(x0, y, w, h, h / 2); ctx.clip();
  seg(0, TUNE.lo, '#c63a3a'); seg(TUNE.lo, TUNE.hi, '#f0a830'); seg(TUNE.perfLo, TUNE.perfHi, hot ? '#fff6c0' : '#ffe27a');
  seg(TUNE.hi, TUNE.early, '#4a7a58'); seg(TUNE.early, 1, '#6a8aa8');
  ctx.restore();
  if (e >= 0) {
    const nx = x0 + w * clamp01(e);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(nx, y - 4); ctx.lineTo(nx + 5, y - 11); ctx.lineTo(nx - 5, y - 11); ctx.closePath(); ctx.fill();
    ctx.fillRect(nx - 1.2, y - 4, 2.4, h + 8);
  }
  ctx.restore();
}

// ---- particles -----------------------------------------------------------------------------------------------------------------------------
// A particle: { x, y, vx, vy, life, age, kind: 'shard'|'spark'|'puff', size, rot, vr, col, a }
export function burst(list, rng, x, y, kind, n, power = 1, col = '#fff', size = 8) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), s = rng.range(60, 300) * power;
    list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === 'shard' ? 120 : 40), life: rng.range(0.5, 1.1), age: 0, kind, size: size * rng.range(0.5, 1.3), rot: rng.range(0, TAU), vr: rng.range(-9, 9), col });
  }
  if (list.length > 220) list.splice(0, list.length - 220);
}
export function stepParticles(list, dt) {
  for (const p of list) {
    p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    p.vy += (p.kind === 'shard' ? 820 : p.kind === 'spark' ? 120 : -20) * dt; p.vx *= 1 - dt * 0.6;
  }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].age >= list[i].life) list.splice(i, 1);
}
export function drawParticles(ctx, list) {
  for (const p of list) {
    const a = 1 - p.age / p.life;
    ctx.save(); ctx.globalAlpha = clamp01(a * 1.3); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
    if (p.kind === 'shard') { ctx.beginPath(); ctx.moveTo(-p.size, -p.size * 0.4); ctx.lineTo(p.size * 0.9, -p.size * 0.2); ctx.lineTo(p.size * 0.2, p.size * 0.8); ctx.closePath(); ctx.fill(); }
    else if (p.kind === 'spark') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.28, -p.size * 0.28); ctx.lineTo(p.size, 0); ctx.lineTo(p.size * 0.28, p.size * 0.28); ctx.lineTo(0, p.size); ctx.lineTo(-p.size * 0.28, p.size * 0.28); ctx.lineTo(-p.size, 0); ctx.lineTo(-p.size * 0.28, -p.size * 0.28); ctx.closePath(); ctx.fill();
    } else { ctx.globalAlpha = clamp01(a) * 0.35; ctx.beginPath(); ctx.arc(0, 0, p.size * (1 + (1 - a)), 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}

// A drawn star row (results).
export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.15) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * gap * 1.5;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? size * 0.42 : size * 0.95; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = i < n ? PAL.gold : 'rgba(255,240,220,0.14)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = i < n ? PAL.goldDeep : 'rgba(255,240,220,0.25)'; ctx.stroke(); ctx.restore();
  }
}

export { easeOut, clamp, clamp01, mix };
