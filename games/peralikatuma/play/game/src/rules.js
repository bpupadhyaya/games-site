// Peralikatuma rules: the single source of truth for what is legal and what a move does. Pure and deterministic.
//
// The board is an octagon cut from a 9 by 9 lattice of POINTS (pieces stand on the crossings, not in squares). Points are numbered
// 0..80, row by row from the top-left (index = row * 9 + column); the 24 lattice points outside the octagon are not part of the board.
// Every point is joined to its four straight neighbours; points where (row + column) is even are also joined diagonally.
// Piece codes: 0 empty, 1 Ruby man, 2 Sapphire man, 3 Ruby star, 4 Sapphire star. Side 1 = Ruby (bottom, moves first), side 2 = Sapphire (top).
// winner: 0 playing, 1, 2, or 3 = draw.
export const SZ = 81;
export const START = 15;                       // men each at the start
export const NAMES = ['', 'Ruby', 'Sapphire'];
export const VARIANTS = {
  classic: { name: 'Classic', long: 'Classic Peralikatuma', flying: true, blurb: 'A crowned Star slides and leaps along whole lines.' },
  steps:   { name: 'Gentle Stars', long: 'Peralikatuma with Gentle Stars', flying: false, blurb: 'A crowned Star moves and leaps one point at a time, in every direction.' },
};
export const VARIANT_KEYS = ['classic', 'steps'];
export const QUIET_LIMIT = 50;                 // plies (25 moves each) with no capture and no forward step before the game is settled on material
export const MOVE_LIMIT = 300;                 // plies (150 moves each) before a draw
export const STAR_VALUE = 3;

export const rowOf = (i) => (i / 9) | 0;
export const colOf = (i) => i % 9;
export const isPoint = (i) => i >= 0 && i < SZ && Math.abs(colOf(i) - 4) + Math.abs(rowOf(i) - 4) <= 5;
export const POINTS = [];
for (let i = 0; i < SZ; i++) if (isPoint(i)) POINTS.push(i);
// Directions: 0 N, 1 S, 2 W, 3 E, 4 NW, 5 NE, 6 SW, 7 SE (the last four exist only from points where row + column is even).
export const DR = [-1, 1, 0, 0, -1, -1, 1, 1], DC = [0, 0, -1, 1, -1, 1, -1, 1];
export const NB = [];                          // NB[i][d] = neighbouring point or -1
for (let i = 0; i < SZ; i++) {
  const row = new Int8Array(8).fill(-1);
  if (isPoint(i)) {
    const r = rowOf(i), c = colOf(i);
    for (let d = 0; d < 8; d++) {
      if (d >= 4 && (r + c) % 2 !== 0) continue;
      const rr = r + DR[d], cc = c + DC[d];
      if (rr >= 0 && rr < 9 && cc >= 0 && cc < 9 && isPoint(rr * 9 + cc)) row[d] = rr * 9 + cc;
    }
  }
  NB.push(row);
}
export const sideOf = (c) => (c === 0 ? 0 : ((c - 1) & 1) + 1);
export const isStar = (c) => c > 2;
const STEP_DIRS = [[0, 2, 3, 4, 5], [1, 2, 3, 6, 7]];   // men: forward, sideways and the forward diagonals (index = side - 1)
// The two rows nearest the enemy crown a man.
export const crownRow = (side, i) => (side === 1 ? rowOf(i) <= 1 : rowOf(i) >= 7);

export function newGame(variant = 'classic') {
  const board = new Array(SZ).fill(0);
  for (const i of POINTS) { const r = rowOf(i); if (r <= 2) board[i] = 2; else if (r >= 6) board[i] = 1; }
  const g = { variant, board, turn: 1, moves: 0, lost: [0, 0, 0], winner: 0, reason: '', seen: {}, last: null, quiet: 0 };
  g.seen[posKey(g)] = 1;
  return g;
}
export const clone = (g) => ({ ...g, board: g.board.slice(), lost: g.lost.slice(), seen: { ...g.seen }, last: g.last ? { ...g.last, caps: g.last.caps.slice(), path: g.last.path.slice() } : null });
export const posKey = (g) => g.board.join('') + g.turn;
export const pieceCount = (g, side) => START - g.lost[side];
export const materialOf = (b, side) => { let v = 0; for (let i = 0; i < SZ; i++) { const c = b[i]; if (c && sideOf(c) === side) v += isStar(c) ? STAR_VALUE : 1; } return v; };

// All capture chains for the piece standing on `from`. A chain is a run of leaps; it must be played to its end. Captured pieces stay on the
// board until the whole chain is done (they block, and cannot be leapt twice). Pushes { from, to, path, caps } into `out`.
export function chainsFrom(b, from, flying, out) {
  const piece = b[from], side = sideOf(piece), star = isStar(piece), far = star && flying;
  const caps = [], path = [from], done = new Set();
  b[from] = 0;                                  // the mover has left its point: it may cross or land on it again
  const dfs = (pos) => {
    let any = false;
    for (let d = 0; d < 8; d++) {
      let q = NB[pos][d];
      if (q < 0) continue;
      if (far) while (q >= 0 && b[q] === 0) q = NB[q][d];
      if (q < 0) continue;
      const c = b[q];
      if (c === 0 || sideOf(c) === side || done.has(q)) continue;
      let r = NB[q][d];
      while (r >= 0 && b[r] === 0) {
        done.add(q); caps.push(q); path.push(r); any = true;
        dfs(r);
        path.pop(); caps.pop(); done.delete(q);
        if (!far) break;
        r = NB[r][d];
      }
    }
    if (!any && caps.length) out.push({ from, to: pos, path: path.slice(), caps: caps.slice() });
  };
  dfs(from);
  b[from] = piece;
  return out;
}

// Plain (non-capturing) moves for the piece on `from`.
export function stepsFrom(b, from, flying, out) {
  const piece = b[from], side = sideOf(piece);
  if (isStar(piece)) {
    for (let d = 0; d < 8; d++) {
      let q = NB[from][d];
      while (q >= 0 && b[q] === 0) { out.push({ from, to: q, path: [from, q], caps: [] }); if (!flying) break; q = NB[q][d]; }
    }
  } else {
    for (const d of STEP_DIRS[side - 1]) { const q = NB[from][d]; if (q >= 0 && b[q] === 0) out.push({ from, to: q, path: [from, q], caps: [] }); }
  }
  return out;
}

// Every legal move for `side`. A capture is compulsory: if any piece can leap, only leaps are legal (the player may choose which).
export function generate(b, side, flying, capturesOnly = false) {
  const caps = [];
  for (let i = 0; i < SZ; i++) if (b[i] && sideOf(b[i]) === side) chainsFrom(b, i, flying, caps);
  if (caps.length || capturesOnly) return caps;
  const out = [];
  for (let i = 0; i < SZ; i++) if (b[i] && sideOf(b[i]) === side) stepsFrom(b, i, flying, out);
  return out;
}
export const legalMoves = (g, side = g.turn) => generate(g.board, side, VARIANTS[g.variant].flying);
// Destination points for the piece on i (empty when it is not the mover's piece or may not move now).
export function legalFrom(g, i) {
  if (!g.board[i] || sideOf(g.board[i]) !== g.turn) return [];
  const to = [];
  for (const m of legalMoves(g)) if (m.from === i && !to.includes(m.to)) to.push(m.to);
  return to;
}
// The full move for from -> to (the one taking the most pieces if several chains end there), or null.
export function findMove(g, from, to) {
  let best = null;
  for (const m of legalMoves(g)) if (m.from === from && m.to === to && (!best || m.caps.length > best.caps.length)) best = m;
  return best;
}
export const previewCaps = (g, from, to) => { const m = findMove(g, from, to); return m ? m.caps : []; };
// Pieces of the mover that have a leap available (shown when a capture is compulsory).
export function mustCapturePieces(g) {
  const s = new Set();
  for (const m of legalMoves(g)) if (m.caps.length) s.add(m.from);
  return s;
}

// A move the player asks for. Returns { move } or { error } with a plain-words reason (used for refused-move feedback).
export function tryMove(g, from, to) {
  const side = g.turn, b = g.board, piece = b[from];
  if (!piece || sideOf(piece) !== side) return { error: 'That is not your piece.' };
  if (from === to) return { error: 'Tap a different point.' };
  const m = findMove(g, from, to);
  if (m) return { move: m };
  const must = mustCapturePieces(g);
  if (must.size) return { error: must.has(from) ? 'You must capture. Leap an enemy piece to a free point.' : 'You must capture: a jump is available. Move one of the pieces that can leap.' };
  if (b[to] !== 0) return { error: 'That point is taken.' };
  if (!isPoint(to)) return { error: 'That is off the board.' };
  const flying = VARIANTS[g.variant].flying;
  if (!isStar(piece)) {
    const dr = rowOf(to) - rowOf(from), fwd = side === 1 ? -1 : 1;
    if (dr * fwd < 0) return { error: 'A man never steps backward. Only a crowned Star can.' };
    return { error: 'A man steps one point along a line: forward, forward diagonally, or sideways.' };
  }
  return { error: flying ? 'A Star slides along a line over free points. Something is in the way, or it is not on a line.' : 'With Gentle Stars a Star moves one point along a line.' };
}

// Plays the move on g (mutates). `m` is a full move ({from,to,path,caps}) or just {from,to}. Returns the captured points.
export function applyMove(g, m) {
  if (!m.path) { const f = findMove(g, m.from, m.to); if (f) m = f; else m = { ...m, path: [m.from, m.to], caps: [] }; }
  const side = g.turn, b = g.board, opp = 3 - side;
  let piece = b[m.from]; const wasMan = !isStar(piece);
  b[m.from] = 0;
  for (const q of m.caps) b[q] = 0;
  let crowned = false;
  if (wasMan && crownRow(side, m.to)) { piece += 2; crowned = true; }
  b[m.to] = piece;
  const n = m.caps.length;
  g.lost[opp] += n; g.moves++; g.last = { from: m.from, to: m.to, path: m.path.slice(), caps: m.caps.slice(), side, crowned };
  const forward = wasMan && rowOf(m.to) !== rowOf(m.from);
  g.quiet = n || forward || crowned ? 0 : (g.quiet || 0) + 1;
  g.turn = opp;
  if (pieceCount(g, opp) <= 0) { g.winner = side; g.reason = `${NAMES[opp]} has no pieces left.`; }
  else if (legalMoves(g, opp).length === 0) { g.winner = side; g.reason = `${NAMES[opp]} cannot move.`; }
  else {
    const k = posKey(g); g.seen[k] = (g.seen[k] || 0) + 1;
    if (g.quiet >= QUIET_LIMIT) {
      const a = materialOf(b, 1), c = materialOf(b, 2);
      if (a === c) { g.winner = 3; g.reason = '25 moves each with no capture and no forward step, and equal strength.'; }
      else { g.winner = a > c ? 1 : 2; g.reason = '25 moves each with no capture and no forward step: the stronger side wins (a man counts 1, a Star 3).'; }
    }
    else if (g.seen[k] >= 3) { g.winner = 3; g.reason = 'The same position came up three times.'; }
    else if (g.moves >= MOVE_LIMIT) { g.winner = 3; g.reason = 'Move limit reached.'; }
  }
  return m.caps;
}

// Points of `side` that the other side could leap on its very next move (danger marks / tutor).
export function endangered(g, side) {
  const out = new Set(), flying = VARIANTS[g.variant].flying;
  for (const m of generate(g.board, 3 - side, flying, true)) for (const q of m.caps) out.add(q);
  return out;
}

// One plain sentence describing a move for the tutor / hint.
export function describeMove(g, m) {
  const full = m.caps ? m : findMove(g, m.from, m.to) || m, side = g.turn, caps = full.caps || [];
  const c = clone(g); const before = endangered(c, side);
  const crowns = !isStar(g.board[m.from]) && crownRow(side, m.to);
  applyMove(c, full);
  if (c.winner === side) return 'This wins the game.';
  if (caps.length > 1) return `This leaps ${caps.length} pieces in one chain.${crowns ? ' It also crowns a Star.' : ''}`;
  if (caps.length === 1) return crowns ? 'This captures a piece and crowns a Star.' : 'This captures a piece.';
  if (crowns) return 'This crowns a man as a Star.';
  if (before.has(m.from)) return 'This moves a piece out of danger.';
  const probe = clone(c); probe.turn = side;
  if (generate(probe.board, side, VARIANTS[g.variant].flying, true).length) return 'This sets up a capture for your next move.';
  return 'A solid move that improves your position.';
}
