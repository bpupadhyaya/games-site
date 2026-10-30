// Drawing kit: looks (palettes), text helpers, flat buttons, tiles with soft depth, icons.
import { host } from './layout.js';
import { mode3d } from './mode3d.js';

export const UI = 'Fredoka, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const NUM = '"Barlow Condensed", "Arial Narrow", Impact, sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- theme ------------------------------------------------------------------------------------------------------------
export const LOOKS = {
  highland: { name: 'Highland', dark: true, bg0: '#1c2b4d', bg1: '#0b1426', glow: 'rgba(255,196,120,0.14)', shell: 'rgba(255,230,190,0.05)', panel: 'rgba(255,255,255,0.07)', line: 'rgba(255,238,210,0.18)', text: '#fbf1dc', dim: 'rgba(251,241,220,0.68)', accent: '#f6b73c', onAccent: '#2a1706', good: '#7be0a8', err: '#ff7a5c', sel: '#ffd36b', btn: 'rgba(255,255,255,0.1)' },
};
export const LOOK_IDS = Object.keys(LOOKS);
let T = LOOKS.highland;
export const setLook = (id) => { T = LOOKS[id] ?? LOOKS.highland; };
export const theme = () => T;

// ---- colour helpers ---------------------------------------------------------------------------------------------------
const hexRgb = (h) => (h[0] === 'r' ? h.slice(h.indexOf('(') + 1, h.indexOf(')')).split(',').slice(0, 3).map(Number) : [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const mixCache = new Map();
export function mix(a, b, t) {
  const key = a + b + t, hit = mixCache.get(key);
  if (hit) return hit;
  if (mixCache.size > 1500) mixCache.clear();
  const x = hexRgb(a), y = hexRgb(b);
  const out = `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
  mixCache.set(key, out);
  return out;
}
export const rgba = (hex, a) => { const c = hexRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

// ---- text ----------------------------------------------------------------------------------------------------------------
export const F = (n) => Math.max(n, 12 / (host.px || 0.55));   // never below ~12 css px
export const setFont = (ctx, size, weight = 500, fam = UI) => { ctx.font = `${weight} ${size}px ${fam}`; };
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
export function txt(ctx, s, x, y, { size = 28, weight = 500, color = T.text, align = 'left', base = 'middle', maxW = 0, min = 0, fam = UI } = {}) {
  s = String(s);
  setFont(ctx, size, weight, fam);
  if (maxW) {
    const floor = Math.max(min || 10, 11.5 / (host.px || 0.55));   // never shrink below ~11.5 css px: cut with an ellipsis instead
    let w = ctx.measureText(s).width;
    while (w > maxW && size > floor) { size -= 1; setFont(ctx, size, weight, fam); w = ctx.measureText(s).width; }
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
  const solid = /rgba?\(1[0-9],\s*2[0-9]/.test(fill);
  plaque(ctx, r, { radius, tint: solid ? 'rgba(40,27,17,0.96)' : (mode3d.on ? 'rgba(40,27,17,0.72)' : 'rgba(255,255,255,0.07)'), edge: line && line !== T.line ? line : 'rgba(226,184,110,0.5)', shadow: solid });
}
export function background(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (mode3d.on) { g.addColorStop(0, 'rgba(10,18,40,0.78)'); g.addColorStop(1, 'rgba(6,10,24,0.9)'); }   // the live hillside shows faintly behind
  else { g.addColorStop(0, T.bg0); g.addColorStop(1, T.bg1); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

// Carved plaque: dark slate with a brass edge, an inner shadow and a soft drop shadow (the HUD's panels and bars).
export function plaque(ctx, r, { radius = 16, tint = 'rgba(46,30,18,0.9)', edge = 'rgba(226,184,110,0.8)', shadow = true } = {}) {
  ctx.save();
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; }
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = tint; ctx.fill();
  ctx.restore();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(255,214,150,0.16)'); g.addColorStop(0.4, 'rgba(120,70,30,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.34)');
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = g; ctx.fill();
  // wood grain
  if (r.h > 24) {
    ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.clip(); ctx.globalAlpha = 0.16; ctx.strokeStyle = '#d9a866'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const gy = r.y + r.h * (0.2 + i * 0.2); ctx.beginPath(); ctx.moveTo(r.x, gy); ctx.bezierCurveTo(r.x + r.w * 0.3, gy - 3, r.x + r.w * 0.65, gy + 4, r.x + r.w, gy - 1); ctx.stroke(); }
    ctx.restore();
  }
  // brass rim (double line: bright outer, dark inner groove)
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.lineWidth = 2.4; ctx.strokeStyle = edge; ctx.stroke();
  rr(ctx, r.x + 1.2, r.y + 1.2, r.w - 2.4, r.h - 2.4, Math.max(2, radius - 1.2)); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,240,200,0.28)'; ctx.stroke();
  rr(ctx, r.x + 3.5, r.y + 3.5, r.w - 7, r.h - 7, Math.max(2, radius - 3.5)); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
  // brass rivets on larger plaques
  if (r.h > 40 && r.w > 120) { ctx.fillStyle = '#e8c36c'; for (const [ox, oy] of [[10, 10], [r.w - 10, 10], [10, r.h - 10], [r.w - 10, r.h - 10]]) { ctx.beginPath(); ctx.arc(r.x + ox, r.y + oy, 2.6, 0, Math.PI * 2); ctx.fill(); } }
}

// Button as a carved wooden plaque with a brass rim and depth; pressed = a quick sink. kind: 'solid' | 'accent' (brass) | 'ghost'.
export function button(ctx, r, label, { kind = 'solid', active = false, disabled = false, size = 30, weight = 600, sub = '', icon = '', flash = 0, radius = 18, align = 'center' } = {}) {
  const accent = kind === 'accent';
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.42;
  const sink = flash > 0 ? 3 * flash : 0, y0 = r.y + sink, hh = r.h - sink * 0.5, rad = Math.min(radius, r.h / 2);
  // body shadow (the plaque stands off the scene)
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = flash > 0 ? 4 : 12; ctx.shadowOffsetY = flash > 0 ? 1 : 5;
  rr(ctx, r.x, y0, r.w, hh, rad);
  const g = ctx.createLinearGradient(0, y0, 0, y0 + hh);
  if (accent) { g.addColorStop(0, '#ffd978'); g.addColorStop(0.5, '#f1ae35'); g.addColorStop(1, '#c47c16'); }
  else if (active) { g.addColorStop(0, '#6a4a22'); g.addColorStop(1, '#3e2a12'); }
  else { g.addColorStop(0, 'rgba(58,44,30,0.94)'); g.addColorStop(1, 'rgba(30,22,14,0.96)'); }
  ctx.fillStyle = kind === 'ghost' && !active ? 'rgba(20,16,12,0.5)' : g; ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0)';
  // wood grain
  ctx.save(); rr(ctx, r.x, y0, r.w, hh, rad); ctx.clip();
  ctx.globalAlpha *= accent ? 0.16 : 0.22; ctx.strokeStyle = accent ? '#7a4a08' : '#c9a066'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) { const gy = y0 + hh * (0.18 + i * 0.17); ctx.beginPath(); ctx.moveTo(r.x, gy); ctx.bezierCurveTo(r.x + r.w * 0.3, gy - 3, r.x + r.w * 0.6, gy + 4, r.x + r.w, gy - 1); ctx.stroke(); }
  ctx.restore();
  // lit top edge and brass rim
  rr(ctx, r.x + 1, y0 + 1, r.w - 2, hh - 2, rad - 1); ctx.lineWidth = 1.5; ctx.strokeStyle = accent ? 'rgba(255,248,214,0.7)' : 'rgba(255,230,180,0.2)'; ctx.stroke();
  rr(ctx, r.x, y0, r.w, hh, rad); ctx.lineWidth = active ? 2.4 : 1.8; ctx.strokeStyle = accent ? '#8a5410' : active ? '#f3c25a' : 'rgba(214,170,96,0.75)'; ctx.stroke();
  if (flash > 0) { rr(ctx, r.x, y0, r.w, hh, rad); ctx.fillStyle = `rgba(255,240,200,${0.3 * flash})`; ctx.fill(); }
  const col = accent ? '#2a1706' : T.text, fs = F(size);
  const pad = Math.min(24, r.w * 0.08), hasIcon = !!icon, isz = Math.min(r.h * 0.5, fs * 1.4), ty = y0 + hh / 2;
  if (hasIcon && label) {
    const tw = Math.min(txtW(ctx, label, fs, weight), r.w - pad * 2 - isz - 12), total = isz + 12 + tw, x0 = r.x + r.w / 2 - total / 2;
    icons[icon]?.(ctx, x0 + isz / 2, ty, isz, col);
    txt(ctx, label, x0 + isz + 12, ty + (sub ? -fs * 0.3 : 0), { size: fs, weight, color: col, align: 'left', maxW: tw + 2, min: 12 });
  } else if (hasIcon) icons[icon]?.(ctx, r.x + r.w / 2, ty, isz, col);
  else if (label) txt(ctx, label, align === 'center' ? r.x + r.w / 2 : r.x + pad, ty + (sub ? -fs * 0.34 : 0), { size: fs, weight, color: col, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2, min: 12 });
  if (sub) txt(ctx, sub, align === 'center' ? r.x + r.w / 2 : r.x + pad, ty + fs * 0.62, { size: F(Math.max(18, size * 0.62)), weight: 400, color: accent ? '#4a2c0a' : T.dim, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2 });
  ctx.restore();
}
function txtW(ctx, s, size, weight) { setFont(ctx, size, weight); return ctx.measureText(s).width; }

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
icons.pour = (ctx, cx, cy, s, col) => stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.34, cy - s * 0.3); ctx.lineTo(cx + s * 0.1, cy - s * 0.3); ctx.lineTo(cx + s * 0.1, cy - s * 0.02); ctx.lineTo(cx - s * 0.34, cy - s * 0.02); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.12, cy + s * 0.1); ctx.lineTo(cx - s * 0.12, cy + s * 0.38); ctx.moveTo(cx - s * 0.26, cy + s * 0.2); ctx.lineTo(cx - s * 0.26, cy + s * 0.38); ctx.moveTo(cx + s * 0.02, cy + s * 0.2); ctx.lineTo(cx + s * 0.02, cy + s * 0.38); ctx.stroke(); });
icons.clear = icons.erase;
export const clampN = clamp;
