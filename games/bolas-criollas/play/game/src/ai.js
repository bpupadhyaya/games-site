// The computer players. A planner tries many candidate throws on copies of the real court (the same physics the game runs) and
// values the position each leaves; it runs a few simulations per frame so thinking never stalls the screen. The chosen plan is then
// executed with the rival's own execution noise, so weaker rivals miss like people do.
import { COURT, R_BALL, clamp, cloneWorld, newBall, launch, stepWorld, theMingo, gap, live } from './sim.js';
import { MINGO_ID } from './match.js';

// Value of a position for `side`: points if the end stopped now, plus closeness, minus a wasted ball.
export function valueOf(w, side) {
  const k = theMingo(w);
  if (!k) return -3;
  let dMine = 9, dOpp = 9, nMine = 0, nOpp = 0;
  const mine = [], opp = [];
  for (const b of w.balls) {
    if (b.k || !live(b)) continue;
    const d = gap(b, k);
    if (b.side === side) { mine.push(d); dMine = Math.min(dMine, d); nMine++; } else { opp.push(d); dOpp = Math.min(dOpp, d); nOpp++; }
  }
  let pts = 0;
  if (dMine < dOpp) pts = mine.filter((d) => d < dOpp).length;
  else if (dOpp < dMine) pts = -opp.filter((d) => d < dMine).length;
  const close = clamp((Math.min(dOpp, 3) - Math.min(dMine, 3)), -1.8, 1.8) * 0.3;
  return pts + close + (k.x < COURT.zoneA - 1.5 || k.x > COURT.zoneB + 1.5 ? -0.3 : 0);
}

const simulate = (w0, side, p) => {
  const c = cloneWorld(w0), b = newBall(-9, side, false);
  c.balls.push(b);
  launch(c, b, p);
  const ev = [];
  for (let i = 0; i < 60 * 8; i++) { ev.length = 0; stepWorld(c, 1 / 60, ev); if (c.settled && i > 8) break; }
  return { world: c, ball: b };
};

function candidates(w, side, m) {
  const k = theMingo(w), out = [];
  if (!k) return out;
  const add = (style, tx, ty, kind) => {
    tx = clamp(tx, COURT.minThrow, COURT.maxThrow); ty = clamp(ty, -COURT.half + 0.25, COURT.half - 0.25);
    out.push({ style, tx, ty, kind });
  };
  for (let du = -1.4; du <= 0.9; du += 0.35) for (let dv = -0.9; dv <= 0.9; dv += 0.3) {
    add('roll', k.x + du, k.y + dv, 'place');
    if (du > -1.1 && du < 0.5 && Math.abs(dv) < 0.7) add('lob', k.x + du - 0.35, k.y + dv, 'place');
  }
  // shots: at every rival ball and at the mingo itself, from slightly short so the ball lands and drives through
  for (const b of w.balls) {
    if (!live(b)) continue;
    if (b.k || b.side !== side) {
      for (const dv of [-0.12, 0.12]) add('shot', b.x - 0.45, b.y + dv, b.k ? 'mingo' : 'knock');
      add('shot', b.x - 0.7, b.y, b.k ? 'mingo' : 'knock');
    }
  }
  return out;
}

export function createPlanner(w, m, side, prof, rng, o = {}) {
  const list = candidates(w, side, m);
  const base = valueOf(w, side);
  const p = { done: false, sims: 0, result: null, step(n = 8) {
    for (let i = 0; i < n && !p.done; i++) {
      if (!list.length) { p.finish(); break; }
      const c = list.pop(), r = simulate(w, side, c);
      let v = valueOf(r.world, side);
      if (r.ball.st === 'out') v -= 0.45;
      if (c.style === 'shot' && !o.perfect) v += prof.bias * 0.25;
      if (c.style === 'shot' && o.perfect) v += 0;
      p.scored.push({ ...c, v, rest: { x: r.ball.x, y: r.ball.y, out: r.ball.st === 'out' } });
      p.sims++;
      if (!list.length) p.finish();
    }
  }, scored: [], finish() {
    const s = p.scored.sort((a, b) => b.v - a.v);
    let pick = s[0];
    if (!o.perfect && s.length > 3 && rng.next() < prof.blunder) pick = s[1 + rng.int(Math.min(4, s.length - 1))];
    p.result = {
      params: { style: pick.style, tx: pick.tx, ty: pick.ty }, kind: pick.kind, score: pick.v, base, rest: pick.rest,
      alts: s.slice(0, 3).map((a) => ({ params: { style: a.style, tx: a.tx, ty: a.ty }, kind: a.kind, score: a.v })),
    };
    p.done = true;
  } };
  return p;
}

const gauss = (rng) => (rng.next() + rng.next() + rng.next() - 1.5) / 1.5;
// The plan as actually thrown: the aim point shifted by this rival's execution noise.
export function executePlan(plan, prof, rng) {
  const q = plan.params, n = prof.noise[q.style];
  const ang = Math.atan2(q.ty, q.tx), ca = Math.cos(ang), sa = Math.sin(ang);
  const along = gauss(rng) * n[0], across = gauss(rng) * n[1];
  return { style: q.style, tx: clamp(q.tx + ca * along - sa * across, 1, COURT.maxThrow + 0.4), ty: clamp(q.ty + sa * along + ca * across, -COURT.half + 0.1, COURT.half - 0.1) };
}

// The mingo toss for a rival: aim at a point inside the zone with a roll.
export function planMingo(rng, prof) {
  const u = COURT.zoneA + 1.2 + rng.next() * (COURT.zoneB - COURT.zoneA - 2.4), v = (rng.next() - 0.5) * 1.6;
  const n = prof.noise.roll;
  return { style: 'roll', tx: clamp(u + gauss(rng) * n[0] * 0.6, 3, 15), ty: clamp(v + gauss(rng) * n[1], -1.2, 1.2), mingo: true };
}

export { R_BALL, MINGO_ID };
