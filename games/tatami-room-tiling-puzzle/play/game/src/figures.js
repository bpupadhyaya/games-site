// Figures for the text screens, drawn with the game's own mat art.
import { drawMini, drawMat } from './art.js';
import { theme, rr, txt, F, panel, rgba } from './ui.js';
import { parsePuzzle, newBoard, solve } from './tatami.js';
import { LIBRARY } from './library.js';

let roomCache = null;
function roomSpec() {   // a finished library room, solved once
  if (roomCache) return roomCache;
  const p = parsePuzzle(LIBRARY[2][3]), B = newBoard(p), sol = solve(B, { limit: 1 }).solutions[0] ?? [];
  roomCache = { cols: p.w, rows: p.h, room: p.room, tiles: sol.map(([a, b], i) => ({ a, b })) };
  return roomCache;
}

export function drawFigure(ctx, r, kind, t = 0) {
  const T = theme();
  panel(ctx, r, { radius: 22, fill: 'rgba(0,0,0,0.18)' });
  const pad = Math.min(r.w, r.h) * 0.06, box = { x: r.x + pad, y: r.y + pad, w: r.w - 2 * pad, h: r.h - 2 * pad };
  if (kind === 'room') {
    const sp = roomSpec();
    drawMini(ctx, box, sp, { t });
    return;
  }
  if (kind === 'mats') {
    const s = Math.min(box.w / 5.2, box.h / 3.2, 120), cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    drawMat(ctx, cx - 2.3 * s, cy - s * 1.15, 2 * s, s, { seed: 3 });
    txt(ctx, 'Full mat, lying', cx - 1.3 * s, cy - s * 1.5 + 4, { size: Math.max(F(18), s * 0.19), weight: 600, color: T.text, align: 'center', maxW: 2.3 * s, min: 11 });
    drawMat(ctx, cx + 0.9 * s, cy - s * 1.25, s, 2 * s, { seed: 5 });
    txt(ctx, 'Full mat, standing', cx + 1.4 * s, cy + s * 1.1, { size: Math.max(F(18), s * 0.19), weight: 600, color: T.text, align: 'center', maxW: 2.4 * s, min: 11 });
    drawMat(ctx, cx - 1.4 * s, cy + 0.15 * s, s, s, { seed: 9, half: true });
    txt(ctx, 'Half mat', cx - 0.9 * s, cy + 1.45 * s, { size: Math.max(F(18), s * 0.19), weight: 600, color: T.text, align: 'center', maxW: 2.2 * s, min: 11 });
    return;
  }
  if (kind === 'corner') {
    const hw = box.w / 2 - 6, hh = box.h - 34, left = { x: box.x, y: box.y, w: hw, h: hh }, right = { x: box.x + box.w / 2 + 6, y: box.y, w: hw, h: hh };
    // a pinwheel of four mats around one point (4 x 4 floor, point between rows 1 and 2 and columns 1 and 2)
    drawMini(ctx, left, { cols: 4, rows: 4, tiles: [{ a: 4, b: 5 }, { a: 2, b: 6 }, { a: 10, b: 11 }, { a: 9, b: 13 }], points: [{ r: 2, c: 2 }] }, { t });
    // a staggered row: only three mats meet at the marked point
    drawMini(ctx, right, { cols: 4, rows: 2, tiles: [{ a: 0, b: 1 }, { a: 2, b: 3 }, { a: 4, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 7 }], okPoints: [{ r: 1, c: 2 }] }, { t });
    txt(ctx, 'Four corners meet: not allowed', left.x + left.w / 2, box.y + box.h - 14, { size: F(20), weight: 600, color: T.err, align: 'center', maxW: left.w, min: 11 });
    txt(ctx, 'Staggered: fine', right.x + right.w / 2, box.y + box.h - 14, { size: F(20), weight: 600, color: T.good, align: 'center', maxW: right.w, min: 11 });
    return;
  }
  if (kind === 'tray') {
    const s = Math.min(box.w / 6, box.h / 2.4, 110), x0 = box.x + (box.w - 5.5 * s) / 2, y0 = box.y + (box.h - 1.6 * s) / 2;
    drawMat(ctx, x0, y0, 2 * s, s, { seed: 2 });
    txt(ctx, 'x 7', x0 + 1 * s, y0 + 1.35 * s, { size: Math.max(F(22), s * 0.24), weight: 700, color: T.text, align: 'center' });
    drawMat(ctx, x0 + 2.5 * s, y0, s, s, { seed: 4, half: true });
    txt(ctx, 'x 1', x0 + 3 * s, y0 + 1.35 * s, { size: Math.max(F(22), s * 0.24), weight: 700, color: T.text, align: 'center' });
    ctx.fillStyle = rgba(T.accent, 0.9); rr(ctx, x0 + 4 * s, y0 + s * 0.15, 1.4 * s, 0.7 * s, s * 0.14); ctx.fill();
    txt(ctx, 'Turn', x0 + 4.7 * s, y0 + s * 0.5, { size: Math.max(F(20), s * 0.22), weight: 700, color: T.onAccent, align: 'center' });
    return;
  }
}
