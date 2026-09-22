// THE RULE BOOK: the Royal Game of Ur, Finkel rules. Pure and deterministic; nothing here draws or rolls dice.
//
// Every piece has a position on its owner's path of 14 squares: 0 = waiting off the board, 1..14 = on the board,
// 15 = borne off. A path is 4 squares in the owner's own lane (1-4), 8 squares in the shared middle lane (5-12), then
// 2 squares back in the own lane (13-14). Rosettes: path squares 4, 8 (the central rosette, shared) and 14.
//   * Four pyramid dice; each shows 0 or 1 (a marked corner up). The roll is the sum, 0..4 (odds 1,4,6,4,1 in 16).
//   * A piece moves exactly the roll. It may not land on a piece of its own colour.
//   * Landing on a rosette gives another roll. The central rosette is safe: it cannot be entered while an enemy is on it.
//   * Landing on an enemy piece in the shared lane sends it back off the board (it starts again).
//   * A piece leaves the board only with the exact roll (from square 14 that is a 1). First to bring all 7 home wins.
//   * A roll of 0, or a roll with no legal move, passes the turn.
export const PIECES = 7, HOME = 15, ROSETTES = [4, 8, 14], CENTRAL = 8;
export const ODDS = [1, 4, 6, 4, 1];                      // sixteenths, for rolls 0..4
export const isRosette = (p) => p === 4 || p === 8 || p === 14;

export function newGame(first = 0) {
  return { pos: [Array(PIECES).fill(0), Array(PIECES).fill(0)], turn: first, roll: -1, winner: -1, moves: 0, extra: false };
}
export const clone = (g) => ({ pos: [g.pos[0].slice(), g.pos[1].slice()], turn: g.turn, roll: g.roll, winner: g.winner, moves: g.moves, extra: g.extra });

// The cell a path square occupies: lane 0 (left, side 0), 1 (shared middle), 2 (right, side 1); c 0 = near end .. 7 = far end.
export function cellOf(side, p) {
  if (p < 1 || p > 14) return null;
  const lane = p >= 5 && p <= 12 ? 1 : side === 0 ? 0 : 2;
  const c = p <= 4 ? 4 - p : p <= 12 ? p - 5 : p === 13 ? 7 : 6;
  return { lane, c, id: lane * 8 + c };
}
export const cellId = (side, p) => (p < 1 || p > 14 ? -1 : cellOf(side, p).id);
export const rollDice = (rng) => { const d = [rng.int(2), rng.int(2), rng.int(2), rng.int(2)]; return { dice: d, total: d[0] + d[1] + d[2] + d[3] }; };

// Why a piece cannot make the roll. Returns null when the move is legal.
export function whyNot(g, i, roll = g.roll, side = g.turn) {
  const mine = g.pos[side], theirs = g.pos[1 - side], from = mine[i], to = from + roll;
  if (from >= HOME) return 'That piece is already home.';
  if (to > HOME) return `To leave the board a piece needs the exact number: this one needs ${HOME - from}, and you rolled ${roll}.`;
  if (to < HOME) {
    if (mine.some((p, k) => k !== i && p === to)) return 'Blocked: one of your own pieces is already on that square.';
    if (to === CENTRAL && theirs.includes(CENTRAL)) return 'Blocked: an enemy piece sits on the central rosette, and a piece there is safe. Wait until it moves on.';
  }
  return null;
}

// All legal moves for the side to move with the current roll. Waiting pieces are interchangeable, so only one is offered.
export function legalMoves(g) {
  const out = [];
  if (g.winner >= 0 || g.roll < 1) return out;
  const mine = g.pos[g.turn], theirs = g.pos[1 - g.turn];
  let waitingSeen = false;
  for (let i = PIECES - 1; i >= 0; i--) {                       // the top of the waiting stack is the one that goes
    const from = mine[i];
    if (from === 0) { if (waitingSeen) continue; waitingSeen = true; }
    if (whyNot(g, i)) continue;
    const to = from + g.roll;
    let hit = -1;
    if (to >= 5 && to <= 12 && to !== CENTRAL) hit = theirs.findIndex((q) => q >= 5 && q <= 12 && q === to);
    out.push({ i, from, to, hit, rosette: to < HOME && isRosette(to), off: to === HOME });
  }
  return out;
}

// Play a legal move. Sets the next roller: the same side again on a rosette, otherwise the other side.
export function applyMove(g, m) {
  g.pos[g.turn][m.i] = m.to;
  if (m.hit >= 0) g.pos[1 - g.turn][m.hit] = 0;
  g.moves += 1; g.roll = -1;
  if (g.pos[g.turn].every((p) => p === HOME)) { g.winner = g.turn; return g; }
  g.extra = m.rosette;
  if (!m.rosette) g.turn = 1 - g.turn;
  return g;
}
// A roll that gives no move (or 0): the turn passes.
export function pass(g) { g.roll = -1; g.extra = false; g.turn = 1 - g.turn; return g; }
export const progress = (g, side) => g.pos[side].reduce((a, p) => a + p, 0);
export const homeCount = (g, side) => g.pos[side].filter((p) => p === HOME).length;
export const waitingCount = (g, side) => g.pos[side].filter((p) => p === 0).length;
