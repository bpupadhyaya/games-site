// The opponent. The planner proposes shots (pocket tries, ring placements, takeouts, cut shots), plays each one
// out on a copy of the board with the real physics, scores the board it leaves, then re-tests the best few with
// small slips to prefer shots that survive a shaky flick. Execution noise and blunders make the weaker rivals human.
import { startPoint, launch, cloneWorld, settle, resolveShot, discValue, speedForDistance, speedToPower, clamp, R_DISC, RINGS, MAX_U } from './sim.js';

const gauss = (rng) => (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 1.7;

function evalShot(w, side, c) {
  const k = cloneWorld(w);
  const had = k.discs.some((d) => d.team !== side && d.mode === 'live');
  launch(k, side, c.u, c.ang, c.power);
  settle(k);
  resolveShot(k, had);
  let s = 0;
  for (const d of k.discs) {
    const v = discValue(d);
    if (!v) continue;
    const wt = d.mode === 'pocket' ? 1 : 0.62;
    s += (d.team === side ? 1 : -1) * v * wt;
  }
  return s;
}

function candidates(w, side, prof) {
  const out = [];
  const us = prof.positions;
  const rivals = w.discs.filter((d) => d.team !== side && d.mode === 'live');
  const push = (u, tx, ty, extra, kind) => {
    const p = startPoint(side, u);
    const dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy);
    if (dist < 20) return;
    out.push({ u, ang: Math.atan2(dy, dx), power: clamp(speedToPower(speedForDistance(dist + extra)), 0.05, 1), kind });
  };
  for (const u of us) {
    // the pocket
    for (const e of [-10, 0, 14]) push(u, 0, 0, e, 'pocket');
    // ring placements
    if (prof.place) for (const g of [60, 138, 214]) for (let a = 0; a < 12; a++) { const th = (a * Math.PI) / 6 + 0.26; push(u, Math.cos(th) * g, Math.sin(th) * g, 0, 'place'); }
    // takeouts
    for (const r of rivals) {
      const dist = Math.hypot(r.x - startPoint(side, u).x, r.y - startPoint(side, u).y);
      const offs = prof.cut ? [-0.9, -0.45, 0, 0.45, 0.9] : [0];
      for (const o of offs) {
        const p = startPoint(side, u), base = Math.atan2(r.y - p.y, r.x - p.x), nx = -Math.sin(base) * R_DISC * o, ny = Math.cos(base) * R_DISC * o;
        for (const e of [0, 90, 400]) push(u, r.x + nx, r.y + ny, e, 'takeout');
      }
      void dist;
    }
  }
  // a few shots that guard: stop on the outer ring in front of a lane
  if (prof.place) for (const u of us) for (let a = 0; a < 8; a++) { const th = (a * Math.PI) / 4 + Math.PI / 8; push(u, Math.cos(th) * 150, Math.sin(th) * 150, -6, 'place'); }
  return out;
}

export function createPlanner(w, side, prof, rng, opts = {}) {
  const P = opts.perfect ? { ...prof, positions: [-0.62, -0.31, 0, 0.31, 0.62], place: true, cut: true } : prof;
  let list = null, i = 0, stage = 'eval', top = [], j = 0;
  const job = { done: false, result: null };
  const jit = [[0.012, 1], [-0.012, 1], [0, 1.045], [0, 0.955]];
  job.step = (n = 8) => {
    if (job.done) return;
    if (!list) {
      const base = candidates(w, side, P).map((c) => ({ ...c, s: 0, r: 0 }));
      list = base;
      if (!list.length) { job.done = true; job.result = { u: 0, ang: side === 0 ? -Math.PI / 2 : Math.PI / 2, power: 0.5, kind: 'place', alts: [] }; return; }
    }
    for (let q = 0; q < n && !job.done; q++) {
      if (stage === 'eval') {
        const c = list[i++];
        c.s = evalShot(w, side, c) + (opts.perfect ? 0 : P.looseness * (rng.next() - 0.5) * 6);
        if (i >= list.length) { stage = 'refine'; top = list.slice().sort((a, b) => b.s - a.s).slice(0, P.refine); j = 0; }
      } else {
        const c = top[j];
        if (c.r === 0 && c.done !== true) {
          let sum = 0;
          for (const [da, pm] of jit) sum += evalShot(w, side, { u: c.u, ang: c.ang + da, power: clamp(c.power * pm, 0.03, 1) });
          c.avg = sum / jit.length; c.f = c.s * (1 - P.robust) + c.avg * P.robust; c.done = true;
        }
        j++;
        if (j >= top.length) {
          top.sort((a, b) => b.f - a.f);
          let pick = top[0];
          if (!opts.perfect && rng.next() < P.blunder) pick = list.slice().sort((a, b) => b.s - a.s)[Math.min(list.length - 1, 2 + Math.floor(rng.next() * 8))];
          job.result = { u: pick.u, ang: pick.ang, power: pick.power, kind: pick.kind, score: pick.f ?? pick.s, alts: top.slice(1, 4).map((c) => ({ u: c.u, ang: c.ang, power: c.power })) };
          job.done = true;
        }
      }
    }
  };
  return job;
}

// What the hand actually does: the planned shot with the rival's own wobble.
export function executePlan(plan, prof, rng) {
  const ang = plan.ang + gauss(rng) * prof.sigA;
  const power = clamp(plan.power * (1 + gauss(rng) * prof.sigP), 0.03, 1);
  const u = clamp(plan.u + gauss(rng) * 0.01, -MAX_U, MAX_U);
  return { u, ang, power };
}

export const RINGS_FOR_AI = RINGS;
