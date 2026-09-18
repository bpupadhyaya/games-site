// GAME CONTRACT (docs/GAME-CONTRACT.md): meta + createGame(env) -> {update, render, getState}.
// Big Card Solitaire — v1.0 prototype scope is Klondike ONLY (see design/GDD.md > Scope).
// Rules/deal-generation live in rules.js and solver.js; this file wires input, monetization,
// persistence and drawing. No DOM access here; no Math.random/Date.now — only env.rng and dt.

import { rankLabel, suitGlyph } from './deck.js';
import {
  drawFromStock,
  moveWasteToFoundation,
  moveWasteToTableau,
  moveTableauToFoundation,
  moveTableauToTableau,
  legalMovesFromWaste,
  legalMovesFromTableau,
  allLegalMoves,
  isWon,
} from './rules.js';
import { generateWinnableDeal } from './solver.js';
import { computeLayout, hitTest, CARD_W, CARD_H } from './layout.js';

export const meta = { width: 720, height: 1280 };

const SUIT_ORDER = ['S', 'H', 'D', 'C'];

// Card-back themes are simple flat colours — no external art (see GDD > Art direction).
// Every theme is included with the game.
const THEMES = [
  { id: 'classic', title: 'Classic', back: '#2255aa' },
  { id: 'sunset', title: 'Sunset', back: '#c9642f' },
  { id: 'ocean', title: 'Ocean', back: '#1a8f8f' },
  { id: 'rose', title: 'Rose', back: '#d6336c' },
  { id: 'violet', title: 'Violet', back: '#7048e8' },
  { id: 'forest', title: 'Forest', back: '#2f9e44' },
  { id: 'graphite', title: 'Graphite', back: '#495057' },
  { id: 'gold', title: 'Gold', back: '#d4a017' },
];

const STANDARD_INK = { S: '#161616', H: '#b3261e', D: '#b3261e', C: '#161616' };
// Four-colour deck (GDD > Art direction): suit identity never depends on red-vs-black alone.
const FOUR_COLOR_INK = { S: '#1a7a3c', H: '#b3261e', D: '#1f5fa8', C: '#161616' };

// Table colours (index 0 is the original felt green and stays the default; players can cycle).
const TABLES = [
  { name: 'Green', stops: ['#2f8f68', '#1d5f45', '#234a38'] },
  { name: 'Blue', stops: ['#3f78c8', '#245093', '#183a68'] },
  { name: 'Burgundy', stops: ['#a83a55', '#7a2340', '#4f1729'] },
  { name: 'Charcoal', stops: ['#4a5060', '#2c303c', '#1a1c24'] },
  { name: 'Purple', stops: ['#8b5cf6', '#5b21b6', '#2e1065'] },
  { name: 'Teal', stops: ['#2dd4bf', '#0f766e', '#134e4a'] },
  { name: 'Sunset', stops: ['#fb923c', '#c2410c', '#7c2d12'] },
  { name: 'Royal', stops: ['#6366f1', '#3730a3', '#1e1b4b'] },
  { name: 'Rose', stops: ['#fb7185', '#be123c', '#4c0519'] },
  { name: 'Midnight', stops: ['#1e3a8a', '#0f172a', '#020617'] },
];
const BG = '#1d5f45'; // vibrant felt-green identity — depth comes from a static radial gradient below, no animation/flashing
const CARD_FACE = '#faf7ef';
const CARD_BORDER = '#20201c';
// Web preview (env.config.demo) is marketing for the full iOS/Android game, not a substitute
// for it — cap how many deals are playable for free. See docs/GAME-CONTRACT.md's "Web preview".
const DEMO_DEAL_LIMIT = 3;

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  const layout = computeLayout(meta);
  const demo = Boolean(config?.demo);

  const state = {
    scene: 'title', // 'title' | 'playing' | 'won' | 'demo-limit'
    demo,
    demoDeals: 0,
    demoLimitReached: false,
    board: null,
    dealVerified: false,
    dealAttempts: 0,
    selected: null, // { pile: 'waste' } | { pile: 'tableau', col, index }
    hint: false,
    handsPlayed: 0,
    handsWon: 0,
    fourColorDeck: false,
    unlockedThemes: [],
    activeTheme: 'classic',
    table: 0,
    message: '', // quiet, non-scored feedback (e.g. the deal-honesty note below)
  };

  Promise.all([
    storage.get('handsPlayed', 0),
    storage.get('handsWon', 0),
    storage.get('unlockedThemes', []),
    storage.get('activeTheme', 'classic'),
    storage.get('fourColorDeck', false),
    storage.get('table', 0),
  ]).then(([handsPlayed, handsWon, unlockedThemes, activeTheme, fourColorDeck, table]) => {
    state.table = TABLES[table] ? table : 0;
    state.handsPlayed = handsPlayed;
    state.handsWon = handsWon;
    state.unlockedThemes = unlockedThemes;
    state.activeTheme = activeTheme;
    state.fourColorDeck = fourColorDeck;
  });
  // Persisted so reloading the page can't reset the free preview's deal count.
  if (demo) {
    storage.get('demoDeals', 0).then((v) => {
      state.demoDeals = v;
      if (v >= DEMO_DEAL_LIMIT) state.demoLimitReached = true;
    });
  }

  // Every theme is included with the game.
  const themeOwned = () => true;

  const startNewDeal = () => {
    if (demo) {
      if (state.demoLimitReached) {
        state.scene = 'demo-limit';
        return;
      }
      state.demoDeals += 1;
      storage.set('demoDeals', state.demoDeals);
      if (state.demoDeals >= DEMO_DEAL_LIMIT) state.demoLimitReached = true;
    }
    const { board, verified, attempts } = generateWinnableDeal(rng, {});
    state.board = board;
    state.dealVerified = verified;
    state.dealAttempts = attempts;
    state.selected = null;
    state.hint = false;
    state.scene = 'playing';
    state.handsPlayed += 1;
    storage.set('handsPlayed', state.handsPlayed);
    // Honesty note (GDD > Progression): the solver is a bounded heuristic, not a perfect one.
    // On the rare occasions it can't confirm a win within its attempt cap, we say so instead of
    // silently claiming a guarantee we didn't actually check.
    state.message = verified ? '' : 'Dealt after the maximum shuffle attempts (unconfirmed) — see STATUS.md.';
    monetization.track('deal_start', { verified, attempts });
  };

  const checkWin = () => {
    if (state.board && isWon(state.board)) {
      state.scene = 'won';
      state.selected = null;
      state.hint = false;
      state.handsWon += 1;
      storage.set('handsWon', state.handsWon);
      audio.tone({ freq: 523, dur: 0.1 });
      audio.tone({ freq: 659, dur: 0.1 });
      audio.tone({ freq: 784, dur: 0.16 });
      monetization.track('hand_won', { attempts: state.dealAttempts });
    }
  };

  const selectableSource = (target) => {
    if (!target) return null;
    if (target.pile === 'waste') return state.board.waste.length > 0 ? { pile: 'waste' } : null;
    if (target.pile === 'tableau' && target.index >= 0) {
      const card = state.board.tableau[target.col][target.index];
      return card && card.faceUp ? { pile: 'tableau', col: target.col, index: target.index } : null;
    }
    return null;
  };

  const legalDestinationsFor = (source) => {
    if (source.pile === 'waste') {
      return legalMovesFromWaste(state.board).map((m) =>
        m.kind === 'waste-foundation' ? { type: 'foundation' } : { type: 'tableau', col: m.col }
      );
    }
    return legalMovesFromTableau(state.board, source.col, source.index).map((m) =>
      m.kind === 'tableau-foundation' ? { type: 'foundation' } : { type: 'tableau', col: m.to }
    );
  };

  const applyMove = (source, dest) => {
    if (source.pile === 'waste') {
      if (dest.type === 'foundation') moveWasteToFoundation(state.board);
      else moveWasteToTableau(state.board, dest.col);
    } else {
      if (dest.type === 'foundation') moveTableauToFoundation(state.board, source.col, source.index);
      else moveTableauToTableau(state.board, source.col, source.index, dest.col);
    }
    audio.tone({ freq: 440, dur: 0.06 });
  };

  const destinationMatchesTarget = (dest, target) => {
    if (dest.type === 'foundation') return target.pile === 'foundation';
    return target.pile === 'tableau' && target.col === dest.col;
  };

  const trySelectSource = (source) => {
    const destinations = legalDestinationsFor(source);
    if (destinations.length === 0) {
      state.selected = null;
      return;
    }
    if (destinations.length === 1) {
      applyMove(source, destinations[0]);
      state.selected = null;
      checkWin();
      return;
    }
    state.selected = source;
  };

  const HINT_BTN = { x: meta.width / 2 - 170, y: meta.height - 110, w: 340, h: 76 };
  const rectContains = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  // Card-back swatches: two rows of four.
  const themeSwatchRect = (i) => ({ x: 40 + (i % 4) * 165, y: meta.height * 0.5 + Math.floor(i / 4) * 175, w: 140, h: 110 });

  const TABLE_BTN = { x: 40, y: 990, w: 310, h: 84 };
  const SUITS_BTN = { x: 370, y: 990, w: 310, h: 84 };
  const cycleTable = () => {
    state.table = (state.table + 1) % TABLES.length;
    storage.set('table', state.table);
  };
  const toggleSuits = () => {
    state.fourColorDeck = !state.fourColorDeck;
    storage.set('fourColorDeck', state.fourColorDeck);
  };

  const handleTitleTap = (x, y) => {
    if (rectContains(TABLE_BTN, x, y)) return cycleTable();
    if (rectContains(SUITS_BTN, x, y)) return toggleSuits();
    for (let i = 0; i < THEMES.length; i++) {
      const r = themeSwatchRect(i);
      if (!rectContains(r, x, y)) continue;
      const theme = THEMES[i];
      state.activeTheme = theme.id;
      storage.set('activeTheme', theme.id);
      return;
    }
    startNewDeal();
  };

  const handlePlayingTap = (x, y) => {
    if (rectContains(PLAY_TABLE_BTN, x, y)) return cycleTable();
    if (rectContains(PLAY_SUITS_BTN, x, y)) return toggleSuits();
    if (rectContains(HINT_BTN, x, y)) {
      state.hint = !state.hint;
      state.selected = null;
      return;
    }
    const target = hitTest(meta, layout, state.board, x, y);
    if (!target) {
      state.selected = null;
      return;
    }
    if (target.pile === 'stock') {
      drawFromStock(state.board);
      state.selected = null;
      state.hint = false;
      return;
    }
    if (state.selected) {
      const destinations = legalDestinationsFor(state.selected);
      const matched = destinations.find((d) => destinationMatchesTarget(d, target));
      if (matched) {
        applyMove(state.selected, matched);
        state.selected = null;
        state.hint = false;
        checkWin();
        return;
      }
      const reselect = selectableSource(target);
      state.selected = null;
      if (reselect) trySelectSource(reselect);
      return;
    }
    const source = selectableSource(target);
    if (source) trySelectSource(source);
  };

  const handleTap = (x, y) => {
    if (state.scene === 'demo-limit') return;
    if (state.scene === 'title') handleTitleTap(x, y);
    else if (state.scene === 'won') startNewDeal();
    else if (state.scene === 'playing') handlePlayingTap(x, y);
  };

  return {
    update(dt, input) {
      // Turn-based tap game: dt is intentionally unused — no timers, no animation clocks
      // (GDD > calm mode: no timers, no flashing effects). Only the rising edge of a tap acts.
      if (input.pointer.pressed) handleTap(input.pointer.x, input.pointer.y);
      if (state.scene === 'playing' && input.keys.pressed.has('KeyH')) {
        state.hint = !state.hint;
        state.selected = null;
      }
      if (state.scene !== 'playing' && input.keys.pressed.has('KeyN')) startNewDeal();
    },

    render(ctx) {
      drawBoard(ctx, env, state, layout);
    },

    // JSON-serializable and complete: exposes tableau/foundations/stock/waste directly so
    // tests can assert on exact board shape without reaching into private closures.
    getState: () => state,
  };
}

function ink(state, suit) {
  return (state.fourColorDeck ? FOUR_COLOR_INK : STANDARD_INK)[suit];
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, state) {
  const stops = TABLES[state.table].stops;
  const g = ctx.createRadialGradient(
    meta.width / 2, meta.height * 0.32, meta.height * 0.1,
    meta.width / 2, meta.height * 0.5, meta.height * 0.85
  );
  g.addColorStop(0, stops[0]);
  g.addColorStop(0.6, stops[1]);
  g.addColorStop(1, stops[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, meta.width, meta.height);
}

function drawPanel(ctx, x, y, w, h, r = 24) {
  roundRectPath(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.07)');
  g.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawButton(ctx, r, label, style = 'primary') {
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 20);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  if (style === 'primary') {
    g.addColorStop(0, '#8a5cf6');
    g.addColorStop(1, '#4fc3e8');
  } else if (style === 'active') {
    g.addColorStop(0, '#ffe27a');
    g.addColorStop(1, '#ffd54a');
  } else {
    g.addColorStop(0, '#245e46');
    g.addColorStop(1, '#163e2e');
  }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (label) {
    ctx.fillStyle = style === 'active' ? '#0e3324' : '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
    ctx.textBaseline = 'alphabetic';
  }
}

function drawPill(ctx, cx, y, text, color = 'rgba(255,255,255,0.12)') {
  ctx.font = '20px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 40;
  const r = { x: cx - w / 2, y: y - 20, w, h: 40 };
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 20);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y);
  ctx.textBaseline = 'alphabetic';
}

function drawCardBack(ctx, x, y, color) {
  roundRectPath(ctx, x, y, CARD_W, CARD_H, 16);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  const g = ctx.createLinearGradient(x, y, x, y + CARD_H);
  g.addColorStop(0, lighten(color, 18));
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = CARD_BORDER;
  ctx.lineWidth = 3;
  ctx.stroke();
  roundRectPath(ctx, x + 10, y + 10, CARD_W - 20, CARD_H - 20, 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

function drawCardFace(ctx, x, y, card, state, highlight) {
  roundRectPath(ctx, x, y, CARD_W, CARD_H, 16);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  const g = ctx.createLinearGradient(x, y, x, y + CARD_H);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, CARD_FACE);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = highlight ? '#ffd54a' : CARD_BORDER;
  ctx.lineWidth = highlight ? 6 : 3;
  ctx.stroke();

  const color = ink(state, card.suit);
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  // Oversized corner index (GDD > Art direction): fixed minimum size, never shrinks.
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText(rankLabel(card.rank), x + 10, y + 6);
  ctx.font = '30px system-ui, sans-serif';
  ctx.fillText(suitGlyph(card.suit), x + 10, y + 50);

  // Mirrored bottom-right index so the card reads right-side-up from either hand.
  ctx.save();
  ctx.translate(x + CARD_W - 10, y + CARD_H - 6);
  ctx.rotate(Math.PI);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText(rankLabel(card.rank), 0, 0);
  ctx.font = '30px system-ui, sans-serif';
  ctx.fillText(suitGlyph(card.suit), 0, 44);
  ctx.restore();

  ctx.font = '64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(suitGlyph(card.suit), x + CARD_W / 2, y + CARD_H / 2 - 32);
}

function pileOutline(ctx, x, y, glyph) {
  roundRectPath(ctx, x, y, CARD_W, CARD_H, 16);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
  if (glyph) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '54px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, x + CARD_W / 2, y + CARD_H / 2);
  }
}

function isHighlightedSource(moves, pile, col, index) {
  return moves.some((m) => {
    if (pile === 'waste') return m.source === 'waste';
    return m.source === 'tableau' && m.col === col && m.index === index;
  });
}

function isHighlightedDestination(moves, kind, col) {
  if (kind === 'foundation') return moves.some((m) => m.kind === 'waste-foundation' || m.kind === 'tableau-foundation');
  return moves.some((m) => (m.kind === 'waste-tableau' && m.col === col) || (m.kind === 'tableau-tableau' && m.to === col));
}

function drawBoard(ctx, env, state, layout) {
  drawBackground(ctx, state);

  if (state.scene === 'demo-limit') {
    drawDemoLimit(ctx);
    return;
  }

  if (state.scene === 'title') {
    drawTitle(ctx, env, state);
    return;
  }

  const board = state.board;
  const theme = THEMES.find((t) => t.id === state.activeTheme) || THEMES[0];
  const hintMoves = state.hint ? allLegalMoves(board) : [];

  if (board.stock.length > 0) drawCardBack(ctx, layout.stockPos.x, layout.stockPos.y, theme.back);
  else pileOutline(ctx, layout.stockPos.x, layout.stockPos.y, '↻');

  if (board.waste.length > 0) {
    const top = board.waste[board.waste.length - 1];
    drawCardFace(ctx, layout.wastePos.x, layout.wastePos.y, top, state, isHighlightedSource(hintMoves, 'waste'));
  } else {
    pileOutline(ctx, layout.wastePos.x, layout.wastePos.y, '');
  }

  for (let i = 0; i < 4; i++) {
    const suit = SUIT_ORDER[i];
    const pile = board.foundations[suit];
    const pos = layout.foundationPos(i);
    if (pile.length > 0) drawCardFace(ctx, pos.x, pos.y, pile[pile.length - 1], state, false);
    else pileOutline(ctx, pos.x, pos.y, suitGlyph(suit));
    if (isHighlightedDestination(hintMoves, 'foundation')) {
      ctx.strokeStyle = '#ffd54a';
      ctx.lineWidth = 5;
      roundRectPath(ctx, pos.x - 4, pos.y - 4, CARD_W + 8, CARD_H + 8, 18);
      ctx.stroke();
    }
  }

  for (let col = 0; col < board.tableau.length; col++) {
    const column = board.tableau[col];
    const cx = layout.tableauX(col);
    if (column.length === 0) {
      pileOutline(ctx, cx, layout.tableauTopY, '');
      if (isHighlightedDestination(hintMoves, 'tableau', col)) {
        ctx.strokeStyle = '#ffd54a';
        ctx.lineWidth = 5;
        roundRectPath(ctx, cx - 4, layout.tableauTopY - 4, CARD_W + 8, CARD_H + 8, 18);
        ctx.stroke();
      }
      continue;
    }
    const offset = layout.columnOffset(column.length, true);
    for (let i = 0; i < column.length; i++) {
      const card = column[i];
      const cy = layout.tableauTopY + i * offset;
      const isSelected =
        state.selected && state.selected.pile === 'tableau' && state.selected.col === col && i >= state.selected.index;
      const isHintSrc = isHighlightedSource(hintMoves, 'tableau', col, i);
      if (card.faceUp) drawCardFace(ctx, cx, cy, card, state, isSelected || isHintSrc);
      else drawCardBack(ctx, cx, cy, theme.back);
    }
    if (isHighlightedDestination(hintMoves, 'tableau', col)) {
      const topY = layout.tableauTopY + (column.length - 1) * offset;
      ctx.strokeStyle = '#ffd54a';
      ctx.lineWidth = 5;
      roundRectPath(ctx, cx - 4, topY - 4, CARD_W + 8, CARD_H + 8, 18);
      ctx.stroke();
    }
  }

  drawHintButton(ctx, state);

  if (!state.dealVerified && state.message) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, meta.width / 2, meta.height - 130);
  }

  if (state.scene === 'won') drawWon(ctx);
}

const PLAY_TABLE_BTN = { x: 20, y: 1170, w: 160, h: 76 };
const PLAY_SUITS_BTN = { x: 540, y: 1170, w: 160, h: 76 };

function drawHintButton(ctx, state) {
  drawButton(ctx, PLAY_TABLE_BTN, `🎨 ${TABLES[state.table].name}`, 'secondary');
  drawButton(ctx, PLAY_SUITS_BTN, state.fourColorDeck ? '4-colour' : '2-colour', 'secondary');
  const r = { x: meta.width / 2 - 170, y: meta.height - 110, w: 340, h: 76 };
  drawButton(ctx, r, 'What can I do?', state.hint ? 'active' : 'secondary');
}

function drawTitle(ctx, env, state) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText(env.manifest.title, meta.width / 2, meta.height * 0.14);
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(env.manifest.tagline || 'Every deal winnable. No timers. No ads between hands.', meta.width / 2, meta.height * 0.19);

  const cta = { x: meta.width / 2 - 240, y: meta.height * 0.27, w: 480, h: 92 };
  drawButton(ctx, cta, 'Tap anywhere to deal', 'primary');

  drawButton(ctx, { x: 40, y: 990, w: 310, h: 84 }, `🎨 Table: ${TABLES[state.table].name}`, 'secondary');
  drawButton(ctx, { x: 370, y: 990, w: 310, h: 84 }, `Suits: ${state.fourColorDeck ? '4-colour' : '2-colour'}`, 'secondary');

  drawPill(ctx, meta.width / 2, meta.height * 0.4, `Hands played: ${state.handsPlayed}   Hands won: ${state.handsWon}`);

  ctx.font = '22px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Card back', meta.width / 2, meta.height * 0.47);
  for (let i = 0; i < THEMES.length; i++) {
    const theme = THEMES[i];
    const x = 40 + (i % 4) * 165;
    const y = meta.height * 0.5 + Math.floor(i / 4) * 175;
    roundRectPath(ctx, x, y, 140, 110, 16);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    const g = ctx.createLinearGradient(x, y, x, y + 110);
    g.addColorStop(0, lighten(theme.back, 24));
    g.addColorStop(1, theme.back);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = state.activeTheme === theme.id ? '#ffd54a' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = state.activeTheme === theme.id ? 6 : 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(theme.title, x + 70, y + 136);
  }

  if (state.demo) {
    drawPill(ctx, meta.width / 2, meta.height * 0.94, `Free preview — ${Math.max(DEMO_DEAL_LIMIT - state.demoDeals, 0)} deal(s) left`);
  }
}

function drawDemoLimit(ctx) {
  const panel = { x: 60, y: meta.height * 0.34, w: meta.width - 120, h: 300 };
  drawPanel(ctx, panel.x, panel.y, panel.w, panel.h);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText("🃏 That's the free preview!", meta.width / 2, panel.y + 70);
  ctx.font = '26px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  wrapText(ctx, 'Get the full game on iPhone and Android for unlimited deals and every theme.', meta.width / 2, panel.y + 130, panel.w - 80, 36);
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, y);
}

function drawWon(ctx) {
  drawPanel(ctx, 40, meta.height * 0.32, meta.width - 80, 260);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('🎉 Well played', meta.width / 2, meta.height * 0.4);
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('All four foundations complete. No score, no rush.', meta.width / 2, meta.height * 0.48);
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillStyle = '#ffd54a';
  ctx.fillText('Tap anywhere to deal again', meta.width / 2, meta.height * 0.54);
}
