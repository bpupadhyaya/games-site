// Makruk rules: the single source of truth (the Rules pages, the lessons and the engine all follow this file).
// Squares are 0..63, sq = rank * 8 + file; rank 0 is Gold's home row (the bottom of the screen for Gold).
// Pieces are signed: + Gold (moves first, up the board), - Ruby. Codes: see PIECE below.
//
// Real Makruk, as implemented:
//  - Khun (king) steps 1 any direction.  Met steps 1 diagonally.  Khon steps 1 diagonally or 1 straight forward.
//  - Ma (knight) jumps.  Rua (rook) slides orthogonally.  Bia (pawn) steps 1 forward, captures 1 diagonally forward.
//  - Bia start on the third rank; a Bia that reaches the sixth rank (its own count) becomes a Bia-ngai (steps like a Met).
//  - No double step, no en passant, no castling.  Checkmate wins; stalemate is a draw.
//  - Counting (automatic here): Board's honour once no Bia remain (count 1..64); Pieces' honour once one side has only
//    its Khun (count starts at pieces on the board + 1, limit from the stronger side's best pieces).
//  - Shipped simplification: threefold repetition is also a draw.
export const WHITE = 1, BLACK = -1;
export const BIA = 1, MET = 2, KHON = 3, MA = 4, RUA = 5, KHUN = 6, NGAI = 7;
export const TYPE_NAME = ['', 'Bia', 'Met', 'Khon', 'Ma', 'Rua', 'Khun', 'Bia-ngai'];
export const TYPE_ENGLISH = ['', 'pawn', 'queen', 'bishop', 'knight', 'rook', 'king', 'promoted pawn'];
export const SIDE_NAME = { 1: 'Gold', '-1': 'Ruby' };
export const sideName = (s) => (s > 0 ? 'Gold' : 'Ruby');
export const fileOf = (s) => s & 7;
export const rankOf = (s) => s >> 3;
export const sq = (file, rank) => rank * 8 + file;
export const sqName = (s) => String.fromCharCode(97 + fileOf(s)) + (rankOf(s) + 1);
export const parseSq = (n) => sq(n.charCodeAt(0) - 97, Number(n[1]) - 1);
export const PROMO_RANK = { 1: 5, '-1': 2 }; // the sixth rank counted from each side's own home row
export const NO_PAWN_COUNT_LIMIT = 64;
export const REPETITION_LIMIT = 3;

// ---- tables -----------------------------------------------------------------------------------------------------------
const inb = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
function table(deltas) {
  const out = [];
  for (let s = 0; s < 64; s++) { const l = []; for (const [df, dr] of deltas) { const f = fileOf(s) + df, r = rankOf(s) + dr; if (inb(f, r)) l.push(sq(f, r)); } out.push(Int8Array.from(l)); }
  return out;
}
export const KING_MOVES = table([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
export const DIAG_MOVES = table([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
export const KNIGHT_MOVES = table([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]);
export const FWD_W = table([[0, 1]]), FWD_B = table([[0, -1]]);
export const PAWN_CAP_W = table([[1, 1], [-1, 1]]), PAWN_CAP_B = table([[1, -1], [-1, -1]]);
function rayTable() {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]], out = [];
  for (let s = 0; s < 64; s++) {
    const rays = [];
    for (const [df, dr] of dirs) { const l = []; let f = fileOf(s) + df, r = rankOf(s) + dr; while (inb(f, r)) { l.push(sq(f, r)); f += df; r += dr; } rays.push(Int8Array.from(l)); }
    out.push(rays);
  }
  return out;
}
export const RAYS = rayTable();

export function startBoard() {
  const b = new Int8Array(64);
  const white = [RUA, MA, KHON, KHUN, MET, KHON, MA, RUA], black = [RUA, MA, KHON, MET, KHUN, KHON, MA, RUA];
  for (let f = 0; f < 8; f++) { b[sq(f, 0)] = white[f]; b[sq(f, 7)] = -black[f]; b[sq(f, 2)] = BIA; b[sq(f, 5)] = -BIA; }
  return b;
}

// ---- attacks and move generation (hot path: used by the engine too) --------------------------------------------------------
export function attacked(b, s, by) {
  // is square s attacked by a piece of side `by`?
  const own = by > 0;
  const isMine = (p) => (own ? p > 0 : p < 0);
  let l = KING_MOVES[s];
  for (let i = 0; i < l.length; i++) { const p = b[l[i]]; if (p === KHUN * by) return true; }
  l = DIAG_MOVES[s];
  for (let i = 0; i < l.length; i++) { const p = b[l[i]]; if (p === MET * by || p === NGAI * by || p === KHON * by) return true; }
  // Khon steps one square straight forward: a Gold Khon attacks the square above it, so it sits one rank below s
  const back = by > 0 ? s - 8 : s + 8;
  if (back >= 0 && back < 64 && b[back] === KHON * by) return true;
  // Bia attack diagonally forward: the attacker sits diagonally behind s
  l = by > 0 ? PAWN_CAP_B[s] : PAWN_CAP_W[s];
  for (let i = 0; i < l.length; i++) { if (b[l[i]] === BIA * by) return true; }
  l = KNIGHT_MOVES[s];
  for (let i = 0; i < l.length; i++) { if (b[l[i]] === MA * by) return true; }
  const rays = RAYS[s];
  for (let d = 0; d < 4; d++) { const r = rays[d]; for (let k = 0; k < r.length; k++) { const p = b[r[k]]; if (p !== 0) { if (p === RUA * by) return true; break; } } }
  void isMine;
  return false;
}
export function findKing(b, side) { const k = KHUN * side; for (let s = 0; s < 64; s++) if (b[s] === k) return s; return -1; }
export function inCheckBoard(b, side) { const k = findKing(b, side); return k >= 0 && attacked(b, k, -side); }

// packed move: from | to << 6 | promo << 12
export const mFrom = (m) => m & 63, mTo = (m) => (m >> 6) & 63, mPromo = (m) => (m >> 12) & 1;
export const pack = (f, t, promo) => f | (t << 6) | (promo ? 1 << 12 : 0);

// Pseudo-legal moves of `side` into out (array-like); returns the count. capsOnly: captures only (for quiescence).
export function genInto(b, side, out, n, capsOnly) {
  const enemy = (p) => (side > 0 ? p < 0 : p > 0);
  const add = (f, t, promo = false) => { out[n++] = pack(f, t, promo); };
  const stepper = (f, list) => { for (let i = 0; i < list.length; i++) { const t = list[i], p = b[t]; if (p === 0) { if (!capsOnly) add(f, t); } else if (enemy(p)) add(f, t); } };
  const pr = PROMO_RANK[side];
  for (let s = 0; s < 64; s++) {
    const p = b[s]; if (p === 0 || (side > 0) !== (p > 0)) continue;
    const t = p > 0 ? p : -p;
    if (t === BIA) {
      const fw = side > 0 ? FWD_W[s] : FWD_B[s];
      if (fw.length && b[fw[0]] === 0 && !capsOnly) add(s, fw[0], rankOf(fw[0]) === pr);
      const cl = side > 0 ? PAWN_CAP_W[s] : PAWN_CAP_B[s];
      for (let i = 0; i < cl.length; i++) if (enemy(b[cl[i]])) add(s, cl[i], rankOf(cl[i]) === pr);
    } else if (t === MET || t === NGAI) stepper(s, DIAG_MOVES[s]);
    else if (t === KHON) {
      stepper(s, DIAG_MOVES[s]);
      const fw = side > 0 ? FWD_W[s] : FWD_B[s];
      if (fw.length) { const q = b[fw[0]]; if (q === 0) { if (!capsOnly) add(s, fw[0]); } else if (enemy(q)) add(s, fw[0]); }
    } else if (t === KHUN) stepper(s, KING_MOVES[s]);
    else if (t === MA) stepper(s, KNIGHT_MOVES[s]);
    else if (t === RUA) {
      const rays = RAYS[s];
      for (let d = 0; d < 4; d++) { const r = rays[d]; for (let k = 0; k < r.length; k++) { const q = b[r[k]]; if (q === 0) { if (!capsOnly) add(s, r[k]); } else { if (enemy(q)) add(s, r[k]); break; } } }
    }
  }
  return n;
}
const scratch = new Int32Array(256);
// Apply a packed move to a raw board; returns the captured piece (for undo with unmakeRaw).
export function makeRaw(b, m) {
  const f = mFrom(m), t = mTo(m), p = b[f], cap = b[t];
  b[t] = mPromo(m) ? (p > 0 ? NGAI : -NGAI) : p; b[f] = 0;
  return cap;
}
export function unmakeRaw(b, m, cap) {
  const f = mFrom(m), t = mTo(m), p = b[t];
  b[f] = mPromo(m) ? (p > 0 ? BIA : -BIA) : p; b[t] = cap;
}
export function legalMovesRaw(b, side) {
  const n = genInto(b, side, scratch, 0, false), out = [];
  for (let i = 0; i < n; i++) { const m = scratch[i], cap = makeRaw(b, m); if (!inCheckBoard(b, side)) out.push(m); unmakeRaw(b, m, cap); }
  return out;
}

// ---- counting -----------------------------------------------------------------------------------------------------------
const MV = [0, 1, 2, 2.5, 3, 5, 0, 2];
export function sideStats(b, side) {
  const c = { bia: 0, met: 0, khon: 0, ma: 0, rua: 0, ngai: 0, pieces: 0, value: 0 };
  for (let s = 0; s < 64; s++) {
    const p = b[s]; if (p === 0 || (p > 0) !== (side > 0)) continue;
    const t = p > 0 ? p : -p; if (t === KHUN) continue;
    c.pieces++; c.value += MV[t];
    if (t === BIA) c.bia++; else if (t === MET) c.met++; else if (t === KHON) c.khon++; else if (t === MA) c.ma++; else if (t === RUA) c.rua++; else c.ngai++;
  }
  return c;
}
// Pieces' honour limit: the smallest of the conditions that hold for the stronger side's pieces.
export function piecesLimit(c) {
  let lim = 64;
  if (c.rua >= 2) lim = Math.min(lim, 8);
  if (c.rua >= 1) lim = Math.min(lim, 16);
  if (c.khon >= 2) lim = Math.min(lim, 22);
  if (c.ma >= 2) lim = Math.min(lim, 32);
  if (c.khon >= 1) lim = Math.min(lim, 44);
  if (c.ma >= 1) lim = Math.min(lim, 64);
  return lim;
}
export const LIMIT_TABLE = [['Two Rua', 8], ['One Rua', 16], ['Two Khon', 22], ['Two Ma', 32], ['One Khon', 44], ['One Ma', 64], ['Only Met or Bia-ngai', 64]];
function totalPieces(b) { let n = 0; for (let s = 0; s < 64; s++) if (b[s] !== 0) n++; return n; }

// Advance the count after `mover` moved on board b. prev = the count before the move (or null). Returns { count, draw }.
export function nextCount(b, mover, prev) {
  let count = prev ? { ...prev } : null, draw = null;
  if (count && mover === count.chaser) {
    if (count.n >= count.limit) draw = 'count'; else count.n++;
  }
  const w = sideStats(b, WHITE), k = sideStats(b, BLACK);
  if (w.bia + k.bia > 0) return { count: null, draw: null };
  if (w.pieces === 0 && k.pieces === 0) return { count: null, draw: 'bare' };
  if (w.pieces === 0 || k.pieces === 0) {
    const chaser = w.pieces === 0 ? BLACK : WHITE, stats = chaser === WHITE ? w : k;
    if (!count || count.kind !== 'pieces' || count.chaser !== chaser) count = { kind: 'pieces', chaser, n: totalPieces(b) + 1, limit: piecesLimit(stats) };
    return { count, draw };
  }
  if (!count || count.kind !== 'board') count = { kind: 'board', chaser: w.value >= k.value ? WHITE : BLACK, n: 1, limit: NO_PAWN_COUNT_LIMIT };
  else if (w.value !== k.value) count.chaser = w.value > k.value ? WHITE : BLACK;
  return { count, draw };
}

// ---- game object ---------------------------------------------------------------------------------------------------------
const keyOf = (b, turn) => `${turn}${b.join(',')}`;
export function newGame(board = null, turn = WHITE) {
  const b = board ? Int8Array.from(board) : startBoard();
  const g = { board: b, turn, hist: [], log: [], count: null, result: null, keys: [keyOf(b, turn)] };
  return g;
}
export const inCheck = (g) => inCheckBoard(g.board, g.turn);
export function legalMoves(g) {
  return legalMovesRaw(g.board, g.turn).map((m) => ({ from: mFrom(m), to: mTo(m), promo: !!mPromo(m), cap: g.board[mTo(m)], m }));
}
export function legalTargets(g, from) { return legalMoves(g).filter((x) => x.from === from); }
export function tryMove(g, from, to) {
  const mv = legalMoves(g).find((x) => x.from === from && x.to === to);
  if (mv) return { ok: true, move: mv };
  const p = g.board[from];
  if (!p || (p > 0) !== (g.turn > 0)) return { ok: false, why: 'That is not your piece to move.' };
  const t = Math.abs(p);
  const pseudo = (() => { const tmp = []; const n = genInto(g.board, g.turn, scratch, 0, false); for (let i = 0; i < n; i++) tmp.push(scratch[i]); return tmp.find((m) => mFrom(m) === from && mTo(m) === to); })();
  if (pseudo !== undefined) return { ok: false, why: inCheck(g) ? 'You are in check: that move does not get your Khun out of check.' : `That would leave your Khun in check.` };
  if (g.board[to] && (g.board[to] > 0) === (p > 0)) return { ok: false, why: 'One of your own pieces is on that square.' };
  const hints = { 1: 'A Bia steps one square forward, or captures one square diagonally forward.', 2: 'A Met steps one square diagonally.', 3: 'A Khon steps one square diagonally, or one square straight forward.', 4: 'A Ma jumps: two squares one way, then one to the side.', 5: 'A Rua slides along a row or a file, and cannot jump.', 6: 'A Khun steps one square in any direction.', 7: 'A Bia-ngai steps one square diagonally, like a Met.' };
  return { ok: false, why: hints[t] };
}
function snapshot(g) { return { board: g.board.slice(), turn: g.turn, count: g.count ? { ...g.count } : null, result: g.result, logLen: g.log.length }; }
export function applyMove(g, mv) {
  g.hist.push(snapshot(g));
  const mover = g.turn, piece = g.board[mv.from], cap = g.board[mv.to];
  makeRaw(g.board, mv.m ?? pack(mv.from, mv.to, mv.promo));
  g.turn = -mover;
  const chk = inCheck(g);
  const entry = { from: mv.from, to: mv.to, piece, cap, promo: !!mv.promo, chk, side: mover };
  g.log.push(entry);
  const replies = legalMovesRaw(g.board, g.turn);
  let end = null;
  if (replies.length === 0) end = chk ? { winner: mover, why: 'checkmate' } : { winner: 0, why: 'stalemate' };
  const c = nextCount(g.board, mover, g.count);
  g.count = c.count;
  if (!end && c.draw) end = { winner: 0, why: c.draw };
  const key = keyOf(g.board, g.turn); g.keys.push(key);
  if (!end && g.keys.filter((k) => k === key).length >= REPETITION_LIMIT) end = { winner: 0, why: 'repetition' };
  if (end) g.result = end;
  return { move: mv, cap, chk, mate: end && end.why === 'checkmate', end, promo: !!mv.promo, piece };
}
export function undoMove(g) {
  const s = g.hist.pop(); if (!s) return false;
  g.board.set(s.board); g.turn = s.turn; g.count = s.count; g.result = s.result; g.log.length = s.logLen; g.keys.pop();
  return true;
}
// A readable, plain-English description of a move (used by Think and Watch & Learn).
export function describeMove(g, mv) {
  const p = g.board[mv.from], t = Math.abs(p), who = TYPE_NAME[t], cap = g.board[mv.to];
  let s = `${who} ${sqName(mv.from)} to ${sqName(mv.to)}`;
  if (cap) s += `, taking the ${TYPE_NAME[Math.abs(cap)]}`;
  if (mv.promo) s += ', and it becomes a Bia-ngai';
  return s;
}
// Cheapest piece value (in Bia units) among the pieces of `by` that attack square s; 99 if none.
const ATT_VAL = [0, 1, 2, 2.5, 3, 5, 6, 2];
export function cheapestAttacker(b, s, by) {
  let best = 99;
  const note = (p, ok) => { if (p === 0 || !ok) return; const t = p > 0 ? p : -p; if (ATT_VAL[t] < best) best = ATT_VAL[t]; };
  const mine = (p) => p !== 0 && (p > 0) === (by > 0);
  let l = KING_MOVES[s]; for (let i = 0; i < l.length; i++) note(b[l[i]], b[l[i]] === KHUN * by);
  l = DIAG_MOVES[s]; for (let i = 0; i < l.length; i++) { const p = b[l[i]]; note(p, mine(p) && (Math.abs(p) === MET || Math.abs(p) === NGAI || Math.abs(p) === KHON)); }
  const back = by > 0 ? s - 8 : s + 8; if (back >= 0 && back < 64) note(b[back], b[back] === KHON * by);
  l = by > 0 ? PAWN_CAP_B[s] : PAWN_CAP_W[s]; for (let i = 0; i < l.length; i++) note(b[l[i]], b[l[i]] === BIA * by);
  l = KNIGHT_MOVES[s]; for (let i = 0; i < l.length; i++) note(b[l[i]], b[l[i]] === MA * by);
  const rays = RAYS[s]; for (let d = 0; d < 4; d++) { const r = rays[d]; for (let k = 0; k < r.length; k++) { const p = b[r[k]]; if (p !== 0) { note(p, p === RUA * by); break; } } }
  return best;
}
// Pieces of `side` that the other side could profitably take next move: attacked and either undefended or attacked by a cheaper piece.
export function threatened(g, side) {
  const out = [], b = g.board;
  for (let s = 0; s < 64; s++) {
    const p = b[s]; if (!p || (p > 0) !== (side > 0)) continue;
    const t = p > 0 ? p : -p; if (t === KHUN) continue;
    const low = cheapestAttacker(b, s, -side); if (low === 99) continue;
    if (!attacked(b, s, side) || low < ATT_VAL[t]) out.push(s);
  }
  return out;
}
export function countInfo(g) {
  if (!g.count) return null;
  const c = g.count;
  return { ...c, left: Math.max(1, c.limit - c.n + 1) };
}
