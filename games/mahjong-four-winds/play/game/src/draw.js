// Shared drawing helpers: fonts, text, buttons, the felt table, tile placement. Nothing here changes game state.
import { W, H } from './layout.js';
import { tileSprite, backSprite, FW, FH, SPRITE_W, SPRITE_H, PAD, getLang } from './tiles.js';
import { kindOf } from './rules.js';

export const DISPLAY = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const CJKF = '"Noto Serif SC", "Songti SC", serif';
export const GOLD = '#f1cf7a', IVORY = '#f7efd6', INK = '#2a1a05';
export const TAU = Math.PI * 2;

export function tx(ctx, str, x, y, size, color = IVORY, o = {}) {
  const { font = UI, weight = 700, align = 'center', alpha = 1, shadow = false, base = 'alphabetic' } = o;
  ctx.save(); if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = base;
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(str, x + 1.5, y + 2.5); }
  ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.restore();
}
// Word-wrapped text. Returns the number of lines.
export function wrap(ctx, str, x, y, size, maxW, color = IVORY, o = {}) {
  const { lh = size * 1.32, align = 'center', weight = 600, font = UI, alpha = 1 } = o;
  ctx.save(); ctx.font = `${weight} ${size}px ${font}`;
  const words = String(str).split(' '), lines = []; let cur = '';
  for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
  lines.push(cur); ctx.restore();
  lines.forEach((ln, i) => tx(ctx, ln, x, y + i * lh, size, color, { align, weight, font, alpha }));
  return lines.length;
}
export const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// Crafted buttons: kinds 'gold' (primary), 'jade', 'wood', 'red'.
const BTN_COL = {
  gold: ['#fbe6a0', '#e2ac44', '#b9801f', INK, 'rgba(255,236,170,0.85)'],
  jade: ['#4bc59b', '#23896a', '#146046', '#f4fff9', 'rgba(170,255,220,0.6)'],
  wood: ['#7d4b28', '#573216', '#3a200d', GOLD, 'rgba(241,207,122,0.5)'],
  red: ['#e0574e', '#b32b27', '#7e1717', '#fff4ec', 'rgba(255,190,170,0.6)'],
};
export function btn(ctx, r, label, o = {}) {
  const { kind = 'jade', size = 34, pressed = false, off = false, sub = null, pulse = 0, font = DISPLAY } = o, c = BTN_COL[kind];
  const dy = pressed ? 4 : 0, R = Math.min(24, r.h * 0.3);
  ctx.save(); if (off) ctx.globalAlpha = 0.45;
  if (pulse > 0) { ctx.fillStyle = `rgba(255,224,130,${0.16 + 0.16 * pulse})`; rr(ctx, r.x - 8, r.y - 8, r.w + 16, r.h + 16, R + 8); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; rr(ctx, r.x + 1, r.y + 7 - dy * 0.6, r.w, r.h, R); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, c[0]); g.addColorStop(0.5, c[1]); g.addColorStop(1, c[2]);
  ctx.fillStyle = g; rr(ctx, r.x, r.y + dy, r.w, r.h, R); ctx.fill();
  ctx.save(); rr(ctx, r.x, r.y + dy, r.w, r.h, R); ctx.clip();
  const gl = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.55); gl.addColorStop(0, 'rgba(255,255,255,0.34)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(r.x, r.y + dy, r.w, r.h * 0.55); ctx.restore();
  ctx.strokeStyle = c[4]; ctx.lineWidth = 2; rr(ctx, r.x + 1, r.y + dy + 1, r.w - 2, r.h - 2, R - 1); ctx.stroke();
  const ty = r.y + dy + r.h / 2 + size * 0.32 - (sub ? 8 : 0);
  tx(ctx, label, r.x + r.w / 2, ty, size, c[3], { font, weight: 700, shadow: kind !== 'gold' });
  if (sub) tx(ctx, sub, r.x + r.w / 2, ty + size * 0.62, Math.max(14, size * 0.4), c[3], { font: UI, weight: 600, alpha: 0.85 });
  ctx.restore();
}
export function panel(ctx, x, y, w, h, o = {}) {
  const { alpha = 0.72, edge = 'rgba(241,207,122,0.55)', r = 26 } = o;
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, x + 2, y + 8, w, h, r); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(10,60,46,${alpha})`); g.addColorStop(1, `rgba(4,32,24,${Math.min(1, alpha + 0.12)})`);
  ctx.fillStyle = g; rr(ctx, x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 2; rr(ctx, x + 1, y + 1, w - 2, h - 2, r); ctx.stroke(); ctx.restore();
}

// ---- the felt table, painted once
let tableCache;
export function drawTable(ctx) {
  if (tableCache === undefined) {
    tableCache = null;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const c = new OffscreenCanvas(W, H), g = c.getContext('2d');
        const bg = g.createRadialGradient(W / 2, 700, 40, W / 2, 760, 980);
        bg.addColorStop(0, '#1d8266'); bg.addColorStop(0.55, '#116048'); bg.addColorStop(1, '#06281f');
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        // woven felt: fine deterministic speckle and faint cross-hatch
        let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
        for (let i = 0; i < 26000; i++) { const x = rnd() * W, y = rnd() * H, a = rnd() * 0.06; g.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,20,10,${a * 1.4})`; g.fillRect(x, y, 1.4, 1.4); }
        g.strokeStyle = 'rgba(255,255,255,0.018)'; g.lineWidth = 1;
        for (let y = 0; y < H; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
        // the playing area: a soft inlaid square with a gold hairline
        g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 30; g.fillStyle = 'rgba(0,30,20,0.18)'; g.beginPath(); g.roundRect(16, 340, W - 32, 720, 40); g.fill(); g.restore();
        g.strokeStyle = 'rgba(241,207,122,0.22)'; g.lineWidth = 2; g.beginPath(); g.roundRect(24, 348, W - 48, 704, 34); g.stroke();
        g.strokeStyle = 'rgba(241,207,122,0.1)'; g.lineWidth = 1; g.beginPath(); g.roundRect(34, 358, W - 68, 684, 28); g.stroke();
        // wooden rim
        const rim = 20, wd = g.createLinearGradient(0, 0, W, 0); wd.addColorStop(0, '#3a1d10'); wd.addColorStop(0.5, '#5b3320'); wd.addColorStop(1, '#3a1d10');
        g.fillStyle = wd; g.fillRect(0, 0, W, rim); g.fillRect(0, H - rim, W, rim); g.fillRect(0, 0, rim, H); g.fillRect(W - rim, 0, rim, H);
        for (let i = 0; i < 140; i++) { g.strokeStyle = `rgba(20,8,2,${0.08 + rnd() * 0.12})`; g.lineWidth = 1; const y = rnd() * H; g.beginPath(); g.moveTo(0, y); g.lineTo(rim, y + rnd() * 6 - 3); g.moveTo(W - rim, y); g.lineTo(W, y + rnd() * 6 - 3); g.stroke(); }
        g.strokeStyle = 'rgba(241,207,122,0.55)'; g.lineWidth = 2; g.strokeRect(rim, rim, W - rim * 2, H - rim * 2);
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 6; g.strokeRect(rim + 4, rim + 4, W - rim * 2 - 8, H - rim * 2 - 8);
        tableCache = c;
      }
    } catch { tableCache = null; }
  }
  if (tableCache) ctx.drawImage(tableCache, 0, 0, W, H);
  else { ctx.fillStyle = '#116048'; ctx.fillRect(0, 0, W, H); }
}

// ---- tiles on screen
const ssFor = (w) => (w >= 42 ? 2 : w >= 22 ? 1 : 0.5);
export function tileImg(kind, w, style, back = false, ss = 0) { const q = ss || ssFor(w); return back ? backSprite(q) : tileSprite(kind, style, q); }

// Draw one tile centred at (x,y): face width w, rotation rot, flip f (0 back .. 1 face), lift (0..1, moving tiles).
export function drawTileAt(ctx, id, kind, x, y, w, rot, f, style, o = {}) {
  const { lift = 0, alpha = 1, shadow = true, sx = 1, glow = 0, ss = 0 } = o;
  const face = f > 0.5, flip = f > 0 && f < 1 ? Math.max(0.06, Math.abs(1 - 2 * f)) : 1;
  const spr = tileImg(kind, w, style, !face, ss);
  const k = w / FW, h = FH * k;
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
  const sc = 1 + lift * 0.1; ctx.scale(sc * flip * sx, sc);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (shadow && w > 16) {
    ctx.fillStyle = `rgba(0,0,0,${0.3 - lift * 0.05})`; const d = 3 + lift * 10;
    ctx.beginPath(); ctx.roundRect(-w / 2 + d * 0.3, -h / 2 + d + 3 * k, w, h + 4 * k, 9 * k); ctx.fill();
  }
  if (glow > 0) { ctx.shadowColor = `rgba(255,220,120,${glow})`; ctx.shadowBlur = 22; }
  if (spr) ctx.drawImage(spr, -(FW / 2 + PAD) * k, -(FH / 2 + PAD) * k, SPRITE_W * k, SPRITE_H * k);
  else { ctx.fillStyle = face ? '#f6efd6' : '#1f7a5a'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 6); ctx.fill(); }
  ctx.restore();
}
// tile by kind for panels and lessons (no vis object): face up, upright
export function tileByKind(ctx, kind, x, y, w, style, o = {}) { drawTileAt(ctx, -1, kind, x, y, w, o.rot ?? 0, 1, style, o); }

export function windGlyph(ctx, w, x, y, r, o = {}) {
  const { dealer = false, active = false, pulse = 0 } = o;
  ctx.save();
  if (active) { ctx.fillStyle = `rgba(255,224,130,${0.35 + 0.25 * pulse})`; ctx.beginPath(); ctx.arc(x, y, r + 7, 0, TAU); ctx.fill(); }
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 2, x, y, r);
  g.addColorStop(0, dealer ? '#e85a4d' : '#2c8f6f'); g.addColorStop(1, dealer ? '#8f1e1a' : '#0f4a38');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5; ctx.stroke();
  const en = getLang() === 'en';
  tx(ctx, en ? ['E', 'S', 'W', 'N'][w] : ['東', '南', '西', '北'][w], x, y + r * (en ? 0.32 : 0.36), r * (en ? 0.95 : 1.05), '#fff6dc', { font: en ? DISPLAY : CJKF });
  ctx.restore();
}

export const ease = (f) => f * f * (3 - 2 * f);
