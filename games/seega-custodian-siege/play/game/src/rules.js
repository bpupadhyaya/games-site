// The Seega engine: 5x5 board, 12 stones each, placement two at a time into every square but the centre, then sliding
// with custodian capture. Pure and deterministic. Everything else (AI, Think, lessons, Rules pages) reads this file.
export const N = 5;
export const NN = 25;
export const CENTRE = 12;
export const PIECES = 12;
export const STALL_LIMIT = 40; // moves in a row without a capture before the game is settled on stones
export const MIN_STONES = 2;   // a side reduced to one stone has lost: a lone stone can never sandwich anything
export const END_MOVE = { from: -2, to: -2 };

export const other = (w) => 3 - w;
export const rc = (i) => [Math.floor(i / N), i % N];

export const ADJ = [];
export const RAYS = []; // RAYS[i]: [neighbour, square beyond] pairs along each orthogonal direction
for (let i = 0; i < NN; i++) {
  const [r, c] = rc(i);
  const a = [], ry = [];
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const r1 = r + dr, c1 = c + dc;
    if (r1 < 0 || r1 >= N || c1 < 0 || c1 >= N) continue;
    a.push(r1 * N + c1);
    const r2 = r + 2 * dr, c2 = c + 2 * dc;
    if (r2 >= 0 && r2 < N && c2 >= 0 && c2 < N) ry.push([r1 * N + c1, r2 * N + c2]);
  }
  ADJ.push(a); RAYS.push(ry);
}
export const isCorner = (i) => ADJ[i].length === 2;
export const isEdge = (i) => ADJ[i].length === 3;
// A stone can be sandwiched only along a line that has a square on both sides of it.
export const canBeCaptured = (i) => i !== CENTRE && !isCorner(i);

export function startState() {
  return { cells: new Array(NN).fill(0), turn: 1, phase: 'place', drops: 0, placed: [0, 0], chain: -1, quiet: 0, tn: 0, over: null, last: null };
}

// X = pebbles (side 1), O = date stones (side 2), . = empty. Used for lessons, tests and the staged screenshots.
export function parse(board, turn = 1) {
  const cells = board.replace(/[\s/]/g, '').split('').map((ch) => (ch === 'X' ? 1 : ch === 'O' ? 2 : 0));
  const placed = [cells.filter((c) => c === 1).length, cells.filter((c) => c === 2).length];
  return { cells, turn, phase: 'move', drops: 0, placed, chain: -1, quiet: 0, tn: 0, over: null, last: null };
}

export const countOf = (st, who) => { let n = 0; for (let i = 0; i < NN; i++) if (st.cells[i] === who) n++; return n; };
export const isPlacing = (st) => st.phase === 'place';

// Stones sandwiched by `who` having just arrived on `to` (cells already show the move made).
export function capturedBy(cells, to, who) {
  const foe = 3 - who;
  const out = [];
  for (const [n1, n2] of RAYS[to]) {
    if (cells[n1] === foe && n1 !== CENTRE && cells[n2] === who) out.push(n1);
  }
  return out;
}

// Would a stone of `who` sliding from `from` to `to` capture something? (`from` still holds the stone in `cells`.)
function wouldCapture(cells, from, to, who) {
  const foe = 3 - who;
  for (const [n1, n2] of RAYS[to]) {
    if (cells[n1] === foe && n1 !== CENTRE && n2 !== from && cells[n2] === who) return true;
  }
  return false;
}
const hasCapture = (cells, i, who) => {
  for (const j of ADJ[i]) if (cells[j] === 0 && wouldCapture(cells, i, j, who)) return true;
  return false;
};

export function hasMoves(cells, who) {
  for (let i = 0; i < NN; i++) if (cells[i] === who) for (const j of ADJ[i]) if (cells[j] === 0) return true;
  return false;
}

export const isEnd = (mv) => mv.from === -2;

export function legalMoves(st) {
  if (st.over) return [];
  const out = [];
  if (st.phase === 'place') {
    for (let i = 0; i < NN; i++) if (st.cells[i] === 0 && i !== CENTRE) out.push({ from: -1, to: i });
    return out;
  }
  const me = st.turn, cells = st.cells;
  if (st.chain >= 0) {
    for (const j of ADJ[st.chain]) if (cells[j] === 0 && wouldCapture(cells, st.chain, j, me)) out.push({ from: st.chain, to: j });
    out.push({ ...END_MOVE });
    return out;
  }
  for (let i = 0; i < NN; i++) if (cells[i] === me) for (const j of ADJ[i]) if (cells[j] === 0) out.push({ from: i, to: j });
  return out;
}

function finish(s, winner, why) { s.over = { winner, why }; s.chain = -1; return s; }

function settleStall(s) {
  const a = countOf(s, 1), b = countOf(s, 2);
  return finish(s, a === b ? 0 : a > b ? 1 : 2, 'stall');
}

// End of a turn: hand over, pass a blocked side, detect a locked or stalled game.
function handover(s) {
  const me = s.turn;
  s.chain = -1; s.drops = 0; s.turn = other(me); s.tn += 1;
  if (s.phase !== 'move') return s;
  if (s.quiet >= STALL_LIMIT) return settleStall(s);
  if (!hasMoves(s.cells, s.turn)) {
    if (hasMoves(s.cells, me)) { s.last = { ...(s.last ?? {}), passed: s.turn }; s.turn = me; s.tn += 1; }
    else { s.last = { ...(s.last ?? {}), locked: true }; return settleStall(s); }
  }
  return s;
}

export function applyMove(st, mv) {
  const s = { ...st, cells: st.cells.slice(), placed: st.placed.slice(), last: null };
  const me = s.turn;
  if (s.phase === 'place') {
    s.cells[mv.to] = me; s.placed[me - 1] += 1; s.drops += 1;
    s.last = { from: -1, to: mv.to, who: me, captured: [], passed: 0 };
    if (s.drops === 2) {
      s.drops = 0;
      if (s.placed[0] === PIECES && s.placed[1] === PIECES) {
        // the side that dropped the last two stones moves first
        s.phase = 'move'; s.turn = me; s.tn += 1;
        if (!hasMoves(s.cells, s.turn)) { // blocked at the very start: the other side moves again
          s.last = { ...s.last, passed: me }; s.turn = other(me); s.tn += 1;
        }
      } else { s.turn = other(me); s.tn += 1; }
    }
    return s;
  }
  if (mv.from === -2) { s.last = { from: -2, to: -2, who: me, captured: [], passed: 0, ended: true }; return handover(s); }
  s.cells[mv.to] = me; s.cells[mv.from] = 0;
  const caps = capturedBy(s.cells, mv.to, me);
  for (const c of caps) s.cells[c] = 0;
  s.last = { from: mv.from, to: mv.to, who: me, captured: caps, passed: 0 };
  if (caps.length) {
    s.quiet = 0;
    if (countOf(s, other(me)) < MIN_STONES) return finish(s, me, 'captured');
    if (hasCapture(s.cells, mv.to, me)) { s.chain = mv.to; return s; }
  } else s.quiet += 1;
  return handover(s);
}

// Most stones `who` could capture in one turn from this position (chains included), as if `who` were to move.
export function turnYield(st, who) {
  if (st.phase !== 'move') return 0;
  const s0 = { ...st, turn: who, chain: -1, over: null };
  let best = 0;
  const walk = (s, got) => {
    for (const mv of legalMoves(s)) {
      if (mv.from === -2) continue;
      const n = applyMove(s, mv);
      const cp = n.last.captured.length;
      if (!cp) continue;
      const g = got + cp;
      best = Math.max(best, g);
      if (n.chain >= 0 && n.turn === who && !n.over) walk(n, g);
    }
  };
  walk(s0, 0);
  return best;
}

// Stones of `who` that the opponent could capture next turn (before they move).
export function threatened(st, who) {
  const foe = other(who), set = new Set();
  if (st.phase !== 'move') return set;
  const walk = (s, depth) => {
    for (const mv of legalMoves(s)) {
      if (mv.from === -2) continue;
      const n = applyMove(s, mv);
      for (const c of n.last.captured) set.add(c);
      if (n.last.captured.length && n.chain >= 0 && n.turn === foe && !n.over && depth < 4) walk(n, depth + 1);
    }
  };
  walk({ ...st, turn: foe, chain: -1, over: null }, 0);
  return set;
}

export const keyOf = (st) => `${st.cells.join('')}${st.turn}${st.phase[0]}${st.drops}${st.chain}`;
export const cellName = (i) => { const [r, c] = rc(i); return `${'ABCDE'[c]}${r + 1}`; };
