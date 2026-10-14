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
  ink: '#1c2536', cream: '#f4ecd8', sand: '#dfd2b0', terra: '#d9542a', terraDark: '#7d2a12', olive: '#2a8f80', lav: '#5a4a9c', sky: '#3a7fb0',
  gold: '#ecbc4a', shadow: 'rgba(12,16,32,0.4)', paper: 'rgba(246,239,222,0.96)', deep: '#18203a',
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
// Burmese lacquerware (yun): red and black lacquer with gold-leaf edges. Every button is a lacquered plate with a gold rim, a lit top
// edge, a dark bottom edge and a cast shadow; pressed = it sinks and darkens. (The same look the panels use.)
const BTN_FILL = {
  disabled: ['#6c6a68', '#4c4a49', '#8c8886', '#3a3836'],
  primary: ['#e24a2a', '#b3200f', '#ffc977', '#5a0c06'],
  active: ['#2fa58a', '#176e5c', '#9fe8c8', '#0a3a30'],
  dark: ['#3a2a28', '#1c1210', '#d9b56a', '#080504'],
  plain: ['#5b3a20', '#3a2210', '#e7c27a', '#1c0e06'],
};
const GOLD = ['#fff0b0', '#e8b84a', '#9a6a1a'];
export function lacquerPlate(ctx, x, y, w, h, r, k = 'dark', pressed = false) {
  const [c0, c1, rim, deep] = BTN_FILL[k];
  const dy = pressed ? 3 : 0;
  ctx.save();
  if (k !== 'disabled') { roundPath(ctx, x, y + (pressed ? 2 : 5), w, h, r); ctx.fillStyle = 'rgba(6,4,2,0.45)'; ctx.fill(); }
  // body: lacquer gradient with a soft broad sheen on the upper third (a single gradient, no extra shapes)
  roundPath(ctx, x, y + dy, w, h, r);
  const g = ctx.createLinearGradient(0, y + dy, 0, y + dy + h);
  g.addColorStop(0, c0); g.addColorStop(0.48, c0); g.addColorStop(0.5, c1); g.addColorStop(1, deep);
  ctx.fillStyle = g; ctx.fill();
  if (pressed) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill(); }
  // gold-leaf rim: bright on the lit top edge, deep brass underneath
  const rg = ctx.createLinearGradient(0, y + dy, 0, y + dy + h);
  rg.addColorStop(0, rim); rg.addColorStop(0.5, rim); rg.addColorStop(1, GOLD[2]);
  ctx.lineWidth = 2.5; ctx.strokeStyle = rg; ctx.stroke();
  // fine inner line: the lacquer inlay
  roundPath(ctx, x + 6, y + dy + 6, w - 12, h - 12, Math.max(4, r - 6));
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,226,150,0.28)'; ctx.stroke();
  ctx.restore();
  return dy;
}
// Small gold line glyphs for the menu buttons (all drawn from paths: no assets).
export function glyph(ctx, kind, x, y, s, col = '#f3c957') {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(2, s * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const h = s / 2;
  ctx.beginPath();
  if (kind === 'dance') { ctx.arc(0, 0, h * 0.8, 0, 6.2832); ctx.moveTo(-h * 0.8, 0); ctx.quadraticCurveTo(0, -h * 0.5, h * 0.8, 0); ctx.moveTo(-h * 0.5, h * 0.6); ctx.quadraticCurveTo(0, h * 0.1, h * 0.5, h * 0.6); ctx.stroke(); }
  else if (kind === 'daily') { ctx.arc(0, 0, h * 0.42, 0, 6.2832); for (let i = 0; i < 8; i++) { const a = i * 0.7854; ctx.moveTo(Math.cos(a) * h * 0.65, Math.sin(a) * h * 0.65); ctx.lineTo(Math.cos(a) * h * 0.95, Math.sin(a) * h * 0.95); } ctx.stroke(); }
  else if (kind === 'watch') { ctx.moveTo(-h, 0); ctx.quadraticCurveTo(0, -h * 1.1, h, 0); ctx.quadraticCurveTo(0, h * 1.1, -h, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, h * 0.32, 0, 6.2832); ctx.fill(); }
  else if (kind === 'moves') { ctx.rect(-h * 0.75, -h * 0.85, h * 1.5, h * 1.7); ctx.moveTo(-h * 0.35, -h * 0.35); ctx.lineTo(h * 0.35, -h * 0.35); ctx.moveTo(-h * 0.35, 0); ctx.lineTo(h * 0.35, 0); ctx.moveTo(-h * 0.35, h * 0.35); ctx.lineTo(h * 0.1, h * 0.35); ctx.stroke(); }
  else if (kind === 'howto') { ctx.arc(0, 0, h * 0.9, 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -h * 0.2, h * 0.3, Math.PI, 0.35); ctx.quadraticCurveTo(h * 0.1, h * 0.15, 0, h * 0.28); ctx.stroke(); ctx.beginPath(); ctx.arc(0, h * 0.55, h * 0.07, 0, 6.2832); ctx.fill(); }
  else if (kind === 'rules') { ctx.moveTo(-h * 0.7, -h * 0.8); ctx.lineTo(h * 0.7, -h * 0.8); ctx.lineTo(h * 0.7, h * 0.8); ctx.lineTo(-h * 0.7, h * 0.8); ctx.closePath(); ctx.moveTo(-h * 0.35, -h * 0.3); ctx.lineTo(h * 0.35, -h * 0.3); ctx.moveTo(-h * 0.35, h * 0.1); ctx.lineTo(h * 0.35, h * 0.1); ctx.moveTo(-h * 0.35, h * 0.5); ctx.lineTo(0, h * 0.5); ctx.stroke(); }
  else if (kind === 'about') { ctx.arc(0, 0, h * 0.9, 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -h * 0.05); ctx.lineTo(0, h * 0.5); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -h * 0.42, h * 0.09, 0, 6.2832); ctx.fill(); }
  else if (kind === 'settings') { ctx.arc(0, 0, h * 0.34, 0, 6.2832); for (let i = 0; i < 8; i++) { const a = i * 0.7854; ctx.moveTo(Math.cos(a) * h * 0.62, Math.sin(a) * h * 0.62); ctx.lineTo(Math.cos(a) * h * 0.92, Math.sin(a) * h * 0.92); } ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, h * 0.62, 0, 6.2832); ctx.stroke(); }
  else if (kind === 'sound' || kind === 'mute') { ctx.moveTo(-h * 0.8, -h * 0.3); ctx.lineTo(-h * 0.35, -h * 0.3); ctx.lineTo(h * 0.15, -h * 0.75); ctx.lineTo(h * 0.15, h * 0.75); ctx.lineTo(-h * 0.35, h * 0.3); ctx.lineTo(-h * 0.8, h * 0.3); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); if (kind === 'sound') { ctx.arc(h * 0.15, 0, h * 0.5, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(h * 0.15, 0, h * 0.85, -0.9, 0.9); ctx.stroke(); } else { ctx.moveTo(h * 0.45, -h * 0.4); ctx.lineTo(h * 0.95, h * 0.4); ctx.moveTo(h * 0.95, -h * 0.4); ctx.lineTo(h * 0.45, h * 0.4); ctx.stroke(); } }
  else { ctx.arc(0, 0, h * 0.5, 0, 6.2832); ctx.stroke(); }
  ctx.restore();
}
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const dy = lacquerPlate(ctx, r.x, r.y, r.w, r.h, Math.min(18, r.h * 0.3), k, pressed);
  return { dy, light: true };
}

// A parchment pill. opts: primary (terracotta), active (olive), disabled, sub (small second line), size (font px)
export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28, icon = null } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(226,218,206,0.6)' : '#fff3d2';
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
  const { r = 26, fill = C.paper, shadow = true } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 8, w, h, r); ctx.fillStyle = 'rgba(6,4,2,0.5)'; ctx.fill(); }
  // lacquered board: gold-leaf frame (outer), the lacquer field, a fine inner line and four brass rivets
  roundPath(ctx, x, y, w, h, r);
  const fg = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  fg.addColorStop(0, '#fff0b0'); fg.addColorStop(0.45, '#d9a43c'); fg.addColorStop(1, '#8a5a14');
  ctx.fillStyle = fg; ctx.fill();
  roundPath(ctx, x + 6, y + 6, w - 12, h - 12, Math.max(6, r - 5));
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(70,40,10,0.65)'; ctx.stroke();
  roundPath(ctx, x + 13, y + 13, w - 26, h - 26, Math.max(4, r - 12));
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(214,168,70,0.55)'; ctx.stroke();
  for (const [rx, ry] of [[x + 17, y + 17], [x + w - 17, y + 17], [x + 17, y + h - 17], [x + w - 17, y + h - 17]]) {
    const rg = ctx.createRadialGradient(rx - 1.5, ry - 1.5, 0.5, rx, ry, 5);
    rg.addColorStop(0, '#fff3c0'); rg.addColorStop(0.6, '#c8902e'); rg.addColorStop(1, '#5a3a0a');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(rx, ry, 4.5, 0, 6.2832); ctx.fill();
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
  ctx.shadowColor = 'rgba(8,10,24,0.7)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
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
      ctx.fillStyle = wd.color ?? '#fff6e0'; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#fff6e0', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(255,246,224,0.95)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(8,10,24,0.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
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
  ctx.fillStyle = disabled ? 'rgba(226,218,206,0.6)' : '#fff3d2';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${it.fs}px ${FONT}`;
  if (wd.icon && r.w > it.fs * 4.5) { const isz = Math.min(r.h * 0.46, it.fs * 1.15); glyph(ctx, wd.icon, r.x + 20 + isz / 2, r.y + dy + r.h / 2, isz, disabled ? 'rgba(226,218,206,0.5)' : '#f3c957'); r = { ...r, x: r.x + isz * 0.55, w: r.w - isz * 0.55 }; }
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
