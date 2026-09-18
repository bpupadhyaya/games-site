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
// 'classic' is always free/unlocked; the others unlock via a rewarded ad, or all at once by
// owning 'remove_ads' (see GDD > Monetization).
const THEMES = [
  { id: 'classic', title: 'Classic', back: '#2255aa' },
  { id: 'sunset', title: 'Sunset', back: '#c9642f' },
  { id: 'ocean', title: 'Ocean', back: '#1a8f8f' },
];

const STANDARD_INK = { S: '#161616', H: '#b3261e', D: '#b3261e', C: '#161616' };
// Four-colour deck (GDD > Art direction): suit identity never depends on red-vs-black alone.
const FOUR_COLOR_INK = { S: '#1a7a3c', H: '#b3261e', D: '#1f5fa8', C: '#161616' };

const BG = '#0e3324'; // calm flat felt-green, no gradient/animation, no flashing
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
    ownsRemoveAds: monetization.owns('remove_ads'),
    message: '', // quiet, non-scored feedback (e.g. the deal-honesty note below)
  };

  Promise.all([
    storage.get('handsPlayed', 0),
    storage.get('handsWon', 0),
    storage.get('unlockedThemes', []),
    storage.get('activeTheme', 'classic'),
    storage.get('fourColorDeck', false),
  ]).then(([handsPlayed, handsWon, unlockedThemes, activeTheme, fourColorDeck]) => {
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

  monetization.onChange(() => {
    state.ownsRemoveAds = monetization.owns('remove_ads');
  });

  const themeOwned = (id) => id === 'classic' || state.ownsRemoveAds || state.unlockedThemes.includes(id);

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
  const themeSwatchRect = (i) => ({ x: 40 + i * 150, y: meta.height * 0.62, w: 120, h: 120 });
  const REMOVE_ADS_RECT = { x: meta.width / 2 - 220, y: meta.height * 0.8, w: 440, h: 90 };

  const handleTitleTap = (x, y) => {
    for (let i = 0; i < THEMES.length; i++) {
      const r = themeSwatchRect(i);
      if (!rectContains(r, x, y)) continue;
      const theme = THEMES[i];
      if (themeOwned(theme.id)) {
        state.activeTheme = theme.id;
        storage.set('activeTheme', theme.id);
      } else {
        monetization.showRewarded('unlock_theme').then(({ rewarded }) => {
          if (!rewarded) return;
          state.unlockedThemes = [...state.unlockedThemes, theme.id];
          storage.set('unlockedThemes', state.unlockedThemes);
          state.activeTheme = theme.id;
          storage.set('activeTheme', theme.id);
        });
      }
      return;
    }
    if (!state.ownsRemoveAds && rectContains(REMOVE_ADS_RECT, x, y)) {
      monetization.purchase('remove_ads').then(({ ok }) => {
        if (ok) state.ownsRemoveAds = true;
      });
      return;
    }
    startNewDeal();
  };

  const handlePlayingTap = (x, y) => {
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

function drawCardBack(ctx, x, y, color) {
  roundRectPath(ctx, x, y, CARD_W, CARD_H, 16);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = CARD_BORDER;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawCardFace(ctx, x, y, card, state, highlight) {
  roundRectPath(ctx, x, y, CARD_W, CARD_H, 16);
  ctx.fillStyle = CARD_FACE;
  ctx.fill();
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
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, meta.width, meta.height);

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

function drawHintButton(ctx, state) {
  const r = { x: meta.width / 2 - 170, y: meta.height - 110, w: 340, h: 76 };
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 20);
  ctx.fillStyle = state.hint ? '#ffd54a' : '#1c4a36';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = state.hint ? '#0e3324' : '#fff';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('What can I do?', r.x + r.w / 2, r.y + r.h / 2);
  ctx.textBaseline = 'alphabetic';
}

function drawTitle(ctx, env, state) {
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText(env.manifest.title, meta.width / 2, meta.height * 0.16);
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(env.manifest.tagline || 'Every deal winnable. No timers. No ads between hands.', meta.width / 2, meta.height * 0.22);

  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.fillStyle = '#ffd54a';
  ctx.fillText('Tap anywhere to deal', meta.width / 2, meta.height * 0.42);

  ctx.font = '26px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`Hands played: ${state.handsPlayed}    Hands won: ${state.handsWon}`, meta.width / 2, meta.height * 0.5);

  ctx.font = '22px system-ui, sans-serif';
  for (let i = 0; i < THEMES.length; i++) {
    const theme = THEMES[i];
    const x = 40 + i * 150;
    const y = meta.height * 0.62;
    roundRectPath(ctx, x, y, 120, 120, 16);
    ctx.fillStyle = theme.back;
    ctx.fill();
    ctx.strokeStyle = state.activeTheme === theme.id ? '#ffd54a' : 'rgba(255,255,255,0.6)';
    ctx.lineWidth = state.activeTheme === theme.id ? 6 : 3;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(theme.title, x + 60, y + 140);
    const owned = theme.id === 'classic' || state.ownsRemoveAds || state.unlockedThemes.includes(theme.id);
    if (!owned) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, y, 120, 120);
      ctx.fillStyle = '#fff';
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText('Watch ad', x + 60, y + 55);
      ctx.fillText('to unlock', x + 60, y + 78);
      ctx.font = '22px system-ui, sans-serif';
    }
  }

  if (!state.ownsRemoveAds) {
    const r = { x: meta.width / 2 - 220, y: meta.height * 0.8, w: 440, h: 90 };
    roundRectPath(ctx, r.x, r.y, r.w, r.h, 20);
    ctx.fillStyle = '#1c4a36';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('Unlock all themes — $3.99 one-time', r.x + r.w / 2, r.y + r.h / 2 + 8);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText('All themes unlocked — thank you!', meta.width / 2, meta.height * 0.84);
  }

  if (state.demo) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(`Free preview — ${Math.max(DEMO_DEAL_LIMIT - state.demoDeals, 0)} deal(s) left`, meta.width / 2, meta.height * 0.95);
  }
}

function drawDemoLimit(ctx) {
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText("That's the free preview!", meta.width / 2, meta.height * 0.42);
  ctx.font = '26px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  wrapText(ctx, 'Get the full game on iPhone and Android for unlimited deals, more games, and no ads to unlock.', meta.width / 2, meta.height * 0.5, meta.width - 160, 36);
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
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, meta.height * 0.32, meta.width, 260);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('Well played', meta.width / 2, meta.height * 0.4);
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText('All four foundations complete. No score, no rush.', meta.width / 2, meta.height * 0.48);
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('Tap anywhere to deal again', meta.width / 2, meta.height * 0.54);
}
