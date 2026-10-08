// Hasami Shogi rules: the single source of truth for what is legal and what a move does. Pure and deterministic.
// Squares are numbered 0..80, row by row from the TOP-left (row 0 is White's home side, row 8 is Black's).
// Side 1 = Black (moves first, bottom, pieces point up the board), side 2 = White. winner: 0 playing, 1, 2, or 3 = draw.
export const SZ = 81;
export const VARIANTS = {
  classic: { name: 'Classic', long: 'Classic Hasami Shogi', rows: 1, goal: 'last', blurb: '9 pieces each. Leave your opponent with one piece to win.' },
  quick:   { name: 'Quick', long: 'Quick Hasami Shogi', rows: 1, goal: 'five', blurb: '9 pieces each. The first to capture 5 pieces wins.' },
  dai:     { name: 'Dai', long: 'Dai Hasami Shogi', rows: 2, goal: 'line', blurb: 'Dai means "large". 18 pieces each, with jumping. Make a line of five of your own.' },
};
export const VARIANT_KEYS = ['classic', 'quick', 'dai'];
export const QUIET_LIMIT = 60;          // plies (30 moves each) with no capture before a Classic or Quick game is settled on material
export const MOVE_LIMIT = 400;          // plies (200 moves each) before the game is called a draw
export const START = (variant) => VARIANTS[variant].rows * 9;
export const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const CORNERS = [{ i: 0, a: 1, b: 9 }, { i: 8, a: 7, b: 17 }, { i: 72, a: 63, b: 73 }, { i: 80, a: 79, b: 71 }];
export const rowOf = (i) => (i / 9) | 0;
export const colOf = (i) => i % 9;
export const NAMES = ['', 'Black', 'White'];

export function newGame(variant = 'classic') {
  const board = new Array(SZ).fill(0);
  for (let k = 0; k < VARIANTS[variant].rows; k++) for (let c = 0; c < 9; c++) { board[(8 - k) * 9 + c] = 1; board[k * 9 + c] = 2; }
  const g = { variant, board, turn: 1, moves: 0, lost: [0, 0, 0], winner: 0, reason: '', seen: {}, last: null, quiet: 0 };
  g.seen[posKey(g)] = 1;
  return g;
}
export const clone = (g) => ({ ...g, board: g.board.slice(), lost: g.lost.slice(), seen: { ...g.seen }, last: g.last ? { ...g.last, caps: g.last.caps.slice() } : null });
export const posKey = (g) => g.board.join('') + g.turn;
export const pieceCount = (g, side) => START(g.variant) - g.lost[side];

// Destinations for the piece on square i. `jump` = the Dai rule. Pushes into `out` (an array) and returns it.
export function destinations(b, i, jump, out = []) {
  const r = rowOf(i), c = colOf(i);
  for (let d = 0; d < 4; d++) {
    const dr = DIRS[d][0], dc = DIRS[d][1];
    let rr = r + dr, cc = c + dc, steps = 0;
    while (rr >= 0 && rr < 9 && cc >= 0 && cc < 9 && b[rr * 9 + cc] === 0) { out.push(rr * 9 + cc); rr += dr; cc += dc; steps++; }
    if (jump && steps === 0 && rr >= 0 && rr < 9 && cc >= 0 && cc < 9) {                 // an adjacent piece (either colour): leap it
      const r2 = rr + dr, c2 = cc + dc;
      if (r2 >= 0 && r2 < 9 && c2 >= 0 && c2 < 9 && b[r2 * 9 + c2] === 0) out.push(r2 * 9 + c2);
    }
  }
  return out;
}

const scratch = new Int16Array(40);
// What would the piece of `side` that has just arrived on `to` capture? Fills scratch, returns the count. (Board already has the piece on `to`.)
export function capturesAt(b, to, side, buf = scratch) {
  const enemy = 3 - side, r = rowOf(to), c = colOf(to);
  let n = 0;
  for (let d = 0; d < 4; d++) {
    const dr = DIRS[d][0], dc = DIRS[d][1], start = n;
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < 9 && cc >= 0 && cc < 9 && b[rr * 9 + cc] === enemy) { buf[n++] = rr * 9 + cc; rr += dr; cc += dc; }
    if (!(n > start && rr >= 0 && rr < 9 && cc >= 0 && cc < 9 && b[rr * 9 + cc] === side)) n = start;
  }
  for (let k = 0; k < 4; k++) {
    const q = CORNERS[k];
    if (b[q.i] === enemy && b[q.a] === side && b[q.b] === side && (to === q.a || to === q.b)) buf[n++] = q.i;
  }
  return n;
}

// Five of `side` in an unbroken row or column, entirely outside that side's own two home ranks (Dai).
export function hasFive(b, side) {
  const r0 = side === 1 ? 0 : 2, r1 = side === 1 ? 6 : 8;
  for (let r = r0; r <= r1; r++) { let run = 0; for (let c = 0; c < 9; c++) { run = b[r * 9 + c] === side ? run + 1 : 0; if (run >= 5) return true; } }
  for (let c = 0; c < 9; c++) { let run = 0; for (let r = r0; r <= r1; r++) { run = b[r * 9 + c] === side ? run + 1 : 0; if (run >= 5) return true; } }
  return false;
}

export function legalMoves(g, side = g.turn) {
  const out = [], jump = g.variant === 'dai', tmp = [];
  for (let i = 0; i < SZ; i++) if (g.board[i] === side) { tmp.length = 0; destinations(g.board, i, jump, tmp); for (const to of tmp) out.push({ from: i, to }); }
  return out;
}
export const legalFrom = (g, i) => (g.board[i] === g.turn ? destinations(g.board, i, g.variant === 'dai') : []);

// Squares the player to move would capture with from -> to (without playing it).
export function previewCaps(g, from, to) {
  const b = g.board, side = g.board[from], keep = b[to];
  b[to] = side; b[from] = 0;
  const n = capturesAt(b, to, side), caps = Array.from(scratch.subarray(0, n));
  b[from] = side; b[to] = keep;
  return caps;
}

// A move the player asks for. Returns { move } or { error } with a plain-words reason (used for refused-move feedback).
export function tryMove(g, from, to) {
  const side = g.turn, b = g.board;
  if (b[from] !== side) return { error: `That is not your piece.` };
  if (from === to) return { error: 'Tap a different square.' };
  if (legalFrom(g, from).includes(to)) return { move: { from, to } };
  if (b[to] !== 0) return { error: 'That square is already taken.' };
  const dr = rowOf(to) - rowOf(from), dc = colOf(to) - colOf(from);
  if (dr !== 0 && dc !== 0) return { error: 'Pieces slide along a row or a column, like a rook. No diagonals.' };
  const dist = Math.abs(dr || dc);
  if (g.variant === 'dai' && dist === 2) return { error: 'You can only jump one piece that stands right next to you.' };
  if (g.variant !== 'dai') {
    for (let k = 1; k < dist; k++) { const sq = from + k * ((dr ? Math.sign(dr) * 9 : 0) + (dc ? Math.sign(dc) : 0)); if (b[sq]) return { error: 'Another piece is in the way. In this rule set pieces cannot jump.' }; }
  }
  return { error: 'Another piece is in the way.' };
}

// Plays the move on g (mutates). Returns the captured squares. Sets winner/reason when the game ends.
export function applyMove(g, m) {
  const side = g.turn, b = g.board, opp = 3 - side;
  b[m.to] = side; b[m.from] = 0;
  const n = capturesAt(b, m.to, side), caps = Array.from(scratch.subarray(0, n));
  for (const q of caps) b[q] = 0;
  g.lost[opp] += n; g.moves++; g.last = { from: m.from, to: m.to, caps, side };
  g.quiet = n ? 0 : (g.quiet || 0) + 1;
  g.turn = opp;
  const left = START(g.variant) - g.lost[opp];
  if (g.variant === 'classic' && left <= 1) { g.winner = side; g.reason = 'Only one piece left to defend.'; }
  else if (g.variant === 'quick' && g.lost[opp] >= 5) { g.winner = side; g.reason = 'Five pieces captured.'; }
  else if (g.variant === 'dai' && hasFive(b, side)) { g.winner = side; g.reason = 'Five in a row.'; }
  else if (g.variant === 'dai' && left < 5) { g.winner = side; g.reason = 'Too few pieces left to make five.'; }
  if (!g.winner) {
    if (legalMoves(g, opp).length === 0) { g.winner = side; g.reason = `${NAMES[opp]} has no move.`; }
    else {
      const k = posKey(g); g.seen[k] = (g.seen[k] || 0) + 1;
      if (g.variant !== 'dai' && g.quiet >= QUIET_LIMIT) {
        const a = START(g.variant) - g.lost[1], b2 = START(g.variant) - g.lost[2];
        if (a === b2) { g.winner = 3; g.reason = '30 moves each without a capture, with equal pieces.'; }
        else { g.winner = a > b2 ? 1 : 2; g.reason = '30 moves each without a capture: the side with more pieces wins.'; }
      }
      else if (g.seen[k] >= 3) { g.winner = 3; g.reason = 'The same position came up three times.'; }
      else if (g.moves >= MOVE_LIMIT) { g.winner = 3; g.reason = 'Move limit reached.'; }
    }
  }
  return caps;
}

// Squares of `side` that the other side could capture with its very next move (danger marks / tutor).
export function endangered(g, side) {
  const out = new Set(), opp = 3 - side, b = g.board, jump = g.variant === 'dai', tmp = [];
  for (let i = 0; i < SZ; i++) {
    if (b[i] !== opp) continue;
    tmp.length = 0; destinations(b, i, jump, tmp);
    for (const to of tmp) {
      b[to] = opp; b[i] = 0;
      const n = capturesAt(b, to, opp); for (let k = 0; k < n; k++) out.add(scratch[k]);
      b[i] = opp; b[to] = 0;
    }
  }
  return out;
}

// One plain sentence describing a move for the tutor / hint.
export function describeMove(g, m) {
  const caps = previewCaps(g, m.from, m.to), side = g.turn;
  if (caps.length) return caps.length === 1 ? 'This captures a piece.' : `This captures ${caps.length} pieces at once.`;
  const c = clone(g); const before = endangered(c, side);
  applyMove(c, m);
  if (c.winner === side) return 'This wins the game.';
  if (g.variant === 'dai' && hasFive(c.board, side)) return 'This makes five in a row.';
  if (before.has(m.from)) return 'This moves a piece out of danger.';
  // would the mover have a capture available if it were their turn again?
  const probe = clone(c); probe.turn = side;
  if (legalMoves(probe, side).some((mv) => previewCaps(probe, mv.from, mv.to).length)) return 'This sets up a capture for your next move.';
  return 'A solid move that improves your position.';
}
