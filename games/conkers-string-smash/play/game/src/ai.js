// The computer players and the Think hint. Both use the real physics: a table of swings (pull-back, hand height, flick, and the moment of
// release against the defender's sway) is simulated, each one is valued by the damage it deals minus the damage it takes, and a player then
// picks from the top of the table (a stronger player picks nearer the top) and swings with smaller errors.
import { runSwing, WOBBLE_PERIOD, PULL_MIN, PULL_MAX, advanceD } from './sim.js';
import { touchDamage, statsOf, stageOf } from './engine.js';

// skill 0..3; err = 1 sigma of the hand: pull (rad), hand height, release moment (s); pick = how far down the table it may choose.
export const SKILLS = [
  { err: [0.28, 0.7, 0.2], pick: 10, aggr: 0.7, think: [1.0, 1.8], maxPull: 1.4, flick: false },
  { err: [0.18, 0.45, 0.12], pick: 6, aggr: 0.85, think: [1.1, 2.0], maxPull: 1.55, flick: true },
  { err: [0.1, 0.25, 0.06], pick: 3, aggr: 1.0, think: [1.2, 2.2], maxPull: 1.75, flick: true },
  { err: [0.05, 0.12, 0.03], pick: 1, aggr: 1.05, think: [1.3, 2.4], maxPull: 1.75, flick: true },
];
// A person's hand, by the Steadiness setting (same units as `err`).
export const STEADY = [
  { name: 'Steady', err: [0.04, 0.1, 0.02] },
  { name: 'Normal', err: [0.07, 0.17, 0.035] },
  { name: 'Shaky', err: [0.11, 0.26, 0.06] },
];

export const PULLS = [0.5, 0.65, 0.8, 0.95, 1.1, 1.25, 1.4, 1.55, 1.7];
export const HANDS = [-1, -0.5, 0, 0.5, 1];
export const FLICKS = [0, 1];
export const DELAYS = 16;

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const gaussOf = (rn) => { let u = 0; while (u < 1e-9) u = rn(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * rn()); };

// What a swing does to the two conkers (no randomness): { E, dD, dS, hit, weak }
export function evaluate(plan, d0, cs, cd) {
  const r = runSwing(plan, d0, statsOf(cs).mass, statsOf(cd).mass, d0.sw);
  let dD = 0, dS = 0, weak = false;
  for (const h of r.s.hits) { const t = touchDamage(h, cs, cd, 1); dD += t.dD; dS += t.dS; if (t.wD > 1.45) weak = true; }
  return { E: r.E, hit: r.hit, dD, dS, weak, first: r.first };
}
export const valueOf = (e, cs, cd, aggr = 1) => {
  if (!e.hit) return -0.004;
  const kill = cd.dmg + e.dD >= 1 ? 1.5 : 0, die = cs.dmg + e.dS >= 1 && !(cd.dmg + e.dD >= 1) ? 1.8 : 0;
  return aggr * e.dD - 0.85 * e.dS + kill - die;
};

// The table. d0 = the defender's conker { phi, om, sw } at the moment the striker's conker would start to be drawn back (sw = the wobble: { A, c }).
export function swingTable(cs, cd, d0, aggr = 1, limit = null) {
  const out = [];
  for (const pull of PULLS) for (const hand of HANDS) for (const flick of FLICKS) {
    if (limit && (pull > limit.maxPull || (flick && !limit.flick))) continue;
    let best = null;
    for (let i = 0; i < DELAYS; i++) {
      const delay = (i * WOBBLE_PERIOD) / DELAYS;
      const e = evaluate({ pull, hand, flick, delay }, d0, cs, cd);
      const v = valueOf(e, cs, cd, aggr);
      if (!best || v > best.val) best = { pull, hand, flick, delay, val: v, e };
    }
    out.push(best);
  }
  out.sort((a, b) => b.val - a.val || a.pull - b.pull);
  return out;
}

// How steady a plan is when the hand is not perfect: the mean value over a few noisy copies (used to rank the top of the table and to explain a hint).
export function robust(plan, d0, cs, cd, err, n, rn, aggr = 1) {
  let sum = 0, hits = 0, weak = 0, dd = 0, ds = 0, worst = 9;
  for (let q = 0; q < n; q++) {
    const p = noisy(plan, err, rn);
    const e = evaluate(p, d0, cs, cd);
    const v = valueOf(e, cs, cd, aggr);
    sum += v; worst = Math.min(worst, v);
    if (e.hit) { hits++; dd += e.dD; ds += e.dS; } if (e.weak) weak++;
  }
  return { mean: sum / n, hits, n, weak, dD: hits ? dd / hits : 0, dS: hits ? ds / hits : 0, worst };
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function noisy(plan, err, rn) {
  return {
    pull: clamp(plan.pull + err[0] * gaussOf(rn), PULL_MIN, PULL_MAX),
    hand: clamp(plan.hand + err[1] * gaussOf(rn), -1, 1),
    flick: plan.flick,
    delay: Math.max(0, plan.delay + err[2] * gaussOf(rn)),
  };
}

// A computer player's choice: ranks the table by how well each swing holds up with its own hand error, and picks near the top.
export function choosePlan(cs, cd, d0, skill, rn) {
  const sk = SKILLS[skill], table = swingTable(cs, cd, d0, sk.aggr, sk);
  const top = table.slice(0, Math.max(sk.pick * 3, 6));
  const seed = mulberry(Math.round(d0.phi * 1e4) + 17);
  top.forEach((c) => { c.rob = robust(c, d0, cs, cd, sk.err, 4, seed, sk.aggr).mean; });
  top.sort((a, b) => b.rob - a.rob);
  const pick = top[Math.min(top.length - 1, Math.floor(rn() * rn() * sk.pick))];
  return { plan: { pull: pick.pull, hand: pick.hand, flick: pick.flick, delay: pick.delay }, table, pick, top };
}
// The plan with a hand error applied, as the player actually performs it.
export const performPlan = (plan, skill, rn) => noisy(plan, SKILLS[skill].err, rn);

// The words for a hint or for Watch & Learn: what to do and why, from measured numbers.
export const handWord = (h) => (h <= -0.75 ? 'low' : h <= -0.25 ? 'a little low' : h < 0.25 ? 'middle height' : h < 0.75 ? 'a little high' : 'high');
export function explain(pick, rob, cs, cd) {
  const deg = Math.round((pick.pull * 180) / Math.PI);
  const parts = [`Pull back to about ${deg} degrees, hand ${handWord(pick.hand)}${pick.flick ? ', and flick as you let go' : ''}.`];
  const n = rob.n;
  parts.push(`Tested with ${n} slightly shaky swings: ${rob.hits} touched${rob.weak ? `, ${rob.weak} on the pale patch` : ''}.`);
  if (rob.hits) {
    const dD = Math.round(rob.dD * 100), dS = Math.round(rob.dS * 100);
    parts.push(`A touch costs their conker about ${dD}% and yours about ${dS}%.`);
    if (cd.dmg + rob.dD >= 1) parts.push('That can finish their conker.');
    else if (cs.dmg + rob.dS >= 0.9) parts.push('Careful: your own conker is close to breaking.');
  } else parts.push('It may miss; wait for the best moment.');
  if (pick.e && pick.e.weak) parts.push('It lands on their pale patch.');
  return parts.join(' ');
}
export { stageOf, advanceD };
