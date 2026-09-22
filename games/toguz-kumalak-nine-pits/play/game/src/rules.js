// THE RULE BOOK: Toguz Kumalak ("nine pebbles"), the national mancala of Kazakhstan and Kyrgyzstan.
// Readable and authoritative: the computer's search (engine.js) calls the very same `sow` function.
//
// Pits 0..8 are the bottom player's ("you"), numbered 1..9 left to right; pits 9..17 the top player's, numbered 1..9
// from THEIR side (screen right to left). Sowing runs counter-clockwise: 0,1,...,17,0,... Every pit starts with 9 pebbles:
// 162 in all. A player's kazan is their score store. A "tuz" is one opponent pit a player has won for good: every pebble
// that later lands in it goes to its owner's kazan, so a tuz pit is always empty. Invariant: pits + both kazans = 162.
export const N = 18, HALF = 9, TOTAL = 162, WIN = 82;
export const sideOf = (pit) => (pit < HALF ? 0 : 1);
export const numberOf = (pit) => (pit % HALF) + 1;                 // the pit's number 1..9 from its owner's side
export const ownPits = (p) => (p === 0 ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [9, 10, 11, 12, 13, 14, 15, 16, 17]);

export function newGame() {
  return { pits: new Array(N).fill(9), kazan: [0, 0], tuz: [-1, -1], turn: 0, winner: null, reason: '', moves: 0, quiet: 0 };
}
export const clone = (g) => ({ ...g, pits: g.pits.slice(), kazan: g.kazan.slice(), tuz: g.tuz.slice() });
export const sideSum = (pits, p) => { let s = 0; for (let i = p * HALF; i < p * HALF + HALF; i++) s += pits[i]; return s; };
export const total = (g) => g.pits.reduce((a, b) => a + b, 0) + g.kazan[0] + g.kazan[1];

// Pits the mover may sow: any of their own pits that hold pebbles (a tuz pit is always empty).
export function legalMoves(g, pits = g.pits, turn = g.turn) {
  const out = [];
  for (let i = turn * HALF; i < turn * HALF + HALF; i++) if (pits[i] > 0) out.push(i);
  return out;
}

// Can `mover` turn opponent pit `pit` into a tuz right now (ignoring the count)? Reason string in `why` when not.
export function tuzBlock(tuz, mover, pit) {
  if (tuz[mover] >= 0) return 'has-one';                            // one tuz per player
  if (numberOf(pit) === 9) return 'ninth';                          // never the opponent's 9th pit
  if (tuz[1 - mover] >= 0 && numberOf(tuz[1 - mover]) === numberOf(pit)) return 'mirror';   // not the same number as the opponent's tuz
  return null;
}

// Low-level sow on raw state (mutates pits, kazan, tuz). The first pebble stays in the pit lifted from (a lone pebble moves on).
// Returns { last, path, hits, capture, tuzMade, gain }: path = every pit a pebble was dropped into, in order (tuz pits included);
// hits = kazan owners of pebbles that fell into a tuz along the way (parallel to path, -1 otherwise); capture = pebbles taken from the
// pit of the last pebble (0 = none); tuzMade = the pit that became the mover's tuz (-1 = none); gain = kazan increase for the mover.
export function sow(pits, kazan, tuz, turn, pit, wantPath = true) {
  const n = pits[pit], path = wantPath ? [] : null, hits = wantPath ? [] : null;
  let at = pit, drops = n;
  if (n === 1) pits[pit] = 0; else { pits[pit] = 1; drops = n - 1; }
  let gain = 0;
  for (let k = 0; k < drops; k++) {
    at = at + 1 === N ? 0 : at + 1;
    let owner = -1;
    if (at === tuz[0]) owner = 0; else if (at === tuz[1]) owner = 1;
    if (owner >= 0) { kazan[owner] += 1; if (owner === turn) gain += 1; } else pits[at] += 1;
    if (wantPath) { path.push(at); hits.push(owner); }
  }
  const last = at, res = { last, path, hits, capture: 0, tuzMade: -1, gain: 0, start: pit, n };
  if (sideOf(last) !== turn && last !== tuz[0] && last !== tuz[1]) {
    const c = pits[last];
    if (c % 2 === 0) { res.capture = c; pits[last] = 0; kazan[turn] += c; gain += c; }
    else if (c === 3) {
      const why = tuzBlock(tuz, turn, last);
      if (why === null) { res.tuzMade = last; tuz[turn] = last; pits[last] = 0; kazan[turn] += 3; gain += 3; } else res.tuzBlocked = why;
    }
  }
  res.gain = gain;
  return res;
}

// Play a legal move on the game state. Returns the sow result plus { pit, before, player, tuzBefore } for the animation.
export function applyMove(g, pit) {
  const before = g.pits.slice(), tuzBefore = g.tuz.slice(), kazanBefore = g.kazan.slice(), p = g.turn;
  const r = sow(g.pits, g.kazan, g.tuz, p, pit, true);
  g.moves += 1;
  if (r.capture > 0 || r.tuzMade >= 0) g.quiet = 0; else g.quiet += 1;
  g.turn = 1 - p;
  settle(g);
  return { ...r, pit, before, tuzBefore, kazanBefore, player: p };
}

// After every move: has anyone won, or is the game over?
export function settle(g) {
  if (g.winner !== null) return;
  const done = (why) => {
    g.kazan[0] += sideSum(g.pits, 0); g.kazan[1] += sideSum(g.pits, 1); g.pits.fill(0);
    g.winner = g.kazan[0] > g.kazan[1] ? 0 : g.kazan[1] > g.kazan[0] ? 1 : 'draw'; g.reason = why;
  };
  for (const p of [0, 1]) if (g.kazan[p] >= WIN) { g.winner = p; g.reason = `${g.kazan[p]} pebbles in the kazan: more than half of the 162.`; return; }
  if (sideSum(g.pits, g.turn) === 0) return done('The player to move had no pebbles left, so the other player takes all the pebbles on their own side.');
  if (g.quiet >= 300) return done('Nothing was captured for a very long time, so each player keeps the pebbles on their own side.');
}

// Try a pit: a legal move, or the reason in plain language.
export function tryMove(g, pit) {
  if (g.winner !== null) return { error: 'The game is over.' };
  if (sideOf(pit) !== g.turn) return { error: 'That pit belongs to your opponent. Tap one of your own pits, on the bottom row.' };
  if (pit === g.tuz[1 - g.turn]) return { error: 'That pit is your opponent’s tuz: its pebbles go to their kazan and it can never be played.' };
  if (g.pits[pit] === 0) return { error: 'That pit is empty: there are no pebbles to sow. Tap a pit that has pebbles.' };
  return { move: pit };
}

// Why a last pebble that made a pit hold three did NOT create a tuz (plain language), or ''.
export function tuzWhy(reason) {
  return reason === 'has-one' ? 'You already own a tuz, and each player may have only one.'
    : reason === 'ninth' ? 'A tuz can never be made in the 9th pit of your opponent’s row.'
    : reason === 'mirror' ? 'A tuz cannot be made in a pit with the same number as your opponent’s tuz.' : '';
}
