// Engine: the sequence box. A box has N sliding panels. Panel i has k[i] resting places (0 .. k[i]-1) along its track and moves
// one place at a time. Each step of a panel (place t <-> t+1) can be held by a CATCH: it only lets go while another panel j rests
// in one of an allowed set of places (a bit mask). The box starts with every panel at place 0 and opens when every panel rests on its
// goal place. The state graph is small enough to search whole, so the shortest solution (par), the next move from ANY position and
// "how far from open" are exact. Pure and deterministic: no clocks, no global randomness.

export function seeded(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n) };
}

// data: { k:[], f:[face per panel], g:[[0|[j,mask] per step] per panel], goal:[], par }
export function makeBox(data) {
  const n = data.k.length, mul = [];
  let total = 1;
  for (let i = 0; i < n; i++) { mul.push(total); total *= data.k[i]; }
  const gates = data.g.map((row) => row.map((c) => (c ? { j: c[0], mask: c[1] } : null)));
  return { n, k: data.k.slice(), face: data.f.slice(), gates, goal: data.goal.slice(), par: data.par, mul, total, dist: null, faces: Math.max(...data.f) + 1 };
}
export const startPos = (B) => new Array(B.n).fill(0);
export const indexOf = (B, pos) => { let x = 0; for (let i = 0; i < B.n; i++) x += pos[i] * B.mul[i]; return x; };
export const isOpen = (B, pos) => { for (let i = 0; i < B.n; i++) if (pos[i] !== B.goal[i]) return false; return true; };

// Can panel i step by dir (-1 / +1) from where it rests? { ok, to } or { ok:false, by: the panel holding the catch, end: true when at the end of its track }.
export function tryMove(B, pos, i, dir) {
  const p = pos[i], np = p + dir;
  if (np < 0 || np >= B.k[i]) return { ok: false, end: true, by: -1 };
  const g = B.gates[i][Math.min(p, np)];
  if (g && !((g.mask >> pos[g.j]) & 1)) return { ok: false, end: false, by: g.j };
  return { ok: true, to: np };
}

// Breadth-first distances over the whole state graph from one state. Int16Array, -1 = unreachable.
export function bfs(k, gates, src) {
  const n = k.length, mul = [];
  let total = 1;
  for (let i = 0; i < n; i++) { mul.push(total); total *= k[i]; }
  const dist = new Int16Array(total).fill(-1), q = new Int32Array(total), pos = new Int8Array(n);
  let h = 0, t = 0, far = src;
  dist[src] = 0; q[t++] = src;
  while (h < t) {
    const s = q[h++], d = dist[s];
    if (d > dist[far]) far = s;
    let x = s;
    for (let i = 0; i < n; i++) { pos[i] = x % k[i]; x = (x - pos[i]) / k[i]; }
    for (let i = 0; i < n; i++) {
      const p = pos[i];
      for (let dir = -1; dir <= 1; dir += 2) {
        const np = p + dir;
        if (np < 0 || np >= k[i]) continue;
        const g = gates[i][p < np ? p : np];
        if (g && !((g.mask >> pos[g.j]) & 1)) continue;
        const ns = s + dir * mul[i];
        if (dist[ns] < 0) { dist[ns] = d + 1; q[t++] = ns; }
      }
    }
  }
  return { dist, far, reach: t, total, mul };
}

// Distance of every state to the goal (the box is reversible, so this is the same graph walked from the goal).
export function distances(B) {
  if (!B.dist) B.dist = bfs(B.k, B.gates, indexOf(B, B.goal)).dist;
  return B.dist;
}
export const distLeft = (B, pos) => distances(B)[indexOf(B, pos)];

// The next move of a shortest way open from here: { i, dir, left } or null when already open.
export function bestMove(B, pos) {
  const d = distances(B), here = d[indexOf(B, pos)];
  if (here <= 0) return null;
  let best = null;
  for (let i = 0; i < B.n && !best; i++) {
    for (const dir of [1, -1]) {
      const m = tryMove(B, pos, i, dir);
      if (!m.ok) continue;
      if (d[indexOf(B, pos) + dir * B.mul[i]] === here - 1) { best = { i, dir, left: here }; break; }
    }
  }
  return best;
}

// Why does this move matter? The panel it frees next: the first panel on the shortest way whose catch needs this panel's new place.
export function explainMove(B, pos, mv) {
  const p = pos.slice(); p[mv.i] += mv.dir;
  const m2 = bestMove(B, p);
  if (!m2) return { opens: true };
  const g = B.gates[m2.i][Math.min(p[m2.i], p[m2.i] + m2.dir)];
  if (g && g.j === mv.i) return { frees: m2.i };
  return { frees: -1 };
}

// ---- generation (used offline by design/gen-levels.mjs, and at runtime for the Daily Box) -----------------------------------------
function randomGate(B, i, r) {
  let j = r.int(B.n - 1); if (j >= i) j += 1;
  let mask = 0;
  const cnt = 1 + r.int(Math.max(1, B.k[j] - 1)), st = r.int(B.k[j]);
  for (let c = 0; c < cnt; c++) mask |= 1 << ((st + c) % B.k[j]);
  if (mask === (1 << B.k[j]) - 1) mask &= ~(1 << r.int(B.k[j]));
  return [j, mask];
}
export function randomGates(k, density, r) {
  const B = { n: k.length, k };
  return k.map((ki, i) => Array.from({ length: ki - 1 }, () => (r.next() < density ? randomGate(B, i, r) : 0)));
}
function mutate(k, g, r) {
  const n = k.length, out = g.map((row) => row.slice()), i = r.int(n), t = r.int(k[i] - 1);
  out[i][t] = r.int(3) === 0 ? 0 : randomGate({ n, k }, i, r);
  return out;
}
const toGates = (g) => g.map((row) => row.map((c) => (c ? { j: c[0], mask: c[1] } : null)));
// Score a gate table: how far the closed box is from the goal state, and which state is the goal. The goal is a state near the far end
// (within 3 moves of the maximum) that has the most panels away from place 0, so the finished box visibly differs from the closed one.
export function measure(k, g) {
  const r = bfs(k, toGates(g), 0), dmax = r.dist[r.far], lo = Math.max(dmax - 3, Math.floor(dmax * 0.9));
  let best = r.far, bestKey = -1, bestAway = 0;
  for (let s = 0; s < r.total; s++) {
    const d = r.dist[s];
    if (d < lo) continue;
    let x = s, away = 0;
    for (let i = 0; i < k.length; i++) { if (x % k[i] !== 0) away += 1; x = Math.floor(x / k[i]); }
    const key = away * 1000 + d;
    if (key > bestKey) { bestKey = key; best = s; bestAway = away; }
  }
  const goal = []; let x = best;
  for (let i = 0; i < k.length; i++) { goal.push(x % k[i]); x = Math.floor(x / k[i]); }
  return { d: r.dist[best], goal, reach: r.reach, total: r.total, away: bestAway };
}
// Hill-climb the catches until the closed box needs between `target` and `target + slack` moves.
export function climb(k, target, seed, { iters = 400, slack = 4, density = 0.7 } = {}) {
  const r = seeded(seed);
  let g = randomGates(k, density, r), m = measure(k, g);
  const score = (d) => (d <= target ? d : target - (d - target) * 1.5);
  for (let it = 0; it < iters && !(m.d >= target && m.d <= target + slack && m.away >= Math.ceil(k.length * 0.75)); it++) {
    const g2 = mutate(k, g, r), m2 = measure(k, g2);
    if (score(m2.d) >= score(m.d)) { g = g2; m = m2; }
  }
  return { g, ...m };
}
