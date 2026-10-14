// Amidakuji engine: pure, deterministic, no drawing. A ladder has n vertical lines and `rows` rows;
// every row may hold rungs between neighbouring lines, never two rungs that share a line.
// cells[r * (n - 1) + g] is 0 (empty), 1 (fixed rung) or 2 (rung placed by the player).
// Lanterns start at the top of line i (token i). They end in a bowl; token i belongs to bowl target[i].

export const MAX_LINES = 8;
export const NAMES = ['Crimson', 'Amber', 'Jade', 'Azure', 'Violet', 'Rose', 'Slate', 'Teal'];

export const gaps = (n) => n - 1;
export const idx = (n, r, g) => r * (n - 1) + g;
export const emptyCells = (n, rows) => new Array(rows * (n - 1)).fill(0);

// A rung may go at (r, g) when the slot and both horizontal neighbours are free.
export function canPlace(n, cells, r, g) {
  if (g < 0 || g >= n - 1) return false;
  if (cells[idx(n, r, g)]) return false;
  if (g > 0 && cells[idx(n, r, g - 1)]) return false;
  if (g < n - 2 && cells[idx(n, r, g + 1)]) return false;
  return true;
}

// Line index after each row for a lantern starting on `start`: out[0] = start, out[rows] = final line.
export function route(n, rows, cells, start) {
  const out = [start];
  let p = start;
  for (let r = 0; r < rows; r++) {
    if (p < n - 1 && cells[idx(n, r, p)]) p += 1;
    else if (p > 0 && cells[idx(n, r, p - 1)]) p -= 1;
    out.push(p);
  }
  return out;
}
export const routes = (n, rows, cells) => Array.from({ length: n }, (_, i) => route(n, rows, cells, i));
export const finals = (n, rows, cells) => routes(n, rows, cells).map((rt) => rt[rows]);
// dest[token] = bowl; the same list is also a permutation.
export function arrangementAt(n, rows, cells, r) {
  // tokens' positions before row r: pos[token]; returns arr[line] = token
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let k = 0; k < r; k++) for (let g = 0; g < n - 1; g++) if (cells[idx(n, k, g)]) { const t = arr[g]; arr[g] = arr[g + 1]; arr[g + 1] = t; }
  return arr;
}
export const countRungs = (cells, v = 0) => cells.reduce((a, c) => a + (v ? (c === v ? 1 : 0) : (c ? 1 : 0)), 0);
export const isSolved = (n, rows, cells, target) => finals(n, rows, cells).every((f, i) => f === target[i]);
export const homeCount = (n, rows, cells, target) => finals(n, rows, cells).filter((f, i) => f === target[i]).length;

// ---- seeded PRNG for puzzle generation (independent from the game's rng so puzzles are stable) -------------------------------
export function seeded(seed) {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (m) => Math.floor(next() * m), shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; } };
}

// ---- the solver ------------------------------------------------------------------------------------------------------------------
// Row by row dynamic programme over arrangements. `base` rungs (fixed + kept player rungs) are forced; extra rungs may be added in
// any free slot. Returns { extra, rungs: [[r,g],...] } for the cheapest way to reach `target`, or null when impossible within maxExtra.
const matchingsCache = new Map();
function matchings(free) {   // all subsets of the list `free` (ascending gaps) with no two neighbouring gaps
  const key = free.join(',');
  let m = matchingsCache.get(key);
  if (m) return m;
  m = [[]];
  for (let i = 0; i < free.length; i++) {
    const add = [];
    for (const s of m) if (!s.length || s[s.length - 1] < free[i] - 1) add.push([...s, free[i]]);
    m = m.concat(add);
  }
  matchingsCache.set(key, m);
  return m;
}
const enc = (arr) => arr.reduce((a, v) => a * 8 + v, 0);

export function solve(n, rows, base, target, maxExtra = 99) {
  const goal = new Array(n);
  target.forEach((b, tok) => { goal[b] = tok; });
  const goalKey = enc(goal);
  let layer = new Map();
  const start = Array.from({ length: n }, (_, i) => i);
  layer.set(enc(start), { arr: start, cost: 0 });
  const trail = [];
  for (let r = 0; r < rows; r++) {
    const forced = [], blocked = new Set();
    for (let g = 0; g < n - 1; g++) if (base[idx(n, r, g)]) { forced.push(g); blocked.add(g); blocked.add(g - 1); blocked.add(g + 1); }
    const free = [];
    for (let g = 0; g < n - 1; g++) if (!blocked.has(g)) free.push(g);
    const ms = matchings(free);
    const next = new Map(), parents = new Map();
    for (const [key, st] of layer) {
      for (const m of ms) {
        const cost = st.cost + m.length;
        if (cost > maxExtra) continue;
        const arr = st.arr.slice();
        for (const g of forced) { const t = arr[g]; arr[g] = arr[g + 1]; arr[g + 1] = t; }
        for (const g of m) { const t = arr[g]; arr[g] = arr[g + 1]; arr[g + 1] = t; }
        const k2 = enc(arr), old = next.get(k2);
        if (!old || cost < old.cost) { next.set(k2, { arr, cost }); parents.set(k2, { from: key, m }); }
      }
    }
    trail.push(parents);
    layer = next;
  }
  const fin = layer.get(goalKey);
  if (!fin) return null;
  const rungs = [];
  let key = goalKey;
  for (let r = rows - 1; r >= 0; r--) {
    const p = trail[r].get(key);
    for (const g of p.m) rungs.push([r, g]);
    key = p.from;
  }
  rungs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { extra: fin.cost, rungs };
}

// ---- puzzle generation ---------------------------------------------------------------------------------------------------------------
// Chapter table: lines, rows, fixed rungs, hidden rungs, spare rungs given on top of the minimum.
export const CHAPTERS_SPEC = [
  { n: 3, rows: 5, fixed: [1, 2], hidden: [2, 3], spare: 2, minK: 2 },
  { n: 4, rows: 6, fixed: [2, 3], hidden: [3, 5], spare: 1, minK: 3 },
  { n: 5, rows: 7, fixed: [3, 4], hidden: [4, 6], spare: 1, minK: 4 },
  { n: 6, rows: 8, fixed: [3, 5], hidden: [5, 8], spare: 1, minK: 5 },
  { n: 7, rows: 9, fixed: [4, 6], hidden: [6, 9], spare: 0, minK: 6 },
];
function scatter(rnd, n, rows, cells, count, mark) {
  let placed = 0, guard = 0;
  while (placed < count && guard++ < 400) {
    const r = rnd.int(rows), g = rnd.int(n - 1);
    if (canPlace(n, cells, r, g)) { cells[idx(n, r, g)] = mark; placed++; }
  }
  return placed;
}
// Build a puzzle: { n, rows, fixed (cells with 1s), target, budget, min, seed }.
export function makePuzzle(spec, level, seed) {
  const { n, rows } = spec, span = Math.max(1, 5);
  const f = level / span;   // 0..1 within the chapter
  for (let attempt = 0; attempt < 60; attempt++) {
    const rnd = seeded(seed * 131 + attempt * 977);
    const cells = emptyCells(n, rows);
    const nf = spec.fixed[0] + Math.round((spec.fixed[1] - spec.fixed[0]) * f);
    scatter(rnd, n, rows, cells, nf, 1);
    const fixed = cells.slice();
    const nh = spec.hidden[0] + Math.round((spec.hidden[1] - spec.hidden[0]) * f);
    scatter(rnd, n, rows, cells, nh, 2);
    const target = finals(n, rows, cells);
    const sol = solve(n, rows, fixed, target);
    if (!sol || sol.extra < Math.max(2, spec.minK - 2 + Math.round(f * 2))) continue;
    return { n, rows, fixed, target, min: sol.extra, budget: sol.extra + spec.spare, seed };
  }
  // fall back: a guaranteed easy puzzle
  const cells = emptyCells(n, rows), fixed = cells.slice();
  cells[idx(n, 1, 0)] = 2; cells[idx(n, rows - 2, n - 2)] = 2;
  const target = finals(n, rows, cells), sol = solve(n, rows, fixed, target);
  return { n, rows, fixed, target, min: sol.extra, budget: sol.extra + spec.spare, seed };
}

export const flatten = (P, player) => P.fixed.map((v, i) => v || (player.includes(i) ? 2 : 0));

// ---- hints ------------------------------------------------------------------------------------------------------------------------------
// Returns null when solved, or { kind: 'add'|'remove', r, g, a, b, look, why, name }.
export function findHint(P, player) {
  const { n, rows, target, budget } = P;
  const cells = flatten(P, player);
  if (isSolved(n, rows, cells, target)) return null;
  const sol = solve(n, rows, cells, target);
  if (sol && player.length + sol.extra <= budget && sol.extra > 0) {
    const [r, g] = sol.rungs[0];
    const arr = arrangementAt(n, rows, cells, r), a = arr[g], b = arr[g + 1], fin = finals(n, rows, cells);
    const wrong = fin.filter((f, i) => f !== target[i]).length;
    const x = fin[a] !== target[a] ? a : b, markedAt = (p) => target.indexOf(p) + 1;
    const tail = r < rows - 1 ? 'below this point' : 'from here on';
    return {
      kind: 'add', r, g, a, b, name: 'Add a rung', cell: idx(n, r, g),
      look: `Look at row ${r + 1}, between lines ${g + 1} and ${g + 2}. Lantern ${a + 1} and lantern ${b + 1} come down side by side here.`,
      why: `Right now ${wrong} lantern${wrong === 1 ? '' : 's'} would land in the wrong bowl. Lantern ${x + 1} would end in the bowl marked ${markedAt(fin[x])}, but it belongs in the bowl marked ${x + 1}. A rung here swaps lanterns ${a + 1} and ${b + 1} ${tail}, and it is part of a shortest way to put them all right. Every rung swaps exactly two neighbours.`,
    };
  }
  // The rungs placed so far cannot be completed within the budget: find one to take back (latest first).
  for (let i = player.length - 1; i >= 0; i--) {
    const rest = player.filter((_, k) => k !== i), c2 = flatten(P, rest), s2 = solve(n, rows, c2, target);
    if (s2 && rest.length + s2.extra <= budget) return removeHint(P, player[i], n);
  }
  return removeHint(P, player[player.length - 1], n);
}
function removeHint(P, cell, n) {
  const r = Math.floor(cell / (n - 1)), g = cell % (n - 1);
  return {
    kind: 'remove', r, g, name: 'Take a rung back', cell,
    look: `One of your rungs is in the way: the one in row ${r + 1}, between lines ${g + 1} and ${g + 2}.`,
    why: `With this rung the lanterns can no longer all reach their bowls using ${P.budget} rungs. Take it back and the ladder can be finished again.`,
  };
}

// ---- Follow the Line: a random open ladder and the lantern to trace ------------------------------------------------------------------------
export const TIERS = [
  { id: 'calm', name: 'Calm', lines: [3, 4], rows: [5, 7], limit: 14 },
  { id: 'steady', name: 'Steady', lines: [4, 6], rows: [7, 9], limit: 12 },
  { id: 'swift', name: 'Swift', lines: [6, 8], rows: [9, 11], limit: 10 },
];
export const ROUNDS = 8;
export function makeRound(tier, roundIdx, rnd) {
  const T = TIERS[tier], f = roundIdx / (ROUNDS - 1);
  const n = T.lines[0] + Math.round((T.lines[1] - T.lines[0]) * f + (rnd.next() < 0.3 ? 1 : 0)) - 0;
  const lines = Math.max(T.lines[0], Math.min(T.lines[1], n));
  const rows = T.rows[0] + Math.round((T.rows[1] - T.rows[0]) * f);
  for (let tries = 0; tries < 40; tries++) {
    const cells = emptyCells(lines, rows);
    scatter(rnd, lines, rows, cells, Math.round((lines - 1) * rows * (0.28 + 0.1 * f)), 1);
    const start = rnd.int(lines), rt = route(lines, rows, cells, start);
    const moves = rt.filter((p, i) => i && p !== rt[i - 1]).length;
    if (moves >= 2 && rt[rows] !== start) return { n: lines, rows, cells, start, end: rt[rows], limit: T.limit };
  }
  const cells = emptyCells(lines, rows); cells[idx(lines, 1, 0)] = 1;
  return { n: lines, rows, cells, start: 0, end: route(lines, rows, cells, 0)[rows], limit: T.limit };
}

// ---- Draw Lots ---------------------------------------------------------------------------------------------------------------------------------
export const LOT_SETS = [
  { id: 'order', name: 'Turn order', blurb: 'Who goes first, second, third...', make: (n) => Array.from({ length: n }, (_, i) => ['1st', '2nd', '3rd'][i] ?? `${i + 1}th`) },
  { id: 'teams', name: 'Two teams', blurb: 'Split the group into Sun and Moon.', make: (n) => Array.from({ length: n }, (_, i) => (i % 2 ? 'Moon team' : 'Sun team')) },
  { id: 'pairs', name: 'Pairs', blurb: 'Matching slips are partners.', make: (n) => Array.from({ length: n }, (_, i) => `Pair ${String.fromCharCode(65 + Math.floor(i / 2))}`) },
  { id: 'tasks', name: 'Little tasks', blurb: 'Light-hearted things to do.', make: (n) => {
    const all = ['Tell a one-line joke', 'Hum a tune for ten seconds', 'Do five slow stretches', 'Share a happy memory', 'Name three animals that start with B', 'Pay the person on your left a compliment', 'Tell a story in three sentences', 'Make everyone laugh with a face', 'Teach us a word in another language', 'Describe your favourite meal', 'Act out an animal for others to guess', 'Say a tongue twister three times'];
    return all.slice(0, n);
  } },
];
export function makeLots(players, setId, rnd) {
  const n = Math.max(2, Math.min(MAX_LINES, players)), rows = 6 + n;
  const cells = emptyCells(n, rows);
  scatter(rnd, n, rows, cells, n, 1);
  const set = LOT_SETS.find((s) => s.id === setId) ?? LOT_SETS[0];
  const slips = set.make(n);
  rnd.shuffle(slips);
  return { n, rows, cells, slips, set: set.id };
}
