// A small text-zoom-aware UI kit for canvas screens: wrapped text, buttons, chips, cards and a scrolling
// column with page snapping. Every size is multiplied by `scale` (100%..300%) so nothing clips at 300%.
import { W, H, clamp } from './core.js';
import { PAL, FONT, SANS, rr, shade, wrapLines, textFill } from './art.js';

export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Where a finger is currently held down (virtual coords), so a button under it draws its pressed state.
let press = null;
export function setPress(x, y) { press = x == null ? null : [x, y]; }

// One button style for the whole game: a single subtle vertical gradient, ONE crisp 2 px border, a soft drop
// shadow, and a pressed state (darker, nudged down, shadow tucked in). No inner gloss shape, no double outline.
const BTN = {
  disabled: ['#3a5560', '#2c434d', 'rgba(255,255,255,0.14)'],
  primary: ['#ffd36b', '#f2a93b', 'rgba(255,248,220,0.9)'],
  danger: ['#d9574a', '#b13d32', 'rgba(255,200,190,0.55)'],
  active: ['#2bb9ab', '#1a8f87', 'rgba(190,255,245,0.6)'],
  normal: ['#1f7084', '#155566', 'rgba(255,214,140,0.45)'],
};
export function drawButton(ctx, r, label, o = {}) {
  const { primary = false, disabled = false, active = false, sub = null, size = 30, danger = false } = o;
  const down = !disabled && press && inRect(r, press[0], press[1]);
  const [c0, c1, edge] = disabled ? BTN.disabled : primary ? BTN.primary : danger ? BTN.danger : active ? BTN.active : BTN.normal;
  const rad = Math.min(22, r.h / 2), dy = down ? 2 : 0;
  ctx.save();
  // soft drop shadow
  ctx.shadowColor = 'rgba(2,14,20,0.5)'; ctx.shadowBlur = down ? 4 : 12; ctx.shadowOffsetY = down ? 1 : 4;
  rr(ctx, r.x, r.y + dy, r.w, r.h, rad);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, down ? shade(c0, -14) : c0); g.addColorStop(1, down ? shade(c1, -14) : c1);
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.lineWidth = 2; ctx.strokeStyle = edge; ctx.stroke();
  ctx.translate(0, dy);
  ctx.fillStyle = disabled ? 'rgba(255,255,255,0.45)' : primary ? '#2e1a05' : '#ffffff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, label, r.w - 28);
  const lh = size * 1.18, subSize = Math.round(size * 0.62), subLh = subSize * 1.25;
  let subLines = [];
  if (sub) { ctx.font = `400 ${subSize}px ${SANS}`; subLines = wrapLines(ctx, sub, r.w - 28); ctx.font = `700 ${size}px ${FONT}`; }
  const total = lines.length * lh + (subLines.length ? subLines.length * subLh + 4 : 0);
  let y = r.y + r.h / 2 - total / 2 + lh / 2;
  for (const l of lines) { ctx.fillText(l, r.x + r.w / 2, y); y += lh; }
  if (subLines.length) { ctx.font = `400 ${subSize}px ${SANS}`; ctx.globalAlpha = 0.82; y += -lh / 2 + subLh / 2 + 4; for (const l of subLines) { ctx.fillText(l, r.x + r.w / 2, y); y += subLh; } ctx.globalAlpha = 1; }
  ctx.restore();
}

export function drawPill(ctx, r, label, o = {}) { drawButton(ctx, r, label, { size: Math.min(26, r.h * 0.55), ...o }); }

export function panel(ctx, r, o = {}) {
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, o.radius ?? 26);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, o.top ?? 'rgba(12,58,70,0.92)'); g.addColorStop(1, o.bottom ?? 'rgba(6,30,40,0.94)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = PAL.panelEdge; ctx.stroke();
  ctx.restore();
}

// ---- column layout ---------------------------------------------------------------------------------------------------
// items -> ops with absolute y (relative to column top). width = content width.
export function layoutColumn(ctx, items, width, s) {
  const ops = [];
  let y = 0;
  const gap = 14 * s;
  for (const it of items) {
    const op = { it, y, h: 0, lines: null, chips: null };
    switch (it.t) {
      case 'title': {
        const size = (it.size ?? 46) * s;
        ctx.font = `italic 700 ${size}px ${FONT}`;
        op.lines = wrapLines(ctx, it.text, width); op.size = size; op.lh = size * 1.12;
        op.h = op.lines.length * op.lh + (it.sub ? 0 : 0);
        if (it.sub) { const ss = 24 * s; ctx.font = `400 ${ss}px ${SANS}`; op.subLines = wrapLines(ctx, it.sub, width); op.subSize = ss; op.h += op.subLines.length * ss * 1.3 + 6 * s; }
        break;
      }
      case 'h': { const size = (it.size ?? 32) * s; ctx.font = `700 ${size}px ${FONT}`; op.lines = wrapLines(ctx, it.text, width); op.size = size; op.lh = size * 1.18; op.h = op.lines.length * op.lh; break; }
      case 'para': {
        const size = (it.size ?? 27) * s; ctx.font = `400 ${size}px ${SANS}`;
        op.lines = wrapLines(ctx, it.text, width - (it.indent ?? 0) * s); op.size = size; op.lh = size * 1.34; op.h = op.lines.length * op.lh; break;
      }
      case 'btn': {
        const size = (it.size ?? 31) * s; ctx.font = `700 ${size}px ${FONT}`;
        const n = wrapLines(ctx, it.label, width - 28).length;
        let sn = 0;
        if (it.sub) { ctx.font = `400 ${Math.round(size * 0.62)}px ${SANS}`; sn = wrapLines(ctx, it.sub, width - 28).length; }
        op.h = Math.max((it.h ?? 84), n * size * 1.18 + sn * size * 0.62 * 1.25 + (sn ? 4 : 0) + 36);
        op.size = size; break;
      }
      case 'card': {
        const ts = 33 * s, bs = 24 * s;
        ctx.font = `700 ${ts}px ${FONT}`; op.tl = wrapLines(ctx, it.title, width - 40 * s);
        ctx.font = `400 ${bs}px ${SANS}`; op.bl = wrapLines(ctx, it.text ?? '', width - 40 * s);
        op.ts = ts; op.bs = bs; op.h = 22 * s + op.tl.length * ts * 1.15 + (it.text ? 8 * s + op.bl.length * bs * 1.3 : 0) + (it.tag ? bs * 1.5 : 0) + 20 * s; break;
      }
      case 'chips': {
        const size = (it.size ?? 26) * s; ctx.font = `700 ${size}px ${SANS}`;
        let lab = 0;
        if (it.label) { ctx.font = `600 ${24 * s}px ${SANS}`; op.labLines = wrapLines(ctx, it.label, width); lab = op.labLines.length * 24 * s * 1.3 + 4 * s; }
        ctx.font = `700 ${size}px ${SANS}`;
        const chips = []; let cx = 0, cy = lab; const ch = size * 1.9;
        for (const o of it.options) {
          const lines = wrapLines(ctx, o.label, width - 36 * s);
          const w = Math.min(width, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36 * s);
          const h = Math.max(ch, lines.length * size * 1.2 + 14 * s);
          if (cx + w > width && cx > 0) { cx = 0; cy += chips.reduce((mx, c) => (c.row === chips[chips.length - 1].row ? Math.max(mx, c.h) : mx), 0) + 10 * s; }
          chips.push({ o, lines, x: cx, y: cy, w, h, row: Math.round(cy) });
          cx += w + 10 * s;
        }
        // normalise row heights
        const rows = new Map(); chips.forEach((c) => rows.set(c.row, Math.max(rows.get(c.row) ?? 0, c.h)));
        chips.forEach((c) => { c.h = rows.get(c.row); });
        op.chips = chips; op.size = size;
        op.h = chips.length ? Math.max(...chips.map((c) => c.y + c.h)) : lab; break;
      }
      case 'row': {
        const size = (it.size ?? 27) * s; ctx.font = `600 ${size}px ${SANS}`;
        op.stack = s >= 2;
        op.ll = wrapLines(ctx, it.label, op.stack ? width - 40 * s : width * 0.56); ctx.font = `700 ${size}px ${SANS}`; op.vl = wrapLines(ctx, String(it.value), op.stack ? width - 40 * s : width * 0.36);
        op.size = size; op.h = (op.stack ? op.ll.length + op.vl.length : Math.max(op.ll.length, op.vl.length)) * size * 1.25 + 28 * s; break;
      }
      case 'stat': { const size = (it.size ?? 27) * s; ctx.font = `600 ${size}px ${SANS}`; op.size = size; op.stack = s >= 2; op.ll = wrapLines(ctx, it.label, op.stack ? width : width * 0.6); ctx.font = `700 ${size}px ${SANS}`; op.vl = wrapLines(ctx, String(it.value), op.stack ? width : width * 0.38); op.h = (op.stack ? op.ll.length + op.vl.length : Math.max(op.ll.length, op.vl.length)) * size * 1.25 + 8 * s; break; }
      case 'gap': op.h = (it.h ?? 20) * s; break;
      case 'rule': op.h = 14 * s; break;
      case 'fig': op.h = (it.h ?? 240); break;
      default: break;
    }
    ops.push(op);
    y += op.h + (it.t === 'gap' || it.t === 'rule' ? 0 : gap);
    op.bottom = op.y + op.h;
  }
  return { ops, total: y };
}

// Draws ops in rect (clipped), scrolled by scroll. Returns hit list [{id, rect}] in screen space.
export function drawColumn(ctx, lay, rect, scroll, s, st = {}, clipH = null) {
  const hits = [];
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x - 6, rect.y, rect.w + 12, clipH ?? rect.h); ctx.clip();
  const x0 = rect.x;
  for (const op of lay.ops) {
    const top = rect.y + op.y - scroll, bot = top + op.h;
    if (bot < rect.y - 4 || top > rect.y + rect.h + 4) { if (op.it.t === 'btn' || op.it.t === 'chips' || op.it.t === 'card' || op.it.t === 'row') pushHits(hits, op, x0, top, rect); continue; }
    const it = op.it;
    if (it.t === 'title') {
      let y = top;
      for (const l of op.lines) { textFill(ctx, l, x0 + rect.w / 2, y + op.size * 0.9, op.size, { italic: true, grad: [[0, '#fff3c2'], [1, '#ffb347']], stroke: 'rgba(60,20,10,0.55)' }); y += op.lh; }
      if (op.subLines) { ctx.font = `400 ${op.subSize}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,220,0.85)'; ctx.textAlign = 'center'; for (const l of op.subLines) { ctx.fillText(l, x0 + rect.w / 2, y + op.subSize); y += op.subSize * 1.3; } }
    } else if (it.t === 'h') {
      ctx.font = `700 ${op.size}px ${FONT}`; ctx.fillStyle = PAL.gold; ctx.textAlign = it.center ? 'center' : 'left'; ctx.textBaseline = 'alphabetic';
      let y = top; for (const l of op.lines) { ctx.fillText(l, it.center ? x0 + rect.w / 2 : x0, y + op.size * 0.92); y += op.lh; }
    } else if (it.t === 'para') {
      ctx.font = `400 ${op.size}px ${SANS}`; ctx.fillStyle = it.color ?? 'rgba(255,244,224,0.94)'; ctx.textAlign = it.center ? 'center' : 'left'; ctx.textBaseline = 'alphabetic';
      let y = top; for (const l of op.lines) { ctx.fillText(l, it.center ? x0 + rect.w / 2 : x0 + (it.indent ?? 0) * s, y + op.size * 1.0); y += op.lh; }
    } else if (it.t === 'btn') {
      drawButton(ctx, { x: x0, y: top, w: rect.w, h: op.h }, it.label, { primary: it.primary, disabled: it.disabled, active: it.active, sub: it.sub, size: op.size, danger: it.danger });
      pushHits(hits, op, x0, top, rect);
    } else if (it.t === 'card') {
      const r = { x: x0, y: top, w: rect.w, h: op.h };
      panel(ctx, r, { radius: 24 * s, top: it.hot ? 'rgba(40,92,104,0.94)' : 'rgba(14,64,78,0.92)' });
      if (it.accent) { rr(ctx, r.x, r.y, 10 * s, r.h, 5 * s); ctx.fillStyle = it.accent; ctx.fill(); }
      let y = top + 18 * s;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = `700 ${op.ts}px ${FONT}`; ctx.fillStyle = PAL.gold;
      for (const l of op.tl) { ctx.fillText(l, x0 + 24 * s, y + op.ts * 0.9); y += op.ts * 1.15; }
      if (it.text) { y += 6 * s; ctx.font = `400 ${op.bs}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.9)'; for (const l of op.bl) { ctx.fillText(l, x0 + 24 * s, y + op.bs); y += op.bs * 1.3; } }
      if (it.tag) { ctx.font = `600 ${op.bs * 0.92}px ${SANS}`; ctx.fillStyle = PAL.teal; ctx.fillText(it.tag, x0 + 24 * s, y + op.bs * 1.1); }
      pushHits(hits, op, x0, top, rect);
    } else if (it.t === 'chips') {
      if (op.labLines) { ctx.font = `600 ${24 * s}px ${SANS}`; ctx.fillStyle = 'rgba(255,214,150,0.9)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; let y = top; for (const l of op.labLines) { ctx.fillText(l, x0, y + 24 * s); y += 24 * s * 1.3; } }
      for (const c of op.chips) {
        const r = { x: x0 + c.x, y: top + c.y, w: c.w, h: c.h };
        const on = it.value === c.o.v;
        drawChip(ctx, r, c.lines, on, op.size, !!c.o.disabled);
      }
      pushHits(hits, op, x0, top, rect);
    } else if (it.t === 'row') {
      const r = { x: x0, y: top, w: rect.w, h: op.h };
      panel(ctx, r, { radius: 20 * s, top: 'rgba(14,64,78,0.88)', bottom: 'rgba(8,40,52,0.88)' });
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.font = `600 ${op.size}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.95)';
      let y = top + 14 * s; for (const l of op.ll) { ctx.fillText(l, x0 + 20 * s, y + op.size); y += op.size * 1.25; }
      if (op.stack) { ctx.textAlign = 'left'; ctx.font = `700 ${op.size}px ${SANS}`; ctx.fillStyle = PAL.gold; for (const l of op.vl) { ctx.fillText(l, x0 + 20 * s, y + op.size); y += op.size * 1.25; } }
      else { ctx.textAlign = 'right'; ctx.font = `700 ${op.size}px ${SANS}`; ctx.fillStyle = PAL.gold; y = top + 14 * s; for (const l of op.vl) { ctx.fillText(l, x0 + rect.w - 20 * s, y + op.size); y += op.size * 1.25; } }
      pushHits(hits, op, x0, top, rect);
    } else if (it.t === 'stat') {
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.font = `600 ${op.size}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.8)';
      let y = top; for (const l of op.ll) { ctx.fillText(l, x0, y + op.size); y += op.size * 1.25; }
      if (op.stack) { ctx.textAlign = 'left'; ctx.font = `700 ${op.size}px ${SANS}`; ctx.fillStyle = it.color ?? PAL.gold; for (const l of op.vl) { ctx.fillText(l, x0, y + op.size); y += op.size * 1.25; } }
      else { ctx.textAlign = 'right'; ctx.font = `700 ${op.size}px ${SANS}`; ctx.fillStyle = it.color ?? PAL.gold; y = top; for (const l of op.vl) { ctx.fillText(l, x0 + rect.w, y + op.size); y += op.size * 1.25; } }
    } else if (it.t === 'rule') {
      ctx.fillStyle = 'rgba(255,214,140,0.25)'; ctx.fillRect(x0, top + op.h / 2, rect.w, 2);
    } else if (it.t === 'fig') {
      ctx.save(); ctx.translate(x0, top); it.draw(ctx, rect.w, op.h, st); ctx.restore();
    }
  }
  ctx.restore();
  return hits;
}

function pushHits(hits, op, x0, top, rect) {
  const it = op.it;
  if (it.t === 'btn' && !it.disabled) hits.push({ id: it.id, rect: { x: x0, y: top, w: rect.w, h: op.h } });
  else if (it.t === 'card' || it.t === 'row') hits.push({ id: it.id, rect: { x: x0, y: top, w: rect.w, h: op.h } });
  else if (it.t === 'chips') for (const c of op.chips) if (!c.o.disabled) hits.push({ id: `${it.id}:${c.o.v}`, rect: { x: x0 + c.x, y: top + c.y, w: c.w, h: c.h } });
}

function drawChip(ctx, r, lines, on, size, disabled) {
  const down = !disabled && press && inRect(r, press[0], press[1]);
  const [c0, c1, edge] = disabled ? BTN.disabled : on ? BTN.primary : BTN.normal;
  const dy = down ? 2 : 0;
  ctx.save();
  ctx.shadowColor = 'rgba(2,14,20,0.45)'; ctx.shadowBlur = down ? 3 : 8; ctx.shadowOffsetY = down ? 1 : 3;
  rr(ctx, r.x, r.y + dy, r.w, r.h, Math.min(20, r.h / 2));
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, down ? shade(c0, -14) : c0); g.addColorStop(1, down ? shade(c1, -14) : c1);
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.lineWidth = 2; ctx.strokeStyle = edge; ctx.stroke();
  ctx.translate(0, dy);
  ctx.fillStyle = disabled ? 'rgba(255,255,255,0.45)' : on ? '#2e1a05' : '#ffffff';
  ctx.font = `700 ${size}px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lh = size * 1.2; let y = r.y + r.h / 2 - ((lines.length - 1) * lh) / 2;
  for (const l of lines) { ctx.fillText(l, r.x + r.w / 2, y); y += lh; }
  ctx.restore();
}

// How many whole lines of a text item starting inside the page (at y) can sit on that page, or 0 when it should
// move to the next page whole. Splits when at least 2 lines fit here, so a page is never left mostly blank,
// and carries two lines over rather than orphaning a single one.
function splitLines(op, pageTop, viewH) {
  if (!op.lh || op.y <= pageTop + 1) return 0;
  const room = pageTop + viewH - op.y;
  let k = Math.floor(room / op.lh);
  const n = Math.round(op.h / op.lh);
  if (k >= n) return 0;
  if (n - k < 2 && k >= 3) k -= 1; // carry two lines over rather than orphan one
  return k >= 2 ? k : 0;
}

// Page starts for snapped paging through a laid-out column. Pages break between items; a text item that does not
// fit is continued line by line on the next page; headings never end a page on their own.
export function pageStarts(lay, viewH) {
  const starts = [0];
  let cur = 0;
  for (let guard = 0; guard < 4000; guard++) {
    const next = lay.ops.find((op) => op.bottom > cur + viewH + 1);
    if (!next) break;
    if (next.y > cur + 1) {
      const k = splitLines(next, cur, viewH);
      if (k) { cur = next.y + k * next.lh; starts.push(cur); continue; }
      let i = lay.ops.indexOf(next);
      while (i > 0 && lay.ops[i - 1].it.t === 'h' && lay.ops[i - 1].y > cur + 1) i--;
      cur = lay.ops[i].y; starts.push(cur); continue;
    }
    const lh = next.lh ?? null;
    const step = lh ? Math.max(1, Math.floor(viewH / lh)) * lh : viewH * 0.9;
    cur += step; starts.push(cur);
  }
  return starts;
}
// How tall the visible page really is at scroll `sc` (so a half-visible line or item is clipped away).
export function pageClip(lay, sc, viewH) {
  const tall = lay.ops.find((op) => op.y <= sc + 1 && op.bottom > sc + viewH + 1);
  if (tall) { const lh = tall.lh ?? null; return lh ? Math.max(1, Math.floor(viewH / lh)) * lh + 2 : viewH; }
  const nextOp = lay.ops.find((op) => op.bottom > sc + viewH + 1);
  const k = nextOp ? splitLines(nextOp, sc, viewH) : 0;
  if (k) return nextOp.y - sc + k * nextOp.lh + 2;
  // fully visible items; a heading left at the bottom moves to the next page with its text
  const vis = lay.ops.filter((op) => op.bottom <= sc + viewH + 1 && op.bottom > sc);
  while (nextOp && vis.length && vis[vis.length - 1].it.t === 'h') vis.pop();
  const end = vis.length ? vis[vis.length - 1].bottom : sc;
  return end - sc >= 40 ? Math.min(viewH, end - sc + 6) : viewH;
}
export const maxScroll = (lay, viewH) => Math.max(0, lay.total - viewH);

export function scrollbar(ctx, rect, scroll, total) {
  if (total <= rect.h + 1) return;
  const th = Math.max(36, rect.h * rect.h / total);
  const ty = rect.y + (rect.h - th) * (scroll / Math.max(1, total - rect.h));
  ctx.fillStyle = 'rgba(255,214,140,0.35)'; rr(ctx, rect.x + rect.w + 6, ty, 6, th, 3); ctx.fill();
}

export { W, H };
