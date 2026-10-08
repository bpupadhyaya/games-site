// The opponent. It plans with the very same physics the player plays on: it proposes many throws (pointing at
// spots around the pallino with a roll or a lob and some curve, hitting rival balls and the pallino), solves each
// to land where it wants, simulates it on a copy of the world with every ball on it, scores the frame it would
// leave, and picks point-or-hit by expected value. Its own hand is shaky: each throw is perturbed by the
// opponent's noise, it favours hitting or pointing by taste, and now and then it simply misjudges.
// The planner is time-sliced (`step(n)` runs at most n simulations) so it never stalls a frame.
import {
  cloneWorld, newBall, launch, settleWorld, clamp, MAX_ANG, thePallino, ranking, frameScore, COURT, HALF, solveThrow, previewThrow, R_B,
} from './sim.js';

const prox = (d) => 1 / (1 + d / 0.9);
const gauss = (rnd) => (rnd.next() + rnd.next() + rnd.next() + rnd.next() - 2) * 1.2247;

// value of a settled world for `side` (higher is better), with balls still to throw on each side
export function valueOf(w, side, myLeft, oppLeft) {
  const p = thePallino(w);
  if (!p) return 0;
  const rk = ranking(w);
  const me = rk.find((r) => r.b.team === side), op = rk.find((r) => r.b.team !== side);
  const s = frameScore(w);
  const D = s.tie || s.team < 0 ? 0 : s.team === side ? s.pts : -s.pts;
  if (myLeft === 0 && oppLeft === 0) return D;
  const dm = me ? me.d : 6, dop = op ? op.d : 6;
  let v = D + 0.8 * (prox(dm) - prox(dop));
  if (D > 0) v -= 0.16 * oppLeft * D; else v += 0.1 * myLeft;
  return v;
}

export function createPlanner(w, m, side, prof, rnd, opts = {}) {
  const perfect = !!opts.perfect, surf = w.surf;
  const myLeft = m.hand[side] - 1, oppLeft = m.hand[1 - side];
  const pal = thePallino(w);
  const cands = [];
  const mine = w.balls.filter((b) => !b.k && !b.out && !b.dead && b.team === side);
  const theirs = w.balls.filter((b) => !b.k && !b.out && !b.dead && b.team !== side);
  // candidates are described first (cheap) and solved a few per frame inside step(), so a turn never stalls a frame
  const specs = [];
  const addSolved = (kind, type, spin, x0, tx, ty, p0) => {
    if (ty < COURT.foul + 0.5 || ty > COURT.L - 0.12 || Math.abs(tx) > HALF - 0.12) return;
    specs.push([kind, type, spin, x0, tx, ty, p0]);
  };
  const solveSpec = ([kind, type, spin, x0, tx, ty, p0]) => {
    const s = solveThrow(surf, type, spin, x0, tx, ty, p0);
    if (!s || s.err > 0.12) return;
    cands.push({ kind, params: { type, power: s.p, ang: s.a, spin, x: x0 }, tx, ty, rest: s.rest });
  };
  // points: aim to rest at spots around the pallino (in front and beside are cheaper than behind)
  const spots = [{ dx: 0, dy: 0 }];
  for (let a = 0; a < 8; a++) spots.push({ dx: Math.sin((a * Math.PI) / 4) * 0.32, dy: Math.cos((a * Math.PI) / 4) * 0.32 });
  for (const [dx, dy] of [[0, -0.7], [0.7, 0], [-0.7, 0], [0, 0.6]]) spots.push({ dx, dy });
  for (const sp of spots) {
    const tx = pal.x + sp.dx, ty = pal.y + sp.dy;
    for (const x0 of [0, clamp(tx * 0.6, -1.2, 1.2), clamp(-tx * 0.5 + (rnd.next() - 0.5) * 0.5, -1.2, 1.2)]) {
      for (const type of [0, 1]) for (const spin of [0, -1, 1, 2, -2]) {
        if ((spin === 2 || spin === -2) && sp.dx !== 0) continue;
        addSolved('point', type, spin, x0, tx, ty, type === 0 ? 0.55 : 0.5);
      }
    }
  }
  // hits: at each rival ball and at the pallino, a little long so the ball arrives with some energy
  const targets = theirs.map((b) => ({ b, pallino: false }));
  targets.push({ b: pal, pallino: true });
  for (const t of targets) {
    for (const x0 of [0, clamp(t.b.x * 0.7, -1.1, 1.1)]) {
      const dx = t.b.x - x0, dy = t.b.y - COURT.startY, dl = Math.hypot(dx, dy) || 1;
      for (const over of [0.25, 0.6]) {
        for (const type of [2, 0]) for (const spin of [0, 1, -1]) {
          addSolved('hit', type, spin, x0, t.b.x + (dx / dl) * over, t.b.y + (dy / dl) * over, type === 2 ? 0.45 : 0.9);
        }
      }
    }
  }
  // never leave the planner without a throw: a plain roll straight at the pallino
  const fb = solveThrow(surf, 0, 0, 0, pal.x, pal.y - 0.3, 0.6);
  const fallback = { kind: 'point', params: { type: 0, power: fb.p, ang: fb.a, spin: 0, x: 0 }, tx: pal.x, ty: pal.y, rest: fb.rest };

  const evalParams = (params, noise = null) => {
    const wc = cloneWorld(w);
    const b = newBall(900, side, false);
    wc.balls.push(b);
    launch(wc, b, noise ? { ...params, power: clamp(params.power + noise.p, 0, 1), ang: clamp(params.ang + noise.a, -MAX_ANG, MAX_ANG) } : params);
    settleWorld(wc);
    return { v: valueOf(wc, side, myLeft, oppLeft), rest: { x: b.x, y: b.y }, dead: b.dead || b.out };
  };

  let stage = -1, si = 0, i = 0, sampleList = [], result = null, sims = 0;
  const scored = [];
  const jitter = (c) => {
    const s = c.kind === 'hit' ? prof.hit : prof.point, k = perfect ? 0.35 : 1;
    return { p: gauss(rnd) * s.p * k, a: gauss(rnd) * s.a * k };
  };
  const finish = () => {
    const rows = sampleList.map((r) => ({ ...r, score: r.sum / r.n + (r.c.kind === 'hit' && !perfect ? prof.bias : 0) }));
    rows.sort((a, b) => b.score - a.score);
    let pick = rows[0], blundered = false;
    if (!perfect && rnd.next() < prof.blunder && rows.length > 2) { pick = rows[1 + Math.floor(rnd.next() * Math.min(3, rows.length - 1))]; blundered = true; }
    result = {
      params: { ...pick.c.params }, kind: pick.c.kind, value: pick.score, blundered, rest: pick.c.rest ?? null,
      alts: rows.slice(0, 4).map((r) => ({ params: r.c.params, kind: r.c.kind, score: r.score, rest: r.c.rest ?? null })),
      target: { x: pick.c.tx, y: pick.c.ty },
    };
  };
  return {
    get done() { return result !== null; },
    get result() { return result; },
    get sims() { return sims; },
    step(n = 4) {
      while (n > 0 && result === null) {
        if (stage === -1) {
          const upto = Math.min(specs.length, si + n * 3);
          while (si < upto) solveSpec(specs[si++]);
          n = 0;
          if (si >= specs.length) { cands.push(fallback); stage = 0; }
        } else if (stage === 0) {
          if (i >= cands.length) {
            scored.sort((a, b) => b.v - a.v);
            const pts = scored.filter((r) => r.c.kind === 'point').slice(0, 3), hs = scored.filter((r) => r.c.kind === 'hit').slice(0, 3);
            sampleList = [...pts, ...hs].map((r) => ({ c: r.c, sum: 0, n: 0 }));
            stage = 1; i = 0;
            continue;
          }
          const c = cands[i++];
          const r = evalParams(c.params); sims++; n--;
          scored.push({ c, v: r.dead ? r.v - 0.5 : r.v });
        } else {
          const per = perfect ? 2 : 3, idx = Math.floor(i / per);
          if (idx >= sampleList.length) { finish(); break; }
          const s = sampleList[idx];
          const r = evalParams(s.c.params, jitter(s.c)); sims++; n--; i++;
          s.sum += r.dead ? r.v - 0.5 : r.v; s.n++;
        }
      }
      return result !== null;
    },
  };
}

// The AI's hand: the planned throw with this player's execution error added.
export function executePlan(plan, prof, rnd) {
  const s = plan.kind === 'hit' ? prof.hit : prof.point, k = plan.blundered ? 2.2 : 1;
  return {
    type: plan.params.type, spin: plan.params.spin, x: plan.params.x,
    power: clamp(plan.params.power + gauss(rnd) * s.p * k, 0, 1),
    ang: clamp(plan.params.ang + gauss(rnd) * s.a * k, -MAX_ANG, MAX_ANG),
  };
}

// Throwing the pallino: somewhere comfortable beyond the centre line, never against the back wall.
export function planPallino(surf, rnd, prof) {
  for (let tries = 0; tries < 8; tries++) {
    const ty = 11.6 + rnd.next() * 3.0, tx = (rnd.next() - 0.5) * 1.3, x0 = (rnd.next() - 0.5) * 1.4, type = rnd.next() < 0.7 ? 0 : 1;
    const s = solveThrow(surf, type, 0, x0, tx, ty, type === 0 ? 0.6 : 0.5);
    if (!s || s.err > 0.2) continue;
    const t = { type, power: s.p, ang: s.a, spin: 0, x: x0 };
    const pv = previewThrow(surf, t, { pallino: true, every: 99 });
    if (!pv.out && pv.rest.y > COURT.center + 1.2 && pv.rest.y < COURT.L - 0.8) {
      const sd = gauss(rnd) * (prof ? prof.point.p * 0.7 : 0);
      return { ...t, power: clamp(t.power + sd, 0, 1) };
    }
  }
  return { type: 0, power: 0.58, ang: 0, spin: 0, x: 0 };
}
