// Opponents. Each one is a hand with a spread (sigma, in mm on the board) and habits. The decision of WHAT to aim at
// comes from a table of expected darts-to-finish worked out for that very spread (value iteration over the remaining
// score), so a weak player goes for big safe areas, a strong one for trebles and the right doubles, and everybody
// avoids busts and awkward leaves for their own reasons. Pure and deterministic; no randomness except what the caller passes in.
import { hitAt, TARGETS, targetByLabel, bestRoute, prettyLabel } from './engine.js';

// avg is the 3-dart average the spread gives over a real leg in the game (bounce-outs and busts included), checked by simulation of whole 501 legs; the sigmas were re-tuned in the 1.0.1 review.
export const PROFILES = [
  { name: 'Dot the Landlady', short: 'Dot', tag: 'Friendly, steady, no hurry', stars: 1, sigma: 20.3, avg: 30, wobble: 0.18, nerve: 0.35, form: 0.10, think: [0.9, 1.8], hue: 28 },
  { name: 'Gaz from the Corner', short: 'Gaz', tag: 'Big hitter, loose aim', stars: 2, sigma: 14.5, avg: 45, wobble: 0.14, nerve: 0.30, form: 0.10, think: [0.8, 1.6], hue: 200 },
  { name: 'Marguerite', short: 'Marg', tag: 'Cool head, tidy doubles', stars: 3, sigma: 11.2, avg: 60, wobble: 0.10, nerve: 0.22, form: 0.08, think: [0.7, 1.5], hue: 330 },
  { name: 'Old Fergus', short: 'Fergus', tag: 'Forty years at the oche', stars: 4, sigma: 8.7, avg: 75, wobble: 0.07, nerve: 0.16, form: 0.07, think: [0.6, 1.3], hue: 120 },
  { name: 'The Quiet Lad', short: 'Quiet Lad', tag: 'Hardly ever misses twice', stars: 5, sigma: 6.3, avg: 90, wobble: 0.04, nerve: 0.10, form: 0.05, think: [0.5, 1.1], hue: 265 },
];

const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
export function gauss(next) {
  const u = Math.max(1e-9, next()), v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const N = 96;
const tableCache = new Map();
// Expected darts to finish from every score for a hand with this sigma (lower is better), plus the outcome samples.
export function skillTable(sigma, start) {
  const key = `${sigma}:${start}`;
  if (tableCache.has(key)) return tableCache.get(key);
  const rnd = lcg(Math.round(sigma * 977) + 13);
  const noise = [];
  for (let k = 0; k < N; k++) noise.push([gauss(rnd) * 0.9, gauss(rnd) * 1.1]);
  const outcomes = TARGETS.map((t) => noise.map(([zx, zy]) => { const h = hitAt(t.at[0] + zx * sigma, t.at[1] + zy * sigma); return { value: h.value, mult: h.mult }; }));
  const E = new Float64Array(start + 1);
  E[0] = 0; E[1] = Infinity;
  const w = 1 / N;
  for (let rem = 2; rem <= start; rem++) {
    let best = Infinity;
    for (let ti = 0; ti < TARGETS.length; ti++) {
      const outs = outcomes[ti];
      let sum = 0, same = 0, extra = 0;
      for (let k = 0; k < N; k++) {
        const o = outs[k];
        if (o.value === 0) { same += w; continue; }
        const left = rem - o.value;
        if (left < 0 || left === 1 || (left === 0 && o.mult !== 2)) { same += w; extra += w; continue; }
        if (left > 0) sum += w * E[left];
      }
      if (same > 0.995) continue;
      const cost = (1 + extra + sum) / (1 - same);
      if (cost < best) best = cost;
    }
    E[rem] = best;
  }
  const table = { E, outcomes, sigma, start };
  tableCache.set(key, table);
  return table;
}

// What to aim at with `dl` darts in hand. Returns { target, alts: [{target, cost}], cost, reason }.
export function chooseAim(table, rem, dl, startRem, rnd, wobble = 0) {
  const { E, outcomes } = table;
  const w = 1 / N;
  const scored = [];
  for (let ti = 0; ti < TARGETS.length; ti++) {
    const outs = outcomes[ti];
    let cost = 1;
    for (let k = 0; k < N; k++) {
      const o = outs[k];
      if (o.value === 0) { cost += w * E[rem]; continue; }
      const left = rem - o.value;
      if (left < 0 || left === 1 || (left === 0 && o.mult !== 2)) { cost += w * (E[startRem] + (dl - 1)); continue; }
      if (left > 0) cost += w * E[left];
    }
    scored.push({ target: TARGETS[ti], cost });
  }
  scored.sort((a, b) => a.cost - b.cost);
  let pick = scored[0];
  if (wobble > 0 && rnd() < wobble) {
    const alt = scored.slice(1, 3).filter((s) => s.cost - scored[0].cost < 0.35);
    if (alt.length) pick = alt[Math.floor(rnd() * alt.length)];
  }
  return { target: pick.target, alts: scored.slice(0, 3), cost: pick.cost, best: scored[0] };
}

// Why this aim, in plain words (shown in Watch & Learn).
export function explain(rem, dl, aim) {
  const t = aim.target;
  const route = bestRoute(rem, dl);
  if (route && route[0].label === t.label) {
    return route.length === 1 ? `${rem} left: ${prettyLabel(t.label)} wins the leg.` : `${rem} left: ${route.length} darts to finish, ${route.map((r) => r.label).join(' then ')}.`;
  }
  if (rem <= 170 && bestRoute(rem, 3)) return `${rem} left: ${prettyLabel(t.label)} keeps a finish in reach and lowers the risk.`;
  if (rem > 170) return `${rem} left: score big, ${prettyLabel(t.label)} is the best point-getter for this hand.`;
  return `${rem} left: ${prettyLabel(t.label)} sets up a double for the next visit.`;
}

// Where the dart actually lands (mm) when this hand aims at `target`.
export function throwAt(target, prof, mods, rnd) {
  const s = prof.sigma * mods.form * (mods.pressure ? 1 + prof.nerve : 1);
  const gx = gauss(rnd), gy = gauss(rnd);
  return { x: target.at[0] + mods.bias[0] + gx * s * 0.9, y: target.at[1] + mods.bias[1] + gy * s * 1.1 };
}
export const newVisitBias = (prof, rnd) => [gauss(rnd) * prof.sigma * 0.3, gauss(rnd) * prof.sigma * 0.3];
export const newForm = (prof, rnd) => 1 + (rnd() * 2 - 1) * prof.form;
export const labelTarget = targetByLabel;
