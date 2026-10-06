// All drawing. Pure: reads `state`, never mutates it (game.js owns every mutation).
import {
  W, H, SQ, BOARD_X, BOARD_Y, BOARD_SIZE, TRAY_H, pointXY, squareTopLeft, HERO, SIBLINGS, TEXT_SCALES, THINK_STEPS, fs,
} from './layout.js';
import { drawCredit, drawMoreLine, drawLockup } from './brand.js';
import { WHITE, BLACK, TYPE_NAME, QUEEN, ROOK, BISHOP, KNIGHT, PAWN, KING, inCheck } from './rules.js';
import { LEVELS, LEVEL_COUNT } from './engine.js';
import { LESSONS } from './lessons.js';
import { DEMO_GAMES } from './demo.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { drawBoard, drawBackdrop, boardThemeOf, THEME_NAMES, drawDot, drawCaptureRing, drawCornerMarks, drawCheckGlow, drawSelectGlow } from './art.js';
import { drawPiece, FLOOR_LINE, PIECE_TOP } from './pieces.js';

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
  const maxW = r.w - 14, minSize = fs(20);
  ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
  while (ctx.measureText(label).width > maxW && size > minSize) { size -= 2; ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`; }
  if (!sub && ctx.measureText(label).width > maxW && label.includes(' ')) {                 // still too wide at the smallest size: two lines instead of overflowing
    const ws = label.split(' '); let best = 1, bd = 1e9;
    for (let i = 1; i < ws.length; i++) { const d = Math.abs(ctx.measureText(ws.slice(0, i).join(' ')).width - ctx.measureText(ws.slice(i).join(' ')).width); if (d < bd) { bd = d; best = i; } }
    const l1 = ws.slice(0, best).join(' '), l2 = ws.slice(best).join(' ');
    while (Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) > maxW && size > 11) { size -= 1; ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`; }
    ctx.fillText(l1, r.x + r.w / 2, r.y + r.h / 2 - size * 0.55); ctx.fillText(l2, r.x + r.w / 2, r.y + r.h / 2 + size * 0.55);
  } else ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 - (sub ? 10 : 0));
  if (sub) { ctx.font = `400 ${Math.round(fs(19))}px Georgia, serif`; ctx.globalAlpha = 0.85; ctx.fillText(sub, r.x + r.w / 2, r.y + r.h / 2 + 18); ctx.globalAlpha = 1; }
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
function drawGameBoard(ctx, state, flip, S) {
  // The board is authored in canonical units; the scene says where it sits and how big it is.
  const bm = S.board, prevRes = ART_RES;
  ctx.save(); ctx.translate(bm.bx - BOARD_X * bm.s, bm.by - BOARD_Y * bm.s); ctx.scale(bm.s, bm.s); ART_RES = artRes(ctx);
  drawBoardLayer(ctx, state, flip);
  ctx.restore(); ART_RES = prevRes;
}
function drawBoardLayer(ctx, state, flip) {
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
  // AI-vs-AI demo's own REVEAL_SOURCE sub-phase: before showing where the piece will go, first
  // draw a pulsing ring around WHICH piece is about to move — a distinct light-blue color from the
  // gold destination highlight below, so the viewer registers the piece itself (and can start
  // guessing its destination) before being told where it's headed.
  if (state.demoPhase === 'revealSource' && state.sel >= 0) {
    const p = pointXY(state.sel, flip), pulse = (Math.sin(state.t * 7) + 1) / 2;
    ctx.save();
    ctx.strokeStyle = `rgba(120,205,255,${0.75 + pulse * 0.25})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(p.x, p.y, SQ * 0.48, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
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
function drawTray(ctx, x, y, w, pieces, white, theme, reserve = 0) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, TRAY_H); ctx.clip();
  const step = Math.max(11, Math.min(26, (w - 44 - reserve) / Math.max(1, pieces.length)));
  let px = x + 22;
  for (const t of pieces) { drawPiece(ctx, t, white, px, y + TRAY_H * 0.78, P({ R: 16, theme })); px += step; }
  ctx.restore();
}
function materialDelta(g) {
  const VAL = { [PAWN]: 1, [KNIGHT]: 3, [BISHOP]: 3, [ROOK]: 5, [QUEEN]: 9 };
  let v = 0; for (const s of g.st.board) if (s) v += (s > 0 ? 1 : -1) * (VAL[Math.abs(s)] || 0);
  return v;
}

function drawMoveList(ctx, state, r) {
  const { x, y, w, h } = r;
  ctx.save();
  roundPath(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(20,14,8,0.42)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.clip();
  const log = state.g.log, fsz = Math.round(fs(20)), lineH = Math.round(fsz * 1.35);
  ctx.font = `${fsz}px Georgia, serif`; ctx.fillStyle = 'rgba(244,234,214,0.92)'; ctx.textBaseline = 'top';
  const cols = w >= 380 ? 2 : 1, colW = w / cols, rowsPerCol = Math.max(1, Math.floor((h - 16) / lineH));
  const pairs = []; for (let i = 0; i < log.length; i += 2) pairs.push([log[i], log[i + 1]]);
  const totalRows = pairs.length, maxVisible = rowsPerCol * cols;
  const startPair = Math.max(0, totalRows - maxVisible);
  for (let i = startPair; i < totalRows; i++) {
    const rel = i - startPair, col = Math.floor(rel / rowsPerCol), row = rel % rowsPerCol;
    const tx = x + 14 + col * colW, ty = y + 10 + row * lineH;
    const [a, b] = pairs[i];
    ctx.fillText(`${i + 1}. ${a ? a.san : ''}${b ? '  ' + b.san : ''}`, tx, ty);
  }
  if (log.length === 0) { ctx.globalAlpha = 0.6; ctx.fillText('Moves will appear here.', x + 14, y + 10); ctx.globalAlpha = 1; }
  ctx.restore();
}

function fitText(ctx, text, x, y, maxW, size, weight, family = 'Georgia, serif', minPx = 16) {
  let sz = size; ctx.font = `${weight} ${sz}px ${family}`;
  while (ctx.measureText(text).width > maxW && sz > minPx) { sz -= 1; ctx.font = `${weight} ${sz}px ${family}`; }
  ctx.fillText(text, x, y);
}
function drawCard(ctx, r) {
  ctx.save(); roundPath(ctx, r.x, r.y, r.w, r.h, 22);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, 'rgba(30,20,10,0.55)'); g.addColorStop(1, 'rgba(14,9,5,0.65)');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(244,234,214,0.2)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
}
function drawCards(ctx, S) { for (const c of S.cards) drawCard(ctx, c); }

function drawTopBar(ctx, state, title, S) {
  const hd = S.head;
  ctx.save();
  ctx.fillStyle = '#f4ead6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  fitText(ctx, title, hd.cx, hd.titleY, hd.maxW, hd.titleSize, 700, 'Georgia, serif', 18);
  ctx.globalAlpha = 0.8;
  const g = state.g;
  const status = g.result ? resultText(g.result, state) : `${g.st.turn === WHITE ? 'White' : 'Black'} to move${state.thinking ? '  ·  thinking…' : ''}`;
  fitText(ctx, status, hd.cx, hd.statusY, hd.maxW, Math.round(fs(hd.statusSize)), 400, 'Georgia, serif', 16);
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

// Several lines of wrapped, centred text that shrink together to fit a rectangle: [{ text, color, size, weight }].
function drawNote(ctx, r, parts, align = 'center') {
  if (!parts.length) return;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = align;
  const x = align === 'center' ? r.x + r.w / 2 : r.x + 6, maxW = r.w - 12;
  let k = 1, total = 0, lines = [];
  for (let pass = 0; pass < 8; pass++) {
    total = 0; lines = [];
    for (const p of parts) {
      const size = Math.max(fs(15), Math.round(p.size * k)), lh = Math.round(size * 1.26);
      ctx.font = `${p.weight || 400} ${size}px Georgia, serif`;
      for (const ln of wrapLines(ctx, p.text, maxW)) { lines.push({ ln, size, lh, color: p.color, weight: p.weight || 400 }); total += lh; }
      total += 4;
    }
    if (total <= r.h || k <= 0.62) break; k -= 0.07;
  }
  let y = r.y + (lines.length ? lines[0].size : 0) + Math.max(0, Math.min(6, (r.h - total) / 2));
  for (const l of lines) { ctx.font = `${l.weight} ${l.size}px Georgia, serif`; ctx.fillStyle = l.color; ctx.fillText(l.ln, x, y); y += l.lh; }
  ctx.restore();
}
function wrapLines(ctx, text, maxW) {
  const words = text.split(' '), out = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  out.push(line); return out;
}

// ---- scenes ---------------------------------------------------------------------------------------
function renderTitle(ctx, state, L) {
  const T = L.title;
  drawBackdrop(ctx, state.boardTheme, boardThemeOf(state.boardTheme).bg, L.w, L.h);
  const t = state.t, themeName = state.boardTheme, prevRes = ART_RES;
  if (T.card) drawCard(ctx, T.card);

  // The hero: title, tagline and a lit board, authored in a 600 x 520 box (HERO) and fitted to T.hero.
  ctx.save(); ctx.translate(T.hero.x - HERO.x * T.hero.k, T.hero.y - HERO.y * T.hero.k); ctx.scale(T.hero.k, T.hero.k); ART_RES = artRes(ctx);
  // Title, above the hero board.
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#f7ecd6';
  ctx.font = '700 58px Georgia, "Times New Roman", serif'; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 14;
  ctx.fillText('Chess', W / 2, HERO.y + 44);
  ctx.shadowBlur = 0; ctx.font = '400 21px Georgia, serif'; ctx.globalAlpha = 0.88; ctx.fillStyle = '#e7d3a6';
  ctx.fillText('The timeless game of sixty-four squares', W / 2, HERO.y + 76);
  ctx.globalAlpha = 1; ctx.restore();

  // Key art: a window onto a lit board in the middle of a game (a classical Italian after the centre has opened).
  const bandTop = HERO.y + 96, bandH = HERO.y + HERO.h - bandTop;
  const scale = (HERO.w + 40) / BOARD_SIZE, ox = W / 2 - (BOARD_SIZE / 2) * scale, oy = bandTop + bandH / 2 - (BOARD_Y + BOARD_SIZE * 0.52) * scale;
  ctx.save();
  ctx.beginPath(); ctx.rect(HERO.x - 10, bandTop - 6, HERO.w + 20, bandH + 12); ctx.clip();
  ctx.translate(ox, oy); ctx.scale(scale, scale); ART_RES = artRes(ctx);
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
  ctx.fillStyle = eg; ctx.fillRect(HERO.x - 10, bandTop - 6, HERO.w + 20, bandH + 12);
  // vignette so buttons below read as clearly separate from the key art
  const vg = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH + 40);
  vg.addColorStop(0.8, 'rgba(15,10,6,0)'); vg.addColorStop(1, 'rgba(15,10,6,0.9)');
  ctx.fillStyle = vg; ctx.fillRect(HERO.x - 10, bandTop, HERO.w + 20, bandH + 40);
  ctx.restore(); ART_RES = prevRes;

  const rows = T.rows;
  drawButton(ctx, rows.playWhite, 'Play as White', { primary: true });
  drawButton(ctx, rows.playBlack, 'Play as Black');
  drawButton(ctx, rows.twoPlayer, T.grid ? 'Two Players' : 'Two Players (Pass and Play)');
  drawButton(ctx, rows.watch, T.grid ? 'Watch AI vs AI' : 'Watch Two Full Games (AI vs AI)');
  drawButton(ctx, rows.learn, `Learn to Play${state.learned.length ? ` (${state.learned.length}/${LESSONS.length})` : ''}`);
  drawButton(ctx, rows.howto, 'Controls');
  drawButton(ctx, rows.about, 'About');
  drawButton(ctx, rows.rules, 'Rules');
  drawButton(ctx, rows.level, `Opponent: ${LEVELS[state.level].name}`, { sub: `${state.level} of ${LEVEL_COUNT}` });
  drawButton(ctx, rows.theme, `Board: ${THEME_NAMES[state.boardTheme]}`);
  drawButton(ctx, T.sound, state.sound ? 'Sound: On' : 'Sound: Off', { active: state.sound });

  // The discreet Arcforge credit (never over gameplay), then the free-to-play line.
  if (!drawLockup(ctx, T.credit.x, T.credit.y + T.credit.w * (260 / 700), T.credit.w, state.lockPress > 0 ? 0.7 : 1)) drawCredit(ctx, T.credit.x, T.credit.y + T.credit.w * 0.2, Math.round(fs(13)), { dim: 0.95 });
  ctx.save(); ctx.textAlign = 'center'; ctx.globalAlpha = 0.6; ctx.fillStyle = '#e7d3a6'; ctx.font = `400 ${Math.round(fs(17))}px Georgia, serif`;
  ctx.fillText('Free to play, forever. No ads, no purchases.', T.foot.x, T.foot.y);
  ctx.restore();
}

const BAR_LABELS = {
  play: (state) => ({ menu: ['Menu'], flip: ['Flip'], undo: ['Undo', { disabled: state.g.log.length === 0 }], hint: [`Hint (${state.hintsLeft})`, { disabled: state.hintsLeft <= 0 }], resign: [state.g.result ? 'New Game' : 'Resign'] }),
};

function renderPlay(ctx, state, L) {
  const S = L.scene('play');
  drawBackdrop(ctx, state.boardTheme, boardThemeOf(state.boardTheme).bg, L.w, L.h);
  drawCards(ctx, S);
  const flip = (state.mode === 'ai' && state.human === BLACK) || state.flipManual;
  const showingResult = state.overOpen && state.g.result;
  drawTopBar(ctx, state, state.mode === 'two' ? 'Two Players' : `Playing White vs ${LEVELS[state.level].name}`.replace('White', state.human === WHITE ? 'White' : 'Black'), S);
  drawGameBoard(ctx, state, flip, S);
  if (!showingResult) {
    if (S.trays) {
      const mat = materialDelta(state.g), { byWhite, byBlack } = capturedLists(state.g), tr = S.trays, reserve = mat !== 0 ? 96 : 0;
      drawTray(ctx, tr.x, tr.y, tr.w, byBlack, false, state.boardTheme, reserve);
      drawTray(ctx, tr.x, tr.y + TRAY_H, tr.w, byWhite, true, state.boardTheme, reserve);
      ctx.save(); ctx.font = `600 ${Math.round(fs(20))}px Georgia, serif`; ctx.fillStyle = 'rgba(244,234,214,0.85)'; ctx.textAlign = 'right';
      if (mat !== 0) ctx.fillText(mat > 0 ? `White +${mat}` : `Black +${-mat}`, tr.x + tr.w, tr.y + 28);
      ctx.restore();
    }
    if (S.moves) drawMoveList(ctx, state, S.moves);
    const lab = BAR_LABELS.play(state);
    for (const k of S.dirKey) drawButton(ctx, S.bar[k], lab[k][0], lab[k][1] || {});
    if (state.hint) drawNote(ctx, S.note, [{ text: state.hint.reason || '', color: '#ffd97a', size: 19 }]);
    if (state.banner) drawBanner(ctx, state, S);
    if (state.msg) drawMessage(ctx, state.msg, S);
    else if (state.coachBubble) drawCoach(ctx, state.coachBubble, S);
  }
  if (state.promoPending) drawPromoPicker(ctx, state, L);
  if (showingResult) drawResultPanel(ctx, state, L, 'New Game');
}

// A transient toast over the TOP of the board (there is no safe empty space left once the trays and move list are present).
function drawToast(ctx, rect, text, { fill, stroke, color, size, alpha = 1, lh }) {
  ctx.save(); ctx.globalAlpha = alpha;
  const fsz = Math.round(fs(size)), line = lh || Math.round(fsz * 1.25);
  ctx.font = `400 ${fsz}px Georgia, serif`; ctx.textAlign = 'center';
  const lines = wrapLines(ctx, text, rect.w - 40), h = Math.max(rect.h, lines.length * line + 28);
  roundPath(ctx, rect.x, rect.y, rect.w, h, 14); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = color; let y = rect.y + (h - lines.length * line) / 2 + fsz * 0.95;
  for (const l of lines) { ctx.fillText(l, rect.x + rect.w / 2, y); y += line; }
  ctx.restore();
}
function drawMessage(ctx, msg, S) {
  const alpha = Math.max(0, 1 - msg.t / 3.4);
  if (alpha <= 0) return;
  const warn = msg.kind === 'warn', good = msg.kind === 'good';
  drawToast(ctx, S.toast, msg.text, {
    alpha, size: 20, fill: warn ? 'rgba(74,26,18,0.93)' : good ? 'rgba(20,54,24,0.93)' : 'rgba(46,34,18,0.93)',
    stroke: warn ? 'rgba(255,150,120,0.55)' : good ? 'rgba(150,230,140,0.5)' : 'rgba(255,214,120,0.45)', color: warn ? '#ffb199' : good ? '#b7f0b0' : '#f4ead6',
  });
}
function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' '); let line = '', ly = y;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, cx, ly); line = w; ly += lh; } else line = t; }
  ctx.fillText(line, cx, ly);
}
function drawBanner(ctx, state, S) {
  const b = state.banner, tt = Math.min(1, b.t / 0.35), scale = easeOutBack(tt) * Math.max(0.6, S.board.s);
  ctx.save(); ctx.translate(S.board.cx, S.board.cy); ctx.scale(scale, scale);
  ctx.globalAlpha = Math.max(0, 1 - Math.max(0, b.t - 1.1) / 0.5);
  ctx.font = '700 54px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 20;
  ctx.fillStyle = b.text === 'Checkmate' ? '#ffe6a8' : b.text === 'Check' ? '#ffb199' : '#e7d3a6';
  ctx.fillText(b.text, 0, 0);
  ctx.restore();
}
function drawPromoPicker(ctx, state, L) {
  const PR = L.promo, c = PR.card;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
  roundPath(ctx, c.x, c.y, c.w, c.h, 22);
  const g = ctx.createLinearGradient(c.x, c.y, c.x, c.y + c.h); g.addColorStop(0, '#3a2c1c'); g.addColorStop(1, '#1c1309');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,214,150,0.4)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = '700 28px Georgia, serif'; ctx.fillStyle = '#f4ead6'; ctx.textAlign = 'center';
  ctx.fillText('Choose a piece', c.x + c.w / 2, c.y + 56);
  const white = state.g.st.board[state.promoPending.from] > 0;
  const types = [QUEEN, ROOK, BISHOP, KNIGHT];
  PR.pieces.forEach((r, i) => {
    roundPath(ctx, r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    drawPiece(ctx, types[i], white, r.x + r.w / 2, r.y + r.h * 0.72, P({ R: Math.min(30, r.w * 0.28), theme: state.boardTheme }));
    ctx.font = `400 ${Math.round(fs(17))}px Georgia, serif`; ctx.fillStyle = '#e7d3a6';
    ctx.fillText(TYPE_NAME[types[i]][0].toUpperCase() + TYPE_NAME[types[i]].slice(1), r.x + r.w / 2, r.y + r.h + 26);
  });
  ctx.restore();
}
// The ONE overlay every ending goes through: result headline, "More heritage games in Arcforge" chips, New Game / Menu.
function drawResultPanel(ctx, state, L, againLabel, subText) {
  const r = state.g.result, R = L.result, c = R.card;
  ctx.save();
  ctx.fillStyle = 'rgba(10,7,4,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  roundPath(ctx, c.x, c.y, c.w, c.h, 24);
  const g = ctx.createLinearGradient(0, c.y, 0, c.y + c.h); g.addColorStop(0, 'rgba(34,24,12,0.97)'); g.addColorStop(1, 'rgba(14,9,5,0.97)');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(244,234,214,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = '700 42px Georgia, serif'; ctx.fillStyle = r.why === 'checkmate' ? '#ffe6a8' : '#f4ead6'; ctx.textAlign = 'center';
  wrapText(ctx, resultText(r, state), R.cx, R.headY, c.w - 70, 48);
  ctx.font = `400 ${Math.round(fs(20))}px Georgia, serif`; ctx.globalAlpha = 0.8;
  ctx.fillText(subText || (state.mode === 'two' ? 'Two Players' : `vs ${LEVELS[state.level].name}`), R.cx, R.subY);
  ctx.globalAlpha = 1;
  drawMoreLine(ctx, R.cx, R.moreY, Math.round(fs(17)));
  SIBLINGS.forEach((s, i) => drawButton(ctx, R.chips[i], s.title));
  drawButton(ctx, R.again, againLabel, { primary: true });
  drawButton(ctx, R.menu, 'Menu');
  ctx.restore();
}
function drawCoach(ctx, bubble, S) {
  drawToast(ctx, S.toast, bubble.text, {
    alpha: Math.min(1, Math.max(0, 6 - bubble.t)), size: 19, fill: 'rgba(60,44,20,0.92)', stroke: 'rgba(255,214,120,0.6)', color: '#ffe9bd',
  });
}

function renderLesson(ctx, state, L) {
  const S = L.scene('lesson');
  drawBackdrop(ctx, state.boardTheme, ['#182018', '#0a0d09'], L.w, L.h);
  drawCards(ctx, S);
  const Ls = state.lesson, lesson = LESSONS[Ls.i], step = lesson.steps[Ls.s];
  drawTopBar(ctx, state, `${lesson.title}  (${Ls.s + 1}/${lesson.steps.length})`, S);
  drawGameBoard(ctx, state, state.flipManual, S);
  const parts = [{ text: step.minigame ? step.text : (Ls.done ? 'Well done — tap Next to continue.' : step.text), color: '#e7f0d6', size: 22 }];
  if (Ls.showSol && !Ls.done) parts.push({ text: step.hint, color: '#ffd97a', size: 19 });
  drawNote(ctx, S.note, parts);
  if (state.msg) drawMessage(ctx, state.msg, S);
  if (state.banner) drawBanner(ctx, state, S);
  drawButton(ctx, S.bar.menu, 'Menu');
  drawButton(ctx, S.bar.flip, 'Flip');
  drawButton(ctx, S.bar.hint, 'Show hint');
  drawButton(ctx, S.bar.next, Ls.done ? (Ls.s + 1 < lesson.steps.length ? 'Next' : 'Next Lesson') : 'Restart step', { primary: Ls.done });
  if (state.promoPending) drawPromoPicker(ctx, state, L);
}

function renderDemo(ctx, state, L) {
  const S = L.scene('demo');
  drawBackdrop(ctx, state.boardTheme, ['#161220', '#08060a'], L.w, L.h);
  drawCards(ctx, S);
  const cfg = DEMO_GAMES[state.demoIdx];
  drawTopBar(ctx, state, cfg.name, S);
  drawGameBoard(ctx, state, false, S);
  if (state.demoFinished) { drawResultPanel(ctx, state, L, 'Watch Again', `Demo complete — Game ${state.demoIdx + 1} of ${DEMO_GAMES.length}`); return; }
  if (S.moves) drawMoveList(ctx, state, S.moves);
  drawNote(ctx, S.note, [{ text: `${state.demoIdx + 1} of ${DEMO_GAMES.length}  ·  White: ${LEVELS[cfg.levels[0]].name}   Black: ${LEVELS[cfg.levels[1]].name}`, color: '#cbb9e0', size: 19 }]);
  // The teaching-loop caption: invites a guess while THINK is running (with a live countdown), then names the reveal.
  if (!state.g.result) {
    ctx.save(); ctx.font = `700 ${Math.round(fs(22))}px Georgia, serif`; ctx.textAlign = 'center';
    const cap = state.demoPaused ? ['Paused', '#7ccbff'] : state.demoPhase === 'reveal' ? ['The engine plays…', '#ffd97a'] : state.demoPhase === 'revealSource' ? ['This piece is about to move…', '#7ccbff']
      : state.demoPhase === 'think' ? [`Guess the move… ${Math.max(0, Math.ceil(state.demoTimer))}s`, '#cbb9e0'] : ['Get ready…', 'rgba(203,185,224,0.7)'];
    ctx.fillStyle = cap[1]; fitText(ctx, cap[0], S.head.cx, S.head.captionY, S.head.maxW, Math.round(fs(22)), 700, 'Georgia, serif', 16);
    ctx.restore();
  }
  drawButton(ctx, S.bar.exit, 'Exit');
  drawButton(ctx, S.bar.speed, `Speed ×${state.demoSpeed}`);
  drawButton(ctx, S.bar.pause, state.demoPaused ? '▶ Resume' : '❙❙ Pause', { primary: state.demoPaused });
  drawButton(ctx, S.bar.dec, 'Think −', { disabled: state.demoThinkIdx === 0 });
  drawButton(ctx, S.bar.inc, 'Think +', { disabled: state.demoThinkIdx === THINK_STEPS.length - 1 });
  ctx.save(); ctx.font = `600 ${Math.round(fs(20))}px Georgia, serif`; ctx.fillStyle = '#cbb9e0'; ctx.textAlign = 'center';
  ctx.fillText(`Think time: ${THINK_STEPS[state.demoThinkIdx]}s`, S.foot.x, S.foot.y);
  ctx.restore();
  if (state.banner) drawBanner(ctx, state, S);
}

// Counts how many wrapped screen-lines `text` takes at the *current* ctx.font, without drawing.
function countWrappedLines(ctx, text, maxW) {
  const words = text.split(' '); let n = 1, cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { n++; cur = w; } else cur = t; }
  return n;
}

// The reader's scroll metrics, shared with game.js (it owns the scroll position; the view only measures).
export const pageView = { max: 0, vp: null, rects: [] };   // rects: document-space layout of the last measure pass ({ kind, si, x0, x1, y0, y1 }), read by the layout test

// About, Controls and Rules all share this one reader: a card with a header and ONE continuous scrolling document (every section in
// order; drag, wheel, Arrow / PageUp / PageDown / Home / End, scroll bar), and a bottom row [Back] [A-] [A+] [Next]. Next moves a
// screenful and becomes Done at the end; Back always leaves. Text zoom 100-300%.
function renderPage(ctx, state, list, headerTitle, L) {
  drawBackdrop(ctx, state.boardTheme, boardThemeOf(state.boardTheme).bg, L.w, L.h);
  const PG = L.page, scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  const panel = PG.panelMax, panelW = panel.w, textMaxW = panelW - 90, cx = panel.x + panelW / 2;
  const fontPx = Math.round(29 * scale), LH = Math.round(fontPx * 1.25), gap = Math.round(8 * scale);
  const titleFontPx = Math.round(31 * Math.min(scale, 1.3));
  const headerBlockH = 92;
  const vp = { x: panel.x + 8, y: panel.y + headerBlockH, w: panel.w - 16, h: Math.max(40, panel.h - headerBlockH - 12) };
  // The illustration block is sized from the sprite itself: pieces stand ON footY and rise up to (PIECE_TOP + 8) units above it
  // (the king ~126 px at pr = 54), so the block must reserve that whole height ABOVE the foot, plus the captions below it.
  const pr = 54, dx = 100, ILL_TOP = 10, ILL_UP = Math.ceil((Math.max(...Object.values(PIECE_TOP)) + 8) * pr * 2.25 / 200), ILL_CAP = 34, ILL_BOTTOM = 14;
  const pieceBlockH = ILL_TOP + ILL_UP + ILL_CAP + ILL_BOTTOM, stillH = 120;
  const rects = [];

  // one pass that either measures (draw = false) or paints the whole document from y0; returns the y below the last line
  const flow = (draw, y0) => {
    let y = y0;
    ctx.textAlign = 'center';
    list.forEach((sec, si) => {
      if (si) y += Math.round(26 * scale);
      if (!draw) rects.push({ kind: 'title', si, x0: cx - textMaxW / 2, x1: cx + textMaxW / 2, y0: y, y1: y + Math.round(titleFontPx * 1.1) });
      if (draw) { ctx.font = `700 ${titleFontPx}px Georgia, serif`; ctx.fillStyle = '#ffd97a'; ctx.fillText(sec.title, cx, y + titleFontPx * 0.8); }
      y += Math.round(titleFontPx * 1.1) + 10;
      if (sec.piece) {
        const footY = y + ILL_TOP + ILL_UP;
        if (!draw) rects.push({ kind: 'illus', si, x0: cx - dx - 60, x1: cx + dx + 60, y0: y + ILL_TOP, y1: footY + ILL_CAP });
        if (draw) {
          drawPiece(ctx, sec.piece, true, cx - dx, footY, P({ R: pr, theme: state.boardTheme }));
          drawPiece(ctx, sec.piece, false, cx + dx, footY, P({ R: pr, theme: state.boardTheme }));
          ctx.font = '400 17px Georgia, serif'; ctx.globalAlpha = 0.65; ctx.fillStyle = '#e7d3a6';
          ctx.fillText('White', cx - dx, footY + 30); ctx.fillText('Black', cx + dx, footY + 30);
          ctx.globalAlpha = 1;
        }
        y += pieceBlockH;
      }
      ctx.font = `400 ${fontPx}px Georgia, serif`;
      for (const line of sec.lines) {
        if (!draw) rects.push({ kind: 'text', si, x0: cx - textMaxW / 2, x1: cx + textMaxW / 2, y0: y, y1: y + countWrappedLines(ctx, line, textMaxW) * LH });
        if (draw) { ctx.globalAlpha = 0.94; ctx.fillStyle = '#f7eeda'; const ly = wrapTextLeftish(ctx, line, cx, y + fontPx * 0.88, textMaxW, LH); y = ly - fontPx * 0.88 + LH + gap; ctx.globalAlpha = 1; }
        else y += countWrappedLines(ctx, line, textMaxW) * LH + gap;
      }
    });
    return y;
  };
  ctx.save(); ctx.font = `400 ${fontPx}px Georgia, serif`;
  const aboutStill = list === ABOUT;
  const contentH = flow(false, 0) + 12 + (aboutStill ? stillH : 0);
  ctx.restore();
  pageView.rects = rects;
  const scrollMax = Math.max(0, Math.ceil(contentH - vp.h));
  pageView.max = scrollMax; pageView.vp = vp;
  const scroll = Math.max(0, Math.min(scrollMax, state.scroll || 0));

  roundPath(ctx, panel.x, panel.y, panel.w, panel.h, 28);
  const pg = ctx.createLinearGradient(0, panel.y, 0, panel.y + panel.h);
  pg.addColorStop(0, 'rgba(30,20,10,0.58)'); pg.addColorStop(1, 'rgba(14,9,5,0.68)');
  ctx.fillStyle = pg; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,234,214,0.28)'; ctx.stroke();
  roundPath(ctx, panel.x + 6, panel.y + 6, panel.w - 12, panel.h - 12, 22);
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(244,234,214,0.1)'; ctx.stroke();

  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#f4ead6';
  ctx.font = `700 ${Math.round(38 * Math.min(scale, 1.15))}px Georgia, serif`; ctx.fillText(headerTitle, cx, panel.y + 54);
  ctx.strokeStyle = 'rgba(244,234,214,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(panel.x + 60, panel.y + 82); ctx.lineTo(panel.x + panel.w - 60, panel.y + 82); ctx.stroke();
  // the scrolling body
  ctx.save(); ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip(); ctx.translate(0, -scroll);
  const endY = flow(true, vp.y + 4);
  if (aboutStill) {   // a small still life of pieces closes the About text
    const sy = endY + 70;
    drawPiece(ctx, KNIGHT, false, cx - 150, sy - 6, P({ R: 46, theme: state.boardTheme }));
    drawPiece(ctx, KING, true, cx - 20, sy, P({ R: 50, theme: state.boardTheme }));
    drawPiece(ctx, PAWN, true, cx + 120, sy + 4, P({ R: 44, theme: state.boardTheme }));
  }
  ctx.restore();
  // scroll bar
  if (scrollMax > 0) {
    const tx = panel.x + panel.w - 16, th = Math.max(40, vp.h * (vp.h / contentH)), ty = vp.y + (vp.h - th) * (scroll / scrollMax);
    ctx.fillStyle = 'rgba(244,234,214,0.12)'; roundPath(ctx, tx, vp.y, 8, vp.h, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,217,122,0.7)'; roundPath(ctx, tx, Math.max(vp.y, ty), 8, th, 4); ctx.fill();
  }
  ctx.restore();
  drawButton(ctx, PG.nav.back, 'Back');
  drawButton(ctx, PG.nav.next, scroll >= scrollMax - 2 ? 'Done' : 'Next', { primary: true });
  drawButton(ctx, PG.nav.dec, 'A−', { disabled: state.textScaleIdx === 0 });
  drawButton(ctx, PG.nav.inc, 'A+', { disabled: state.textScaleIdx === TEXT_SCALES.length - 1 });
}
// Wraps `text` centred at cx, returns the y just below the last line drawn.
function wrapTextLeftish(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' '); let line = '', ly = y;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, cx, ly); line = w; ly += lh; } else line = t; }
  ctx.fillText(line, cx, ly);
  return ly;
}

export function render(ctx, state, L) {
  ART_RES = artRes(ctx);
  switch (state.scene) {
    case 'title': renderTitle(ctx, state, L); break;
    case 'play': renderPlay(ctx, state, L); break;
    case 'lesson': renderLesson(ctx, state, L); break;
    case 'demo': renderDemo(ctx, state, L); break;
    case 'howto': renderPage(ctx, state, HOWTO, 'Controls', L); break;
    case 'about': renderPage(ctx, state, ABOUT, 'About Chess', L); break;
    case 'rules': renderPage(ctx, state, RULES, 'Rules', L); break;
    default: renderTitle(ctx, state, L);
  }
}
