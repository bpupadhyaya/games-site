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
  SCREEN, BOARD_MARGIN, BOARD_TOP, cellSize, cellCenter, hitTestCell,
  HINT_BUTTON, UNDO_BUTTON, PLAY7_BUTTON, PLAY10_BUTTON, DAILY_BUTTON, inRect,
} from './layout.js';

export const meta = { width: SCREEN.width, height: SCREEN.height };

const HISTORY_LIMIT = 60;
const SOFT_UNLOCK_SOLVES = 5;
const INTERSTITIAL_EVERY = 3;
// Web preview (env.config.demo) is marketing for the full iOS/Android game, not a substitute
// for it — cap how much is playable for free so there is a real reason to get the app.
const DEMO_SOLVE_LIMIT = 3;

function regionColor(regionId, regionCount, lightness) {
  const hue = Math.round((360 / regionCount) * regionId);
  return `hsl(${hue} 65% ${lightness}%)`;
}

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
    expertUnlocked: false,
    lockMessageTimer: 0,
    hintPending: false,
    demo: Boolean(config?.demo),
    demoSolves: 0,
    demoLimitReached: false,
  };

  storage.get('totalSolved', 0).then((value) => {
    state.totalSolved = value;
    if (value >= SOFT_UNLOCK_SOLVES) state.expertUnlocked = true;
  });
  // Persisted (not just in-memory) so reloading the page can't be used to reset the free
  // preview's puzzle count — see docs/GAME-CONTRACT.md's "Web preview" section.
  if (state.demo) {
    storage.get('demoSolves', 0).then((value) => {
      state.demoSolves = value;
      if (value >= DEMO_SOLVE_LIMIT) state.demoLimitReached = true;
    });
  }
  if (monetization.owns('expert_pack')) state.expertUnlocked = true;
  monetization.onChange(() => {
    if (monetization.owns('expert_pack')) state.expertUnlocked = true;
  });

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
    if (state.totalSolved >= SOFT_UNLOCK_SOLVES) state.expertUnlocked = true;
    monetization.track('puzzle_complete', { size: state.size, mode: state.mode, moves: state.moves });
    audio.tone({ freq: 523, dur: 0.1 });
    audio.tone({ freq: 659, dur: 0.1 });
    audio.tone({ freq: 784, dur: 0.16 });
    if (state.mode === 'endless') {
      state.puzzlesSolved += 1;
      if (state.puzzlesSolved % INTERSTITIAL_EVERY === 0 && !monetization.owns('remove_ads')) {
        monetization.showInterstitial('puzzle_complete');
      }
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
    recomputeConflicts();
    checkSolved();
  };

  const undo = () => {
    if (state.history.length === 0) return;
    state.cells = state.history.pop();
    recomputeConflicts();
  };

  const requestHint = async () => {
    if (state.hintPending || state.scene !== 'playing') return;
    state.hintPending = true;
    const { rewarded } = await monetization.showRewarded('hint');
    state.hintPending = false;
    if (!rewarded || state.scene !== 'playing') return;
    for (let regionId = 0; regionId < state.size; regionId++) {
      const cell = state.solution[regionId];
      const index = cell.row * state.size + cell.col;
      if (state.cells[index] !== 'crown') {
        pushHistory();
        state.cells[index] = 'crown';
        state.hintsUsed += 1;
        autoCrossForCrown(index);
        recomputeConflicts();
        checkSolved();
        return;
      }
    }
  };

  return {
    update(dt, input) {
      state.time += dt;
      if (state.lockMessageTimer > 0) state.lockMessageTimer = Math.max(0, state.lockMessageTimer - dt);
      if (!input.pointer.pressed) return;
      const { x, y } = input.pointer;

      if (state.scene === 'title') {
        if (state.demoLimitReached) {
          state.scene = 'demo-limit';
          return;
        }
        if (inRect(x, y, PLAY10_BUTTON)) {
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
      if (inRect(x, y, HINT_BUTTON)) {
        requestHint();
        return;
      }
      if (inRect(x, y, UNDO_BUTTON)) {
        undo();
        return;
      }
      const index = hitTestCell(x, y, state.size);
      if (index >= 0) cycleCell(index);
    },

    render(ctx) {
      ctx.fillStyle = '#14161f';
      ctx.fillRect(0, 0, meta.width, meta.height);
      ctx.textAlign = 'center';

      if (state.scene === 'demo-limit') {
        drawDemoLimit(ctx);
        return;
      }

      if (state.scene === 'title') {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 60px system-ui, sans-serif';
        ctx.fillText(env.manifest.title, meta.width / 2, 220);
        ctx.font = '30px system-ui, sans-serif';
        ctx.fillText(env.manifest.tagline ?? '', meta.width / 2, 280);

        drawButton(ctx, PLAY7_BUTTON, 'Play 7x7');
        drawButton(ctx, PLAY10_BUTTON, state.expertUnlocked ? 'Expert 10x10' : 'Expert 10x10 (locked)');
        drawButton(ctx, DAILY_BUTTON, 'Daily 7x7');

        if (state.lockMessageTimer > 0) {
          ctx.fillStyle = '#ffb4b4';
          ctx.font = '26px system-ui, sans-serif';
          ctx.fillText('Solve 5 puzzles or buy the Expert Pack to unlock 10x10', meta.width / 2, 940);
        }
        if (state.demo) {
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.font = '22px system-ui, sans-serif';
          ctx.fillText(`Free preview — ${DEMO_SOLVE_LIMIT - state.demoSolves} puzzle(s) left`, meta.width / 2, 980);
        }
        return;
      }

      drawBoard(ctx);
      drawHud(ctx);

      if (state.scene === 'playing') {
        drawButton(ctx, HINT_BUTTON, 'Hint (ad)');
        drawButton(ctx, UNDO_BUTTON, 'Undo');
      }

      if (state.scene === 'solved') {
        ctx.fillStyle = 'rgba(10,12,20,0.72)';
        ctx.fillRect(0, 940, meta.width, 260);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 52px system-ui, sans-serif';
        ctx.fillText('Solved!', meta.width / 2, 1010);
        ctx.font = '30px system-ui, sans-serif';
        ctx.fillText(`Time ${state.solveTime.toFixed(1)}s   Moves ${state.solveMoves}`, meta.width / 2, 1060);
        ctx.fillText(state.demoLimitReached ? 'Tap to continue' : 'Tap to play a new puzzle', meta.width / 2, 1110);
      }
    },

    // Must be JSON-serializable and fully describe the run (used for determinism checks).
    getState: () => state,
  };

  function drawButton(ctx, rect, label) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 10);
  }

  function drawDemoLimit(ctx) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText("That's the free preview!", meta.width / 2, 460);
    ctx.font = '28px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    wrapText(ctx, 'Get the full game on iPhone and Android for unlimited puzzles, the Expert board, and no ads to unlock hints.', meta.width / 2, 540, meta.width - 160, 40);
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

  function drawHud(ctx) {
    ctx.fillStyle = '#fff';
    ctx.font = '30px system-ui, sans-serif';
    ctx.fillText(`${state.mode === 'daily' ? 'Daily' : 'Endless'} ${state.size}x${state.size}`, meta.width / 2, 90);
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText(`Time ${state.time.toFixed(1)}s   Moves ${state.moves}`, meta.width / 2, 140);
  }

  function drawBoard(ctx) {
    const { size, regions, cells, conflicts } = state;
    const cs = cellSize(size);
    const conflictSet = new Set(conflicts);

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const index = row * size + col;
        const x = BOARD_MARGIN + col * cs;
        const y = BOARD_TOP + row * cs;
        const inConflict = conflictSet.has(index) && cells[index] === 'crown';

        ctx.fillStyle = inConflict ? 'hsl(0 70% 40%)' : regionColor(regions[index], size, 45);
        ctx.fillRect(x, y, cs, cs);
        ctx.strokeStyle = regionColor(regions[index], size, 28);
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, cs, cs);

        // Thicker border where this cell's region differs from its right/bottom neighbour, so
        // region shapes read clearly against the flat per-cell fill.
        ctx.strokeStyle = 'rgba(10,12,20,0.85)';
        ctx.lineWidth = 3;
        if (col < size - 1 && regions[index] !== regions[index + 1]) {
          ctx.beginPath();
          ctx.moveTo(x + cs, y);
          ctx.lineTo(x + cs, y + cs);
          ctx.stroke();
        }
        if (row < size - 1 && regions[index] !== regions[index + size]) {
          ctx.beginPath();
          ctx.moveTo(x, y + cs);
          ctx.lineTo(x + cs, y + cs);
          ctx.stroke();
        }

        const { x: cx, y: cy } = cellCenter(size, row, col);
        if (cells[index] === 'crown') drawCrown(ctx, cx, cy, cs * 0.32);
        else if (cells[index] === 'x') drawCross(ctx, cx, cy, cs * 0.2);
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 4;
    ctx.strokeRect(BOARD_MARGIN, BOARD_TOP, cs * size, cs * size);
  }

  function drawCrown(ctx, cx, cy, r) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#14161f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + r * 0.6);
    ctx.lineTo(cx - r, cy - r * 0.1);
    ctx.lineTo(cx - r * 0.5, cy + r * 0.3);
    ctx.lineTo(cx, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.5, cy + r * 0.3);
    ctx.lineTo(cx + r, cy - r * 0.1);
    ctx.lineTo(cx + r, cy + r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawCross(ctx, cx, cy, r) {
    ctx.strokeStyle = 'rgba(220,220,230,0.65)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx + r, cy + r);
    ctx.moveTo(cx + r, cy - r);
    ctx.lineTo(cx - r, cy + r);
    ctx.stroke();
  }
}
