// THE RULE BOOK: Oware (Abapa) as played in Ghana and West Africa. Readable and authoritative: the computer's search
// (engine.js) calls the very same `sow` function, so the two can never disagree.
//
// Pits 0..5 are the bottom player's ("you"), left to right; pits 6..11 the top player's, right to left. Sowing runs
// counter-clockwise: 0,1,...,11,0,... The game is data-driven by a ruleset object so other mancala games (Ayo, Bao,
// Congklak) can be added later as further entries in RULESETS with the same five functions.
export const N = 12, HALF = 6, WIN = 25;
export const sideOf = (pit) => (pit < HALF ? 0 : 1);
export const ownPits = (p) => (p === 0 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11]);

export function newGame() {
  return { pits: new Array(N).fill(4), store: [0, 0], turn: 0, winner: null, reason: '', moves: 0, quiet: 0, seen: {} };
}
export const clone = (g) => JSON.parse(JSON.stringify(g));
export const seedsOn = (pits, p) => { let s = 0; for (let i = p * HALF; i < p * HALF + HALF; i++) s += pits[i]; return s; };
export const key = (g) => g.pits.join(',') + '|' + g.turn;

// Moves the mover may make (pit indices). Applies the must-feed rule.
export function legalMoves(g, pits = g.pits, turn = g.turn) {
  const mine = ownPits(turn).filter((i) => pits[i] > 0);
  if (seedsOn(pits, 1 - turn) > 0) return mine;
  return mine.filter((i) => reaches(pits, i));   // opponent is empty: only moves that give seeds
}
// true when some seed of sowing `pit` lands on the other side
function reaches(pits, pit) {
  const n = pits[pit], p = sideOf(pit);
  if (n >= N) return true;
  for (let k = 1, at = pit; k <= n; k++) { at = (at + 1) % N; if (at === pit) { k--; continue; } if (sideOf(at) !== p) return true; }
  return false;
}

// Low-level sow on raw arrays (mutates `pits`). Returns { last, gain, captured: [pit...], slam }.
export function sow(pits, turn, pit) {
  let n = pits[pit], at = pit; pits[pit] = 0;
  const path = [];
  while (n > 0) { at = (at + 1) % N; if (at === pit) continue; pits[at] += 1; path.push(at); n--; }
  const last = at, captured = [];
  if (sideOf(last) !== turn) {
    // walk backwards while the pit is on the opponent side and holds 2 or 3
    let i = last;
    while (sideOf(i) !== turn && (pits[i] === 2 || pits[i] === 3)) { captured.push(i); i = (i + N - 1) % N; }
  }
  let gain = 0;
  for (const i of captured) gain += pits[i];
  const slam = captured.length > 0 && gain === seedsOn(pits, 1 - turn);
  if (slam) return { last, gain: 0, captured: [], slam: true, path };   // grand slam: legal, but nothing is taken
  for (const i of captured) pits[i] = 0;
  return { last, gain, captured, slam: false, path };
}

// Play a legal move on the game state. Returns { pit, path, last, gain, captured, slam, before } for the animation.
export function applyMove(g, pit) {
  const before = g.pits.slice(), p = g.turn;
  const r = sow(g.pits, p, pit);
  g.store[p] += r.gain; g.moves += 1;
  if (r.gain > 0) { g.quiet = 0; g.seen = {}; } else g.quiet += 1;
  g.turn = 1 - p;
  settle(g);
  return { ...r, pit, before, player: p };
}

// After every move: has anyone won, or is the game over?
export function settle(g) {
  if (g.winner !== null) return;
  const done = (why) => {
    g.store[0] += seedsOn(g.pits, 0); g.store[1] += seedsOn(g.pits, 1); g.pits.fill(0);
    g.winner = g.store[0] > g.store[1] ? 0 : g.store[1] > g.store[0] ? 1 : 'draw'; g.reason = why;
  };
  for (const p of [0, 1]) if (g.store[p] >= WIN) { g.winner = p; g.reason = `${g.store[p]} seeds captured: the game is decided.`; return; }
  if (legalMoves(g).length === 0) {
    const noSide = seedsOn(g.pits, g.turn) === 0;
    return done(noSide ? 'One side has no seeds left, so each player keeps the seeds on their own side.' : 'The seeds cannot reach the empty side, so each player keeps the seeds on their own side.');
  }
  const k = key(g); g.seen[k] = (g.seen[k] || 0) + 1;
  if (g.seen[k] >= 3) return done('The same position came round three times, so each player keeps the seeds on their own side.');
  if (g.quiet >= 100) return done('No seeds were captured for a long time, so each player keeps the seeds on their own side.');
}

// Try a pit: a legal move, or the reason in plain language.
export function tryMove(g, pit) {
  if (g.winner !== null) return { error: 'The game is over.' };
  if (sideOf(pit) !== g.turn) return { error: 'That pit belongs to your opponent. Tap one of your own pits, on the bottom row.' };
  if (g.pits[pit] === 0) return { error: 'That pit is empty: there are no seeds to sow. Tap a pit that has seeds.' };
  if (!legalMoves(g).includes(pit)) return { error: 'Your opponent has no seeds, so you must play a move that gives them some. Pick a pit with enough seeds to reach the top row.' };
  return { move: pit };
}

export const RULESETS = { oware: { id: 'oware', name: 'Oware', newGame, legalMoves, applyMove, tryMove, settle } };
