// GAME CONTRACT (docs/GAME-CONTRACT.md) — every game exports exactly these two things:
//   meta                      virtual resolution the game draws in
//   createGame(env) -> { update(dt, input), render(ctx, view), getState() }
// Rules: no DOM/window access in web/src, no Math.random / Date.now (use env.rng and dt).
//
// SURE SWEEP: classic mine-clearing where every board is generated to be solvable purely by
// logical deduction, from the very first tap. See design/GDD.md for the full design and
// web/src/solver.js for exactly which deduction rules the generator/solver implement.
import { neighbors } from './board.js';
import { findForcedMoves, generateBoard } from './solver.js';

export const meta = { width: 720, height: 1280 };

const DIFFICULTY = { w: 9, h: 9, mines: 10 };
const MAX_GEN_ATTEMPTS = 500;
// Web preview (env.config.demo) is marketing for the full iOS/Android game, not a substitute
// for it — cap how many boards are playable for free. See docs/GAME-CONTRACT.md's "Web preview".
const DEMO_BOARD_LIMIT = 3;
const CELL = 70;
const BOARD_W = DIFFICULTY.w * CELL;
const BOARD_H = DIFFICULTY.h * CELL;
const BOARD_X = (meta.width - BOARD_W) / 2;
const BOARD_Y = 260;

const FLAG_BTN = { x: 40, y: 1110, w: 96, h: 96 };
const HINT_BTN = { x: 312, y: 1110, w: 96, h: 96 };
const NEW_BTN = { x: 584, y: 1110, w: 96, h: 96 };
const SHIELD_BTN = { x: 160, y: 760, w: 400, h: 96 };
const REMOVE_ADS_BTN = { x: 160, y: 940, w: 400, h: 80 };

const NUMBER_COLORS = ['#000', '#1565c0', '#2e7d32', '#c62828', '#0d1a63', '#6a1b1a', '#00838f', '#111111', '#555555'];

const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

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
    ownsRemoveAds: monetization.owns('remove_ads'),
    demo,
    demoBoards: 0,
    demoLimitReached: false,
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
  monetization.onChange(() => {
    state.ownsRemoveAds = monetization.owns('remove_ads');
  });

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
    const { rewarded } = await monetization.showRewarded('hint');
    state.hintLoading = false;
    if (!rewarded || state.scene !== 'playing') return;
    const moves = findForcedMoves(w, h, state.numbers, state.revealed, state.flagged);
    state.hint = moves.length ? { index: moves[0].index, kind: moves[0].kind, timer: 3 } : null;
    monetization.track('hint_used', {});
  };

  const requestShield = async () => {
    if (state.shieldLoading || state.shieldOffered || state.scene !== 'lost') return;
    state.shieldLoading = true;
    const { rewarded } = await monetization.showRewarded('shield');
    state.shieldLoading = false;
    state.shieldOffered = true;
    if (!rewarded || state.scene !== 'lost' || state.exploded < 0) return;
    const idx = state.exploded;
    state.revealed[idx] = false;
    state.flagged[idx] = true;
    state.exploded = -1;
    state.lossHint = null;
    state.scene = 'playing';
    monetization.track('shield_used', {});
  };

  const doPurchase = async () => {
    const res = await monetization.purchase('remove_ads');
    if (res.ok) state.ownsRemoveAds = true;
  };

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

      if (!pointer.pressed) return;
      const { x, y } = pointer;

      if (state.scene === 'demo-limit') return;

      if (state.scene === 'title') {
        if (inRect(x, y, REMOVE_ADS_BTN) && !state.ownsRemoveAds) doPurchase();
        else newBoard();
        return;
      }

      if (state.scene === 'playing') {
        if (inRect(x, y, FLAG_BTN)) {
          state.flagMode = !state.flagMode;
          audio.tone({ freq: 240, dur: 0.05 });
          return;
        }
        if (inRect(x, y, HINT_BTN)) {
          requestHint();
          return;
        }
        if (inRect(x, y, NEW_BTN)) {
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
      if (state.scene === 'lost' && !state.shieldOffered && inRect(x, y, SHIELD_BTN)) {
        requestShield();
        return;
      }
      newBoard();
    },

    render(ctx) {
      ctx.fillStyle = '#0b1020';
      ctx.fillRect(0, 0, meta.width, meta.height);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#eef1f4';
      ctx.font = 'bold 56px system-ui, sans-serif';
      ctx.fillText('Sure Sweep', meta.width / 2, 110);
      ctx.font = '26px system-ui, sans-serif';
      ctx.fillStyle = '#9fb0c3';
      ctx.fillText('no-guess minesweeper', meta.width / 2, 150);

      if (state.scene === 'demo-limit') {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 40px system-ui, sans-serif';
        ctx.fillText("That's the free preview!", meta.width / 2, meta.height * 0.42);
        ctx.font = '26px system-ui, sans-serif';
        ctx.fillStyle = '#9fb0c3';
        wrapText(ctx, 'Get the full game on iPhone and Android for unlimited boards, hints and no interruptions.', meta.width / 2, meta.height * 0.5, meta.width - 160, 36);
        return;
      }

      if (state.scene === 'title') {
        ctx.fillStyle = '#eef1f4';
        ctx.font = 'bold 40px system-ui, sans-serif';
        ctx.fillText('Tap to play', meta.width / 2, meta.height * 0.42);
        ctx.font = '26px system-ui, sans-serif';
        ctx.fillStyle = '#9fb0c3';
        ctx.fillText('Every board is provably solvable by logic alone.', meta.width / 2, meta.height * 0.48);
        if (state.bestTime !== null) {
          ctx.fillText(`Best time: ${state.bestTime.toFixed(1)}s`, meta.width / 2, meta.height * 0.54);
        }
        if (!state.ownsRemoveAds) {
          drawButton(ctx, REMOVE_ADS_BTN, 'Remove Ads $2.99', '#2a3550');
        }
        if (state.demo) {
          ctx.font = '22px system-ui, sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.fillText(`Free preview — ${Math.max(DEMO_BOARD_LIMIT - state.demoBoards, 0)} board(s) left`, meta.width / 2, meta.height * 0.6);
        }
        return;
      }

      // HUD row: mine counter + timer.
      ctx.font = 'bold 32px monospace';
      ctx.fillStyle = '#eef1f4';
      ctx.textAlign = 'left';
      ctx.fillText(`Mines ${String(Math.max(remainingFlags(), 0)).padStart(2, '0')}`, BOARD_X, 220);
      ctx.textAlign = 'right';
      ctx.fillText(`${state.time.toFixed(1)}s`, BOARD_X + BOARD_W, 220);

      drawGrid(ctx);
      drawButton(ctx, FLAG_BTN, state.flagMode ? 'Flag*' : 'Flag', state.flagMode ? '#c62828' : '#2a3550');
      drawButton(ctx, HINT_BTN, 'Hint', '#2a3550');
      drawButton(ctx, NEW_BTN, 'New', '#2a3550');

      if (state.scene === 'lost') {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff6b6b';
        ctx.font = 'bold 54px system-ui, sans-serif';
        ctx.fillText('Boom.', meta.width / 2, 640);
        ctx.font = '26px system-ui, sans-serif';
        ctx.fillStyle = '#eef1f4';
        ctx.fillText('That mine was avoidable by logic — see the highlighted cell.', meta.width / 2, 685);
        if (!state.shieldOffered) drawButton(ctx, SHIELD_BTN, 'Watch ad: Undo click', '#2e7d32');
        ctx.fillText('Tap anywhere else for a new board', meta.width / 2, 895);
      } else if (state.scene === 'won') {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#69f0ae';
        ctx.font = 'bold 54px system-ui, sans-serif';
        ctx.fillText('Cleared!', meta.width / 2, 640);
        ctx.font = '26px system-ui, sans-serif';
        ctx.fillStyle = '#eef1f4';
        ctx.fillText(`Time: ${state.time.toFixed(1)}s — tap for a new board`, meta.width / 2, 685);
      }
    },

    // JSON-serializable, complete description of the run. `mines` is exposed only so tests and
    // the solver can verify the "no guess" claim from outside — the renderer never reads it.
    getState: () => state,
  };

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

  function drawButton(ctx, r, label, color) {
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#eef1f4';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 8);
  }

  function drawGrid(ctx) {
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const i = r * w + c;
        const x = BOARD_X + c * CELL;
        const y = BOARD_Y + r * CELL;
        const isHint = (state.hint && state.hint.index === i) || (state.scene === 'lost' && state.lossHint && state.lossHint.index === i);
        const isExploded = state.exploded === i;

        if (state.revealed[i]) {
          ctx.fillStyle = isExploded ? '#c62828' : '#eef1f4';
          ctx.fillRect(x, y, CELL, CELL);
          ctx.strokeStyle = '#c7cfd8';
          ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
          if (state.numbers[i] === -1) {
            drawMine(ctx, x, y);
          } else if (state.numbers[i] > 0) {
            ctx.fillStyle = NUMBER_COLORS[state.numbers[i]];
            ctx.font = 'bold 34px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(state.numbers[i]), x + CELL / 2, y + CELL / 2 + 12);
          }
        } else {
          ctx.fillStyle = '#b8c4d0';
          ctx.fillRect(x, y, CELL, CELL);
          ctx.strokeStyle = '#8a97a6';
          ctx.strokeRect(x + 1.5, y + CELL - 1.5, CELL - 3, 0);
          ctx.strokeRect(x + CELL - 1.5, y + 1.5, 0, CELL - 3);
          ctx.strokeStyle = '#d8e2ea';
          ctx.strokeRect(x + 1.5, y + 1.5, CELL - 3, 0);
          ctx.strokeRect(x + 1.5, y + 1.5, 0, CELL - 3);
          if (state.flagged[i]) drawFlag(ctx, x, y);
        }

        if (isHint) {
          const pulse = 0.5 + 0.5 * Math.sin(state.pulse * 6);
          ctx.strokeStyle = state.hint && state.hint.index === i && state.hint.kind === 'mine' ? '#ff5252' : '#69f0ae';
          if (state.scene === 'lost' && state.lossHint) {
            ctx.strokeStyle = state.lossHint.kind === 'mine' ? '#ff5252' : '#69f0ae';
          }
          ctx.lineWidth = 3 + pulse * 3;
          ctx.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);
          ctx.lineWidth = 1;
        }
      }
    }
  }

  function drawFlag(ctx, x, y) {
    ctx.strokeStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(x + CELL * 0.35, y + CELL * 0.75);
    ctx.lineTo(x + CELL * 0.35, y + CELL * 0.22);
    ctx.stroke();
    ctx.fillStyle = '#c62828';
    ctx.beginPath();
    ctx.moveTo(x + CELL * 0.35, y + CELL * 0.22);
    ctx.lineTo(x + CELL * 0.72, y + CELL * 0.35);
    ctx.lineTo(x + CELL * 0.35, y + CELL * 0.48);
    ctx.closePath();
    ctx.fill();
  }

  function drawMine(ctx, x, y) {
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    const r = CELL * 0.28;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * r * 1.6, cy + dy * r * 1.6);
      ctx.stroke();
    }
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1;
  }
}
