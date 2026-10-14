// The rivals' planner: tries throws on copies of the pitch and keeps the best. Pure and deterministic given the rng it is handed.
import { STYLES, cloneWorld, setWind, solveThrow, previewThrow, throwPoints, bonusTeam, nearestByTeam, clamp, totalSpeed, V_MAX } from './sim.js';

export const gauss = (rng) => { let s = 0; for (let i = 0; i < 6; i++) s += rng.next(); return (s - 3) / 0.7071; };
const STYLE_NAME = ['lob', 'skim', 'whirl'];
export const planLabel = (p) => {
  const where = p.kind === 'stake' ? 'at the stake' : p.kind === 'touch' ? 'tight to the stake' : p.kind === 'near' ? 'into the scoring zone' : 'a safe pin';
  return `${STYLES[p.style].name}, ${where}`;
};

// how good a finished throw is for `team`
function value(c, pin, team) {
  const r = throwPoints(c, pin);
  const bt = bonusTeam(c), near = nearestByTeam(c);
  const mine = near[team], theirs = near[1 - team];
  let v = r.pts;
  if (bt === team) v += 0.75; else if (bt === 1 - team) v -= 0.75;
  v += 0.25 * clamp(1 - Math.min(mine, 4) / 4, 0, 1) - 0.1 * clamp(1 - Math.min(theirs, 4) / 4, 0, 1);
  if (r.kind === 'out') v -= 0.15;
  return v;
}

export function createPlanner(w0, m, team, prof, rng, o = {}) {
  // the rival judges the wind a little wrongly (a perfect hint reads it exactly)
  const w = cloneWorld(w0);
  if (!o.perfect && prof.windErr) setWind(w, Math.max(0, w0.wind.speed * (1 + gauss(rng) * prof.windErr)), w0.wind.dir + gauss(rng) * prof.windErr * 0.5);
  const D = w.D, cands = [];
  const xs = [];
  for (let i = 0; i <= 11; i++) xs.push(D - 5.5 + i * 0.58);
  const ys = [-1.3, -0.75, -0.35, 0, 0.35, 0.75, 1.3];
  for (let s = 0; s < STYLES.length; s++) for (const tx of xs) for (const ty of ys) {
    if (!o.perfect && rng.next() > prof.cands) continue;
    const sol = solveThrow(w, s, tx, ty);
    if (sol.clamped) continue;
    cands.push({ style: s, tx, ty, theta: sol.theta, v0: sol.v0 });
  }
  if (!cands.length) { const sol = solveThrow(w, 1, D - 1, 0); cands.push({ style: 1, tx: D - 1, ty: 0, theta: sol.theta, v0: sol.v0 }); }
  const ang = o.perfect ? 0.006 : prof.ang, len = o.perfect ? 0.008 : prof.len;
  const trials = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  let i = 0;
  const scored = [];
  const self = {
    done: false, sims: 0, result: null,
    step(n) {
      for (let k = 0; k < n && i < cands.length; k++, i++) {
        const c = cands[i];
        let sum = 0, cnt = 0;
        for (const [a, l] of trials) {
          if (o.perfect && (a || l)) continue;
          const pv = previewThrow(w, team, { style: c.style, theta: c.theta + a * ang, v0: c.v0 * (1 + l * len) });
          let v = value(pv.world, pv.pin, team);
          if (!o.perfect) { v += (c.style === 2 ? -0.05 : 0) + prof.bold * (pv.kind === 'stake' ? 0.4 : 0); }
          sum += v * (a || l ? 0.6 : 1.6); cnt += (a || l ? 0.6 : 1.6); self.sims++;
        }
        scored.push({ ...c, score: sum / cnt });
      }
      if (i >= cands.length && !self.done) {
        scored.sort((a, b) => b.score - a.score);
        let pick = scored[0];
        if (!o.perfect && rng.next() < prof.blunder) pick = scored[Math.min(scored.length - 1, 3 + rng.int(Math.max(1, Math.min(10, scored.length - 3))))];
        const alts = scored.filter((s) => s !== pick).slice(0, 2);
        const pv = previewThrow(w, team, { style: pick.style, theta: pick.theta, v0: pick.v0 });
        self.result = { ...pick, kind: pv.kind, alts: alts.map((a) => ({ ...a, kind: previewThrow(w, team, { style: a.style, theta: a.theta, v0: a.v0 }).kind })) };
        self.done = true;
      }
    },
  };
  return self;
}

// the throw the rival actually makes: the plan with a little shake in it
export function executePlan(plan, prof, rng) {
  const a = gauss(rng) * prof.ang, l = gauss(rng) * prof.len;
  return { style: plan.style, theta: plan.theta + a, v0: Math.min(plan.v0 * (1 + l), (V_MAX * 1.05) * Math.cos(STYLES[plan.style].alpha)) };
}
export { STYLE_NAME, totalSpeed };
