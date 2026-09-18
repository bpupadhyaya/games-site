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
  HINT_BUTTON, UNDO_BUTTON, PLAY7_BUTTON, PLAY10_BUTTON, DAILY_BUTTON, COLOR_BUTTON, inRect,
} from './layout.js';

export const meta = { width: SCREEN.width, height: SCREEN.height };

const HISTORY_LIMIT = 60;
// Web preview (env.config.demo) is marketing for the full iOS/Android game, not a substitute
// for it — cap how much is playable for free so there is a real reason to get the app.
const DEMO_SOLVE_LIMIT = 3;

// Region colour schemes. Index 0 is the original look and stays the default; players can cycle
// through the others (some colours are easier on some eyes). A scheme gives a [hue, saturation]
// per region (lightness comes from the renderer, shifted by `light`), and optionally its own
// board-surround gradient (`bg`).
const OKABE_ITO = [[41, 100], [202, 70], [164, 100], [55, 84], [202, 100], [26, 100], [326, 46], [0, 0], [251, 46], [173, 47]];

function hexToHs(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  const l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [Math.round(((h * 60) + 360) % 360), Math.round(sat * 100)];
}
// Like hexToHs but also keeps the colour's own lightness (for schemes whose base tones are fixed).
function hexToHsl(hex) {
  const [h, sat] = hexToHs(hex);
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [h, sat, Math.round(((Math.max(r, g, b) + Math.min(r, g, b)) / 2) * 100)];
}
const fromHexExact = (list) => {
  const table = list.map(hexToHsl);
  return (id) => table[id % table.length];
};
const fromHex = (list) => {
  const table = list.map(hexToHs);
  return (id) => table[id % table.length];
};
const rainbow = (sat) => (id, n) => [Math.round((360 / n) * id), sat];

export const PALETTES = [
  { name: 'Default', pick: rainbow(65) },
  { name: 'Soft', pick: rainbow(40) },
  { name: 'Vivid', pick: rainbow(90) },
  { name: 'Muted', pick: rainbow(22) },
  { name: 'Colour-blind safe', pick: (id) => OKABE_ITO[id % OKABE_ITO.length] },
  // Sure Sweep's look: slate-grey cells with a hint of colour per region, on its blue-teal backdrop.
  { name: 'Slate', pick: fromHexExact(['#3a4356', '#4a5a78', '#574d75', '#44606b', '#5b6472', '#6a5a52', '#34506a', '#4d604f', '#75566a', '#63636b']), bg: ['#2f7ba3', '#2a5f7e', '#2a4f66'] },
  { name: 'Candy', pick: fromHex(['#ff6fb5', '#ffa94d', '#ffe066', '#69db7c', '#4dd0e1', '#7c9cff', '#b57cff', '#ff8787', '#f783ac', '#63e6be']), light: 6, bg: ['#ff8fc7', '#c77dff', '#7b5cff'] },
  { name: 'Jewel', pick: fromHex(['#c2255c', '#1971c2', '#2f9e44', '#9c36b5', '#e8590c', '#0c8599', '#e03131', '#5f3dc4', '#f59f00', '#087f5b']), bg: ['#3b1c5a', '#26123d', '#150a26'] },
  { name: 'Sunset', pick: fromHex(['#ff4d4d', '#ff8c1a', '#ffd43b', '#f06595', '#c2255c', '#9775fa', '#5f3dc4', '#ff9e7a', '#e8590c', '#b197fc']), bg: ['#ff8a5c', '#d6336c', '#5f2b6b'] },
  { name: 'Autumn', pick: fromHex(['#c0392b', '#d35400', '#f39c12', '#7d6608', '#6e8b3d', '#1e8449', '#117a65', '#a04000', '#af601a', '#5d6d7e']), light: 4, bg: ['#a0522d', '#6b3a1e', '#3d2110'] },
  { name: 'Neon', pick: fromHex(['#ff2079', '#ffe600', '#00f5d4', '#9b5de5', '#00bbf9', '#f15bb5', '#fee440', '#39ff14', '#ff6d00', '#3a86ff']), light: -2, bg: ['#1b1b3a', '#101028', '#07071a'] },
  { name: 'Ocean', pick: fromHex(['#0077b6', '#ffb703', '#48cae4', '#2a9d8f', '#e76f51', '#90e0ef', '#023e8a', '#06d6a0', '#118ab2', '#f4a261']), bg: ['#0a9396', '#005f73', '#001d3d'] },
  { name: 'Sherbet', pick: fromHex(['#ff9a9e', '#fad0c4', '#ffd86f', '#b5ead7', '#a0e7e5', '#c7ceea', '#e2a9f1', '#ffb7b2', '#9be564', '#84a9ff']), light: 8, bg: ['#ffc2d1', '#ffb3c6', '#bde0fe'] },
  { name: 'Midnight', pick: rainbow(70), light: -6, bg: ['#243b55', '#141e30', '#0b1120'] },
];

let activePalette = PALETTES[0];
function regionColor(regionId, regionCount, lightness) {
  const [hue, sat, baseL] = activePalette.pick(regionId, regionCount);
  // Fixed-tone schemes (baseL given) keep their own lightness; the renderer's 52/40/26 stops
  // only add the light-to-dark gradient and border shade around it.
  const l = Math.max(12, Math.min(88, baseL !== undefined ? baseL + (lightness - 40) : lightness + (activePalette.light ?? 0)));
  return `hsl(${hue} ${sat}% ${l}%)`;
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
    expertUnlocked: true, // the Expert board is part of the game
    lockMessageTimer: 0,
    hintPending: false,
    palette: 0,
    demo: Boolean(config?.demo),
    demoSolves: 0,
    demoLimitReached: false,
  };

  storage.get('palette', 0).then((value) => {
    state.palette = PALETTES[value] ? value : 0;
    activePalette = PALETTES[state.palette];
  });
  const cyclePalette = () => {
    state.palette = (state.palette + 1) % PALETTES.length;
    activePalette = PALETTES[state.palette];
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
        if (inRect(x, y, COLOR_BUTTON)) {
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
        cyclePalette();
        return;
      }
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
      drawBackground(ctx);
      ctx.textAlign = 'center';

      if (state.scene === 'demo-limit') {
        drawDemoLimit(ctx);
        return;
      }

      if (state.scene === 'title') {
        ctx.fillStyle = '#fff';
        ctx.font = '800 62px system-ui, sans-serif';
        ctx.fillText(env.manifest.title, meta.width / 2, 220);
        ctx.fillStyle = 'rgba(224,228,240,0.75)';
        ctx.font = '30px system-ui, sans-serif';
        ctx.fillText(env.manifest.tagline ?? '', meta.width / 2, 280);

        drawButton(ctx, PLAY7_BUTTON, 'Play 7x7', 'primary');
        drawButton(ctx, PLAY10_BUTTON, state.expertUnlocked ? 'Expert 10x10' : '🔒 Expert 10x10', state.expertUnlocked ? 'secondary' : 'locked');
        drawButton(ctx, DAILY_BUTTON, '📅 Daily 7x7', 'secondary');
        drawButton(ctx, COLOR_BUTTON, `🎨 Colours: ${PALETTES[state.palette].name}`, 'secondary');

        if (state.lockMessageTimer > 0) {
          ctx.fillStyle = '#ff9d9d';
          ctx.font = '600 24px system-ui, sans-serif';
          ctx.fillText('Solve 5 puzzles or buy the Expert Pack to unlock 10x10', meta.width / 2, 940);
        }
        if (state.demo) {
          drawPill(ctx, meta.width / 2, 985, `Free preview — ${DEMO_SOLVE_LIMIT - state.demoSolves} puzzle(s) left`);
        }
        return;
      }

      drawBoard(ctx);
      drawHud(ctx);

      if (state.scene === 'playing') {
        drawButton(ctx, COLOR_BUTTON, `🎨 Colours: ${PALETTES[state.palette].name}`, 'secondary');
        drawButton(ctx, HINT_BUTTON, '💡 Hint', 'secondary');
        drawButton(ctx, UNDO_BUTTON, '↩ Undo', 'secondary');
      }

      if (state.scene === 'solved') {
        drawPanel(ctx, 0, 920, meta.width, 280);
        ctx.fillStyle = '#fff';
        ctx.font = '800 54px system-ui, sans-serif';
        ctx.fillText('✨ Solved!', meta.width / 2, 995);
        ctx.fillStyle = 'rgba(224,228,240,0.8)';
        ctx.font = '600 28px system-ui, sans-serif';
        ctx.fillText(`Time ${state.solveTime.toFixed(1)}s   Moves ${state.solveMoves}`, meta.width / 2, 1045);
        ctx.fillStyle = 'rgba(224,228,240,0.55)';
        ctx.font = '24px system-ui, sans-serif';
        ctx.fillText(state.demoLimitReached ? 'Tap to continue' : 'Tap to play a new puzzle', meta.width / 2, 1090);
      }
    },

    // Must be JSON-serializable and fully describe the run (used for determinism checks).
    getState: () => state,
  };

  function drawBackground(ctx) {
    const g = ctx.createRadialGradient(meta.width * 0.22, -60, 40, meta.width * 0.22, -60, meta.width * 1.15);
    const bg = activePalette.bg ?? ['#b8792f', '#8f5f2e', '#6b4a2a'];
    g.addColorStop(0, bg[0]);
    g.addColorStop(0.55, bg[1]);
    g.addColorStop(1, bg[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, meta.width, meta.height);
  }

  function drawButton(ctx, rect, label, style = 'secondary') {
    const r = 16;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, r);
    if (style === 'primary') {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      g.addColorStop(0, '#8b5cf6');
      g.addColorStop(1, '#22d3ee');
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(139,92,246,0.5)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 10;
    } else if (style === 'locked') {
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.075)';
    }
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, r);
    ctx.strokeStyle = style === 'primary' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = style === 'locked' ? 'rgba(224,228,240,0.4)' : style === 'primary' ? '#0a0b13' : '#eef1f4';
    ctx.font = `${style === 'primary' ? '800' : '700'} 28px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 10);
  }

  function drawPill(ctx, cx, y, text) {
    ctx.font = '600 21px system-ui, sans-serif';
    const w = ctx.measureText(text).width + 40;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, y - 20, w, 40, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(224,228,240,0.75)';
    ctx.fillText(text, cx, y + 7);
  }

  function drawPanel(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 24, y, w - 48, h - 24, 24);
    ctx.fillStyle = 'rgba(15,16,26,0.88)';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = -8;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(x + 24, y, w - 48, h - 24, 24);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawDemoLimit(ctx) {
    drawPanel(ctx, 0, meta.height * 0.32, meta.width, meta.height * 0.42);
    ctx.fillStyle = '#fff';
    ctx.font = '800 42px system-ui, sans-serif';
    ctx.fillText("That's the free preview!", meta.width / 2, meta.height * 0.4);
    ctx.font = '500 27px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(224,228,240,0.8)';
    wrapText(ctx, 'Get the full game on iPhone and Android for unlimited puzzles, the Expert board and hints.', meta.width / 2, meta.height * 0.47, meta.width - 200, 38);
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
    ctx.fillStyle = '#eef1f4';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillText(`${state.mode === 'daily' ? '📅 Daily' : 'Endless'} ${state.size}×${state.size}`, meta.width / 2, 90);
    ctx.fillStyle = 'rgba(224,228,240,0.65)';
    ctx.font = '500 25px system-ui, sans-serif';
    ctx.fillText(`⏱ ${state.time.toFixed(1)}s   •   ${state.moves} moves`, meta.width / 2, 138);
  }

  function drawBoard(ctx) {
    const { size, regions, cells, conflicts } = state;
    const cs = cellSize(size);
    const conflictSet = new Set(conflicts);

    // Soft shadow behind the board so it reads as one raised surface against the background.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = 'rgba(0,0,0,0.001)';
    ctx.fillRect(BOARD_MARGIN, BOARD_TOP, cs * size, cs * size);
    ctx.restore();

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const index = row * size + col;
        const x = BOARD_MARGIN + col * cs;
        const y = BOARD_TOP + row * cs;
        const inConflict = conflictSet.has(index) && cells[index] === 'crown';

        if (inConflict) {
          ctx.fillStyle = 'hsl(0 70% 40%)';
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + cs);
          g.addColorStop(0, regionColor(regions[index], size, 52));
          g.addColorStop(1, regionColor(regions[index], size, 40));
          ctx.fillStyle = g;
        }
        ctx.fillRect(x, y, cs, cs);
        ctx.strokeStyle = regionColor(regions[index], size, 26);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.75, y + 0.75, cs - 1.5, cs - 1.5);

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

    ctx.beginPath();
    ctx.roundRect(BOARD_MARGIN - 2, BOARD_TOP - 2, cs * size + 4, cs * size + 4, 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
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
