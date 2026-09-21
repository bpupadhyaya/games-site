// GAME CONTRACT (docs/GAME-CONTRACT.md): meta + createGame(env) -> {update, render, getState}.
// Big Card Solitaire — v1.0 prototype scope is Klondike ONLY (see design/GDD.md > Scope).
// Rules/deal-generation live in rules.js and solver.js; this file wires input, monetization,
// persistence and drawing. No DOM access here; no Math.random/Date.now — only env.rng and dt.

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
import { computeLayout, hitTest, contains, BTN, HERO, OPT, W, H } from './layout.js';
import { THEMES, TABLES } from './art.js';
import { createFx } from './fx.js';
import { render } from './view.js';

export const meta = { width: W, height: H };

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
    options: false, // the options sheet is open (over the title or over a hand)
    reducedMotion: false,
    message: '', // quiet, non-scored feedback (e.g. the deal-honesty note below)
  };

  Promise.all([
    storage.get('handsPlayed', 0),
    storage.get('handsWon', 0),
    storage.get('unlockedThemes', []),
    storage.get('activeTheme', 'classic'),
    storage.get('fourColorDeck', false),
    storage.get('table', 0),
    storage.get('reducedMotion', false),
  ]).then(([handsPlayed, handsWon, unlockedThemes, activeTheme, fourColorDeck, table, reducedMotion]) => {
    state.reducedMotion = Boolean(reducedMotion);
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
    fx.deal(state.board, state.reducedMotion);
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
      fx.won();
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

  const setTable = (i) => {
    state.table = i;
    storage.set('table', state.table);
  };
  const setSuits = (four) => {
    state.fourColorDeck = four;
    storage.set('fourColorDeck', state.fourColorDeck);
  };
  const setReducedMotion = (on) => {
    state.reducedMotion = on;
    storage.set('reducedMotion', on);
  };
  const tick = () => audio.tone({ freq: 330, dur: 0.04, vol: 0.5 });

  // The options sheet: table colour, card back, suit colours, motion. Opens over the title or a hand.
  const handleOptionsTap = (x, y) => {
    for (let i = 0; i < TABLES.length; i++) if (contains(OPT.tableRect(i), x, y)) return tick(), setTable(i);
    for (let i = 0; i < THEMES.length; i++) {
      if (!contains(OPT.themeRect(i), x, y) || !themeOwned(THEMES[i])) continue;
      state.activeTheme = THEMES[i].id;
      storage.set('activeTheme', state.activeTheme);
      return tick();
    }
    if (contains(OPT.suits2, x, y)) return tick(), setSuits(false);
    if (contains(OPT.suits4, x, y)) return tick(), setSuits(true);
    if (contains(OPT.motionOn, x, y)) return tick(), setReducedMotion(false);
    if (contains(OPT.motionOff, x, y)) return tick(), setReducedMotion(true);
    if (contains(OPT.done, x, y)) {
      state.options = false;
      tick();
    }
  };

  const handleTitleTap = (x, y) => {
    if (contains(BTN.titleOptions, x, y)) {
      state.options = true;
      return tick();
    }
    if (contains(BTN.deal, x, y) || contains(HERO, x, y)) startNewDeal();
  };

  const handlePlayingTap = (x, y) => {
    if (contains(BTN.options, x, y)) {
      state.options = true;
      state.selected = null;
      return tick();
    }
    if (contains(BTN.hint, x, y)) {
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
    if (state.options) handleOptionsTap(x, y);
    else if (state.scene === 'title') handleTitleTap(x, y);
    else if (state.scene === 'won') {
      // a short pause so the tap that finished the hand cannot also skip the celebration
      if (fx.sinceWon() > 0.6) startNewDeal();
    }
    else if (state.scene === 'playing') handlePlayingTap(x, y);
  };

  const fx = createFx(layout);

  return {
    update(dt, input) {
      // Turn-based tap game: there are no timers in the rules. dt only moves the visuals (cards
      // sliding to their places), and never decides anything. Only the rising edge of a tap acts.
      if (input.pointer.pressed) handleTap(input.pointer.x, input.pointer.y);
      if (state.scene === 'playing' && !state.options && input.keys.pressed.has('KeyH')) {
        state.hint = !state.hint;
        state.selected = null;
      }
      if (state.scene !== 'playing' && !state.options && input.keys.pressed.has('KeyN')) startNewDeal();
      fx.update(dt, state);
    },

    render(ctx) {
      render(ctx, env, state, layout, fx, { hintMoves: state.hint && state.board ? allLegalMoves(state.board) : [], demoLimit: DEMO_DEAL_LIMIT });
    },

    // JSON-serializable and complete: exposes tableau/foundations/stock/waste directly so
    // tests can assert on exact board shape without reaching into private closures.
    getState: () => state,
  };
}
