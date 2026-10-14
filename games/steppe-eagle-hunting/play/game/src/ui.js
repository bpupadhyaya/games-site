// Shared drawing helpers for every screen: panels, flat buttons, wrapped text, the flow layout that scales with the
// player's text size and scrolls when it no longer fits (so nothing can overflow or clip at 300%).
export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
export const NUM = "'Avenir Next Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
export const C = {
  ink: '#0e1c33', cream: '#f4f8ff', chalk: '#f4f8ff', brass: '#f0b11f', brassDark: '#9a6b0e', red: '#c63a3a', redDark: '#7a1c1c',
  green: '#2f9a8a', greenDark: '#1d6a60', wall: '#0e1c33', wood: '#3b2415', blue: '#2a6bd7', paper: 'rgba(11,26,50,0.93)', night: '#0c1a2e',
  gold: '#f0b11f', steel: '#c8d4e4',
};

export function roundPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- the look: indigo felt, gold thread, lacquered buttons with depth ---------------------------------------------------------------------
// One button look for the whole game: a lacquered body with a lit top edge, a gold thread border, a hard base shadow and a pressed state (the
// button sinks 4 px and darkens while a finger that started on it is down). The primary button is brass.
const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
const BTN = {
  disabled: { top: '#4a566c', bot: '#2c3548', edge: 'rgba(255,255,255,0.14)', base: '#161c29', hi: 'rgba(255,255,255,0.05)' },
  primary: { top: '#ffe08a', bot: '#e39a14', edge: '#fff6cf', base: '#7a4a05', hi: 'rgba(255,255,255,0.5)' },
  active: { top: '#38b3a5', bot: '#157066', edge: '#a6f3e8', base: '#073a35', hi: 'rgba(255,255,255,0.26)' },
  dark: { top: '#22406e', bot: '#0f2347', edge: 'rgba(214,190,120,0.7)', base: '#050d1e', hi: 'rgba(255,255,255,0.14)' },
  plain: { top: '#2f5ba3', bot: '#173d78', edge: 'rgba(238,212,140,0.78)', base: '#07142b', hi: 'rgba(255,255,255,0.2)' },
};
let noiseCv = null;
const felt = (ctx) => {
  if (!noiseCv) {
    const od = ctx.canvas && ctx.canvas.ownerDocument;
    if (!od) return 'rgba(0,0,0,0)';
    const c = od.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d'); let a = 7;
    for (let i = 0; i < 1400; i++) { a = (a * 1664525 + 1013904223) >>> 0; const x = (a >>> 8) % 96; a = (a * 1664525 + 1013904223) >>> 0; const y = (a >>> 8) % 96; g.fillStyle = (a & 1) ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)'; g.fillRect(x, y, 1.5, 1.5); }
    noiseCv = c;
  }
  return ctx.createPattern(noiseCv, 'repeat');
};
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const B = BTN[k], rad = Math.min(18, r.h * 0.28), depth = pressed ? 1 : 5, dy = pressed ? 4 : 0;
  ctx.save();
  // base: the solid under-edge (gives the button real thickness)
  roundPath(ctx, r.x, r.y + depth + dy, r.w, r.h, rad); ctx.fillStyle = B.base; ctx.fill();
  if (!disabled && !pressed) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6; roundPath(ctx, r.x, r.y + depth, r.w, r.h, rad); ctx.fillStyle = B.base; ctx.fill(); ctx.restore(); }
  // body
  const gr = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h);
  gr.addColorStop(0, B.top); gr.addColorStop(1, B.bot);
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.fillStyle = gr; ctx.fill();
  ctx.save(); roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.clip();
  // felt grain, a soft sheen over the upper half and a darker lower lip
  ctx.fillStyle = felt(ctx); ctx.fillRect(r.x, r.y + dy, r.w, r.h);
  const sh = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h * 0.55);
  sh.addColorStop(0, B.hi); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(r.x, r.y + dy, r.w, r.h * 0.55);
  ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(r.x, r.y + dy + r.h - 5, r.w, 5);
  if (pressed) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(r.x, r.y + dy, r.w, r.h); }
  ctx.restore();
  // thread border (gold) and an inner dark line
  roundPath(ctx, r.x + 0.5, r.y + dy + 0.5, r.w - 1, r.h - 1, rad); ctx.lineWidth = 2; ctx.strokeStyle = B.edge; ctx.stroke();
  if (!disabled) { roundPath(ctx, r.x + 3.5, r.y + dy + 3.5, r.w - 7, r.h - 7, Math.max(2, rad - 3)); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.stroke(); }
  ctx.restore();
  return { dy, light: !primary, primary };
}

export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28 } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(255,255,255,0.35)' : (light ? '#f4f8ff' : C.ink);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = sub ? Math.round(size * 0.9) : size;
  const maxW = r.w - 24;
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > maxW && px > 13) { px -= 1; ctx.font = `700 ${px}px ${FONT}`; }
  ctx.fillText(label, r.x + r.w / 2, r.y + dy + r.h / 2 - (sub ? 11 : 0));
  if (sub) { ctx.font = `400 ${Math.round(size * 0.62)}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, r.x + r.w / 2, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1; }
  ctx.restore();
}

// A koshkar-muiz (ram's horn) scroll in a corner, drawn with a gold stroke. s = size in px; (fx, fy) mirror it.
export function hornCorner(ctx, x, y, s, fx = 1, fy = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(fx, fy);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const g = ctx.createLinearGradient(0, 0, s, s); g.addColorStop(0, '#fff0b8'); g.addColorStop(1, '#c58d22');
  ctx.strokeStyle = g; ctx.lineWidth = Math.max(1.6, s * 0.07);
  ctx.beginPath();
  ctx.moveTo(s * 0.06, s * 0.9);
  ctx.bezierCurveTo(s * 0.04, s * 0.45, s * 0.3, s * 0.08, s * 0.7, s * 0.1);
  ctx.bezierCurveTo(s * 0.95, s * 0.12, s * 0.98, s * 0.46, s * 0.76, s * 0.5);
  ctx.bezierCurveTo(s * 0.6, s * 0.52, s * 0.55, s * 0.32, s * 0.68, s * 0.28);
  ctx.stroke();
  ctx.fillStyle = '#ffe9a6'; ctx.beginPath(); ctx.arc(s * 0.66, s * 0.3, s * 0.045, 0, 7); ctx.fill();
  ctx.restore();
}

// A plaque: indigo felt with a gold thread border, soft shadow, grain and optional horn corners.
export function plaque(ctx, x, y, w, h, o = {}) {
  const { r = 22, alpha = 0.94, corners = w > 220 && h > 120, glow = false } = o;
  ctx.save();
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; roundPath(ctx, x, y, w, h, r); ctx.fillStyle = 'rgba(8,16,34,0.9)'; ctx.fill(); ctx.restore();
  const gr = ctx.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, o.top || `rgba(36,56,98,${alpha})`); gr.addColorStop(1, o.bot || `rgba(13,26,52,${alpha})`);
  roundPath(ctx, x, y, w, h, r); ctx.fillStyle = gr; ctx.fill();
  ctx.save(); roundPath(ctx, x, y, w, h, r); ctx.clip();
  ctx.fillStyle = felt(ctx); ctx.fillRect(x, y, w, h);
  const hi = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 60)); hi.addColorStop(0, 'rgba(255,255,255,0.12)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hi; ctx.fillRect(x, y, w, Math.min(h, 60));
  ctx.restore();
  const eg = ctx.createLinearGradient(x, y, x, y + h); eg.addColorStop(0, '#ffe9a6'); eg.addColorStop(0.5, '#d2a23a'); eg.addColorStop(1, '#8b5f12');
  roundPath(ctx, x + 1, y + 1, w - 2, h - 2, r); ctx.lineWidth = 2.4; ctx.strokeStyle = eg; ctx.stroke();
  roundPath(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 4)); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,230,160,0.28)'; ctx.stroke();
  if (corners) { const s = Math.min(34, Math.min(w, h) * 0.2); hornCorner(ctx, x + 8, y + 8, s, 1, 1); hornCorner(ctx, x + w - 8, y + 8, s, -1, 1); hornCorner(ctx, x + 8, y + h - 8, s, 1, -1); hornCorner(ctx, x + w - 8, y + h - 8, s, -1, -1); }
  if (glow) { roundPath(ctx, x - 3, y - 3, w + 6, h + 6, r + 3); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,224,138,0.6)'; ctx.stroke(); }
  ctx.restore();
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 24 } = opts;
  plaque(ctx, x, y, w, h, { r, alpha: 0.95, corners: opts.corners ?? (w > 300 && h > 200) });
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
  ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
  ctx.restore();
}
export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3),
  outBack: (t) => { t = Math.min(1, Math.max(0, t)); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOut: (t) => { t = Math.min(1, Math.max(0, t)); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
};

// ---------------------------------------------------------------------------------------------
// Flow layout: a vertical list of widgets (headings, paragraphs, buttons, custom art).
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
      if (tooWide || (scale > 1.5 && group.length > 1)) {
        widgets.splice(i, 0, ...group.map((g) => ({ ...g, row: undefined, h: g.h ?? 76 })));
        continue;
      }
      let hmax = 0;
      const prepared = group.map((g) => {
        ctx.font = `700 ${fs}px ${FONT}`;
        const lines = wrapLines(ctx, g.label, cw0 - 28);
        const sub = g.sub ? wrapLines(ctx, g.sub, cw0 - 28).length : 0;
        const h = Math.max(g.h ?? 76, lines.length * fs * 1.15 + sub * fs * 0.8 + 34);
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
      const lines = wrapLines(ctx, wd.label, w0);
      const h = lines.length * fs * 1.18;
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
      continue;
    }
    if (wd.t === 'p') {
      const fs = Math.round((wd.size ?? 26) * Math.min(scale, wd.cap ?? 3));
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
      const starsH = wd.stars && fs > 30 ? fs * 0.85 : 0;   // big text: the stars get a line of their own
      const h = Math.max(wd.h ?? 84, lines.length * fs * 1.15 + sub * fs * 0.8 + starsH + 34);
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
    }
  }
  return { items: out, contentH: y };
}

export function drawFlow(ctx, lay, top, bottom, scroll) {
  ctx.save();
  ctx.beginPath(); ctx.rect(-4000, top, 8000, bottom - top); ctx.clip();
  for (const it of lay.items) {
    const y = top + it.y - scroll;
    if (y > bottom || y + it.h < top) continue;
    const wd = it.w;
    if (wd.t === 'art') { ctx.save(); ctx.translate(it.x, y); wd.draw(ctx, it.wd, it.h); ctx.restore(); }
    else if (wd.t === 'h') {
      ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#f4f8ff', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(240,247,255,0.96)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
    } else if (wd.t === 'btn') drawButtonRect(ctx, { x: it.x, y, w: it.wd, h: it.h }, it, wd);
  }
  ctx.restore();
}
function drawButtonRect(ctx, r, it, wd) {
  const { disabled = false } = wd;
  const { dy, light } = paintButton(ctx, r, wd);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(255,255,255,0.35)' : (light ? '#f4f8ff' : C.ink);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${it.fs}px ${FONT}`;
  const subLines = wd.sub ? (() => { ctx.font = `400 ${Math.round(it.fs * 0.8)}px ${FONT}`; const l = wrapLines(ctx, wd.sub, r.w - 28); ctx.font = `700 ${it.fs}px ${FONT}`; return l; })() : [];
  const total = it.lines.length * it.fs * 1.15 + subLines.length * it.fs * 0.8;
  const starsH = wd.stars && it.fs > 30 ? it.fs * 0.85 : 0;
  let y = r.y + dy + (r.h - total - starsH) / 2 + it.fs * 0.88;
  it.lines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 1.15; });
  if (subLines.length) {
    ctx.font = `400 ${Math.round(it.fs * 0.8)}px ${FONT}`; ctx.globalAlpha = 0.85;
    y -= it.fs * 0.2;
    subLines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 0.8; });
    ctx.globalAlpha = 1;
  }
  if (wd.stars) {
    ctx.font = `400 ${Math.round(it.fs * 0.8)}px ${FONT}`; ctx.fillStyle = '#ffd36a';
    const row = '★'.repeat(wd.stars) + '☆'.repeat(5 - wd.stars);
    if (starsH) { ctx.textAlign = 'center'; ctx.fillText(row, r.x + r.w / 2, r.y + dy + r.h - (r.h - total - starsH) / 2 - starsH * 0.2); }
    else { ctx.textAlign = 'right'; ctx.fillText(row, r.x + r.w - 16, r.y + dy + it.fs * 0.95); }
  }
  ctx.restore();
}
export function flowHit(lay, top, scroll, x, y) {
  for (const it of lay.items) {
    const tapArt = it.w.t === 'art' && it.w.id;
    if (!tapArt && (it.w.t !== 'btn' || (it.w.disabled && !it.w.hitDisabled))) continue;
    const yy = top + it.y - scroll;
    if (tapArt) { const hw = Math.min(it.wd, it.w.hitW ?? it.wd) / 2, cx = it.x + it.wd / 2; if (x >= cx - hw && x <= cx + hw && y >= yy && y <= yy + it.h) return it.w.id; continue; }
    if (x >= it.x && x <= it.x + it.wd && y >= yy && y <= yy + it.h) return it.w.id;
  }
  return null;
}
