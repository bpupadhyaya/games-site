// Shared drawing helpers for every screen: rounded panels, flat buttons, wrapped text, and a vertical "flow" layout that scales with
// the player's text size and scrolls when it no longer fits, so nothing can overflow or clip at 300%.
export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
export const DISPLAY = "'Rockwell', 'Roboto Slab', 'Cooper Black', Georgia, 'Times New Roman', serif";
export const C = {
  ink: '#221a3d', cream: '#fff3dc', sand: '#ecc88d', night: '#17123a', dusk: '#3b2a6b', coral: '#ff7a4d', coralDark: '#c4451f', gold: '#ffc857',
  teal: '#14b3a7', tealDark: '#0b6f69', crimson: '#e23a5c', panel: 'rgba(255,246,228,0.97)', shadow: 'rgba(10,6,30,0.4)',
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
// Button looks: lacquered or carved plaques with depth. Each has a top/mid/bottom colour, a keyline, a text colour and a text relief.
const LOOK = {
  disabled: { g: ['#dcd5ca', '#c6beb0', '#aea597'], edge: 'rgba(70,56,40,0.45)', line: 'rgba(255,255,255,0.35)', ink: 'rgba(60,48,66,0.6)', rel: null },
  primary: { g: ['#ffb27a', '#f06a2c', '#b53a12'], edge: '#5a1c06', line: 'rgba(255,236,200,0.8)', ink: '#fff8ea', rel: 'rgba(90,24,0,0.55)' },
  active: { g: ['#4fe0d2', '#13aa9e', '#0a6a64'], edge: '#04403c', line: 'rgba(210,255,248,0.75)', ink: '#f4fffc', rel: 'rgba(0,50,46,0.55)' },
  dark: { g: ['#6a54b8', '#44338a', '#2a1d58'], edge: '#150d36', line: 'rgba(190,170,255,0.5)', ink: '#fff8ea', rel: 'rgba(10,4,40,0.6)' },
  plain: { g: ['#fffaf0', '#f3e2bd', '#dcc38f'], edge: '#7a4a22', line: 'rgba(255,255,255,0.9)', ink: '#221a3d', rel: 'rgba(255,255,255,0.7)' },
};
// One button look for the whole game: a lit plaque with a keyline and a bevel, a soft drop shadow, and it sinks 3 px while pressed.
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const dy = pressed ? 3 : 0, L = LOOK[k], rad = Math.min(18, r.h / 2);
  ctx.save();
  if (!disabled) { roundPath(ctx, r.x, r.y + (pressed ? 3 : 7), r.w, r.h, rad); ctx.fillStyle = pressed ? 'rgba(10,6,30,0.28)' : 'rgba(10,6,30,0.42)'; ctx.fill(); }
  const y = r.y + dy;
  // body
  roundPath(ctx, r.x, y, r.w, r.h, rad);
  const g = ctx.createLinearGradient(0, y, 0, y + r.h);
  g.addColorStop(0, L.g[0]); g.addColorStop(0.5, L.g[1]); g.addColorStop(1, L.g[2]);
  ctx.fillStyle = g; ctx.fill();
  if (pressed) { ctx.fillStyle = 'rgba(20,10,30,0.2)'; ctx.fill(); }
  ctx.lineWidth = 2.5; ctx.strokeStyle = L.edge; ctx.stroke();
  // bevel: lit top edge, shaded lower edge
  ctx.save(); roundPath(ctx, r.x + 2, y + 2, r.w - 4, r.h - 4, Math.max(2, rad - 2)); ctx.clip();
  ctx.lineWidth = 2; ctx.strokeStyle = L.line; ctx.globalAlpha = disabled ? 0.5 : 0.85;
  ctx.beginPath(); ctx.moveTo(r.x + rad, y + 2.5); ctx.lineTo(r.x + r.w - rad, y + 2.5); ctx.stroke();
  ctx.globalAlpha = 0.35; ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.beginPath(); ctx.moveTo(r.x + rad, y + r.h - 3); ctx.lineTo(r.x + r.w - rad, y + r.h - 3); ctx.stroke();
  ctx.restore();
  ctx.restore();
  return { dy, light: k !== 'plain' && k !== 'disabled', look: L };
}

export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28 } = opts;
  const { dy, look } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = sub ? Math.round(size * 0.9) : size;
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > r.w - 20 && px > 12) { px -= 1; ctx.font = `700 ${px}px ${FONT}`; }
  const ty = r.y + dy + r.h / 2 - (sub ? 11 : 0);
  if (look.rel) { ctx.fillStyle = look.rel; ctx.fillText(label, r.x + r.w / 2, ty + (look.ink === '#221a3d' ? 1.5 : 2)); }
  ctx.fillStyle = look.ink; ctx.fillText(label, r.x + r.w / 2, ty);
  if (sub) { ctx.font = `400 ${Math.round(size * 0.58)}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, r.x + r.w / 2, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function panel(ctx, x, y, w, h, o = {}) {
  const { r = 26, fill = C.panel, stroke = 'rgba(70,50,100,0.55)', shadow = true } = o;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 8, w, h, r); ctx.fillStyle = 'rgba(10,6,30,0.42)'; ctx.fill(); }
  roundPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke();
  roundPath(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 5)); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(217,163,90,0.7)'; ctx.stroke();
  ctx.restore();
}

// Embossed lettering: a stepped dark extrusion, a lit face (vertical gradient), a keyline and a highlight along the top.
export function embossText(ctx, text, x, y, size, o = {}) {
  const { top = '#fff6dc', bottom = '#ffc857', side = '#6a2e0c', edge = '#3a1606', depth = Math.max(3, size * 0.07), font = DISPLAY } = o;
  ctx.save();
  ctx.font = `700 ${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(10,4,24,0.7)'; ctx.shadowBlur = size * 0.16; ctx.shadowOffsetY = depth + 3;
  ctx.lineWidth = size * 0.1; ctx.strokeStyle = edge; ctx.strokeText(text, x, y + depth);
  ctx.shadowColor = 'transparent';
  for (let i = depth; i > 0; i -= 1) { ctx.fillStyle = side; ctx.lineWidth = size * 0.1; ctx.strokeStyle = side; ctx.strokeText(text, x, y + i); ctx.fillText(text, x, y + i); }
  const g = ctx.createLinearGradient(0, y - size * 0.75, 0, y + size * 0.05);
  g.addColorStop(0, top); g.addColorStop(0.55, bottom); g.addColorStop(1, o.bottom2 ?? bottom);
  ctx.lineWidth = size * 0.045; ctx.strokeStyle = edge; ctx.strokeText(text, x, y);
  ctx.fillStyle = g; ctx.fillText(text, x, y);
  ctx.globalCompositeOperation = 'source-atop';
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
  ctx.shadowColor = 'rgba(10,6,30,0.75)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
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
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(10,6,30,0.6)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
    } else if (wd.t === 'btn') drawButtonRect(ctx, { x: it.x, y, w: it.wd, h: it.h }, it, wd);
  }
  ctx.restore();
}
function drawButtonRect(ctx, r, it, wd) {
  const { dy, light, look } = paintButton(ctx, r, wd);
  ctx.save();
  ctx.fillStyle = look.ink;
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
