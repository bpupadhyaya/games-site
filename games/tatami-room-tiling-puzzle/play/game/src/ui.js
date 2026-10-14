// Drawing kit: looks (palettes), text helpers, flat buttons, tiles with soft depth, icons.
import { host } from './layout.js';
import { v3 } from './v3.js';

export const UI = 'Fredoka, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- looks ----------------------------------------------------------------------------------------------------------
export const LOOKS = {
  spring: { name: 'Spring', dark: true, season: 'spring', bg0: '#3a2a3e', bg1: '#1a1222', glow: 'rgba(255,170,200,0.17)', panel: 'rgba(255,255,255,0.07)', line: 'rgba(255,255,255,0.16)', text: '#fbf1ee', dim: 'rgba(251,241,238,0.66)', accent: '#ff9db8', onAccent: '#35101c', good: '#7fe0a8', err: '#ff6b6b', btn: 'rgba(255,255,255,0.09)', floor: '#2b2030', floorLine: 'rgba(255,214,226,0.16)', wall: '#5a3a2a', wallTop: '#8a6246', straw: '#d9d49a', strawDeep: '#b8b277', heri: '#2d3566' },
  summer: { name: 'Summer', dark: true, season: 'summer', bg0: '#12404a', bg1: '#06191f', glow: 'rgba(120,255,220,0.14)', panel: 'rgba(255,255,255,0.07)', line: 'rgba(255,255,255,0.16)', text: '#eefaf3', dim: 'rgba(238,250,243,0.66)', accent: '#7fe6c8', onAccent: '#06241c', good: '#7fe0a8', err: '#ff7a6b', btn: 'rgba(255,255,255,0.09)', floor: '#10282c', floorLine: 'rgba(180,255,230,0.14)', wall: '#4a3a24', wallTop: '#7b6340', straw: '#cfd98e', strawDeep: '#a9b86a', heri: '#1d2f4a' },
  autumn: { name: 'Autumn', dark: true, season: 'autumn', bg0: '#4a2a14', bg1: '#1e0f08', glow: 'rgba(255,170,80,0.17)', panel: 'rgba(255,255,255,0.07)', line: 'rgba(255,255,255,0.16)', text: '#fff1e0', dim: 'rgba(255,241,224,0.66)', accent: '#ffb35c', onAccent: '#2a1304', good: '#8be0a0', err: '#ff6a5a', btn: 'rgba(255,255,255,0.09)', floor: '#2a160c', floorLine: 'rgba(255,200,140,0.16)', wall: '#3d2616', wallTop: '#6e4a2e', straw: '#dccf8a', strawDeep: '#b9a965', heri: '#3a1d12' },
  winter: { name: 'Winter', dark: true, season: 'winter', bg0: '#1c2c52', bg1: '#080e22', glow: 'rgba(160,200,255,0.17)', panel: 'rgba(255,255,255,0.07)', line: 'rgba(255,255,255,0.17)', text: '#f1f5ff', dim: 'rgba(241,245,255,0.66)', accent: '#9cc8ff', onAccent: '#071a33', good: '#7fe0b8', err: '#ff7a7a', btn: 'rgba(255,255,255,0.09)', floor: '#12192c', floorLine: 'rgba(190,215,255,0.16)', wall: '#3a3a44', wallTop: '#6a6a78', straw: '#d6d6a6', strawDeep: '#aeae82', heri: '#1b2a52' },
};
export const LOOK_IDS = Object.keys(LOOKS);
let T = LOOKS.spring;
export const setLook = (id) => { T = LOOKS[id] ?? LOOKS.spring; };
export const theme = () => T;

// ---- colour helpers ---------------------------------------------------------------------------------------------------
const hexRgb = (h) => (h[0] === 'r' ? h.slice(h.indexOf('(') + 1, h.indexOf(')')).split(',').slice(0, 3).map(Number) : [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const mixCache = new Map();
export function mix(a, b, t) {
  const key = a + b + t, hit = mixCache.get(key);
  if (hit) return hit;
  const x = hexRgb(a), y = hexRgb(b);
  const out = `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
  mixCache.set(key, out);
  return out;
}
export const rgba = (hex, a) => { const c = hexRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

// ---- text ----------------------------------------------------------------------------------------------------------------
export const F = (n) => Math.max(n, 12 / (host.px || 0.55));   // never below ~12 css px
export const setFont = (ctx, size, weight = 500) => { ctx.font = `${weight} ${size}px ${UI}`; };
const wrapCache = new Map();
export function wrap(ctx, text, maxW, size, weight = 500) {
  const key = `${size}|${weight}|${Math.round(maxW)}|${text}`;
  let out = wrapCache.get(key);
  if (out) return out;
  setFont(ctx, size, weight);
  out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  if (wrapCache.size > 600) wrapCache.clear();
  wrapCache.set(key, out);
  return out;
}
// Single line, shrunk (never below `min`) to fit maxW.
export function txt(ctx, s, x, y, { size = 28, weight = 500, color = T.text, align = 'left', base = 'middle', maxW = 0, min = 0 } = {}) {
  s = String(s);
  setFont(ctx, size, weight);
  if (maxW) {
    const floor = Math.max(min || 10, 11.5 / (host.px || 0.55));   // never shrink below ~11.5 css px: cut with an ellipsis instead
    let w = ctx.measureText(s).width;
    while (w > maxW && size > floor) { size -= 1; setFont(ctx, size, weight); w = ctx.measureText(s).width; }
    if (w > maxW && s.length > 3) { while (s.length > 3 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1); s += '…'; }
  }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(s, x, y);
  return size;
}
// Wrapped paragraph; returns its height.
export function para(ctx, s, x, y, w, { size = 28, weight = 500, color = T.text, align = 'left', lh = 1.32 } = {}) {
  const lines = wrap(ctx, s, w, size, weight), step = size * lh;
  setFont(ctx, size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  lines.forEach((l, i) => ctx.fillText(l, ax, y + i * step));
  return lines.length * step;
}
export const paraHeight = (ctx, s, w, size, weight = 500, lh = 1.32) => wrap(ctx, s, w, size, weight).length * size * lh;

// ---- shapes --------------------------------------------------------------------------------------------------------------
export const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); };
export function panel(ctx, r, { radius = 22, fill = T.panel, line = T.line } = {}) {
  if (v3.on) { plaque(ctx, r, { radius, fill: fill === T.panel ? null : fill, edge: line !== null }); if (line && line !== T.line) { rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.lineWidth = 3; ctx.strokeStyle = line; ctx.stroke(); } return; }
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.lineWidth = 1.5; ctx.strokeStyle = line; ctx.stroke(); }
}
export function background(ctx, w, h, t = 0) {
  if (v3.on) { ctx.clearRect(0, 0, w, h); return; }   // the 3D room is the background
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, T.bg0); g.addColorStop(1, T.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = Math.max(w, h) * 0.7, gx = w * (0.3 + 0.05 * Math.sin(t * 0.15)), gy = h * 0.18;
  const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
  rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
}

// A readable dark veil over the 3D garden for text screens (Rules, Settings, Stats...): darker at the top and bottom, lighter in the middle.
export function scrim(ctx, w, h, k = 1) {
  if (!v3.on) return;
  const a = T.dark ? 0.7 : 0.78, c = T.dark ? '14,7,4' : '246,238,218';
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(${c},${a * 0.95 * k})`); g.addColorStop(0.35, `rgba(${c},${a * 0.8 * k})`); g.addColorStop(1, `rgba(${c},${Math.min(0.94, a * 1.1) * k})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
// Soft vignette over the 3D room (screen corners fall into shadow).
export function vignette(ctx, w, h, k = 1) {
  if (!v3.on) return;
  const r = Math.hypot(w, h) * 0.5, g = ctx.createRadialGradient(w / 2, h * 0.5, r * 0.45, w / 2, h * 0.5, r);
  g.addColorStop(0, 'rgba(6,3,2,0)'); g.addColorStop(1, `rgba(6,3,2,${0.62 * k})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
// Soft darkening under the top HUD of the play screen.
export function topVeil(ctx, w, h, k = 1) {
  if (!v3.on) return;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(${T.dark ? '2,10,14' : '240,232,210'},${0.6 * k})`); g.addColorStop(1, `rgba(${T.dark ? '2,10,14' : '240,232,210'},0)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

// ---- carved / lacquered chrome ---------------------------------------------------------------------------------------------
const BRASS0 = '#fff0b0', BRASS1 = '#d9a63c', BRASS2 = '#8a5f1c';
const brassGrad = (ctx, r) => { const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.4, r.y + r.h); g.addColorStop(0, BRASS0); g.addColorStop(0.45, BRASS1); g.addColorStop(1, BRASS2); return g; };
// A raised lacquered slab: soft drop shadow, body gradient, bevel highlight on top, darker lip underneath. `down` presses it in.
export function lacquer(ctx, r, { radius = 18, kind = 'solid', active = false, down = 0, disabled = false } = {}) {
  const dark = T.dark, acc = kind === 'accent';
  const top = acc ? mix(T.accent.length === 7 ? T.accent : '#ffb347', '#ffffff', 0.3) : dark ? mix(T.wall, '#ffffff', 0.26) : '#fffaf0';
  const mid = acc ? (T.accent.length === 7 ? T.accent : '#ffb347') : dark ? mix(T.wall, '#ffffff', 0.12) : '#f1e6c8';
  const bot = acc ? mix(T.accent.length === 7 ? T.accent : '#ffb347', '#000000', 0.28) : dark ? mix(T.wall, '#000000', 0.18) : '#d9c9a0';
  const dy = down * 3, depth = 5 * (1 - down * 0.7);
  ctx.save();
  if (disabled) ctx.globalAlpha *= 0.45;
  // shadow + the visible side of the slab
  rr(ctx, r.x, r.y + depth + 1 + dy, r.w, r.h, radius); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill();
  rr(ctx, r.x, r.y + depth + dy, r.w, r.h, radius); ctx.fillStyle = acc ? mix(bot, '#000000', 0.25) : dark ? mix(bot, '#000000', 0.45) : '#b9a67a'; ctx.fill();
  const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + r.h + dy);
  g.addColorStop(0, top); g.addColorStop(0.5, mid); g.addColorStop(1, bot);
  rr(ctx, r.x, r.y + dy, r.w, r.h, radius); ctx.fillStyle = g; ctx.fill();
  // top bevel (a thin bright line, not a gloss blob) and a brass rim on accent / active
  ctx.save(); rr(ctx, r.x, r.y + dy, r.w, r.h, radius); ctx.clip();
  ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,255,255,${acc ? 0.6 : dark ? 0.28 : 0.8})`;
  ctx.beginPath(); ctx.moveTo(r.x + radius * 0.7, r.y + dy + 1.4); ctx.lineTo(r.x + r.w - radius * 0.7, r.y + dy + 1.4); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.moveTo(r.x + radius * 0.7, r.y + dy + r.h - 1.4); ctx.lineTo(r.x + r.w - radius * 0.7, r.y + dy + r.h - 1.4); ctx.stroke();
  ctx.restore();
  rr(ctx, r.x + 0.75, r.y + dy + 0.75, r.w - 1.5, r.h - 1.5, radius);
  if (acc || active) { ctx.lineWidth = acc ? 2.5 : 3; ctx.strokeStyle = brassGrad(ctx, { x: r.x, y: r.y + dy, w: r.w, h: r.h }); }
  else { ctx.lineWidth = 1.5; ctx.strokeStyle = dark ? 'rgba(255,230,170,0.30)' : 'rgba(120,90,40,0.45)'; }
  ctx.stroke();
  ctx.restore();
  return dy;
}
// A carved plaque (info panel / card): dark slate or parchment with a thin brass edge and a soft shadow.
export function plaque(ctx, r, { radius = 22, fill = null, edge = true } = {}) {
  const dark = T.dark;
  ctx.save();
  rr(ctx, r.x, r.y + 4, r.w, r.h, radius); ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  if (fill) { g.addColorStop(0, fill); g.addColorStop(1, fill); }
  else if (dark) { g.addColorStop(0, rgba(mix(T.wall, '#ffffff', 0.12), 0.84)); g.addColorStop(1, rgba(mix(T.wall, '#000000', 0.2), 0.88)); }
  else { g.addColorStop(0, 'rgba(255,250,236,0.93)'); g.addColorStop(1, 'rgba(238,224,190,0.93)'); }
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = g; ctx.fill();
  if (edge) {
    rr(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, radius); ctx.lineWidth = 2; ctx.strokeStyle = brassGrad(ctx, r); ctx.globalAlpha = 0.75; ctx.stroke(); ctx.globalAlpha = 1;
    rr(ctx, r.x + 5, r.y + 5, r.w - 10, r.h - 10, Math.max(4, radius - 5)); ctx.lineWidth = 1; ctx.strokeStyle = dark ? 'rgba(255,255,255,0.10)' : 'rgba(80,50,10,0.16)'; ctx.stroke();
  }
  ctx.restore();
}
// Big embossed title lettering: brass gradient face, dark carved outline, light edge, drop shadow, a slow glint.
export function emboss(ctx, text, x, y, size, { weight = 800, t = 0, maxW = 0, align = 'center', face = [BRASS0, BRASS1, BRASS2], glint = true } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${UI}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (maxW) { let w = ctx.measureText(text).width; while (w > maxW && size > 12) { size -= 1; ctx.font = `${weight} ${size}px ${UI}`; w = ctx.measureText(text).width; } }
  const w = ctx.measureText(text).width, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  // shadow on the scene
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = size * 0.18; ctx.shadowOffsetY = size * 0.07;
  ctx.lineWidth = size * 0.2; ctx.strokeStyle = '#2a1608'; ctx.strokeText(text, x, y);
  ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.lineWidth = size * 0.1; ctx.strokeStyle = '#7a4a12'; ctx.strokeText(text, x, y);
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, face[0]); g.addColorStop(0.42, face[1]); g.addColorStop(0.58, face[1]); g.addColorStop(1, face[2]);
  ctx.fillStyle = g; ctx.fillText(text, x, y);
  // lit top edge
  ctx.save(); ctx.beginPath(); ctx.rect(x0 - 4, y - size * 0.6, w + 8, size * 0.46); ctx.clip();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.strokeText(text, x, y - size * 0.02); ctx.restore();
  if (glint) {   // a narrow bright band sweeps across every few seconds, clipped to the letters
    const ph = (t * 0.22) % 1.9 - 0.45, gx = x0 + (w + size) * ph - size * 0.3;
    if (ph > -0.3 && ph < 1.3) {
      const lg = ctx.createLinearGradient(gx - size * 0.25, 0, gx + size * 0.25, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.85)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg; ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}

// Flat, clean button (no gloss). kind: 'solid' | 'accent' | 'ghost'. active = toggled on.
export function button(ctx, r, label, { kind = 'solid', active = false, disabled = false, size = 30, weight = 600, sub = '', icon = '', flash = 0, radius = 18, align = 'center' } = {}) {
  const accent = kind === 'accent';
  ctx.save();
  let dy = 0;
  if (v3.on) dy = lacquer(ctx, r, { radius, kind: accent ? 'accent' : 'solid', active, down: Math.min(1, flash * 1.6), disabled });
  else {
    if (disabled) ctx.globalAlpha = 0.4;
    rr(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fillStyle = accent ? T.accent : active ? rgba(T.accent.length === 7 ? T.accent : '#ff9459', 0.22) : kind === 'ghost' ? 'rgba(0,0,0,0)' : T.btn;
    ctx.fill();
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.28 * flash})`; ctx.fill(); }
    ctx.lineWidth = active ? 2.5 : 1.5; ctx.strokeStyle = active ? T.accent : accent ? 'rgba(0,0,0,0)' : T.line; ctx.stroke();
  }
  if (v3.on) { ctx.translate(0, dy); if (disabled) ctx.globalAlpha = 0.5; }
  const col = accent ? T.onAccent : T.text, fs = F(size);
  const pad = Math.min(24, r.w * 0.08), hasIcon = !!icon, isz = Math.min(r.h * 0.5, fs * 1.4);
  if (hasIcon && label) {
    const tw = Math.min(txtW(ctx, label, fs, weight), r.w - pad * 2 - isz - 12), total = isz + 12 + tw, x0 = r.x + r.w / 2 - total / 2;
    icons[icon]?.(ctx, x0 + isz / 2, r.y + r.h / 2, isz, col);
    txt(ctx, label, x0 + isz + 12, r.y + r.h / 2 + (sub ? -fs * 0.3 : 0), { size: fs, weight, color: col, align: 'left', maxW: tw + 2, min: 12 });
  } else if (hasIcon) icons[icon]?.(ctx, r.x + r.w / 2, r.y + r.h / 2, isz, col);
  else if (label) txt(ctx, label, align === 'center' ? r.x + r.w / 2 : r.x + pad, r.y + r.h / 2 + (sub ? -fs * 0.34 : 0), { size: fs, weight, color: col, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2, min: 12 });
  if (sub) txt(ctx, sub, align === 'center' ? r.x + r.w / 2 : r.x + pad, r.y + r.h / 2 + fs * 0.62, { size: F(Math.max(18, size * 0.62)), weight: 400, color: accent ? T.onAccent : T.dim, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2, min: 11 });
  ctx.restore();
}
function txtW(ctx, s, size, weight) { setFont(ctx, size, weight); return ctx.measureText(s).width; }

// ---- tiles: soft raised slabs --------------------------------------------------------------------------------------------
// (x, y, s) is the slab's box. `lift` 0..1 raises it (selected / celebrating). Returns the face rect for content.
export function tile(ctx, x, y, s, face, side, lift = 0, { shadow = true, flat = false } = {}, h = s) {
  const m = Math.min(s, h), r = m * 0.17, d = flat ? m * 0.03 : m * 0.075 + lift * m * 0.03, up = lift * m * 0.05;
  if (shadow && !flat) {
    rr(ctx, x - m * 0.01, y + d + m * 0.035 - up * 0.2, s + m * 0.02, h - d + m * 0.02, r + 2); ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fill();
    rr(ctx, x + m * 0.01, y + d + m * 0.012, s - m * 0.02, h - d, r); ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.fill();
  }
  const fh = h - d;
  rr(ctx, x, y + d - up, s, fh, r); ctx.fillStyle = side; ctx.fill();
  const fy = y - up;
  const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
  g.addColorStop(0, mix(face, '#ffffff', 0.34)); g.addColorStop(0.45, face); g.addColorStop(1, mix(face, '#000000', 0.07));
  rr(ctx, x, fy, s, fh, r); ctx.fillStyle = g; ctx.fill();
  if (!flat) {
    ctx.beginPath(); ctx.moveTo(x + r * 0.9, fy + 1.2); ctx.lineTo(x + s - r * 0.9, fy + 1.2);
    ctx.lineWidth = Math.max(1.2, m * 0.028); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.62)'; ctx.stroke();
  }
  return { x, y: fy, w: s, h: fh };
}

// ---- icons (stroke paths, centred on cx, cy, within `s`) -----------------------------------------------------------------------
const stroke = (ctx, s, col, f) => { ctx.save(); ctx.lineWidth = Math.max(2, s * 0.11); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.beginPath(); f(); ctx.restore(); };
export const icons = {
  undo(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy + s * 0.04, s * 0.3, Math.PI * 1.1, Math.PI * 2.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.36, cy - s * 0.22); ctx.lineTo(cx - s * 0.3, cy + s * 0.02); ctx.lineTo(cx - s * 0.06, cy - s * 0.08); ctx.stroke(); }); },
  redo(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy + s * 0.04, s * 0.3, Math.PI * 0.9, Math.PI * -0.1, true); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.36, cy - s * 0.22); ctx.lineTo(cx + s * 0.3, cy + s * 0.02); ctx.lineTo(cx + s * 0.06, cy - s * 0.08); ctx.stroke(); }); },
  erase(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.1, cy + s * 0.3); ctx.lineTo(cx - s * 0.38, cy + s * 0.02); ctx.lineTo(cx - s * 0.04, cy - s * 0.32); ctx.lineTo(cx + s * 0.34, cy + s * 0.04); ctx.lineTo(cx + s * 0.08, cy + s * 0.3); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.28, cy + s * 0.12); ctx.lineTo(cx + s * 0.14, cy - s * 0.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.1, cy + s * 0.34); ctx.lineTo(cx + s * 0.38, cy + s * 0.34); ctx.stroke(); }); },
  pencil(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.32, cy + s * 0.34); ctx.lineTo(cx - s * 0.26, cy + s * 0.1); ctx.lineTo(cx + s * 0.16, cy - s * 0.32); ctx.lineTo(cx + s * 0.36, cy - s * 0.12); ctx.lineTo(cx - s * 0.06, cy + s * 0.3); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.06, cy - s * 0.22); ctx.lineTo(cx + s * 0.26, cy - s * 0.02); ctx.stroke(); }); },
  bulb(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy - s * 0.1, s * 0.28, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.14, cy + s * 0.26); ctx.lineTo(cx + s * 0.14, cy + s * 0.26); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.1, cy + s * 0.38); ctx.lineTo(cx + s * 0.1, cy + s * 0.38); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy + s * 0.12); ctx.lineTo(cx - s * 0.12, cy + s * 0.26); ctx.moveTo(cx + s * 0.2, cy + s * 0.12); ctx.lineTo(cx + s * 0.12, cy + s * 0.26); ctx.stroke(); }); },
  fill(ctx, cx, cy, s, col) { ctx.save(); ctx.fillStyle = col; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(cx + (j - 1) * s * 0.26, cy + (i - 1) * s * 0.26, s * 0.075, 0, 7); ctx.fill(); } ctx.restore(); },
  pause(ctx, cx, cy, s, col) { ctx.save(); ctx.fillStyle = col; rr(ctx, cx - s * 0.26, cy - s * 0.3, s * 0.17, s * 0.6, s * 0.05); ctx.fill(); rr(ctx, cx + s * 0.09, cy - s * 0.3, s * 0.17, s * 0.6, s * 0.05); ctx.fill(); ctx.restore(); },
  play(ctx, cx, cy, s, col) { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy - s * 0.3); ctx.lineTo(cx + s * 0.32, cy); ctx.lineTo(cx - s * 0.2, cy + s * 0.3); ctx.closePath(); ctx.fill(); ctx.restore(); },
  exit(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.26, cy - s * 0.26); ctx.lineTo(cx + s * 0.26, cy + s * 0.26); ctx.moveTo(cx + s * 0.26, cy - s * 0.26); ctx.lineTo(cx - s * 0.26, cy + s * 0.26); ctx.stroke(); }); },
  minus(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.28, cy); ctx.lineTo(cx + s * 0.28, cy); ctx.stroke(); }); },
  plus(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.28, cy); ctx.lineTo(cx + s * 0.28, cy); ctx.moveTo(cx, cy - s * 0.28); ctx.lineTo(cx, cy + s * 0.28); ctx.stroke(); }); },
  back(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx + s * 0.14, cy - s * 0.3); ctx.lineTo(cx - s * 0.16, cy); ctx.lineTo(cx + s * 0.14, cy + s * 0.3); ctx.stroke(); }); },
  next(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.14, cy - s * 0.3); ctx.lineTo(cx + s * 0.16, cy); ctx.lineTo(cx - s * 0.14, cy + s * 0.3); ctx.stroke(); }); },
  check(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.3, cy + s * 0.02); ctx.lineTo(cx - s * 0.08, cy + s * 0.24); ctx.lineTo(cx + s * 0.32, cy - s * 0.22); ctx.stroke(); }); },
  gear(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.moveTo(cx + Math.cos(a) * s * 0.26, cy + Math.sin(a) * s * 0.26); ctx.lineTo(cx + Math.cos(a) * s * 0.38, cy + Math.sin(a) * s * 0.38); } ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.24, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.09, 0, 7); ctx.stroke(); }); },
  star(ctx, cx, cy, s, col) { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? s * 0.18 : s * 0.4; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.98 + s * 0.02); } ctx.closePath(); ctx.fill(); ctx.restore(); },
  flame(ctx, cx, cy, s, col) { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.4); ctx.bezierCurveTo(cx + s * 0.1, cy - s * 0.15, cx + s * 0.36, cy - s * 0.05, cx + s * 0.26, cy + s * 0.22); ctx.bezierCurveTo(cx + s * 0.2, cy + s * 0.4, cx - s * 0.2, cy + s * 0.4, cx - s * 0.26, cy + s * 0.2); ctx.bezierCurveTo(cx - s * 0.32, cy, cx - s * 0.1, cy - s * 0.1, cx, cy - s * 0.4); ctx.fill(); ctx.restore(); },
  eye(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.4, cy); ctx.quadraticCurveTo(cx, cy - s * 0.4, cx + s * 0.4, cy); ctx.quadraticCurveTo(cx, cy + s * 0.4, cx - s * 0.4, cy); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.1, 0, 7); ctx.fill(); }); },
};
export const clampN = clamp;

// Extra icons for this game.
icons.turn = (ctx, cx, cy, s, col) => stroke(ctx, s, col, () => {
  ctx.arc(cx, cy, s * 0.3, Math.PI * 0.15, Math.PI * 1.55); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - s * 0.02, cy - s * 0.46); ctx.lineTo(cx + s * 0.12, cy - s * 0.3); ctx.lineTo(cx - s * 0.08, cy - s * 0.18); ctx.stroke();
});
icons.mats = (ctx, cx, cy, s, col) => stroke(ctx, s, col, () => {
  ctx.roundRect(cx - s * 0.38, cy - s * 0.26, s * 0.76, s * 0.52, s * 0.06); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.26); ctx.lineTo(cx, cy + s * 0.26); ctx.stroke();
});
icons.home = (ctx, cx, cy, s, col) => stroke(ctx, s, col, () => {
  ctx.moveTo(cx - s * 0.36, cy + s * 0.02); ctx.lineTo(cx, cy - s * 0.34); ctx.lineTo(cx + s * 0.36, cy + s * 0.02); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - s * 0.26, cy - s * 0.04); ctx.lineTo(cx - s * 0.26, cy + s * 0.32); ctx.lineTo(cx + s * 0.26, cy + s * 0.32); ctx.lineTo(cx + s * 0.26, cy - s * 0.04); ctx.stroke();
});
