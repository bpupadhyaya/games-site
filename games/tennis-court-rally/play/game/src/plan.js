// Rules judgement, forecast analysis and interception planning. Pure functions shared by the simulation, the AI and the HUD cues.
// Sides: a player's side sign is -1 for the near half (team 0, z < 0) and +1 for the far half (team 1, z > 0).
import { HW, HL, SL, RUN_X, RUN_Z, BR, SWING_DELAY, IN_MARGIN } from './consts.js';
import { at, idxOf } from './physics.js';

export const sideOf = (team) => (team === 0 ? -1 : 1);

// ---------------------------------------------------------------------------------------------------------------------------------
// Rules: judge each impact in order. rs = { serve, side (the half the ball must land in), boxSign (serve: the box lies at x*boxSign > 0), bounces, cord }.
// Returns null (play on), { let: true } (serve clipped the net and landed in) or { by: 'hitter'|'receiver', reason }.
export function judgeImpact(rs, imp) {
  switch (imp.kind) {
    case 'net': return { by: 'hitter', reason: rs.serve ? 'Serve fault: the ball hit the net' : 'The ball hit the net' };
    case 'cord': rs.cord = true; return null;
    case 'floor': {
      if (rs.bounces >= 1) return { by: 'receiver', reason: 'The ball bounced twice' };
      if (Math.sign(imp.z) !== rs.side) return { by: 'hitter', reason: rs.serve ? 'Serve fault: it did not reach the net' : 'The ball landed on its own side' };
      const wide = Math.abs(imp.x) > HW + IN_MARGIN, long = Math.abs(imp.z) > (rs.serve ? SL : HL) + IN_MARGIN;
      if (rs.serve) {
        if (wide && long) return { by: 'hitter', reason: 'Serve fault: long and wide' };
        if (long) return { by: 'hitter', reason: 'Serve fault: long' };
        if (wide) return { by: 'hitter', reason: 'Serve fault: wide' };
        if (imp.x * rs.boxSign < -IN_MARGIN) return { by: 'hitter', reason: 'Serve fault: wrong service box' };
        if (rs.cord) return { let: true, reason: 'Let: the serve clipped the net' };
      } else {
        if (wide && long) return { by: 'hitter', reason: 'Out: long and wide' };
        if (long) return { by: 'hitter', reason: 'Out: long' };
        if (wide) return { by: 'hitter', reason: 'Out: wide' };
      }
      rs.bounces++;
      return null;
    }
    case 'out': return { by: rs.bounces ? 'receiver' : 'hitter', reason: rs.bounces ? 'The ball got past' : 'The ball went out' };
    default: return null;
  }
}

/**
 * Analyse a forecast under the rules. flags = { serve, side, boxSign, bounces, cord }.
 * Returns { fault, let, tNet, tB1, b1, tB2, ta, tb, tIdeal, endT } where [ta, tb] is the window in which the receiving side may strike the ball.
 */
export function analyse(F, flags) {
  const rs = { serve: !!flags.serve, side: flags.side, boxSign: flags.boxSign || 0, bounces: flags.bounces | 0, cord: !!flags.cord };
  const out = { fault: null, let: false, tNet: null, tB1: null, tB2: null, ta: null, tb: null, tIdeal: null, endT: F.t0 + F.n * F.h, b1: null };
  // the moment the ball crosses the net plane towards the receiving half
  for (let k = 1; k <= F.n; k++) { if (Math.sign(F.zs[k - 1]) !== Math.sign(F.zs[k]) && Math.sign(F.zs[k]) === rs.side) { out.tNet = F.t0 + k * F.h; break; } }
  if (Math.sign(F.zs[0]) === rs.side) out.tNet = F.t0;
  for (const imp of F.impacts) {
    const j = judgeImpact(rs, imp);
    if (imp.kind === 'floor' && rs.bounces === 1 && out.tB1 === null) { out.tB1 = imp.t; out.b1 = { x: imp.x, z: imp.z }; }
    if (j) {
      if (j.let) { out.let = true; out.letText = j.reason; out.tB1 = imp.t; out.b1 = { x: imp.x, z: imp.z }; out.endT = imp.t; break; }
      out.fault = { ...j, t: imp.t, kind: imp.kind };
      if (j.reason === 'The ball bounced twice') out.tB2 = imp.t;
      out.endT = imp.t; break;
    }
  }
  if (out.tNet !== null && !out.let) {
    out.ta = out.tNet + 0.03;
    if (out.fault) out.tb = out.tB2 !== null ? out.tB2 - 0.03 : null;           // a ball that is out / in the net is not playable: the fault stands
    else out.tb = out.endT;
    if (out.tb === null || out.tb < out.ta) { out.ta = null; out.tb = null; }
  }
  if (out.ta !== null) out.tIdeal = idealTime(F, out.ta, out.tb, out.tB1, rs.side);
  return out;
}

// The best moment to strike a ball that will be returned from the baseline: after the bounce, at about waist height, preferably falling.
export function idealTime(F, ta, tb, tB1, side) {
  let best = null, bc = 9;
  for (let t = ta; t <= tb + 1e-9; t += 1 / 60) {
    const p = at(F, idxOf(F, t));
    if (p.y < 0.3 || p.y > 1.9 || Math.abs(p.x) > HW + RUN_X - 0.6 || Math.abs(p.z) < 1.0 || Math.abs(p.z) > HL + RUN_Z - 0.5) continue;
    const sp = Math.hypot(p.vx, p.vy, p.vz);
    const post = tB1 !== null && t >= tB1 + 0.05;
    const c = Math.abs(p.y - 1.0) + (p.vy > 0.5 ? 0.12 : 0) + Math.max(0, sp - 14) * 0.02 + (post ? 0 : 0.3) + (t - ta) * 0.02;
    if (c < bc) { bc = c; best = t; }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Stance: where a player stands to strike a ball at cp. The contact is beside the body on the racket side (forehand) or across it (backhand).
export const ARM = { fore: 0.62, back: 0.5, high: 0.2 };
export function clampStance(team, x, z) {
  const side = sideOf(team);
  const cx = Math.max(-HW - RUN_X + 0.3, Math.min(HW + RUN_X - 0.3, x));
  const cz = side < 0 ? Math.max(-HL - RUN_Z + 0.3, Math.min(-1.0, z)) : Math.min(HL + RUN_Z - 0.3, Math.max(1.0, z));
  return { x: cx, z: cz };
}
export function stanceFor(p, cp, from = p) {
  const dir = -sideOf(p.team);                       // +1 facing +z (near player), -1 facing -z
  const m = p.lefty ? -1 : 1;
  const dom = -dir * m;                              // world x of the racket side
  const hi = cp.y > 1.85;
  const lat = { fore: ARM.fore - (cp.y < 0.6 ? 0.12 : 0), back: ARM.back - (cp.y < 0.6 ? 0.1 : 0), high: ARM.high };
  const fwd = hi ? 0.1 : 0.34;
  const mk = (kind) => {
    const sgn = kind === 'back' ? 1 : -1;            // forehand: the body stands to the non-racket side of the ball; backhand: to the racket side
    const S = clampStance(p.team, cp.x + sgn * dom * lat[kind], cp.z - dir * fwd);
    const gap = Math.abs(cp.x - S.x);
    const cost = Math.hypot(S.x - from.x, S.z - from.z) + (kind === 'back' ? 0.3 : 0) + (gap < 0.25 ? (0.25 - gap) * 2 : 0);
    return { S, kind, cost, gap };
  };
  const cands = hi ? [mk('high')] : [mk('fore'), mk('back')];
  const c = cands.reduce((a, b) => (b.cost < a.cost ? b : a));
  const tech = cp.y < 0.55 ? 'low' : hi ? 'high' : c.kind;
  return { x: c.S.x, z: c.S.z, tech, back: c.kind === 'back', off: Math.hypot(cp.x - c.S.x, cp.z - c.S.z) };
}

/**
 * Plan an interception for player p of a ball forecast F with analysis A, now = tNow.
 * Returns { ok, t, cp, S, slack, cost, volley } for the best feasible strike time (ok) or the least bad one (ok = false).
 */
export function planFor(p, F, A, tNow, opts = {}) {
  if (A.ta === null || A.tIdeal === null) return null;
  const react = opts.react ?? p.st.react, spd = opts.spd ?? p.st.spd;
  const side = sideOf(p.team), net = p.stance === 'net';
  let best = null, worst = null;
  const t0 = Math.max(A.ta, tNow + SWING_DELAY * 0.6);
  for (let t = t0; t <= A.tb + 1e-9; t += 1 / 30) {
    const cp = at(F, idxOf(F, t));
    if (Math.sign(cp.z) !== side || Math.abs(cp.z) < 1.05 || Math.abs(cp.z) > HL + RUN_Z - 0.4) continue;
    if (cp.y < 0.3 || cp.y > 2.35 || Math.abs(cp.x) > HW + RUN_X - 0.5) continue;
    const S = stanceFor(p, cp);
    const d = Math.hypot(S.x - p.x, S.z - p.z);
    const need = react + 0.12 + Math.max(0, d - 0.45) / spd + SWING_DELAY * 0.5;       // the last 0.45 m are covered by the step into the stance
    const slack = (t - tNow) - need;
    const volley = A.tB1 === null || t < A.tB1;
    const hiBall = cp.y > 1.9;
    const cost = Math.abs(cp.y - 1.0) * 2.0 + Math.abs(t - A.tIdeal) * 0.5 + (cp.vy > 0.5 ? 0.1 : 0) + (S.tech === 'back' ? 0.08 : 0)
      + (volley ? (net || hiBall ? 0 : 0.7) : (net ? 0.45 : 0)) + Math.max(0, -slack) * 4;
    const cand = { ok: slack >= 0.04, t, cp: { x: cp.x, y: cp.y, z: cp.z }, S, slack, cost, d, volley };
    if (cand.ok) { if (!best || cost < best.cost) best = cand; }
    else if (!worst || slack > worst.slack) worst = cand;
  }
  return best || worst;
}

// How hard a landing spot or a hit is for a given player: the time to spare (s). Positive: the player gets there with time to spare.
export function slackFor(p, F, A, tNow) {
  const pl = planFor(p, F, A, tNow);
  return pl ? pl.slack : -9;
}
export { BR };
