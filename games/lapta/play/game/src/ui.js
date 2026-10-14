// Shared drawing helpers for every screen: panels, flat buttons, wrapped text, the flow layout that scales with the
// player's text size and scrolls when it no longer fits (so nothing can overflow or clip at 300%).
export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
export const NUM = "'Avenir Next Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
export const C = {
  ink: '#14230f', cream: '#f8fff0', chalk: '#f8fff0', brass: '#f0b11f', brassDark: '#9a6b0e', red: '#c63a3a', redDark: '#7a1c1c',
  green: '#2f9a5a', greenDark: '#1d6a3a', wall: '#14230f', wood: '#3b2415', blue: '#2a6bd7', paper: 'rgba(14,34,20,0.94)', night: '#12301a',
  gold: '#f0b11f', steel: '#c8d4e4',
};

export function roundPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The look of the whole game: a village schoolhouse. Buttons are carved walnut plaques with a brass rim and a pressed state; the primary action is
// a gold lacquer plaque; panels are slate boards in a wooden frame. All painted with canvas gradients (no image files), cached grain per size.
const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
// wood grain: a few wavy strokes, seeded by the rectangle so a button never shimmers
function drawGrain(ctx, x, y, w, h) {
  let seed = (Math.round(x * 7 + y * 13 + w * 3) % 9973) + 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  ctx.save(); ctx.lineCap = 'round';
  const n = Math.max(6, Math.min(16, Math.round(h / 7)));
  for (let i = 0; i < n; i++) {
    const yy = y + (i + 0.5 + (rnd() - 0.5) * 0.7) * (h / n), a = 0.05 + rnd() * 0.1, amp = 0.8 + rnd() * 1.8, ph = rnd() * 6;
    ctx.strokeStyle = rnd() < 0.55 ? `rgba(20,8,0,${a})` : `rgba(255,226,170,${a * 0.7})`; ctx.lineWidth = 0.6 + rnd() * 1.3;
    ctx.beginPath(); ctx.moveTo(x, yy);
    for (let k = 1; k <= 6; k++) ctx.lineTo(x + (w * k) / 6, yy + Math.sin(k * 1.1 + ph) * amp);
    ctx.stroke();
  }
  ctx.restore();
}
const BTN = {
  disabled: { top: '#4a4f48', bot: '#33382f', rim: ['#7b8076', '#4a4f46'], text: 'rgba(255,255,255,0.38)' },
  primary: { top: '#ffd45c', bot: '#e29a12', rim: ['#fff1b0', '#8a5206'], text: '#2a1604' },
  active: { top: '#3fbf7a', bot: '#1c7a45', rim: ['#c5f5d8', '#0f4a28'], text: '#f4fff8' },
  dark: { top: '#3b2a1b', bot: '#24170d', rim: ['#b5934f', '#5b4217'], text: '#f4ead6' },
  plain: { top: '#6a4529', bot: '#3f2815', rim: ['#e9c46e', '#7a561b'], text: '#fff4dc' },
};
export function plaquePath(ctx, x, y, w, h, r) { roundPath(ctx, x, y, w, h, r); }
// A raised plaque: soft shadow, rim, body gradient, grain, top bevel light, bottom shade.
export function plaque(ctx, x, y, w, h, k, o = {}) {
  const st = BTN[k] || BTN.plain, r = o.r ?? Math.min(20, h * 0.3), dy = o.pressed ? 3 : 0, rim = Math.max(2.5, Math.min(4.5, h * 0.05));
  ctx.save();
  if (!o.noShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = o.pressed ? 4 : 12; ctx.shadowOffsetY = o.pressed ? 2 : 6;
    roundPath(ctx, x, y + dy, w, h, r); ctx.fillStyle = '#1a0f06'; ctx.fill();
    ctx.shadowColor = 'transparent';
  }
  // rim
  let g = ctx.createLinearGradient(x, y + dy, x, y + dy + h); g.addColorStop(0, st.rim[0]); g.addColorStop(1, st.rim[1]);
  roundPath(ctx, x, y + dy, w, h, r); ctx.fillStyle = g; ctx.fill();
  // body
  const bx = x + rim, by = y + dy + rim, bw = w - rim * 2, bh = h - rim * 2 - 1;
  g = ctx.createLinearGradient(bx, by, bx, by + bh); g.addColorStop(0, st.top); g.addColorStop(1, st.bot);
  roundPath(ctx, bx, by, bw, bh, Math.max(4, r - rim)); ctx.fillStyle = g; ctx.fill();
  if (k === 'plain' || k === 'dark') { ctx.save(); roundPath(ctx, bx, by, bw, bh, Math.max(4, r - rim)); ctx.clip(); drawGrain(ctx, bx, by, bw, bh); ctx.restore(); }
  // top light, bottom shade
  ctx.save(); roundPath(ctx, bx, by, bw, bh, Math.max(4, r - rim)); ctx.clip();
  g = ctx.createLinearGradient(0, by, 0, by + bh);
  g.addColorStop(0, 'rgba(255,255,255,0.34)'); g.addColorStop(0.18, 'rgba(255,255,255,0.08)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
  if (o.pressed) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(bx, by, bw, bh); }
  ctx.restore();
  ctx.restore();
  return { dy, text: st.text };
}
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const { dy, text } = plaque(ctx, r.x, r.y, r.w, r.h, k, { pressed, noShadow: disabled });
  return { dy, light: !primary, primary, text, kind: k };
}

// Little carved icons for the menu buttons: drawn as paths so they stay crisp at any size.
export function drawIcon(ctx, kind, cx, cy, s, col = '#fff4dc') {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 24, s / 24);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.4; ctx.strokeStyle = col; ctx.fillStyle = col;
  const P = () => ctx.beginPath();
  if (kind === 'bat') { ctx.rotate(-0.6); P(); ctx.roundRect ? ctx.roundRect(-3.2, -12, 6.4, 14, 3) : ctx.rect(-3.2, -12, 6.4, 14); ctx.fill(); ctx.fillRect(-1.2, 1.5, 2.4, 9); P(); ctx.arc(0, 12.5, 1.8, 0, 7); ctx.fill(); }
  else if (kind === 'rival') { for (const sx of [-6, 6]) { P(); ctx.arc(sx, -5, 3.4, 0, 7); ctx.fill(); P(); ctx.moveTo(sx - 5, 9); ctx.quadraticCurveTo(sx, -2, sx + 5, 9); ctx.fill(); } }
  else if (kind === 'two') { P(); ctx.arc(-6, -4, 3.4, 0, 7); ctx.fill(); P(); ctx.arc(6, -4, 3.4, 0, 7); ctx.fill(); P(); ctx.moveTo(-11, 9); ctx.quadraticCurveTo(-6, -2, -1, 9); ctx.fill(); P(); ctx.moveTo(1, 9); ctx.quadraticCurveTo(6, -2, 11, 9); ctx.fill(); }
  else if (kind === 'watch') { P(); ctx.moveTo(-11, 0); ctx.quadraticCurveTo(0, -11, 11, 0); ctx.quadraticCurveTo(0, 11, -11, 0); ctx.stroke(); P(); ctx.arc(0, 0, 3.6, 0, 7); ctx.fill(); }
  else if (kind === 'howto') { P(); ctx.arc(0, 0, 10, 0, 7); ctx.stroke(); P(); ctx.moveTo(-3.4, -3.4); ctx.quadraticCurveTo(-3, -6.5, 0, -6.5); ctx.quadraticCurveTo(4, -6.5, 4, -2.5); ctx.quadraticCurveTo(4, 0, 0, 1.5); ctx.lineTo(0, 3.5); ctx.stroke(); P(); ctx.arc(0, 7, 1.3, 0, 7); ctx.fill(); }
  else if (kind === 'rules') { P(); ctx.moveTo(-9, -9); ctx.lineTo(-1, -7); ctx.lineTo(-1, 9); ctx.lineTo(-9, 7); ctx.closePath(); ctx.stroke(); P(); ctx.moveTo(9, -9); ctx.lineTo(1, -7); ctx.lineTo(1, 9); ctx.lineTo(9, 7); ctx.closePath(); ctx.stroke(); }
  else if (kind === 'about') { P(); ctx.arc(0, 0, 10, 0, 7); ctx.stroke(); P(); ctx.arc(0, -4.8, 1.5, 0, 7); ctx.fill(); ctx.fillRect(-1.3, -1.5, 2.6, 9); }
  else if (kind === 'settings') { P(); ctx.arc(0, 0, 4, 0, 7); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; P(); ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.lineTo(Math.cos(a) * 10.5, Math.sin(a) * 10.5); ctx.stroke(); } P(); ctx.arc(0, 0, 7, 0, 7); ctx.stroke(); }
  else if (kind === 'resume') { P(); ctx.moveTo(-5, -9); ctx.lineTo(9, 0); ctx.lineTo(-5, 9); ctx.closePath(); ctx.fill(); }
  else if (kind === 'back') { P(); ctx.moveTo(8, -8); ctx.lineTo(-4, 0); ctx.lineTo(8, 8); ctx.stroke(); }
  else if (kind === 'restore') { P(); ctx.arc(0, 0, 8, 0.6, 5.4); ctx.stroke(); P(); ctx.moveTo(5, -9); ctx.lineTo(9, -3); ctx.lineTo(2, -3); ctx.closePath(); ctx.fill(); }
  else if (kind === 'menu') { for (const y of [-6, 0, 6]) { P(); ctx.moveTo(-9, y); ctx.lineTo(9, y); ctx.stroke(); } }
  ctx.restore();
}

export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28 } = opts;
  const { dy, text } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = text;
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
  const { r = 24, shadow = true, frame = true } = opts;
  ctx.save();
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; roundPath(ctx, x, y, w, h, r); ctx.fillStyle = '#1a0f06'; ctx.fill(); ctx.shadowColor = 'transparent'; }
  const fw = frame ? Math.max(7, Math.min(12, h * 0.04)) : 3;
  let g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#8a5a30'); g.addColorStop(0.5, '#5b3a1e'); g.addColorStop(1, '#3a2412');
  roundPath(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
  ctx.save(); roundPath(ctx, x, y, w, h, r); ctx.clip(); drawGrain(ctx, x, y, w, h); ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = '#d9b565'; roundPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r); ctx.stroke();
  // the slate
  const sx = x + fw, sy = y + fw, sw = w - fw * 2, sh = h - fw * 2, sr = Math.max(6, r - fw * 0.7);
  g = ctx.createLinearGradient(sx, sy, sx, sy + sh); g.addColorStop(0, '#1f3a2a'); g.addColorStop(1, '#122418');
  roundPath(ctx, sx, sy, sw, sh, sr); ctx.fillStyle = g; ctx.fill();
  ctx.save(); roundPath(ctx, sx, sy, sw, sh, sr); ctx.clip();
  g = ctx.createRadialGradient(sx + sw * 0.5, sy + sh * 0.35, 10, sx + sw * 0.5, sy + sh * 0.5, Math.max(sw, sh) * 0.75);
  g.addColorStop(0, 'rgba(255,255,255,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0.28)'); ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; roundPath(ctx, sx, sy, sw, sh, sr); ctx.stroke();
  ctx.restore();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(200,235,180,0.35)'; roundPath(ctx, sx + 1, sy + 1, sw - 2, sh - 2, sr); ctx.stroke();
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
function drawButtonRect(ctx, r0, it, wd) {
  const { disabled = false } = wd;
  const { dy, text } = paintButton(ctx, r0, wd);
  // an icon medallion on the left shifts the text to the right of it
  let r = r0;
  if (wd.icon && it.fs <= 36) {
    const isz = Math.min(r0.h * 0.5, 40), ix = r0.x + 18 + isz * 0.5;
    ctx.save(); ctx.beginPath(); ctx.arc(ix, r0.y + dy + r0.h / 2, isz * 0.78, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill(); ctx.restore();
    drawIcon(ctx, wd.icon, ix, r0.y + dy + r0.h / 2, isz, disabled ? 'rgba(255,255,255,0.4)' : wd.primary ? '#2a1604' : '#ffe9b0');
    const sh = isz * 1.2 + 14;
    r = { x: r0.x + sh, y: r0.y, w: r0.w - sh - 8, h: r0.h };
  }
  ctx.save();
  ctx.fillStyle = text;
  ctx.shadowColor = wd.primary ? 'rgba(255,240,180,0.6)' : 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = wd.primary ? 1 : 2;
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
