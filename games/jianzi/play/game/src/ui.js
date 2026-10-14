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
// Lacquered buttons: a bevelled slab (lit top edge, dark bottom edge, a brass hairline on the strong ones), a soft contact shadow and a
// pressed state that sinks the slab. No gloss blobs: depth comes from the edges and one vertical gradient.
const BTN_FILL = {
  disabled: { c: ['#cfd0d6', '#b3b6c1'], edge: 'rgba(70,80,100,0.45)', hi: 'rgba(255,255,255,0.35)', lo: 'rgba(60,70,90,0.25)', brass: null },
  primary: { c: ['#f0703f', '#bf3a18'], edge: '#5c1c08', hi: 'rgba(255,226,190,0.65)', lo: 'rgba(70,10,0,0.45)', brass: ['#f7d98a', '#a8782a'] },
  active: { c: ['#3fb29c', '#1f7a69'], edge: '#0e4037', hi: 'rgba(200,255,238,0.5)', lo: 'rgba(0,40,30,0.45)', brass: ['#f7d98a', '#a8782a'] },
  dark: { c: ['#37456e', '#222c4b'], edge: '#0f1428', hi: 'rgba(170,190,255,0.35)', lo: 'rgba(0,0,16,0.5)', brass: ['#d9b866', '#7d5c1e'] },
  plain: { c: ['#fbf4e2', '#e2d3ae'], edge: 'rgba(84,62,30,0.7)', hi: 'rgba(255,255,255,0.9)', lo: 'rgba(120,90,40,0.35)', brass: null },
};
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const F = BTN_FILL[k], rad = Math.min(18, r.h / 2.4);
  const dy = pressed ? 3 : 0;
  ctx.save();
  if (!disabled) { roundPath(ctx, r.x + 1, r.y + (pressed ? 3 : 6), r.w - 2, r.h, rad); ctx.fillStyle = pressed ? 'rgba(8,10,24,0.22)' : 'rgba(8,10,24,0.38)'; ctx.fill(); }
  // body
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad);
  const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h);
  g.addColorStop(0, F.c[0]); g.addColorStop(1, F.c[1]);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // lit top edge and dark bottom edge (the bevel), inside the clip so the corners follow the shape
  ctx.fillStyle = F.hi; ctx.fillRect(r.x, r.y + dy, r.w, 2);
  ctx.fillStyle = F.lo; ctx.fillRect(r.x, r.y + dy + r.h - Math.max(4, r.h * 0.07), r.w, Math.max(4, r.h * 0.07));
  if (pressed) { ctx.fillStyle = 'rgba(8,10,24,0.18)'; ctx.fillRect(r.x, r.y + dy, r.w, r.h); }
  ctx.restore();
  ctx.lineWidth = 1.6; ctx.strokeStyle = F.edge; roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.stroke();
  if (F.brass) {
    const bg = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h); bg.addColorStop(0, F.brass[0]); bg.addColorStop(1, F.brass[1]);
    ctx.lineWidth = 1.5; ctx.strokeStyle = bg; roundPath(ctx, r.x + 3, r.y + dy + 3, r.w - 6, r.h - 6, Math.max(4, rad - 3)); ctx.globalAlpha = 0.85; ctx.stroke();
  }
  ctx.restore();
  return { dy, light: primary || active || dark };
}

// A dark lacquered plaque with a brass rim and four rivets: the HUD cards, the wind strip and the think card.
export function plaque(ctx, x, y, w, h, opts = {}) {
  const { r = Math.min(22, h / 2.2), tone = 'slate', glow = false } = opts;
  ctx.save();
  roundPath(ctx, x, y + 4, w, h, r); ctx.fillStyle = 'rgba(6,8,22,0.4)'; ctx.fill();
  roundPath(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (tone === 'wood') { g.addColorStop(0, '#4a2a1c'); g.addColorStop(1, '#2a160e'); } else { g.addColorStop(0, '#24315a'); g.addColorStop(1, '#141c3a'); }
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // fine grain / lacquer streaks
  ctx.globalAlpha = 0.12; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) { const yy = y + h * (0.15 + i * 0.14); ctx.beginPath(); ctx.moveTo(x, yy); ctx.bezierCurveTo(x + w * 0.3, yy - 3, x + w * 0.6, yy + 3, x + w, yy - 1); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + h - 4, w, 4);
  ctx.restore();
  const bg = ctx.createLinearGradient(0, y, 0, y + h); bg.addColorStop(0, '#f1d58a'); bg.addColorStop(0.5, '#b88a36'); bg.addColorStop(1, '#7d5a1c');
  ctx.lineWidth = 2.5; ctx.strokeStyle = bg; roundPath(ctx, x + 1, y + 1, w - 2, h - 2, r); ctx.stroke();
  if (glow) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,224,138,0.5)'; roundPath(ctx, x - 1, y - 1, w + 2, h + 2, r + 1); ctx.stroke(); }
  if (h > 56 && w > 120) { ctx.fillStyle = '#d9b866'; for (const [rx, ry] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) { ctx.beginPath(); ctx.arc(rx, ry, 2.4, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
}

// A parchment pill. opts: primary (terracotta), active (olive), disabled, sub (small second line), size (font px)
export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28, icon = null } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(40,46,64,0.55)' : light ? '#fffaf0' : C.ink;
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

// Small line icons for the menu buttons (stroke only, one weight), drawn in the button's text colour.
export function glyph(ctx, kind, cx, cy, s, col) {
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(2, s * 0.11); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = s * 0.5;
  const circ = (x, y, rr) => { ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke(); };
  if (kind === 'solo') { circ(0, r * 0.55, r * 0.34); for (const a of [-0.5, -0.17, 0.17, 0.5]) { ctx.beginPath(); ctx.moveTo(Math.sin(a) * r * 0.15, r * 0.2); ctx.quadraticCurveTo(Math.sin(a) * r * 0.9, -r * 0.4, Math.sin(a) * r * 1.1, -r * 0.9); ctx.stroke(); } }
  else if (kind === 'circle') { for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, r * 0.2, 0, Math.PI * 2); ctx.fill(); } circ(0, 0, r * 0.35); }
  else if (kind === 'daily') { circ(0, 0, r * 0.42); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66); ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); ctx.stroke(); } }
  else if (kind === 'watch') { ctx.beginPath(); ctx.moveTo(-r, 0); ctx.quadraticCurveTo(0, -r * 0.95, r, 0); ctx.quadraticCurveTo(0, r * 0.95, -r, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.fill(); }
  else if (kind === 'collection') { ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.8); ctx.quadraticCurveTo(-r * 0.6, -r * 0.6, r * 0.7, -r * 0.85); ctx.quadraticCurveTo(r * 0.8, r * 0.2, -r * 0.7, r * 0.8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.8); ctx.lineTo(r * 0.25, -r * 0.25); ctx.stroke(); }
  else if (kind === 'howto') { circ(0, 0, r * 0.9); ctx.beginPath(); ctx.arc(0, -r * 0.18, r * 0.3, Math.PI, Math.PI * 2.6); ctx.stroke(); ctx.beginPath(); ctx.arc(0, r * 0.52, r * 0.07, 0, Math.PI * 2); ctx.fill(); }
  else if (kind === 'rules') { ctx.strokeRect(-r * 0.7, -r * 0.85, r * 1.4, r * 1.7); for (const y of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.moveTo(-r * 0.4, y * r); ctx.lineTo(r * 0.4, y * r); ctx.stroke(); } }
  else if (kind === 'about') { circ(0, 0, r * 0.9); ctx.beginPath(); ctx.moveTo(0, -r * 0.05); ctx.lineTo(0, r * 0.5); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 0.08, 0, Math.PI * 2); ctx.fill(); }
  else if (kind === 'settings') { circ(0, 0, r * 0.32); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); ctx.stroke(); } circ(0, 0, r * 0.62); }
  else if (kind === 'sound') { ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.25); ctx.lineTo(-r * 0.35, -r * 0.25); ctx.lineTo(r * 0.1, -r * 0.7); ctx.lineTo(r * 0.1, r * 0.7); ctx.lineTo(-r * 0.35, r * 0.25); ctx.lineTo(-r * 0.8, r * 0.25); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(r * 0.1, 0, r * 0.5, -0.9, 0.9); ctx.stroke(); }
  else if (kind === 'mute') { ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.25); ctx.lineTo(-r * 0.35, -r * 0.25); ctx.lineTo(r * 0.1, -r * 0.7); ctx.lineTo(r * 0.1, r * 0.7); ctx.lineTo(-r * 0.35, r * 0.25); ctx.lineTo(-r * 0.8, r * 0.25); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(r * 0.35, -r * 0.35); ctx.lineTo(r * 0.9, r * 0.35); ctx.moveTo(r * 0.9, -r * 0.35); ctx.lineTo(r * 0.35, r * 0.35); ctx.stroke(); }
  ctx.restore();
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 26, fill = C.paper, stroke = 'rgba(70,60,40,0.55)', shadow = true } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 6, w, h, r); ctx.fillStyle = 'rgba(8,10,24,0.38)'; ctx.fill(); }
  roundPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  const bg = ctx.createLinearGradient(0, y, 0, y + h); bg.addColorStop(0, '#f1d58a'); bg.addColorStop(0.5, '#b88a36'); bg.addColorStop(1, '#7d5a1c');
  ctx.lineWidth = 3; ctx.strokeStyle = fill === C.paper ? stroke : bg; ctx.stroke();
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
  ctx.fillStyle = disabled ? 'rgba(40,46,64,0.55)' : light ? '#fffaf0' : C.ink;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${it.fs}px ${FONT}`;
  const subLines = wd.sub ? (() => { ctx.font = `400 ${subSz(it.fs)}px ${FONT}`; const l = wrapLines(ctx, wd.sub, r.w - 28); ctx.font = `700 ${it.fs}px ${FONT}`; return l; })() : [];
  const total = it.lines.length * it.fs * 1.15 + subLines.length * subSz(it.fs);
  let y = r.y + dy + (r.h - total) / 2 + it.fs * 0.88;
  let shift = 0;
  if (wd.icon) {
    const isz = Math.round(it.fs * 1.05), widest = Math.max(...it.lines.map((l) => ctx.measureText(l).width));
    if (widest + isz * 1.9 < r.w - 20) { shift = (isz + 8) / 2; glyph(ctx, wd.icon, r.x + r.w / 2 - widest / 2 - isz * 0.5 - 4 + 0, r.y + dy + r.h / 2 - (subLines.length ? it.fs * 0.2 : 0), isz, light && !disabled ? '#fffaf0' : C.ink); }
  }
  it.lines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2 + shift, y); y += it.fs * 1.15; });
  if (subLines.length) {
    ctx.font = `400 ${subSz(it.fs)}px ${FONT}`; ctx.globalAlpha = 0.85;
    y -= it.fs * 0.2;
    subLines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2 + shift, y); y += subSz(it.fs); });
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
