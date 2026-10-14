// Shared drawing helpers for every screen: rounded panels, flat buttons, wrapped text, the palette.
import { live, MIN_FONT } from './layout.js';
const subFs = (fs) => Math.max(MIN_FONT, Math.round(fs * 0.74));
export const FONT = "'Avenir Next', 'Segoe UI', 'Trebuchet MS', system-ui, sans-serif";
export const DISPLAY = "'Avenir Next Condensed', 'Arial Narrow', 'Trebuchet MS', system-ui, sans-serif";
export const C = {
  ink: '#16233a', cream: '#f4f8ff', snow: '#dbe9f7', sled: '#e0683a', sledDark: '#9a3a1a', teal: '#2a9d8f', tealDark: '#1b6b62', indigo: '#26346b',
  gold: '#ffcf5a', shadow: 'rgba(8,14,34,0.4)', paper: 'rgba(244,248,255,0.97)', mute: 'rgba(235,244,255,0.74)',
};

export function roundPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// One flat button look for the whole game: a solid fill, ONE crisp border, a soft drop shadow and a
// pressed state (the button sinks 3 px and darkens while a finger that started on it is down).
const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
// Premium Nordic-expedition chrome: slate lacquer with a bevelled ice rim, copper and teal lacquer for the actions. Raised, with a lip
// that sinks on press. Everything on the play screen and in the menus is built from plaque() and paintButton().
const TONES = {
  slate:  { top: '#33487a', bot: '#1a2750', rim: ['#d8ecff', '#5f86c6'], lip: '#0b1330', a: 0.92 },
  ink:    { top: '#1f2d57', bot: '#0d1630', rim: ['#a9c8ee', '#3f5f9a'], lip: '#060b1c', a: 0.94 },
  copper: { top: '#ffa464', bot: '#c9501f', rim: ['#ffe2c0', '#9a3a12'], lip: '#6a2208', a: 1 },
  teal:   { top: '#43d1bd', bot: '#1c7a6e', rim: ['#c8fff2', '#0f5a50'], lip: '#093c35', a: 1 },
  sel:    { top: '#4d78c8', bot: '#26427e', rim: ['#ffe9a0', '#c8962a'], lip: '#0b1330', a: 0.96 },
  ghost:  { top: '#8a93ad', bot: '#5d6684', rim: ['#d0d6e6', '#7a84a2'], lip: '#2a3046', a: 0.45 },
};
export function plaque(ctx, x, y, w, h, o = {}) {
  const T = TONES[o.tone || 'slate'] || TONES.slate, r = Math.min(o.r ?? 18, h / 2, w / 2), lip = o.flat ? 0 : (o.lip ?? Math.min(6, h * 0.1)), dy = o.dy || 0;
  ctx.save();
  ctx.globalAlpha *= T.a * (o.alpha ?? 1);
  if (!o.noShadow) {
    roundPath(ctx, x, y + lip + 3 + dy, w, h, r); ctx.fillStyle = 'rgba(4,8,22,0.38)'; ctx.fill();
  }
  // lip (the thick edge under the face)
  if (lip) { roundPath(ctx, x, y + lip + dy, w, h, r); ctx.fillStyle = T.lip; ctx.fill(); }
  // face
  const hh = h - (o.noShadow ? 0 : 0);
  const g = ctx.createLinearGradient(0, y + dy, 0, y + dy + hh);
  g.addColorStop(0, T.top); g.addColorStop(1, T.bot);
  roundPath(ctx, x, y + dy, w, hh, r); ctx.fillStyle = g; ctx.fill();
  // bevel: bright top edge, dark bottom edge, then the rim
  ctx.save(); roundPath(ctx, x, y + dy, w, hh, r); ctx.clip();
  const hl = ctx.createLinearGradient(0, y + dy, 0, y + dy + hh * 0.5); hl.addColorStop(0, 'rgba(255,255,255,0.20)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(x, y + dy, w, hh * 0.5);
  const sh = ctx.createLinearGradient(0, y + dy + hh * 0.6, 0, y + dy + hh); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = sh; ctx.fillRect(x, y + dy + hh * 0.6, w, hh * 0.4);
  ctx.restore();
  const rg = ctx.createLinearGradient(x, y + dy, x + w * 0.4, y + dy + hh);
  rg.addColorStop(0, T.rim[0]); rg.addColorStop(1, T.rim[1]);
  roundPath(ctx, x + 1, y + dy + 1, w - 2, hh - 2, Math.max(2, r - 1)); ctx.lineWidth = o.rimW ?? 1.8; ctx.strokeStyle = rg; ctx.globalAlpha *= 0.9; ctx.stroke();
  ctx.restore();
}

const BTN_TONE = { disabled: 'ghost', primary: 'copper', active: 'teal', dark: 'ink', plain: 'slate' };
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const dy = pressed ? 4 : 0;
  plaque(ctx, r.x, r.y, r.w, r.h - 6, { tone: BTN_TONE[k], r: 18, dy, lip: pressed ? 2 : 6, noShadow: disabled || pressed });
  if (pressed) { ctx.save(); roundPath(ctx, r.x, r.y + dy, r.w, r.h - 6, 18); ctx.fillStyle = 'rgba(6,12,30,0.18)'; ctx.fill(); ctx.restore(); }
  return { dy: dy - 2, light: true };
}

// A flat pill. opts: primary (vermilion), active (teal), disabled, sub (small second line), size (font px)
export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28, icon = null } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(235,238,255,0.55)' : light ? '#ffffff' : C.ink;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = sub ? Math.round(size * 0.9) : size;
  const maxW = r.w - (icon ? 84 : 24);
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > maxW && px > MIN_FONT) { px -= 1; ctx.font = `700 ${px}px ${FONT}`; }
  const cx = r.x + r.w / 2 + (icon ? 24 : 0);
  ctx.fillText(label, cx, r.y + dy + r.h / 2 - (sub ? size * 0.45 : 0));
  if (sub) {
    let sp = Math.max(MIN_FONT, Math.round(size * 0.62));
    ctx.font = `400 ${sp}px ${FONT}`;
    while (ctx.measureText(sub).width > r.w - 24 && sp > MIN_FONT) { sp -= 1; ctx.font = `400 ${sp}px ${FONT}`; }
    ctx.globalAlpha = 0.85; ctx.fillText(sub, cx, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1;
  }
  if (icon) icon(ctx, r.x + 32, r.y + dy + r.h / 2, light && !disabled ? '#fffaf0' : C.ink);
  ctx.restore();
}

// The largest font size (<= px) at which `text` fits in maxW (never below min).
export function fitPx(ctx, text, weight, px, maxW, min = MIN_FONT) {
  ctx.font = `${weight} 100px ${FONT}`;
  const per = ctx.measureText(String(text)).width / 100 || 0.001;
  return Math.max(min, Math.min(px, Math.floor(maxW / per)));
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 26, fill = C.paper, shadow = true } = opts;
  if (typeof fill === 'string' && fill.startsWith('rgba(244')) {
    // the paper reader panel: warm white card with a soft edge
    ctx.save();
    if (shadow) { roundPath(ctx, x, y + 6, w, h, r); ctx.fillStyle = 'rgba(6,12,30,0.38)'; ctx.fill(); }
    roundPath(ctx, x, y, w, h, r);
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#fbfdff'); g.addColorStop(1, '#e8f0fb');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(95,134,198,0.85)'; ctx.stroke();
    ctx.restore();
    return;
  }
  plaque(ctx, x, y, w, h - 6, { tone: 'ink', r, lip: 6 });
}

export function wrapLines(ctx, text, maxW) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  const push = (w) => {
    // a single word wider than the line (a web address) is broken into pieces so it can never run off the panel
    while (ctx.measureText(w).width > maxW && w.length > 1) {
      let n = w.length; while (n > 1 && ctx.measureText(w.slice(0, n)).width > maxW) n--;
      if (line) { lines.push(line); line = ''; }
      lines.push(w.slice(0, n)); w = w.slice(n);
    }
    return w;
  };
  for (let word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW) {
      if (line) { lines.push(line); line = ''; }
      word = push(word); line = word;
    } else line = next;
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
export function textShadow(ctx, text, x, y, fill = '#f4f8ff', blur = 4) {
  ctx.save();
  ctx.shadowColor = 'rgba(6,12,30,0.7)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
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
        ctx.font = `400 ${subFs(fs)}px ${FONT}`; const sub = g.sub ? wrapLines(ctx, g.sub, cw - 28).length : 0; ctx.font = `700 ${fs}px ${FONT}`;
        const h = Math.max(g.h ?? 76, lines.length * fs * 1.15 + sub * subFs(fs) * 1.05 + 34);
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
      const fs = Math.max(MIN_FONT, Math.round((wd.size ?? 26) * Math.min(scale, wd.cap ?? 3)));
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
      ctx.font = `400 ${subFs(fs)}px ${FONT}`; const sub = wd.sub ? wrapLines(ctx, wd.sub, w0 - 28).length : 0; ctx.font = `700 ${fs}px ${FONT}`;
      const h = Math.max(wd.h ?? 84, lines.length * fs * 1.15 + sub * subFs(fs) * 1.05 + 34);
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
    }
  }
  return { items: out, contentH: y };
}

export function drawFlow(ctx, lay, top, bottom, scroll, o = {}) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, top, live.w, bottom - top); ctx.clip();
  for (const it of lay.items) {
    const y = top + it.y - scroll;
    if (y > bottom || y + it.h < top) continue;
    const wd = it.w;
    if (wd.t === 'art') { ctx.save(); ctx.translate(it.x, y); wd.draw(ctx, it.wd, it.h); ctx.restore(); }
    else if (wd.t === 'h') {
      ctx.fillStyle = wd.color ?? '#f4f8ff'; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#f4f8ff', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(244,248,255,0.96)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(6,12,30,0.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
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
  ctx.fillStyle = disabled ? 'rgba(235,238,255,0.55)' : light ? '#ffffff' : C.ink;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${it.fs}px ${FONT}`;
  const subLines = wd.sub ? (() => { ctx.font = `400 ${subFs(it.fs)}px ${FONT}`; const l = wrapLines(ctx, wd.sub, r.w - 28); ctx.font = `700 ${it.fs}px ${FONT}`; return l; })() : [];
  const total = it.lines.length * it.fs * 1.15 + subLines.length * subFs(it.fs) * 1.05;
  let y = r.y + dy + (r.h - total) / 2 + it.fs * 0.88;
  it.lines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 1.15; });
  if (subLines.length) {
    ctx.font = `400 ${subFs(it.fs)}px ${FONT}`; ctx.globalAlpha = 0.85;
    y -= it.fs * 0.2;
    subLines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += subFs(it.fs) * 1.05; });
    ctx.globalAlpha = 1;
  }
  if (wd.stars) {
    ctx.font = `400 ${Math.max(MIN_FONT, Math.round(it.fs * 0.7))}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = light ? '#ffe9a0' : '#b0381a';
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
