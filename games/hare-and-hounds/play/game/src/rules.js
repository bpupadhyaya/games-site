// Hare and Hounds: the complete rules, pure and deterministic. See design/GDD.md.
// Eleven points. Points 1..9 are a grid of three columns ("rows" of travel, AX 1..3) by three lanes (LAT 0..2);
// point 0 is the hounds' end (AX 0) and point 10 the hare's end (AX 4), both in the middle lane. A point's index is
// 1 + 3 * (AX - 1) + LAT for the grid. Lines join orthogonal neighbours; diagonals run only through the points
// where AX + LAT is odd (the two ends, the four corners of the grid and its centre).
// Pieces: '' empty, 'H' the hare, 'D' a hound. Hounds may never move back toward their own end (AX gets smaller).
export const AX = [0], LAT = [1];
for (let a = 1; a <= 3; a++) for (let l = 0; l < 3; l++) { AX.push(a); LAT.push(l); }
AX.push(4); LAT.push(1);
export const N = 11, HARE_HOME = 10, HOUND_HOME = [0, 1, 3], DEFAULT_LIMIT = 20;

export const STEPS = AX.map(() => []);
const at = {}; AX.forEach((a, i) => { at[a + ',' + LAT[i]] = i; });
AX.forEach((a, i) => {
  const l = LAT[i], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if ((a + l) % 2 === 1) dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
  for (const [da, dl] of dirs) { const j = at[(a + da) + ',' + (l + dl)]; if (j !== undefined) STEPS[i].push(j); }
});
export const HOUND_STEPS = STEPS.map((st, i) => st.filter((j) => AX[j] >= AX[i]));

// hounds move first. `limit` = how many hound moves the hounds have to trap the hare (the hunt clock).
export function newGame(limit = DEFAULT_LIMIT) {
  const board = Array(N).fill('');
  for (const i of HOUND_HOME) board[i] = 'D';
  board[HARE_HOME] = 'H';
  return { board, turn: 'D', winner: null, reason: '', moves: 0, hm: 0, limit };
}
export const clone = (s) => ({ ...s, board: s.board.slice() });
export const hareAt = (s) => s.board.indexOf('H');
export const houndsAt = (s) => { const o = []; for (let i = 0; i < N; i++) if (s.board[i] === 'D') o.push(i); return o; };
// the hare is past when it stands nearer the hounds' end than every hound: they can never catch it
export const isPast = (s) => { const h = AX[hareAt(s)]; return houndsAt(s).every((i) => AX[i] > h); };

export function legalMoves(s) {
  const out = [];
  if (s.winner) return out;
  const me = s.turn === 'D' ? 'D' : 'H';
  for (let i = 0; i < N; i++) if (s.board[i] === me) for (const n of (me === 'D' ? HOUND_STEPS : STEPS)[i]) if (!s.board[n]) out.push({ from: i, to: n });
  return out;
}

export const key = (s) => s.board.map((c) => c || '.').join('') + s.turn;

// Apply a legal move (mutates s) and decide whether the game has ended.
export function applyMove(s, m) {
  s.board[m.to] = s.board[m.from]; s.board[m.from] = '';
  s.moves += 1;
  const mover = s.turn; s.turn = mover === 'D' ? 'H' : 'D';
  if (mover === 'D') s.hm += 1;
  if (isPast(s)) { s.winner = 'H'; s.reason = 'The hare slipped past the hounds.'; return s; }
  if (legalMoves(s).length === 0) {
    if (s.turn === 'H') { s.winner = 'D'; s.reason = 'The hare is trapped.'; } else { s.winner = 'H'; s.reason = 'The hounds have no move left.'; }
    return s;
  }
  if (mover === 'D' && s.hm >= s.limit) { s.winner = 'H'; s.reason = 'The hounds ran out of moves.'; }
  return s;
}

// The move a player means by "this piece to that point", or a plain-language reason why it is not allowed.
export function tryMove(s, from, to) {
  const me = s.board[from], there = s.board[to];
  if (there === 'H') return { error: me === 'H' ? 'That is where the hare already is.' : 'The hounds never capture. They win by boxing the hare in until it cannot move.' };
  if (there === 'D') return { error: 'A hound is standing there.' };
  if (STEPS[from].includes(to)) {
    if (me === 'D' && AX[to] < AX[from]) return { error: 'Hounds can never move backward, toward their own end. They only go forward or sideways.' };
    return { move: { from, to } };
  }
  const near = Math.abs(AX[from] - AX[to]) <= 1 && Math.abs(LAT[from] - LAT[to]) <= 1;
  if (near) return { error: 'No line joins those two points. Move along the drawn lines.' };
  return { error: me === 'H' ? 'Too far. The hare moves one step along a line.' : 'Too far. A hound moves one step along a line.' };
}

// The points the hare could step to next (drawn as a warning for the hounds when hints are on).
export function hareReach(s) { const h = hareAt(s); return STEPS[h].filter((j) => !s.board[j]); }
