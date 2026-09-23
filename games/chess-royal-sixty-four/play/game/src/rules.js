// THE RULE BOOK for Chess. Pure and deterministic. The AI (engine.js) uses the same move generator
// and the same attack tables, so there is exactly one source of truth for what is legal.
//
// Board: files a..h = 0..7 (left to right, White's view), ranks 1..8 = 0..7 (bottom to top).
// Square index = rank * 8 + file, so a1 = 0, h1 = 7, a8 = 56, h8 = 63. Pieces are small integers:
// type 1..6 (pawn, knight, bishop, rook, queen, king), positive = White, negative = Black.
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const WHITE = 1, BLACK = -1;
export const TYPE_NAME = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
export const SIDE_NAME = { 1: 'White', [-1]: 'Black' };
export const PIECE_LETTER = ['', '', 'N', 'B', 'R', 'Q', 'K'];
const abs = Math.abs;

export const fileOf = (s) => s & 7;
export const rankOf = (s) => s >> 3;
export const sqOf = (file, rank) => rank * 8 + file;
const inBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
export const FILES = 'abcdefgh';
export const sqName = (s) => FILES[fileOf(s)] + (rankOf(s) + 1);
export const sqFromName = (name) => sqOf(FILES.indexOf(name[0]), Number(name[1]) - 1);

// Castling-rights bits.
export const WK = 1, WQ = 2, BK = 4, BQ = 8;

// Move flags (packed into the move integer alongside from/to/promotion).
export const MOVE_NORMAL = 0, MOVE_DOUBLE = 1, MOVE_EP = 2, MOVE_OO = 3, MOVE_OOO = 4;
export const encodeMove = (from, to, flag = 0, promo = 0) => from | (to << 6) | (flag << 12) | (promo << 15);
export const moveFrom = (m) => m & 63;
export const moveTo = (m) => (m >> 6) & 63;
export const moveFlag = (m) => (m >> 12) & 7;
export const movePromo = (m) => (m >> 15) & 7;

// ---- geometry tables --------------------------------------------------------------------------
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]; // N,S,E,W,NE,NW,SE,SW
export const ROOK_DIRS = [0, 1, 2, 3], BISHOP_DIRS = [4, 5, 6, 7];
const KNIGHT_D = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

export const RAYS = []; // RAYS[s][dir] = squares outward from s in that direction, edge to edge
export const KNIGHT_MOVES = [];
export const KING_MOVES = [];
const PAWN_ATK_SRC = [[], []]; // PAWN_ATK_SRC[sideIdx][s] = squares from which a pawn of `side` attacks s
const PAWN_PUSH = [[], []];
const PAWN_DOUBLE = [[], []];
const PAWN_CAPS = [[], []]; // PAWN_CAPS[sideIdx][s] = squares a pawn of `side` on s can capture on
const sideIdx = (side) => (side === WHITE ? 0 : 1);

for (let s = 0; s < 64; s++) {
  const f = fileOf(s), r = rankOf(s);
  RAYS[s] = DIRS.map(([df, dr]) => { const out = []; for (let a = f + df, b = r + dr; inBoard(a, b); a += df, b += dr) out.push(sqOf(a, b)); return out; });
  KNIGHT_MOVES[s] = KNIGHT_D.filter(([df, dr]) => inBoard(f + df, r + dr)).map(([df, dr]) => sqOf(f + df, r + dr));
  KING_MOVES[s] = DIRS.filter(([df, dr]) => inBoard(f + df, r + dr)).map(([df, dr]) => sqOf(f + df, r + dr));
  for (const side of [WHITE, BLACK]) {
    const i = sideIdx(side), fwd = side === WHITE ? 1 : -1;
    if (inBoard(f, r + fwd)) PAWN_PUSH[i][s] = sqOf(f, r + fwd); else PAWN_PUSH[i][s] = -1;
    const startRank = side === WHITE ? 1 : 6;
    PAWN_DOUBLE[i][s] = r === startRank ? sqOf(f, r + 2 * fwd) : -1;
    const caps = [];
    for (const df of [-1, 1]) if (inBoard(f + df, r + fwd)) caps.push(sqOf(f + df, r + fwd));
    PAWN_CAPS[i][s] = caps;
  }
}
for (let s = 0; s < 64; s++) {
  const f = fileOf(s), r = rankOf(s);
  for (const side of [WHITE, BLACK]) {
    const i = sideIdx(side), back = side === WHITE ? -1 : 1; // a `side` pawn attacking s stands one rank behind s
    const srcs = [];
    for (const df of [-1, 1]) if (inBoard(f + df, r + back)) srcs.push(sqOf(f + df, r + back));
    PAWN_ATK_SRC[i][s] = srcs;
  }
}

// ---- Zobrist keys (fixed 32-bit halves so every run and every device agree) --------------------
function makeRng(seed) {
  let a = seed >>> 0;
  return () => { a = (Math.imul(a ^ (a >>> 15), 0x2c1b3c6d) + 0x297a2d39) | 0; a ^= a >>> 12; a = Math.imul(a, 0x85ebca6b); a ^= a >>> 13; return a | 0; };
}
const next1 = makeRng(0x9e3779b9), next2 = makeRng(0x243f6a88);
export const PIECE_KEY_L = new Int32Array(13 * 64), PIECE_KEY_H = new Int32Array(13 * 64); // index (type+6)*64+sq, type -6..6
for (let i = 0; i < PIECE_KEY_L.length; i++) { PIECE_KEY_L[i] = next1(); PIECE_KEY_H[i] = next2(); }
export const SIDE_L = next1() | 0, SIDE_H = next2() | 0;
export const CASTLE_KEY_L = new Int32Array(16), CASTLE_KEY_H = new Int32Array(16);
{
  const bitL = [next1(), next1(), next1(), next1()], bitH = [next2(), next2(), next2(), next2()];
  for (let b = 0; b < 16; b++) { let l = 0, h = 0; for (let k = 0; k < 4; k++) if (b & (1 << k)) { l ^= bitL[k]; h ^= bitH[k]; } CASTLE_KEY_L[b] = l; CASTLE_KEY_H[b] = h; }
}
export const EP_KEY_L = new Int32Array(8), EP_KEY_H = new Int32Array(8);
for (let i = 0; i < 8; i++) { EP_KEY_L[i] = next1(); EP_KEY_H[i] = next2(); }
export const zIndex = (piece, sq) => (piece + 6) * 64 + sq;
export const keyNum = (hl, hh) => (hh & 0x1fffff) * 4294967296 + (hl >>> 0);

export function positionKey(board, turn, castle, ep) {
  let hl = turn === BLACK ? SIDE_L : 0, hh = turn === BLACK ? SIDE_H : 0;
  for (let s = 0; s < 64; s++) { const p = board[s]; if (p) { hl ^= PIECE_KEY_L[zIndex(p, s)]; hh ^= PIECE_KEY_H[zIndex(p, s)]; } }
  hl ^= CASTLE_KEY_L[castle]; hh ^= CASTLE_KEY_H[castle];
  if (ep >= 0) { hl ^= EP_KEY_L[fileOf(ep)]; hh ^= EP_KEY_H[fileOf(ep)]; }
  return keyNum(hl, hh);
}

// ---- starting position --------------------------------------------------------------------------
export function startBoard() {
  const b = new Array(64).fill(0), back = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];
  for (let f = 0; f < 8; f++) { b[sqOf(f, 0)] = back[f]; b[sqOf(f, 1)] = PAWN; b[sqOf(f, 6)] = -PAWN; b[sqOf(f, 7)] = -back[f]; }
  return b;
}
export function newState() {
  return { board: startBoard(), turn: WHITE, castle: WK | WQ | BK | BQ, ep: -1, halfmove: 0, fullmove: 1, wk: 4, bk: 60 };
}
export function cloneState(st) { return { board: st.board.slice(), turn: st.turn, castle: st.castle, ep: st.ep, halfmove: st.halfmove, fullmove: st.fullmove, wk: st.wk, bk: st.bk }; }

// ---- attack detection -----------------------------------------------------------------------------
export function attacked(board, s, by) {
  const i = sideIdx(by);
  const srcs = PAWN_ATK_SRC[i][s];
  for (let k = 0; k < srcs.length; k++) if (board[srcs[k]] === by * PAWN) return true;
  const km = KNIGHT_MOVES[s];
  for (let k = 0; k < km.length; k++) if (board[km[k]] === by * KNIGHT) return true;
  const km2 = KING_MOVES[s];
  for (let k = 0; k < km2.length; k++) if (board[km2[k]] === by * KING) return true;
  const rays = RAYS[s];
  for (let d = 0; d < 4; d++) { const r = rays[d]; for (let k = 0; k < r.length; k++) { const q = board[r[k]]; if (q !== 0) { if ((q > 0) === (by > 0) && (abs(q) === ROOK || abs(q) === QUEEN)) return true; break; } } }
  for (let d = 4; d < 8; d++) { const r = rays[d]; for (let k = 0; k < r.length; k++) { const q = board[r[k]]; if (q !== 0) { if ((q > 0) === (by > 0) && (abs(q) === BISHOP || abs(q) === QUEEN)) return true; break; } } }
  return false;
}
export function kingSquareOf(board, side) {
  const k = side * KING;
  for (let s = 0; s < 64; s++) if (board[s] === k) return s;
  return -1;
}

// ---- pseudo-legal move generation ------------------------------------------------------------------
// Fills `buf` (an Int32Array) starting at index n, returns the new count.
export function genInto(board, side, ep, castle, buf, n, capsOnly) {
  const i = sideIdx(side);
  for (let s = 0; s < 64; s++) {
    const p = board[s];
    if (p === 0 || (p > 0) !== (side > 0)) continue;
    const t = abs(p);
    if (t === PAWN) {
      const promoRank = side === WHITE ? 7 : 0;
      const one = PAWN_PUSH[i][s];
      if (!capsOnly && one >= 0 && board[one] === 0) {
        if (rankOf(one) === promoRank) { buf[n++] = encodeMove(s, one, 0, QUEEN); buf[n++] = encodeMove(s, one, 0, ROOK); buf[n++] = encodeMove(s, one, 0, BISHOP); buf[n++] = encodeMove(s, one, 0, KNIGHT); }
        else buf[n++] = encodeMove(s, one);
        const two = PAWN_DOUBLE[i][s];
        if (two >= 0 && board[two] === 0) buf[n++] = encodeMove(s, two, MOVE_DOUBLE);
      }
      const caps = PAWN_CAPS[i][s];
      for (let k = 0; k < caps.length; k++) {
        const to = caps[k], q = board[to];
        if (to === ep) { buf[n++] = encodeMove(s, to, MOVE_EP); continue; }
        if (q !== 0 && (q > 0) !== (side > 0)) {
          if (rankOf(to) === promoRank) { buf[n++] = encodeMove(s, to, 0, QUEEN); buf[n++] = encodeMove(s, to, 0, ROOK); buf[n++] = encodeMove(s, to, 0, BISHOP); buf[n++] = encodeMove(s, to, 0, KNIGHT); }
          else buf[n++] = encodeMove(s, to);
        }
      }
      // queen promotion by pushing onto the last rank is a forcing, capture-like move: include in qsearch
      if (capsOnly && one >= 0 && board[one] === 0 && rankOf(one) === promoRank) buf[n++] = encodeMove(s, one, 0, QUEEN);
    } else if (t === KNIGHT) {
      const l = KNIGHT_MOVES[s];
      for (let k = 0; k < l.length; k++) { const q = board[l[k]]; if (q === 0) { if (!capsOnly) buf[n++] = encodeMove(s, l[k]); } else if ((q > 0) !== (side > 0)) buf[n++] = encodeMove(s, l[k]); }
    } else if (t === KING) {
      const l = KING_MOVES[s];
      for (let k = 0; k < l.length; k++) { const q = board[l[k]]; if (q === 0) { if (!capsOnly) buf[n++] = encodeMove(s, l[k]); } else if ((q > 0) !== (side > 0)) buf[n++] = encodeMove(s, l[k]); }
      if (!capsOnly) {
        const home = side === WHITE ? 4 : 60;
        if (s === home) {
          const opp = -side;
          if ((castle & (side === WHITE ? WK : BK)) && board[home + 1] === 0 && board[home + 2] === 0 && !attacked(board, home, opp) && !attacked(board, home + 1, opp) && !attacked(board, home + 2, opp)) buf[n++] = encodeMove(s, home + 2, MOVE_OO);
          if ((castle & (side === WHITE ? WQ : BQ)) && board[home - 1] === 0 && board[home - 2] === 0 && board[home - 3] === 0 && !attacked(board, home, opp) && !attacked(board, home - 1, opp) && !attacked(board, home - 2, opp)) buf[n++] = encodeMove(s, home - 2, MOVE_OOO);
        }
      }
    } else {
      const dirs = t === BISHOP ? BISHOP_DIRS : t === ROOK ? ROOK_DIRS : [0, 1, 2, 3, 4, 5, 6, 7];
      const rays = RAYS[s];
      for (let d = 0; d < dirs.length; d++) {
        const r = rays[dirs[d]];
        for (let k = 0; k < r.length; k++) {
          const q = board[r[k]];
          if (q === 0) { if (!capsOnly) buf[n++] = encodeMove(s, r[k]); }
          else { if ((q > 0) !== (side > 0)) buf[n++] = encodeMove(s, r[k]); break; }
        }
      }
    }
  }
  return n;
}

// ---- FEN (a compact way to describe a position; used by lessons/tests, never randomness) -------
const FEN_LETTER = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING };
export function loadFEN(fen) {
  const [placement, turn, castling, epStr] = fen.trim().split(/\s+/);
  const board = new Array(64).fill(0);
  const rows = placement.split('/');
  for (let i = 0; i < 8; i++) {
    const rank = 7 - i; let f = 0;
    for (const ch of rows[i]) {
      if (/[1-8]/.test(ch)) f += Number(ch);
      else { const t = FEN_LETTER[ch.toLowerCase()]; board[sqOf(f, rank)] = ch === ch.toUpperCase() ? t : -t; f++; }
    }
  }
  let castle = 0;
  if (castling && castling !== '-') for (const ch of castling) castle |= ch === 'K' ? WK : ch === 'Q' ? WQ : ch === 'k' ? BK : ch === 'q' ? BQ : 0;
  const ep = epStr && epStr !== '-' ? sqFromName(epStr) : -1;
  const wk = kingSquareOf(board, WHITE), bk = kingSquareOf(board, BLACK);
  return { board, turn: turn === 'b' ? BLACK : WHITE, castle, ep, halfmove: 0, fullmove: 1, wk, bk };
}

// ---- make / unmake on a lean state (used by perft and by the AI search) ------------------------
export function makeMove(state, m) {
  const f = moveFrom(m), t = moveTo(m), flag = moveFlag(m), promo = movePromo(m);
  const board = state.board, side = state.turn, piece = board[f];
  const undo = { captured: 0, ep: state.ep, castle: state.castle, halfmove: state.halfmove, epCapturedSquare: -1, wk: state.wk, bk: state.bk };
  state.ep = -1;
  if (flag === MOVE_EP) {
    const capSq = t - side * 8;
    undo.epCapturedSquare = capSq; undo.captured = board[capSq]; board[capSq] = 0;
  } else undo.captured = board[t];
  board[t] = promo ? side * promo : piece;
  board[f] = 0;
  if (flag === MOVE_DOUBLE) state.ep = (f + t) >> 1;
  if (flag === MOVE_OO) { const rf = t + 1, rt = t - 1; board[rt] = board[rf]; board[rf] = 0; }
  if (flag === MOVE_OOO) { const rf = t - 2, rt = t + 1; board[rt] = board[rf]; board[rf] = 0; }
  if (abs(piece) === KING) { if (side === WHITE) { state.wk = t; state.castle &= ~(WK | WQ); } else { state.bk = t; state.castle &= ~(BK | BQ); } }
  if (f === 0 || t === 0) state.castle &= ~WQ;
  if (f === 7 || t === 7) state.castle &= ~WK;
  if (f === 56 || t === 56) state.castle &= ~BQ;
  if (f === 63 || t === 63) state.castle &= ~BK;
  state.halfmove = (abs(piece) === PAWN || undo.captured) ? 0 : state.halfmove + 1;
  state.turn = -side;
  if (side === BLACK) state.fullmove++;
  return undo;
}
export function unmakeMove(state, m, undo) {
  const f = moveFrom(m), t = moveTo(m), flag = moveFlag(m), promo = movePromo(m);
  const side = -state.turn, board = state.board;
  const movedPiece = board[t];
  board[f] = promo ? side * PAWN : movedPiece;
  board[t] = 0;
  if (flag === MOVE_EP) board[undo.epCapturedSquare] = undo.captured; else board[t] = undo.captured;
  if (flag === MOVE_OO) { const rf = t + 1, rt = t - 1; board[rf] = board[rt]; board[rt] = 0; }
  if (flag === MOVE_OOO) { const rf = t - 2, rt = t + 1; board[rf] = board[rt]; board[rt] = 0; }
  state.turn = side; state.ep = undo.ep; state.castle = undo.castle; state.halfmove = undo.halfmove; state.wk = undo.wk; state.bk = undo.bk;
  if (side === BLACK) state.fullmove--;
}

// ---- perft (move-generator correctness proof; see test/game.test.js) ---------------------------
const PERFT_BUF = []; for (let i = 0; i < 64; i++) PERFT_BUF.push(new Int32Array(256));
export function perft(state, depth) {
  if (depth === 0) return 1;
  const buf = PERFT_BUF[depth], side = state.turn;
  const n = genInto(state.board, side, state.ep, state.castle, buf, 0, false);
  let nodes = 0;
  for (let idx = 0; idx < n; idx++) {
    const m = buf[idx];
    const undo = makeMove(state, m);
    const ksq = side === WHITE ? state.wk : state.bk;
    if (!attacked(state.board, ksq, -side)) nodes += depth === 1 ? 1 : perft(state, depth - 1);
    unmakeMove(state, m, undo);
  }
  return nodes;
}
// perft that also returns a divide (first-move -> subtree count), for debugging.
export function perftDivide(state, depth) {
  const buf = PERFT_BUF[depth] || new Int32Array(256), side = state.turn;
  const n = genInto(state.board, side, state.ep, state.castle, buf, 0, false);
  const out = {};
  for (let idx = 0; idx < n; idx++) {
    const m = buf[idx];
    const undo = makeMove(state, m);
    const ksq = side === WHITE ? state.wk : state.bk;
    const legal = !attacked(state.board, ksq, -side);
    if (legal) out[sqName(moveFrom(m)) + sqName(moveTo(m)) + (movePromo(m) ? PIECE_LETTER[movePromo(m)] : '')] = depth === 1 ? 1 : perft(state, depth - 1);
    unmakeMove(state, m, undo);
  }
  return out;
}

// ---- legal moves (decoded, for the UI / lessons / tests) ---------------------------------------
const LEGAL_BUF = new Int32Array(256);
export function legalMovesRaw(state) {
  const side = state.turn;
  const n = genInto(state.board, side, state.ep, state.castle, LEGAL_BUF, 0, false);
  const out = [];
  for (let idx = 0; idx < n; idx++) {
    const m = LEGAL_BUF[idx];
    const undo = makeMove(state, m);
    const ksq = side === WHITE ? state.wk : state.bk;
    const legal = !attacked(state.board, ksq, -side);
    unmakeMove(state, m, undo);
    if (legal) out.push(m);
  }
  return out;
}
export const legalMoves = (state) => legalMovesRaw(state).map((m) => ({ from: moveFrom(m), to: moveTo(m), flag: moveFlag(m), promo: movePromo(m) }));
export const legalTargets = (state, from) => legalMovesRaw(state).filter((m) => moveFrom(m) === from).map((m) => ({ to: moveTo(m), promo: movePromo(m), flag: moveFlag(m) }));
export const inCheck = (state, side = state.turn) => attacked(state.board, side === WHITE ? state.wk : state.bk, -side);
export const isCapture = (state, m) => state.board[moveTo(m)] !== 0 || moveFlag(m) === MOVE_EP;

// ---- insufficient material --------------------------------------------------------------------
function bishopSquareColor(s) { return (fileOf(s) + rankOf(s)) & 1; }
export function insufficientMaterial(board) {
  const pieces = { w: [], b: [] };
  for (let s = 0; s < 64; s++) { const p = board[s]; if (!p || abs(p) === KING) continue; (p > 0 ? pieces.w : pieces.b).push({ t: abs(p), s }); }
  const w = pieces.w, b = pieces.b;
  if (w.length === 0 && b.length === 0) return true;
  if (w.length === 0 && b.length === 1 && (b[0].t === KNIGHT || b[0].t === BISHOP)) return true;
  if (b.length === 0 && w.length === 1 && (w[0].t === KNIGHT || w[0].t === BISHOP)) return true;
  if (w.length === 1 && b.length === 1 && w[0].t === BISHOP && b[0].t === BISHOP && bishopSquareColor(w[0].s) === bishopSquareColor(b[0].s)) return true;
  return false;
}

// ---- the game: state + log + result, the object the UI plays against ---------------------------
export const NO_PROGRESS_LIMIT = 100; // plies (50-move rule)
export function newGame() {
  const g = { st: newState(), log: [], keyCounts: new Map(), result: null };
  bumpKey(g);
  judge(g);
  return g;
}
export function fromState(st) {
  const g = { st, log: [], keyCounts: new Map(), result: null };
  bumpKey(g);
  judge(g);
  return g;
}
function bumpKey(g) {
  const k = positionKey(g.st.board, g.st.turn, g.st.castle, g.st.ep);
  g.keyCounts.set(k, (g.keyCounts.get(k) || 0) + 1);
  return k;
}
export function cloneGame(g) {
  return { st: cloneState(g.st), log: g.log.slice(), keyCounts: new Map(g.keyCounts), result: g.result ? { ...g.result } : null };
}

function judge(g) {
  g.result = null;
  const moves = legalMovesRaw(g.st);
  if (moves.length === 0) { g.result = inCheck(g.st) ? { winner: -g.st.turn, why: 'checkmate' } : { winner: 0, why: 'stalemate' }; return; }
  if (g.st.halfmove >= NO_PROGRESS_LIMIT) { g.result = { winner: 0, why: 'fifty-move' }; return; }
  const k = positionKey(g.st.board, g.st.turn, g.st.castle, g.st.ep);
  if ((g.keyCounts.get(k) || 0) >= 3) { g.result = { winner: 0, why: 'repetition' }; return; }
  if (insufficientMaterial(g.st.board)) { g.result = { winner: 0, why: 'insufficient-material' }; return; }
}

export function applyMove(g, m) {
  const packed = typeof m === 'number' ? m : encodeMove(m.from, m.to, m.flag || 0, m.promo || 0);
  const side = g.st.turn, mover = g.st.board[moveFrom(packed)];
  const cap = isCapture(g.st, packed);
  const legalBefore = legalMovesRaw(g.st); // must be read before the board mutates (SAN disambiguation)
  const sanCore = sanBody(g.st.board, packed, legalBefore); // "e4", "Nf3", "O-O", "Qxd5", "e8=Q" (no +/#: added once we know the result)
  const undo = makeMove(g.st, packed);
  const chk = inCheck(g.st, g.st.turn);
  g.log.push({ m: packed, undo, side, piece: mover, cap, sanCore });
  bumpKey(g);
  judge(g);
  const mateNow = g.result && g.result.winner !== 0 && g.result.why === 'checkmate';
  const san = sanCore + (mateNow ? '#' : chk ? '+' : '');
  g.log[g.log.length - 1].san = san;
  return { move: packed, cap, chk, san };
}
export function undoMove(g) {
  const e = g.log.pop();
  if (!e) return false;
  const k = positionKey(g.st.board, g.st.turn, g.st.castle, g.st.ep);
  const c = g.keyCounts.get(k); if (c) { if (c <= 1) g.keyCounts.delete(k); else g.keyCounts.set(k, c - 1); }
  unmakeMove(g.st, e.m, e.undo);
  judge(g);
  return true;
}

// Try a from/to (+ optional promo); { ok:true, move } when legal, otherwise { ok:false, why }.
export function tryMove(g, from, to, promo = QUEEN) {
  const board = g.st.board, p = board[from];
  if (!p || (p > 0) !== (g.st.turn > 0)) return { ok: false, code: 'notyours', why: p ? 'That is not your piece. Wait for your turn.' : 'There is no piece on that square.' };
  const cands = legalMovesRaw(g.st).filter((m) => moveFrom(m) === from && moveTo(m) === to);
  if (cands.length === 0) {
    const why = explainIllegal(g, from, to);
    return { ok: false, code: 'illegal', why };
  }
  let chosen = cands[0];
  if (cands.length > 1) { const withPromo = cands.find((m) => movePromo(m) === promo); chosen = withPromo || cands[0]; }
  return { ok: true, move: { from, to, flag: moveFlag(chosen), promo: movePromo(chosen), needsPromoChoice: movePromo(chosen) !== 0 } };
}
export function needsPromotion(g, from, to) {
  const cands = legalMovesRaw(g.st).filter((m) => moveFrom(m) === from && moveTo(m) === to);
  return cands.length > 0 && movePromo(cands[0]) !== 0;
}

function explainIllegal(g, from, to) {
  const board = g.st.board, p = board[from], side = g.st.turn, t = abs(p);
  const q = board[to];
  if (from === to) return 'A move must go to a different square.';
  if (q !== 0 && (q > 0) === (p > 0)) return 'One of your own pieces is on that square. You can only capture the opponent\'s pieces.';
  const ff = fileOf(from), fr = rankOf(from), tf = fileOf(to), tr = rankOf(to), df = tf - ff, dr = tr - fr, adf = abs(df), adr = abs(dr);
  const clear = (a, b) => {
    const stepF = Math.sign(fileOf(b) - fileOf(a)), stepR = Math.sign(rankOf(b) - rankOf(a));
    let f = fileOf(a) + stepF, r = rankOf(a) + stepR;
    while (f !== fileOf(b) || r !== rankOf(b)) { if (board[sqOf(f, r)] !== 0) return false; f += stepF; r += stepR; }
    return true;
  };
  switch (t) {
    case PAWN: {
      const fwd = side === WHITE ? 1 : -1;
      if (adf === 0) {
        if (q !== 0) return 'A pawn cannot capture straight ahead. It only captures diagonally.';
        if (dr === fwd) return 'That square is occupied or otherwise blocked.';
        if (dr === 2 * fwd) return 'A pawn may advance two squares only from its starting rank, and only if both squares ahead are empty.';
        return 'A pawn moves straight ahead (one square, or two from its starting rank) and captures only diagonally.';
      }
      if (adf === 1 && dr === fwd) { if (to === g.st.ep) return 'illegal-should-not-happen'; return 'A pawn captures diagonally only onto a square with an enemy piece (or, just after a two-square advance beside it, en passant).'; }
      return 'A pawn moves straight ahead and captures only one square diagonally forward.';
    }
    case KNIGHT: return 'A knight moves in an L shape: two squares one way, then one square perpendicular. It jumps over anything in between.';
    case BISHOP:
      if (adf !== adr) return 'A bishop moves only along a diagonal.';
      return 'A piece is in the way. A bishop cannot jump over other pieces.';
    case ROOK:
      if (df !== 0 && dr !== 0) return 'A rook moves only along a rank or a file.';
      return 'A piece is in the way. A rook cannot jump over other pieces.';
    case QUEEN:
      if (adf !== adr && df !== 0 && dr !== 0) return 'A queen moves in a straight line: along a rank, a file, or a diagonal.';
      return 'A piece is in the way. A queen cannot jump over other pieces.';
    case KING: {
      if (adf <= 1 && adr <= 1) {
        board[to] = p; board[from] = 0; const bad = attacked(board, to, -side); board[from] = p; board[to] = q;
        if (bad) return 'The king cannot move into check.';
        return 'That move is not available right now.';
      }
      if (adf === 2 && adr === 0) {
        const kingside = df > 0;
        if (!(g.st.castle & (side === WHITE ? (kingside ? WK : WQ) : (kingside ? BK : BQ)))) return 'Castling is no longer available on that side: the king or that rook has already moved.';
        if (!clear(from, kingside ? from + 3 : from - 4)) return 'Castling needs every square between the king and that rook to be empty.';
        if (inCheck(g.st)) return 'You cannot castle out of check.';
        return 'Castling is not allowed through or into a square that is attacked.';
      }
      return 'The king moves only one square in any direction (or two, when castling).';
    }
    default: return 'That move is not legal.';
  }
}

// ---- algebraic notation (for the move-list panel) -------------------------------------------------
// IMPORTANT: `board` and `legalBefore` must both be from BEFORE the move is made (applyMove above
// captures them at the right time). The +/# suffix is added by the caller once the result is known.
export function sanBody(board, packed, legalBefore) {
  const from = moveFrom(packed), to = moveTo(packed), flag = moveFlag(packed), promo = movePromo(packed);
  if (flag === MOVE_OO) return 'O-O';
  if (flag === MOVE_OOO) return 'O-O-O';
  const piece = board[from], t = abs(piece), cap = board[to] !== 0 || flag === MOVE_EP;
  let s = '';
  if (t === PAWN) {
    if (cap) s += FILES[fileOf(from)] + 'x';
    s += sqName(to);
    if (promo) s += '=' + PIECE_LETTER[promo];
  } else {
    s += PIECE_LETTER[t];
    const others = (legalBefore || []).filter((m) => m !== packed && moveTo(m) === to && abs(board[moveFrom(m)]) === t && (board[moveFrom(m)] > 0) === (piece > 0));
    if (others.length) {
      const sameFile = others.some((m) => fileOf(moveFrom(m)) === fileOf(from));
      const sameRank = others.some((m) => rankOf(moveFrom(m)) === rankOf(from));
      if (!sameFile) s += FILES[fileOf(from)]; else if (!sameRank) s += String(rankOf(from) + 1); else s += sqName(from);
    }
    if (cap) s += 'x';
    s += sqName(to);
  }
  return s;
}
// Plain-language description of a move already on the log (g.log entries carry `piece`/`cap`).
export function describe(g, logEntry) {
  const { piece, cap, m } = logEntry, flag = moveFlag(m);
  if (flag === MOVE_OO) return SIDE_NAME[piece > 0 ? 1 : -1] + ' castles kingside';
  if (flag === MOVE_OOO) return SIDE_NAME[piece > 0 ? 1 : -1] + ' castles queenside';
  const name = TYPE_NAME[abs(piece)];
  return `${SIDE_NAME[piece > 0 ? 1 : -1]} ${name}${cap ? ' takes' : ''}`;
}
