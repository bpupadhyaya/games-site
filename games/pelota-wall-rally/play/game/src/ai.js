// Shot choice: shared by every computer player and by the Think hint. Each candidate (kind + aim point) is solved with the real physics,
// run forward under the rules, and scored by how hard it is for the rivals and how likely it is to be a fault at the shooter's accuracy.
import { HW, L, TOP, TIN, SHOTS, SERVE_SHOT_IDS, SHOT_IDS, WALL_H } from './consts.js';
import { newBall, forecast } from './physics.js';
import { solveShot, frontAim, leftAim } from './shots.js';
import { analyse, planFor } from './plan.js';

const FRONT_X = [-1.8, -0.9, 0, 0.9, 1.8];

export function candidatesFor(kinds, serve, cpz = 5) {
  const out = [];
  for (const kind of kinds) {
    if (kind === 'drive' || kind === 'power') {
      const ys = serve ? [2.2, 3.1] : [1.5, 2.5];
      for (const y of ys) for (const x of FRONT_X) out.push({ kind, aim: frontAim(x, y) });
      if (!serve) for (const z of [7.5, 9]) out.push({ kind, aim: leftAim(z, 2.0) });
    } else if (kind === 'drop') {
      if (cpz < 4.8) continue;                     // a drop shot is played from the front half of the court
      for (const x of FRONT_X) out.push({ kind, aim: frontAim(x, 1.05) });
    } else if (kind === 'lob') {
      for (const x of FRONT_X) out.push({ kind, aim: frontAim(x, 3.7) });
    }
  }
  return out;
}

const wallLabel = (aim) => (aim.wall === 'left' ? 'the left wall first' : aim.x > 1.8 ? 'the left corner of the front wall' : aim.x > 0.7 ? 'the left side of the front wall' : aim.x < -1.8 ? 'the right corner of the front wall' : aim.x < -0.7 ? 'the right side of the front wall' : 'the middle of the front wall');
export { wallLabel };

/**
 * Evaluate every candidate. ctx = { cp (contact point {x,y,z}), tc (time of contact), equip, q (strike quality 0..1), sigma (aim error m),
 * opps: [player], serve: bool, kinds }.
 * Returns the list of { kind, aim, score, pf, fault, minSlack, A, sol } sorted best first.
 */
export function evaluate(ctx) {
  const { cp, tc, equip, q, sigma, opps, serve } = ctx;
  const agg = ctx.agg ?? 0.7;
  const RB = ctx.role === 'front' ? { drop: 0.2, lob: -0.25 } : ctx.role === 'back' ? { lob: 0.14, drop: -0.1 } : {};   // roles play differently: the front player volleys and drops, the back player lobs and drives deep
  const kinds = ctx.kinds || (serve ? SERVE_SHOT_IDS : SHOT_IDS);
  const res = [];
  for (const cand of candidatesFor(kinds, serve, cp.z)) {
    const sol = solveShot(cp, cand.aim, cand.kind, equip, q);
    const ball = newBall(cp.x, cp.y, cp.z, sol.vx, sol.vy, sol.vz, sol.wx, sol.wy, sol.wz);
    const F = forecast(ball, { maxT: 3.6, t0: tc });
    const flags = { serve, frontHit: false, bounces: 0 };
    const A = analyse(F, flags);
    const faulty = !!A.fault && A.tb === null || (A.fault && A.fault.reason !== 'The ball bounced twice');
    // robustness: perturb the launch by the aim error and count faults
    let bad = faulty ? 1 : 0;
    if (!faulty && sigma > 0.02) {
      const T = Math.max(0.2, sol.T), dv = sigma / T;
      const pert = cand.aim.wall === 'left' ? [[0, 0, dv], [0, 0, -dv], [0, dv, 0], [0, -dv, 0]] : [[dv, 0, 0], [-dv, 0, 0], [0, dv, 0], [0, -dv, 0]];
      let n = 0;
      for (const d of pert) {
        const b2 = newBall(cp.x, cp.y, cp.z, sol.vx + d[0], sol.vy + d[1], sol.vz + d[2], sol.wx, sol.wy, sol.wz);
        const F2 = forecast(b2, { maxT: 3.2, t0: tc });
        const A2 = analyse(F2, flags);
        if (A2.fault && (A2.tb === null || A2.fault.reason !== 'The ball bounced twice')) n++;
      }
      bad = n / pert.length;
    }
    let minSlack = 9;
    if (!faulty) {
      if (A.ta === null) minSlack = -3;                     // never playable: the rival cannot return it
      else for (const o of opps) { const pl = planFor(o, F, A, tc, equip); const sl = pl ? pl.slack : -3; if (sl < minSlack) minSlack = sl; }
      if (opps.length === 0) minSlack = 0;
    }
    const v = Math.max(-0.6, Math.min(1.2, -minSlack / 0.7));
    const score = faulty ? -1.5 : (1 - bad) * ((1 - agg) * 0.6 + agg * v) - bad * 0.9 + (RB[cand.kind] || 0);
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
  const where = wallLabel(best.aim);
  const names = { drive: 'Drive', power: 'Power serve', drop: 'Drop shot', lob: 'Lob' };
  const parts = [];
  parts.push(`${names[k]} to ${where}.`);
  if (ctx.serve) {
    parts.push('It strikes the wall above the serve line and lands beyond the short line.');
    return parts.join(' ');
  }
  if (ctx.opps.length) {
    const far = ctx.opps.map((o) => ({ o, d: Math.hypot(o.x - 0, o.z) }));
    void far;
    if (best.minSlack <= -2.5) parts.push('It leaves the rivals no real chance to return it.');
    else if (best.minSlack < -0.05) parts.push(`The nearest rival would need about ${(-best.minSlack).toFixed(1)} s more than they have.`);
    else if (best.minSlack < 0.4) parts.push('It gives the rivals very little time to reach it.');
    else parts.push('It is the safest return that still keeps them moving.');
  }
  if (best.pf > 0.25) parts.push('It is a risky line: a slightly mistimed swing may fault.');
  else parts.push(`It clears the tin by a wide margin and stays below the top line.`);
  return parts.join(' ');
}
export { TOP, TIN, WALL_H, HW, L };
