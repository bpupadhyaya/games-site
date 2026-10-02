// All drawing for the game. Pure: reads `state`, never mutates it (game.js owns every mutation).
import {
  W, H, SQ, FRAME, BOARD, GX, GY, PIECE_K, HDR, PLATE_TOP, PLATE_BOT, COUNT, MSG, BAR_Y, BAR_H, BTN, INFO_STRIP, PROMO_BANNER, TITLE_SOUND, titleRows,
  TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, REF_PANEL, RESULT, LIMIT, SETTINGS_ROW, SETTINGS_BACK, SETTINGS_ROWS, AUTO, LEARN_BAR, THINK_STEPS,
  SIBLINGS, chipRect, squareXY, squareCentre, squareFoot,
} from './layout.js';
import { BIA, MET, KHON, MA, RUA, KHUN, NGAI, WHITE, BLACK, TYPE_NAME, SIDE_NAME, PROMO_RANK, LIMIT_TABLE, sideStats, sqName } from './rules.js';
import { LEVELS } from './engine.js';
import {
  FONT, DISPLAY, THEMES, themeOf, TAU, clamp, easeOut, easeInOut, rr, drawBackdrop, drawBoard, drawPiece, boardBox, localSq, baked, paintBoard,
  wrapLines, fitFont, textBlock, setPress, drawButton, drawPanel, drawIcon, lcg, flameLeaf,
} from './art.js';
import { page as pageContent } from './content.js';
import { LESSONS } from './lessons.js';

const GOLD = '#ffe08a', AMBER = '#ffb83a', RED = '#ff5a44', CYAN = '#6fe0f0';
const flipOf = (state) => state.flip;

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
function sqFill(ctx, s, flip, color, inset = 0) { const q = squareXY(s, flip); ctx.fillStyle = color; ctx.fillRect(q.x + inset, q.y + inset, SQ - inset * 2, SQ - inset * 2); }
function badge(ctx, x, y, text, color) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();
  ctx.fillStyle = '#2a1204'; ctx.font = `700 19px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1); ctx.restore();
}

// ---- the board scene -----------------------------------------------------------------------------------------------------
function drawBoardScene(ctx, state, T) {
  const flip = flipOf(state), t = state.t, pulse = 0.5 + 0.5 * Math.sin(t * 5), an = state.anim, g = state.g;
  drawBoard(ctx, state.theme, BOARD.x, BOARD.y, { S: SQ, F: FRAME, labels: true, flip });
  // the promotion rank of the player (a gentle band: where a Bia turns into a Bia-ngai)
  const showPromo = (state.scene === 'play' || state.scene === 'learn') && state.mode !== 'two' ? [state.human] : state.scene === 'play' ? [WHITE, BLACK] : [];
  for (const side of showPromo) {
    const rank = PROMO_RANK[side], q = squareXY(rank * 8, flip);
    ctx.save(); ctx.fillStyle = 'rgba(255,214,120,0.07)'; ctx.fillRect(GX, q.y, SQ * 8, SQ);
    ctx.setLineDash([10, 9]); ctx.strokeStyle = 'rgba(255,224,150,0.38)'; ctx.lineWidth = 2; ctx.strokeRect(GX + 1, q.y + 1, SQ * 8 - 2, SQ - 2); ctx.restore();
  }
  // last move
  if (state.trail) { sqFill(ctx, state.trail.from, flip, 'rgba(255,224,130,0.18)'); sqFill(ctx, state.trail.to, flip, 'rgba(255,224,130,0.3)'); }
  // check
  if (state.checkSq >= 0) { const c = squareCentre(state.checkSq, flip), rg = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, SQ * 0.8); rg.addColorStop(0, `rgba(255,70,50,${0.55 + 0.25 * pulse})`); rg.addColorStop(1, 'rgba(255,70,50,0)'); ctx.fillStyle = rg; ctx.fillRect(c.x - SQ, c.y - SQ, SQ * 2, SQ * 2); }
  // threats
  if (state.danger && state.threatSet) for (const s of state.threatSet) { const c = squareCentre(s, flip); ring(ctx, c, SQ * 0.44 + pulse * 3, RED, 4, 0.6 + 0.3 * pulse, [9, 7]); }
  // selection and legal targets
  if (state.sel >= 0) { sqFill(ctx, state.sel, flip, 'rgba(255,224,130,0.32)'); const q = squareXY(state.sel, flip); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.strokeRect(q.x + 3, q.y + 3, SQ - 6, SQ - 6); }
  for (const tg of state.targets || []) {
    const c = squareCentre(tg.to, flip);
    if (tg.cap) { ring(ctx, c, SQ * 0.43, RED, 5, 0.95); ctx.fillStyle = 'rgba(255,90,70,0.2)'; ctx.beginPath(); ctx.arc(c.x, c.y, SQ * 0.43, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(c.x, c.y, 11 + pulse * 1.5, 0, TAU); ctx.fillStyle = 'rgba(255,240,200,0.85)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(30,20,5,0.55)'; ctx.stroke(); }
    if (tg.promo) badge(ctx, c.x + 24, c.y - 24, '+', GOLD);
  }
  // reveal (Watch & Learn): every piece that could move, then the chosen move
  if (state.reveal) {
    const rv = state.reveal;
    for (const s of rv.movable) ring(ctx, squareCentre(s, flip), SQ * 0.45, 'rgba(255,224,150,0.6)', 3.5, 1, [9, 8]);
    ring(ctx, squareCentre(rv.from, flip), SQ * 0.47, GOLD, 6, 0.95);
    for (const tg of rv.targets) { if (tg.to === rv.to) continue; const c = squareCentre(tg.to, flip); ring(ctx, c, tg.cap ? SQ * 0.4 : 10, 'rgba(255,240,200,0.8)', 3.5); }
    const a = squareCentre(rv.from, flip), b = squareCentre(rv.to, flip);
    drawArrow(ctx, a, b, GOLD, 9, 22, 26);
    ring(ctx, b, SQ * 0.44 + pulse * 3, GOLD, 5, 0.95);
  }
  // hint
  if (state.hint) {
    const a = squareCentre(state.hint.from, flip), b = squareCentre(state.hint.to, flip);
    ring(ctx, a, SQ * 0.47, GOLD, 5, 0.95); drawArrow(ctx, a, b, GOLD, 9, 22, 26); ring(ctx, b, SQ * 0.44 + pulse * 3, GOLD, 4, 0.9, [8, 6]);
  }
  // pieces, drawn from the top of the screen to the bottom so lower pieces overlap higher ones
  const vb = state.vb, hideFrom = an ? an.from : -1, dragSq = state.drag && state.drag.moved ? state.drag.sq : -1;
  const victimGone = an && an.t > an.slide;
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const f = flip ? 7 - col : col, r = flip ? row : 7 - row, s = r * 8 + f, p = vb[s];
    if (!p || s === hideFrom || s === dragSq) continue;
    const foot = squareFoot(s, flip), type = p > 0 ? p : -p, side = p > 0 ? WHITE : BLACK;
    const o = {};
    if (state.sel === s) { o.lift = 1; o.glow = 'rgba(255,224,150,0.9)'; }
    if (an && an.to === s) { if (victimGone) { const k = easeOut((an.t - an.slide) / an.pop); o.scale = Math.max(0, 1 - k); o.alpha = 1 - k * 0.8; } }
    if (an && an.to === s && an.t > an.slide && !an.cap) continue;
    drawPiece(ctx, type, side, foot.x, foot.y, PIECE_K, o);
  }
  // the moving piece
  if (an) {
    const a = squareFoot(an.from, flip), b = squareFoot(an.to, flip), kk = clamp(an.t / an.slide, 0, 1), e = easeInOut(kk), lift = Math.sin(Math.PI * kk);
    const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
    if (an.t < an.slide) { ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,224,150,0.3)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(a.x, a.y - 30); ctx.lineTo(x, y - 30); ctx.stroke(); ctx.restore(); }
    const type = an.promo && kk > 0.98 ? NGAI : an.type;
    const pop = an.t >= an.slide && an.promo ? 1 + 0.18 * Math.sin(clamp((an.t - an.slide) / 0.3, 0, 1) * Math.PI) : 1;
    drawPiece(ctx, type, an.side, x, y, PIECE_K, { lift: lift * 1.4, scale: 1 + lift * 0.06 * 1 + (pop - 1) });
  }
  if (state.drag && state.drag.moved) { const p = state.vb[state.drag.sq], type = Math.abs(p); drawPiece(ctx, type, p > 0 ? WHITE : BLACK, state.drag.x, state.drag.y + 26, PIECE_K * 1.08, { lift: 1.4, glow: 'rgba(255,224,150,0.8)' }); }
  if (state.kb && state.cursor >= 0) { const q = squareXY(state.cursor, flip); ctx.save(); ctx.setLineDash([7, 6]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.85; ctx.strokeRect(q.x + 4, q.y + 4, SQ - 8, SQ - 8); ctx.restore(); }
  for (const r of state.rings) { const k = r.t / 0.55; ring(ctx, { x: r.x, y: r.y }, 20 + k * 80, r.c || GOLD, 6 * (1 - k) + 1, 1 - k); }
  for (const q of state.parts) { const k = q.t / q.max; ctx.fillStyle = `rgba(${q.c},${1 - k})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - k * 0.5), 0, TAU); ctx.fill(); }
  for (const f of state.floats) {
    const k = f.t / 1.1; ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.font = `700 ${40 + (1 - k) * 8}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(20,8,0,0.8)';
    ctx.strokeText(f.text, f.x, f.y - k * 70); ctx.fillStyle = f.c || GOLD; ctx.fillText(f.text, f.x, f.y - k * 70); ctx.restore();
  }
  void T; void g;
}

// ---- header, plates, count strip, message, buttons ------------------------------------------------------------------------
function header(ctx, state, T, titleText) {
  drawButton(ctx, HDR.menu, 'Menu', T, { px: 26 });
  drawButton(ctx, HDR.sound, state.sound ? 'On' : 'Off', T, { px: 26 });
  ctx.save(); ctx.fillStyle = T.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 44px ${DISPLAY}`; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
  ctx.fillText(titleText || 'Makruk', W / 2, 58); ctx.restore();
}
// captured pieces of `side` (what the other side has taken), as small icons
function capturedOf(state, side) {
  const start = { [BIA]: 8, [MET]: 1, [KHON]: 2, [MA]: 2, [RUA]: 2 }, have = { [BIA]: 0, [MET]: 0, [KHON]: 0, [MA]: 0, [RUA]: 0 };
  let ngai = 0;
  for (let s = 0; s < 64; s++) { const p = state.vb[s]; if (!p || (p > 0) !== (side > 0)) continue; const t = Math.abs(p); if (t === NGAI) ngai++; else if (have[t] !== undefined) have[t]++; }
  const out = [];
  for (const t of [RUA, MA, KHON, MET, BIA]) {
    let lost = start[t] - have[t];
    if (t === BIA) lost -= ngai; // promoted Bia are not lost, they changed
    else if (t === MET) lost -= 0;
    for (let i = 0; i < lost; i++) out.push(t);
  }
  return out;
}
function plate(ctx, r, side, label, sub, active, T, state, thinking, noCaps) {
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = T.panel; ctx.fill();
  ctx.lineWidth = active ? 3 : 1.6; ctx.strokeStyle = active ? GOLD : T.panelEdge;
  if (active) { ctx.shadowColor = 'rgba(255,200,100,0.6)'; ctx.shadowBlur = 14; }
  ctx.stroke(); ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.arc(r.x + 40, r.y + r.h / 2, 24, 0, TAU); ctx.fillStyle = side === WHITE ? '#f0d58a' : '#b72a33'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
  drawPiece(ctx, KHUN, side, r.x + 40, r.y + r.h / 2 + 22, 0.3);
  ctx.fillStyle = T.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  fitFont(ctx, label, 700, 27, 230, 15); ctx.fillText(label, r.x + 78, r.y + r.h / 2 - (sub ? 11 : 0));
  if (sub) { ctx.fillStyle = T.sub; fitFont(ctx, sub, 400, 21, 230, 12); ctx.fillText(sub, r.x + 78, r.y + r.h / 2 + 15); }
  const cap = noCaps ? [] : capturedOf(state, -side); // pieces this side has taken
  const n = cap.length, step = Math.min(30, 330 / Math.max(1, n));
  for (let i = 0; i < n; i++) drawPiece(ctx, cap[i], -side, r.x + r.w - 40 - (n - 1 - i) * step, r.y + r.h - 8, 0.27);
  if (thinking) { ctx.fillStyle = GOLD; for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(state.t * 7 - i * 0.9)); ctx.beginPath(); ctx.arc(r.x + 290 + i * 14, r.y + r.h / 2, 4.5, 0, TAU); ctx.fill(); } }
  ctx.restore();
}
function names(state) {
  const top = state.flip ? WHITE : BLACK, bot = -top;
  const nm = (side) => {
    if (state.scene === 'auto') return [`${SIDE_NAME[side]}`, `${LEVELS[state.apLevels[side === WHITE ? 0 : 1]].name} computer`];
    if (state.scene === 'learn') return [side === WHITE ? 'You' : 'Ruby', side === WHITE ? 'Gold' : 'Practice side'];
    if (state.mode === 'ai') return side === state.human ? ['You', SIDE_NAME[side]] : [`${LEVELS[state.level].name} computer`, SIDE_NAME[side]];
    return [SIDE_NAME[side], 'Player'];
  };
  return { top, bot, topN: nm(top), botN: nm(bot) };
}
function plates(ctx, state, T) {
  const n = names(state), g = state.g;
  plate(ctx, PLATE_TOP, n.top, n.topN[0], n.topN[1], g.turn === n.top && !g.result, T, state, state.thinking && g.turn === n.top);
  plate(ctx, PLATE_BOT, n.bot, n.botN[0], n.botN[1], g.turn === n.bot && !g.result, T, state, state.thinking && g.turn === n.bot);
}
const left = (c) => { const n = Math.max(1, c.limit - c.n + 1); return `${n} move${n === 1 ? '' : 's'} left`; };
function countStrip(ctx, state, T) {
  const g = state.g, c = g.count, r = COUNT;
  drawPanel(ctx, r, T, { round: 22 });
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  drawIcon(ctx, 'count', r.x + 44, r.y + 38, 38, c ? GOLD : T.sub);
  let title, sub, frac = 0;
  if (!c) {
    const w = sideStats(g.board, WHITE), k = sideStats(g.board, BLACK);
    title = 'Counting not started'; sub = `Starts when no Bia are left. Bia now: Gold ${w.bia}, Ruby ${k.bia}.`;
  } else if (c.kind === 'board') {
    title = `Board's honour: ${c.n} of ${c.limit}`; sub = `${SIDE_NAME[c.chaser]} must mate by count ${c.limit}: ${left(c)}.`; frac = (c.n - 1) / c.limit;
  } else {
    title = `Pieces' honour: ${c.n} of ${c.limit}`; sub = `${SIDE_NAME[c.chaser]} must mate by count ${c.limit}: ${left(c)}.`; frac = (c.n - 1) / c.limit;
  }
  ctx.fillStyle = c ? GOLD : T.ink; fitFont(ctx, title, 700, 30, r.w - 110, 15); ctx.fillText(title, r.x + 78, r.y + 34);
  ctx.fillStyle = T.sub; fitFont(ctx, sub, 400, 22, r.w - 100, 11); ctx.fillText(sub, r.x + 78, r.y + 64);
  // progress bar
  const bx = r.x + 78, bw = r.w - 110, by = r.y + 84;
  rr(ctx, bx, by, bw, 9, 4.5); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
  if (c && frac > 0) { rr(ctx, bx, by, Math.max(9, bw * clamp(frac, 0, 1)), 9, 4.5); ctx.fillStyle = frac > 0.75 ? RED : GOLD; ctx.fill(); }
  ctx.restore();
}
function goalStrip(ctx, state, T, L) {
  const r = COUNT; drawPanel(ctx, r, T, { round: 22 });
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = T.sub; ctx.font = `700 21px ${FONT}`; ctx.fillText('G O A L', r.x + 30, r.y + 32);
  ctx.fillStyle = state.lesson.done ? '#bdf0b0' : GOLD; fitFont(ctx, L.goalText, 700, 34, r.w - 60, 16); ctx.fillText(state.lesson.done ? 'Done: ' + L.goalText : L.goalText, r.x + 30, r.y + 70);
  ctx.restore();
}
function message(ctx, state, T) {
  drawPanel(ctx, MSG, T, { round: 24 });
  const m = state.msg; if (!m) return;
  const col = m.kind === 'warn' ? '#ffb4a0' : m.kind === 'good' ? '#bdf0b0' : T.ink;
  const sc = Math.min(TEXT_SCALES[state.textIdx], 1.6);
  ctx.save(); ctx.fillStyle = col; ctx.textBaseline = 'middle';
  let px = Math.round(27 * sc), lines;
  for (;;) { ctx.font = `400 ${px}px ${FONT}`; lines = wrapLines(ctx, m.text, MSG.w - 56); if (lines.length * px * 1.2 <= MSG.h - 22 || px <= 15) break; px -= 1; }
  const lh = px * 1.2, y0 = MSG.y + MSG.h / 2 - ((lines.length - 1) * lh) / 2;
  ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh));
  ctx.restore();
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
function banner(ctx, state) {
  const b = state.banner; if (!b) return;
  const k = b.t / 1.5, a = k < 0.15 ? k / 0.15 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  const w = 540, h = 112, x = (W - w) / 2, y = BOARD.y + BOARD.h / 2 - h / 2 + (1 - easeOut(Math.min(k * 4, 1))) * 24;
  rr(ctx, x, y, w, h, 30); ctx.fillStyle = 'rgba(10,30,28,0.94)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.stroke();
  ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, b.text, 700, 56, w - 50, 20, DISPLAY); ctx.fillText(b.text, W / 2, y + h / 2 + 2);
  ctx.restore();
}

function renderPlay(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  const g = state.g, ai = state.mode === 'ai', myTurn = state.canAct;
  header(ctx, state, T);
  plates(ctx, state, T);
  drawBoardScene(ctx, state, T);
  countStrip(ctx, state, T);
  message(ctx, state, T);
  iconButton(ctx, BTN.undo, 'undo', 'Undo', T, { disabled: !state.canUndo });
  iconButton(ctx, BTN.hint, 'think', 'Think', T, { disabled: !ai || !myTurn || !!g.result || state.hintBusy });
  iconButton(ctx, BTN.threat, 'danger', 'Threats', T, { active: state.danger });
  iconButton(ctx, BTN.end, 'flag', ai ? 'Resign' : 'Draw', T, { disabled: !!g.result || (ai && !myTurn) });
  infoStrip(ctx, state, T, `${ai ? `${LEVELS[state.level].name} level` : 'Two players'}  ·  move ${Math.floor(g.log.length / 2) + 1}${state.resignArm > 0 ? '  ·  tap again to confirm' : ''}`);
  banner(ctx, state);
  if (g.result && state.overOpen) renderResult(ctx, state, T);
}

// ---- result overlay ---------------------------------------------------------------------------------------------------------
function resultText(state) {
  const r = state.g.result, ai = state.mode === 'ai' && state.scene !== 'auto';
  let title, sub;
  const why = { stalemate: 'Stalemate: the side to move has no legal move and is not in check. It is a draw.', bare: 'Both sides are down to a bare Khun. Neither can mate: a draw.', repetition: 'The same position came up three times: a draw.', count: 'The count ran out: the stronger side did not mate in time. It is a draw.' };
  if (r.winner === 0) { title = r.why === 'stalemate' ? 'Stalemate' : 'A draw'; sub = r.why === 'agreed' ? 'Both players agreed to a draw.' : why[r.why] || 'A draw.'; }
  else {
    const won = ai ? r.winner === state.human : true, nm = SIDE_NAME[r.winner];
    title = state.scene === 'auto' ? `${nm} wins` : ai ? (won ? 'You win!' : 'You lose') : `${nm} wins`;
    sub = r.why === 'resign' ? 'You resigned this game.' : `Checkmate: the ${SIDE_NAME[-r.winner]} Khun has no way out. ${nm} wins.`;
  }
  return { title, sub };
}
function renderResult(ctx, state, T) {
  const { title, sub } = resultText(state), sc = TEXT_SCALES[state.textIdx], auto = state.scene === 'auto', P = RESULT.panel;
  ctx.save(); ctx.fillStyle = 'rgba(2,10,9,0.72)'; ctx.fillRect(0, 0, W, H);
  drawPanel(ctx, P, T, { round: 36 });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let tpx = Math.round(70 * Math.min(sc, 1.6)), tl;
  for (;;) { ctx.font = `700 ${tpx}px ${DISPLAY}`; tl = wrapLines(ctx, title, P.w - 100); if (tl.length * tpx * 1.1 <= RESULT.titleZone.h || tpx <= 24) break; tpx -= 2; }
  ctx.fillStyle = GOLD; tl.forEach((l, i) => ctx.fillText(l, W / 2, RESULT.titleZone.y + tpx * 0.95 + i * tpx * 1.1));
  const cy = RESULT.art.y + RESULT.art.h / 2 + 80, r = state.g.result;
  const rg = ctx.createRadialGradient(W / 2, cy - 60, 10, W / 2, cy - 60, 160); rg.addColorStop(0, 'rgba(255,214,120,0.5)'); rg.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = rg; ctx.fillRect(W / 2 - 170, cy - 230, 340, 340);
  const sp = Math.sin(state.t * 2) * 4;
  if (r.winner === 0) { drawPiece(ctx, KHUN, WHITE, W / 2 - 80, cy + sp, 1.35); drawPiece(ctx, KHUN, BLACK, W / 2 + 80, cy - sp, 1.35); }
  else drawPiece(ctx, KHUN, r.winner, W / 2, cy + sp, 1.9, { glow: 'rgba(255,224,150,0.9)' });
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

// ---- title ---------------------------------------------------------------------------------------------------------------------
const TIPS = ['A Khon steps forward or diagonally, but never backward or sideways.', 'Push your Bia to the sixth rank: each one becomes a Bia-ngai.', 'When no Bia remain, the count begins. Check the Count strip.', 'Two Rua can force mate against a lone Khun. One Ma often cannot.', 'The Met is slow but a good guard: keep it beside your Khun.', 'A Ma jumps over pieces, so it is strongest where the board is crowded.', 'Tap Think to see a strong move and the reason for it.', 'Gold and Ruby start with their Khun and Met on opposite files.'];
const SHOW = [KHUN, MET, KHON, MA, RUA, BIA, NGAI];
function renderHero(ctx, state, T) {
  const t = state.t;
  const sky = ctx.createLinearGradient(0, 0, 0, 640);
  sky.addColorStop(0, '#07201f'); sky.addColorStop(0.62, '#0e3d3a'); sky.addColorStop(1, 'rgba(20,86,79,0)');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 640);
  // a halo of gold behind the title
  const sg = ctx.createRadialGradient(W / 2, 190, 10, W / 2, 190, 360); sg.addColorStop(0, 'rgba(255,214,120,0.38)'); sg.addColorStop(0.5, 'rgba(255,190,90,0.12)'); sg.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, 560);
  // slowly turning ring of flame-leaves
  ctx.save(); ctx.translate(W / 2, 190); ctx.fillStyle = 'rgba(240,200,120,0.10)';
  for (let k = 0; k < 24; k++) { ctx.rotate(TAU / 24); flameLeaf(ctx, 0, -250, 74, 0); }
  ctx.restore();
  const rnd = lcg(9); ctx.fillStyle = 'rgba(255,240,210,0.8)';
  for (let i = 0; i < 36; i++) { const x = rnd() * W, y = rnd() * 150; ctx.globalAlpha = 0.2 + 0.5 * Math.abs(Math.sin(t * 0.8 + i)); ctx.beginPath(); ctx.arc(x, y, 1 + rnd() * 1.4, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  // the title
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,20,15,0.8)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
  const tg = ctx.createLinearGradient(0, 80, 0, 200); tg.addColorStop(0, '#fff3c4'); tg.addColorStop(0.55, '#f5cd6a'); tg.addColorStop(1, '#c8892c');
  ctx.fillStyle = tg; ctx.font = `700 ${fitFont(ctx, 'Makruk', 700, 172, 600, 60, DISPLAY)}px ${DISPLAY}`; ctx.fillText('Makruk', W / 2, 190);
  ctx.shadowColor = 'transparent'; ctx.fillStyle = '#ffeec4'; ctx.font = `400 34px ${FONT}`;
  const sub = 'T H A I   C H E S S'; fitFont(ctx, sub, 400, 31, 560, 16); ctx.fillText(sub, W / 2, 244);
  ctx.fillStyle = 'rgba(255,238,196,0.85)'; ctx.font = `400 30px ${FONT}`; ctx.fillText('หมากรุก', W / 2, 286);
  ctx.strokeStyle = 'rgba(255,230,170,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(170, 308); ctx.lineTo(550, 308); ctx.stroke();
  for (const dx of [-1, 0, 1]) { ctx.save(); ctx.translate(W / 2 + dx * 40, 308); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#ffeec4'; ctx.fillRect(-5, -5, 10, 10); ctx.restore(); }
  ctx.restore();
  // two rows of pieces facing each other on a lacquer shelf
  const shelf = (y, side) => {
    ctx.save(); rr(ctx, 40, y + 4, W - 80, 14, 7); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); rr(ctx, 40, y - 2, W - 80, 14, 7); const g = ctx.createLinearGradient(0, y, 0, y + 12); g.addColorStop(0, '#d8a94a'); g.addColorStop(1, '#8a5f1c'); ctx.fillStyle = g; ctx.fill(); ctx.restore();
    SHOW.forEach((tp, i) => { const x = 76 + i * 94, bob = Math.max(0, Math.sin(t * 2.4 - i * 0.9 + (side > 0 ? 0 : 1.7))) * 9; drawPiece(ctx, tp, side, x, y - 2 - bob, 0.74, { lift: bob / 10 }); });
  };
  shelf(470, WHITE); shelf(600, BLACK);
  ctx.save(); ctx.fillStyle = 'rgba(255,238,196,0.55)'; ctx.font = `400 21px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('Khun · Met · Khon · Ma · Rua · Bia · Bia-ngai', W / 2, 342); ctx.restore();
}
function renderTitle(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  renderHero(ctx, state, T);
  const tall = state.textIdx >= 3, R = titleRows(!!state.saved, tall), sc = tall ? TEXT_SCALES[state.textIdx] : Math.min(TEXT_SCALES[state.textIdx], 1.4);
  const cap = (base, max) => Math.round(Math.min(base * sc, tall ? max : 1e9));
  if (R.resume) drawButton(ctx, R.resume, 'Continue game', T, { px: cap(32, 44), active: true });
  drawButton(ctx, R.play, 'Play', T, { primary: true, px: cap(46, 60), sub: `vs the computer · ${LEVELS[state.level].name}`, subPx: cap(24, 32) });
  drawButton(ctx, R.two, 'Two Players', T, { px: cap(32, 46) });
  drawButton(ctx, R.learn, 'Learn', T, { px: cap(32, 44), sub: `${state.learned.length}/${LESSONS.length} lessons`, subPx: cap(21, 28) });
  drawButton(ctx, R.watch, 'Watch & Learn', T, { px: cap(30, 46) });
  drawButton(ctx, R.settings, 'Settings', T, { px: cap(32, 46) });
  drawButton(ctx, R.level, `Level: ${LEVELS[state.level].name}`, T, { px: cap(26, 44) });
  drawButton(ctx, R.side, `You play ${state.humanPref === BLACK ? 'Ruby' : 'Gold'}`, T, { px: cap(26, 44) });
  drawButton(ctx, R.howto, 'How to Play', T, { px: cap(24, 50) });
  drawButton(ctx, R.rules, 'Rules', T, { px: cap(26, 50) });
  drawButton(ctx, R.about, 'About', T, { px: cap(26, 50) });
  drawButton(ctx, TITLE_SOUND, '', T); drawIcon(ctx, state.sound ? 'sound' : 'mute', TITLE_SOUND.x + 60, TITLE_SOUND.y + 31, 30, T.ink);
  if (!tall) {
    const tp = { x: 50, y: R.bottom + 26, w: 620, h: 112 };
    drawPanel(ctx, tp, T, { round: 22, alpha: 0.7 });
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = GOLD; ctx.font = `700 22px ${FONT}`; ctx.fillText('T U T O R   T I P', W / 2, tp.y + 32);
    ctx.fillStyle = T.ink; ctx.font = `400 25px ${FONT}`; const tip = TIPS[Math.floor(state.t / 9) % TIPS.length]; textBlock(ctx, tip, W / 2, tp.y + 66, tp.w - 50, 30); ctx.restore();
  }
  ctx.save(); ctx.fillStyle = T.sub; ctx.globalAlpha = 0.8; ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`;
  ctx.fillText(state.progress.played ? `${state.progress.wins} wins in ${state.progress.played} games` : 'The chess of Thailand', W / 2, Math.min(H - 40, R.bottom + (tall ? 52 : 176)));
  ctx.restore();
}

// ---- reference pages (How to Play / About / Rules) ----------------------------------------------------------------------------------
function drawDiagram(ctx, state, d, cx, top, Sd) {
  const o = { S: Sd, F: Math.max(10, Math.round(Sd * 0.2)), f0: d.f0, f1: d.f1, r0: d.r0, r1: d.r1, inlay: false, round: 14, seed: 3, labels: false };
  const { w, h } = boardBox(o), x = cx - w / 2;
  const key = `diag:${state.theme}:${Sd}:${d.f0}${d.f1}${d.r0}${d.r1}`;
  baked(ctx, key, x, top, w, h, (c) => paintBoard(c, themeOf(state.theme), o), 1);
  const at = (s) => { const q = localSq(o, s & 7, s >> 3); return { x: x + q.x + Sd / 2, y: top + q.y + Sd / 2 }; };
  const k = (Sd / SQ) * PIECE_K * 1.12;
  for (const [s, p] of d.marks || []) { const q = at(s); if (p === 'x') { ring(ctx, q, Sd * 0.43, RED, 4, 0.95); continue; } ctx.beginPath(); ctx.arc(q.x, q.y, Sd * 0.17, 0, TAU); ctx.fillStyle = 'rgba(255,240,200,0.85)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(30,20,5,0.55)'; ctx.stroke(); }
  const order = [...d.pieces].sort((a, b) => (b[0] >> 3) - (a[0] >> 3));
  for (const [s, p] of order) { const q = at(s), type = Math.abs(p); drawPiece(ctx, type, p > 0 ? WHITE : BLACK, q.x, q.y + Sd * 0.42, k); }
  for (const [a, b] of d.arrows || []) drawArrow(ctx, at(a), at(b), GOLD, Math.max(4, Sd * 0.09), Math.max(10, Sd * 0.2), Sd * 0.3);
  for (const s of d.rings || []) ring(ctx, at(s), Sd * 0.42, RED, 4, 0.95);
  return h;
}
const diagS = (d, scale) => Math.min(Math.round(d.S * (scale <= 1 ? 1.5 : scale <= 1.5 ? 1.25 : scale <= 2 ? 1 : scale <= 2.5 ? 0.75 : 0.6)), Math.floor(580 / (d.f1 - d.f0 + 1.4)));
const diagHeight = (d, scale) => { const S = diagS(d, scale); return boardBox({ S, F: Math.max(10, Math.round(S * 0.2)), f0: d.f0, f1: d.f1, r0: d.r0, r1: d.r1 }).h; };
export function pageLayout(ctx, entry, scale) {
  const maxW = REF_PANEL.w - 80, titlePx = Math.round(38 * Math.min(scale, 1.3));
  ctx.font = `700 ${titlePx}px ${DISPLAY}`;
  const titleLines = wrapLines(ctx, entry.title, REF_PANEL.w - 80).length;
  const diagH = entry.diagram ? diagHeight(entry.diagram, scale) + 24 : 0;
  const avail = REF_PANEL.h - 66 - titleLines * titlePx * 1.15 - 30 - diagH - 20;
  let px = Math.round(30 * scale * (scale <= 1.5 ? 1.25 : 1)), lines;
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
  ctx.font = `700 ${titlePx}px ${DISPLAY}`;
  const tH = wrapLines(ctx, entry.title, panel.w - 80).length * titlePx * 1.15, dH = entry.diagram ? diagHeight(entry.diagram, scale) + 24 : 0;
  const bH = lines.reduce((a, l) => a + px * 1.28 + (l.end ? px * 0.32 : 0), 0) + px;
  const extra = Math.max(0, panel.h - 66 - 30 - tH - dH - bH);
  let y = panel.y + 66 + extra * 0.3;
  ctx.fillStyle = GOLD; ctx.font = `700 ${titlePx}px ${DISPLAY}`;
  y += titlePx * 1.05; wrapLines(ctx, entry.title, panel.w - 80).forEach((l) => { ctx.fillText(l, W / 2, y); y += titlePx * 1.15; }); y -= titlePx * 0.15;
  if (entry.diagram) { y += 12; const d = entry.diagram, Sd = diagS(d, scale); drawDiagram(ctx, state, d, W / 2, y, Sd); y += diagHeight(d, scale) + 12; }
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

// ---- settings -----------------------------------------------------------------------------------------------------------------
function renderSettings(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  const tall = state.textIdx >= 3;
  ctx.save(); ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 58px ${DISPLAY}`; ctx.fillText('Settings', W / 2, 80); ctx.restore();
  const sc = tall ? TEXT_SCALES[state.textIdx] : Math.min(TEXT_SCALES[state.textIdx], 1.5);
  const rows = [
    ['Sound', state.sound ? 'On' : 'Off'],
    ['Difficulty', LEVELS[state.level].name, LEVELS[state.level].blurb],
    ['You play', state.humanPref === BLACK ? 'Ruby' : 'Gold', 'Gold moves first'],
    ['Board', themeOf(state.theme).name],
    ['Threat marks', state.danger ? 'On' : 'Off', 'Rings your pieces that could be taken next'],
    ['Think time', `${THINK_STEPS[state.thinkIdx]} s`, 'Watch & Learn. Tap to cycle: 2, 5, 8, 10'],
    ['Text size', `${Math.round(TEXT_SCALES[state.textIdx] * 100)}%`, 'Tap to cycle: 100% to 300%'],
  ];
  rows.forEach((r, i) => {
    const rect = SETTINGS_ROW(i, tall);
    drawButton(ctx, rect, '', T);
    ctx.save(); ctx.textBaseline = 'middle'; ctx.fillStyle = T.ink; ctx.textAlign = 'left';
    const sub = r[2], titleY = sub ? rect.h * (tall ? 0.24 : 0.3) : rect.h * 0.5, capT = tall ? 60 : 1e9;
    ctx.textAlign = 'right'; ctx.fillStyle = GOLD; fitFont(ctx, r[1], 700, Math.min(Math.round(32 * sc), capT), rect.w * 0.42, 14); const vw = ctx.measureText(r[1]).width; ctx.fillText(r[1], rect.x + rect.w - 28, rect.y + titleY);
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
  void SETTINGS_ROWS;
}

// ---- Watch & Learn ----------------------------------------------------------------------------------------------------------------
function renderAuto(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  header(ctx, state, T, 'Watch & Learn');
  plates(ctx, state, T);
  drawBoardScene(ctx, state, T);
  countStrip(ctx, state, T);
  message(ctx, state, T);
  const ap = state.ap;
  drawButton(ctx, AUTO.exit, 'Exit', T, { px: 30 });
  drawButton(ctx, AUTO.pause, '', T, { primary: state.apPaused });
  drawIcon(ctx, state.apPaused ? 'play' : 'pause', AUTO.pause.x + 48, AUTO.pause.y + AUTO.pause.h / 2, 38, state.apPaused ? T.accentText : T.ink);
  ctx.save(); ctx.fillStyle = state.apPaused ? T.accentText : T.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `700 30px ${FONT}`; ctx.fillText(state.apPaused ? 'Resume' : 'Pause', AUTO.pause.x + 82, AUTO.pause.y + AUTO.pause.h / 2 + 1); ctx.restore();
  drawButton(ctx, AUTO.dec, '-', T, { px: 48, disabled: state.thinkIdx === 0 }); drawButton(ctx, AUTO.inc, '+', T, { px: 48, disabled: state.thinkIdx === THINK_STEPS.length - 1 });
  ctx.save(); ctx.fillStyle = T.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 30px ${FONT}`; ctx.fillText(`${THINK_STEPS[state.thinkIdx]}s`, AUTO.val.x + AUTO.val.w / 2, AUTO.val.y + AUTO.val.h * 0.38);
  ctx.font = `400 19px ${FONT}`; ctx.fillStyle = T.sub; ctx.fillText('think time', AUTO.val.x + AUTO.val.w / 2, AUTO.val.y + AUTO.val.h * 0.74); ctx.restore();
  const ph = ap && ap.phase;
  const label = state.apPaused ? 'PAUSED' : ph === 'think' ? `THINK  ${Math.max(0, Math.ceil(ap.timer))}s` : ph === 'reveal' ? 'REVEAL' : ph === 'act' ? 'ACT' : '';
  infoStrip(ctx, state, T, `${label}   ·   THINK, then REVEAL the options and the choice, then ACT`);
  banner(ctx, state);
  if (state.g.result && state.overOpen) renderResult(ctx, state, T);
}

// ---- Learn --------------------------------------------------------------------------------------------------------------------------
function renderLearn(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  const L = LESSONS[state.lesson.i];
  header(ctx, state, T, 'Learn');
  const r = { x: 18, y: 104, w: W - 36, h: 70 }; drawPanel(ctx, r, T, { round: 20 });
  ctx.save(); ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const label = `${state.lesson.i + 1}/${LESSONS.length}  ${L.title}`; fitFont(ctx, label, 700, 34, r.w - 40, 16); ctx.fillText(label, W / 2, r.y + r.h / 2 + 1); ctx.restore();
  drawBoardScene(ctx, state, T);
  const n = names(state);
  plate(ctx, PLATE_BOT, n.bot, 'You', 'Gold', state.g.turn === WHITE && !state.g.result, T, state, false, true);
  if (L.play) countStrip(ctx, state, T); else goalStrip(ctx, state, T, L);
  message(ctx, state, T);
  const done = state.lesson.done;
  drawButton(ctx, LEARN_BAR.menu, 'Menu', T, { px: 28 });
  drawButton(ctx, LEARN_BAR.hint, 'Show me', T, { px: 26, disabled: done });
  drawButton(ctx, LEARN_BAR.reset, 'Reset', T, { px: 28 });
  drawButton(ctx, LEARN_BAR.next, state.lesson.i === LESSONS.length - 1 && done ? 'Finish' : 'Next', T, { primary: done, px: 32, disabled: !done && !state.learned.includes(state.lesson.i) });
  infoStrip(ctx, state, T, done ? 'Lesson complete' : 'Make the move described above');
  banner(ctx, state);
}

function renderLimit(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  const r = LIMIT.panel, sc = TEXT_SCALES[state.textIdx];
  drawPanel(ctx, r, T, { round: 34 });
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = GOLD;
  fitFont(ctx, 'That was the free taste', 700, 58, r.w - 60, 26, DISPLAY); ctx.fillText('That was the free taste', W / 2, r.y + 100);
  const text = 'Get the full game on iPhone and Android: every level, two-player games, and all the lessons.';
  let px = Math.round(32 * Math.min(sc, 2.4)), lines;
  for (;;) { ctx.font = `400 ${px}px ${FONT}`; lines = wrapLines(ctx, text, r.w - 80); if (lines.length * px * 1.3 <= LIMIT.btn.y - (r.y + 140) - 20 || px <= 18) break; px -= 1; }
  ctx.fillStyle = T.ink; ctx.textBaseline = 'alphabetic'; lines.forEach((l, i) => ctx.fillText(l, W / 2, r.y + 150 + px + i * px * 1.3));
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
    case 'howto': case 'about': case 'rules': renderPage(ctx, state, pageContent(state.scene), state.scene === 'howto' ? 'How to play' : state.scene === 'about' ? 'About Makruk' : 'Rules', T); break;
    case 'demo-limit': renderLimit(ctx, state, T); break;
    default: renderTitle(ctx, state, T);
  }
}
export { sqName, TYPE_NAME, LIMIT_TABLE, THEMES, easeOut, BAR_Y, BAR_H, PROMO_BANNER, AMBER, CYAN };
