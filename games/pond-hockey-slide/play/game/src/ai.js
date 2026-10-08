// The computer player (and the Hint). It tries many shots on copies of the pond with the real physics, scores where the
// puck and the skaters end up, and picks the best; stronger rivals also test the opponent's best answer to their top
// shots. Work is split into small steps (`planner.step(n)`) so a frame never stalls. Deterministic given the rng.
import { cloneWorld, launch, playOut, bodyById, puckOf, skatersOf, HH, HW, GOAL_HW, R_SKATER, R_PUCK, clamp, POWER } from './sim.js';

const AIM_Y = (side) => (side === 0 ? -HH : HH);    // the goal this side attacks

// How good is this position for `side` after a shot? Higher is better.
export function evaluate(w, side, defend = 1) {
  const p = puckOf(w), me = skatersOf(w, side), foe = skatersOf(w, 1 - side);
  if (w.goal) return w.goal.side === side ? 100000 : -100000;
  const dir = side === 0 ? -1 : 1;                        // which way is "forward" on y
  let s = 0;
  s += p.y * dir * 0.9;                                    // puck forward
  // the puck close to the rival goal mouth is dangerous for them
  const dGoal = Math.hypot(p.x * 0.7, p.y - AIM_Y(side));
  s += (900 - dGoal) * 0.35;
  // the puck close to my own goal is dangerous for me
  const dOwn = Math.hypot(p.x * 0.7, p.y - AIM_Y(1 - side));
  s -= Math.max(0, 420 - dOwn) * 1.1 * defend;
  // next turn: who is nearest the puck? my skaters near it is good, theirs is bad
  const near = (list) => Math.min(...list.map((b) => Math.hypot(b.x - p.x, b.y - p.y)));
  s += (300 - Math.min(300, near(me))) * 0.35;
  s -= (300 - Math.min(300, near(foe))) * 0.45;
  // a line from the nearest of mine through the puck at their goal is valuable
  for (const b of me) {
    const ax = p.x - b.x, ay = p.y - b.y, L = Math.hypot(ax, ay) || 1;
    if (L > 380) continue;
    const gx = (0 - p.x), gy = AIM_Y(side) - p.y, G = Math.hypot(gx, gy) || 1;
    const cos = (ax * gx + ay * gy) / (L * G);
    s += Math.max(0, cos) * 40;
  }
  // own skaters crowding my goal mouth block my own shots a little, theirs there protect them
  for (const b of foe) if (Math.abs(b.x) < GOAL_HW + 30 && Math.abs(b.y - AIM_Y(side)) < 160) s -= 22;
  return s;
}

const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// Power that carries a skater about `dist` units under the pond's drag (inverse of the physics, roughly).
export function powerForDistance(dist) {
  const v = clamp(dist * 0.95 + 90, POWER.min, POWER.max);
  return clamp((v - POWER.min) / (POWER.max - POWER.min), 0.05, 1);
}

// Candidate shots for one skater: the line that drives the puck at a target (the goal, a bank), plus blocks and scatter.
function candidatesFor(w, side, b, rng, n) {
  const p = puckOf(w), out = [];
  const gy = AIM_Y(side);
  const wall = (HW - R_PUCK) * 2;      // a bank shot aims at the goal mirrored in the side wall
  const targets = [[0, gy], [-GOAL_HW * 0.55, gy], [GOAL_HW * 0.55, gy], [-wall, gy], [wall, gy], [-wall + GOAL_HW * 0.6, gy], [wall - GOAL_HW * 0.6, gy]];
  for (const [tx, ty] of targets) {
    // ghost-ball: where the skater must be to push the puck along (puck -> target)
    const dx = tx - p.x, dy = ty - p.y, L = Math.hypot(dx, dy) || 1;
    const cx = p.x - (dx / L) * (R_SKATER + R_PUCK - 3), cy = p.y - (dy / L) * (R_SKATER + R_PUCK - 3);
    const ang = Math.atan2(cy - b.y, cx - b.x), dist = Math.hypot(cx - b.x, cy - b.y);
    for (const dp of [0.9, 1.05, 1.35, 1.8]) out.push({ id: b.id, ang, power: powerForDistance(dist * dp + 40), kind: 'drive' });
    // aim through the ghost spot a bit longer (to hit harder)
    out.push({ id: b.id, ang, power: clamp(powerForDistance(dist) + 0.3, 0.1, 1), kind: 'drive' });
  }
  // straight at the puck, and block moves: slide into the lane between puck and my goal
  const toP = Math.atan2(p.y - b.y, p.x - b.x), dP = Math.hypot(p.y - b.y, p.x - b.x);
  out.push({ id: b.id, ang: toP, power: powerForDistance(dP + 80), kind: 'drive' }, { id: b.id, ang: toP, power: 1, kind: 'drive' });
  const own = AIM_Y(1 - side);
  for (const f of [0.35, 0.55]) {
    const bx = p.x + (0 - p.x) * f, by = p.y + (own - p.y) * f;
    out.push({ id: b.id, ang: Math.atan2(by - b.y, bx - b.x), power: powerForDistance(Math.hypot(bx - b.x, by - b.y)), kind: 'block' });
  }
  // scatter around the direct line
  for (let i = 0; i < n; i++) out.push({ id: b.id, ang: wrap(toP + rng.range(-0.9, 0.9)), power: rng.range(0.25, 1), kind: 'scatter' });
  return out;
}

export function allCandidates(w, side, rng, perSkater) {
  const c = [];
  for (const b of skatersOf(w, side)) c.push(...candidatesFor(w, side, b, rng, perSkater));
  return c;
}

export function tryShot(w, side, c, defend = 1) {
  const t = cloneWorld(w);
  launch(t, c.id, c.ang, c.power);
  playOut(t, 1300, true);
  return { score: evaluate(t, side, defend), goal: t.goal ? t.goal.side : -1, w: t };
}

// A planner works through the candidate list a few shots at a time; `result` is { id, ang, power, kind, score, alts } when `done`.
export function createPlanner(w, side, prof, rng, opts = {}) {
  const perfect = !!opts.perfect;
  const per = Math.max(2, Math.round((perfect ? 150 : prof.cands) / 3 / 3));
  const list = allCandidates(w, side, rng, per);
  // stronger rivals test every structured shot (drives at the goal and off the banks, blocks); weaker ones only a random share
  const keep = list.filter((c) => c.kind !== 'scatter');
  const scat = list.filter((c) => c.kind === 'scatter');
  const queue = perfect ? keep.concat(scat) : rng.shuffle(keep).slice(0, Math.min(keep.length, Math.max(10, Math.round(prof.cands * 0.9)))).concat(rng.shuffle(scat).slice(0, Math.round(prof.cands * 0.35)));
  const scored = [];
  let i = 0, phase = 0, reply = null;
  const pl = {
    done: false, result: null,
    step(n = 10) {
      if (pl.done) return;
      if (phase === 0) {
        for (let k = 0; k < n && i < queue.length; k++, i++) { const r = tryShot(w, side, queue[i], prof.defend); scored.push({ ...queue[i], score: r.score, goal: r.goal, after: r.w }); }
        if (i >= queue.length) {
          scored.sort((a, b) => b.score - a.score);
          const lookN = perfect ? 3 : prof.reply;
          if (lookN > 0 && !(scored[0] && scored[0].goal === side)) { reply = { n: Math.min(lookN, scored.length), j: 0 }; phase = 1; } else finish();
        }
      } else if (phase === 1) {
        // the opponent's best answer to each of my top shots (a small search), subtract their gain
        for (let k = 0; k < Math.max(1, n >> 2) && reply.j < reply.n; k++, reply.j++) {
          const cand = scored[reply.j];
          if (cand.goal === 1 - side) { cand.score = -90000; continue; }
          let best = -Infinity;
          const foe = 1 - side, cs = allCandidates(cand.after, foe, rng, 2).filter((c) => c.kind !== 'scatter' || rng.chance(0.3));
          for (const c of cs.slice(0, 40)) { const r = tryShot(cand.after, foe, c, 1); if (r.score > best) best = r.score; }
          cand.score -= Math.max(0, best) * 0.55;
          if (best > 50000) cand.score -= 20000;
        }
        if (reply.j >= reply.n) { scored.sort((a, b) => b.score - a.score); finish(); }
      }
    },
  };
  function finish() {
    pl.done = true;
    const top = scored[0];
    let pick = top;
    if (!perfect && prof.blunder > 0 && rng.chance(prof.blunder) && scored.length > 4) pick = scored[1 + rng.int(Math.min(6, scored.length - 1))];
    const alts = scored.filter((c) => c !== pick).slice(0, 3).map(({ id, ang, power, kind, score }) => ({ id, ang, power, kind, score }));
    pl.result = { id: pick.id, ang: pick.ang, power: pick.power, kind: pick.kind, score: pick.score, goal: pick.goal === side, alts };
  }
  return pl;
}

// What a rival really does with a plan: execution wobble by skill.
export function executePlan(plan, prof, rng) {
  const a = plan.ang + rng.range(-1, 1) * prof.sigA * 2 * 0.5 + (rng.next() + rng.next() - 1) * prof.sigA;
  const p = clamp(plan.power * (1 + (rng.next() + rng.next() - 1) * prof.sigP), 0.04, 1);
  return { id: plan.id, ang: a, power: p };
}

// A short plain-language reason for the hint / Watch & Learn reveal.
export function describePlan(plan, w, side) {
  if (plan.goal) return 'drive the puck into the goal';
  const p = puckOf(w), me = bodyById(w, plan.id);
  if (plan.kind === 'block') return 'slide in front of the puck to block the lane';
  if (plan.kind === 'scatter' || plan.kind === 'drive') {
    const toward = Math.abs(p.y - AIM_Y(side)) < 300 ? 'set up a shot on goal' : 'send the puck up the ice';
    return Math.hypot(me.x - p.x, me.y - p.y) < 110 ? `strike the puck hard to ${toward}` : `glide in to ${toward}`;
  }
  return 'play the puck forward';
}
