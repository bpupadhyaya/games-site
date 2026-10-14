// The rule book of Four-Field Kono, as pure functions over a plain-data game. No drawing, no clocks, no randomness.
//
// The board is a square grid of POINTS (pieces stand on the crossings, not in the squares). A board with n fields along each side has
// n + 1 points along each side. Side 1 (Jade) starts at the bottom and moves first, side 2 (Ember) starts at the top.
//   one step      to the empty point straight ahead (never sideways, never back)
//   a jump        over an enemy piece that stands right beside you in any of the four directions, onto the empty point behind it
//   a chain       a piece that has just jumped may jump again, in any direction, as long as it keeps finding a capture
// Win: capture every enemy piece, or leave the other side with no legal move. Steps only go forward, so every game ends.
export const NAMES = { 1: 'Jade', 2: 'Ember', 3: 'Nobody' };

export const VARIANTS = {
  two:  { key: 'two',  n: 2, first: 2, name: 'Two-Field',  long: 'Two-Field Kono',  blurb: 'The smallest board: 3 by 3 points and three stones each. A quick puzzle of timing; Ember starts.' },
  four: { key: 'four', n: 4, first: 1, name: 'Four-Field', long: 'Four-Field Kono', blurb: 'The classic board: 5 by 5 points and eight stones each. The game the tradition is named for.' },
  six:  { key: 'six',  n: 6, first: 1, name: 'Six-Field',  long: 'Six-Field Kono',  blurb: 'The grand board: 7 by 7 points and twelve stones each. Room for long plans.' },
};
export const VARIANT_KEYS = ['two', 'four', 'six'];
export const sizeOf = (variant) => (VARIANTS[variant] || VARIANTS.four).n + 1;
export const startCount = (variant) => { const n = (VARIANTS[variant] || VARIANTS.four).n; return n >= 4 ? (n + 1) + (n - 1) : n + 1; };

// Starting position: the back row full, plus (on the bigger boards) the inner points of the second row.
export function newGame(variant = 'four') {
  const v = VARIANTS[variant] || VARIANTS.four, W = v.n + 1, board = new Array(W * W).fill(0);
  for (let c = 0; c < W; c++) { board[c] = 2; board[(W - 1) * W + c] = 1; }
  if (v.n >= 4) for (let c = 1; c < W - 1; c++) { board[W + c] = 2; board[(W - 2) * W + c] = 1; }
  return { variant: v.key, n: v.n, W, board, turn: v.first, winner: 0, reason: '', moves: 0, lost: [0, 0, 0], last: null };
}
export const clone = (g) => ({ ...g, board: g.board.slice(), lost: g.lost.slice(), last: g.last ? { ...g.last } : null });
export const pieceCount = (g, side) => { let n = 0; for (const p of g.board) if (p === side) n++; return n; };
export const rowOf = (g, i) => Math.floor(i / g.W);
export const colOf = (g, i) => i % g.W;

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

// Every jump chain available to the piece on `from` (boards are tiny, so a plain depth-first walk is plenty). The chain may stop at any
// landing. Returns moves { from, to, path: [from, l1, l2...], caps: [point, ...] } - one for every distinct sequence of jumps.
function chainsFrom(b, W, from, side, out) {
  const walk = (at, path, caps) => {
    for (const [dx, dy] of DIRS) {
      const x = (at % W) + dx, y = Math.floor(at / W) + dy, x2 = x + dx, y2 = y + dy;
      if (x2 < 0 || x2 >= W || y2 < 0 || y2 >= W) continue;
      const over = y * W + x, land = y2 * W + x2;
      if (b[over] !== 3 - side || b[land] !== 0) continue;
      b[over] = 0;                                                      // the captured piece is gone for the rest of the chain
      const p2 = path.concat(land), c2 = caps.concat(over);
      out.push({ from, to: land, path: p2, caps: c2 });
      b[at] = 0; b[land] = side;
      walk(land, p2, c2);
      b[land] = 0; b[at] = side;
      b[over] = 3 - side;
    }
  };
  walk(from, [from], []);
}

// All legal moves for the side to move on a raw board (used by the computer and by the danger marks).
export function movesOn(b, W, side) {
  const out = [];
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== side) continue;
    const x = i % W, y = Math.floor(i / W);
    for (const [dx, dy] of DIRS) {
      if (dx !== 0 || dy !== (side === 1 ? -1 : 1)) continue;                             // a step goes straight forward, never sideways or back
      const x1 = x + dx, y1 = y + dy;
      if (x1 < 0 || x1 >= W || y1 < 0 || y1 >= W) continue;
      if (b[y1 * W + x1] === 0) out.push({ from: i, to: y1 * W + x1, path: [i, y1 * W + x1], caps: [] });
    }
    chainsFrom(b, W, i, side, out);
  }
  return out;
}
export const legalMoves = (g) => (g.winner ? [] : movesOn(g.board, g.W, g.turn));

// The moves of one piece, one entry per destination (the chain that takes the most pieces wins a tie, then the shorter one).
export function movesFrom(g, from) {
  const best = new Map();
  for (const m of legalMoves(g)) {
    if (m.from !== from) continue;
    const o = best.get(m.to);
    if (!o || m.caps.length > o.caps.length || (m.caps.length === o.caps.length && m.path.length < o.path.length)) best.set(m.to, m);
  }
  return [...best.values()];
}
export const legalFrom = (g, from) => movesFrom(g, from).map((m) => m.to);
export const previewCaps = (g, from, to) => { const m = movesFrom(g, from).find((q) => q.to === to); return m ? m.caps : []; };
export function findMove(g, from, to) { return movesFrom(g, from).find((m) => m.to === to) || null; }

export function tryMove(g, from, to) {
  if (g.winner) return { error: 'The game is over.' };
  if (g.board[from] !== g.turn) return { error: 'That is not your piece.' };
  const m = findMove(g, from, to);
  if (m) return { move: m };
  if (g.board[to]) return { error: 'That point is taken.' };
  const dx = Math.abs(colOf(g, to) - colOf(g, from)), dy = Math.abs(rowOf(g, to) - rowOf(g, from));
  if (dx + dy === 1) return { error: 'That step is not possible.' };
  if ((dx === 2 && dy === 0) || (dx === 0 && dy === 2)) return { error: 'To jump there, an enemy piece must stand between.' };
  return { error: 'A piece moves one point, or jumps one enemy piece.' };
}

// Plays a legal move in place and returns the captured points (in the order they were jumped).
export function applyMove(g, m) {
  const side = g.turn, opp = 3 - side;
  g.board[m.from] = 0; g.board[m.to] = side;
  for (const c of m.caps) { g.board[c] = 0; }
  g.lost[opp] += m.caps.length;
  g.moves += 1;
  g.last = { from: m.from, to: m.to, caps: m.caps.slice(), path: m.path.slice(), side };
  g.turn = opp;
  settle(g, side);
  return m.caps;
}

function settle(g, mover) {
  const opp = 3 - mover;
  if (pieceCount(g, opp) === 0) { g.winner = mover; g.reason = `${NAMES[mover]} captured every ${NAMES[opp]} stone.`; return; }
  if (movesOn(g.board, g.W, opp).length === 0) { g.winner = mover; g.reason = `${NAMES[opp]} has no move left.`; }
}

// Your pieces the other side could capture with its next move (for the danger marks).
export function endangered(g, side) {
  const set = new Set();
  const b = g.board.slice();
  for (const m of movesOn(b, g.W, 3 - side)) for (const c of m.caps) set.add(c);
  return set;
}

const name = (g, i) => 'abcdefg'[colOf(g, i)] + String(g.W - rowOf(g, i));
export const pointName = name;
export function describeMove(g, m) {
  if (m.caps.length === 0) return `${name(g, m.from)} steps to ${name(g, m.to)}.`;
  if (m.caps.length === 1) return `${name(g, m.from)} jumps to ${name(g, m.to)} and takes a stone.`;
  return `${name(g, m.from)} jumps ${m.caps.length} times to ${name(g, m.to)} and takes ${m.caps.length} stones.`;
}
