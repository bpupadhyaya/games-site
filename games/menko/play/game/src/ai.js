// The computer rivals. A planner scores slam candidates with the same odds the player sees (sim.previewSlam), a few per
// step so no frame is long, then the profile decides how well the plan is picked and how well it is carried out.
import { DESIGNS, R, FLOOR, RUG, previewSlam, clampPos, layBlocked, layPoint, onRug } from './sim.js';

// stars: shown on the setup screen. k: how many of the best candidates it may choose between (1 = always the best).
// aim / pow: execution wobble (units / strength). think: seconds the rival takes (before the player-set Watch & Learn time).
export const PROFILES = [
  { name: 'Hana', tag: 'Gentle and careful', stars: 1, k: 90, cw: 0.25, aim: 24, pow: 0.2, think: [0.9, 1.8] },
  { name: 'Ken', tag: 'Quick and cheerful', stars: 2, k: 30, cw: 0.6, aim: 15, pow: 0.12, think: [0.9, 1.8] },
  { name: 'Sora', tag: 'Reads the floor', stars: 3, k: 8, cw: 0.9, aim: 8, pow: 0.06, think: [1.2, 2.4] },
  { name: 'Master Ume', tag: 'Plays the odds', stars: 5, k: 1, cw: 1, aim: 3, pow: 0.02, think: [1.4, 2.8] },
  { name: 'Hint', tag: '', stars: 5, k: 1, cw: 1, aim: 0, pow: 0, think: [0, 0] },
];

const POWERS = [0.4, 0.55, 0.7, 0.85, 1];
const ANGLES = 8;

export function createPlanner(floor, side, hand, prof, rng, o = {}) {
  const perfect = !!o.perfect;
  const targets = floor.cards.filter((c) => c.side !== side);
  const pl = { done: false, result: null, step };
  if (!targets.length) { pl.result = layPlan(floor, hand, prof, rng, perfect); pl.done = true; return pl; }
  // one candidate disc per weight: the cheapest (fewest stars), so the strong slam does not risk a rare disc
  const byW = new Map();
  hand.forEach((d, hi) => { const w = DESIGNS[d].w, cur = byW.get(w); if (!cur || DESIGNS[d].stars < DESIGNS[hand[cur.hi]].stars) byW.set(w, { hi, d }); });
  const discs = [...byW.values()];
  const cands = [];
  for (const t of targets) {
    for (const f of [1.55, 1.8, 2.05, 2.4]) {
      for (let a = 0; a < ANGLES; a++) {
        const ang = (a / ANGLES) * Math.PI * 2 + (t.id % 5) * 0.1;
        const x = t.x + Math.cos(ang) * R * f, y = t.y + Math.sin(ang) * R * f;
        if (x < R + 8 || y < R + 8 || x > FLOOR - R - 8 || y > FLOOR - R - 8) continue;
        for (const dc of discs) for (const p of POWERS) cands.push([dc.hi, dc.d, x, y, p]);
      }
    }
  }
  let i = 0;
  const scored = [];
  function step(n = 40) {
    for (let k = 0; k < n && i < cands.length; k++, i++) {
      const [hi, d, x, y, p] = cands[i], dsg = DESIGNS[d];
      const pv = previewSlam(floor, side, d, x, y, p);
      const ev = pv.exp - (perfect ? 1 : prof.cw) * pv.pCover * (dsg.stars + 1) - 0.18 * dsg.stars;
      scored.push({ kind: 'slam', hi, d, x, y, power: p, ev, exp: pv.exp, pCover: pv.pCover, s: pv.s });
    }
    if (i >= cands.length && !pl.done) {
      scored.sort((a, b) => b.ev - a.ev || a.power - b.power);
      // distinct alternatives for the hint (different disc/spot), best first
      const alts = [];
      for (const c of scored) { if (alts.length >= 3) break; if (!alts.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < R && q.hi === c.hi)) alts.push(c); }
      const k = perfect ? 1 : Math.min(prof.k, alts.length ? scored.length : 1);
      const pool = scored.slice(0, Math.max(1, k));
      const pick = pool[Math.min(pool.length - 1, Math.floor(Math.pow(rng.next(), 1.6) * pool.length))];
      pl.result = { ...pick, alts };
      // waiting out a bad floor: if every slam loses on average, still the best one is taken (a turn must be played)
      pl.done = true;
    }
  }
  return pl;
}

function layPlan(floor, hand, prof, rng, perfect) {
  // a heavy disc with few stars: hard to flip, little to lose
  let bestHi = 0, bestS = -1e9;
  hand.forEach((d, hi) => {
    const dsg = DESIGNS[d];
    const sc = dsg.w * 1.0 - dsg.stars * 0.9 + (perfect ? 0 : (rng.next() - 0.5) * prof.k * 0.25);
    if (sc > bestS) { bestS = sc; bestHi = hi; }
  });
  let best = null;
  for (let gx = 0; gx <= 9; gx++) {
    for (let gy = 0; gy <= 9; gy++) {
      const x = clampPos(R + 8 + gx * ((FLOOR - 2 * (R + 8)) / 9)), y = clampPos(R + 8 + gy * ((FLOOR - 2 * (R + 8)) / 9));
      if (layBlocked(floor, x, y)) continue;
      let near = 400;
      for (const c of floor.cards) near = Math.min(near, Math.hypot(x - c.x, y - c.y));
      const sc = (onRug(x, y) ? 3 : 0) + Math.min(near, 220) / 110 - Math.hypot(x - RUG.x, y - RUG.y) / 600 + (perfect ? 0 : (rng.next() - 0.5) * prof.k * 0.2);
      if (!best || sc > best.sc) best = { x, y, sc };
    }
  }
  const at = best ? layPoint(floor, best.x, best.y) : layPoint(floor, RUG.x, RUG.y);
  return { kind: 'lay', hi: bestHi, d: hand[bestHi], x: at.x, y: at.y, power: 0, ev: 0, alts: [] };
}

// What the rival really does with its plan: the wobble of its hand.
export function executePlan(plan, prof, rng) {
  if (plan.kind === 'lay') return { x: plan.x, y: plan.y, power: 0, hi: plan.hi };
  const wob = () => (rng.next() + rng.next() - 1);
  return {
    x: clampPos(plan.x + wob() * prof.aim), y: clampPos(plan.y + wob() * prof.aim),
    power: Math.max(0.2, Math.min(1, plan.power + wob() * prof.pow)), hi: plan.hi,
  };
}
