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
        newBoard();
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
      drawBackground(ctx);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#eef1f4';
      ctx.font = '800 56px system-ui, sans-serif';
      ctx.fillText('Sure Sweep', meta.width / 2, 110);
      ctx.fillStyle = 'rgba(224,228,240,0.6)';
      ctx.font = '500 25px system-ui, sans-serif';
      ctx.fillText('no-guess minesweeper', meta.width / 2, 148);

      if (state.scene === 'demo-limit') {
        drawPanel(ctx, 0, meta.height * 0.32, meta.width, meta.height * 0.4);
        ctx.fillStyle = '#fff';
        ctx.font = '800 38px system-ui, sans-serif';
        ctx.fillText("That's the free preview!", meta.width / 2, meta.height * 0.4);
        ctx.font = '500 25px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(224,228,240,0.8)';
        wrapText(ctx, 'Get the full game on iPhone and Android for unlimited boards, hints and no interruptions.', meta.width / 2, meta.height * 0.47, meta.width - 200, 34);
        return;
      }

      if (state.scene === 'title') {
        ctx.fillStyle = '#eef1f4';
        ctx.font = '800 38px system-ui, sans-serif';
        ctx.fillText('Tap to play', meta.width / 2, meta.height * 0.4);
        ctx.font = '500 25px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(224,228,240,0.65)';
        ctx.fillText('Every board is provably solvable by logic alone.', meta.width / 2, meta.height * 0.46);
        if (state.bestTime !== null) {
          drawPill(ctx, meta.width / 2, meta.height * 0.52, `🏆 Best time: ${state.bestTime.toFixed(1)}s`);
        }
        if (state.demo) {
          drawPill(ctx, meta.width / 2, meta.height * 0.66, `Free preview — ${Math.max(DEMO_BOARD_LIMIT - state.demoBoards, 0)} board(s) left`);
        }
        return;
      }

      // HUD row: mine counter + timer.
      ctx.font = '700 30px monospace';
      ctx.fillStyle = '#eef1f4';
      ctx.textAlign = 'left';
      ctx.fillText(`💣 ${String(Math.max(remainingFlags(), 0)).padStart(2, '0')}`, BOARD_X, 218);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(224,228,240,0.75)';
      ctx.fillText(`⏱ ${state.time.toFixed(1)}s`, BOARD_X + BOARD_W, 218);

      drawGrid(ctx);
      drawButton(ctx, FLAG_BTN, state.flagMode ? '🚩·' : '🚩', state.flagMode ? '#e63946' : '#2a3550');
      drawButton(ctx, HINT_BTN, '💡', '#2a3550');
      drawButton(ctx, NEW_BTN, '↻', '#2a3550');

      if (state.scene === 'lost') {
        drawPanel(ctx, 0, 560, meta.width, 400);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '800 50px system-ui, sans-serif';
        ctx.fillText('💥 Boom.', meta.width / 2, 630);
        ctx.font = '500 24px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(224,228,240,0.8)';
        wrapText(ctx, 'That mine was avoidable by logic — see the highlighted cell.', meta.width / 2, 672, meta.width - 140, 30);
        if (!state.shieldOffered) drawButton(ctx, SHIELD_BTN, 'Undo that click', '#2e7d32', true);
        ctx.fillStyle = 'rgba(224,228,240,0.55)';
        ctx.font = '22px system-ui, sans-serif';
        ctx.fillText('Tap anywhere else for a new board', meta.width / 2, 895);
      } else if (state.scene === 'won') {
        drawPanel(ctx, 0, 560, meta.width, 260);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#69f0ae';
        ctx.font = '800 50px system-ui, sans-serif';
        ctx.fillText('✅ Cleared!', meta.width / 2, 630);
        ctx.font = '500 25px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(224,228,240,0.8)';
        ctx.fillText(`Time: ${state.time.toFixed(1)}s — tap for a new board`, meta.width / 2, 675);
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

  function drawBackground(ctx) {
    const g = ctx.createRadialGradient(meta.width * 0.75, -40, 30, meta.width * 0.75, -40, meta.width * 1.2);
    g.addColorStop(0, '#2f7ba3');
    g.addColorStop(0.55, '#2a5f7e');
    g.addColorStop(1, '#2a4f66');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, meta.width, meta.height);
  }

  function drawPanel(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 24, y, w - 48, h - 24, 24);
    ctx.fillStyle = 'rgba(13,18,28,0.9)';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 40;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(x + 24, y, w - 48, h - 24, 24);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
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
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, y + 7);
  }

  function drawButton(ctx, r, label, color, wide = false) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 14);
    if (wide) {
      const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
      g.addColorStop(0, color);
      g.addColorStop(1, '#22d3ee');
      ctx.fillStyle = g;
      ctx.shadowColor = `${color}80`;
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 8;
    } else {
      ctx.fillStyle = color;
    }
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = wide ? '#0a0d16' : '#eef1f4';
    ctx.font = `${wide ? '800' : '700'} 24px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 9);
  }

  function drawGrid(ctx) {
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const i = r * w + c;
        const x = BOARD_X + c * CELL;
        const y = BOARD_Y + r * CELL;
        const isHint = (state.hint && state.hint.index === i) || (state.scene === 'lost' && state.lossHint && state.lossHint.index === i);
        const isExploded = state.exploded === i;
        const pad = 2;

        ctx.beginPath();
        ctx.roundRect(x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, 6);

        if (state.revealed[i]) {
          const g = ctx.createLinearGradient(x, y, x, y + CELL);
          if (isExploded) {
            g.addColorStop(0, '#e63946');
            g.addColorStop(1, '#b3212f');
          } else {
            g.addColorStop(0, '#f4f6f8');
            g.addColorStop(1, '#dde3ea');
          }
          ctx.fillStyle = g;
          ctx.fill();
          if (state.numbers[i] === -1) {
            drawMine(ctx, x, y);
          } else if (state.numbers[i] > 0) {
            ctx.fillStyle = NUMBER_COLORS[state.numbers[i]];
            ctx.font = '800 32px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(state.numbers[i]), x + CELL / 2, y + CELL / 2 + 11);
          }
        } else {
          const g = ctx.createLinearGradient(x, y, x, y + CELL);
          g.addColorStop(0, '#3a4356');
          g.addColorStop(1, '#262d3d');
          ctx.fillStyle = g;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1;
          ctx.stroke();
          if (state.flagged[i]) drawFlag(ctx, x, y);
        }

        if (isHint) {
          const pulse = 0.5 + 0.5 * Math.sin(state.pulse * 6);
          ctx.beginPath();
          ctx.roundRect(x + 3, y + 3, CELL - 6, CELL - 6, 5);
          ctx.strokeStyle = state.hint && state.hint.index === i && state.hint.kind === 'mine' ? '#ff5252' : '#69f0ae';
          if (state.scene === 'lost' && state.lossHint) {
            ctx.strokeStyle = state.lossHint.kind === 'mine' ? '#ff5252' : '#69f0ae';
          }
          ctx.lineWidth = 3 + pulse * 3;
          ctx.stroke();
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
