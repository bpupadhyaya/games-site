// Daldøs: the whole rule book as pure functions on plain data. Nothing here draws or reads the clock; randomness only comes from `rng`.
//
// The boat board is 3 rows of 8 points. The bottom row is Red's own, the top row is Blue's own, and the middle row is shared.
// Every spatula walks the same 16-point road: out along its OWN row (steps 1-8), turns over at the far end, and comes home along the SHARED
// middle row (steps 9-16) against the other side's traffic. Step 0 is the harbour (not yet launched), step 17 is home (finished).
//
//   Red   own row: left -> right (columns 0..7)      middle row: right -> left (column 7 .. 0)
//   Blue  own row: right -> left (columns 7..0)      middle row: left -> right (column 0 .. 7)
//
// One throw of the four-sided stick (1 to 4) moves one spatula that many points. Landing on a single rival spatula in the middle row
// captures it (it goes back to its harbour, face up again). Two spatulas of one side on a point are a pair: safe, and nobody else may land.
// A throw of 4 earns another throw.

export const COLS = 8, TRACK = 16, HOME = 17;
export const NAMES = ['Red', 'Blue'];
export const OUT_END = 8;          // last step of the own row; stepping past it turns the spatula over
export const SIDES = [4, 6, 8];

export function newGame(count = 4) {
  const n = SIDES.includes(count) ? count : 4;
  return {
    n, pieces: [new Array(n).fill(0), new Array(n).fill(0)], turn: 0, roll: 0, phase: 'roll', winner: -1, reason: '',
    moves: 0, rolls: 0, lost: [0, 0], taken: [0, 0], extra: false, last: null, passed: false, quiet: 0,
  };
}
export const clone = (g) => ({ ...g, pieces: [g.pieces[0].slice(), g.pieces[1].slice()], lost: g.lost.slice(), taken: g.taken.slice(), last: g.last ? { ...g.last } : null });

// ---- geometry (rows: 0 top, 1 middle, 2 bottom; columns 0..7 left to right, before any screen flip)
export function spot(side, step) {
  if (step < 1 || step > TRACK) return null;
  if (step <= OUT_END) return { row: side === 0 ? 2 : 0, col: side === 0 ? step - 1 : COLS - step };
  return { row: 1, col: side === 0 ? TRACK - step : step - OUT_END - 1 };
}
// The step a side must be on to stand on middle column `col`.
export const midStep = (side, col) => (side === 0 ? TRACK - col : col + OUT_END + 1);
export const isMid = (step) => step > OUT_END && step <= TRACK;
export const turned = (step) => step > OUT_END;

export function count(g, side, step) { let k = 0; for (const p of g.pieces[side]) if (p === step) k++; return k; }
export const homeCount = (g, side) => count(g, side, HOME);
export const waiting = (g, side) => count(g, side, 0);
export const afloat = (g, side) => g.n - homeCount(g, side) - waiting(g, side);
export const rivalStepOnSameCell = (step, side) => 25 - step;    // 9..16 <-> 16..9

// ---- what may a throw `v` do?
// Returns the target of a spatula standing on `from` (or null when it is blocked): { to, cap, turn, home }.
export function target(g, side, from, v) {
  if (from >= HOME) return null;
  const to = Math.min(HOME, from + v);
  if (to === HOME) return { to, cap: false, turn: false, home: true };
  const own = count(g, side, to);
  if (own >= 2) return null;                                   // never three on a point
  let cap = false;
  if (isMid(to)) {
    const r = count(g, 1 - side, rivalStepOnSameCell(to, side));
    if (r >= 2) return null;                                    // a pair is a wall
    if (r === 1) cap = true;
  }
  return { to, cap, turn: from <= OUT_END && to > OUT_END, home: false };
}

export function legalMoves(g, side = g.turn, v = g.roll) {
  if (g.winner >= 0 || v < 1) return [];
  const out = [], seen = new Set();
  g.pieces[side].forEach((from, i) => {
    if (from >= HOME || seen.has(from)) return;
    seen.add(from);
    const t = target(g, side, from, v);
    if (t) out.push({ side, piece: i, from, to: t.to, cap: t.cap, turn: t.turn, home: t.home, enter: from === 0, v });
  });
  return out;
}

export function rollStick(g, rng) {
  if (g.phase !== 'roll' || g.winner >= 0) return false;
  g.roll = rng.int(4) + 1; g.rolls += 1; g.passed = false;
  g.phase = 'move';
  if (!legalMoves(g).length) { g.passed = true; endTurn(g, true); return false; }
  return true;
}

function endTurn(g, passed = false) {
  const again = !passed && g.roll === 4;
  g.extra = again;
  if (!again) g.turn = 1 - g.turn;
  g.phase = 'roll';
  g.lastRoll = g.roll; g.roll = 0;
}

// Plays a legal move (an object from legalMoves). Returns { cap, turn, home }.
export function applyMove(g, m) {
  const side = m.side ?? g.turn, arr = g.pieces[side];
  let i = m.piece;
  if (arr[i] !== m.from) i = arr.indexOf(m.from);
  const res = { cap: false, turn: false, home: false, to: m.to };
  arr[i] = m.to;
  if (m.cap && isMid(m.to)) {
    const rs = rivalStepOnSameCell(m.to, side), ri = g.pieces[1 - side].indexOf(rs);
    if (ri >= 0) { g.pieces[1 - side][ri] = 0; g.lost[1 - side] += 1; g.taken[side] += 1; res.cap = true; }
  }
  res.turn = m.turn; res.home = m.to === HOME;
  g.moves += 1; g.quiet = res.cap || res.home ? 0 : g.quiet + 1;
  g.last = { side, from: m.from, to: m.to, cap: res.cap, v: m.v };
  if (homeCount(g, side) === g.n) { g.winner = side; g.reason = `${NAMES[side]} has brought every spatula home.`; g.phase = 'over'; g.lastRoll = g.roll; g.roll = 0; return res; }
  endTurn(g);
  return res;
}

export function describeMove(g, m) {
  const who = NAMES[m.side ?? g.turn];
  if (m.enter) return `Launch a spatula onto point ${m.to}.`;
  if (m.home) return `Bring a spatula home.`;
  const parts = [`Move the spatula on point ${m.from} forward ${m.v}`];
  if (m.cap) parts.push('and capture the rival');
  else if (m.turn) parts.push('and turn it over');
  void who;
  return parts.join(' ') + '.';
}

// Share of the road covered, 0..1 per side (for the progress bars).
export function progress(g, side) { let s = 0; for (const p of g.pieces[side]) s += p; return s / (g.n * HOME); }
