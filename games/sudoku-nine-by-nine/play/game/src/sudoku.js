// Sudoku engine: pure and deterministic (no clock, no Math.random, no DOM).
//   - grid helpers (cells 0..80, houses 0..26: rows 0-8, columns 9-17, boxes 18-26)
//   - a counting solver (proves a puzzle has exactly one solution)
//   - a human-style solver: twelve named techniques, applied simplest first, one explainable step at a time
//   - grading (the hardest technique the simplest solving path needs), a seeded generator and puzzle transforms
// Candidate sets are 9-bit masks: digit d is bit (d - 1).

export const ALL = 0x1ff;
export const bit = (d) => 1 << (d - 1);
export const pop = (m) => { let n = 0; while (m) { m &= m - 1; n += 1; } return n; };
export const digitsOf = (m) => { const out = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) out.push(d); return out; };
export const rowOf = (c) => (c / 9) | 0;
export const colOf = (c) => c % 9;
export const boxOf = (c) => 3 * ((c / 27) | 0) + (((c % 9) / 3) | 0);
export const rcName = (c) => `R${rowOf(c) + 1}C${colOf(c) + 1}`;
export const houseName = (h) => (h < 9 ? `row ${h + 1}` : h < 18 ? `column ${h - 8}` : `box ${h - 17}`);

export const HOUSES = [];
for (let r = 0; r < 9; r++) HOUSES.push(Array.from({ length: 9 }, (_, i) => r * 9 + i));
for (let c = 0; c < 9; c++) HOUSES.push(Array.from({ length: 9 }, (_, i) => i * 9 + c));
for (let b = 0; b < 9; b++) HOUSES.push(Array.from({ length: 9 }, (_, i) => ((b / 3) | 0) * 27 + (b % 3) * 3 + ((i / 3) | 0) * 9 + (i % 3)));
export const HOUSES_OF = Array.from({ length: 81 }, (_, c) => [rowOf(c), 9 + colOf(c), 18 + boxOf(c)]);
export const PEERS = Array.from({ length: 81 }, (_, c) => {
  const s = new Set();
  for (const h of HOUSES_OF[c]) for (const x of HOUSES[h]) if (x !== c) s.add(x);
  return [...s];
});
export const sees = (a, b) => a !== b && (rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b));

// ---- seeded random (the generator must be reproducible from a number alone) ----------------------------------------
export function seeded(seed) {
  let s = seed >>> 0;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const int = (n) => Math.floor(next() * n);
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return { next, int, shuffle };
}

// ---- counting solver -----------------------------------------------------------------------------------------------
// Counts solutions of a grid (array of 81 digits, 0 = empty) up to `limit`. With `rnd` the digit order is shuffled, which
// is how a random complete grid is made. `out.first` receives the first solution found.
export function countSolutions(vals, limit = 2, rnd = null, out = null) {
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0), v = vals.slice(), empty = [];
  for (let i = 0; i < 81; i++) {
    if (v[i]) {
      const b = bit(v[i]);
      if ((rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]) & b) return 0;
      rows[rowOf(i)] |= b; cols[colOf(i)] |= b; boxes[boxOf(i)] |= b;
    } else empty.push(i);
  }
  let count = 0;
  const rec = (n) => {
    if (n === 0) { count += 1; if (out && !out.first) out.first = v.slice(); return; }
    let bi = -1, bm = 0, bc = 10;
    for (let k = 0; k < n; k++) {
      const c = empty[k], m = ALL & ~(rows[rowOf(c)] | cols[colOf(c)] | boxes[boxOf(c)]), pc = pop(m);
      if (pc === 0) return;
      if (pc < bc) { bc = pc; bi = k; bm = m; if (pc === 1) break; }
    }
    const c = empty[bi]; empty[bi] = empty[n - 1]; empty[n - 1] = c;
    const r = rowOf(c), cl = colOf(c), b = boxOf(c);
    let ds = digitsOf(bm);
    if (rnd) ds = rnd.shuffle(ds);
    for (const d of ds) {
      const bt = bit(d);
      v[c] = d; rows[r] |= bt; cols[cl] |= bt; boxes[b] |= bt;
      rec(n - 1);
      rows[r] &= ~bt; cols[cl] &= ~bt; boxes[b] &= ~bt; v[c] = 0;
      if (count >= limit) break;
    }
    empty[n - 1] = empty[bi]; empty[bi] = c;
  };
  rec(empty.length);
  return count;
}
export const solveGrid = (vals) => { const o = {}; countSolutions(vals, 1, null, o); return o.first ?? null; };
export const randomSolution = (rnd) => { const o = {}; countSolutions(new Array(81).fill(0), 1, rnd, o); return o.first; };

// ---- human-style solver --------------------------------------------------------------------------------------------
// State S = { v: digits (0 = empty), c: candidate masks (0 for filled cells) }.
export function stateFrom(vals, elim = null) {
  const v = vals.slice(), c = new Array(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (v[i]) continue;
    let m = ALL;
    for (const p of PEERS[i]) if (v[p]) m &= ~bit(v[p]);
    if (elim && elim[i]) m &= ~elim[i];
    c[i] = m;
  }
  return { v, c };
}
export function place(S, cell, d) {
  S.v[cell] = d; S.c[cell] = 0;
  for (const p of PEERS[cell]) S.c[p] &= ~bit(d);
}
export function applyStep(S, step) {
  if (step.place) place(S, step.place.cell, step.place.digit);
  else for (const e of step.elim) S.c[e.cell] &= ~e.mask;
}
const isBroken = (S) => { for (let i = 0; i < 81; i++) if (!S.v[i] && !S.c[i]) return true; return false; };

const NAMES = {
  'naked-single': 'Naked Single', 'hidden-single': 'Hidden Single', pointing: 'Pointing Pair', claiming: 'Box-Line Reduction',
  'naked-pair': 'Naked Pair', 'hidden-pair': 'Hidden Pair', 'naked-triple': 'Naked Triple', 'hidden-triple': 'Hidden Triple',
  'x-wing': 'X-Wing', 'xy-wing': 'XY-Wing', swordfish: 'Swordfish', 'xyz-wing': 'XYZ-Wing', skyscraper: 'Skyscraper', 'w-wing': 'W-Wing', 'xy-chain': 'XY-Chain',
};
export const TECH_NAME = (id) => NAMES[id] ?? id;

const elimStep = (tech, level, extra, elim) => (elim.length ? { tech, level, ...extra, elim } : null);

function nakedSingle(S) {
  for (let i = 0; i < 81; i++) if (!S.v[i] && pop(S.c[i]) === 1) return { tech: 'naked-single', level: 1, cells: [i], place: { cell: i, digit: digitsOf(S.c[i])[0] } };
  return null;
}
const HOUSE_ORDER = [18, 19, 20, 21, 22, 23, 24, 25, 26, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
function hiddenSingle(S) {
  for (const h of HOUSE_ORDER) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      let found = -1, n = 0, placed = false;
      for (const c of HOUSES[h]) { if (S.v[c] === d) { placed = true; break; } if (S.c[c] & b) { n += 1; found = c; } }
      if (!placed && n === 1) return { tech: 'hidden-single', level: 1, house: h, digit: d, cells: [found], place: { cell: found, digit: d } };
    }
  }
  return null;
}
function locked(S) {
  // pointing: inside a box, a digit's candidates all lie on one line -> clear the rest of that line
  for (let bx = 18; bx < 27; bx++) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d), cs = HOUSES[bx].filter((c) => S.c[c] & b);
      if (cs.length < 2) continue;
      for (const line of [0, 1]) {
        const key = (c) => (line === 0 ? rowOf(c) : 9 + colOf(c));
        if (!cs.every((c) => key(c) === key(cs[0]))) continue;
        const elim = HOUSES[key(cs[0])].filter((c) => boxOf(c) !== bx - 18 && S.c[c] & b).map((c) => ({ cell: c, mask: b }));
        const st = elimStep('pointing', 2, { house: bx, line: key(cs[0]), digit: d, cells: cs }, elim);
        if (st) return st;
      }
    }
  }
  // claiming: on a line, a digit's candidates all lie in one box -> clear the rest of that box
  for (let h = 0; h < 18; h++) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d), cs = HOUSES[h].filter((c) => S.c[c] & b);
      if (cs.length < 2 || !cs.every((c) => boxOf(c) === boxOf(cs[0]))) continue;
      const elim = HOUSES[18 + boxOf(cs[0])].filter((c) => !HOUSES[h].includes(c) && S.c[c] & b).map((c) => ({ cell: c, mask: b }));
      const st = elimStep('claiming', 2, { house: h, box: 18 + boxOf(cs[0]), digit: d, cells: cs }, elim);
      if (st) return st;
    }
  }
  return null;
}
function combos(arr, n, f, start = 0, acc = []) {
  if (acc.length === n) return f(acc);
  for (let i = start; i < arr.length; i++) { acc.push(arr[i]); const r = combos(arr, n, f, i + 1, acc); acc.pop(); if (r) return r; }
  return null;
}
function nakedSubset(S, n) {
  const tech = n === 2 ? 'naked-pair' : 'naked-triple', level = n === 2 ? 2 : 3;
  for (let h = 0; h < 27; h++) {
    const cs = HOUSES[h].filter((c) => !S.v[c] && pop(S.c[c]) <= n && pop(S.c[c]) >= 2);
    const r = combos(cs, n, (pick) => {
      const u = pick.reduce((m, c) => m | S.c[c], 0);
      if (pop(u) !== n) return null;
      const elim = HOUSES[h].filter((c) => !pick.includes(c) && S.c[c] & u).map((c) => ({ cell: c, mask: S.c[c] & u }));
      return elimStep(tech, level, { house: h, digits: digitsOf(u), cells: pick.slice() }, elim);
    });
    if (r) return r;
  }
  return null;
}
function hiddenSubset(S, n) {
  const tech = n === 2 ? 'hidden-pair' : 'hidden-triple', level = 3;
  for (let h = 0; h < 27; h++) {
    const where = {};
    for (let d = 1; d <= 9; d++) { const cs = HOUSES[h].filter((c) => S.c[c] & bit(d)); if (cs.length >= 2 && cs.length <= n && !HOUSES[h].some((c) => S.v[c] === d)) where[d] = cs; }
    const ds = Object.keys(where).map(Number);
    const r = combos(ds, n, (pick) => {
      const cs = [...new Set(pick.flatMap((d) => where[d]))];
      if (cs.length !== n) return null;
      const keep = pick.reduce((m, d) => m | bit(d), 0);
      const elim = cs.filter((c) => S.c[c] & ~keep).map((c) => ({ cell: c, mask: S.c[c] & ~keep }));
      return elimStep(tech, level, { house: h, digits: pick.slice(), cells: cs }, elim);
    });
    if (r) return r;
  }
  return null;
}
function fish(S, n) {
  const tech = n === 2 ? 'x-wing' : 'swordfish', level = n === 2 ? 4 : 5;
  for (let d = 1; d <= 9; d++) {
    const b = bit(d);
    for (const byRow of [true, false]) {
      const lines = [];
      for (let i = 0; i < 9; i++) {
        const h = byRow ? i : 9 + i, cs = HOUSES[h].filter((c) => S.c[c] & b);
        if (HOUSES[h].some((c) => S.v[c] === d)) continue;
        if (cs.length >= 2 && cs.length <= n) lines.push({ i, cs });
      }
      const r = combos(lines, n, (pick) => {
        const cross = [...new Set(pick.flatMap((l) => l.cs.map((c) => (byRow ? colOf(c) : rowOf(c)))))];
        if (cross.length !== n) return null;
        const baseIdx = pick.map((l) => l.i);
        const elim = [];
        for (const x of cross) for (const c of HOUSES[byRow ? 9 + x : x]) if (!baseIdx.includes(byRow ? rowOf(c) : colOf(c)) && S.c[c] & b) elim.push({ cell: c, mask: b });
        return elimStep(tech, level, { digit: d, byRow, base: baseIdx, cross: cross.sort((a, z) => a - z), cells: pick.flatMap((l) => l.cs) }, elim);
      });
      if (r) return r;
    }
  }
  return null;
}
function xyWing(S) {
  const bi = []; for (let i = 0; i < 81; i++) if (!S.v[i] && pop(S.c[i]) === 2) bi.push(i);
  for (const p of bi) {
    const [x, y] = digitsOf(S.c[p]);
    const ps = PEERS[p].filter((c) => !S.v[c] && pop(S.c[c]) === 2);
    for (const a of ps) {
      if (!(S.c[a] & bit(x)) || (S.c[a] & bit(y))) continue;
      const z = digitsOf(S.c[a] & ~bit(x))[0];
      for (const bb of ps) {
        if (bb === a || S.c[bb] !== (bit(y) | bit(z))) continue;
        const elim = PEERS[a].filter((c) => c !== p && c !== bb && sees(c, bb) && S.c[c] & bit(z)).map((c) => ({ cell: c, mask: bit(z) }));
        const st = elimStep('xy-wing', 4, { pivot: p, wings: [a, bb], digit: z, digits: [x, y, z], cells: [p, a, bb] }, elim);
        if (st) return st;
      }
    }
  }
  return null;
}
function xyzWing(S) {
  for (let p = 0; p < 81; p++) {
    if (S.v[p] || pop(S.c[p]) !== 3) continue;
    const ds = digitsOf(S.c[p]), ps = PEERS[p].filter((c) => !S.v[c] && pop(S.c[c]) === 2 && (S.c[c] & ~S.c[p]) === 0);
    for (const z of ds) {
      const [x, y] = ds.filter((d) => d !== z);
      for (const a of ps) {
        if (S.c[a] !== (bit(x) | bit(z))) continue;
        for (const bb of ps) {
          if (S.c[bb] !== (bit(y) | bit(z))) continue;
          const elim = PEERS[p].filter((c) => c !== a && c !== bb && sees(c, a) && sees(c, bb) && S.c[c] & bit(z)).map((c) => ({ cell: c, mask: bit(z) }));
          const st = elimStep('xyz-wing', 5, { pivot: p, wings: [a, bb], digit: z, digits: [x, y, z], cells: [p, a, bb] }, elim);
          if (st) return st;
        }
      }
    }
  }
  return null;
}


// Skyscraper: a digit with exactly two candidate cells in each of two rows (or columns) that share one column (or row).
function skyscraper(S) {
  for (let d = 1; d <= 9; d++) {
    const b = bit(d);
    for (const byRow of [true, false]) {
      const lines = [];
      for (let i = 0; i < 9; i++) {
        const h = byRow ? i : 9 + i;
        if (HOUSES[h].some((c) => S.v[c] === d)) continue;
        const cs = HOUSES[h].filter((c) => S.c[c] & b);
        if (cs.length === 2) lines.push(cs);
      }
      const k = (c) => (byRow ? colOf(c) : rowOf(c));
      for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
        const [a1, a2] = lines[i], [b1, b2] = lines[j];
        for (const [x1, x2] of [[a1, a2], [a2, a1]]) for (const [y1, y2] of [[b1, b2], [b2, b1]]) {
          if (k(x1) !== k(y1) || k(x2) === k(y2)) continue;        // share the base line, different roof lines
          const elim = [];
          for (let c = 0; c < 81; c++) if (c !== x2 && c !== y2 && c !== x1 && c !== y1 && S.c[c] & b && sees(c, x2) && sees(c, y2)) elim.push({ cell: c, mask: b });
          const st = elimStep('skyscraper', 4, { digit: d, byRow, cells: [x1, y1, x2, y2], roof: [x2, y2] }, elim);
          if (st) return st;
        }
      }
    }
  }
  return null;
}
// W-Wing: two bivalue cells with the same pair {x,y} that cannot see each other, joined by a strong link on x.
function wWing(S) {
  const bi = []; for (let i = 0; i < 81; i++) if (!S.v[i] && pop(S.c[i]) === 2) bi.push(i);
  for (let i = 0; i < bi.length; i++) for (let j = i + 1; j < bi.length; j++) {
    const P = bi[i], Q = bi[j];
    if (S.c[P] !== S.c[Q] || sees(P, Q)) continue;
    const [d1, d2] = digitsOf(S.c[P]);
    for (const [x, y] of [[d1, d2], [d2, d1]]) {
      const elim = [];
      for (let c = 0; c < 81; c++) if (c !== P && c !== Q && S.c[c] & bit(y) && sees(c, P) && sees(c, Q)) elim.push({ cell: c, mask: bit(y) });
      if (!elim.length) continue;
      for (let h = 0; h < 27; h++) {
        if (HOUSES[h].some((c) => S.v[c] === x)) continue;
        const cs = HOUSES[h].filter((c) => S.c[c] & bit(x));
        if (cs.length !== 2) continue;
        const [A, B] = cs;
        if (cs.includes(P) || cs.includes(Q)) continue;
        if ((sees(A, P) && sees(B, Q)) || (sees(A, Q) && sees(B, P))) return { tech: 'w-wing', level: 5, house: h, digits: [x, y], digit: y, cells: [P, Q, A, B], pair: [P, Q], link: [A, B], elim };
      }
    }
  }
  return null;
}
// XY-Chain: bivalue cells, each seeing the next, forcing a digit along the chain; both ends cannot avoid the digit z.
function xyChain(S) {
  const bi = []; for (let i = 0; i < 81; i++) if (!S.v[i] && pop(S.c[i]) === 2) bi.push(i);
  if (bi.length < 4) return null;
  let found = null;
  const dfs = (chain, z, need) => {
    if (found) return;
    const last = chain[chain.length - 1];
    for (const nx of bi) {
      if (found) return;
      if (chain.includes(nx) || !sees(last, nx) || !(S.c[nx] & bit(need))) continue;
      const other = digitsOf(S.c[nx] & ~bit(need))[0];
      if (other === z && chain.length >= 3) {
        const first = chain[0], elim = [];
        for (let c = 0; c < 81; c++) if (!chain.includes(c) && nx !== c && S.c[c] & bit(z) && sees(c, first) && sees(c, nx)) elim.push({ cell: c, mask: bit(z) });
        if (elim.length) { found = { tech: 'xy-chain', level: 5, digit: z, digits: [z], cells: [...chain, nx], elim }; return; }
      } else if (other !== z && chain.length < 6) dfs([...chain, nx], z, other);
    }
  };
  for (const f of bi) {
    for (const z of digitsOf(S.c[f])) { dfs([f], z, digitsOf(S.c[f] & ~bit(z))[0]); if (found) return found; }
  }
  return null;
}

export const TECHNIQUES = [
  { id: 'naked-single', level: 1, find: nakedSingle },
  { id: 'hidden-single', level: 1, find: hiddenSingle },
  { id: 'locked', level: 2, find: locked },
  { id: 'naked-pair', level: 2, find: (S) => nakedSubset(S, 2) },
  { id: 'hidden-pair', level: 3, find: (S) => hiddenSubset(S, 2) },
  { id: 'naked-triple', level: 3, find: (S) => nakedSubset(S, 3) },
  { id: 'hidden-triple', level: 3, find: (S) => hiddenSubset(S, 3) },
  { id: 'x-wing', level: 4, find: (S) => fish(S, 2) },
  { id: 'xy-wing', level: 4, find: xyWing },
  { id: 'skyscraper', level: 4, find: skyscraper },
  { id: 'swordfish', level: 5, find: (S) => fish(S, 3) },
  { id: 'xyz-wing', level: 5, find: xyzWing },
  { id: 'w-wing', level: 5, find: wWing },
  { id: 'xy-chain', level: 5, find: xyChain },
];
export const GRADES = ['Easy', 'Medium', 'Hard', 'Expert', 'Master'];

// The next explainable step (simplest technique first), or null when nothing in the toolbox applies. `maxLevel` caps the toolbox.
export function nextStep(S, maxLevel = 5) {
  for (const t of TECHNIQUES) { if (t.level > maxLevel) break; const st = t.find(S); if (st) return st; }
  return null;
}

// Solve a puzzle the way a person would. Returns { solved, level, counts, steps }.
export function humanSolve(givens, maxLevel = 5, keepSteps = false) {
  const S = stateFrom(givens), counts = {}, steps = [];
  let level = 1, n = 0;
  for (;;) {
    if (S.v.every((x) => x)) return { solved: true, level, counts, steps, n };
    if (isBroken(S)) return { solved: false, level, counts, steps, n };
    const st = nextStep(S, maxLevel);
    if (!st) return { solved: false, level, counts, steps, n };
    counts[st.tech] = (counts[st.tech] || 0) + 1;
    if (st.level > level) level = st.level;
    if (keepSteps) steps.push(st);
    applyStep(S, st); n += 1;
  }
}
export const advCount = (counts) => ['swordfish', 'xyz-wing', 'w-wing', 'xy-chain'].reduce((n, id) => n + (counts[id] || 0), 0);
export function gradeOf(givens) {
  const r = humanSolve(givens);
  if (!r.solved) return null;
  const adv = advCount(r.counts);
  return { level: r.level, counts: r.counts, steps: r.n, adv };
}

// ---- generator -----------------------------------------------------------------------------------------------------
// A generator function so the game can run it a few slices per frame without a clock. Yields while working; its return
// value is { givens, solution, level, counts, tries }. Same seed, same puzzle.
const STOP_AT = { 1: 36, 2: 0, 3: 0, 4: 0, 5: 0 };   // easy puzzles stop digging once this few givens remain (more clues = gentler)
export function* generate(seed, level, maxTries = 60) {
  const rnd = seeded(seed);
  let best = null;
  for (let tries = 1; tries <= maxTries; tries++) {
    const solution = randomSolution(rnd), g = solution.slice();
    const pairs = rnd.shuffle(Array.from({ length: 41 }, (_, i) => i));
    let givens = 81;
    for (const i of pairs) {
      const j = 80 - i, a = g[i], b = g[j];
      if (!a && !b) continue;
      const stop = STOP_AT[level] + rnd.int(3);
      if (givens <= stop) break;
      g[i] = 0; g[j] = 0;
      const removed = i === j ? 1 : 2;
      let ok = countSolutions(g, 2) === 1 && humanSolve(g, level).solved;
      yield null;
      if (!ok) { g[i] = a; g[j] = b; } else givens -= removed;
    }
    const r = humanSolve(g);
    yield null;
    if (r.solved) {
      const adv = advCount(r.counts), cand = { givens: g.slice(), solution, level: r.level, counts: r.counts, tries, adv };
      if (r.level === level && (level < 5 || adv >= 2)) return cand;      // Master must really use the deep techniques, more than once
      const score = (c) => -Math.abs(c.level - level) * 10 + Math.min(c.adv, 3);
      if (!best || score(cand) > score(best)) best = cand;
    }
  }
  return best;
}

// ---- puzzle transforms (a different-looking puzzle of exactly the same difficulty) --------------------------------------
export function transform(grid, rnd) {
  const bands = rnd.shuffle([0, 1, 2]), stacks = rnd.shuffle([0, 1, 2]);
  const rowOrder = [], colOrder = [];
  for (const b of bands) for (const r of rnd.shuffle([0, 1, 2])) rowOrder.push(b * 3 + r);
  for (const s of stacks) for (const c of rnd.shuffle([0, 1, 2])) colOrder.push(s * 3 + c);
  const relabel = [0, ...rnd.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])], flip = rnd.int(2) === 1;
  const out = new Array(81).fill(0);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const d = grid[rowOrder[r] * 9 + colOrder[c]];
    const [rr, cc] = flip ? [c, r] : [r, c];
    out[rr * 9 + cc] = d ? relabel[d] : 0;
  }
  return out;
}
export const toStr = (g) => g.map((d) => d || '.').join('');
export const fromStr = (s) => Array.from(s, (ch) => (ch >= '1' && ch <= '9' ? Number(ch) : 0));

// ---- plain-language explanations ---------------------------------------------------------------------------------------
const list = (arr) => (arr.length <= 1 ? String(arr[0] ?? '') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);
const cellList = (cs) => list(cs.map(rcName));
const seenDigits = (S, cell) => { const out = []; for (let d = 1; d <= 9; d++) { const p = PEERS[cell].find((x) => S.v[x] === d); if (p !== undefined) out.push({ d, p }); } return out; };

// Returns { name, look, why, show } for a step. `look` points at where to look without giving the answer away; `why` is the full
// reasoning. `show` = { focus: cells, seen: cells, houses: [house], elim: [{cell, mask}] } for the board highlight.
export function explain(S, st) {
  const name = TECH_NAME(st.tech === 'locked' ? st.tech : st.tech);
  const d = st.digit, ds = st.digits ?? [];
  const show = { focus: st.cells ?? [], seen: [], houses: [], elim: st.elim ?? [], place: st.place ?? null };
  let look = '', why = '';
  switch (st.tech) {
    case 'naked-single': {
      const c = st.place.cell, seen = seenDigits(S, c);
      show.seen = seen.map((x) => x.p);
      look = `Look at ${rcName(c)}. Almost every digit is already ruled out there.`;
      why = `${rcName(c)} can only be ${st.place.digit}: its row, column and box already contain ${list(seen.map((x) => x.d))}, so ${st.place.digit} is the only digit left.`;
      break;
    }
    case 'hidden-single': {
      const c = st.place.cell;
      show.houses = [st.house];
      look = `Look at ${houseName(st.house)}. One digit has only one possible home there.`;
      why = `In ${houseName(st.house)} the digit ${d} can go in only one cell: ${rcName(c)}. Every other cell in the ${st.house < 9 ? 'row' : st.house < 18 ? 'column' : 'box'} is blocked for ${d}, so ${rcName(c)} must be ${d}.`;
      break;
    }
    case 'pointing':
      show.houses = [st.house, st.line];
      look = `Look at ${houseName(st.house)} and the digit ${d}.`;
      why = `In ${houseName(st.house)}, the digit ${d} can only go in ${cellList(st.cells)}, which all lie in ${houseName(st.line)}. So the ${d} of ${houseName(st.house)} is in that line, and ${d} can be removed from the rest of ${houseName(st.line)}.`;
      break;
    case 'claiming':
      show.houses = [st.house, st.box];
      look = `Look at ${houseName(st.house)} and the digit ${d}.`;
      why = `In ${houseName(st.house)}, the digit ${d} can only go in ${cellList(st.cells)}, which all lie in ${houseName(st.box)}. So the ${d} of ${houseName(st.house)} is inside that box, and ${d} can be removed from the rest of ${houseName(st.box)}.`;
      break;
    case 'naked-pair': case 'naked-triple': {
      const n = st.cells.length;
      show.houses = [st.house];
      look = `Look at ${houseName(st.house)}: ${n} cells share the same ${n} digits.`;
      why = `${cellList(st.cells)} in ${houseName(st.house)} can only hold ${list(ds)} between them. Those ${n} digits must fill those ${n} cells, so ${list(ds)} can be removed from every other cell in ${houseName(st.house)}.`;
      break;
    }
    case 'hidden-pair': case 'hidden-triple': {
      const n = st.cells.length;
      show.houses = [st.house];
      look = `Look at ${houseName(st.house)}: ${n} digits have only ${n} cells to go in.`;
      why = `In ${houseName(st.house)}, the digits ${list(ds)} can only go in ${cellList(st.cells)}. Those cells must hold exactly those digits, so every other candidate can be removed from them.`;
      break;
    }
    case 'x-wing':
      show.houses = st.base.map((i) => (st.byRow ? i : 9 + i));
      look = `Look at the digit ${d} in ${st.byRow ? 'rows' : 'columns'} ${list(st.base.map((i) => i + 1))}.`;
      why = `In ${st.byRow ? 'rows' : 'columns'} ${list(st.base.map((i) => i + 1))} the digit ${d} appears in only the same two ${st.byRow ? 'columns' : 'rows'}, ${list(st.cross.map((i) => i + 1))}. The two ${d}s must sit on opposite corners, so ${d} can be removed from the rest of those ${st.byRow ? 'columns' : 'rows'}.`;
      break;
    case 'swordfish':
      show.houses = st.base.map((i) => (st.byRow ? i : 9 + i));
      look = `Look at the digit ${d} in ${st.byRow ? 'rows' : 'columns'} ${list(st.base.map((i) => i + 1))}.`;
      why = `In ${st.byRow ? 'rows' : 'columns'} ${list(st.base.map((i) => i + 1))} the digit ${d} appears only within the same three ${st.byRow ? 'columns' : 'rows'}, ${list(st.cross.map((i) => i + 1))}. The three ${d}s must use all three, so ${d} can be removed from the rest of those ${st.byRow ? 'columns' : 'rows'}.`;
      break;
    case 'xy-wing': case 'xyz-wing': {
      const z = st.digit, [pv, a, b] = [st.pivot, st.wings[0], st.wings[1]];
      look = `Look at ${rcName(pv)}, with ${rcName(a)} and ${rcName(b)} as its two wings.`;
      why = st.tech === 'xy-wing'
        ? `The pivot ${rcName(pv)} holds ${list(digitsOf(S.c[pv]))}. Its wings ${rcName(a)} and ${rcName(b)} each share one digit with it and both hold ${z}. Whichever digit the pivot takes, one of the wings must be ${z}, so ${z} can be removed from any cell that sees both wings.`
        : `The pivot ${rcName(pv)} holds ${list(digitsOf(S.c[pv]))}. Its wings ${rcName(a)} and ${rcName(b)} both see it and both hold ${z}. Whether the pivot or a wing is ${z}, one of the three must be, so ${z} can be removed from any cell that sees all three.`;
      show.focus = [pv, a, b];
      break;
    }
    case 'skyscraper': {
      const [r1, r2] = st.roof;
      look = `Look at the digit ${d} in two ${st.byRow ? 'rows' : 'columns'} that each have just two places for it.`;
      why = `The digit ${d} has only two candidate cells in each of these two ${st.byRow ? 'rows' : 'columns'}, and they share one ${st.byRow ? 'column' : 'row'}. The two cells at the other ends, ${rcName(r1)} and ${rcName(r2)}, form the roof. One of the roof cells must be ${d}, so ${d} can be removed from any cell that sees both of them.`;
      break;
    }
    case 'w-wing': {
      const [P, Q] = st.pair, [A, B] = st.link, [x, y] = st.digits;
      look = `Look at ${rcName(P)} and ${rcName(Q)}: both can only be ${x} or ${y}.`;
      why = `${rcName(P)} and ${rcName(Q)} each hold only ${x} and ${y} and cannot see each other. In ${houseName(st.house)} the digit ${x} can only go in ${rcName(A)} or ${rcName(B)}, and each of those sees one of the two cells. Whichever one is ${x}, the cell it sees becomes ${y}. So one of ${rcName(P)} and ${rcName(Q)} is ${y}, and ${y} can be removed from any cell that sees both.`;
      break;
    }
    case 'xy-chain': {
      const z = st.digit;
      look = `Follow a chain of ${st.cells.length} two-candidate cells from ${rcName(st.cells[0])} to ${rcName(st.cells[st.cells.length - 1])}.`;
      why = `Each cell in the chain ${cellList(st.cells)} holds two candidates and sees the next one, so every choice forces the next cell. Either the first cell is ${z}, or it is not and the chain forces the last cell to be ${z}. One end is always ${z}, so ${z} can be removed from any cell that sees both ends.`;
      break;
    }
    default: break;
  }
  return { name, look, why, show };
}
