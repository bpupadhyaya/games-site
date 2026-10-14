// Shared drawing helpers for every screen: rounded panels, buttons, wrapped text, the palette and the flow layout (the same
// menu behaviour as the other Arcforge games, with this game's own colours and type).
import { host } from './layout.js';
import { v3 } from './v3.js';
// Smallest readable text (11 CSS px) and smallest tap target (44 CSS px) in virtual units, so small phones never get tiny text or buttons.
const minF = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);
const minH = () => (host.px > 0 ? Math.ceil(44 / host.px) : 0);
const subSz = (fs) => Math.max(Math.round(fs * 0.72), minF());
export const FONT = "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Roboto, Arial, sans-serif";
export const DISPLAY = "'Avenir Next Condensed', 'Arial Narrow', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const C = {
  ink: '#2a1a24', cream: '#fbf3e2', sand: '#e6d6b4', terra: '#c8361c', terraDark: '#6e1608', olive: '#1f8577', lav: '#5a4a9c', sky: '#3a7fb0',
  gold: '#f0b44c', shadow: 'rgba(10,8,30,0.4)', paper: 'rgba(251,243,226,0.97)', deep: '#1c1840',
};

export function roundPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// One button look for the whole game: lacquered and carved plaques with a brass edge, a soft drop shadow, a top gloss and a
// pressed state (the button sinks 3 px and darkens while a finger that started on it is down).
const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
// fill: top, bottom colours of the face; edge: brass edge top / bottom; wood: use the carved-cedar pattern under the face
const BTN_FILL = {
  disabled: { f0: '#8d93a3', f1: '#6a7080', e0: '#b7bcc8', e1: '#7b8190' },
  primary: { f0: '#ff6a42', f1: '#c42a12', e0: '#ffe7a0', e1: '#b9801f' },
  active: { f0: '#3cd0bb', f1: '#13796d', e0: '#fff1b8', e1: '#b9801f' },
  dark: { f0: '#4a509e', f1: '#1d2158', e0: '#e8d8a8', e1: '#8e6a28' },
  slate: { f0: '#2d2c4c', f1: '#12102b', e0: '#f0dca0', e1: '#8e6a28' },
  plain: { f0: '#a8683a', f1: '#5e3416', e0: '#ffe3a0', e1: '#a8741e', wood: true },
};
let WOOD = null;
function woodPattern(ctx) {
  if (WOOD) return WOOD;
  try {
    if (!v3.makeCanvas) return null;
    const c = v3.makeCanvas(128, 128); const g = c.getContext('2d');
    g.fillStyle = '#7d4a26'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 46; i++) {
      const y = (i * 37.7) % 128, a = 2 + (i % 5), ph = i * 1.3;
      g.beginPath(); for (let x = 0; x <= 128; x += 8) { const yy = y + Math.sin((x / 128) * 6.283 + ph) * a * 0.4; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); }
      g.strokeStyle = i % 3 ? `rgba(40,18,6,${0.12 + (i % 4) * 0.05})` : 'rgba(255,214,150,0.07)'; g.lineWidth = 0.8 + (i % 3) * 0.6; g.stroke();
    }
    WOOD = ctx.createPattern(c, 'repeat');
  } catch { WOOD = null; }
  return WOOD;
}
function brassPath(ctx, x, y, w, h, r, e0, e1) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, e0); g.addColorStop(0.5, e1); g.addColorStop(1, e0);
  roundPath(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
}
// a lacquered plaque: used by buttons and by the HUD chips. kind: BTN_FILL key
export function lacquer(ctx, r, kind = 'dark', o = {}) {
  const k = BTN_FILL[kind] || BTN_FILL.dark, rad = o.r ?? Math.min(18, r.h / 2), dy = o.dy ?? 0, edge = o.edge ?? 3;
  ctx.save();
  if (o.shadow !== false) { roundPath(ctx, r.x + 1, r.y + dy + (dy ? 2 : 5), r.w, r.h, rad + 1); ctx.fillStyle = dy ? 'rgba(2,6,18,0.3)' : 'rgba(2,6,18,0.42)'; ctx.fill(); }
  brassPath(ctx, r.x, r.y + dy, r.w, r.h, rad, k.e0, k.e1);
  const x = r.x + edge, y = r.y + dy + edge, w = r.w - 2 * edge, h = r.h - 2 * edge, ir = Math.max(2, rad - edge);
  roundPath(ctx, x, y, w, h, ir);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, k.f0); g.addColorStop(1, k.f1);
  ctx.fillStyle = g; ctx.fill();
  if (k.wood) { const p = woodPattern(ctx); if (p) { ctx.globalAlpha = 0.5; ctx.fillStyle = p; ctx.fill(); ctx.globalAlpha = 1; } }
  // gloss: a soft light band across the top half, and a darker base
  ctx.save(); roundPath(ctx, x, y, w, h, ir); ctx.clip();
  const gl = ctx.createLinearGradient(0, y, 0, y + h * 0.55); gl.addColorStop(0, 'rgba(255,255,255,0.38)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(x, y, w, h * 0.55);
  const sh = ctx.createLinearGradient(0, y + h * 0.6, 0, y + h); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = sh; ctx.fillRect(x, y + h * 0.6, w, h * 0.4);
  ctx.restore();
  roundPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, ir); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.stroke();
  ctx.restore();
}
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const dy = pressed ? 3 : 0;
  lacquer(ctx, r, k, { dy, shadow: !disabled });
  if (pressed) { ctx.save(); roundPath(ctx, r.x, r.y + dy, r.w, r.h, Math.min(18, r.h / 2)); ctx.fillStyle = 'rgba(2,6,18,0.2)'; ctx.fill(); ctx.restore(); }
  return { dy, light: !disabled };
}

// A parchment pill. opts: primary (terracotta), active (olive), disabled, sub (small second line), size (font px)
export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28, icon = null } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(230,234,244,0.8)' : '#fff6e2'; void light;
  ctx.shadowColor = 'rgba(20,6,2,0.55)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1.5;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = sub ? Math.round(size * 0.9) : size;
  const maxW = r.w - (icon ? 84 : 24);
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > maxW && px > 13) { px -= 1; ctx.font = `700 ${px}px ${FONT}`; }
  const cx = r.x + r.w / 2 + (icon ? 24 : 0);
  ctx.fillText(label, cx, r.y + dy + r.h / 2 - (sub ? 11 : 0));
  if (sub) { ctx.font = `400 ${Math.round(size * 0.62)}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, cx, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1; }
  if (icon) icon(ctx, r.x + 32, r.y + dy + r.h / 2, light && !disabled ? '#ffffff' : C.ink);
  ctx.restore();
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 26, fill = C.paper, stroke = 'rgba(40,60,80,0.55)', shadow = true, brass = true } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 8, w, h, r); ctx.fillStyle = 'rgba(2,6,18,0.45)'; ctx.fill(); }
  if (brass) brassPath(ctx, x - 4, y - 4, w + 8, h + 8, r + 4, '#ffe9a8', '#a8741e');
  roundPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
  ctx.restore();
}

export function wrapLines(ctx, text, maxW) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
export function drawWrapped(ctx, text, cx, y, maxW, lh, align = 'center') {
  ctx.textAlign = align;
  const x = align === 'center' ? cx : align === 'left' ? cx - maxW / 2 : cx + maxW / 2;
  for (const l of wrapLines(ctx, text, maxW)) { ctx.fillText(l, x, y); y += lh; }
  return y;
}
export function textShadow(ctx, text, x, y, fill = '#fff6e2', blur = 4) {
  ctx.save();
  ctx.shadowColor = 'rgba(4,12,26,0.7)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
  ctx.restore();
}
export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

// ---------------------------------------------------------------------------------------------
// Flow layout: a vertical list of widgets (headings, paragraphs, buttons, chips, custom art) that
// scales with the player's text size and scrolls when it no longer fits. Used by every menu screen,
// so nothing can overflow or clip at 300%.
//   widget: { t: 'h'|'p'|'btn'|'gap'|'art', id, label, sub, row, primary, active, disabled, dark, h, draw }
const GAP = 14;
export function flowLayout(ctx, widgets, scale, o = {}) {
  const x0 = o.x ?? 40, w0 = o.w ?? 640;
  let y = 0;
  const out = [];
  let i = 0;
  while (i < widgets.length) {
    const wd = widgets[i];
    if (wd.t === 'btn' && wd.row !== undefined) {
      const group = [];
      while (i < widgets.length && widgets[i].t === 'btn' && widgets[i].row === wd.row) group.push(widgets[i++]);
      const fs = Math.round((o.btn ?? 26) * Math.min(scale, 3));
      // a row of side-by-side buttons falls back to a stack when the text no longer fits
      ctx.font = `700 ${fs}px ${FONT}`;
      const cw0 = (w0 - GAP * (group.length - 1)) / group.length;
      const tooWide = group.some((g) => g.label.split(' ').some((word) => ctx.measureText(word).width > cw0 - 28));
      if (tooWide || (scale > 1.5 && group.length > 1)) {
        widgets.splice(i, 0, ...group.map((g) => ({ ...g, row: undefined, h: g.h ?? 76 })));
        continue;
      }
      const cw = cw0;
      let hmax = 0;
      const prepared = group.map((g) => {
        ctx.font = `700 ${fs}px ${FONT}`;
        const lines = wrapLines(ctx, g.label, cw - 28);
        const sub = g.sub ? wrapLines(ctx, g.sub, cw - 28).length : 0;
        const h = Math.max(g.h ?? 76, minH(), lines.length * fs * 1.15 + sub * subSz(fs) + 34);
        hmax = Math.max(hmax, h);
        return { g, lines, h, subLines: sub };
      });
      prepared.forEach((p, k) => out.push({ w: p.g, x: x0 + k * (cw + GAP), y, wd: cw, h: hmax, fs, lines: p.lines }));
      y += hmax + GAP;
      continue;
    }
    i++;
    if (wd.t === 'gap') { y += wd.h ?? 20; continue; }
    if (wd.t === 'art') { out.push({ w: wd, x: x0, y, wd: w0, h: wd.h }); y += wd.h + GAP; continue; }
    if (wd.t === 'h') {
      const fs = Math.round((wd.size ?? 44) * Math.min(scale, wd.cap ?? 1.7));
      ctx.font = `700 ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0);
      const h = lines.length * fs * 1.18;
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
      continue;
    }
    if (wd.t === 'p') {
      const fs = Math.max(minF(), Math.round((wd.size ?? 26) * Math.min(scale, wd.cap ?? 3)));
      ctx.font = `${wd.bold ? 700 : 400} ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0 - (wd.pad ?? 0) * 2);
      const h = lines.length * fs * 1.3;
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
      continue;
    }
    if (wd.t === 'btn') {
      const fs = Math.round((o.btn ?? 26) * Math.min(scale, 3));
      ctx.font = `700 ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0 - 28);
      const sub = wd.sub ? wrapLines(ctx, wd.sub, w0 - 28).length : 0;
      const h = Math.max(wd.h ?? 84, minH(), lines.length * fs * 1.15 + sub * subSz(fs) + 34);
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
    }
  }
  return { items: out, contentH: y };
}

export function drawFlow(ctx, lay, top, bottom, scroll, o = {}) {
  ctx.save();
  ctx.beginPath(); ctx.rect(o.clipX ?? 0, top, o.clipW ?? 720, bottom - top); ctx.clip();
  for (const it of lay.items) {
    const y = top + it.y - scroll;
    if (y > bottom || y + it.h < top) continue;
    const wd = it.w;
    if (wd.t === 'art') { ctx.save(); ctx.translate(it.x, y); wd.draw(ctx, it.wd, it.h, { x: it.x, y }); ctx.restore(); }
    else if (wd.t === 'h') {
      ctx.fillStyle = wd.color ?? '#fff6e6'; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#fff6e6', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(255,244,226,0.96)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(4,12,26,0.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
    } else if (wd.t === 'btn') {
      drawButtonRect(ctx, { x: it.x, y, w: it.wd, h: it.h }, it, wd);
    }
  }
  ctx.restore();
}
function drawButtonRect(ctx, r, it, wd) {
  const { disabled = false } = wd;
  const { dy, light } = paintButton(ctx, r, wd);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(230,234,244,0.8)' : '#fff6e2'; void light;
  ctx.shadowColor = 'rgba(20,6,2,0.55)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1.5;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${it.fs}px ${FONT}`;
  const subLines = wd.sub ? (() => { ctx.font = `400 ${subSz(it.fs)}px ${FONT}`; const l = wrapLines(ctx, wd.sub, r.w - 28); ctx.font = `700 ${it.fs}px ${FONT}`; return l; })() : [];
  const total = it.lines.length * it.fs * 1.15 + subLines.length * subSz(it.fs);
  let y = r.y + dy + (r.h - total) / 2 + it.fs * 0.88;
  it.lines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 1.15; });
  if (subLines.length) {
    ctx.font = `400 ${subSz(it.fs)}px ${FONT}`; ctx.globalAlpha = 0.85;
    y -= it.fs * 0.2;
    subLines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += subSz(it.fs); });
    ctx.globalAlpha = 1;
  }
  if (wd.stars) {
    ctx.font = `400 ${Math.max(Math.round(it.fs * 0.7), minF())}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = light ? '#ffe9a0' : '#b8431c';
    ctx.fillText('★'.repeat(wd.stars) + '☆'.repeat(5 - wd.stars), r.x + r.w - 16, r.y + dy + it.fs * 0.95);
  }
  ctx.restore();
}
export function flowHit(lay, top, scroll, x, y) {
  for (const it of lay.items) {
    if (it.w.t !== 'btn' || it.w.disabled && !it.w.hitDisabled) continue;
    const yy = top + it.y - scroll;
    if (x >= it.x && x <= it.x + it.wd && y >= yy && y <= yy + it.h) return it.w.id;
  }
  return null;
}
