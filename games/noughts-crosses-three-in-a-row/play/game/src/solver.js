// Perfect-play solvers. Scores are from the point of view of the player to move:
//   +(100 - d)  a win that the mover can force in d more plies (fewer plies = bigger score)
//   -(100 - d)  a loss the opponent can force in d more plies
//   0           a draw with best play
// Quad (4x4) reports plain +50 / 0 / -50 because its search proves win/draw/loss only.
import { SPECS, legalMoves, applyMove, result, keyOf, startState, parse } from './rules.js';

const WIN = 100;

// ---------------------------------------------------------------------------------------------- 3x3 placing modes
const memo = { classic: new Map(), misere: new Map() };

function scoreTerminal(st, r) { return r.winner === 0 ? 0 : r.winner === st.turn ? WIN : -WIN; }
const lift = (t) => (t > 0 ? t - 1 : t < 0 ? t + 1 : 0); // a child's value seen one ply earlier

function solvePlacing(st) {
  const r = result(st);
  if (r) return scoreTerminal(st, r);
  const m = memo[st.mode], k = keyOf(st);
  if (m.has(k)) return m.get(k);
  let best = -1e9;
  for (const mv of legalMoves(st)) {
    const t = lift(-solvePlacing(applyMove(st, mv)));
    if (t > best) best = t;
  }
  m.set(k, best);
  return best;
}

// ---------------------------------------------------------------------------------------------- terni lapilli
// The sliding game can run in circles, so it is solved by retrograde analysis over every reachable position:
// terminal positions first, then "win in d" / "loss in d" layer by layer; whatever stays unresolved is a draw.
let ternTable = null;
function buildTerni() {
  const start = startState('terni');
  const nodes = new Map(); // key -> { st, kids: [keys], res }
  const queue = [start];
  nodes.set(keyOf(start), { st: start, kids: null, res: null });
  while (queue.length) {
    const st = queue.pop(), node = nodes.get(keyOf(st));
    node.res = result(st);
    if (node.res) { node.kids = []; continue; }
    node.kids = legalMoves(st).map((mv) => {
      const c = applyMove(st, mv), k = keyOf(c);
      if (!nodes.has(k)) { nodes.set(k, { st: c, kids: null, res: null }); queue.push(c); }
      return k;
    });
  }
  const score = new Map();
  for (const [k, n] of nodes) if (n.res) score.set(k, scoreTerminal(n.st, n.res));
  for (let d = 1; d < 80; d++) {
    const found = [];
    for (const [k, n] of nodes) {
      if (score.has(k)) continue;
      let win = false, allWon = true;
      for (const c of n.kids) {
        const s = score.get(c);
        if (s === undefined) { allWon = false; continue; }
        if (s === -(WIN - (d - 1))) win = true; // a child that loses in d-1 plies
        if (!(s > 0)) allWon = false;
      }
      if (win) found.push([k, WIN - d]);
      else if (allWon && n.kids.length) found.push([k, -(WIN - d)]);
    }
    if (!found.length) break;
    for (const [k, v] of found) score.set(k, v);
  }
  for (const [k] of nodes) if (!score.has(k)) score.set(k, 0);
  return score;
}
const ternScore = (st) => {
  ternTable ??= buildTerni();
  const r = result(st);
  if (r) return scoreTerminal(st, r);
  const v = ternTable.get(keyOf(st));
  return v === undefined ? 0 : v;
};

// ---------------------------------------------------------------------------------------------- quad (4x4)
const QM = SPECS.quad.lines.map((l) => l.reduce((m, i) => m | (1 << i), 0));
const pc = (x) => { x -= (x >> 1) & 0x5555; x = (x & 0x3333) + ((x >> 2) & 0x3333); x = (x + (x >> 4)) & 0x0f0f; return (x + (x >> 8)) & 0x1f; };
const ORDER = [5, 6, 9, 10, 0, 3, 12, 15, 1, 2, 4, 7, 8, 11, 13, 14];
const QTT = new Map();
function winCells(me, op) {
  let w = 0;
  for (const l of QM) if ((op & l) === 0 && pc(me & l) === pc(l) - 1) w |= l & ~me;
  return w;
}
function qgo(me, op, alpha, beta) {
  const occ = me | op;
  if (occ === 0xffff) return 0;
  if (winCells(me, op) & ~occ) return 1;
  const forced = winCells(op, me) & ~occ;
  if (forced & (forced - 1)) return -1;
  const key = me * 65536 + op;
  let lo = -1, hi = 1;
  const e = QTT.get(key);
  if (e) {
    lo = e[0]; hi = e[1];
    if (lo >= beta) return lo;
    if (hi <= alpha) return hi;
    if (lo === hi) return lo;
    alpha = Math.max(alpha, lo); beta = Math.min(beta, hi);
  }
  const a0 = alpha;
  let best = -2;
  for (const i of ORDER) {
    const b = 1 << i;
    if (occ & b || (forced && forced !== b)) continue;
    const v = -qgo(op, me | b, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  if (best <= a0) hi = Math.min(hi, best); else if (best >= beta) lo = Math.max(lo, best); else { lo = best; hi = best; }
  QTT.set(key, [lo, hi]);
  return best;
}
function masks(st) {
  let x = 0, o = 0;
  st.cells.forEach((c, i) => { if (c === 1) x |= 1 << i; else if (c === 2) o |= 1 << i; });
  return st.turn === 1 ? [x, o] : [o, x];
}
function quadScore(st) {
  const r = result(st);
  if (r) return scoreTerminal(st, r) / 2;
  const [me, op] = masks(st);
  return qgo(me, op, -1, 1) * 50;
}

// ---------------------------------------------------------------------------------------------- public API
export function scoreOf(st) {
  const r = result(st);
  if (r) return scoreTerminal(st, r);
  if (st.mode === 'quad') return quadScore(st);
  if (st.mode === 'terni') return ternScore(st);
  return solvePlacing(st);
}

// Every legal move with its exact score for the player to move.
export function scoreMoves(st) {
  return legalMoves(st).map((mv) => {
    const c = applyMove(st, mv);
    const r = result(c);
    let s;
    if (r) s = scoreTerminal(st, { winner: r.winner }) === 0 ? 0 : (r.winner === st.turn ? WIN - 1 : -(WIN - 1));
    else if (st.mode === 'quad') s = -quadScore(c);
    else if (st.mode === 'terni') s = lift(-ternScore(c));
    else s = lift(-solvePlacing(c));
    return { mv, s };
  });
}

export const bestScore = (st) => { const l = scoreMoves(st); return l.length ? Math.max(...l.map((x) => x.s)) : 0; };
export const outcomeWord = (s) => (s > 0 ? 'win' : s < 0 ? 'loss' : 'draw');

// What perfect play gives from the start of each mode, for player X (1 = X wins, 0 = draw, -1 = O wins).
export function startValue(mode) { const s = scoreOf(startState(mode)); return s > 0 ? 1 : s < 0 ? -1 : 0; }
export { parse };
