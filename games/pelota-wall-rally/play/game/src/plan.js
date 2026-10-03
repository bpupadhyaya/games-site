// Rules judgement, forecast analysis and interception planning. Pure functions shared by the simulation, the AI and the HUD cues.
import { HW, L, SHORT, SERVE_LINE, BR, SWING_DELAY, EQUIP } from './consts.js';
import { at, idxOf } from './physics.js';

// ---------------------------------------------------------------------------------------------------------------------------------
// Rules: judge each impact in order. rs = { serve: bool, frontHit, leftFirst, bounces }. Returns null (play on) or
// { by: 'hitter'|'receiver', reason } where 'hitter' means the team that last struck the ball loses the point.
export function judgeImpact(rs, imp) {
  switch (imp.kind) {
    case 'floor':
      if (imp.x < -HW) return { by: 'hitter', reason: 'The ball landed outside the right line' };
      if (!rs.frontHit) return { by: 'hitter', reason: rs.serve ? 'Serve fault: the ball bounced before the front wall' : 'The ball bounced before reaching the front wall' };
      rs.bounces++;
      if (rs.serve && rs.bounces === 1 && (imp.z > SHORT || Math.abs(imp.x) > HW)) return { by: 'hitter', reason: 'Serve fault: it must land beyond the short line' };
      if (rs.bounces >= 2) return { by: 'receiver', reason: 'The ball bounced twice' };
      return null;
    case 'front':
      if (rs.serve && !rs.frontHit && imp.y < SERVE_LINE) return { by: 'hitter', reason: 'Serve fault: below the serve line' };
      if (rs.serve && !rs.frontHit && rs.leftFirst) return { by: 'hitter', reason: 'Serve fault: it touched the left wall first' };
      rs.frontHit = true;
      return null;
    case 'left':
      if (rs.serve && !rs.frontHit) rs.leftFirst = true;
      return null;
    case 'tin': return { by: 'hitter', reason: 'The ball hit the tin' };
    case 'high': return { by: 'hitter', reason: 'The ball hit above the top line' };
    case 'out': return { by: 'hitter', reason: rs.frontHit || rs.bounces ? 'The ball went out' : 'The ball went out of the court' };
    default: return null;
  }
}

/**
 * Analyse a forecast under the rules. flags = { serve, frontHit, bounces }.
 * Returns { fault: {by, reason, t}|null, tFront, tB1, tB2, ta, tb, tIdeal, endT } where [ta, tb] is the window in which the receiving side may strike the ball.
 */
export function analyse(F, flags) {
  const rs = { serve: !!flags.serve, frontHit: !!flags.frontHit, bounces: flags.bounces | 0, leftFirst: false };
  const out = { fault: null, tFront: flags.frontHit ? F.t0 : null, tB1: null, tB2: null, ta: null, tb: null, tIdeal: null, endT: F.t0 + F.n * F.h, b1: null };
  for (const imp of F.impacts) {
    const wasFront = rs.frontHit;
    const j = judgeImpact(rs, imp);
    if (!wasFront && rs.frontHit) out.tFront = imp.t;
    if (imp.kind === 'floor' && rs.frontHit && rs.bounces === 1) { out.tB1 = imp.t; out.b1 = { x: imp.x, z: imp.z }; }
    if (j) { out.fault = { ...j, t: imp.t, kind: imp.kind }; if (j.reason === 'The ball bounced twice') out.tB2 = imp.t; out.endT = imp.t; break; }
  }
  if (out.tFront !== null) {
    out.ta = out.tFront + 0.02;
    out.tb = out.fault ? (out.tB2 !== null ? out.tB2 - 0.02 : out.fault.t - 0.02) : out.endT;
    if (out.fault && out.tB2 === null) out.tb = null;                 // a ball that goes out / hits the tin is not playable: the fault stands
    if (out.tb === null || out.tb < out.ta) { out.ta = null; out.tb = null; }
  }
  if (out.ta !== null) out.tIdeal = idealTime(F, out.ta, out.tb);
  return out;
}

// The best moment to strike: a ball at about waist height, preferably falling.
export function idealTime(F, ta, tb) {
  let best = null, bc = 9;
  for (let t = ta; t <= tb + 1e-9; t += 1 / 60) {
    const p = at(F, idxOf(F, t));
    if (p.y < 0.3 || p.y > 2.0 || p.x < -HW + 0.2 || p.x > HW - 0.1 || p.z < 0.5 || p.z > L - 1.0) continue;
    const sp = Math.hypot(p.vx, p.vy, p.vz);
    const c = Math.abs(p.y - 0.95) + (p.vy > 0.4 ? 0.12 : 0) + Math.max(0, sp - 12) * 0.03 + (p.z < 1.0 ? 0.3 : 0) + (t - ta) * 0.03;
    if (c < bc) { bc = c; best = t; }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Stance: where a player stands to strike a ball at cp. Right-handers (m = +1) strike on their right, which is -x for a player facing +z.
export function stanceFor(p, cp, equip, from = p, d = null) {
  // the body stands so the striking arm reaches the ball without a stretch: lateral distance from the arm's reach and the ball height
  const crouch = Math.min(0.36, Math.max(0, 1.42 - (cp.y + 0.45)) * 0.6);
  const py = d ? cp.y - d.y * (BR + 0.012) : cp.y;                // the palm sits behind the ball along the shot direction
  const dy = py - (1.4 - crouch);
  const R = EQUIP[equip].id === 'paddle' ? 0.42 : 0.55;
  const R2 = R - (cp.y < 0.6 ? 0.12 : cp.y > 1.5 ? 0.1 : 0);                                   // a crouch shortens the reach
  const h = Math.sqrt(Math.max(0.01, R2 * R2 - dy * dy));
  const hb = Math.sqrt(Math.max(0.01, (R2 - 0.12) * (R2 - 0.12) - dy * dy));
  const latF = Math.min(0.85, 0.19 + h), latB = Math.max(0.08, hb - 0.19);     // the shoulder is 0.19 m to the side of the pelvis
  const m = p.lefty ? -1 : 1;
  const cl = (s) => ({ x: Math.max(-HW + 0.35, Math.min(HW - 0.55, s.x)), z: Math.max(0.75, Math.min(L - 1.2, s.z)) });
  // the ball is struck beside the body: on the dominant side (forehand) or across the body (backhand)
  const cands = [cl({ x: cp.x + m * latF, z: cp.z - 0.12 }), cl({ x: cp.x - m * latB, z: cp.z - 0.12 })].map((S, i) => {
    const lateral = (cp.x - S.x) * m;                // > 0: the ball is on the body's non-dominant side (backhand)
    const back = lateral > 0.02;
    const gap = Math.abs(cp.x - S.x);
    const cost = Math.hypot(S.x - from.x, S.z - from.z) + (back ? 0.35 : 0) + (gap < 0.3 ? (0.3 - gap) * 2 : 0) + (gap > 0.72 ? (gap - 0.72) * 3 : 0);
    return { S, back, cost, gap };
  });
  const c = cands[0].cost <= cands[1].cost ? cands[0] : cands[1];
  const tech = cp.y < 0.55 ? 'low' : cp.y > 1.5 ? 'high' : c.back ? 'back' : 'fore';
  return { x: c.S.x, z: c.S.z, tech, back: c.back, off: Math.hypot(cp.x - c.S.x, cp.z - c.S.z) };
}

export const reachOf = (p, equip) => EQUIP[equip].reach;

/**
 * Plan an interception for player p of a ball forecast F with analysis A (A.ta..A.tb), now = tNow.
 * Returns { ok, t, cp, S, slack, cost } for the best feasible strike time (ok) or the least bad one (ok = false).
 */
export function planFor(p, F, A, tNow, equip, opts = {}) {
  if (A.ta === null || A.tIdeal === null) return null;
  const react = opts.react ?? p.st.react, spd = opts.spd ?? p.st.spd;
  const maxY = EQUIP[equip].id === 'paddle' ? 2.0 : 1.8;
  let best = null, worst = null;
  const t0 = Math.max(A.ta, tNow + SWING_DELAY * 0.6);
  for (let t = t0; t <= A.tb + 1e-9; t += 1 / 30) {
    const cp = at(F, idxOf(F, t));
    if (cp.y < 0.36 || cp.y > maxY || cp.x < -HW + 0.1 || cp.x > HW - 0.08 || cp.z < 0.45 || cp.z > L - 0.95) continue;
    const S = stanceFor(p, cp, equip);
    const d = Math.hypot(S.x - p.x, S.z - p.z);
    const need = react + 0.12 + Math.max(0, d - 0.45) / spd + SWING_DELAY * 0.5;      // the last 0.45 m are covered by the step into the stance
    const slack = (t - tNow) - need;
    const cost = Math.abs(cp.y - 0.95) * 2.2 + Math.abs(t - A.tIdeal) * 0.5 + (cp.vy > 0.4 ? 0.1 : 0) + (S.tech === 'back' ? 0.08 : 0) + Math.max(0, -slack) * 4;
    const cand = { ok: slack >= 0.04, t, cp: { x: cp.x, y: cp.y, z: cp.z }, S, slack, cost, d };
    if (cand.ok) { if (!best || cost < best.cost) best = cand; }
    else if (!worst || slack > worst.slack) worst = cand;
  }
  return best || worst;
}

// How hard a landing spot or a hit is for a given player: the time to spare (s). Positive: the player gets there with time to spare.
export function slackFor(p, F, A, tNow, equip) {
  const pl = planFor(p, F, A, tNow, equip);
  return pl ? pl.slack : -9;
}
