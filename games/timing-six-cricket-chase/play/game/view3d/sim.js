// Reads the sim (state.m, state.touch, state.v) and answers presentation questions: where is the ball, when is the
// bat meeting it, what shot is it, which bowler action is it. Pure functions of the state, no clock, no writes.
import { THEMES, DEG, clamp, lerp } from '../src/core.js';
import { deliveryPos, resolveSwing, ASSIST, shotName } from '../src/ball.js';

export const CONTACT_LEAD = 0.05; // the sim resolves a swing exactly this long after it commits (engine.stepMatch)
export const TICK = 1 / 60;
export const HOLD_T = 0.9;   // seconds the delivery picture stays up after the ball is hit (a presentation choice; the sim timeline is untouched)

const stubRng = { next: () => 0.5, range: (lo, hi) => (lo + hi) / 2, chance: () => false, pick: (x) => x[0], int: () => 0 };

export const isSpin = (d) => !!d && (d.spec.type === 'offspin' || d.spec.type === 'legspin');

/** Which view is the sim showing: the batter's-eye delivery view (3D) or the overhead field (2D)? */
export function viewOf(state) {
  const m = state.m;
  if (!m || !m.inn) return 'none';
  if (state.scene !== 'play' && state.scene !== 'auto') return 'none';
  const live = !!m.live && (m.phase === 'live' || (m.phase === 'result' && m.live));
  return live ? 'overhead' : 'delivery';
}

/** The swing the batter is (or is about to be) making. Returns null when nobody is swinging. */
export function swingOf(state) {
  const m = state.m;
  if (!m || !m.d) return null;
  const d = m.d;
  const tc = state.touch;
  const flightish = m.phase === 'flight' || m.phase === 'contact';
  // 1) the sim has accepted the swing: exact times and the real verdict
  if (m.sw) {
    const res = m.sw.res;
    return {
      src: 'sim', known: true, kind: m.sw.kind, angle: m.sw.angle, power: m.sw.power, T_c: m.sw.t + CONTACT_LEAD, tCommit: m.sw.t,
      contact: !!res.contact, resKind: res.kind, e: res.e, elev: res.elev ?? 0, init: res.init ?? null, speed: res.speed ?? 0, why: res.why,
    };
  }
  if (m.phase !== 'flight') return null;
  // 2) a human swipe that has committed but is not yet accepted by the sim (3 ticks): the timing is already fixed
  if (!m.inn.ai && tc && tc.down && tc.committed && tc.ok && tc.commitFt !== undefined) {
    const angle = tc.aimDeg ?? 0, power = 0.6;
    return predict(m, d, { src: 'touch', kind: 'swing', angle, power, tCommit: tc.commitFt });
  }
  // 3) the computer batter: the plan and its swing time are fixed at release
  if (m.inn.ai && m.aiPlan && m.aiSwingAt != null && m.aiPlan.kind !== 'leave') {
    const p = m.aiPlan;
    const tick = Math.ceil(m.aiSwingAt / TICK - 1e-6) * TICK; // the sim fires on the first tick at or after aiSwingAt
    return predict(m, d, { src: 'ai', kind: p.kind === 'block' ? 'block' : 'swing', angle: p.angle, power: p.power, tCommit: tick });
  }
  return null;
}

function predict(m, d, s) {
  const sw = { kind: s.kind, t: s.tCommit, angle: s.angle, power: s.power };
  const res = resolveSwing(d, sw, m.theme, stubRng, ASSIST[m.assist] ?? 1);
  return {
    src: s.src, known: false, kind: s.kind, angle: s.angle, power: s.power, T_c: s.tCommit + CONTACT_LEAD, tCommit: s.tCommit,
    contact: !!res.contact, resKind: res.kind, e: res.e, elev: res.elev ?? 0, init: res.init ?? null, speed: res.speed ?? 0, why: res.why,
  };
}

/** The point where the bat meets the ball (sim frame), from the delivery. */
export const contactPoint = (d) => [d.xc, d.yc, 0.4];

/** What the ball looks like right now. Returns { p: [x,y,z] (sim frame), vis, spin, held } */
export function ballOf(state, sw) {
  const m = state.m, d = m.d;
  if (!d) return { vis: false };
  const ph = m.phase;
  const dur = d.n / 60 - 0.02;
  if (ph === 'flight') {
    let t = m.ft;
    // when the swing is going to connect, the ball is guided onto the sweet spot over the last 3 frames, so bat and ball meet exactly on the contact frame
    if (sw && sw.contact) {
      const w = clamp((t - (sw.T_c - 0.05)) / 0.05, 0, 1);
      const real = deliveryPos(d, clamp(t, 0, dur));
      const N = contactPoint(d);
      const s = w * w * (3 - 2 * w);
      return { p: [lerp(real[0], N[0], s), lerp(real[1], N[1], s), lerp(real[2], N[2], s)], vis: true, spin: t * 38, held: false };
    }
    const q = deliveryPos(d, clamp(t, 0, dur));
    return { p: q, vis: q[2] > -2.2, spin: t * 38, held: false };
  }
  if (ph === 'contact') {
    const r = m.res;
    if (r && r.contact && r.init) {
      const t = m.pt;
      const i = r.init;
      return { p: [i.x + i.vx * t, Math.max(0.04, i.y + i.vy * t - 0.5 * 9.81 * t * t), i.z + i.vz * t], vis: true, spin: 60 + t * 80, held: false, launched: true };
    }
  }
  if (ph === 'result' && !m.live) {
    const t = Math.min(m.ft + m.pt, dur);
    const q = deliveryPos(d, t);
    return { p: q, vis: q[2] > -2.2 && m.pt < 0.7, spin: t * 38, held: false };
  }
  return { vis: false };
}

/** Which action should the bowler use? */
export function bowlerAction(state) {
  const m = state.m;
  const d = m.d;
  const spec = d ? d.spec : m.next ? { type: m.next.type } : null;
  const type = spec ? spec.type : 'pace';
  const spin = type === 'offspin' || type === 'legspin';
  return { type, spin, runT: m.runT ?? 1, kind: spin ? (type === 'legspin' ? 'leg' : 'off') : 'fast' };
}

export const SHOT_NAMES = { block: 'forward defence' };
export { shotName };
