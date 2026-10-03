// The Latrunculi engine: 8x8 board, 15 soldiers and a dux per side, rook-style slides, custodian capture, the dux lost by
// enclosure. Pure and deterministic. Everything else (AI, Think, lessons, Rules pages) reads this file.
//
// Pieces in `cells`: 0 empty, 1 Ivory soldier, 2 Jet soldier, 3 Ivory dux, 4 Jet dux. Sides: 1 = Ivory (moves first), 2 = Jet.
export const N = 8;
export const NN = 64;
export const SOLDIERS = 15;
export const QUIET_LIMIT = 50; // plies in a row without a capture before the game is settled on pieces
export const SIDE = [0, 1, 2, 1, 2];
export const DUX = { 1: 3, 2: 4 };
export const SOLDIER = { 1: 1, 2: 2 };

export const other = (w) => 3 - w;
export const rc = (i) => [Math.floor(i / N), i % N];
export const isDux = (c) => c === 3 || c === 4;

// DIRS in index steps; STEPS[i] is the four rays from square i (each ray: the squares in order until the edge).
const DR = [[0, 1], [0, -1], [1, 0], [-1, 0]];
export const RAYS = [];
export const ADJ = [];
for (let i = 0; i < NN; i++) {
  const [r, c] = rc(i);
  const rays = [], adj = [];
  for (const [dr, dc] of DR) {
    const ray = [];
    let r1 = r + dr, c1 = c + dc;
    while (r1 >= 0 && r1 < N && c1 >= 0 && c1 < N) { ray.push(r1 * N + c1); r1 += dr; c1 += dc; }
    rays.push(ray);
    if (ray.length) adj.push(ray[0]);
  }
  RAYS.push(rays); ADJ.push(adj);
}
export const isCorner = (i) => ADJ[i].length === 2;
export const isEdge = (i) => ADJ[i].length === 3;
export const CORNERS = [0, 7, 56, 63];

export function startCells() {
  const cells = new Array(NN).fill(0);
  for (let c = 0; c < N; c++) {
    cells[0 * N + c] = 2; cells[1 * N + c] = 2;
    cells[6 * N + c] = 1; cells[7 * N + c] = 1;
  }
  cells[7 * N + 3] = 3;
  cells[0 * N + 4] = 4;
  return cells;
}
export function startState() {
  return { cells: startCells(), turn: 1, quiet: 0, tn: 0, over: null, last: null };
}

// X = Ivory soldier, x = Ivory dux, O = Jet soldier, o = Jet dux, . = empty. For lessons, tests and staged screenshots.
const CH = { '.': 0, X: 1, O: 2, x: 3, o: 4 };
export function parse(board, turn = 1) {
  const cells = board.replace(/[\s/]/g, '').split('').map((ch) => CH[ch] ?? 0);
  return { cells, turn, quiet: 0, tn: 0, over: null, last: null };
}
export const countOf = (cells, who) => { let n = 0; for (let i = 0; i < NN; i++) if (SIDE[cells[i]] === who) n++; return n; };
export const soldiersOf = (cells, who) => { let n = 0; for (let i = 0; i < NN; i++) if (cells[i] === SOLDIER[who]) n++; return n; };
export const duxAt = (cells, who) => cells.indexOf(DUX[who]);

// Enemy soldiers sandwiched by `who` having just arrived on `to` (cells already show the move made).
export function capturedBy(cells, to, who) {
  const foe = 3 - who, fs = SOLDIER[foe];
  const out = [];
  const rays = RAYS[to];
  for (let d = 0; d < 4; d++) {
    const ray = rays[d];
    if (!ray.length) continue;
    const n1 = ray[0];
    if (cells[n1] !== fs) continue;
    if (ray.length > 1) {
      if (SIDE[cells[ray[1]]] === who) out.push(n1);
    } else if (isCorner(n1)) {
      // a soldier in a corner is taken by the two squares beside it
      const o = ADJ[n1][0] === to ? ADJ[n1][1] : ADJ[n1][0];
      if (SIDE[cells[o]] === who) out.push(n1);
    }
  }
  return out;
}

// Is the dux of `who` enclosed: every square beside it is off the board or held by the other side?
export function duxEnclosed(cells, who) {
  const p = cells.indexOf(DUX[who]);
  if (p < 0) return false;
  for (const j of ADJ[p]) if (SIDE[cells[j]] !== 3 - who) return false;
  return true;
}

export function hasMoves(cells, who) {
  for (let i = 0; i < NN; i++) {
    if (SIDE[cells[i]] !== who) continue;
    for (const j of ADJ[i]) if (cells[j] === 0) return true;
  }
  return false;
}

export function legalMoves(st) {
  if (st.over) return [];
  const out = [], me = st.turn, cells = st.cells;
  for (let i = 0; i < NN; i++) {
    if (SIDE[cells[i]] !== me) continue;
    for (const ray of RAYS[i]) {
      for (let k = 0; k < ray.length; k++) { const j = ray[k]; if (cells[j] !== 0) break; out.push({ from: i, to: j }); }
    }
  }
  return out;
}
export const movesFrom = (st, i) => {
  const out = [];
  if (st.over || SIDE[st.cells[i]] !== st.turn) return out;
  for (const ray of RAYS[i]) for (let k = 0; k < ray.length; k++) { const j = ray[k]; if (st.cells[j] !== 0) break; out.push({ from: i, to: j }); }
  return out;
};

function finish(s, winner, why) { s.over = { winner, why }; return s; }
// Moves open to `who` if it were `who`'s turn (the "room" count used to settle a drawn-out game).
export function roomOf(cells, who) {
  let n = 0;
  for (let i = 0; i < NN; i++) {
    if (SIDE[cells[i]] !== who) continue;
    for (const ray of RAYS[i]) for (let k = 0; k < ray.length; k++) { if (cells[ray[k]] !== 0) break; n++; }
  }
  return n;
}
// 50 quiet plies: more pieces wins; equal pieces go to the side with more room (open moves); only equal on both is a draw.
function settleStall(s) {
  const a = countOf(s.cells, 1), b = countOf(s.cells, 2);
  if (a !== b) return finish(s, a > b ? 1 : 2, 'stall');
  const ra = roomOf(s.cells, 1), rb = roomOf(s.cells, 2);
  const f = finish(s, ra === rb ? 0 : ra > rb ? 1 : 2, 'stall');
  f.over.by = 'room';
  return f;
}

// How good is this move at once? Counts the soldiers it would sandwich (9 for enclosing the dux) without building a new state.
export function quickGain(cells, mv, me) {
  const piece = cells[mv.from];
  cells[mv.to] = piece; cells[mv.from] = 0;
  let n = capturedBy(cells, mv.to, me).length;
  const foe = 3 - me, dp = cells.indexOf(DUX[foe]);
  if (dp >= 0 && ADJ[dp].includes(mv.to) && duxEnclosed(cells, foe)) n = 9;
  cells[mv.from] = piece; cells[mv.to] = 0;
  return n;
}

export function applyMove(st, mv) {
  const s = { cells: st.cells.slice(), turn: st.turn, quiet: st.quiet, tn: st.tn + 1, over: null, last: null };
  const me = st.turn, foe = other(me);
  const piece = s.cells[mv.from];
  s.cells[mv.to] = piece; s.cells[mv.from] = 0;
  const caps = capturedBy(s.cells, mv.to, me);
  for (const c of caps) s.cells[c] = 0;
  s.last = { from: mv.from, to: mv.to, who: me, piece, captured: caps, duxTaken: false };
  s.quiet = caps.length ? 0 : st.quiet + 1;
  s.turn = foe;
  // the enemy dux is lost when this move closes the last open side around it
  const dp = s.cells.indexOf(DUX[foe]);
  if (dp >= 0 && ADJ[dp].includes(mv.to) && duxEnclosed(s.cells, foe)) { s.last.duxTaken = true; s.last.duxAt = dp; return finish(s, me, 'dux'); }
  // an army reduced to its dux alone can never sandwich anything: it has lost
  if (caps.length && soldiersOf(s.cells, foe) === 0) return finish(s, me, 'soldiers');
  if (!hasMoves(s.cells, foe)) return finish(s, me, 'blocked');
  if (s.quiet >= QUIET_LIMIT) return settleStall(s);
  return s;
}

// Pieces of `who` that the opponent could capture (soldiers by sandwich, the dux by enclosure) on their next move,
// as if they were to move. Returns { soldiers: Set(squares), dux: boolean }.
export function threats(st, who) {
  const foe = other(who), soldiers = new Set();
  let dux = false;
  const s0 = { ...st, turn: foe, over: null };
  for (const mv of legalMoves(s0)) {
    const n = applyMove(s0, mv);
    for (const c of n.last.captured) soldiers.add(c);
    if (n.last.duxTaken) dux = true;
  }
  return { soldiers, dux };
}

// Most soldiers `who` could capture with one move right now (a win by enclosure counts as 99).
export function bestYield(st, who) {
  const s0 = { ...st, turn: who, over: null };
  let best = 0;
  for (const mv of legalMoves(s0)) {
    const n = applyMove(s0, mv);
    const v = n.last.duxTaken ? 99 : n.last.captured.length;
    if (v > best) best = v;
  }
  return best;
}

export const keyOf = (st) => `${st.cells.join('')}${st.turn}`;
export const cellName = (i) => { const [r, c] = rc(i); return `${'abcdefgh'[c]}${N - r}`; };
