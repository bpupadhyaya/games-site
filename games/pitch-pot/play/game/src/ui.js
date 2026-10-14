// Shared drawing helpers for every screen: panels, flat buttons, wrapped text, the flow layout that scales with the
// player's text size and scrolls when it no longer fits (so nothing can overflow or clip at 300%).
export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
export const NUM = "'Avenir Next Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
export const C = {
  ink: '#14100d', cream: '#f6ecd2', paper: 'rgba(22,16,13,0.94)', night: '#14100d', lacquer: '#1b1512', vermilion: '#c8321f', vermilionDark: '#6e1a0e',
  gold: '#d8a54a', goldDark: '#6a4510', jade: '#3aa88a', jadeDark: '#1d5e4c', bronze: '#a9793a', rice: '#f3ead2',
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
// Lacquered buttons: a vertical lacquer gradient, a bevelled highlight on the upper edge, a thin gold rim, a dark ledge underneath that gives the face its
// depth, and a pressed state that sinks the face onto the ledge.  [top, bottom, rim, highlight, ledge]
const BTN = {
  disabled: ['#3a3430', '#2a2522', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.06)', '#1a1512'],
  primary: ['#fbe29a', '#c58f2c', '#fff0c0', 'rgba(255,255,255,0.75)', '#5c3a0a'],
  active: ['#d8442b', '#8a1d10', '#ff9a80', 'rgba(255,200,180,0.55)', '#4a0f08'],
  dark: ['#2e231d', '#17110d', 'rgba(216,165,74,0.55)', 'rgba(255,230,180,0.18)', '#070403'],
  plain: ['#4a362b', '#241a15', 'rgba(216,165,74,0.7)', 'rgba(255,230,180,0.28)', '#090504'],
};
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const [top, bot, rim, hi, ledge] = BTN[k];
  const dy = pressed ? 4 : 0, rad = Math.min(20, r.h * 0.3), depth = pressed ? 1 : 5;
  ctx.save();
  if (!disabled) {
    roundPath(ctx, r.x, r.y + depth + 1, r.w, r.h, rad); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
    roundPath(ctx, r.x, r.y + depth, r.w, r.h, rad); ctx.fillStyle = ledge; ctx.fill();
  }
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad);
  const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h); g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fill();
  if (pressed) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill(); }
  // bevel: light on the upper edge fading to the rim colour at the bottom
  roundPath(ctx, r.x + 1.5, r.y + dy + 1.5, r.w - 3, r.h - 3, rad - 1.5);
  const sg = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h); sg.addColorStop(0, hi); sg.addColorStop(0.45, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.lineWidth = 2; ctx.strokeStyle = sg; ctx.stroke();
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.lineWidth = 2; ctx.strokeStyle = rim; ctx.stroke();
  ctx.restore();
  return { dy, light: !primary, primary };
}

// Small line icons for the menu buttons (stroke only, drawn in the label colour).
export function drawIcon(ctx, id, cx, cy, s, col) {
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(2, s * 0.09); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const h = s / 2;
  const person = (x, sc = 1) => { ctx.beginPath(); ctx.arc(x, -h * 0.45 * sc, h * 0.28 * sc, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - h * 0.5 * sc, h * 0.75 * sc); ctx.quadraticCurveTo(x, -h * 0.1 * sc, x + h * 0.5 * sc, h * 0.75 * sc); ctx.stroke(); };
  switch (id) {
    case 'play': ctx.beginPath(); ctx.moveTo(-h * 0.7, h * 0.7); ctx.lineTo(h * 0.65, -h * 0.65); ctx.stroke(); ctx.beginPath(); ctx.moveTo(h * 0.65, -h * 0.65); ctx.lineTo(h * 0.05, -h * 0.6); ctx.moveTo(h * 0.65, -h * 0.65); ctx.lineTo(h * 0.6, h * 0.0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-h * 0.7, h * 0.7); ctx.lineTo(-h * 0.35, h * 0.62); ctx.moveTo(-h * 0.7, h * 0.7); ctx.lineTo(-h * 0.62, h * 0.35); ctx.stroke(); break;
    case 'two': person(-h * 0.45, 0.85); person(h * 0.45, 0.85); break;
    case 'solo': person(0, 1); break;
    case 'watch': ctx.beginPath(); ctx.moveTo(-h, 0); ctx.quadraticCurveTo(0, -h * 1.0, h, 0); ctx.quadraticCurveTo(0, h * 1.0, -h, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, h * 0.32, 0, 7); ctx.fill(); break;
    case 'howto': ctx.beginPath(); ctx.arc(0, 0, h * 0.95, 0, 7); ctx.stroke(); ctx.font = `800 ${Math.round(s * 0.62)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, s * 0.04); break;
    case 'about': ctx.beginPath(); ctx.arc(0, 0, h * 0.95, 0, 7); ctx.stroke(); ctx.font = `800 ${Math.round(s * 0.6)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('i', 0, s * 0.04); break;
    case 'rules': ctx.beginPath(); ctx.roundRect(-h * 0.7, -h * 0.9, h * 1.4, h * 1.8, 3); ctx.stroke(); for (const y of [-0.45, -0.05, 0.35]) { ctx.beginPath(); ctx.moveTo(-h * 0.4, h * y); ctx.lineTo(h * 0.4, h * y); ctx.stroke(); } break;
    case 'settings': ctx.beginPath(); ctx.arc(0, 0, h * 0.4, 0, 7); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.2832; ctx.beginPath(); ctx.moveTo(Math.cos(a) * h * 0.62, Math.sin(a) * h * 0.62); ctx.lineTo(Math.cos(a) * h * 0.92, Math.sin(a) * h * 0.92); ctx.stroke(); } break;
    case 'resume': ctx.beginPath(); ctx.moveTo(-h * 0.5, -h * 0.75); ctx.lineTo(h * 0.75, 0); ctx.lineTo(-h * 0.5, h * 0.75); ctx.closePath(); ctx.fill(); break;
    default: break;
  }
  ctx.restore();
}

export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28 } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(255,255,255,0.35)' : (light ? '#fbefd2' : C.ink);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = sub ? Math.round(size * 0.9) : size;
  const maxW = r.w - 24;
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > maxW && px > 13) { px -= 1; ctx.font = `700 ${px}px ${FONT}`; }
  const ox = opts.icon ? (Math.min(34, r.h * 0.42) + 14) / 2 : 0;
  if (opts.icon) drawIcon(ctx, opts.icon, r.x + 20 + Math.min(34, r.h * 0.42) / 2, r.y + dy + r.h / 2, Math.min(34, r.h * 0.42), disabled ? 'rgba(255,255,255,0.35)' : (light ? '#ffe3a0' : C.ink));
  ctx.fillText(label, r.x + r.w / 2 + ox, r.y + dy + r.h / 2 - (sub ? 11 : 0));
  if (sub) { ctx.font = `400 ${Math.round(size * 0.62)}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, r.x + r.w / 2, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1; }
  ctx.restore();
}

// A carved lacquer plaque: dark ebony body with faint grain, a double rim (dark outer, gold inner hairline) and four brass studs.
export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 24, fill = C.paper, stroke = 'rgba(216,165,74,0.6)', shadow = true, lw = 2.5, studs = true } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 7, w, h, r); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); }
  roundPath(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#2c211b'); g.addColorStop(1, '#130d0a');
  ctx.fillStyle = fill === C.paper ? g : fill; ctx.fill();
  if (fill === C.paper) { ctx.save(); ctx.clip(); ctx.globalAlpha = 0.05; ctx.fillStyle = '#fff'; for (let yy = y + 6; yy < y + h; yy += 9) ctx.fillRect(x, yy, w, 1); ctx.restore(); }
  ctx.lineWidth = lw + 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.stroke();
  roundPath(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(4, r - 3)); ctx.lineWidth = 1.6; ctx.strokeStyle = stroke; ctx.stroke();
  if (studs && w > 120 && h > 80) for (const [sx, sy] of [[x + 14, y + 14], [x + w - 14, y + 14], [x + 14, y + h - 14], [x + w - 14, y + h - 14]]) {
    ctx.beginPath(); ctx.arc(sx, sy, 3.6, 0, 7); const sg = ctx.createRadialGradient(sx - 1, sy - 1, 0.5, sx, sy, 4); sg.addColorStop(0, '#fff0b8'); sg.addColorStop(1, '#8a5f20'); ctx.fillStyle = sg; ctx.fill();
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
        const ip = g.icon ? 40 : 0;
        const lines = wrapLines(ctx, g.label, cw0 - 28 - ip);
        const sub = g.sub ? wrapLines(ctx, g.sub, cw0 - 28 - ip).length : 0;
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
      const ip = wd.icon ? 40 : 0;
      const lines = wrapLines(ctx, wd.label, w0 - 28 - ip);
      const sub = wd.sub ? wrapLines(ctx, wd.sub, w0 - 28 - ip).length : 0;
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
  ctx.fillStyle = disabled ? 'rgba(255,255,255,0.35)' : (light ? '#fbefd2' : C.ink);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${it.fs}px ${FONT}`;
  const subLines = wd.sub ? (() => { ctx.font = `400 ${Math.round(it.fs * 0.8)}px ${FONT}`; const l = wrapLines(ctx, wd.sub, r.w - 28 - (wd.icon ? 40 : 0)); ctx.font = `700 ${it.fs}px ${FONT}`; return l; })() : [];
  const total = it.lines.length * it.fs * 1.15 + subLines.length * it.fs * 0.8;
  const starsH = wd.stars && it.fs > 30 ? it.fs * 0.85 : 0;
  let y = r.y + dy + (r.h - total - starsH) / 2 + it.fs * 0.88;
  const isz = Math.min(36, r.h * 0.42), ox = wd.icon ? (isz + 14) / 2 : 0;
  if (wd.icon) drawIcon(ctx, wd.icon, r.x + 20 + isz / 2, r.y + dy + r.h / 2, isz, disabled ? 'rgba(255,255,255,0.35)' : (light ? '#ffe3a0' : C.ink));
  it.lines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2 + ox, y); y += it.fs * 1.15; });
  if (subLines.length) {
    ctx.font = `400 ${Math.round(it.fs * 0.8)}px ${FONT}`; ctx.globalAlpha = 0.85;
    y -= it.fs * 0.2;
    subLines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2 + ox, y); y += it.fs * 0.8; });
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
