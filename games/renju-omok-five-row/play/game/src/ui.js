// Small drawing toolkit shared by every screen: text that fits, wrapped paragraphs, flat buttons, panels, and the hit registry.
// The game is "immediate mode": each frame the view draws buttons and registers their rectangles in `ui.hits`; the next update()
// tests taps against that list. So a button can never be drawn in one place and tested in another.
import { host } from './layout.js';

export const DISPLAY = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
export const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const COL = { ink: '#0d141a', panel: 'rgba(14,22,29,0.84)', panel2: 'rgba(24,36,46,0.92)', edge: 'rgba(160,190,210,0.22)', text: '#efe6d2', dim: 'rgba(239,230,210,0.66)', gold: '#e8c56b', red: '#e0554a', teal: '#43c6b6', blue: '#6aa7e8' };
export const TAU = Math.PI * 2;

export const ui = { hits: [], scrolls: [], scene: '', key: '', cursor: null, fits: 0, shift: 0, clip: null };
export function beginFrame(scene, key) { ui.hits.length = 0; ui.scrolls.length = 0; ui.scene = scene; ui.key = key; }
export const addHit = (id, r, extra) => {
  let q = r;
  if (ui.shift) q = { x: r.x, y: r.y - ui.shift, w: r.w, h: r.h };
  if (ui.clip) {                                         // inside a scrolling zone: keep only the visible part
    const c = ui.clip, y0 = Math.max(q.y, c.y), y1 = Math.min(q.y + q.h, c.y + c.h);
    if (y1 - y0 < 8) return;
    q = { x: q.x, y: y0, w: q.w, h: y1 - y0 };
  }
  ui.hits.push({ id, r: q, ...extra });
};
export function hitAt(x, y) {
  for (let i = ui.hits.length - 1; i >= 0; i--) { const h = ui.hits[i], r = h.r; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return h; }
  return null;
}

export const minUnits = () => Math.max(11.5, 11 / Math.max(0.2, host.px || 0.6));    // smallest type that is still ~11 css px
export function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); }

// ---- text -------------------------------------------------------------------------------------------------------------------------
const memo = new Map(); let fontStamp = '';
export function checkFonts(ctx) {
  ctx.font = `700 40px ${DISPLAY}`; const a = ctx.measureText('Hamburgefonstiv').width;
  const k = String(Math.round(a));
  if (k !== fontStamp || memo.size > 400) { memo.clear(); fontStamp = k; }
}
const cached = (key, fn) => { let v = memo.get(key); if (v === undefined) { ui.fits++; v = fn(); memo.set(key, v); } return v; };
export function text(ctx, str, x, y, size, color = COL.text, o = {}) {
  const { weight = 600, font = SANS, align = 'center', maxW = 0, alpha = 1, min = minUnits() } = o;
  let s = size;
  if (maxW > 0) s = cached(`t|${str}|${size}|${maxW}|${font}|${weight}|${min}`, () => { let q = size; ctx.font = `${weight} ${q}px ${font}`; while (q > min && ctx.measureText(str).width > maxW) { q -= 1; ctx.font = `${weight} ${q}px ${font}`; } return q; });
  ctx.font = `${weight} ${s}px ${font}`; ctx.textAlign = align; ctx.fillStyle = color;
  if (alpha !== 1) { ctx.save(); ctx.globalAlpha *= alpha; ctx.fillText(str, x, y); ctx.restore(); } else ctx.fillText(str, x, y);
  return s;
}
export function wrap(ctx, str, size, maxW, weight = 500, font = SANS) {
  return cached(`w|${weight}|${size}|${maxW}|${font}|${str}`, () => {
    ctx.font = `${weight} ${size}px ${font}`;
    const out = []; let cur = '';
    for (const w of str.split(' ')) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur);
    return out;
  });
}
// paragraph; returns the y below it. draw=false only measures.
export function para(ctx, str, x, y, maxW, size, color, o = {}) {
  const { weight = 500, align = 'left', lh = 1.34, draw = true, font = SANS } = o;
  const lines = wrap(ctx, str, size, maxW, weight, font), step = size * lh;
  if (draw) { ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.fillStyle = color; lines.forEach((ln, i) => ctx.fillText(ln, x, y + size * 0.92 + i * step)); }
  return y + lines.length * step;
}
// the largest size <= size at which the wrapped text fits in maxW x maxH (min size minUnits)
export function fitPara(ctx, str, rect, size, color, o = {}) {
  const min = o.min ?? minUnits(); let s = size;
  const k = cached(`fp|${str}|${size}|${rect.w}|${rect.h}|${o.weight ?? 500}`, () => { let q = size; while (q > min) { const n = wrap(ctx, str, q, rect.w, o.weight ?? 500).length; if (n * q * (o.lh ?? 1.3) <= rect.h) break; q -= 1; } return q; });
  s = k; return para(ctx, str, rect.x, rect.y, rect.w, s, color, { lh: 1.3, ...o });
}

// ---- panels and buttons ------------------------------------------------------------------------------------------------------------
export function panel(ctx, r, { radius = 22, fill = COL.panel, edge = COL.edge, brand = false } = {}) {
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
  if (brand) {                                       // a brand-gradient hairline along the top edge of the panel
    const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0); g.addColorStop(0, 'rgba(150,96,250,0)'); g.addColorStop(0.3, 'rgba(150,96,250,0.55)'); g.addColorStop(0.6, 'rgba(70,132,252,0.55)'); g.addColorStop(1, 'rgba(24,198,252,0)');
    ctx.fillStyle = g; ctx.fillRect(r.x + radius * 0.6, r.y + 1, r.w - radius * 1.2, 2);
  }
  ctx.restore();
}
// flat button. kind: 'primary' | 'normal' | 'quiet' | 'danger'
export function button(ctx, r, label, id, { kind = 'normal', disabled = false, size = 0, active = false, sub = '', icon = null } = {}) {
  ctx.save();
  const fill = kind === 'primary' ? COL.gold : kind === 'danger' ? '#5a2623' : active ? '#27507a' : kind === 'quiet' ? 'rgba(20,30,40,0.6)' : '#1a2833';
  const fg = kind === 'primary' ? '#241a08' : COL.text;
  if (disabled) ctx.globalAlpha = 0.4;
  roundRect(ctx, r.x, r.y, r.w, r.h, Math.min(18, r.h * 0.3)); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = active ? 2.5 : 1.5; ctx.strokeStyle = kind === 'primary' ? 'rgba(255,255,255,0.35)' : active ? COL.blue : COL.edge; ctx.stroke();
  const fs = size || Math.min(32, Math.max(minUnits(), r.h * 0.38));
  if (icon) icon(ctx, r.x + r.h * 0.5, r.y + r.h / 2, r.h * 0.5, fg);
  const tx = icon ? r.x + r.h * 0.95 : r.x, tw = icon ? r.w - r.h * 0.95 - 8 : r.w - 16;
  if (sub) { text(ctx, label, tx + tw / 2 + (icon ? 0 : 8), r.y + r.h * 0.46, fs, fg, { weight: 700, maxW: tw }); text(ctx, sub, tx + tw / 2 + (icon ? 0 : 8), r.y + r.h * 0.8, Math.max(minUnits(), fs * 0.62), kind === 'primary' ? '#4b3a14' : COL.dim, { maxW: tw }); }
  else text(ctx, label, tx + tw / 2 + (icon ? 0 : 8), r.y + r.h / 2 + fs * 0.34, fs, fg, { weight: 700, maxW: tw });
  ctx.restore();
  if (!disabled && id) addHit(id, r);
}
// a row of mutually exclusive choices; ids are `${prefix}:${i}`
export function segmented(ctx, r, labels, sel, prefix, { sub = [] } = {}) {
  const gap = 8, w = (r.w - gap * (labels.length - 1)) / labels.length;
  labels.forEach((lb, i) => button(ctx, { x: r.x + i * (w + gap), y: r.y, w, h: r.h }, lb, `${prefix}:${i}`, { active: i === sel, sub: sub[i] ?? '' }));
}
// a scrolling viewport: clips, translates by the scroll position, registers the zone for drag/wheel, draws a scroll bar.
export function scrollZone(ctx, key, r, contentH, scroll, drawFn) {
  const max = Math.max(0, Math.ceil(contentH - r.h)), s = Math.max(0, Math.min(max, scroll || 0));
  ui.scrolls.push({ key, r, max });
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); ctx.translate(0, -s); ui.shift = s; ui.clip = r; drawFn(); ui.shift = 0; ui.clip = null; ctx.restore();
  if (max > 0) {
    const th = Math.max(36, r.h * (r.h / contentH)), ty = r.y + (r.h - th) * (s / max);
    ctx.fillStyle = 'rgba(239,230,210,0.12)'; roundRect(ctx, r.x + r.w - 9, r.y, 7, r.h, 3.5); ctx.fill();
    ctx.fillStyle = 'rgba(232,197,107,0.75)'; roundRect(ctx, r.x + r.w - 9, ty, 7, th, 3.5); ctx.fill();
  }
  return max;
}
export const toggleIcon = (on) => (ctx, cx, cy, r, fg) => { ctx.save(); ctx.strokeStyle = on ? COL.teal : COL.dim; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TAU); ctx.stroke(); if (on) { ctx.fillStyle = COL.teal; ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, TAU); ctx.fill(); } ctx.restore(); };
