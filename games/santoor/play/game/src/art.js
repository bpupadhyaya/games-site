// Santoor: all the painting that is not UI. A lamp-lit room with a carved lattice window and a woven carpet, the walnut trapezoid with
// brass and steel courses, small wooden bridges, two mallets, marigold petals and sparks. Pure canvas 2D; no DOM.
import { NCOURSE, scaleById, sargamOf } from './music.js';
import { makeInst } from './layout.js';
import { v3 } from './v3.js';

export const PAL = {
  ink: '#0a1519', night: '#0f2229', wall: '#14323a', teal: '#2fb6a3', tealHi: '#8ef0dc', saffron: '#f2a33a', saffronHi: '#ffd58a', crimson: '#b2382f', crimsonHi: '#ff7a62',
  cream: '#fff3da', walnut: '#6b4326', walnutHi: '#b88553', gold: '#f2cf84', goldDeep: '#a97a2b', brass: '#e7b85a', steel: '#e8eef2',
  left: '#ffb347', leftHi: '#fff0c4', right: '#35d6c0', rightHi: '#d6fff6', ghost: '#b9d4ff',
  text: '#fbf0dc', dim: 'rgba(251,240,220,0.64)', ember: '#e8872c',
};
export const DISPLAY = '"Cormorant Garamond", "Iowan Old Style", Georgia, serif';
export const DEVA = '"Kohinoor Devanagari", "Devanagari Sangam MN", "Noto Sans Devanagari", "Noto Serif Devanagari", sans-serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, k) => a + (b - a) * k;
const hash = (i) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const handCol = (side) => (side === 0 ? PAL.left : PAL.right);

// ---- cache for the heavy static pictures (OffscreenCanvas when the browser has one; otherwise they are drawn directly) -------------------
const caches = new Map();
function cached(key, x, y, w, h, scale, paint) {
  if (typeof OffscreenCanvas !== 'function') return null;
  let c = caches.get(key);
  if (!c) {
    if (caches.size > 14) caches.clear();
    try {
      const cv = new OffscreenCanvas(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale))), g = cv.getContext('2d');
      g.scale(scale, scale); g.translate(-x, -y); paint(g); c = { cv, x, y, w, h };
    } catch { c = null; }
    caches.set(key, c);
  }
  return c;
}

// ---- the room ------------------------------------------------------------------------------------------------------------------------------------
export function paintRoom(g, w, h) {
  const vert = h > w, hz = Math.round(h * (vert ? 0.2 : 0.28));
  const wg = g.createLinearGradient(0, 0, 0, hz); wg.addColorStop(0, '#0b1d24'); wg.addColorStop(1, '#173a43');
  g.fillStyle = wg; g.fillRect(0, 0, w, hz + 2);
  // arched alcoves, each with a warm lamp glow and a carved lattice (jaali) in front of it
  const n = vert ? 2 : Math.max(3, Math.round(w / 300)), aw = (w - 24) / n, top = 14, bot = hz - 16;
  for (let i = 0; i < n; i++) {
    const x = 12 + i * aw, x0 = x + aw * 0.1, x1 = x + aw * 0.9, cx = (x0 + x1) / 2, rad = (x1 - x0) / 2, yArch = top + rad;
    const path = () => { g.beginPath(); g.moveTo(x0, bot); g.lineTo(x0, yArch); g.arc(cx, yArch, rad, Math.PI, 0); g.lineTo(x1, bot); g.closePath(); };
    path();
    const glow = g.createLinearGradient(0, top, 0, bot); glow.addColorStop(0, '#e8a14a'); glow.addColorStop(0.55, '#f6c46e'); glow.addColorStop(1, '#c4742c');
    g.fillStyle = glow; g.fill();
    g.save(); path(); g.clip();
    // lattice: a grid of rotated diamonds
    g.strokeStyle = 'rgba(30,16,8,0.82)'; g.lineWidth = 3.2; const st = Math.max(24, rad * 0.36);
    for (let k = -20; k < 24; k++) {
      g.beginPath(); g.moveTo(x0 + k * st, bot); g.lineTo(x0 + k * st + (bot - top), top); g.stroke();
      g.beginPath(); g.moveTo(x0 + k * st, top); g.lineTo(x0 + k * st + (bot - top), bot); g.stroke();
    }
    g.fillStyle = 'rgba(255,240,200,0.1)'; g.beginPath(); g.arc(cx, yArch + rad * 0.2, rad * 0.8, 0, TAU); g.fill();
    g.restore();
    path(); g.lineWidth = 7; g.strokeStyle = '#2a170d'; g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,214,140,0.5)'; g.stroke();
  }
  // brass lamps hanging at the alcove edges
  for (let i = 0; i <= n; i++) {
    const x = 12 + i * aw, lg = g.createRadialGradient(x, hz * 0.55, 2, x, hz * 0.55, aw * 0.45);
    lg.addColorStop(0, 'rgba(255,205,120,0.22)'); lg.addColorStop(1, 'rgba(255,205,120,0)'); g.fillStyle = lg; g.fillRect(x - aw * 0.5, 0, aw, hz);
  }
  // the skirting
  const bg = g.createLinearGradient(0, hz - 14, 0, hz + 12); bg.addColorStop(0, '#2c1a0e'); bg.addColorStop(0.5, '#5b3920'); bg.addColorStop(1, '#1e1209');
  g.fillStyle = bg; g.fillRect(0, hz - 14, w, 26);
  g.fillStyle = 'rgba(255,220,160,0.2)'; g.fillRect(0, hz - 14, w, 2);
  // woven carpet: deep red ground, border bands, a field of diamonds
  const fg = g.createLinearGradient(0, hz, 0, h); fg.addColorStop(0, '#5a1f1c'); fg.addColorStop(0.6, '#43151a'); fg.addColorStop(1, '#2a0c12');
  g.fillStyle = fg; g.fillRect(0, hz + 12, w, h - hz);
  g.save(); g.beginPath(); g.rect(0, hz + 12, w, h); g.clip();
  const cell = clamp(Math.min(w, h) / 6, 70, 130);
  for (let y = hz + 12 - cell / 2, r = 0; y < h + cell; y += cell / 2, r++) {
    for (let x = -(r % 2) * cell / 2; x < w + cell; x += cell) {
      const k = hash(r * 37 + Math.floor(x / cell)), c = k > 0.66 ? 'rgba(232,163,60,0.2)' : k > 0.33 ? 'rgba(47,182,163,0.16)' : 'rgba(255,238,200,0.12)';
      g.strokeStyle = c; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(x, y - cell * 0.32); g.lineTo(x + cell * 0.32, y); g.lineTo(x, y + cell * 0.32); g.lineTo(x - cell * 0.32, y); g.closePath(); g.stroke();
      g.fillStyle = c; g.beginPath(); g.arc(x, y, cell * 0.06, 0, TAU); g.fill();
    }
  }
  g.restore();
  for (const [yy, a] of [[hz + 36, 0.5], [h - 26, 0.5]]) { g.fillStyle = `rgba(242,163,58,${a * 0.7})`; g.fillRect(0, yy, w, 5); g.fillStyle = 'rgba(255,240,210,0.25)'; g.fillRect(0, yy + 9, w, 2); }
  // lamplight and vignette
  const lg = g.createRadialGradient(w / 2, h * 0.6, Math.min(w, h) * 0.1, w / 2, h * 0.6, Math.max(w, h) * 0.7);
  lg.addColorStop(0, 'rgba(255,190,110,0.14)'); lg.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = lg; g.fillRect(0, hz, w, h);
  const vg = g.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,6,10,0.66)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
}
export function drawRoom(ctx, w, h) {
  if (v3.on) return;                                                       // the 3D carpet is behind the interface
  const c = cached(`room${Math.round(w)}x${Math.round(h)}`, 0, 0, w, h, 1, (g) => paintRoom(g, w, h));
  if (c) ctx.drawImage(c.cv, 0, 0, w, h);
  else { ctx.fillStyle = '#14323a'; ctx.fillRect(0, 0, w, h); }
}

// ---- the instrument body ----------------------------------------------------------------------------------------------------------------------
function trapPath(g, inst, e, rad) {
  const { half, len } = inst, a = half(0) + e, b = half(len) + e, y0 = -e, y1 = len + e;
  g.beginPath(); g.moveTo(-a + rad, y0); g.lineTo(a - rad, y0); g.quadraticCurveTo(a, y0, a - 0.05 * rad, y0 + rad * 0.9);
  g.lineTo(b + 0.05 * rad, y1 - rad * 0.9); g.quadraticCurveTo(b, y1, b - rad, y1); g.lineTo(-b + rad, y1);
  g.quadraticCurveTo(-b, y1, -b - 0.05 * rad, y1 - rad * 0.9); g.lineTo(-a + 0.05 * rad, y0 + rad * 0.9); g.quadraticCurveTo(-a, y0, -a + rad, y0); g.closePath();
}
function paintBody(g, inst) {
  const { len, hb, rh, half, m } = inst, e = m * 0.9, rad = Math.max(10, m);
  g.save(); inst.apply(g);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.65)'; g.shadowBlur = 36; g.shadowOffsetY = 12; g.fillStyle = '#3a2412'; trapPath(g, inst, e, rad); g.fill(); g.restore();
  const wg = g.createLinearGradient(-hb, 0, hb, 0);
  [[0, '#5a361b'], [0.12, '#7a4b28'], [0.3, '#a06a3a'], [0.5, '#b88553'], [0.7, '#a06a3a'], [0.88, '#7a4b28'], [1, '#52301a']].forEach(([o, c]) => wg.addColorStop(o, c));
  g.fillStyle = wg; trapPath(g, inst, e, rad); g.fill();
  g.save(); trapPath(g, inst, e, rad); g.clip();
  // grain along the board
  for (let i = 0; i < 150; i++) {
    const y = -e + (len + 2 * e) * hash(i), a = 0.03 + 0.07 * hash(i + 300), amp = 1 + 3.5 * hash(i + 600), ph = hash(i + 900) * 6;
    g.strokeStyle = `rgba(${hash(i + 50) > 0.5 ? '60,34,14' : '210,160,100'},${a})`; g.lineWidth = 0.8 + 1.5 * hash(i + 77);
    g.beginPath();
    for (let x = -hb - e; x <= hb + e; x += hb / 18) { const yy = y + Math.sin(x / (hb * 0.4) + ph) * amp; x === -hb - e ? g.moveTo(x, yy) : g.lineTo(x, yy); }
    g.stroke();
  }
  // soft sheen down the middle, shade towards the narrow end
  const sg = g.createLinearGradient(0, 0, 0, len); sg.addColorStop(0, 'rgba(255,230,180,0.12)'); sg.addColorStop(1, 'rgba(30,14,4,0.26)');
  g.fillStyle = sg; g.fillRect(-hb - e, -e, 2 * hb + 2 * e, len + 2 * e);
  // the centre band between the two bridge rows: darker, with a chain of gold diamonds
  g.beginPath(); g.moveTo(-half(0) * 0.28, 0); g.lineTo(half(0) * 0.28, 0); g.lineTo(half(len) * 0.28, len); g.lineTo(-half(len) * 0.28, len); g.closePath();
  g.fillStyle = 'rgba(30,14,6,0.28)'; g.fill();
  g.strokeStyle = 'rgba(242,207,132,0.42)'; g.lineWidth = 1.6;
  for (let c = 0; c < NCOURSE; c++) {
    const y = (c + 0.5) * rh, w = Math.min(rh * 0.18, half(y) * 0.1);
    g.beginPath(); g.moveTo(0, y - w * 1.6); g.lineTo(w, y); g.lineTo(0, y + w * 1.6); g.lineTo(-w, y); g.closePath(); g.stroke();
  }
  // a brass inlay line parallel to the slanted edges
  for (const sgn of [-1, 1]) {
    g.strokeStyle = 'rgba(242,207,132,0.65)'; g.lineWidth = 2; g.beginPath(); g.moveTo(sgn * (half(0) - m * 0.4), m * 0.3); g.lineTo(sgn * (half(len) - m * 0.4), len - m * 0.3); g.stroke();
  }
  g.restore();
  // edge lines
  g.strokeStyle = 'rgba(255,230,180,0.5)'; g.lineWidth = 1.6; trapPath(g, inst, e - 3, rad * 0.8); g.stroke();
  g.strokeStyle = 'rgba(20,10,4,0.92)'; g.lineWidth = 3.4; trapPath(g, inst, e, rad); g.stroke();
  // tuning pins and hitch pins along both slanted edges: three per course
  for (let c = 0; c < NCOURSE; c++) for (let k = -1; k <= 1; k++) {
    const y = (c + 0.5) * rh + k * Math.min(rh * 0.15, 11), hw = half(y);
    for (const sgn of [-1, 1]) {
      const x = sgn * (hw + e * 0.35);
      const pg = g.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, Math.max(3, m * 0.34));
      pg.addColorStop(0, '#fff3c8'); pg.addColorStop(0.6, '#c99a3a'); pg.addColorStop(1, '#6b4a14');
      g.fillStyle = pg; g.beginPath(); g.arc(x, y, Math.max(3, m * 0.3), 0, TAU); g.fill();
    }
  }
  g.restore();
}
export function drawBody(ctx, inst, size) {
  if (v3.on) { const e = v3.inst(inst); const o = v3.rel(ctx, { x: 0, y: 0 }); e.ox = o.x; e.oy = o.y; return; }
  const pad = 46, r = inst.r;
  if (!size) { paintBody(ctx, inst); return; }                           // small figures are painted directly
  const c = cached(`body${inst.key}`, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 1.25, (g) => paintBody(g, inst));
  if (c) ctx.drawImage(c.cv, c.x, c.y, c.w, c.h); else paintBody(ctx, inst);
}

// ---- courses (strings) and bridges ------------------------------------------------------------------------------------------------------------------
// ss[n] = { vib (0..1), ph (phase), glow (0..1), flash } per note; focus = Set of notes to light softly.
export const BRIDGE_AT = 0.3;
export function drawCourses(ctx, inst, ss, o = {}) {
  if (v3.on) { const e = v3.inst(inst); e.ss = ss; e.focus = o.focus ?? null; return; }
  const { rh, half } = inst, thin = clamp(rh * 0.04, 1.1, 2.4);
  ctx.save(); inst.apply(ctx); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let c = 0; c < NCOURSE; c++) {
    const yc = (c + 0.5) * rh, hw = half(yc), steel = c >= 3, gap = Math.min(rh * 0.15, 11);
    const L = ss[c * 2] ?? {}, Rr = ss[c * 2 + 1] ?? {}, soft = o.focus && (o.focus.has(c * 2) || o.focus.has(c * 2 + 1));
    for (let k = -1; k <= 1; k++) {
      const y = yc + k * gap, hy = half(y), col = steel ? PAL.steel : PAL.brass;
      const seg = (xa, xb, vib, ph, kk) => {
        ctx.beginPath(); const N = vib > 0.04 ? 20 : 1; ctx.moveTo(xa, y);
        for (let i = 1; i <= N; i++) { const t = i / N, x = xa + (xb - xa) * t; ctx.lineTo(x, y + (N > 1 ? Math.sin(Math.PI * t) * vib * rh * 0.16 * Math.cos(ph + kk * 0.9) : 0)); }
      };
      const bl = -hy * BRIDGE_AT, br = hy * BRIDGE_AT;
      const draw = (xa, xb, st, kk) => {
        const vib = st.vib ?? 0, ph = st.ph ?? 0;
        ctx.strokeStyle = 'rgba(20,8,0,0.4)'; ctx.lineWidth = thin + 1.4; ctx.save(); ctx.translate(0, thin * 1.1); seg(xa, xb, vib, ph, kk); ctx.stroke(); ctx.restore();
        if ((st.glow ?? 0) > 0.03 || soft) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,214,140,${0.08 + 0.42 * (st.glow ?? 0) + (soft ? 0.14 : 0)})`; ctx.lineWidth = thin * 5; seg(xa, xb, vib, ph, kk); ctx.stroke(); ctx.restore();
        }
        ctx.strokeStyle = col; ctx.lineWidth = thin; seg(xa, xb, vib, ph, kk); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(0.6, thin * 0.35); ctx.save(); ctx.translate(0, -thin * 0.25); seg(xa, xb, vib, ph, kk); ctx.stroke(); ctx.restore();
      };
      draw(-hy, bl, L, k); draw(br, hy, Rr, k);
      // the middle part rings in sympathy with either side
      const sym = { vib: Math.max(L.vib ?? 0, Rr.vib ?? 0) * 0.35, ph: (L.ph ?? 0) + (Rr.ph ?? 0), glow: Math.max(L.glow ?? 0, Rr.glow ?? 0) * 0.5 };
      draw(bl, br, sym, k);
    }
    void hw;
  }
  ctx.restore();
}
export function drawBridges(ctx, inst, o = {}) {
  if (v3.on) { v3.inst(inst).hot = o.hot ?? null; return; }
  const { rh, half } = inst, wd = clamp(rh * 0.5, 14, 52), d = clamp(rh * 0.15, 6, 16);
  ctx.save(); inst.apply(ctx);
  for (let c = 0; c < NCOURSE; c++) {
    const y = (c + 0.5) * rh, hy = half(y);
    for (const sgn of [-1, 1]) {
      const x = sgn * hy * BRIDGE_AT, hot = o.hot && o.hot.has(c * 2 + (sgn > 0 ? 1 : 0));
      ctx.fillStyle = 'rgba(10,4,0,0.45)'; ctx.beginPath(); ctx.roundRect(x - d / 2 + 3, y - wd / 2 + 3, d, wd, d * 0.5); ctx.fill();
      const g = ctx.createLinearGradient(x - d / 2, 0, x + d / 2, 0); g.addColorStop(0, '#2c180a'); g.addColorStop(0.45, '#7c5430'); g.addColorStop(0.6, '#4a2c14'); g.addColorStop(1, '#1a0e05');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x - d / 2, y - wd / 2, d, wd, d * 0.5); ctx.fill();
      // brass cap
      ctx.fillStyle = '#e9c26a'; ctx.beginPath(); ctx.roundRect(x - d * 0.18, y - wd / 2 + 2, d * 0.36, wd - 4, d * 0.18); ctx.fill();
      if (hot) { ctx.strokeStyle = 'rgba(255,214,120,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x - d / 2 - 3, y - wd / 2 - 3, d + 6, wd + 6, d * 0.6); ctx.stroke(); }
    }
  }
  ctx.restore();
}

// The playing spots: an engraved ring where a mallet strikes. glow 0..1, flash 0..1 (a ring that expands when struck).
export function drawSpot(ctx, x, y, r, side, glow = 0, flash = 0) {
  if (v3.on) { const p = v3.rel(ctx, { x, y }); v3.spots.push({ x: p.x, y: p.y, r, side, glow, flash }); return; }
  ctx.save();
  const col = side === 0 ? '255,179,71' : '53,214,192';
  ctx.fillStyle = `rgba(${col},${0.08 + 0.18 * glow})`; ctx.beginPath(); ctx.arc(x, y, r * 1.04, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(255,236,200,${0.3 + 0.5 * glow})`; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x, y, r * 1.04, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(${col},${0.35 + 0.5 * glow})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, TAU); ctx.stroke();
  if (flash > 0) { ctx.strokeStyle = `rgba(255,230,160,${flash})`; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(x, y, r * (1.04 + (1 - flash) * 1.3), 0, TAU); ctx.stroke(); }
  ctx.restore();
}
// A note arriving: a filled disc in the mallet's colour plus a ring that shrinks onto the spot. k = time left / approach (1 far, 0 on the beat).
export function drawNote(ctx, x, y, r, o) {
  const { side, kind = 'note', k = 0, alpha = 1, flash = 0, hold = 0, ghost = false, label = '', blind = false } = o;
  if (v3.on) { const p = v3.rel(ctx, { x, y }); v3.notes.push({ x: p.x, y: p.y, r, side, kind, k, alpha: alpha * ctx.globalAlpha, flash, hold, ghost, blind }); return; }
  ctx.save(); ctx.globalAlpha = alpha;
  const base = ghost ? PAL.ghost : side === 0 ? PAL.left : PAL.right, hi = ghost ? '#ffffff' : side === 0 ? PAL.leftHi : PAL.rightHi;
  if (!blind) {
    // the closing ring
    const rr = r * (1 + 1.7 * clamp01(k));
    ctx.strokeStyle = rgba(base, 0.25 + 0.6 * (1 - clamp01(k))); ctx.lineWidth = Math.max(2.5, r * 0.14); ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
  }
  const sz = kind === 'run' ? r * 0.82 : r * 0.94;
  if (!blind || k < 0.2) {
    ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.arc(x + 2, y + 3, sz, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(x - sz * 0.3, y - sz * 0.35, sz * 0.1, x, y, sz);
    g.addColorStop(0, hi); g.addColorStop(0.55, base); g.addColorStop(1, ghost ? '#4a6fb0' : side === 0 ? '#9a5a10' : '#13766a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, sz, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,248,226,0.92)'; ctx.lineWidth = Math.max(1.6, sz * 0.09); ctx.beginPath(); ctx.arc(x, y, sz * 0.9, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(x - sz * 0.3, y - sz * 0.4, sz * 0.3, sz * 0.15, -0.6, 0, TAU); ctx.fill();
    if (kind === 'roll') {                                               // a wavy tremolo mark
      ctx.strokeStyle = 'rgba(40,20,0,0.85)'; ctx.lineWidth = Math.max(2, sz * 0.13); ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i <= 14; i++) { const t = i / 14, xx = x - sz * 0.5 + sz * t, yy = y + Math.sin(t * Math.PI * 3) * sz * 0.2; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.stroke();
      if (hold > 0) { ctx.strokeStyle = '#fff6c8'; ctx.lineWidth = Math.max(3, sz * 0.18); ctx.beginPath(); ctx.arc(x, y, sz * 1.22, -Math.PI / 2, -Math.PI / 2 + TAU * clamp01(hold)); ctx.stroke(); }
    } else if (label) {
      ctx.fillStyle = 'rgba(30,14,0,0.9)'; ctx.font = `800 ${sz * 0.7}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y + sz * 0.04);
    }
  }
  if (flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,240,200,${0.6 * flash})`; ctx.beginPath(); ctx.arc(x, y, sz * (1 + flash * 0.5), 0, TAU); ctx.fill(); }
  ctx.restore();
}

// The mallets: a slim walnut shaft, slightly bent, with a small flat head, held from the player's end. grip = unit vector from the tip
// towards the player. down 0..1 = the strike (the head presses on the string).
export function drawMallet(ctx, x, y, side, grip, across, down = 0, glow = 0, scale = 1) {
  if (v3.on) { const p = v3.rel(ctx, { x, y }); v3.mallets.push({ x: p.x, y: p.y, side, grip, across, down, glow, scale, alpha: ctx.globalAlpha }); return; }
  ctx.save();
  const len = 200 * scale, w = 9 * scale, lean = (side === 0 ? -1 : 1) * 0.42;
  // direction of the shaft from the tip: towards the player and outwards a little
  let dx = grip.x + across.x * lean, dy = grip.y + across.y * lean; const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
  const tx = x + dx * down * 6, ty = y + dy * down * 6, ex = tx + dx * len, ey = ty + dy * len;
  const nx = -dy, ny = dx;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(tx + 5, ty + 7); ctx.quadraticCurveTo(tx + dx * len * 0.5 + nx * 12 + 5, ty + dy * len * 0.5 + ny * 12 + 7, ex + 5, ey + 7); ctx.stroke();
  const sg = ctx.createLinearGradient(tx, ty, ex, ey); sg.addColorStop(0, '#d9a56a'); sg.addColorStop(0.5, '#a56d3a'); sg.addColorStop(1, '#6a3d1c');
  ctx.strokeStyle = sg; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + dx * len * 0.5 + nx * 12, ty + dy * len * 0.5 + ny * 12, ex, ey); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,180,0.55)'; ctx.lineWidth = Math.max(1.2, w * 0.28); ctx.beginPath(); ctx.moveTo(tx + nx * w * 0.2, ty + ny * w * 0.2); ctx.quadraticCurveTo(tx + dx * len * 0.5 + nx * 12 + nx * w * 0.2, ty + dy * len * 0.5 + ny * 12 + ny * w * 0.2, ex + nx * w * 0.2, ey + ny * w * 0.2); ctx.stroke();
  // the head: a small spoon of pale wood with a coloured band (the hand)
  const hr = w * 1.45;
  const hg = ctx.createRadialGradient(tx - hr * 0.3, ty - hr * 0.3, hr * 0.1, tx, ty, hr); hg.addColorStop(0, '#fff1d0'); hg.addColorStop(1, '#c79458');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(tx, ty, hr * 1.1, hr, Math.atan2(dy, dx), 0, TAU); ctx.fill();
  ctx.strokeStyle = side === 0 ? PAL.left : PAL.right; ctx.lineWidth = Math.max(2, w * 0.35); ctx.stroke();
  if (glow > 0) { ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(tx, ty, 1, tx, ty, hr * 3); gg.addColorStop(0, `rgba(255,230,160,${0.8 * glow})`); gg.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(tx, ty, hr * 3, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// A touch ring while a finger is on the instrument.
export function drawTouch(ctx, x, y, r, side) {
  ctx.save(); ctx.strokeStyle = side === 0 ? 'rgba(255,196,110,0.95)' : 'rgba(110,235,215,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.fillStyle = side === 0 ? 'rgba(255,196,110,0.2)' : 'rgba(110,235,215,0.2)'; ctx.fill(); ctx.restore();
}

// Note labels (sargam names or numbers) next to every playing spot, always upright.
export function drawLabels(ctx, inst, size, scaleId, mode, hi = null, r = 24) {
  if (!mode || v3.mute) return;
  const sc = scaleById(scaleId);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let n = 0; n < NCOURSE * 2; n++) {
    const p = inst.pt(n), on = hi && hi.has(n), out = inst.across, o = (n & 1 ? 1 : -1) * (r + size * 1.15);
    const lx = p.x + out.x * o, ly = p.y + out.y * o;
    const lab = mode === 'sargam' ? sargamOf(sc, n) : String(n + 1);
    ctx.font = `700 ${size}px ${UI}`; ctx.fillStyle = on ? '#fff0b8' : 'rgba(255,236,190,0.8)';
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(20,8,0,0.8)'; ctx.lineJoin = 'round';
    if (on) { ctx.shadowColor = 'rgba(255,220,120,0.9)'; ctx.shadowBlur = 10; }
    ctx.strokeText(lab, lx, ly); ctx.fillText(lab, lx, ly); ctx.shadowBlur = 0;
  }
  ctx.restore();
}

// ---- pops, particles ----------------------------------------------------------------------------------------------------------------------------------
export function drawPopup(ctx, p) {
  if (v3.mute) return;
  const k = clamp01(p.age / 0.8), a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, up = (k * k * (3 - 2 * k)) * 46;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sz = p.size * (1 + 0.25 * (1 - Math.min(1, p.age / 0.12)));
  ctx.font = `700 ${sz}px ${DISPLAY}`; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, sz * 0.2); ctx.strokeStyle = 'rgba(6,12,16,0.9)';
  const x = p.x, y = p.y - up;
  ctx.strokeText(p.text, x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, x, y);
  ctx.restore();
}
export function drawParticles(ctx, list) {
  if (v3.on) { v3.parts = list; return; }
  ctx.save();
  for (const p of list) {
    const k = clamp01(p.life / p.max);
    if (p.petal) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, k * 2) * 0.92;
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-p.size * 0.2, -p.size * 0.1, p.size * 0.5, p.size * 0.16, 0, 0, TAU); ctx.fill();
      ctx.restore();
    } else {
      ctx.globalCompositeOperation = 'lighter'; const r = p.size * (0.4 + 0.6 * k), g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
      g.addColorStop(0, `rgba(${p.c},${0.9 * k})`); g.addColorStop(1, `rgba(${p.c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.2, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
}
export function stepParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt; if (p.life <= 0) { list.splice(i, 1); continue; }
    if (p.petal) { p.vx += Math.sin(p.life * 3 + p.rot) * 30 * dt; p.vy += (p.g ?? 30) * dt; p.vx *= 1 - 0.8 * dt; p.vy *= 1 - 0.8 * dt; p.rot += p.spin * dt; }
    else { p.vx *= 1 - 1.6 * dt; p.vy *= 1 - 1.6 * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
// A strike: sparks of gold and a few marigold petals that drift away from the string.
export function burst(list, rng, x, y, n, power = 1, nrm = { x: 1, y: 0 }) {
  const cols = ['#ffb23c', '#ff8a2a', '#ffd54a'];
  for (let i = 0; i < n; i++) {
    const sgn = rng.chance(0.5) ? 1 : -1, sp = rng.range(40, 190) * power, jit = rng.range(-0.5, 0.5);
    const vx = nrm.x * sgn * sp + jit * 60, vy = nrm.y * sgn * sp + jit * 60 - 20;
    if (i % 3 === 0) list.push({ x, y, vx, vy, life: rng.range(1, 1.8), max: 1.8, size: rng.range(6, 10), c: cols[i % 3], petal: true, rot: rng.range(0, 6), spin: rng.range(-3, 3), g: 40 });
    else list.push({ x, y, vx, vy, life: rng.range(0.3, 0.7), max: 0.7, size: rng.range(3, 6), c: '255,226,160' });
  }
  while (list.length > 220) list.shift();
}

export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.15) {
  if (v3.on) { const p = v3.rel(ctx, { x: cx, y: cy }); v3.items.push({ t: 'stars', cx: p.x, cy: p.y, size, n, total, gap }); return; }
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * gap * 1.2;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? size * 0.22 : size * 0.5; k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    if (i < n) { const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5); g.addColorStop(0, '#fff2b0'); g.addColorStop(1, '#e0a62e'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#7a5410'; ctx.lineWidth = 1.5; ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,240,210,0.3)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.restore();
  }
}

// A little santoor lying on the carpet (title hero, figures). r = the rectangle it fills.
export function drawMiniSantoor(ctx, r, o = {}) {
  const inst = makeInst(r, !!o.vert);
  drawBody(ctx, inst, 0);
  drawCourses(ctx, inst, o.ss ?? [], { focus: o.focus });
  drawBridges(ctx, inst, { hot: o.hot });
  for (let n = 0; n < NCOURSE * 2; n++) { const p = inst.pt(n), g = o.ss && o.ss[n] ? o.ss[n].glow : 0; drawSpot(ctx, p.x, p.y, clamp(inst.rh * 0.3, 6, 24), n & 1, g, 0); }
  return inst;
}
export { lerp, hash };

