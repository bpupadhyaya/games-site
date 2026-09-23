// Everything that is drawn each frame. Reads the state and the visual card positions (fx.js);
// changes nothing.
import { W, H, CARD_W, CARD_H, BTN, OPT, TEXT_SCALES, AUTO_THINK_STEPS } from './layout.js';
import {
  FONT, UI, CREAM, GOLD, THEMES, TABLES, ink, rr,
  drawTable, drawTableSwatch, drawFace, drawBack, drawFaceLarge, drawBackLarge, drawLiftShadow,
  drawRing, drawWell, drawPip, drawButton, drawPlate, drawSheet, text, shadowText, wrapText,
} from './art.js';
import { RULES } from './content.js';

const SUIT_ORDER = ['S', 'H', 'D', 'C'];
const HERO_CARDS = [null, { suit: 'C', rank: 11 }, { suit: 'D', rank: 12 }, { suit: 'S', rank: 13 }, { suit: 'H', rank: 1 }];

export function render(ctx, env, state, layout, fx, { hintMoves, demoLimit }) {
  drawTable(ctx, state.table);
  const theme = THEMES.find((t) => t.id === state.activeTheme) || THEMES[0];
  const calm = state.reducedMotion;
  const time = fx.time();

  if (state.scene === 'demo-limit') drawDemoLimit(ctx);
  else if (state.scene === 'title') drawTitle(ctx, env, state, theme, calm ? 0 : time, demoLimit);
  else if (state.scene === 'rules') drawRules(ctx, state, theme);
  else {
    drawPlay(ctx, state, layout, fx, theme, hintMoves, calm ? 1 : 0.78 + 0.22 * Math.sin(time * 2.2));
    if (state.scene === 'won') drawWon(ctx, state, fx.sinceWon(), calm);
    if (state.scene === 'auto' && state.auto && state.auto.phase === 'ended') drawAutoEnded(ctx, state);
  }
  if (state.options) drawOptions(ctx, state, calm ? 1 : fx.optionsT());
}

// ---------------------------------------------------------------------------------------------
// A hand in play
// ---------------------------------------------------------------------------------------------
function drawPlay(ctx, state, layout, fx, theme, hintMoves, pulse) {
  const board = state.board;
  const four = state.fourColorDeck;
  const flying = [];
  let hintStock = false;
  const rings = [];

  // a quiet mark printed on the cloth, so the open felt never looks unfinished
  drawEmblem(ctx, 1040, 1);

  const paint = (card, x, y, flip) => {
    if (flip >= 1) return card.faceUp ? drawFace(ctx, x, y, card, four) : drawBack(ctx, x, y, theme);
    const showFace = flip >= 0.5 ? card.faceUp : !card.faceUp;
    ctx.save();
    ctx.translate(x + CARD_W / 2, 0);
    ctx.scale(Math.max(0.03, Math.abs(1 - 2 * flip)), 1);
    if (showFace) drawFace(ctx, -CARD_W / 2, y, card, four); else drawBack(ctx, -CARD_W / 2, y, theme);
    ctx.restore();
  };
  // Draws a card where it currently is; cards in the air are kept for last so they pass over everything.
  const place = (card, x, y, ring, lift = 0) => {
    const v = fx.look(card, x, y);
    if (v.waiting) return false;
    if (v.moving > 0) { flying.push({ card, v }); return false; }
    paint(card, v.x, v.y - lift, v.flip);
    if (ring) drawRing(ctx, v.x, v.y - lift, ring);
    return true;
  };
  // A pile that only shows its top card: draw the highest card that is at rest.
  const placeTop = (pile, x, y, ring, lift = 0) => {
    let drawn = false;
    for (let i = pile.length - 1; i >= 0; i--) {
      if (drawn) { const v = fx.look(pile[i], x, y); if (v.moving > 0) flying.push({ card: pile[i], v }); continue; }
      drawn = place(pile[i], x, y, ring, lift);
    }
  };

  const hintSource = (pile, col, index) => hintMoves.some((m) => (pile === 'waste' ? m.source === 'waste' : m.source === 'tableau' && m.col === col && m.index === index));
  const hintColumn = (col) => hintMoves.some((m) => (m.kind === 'waste-tableau' && m.col === col) || (m.kind === 'tableau-tableau' && m.to === col));
  const hintSuits = new Set();
  for (const m of hintMoves) {
    if (m.kind === 'waste-foundation') hintSuits.add(board.waste[board.waste.length - 1].suit);
    else if (m.kind === 'tableau-foundation') hintSuits.add(board.tableau[m.col][m.index].suit);
  }

  // foundations
  SUIT_ORDER.forEach((suit, i) => {
    const pos = layout.foundationPos(i);
    drawWell(ctx, pos.x, pos.y, suit);
    placeTop(board.foundations[suit], pos.x, pos.y, 0);
    if (hintSuits.has(suit)) drawRing(ctx, pos.x, pos.y, pulse);
  });

  // tableau — left to right, so each column rests over the edge of the one before it
  board.tableau.forEach((column, col) => {
    const cx = layout.tableauX(col);
    if (column.length === 0) {
      drawWell(ctx, cx + 2, layout.tableauTopY, 'K', 88);
      if (hintColumn(col)) rings.push([cx, layout.tableauTopY, pulse, CARD_H]);
      return;
    }
    const ys = layout.columnYs(column);
    column.forEach((card, i) => {
      const picked = state.selected && state.selected.pile === 'tableau' && state.selected.col === col && i >= state.selected.index;
      const ring = picked ? (i === state.selected.index ? 1 : 0) : hintSource('tableau', col, i) ? pulse : 0;
      place(card, cx, ys[i], 0, picked ? 10 : 0);
      // the ring wraps the whole run that would move, and is drawn over the neighbouring columns
      if (ring) rings.push([cx, ys[i] - (picked ? 10 : 0), ring, ys[ys.length - 1] - ys[i] + CARD_H]);
    });
    if (hintColumn(col)) rings.push([cx, ys[ys.length - 1], pulse, CARD_H]);
  });
  for (const [x, y, strength, h] of rings) drawRing(ctx, x, y, strength, h);

  // stock and waste, under the thumb
  const sp = layout.stockPos, wp = layout.wastePos;
  drawWell(ctx, sp.x, sp.y, 'recycle');
  const resting = board.stock.filter((c) => { const v = fx.look(c, sp.x, sp.y); if (v.moving > 0) flying.push({ card: c, v }); return !(v.moving > 0); }).length;
  if (hintMoves.length > 0 && hintMoves.every((m) => m.kind === 'draw')) hintStock = true;
  if (resting > 0) {
    if (resting > 12) drawBack(ctx, sp.x - 4, sp.y - 5, theme);
    if (resting > 2) drawBack(ctx, sp.x - 2, sp.y - 2.5, theme);
    drawBack(ctx, sp.x, sp.y, theme);
  }
  if (hintStock && (board.stock.length > 0 || board.waste.length > 0)) drawRing(ctx, sp.x, sp.y, pulse);
  drawWell(ctx, wp.x, wp.y, '');
  const wastePicked = state.selected && state.selected.pile === 'waste';
  placeTop(board.waste, wp.x, wp.y, wastePicked ? 1 : hintSource('waste') ? pulse : 0, wastePicked ? 10 : 0);

  if (state.scene === 'auto') {
    const A = state.auto;
    const ended = A && A.phase === 'ended';
    drawButton(ctx, BTN.autoSkip, ended ? 'Play again' : 'Skip this pause', { style: ended ? 'active' : 'primary', size: ended ? 34 : 26, radius: 26 });
    if (!ended) drawButton(ctx, BTN.autoPause, A && A.paused ? 'Resume' : 'Pause', { size: 26 });
    drawButton(ctx, BTN.autoExit, 'Exit', { size: 26 });
  } else {
    drawButton(ctx, BTN.hint, 'What can I do?', { style: state.hint ? 'active' : 'primary', size: 38, radius: 26 });
    drawButton(ctx, BTN.options, 'Options', { size: 30 });
  }

  for (const { card, v } of flying) {
    drawLiftShadow(ctx, v.x, v.y, v.moving);
    paint(card, v.x, v.y - 6 * v.moving, v.flip);
  }

  if (!state.dealVerified && state.message) {
    text(ctx, 'This deal could not be confirmed as winnable.', W / 2, 92, 24, 'rgba(255,255,255,0.85)', UI, 600);
  }
  if (state.scene === 'auto') drawAutoBar(ctx, state);
}

// Auto Play's status strip: the top ~100px is otherwise empty in this game (see layout.js), so the
// phase caption ("Thinking...", "About to: ...") and the configurable think-time stepper live there.
function drawAutoBar(ctx, state) {
  const A = state.auto;
  if (!A) return;
  const r = BTN.autoBar;
  drawPlate(ctx, r.x + r.w / 2, r.y, r.w, r.h);
  // Short phase word on the left (the highlighted card/ring already shows WHICH move — see
  // hintSource/state.selected reuse above — so this never needs to repeat the long caption and
  // risk colliding with the stepper on the right).
  let label = A.phase === 'deal' ? 'Dealing...' : A.phase === 'think' ? 'Thinking...' : A.phase === 'reveal' ? 'Revealing...' : A.phase === 'ended' ? (A.solved ? 'Solved!' : 'Not solved') : '';
  if (A.paused && A.phase !== 'ended') label = 'Paused';
  text(ctx, label, r.x + 20, r.y + r.h / 2 + 8, 26, A.paused ? '#ffd08a' : GOLD, UI, 700, 'left');
  text(ctx, `Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s`, BTN.autoDec.x - 20, r.y + r.h / 2 + 8, 22, CREAM, UI, 700, 'right');
  drawButton(ctx, BTN.autoDec, '-', { size: 28, radius: 12 });
  drawButton(ctx, BTN.autoInc, '+', { size: 28, radius: 12 });
}

function drawAutoEnded(ctx, state) {
  const A = state.auto;
  ctx.save();
  ctx.fillStyle = 'rgba(8,4,8,0.55)';
  ctx.fillRect(0, 0, W, H);
  drawSheet(ctx, 50, 620, 620, 360);
  text(ctx, A.solved ? 'Solved!' : 'Not solved this time', W / 2, 720, 56, CREAM, FONT, 700);
  text(ctx, A.solved ? 'Every move was the search engine\'s own proven line.' : 'The search budget ran out before finding a full line.', W / 2, 780, 26, 'rgba(251,238,221,0.85)', UI, 600);
  text(ctx, 'Tap "Play again" for a new deal, or Exit to the title.', W / 2, 830, 24, 'rgba(251,238,221,0.7)', UI, 600);
  ctx.restore();
}

function drawEmblem(ctx, cy, k) {
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W / 2, cy, 150 * k, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, cy, 138 * k, 0, Math.PI * 2); ctx.stroke();
  SUIT_ORDER.forEach((suit, i) => drawPip(ctx, suit, W / 2 + [0, 72, 0, -72][i] * k, cy + [-72, 0, 72, 0][i] * k, 78 * k, '#ffffff'));
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Title: the front door
// ---------------------------------------------------------------------------------------------
function drawTitle(ctx, env, state, theme, time, demoLimit) {
  if (!state.demo) drawEmblem(ctx, 1420, 0.62);
  shadowText(ctx, env.manifest.title, W / 2, 196, 84, CREAM, FONT, 700);
  text(ctx, 'Every deal winnable. No timers. No rush.', W / 2, 252, 30, 'rgba(251,238,221,0.85)', UI, 600);

  // a fanned hand of big cards; it shows the chosen card back and suit colours
  const scale = 1.6;
  HERO_CARDS.forEach((card, i) => {
    const sway = Math.sin(time * 0.55 + i * 0.9) * 0.006;
    ctx.save();
    ctx.translate(W / 2, 1510);
    ctx.rotate(((-13.6 + i * 6.8) * Math.PI) / 180 + sway);
    ctx.translate(-(CARD_W * scale) / 2, -1150);
    ctx.scale(scale, scale);
    if (card) drawFaceLarge(ctx, 0, 0, card, state.fourColorDeck); else drawBackLarge(ctx, 0, 0, theme);
    ctx.restore();
  });

  drawButton(ctx, BTN.deal, 'Deal', { style: 'primary', size: 64, radius: 34 });

  drawPlate(ctx, W / 2, 1046, 600, 76);
  text(ctx, `Hands played ${state.handsPlayed}   ·   Hands won ${state.handsWon}`, W / 2, 1095, 30, CREAM, UI, 700);

  // Options/Rules/Auto share one row; each is narrower now that there are three, so the label size
  // comes down to match (still large-print by this game's own standard — see GDD).
  drawButton(ctx, BTN.titleOptions, 'Options', { size: 24 });
  drawButton(ctx, BTN.titleRules, 'Rules', { size: 24 });
  drawButton(ctx, BTN.titleAuto, 'Auto', { size: 24 });

  if (state.demo) {
    drawPlate(ctx, W / 2, 1300, 520, 64);
    const left = Math.max(demoLimit - state.demoDeals, 0);
    text(ctx, `Free preview: ${left} ${left === 1 ? 'deal' : 'deals'} left`, W / 2, 1342, 28, CREAM, UI, 600);
  }
}

// ---------------------------------------------------------------------------------------------
// Rules: an exhaustive, paginated reference. Additive only — reachable from the title screen's
// new "Rules" button. Every diagram below is drawn with the same drawFace/drawBack/drawWell/
// drawRing functions the real board uses, never a separate simplified icon set.
// ---------------------------------------------------------------------------------------------
function drawRules(ctx, state, theme) {
  const page = RULES[state.rulesPage % RULES.length];
  // Text scale for this reference page only. Always guarded: an out-of-range saved index (e.g.
  // from a build with a shorter TEXT_SCALES array) falls back to 1, never NaN.
  const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  shadowText(ctx, 'Rules', W / 2, 176, Math.round(58 * Math.min(scale, 1.15)), CREAM, FONT, 700);

  // The reader card: one framed panel holding the page title, any diagram and the body text, so
  // the page reads as a designed reference sheet rather than loose floating text.
  const panel = { x: 30, y: 205, w: W - 60, h: 1165 };
  drawSheet(ctx, panel.x, panel.y, panel.w, panel.h);

  // A page title can vary a lot in length; shrink it rather than let it ever touch the edges.
  let titleSize = Math.round(34 * scale);
  ctx.font = `800 ${titleSize}px ${UI}`;
  while (ctx.measureText(page.title).width > panel.w - 60 && titleSize > 22) {
    titleSize -= 2;
    ctx.font = `800 ${titleSize}px ${UI}`;
  }
  text(ctx, page.title, W / 2, panel.y + 55, titleSize, GOLD, UI, 800);

  // Diagrams are drawn at a fixed size (they reuse the board's own real card art) - never scaled,
  // matching the game's own cards. Only the body text and titles grow with the stepper.
  // The gap below the title must clear BOTH the title's own descent AND whatever follows it: a
  // short title shrinks very little (so it still needs its own clearance), but even a heavily
  // shrunk title sits above a full-size (84px at 300%) body line, whose own ascent reaches a long
  // way up from its baseline. Using only the title's size undershot when the title was short/small
  // (its own term shrank) while the body's ascent term stayed the same regardless.
  const fontPx = Math.round(28 * scale), LH = Math.round(fontPx * 1.4);
  let y = panel.y + 55 + Math.round(titleSize * 0.4) + Math.round(fontPx * 0.85) + 15;
  if (page.diagram) {
    // Diagram art itself is fixed-size (never scaled), but where it STARTS must still clear the
    // title above it — same fixed-gap-vs-shrink-to-fit-title bug as the body text had. The gap
    // AFTER the diagram must also grow with the body font: a fixed 40px cleared a ~21px ascent at
    // the old top step, not the ~63px ascent of an 84px body line at 300%.
    y = drawRulesDiagram(ctx, page, theme, state, y) + 40 + Math.round(fontPx * 0.5);
  }

  for (const line of page.lines) {
    const numLines = wrapText(ctx, line, W / 2, y, fontPx, panel.w - 80, LH, 'rgba(251,238,221,0.94)', 500);
    y += numLines * LH + 12;
  }

  text(ctx, `Page ${(state.rulesPage % RULES.length) + 1} of ${RULES.length}`, W / 2, 1392, 24, 'rgba(251,238,221,0.65)', UI, 600);
  drawButton(ctx, BTN.rulesBack, 'Back', { size: 36 });
  drawButton(ctx, BTN.rulesNext, state.rulesPage >= RULES.length - 1 ? 'Done' : 'Next', { style: 'primary', size: 36 });
  const atMin = state.textScaleIdx === 0, atMax = state.textScaleIdx === TEXT_SCALES.length - 1;
  ctx.save(); if (atMin) ctx.globalAlpha = 0.4;
  drawButton(ctx, BTN.textDec, 'A−', { size: 30 });
  ctx.restore();
  ctx.save(); if (atMax) ctx.globalAlpha = 0.4;
  drawButton(ctx, BTN.textInc, 'A+', { size: 30 });
  ctx.restore();
}

// Draws the small still-life for one Rules page, using the real card art. Returns the y just
// below the diagram so the caller knows where to start the body text.
function drawRulesDiagram(ctx, page, theme, state, top) {
  const four = state.fourColorDeck;
  if (page.diagram === 'deck') {
    const cards = page.cards, gap = 40, totalW = cards.length * CARD_W + (cards.length - 1) * gap;
    let x = (W - totalW) / 2;
    for (const c of cards) { drawFace(ctx, x, top, c, four); x += CARD_W + gap; }
    return top + CARD_H;
  }
  if (page.diagram === 'ranks') {
    const [lo, hi] = page.cards, gap = 120, totalW = CARD_W * 2 + gap;
    const x0 = (W - totalW) / 2;
    drawFace(ctx, x0, top, lo, four);
    drawFace(ctx, x0 + CARD_W + gap, top, hi, four);
    text(ctx, 'Lowest', x0 + CARD_W / 2, top + CARD_H + 32, 22, GOLD, UI, 700);
    text(ctx, 'Highest', x0 + CARD_W + gap + CARD_W / 2, top + CARD_H + 32, 22, GOLD, UI, 700);
    return top + CARD_H + 32;
  }
  if (page.diagram === 'colours') {
    const rank = 9, gap = 16;
    const cards = [
      { suit: 'H', four: false }, { suit: 'D', four: false },
      { suit: 'H', four: true }, { suit: 'D', four: true },
    ];
    const totalW = cards.length * CARD_W + (cards.length - 1) * gap;
    let x = (W - totalW) / 2;
    for (const c of cards) {
      drawFace(ctx, x, top, { suit: c.suit, rank }, c.four);
      x += CARD_W + gap;
    }
    text(ctx, '2-colour', (W - totalW) / 2 + CARD_W + gap / 2, top + CARD_H + 30, 22, 'rgba(251,238,221,0.75)', UI, 700);
    text(ctx, '4-colour', (W - totalW) / 2 + CARD_W * 3 + gap * 2 + gap / 2, top + CARD_H + 30, 22, 'rgba(251,238,221,0.75)', UI, 700);
    return top + CARD_H + 30;
  }
  if (page.diagram === 'deal') {
    const cols = [1, 4, 7];
    const scale = 0.5, step = 18, gap = 56;
    const w = CARD_W * scale;
    const totalW = cols.length * w + (cols.length - 1) * gap;
    let x = (W - totalW) / 2;
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
      text(ctx, `Column: ${n} card${n === 1 ? '' : 's'}`, x + w / 2, maxBottom + 30, 20, 'rgba(251,238,221,0.75)', UI, 700);
      x += w + gap;
    }
    return maxBottom + 30;
  }
  if (page.diagram === 'stockwaste') {
    const gap = 90;
    const x0 = (W - (CARD_W * 2 + gap)) / 2;
    drawBack(ctx, x0 - 4, top - 5, theme);
    drawBack(ctx, x0 - 2, top - 2.5, theme);
    drawBack(ctx, x0, top, theme);
    drawFace(ctx, x0 + CARD_W + gap, top, { suit: 'D', rank: 4 }, four);
    text(ctx, 'Stock', x0 + CARD_W / 2, top + CARD_H + 30, 22, 'rgba(251,238,221,0.75)', UI, 700);
    text(ctx, 'Waste', x0 + CARD_W + gap + CARD_W / 2, top + CARD_H + 30, 22, 'rgba(251,238,221,0.75)', UI, 700);
    return top + CARD_H + 30;
  }
  if (page.diagram === 'tableauRun') {
    const cx = W / 2 - CARD_W / 2, step = 74;
    const black8 = { suit: 'S', rank: 8 }, red7 = { suit: 'H', rank: 7 };
    drawFace(ctx, cx, top, black8, four);
    drawFace(ctx, cx, top + step, red7, four);
    drawRing(ctx, cx, top, 1, step + CARD_H);
    text(ctx, 'This whole run moves together', W / 2, top + step + CARD_H + 34, 22, GOLD, UI, 700);
    return top + step + CARD_H + 34;
  }
  if (page.diagram === 'foundation') {
    const gap = 60;
    const x0 = (W - (CARD_W * 2 + gap)) / 2;
    drawWell(ctx, x0, top, 'H');
    drawFace(ctx, x0, top, { suit: 'H', rank: 1 }, four);
    ctx.save();
    ctx.globalAlpha = 0.45;
    drawFace(ctx, x0 + CARD_W + gap, top, { suit: 'H', rank: 2 }, four);
    ctx.restore();
    text(ctx, 'On the foundation', x0 + CARD_W / 2, top + CARD_H + 30, 20, 'rgba(251,238,221,0.75)', UI, 700);
    text(ctx, 'Next legal card', x0 + CARD_W + gap + CARD_W / 2, top + CARD_H + 30, 20, 'rgba(251,238,221,0.75)', UI, 700);
    return top + CARD_H + 30;
  }
  if (page.diagram === 'backs') {
    const gap = 60;
    const themeA = THEMES[0], themeB = THEMES[4];
    const x0 = (W - (CARD_W * 2 + gap)) / 2;
    drawBack(ctx, x0, top, themeA);
    drawBack(ctx, x0 + CARD_W + gap, top, themeB);
    text(ctx, themeA.title, x0 + CARD_W / 2, top + CARD_H + 30, 20, 'rgba(251,238,221,0.75)', UI, 700);
    text(ctx, themeB.title, x0 + CARD_W + gap + CARD_W / 2, top + CARD_H + 30, 20, 'rgba(251,238,221,0.75)', UI, 700);
    return top + CARD_H + 30;
  }
  return top;
}

// ---------------------------------------------------------------------------------------------
// Options sheet
// ---------------------------------------------------------------------------------------------
function drawOptions(ctx, state, t) {
  const k = 1 - (1 - t) * (1 - t);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(8,4,8,0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(0, (1 - k) * 40);
  drawSheet(ctx, 20, 104, 680, 1390);
  text(ctx, 'Options', W / 2, 190, 64, CREAM, FONT, 700);
  const label = (str, y) => text(ctx, str, 46, y, 28, 'rgba(251,238,221,0.85)', UI, 700, 'left');

  label(`Table: ${TABLES[state.table].name}`, 246);
  for (let i = 0; i < TABLES.length; i++) drawTableSwatch(ctx, OPT.tableRect(i), i, state.table === i);

  const active = THEMES.find((th) => th.id === state.activeTheme) || THEMES[0];
  label(`Card back: ${active.title}`, 524);
  THEMES.forEach((th, i) => {
    const r = OPT.themeRect(i), on = th.id === active.id, s = r.w / (CARD_W - 20);
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
    text(ctx, th.title, r.x + r.w / 2, r.y + r.h + 32, 26, on ? GOLD : CREAM, UI, 700);
  });

  label('Suit colours', 984);
  suitsButton(ctx, OPT.suits2, '2 colours', false, !state.fourColorDeck);
  suitsButton(ctx, OPT.suits4, '4 colours', true, state.fourColorDeck);

  label('Motion', 1164);
  drawButton(ctx, OPT.motionOn, 'Gentle', { style: state.reducedMotion ? 'quiet' : 'active', size: 32 });
  drawButton(ctx, OPT.motionOff, 'Reduced', { style: state.reducedMotion ? 'active' : 'quiet', size: 32 });

  if (state.scene === 'playing') {
    drawButton(ctx, OPT.newDeal, 'New deal', { style: 'quiet', size: 36, radius: 30 });
    drawButton(ctx, OPT.doneAfterHand, 'Done', { style: 'primary', size: 46, radius: 30 });
  } else {
    drawButton(ctx, OPT.done, 'Done', { style: 'primary', size: 46, radius: 30 });
  }
  ctx.restore();
}

function suitsButton(ctx, r, label, four, on) {
  drawButton(ctx, r, '', { style: on ? 'active' : 'quiet' });
  text(ctx, label, r.x + 22, r.y + r.h / 2 + 11, 30, on ? '#2a1a00' : CREAM, UI, 800, 'left');
  const cx = r.x + r.w - 140;
  rr(ctx, cx, r.y + 22, 124, r.h - 44, 12);
  ctx.fillStyle = '#fbf5e8'; ctx.fill();
  SUIT_ORDER.forEach((suit, i) => drawPip(ctx, suit, cx + 17 + i * 30, r.y + r.h / 2, 25, ink(four, suit)));
}

// ---------------------------------------------------------------------------------------------
// Won, and the end of the free preview
// ---------------------------------------------------------------------------------------------
function drawWon(ctx, state, since, calm) {
  const k = calm ? 1 : Math.min(1, since / 0.7);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(8,4,8,0.5)';
  ctx.fillRect(0, 0, W, H);
  if (!calm) {
    // suit marks drifting slowly upward; no flashing, nothing fast
    for (let i = 0; i < 16; i++) {
      const ph = (since * 0.07 + i * 0.173) % 1;
      const x = 50 + ((i * 263) % 620) + Math.sin(since * 0.5 + i) * 14;
      const a = Math.sin(Math.PI * ph) * 0.5;
      drawPip(ctx, SUIT_ORDER[i % 4], x, H * 1.02 - ph * H * 1.04, 40 + (i % 3) * 16, i % 2 ? `rgba(255,211,92,${a})` : `rgba(255,190,215,${a})`);
    }
  }
  drawSheet(ctx, 50, 560, 620, 520);
  SUIT_ORDER.forEach((suit, i) => drawPip(ctx, suit, W / 2 - 96 + i * 64, 640, 44, i % 2 ? '#ee6aa2' : GOLD));
  text(ctx, 'Well played', W / 2, 760, 88, CREAM, FONT, 700);
  text(ctx, 'All four foundations complete.', W / 2, 816, 30, 'rgba(251,238,221,0.9)', UI, 600);
  text(ctx, `Hands won: ${state.handsWon}`, W / 2, 862, 30, GOLD, UI, 700);
  drawButton(ctx, BTN.dealAgain, 'Deal again', { style: 'primary', size: 46, radius: 30 });
  ctx.restore();
}

function drawDemoLimit(ctx) {
  drawSheet(ctx, 50, 520, 620, 440);
  text(ctx, "That's the free preview", W / 2, 640, 58, CREAM, FONT, 700);
  wrapText(ctx, 'Get the full game on iPhone and Android for unlimited deals and every card back.', W / 2, 730, 32, 520, 46, 'rgba(251,238,221,0.92)');
}
