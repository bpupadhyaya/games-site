// One bar drawn as a row of cells on the sash: the pulses, gathered in their groups, with the symbols to play and the stitches of what was played.
// Used by the play screen (three rows scroll past), the Think / Reveal card, the piece page and the Rules figures.
import { PAL, UI, DISPLAY, KIND_COL, KIND_HI, KIND_LO, rgba, clamp01, drawSymbol, drawStitch, drawNeedle } from './art.js';

const TAU = Math.PI * 2;
const GAP_IN = 0.1, GAP_GROUP = 0.52;       // in cell widths

// Cell rectangles for a bar inside rect (x, y, w, h). Head (group brackets) on top, cells, count numerals below.
export function cellRects(bar, rect, o = {}) {
  const n = bar.n, G = bar.g.length;
  const units = n + (n - G) * GAP_IN + (G - 1) * GAP_GROUP;
  const head = o.mini ? 0 : rect.h * 0.2, foot = o.mini ? 0 : rect.h * 0.22;
  const bodyH = rect.h - head - foot;
  let cw = rect.w / units;
  const ch = Math.min(bodyH, cw * 1.18);
  cw = Math.min(cw, ch / 0.86);
  const total = cw * units, x0 = rect.x + (rect.w - total) / 2, y0 = rect.y + head + (bodyH - ch) / 2;
  const cells = []; let x = x0;
  bar.cells.forEach((c, i) => {
    if (i > 0) x += cw * (c.gs ? GAP_GROUP : GAP_IN);
    cells.push({ x, y: y0, w: cw, h: ch, cx: x + cw / 2, cy: y0 + ch / 2, c });
    x += cw;
  });
  return { cells, cw, ch, head, foot, x0, x1: x0 + total, y0, yHead: rect.y, yFoot: y0 + ch, rect };
}
// The needle's x for pulse position p (0 = the centre of cell 0, n - 1 = the centre of the last cell).
export function needleX(geo, p) {
  const cs = geo.cells, n = cs.length;
  if (p <= 0) return cs[0].cx + p * (cs.length > 1 ? cs[1].cx - cs[0].cx : geo.cw);
  if (p >= n - 1) return cs[n - 1].cx + (p - (n - 1)) * (n > 1 ? cs[n - 1].cx - cs[n - 2].cx : geo.cw);
  const i = Math.floor(p), f = p - i;
  return cs[i].cx + (cs[i + 1].cx - cs[i].cx) * f;
}

const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// o: { cues, p, alpha, nums, lit, hot (Set of cell indices), t, mini, now (cell index in focus), dim, labels }
export function drawRow(ctx, bar, rect, o = {}) {
  const geo = cellRects(bar, rect, o), alpha = o.alpha ?? 1, t = o.t ?? 0;
  const byI = new Map(); for (const q of o.cues ?? []) byI.set(q.i, q);
  ctx.save(); ctx.globalAlpha *= alpha;
  const cw = geo.cw;
  // group brackets and the size numerals above the cells
  if (!o.mini) {
    let gi = 0;
    for (const len of bar.g) {
      const a = geo.cells.find((c) => c.c.gi === gi), b = geo.cells[a.c.i + len - 1];
      const x0 = a.x, x1 = b.x + b.w, yy = geo.yHead + geo.head * 0.78;
      ctx.strokeStyle = len >= 3 ? PAL.red : '#7a4a2a'; ctx.lineWidth = Math.max(2, cw * 0.06); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0, yy - geo.head * 0.16); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.moveTo(x1, yy); ctx.lineTo(x1, yy - geo.head * 0.16); ctx.stroke();
      const fs = Math.max(12, Math.min(geo.head * 0.78, 34));
      ctx.font = `700 ${fs}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = len >= 3 ? PAL.red : '#5a3418'; ctx.fillText(String(len), (x0 + x1) / 2, geo.yHead + geo.head * 0.36);
      gi += 1;
    }
  }
  // cells
  geo.cells.forEach((g, i) => {
    const c = g.c, q = byI.get(i), rad = Math.max(4, cw * 0.18);
    const isNow = o.now === i;
    ctx.save();
    if (isNow) { ctx.translate(g.cx, g.cy); ctx.scale(1.07, 1.07); ctx.translate(-g.cx, -g.cy); }
    // the cell body
    const fill = ctx.createLinearGradient(0, g.y, 0, g.y + g.h);
    const lit = q && !q.done && !q.demo;
    fill.addColorStop(0, lit ? '#fffaf0' : '#f3e4c4'); fill.addColorStop(1, lit ? '#f0dcb0' : '#e4cfa0');
    ctx.fillStyle = 'rgba(70,30,10,0.22)'; rrect(ctx, g.x, g.y + 2.5, g.w, g.h, rad); ctx.fill();
    ctx.fillStyle = fill; rrect(ctx, g.x, g.y, g.w, g.h, rad); ctx.fill();
    if (q && q.done && !q.demo && q.j !== 'miss') { ctx.fillStyle = rgba(KIND_COL[q.kind], 0.22); rrect(ctx, g.x, g.y, g.w, g.h, rad); ctx.fill(); }
    const hot = o.hot && o.hot.has(i);
    ctx.lineWidth = Math.max(2, cw * 0.05);
    ctx.strokeStyle = hot ? '#fff3b0' : c.gs ? 'rgba(140,40,30,0.8)' : 'rgba(110,70,30,0.45)';
    if (hot) { ctx.lineWidth = Math.max(3, cw * 0.09); }
    rrect(ctx, g.x, g.y, g.w, g.h, rad); ctx.stroke();
    // group start mark: a small red lozenge at the cell's top edge
    if (c.gs && !o.mini) { ctx.fillStyle = PAL.red; ctx.beginPath(); const mx = g.cx, my = g.y; ctx.moveTo(mx, my - cw * 0.12); ctx.lineTo(mx + cw * 0.12, my); ctx.lineTo(mx, my + cw * 0.12); ctx.lineTo(mx - cw * 0.12, my); ctx.closePath(); ctx.fill(); }
    if (!c.kind) {
      ctx.fillStyle = c.gs ? 'rgba(140,40,30,0.4)' : 'rgba(110,70,30,0.3)';
      ctx.beginPath(); ctx.arc(g.cx, g.cy, Math.max(2, cw * 0.07), 0, TAU); ctx.fill();
    } else if (q && q.done && !q.demo) {
      drawStitch(ctx, g.cx, g.cy, g.w * 0.9, q.j, q.kind, 1);
    } else if (q && q.done && q.demo) {
      drawSymbol(ctx, c.kind, g.cx, g.cy, g.w * 0.3, { alpha: 0.9 });
      drawStitch(ctx, g.cx, g.cy, g.w * 0.9, 'perfect', c.kind, 0.9);
    } else {
      const demo = q && q.demo;
      const r = Math.min(g.w, g.h) * 0.34 * (isNow ? 1.08 : 1);
      ctx.save();
      if (demo) ctx.globalAlpha *= 0.65;
      drawSymbol(ctx, c.kind, g.cx, g.cy, r, { glow: hot ? 1 : isNow ? 0.5 : 0 });
      ctx.restore();
      if (demo) { ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(60,30,10,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.cx, g.cy, r * 1.35, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    }
    ctx.restore();
    // number badge (Watch and Learn reveal / hint)
    if (o.nums && o.nums[i] != null) {
      const on = o.lit == null || o.nums[i] <= o.lit, br = Math.max(8, cw * 0.2);
      ctx.fillStyle = on ? '#241410' : 'rgba(36,20,16,0.45)'; ctx.beginPath(); ctx.arc(g.x + g.w - br * 0.4, g.y + br * 0.4, br, 0, TAU); ctx.fill();
      ctx.fillStyle = on ? PAL.text : 'rgba(255,255,255,0.6)'; ctx.font = `800 ${br * 1.25}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(o.nums[i]), g.x + g.w - br * 0.4, g.y + br * 0.4 + 1);
    }
  });
  // count numerals under the cells: 1 2 | 1 2 | 1 2 3
  if (!o.mini && !o.noCounts && geo.foot > 8) {
    const fs = Math.max(12, Math.min(geo.foot * 0.78, cw * 0.46, 28));
    ctx.font = `800 ${fs}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    geo.cells.forEach((g) => {
      ctx.fillStyle = g.c.gs ? PAL.red : 'rgba(90,56,26,0.7)';
      ctx.fillText(String(g.c.gp + 1), g.cx, geo.yFoot + geo.foot * 0.52);
    });
  }
  // the needle
  if (o.p != null) {
    const x = needleX(geo, o.p);
    drawNeedle(ctx, x, geo.y0 - geo.head * 0.1 - 6, geo.yFoot + geo.foot * 0.2, { size: Math.max(18, Math.min(30, cw * 0.55)) });
  }
  ctx.restore();
  void KIND_HI; void KIND_LO; void clamp01;
  return geo;
}
