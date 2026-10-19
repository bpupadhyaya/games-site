// GAME CONTRACT (docs/GAME-CONTRACT.md): meta + createGame(env) -> { update, render, getState }.
// Crown Fields — a Queens/Star-Battle style placement-by-exclusion logic puzzle. See
// design/GDD.md for the full design. No numbers anywhere: the only marks are crosses and crowns.
//
// Rules: one crown per row, per column and per coloured region; no two crowns touch, including
// diagonally. Tap a cell to cycle empty -> crossed-out -> crown -> empty. Placing a crown
// auto-crosses every cell that a crown there would now make illegal.

import { generatePuzzle } from './generator.js';
import { crownsFromCells, computeConflicts, isSolved } from './rules.js';
import {
  layoutFor, hitTestCell, inRect, TEXT_SCALES, AUTO_THINK_STEPS, AUTO_REVEAL_SECS, SIBLINGS,
} from './layout.js';
import { PALETTES } from './palettes.js';
import { RULES } from './content.js';
import { render, rulesMetrics, pressLockup } from './view.js';

export { PALETTES };

// Kit 1.7 fluid viewport: the short side is always 720 units; width/height are updated live by the kit on every resize and
// every position comes from layoutFor(meta.width, meta.height).
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
// Mouse-wheel travel (virtual units) collected by main.js and consumed by the Rules reader; empty in headless runs.
export const wheelInput = { dy: 0 };

const HISTORY_LIMIT = 60;
// Web preview (env.config.demo): only a few puzzles are playable (docs/GAME-CONTRACT.md).
const DEMO_SOLVE_LIMIT = 3;

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  let drag = null; // Rules reader: the current finger/scroll-bar drag

  // Reserve the daily puzzle's rng stream first, before anything else draws from `rng`, so the
  // daily puzzle for a given seed never changes no matter how many endless puzzles are played.
  const dailyRng = rng.fork();
  const dailyPuzzle = generatePuzzle(dailyRng, 7) ?? generatePuzzle(dailyRng.fork(), 7, { attempts: 400 });

  const state = {
    scene: 'title',
    rulesScroll: 0, // scroll offset (virtual units) of the Rules reader, only meaningful while scene === 'rules'
    mode: null, // 'daily' | 'endless'
    size: 7,
    regions: [],
    cells: [],
    solution: [],
    moves: 0,
    time: 0,
    conflicts: [],
    solved: false,
    solveTime: 0,
    solveMoves: 0,
    history: [],
    hintsUsed: 0,
    puzzlesSolved: 0,
    totalSolved: 0,
    expertUnlocked: true, // the Expert board is part of the game
    lockMessageTimer: 0,
    hintPending: false,
    palette: 0,
    textScaleIdx: 0, // index into TEXT_SCALES; the Rules reference page's text size
    demo: Boolean(config?.demo),
    demoSolves: 0,
    demoLimitReached: false,
    autoThinkIdx: 1, // index into AUTO_THINK_STEPS ([2,5,8,10]s); Auto Play's THINK pause, default 5s
    auto: null, // Auto Play ("Watch & Learn") run state; see startAutoPlay()
    // Presentation-only clocks and marks (view.js reads them; they never affect the rules). They
    // advance with the fixed update step, so the run stays deterministic.
    t: 0, // seconds since boot
    sceneT: 1, // seconds since the scene last changed (starts past the fade so boot shows at once)
    cellT: [], // per cell: the moment (in `t`) its mark last changed — drives drop-in / fade-in
    press: { id: '', t: -9 }, // last button pressed, for the spring
    ptr: { x: 0, y: 0, down: false },
  };

  // Auto Play is silent by design regardless of anything else — single point of truth: every sound
  // in the game now goes through this one helper.
  const tone = (o) => { if (state.scene !== 'auto') audio.tone(o); };
  // Stamp every cell whose mark differs from `before`; marks ripple outward from `origin`.
  const stampChanges = (before, origin = -1) => {
    const n = state.size;
    for (let i = 0; i < state.cells.length; i++) {
      if (before[i] === state.cells[i]) continue;
      const d = origin < 0 || i === origin ? 0 : Math.max(Math.abs(Math.floor(i / n) - Math.floor(origin / n)), Math.abs((i % n) - (origin % n)));
      state.cellT[i] = state.t + d * 0.035;
    }
  };
  const pressed = (id) => {
    state.press = { id, t: state.t };
  };

  storage.get('palette', 0).then((value) => {
    state.palette = PALETTES[value] ? value : 0;
  });
  const cyclePalette = () => {
    state.palette = (state.palette + 1) % PALETTES.length;
    storage.set('palette', state.palette);
  };

  storage.get('totalSolved', 0).then((value) => {
    state.totalSolved = value;
  });
  storage.get('autoThinkIdx', 1).then((value) => {
    state.autoThinkIdx = Math.min(Math.max(Number(value) || 0, 0), AUTO_THINK_STEPS.length - 1);
  });
  // Clamped on load: a saved index from a build with a shorter/longer TEXT_SCALES array must never
  // produce an out-of-range lookup (and NaN font sizes) on this one.
  storage.get('textScaleIdx', 0).then((value) => {
    state.textScaleIdx = Math.min(Math.max(Number(value) || 0, 0), TEXT_SCALES.length - 1);
  });
  // Persisted (not just in-memory) so reloading the page can't be used to reset the free
  // preview's puzzle count — see docs/GAME-CONTRACT.md's "Web preview" section.
  if (state.demo) {
    storage.get('demoSolves', 0).then((value) => {
      state.demoSolves = value;
      if (value >= DEMO_SOLVE_LIMIT) state.demoLimitReached = true;
    });
  }

  const pushHistory = () => {
    state.history.push(state.cells.slice());
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
  };

  const autoCrossForCrown = (index) => {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const regionId = state.regions[index];
    for (let i = 0; i < state.cells.length; i++) {
      if (i === index || state.cells[i] !== 'empty') continue;
      const r = Math.floor(i / state.size);
      const c = i % state.size;
      const sameRow = r === row;
      const sameCol = c === col;
      const sameRegion = state.regions[i] === regionId;
      const touching = Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1;
      if (sameRow || sameCol || sameRegion || touching) state.cells[i] = 'x';
    }
  };

  const recomputeConflicts = () => {
    const crowns = crownsFromCells(state.size, state.cells);
    const before = state.conflicts.length;
    state.conflicts = [...computeConflicts(state.regions, crowns)];
    if (state.conflicts.length > before) tone({ freq: 140, dur: 0.12, type: 'square', vol: 0.5 });
    return crowns;
  };

  const finishPuzzle = () => {
    state.solved = true;
    state.scene = 'solved';
    state.solveTime = state.time;
    state.solveMoves = state.moves;
    state.totalSolved += 1;
    storage.set('totalSolved', state.totalSolved);
    monetization.track('puzzle_complete', { size: state.size, mode: state.mode, moves: state.moves });
    tone({ freq: 523, dur: 0.1 });
    tone({ freq: 659, dur: 0.1 });
    tone({ freq: 784, dur: 0.16 });
    if (state.mode === 'endless') {
      state.puzzlesSolved += 1;
    }
    if (state.demo) {
      state.demoSolves += 1;
      storage.set('demoSolves', state.demoSolves);
      if (state.demoSolves >= DEMO_SOLVE_LIMIT) state.demoLimitReached = true;
    }
  };

  const checkSolved = () => {
    const crowns = crownsFromCells(state.size, state.cells);
    if (isSolved(state.size, crowns, new Set(state.conflicts))) finishPuzzle();
  };

  const loadPuzzle = (mode, puzzle, scene = 'playing') => {
    state.scene = scene;
    state.mode = mode;
    state.size = puzzle.size;
    state.regions = puzzle.regions;
    state.solution = puzzle.solution;
    state.cells = new Array(puzzle.size * puzzle.size).fill('empty');
    state.moves = 0;
    state.time = 0;
    state.conflicts = [];
    state.solved = false;
    state.history = [];
    state.hintsUsed = 0;
    state.cellT = new Array(puzzle.size * puzzle.size).fill(-9);
  };

  const startEndless = (size) => {
    const puzzle = generatePuzzle(rng.fork(), size);
    loadPuzzle('endless', puzzle ?? generatePuzzle(rng.fork(), size, { attempts: 400 }));
  };

  const startDaily = () => loadPuzzle('daily', dailyPuzzle);

  const cycleCell = (index) => {
    pushHistory();
    const current = state.cells[index];
    state.cells[index] = current === 'empty' ? 'x' : current === 'x' ? 'crown' : 'empty';
    state.moves += 1;
    if (state.cells[index] === 'crown') {
      autoCrossForCrown(index);
      tone({ freq: 392, dur: 0.08 });
    }
    stampChanges(state.history[state.history.length - 1], index);
    recomputeConflicts();
    checkSolved();
  };

  const undo = () => {
    if (state.history.length === 0) return;
    const before = state.cells;
    state.cells = state.history.pop();
    stampChanges(before);
    recomputeConflicts();
  };

  // The next not-yet-placed solution crown, region by region — exactly what the Hint button below
  // already finds. Auto Play reuses this same lookup (and the placement it leads to) to choose and
  // then reveal/act on every one of its own decisions, rather than a separate move-picker.
  const nextSolutionCell = () => {
    for (let regionId = 0; regionId < state.size; regionId++) {
      const cell = state.solution[regionId];
      const index = cell.row * state.size + cell.col;
      if (state.cells[index] !== 'crown') return index;
    }
    return -1;
  };
  // Places a proven-correct crown through the exact same steps a real placement takes (history,
  // auto-cross, mark-change stamping, conflict recompute) — used by both the real Hint button and
  // Auto Play's ACT step.
  const placeSolutionCrownAt = (index) => {
    pushHistory();
    state.cells[index] = 'crown';
    autoCrossForCrown(index);
    stampChanges(state.history[state.history.length - 1], index);
    recomputeConflicts();
  };

  const requestHint = async () => {
    if (state.hintPending || state.scene !== 'playing') return;
    state.hintPending = true;
    state.hintPending = false;
    if (state.scene !== 'playing') return;
    const index = nextSolutionCell();
    if (index >= 0) {
      placeSolutionCrownAt(index);
      state.hintsUsed += 1;
      checkSolved();
    }
  };

  // ---------------------------------------------------------------- Auto Play ("Watch & Learn")
  // A full, start-to-finish assisted-learning demo. This puzzle has no opponent AI to reuse, but it
  // already has a real move-chooser: the same region-by-region "next correct crown" lookup the real
  // Hint button already uses (`nextSolutionCell`, backed by the generator's own solver — see
  // generator.js's `findSolutions`/`generatePuzzle`, which proves the puzzle's solution before the
  // player ever sees it). Auto Play calls that unchanged, through a THINK -> REVEAL -> ACT loop for
  // every crown (this puzzle's one decision point, exactly a player's own move): THINK holds the
  // board still; REVEAL highlights the target cell (a ring drawn in view.js, the same visual
  // language as the board's other glows); ACT places it through the exact same `placeSolutionCrownAt`
  // function the real Hint button calls — never a separate fake path. Loops until the whole board is
  // solved, then offers "Play again" / "Exit". Never touches totalSolved/demoSolves/hintsUsed — Auto
  // Play keeps its own `state.auto` and calls none of those writes.
  const autoThinkSecs = () => AUTO_THINK_STEPS[state.autoThinkIdx];
  const startAutoPlay = () => {
    const puzzle = generatePuzzle(rng.fork(), 7) ?? generatePuzzle(rng.fork(), 7, { attempts: 400 });
    loadPuzzle('endless', puzzle, 'auto');
    state.auto = { sub: 'think', timer: 0, target: -1, paused: false };
  };
  const teardownAuto = () => { state.auto = null; };
  const checkSolvedAuto = () => {
    const crowns = crownsFromCells(state.size, state.cells);
    if (isSolved(state.size, crowns, new Set(state.conflicts))) {
      state.solved = true;
      state.solveTime = state.time;
      state.solveMoves = state.moves;
      state.auto.sub = 'over';
    }
  };
  function updateAutoScene(dt, tap) {
    const A = state.auto;
    if (!A) return;
    const L = lay();
    if (tap) {
      if (A.sub === 'over') {
        // "More from Arcforge" cross-promo chips come first, so a chip tap opens that sibling game instead of anything else.
        for (let i = 0; i < SIBLINGS.length; i++) {
          if (inRect(tap.x, tap.y, L.card.chips[i])) {
            pressed(`chip${i}`);
            env.openGame(SIBLINGS[i].slug);
            return;
          }
        }
        if (inRect(tap.x, tap.y, L.card.next)) startAutoPlay();
        else if (inRect(tap.x, tap.y, L.card.menu)) { teardownAuto(); state.scene = 'title'; }
        return;
      }
      const a = L.play.abtn;
      if (inRect(tap.x, tap.y, a.think)) { state.autoThinkIdx = (state.autoThinkIdx + 1) % AUTO_THINK_STEPS.length; storage.set('autoThinkIdx', state.autoThinkIdx); return; }
      if (inRect(tap.x, tap.y, a.exit)) { teardownAuto(); state.scene = 'title'; return; }
      if (inRect(tap.x, tap.y, a.pause)) { A.paused = !A.paused; return; }
      if (inRect(tap.x, tap.y, a.skip)) { if (A.sub === 'think' || A.sub === 'reveal') A.timer = 999; return; }
      return;
    }
    if (A.paused || A.sub === 'over') return;
    if (A.sub === 'think') {
      A.timer += dt;
      if (A.timer >= autoThinkSecs()) { A.target = nextSolutionCell(); A.sub = 'reveal'; A.timer = 0; }
      return;
    }
    if (A.sub === 'reveal') {
      A.timer += dt;
      if (A.timer >= AUTO_REVEAL_SECS) {
        if (A.target >= 0) placeSolutionCrownAt(A.target);
        A.target = -1;
        checkSolvedAuto();
        if (A.sub === 'reveal') { A.sub = 'think'; A.timer = 0; }
      }
      return;
    }
  }

  return {
    update(dt, input) {
      const sceneBefore = state.scene;
      state.t += dt;
      state.sceneT += dt;
      state.ptr = { x: input.pointer.x, y: input.pointer.y, down: Boolean(input.pointer.down) };
      // Auto Play has its own per-frame timers (THINK/REVEAL), unlike every other scene here, which
      // only ever reacts to a fresh tap — so it bypasses step()'s tap-only gate.
      if (state.scene === 'auto') { state.time += dt; updateAutoScene(dt, input.pointer.pressed ? { x: input.pointer.x, y: input.pointer.y } : null); }
      else if (state.scene === 'rules') { state.time += dt; updateRules(input); }
      else step(dt, input);
      if (state.scene !== sceneBefore) state.sceneT = 0;
    },

    render(ctx, view) {
      render(ctx, state, env.manifest, DEMO_SOLVE_LIMIT, { width: view?.width ?? meta.width, height: view?.height ?? meta.height });
    },

    // Must be JSON-serializable and fully describe the run (used for determinism checks).
    getState: () => state,
  };

  // Rules reader: A- / A+ / Done, and a scrolling column (drag, wheel, keys, scroll bar). Content that fits never moves.
  function updateRules(input) {
    const RL = lay().rules, p = input.pointer, keys = input.keys.pressed, max = () => rulesMetrics.max;
    const setScroll = (v) => { state.rulesScroll = Math.max(0, Math.min(v, max())); };
    if (wheelInput.dy) { setScroll(state.rulesScroll + wheelInput.dy); wheelInput.dy = 0; }
    if (keys.has('ArrowDown')) setScroll(state.rulesScroll + 70);
    if (keys.has('ArrowUp')) setScroll(state.rulesScroll - 70);
    if (keys.has('PageDown') || keys.has('Space')) setScroll(state.rulesScroll + rulesMetrics.view * 0.9);
    if (keys.has('PageUp')) setScroll(state.rulesScroll - rulesMetrics.view * 0.9);
    if (keys.has('Home')) setScroll(0);
    if (keys.has('End')) setScroll(max());
    if (keys.has('Escape')) { state.scene = 'title'; drag = null; return; }
    if (p.pressed && max() > 0) {
      if (inRect(p.x, p.y, RL.sb)) drag = { bar: true };
      else if (inRect(p.x, p.y, RL.vp)) drag = { y0: p.y, s0: state.rulesScroll };
    }
    if (drag) {
      if (!p.down) drag = null;
      else if (drag.bar) setScroll(((p.y - RL.sb.y) / RL.sb.h) * max());
      else setScroll(drag.s0 - (p.y - drag.y0));
    }
    state.rulesScroll = Math.max(0, Math.min(state.rulesScroll, max()));
    if (!p.pressed) return;
    const { x, y } = p;
    if (inRect(x, y, RL.inc)) {
      if (state.textScaleIdx < TEXT_SCALES.length - 1) { pressed('textInc'); state.textScaleIdx++; state.rulesScroll = 0; storage.set('textScaleIdx', state.textScaleIdx); }
    } else if (inRect(x, y, RL.dec)) {
      if (state.textScaleIdx > 0) { pressed('textDec'); state.textScaleIdx--; state.rulesScroll = 0; storage.set('textScaleIdx', state.textScaleIdx); }
    } else if (inRect(x, y, RL.done)) {
      pressed('rulesDone');
      state.scene = 'title'; state.rulesScroll = 0; drag = null;
    }
  }

  function step(dt, input) {
      state.time += dt;
      if (state.lockMessageTimer > 0) state.lockMessageTimer = Math.max(0, state.lockMessageTimer - dt);
      if (!input.pointer.pressed) return;
      const { x, y } = input.pointer;
      const L = lay();

      if (state.scene === 'title') {
        if (state.demoLimitReached) {
          state.scene = 'demo-limit';
          return;
        }
        const T = L.title;
        if (inRect(x, y, T.lockHit)) {
          pressLockup();
          env.openArcforgeHome?.();
        } else if (inRect(x, y, T.colour)) {
          pressed('color');
          cyclePalette();
        } else if (inRect(x, y, T.rules)) {
          pressed('rules');
          state.rulesScroll = 0;
          drag = null;
          state.scene = 'rules';
        } else if (inRect(x, y, T.expert)) {
          if (state.expertUnlocked) startEndless(10);
          else state.lockMessageTimer = 1.6;
        } else if (inRect(x, y, T.daily)) {
          startDaily();
        } else if (inRect(x, y, T.auto)) {
          startAutoPlay();
        } else if (inRect(x, y, T.play7)) {
          startEndless(7);
        }
        return;
      }

      if (state.scene === 'solved') {
        // "More from Arcforge" cross-promo chips: checked first, so tapping one opens that game instead of anything else.
        for (let i = 0; i < SIBLINGS.length; i++) {
          if (inRect(x, y, L.card.chips[i])) {
            pressed(`chip${i}`);
            env.openGame(SIBLINGS[i].slug);
            return;
          }
        }
        if (inRect(x, y, L.card.menu)) { pressed('solvedMenu'); state.scene = 'title'; return; }
        if (state.demoLimitReached) {
          state.scene = 'demo-limit';
          return;
        }
        // "Next puzzle", or a tap anywhere else on the solved screen: a fresh puzzle of the same size.
        startEndless(state.mode === 'endless' ? state.size : 7);
        return;
      }

      if (state.scene === 'demo-limit') return;

      // scene === 'playing'
      const b = L.play.btn;
      if (inRect(x, y, b.menu)) { pressed('menu'); state.scene = 'title'; return; }
      if (inRect(x, y, b.colour)) {
        pressed('color');
        cyclePalette();
        return;
      }
      if (inRect(x, y, b.hint)) {
        pressed('hint');
        requestHint();
        return;
      }
      if (inRect(x, y, b.undo)) {
        pressed('undo');
        undo();
        return;
      }
      const index = hitTestCell(L, x, y, state.size);
      if (index >= 0) cycleCell(index);
  }
}
