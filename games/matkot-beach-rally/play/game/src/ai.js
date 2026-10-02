// The computer players. One planner serves four jobs: the rival in a match, the cooperative partner, the coach
// behind Watch & Learn, and the player's hint. It reads the ball with a human's error, runs at a human's speed,
// swings with a human's timing wobble and chooses shots by weighing how hard they are to return against how likely
// they are to miss the court. Nothing here sees anything the other side could not.
import { HW, LEN, MID, SWING, SPEED, AIM_SPAN, LIM, flightTime, depthFor, heightSigma, trajectory, gauss, ZLO, canHit } from './sim.js';
import { clamp } from './cam.js';

export const LANES = [-3.4, -2.4, -1.4, -0.5, 0.5, 1.4, 2.4, 3.4];
const ADJ = [-1, 0, 1];
const STYLES = [{ id: 'smash', h: 1.75 }, { id: 'drive', h: 1.2 }, { id: 'lob', h: 0.72 }];
const sigmoid = (v) => 1 / (1 + Math.exp(-v));
// Abramowitz-Stegun erf approximation, then the one-sided normal tail.
const erf = (x) => {
  const s = x < 0 ? -1 : 1, a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
};
const tail = (margin, sigma) => 0.5 * (1 - erf(margin / (Math.max(1e-3, sigma) * Math.SQRT2)));

// First descending crossing of height h along a sampled path.
function crossing(traj, h) {
  for (let i = 1; i < traj.length; i++) {
    const a = traj[i - 1], b = traj[i];
    if (a.z > h && b.z <= h) {
      const k = (a.z - h) / Math.max(1e-6, a.z - b.z);
      return { t: a.t + (b.t - a.t) * k, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
  }
  return null;
}

// Where a human stands so that the contact offset produces (tx, adj): the same mechanic the player uses.
export function standFor(p, P, tx, adj, reach) {
  const x = P.x - clamp(tx / AIM_SPAN, -1, 1) * reach;
  const fy = P.y - p.face * clamp(adj, -1, 1) * reach;
  return { x, y: fy - p.face * 0.3 };
}

// Plan a return for `side`. o: { mode: 'match' | 'coop', opp (the other player), humanMech (stand using the offset mechanic),
//   react (override), stress (0..1 extra wobble), difficulty (coop, 0..1), stretch (coop, 0..1), human (coop, who to feed) }
export function planReturn(w, side, prof, rng, o = {}) {
  const p = w.p[side], opp = w.p[1 - side], b = w.b;
  const traj = trajectory(b, w.wind, 0.025, 3.4);
  const react = o.react ?? prof.react + (rng.next() - 0.5) * 0.06;
  const sigP = prof.sigP, speed = o.speed ?? prof.speed;
  const ex = gauss(rng) * sigP, ey = gauss(rng) * sigP * 0.8;
  const longB = o.mode === 'coop' ? 0 : clamp((w.hits - (o.eager ? 4 : 14)) / (o.eager ? 6 : 36), 0, 1);   // long rallies tire people and tempt them to go for it
  const stressBase = clamp((o.stress ?? 0) + longB * (0.25 + prof.nerves * 0.5), 0, 1);
  const cands = [];
  const L = LIM[side];
  const serving = b.last < 0;
  for (const st of STYLES) {
    if (serving && st.id !== 'drive') continue;
    const c = crossing(traj, st.h);
    if (!c) continue;
    const P = { x: c.x, y: c.y };
    const perceived = { x: c.x + ex, y: c.y + ey };
    const S0 = { x: perceived.x, y: perceived.y - p.face * 0.3 };
    const S = { x: clamp(S0.x, L.x0, L.x1), y: clamp(S0.y, L.y0, L.y1) };
    if (Math.hypot(S.x - S0.x, S.y - S0.y) > 0.45) continue;
    const availT = c.t - react;
    if (availT <= 0.02) continue;
    const travel = Math.max(0, Math.hypot(S.x - p.x, S.y - p.y) - 0.2) / (speed * 0.9) + 0.12;
    const slack = availT - travel;
    if (slack < -0.06) continue;
    cands.push({ st, c, P, S, slack, availT });
  }
  let last = null;
  if (!cands.length) {
    // out of reach: run for the ball anyway and swing late, low
    const c = crossing(traj, 0.45) ?? crossing(traj, ZLO + 0.05) ?? { t: 0.8, x: b.x, y: b.y };
    const S = { x: clamp(c.x, L.x0, L.x1), y: clamp(c.y - p.face * 0.3, L.y0, L.y1) };
    return { feasible: false, style: 'lob', h: 0.45, tMeet: c.t, P: { x: c.x, y: c.y }, S, react, aim: { tx: clamp(-c.x * 0.4, -2, 2), depth: 0, sigma: 1.0 }, swingAt: Math.max(0, c.t - SWING.windup), ranked: [], stress: 1, slack: -1 };
  }
  const T0 = (h) => flightTime(h) * w.pace;
  const scored = [];
  for (const cd of cands) {
    const h = cd.st.h;
    const stress = clamp(stressBase + (cd.slack < 0.12 ? (0.12 - cd.slack) * 3 : 0), 0, 1);
    for (const tx of LANES) {
      for (const adj of ADJ) {
        const dep = clamp(depthFor(h) + adj * 0.9, 0.8, 5.6);
        const A = { x: tx, y: MID + p.face * dep };
        const T = T0(h);
        let value, pWin = 0, pOut = 0;
        const sig = Math.sqrt(prof.sigX ** 2 + heightSigma(h) ** 2) * (1 + stress * 0.9);
        pOut = Math.min(1, tail(HW - Math.abs(tx), sig) + tail(LEN - MID - dep, sig * 0.8) + tail(dep - 0.0, sig * 0.8) * 0.5);
        if (o.mode === 'coop') {
          const feed = o.feedX ?? 0;
          value = -Math.abs(tx - feed) * 0.5 - pOut * 1.2 - Math.abs(adj) * 0.1 + (cd.st.id === o.preferStyle ? 0.4 : 0);
        } else {
          const oppDist = Math.hypot(A.x - opp.x, A.y - opp.y);
          const oppTime = Math.max(0, oppDist - opp.reach * 0.85) / (opp.speed * 0.92) + 0.22;
          pWin = sigmoid((T - oppTime) / 0.2);
          const rr = 1.0 + (1 - prof.risk) * 0.8;
          value = pWin * (1 - pOut) * 1.0 + (1 - pWin) * (1 - pOut) * 0.28 - pOut * rr;
          if (cd.st.id === 'smash') value += prof.aggr * 0.35 + longB * 0.5 - (cd.slack < 0.2 ? 0.25 : 0);
          if (cd.st.id === 'lob') value += (1 - prof.aggr) * 0.1 + (stress > 0.5 ? 0.3 : 0);
          value += prof.habit * Math.sign(tx) * 0.12;
        }
        scored.push({ cd, tx, adj, dep, value, pWin, pOut, stress });
      }
    }
  }
  scored.sort((a, b) => b.value - a.value);
  let pick = scored[0];
  const slipped = (o.mode !== 'coop' || prof.slip > 0) && rng.next() < prof.slip;
  if (o.mode !== 'coop') {
    // softmax over the best few, so equal-looking shots are not always the same one
    const top = scored.slice(0, 9), temp = 0.05 + prof.slip * 2.5;
    const mx = top[0].value, ws = top.map((s) => Math.exp((s.value - mx) / temp));
    let r = rng.next() * ws.reduce((a, c) => a + c, 0), i = 0;
    while (i < ws.length - 1 && r > ws[i]) { r -= ws[i]; i++; }
    pick = top[i];
    if (slipped) pick = scored[Math.min(scored.length - 1, 12 + Math.floor(rng.next() * 20))];
  }
  const { cd } = pick;
  const jitter = gauss(rng) * prof.sigT * (1 + pick.stress * 0.8) * (slipped ? 3 : 1) * (serving ? 0.35 : 1);
  let S = { ...cd.S };
  const aimSigma = prof.sigX * (0.5 + pick.stress * 0.8) * 0.55;
  if (o.humanMech) S = standFor(p, cd.P, pick.tx, pick.adj, p.reach);
  if (slipped) { S.x += gauss(rng) * 0.9; S.y += gauss(rng) * 0.6; }
  return {
    feasible: true, style: cd.st.id, h: cd.st.h, tMeet: cd.c.t, P: cd.P, S, react, slack: cd.slack, stress: pick.stress,
    aim: { tx: pick.tx, depth: pick.adj, sigma: aimSigma }, swingAt: Math.max(0, cd.c.t - SWING.windup - prof.sigT * 1.1 + jitter),
    pWin: pick.pWin, pOut: pick.pOut, slipped, ranked: scored.slice(0, 6).map((s) => ({ style: s.cd.st.id, h: s.cd.st.h, tx: s.tx, adj: s.adj, dep: s.dep, value: s.value, pWin: s.pWin, pOut: s.pOut, S: o.humanMech ? standFor(p, s.cd.P, s.tx, s.adj, p.reach) : s.cd.S, P: s.cd.P })),
    alts: cands.map((c) => ({ style: c.st.id, h: c.st.h, P: c.P, t: c.c.t })),
  };
}

// ---- the cooperative partner's choice (feeds the player a returnable ball) ----------------------------
export function planFeed(w, side, prof, rng, o) {
  const d = clamp(o.difficulty ?? 0, 0, 1), stretch = clamp(o.stretch ?? 0, 0, 1);
  const hum = w.p[1 - side];
  const r = rng.next();
  const preferStyle = r < 0.55 - d * 0.3 ? 'lob' : r < 0.55 - d * 0.3 + 0.4 + d * 0.15 ? 'drive' : d > 0.45 && rng.next() < 0.5 ? 'smash' : 'drive';
  const feedX = clamp(hum.x * 0.55 + gauss(rng) * (0.35 + stretch * 1.3), -3.1, 3.1);
  return planReturn(w, side, prof, rng, { ...o, mode: 'coop', feedX, preferStyle });
}

// ---- executing a plan, one tick at a time ----------------------------------------------------------------
export function newAI(prof, rng) {
  return { prof, rng, plan: null, key: -2, t0: 0, refined: false, swung: false, homeX: 0, lastTx: 0 };
}
const homeY = (side) => (side === 0 ? 2.6 : 9.4);

// Returns the control for this tick: { tx, ty } to move, swing true to swing, aim for the shot.
export function aiTick(w, side, ai, o = {}) {
  const p = w.p[side], b = w.b, prof = ai.prof;
  const incoming = w.phase === 'rally' && b.live && canHit(w, side);
  if (!incoming) {
    ai.plan = null;
    if (w.phase === 'rally' && b.last === side) {
      ai.key = -2;
      const hx = clamp(-0.28 * ai.lastTx, -1.6, 1.6);
      return { tx: hx, ty: homeY(side) + p.face * -0.1 };
    }
    return { tx: 0, ty: homeY(side) };
  }
  const key = w.hits;
  if (ai.key !== key || !ai.plan) {
    ai.key = key; ai.t0 = w.t; ai.refined = false; ai.swung = false;
    const stress = clamp(prof.nerves * clamp((w.hits - 10) / 30, 0, 1) + (o.pressure ?? 0) * prof.nerves, 0, 1);
    const popt = { ...(o.plan ?? {}), opp: w.p[1 - side], stress, react: b.last < 0 ? 0.12 : undefined, speed: o.speed, eager: o.eager };
    ai.plan = o.coop ? planFeed(w, side, prof, ai.rng, { ...popt, difficulty: o.difficulty, stretch: o.stretch }) : planReturn(w, side, prof, ai.rng, { ...popt, mode: 'match' });
    ai.lastTx = ai.plan.aim.tx;
  }
  const plan = ai.plan, el = w.t - ai.t0, ctrl = {};
  if (el >= plan.react) { ctrl.tx = plan.S.x; ctrl.ty = plan.S.y; }
  if (plan.feasible && !ai.refined && el >= plan.tMeet - 0.4 && el >= plan.react) {
    ai.refined = true;
    const traj = trajectory(b, w.wind, 0.02, 2.0);
    const c = crossing(traj, plan.h);
    if (c) {
      const sg = prof.sigP * 0.35;
      const S0 = { x: c.x + gauss(ai.rng) * sg, y: c.y + gauss(ai.rng) * sg * 0.8 - p.face * 0.3 };
      plan.S = o.humanMech ? plan.S : { x: clamp(S0.x, LIM[side].x0, LIM[side].x1), y: clamp(S0.y, LIM[side].y0, LIM[side].y1) };
      plan.swingAt = el + c.t - SWING.windup - prof.sigT * 1.1 + gauss(ai.rng) * prof.sigT * (1 + plan.stress * 0.8) * (b.last < 0 ? 0.35 : 1);
      ctrl.tx = plan.S.x; ctrl.ty = plan.S.y;
    }
  }
  if (!ai.swung && el >= plan.swingAt && el >= plan.react) {
    ai.swung = true; ctrl.swing = true; ctrl.aim = plan.aim;
  }
  return ctrl;
}

// The coach's plan for a human: used by the hint and by the reveal in Watch & Learn.
export function coachPlan(w, side, rng, o = {}) {
  return planReturn(w, side, o.prof, rng, { mode: o.mode ?? 'match', humanMech: true, react: 0.12, speed: SPEED, ...o.extra });
}
