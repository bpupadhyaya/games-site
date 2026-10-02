// The real solver. A position is `pegOf`: pegOf[d] is the peg (0..P-1) holding disc d (0 = smallest). Any
// assignment of discs to pegs is a legal position, because each peg is always ordered by size. A breadth-first
// search outward from the goal gives the exact number of moves left from EVERY position, so "minimum moves",
// Think (the best next move) and Watch & Learn all come from the same table and can never disagree.
// Pure and deterministic. Tables are cached per (discs, pegs, goal peg): at most 3^10 or 4^8 positions.

const cache = new Map();

export const encode = (pegOf, P) => {
  let v = 0;
  for (let d = pegOf.length - 1; d >= 0; d--) v = v * P + pegOf[d];
  return v;
};

export function decode(code, n, P) {
  const out = new Array(n);
  for (let d = 0; d < n; d++) { out[d] = code % P; code = (code - out[d]) / P; }
  return out;
}

// top disc (smallest index) on each peg, or -1
function tops(pegOf, P) {
  const t = new Array(P).fill(-1);
  for (let d = pegOf.length - 1; d >= 0; d--) t[pegOf[d]] = d;
  return t;
}

export function legalMoves(pegOf, P) {
  const t = tops(pegOf, P);
  const out = [];
  for (let a = 0; a < P; a++) {
    if (t[a] < 0) continue;
    for (let b = 0; b < P; b++) if (b !== a && (t[b] < 0 || t[a] < t[b])) out.push([a, b]);
  }
  return out;
}

export function distTable(n, P, goal) {
  const key = `${n}:${P}:${goal}`;
  let tab = cache.get(key);
  if (tab) return tab;
  const size = P ** n;
  tab = new Uint16Array(size).fill(65535);
  const g = encode(new Array(n).fill(goal), P);
  const queue = new Uint32Array(size);
  let head = 0, tail = 0;
  tab[g] = 0; queue[tail++] = g;
  while (head < tail) {
    const c = queue[head++];
    const pegOf = decode(c, n, P);
    const dd = tab[c] + 1;
    for (const [a, b] of legalMoves(pegOf, P)) {
      const d = topOf(pegOf, a);
      pegOf[d] = b;
      const nc = encode(pegOf, P);
      pegOf[d] = a;
      if (tab[nc] === 65535) { tab[nc] = dd; queue[tail++] = nc; }
    }
  }
  cache.set(key, tab);
  return tab;
}

export function topOf(pegOf, peg) {
  for (let d = 0; d < pegOf.length; d++) if (pegOf[d] === peg) return d;
  return -1;
}

export const movesLeft = (pegOf, P, goal) => distTable(pegOf.length, P, goal)[encode(pegOf, P)];

// The best next move [from, to] from this position, or null when already solved. Ties break by (from, to) order,
// which is also unique for three pegs (the optimal path there is unique).
export function bestMove(pegOf, P, goal) {
  const tab = distTable(pegOf.length, P, goal);
  const here = tab[encode(pegOf, P)];
  if (here === 0) return null;
  for (const [a, b] of legalMoves(pegOf, P)) {
    const d = topOf(pegOf, a);
    pegOf[d] = b;
    const v = tab[encode(pegOf, P)];
    pegOf[d] = a;
    if (v === here - 1) return [a, b];
  }
  return null;
}

export const isSolved = (pegOf, goal) => pegOf.every((p) => p === goal);

// The textbook recursion for three pegs, as a list of [disc, from, to, depth]. Used to explain and to cross-check.
export function recursivePlan(n, from, to, spare, depth = 0, out = []) {
  if (n === 0) return out;
  recursivePlan(n - 1, from, spare, to, depth + 1, out);
  out.push([n - 1, from, to, depth]);
  recursivePlan(n - 1, spare, to, from, depth + 1, out);
  return out;
}

export const classicMoves = (n) => 2 ** n - 1;
