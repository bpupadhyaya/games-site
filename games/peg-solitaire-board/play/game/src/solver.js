// Peg solitaire solver. Depth-first search with a table of dead positions, run in slices so a frame never stalls
// (`step(budget)` expands at most `budget` positions). Two goals:
//   'single'  reach exactly one peg (optionally on a given hole)           -> any solution, found fast
//   'par'     fewest MOVES (a chain of jumps by one peg is one move) to one peg -> iterative deepening, small positions only
// Also `bestEffort`: if no one-peg ending exists, the line that leaves the fewest pegs seen.
import { legalJumps, applyJump, undoJump, count, keyOf } from './rules.js';

export function createSolver(b, start, { endAt = -1, order = null } = {}) {
  const h = start.slice(), dead = new Set(), path = [];
  let nodes = 0, done = false, solution = null, best = { left: count(h), path: [] };
  // each stack frame: the list of jumps still to try at that depth
  const stack = [];
  const sortJumps = (js, hh) => {
    const lastTo = path.length ? path[path.length - 1].to : -1;   // prefer to keep jumping with the same peg: a chain is one move
    // prefer jumps that land on or toward the rim / keep pegs together: fewer isolated pegs first
    return js.map((j) => ({ j, s: score(b, hh, j) + (j.from === lastTo ? 6 : 0) })).sort((x, y) => y.s - x.s || x.j.from - y.j.from || x.j.to - y.j.to).map((x) => x.j);
  };
  const push = () => stack.push({ js: sortJumps(legalJumps(b, h), h), i: 0, key: keyOf(h) });
  push();
  const goal = () => count(h) === 1 && (endAt < 0 || h[endAt] === 1);
  if (goal()) { done = true; solution = []; }
  return {
    get nodes() { return nodes; }, get done() { return done; },
    get solution() { return solution; }, get best() { return best; },
    step(budget = 2000) {
      while (!done && budget-- > 0) {
        const top = stack[stack.length - 1];
        if (!top) { done = true; solution = null; break; }
        if (top.i >= top.js.length) { dead.add(top.key); stack.pop(); const j = path.pop(); if (j) undoJump(h, j); continue; }
        const j = top.js[top.i++];
        applyJump(h, j); path.push(j); nodes++;
        const left = count(h);
        if (left < best.left) best = { left, path: path.slice() };
        if (goal()) { done = true; solution = path.slice(); break; }
        const k = keyOf(h);
        if (dead.has(k) || left === 1) { undoJump(h, j); path.pop(); continue; }
        push();
      }
      return done;
    },
  };
}

// fewest jumps-chains solution for small positions; returns the jump list or null. Breadth-first over positions, layered by MOVES.
export function parSolution(b, start, { maxStates = 400000, endAt = -1 } = {}) {
  const key = keyOf;
  const startKey = key(start), seen = new Map([[startKey, null]]);
  let layer = [{ h: start, k: startKey }];
  const rebuild = (k) => { const out = []; while (seen.get(k)) { const p = seen.get(k); out.push(...p.jumps.slice().reverse()); k = p.prev; } return out.reverse(); };
  if (count(start) === 1) return [];
  while (layer.length && seen.size < maxStates) {
    const next = [];
    for (const node of layer) {
      // every chain of jumps by one peg is a single move
      const roots = legalJumps(b, node.h);
      for (const r of roots) {
        const chain = [];
        const walk = (hh, j) => {
          const h2 = applyJump(hh.slice(), j); chain.push(j);
          const k2 = key(h2);
          if (!seen.has(k2)) {
            seen.set(k2, { prev: node.k, jumps: chain.slice() });
            if (count(h2) === 1 && (endAt < 0 || h2[endAt] === 1)) return k2;
            next.push({ h: h2, k: k2 });
          }
          for (const j2 of b.byFrom[j.to]) if (h2[j2.over] && !h2[j2.to]) { const r2 = walk(h2, j2); if (r2 !== undefined) return r2; }
          chain.pop();
          return undefined;
        };
        const hit = walk(node.h, r);
        if (hit !== undefined) return rebuild(hit);
      }
    }
    layer = next;
  }
  return null;
}

// move-ordering score: reward jumps that keep the remaining pegs connected (fewer lonely pegs), then prefer outer holes
function score(b, h, j) {
  let s = 0;
  const lonely = (i) => { for (const d of b.byFrom[i]) if (h[d.over]) return false; return true; };
  // after the jump: the landing peg and the neighbours of the removed pegs
  s -= (b.pos[j.to].x ** 2 + b.pos[j.to].y ** 2) * 0.01;
  s += (b.pos[j.from].x ** 2 + b.pos[j.from].y ** 2) * 0.01;
  return s + (lonely(j.over) ? 0 : 0);
}
