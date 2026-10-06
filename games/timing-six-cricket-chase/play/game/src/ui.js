// A small text-zoom-aware UI kit for canvas screens: wrapped text, buttons, chips, cards and a scrolling
// column with page snapping. Every size is multiplied by `scale` (100%..300%) so nothing clips at 300%.
import { clamp } from './core.js';
import { LY } from './layout.js';
import { drawMoreLine } from './brand.js';
import { PAL, FONT, SANS, rr, shade, wrapLines, wrapCacheCheck, textFill } from './art.js';

export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Smallest text on screen (about 11 css px): secondary lines never fall below it, whatever the fraction of the button text they started as.
export const subSizeOf = (size) => Math.max(Math.round(size * 0.62), LY ? LY.minText : 16);

// Where a finger is currently held down (virtual coords), so a button under it draws its pressed state.
let press = null;
export function setPress(x, y) { press = x == null ? null : [x, y]; }

// One button style for the whole game: a single subtle vertical gradient, ONE crisp 2 px border, a soft drop
// shadow, and a pressed state (darker, nudged down, shadow tucked in). No inner gloss shape, no double outline.
const BTN = {
  disabled: ['#413a52', '#332d43', 'rgba(255,255,255,0.14)'],
  primary: ['#ffd36b', '#f2a93b', 'rgba(255,248,220,0.9)'],
  danger: ['#d9574a', '#b13d32', 'rgba(255,200,190,0.55)'],
  active: ['#2bb9ab', '#1a8f87', 'rgba(190,255,245,0.6)'],
  normal: ['#4a3f6a', '#3a3057', 'rgba(255,214,140,0.45)'],
};
export function drawButton(ctx, r, label, o = {}) {
  const { primary = false, disabled = false, active = false, sub = null, size = 30, danger = false } = o;
  const down = !disabled && press && inRect(r, press[0], press[1]);
  const [c0, c1, edge] = disabled ? BTN.disabled : primary ? BTN.primary : danger ? BTN.danger : active ? BTN.active : BTN.normal;
  const rad = Math.min(22, r.h / 2), dy = down ? 2 : 0;
  ctx.save();
  // soft drop shadow
  ctx.shadowColor = 'rgba(8,4,20,0.5)'; ctx.shadowBlur = down ? 4 : 12; ctx.shadowOffsetY = down ? 1 : 4;
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
  const lh = size * 1.18, subSize = subSizeOf(size), subLh = subSize * 1.25;
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
  g.addColorStop(0, o.top ?? 'rgba(40,30,66,0.9)'); g.addColorStop(1, o.bottom ?? 'rgba(18,13,32,0.92)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = PAL.panelEdge; ctx.stroke();
  ctx.restore();
}

// ---- column layout ---------------------------------------------------------------------------------------------------
// items -> ops with absolute y (relative to column top). width = content width.
// `opts.cols = 2` lays consecutive cards out two per row (landscape menus); everything else spans the full width.
export function layoutColumn(ctx, items, width, s, opts = {}) {
  wrapCacheCheck(ctx);
  const ops = [];
  let y = 0;
  const gap = 14 * s, cols = opts.cols ?? 1, cgap = 14 * s, cwid = cols === 2 ? (width - cgap) / 2 : width;
  let row = [];
  const flushRow = () => {
    if (!row.length) return;
    const rh = Math.max(...row.map((o) => o.h));
    for (const o of row) { o.h = rh; o.bottom = o.y + rh; }
    y += rh + gap; row = [];
  };
  for (const it of items) {
    if (cols === 2 && it.t !== 'card') flushRow();
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
        const ssz = subSizeOf(size);
        if (it.sub) { ctx.font = `400 ${ssz}px ${SANS}`; sn = wrapLines(ctx, it.sub, width - 28).length; }
        op.h = Math.max((it.h ?? 84), n * size * 1.18 + sn * ssz * 1.25 + (sn ? 4 : 0) + 36);
        op.size = size; break;
      }
      case 'card': {
        const ts = 33 * s, bs = 24 * s;
        op.w = cwid; op.x = cols === 2 ? row.length * (cwid + cgap) : 0;
        ctx.font = `700 ${ts}px ${FONT}`; op.tl = wrapLines(ctx, it.title, cwid - 40 * s);
        ctx.font = `400 ${bs}px ${SANS}`; op.bl = wrapLines(ctx, it.text ?? '', cwid - 40 * s);
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
        op.ll = wrapLines(ctx, it.label, width * 0.56); ctx.font = `700 ${size}px ${SANS}`; op.vl = wrapLines(ctx, String(it.value), width * 0.36);
        op.size = size; op.h = Math.max(op.ll.length, op.vl.length) * size * 1.25 + 28 * s; break;
      }
      case 'stat': { const size = (it.size ?? 27) * s; ctx.font = `600 ${size}px ${SANS}`; op.size = size; op.ll = wrapLines(ctx, it.label, width * (it.wide ? 0.3 : 0.6)); op.vl = wrapLines(ctx, String(it.value), width * (it.wide ? 0.68 : 0.38)); op.h = Math.max(op.ll.length, op.vl.length) * size * 1.25 + 8 * s; break; }
      case 'gap': op.h = (it.h ?? 20) * s; break;
      case 'rule': op.h = 14 * s; break;
      case 'more': op.h = 52 * Math.min(s, 1.5); break;
      case 'fig': op.h = (it.h ?? 240); break;
      default: break;
    }
    ops.push(op);
    op.bottom = op.y + op.h;
    if (cols === 2 && it.t === 'card') { row.push(op); if (row.length === 2) flushRow(); continue; }
    y += op.h + (it.t === 'gap' || it.t === 'rule' ? 0 : gap);
  }
  flushRow();
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
      const r = { x: x0 + (op.x ?? 0), y: top, w: op.w ?? rect.w, h: op.h }, tx = r.x + 24 * s;
      panel(ctx, r, { radius: 24 * s, top: it.hot ? 'rgba(60,70,90,0.92)' : 'rgba(44,34,72,0.92)' });
      if (it.accent) { rr(ctx, r.x, r.y, 10 * s, r.h, 5 * s); ctx.fillStyle = it.accent; ctx.fill(); }
      let y = top + 18 * s;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = `700 ${op.ts}px ${FONT}`; ctx.fillStyle = PAL.gold;
      for (const l of op.tl) { ctx.fillText(l, tx, y + op.ts * 0.9); y += op.ts * 1.15; }
      if (it.text) { y += 6 * s; ctx.font = `400 ${op.bs}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.9)'; for (const l of op.bl) { ctx.fillText(l, tx, y + op.bs); y += op.bs * 1.3; } }
      if (it.tag) { ctx.font = `600 ${op.bs * 0.92}px ${SANS}`; ctx.fillStyle = PAL.teal; ctx.fillText(it.tag, tx, y + op.bs * 1.1); }
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
      panel(ctx, r, { radius: 20 * s, top: 'rgba(44,34,72,0.85)', bottom: 'rgba(28,20,48,0.85)' });
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.font = `600 ${op.size}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.95)';
      let y = top + 14 * s; for (const l of op.ll) { ctx.fillText(l, x0 + 20 * s, y + op.size); y += op.size * 1.25; }
      ctx.textAlign = 'right'; ctx.font = `700 ${op.size}px ${SANS}`; ctx.fillStyle = PAL.gold; y = top + 14 * s; for (const l of op.vl) { ctx.fillText(l, x0 + rect.w - 20 * s, y + op.size); y += op.size * 1.25; }
      pushHits(hits, op, x0, top, rect);
    } else if (it.t === 'stat') {
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.font = `600 ${op.size}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.8)';
      let y = top; for (const l of op.ll) { ctx.fillText(l, x0, y + op.size); y += op.size * 1.25; }
      ctx.textAlign = 'right'; ctx.font = `700 ${op.size}px ${SANS}`; ctx.fillStyle = it.color ?? PAL.gold; y = top; for (const l of op.vl) { ctx.fillText(l, x0 + rect.w, y + op.size); y += op.size * 1.25; }
    } else if (it.t === 'more') {
      drawMoreLine(ctx, x0 + rect.w / 2, top + op.h * 0.72, Math.max(LY ? LY.minText : 16, 20) * Math.min(s, 1.5));
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
  else if (it.t === 'card' || it.t === 'row') hits.push({ id: it.id, rect: { x: x0 + (op.x ?? 0), y: top, w: op.w ?? rect.w, h: op.h } });
  else if (it.t === 'chips') for (const c of op.chips) if (!c.o.disabled) hits.push({ id: `${it.id}:${c.o.v}`, rect: { x: x0 + c.x, y: top + c.y, w: c.w, h: c.h } });
}

function drawChip(ctx, r, lines, on, size, disabled) {
  const down = !disabled && press && inRect(r, press[0], press[1]);
  const [c0, c1, edge] = disabled ? BTN.disabled : on ? BTN.primary : BTN.normal;
  const dy = down ? 2 : 0;
  ctx.save();
  ctx.shadowColor = 'rgba(8,4,20,0.45)'; ctx.shadowBlur = down ? 3 : 8; ctx.shadowOffsetY = down ? 1 : 3;
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

export const maxScroll = (lay, viewH) => Math.max(0, lay.total - viewH);

// A scroll bar in the right gutter of a scrolling screen: a faint track and a thumb. Returns the thumb rectangle (null when everything fits).
export function scrollbar(ctx, bar, scroll, total, viewH) {
  if (total <= viewH + 1) return null;
  const th = Math.max(44, bar.h * viewH / total);
  const ty = bar.y + (bar.h - th) * (scroll / Math.max(1, total - viewH));
  ctx.fillStyle = 'rgba(255,214,140,0.12)'; rr(ctx, bar.x, bar.y, bar.w, bar.h, bar.w / 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,214,140,0.5)'; rr(ctx, bar.x, ty, bar.w, th, bar.w / 2); ctx.fill();
  return { x: bar.x, y: ty, w: bar.w, h: th };
}
