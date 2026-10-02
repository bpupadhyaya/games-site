// The computer: iterative-deepening alpha-beta over the real rule book (rules.js fullMoves), sliced so one frame never
// stalls: `step()` searches one root move, the game calls it until it hands back a move. Randomness only picks between
// near-equal moves and comes from env.rng, so a given seed always plays the same game.
import { fullMoves, sum, frontSum, NYUMBA } from './rules.js';

export const LEVELS = [
  { name: 'Learner', depth: 2, nodes: 4000, noise: 5, blurb: 'Plays quick, sometimes careless moves. A kind first opponent.' },
  { name: 'Mchezaji', depth: 3, nodes: 20000, noise: 1.2, blurb: 'Looks three moves ahead and rarely gives seeds away.' },
  { name: 'Fundi', depth: 5, nodes: 90000, noise: 0.3, blurb: 'Sees captures coming several moves ahead. A serious test.' },
  { name: 'Bingwa', depth: 12, nodes: 1500000, noise: 0, blurb: 'The strongest: searches as deep as it can, with no slips.' },
];
const WIN = 100000, STEP_CAP = 20000;

function markers(g, p) {
  const a = g.pits[p], b = g.pits[1 - p]; let n = 0;
  for (let r = 0; r < 8; r++) if (a[r] > 0 && b[7 - r] > 0) n++;
  return n;
}
// Value of the position for the player to move: seeds (board + store), front-row weight, the house, capture chances.
export function evaluate(g) {
  const p = g.turn, o = 1 - p, me = g.pits[p], op = g.pits[o];
  let v = (sum(me) + g.stock[p]) - (sum(op) + g.stock[o]);
  v += 0.35 * (frontSum(me) - frontSum(op));
  if (g.house[p] && me[NYUMBA] > 0) v += 1.2;
  if (g.house[o] && op[NYUMBA] > 0) v -= 1.2;
  v += 0.9 * markers(g, p) - 0.6 * markers(g, o);
  return v;
}

function search(g, depth, alpha, beta, c) {
  c.nodes++;
  if (c.nodes > c.abortAt) { c.aborted = true; return 0; }
  if (g.winner !== null) return g.winner === 'draw' ? 0 : g.winner === g.turn ? WIN + depth : -WIN - depth;
  if (depth <= 0) return evaluate(g);
  const ms = fullMoves(g, false);
  if (!ms.length) return -WIN - depth;
  ms.sort((a, b) => b.gain - a.gain);
  let best = -Infinity;
  for (const m of ms) {
    const s = -search(m.g, depth - 1, -beta, -alpha, c);
    if (c.aborted) return 0;
    if (s > best) best = s;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function createThinker(g, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
  const root = fullMoves(g, false), c = { nodes: 0, abortAt: Infinity, aborted: false };
  let depth = 1, i = 0, alpha = -Infinity, scores = new Array(root.length).fill(0), done = null, last = null;
  const exact = cfg.noise > 0;
  const finish = () => {
    if (!root.length) return { move: null };
    const sc = last || scores;
    let top = -Infinity; for (const s of sc) if (s > top) top = s;
    const near = []; for (let k = 0; k < root.length; k++) if (sc[k] >= top - cfg.noise) near.push(k);
    const k = near.length > 1 && cfg.noise > 0 ? rng.pick(near) : near[0];
    return { move: root[k].mv };
  };
  return {
    nodes: () => c.nodes,
    step() {
      if (done) return done;
      if (root.length <= 1) return (done = finish());
      const m = root[i];
      // one root move never searches past STEP_CAP nodes, so a frame cannot stall; if it would, the deeper pass is dropped
      c.abortAt = c.nodes + STEP_CAP; c.aborted = false;
      const s = -search(m.g, depth - 1, -Infinity, exact ? Infinity : -alpha, c);
      c.abortAt = Infinity;
      if (c.aborted) { c.aborted = false; return (done = finish()); }
      scores[i] = s; if (s > alpha) alpha = s;
      i++;
      if (i >= root.length) {
        last = scores.slice();
        // best first for the next, deeper pass
        const order = root.map((_, k) => k).sort((a, b) => scores[b] - scores[a]);
        const r2 = order.map((k) => root[k]), s2 = order.map((k) => scores[k]);
        for (let k = 0; k < root.length; k++) { root[k] = r2[k]; }
        last = s2; scores = s2.slice();
        const decisive = Math.abs(s2[0]) >= WIN;
        if (decisive || depth >= cfg.depth || c.nodes > cfg.nodes) return (done = finish());
        depth++; i = 0; alpha = -Infinity;
      } else if (c.nodes > cfg.nodes * 2.5) {
        return (done = finish());
      }
      return {};
    },
  };
}

// Blocking helper for tests and tools: think to the end.
export function chooseMove(g, level, rng) {
  const t = createThinker(g, level, rng); let r;
  do { r = t.step(); } while (r.move === undefined);
  return r.move;
}
