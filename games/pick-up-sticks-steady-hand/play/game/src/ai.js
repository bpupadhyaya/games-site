// The rivals and the hint. The planner lists pulls (a free stick, where to grab it, which way, how fast), plays each one out on a
// copy of the heap with the real physics, and prefers a valuable stick that comes out cleanly. The best few are re-tested with the
// rival's own shaky hand, so a steady rival chooses pulls that survive a tremor and a shaky one does not. Work is spread over
// frames with job.step(n).
import { cloneWorld, freeSticks, playPlan, VALUE, KIND_NAME, clamp } from './sim.js';

const gauss = (rng) => (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 1.7;
// The hand: a steady tremor plus now and then a flinch (a sudden jolt of the target). Returns a () => number for playPlan.
export function handNoise(prof, rng) {
  return () => {
    let v = gauss(rng) * prof.tremor;
    if (rng.next() < prof.flinch / 60) v += (rng.next() < 0.5 ? -1 : 1) * (18 + rng.next() * 26);
    return v;
  };
}
const DIST = 430;

function candidates(w, prof) {
  const out = [];
  for (const f of freeSticks(w)) {
    const dirs = [f.a, f.a + Math.PI, f.a + Math.PI / 2, f.a - Math.PI / 2, f.a + Math.PI / 4, f.a - Math.PI / 4, f.a + 3 * Math.PI / 4, f.a - 3 * Math.PI / 4];
    for (const ang of dirs) for (const k of [0.9, -0.9, 0]) for (const speed of prof.speeds) out.push({ id: f.id, kind: f.kind, k, ang, dist: DIST, speed });
  }
  return out;
}

const run = (w, plan, jitter) => playPlan(cloneWorld(w), plan, jitter);

export function createPlanner(w, prof, rng, opts = {}) {
  const P = opts.perfect ? { ...prof, speeds: [50, 75, 95], sample: 4000, refine: 3, trials: 0, blunder: 0, tremor: 0, flinch: 0 } : prof;
  let list = null, i = 0, stage = 'eval', top = [], j = 0;
  const job = { done: false, result: null };
  const finish = (c, note) => {
    const f = w.sticks.find((s) => s.id === c.id);
    job.result = { id: c.id, kind: c.kind, k: c.k, ang: c.ang, dist: c.dist, speed: c.speed, value: VALUE[c.kind], ok: c.ok, ratio: c.r, note, x: f ? f.x : 0, y: f ? f.y : 0 };
    job.done = true;
  };
  job.step = (n = 8) => {
    if (job.done) return;
    if (!list) {
      const all = candidates(w, P);
      list = (all.length > P.sample ? rng.shuffle(all).slice(0, P.sample) : all).map((c) => ({ ...c, s: 0, ok: false, r: 1 }));
      if (!list.length) { job.done = true; job.result = null; return; }
    }
    for (let q = 0; q < n && !job.done; q++) {
      if (stage === 'eval') {
        const c = list[i++], r = run(w, c, null);
        c.ok = r.outcome === 'lifted'; c.r = r.ratio;
        c.s = c.ok ? VALUE[c.kind] * (1 - 0.35 * r.ratio) : -2 - r.ratio;
        if (i >= list.length) { stage = 'refine'; top = list.slice().sort((a, b) => b.s - a.s).slice(0, P.refine); j = 0; if (!top.length) { finish(list[0], ''); } }
      } else {
        const c = top[j];
        let okN = 0;
        for (let t = 0; t < P.trials; t++) {
          const r = playPlan(cloneWorld(w), c, handNoise(P, rng), 900);
          if (r.outcome === 'lifted') okN++;
        }
        const succ = P.trials ? okN / P.trials : (c.ok ? 1 : 0);
        c.f = VALUE[c.kind] * succ * (1 - 0.3 * c.r) - 3.5 * (1 - succ);
        j++;
        if (j >= top.length) {
          top.sort((a, b) => b.f - a.f);
          let pick = top[0];
          if (!opts.perfect && rng.next() < P.blunder) { const sorted = list.slice().sort((a, b) => b.s - a.s); pick = sorted[Math.min(sorted.length - 1, 2 + Math.floor(rng.next() * 8))]; }
          finish(pick, pick.ok ? '' : 'risky');
        }
      }
    }
  };
  return job;
}

// Words for the Think hint and Watch & Learn.
const COMPASS = ['right', 'lower right', 'bottom', 'lower left', 'left', 'upper left', 'top', 'upper right'];
export const dirWord = (ang) => COMPASS[((Math.round((((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4))) % 8 + 8) % 8];
export const paceWord = (speed) => (speed <= 60 ? 'very slowly' : speed <= 90 ? 'slowly' : speed <= 120 ? 'at a steady pace' : 'quickly');
export function describePlan(plan) {
  const nm = (KIND_NAME[plan.kind] ?? 'stick').toLowerCase();
  return `slide the ${nm} stick ${paceWord(plan.speed)} toward the ${dirWord(plan.ang)}`;
}
export { gauss, clamp };
