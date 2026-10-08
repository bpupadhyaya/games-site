// THE RULE BOOK: Songo as played by the Ekang peoples of Cameroon, Gabon, Equatorial Guinea and the Congo basin. Readable and
// authoritative: the computer's search (engine.js) calls the very same `sow` function, so the two can never disagree.
//
// Houses 0..6 are the bottom player's ("you"), houses 7..13 the top player's. Sowing runs clockwise as the players see it:
// 0,1,...,13,0,... (on screen: along the bottom row right to left, then up and along the top row left to right).
// Two houses per side are special. The LEFTMOST house is a row's last in sowing order (6 for the bottom player, 13 for the top player):
// it may not be sown while it holds fewer than three seeds (see legalMoves). The FIRST house is a row's first (0 and 7): a single landing
// seed never captures it (it can still be taken inside a chain). Rule sources are listed in STATUS.md Decisions.
export const N = 14, HALF = 7, WIN = 40, TOTAL = 70, FEED = 7, MIN_BOARD = 10;
export const sideOf = (pit) => (pit < HALF ? 0 : 1);
export const ownPits = (p) => (p === 0 ? [0, 1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12, 13]);
export const isLeftmost = (pit) => pit % HALF === HALF - 1;   // a row's last house in sowing order: may not be emptied thin
export const isFirst = (pit) => pit % HALF === 0;             // a row's first house in sowing order: a single landing seed never captures it
export const CAP_MIN = 2, CAP_MAX = 4;

export function newGame() {
  return { pits: new Array(N).fill(5), store: [0, 0], turn: 0, winner: null, reason: '', moves: 0, quiet: 0, seen: {} };
}
export const clone = (g) => JSON.parse(JSON.stringify(g));
export const seedsOn = (pits, p) => { let s = 0; for (let i = p * HALF; i < p * HALF + HALF; i++) s += pits[i]; return s; };
export const key = (g) => g.pits.join(',') + '|' + g.turn;

// A sowing of `n` seeds from `pit`: the houses that receive a seed, in order. 13 or fewer seeds go to the next houses one by one.
// With 14 or more the first lap visits the other thirteen houses (the starting house is skipped); every seed after that goes only
// into the opponent's seven houses, from their first house, round and round.
function pathOf(pit, n) {
  const path = [], p = sideOf(pit);
  let at = pit;
  const lap = Math.min(n, N - 1);
  for (let k = 0; k < lap; k++) { at = (at + 1) % N; path.push(at); }
  for (let k = lap, o = 0; k < n; k++, o++) path.push((1 - p) * HALF + (o % HALF));
  return path;
}
// how many seeds of sowing `pit` land on the opponent's side
const delivered = (pits, pit) => pathOf(pit, pits[pit]).filter((i) => sideOf(i) !== sideOf(pit)).length;
export const reaches = (pits, pit) => delivered(pits, pit) > 0;

// Houses captured by sowing `pit` (last house first), worked out on a copy.
const capturedBy = (pits, turn, pit) => sow(pits.slice(), turn, pit).captured;

// Moves the mover may make (house indices).
//  1. The leftmost house may be sown only with 3+ seeds, or with exactly 2 when that move captures.
//  2. If that leaves nothing, any occupied house may be played (it is the only possible move).
//  3. Solidarity: if the opponent has no seeds, the move must put at least seven seeds on their side; if no move can, it must put as many
//     as possible (a thin leftmost house only if nothing else reaches them). If no move reaches their side at all, there is no legal move.
//  4. A lone seed in your leftmost house, with nothing else on your side, is simply banked: you have no move.
export function legalMoves(g, pits = g.pits, turn = g.turn) {
  const own = ownPits(turn), left = own[HALF - 1], mine = own.filter((i) => pits[i] > 0);
  if (mine.length === 1 && mine[0] === left && pits[left] === 1) return [];
  const base = mine.filter((i) => i !== left || pits[i] >= 3 || (pits[i] === 2 && capturedBy(pits, turn, i).length > 0));
  if (seedsOn(pits, 1 - turn) > 0) return base.length ? base : mine;
  let cand = base;
  if (!cand.some((i) => delivered(pits, i) > 0)) cand = mine;
  const d = cand.map((i) => delivered(pits, i)), mx = Math.max(0, ...d);
  if (mx === 0) return [];
  return mx >= FEED ? cand.filter((_, k) => d[k] >= FEED) : cand.filter((_, k) => d[k] === mx);
}

// Why a tapped house is not playable (plain language), or null if it is.
export function whyNot(g, pit) {
  if (g.winner !== null) return 'The game is over.';
  if (sideOf(pit) !== g.turn) return 'That house belongs to your opponent. Tap one of your own houses, on the bottom row.';
  if (g.pits[pit] === 0) return 'That house is empty: there are no seeds to sow. Tap a house that has seeds.';
  if (legalMoves(g).includes(pit)) return null;
  if (seedsOn(g.pits, 1 - g.turn) === 0) return `Your opponent has no seeds, so you must play a move that puts at least ${FEED} seeds on their side, or as many as you can. Pick a house with more seeds.`;
  if (isLeftmost(pit) && g.pits[pit] < 3) return 'Your leftmost house may not be sown with fewer than three seeds, unless two seeds capture, or it is your only move.';
  return 'That move is not allowed.';
}

// Low-level sow on raw arrays (mutates `pits`). Returns { last, gain, captured: [house...], path, slam }.
export function sow(pits, turn, pit) {
  const n = pits[pit]; pits[pit] = 0;
  const path = pathOf(pit, n);
  for (const i of path) pits[i] += 1;
  const last = path[path.length - 1], captured = [];
  let lone = false;
  if (sideOf(last) !== turn) {
    if (isFirst(last)) { if (n >= N) { captured.push(last); lone = true; } }     // a long sowing ending on their first house takes just that last seed
    else {
      // walk backwards along the opponent's houses while they hold 2, 3 or 4 (the first house can be taken inside a chain)
      let i = last;
      while (i >= 0 && sideOf(i) !== turn && pits[i] >= CAP_MIN && pits[i] <= CAP_MAX) { captured.push(i); i -= 1; }
    }
  }
  let gain = 0;
  for (const i of captured) gain += lone ? 1 : pits[i];
  const slam = !lone && captured.length > 0 && gain === seedsOn(pits, 1 - turn);
  if (slam) return { last, gain: 0, captured: [], path, slam: true, lone: false };      // grand slam: legal, but nothing is taken
  if (lone) pits[last] -= 1; else for (const i of captured) pits[i] = 0;
  return { last, gain, captured, path, slam: false, lone };
}

// Play a legal move on the game state. Returns { pit, path, last, gain, captured, slam, before, player } for the animation.
export function applyMove(g, pit) {
  const before = g.pits.slice(), p = g.turn;
  const r = sow(g.pits, p, pit);
  g.store[p] += r.gain; g.moves += 1;
  if (r.gain > 0) { g.quiet = 0; g.seen = {}; } else g.quiet += 1;
  g.turn = 1 - p;
  settle(g);
  return { ...r, pit, before, player: p };
}

// After every move: has anyone won, or is the game over? When it ends without 40, each player adds the seeds on their own side;
// 40 or more wins, otherwise the game is drawn.
export function settle(g) {
  if (g.winner !== null) return;
  const done = (why) => {
    g.store[0] += seedsOn(g.pits, 0); g.store[1] += seedsOn(g.pits, 1); g.pits.fill(0);
    g.winner = g.store[0] >= WIN ? 0 : g.store[1] >= WIN ? 1 : 'draw'; g.reason = why;
  };
  for (const p of [0, 1]) if (g.store[p] >= WIN) { g.winner = p; g.reason = `${g.store[p]} seeds captured: the game is decided.`; return; }
  if (seedsOn(g.pits, 0) + seedsOn(g.pits, 1) < MIN_BOARD) return done('Fewer than ten seeds are left on the board, so each player keeps the seeds on their own side.');
  if (legalMoves(g).length === 0) {
    const noSide = seedsOn(g.pits, g.turn) === 0;
    return done(noSide ? 'One side has no seeds left and no move can feed it, so each player keeps the seeds on their own side.' : 'No move can reach the empty side, so each player keeps the seeds on their own side.');
  }
  const k = key(g); g.seen[k] = (g.seen[k] || 0) + 1;
  if (g.seen[k] >= 3) return done('The same position came round three times, so each player keeps the seeds on their own side.');
  if (g.quiet >= 100) return done('No seeds were captured for a long time, so each player keeps the seeds on their own side.');
}

// Try a house: a legal move, or the reason in plain language.
export function tryMove(g, pit) {
  const why = whyNot(g, pit);
  return why ? { error: why } : { move: pit };
}

export const RULESETS = { songo: { id: 'songo', name: 'Songo', newGame, legalMoves, applyMove, tryMove, settle } };
