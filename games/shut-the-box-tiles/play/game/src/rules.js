// Shut the Box rules and the solver. Pure and deterministic; no clock, no randomness (dice come from hash32(seed, n)).
// Tiles are numbered 1..n and stored as a bit mask: bit (k-1) set = tile k is OPEN (standing up). Score = sum of open tiles.
export const MODES = {
  classic: { n: 9, title: 'Classic Box', short: '1 to 9' },
  tall: { n: 12, title: 'Tall Box', short: '1 to 12' },
};
export const hash32 = (a, b) => {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
};
// Roll number `n` of a box with dice seed `seed`: two dice. (A one-die roll uses the first die.)
export const rollDice = (seed, n) => [1 + (hash32(seed, n * 2 + 1) % 6), 1 + (hash32(seed, n * 2 + 2) % 6)];
export const fullMask = (n) => (1 << n) - 1;
export const bit = (k) => 1 << (k - 1);
export const tilesOf = (mask) => { const out = []; for (let k = 1; mask >> (k - 1); k++) if (mask & bit(k)) out.push(k); return out; };
export const sumMask = (mask) => { let s = 0; for (let k = 1; mask >> (k - 1); k++) if (mask & bit(k)) s += k; return s; };
export const countBits = (m) => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };
// One die may be rolled when every open tile is 6 or lower (7 and up are all shut).
export const singleAllowed = (open) => open !== 0 && open >> 6 === 0;
// Every subset of the open tiles whose numbers add up to `total` (the legal moves for that roll), smallest masks first.
export function legalSubs(open, total) {
  const out = [];
  for (let sub = open; sub > 0; sub = (sub - 1) & open) if (sumMask(sub) === total) out.push(sub);
  return out.sort((a, b) => a - b);
}
// Tiles that can still be part of a legal combination given the tiles already lifted (selMask).
export function viableTiles(open, total, selMask) {
  let v = 0;
  for (const s of legalSubs(open, total)) if ((s & selMask) === selMask) v |= s;
  return v & ~selMask;
}
export const labelOf = (mask) => tilesOf(mask).join(' + ');

// ---- the solver: exact expected final score under the best play, and the best chance to shut the box ---------------------------
const P2 = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((c) => c / 36), P1 = [0, 1, 1, 1, 1, 1, 1].map((c) => c / 6);
const tables = new Map();
export function solver(n) {
  if (tables.has(n)) return tables.get(n);
  const size = 1 << n, E = new Float64Array(size), P = new Float64Array(size), sum = new Int16Array(size);
  const bestE = new Float64Array(size * 13), bestSubE = new Int32Array(size * 13), bestP = new Float64Array(size * 13), bestSubP = new Int32Array(size * 13);
  const useOne = new Uint8Array(size), useOneP = new Uint8Array(size);
  for (let m = 1; m < size; m++) sum[m] = sum[m & (m - 1)] + (32 - Math.clz32(m & -m));
  P[0] = 1;
  for (let m = 1; m < size; m++) {
    const b = m * 13;
    for (let r = 0; r < 13; r++) { bestE[b + r] = Infinity; bestP[b + r] = -1; }
    for (let sub = m; sub > 0; sub = (sub - 1) & m) {
      const s = sum[sub]; if (s > 12) continue;
      const rest = m ^ sub;
      if (E[rest] < bestE[b + s]) { bestE[b + s] = E[rest]; bestSubE[b + s] = sub; }
      if (P[rest] > bestP[b + s]) { bestP[b + s] = P[rest]; bestSubP[b + s] = sub; }
    }
    const val = (probs, from, tbl, stuck) => { let v = 0; for (let r = 1; r <= 12; r++) if (probs[r]) v += probs[r] * (tbl[b + r] === (stuck < 0 ? -1 : Infinity) ? (stuck < 0 ? 0 : sum[m]) : tbl[b + r]); return v; };
    const e2 = val(P2, 0, bestE, 1), p2 = val(P2, 0, bestP, -1);
    E[m] = e2; P[m] = p2;
    if (singleAllowed(m)) {
      const e1 = val(P1, 0, bestE, 1), p1 = val(P1, 0, bestP, -1);
      if (e1 < e2) { E[m] = e1; useOne[m] = 1; }
      if (p1 > p2) { P[m] = p1; useOneP[m] = 1; }
    }
  }
  const t = { n, E, P, sum, bestE, bestSubE, bestP, bestSubP, useOne, useOneP };
  tables.set(n, t); return t;
}
// Best move (a sub-mask) for this roll by expected score, or 0 when stuck.
export function bestMove(n, open, total) { const t = solver(n); const i = open * 13 + total; return total > 12 || t.bestE[i] === Infinity ? 0 : t.bestSubE[i]; }
export const expectedScore = (n, open) => solver(n).E[open];
export const shutChance = (n, open) => solver(n).P[open];
// Should the best player roll one die here (when allowed)?
export const bestSingle = (n, open) => singleAllowed(open) && solver(n).useOne[open] === 1;
// Chance that the next roll has at least one legal move.
export function playableChance(n, open, single) {
  const probs = single ? P1 : P2; let p = 0;
  for (let r = 1; r <= 12; r++) if (probs[r] && legalSubs(open, r).length) p += probs[r];
  return p;
}
// Moves for this roll ranked best first by the expected final score they lead to.
export function rankedMoves(n, open, total) {
  const t = solver(n);
  return legalSubs(open, total).map((sub) => ({ sub, e: t.E[open ^ sub], p: t.P[open ^ sub] })).sort((a, b) => a.e - b.e || a.sub - b.sub);
}
// The "bigger tile first" habit: the legal move containing the highest tile (used to explain why the solver differs).
export function greedyMove(open, total) {
  let best = 0, hi = -1;
  for (const s of legalSubs(open, total)) { const top = 32 - Math.clz32(s); if (top > hi || (top === hi && countBits(s) < countBits(best))) { hi = top; best = s; } }
  return best;
}
