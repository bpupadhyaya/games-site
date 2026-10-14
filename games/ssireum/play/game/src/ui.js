// Shared drawing helpers for every screen: rounded panels, buttons, wrapped text, the palette (the same flow-layout pattern as
// the other Arcforge sport games so every menu behaves the same; the palette is Ssireum's own: ink, sand, indigo, vermilion).
// Smallest text the screen allows (about 11 css px), in virtual units; layout.js keeps it current.
export let FLOOR = 18;
export const setFloor = (v) => { FLOOR = Math.max(11, Math.round(v)); };
export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, Arial, sans-serif";
export const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";
export const C = {
  ink: '#231409', cream: '#f7ead2', sand: '#e9c98c', terra: '#c8402a', terraDark: '#8f2a1c', olive: '#2c5aa0', delft: '#3a2417', delftDark: '#4a2c14',
  gold: '#f2c14e', shadow: 'rgba(20,10,4,0.5)', paper: 'rgba(250,243,226,0.98)', navy: '#140b05', text: '#f7ead2', soft: '#d7bf99', frame: '#d6aa60',
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
// Premium chrome: every button is a small carved plaque: a walnut rim, a brass edge and a lit face (maple, walnut, vermilion or indigo lacquer)
// with a bevel (light on the top edge, shade at the bottom) and a deep pressed state.
const FACE = {
  disabled: { top: '#4f3d30', bot: '#3b2c21', rim: '#2a1d14', brass: ['#6e5a3c', '#54432c'] },
  primary: { top: '#ea6140', bot: '#a8301a', rim: '#4a1a0c', brass: ['#f6dc8a', '#b88a2c'] },
  active: { top: '#4a82d0', bot: '#244f93', rim: '#12254a', brass: ['#f6dc8a', '#b88a2c'] },
  dark: { top: '#6e4423', bot: '#3f2411', rim: '#1e0f06', brass: ['#e8c466', '#9c7222'] },
  plain: { top: '#f8e8c2', bot: '#dcb677', rim: '#5a3418', brass: ['#f6dc8a', '#b88a2c'] },
};
export function plaque(ctx, x, y, w, h, r, f, sunk = 0) {
  // drop shadow, walnut rim, brass edge, lit face
  roundPath(ctx, x, y + (sunk ? 2 : 5), w, h, r); ctx.fillStyle = sunk ? 'rgba(10,4,1,0.3)' : 'rgba(10,4,1,0.45)'; ctx.fill();
  roundPath(ctx, x, y + sunk, w, h, r); ctx.fillStyle = f.rim; ctx.fill();
  const bg = ctx.createLinearGradient(x, y, x + w, y + h); bg.addColorStop(0, f.brass[0]); bg.addColorStop(1, f.brass[1]);
  roundPath(ctx, x + 2, y + 2 + sunk, w - 4, h - 4, Math.max(2, r - 2)); ctx.fillStyle = bg; ctx.fill();
  const fg = ctx.createLinearGradient(0, y + sunk, 0, y + sunk + h); fg.addColorStop(0, f.top); fg.addColorStop(1, f.bot);
  roundPath(ctx, x + 5, y + 5 + sunk, w - 10, h - 10, Math.max(2, r - 5)); ctx.fillStyle = fg; ctx.fill();
  // bevel: lit top edge, shaded bottom edge
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.moveTo(x + r, y + 6.2 + sunk); ctx.lineTo(x + w - r, y + 6.2 + sunk); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(x + r, y + h - 6.2 + sunk); ctx.lineTo(x + w - r, y + h - 6.2 + sunk); ctx.stroke();
}
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const dy = pressed ? 3 : 0;
  ctx.save();
  plaque(ctx, r.x, r.y, r.w, r.h, Math.min(18, r.h / 2.4), FACE[k], dy);
  if (pressed) { roundPath(ctx, r.x + 5, r.y + 5 + dy, r.w - 10, r.h - 10, 12); ctx.fillStyle = 'rgba(14,6,2,0.16)'; ctx.fill(); }
  ctx.restore();
  return { dy, light: primary || active || dark };
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
  const { r = 26, fill = C.paper, shadow = true } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 7, w, h, r); ctx.fillStyle = 'rgba(10,4,1,0.45)'; ctx.fill(); }
  roundPath(ctx, x - 4, y - 4, w + 8, h + 8, r + 4); ctx.fillStyle = '#4a2a12'; ctx.fill();
  const bg = ctx.createLinearGradient(x, y, x + w, y + h); bg.addColorStop(0, '#f6dc8a'); bg.addColorStop(0.5, '#b88a2c'); bg.addColorStop(1, '#f2d27a');
  roundPath(ctx, x - 2, y - 2, w + 4, h + 4, r + 2); ctx.fillStyle = bg; ctx.fill();
  roundPath(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.stroke();
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
  ctx.shadowColor = 'rgba(14,6,2,0.78)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
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
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(14,6,2,0.65)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
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
