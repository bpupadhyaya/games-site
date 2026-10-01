// A scrolling column of text and buttons used by every "menu-like" screen (title, setup, settings, results).
// Layout is computed from the text-zoom step, so labels wrap and buttons grow instead of overflowing at 300%.
import { W, LIST_TOP, LIST_BOTTOM, inRect } from './layout.js';
import { FONT, drawButton, wrapLines, getPress } from './art.js';

const SIDE = 40;

// items: { t:'hero', h, draw(ctx, y) } | { t:'text', text, px, color, bold } | { t:'head', text } | { t:'btn', id, label, sub, primary, active, disabled }
//        | { t:'row', buttons:[btn...] } | { t:'gap', h }
export function layoutList(ctx, items, scale) {
  const out = []; let y = 0; const bw = W - SIDE * 2, gap = 14;
  const btnBox = (b, x, w) => {
    const px = Math.round(30 * scale); ctx.font = `700 ${px}px ${FONT}`;
    const lines = wrapLines(ctx, b.label, w - 28), lh = Math.round(px * 1.2);
    const subPx = Math.round(px * 0.62), subH = b.sub ? subPx + 10 : 0;
    const h = Math.max(76, lines.length * lh + subH + 36);
    return { x, w, h, lines, px, b };
  };
  for (const it of items) {
    if (it.t === 'gap') { y += it.h; continue; }
    if (it.t === 'hero') { out.push({ it, y, h: it.h }); y += it.h + 10; continue; }
    if (it.t === 'text' || it.t === 'head') {
      const base = it.t === 'head' ? 30 : (it.px ?? 26), px = Math.round(base * scale), lh = Math.round(px * 1.28);
      ctx.font = `${it.t === 'head' || it.bold ? 700 : 400} ${px}px ${FONT}`;
      const lines = wrapLines(ctx, it.text, bw - 8);
      out.push({ it, y, h: lines.length * lh, lines, px, lh }); y += lines.length * lh + 12; continue;
    }
    if (it.t === 'btn') { const bx = btnBox(it, SIDE, bw); out.push({ it, y, h: bx.h, box: bx }); y += bx.h + gap; continue; }
    if (it.t === 'row') {
      const n = it.buttons.length;
      if (scale < 1.5) {
        const w = (bw - gap * (n - 1)) / n, boxes = it.buttons.map((b, i) => btnBox(b, SIDE + i * (w + gap), w)), h = Math.max(...boxes.map((b) => b.h));
        out.push({ it, y, h, boxes: boxes.map((b) => ({ ...b, h })) }); y += h + gap;
      } else { // too wide: stack each option full width
        for (const b of it.buttons) { const bx = btnBox(b, SIDE, bw); out.push({ it: { t: 'btn', ...b }, y, h: bx.h, box: bx }); y += bx.h + gap; }
      }
    }
  }
  return { rows: out, total: y + 20 };
}

export function maxScroll(lay) { return Math.max(0, lay.total - (LIST_BOTTOM - LIST_TOP)); }

export function drawList(ctx, lay, scroll) {
  ctx.save(); ctx.beginPath(); ctx.rect(0, LIST_TOP, W, LIST_BOTTOM - LIST_TOP); ctx.clip();
  ctx.translate(0, LIST_TOP - scroll);
  for (const row of lay.rows) {
    const it = row.it;
    if (row.y + row.h < scroll - 40 || row.y > scroll + (LIST_BOTTOM - LIST_TOP) + 40) continue;
    if (it.t === 'hero') { ctx.save(); ctx.translate(0, row.y); it.draw(ctx); ctx.restore(); continue; }
    if (it.t === 'text' || it.t === 'head') {
      ctx.font = `${it.t === 'head' || it.bold ? 700 : 400} ${row.px}px ${FONT}`; ctx.textAlign = it.align === 'left' ? 'left' : 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = it.color ?? (it.t === 'head' ? '#ffd97a' : 'rgba(247,238,218,0.92)');
      let yy = row.y + row.px;
      for (const l of row.lines) { ctx.fillText(l, it.align === 'left' ? SIDE : W / 2, yy); yy += row.lh; }
      continue;
    }
    const boxes = row.box ? [row.box] : row.boxes;
    const pr = getPress(), py = pr ? pr.y - LIST_TOP + scroll : 0;
    for (const bx of boxes) drawButton(ctx, { x: bx.x, y: row.y, w: bx.w, h: bx.h ?? row.h }, bx.b.label, { pressed: !!pr && pr.y >= LIST_TOP && inRect({ x: bx.x, y: row.y, w: bx.w, h: bx.h ?? row.h }, pr.x, py), primary: bx.b.primary, active: bx.b.active, disabled: bx.b.disabled, fontPx: bx.px, lines: bx.lines, sub: bx.b.sub });
  }
  ctx.restore();
  // scroll hint: a soft thumb on the right when content overflows
  const ms = maxScroll(lay);
  if (ms > 0) {
    const vh = LIST_BOTTOM - LIST_TOP, th = Math.max(50, vh * vh / lay.total), ty = LIST_TOP + (vh - th) * (scroll / ms);
    ctx.fillStyle = 'rgba(244,222,180,0.35)'; ctx.fillRect(W - 9, ty, 5, th);
  }
}

// y/x in screen coords; returns the tapped button id (or null)
export function hitList(lay, scroll, x, y) {
  const cy = y - LIST_TOP + scroll;
  if (y < LIST_TOP || y > LIST_BOTTOM) return null;
  for (const row of lay.rows) {
    if (row.it.t === 'hero' || row.it.t === 'text' || row.it.t === 'head') continue;
    const boxes = row.box ? [row.box] : row.boxes;
    for (const bx of boxes) {
      if (inRect({ x: bx.x, y: row.y, w: bx.w, h: bx.h ?? row.h }, x, cy)) return bx.b.disabled ? null : bx.b.id;
    }
  }
  return null;
}

// Pointer handling for a scrolling list: drag to scroll, tap to press. Returns { scroll, tap }.
export function listPointer(ui, p, lay) {
  let tap = null;
  const ms = maxScroll(lay);
  if (p.pressed) ui.drag = { y0: p.y, x0: p.x, s0: ui.scroll, moved: false };
  if (ui.drag && p.down) {
    const dy = p.y - ui.drag.y0;
    if (Math.abs(dy) > 12) ui.drag.moved = true;
    if (ui.drag.moved) ui.scroll = Math.max(0, Math.min(ms, ui.drag.s0 - dy));
  }
  if (p.released && ui.drag) {
    if (!ui.drag.moved) tap = hitList(lay, ui.scroll, ui.drag.x0, ui.drag.y0);
    ui.drag = null;
  }
  ui.scroll = Math.max(0, Math.min(ms, ui.scroll));
  return tap;
}
