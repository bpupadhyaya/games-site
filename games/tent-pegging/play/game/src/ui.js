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

// One button look for the whole game: lacquered plaques with a brass rim, a soft drop shadow and a pressed state (the plaque sinks 3 px and darkens
// while a finger that started on it is down). No glossy blob: the depth comes from a vertical tone, a crisp bevel line and the rim.
const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
const BTN = {
  disabled: { c: ['rgba(120,128,160,0.34)', 'rgba(70,78,110,0.34)'], rim: ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.12)'], hi: 'rgba(255,255,255,0.12)' },
  primary: { c: ['#f27a38', '#d4501e', '#962f0e'], rim: ['#ffe7a8', '#d8a244'], hi: 'rgba(255,236,200,0.55)' },
  active: { c: ['#34aab2', '#1d7f86', '#0f4d54'], rim: ['#bff1f2', '#5fb9bd'], hi: 'rgba(210,255,255,0.5)' },
  dark: { c: ['rgba(52,42,52,0.9)', 'rgba(32,24,30,0.92)', 'rgba(20,14,20,0.94)'], rim: ['rgba(255,226,160,0.8)', 'rgba(176,128,52,0.8)'], hi: 'rgba(255,230,180,0.28)' },
  plain: { c: ['#34476f', '#223259', '#131d3a'], rim: ['#ffe2a0', '#c08f3a'], hi: 'rgba(200,220,255,0.38)' },
};
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const B = BTN[k], dy = pressed ? 3 : 0, rad = Math.min(20, r.h / 2.2);
  ctx.save();
  if (!disabled) { roundPath(ctx, r.x, r.y + (pressed ? 3 : 7), r.w, r.h, rad); ctx.fillStyle = pressed ? 'rgba(10,6,0,0.28)' : 'rgba(10,6,0,0.42)'; ctx.fill(); }
  // body: vertical lacquer tone
  const body = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h);
  if (B.c.length === 3) { body.addColorStop(0, B.c[0]); body.addColorStop(0.5, B.c[1]); body.addColorStop(1, B.c[2]); } else { body.addColorStop(0, B.c[0]); body.addColorStop(1, B.c[1]); }
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.fillStyle = body; ctx.fill();
  if (pressed) { ctx.fillStyle = 'rgba(10,6,0,0.2)'; ctx.fill(); }
  // bevel: a bright hairline just inside the top edge and a dark one inside the bottom edge
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = B.hi; ctx.beginPath(); ctx.moveTo(r.x + rad * 0.9, r.y + dy + 3.5); ctx.lineTo(r.x + r.w - rad * 0.9, r.y + dy + 3.5); ctx.stroke();
  if (!disabled) { ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.moveTo(r.x + rad * 0.9, r.y + dy + r.h - 3.5); ctx.lineTo(r.x + r.w - rad * 0.9, r.y + dy + r.h - 3.5); ctx.stroke(); }
  // brass rim
  const rim = ctx.createLinearGradient(r.x, r.y + dy, r.x, r.y + dy + r.h);
  rim.addColorStop(0, B.rim[0]); rim.addColorStop(1, B.rim[1]);
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.lineWidth = 2.2; ctx.strokeStyle = rim; ctx.stroke();
  ctx.restore();
  return { dy, light: true };
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
  const { r = 26, fill = C.paper, stroke = 'rgba(28,37,82,0.5)', shadow = true, brass = true } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 8, w, h, r); ctx.fillStyle = 'rgba(10,6,0,0.42)'; ctx.fill(); }
  roundPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  if (brass) {
    const rim = ctx.createLinearGradient(x, y, x, y + h);
    rim.addColorStop(0, 'rgba(255,226,160,0.95)'); rim.addColorStop(0.5, 'rgba(190,140,60,0.9)'); rim.addColorStop(1, 'rgba(255,214,130,0.85)');
    ctx.lineWidth = 3; ctx.strokeStyle = rim; ctx.stroke();
    roundPath(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 5)); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke();
  } else { ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.restore();
}

// Premium lettering for titles: dark outline, a gold gradient face, a bright top edge and a soft glow.
export function embossText(ctx, text, x, y, size, o = {}) {
  const { face = ['#fff4cf', '#ffd45a', '#c98a1c'], font = `900 ${size}px ${DISPLAY}`, align = 'center', outline = '#2a1608', glow = 'rgba(255,200,90,0.5)' } = o;
  ctx.save();
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = size * 0.18; ctx.shadowOffsetY = size * 0.06;
  ctx.lineWidth = Math.max(4, size * 0.14); ctx.strokeStyle = outline; ctx.strokeText(text, x, y);
  ctx.shadowColor = glow; ctx.shadowBlur = size * 0.22; ctx.shadowOffsetY = 0;
  const g = ctx.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.1);
  g.addColorStop(0, face[0]); g.addColorStop(0.55, face[1]); g.addColorStop(1, face[2]);
  ctx.fillStyle = g; ctx.fillText(text, x, y);
  ctx.shadowBlur = 0; ctx.lineWidth = Math.max(1, size * 0.02); ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.strokeText(text, x, y - size * 0.012);
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
