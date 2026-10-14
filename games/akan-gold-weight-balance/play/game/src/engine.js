// Gold-weight balance: the rules of one order, and the solver behind hints and par.
//
// A trader has a brass pan balance, a set of cast weights (each used at most once per weighing) and a heap of gold dust.
// A weighing: put weights (and, from the Bag chapters on, the customer's bag) on the two pans, then pour dust into the LEFT
// pan until the balance levels. The dust poured goes into the bag. The order is served when the bag holds exactly the target.
//
//   dust poured d = (weights on the right, plus the bag if it sits on the right)
//                 - (weights on the left,  plus the bag if it sits on the left)           and d must be above zero.
//   the bag then holds  bag + d.
//
// Everything here is pure: no drawing, no storage, no randomness. The par of an order is the fewest weighings.

export const RULES = {
  right: { id: 'right', name: 'Right pan only', left: false, bag: false },
  both: { id: 'both', name: 'Both pans', left: true, bag: false },
  bag: { id: 'bag', name: 'Weigh the bag', left: true, bag: true },
};
export const RULE_IDS = Object.keys(RULES);
export const INF = 1e9;

const optCache = new Map();
// Every distinct net weight S = sum(right) - sum(left) a set can make, with the arrangement that uses the fewest pieces.
// assign[i] is +1 (right pan), -1 (left pan, with the dust) or 0 (stays in the tray).
export function netOptions(weights, rule) {
  const key = `${weights.join(',')}|${rule}`;
  let hit = optCache.get(key);
  if (hit) return hit;
  const R = RULES[rule], k = weights.length, signs = R.left ? [0, 1, -1] : [0, 1], best = new Map();
  const assign = new Array(k).fill(0);
  const rec = (i, sum, used) => {
    if (i === k) {
      if (sum <= 0) return;
      const old = best.get(sum);
      if (!old || used < old.used) best.set(sum, { S: sum, used, assign: assign.slice() });
      return;
    }
    for (const sg of signs) { assign[i] = sg; rec(i + 1, sum + sg * weights[i], used + (sg ? 1 : 0)); }
    assign[i] = 0;
  };
  rec(0, 0, 0);
  hit = [...best.values()].sort((a, b) => a.S - b.S);
  // the "S <= 0" arrangements still matter when the bag helps (bag on the right): keep them for the bag rule
  if (R.bag) {
    const extra = new Map();
    const rec2 = (i, sum, used) => {
      if (i === k) { if (sum <= 0) { const old = extra.get(sum); if (!old || used < old.used) extra.set(sum, { S: sum, used, assign: assign.slice() }); } return; }
      for (const sg of signs) { assign[i] = sg; rec2(i + 1, sum + sg * weights[i], used + (sg ? 1 : 0)); }
      assign[i] = 0;
    };
    rec2(0, 0, 0);
    hit = hit.concat([...extra.values()].sort((a, b) => b.S - a.S));
  }
  optCache.set(key, hit);
  return hit;
}

// Every move available when the bag holds B: the dust poured d and where it leaves the bag.
function movesFrom(weights, rule, B, cap) {
  const R = RULES[rule], opts = netOptions(weights, rule), out = [];
  const sbs = R.bag && B > 0 ? [0, 1, -1] : [0];
  for (const o of opts) for (const sb of sbs) {
    const d = o.S + sb * B;
    if (d > 0 && B + d <= cap) out.push({ assign: o.assign, sb, d, to: B + d, used: o.used + (sb ? 1 : 0) });
  }
  return out;
}

const parCache = new Map();
// Fewest weighings from an empty bag to every amount 0..cap (INF if impossible).
export function parTable(weights, rule, cap) {
  const key = `${weights.join(',')}|${rule}|${cap}`;
  let t = parCache.get(key);
  if (t) return t;
  t = new Array(cap + 1).fill(INF); t[0] = 0;
  for (let B = 0; B <= cap; B++) {
    if (t[B] >= INF) continue;
    for (const m of movesFrom(weights, rule, B, cap)) if (t[B] + 1 < t[m.to]) t[m.to] = t[B] + 1;
  }
  if (parCache.size > 80) parCache.clear();
  parCache.set(key, t);
  return t;
}
export const parOf = (weights, rule, target) => parTable(weights, rule, target)[target];

// Fewest weighings still needed from a bag of B, for every B (dist[B]); used by the hint.
export function distTo(weights, rule, target) {
  const dist = new Array(target + 1).fill(INF); dist[target] = 0;
  for (let B = target - 1; B >= 0; B--) {
    for (const m of movesFrom(weights, rule, B, target)) if (dist[m.to] + 1 < dist[B]) dist[B] = dist[m.to] + 1;
  }
  return dist;
}

// The best next weighing from a bag of B: shortest route first, then fewest pieces, then no bag, then the smallest dust.
export function bestMove(weights, rule, target, B) {
  if (B >= target) return null;
  const dist = distTo(weights, rule, target);
  if (dist[B] >= INF) return null;
  let best = null;
  for (const m of movesFrom(weights, rule, B, target)) {
    if (dist[m.to] !== dist[B] - 1) continue;
    const key = [m.used, m.sb ? 1 : 0, m.d];
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && key[2] < best.key[2])))) best = { ...m, key };
  }
  if (best) delete best.key;
  return best;
}

// What the pans hold for a given arrangement. `sides[i]` is 'tray' | 'left' | 'right'; `bagSide` the same for the bag.
export function weighUp(weights, sides, bagSide, bag) {
  let left = 0, right = 0;
  weights.forEach((w, i) => { if (sides[i] === 'left') left += w; else if (sides[i] === 'right') right += w; });
  if (bagSide === 'left') left += bag; else if (bagSide === 'right') right += bag;
  return { left, right, dust: right - left };
}

// Plain-language steps for a move (used by the hint and Watch and Learn).
export function describeMove(weights, rule, move, B, target) {
  const rightW = [], leftW = [];
  move.assign.forEach((sg, i) => { if (sg > 0) rightW.push(weights[i]); else if (sg < 0) leftW.push(weights[i]); });
  const items = (ws, bag) => { const a = ws.map((v) => `the ${v}`); if (bag) a.unshift(`the bag (${B})`); return a.length === 1 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; };
  const parts = [];
  if (rightW.length || move.sb > 0) parts.push(`${items(rightW, move.sb > 0)} on the right pan`);
  if (leftW.length || move.sb < 0) parts.push(`${items(leftW, move.sb < 0)} on the left pan, next to the dust`);
  const put = parts.length ? `Put ${parts.join(', and ')}.` : 'Leave the pans empty.';
  const rs = rightW.reduce((a, b) => a + b, 0) + (move.sb > 0 ? B : 0), ls = leftW.reduce((a, b) => a + b, 0) + (move.sb < 0 ? B : 0);
  let sum;
  if (ls) sum = `The right pan weighs ${rs} and the left pan ${ls}, so the dust has to make up ${rs} - ${ls} = ${move.d}.`;
  else sum = `The right pan weighs ${rs}, so the dust has to make up ${move.d}.`;
  return { put, sum, rightW, leftW, text: `${put} ${sum} Pour it and the bag will hold ${move.to}${move.to === target ? ', exactly the order' : ''}.` };
}

// ---- level generation -----------------------------------------------------------------------------------------------------
// Weight pools per rule. A "set" is the weights the trader owns for that order.
export const POOLS = {
  right: [[1, 2, 5], [1, 3, 4], [2, 3, 7], [1, 5, 10], [2, 5, 9], [3, 4, 10], [1, 4, 6], [2, 4, 5, 11], [1, 3, 8], [2, 3, 6, 12]],
  both: [[1, 3, 9], [2, 7], [1, 4, 13], [3, 5], [2, 3, 11], [1, 5, 8], [4, 9], [2, 6, 7], [1, 3, 8]],
  bag: [[1, 3], [2, 5], [1, 4], [3, 7], [2, 3, 8], [1, 5, 12], [2, 7], [4, 5], [1, 6], [3, 8, 10], [2, 4, 9], [1, 4, 10], [3, 5, 11], [2, 6, 9], [1, 7, 11], [2, 9], [3, 4], [1, 7], [5, 6], [3, 10]],
};
// Tier windows: [min par, max par, min target, max target].
export const TIER_SPEC = {
  right: [[2, 3, 12, 40], [3, 4, 25, 70], [4, 6, 45, 120]],
  both: [[2, 3, 12, 40], [3, 4, 25, 70], [4, 6, 45, 120]],
  bag: [[2, 3, 12, 50], [3, 4, 30, 90], [4, 6, 50, 160], [5, 6, 70, 170]],
};
const MAXT = 170;

// An order for a rule and tier, chosen with `pick(n)` (a function returning an integer below n). Deterministic for a given pick sequence.
export function makeOrder(rule, tier, pick, filter = null) {
  const pool = filter ? POOLS[rule].filter((w) => w.length >= filter[0] && w.length <= filter[1]) : POOLS[rule], spec = TIER_SPEC[rule][Math.max(0, Math.min(TIER_SPEC[rule].length - 1, tier))];
  for (let tries = 0; tries < 24; tries++) {
    const weights = pool[pick(pool.length)].slice();
    const t = parTable(weights, rule, spec[3]);
    const lo = spec[2], hi = spec[3], cand = [];
    for (let v = lo; v <= hi; v++) {
      if (t[v] < spec[0] || t[v] > spec[1]) continue;
      if (rule === 'bag') { const alt = parTable(weights, 'both', spec[3])[v]; if (!(t[v] < alt)) continue; }
      cand.push(v);
    }
    if (cand.length) { const target = cand[pick(cand.length)]; return { weights, rule, target, par: t[target] }; }
  }
  // fall back to anything reachable for the first set
  const weights = pool[0].slice(), t = parTable(weights, rule, spec[3]);
  for (let v = spec[3]; v > 1; v--) if (t[v] < INF && t[v] >= 2) return { weights, rule, target: v, par: t[v] };
  return { weights, rule, target: 7, par: parOf(weights, rule, 7) };
}
export { MAXT };

// ---- the Journey: five market days, six orders each. Pure functions of (chapter, index), identical for everyone. ----------------
export const JOURNEY = [
  { rule: 'right', tiers: [0, 0, 0, 1, 1, 1], filter: null },
  { rule: 'both', tiers: [0, 0, 1, 1, 1, 2], filter: null },
  { rule: 'bag', tiers: [0, 0, 0, 1, 1, 1], filter: null },
  { rule: 'bag', tiers: [1, 1, 2, 2, 2, 2], filter: [3, 3] },
  { rule: 'bag', tiers: [2, 2, 3, 3, 3, 3], filter: [2, 2] },
];
export const lcg = (seed) => { let s = (seed >>> 0) || 1; return (n) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s >>> 8) % n; }; };
const jcache = new Map();
export function journeyOrder(ci, i) {
  const key = `${ci}:${i}`;
  let o = jcache.get(key);
  if (o) return o;
  const J = JOURNEY[ci], pick = lcg(1000 + ci * 97 + i * 13);
  for (let k = 0; k < 12; k++) {
    o = makeOrder(J.rule, J.tiers[i], pick, J.filter);
    let dup = false;
    for (let j = 0; j < i; j++) { const q = journeyOrder(ci, j); if (q.target === o.target && q.weights.join() === o.weights.join()) dup = true; }
    if (!dup) break;
  }
  jcache.set(key, o);
  return o;
}
