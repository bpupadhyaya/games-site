// Lau Kata Kati rules: the single source of truth for what is legal and what a move does. Pure and deterministic.
//
// The board has 19 points (see POINTS): two triangles that meet at one point. Point 0 is the meeting point (the "waist", empty at the start).
// Each triangle has three cross lines of three points (left, middle, right) and the straight lines run from the waist through every
// cross line: one along the axis and two diagonals that continue straight through the waist into the other triangle.
//   top triangle (side 2):    level 1 = 1,2,3   level 2 = 4,5,6   level 3 = 7,8,9      (left, middle, right; level 3 is the far base)
//   bottom triangle (side 1): level 1 = 10,11,12  level 2 = 13,14,15  level 3 = 16,17,18
// Side 1 = Gold (moves first, starts at the bottom), side 2 = Ruby. winner: 0 playing, 1, 2, or 3 = draw.
export const SZ = 19;
export const VARIANTS = {
  classic: { name: 'Classic', long: 'Classic Lau Kata Kati', goal: 'all', blurb: 'Nine pieces each. Capturing is your choice. Capture every enemy piece, or leave the other side with no move, to win.' },
  forced:  { name: 'Must capture', long: 'Lau Kata Kati, Must Capture', goal: 'all', blurb: 'The same game, but if you can capture you must. Draughts-style, sharper and more tactical.' },
  quick:   { name: 'Quick', long: 'Quick Lau Kata Kati', goal: 'five', blurb: 'The same game as Classic. The first to capture 5 pieces wins.' },
};
export const VARIANT_KEYS = ['classic', 'forced', 'quick'];
export const START = 9;
export const QUICK_GOAL = 5;
export const QUIET_LIMIT = 40;          // plies (20 moves each) with no capture before the game is settled on material
export const MOVE_LIMIT = 240;          // plies (120 moves each) before the game is called a draw
export const NAMES = ['', 'Gold', 'Ruby'];

// Point coordinates in board units. x runs -2.4 .. 2.4 across, y runs -3 (the far base of the top triangle) .. 3 (the bottom triangle's base).
export const DX = 0.8;
export const POINTS = [[0, 0]];
for (const sgn of [-1, 1]) for (let k = 1; k <= 3; k++) for (let c = 0; c < 3; c++) POINTS.push([(c - 1) * k * DX, sgn * k]);
// POINTS[1..9] have y < 0 (top, side 2), POINTS[10..18] have y > 0 (bottom, side 1)

const key = (x, y) => Math.round(x * 20) + ',' + Math.round(y * 20);
const AT = new Map(POINTS.map((p, i) => [key(p[0], p[1]), i]));
const ADJ = Array.from({ length: SZ }, () => []);
const link = (a, b) => { if (!ADJ[a].includes(b)) { ADJ[a].push(b); ADJ[b].push(a); } };
const idx = (top, k, c) => (top ? 1 : 10) + (k - 1) * 3 + c;
for (const top of [true, false]) for (let k = 1; k <= 3; k++) {
  link(idx(top, k, 0), idx(top, k, 1)); link(idx(top, k, 1), idx(top, k, 2));          // the cross lines
  for (let c = 0; c < 3; c++) link(k === 1 ? 0 : idx(top, k - 1, c), idx(top, k, c));  // the axis and the two diagonals, outward from the waist
}
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
  for (let i = 1; i <= 9; i++) { board[i] = 2; board[9 + i] = 1; }
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
  b[from] = 0;                                              // lift the piece so that it may pass over its own starting point
  const caps = [], path = [from];
  const dfs = (pos) => {
    for (const [over, land] of JUMPS[pos]) {
      if (b[over] !== enemy || b[land] !== 0) continue;
      b[over] = 0; caps.push(over); path.push(land);
      const m = { from, to: land, caps: caps.slice(), path: path.slice() };
      const prev = best.get(land);
      if (land !== from && (!prev || prev.caps.length < m.caps.length)) best.set(land, m);   // a loop that ends on its own start is not a move (it would also lift the piece off the board)
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
  if (b[from] !== side) return { error: 'That is not your piece.' };
  if (from === to) return { error: 'Tap a different point.' };
  const m = findMove(g, from, to);
  if (m) return { move: m };
  if (b[to] !== 0) return { error: 'That point is already taken.' };
  if (g.variant === 'forced' && legalMoves(g).some((q) => q.caps.length)) return { error: 'You must capture when you can. Tap a piece that has a ringed point.' };
  if (!NEIGHBOURS[from].includes(to)) return { error: 'A piece steps to the next point along a drawn line, or jumps an enemy piece that is right next to it.' };
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
  if (left <= 0) { g.winner = side; g.reason = 'Every enemy piece has been captured.'; }
  else if (g.variant === 'quick' && g.lost[opp] >= QUICK_GOAL) { g.winner = side; g.reason = 'Five pieces captured.'; }
  if (!g.winner) {
    if (legalMoves(g, opp).length === 0) { g.winner = side; g.reason = `${NAMES[opp]} has no move.`; }
    else {
      const k = posKey(g); g.seen[k] = (g.seen[k] || 0) + 1;
      if (g.quiet >= QUIET_LIMIT) {
        const a = START - g.lost[1], c = START - g.lost[2];
        if (a === c) { g.winner = 3; g.reason = '20 moves each without a capture, with equal pieces.'; }
        else { g.winner = a > c ? 1 : 2; g.reason = '20 moves each without a capture: the side with more pieces wins.'; }
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
  if (caps.length) return caps.length === 1 ? 'This captures a piece.' : `This jumps ${caps.length} pieces in one turn.`;
  const before = endangered(g, side), c = clone(g);
  applyMove(c, m);
  if (c.winner === side) return 'This wins the game.';
  if (before.has(m.from)) return 'This moves a piece out of danger.';
  const probe = clone(c); probe.turn = side;
  if (legalMoves(probe, side).some((q) => q.caps.length)) return 'This sets up a capture for your next move.';
  return 'A solid move that improves your position.';
}
