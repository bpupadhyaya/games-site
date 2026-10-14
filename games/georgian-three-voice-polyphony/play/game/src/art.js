// Three Voices: all the painting that is not UI. A wine cellar by lantern light (stone vaults, buried clay jars, hanging lanterns that
// brighten with the chord's resonance), the pitch ladder, note bars, voice beads, sparks. Pure canvas 2D; no DOM.
import { PARTS } from './music.js';
import { v3, flatAlpha } from './v3.js';

export const PAL = {
  ink: '#120709', wall: '#22100f', wine: '#3a1620', clay: '#7a3a24', stone: '#4b3532', parchment: '#f6e8c8',
  gold: '#f4d27c', goldDeep: '#b8862e', amber: '#d98f2a', amberHi: '#ffd48a', ember: '#e8742c', teal: '#38c4b4', lock: '#fff2b8',
  text: '#fbf0da', dim: 'rgba(251,240,218,0.66)', hairline: 'rgba(255,225,170,0.2)',
};
export const DISPLAY = '"Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;
const hash = (i) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// ---- cache for the static scenery (OffscreenCanvas when the browser has one; otherwise it is drawn directly) ------------------------------
const caches = new Map();
function cached(key, w, h, scale, paint) {
  if (typeof OffscreenCanvas !== 'function') return null;
  let c = caches.get(key);
  if (c === undefined) {
    if (caches.size > 8) caches.clear();
    try {
      const cv = new OffscreenCanvas(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale))), g = cv.getContext('2d');
      g.scale(scale, scale); paint(g); c = { cv, w, h };
    } catch { c = null; }
    caches.set(key, c);
  }
  return c;
}

// ---- the hall -------------------------------------------------------------------------------------------------------------------------
function paintHall(g, w, h) {
  const vert = h > w;
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0f0608'); bg.addColorStop(0.55, '#26100f'); bg.addColorStop(1, '#170a09');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // stone courses: faint horizontal joints with staggered vertical joints
  g.strokeStyle = 'rgba(255,214,170,0.045)'; g.lineWidth = 2;
  const ch = vert ? 58 : 52, cw = vert ? 108 : 120;
  for (let r = 0, y = 0; y < h; r++, y += ch) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    for (let x = (r % 2) * cw * 0.5; x < w; x += cw) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + ch); g.stroke(); }
  }
  // vault arches along the top
  const n = Math.max(2, Math.round(w / (vert ? 360 : 380))), aw = w / n, base = h * (vert ? 0.2 : 0.34);
  for (let i = 0; i < n; i++) {
    const x0 = i * aw, cx = x0 + aw / 2, r = aw / 2 - 10;
    const fill = g.createRadialGradient(cx, base - r * 0.6, r * 0.2, cx, base - r * 0.3, r * 1.15);
    fill.addColorStop(0, 'rgba(255,170,90,0.10)'); fill.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = fill; g.beginPath(); g.moveTo(x0 + 10, base); g.arc(cx, base, r, Math.PI, 0); g.lineTo(x0 + aw - 10, base); g.closePath(); g.fill();
    g.lineWidth = 16; g.strokeStyle = '#2f1816'; g.beginPath(); g.moveTo(x0 + 10, base + 70); g.lineTo(x0 + 10, base); g.arc(cx, base, r, Math.PI, 0); g.lineTo(x0 + aw - 10, base + 70); g.stroke();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,200,150,0.15)'; g.beginPath(); g.arc(cx, base, r - 9, Math.PI, 0); g.stroke();
    for (let k = 1; k < 9; k++) {                                         // keystones round the arch
      const a = Math.PI + (k / 9) * Math.PI;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 8), base + Math.sin(a) * (r - 8)); g.lineTo(cx + Math.cos(a) * (r + 8), base + Math.sin(a) * (r + 8)); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.stroke();
    }
  }
  // the floor and the buried clay jars (qvevri): egg-shaped, only the shoulders and the rim show
  const fy = h * (vert ? 0.86 : 0.84);
  const fg = g.createLinearGradient(0, fy, 0, h); fg.addColorStop(0, '#2b1510'); fg.addColorStop(1, '#0d0605');
  g.fillStyle = fg; g.fillRect(0, fy, w, h - fy);
  g.strokeStyle = 'rgba(255,200,150,0.12)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, fy); g.lineTo(w, fy); g.stroke();
  const jars = Math.max(3, Math.round(w / 190));
  for (let i = 0; i < jars; i++) {
    const jx = (i + 0.5 + (hash(i) - 0.5) * 0.3) * (w / jars), jw = 48 + hash(i + 7) * 18, jh = 46 + hash(i + 3) * 16, jy = fy + 12 + hash(i + 11) * 14;
    const jg = g.createRadialGradient(jx - jw * 0.2, jy, jw * 0.1, jx, jy + jh * 0.2, jw * 0.9);
    jg.addColorStop(0, '#9a5a38'); jg.addColorStop(0.55, '#6a301c'); jg.addColorStop(1, '#2a100a');
    g.fillStyle = jg; g.beginPath(); g.ellipse(jx, jy + jh * 0.5, jw * 0.5, jh * 0.62, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#1a0b07'; g.beginPath(); g.ellipse(jx, jy + jh * 0.08, jw * 0.3, 7, 0, 0, TAU); g.fill();
    g.strokeStyle = '#b87a50'; g.lineWidth = 3; g.beginPath(); g.ellipse(jx, jy + jh * 0.08, jw * 0.3, 7, 0, 0, TAU); g.stroke();
  }
}

// Lantern positions (shared by the hall and the glow overlay).
function lanterns(w, h) {
  const n = Math.max(3, Math.round(w / 240)), out = [];
  for (let i = 0; i < n; i++) out.push({ x: (i + 0.5) * (w / n), y: h * (h > w ? 0.07 : 0.1) + (i % 2) * 22 });
  return out;
}

// glow 0..1 = how bright the lanterns are (chord resonance). t = clock for the flicker.
export function drawHall(ctx, w, h, glow = 0.15, t = 0) {
  if (v3.on) { v3.glow = glow; v3.clock = t; }
  const fa = flatAlpha();
  if (fa <= 0.01) return;
  ctx.save(); ctx.globalAlpha = fa;
  const c = cached(`hall${Math.round(w)}x${Math.round(h)}`, w, h, 0.6, (g) => paintHall(g, w, h));
  if (c) ctx.drawImage(c.cv, 0, 0, w, h); else paintHall(ctx, w, h);
  const L = lanterns(w, h);
  L.forEach((p, i) => {
    const fl = 0.9 + 0.1 * Math.sin(t * (5 + i) + i * 2.1), a = (0.25 + 0.75 * glow) * fl, r = (90 + 150 * glow) * (0.9 + 0.1 * fl);
    const rg = ctx.createRadialGradient(p.x, p.y + 24, 6, p.x, p.y + 24, r);
    rg.addColorStop(0, `rgba(255,214,130,${0.5 * a})`); rg.addColorStop(0.45, `rgba(255,150,70,${0.16 * a})`); rg.addColorStop(1, 'rgba(255,120,50,0)');
    ctx.fillStyle = rg; ctx.fillRect(p.x - r, p.y + 24 - r, r * 2, r * 2);
    ctx.strokeStyle = 'rgba(20,10,8,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, p.y - 16); ctx.stroke();
    ctx.fillStyle = '#2a1410'; ctx.fillRect(p.x - 13, p.y - 18, 26, 6);
    const lg = ctx.createLinearGradient(0, p.y - 12, 0, p.y + 28); lg.addColorStop(0, `rgba(255,${190 + 50 * glow | 0},120,${0.55 + 0.4 * a})`); lg.addColorStop(1, `rgba(255,${130 + 60 * glow | 0},60,${0.5 + 0.4 * a})`);
    ctx.fillStyle = lg; ctx.beginPath(); ctx.roundRect(p.x - 12, p.y - 12, 24, 38, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(30,14,8,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y - 12); ctx.lineTo(p.x, p.y + 26); ctx.moveTo(p.x - 12, p.y + 7); ctx.lineTo(p.x + 12, p.y + 7); ctx.stroke();
  });
  ctx.restore();
}

// ---- stars ----------------------------------------------------------------------------------------------------------------------------
export function drawStars(ctx, cx, cy, size, n, total = 3) {
  const gap = size * 1.15, x0 = cx - gap * (total - 1) / 2;
  for (let i = 0; i < total; i++) {
    const x = x0 + i * gap, on = i < n;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? size * 0.22 : size * 0.5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    ctx.fillStyle = on ? PAL.gold : 'rgba(255,240,220,0.14)'; ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.06); ctx.strokeStyle = on ? '#8a5a12' : 'rgba(255,240,220,0.25)'; ctx.stroke();
    ctx.restore();
  }
}

// ---- voice bead --------------------------------------------------------------------------------------------------------------------------
// A glowing orb: `amp` 0..1 how loudly it sings (halo), `ring` 0..1 the lock ring, `ghost` a friend (hollow rim), `wob` 0..1 beating wobble.
export function drawBead(ctx, x, y, r, part, o = {}) {
  const P = PARTS[part], amp = o.amp ?? 0, lock = o.lock ?? 0, t = o.t ?? 0;
  ctx.save();
  if (amp > 0.02 || lock > 0.02) {
    const hr = r * (1.9 + 1.4 * amp + lock * 0.8), hg = ctx.createRadialGradient(x, y, r * 0.4, x, y, hr);
    hg.addColorStop(0, lock > 0.02 ? `rgba(255,244,190,${0.45 * Math.max(amp, lock)})` : `rgba(255,255,255,${0.14 * amp})`);
    hg.addColorStop(0.35, rgba(P.col, 0.32 * Math.max(amp, lock))); hg.addColorStop(1, rgba(P.col, 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, hr, 0, TAU); ctx.fill();
  }
  if (o.wob > 0.05) {                                                   // beating: a pulsing ring that wobbles at the beat rate
    const k = 0.5 + 0.5 * Math.sin(t * (o.beat ?? 7));
    ctx.strokeStyle = `rgba(255,120,110,${0.25 + 0.5 * o.wob * k})`; ctx.lineWidth = 3 + 3 * k;
    ctx.beginPath(); ctx.arc(x, y, r * (1.35 + 0.22 * k), 0, TAU); ctx.stroke();
  }
  const rr = r * (1 + 0.06 * amp * Math.sin(t * 9));
  const g = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.35, rr * 0.1, x, y, rr);
  g.addColorStop(0, o.ghost ? 'rgba(255,255,255,0.35)' : '#ffffff'); g.addColorStop(0.35, o.ghost ? rgba(P.col, 0.55) : P.hi); g.addColorStop(1, o.ghost ? rgba(P.col, 0.35) : P.col);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = o.ghost ? rgba(P.col, 0.8) : 'rgba(30,12,8,0.7)'; ctx.stroke();
  if (lock > 0.05) { ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,246,200,${0.35 + 0.55 * lock})`; ctx.beginPath(); ctx.arc(x, y, rr * 1.25, 0, TAU); ctx.stroke(); }
  if (o.label) {
    ctx.fillStyle = 'rgba(30,12,8,0.82)'; ctx.font = `800 ${Math.max(12, rr * 0.8)}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.label, x, y + rr * 0.04);
  }
  ctx.restore();
}

// ---- note bars ---------------------------------------------------------------------------------------------------------------------
// x0..x1 along time, y the pitch centre, hh the half height (the tolerance), grade colours after the note was judged.
export function drawNoteBar(ctx, x0, x1, y, hh, part, o = {}) {
  const P = PARTS[part], w = Math.max(6, x1 - x0), a = o.alpha ?? 1;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, y - hh, 0, y + hh);
  const top = o.judged ? (o.good ? '#fff4c0' : 'rgba(120,100,100,0.9)') : P.hi, bot = o.judged ? (o.good ? '#e8b64a' : 'rgba(70,52,52,0.9)') : P.col;
  if (o.friend) { g.addColorStop(0, rgba(P.col, 0.6)); g.addColorStop(1, rgba(P.col, 0.34)); } else { g.addColorStop(0, top); g.addColorStop(1, bot); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x0, y - hh, w, hh * 2, Math.min(hh, w / 2)); ctx.fill();
  ctx.lineWidth = o.active ? 4 : 2; ctx.strokeStyle = o.active ? '#ffffff' : o.friend ? rgba(P.col, 0.75) : 'rgba(30,12,8,0.55)';
  ctx.stroke();
  if (o.active) { ctx.globalAlpha = a * 0.5; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x0 + 2, y - hh + 2, Math.max(4, w - 4), hh * 0.7, Math.min(hh * 0.35, w / 2)); ctx.fill(); }
  ctx.restore();
}

// ---- sparks ----------------------------------------------------------------------------------------------------------------------
export function burst(parts, rng, x, y, n, power, col = '#ffe9a8') {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), s = rng.range(60, 220) * power;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rng.range(0.4, 0.9), max: 0.9, size: rng.range(3, 7), c: col, g: 180 });
  }
  if (parts.length > 160) parts.splice(0, parts.length - 160);
}
export function stepParticles(parts, dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += (p.g ?? 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.5;
  }
}
export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const k = clamp(p.life / (p.max ?? 1), 0, 1);
    ctx.globalAlpha = k; ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
