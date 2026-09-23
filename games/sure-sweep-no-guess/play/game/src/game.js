// GAME CONTRACT (docs/GAME-CONTRACT.md) — every game exports exactly these two things:
//   meta                      virtual resolution the game draws in
//   createGame(env) -> { update(dt, input), render(ctx, view), getState() }
// Rules: no DOM/window access in web/src, no Math.random / Date.now (use env.rng and dt).
//
// SURE SWEEP: classic mine-clearing where every board is generated to be solvable purely by
// logical deduction, from the very first tap. See design/GDD.md for the full design and
// web/src/solver.js for exactly which deduction rules the generator/solver implement.
import { neighbors } from './board.js';
import { W, H, COLS, ROWS, CELL, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, MODE_SWITCH, HINT_BTN, COLOR_BTN, NEW_BTN, SHIELD_BTN, TITLE_COLOR_BTN, TITLE_RULES_BTN, TITLE_AUTO_BTN, RULES_BACK_BTN, RULES_NEXT_BTN, TEXT_DEC_BTN, TEXT_INC_BTN, TEXT_SCALES, THINK_STEPS, inRect } from './layout.js';
import { THEMES } from './themes.js';
import { draw } from './render.js';
import { findForcedMoves, generateBoard } from './solver.js';
import { RULES } from './content.js';

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
    page: 0, // current Rules-reference page, only meaningful while scene === 'rules'
    textScaleIdx: 0, // index into TEXT_SCALES; the Rules reference page's own text size
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
    // Auto Play ("Watch & Learn"): true while the current board is being solved by the computer
    // for teaching purposes rather than played by a person. THINK (board static) -> REVEAL (every
    // cell the current logical pass can determine glows; the ONE about to be acted on is ringed
    // more prominently, ~2s) -> ACT (the real revealCell/flag path, unchanged) -> loop, for a whole
    // board. autoThinkIdx indexes THINK_STEPS (never a raw float, same pattern as textScaleIdx).
    auto: false,
    autoPhase: null,
    autoTimer: 0,
    autoThinkIdx: 1,
    autoForced: [],
    autoChosen: null,
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
  // Clamped on load: a stale saved index from a build with a shorter/longer TEXT_SCALES must never
  // produce a NaN or out-of-range font size.
  storage.get('textScaleIdx', 0).then((v) => {
    state.textScaleIdx = Math.min(Math.max(v ?? 0, 0), TEXT_SCALES.length - 1);
  });
  storage.get('autoThinkIdx', 1).then((v) => {
    state.autoThinkIdx = Math.min(Math.max(v ?? 1, 0), THINK_STEPS.length - 1);
  });
  // Persisted so reloading the page can't reset the free preview's board count.
  if (demo) {
    storage.get('demoBoards', 0).then((v) => {
      state.demoBoards = v;
      if (v >= DEMO_BOARD_LIMIT) state.demoLimitReached = true;
    });
  }

  const remainingFlags = () => mineCount - state.flagged.reduce((n, f) => n + (f ? 1 : 0), 0);

  // Auto Play watches itself with no player to hear it for - silent by design, the same principle
  // as the free-preview cap not applying to it below. The single choke point every sound effect in
  // this file funnels through, so gating it here silences the whole mode at once.
  const tone = (o) => {
    if (!state.auto) audio.tone(o);
  };

  const newBoard = (auto = false) => {
    if (!auto && demo) {
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
    // Auto Play boards are never counted as a real run: they never touch state.runs (used only to
    // gate the opening intro animation) or the free-preview board counter above.
    if (!auto) state.runs += 1;
    state.auto = auto;
    state.autoPhase = null;
    state.autoTimer = 0;
    state.autoForced = [];
    state.autoChosen = null;
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
      tone({ freq: 660, to: 990, dur: 0.35, type: 'triangle' });
      // Auto Play never writes the player's real best time or stats - it reassigns the same
      // `state`/`mineSet` a real run uses (the established, safe pattern already used for the
      // demo-board counter above), so nothing here can silently corrupt a real result.
      if (!state.auto) {
        if (state.bestTime === null || state.time < state.bestTime) {
          fx.newBest = true;
          state.bestTime = state.time;
          storage.set('bestTime', state.bestTime);
        }
        monetization.track('board_won', { time: Math.round(state.time) });
      }
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
    tone({ freq: 220, to: 80, dur: 0.4, type: 'sawtooth' });
    if (!state.auto) monetization.track('board_lost', { time: Math.round(state.time) });
    const moves = findForcedMoves(w, h, state.numbers, priorRevealed, priorFlagged).filter((m) => m.index !== index);
    state.lossHint = moves.length ? { index: moves[0].index, kind: moves[0].kind } : null;
  };

  const revealCell = (index) => {
    if (mineSet.has(index)) {
      triggerLoss(index);
      return;
    }
    floodOpen(state.revealed, index);
    tone(state.numbers[index] === 0 ? { freq: 300, dur: 0.05 } : { freq: 520 + state.numbers[index] * 40, dur: 0.06 });
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
      tone({ freq: 700, to: 900, dur: 0.1, type: 'square' });
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
      tone({ freq: state.flagged[index] ? 260 : 200, dur: 0.05, type: 'square' });
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

  // ---- Auto Play ("Watch & Learn"): the computer solves the whole board by the same logic the
  // Hint button already uses (findForcedMoves), one forced cell at a time, THINK -> REVEAL -> ACT.
  const AUTO_REVEAL_SECS = 2;
  const saveAutoThinkIdx = () => storage.set('autoThinkIdx', state.autoThinkIdx);
  function autoStep(dt) {
    if (!state.auto || state.scene !== 'playing') return; // frozen on 'won'/'lost' waiting for a tap

    if (state.autoPhase === 'reveal') {
      state.autoTimer -= dt;
      if (state.autoTimer > 0) return;
      const mv = state.autoChosen;
      state.autoPhase = null;
      state.autoForced = [];
      state.autoChosen = null;
      if (mv) {
        if (mv.kind === 'safe') revealCell(mv.index);
        else state.flagged[mv.index] = true;
      }
      return;
    }

    // THINK phase (also the default/initial phase: autoPhase starts null, so the very first call
    // here falls straight into it and starts the timer below).
    if (state.autoPhase !== 'think') {
      const moves = findForcedMoves(w, h, state.numbers, state.revealed, state.flagged);
      let chosen = moves[0];
      if (!chosen) {
        // Defensive fallback: only reachable on a `generationFellBack` board (the generator gave
        // up finding a fully-deducible layout within its attempt cap - see solver.js) where no
        // further forced move exists yet the board isn't won. Reveals any cell the authoritative
        // mine set (closure-only, never exposed to the renderer) knows is safe, so Auto Play can
        // never hang on the rare imperfect board. Never reached on a normal, fully-solvable board.
        for (let i = 0; i < total; i++) {
          if (!state.revealed[i] && !state.flagged[i] && !mineSet.has(i)) {
            chosen = { index: i, kind: 'safe' };
            break;
          }
        }
      }
      if (!chosen) return; // nothing left to determine (a win should already have been detected)
      state.autoForced = moves.length ? moves : [chosen];
      state.autoChosen = chosen;
      state.autoPhase = 'think';
      state.autoTimer = THINK_STEPS[state.autoThinkIdx];
    }
    state.autoTimer -= dt;
    if (state.autoTimer > 0) return;
    state.autoPhase = 'reveal';
    state.autoTimer = AUTO_REVEAL_SECS;
  }

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

  // Auto Play's own input handling, completely separate from a real run's: the board itself never
  // reacts to a tap (the computer is the only one acting on it), only the think-time stepper, the
  // Colours toggle, exit, and (once solved/lost) "Play again" / "Exit to menu".
  function handleAutoPointer(x, y) {
    if (state.scene === 'playing') {
      if (inRect(x, y, MODE_SWITCH)) {
        press('autoExit');
        state.auto = false;
        state.scene = 'title';
        return;
      }
      if (inRect(x, y, HINT_BTN)) {
        if (state.autoThinkIdx > 0) {
          state.autoThinkIdx -= 1;
          saveAutoThinkIdx();
          press('autoDec');
        }
        return;
      }
      if (inRect(x, y, COLOR_BTN)) {
        press('colors');
        cycleTheme();
        return;
      }
      if (inRect(x, y, NEW_BTN)) {
        if (state.autoThinkIdx < THINK_STEPS.length - 1) {
          state.autoThinkIdx += 1;
          saveAutoThinkIdx();
          press('autoInc');
        }
        return;
      }
      return; // taps on the board itself do nothing - the computer plays every cell
    }

    // 'won' or 'lost'
    if (state.pulse - fx.sceneAt < RESULT_TAP_DELAY) return;
    if (inRect(x, y, SHIELD_BTN)) {
      press('autoExit');
      state.auto = false;
      state.scene = 'title';
      return;
    }
    press('again');
    newBoard(true);
  }

  function handlePointer(x, y) {
    if (state.scene === 'demo-limit') return;

    if (state.scene === 'title') {
      if (inRect(x, y, TITLE_COLOR_BTN)) {
        press('colors');
        cycleTheme();
      } else if (inRect(x, y, TITLE_RULES_BTN)) {
        press('rules');
        state.page = 0;
        state.scene = 'rules';
      } else if (inRect(x, y, TITLE_AUTO_BTN)) {
        press('autoplay');
        newBoard(true);
      } else {
        press('play');
        newBoard();
      }
      return;
    }

    if (state.scene === 'rules') {
      if (inRect(x, y, RULES_NEXT_BTN)) {
        press('rulesNext');
        state.page = (state.page + 1) % RULES.length;
      } else if (inRect(x, y, RULES_BACK_BTN)) {
        press('rulesBack');
        state.scene = 'title';
        state.page = 0;
      } else if (inRect(x, y, TEXT_DEC_BTN) && state.textScaleIdx > 0) {
        state.textScaleIdx -= 1;
        storage.set('textScaleIdx', state.textScaleIdx);
        press('textDec');
      } else if (inRect(x, y, TEXT_INC_BTN) && state.textScaleIdx < TEXT_SCALES.length - 1) {
        state.textScaleIdx += 1;
        storage.set('textScaleIdx', state.textScaleIdx);
        press('textInc');
      }
      return;
    }

    if (state.auto) {
      handleAutoPointer(x, y);
      return;
    }

    if (state.scene === 'playing') {
      if (inRect(x, y, MODE_SWITCH)) {
        // Two labelled halves: Reveal on the left, Flag on the right.
        const wantFlag = x >= MODE_SWITCH.x + MODE_SWITCH.w / 2;
        if (wantFlag !== state.flagMode) {
          state.flagMode = wantFlag;
          tone({ freq: wantFlag ? 260 : 220, dur: 0.05 });
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
        if (!state.auto) {
          if (state.hint) {
            state.hint.timer -= dt;
            if (state.hint.timer <= 0) state.hint = null;
          }
          if (keys.pressed.has('KeyF') || keys.pressed.has('Space')) state.flagMode = !state.flagMode;
        }
      }

      if (pointer.pressed) handlePointer(pointer.x, pointer.y);
      // Auto Play's whole loop is just this per-frame gate (autoStep no-ops unless
      // `state.auto && state.scene === 'playing'`) - there is no interval/timeout to leak, so
      // leaving the scene (handleAutoPointer above) or the board finishing (checkWin/triggerLoss
      // moving `state.scene` to 'won'/'lost') stops it for free, the instant it happens.
      autoStep(dt);
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
