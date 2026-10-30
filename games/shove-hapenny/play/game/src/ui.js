// Shared drawing helpers for every screen: rounded panels, buttons, wrapped text, the palette (copied pattern from the
// other physics games so every Arcforge game's menus behave the same).
import { v3 } from './v3.js';
export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
export const C = {
  ink: '#1f2540', cream: '#f6efdc', sand: '#e6d9b8', terra: '#c93a2c', terraDark: '#7a1d17', olive: '#2d6f86', lav: '#6a5aa0', sky: '#3f6fb5',
  gold: '#f0b83c', shadow: 'rgba(12,14,36,0.4)', paper: 'rgba(248,242,226,0.95)',
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
  disabled: ['#cfd0d8', '#bcbdc8', 'rgba(70,74,100,0.35)'],
  primary: ['#e24a35', '#bd2d22', '#6b1410'],
  active: ['#2f84a0', '#236a82', '#123b4a'],
  dark: ['#2b3358', '#1f2645', 'rgba(255,255,255,0.2)'],
  plain: ['#f8f1dd', '#e9dcb8', 'rgba(60,56,90,0.55)'],
};
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const [c0, c1, edge] = BTN_FILL[k];
  const dy = pressed ? 3 : 0;
  if (v3.on) { v3.buttons.push({ r, rad: 18, k, pressed }); return { dy: pressed ? 2 : 0, light: primary || active || dark }; }
  ctx.save();
  if (!disabled) { roundPath(ctx, r.x, r.y + (pressed ? 2 : 4), r.w, r.h, 18); ctx.fillStyle = pressed ? 'rgba(8,10,30,0.25)' : 'rgba(8,10,30,0.34)'; ctx.fill(); }
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, 18);
  const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fill();
  if (pressed) { ctx.fillStyle = 'rgba(6,8,24,0.16)'; ctx.fill(); }
  ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
  ctx.restore();
  return { dy, light: primary || active || dark };
}

// A parchment pill. opts: primary (terracotta), active (olive), disabled, sub (small second line), size (font px)
export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28, icon = null } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(50,52,80,0.6)' : light ? '#fffaf0' : C.ink;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = sub ? Math.round(size * 0.9) : size;
  const maxW = r.w - (icon ? 84 : 24);
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > maxW && px > 13) { px -= 1; ctx.font = `700 ${px}px ${FONT}`; }
  const cx = r.x + r.w / 2 + (icon ? 24 : 0);
  ctx.fillText(label, cx, r.y + dy + r.h / 2 - (sub ? 11 : 0));
  if (sub) { ctx.font = `400 ${Math.round(size * 0.62)}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, cx, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1; }
  if (icon) icon(ctx, r.x + 32, r.y + dy + r.h / 2, light && !disabled ? '#fffaf0' : C.ink);
  ctx.restore();
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 26, fill = C.paper, stroke = 'rgba(60,56,90,0.55)', shadow = true } = opts;
  if (v3.on) { v3.panels.push({ r: { x, y, w, h }, rad: r, kind: /^rgba\(24,30,66|^rgba\(8|^rgba\(14/.test(String(fill)) ? 'dark' : 'paper' }); return; }
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 6, w, h, r); ctx.fillStyle = 'rgba(8,10,30,0.38)'; ctx.fill(); }
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
export function textShadow(ctx, text, x, y, fill = '#fff6e2', blur = 4) {
  ctx.save();
  ctx.shadowColor = 'rgba(6,8,24,0.7)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
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
      const fs = Math.round((group[0].fs0 ?? o.btn ?? 26) * Math.min(scale, 3));
      // a row of side-by-side buttons falls back to a stack when the text no longer fits
      ctx.font = `700 ${fs}px ${FONT}`;
      const cw0 = (w0 - GAP * (group.length - 1)) / group.length;
      const tooWide = group.some((g) => g.label.split(' ').some((word) => ctx.measureText(word).width > cw0 - (g.ico ? 10 : 28)));
      if (tooWide || (scale > 1.5 && group.length > 1)) {
        widgets.splice(i, 0, ...group.map((g) => ({ ...g, row: undefined, h: g.h ?? 76 })));
        continue;
      }
      const cw = cw0;
      let hmax = 0;
      const prepared = group.map((g) => {
        ctx.font = `700 ${fs}px ${FONT}`;
        const lines = wrapLines(ctx, g.label, cw - (g.ico ? 8 : 28));
        const sub = g.sub ? wrapLines(ctx, g.sub, cw - 28).length : 0;
        const h = Math.max(g.h ?? 76, lines.length * fs * 1.15 + sub * fs * 0.72 + (g.ico ? 20 : 34));
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
      const fs = Math.round((wd.size ?? 26) * Math.min(scale, wd.cap ?? 3));
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
      const h = Math.max(wd.h ?? 84, lines.length * fs * 1.15 + sub * fs * 0.72 + 34);
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
    if (wd.t === 'art') { ctx.save(); ctx.translate(it.x, y); wd.draw(ctx, it.wd, it.h); ctx.restore(); }
    else if (wd.t === 'h') {
      ctx.fillStyle = wd.color ?? '#fff8e6'; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#fff8e6', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(255,248,232,0.96)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(6,8,24,0.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
    } else if (wd.t === 'btn') {
      drawButtonRect(ctx, { x: it.x, y, w: it.wd, h: it.h }, it, wd);
    }
  }
  ctx.restore();
}
// Small vector glyphs for the title buttons (drawn in the button's text colour).
const ICO = {
  play: (c, s) => { c.beginPath(); c.moveTo(-0.6 * s, -0.8 * s); c.lineTo(0.8 * s, 0); c.lineTo(-0.6 * s, 0.8 * s); c.closePath(); c.fill(); },
  two: (c, s) => { for (const k of [-1, 1]) { c.beginPath(); c.arc(k * 0.5 * s, 0, 0.62 * s, 0, 7); c.stroke(); } },
  solo: (c, s) => { c.beginPath(); c.arc(0, 0, 0.8 * s, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, 0.3 * s, 0, 7); c.fill(); },
  watch: (c, s) => { c.beginPath(); c.moveTo(-0.9 * s, 0); c.quadraticCurveTo(0, -0.95 * s, 0.9 * s, 0); c.quadraticCurveTo(0, 0.95 * s, -0.9 * s, 0); c.stroke(); c.beginPath(); c.arc(0, 0, 0.3 * s, 0, 7); c.fill(); },
  howto: (c, s) => { c.beginPath(); c.arc(0, -0.15 * s, 0.75 * s, 0, 7); c.stroke(); c.beginPath(); c.moveTo(-0.15 * s, 0.1 * s); c.lineTo(0.2 * s, -0.15 * s); c.moveTo(0.45 * s, -0.5 * s); c.lineTo(0.2 * s, -0.15 * s); c.stroke(); },
  rules: (c, s) => { c.beginPath(); c.rect(-0.7 * s, -0.85 * s, 1.4 * s, 1.7 * s); c.stroke(); for (const y of [-0.4, 0, 0.4]) { c.beginPath(); c.moveTo(-0.35 * s, y * s); c.lineTo(0.35 * s, y * s); c.stroke(); } },
  about: (c, s) => { c.beginPath(); c.arc(0, 0, 0.85 * s, 0, 7); c.stroke(); c.beginPath(); c.arc(0, -0.4 * s, 0.1 * s, 0, 7); c.fill(); c.beginPath(); c.moveTo(0, -0.1 * s); c.lineTo(0, 0.5 * s); c.stroke(); },
  records: (c, s) => { c.beginPath(); c.moveTo(-0.55 * s, -0.8 * s); c.lineTo(0.55 * s, -0.8 * s); c.lineTo(0.4 * s, 0.1 * s); c.quadraticCurveTo(0, 0.5 * s, -0.4 * s, 0.1 * s); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(0, 0.4 * s); c.lineTo(0, 0.75 * s); c.moveTo(-0.4 * s, 0.8 * s); c.lineTo(0.4 * s, 0.8 * s); c.stroke(); },
  settings: (c, s) => { c.beginPath(); c.arc(0, 0, 0.5 * s, 0, 7); c.stroke(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * 0.68 * s, Math.sin(a) * 0.68 * s); c.lineTo(Math.cos(a) * 0.92 * s, Math.sin(a) * 0.92 * s); c.stroke(); } },
  sound: (c, s) => { c.beginPath(); c.moveTo(-0.8 * s, -0.25 * s); c.lineTo(-0.4 * s, -0.25 * s); c.lineTo(0, -0.7 * s); c.lineTo(0, 0.7 * s); c.lineTo(-0.4 * s, 0.25 * s); c.lineTo(-0.8 * s, 0.25 * s); c.closePath(); c.fill(); c.beginPath(); c.arc(0, 0, 0.55 * s, -0.8, 0.8); c.stroke(); },
  mute: (c, s) => { ICO.sound(c, s); c.beginPath(); c.moveTo(0.3 * s, -0.5 * s); c.lineTo(0.95 * s, 0.5 * s); c.moveTo(0.95 * s, -0.5 * s); c.lineTo(0.3 * s, 0.5 * s); c.stroke(); },
};
const drawIco = (ctx, key, x, y, s, color) => { const f = ICO[key]; if (!f) return; ctx.save(); ctx.translate(x, y); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, s * 0.17); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; f(ctx, s); ctx.restore(); };
function drawButtonRect(ctx, r, it, wd) {
  const { disabled = false } = wd;
  const { dy, light } = paintButton(ctx, r, wd);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(50,52,80,0.6)' : light ? '#fffaf0' : C.ink;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${it.fs}px ${FONT}`;
  if (wd.ico) {
    const col = ctx.fillStyle, is = Math.min(r.h * 0.2, it.fs * 0.9);
    if (r.w > 300) {   // wide button: glyph left of the label
      const tw = Math.max(...it.lines.map((l) => ctx.measureText(l).width));
      drawIco(ctx, wd.ico, r.x + r.w / 2 - tw / 2 - is - 14, r.y + dy + r.h / 2, is, col);
      const y0 = r.y + dy + (r.h - it.lines.length * it.fs * 1.15) / 2 + it.fs * 0.88;
      it.lines.forEach((l, k) => ctx.fillText(l, r.x + r.w / 2 + (is + 14) / 2, y0 + k * it.fs * 1.15));
    } else {              // narrow: glyph above the label
      const total = it.fs * 1.15 * it.lines.length + is * 2 + 6, t0 = r.y + dy + (r.h - total) / 2;
      drawIco(ctx, wd.ico, r.x + r.w / 2, t0 + is, is, col);
      it.lines.forEach((l, k) => ctx.fillText(l, r.x + r.w / 2, t0 + is * 2 + 6 + it.fs * 0.88 + k * it.fs * 1.15));
    }
    ctx.restore(); return;
  }
  const subLines = wd.sub ? (() => { ctx.font = `400 ${Math.round(it.fs * 0.72)}px ${FONT}`; const l = wrapLines(ctx, wd.sub, r.w - 28); ctx.font = `700 ${it.fs}px ${FONT}`; return l; })() : [];
  const total = it.lines.length * it.fs * 1.15 + subLines.length * it.fs * 0.72;
  let y = r.y + dy + (r.h - total) / 2 + it.fs * 0.88;
  it.lines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 1.15; });
  if (subLines.length) {
    ctx.font = `400 ${Math.round(it.fs * 0.72)}px ${FONT}`; ctx.globalAlpha = 0.85;
    y -= it.fs * 0.2;
    subLines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 0.72; });
    ctx.globalAlpha = 1;
  }
  if (wd.stars) {
    ctx.font = `400 ${Math.round(it.fs * 0.7)}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = light ? '#ffe9a0' : '#c93a2c';
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
