// The computer player. It scores a position by how far every peg has advanced (with a pull on the stragglers and on the diagonal highway),
// then looks ahead over the real rules (rules.js): its own best follow-up move, and at the higher levels the best reply of the next player too.
// That follow-up matters most in Halma: the strong move is the one that sets up a ladder for the NEXT turn.
// Deterministic: work is counted in search nodes (never a clock) and the only randomness is the seeded env.rng, used to choose among near-equal
// moves. The search is a generator, resumed in small slices so a frame never stalls. `step()` returns { move } once it has decided.
import { geo, reachFrom } from './rules.js';

export const LEVELS = [
  { name: 'Beginner', k1: 14, ply: 1, noise: 7, slip: 0.22, margin: 6 },
  { name: 'Easy', k1: 12, ply: 1, noise: 3, slip: 0.05, margin: 3 },
  { name: 'Medium', k1: 8, ply: 2, noise: 4, slip: 0, margin: 3 },
  { name: 'Hard', k1: 12, ply: 2, noise: 1, slip: 0, margin: 1.2 },
  { name: 'Master', k1: 20, ply: 2, noise: 0, slip: 0, margin: 0 },
];
const SLICE = 1400, DEF_W = { min: 1.2, lat: 0.28, home: 2.5, follow: 0.6 };

// value of seat `s` on board b: advance of all pegs + the rearmost peg + staying on the main diagonal + pegs in the goal camp
function evalSeat(b, G, s, W) {
  const adv = G.adv[s], n = G.n, tc = G.targetC[s];
  let sum = 0, lo = 1e9, lat = 0, home = 0;
  for (let i = 0; i < G.N; i++) {
    if (b[i] !== s) continue;
    const a = adv[i]; sum += a; if (a < lo) lo = a;
    const r = (i / n) | 0, c = i % n, dr = Math.abs(r - ((G.startC[s] === 0 || G.startC[s] === 1) ? 0 : n - 1)), dc = Math.abs(c - ((G.startC[s] === 0 || G.startC[s] === 3) ? 0 : n - 1));
    lat += Math.abs(dr - dc);
    if (G.campOf[i] === tc) home++;
  }
  return sum + W.min * lo - W.lat * lat + W.home * home;
}
// me against everyone else
function value(b, G, me, W) {
  let others = 0; for (let s = 1; s <= G.seats; s++) if (s !== me) others += evalSeat(b, G, s, W);
  return evalSeat(b, G, me, W) - others / Math.max(1, G.seats - 1);
}

export function createThinker(game, level, rng) {
  const cfg = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))], G = geo(game.variant), me = game.turn, W = { ...DEF_W, ...(cfg.w || {}) };
  const b = Int8Array.from(game.board);
  let nodes = 0, budgetEst = 1;
  function genAll(seat) {
    const out = [];
    for (let i = 0; i < G.N; i++) if (b[i] === seat) reachFrom(b, i, G, seat, out);
    return out;
  }
  const make = (m, seat) => { b[m.to] = seat; b[m.from] = 0; };
  const undo = (m, seat) => { b[m.from] = seat; b[m.to] = 0; };
  const next = (seat) => seat % G.seats + 1;

  function* run() {
    const all = genAll(me);
    if (all.length === 0) return null;
    budgetEst = all.length * (cfg.ply >= 3 ? 24 : cfg.ply === 2 ? 12 : 2);
    for (const m of all) { make(m, me); m.v1 = value(b, G, me, W); undo(m, me); nodes++; if (nodes % SLICE === 0) yield; }
    all.sort((x, y) => y.v1 - x.v1);
    const cands = all.slice(0, cfg.k1);
    if (cfg.slip && rng.chance(cfg.slip)) return cands[rng.int(Math.min(cands.length, 8))];
    for (const m of cands) {
      m.score = m.v1;
      if (cfg.ply >= 2) {
        make(m, me);
        let worst = Infinity;
        const followBest = function* () {                              // best own follow-up from the current board (and, deeper, the one after it)
          let best = -Infinity; const fol = [];
          for (let i = 0; i < G.N; i++) {
            if (b[i] !== me) continue;
            const ms = reachFrom(b, i, G, me);
            for (const f of ms) { make(f, me); f.v = value(b, G, me, W); undo(f, me); if (f.v > best) best = f.v; nodes++; fol.push(f); }
            if (nodes % SLICE < ms.length + 1) yield;
          }
          if (best === -Infinity) return m.v1;
          if (cfg.deep) {
            fol.sort((x, y) => y.v - x.v);
            for (const f of fol.slice(0, cfg.deep)) {
              make(f, me);
              for (let i = 0; i < G.N; i++) {
                if (b[i] !== me) continue;
                const ms = reachFrom(b, i, G, me);
                for (const h of ms) { make(h, me); const v = value(b, G, me, W); undo(h, me); if (v > best) best = v; nodes++; }
              }
              undo(f, me); yield;
            }
          }
          return best;
        };
        if (cfg.ply >= 3 && G.seats >= 2) {
          const o = next(me), replies = genAll(o);
          for (const r of replies) { make(r, o); r.v = -value(b, G, o, W); undo(r, o); nodes++; }
          replies.sort((x, y) => y.v - x.v);
          const top = replies.slice(0, cfg.k2);
          if (!top.length) worst = yield* followBest();
          for (const r of top) {
            make(r, o);
            const f = yield* followBest();
            undo(r, o);
            if (f < worst) worst = f;
          }
        } else worst = yield* followBest();
        undo(m, me);
        m.score = worst + W.follow * m.v1;
      }
      if (cfg.noise) m.score += (rng.next() - 0.5) * 2 * cfg.noise;
      yield;
    }
    const top = Math.max(...cands.map((x) => x.score)), pool = cands.filter((x) => x.score >= top - cfg.margin);
    return pool[rng.int(pool.length)];
  }
  const it = run(); let result, done = false;
  return {
    progress: () => (done ? 1 : Math.min(0.97, nodes / (budgetEst * 150 + 1))),
    step() {
      if (done) return { move: result };
      const r = it.next();
      if (r.done) { done = true; result = r.value ? { from: r.value.from, to: r.value.to, path: r.value.path, hops: r.value.hops } : null; return { move: result }; }
      return { move: undefined };
    },
  };
}

// Convenience for tests and screenshots: run a thinker to completion.
export function chooseMove(game, level, rng) {
  const t = createThinker(game, level, rng); let r;
  do { r = t.step(); } while (r.move === undefined);
  return r.move;
}
