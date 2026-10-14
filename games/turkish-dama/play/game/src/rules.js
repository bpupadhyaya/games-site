// Turkish Dama rules: the single source of truth for what is legal and what a move does. Pure and deterministic.
// Squares are numbered 0..63, row by row from the TOP-left. Side 1 = Ivory (bottom, moves first, men move up the board),
// side 2 = Ruby (top, men move down). winner: 0 playing, 1, 2, or 3 = draw.
// Pieces: 0 empty, 1 / 2 = man of side 1 / 2, 3 / 4 = king of side 1 / 2.
export const N = 8, SZ = 64, START = 16;
export const VARIANTS = {
  standard: { name: 'Standard', long: 'Standard Turkish Dama', blurb: 'The traditional game: a capture is compulsory and you must take the most pieces you can.' },
  easy: { name: 'Easy capture', long: 'Easy-capture Turkish Dama', blurb: 'A capture is still compulsory, but you may choose any capture route, not only the longest.' },
};
export const VARIANT_KEYS = ['standard', 'easy'];
export const QUIET_LIMIT = 80;          // plies (40 moves each) with no capture and no forward man move: a draw
export const MOVE_LIMIT = 400;          // plies (200 moves each): a draw
export const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];   // up, down, left, right
export const NAMES = ['', 'Ivory', 'Ruby'];
export const rowOf = (i) => i >> 3;
export const colOf = (i) => i & 7;
export const sideOf = (p) => (p === 0 ? 0 : ((p - 1) & 1) + 1);
export const isKing = (p) => p >= 3;
export const fwd = (side) => (side === 1 ? -1 : 1);          // row step of a man's forward direction
export const promoRow = (side) => (side === 1 ? 0 : 7);

export function newGame(variant = 'standard') {
  const board = new Array(SZ).fill(0);
  for (let c = 0; c < 8; c++) { board[5 * 8 + c] = 1; board[6 * 8 + c] = 1; board[1 * 8 + c] = 2; board[2 * 8 + c] = 2; }
  const g = { variant, board, turn: 1, moves: 0, lost: [0, 0, 0], winner: 0, reason: '', seen: {}, last: null, quiet: 0 };
  g.seen[posKey(g)] = 1;
  return g;
}
export const clone = (g) => ({ ...g, board: g.board.slice(), lost: g.lost.slice(), seen: { ...g.seen }, last: g.last ? { ...g.last, caps: g.last.caps.slice(), path: g.last.path.slice() } : null });
export const posKey = (g) => g.board.join('') + g.turn;
export const countOf = (b, side) => { let n = 0; for (let i = 0; i < SZ; i++) if (sideOf(b[i]) === side) n++; return n; };
export const pieceCount = (g, side) => START - g.lost[side];

// ---- move generation ---------------------------------------------------------------------------------------------------------
// A move is { from, path: [landing squares, one per captured piece, or one square for a plain step], caps: [captured squares], to }.
// A captured piece stays on the board until the whole move is finished (it cannot be jumped twice and it blocks the way).
function captureSeqs(b, from, out) {
  const p = b[from], side = sideOf(p), king = isKing(p), opp = 3 - side, fr = fwd(side);
  const taken = new Uint8Array(SZ), path = [], caps = [];
  b[from] = 0;                                                          // the moving piece has left its square (a king may fly back across it)
  const dirs = king ? [0, 1, 2, 3] : DIRS[0][0] === fr ? [0, 2, 3] : [1, 2, 3];
  const walk = (pos) => {
    let any = false;
    const r = rowOf(pos), c = colOf(pos);
    for (const d of dirs) {
      const dr = DIRS[d][0], dc = DIRS[d][1];
      let rr = r + dr, cc = c + dc;
      if (king) while (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc] === 0) { rr += dr; cc += dc; }
      if (!(rr >= 0 && rr < N && cc >= 0 && cc < N)) continue;
      const q = rr * N + cc;
      if (sideOf(b[q]) !== opp || taken[q]) continue;
      let lr = rr + dr, lc = cc + dc;
      while (lr >= 0 && lr < N && lc >= 0 && lc < N && b[lr * N + lc] === 0) {
        any = true;
        const l = lr * N + lc;
        taken[q] = 1; path.push(l); caps.push(q);
        const deeper = walk(l);
        if (!deeper) out.push({ from, path: path.slice(), caps: caps.slice(), to: l });
        path.pop(); caps.pop(); taken[q] = 0;
        if (!king) break;
        lr += dr; lc += dc;
      }
    }
    return any;
  };
  walk(from);
  b[from] = p;
}
function stepMoves(b, from, out) {
  const p = b[from], side = sideOf(p), king = isKing(p), fr = fwd(side), r = rowOf(from), c = colOf(from);
  for (let d = 0; d < 4; d++) {
    const dr = DIRS[d][0], dc = DIRS[d][1];
    if (!king && dr === -fr) continue;                                  // men never step backwards
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc] === 0) {
      const to = rr * N + cc; out.push({ from, path: [to], caps: [], to });
      if (!king) break;
      rr += dr; cc += dc;
    }
  }
}
// Every legal move for `side`. Captures are compulsory; in the Standard rule set only the longest capture sequences are legal.
export function generate(b, side, variant = 'standard') {
  const caps = [];
  for (let i = 0; i < SZ; i++) if (sideOf(b[i]) === side) captureSeqs(b, i, caps);
  if (caps.length) {
    if (variant !== 'standard') return caps;
    let mx = 0; for (const m of caps) if (m.caps.length > mx) mx = m.caps.length;
    return caps.filter((m) => m.caps.length === mx);
  }
  const out = [];
  for (let i = 0; i < SZ; i++) if (sideOf(b[i]) === side) stepMoves(b, i, out);
  return out;
}
export const legalMoves = (g, side = g.turn) => generate(g.board, side, g.variant);
export const legalFrom = (g, i) => (sideOf(g.board[i]) === g.turn ? legalMoves(g).filter((m) => m.from === i) : []);
export const mustCapture = (g, side = g.turn) => { const m = legalMoves(g, side); return m.length > 0 && m[0].caps.length > 0; };

// Does this move end with a man crowned?
export const promotes = (b, m) => { const p = b[m.from]; return !isKing(p) && rowOf(m.to) === promoRow(sideOf(p)); };

// Moves from `sel` that continue the squares already chosen (`prefix`). Returns the distinct next squares with the capture count of the move.
export function nextSteps(moves, sel, prefix) {
  const seen = new Map();
  for (const m of moves) {
    if (m.from !== sel || m.path.length <= prefix.length) continue;
    let ok = true; for (let k = 0; k < prefix.length; k++) if (m.path[k] !== prefix[k]) { ok = false; break; }
    if (!ok) continue;
    const sq = m.path[prefix.length], e = seen.get(sq);
    if (!e) seen.set(sq, { to: sq, caps: m.caps.length, final: m.path.length === prefix.length + 1, over: m.caps[prefix.length] ?? -1 });
    else if (m.path.length === prefix.length + 1) e.final = true;
  }
  return [...seen.values()];
}
export const findMove = (moves, sel, path) => moves.find((m) => m.from === sel && m.path.length === path.length && m.path.every((s, k) => s === path[k])) || null;

// A move the player asks for that is not in the legal list: a plain-words reason (refused-move feedback).
export function whyNot(g, from, to) {
  const b = g.board, side = g.turn, p = b[from];
  if (sideOf(p) !== side) return 'That is not your piece.';
  if (b[to] !== 0) return 'That square is already taken.';
  if (mustCapture(g)) {
    const legal = legalFrom(g, from);
    if (!legal.length) return 'You must capture, and this piece cannot. Tap a piece that can jump.';
    return g.variant === 'standard' ? 'You must capture, and take the most pieces you can.' : 'You must capture. Tap a glowing square.';
  }
  const dr = rowOf(to) - rowOf(from), dc = colOf(to) - colOf(from);
  if (dr !== 0 && dc !== 0) return 'Pieces move along a row or a column. No diagonals.';
  if (!isKing(p)) {
    if (dr === -fwd(side)) return 'A man never moves backwards. Only a king can.';
    return 'A man steps one square forward or sideways.';
  }
  return 'Another piece is in the way.';
}

// Plays the move on g (mutates). Returns the captured squares. Sets winner/reason when the game ends.
export function applyMove(g, m) {
  const side = g.turn, b = g.board, opp = 3 - side, wasMan = !isKing(b[m.from]);
  const crown = promotes(b, m);
  const piece = crown ? side + 2 : b[m.from];
  b[m.from] = 0;
  for (const q of m.caps) b[q] = 0;
  b[m.to] = piece;
  g.lost[opp] += m.caps.length; g.moves++;
  g.last = { from: m.from, to: m.to, path: m.path.slice(), caps: m.caps.slice(), side, crown };
  const forwardMan = wasMan && rowOf(m.to) !== rowOf(m.from) ;
  g.quiet = m.caps.length || forwardMan ? 0 : (g.quiet || 0) + 1;
  g.turn = opp;
  if (countOf(b, opp) === 0) { g.winner = side; g.reason = 'Every piece was captured.'; return m.caps; }
  if (legalMoves(g, opp).length === 0) { g.winner = side; g.reason = `${NAMES[opp]} has no move left.`; return m.caps; }
  const k = posKey(g); g.seen[k] = (g.seen[k] || 0) + 1;
  if (g.seen[k] >= 3) { g.winner = 3; g.reason = 'The same position came up three times.'; }
  else if (g.quiet >= QUIET_LIMIT) { g.winner = 3; g.reason = '40 moves each with no capture and no man moving forward.'; }
  else if (g.moves >= MOVE_LIMIT) { g.winner = 3; g.reason = 'Move limit reached.'; }
  return m.caps;
}

// Squares of `side` that the other side could capture with its very next move (danger marks / tutor).
export function endangered(g, side) {
  const out = new Set();
  for (const m of generate(g.board, 3 - side, g.variant)) for (const q of m.caps) out.add(q);
  // in the Standard rules only the longest capture is forced, but any capture is a danger worth showing
  if (g.variant === 'standard') {
    const caps = [];
    for (let i = 0; i < SZ; i++) if (sideOf(g.board[i]) === 3 - side) captureSeqs(g.board, i, caps);
    for (const m of caps) for (const q of m.caps) out.add(q);
  }
  return out;
}

// One plain sentence describing a move for the tutor / hint.
export function describeMove(g, m) {
  const side = g.turn;
  if (m.caps.length) return m.caps.length === 1 ? 'This captures a piece.' : `This captures ${m.caps.length} pieces in one move.`;
  const before = endangered(g, side);
  const c = clone(g); const crown = promotes(g.board, m);
  applyMove(c, m);
  if (c.winner === side) return 'This wins the game.';
  if (crown) return 'This crowns a man: it becomes a king.';
  if (before.has(m.from)) return 'This moves a piece out of danger.';
  const probe = clone(c); probe.turn = side;
  if (legalMoves(probe, side).some((mv) => mv.caps.length)) return 'This sets up a capture for your next move.';
  return 'A solid move that improves your position.';
}
