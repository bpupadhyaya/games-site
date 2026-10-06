// Everything that is drawn each frame. Reads the state, the live layout (layout.js) and the visual card positions (fx.js);
// changes nothing, except that the Rules page reports its content height (for scrolling) through rulesMetrics.
import { CARD_W, CARD_H, TEXT_SCALES, AUTO_THINK_STEPS, SIBLINGS, HERO_D } from './layout.js';
import {
  FONT, UI, CREAM, GOLD, THEMES, TABLES, ink, rr,
  drawTable, drawTableSwatch, drawFace, drawBack, drawFaceLarge, drawBackLarge, drawLiftShadow,
  drawRing, drawWell, drawPip, drawButton, drawPlate, drawSheet, text, shadowText, wrapText, wrapLines, checkWrapFonts, memoFit, readerStats,
} from './art.js';
import { RULES } from './content.js';
import { drawCredit, drawLockup } from './brand.js';

const SUIT_ORDER = ['S', 'H', 'D', 'C'];
const HERO_CARDS = [null, { suit: 'C', rank: 11 }, { suit: 'D', rank: 12 }, { suit: 'S', rank: 13 }, { suit: 'H', rank: 1 }];

// Filled in while drawing the Rules page: how tall its content is vs the visible window (game.js clamps scrolling with it).
export const rulesMetrics = { contentH: 0, viewH: 0 };
export { readerStats };

// A button whose label shrinks to fit the rect (width and height), so text is never clipped at any screen shape.
function btn(ctx, r, label, o = {}) {
  let size = Math.min(o.size || 32, r.h * 0.46);
  ctx.font = `800 ${size}px ${UI}`;
  while (size > 11 && label && ctx.measureText(label).width > r.w - 20) { size -= 1; ctx.font = `800 ${size}px ${UI}`; }
  drawButton(ctx, r, label, { ...o, size, radius: Math.min(o.radius || 22, r.h / 2.2) });
}
const withBlock = (ctx, b, fn) => { ctx.save(); ctx.translate(b.ox, b.oy); ctx.scale(b.s, b.s); fn(); ctx.restore(); };

export function render(ctx, env, state, L, fx, { hintMoves, demoLimit }) {
  checkWrapFonts(ctx);
  drawTable(ctx, state.table, L.w, L.h);
  const theme = THEMES.find((t) => t.id === state.activeTheme) || THEMES[0];
  const calm = state.reducedMotion;
  const time = fx.time();

  if (state.scene === 'demo-limit') drawDemoLimit(ctx, L);
  else if (state.scene === 'title') drawTitle(ctx, env, state, theme, calm ? 0 : time, demoLimit, L);
  else if (state.scene === 'rules') drawRules(ctx, state, theme, L);
  else {
    drawPlay(ctx, state, L, fx, theme, hintMoves, calm ? 1 : 0.78 + 0.22 * Math.sin(time * 2.2));
    if (state.scene === 'won') drawWon(ctx, state, L, fx.sinceWon(), calm);
    if (state.scene === 'auto' && state.auto && state.auto.phase === 'ended') drawAutoEnded(ctx, state, L);
  }
  if (state.options) drawOptions(ctx, state, L, calm ? 1 : fx.optionsT());
}

// ---------------------------------------------------------------------------------------------
// A hand in play
// ---------------------------------------------------------------------------------------------
function drawPlay(ctx, state, L, fx, theme, hintMoves, pulse) {
  const board = state.board;
  const four = state.fourColorDeck;
  const { k, cw, ch } = L;
  const flying = [];
  let hintStock = false;
  const rings = [];
  const S = (x, y, fn) => { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); fn(); ctx.restore(); };
  const ring = (x, y, strength, h = ch) => S(x, y, () => drawRing(ctx, 0, 0, strength, h / k));

  drawEmblem(ctx, L.emblem.cx, L.emblem.cy, L.emblem.k);

  const paint = (card, x, y, flip) => {
    if (flip >= 1) return S(x, y, () => (card.faceUp ? drawFace(ctx, 0, 0, card, four) : drawBack(ctx, 0, 0, theme)));
    const showFace = flip >= 0.5 ? card.faceUp : !card.faceUp;
    ctx.save();
    ctx.translate(x + cw / 2, y);
    ctx.scale(k * Math.max(0.03, Math.abs(1 - 2 * flip)), k);
    if (showFace) drawFace(ctx, -CARD_W / 2, 0, card, four); else drawBack(ctx, -CARD_W / 2, 0, theme);
    ctx.restore();
  };
  const place = (card, x, y, rg, lift = 0) => {
    const v = fx.look(card, x, y);
    if (v.waiting) return false;
    if (v.moving > 0) { flying.push({ card, v }); return false; }
    paint(card, v.x, v.y - lift, v.flip);
    if (rg) ring(v.x, v.y - lift, rg);
    return true;
  };
  const placeTop = (pile, x, y, rg, lift = 0) => {
    let drawn = false;
    for (let i = pile.length - 1; i >= 0; i--) {
      if (drawn) { const v = fx.look(pile[i], x, y); if (v.moving > 0) flying.push({ card: pile[i], v }); continue; }
      drawn = place(pile[i], x, y, rg, lift);
    }
  };

  const hintSource = (pile, col, index) => hintMoves.some((m) => (pile === 'waste' ? m.source === 'waste' : m.source === 'tableau' && m.col === col && m.index === index));
  const hintColumn = (col) => hintMoves.some((m) => (m.kind === 'waste-tableau' && m.col === col) || (m.kind === 'tableau-tableau' && m.to === col));
  const hintSuits = new Set();
  for (const m of hintMoves) {
    if (m.kind === 'waste-foundation') hintSuits.add(board.waste[board.waste.length - 1].suit);
    else if (m.kind === 'tableau-foundation') hintSuits.add(board.tableau[m.col][m.index].suit);
  }

  SUIT_ORDER.forEach((suit, i) => {
    const pos = L.foundationPos(i);
    S(pos.x, pos.y, () => drawWell(ctx, 0, 0, suit));
    placeTop(board.foundations[suit], pos.x, pos.y, 0);
    if (hintSuits.has(suit)) ring(pos.x, pos.y, pulse);
  });

  board.tableau.forEach((column, col) => {
    const cx = L.tableauX(col);
    if (column.length === 0) {
      S(cx + 2 * k, L.tableauTopY, () => drawWell(ctx, 0, 0, 'K', 88));
      if (hintColumn(col)) rings.push([cx, L.tableauTopY, pulse, ch]);
      return;
    }
    const ys = L.columnYs(column);
    column.forEach((card, i) => {
      const picked = state.selected && state.selected.pile === 'tableau' && state.selected.col === col && i >= state.selected.index;
      const rg = picked ? (i === state.selected.index ? 1 : 0) : hintSource('tableau', col, i) ? pulse : 0;
      const lift = picked ? 10 * k : 0;
      place(card, cx, ys[i], 0, lift);
      if (rg) rings.push([cx, ys[i] - lift, rg, ys[ys.length - 1] - ys[i] + ch]);
    });
    if (hintColumn(col)) rings.push([cx, ys[ys.length - 1], pulse, ch]);
  });
  for (const [x, y, strength, h] of rings) ring(x, y, strength, h);

  const sp = L.stockPos, wp = L.wastePos;
  S(sp.x, sp.y, () => drawWell(ctx, 0, 0, 'recycle'));
  const resting = board.stock.filter((c) => { const v = fx.look(c, sp.x, sp.y); if (v.moving > 0) flying.push({ card: c, v }); return !(v.moving > 0); }).length;
  if (hintMoves.length > 0 && hintMoves.every((m) => m.kind === 'draw')) hintStock = true;
  if (resting > 0) {
    if (resting > 12) S(sp.x - 4 * k, sp.y - 5 * k, () => drawBack(ctx, 0, 0, theme));
    if (resting > 2) S(sp.x - 2 * k, sp.y - 2.5 * k, () => drawBack(ctx, 0, 0, theme));
    S(sp.x, sp.y, () => drawBack(ctx, 0, 0, theme));
  }
  if (hintStock && (board.stock.length > 0 || board.waste.length > 0)) ring(sp.x, sp.y, pulse);
  S(wp.x, wp.y, () => drawWell(ctx, 0, 0, ''));
  const wastePicked = state.selected && state.selected.pile === 'waste';
  placeTop(board.waste, wp.x, wp.y, wastePicked ? 1 : hintSource('waste') ? pulse : 0, wastePicked ? 10 * k : 0);

  const B = L.btn;
  if (state.scene === 'auto') {
    const A = state.auto;
    const ended = A && A.phase === 'ended';
    btn(ctx, B.autoSkip, ended ? 'Play again' : 'Skip this pause', { style: ended ? 'active' : 'primary', size: ended ? 34 : 26, radius: 26 });
    if (!ended) btn(ctx, B.autoPause, A && A.paused ? 'Resume' : 'Pause', { size: 26 });
    btn(ctx, B.autoExit, 'Exit', { size: 26, ...(ended ? {} : {}) });
  } else {
    btn(ctx, B.hint, 'What can I do?', { style: state.hint ? 'active' : 'primary', size: 38, radius: 26 });
    btn(ctx, B.options, 'Options', { size: 30 });
  }

  for (const { card, v } of flying) {
    S(v.x, v.y, () => drawLiftShadow(ctx, 0, 0, v.moving));
    paint(card, v.x, v.y - 6 * k * v.moving, v.flip);
  }

  if (!state.dealVerified && state.message) {
    text(ctx, 'This deal could not be confirmed as winnable.', L.msg.x, L.msg.y, 22, 'rgba(255,255,255,0.85)', UI, 600);
  }
  if (state.scene === 'auto') drawAutoBar(ctx, state, L);
}

// Auto Play's status strip: the phase word ("Thinking...") and the configurable think-time stepper.
function drawAutoBar(ctx, state, L) {
  const A = state.auto;
  if (!A) return;
  const B = L.btn, r = B.autoBar;
  drawPlate(ctx, r.x + r.w / 2, r.y, r.w, r.h);
  let label = A.phase === 'deal' ? 'Dealing...' : A.phase === 'think' ? 'Thinking...' : A.phase === 'reveal' ? 'Revealing...' : A.phase === 'ended' ? (A.solved ? 'Solved!' : 'Not solved') : '';
  if (A.paused && A.phase !== 'ended') label = 'Paused';
  const fs = Math.min(26, r.h * 0.4);
  text(ctx, label, r.x + 20, r.y + r.h / 2 + fs * 0.33, fs, A.paused ? '#ffd08a' : GOLD, UI, 700, 'left');
  text(ctx, `Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s`, B.autoDec.x - 14, r.y + r.h / 2 + fs * 0.3, Math.min(22, fs), CREAM, UI, 700, 'right');
  btn(ctx, B.autoDec, '-', { size: 30, radius: 12 });
  btn(ctx, B.autoInc, '+', { size: 30, radius: 12 });
}

function drawAutoEnded(ctx, state, L) {
  const A = state.auto, E = L.ended, d = E.d;
  ctx.save();
  ctx.fillStyle = 'rgba(8,4,8,0.55)';
  ctx.fillRect(0, 0, L.w, L.h);
  withBlock(ctx, E.blk, () => {
    drawSheet(ctx, d.sheet.x, d.sheet.y, d.sheet.w, d.sheet.h);
    const mw = (d.wide ? 470 : 540);
    text(ctx, A.solved ? 'Solved!' : 'Not solved this time', d.cx, d.titleY, d.wide ? 52 : 56, CREAM, FONT, 700);
    let y = d.textY;
    y += wrapText(ctx, A.solved ? "Every move was the search engine's own proven line." : 'The search budget ran out before finding a full line.', d.cx, y, 26, mw, 34, 'rgba(251,238,221,0.85)', 600) * 34 + 8;
    wrapText(ctx, 'Tap "Play again" for a new deal, or Exit to the title.', d.cx, y, 24, mw, 32, 'rgba(251,238,221,0.7)', 600);
    text(ctx, 'More from Arcforge', d.labelX, d.labelY, 24, 'rgba(251,238,221,0.75)', UI, 700);
    SIBLINGS.forEach((g, i) => btn(ctx, d.chips[i], g.title, { style: 'quiet', size: 28 }));
  });
  ctx.restore();
}

function drawEmblem(ctx, cx, cy, k) {
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, 150 * k, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 138 * k, 0, Math.PI * 2); ctx.stroke();
  SUIT_ORDER.forEach((suit, i) => drawPip(ctx, suit, cx + [0, 72, 0, -72][i] * k, cy + [-72, 0, 72, 0][i] * k, 78 * k, '#ffffff'));
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Title: the front door
// ---------------------------------------------------------------------------------------------
function drawTitle(ctx, env, state, theme, time, demoLimit, L) {
  const t = L.title, d = t.d, dy = t.dyR;
  withBlock(ctx, t.left, () => {
    shadowText(ctx, env.manifest.title, 360, 196, 84, CREAM, FONT, 700);
    text(ctx, 'Every deal winnable. No timers. No rush.', 360, 252, 30, 'rgba(251,238,221,0.85)', UI, 600);
    // a fanned hand of big cards; it shows the chosen card back and suit colours
    const scale = 1.6;
    HERO_CARDS.forEach((card, i) => {
      const sway = Math.sin(time * 0.55 + i * 0.9) * 0.006;
      ctx.save();
      ctx.translate(360, 1510);
      ctx.rotate(((-13.6 + i * 6.8) * Math.PI) / 180 + sway);
      ctx.translate(-(CARD_W * scale) / 2, -1150);
      ctx.scale(scale, scale);
      if (card) drawFaceLarge(ctx, 0, 0, card, state.fourColorDeck); else drawBackLarge(ctx, 0, 0, theme);
      ctx.restore();
    });
  });
  withBlock(ctx, t.right, () => {
    btn(ctx, d.deal, 'Deal', { style: 'primary', size: 64, radius: 34 });
    drawPlate(ctx, 360, d.plateY, 600, 76);
    text(ctx, `Hands played ${state.handsPlayed}   ·   Hands won ${state.handsWon}`, 360, d.plateY + 49, 30, CREAM, UI, 700);
    btn(ctx, d.row[0], 'Options', { size: 24 });
    btn(ctx, d.row[1], 'Rules', { size: 24 });
    btn(ctx, d.row[2], 'Auto', { size: 24 });
    if (state.demo) {
      drawPlate(ctx, 360, d.demoY, 520, 64);
      const left = Math.max(demoLimit - state.demoDeals, 0);
      text(ctx, `Free preview: ${left} ${left === 1 ? 'deal' : 'deals'} left`, 360, d.demoY + 42, 28, CREAM, UI, 600);
    }
    { const q = d.lock, dn = state.lkDown;       // the themed Arcforge lockup under the menu; a tap opens the Arcforge home
      ctx.save(); ctx.fillStyle = 'rgba(8,36,26,0.62)'; rr(ctx, q.x - 12, q.y - 6, q.w + 24, q.h + 12, (q.h + 12) / 2); ctx.fill(); ctx.restore();
      drawLockup(ctx, 360, q.y + (dn ? 1 : 0), q.h * (dn ? 0.96 : 1), dn ? 0.7 : 1); }
  });
}

// ---------------------------------------------------------------------------------------------
// Rules: an exhaustive, continuously scrolling reference with a scrolling reader. Every diagram uses the real card art.
// ---------------------------------------------------------------------------------------------
function drawRules(ctx, state, theme, L) {
  const rl = L.rules;
  const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  shadowText(ctx, 'Rules', rl.titleX, rl.titleY, rl.titleSize, CREAM, FONT, 700);

  const panel = rl.panel, inner = rl.inner;
  drawSheet(ctx, panel.x, panel.y, panel.w, panel.h);

  ctx.save();
  rr(ctx, inner.x - 8, inner.y - 6, inner.w + 16, inner.h + 12, 10); ctx.clip();
  const cx = inner.x + inner.w / 2;
  const top = inner.y - state.rulesScroll;
  // One continuous reader: every section in order, separated by a thin rule.
  const fontPx = Math.round(28 * scale), LH = Math.round(fontPx * 1.4);
  let y = top; const visTop = inner.y - 140, visBot = inner.y + inner.h + 140;
  RULES.forEach((page, idx) => {
    if (idx > 0) {
      y += Math.round(fontPx * 0.6);
      ctx.save(); ctx.strokeStyle = 'rgba(255,211,92,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(inner.x + 16, y); ctx.lineTo(inner.x + inner.w - 16, y); ctx.stroke(); ctx.restore();
      y += Math.round(fontPx * 0.5);
    }
    const ts0 = Math.round(34 * scale);
    const titleSize = memoFit(`t|${page.title}|${ts0}|${inner.w}`, () => { let q = ts0; ctx.font = `800 ${q}px ${UI}`; while (ctx.measureText(page.title).width > inner.w && q > 22) { q -= 2; ctx.font = `800 ${q}px ${UI}`; } return q; });
    const titleY = y + titleSize + 6;
    if (titleY > visTop && titleY - titleSize < visBot) text(ctx, page.title, cx, titleY, titleSize, GOLD, UI, 800);
    y = titleY + Math.round(titleSize * 0.4) + Math.round(fontPx * 0.85) + 15;
    if (page.diagram) {
      // The illustration's height never changes, so it is measured once; while it is far off-screen it is not drawn at all.
      const dk = `d|${page.title}|${scale}|${inner.w}|${state.fourColorDeck}`;
      const known = memoFit(dk + '|known', () => ({ off: null }));
      if (known.off !== null && (y + known.off < visTop - 40 || y > visBot + 40)) y += known.off;
      else { const y0 = y; y = drawRulesDiagram(ctx, page, theme, state, y, cx); known.off = y - y0; }
      y += 40 + Math.round(fontPx * 0.5);
    }
    for (const line of page.lines) {
      const ls = wrapLines(ctx, line, fontPx, inner.w, 500);
      if (y + ls.length * LH > visTop && y - fontPx < visBot) ls.forEach((ln, i) => text(ctx, ln, cx, y + i * LH, fontPx, 'rgba(251,238,221,0.94)', UI, 500));   // only the visible slice is drawn
      y += ls.length * LH + 12;
    }
  });
  ctx.restore();
  rulesMetrics.contentH = y - top + 6;
  rulesMetrics.viewH = inner.h;
  if (rulesMetrics.contentH > inner.h + 2) {
    const trackX = panel.x + panel.w - 12, th = inner.h, ratio = inner.h / rulesMetrics.contentH;
    const barH = Math.max(40, th * ratio), maxS = rulesMetrics.contentH - inner.h;
    const barY = inner.y + (th - barH) * Math.min(1, state.rulesScroll / maxS);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, trackX, inner.y, 6, th, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,211,92,0.75)'; rr(ctx, trackX, barY, 6, barH, 3); ctx.fill();
  }

  btn(ctx, rl.back, 'Back', { size: 36 });
  btn(ctx, rl.next, 'Done', { style: 'primary', size: 36 });
  const atMin = state.textScaleIdx === 0, atMax = state.textScaleIdx === TEXT_SCALES.length - 1;
  ctx.save(); if (atMin) ctx.globalAlpha = 0.4;
  btn(ctx, rl.textDec, 'A−', { size: 30 });
  ctx.restore();
  ctx.save(); if (atMax) ctx.globalAlpha = 0.4;
  btn(ctx, rl.textInc, 'A+', { size: 30 });
  ctx.restore();
}

// Draws the small still-life for one Rules page, using the real card art. Returns the y just below it.
function drawRulesDiagram(ctx, page, theme, state, top, cx) {
  const four = state.fourColorDeck;
  const grey = 'rgba(251,238,221,0.75)';
  if (page.diagram === 'deck') {
    const cards = page.cards, gap = 40, totalW = cards.length * CARD_W + (cards.length - 1) * gap;
    let x = cx - totalW / 2;
    for (const c of cards) { drawFace(ctx, x, top, c, four); x += CARD_W + gap; }
    return top + CARD_H;
  }
  if (page.diagram === 'ranks') {
    const [lo, hi] = page.cards, gap = 120, totalW = CARD_W * 2 + gap;
    const x0 = cx - totalW / 2;
    drawFace(ctx, x0, top, lo, four);
    drawFace(ctx, x0 + CARD_W + gap, top, hi, four);
    text(ctx, 'Lowest', x0 + CARD_W / 2, top + CARD_H + 32, 22, GOLD, UI, 700);
    text(ctx, 'Highest', x0 + CARD_W + gap + CARD_W / 2, top + CARD_H + 32, 22, GOLD, UI, 700);
    return top + CARD_H + 32;
  }
  if (page.diagram === 'colours') {
    const rank = 9, gap = 16;
    const cards = [{ suit: 'H', four: false }, { suit: 'D', four: false }, { suit: 'H', four: true }, { suit: 'D', four: true }];
    const totalW = cards.length * CARD_W + (cards.length - 1) * gap;
    let x = cx - totalW / 2;
    for (const c of cards) { drawFace(ctx, x, top, { suit: c.suit, rank }, c.four); x += CARD_W + gap; }
    text(ctx, '2-colour', cx - totalW / 2 + CARD_W + gap / 2, top + CARD_H + 30, 22, grey, UI, 700);
    text(ctx, '4-colour', cx - totalW / 2 + CARD_W * 3 + gap * 2 + gap / 2, top + CARD_H + 30, 22, grey, UI, 700);
    return top + CARD_H + 30;
  }
  if (page.diagram === 'deal') {
    const cols = [1, 4, 7];
    const scale = 0.5, step = 18, gap = 56;
    const w = CARD_W * scale;
    const totalW = cols.length * w + (cols.length - 1) * gap;
    let x = cx - totalW / 2;
    const baseY = top;
    let maxBottom = baseY;
    for (const n of cols) {
      for (let i = 0; i < n; i++) {
        const cy = baseY + i * step;
        ctx.save();
        ctx.translate(x, cy);
        ctx.scale(scale, scale);
        if (i === n - 1) drawFace(ctx, 0, 0, { suit: 'S', rank: 5 }, four); else drawBack(ctx, 0, 0, theme);
        ctx.restore();
        maxBottom = Math.max(maxBottom, cy + CARD_H * scale);
      }
      text(ctx, `Column: ${n} card${n === 1 ? '' : 's'}`, x + w / 2, maxBottom + 30, 20, grey, UI, 700);
      x += w + gap;
    }
    return maxBottom + 30;
  }
  if (page.diagram === 'stockwaste') {
    const gap = 90;
    const x0 = cx - (CARD_W * 2 + gap) / 2;
    drawBack(ctx, x0 - 4, top - 5, theme);
    drawBack(ctx, x0 - 2, top - 2.5, theme);
    drawBack(ctx, x0, top, theme);
    drawFace(ctx, x0 + CARD_W + gap, top, { suit: 'D', rank: 4 }, four);
    text(ctx, 'Stock', x0 + CARD_W / 2, top + CARD_H + 30, 22, grey, UI, 700);
    text(ctx, 'Waste', x0 + CARD_W + gap + CARD_W / 2, top + CARD_H + 30, 22, grey, UI, 700);
    return top + CARD_H + 30;
  }
  if (page.diagram === 'tableauRun') {
    const x = cx - CARD_W / 2, step = 74;
    drawFace(ctx, x, top, { suit: 'S', rank: 8 }, four);
    drawFace(ctx, x, top + step, { suit: 'H', rank: 7 }, four);
    drawRing(ctx, x, top, 1, step + CARD_H);
    text(ctx, 'This whole run moves together', cx, top + step + CARD_H + 34, 22, GOLD, UI, 700);
    return top + step + CARD_H + 34;
  }
  if (page.diagram === 'foundation') {
    const gap = 60;
    const x0 = cx - (CARD_W * 2 + gap) / 2;
    drawWell(ctx, x0, top, 'H');
    drawFace(ctx, x0, top, { suit: 'H', rank: 1 }, four);
    ctx.save();
    ctx.globalAlpha = 0.45;
    drawFace(ctx, x0 + CARD_W + gap, top, { suit: 'H', rank: 2 }, four);
    ctx.restore();
    text(ctx, 'On the foundation', x0 + CARD_W / 2, top + CARD_H + 30, 20, grey, UI, 700);
    text(ctx, 'Next legal card', x0 + CARD_W + gap + CARD_W / 2, top + CARD_H + 30, 20, grey, UI, 700);
    return top + CARD_H + 30;
  }
  if (page.diagram === 'backs') {
    const gap = 60;
    const themeA = THEMES[0], themeB = THEMES[4];
    const x0 = cx - (CARD_W * 2 + gap) / 2;
    drawBack(ctx, x0, top, themeA);
    drawBack(ctx, x0 + CARD_W + gap, top, themeB);
    text(ctx, themeA.title, x0 + CARD_W / 2, top + CARD_H + 30, 20, grey, UI, 700);
    text(ctx, themeB.title, x0 + CARD_W + gap + CARD_W / 2, top + CARD_H + 30, 20, grey, UI, 700);
    return top + CARD_H + 30;
  }
  return top;
}

// ---------------------------------------------------------------------------------------------
// Options sheet
// ---------------------------------------------------------------------------------------------
function drawOptions(ctx, state, L, t) {
  const O = L.opt, d = O.d, m = O.meta;
  const k = 1 - (1 - t) * (1 - t);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(8,4,8,0.78)';
  ctx.fillRect(0, 0, L.w, L.h);
  ctx.translate(0, (1 - k) * 40);
  withBlock(ctx, O.blk, () => {
    drawSheet(ctx, d.sheet.x, d.sheet.y, d.sheet.w, d.sheet.h);
    text(ctx, 'Options', m.title.x, m.title.y, m.title.size, CREAM, FONT, 700, m.title.align);
    const label = (str, p) => text(ctx, str, p.x, p.y, 28, 'rgba(251,238,221,0.85)', UI, 700, 'left');

    label(`Table: ${TABLES[state.table].name}`, m.lblTable);
    for (let i = 0; i < TABLES.length; i++) drawTableSwatch(ctx, d.table[i], i, state.table === i);

    const active = THEMES.find((th) => th.id === state.activeTheme) || THEMES[0];
    label(`Card back: ${active.title}`, m.lblTheme);
    THEMES.forEach((th, i) => {
      const r = d.theme[i], on = th.id === active.id, s = r.w / (CARD_W - 20);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      rr(ctx, r.x + 2, r.y + 6, r.w, r.h, 16); ctx.fill();
      ctx.save();
      rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.clip();
      ctx.translate(r.x - 10 * s, r.y - (CARD_H * s - r.h) / 2);
      ctx.scale(s, s);
      drawBack(ctx, 0, 0, th);
      ctx.restore();
      rr(ctx, r.x, r.y, r.w, r.h, 16);
      ctx.strokeStyle = on ? GOLD : 'rgba(255,255,255,0.4)'; ctx.lineWidth = on ? 7 : 2; ctx.stroke();
      text(ctx, th.title, r.x + r.w / 2, r.y + r.h + m.themeTitleDy, 26, on ? GOLD : CREAM, UI, 700);
    });

    label('Suit colours', m.lblSuits);
    suitsButton(ctx, d.suits2, '2 colours', false, !state.fourColorDeck);
    suitsButton(ctx, d.suits4, '4 colours', true, state.fourColorDeck);

    label('Motion', m.lblMotion);
    btn(ctx, d.motionOn, 'Gentle', { style: state.reducedMotion ? 'quiet' : 'active', size: 32 });
    btn(ctx, d.motionOff, 'Reduced', { style: state.reducedMotion ? 'active' : 'quiet', size: 32 });

    if (state.scene === 'playing') {
      btn(ctx, d.newDeal, 'New deal', { style: 'quiet', size: 34, radius: 30 });
      btn(ctx, d.menu, 'Main menu', { style: 'quiet', size: 34, radius: 30 });
      btn(ctx, d.doneAfterHand, 'Done', { style: 'primary', size: 46, radius: 30 });
    } else {
      btn(ctx, d.done, 'Done', { style: 'primary', size: 46, radius: 30 });
    }
  });
  ctx.restore();
}

function suitsButton(ctx, r, label, four, on) {
  drawButton(ctx, r, '', { style: on ? 'active' : 'quiet' });
  text(ctx, label, r.x + 18, r.y + r.h / 2 + 11, 28, on ? '#2a1a00' : CREAM, UI, 800, 'left');
  const cx = r.x + r.w - 136;
  rr(ctx, cx, r.y + 18, 124, r.h - 36, 12);
  ctx.fillStyle = '#fbf5e8'; ctx.fill();
  SUIT_ORDER.forEach((suit, i) => drawPip(ctx, suit, cx + 17 + i * 30, r.y + r.h / 2, 25, ink(four, suit)));
}

// ---------------------------------------------------------------------------------------------
// Won, and the end of the free preview
// ---------------------------------------------------------------------------------------------
function drawWon(ctx, state, L, since, calm) {
  const k = calm ? 1 : Math.min(1, since / 0.7);
  const Wd = L.won, d = Wd.d;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(8,4,8,0.5)';
  ctx.fillRect(0, 0, L.w, L.h);
  if (!calm) {
    for (let i = 0; i < 16; i++) {
      const ph = (since * 0.07 + i * 0.173) % 1;
      const x = 50 + ((i * 263) % Math.max(100, L.w - 100)) + Math.sin(since * 0.5 + i) * 14;
      const a = Math.sin(Math.PI * ph) * 0.5;
      drawPip(ctx, SUIT_ORDER[i % 4], x, L.h * 1.02 - ph * L.h * 1.04, 40 + (i % 3) * 16, i % 2 ? `rgba(255,211,92,${a})` : `rgba(255,190,215,${a})`);
    }
  }
  withBlock(ctx, Wd.blk, () => {
    drawSheet(ctx, d.sheet.x, d.sheet.y, d.sheet.w, d.sheet.h);
    SUIT_ORDER.forEach((suit, i) => drawPip(ctx, suit, d.cx - 96 + i * 64, d.pipY, 44, i % 2 ? '#ee6aa2' : GOLD));
    text(ctx, 'Well played', d.cx, d.titleY, 88, CREAM, FONT, 700);
    text(ctx, 'All four foundations complete.', d.cx, d.line1Y, 30, 'rgba(251,238,221,0.9)', UI, 600);
    text(ctx, `Hands won: ${state.handsWon}`, d.cx, d.line2Y, 30, GOLD, UI, 700);
    btn(ctx, d.deal, 'Deal again', { style: 'primary', size: 46, radius: 30 });
    text(ctx, 'More from Arcforge', d.lblX, d.lblY, 24, 'rgba(251,238,221,0.75)', UI, 700);
    SIBLINGS.forEach((g, i) => btn(ctx, d.chips[i], g.title, { style: 'quiet', size: 28 }));
  });
  ctx.restore();
}

function drawDemoLimit(ctx, L) {
  withBlock(ctx, L.demo.blk, () => {
    const s = L.demo.d.sheet;
    drawSheet(ctx, s.x, s.y, s.w, s.h);
    text(ctx, "That's the free preview", 360, 640, 58, CREAM, FONT, 700);
    wrapText(ctx, 'Get the full game on iPhone and Android for unlimited deals and every card back.', 360, 730, 32, 520, 46, 'rgba(251,238,221,0.92)');
  });
}
