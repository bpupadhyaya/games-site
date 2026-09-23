// The computer's brain. Negamax alpha-beta with a Zobrist transposition table, iterative deepening,
// MVV-LVA + killer + history move ordering, capture quiescence at the leaves, and a small curated
// opening table. It uses rules.js for move generation, so it plays exactly the real rules.
//
// It never blocks a frame: createThinker(...).step() searches at most STEP_NODES nodes and returns.
// When a step's node budget runs out the search throws ABORT and the next step re-walks the same
// path; every finished sub-tree is already in the transposition table, so little work is repeated.
// Work is counted in nodes, never wall-clock time, so play stays deterministic frame to frame.
import {
  genInto, attacked, positionKey, zIndex, PIECE_KEY_L, PIECE_KEY_H, SIDE_L, SIDE_H, CASTLE_KEY_L, CASTLE_KEY_H,
  EP_KEY_L, EP_KEY_H, keyNum, legalMovesRaw, makeMove, unmakeMove, cloneState, WHITE, BLACK,
  PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, fileOf, rankOf, RAYS, KNIGHT_MOVES, KING_MOVES, ROOK_DIRS, BISHOP_DIRS,
} from './rules.js';

export const STEP_NODES = 2500; // nodes per step(): keeps a single frame well under a millisecond on a phone CPU
const MATE = 30000, INF = 32000;
const ABORT = { abort: true };

// One strength table per level. depth = deepest iteration attempted; budget = total nodes the whole
// move gets; noise = centipawns of random wobble mixed into the root choice (weaker, more human
// play); random = chance of just playing a random legal move (true blunders, for Beginner).
export const LEVELS = [
  null,
  { name: 'Beginner', depth: 2, budget: 6000, noise: 220, random: 0.28, book: false },
  { name: 'Casual', depth: 3, budget: 16000, noise: 120, random: 0.08, book: true },
  { name: 'Club', depth: 4, budget: 60000, noise: 40, random: 0, book: true },
  { name: 'Expert', depth: 6, budget: 220000, noise: 0, random: 0, book: true },
  { name: 'Master', depth: 8, budget: 650000, noise: 0, random: 0, book: true },
  { name: 'Grandmaster', depth: 10, budget: 1600000, noise: 0, random: 0, book: true },
];
export const LEVEL_COUNT = LEVELS.length - 1;

// ---- a small, generic opening table (well-known chess theory; no branded/proprietary lines) -----
// Each line is a sequence of "from-to[=promo]" UCI-ish coordinate moves from the start position.
// Generic mainline openings that any chess book documents; nothing here is exclusive to any product.
export const OPENING_LINES = [
  'e2e4 e7e5 g1f3 b8c6 f1b5',                 // Spanish opening main line
  'e2e4 e7e5 g1f3 b8c6 f1c4',                 // Italian opening
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4',       // Sicilian, open
  'e2e4 e7e6 d2d4 d7d5',                       // French defence
  'e2e4 c7c6 d2d4 d7d5',                       // Caro-Kann defence
  'd2d4 d7d5 c2c4 e7e6',                       // Queen\'s Gambit
  'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7',             // King\'s Indian setup
  'd2d4 d7d5 c2c4 c7c6',                       // Slav defence
  'c2c4 e7e5 b1c3 g8f6',                       // English opening
  'g1f3 d7d5 c2c4',                            // Reti opening
];
function parseLine(line) {
  return line.split(' ').map((tok) => {
    const from = (tok.charCodeAt(0) - 97) + (Number(tok[1]) - 1) * 8;
    const to = (tok.charCodeAt(2) - 97) + (Number(tok[3]) - 1) * 8;
    return { from, to };
  });
}
const BOOK = OPENING_LINES.map(parseLine);
// Given the moves played so far (array of {from,to}), return legal book continuations (packed moves) that match.
export function bookMoves(playedFromTo, legalRaw) {
  const out = [];
  for (const line of BOOK) {
    if (line.length <= playedFromTo.length) continue;
    let match = true;
    for (let i = 0; i < playedFromTo.length; i++) if (line[i].from !== playedFromTo[i].from || line[i].to !== playedFromTo[i].to) { match = false; break; }
    if (!match) continue;
    const want = line[playedFromTo.length];
    const found = legalRaw.find((m) => (m & 63) === want.from && ((m >> 6) & 63) === want.to);
    if (found !== undefined && !out.includes(found)) out.push(found);
  }
  return out;
}

// ---- evaluation --------------------------------------------------------------------------------
const VAL = [0, 100, 320, 330, 500, 900, 0];
// Piece-square tables, White's perspective (rank 0 = White's home); mirrored for Black.
/* eslint-disable no-multi-spaces */
const PAWN_PST = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, -20, -20, 10, 10, 5,
  5, -5, -10, 0, 0, -10, -5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, 5, 10, 25, 25, 10, 5, 5,
  10, 10, 20, 30, 30, 20, 10, 10,
  50, 50, 50, 50, 50, 50, 50, 50,
  0, 0, 0, 0, 0, 0, 0, 0,
];
const KNIGHT_PST = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];
const BISHOP_PST = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];
const ROOK_PST = [
  0, 0, 0, 5, 5, 0, 0, 0,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  5, 10, 10, 10, 10, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];
const QUEEN_PST = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -10, 5, 5, 5, 5, 5, 0, -10,
  0, 0, 5, 5, 5, 5, 0, -5,
  -5, 0, 5, 5, 5, 5, 0, -5,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];
const KING_MID_PST = [
  20, 30, 10, 0, 0, 10, 30, 20,
  20, 20, 0, 0, 0, 0, 20, 20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
];
const KING_END_PST = [
  -50, -30, -30, -30, -30, -30, -30, -50,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -50, -40, -30, -20, -20, -30, -40, -50,
];
/* eslint-enable no-multi-spaces */
const PST = [null, PAWN_PST, KNIGHT_PST, BISHOP_PST, ROOK_PST, QUEEN_PST, KING_MID_PST];
// White reads a table top-to-bottom-flipped (rank 7 = index 0 of the table above, since the tables are
// written visually with White's back rank at the bottom); mirror index for Black.
const mirror = (s) => s ^ 56; // flips the rank, keeps the file — turns a White square into Black's mirror
const WPST = PST.map((t) => t && flipToBoard(t));
const KING_END_W = flipToBoard(KING_END_PST);
function flipToBoard(table) {
  // `table` is written rank8..rank1 top to bottom (visual). Convert to board index (rank0=a1..).
  const out = new Int16Array(64);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) out[r * 8 + f] = table[(7 - r) * 8 + f];
  return out;
}
const TEMPO = 10;

function phase(board) {
  let p = 0;
  for (let s = 0; s < 64; s++) { const t = Math.abs(board[s]); if (t === QUEEN) p += 4; else if (t === ROOK) p += 2; else if (t === BISHOP || t === KNIGHT) p += 1; }
  return p; // 24 = full material, 0 = bare kings
}

const scratchMoves = new Int32Array(64);
function mobilityAndSafety(board, side) {
  let mob = 0, attackersNearKing = 0;
  const oppK = side === WHITE ? findKing(board, BLACK) : findKing(board, WHITE);
  for (let s = 0; s < 64; s++) {
    const p = board[s]; if (!p || (p > 0) !== (side > 0)) continue;
    const t = Math.abs(p);
    if (t === KNIGHT) { const l = KNIGHT_MOVES[s]; for (let k = 0; k < l.length; k++) { const q = board[l[k]]; if (q === 0 || (q > 0) !== (side > 0)) mob++; if (oppK >= 0 && kingRingDist(l[k], oppK) <= 1) attackersNearKing++; } }
    else if (t === BISHOP || t === ROOK || t === QUEEN) {
      const dirs = t === BISHOP ? BISHOP_DIRS : t === ROOK ? ROOK_DIRS : [0, 1, 2, 3, 4, 5, 6, 7];
      const rays = RAYS[s];
      for (let d = 0; d < dirs.length; d++) { const r = rays[dirs[d]]; for (let k = 0; k < r.length; k++) { const q = board[r[k]]; mob++; if (oppK >= 0 && kingRingDist(r[k], oppK) <= 1) attackersNearKing++; if (q !== 0) break; } }
    }
  }
  return { mob, attackersNearKing };
}
function kingRingDist(a, b) { return Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b))); }
function findKing(board, side) { const k = side * KING; for (let s = 0; s < 64; s++) if (board[s] === k) return s; return -1; }

// Pawn structure: doubled and isolated pawns penalised, passed pawns rewarded (scaled by advancement).
function pawnStructure(board, side) {
  const filesOf = [0, 0, 0, 0, 0, 0, 0, 0];
  const squares = [];
  for (let s = 0; s < 64; s++) if (board[s] === side * PAWN) { filesOf[fileOf(s)]++; squares.push(s); }
  let score = 0;
  for (const s of squares) {
    const f = fileOf(s);
    if (filesOf[f] > 1) score -= 12; // doubled
    if ((f === 0 || filesOf[f - 1] === 0) && (f === 7 || filesOf[f + 1] === 0)) score -= 14; // isolated
    // passed: no enemy pawn on this file or adjacent files ahead of it
    let passed = true;
    const r = rankOf(s), dir = side === WHITE ? 1 : -1;
    for (let df = -1; df <= 1; df++) { const nf = f + df; if (nf < 0 || nf > 7) continue; for (let rr = r + dir; rr >= 0 && rr < 8; rr += dir) if (board[rr * 8 + nf] === -side * PAWN) { passed = false; break; } if (!passed) break; }
    if (passed) { const adv = side === WHITE ? r : 7 - r; score += 14 + adv * adv * 2; }
  }
  return score;
}

function evaluate(board, side) {
  let mg = 0, eg = 0, ph = 0;
  for (let s = 0; s < 64; s++) {
    const p = board[s]; if (p === 0) continue;
    const t = Math.abs(p), white = p > 0, sq = white ? s : mirror(s);
    const sign = white ? 1 : -1;
    if (t === QUEEN) ph += 4; else if (t === ROOK) ph += 2; else if (t === BISHOP || t === KNIGHT) ph += 1;
    const base = VAL[t] * sign;
    if (t === KING) { mg += sign * WPST[KING][sq]; eg += sign * KING_END_W[sq]; }
    else { const pst = sign * WPST[t][sq]; mg += base + pst; eg += base + pst; }
  }
  const phaseClamped = Math.min(24, ph), t = phaseClamped / 24;
  let v = mg * t + eg * (1 - t);
  const wMob = mobilityAndSafety(board, WHITE), bMob = mobilityAndSafety(board, BLACK);
  v += (wMob.mob - bMob.mob) * 2.2;
  v += (wMob.attackersNearKing - bMob.attackersNearKing) * 6;
  v += pawnStructure(board, WHITE) - pawnStructure(board, BLACK);
  // bishop pair
  let wb = 0, bb = 0; for (let s = 0; s < 64; s++) { if (board[s] === BISHOP) wb++; else if (board[s] === -BISHOP) bb++; }
  if (wb >= 2) v += 30; if (bb >= 2) v -= 30;
  return (side === WHITE ? v : -v) + TEMPO;
}

// ---- search state --------------------------------------------------------------------------------
const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
function makeSearcher() {
  const b = new Int8Array(64);
  const ttKey = new Int32Array(TT_SIZE), ttDepth = new Int8Array(TT_SIZE), ttFlag = new Uint8Array(TT_SIZE), ttScore = new Int16Array(TT_SIZE), ttMove = new Int32Array(TT_SIZE);
  const moves = []; for (let i = 0; i < 96; i++) moves.push(new Int32Array(256));
  const scores = []; for (let i = 0; i < 96; i++) scores.push(new Int32Array(256));
  const killers = new Int32Array(96 * 2), history = new Int32Array(2 * 64 * 64);
  const path = new Float64Array(96);
  let hl = 0, hh = 0, side = WHITE, ep = -1, castle = 0, nodes = 0, limit = 0, useQ = true, histSet = null;

  function load(board, turn, castleR, epR, keys) {
    hl = turn === BLACK ? SIDE_L : 0; hh = turn === BLACK ? SIDE_H : 0;
    for (let s = 0; s < 64; s++) { b[s] = board[s]; if (board[s]) { hl ^= PIECE_KEY_L[zIndex(board[s], s)]; hh ^= PIECE_KEY_H[zIndex(board[s], s)]; } }
    hl ^= CASTLE_KEY_L[castleR]; hh ^= CASTLE_KEY_H[castleR];
    if (epR >= 0) { hl ^= EP_KEY_L[fileOf(epR)]; hh ^= EP_KEY_H[fileOf(epR)]; }
    side = turn; ep = epR; castle = castleR;
    histSet = new Set(keys || []); path.fill(0); path[0] = keyNum(hl, hh);
  }
  function make(m) {
    const f = m & 63, t = (m >> 6) & 63, flag = (m >> 12) & 7, promo = (m >> 15) & 7;
    const p = b[f], mySide = side;
    let capturedSq = t, captured = b[t];
    if (flag === 2) { capturedSq = t - mySide * 8; captured = b[capturedSq]; if (captured) { hl ^= PIECE_KEY_L[zIndex(captured, capturedSq)]; hh ^= PIECE_KEY_H[zIndex(captured, capturedSq)]; } b[capturedSq] = 0; }
    else if (captured) { hl ^= PIECE_KEY_L[zIndex(captured, t)]; hh ^= PIECE_KEY_H[zIndex(captured, t)]; }
    hl ^= PIECE_KEY_L[zIndex(p, f)]; hh ^= PIECE_KEY_H[zIndex(p, f)];
    const placed = promo ? mySide * promo : p;
    b[t] = placed; b[f] = 0;
    hl ^= PIECE_KEY_L[zIndex(placed, t)]; hh ^= PIECE_KEY_H[zIndex(placed, t)];
    if (flag === 3) { const rf = t + 1, rt = t - 1; const rp = b[rf]; hl ^= PIECE_KEY_L[zIndex(rp, rf)] ^ PIECE_KEY_L[zIndex(rp, rt)]; hh ^= PIECE_KEY_H[zIndex(rp, rf)] ^ PIECE_KEY_H[zIndex(rp, rt)]; b[rt] = rp; b[rf] = 0; }
    if (flag === 4) { const rf = t - 2, rt = t + 1; const rp = b[rf]; hl ^= PIECE_KEY_L[zIndex(rp, rf)] ^ PIECE_KEY_L[zIndex(rp, rt)]; hh ^= PIECE_KEY_H[zIndex(rp, rf)] ^ PIECE_KEY_H[zIndex(rp, rt)]; b[rt] = rp; b[rf] = 0; }
    const prevCastle = castle, prevEp = ep;
    let newCastle = castle;
    if (Math.abs(p) === KING) newCastle &= mySide === WHITE ? ~3 : ~12;
    if (f === 0 || t === 0) newCastle &= ~2; if (f === 7 || t === 7) newCastle &= ~1;
    if (f === 56 || t === 56) newCastle &= ~8; if (f === 63 || t === 63) newCastle &= ~4;
    hl ^= CASTLE_KEY_L[prevCastle] ^ CASTLE_KEY_L[newCastle]; hh ^= CASTLE_KEY_H[prevCastle] ^ CASTLE_KEY_H[newCastle];
    castle = newCastle;
    if (prevEp >= 0) { hl ^= EP_KEY_L[fileOf(prevEp)]; hh ^= EP_KEY_H[fileOf(prevEp)]; }
    ep = flag === 1 ? (f + t) >> 1 : -1;
    if (ep >= 0) { hl ^= EP_KEY_L[fileOf(ep)]; hh ^= EP_KEY_H[fileOf(ep)]; }
    hl ^= SIDE_L; hh ^= SIDE_H;
    side = -side;
    return { captured, capturedSq, prevCastle, prevEp };
  }
  function unmake(m, u, sl, sh) {
    const f = m & 63, t = (m >> 6) & 63, flag = (m >> 12) & 7, promo = (m >> 15) & 7;
    const mySide = -side;
    const moved = b[t];
    b[f] = promo ? mySide * PAWN : moved;
    b[t] = 0;
    if (flag === 2) b[u.capturedSq] = u.captured; else b[t] = u.captured;
    if (flag === 3) { const rf = t + 1, rt = t - 1; b[rf] = b[rt]; b[rt] = 0; }
    if (flag === 4) { const rf = t - 2, rt = t + 1; b[rf] = b[rt]; b[rt] = 0; }
    side = mySide; castle = u.prevCastle; ep = u.prevEp; hl = sl; hh = sh;
  }
  const kingHit = (s) => { const k = findKing(b, s); return k >= 0 && attacked(b, k, -s); };

  function scoreMoves(list, sc, n, ply, ttm, stm) {
    const si = stm > 0 ? 0 : 1;
    for (let i = 0; i < n; i++) {
      const m = list[i], f = m & 63, t = (m >> 6) & 63, v = b[t], flag = (m >> 12) & 7, promo = (m >> 15) & 7;
      let s;
      if (m === ttm) s = 1e7;
      else if (v || flag === 2) { const victim = flag === 2 ? PAWN : Math.abs(v); s = 1e6 + victim * 100 - Math.abs(b[f]); }
      else if (promo === QUEEN) s = 9.5e5;
      else if (m === killers[ply * 2]) s = 9e5; else if (m === killers[ply * 2 + 1]) s = 8e5;
      else s = history[(si * 64 + f) * 64 + t];
      sc[i] = s;
    }
  }
  function pick(list, sc, n, i) {
    let best = i;
    for (let j = i + 1; j < n; j++) if (sc[j] > sc[best]) best = j;
    if (best !== i) { const m = list[i], s = sc[i]; list[i] = list[best]; sc[i] = sc[best]; list[best] = m; sc[best] = s; }
    return list[i];
  }

  function quiesce(alpha, beta, ply, qd) {
    if (++nodes > limit) throw ABORT;
    const stand = evaluate(b, side);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd >= 6) return alpha;
    const list = moves[ply], sc = scores[ply];
    const n = genInto(b, side, ep, castle, list, 0, true);
    scoreMoves(list, sc, n, ply, 0, side);
    const me = side;
    for (let i = 0; i < n; i++) {
      const m = pick(list, sc, n, i), sl = hl, sh = hh;
      const u = make(m);
      if (kingHit(me)) { unmake(m, u, sl, sh); continue; }
      const val = -quiesce(-beta, -alpha, ply + 1, qd + 1);
      unmake(m, u, sl, sh);
      if (val >= beta) return val;
      if (val > alpha) alpha = val;
    }
    return alpha;
  }

  function search(depth, alpha, beta, ply) {
    if (++nodes > limit) throw ABORT;
    const key = keyNum(hl, hh);
    if (ply > 0) {
      for (let i = ply - 2; i >= 0; i -= 2) if (path[i] === key) return 0;
      if (histSet.has(key)) return 0;
    }
    path[ply] = key;
    const me = side, inChk = kingHit(me);
    if (inChk && ply < 40) depth++;
    if (depth <= 0) return useQ ? quiesce(alpha, beta, ply, 0) : evaluate(b, side);
    if (ply >= 90) return evaluate(b, side);
    const slot = ((hl ^ (hh << 1)) >>> 0) & TT_MASK;
    let ttm = 0;
    if (ttKey[slot] === hh && ttFlag[slot] !== 0) {
      ttm = ttMove[slot];
      if (ttDepth[slot] >= depth) {
        let s = ttScore[slot]; if (s > MATE - 200) s -= ply; else if (s < -MATE + 200) s += ply;
        const fl = ttFlag[slot];
        if (fl === 1) return s; if (fl === 2 && s >= beta) return s; if (fl === 3 && s <= alpha) return s;
      }
    }
    const list = moves[ply], sc = scores[ply];
    const n = genInto(b, me, ep, castle, list, 0, false);
    scoreMoves(list, sc, n, ply, ttm, me);
    let best = -INF, bestMove = 0, legal = 0;
    const a0 = alpha;
    for (let i = 0; i < n; i++) {
      const m = pick(list, sc, n, i), sl = hl, sh = hh;
      const u = make(m);
      if (kingHit(me)) { unmake(m, u, sl, sh); continue; }
      legal++;
      const val = -search(depth - 1, -beta, -alpha, ply + 1);
      unmake(m, u, sl, sh);
      if (val > best) {
        best = val; bestMove = m;
        if (val > alpha) {
          alpha = val;
          if (val >= beta) {
            const captured = u.captured || ((m >> 12) & 7) === 2;
            if (!captured) { const k = ply * 2; if (killers[k] !== m) { killers[k + 1] = killers[k]; killers[k] = m; } history[((me > 0 ? 0 : 1) * 64 + (m & 63)) * 64 + ((m >> 6) & 63)] += depth * depth; }
            break;
          }
        }
      }
    }
    if (legal === 0) return inChk ? -MATE + ply : 0;
    let store = best; if (store > MATE - 200) store += ply; else if (store < -MATE + 200) store -= ply;
    const fl = best <= a0 ? 3 : best >= beta ? 2 : 1;
    if (ttFlag[slot] === 0 || ttDepth[slot] <= depth) { ttKey[slot] = hh; ttDepth[slot] = depth; ttFlag[slot] = fl; ttScore[slot] = store; ttMove[slot] = bestMove; }
    return best;
  }

  return {
    b, load, make, unmake, search, kingHit,
    get nodes() { return nodes; },
    setBudget(l, q) { nodes = 0; limit = l; useQ = q; },
    clearHeuristics() { killers.fill(0); history.fill(0); },
    clearTT() { ttFlag.fill(0); },
    hash: () => [hl, hh],
  };
}
let SHARED = null; // one searcher (and its tables) is reused by every thinker; only one thinks at a time

// A thinker searches a little each time step() is called; returns { move } (a {from,to,promo}) or
// { move: undefined } while still working. `playedFromTo` (optional) lets it consult the opening book.
export function createThinker(g, level, rng, playedFromTo) {
  const L = LEVELS[level] ?? LEVELS[3];
  const st = g.st;
  const legalRaw = legalMovesRaw(st);
  if (legalRaw.length === 0) return { step: () => ({ move: null }), nodes: 0, depth: 0, info: {} };
  if (L.book && playedFromTo) {
    const book = bookMoves(playedFromTo, legalRaw);
    if (book.length) { const m = rng.pick(book); const move = { from: m & 63, to: (m >> 6) & 63, flag: (m >> 12) & 7, promo: (m >> 15) & 7 }; let done = false; return { step: () => { if (done) return { move }; done = true; return { move: undefined }; }, nodes: 0, depth: 0, info: {} }; }
  }
  const s = SHARED || (SHARED = makeSearcher());
  const rootBoard = st.board.slice(), turn = st.turn, castle = st.castle, ep = st.ep;
  const keys = []; for (const [k] of g.keyCounts) keys.push(k);
  const rootMoves = legalRaw.slice();
  const total = { nodes: 0 };
  let rootI = 0, nv = [], alpha = -INF, doneDepths = 0, depth = 1, vals = rootMoves.map(() => 0), order = rootMoves.slice(), done = rootMoves.length <= 1, started = false, best = -INF;
  const exact = L.noise > 0;
  let finished = null;

  const finish = () => {
    if (rootMoves.length === 0) return null;
    const asMove = (m) => ({ from: m & 63, to: (m >> 6) & 63, flag: (m >> 12) & 7, promo: (m >> 15) & 7 });
    if (rootMoves.length === 1) return asMove(rootMoves[0]);
    if (rng.next() < L.random) return asMove(rootMoves[rng.int(rootMoves.length)]);
    if (!L.noise) return asMove(order[0]);
    let pickI = 0, top = -Infinity;
    for (let i = 0; i < order.length; i++) { const v = vals[i] + (rng.next() * 2 - 1) * L.noise + rng.next() * 0.5; if (v > top) { top = v; pickI = i; } }
    return asMove(order[pickI]);
  };
  return {
    get nodes() { return total.nodes; },
    get depth() { return depth; },
    get info() { return { order, vals, done: doneDepths }; },
    step() {
      if (finished) return finished;
      if (done) { finished = { move: finish() }; return finished; }
      if (!started) { s.clearHeuristics(); s.clearTT(); started = true; }
      if (doneDepths > 0 && total.nodes >= L.budget) { finished = { move: finish() }; return finished; }
      s.setBudget(STEP_NODES, true);
      let out = { move: undefined };
      try {
        s.load(rootBoard, turn, castle, ep, keys);
        for (;;) {
          const h = s.hash(), sl = h[0], sh = h[1];
          while (rootI < order.length) {
            const m = order[rootI], u = s.make(m);
            const v = -s.search(depth - 1, -INF, exact ? INF : -alpha, 1);
            s.unmake(m, u, sl, sh);
            nv[rootI] = v; if (v > best) best = v; if (!exact && v > alpha) alpha = v; rootI++;
          }
          const idxs = order.map((m, k) => k).sort((a, c) => nv[c] - nv[a] || a - c);
          order = idxs.map((k) => order[k]); vals = idxs.map((k) => nv[k]); doneDepths++;
          if (depth >= L.depth || total.nodes + s.nodes > L.budget || Math.abs(vals[0]) > MATE - 400) { finished = { move: finish() }; out = finished; break; }
          depth++; rootI = 0; nv = []; alpha = -INF; best = -INF;
        }
      } catch (e) { if (e !== ABORT) throw e; }
      total.nodes += s.nodes;
      return out;
    },
  };
}
// Run a thinker to completion (tests, self-play, the auto-play demo).
export function chooseMove(g, level, rng, playedFromTo) { const t = createThinker(g, level, rng, playedFromTo); for (;;) { const r = t.step(); if (r.move !== undefined) return r.move; } }
// Static evaluation exposed for hints/UI (centipawns, from the side-to-move's perspective).
export const staticEval = (board, side) => evaluate(board, side);
