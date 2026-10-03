// Pure rules of Gabata as played here: a three-row board, six holes across, three seeds in every hole.
// Hole id = row * 6 + col. Row 0 is the top row, row 1 the middle row, row 2 the bottom row; col 0 is the left.
// Player 1 (bottom) owns the whole bottom row and the right three holes of the middle row; Player 2 (top) owns the whole top
// row and the left three holes of the middle row. Each player sows round their own nine holes, counter-clockwise as they see it.
// No randomness, no clock: same input, same result.
export const COLS = 6;
export const N = 18;
export const START_SEEDS = 3;
export const MAX_PLIES = 300;
const MAX_LAPS = 150;

const id = (r, c) => r * COLS + c;
export const rowOf = (i) => Math.floor(i / COLS);
export const colOf = (i) => i % COLS;

// The sowing circuit of each player, in order.
export const CIRCUIT = {
  1: [id(2, 0), id(2, 1), id(2, 2), id(2, 3), id(2, 4), id(2, 5), id(1, 5), id(1, 4), id(1, 3)],
  2: [id(0, 5), id(0, 4), id(0, 3), id(0, 2), id(0, 1), id(0, 0), id(1, 0), id(1, 1), id(1, 2)],
};
export const OWN = { 1: new Set(CIRCUIT[1]), 2: new Set(CIRCUIT[2]) };
export const ownerOf = (i) => (OWN[1].has(i) ? 1 : 2);
export const other = (p) => 3 - p;
// position of each hole inside its owner's circuit
export const POS = new Array(N);
for (const p of [1, 2]) CIRCUIT[p].forEach((h, k) => { POS[h] = k; });
// The column of a hole holds up to three holes; the ones that belong to the other player are what a capture takes.
export const columnOf = (c) => [id(0, c), id(1, c), id(2, c)];

export function startState() {
  return { cells: Array(N).fill(START_SEEDS), pd: [0, 0], turn: 1, plies: 0, over: null };
}
export const cloneState = (s) => ({ cells: s.cells.slice(), pd: s.pd.slice(), turn: s.turn, plies: s.plies, over: s.over });

export const sideCount = (s, p) => CIRCUIT[p].reduce((a, h) => a + s.cells[h], 0);
// Score = seeds captured + seeds still in your own holes.
export const scoreOf = (s, p) => s.pd[p - 1] + sideCount(s, p);
export const capturedOf = (s, p) => s.pd[p - 1];

export function legalMoves(s) {
  if (s.over) return [];
  const out = [];
  for (const h of CIRCUIT[s.turn]) if (s.cells[h] > 0) out.push({ cell: h });
  return out;
}
export const sameMove = (a, b) => a && b && a.cell === b.cell;

// The holes a seed landing in `hole` (mover p) would take: the other player's holes in that column that hold seeds.
export function takeable(s, p, hole) {
  return columnOf(colOf(hole)).filter((h) => ownerOf(h) !== p && s.cells[h] > 0);
}

// Plays one whole turn. Returns { st, ev }. ev (when `log` is true) lists what happens, for the animation:
//   pick {cell,n,who}   drop {cell,left}   capture {cells, n, at, who}   end {over}
export function play(st, mv, log = false) {
  const s = cloneState(st);
  const ev = log ? [] : null;
  const p = s.turn, circ = CIRCUIT[p];
  let pos = mv.cell, n = s.cells[pos];
  s.cells[pos] = 0;
  if (ev) ev.push({ t: 'pick', cell: pos, n, who: p });
  let laps = 0;
  for (;;) {
    let k = POS[pos];
    while (n > 0) {
      k = (k + 1) % 9; pos = circ[k]; s.cells[pos]++; n--;
      if (ev) ev.push({ t: 'drop', cell: pos, left: n });
    }
    if (s.cells[pos] > 1) {
      // the last seed fell in a hole that already held seeds: pick them all up and carry on
      if (++laps > MAX_LAPS) break;
      n = s.cells[pos]; s.cells[pos] = 0;
      if (ev) ev.push({ t: 'pick', cell: pos, n, who: p });
      continue;
    }
    // the last seed fell in an empty hole of yours: it captures the other player's seeds in that column
    const tk = takeable(s, p, pos);
    if (tk.length) {
      let got = 0;
      for (const h of tk) { got += s.cells[h]; s.cells[h] = 0; }
      s.pd[p - 1] += got;
      if (ev) ev.push({ t: 'capture', cells: tk, n: got, at: pos, who: p });
    }
    break;
  }
  s.plies += 1;
  s.turn = other(p);
  if (sideCount(s, s.turn) === 0 || sideCount(s, p) === 0 || s.plies >= MAX_PLIES) finish(s, ev);
  return { st: s, ev };
}

function finish(s, ev) {
  const a = scoreOf(s, 1), b = scoreOf(s, 2);
  const stuck = sideCount(s, s.turn) === 0 ? s.turn : sideCount(s, other(s.turn)) === 0 ? other(s.turn) : 0;
  s.over = { winner: a > b ? 1 : b > a ? 2 : 0, a, b, capped: !stuck, stuck };
  // at the end every player keeps the seeds still in their own holes
  for (const p of [1, 2]) { s.pd[p - 1] += sideCount(s, p); for (const h of CIRCUIT[p]) s.cells[h] = 0; }
  if (ev) ev.push({ t: 'end', over: s.over });
}

export const keyOf = (s) => `${s.cells.join(',')}|${s.turn}|${s.pd.join(',')}`;

// Plain facts about what one move does (used by the hint and by the lessons).
export function outcome(st, mv) {
  const me = st.turn, { st: after, ev } = play(st, mv, true);
  let got = 0, sown = 0, laps = 0;
  for (const e of ev) { if (e.t === 'capture') got += e.n; else if (e.t === 'drop') sown++; else if (e.t === 'pick') laps++; }
  const gain = scoreOf(after, me) - scoreOf(st, me);
  const swing = (scoreOf(after, me) - scoreOf(after, other(me))) - (scoreOf(st, me) - scoreOf(st, other(me)));
  return { after, ev, gain, got, sown, laps, swing };
}
