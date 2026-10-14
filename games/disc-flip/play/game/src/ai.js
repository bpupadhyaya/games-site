// The computer rivals. A planner lists targeted shots (pot it, hop to a good spot near the cup, squop a rival wink, blast a
// pile), tries each a few times with the same physics the player gets (so it expects its own misses), and scores the board
// afterwards. The profile decides how well it chooses (k) and how steady its hand is (m).
import {
  SQUIDGERS, TOUCH, POT, cloneMat, takeShot, freeWinks, isSquopped, pileOf, powerFor, lcg, dist, clamp,
} from './sim.js';

// m: spread multiplier of the rival's hand (lower is steadier). k: picks at random among its best k shots (1 = always the
// best). bomb / squop: how willing it is to blast piles / freeze rival winks. think: seconds before it moves.
export const PROFILES = [
  { name: 'Pip', tag: 'Gentle and wobbly', stars: 1, m: 1.75, k: 7, bomb: 0.2, squop: 0.6, samples: 3, think: [0.8, 1.6] },
  { name: 'Tilly', tag: 'Quick and cheerful', stars: 2, m: 1.4, k: 3, bomb: 0.5, squop: 0.9, samples: 4, think: [0.8, 1.7] },
  { name: 'Mr Fenn', tag: 'Loves a squop', stars: 3, m: 1.15, k: 2, bomb: 0.8, squop: 1.25, samples: 6, think: [1.0, 2.1] },
  { name: 'Dame Harriet', tag: 'Champion of the mat', stars: 5, m: 0.95, k: 1, bomb: 1, squop: 1.2, samples: 8, think: [1.2, 2.4] },
  { name: 'Hint', tag: '', stars: 5, m: 0.9, k: 1, bomb: 1, squop: 1.1, samples: 10, think: [0, 0] },
];

const potDist = (w) => dist(w.x, w.y, POT.x, POT.y);
const closeness = (w) => clamp(1 - Math.max(0, potDist(w) - POT.r) / 470, 0, 1);

// Value of a board for `side` (higher is better for it). prog scales how much it values position over pots.
export function evaluate(mat, side, prog = 1) {
  let v = (mat.potted[side] - mat.potted[1 - side]) * 100;
  for (const w of mat.winks) {
    if (w.pot) continue;
    const sq = isSquopped(mat, w);
    const c = closeness(w) * 26 * prog * (sq ? 0.15 : 1);
    v += w.side === side ? c : -c * 0.9;
    // a wink lying near the cup mouth is a pot waiting to happen
    if (!sq && potDist(w) < POT.r + 70) v += (w.side === side ? 1 : -1) * 18 * prog;
  }
  return v;
}

const ANG_STEPS = 12;
function candidates(mat, side) {
  const free = freeWinks(mat, side);
  const rivals = mat.winks.filter((w) => !w.pot && w.side !== side && !w.air);
  const out = [];
  const spots = [];
  for (const r of [POT.r + 38, POT.r + 80]) {
    for (let i = 0; i < ANG_STEPS; i++) {
      const a = (i / ANG_STEPS) * Math.PI * 2 + 0.13;
      spots.push({ x: POT.x + Math.cos(a) * r, y: POT.y + Math.sin(a) * r, kind: 'approach' });
    }
  }
  const piles = [];
  const seen = new Set();
  for (const q of mat.winks) {
    if (q.pot || q.air || seen.has(q.id)) continue;
    const p = pileOf(mat, q);
    p.forEach((x) => seen.add(x.id));
    if (p.length >= 2) {
      const cx = p.reduce((s, x) => s + x.x, 0) / p.length, cy = p.reduce((s, x) => s + x.y, 0) / p.length;
      piles.push({ x: cx, y: cy, kind: 'bomb', pile: p });
    }
  }
  for (const w of free) {
    const tgts = [{ x: POT.x, y: POT.y, kind: 'pot' }];
    for (const s of spots) {
      if (dist(s.x, s.y, w.x, w.y) < 40) continue;
      if (mat.winks.some((q) => !q.pot && !q.air && q !== w && dist(q.x, q.y, s.x, s.y) < TOUCH + 4)) continue;
      tgts.push(s);
    }
    for (const r of rivals) tgts.push({ x: r.x, y: r.y, kind: 'squop', ref: r });
    for (const p of piles) tgts.push(p);
    for (const t of tgts) {
      const d = dist(w.x, w.y, t.x, t.y);
      if (d < 6) continue;
      for (const sq of SQUIDGERS) {
        if (d > sq.range * 0.99 || d < sq.range * 0.06) continue;
        if (t.kind === 'bomb' && !sq.bomb) continue;
        if (t.kind !== 'bomb' && sq.bomb && d < 150) continue;
        out.push({ w, t, sq: sq.id, d, angle: Math.atan2(t.y - w.y, t.x - w.x), power: powerFor(sq.id, d) });
      }
    }
  }
  return out;
}

// Plan one shot. Returns { id, sq, angle, power, kind, odds, score } or null when nothing can move.
// o.roundsLeft shapes how much it values position over pots near the end; o.seed varies the sampling.
export function planShot(mat, side, prof, rng, o = {}) {
  const base = evaluate(mat, side, 1);
  const cands = candidates(mat, side);
  if (!cands.length) return null;
  const prog = clamp((o.roundsLeft ?? 99) / 8, 0.15, 1);
  const seed = (((o.seed ?? 1) * 2654435761) + mat.winks.length * 977) >>> 0;
  const scored = [];
  for (const c of cands) {
    const S = prof.samples, r = lcg(seed + c.w.id * 31 + c.sq * 7 + Math.floor(c.d));
    let sum = 0, pot = 0, sqp = 0, off = 0;
    for (let i = 0; i < S; i++) {
      const m2 = cloneMat(mat);
      const res = takeShot(m2, { id: c.w.id, sq: c.sq, angle: c.angle, power: c.power, m: prof.m }, r);
      let v = evaluate(m2, side, prog);
      if (res.bonus) v += 34;
      if (res.kind === 'pot') pot++;
      if (res.kind === 'squop') sqp++;
      if (res.kind === 'off') { off++; v -= 12; }
      sum += v;
    }
    let score = sum / S - base;
    if (c.t.kind === 'squop') score *= score > 0 ? prof.squop : 1;
    if (c.t.kind === 'bomb') score *= score > 0 ? prof.bomb : 1;
    score -= SQUIDGERS[c.sq].scatter * 0.8;
    scored.push({ c, score, pot: pot / S, squop: sqp / S, off: off / S });
  }
  scored.sort((a, b) => b.score - a.score || a.c.w.id - b.c.w.id || a.c.sq - b.c.sq);
  const k = Math.max(1, Math.min(prof.k, scored.length));
  const pick = scored[k === 1 ? 0 : Math.floor(rng.next() * rng.next() * k)];
  const c = pick.c;
  return {
    id: c.w.id, sq: c.sq, angle: c.angle, power: c.power, kind: c.t.kind, target: { x: c.t.x, y: c.t.y },
    odds: { pot: pick.pot, squop: pick.squop, off: pick.off }, score: pick.score, dist: c.d,
  };
}

// Execute a plan with the rival's own imperfection in the aim (small angle and power wobble on top of the spread).
export function wobble(plan, prof, rng) {
  const a = (rng.next() + rng.next() - 1) * 0.02 * prof.m;
  const p = (rng.next() + rng.next() - 1) * 0.035 * prof.m;
  return { id: plan.id, sq: plan.sq, angle: plan.angle + a, power: clamp(plan.power + p, 0.03, 1), m: prof.m };
}

export function describe(plan, name) {
  const sq = SQUIDGERS[plan.sq].name;
  const pct = (x) => `${Math.round(x * 100)}%`;
  if (plan.kind === 'pot') return `${name}: ${sq} straight at the cup (${pct(plan.odds.pot)} to pot)`;
  if (plan.kind === 'squop') return `${name}: ${sq} to land on a rival wink and freeze it (${pct(plan.odds.squop)})`;
  if (plan.kind === 'bomb') return `${name}: Bomber to blast a pile apart`;
  return `${name}: ${sq} hops closer to the cup`;
}
