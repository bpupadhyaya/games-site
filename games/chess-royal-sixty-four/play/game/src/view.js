// All drawing. Pure: reads `state`, never mutates it (game.js owns every mutation).
import {
  W, H, HEADER_H, GRID_X, GRID_Y, SQ, BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_BOTTOM,
  TRAY_TOP, TRAY_H, PANEL_TOP, PANEL_H, BAR_TOP, BAR_H, pointXY, squareTopLeft, titleRows, TITLE_BOARD, BTN, BTN4, HEADER,
  RESULT_PANEL, PROMO, inRect, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, DEMO_THINK,
} from './layout.js';
import { WHITE, BLACK, TYPE_NAME, QUEEN, ROOK, BISHOP, KNIGHT, PAWN, KING, inCheck } from './rules.js';
import { LEVELS, LEVEL_COUNT } from './engine.js';
import { LESSONS } from './lessons.js';
import { DEMO_GAMES } from './demo.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { drawBoard, drawBackdrop, boardThemeOf, THEME_NAMES, drawDot, drawCaptureRing, drawCornerMarks, drawCheckGlow, drawSelectGlow } from './art.js';
import { drawPiece, FLOOR_LINE } from './pieces.js';

// [square, type, white] — the title's key-art position (a1 = 0, h8 = 63).
const HERO_POSITION = [
  [0, ROOK, true], [3, QUEEN, true], [6, KING, true], [8, PAWN, true], [9, PAWN, true], [13, PAWN, true], [14, PAWN, true], [15, PAWN, true],
  [26, BISHOP, true], [28, ROOK, true], [35, PAWN, true], [38, KNIGHT, true],
  [56, ROOK, false], [58, BISHOP, false], [59, QUEEN, false], [61, ROOK, false], [62, KING, false],
  [48, PAWN, false], [49, PAWN, false], [50, PAWN, false], [52, KNIGHT, false], [53, PAWN, false], [54, PAWN, false], [55, PAWN, false], [43, PAWN, false],
];
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };


function drawButton(ctx, r, label, opts = {}) {
  const { active = false, disabled = false, primary = false, sub } = opts;
  ctx.save();
  const rad = 16;
  roundPath(ctx, r.x, r.y, r.w, r.h, rad);
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  if (disabled) { g.addColorStop(0, '#3a352c'); g.addColorStop(1, '#241f19'); }
  else if (primary) { g.addColorStop(0, '#e8c876'); g.addColorStop(1, '#b98d3a'); }
  else if (active) { g.addColorStop(0, '#7a5a34'); g.addColorStop(1, '#4a3620'); }
  else { g.addColorStop(0, '#4a4038'); g.addColorStop(1, '#2b241d'); }
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = primary ? 'rgba(255,240,200,0.7)' : 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = disabled ? 'rgba(255,255,255,0.35)' : primary ? '#2b1c06' : '#f4ead6';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = sub ? 24 : 28;
  const maxW = r.w - 20;
  ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
  while (ctx.measureText(label).width > maxW && size > 14) { size -= 2; ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`; }
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 - (sub ? 10 : 0));
  if (sub) { ctx.font = '400 19px Georgia, serif'; ctx.globalAlpha = 0.85; ctx.fillText(sub, r.x + r.w / 2, r.y + r.h / 2 + 18); ctx.globalAlpha = 1; }
  ctx.restore();
}
function roundPath(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function pieceR() { return SQ * 0.40; }
// Device pixels per virtual pixel of the current canvas (the kit sets the transform before render),
// rounded to a half so sprites are baked for at most a handful of resolutions.
let ART_RES = 2;
function artRes(ctx) {
  try { const a = typeof ctx.getTransform === 'function' ? ctx.getTransform().a : 2; return Math.min(3, Math.max(1, Math.ceil(a * 2) / 2)); } catch { return 2; }
}
const P = (o) => ({ ...o, res: ART_RES });

// ---- board + pieces (shared by play / lesson / demo) --------------------------------------------
function drawGameBoard(ctx, state, flip) {
  const T = boardThemeOf(state.boardTheme);
  drawBoard(ctx, state.boardTheme, flip, ART_RES);
  const g = state.g, board = g.st.board;
  const anim = state.anim;

  // last-move corner marks
  if (state.last && !(anim && anim.type === 'move')) {
    const a = squareTopLeft(state.last.f, flip), b = squareTopLeft(state.last.t, flip);
    drawCornerMarks(ctx, a.x, a.y, 'rgba(255,214,120,0.55)');
    drawCornerMarks(ctx, b.x, b.y, 'rgba(255,214,120,0.75)');
  }
  // selection glow
  if (state.sel >= 0) { const tl = squareTopLeft(state.sel, flip); drawSelectGlow(ctx, tl.x, tl.y); }
  // legal-move markers
  for (const t of state.targets) {
    const p = pointXY(t, flip);
    if (board[t] !== 0) drawCaptureRing(ctx, p.x, p.y); else drawDot(ctx, p.x, p.y);
  }
  // AI-vs-AI demo's REVEAL phase: the move the engine actually chose, marked distinctly brighter
  // and pulsing gold so it reads clearly against the plain dots/rings marking every OTHER legal
  // destination for the same piece (state.targets, above) — the viewer compares their own guess
  // against this one square.
  if (state.demoChosen >= 0) {
    const p = pointXY(state.demoChosen, flip), pulse = (Math.sin(state.t * 6) + 1) / 2;
    ctx.save();
    ctx.fillStyle = `rgba(255,205,60,${0.28 + pulse * 0.12})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, SQ * 0.46, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,225,120,${0.85 + pulse * 0.15})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(p.x, p.y, SQ * 0.46, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // hint
  if (state.hint) {
    const a = pointXY(state.hint.from, flip), b = pointXY(state.hint.to, flip);
    ctx.save(); ctx.strokeStyle = 'rgba(255,205,60,0.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,205,60,0.28)'; ctx.beginPath(); ctx.arc(b.x, b.y, SQ * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // check glow under the checked king
  if (!g.result && inCheck(g.st)) {
    const ksq = g.st.turn === WHITE ? g.st.wk : g.st.bk;
    const p = pointXY(ksq, flip), pulse = (Math.sin(state.t * 4) + 1) / 2;
    drawCheckGlow(ctx, p.x, p.y, pulse);
  } else if (g.result && g.result.why === 'checkmate') {
    const loser = g.result.winner === 0 ? null : -g.result.winner;
    if (loser !== null) { const ksq = loser === WHITE ? g.st.wk : g.st.bk; const p = pointXY(ksq, flip); drawCheckGlow(ctx, p.x, p.y, 0.9); }
  }

  // pieces (skip the one mid-animation or being dragged; drawn on top afterward). Painter's
  // algorithm: draw back-to-front by screen Y, so a tall piece in front (e.g. a king on the
  // near rank) correctly overlaps the piece behind it, instead of a raw board-index draw order
  // occasionally letting the far piece paint over the near piece's tall top.
  const R = pieceR();
  const animTo = anim && anim.type === 'move' ? anim.to : -1;
  const dragSq = state.drag ? state.drag.sq : -1;
  const order = [];
  for (let s = 0; s < 64; s++) { if (board[s] && s !== animTo && s !== dragSq && !(anim && anim.type === 'refuse' && s === anim.from)) order.push(s); }
  order.sort((a, b) => pointXY(a, flip).y - pointXY(b, flip).y);
  for (const s of order) {
    const p = board[s], pt = pointXY(s, flip);
    drawPiece(ctx, Math.abs(p), p > 0, pt.x, pt.y + SQ * FLOOR_LINE, P({ R, theme: state.boardTheme }));
  }
  // the animated piece
  if (anim && anim.type === 'move') {
    const tt = Math.min(1, anim.t / anim.dur), e = easeOutCubic(tt);
    const a = pointXY(anim.from, flip), b = pointXY(anim.to, flip);
    const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
    drawPiece(ctx, Math.abs(anim.piece), anim.piece > 0, x, y + SQ * FLOOR_LINE, P({ R, theme: state.boardTheme, lift: Math.sin(Math.PI * tt) * 0.5 }));
  } else if (anim && anim.type === 'refuse') {
    const tt = Math.min(1, anim.t / anim.dur);
    const shake = Math.sin(tt * Math.PI * 6) * (1 - tt) * 10;
    const a = pointXY(anim.from, flip);
    drawPiece(ctx, Math.abs(anim.piece), anim.piece > 0, a.x + shake, a.y + SQ * FLOOR_LINE, P({ R, theme: state.boardTheme }));
  }
  // dragged piece follows the pointer, lifted
  if (state.drag) {
    const p = board[state.drag.sq];
    if (p) drawPiece(ctx, Math.abs(p), p > 0, state.drag.x, state.drag.y + SQ * 0.1, P({ R: R * 1.08, theme: state.boardTheme, lift: 1 }));
  }
  // capture particles / rings
  for (const q of state.parts) { ctx.globalAlpha = Math.max(0, 1 - q.t / q.max); ctx.fillStyle = `rgb(${q.c})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  for (const r of state.rings) { const t = r.t / 0.5; ctx.strokeStyle = `rgba(255,210,140,${1 - t})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, SQ * 0.3 + t * SQ * 0.7, 0, Math.PI * 2); ctx.stroke(); }
}

function capturedLists(g) {
  const white = [], black = []; // white = pieces White has captured (black material); black = vice versa
  for (const e of g.log) { if (e.cap && e.undo && e.undo.captured) { const c = e.undo.captured; if (c > 0) black.push(c); else white.push(-c); } }
  const order = (a, b) => b - a;
  return { byWhite: white.sort(order), byBlack: black.sort(order) };
}
function drawTray(ctx, x, y, w, pieces, white, theme) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, TRAY_H); ctx.clip();
  let px = x + 22;
  for (const t of pieces) { drawPiece(ctx, t, white, px, y + TRAY_H * 0.78, P({ R: 16, theme })); px += 26; }
  ctx.restore();
}
function materialDelta(g) {
  const VAL = { [PAWN]: 1, [KNIGHT]: 3, [BISHOP]: 3, [ROOK]: 5, [QUEEN]: 9 };
  let v = 0; for (const s of g.st.board) if (s) v += (s > 0 ? 1 : -1) * (VAL[Math.abs(s)] || 0);
  return v;
}

function drawMoveList(ctx, state) {
  const x = 30, y = PANEL_TOP, w = W - 60, h = PANEL_H;
  ctx.save();
  roundPath(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(20,14,8,0.42)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.clip();
  const log = state.g.log;
  ctx.font = '20px Georgia, serif'; ctx.fillStyle = 'rgba(244,234,214,0.92)'; ctx.textBaseline = 'top';
  const lineH = 27, cols = 2, colW = w / cols, rowsPerCol = Math.floor((h - 16) / lineH);
  const pairs = []; for (let i = 0; i < log.length; i += 2) pairs.push([log[i], log[i + 1]]);
  const totalRows = pairs.length, maxVisible = rowsPerCol * cols;
  const startPair = Math.max(0, totalRows - maxVisible);
  for (let i = startPair; i < totalRows; i++) {
    const rel = i - startPair, col = Math.floor(rel / rowsPerCol), row = rel % rowsPerCol;
    const tx = x + 14 + col * colW, ty = y + 10 + row * lineH;
    const [a, b] = pairs[i];
    const text = `${i + 1}. ${a ? a.san : ''}${b ? '  ' + b.san : ''}`;
    ctx.fillText(text, tx, ty);
  }
  if (log.length === 0) { ctx.globalAlpha = 0.6; ctx.fillText('Moves will appear here.', x + 14, y + 10); ctx.globalAlpha = 1; }
  ctx.restore();
}

function drawTopBar(ctx, state, title) {
  ctx.save();
  ctx.font = '700 30px Georgia, serif'; ctx.fillStyle = '#f4ead6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(title, W / 2, 40);
  ctx.font = '400 20px Georgia, serif'; ctx.globalAlpha = 0.8;
  const g = state.g;
  const status = g.result ? resultText(g.result, state) : `${g.st.turn === WHITE ? 'White' : 'Black'} to move${state.thinking ? '  ·  thinking…' : ''}`;
  ctx.fillText(status, W / 2, 78);
  ctx.globalAlpha = 1;
  ctx.restore();
}
function resultText(r, state) {
  if (r.why === 'checkmate') return `Checkmate — ${r.winner === WHITE ? 'White' : 'Black'} wins`;
  if (r.why === 'resign') return `${r.winner === WHITE ? 'Black' : 'White'} resigned`;
  if (r.why === 'stalemate') return 'Draw by stalemate';
  if (r.why === 'fifty-move') return 'Draw — 50-move rule';
  if (r.why === 'repetition') return 'Draw by repetition';
  if (r.why === 'insufficient-material') return 'Draw — insufficient material';
  return 'Draw';
}

// ---- scenes ---------------------------------------------------------------------------------------
function renderTitle(ctx, state) {
  drawBackdrop(ctx, state.boardTheme, boardThemeOf(state.boardTheme).bg);
  const t = state.t, themeName = state.boardTheme;

  // Title, above the hero board.
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#f7ecd6';
  ctx.font = '700 58px Georgia, "Times New Roman", serif'; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 14;
  ctx.fillText('Chess', W / 2, TITLE_BOARD.y + 44);
  ctx.shadowBlur = 0; ctx.font = '400 21px Georgia, serif'; ctx.globalAlpha = 0.88; ctx.fillStyle = '#e7d3a6';
  ctx.fillText('The timeless game of sixty-four squares', W / 2, TITLE_BOARD.y + 76);
  ctx.globalAlpha = 1; ctx.restore();

  // Key art: a window onto a lit board in the middle of a game (a real, sensible position — a
  // classical Italian after the centre has opened), scaled to fit the banner under the title.
  const bandTop = TITLE_BOARD.y + 96, bandH = TITLE_BOARD.y + TITLE_BOARD.h - bandTop;
  const scale = (TITLE_BOARD.w + 40) / BOARD_SIZE, ox = W / 2 - (BOARD_SIZE / 2) * scale, oy = bandTop + bandH / 2 - (BOARD_Y + BOARD_SIZE * 0.52) * scale;
  ctx.save();
  ctx.beginPath(); ctx.rect(TITLE_BOARD.x - 10, bandTop - 6, TITLE_BOARD.w + 20, bandH + 12); ctx.clip();
  ctx.translate(ox, oy); ctx.scale(scale, scale);
  drawBoard(ctx, themeName, false, ART_RES);
  const order = HERO_POSITION.slice().sort((a, b) => pointXY(a[0], false).y - pointXY(b[0], false).y);
  for (const [sq, type, white] of order) {
    const pt = pointXY(sq, false), bob = white ? 0 : Math.sin(t * 0.9 + sq) * 0.8;
    drawPiece(ctx, type, white, pt.x, pt.y + SQ * FLOOR_LINE + bob, P({ R: pieceR(), theme: themeName }));
  }
  // soft ambient light sweep
  const sweepX = ((t * 44) % (BOARD_SIZE + 400)) - 200;
  const sg = ctx.createLinearGradient(sweepX, 0, sweepX + 220, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,244,220,0.10)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg; ctx.fillRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);
  ctx.restore();
  // fade the window's top and bottom edges into the table
  const eg = ctx.createLinearGradient(0, bandTop - 6, 0, bandTop + bandH + 6);
  eg.addColorStop(0, 'rgba(20,12,6,0.85)'); eg.addColorStop(0.12, 'rgba(20,12,6,0)'); eg.addColorStop(0.88, 'rgba(20,12,6,0)'); eg.addColorStop(1, 'rgba(20,12,6,0.85)');
  ctx.fillStyle = eg; ctx.fillRect(TITLE_BOARD.x - 10, bandTop - 6, TITLE_BOARD.w + 20, bandH + 12);
  // vignette so buttons below read as clearly separate from the key art
  const vg = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH + 40);
  vg.addColorStop(0.8, 'rgba(15,10,6,0)'); vg.addColorStop(1, 'rgba(15,10,6,0.9)');
  ctx.fillStyle = vg; ctx.fillRect(0, bandTop, W, bandH + 40);

  const rows = titleRows(false);
  drawButton(ctx, rows.playWhite, 'Play as White', { primary: true });
  drawButton(ctx, rows.playBlack, 'Play as Black');
  drawButton(ctx, rows.twoPlayer, 'Two Players (Pass and Play)');
  drawButton(ctx, rows.watch, 'Watch Two Full Games (AI vs AI)');
  drawButton(ctx, rows.learn, `Learn to Play${state.learned.length ? ` (${state.learned.length}/${LESSONS.length})` : ''}`);
  drawButton(ctx, rows.howto, 'Controls');
  drawButton(ctx, rows.about, 'About');
  drawButton(ctx, rows.rules, 'Rules');
  drawButton(ctx, rows.level, `Opponent: ${LEVELS[state.level].name}`, { sub: `${state.level} of ${LEVEL_COUNT}` });
  drawButton(ctx, rows.theme, `Board: ${THEME_NAMES[state.boardTheme]}`);
  drawButton(ctx, HEADER.sound, state.sound ? 'Sound: On' : 'Sound: Off', { active: state.sound });

  ctx.save(); ctx.textAlign = 'center'; ctx.globalAlpha = 0.55; ctx.fillStyle = '#e7d3a6'; ctx.font = '400 18px Georgia, serif';
  ctx.fillText('Free to play, forever. No ads, no purchases.', W / 2, H - 26);
  ctx.restore();
}

function renderPlay(ctx, state) {
  drawBackdrop(ctx, state.boardTheme, boardThemeOf(state.boardTheme).bg);
  const flip = (state.mode === 'ai' && state.human === BLACK) || state.flipManual;
  const showingResult = state.overOpen && state.g.result;
  drawTopBar(ctx, state, state.mode === 'two' ? 'Two Players' : `Playing White vs ${LEVELS[state.level].name}`.replace('White', state.human === WHITE ? 'White' : 'Black'));
  drawGameBoard(ctx, state, flip);
  if (!showingResult) {
    const mat = materialDelta(state.g);
    const { byWhite, byBlack } = capturedLists(state.g);
    drawTray(ctx, 30, TRAY_TOP, W - 60, byBlack, false, state.boardTheme);
    drawTray(ctx, 30, TRAY_TOP + TRAY_H, W - 60, byWhite, true, state.boardTheme);
    ctx.save(); ctx.font = '600 20px Georgia, serif'; ctx.fillStyle = 'rgba(244,234,214,0.85)'; ctx.textAlign = 'right';
    if (mat !== 0) ctx.fillText(mat > 0 ? `White +${mat}` : `Black +${-mat}`, W - 30, TRAY_TOP + 24);
    ctx.restore();
    drawMoveList(ctx, state);
    drawButton(ctx, BTN.menu, 'Menu');
    drawButton(ctx, BTN.flip, 'Flip');
    drawButton(ctx, BTN.undo, 'Undo', { disabled: state.g.log.length === 0 });
    drawButton(ctx, BTN.hint, `Hint (${state.hintsLeft})`, { disabled: state.hintsLeft <= 0 });
    drawButton(ctx, BTN.resign, state.g.result ? 'New Game' : 'Resign');
    if (state.banner) drawBanner(ctx, state);
    if (state.hint) drawHintReason(ctx, state.hint);
    if (state.msg) drawMessage(ctx, state.msg);
    else if (state.coachBubble) drawCoach(ctx, state.coachBubble);
  }
  if (state.promoPending) drawPromoPicker(ctx, state);
  if (showingResult) drawResultPanel(ctx, state);
}

// A transient banner over the TOP of the board (same slot as the first-use coach bubble, which is
// suppressed while a message is showing) — there is no safe empty space left below the board once
// the trays and move list are both present, and this reads better as a toast anyway.
function drawMessage(ctx, msg) {
  const alpha = Math.max(0, 1 - msg.t / 3.4);
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha;
  const x = 30, y = HEADER_H - 6, w = W - 60, h = 74;
  const warn = msg.kind === 'warn', good = msg.kind === 'good';
  roundPath(ctx, x, y, w, h, 14);
  ctx.fillStyle = warn ? 'rgba(74,26,18,0.93)' : good ? 'rgba(20,54,24,0.93)' : 'rgba(46,34,18,0.93)'; ctx.fill();
  ctx.strokeStyle = warn ? 'rgba(255,150,120,0.55)' : good ? 'rgba(150,230,140,0.5)' : 'rgba(255,214,120,0.45)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = '400 20px Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillStyle = warn ? '#ffb199' : good ? '#b7f0b0' : '#f4ead6';
  wrapText(ctx, msg.text, W / 2, y + 30, w - 40, 25);
  ctx.restore();
}
function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' '); let line = '', ly = y;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, cx, ly); line = w; ly += lh; } else line = t; }
  ctx.fillText(line, cx, ly);
}
function drawBanner(ctx, state) {
  const b = state.banner, tt = Math.min(1, b.t / 0.35), scale = easeOutBack(tt);
  ctx.save(); ctx.translate(W / 2, BOARD_Y + BOARD_SIZE / 2); ctx.scale(scale, scale);
  ctx.globalAlpha = Math.max(0, 1 - Math.max(0, b.t - 1.1) / 0.5);
  ctx.font = '700 54px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 20;
  ctx.fillStyle = b.text === 'Checkmate' ? '#ffe6a8' : b.text === 'Check' ? '#ffb199' : '#e7d3a6';
  ctx.fillText(b.text, 0, 0);
  ctx.restore();
}
function drawHintReason(ctx, hint) {
  ctx.save(); ctx.font = '400 19px Georgia, serif'; ctx.fillStyle = '#ffd97a'; ctx.textAlign = 'center';
  ctx.fillText(hint.reason || '', W / 2, BOARD_BOTTOM + 22);
  ctx.restore();
}
function drawPromoPicker(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
  const c = PROMO.card;
  roundPath(ctx, c.x, c.y, c.w, c.h, 22);
  const g = ctx.createLinearGradient(c.x, c.y, c.x, c.y + c.h); g.addColorStop(0, '#3a2c1c'); g.addColorStop(1, '#1c1309');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,214,150,0.4)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = '700 28px Georgia, serif'; ctx.fillStyle = '#f4ead6'; ctx.textAlign = 'center';
  ctx.fillText('Choose a piece', c.x + c.w / 2, c.y + 46);
  const white = state.g.st.board[state.promoPending.from] > 0;
  const types = [QUEEN, ROOK, BISHOP, KNIGHT];
  PROMO.pieces.forEach((r, i) => {
    roundPath(ctx, r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    drawPiece(ctx, types[i], white, r.x + r.w / 2, r.y + r.h * 0.72, P({ R: 30, theme: state.boardTheme }));
    ctx.font = '400 17px Georgia, serif'; ctx.fillStyle = '#e7d3a6';
    ctx.fillText(TYPE_NAME[types[i]][0].toUpperCase() + TYPE_NAME[types[i]].slice(1), r.x + r.w / 2, r.y + r.h + 22);
  });
  ctx.restore();
}
function drawResultPanel(ctx, state) {
  const r = state.g.result;
  ctx.save();
  const top = BOARD_Y + BOARD_SIZE * 0.32;
  ctx.fillStyle = 'rgba(10,7,4,0.86)'; ctx.fillRect(0, top, W, H - top);
  ctx.font = '700 42px Georgia, serif'; ctx.fillStyle = r.why === 'checkmate' ? '#ffe6a8' : '#f4ead6'; ctx.textAlign = 'center';
  wrapText(ctx, resultText(r, state), W / 2, top + 90, W - 100, 48);
  ctx.font = '400 20px Georgia, serif'; ctx.globalAlpha = 0.8;
  ctx.fillText(state.mode === 'two' ? 'Two Players' : `vs ${LEVELS[state.level].name}`, W / 2, top + 150);
  ctx.globalAlpha = 1;
  drawButton(ctx, RESULT_PANEL.again, 'New Game', { primary: true });
  drawButton(ctx, RESULT_PANEL.menu, 'Menu');
  ctx.restore();
}
function drawCoach(ctx, bubble) {
  ctx.save(); ctx.globalAlpha = Math.min(1, 4 - bubble.t) > 1 ? 1 : Math.max(0, Math.min(1, 6 - bubble.t));
  const x = 30, y = HEADER_H - 6, w = W - 60, h = 74;
  roundPath(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(60,44,20,0.92)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,120,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = '400 19px Georgia, serif'; ctx.fillStyle = '#ffe9bd'; ctx.textAlign = 'center';
  wrapText(ctx, bubble.text, W / 2, y + 26, w - 40, 24);
  ctx.restore();
}

function renderLesson(ctx, state) {
  drawBackdrop(ctx, state.boardTheme, ['#182018', '#0a0d09']);
  const L = state.lesson, lesson = LESSONS[L.i], step = lesson.steps[L.s];
  drawTopBar(ctx, state, `${lesson.title}  (${L.s + 1}/${lesson.steps.length})`);
  drawGameBoard(ctx, state, state.flipManual);
  ctx.save(); ctx.font = '400 21px Georgia, serif'; ctx.fillStyle = '#e7f0d6'; ctx.textAlign = 'center';
  wrapText(ctx, step.minigame ? step.text : (L.done ? 'Well done — tap Next to continue.' : step.text), W / 2, BOARD_BOTTOM + 26, W - 80, 27);
  ctx.restore();
  if (state.msg) drawMessage(ctx, state.msg);
  if (state.banner) drawBanner(ctx, state);
  if (L.showSol && !L.done) { ctx.save(); ctx.font = '400 19px Georgia, serif'; ctx.fillStyle = '#ffd97a'; ctx.textAlign = 'center'; wrapText(ctx, step.hint, W / 2, BOARD_BOTTOM + TRAY_H * 2 + 10, W - 90, 24); ctx.restore(); }
  drawButton(ctx, BTN4.menu, 'Menu');
  drawButton(ctx, BTN4.flip, 'Flip');
  drawButton(ctx, BTN4.hint, 'Show hint');
  drawButton(ctx, BTN4.next, L.done ? (L.s + 1 < lesson.steps.length ? 'Next' : 'Next Lesson') : 'Restart step', { primary: L.done });
  if (state.promoPending) drawPromoPicker(ctx, state);
}

function renderDemo(ctx, state) {
  drawBackdrop(ctx, state.boardTheme, ['#161220', '#08060a']);
  const cfg = DEMO_GAMES[state.demoIdx];
  drawTopBar(ctx, state, cfg.name);
  drawGameBoard(ctx, state, false);
  drawMoveList(ctx, state);
  ctx.save(); ctx.font = '400 19px Georgia, serif'; ctx.fillStyle = '#cbb9e0'; ctx.textAlign = 'center';
  ctx.fillText(`${state.demoIdx + 1} of ${DEMO_GAMES.length}  ·  White: ${LEVELS[cfg.levels[0]].name}   Black: ${LEVELS[cfg.levels[1]].name}`, W / 2, TRAY_TOP + 20);
  ctx.restore();
  // The teaching-loop caption: invites a guess while THINK is running (with a live countdown so
  // the viewer knows how long they have), then names the reveal once the answer is shown.
  if (!state.g.result) {
    ctx.save(); ctx.font = '700 22px Georgia, serif'; ctx.textAlign = 'center';
    if (state.demoPhase === 'reveal') { ctx.fillStyle = '#ffd97a'; ctx.fillText('The engine plays…', W / 2, 108); }
    else if (state.demoPhase === 'think') { ctx.fillStyle = '#cbb9e0'; ctx.fillText(`Guess the move… ${Math.max(0, Math.ceil(state.demoTimer))}s`, W / 2, 108); }
    else { ctx.fillStyle = 'rgba(203,185,224,0.7)'; ctx.fillText('Get ready…', W / 2, 108); }
    ctx.restore();
  }
  drawButton(ctx, HEADER.back, 'Exit');
  drawButton(ctx, HEADER.next, `Speed ×${state.demoSpeed}`);
  // Think-time stepper: how long THINK pauses before each REVEAL, in the control-bar band this
  // scene otherwise leaves empty (no move/undo/hint/resign buttons apply to a demo).
  drawButton(ctx, DEMO_THINK.dec, 'Think −', { disabled: state.demoThinkIdx === 0 });
  drawButton(ctx, DEMO_THINK.inc, 'Think +', { disabled: state.demoThinkIdx === THINK_STEPS.length - 1 });
  ctx.save(); ctx.font = '600 20px Georgia, serif'; ctx.fillStyle = '#cbb9e0'; ctx.textAlign = 'center';
  ctx.fillText(`Think time: ${THINK_STEPS[state.demoThinkIdx]}s`, W / 2, BAR_TOP + BAR_H / 2 + 7);
  ctx.restore();
  if (state.banner) drawBanner(ctx, state);
}

// Counts how many wrapped screen-lines `text` takes at the *current* ctx.font, without drawing —
// used to size the reader card to its own page's content before anything is painted.
function countWrappedLines(ctx, text, maxW) {
  const words = text.split(' '); let n = 1, cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { n++; cur = w; } else cur = t; }
  return n;
}

// About, Controls and Rules all share this one reference-page renderer. A reader-style card frames
// the content (rather than text floating loose on the backdrop), body text reads at a real,
// comfortable size by default, and a text-size stepper (Header row, between Back/Next) lets anyone
// go a further steps larger — some players wear glasses, some don't; this is their control.
// The card's height is computed from its own page's content (title + optional piece portraits +
// body lines) rather than fixed, so a short page gets a short card and a page whose text has grown
// at a high text-scale step gets a taller one, up to the screen's own limit — content.js keeps
// every page to one short, single-concept passage specifically so it always fits (see content.js
// and STATUS.md for how the 300% ceiling was verified page by page).
function renderPage(ctx, state, list, headerTitle) {
  drawBackdrop(ctx, state.boardTheme, boardThemeOf(state.boardTheme).bg);
  const page = list[state.page % list.length];
  // Falls back to 1 for any out-of-range index (e.g. a save from a build with more steps).
  const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;

  const panelX = 34, panelW = W - 68, textMaxW = panelW - 90;
  const fontPx = Math.round(29 * scale), LH = Math.round(fontPx * 1.25), gap = Math.round(8 * scale);
  ctx.font = `400 ${fontPx}px Georgia, serif`;
  let linesH = 0;
  for (const line of page.lines) linesH += countWrappedLines(ctx, line, textMaxW) * LH + gap;
  linesH -= gap;

  // The page's own sub-title sits below the "About/Controls/Rules" header and its divider. Like
  // that header (capped at 1.15x just above), its font is capped well below the 300% body-text
  // ceiling: a big display sub-heading doesn't need to keep growing with the accessibility text
  // stepper the way body copy does, and every title was already verified to fit one unwrapped
  // line at up to the old 130% ceiling, so capping here at that same 1.3x keeps every title
  // pixel-identical to the already-shipped smaller scales instead of ballooning past the card.
  const titleFontPx = Math.round(31 * Math.min(scale, 1.3));
  const headerBlockH = 92; // fixed "About/Controls/Rules" heading + divider (that heading's own font is capped)
  const titleBlockH = titleFontPx + Math.round(fontPx * 0.55) + 10;
  const pieceBlockH = page.piece ? 160 : 0; // the piece portraits are drawn at a fixed size, independent of text scale

  // footerReserve leaves room below the panel for the "Page X of Y" indicator AND the bottom
  // Back/Next nav row (REF_BACK/REF_NEXT, y: 1164..1264) — previously this only had to clear a
  // single header row at the very top, back when Back/Next/A-/A+ all lived up there together.
  const panelTop = 90, footerReserve = 180, bottomPad = 22;
  const panelMaxH = H - panelTop - footerReserve;
  const panelH = Math.min(panelMaxH, Math.max(300, headerBlockH + titleBlockH + pieceBlockH + linesH + bottomPad));
  const panel = { x: panelX, y: panelTop, w: panelW, h: panelH };

  // The reader card: one framed panel holding the header, the piece portraits (if any) and the
  // body text, so the page reads as a designed reference sheet rather than loose floating text.
  roundPath(ctx, panel.x, panel.y, panel.w, panel.h, 28);
  const pg = ctx.createLinearGradient(0, panel.y, 0, panel.y + panel.h);
  pg.addColorStop(0, 'rgba(30,20,10,0.58)'); pg.addColorStop(1, 'rgba(14,9,5,0.68)');
  ctx.fillStyle = pg; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,234,214,0.28)'; ctx.stroke();
  roundPath(ctx, panel.x + 6, panel.y + 6, panel.w - 12, panel.h - 12, 22);
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(244,234,214,0.1)'; ctx.stroke();

  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#f4ead6';
  ctx.font = `700 ${Math.round(38 * Math.min(scale, 1.15))}px Georgia, serif`; ctx.fillText(headerTitle, W / 2, panel.y + 54);
  ctx.strokeStyle = 'rgba(244,234,214,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(panel.x + 60, panel.y + 82); ctx.lineTo(panel.x + panel.w - 60, panel.y + 82); ctx.stroke();
  ctx.font = `700 ${titleFontPx}px Georgia, serif`; ctx.fillStyle = '#ffd97a';
  ctx.fillText(page.title, W / 2, panel.y + headerBlockH + titleFontPx * 0.8);
  let y = panel.y + headerBlockH + titleBlockH;
  // Rules pages that cover one piece show the real in-game sprite, White and Black side by side,
  // using the same drawPiece() the board itself uses - never a separate simplified icon.
  if (page.piece) {
    const footY = y + 68, pr = 54, dx = 100;
    drawPiece(ctx, page.piece, true, W / 2 - dx, footY, P({ R: pr, theme: state.boardTheme }));
    drawPiece(ctx, page.piece, false, W / 2 + dx, footY, P({ R: pr, theme: state.boardTheme }));
    ctx.font = '400 17px Georgia, serif'; ctx.globalAlpha = 0.65; ctx.fillStyle = '#e7d3a6';
    ctx.fillText('White', W / 2 - dx, footY + 30);
    ctx.fillText('Black', W / 2 + dx, footY + 30);
    ctx.globalAlpha = 1; ctx.fillStyle = '#f4ead6';
    y += pieceBlockH;
  }
  ctx.font = `400 ${fontPx}px Georgia, serif`; ctx.globalAlpha = 0.94; ctx.fillStyle = '#f7eeda';
  for (const line of page.lines) y = wrapTextLeftish(ctx, line, W / 2, y, textMaxW, LH) + LH + gap;
  ctx.globalAlpha = 1;
  // a small still life of pieces on the table, only drawn where it has clear room below the text —
  // never on top of a long page's last line, and never on a piece-portrait page. Anchored to the
  // panel's OWN bottom edge (not a fixed canvas y) so it always sits inside the panel, however tall
  // the panel ends up being.
  const sy = panel.y + panel.h - 80;
  if (!page.piece && scale <= 1.3 && y + 70 < sy - 40) {
    drawPiece(ctx, KNIGHT, false, W / 2 - 150, sy - 6, P({ R: 46, theme: state.boardTheme }));
    drawPiece(ctx, KING, true, W / 2 - 20, sy, P({ R: 50, theme: state.boardTheme }));
    drawPiece(ctx, PAWN, true, W / 2 + 120, sy + 4, P({ R: 44, theme: state.boardTheme }));
  }
  ctx.restore();
  // "Page X of Y" sits between the panel and the bottom nav row, never inside either.
  ctx.save(); ctx.textAlign = 'center'; ctx.font = '400 19px Georgia, serif'; ctx.fillStyle = 'rgba(244,234,214,0.6)';
  ctx.fillText(`Page ${(state.page % list.length) + 1} of ${list.length}`, W / 2, 1140);
  ctx.restore();
  // Back/Next: an equal-width bottom pill pair, clear of the reader-card panel above it. Back is
  // the neutral/secondary action, Next the primary (gold) action, matching every other game's
  // reference pages. The text-size stepper (A-/A+) lives in the top corners only.
  drawButton(ctx, REF_BACK, 'Back');
  drawButton(ctx, REF_NEXT, 'Next', { primary: true });
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.textScaleIdx === 0 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.textScaleIdx === TEXT_SCALES.length - 1 });
}
// Wraps `text` centred at cx, returns the y just below the last line drawn.
function wrapTextLeftish(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' '); let line = '', ly = y;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, cx, ly); line = w; ly += lh; } else line = t; }
  ctx.fillText(line, cx, ly);
  return ly;
}

export function render(ctx, state) {
  ART_RES = artRes(ctx);
  switch (state.scene) {
    case 'title': renderTitle(ctx, state); break;
    case 'play': renderPlay(ctx, state); break;
    case 'lesson': renderLesson(ctx, state); break;
    case 'demo': renderDemo(ctx, state); break;
    case 'howto': renderPage(ctx, state, HOWTO, 'Controls'); break;
    case 'about': renderPage(ctx, state, ABOUT, 'About Chess'); break;
    case 'rules': renderPage(ctx, state, RULES, 'Rules'); break;
    default: renderTitle(ctx, state);
  }
}
