// GAME CONTRACT (docs/GAME-CONTRACT.md) — every game exports exactly these two things:
//   meta                      virtual resolution the game draws in
//   createGame(env) -> { update(dt, input), render(ctx, view), getState() }
// Rules: no DOM/window access in web/src, no Math.random / Date.now (use env.rng and dt).
//
// SURE SWEEP: classic mine-clearing where every board is generated to be solvable purely by
// logical deduction, from the very first tap. See design/GDD.md for the full design and
// web/src/solver.js for exactly which deduction rules the generator/solver implement.
import { neighbors } from './board.js';
import { W, H, COLS, ROWS, CELL, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, MODE_SWITCH, HINT_BTN, COLOR_BTN, NEW_BTN, SHIELD_BTN, TITLE_COLOR_BTN, inRect } from './layout.js';
import { THEMES } from './themes.js';
import { draw } from './render.js';
import { findForcedMoves, generateBoard } from './solver.js';

export const meta = { width: W, height: H };

const DIFFICULTY = { w: COLS, h: ROWS, mines: 10 };
const MAX_GEN_ATTEMPTS = 500;
// The web preview is capped to a few boards; the full game lives in the iOS/Android app.
// See docs/GAME-CONTRACT.md's "Web preview".
export const DEMO_BOARD_LIMIT = 3;
// Result screens ignore taps for a moment so the win sweep / loss reveal is seen, not skipped.
const RESULT_TAP_DELAY = 0.5;

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  const { w, h, mines: mineCount } = DIFFICULTY;
  const total = w * h;
  const demo = Boolean(config?.demo);

  // `mineSet` is the authoritative, hidden mine layout used for hit-testing. It is deliberately
  // NOT part of `state` — only `state.mines` (a plain array, kept in sync) is exposed, and only
  // for tests/solver introspection, exactly like a revealed scoreboard would be.
  let mineSet = new Set();

  const state = {
    scene: 'title',
    w,
    h,
    mineCount,
    mines: [],
    numbers: new Array(total).fill(0),
    revealed: new Array(total).fill(false),
    flagged: new Array(total).fill(false),
    flagMode: false,
    exploded: -1,
    hint: null, // { index, kind, timer } — rewarded "logic hint" while playing
    hintLoading: false,
    lossHint: null, // { index, kind } — "what could you have deduced?" on the loss screen
    shieldOffered: false,
    shieldLoading: false,
    time: 0,
    pulse: 0,
    bestTime: null,
    runs: 0,
    generationAttempts: 0,
    generationFellBack: false,
    demo,
    demoBoards: 0,
    demoLimitReached: false,
    theme: 0,
    // Presentation-only bookkeeping (animation start times on the `pulse` clock). Nothing in
    // the rules reads it; it lives in state so rendering stays a pure function of state.
    fx: {
      scene: 'title',
      sceneAt: 0,
      boardAt: -1,
      origin: 0,
      delay: 0,
      revealAt: new Array(total).fill(-1),
      flagAt: new Array(total).fill(-1),
      mode: false,
      modeAt: -1,
      btn: '',
      btnAt: -1,
      themeAt: -1,
      newBest: false,
    },
  };
  const fx = state.fx;
  const press = (id) => {
    fx.btn = id;
    fx.btnAt = state.pulse;
  };

  storage.get('theme', 0).then((v) => {
    state.theme = THEMES[v] ? v : 0;
  });
  const cycleTheme = () => {
    state.theme = (state.theme + 1) % THEMES.length;
    fx.themeAt = state.pulse;
    storage.set('theme', state.theme);
  };

  storage.get('bestTime', null).then((v) => {
    state.bestTime = v;
  });
  // Persisted so reloading the page can't reset the free preview's board count.
  if (demo) {
    storage.get('demoBoards', 0).then((v) => {
      state.demoBoards = v;
      if (v >= DEMO_BOARD_LIMIT) state.demoLimitReached = true;
    });
  }

  const remainingFlags = () => mineCount - state.flagged.reduce((n, f) => n + (f ? 1 : 0), 0);

  const newBoard = () => {
    if (demo) {
      if (state.demoLimitReached) {
        state.scene = 'demo-limit';
        return;
      }
      state.demoBoards += 1;
      storage.set('demoBoards', state.demoBoards);
      if (state.demoBoards >= DEMO_BOARD_LIMIT) state.demoLimitReached = true;
    }
    const { mines, start, attempts, fellBack } = generateBoard(rng, w, h, mineCount, MAX_GEN_ATTEMPTS);
    mineSet = mines;
    state.mines = [...mines];
    state.numbers = new Array(total).fill(0);
    for (let i = 0; i < total; i++) {
      if (mines.has(i)) {
        state.numbers[i] = -1;
        continue;
      }
      let c = 0;
      for (const n of neighbors(i, w, h)) if (mines.has(n)) c++;
      state.numbers[i] = c;
    }
    state.revealed = new Array(total).fill(false);
    state.flagged = new Array(total).fill(false);
    state.flagMode = false;
    state.exploded = -1;
    state.hint = null;
    state.lossHint = null;
    state.shieldOffered = false;
    state.time = 0;
    state.generationAttempts = attempts;
    state.generationFellBack = fellBack;
    state.runs += 1;
    fx.revealAt = new Array(total).fill(-1);
    fx.flagAt = new Array(total).fill(-1);
    fx.boardAt = state.pulse;
    fx.origin = start;
    fx.delay = 0.45; // the opening cascade waits for the tiles to settle in
    fx.newBest = false;
    floodOpen(state.revealed, start);
    state.scene = 'playing';
  };

  // Local wrapper so callers don't need to import floodReveal separately.
  function floodOpen(revealed, index) {
    if (revealed[index]) return;
    const stack = [index];
    while (stack.length) {
      const i = stack.pop();
      if (revealed[i]) continue;
      revealed[i] = true;
      if (state.numbers[i] === 0) {
        for (const n of neighbors(i, w, h)) if (!revealed[n]) stack.push(n);
      }
    }
  }

  const checkWin = () => {
    let opened = 0;
    for (let i = 0; i < total; i++) if (state.revealed[i] && !mineSet.has(i)) opened++;
    if (opened === total - mineCount) {
      state.scene = 'won';
      audio.tone({ freq: 660, to: 990, dur: 0.35, type: 'triangle' });
      if (state.bestTime === null || state.time < state.bestTime) {
        fx.newBest = true;
        state.bestTime = state.time;
        storage.set('bestTime', state.bestTime);
      }
      monetization.track('board_won', { time: Math.round(state.time) });
    }
  };

  const triggerLoss = (index) => {
    // Snapshot the board exactly as it stood before this fatal tap, so the "what could you
    // have deduced?" hint reflects the real decision point, not the post-mine state.
    const priorRevealed = state.revealed.slice();
    const priorFlagged = state.flagged.slice();
    state.revealed[index] = true;
    state.exploded = index;
    state.scene = 'lost';
    audio.tone({ freq: 220, to: 80, dur: 0.4, type: 'sawtooth' });
    monetization.track('board_lost', { time: Math.round(state.time) });
    const moves = findForcedMoves(w, h, state.numbers, priorRevealed, priorFlagged).filter((m) => m.index !== index);
    state.lossHint = moves.length ? { index: moves[0].index, kind: moves[0].kind } : null;
  };

  const revealCell = (index) => {
    if (mineSet.has(index)) {
      triggerLoss(index);
      return;
    }
    floodOpen(state.revealed, index);
    audio.tone(state.numbers[index] === 0 ? { freq: 300, dur: 0.05 } : { freq: 520 + state.numbers[index] * 40, dur: 0.06 });
    checkWin();
  };

  const chord = (index) => {
    const nbrs = neighbors(index, w, h);
    const flagCount = nbrs.filter((n) => state.flagged[n]).length;
    if (flagCount !== state.numbers[index]) return;
    let hitMine = false;
    for (const n of nbrs) {
      if (state.flagged[n] || state.revealed[n]) continue;
      if (mineSet.has(n)) {
        hitMine = true;
        triggerLoss(n);
        break;
      }
      floodOpen(state.revealed, n);
    }
    if (!hitMine) {
      audio.tone({ freq: 700, to: 900, dur: 0.1, type: 'square' });
      checkWin();
    }
  };

  const handleCellTap = (index) => {
    fx.origin = index;
    if (state.revealed[index]) {
      if (state.numbers[index] > 0) chord(index);
      return;
    }
    if (state.flagMode) {
      state.flagged[index] = !state.flagged[index];
      audio.tone({ freq: state.flagged[index] ? 260 : 200, dur: 0.05, type: 'square' });
      return;
    }
    if (state.flagged[index]) return;
    revealCell(index);
  };

  const requestHint = async () => {
    if (state.hintLoading || state.scene !== 'playing') return;
    state.hintLoading = true;
    state.hintLoading = false;
    if (state.scene !== 'playing') return;
    const moves = findForcedMoves(w, h, state.numbers, state.revealed, state.flagged);
    state.hint = moves.length ? { index: moves[0].index, kind: moves[0].kind, timer: 3 } : null;
    monetization.track('hint_used', {});
  };

  const requestShield = async () => {
    if (state.shieldLoading || state.shieldOffered || state.scene !== 'lost') return;
    state.shieldLoading = true;
    state.shieldLoading = false;
    state.shieldOffered = true;
    if (state.scene !== 'lost' || state.exploded < 0) return;
    const idx = state.exploded;
    state.revealed[idx] = false;
    state.flagged[idx] = true;
    state.exploded = -1;
    state.lossHint = null;
    state.scene = 'playing';
    monetization.track('shield_used', {});
  };

  function handlePointer(x, y) {
    if (state.scene === 'demo-limit') return;

    if (state.scene === 'title') {
      if (inRect(x, y, TITLE_COLOR_BTN)) {
        press('colors');
        cycleTheme();
      } else {
        press('play');
        newBoard();
      }
      return;
    }

    if (state.scene === 'playing') {
      if (inRect(x, y, MODE_SWITCH)) {
        // Two labelled halves: Reveal on the left, Flag on the right.
        const wantFlag = x >= MODE_SWITCH.x + MODE_SWITCH.w / 2;
        if (wantFlag !== state.flagMode) {
          state.flagMode = wantFlag;
          audio.tone({ freq: wantFlag ? 260 : 220, dur: 0.05 });
        }
        return;
      }
      if (inRect(x, y, COLOR_BTN)) {
        press('colors');
        cycleTheme();
        return;
      }
      if (inRect(x, y, HINT_BTN)) {
        press('hint');
        requestHint();
        return;
      }
      if (inRect(x, y, NEW_BTN)) {
        press('new');
        newBoard();
        return;
      }
      if (x >= BOARD_X && x < BOARD_X + BOARD_W && y >= BOARD_Y && y < BOARD_Y + BOARD_H) {
        const c = Math.floor((x - BOARD_X) / CELL);
        const r = Math.floor((y - BOARD_Y) / CELL);
        handleCellTap(r * w + c);
      }
      return;
    }

    // 'won' or 'lost'
    if (state.pulse - fx.sceneAt < RESULT_TAP_DELAY) return;
    if (state.scene === 'lost' && !state.shieldOffered && inRect(x, y, SHIELD_BTN)) {
      press('shield');
      requestShield();
      return;
    }
    press('again');
    newBoard();
  }

  // Keeps the animation clocks in step with whatever the rules just did.
  function syncFx() {
    const now = state.pulse;
    if (fx.scene !== state.scene) {
      fx.scene = state.scene;
      fx.sceneAt = now;
    }
    if (fx.mode !== state.flagMode) {
      fx.mode = state.flagMode;
      fx.modeAt = now;
    }
    const oc = fx.origin % w;
    const or = Math.floor(fx.origin / w);
    for (let i = 0; i < total; i++) {
      if (state.revealed[i]) {
        if (fx.revealAt[i] < 0) {
          const d = Math.hypot((i % w) - oc, Math.floor(i / w) - or);
          fx.revealAt[i] = now + fx.delay + d * 0.04;
        }
      } else if (fx.revealAt[i] >= 0) fx.revealAt[i] = -1;
      if (state.flagged[i]) {
        if (fx.flagAt[i] < 0) fx.flagAt[i] = now;
      } else if (fx.flagAt[i] >= 0) fx.flagAt[i] = -1;
    }
    fx.delay = 0;
  }

  return {
    update(dt, input) {
      state.pulse += dt;
      const { pointer, keys } = input;

      if (state.scene === 'playing') {
        state.time += dt;
        if (state.hint) {
          state.hint.timer -= dt;
          if (state.hint.timer <= 0) state.hint = null;
        }
        if (keys.pressed.has('KeyF') || keys.pressed.has('Space')) state.flagMode = !state.flagMode;
      }

      if (pointer.pressed) handlePointer(pointer.x, pointer.y);
      syncFx();
    },

    render(ctx) {
      draw(ctx, state, { remainingFlags: remainingFlags(), demoLeft: Math.max(DEMO_BOARD_LIMIT - state.demoBoards, 0) });
    },

    // JSON-serializable, complete description of the run. `mines` is exposed only so tests and
    // the solver can verify the "no guess" claim from outside — the renderer never reads it.
    getState: () => state,
  };
}
