// The rule book: the single source of truth for what is legal and who has won. Pure and deterministic.
// Three rule sets share one engine:
//   gomoku  Free-style: 15 x 15, five OR MORE in a row wins, no restrictions.
//   renju   15 x 15, Black opens on the centre, and Black may not make an overline (6+), a double four or a double three.
//           Black wins only with EXACTLY five. White is free: five or more wins, and White also wins if Black has no
//           legal way to stop a five.
//   omok    Korean Omok: 19 x 19 (a Go board), five or more wins, Black may not make a double three.
// Board indexes run row by row: idx = y * n + x. Colours: 1 = Black (moves first), 2 = White.
export const EMPTY = 0, BLACK = 1, WHITE = 2;
export const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

export const MODES = {
  gomoku: { id: 'gomoku', n: 15, name: 'Gomoku', sub: 'Free-style, five or more', ban3: false, ban4: false, banOver: false, blackExact: false, centerFirst: false },
  renju: { id: 'renju', n: 15, name: 'Renju', sub: 'Black is restricted', ban3: true, ban4: true, banOver: true, blackExact: true, centerFirst: true },
  omok: { id: 'omok', n: 19, name: 'Omok', sub: 'Korean rules, 19 x 19', ban3: true, ban4: false, banOver: false, blackExact: false, centerFirst: false },
};
export const MODE_IDS = ['gomoku', 'renju', 'omok'];
const FOUL_TEXT = { third: 'inside the central square, which the restricted third move forbids', overline: 'an overline (six or more in a row)', 'double-four': 'a double four', 'double-three': 'a double three' };
export const foulText = (f) => FOUL_TEXT[f] ?? f;

export const other = (c) => 3 - c;
export const xyOf = (n, idx) => [idx % n, (idx / n) | 0];
export const nameOf = (n, idx) => 'ABCDEFGHJKLMNOPQRS'[idx % n] + (n - ((idx / n) | 0));    // like a Go board: columns A-S without I, rows counted from the bottom

// `opening` (Renju only): 'none' | 'restricted' (Black's second stone must be outside the central 5 x 5) | 'swap' (after the third stone the
// side that plays White may swap colours; the app asks, rules.js only knows the stones).
export const OPENINGS = ['none', 'restricted', 'swap'];
export function newGame(modeId = 'gomoku', opening = 'none') {
  const m = MODES[modeId] ?? MODES.gomoku;
  return { mode: m.id, n: m.n, cells: new Array(m.n * m.n).fill(0), moves: [], turn: BLACK, winner: 0, line: [], reason: '', foul: null, opening: m.id === 'renju' && OPENINGS.includes(opening) ? opening : 'none' };
}
// Black's second stone (third stone of the game) under the restricted-third-move opening must lie outside the 5 x 5 square on the centre.
export function inCentre5(n, idx) { const c = (n - 1) / 2, x = idx % n, y = (idx / n) | 0; return Math.abs(x - c) <= 2 && Math.abs(y - c) <= 2; }
export const restrictedThird = (g) => g.opening === 'restricted' && g.moves.length === 2 && g.turn === BLACK;
export function clone(g) { return { ...g, cells: g.cells.slice(), moves: g.moves.slice(), line: g.line.slice() }; }
export function fromMoves(modeId, moves, opening = 'none') {
  const g = newGame(modeId, opening);
  for (const m of moves) applyMove(g, m);
  return g;
}
export const centerOf = (n) => ((n - 1) / 2) * n + (n - 1) / 2;

// The cells on one line through (x, y), offsets -5..5, as colours (3 = off the board). index 5 is (x, y) itself.
function lineArr(cells, n, x, y, dx, dy, out) {
  for (let k = -5; k <= 5; k++) {
    const px = x + k * dx, py = y + k * dy;
    out[k + 5] = px < 0 || py < 0 || px >= n || py >= n ? 3 : cells[py * n + px];
  }
  return out;
}
// Consecutive Black / White stones through offset 5 of a line array (the centre must hold that colour).
function runOf(a, c) { let r = 1, k = 4; while (k >= 0 && a[k] === c) { r++; k--; } k = 6; while (k <= 10 && a[k] === c) { r++; k++; } return r; }

const winRun = (m, c, run) => (c === BLACK && m.blackExact ? run === 5 : run >= 5);

// After colour c has been placed at idx: the winning run (list of cells) or null.
export function winLine(cells, n, idx, c, m) {
  const x = idx % n, y = (idx / n) | 0, a = [];
  for (const [dx, dy] of DIRS) {
    lineArr(cells, n, x, y, dx, dy, a);
    const run = runOf(a, c);
    if (!winRun(m, c, run)) continue;
    const out = [idx]; let k = 4;
    while (k >= 0 && a[k] === c) { out.push(y * n + x + (k - 5) * (dy * n + dx)); k--; }
    k = 6; while (k <= 10 && a[k] === c) { out.push(y * n + x + (k - 5) * (dy * n + dx)); k++; }
    return out.sort((p, q) => p - q);
  }
  return null;
}

// Cells (offsets into a line array) where Black placing one more stone makes EXACTLY five, given the stone at offset 5 is Black.
// Only five-windows that contain the centre count. Returns the offsets.
function completions(a, exact) {
  const out = [];
  for (let s = 1; s <= 5; s++) {                                           // window s-1 .. s+3 ... covers offsets that include 5
    const w0 = s, w1 = s + 4;                                               // five-window w0..w1 (offsets), contains 5 when w0 <= 5 <= w1
    if (w0 > 5 || w1 < 5) continue;
    let own = 0, empty = -1, bad = false;
    for (let k = w0; k <= w1; k++) { if (a[k] === 1) own++; else if (a[k] === 0) { if (empty >= 0) bad = true; empty = k; } else bad = true; }
    if (bad || own !== 4 || empty < 0) continue;
    a[empty] = 1;
    let r = 1, k = empty - 1; while (k >= 0 && a[k] === 1) { r++; k--; } k = empty + 1; while (k <= 10 && a[k] === 1) { r++; k++; }
    a[empty] = 0;
    if (exact ? r === 5 : r >= 5) if (!out.includes(empty)) out.push(empty);
  }
  return out;
}
// How many fours a line holds (a straight four counts once; two separate completions count twice).
function fourCount(a, exact) {
  const c = completions(a, exact);
  if (c.length === 2 && Math.abs(c[0] - c[1]) === 5) return 1;
  return c.length;
}

// Is move idx (empty) forbidden for Black under mode m? Returns null or 'overline' | 'double-four' | 'double-three'.
// `depth` bounds the recursion used to decide whether a three can really become an open four.
export function foulOf(cells, n, idx, m, depth = 0) {
  if (!(m.ban3 || m.ban4 || m.banOver) || cells[idx] !== EMPTY) return null;
  const x = idx % n, y = (idx / n) | 0, exact = m.blackExact, a = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  cells[idx] = BLACK;
  try {
    let fours = 0, threes = 0, over = false;
    const lines = [];
    for (const [dx, dy] of DIRS) {
      lineArr(cells, n, x, y, dx, dy, a);
      const run = runOf(a, BLACK);
      if (winRun(m, BLACK, run)) return null;                             // making five is never a foul
      if (run >= 6) over = true;
      lines.push([dx, dy, a.slice(), run]);
    }
    if (m.banOver && over) return 'overline';
    if (!(m.ban4 || m.ban3)) return null;
    for (const [, , arr] of lines) fours += m.ban4 ? fourCount(arr.slice(), exact) : 0;
    if (m.ban4 && fours >= 2) return 'double-four';
    if (m.ban3) {
      for (const [dx, dy, arr] of lines) if (completions(arr.slice(), exact).length === 0 && openThree(cells, n, x, y, dx, dy, arr, m, depth)) threes++;
      if (threes >= 2) return 'double-three';
    }
    return null;
  } finally { cells[idx] = EMPTY; }
}

// A "three" made by the stone at (x, y) in direction (dx, dy): one more legal Black stone on this line would make an open four
// (four in a row with both ends completing to a five) that includes the stone just placed.
function openThree(cells, n, x, y, dx, dy, arr, m, depth) {
  // quick reject: at least 3 black stones within a five-window around the centre
  let ok = false;
  for (let s = 1; s <= 5 && !ok; s++) { let own = 0, opp = 0; for (let k = s; k <= s + 4; k++) { if (arr[k] === 1) own++; else if (arr[k] !== 0) opp++; } if (own >= 3 && !opp) ok = true; }
  if (!ok) return false;
  const exact = m.blackExact, b = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let k = 1; k <= 9; k++) {
    if (k === 5 || arr[k] !== 0) continue;
    const qx = x + (k - 5) * dx, qy = y + (k - 5) * dy;
    if (qx < 0 || qy < 0 || qx >= n || qy >= n) continue;
    // the new stone at offset k must not itself be a foul (otherwise the three is "dead")
    if (depth < 3 && foulOf(cells, n, qy * n + qx, m, depth + 1)) continue;
    const t = arr.slice(); t[k] = 1;
    // a straight four that includes the centre stone: 4 consecutive Black containing offset 5, with both ends completing to a five
    let lo = 5; while (lo - 1 >= 0 && t[lo - 1] === 1) lo--;
    let hi = 5; while (hi + 1 <= 10 && t[hi + 1] === 1) hi++;
    if (hi - lo + 1 !== 4) continue;
    if (lo - 1 < 0 || hi + 1 > 10 || t[lo - 1] !== 0 || t[hi + 1] !== 0) continue;
    t[lo - 1] = 1; const r1 = runOf2(t, lo - 1); t[lo - 1] = 0;
    t[hi + 1] = 1; const r2 = runOf2(t, hi + 1); t[hi + 1] = 0;
    if ((exact ? r1 === 5 : r1 >= 5) && (exact ? r2 === 5 : r2 >= 5)) return true;
  }
  return false;
}
function runOf2(a, i) { let r = 1, k = i - 1; while (k >= 0 && a[k] === 1) { r++; k--; } k = i + 1; while (k <= 10 && a[k] === 1) { r++; k++; } return r; }

// ---- legality ----------------------------------------------------------------------------------------------------------------
// { ok: true } or { ok: false, reason: 'occupied' | 'over' | 'centre' | 'overline' | 'double-four' | 'double-three' }
export function legality(g, idx) {
  const m = MODES[g.mode];
  if (g.winner) return { ok: false, reason: 'over' };
  if (idx < 0 || idx >= g.cells.length || g.cells[idx] !== EMPTY) return { ok: false, reason: 'occupied' };
  if (m.centerFirst && g.moves.length === 0 && idx !== centerOf(g.n)) return { ok: false, reason: 'centre' };
  if (restrictedThird(g) && inCentre5(g.n, idx)) return { ok: false, reason: 'third' };
  if (g.turn === BLACK) {
    const f = foulOf(g.cells, g.n, idx, m);
    if (f) return { ok: false, reason: f };
  }
  return { ok: true };
}
// Which empty points are forbidden to Black right now (Renju / Omok); [] otherwise or when it is not Black's turn.
export function forbiddenPoints(g) {
  const m = MODES[g.mode];
  if (g.winner || g.turn !== BLACK) return [];
  const out = [], n = g.n;
  if (restrictedThird(g)) { for (let i = 0; i < g.cells.length; i++) if (!g.cells[i] && inCentre5(n, i)) out.push({ idx: i, kind: 'third' }); return out; }
  if (!(m.ban3 || m.ban4 || m.banOver)) return [];
  for (let i = 0; i < g.cells.length; i++) {
    if (g.cells[i] !== EMPTY) continue;
    // cheap prefilter: a foul needs Black stones nearby
    const x = i % n, y = (i / n) | 0; let near = 0;
    for (let yy = Math.max(0, y - 4); yy <= Math.min(n - 1, y + 4) && near < 2; yy++) for (let xx = Math.max(0, x - 4); xx <= Math.min(n - 1, x + 4); xx++) if (g.cells[yy * n + xx] === BLACK && (xx === x || yy === y || Math.abs(xx - x) === Math.abs(yy - y))) near++;
    if (near < 2) continue;
    const f = foulOf(g.cells, n, i, m);
    if (f) out.push({ idx: i, kind: f });
  }
  return out;
}

// Plays idx for the side to move (assumed legal). Returns { win, draw } and fills g.winner / g.line / g.reason.
export function applyMove(g, idx) {
  const m = MODES[g.mode], c = g.turn;
  g.cells[idx] = c; g.moves.push(idx);
  const line = winLine(g.cells, g.n, idx, c, m);
  if (line) { g.winner = c; g.line = line; g.reason = 'five'; return { win: true }; }
  if (g.moves.length >= g.cells.length) { g.winner = 3; g.reason = 'draw'; return { draw: true }; }
  g.turn = other(c);
  return {};
}
// Plays the move (checks legality first). A Black foul is refused and reported; it never ends the game here (see the Rules page).
export function tryMove(g, idx) {
  const l = legality(g, idx);
  if (!l.ok) return { ok: false, reason: l.reason };
  return { ok: true, ...applyMove(g, idx) };
}
