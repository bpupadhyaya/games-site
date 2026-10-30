// Shared drawing helpers for every screen: rounded panels, flat buttons, wrapped text, the palette.
import { live, MIN_FONT } from './layout.js';
const subFs = (fs) => Math.max(MIN_FONT, Math.round(fs * 0.74));
export const FONT = "'Avenir Next', 'Segoe UI', 'Trebuchet MS', system-ui, sans-serif";
export const DISPLAY = "Georgia, 'Times New Roman', serif";
export const C = {
  ink: '#2a1a12', cream: '#fff6e4', sand: '#f3dfb8', vermilion: '#d4501e', vermDark: '#8f2f0f', teal: '#1d7f86', tealDark: '#135a60', indigo: '#2b2f5e',
  gold: '#ffc94d', shadow: 'rgba(24,12,4,0.4)', paper: 'rgba(255,246,228,0.96)', mute: 'rgba(255,246,228,0.72)',
};

export function roundPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Premium chrome: carved walnut plaques with a brass rim, lacquered buttons that sit on a visible lip and sink when pressed.
// (no offscreen pattern canvas: src stays DOM-free; the grain is a few strokes drawn inside the plaque)
const woodPattern = () => false;
function grain(ctx, x, y, w, h) {
  ctx.save(); ctx.clip();
  for (let i = 0; i < 7; i++) {
    const yy = y + ((i * 0.37 + 0.11) % 1) * h, k = Math.sin(i * 12.9898) * 0.5 + 0.5;
    ctx.strokeStyle = k > 0.5 ? 'rgba(255,214,150,0.07)' : 'rgba(10,4,0,0.17)'; ctx.lineWidth = 1 + k * 1.6;
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.bezierCurveTo(x + w * 0.3, yy + (k - 0.5) * 6, x + w * 0.7, yy - (k - 0.5) * 6, x + w, yy + (k - 0.5) * 4); ctx.stroke();
  }
  ctx.restore();
}
const BRASS = ['#f3d98a', '#b88a2c'];
// A carved plaque (the scoreboard, the grip bar frame, the plan strip frame, the note boxes). tone: 'wood' | 'slate'
export function plaque(ctx, x, y, w, h, o = {}) {
  const { r = Math.min(24, h / 2), tone = 'wood', rim = true, shadow = true, alpha = 1 } = o;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (shadow) { roundPath(ctx, x + 1, y + 6, w, h, r); ctx.fillStyle = 'rgba(8,4,0,0.34)'; ctx.fill(); }
  roundPath(ctx, x, y, w, h, r);
  if (tone === 'slate') { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#26352f'); g.addColorStop(1, '#16221d'); ctx.fillStyle = g; }
  else { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#4f3624'); g.addColorStop(1, '#2c1d13'); ctx.fillStyle = g; }
  ctx.fill();
  if (tone !== 'slate') grain(ctx, x, y, w, h);
  // lit top edge, shaded bottom edge (a bevel, not a gloss)
  roundPath(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(2, r - 2));
  const lg = ctx.createLinearGradient(0, y, 0, y + h); lg.addColorStop(0, 'rgba(255,226,170,0.34)'); lg.addColorStop(0.18, 'rgba(255,226,170,0.0)'); lg.addColorStop(0.82, 'rgba(0,0,0,0.0)'); lg.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.lineWidth = 2; ctx.strokeStyle = lg; ctx.stroke();
  if (rim) {
    roundPath(ctx, x, y, w, h, r);
    const bg = ctx.createLinearGradient(x, y, x, y + h); bg.addColorStop(0, BRASS[0]); bg.addColorStop(1, BRASS[1]);
    ctx.lineWidth = 2.5; ctx.strokeStyle = bg; ctx.stroke();
  }
  ctx.restore();
}
const BTN = {
  disabled: { top: '#6a6f7d', bot: '#4c505c', lip: '#33363f', rim: ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.15)'] },
  primary: { top: '#ffd96b', bot: '#e3a523', lip: '#8a5a0a', rim: ['#fff3c4', '#b8862a'] },
  active: { top: '#2fa8ae', bot: '#146b72', lip: '#0b4146', rim: ['#c6f3f1', '#5fc0c4'] },
  dark: { top: '#4b3524', bot: '#2c1e14', lip: '#150d08', rim: BRASS },
  plain: { top: '#fffaee', bot: '#efdbae', lip: '#a77f45', rim: ['#c79a52', '#8c6630'] },
};
const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const B = BTN[k], rad = Math.min(20, r.h / 2), lip = Math.min(6, r.h * 0.09), dy = pressed ? lip - 2 : 0;
  ctx.save();
  if (!disabled) { roundPath(ctx, r.x + 1, r.y + 7 - dy * 0.5, r.w, r.h, rad); ctx.fillStyle = 'rgba(8,4,0,0.36)'; ctx.fill(); }
  // the lip (the button's thickness) and the face on top of it
  roundPath(ctx, r.x, r.y + lip, r.w, r.h - lip, rad); ctx.fillStyle = B.lip; ctx.fill();
  const fy = r.y + dy, fh = r.h - lip;
  roundPath(ctx, r.x, fy, r.w, fh, rad);
  { const g = ctx.createLinearGradient(0, fy, 0, fy + fh); g.addColorStop(0, B.top); g.addColorStop(1, B.bot); ctx.fillStyle = g; }
  ctx.fill();
  if (k === 'dark') grain(ctx, r.x, fy, r.w, fh);
  if (pressed) { ctx.fillStyle = 'rgba(20,8,0,0.18)'; ctx.fill(); }
  // bevel: a lit top edge and a shaded lower edge just inside the rim
  roundPath(ctx, r.x + 2.5, fy + 2.5, r.w - 5, fh - 5, Math.max(2, rad - 2.5));
  const bg = ctx.createLinearGradient(0, fy, 0, fy + fh); bg.addColorStop(0, 'rgba(255,255,255,0.55)'); bg.addColorStop(0.3, 'rgba(255,255,255,0)'); bg.addColorStop(0.75, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.lineWidth = 2; ctx.strokeStyle = bg; ctx.stroke();
  roundPath(ctx, r.x, fy, r.w, fh, rad);
  const rg = ctx.createLinearGradient(0, fy, 0, fy + fh); rg.addColorStop(0, B.rim[0]); rg.addColorStop(1, B.rim[1]);
  ctx.lineWidth = 2.2; ctx.strokeStyle = rg; ctx.stroke();
  ctx.restore();
  return { dy, light: active || dark };
}

// A flat pill. opts: primary (vermilion), active (teal), disabled, sub (small second line), size (font px)
export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28, icon = null } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(235,238,255,0.55)' : light ? '#fffaf0' : C.ink;
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
  const { r = 26, fill = C.paper, stroke = 'rgba(28,37,82,0.5)', shadow = true } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 6, w, h, r); ctx.fillStyle = 'rgba(20,8,0,0.38)'; ctx.fill(); }
  roundPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke();
  // a fine inner line so the paper sheets read as cards with an edge, not flat boxes
  roundPath(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(2, r - 5)); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(120,84,40,0.28)'; ctx.stroke();
  ctx.restore();
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
export function textShadow(ctx, text, x, y, fill = '#fff6e2', blur = 4) {
  ctx.save();
  ctx.shadowColor = 'rgba(20,8,0,0.7)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
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
      ctx.fillStyle = wd.color ?? '#fff6e4'; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#fff6e4', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(255,246,228,0.96)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(20,8,0,0.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
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
  ctx.fillStyle = disabled ? 'rgba(235,238,255,0.55)' : light ? '#fffaf0' : C.ink;
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
    ctx.font = `400 ${Math.max(MIN_FONT, Math.round(it.fs * 0.7))}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = light ? '#ffe9a0' : '#a8301f';
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
