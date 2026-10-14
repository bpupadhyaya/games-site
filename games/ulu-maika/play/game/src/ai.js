// Computer players: search the roll (sight angle, power, lean) on a copy of the course with the real physics, prefer rolls that
// still score when the release wobbles, then execute the chosen roll with the rival's own wobble. Incremental: `step(n)` runs n sims.
import { simulate, clamp, ANG_MAX } from './sim.js';

const LEANS = [0, -1, 1, -2, 2];
const gauss = (rng) => (rng.next() + rng.next() + rng.next() - 1.5) * 1.6;   // roughly normal, sd about 0.8

export function createPlanner(track, prof, rng) {
  const jig = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  const sa = Math.max(prof.ang, 0.004), sp = Math.max(prof.pow, 0.015);
  let stage = 0, k = 0;
  const coarse = [];
  for (let a = -0.2; a <= 0.2001; a += 0.02) for (let p = 0.2; p <= 1.0001; p += 0.05) for (const l of LEANS) coarse.push({ ang: a, power: p, lean: l });
  const pool = [];
  let refine = [], robust = [];
  const P = { done: false, sims: 0, result: null };
  const score = (r) => r.points - 0.02 * Math.abs(r.lean ?? 0) + (r.hit ? 0 : -0.04 * Math.min(8, r.dist)) + (r.out ? -0.5 : 0);
  P.step = (n = 20) => {
    for (let i = 0; i < n && !P.done; i++) {
      if (stage === 0) {
        const c = coarse[k++];
        const r = simulate(track, c).result; P.sims++;
        pool.push({ c, v: score({ ...r, lean: c.lean }) });
        if (k >= coarse.length) {
          pool.sort((x, y) => y.v - x.v);
          const seen = [];
          for (const q of pool) { if (seen.length >= 5) break; if (seen.every((s) => Math.abs(s.c.ang - q.c.ang) > 0.03 || s.c.lean !== q.c.lean)) seen.push(q); }
          refine = seen.map((q) => ({ base: q.c, best: { c: q.c, v: q.v } }));
          stage = 1; k = 0;
        }
      } else if (stage === 1) {
        // local refinement around each candidate: 9 angles x 7 powers
        const R = refine[Math.floor(k / 63)], j = k % 63;
        if (!R) { stage = 2; k = 0; robust = refine.map((q) => ({ c: q.best.c, v: q.best.v, tot: 0, n: 0 })); continue; }
        const c = { ang: clamp(R.base.ang + ((j % 9) - 4) * 0.004, -ANG_MAX, ANG_MAX), power: clamp(R.base.power + (Math.floor(j / 9) - 3) * 0.012, 0.1, 1), lean: R.base.lean };
        const r = simulate(track, c).result; P.sims++;
        const v = score({ ...r, lean: c.lean });
        if (v > R.best.v) R.best = { c, v };
        k++;
      } else {
        const R = robust[Math.floor(k / jig.length)], j = k % jig.length;
        if (!R) {
          for (const q of robust) q.score = 0.4 * q.v + 0.6 * (q.tot / q.n);
          robust.sort((x, y) => y.score - x.score);
          const best = robust[0];
          P.result = {
            params: { ang: best.c.ang, power: best.c.power, lean: best.c.lean },
            alts: robust.slice(0, 3).map((q) => ({ params: { ang: q.c.ang, power: q.c.power, lean: q.c.lean }, score: q.score })),
            score: best.score, kind: best.c.lean ? 'curve' : 'straight',
          };
          P.done = true; break;
        }
        const [da, dp] = jig[j];
        const r = simulate(track, { ang: R.c.ang + da * sa, power: clamp(R.c.power + dp * sp, 0, 1), lean: R.c.lean }).result; P.sims++;
        R.tot += score({ ...r, lean: R.c.lean }); R.n++;
        k++;
      }
    }
    return P.done;
  };
  void rng;
  return P;
}

// The roll the rival actually makes: the plan plus its own wobble, sometimes a misjudgement (another candidate or a clumsy release).
export function executePlan(plan, prof, rng) {
  let p = plan.params;
  if (rng.next() < prof.blunder) {
    const alt = plan.alts[1 + (rng.next() < 0.5 ? 0 : 1)] || plan.alts[plan.alts.length - 1];
    p = rng.next() < 0.5 && alt ? alt.params : { ...p, ang: p.ang + (rng.next() - 0.5) * prof.ang * 7, power: p.power + (rng.next() - 0.5) * prof.pow * 5 };
  }
  return { ang: clamp(p.ang + gauss(rng) * prof.ang, -ANG_MAX, ANG_MAX), power: clamp(p.power + gauss(rng) * prof.pow, 0.05, 1), lean: p.lean };
}
