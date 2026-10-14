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
  ink: '#1b2230', cream: '#f2e9d4', sand: '#dccfae', terra: '#1f7f68', terraDark: '#0e3f33', olive: '#2f9a8c', lav: '#4d4a96', sky: '#3a7fb0',
  gold: '#e8b64a', shadow: 'rgba(10,14,30,0.4)', paper: 'rgba(245,238,220,0.96)', deep: '#161d36', brick: '#b5503a',
};

export function roundPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// One button look for the whole game: lacquered / ceramic pieces with a lit top edge, a darker underside, a brass rim on the main
// actions, a soft drop shadow and a pressed state (the button sinks 3 px and darkens while a finger that started on it is down).
const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
const BTN_FILL = {
  disabled: ['#cfd0d6', '#b7bac5', 'rgba(70,80,100,0.35)', null],
  primary: ['#33c19a', '#157a60', '#0b3d2f', ['#ffe9a8', '#c9962e']],
  active: ['#f3c455', '#c8922a', '#6a4a10', ['#fff3c4', '#b8801e']],
  dark: ['#3a4a72', '#1c2644', 'rgba(255,255,255,0.18)', ['#8d9bc4', '#4a5885']],
  plain: ['#fbf4e2', '#e0d0a8', 'rgba(70,60,40,0.6)', ['#fffdf4', '#bfa86e']],
};
let WOOD = null;
function woodPattern(ctx) {
  if (WOOD) return WOOD;
  try {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const c = new OffscreenCanvas(256, 96);
    const g = c.getContext('2d');
    g.fillStyle = '#4a2c1a'; g.fillRect(0, 0, 256, 96);
    for (let i = 0; i < 46; i++) {
      const y = (i * 37 % 96) + (i % 3) * 0.7, a = 0.05 + ((i * 53) % 10) / 90;
      g.strokeStyle = i % 2 ? `rgba(20,10,4,${a})` : `rgba(160,100,56,${a * 0.8})`; g.lineWidth = 1 + (i % 3);
      g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(70, y + ((i * 7) % 9) - 4, 170, y - ((i * 5) % 9) + 4, 256, y + ((i * 3) % 7) - 3); g.stroke();
    }
    WOOD = ctx.createPattern(c, 'repeat');
  } catch { WOOD = null; }
  return WOOD;
}
// A carved plaque: walnut, slate or paper, with an inset lit edge and an optional brass rim. Used for the HUD and the panels.
export function plaque(ctx, x, y, w, h, o = {}) {
  const { r = 20, kind = 'wood', rim = true, shadow = true, alpha = 1 } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow) { roundPath(ctx, x, y + 5, w, h, r); ctx.fillStyle = 'rgba(6,8,20,0.42)'; ctx.fill(); }
  roundPath(ctx, x, y, w, h, r);
  if (kind === 'paper') {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(248,241,222,0.98)'); g.addColorStop(1, 'rgba(228,214,184,0.98)'); ctx.fillStyle = g;
  } else if (kind === 'slate') {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(38,48,80,0.94)'); g.addColorStop(1, 'rgba(18,24,48,0.96)'); ctx.fillStyle = g;
  } else {
    const wp = woodPattern(ctx); ctx.fillStyle = wp || '#4a2c1a';
  }
  ctx.fill();
  if (kind === 'wood') {            // light from the upper left, dark underside
    const sh = ctx.createLinearGradient(0, y, 0, y + h); sh.addColorStop(0, 'rgba(255,220,170,0.20)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = sh; ctx.fill();
  }
  // inset bevel: a lit hairline on the top inside edge, a dark one on the bottom
  ctx.lineWidth = 1.6;
  roundPath(ctx, x + 2.5, y + 2.5, w - 5, h - 5, Math.max(2, r - 2.5)); ctx.strokeStyle = kind === 'paper' ? 'rgba(255,255,255,0.7)' : 'rgba(255,240,210,0.22)'; ctx.stroke();
  if (rim) {
    const bg = ctx.createLinearGradient(x, y, x, y + h); bg.addColorStop(0, '#ffe7a0'); bg.addColorStop(0.5, '#c8992f'); bg.addColorStop(1, '#7a5516');
    roundPath(ctx, x, y, w, h, r); ctx.lineWidth = 2.5; ctx.strokeStyle = bg; ctx.stroke();
  } else { roundPath(ctx, x, y, w, h, r); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(30,20,12,0.6)'; ctx.stroke(); }
  ctx.restore();
}
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const [c0, c1, edge, rim] = BTN_FILL[k];
  const dy = pressed ? 3 : 0, R = Math.min(18, r.h / 2);
  ctx.save();
  if (!disabled) { roundPath(ctx, r.x, r.y + (pressed ? 2 : 5), r.w, r.h, R); ctx.fillStyle = pressed ? 'rgba(8,10,24,0.25)' : 'rgba(8,10,24,0.4)'; ctx.fill(); }
  // the body
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, R);
  const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fill();
  if (!disabled) {
    // glaze: a soft highlight across the upper half, a dark band along the bottom
    ctx.save(); roundPath(ctx, r.x, r.y + dy, r.w, r.h, R); ctx.clip();
    const hg = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h * 0.55); hg.addColorStop(0, 'rgba(255,255,255,0.34)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg; ctx.fillRect(r.x, r.y + dy, r.w, r.h * 0.55);
    const bg = ctx.createLinearGradient(0, r.y + dy + r.h * 0.7, 0, r.y + dy + r.h); bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = bg; ctx.fillRect(r.x, r.y + dy + r.h * 0.7, r.w, r.h * 0.3);
    ctx.restore();
  }
  if (pressed) { roundPath(ctx, r.x, r.y + dy, r.w, r.h, R); ctx.fillStyle = 'rgba(8,10,24,0.18)'; ctx.fill(); }
  if (rim && !pressed) {
    const rg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); rg.addColorStop(0, rim[0]); rg.addColorStop(1, rim[1]);
    roundPath(ctx, r.x + 1, r.y + dy + 1, r.w - 2, r.h - 2, R - 1); ctx.lineWidth = 2.2; ctx.strokeStyle = rg; ctx.stroke();
  }
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, R); ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
  ctx.restore();
  return { dy, light: primary || dark };
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

export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 26, shadow = true } = opts;
  const kind = opts.kind || (/24[58],2[34]|25[0-9],2/.test(String(opts.fill)) ? 'paper' : 'slate');
  plaque(ctx, x, y, w, h, { r, kind, shadow, rim: true });
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
  it.lines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 1.15; });
  if (subLines.length) {
    ctx.font = `400 ${subSz(it.fs)}px ${FONT}`; ctx.globalAlpha = 0.85;
    y -= it.fs * 0.2;
    subLines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += subSz(it.fs); });
    ctx.globalAlpha = 1;
  }
  if (wd.stars !== undefined) {
    ctx.font = `400 ${Math.max(Math.round(it.fs * 0.7), minF())}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = light ? '#ffe9a0' : '#9a6a10';
    ctx.fillText('★'.repeat(wd.stars) + '☆'.repeat(Math.max(0, 3 - wd.stars)), r.x + r.w - 16, r.y + dy + it.fs * 0.95);
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
