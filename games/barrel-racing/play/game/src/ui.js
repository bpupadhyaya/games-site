// Shared drawing helpers for every screen: rounded panels, flat buttons, wrapped text, the palette.
import { live, MIN_FONT } from './layout.js';
const subFs = (fs) => Math.max(MIN_FONT, Math.round(fs * 0.74));
export const FONT = "'Avenir Next', 'Segoe UI', 'Trebuchet MS', system-ui, sans-serif";
export const DISPLAY = "Georgia, 'Times New Roman', serif";
export const C = {
  ink: '#2a1a12', cream: '#fff6e4', sand: '#f3dfb8', vermilion: '#2f6fb0', vermDark: '#17406f', teal: '#2f8a62', tealDark: '#1b5a3e', indigo: '#2b2f5e',
  gold: '#ffc94d', shadow: 'rgba(24,12,4,0.4)', paper: 'rgba(255,246,228,0.96)', mute: 'rgba(255,246,228,0.72)',
};

export function roundPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// One flat button look for the whole game: a solid fill, ONE crisp border, a soft drop shadow and a
// pressed state (the button sinks 3 px and darkens while a finger that started on it is down).
const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
// Western tack look: tooled leather (a top-lit gradient, a dark rim, a soft highlight and a row of stitches), denim for the main action.
const BTN_FILL = {
  disabled: { g: ['#8d8c93', '#6f6e76', '#5a5961'], edge: '#3c3b42', stitch: 'rgba(255,255,255,0.28)', hi: 0.12 },
  primary: { g: ['#ffdf84', '#f0b53c', '#c27f1a'], edge: '#5a3306', stitch: 'rgba(90,51,6,0.55)', hi: 0.42 },   // the one gold primary: brass-gold with a dark brown label
  active: { g: ['#46a77d', '#2f8a62', '#1d5c40'], edge: '#0f3524', stitch: 'rgba(255,246,214,0.8)', hi: 0.3 },
  dark: { g: ['#6a4a30', '#4a3020', '#33200f'], edge: '#1a0e05', stitch: 'rgba(224,184,120,0.7)', hi: 0.2 },
  plain: { g: ['#f6dcaa', '#e5bd7e', '#c99a58'], edge: '#5a3818', stitch: 'rgba(92,56,24,0.62)', hi: 0.5 },
};
// a leather plate: used by the buttons, the panels and the HUD plaques so the whole game shares one material
export function leatherPlate(ctx, r, o = {}) {
  const { g, edge, stitch, hi } = o.look || BTN_FILL.plain, rad = o.r ?? 18, dy = o.dy || 0, y = r.y + dy;
  roundPath(ctx, r.x, y, r.w, r.h, rad);
  const gr = ctx.createLinearGradient(0, y, 0, y + r.h); gr.addColorStop(0, g[0]); gr.addColorStop(0.55, g[1]); gr.addColorStop(1, g[2]);
  ctx.fillStyle = gr; ctx.fill();
  // soft top highlight and a darker lower edge give it thickness
  ctx.save(); roundPath(ctx, r.x, y, r.w, r.h, rad); ctx.clip();
  const hg = ctx.createLinearGradient(0, y, 0, y + r.h * 0.5); hg.addColorStop(0, `rgba(255,255,255,${hi})`); hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg; ctx.fillRect(r.x, y, r.w, r.h * 0.5);
  const sg = ctx.createLinearGradient(0, y + r.h * 0.72, 0, y + r.h); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = sg; ctx.fillRect(r.x, y + r.h * 0.72, r.w, r.h * 0.28);
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = edge; roundPath(ctx, r.x, y, r.w, r.h, rad); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(255,255,255,${hi * 0.7})`; roundPath(ctx, r.x + 2.5, y + 2.5, r.w - 5, r.h - 5, Math.max(2, rad - 2)); ctx.stroke();
  if (r.h >= 44 && r.w >= 80 && o.stitch !== false) {
    ctx.save(); ctx.setLineDash([6, 5]); ctx.lineWidth = 1.6; ctx.strokeStyle = stitch;
    roundPath(ctx, r.x + 8, y + 8, r.w - 16, r.h - 16, Math.max(4, rad - 8)); ctx.stroke(); ctx.restore();
  }
}

// A wood plaque with a brass rim and corner rivets (the HUD plaques: scoreboard, clock). Grain lines are fixed per plaque size so it does not shimmer.
export function woodPlate(ctx, r, o = {}) {
  const rad = o.r ?? Math.min(16, r.h / 2.4), { x, y, w, h } = r;
  roundPath(ctx, x, y + 4, w, h, rad); ctx.fillStyle = 'rgba(10,4,0,0.4)'; ctx.fill();
  roundPath(ctx, x, y, w, h, rad);
  const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#6e4727'); gr.addColorStop(0.5, '#523320'); gr.addColorStop(1, '#3a2213');
  ctx.fillStyle = gr; ctx.fill();
  ctx.save(); roundPath(ctx, x, y, w, h, rad); ctx.clip();
  let seed = Math.round(w * 7 + h * 13) | 1; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.lineWidth = 1.4;
  for (let i = 0; i < Math.max(5, Math.round(h / 9)); i++) {
    const yy = y + 4 + rnd() * (h - 8), a = 0.05 + rnd() * 0.08;
    ctx.strokeStyle = rnd() < 0.5 ? `rgba(20,8,0,${a + 0.04})` : `rgba(255,220,170,${a})`;
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.bezierCurveTo(x + w * 0.3, yy + (rnd() - 0.5) * 6, x + w * 0.7, yy + (rnd() - 0.5) * 6, x + w, yy + (rnd() - 0.5) * 4); ctx.stroke();
  }
  const hg = ctx.createLinearGradient(0, y, 0, y + h * 0.45); hg.addColorStop(0, 'rgba(255,230,190,0.16)'); hg.addColorStop(1, 'rgba(255,230,190,0)');
  ctx.fillStyle = hg; ctx.fillRect(x, y, w, h * 0.45);
  ctx.restore();
  // brass rim (lit top, dark bottom) and rivets
  const br = ctx.createLinearGradient(0, y, 0, y + h); br.addColorStop(0, '#f3d27a'); br.addColorStop(0.5, '#c8963a'); br.addColorStop(1, '#7d5316');
  ctx.lineWidth = 3.2; ctx.strokeStyle = br; roundPath(ctx, x + 1.6, y + 1.6, w - 3.2, h - 3.2, rad - 1); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(20,8,0,0.5)'; roundPath(ctx, x + 4, y + 4, w - 8, h - 8, Math.max(3, rad - 4)); ctx.stroke();
  if (h >= 50) for (const [px, py] of [[x + 11, y + 11], [x + w - 11, y + 11], [x + 11, y + h - 11], [x + w - 11, y + h - 11]]) {
    const rg = ctx.createRadialGradient(px - 1.2, py - 1.2, 0.5, px, py, 4.5); rg.addColorStop(0, '#fff0b8'); rg.addColorStop(1, '#8a5d18');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, 3.6, 0, Math.PI * 2); ctx.fill();
  }
}
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const dy = pressed ? 3 : 0;
  ctx.save();
  if (!disabled) { roundPath(ctx, r.x, r.y + (pressed ? 3 : 6), r.w, r.h, 18); ctx.fillStyle = pressed ? 'rgba(20,8,0,0.25)' : 'rgba(20,8,0,0.38)'; ctx.fill(); }
  leatherPlate(ctx, r, { look: BTN_FILL[k], dy });
  if (pressed) { roundPath(ctx, r.x, r.y + dy, r.w, r.h, 18); ctx.fillStyle = 'rgba(20,8,0,0.18)'; ctx.fill(); }
  ctx.restore();
  return { dy, light: primary || active || dark };
}

// A flat pill. opts: primary (vermilion), active (teal), disabled, sub (small second line), size (font px)
export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28, icon = null } = opts;
  const { dy, light } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = disabled ? 'rgba(235,238,255,0.55)' : opts.primary ? '#2a1606' : light ? '#fffaf0' : C.ink;
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
  if (icon) icon(ctx, r.x + 32, r.y + dy + r.h / 2, opts.primary ? '#2a1606' : light && !disabled ? '#fffaf0' : C.ink);
  ctx.restore();
}

// The largest font size (<= px) at which `text` fits in maxW (never below min).
export function fitPx(ctx, text, weight, px, maxW, min = MIN_FONT) {
  ctx.font = `${weight} 100px ${FONT}`;
  const per = ctx.measureText(String(text)).width / 100 || 0.001;
  return Math.max(min, Math.min(px, Math.floor(maxW / per)));
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 26, fill = C.paper, stroke = 'rgba(28,37,82,0.5)', shadow = true } = opts;
  ctx.save();
  if (shadow) { roundPath(ctx, x, y + 6, w, h, r); ctx.fillStyle = 'rgba(20,8,0,0.38)'; ctx.fill(); }
  roundPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke();
  if (w > 120 && h > 60) {   // stitched rim and a brass hairline: the panel is a piece of tack too
    ctx.setLineDash([7, 6]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(224,184,120,0.55)';
    roundPath(ctx, x + 9, y + 9, w - 18, h - 18, Math.max(4, r - 9)); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(214,170,84,0.65)'; roundPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r - 1); ctx.stroke();
  }
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
  ctx.fillStyle = disabled ? 'rgba(235,238,255,0.55)' : wd.primary ? '#2a1606' : light ? '#fffaf0' : C.ink;
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
    ctx.font = `400 ${Math.max(MIN_FONT, Math.round(it.fs * 0.7))}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = wd.primary ? '#7a3c00' : light ? '#ffe9a0' : '#a8301f';
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
