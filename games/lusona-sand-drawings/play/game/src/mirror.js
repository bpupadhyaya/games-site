// Engine: sand-line mirror curves. A W x H field of cells; every cell holds one mirror, "/" (0) or "\" (1).
// The sand line enters a cell through the middle of one side and leaves through the neighbouring side after bouncing off the mirror,
// so every arc wraps one corner dot. The outer edge pairs neighbouring side-middles round the border dots. The line therefore
// always closes up; the puzzle is to set the mirrors so that ALL of it is ONE closed line round the dots.
// Pure and deterministic: no clocks, no global randomness (a seeded generator is passed in).

// Side-middle ids: horizontal edge h(r,c) (r 0..H, c 0..W-1) and vertical edge v(r,c) (r 0..H-1, c 0..W).
export const nodeCount = (W, H) => (H + 1) * W + H * (W + 1);
const hId = (W, r, c) => r * W + c;
const vId = (W, H, r, c) => (H + 1) * W + r * (W + 1) + c;

export function seeded(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n) };
}

const topoCache = new Map();
// Fixed wiring of a field size: for each cell the four side ids, and the border pairs.
export function topo(W, H) {
  const key = `${W}x${H}`;
  let t = topoCache.get(key);
  if (t) return t;
  const sides = [];   // per cell: [N, S, Wst, E]
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) sides.push([hId(W, r, c), hId(W, r + 1, c), vId(W, H, r, c), vId(W, H, r, c + 1)]);
  const peri = [];    // border side-middles in clockwise order from the top-left, with the position each sits at
  for (let c = 0; c < W; c++) peri.push(hId(W, 0, c));
  for (let r = 0; r < H; r++) peri.push(vId(W, H, r, W));
  for (let c = W - 1; c >= 0; c--) peri.push(hId(W, H, c));
  for (let r = H - 1; r >= 0; r--) peri.push(vId(W, H, r, 0));
  const pairs = [];
  // Offset by one so every border dot (a corner or a lattice point with row + column even) is wrapped from outside.
  const P = peri.length;
  for (let i = 1; i < P; i += 2) pairs.push([peri[i], peri[(i + 1) % P]]);
  t = { W, H, n: nodeCount(W, H), sides, peri, pairs };
  topoCache.set(key, t);
  return t;
}

// Dots sit on the lattice points whose row + column is even. A tile whose mirror wraps two of its corners wraps dots when
// mirror === (row + column) % 2; otherwise the mirror runs through two dots as a strut that joins them. One line round
// everything means the struts join all dots into one tree.
export const isDot = (r, c) => (r + c) % 2 === 0;
export const strutOf = (W, i, v) => { const r = Math.floor(i / W), c = i % W; return v !== (r + c) % 2; };
// Which two side pairs does a mirror connect? "/" joins N-W and S-E; "\" joins N-E and S-W.
export const LINKS = [[[0, 2], [1, 3]], [[0, 3], [1, 2]]];

// Follow the line(s): returns { loops, comp (per node), count }.
export function trace(W, H, cfg) {
  const T = topo(W, H), adj = new Array(T.n * 2).fill(-1), deg = new Uint8Array(T.n);
  const link = (a, b) => { adj[a * 2 + deg[a]++] = b; adj[b * 2 + deg[b]++] = a; };
  for (let i = 0; i < W * H; i++) { const s = T.sides[i]; for (const [a, b] of LINKS[cfg[i]]) link(s[a], s[b]); }
  for (const [a, b] of T.pairs) link(a, b);
  const comp = new Int32Array(T.n).fill(-1);
  let count = 0;
  for (let n = 0; n < T.n; n++) {
    if (comp[n] >= 0) continue;
    let prev = -1, cur = n;
    while (comp[cur] < 0) {
      comp[cur] = count;
      const a = adj[cur * 2], b = adj[cur * 2 + 1], nx = a !== prev || a === b ? a : b;
      prev = cur; cur = nx === prev ? b : nx;
    }
    count += 1;
  }
  return { count, comp };
}
export const loopCount = (W, H, cfg) => trace(W, H, cfg).count;

// Ordered point list of every loop, as side-middle ids (for drawing the moving highlight along the line).
export function walk(W, H, cfg) {
  const T = topo(W, H), adj = new Array(T.n * 2).fill(-1), deg = new Uint8Array(T.n);
  const link = (a, b) => { adj[a * 2 + deg[a]++] = b; adj[b * 2 + deg[b]++] = a; };
  for (let i = 0; i < W * H; i++) { const s = T.sides[i]; for (const [a, b] of LINKS[cfg[i]]) link(s[a], s[b]); }
  for (const [a, b] of T.pairs) link(a, b);
  const seen = new Uint8Array(T.n), loops = [];
  for (let n = 0; n < T.n; n++) {
    if (seen[n]) continue;
    const path = [];
    let prev = -1, cur = n;
    while (!seen[cur]) {
      seen[cur] = 1; path.push(cur);
      const a = adj[cur * 2], b = adj[cur * 2 + 1];
      const nx = a !== prev ? a : b;
      prev = cur; cur = nx;
    }
    loops.push(path);
  }
  return loops;
}

// ---- level generation -----------------------------------------------------------------------------------------------------
// Symmetry groups of cell indices: flipping a whole group keeps a symmetric drawing symmetric.
function groups(W, H, kind) {
  const idx = (r, c) => r * W + c, seen = new Set(), out = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const i = idx(r, c);
    if (seen.has(i)) continue;
    const g = new Set([i]);
    if (kind === 'lr' || kind === 'both') g.add(idx(r, W - 1 - c));
    if (kind === 'ud' || kind === 'both') g.add(idx(H - 1 - r, c));
    if (kind === 'both') g.add(idx(H - 1 - r, W - 1 - c));
    if (kind === 'turn') g.add(idx(H - 1 - r, W - 1 - c));
    for (const k of g) seen.add(k);
    out.push([...g]);
  }
  return out;
}
function applySym(W, H, kind, grp, base) {
  // set the group so the picture is symmetric: left-right and up-down reflections flip the slash, a half turn keeps it
  const out = [];
  for (const i of grp) {
    const r = Math.floor(i / W), c = i % W, [r0, c0] = [Math.floor(grp[0] / W), grp[0] % W];
    let v = base;
    if (kind === 'lr') v = c === c0 ? base : 1 - base;
    else if (kind === 'ud') v = r === r0 ? base : 1 - base;
    else if (kind === 'both') { const f = (r !== r0 ? 1 : 0) + (c !== c0 ? 1 : 0); v = f % 2 ? 1 - base : base; }
    else if (kind === 'turn') v = base;
    out.push([i, v]);
  }
  return out;
}
export const SYMS = ['none', 'turn'];

// Find a configuration that is ONE closed line. Returns an array of 0/1 or null.
export function findSingle(W, H, rnd, sym = 'none', budget = 4000) {
  const grp = sym === 'none' ? Array.from({ length: W * H }, (_, i) => [i]) : groups(W, H, sym);
  for (let attempt = 0; attempt < (sym === 'none' ? 12 : 4); attempt++) {
    const cfg = new Array(W * H).fill(0);
    const set = (g, base) => { for (const [i, v] of (sym === 'none' ? [[g[0], base]] : applySym(W, H, sym, g, base))) cfg[i] = v; };
    grp.forEach((g) => set(g, rnd.int(2)));
    let cur = loopCount(W, H, cfg);
    for (let step = 0; step < budget / 8 && cur > 1; step++) {
      const g = grp[rnd.int(grp.length)];
      for (const i of g) cfg[i] = 1 - cfg[i];
      const n = loopCount(W, H, cfg);
      if (n <= cur || rnd.next() < 0.02) cur = n; else for (const i of g) cfg[i] = 1 - cfg[i];
    }
    if (cur === 1) return cfg;
  }
  return null;
}

// A level = { W, H, start, locked (0/1 per cell), sol, par, sym }.
export function makeLevel(W, H, seed, { flips = 4, locks = 0, sym = 'none' } = {}) {
  const rnd = seeded(seed * 7919 + W * 131 + H * 17 + 5);
  let sol = null, used = sym;
  if (sym !== 'none') sol = findSingle(W, H, rnd, sym);
  if (!sol) { used = 'none'; for (let tries = 0; tries < 6 && !sol; tries++) sol = findSingle(W, H, rnd, 'none'); }
  if (!sol) return null;
  const N = W * H, order = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) { const j = rnd.int(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  let start = null, k = Math.min(flips, N - 1), picked = [];
  for (let t = 0; t < 40; t++) {
    const pool = order.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = rnd.int(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    picked = pool.slice(0, k);
    const cfg = sol.slice();
    for (const i of picked) cfg[i] = 1 - cfg[i];
    if (loopCount(W, H, cfg) > 1) { start = cfg; break; }
    if (t > 20 && k < N - 1) k += 1;
  }
  if (!start) return null;
  const locked = new Array(N).fill(0), pickedSet = new Set(picked);
  const free = order.filter((i) => !pickedSet.has(i));
  for (const i of free.slice(0, Math.min(locks, free.length))) locked[i] = 1;
  return { W, H, start, locked, sol, par: picked.length, sym: used };
}

// Single-flip move; honours locks. Returns false when the cell cannot be turned.
export function flip(L, cfg, i) { if (L.locked[i]) return false; cfg[i] = 1 - cfg[i]; return true; }

// The most useful next turn: a free cell that differs from the known answer; prefer the one that leaves the fewest loops.
export function hintFor(L, cfg) {
  const base = loopCount(L.W, L.H, cfg);
  let best = null;
  for (let i = 0; i < cfg.length; i++) {
    if (cfg[i] === L.sol[i] || L.locked[i]) continue;
    cfg[i] = 1 - cfg[i];
    const n = loopCount(L.W, L.H, cfg);
    cfg[i] = 1 - cfg[i];
    if (!best || n < best.after || (n === best.after && i < best.cell)) best = { cell: i, before: base, after: n };
  }
  return best;
}
