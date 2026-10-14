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
  ink: '#10243a', cream: '#f4f9ff', sand: '#d3e4f2', terra: '#1c6fc0', terraDark: '#0a2f5a', olive: '#1f9078', lav: '#5a4a9c', sky: '#3a7fb0',
  gold: '#ffcf5a', shadow: 'rgba(4,12,26,0.4)', paper: 'rgba(244,249,255,0.97)', deep: '#0e2238',
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
// Lacquered buttons: a rounded body with a clear-coat highlight on the top half, a brass-coloured bevel rim and a dark under-edge,
// like painted wood. Primary = red lacquer (the log paint), active = green, dark = deep navy, plain = ivory-blue enamel.
// Lacquered buttons: a rounded body with a clear-coat highlight on the top half, a brass-coloured bevel rim and a dark under-edge,
// like painted wood. Primary = red lacquer (the log paint), active = green, dark = deep navy, plain = navy enamel with a brass rim.
const BTN_FILL = {
  disabled: ['#8d93a0', '#6f7683', '#4c5260', '#9aa0ab'],
  primary: ['#ff7a4a', '#d9381f', '#7e170c', '#ffd98a'],
  active: ['#4fe0b0', '#1f9a7c', '#0c4c40', '#d8ffe8'],
  dark: ['#3d5f82', '#1d3552', '#0b1a2c', '#8fb4d8'],
  plain: ['#34506f', '#1b3350', '#0a1828', '#e3c27a'],
};
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const [c0, c1, c2, rim] = BTN_FILL[k];
  const dy = pressed ? 3 : 0, rad = Math.min(18, r.h / 2.2);
  ctx.save();
  if (!disabled) { roundPath(ctx, r.x, r.y + (pressed ? 2 : 5), r.w, r.h, rad); ctx.fillStyle = pressed ? 'rgba(2,8,18,0.3)' : 'rgba(2,8,18,0.5)'; ctx.fill(); }
  const y = r.y + dy;
  roundPath(ctx, r.x, y, r.w, r.h, rad);
  const gr = ctx.createLinearGradient(0, y, 0, y + r.h); gr.addColorStop(0, rim); gr.addColorStop(0.5, 'rgba(0,0,0,0.0)'); gr.addColorStop(1, c2);
  ctx.fillStyle = c2; ctx.fill(); ctx.fillStyle = gr; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
  const ins = 2.5;
  roundPath(ctx, r.x + ins, y + ins, r.w - 2 * ins, r.h - 2 * ins - 1.5, Math.max(4, rad - ins));
  const g = ctx.createLinearGradient(0, y, 0, y + r.h); g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); roundPath(ctx, r.x + ins, y + ins, r.w - 2 * ins, r.h - 2 * ins - 1.5, Math.max(4, rad - ins)); ctx.clip();
  const hg = ctx.createLinearGradient(0, y, 0, y + r.h * 0.5); hg.addColorStop(0, 'rgba(255,255,255,0.34)'); hg.addColorStop(1, 'rgba(255,255,255,0.03)');
  ctx.fillStyle = hg; ctx.fillRect(r.x, y, r.w, r.h * 0.5);
  const bg = ctx.createLinearGradient(0, y + r.h * 0.75, 0, y + r.h); bg.addColorStop(0, 'rgba(255,255,255,0)'); bg.addColorStop(1, 'rgba(255,255,255,0.12)');
  ctx.fillStyle = bg; ctx.fillRect(r.x, y + r.h * 0.75, r.w, r.h * 0.25);
  if (pressed) { ctx.fillStyle = 'rgba(4,12,26,0.22)'; ctx.fillRect(r.x, y, r.w, r.h); }
  ctx.restore();
  ctx.restore();
  return { dy, light: true };
}

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

// A brass-edged slate plaque used by the HUD chips, bars, pad and panels.
export function plaque(ctx, x, y, w, h, o = {}) {
  const r = o.r ?? Math.min(20, h / 2), fill = o.fill ?? ['#1d3652', '#0c1b2e'], rim = o.rim ?? ['#f0d28a', '#7a5a22'];
  ctx.save();
  if (o.shadow !== false) { roundPath(ctx, x, y + 4, w, h, r); ctx.fillStyle = 'rgba(2,8,18,0.42)'; ctx.fill(); }
  roundPath(ctx, x, y, w, h, r);
  const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, rim[0]); gr.addColorStop(1, rim[1]); ctx.fillStyle = gr; ctx.fill();
  const t = Math.min(3, h / 8);
  roundPath(ctx, x + t, y + t, w - 2 * t, h - 2 * t, Math.max(3, r - t));
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, fill[0]); g.addColorStop(1, fill[1]);
  ctx.globalAlpha = o.alpha ?? 0.92; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
  ctx.save(); roundPath(ctx, x + t, y + t, w - 2 * t, h - 2 * t, Math.max(3, r - t)); ctx.clip();
  const hg = ctx.createLinearGradient(0, y, 0, y + h * 0.45); hg.addColorStop(0, 'rgba(255,255,255,0.16)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg; ctx.fillRect(x, y, w, h * 0.45);
  ctx.restore();
  ctx.restore();
}
export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 26, fill = C.paper, stroke = 'rgba(40,60,80,0.55)', shadow = true } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 6, w, h, r); ctx.fillStyle = 'rgba(4,12,26,0.38)'; ctx.fill(); }
  roundPath(ctx, x - 3, y - 3, w + 6, h + 6, r + 3);
  const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#f0d28a'); gr.addColorStop(1, '#7a5a22'); ctx.fillStyle = gr; ctx.fill();
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
      ctx.fillStyle = wd.color ?? '#ffffff'; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#ffffff', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(240,248,255,0.97)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
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
