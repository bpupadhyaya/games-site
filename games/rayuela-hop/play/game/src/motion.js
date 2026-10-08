// Where the hopper and the tejo are at a given display time: a PURE function of the engine state `s` (the scene and the 2D fallback only read it).
// The engine owns every time. The hopper's landings are the planned beat times of the route; a foul changes where the last foot lands and starts a stumble.
import { AIR, TOSS_FLIGHT } from './consts.js';

const G = 9.81;
export const HOP_H = (G * AIR * AIR) / 8;            // apex of a hop (m)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return d; };
export const lerpAng = (a, b, u) => a + angDiff(a, b) * u;
export const LINE_OFFSET = 0.215;                    // how far past (or short of) the middle a foot lands when it hits a line (m)

/** Landing point of a step, including the offset when the foot hit a chalk line. */
export function landingOf(st) {
  if (st.state === 'foul' && st.reason === 'line') {
    const sgn = st.d >= 0 ? 1 : -1;
    return { x: st.pos.x + Math.sin(st.yaw) * LINE_OFFSET * sgn, z: st.pos.z + Math.cos(st.yaw) * LINE_OFFSET * sgn };
  }
  return st.pos;
}

/**
 * The hopper. Returns { x, z, yaw, y, air, supp, free, bend, stumble, toss, step, grounded, celebrate, next }.
 *   supp  'B' both feet down, 'L' / 'R' the foot that is down (the other is lifted)
 *   bend  0..1 bending down to pick up the tejo
 *   toss  0..1 the throwing arm swing (windup .. release at 1), -1 when not tossing
 */
export function hopperAt(s, C, tD) {
  const T = s.turn;
  const base = { x: C.start.x, z: C.start.z, yaw: C.stops[0].yaw, y: 0, air: 0, supp: 'B', free: null, bend: 0, stumble: 0, toss: -1, step: -1, grounded: true, celebrate: 0, next: null, lean: 0 };
  if (!T) return base;
  // facing the target during the toss
  const tcell = T.cell >= 0 ? C.cells[T.cell] : null;
  const faceT = tcell ? Math.atan2(tcell.x - C.start.x, tcell.z - C.start.z) : C.stops[0].yaw;
  const inRun = (s.phase === 'count' || s.phase === 'hop' || s.phase === 'foul' || s.phase === 'clean') && T.route.length;
  if (!inRun) {
    base.yaw = faceT;
    if (s.phase === 'flight') { const d = tD - T.marker.t0; base.toss = d < 0 ? 0.55 + 0.45 * clamp((d + 0.12) / 0.12, 0, 1) : 1 + 0.4 * clamp(d / 0.3, 0, 1); }
    else if (s.phase === 'aimZ' || s.phase === 'aimLock') base.toss = 0;
    else if (s.phase === 'landed' || s.phase === 'tossEnd') base.toss = 1.4;
    if (s.phase === 'landed' || s.phase === 'tossEnd') base.celebrate = T.toss && T.toss.ok ? 0.5 : 0;
    return base;
  }
  const route = T.route, beat = T.beat;
  const f = route.findIndex((r) => r.state === 'foul');
  const last = route.length - 1;
  let i = 0;
  while (i < route.length && tD > route[i].t) i++;          // step i is the next landing (tD <= its time)
  const clip = f >= 0 ? Math.min(i, f) : i;
  const pastEnd = i > last;
  const j = (f >= 0 && i > f ? f : i - 1);                  // the last landing already made
  const prevSt = j >= 0 ? route[j] : null;
  const prevPos = prevSt ? landingOf(prevSt) : { x: C.start.x, z: C.start.z };
  const nextSt = !pastEnd && !(f >= 0 && i > f) ? route[i] : null;
  // heading: from the last step's heading to the next one's
  const yawPrev = prevSt ? prevSt.yaw : faceT_start(C);
  let yaw = yawPrev;
  if (nextSt) {
    const yawNext = nextSt.yaw;
    const t0 = prevSt ? prevSt.t + (prevSt.k === 'sky' ? 0.12 : 0.0) : T.tc;
    const dur = prevSt && prevSt.k === 'sky' ? beat * 0.95 : Math.min(0.5, beat * 0.7);
    yaw = lerpAng(yawPrev, yawNext, smooth((tD - t0) / dur));
  }
  const out = { ...base, yaw, x: prevPos.x, z: prevPos.z, step: clip, next: nextSt };
  // support foot: the foot of the last one-foot landing; both feet after a two-foot landing
  const suppOf = (st) => (st && st.state === 'done' && (st.k === 'one' || st.k === 'open') ? st.foot : st && (st.k === 'one' || st.k === 'open') ? (st.side || 'L') : 'B');
  out.supp = suppOf(prevSt);
  if (nextSt) {
    if (nextSt.k === 'pick') {
      const u = (tD - (nextSt.t - 0.3)) / 0.6;            // reach down, take the tejo at the beat, straighten
      out.bend = u < 0 ? 0 : u < 1 ? Math.sin(Math.PI * u * 0.5) : 1;
      out.pickT = tD - nextSt.t;
    } else if (tD >= nextSt.t - AIR) {
      const u = clamp((tD - (nextSt.t - AIR)) / AIR, 0, 1), L = landingOf(nextSt);
      out.x = prevPos.x + (L.x - prevPos.x) * u; out.z = prevPos.z + (L.z - prevPos.z) * u;
      out.y = 4 * HOP_H * u * (1 - u); out.air = u; out.grounded = false;
      const land = nextSt.k === 'one' || nextSt.k === 'open' ? (nextSt.state === 'done' ? nextSt.foot : (nextSt.k === 'open' ? nextSt.side : (out.supp === 'B' ? 'L' : out.supp))) : 'B';
      out.free = land === 'B' ? null : land === 'L' ? 'R' : 'L';
      out.supp = land;                                    // the foot that will land
      out.landFoot = land;
    }
  }
  // a pick-up in progress right after its beat (straightening up)
  if (prevSt && prevSt.k === 'pick' && !(nextSt && nextSt.k === 'pick')) {
    const u = (tD - prevSt.t) / (beat * 1.2);
    out.bend = u < 0 ? 1 : 1 - smooth(u);
  }
  // stance: wide when standing on / landing in the two halves of a double
  const wide = (st) => (st && (st.k === 'both') && C.stops[st.stop] && C.stops[st.stop].type === 'p' ? 1 : 0);
  out.stance = nextSt && out.air > 0 ? wide(prevSt) + (wide(nextSt) - wide(prevSt)) * out.air : wide(prevSt);
  // a bit of weight after each landing
  if (prevSt && prevSt.state === 'done') out.sinceLand = tD - prevSt.t;
  // stumble after a foul
  if (f >= 0 && tD > route[f].t) { out.stumble = smooth((tD - route[f].t) / 0.35) * (route[f].reason === 'line' ? 1 : 0.8); out.stumbleT = tD - route[f].t; out.reason = route[f].reason; out.supp = route[f].k === 'one' ? (route[f].foot || out.supp) : out.supp; }
  else if (f >= 0 && s.phase === 'foul') { out.pre = true; }
  // the finish
  if (s.phase === 'clean' || (pastEnd && f < 0)) { out.celebrate = clamp((tD - route[last].t) / 0.5, 0, 1); out.supp = 'B'; out.next = null; }
  return out;
}
function faceT_start(C) { return C.stops[0].yaw; }

/** The tejo: { vis, x, y, z, hand } at display time tD. */
export function tejoAt(s, C, tD) {
  const T = s.turn;
  if (!T) return { vis: false };
  const m = T.marker;
  if (m.state === 'none') return { vis: false };
  if (m.state === 'hand') return { vis: true, hand: true, x: m.x, y: 0.9, z: m.z };
  if (m.state === 'held') return { vis: true, hand: true, x: m.x, y: 0.5, z: m.z };
  if (m.state === 'air') {
    const u = clamp((tD - m.t0) / (m.t1 - m.t0 || TOSS_FLIGHT), 0, 1);
    const x = m.fx + (m.x - m.fx) * u, z = m.fz + (m.z - m.fz) * u;
    const y = 1.0 * (1 - u) + 0.02 * u + 4 * 0.85 * u * (1 - u);
    return { vis: true, x, y, z, spin: u * 12 };
  }
  // on the ground: a little bounce just after landing
  const since = tD - m.t1;
  const bounce = since > 0 && since < 0.3 ? 0.05 * Math.sin((since / 0.3) * Math.PI) : 0;
  return { vis: true, x: m.x, y: 0.012 + bounce, z: m.z };
}

/** The next landing the HUD ring is closing on, or null. */
export function ringTarget(s, tD) {
  const T = s.turn;
  if (!T || !T.route.length) return null;
  if (s.phase !== 'count' && s.phase !== 'hop') return null;
  const st = T.route[T.si];
  return st || null;
}
