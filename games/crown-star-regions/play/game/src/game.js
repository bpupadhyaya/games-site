// GAME CONTRACT (docs/GAME-CONTRACT.md): meta + createGame(env) -> { update, render, getState }.
// Crown Fields — a Queens/Star-Battle style placement-by-exclusion logic puzzle. See
// design/GDD.md for the full design. No numbers anywhere: the only marks are crosses and crowns.
//
// Rules: one crown per row, per column and per coloured region; no two crowns touch, including
// diagonally. Tap a cell to cycle empty -> crossed-out -> crown -> empty. Placing a crown
// auto-crosses every cell that a crown there would now make illegal.

import { generatePuzzle } from './generator.js';
import { crownsFromCells, computeConflicts, isSolved } from './rules.js';
import { SCREEN, hitTestCell, HINT_BUTTON, UNDO_BUTTON, PLAY10_BUTTON, DAILY_BUTTON, COLOR_BUTTON, inRect } from './layout.js';
import { PALETTES } from './palettes.js';
import { render } from './view.js';

export { PALETTES };

export const meta = { width: SCREEN.width, height: SCREEN.height };

const HISTORY_LIMIT = 60;
// Web preview (env.config.demo): only a few puzzles are playable (docs/GAME-CONTRACT.md).
const DEMO_SOLVE_LIMIT = 3;

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;

  // Reserve the daily puzzle's rng stream first, before anything else draws from `rng`, so the
  // daily puzzle for a given seed never changes no matter how many endless puzzles are played.
  const dailyRng = rng.fork();
  const dailyPuzzle = generatePuzzle(dailyRng, 7) ?? generatePuzzle(dailyRng.fork(), 7, { attempts: 400 });

  const state = {
    scene: 'title',
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
    demo: Boolean(config?.demo),
    demoSolves: 0,
    demoLimitReached: false,
    // Presentation-only clocks and marks (view.js reads them; they never affect the rules). They
    // advance with the fixed update step, so the run stays deterministic.
    t: 0, // seconds since boot
    sceneT: 1, // seconds since the scene last changed (starts past the fade so boot shows at once)
    cellT: [], // per cell: the moment (in `t`) its mark last changed — drives drop-in / fade-in
    press: { id: '', t: -9 }, // last button pressed, for the spring
    ptr: { x: 0, y: 0, down: false },
  };

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
    if (state.conflicts.length > before) audio.tone({ freq: 140, dur: 0.12, type: 'square', vol: 0.5 });
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
    audio.tone({ freq: 523, dur: 0.1 });
    audio.tone({ freq: 659, dur: 0.1 });
    audio.tone({ freq: 784, dur: 0.16 });
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

  const loadPuzzle = (mode, puzzle) => {
    state.scene = 'playing';
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
      audio.tone({ freq: 392, dur: 0.08 });
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

  const requestHint = async () => {
    if (state.hintPending || state.scene !== 'playing') return;
    state.hintPending = true;
    state.hintPending = false;
    if (state.scene !== 'playing') return;
    for (let regionId = 0; regionId < state.size; regionId++) {
      const cell = state.solution[regionId];
      const index = cell.row * state.size + cell.col;
      if (state.cells[index] !== 'crown') {
        pushHistory();
        state.cells[index] = 'crown';
        state.hintsUsed += 1;
        autoCrossForCrown(index);
        stampChanges(state.history[state.history.length - 1], index);
        recomputeConflicts();
        checkSolved();
        return;
      }
    }
  };

  return {
    update(dt, input) {
      const sceneBefore = state.scene;
      state.t += dt;
      state.sceneT += dt;
      state.ptr = { x: input.pointer.x, y: input.pointer.y, down: Boolean(input.pointer.down) };
      step(dt, input);
      if (state.scene !== sceneBefore) state.sceneT = 0;
    },

    render(ctx) {
      render(ctx, state, env.manifest, DEMO_SOLVE_LIMIT);
    },

    // Must be JSON-serializable and fully describe the run (used for determinism checks).
    getState: () => state,
  };

  function step(dt, input) {
      state.time += dt;
      if (state.lockMessageTimer > 0) state.lockMessageTimer = Math.max(0, state.lockMessageTimer - dt);
      if (!input.pointer.pressed) return;
      const { x, y } = input.pointer;

      if (state.scene === 'title') {
        if (state.demoLimitReached) {
          state.scene = 'demo-limit';
          return;
        }
        if (inRect(x, y, COLOR_BUTTON)) {
          pressed('color');
          cyclePalette();
        } else if (inRect(x, y, PLAY10_BUTTON)) {
          if (state.expertUnlocked) startEndless(10);
          else state.lockMessageTimer = 1.6;
        } else if (inRect(x, y, DAILY_BUTTON)) {
          startDaily();
        } else {
          startEndless(7);
        }
        return;
      }

      if (state.scene === 'solved') {
        if (state.demoLimitReached) {
          state.scene = 'demo-limit';
          return;
        }
        startEndless(state.mode === 'endless' ? state.size : 7);
        return;
      }

      if (state.scene === 'demo-limit') return;

      // scene === 'playing'
      if (inRect(x, y, COLOR_BUTTON)) {
        pressed('color');
        cyclePalette();
        return;
      }
      if (inRect(x, y, HINT_BUTTON)) {
        pressed('hint');
        requestHint();
        return;
      }
      if (inRect(x, y, UNDO_BUTTON)) {
        pressed('undo');
        undo();
        return;
      }
      const index = hitTestCell(x, y, state.size);
      if (index >= 0) cycleCell(index);
  }
}
