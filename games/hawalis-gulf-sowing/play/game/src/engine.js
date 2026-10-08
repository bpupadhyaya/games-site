// Pure rules of Hawalis as played in Oman: a board of four rows of seven holes, two seeds in every hole.
// Hole id = row * 7 + col. Row 0 is the top row, row 3 the bottom row; col 0 is the left.
// Player 1 (bottom) owns rows 2 and 3: row 3 is the OUTER row (nearest the player), row 2 the INNER row (the middle of the board).
// Player 2 (top) owns rows 0 and 1: row 0 is the outer row, row 1 the inner row. Each player sows round their own fourteen holes,
// counter-clockwise as they see it. A capture can only be made from an inner-row hole, from the opponent's facing inner hole and
// the outer hole behind it. Captured seeds leave the game. No randomness, no clock: same input, same result.
export const COLS = 7;
export const ROWS = 4;
export const N = 28;
export const LOOP = 14;
export const START_SEEDS = 2;
export const MAX_PLIES = 300;
const MAX_LAPS = 400;

const id = (r, c) => r * COLS + c;
export const rowOf = (i) => Math.floor(i / COLS);
export const colOf = (i) => i % COLS;

// The sowing circuit of each player, in order: the outer row one way, then the inner row back.
export const CIRCUIT = { 1: [], 2: [] };
for (let c = 0; c < COLS; c++) CIRCUIT[1].push(id(3, c));
for (let c = COLS - 1; c >= 0; c--) CIRCUIT[1].push(id(2, c));
for (let c = COLS - 1; c >= 0; c--) CIRCUIT[2].push(id(0, c));
for (let c = 0; c < COLS; c++) CIRCUIT[2].push(id(1, c));
export const OWN = { 1: new Set(CIRCUIT[1]), 2: new Set(CIRCUIT[2]) };
export const ownerOf = (i) => (OWN[1].has(i) ? 1 : 2);
export const other = (p) => 3 - p;
export const isInner = (i) => { const r = rowOf(i); return r === 1 || r === 2; };
// position of each hole inside its owner's circuit
export const POS = new Array(N);
for (const p of [1, 2]) CIRCUIT[p].forEach((h, k) => { POS[h] = k; });
// For a landing in inner hole i of player p: the facing hole in the opponent's inner row, and the opponent's outer hole behind it.
export const facing = (p, i) => id(p === 1 ? 1 : 2, colOf(i));
export const behind = (p, i) => id(p === 1 ? 0 : 3, colOf(i));

export function startState() {
  return { cells: Array(N).fill(START_SEEDS), pd: [0, 0], turn: 1, plies: 0, over: null };
}
export const cloneState = (s) => ({ cells: s.cells.slice(), pd: s.pd.slice(), turn: s.turn, plies: s.plies, over: s.over });

export const sideCount = (s, p) => CIRCUIT[p].reduce((a, h) => a + s.cells[h], 0);
// Score = seeds captured. Captured seeds leave the board, so the player ahead on captures is exactly the player with more seeds left.
export const scoreOf = (s, p) => s.pd[p - 1];
export const capturedOf = (s, p) => s.pd[p - 1];

// A turn must start from a hole with at least two seeds when the player has one; only when every hole holds a single seed may a single be played.
export function legalMoves(s) {
  if (s.over) return [];
  const circ = CIRCUIT[s.turn], out = [];
  for (const h of circ) if (s.cells[h] > 1) out.push({ cell: h });
  if (out.length) return out;
  for (const h of circ) if (s.cells[h] > 0) out.push({ cell: h });
  return out;
}
export const sameMove = (a, b) => a && b && a.cell === b.cell;

// The holes a last seed landing in `hole` (mover p) captures: the facing inner hole when it holds seeds, and, only then, the outer hole behind it when that holds seeds.
export function takeable(s, p, hole) {
  if (!isInner(hole) || ownerOf(hole) !== p) return [];
  const f = facing(p, hole), b = behind(p, hole), out = [];
  if (s.cells[f] > 0) { out.push(f); if (s.cells[b] > 0) out.push(b); }
  return out;
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
    let k = POS[pos], wasFull = false;
    while (n > 0) {
      k = (k + 1) % LOOP; pos = circ[k]; wasFull = s.cells[pos] > 0; s.cells[pos]++; n--;
      if (ev) ev.push({ t: 'drop', cell: pos, left: n });
    }
    // the last seed fell in an inner-row hole of yours and the facing hole holds seeds: capture (it ends the turn)
    const tk = takeable(s, p, pos);
    if (tk.length) {
      let got = 0;
      for (const h of tk) { got += s.cells[h]; s.cells[h] = 0; }
      s.pd[p - 1] += got;
      if (ev) ev.push({ t: 'capture', cells: tk, n: got, at: pos, who: p });
      break;
    }
    if (wasFull) {
      // the last seed fell in a hole that already held seeds: pick them all up and carry on
      if (++laps > MAX_LAPS) break;
      n = s.cells[pos]; s.cells[pos] = 0;
      if (ev) ev.push({ t: 'pick', cell: pos, n, who: p });
      continue;
    }
    break;
  }
  s.plies += 1;
  s.turn = other(p);
  if (sideCount(s, s.turn) === 0 || sideCount(s, p) === 0 || s.plies >= MAX_PLIES) finish(s, ev);
  return { st: s, ev };
}

function finish(s, ev) {
  const a = s.pd[0], b = s.pd[1];
  const stuck = sideCount(s, s.turn) === 0 ? s.turn : sideCount(s, other(s.turn)) === 0 ? other(s.turn) : 0;
  s.over = { winner: a > b ? 1 : b > a ? 2 : 0, a, b, capped: !stuck, stuck };
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
