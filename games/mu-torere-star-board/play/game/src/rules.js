// Mū Tōrere: THE RULE BOOK. Nine points: the eight points of the star (0..7 around the rim) and the
// centre pit, the putahi (8). Sides: 1 = Shell (pale stones, moves first), 2 = Greenstone.
// A stone moves one step to an EMPTY point: along the rim to a neighbouring point, from the rim into the
// putahi (only when the stone stands beside an enemy stone), or from the putahi out to any point of the rim.
// The player who cannot move loses. Same position three times = draw.
export const C = 8;
export const SIDE_NAME = { 1: 'Shell', 2: 'Greenstone' };
export const other = (t) => 3 - t;
export const ringNext = (i) => (i + 1) % 8;
export const ringPrev = (i) => (i + 7) % 8;
export const key = (b, t) => b.join('') + t;

export function newGame() {
  const g = { board: [1, 1, 1, 1, 2, 2, 2, 2, 0], turn: 1, winner: 0, moves: 0, seen: {}, last: null };
  g.seen[key(g.board, 1)] = 1;
  return g;
}
export const clone = (g) => ({ ...g, board: g.board.slice(), seen: { ...g.seen }, last: g.last ? { ...g.last } : null });

export function legalMoves(b, t) {
  const o = other(t), out = [];
  for (let i = 0; i < 9; i++) {
    if (b[i] !== t) continue;
    if (i === C) { for (let j = 0; j < 8; j++) if (!b[j]) out.push({ from: C, to: j }); continue; }
    for (const j of [ringNext(i), ringPrev(i)]) if (!b[j]) out.push({ from: i, to: j });
    if (!b[C] && (b[ringNext(i)] === o || b[ringPrev(i)] === o)) out.push({ from: i, to: C });
  }
  return out;
}
export const besideEnemy = (b, i, t) => i < 8 && (b[ringNext(i)] === other(t) || b[ringPrev(i)] === other(t));

// A legal move, or a plain-language reason it is not allowed.
export function tryMove(g, from, to) {
  const b = g.board, t = g.turn;
  if (b[from] !== t) return { error: 'That is not one of your stones.' };
  if (b[to]) return { error: b[to] === t ? 'Another of your stones is already there.' : 'An enemy stone is already there. Stones only move to an empty point.' };
  if (to === C) {
    if (from === C) return { error: 'Already there.' };
    if (!besideEnemy(b, from, t)) return { error: 'A stone may enter the putahi (the centre) only when it stands beside an enemy stone. This one has no enemy next to it.' };
    return { move: { from, to } };
  }
  if (from === C) return { move: { from, to } };
  if (to === ringNext(from) || to === ringPrev(from)) return { move: { from, to } };
  return { error: 'A stone moves one step only: to the next point around the star, or in or out of the putahi.' };
}

export function applyMove(g, m) {
  const t = g.turn;
  g.board[m.to] = t; g.board[m.from] = 0; g.last = { from: m.from, to: m.to, side: t };
  g.turn = other(t); g.moves += 1;
  const k = key(g.board, g.turn); g.seen[k] = (g.seen[k] || 0) + 1;
  if (!legalMoves(g.board, g.turn).length) g.winner = t;
  else if (g.seen[k] >= 3) g.winner = 3;
  return g;
}
