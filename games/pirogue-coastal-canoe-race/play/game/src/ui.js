import { host } from './layout.js';
// Shared drawing helpers for every screen: rounded panels, flat buttons, wrapped text, and a vertical "flow" layout that scales with
// the player's text size and scrolls when it no longer fits, so nothing can overflow or clip at 300%.
export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
export const DISPLAY = "'Rockwell', 'Roboto Slab', 'Cooper Black', Georgia, 'Times New Roman', serif";
export const C = {
  ink: '#10303a', cream: '#fff6e4', sand: '#f0d9a8', night: '#06202c', dusk: '#0e5a74', coral: '#ff7a4d', coralDark: '#b8401c', gold: '#ffc857',
  teal: '#14b3a7', tealDark: '#0b6f69', crimson: '#e23a5c', panel: 'rgba(255,250,236,0.97)', shadow: 'rgba(4,20,30,0.4)',
};

export function roundPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
const FILL = {
  disabled: ['#d8d0c4', '#b9afa2', 'rgba(60,50,40,0.4)'],
  primary: ['#ff9468', '#e24f24', '#6f1d06'],
  active: ['#3fd6c6', '#0f8c83', '#04504b'],
  dark: ['#2f86a8', '#0e445d', '#e0b04a'],
  plain: ['#fffaf0', '#ecd6a6', '#7d5a2c'],
};
// One button look for the whole game: a lacquered, bevelled key (light top, deeper base, bright top edge, dark under-edge) with a
// brass rim on the dark ones, a soft drop shadow, and it sinks 3 px while pressed.
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const dy = pressed ? 3 : 0, [top, bot, rim] = FILL[k], rad = Math.min(18, r.h / 2);
  ctx.save();
  if (!disabled) {
    roundPath(ctx, r.x + 2, r.y + (pressed ? 3 : 8), r.w - 4, r.h, rad); ctx.fillStyle = pressed ? 'rgba(4,20,30,0.22)' : 'rgba(4,20,30,0.42)'; ctx.fill();
    roundPath(ctx, r.x, r.y + (pressed ? 2 : 5), r.w, r.h, rad); ctx.fillStyle = bot; ctx.fill();            // the key's side wall
  }
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad);
  const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h);
  g.addColorStop(0, top); g.addColorStop(0.55, top === bot ? top : mix(top, bot, 0.55)); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = dark ? 3 : 2; ctx.strokeStyle = rim; ctx.stroke();
  if (!disabled) {
    ctx.save(); roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.clip();
    const sh = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h * 0.5);
    sh.addColorStop(0, 'rgba(255,255,255,0.38)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.fillRect(r.x, r.y + dy, r.w, r.h * 0.5);
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(r.x, r.y + dy + r.h - 4, r.w, 4);
    ctx.restore();
    roundPath(ctx, r.x + 2.5, r.y + dy + 2.5, r.w - 5, r.h - 5, Math.max(4, rad - 2.5)); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
  }
  if (pressed) { roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.fillStyle = 'rgba(20,10,30,0.16)'; ctx.fill(); }
  ctx.restore();
  return { dy, light: primary || active || dark };
}
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28 } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(50,40,60,0.55)' : light ? '#fff8ea' : C.ink;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = sub ? Math.round(size * 0.9) : size;
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > r.w - 20 && px > 12) { px -= 1; ctx.font = `700 ${px}px ${FONT}`; }
  ctx.fillText(label, r.x + r.w / 2, r.y + dy + r.h / 2 - (sub ? 11 : 0));
  if (sub) { ctx.font = `400 ${Math.round(size * 0.58)}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, r.x + r.w / 2, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function panel(ctx, x, y, w, h, o = {}) {
  const { r = 26, fill = C.panel, stroke = 'rgba(70,50,100,0.55)', shadow = true } = o;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 8, w, h, r); ctx.fillStyle = 'rgba(4,20,30,0.42)'; ctx.fill(); }
  roundPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  // lit top edge, shaded base and a thin brass keyline: a plaque, not a flat card
  ctx.save(); roundPath(ctx, x, y, w, h, r); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(0.18, 'rgba(255,255,255,0.04)'); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke();
  roundPath(ctx, x + 3.5, y + 3.5, w - 7, h - 7, Math.max(4, r - 3.5)); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,214,150,0.55)'; ctx.stroke();
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
export function textShadow(ctx, text, x, y, fill = '#fff6e2', blur = 4) {
  ctx.save();
  ctx.shadowColor = 'rgba(4,20,30,0.75)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
  ctx.restore();
}
export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

// ---- flow layout -----------------------------------------------------------------------------------------------------------
//   widget: { t: 'h'|'p'|'btn'|'gap'|'art', id, label, sub, row, primary, active, disabled, dark, h, draw }
const GAP = 14;
const minH = () => Math.min(92, Math.ceil(44 / Math.max(0.2, host.px || 0.6)));   // a tap target of about 44 css px
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
      const fs = Math.round((o.btn ?? 30) * Math.min(scale, 3));
      ctx.font = `700 ${fs}px ${FONT}`;
      const cw0 = (w0 - GAP * (group.length - 1)) / group.length;
      const tooWide = group.some((g) => g.label.split(' ').some((word) => ctx.measureText(word).width > cw0 - 28));
      if (tooWide || (scale > 1.5 && group.length > 1)) { widgets.splice(i, 0, ...group.map((g) => ({ ...g, row: undefined, h: g.h ?? 88 }))); continue; }
      let hmax = 0;
      const prepared = group.map((g) => {
        ctx.font = `700 ${fs}px ${FONT}`;
        const lines = wrapLines(ctx, g.label, cw0 - 28), sub = g.sub ? wrapLines(ctx, g.sub, cw0 - 28).length : 0;
        const h = Math.max(g.h ?? 88, minH(), lines.length * fs * 1.15 + sub * fs * 0.78 + 34);
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
      ctx.font = `700 ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0), h = lines.length * fs * 1.18;
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
      continue;
    }
    if (wd.t === 'p') {
      const fs = Math.round((wd.size ?? 26) * Math.min(scale, wd.cap ?? 3));
      ctx.font = `${wd.bold ? 700 : 400} ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0 - (wd.pad ?? 0) * 2), h = lines.length * fs * 1.3;
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
      continue;
    }
    if (wd.t === 'btn') {
      const fs = Math.round((o.btn ?? 30) * Math.min(scale, 3));
      ctx.font = `700 ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0 - 28), sub = wd.sub ? wrapLines(ctx, wd.sub, w0 - 28).length : 0;
      const h = Math.max(wd.h ?? 88, minH(), lines.length * fs * 1.15 + sub * fs * 0.78 + 34);
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
    }
  }
  return { items: out, contentH: y };
}

export function drawFlow(ctx, lay, top, bottom, scroll, o = {}) {
  ctx.save();
  ctx.beginPath(); ctx.rect(o.clipX ?? 0, top, o.clipW ?? 100000, bottom - top); ctx.clip();
  for (const it of lay.items) {
    const y = top + it.y - scroll;
    if (y > bottom || y + it.h < top) continue;
    const wd = it.w;
    if (wd.t === 'art') { ctx.save(); ctx.translate(it.x, y); wd.draw(ctx, it.wd, it.h); ctx.restore(); }
    else if (wd.t === 'h') {
      ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#fff3dc', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(255,243,220,0.95)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(4,20,30,0.6)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
    } else if (wd.t === 'btn') drawButtonRect(ctx, { x: it.x, y, w: it.wd, h: it.h }, it, wd);
  }
  ctx.restore();
}
function drawButtonRect(ctx, r, it, wd) {
  const { dy, light } = paintButton(ctx, r, wd);
  ctx.save();
  ctx.fillStyle = wd.disabled ? 'rgba(50,40,60,0.55)' : light ? '#fff8ea' : C.ink;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${Math.round(it.fs * 0.78)}px ${FONT}`;
  const subLines = wd.sub ? wrapLines(ctx, wd.sub, r.w - 28) : [];
  ctx.font = `700 ${it.fs}px ${FONT}`;
  const total = it.lines.length * it.fs * 1.15 + subLines.length * it.fs * 0.78;
  let y = r.y + dy + (r.h - total) / 2 + it.fs * 0.88;
  it.lines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 1.15; });
  if (subLines.length) {
    ctx.font = `400 ${Math.round(it.fs * 0.78)}px ${FONT}`; ctx.globalAlpha = 0.85; y -= it.fs * 0.2;
    subLines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 0.78; });
    ctx.globalAlpha = 1;
  }
  if (wd.stars) {
    ctx.font = `400 ${Math.round(it.fs * 0.7)}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = light ? '#ffe9a0' : '#b8431c';
    ctx.fillText('★'.repeat(wd.stars) + '☆'.repeat(5 - wd.stars), r.x + r.w - 16, r.y + dy + it.fs * 0.95);
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
