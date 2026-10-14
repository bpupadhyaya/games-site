// Kharbaga rules: the single source of truth for what is legal and what a move does. Pure and deterministic.
// Squares are numbered 0..24, row by row from the TOP-left (row 0 is Light's home side, row 4 is Dark's).
// Side 1 = Dark (moves first, bottom, walks UP the board), side 2 = Light. Piece values on the board: 0 empty, 1 Dark man, 2 Light man,
// 3 Dark Master, 4 Light Master. winner: 0 playing, 1, 2, or 3 = draw.
export const N = 5;
export const SZ = 25;
export const START_PIECES = 12;
export const QUIET_LIMIT = 60;          // plies (30 moves each) with no capture, no forward step and no promotion before the game is settled on strength
export const MOVE_LIMIT = 300;          // plies (150 moves each) before the game is called a draw
export const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
export const NAMES = ['', 'Dark', 'Light'];
export const rowOf = (i) => (i / N) | 0;
export const colOf = (i) => i % N;
export const sideOf = (v) => (v === 0 ? 0 : v & 1 ? 1 : 2);
export const isMaster = (v) => v > 2;
const SIDESTEP = true;                                            // a man steps forward or sideways, never back
const fwd = (side) => (side === 1 ? -1 : 1);                      // row step of a forward move
const farRow = (side) => (side === 1 ? 0 : N - 1);

// The start: three full rows, the middle row split between the two sides, the centre square empty.
//   row 0  L L L L L        (Light, top)
//   row 1  L L L L L
//   row 2  L L . D D
//   row 3  D D D D D
//   row 4  D D D D D        (Dark, bottom)
export function newGame() {
  const board = new Array(SZ).fill(0);
  for (let c = 0; c < N; c++) { board[c] = 2; board[N + c] = 2; board[3 * N + c] = 1; board[4 * N + c] = 1; }
  board[2 * N] = 2; board[2 * N + 1] = 2; board[2 * N + 3] = 1; board[2 * N + 4] = 1;
  const g = { board, turn: 1, moves: 0, lost: [0, 0, 0], winner: 0, reason: '', seen: {}, last: null, quiet: 0 };
  g.seen[posKey(g)] = 1;
  return g;
}
export const clone = (g) => ({ ...g, board: g.board.slice(), lost: g.lost.slice(), seen: { ...g.seen }, last: g.last ? { ...g.last, caps: g.last.caps.slice(), path: g.last.path.slice() } : null });
export const posKey = (g) => g.board.join('') + g.turn;
export const pieceCount = (g, side) => START_PIECES - g.lost[side];
export const materialOf = (b, side) => { let m = 0; for (let i = 0; i < SZ; i++) { const v = b[i]; if (v && sideOf(v) === side) m += isMaster(v) ? 2 : 1; } return m; };

// ---- move generation -------------------------------------------------------------------------------------------------------
// A move is { from, to, path: [from, ...landings], caps: [captured squares in order], capVals: [their piece values], val: piece after the move }.
// Captures are compulsory; a capture continues (with the same piece) for as long as it can, and the whole chain is one move.

// All jumps the piece `v` standing on `i` could make right now: [{ to, cap }]. A man jumps the piece next to him; a Master flies.
function jumpsFrom(b, i, v, out) {
  const side = sideOf(v), r = rowOf(i), c = colOf(i), master = isMaster(v);
  for (let d = 0; d < 4; d++) {
    const dr = DIRS[d][0], dc = DIRS[d][1];
    let rr = r + dr, cc = c + dc;
    if (master) while (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc] === 0) { rr += dr; cc += dc; }
    if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
    const q = b[rr * N + cc];
    if (!q || sideOf(q) === side) continue;
    let r2 = rr + dr, c2 = cc + dc;
    while (r2 >= 0 && r2 < N && c2 >= 0 && c2 < N && b[r2 * N + c2] === 0) {
      out.push({ to: r2 * N + c2, cap: rr * N + cc });
      if (!master) break;
      r2 += dr; c2 += dc;
    }
  }
  return out;
}

function chains(b, from, v, path, caps, vals, out) {
  const cur = path[path.length - 1];
  const js = jumpsFrom(b, cur, v, []);
  if (js.length === 0) {
    if (caps.length) out.push(finish(from, v, path, caps, vals));
    return;
  }
  for (const j of js) {
    const keep = b[j.cap];
    b[cur] = 0; b[j.cap] = 0; b[j.to] = v;
    path.push(j.to); caps.push(j.cap); vals.push(keep);
    chains(b, from, v, path, caps, vals, out);
    path.pop(); caps.pop(); vals.pop();
    b[j.to] = 0; b[j.cap] = keep; b[cur] = v;
  }
}
function finish(from, v, path, caps, vals) {
  const to = path[path.length - 1], side = sideOf(v);
  const val = !isMaster(v) && rowOf(to) === farRow(side) ? v + 2 : v;
  return { from, to, path: path.slice(), caps: caps.slice(), capVals: vals.slice(), val };
}

function quiet(from, to, v) {
  const side = sideOf(v), val = !isMaster(v) && rowOf(to) === farRow(side) ? v + 2 : v;
  return { from, to, path: [from, to], caps: [], capVals: [], val };
}
// Quiet (non-capturing) moves of the piece on i. A man: one step forward or sideways. A Master: any distance along a row or column.
function stepsFrom(b, i, v, out) {
  const side = sideOf(v), r = rowOf(i), c = colOf(i);
  if (isMaster(v)) {
    for (let d = 0; d < 4; d++) {
      let rr = r + DIRS[d][0], cc = c + DIRS[d][1];
      while (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc] === 0) { out.push(quiet(i, rr * N + cc, v)); rr += DIRS[d][0]; cc += DIRS[d][1]; }
    }
    return out;
  }
  const f = r + fwd(side);
  if (f >= 0 && f < N && b[f * N + c] === 0) out.push(quiet(i, f * N + c, v));
  if (SIDESTEP) {
    if (c > 0 && b[r * N + c - 1] === 0) out.push(quiet(i, r * N + c - 1, v));
    if (c < N - 1 && b[r * N + c + 1] === 0) out.push(quiet(i, r * N + c + 1, v));
  }
  return out;
}

// Every legal move for `side` on board b. Captures are compulsory, so when any capture exists only captures are returned.
export function genMoves(b, side) {
  const caps = [], tmp = [];
  for (let i = 0; i < SZ; i++) {
    const v = b[i]; if (!v || sideOf(v) !== side) continue;
    chains(b, i, v, [i], [], [], caps);
  }
  if (caps.length) return caps;
  for (let i = 0; i < SZ; i++) { const v = b[i]; if (v && sideOf(v) === side) stepsFrom(b, i, v, tmp); }
  return tmp;
}
export const legalMoves = (g, side = g.turn) => genMoves(g.board, side);
// Squares of pieces that can capture right now (shown as a prompt when a capture is compulsory).
export function capturers(g, side = g.turn) {
  const m = genMoves(g.board, side), out = new Set();
  if (m.length && m[0].caps.length) for (const x of m) out.add(x.from);
  return out;
}
// One move per distinct landing square for the piece on i (the longest chain wins a tie): what the player can tap.
export function legalFrom(g, i) {
  if (!g.board[i] || sideOf(g.board[i]) !== g.turn) return [];
  const best = new Map();
  for (const m of genMoves(g.board, g.turn)) {
    if (m.from !== i) continue;
    const o = best.get(m.to);
    if (!o || m.caps.length > o.caps.length) best.set(m.to, m);
  }
  return [...best.values()];
}
export const previewCaps = (g, from, to) => { const m = legalFrom(g, from).find((x) => x.to === to); return m ? m.caps : []; };

// A move the player asks for. Returns { move } or { error } with a plain-words reason (used for refused-move feedback).
export function tryMove(g, from, to) {
  const side = g.turn, b = g.board, v = b[from];
  if (!v || sideOf(v) !== side) return { error: 'That is not your piece.' };
  if (from === to) return { error: 'Tap a different square.' };
  const m = legalFrom(g, from).find((x) => x.to === to);
  if (m) return { move: m };
  const all = genMoves(b, side), forced = all.length > 0 && all[0].caps.length > 0;
  if (b[to] !== 0) return { error: 'That square is already taken.' };
  if (forced) {
    if (!all.some((x) => x.from === from)) return { error: 'You must capture, and this piece cannot. Tap one of the marked pieces.' };
    return { error: 'You must capture. This piece can jump, so it has to.' };
  }
  const dr = rowOf(to) - rowOf(from), dc = colOf(to) - colOf(from);
  if (!isMaster(v)) {
    if (dc === 0 && dr === -fwd(side)) return { error: 'A man never walks backwards. He steps forward or sideways.' };
    if (dr !== 0 && dc !== 0) return { error: 'No diagonal moves. Step forward or sideways, one square.' };
    return { error: 'A man steps just one square: forward or sideways.' };
  }
  if (dr !== 0 && dc !== 0) return { error: 'A Master moves along a row or a column, not diagonally.' };
  return { error: 'Another piece is in the way.' };
}

// Plays the move on g (mutates). Returns the captured squares. Sets winner/reason when the game ends.
export function applyMove(g, m) {
  const side = g.turn, b = g.board, opp = 3 - side, before = b[m.from];
  b[m.from] = 0;
  for (const q of m.caps) b[q] = 0;
  b[m.to] = m.val;
  const n = m.caps.length, promoted = m.val !== before;
  g.lost[opp] += n; g.moves++;
  g.last = { from: m.from, to: m.to, caps: m.caps.slice(), path: m.path.slice(), side, promoted };
  const stepForward = !isMaster(before) && n === 0 && rowOf(m.to) !== rowOf(m.from);
  g.quiet = n || promoted || stepForward ? 0 : (g.quiet || 0) + 1;
  g.turn = opp;
  if (g.lost[opp] >= START_PIECES) { g.winner = side; g.reason = 'Every enemy piece has been captured.'; }
  if (!g.winner && genMoves(b, opp).length === 0) { g.winner = side; g.reason = `${NAMES[opp]} cannot move.`; }
  if (!g.winner) {
    const k = posKey(g); g.seen[k] = (g.seen[k] || 0) + 1;
    if (g.quiet >= QUIET_LIMIT) {
      const a = materialOf(b, 1), c = materialOf(b, 2);
      if (a === c) { g.winner = 3; g.reason = '30 moves each without progress, with equal strength.'; }
      else { g.winner = a > c ? 1 : 2; g.reason = '30 moves each without progress: the stronger side wins.'; }
    }
    else if (g.seen[k] >= 3) { g.winner = 3; g.reason = 'The same position came up three times.'; }
    else if (g.moves >= MOVE_LIMIT) { g.winner = 3; g.reason = 'Move limit reached.'; }
  }
  return m.caps;
}

// Squares of `side` that the other side could capture with its very next move (danger marks / tutor).
export function endangered(g, side) {
  const out = new Set(), m = genMoves(g.board, 3 - side);
  if (m.length && m[0].caps.length) for (const x of m) for (const q of x.caps) out.add(q);
  return out;
}

// One plain sentence describing a move for the tutor / hint.
export function describeMove(g, m) {
  const side = g.turn, v = g.board[m.from];
  if (m.caps.length) { const n = m.caps.length; return n === 1 ? 'This captures a piece.' : `This captures ${n} pieces in one chain.`; }
  const c = clone(g), before = endangered(c, side);
  applyMove(c, m);
  if (c.winner === side) return 'This wins the game.';
  if (m.val !== v) return 'This reaches the far side and makes a Master.';
  if (before.has(m.from)) return 'This moves a piece out of danger.';
  const probe = clone(c); probe.turn = side;
  if (legalMoves(probe, side).some((mv) => mv.caps.length)) return 'This sets up a capture for your next move.';
  return 'A solid move that improves your position.';
}
