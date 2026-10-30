// Shared drawing helpers for every screen: rounded panels, buttons, wrapped text, the palette and the flow layout (the same
// menu behaviour as the other Arcforge games, with this game's own colours and type).
import { host } from './layout.js';
// Smallest readable text (11 CSS px) and smallest tap target (44 CSS px) in virtual units, so small phones never get tiny text or buttons.
const minF = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);
const minH = () => (host.px > 0 ? Math.ceil(44 / host.px) : 0);
const subSz = (fs) => Math.max(Math.round(fs * 0.72), minF());
export const FONT = "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Roboto, Arial, sans-serif";
export const DISPLAY = "'Baskerville', 'Palatino Linotype', 'Book Antiqua', Georgia, 'Times New Roman', serif";
export const C = {
  ink: '#1c2a1e', cream: '#f8f1dc', sand: '#e6d8b0', terra: '#a8331f', terraDark: '#6e1c10', olive: '#2f7a44', lav: '#5a4a9c', sky: '#3a7fb0',
  gold: '#e8b43c', shadow: 'rgba(8,20,10,0.4)', paper: 'rgba(250,244,226,0.97)', deep: '#16301f',
};

export function roundPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- wood, brass and lacquer: one chrome for every button and panel ------------------------------------------------------------
// Grain is painted once into small tileable canvases (per wood), then used as a pattern fill.
const WOODS = {};
function woodCanvas(kind) {
  if (WOODS[kind]) return WOODS[kind];
  const doc = globalThis.document; if (!doc) return null;
  const pal = { oak: ['#e9cf94', '#d8b46c', 'rgba(122,78,28,A)'], walnut: ['#5a3a22', '#3f2716', 'rgba(20,10,4,A)'], pale: ['#d9d2bf', '#c8bfa6', 'rgba(110,100,70,A)'], ink: ['#274a35', '#1b3426', 'rgba(5,20,10,A)'] }[kind] || ['#e9cf94', '#d8b46c', 'rgba(122,78,28,A)'];
  const w = 256, h = 128, c = doc.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  let seed = 4242 + kind.length * 77; const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 46; i++) {
    const y0 = r() * h, amp = 1 + r() * 3, k = 1 + Math.floor(r() * 3), ph = r() * 6.28, a = 0.06 + r() * 0.2;
    g.strokeStyle = pal[2].replace('A', a.toFixed(2)); g.lineWidth = 0.5 + r() * 1.6;
    for (const off of [-h, 0, h]) {
      g.beginPath();
      for (let x = 0; x <= w; x += 8) { const y = y0 + off + Math.sin((x / w) * 6.2832 * k + ph) * amp; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
  }
  return (WOODS[kind] = c);
}
const PATS = new WeakMap();
function woodFill(ctx, kind) {
  const c = woodCanvas(kind); if (!c) return null;
  let m = PATS.get(ctx); if (!m) { m = {}; PATS.set(ctx, m); }
  return m[kind] || (m[kind] = ctx.createPattern(c, 'repeat'));
}
function brassStroke(ctx, x, y, w, h, lw = 3) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  g.addColorStop(0, '#fbe9a4'); g.addColorStop(0.45, '#c79a32'); g.addColorStop(1, '#8a6218');
  ctx.lineWidth = lw; ctx.strokeStyle = g; ctx.stroke();
}
const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
const LACQ = {
  primary: ['#ffe38e', '#e8b43c', '#a8770f'],
  active: ['#52b06a', '#2f7a44', '#1a4a28'],
};
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const dy = pressed ? 3 : 0, rad = Math.min(18, r.h * 0.3);
  ctx.save();
  if (!disabled) { roundPath(ctx, r.x, r.y + (pressed ? 2 : 5), r.w, r.h, rad); ctx.fillStyle = pressed ? 'rgba(8,16,6,0.28)' : 'rgba(8,16,6,0.42)'; ctx.fill(); }
  // body
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad);
  if (k === 'primary' || k === 'active') {
    const c = LACQ[k], g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h);
    g.addColorStop(0, c[0]); g.addColorStop(0.55, c[1]); g.addColorStop(1, c[2]); ctx.fillStyle = g; ctx.fill();
  } else {
    const wf = woodFill(ctx, k === 'dark' ? 'walnut' : k === 'disabled' ? 'pale' : 'oak');
    ctx.fillStyle = wf || (k === 'dark' ? '#3f2716' : '#e0c488'); ctx.fill();
    const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h);
    g.addColorStop(0, k === 'dark' ? 'rgba(255,230,190,0.16)' : 'rgba(255,255,255,0.28)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,20,0,0.28)');
    ctx.fillStyle = g; ctx.fill();
  }
  if (pressed) { ctx.fillStyle = 'rgba(10,20,8,0.18)'; ctx.fill(); }
  // lacquer sheen: a soft highlight across the upper half
  if (k === 'primary' || k === 'active') {
    ctx.save(); roundPath(ctx, r.x + 2, r.y + dy + 2, r.w - 4, r.h * 0.46, rad - 2); ctx.clip();
    const sg = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h * 0.5); sg.addColorStop(0, 'rgba(255,255,255,0.34)'); sg.addColorStop(1, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = sg; ctx.fillRect(r.x, r.y + dy, r.w, r.h * 0.5); ctx.restore();
  }
  // brass rim (rich on the lacquer, quiet on the wood) and a dark seat line inside it
  roundPath(ctx, r.x + 1.5, r.y + dy + 1.5, r.w - 3, r.h - 3, rad - 1);
  if (k === 'disabled') { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(90,80,60,0.5)'; ctx.stroke(); }
  else brassStroke(ctx, r.x, r.y + dy, r.w, r.h, k === 'primary' ? 3.2 : 2.4);
  roundPath(ctx, r.x + 4.5, r.y + dy + 4.5, r.w - 9, r.h - 9, Math.max(2, rad - 4));
  ctx.lineWidth = 1; ctx.strokeStyle = k === 'plain' ? 'rgba(90,50,10,0.3)' : 'rgba(0,0,0,0.28)'; ctx.stroke();
  ctx.restore();
  return { dy, light: active || dark };
}

// A wooden plaque. opts: primary (lacquer), active, disabled, sub (small second line), size (font px)
export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28, icon = null } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = sub ? Math.round(size * 0.9) : size;
  const maxW = r.w - (icon ? 84 : 24);
  ctx.font = `800 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > maxW && px > 13) { px -= 1; ctx.font = `800 ${px}px ${FONT}`; }
  const cx = r.x + r.w / 2 + (icon ? 24 : 0), ty = r.y + dy + r.h / 2 - (sub ? 11 : 0);
  if (!light && !disabled) { ctx.fillStyle = 'rgba(255,250,230,0.55)'; ctx.fillText(label, cx, ty + 1.5); }   // letterpress
  if (light && !disabled) { ctx.fillStyle = 'rgba(40,10,0,0.45)'; ctx.fillText(label, cx, ty + 1.5); }
  ctx.fillStyle = disabled ? 'rgba(60,56,44,0.6)' : light ? '#fffaf0' : '#2a1a0c';
  ctx.fillText(label, cx, ty);
  if (sub) { ctx.font = `500 ${Math.round(size * 0.62)}px ${FONT}`; ctx.globalAlpha = 0.9; ctx.fillText(sub, cx, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1; }
  if (icon) icon(ctx, r.x + 32, r.y + dy + r.h / 2, light && !disabled ? '#ffffff' : C.ink);
  ctx.restore();
}

// A panel framed in wood with a brass rim. opts.fill = the inset colour (paper for pages, slate for the HUD), frame: false for none.
export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 26, fill = C.paper, stroke = 'rgba(60,55,30,0.55)', shadow = true, frame = true } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 6, w, h, r); ctx.fillStyle = 'rgba(10,20,8,0.4)'; ctx.fill(); }
  if (!frame) {
    roundPath(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke(); ctx.restore(); return;
  }
  const b = Math.max(5, Math.min(10, Math.min(w, h) * 0.035));
  roundPath(ctx, x, y, w, h, r);
  ctx.fillStyle = woodFill(ctx, 'walnut') || '#3f2716'; ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,225,170,0.18)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g; ctx.fill();
  roundPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r - 1); brassStroke(ctx, x, y, w, h, 2.6);
  roundPath(ctx, x + b, y + b, w - 2 * b, h - 2 * b, Math.max(4, r - b));
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
  // a soft inner shadow under the top rim so the inset reads as recessed
  ctx.save(); roundPath(ctx, x + b, y + b, w - 2 * b, h - 2 * b, Math.max(4, r - b)); ctx.clip();
  const ig = ctx.createLinearGradient(0, y + b, 0, y + b + 14); ig.addColorStop(0, 'rgba(0,0,0,0.28)'); ig.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ig; ctx.fillRect(x, y + b, w, 14); ctx.restore();
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
  ctx.shadowColor = 'rgba(10,20,8,0.7)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
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
      ctx.fillStyle = wd.color ?? '#fff8e4'; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#fff8e4', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(255,248,230,0.97)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(10,20,8,0.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
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
  ctx.fillStyle = disabled ? 'rgba(60,56,44,0.6)' : light ? '#fffaf0' : '#2a1a0c';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${it.fs}px ${FONT}`;
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
    ctx.font = `400 ${Math.max(Math.round(it.fs * 0.7), minF())}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = light ? '#ffe9a0' : '#a8331f';
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
