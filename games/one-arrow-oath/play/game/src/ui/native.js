// Screens that lay themselves out from the live screen size (the "native" frame, units = screen units, short side 720):
// the scrolling card grid (Quiver / Spent / Tuner's Book / pick a card) and the full-size card close-up.
import { CARDS } from '../data/cards.js';
import { C, alpha } from './theme.js';
import { button, drawCard, paragraph, rule, text, tracked } from './draw.js';
import { host } from './frame.js';
import { CARD_H, CARD_W } from './layout.js';

const TAU = Math.PI * 2;
const R = (x, y, w, h) => ({ x, y, w, h });

// Mutable on purpose: game.js reads these for hit-testing, render reads them for drawing, both refreshed by applyCardsLayout.
export const GRID = { x: 24, y: 300, w: 672, h: 800, cols: 4, cellW: 168, cellH: 250 };
export const CARDS_CLOSE = R(190, 1360, 340, 76);
export const CARDS_HEAD = { x: 360, titleY: 90, noteY: 140 };

export function applyCardsLayout(w, h) {
  const hb = host.back > 0 ? host.back + 12 : 0;
  const avail = w - host.l - host.r - 24;
  const cols = Math.max(2, Math.min(8, Math.floor(avail / 168)));
  const top = host.t + 150;
  const close = R(w / 2 - 170, h - host.b - 16 - 76, 340, 76);
  Object.assign(CARDS_CLOSE, close);
  Object.assign(GRID, { cols, cellW: 168, cellH: 250, w: cols * 168, x: (w - cols * 168) / 2, y: top, h: Math.max(120, close.y - 12 - top) });
  Object.assign(CARDS_HEAD, { x: w / 2, titleY: host.t + 62, noteY: host.t + 112, maxW: w - 2 * Math.max(hb, 24) - host.l - host.r });
}

export function drawCardsOverlay(ctx, s, o, w, h) {
  applyCardsLayout(w, h);
  ctx.fillStyle = C.shade;
  ctx.fillRect(0, 0, w, h);
  tracked(ctx, o.title, CARDS_HEAD.x, CARDS_HEAD.titleY, { size: 34, spacing: 6, color: C.goldLight, glow: alpha(C.gold, 0.5), maxWidth: CARDS_HEAD.maxW });
  text(ctx, o.note, CARDS_HEAD.x, CARDS_HEAD.noteY, { size: 22, color: o.pick ? C.goldLight : C.inkSoft });
  ctx.save();
  ctx.beginPath();
  ctx.rect(GRID.x - 6, GRID.y - 6, GRID.w + 12, GRID.h + 12);
  ctx.clip();
  o.items.forEach((item, i) => {
    const col = i % GRID.cols;
    const row = Math.floor(i / GRID.cols);
    const x = GRID.x + col * GRID.cellW + GRID.cellW / 2;
    const y = GRID.y + row * GRID.cellH - o.scroll + GRID.cellH / 2;
    if (y < GRID.y - GRID.cellH || y > GRID.y + GRID.h + GRID.cellH) return;
    ctx.save();
    ctx.translate(x, y);
    drawCard(ctx, item.id, CARD_W, CARD_H, { t: s.t + i, dim: item.dim ?? !!item.note, lit: o.selected === item.uid });
    if (item.count > 0) {
      ctx.beginPath();
      ctx.arc(CARD_W / 2 - 10, -CARD_H / 2 + 14, 20, 0, TAU);
      ctx.fillStyle = '#0a0d22';
      ctx.fill();
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, `×${item.count}`, CARD_W / 2 - 10, -CARD_H / 2 + 21, { size: 18, weight: 800, color: C.goldLight });
    }
    ctx.restore();
  });
  ctx.restore();
  // scroll hint bar
  const rows = Math.ceil(o.items.length / GRID.cols);
  const max = Math.max(0, rows * GRID.cellH - GRID.h);
  if (max > 0) {
    const th = Math.max(40, (GRID.h * GRID.h) / (rows * GRID.cellH));
    const ty = GRID.y + (GRID.h - th) * (o.scroll / max);
    ctx.fillStyle = alpha(C.gold, 0.75);
    ctx.fillRect(GRID.x + GRID.w + 4, ty, 5, th);
  }
  if (!o.items.length) text(ctx, 'Nothing here yet.', w / 2, GRID.y + 120, { size: 27, color: C.muted, display: true });
  if (o.pick === 'pending') button(ctx, CARDS_CLOSE, 'Choose this one', { size: 26, primary: o.selected !== null, disabled: o.selected === null });
  else button(ctx, CARDS_CLOSE, o.pick ? 'Cancel' : 'Close', { size: 26, primary: !o.pick });
  if (o.inspect !== null) drawInspectNative(ctx, o.inspect, s.t, w, h);
}

export function drawInspectNative(ctx, id, t, w, h) {
  ctx.fillStyle = C.shade;
  ctx.fillRect(0, 0, w, h);
  const card = CARDS[id];
  const note = card.kind === 'arrow' ? 'A named Arrow. Loose it and it is Spent for the rest of the run.' : 'A Technique. It returns to you, fight after fight.';
  const col = card.kind === 'arrow' ? C.goldLight : C.inkSoft;
  const landscape = w > h * 1.15;
  if (landscape) {
    const ch = Math.min(654, h - host.t - host.b - 60);
    const cw = (ch * 440) / 654;
    const cx = w * 0.3;
    ctx.save();
    ctx.translate(cx, h / 2);
    drawCard(ctx, id, cw, ch, { t, lit: true });
    ctx.restore();
    const tx = w * 0.66;
    paragraph(ctx, note, tx, h / 2 - 40, Math.min(480, w * 0.4), { size: 26, color: col, lineH: 1.4, display: true });
    text(ctx, 'tap to close', tx, h / 2 + 130, { size: 20, color: C.muted });
  } else {
    const ch = Math.min(654, h * 0.5);
    const cw = (ch * 440) / 654;
    const cy = host.t + 40 + ch / 2 + (h - host.t - host.b - 80 - ch - 220) / 3;
    ctx.save();
    ctx.translate(w / 2, cy);
    drawCard(ctx, id, cw, ch, { t, lit: true });
    ctx.restore();
    paragraph(ctx, note, w / 2, cy + ch / 2 + 70, Math.min(w - 120, 560), { size: 24, color: col, lineH: 1.4, display: true });
    text(ctx, 'tap to close', w / 2, cy + ch / 2 + 190, { size: 20, color: C.muted });
  }
}
