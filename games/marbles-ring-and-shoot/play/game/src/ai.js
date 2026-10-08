// The opponent. The planner proposes shots (aimed at a "ghost" spot so a chosen marble is driven outward), plays each one out
// on a copy of the board with the real physics, scores what it leaves, then re-tests the best few with small slips.
// Execution noise and blunders make the weaker rivals human. Work is spread over frames via job.step(n).
import { shooterOf, targets, cloneWorld, launch, settle, resolveShot, spotBlocked, onLine, speedForDistance, speedToPower, clamp, R_T, R_S, RR } from './sim.js';

const gauss = (rng) => (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 1.7;

function evalShot(w, side, c) {
  const k = cloneWorld(w), sh = shooterOf(k, side);
  if (c.pos) { sh.x = c.pos.x; sh.y = c.pos.y; }
  launch(k, side, c.ang, c.power);
  settle(k);
  const res = resolveShot(k);
  let s = res.total + (res.total > 0 && !res.shooterLost ? 0.8 : 0);
  if (res.shooterIn) s -= 0.7;          // a shooter left in the ring can be captured
  if (res.shooterLost) s -= 0.5;
  if (res.total === 0) s -= Math.hypot(sh.x, sh.y) / 1500;
  return s;
}

function candidates(w, side, P) {
  const out = [], sh = shooterOf(w, side), tg = targets(w);
  const starts = [];
  if (sh.hand) { for (let i = 0; i < P.angles; i++) { const a = (side === 0 ? Math.PI / 2 : -Math.PI / 2) + (i - (P.angles - 1) / 2) * (Math.PI * 2 / P.angles) * 0.9; starts.push({ a, p: onLine(a) }); } }
  else starts.push({ a: null, p: { x: sh.x, y: sh.y } });
  for (const st of starts) {
    if (st.a !== null && spotBlocked(w, st.p.x, st.p.y, sh.id)) continue;
    for (const t of tg) {
      const td = Math.hypot(t.x, t.y), ax = t.x - st.p.x, ay = t.y - st.p.y, al = Math.hypot(ax, ay) || 1;
      const dirs = [{ x: ax / al, y: ay / al }];
      if (td > 4) { const rx = t.x / td, ry = t.y / td; dirs.push({ x: rx, y: ry }); if (P.cut) for (const rot of [-0.5, 0.5]) dirs.push({ x: rx * Math.cos(rot) - ry * Math.sin(rot), y: rx * Math.sin(rot) + ry * Math.cos(rot) }); }
      for (const d of dirs) {
        const gx = t.x - d.x * (R_T + R_S), gy = t.y - d.y * (R_T + R_S), vx = gx - st.p.x, vy = gy - st.p.y, dist = Math.hypot(vx, vy);
        if (dist < 4) continue;
        if ((vx * d.x + vy * d.y) / dist < 0.3) continue;      // cut too thin to move the marble that way
        for (const e of P.powers) out.push({ pos: st.a !== null ? st.p : null, ang: Math.atan2(vy, vx), power: clamp(speedToPower(speedForDistance(dist + e)), 0.05, 1), kind: td < RR - 30 ? 'break' : 'pick' });
      }
    }
  }
  return out;
}

export function createPlanner(w, side, prof, rng, opts = {}) {
  const P = opts.perfect ? { ...prof, angles: 8, cut: true, powers: [60, 160, 320, 560, 900] } : prof;
  let list = null, i = 0, stage = 'eval', top = [], j = 0;
  const job = { done: false, result: null };
  const jit = [[0.014, 1], [-0.014, 1], [0, 1.05], [0, 0.95]];
  job.step = (n = 8) => {
    if (job.done) return;
    if (!list) {
      list = candidates(w, side, P).map((c) => ({ ...c, s: 0 }));
      if (!list.length) { const sh = shooterOf(w, side); job.done = true; job.result = { pos: sh.hand ? onLine(side === 0 ? Math.PI / 2 : -Math.PI / 2) : null, ang: side === 0 ? -Math.PI / 2 : Math.PI / 2, power: 0.4, kind: 'pick', alts: [] }; return; }
    }
    for (let q = 0; q < n && !job.done; q++) {
      if (stage === 'eval') {
        const c = list[i++];
        c.s = evalShot(w, side, c) + (opts.perfect ? 0 : P.looseness * (rng.next() - 0.5) * 2);
        if (i >= list.length) { stage = 'refine'; top = list.slice().sort((a, b) => b.s - a.s).slice(0, P.refine); j = 0; }
      } else {
        const c = top[j];
        let sum = 0;
        for (const [da, pm] of jit) sum += evalShot(w, side, { pos: c.pos, ang: c.ang + da, power: clamp(c.power * pm, 0.03, 1) });
        c.f = c.s * (1 - P.robust) + (sum / jit.length) * P.robust;
        j++;
        if (j >= top.length) {
          top.sort((a, b) => b.f - a.f);
          let pick = top[0];
          if (!opts.perfect && rng.next() < P.blunder) pick = list.slice().sort((a, b) => b.s - a.s)[Math.min(list.length - 1, 2 + Math.floor(rng.next() * 8))];
          job.result = { pos: pick.pos, ang: pick.ang, power: pick.power, kind: pick.kind, score: pick.f ?? pick.s, alts: top.slice(1, 3).map((c2) => ({ pos: c2.pos, ang: c2.ang, power: c2.power })) };
          job.done = true;
        }
      }
    }
  };
  return job;
}

// What the hand actually does: the planned shot with the rival's own wobble.
export function executePlan(plan, prof, rng) {
  return { pos: plan.pos, ang: plan.ang + gauss(rng) * prof.sigA, power: clamp(plan.power * (1 + gauss(rng) * prof.sigP), 0.03, 1) };
}
