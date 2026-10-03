// The computer players. Five levels, used two ways: as the throwers (when you guard) and as the guard (when you throw).
// Every decision uses the same numbers the Think hint shows, so a hint's reason is the rival's reason too.
import {
  CAN, LINE_Z, FIELD, STYLES, TAG_R, SPEED, clamp, taya, throwers, slipOf, isHome, canUp, canThrow, doThrow, runTimes, fixTime, vulnerable, CIRCLE_PT, HOME_SLOTS,
} from './sim.js';

const hyp = Math.hypot;
export const THROWER_PROFILES = [
  { name: 'Lito', stars: 1, tag: 'Just learning', sig: 0.75, speed: 3.0, delay: [1.3, 2.8], minSlack: -0.7, est: 0.7, patience: 4, skim: 0.2, dodge: 0 },
  { name: 'Mara', stars: 2, tag: 'Friendly', sig: 0.62, speed: 3.1, delay: [1.0, 2.2], minSlack: -0.25, est: 0.5, patience: 5, skim: 0.35, dodge: 0 },
  { name: 'Pepe', stars: 3, tag: 'Street smart', sig: 0.5, speed: 3.22, delay: [0.8, 1.7], minSlack: 0.0, est: 0.3, patience: 6, skim: 0.5, dodge: 0.5 },
  { name: 'Ising', stars: 4, tag: 'Quick and careful', sig: 0.4, speed: 3.36, delay: [0.6, 1.3], minSlack: 0.12, est: 0.15, patience: 7, skim: 0.6, dodge: 1 },
  { name: 'Dado', stars: 5, tag: 'The one to beat', sig: 0.3, speed: 3.5, delay: [0.5, 1.0], minSlack: 0.2, est: 0.05, patience: 8, skim: 0.7, dodge: 1 },
];
export const TAYA_PROFILES = [
  { name: 'Lito', stars: 1, tag: 'Just learning', speed: 2.6, react: 0.65, lead: 0.0, wander: 1.0 },
  { name: 'Mara', stars: 2, tag: 'Friendly', speed: 2.9, react: 0.45, lead: 0.3, wander: 0.6 },
  { name: 'Pepe', stars: 3, tag: 'Street smart', speed: 3.2, react: 0.3, lead: 0.6, wander: 0.3 },
  { name: 'Ising', stars: 4, tag: 'Quick and careful', speed: 3.5, react: 0.17, lead: 0.85, wander: 0.1 },
  { name: 'Dado', stars: 5, tag: 'The one to beat', speed: 3.75, react: 0.08, lead: 1.0, wander: 0 },
];
export const REF_THROW = 1;   // the fixed thrower used as the opponent when a guard level is measured
export const REF_TAYA = 2;    // the fixed guard used when a thrower level is measured

export const gauss = (rng) => (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 1.2247;
// human scatter (metres) for the base lob; the same table the AI uses with its own sigma
export const HUMAN_SIG = 0.4;
export function scatter(rng, sig, style) {
  const st = STYLES[style];
  return { dx: gauss(rng) * sig * st.sigX, dz: gauss(rng) * sig * st.sigZ * 1.2, dT: gauss(rng) * 0.02 };
}

export function newBrains(w, thrLevel, tayaLevel, rng) {
  const br = { thr: {}, taya: { lat: 0, mode: 'guard', tgt: null, wob: 0, wx: 0, wz: 0, wt: 0 }, tp: TAYA_PROFILES[tayaLevel], hp: THROWER_PROFILES[thrLevel] };
  for (const a of throwers(w)) br.thr[a.id] = { t: br.hp.delay[0] + rng.next() * (br.hp.delay[1] - br.hp.delay[0]) + 0.4 * a.id, dash: false, wait: 0, est: 0, estT: 0, abort: false, plan: null };
  return br;
}
export function applyProfiles(w, br) {
  for (const a of throwers(w)) a.speed = br.hp.speed;
  taya(w).speed = br.tp.speed;
}

// ---- throwers ------------------------------------------------------------------------------------------------------------
function homePoint(a) { return { x: a.slot ?? 0, z: -0.55 }; }

// A running thrower steers round the guard when it is close and in the way.
function dodgeTarget(w, a, goal, dodge) {
  const T = taya(w);
  if (!dodge) return goal;
  const dToT = hyp(T.x - a.x, T.z - a.z);
  if (dToT > 2.3) return goal;
  const gx = goal.x - a.x, gz = goal.z - a.z, gl = hyp(gx, gz) || 1;
  const dx = gx / gl, dz = gz / gl;
  const tx = T.x - a.x, tz = T.z - a.z;
  const along = tx * dx + tz * dz;
  if (along < 0 || along > gl + 0.5) return goal;
  let nx = -dz, nz = dx;
  if (tx * nx + tz * nz > 0) { nx = -nx; nz = -nz; }   // step to the side away from the guard
  const step = Math.min(gl, 1.4), off = 1.4 * dodge;
  return { x: clamp(a.x + dx * step + nx * off, FIELD.x0 + 0.4, FIELD.x1 - 0.4), z: Math.max(LINE_Z - 0.4, a.z + dz * step + nz * off) };
}

function throwerStep(w, a, b, prof, rng, dt, cmds, gate) {
  if (a.tagged) return;
  const s = slipOf(w, a.id), T = taya(w);
  if (a.hasSlip) {
    b.dash = false; b.wait = 0;
    if (isHome(a)) {
      const hp = homePoint(a);
      if (hyp(a.x - hp.x, a.z - hp.z) > 0.3 && a.throwT <= 0) cmds[a.id] = { mx: hp.x, mz: hp.z };
      if (canUp(w) && w.can.grace <= 0 && w.go <= 0 && !w.slips.some((q) => q.mode === 'fly' && q.flew < 0.8)) {
        b.t -= dt;
        if (b.t <= 0 && canThrow(w, a)) {
          if (!b.plan) b.plan = { style: rng.next() < prof.skim ? 'skim' : 'lob' };
          if (!gate || gate('throw', a, { style: b.plan.style })) {
            doThrow(w, a, 0, CAN.z, b.plan.style, scatter(rng, prof.sig, b.plan.style));
            b.plan = null;
            b.t = prof.delay[0] + rng.next() * (prof.delay[1] - prof.delay[0]);
          }
        }
      }
    } else {
      const goal = { x: clamp(a.x * 0.8, FIELD.x0 + 0.6, FIELD.x1 - 0.6), z: -0.7 };
      const g = dodgeTarget(w, a, goal, prof.dodge);
      cmds[a.id] = { mx: g.x, mz: g.z };
    }
    return;
  }
  if (s.mode === 'fly' || s.mode === 'held') return;
  if (!b.dash) {
    // while a friend can still throw at the can, waiting is sensible; once nobody can, patience wears thin
    const hope = throwers(w).some((o) => o !== a && o.hasSlip && !o.tagged) || w.slips.some((q) => q.mode === 'fly');
    if (!hope && canUp(w)) b.wait += dt;
    b.estT -= dt;
    if (b.estT <= 0) { b.est = gauss(rng) * prof.est; b.estT = 0.35; }
    const rt = runTimes(w, a);
    const need = prof.minSlack - 0.5 * Math.max(0, b.wait - prof.patience * 0.6);
    if (rt.slack + b.est >= need && w.go <= 0 && (!gate || gate('dash', a, { rt }))) { b.dash = true; b.need = need; b.dashEst = b.est; }
  }
  if (b.dash) {
    // a careful thrower turns back if the guard is clearly going to win the race
    const rt = runTimes(w, a);
    if (prof.dodge > 0 && !isHome(a) && rt.slack + b.dashEst < b.need - 0.9 && hyp(a.x - s.x, a.z - s.z) > 1.2) { b.dash = false; b.wait = Math.max(0, b.wait - 2); cmds[a.id] = { mx: a.slot ?? 0, mz: -0.55 }; return; }
    const g = dodgeTarget(w, a, { x: s.x, z: s.z }, prof.dodge * 0.6);
    cmds[a.id] = { mx: g.x, mz: g.z };
  } else if (!isHome(a)) {
    cmds[a.id] = { mx: a.slot ?? 0, mz: -0.55 };
  }
  void T;
}

// ---- the guard --------------------------------------------------------------------------------------------------------------
function guardPoint(w, prof, b) {
  const rest = w.slips.filter((s) => s.mode === 'rest' && s.z > LINE_Z + 0.4);
  let gx = 0, gz = CAN.z - 0.95;
  if (rest.length) {
    const cx = rest.reduce((q, s) => q + s.x, 0) / rest.length, cz = rest.reduce((q, s) => q + s.z, 0) / rest.length;
    const dx = cx - 0, dz = cz - CAN.z, d = hyp(dx, dz) || 1;
    const k = Math.min(1.35, d * 0.5);
    gx = dx / d * k; gz = CAN.z + dz / d * k;
  }
  else {
    // nothing lying in the yard: stand ready just in front of the can, leaning towards the side the throws will come from
    const armed = w.agents.filter((q) => q.role === 'thrower' && q.hasSlip && !q.tagged);
    if (armed.length) gx = clamp(armed.reduce((q, a) => q + a.x, 0) / armed.length * 0.3, -0.9, 0.9);
  }
  return { x: clamp(gx, -2.2, 2.2), z: clamp(gz, LINE_Z + 0.9, CAN.z + 1.6) };
}

export function bestTarget(w) {
  const T = taya(w);
  let best = null, bs = 1e9;
  for (const a of throwers(w)) {
    if (!vulnerable(w, a)) continue;
    const tCatch = Math.max(0, hyp(a.x - T.x, a.z - T.z) - TAG_R * 0.7) / T.speed;
    const tHome = Math.max(0, a.z - LINE_Z) / a.speed;
    const sc = tCatch - tHome;
    if (sc < bs) { bs = sc; best = { a, tCatch, tHome, score: sc }; }
  }
  return best;
}

function tayaStep(w, T, b, prof, rng, dt, cmds, gate) {
  b.wt += dt;
  const c = w.can;
  let want = 'guard';
  if (c.mode !== 'up') want = T.carry ? 'carry' : 'fetch';
  else if (bestTarget(w)) want = 'chase';
  // the guard notices a change a moment late (the rival's reaction time); a mode that no longer makes sense is dropped at once
  const valid = (m) => (m === 'fetch' ? c.mode !== 'up' && !T.carry : m === 'carry' ? T.carry : m === 'chase' ? c.mode === 'up' && !!bestTarget(w) : c.mode === 'up');
  if (!valid(b.mode)) b.mode = want;
  if (want !== b.mode) { b.lat -= dt; if (b.lat <= 0 && (!gate || want === 'guard' || want === 'carry' || gate('guard' + want, T, { mode: want }))) { b.mode = want; b.lat = prof.react * (0.6 + 0.8 * rng.next()); } }
  else b.lat = prof.react * (0.6 + 0.8 * rng.next());
  if (b.mode === 'fetch') cmds[T.id] = { mx: c.x + c.vx * 0.15, mz: c.z + c.vz * 0.15 };
  else if (b.mode === 'carry') cmds[T.id] = { mx: CIRCLE_PT.x, mz: CIRCLE_PT.z };
  else if (b.mode === 'chase') {
    const tg = bestTarget(w);
    const a = tg.a, tl = Math.min(0.7, hyp(a.x - T.x, a.z - T.z) / T.speed) * prof.lead;
    let gx = a.x + a.vx * tl, gz = a.z + a.vz * tl;
    if (prof.lead >= 0.6 && !a.hasSlip) {
      // cut off: if the guard can reach the slipper before its owner, wait on it instead of following
      const sl = slipOf(w, a.id);
      if (sl.mode === 'rest' && hyp(sl.x - T.x, sl.z - T.z) / T.speed + 0.1 < hyp(sl.x - a.x, sl.z - a.z) / a.speed) { gx = sl.x; gz = sl.z; }
    }
    cmds[T.id] = { mx: clamp(gx, FIELD.x0 + 0.3, FIELD.x1 - 0.3), mz: Math.max(LINE_Z + 0.55, gz) };
  } else {
    // a purposeful stance: it eases to the best spot (slower for weaker guards) and then stands still, no wandering about
    const g = guardPoint(w, prof, b);
    if (b.gx === undefined) { b.gx = T.x; b.gz = T.z; }
    const rate = 1.2 + 4 * (1 - prof.wander);
    b.gx += (g.x - b.gx) * Math.min(1, rate * dt); b.gz += (g.z - b.gz) * Math.min(1, rate * dt);
    if (Math.hypot(g.x - T.x, g.z - T.z) > 0.18) cmds[T.id] = { mx: b.gx, mz: b.gz };
  }
}

// One tick of every computer-controlled player. `human` is the id of the player's own pawn (never driven here) or -1.
export function aiStep(w, br, rng, human, dt, cmds, gate) {
  if (w.phase !== 'play' || w.go > 0) return;
  const T = taya(w), skip = human instanceof Set ? human : new Set([human]);
  if (!skip.has(T.id)) tayaStep(w, T, br.taya, br.tp, rng, dt, cmds, gate);
  for (const a of throwers(w)) if (!skip.has(a.id)) throwerStep(w, a, br.thr[a.id], br.hp, rng, dt, cmds, gate);
}

// ---- Think: advice with the numbers behind it ----------------------------------------------------------------------------
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
export function adviseThrower(w, me, style) {
  const T = taya(w), s = slipOf(w, me.id);
  if (me.hasSlip && isHome(me)) {
    if (!canUp(w)) return { kind: 'wait', title: 'Hold your slipper', text: `The can is down. Keep your slipper, stay home and let the guard put the can back first. Then throw at it.`, mark: null };
    const near = hyp(T.x - 0, T.z - CAN.z);
    const skim = near > 1.6 || style === 'skim';
    const st = skim ? 'skim' : 'lob';
    return { kind: 'throw', style: st, tx: 0, tz: CAN.z, title: `Throw: ${STYLES[st].name} at the middle of the can`,
      text: `${skim ? `A skim sends the can far (a long fetch for the guard) and lets your friends run for their slippers. It is harder to place, so aim at the middle.` : `The guard is only ${f1(near)} m from the can, so keep it accurate: a high lob is easier to place.`} Aim at the middle of the can: its edges miss easily.`, mark: { x: 0, z: CAN.z } };
  }
  if (me.hasSlip) {
    const dh = Math.max(0, me.z - LINE_Z);
    return { kind: 'home', title: 'Run home', text: `You have your slipper. The toe line is ${f1(dh)} m away: get behind it and nobody can tag you.`, mark: { x: me.x, z: LINE_Z - 0.4 } };
  }
  if (s.mode === 'fly' || s.mode === 'held') return { kind: 'wait', title: 'Watch the throw', text: 'Your slipper is still in the air.', mark: null };
  const rt = runTimes(w, me);
  const down = !canUp(w);
  if (rt.slack > 1.0) return { kind: 'run', title: 'Run for it', text: `${down ? `The can is down, so the guard needs about ${f1(rt.fix)} s to stand it up and cannot tag yet. ` : ''}You need about ${f1(rt.tMe)} s to fetch your slipper and get home. The guard needs about ${f1(rt.tTaya)} s to reach it. You win the race by ${f1(rt.slack)} s.`, mark: { x: s.x, z: s.z } };
  return { kind: 'wait', title: 'Wait', text: `${down ? '' : 'The can is standing, so the guard can tag you. '}You need about ${f1(rt.tMe)} s to fetch your slipper and get home, but the guard needs only about ${f1(rt.tTaya)} s to reach it. ${rt.slack < 0 ? `You would lose the race by ${f1(-rt.slack)} s.` : `You would win by only ${f1(rt.slack)} s, which is too close to risk.`} Wait for a friend to knock the can down, or for the guard to move away.`, mark: { x: s.x, z: s.z } };
}

export function adviseTaya(w) {
  const T = taya(w), c = w.can;
  if (c.mode !== 'up') {
    if (T.carry) return { kind: 'carry', title: 'Carry it back', text: 'Take the can into the chalk circle and hold still a moment to stand it up. You cannot tag anyone until it stands.', mark: { x: CIRCLE_PT.x, z: CIRCLE_PT.z } };
    return { kind: 'fetch', title: 'Fetch the can', text: `The can is ${f1(hyp(c.x - T.x, c.z - T.z))} m away. Throwers are running for their slippers while it is down, and you cannot tag until it stands again. Go and get it.`, mark: { x: c.x, z: c.z } };
  }
  const tg = bestTarget(w);
  if (tg) {
    const gap = tg.tHome - tg.tCatch;
    return { kind: 'chase', title: 'Chase the one furthest from home', text: `The thrower is ${f1(Math.max(0, tg.a.z))} m from the toe line and can be home in about ${f1(tg.tHome)} s. You can reach them in about ${f1(tg.tCatch)} s. ${gap > 0 ? `That is ${f1(gap)} s to spare: go now.` : 'It is a long shot, but staying close still keeps them nervous.'}`, mark: { x: tg.a.x, z: tg.a.z } };
  }
  const rest = w.slips.filter((s) => s.mode === 'rest' && s.z > LINE_Z + 0.4);
  if (rest.length) return { kind: 'guard', title: 'Guard the slippers', text: `${rest.length} slipper${rest.length > 1 ? 's lie' : ' lies'} on the field. Stand between the can and them: nobody can fetch one without passing you. Stay near the can, and do not wander so far that you cannot get back to it.`, mark: guardPoint(w, TAYA_PROFILES[4], { wt: 0 }) };
  return { kind: 'guard', title: 'Guard the can', text: 'Stay close to the can and watch the throwers. A hit sends the can away, so be ready to run after it.', mark: { x: 0, z: CAN.z - 0.95 } };
}

export { fixTime, SPEED, HOME_SLOTS };
