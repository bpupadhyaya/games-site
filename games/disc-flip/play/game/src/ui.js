// Shared drawing helpers for every screen: rounded panels, buttons, wrapped text and the palette (same structure as the
// other Arcforge games so menus behave the same; the colours are this game's own: felt teal, ivory, brass).
import { gfx } from './v3.js';
export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
export const C = {
  ink: '#0f2a2e', ivory: '#f8f1de', felt: '#0e6a67', brass: '#e3b04a', brassDark: '#7a4a00', coral: '#ff5a3c', cobalt: '#2f7bff', amber: '#ffb11f',
  terra: '#a8250f', terraDark: '#7a1a08', shadow: 'rgba(0,14,16,0.42)', paper: 'rgba(250,246,232,0.96)', teal: '#18a898',
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
// Walnut grain, painted once and used as a canvas pattern for plaques and dark buttons (no DOM in the headless tests: flat colour).
let WOOD = null;
export function woodFill(ctx, base = '#4a2c18') {
  if (!gfx.mk || !ctx.createPattern) return base;
  if (!WOOD) {
    const c = gfx.mk(160, 160); const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, '#5a3720'); g.addColorStop(0.5, '#47291a'); g.addColorStop(1, '#583520'); x.fillStyle = g; x.fillRect(0, 0, 160, 160);
    let sd = 7; const rnd = () => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 70; i++) {
      const y = rnd() * 160; x.strokeStyle = rnd() < 0.5 ? `rgba(20,8,2,${0.18 + rnd() * 0.25})` : `rgba(255,214,160,${0.05 + rnd() * 0.1})`; x.lineWidth = 0.6 + rnd() * 1.8;
      x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(50, y + (rnd() - 0.5) * 10, 110, y + (rnd() - 0.5) * 10, 160, y); x.stroke();
    }
    WOOD = c;
  }
  return ctx.createPattern(WOOD, 'repeat') || base;
}
const BTN = {
  disabled: { g: ['#c9c2b2', '#b2aa98'], edge: 'rgba(40,36,28,0.55)', hi: 0.25, text: 'rgba(60,56,48,0.7)' },
  primary: { g: ['#ffe48a', '#f7b625', '#d98a08'], edge: '#5a3300', hi: 0.7, text: '#2a1700' },
  active: { g: ['#35c796', '#17895f', '#0b5538'], edge: '#04301f', hi: 0.45, text: '#f8f1de' },
  dark: { wood: true, g: ['#5a3720', '#3b2214'], edge: '#190b04', hi: 0.28, text: '#f8f1de' },
  plain: { g: ['#fffdf2', '#f0e5c6', '#d8c79a'], edge: 'rgba(60,40,10,0.6)', hi: 0.9, text: '#0f2a2e' },
};
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const B = BTN[k], dy = pressed ? 3 : 0, rad = Math.min(18, r.h * 0.3), depth = pressed ? 2 : 6;
  ctx.save();
  // the body: an edge slab under, a lit face on top that sinks when pressed
  if (!disabled) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = pressed ? 6 : 14; ctx.shadowOffsetY = pressed ? 2 : 7;
    roundPath(ctx, r.x, r.y + depth, r.w, r.h, rad); ctx.fillStyle = B.edge; ctx.fill();
    ctx.shadowColor = 'transparent';
  }
  const top = r.y + dy, h = r.h - (disabled ? 0 : depth - dy * 0.5);
  roundPath(ctx, r.x, top, r.w, h, rad);
  const g = ctx.createLinearGradient(0, top, 0, top + h);
  B.g.forEach((c, i) => g.addColorStop(i / (B.g.length - 1), c));
  ctx.fillStyle = g; ctx.fill();
  if (B.wood) { roundPath(ctx, r.x, top, r.w, h, rad); ctx.globalAlpha = 0.9; ctx.fillStyle = woodFill(ctx); ctx.fill(); ctx.globalAlpha = 1; roundPath(ctx, r.x, top, r.w, h, rad); const sh = ctx.createLinearGradient(0, top, 0, top + h); sh.addColorStop(0, 'rgba(255,200,140,0.16)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = sh; ctx.fill(); }
  // bevel: lit top edge, shaded bottom edge, one crisp outline
  ctx.save(); roundPath(ctx, r.x, top, r.w, h, rad); ctx.clip();
  ctx.strokeStyle = `rgba(255,255,255,${B.hi})`; ctx.lineWidth = 2.4; roundPath(ctx, r.x + 1.2, top + 1.2, r.w - 2.4, h - 2.4, rad - 1); ctx.stroke();
  const ib = ctx.createLinearGradient(0, top + h * 0.5, 0, top + h); ib.addColorStop(0, 'rgba(0,0,0,0)'); ib.addColorStop(1, 'rgba(0,0,0,0.2)'); ctx.fillStyle = ib; ctx.fillRect(r.x, top + h * 0.5, r.w, h * 0.5);
  if (k === 'dark') { ctx.strokeStyle = 'rgba(232,180,80,0.75)'; ctx.lineWidth = 1.6; roundPath(ctx, r.x + 4, top + 4, r.w - 8, h - 8, rad - 3); ctx.stroke(); }
  if (pressed) { ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(r.x, top, r.w, h); }
  ctx.restore();
  ctx.lineWidth = 1.5; ctx.strokeStyle = B.edge; roundPath(ctx, r.x, top, r.w, h, rad); ctx.stroke();
  ctx.restore();
  return { dy: dy - (disabled ? 0 : 2), light: k === 'active' || k === 'dark', ink: B.text };
}

// A parchment pill. opts: primary (terracotta), active (olive), disabled, sub (small second line), size (font px)
export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28, icon = null } = opts;
  const { dy, light, ink } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = ink ?? (disabled ? 'rgba(50,52,80,0.6)' : light ? '#f8f1de' : C.ink);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = sub ? Math.round(size * 0.9) : size;
  const maxW = r.w - (icon ? 84 : 24);
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > maxW && px > 13) { px -= 1; ctx.font = `700 ${px}px ${FONT}`; }
  const cx = r.x + r.w / 2 + (icon ? 24 : 0);
  ctx.fillText(label, cx, r.y + dy + r.h / 2 - (sub ? 11 : 0));
  if (sub) { ctx.font = `400 ${Math.round(size * 0.62)}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, cx, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1; }
  if (icon) icon(ctx, r.x + 32, r.y + dy + r.h / 2, light && !disabled ? '#f8f1de' : C.ink);
  ctx.restore();
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 26, fill = C.paper, stroke = 'rgba(25,60,60,0.55)', shadow = true } = opts;
  ctx.save();
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; }
  roundPath(ctx, x, y, w, h, r); ctx.fillStyle = woodFill(ctx); ctx.fill();
  ctx.shadowColor = 'transparent';
  roundPath(ctx, x, y, w, h, r); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,214,160,0.18)'); g.addColorStop(0.15, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)'); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#170a03'; roundPath(ctx, x, y, w, h, r); ctx.stroke();
  // the inset: a recessed field with a thin brass keyline round it
  const ins = Math.min(12, Math.max(7, r * 0.4));
  roundPath(ctx, x + ins, y + ins, w - 2 * ins, h - 2 * ins, Math.max(6, r - ins * 0.6));
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(230,184,92,0.85)'; ctx.stroke();
  roundPath(ctx, x + ins + 2, y + ins + 2, w - 2 * ins - 4, h - 2 * ins - 4, Math.max(5, r - ins * 0.6 - 2));
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
export function textShadow(ctx, text, x, y, fill = '#f8f1de', blur = 4) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,12,14,0.7)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
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
        const h = Math.max(g.h ?? 76, lines.length * fs * 1.15 + sub * fs * 0.72 + 34);
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
      ctx.fillStyle = wd.color ?? '#f8f1de'; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#f8f1de', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(255,248,232,0.96)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(0,12,14,0.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
    } else if (wd.t === 'btn') {
      drawButtonRect(ctx, { x: it.x, y, w: it.wd, h: it.h }, it, wd);
    }
  }
  ctx.restore();
}
function drawButtonRect(ctx, r, it, wd) {
  const { disabled = false } = wd;
  const { dy, light, ink } = paintButton(ctx, r, wd);
  ctx.save();
  ctx.fillStyle = ink ?? (disabled ? 'rgba(50,52,80,0.6)' : light ? '#f8f1de' : C.ink);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${it.fs}px ${FONT}`;
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
    ctx.font = `400 ${Math.round(it.fs * 0.7)}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = light ? '#ffe9a0' : '#a8250f';
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
