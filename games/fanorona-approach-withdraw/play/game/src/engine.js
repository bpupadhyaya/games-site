// The computer opponent: an alpha-beta search over WHOLE TURNS (a chain of captures is one turn), with forced
// capture extension (captures are compulsory in Fanorona, so a position where a capture is pending is never
// judged "quiet"), a transposition table, iterative deepening and move-ordering by stones taken.
//
// It never touches a clock: strength is set by depth and a node budget, so the same position and seed always
// give the same move. A search is run in slices (createThinker().step()) so the screen never freezes.
import { N, LIGHT, DARK, other, rowOf, colOf, isStrong, genTurns, canCapture, countOf, stepsFrom, EMPTY } from './rules.js';

const WIN = 100000;
export const LEVELS = [
  { name: 'Beginner', blurb: 'Plays quickly and misses traps.', depth: 0, margin: 1e9, nodes: 0 },
  { name: 'Casual', blurb: 'Takes what it sees, rarely plans.', depth: 1, margin: 90, nodes: 4000 },
  { name: 'Skilled', blurb: 'Looks two turns ahead.', depth: 2, margin: 40, nodes: 20000 },
  { name: 'Strong', blurb: 'Sees most tactics.', depth: 3, margin: 15, nodes: 60000 },
  { name: 'Expert', blurb: 'Plans several turns deep.', depth: 5, margin: 12, nodes: 150000 },
  { name: 'Master', blurb: 'Searches deepest. Hard to beat.', depth: 10, margin: 2, nodes: 1000000 },
];
export const LEVEL_COUNT = LEVELS.length;

// Static evaluation from `side`'s point of view. Material dominates; strong points (eight lines) are worth a little;
// when ahead, closing in on the enemy; when behind, being hard to reach.
function evaluate(b, side) {
  let mine = 0, theirs = 0, pos = 0;
  const my = [], their = [];
  for (let p = 0; p < N; p++) {
    const v = b[p];
    if (v === EMPTY) continue;
    const r = rowOf(p), c = colOf(p), s = (isStrong(p) ? 3 : 0) - (Math.abs(r - 2) + Math.abs(c - 4)) * 0.4;
    if (v === side) { mine++; pos += s; my.push(p); } else { theirs++; pos -= s; their.push(p); }
  }
  if (theirs === 0) return WIN;
  if (mine === 0) return -WIN;
  let score = (mine - theirs) * 100 + pos;
  // endgame: with few stones left, the leader hunts and the trailer keeps distance
  if (mine + theirs <= 14 && mine !== theirs) {
    let near = 0;
    for (const a of my) { let best = 99; for (const t of their) { const d = Math.max(Math.abs(rowOf(a) - rowOf(t)), Math.abs(colOf(a) - colOf(t))); if (d < best) best = d; } near += best; }
    const avg = near / my.length;
    score += (mine > theirs ? -1 : 1) * avg * 2;
  }
  return score;
}

export function createSearch(level, rng) {
  const cfg = LEVELS[level - 1] || LEVELS[2];
  let nodes = 0, abort = false;
  const tt = new Map();
  const hardCap = cfg.nodes;

  const order = (turns) => turns.sort((a, b) => b.caps - a.caps);

  // Negamax over whole turns. `ext` counts consecutive forced-capture extensions beyond the nominal depth.
  function nega(b, side, depth, alpha, beta, ply, key, ext) {
    nodes++;
    if (hardCap && nodes > hardCap) abort = true;
    if (abort) return 0;
    const mine = countOf(b, side);
    if (mine === 0) return -WIN + ply;
    if (countOf(b, other(side)) === 0) return WIN - ply;
    if (depth <= 0) {
      if (ext >= 4 || !canCapture(b, side)) return evaluate(b, side);
      depth = 1; ext++;
    }
    const ent = tt.get(key + side);
    if (ent && ent.depth >= depth) {
      if (ent.flag === 0) return ent.v;
      if (ent.flag === 1 && ent.v >= beta) return ent.v;
      if (ent.flag === 2 && ent.v <= alpha) return ent.v;
    }
    const turns = genTurns(b, side);
    if (!turns.length) return -WIN + ply;
    order(turns);
    if (ent && ent.best) { const i = turns.findIndex((t) => t.key === ent.best); if (i > 0) { const [t] = turns.splice(i, 1); turns.unshift(t); } }
    const a0 = alpha;
    let best = -Infinity, bestKey = null;
    for (const t of turns) {
      const v = -nega(t.board, other(side), depth - 1, -beta, -alpha, ply + 1, t.key, ext);
      if (abort) return 0;
      if (v > best) { best = v; bestKey = t.key; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    tt.set(key + side, { depth, v: best, flag: best <= a0 ? 2 : best >= beta ? 1 : 0, best: bestKey });
    return best;
  }

  // The root search as a generator: yields after every root move so the caller can slice the work.
  function* run(board, side) {
    const root = genTurns(board, side);
    if (!root.length) return { move: null, scored: [] };
    if (root.length === 1) return { move: root[0], scored: [{ t: root[0], v: 0 }] };
    if (cfg.depth === 0) return { move: root[rng.int(root.length)], scored: [] };
    let scored = order(root.slice()).map((t) => ({ t, v: 0 }));
    const maxDepth = cfg.depth;
    for (let d = 1; d <= maxDepth; d++) {
      const next = [];
      let alpha = -Infinity;
      abort = false;
      let mark = nodes;
      for (const s of scored) {
        // each root move is searched with a full window so scores are comparable for the margin pick
        const v = -nega(s.t.board, other(side), d - 1, -WIN * 2, WIN * 2, 1, s.t.key, 0);
        if (abort) break;
        next.push({ t: s.t, v });
        if (v > alpha) alpha = v;
        const used = nodes - mark; mark = nodes; yield used;
      }
      if (abort) {
        if (d === 1) { scored = scored.map((s) => ({ t: s.t, v: next.find((n) => n.t === s.t)?.v ?? -WIN })); }
        break; // keep the last fully searched depth
      }
      next.sort((x, y) => y.v - x.v);
      scored = next;
      if (scored[0].v >= WIN - 50) break; // found a forced win
      if (hardCap && nodes > hardCap * 0.6 && d < maxDepth) break;
    }
    const bestV = scored[0].v;
    const pool = scored.filter((s) => s.v >= bestV - cfg.margin);
    // never throw away a won game for variety
    const pick = bestV >= WIN - 50 ? scored[0] : pool[rng.int(pool.length)];
    return { move: pick.t, scored };
  }
  return { run, cfg, get nodes() { return nodes; } };
}

// A sliced search. `step()` does a little work and returns { move } once decided (move may be null if the side
// has no move), or {} while still thinking.
export function createThinker(board, side, level, rng, budget = 6000) {
  const s = createSearch(level, rng);
  const gen = s.run(board, side);
  let done = null;
  return {
    step() {
      if (done) return done;
      let used = 0;
      for (;;) {
        const r = gen.next();
        if (r.done) { done = { move: r.value.move, scored: r.value.scored }; return done; }
        used += r.value;
        if (used >= budget) return {};
      }
    },
    get level() { return level; },
  };
}
// Blocking search (tests and tooling only).
export function bestTurn(board, side, level, rng) {
  const t = createThinker(board, side, level, rng, Infinity);
  return t.step().move;
}
export { evaluate, stepsFrom, LIGHT, DARK };
