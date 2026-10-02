// The live ball (after the bat): what every fielder, keeper and runner is doing, where the ball is, and the action-cam framing.
// Pure functions of the sim state (m.live, m.field, m.phase). Sim frame in, WORLD frame out (via toWorld).
import { THEMES, clamp, lerp } from '../src/core.js';
import { trackPos } from '../src/ball.js';
import { RUN_SPEED } from '../src/engine.js';
import { toWorld, yawOfSim } from './world.js';
import { V3 } from './rig.js';

export const THROW_DELAY = 0.2;    // the sim launches a throw 0.04 s after the pick-up; the picture holds the ball this much longer, then it flies a little faster (same arrival time)
const PICK_WARP = 0.04 + THROW_DELAY;

/** A ball position in sim frame for the live phase, and who (if anybody) has it in hand. */
export function liveBall(m) {
  const L = m.live;
  if (!L) return null;
  const th = THEMES[m.theme];
  if (L.bs === 'held') return { kind: 'hand', holder: L.holder };
  if (L.bs === 'thrown') {
    const T = L.th;
    if (T.t < THROW_DELAY) return { kind: 'hand', holder: findThrower(m, T), thrown: true };
    const u = clamp((T.t - THROW_DELAY) / Math.max(0.1, T.dur - THROW_DELAY), 0, 1);
    const r0 = [T.fx, 1.85, T.fz], r1 = [T.tx, 1.0, T.tz];
    const arc = Math.sin(u * Math.PI) * Math.min(2.0, T.d * 0.05);
    return { kind: 'air', p: [lerp(r0[0], r1[0], u), lerp(r0[1], r1[1], u) + arc, lerp(r0[2], r1[2], u)] };
  }
  if (L.bs === 'over') return { kind: 'air', p: L.overPos ?? [0, 0, 0] };
  const p = trackPos(L.track, Math.min(L.i, L.track.n - 1));
  return { kind: 'air', p };
}
function findThrower(m, T) {
  let best = 0, bd = 1e9;
  m.field.forEach((f, i) => { const d = Math.hypot(f.x - T.fx, f.z - T.fz); if (d < bd) { bd = d; best = i; } });
  return best;
}

/**
 * Descriptor for one fielder: { clip, time, x, z, yaw (world), targets: {name: V3}, reach: [{side, p: V3, w}], fingers }
 * The clip clock is derived from the sim's own times (frames to the pick-up / catch, seconds held, seconds of throw), never from a wall clock.
 */
export function fielderDesc(state, f, hand, o = {}) {
  const m = state.m, L = m.live;
  const W = (x, y, z) => toWorld(hand, x, y, z);
  const rxn = reactionOf(state);
  const base = { clip: 'field_ready', time: (state.t * 0.9 + f.id * 0.37) % 1.0, x: hand * f.x, z: -f.z, yaw: Math.PI * 0, targets: {}, reach: [] };
  const faceBall = (bp) => Math.atan2(hand * (bp[0] - f.x), -(bp[2] - f.z));
  if (rxn && rxn.out && (f.role === 'bowler' || f.id % 2 === 0 || f.id === (L && L.chaser))) return { ...base, clip: 'celebrate', time: Math.min(3.5, rxn.t * 1.0), yaw: Math.PI * 0 };
  if (!L) return base;
  const bp = trackPos(L.track, Math.min(L.i, L.track.n - 1));
  const plan = L.plan;
  const isChaser = f.id === L.chaser;
  const heading = yawOfSim(hand, f.fx, f.fz);
  // ---- the bowler (or whoever stands at the bowler's end) takes a throw at his stumps ----
  if (f.role === 'bowler' && L.bs === 'thrown' && L.th.end === 1 && !L.th.over) {
    const tTo = L.th.dur - L.th.t;
    const stump = W(0, 0.9, THEMES[m.theme].pitchLen - 0.1);
    if (tTo < 0.3) return { ...base, clip: 'catch_two_hand', time: clamp(0.3 - tTo, 0, 0.79), yaw: yawOfSim(hand, 0, -1), x: hand * 0.35, z: -(THEMES[m.theme].pitchLen + 0.9), targets: { catch: stump } };
  }
  // ---- the holder: pick-up (or catch) and the throw ----
  const throwing = L.bs === 'thrown' && findThrower(m, L.th) === f.id;
  if ((L.bs === 'held' && L.holder === f.id) || throwing) {
    const tt = L.bs === 'held' ? L.hold : 0.04 + L.th.t;
    const hp = L.bs === 'held' ? [f.x, 1.0, f.z] : [L.th.fx, 1.0, L.th.fz];
    const dir = L.bs === 'thrown' ? Math.atan2(hand * (L.th.tx - f.x), -(L.th.tz - f.z)) : heading;
    if (L.caught && L.bs === 'held') {
      return { ...base, clip: 'catch_two_hand', time: clamp(0.3 + L.hold, 0, 0.79), yaw: dir, targets: { catch: W(plan.pos[0], plan.pos[1], plan.pos[2]) } };
    }
    const dive = plan.diving && plan.kind === 'pickup';
    if (dive) return { ...base, clip: 'field_dive_stop', time: clamp(0.36 + tt, 0, 1.19), yaw: heading, targets: { stop: W(plan.pos[0], 0.12, plan.pos[2]) }, hold: true };
    const cT = tt <= PICK_WARP ? 0.22 + (tt / PICK_WARP) * (0.7 - 0.22) : 0.7 + (tt - PICK_WARP);
    const out = { ...base, clip: 'field_pickup_throw', time: clamp(cT, 0, 1.14), yaw: dir, targets: { ball: W(hp[0], 0.08, hp[2]) } };
    if (L.bs === 'thrown' && L.th.t > THROW_DELAY - 0.08 && L.th.t < THROW_DELAY + 0.06) out.reach = [{ side: 'R', p: W(L.th.fx, 1.85, L.th.fz), w: 1 - Math.abs(L.th.t - THROW_DELAY) / 0.08 }];
    return out;
  }
  // ---- the chaser on the way to the ball ----
  if (isChaser && (L.bs === 'track' || L.bs === 'wait')) {
    const idx = plan.kind === 'catch' ? plan.idx : (plan.pickupIdx ?? plan.idx);
    const tTo = Math.max(0, (idx - L.i) / 60);
    if (plan.kind === 'catch' || plan.kind === 'drop') {
      const tc = Math.max(0, (plan.idx - L.i) / 60);
      if (tc < 0.3) return { ...base, clip: 'catch_two_hand', time: clamp(0.3 - tc, 0, 0.79), yaw: faceBall(bp), targets: { catch: W(plan.pos[0], plan.pos[1], plan.pos[2]) } };
      if (L.bs === 'wait' || L.i > plan.idx) return { ...base, clip: 'catch_two_hand', time: clamp(0.3 + (L.i - plan.idx) / 60, 0, 0.79), yaw: faceBall(bp), targets: { catch: W(plan.pos[0], plan.pos[1], plan.pos[2]) } };
    } else if (plan.diving && tTo < 0.36) {
      return { ...base, clip: 'field_dive_stop', time: clamp(0.36 - tTo, 0, 1.19), yaw: faceBall(plan.pos), targets: { stop: W(plan.pos[0], 0.12, plan.pos[2]) } };
    } else if (tTo < 0.22) {
      return { ...base, clip: 'field_pickup_throw', time: clamp(0.22 - tTo, 0, 0.22), yaw: heading, targets: { ball: W(plan.pos[0], 0.08, plan.pos[2]) } };
    }
    if (f.run > 0.2) return { ...base, clip: 'field_chase', time: (L.t * 1.25) % 0.6, yaw: heading };
    return { ...base, yaw: faceBall(bp) };
  }
  // ---- everyone else: ready, or drifting towards the ball ----
  if (f.run > 0.2) return { ...base, clip: 'field_chase', time: (L.t * 0.9 + f.id * 0.2) % 0.6, yaw: heading };
  return { ...base, yaw: faceBall(bp) };
}

/** The keeper: crouched behind the stumps, takes throws that reach his end. */
export function keeperDesc(state, f, hand) {
  const m = state.m, L = m.live;
  const base = { clip: 'keeper_crouch', time: (state.t * 0.8) % 1.2, x: hand * f.x, z: -f.z, yaw: Math.PI, targets: {}, reach: [] };
  if (!L) return base;
  if (L.bs === 'thrown' && L.th.end === 0 && !L.th.over) {
    const tTo = L.th.dur - L.th.t;
    if (tTo < 0.2 + 0.0) return { ...base, clip: 'keeper_take', time: clamp(0.2 - tTo, 0, 0.89), targets: { take: toWorld(hand, f.x, 0.75, f.z + 0.5) } };
  }
  if (L.bs === 'held' && L.holder === f.id) return { ...base, clip: 'keeper_take', time: clamp(0.2 + L.hold, 0, 0.89), targets: { take: toWorld(hand, f.x, 0.75, f.z + 0.5) } };
  return base;
}

/** The two batters during the live ball: positions, heading, and what they are doing. null = still at the crease (the striker is posed by the batting code). */
export function runnersOf(state, hand) {
  const m = state.m, L = m.live, th = THEMES[m.theme];
  if (!L) return null;
  const rn = L.run, Ln = th.pitchLen;
  const out = [];
  for (let k = 0; k < 2; k++) {
    const from = rn.from[k], to = 1 - from;
    const moving = rn.mode === 'run' && rn.u[k] < 1;
    const u = rn.mode === 'run' ? rn.u[k] : 0;
    const zA = from === 0 ? 0 : Ln, zB = to === 0 ? 0 : Ln;
    const z = lerp(zA, zB, u);
    const x = k === 0 ? 0.55 : -0.55;
    const dir = to === 0 ? -1 : 1;
    const threatened = L.bs === 'thrown' && L.th.end === to && L.th.hit !== false;
    const state2 = !moving ? 'rest' : (u > 0.9 && threatened ? 'dive' : 'run');
    out.push({ k, from, to, u, z: moving ? z : (from === 0 ? -0.5 : Ln + 0.5) * 1, x, heading: dir, state: state2, dist: u * th.runLen, mode: rn.mode, turn: rn.turn });
  }
  return out;
}

/** Celebration needs: who is celebrating after the ball (appeal on a wicket, bat raised on a boundary). */
export function reactionOf(state) {
  const m = state.m;
  if (m.phase !== 'result' || !m.last) return null;
  return { out: m.last.out, boundary: m.last.boundary, kind: m.last.kind, t: m.pt };
}

/** Action camera: where to look at during the live ball. Returns { pos: V3, look: V3, fov, key } in the world frame. */
export function pipShot(state, hand, actorsPos) {
  const m = state.m, L = m.live;
  const th = THEMES[m.theme];
  const W = (x, y, z) => toWorld(hand, x, y, z);
  const batter = actorsPos.batter;
  if (!L) return { pos: batter.clone().add(new V3(2.2, 1.5, -3.0)), look: batter.clone().add(new V3(0, 1.1, 0)), fov: 38, key: 'batter' };
  const t = L.t;
  const ball = liveBall(m);
  const bp = trackPos(L.track, Math.min(L.i, L.track.n - 1));
  // 1) the finish of the shot: the batter from the front
  if (t < 0.55) {
    const bpos = actorsPos.striker || batter;
    return { pos: bpos.clone().add(new V3(1.7, 1.45, -3.1)), look: bpos.clone().add(new V3(0, 1.1, 0)), fov: 36, key: 'finish' };
  }
  // 2) a boundary or a ball in the air: follow the ball from behind the batter
  if (L.over && !L.over2 || L.bs === 'over') {
    const p = W(bp[0], Math.max(0.5, bp[1]), bp[2]);
    const dir = new V3(p.x, 0, p.z).normalize();
    return { pos: p.clone().add(dir.clone().multiplyScalar(-9)).add(new V3(0, 3.2, 0)), look: p, fov: 42, key: 'ball' };
  }
  // 3) a throw in the air: from the side at the middle
  if (L.bs === 'thrown') {
    const T = L.th;
    const a = W(T.fx, 1.2, T.fz), b = W(T.tx, 1.0, T.tz);
    const mid = a.clone().lerp(b, 0.5);
    const d = b.clone().sub(a); const side = new V3(-d.z, 0, d.x).normalize();
    return { pos: mid.clone().add(side.multiplyScalar(Math.max(5.5, d.length() * 0.45))).add(new V3(0, 2.2, 0)), look: mid.add(new V3(0, 1.0, 0)), fov: 42, key: 'throw' };
  }
  // 4) the fielder with the ball (or about to have it)
  const id = L.bs === 'held' ? L.holder : L.chaser;
  const f = m.field[Math.max(0, id)];
  const fp = actorsPos.fielders[f.id] || W(f.x, 0, f.z);
  const head = new V3(Math.sin(yawOfSim(hand, f.fx, f.fz)), 0, Math.cos(yawOfSim(hand, f.fx, f.fz)));
  const side = new V3(-head.z, 0, head.x);
  return { pos: fp.clone().add(side.clone().multiplyScalar(3.6)).add(head.clone().multiplyScalar(-1.6)).add(new V3(0, 1.5, 0)), look: fp.clone().add(new V3(0, 0.9, 0)).add(head.clone().multiplyScalar(0.6)), fov: 40, key: 'fielder' };
}
export const RUN = { speed: RUN_SPEED };
