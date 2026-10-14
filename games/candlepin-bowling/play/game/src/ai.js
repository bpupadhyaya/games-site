// The rivals. A planner tries many rolls on COPIES of the real lane (same physics as the game), values each by the pins it
// knocks plus what the leave is worth for the next ball (a short second-ply search), and the rival's skill decides which of
// the best rolls it picks and how well it executes it. Deterministic given the rng handed in. Works in slices (step(n)) so
// the frame rate never stalls.
import { LANE, PIN_XY, cloneWorld, newBall, launch, simulate, standingCount, previewPath, clamp } from './sim.js';

export const PROFILES = [
  { id: 'dot', name: 'Dot', tag: 'Gentle', stars: 1, think: [0.9, 1.6], pool: 14, sd: { x: 0.2, v: 0.1, a: 0.03 }, curves: [0], paces: [0, 1], two: false },
  { id: 'walt', name: 'Walt', tag: 'Steady', stars: 2, think: [0.9, 1.8], pool: 9, sd: { x: 0.1, v: 0.06, a: 0.018 }, curves: [0, 1, -1], paces: [0, 1, 2], two: false },
  { id: 'june', name: 'June', tag: 'Smooth', stars: 3, think: [1, 2], pool: 6, sd: { x: 0.06, v: 0.04, a: 0.01 }, curves: [0, 1, -1], paces: [0, 1, 2], two: true },
  { id: 'gus', name: 'Gus', tag: 'Cunning', stars: 4, think: [1, 2], pool: 5, sd: { x: 0.045, v: 0.03, a: 0.008 }, curves: [0, 1, -1, 2, -2], paces: [0, 1, 2], two: true },
  { id: 'ruthie', name: 'Ruthie', tag: 'League star', stars: 5, think: [1.2, 2.2], pool: 2, sd: { x: 0.014, v: 0.011, a: 0.003 }, curves: [0, 1, -1, 2, -2], paces: [0, 1, 2], two: true },
  { id: 'hal', name: 'Captain Hal', tag: 'The champion', stars: 5, think: [1.2, 2.4], pool: 1, sd: { x: 0.008, v: 0.008, a: 0.0015 }, curves: [0, 1, -1, 2, -2], paces: [0, 1, 2], two: true },
];
export const BEST = PROFILES[PROFILES.length - 1];

const STARTS_A = [-0.4, -0.2, 0, 0.2, 0.4];
const aimsA = [-0.5, -0.375, -0.25, -0.125, 0, 0.125, 0.25, 0.375, 0.5];

const jit = (rng, sd) => ({ x: gauss(rng) * sd.x, v: gauss(rng) * sd.v, a: gauss(rng) * sd.a });
export function gauss(rng) { let u = 0; for (let i = 0; i < 4; i++) u += rng.next(); return (u - 2) * 1.732; }   // ~N(0,1), cheap and deterministic

// value of a leave when `left` balls remain in the frame (0 = nothing to come)
const BONUS = { strike: 9, spare: 4.5 };

export function createPlanner(world, o, profile, rng) {
  // o: { ballsLeft (including this one), firstBall: bool, clearBonus: 'strike' | 'spare' | 'none' }
  const base = cloneWorld(world);
  const cands = [];
  const standing = base.pins.filter((p) => p.s === 0);
  // candidate list: coarse grid, plus aims straight at each standing pin and its neighbours
  const aims = new Set(aimsA);
  for (const p of standing) { aims.add(Math.round(p.x * 1000) / 1000); aims.add(Math.round((p.x - 0.07) * 1000) / 1000); aims.add(Math.round((p.x + 0.07) * 1000) / 1000); }
  const starts = STARTS_A;
  const curvesA = profile.curves.filter((c) => Math.abs(c) <= 1);
  for (const x0 of starts) for (const aim of aims) for (const pace of profile.paces) for (const curve of curvesA) {
    if (Math.abs(aim) > 0.6) continue;
    cands.push({ x0, aim, pace, curve });
  }
  const results = [];
  let idx = 0, phase = 0, sims = 0, refineQ = [], leaveQ = [], leaveIdx = 0;
  const P = { done: false, result: null, sims: 0, progress: 0 };

  const evalFirst = (c) => {
    const w = cloneWorld(base);
    launch(w, newBall(c.x0, c.aim, c.pace, c.curve));
    const down = simulate(w), left = standingCount(w);
    sims++;
    return { params: c, down, left, w, value: 0 };
  };
  // quick next-ball estimate from a leave: best of a small grid (pins knocked, spare bonus)
  const leaveValue = (w, ballsLeftAfter) => {
    const left = standingCount(w);
    if (left === 0) return 0;
    if (ballsLeftAfter <= 0) return 0;
    const st = w.pins.filter((p) => p.s === 0);
    let best = 0;
    for (const x0 of [-0.25, 0, 0.25]) {
      const tried = new Set();
      for (const p of st) for (const dx of [-0.045, 0.045]) {
        const aim = clamp(Math.round((p.x + dx) * 100) / 100, -0.55, 0.55);
        for (const pace of [1, 2]) {
          const key = `${x0}|${aim}|${pace}`;
          if (tried.has(key)) continue; tried.add(key);
          const ww = cloneWorld(w); launch(ww, newBall(x0, aim, pace, 0));
          const d = simulate(ww); sims++;
          const v = d + (d === left ? BONUS.spare * (o.clearBonus === 'strike' ? 1 : 1) : 0);
          if (v > best) best = v;
        }
      }
    }
    return best;
  };

  const finish = () => {
    // value everything, then pick by skill
    for (const r of results) if (r.value === 0) r.value = r.down + (r.left === 0 ? (o.firstBall ? BONUS.strike : BONUS.spare) : 0);
    results.sort((a, b) => b.value - a.value || a.params.x0 - b.params.x0 || a.params.aim - b.params.aim);
    P.done = true;
    const top = results.slice(0, Math.max(1, profile.pool));
    // weights fall off with rank so even a weak rival leans toward good rolls
    let pick = 0;
    if (top.length > 1) { const u = rng.next(); pick = Math.min(top.length - 1, Math.floor(u * u * top.length)); }
    const chosen = top[pick];
    const alts = results.slice(0, 3).map((r) => ({ params: r.params, down: r.down, left: r.left, value: r.value }));
    P.result = { params: chosen.params, down: chosen.down, left: chosen.left, value: chosen.value, alts, best: results[0].params };
  };

  P.step = (n = 10) => {
    for (let k = 0; k < n && !P.done; k++) {
      if (phase === 0) {
        if (idx < cands.length) { results.push(evalFirst(cands[idx++])); P.progress = idx / (cands.length + 60); }
        else {
          // refine around the best few
          results.sort((a, b) => (b.down + (b.left === 0 ? 5 : 0)) - (a.down + (a.left === 0 ? 5 : 0)));
          const top = results.slice(0, 5);
          for (const r of top) {
            for (const da of [-0.03, 0.03]) for (const dx of [-0.07, 0, 0.07]) refineQ.push({ ...r.params, aim: Math.round((r.params.aim + da) * 1000) / 1000, x0: clamp(Math.round((r.params.x0 + dx) * 1000) / 1000, -0.45, 0.45) });
            for (const curve of profile.curves) if (curve !== r.params.curve) refineQ.push({ ...r.params, curve });
          }
          phase = 1;
        }
      } else if (phase === 1) {
        if (refineQ.length) results.push(evalFirst(refineQ.shift()));
        else {
          results.sort((a, b) => (b.down + (b.left === 0 ? 5 : 0)) - (a.down + (a.left === 0 ? 5 : 0)));
          leaveQ = results.slice(0, o.ballsLeft > 1 ? 6 : 0);
          phase = 2;
        }
      } else if (phase === 2) {
        if (leaveIdx < leaveQ.length) {
          const r = leaveQ[leaveIdx++];
          const after = o.ballsLeft - 1;
          const lv = r.left === 0 ? (o.firstBall ? BONUS.strike : BONUS.spare) : leaveValue(r.w, after);
          r.value = r.down + lv * (after > 0 || r.left === 0 ? 1 : 0);
          if (r.left > 0 && after > 0) r.value = r.down + lv * 0.9;
        } else { finish(); }
      }
    }
    P.sims = sims;
    return P.done;
  };
  return P;
}

// Turn a plan into the launch parameters the rival really throws with: skill noise on start, aim, pace and heading.
export function executePlan(result, profile, rng) {
  const j = jit(rng, profile.sd);
  return { x0: clamp(result.params.x0 + j.x * 0.5, -0.46, 0.46), aim: result.params.aim, pace: result.params.pace, curve: result.params.curve, jitter: { x: j.x, v: j.v, a: j.a } };
}
export { previewPath, PIN_XY, LANE };
