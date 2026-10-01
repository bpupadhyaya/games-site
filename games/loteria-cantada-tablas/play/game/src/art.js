// All reusable drawing: themes, backdrop with papel picado garlands, the cards, the tabla, beans and the
// small UI pieces. Pure: reads values, never mutates game state.
import { W, H } from './layout.js';
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
  else { const k = press ? 0.06 : 0.14; g.addColorStop(0, `rgba(255,255,255,${k})`); g.addColorStop(1, `rgba(255,255,255,${k - 0.03})`); }
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2; ctx.strokeStyle = primary ? INK : active ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.4)'; ctx.stroke();
  if (pulse > 0) { roundPath(ctx, r.x - pulse * 6, y - pulse * 6, r.w + pulse * 12, r.h + pulse * 12, Math.min(28, r.h / 2.2)); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,240,170,${0.7 * (1 - pulse)})`; ctx.stroke(); }
  ctx.fillStyle = primary ? INK : th.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const base = Math.min(Math.min(34, r.h * 0.42) * scale, r.h * (sub ? 0.36 : 0.6));
  const maxW = r.w - 22;
  if (sub) {
    const s1 = fitPx(ctx, label, maxW, base * 0.9), s2 = fitPx(ctx, sub, maxW, base * subRatio, 400);
    ctx.font = font(s1); ctx.fillText(label, r.x + r.w / 2, y + r.h * 0.4);
    ctx.globalAlpha *= 0.78; ctx.font = font(s2, 400); ctx.fillText(sub, r.x + r.w / 2, y + r.h * 0.76);
  } else {
    const s = fitPx(ctx, label, maxW, base);
    ctx.font = font(s); ctx.fillText(label, r.x + r.w / 2, y + r.h / 2 + 1);
  }
  ctx.restore();
}

// ---- backdrop -----------------------------------------------------------------------------------------------
// t = seconds. Garland: papel-picado flags on a sagging string, swaying gently.
export function drawBackdrop(ctx, th, t, o = {}) {
  const { garland = 'full' } = o;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.55, th.bg[1]); g.addColorStop(1, th.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, 700);
  rg.addColorStop(0, th.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  // soft bokeh lights
  for (let i = 0; i < 14; i++) {
    const x = (i * 163 + 40) % W, y = 120 + ((i * 331) % 1000), r = 14 + (i % 4) * 9, a = 0.05 + 0.04 * Math.sin(t * 0.8 + i);
    ctx.fillStyle = `rgba(255,230,170,${a})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
  if (th === THEMES.talavera) tilePattern(ctx, th);
  petals(ctx, t, th);
  if (garland === 'full') garlandRow(ctx, t, th, 6, 74, 1);
  else if (garland === 'thin') garlandRow(ctx, t, th, 4, 30, 0.5);
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
function garlandRow(ctx, t, th, count, drop, alpha) {
  const flagW = W / (count * 2) * 1.8 * (alpha < 1 ? 0.7 : 1);
  const n = Math.ceil(W / (flagW + 4)) + 1;
  ctx.save(); ctx.globalAlpha = alpha < 1 ? 0.9 : 1;
  ctx.strokeStyle = 'rgba(255,240,210,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -10; x <= W + 10; x += 10) { const y = 4 + Math.sin(x / W * Math.PI) * 14; x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const cx = i * (flagW + 4) + flagW / 2 - 6, sag = 4 + Math.sin(cx / W * Math.PI) * 14, sway = Math.sin(t * 1.3 + i * 0.7) * 0.07;
    const col = th.garland[i % th.garland.length], fh = drop * 0.72;
    ctx.save(); ctx.translate(cx, sag); ctx.rotate(sway);
    ctx.beginPath(); ctx.moveTo(-flagW / 2, 0); ctx.lineTo(flagW / 2, 0); ctx.lineTo(flagW / 2, fh);
    const sc = 4, sw = flagW / sc;
    for (let k = 0; k < sc; k++) { ctx.lineTo(flagW / 2 - (k + 0.5) * sw, fh - 8); ctx.lineTo(flagW / 2 - (k + 1) * sw, fh); }
    ctx.closePath();
    ctx.fillStyle = col; ctx.globalAlpha = 0.92 * (alpha < 1 ? 0.9 : 1); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#1a0830';
    if (alpha >= 1) {
      ctx.beginPath(); ctx.arc(0, fh * 0.4, flagW * 0.17, 0, 6.2832); ctx.fill();
      for (let k = -1; k <= 1; k += 2) { ctx.beginPath(); ctx.moveTo(k * flagW * 0.32, fh * 0.2); ctx.lineTo(k * flagW * 0.42, fh * 0.3); ctx.lineTo(k * flagW * 0.32, fh * 0.4); ctx.lineTo(k * flagW * 0.22, fh * 0.3); ctx.closePath(); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(-flagW * 0.28, fh * 0.72); ctx.lineTo(0, fh * 0.62); ctx.lineTo(flagW * 0.28, fh * 0.72); ctx.lineTo(0, fh * 0.8); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
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
export function drawBean(ctx, cx, cy, size, rot, t01 = 1) {
  // t01: 0 -> just dropped (large, falling), 1 -> settled
  const e = easeOutBack(clamp01(t01)), sc = 1 + (1 - clamp01(t01)) * 0.9, dy = (1 - e) * -size * 0.9;
  ctx.save();
  ctx.translate(cx, cy + dy); ctx.rotate(rot); ctx.scale(sc * (0.85 + 0.15 * e), sc);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(size * 0.06, size * 0.1, size * 0.34, size * 0.46, 0, 0, 6.2832); ctx.fill();
  const g = ctx.createRadialGradient(-size * 0.1, -size * 0.18, 2, 0, 0, size * 0.5);
  g.addColorStop(0, '#d89a5c'); g.addColorStop(0.45, '#9a5a30'); g.addColorStop(1, '#4a2410');
  ctx.fillStyle = g; ctx.strokeStyle = '#2a1008'; ctx.lineWidth = Math.max(1.5, size * 0.04);
  ctx.beginPath(); ctx.ellipse(0, 0, size * 0.32, size * 0.46, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,235,200,0.55)'; ctx.beginPath(); ctx.ellipse(-size * 0.1, -size * 0.2, size * 0.07, size * 0.15, -0.3, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = 'rgba(40,16,8,0.5)'; ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.beginPath(); ctx.moveTo(size * 0.02, -size * 0.3); ctx.quadraticCurveTo(size * 0.12, 0, size * 0.02, size * 0.3); ctx.stroke();
  ctx.restore();
}

// ---- the tabla --------------------------------------------------------------------------------------------------------------
// The painted frame. g = tablaGeom. Returns nothing; tiles are drawn by drawTabla.
export function drawFrame(ctx, g, th, o = {}) {
  const rad = g.fr * 1.3;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
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
      drawBean(ctx, r.x + g.tile / 2, r.y + g.tile * 0.44, g.tile * 0.44, ((i * 37) % 60) * 0.02 - 0.5, bt / 0.35);
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
