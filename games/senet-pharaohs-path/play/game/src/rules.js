// Senet rule book: the rules as reconstructed by modern scholars (Kendall's widely published version, one simplification:
// a piece never moves backward, a turn with no move simply passes). See design/GDD.md. THIS FILE IS THE TRUTH; ai.js reuses it.
// Squares are indexed 0..29 (square number = index + 1). board[i] is 0 (empty), 1 (player one, cones) or 2 (player two, reels).
// Nothing here draws or uses time; randomness comes from the rng passed in.
export const SAFE = [14, 25, 27, 28];             // squares 15, 26, 28, 29: a piece standing there cannot be swapped
export const REBIRTH = 14, HAPPY = 25, WATER = 26;
export const CHANCE = [0, 4 / 16, 6 / 16, 4 / 16, 1 / 16, 1 / 16];   // P(throw = n) for four two-sided sticks (none light = 5)
export const EXTRA = (n) => n === 1 || n === 4 || n === 5;
export const PIECES = 5, MAX_THROWS = 1500;

export function newGame() {
  const board = new Array(30).fill(0);
  for (let i = 0; i < 10; i++) board[i] = i % 2 === 0 ? 1 : 2;
  return { board, off: [0, 0], turn: 1, n: 0, extra: false, winner: null, throws: 0, moves: 0, reason: '' };
}
export const clone = (g) => ({ ...g, board: g.board.slice(), off: g.off.slice() });
export const other = (p) => 3 - p;

// Four sticks, each light or dark side up. Returns the faces (true = light) and the number 1..5.
export function throwSticks(rng) {
  const faces = [rng.chance(0.5), rng.chance(0.5), rng.chance(0.5), rng.chance(0.5)];
  const light = faces.filter(Boolean).length;
  return { faces, n: light === 0 ? 5 : light };
}
// Faces that show a given number (used by lessons that fix the throw).
export const facesFor = (n) => [0, 1, 2, 3].map((i) => i < (n === 5 ? 0 : n));

function runAt(board, i) {                         // length of the run of same-side pieces that contains square i
  const p = board[i]; if (!p) return 0;
  let a = i, b = i; while (a > 0 && board[a - 1] === p) a--; while (b < 29 && board[b + 1] === p) b++;
  return b - a + 1;
}
export const isProtected = (board, i) => SAFE.includes(i) || (i > 0 && board[i - 1] === board[i]) || (i < 29 && board[i + 1] === board[i]);
const sq = (i) => i + 1;

// Why piece at f cannot move n squares, or null if it can. Reasons are plain sentences the player sees.
export function whyNot(g, f, n, who = g.turn) {
  const b = g.board, d = f + n, foe = other(who);
  if (d > 30 || (d === 30 && f < 25)) return f >= 25 ? `From square ${sq(f)} a piece leaves the board only with exactly ${30 - f}.` : 'That throw goes past the end of the board.';
  if (f < HAPPY && d > HAPPY) return 'Every piece must stop on the House of Happiness (square 26). This throw would carry it past.';
  if (d === 30) return null;
  for (let k = f + 1; k <= d; k++) if (b[k] === foe && runAt(b, k) >= 3) {
    let a = k; while (a > 0 && b[a - 1] === foe) a--; let e = k; while (e < 29 && b[e + 1] === foe) e++;
    return `Three or more enemy pieces in a row (squares ${sq(a)} to ${sq(e)}) form a wall. Nothing can pass or land on it.`;
  }
  if (b[d] === who) return `Your own piece is already on square ${sq(d)}.`;
  if (b[d] === foe) {
    if (SAFE.includes(d)) return `Square ${sq(d)} is a safe house. A piece standing there cannot be swapped.`;
    if (isProtected(b, d)) return `The piece on square ${sq(d)} has a friend right beside it. Pieces side by side are protected from swaps.`;
  }
  return null;
}

// Every legal move for the player to move with throw n. A move: { from, to (final resting square, -1 = leaves), dest (square landed on),
// swap (square of the enemy piece that goes back, or -1), water (true if it lands in the House of Water), off }.
export function legalMoves(g, n = g.n, who = g.turn) {
  const out = [], b = g.board;
  for (let f = 0; f < 30; f++) {
    if (b[f] !== who || whyNot(g, f, n, who)) continue;
    const d = f + n;
    if (d === 30) { out.push({ from: f, to: -1, dest: 30, swap: -1, water: false, off: true }); continue; }
    if (d === WATER) { out.push({ from: f, to: waterSquare(b, f), dest: d, swap: -1, water: true, off: false }); continue; }
    out.push({ from: f, to: d, dest: d, swap: b[d] ? d : -1, water: false, off: false });
  }
  return out;
}
// Where a piece that fell into the water is set down: square 15, or the first empty square before it.
function waterSquare(b, f) { for (let j = REBIRTH; j >= 0; j--) if (b[j] === 0 || j === f) return j; return f; }

// Apply a move for the player to move; sets up the next throw / turn. Returns the move.
export function applyMove(g, m) {
  const b = g.board, who = g.turn;
  b[m.from] = 0;
  if (m.off) g.off[who - 1] += 1;
  else { if (m.swap >= 0) b[m.from] = other(who); b[m.to] = who; }   // swap: the enemy piece takes the square this piece left
  g.moves += 1;
  if (g.off[who - 1] >= PIECES) { g.winner = who; g.reason = 'All five pieces have left the board.'; }
  return endThrow(g);
}
// The throw is used up (moved, or no move possible): an extra throw for 1, 4, 5, otherwise the other player.
export function endThrow(g) {
  const keep = EXTRA(g.n);
  g.extra = keep && g.winner === null; g.n = 0; g.throws += 1;
  if (g.winner === null) {
    if (!keep) g.turn = other(g.turn);
    if (g.throws >= MAX_THROWS) { g.winner = g.off[0] >= g.off[1] ? 1 : 2; g.reason = 'The throw limit was reached.'; }
  }
  return g;
}
export const pass = endThrow;

// Simple readable descriptions used in hints and the daily puzzle.
export function describe(g, m) {
  const b = g.board, who = g.turn, after = clone(g); const nb = after.board;
  const feats = [];
  if (m.off) return 'It brings a piece home, off the board.';
  if (m.water) return 'It falls into the House of Water and goes back.';
  if (m.swap >= 0) feats.push(`swaps the enemy piece on square ${m.dest + 1} back to square ${m.from + 1}`);
  nb[m.from] = m.swap >= 0 ? other(who) : 0; nb[m.to] = who;
  if (m.to === HAPPY) feats.push('reaches the House of Happiness, ready to leave with a 5');
  else if (m.to === REBIRTH) feats.push('lands on the safe House of Rebirth');
  else if (SAFE.includes(m.to)) feats.push('lands on a safe house');
  if (runAt(nb, m.to) >= 3 && runAt(b, m.from) < 3) feats.push('builds a wall of three that the enemy cannot pass');
  else if (isProtected(nb, m.to) && !SAFE.includes(m.to)) feats.push('lands beside a friend, so it cannot be swapped');
  else if (!isProtected(nb, m.to) && !SAFE.includes(m.to)) feats.push('lands alone, where it could be swapped back');
  return feats.length ? 'It ' + feats.join(' and ') + '.' : 'It moves a piece forward.';
}
