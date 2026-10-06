// Shared drawing helpers for every screen: flat rounded buttons, panels, wrapped text, the palette, and the flow layout
// that scales with the player's text size and scrolls when it no longer fits (so nothing clips at 300%).
export const FONT = "'Avenir Next', 'SF Pro Rounded', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
export const C = {
  ink: '#10324a', navy: '#12304a', deep: '#0b2236', sea: '#14a3b4', seaDark: '#0e7d92', foam: '#eafcff', sand: '#f2dcab', sandDark: '#d9b97a',
  coral: '#ff6a4a', coralDark: '#d9472b', sun: '#ffc24b', gold: '#ffd36a', paper: 'rgba(255,249,234,0.97)', white: '#ffffff',
  good: '#2fbf8a', shadow: 'rgba(8,28,44,0.38)',
};

export function roundPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// One button look for the whole game: a flat colour, one crisp edge, a soft drop shadow, and a pressed state
// (the button sinks and darkens while a finger that started on it is down). No gloss, no inner shapes.
const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
const BTN = {
  disabled: ['#cdd6d9', 'rgba(16,50,74,0.25)', 'rgba(16,50,74,0.45)'],
  primary: ['#ff6a4a', '#c93d22', '#ffffff'],
  active: ['#14a3b4', '#0a6f80', '#ffffff'],
  dark: ['#1d4560', '#0e2a40', '#eafcff'],
  plain: ['#fff7e2', 'rgba(16,50,74,0.45)', '#10324a'],
};
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const [fill, edge, text] = BTN[k];
  const dy = pressed ? 3 : 0;
  ctx.save();
  if (!disabled) { roundPath(ctx, r.x, r.y + (pressed ? 3 : 5), r.w, r.h, 20); ctx.fillStyle = C.shadow; ctx.fill(); }
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, 20);
  ctx.fillStyle = fill; ctx.fill();
  if (pressed) { ctx.fillStyle = 'rgba(8,24,40,0.14)'; ctx.fill(); }
  ctx.lineWidth = 2; ctx.strokeStyle = edge; ctx.stroke();
  ctx.restore();
  return { dy, text };
}

export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28 } = opts;
  const { dy, text } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = text;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = sub ? Math.round(size * 0.9) : size;
  const maxW = r.w - (r.w < 140 ? 10 : 24);
  ctx.font = `800 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > maxW && px > 18) { px -= 1; ctx.font = `800 ${px}px ${FONT}`; }
  ctx.fillText(label, r.x + r.w / 2, r.y + dy + r.h / 2 - (sub ? 11 : 0));
  if (sub) { ctx.font = `500 ${Math.max(20, Math.round(size * 0.62))}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, r.x + r.w / 2, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1; }
  ctx.restore();
  return disabled;
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 28, fill = C.paper, stroke = 'rgba(16,50,74,0.35)', shadow = true } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 7, w, h, r); ctx.fillStyle = C.shadow; ctx.fill(); }
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
export function textShadow(ctx, text, x, y, fill = '#fff', blur = 4, color = 'rgba(8,28,44,0.65)') {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
  ctx.restore();
}
export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

// ---------------------------------------------------------------------------------------------
// Flow layout: a vertical list of widgets (headings, paragraphs, buttons, custom art) that scales with the
// player's text size and scrolls when it no longer fits. widget: { t: 'h'|'p'|'btn'|'gap'|'art', id, label, sub,
// row, primary, active, disabled, dark, h, draw }
const GAP = 14;
export const subFs = (fs) => Math.max(20, Math.round(fs * 0.72));
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
      ctx.font = `800 ${fs}px ${FONT}`;
      const cw0 = (w0 - GAP * (group.length - 1)) / group.length;
      const tooWide = group.some((g) => g.label.split(' ').some((word) => ctx.measureText(word).width > cw0 - 28));
      if (tooWide || (scale > 1.5 && group.length > 1)) {
        widgets.splice(i, 0, ...group.map((g) => ({ ...g, row: undefined, h: g.h ?? 82 })));
        continue;
      }
      let hmax = 0;
      const prepared = group.map((g) => {
        ctx.font = `800 ${fs}px ${FONT}`;
        const lines = wrapLines(ctx, g.label, cw0 - 28);
        const sub = g.sub ? (ctx.font = `500 ${subFs(fs)}px ${FONT}`, wrapLines(ctx, g.sub, cw0 - 28).length) : 0;
        const h = Math.max(g.h ?? 82, lines.length * fs * 1.15 + sub * subFs(fs) + 34);
        hmax = Math.max(hmax, h);
        return { g, lines, h };
      });
      prepared.forEach((p, k) => out.push({ w: p.g, x: x0 + k * (cw0 + GAP), y, wd: cw0, h: hmax, fs, lines: p.lines }));
      y += hmax + GAP;
      continue;
    }
    i++;
    if (wd.t === 'gap') { y += wd.h ?? 20; continue; }
    if (wd.t === 'art') { out.push({ w: wd, x: x0, y, wd: w0, h: wd.h }); y += wd.h + GAP; continue; }
    if (wd.t === 'h') {
      const fs = Math.round((wd.size ?? 44) * Math.min(scale, wd.cap ?? 1.7));
      ctx.font = `800 ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0);
      const h = lines.length * fs * 1.18;
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
      continue;
    }
    if (wd.t === 'p') {
      const fs = Math.round((wd.size ?? 26) * Math.min(scale, wd.cap ?? 3));
      ctx.font = `${wd.bold ? 800 : 500} ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0 - (wd.pad ?? 0) * 2);
      const h = lines.length * fs * 1.3;
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
      continue;
    }
    if (wd.t === 'btn') {
      const fs = Math.round((o.btn ?? 26) * Math.min(scale, 3));
      ctx.font = `800 ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0 - 28);
      const sub = wd.sub ? (ctx.font = `500 ${subFs(fs)}px ${FONT}`, wrapLines(ctx, wd.sub, w0 - 28).length) : 0;
      const h = Math.max(wd.h ?? 84, lines.length * fs * 1.15 + sub * subFs(fs) + 34);
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
    }
  }
  return { items: out, contentH: y };
}

export function drawFlow(ctx, lay, top, bottom, scroll, clipW = 4000) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, top, clipW, bottom - top); ctx.clip();
  for (const it of lay.items) {
    const y = top + it.y - scroll;
    if (y > bottom || y + it.h < top) continue;
    const wd = it.w;
    if (wd.t === 'art') { ctx.save(); ctx.translate(it.x, y); wd.draw(ctx, it.wd, it.h); ctx.restore(); }
    else if (wd.t === 'h') {
      ctx.font = `800 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#ffffff', 8));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(255,255,255,0.95)'; ctx.font = `${wd.bold ? 800 : 500} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(8,28,44,0.6)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
    } else if (wd.t === 'btn') drawButtonRect(ctx, { x: it.x, y, w: it.wd, h: it.h }, it, wd);
  }
  ctx.restore();
}
function drawButtonRect(ctx, r, it, wd) {
  const { dy, text } = paintButton(ctx, r, wd);
  ctx.save();
  ctx.fillStyle = text;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${it.fs}px ${FONT}`;
  const subLines = wd.sub ? (() => { ctx.font = `500 ${subFs(it.fs)}px ${FONT}`; const l = wrapLines(ctx, wd.sub, r.w - 28); ctx.font = `800 ${it.fs}px ${FONT}`; return l; })() : [];
  const total = it.lines.length * it.fs * 1.15 + subLines.length * subFs(it.fs);
  let y = r.y + dy + (r.h - total) / 2 + it.fs * 0.88;
  it.lines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 1.15; });
  if (subLines.length) {
    ctx.font = `500 ${subFs(it.fs)}px ${FONT}`; ctx.globalAlpha = 0.85;
    y -= it.fs * 0.2;
    subLines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += subFs(it.fs); });
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
export function flowHit(lay, top, scroll, x, y) {
  for (const it of lay.items) {
    if (it.w.t !== 'btn' || (it.w.disabled && !it.w.hitDisabled)) continue;
    const yy = top + it.y - scroll;
    if (x >= it.x && x <= it.x + it.wd && y >= yy && y <= yy + it.h) return it.w.id;
  }
  return null;
}
