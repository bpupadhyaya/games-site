// Zamma rules: the single source of truth for what is legal and what a move does. Pure and deterministic.
// Points are numbered 0..n*n-1, row by row from the TOP-left. Row 0 is Limestone's home side, the last row is Basalt's.
// Side 1 = Basalt (moves first, bottom, walks UP the board), side 2 = Limestone. Piece values: 0 empty, 1 / 2 = man of side 1 / 2,
// 3 / 4 = Sultan (promoted piece) of side 1 / 2. winner: 0 playing, 1, 2, or 3 = draw.
//
// The board is a net of lines. On the Small and Medium boards every point has all eight lines (straight and diagonal). On the Grand board
// the diagonals run only through the points where (row + column) is even, as on an alquerque board.
export const VARIANTS = {
  small: { n: 5, alq: false, name: 'Small', long: 'Small Zamma, 5 by 5', blurb: 'The classic Zamma board: 12 pieces each, quick and sharp.' },
  mid:   { n: 7, alq: false, name: 'Medium', long: 'Medium Zamma, 7 by 7', blurb: '24 pieces each on a 7 by 7 net of lines. More room to manoeuvre.' },
  grand: { n: 9, alq: true, name: 'Grand', long: 'Grand Zamma, 9 by 9', blurb: '40 pieces each on a 9 by 9 board whose diagonals run through alternate points. The long game.' },
};
export const VARIANT_KEYS = ['small', 'mid', 'grand'];
export const QUIET_LIMIT = 50;          // plies (25 moves each) with no capture and no man move before the game is settled on material
export const MOVE_LIMIT = 400;          // plies (200 moves each) before the game is called a draw
export const NAMES = ['', 'Basalt', 'Limestone'];
export const sideOf = (v) => (v === 0 ? 0 : ((v - 1) & 1) + 1);
export const isSultan = (v) => v >= 3;
export const nOf = (variant) => VARIANTS[variant].n;
export const DIRS8 = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
export const startCount = (variant) => { const n = VARIANTS[variant].n, k = (n - 1) / 2; return n * k + k; };

export function newGame(variant = 'small') {
  const n = nOf(variant), k = (n - 1) / 2, board = new Array(n * n).fill(0);
  // Each side fills its own half. On the middle row each side keeps the points to the right of the empty centre, seen from its own seat.
  for (let r = 0; r < k; r++) for (let c = 0; c < n; c++) { board[r * n + c] = 2; board[(n - 1 - r) * n + c] = 1; }
  for (let c = 0; c < k; c++) board[k * n + c] = 2;
  for (let c = k + 1; c < n; c++) board[k * n + c] = 1;
  const g = { variant, board, turn: 1, moves: 0, lost: [0, 0, 0], winner: 0, reason: '', seen: {}, last: null, quiet: 0 };
  g.seen[posKey(g)] = 1;
  return g;
}
export const clone = (g) => ({ ...g, board: g.board.slice(), lost: g.lost.slice(), seen: { ...g.seen }, last: g.last ? { ...g.last, caps: g.last.caps.slice(), path: g.last.path.slice(), capVals: g.last.capVals.slice() } : null });
export const posKey = (g) => g.board.join('') + g.turn;
export const pieceCount = (g, side) => startCount(g.variant) - g.lost[side];

// May a piece standing on (r, c) travel along direction (dr, dc)? Straight lines always; diagonals only where the board has them.
export const lineOk = (alq, r, c, dr, dc) => !(dr && dc) || !alq || ((r + c) & 1) === 0;

// Running count of capture-search steps; the computer player slices its thinking by this (a position full of long-range pieces costs far
// more to expand than a quiet one) so a frame never waits on it. Has no effect on the rules.
export const WORK = { n: 0 };
// The computer player's bounded search: while BAIL.at is finite a capture search that passes it throws BAIL (see legalMovesBounded).
const BAIL = { at: Infinity };

const fwd = (side) => (side === 1 ? -1 : 1);
const farRow = (side, n) => (side === 1 ? 0 : n - 1);

// All complete capture sequences for the piece on square `from`. Each is { from, to, path: [landing squares], caps: [captured squares], promote }.
// The mover is lifted off its start (so a sequence may come back to it); captured pieces stay on the board until the move ends, cannot be
// jumped twice and still block the way. Only sequences that cannot be extended are returned.
function captureSeqs(b, n, alq, from, out) {
  const piece = b[from], side = sideOf(piece), sultan = isSultan(piece);
  b[from] = 0;
  const taken = new Set(), path = [], caps = [];
  const rec = (r, c) => {
    if (++WORK.n > BAIL.at) throw BAIL;
    let extended = false;
    for (let d = 0; d < 8; d++) {
      const dr = DIRS8[d][0], dc = DIRS8[d][1];
      if (!lineOk(alq, r, c, dr, dc)) continue;
      let rr = r + dr, cc = c + dc;
      if (sultan) while (rr >= 0 && rr < n && cc >= 0 && cc < n && b[rr * n + cc] === 0) { rr += dr; cc += dc; }
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
      const q = rr * n + cc, v = b[q];
      if (v === 0 || sideOf(v) === side || taken.has(q)) continue;
      let lr = rr + dr, lc = cc + dc;
      while (lr >= 0 && lr < n && lc >= 0 && lc < n && b[lr * n + lc] === 0) {
        extended = true; taken.add(q); path.push(lr * n + lc); caps.push(q);
        rec(lr, lc);
        path.pop(); caps.pop(); taken.delete(q);
        if (!sultan) break;
        lr += dr; lc += dc;
      }
    }
    if (!extended && caps.length) {
      const to = path[path.length - 1];
      out.push({ from, to, path: path.slice(), caps: caps.slice(), promote: !sultan && Math.floor(to / n) === farRow(side, n) });
    }
  };
  try { rec(Math.floor(from / n), from % n); } finally { b[from] = piece; }
}

// Same search as captureSeqs, but as a generator that yields every `slice` capture-search steps so the computer player can hand control
// back to the frame loop in the middle of a position with thousands of long Sultan chains. Produces the very same moves in the same order.
function* captureSeqsGen(b, n, alq, from, out, slice) {
  const piece = b[from], side = sideOf(piece), sultan = isSultan(piece);
  b[from] = 0;
  const taken = new Set(), path = [], caps = [];
  let mark = WORK.n;
  const rec = function* (r, c) {
    WORK.n++;
    if (WORK.n - mark >= slice) { mark = WORK.n; yield; }
    let extended = false;
    for (let d = 0; d < 8; d++) {
      const dr = DIRS8[d][0], dc = DIRS8[d][1];
      if (!lineOk(alq, r, c, dr, dc)) continue;
      let rr = r + dr, cc = c + dc;
      if (sultan) while (rr >= 0 && rr < n && cc >= 0 && cc < n && b[rr * n + cc] === 0) { rr += dr; cc += dc; }
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
      const q = rr * n + cc, v = b[q];
      if (v === 0 || sideOf(v) === side || taken.has(q)) continue;
      let lr = rr + dr, lc = cc + dc;
      while (lr >= 0 && lr < n && lc >= 0 && lc < n && b[lr * n + lc] === 0) {
        extended = true; taken.add(q); path.push(lr * n + lc); caps.push(q);
        yield* rec(lr, lc);
        path.pop(); caps.pop(); taken.delete(q);
        if (!sultan) break;
        lr += dr; lc += dc;
      }
    }
    if (!extended && caps.length) {
      const to = path[path.length - 1];
      out.push({ from, to, path: path.slice(), caps: caps.slice(), promote: !sultan && Math.floor(to / n) === farRow(side, n) });
    }
  };
  try { yield* rec(Math.floor(from / n), from % n); } finally { b[from] = piece; }
}

function quietMoves(b, n, alq, from, out) {
  const piece = b[from], side = sideOf(piece), sultan = isSultan(piece), r = Math.floor(from / n), c = from % n;
  for (let d = 0; d < 8; d++) {
    const dr = DIRS8[d][0], dc = DIRS8[d][1];
    if (!sultan && dr !== fwd(side)) continue;
    if (!lineOk(alq, r, c, dr, dc)) continue;
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < n && cc >= 0 && cc < n && b[rr * n + cc] === 0) {
      const to = rr * n + cc;
      out.push({ from, to, path: [to], caps: [], promote: !sultan && rr === farRow(side, n) });
      if (!sultan) break;
      rr += dr; cc += dc;
    }
  }
}

// Every legal move for `side`: when any capture exists, only the captures with the most pieces taken (the majority rule).
export function legalMovesOn(b, n, alq, side) {
  const caps = [];
  for (let i = 0; i < b.length; i++) if (b[i] && sideOf(b[i]) === side) captureSeqs(b, n, alq, i, caps);
  if (caps.length) {
    let best = 0; for (const m of caps) if (m.caps.length > best) best = m.caps.length;
    return caps.filter((m) => m.caps.length === best);
  }
  const out = [];
  for (let i = 0; i < b.length; i++) if (b[i] && sideOf(b[i]) === side) quietMoves(b, n, alq, i, out);
  return out;
}
// For the computer player: the same list as legalMovesOn, or null when the capture search needed more than `limit` steps (so the caller can
// redo it with legalMovesGen and yield in the middle). The board is left untouched either way.
export function legalMovesBounded(b, n, alq, side, limit) {
  BAIL.at = WORK.n + limit;
  try { return legalMovesOn(b, n, alq, side); }
  catch (e) { if (e === BAIL) return null; throw e; }
  finally { BAIL.at = Infinity; }
}
// Generator form of legalMovesOn (see captureSeqsGen): `yield*` it; it yields every `slice` capture-search steps.
export function* legalMovesGen(b, n, alq, side, slice = 1500) {
  const caps = [];
  for (let i = 0; i < b.length; i++) if (b[i] && sideOf(b[i]) === side) yield* captureSeqsGen(b, n, alq, i, caps, slice);
  if (caps.length) {
    let best = 0; for (const m of caps) if (m.caps.length > best) best = m.caps.length;
    return caps.filter((m) => m.caps.length === best);
  }
  const out = [];
  for (let i = 0; i < b.length; i++) if (b[i] && sideOf(b[i]) === side) quietMoves(b, n, alq, i, out);
  return out;
}
export function legalMoves(g, side = g.turn) {
  const v = VARIANTS[g.variant];
  return legalMovesOn(g.board, v.n, v.alq, side);
}
export const legalFrom = (g, i) => legalMoves(g).filter((m) => m.from === i);
export const mustCapture = (g, side = g.turn) => { const l = legalMoves(g, side); return l.length > 0 && l[0].caps.length > 0; };

// Material for the quiet-game rule: a man counts 1, a Sultan counts 3.
export function strength(g, side) { let s = 0; for (const v of g.board) if (v && sideOf(v) === side) s += isSultan(v) ? 3 : 1; return s; }

// Plays the move on g (mutates). Returns the captured squares in the order they were jumped. Sets winner / reason when the game ends.
export function applyMove(g, m) {
  const side = g.turn, b = g.board, opp = 3 - side, v = VARIANTS[g.variant], piece = b[m.from], wasMan = !isSultan(piece);
  const caps = m.caps.slice(), capVals = caps.map((q) => b[q]);
  b[m.from] = 0;
  for (const q of caps) b[q] = 0;
  const promote = wasMan && Math.floor(m.to / v.n) === farRow(side, v.n);
  b[m.to] = promote ? piece + 2 : piece;
  g.lost[opp] += caps.length; g.moves++;
  g.last = { from: m.from, to: m.to, path: m.path.slice(), caps, capVals, side, promote, piece };
  g.quiet = caps.length || wasMan ? 0 : (g.quiet || 0) + 1;
  g.turn = opp;
  if (pieceCount(g, opp) <= 0) { g.winner = side; g.reason = `All of ${NAMES[opp]}'s pieces are captured.`; }
  else if (legalMoves(g, opp).length === 0) { g.winner = side; g.reason = `${NAMES[opp]} has no move.`; }
  else {
    const k = posKey(g); g.seen[k] = (g.seen[k] || 0) + 1;
    if (g.quiet >= QUIET_LIMIT) {
      const a = strength(g, 1), c = strength(g, 2);
      if (a === c) { g.winner = 3; g.reason = '25 moves each without a capture or a step by a man, with equal strength.'; }
      else { g.winner = a > c ? 1 : 2; g.reason = '25 moves each without a capture or a step by a man: the stronger side wins.'; }
    }
    else if (g.seen[k] >= 3) { g.winner = 3; g.reason = 'The same position came up three times.'; }
    else if (g.moves >= MOVE_LIMIT) { g.winner = 3; g.reason = 'Move limit reached.'; }
  }
  return caps;
}

// Squares of `side` that the other side must capture on its very next move (danger marks / tutor).
export function endangered(g, side) {
  const out = new Set(), v = VARIANTS[g.variant];
  for (const m of legalMovesOn(g.board, v.n, v.alq, 3 - side)) { if (!m.caps.length) break; for (const q of m.caps) out.add(q); }
  return out;
}

// One plain sentence describing a move for the tutor / hint.
export function describeMove(g, m) {
  if (m.caps.length) {
    const base = m.caps.length === 1 ? 'This captures a piece.' : `This captures ${m.caps.length} pieces in one move.`;
    return m.promote ? base + ' It also ends on the far row and becomes a Sultan.' : base;
  }
  if (m.promote) return 'This reaches the far row: the piece becomes a Sultan.';
  const side = g.turn, c = clone(g);
  const before = endangered(c, side);
  applyMove(c, m);
  if (c.winner === side) return 'This wins the game.';
  if (before.has(m.from)) return 'This moves a piece out of danger.';
  c.turn = side;
  if (mustCapture(c, side)) return 'This sets up a capture for your next move.';
  return 'A solid move that improves your position.';
}
