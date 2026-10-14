// The rivals (and the Hint). A rival plans with the very same physics the player bowls on: it proposes many shots (draws to spots round
// the jack with each hand, blocks in front, firm trails and drives at the jack or at your bowls), solves each into a real heading and
// weight, runs it on a copy of the green with every bowl on it, and scores the end it would leave. Its hand is shaky: the chosen shot is
// perturbed by the rival's noise, it favours firing or drawing by taste, and now and then it misjudges.
// The planner is time-sliced (`step(n)` runs at most n shots) so a rival never stalls a frame.
import { cloneWorld, newBowl, launch, settle, theJack, ranking, countEnd, solveShot, WEIGHTS, RINK, R_BOWL, clamp, liveBowls } from './sim.js';

const prox = (d) => 1 / (1 + d / 0.5);
export const gauss = (rnd) => (rnd.next() + rnd.next() + rnd.next() + rnd.next() - 2) * 1.2247;

// value of a settled green for `side` (higher is better), with bowls still to deliver on each side
export function valueOf(w, side, myLeft, oppLeft) {
  const j = theJack(w);
  if (!j || j.out) return -1.1;
  const rk = ranking(w);
  if (!rk.length && (myLeft > 0 || oppLeft > 0)) return -0.45;
  const me = rk.find((r) => r.b.team === side), op = rk.find((r) => r.b.team !== side);
  const s = countEnd(w);
  const D = s.tie || s.team < 0 ? 0 : s.team === side ? s.pts : -s.pts;
  if (myLeft === 0 && oppLeft === 0) return D;
  const dm = me ? me.d : 5, dop = op ? op.d : 5;
  let v = D + 0.7 * (prox(dm) - prox(dop));
  if (D > 0) v -= 0.13 * oppLeft * D; else v += 0.07 * myLeft;
  return v;
}

const KIND_OF = ['draw', 'firm', 'drive'];

export function createPlanner(w, m, side, prof, rnd, opts = {}) {
  const perfect = !!opts.perfect, g = w.green;
  const myLeft = m.left[side] - 1, oppLeft = m.left[1 - side];
  const jack = theJack(w);
  const specs = [];
  const live = liveBowls(w);
  const theirs = live.filter((b) => b.team !== side).sort((a, b) => Math.hypot(a.x - jack.x, a.y - jack.y) - Math.hypot(b.x - jack.x, b.y - jack.y));
  const ok = (tx, ty) => Math.abs(tx) < 2.1 && ty > 5 && ty < 33.2;
  const add = (kind, weight, hand, tx, ty, label) => { if (ok(tx, ty)) specs.push({ kind, weight, hand, tx, ty, label }); };
  const take = Math.max(0.35, prof.cands ?? 1);
  // draws: spots round the jack, a little short is cheapest; blocks well in front
  const spots = [[0, -0.1, 'on the jack'], [0, -0.35, 'just short of the jack'], [0.28, -0.12, 'beside the jack'], [-0.28, -0.12, 'beside the jack'], [0.3, 0.22, 'behind the jack'], [-0.3, 0.22, 'behind the jack'], [0, 0.3, 'behind the jack'], [0.6, -0.3, 'wide of the jack'], [-0.6, -0.3, 'wide of the jack']];
  const nSpots = Math.max(3, Math.round(spots.length * take));
  for (let i = 0; i < nSpots; i++) { const [dx, dy, lab] = spots[i]; for (const hand of [-1, 1]) add('draw', 0, hand, jack.x + dx, jack.y + dy, lab); }
  for (const [dx, dy] of [[0, -1.6], [0.35, -2.4], [-0.35, -2.4]]) for (const hand of [-1, 1]) add('draw', 0, hand, jack.x + dx, jack.y + dy, 'a block in front');
  // firm: trail the jack, nudge the nearest rival bowls
  if (take > 0.5) {
    for (const hand of [-1, 1]) add('firm', 1, hand, jack.x, jack.y, 'a firm bowl at the jack');
    for (const b of theirs.slice(0, 2)) for (const hand of [-1, 1]) add('firm', 1, hand, b.x, b.y, 'a firm bowl at a rival bowl');
  }
  // drives: at the jack and at the rival bowls nearest it
  for (const hand of [-1, 1]) add('drive', 2, hand, jack.x, jack.y, 'a drive at the jack');
  for (const b of theirs.slice(0, 3)) for (const hand of [-1, 1]) add('drive', 2, hand, b.x, b.y, 'a drive at a rival bowl');

  const solved = [];
  const solveSpec = (s) => {
    const sol = solveShot(g, s.hand, WEIGHTS[s.weight].arrive, s.tx, s.ty);
    if (sol.err > 0.2) return;
    solved.push({ ...s, theta: sol.theta, v0: sol.v0 });
  };
  const evalShot = (c, noise = null) => {
    const wc = cloneWorld(w);
    for (const b of wc.balls) { b.run = false; b.vx = 0; b.vy = 0; }
    const b = newBowl(900, side, c.hand);
    const th = noise ? c.theta + noise.a : c.theta, v0 = noise ? c.v0 * (1 + noise.l) : c.v0;
    launch(wc, b, { theta: th, v0 });
    settle(wc);
    const dead = b.out || (b.ditch && !b.toucher);
    let v = valueOf(wc, side, myLeft, oppLeft);
    if (dead && c.kind === 'draw') v -= 0.4;
    return { v, rest: { x: b.x, y: b.y }, dead };
  };
  const jitter = (c) => {
    const k = (perfect ? 0.3 : 1) * (c.kind === 'drive' ? 1.1 : 1);
    return { a: gauss(rnd) * prof.ang * k, l: gauss(rnd) * prof.len * k };
  };

  let stage = 0, i = 0, sims = 0, result = null, top = [];
  const scored = [];
  const finish = () => {
    const bias = (c) => (c.kind === 'drive' ? prof.drive * (perfect ? 0 : 1) - 0.3 : c.kind === 'firm' ? (perfect ? 0 : prof.drive * 0.4) - 0.08 : 0);
    const rows = top.map((r) => ({ ...r, score: r.sum / Math.max(1, r.n) + bias(r.c) }));
    rows.sort((a, b) => b.score - a.score);
    let pick = rows[0], blundered = false;
    if (!perfect && rows.length > 2 && rnd.next() < prof.blunder) {
      const alts = rows.slice(1).filter((r) => r.c.kind !== 'drive' || rows[0].c.kind === 'drive').slice(0, 3);
      if (alts.length) { pick = alts[Math.floor(rnd.next() * alts.length)]; blundered = true; }
    }
    const toPlan = (r) => ({ kind: r.c.kind, weight: r.c.weight, hand: r.c.hand, tx: r.c.tx, ty: r.c.ty, theta: r.c.theta, v0: r.c.v0, label: r.c.label, score: r.score, rest: r.rest });
    result = { ...toPlan(pick), blundered, alts: rows.slice(0, 4).map(toPlan) };
  };
  return {
    get done() { return result !== null; },
    get result() { return result; },
    get sims() { return sims; },
    get total() { return specs.length; },
    step(n = 4) {
      while (n > 0 && result === null) {
        if (stage === 0) {
          if (i >= specs.length) {
            if (!solved.length) { solveSpec({ kind: 'draw', weight: 0, hand: 1, tx: jack.x, ty: jack.y - 0.2 }); if (!solved.length) solved.push({ kind: 'draw', weight: 0, hand: 1, tx: jack.x, ty: jack.y, theta: 0, v0: Math.sqrt(2 * g.a * jack.y) }); }
            stage = 1; i = 0; continue;
          }
          solveSpec(specs[i++]);
          n--;
        } else if (stage === 1) {
          if (i >= solved.length) {
            scored.sort((a, b) => b.v - a.v);
            const per = (k) => scored.filter((r) => r.c.kind === k).slice(0, 2);
            const pool = [...per('draw'), ...per('firm'), ...per('drive')];
            pool.sort((a, b) => b.v - a.v);
            top = pool.slice(0, perfect ? 4 : 5).map((r) => ({ c: r.c, sum: 0, n: 0, rest: r.rest }));
            stage = 2; i = 0; continue;
          }
          const c = solved[i++];
          const r = evalShot(c); sims++; n--;
          scored.push({ c, v: r.v, rest: r.rest });
        } else {
          const per = perfect ? 2 : 3, idx = Math.floor(i / per);
          if (idx >= top.length) { finish(); break; }
          const t = top[idx];
          const r = evalShot(t.c, jitter(t.c)); sims++; n--; i++;
          t.sum += r.v; t.n++;
        }
      }
      return result !== null;
    },
  };
}

// The AI's hand: the planned shot with this rival's shake added.
export function executePlan(plan, prof, rnd) {
  const k = plan.blundered ? 2 : 1;
  return {
    theta: plan.theta + gauss(rnd) * prof.ang * k * (plan.kind === 'drive' ? 1.1 : 1),
    v0: plan.v0 * (1 + gauss(rnd) * prof.len * k),
  };
}
// Rolling the jack: a comfortable length, nearly dead straight.
export function planJack(rnd) {
  return { length: 24.5 + rnd.next() * 5.5 };
}
export const planLabel = (p) => {
  const side = p.hand > 0 ? 'curving right' : 'curving left';
  const w = KIND_OF[p.weight];
  return `${w[0].toUpperCase()}${w.slice(1)}, ${side}: ${p.label}`;
};
export { R_BOWL, RINK, clamp };
