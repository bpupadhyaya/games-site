// The computer's brain. Alpha-beta search over rules.js (make/unmake), written as a generator so it can be
// sliced across frames: step() runs about STEP_NODES nodes and returns. Work is counted in nodes, never in time,
// so the computer is deterministic. Also holds the proof solver the daily puzzle uses.
import { ATT, DEF, KING, legalMoves, make, unmake, destinations, captureList, isCorner, corners, throne, openCorners, xy, key } from './rules.js';

export const STEP_NODES = 900;
// depth = plies searched; nodes = budget per move; noise = random evaluation wobble; blunder = chance to play a random top-8 move
export const LEVELS = [
  { name: 'Learner', depth: 1, nodes: 2000, noise: 60, blunder: 0.35, says: 'Plays fast and often misses threats. Good for your first games.' },
  { name: 'Steady', depth: 2, nodes: 9000, noise: 25, blunder: 0.12, says: 'Sees captures and one-move escapes; makes the odd slip.' },
  { name: 'Sharp', depth: 3, nodes: 40000, noise: 8, blunder: 0.02, says: 'Looks three moves ahead. Punishes mistakes.' },
  { name: 'Master', depth: 4, nodes: 110000, noise: 0, blunder: 0, says: 'Searches four moves ahead. Hard to beat.' },
];

const WIN = 100000;

// Score from the attackers' point of view.
export function evaluate(g) {
  const n = g.n, b = g.b, k = g.king, th = throne(n);
  let att = 0, def = 0;
  for (let i = 0; i < b.length; i++) { const v = b[i]; if (v === ATT) att++; else if (v === DEF) def++; }
  let s = att * 100 - def * (n === 11 ? 230 : 300);
  const open = openCorners(g);
  if (g.turn === DEF && open > 0) return -WIN + 50;
  if (open >= 2) return -WIN / 2;
  s -= open * 350;
  // squares the king can reach that open a line to a corner (two-move threats)
  const ds = destinations(g, k), old = b[k];
  let mob = ds.length, threats = 0, forks = 0;
  b[k] = 0;
  for (const to of ds) {
    b[to] = KING; const save = g.king; g.king = to;
    const o = openCorners(g);
    if (o) { threats += 1; if (o >= 2) forks++; }
    b[to] = 0; g.king = save;
  }
  b[k] = old;
  if (forks && g.turn === DEF) return -WIN / 2 + 100;
  s -= forks * 700;
  s -= threats * 120 + mob * 3;
  const { x, y } = xy(n, k);
  const dEdge = Math.min(x, y, n - 1 - x, n - 1 - y);
  s += dEdge * 5;
  // guards: attackers on the squares beside each corner and on the diagonal step
  for (const c of corners(n)) {
    const cx = c % n === 0 ? 0 : 1, cy = c < n ? 0 : 1, sx = cx ? -1 : 1, sy = cy ? -1 : 1;
    const a = c + sx, bb = c + sy * n, dg = c + sx + sy * n, t1 = c + 2 * sx, t2 = c + 2 * sy * n;
    const tri = (b[t1] === ATT ? 1 : 0) + (b[dg] === ATT ? 1 : 0) + (b[t2] === ATT ? 1 : 0);
    s += [0, 40, 130, 420][tri];                          // the three-piece triangle around a corner cannot be broken
    if (tri < 3) { if (b[a] === ATT) s += 12; if (b[bb] === ATT) s += 12; }
  }
  // attackers close to the king; defenders shielding him
  for (const d of [1, -1, n, -n]) { const v = b[k + d]; if (v === ATT) s += 25; else if (v === DEF) s -= 7; }
  // more legal room for the defenders is good for them (cheap proxy)
  return s;
}

// Move ordering: king moves and captures first.
function ordered(g) {
  const ms = legalMoves(g), me = g.turn;
  for (const m of ms) {
    let sc = 0; const v = g.b[m.from];
    if (v === KING) { sc += 20; if (isCorner(g.n, m.to)) sc += 5000; }
    const c = captureList(g, m.to, me); sc += c.length * 60;
    m.o = sc + ((m.to === g.king) ? 0 : 0);
  }
  ms.sort((a, b) => b.o - a.o);
  return ms;
}

// A search that can be paused. `g` is cloned by the caller.
function* searchGen(g, level, rng, fixedDepth) {
  const cfg = LEVELS[level], seen = g.seen || {};
  let nodes = 0, best = null, bestScore = 0, abort = false;
  const budget = cfg.nodes, maxDepth = fixedDepth ?? (g.turn === DEF ? Math.max(1, cfg.depth - 1) : cfg.depth);   // the defenders' side sees one ply less: forks are cheap for them
  const sign = (t) => (t === ATT ? 1 : -1);

  function* ab(depth, alpha, beta, ply) {
    if ((++nodes % STEP_NODES) === 0) yield;
    if (nodes > budget && ply > 0) { abort = true; }
    if (g.winner) return g.winner === ATT ? WIN - ply : g.winner === DEF ? -WIN + ply : 0;
    if (depth === 0 || abort) return evaluate(g);
    const ms = ordered(g);
    if (!ms.length) return g.turn === ATT ? -WIN + ply : WIN - ply;
    const att = g.turn === ATT;
    let bestv = att ? -Infinity : Infinity;
    for (const m of ms) {
      const r = make(g, m.from, m.to);
      const v = yield* ab(depth - 1, alpha, beta, ply + 1);
      unmake(g, r);
      if (att) { if (v > bestv) bestv = v; if (bestv > alpha) alpha = bestv; } else { if (v < bestv) bestv = v; if (bestv < beta) beta = bestv; }
      if (alpha >= beta || abort) break;
    }
    return bestv;
  }

  const rootMoves = ordered(g);
  if (!rootMoves.length) return null;
  const me = g.turn, scored = rootMoves.map((m) => ({ m, s: 0 }));
  for (let depth = 1; depth <= maxDepth; depth++) {
    let alpha = -Infinity, beta = Infinity, bestHere = null, bestS = me === ATT ? -Infinity : Infinity;
    abort = false;
    const partial = [];
    for (const e of scored) {
      const r = make(g, e.m.from, e.m.to);
      let v = yield* ab(depth - 1, alpha, beta, 1);
      if (!g.winner && (seen[key(g)] || 0) >= 2) v = 0;          // this move would repeat a position a third time: a draw
      unmake(g, r);
      if (abort && depth > 1) break;
      partial.push({ m: e.m, s: v });
      if (me === ATT ? v > bestS : v < bestS) { bestS = v; bestHere = e.m; }
      if (me === ATT) alpha = Math.max(alpha, bestS); else beta = Math.min(beta, bestS);
    }
    if (abort && depth > 1) break;                       // budget ran out mid-depth: keep the last complete depth
    best = bestHere; bestScore = bestS;
    // full-window rescoring is skipped; reorder with what we learned (best first) for the next depth
    partial.sort((a, b) => (me === ATT ? b.s - a.s : a.s - b.s));
    scored.length = 0; scored.push(...partial);
    if (Math.abs(bestS) > WIN / 2) break;                 // a forced end was found
    if (nodes > budget) break;
  }
  // Weaker levels: wobble and blunders, chosen from the shallow scores with the game's own random stream.
  if (cfg.blunder && rng.chance(cfg.blunder)) { const pool = rootMoves.slice(0, 8); return pool[rng.int(pool.length)]; }
  if (cfg.noise && scored.length > 1) {
    let pick = best, ps = -Infinity;
    for (const e of scored) { const v = (me === ATT ? e.s : -e.s) + rng.range(0, cfg.noise); if (v > ps) { ps = v; pick = e.m; } }
    return pick;
  }
  return best;
}

// step() until it returns { move } (move may be null if there is none).
export function createThinker(g0, level, rng, depthOverride) {
  const g = JSON.parse(JSON.stringify(g0)); g.before = null;
  const it = searchGen(g, level, rng, depthOverride);
  let done = null;
  return {
    step() {
      if (done) return done;
      const r = it.next();
      if (r.done) done = { move: r.value ? { from: r.value.from, to: r.value.to } : null };
      return done ?? {};
    },
  };
}
export function chooseMove(g0, level, rng) {
  const t = createThinker(g0, level, rng); let r; do { r = t.step(); } while (r.move === undefined);
  return r.move;
}

// ---------------------------------------------------------------------------------------------------
// Proof solver: can the defenders force a win within `n` of their own moves? (attackers to reply at will)
// ---------------------------------------------------------------------------------------------------
export function defenderWins(g, n) {
  // g.turn must be DEF. Returns the list of first moves that force the win.
  const good = [];
  const solve = (m0) => {
    const r = make(g, m0.from, m0.to);
    let ok;
    if (g.winner === DEF) ok = true;
    else if (g.winner || n === 1) ok = false;
    else ok = attackersLose(n - 1);
    unmake(g, r);
    return ok;
  };
  function attackersLose(left) {                   // attackers to move: every reply must still lose
    const ms = legalMoves(g);
    if (!ms.length) return true;
    if (openCorners(g) >= 0) { /* fallthrough */ }
    for (const a of ms) {
      const r = make(g, a.from, a.to);
      let ok;
      if (g.winner === ATT) ok = false;
      else if (g.winner) ok = true;
      else ok = defenderCan(left);
      unmake(g, r);
      if (!ok) return false;
    }
    return true;
  }
  function defenderCan(left) {
    const ms = legalMoves(g);
    // quick win: the king steps into a corner
    for (const m of ms) if (g.b[m.from] === KING && isCorner(g.n, m.to)) return true;
    if (left <= 1) return false;
    // a defender can only force a win in `left` if some move works
    for (const m of ms) { const r = make(g, m.from, m.to); let ok = false; if (g.winner === DEF) ok = true; else if (!g.winner) ok = attackersLose(left - 1); unmake(g, r); if (ok) return true; }
    return false;
  }
  for (const m of legalMoves(g)) if (solve(m)) good.push(m);
  return good;
}
