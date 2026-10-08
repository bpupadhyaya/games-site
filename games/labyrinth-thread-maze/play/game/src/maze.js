// Labyrinth maze engine: generation, search and the teaching analysis. Pure and deterministic (own seeded PRNG; no clock).
// A maze is plain data: { id, cols, rows, o, start, goal, door, grade }. o[i] holds the open sides of cell i (N=1, E=2, S=4, W=8).
export const N = 1, E = 2, S = 4, W = 8;
export const DX = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 }, DY = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };
export const OPP = { [N]: S, [E]: W, [S]: N, [W]: E };
export const DIRS = [N, E, S, W];
export const DIR_NAME = { [N]: 'up', [E]: 'right', [S]: 'down', [W]: 'left' };

// name, size, loop fraction, fog torch radius (0 = whole maze visible), cells visible across the board (0 = fit all)
export const GRADES = [
  null,
  { name: 'Courtyard', n: 7, loops: 0, torch: 0, view: 0, tag: 'Small and open', text: 'A seven by seven court. Every corridor is in view. One route to the heart.' },
  { name: 'Gallery', n: 10, loops: 0, torch: 0, view: 0, tag: 'Longer corridors', text: 'Ten by ten with long winding galleries and more dead ends. Still fully lit.' },
  { name: 'Passage', n: 14, loops: 0.03, torch: 0, view: 0, tag: 'Plan ahead', text: 'Fourteen by fourteen. A few loops give a second way round. Trace the route before you move.' },
  { name: 'Halls', n: 18, loops: 0.08, torch: 0, view: 0, tag: 'Loops and forks', text: 'Eighteen by eighteen with many loops. Several routes reach the heart; one is shortest.' },
  { name: 'Deep Halls', n: 24, loops: 0.07, torch: 5, view: 15, tag: 'Torchlight only', text: 'Twenty-four by twenty-four in darkness. Your lamp lights the corridors it can reach; the map remembers.' },
  { name: 'Great Labyrinth', n: 30, loops: 0.06, torch: 4, view: 13, tag: 'The deep end', text: 'Thirty by thirty with a narrow torch. Remember where you have been.' },
];

// ---- seeded PRNG (mulberry32) ----------------------------------------------------------------------------------------------------
export function prng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n) };
}

export const cellX = (m, i) => i % m.cols;
export const cellY = (m, i) => Math.floor(i / m.cols);
export function step(m, i, d) { const x = cellX(m, i) + DX[d], y = cellY(m, i) + DY[d]; return x < 0 || y < 0 || x >= m.cols || y >= m.rows ? -1 : y * m.cols + x; }
export function exits(m, i) { const out = []; for (const d of DIRS) if (m.o[i] & d) out.push(step(m, i, d)); return out; }
export const openCount = (m, i) => { let n = 0; for (const d of DIRS) if (m.o[i] & d) n += 1; return n; };
export function dirBetween(m, a, b) { for (const d of DIRS) if (step(m, a, d) === b) return d; return 0; }

export function bfs(m, from) {
  const dist = new Int32Array(m.cols * m.rows).fill(-1), prev = new Int32Array(m.cols * m.rows).fill(-1), q = [from];
  dist[from] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    for (const d of DIRS) if (m.o[c] & d) { const n = step(m, c, d); if (dist[n] < 0) { dist[n] = dist[c] + 1; prev[n] = c; q.push(n); } }
  }
  return { dist, prev };
}
// Shortest path a -> b as a list of cells including both ends (null if unreachable).
export function pathBetween(m, a, b, limit = 1e9) {
  if (a === b) return [a];
  const prev = new Map([[a, -1]]), q = [a], depth = new Map([[a, 0]]);
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    if (depth.get(c) >= limit) continue;
    for (const d of DIRS) if (m.o[c] & d) {
      const n = step(m, c, d);
      if (prev.has(n)) continue;
      prev.set(n, c); depth.set(n, depth.get(c) + 1); q.push(n);
      if (n === b) { const out = [b]; let k = b; while (prev.get(k) !== a) { k = prev.get(k); out.push(k); } out.push(a); return out.reverse(); }
    }
  }
  return null;
}

export function generate(seed, grade) {
  const G = GRADES[grade], n = G.n, rnd = prng(seed * 2654435761 + grade * 97 + 11), m = { id: `${seed}-${grade}`, cols: n, rows: n, o: new Array(n * n).fill(0), start: 0, goal: 0, door: N, grade, seed };
  // recursive backtracker: long winding corridors
  const seen = new Uint8Array(n * n), stack = [rnd.int(n * n)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const c = stack[stack.length - 1], opts = [];
    for (const d of DIRS) { const k = step(m, c, d); if (k >= 0 && !seen[k]) opts.push(d); }
    if (!opts.length) { stack.pop(); continue; }
    const d = opts[rnd.int(opts.length)], k = step(m, c, d);
    m.o[c] |= d; m.o[k] |= OPP[d]; seen[k] = 1; stack.push(k);
  }
  // loops: open some walls so there is more than one route
  if (G.loops > 0) {
    const want = Math.round(n * n * G.loops);
    let made = 0;
    for (let tries = 0; tries < want * 30 && made < want; tries++) {
      const c = rnd.int(n * n), d = DIRS[rnd.int(4)], k = step(m, c, d);
      if (k < 0 || (m.o[c] & d)) continue;
      m.o[c] |= d; m.o[k] |= OPP[d]; made += 1;
    }
  }
  m.goal = Math.floor(n / 2) * n + Math.floor(n / 2);
  // the entrance: the outer cell farthest from the heart
  const { dist } = bfs(m, m.goal);
  let best = -1, bi = 0;
  for (let i = 0; i < n * n; i++) {
    const x = i % n, y = Math.floor(i / n);
    if ((x === 0 || y === 0 || x === n - 1 || y === n - 1) && dist[i] > best) { best = dist[i]; bi = i; }
  }
  m.start = bi;
  const x = bi % n, y = Math.floor(bi / n);
  m.door = y === n - 1 ? S : x === 0 ? W : x === n - 1 ? E : N;
  m.opt = best;
  return m;
}

// ---- torchlight ------------------------------------------------------------------------------------------------------------------
// Light flows down open corridors from the lamp, `radius` steps deep. Returns a Map cell -> steps from the lamp.
export function lightFrom(m, from, radius) {
  const out = new Map([[from, 0]]), q = [from];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], d0 = out.get(c);
    if (d0 >= radius) continue;
    for (const d of DIRS) if (m.o[c] & d) { const k = step(m, c, d); if (!out.has(k)) { out.set(k, d0 + 1); q.push(k); } }
  }
  return out;
}

// ---- teaching analysis -------------------------------------------------------------------------------------------------------------
// Look down the branch that leaves fork `j` through cell `n` (without passing back through j).
export function branchInfo(m, j, n, goalDist) {
  const seen = new Set([j, n]), q = [n];
  let hasGoal = false, loops = false;
  const jn = new Set(exits(m, j));
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    if (c === m.goal) hasGoal = true;
    for (const k of exits(m, c)) {
      if (k === j) { if (c !== n) loops = true; continue; }
      if (c !== n && jn.has(k) && k !== n) loops = true;
      if (!seen.has(k)) { seen.add(k); q.push(k); }
    }
  }
  const size = seen.size - 1;
  const onRoute = goalDist && goalDist[n] < goalDist[j];
  return { size, hasGoal, loops, onRoute: !!onRoute, kind: onRoute ? 'route' : hasGoal ? 'longer' : loops ? 'loop' : 'dead' };
}

export function describeFork(m, j, from, goalDist) {
  const rows = [];
  for (const d of DIRS) if (m.o[j] & d) {
    const n = step(m, j, d);
    if (n === from) continue;
    rows.push({ d, name: DIR_NAME[d], cell: n, ...branchInfo(m, j, n, goalDist) });
  }
  return rows;
}
export function branchText(r) {
  if (r.kind === 'route') return `${r.name}: the shortest way to the heart`;
  if (r.kind === 'longer') return `${r.name}: also reaches the heart, but the long way round`;
  if (r.kind === 'loop') return `${r.name}: circles back to this fork`;
  return `${r.name}: a dead end after ${r.size} ${r.size === 1 ? 'cell' : 'cells'}`;
}

// Cells on the route from `from`, in order, up to and including the next fork (or the goal). Used by hints and Watch and Learn.
export function nextForkOnRoute(m, route, idx) {
  for (let i = idx + 1; i < route.length; i++) if (route[i] === m.goal || openCount(m, route[i]) >= 3) return i;
  return route.length - 1;
}
