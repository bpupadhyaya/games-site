// All drawing for the game. Pure: reads `state`, never mutates it (game.js owns every mutation).
import {
  W, H, S, STONE_R, BOARD, GX, GY, HDR, MSG, BAR_Y, BAR_H, BTN, CHOICE, INFO_STRIP, TITLE_SOUND, titleRows,
  TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, REF_PANEL, RESULT, LIMIT, SETTINGS_ROW, SETTINGS_BACK, AUTO, LEARN_BAR, THINK_STEPS, SIBLINGS, chipRect, pointXY,
} from './layout.js';
import { ROWS, COLS, LIGHT, DARK, SEGMENTS, DIRS, idx, rowOf, colOf, countOf, NO_CAPTURE_LIMIT, legalSteps, SIDE_NAME } from './rules.js';
import { LEVELS } from './engine.js';
import {
  FONT, THEMES, THEME_ORDER, themeOf, TAU, clamp, easeOut, easeInOut, easeBack, rr, drawBackdrop, drawBaobab, drawBoard, drawStone, baked, paintBoard, localXY, boardBox,
  wrapLines, fitFont, textBlock, setPress, drawButton, drawPanel, drawIcon, lcg,
} from './art.js';
import { page as pageContent } from './content.js';
import { LESSONS } from './lessons.js';

const AMBER = '#ffb83a', CYAN = '#4fd6ee', RED = '#ff5a44', GOLD = '#ffe08a';

// ---- shared board drawing ------------------------------------------------------------------------------------------
const xyOf = (state) => (p) => pointXY(p, state.flip);

function drawArrow(ctx, a, b, color, wd, head = 16, gap = 22) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < gap * 2 + 6) return;
  const ux = dx / len, uy = dy / len, sx = a.x + ux * gap, sy = a.y + uy * gap, ex = b.x - ux * gap, ey = b.y - uy * gap;
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex - ux * head * 0.6, ey - uy * head * 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - ux * head - uy * head * 0.55, ey - uy * head + ux * head * 0.55); ctx.lineTo(ex - ux * head + uy * head * 0.55, ey - uy * head - ux * head * 0.55); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function ring(ctx, p, r, color, wd, alpha = 1, dash = null) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = wd; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); ctx.restore();
}
function badge(ctx, x, y, text, color, T) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();
  ctx.fillStyle = '#2a1204'; ctx.font = `700 19px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1); ctx.restore();
}

// What the board shows: the visual board `vboard`, with the stone mid-flight drawn separately.
function drawBoardScene(ctx, state, T) {
  const xy = xyOf(state), t = state.t, pulse = 0.5 + 0.5 * Math.sin(t * 5);
  const g = state.g, an = state.anim;
  drawBoard(ctx, state.theme, BOARD.x, BOARD.y, { S, F: BOARD.w / 2 - (ROWS - 1) * S / 2 });

  // trail of the last finished turn (faint dashed route)
  if (state.trail && state.trail.length) {
    ctx.save(); ctx.setLineDash([2, 12]); ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,224,150,0.5)';
    ctx.beginPath(); state.trail.forEach((s, i) => { const a = xy(s.from), b = xy(s.to); if (i === 0) ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }); ctx.stroke(); ctx.restore();
    const f = xy(state.trail[0].from); ring(ctx, f, 18, 'rgba(255,224,150,0.55)', 3, 1, [4, 6]);
  }
  // the path of the turn in progress
  if (g.chain && g.chain.visited.length > 1) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,200,90,0.55)'; ctx.setLineDash([1, 13]);
    ctx.beginPath(); g.chain.visited.forEach((p, i) => { const q = xy(p); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); }); ctx.stroke(); ctx.restore();
  }
  // danger halos (stones that could be captured next turn)
  if (state.danger && state.dangerSet) for (const p of state.dangerSet) { const q = xy(p); ring(ctx, q, STONE_R + 9 + pulse * 3, RED, 4, 0.55 + 0.35 * pulse, [10, 8]); }
  // compulsory capture: glow on stones that may capture
  if (state.canMove && state.sel < 0 && !g.chain) for (const p of state.canMove) { const q = xy(p); ring(ctx, q, STONE_R + 8 + pulse * 3, AMBER, 4, 0.5 + 0.4 * pulse); }
  // legal destination markers
  if (state.targets && state.targets.length && !state.choice) {
    const seen = new Set();
    for (const s of state.targets) {
      if (seen.has(s.to)) continue; seen.add(s.to);
      const all = state.targets.filter((o) => o.to === s.to), n = Math.max(...all.map((o) => o.victims.length)), q = xy(s.to);
      if (n > 0) {
        const gg = ctx.createRadialGradient(q.x, q.y, 2, q.x, q.y, 36); gg.addColorStop(0, 'rgba(255,200,80,0.85)'); gg.addColorStop(1, 'rgba(255,160,40,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(q.x, q.y, 36 + pulse * 4, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(q.x, q.y, 15, 0, TAU); ctx.fillStyle = AMBER; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,24,0,0.7)'; ctx.stroke();
        ring(ctx, q, 24 + pulse * 3, 'rgba(255,224,150,0.9)', 3);
        badge(ctx, q.x + 26, q.y - 26, String(n), GOLD, T);
      } else {
        ctx.beginPath(); ctx.arc(q.x, q.y, 13 + pulse * 1.5, 0, TAU); ctx.fillStyle = 'rgba(255,248,230,0.8)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(40,20,10,0.55)'; ctx.stroke();
      }
    }
  }
  // selection ring
  if (state.sel >= 0) { const q = xy(state.sel); ring(ctx, q, STONE_R + 10, GOLD, 5, 0.95); ring(ctx, q, STONE_R + 18 + pulse * 4, GOLD, 2, 0.5); }

  // stones (the animated mover and the dragged stone are drawn after, on top)
  const vb = state.vboard, hideFrom = an ? an.from : -1, dragP = state.drag && state.drag.moved ? state.drag.p : -1;
  const victimSet = an && an.t > an.slide ? new Set(an.victims) : null;
  for (let p = 0; p < ROWS * COLS; p++) {
    const side = vb[p];
    if (!side || p === hideFrom || p === dragP) continue;
    const q = xy(p);
    let o = {};
    if (state.sel === p) o = { lift: 1, glow: 'rgba(255,224,150,0.9)' };
    if (victimSet && victimSet.has(p)) { const k = easeOut((an.t - an.slide) / an.pop); o = { scale: 1 - k, alpha: 1 - k * 0.8 }; }
    else if (an && an.to === p && an.t < an.slide) continue;
    if (state.hintPulse && state.hintPulse.has(p)) o.glow = 'rgba(255,224,150,0.9)';
    drawStone(ctx, q.x, q.y, STONE_R, side, T, o);
  }
  // choice highlight: victims of each option
  if (state.choice) {
    const q0 = xy(state.choice.to);
    for (const o of state.choice.options) {
      const col = o.kind === 'approach' ? AMBER : CYAN;
      for (const v of o.victims) { const q = xy(v); ring(ctx, q, STONE_R + 6 + pulse * 3, col, 6, 0.95); }
      const far = xy(o.victims[o.victims.length - 1]);
      drawArrow(ctx, o.kind === 'approach' ? q0 : xy(o.from), far, col, 7, 18, o.kind === 'approach' ? 30 : 30);
    }
    const q = xy(state.choice.from); ring(ctx, q, STONE_R + 8, GOLD, 4, 0.8);
    ctx.save(); ctx.globalAlpha = 0.9; drawStone(ctx, q0.x, q0.y, STONE_R, state.g.turn, T, { alpha: 0.45 }); ctx.restore();
  }
  // hint: numbered path and crossed victims
  if (state.hint) {
    const hs = state.hint.steps;
    for (const s of hs) for (const v of s.victims) { const q = xy(v); ring(ctx, q, STONE_R + 5, GOLD, 4, 0.9, [8, 6]); }
    hs.forEach((s, i) => { const a = xy(s.from), b = xy(s.to); drawArrow(ctx, a, b, GOLD, 8, 20, 24); });
    hs.forEach((s, i) => { const b = xy(s.to); badge(ctx, b.x + 28, b.y - 28, String(i + 1), GOLD, T); });
    const f = xy(hs[0].from); ring(ctx, f, STONE_R + 8, GOLD, 5, 0.95);
  }
  // reveal (Watch & Learn): every stone that could start the turn, then the chosen route
  if (state.reveal) {
    const rv = state.reveal;
    for (const p of rv.starts) { const q = xy(p); ring(ctx, q, STONE_R + 7, 'rgba(255,224,150,0.55)', 4, 1, [10, 8]); }
    if (rv.phase === 'chosen') {
      for (const s of rv.steps) for (const v of s.victims) { const q = xy(v); ring(ctx, q, STONE_R + 6 + pulse * 3, s.kind === 'approach' ? AMBER : CYAN, 6, 0.95); }
      rv.steps.forEach((s) => drawArrow(ctx, xy(s.from), xy(s.to), GOLD, 8, 20, 24));
      rv.steps.forEach((s, i) => { const b = xy(s.to); badge(ctx, b.x + 28, b.y - 28, String(i + 1), GOLD, T); });
      ring(ctx, xy(rv.steps[0].from), STONE_R + 10, GOLD, 6, 0.95);
    }
  }
  // the moving stone
  if (an) {
    const a = xy(an.from), b = xy(an.to), k = easeInOut(an.t / an.slide), kk = clamp(an.t / an.slide, 0, 1);
    const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k, lift = Math.sin(Math.PI * kk);
    if (an.t < an.slide) {
      // comet trail
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,224,150,0.35)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
    }
    drawStone(ctx, x, y, STONE_R, an.side, T, { lift: lift * 0.9 + (an.t < an.slide ? 0 : 0), scale: 1 + lift * 0.08 });
  }
  if (state.drag && state.drag.moved) drawStone(ctx, state.drag.x, state.drag.y - 20, STONE_R * 1.08, g.turn, T, { lift: 1, glow: 'rgba(255,224,150,0.8)' });
  // keyboard cursor
  if (state.kb && state.cursor >= 0) { const q = xy(state.cursor); ring(ctx, q, STONE_R + 4, '#ffffff', 3, 0.8, [6, 6]); }
  // particles
  for (const r of state.rings) { const k = r.t / 0.55; ring(ctx, { x: r.x, y: r.y }, 20 + k * 80, r.c || GOLD, 6 * (1 - k) + 1, 1 - k); }
  for (const q of state.parts) { const k = q.t / q.max; ctx.fillStyle = `rgba(${q.c},${1 - k})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - k * 0.5), 0, TAU); ctx.fill(); }
  for (const f of state.floats) {
    const k = f.t / 1.1; ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.font = `700 ${46 + (1 - k) * 8}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(40,12,0,0.8)';
    ctx.strokeText(f.text, f.x, f.y - k * 70); ctx.fillStyle = f.c || GOLD; ctx.fillText(f.text, f.x, f.y - k * 70); ctx.restore();
  }
}

// ---- header, tallies, message and buttons ------------------------------------------------------------------------
function tally(ctx, r, side, label, count, active, T, thinking, t) {
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, 20);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, T.panel[0]); g.addColorStop(1, T.panel[1]); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = active ? 3 : 1.5; ctx.strokeStyle = active ? GOLD : 'rgba(255,225,180,0.25)';
  if (active) { ctx.shadowColor = 'rgba(255,200,100,0.6)'; ctx.shadowBlur = 14; }
  ctx.stroke(); ctx.shadowColor = 'transparent';
  drawStone(ctx, r.x + 36, r.y + r.h / 2, 21, side, T);
  ctx.fillStyle = T.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  fitFont(ctx, label, 700, 26, r.w - 150, 14); ctx.fillText(label, r.x + 70, r.y + r.h / 2 + 1);
  ctx.textAlign = 'right'; ctx.font = `700 40px ${FONT}`; ctx.fillStyle = active ? GOLD : T.ink; ctx.fillText(String(count), r.x + r.w - 20, r.y + r.h / 2 + 2);
  if (thinking) { ctx.fillStyle = GOLD; for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(t * 7 - i * 0.9)); ctx.beginPath(); ctx.arc(r.x + r.w - 92 + i * 13, r.y + r.h - 12, 4, 0, TAU); ctx.fill(); } }
  ctx.restore();
}
function header(ctx, state, T, titleText) {
  drawButton(ctx, HDR.menu, 'Menu', T, { px: 26 });
  drawButton(ctx, HDR.sound, state.sound ? 'On' : 'Off', T, { px: 26 });
  ctx.save(); ctx.fillStyle = T.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 40px ${FONT}`; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
  ctx.fillText(titleText || 'Fanorona', W / 2, 50); ctx.restore();
}
function leftSide(state) { return state.flip ? DARK : LIGHT; }
function tallies(ctx, state, T) {
  const vb = state.vboard, ls = leftSide(state), rs = 3 - ls, g = state.g;
  const name = (side) => {
    if (state.scene === 'auto') return `${SIDE_NAME[side]} · ${LEVELS[state.apLevels[side - 1] - 1].name}`;
    if (state.mode === 'ai') return side === state.human ? 'You' : LEVELS[state.level - 1].name;
    return SIDE_NAME[side];
  };
  tally(ctx, HDR.tallyL, ls, name(ls), countOf(vb, ls), g.turn === ls && !g.result, T, state.thinking && g.turn === ls, state.t);
  tally(ctx, HDR.tallyR, rs, name(rs), countOf(vb, rs), g.turn === rs && !g.result, T, state.thinking && g.turn === rs, state.t);
}
function message(ctx, state, T) {
  drawPanel(ctx, MSG, T, { round: 24 });
  const m = state.msg;
  if (!m) return;
  const col = m.kind === 'warn' ? '#ffb4a0' : m.kind === 'good' ? '#bdf0b0' : T.ink;
  const sc = Math.min(TEXT_SCALES[state.textIdx], 1.6);
  ctx.save(); ctx.fillStyle = col; ctx.textBaseline = 'middle';
  let px = Math.round(27 * sc), lines;
  for (;;) { ctx.font = `400 ${px}px ${FONT}`; lines = wrapLines(ctx, m.text, MSG.w - 56); if (lines.length * px * 1.2 <= MSG.h - 22 || px <= 15) break; px -= 1; }
  const lh = px * 1.2, y0 = MSG.y + MSG.h / 2 - ((lines.length - 1) * lh) / 2;
  ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh));
  ctx.restore();
}
function choiceButtons(ctx, state, T) {
  const o = state.choice.options;
  for (const opt of o) {
    const r = opt.kind === 'approach' ? CHOICE.approach : CHOICE.withdraw, col = opt.kind === 'approach' ? AMBER : CYAN;
    ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, 22); const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, T.panel[0]); g.addColorStop(1, T.panel[1]); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(r.x + 40, r.y + r.h / 2, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = T.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    fitFont(ctx, opt.kind === 'approach' ? 'Approach' : 'Withdraw', 700, 34, r.w - 90, 16); ctx.fillText(opt.kind === 'approach' ? 'Approach' : 'Withdraw', r.x + 70, r.y + r.h * 0.38);
    fitFont(ctx, `takes ${opt.victims.length}`, 400, 25, r.w - 90, 14); ctx.globalAlpha = 0.85; ctx.fillText(`takes ${opt.victims.length}`, r.x + 70, r.y + r.h * 0.72);
    ctx.restore();
  }
}
function infoStrip(ctx, state, T, text) {
  ctx.save(); ctx.fillStyle = T.sub; ctx.globalAlpha = 0.85; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, text, 400, 24, INFO_STRIP.w, 13);
  ctx.fillText(text, W / 2, INFO_STRIP.y + INFO_STRIP.h / 2); ctx.restore();
}
function iconButton(ctx, r, icon, label, T, o = {}) {
  drawButton(ctx, r, '', T, o);
  const col = o.primary ? T.accentText : T.ink;
  ctx.save(); if (o.disabled) ctx.globalAlpha = 0.45;
  drawIcon(ctx, icon, r.x + r.w / 2, r.y + r.h * 0.38, 34, col);
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, label, 700, 24, r.w - 14, 12); ctx.fillText(label, r.x + r.w / 2, r.y + r.h * 0.78); ctx.restore();
}

function banner(ctx, state, T) {
  const b = state.banner; if (!b) return;
  const k = b.t / 1.5, a = k < 0.15 ? k / 0.15 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  const w = 520, h = 110, x = (W - w) / 2, y = BOARD.y + BOARD.h / 2 - h / 2 + (1 - easeOut(Math.min(k * 4, 1))) * 24;
  rr(ctx, x, y, w, h, 30); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(60,20,10,0.92)'); g.addColorStop(1, 'rgba(20,6,4,0.94)'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.stroke();
  ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, b.text, 700, 54, w - 50, 20); ctx.fillText(b.text, W / 2, y + h / 2 + 2);
  ctx.restore();
}

function renderPlay(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  const g = state.g, ai = state.mode === 'ai', myTurn = state.canAct;
  header(ctx, state, T);
  tallies(ctx, state, T);
  drawBoardScene(ctx, state, T);
  if (state.choice) choiceButtons(ctx, state, T); else message(ctx, state, T);
  iconButton(ctx, BTN.undo, 'undo', 'Undo', T, { disabled: !state.canUndo });
  iconButton(ctx, BTN.hint, 'think', 'Think', T, { disabled: !ai || !myTurn || !!g.result });
  iconButton(ctx, BTN.danger, 'danger', 'Danger', T, { active: state.danger });
  if (g.chain && myTurn) iconButton(ctx, BTN.end, 'stop', 'End turn', T, { primary: true });
  else iconButton(ctx, BTN.end, 'flag', ai ? 'Resign' : 'Draw', T, { disabled: !!g.result || (ai && !myTurn) });
  infoStrip(ctx, state, T, `${ai ? LEVELS[state.level - 1].name + ' level' : 'Two players'}  ·  quiet turns ${g.quiet}/${NO_CAPTURE_LIMIT} (a capture resets it)`);
  banner(ctx, state, T);
  if (g.result && state.overOpen) renderResult(ctx, state, T);
}

// ---- result overlay ---------------------------------------------------------------------------------------------
function resultText(state) {
  const r = state.g.result, ai = state.mode === 'ai' && state.scene !== 'auto';
  const left = countOf(state.g.board, 1), right = countOf(state.g.board, 2);
  let title, sub;
  if (r.winner === 0) { title = 'A draw'; sub = r.why === 'agreed' ? 'Both players agreed to a draw.' : `${NO_CAPTURE_LIMIT} turns passed with no capture. Stones left: Light ${left}, Dark ${right}.`; }
  else {
    const won = ai ? r.winner === state.human : true;
    const nm = SIDE_NAME[r.winner];
    title = state.scene === 'auto' ? `${nm} wins` : ai ? (won ? 'You win!' : 'You lose') : `${nm} wins`;
    sub = r.why === 'blocked' ? `${SIDE_NAME[3 - r.winner]} had no legal move.` : r.why === 'resign' ? 'You resigned this game.' : `Every ${SIDE_NAME[3 - r.winner]} stone was captured. ${nm} kept ${r.winner === 1 ? left : right}.`;
  }
  return { title, sub };
}
function renderResult(ctx, state, T) {
  const { title, sub } = resultText(state), sc = TEXT_SCALES[state.textIdx], auto = state.scene === 'auto', P = RESULT.panel;
  ctx.save(); ctx.fillStyle = 'rgba(8,3,2,0.7)'; ctx.fillRect(0, 0, W, H);
  drawPanel(ctx, P, T, { round: 36 });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  // title (fits its zone, up to two lines)
  let tpx = Math.round(66 * Math.min(sc, 1.6)), tl;
  for (;;) { ctx.font = `700 ${tpx}px ${FONT}`; tl = wrapLines(ctx, title, P.w - 100); if (tl.length * tpx * 1.12 <= RESULT.titleZone.h || tpx <= 24) break; tpx -= 2; }
  ctx.fillStyle = GOLD; tl.forEach((l, i) => ctx.fillText(l, W / 2, RESULT.titleZone.y + tpx * 0.95 + i * tpx * 1.12));
  // a medallion: the winner's stone (or both for a draw), lit
  const cy = RESULT.art.y + RESULT.art.h / 2, r = state.g.result;
  const rg = ctx.createRadialGradient(W / 2, cy, 10, W / 2, cy, 150); rg.addColorStop(0, 'rgba(255,214,120,0.55)'); rg.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = rg; ctx.fillRect(W / 2 - 160, cy - 160, 320, 320);
  const sp = Math.sin(state.t * 2) * 4;
  if (r.winner === 0) { drawStone(ctx, W / 2 - 62, cy + sp, 58, LIGHT, T); drawStone(ctx, W / 2 + 62, cy - sp, 58, DARK, T); }
  else drawStone(ctx, W / 2, cy + sp, 84, r.winner, T, { lift: 0.6, glow: 'rgba(255,224,150,0.9)' });
  // explanation (fits its zone)
  let spx = Math.round(31 * sc), sl;
  for (;;) { ctx.font = `400 ${spx}px ${FONT}`; sl = wrapLines(ctx, sub, P.w - 90); if (sl.length * spx * 1.25 <= RESULT.subZone.h || spx <= 15) break; spx -= 1; }
  ctx.fillStyle = T.ink; sl.forEach((l, i) => ctx.fillText(l, W / 2, RESULT.subZone.y + spx * 0.95 + i * spx * 1.25));
  drawButton(ctx, RESULT.again, auto ? 'Watch again' : 'Play again', T, { primary: true, px: 40 });
  drawButton(ctx, RESULT.menu, 'Menu', T, { px: 38 });
  if (!auto) {
    ctx.fillStyle = T.sub; ctx.font = `400 22px ${FONT}`; ctx.fillText('More from Arcforge', W / 2, RESULT.chipsY - 14);
    SIBLINGS.forEach((sb, i) => drawButton(ctx, chipRect(i, RESULT.chipsY), sb.title, T, { px: 26 }));
  }
  drawButton(ctx, RESULT.dec, 'A-', T, { px: 26, disabled: state.textIdx === 0 }); drawButton(ctx, RESULT.inc, 'A+', T, { px: 26, disabled: state.textIdx === TEXT_SCALES.length - 1 });
  ctx.restore();
}

// ---- title ----------------------------------------------------------------------------------------------------------------
const OPEN_MOVES = [[12, 22], [13, 22], [14, 22], [21, 22], [21, 22]];
function renderHero(ctx, state, T) {
  const t = state.t;
  // sunset sky
  const sky = ctx.createLinearGradient(0, 0, 0, 640);
  sky.addColorStop(0, '#2b0f30'); sky.addColorStop(0.35, '#7a2431'); sky.addColorStop(0.62, '#d9632f'); sky.addColorStop(0.82, '#ffb454'); sky.addColorStop(1, '#ffdf94');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 640);
  // sun
  const sg = ctx.createRadialGradient(W / 2, 560, 10, W / 2, 560, 330); sg.addColorStop(0, 'rgba(255,250,210,0.95)'); sg.addColorStop(0.25, 'rgba(255,214,120,0.6)'); sg.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 230, W, 410);
  // stars + drifting dust
  const rnd = lcg(5); ctx.fillStyle = 'rgba(255,240,220,0.8)';
  for (let i = 0; i < 40; i++) { const x = rnd() * W, y = rnd() * 220; ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * 0.8 + i)); ctx.beginPath(); ctx.arc(x, y, 1.2 + rnd() * 1.4, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  // far hills + baobabs
  ctx.fillStyle = 'rgba(70,16,28,0.75)'; ctx.beginPath(); ctx.moveTo(0, 560); ctx.bezierCurveTo(140, 500, 260, 560, 380, 530); ctx.bezierCurveTo(500, 500, 600, 550, W, 520); ctx.lineTo(W, 640); ctx.lineTo(0, 640); ctx.fill();
  drawBaobab(ctx, 92, 600, 360, 'rgba(34,8,14,0.92)', 6); drawBaobab(ctx, 628, 610, 300, 'rgba(34,8,14,0.92)', -8); drawBaobab(ctx, 245, 592, 150, 'rgba(60,14,22,0.85)', 3); drawBaobab(ctx, 500, 596, 130, 'rgba(60,14,22,0.85)', -3);
  const gr = ctx.createLinearGradient(0, 590, 0, 640); gr.addColorStop(0, '#2a0b10'); gr.addColorStop(1, T.bg[1]); ctx.fillStyle = gr; ctx.fillRect(0, 590, W, 50);
  // the title
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(30,6,0,0.75)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 6;
  const tg = ctx.createLinearGradient(0, 80, 0, 190); tg.addColorStop(0, '#fff3c4'); tg.addColorStop(0.55, '#ffd36a'); tg.addColorStop(1, '#e08a2c');
  ctx.fillStyle = tg; ctx.font = `700 ${fitFont(ctx, 'Fanorona', 700, 150, 620, 60)}px ${FONT}`; ctx.fillText('Fanorona', W / 2, 168);
  ctx.shadowColor = 'transparent'; ctx.fillStyle = '#ffe9c0'; ctx.font = `400 34px ${FONT}`;
  const sub = 'A P P R O A C H   &   W I T H D R A W'; fitFont(ctx, sub, 400, 31, 600, 16); ctx.fillText(sub, W / 2, 224);
  ctx.strokeStyle = 'rgba(255,230,170,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(150, 246); ctx.lineTo(570, 246); ctx.stroke();
  for (const dx of [-1, 0, 1]) { ctx.save(); ctx.translate(W / 2 + dx * 40, 246); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#ffe9c0'; ctx.fillRect(-5, -5, 10, 10); ctx.restore(); }
  ctx.restore();
  // a living board: the five opening captures, one after another
  const Sm = 50, F = 30, ox = (W - ((COLS - 1) * Sm + F * 2)) / 2, oy = 290;
  const bw = (COLS - 1) * Sm + F * 2, bh = (ROWS - 1) * Sm + F * 2;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; rr(ctx, ox, oy, bw, bh, 20); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  const opt = { S: Sm, F, inlay: true, round: 18 };
  // horizontal board: rotate the vertical painting a quarter turn
  ctx.save(); ctx.translate(ox + bw / 2, oy + bh / 2); ctx.rotate(Math.PI / 2);
  const vw = boardBox(opt).w, vh = boardBox(opt).h;
  baked(ctx, `hero:${state.theme}`, -vw / 2, -vh / 2, vw, vh, (c) => paintBoard(c, T, opt), 2);
  ctx.restore();
  const pt = (p) => { const r = rowOf(p), c = colOf(p); return { x: ox + F + c * Sm, y: oy + F + r * Sm }; };
  const cyc = 5.2, n = Math.floor(t / cyc) % OPEN_MOVES.length, k = (t % cyc) / cyc;
  const [from, to] = OPEN_MOVES[n], b0 = state.startBoard;
  const kind = n === 4 ? 'withdraw' : 'approach';
  const dir = [[1, 1], [1, 0], [1, -1], [0, 1], [0, 1]][n], victims = [];
  { let r = rowOf(to) + (kind === 'approach' ? dir[0] : -dir[0]), c = colOf(to) + (kind === 'approach' ? dir[1] : -dir[1]); const sgn = kind === 'approach' ? 1 : -1;
    if (kind === 'withdraw') { r = rowOf(from) - dir[0]; c = colOf(from) - dir[1]; }
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && b0[idx(r, c)] === DARK) { victims.push(idx(r, c)); r += dir[0] * (kind === 'approach' ? 1 : -1); c += dir[1] * (kind === 'approach' ? 1 : -1); } void sgn; }
  const mv = clamp((k - 0.2) / 0.18, 0, 1), pop = clamp((k - 0.38) / 0.16, 0, 1), back = clamp((k - 0.86) / 0.14, 0, 1);
  for (let p = 0; p < ROWS * COLS; p++) {
    const side = b0[p]; if (!side) continue;
    let q = pt(p), o = {};
    if (p === from) { const a = pt(from), b = pt(to), e = easeInOut(mv) * (1 - easeInOut(back)); q = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }; o = { lift: Math.sin(Math.PI * clamp(mv, 0, 1)) * (1 - back) * 0.8 }; }
    if (victims.includes(p)) { const e = easeOut(pop) * (1 - easeOut(back)); o = { scale: 1 - e, alpha: 1 - e * 0.85 }; }
    drawStone(ctx, q.x, q.y, 19, side, T, o);
  }
}
function renderTitle(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  renderHero(ctx, state, T);
  const tall = state.textIdx >= 3, R = titleRows(!!state.saved, tall), sc = tall ? TEXT_SCALES[state.textIdx] : Math.min(TEXT_SCALES[state.textIdx], 1.4);
  const cap = (base, max) => Math.round(Math.min(base * sc, tall ? max : 1e9));
  if (R.resume) drawButton(ctx, R.resume, 'Continue game', T, { px: cap(32, 44), active: true });
  drawButton(ctx, R.play, 'Play', T, { primary: true, px: cap(46, 60), sub: `vs the computer · ${LEVELS[state.level - 1].name}`, subPx: cap(24, 32) });
  drawButton(ctx, R.two, 'Two Players', T, { px: cap(32, 46) });
  drawButton(ctx, R.learn, 'Learn', T, { px: cap(32, 44), sub: `${state.learned.length}/${LESSONS.length} lessons`, subPx: cap(21, 28) });
  drawButton(ctx, R.watch, 'Watch & Learn', T, { px: cap(30, 46) });
  drawButton(ctx, R.settings, 'Settings', T, { px: cap(32, 46) });
  drawButton(ctx, R.level, `Level: ${LEVELS[state.level - 1].name}`, T, { px: cap(26, 44) });
  drawButton(ctx, R.side, `You play ${state.humanPref === DARK ? 'Dark' : 'Light'}`, T, { px: cap(26, 44) });
  drawButton(ctx, R.howto, 'How to Play', T, { px: cap(24, 50) });
  drawButton(ctx, R.rules, 'Rules', T, { px: cap(26, 50) });
  drawButton(ctx, R.about, 'About', T, { px: cap(26, 50) });
  drawButton(ctx, TITLE_SOUND, '', T); drawIcon(ctx, state.sound ? 'sound' : 'mute', TITLE_SOUND.x + 60, TITLE_SOUND.y + 31, 30, T.ink);
  ctx.save(); ctx.fillStyle = T.sub; ctx.globalAlpha = 0.8; ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`;
  ctx.fillText(state.progress.played ? `${state.progress.wins} wins in ${state.progress.played} games` : 'Madagascar\'s national board game', W / 2, Math.min(H - 40, R.bottom + 52));
  ctx.restore();
}

// ---- reference pages (How to Play / About / Rules) -----------------------------------------------------------------
function drawDiagram(ctx, T, d, cx, top, Sd) {
  const o = { S: Sd, F: 36, r0: d.r0, r1: d.r1, c0: d.c0, c1: d.c1, inlay: false, round: 16, seed: 3 };
  const { w, h } = boardBox(o), x = cx - w / 2;
  const key = `diag:${state_theme_key(T)}:${Sd}:${d.r0}${d.r1}${d.c0}${d.c1}`;
  baked(ctx, key, x, top, w, h, (c) => paintBoard(c, T, o), 1);
  const at = (p) => { const q = localXY(o, rowOf(p), colOf(p)); return { x: x + q.x, y: top + q.y }; };
  for (const [p, side] of d.stones) drawStone(ctx, at(p).x, at(p).y, Sd * 0.36, side, T, d.lift === p ? { lift: 0.8 } : {});
  for (const [list, col] of d.vics || []) for (const v of list) ring(ctx, at(v), Sd * 0.36 + 6, col === 'cyan' ? CYAN : AMBER, 5, 0.95);
  for (const [a, b] of d.arrows || []) drawArrow(ctx, at(a), at(b), GOLD, 7, 17, Sd * 0.3);
  for (const m of d.marks || []) { const q = at(m); ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, TAU); ctx.fillStyle = 'rgba(255,248,230,0.85)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(40,20,10,0.6)'; ctx.stroke(); }
  return h;
}
const themeKeys = new Map();
function state_theme_key(T) { if (!themeKeys.has(T)) themeKeys.set(T, Object.keys(THEMES).find((k) => THEMES[k] === T)); return themeKeys.get(T); }

const diagS = (d, scale) => Math.round(d.S * (scale <= 1 ? 1.7 : scale <= 1.5 ? 1.45 : scale <= 2 ? 1.2 : scale <= 2.5 ? 0.85 : 0.7));
const diagHeight = (d, scale) => boardBox({ S: diagS(d, scale), F: 36, r0: d.r0, r1: d.r1, c0: d.c0, c1: d.c1 }).h;
// Font size for a page's lines: the requested zoom, shrunk only if the text would not fit the panel.
export function pageLayout(ctx, entry, scale) {
  const maxW = REF_PANEL.w - 80, titlePx = Math.round(36 * Math.min(scale, 1.3));
  ctx.font = `700 ${titlePx}px ${FONT}`;
  const titleLines = wrapLines(ctx, entry.title, REF_PANEL.w - 80).length;
  const diagH = entry.diagram ? diagHeight(entry.diagram, scale) + 24 : 0;
  const avail = REF_PANEL.h - 66 - titleLines * titlePx * 1.15 - 30 - diagH - 20;
  let px = Math.round(30 * scale), lines;
  for (;;) {
    ctx.font = `400 ${px}px ${FONT}`; lines = [];
    for (const para of entry.lines) { const w = wrapLines(ctx, para, maxW); w.forEach((t, i) => lines.push({ text: t, end: i === w.length - 1 })); }
    const h = lines.reduce((a, l) => a + px * 1.28 + (l.end ? px * 0.32 : 0), 0);
    if (h <= avail || px <= 14) break;
    px -= 1;
  }
  return { px, lines, titlePx };
}
function renderPage(ctx, state, list, heading, T) {
  drawBackdrop(ctx, state.theme);
  const scale = TEXT_SCALES[state.textIdx], entry = list[clamp(state.page, 0, list.length - 1)], panel = REF_PANEL;
  const { px, lines, titlePx } = pageLayout(ctx, entry, scale);
  drawPanel(ctx, panel, T, { round: 30 });
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = T.sub; ctx.font = `700 ${Math.round(26 * Math.min(scale, 1.2))}px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText(heading.toUpperCase(), W / 2, panel.y + 48);
  ctx.strokeStyle = 'rgba(255,225,180,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panel.x + 60, panel.y + 66); ctx.lineTo(panel.x + panel.w - 60, panel.y + 66); ctx.stroke();
  let y = panel.y + 66;
  ctx.fillStyle = GOLD; ctx.font = `700 ${titlePx}px ${FONT}`;
  y += titlePx * 1.05; wrapLines(ctx, entry.title, panel.w - 80).forEach((l) => { ctx.fillText(l, W / 2, y); y += titlePx * 1.15; }); y -= titlePx * 0.15;
  if (entry.diagram) { y += 12; const d = entry.diagram, Sd = diagS(d, scale); drawDiagram(ctx, T, d, W / 2, y, Sd); y += diagHeight(d, scale) + 12; }
  ctx.fillStyle = '#f7eeda'; ctx.font = `400 ${px}px ${FONT}`; ctx.textAlign = 'center';
  y += px * 1.0;
  for (const l of lines) { ctx.fillText(l.text, W / 2, y); y += px * 1.28 + (l.end ? px * 0.32 : 0); }
  ctx.restore();
  ctx.save(); ctx.fillStyle = T.sub; ctx.textAlign = 'center'; ctx.font = `400 24px ${FONT}`;
  ctx.fillText(`Page ${state.page + 1} of ${list.length}`, W / 2, REF_BACK.y - 14); ctx.restore();
  drawButton(ctx, TEXT_DEC, 'A-', T, { px: 34, disabled: state.textIdx === 0 }); drawButton(ctx, TEXT_INC, 'A+', T, { px: 34, disabled: state.textIdx === TEXT_SCALES.length - 1 });
  ctx.save(); ctx.fillStyle = T.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 26px ${FONT}`; ctx.fillText(`${Math.round(scale * 100)}%`, W / 2, TEXT_DEC.y + TEXT_DEC.h / 2); ctx.restore();
  drawButton(ctx, REF_BACK, state.page === 0 ? 'Menu' : 'Back', T, { px: 38 });
  drawButton(ctx, REF_NEXT, state.page >= list.length - 1 ? 'Done' : 'Next', T, { primary: true, px: 38 });
}

// ---- settings --------------------------------------------------------------------------------------------------------------
function renderSettings(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  const tall = state.textIdx >= 3;
  ctx.save(); ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 52px ${FONT}`; ctx.fillText('Settings', W / 2, 80); ctx.restore();
  const sc = tall ? TEXT_SCALES[state.textIdx] : Math.min(TEXT_SCALES[state.textIdx], 1.5);
  const rows = [
    ['Sound', state.sound ? 'On' : 'Off'],
    ['Difficulty', `${LEVELS[state.level - 1].name}`, LEVELS[state.level - 1].blurb],
    ['You play', state.humanPref === DARK ? 'Dark' : 'Light', 'Light moves first'],
    ['Board', themeOf(state.theme).name],
    ['Danger marks', state.danger ? 'On' : 'Off', 'Marks stones that can be captured next'],
    ['Think time', `${THINK_STEPS[state.thinkIdx]} s`, 'Watch & Learn. Tap to cycle: 2, 5, 8, 10'],
    ['Text size', `${Math.round(TEXT_SCALES[state.textIdx] * 100)}%`, 'Tap to cycle: 100% to 300%'],
  ];
  rows.forEach((r, i) => {
    const rect = SETTINGS_ROW(i, tall);
    drawButton(ctx, rect, '', T);
    ctx.save(); ctx.textBaseline = 'middle'; ctx.fillStyle = T.ink; ctx.textAlign = 'left';
    const sub = r[2], titleY = sub ? rect.h * (tall ? 0.24 : 0.3) : rect.h * 0.5, capT = tall ? 60 : 1e9;
    ctx.textAlign = 'right'; ctx.fillStyle = GOLD; const vs = fitFont(ctx, r[1], 700, Math.min(Math.round(32 * sc), capT), rect.w * 0.42, 14); const vw = ctx.measureText(r[1]).width; ctx.fillText(r[1], rect.x + rect.w - 28, rect.y + titleY);
    ctx.textAlign = 'left'; ctx.fillStyle = T.ink; fitFont(ctx, r[0], 700, Math.min(Math.round(30 * sc), capT), rect.w - 56 - vw - 16, 13); ctx.fillText(r[0], rect.x + 28, rect.y + titleY);
    if (sub) {
      ctx.fillStyle = T.sub; const lines = tall ? 2 : 1; let px = Math.min(Math.round(21 * sc), tall ? 40 : 1e9);
      for (;;) { ctx.font = `400 ${px}px ${FONT}`; if (wrapLines(ctx, sub, rect.w - 56).length <= lines || px <= 12) break; px--; }
      const ls = wrapLines(ctx, sub, rect.w - 56), lh = px * 1.08, y0 = rect.y + (tall ? rect.h * 0.55 : rect.h * 0.72);
      ls.forEach((l, k) => ctx.fillText(l, rect.x + 28, y0 + k * lh));
    }
    ctx.restore();
  });
  drawButton(ctx, SETTINGS_BACK, 'Back', T, { primary: true, px: 40 });
}

// ---- Watch & Learn ---------------------------------------------------------------------------------------------------------
function renderAuto(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  header(ctx, state, T, 'Watch & Learn');
  tallies(ctx, state, T);
  drawBoardScene(ctx, state, T);
  message(ctx, state, T);
  const ap = state.ap;
  drawButton(ctx, AUTO.exit, 'Exit', T, { px: 30 });
  drawButton(ctx, AUTO.pause, '', T, { primary: state.apPaused });
  drawIcon(ctx, state.apPaused ? 'play' : 'pause', AUTO.pause.x + 48, AUTO.pause.y + AUTO.pause.h / 2, 38, state.apPaused ? T.accentText : T.ink);
  ctx.save(); ctx.fillStyle = state.apPaused ? T.accentText : T.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `700 30px ${FONT}`; ctx.fillText(state.apPaused ? 'Resume' : 'Pause', AUTO.pause.x + 82, AUTO.pause.y + AUTO.pause.h / 2 + 1); ctx.restore();
  drawButton(ctx, AUTO.dec, '-', T, { px: 48, disabled: state.thinkIdx === 0 }); drawButton(ctx, AUTO.inc, '+', T, { px: 48, disabled: state.thinkIdx === THINK_STEPS.length - 1 });
  ctx.save(); ctx.fillStyle = T.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 30px ${FONT}`; ctx.fillText(`${THINK_STEPS[state.thinkIdx]}s`, AUTO.val.x + AUTO.val.w / 2, AUTO.val.y + AUTO.val.h * 0.38);
  ctx.font = `400 19px ${FONT}`; ctx.fillStyle = T.sub; ctx.fillText('think time', AUTO.val.x + AUTO.val.w / 2, AUTO.val.y + AUTO.val.h * 0.74); ctx.restore();
  // phase bar
  const ph = ap && ap.phase;
  const label = state.apPaused ? 'PAUSED' : ph === 'think' ? `THINK  ${Math.max(0, Math.ceil(ap.timer))}s` : ph === 'reveal' ? 'REVEAL' : ph === 'act' ? 'ACT' : '';
  infoStrip(ctx, state, T, `${label}   ·   THINK, then REVEAL the options and the choice, then ACT`);
  banner(ctx, state, T);
  if (state.g.result && state.overOpen) renderResult(ctx, state, T);
}

// ---- Learn ---------------------------------------------------------------------------------------------------------------------
function renderLearn(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  const L = LESSONS[state.lesson.i];
  header(ctx, state, T, 'Learn');
  // lesson title strip in place of the tallies
  ctx.save(); const r = { x: 18, y: 96, w: W - 36, h: 64 }; drawPanel(ctx, r, T, { round: 18 });
  ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, `${state.lesson.i + 1}/${LESSONS.length}  ${L.title}`, 700, 32, r.w - 40, 16); ctx.fillText(`${state.lesson.i + 1}/${LESSONS.length}  ${L.title}`, W / 2, r.y + r.h / 2 + 1); ctx.restore();
  drawBoardScene(ctx, state, T);
  if (state.choice) choiceButtons(ctx, state, T); else message(ctx, state, T);
  const done = state.lesson.done;
  drawButton(ctx, LEARN_BAR.menu, 'Menu', T, { px: 28 });
  drawButton(ctx, LEARN_BAR.hint, 'Show me', T, { px: 26, disabled: done });
  drawButton(ctx, LEARN_BAR.reset, 'Reset', T, { px: 28 });
  drawButton(ctx, LEARN_BAR.next, state.lesson.i === LESSONS.length - 1 && done ? 'Finish' : 'Next', T, { primary: done, px: 32, disabled: !done && !state.learned.includes(state.lesson.i) });
  infoStrip(ctx, state, T, done ? 'Lesson complete' : 'Make the move described above');
  banner(ctx, state, T);
}

function renderLimit(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  const r = LIMIT.panel;
  drawPanel(ctx, r, T, { round: 34 });
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = GOLD; ctx.font = `700 54px ${FONT}`; ctx.fillText('That was the free taste', W / 2, r.y + 100);
  ctx.fillStyle = T.ink; ctx.font = `400 32px ${FONT}`; textBlock(ctx, 'Get the full game on iPhone and Android: every level, two-player games, and all the lessons.', W / 2, r.y + 180, r.w - 80, 42);
  ctx.restore();
  drawButton(ctx, LIMIT.btn, 'Menu', T, { primary: true, px: 38 });
}

export function render(ctx, state) {
  const T = themeOf(state.theme);
  setPress(state.press);
  switch (state.scene) {
    case 'title': renderTitle(ctx, state, T); break;
    case 'play': renderPlay(ctx, state, T); break;
    case 'auto': renderAuto(ctx, state, T); break;
    case 'learn': renderLearn(ctx, state, T); break;
    case 'settings': renderSettings(ctx, state, T); break;
    case 'howto': case 'about': case 'rules': renderPage(ctx, state, pageContent(state.scene), state.scene === 'howto' ? 'How to play' : state.scene === 'about' ? 'About Fanorona' : 'Rules', T); break;
    case 'demo-limit': renderLimit(ctx, state, T); break;
    default: renderTitle(ctx, state, T);
  }
}
export { OPEN_MOVES, SEGMENTS, DIRS, legalSteps, easeBack, THEME_ORDER, textBlock, BAR_H, BAR_Y, GX, GY };
