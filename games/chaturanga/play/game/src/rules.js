// Chaturanga rules: the board, the pieces, legal moves, game results. Pure and deterministic; no drawing here.
//
// Two movement sets share one engine (`era`):
//   ANCIENT  the commonly reconstructed Chaturanga: Raja steps one square, Mantri steps one square diagonally, Gaja LEAPS exactly
//            two squares diagonally (over anything), Ashva is the chess knight, Ratha is the chess rook, Padati steps one square
//            forward and captures diagonally forward, promoting only to Mantri. Win by checkmate, by stalemating the opponent, or
//            by leaving the opponent with a bare Raja.
//   MODERN   today's chess movements (Mantri = queen, Gaja = bishop, pawns may step two from the start, promote to a queen),
//            without castling or en passant. Stalemate is a draw.
// Squares are 0..63 = rank * 8 + file; rank 0 is Ivory's back rank (a1 = 0). Pieces are signed: + Ivory, - Vermilion.
export const WHITE = 1, BLACK = -1;
export const PADATI = 1, ASHVA = 2, GAJA = 3, RATHA = 4, MANTRI = 5, RAJA = 6;
export const ANCIENT = 0, MODERN = 1;
export const TYPE_NAME = ['', 'Padati', 'Ashva', 'Gaja', 'Ratha', 'Mantri', 'Raja'];
export const MODERN_NAME = ['', 'Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King'];
export const SIDE_NAME = { 1: 'Ivory', '-1': 'Vermilion' };
export const fileOf = (s) => s & 7;
export const rankOf = (s) => s >> 3;
export const sqName = (s) => String.fromCharCode(97 + (s & 7)) + String((s >> 3) + 1);
export const parseSq = (n) => (n.charCodeAt(0) - 97) + (Number(n[1]) - 1) * 8;
// the name of a piece as the player should read it in the current movement set
export const typeName = (t, era) => (era === MODERN ? MODERN_NAME[t] : TYPE_NAME[t]);

const BACK = [RATHA, ASHVA, GAJA, MANTRI, RAJA, GAJA, ASHVA, RATHA];
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const AROUND = [...DIAG, ...ORTH];

export function startBoard() {
  const b = new Int8Array(64);
  for (let f = 0; f < 8; f++) { b[f] = BACK[f]; b[56 + f] = -BACK[f]; b[8 + f] = PADATI; b[48 + f] = -PADATI; }
  return b;
}

// ---- move generation -------------------------------------------------------------------------------------------------------
// A move is packed in an int: from | to << 6 | promo << 12.
export const mk = (from, to, promo = 0) => from | (to << 6) | (promo << 12);
export const mFrom = (m) => m & 63;
export const mTo = (m) => (m >> 6) & 63;
export const mPromo = (m) => (m >> 12) & 1;

// Pseudo-legal moves (king safety is not checked). With capsOnly: captures and promotions only.
export function genInto(b, side, list, n, capsOnly, era) {
  const modern = era === MODERN;
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (p === 0 || (p > 0) !== (side > 0)) continue;
    const t = p > 0 ? p : -p, f = s & 7, r = s >> 3;
    if (t === PADATI) {
      const dir = side > 0 ? 1 : -1, nr = r + dir, last = side > 0 ? 7 : 0;
      if (nr < 0 || nr > 7) continue;
      const fwd = nr * 8 + f;
      if (b[fwd] === 0) {
        if (nr === last) list[n++] = mk(s, fwd, 1);
        else if (!capsOnly) {
          list[n++] = mk(s, fwd);
          if (modern && r === (side > 0 ? 1 : 6) && b[fwd + dir * 8] === 0) list[n++] = mk(s, fwd + dir * 8);
        }
      }
      for (const df of [-1, 1]) {
        const nf = f + df; if (nf < 0 || nf > 7) continue;
        const to = nr * 8 + nf, q = b[to];
        if (q !== 0 && (q > 0) !== (side > 0)) list[n++] = mk(s, to, nr === last ? 1 : 0);
      }
      continue;
    }
    const step = (df, dr) => {
      const nf = f + df, nr = r + dr; if (nf < 0 || nf > 7 || nr < 0 || nr > 7) return;
      const to = nr * 8 + nf, q = b[to];
      if (q === 0) { if (!capsOnly) list[n++] = mk(s, to); } else if ((q > 0) !== (side > 0)) list[n++] = mk(s, to);
    };
    const slide = (df, dr) => {
      let nf = f + df, nr = r + dr;
      while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
        const to = nr * 8 + nf, q = b[to];
        if (q === 0) { if (!capsOnly) list[n++] = mk(s, to); } else { if ((q > 0) !== (side > 0)) list[n++] = mk(s, to); break; }
        nf += df; nr += dr;
      }
    };
    if (t === ASHVA) for (const [df, dr] of KNIGHT) step(df, dr);
    else if (t === RAJA) for (const [df, dr] of AROUND) step(df, dr);
    else if (t === RATHA) for (const [df, dr] of ORTH) slide(df, dr);
    else if (t === MANTRI) { if (modern) for (const [df, dr] of AROUND) slide(df, dr); else for (const [df, dr] of DIAG) step(df, dr); }
    else if (t === GAJA) { if (modern) for (const [df, dr] of DIAG) slide(df, dr); else for (const [df, dr] of DIAG) step(df * 2, dr * 2); }
  }
  return n;
}

// Is square `sq` attacked by a piece of side `by`?
export function attacked(b, sq, by, era) {
  const modern = era === MODERN, f = sq & 7, r = sq >> 3;
  const at = (df, dr) => { const nf = f + df, nr = r + dr; return nf < 0 || nf > 7 || nr < 0 || nr > 7 ? 0 : b[nr * 8 + nf]; };
  const mine = (p, t) => p === by * t;
  const pr = by > 0 ? -1 : 1; // a padati of `by` attacking sq stands one rank behind it
  if (mine(at(-1, pr), PADATI) || mine(at(1, pr), PADATI)) return true;
  for (const [df, dr] of KNIGHT) if (mine(at(df, dr), ASHVA)) return true;
  for (const [df, dr] of AROUND) if (mine(at(df, dr), RAJA)) return true;
  if (!modern) {
    for (const [df, dr] of DIAG) { if (mine(at(df, dr), MANTRI)) return true; if (mine(at(df * 2, dr * 2), GAJA)) return true; }
  }
  const ray = (df, dr, a, c) => {
    let nf = f + df, nr = r + dr;
    while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
      const p = b[nr * 8 + nf];
      if (p !== 0) return p === by * a || p === by * c;
      nf += df; nr += dr;
    }
    return false;
  };
  for (const [df, dr] of ORTH) if (ray(df, dr, RATHA, modern ? MANTRI : RATHA)) return true;
  if (modern) for (const [df, dr] of DIAG) if (ray(df, dr, GAJA, MANTRI)) return true;
  return false;
}
export function findKing(b, side) { const k = side * RAJA; for (let s = 0; s < 64; s++) if (b[s] === k) return s; return -1; }

const SCRATCH = new Int32Array(256);
// Legal moves of `side` on board `b` (packed ints).
export function legalMovesRaw(b, side, era) {
  const n = genInto(b, side, SCRATCH, 0, false, era), out = [];
  for (let i = 0; i < n; i++) {
    const m = SCRATCH[i], f = mFrom(m), t = mTo(m), cap = b[t], pc = b[f];
    b[t] = mPromo(m) ? side * MANTRI : pc; b[f] = 0;
    const k = findKing(b, side), bad = k >= 0 && attacked(b, k, -side, era);
    b[f] = pc; b[t] = cap;
    if (!bad) out.push(m);
  }
  return out;
}
function hasLegal(b, side, era) {
  const n = genInto(b, side, SCRATCH, 0, false, era);
  for (let i = 0; i < n; i++) {
    const m = SCRATCH[i], f = mFrom(m), t = mTo(m), cap = b[t], pc = b[f];
    b[t] = mPromo(m) ? side * MANTRI : pc; b[f] = 0;
    const k = findKing(b, side), bad = k >= 0 && attacked(b, k, -side, era);
    b[f] = pc; b[t] = cap;
    if (!bad) return true;
  }
  return false;
}

// ---- hashing (repetition) ---------------------------------------------------------------------------------------------------
const ZOB = new Int32Array(15 * 64);
{ let x = 0x2468ace; for (let i = 0; i < ZOB.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; ZOB[i] = x | 0; } }
export function hashBoard(b, side) { let h = side < 0 ? 0x5bd1e995 | 0 : 0; for (let s = 0; s < 64; s++) if (b[s]) h ^= ZOB[(b[s] + 7) * 64 + s]; return h | 0; }
export const ZOBRIST = ZOB;

// ---- the game --------------------------------------------------------------------------------------------------------------------
export function newGame(era = ANCIENT) { return fromBoard(startBoard(), WHITE, era); }
export function fromBoard(board, turn = WHITE, era = ANCIENT) {
  const b = Int8Array.from(board);
  return { board: b, turn, era, log: [], result: null, half: 0, keys: [hashBoard(b, turn)] };
}
export function cloneGame(g) {
  return { board: Int8Array.from(g.board), turn: g.turn, era: g.era, log: g.log.map((e) => ({ ...e })), result: g.result ? { ...g.result } : null, half: g.half, keys: g.keys.slice() };
}
export function legalMoves(g) {
  if (g.result) return [];
  return legalMovesRaw(g.board, g.turn, g.era).map((m) => ({ from: mFrom(m), to: mTo(m), promo: !!mPromo(m), cap: g.board[mTo(m)] !== 0, m }));
}
export const legalTargets = (g, from) => legalMoves(g).filter((m) => m.from === from);
export const inCheck = (g) => { const k = findKing(g.board, g.turn); return k >= 0 && attacked(g.board, k, -g.turn, g.era); };
const nonKing = (b, side) => { let n = 0; for (let s = 0; s < 64; s++) { const p = b[s]; if (p !== 0 && (p > 0) === (side > 0) && p * side !== RAJA) n++; } return n; };
export const pieceCount = nonKing;

// Decide whether the position (side to move: g.turn) ends the game. Called after every move.
function judge(g) {
  const b = g.board, me = g.turn, opp = -me, era = g.era;
  if (!hasLegal(b, me, era)) {
    const k = findKing(b, me);
    if (k >= 0 && attacked(b, k, opp, era)) return { winner: opp, why: 'checkmate' };
    return era === ANCIENT ? { winner: opp, why: 'stalemate' } : { winner: 0, why: 'stalemate' };
  }
  const nm = nonKing(b, me), no = nonKing(b, opp);
  if (era === ANCIENT) {
    if (nm === 0 && no === 0) return { winner: 0, why: 'bare' };
    if (nm === 0) {
      // the bare side may still save the game by taking the last enemy piece (then both Rajas are bare: a draw)
      const canTake = no === 1 && legalMovesRaw(b, me, era).some((m) => b[mTo(m)] !== 0);
      if (!canTake) return { winner: opp, why: 'bare' };
    }
  } else if (no === 0 && nm === 0) return { winner: 0, why: 'material' };
  else if ((nm === 0 && no === 1 && lonePiece(b, opp) <= GAJA && lonePiece(b, opp) !== PADATI) || (no === 0 && nm === 1 && lonePiece(b, me) <= GAJA && lonePiece(b, me) !== PADATI)) return { winner: 0, why: 'material' };
  if (g.half >= 100) return { winner: 0, why: 'fifty' };
  const key = g.keys[g.keys.length - 1];
  let rep = 0; for (const k of g.keys) if (k === key) rep++;
  if (rep >= 3) return { winner: 0, why: 'repetition' };
  return null;
}
function lonePiece(b, side) { for (let s = 0; s < 64; s++) { const p = b[s]; if (p !== 0 && (p > 0) === (side > 0) && p * side !== RAJA) return p * side; } return 0; }

// Make a legal move. Returns { cap, chk, mate, end } for the picture and the commentary.
export function applyMove(g, mv) {
  const b = g.board, side = g.turn, f = mv.from, t = mv.to, piece = b[f], cap = b[t];
  g.log.push({ from: f, to: t, piece, cap, promo: !!mv.promo, side, half: g.half, result: g.result });
  b[t] = mv.promo ? side * MANTRI : piece; b[f] = 0;
  g.half = cap !== 0 || Math.abs(piece) === PADATI ? 0 : g.half + 1;
  g.turn = -side;
  g.keys.push(hashBoard(b, g.turn));
  const chk = inCheck(g);
  const end = judge(g);
  if (end) g.result = end;
  return { cap, chk, mate: !!end && end.why === 'checkmate', end };
}
export function undoMove(g) {
  const e = g.log.pop(); if (!e) return false;
  g.board[e.from] = e.piece; g.board[e.to] = e.cap; g.turn = e.side; g.half = e.half; g.result = e.result ? { ...e.result } : null; g.keys.pop();
  return true;
}

// The squares of `side`'s pieces that the other side could capture next move.
export function threatened(g, side) {
  const out = [];
  for (let s = 0; s < 64; s++) { const p = g.board[s]; if (p !== 0 && (p > 0) === (side > 0) && attacked(g.board, s, -side, g.era)) out.push(s); }
  return out;
}

// Why a tapped move is not allowed, in plain words (used for the refusal message).
const MOVE_RULE_ANCIENT = {
  [PADATI]: 'A Padati steps one square straight ahead and captures one square diagonally ahead.',
  [ASHVA]: 'An Ashva jumps in an L: two squares one way, one the other.',
  [GAJA]: 'A Gaja leaps exactly two squares diagonally, over anything in between.',
  [RATHA]: 'A Ratha slides any distance along a rank or file.',
  [MANTRI]: 'A Mantri steps one square diagonally.',
  [RAJA]: 'A Raja steps one square in any direction.',
};
const MOVE_RULE_MODERN = {
  [PADATI]: 'A Pawn steps one square ahead (two from its start) and captures one square diagonally ahead.',
  [ASHVA]: 'A Knight jumps in an L: two squares one way, one the other.',
  [GAJA]: 'A Bishop slides any distance diagonally.',
  [RATHA]: 'A Rook slides any distance along a rank or file.',
  [MANTRI]: 'A Queen slides any distance in any direction.',
  [RAJA]: 'A King steps one square in any direction.',
};
export const moveRule = (t, era) => (era === MODERN ? MOVE_RULE_MODERN : MOVE_RULE_ANCIENT)[t];
export function tryMove(g, from, to) {
  const p = g.board[from];
  if (p === 0) return { ok: false, why: 'There is no piece on that square.' };
  if ((p > 0) !== (g.turn > 0)) return { ok: false, why: 'That is not your piece.' };
  const found = legalMoves(g).find((m) => m.from === from && m.to === to);
  if (found) return { ok: true, move: found };
  const n = genInto(g.board, g.turn, SCRATCH, 0, false, g.era);
  for (let i = 0; i < n; i++) if (mFrom(SCRATCH[i]) === from && mTo(SCRATCH[i]) === to) return { ok: false, why: inCheck(g) ? 'Your Raja is in check: that move does not get it out.' : 'That would leave your Raja in check.' };
  const q = g.board[to];
  if (q !== 0 && (q > 0) === (p > 0)) return { ok: false, why: 'One of your own pieces is on that square.' };
  return { ok: false, why: moveRule(Math.abs(p), g.era) };
}
export function describeMove(g, mv) {
  const p = g.board[mv.from], t = Math.abs(p), cap = g.board[mv.to], nm = typeName(t, g.era);
  let s = cap ? `${nm} on ${sqName(mv.from)} takes the ${typeName(Math.abs(cap), g.era)} on ${sqName(mv.to)}` : `${nm} from ${sqName(mv.from)} to ${sqName(mv.to)}`;
  if (mv.promo) s += ` and becomes a ${typeName(MANTRI, g.era)}`;
  return s;
}
export const START_COUNTS = { [PADATI]: 8, [ASHVA]: 2, [GAJA]: 2, [RATHA]: 2, [MANTRI]: 1 };
export const MATERIAL = { [PADATI]: 1, [ASHVA]: 3, [GAJA]: 2, [RATHA]: 5, [MANTRI]: 2 };
export const MATERIAL_MODERN = { [PADATI]: 1, [ASHVA]: 3, [GAJA]: 3, [RATHA]: 5, [MANTRI]: 9 };
export function materialOf(b, side, era) {
  const T = era === MODERN ? MATERIAL_MODERN : MATERIAL; let v = 0;
  for (let s = 0; s < 64; s++) { const p = b[s]; if (p !== 0 && (p > 0) === (side > 0) && p * side !== RAJA) v += T[p * side]; }
  return v;
}
