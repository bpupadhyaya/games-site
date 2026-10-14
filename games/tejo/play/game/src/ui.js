// Shared drawing helpers for every screen: panels, flat buttons, wrapped text, the flow layout that scales with the
// player's text size and scrolls when it no longer fits (so nothing can overflow or clip at 300%).
export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
export const NUM = "'Avenir Next Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
export const C = {
  ink: '#1a1330', cream: '#fff1d2', chalk: '#fbf3df', brass: '#f0b11f', brassDark: '#9a6b0e', red: '#d3272f', redDark: '#85141a',
  green: '#2f9a63', greenDark: '#1d6340', wall: '#120e2b', wood: '#3b2415', blue: '#2a5bd7', paper: 'rgba(24,18,52,0.94)', night: '#120e2b',
  clay: '#b9552f', gold: '#f0b11f', steel: '#c8cfd8',
};

export function roundPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// One flat button look for the whole game: a solid fill, one crisp edge, a hard drop shadow and a pressed state
// (the button sinks 3 px and darkens while a finger that started on it is down). No gloss, no inner shapes.
const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
// Buttons are lacquered walnut and enamel with a real thickness: a dark underside you see below the face, a lit top edge, a brass rim on the
// primary one. Pressed, the face sinks onto its underside. The face is r.h - 7 tall so the whole thing occupies exactly the old rectangle.
const BTN = {
  disabled: { top: '#4a4660', bot: '#34304a', side: '#1c1a2c', edge: 'rgba(255,255,255,0.10)', hi: 'rgba(255,255,255,0.10)' },
  primary: { top: '#ffd45e', bot: '#e09a12', side: '#8a5a08', edge: '#fff0b0', hi: 'rgba(255,255,255,0.55)' },
  active: { top: '#4a7cf0', bot: '#2349b8', side: '#12266e', edge: '#a9c4ff', hi: 'rgba(255,255,255,0.4)' },
  dark: { top: '#3a2a22', bot: '#22160f', side: '#0b0705', edge: 'rgba(240,190,110,0.5)', hi: 'rgba(255,230,190,0.22)' },
  plain: { top: '#5b3a26', bot: '#3a2314', side: '#150b05', edge: 'rgba(240,190,110,0.7)', hi: 'rgba(255,230,190,0.3)' },
};
const SIDE = 7;
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const c = BTN[k], rad = Math.min(18, r.h / 3), fh = r.h - SIDE, py = pressed ? SIDE - 3 : 0;
  ctx.save();
  // soft drop shadow on the table
  if (!disabled) { roundPath(ctx, r.x + 2, r.y + 6 + (pressed ? -3 : 0), r.w - 4, r.h, rad); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); }
  // the underside
  roundPath(ctx, r.x, r.y + py + 3, r.w, fh + SIDE - 3 - py, rad); ctx.fillStyle = c.side; ctx.fill();
  // the face
  roundPath(ctx, r.x, r.y + py, r.w, fh, rad);
  const g = ctx.createLinearGradient(0, r.y + py, 0, r.y + py + fh); g.addColorStop(0, c.top); g.addColorStop(1, c.bot);
  ctx.fillStyle = g; ctx.fill();
  if (pressed) { ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fill(); }
  ctx.lineWidth = 1.6; ctx.strokeStyle = c.edge; ctx.stroke();
  // lit top edge
  ctx.beginPath(); ctx.moveTo(r.x + rad, r.y + py + 2.5); ctx.lineTo(r.x + r.w - rad, r.y + py + 2.5); ctx.lineWidth = 2; ctx.strokeStyle = c.hi; ctx.stroke();
  ctx.restore();
  return { dy: pressed ? 0 : -(SIDE - 3) / 2 - 0.5, light: !primary, primary };
}

export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28 } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(255,255,255,0.35)' : (light ? '#fff4dc' : C.ink);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = sub ? Math.round(size * 0.9) : size;
  const maxW = r.w - 24;
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > maxW && px > 13) { px -= 1; ctx.font = `700 ${px}px ${FONT}`; }
  ctx.fillText(label, r.x + r.w / 2, r.y + dy + r.h / 2 - (sub ? 11 : 0));
  if (sub) { ctx.font = `400 ${Math.round(size * 0.62)}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, r.x + r.w / 2, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 24, fill = null, stroke = 'rgba(224,170,70,0.85)', shadow = true, lw = 2.5, accent = null } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x + 2, y + 8, w - 4, h, r); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); }
  // outer timber frame
  roundPath(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#6a4428'); g.addColorStop(0.5, '#43291a'); g.addColorStop(1, '#2a180e');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = accent || stroke; ctx.stroke();
  // inset slate
  const ins = Math.min(8, Math.max(5, h * 0.08));
  roundPath(ctx, x + ins, y + ins, w - ins * 2, h - ins * 2, Math.max(6, r - ins * 0.8));
  const g2 = ctx.createLinearGradient(0, y, 0, y + h); g2.addColorStop(0, fill || 'rgba(34,24,22,0.97)'); g2.addColorStop(1, fill || 'rgba(18,12,14,0.97)');
  ctx.fillStyle = g2; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
  // lit top rim of the timber
  ctx.beginPath(); ctx.moveTo(x + r, y + 1.5); ctx.lineTo(x + w - r, y + 1.5); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,225,170,0.35)'; ctx.stroke();
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
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#fff3d6', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(255,243,214,0.95)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
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
  ctx.fillStyle = disabled ? 'rgba(255,255,255,0.35)' : (light ? '#fff4dc' : C.ink);
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
