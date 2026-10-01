// The opponent. It plans with the very same physics the player plays on: it proposes many throws
// (pointing at spots around the jack, shooting at rival boules and at the jack), simulates each on a
// copy of the world, scores the end it would leave, and picks point-or-shoot by expected value.
// Its own hand is shaky: each throw is perturbed by the opponent's noise, it favours shooting or
// pointing according to taste, and now and then it simply misjudges.
// The planner is time-sliced (`step(n)` runs at most n simulations) so it never stalls a frame.
import {
  cloneWorld, newBall, launch, stepWorld, clamp, MAX_ANG, powerFor, reachFor, rollOutEstimate, LOFTS, theJack, ranking, endScore, TIE_EPS, JACK_ZONE, LANE, dist2D,
} from './sim.js';

const prox = (d) => 1 / (1 + d / 12);

export function settleWorld(w, maxT = 9) {
  const ev = [];
  for (let t = 0; t < maxT; t += 1 / 60) { stepWorld(w, 1 / 60, ev); ev.length = 0; if (w.settled) break; }
}

// value of a settled world for `side` (higher is better), with boules still to throw on each side
export function valueOf(w, side, myLeft, oppLeft) {
  const j = theJack(w);
  if (!j) {
    if (myLeft > 0 && oppLeft === 0) return myLeft;
    if (oppLeft > 0 && myLeft === 0) return -oppLeft;
    return 0;
  }
  const rk = ranking(w);
  const me = rk.find((r) => r.b.team === side), op = rk.find((r) => r.b.team !== side);
  const s = endScore(w);
  const D = s.tie ? 0 : s.team === side ? s.pts : -s.pts;
  if (myLeft === 0 && oppLeft === 0) return D;
  const dm = me ? me.d : 150, dop = op ? op.d : 150;
  let v = D + 0.8 * (prox(dm) - prox(dop));
  if (D > 0) v -= 0.18 * oppLeft * D; else v += 0.1 * myLeft;
  return v;
}

// bisection: the power whose flat-gravel rest distance equals `dist` for this loft and spin
function powerForRest(loft, spin, dist) {
  const f = (p) => reachFor(loft, p) + rollOutEstimate({ loft, power: p, ang: 0, spin });
  let lo = 0, hi = 1;
  if (f(1) < dist || f(0) > dist) return -1;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (f(mid) < dist) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

const gauss = (rnd) => (rnd.next() + rnd.next() + rnd.next() + rnd.next() - 2) * 1.2247; // ~N(0,1)

export function createPlanner(w, m, side, prof, rnd, opts = {}) {
  const perfect = !!opts.perfect;
  const myLeft = m.hand[side] - 1, oppLeft = m.hand[1 - side];
  const jack = theJack(w);
  const cands = [];
  const add = (c) => { if (c.params.power >= 0 && c.params.power <= 1) { c.params.ang = clamp(c.params.ang, -MAX_ANG, MAX_ANG); cands.push(c); } };
  const mine = w.balls.filter((b) => !b.k && !b.out && b.team === side);
  const theirs = w.balls.filter((b) => !b.k && !b.out && b.team !== side);

  // points: aim to rest at spots around the jack
  const spots = [{ dx: 0, dy: 0 }];
  for (const r of [9, 18]) for (let a = 0; a < 8; a++) spots.push({ dx: Math.sin((a * Math.PI) / 4) * r, dy: Math.cos((a * Math.PI) / 4) * r });
  const spins = [0, 1, 2];
  for (const sp of spots) {
    const tx = jack.x + sp.dx, ty = jack.y + sp.dy;
    const dist = Math.hypot(tx, ty), ang = Math.atan2(tx, ty);
    for (const loft of [0, 1, 2]) for (const spin of spins) {
      if (loft === 2 && spin === 2 && perfect === false && false) continue;
      const power = powerForRest(loft, spin, dist);
      if (power < 0) continue;
      add({ kind: 'point', params: { loft, power, ang, spin }, tx, ty });
    }
  }
  // shots: at each rival boule and at the jack; a little long/short, with or without backspin
  const targets = theirs.map((b) => ({ b, jack: false }));
  if (jack) targets.push({ b: jack, jack: true });
  for (const t of targets) {
    const d = Math.hypot(t.b.x, t.b.y), ang = Math.atan2(t.b.x, t.b.y);
    for (const off of [-10, -2, 6]) for (const spin of [0, 1]) {
      const power = powerFor(3, d + off);
      add({ kind: 'shoot', params: { loft: 3, power, ang, spin }, tx: t.b.x, ty: t.b.y, jackShot: t.jack });
    }
  }

  // never leave the planner without a throw: a plain half-lob straight ahead
  add({ kind: 'point', params: { loft: 1, power: 0.5, ang: 0, spin: 0 }, tx: jack.x, ty: jack.y });

  const evalParams = (params, bumpNoise = null) => {
    const wc = cloneWorld(w);
    const b = newBall(900, 0, side, 0, 0);
    wc.balls.push(b);
    launch(wc, b, bumpNoise ? { ...params, power: clamp(params.power + bumpNoise.p, 0, 1), ang: clamp(params.ang + bumpNoise.a, -MAX_ANG, MAX_ANG) } : params);
    settleWorld(wc);
    return { v: valueOf(wc, side, myLeft, oppLeft), rest: { x: b.x, y: b.y }, out: b.out };
  };

  let stage = 0, i = 0, refineList = [], sampleList = [], result = null, sims = 0;
  const scored = [];
  const jitter = (c) => {
    const s = c.kind === 'shoot' ? prof.shoot : prof.point;
    const k = perfect ? 0.35 : 1;
    return { p: gauss(rnd) * s.p * k, a: gauss(rnd) * s.a * k };
  };

  const finish = () => {
    // expected value over noisy samples, plus the opponent's taste for shooting
    const rows = sampleList.map((r) => ({ ...r, score: r.sum / r.n + (r.c.kind === 'shoot' && !perfect ? prof.bias : 0) }));
    rows.sort((a, b) => b.score - a.score);
    let pick = rows[0];
    let blundered = false;
    if (!perfect && rnd.next() < prof.blunder && rows.length > 2) { pick = rows[1 + Math.floor(rnd.next() * Math.min(3, rows.length - 1))]; blundered = true; }
    const best = (kind) => rows.find((r) => r.c.kind === kind);
    result = {
      params: { ...pick.c.params },
      kind: pick.c.kind, value: pick.score, blundered,
      rest: pick.c.rest ?? null,
      alts: rows.slice(0, 4).map((r) => ({ params: r.c.params, kind: r.c.kind, score: r.score, rest: r.c.rest ?? null })),
      bestPoint: best('point') ? best('point').score : null, bestShoot: best('shoot') ? best('shoot').score : null,
      target: { x: pick.c.tx, y: pick.c.ty },
    };
  };

  return {
    get done() { return result !== null; },
    get result() { return result; },
    get sims() { return sims; },
    // run up to n simulations
    step(n = 4) {
      while (n > 0 && result === null) {
        if (stage === 0) {
          if (i >= cands.length) {
            // refine the best point candidates: nudge power/angle to account for the ground
            scored.sort((a, b) => b.v - a.v);
            const pts = scored.filter((r) => r.c.kind === 'point').slice(0, 3);
            const shs = scored.filter((r) => r.c.kind === 'shoot').slice(0, 3);
            for (const r of pts) for (const dp of [-0.05, -0.025, 0.025, 0.05]) for (const da of [-0.012, 0, 0.012]) {
              refineList.push({ kind: 'point', params: { ...r.c.params, power: clamp(r.c.params.power + dp, 0, 1), ang: clamp(r.c.params.ang + da, -MAX_ANG, MAX_ANG) }, tx: r.c.tx, ty: r.c.ty });
            }
            for (const r of shs) for (const dp of [-0.012, 0.012]) refineList.push({ kind: 'shoot', params: { ...r.c.params, power: clamp(r.c.params.power + dp, 0, 1) }, tx: r.c.tx, ty: r.c.ty });
            stage = 1; i = 0;
            continue;
          }
          const c = cands[i++];
          const r = evalParams(c.params); sims++; n--;
          c.rest = r.rest;
          scored.push({ c, v: r.v });
        } else if (stage === 1) {
          if (i >= refineList.length) {
            const all = scored.slice();
            all.sort((a, b) => b.v - a.v);
            const topPts = all.filter((r) => r.c.kind === 'point').slice(0, 3), topSh = all.filter((r) => r.c.kind === 'shoot').slice(0, 3);
            sampleList = [...topPts, ...topSh].map((r) => ({ c: r.c, sum: 0, n: 0 }));
            stage = 2; i = 0;
            continue;
          }
          const c = refineList[i++];
          const r = evalParams(c.params); sims++; n--;
          c.rest = r.rest;
          scored.push({ c, v: r.v });
        } else if (stage === 2) {
          const perCand = perfect ? 2 : 3;
          const idx = Math.floor(i / perCand);
          if (idx >= sampleList.length) { finish(); break; }
          const s = sampleList[idx];
          const r = evalParams(s.c.params, jitter(s.c)); sims++; n--; i++;
          s.sum += r.v; s.n++;
        }
      }
      return result !== null;
    },
  };
}

// The AI's hand: the planned throw with this opponent's execution error added.
export function executePlan(plan, prof, rnd, perfect = false) {
  const s = plan.kind === 'shoot' ? prof.shoot : prof.point;
  const k = perfect ? 0 : plan.blundered ? 2.2 : 1;
  return {
    loft: plan.params.loft, spin: plan.params.spin,
    power: clamp(plan.params.power + gauss(rnd) * s.p * k, 0, 1),
    ang: clamp(plan.params.ang + gauss(rnd) * s.a * k, -MAX_ANG, MAX_ANG),
  };
}

// Throwing the jack: somewhere comfortable inside the 5-8 m zone.
export function planJack(rnd, prof) {
  const d = 350 + rnd.next() * 90, x = (rnd.next() - 0.5) * 70;
  const loft = rnd.next() < 0.5 ? 1 : 2, ang = Math.atan2(x, d);
  const dist = Math.hypot(x, d);
  const power = powerFor(loft, dist - (loft === 1 ? 20 : 4));
  return { loft, spin: 0, power, ang };
}
