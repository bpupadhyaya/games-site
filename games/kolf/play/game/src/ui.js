// Shared drawing helpers for every screen: rounded panels, buttons, wrapped text, the palette (the same flow-layout pattern as
// the other Arcforge sport games so every menu behaves the same; the palette is Kolf's own: umber, parchment, Delft blue, gold).
// Smallest text the screen allows (about 11 css px), in virtual units; layout.js keeps it current.
export let FLOOR = 18;
export const setFloor = (v) => { FLOOR = Math.max(11, Math.round(v)); };
export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, Arial, sans-serif";
export const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";
export const C = {
  ink: '#2a1d12', cream: '#f5ead0', sand: '#e6d3a3', terra: '#b8412e', terraDark: '#7d2a1c', olive: '#5c7a3e', delft: '#2d5b8c', delftDark: '#1b3a5c',
  gold: '#dcab4a', shadow: 'rgba(12,6,2,0.5)', paper: 'rgba(247,239,215,0.98)', navy: '#140d07', text: '#f5ead0', soft: '#cdb98f', frame: '#c9993a',
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
// Lacquered buttons with real depth: a darker lower edge (the button's thickness), a lit top edge, a gradient face and a pressed state.
const BTN_FILL = {
  disabled: ['#554838', '#43382b', 'rgba(255,255,255,0.14)', '#2c241b'],
  primary: ['#4a86c4', '#2a5b92', '#bcd8f2', '#163a62'],
  active: ['#74984d', '#55763a', '#c3dba2', '#2e421a'],
  dark: ['#4d3a29', '#35261a', 'rgba(232,200,140,0.5)', '#1a110a'],
  plain: ['#fbf1d6', '#e8d5a2', 'rgba(255,255,255,0.9)', '#9c7f48'],
};
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const [c0, c1, hi, edge] = BTN_FILL[k];
  const depth = disabled ? 2 : 5, dy = pressed ? depth - 1 : 0, rad = 18;
  ctx.save();
  if (!disabled) { roundPath(ctx, r.x - 1, r.y + depth + 3, r.w + 2, r.h, rad); ctx.fillStyle = 'rgba(8,4,0,0.34)'; ctx.fill(); }
  // the thickness: the darker base visible below the face
  roundPath(ctx, r.x, r.y + depth, r.w, r.h, rad); ctx.fillStyle = edge; ctx.fill();
  roundPath(ctx, r.x, r.y + dy, r.w, r.h - (pressed ? 0 : 0), rad);
  const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fill();
  if (pressed) { ctx.fillStyle = 'rgba(8,4,0,0.16)'; ctx.fill(); }
  ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
  // lit top edge
  ctx.save(); roundPath(ctx, r.x + 1.5, r.y + dy + 1.5, r.w - 3, r.h - 3, rad - 1.5); ctx.clip();
  ctx.strokeStyle = hi; ctx.globalAlpha = disabled ? 0.4 : 0.55; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(r.x + rad, r.y + dy + 2); ctx.lineTo(r.x + r.w - rad, r.y + dy + 2); ctx.stroke();
  ctx.restore();
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

// Deterministic grain lines for the walnut plaques (no DOM needed: drawn straight onto the canvas each time).
const GRAIN = (() => { let k = 17; const r = () => ((k = (k * 1664525 + 1013904223) >>> 0) / 4294967296); const o = []; for (let i = 0; i < 34; i++) o.push({ y: r(), dy1: (r() - 0.5) * 0.12, dy2: (r() - 0.5) * 0.12, dark: r() < 0.55, a: 0.08 + r() * 0.12, w: 0.6 + r() * 1.4 }); return o; })();
function woodFill(ctx, x, y, w, h, r, alpha) {
  const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#4d3826'); gr.addColorStop(0.5, '#3b2a1c'); gr.addColorStop(1, '#2d2015');
  ctx.save(); roundPath(ctx, x, y, w, h, r); ctx.globalAlpha = alpha; ctx.fillStyle = gr; ctx.fill(); ctx.globalAlpha = 1; ctx.clip();
  for (const g of GRAIN) {
    const yy = y + g.y * h; ctx.strokeStyle = g.dark ? `rgba(15,8,3,${g.a})` : `rgba(130,96,60,${g.a})`; ctx.lineWidth = g.w;
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.bezierCurveTo(x + w * 0.3, yy + g.dy1 * h, x + w * 0.7, yy + g.dy2 * h, x + w, yy); ctx.stroke();
  }
  ctx.restore();
}
// A carved walnut plaque with a brass edge and Delft-blue tile studs: the scoreboard, power meter and map strip.
export function plaque(ctx, x, y, w, h, o = {}) {
  const { r = 18, alpha = 0.95, studs = true } = o;
  ctx.save();
  roundPath(ctx, x, y + 4, w, h, r); ctx.fillStyle = 'rgba(6,3,0,0.45)'; ctx.fill();
  woodFill(ctx, x, y, w, h, r, alpha);
  const sh = ctx.createLinearGradient(0, y, 0, y + h); sh.addColorStop(0, 'rgba(255,230,180,0.14)'); sh.addColorStop(0.18, 'rgba(255,230,180,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
  roundPath(ctx, x, y, w, h, r); ctx.fillStyle = sh; ctx.fill();
  const br = ctx.createLinearGradient(x, y, x, y + h); br.addColorStop(0, '#f1d58a'); br.addColorStop(0.5, '#b88a2e'); br.addColorStop(1, '#8a6420');
  roundPath(ctx, x, y, w, h, r); ctx.lineWidth = 3; ctx.strokeStyle = br; ctx.stroke();
  roundPath(ctx, x + 4, y + 4, w - 8, h - 8, Math.max(2, r - 4)); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
  if (studs && h > 56 && w > 160) {
    for (const [sx, sy] of [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + h - 12], [x + w - 12, y + h - 12]]) {
      ctx.fillStyle = '#f4f2ea'; ctx.fillRect(sx - 5, sy - 5, 10, 10); ctx.strokeStyle = '#2b5aa0'; ctx.lineWidth = 1.4; ctx.strokeRect(sx - 4, sy - 4, 8, 8);
      ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fillStyle = '#2b5aa0'; ctx.fill();
    }
  }
  ctx.restore();
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 26, fill = C.paper, stroke = 'rgba(120,80,30,0.7)', shadow = true } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 6, w, h, r); ctx.fillStyle = 'rgba(8,4,0,0.42)'; ctx.fill(); }
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
export function textShadow(ctx, text, x, y, fill = '#f4faff', blur = 4) {
  ctx.save();
  ctx.shadowColor = 'rgba(12,6,2,0.78)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
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
      ctx.fillStyle = wd.color ?? '#f8edd0'; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#f8edd0', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(248,238,214,0.97)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(12,6,2,0.65)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
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
    ctx.font = `400 ${Math.round(it.fs * 0.7)}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = light ? '#ffe9a0' : '#7d2a1c';
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
