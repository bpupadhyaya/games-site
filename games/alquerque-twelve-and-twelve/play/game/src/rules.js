// The Alquerque engine: 5x5 points joined by lines, 12 pieces each. Pure and deterministic. Everything else (AI, Think, lessons,
// Rules pages, drawing) reads this file. Points are numbered 0..24, index = row * 5 + col, row 0 at the top of the board.
// Side 1 (Light) starts on the bottom rows and moves first; side 2 (Dark) starts on the top rows. The centre point (12) starts empty.
//
// Lines: every row and column is a line. The diagonals pass only through the points where row + col is even (13 of the 25 points).
// A step goes one point along a line to an empty point, FORWARD or SIDEWAYS only (never backward). A capture jumps over an
// adjacent enemy along a line to the empty point directly beyond and may go in ANY direction. Capturing is compulsory, and a piece
// that has captured must keep capturing while it can (it chooses which way). A side with no legal move, or no pieces, loses. After 40 plies in a row without a capture the side with more pieces wins (equal: a draw).
export const N = 5;
export const NN = 25;
export const CENTRE = 12;
export const PIECES = 12;
export const QUIET_LIMIT = 40; // plies in a row without a capture before the game is settled on pieces (more pieces wins, equal is a draw)

export const other = (w) => 3 - w;
export const rc = (i) => [Math.floor(i / N), i % N];
export const pt = (r, c) => r * N + c;

// DIRS: every direction along a line from each point: { to, over, dr, dc } where `over` is the adjacent point and `to` the one beyond (or -1).
export const LINES = []; // LINES[i] = [{ n: neighbour, j: point beyond or -1, dr, dc }]
for (let i = 0; i < NN; i++) {
  const [r, c] = rc(i);
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      if (dr && dc && (r + c) % 2) continue; // diagonals only from the even points
      const r1 = r + dr, c1 = c + dc;
      if (r1 < 0 || r1 >= N || c1 < 0 || c1 >= N) continue;
      const r2 = r + 2 * dr, c2 = c + 2 * dc;
      out.push({ n: pt(r1, c1), j: r2 >= 0 && r2 < N && c2 >= 0 && c2 < N ? pt(r2, c2) : -1, dr, dc });
    }
  }
  LINES.push(out);
}
export const hasDiagonals = (i) => { const [r, c] = rc(i); return (r + c) % 2 === 0; };
// every drawn segment between neighbouring points, once (for the board art)
export const SEGMENTS = [];
for (let i = 0; i < NN; i++) for (const d of LINES[i]) if (d.n > i) SEGMENTS.push([i, d.n, Boolean(d.dr && d.dc)]);
export const forwardOf = (who) => (who === 1 ? -1 : 1); // row direction of forward

export function startState() {
  const cells = new Array(NN).fill(0);
  for (let i = 0; i < NN; i++) {
    const [r, c] = rc(i);
    if (r >= 3) cells[i] = 1; else if (r <= 1) cells[i] = 2;
    else if (r === 2 && c >= 3) cells[i] = 1; else if (r === 2 && c <= 1) cells[i] = 2;
  }
  return { cells, turn: 1, chain: -1, quiet: 0, tn: 0, over: null, last: null };
}

// X = Light (side 1), O = Dark (side 2), . = empty. Used for lessons, tests and staged screenshots.
export function parse(board, turn = 1) {
  const cells = board.replace(/[\s/]/g, '').split('').map((ch) => (ch === 'X' ? 1 : ch === 'O' ? 2 : 0));
  return { cells, turn, chain: -1, quiet: 0, tn: 0, over: null, last: null };
}
export const countOf = (st, who) => { let n = 0; for (let i = 0; i < NN; i++) if (st.cells[i] === who) n++; return n; };

const jumpsFrom = (cells, i, who, out) => {
  for (const d of LINES[i]) if (d.j >= 0 && cells[d.n] === other(who) && cells[d.j] === 0) out.push({ from: i, to: d.j, cap: d.n });
  return out;
};
const stepsFrom = (cells, i, who, out) => {
  const f = forwardOf(who);
  for (const d of LINES[i]) if (cells[d.n] === 0 && (d.dr === f || d.dr === 0)) out.push({ from: i, to: d.n, cap: -1 });
  return out;
};

// All legal single moves ({ from, to, cap }: cap is the captured point or -1). A capture is compulsory; mid-chain only the
// chaining piece may move.
export function legalMoves(st) {
  if (st.over) return [];
  const me = st.turn, cells = st.cells, out = [];
  if (st.chain >= 0) return jumpsFrom(cells, st.chain, me, out);
  for (let i = 0; i < NN; i++) if (cells[i] === me) jumpsFrom(cells, i, me, out);
  if (out.length) return out;
  for (let i = 0; i < NN; i++) if (cells[i] === me) stepsFrom(cells, i, me, out);
  return out;
}
export const mustCapture = (st) => { const m = legalMoves(st); return m.length > 0 && m[0].cap >= 0; };

function finish(s, winner, why) { s.over = { winner, why }; s.chain = -1; return s; }

function handover(s) {
  s.chain = -1; s.turn = other(s.turn); s.tn += 1;
  if (s.quiet >= QUIET_LIMIT) { const a = countOf(s, 1), b = countOf(s, 2); return finish(s, a === b ? 0 : a > b ? 1 : 2, 'limit'); }
  if (!legalMoves(s).length) return finish(s, other(s.turn), 'blocked');
  return s;
}

export function applyMove(st, mv) {
  const s = { ...st, cells: st.cells.slice(), last: null };
  const me = s.turn;
  s.cells[mv.to] = me; s.cells[mv.from] = 0;
  if (mv.cap >= 0) {
    s.cells[mv.cap] = 0; s.quiet = 0;
    s.last = { from: mv.from, to: mv.to, who: me, cap: mv.cap };
    if (countOf(s, other(me)) === 0) return finish(s, me, 'captured');
    if (jumpsFrom(s.cells, mv.to, me, []).length) { s.chain = mv.to; return s; }
  } else { s.quiet += 1; s.last = { from: mv.from, to: mv.to, who: me, cap: -1 }; }
  return handover(s);
}

// Pieces of `who` that the other side could capture on its next turn (every capture of every possible chain), as if it were to move.
export function threatened(st, who) {
  const foe = other(who), set = new Set();
  const walk = (cells, from, depth) => {
    for (const mv of jumpsFrom(cells, from, foe, [])) {
      set.add(mv.cap);
      if (depth < 12) { const c2 = cells.slice(); c2[mv.to] = foe; c2[mv.from] = 0; c2[mv.cap] = 0; walk(c2, mv.to, depth + 1); }
    }
  };
  for (let i = 0; i < NN; i++) if (st.cells[i] === foe) walk(st.cells, i, 0);
  return set;
}
// The largest number of pieces `who` could take in one turn from this position (chains included), as if `who` were to move.
export function turnYield(st, who) {
  const foe = other(who);
  let best = 0;
  const walk = (cells, from, got, depth) => {
    for (const mv of jumpsFrom(cells, from, who, [])) {
      const g = got + 1;
      if (g > best) best = g;
      if (depth < 12) { const c2 = cells.slice(); c2[mv.to] = who; c2[mv.from] = 0; c2[mv.cap] = 0; walk(c2, mv.to, g, depth + 1); }
    }
  };
  void foe;
  for (let i = 0; i < NN; i++) if (st.cells[i] === who) walk(st.cells, i, 0, 0);
  return best;
}

export const keyOf = (st) => `${st.cells.join('')}${st.turn}${st.chain}`;
export const pointName = (i) => { const [r, c] = rc(i); return `${'ABCDE'[c]}${5 - r}`; };
