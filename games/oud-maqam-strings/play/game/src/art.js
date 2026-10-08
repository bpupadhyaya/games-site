// Oud Maqam Strings: all the painting that is not UI. A lamp-lit majlis, a lit canvas oud, target rings, sparks.
// Pure canvas 2D; no DOM. Everything is a function of its arguments (and the clock the caller passes), so it is deterministic.
import { posOfCents, MAQAMAT, degLabel } from './music.js';

export const PAL = {
  night: '#0b1a20', teal: '#12333a', tealHi: '#2a8c88', turq: '#35c7b8', gold: '#f2c46d', goldDeep: '#b98a3a', amber: '#ffb347', ember: '#e8a23a',
  cream: '#fff3dc', pearl: '#f4ecdf', wine: '#6b2433', wineDeep: '#3d1420', walnut: '#5a321a', walnutDark: '#2c180c', spruce: '#e8c488', spruceDeep: '#c4924f',
  ebony: '#1b1410', text: '#fbf0dc', dim: 'rgba(251,240,220,0.62)', good: '#8ef0dc', bad: '#ff7d8f',
};
export const DISPLAY = '"Cinzel", Georgia, "Times New Roman", serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

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

// An eight-point lattice of interlaced lines, the kind of geometry found on wooden screens (generic ornament).
function lattice(g, w, h) {
  const S = 120;
  g.lineWidth = 1.4;
  for (let y = -S; y < h + S; y += S) {
    for (let x = -S; x < w + S; x += S) {
      g.strokeStyle = 'rgba(242,196,109,0.07)';
      g.beginPath();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = S * 0.46; const px = x + S / 2 + Math.cos(a) * r, py = y + S / 2 + Math.sin(a) * r; if (k === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.closePath(); g.stroke();
      g.beginPath();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8, r = S * 0.46; const px = x + S / 2 + Math.cos(a) * r, py = y + S / 2 + Math.sin(a) * r; if (k === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.closePath(); g.stroke();
      g.strokeStyle = 'rgba(53,199,184,0.05)';
      g.beginPath(); g.arc(x + S / 2, y + S / 2, S * 0.2, 0, TAU); g.stroke();
    }
  }
}

// The room: teal walls with a lattice, a vignette, warm lamp light. `lit` 0..1 is how many lamps are glowing, `pulse` the beat.
export function drawBackdrop(ctx, w, h, t, lit = 0.4, pulse = 0) {
  const c = cached(`bg${Math.round(w)}x${Math.round(h)}`, w, h, 1, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0a171d'); gr.addColorStop(0.55, '#10282e'); gr.addColorStop(1, '#1b1a22');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    lattice(g, w, h);
    const v = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(2,6,10,0.65)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
  if (c) ctx.drawImage(c, 0, 0, w, h); else { ctx.fillStyle = '#10282e'; ctx.fillRect(0, 0, w, h); }
  const a = 0.08 + 0.12 * lit + 0.05 * pulse;
  for (const sx of [w * 0.12, w * 0.88]) {
    const g2 = ctx.createRadialGradient(sx, h * 0.04, 6, sx, h * 0.04, Math.max(w, h) * 0.55);
    g2.addColorStop(0, `rgba(255,170,80,${a})`); g2.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
  }
}

// Hanging brass lamps along the top edge. `lit` (0..1) decides how many glow.
export function drawLamps(ctx, w, y, t, lit = 0.4, pulse = 0, size = 1) {
  const xs = [0.14, 0.5, 0.86];
  xs.forEach((fx, i) => {
    const on = lit * 3 > i + 0.2 || i === 1, sw = Math.sin(t * 0.7 + i * 2) * 3 * size, x = w * fx + sw, len = (34 + (i === 1 ? 14 : 0)) * size;
    ctx.save();
    ctx.strokeStyle = 'rgba(200,160,90,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * fx, y - 40); ctx.lineTo(x, y + len); ctx.stroke();
    if (on) {
      const flick = 0.85 + 0.15 * Math.sin(t * 7 + i * 3) + pulse * 0.15;
      const g = ctx.createRadialGradient(x, y + len + 16 * size, 2, x, y + len + 16 * size, 120 * size);
      g.addColorStop(0, `rgba(255,200,110,${0.5 * flick})`); g.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - 130 * size, y + len - 100 * size, 260 * size, 260 * size); ctx.globalCompositeOperation = 'source-over';
    }
    const bw = 15 * size, bh = 26 * size, by = y + len;
    ctx.fillStyle = on ? '#ffd88a' : '#7a6a4a';
    ctx.beginPath(); ctx.moveTo(x - bw * 0.5, by); ctx.lineTo(x + bw * 0.5, by); ctx.lineTo(x + bw, by + bh * 0.5); ctx.lineTo(x + bw * 0.4, by + bh); ctx.lineTo(x - bw * 0.4, by + bh); ctx.lineTo(x - bw, by + bh * 0.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#b98a3a'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#b98a3a'; ctx.fillRect(x - bw * 0.2, by - 6 * size, bw * 0.4, 7 * size);
    ctx.restore();
  });
}

// A woven rug under the instrument (screen space rect).
export function drawRug(ctx, r) {
  const c = cached(`rug${Math.round(r.w)}x${Math.round(r.h)}`, r.w, r.h, 1, (g, w, h) => {
    const rad = 28;
    g.fillStyle = '#4a1a26'; g.beginPath(); g.roundRect(0, 0, w, h, rad); g.fill();
    g.strokeStyle = '#c99a4a'; g.lineWidth = 4; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, rad - 6); g.stroke();
    g.strokeStyle = 'rgba(201,154,74,0.45)'; g.lineWidth = 2; g.beginPath(); g.roundRect(22, 22, w - 44, h - 44, rad - 12); g.stroke();
    g.fillStyle = '#5c2230'; g.beginPath(); g.roundRect(30, 30, w - 60, h - 60, rad - 14); g.fill();
    g.strokeStyle = 'rgba(244,236,223,0.10)'; g.lineWidth = 1.5;
    const s = 56;
    for (let y = 40; y < h - 40; y += s) for (let x = 40; x < w - 40; x += s) { g.beginPath(); g.moveTo(x + s / 2, y + 6); g.lineTo(x + s - 6, y + s / 2); g.lineTo(x + s / 2, y + s - 6); g.lineTo(x + 6, y + s / 2); g.closePath(); g.stroke(); }
  });
  ctx.save(); ctx.globalAlpha = 0.9;
  if (c) ctx.drawImage(c, r.x, r.y, r.w, r.h);
  ctx.restore();
}

// ---- the oud, in its own frame (u along the neck from the nut, v across) ---------------------------------------------------------------------------
const PROFILE = [[0, 0.3], [0.1, 0.46], [0.2, 0.63], [0.32, 0.8], [0.45, 0.93], [0.6, 1], [0.74, 0.98], [0.86, 0.86], [0.94, 0.66], [0.985, 0.36], [1, 0]];
function half(t) {
  for (let i = 1; i < PROFILE.length; i++) if (t <= PROFILE[i][0]) { const a = PROFILE[i - 1], b = PROFILE[i], k = (t - a[0]) / (b[0] - a[0]), s = k * k * (3 - 2 * k); return a[1] + (b[1] - a[1]) * s; }
  return 0;
}
function bodyPath(u0, L, W, inset = 0) { return { u0, L, W, inset }; }
function trace(ctx, b) {
  const n = 40;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const t = i / n, u = b.u0 + b.L * t, v = Math.max(0, b.W / 2 * half(t) - b.inset); if (i === 0) ctx.moveTo(u, -v); else ctx.lineTo(u, -v); }
  for (let i = n; i >= 0; i--) { const t = i / n, u = b.u0 + b.L * t, v = Math.max(0, b.W / 2 * half(t) - b.inset); ctx.lineTo(u, v); }
  ctx.closePath();
}
// Where the strings run: v of course i (0..5) at position u.
export function stringV(G, i, u) {
  const k = clamp01(u / (G.Lneck + G.Lbody * 0.78)), w = G.nutW * 0.74 + (G.bodyW * 0.36 - G.nutW * 0.74) * k;
  return (i - 2.5) / 2.5 * w / 2;
}

function rosette(ctx, cu, R) {
  ctx.save(); ctx.translate(cu, 0);
  let g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
  g.addColorStop(0, '#0d0704'); g.addColorStop(1, '#2a160a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, TAU); ctx.fill();
  for (let i = 0; i < 16; i++) {                               // carved petals
    const a = i * TAU / 16;
    ctx.save(); ctx.rotate(a);
    ctx.fillStyle = i % 2 ? '#e7c68a' : '#8a5a2a';
    ctx.beginPath(); ctx.moveTo(R * 0.62, 0); ctx.quadraticCurveTo(R * 0.8, -R * 0.1, R * 0.98, 0); ctx.quadraticCurveTo(R * 0.8, R * 0.1, R * 0.62, 0); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = '#2a160a'; ctx.lineWidth = Math.max(2, R * 0.04);
  for (const k of [0.62, 0.99]) { ctx.beginPath(); ctx.arc(0, 0, R * k, 0, TAU); ctx.stroke(); }
  ctx.strokeStyle = '#f4ecdf'; ctx.lineWidth = Math.max(1.5, R * 0.025);
  ctx.beginPath(); ctx.arc(0, 0, R * 0.7, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(242,196,109,0.7)'; ctx.lineWidth = Math.max(1.2, R * 0.02);
  for (let k = 0; k < 2; k++) {                                 // a twelve-point star inside the opening
    ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + k * TAU / 24, r = i % 2 ? R * 0.28 : R * 0.54; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}

// Draw the whole instrument. G = geometry from layout.instGeo (with G.span set); o = { t, vib: {u, age} | null, marks, deg: maqam id | null }.
export function drawOud(ctx, G, o = {}) {
  const [a, b, c, d, e, f] = G.matrix;
  const { Lneck, Lbody, bodyW, nutW } = G, uB = Lneck - Lbody * 0.02;
  ctx.save(); ctx.transform(a, b, c, d, e, f);
  // shadow on the rug
  ctx.save(); ctx.translate(10, 14); ctx.fillStyle = 'rgba(0,0,0,0.38)'; trace(ctx, bodyPath(uB, Lbody, bodyW)); ctx.fill(); ctx.restore();
  // pegbox and head
  const ph = G.peg - 6;
  ctx.fillStyle = '#2c180c';
  ctx.beginPath(); ctx.moveTo(-4, -nutW / 2 + 4); ctx.lineTo(-ph * 0.55, -nutW * 0.5 - 8); ctx.lineTo(-ph, -nutW * 0.4); ctx.lineTo(-ph, nutW * 0.4); ctx.lineTo(-ph * 0.55, nutW * 0.5 + 8); ctx.lineTo(-4, nutW / 2 - 4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 3; ctx.stroke();
  for (let i = 0; i < 6; i++) { const side = i < 3 ? -1 : 1, k = (i % 3), pu = -ph * 0.2 - k * ph * 0.22, pv = side * (nutW * 0.5 + 4); ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.arc(pu, pv, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#d9b36a'; ctx.beginPath(); ctx.arc(pu, pv, 3.4, 0, TAU); ctx.fill(); }
  // body: ribs, binding, soundboard
  const outer = bodyPath(uB, Lbody, bodyW);
  let g = ctx.createLinearGradient(0, -bodyW / 2, 0, bodyW / 2);
  g.addColorStop(0, '#7b4a26'); g.addColorStop(0.5, '#4a2a14'); g.addColorStop(1, '#2c180c');
  ctx.fillStyle = g; trace(ctx, outer); ctx.fill();
  const board = bodyPath(uB, Lbody, bodyW, 13);
  g = ctx.createRadialGradient(uB + Lbody * 0.34, -bodyW * 0.12, 10, uB + Lbody * 0.5, 0, bodyW * 0.85);
  g.addColorStop(0, '#f6dba2'); g.addColorStop(0.55, PAL.spruce); g.addColorStop(1, PAL.spruceDeep);
  ctx.fillStyle = g; trace(ctx, board); ctx.fill();
  ctx.save(); trace(ctx, board); ctx.clip();
  ctx.strokeStyle = 'rgba(120,70,20,0.10)'; ctx.lineWidth = 1;
  for (let v = -bodyW / 2; v < bodyW / 2; v += 7) { ctx.beginPath(); ctx.moveTo(uB, v); ctx.lineTo(uB + Lbody, v + Math.sin(v) * 2); ctx.stroke(); }
  g = ctx.createLinearGradient(0, -bodyW / 2, 0, bodyW / 2);
  g.addColorStop(0, 'rgba(255,230,170,0.28)'); g.addColorStop(0.45, 'rgba(255,230,170,0)'); g.addColorStop(1, 'rgba(40,20,5,0.35)');
  ctx.fillStyle = g; ctx.fillRect(uB, -bodyW / 2, Lbody, bodyW);
  ctx.restore();
  ctx.strokeStyle = '#f4ecdf'; ctx.lineWidth = 2; trace(ctx, bodyPath(uB, Lbody, bodyW, 9)); ctx.stroke();        // pearl line inside the binding
  ctx.strokeStyle = '#1b1410'; ctx.lineWidth = 3; trace(ctx, board); ctx.stroke();
  // rosette, bridge
  rosette(ctx, uB + Lbody * 0.36, Math.min(bodyW * 0.24, Lbody * 0.2));
  const ub = Lneck + Lbody * 0.76;
  ctx.fillStyle = '#1b1410'; ctx.beginPath(); ctx.roundRect(ub - 7, -bodyW * 0.2, 14, bodyW * 0.4, 5); ctx.fill();
  ctx.fillStyle = '#f4ecdf'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(ub, (i - 2.5) * bodyW * 0.065, 2.6, 0, TAU); ctx.fill(); }
  // fingerboard
  const uf = Lneck + Lbody * 0.12, w0 = nutW, w1 = nutW * 1.12;
  g = ctx.createLinearGradient(0, -w1 / 2, 0, w1 / 2);
  g.addColorStop(0, '#3b2c22'); g.addColorStop(0.3, '#1f1712'); g.addColorStop(1, '#0f0b08');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -w0 / 2); ctx.lineTo(uf, -w1 / 2); ctx.lineTo(uf, w1 / 2); ctx.lineTo(0, w0 / 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(242,196,109,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#efe6d2'; ctx.fillRect(-3, -w0 / 2, 6, w0);                                           // the nut
  // degree marks (mother-of-pearl dots; a turquoise diamond for quarter-tones)
  if (o.marks !== false && o.maqam) {
    const M = MAQAMAT[o.maqam];
    M.deg.forEach((cts, i) => {
      if (cts > G.span + 1) return;
      const u = posOfCents(cts, G.span) * Lneck, q = M.q.includes(i);
      ctx.strokeStyle = q ? 'rgba(53,199,184,0.55)' : 'rgba(242,196,109,0.28)'; ctx.lineWidth = q ? 2.4 : 1.6;
      ctx.beginPath(); ctx.moveTo(u, -w0 / 2 - (w1 - w0) * u / uf / 2); ctx.lineTo(u, w0 / 2 + (w1 - w0) * u / uf / 2); ctx.stroke();
      if (q) { ctx.fillStyle = PAL.turq; ctx.beginPath(); ctx.moveTo(u, -9); ctx.lineTo(u + 7, 0); ctx.lineTo(u, 9); ctx.lineTo(u - 7, 0); ctx.closePath(); ctx.fill(); }
      else { ctx.fillStyle = i === 0 || i === 7 ? PAL.gold : PAL.pearl; ctx.beginPath(); ctx.arc(u, 0, i === 0 || i === 7 ? 6.5 : 5, 0, TAU); ctx.fill(); }
    });
  }
  // strings: six courses, each a pair, shaking after a pluck
  const vib = o.vib;
  for (let i = 0; i < 6; i++) {
    for (const sub of [-1, 1]) {
      const wob = (u) => (vib ? Math.exp(-vib.age * 4.5) * 3.2 * Math.sin(Math.PI * Math.min(1, u / ub)) * Math.sin(vib.age * 70 + i + sub) : 0);
      ctx.strokeStyle = i < 2 ? 'rgba(210,170,110,0.95)' : 'rgba(232,226,208,0.9)'; ctx.lineWidth = i < 2 ? 2.4 : 1.7;
      ctx.beginPath();
      for (let s = 0; s <= 14; s++) { const u = ub * s / 14, v = stringV(G, i, u) + sub * (1.4 + u / ub * 1.6) + wob(u); if (s === 0) ctx.moveTo(u, v); else ctx.lineTo(u, v); }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// The glowing fingertip on the neck. p = screen point.
export function drawFinger(ctx, p, r, a = 1, ghost = false) {
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, r * 2.2);
  g.addColorStop(0, ghost ? 'rgba(142,240,220,0.5)' : 'rgba(255,214,140,0.55)'); g.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.2, 0, TAU); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = ghost ? PAL.good : PAL.gold; ctx.setLineDash(ghost ? [8, 6] : []);
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = ghost ? 'rgba(142,240,220,0.35)' : 'rgba(255,230,180,0.5)'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.55, 0, TAU); ctx.fill();
  ctx.restore();
}

// Approach ring for a target: k = 0 (far, big) .. 1 (the moment of the note).
export function drawTarget(ctx, p, base, k, col = PAL.gold, a = 1, far = false) {
  ctx.save(); ctx.globalAlpha = a;
  const r = base * (1 + (1 - k) * 1.5);
  if (!far) { ctx.lineWidth = 3 + 3 * k; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); }
  ctx.lineWidth = 3; ctx.strokeStyle = rgba('#fff3dc', 0.85);
  ctx.beginPath(); ctx.arc(p.x, p.y, base, 0, TAU); ctx.stroke();
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, base);
  g.addColorStop(0, rgba('#ffb347', 0.18 + 0.3 * k)); g.addColorStop(1, rgba('#ffb347', 0.04));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, base, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- sparks ----------------------------------------------------------------------------------------------------------------------------
export function burst(parts, rng, x, y, n, col = '#ffd88a', speed = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), s = rng.range(80, 260) * speed;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0, max: rng.range(0.35, 0.8), r: rng.range(2, 5), col });
  }
  if (parts.length > 160) parts.splice(0, parts.length - 160);
}
export function stepParticles(parts, dt) {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.vx *= 0.98; if (p.life > p.max) parts.splice(i, 1); }
}
export function drawParticles(ctx, parts) {
  if (!parts.length) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) { const a = 1 - p.life / p.max; ctx.fillStyle = rgba(p.col, 0.8 * a); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a), 0, TAU); ctx.fill(); }
  ctx.restore();
}

// Small drawn illustrations for the menu and the Rules pages.
export function drawOudIcon(ctx, cx, cy, size, rot = -0.5) {
  const G = { matrix: [1, 0, 0, 1, 0, 0], Lneck: size * 0.62, Lbody: size * 0.58, bodyW: size * 0.52, nutW: size * 0.1, peg: size * 0.1, span: 1200 };
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.translate(-size * 0.55, 0);
  drawOud(ctx, G, { marks: false });
  ctx.restore();
}
export { degLabel };
