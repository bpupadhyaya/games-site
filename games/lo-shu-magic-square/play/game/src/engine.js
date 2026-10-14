// Lo Shu Magic Square engine: pure and deterministic. Lines, sums, solver, hints, symmetries.
// A puzzle is { n, nums (sorted, n*n numbers), pan (broken diagonals count too), M, givens[n*n] (0 = empty), sol[n*n] }.
// Cells are indexed r * n + c.

export const VARIANTS = {
  loshu: { name: 'Lo Shu', n: 3, pan: false },
  shift3: { name: 'Shifted Stones', n: 3, pan: false },
  four: { name: 'Four Gates', n: 4, pan: false },
  pan4: { name: 'Crossing Diagonals', n: 4, pan: true },
  five: { name: 'Five Winds', n: 5, pan: false },
  pan5: { name: 'Endless Weave', n: 5, pan: true },
};

export const numsOf = (n, lo = 1, d = 1) => Array.from({ length: n * n }, (_, k) => lo + d * k);
export const magicConst = (nums, n) => nums.reduce((a, b) => a + b, 0) / n;

const cache = new Map();
// Every line that must add up to M. kind: row | col | diag (down-right) | anti (up-right) | bdiag | banti (broken, pandiagonal only).
export function linesFor(n, pan) {
  const key = `${n}|${pan ? 1 : 0}`;
  let L = cache.get(key);
  if (L) return L;
  L = [];
  for (let r = 0; r < n; r++) L.push({ kind: 'row', idx: r, cells: Array.from({ length: n }, (_, c) => r * n + c) });
  for (let c = 0; c < n; c++) L.push({ kind: 'col', idx: c, cells: Array.from({ length: n }, (_, r) => r * n + c) });
  if (!pan) {
    L.push({ kind: 'diag', idx: 0, cells: Array.from({ length: n }, (_, i) => i * n + i) });
    L.push({ kind: 'anti', idx: 0, cells: Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)) });
  } else {
    // b: cells (r, (r + b) mod n), labelled above column b.  a: cells (r, (a - r) mod n), labelled left of row a.
    for (let b = 0; b < n; b++) L.push({ kind: b === 0 ? 'diag' : 'bdiag', idx: b, cells: Array.from({ length: n }, (_, r) => r * n + ((r + b) % n)) });
    for (let a = 0; a < n; a++) L.push({ kind: a === n - 1 ? 'anti' : 'banti', idx: a, cells: Array.from({ length: n }, (_, r) => r * n + ((((a - r) % n) + n) % n)) });
  }
  L.forEach((l, i) => { l.id = i; });
  const of = Array.from({ length: n * n }, () => []);
  L.forEach((l) => l.cells.forEach((c) => of[c].push(l.id)));
  L.of = of;
  cache.set(key, L);
  return L;
}

export const makePuzzle = (n, nums, pan, givens, sol) => ({ n, nums, pan, M: magicConst(nums, n), givens, sol });

export function lineName(l, n) {
  const ord = (i) => ['first', 'second', 'third', 'fourth', 'fifth'][i];
  switch (l.kind) {
    case 'row': return n === 3 ? ['top row', 'middle row', 'bottom row'][l.idx] : `${ord(l.idx)} row`;
    case 'col': return n === 3 ? ['left column', 'middle column', 'right column'][l.idx] : `${ord(l.idx)} column`;
    case 'diag': return 'main diagonal (top left to bottom right)';
    case 'anti': return 'other diagonal (top right to bottom left)';
    case 'bdiag': return `broken diagonal starting above column ${l.idx + 1}`;
    default: return `broken diagonal starting beside row ${l.idx + 1}`;
  }
}
export const cellName = (i, n) => `row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}`;

// ---- sums and checks --------------------------------------------------------------------------------------------------
export function lineStats(P, grid) {
  const L = linesFor(P.n, P.pan);
  return L.map((l) => { let s = 0, e = 0; for (const c of l.cells) { if (grid[c]) s += grid[c]; else e += 1; } return { id: l.id, sum: s, empty: e, ok: e === 0 && s === P.M, over: s > P.M || (e === 0 && s !== P.M) }; });
}
export const isSolved = (P, grid) => { for (let i = 0; i < grid.length; i++) if (!grid[i]) return false; return lineStats(P, grid).every((s) => s.ok); };
export function usedSet(grid) { const s = new Set(); for (const v of grid) if (v) s.add(v); return s; }

// ---- feasibility (does a number still fit a cell) ----------------------------------------------------------------------------
// Exact: after putting v in cell, every line through the cell must still be completable with distinct unused numbers.
function canSum(vals, k, target) {
  if (k === 0) return target === 0;
  if (k > vals.length) return false;
  // dp[j] = set of reachable sums with j numbers
  const dp = Array.from({ length: k + 1 }, () => new Set());
  dp[0].add(0);
  for (const v of vals) for (let j = k; j >= 1; j--) for (const s of dp[j - 1]) dp[j].add(s + v);
  return dp[k].has(target);
}
export function candidates(P, grid, cell) {
  const L = linesFor(P.n, P.pan), used = usedSet(grid), free = P.nums.filter((v) => !used.has(v)), out = [];
  for (const v of free) {
    let ok = true;
    for (const id of L.of[cell]) {
      const l = L[id];
      let s = 0, e = 0;
      for (const c of l.cells) { if (c === cell) continue; if (grid[c]) s += grid[c]; else e += 1; }
      if (!canSum(free.filter((x) => x !== v), e, P.M - s - v)) { ok = false; break; }
    }
    if (ok) out.push(v);
  }
  return out;
}

// ---- counting solver (used by the generator and the verification test) -------------------------------------------------------------------
export function countSolutions(P, limit = 2, budget = 4e6) {
  const n = P.n, N = n * n, L = linesFor(n, P.pan), M = P.M, nums = P.nums;
  const g = P.givens.slice(), idx = new Map(nums.map((v, i) => [v, i]));
  const usedN = new Array(N).fill(false), sum = new Array(L.length).fill(0), emp = new Array(L.length).fill(0);
  for (const l of L) emp[l.id] = n;
  for (let i = 0; i < N; i++) if (g[i]) { const k = idx.get(g[i]); if (usedN[k]) return 0; usedN[k] = true; for (const id of L.of[i]) { sum[id] += g[i]; emp[id] -= 1; } }
  for (const l of L) { if (sum[l.id] > M || (emp[l.id] === 0 && sum[l.id] !== M)) return 0; }
  let found = 0, nodes = 0;
  const fits = (v, cell) => {
    for (const id of L.of[cell]) {
      const s = sum[id] + v, e = emp[id] - 1;
      if (e === 0) { if (s !== M) return false; continue; }
      const need = M - s;
      if (need <= 0) return false;
      if (e === 1) { const k = idx.get(need); if (k === undefined || usedN[k] || need === v) return false; continue; }
      let lo = 0, hi = 0, a = 0, b = N - 1, c1 = e, c2 = e;
      while (c1 > 0 && a < N) { if (!usedN[a] && nums[a] !== v) { lo += nums[a]; c1 -= 1; } a += 1; }
      while (c2 > 0 && b >= 0) { if (!usedN[b] && nums[b] !== v) { hi += nums[b]; c2 -= 1; } b -= 1; }
      if (c1 > 0 || need < lo || need > hi) return false;
    }
    return true;
  };
  const rec = () => {
    if (found >= limit || nodes > budget) return;
    nodes += 1;
    let best = -1, bestList = null;
    for (let i = 0; i < N; i++) {
      if (g[i]) continue;
      const list = [];
      for (let k = 0; k < N; k++) if (!usedN[k] && fits(nums[k], i)) list.push(k);
      if (!list.length) return;
      if (!bestList || list.length < bestList.length) { best = i; bestList = list; if (list.length === 1) break; }
    }
    if (best < 0) { found += 1; return; }
    for (const k of bestList) {
      const v = nums[k];
      g[best] = v; usedN[k] = true;
      for (const id of L.of[best]) { sum[id] += v; emp[id] -= 1; }
      rec();
      for (const id of L.of[best]) { sum[id] -= v; emp[id] += 1; }
      g[best] = 0; usedN[k] = false;
      if (found >= limit) return;
    }
  };
  rec();
  return found;
}

// ---- symmetries ------------------------------------------------------------------------------------------------------------------------
// t in 0..7: bit0 transpose, bit1 flip rows, bit2 flip columns. comp: replace each number by its mirror in the set. dr/dc: torus shift (pandiagonal only).
export function transformGrid(arr, n, t, dr = 0, dc = 0) {
  const out = new Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    let rr = r, cc = c;
    if (t & 1) { const x = rr; rr = cc; cc = x; }
    if (t & 2) rr = n - 1 - rr;
    if (t & 4) cc = n - 1 - cc;
    rr = (rr + dr) % n; cc = (cc + dc) % n;
    out[rr * n + cc] = arr[r * n + c];
  }
  return out;
}
export function transformPuzzle(P, t, comp, dr = 0, dc = 0) {
  const n = P.n, top = P.nums[P.nums.length - 1] + P.nums[0], f = (a) => transformGrid(a, n, t, P.pan ? dr : 0, P.pan ? dc : 0).map((v) => (v && comp ? top - v : v));
  return makePuzzle(n, P.nums, P.pan, f(P.givens), f(P.sol));
}

// ---- puzzles from library entries ------------------------------------------------------------------------------------------------------------
// entry: { v: variant id, n, lo, d, g: '0101..' givens mask, s: rank letters of the solution }
export function fromEntry(e) {
  const nums = numsOf(e.n, e.lo, e.d), N = e.n * e.n;
  const sol = Array.from({ length: N }, (_, i) => nums[e.s.charCodeAt(i) - 97]);
  const givens = Array.from({ length: N }, (_, i) => (e.g[i] === '1' ? sol[i] : 0));
  return makePuzzle(e.n, nums, VARIANTS[e.v].pan, givens, sol);
}

// ---- hints ---------------------------------------------------------------------------------------------------------------------------------------
// The next teachable step for the player's current grid. Always starts by flagging a wrong stone (compared with the one solution).
export function wrongCells(P, grid) { const out = []; for (let i = 0; i < grid.length; i++) if (grid[i] && grid[i] !== P.sol[i]) out.push(i); return out; }

export function findHint(P, grid) {
  const n = P.n, L = linesFor(n, P.pan), M = P.M, N = n * n, S = lineStats(P, grid);
  const bad = wrongCells(P, grid);
  if (bad.length) {
    const c = bad[0], v = grid[c];
    const over = L.of[c].map((id) => L[id]).find((l) => S[l.id].over || S[l.id].empty === 0 && S[l.id].sum !== M);
    const why = over ? `The ${v} at ${cellName(c, n)} cannot be right: the ${lineName(over, n)} would add to ${S[over.id].sum} instead of ${M}.` : `The ${v} at ${cellName(c, n)} cannot be right: the only square that works puts a different stone there.`;
    return { tech: 'mistake', name: 'Something is off', cell: c, value: 0, lines: over ? [over.id] : L.of[c].slice(), focus: [c], look: `Look at ${cellName(c, n)}.`, why };
  }
  const used = usedSet(grid), free = P.nums.filter((v) => !used.has(v));
  if (!free.length) return null;
  // 1. a line with a single empty cell
  let best = null;
  for (const l of L) {
    const st = S[l.id];
    if (st.empty === 1 && (!best || st.sum > S[best.id].sum)) best = l;
  }
  if (best) {
    const cell = best.cells.find((c) => !grid[c]), v = M - S[best.id].sum, filled = best.cells.filter((c) => grid[c]).map((c) => grid[c]);
    return { tech: 'last-in-line', name: 'One tile left in a line', cell, value: v, lines: [best.id], focus: [cell], look: `The ${lineName(best, n)} has only one empty tile. Which number completes it?`, why: `The ${lineName(best, n)} already holds ${filled.join(' + ')} = ${S[best.id].sum}. It must reach ${M}, so the missing stone is ${M} - ${S[best.id].sum} = ${v}.` };
  }
  // 2. the heart of a 3x3: the four lines through the middle
  if (n === 3 && !P.pan && !grid[4]) {
    const total = P.nums.reduce((a, b) => a + b, 0), v = (4 * M - total) / 3;
    if (Number.isInteger(v)) return { tech: 'centre', name: 'The middle tile', cell: 4, value: v, lines: [1, 4, 6, 7], focus: [4], look: 'Look at the middle tile: four lines pass through it, the middle row, the middle column and both diagonals.', why: `Those four lines together use every number once, plus the middle tile three extra times. So 4 x ${M} = ${total} + 3 x middle, which gives a middle of ${v}.` };
  }
  // 3. a cell with exactly one number that can still fit
  let cellBest = null, candBest = null;
  for (let c = 0; c < N; c++) {
    if (grid[c]) continue;
    const cand = candidates(P, grid, c);
    if (cand.length === 1) { cellBest = c; candBest = cand; break; }
  }
  if (cellBest !== null) {
    const v = candBest[0], c = cellBest;
    const tight = L.of[c].map((id) => L[id]).sort((a, b) => S[a.id].empty - S[b.id].empty)[0];
    return { tech: 'only-fit', name: 'Only one stone fits', cell: c, value: v, lines: L.of[c].slice(), focus: [c], look: `Try the unused stones at ${cellName(c, n)}. The ${lineName(tight, n)} still needs ${S[tight.id].empty} stones adding to ${M - S[tight.id].sum}.`, why: `Every other unused stone would push one of the lines through ${cellName(c, n)} past ${M} or leave it unable to reach ${M}. Only ${v} works here.` };
  }
  // 4. a stone with exactly one place left
  for (const v of free) {
    const spots = [];
    for (let c = 0; c < N; c++) if (!grid[c] && candidates(P, grid, c).includes(v)) spots.push(c);
    if (spots.length === 1) {
      const c = spots[0];
      return { tech: 'only-place', name: 'Only one place for it', cell: c, value: v, lines: L.of[c].slice(), focus: [c], look: `Where can the ${v} go? Test it against every empty tile.`, why: `Everywhere else the ${v} breaks a line. The only tile it can enter is ${cellName(c, n)}.` };
    }
  }
  // 5. look ahead: the cell with the fewest possibilities, resolved by the square's single solution
  let pick = -1, pc = 99;
  for (let c = 0; c < N; c++) { if (grid[c]) continue; const k = candidates(P, grid, c).length; if (k < pc) { pc = k; pick = c; } }
  if (pick < 0) return null;
  return { tech: 'look-ahead', name: 'Try and rule out', cell: pick, value: P.sol[pick], lines: L.of[pick].slice(), focus: [pick], look: `No tile is forced by one line alone. Look at ${cellName(pick, n)}, which has the fewest choices.`, why: `Try each stone that fits here. Only ${P.sol[pick]} lets the rest of the square be finished; every other choice leads to a line that cannot reach ${M}.` };
}
