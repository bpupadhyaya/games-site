// Puzzle generator. A puzzle is made by playing BACKWARDS from a single peg: a reverse jump takes a peg from `to` back to `from`
// and puts a new peg in `over` (both must be empty). Whatever comes out is therefore solvable to one peg by construction.
// Several candidates are made and the one that is hardest for a straightforward search (most nodes before it finds a way) is kept.
// Deterministic: a small seeded generator (mulberry32), never the clock. Used offline to bake the curated levels and at run time
// for the daily puzzle.
import { createSolver } from './solver.js';

export function prng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n), pick: (arr) => arr[Math.floor(next() * arr.length)] };
}

export function reversePuzzle(b, pegsWanted, rng, target = -1) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const h = new Array(b.n).fill(0), t = target >= 0 ? target : rng.int(b.n);
    h[t] = 1; let last = -1, pegs = 1;
    while (pegs < pegsWanted) {
      const opts = [];
      for (const j of b.jumps) if (h[j.to] && !h[j.from] && !h[j.over]) opts.push(j);   // reverse jump: peg goes to -> from, new peg at over
      if (!opts.length) break;
      const fresh = opts.filter((j) => j.to !== last);
      const j = rng.pick(fresh.length && rng.next() < 0.8 ? fresh : opts);
      h[j.to] = 0; h[j.from] = 1; h[j.over] = 1; pegs++; last = j.from;
    }
    if (pegs === pegsWanted) return h;
  }
  return null;
}

// how hard a search finds it: nodes expanded before the first solution (capped), higher = harder
export function hardness(b, h, cap = 60000) {
  const s = createSolver(b, h); while (!s.done && s.nodes < cap) s.step(2000);
  return s.done && s.solution ? s.nodes : cap;
}

export function makePuzzle(b, pegs, seed, tries = 24) {
  const rng = prng(seed);
  let best = null, bestScore = -1;
  for (let k = 0; k < tries; k++) {
    const h = reversePuzzle(b, pegs, rng);
    if (!h) continue;
    // the pegs must not already be a single trivial cluster of independent jumps: require the first search to need real work
    const sc = hardness(b, h, 20000) + rng.next();
    if (sc > bestScore) { bestScore = sc; best = h; }
  }
  return best;
}
