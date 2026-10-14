// Shared drawing helpers for every screen: rounded panels, flat buttons, wrapped text, and a vertical "flow" layout that scales with
// the player's text size and scrolls when it no longer fits, so nothing can overflow or clip at 300%.
export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
export const DISPLAY = "'Rockwell', 'Roboto Slab', 'Cooper Black', Georgia, 'Times New Roman', serif";
export const C = {
  ink: '#14303c', cream: '#fff6e4', sand: '#f0d9a8', night: '#0b2433', dusk: '#14506a', coral: '#ff7a4d', coralDark: '#c4451f', gold: '#ffc857',
  teal: '#14b3a7', tealDark: '#0b6f69', crimson: '#e23a5c', panel: 'rgba(255,250,236,0.97)', shadow: 'rgba(4,20,30,0.4)',
};

export function roundPath(ctx, x, y, w, h, r, keep = false) {
  r = Math.min(r, w / 2, h / 2);
  if (!keep) ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}

// ---- carved koa wood, kapa borders and lacquer: the game's one chrome language --------------------------------------------------
let GRAIN = null;
const grainPattern = (ctx) => {
  if (GRAIN && GRAIN.ctx === ctx) return GRAIN.p;
  const doc = globalThis.document;
  if (!doc) return null;
  const c = doc.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  let s = 91; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 46; i++) {
    const y = r() * 96, a = 0.05 + r() * 0.16, amp = 1 + r() * 3.5, ph = r() * 6.28, fr = 0.02 + r() * 0.03, w = 0.6 + r() * 1.6;
    g.strokeStyle = r() < 0.65 ? `rgba(20,8,2,${a})` : `rgba(255,214,150,${a * 0.8})`; g.lineWidth = w; g.beginPath();
    for (let x = 0; x <= 256; x += 8) { const yy = y + Math.sin(x * fr + ph) * amp; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
    g.stroke();
  }
  GRAIN = { ctx, p: ctx.createPattern(c, 'repeat') };
  return GRAIN.p;
};
// A plank of koa: dark-to-warm gradient, grain, a lit top edge and a shadowed lower edge, optional brass line and kapa teeth.
export function wood(ctx, x, y, w, h, o = {}) {
  const { r = 18, tone = 'mid', shadow = true, brass = false, hi = true, teeth = false, alpha = 1, press = 0 } = o;
  const T = { dark: ['#2a140a', '#4a2412'], mid: ['#4a2512', '#7a4220'], warm: ['#6a3618', '#9a5a2c'], red: ['#a8232a', '#d63a3a'], teal: ['#0d6f6a', '#17b3a7'], grey: ['#5a5046', '#6d6358'] }[tone] || ['#4a2512', '#7a4220'];
  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow) { roundPath(ctx, x, y + 6 - press, w, h, r); ctx.fillStyle = 'rgba(4,10,16,0.42)'; ctx.fill(); }
  const yy = y + press;
  roundPath(ctx, x, yy, w, h, r);
  const g = ctx.createLinearGradient(0, yy, 0, yy + h); g.addColorStop(0, T[1]); g.addColorStop(1, T[0]);
  ctx.fillStyle = g; ctx.fill();
  if (tone !== 'red' && tone !== 'teal') { const p = grainPattern(ctx); if (p) { ctx.save(); ctx.clip(); ctx.globalAlpha = alpha * 0.9; ctx.fillStyle = p; ctx.translate(x * 0.5, yy * 0.3); ctx.fillRect(-x * 0.5, -yy * 0.3, w + x, h + yy); ctx.restore(); } }
  if (hi) {
    ctx.save(); roundPath(ctx, x, yy, w, h, r); ctx.clip();
    const hg = ctx.createLinearGradient(0, yy, 0, yy + h * 0.5); hg.addColorStop(0, 'rgba(255,236,196,0.32)'); hg.addColorStop(1, 'rgba(255,236,196,0)');
    ctx.fillStyle = hg; ctx.fillRect(x, yy, w, h * 0.5);
    const sg = ctx.createLinearGradient(0, yy + h * 0.7, 0, yy + h); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = sg; ctx.fillRect(x, yy + h * 0.7, w, h * 0.3);
    ctx.restore();
  }
  roundPath(ctx, x + 1, yy + 1, w - 2, h - 2, Math.max(2, r - 1));
  ctx.lineWidth = 2; ctx.strokeStyle = brass ? '#e6b855' : 'rgba(20,8,2,0.7)'; ctx.stroke();
  if (brass) { roundPath(ctx, x + 4, yy + 4, w - 8, h - 8, Math.max(2, r - 4)); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,238,170,0.55)'; ctx.stroke(); }
  if (teeth) {
    ctx.save(); roundPath(ctx, x, yy, w, h, r); ctx.clip();
    const n = Math.max(4, Math.floor(w / 26)), tw = w / n;
    ctx.fillStyle = 'rgba(240,228,196,0.85)';
    for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.moveTo(x + i * tw + 2, yy + h); ctx.lineTo(x + i * tw + tw / 2, yy + h - 7); ctx.lineTo(x + (i + 1) * tw - 2, yy + h); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
}
const FILL = { disabled: 'dark', primary: 'red', active: 'teal', dark: 'dark', plain: 'mid' };
// One button look for the whole game: carved koa (plain), vermilion lacquer (primary), jade lacquer (active); it sinks 3 px while pressed.
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const dy = pressed ? 3 : 0;
  wood(ctx, r.x, r.y, r.w, r.h, { r: 16, tone: FILL[k], shadow: !disabled, brass: k === 'primary', press: dy, alpha: disabled ? 0.62 : 1 });
  if (pressed) { roundPath(ctx, r.x, r.y + dy, r.w, r.h, 16); ctx.fillStyle = 'rgba(20,6,2,0.2)'; ctx.fill(); }
  return { dy, light: true };
}

export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28 } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(236,224,200,0.62)' : '#fff3d6';
  ctx.shadowColor = 'rgba(10,4,0,0.7)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
  void light; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = sub ? Math.round(size * 0.9) : size;
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > r.w - 20 && px > 12) { px -= 1; ctx.font = `700 ${px}px ${FONT}`; }
  ctx.fillText(label, r.x + r.w / 2, r.y + dy + r.h / 2 - (sub ? 11 : 0));
  if (sub) { ctx.font = `400 ${Math.round(size * 0.58)}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, r.x + r.w / 2, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function panel(ctx, x, y, w, h, o = {}) {
  const { r = 26, fill = C.panel, shadow = true } = o;
  const dark = typeof fill === 'string' && /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/.test(fill) && (() => { const m = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/.exec(fill); return +m[1] + +m[2] + +m[3] < 330; })();
  wood(ctx, x, y, w, h, { r, tone: 'dark', shadow, brass: true, teeth: false });
  const m = Math.min(14, w * 0.05, h * 0.05);
  ctx.save();
  roundPath(ctx, x + m, y + m, w - 2 * m, h - 2 * m, Math.max(6, r - m));
  if (dark) { ctx.fillStyle = 'rgba(24,10,4,0.9)'; ctx.fill(); } else {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#fbf1d6'); g.addColorStop(1, '#efe0b6'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(120,70,30,0.55)'; ctx.stroke();
  }
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
      ctx.font = `700 ${fs}px ${FONT}`;
      const cw0 = (w0 - GAP * (group.length - 1)) / group.length;
      const tooWide = group.some((g) => g.label.split(' ').some((word) => ctx.measureText(word).width > cw0 - 28));
      if (tooWide || (scale > 1.5 && group.length > 1)) { widgets.splice(i, 0, ...group.map((g) => ({ ...g, row: undefined, h: g.h ?? 88 }))); continue; }
      let hmax = 0;
      const prepared = group.map((g) => {
        ctx.font = `700 ${fs}px ${FONT}`;
        const lines = wrapLines(ctx, g.label, cw0 - 28), sub = g.sub ? wrapLines(ctx, g.sub, cw0 - 28).length : 0;
        const h = Math.max(g.h ?? 88, lines.length * fs * 1.15 + sub * fs * 0.72 + 34);
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
      const fs = Math.round((o.btn ?? 26) * Math.min(scale, 3));
      ctx.font = `700 ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0 - 28), sub = wd.sub ? wrapLines(ctx, wd.sub, w0 - 28).length : 0;
      const h = Math.max(wd.h ?? 88, lines.length * fs * 1.15 + sub * fs * 0.72 + 34);
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
  ctx.fillStyle = wd.disabled ? 'rgba(236,224,200,0.62)' : '#fff3d6'; void light;
  ctx.shadowColor = 'rgba(10,4,0,0.7)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${Math.round(it.fs * 0.72)}px ${FONT}`;
  const subLines = wd.sub ? wrapLines(ctx, wd.sub, r.w - 28) : [];
  ctx.font = `700 ${it.fs}px ${FONT}`;
  const total = it.lines.length * it.fs * 1.15 + subLines.length * it.fs * 0.72;
  let y = r.y + dy + (r.h - total) / 2 + it.fs * 0.88;
  it.lines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 1.15; });
  if (subLines.length) {
    ctx.font = `400 ${Math.round(it.fs * 0.72)}px ${FONT}`; ctx.globalAlpha = 0.85; y -= it.fs * 0.2;
    subLines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 0.72; });
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
