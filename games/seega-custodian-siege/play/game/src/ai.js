// The opponents. Movement: alpha-beta over the engine's own moves (a capture chain is several plies of the same side).
// Placement: every candidate square is scored by playing the position out many times (random completion of the layout,
// then quick play), plus a structural prior. Five levels; calibrated by simulation (tools in test notes in STATUS.md).
import {
  NN, CENTRE, PIECES, ADJ, RAYS, legalMoves, applyMove, hasMoves, countOf, isCorner, isEdge, other, isEnd,
} from './rules.js';

export const LEVELS = [
  { id: 'novice', name: 'Novice', depth: 0, cap: 0, rollouts: 0, blurb: 'Learning the game. Places stones almost at random and takes a capture only now and then.' },
  { id: 'casual', name: 'Casual', depth: 1, cap: 2000, rollouts: 0, blurb: 'Takes every capture it sees and likes safe corners, but does not look ahead.' },
  { id: 'skilled', name: 'Skilled', depth: 3, cap: 8000, rollouts: 5, blurb: 'Looks a few moves ahead and avoids easy traps. Beatable with a good layout.' },
  { id: 'expert', name: 'Expert', depth: 5, cap: 24000, rollouts: 14, blurb: 'Plans its layout and searches deeply. Rarely falls for a trap.' },
  { id: 'master', name: 'Master', depth: 8, cap: 100000, rollouts: 150, blurb: 'The strongest: tests many layouts and searches furthest. Slips only rarely.' },
];
export const levelOf = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS[2];

// A small deterministic generator for Think and tests: the same position always gives the same advice.
export function seeded(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n), chance: (p) => next() < p };
}
export function seedOf(st) {
  let h = 2166136261;
  for (let i = 0; i < NN; i++) h = Math.imul(h ^ (st.cells[i] + 1), 16777619);
  h = Math.imul(h ^ (st.turn * 7 + st.drops * 3 + st.tn), 16777619);
  return h >>> 0;
}

// ------------------------------------------------------------------------------------------------ evaluation and search
const SAFE_W = [],
  mobility = (cells, who) => { let n = 0; for (let i = 0; i < NN; i++) if (cells[i] === who) for (const j of ADJ[i]) if (cells[j] === 0) n++; return n; };
for (let i = 0; i < NN; i++) SAFE_W.push(i === CENTRE ? 4 : isCorner(i) ? 5 : isEdge(i) ? 2 : 0);

// Most stones `who` could capture with one slide, right now (a cheap look at the threats on the board).
function quickYield(cells, who) {
  const foe = 3 - who;
  let best = 0;
  for (let i = 0; i < NN; i++) {
    if (cells[i] !== who) continue;
    for (const j of ADJ[i]) {
      if (cells[j] !== 0) continue;
      let n = 0;
      for (const [n1, n2] of RAYS[j]) if (cells[n1] === foe && n1 !== CENTRE && n2 !== i && cells[n2] === who) n++;
      if (n > best) best = n;
    }
  }
  return best;
}

export const EVAL = { mode: 1 };
export function evaluate(st, me) {
  const foe = other(me);
  let mine = 0, theirs = 0, pos = 0;
  for (let i = 0; i < NN; i++) {
    const c = st.cells[i];
    if (c === me) { mine++; pos += SAFE_W[i]; } else if (c === foe) { theirs++; pos -= SAFE_W[i]; }
  }
  let v = (mine - theirs) * 100 + pos + (mobility(st.cells, me) - mobility(st.cells, foe)) * 2;
  if (EVAL.mode >= 1 && st.phase === 'move') {
    // the side to move can cash its best threat; the other side's threat counts for half (it must first survive)
    const ym = quickYield(st.cells, me), yf = quickYield(st.cells, foe);
    v += st.turn === me ? 80 * ym - 40 * yf : 40 * ym - 80 * yf;
  }
  return v;
}

const WIN = 100000;

function children(st) {
  const kids = [];
  for (const mv of legalMoves(st)) {
    const ns = applyMove(st, mv);
    kids.push({ mv, ns, caps: ns.last.captured.length });
  }
  kids.sort((a, b) => b.caps - a.caps);
  return kids;
}

function terminal(st, me, depth) {
  const o = st.over;
  if (o.winner === 0) return 0;
  const base = o.why === 'captured' ? WIN : WIN / 2;
  return o.winner === me ? base - depth : -base + depth;
}

function ab(st, depth, alpha, beta, me, ply, budget) {
  if (st.over) return terminal(st, me, ply);
  if (depth <= 0 || budget.n <= 0) return evaluate(st, me);
  budget.n--;
  const kids = children(st);
  if (!kids.length) return evaluate(st, me);
  if (st.turn === me) {
    let best = -Infinity;
    for (const k of kids) {
      const v = ab(k.ns, depth - 1, alpha, beta, me, ply + 1, budget);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const k of kids) {
    const v = ab(k.ns, depth - 1, alpha, beta, me, ply + 1, budget);
    if (v < best) best = v;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return best;
}

// Nodes of search work between two yields (about one frame of work on a phone).
const QUANTUM = 2500;

// The same search as `ab`, but the first five plies are a generator that yields between children, so a long search is
// sliced into small pieces (the game steps one slice per frame). The deeper plies run in plain recursion.
function* abY(st, depth, alpha, beta, me, ply, budget) {
  if (st.over) return terminal(st, me, ply);
  if (depth <= 0 || budget.n <= 0) return evaluate(st, me);
  if (ply >= 5) return ab(st, depth, alpha, beta, me, ply, budget);
  budget.n--;
  const kids = children(st);
  if (!kids.length) return evaluate(st, me);
  if (st.turn === me) {
    let best = -Infinity;
    for (const k of kids) {
      const v = yield* abY(k.ns, depth - 1, alpha, beta, me, ply + 1, budget);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
      if (budget.n <= budget.mark) { budget.mark = budget.n - QUANTUM; yield; }
    }
    return best;
  }
  let best = Infinity;
  for (const k of kids) {
    const v = yield* abY(k.ns, depth - 1, alpha, beta, me, ply + 1, budget);
    if (v < best) best = v;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
    if (budget.n <= budget.mark) { budget.mark = budget.n - QUANTUM; yield; }
  }
  return best;
}

// Scores every legal move for the side to move. Returns [{ mv, s }] (s is from the mover's view). With exact=false the
// window narrows as better moves are found: a worse move then only reports "no better than the best so far".
export function scoreMoves(st, depth, nodeCap = 40000, exact = true) {
  const me = st.turn;
  const budget = { n: nodeCap };
  const out = [];
  let best = -Infinity;
  for (const k of children(st)) {
    const v = ab(k.ns, depth - 1, exact ? -Infinity : best - 1, Infinity, me, 1, budget);
    if (v > best) best = v;
    out.push({ mv: k.mv, s: v, caps: k.caps });
  }
  return out;
}

function pickBest(list, rng, noise = 0) {
  let best = -Infinity;
  for (const x of list) if (x.s > best) best = x.s;
  const top = list.filter((x) => x.s >= best - noise);
  return top[rng.int(top.length)];
}

// Iterative deepening, one root move per slice (the game steps it a frame at a time). A depth that runs out of its node
// budget is thrown away and the last finished depth is used, so a bigger budget can only play better.
export function* movementSearch(st, maxDepth, nodeCap) {
  const me = st.turn;
  let kids = children(st);
  let done = kids.map((k) => ({ mv: k.mv, s: 0, caps: k.caps }));
  const budget = { n: nodeCap, mark: nodeCap - QUANTUM };
  for (let d = 1; d <= maxDepth; d++) {
    const results = [];
    let best = -Infinity, aborted = false;
    for (const k of kids) {
      const v = yield* abY(k.ns, d - 1, best - 1, Infinity, me, 1, budget);
      if (budget.n <= 0) { aborted = true; break; }
      results.push({ mv: k.mv, s: v, caps: k.caps, ns: k.ns });
      if (v > best) best = v;
    }
    if (aborted) break;
    done = results; done.depth = d;
    kids = results.slice().sort((x, y) => y.s - x.s).map((x) => ({ mv: x.mv, ns: x.ns, caps: x.caps }));
    if (best >= WIN / 2 || best <= -WIN / 2) break; // a forced result: deeper search cannot change it
  }
  return done;
}

// ------------------------------------------------------------------------------------------------ movement choice
export function* chooseMovementTask(st, level, rng) {
  const moves = legalMoves(st);
  if (!moves.length) return null;
  const L = levelOf(level);
  if (L.id === 'novice') {
    const caps = moves.filter((m) => !isEnd(m) && applyMove(st, m).last.captured.length);
    if (caps.length && rng.chance(0.35)) return caps[rng.int(caps.length)];
    const real = moves.filter((m) => !isEnd(m));
    if (st.chain >= 0 && rng.chance(0.5)) return moves.find(isEnd);
    return (real.length ? real : moves)[rng.int((real.length ? real : moves).length)];
  }
  if (L.id === 'casual' && rng.chance(0.12)) return moves[rng.int(moves.length)];
  const list = yield* movementSearch(st, L.depth, L.cap);
  if (L.id === 'skilled' && rng.chance(0.07)) { list.sort((a, b) => b.s - a.s); return list[Math.min(list.length - 1, rng.int(3))].mv; }
  return pickBest(list, rng, 0).mv;
}
export function chooseMovement(st, level, rng) {
  const g = chooseMovementTask(st, level, rng);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}

// ------------------------------------------------------------------------------------------------ placement
// The prior says how structurally sound a square is for `who`. It only breaks ties and trims noise.
export function placePrior(st, i, who) {
  let v = isCorner(i) ? 3 : isEdge(i) ? 1.4 : 0.4;
  let own = 0;
  for (const j of ADJ[i]) if (st.cells[j] === who) own++;
  v += 0.5 * own;
  // the side that places last moves first and must step into the centre: it needs a stone beside the centre
  if (who === 2 && ADJ[CENTRE].includes(i)) v += 1.4;
  return v;
}

function fullState(cells) {
  const st = { cells, turn: 2, phase: 'move', drops: 0, placed: [PIECES, PIECES], chain: -1, quiet: 0, tn: 0, over: null, last: null };
  if (!hasMoves(cells, 2)) st.turn = 1;
  return st;
}

function quickMove(st, rng) {
  const moves = legalMoves(st);
  let best = -1, pool = [];
  for (const m of moves) {
    if (isEnd(m)) continue;
    const c = applyMove(st, m).last.captured.length;
    if (c > best) { best = c; pool = [m]; } else if (c === best) pool.push(m);
  }
  if (!pool.length) return moves[0];
  return pool[rng.int(pool.length)];
}

function rollout(cells, me, rng) {
  let st = fullState(cells);
  for (let ply = 0; ply < 70 && !st.over; ply++) {
    const mv = quickMove(st, rng);
    if (!mv) break;
    st = applyMove(st, mv);
  }
  const d = countOf(st, me) - countOf(st, other(me));
  if (st.over) return d + (st.over.winner === me ? 8 : st.over.winner === 0 ? 0 : -8);
  return d;
}

function shuffleInto(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) { const j = rng.int(i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}

// Generator: yields once per candidate square so the game can spread the work across frames. Returns { cell, scores }.
export function* placementSearch(st, level, rng) {
  const me = st.turn, foe = other(me), L = levelOf(level);
  const empties = [];
  for (let i = 0; i < NN; i++) if (st.cells[i] === 0 && i !== CENTRE) empties.push(i);
  const scores = [];
  if (L.id === 'novice') return { cell: empties[rng.int(empties.length)], scores };
  if (L.id === 'casual') {
    let tot = 0;
    const w = empties.map((i) => { const v = placePrior(st, i, me) ** 2; tot += v; return v; });
    let r = rng.next() * tot, k = 0;
    while (k < empties.length - 1 && r >= w[k]) { r -= w[k]; k++; }
    return { cell: empties[k], scores };
  }
  const remMe = PIECES - st.placed[me - 1], remFoe = PIECES - st.placed[foe - 1];
  let work = 0;
  for (const c of empties) {
    const rest = empties.filter((i) => i !== c);
    let sum = 0;
    for (let r = 0; r < L.rollouts; r++) {
      shuffleInto(rest, rng);
      const cells = st.cells.slice();
      cells[c] = me;
      // the rest of the layout, at random: remMe - 1 more of mine, remFoe of theirs
      for (let k = 0; k < rest.length; k++) cells[rest[k]] = k < remMe - 1 ? me : foe;
      sum += rollout(cells, me, rng);
      if (++work % 120 === 0) yield c; // about one frame of rollouts
    }
    scores.push({ cell: c, s: sum / L.rollouts + 0.3 * placePrior(st, c, me) });
  }
  let best = -Infinity;
  for (const x of scores) if (x.s > best) best = x.s;
  const top = scores.filter((x) => x.s >= best - 0.05);
  return { cell: top[rng.int(top.length)].cell, scores };
}

// One decision as a generator. Movement answers at once; placement may take several frames.
export function* thinkTask(st, level, rng) {
  if (st.phase === 'place') {
    const r = yield* placementSearch(st, level, rng);
    return { from: -1, to: r.cell };
  }
  return yield* chooseMovementTask(st, level, rng);
}

export function chooseMove(st, level, rng) {
  const g = thinkTask(st, level, rng);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
