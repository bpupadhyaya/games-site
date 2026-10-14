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
  ink: '#10281c', cream: '#fff8e6', sand: '#f1e3c2', terra: '#d9531e', terraDark: '#6e2a08', olive: '#14a897', lav: '#2f8fd6', sky: '#2f8fd6',
  gold: '#ffc83d', shadow: 'rgba(8,30,18,0.4)', paper: 'rgba(255,250,236,0.97)', deep: '#0f3a2a',
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
const BTN_FILL = {
  disabled: ['#d4d6c8', '#b9bfae', '#8b927f'],
  primary: ['#ffbd3a', '#e8650b', '#7a3504'],
  active: ['#2fd1bd', '#118377', '#06433c'],
  dark: ['#2a6b4c', '#12372a', '#0a2018'],
  plain: ['#fffbf0', '#ecdcb6', '#8a6a3a'],
};
// brass rim colours: light at the top, dark at the bottom (a real bevelled edge)
const RIM = { primary: ['#ffe9a0', '#a9701c'], active: ['#d6fff2', '#2a8c7b'], dark: ['#f1d58a', '#7c5a1c'], plain: ['#fff3cf', '#a9873f'], disabled: ['#eef0e4', '#8f9684'] };
// Lacquered, bevelled slab with a brass rim: used by buttons, plaques and HUD chips so the whole interface belongs to one object world.
export function slab(ctx, x, y, w, h, r, k, { pressed = false, fill = null } = {}) {
  const [c0, c1] = fill || BTN_FILL[k], [r0, r1] = RIM[k] || RIM.dark, dy = pressed ? 2 : 0;
  ctx.save();
  // contact shadow (tight) + soft drop
  roundPath(ctx, x, y + (pressed ? 2 : 5), w, h, r); ctx.fillStyle = 'rgba(4,18,10,0.42)'; ctx.fill();
  roundPath(ctx, x + 2, y + (pressed ? 3 : 8), w - 4, h, r); ctx.fillStyle = 'rgba(4,18,10,0.18)'; ctx.fill();
  // brass rim
  roundPath(ctx, x, y + dy, w, h, r);
  const rg = ctx.createLinearGradient(0, y, 0, y + h); rg.addColorStop(0, r0); rg.addColorStop(1, r1); ctx.fillStyle = rg; ctx.fill();
  // lacquered body, inset 2.5 px
  const ins = 2.5;
  roundPath(ctx, x + ins, y + dy + ins, w - ins * 2, h - ins * 2, Math.max(4, r - ins));
  const g = ctx.createLinearGradient(0, y + dy, 0, y + dy + h); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fill();
  // lit top edge + shaded bottom edge (bevel, no gloss blob)
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.beginPath(); ctx.moveTo(x + r, y + dy + ins + 1); ctx.lineTo(x + w - r, y + dy + ins + 1); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.moveTo(x + r, y + dy + h - ins - 1); ctx.lineTo(x + w - r, y + dy + h - ins - 1); ctx.stroke();
  if (pressed) { roundPath(ctx, x + ins, y + dy + ins, w - ins * 2, h - ins * 2, Math.max(4, r - ins)); ctx.fillStyle = 'rgba(6,24,14,0.18)'; ctx.fill(); }
  ctx.restore();
}
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  slab(ctx, r.x, r.y, r.w, r.h, 18, k, { pressed });
  return { dy: pressed ? 2 : 0, light: primary || active || dark };
}

// A lacquered button. opts: primary (orange), active (teal), disabled, sub (small second line), size (font px)
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
  const ink = disabled ? 'rgba(40,46,64,0.55)' : light ? '#fffdf4' : C.ink;
  // embossed lettering: a hard 1 px shadow below (or a light lip below on cream buttons)
  ctx.fillStyle = disabled ? 'rgba(255,255,255,0.4)' : light ? 'rgba(40,12,0,0.55)' : 'rgba(255,255,255,0.75)';
  ctx.fillText(label, cx, ty + 1.5);
  ctx.fillStyle = ink; ctx.fillText(label, cx, ty);
  if (sub) { ctx.font = `500 ${Math.round(size * 0.62)}px ${FONT}`; ctx.globalAlpha = 0.9; ctx.fillText(sub, cx, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1; }
  if (icon) icon(ctx, r.x + 32, r.y + dy + r.h / 2, light && !disabled ? '#fffaf0' : C.ink);
  ctx.restore();
}

// A plaque: a brass-rimmed panel. Callers pass fill (lacquer / parchment) and stroke; the rim, bevel and shadow come from here.
export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 26, fill = C.paper, shadow = true } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 7, w, h, r); ctx.fillStyle = 'rgba(4,18,10,0.4)'; ctx.fill(); }
  const dark = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(fill);
  const lum = dark ? (+dark[1] * 0.3 + +dark[2] * 0.59 + +dark[3] * 0.11) : 240;
  const rim = RIM[lum < 110 ? 'dark' : 'plain'];
  roundPath(ctx, x, y, w, h, r);
  const rg = ctx.createLinearGradient(0, y, 0, y + h); rg.addColorStop(0, rim[0]); rg.addColorStop(1, rim[1]); ctx.fillStyle = rg; ctx.fill();
  roundPath(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(4, r - 3));
  ctx.fillStyle = fill; ctx.fill();
  // soft inner light from above
  ctx.save(); roundPath(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(4, r - 3)); ctx.clip();
  const lg = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 90)); lg.addColorStop(0, 'rgba(255,255,255,0.14)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg; ctx.fillRect(x, y, w, Math.min(h, 90)); ctx.restore();
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
  ctx.shadowColor = 'rgba(6,24,14,0.7)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
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
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(6,24,14,0.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
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
  ctx.fillStyle = disabled ? 'rgba(40,46,64,0.55)' : light ? '#fffdf4' : C.ink;
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
