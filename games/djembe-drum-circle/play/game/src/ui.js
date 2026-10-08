// Small drawing kit for menus and pages: text, panels, buttons, and a scrolling block-text area with zoom.
import { FONT, UI, PAL, rgba } from './art.js';
import { BRAND, brandGradient } from './brand.js';

export function txt(ctx, s, x, y, size, o = {}) {
  ctx.font = `${o.weight ?? 600} ${size}px ${o.font === 'display' ? FONT : UI}`;
  if (o.font === 'display') ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'alphabetic';
  if (o.shadow) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(s, x + size * 0.04, y + size * 0.05); }
  ctx.fillStyle = o.color ?? PAL.cream; ctx.fillText(s, x, y);
}
// Greedy word wrap. Returns lines for a given width.
export function wrap(ctx, s, maxW, size, font = UI, weight = 500) {
  ctx.font = `${weight} ${size}px ${font}`;
  const words = String(s).split(/\s+/), lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
export function fitText(ctx, s, maxW, size, weight = 700, font = UI) {
  let sz = size; ctx.font = `${weight} ${sz}px ${font}`;
  while (sz > 12 && ctx.measureText(s).width > maxW) { sz -= 1; ctx.font = `${weight} ${sz}px ${font}`; }
  return sz;
}

export function panel(ctx, r, { radius = 22, fill = PAL.panel, line = PAL.line, brand = false } = {}) {
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, radius); ctx.fillStyle = fill; ctx.fill();
  if (brand) { ctx.lineWidth = 2; ctx.strokeStyle = brandGradient(ctx, r.x, r.y, r.x + r.w, r.y + r.h, 0.55); ctx.stroke(); }
  else { ctx.lineWidth = 1.5; ctx.strokeStyle = line; ctx.stroke(); }
}

// Buttons. style: 'primary' (gold) | 'ghost' | 'card' (a mode card with a title and a line under it) | 'danger'
export function button(ctx, r, label, { style = 'ghost', active = false, disabled = false, size = 30, sub = null, press = 0, inset = 0 } = {}) {
  ctx.save();
  const rad = Math.min(24, r.h * 0.3), a = disabled ? 0.45 : 1;
  ctx.globalAlpha = a;
  ctx.beginPath(); ctx.roundRect(r.x, r.y + press, r.w, r.h, rad);
  if (style === 'primary') {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#ffd98a'); g.addColorStop(1, '#e39a3a'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,240,200,0.6)'; ctx.stroke();
  } else if (style === 'card') {
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h); g.addColorStop(0, 'rgba(70,32,36,0.92)'); g.addColorStop(1, 'rgba(34,14,24,0.94)'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = active ? PAL.gold : 'rgba(244,196,106,0.4)'; ctx.stroke();
  } else if (style === 'danger') {
    ctx.fillStyle = 'rgba(120,30,40,0.85)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,150,150,0.5)'; ctx.stroke();
  } else {
    ctx.fillStyle = active ? 'rgba(244,196,106,0.2)' : 'rgba(30,14,24,0.78)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = active ? PAL.gold : 'rgba(244,196,106,0.4)'; ctx.stroke();
  }
  size = Math.min(size, r.h * (sub ? 0.34 : 0.46));
  const col = style === 'primary' ? '#2a1204' : PAL.cream;
  const cxm = r.x + inset + (r.w - inset) / 2;
  if (sub) {
    const sz = fitText(ctx, label, r.w - inset - 24, size, 800);
    txt(ctx, label, cxm, r.y + r.h * 0.46 + press, sz, { align: 'center', color: col, weight: 800 });
    const sz2 = fitText(ctx, sub, r.w - inset - 24, Math.max(20, size * 0.66), 500);
    txt(ctx, sub, cxm, r.y + r.h * 0.46 + press + sz2 * 1.35, sz2, { align: 'center', color: style === 'primary' ? '#4a2a0c' : PAL.dim, weight: 500 });
  } else {
    const sz = fitText(ctx, label, r.w - 20, size, 800);
    txt(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.35 + press, sz, { align: 'center', color: col, weight: 800 });
  }
  ctx.restore();
}

export function stars(ctx, cx, cy, n, size, { of = 3 } = {}) {
  for (let i = 0; i < of; i++) {
    const x = cx + (i - (of - 1) / 2) * size * 1.25;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let k = 0; k < 10; k++) { const rr = k % 2 ? size * 0.2 : size * 0.5, a = -Math.PI / 2 + (k * Math.PI) / 5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    if (i < n) { ctx.fillStyle = '#ffd36a'; ctx.fill(); ctx.strokeStyle = '#a8681a'; } else { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; }
    ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
}

// ---- block text with zoom and scroll ---------------------------------------------------------------------------------------------
// blocks: { h } heading, { p } paragraph, { li: [] } bullets, { draw: key } illustration (drawn by the caller-supplied `draws`).
export function blockHeight(ctx, blocks, width, scale, draws) {
  return layout(ctx, blocks, width, scale, draws).total;
}
function layout(ctx, blocks, width, scale, draws) {
  const body = 29 * scale, head = 40 * scale, items = []; let y = 0;
  for (const b of blocks) {
    if (b.h) { y += items.length ? body * 0.7 : 0; const hl = wrap(ctx, b.h, width, head, FONT, 700); hl.forEach((l, i) => items.push({ t: 'h', y: y + head * (1 + i * 1.12), s: l, size: head })); y += head * (0.35 + hl.length * 1.12); }
    else if (b.p) { const lines = wrap(ctx, b.p, width, body); lines.forEach((l, i) => items.push({ t: 'p', y: y + body * (1.28 + i * 1.34), s: l, size: body, c: b.color })); y += lines.length * body * 1.34 + body * 0.55; }
    else if (b.li) for (const li of b.li) { const lines = wrap(ctx, li, width - body * 1.1, body); lines.forEach((l, i) => items.push({ t: 'li', y: y + body * (1.28 + i * 1.34), s: l, size: body, dot: i === 0 })); y += lines.length * body * 1.34 + body * 0.42; }
    else if (b.draw) { const hh = draws[b.draw]?.h(width, scale) ?? 0; items.push({ t: 'd', y, h: hh, key: b.draw }); y += hh + body * 0.5; }
  }
  return { items, total: y, body };
}
export function drawBlocks(ctx, rect, blocks, scale, scroll, draws, colors = {}) {
  const innerW = rect.w - 18, { items, total, body } = layout(ctx, blocks, innerW, scale, draws);
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const oy = rect.y - scroll;
  for (const it of items) {
    const y = oy + it.y;
    if (y < rect.y - 80 * scale || y > rect.y + rect.h + 80 * scale) continue;
    if (it.t === 'h') txt(ctx, it.s, rect.x, y, it.size, { font: 'display', color: colors.head ?? PAL.gold });
    else if (it.t === 'p') txt(ctx, it.s, rect.x, y, it.size, { weight: 500, color: it.c ?? colors.body ?? PAL.cream });
    else if (it.t === 'li') {
      if (it.dot) { ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(rect.x + body * 0.3, y - body * 0.32, body * 0.14, 0, 7); ctx.fill(); }
      txt(ctx, it.s, rect.x + body * 1.1, y, it.size, { weight: 500, color: colors.body ?? PAL.cream });
    } else if (it.t === 'd') draws[it.key].draw(ctx, { x: rect.x, y, w: innerW, h: it.h }, scale);
  }
  ctx.restore();
  return total;
}

// Scroll bar for a text area.
export function scrollbar(ctx, r, scroll, total, view) {
  if (total <= view + 2) return;
  const th = Math.max(40, (r.h * view) / total), ty = r.y + (scroll / (total - view)) * (r.h - th);
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 4); ctx.fill();
  ctx.fillStyle = 'rgba(244,196,106,0.7)'; ctx.beginPath(); ctx.roundRect(r.x, ty, r.w, th, 4); ctx.fill();
}

// Arcforge credit (title screen) and the quiet "more games" row (result screen). Same pattern as the other Arcforge games.
export { BRAND, rgba };
