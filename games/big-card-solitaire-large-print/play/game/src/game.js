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
import { rankLabel, suitGlyph } from './deck.js';
import { computeLayout, hitTest, contains, BTN, HERO, OPT, W, H, TEXT_SCALES, AUTO_THINK_STEPS, AUTO_REVEAL_SECS } from './layout.js';
import { THEMES, TABLES } from './art.js';
import { createFx } from './fx.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: W, height: H };

// Web preview (env.config.demo) is marketing for the full iOS/Android game, not a substitute
// for it — cap how many deals are playable for free. See docs/GAME-CONTRACT.md's "Web preview".
const DEMO_DEAL_LIMIT = 3;

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  const layout = computeLayout(meta);
  const demo = Boolean(config?.demo);

  const state = {
    scene: 'title', // 'title' | 'playing' | 'won' | 'demo-limit' | 'rules'
    demo,
    demoDeals: 0,
    rulesPage: 0,
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
    textScaleIdx: 0, // index into TEXT_SCALES; the Rules reference page's own text size
    autoThinkIdx: 1, // index into AUTO_THINK_STEPS ([2,5,8,10]s); Auto Play's THINK pause, default 5s
    auto: null, // Auto Play ("Watch & Learn") run state; see startAutoPlay()
  };

  Promise.all([
    storage.get('handsPlayed', 0),
    storage.get('handsWon', 0),
    storage.get('unlockedThemes', []),
    storage.get('activeTheme', 'classic'),
    storage.get('fourColorDeck', false),
    storage.get('table', 0),
    storage.get('reducedMotion', false),
    storage.get('textScaleIdx', 0),
    storage.get('autoThinkIdx', 1),
  ]).then(([handsPlayed, handsWon, unlockedThemes, activeTheme, fourColorDeck, table, reducedMotion, textScaleIdx, autoThinkIdx]) => {
    state.reducedMotion = Boolean(reducedMotion);
    state.table = TABLES[table] ? table : 0;
    state.handsPlayed = handsPlayed;
    state.handsWon = handsWon;
    state.unlockedThemes = unlockedThemes;
    state.activeTheme = activeTheme;
    state.fourColorDeck = fourColorDeck;
    // Clamp: a saved index from a build with a longer/shorter TEXT_SCALES array must never survive
    // and produce NaN font sizes on the Rules page.
    state.textScaleIdx = Math.min(Math.max(textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1);
    state.autoThinkIdx = Math.min(Math.max(autoThinkIdx ?? 1, 0), AUTO_THINK_STEPS.length - 1);
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
      sound({ freq: 523, dur: 0.1 });
      sound({ freq: 659, dur: 0.1 });
      sound({ freq: 784, dur: 0.16 });
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
    sound({ freq: 440, dur: 0.06 });
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
  // Auto Play is silent by design regardless of any other setting — single point of truth: every
  // sound in the game is played through this one wrapper.
  const sound = (o) => { if (state.scene !== 'auto') audio.tone(o); };
  const tick = () => sound({ freq: 330, dur: 0.04, vol: 0.5 });

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
    if (contains(BTN.titleRules, x, y)) {
      state.scene = 'rules';
      state.rulesPage = 0;
      return tick();
    }
    if (contains(BTN.titleAuto, x, y)) return startAutoPlay();
    if (contains(BTN.deal, x, y) || contains(HERO, x, y)) startNewDeal();
  };

  // The Rules reference page: Back always returns to the title, Next cycles pages (wraps around).
  const handleRulesTap = (x, y) => {
    if (contains(BTN.rulesBack, x, y)) {
      state.scene = 'title';
      state.rulesPage = 0;
      return tick();
    }
    if (contains(BTN.rulesNext, x, y)) {
      state.rulesPage = (state.rulesPage + 1) % RULES.length;
      return tick();
    }
    if (contains(BTN.textDec, x, y) && state.textScaleIdx > 0) {
      state.textScaleIdx -= 1;
      storage.set('textScaleIdx', state.textScaleIdx);
      return tick();
    }
    if (contains(BTN.textInc, x, y) && state.textScaleIdx < TEXT_SCALES.length - 1) {
      state.textScaleIdx += 1;
      storage.set('textScaleIdx', state.textScaleIdx);
      return tick();
    }
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

  // ---- Auto Play ("Watch & Learn") -------------------------------------------------------------
  // A full, start-to-finish assisted-learning demo. Solitaire has no opponent to reuse an AI from,
  // but it already has a real move-chooser: solver.js's bounded search, which every deal is already
  // run through once (to prove it's winnable) before the player ever sees it. Auto Play reuses that
  // exact search unchanged (solveFromBoard, via generateWinnableDeal's new `moves` field) instead of
  // discarding the winning line it finds, then replays that real, proven solution one move at a time
  // through the SAME rules.js functions real play uses (drawFromStock/moveWasteToFoundation/etc. —
  // never a separate fake path), via a THINK -> REVEAL -> ACT loop: THINK holds the board still for
  // a configurable pause, REVEAL turns on the exact same "What can I do?" hint overlay a human
  // already has (`state.hint`) plus selects the move about to be taken with the exact same steady
  // highlight a human's own tap-to-select already gets (`state.selected`), then ACT plays it. Decision
  // point = one move, exactly like a human's own turn. Never touches handsPlayed/handsWon/demoDeals —
  // Auto Play keeps its own `state.auto` and never calls any of those storage writes.
  const autoThinkSecs = () => AUTO_THINK_STEPS[state.autoThinkIdx];
  const cardLabel = (card) => `${rankLabel(card.rank)}${suitGlyph(card.suit)}`;
  const autoCaption = (move, board) => {
    if (move.kind === 'draw') return 'Drawing from the stock';
    if (move.kind === 'waste-foundation') return `Playing ${cardLabel(board.waste[board.waste.length - 1])} to the foundation`;
    if (move.kind === 'tableau-foundation') return `Playing ${cardLabel(board.tableau[move.col][move.index])} to the foundation`;
    if (move.kind === 'waste-tableau') return `Moving ${cardLabel(board.waste[board.waste.length - 1])} to column ${move.col + 1}`;
    if (move.kind === 'tableau-tableau') return `Moving ${cardLabel(board.tableau[move.col][move.index])} to column ${move.to + 1}`;
    return '';
  };
  const autoSelectionFor = (move) => {
    if (move.kind === 'waste-foundation' || move.kind === 'waste-tableau') return { pile: 'waste' };
    if (move.kind === 'tableau-foundation' || move.kind === 'tableau-tableau') return { pile: 'tableau', col: move.col, index: move.index };
    return null;
  };
  const applySolverMove = (move) => {
    if (move.kind === 'draw') drawFromStock(state.board);
    else if (move.kind === 'waste-foundation') moveWasteToFoundation(state.board);
    else if (move.kind === 'waste-tableau') moveWasteToTableau(state.board, move.col);
    else if (move.kind === 'tableau-foundation') moveTableauToFoundation(state.board, move.col, move.index);
    else if (move.kind === 'tableau-tableau') moveTableauToTableau(state.board, move.col, move.index, move.to);
    sound({ freq: 440, dur: 0.06 });
  };
  const startAutoPlay = () => {
    const { board, verified, moves } = generateWinnableDeal(rng, {});
    state.board = board;
    state.dealVerified = verified;
    state.message = verified ? '' : 'This deal could not be confirmed solvable within the search budget.';
    state.selected = null;
    state.hint = false;
    state.scene = 'auto';
    fx.deal(state.board, state.reducedMotion);
    state.auto = { phase: 'deal', timer: 0, moves: moves || [], moveIdx: 0, paused: false, solved: false, caption: '' };
  };
  const teardownAuto = () => {
    state.auto = null;
    state.selected = null;
    state.hint = false;
  };
  const updateAuto = (dt, x, y, tapped) => {
    const A = state.auto;
    if (!A) return;
    if (tapped) {
      if (contains(BTN.autoExit, x, y)) return teardownAuto(), void (state.scene = 'title');
      if (contains(BTN.autoDec, x, y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx -= 1; storage.set('autoThinkIdx', state.autoThinkIdx); } return; }
      if (contains(BTN.autoInc, x, y)) { if (state.autoThinkIdx < AUTO_THINK_STEPS.length - 1) { state.autoThinkIdx += 1; storage.set('autoThinkIdx', state.autoThinkIdx); } return; }
      if (A.phase === 'ended') {
        // The Skip button's own spot doubles as "Play again" once the run has ended.
        if (contains(BTN.autoSkip, x, y)) startAutoPlay();
        return;
      }
      if (contains(BTN.autoSkip, x, y)) { A.timer = 999; return; } // fast-forward only the current pause
      if (contains(BTN.autoPause, x, y)) { A.paused = !A.paused; return; }
      return;
    }
    if (A.paused || A.phase === 'ended') return;
    if (A.phase === 'deal') {
      A.timer += dt;
      if (A.timer > 0.6) { A.phase = 'think'; A.timer = 0; }
      return;
    }
    if (A.moveIdx >= A.moves.length) {
      A.phase = 'ended';
      A.solved = isWon(state.board);
      if (A.solved) fx.won();
      return;
    }
    if (A.phase === 'think') {
      A.timer += dt;
      if (A.timer >= autoThinkSecs()) {
        const move = A.moves[A.moveIdx];
        state.selected = autoSelectionFor(move);
        state.hint = true;
        A.caption = autoCaption(move, state.board);
        A.phase = 'reveal';
        A.timer = 0;
      }
      return;
    }
    if (A.phase === 'reveal') {
      A.timer += dt;
      if (A.timer >= AUTO_REVEAL_SECS) { A.phase = 'act'; A.timer = 0; }
      return;
    }
    if (A.phase === 'act') {
      const move = A.moves[A.moveIdx];
      applySolverMove(move);
      state.selected = null;
      state.hint = false;
      A.caption = '';
      A.moveIdx += 1;
      A.phase = 'think';
      A.timer = 0;
    }
  };

  const handleTap = (x, y) => {
    if (state.scene === 'demo-limit') return;
    if (state.scene === 'auto') return updateAuto(0, x, y, true);
    if (state.options) handleOptionsTap(x, y);
    else if (state.scene === 'title') handleTitleTap(x, y);
    else if (state.scene === 'rules') handleRulesTap(x, y);
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
      if (state.scene !== 'playing' && state.scene !== 'rules' && !state.options && input.keys.pressed.has('KeyN')) startNewDeal();
      // Auto Play is the one place in this game with real timers (THINK/REVEAL pacing); every other
      // scene stays a pure tap-driven turn game.
      if (state.scene === 'auto') updateAuto(dt, 0, 0, false);
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
