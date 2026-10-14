// Drawing kit: looks (palettes), text helpers, flat buttons, tiles with soft depth, icons.
import { host } from './layout.js';

export const UI = 'Fredoka, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const NUM = 'Cinzel, Georgia, "Times New Roman", serif';
export const CJK = '"PingFang SC", "Hiragino Sans GB", "Noto Serif CJK SC", "Noto Sans CJK SC", "Microsoft YaHei", "Songti SC", serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- looks ----------------------------------------------------------------------------------------------------------
export const LOOKS = {
  lantern: { name: 'Lantern', dark: true, bg0: '#2a1a3a', bg1: '#0d0818', glow: 'rgba(255,170,90,0.16)', shell: 'rgba(255,200,140,0.05)', panel: 'rgba(255,240,220,0.075)', line: 'rgba(255,230,200,0.17)', text: '#fbeed6', dim: 'rgba(251,238,214,0.68)', wood: '#6b4426', woodHi: '#9a6b3c', woodLo: '#3a2312', rim: '#e8c070', accent: '#f4b942', onAccent: '#2a1604', good: '#7fe0a8', err: '#ff7058', sel: '#ffd36b', btn: 'rgba(255,255,255,0.09)' },
  paper: { name: 'Paper', dark: false, bg0: '#f6ead0', bg1: '#e0cba2', glow: 'rgba(255,255,255,0.55)', shell: 'rgba(120,90,40,0.06)', panel: 'rgba(80,50,15,0.07)', line: 'rgba(80,50,15,0.22)', text: '#2e2116', dim: 'rgba(46,33,22,0.66)', wood: '#8a5a33', woodHi: '#b88450', woodLo: '#5a3720', rim: '#a9803a', accent: '#c0392b', onAccent: '#ffffff', good: '#1d8f62', err: '#c4281a', sel: '#d98a00', btn: 'rgba(80,50,15,0.08)' },
  indigo: { name: 'Indigo', dark: true, bg0: '#1b2a5a', bg1: '#080d24', glow: 'rgba(120,170,255,0.16)', shell: 'rgba(150,190,255,0.05)', panel: 'rgba(255,255,255,0.07)', line: 'rgba(200,220,255,0.18)', text: '#eef3ff', dim: 'rgba(238,243,255,0.68)', wood: '#5b4a3a', woodHi: '#8a7258', woodLo: '#2f2519', rim: '#9fc0ff', accent: '#ff8a5c', onAccent: '#2a1204', good: '#6fe0b0', err: '#ff6b6b', sel: '#ffe08a', btn: 'rgba(255,255,255,0.09)' },
};
export const LOOK_IDS = Object.keys(LOOKS);
let T = LOOKS.lantern;
export const setLook = (id) => { T = LOOKS[id] ?? LOOKS.lantern; };
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
// A plaque: carved wood (dark looks) or cream paper (the Paper look) with a thin gold edge, a lit top rim and a soft drop shadow.
export function panel(ctx, r, { radius = 22, fill = null, line = T.line } = {}) {
  const dflt = fill === null;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.38)'; ctx.shadowBlur = Math.min(18, r.h * 0.2); ctx.shadowOffsetY = Math.min(6, r.h * 0.07);
  rr(ctx, r.x, r.y, r.w, r.h, radius);
  if (dflt) {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (T.dark) { g.addColorStop(0, 'rgba(58,38,26,0.92)'); g.addColorStop(1, 'rgba(26,16,12,0.94)'); } else { g.addColorStop(0, 'rgba(250,238,208,0.95)'); g.addColorStop(1, 'rgba(228,206,160,0.95)'); }
    ctx.fillStyle = g;
  } else ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  if (line) {
    rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.lineWidth = 1.6; ctx.strokeStyle = T.dark ? rgba(T.rim, 0.5) : 'rgba(120,80,30,0.55)'; ctx.stroke();
    rr(ctx, r.x + 2.5, r.y + 2.5, r.w - 5, r.h - 5, Math.max(2, radius - 2.5)); ctx.lineWidth = 1; ctx.strokeStyle = T.dark ? 'rgba(255,230,190,0.10)' : 'rgba(255,255,255,0.6)'; ctx.stroke();
  }
}
export function background(ctx, w, h, t = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, T.bg0); g.addColorStop(1, T.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = Math.max(w, h) * 0.7, gx = w * (0.3 + 0.05 * Math.sin(t * 0.15)), gy = h * 0.18;
  const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
  rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  // faint woodgrain bands, like the planks of a street stage
  ctx.fillStyle = T.shell;
  for (let y = 0; y < h; y += 46) ctx.fillRect(0, y, w, 2);
}

// Lacquered button with a visible side (depth) and a pressed state (it sinks). kind: 'solid' | 'accent' | 'ghost'. active = toggled on.
export function button(ctx, r, label, { kind = 'solid', active = false, disabled = false, size = 30, weight = 600, sub = '', icon = '', flash = 0, radius = 18, align = 'center' } = {}) {
  const accent = kind === 'accent', ghost = kind === 'ghost';
  const depth = Math.min(6, Math.max(3, r.h * 0.07)), press = flash > 0 ? Math.min(depth - 1, depth * flash + 1) : 0;
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.42;
  const y = r.y + press, h = r.h - depth;
  if (!ghost) {
    // the side of the button (what makes it stand off the surface)
    rr(ctx, r.x, r.y + depth, r.w, h, radius);
    ctx.fillStyle = accent ? '#8a5410' : T.dark ? '#120a07' : '#9a7a44';
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = press ? 0 : 10; ctx.shadowOffsetY = press ? 0 : 5; ctx.fill(); ctx.shadowColor = 'transparent';
  }
  rr(ctx, r.x, y, r.w, h, radius);
  if (ghost) ctx.fillStyle = 'rgba(0,0,0,0)';
  else {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (accent) { g.addColorStop(0, '#ffe08a'); g.addColorStop(0.5, '#f4b942'); g.addColorStop(1, '#e0912a'); }
    else if (active) { g.addColorStop(0, 'rgba(255,190,90,0.55)'); g.addColorStop(1, 'rgba(214,128,40,0.5)'); }
    else if (T.dark) { g.addColorStop(0, 'rgba(118,80,48,0.97)'); g.addColorStop(0.55, 'rgba(78,50,30,0.98)'); g.addColorStop(1, 'rgba(52,32,19,0.99)'); }
    else { g.addColorStop(0, '#fff6dc'); g.addColorStop(1, '#ead3a4'); }
    ctx.fillStyle = g;
  }
  ctx.fill();
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.26 * flash})`; ctx.fill(); }
  if (!ghost) {
    ctx.lineWidth = active ? 2.5 : 1.4; ctx.strokeStyle = active ? T.accent : accent ? 'rgba(120,70,10,0.8)' : T.dark ? rgba(T.rim, 0.55) : 'rgba(120,80,30,0.6)'; ctx.stroke();
    // lit top rim
    rr(ctx, r.x + 2, y + 2, r.w - 4, h - 4, Math.max(2, radius - 2)); ctx.lineWidth = 1.2; ctx.strokeStyle = accent ? 'rgba(255,255,255,0.55)' : 'rgba(255,235,200,0.18)'; ctx.save(); ctx.clip(); ctx.beginPath(); ctx.rect(r.x, y, r.w, h * 0.45); ctx.clip(); rr(ctx, r.x + 2, y + 2, r.w - 4, h - 4, Math.max(2, radius - 2)); ctx.stroke(); ctx.restore();
  } else { ctx.lineWidth = 1.4; ctx.strokeStyle = T.line; ctx.stroke(); }
  const col = accent ? T.onAccent : T.text, fs = F(size), cy = y + h / 2;
  const pad = Math.min(24, r.w * 0.08), hasIcon = !!icon, isz = Math.min(h * 0.5, fs * 1.4);
  if (hasIcon && label) {
    const tw = Math.min(txtW(ctx, label, fs, weight), r.w - pad * 2 - isz - 12), total = isz + 12 + tw, x0 = r.x + r.w / 2 - total / 2;
    icons[icon]?.(ctx, x0 + isz / 2, cy, isz, col);
    txt(ctx, label, x0 + isz + 12, cy + (sub ? -fs * 0.3 : 0), { size: fs, weight, color: col, align: 'left', maxW: tw + 2, min: 12 });
  } else if (hasIcon) icons[icon]?.(ctx, r.x + r.w / 2, cy, isz, col);
  else if (label) txt(ctx, label, align === 'center' ? r.x + r.w / 2 : r.x + pad, cy + (sub ? -fs * 0.34 : 0), { size: fs, weight, color: col, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2, min: 12 });
  if (sub) txt(ctx, sub, align === 'center' ? r.x + r.w / 2 : r.x + pad, cy + fs * 0.62, { size: F(Math.max(18, size * 0.62)), weight: 400, color: accent ? T.onAccent : T.dim, align: align === 'center' ? 'center' : 'left', maxW: r.w - pad * 2, min: 11 });
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
  flip(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.arc(cx, cy, s * 0.3, Math.PI * 0.2, Math.PI * 1.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.36, cy - s * 0.1); ctx.lineTo(cx - s * 0.3, cy - s * 0.36); ctx.lineTo(cx - s * 0.06, cy - s * 0.24); ctx.stroke(); }); },
  swap(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.32, cy - s * 0.12); ctx.lineTo(cx + s * 0.3, cy - s * 0.12); ctx.lineTo(cx + s * 0.14, cy - s * 0.28); ctx.moveTo(cx + s * 0.32, cy + s * 0.14); ctx.lineTo(cx - s * 0.3, cy + s * 0.14); ctx.lineTo(cx - s * 0.14, cy + s * 0.3); ctx.stroke(); }); },
  eye(ctx, cx, cy, s, col) { stroke(ctx, s, col, () => { ctx.moveTo(cx - s * 0.4, cy); ctx.quadraticCurveTo(cx, cy - s * 0.4, cx + s * 0.4, cy); ctx.quadraticCurveTo(cx, cy + s * 0.4, cx - s * 0.4, cy); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.1, 0, 7); ctx.fill(); }); },
};
export const clampN = clamp;
