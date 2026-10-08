// Reversi rules: the single source of truth for what is legal and what a move does. Pure and deterministic.
// Squares are numbered row by row from the TOP-left (row 0 is the far side of the board). Side 1 = Black (moves first), side 2 = White.
// winner: 0 playing, 1, 2, or 3 = draw.
export const VARIANTS = {
  classic: { name: 'Classic', long: 'Classic Reversi', n: 8, reverse: false, blurb: 'The standard 8 by 8 game. Finish with more discs than your opponent.' },
  mini:    { name: 'Mini', long: 'Mini Reversi', n: 6, reverse: false, blurb: 'A quick 6 by 6 game, about half the length. Most discs wins.' },
  reverse: { name: 'Reverse', long: 'Reverse Reversi', n: 8, reverse: true, blurb: 'Same moves on the 8 by 8 board, but the FEWEST discs wins.' },
};
export const VARIANT_KEYS = ['classic', 'mini', 'reverse'];
export const NAMES = ['', 'Black', 'White'];
export const sizeOf = (variant) => VARIANTS[variant].n;
export const rowOf = (i, n) => (i / n) | 0;
export const colOf = (i, n) => i % n;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

// Rays: for every square and every direction, the squares in that direction up to the edge. Built once per board size.
const rayCache = {};
export function raysFor(n) {
  if (rayCache[n]) return rayCache[n];
  const rays = [];
  for (let i = 0; i < n * n; i++) {
    const r = (i / n) | 0, c = i % n, list = [];
    for (const [dr, dc] of DIRS) { const ray = []; let rr = r + dr, cc = c + dc; while (rr >= 0 && rr < n && cc >= 0 && cc < n) { ray.push(rr * n + cc); rr += dr; cc += dc; } list.push(ray); }
    rays.push(list);
  }
  return (rayCache[n] = rays);
}

export function newBoard(n) {
  const b = new Array(n * n).fill(0), m = n / 2;
  b[(m - 1) * n + m - 1] = 2; b[m * n + m] = 2; b[(m - 1) * n + m] = 1; b[m * n + m - 1] = 1;
  return b;
}
export function newGame(variant = 'classic') {
  const n = sizeOf(variant);
  return { variant, n, board: newBoard(n), turn: 1, moves: 0, winner: 0, reason: '', last: null, passes: 0, passed: 0 };
}
export const clone = (g) => ({ ...g, board: g.board.slice(), last: g.last ? { ...g.last, flips: g.last.flips.slice() } : null });
export function count(b, side) { let c = 0; for (let i = 0; i < b.length; i++) if (b[i] === side) c++; return c; }
export const discs = (g) => [0, count(g.board, 1), count(g.board, 2)];

// The squares that `side` would flip by placing a disc on i (empty list = illegal). Works on any array-like board of size n*n.
export function flipsAt(b, n, i, side) {
  if (b[i] !== 0) return [];
  const rays = raysFor(n)[i], opp = 3 - side, out = [];
  for (let d = 0; d < 8; d++) {
    const ray = rays[d]; let k = 0;
    while (k < ray.length && b[ray[k]] === opp) k++;
    if (k > 0 && k < ray.length && b[ray[k]] === side) for (let j = 0; j < k; j++) out.push(ray[j]);
  }
  return out;
}
export function hasMove(b, n, side) {
  for (let i = 0; i < b.length; i++) if (b[i] === 0 && flipsAt(b, n, i, side).length) return true;
  return false;
}
// All legal moves for side: [{ to, flips }]
export function legalMoves(g, side = g.turn) {
  const out = [];
  for (let i = 0; i < g.board.length; i++) if (g.board[i] === 0) { const f = flipsAt(g.board, g.n, i, side); if (f.length) out.push({ to: i, flips: f }); }
  return out;
}
export const isLegal = (g, i, side = g.turn) => g.board[i] === 0 && flipsAt(g.board, g.n, i, side).length > 0;

// A move the player asks for. Returns { move } or { error } with a plain-words reason.
export function tryMove(g, to) {
  const b = g.board;
  if (to < 0 || to >= b.length) return { error: 'Tap a square on the board.' };
  if (b[to] !== 0) return { error: 'That square is already taken.' };
  if (flipsAt(b, g.n, to, g.turn).length === 0) return { error: 'A move must flip at least one enemy disc. Squares that do are marked.' };
  return { move: { to } };
}

// Plays the move on g (mutates). Returns the flipped squares. Handles passing and the end of the game.
export function applyMove(g, m) {
  const side = g.turn, opp = 3 - side, b = g.board, n = g.n;
  const flips = flipsAt(b, n, m.to, side);
  b[m.to] = side; for (const q of flips) b[q] = side;
  g.moves++; g.last = { to: m.to, flips, side }; g.passed = 0;
  if (hasMove(b, n, opp)) g.turn = opp;
  else if (hasMove(b, n, side)) { g.turn = side; g.passed = opp; g.passes++; }
  else finishGame(g);
  return flips;
}
export function finishGame(g) {
  const a = count(g.board, 1), c = count(g.board, 2), rev = VARIANTS[g.variant].reverse;
  g.turn = 0;
  if (a === c) { g.winner = 3; g.reason = `Both sides finish with ${a} discs.`; return; }
  const bigger = a > c ? 1 : 2;
  g.winner = rev ? 3 - bigger : bigger;
  g.reason = rev ? `${NAMES[g.winner]} has the fewest discs: ${Math.min(a, c)} to ${Math.max(a, c)}.` : `${NAMES[g.winner]} wins ${Math.max(a, c)} to ${Math.min(a, c)}.`;
}

// Fix the turn when a position is built by hand (lessons): the side to move must have a move.
export function normalizeTurn(g, side = 1) {
  g.turn = side; g.winner = 0;
  if (!hasMove(g.board, g.n, side)) { if (hasMove(g.board, g.n, 3 - side)) g.turn = 3 - side; else finishGame(g); }
}

export const isCorner = (i, n) => { const r = rowOf(i, n), c = colOf(i, n); return (r === 0 || r === n - 1) && (c === 0 || c === n - 1); };
export const isXSquare = (i, n) => { const r = rowOf(i, n), c = colOf(i, n); return (r === 1 || r === n - 2) && (c === 1 || c === n - 2); };
const cornersOf = (n) => [0, n - 1, n * (n - 1), n * n - 1];

// One plain sentence describing a move for the tutor / hint.
export function describeMove(g, m) {
  const f = flipsAt(g.board, g.n, m.to, g.turn), n = g.n, rev = VARIANTS[g.variant].reverse, me = g.turn;
  const c = clone(g); applyMove(c, m);
  if (c.winner === me) return 'This move wins the game.';
  if (!rev && isCorner(m.to, n)) return 'A corner can never be flipped. This is a strong square to own.';
  if (c.passed) return 'After this move your opponent has no reply and must pass.';
  if (!rev && isXSquare(m.to, n)) {
    const q = cornersOf(n).find((k) => Math.abs(rowOf(k, n) - rowOf(m.to, n)) === 1 && Math.abs(colOf(k, n) - colOf(m.to, n)) === 1);
    if (q !== undefined && g.board[q] === 0) return 'This sits beside an empty corner, which can hand that corner to your opponent. Choose it only if nothing is better.';
  }
  const theirs = legalMoves(c, 3 - me).length;
  if (rev) return f.length === 1 ? 'This flips just one disc. In Reverse you want few discs.' : `This flips ${f.length} discs. In Reverse, fewer is usually better.`;
  if (c.turn === 3 - me && theirs <= 2) return `This flips ${f.length} and leaves your opponent only ${theirs} move${theirs === 1 ? '' : 's'}.`;
  return f.length === 1 ? 'This flips 1 disc and keeps your options open.' : `This flips ${f.length} discs.`;
}
