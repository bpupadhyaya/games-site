// Sholo Guti rules: the single source of truth for what is legal and what a move does. Pure and deterministic.
//
// The board has 37 points (see POINTS): a 5 x 5 grid with its diagonals (nodes 0..24, row by row from the TOP-left, so row 0 is Indigo's
// side and row 4 is Ivory's), plus a block of six points drawn as a triangle on the top (25..30) and on the bottom (31..36).
// Side 1 = Ivory (moves first, starts at the bottom), side 2 = Indigo. winner: 0 playing, 1, 2, or 3 = draw.
export const SZ = 37;
export const VARIANTS = {
  classic: { name: 'Classic', long: 'Classic Sholo Guti', goal: 'all', blurb: '16 stones each. Capturing is your choice. Capture all of your opponent’s stones to win.' },
  forced:  { name: 'Must capture', long: 'Sholo Guti, Must Capture', goal: 'all', blurb: 'The same game, but if you can capture you must. Draughts-style, sharper and more tactical.' },
  quick:   { name: 'Quick', long: 'Quick Sholo Guti', goal: 'eight', blurb: 'The same game as Classic. The first to capture 8 stones wins.' },
};
export const VARIANT_KEYS = ['classic', 'forced', 'quick'];
export const START = 16;
export const QUICK_GOAL = 8;
export const QUIET_LIMIT = 50;          // plies (25 moves each) with no capture before the game is settled on material
export const MOVE_LIMIT = 300;          // plies (150 moves each) before the game is called a draw
export const NAMES = ['', 'Ivory', 'Indigo'];

// Point coordinates in board units (a grid step is 1). x runs 0..4 across, y runs -2.1 (top apex) .. 6.1 (bottom apex).
export const POINTS = [];
for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) POINTS.push([x, y]);
POINTS.push([2, -2.1], [1.5, -1.55], [2.5, -1.55], [1, -1], [2, -1], [3, -1]);        // 25..30 the top block
POINTS.push([2, 6.1], [1.5, 5.55], [2.5, 5.55], [1, 5], [2, 5], [3, 5]);              // 31..36 the bottom block

const key = (x, y) => Math.round(x * 20) + ',' + Math.round(y * 20);
const AT = new Map(POINTS.map((p, i) => [key(p[0], p[1]), i]));
const ADJ = Array.from({ length: SZ }, () => []);
const link = (a, b) => { if (!ADJ[a].includes(b)) { ADJ[a].push(b); ADJ[b].push(a); } };
for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
  const i = y * 5 + x;
  if (x < 4) link(i, i + 1);
  if (y < 4) link(i, i + 5);
  if ((x + y) % 2 === 0) { if (x < 4 && y < 4) link(i, i + 6); if (x > 0 && y < 4) link(i, i + 4); }
}
// the two blocks: apex a, shoulders s0 s1, base b0 b1 b2; the base points hang from the grid's first (or last) row
const block = (a, s0, s1, b0, b1, b2, rowStart) => {
  link(a, s0); link(a, s1); link(s0, s1); link(s0, b0); link(s0, b1); link(s1, b1); link(s1, b2); link(b0, b1); link(b1, b2);
  link(b0, rowStart + 1); link(b1, rowStart + 2); link(b2, rowStart + 3);                     // straight up / down into the grid
  link(b0, rowStart + 2); link(b2, rowStart + 2);                                             // and the two diagonals into the grid's middle point
};
block(25, 26, 27, 28, 29, 30, 0);
block(31, 32, 33, 34, 35, 36, 20);
export const NEIGHBOURS = ADJ;
// JUMPS[a] = [[over, landing], ...]: a straight line a - over - landing along the drawn lines.
export const JUMPS = Array.from({ length: SZ }, () => []);
for (let a = 0; a < SZ; a++) for (const b of ADJ[a]) {
  const c = AT.get(key(2 * POINTS[b][0] - POINTS[a][0], 2 * POINTS[b][1] - POINTS[a][1]));
  if (c !== undefined && ADJ[b].includes(c)) JUMPS[a].push([b, c]);
}
// the drawn lines, for the board art: pairs of point indices (each once)
export const EDGES = [];
for (let a = 0; a < SZ; a++) for (const b of ADJ[a]) if (a < b) EDGES.push([a, b]);

export function newGame(variant = 'classic') {
  const board = new Array(SZ).fill(0);
  for (let i = 0; i < 10; i++) { board[i] = 2; board[15 + i] = 1; }
  for (let i = 25; i <= 30; i++) board[i] = 2;
  for (let i = 31; i <= 36; i++) board[i] = 1;
  const g = { variant, board, turn: 1, moves: 0, lost: [0, 0, 0], winner: 0, reason: '', seen: {}, last: null, quiet: 0 };
  g.seen[posKey(g)] = 1;
  return g;
}
export const clone = (g) => ({ ...g, board: g.board.slice(), lost: g.lost.slice(), seen: { ...g.seen }, last: g.last ? { ...g.last, caps: g.last.caps.slice(), path: g.last.path.slice() } : null });
export const posKey = (g) => g.board.join('') + g.turn;
export const pieceCount = (g, side) => START - g.lost[side];

// Every move for the stone on `from`: a step to an empty neighbour, or a chain of one or more jumps (stopping after any jump is allowed).
// A move is { from, to, caps: [points jumped], path: [from, ..., to] }. When two chains end on the same point the one that captures more is kept.
export function movesFrom(b, from, side = b[from]) {
  const enemy = 3 - side, out = [], best = new Map();
  for (const n of NEIGHBOURS[from]) if (b[n] === 0) out.push({ from, to: n, caps: [], path: [from, n] });
  b[from] = 0;                                              // lift the stone so that it may pass over its own starting point
  const caps = [], path = [from];
  const dfs = (pos) => {
    for (const [over, land] of JUMPS[pos]) {
      if (b[over] !== enemy || b[land] !== 0) continue;
      b[over] = 0; caps.push(over); path.push(land);
      const m = { from, to: land, caps: caps.slice(), path: path.slice() };
      const prev = best.get(land);
      if (land !== from && (!prev || prev.caps.length < m.caps.length)) best.set(land, m);   // a loop that ends on its own start is not a move (it would also lift the stone off the board)
      dfs(land);
      path.pop(); caps.pop(); b[over] = enemy;
    }
  };
  dfs(from);
  b[from] = side;
  for (const m of best.values()) out.push(m);
  return out;
}

export function legalMoves(g, side = g.turn) {
  const out = [];
  for (let i = 0; i < SZ; i++) if (g.board[i] === side) for (const m of movesFrom(g.board, i, side)) out.push(m);
  if (g.variant === 'forced' && out.some((m) => m.caps.length)) return out.filter((m) => m.caps.length);
  return out;
}
export function legalFrom(g, i) {
  if (g.board[i] !== g.turn) return [];
  if (g.variant === 'forced') return legalMoves(g).filter((m) => m.from === i);
  return movesFrom(g.board, i, g.turn);
}
export const findMove = (g, from, to) => legalFrom(g, from).find((m) => m.to === to) || null;

// Points the move from -> to would capture (without playing it).
export function previewCaps(g, from, to) { const m = findMove(g, from, to); return m ? m.caps.slice() : []; }

// A move the player asks for. Returns { move } or { error } with a plain-words reason (used for refused-move feedback).
export function tryMove(g, from, to) {
  const side = g.turn, b = g.board;
  if (b[from] !== side) return { error: 'That is not your stone.' };
  if (from === to) return { error: 'Tap a different point.' };
  const m = findMove(g, from, to);
  if (m) return { move: m };
  if (b[to] !== 0) return { error: 'That point is already taken.' };
  if (g.variant === 'forced' && legalMoves(g).some((q) => q.caps.length)) return { error: 'You must capture when you can. Tap a stone that has a ringed point.' };
  if (!NEIGHBOURS[from].includes(to)) return { error: 'A stone steps to the next point along a drawn line, or jumps an enemy stone that is right next to it.' };
  return { error: 'That move is not allowed.' };
}

// Plays the move on g (mutates). `m` may carry only from/to: the full move is looked up. Returns the captured points.
export function applyMove(g, m) {
  const side = g.turn, b = g.board, opp = 3 - side;
  const full = m.caps && m.path ? m : findMove(g, m.from, m.to) || { from: m.from, to: m.to, caps: [], path: [m.from, m.to] };
  b[full.from] = 0; b[full.to] = side;
  for (const q of full.caps) b[q] = 0;
  const n = full.caps.length;
  g.lost[opp] += n; g.moves++; g.last = { from: full.from, to: full.to, caps: full.caps.slice(), path: full.path.slice(), side };
  g.quiet = n ? 0 : (g.quiet || 0) + 1;
  g.turn = opp;
  const left = START - g.lost[opp];
  if (left <= 0) { g.winner = side; g.reason = 'Every enemy stone has been captured.'; }
  else if (g.variant === 'quick' && g.lost[opp] >= QUICK_GOAL) { g.winner = side; g.reason = 'Eight stones captured.'; }
  if (!g.winner) {
    if (legalMoves(g, opp).length === 0) { g.winner = side; g.reason = `${NAMES[opp]} has no move.`; }
    else {
      const k = posKey(g); g.seen[k] = (g.seen[k] || 0) + 1;
      if (g.quiet >= QUIET_LIMIT) {
        const a = START - g.lost[1], c = START - g.lost[2];
        if (a === c) { g.winner = 3; g.reason = '25 moves each without a capture, with equal stones.'; }
        else { g.winner = a > c ? 1 : 2; g.reason = '25 moves each without a capture: the side with more stones wins.'; }
      }
      else if (g.seen[k] >= 3) { g.winner = 3; g.reason = 'The same position came up three times.'; }
      else if (g.moves >= MOVE_LIMIT) { g.winner = 3; g.reason = 'Move limit reached.'; }
    }
  }
  return full.caps.slice();
}

// Points of `side` that the other side could capture with its very next move (danger marks / tutor).
export function endangered(g, side) {
  const out = new Set(), opp = 3 - side, b = g.board;
  for (let i = 0; i < SZ; i++) if (b[i] === opp) for (const m of movesFrom(b, i, opp)) for (const q of m.caps) out.add(q);
  return out;
}

// One plain sentence describing a move for the tutor / hint.
export function describeMove(g, m) {
  const full = findMove(g, m.from, m.to) || m, caps = full.caps || [], side = g.turn;
  if (caps.length) return caps.length === 1 ? 'This captures a stone.' : `This jumps ${caps.length} stones in one turn.`;
  const before = endangered(g, side), c = clone(g);
  applyMove(c, m);
  if (c.winner === side) return 'This wins the game.';
  if (before.has(m.from)) return 'This moves a stone out of danger.';
  const probe = clone(c); probe.turn = side;
  if (legalMoves(probe, side).some((q) => q.caps.length)) return 'This sets up a capture for your next move.';
  return 'A solid move that improves your position.';
}
