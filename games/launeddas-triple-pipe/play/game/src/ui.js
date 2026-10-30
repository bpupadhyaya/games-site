// Shared drawing helpers for every screen: rounded panels, buttons, wrapped text, the palette (the same flow-layout pattern as
// the other Arcforge games so every menu behaves the same; the palette is this game's own: warm umber, cane gold, terracotta and teal).
// Smallest text the screen allows (about 11 css px), in virtual units; layout.js keeps it current.
import { v3, active as v3active, toV } from './v3.js';
export let FLOOR = 18;
export const setFloor = (v) => { FLOOR = Math.max(11, Math.round(v)); };
export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, Arial, sans-serif";
export const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";
export const C = {
  ink: '#2a1608', cream: '#f4efe0', sand: '#dfe7d6', terra: '#d8582a', terraDark: '#8f3414', olive: '#2f8f86', delft: '#2f8f86', delftDark: '#5a2a14',
  gold: '#f2c14e', shadow: 'rgba(2,12,14,0.5)', paper: 'rgba(250,240,218,0.98)', navy: '#150d09', text: '#eef6f2', soft: '#e8cfa0', frame: '#e0b070',
};

export function roundPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// One button look for the whole game: a single subtle vertical gradient, ONE crisp border, a soft drop
// shadow and a pressed state (the button sinks 3 px and darkens while a finger that started on it is down).
const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
const BTN_FILL = {
  disabled: ['#2b3646', '#2b3646', 'rgba(255,255,255,0.12)'],
  primary: ['#f6c548', '#d9962a', '#fff0b8'],
  active: ['#35aca0', '#1b6a63', '#b0f2e8'],
  dark: ['#4a2c1c', '#2a150c', 'rgba(240,190,110,0.75)'],
  plain: ['#fdf3da', '#e4d0a2', 'rgba(110,60,24,0.75)'],
};
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const [c0, c1, edge] = BTN_FILL[k];
  const dy = pressed ? 3 : 0;
  if (v3active()) { v3.buttons.push({ r: toV(ctx, r), kind: k, pressed, disabled, clip: v3.clip }); return { dy, light: active || dark }; }
  ctx.save();
  if (!disabled) { roundPath(ctx, r.x, r.y + (pressed ? 2 : 4), r.w, r.h, 18); ctx.fillStyle = pressed ? 'rgba(10,4,4,0.25)' : 'rgba(10,4,4,0.4)'; ctx.fill(); }
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, 18);
  const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fill();
  if (pressed) { ctx.fillStyle = 'rgba(10,4,4,0.18)'; ctx.fill(); }
  ctx.lineWidth = 2; ctx.strokeStyle = edge; ctx.stroke();
  ctx.save(); roundPath(ctx, r.x + 3, r.y + dy + 3, r.w - 6, r.h - 6, 15); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(r.x, r.y + dy, r.w, r.h * 0.5); ctx.restore();
  ctx.restore();
  return { dy, light: active || dark };
}

// A parchment pill. opts: primary (terracotta), active (olive), disabled, sub (small second line), size (font px)
export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28, icon = null } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(220,205,170,0.45)' : light ? '#ffffff' : C.ink;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = Math.max(FLOOR, sub ? Math.round(size * 0.9) : size);
  const maxW = r.w - (icon ? 84 : 24);
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > maxW && px > FLOOR) { px -= 1; ctx.font = `700 ${px}px ${FONT}`; }
  const cx = r.x + r.w / 2 + (icon ? 24 : 0);
  ctx.fillText(label, cx, r.y + dy + r.h / 2 - (sub ? Math.max(11, FLOOR * 0.5) : 0));
  if (sub) { const sp = Math.max(FLOOR, Math.round(size * 0.62)); ctx.font = `400 ${sp}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, cx, r.y + dy + r.h / 2 + Math.max(size * 0.5, sp * 0.95)); ctx.globalAlpha = 1; }
  if (icon) icon(ctx, r.x + 32, r.y + dy + r.h / 2, light && !disabled ? '#ffffff' : C.ink);
  ctx.restore();
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 26, fill = C.paper, stroke = 'rgba(120,60,20,0.7)', shadow = true } = opts;
  if (v3active()) { v3.panels.push({ r: toV(ctx, { x, y, w, h }), rad: r, fill, clip: v3.clip }); return; }
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 6, w, h, r); ctx.fillStyle = 'rgba(10,4,4,0.42)'; ctx.fill(); }
  roundPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke();
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
export function textShadow(ctx, text, x, y, fill = '#f4faff', blur = 4) {
  ctx.save();
  ctx.shadowColor = 'rgba(2,12,14,0.78)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
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
const subSize = (fs) => Math.max(FLOOR, Math.round(fs * 0.72));
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
      const fs = Math.max(FLOOR, Math.round((o.btn ?? 26) * Math.min(scale, 3)));
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
        const h = Math.max(o.minH ?? 0, g.h ?? 76, lines.length * fs * 1.15 + sub * subSize(fs) + 34);
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
      const fs = Math.max(FLOOR, Math.round((wd.size ?? 44) * Math.min(scale, wd.cap ?? 1.7)));
      ctx.font = `700 ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0);
      const h = lines.length * fs * 1.18;
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
      continue;
    }
    if (wd.t === 'p') {
      const fs = Math.max(FLOOR, Math.round((wd.size ?? 26) * Math.min(scale, wd.cap ?? 3)));
      ctx.font = `${wd.bold ? 700 : 400} ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0 - (wd.pad ?? 0) * 2);
      const h = lines.length * fs * 1.3;
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
      continue;
    }
    if (wd.t === 'btn') {
      const fs = Math.max(FLOOR, Math.round((o.btn ?? 26) * Math.min(scale, 3)));
      ctx.font = `700 ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0 - 28);
      const sub = wd.sub ? wrapLines(ctx, wd.sub, w0 - 28).length : 0;
      const h = Math.max(o.minH ?? 0, wd.h ?? 84, lines.length * fs * 1.15 + sub * subSize(fs) + 34);
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
    }
  }
  return { items: out, contentH: y };
}

export function drawFlow(ctx, lay, top, bottom, scroll, o = {}) {
  const prevClip = v3.clip;
  { const a = toV(ctx, { x: 0, y: top, w: 0, h: bottom - top }); v3.clip = { top: a.y, bottom: a.y + a.h }; }
  try { drawFlowInner(ctx, lay, top, bottom, scroll, o); } finally { v3.clip = prevClip; }
}
function drawFlowInner(ctx, lay, top, bottom, scroll, o = {}) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, top, 8192, bottom - top); ctx.clip();
  for (const it of lay.items) {
    const y = top + it.y - scroll;
    if (y > bottom || y + it.h < top) continue;
    const wd = it.w;
    if (wd.t === 'art') { ctx.save(); ctx.translate(it.x, y); wd.draw(ctx, it.wd, it.h); ctx.restore(); }
    else if (wd.t === 'h') {
      ctx.fillStyle = wd.color ?? '#f3f8f2'; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#f3f8f2', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(238,246,242,0.97)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(2,12,14,0.65)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
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
  ctx.fillStyle = disabled ? 'rgba(220,205,170,0.45)' : light ? '#ffffff' : C.ink;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${it.fs}px ${FONT}`;
  const sfs = subSize(it.fs);
  const subLines = wd.sub ? (() => { ctx.font = `400 ${sfs}px ${FONT}`; const l = wrapLines(ctx, wd.sub, r.w - 28); ctx.font = `700 ${it.fs}px ${FONT}`; return l; })() : [];
  const total = it.lines.length * it.fs * 1.15 + subLines.length * sfs;
  let y = r.y + dy + (r.h - total) / 2 + it.fs * 0.88;
  it.lines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 1.15; });
  if (subLines.length) {
    ctx.font = `400 ${sfs}px ${FONT}`; ctx.globalAlpha = 0.85;
    y -= it.fs * 0.2;
    subLines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += sfs; });
    ctx.globalAlpha = 1;
  }
  if (wd.stars) {
    ctx.font = `400 ${Math.round(it.fs * 0.7)}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = light ? '#ffe9a0' : '#8f3414';
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
