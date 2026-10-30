// All reusable drawing: themes, backdrop with papel picado garlands, the cards, the tabla, beans and the
// small UI pieces. Pure: reads values, never mutates game state.
let W = 720, H = 1280;   // the screen size of the current backdrop draw (set by drawBackdrop)
import { CARDS } from './cards.js';
import { ICONS } from './icons.js';
import { paintLayers, INK, hexRgb, mix } from './shapes.js';

export const THEMES = {
  fiesta: { name: { en: 'Fiesta', es: 'Fiesta' }, bg: ['#2f0c48', '#7a1a5e', '#1a0830'], glow: 'rgba(255,170,60,0.28)', accent: '#ffb52e', accent2: '#ff5a8a', text: '#fff3dc', sub: 'rgba(255,243,220,0.7)', panel: 'rgba(30,8,40,0.55)', frame: ['#e0653a', '#a8402a'], trim: '#f7c84a', garland: ['#ff4f81', '#ffb52e', '#2fd0b4', '#8a6cff', '#ff7a2e'], paper: '#fff4dd' },
  noche: { name: { en: 'Night', es: 'Noche' }, bg: ['#081a4a', '#1a3f94', '#050b22'], glow: 'rgba(110,200,255,0.25)', accent: '#7be0ff', accent2: '#ffd36a', text: '#eef6ff', sub: 'rgba(238,246,255,0.7)', panel: 'rgba(6,14,46,0.6)', frame: ['#2f6fd0', '#1c4290'], trim: '#ffd36a', garland: ['#7be0ff', '#ffd36a', '#ff7aa8', '#9d8cff', '#5ef0b8'], paper: '#f4f7ff' },
  jade: { name: { en: 'Jade', es: 'Jade' }, bg: ['#06382f', '#12805f', '#031f1a'], glow: 'rgba(255,230,120,0.22)', accent: '#ffd84a', accent2: '#ff7a5a', text: '#f4fff0', sub: 'rgba(244,255,240,0.72)', panel: 'rgba(3,32,26,0.58)', frame: ['#d8a02a', '#a8761a'], trim: '#fff0b0', garland: ['#ffd84a', '#ff7a5a', '#7af0c8', '#ff9ad0', '#f0f8ff'], paper: '#fff8e4' },
  talavera: { name: { en: 'Talavera', es: 'Talavera' }, bg: ['#0a2a7a', '#2a5ac8', '#061648'], glow: 'rgba(255,255,255,0.16)', accent: '#ffe27a', accent2: '#ff8a5a', text: '#f4f8ff', sub: 'rgba(244,248,255,0.74)', panel: 'rgba(5,18,70,0.6)', frame: ['#f4f8ff', '#b8c8ee'], trim: '#2a5ac8', garland: ['#ffe27a', '#ff8a5a', '#f4f8ff', '#7ac0ff', '#ff7ab0'], paper: '#fffdf4' },
};
export const THEME_IDS = Object.keys(THEMES);
export const themeOf = (id) => THEMES[id] ?? THEMES.fiesta;

// ---- generic drawing helpers ---------------------------------------------------------------------------
export function roundPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
export const FONT = 'Georgia, "Times New Roman", serif';
export const font = (px, weight = 700, italic = false) => `${italic ? 'italic ' : ''}${weight} ${Math.round(px)}px ${FONT}`;
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Largest font size <= px at which `text` fits maxW. Never below `min`.
export function fitPx(ctx, text, maxW, px, weight = 700, italic = false, min = 11) {
  let s = px;
  ctx.font = font(s, weight, italic);
  const w = ctx.measureText(text).width;
  if (w > maxW) s = Math.max(min, Math.floor(px * (maxW / w)));
  return s;
}
export function fitText(ctx, text, x, y, maxW, px, opts = {}) {
  const s = fitPx(ctx, text, maxW, px, opts.weight ?? 700, opts.italic, opts.min ?? 11);
  ctx.font = font(s, opts.weight ?? 700, opts.italic);
  ctx.fillText(text, x, y);
  return s;
}
export function wrapLines(ctx, text, maxW) {
  const words = String(text).split(' '), lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Pointer position while a finger/mouse is down (set by game.js each frame): the button under it draws pressed.
export const ptr = { down: false, x: 0, y: 0 };
// Smallest font size (virtual units) allowed right now: about 11 css px. view.js sets it per drawing space each frame.
export const fontFloor = { u: 10 };
// A folk-art button: one fill, one crisp border, soft shadow, pressed = darker and sunk. primary = gold, otherwise a translucent panel.
export function drawButton(ctx, r, label, th, o = {}) {
  const { primary = false, active = false, disabled = false, sub = null, scale = 1, pulse = 0, subRatio = 0.5 } = o;
  const press = o.press ?? (ptr.down && !disabled && ptr.x >= r.x && ptr.x <= r.x + r.w && ptr.y >= r.y && ptr.y <= r.y + r.h);
  ctx.save();
  ctx.globalAlpha = disabled ? 0.4 : 1;
  const y = r.y + (press ? 2 : 0);
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = press ? 5 : 14; ctx.shadowOffsetY = press ? 2 : 6;
  roundPath(ctx, r.x, y, r.w, r.h, Math.min(24, r.h / 2.6));
  let g = ctx.createLinearGradient(0, y, 0, y + r.h);
  const d = press ? 0.22 : 0;
  if (primary) { g.addColorStop(0, mix(th.accent, '#000000', 0.04 + d)); g.addColorStop(1, mix(th.accent, '#000000', 0.16 + d)); }
  else if (active) { g.addColorStop(0, mix(th.accent2, '#000000', 0.04 + d)); g.addColorStop(1, mix(th.accent2, '#000000', 0.22 + d)); }
  else { const base = lacquerOf(th); g.addColorStop(0, mix(base, '#000000', 0.0 + d)); g.addColorStop(1, mix(base, '#000000', 0.28 + d)); }
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2; ctx.strokeStyle = primary ? INK : active ? 'rgba(255,255,255,0.75)' : rgba(th.trim === '#2a5ac8' ? '#ffe27a' : th.trim, 0.55); ctx.stroke();
  if (pulse > 0) { roundPath(ctx, r.x - pulse * 6, y - pulse * 6, r.w + pulse * 12, r.h + pulse * 12, Math.min(28, r.h / 2.2)); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,240,170,${0.7 * (1 - pulse)})`; ctx.stroke(); }
  ctx.fillStyle = primary ? INK : th.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const base = Math.min(Math.min(34, r.h * 0.42) * scale, r.h * (sub ? 0.36 : 0.6));
  const maxW = r.w - 22, fl = Math.min(fontFloor.u, r.h * 0.5);
  if (sub) {
    const s1 = fitPx(ctx, label, maxW, Math.max(fl, base * 0.9), 700, false, fl), s2 = fitPx(ctx, sub, maxW, Math.max(fl, base * subRatio), 400, false, fl);
    ctx.font = font(s1); ctx.fillText(label, r.x + r.w / 2, y + r.h * 0.4);
    ctx.globalAlpha *= 0.78; ctx.font = font(s2, 400); ctx.fillText(sub, r.x + r.w / 2, y + r.h * 0.76);
  } else {
    const s = fitPx(ctx, label, maxW, Math.max(fl, base), 700, false, fl);
    ctx.font = font(s); ctx.fillText(label, r.x + r.w / 2, y + r.h / 2 + 1);
  }
  ctx.restore();
}

// Dark lacquered-wood colour for panels and secondary buttons in each theme (opaque, so they read over the table).
const hexMix = (a, b, t) => { const p = hexRgb(a), q = hexRgb(b); return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
export const lacquerOf = (th) => hexMix(th.bg[0], '#1a0c08', 0.4);
// A plaque: lacquered panel with a thin gold inlay line, used for the HUD and info panels.
export function drawPlaque(ctx, r, th, o = {}) {
  const rad = o.rad ?? Math.min(22, r.h / 2.4);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
  roundPath(ctx, r.x, r.y, r.w, r.h, rad);
  const base = o.fill ?? lacquerOf(th), g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, mix(base, '#000000', 0.02)); g.addColorStop(1, mix(base, '#000000', 0.3));
  ctx.globalAlpha *= o.alpha ?? 0.94; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha /= o.alpha ?? 0.94;
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
  const ins = Math.min(5, r.h * 0.1);
  roundPath(ctx, r.x + ins, r.y + ins, r.w - ins * 2, r.h - ins * 2, Math.max(2, rad - ins));
  ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(th.trim === '#2a5ac8' ? '#ffe27a' : th.trim, o.line ?? 0.45); ctx.stroke();
  ctx.restore();
}

// ---- backdrop -----------------------------------------------------------------------------------------------
// The world: a wooden fiesta table seen from above, a woven sarape runner across it, a warm lamp pool and the
// papel picado above it (its shadows and coloured light drift over the table). The table layer is painted once per
// screen size + theme into an offscreen canvas once 0.3 s of game time has passed (the first frames use the flat
// gradient, so the title is never late), then cross-fades in over 0.45 s of game time. Later rebuilds (rotation) are instant. t = seconds. o: { garland: 'full'|'thin'|'none', w, h, dim (0..1 extra darkening for reading screens) }
const TABLE = { key: '', cvs: null, at: 0, pending: '', prev: null };
export const tableReady = () => !!TABLE.cvs;
export function drawBackdrop(ctx, th, t, o = {}) {
  const { garland = 'full' } = o;
  W = o.w ?? 720; H = o.h ?? 1280;
  const tbl = tableLayer(th, W, H, t);
  const fade = tbl ? clamp01((t - TABLE.at) / 0.45) : 0;
  if (fade < 1) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(0.55, th.bg[1]); g.addColorStop(1, th.bg[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (tbl) {
    ctx.save(); ctx.globalAlpha = fade; ctx.drawImage(tbl, 0, 0, W, H); ctx.restore();
    lightPatches(ctx, t, th, fade);
  }
  if (o.dim) { ctx.fillStyle = `rgba(12,4,10,${o.dim})`; ctx.fillRect(0, 0, W, H); }
  if (th === THEMES.talavera && !tbl) tilePattern(ctx, th);
  if (garland === 'full') garlandRow(ctx, t, th, 6, 74, 1);
  else if (garland === 'thin') garlandRow(ctx, t, th, 4, 30, 0.5);
}
// Coloured light that falls through the papel picado onto the table, drifting with the breeze (5 pre-blurred sprites).
const PATCH = new Map();
function patchSprite(col) {
  if (PATCH.has(col)) return PATCH.get(col);
  let c = null;
  try {
    c = new OffscreenCanvas(160, 120); const x = c.getContext('2d');
    x.filter = 'blur(8px)'; x.fillStyle = col;
    x.beginPath(); x.moveTo(26, 18); x.lineTo(134, 18); x.lineTo(134, 92);
    for (let k = 0; k < 4; k++) { x.lineTo(134 - (k + 0.5) * 27, 80); x.lineTo(134 - (k + 1) * 27, 92); }
    x.closePath(); x.fill();
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(80, 50, 15, 0, 6.2832); x.fill();
  } catch { c = null; }
  PATCH.set(col, c); return c;
}
function lightPatches(ctx, t, th, a) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const k = Math.min(W, H) / 720;
  for (let i = 0; i < 5; i++) {
    const sp = patchSprite(th.garland[i % th.garland.length]); if (!sp) break;
    const bx = ((i * 0.23 + 0.08) % 1) * W, by = (0.12 + ((i * 0.37) % 1) * 0.8) * H;
    const x = bx + Math.sin(t * 0.21 + i * 1.9) * 40 * k, y = by + Math.cos(t * 0.17 + i * 1.3) * 26 * k;
    ctx.globalAlpha = a * (0.07 + 0.025 * Math.sin(t * 0.9 + i * 2.1));
    ctx.setTransform(ctx.getTransform().translate(x, y).rotate(Math.sin(t * 0.3 + i) * 14).scale(2.6 * k, 2.6 * k));
    ctx.drawImage(sp, -80, -60);
    ctx.restore(); ctx.save(); ctx.globalCompositeOperation = 'lighter';
  }
  ctx.restore();
}
// Build (or return) the painted table for this size + theme (presentation only: reads the game time t, changes no state).
function tableLayer(th, w, h, t) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const key = `${Object.keys(THEMES).find((k) => THEMES[k] === th)}|${Math.round(w)}x${Math.round(h)}`;
  if (TABLE.key === key && TABLE.cvs) return TABLE.cvs;
  if (!TABLE.cvs && t < 0.3) return null; // first build waits until the title is on screen
  try { const was = !!TABLE.cvs; TABLE.cvs = paintTable(th, w, h); TABLE.key = key; TABLE.at = was ? t - 1 : t; } catch { TABLE.cvs = null; }
  return TABLE.cvs;
}
function srand(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TABLE_LOOK = {
  fiesta: { wood: ['#3e2010', '#6a3c1c'], cloth: ['#1c0f1c', '#c8243c', '#f0a020', '#e8487a', '#18a090', '#f4e8c8', '#7a2a8a'], lamp: 'rgba(255,190,110,0.30)', tint: 'rgba(120,30,90,0.20)' },
  noche: { wood: ['#2a1a12', '#40281a'], cloth: ['#0e1430', '#2a5ac8', '#ffd36a', '#7be0ff', '#e8487a', '#eef4ff', '#5a3ab0'], lamp: 'rgba(170,200,255,0.24)', tint: 'rgba(30,50,140,0.30)' },
  jade: { wood: ['#33200e', '#4e3216'], cloth: ['#0c2a22', '#1f8a62', '#ffd84a', '#ff7a5a', '#7af0c8', '#fff4dc', '#c8243c'], lamp: 'rgba(255,225,140,0.28)', tint: 'rgba(10,90,60,0.22)' },
  talavera: { wood: ['#36210f', '#553519'], cloth: ['#0a1a4a', '#2a5ac8', '#f4f8ff', '#ffe27a', '#ff8a5a', '#7ac0ff', '#16348a'], lamp: 'rgba(255,240,210,0.26)', tint: 'rgba(30,60,160,0.22)' },
};
function paintTable(th, w, h) {
  const id = Object.keys(THEMES).find((k) => THEMES[k] === th) || 'fiesta', look = TABLE_LOOK[id];
  const S = Math.min(1.6, 2048 / Math.max(w, h)), cw = Math.round(w * S), ch = Math.round(h * S);
  const c = new OffscreenCanvas(cw, ch), x = c.getContext('2d'), r = srand(1234 + id.length * 77);
  x.scale(S, S);
  // planks run across the short side so a portrait screen shows several boards
  const portrait = h >= w, len = portrait ? w : h, span = portrait ? h : w, pw = Math.max(110, Math.min(170, span / 7));
  x.save(); if (!portrait) { x.translate(w, 0); x.rotate(Math.PI / 2); }
  for (let p = 0, y0 = -r() * pw; y0 < span; p++, y0 += pw) {
    const tone = 0.85 + r() * 0.3, gn = 46;
    const g = x.createLinearGradient(0, y0, 0, y0 + pw); g.addColorStop(0, mix(look.wood[1], '#000000', 0.12 * tone)); g.addColorStop(0.5, mix(look.wood[1], look.wood[0], 0.5 - (tone - 1))); g.addColorStop(1, mix(look.wood[0], '#000000', 0.18));
    x.fillStyle = g; x.fillRect(0, y0, len, pw);
    x.save(); x.beginPath(); x.rect(0, y0, len, pw); x.clip();
    for (let i = 0; i < gn; i++) {
      const yy = y0 + r() * pw, amp = 1 + r() * 5, ph = r() * 6.28, fr = 0.006 + r() * 0.014, a = 0.08 + r() * 0.2, dark = r() < 0.72;
      x.strokeStyle = dark ? `rgba(20,8,2,${a})` : `rgba(255,214,160,${a * 0.6})`; x.lineWidth = 0.6 + r() * 2.2; x.beginPath();
      for (let s = 0; s <= len; s += 12) { const v = yy + Math.sin(s * fr + ph) * amp + Math.sin(s * fr * 2.9 + ph) * amp * 0.35; s ? x.lineTo(s, v) : x.moveTo(s, v); }
      x.stroke();
    }
    if (r() < 0.6) { const kx = r() * len, ky = y0 + pw * (0.3 + r() * 0.4), kr = 7 + r() * 10; for (let q = 5; q > 0; q--) { x.strokeStyle = `rgba(25,10,3,${0.08 + 0.05 * q})`; x.lineWidth = 1.3; x.beginPath(); x.ellipse(kx, ky, kr * q * 0.55, kr * q * 0.24, 0, 0, 6.2832); x.stroke(); } }
    x.restore();
    x.fillStyle = 'rgba(8,3,1,0.75)'; x.fillRect(0, y0 - 1.5, len, 3); x.fillStyle = 'rgba(255,220,170,0.08)'; x.fillRect(0, y0 + 1.5, len, 1.5);
  }
  x.restore();
  // woven sarape runner, laid diagonally across the table (most of it sits under the tabla)
  {
    const rw = Math.min(w, h) * 0.62, ang = portrait ? -0.36 : -0.2, L2 = Math.hypot(w, h) * 1.2;
    x.save(); x.translate(w * 0.5, h * 0.52); x.rotate(ang);
    x.shadowColor = 'rgba(0,0,0,0.55)'; x.shadowBlur = 24; x.shadowOffsetY = 8;
    x.fillStyle = look.cloth[0]; x.fillRect(-L2 / 2, -rw / 2, L2, rw); x.shadowColor = 'transparent';
    const bands = [[0, 0.04], [1, 0.12], [2, 0.025], [3, 0.06], [0, 0.012], [4, 0.08], [5, 0.014], [6, 0.07], [2, 0.025], [1, 0.16]];
    const all = [...bands, ...bands.slice().reverse()]; const tot = all.reduce((a, b) => a + b[1], 0);
    let yy = -rw / 2;
    for (const [ci, f] of all) { const hh = (f / tot) * rw; x.fillStyle = look.cloth[ci]; x.fillRect(-L2 / 2, yy, L2, hh + 0.5); yy += hh; }
    // weave: fine weft lines + a stepped diamond row in the middle band (sarape greca)
    for (let v = -rw / 2; v < rw / 2; v += 2.4) { x.fillStyle = 'rgba(0,0,0,0.13)'; x.fillRect(-L2 / 2, v, L2, 0.9); }
    for (let u = -L2 / 2; u < L2 / 2; u += 3) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(u, -rw / 2, 1, rw); }
    x.fillStyle = mix(look.cloth[5], '#000000', 0.1);
    for (let u = -L2 / 2; u < L2 / 2; u += 26) { x.beginPath(); x.moveTo(u, 0); x.lineTo(u + 9, -7); x.lineTo(u + 18, 0); x.lineTo(u + 9, 7); x.closePath(); x.fill(); }
    x.fillStyle = 'rgba(14,5,8,0.46)'; x.fillRect(-L2 / 2, -rw / 2, L2, rw);
    // selvedge: the tightly woven, slightly raised long edges
    for (const e of [-1, 1]) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(-L2 / 2, e > 0 ? rw / 2 - 5 : -rw / 2, L2, 5); x.fillStyle = 'rgba(255,240,220,0.1)'; x.fillRect(-L2 / 2, e > 0 ? rw / 2 - 6 : -rw / 2 + 5, L2, 1); }
    // soft folds
    for (let k = 0; k < 4; k++) { const u = -L2 * 0.3 + k * L2 * 0.2 + r() * 40; const gg = x.createLinearGradient(u - 30, 0, u + 30, 0); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(0.5, 'rgba(0,0,0,0.16)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gg; x.fillRect(u - 30, -rw / 2, 60, rw); }
    x.restore();
  }
  // a few loose pinto beans on the bare wood near the edges
  for (let i = 0; i < 7; i++) {
    const side = i % 2, bx = side ? w * (0.9 + r() * 0.07) : w * (0.03 + r() * 0.07), by = h * (0.15 + r() * 0.75);
    drawBean(x, bx, by, 34 + r() * 6, r() * 6.28, 1);
  }
  // the lamp: warm pool in the middle, falling off to dark edges; theme tint keeps each theme's mood
  x.globalCompositeOperation = 'soft-light'; x.fillStyle = look.tint.replace(/[\d.]+\)$/, '0.35)'); x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'source-over';
  const cx = w * 0.5, cy = h * (portrait ? 0.5 : 0.48), R = Math.hypot(w, h) * 0.66;
  let g = x.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 0.55); g.addColorStop(0, look.lamp); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'source-over';
  g = x.createRadialGradient(cx, cy, R * 0.3, cx, cy, R); g.addColorStop(0, 'rgba(10,3,6,0)'); g.addColorStop(0.72, 'rgba(10,3,6,0.4)'); g.addColorStop(1, 'rgba(6,2,4,0.78)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = look.tint.replace(/[\d.]+\)$/, '0.08)'); x.fillRect(0, 0, w, h);
  return c;
}
function tilePattern(ctx, th) {
  ctx.save(); ctx.globalAlpha = 0.09; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
  for (let y = 40; y < H; y += 120) for (let x = (y / 120) % 2 ? 0 : 60; x < W + 60; x += 120) {
    ctx.beginPath(); ctx.arc(x, y, 30, 0, 6.2832); ctx.stroke();
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); ctx.lineTo(x + Math.cos(a) * 50, y + Math.sin(a) * 50); ctx.stroke(); }
  }
  ctx.restore();
}
function petals(ctx, t, th) {
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const sp = 18 + (i % 5) * 7, x0 = (i * 211) % W, y = ((i * 97 + t * sp) % (H + 60)) - 30;
    const x = x0 + Math.sin(t * 0.7 + i * 1.7) * 26, rot = t * 0.9 + i;
    ctx.globalAlpha = 0.34; ctx.fillStyle = i % 3 === 0 ? th.accent : i % 3 === 1 ? '#ff8a2e' : th.accent2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); ctx.ellipse(0, 0, 9, 4.5, 0, 0, 6.2832); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}
// One papel picado flag, cut from tissue paper: a scalloped bottom, a border of punched dots, a central flower and
// diamonds cut right through (the table shows through the holes), a fold crease. Baked once per colour.
const FLAGS = new Map();
function flagSprite(col) {
  if (FLAGS.has(col)) return FLAGS.get(col);
  let c = null;
  try {
    const FW = 120, FH = 96; c = new OffscreenCanvas(FW, FH); const x = c.getContext('2d');
    x.beginPath(); x.moveTo(0, 0); x.lineTo(FW, 0); x.lineTo(FW, FH - 10);
    for (let k = 0; k < 6; k++) { const xa = FW - k * (FW / 6); x.quadraticCurveTo(xa - FW / 12, FH + 4, xa - FW / 6, FH - 10); }
    x.closePath();
    const g = x.createLinearGradient(0, 0, FW, FH); g.addColorStop(0, mix(col, '#ffffff', 0.18)); g.addColorStop(0.5, col); g.addColorStop(1, mix(col, '#000000', 0.18));
    x.fillStyle = g; x.fill();
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(FW / 2 - 1, 0, 2, FH);           // the fold crease
    x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(FW / 2 + 1, 0, 1.5, FH);
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(10 + i * 12.5, 12, 2.6, 0, 6.2832); x.fill(); }
    for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(10, 24 + i * 11, 2.4, 0, 6.2832); x.fill(); x.beginPath(); x.arc(FW - 10, 24 + i * 11, 2.4, 0, 6.2832); x.fill(); }
    const cx = FW / 2, cy = FH * 0.48;
    for (let p = 0; p < 8; p++) { const a = p * Math.PI / 4; x.beginPath(); x.ellipse(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 8, 3.6, a, 0, 6.2832); x.fill(); }
    x.beginPath(); x.arc(cx, cy, 4.5, 0, 6.2832); x.fill();
    for (const dx of [-36, 36]) { x.beginPath(); x.moveTo(cx + dx, cy - 13); x.lineTo(cx + dx + 8, cy); x.lineTo(cx + dx, cy + 13); x.lineTo(cx + dx - 8, cy); x.closePath(); x.fill(); }
    for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(8 + k * 18.5, FH - 22); x.lineTo(14 + k * 18.5, FH - 28); x.lineTo(20 + k * 18.5, FH - 22); x.closePath(); x.fill(); }
  } catch { c = null; }
  FLAGS.set(col, c); return c;
}
function garlandRow(ctx, t, th, count, drop, alpha) {
  const flagW = Math.min(W, 720) / (count * 2) * 1.8 * (alpha < 1 ? 0.7 : 1);
  const n = Math.ceil(W / (flagW + 4)) + 1, fh = drop * 0.72, full = alpha >= 1;
  const sprites = typeof OffscreenCanvas !== 'undefined' && !!TABLE.cvs; // plain flags until the table is ready (fast first frame)
  ctx.save();
  if (TABLE.cvs && full) { // the flags' shadows fall on the table below them (lamp light from the upper left)
    const k = Math.min(W, 720) / 720, sx = 12 * k, sy = drop * 0.55;
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    for (let i = 0; i < n; i++) {
      const cx = i * (flagW + 4) + flagW / 2 - 6 + sx, sag = 4 + Math.sin(cx / W * Math.PI) * 14 + sy, sway = Math.sin(t * 1.3 + i * 0.7 - 0.4) * 0.07;
      ctx.save(); ctx.translate(cx, sag); ctx.rotate(sway); ctx.beginPath(); ctx.moveTo(-flagW / 2, 0); ctx.lineTo(flagW / 2, 0); ctx.lineTo(flagW / 2, fh); ctx.lineTo(-flagW / 2, fh); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  ctx.strokeStyle = 'rgba(255,240,210,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -10; x <= W + 10; x += 10) { const y = 4 + Math.sin(x / W * Math.PI) * 14; x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const cx = i * (flagW + 4) + flagW / 2 - 6, sag = 4 + Math.sin(cx / W * Math.PI) * 14, ph = t * 1.3 + i * 0.7, sway = Math.sin(ph) * 0.07;
    const col = th.garland[i % th.garland.length];
    ctx.save(); ctx.translate(cx, sag); ctx.rotate(sway);
    const sp = sprites ? flagSprite(col) : null;
    if (sp) {
      const flutter = 1 - 0.06 * (0.5 + 0.5 * Math.sin(ph * 1.7 + 1)); // tissue paper catches the breeze: it narrows as it turns
      ctx.globalAlpha = full ? 0.93 : 0.8; ctx.scale(flutter, 1); ctx.drawImage(sp, -flagW / 2, 0, flagW, fh);
    } else {
      ctx.beginPath(); ctx.moveTo(-flagW / 2, 0); ctx.lineTo(flagW / 2, 0); ctx.lineTo(flagW / 2, fh); ctx.lineTo(-flagW / 2, fh); ctx.closePath();
      ctx.fillStyle = col; ctx.globalAlpha = 0.9; ctx.fill();
    }
    ctx.restore();
  }
  if (full) { // string lights between the flags: warm bulbs with a soft halo that breathes
    for (let i = 0; i <= n; i += 1) {
      const bx = i * (flagW + 4) - 8, by = 6 + Math.sin(bx / W * Math.PI) * 14, f = 0.75 + 0.25 * Math.sin(t * 2.1 + i * 1.7);
      ctx.globalAlpha = 0.5 * f; const hg = ctx.createRadialGradient(bx, by, 0, bx, by, 26); hg.addColorStop(0, 'rgba(255,214,140,0.9)'); hg.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = hg; ctx.fillRect(bx - 26, by - 26, 52, 52);
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff2c8'; ctx.beginPath(); ctx.ellipse(bx, by + 3, 4.5, 6, 0, 0, 6.2832); ctx.fill();
    }
  }
  ctx.restore();
}

// ---- card art sprites -----------------------------------------------------------------------------------------------
const SPR = 348, UNITS = 116, PAD = 8;
const sprites = new Map();
function sprite(id) {
  if (sprites.has(id)) return sprites.get(id);
  let s = null;
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      s = new OffscreenCanvas(SPR, SPR);
      const x = s.getContext('2d');
      x.scale(SPR / UNITS, SPR / UNITS); x.translate(PAD, PAD);
      paintLayers(x, ICONS[CARDS[id].key]());
    } catch { s = null; }
  }
  sprites.set(id, s);
  return s;
}
// Paint card `id`'s picture in a square of side `size` centered at (cx, cy).
export function drawArt(ctx, id, cx, cy, size, o = {}) {
  const s = sprite(id), box = size * (UNITS / 100);
  ctx.save();
  ctx.translate(cx, cy);
  if (o.rot) ctx.rotate(o.rot);
  if (o.sx) ctx.scale(o.sx, 1);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  if (s) ctx.drawImage(s, -box / 2, -box / 2, box, box);
  else { ctx.translate(-size / 2, -size / 2); ctx.scale(size / 100, size / 100); paintLayers(ctx, ICONS[CARDS[id].key]()); }
  ctx.restore();
}
export function warmArt(id) { sprite(id); }

// ---- cards ---------------------------------------------------------------------------------------------------------------
// A cream paper card with a colored border, the picture on a soft window, and a name banner.
// o: { lang, theme, label (true), dim, glow, shadow, alpha, name (override text) }
export function drawCard(ctx, id, x, y, w, h, o = {}) {
  const c = CARDS[id], th = themeOf(o.theme), hue = c.hue, label = o.label !== false;
  const rad = Math.min(w, h) * 0.085;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = o.shadow; ctx.shadowOffsetY = o.shadow * 0.4; }
  roundPath(ctx, x, y, w, h, rad);
  ctx.fillStyle = th.paper; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(2, w * 0.035); ctx.strokeStyle = hue; ctx.stroke();
  const p = w * 0.06, bh = label ? h * 0.17 : 0, wx = x + p, wy = y + p, ww = w - p * 2, wh = h - p * 2 - bh - (label ? p * 0.4 : 0);
  roundPath(ctx, wx, wy, ww, wh, rad * 0.7);
  const rg = ctx.createRadialGradient(wx + ww / 2, wy + wh * 0.45, 2, wx + ww / 2, wy + wh * 0.5, Math.max(ww, wh) * 0.75);
  rg.addColorStop(0, mix(hue, '#ffffff', 0.86)); rg.addColorStop(1, mix(hue, '#ffffff', 0.58));
  ctx.fillStyle = rg; ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = mix(hue, '#000000', 0.15); ctx.globalAlpha *= 0.55; ctx.stroke(); ctx.globalAlpha /= 0.55;
  // folk dots in the window corners
  ctx.fillStyle = mix(hue, '#ffffff', 0.3); const dr = Math.max(1, w * 0.012);
  for (const [dx, dy] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) { ctx.beginPath(); ctx.arc(wx + ww * dx, wy + wh * dy, dr * 1.6, 0, 6.2832); ctx.fill(); }
  const side = Math.min(ww, wh) * 0.92;
  drawArt(ctx, id, wx + ww / 2, wy + wh / 2 + (label ? 0 : 0), side);
  if (label) {
    const bx = x + p, by = y + h - p - bh, bw = w - p * 2;
    roundPath(ctx, bx, by, bw, bh, bh / 2);
    const bg = ctx.createLinearGradient(0, by, 0, by + bh);
    bg.addColorStop(0, mix(hue, '#ffffff', 0.12)); bg.addColorStop(1, mix(hue, '#000000', 0.3));
    ctx.fillStyle = bg; ctx.fill();
    ctx.fillStyle = '#fff8e6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const text = o.name ?? c[o.lang === 'es' ? 'es' : 'en'];
    fitText(ctx, text, x + w / 2, by + bh / 2 + 1, bw - 10, bh * 0.62, { italic: true, min: 8 });
  }
  if (o.dim) { roundPath(ctx, x, y, w, h, rad); ctx.fillStyle = `rgba(20,8,30,${o.dim})`; ctx.fill(); }
  if (o.glow) {
    roundPath(ctx, x - 3, y - 3, w + 6, h + 6, rad + 3); ctx.lineWidth = 4; ctx.strokeStyle = `rgba(255,224,110,${o.glow})`; ctx.stroke();
  }
  ctx.restore();
}

// ---- beans ----------------------------------------------------------------------------------------------------------------
// A real pinto bean (the traditional marker): kidney shape, beige with red-brown mottling, a pale hilum on the inner
// curve, a soft gloss, and a contact shadow cast down-right (the lamp is upper-left). Sprites are baked once per variant.
const BEANS = new Map();
function beanSprite(v) {
  if (BEANS.has(v)) return BEANS.get(v);
  let c = null;
  try {
    const S = 96; c = new OffscreenCanvas(S, S); const x = c.getContext('2d'), r = srand(91 + v * 13);
    x.translate(S / 2, S / 2);
    const shape = () => { x.beginPath(); x.moveTo(0, -40); x.bezierCurveTo(26, -40, 30, -10, 26, 10); x.bezierCurveTo(22, 34, 8, 41, -2, 41); x.bezierCurveTo(-20, 41, -26, 24, -20, 6); x.bezierCurveTo(-15, -6, -22, -16, -18, -28); x.bezierCurveTo(-15, -37, -8, -40, 0, -40); x.closePath(); };
    shape(); const g = x.createRadialGradient(-6, -12, 2, 0, 0, 44); g.addColorStop(0, '#f6dcb8'); g.addColorStop(0.55, '#e0b48a'); g.addColorStop(1, '#a8714a'); x.fillStyle = g; x.fill();
    x.save(); shape(); x.clip();
    for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(${150 + r() * 40},${58 + r() * 24},${40 + r() * 14},${0.6 + r() * 0.35})`; x.beginPath(); const ex = (r() - 0.5) * 56, ey = (r() - 0.5) * 84; for (let q = 0; q < 6; q++) { const a = q / 6 * 6.2832, rr = (2.5 + r() * 5) * (q % 2 ? 0.6 : 1); q ? x.lineTo(ex + Math.cos(a) * rr * 1.4, ey + Math.sin(a) * rr) : x.moveTo(ex + Math.cos(a) * rr * 1.4, ey + Math.sin(a) * rr); } x.closePath(); x.fill(); }
    const sh = x.createRadialGradient(-8, -16, 6, 4, 8, 50); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(30,12,4,0.55)'); x.fillStyle = sh; x.fillRect(-48, -48, 96, 96);
    x.restore();
    x.fillStyle = 'rgba(255,246,226,0.85)'; x.beginPath(); x.ellipse(-19, 0, 2.6, 7, 0.15, 0, 6.2832); x.fill();
    x.fillStyle = 'rgba(255,250,236,0.55)'; x.beginPath(); x.ellipse(-4, -20, 5, 11, -0.35, 0, 6.2832); x.fill();
    shape(); x.lineWidth = 1.6; x.strokeStyle = 'rgba(60,26,10,0.7)'; x.stroke();
  } catch { c = null; }
  BEANS.set(v, c); return c;
}
export function drawBean(ctx, cx, cy, size, rot, t01 = 1) {
  // t01: 0 -> just dropped (large, falling), 1 -> settled. Falls with a squash on landing and a little settle wobble.
  const k = clamp01(t01), e = easeOutBack(k), sc = 1 + (1 - k) * 0.9, dy = (1 - e) * -size * 0.9, lift = 1 - k;
  const sq = k > 0.7 && k < 1 ? 1 - Math.sin((k - 0.7) / 0.3 * Math.PI) * 0.08 : 1;
  const v = Math.abs(Math.round(rot * 100)) % 4, sp = typeof OffscreenCanvas !== 'undefined' ? beanSprite(v) : null;
  ctx.save();
  // contact shadow: tight + dark when resting, wide + faint while in the air
  ctx.save(); ctx.translate(cx + size * (0.07 + lift * 0.25), cy + size * (0.1 + lift * 0.35)); ctx.rotate(rot);
  ctx.fillStyle = `rgba(0,0,0,${0.38 - lift * 0.22})`; ctx.beginPath(); ctx.ellipse(0, 0, size * (0.3 + lift * 0.12), size * (0.43 + lift * 0.12), 0, 0, 6.2832); ctx.fill(); ctx.restore();
  ctx.translate(cx, cy + dy); ctx.rotate(rot); ctx.scale(sc * (0.85 + 0.15 * e) / sq, sc * sq);
  if (sp) { const b = size * 1.06; ctx.drawImage(sp, -b / 2, -b / 2, b, b); }
  else {
    ctx.fillStyle = '#c99a6a'; ctx.strokeStyle = '#3a1a08'; ctx.lineWidth = Math.max(1.5, size * 0.04);
    ctx.beginPath(); ctx.ellipse(0, 0, size * 0.3, size * 0.44, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// ---- the tabla --------------------------------------------------------------------------------------------------------------
// The painted frame. g = tablaGeom. Returns nothing; tiles are drawn by drawTabla.
export function drawFrame(ctx, g, th, o = {}) {
  const rad = g.fr * 1.3;
  ctx.save();
  // the board has thickness: a darker edge below, and a soft shadow thrown down-right on the table
  const thk = Math.max(4, g.fr * 0.42);
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30; ctx.shadowOffsetX = thk * 1.4; ctx.shadowOffsetY = thk * 2.6;
  roundPath(ctx, g.x, g.y + thk, g.w, g.h, rad); ctx.fillStyle = mix(th.frame[1], '#000000', 0.45); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowOffsetX = 0;
  roundPath(ctx, g.x, g.y + thk, g.w, g.h, rad); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  roundPath(ctx, g.x, g.y, g.w, g.h, rad);
  const gr = ctx.createLinearGradient(0, g.y, 0, g.y + g.h);
  gr.addColorStop(0, th.frame[0]); gr.addColorStop(1, th.frame[1]);
  ctx.fillStyle = gr; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  // zigzag trim around the frame
  const n = Math.floor(g.w / (g.fr * 0.9)), step = g.w / n;
  ctx.fillStyle = th.trim; ctx.globalAlpha = 0.9;
  for (let i = 0; i < n; i++) {
    const x = g.x + i * step + step / 2;
    for (const yy of [g.y + g.fr * 0.5, g.y + g.h - g.fr * 0.5]) { ctx.beginPath(); ctx.moveTo(x - step * 0.3, yy + g.fr * 0.2); ctx.lineTo(x, yy - g.fr * 0.2); ctx.lineTo(x + step * 0.3, yy + g.fr * 0.2); ctx.closePath(); ctx.fill(); }
  }
  for (let i = 0; i < n; i++) {
    const y = g.y + i * step + step / 2;
    for (const xx of [g.x + g.fr * 0.5, g.x + g.w - g.fr * 0.5]) { ctx.beginPath(); ctx.moveTo(xx - g.fr * 0.2, y - step * 0.3); ctx.lineTo(xx + g.fr * 0.2, y); ctx.lineTo(xx - g.fr * 0.2, y + step * 0.3); ctx.closePath(); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // lit bevel: highlight on the upper-left lip, shade on the lower-right
  ctx.save(); roundPath(ctx, g.x + 2.5, g.y + 2.5, g.w - 5, g.h - 5, rad - 2); ctx.clip();
  const bv = ctx.createLinearGradient(g.x, g.y, g.x + g.w, g.y + g.h); bv.addColorStop(0, 'rgba(255,240,210,0.28)'); bv.addColorStop(0.35, 'rgba(255,240,210,0)'); bv.addColorStop(0.75, 'rgba(0,0,0,0)'); bv.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = bv; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.restore();
  roundPath(ctx, g.x + g.fr - 3, g.y + g.fr - 3, g.w - g.fr * 2 + 6, g.h - g.fr * 2 + 6, 6);
  ctx.fillStyle = 'rgba(20,6,26,0.55)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}

// Draw a full tabla. t = state time. beanT[i] = seconds since a bean was placed (for the drop),
// o: { lang, theme, called (ids), window, hintCell, glowSet (cells), outline (cells), flash:{cell,t}, dim, labels }
export function drawTabla(ctx, g, tabla, marks, dead, th, t, o = {}) {
  drawFrame(ctx, g, th);
  const pad = Math.max(2, g.tile * 0.035), label = o.labels !== false && g.tile >= 70;
  for (let i = 0; i < 16; i++) {
    const r = { x: g.x + g.fr + (i % 4) * g.tile, y: g.y + g.fr + Math.floor(i / 4) * g.tile };
    const id = tabla[i];
    const isMarked = marks[i];
    const callable = o.called && o.called.includes(id) && !isMarked && !dead[i];
    drawCard(ctx, id, r.x + pad, r.y + pad, g.tile - pad * 2, g.tile - pad * 2, { lang: o.lang, theme: o.theme, label, dim: isMarked ? 0.16 : dead[i] ? 0.5 : 0 });
    if (dead[i] && !isMarked) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = Math.max(2, g.tile * 0.03); ctx.lineCap = 'round';
      const cx = r.x + g.tile / 2, cy = r.y + g.tile / 2, d = g.tile * 0.2;
      ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke(); ctx.restore();
    }
    if (isMarked) {
      const bt = o.beanT ? o.beanT[i] ?? 9 : 9;
      drawBean(ctx, r.x + g.tile * 0.53, r.y + g.tile * 0.45, g.tile * 0.34, ((i * 37) % 60) * 0.02 - 0.5, bt / 0.35);
    }
    if (o.outline && o.outline.includes(i) && !isMarked) {
      const a = 0.55 + 0.35 * Math.sin(t * 6);
      roundPath(ctx, r.x + pad, r.y + pad, g.tile - pad * 2, g.tile - pad * 2, g.tile * 0.08); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]);
    }
    if (o.hintCell === i && !isMarked) {
      const k = 0.5 + 0.5 * Math.sin(t * 8);
      roundPath(ctx, r.x + 1, r.y + 1, g.tile - 2, g.tile - 2, g.tile * 0.1); ctx.lineWidth = 5 + k * 3; ctx.strokeStyle = `rgba(255,230,90,${0.65 + k * 0.35})`; ctx.stroke();
    }
    if (o.flash && o.flash.cell === i) {
      const k = 1 - clamp01(o.flash.t / 0.5);
      roundPath(ctx, r.x + 2, r.y + 2, g.tile - 4, g.tile - 4, g.tile * 0.1);
      ctx.fillStyle = o.flash.kind === 'wrong' ? `rgba(255,60,60,${0.5 * k})` : `rgba(255,255,255,${0.5 * k})`; ctx.fill();
    }
    if (o.winSet && o.winSet.includes(i)) {
      const k = 0.5 + 0.5 * Math.sin(t * 5 + i);
      roundPath(ctx, r.x + 1, r.y + 1, g.tile - 2, g.tile - 2, g.tile * 0.1); ctx.lineWidth = 5; ctx.strokeStyle = `rgba(255,224,90,${0.6 + 0.4 * k})`; ctx.shadowColor = 'rgba(255,200,60,0.9)'; ctx.shadowBlur = 16; ctx.stroke(); ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    }
    void callable;
  }
  ctx.save(); roundPath(ctx, g.x, g.y, g.w, g.h, g.fr * 1.3); ctx.clip();
  const lg = ctx.createLinearGradient(g.x, g.y, g.x + g.w, g.y + g.h); lg.addColorStop(0, 'rgba(255,236,200,0.10)'); lg.addColorStop(0.5, 'rgba(255,236,200,0)'); lg.addColorStop(1, 'rgba(20,6,0,0.14)');
  ctx.fillStyle = lg; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.restore();
}

// Small tabla for a computer player: just status dots, with the pattern's best set outlined.
export function drawMini(ctx, x, y, size, cpu, bestCells, th, won) {
  const cell = size / 4;
  ctx.save();
  roundPath(ctx, x - 3, y - 3, size + 6, size + 6, 6); ctx.fillStyle = th.frame[0]; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const cx = x + (i % 4) * cell, cy = y + Math.floor(i / 4) * cell;
    roundPath(ctx, cx + 1, cy + 1, cell - 2, cell - 2, 2);
    ctx.fillStyle = cpu.marks[i] ? '#8a4a24' : cpu.dead[i] ? 'rgba(30,10,30,0.7)' : '#fff1d6'; ctx.fill();
    if (bestCells && bestCells.includes(i) && !cpu.marks[i]) { ctx.lineWidth = 1.6; ctx.strokeStyle = th.accent; ctx.stroke(); }
  }
  if (won) { roundPath(ctx, x - 5, y - 5, size + 10, size + 10, 8); ctx.lineWidth = 3; ctx.strokeStyle = '#ffe070'; ctx.stroke(); }
  ctx.restore();
}

// A pattern thumbnail: 4x4 dots, highlighted cells drawn as beans (used on setup and in the Rules).
export function drawPatternThumb(ctx, x, y, size, patternId, sets, th, t = 0) {
  const cell = size / 4;
  ctx.save();
  roundPath(ctx, x - 4, y - 4, size + 8, size + 8, 8); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  const lit = new Set();
  if (sets) {
    const arr = patternId === 'linea' ? [sets[(Math.floor(t * 0.7)) % sets.length]] : sets;
    for (const s of arr) for (const i of s) lit.add(i);
  }
  for (let i = 0; i < 16; i++) {
    const cx = x + (i % 4) * cell + cell / 2, cy = y + Math.floor(i / 4) * cell + cell / 2;
    ctx.fillStyle = 'rgba(255,243,220,0.2)'; ctx.beginPath(); ctx.arc(cx, cy, cell * 0.36, 0, 6.2832); ctx.fill();
    if (lit.has(i)) drawBean(ctx, cx, cy, cell * 0.8, ((i * 37) % 60) * 0.02 - 0.5, 1);
  }
  ctx.restore();
}

// Confetti / petals: particles are plain objects in state ({x,y,vx,vy,rot,vr,t,max,c,s}).
export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const a = 1 - p.t / p.max; if (a <= 0) continue;
    ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.6); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
    if (p.kind === 'petal') { ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.5, 0, 0, 6.2832); ctx.fill(); }
    else ctx.fillRect(-p.s / 2, -p.s * 0.3, p.s, p.s * 0.6);
    ctx.restore();
  }
}
export const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
