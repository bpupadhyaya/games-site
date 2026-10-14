// Controllers (automatic riders) and the planner behind Hint and Watch & Learn.
//
// Every automatic rider follows the same readable tactics, with a personality drawn once per race (plan):
//   - sit on the wheel in front (the slipstream is worth about a third of the effort on the flat);
//   - domestiques pull near the leader once the stage is far enough on, and ease off when their reserve runs low;
//   - leaders cover a rival who rides away, and launch their own attack when few kilometres remain (earlier on steep
//     ground if they are bold), then spend the reserve down to a sprint.
// The planner tries a handful of candidate orders for the next minute on COPIES of the race and reports what each one
// is predicted to do to the finishing order; Hint shows the best, Watch & Learn plays it.
import { EASE, SIT, PUSH, ATTACK, SPRINT_M, step, cloneRace, classification, etaOf, clamp } from './sim.js';

const teamLeader = (R, r) => { for (const q of R.riders) if (q.team === r.team && q.slot === 0) return q; return r; };

export function modeFor(R, r) {
  if (r.fin !== null) return EASE;
  const rem = R.L - r.s, wpf = r.w / r.wpMax, C = R.course;
  const g = C.gradeAt(Math.max(0, r.s) + 80);
  if (rem <= SPRINT_M + 60) return PUSH;
  if (r.cracked) return rem < 700 ? PUSH : EASE;
  const pl = r.plan;
  if (r.slot === 0) {
    if (r.att) {
      if (wpf > 0.22 + 0.12 * pl.hot && g > -0.025) return ATTACK;
      r.att = false;
    }
    if (g > -0.015 && wpf >= pl.dig) {
      const bold = pl.hot > 0.55 && g > 0.045 && wpf > 0.85 && rem <= pl.atk * 1.9;
      if (rem <= pl.atk || bold) { r.att = true; return ATTACK; }
    }
    if (R.t > 45 && g > -0.02 && wpf > pl.cover && rem > 250) {
      // an opponent just ahead who is pulling away: go with them, harder near the finish
      const ord = R.order;
      for (let k = r.rank - 1; k >= 0; k--) {
        const q = R.riders[ord[k]], gap = q.s - r.s;
        if (gap > 220) break;
        if (q.team === r.team || q.fin !== null) continue;
        if (gap > 1 && q.v > r.v + 0.1 && (q.mode >= PUSH || q.pf > 0)) return rem < 2200 && wpf > 0.3 && (q.mode === ATTACK || gap < 25) ? ATTACK : PUSH;
      }
    }
    return SIT;
  }
  // domestique
  const L = teamLeader(R, r);
  if (R.mode === 'tt') return SIT;
  if (L.fin === null && R.L - r.s > 900 && R.L - r.s < R.L - 400 && rem < R.L - pl.pull && wpf > 0.3 && Math.abs(L.s - r.s) < 60 && g > -0.02) return PUSH;
  if (wpf < 0.14 && g < 0.02) return EASE;
  return SIT;
}

// the time-trial ghost: spend the reserve evenly over what is left
export function ghostPf(R, r) {
  if (r.fin !== null) return 0.5;
  const rem = R.L - r.s;
  if (rem <= SPRINT_M) return 0;
  const tLeft = rem / Math.max(3.5, r.v);
  const extra = r.w / Math.max(20, tLeft - 18);
  return clamp(1 + extra / (r.cp * (1 - 0.2 * Math.min(1, r.fat))), 0.75, 1.5);
}

export function decide(R) {
  const ov = R.ovr;
  for (const r of R.riders) {
    if (r.ctl === 'ghost') { r.pf = ghostPf(R, r); continue; }
    const auto = r.ctl === 'ai' || R.autoTeams?.includes(r.team);
    if (ov && ov[r.id] !== undefined && ov.until > R.t) { r.mode = ov[r.id]; r.pf = 0; continue; }
    if (auto) { r.pf = 0; r.mode = modeFor(R, r); }
  }
}

// ---- the planner ---------------------------------------------------------------------------------------------------
// rollout: copy the race, force a set of modes for `horizon` seconds on the named riders, let everybody follow the
// controllers, and run to the end (or until my best rider has finished plus a little).
const sliceLimit = 4000;
function rollout(R0, team, forced, horizon) {
  const R = cloneRace(R0);
  R.autoTeams = [team];
  R.ovr = { until: R.t + horizon, ...forced };
  let guard = 0;
  while (!R.over && guard++ < sliceLimit) {
    const mine = R.riders.filter((r) => r.team === team);
    if (mine.every((r) => r.fin !== null) || (R.firstFin !== null && R.t - R.firstFin > 200)) break;
    step(R, 1, decide);
  }
  const eta = R.riders.map((r) => etaOf(R, r));
  const mine = R.riders.filter((r) => r.team === team);
  let best = mine[0];
  for (const r of mine) if (eta[r.id] < eta[best.id]) best = r;
  const winner = Math.min(...eta);
  const place = 1 + eta.filter((e, i) => R.riders[i].team !== team && e < eta[best.id]).length;
  const rivalBest = Math.min(...eta.filter((e, i) => R.riders[i].team !== team));
  return { place, gap: eta[best.id] - winner, margin: Math.max(0, rivalBest - eta[best.id]), best: best.id, eta };
}

export const MODE_NAMES = ['Ease', 'Sit in', 'Push', 'Attack'];
// Candidate orders for the team now. Returns a resumable job: job.step(n) does n rollouts; job.done / job.result.
export function createPlanner(R, team, opts = {}) {
  const mine = R.riders.filter((r) => r.team === team && r.fin === null);
  const horizon = opts.horizon ?? 50;
  const cands = [];
  const leaderIds = mine.map((r) => r.id);
  const lead = mine.find((r) => r.slot === 0) ?? mine[0];
  const helpers = mine.filter((r) => r !== lead);
  const mk = (label, modes) => { const forced = {}; for (const r of mine) forced[r.id] = modes[r.id] ?? SIT; cands.push({ label, forced }); };
  if (R.mode === 'tt') {
    [EASE, SIT, PUSH, ATTACK].forEach((m) => mk(MODE_NAMES[m], { [lead.id]: m }));
  } else {
    const dom = (a, b) => { const o = {}; helpers.forEach((h, i) => { o[h.id] = i === 0 ? a : b; }); return o; };
    for (const lm of [SIT, PUSH, ATTACK]) {
      for (const [hl, hm] of [['sit', [SIT, SIT]], ['pull', [PUSH, SIT]], ['pull both', [PUSH, PUSH]]]) {
        if (lm === ATTACK && hl === 'pull both') continue;
        mk(`${MODE_NAMES[lm]} / helpers ${hl}`, { [lead.id]: lm, ...dom(hm[0], hm[1]) });
      }
    }
    mk('Ease / helpers sit', { [lead.id]: EASE, ...dom(SIT, SIT) });
  }
  if (opts.current) cands.unshift({ label: 'Carry on as now', forced: { ...opts.current } });
  const job = {
    cands, done: false, i: 0, results: [], result: null, sims: 0,
    step(n = 1) {
      for (let k = 0; k < n && this.i < cands.length; k++, this.i++) {
        const c = cands[this.i], res = rollout(R, team, c.forced, horizon);
        this.results.push({ ...c, ...res, score: res.place * 1000 + res.gap - Math.min(60, res.margin) });
        this.sims++;
      }
      if (this.i >= cands.length) {
        this.done = true;
        const sorted = this.results.slice().sort((a, b) => a.score - b.score);
        // the baseline: nothing forced, the controllers decide
        this.result = { best: sorted[0], alts: sorted.slice(0, 3), all: sorted, leadId: lead.id, ids: leaderIds, horizon };
      }
    },
  };
  return job;
}
