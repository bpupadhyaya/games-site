// Co Ganh rules: the single source of truth for what is legal and what a move does. Pure and deterministic.
// Points are numbered 0..24, row by row from the TOP-left (row 0 is Jade's home side, row 4 is Red's).
// Side 1 = Red (moves first, bottom), side 2 = Jade. Board values: 0 empty, 1 Red piece, 2 Jade piece. winner: 0 playing, 1, 2, or 3 = draw.
//
// The board is 5 x 5 points joined by lines. Every point has the four straight lines; points whose (row + column) is even also carry the
// two diagonals. A piece steps one point along a line onto an empty point. After a step the mover's opponent can lose pieces two ways:
//   GANH (carry): the piece that just arrived stands between two enemy pieces on one line (straight or diagonal). Both are flipped.
//   VAY (trap): an enemy group (pieces linked by lines) that has no empty point next to any of its pieces is flipped as a whole.
// MO (open): if you step away from a point and the opponent can GANH by stepping into the point you left, the opponent must.
export const N = 5;
export const SZ = 25;
export const START_PIECES = 8;
export const QUIET_LIMIT = 80;          // plies (40 moves each) with no flips before the game is settled on piece count
export const MOVE_LIMIT = 240;          // plies (120 moves each) before the game is called a draw
export const NAMES = ['', 'Red', 'Jade'];
export const rowOf = (i) => (i / N) | 0;
export const colOf = (i) => i % N;
export const hasDiagonals = (i) => (rowOf(i) + colOf(i)) % 2 === 0;

// Neighbours along the lines, and for each point the straight / diagonal pairs of points on opposite sides of it (the GANH lines).
export const NEI = [], LINES = [];
for (let i = 0; i < SZ; i++) {
  const r = rowOf(i), c = colOf(i), n = [], l = [];
  const at = (rr, cc) => (rr >= 0 && rr < N && cc >= 0 && cc < N ? rr * N + cc : -1);
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const q = at(r + dr, c + dc); if (q >= 0) n.push(q); }
  for (const [dr, dc] of [[-1, 0], [0, -1]]) { const a = at(r + dr, c + dc), b = at(r - dr, c - dc); if (a >= 0 && b >= 0) l.push([a, b]); }
  if (hasDiagonals(i)) {
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) { const q = at(r + dr, c + dc); if (q >= 0) n.push(q); }
    for (const [dr, dc] of [[-1, -1], [-1, 1]]) { const a = at(r + dr, c + dc), b = at(r - dr, c - dc); if (a >= 0 && b >= 0) l.push([a, b]); }
  }
  NEI.push(n); LINES.push(l);
}
export const adjacent = (a, b) => NEI[a].includes(b);

// The start: Jade fills the top row plus both ends of row 1 and the left end of row 2; Red is the same turned half a turn.
//   J J J J J
//   J . . . J
//   J . . . R
//   R . . . R
//   R R R R R
export function newGame() {
  const board = new Array(SZ).fill(0);
  for (let c = 0; c < N; c++) { board[c] = 2; board[4 * N + c] = 1; }
  board[N] = 2; board[N + 4] = 2; board[2 * N] = 2;
  board[3 * N] = 1; board[3 * N + 4] = 1; board[2 * N + 4] = 1;
  const g = { board, turn: 1, moves: 0, winner: 0, reason: '', seen: {}, last: null, quiet: 0 };
  g.seen[posKey(g)] = 1;
  return g;
}
export const clone = (g) => ({ ...g, board: g.board.slice(), seen: { ...g.seen }, last: g.last ? { ...g.last, flips: g.last.flips.slice(), path: g.last.path.slice(), gank: g.last.gank.slice(), trap: g.last.trap.slice() } : null });
export const posKey = (g) => g.board.join('') + g.turn;
export const countOf = (b, side) => { let n = 0; for (let i = 0; i < SZ; i++) if (b[i] === side) n++; return n; };
export const pieceCount = (g, side) => countOf(g.board, side);

// ---- the effect of a step ---------------------------------------------------------------------------------------------------
// Returns { gank: [squares flipped by flanking], trap: [squares flipped by trapping] } for `side` stepping from -> to on board b. b is
// restored before returning.
const EMPTY = Object.freeze([]);
const SEEN = new Uint8Array(SZ), STACK = new Int8Array(SZ), GROUP = new Int8Array(SZ);   // scratch for the trap search (no per-move allocation)
export function effects(b, side, from, to) {
  const opp = 3 - side;
  let gank = EMPTY, trap = EMPTY;
  b[from] = 0; b[to] = side;
  const ln = LINES[to];
  for (let k = 0; k < ln.length; k++) { const x = ln[k][0], y = ln[k][1]; if (b[x] === opp && b[y] === opp) { if (gank === EMPTY) gank = []; gank.push(x, y); } }
  for (let k = 0; k < gank.length; k++) b[gank[k]] = side;
  // trapped groups: connected enemy pieces with no empty point next to any of them
  SEEN.fill(0);
  for (let s = 0; s < SZ; s++) {
    if (b[s] !== opp || SEEN[s]) continue;
    let sp = 0, gn = 0, free = false;
    STACK[sp++] = s; SEEN[s] = 1;
    while (sp) {
      const p = STACK[--sp]; GROUP[gn++] = p;
      const nb = NEI[p];
      for (let k = 0; k < nb.length; k++) {
        const q = nb[k], v = b[q];
        if (v === 0) free = true;
        else if (v === opp && !SEEN[q]) { SEEN[q] = 1; STACK[sp++] = q; }
      }
    }
    if (!free) { if (trap === EMPTY) trap = []; for (let k = 0; k < gn; k++) trap.push(GROUP[k]); }
  }
  for (let k = 0; k < gank.length; k++) b[gank[k]] = opp;
  b[to] = 0; b[from] = side;
  return { gank, trap };
}

function mk(b, side, from, to) {
  const e = effects(b, side, from, to);
  return { from, to, path: [from, to], flips: e.trap.length ? e.gank.concat(e.trap) : e.gank, gank: e.gank, trap: e.trap, side };
}

// Every legal move for `side` on board b. `open` is the point the other side has just left (-1 for none): when `side` can GANH by stepping
// into it, only those moves are legal (the MO rule).
export function genMoves(b, side, open = -1) {
  const out = [];
  for (let i = 0; i < SZ; i++) {
    if (b[i] !== side) continue;
    for (const q of NEI[i]) if (b[q] === 0) out.push(mk(b, side, i, q));
  }
  if (open >= 0) {
    const must = out.filter((m) => m.to === open && m.gank.length > 0);
    if (must.length) return must;
  }
  return out;
}
const openOf = (g) => (g.last ? g.last.from : -1);
export const legalMoves = (g) => genMoves(g.board, g.turn, openOf(g));
// Squares of pieces that are forced to step (the MO rule); empty when no move is forced.
export function capturers(g) {
  const out = new Set(), o = openOf(g);
  if (o < 0) return out;
  const free = genMoves(g.board, g.turn, -1);
  const must = free.filter((m) => m.to === o && m.gank.length > 0);
  if (must.length) for (const m of must) out.add(m.from);
  return out;
}
export function legalFrom(g, i) {
  if (g.board[i] !== g.turn) return [];
  return legalMoves(g).filter((m) => m.from === i);
}

// A move the player asks for. Returns { move } or { error } with a plain-words reason.
export function tryMove(g, from, to) {
  const side = g.turn, b = g.board;
  if (b[from] !== side) return { error: 'That is not your piece.' };
  if (from === to) return { error: 'Tap a different point.' };
  const m = legalFrom(g, from).find((x) => x.to === to);
  if (m) return { move: m };
  if (b[to] !== 0) return { error: 'That point is already taken.' };
  if (!adjacent(from, to)) {
    const dr = Math.abs(rowOf(to) - rowOf(from)), dc = Math.abs(colOf(to) - colOf(from));
    if (dr === 1 && dc === 1) return { error: 'No diagonal line there. Diagonals run only through the marked points.' };
    return { error: 'A piece steps one point along a line.' };
  }
  if (capturers(g).size > 0) return { error: `${NAMES[3 - side]} just left a point that you can flank into. You must take it: tap a ringed piece.` };
  return { error: 'That move is not allowed.' };
}

// Plays the move on g (mutates). Returns the flipped squares. Sets winner/reason when the game ends.
export function applyMove(g, m) {
  const side = g.turn, b = g.board, opp = 3 - side;
  b[m.from] = 0; b[m.to] = side;
  for (const q of m.flips) b[q] = side;
  g.moves++;
  g.last = { from: m.from, to: m.to, flips: m.flips.slice(), gank: m.gank.slice(), trap: m.trap.slice(), path: m.path.slice(), side };
  g.quiet = m.flips.length ? 0 : (g.quiet || 0) + 1;
  g.turn = opp;
  const mine = countOf(b, side), theirs = countOf(b, opp);
  if (theirs === 0) { g.winner = side; g.reason = `Every ${NAMES[opp]} piece has been turned.`; }
  if (!g.winner && genMoves(b, opp, -1).length === 0) { g.winner = side; g.reason = `${NAMES[opp]} cannot move.`; }
  if (!g.winner) {
    const k = posKey(g); g.seen[k] = (g.seen[k] || 0) + 1;
    if (g.quiet >= QUIET_LIMIT) {
      if (mine === theirs) { g.winner = 3; g.reason = '40 moves each with no flips, and the same number of pieces.'; }
      else { g.winner = mine > theirs ? side : opp; g.reason = '40 moves each with no flips: the side with more pieces wins.'; }
    } else if (g.seen[k] >= 3) { g.winner = 3; g.reason = 'The same position came up three times.'; }
    else if (g.moves >= MOVE_LIMIT) { g.winner = 3; g.reason = 'Move limit reached.'; }
  }
  return m.flips;
}

// Squares of `side` that the other side could flip with its very next move (danger marks / tutor).
export function endangered(g, side) {
  const out = new Set();
  for (const m of genMoves(g.board, 3 - side, -1)) for (const q of m.flips) out.add(q);
  return out;
}

// One plain sentence describing a move for the tutor / hint.
export function describeMove(g, m) {
  const side = g.turn;
  if (m.trap.length) return m.trap.length === 1 ? 'This traps a piece with no room to move, and turns it.' : `This traps a group of ${m.trap.length} pieces with no room to move, and turns them all.`;
  if (m.gank.length) { const n = m.gank.length / 2; return n === 1 ? 'This flanks two pieces and turns them.' : `This flanks on ${n} lines at once and turns ${m.gank.length} pieces.`; }
  const c = clone(g), before = endangered(c, side);
  applyMove(c, m);
  if (c.winner === side) return 'This wins the game.';
  if (before.has(m.from)) return 'This steps a piece out of danger.';
  const probe = clone(c); probe.turn = side; probe.last = null;
  if (genMoves(probe.board, side, -1).some((mv) => mv.flips.length)) return 'This sets up a flip for your next move.';
  return 'A calm move that keeps your pieces together.';
}
