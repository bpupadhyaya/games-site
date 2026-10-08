// Shot choice: shared by every computer player and by the Think hint. Each candidate (kind + landing spot) is solved with the real physics, run
// forward under the rules, and scored by how hard it is for the rival and how likely it is to be a fault at the shooter's accuracy.
import { HW, HL, SL, SHOTS, SURFACES } from './consts.js';
import { newBall, forecast } from './physics.js';
import { solveShot } from './shots.js';
import { analyse, planFor, sideOf } from './plan.js';

const XS = [-2.7, -1.6, -0.6, 0.6, 1.6, 2.7];

// Landing spots for each kind on the far side of the net as seen from a hitter on side `side` (-1 near, +1 far).
export function candidatesFor(kinds, serve, side, cpz, boxSign) {
  const out = [], os = -side;
  const add = (kind, x, d) => out.push({ kind, aim: { x, z: os * d } });
  for (const kind of kinds) {
    if (kind === 'serve1' || kind === 'serve2') {
      const xs = kind === 'serve1' ? [0.5, 1.5, 2.6] : [0.9, 2.1];
      for (const x of xs) add(kind, boxSign * x, kind === 'serve1' ? 3.9 : 3.5);
    } else if (kind === 'drive') {
      for (const x of XS) { add(kind, x, 5.6); add(kind, x, 7.9); }
    } else if (kind === 'slice') {
      for (const x of [-2.2, -0.9, 0.9, 2.2]) add(kind, x, 6.3);
    } else if (kind === 'drop') {
      if (Math.abs(cpz) > 6.6) continue;                  // a drop shot is played from the front half of the court
      for (const x of [-1.6, 0, 1.6]) add(kind, x, 1.9);
    } else if (kind === 'lob') {
      for (const x of [-2.1, 0, 2.1]) add(kind, x, 7.6);
    }
  }
  return out;
}

export const wordsFor = (aim, kind) => {
  if (kind === 'serve1' || kind === 'serve2') return Math.abs(aim.x) < 1.1 ? 'down the middle, at the T' : Math.abs(aim.x) > 2.2 ? 'wide, out to the sideline' : 'into the middle of the box';
  const depth = Math.abs(aim.z);
  const lat = Math.abs(aim.x) > 2.2 ? 'the corner' : Math.abs(aim.x) > 1.0 ? 'the side' : 'the middle';
  const len = depth > 7.0 ? 'deep' : depth > 4.6 ? 'mid-court' : 'short';
  return `${len} to ${lat}`;
};

/**
 * Evaluate every candidate. ctx = { cp (contact point), tc (time of contact), q (strike quality 0..1), sigma (aim error m), side, opps: [player],
 * serve, kinds, surf, boxSign, agg, tNow }.
 * Returns the list of { kind, aim, score, pf, fault, minSlack, A, sol } sorted best first.
 */
export function evaluate(ctx) {
  const { cp, tc, q, sigma, side, opps, serve } = ctx;
  const surf = ctx.surf || SURFACES.lawn;
  const agg = ctx.agg ?? 0.7;
  const kinds = ctx.kinds || (serve ? ['serve1', 'serve2'] : ['drive', 'slice', 'drop', 'lob']);
  const res = [];
  const flags = { serve, side: -side, boxSign: ctx.boxSign || 0, bounces: 0 };
  for (const cand of candidatesFor(kinds, serve, side, cp.z, ctx.boxSign || 0)) {
    const sol = solveShot(cp, cand.aim, cand.kind, q, surf);
    if (!sol) continue;
    const ball = newBall(cp.x, cp.y, cp.z, sol.vx, sol.vy, sol.vz, sol.wx, sol.wy, sol.wz);
    const F = forecast(ball, { maxT: 3.2, t0: tc, surf });
    const A = analyse(F, flags);
    const faulty = !!A.fault && A.tb === null || (A.fault && A.fault.reason !== 'The ball bounced twice') || (A.let && !serve);
    // robustness: perturb the launch by the aim error and count faults
    let bad = faulty ? 1 : 0;
    if (!faulty && sigma > 0.02) {
      const T = Math.max(0.3, sol.T), dv = sigma / T;
      let n = 0;
      for (const d of [[dv, 0, 0], [-dv, 0, 0], [0, 0, dv], [0, -dv * 0.5, 0]]) {
        const b2 = newBall(cp.x, cp.y, cp.z, sol.vx + d[0], sol.vy + d[1], sol.vz + d[2] * -side, sol.wx, sol.wy, sol.wz);
        const F2 = forecast(b2, { maxT: 2.4, t0: tc, surf });
        const A2 = analyse(F2, flags);
        if (A2.fault && A2.fault.reason !== 'The ball bounced twice') n++;
      }
      bad = n / 4;
    }
    let minSlack = 9;
    if (!faulty) {
      if (A.ta === null || A.let) minSlack = -3;                     // never playable: the rival cannot return it (a let is handled by the rules)
      else for (const o of opps) { const pl = planFor(o, F, A, tc); const sl = pl ? pl.slack : -3; if (sl < minSlack) minSlack = sl; }
      if (opps.length === 0) minSlack = 0;
    }
    const v = Math.max(-0.6, Math.min(1.2, -minSlack / 0.7));
    const line = A.b1 ? Math.min(HW - Math.abs(A.b1.x), (serve ? SL : HL) - Math.abs(A.b1.z)) : 1;         // distance from the nearest line
    const nearLine = line < 0.25 ? (0.25 - line) * 0.6 : 0;
    const lowNet = sol.clr < 0.1 ? 0.2 : 0;
    const score = faulty ? -1.5 : (1 - bad) * ((1 - agg) * 0.6 + agg * v) - bad * 0.9 - nearLine - lowNet + (ctx.bias && ctx.bias[cand.kind] || 0);
    res.push({ kind: cand.kind, aim: cand.aim, score, pf: bad, fault: faulty ? A.fault : null, minSlack, A, sol });
  }
  res.sort((a, b) => b.score - a.score);
  return res;
}

// Pick a candidate for a computer player of a given level (think 0..1): 1 picks the best, 0 picks any shot that is probably legal.
export function pick(list, think, rng) {
  const legal = list.filter((c) => c.pf < (think < 0.2 ? 0.55 : 0.45) && !c.fault);
  const pool = legal.length ? legal : list.slice(0, Math.max(3, list.length >> 2));
  if (think >= 0.995) return pool[0];
  const k = think * 9;
  const top = pool[0].score;
  let sum = 0;
  const w = pool.map((c) => { const x = Math.exp(k * (c.score - top)); sum += x; return x; });
  let r = rng.next() * sum;
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[0];
}

// Human readable reason for a recommendation, built from the numbers of the chosen candidate.
export function reasonFor(best, ctx) {
  const k = best.kind;
  const names = { drive: 'Drive', slice: 'Slice', drop: 'Drop shot', lob: 'Lob', serve1: 'First serve', serve2: 'Second serve' };
  const parts = [];
  parts.push(`${names[k]}: ${wordsFor(best.aim, k)}.`);
  if (ctx.serve) {
    parts.push(k === 'serve2' ? 'A safer serve with spin: a double fault costs the point.' : 'It lands in the box with room to spare and gives the receiver little time.');
    return parts.join(' ');
  }
  if (ctx.opps.length) {
    if (best.minSlack <= -2.5) parts.push('The rival has no real chance to return it.');
    else if (best.minSlack < -0.05) parts.push(`The rival would need about ${(-best.minSlack).toFixed(1)} s more than they have.`);
    else if (best.minSlack < 0.4) parts.push('It gives the rival very little time to reach it.');
    else parts.push('It is the safest return that still keeps the rival moving.');
  }
  if (best.pf > 0.25) parts.push('It is a risky line: a slightly mistimed swing may go out or into the net.');
  else parts.push('It clears the net and lands well inside the lines.');
  return parts.join(' ');
}
export { SHOTS, sideOf };
