// Shared drawing helpers for every screen: rounded panels, buttons, wrapped text, the palette and the flow layout (the same
// menu behaviour as the other Arcforge games, with this game's own colours and type).
import { host } from './layout.js';
// Smallest readable text (11 CSS px) and smallest tap target (44 CSS px) in virtual units, so small phones never get tiny text or buttons.
const minF = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);
const minH = () => (host.px > 0 ? Math.ceil(44 / host.px) : 0);
const subSz = (fs) => Math.max(Math.round(fs * 0.72), minF());
export const FONT = "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Roboto, Arial, sans-serif";
export const DISPLAY = "'Avenir Next Condensed', 'Arial Narrow', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const C = {
  ink: '#2b1d14', cream: '#f6ecd8', sand: '#e2cfa8', terra: '#a82f1c', terraDark: '#5a1408', olive: '#5d7a2c', lav: '#6c4a8a', sky: '#4a86b8',
  gold: '#f2b134', shadow: 'rgba(24,12,4,0.4)', paper: 'rgba(250,242,224,0.97)', deep: '#3a2314',
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
  disabled: ['#cfc8bd', '#bdb5a8', 'rgba(80,60,40,0.35)'],
  primary: ['#e0552c', '#b3331f', '#5a1408'],
  active: ['#86ac3e', '#5b7f22', '#2a3d0c'],
  dark: ['#52392a', '#37261b', 'rgba(255,255,255,0.2)'],
  plain: ['#fbf3df', '#e6d3a8', 'rgba(90,60,30,0.55)'],
};
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const [c0, c1, edge] = BTN_FILL[k];
  const dy = pressed ? 3 : 0, rad = Math.min(18, r.h / 2);
  ctx.save();
  // the base the button sits on: deeper when it is up, shallow when pressed
  if (!disabled) { roundPath(ctx, r.x, r.y + (pressed ? 2 : 5), r.w, r.h, rad); ctx.fillStyle = pressed ? 'rgba(20,8,2,0.3)' : 'rgba(20,8,2,0.42)'; ctx.fill(); }
  // lacquered body: rim, deep face gradient, a crisp specular line along the top edge and a dark lower lip
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad);
  const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h);
  g.addColorStop(0, c0); g.addColorStop(0.55, mixHex(c0, c1, 0.6)); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fill();
  if (!disabled) {
    ctx.save(); roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.clip();
    const hl = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h * 0.5); hl.addColorStop(0, 'rgba(255,255,255,0.22)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.fillRect(r.x, r.y + dy, r.w, r.h * 0.5);
    const lip = ctx.createLinearGradient(0, r.y + dy + r.h * 0.78, 0, r.y + dy + r.h); lip.addColorStop(0, 'rgba(0,0,0,0)'); lip.addColorStop(1, 'rgba(20,6,0,0.28)');
    ctx.fillStyle = lip; ctx.fillRect(r.x, r.y + dy + r.h * 0.78, r.w, r.h * 0.22);
    ctx.restore();
    roundPath(ctx, r.x + 1.5, r.y + dy + 1.5, r.w - 3, r.h - 3, Math.max(2, rad - 1.5)); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.stroke();
  }
  if (pressed) { roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.fillStyle = 'rgba(20,8,2,0.18)'; ctx.fill(); }
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.lineWidth = 1.6; ctx.strokeStyle = edge; ctx.stroke();
  ctx.restore();
  return { dy, light: primary || active || dark };
}
function mixHex(a, b, t) {
  const pa = hexRgb(a), pb = hexRgb(b); if (!pa || !pb) return a;
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`;
}
function hexRgb(h) { const m = /^#([0-9a-f]{6})$/i.exec(h); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

// A parchment pill. opts: primary (terracotta), active (olive), disabled, sub (small second line), size (font px)
export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28, icon = null } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(40,46,64,0.55)' : light ? '#ffffff' : C.ink;
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

// Plaques: dark panels are carved walnut with a brass edge and an inner bevel; light panels are cream card with the same bevel.
let GRAIN = null;
function grainPattern(ctx) {
  if (GRAIN) return GRAIN;
  try {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const c = new OffscreenCanvas(256, 256);
    const g = c.getContext('2d'); let a = 77; const rnd = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) { const y = rnd() * 256, l = rnd(); g.strokeStyle = l > 0.5 ? `rgba(255,214,160,${0.05 + rnd() * 0.08})` : `rgba(0,0,0,${0.12 + rnd() * 0.14})`; g.lineWidth = 0.6 + rnd() * 2; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + rnd() * 8 - 4, 170, y + rnd() * 8 - 4, 256, y + rnd() * 4 - 2); g.stroke(); }
    GRAIN = ctx.createPattern(c, 'repeat');
  } catch { GRAIN = null; }
  return GRAIN;
}
const isDarkFill = (f) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(f) || null; if (m) return (+m[1] + +m[2] + +m[3]) / 3 < 120; const h = hexRgb(f); return h ? (h[0] + h[1] + h[2]) / 3 < 120 : false; };
export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 26, fill = C.paper, stroke = 'rgba(40,60,80,0.55)', shadow = true } = opts;
  const dark = isDarkFill(fill), rad = Math.min(r, h / 2, w / 2);
  const alpha = (/rgba\([^)]*,\s*([\d.]+)\)/.exec(fill) || [0, 1])[1];
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 6, w, h, rad); ctx.fillStyle = 'rgba(20,8,2,0.38)'; ctx.fill(); }
  roundPath(ctx, x, y, w, h, rad);
  if (dark) {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#52331f'); g.addColorStop(0.5, '#3a2314'); g.addColorStop(1, '#27160b');
    ctx.globalAlpha = Math.min(1, 0.55 + Number(alpha) * 0.5); ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
    const gp = grainPattern(ctx);
    if (gp) { ctx.save(); roundPath(ctx, x, y, w, h, rad); ctx.clip(); ctx.globalAlpha = 0.55; ctx.fillStyle = gp; ctx.fillRect(x, y, w, h); ctx.restore(); }
    // bevel: light top-left, dark bottom-right, inside the brass edge
    roundPath(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(2, rad - 3)); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,226,170,0.22)'; ctx.stroke();
    const sh = ctx.createLinearGradient(0, y, 0, y + h); sh.addColorStop(0, 'rgba(0,0,0,0.0)'); sh.addColorStop(0.8, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.save(); roundPath(ctx, x, y, w, h, rad); ctx.clip(); ctx.fillStyle = sh; ctx.fillRect(x, y, w, h); ctx.restore();
    roundPath(ctx, x, y, w, h, rad);
    const brass = stroke === 'rgba(255,226,170,0.3)' || stroke === 'rgba(40,60,80,0.55)' || stroke === 'rgba(255,200,120,0.5)';
    if (brass) { const bg = ctx.createLinearGradient(x, y, x + w, y + h); bg.addColorStop(0, '#f1cf84'); bg.addColorStop(0.45, '#9c6f28'); bg.addColorStop(0.7, '#d8ae55'); bg.addColorStop(1, '#7a521c'); ctx.strokeStyle = bg; ctx.lineWidth = 2.4; }
    else { ctx.strokeStyle = stroke; ctx.lineWidth = 2.6; }
    ctx.stroke();
  } else {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#fffbf0'); g.addColorStop(1, '#ecdcbc');
    ctx.fillStyle = Number(alpha) >= 0.9 ? g : fill; ctx.fill();
    roundPath(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(2, rad - 3)); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
    roundPath(ctx, x, y, w, h, rad); ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke();
  }
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
  ctx.shadowColor = 'rgba(20,8,2,0.7)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
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
      ctx.fillStyle = wd.color ?? '#fff6e2'; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#fff6e2', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(255,246,228,0.96)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(20,8,2,0.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
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
  ctx.fillStyle = disabled ? 'rgba(40,46,64,0.55)' : light ? '#ffffff' : C.ink;
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
