// The computer rivals. A planner runs the real physics (sim.simulate) for a grid of throws, keeps the best few, then tests
// those against small wobbles of the hand so it prefers throws that survive a slightly imperfect delivery. The profile then
// decides how well the throw is carried out (its own wobble), so weaker rivals miss like a person does.
import { TW, R, simulate, potential, startX, ANGLE_LIMIT, V_MIN, V_MAX, laneX } from './sim.js';

// aim: sideways wobble (units), ang: angle wobble (radians), pow: strength wobble (fraction).
export const PROFILES = [
  { name: 'Anneke', tag: 'Gentle and careful', stars: 1, aim: 42, ang: 0.32, pow: 0.42, think: [0.8, 1.6], rob: 0 },
  { name: 'Joost', tag: 'Quick and cheerful', stars: 2, aim: 26, ang: 0.18, pow: 0.26, think: [0.8, 1.6], rob: 0.5 },
  { name: 'Marit', tag: 'Banks it off the rail', stars: 3, aim: 14, ang: 0.1, pow: 0.15, think: [1.0, 2.2], rob: 1 },
  { name: 'Meester Wim', tag: 'Hardly ever misses', stars: 5, aim: 5.5, ang: 0.04, pow: 0.07, think: [1.2, 2.6], rob: 1 },
  { name: 'Hint', tag: '', stars: 5, aim: 0, ang: 0, pow: 0, think: [0, 0], rob: 1 },
];

const XS = [];
for (let i = 0; i < 13; i++) XS.push(R + 2 + (i * (TW - 2 * (R + 2))) / 12);
const ANGS = [-0.3, -0.22, -0.16, -0.11, -0.07, -0.035, 0, 0.035, 0.07, 0.11, 0.16, 0.22, 0.3];
const VS = [520, 560, 600, 650, 710, 790];

// Value of a result for `side`: change in the final count of its stack.
const valueOf = (stack, caps, rem, strayDelta) => {
  const s = stack.slice();
  for (const c of caps) s[c.lane]++;
  // a disc that did not pass is still to be slid again: it costs tempo and risks being lost after the third push
  return potential(s, rem + Math.max(0, strayDelta)) - 3 * Math.max(0, strayDelta);
};

// planner(table, side, stack, prof, rng, {perfect}) -> { done, result, step(n) }
export function createPlanner(table, side, stack, prof, rng, o = {}) {
  const perfect = !!o.perfect;
  const pl = { done: false, result: null, step };
  const cands = [];
  for (const x of XS) for (const a of ANGS) for (const v of VS) cands.push({ x, angle: a, v });
  // also a straight shot under each arch lane
  for (let k = 0; k < 4; k++) for (const v of VS) for (const a of [-0.012, 0, 0.012]) cands.push({ x: laneX(k), angle: a, v });
  let i = 0, phase = 0, top = [], ti = 0;
  const first = [];
  const rem = o.remaining ?? 0;
  const evalSpec = (c) => { const r = simulate(table, { ...c, side }); return { r, g: valueOf(stack, r.caps, rem, r.table.length - table.length) }; };
  function step(n = 24) {
    if (pl.done) return;
    if (phase === 0) {
      for (let k = 0; k < n && i < cands.length; k++, i++) {
        const c = cands[i], { r, g } = evalSpec(c);
        // a little preference for shots that leave nothing in the way and do not smash into the back board
        first.push({ ...c, g, strays: r.table.length - table.length, ex: g - 0.04 * Math.max(0, r.table.length - table.length) });
      }
      if (i >= cands.length) {
        first.sort((a, b) => b.ex - a.ex);
        top = first.slice(0, perfect ? 28 : 22); phase = 1; ti = 0;
        top.forEach((t) => { t.sum = t.g; t.cnt = 1; });
      }
    } else {
      // robustness: average the result over wobbled deliveries
      const wob = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0.6, 0.6, 0.4], [-0.6, -0.6, -0.4]];
      for (let k = 0; k < Math.max(1, n >> 2) && ti < top.length; k++, ti++) {
        const t = top[ti];
        for (const w of wob) {
          const c = { x: t.x + w[0] * 3.2, angle: t.angle + w[1] * 0.018, v: t.v * (1 + w[2] * 0.05) };
          t.sum += evalSpec(c).g; t.cnt++;
        }
      }
      if (ti >= top.length) {
        for (const t of top) t.ev = 0.35 * t.g + 0.65 * (t.sum / t.cnt);
        top.sort((a, b) => b.ev - a.ev);
        const pool = perfect || prof.rob >= 1 ? top.slice(0, 3) : top.slice(0, prof.rob > 0 ? 6 : 14);
        const pick = pool[Math.min(pool.length - 1, Math.floor(Math.pow(rng.next(), 1.8) * pool.length))];
        const alts = [];
        for (const t of top) { if (alts.length >= 3) break; if (!alts.some((q) => Math.abs(q.x - t.x) < 10 && Math.abs(q.angle - t.angle) < 0.06)) alts.push(t); }
        pl.result = { x: pick.x, angle: pick.angle, v: pick.v, exp: pick.ev - potential(stack, rem + 1), gain: pick.g, alts };
        pl.done = true;
      }
    }
  }
  return pl;
}

// What the rival really does with its plan: the wobble of its hand.
export function executePlan(plan, prof, rng) {
  const wob = () => (rng.next() + rng.next() + rng.next() - 1.5) / 0.75;   // about unit spread, bell shaped
  return {
    x: startX(plan.x + wob() * prof.aim),
    angle: Math.max(-ANGLE_LIMIT, Math.min(ANGLE_LIMIT, plan.angle + wob() * prof.ang)),
    v: Math.max(V_MIN, Math.min(V_MAX, plan.v * (1 + wob() * prof.pow))),
  };
}
