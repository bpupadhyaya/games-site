// Takraw skills as pose-to-pose key data plus world-space contact solving. Authored for a RIGHT-foot / right-side action;
// left-side actions are mirrored (x -> -x, lateral angles negated). Times are seconds relative to the sim's contact time (tc = 0).
// Frames: 'g' yaw-only frame on the ground under the pelvis, 'b' body frame at the pelvis (rotates with pitch/roll),
// 'ball' the contact solution, 'lock' the world position where the foot was planted when the action began.
import { THREE } from '../vendor3d/index.js';
import { easeFns } from './actor.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- scalar / vector tracks: keys are [t, value, ease?] ; value is a number or an array of numbers
export function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1], [t1, v1, e] = keys[i];
        const u = (easeFns[e || 'io'] || easeFns.io)(clamp((t - t0) / Math.max(1e-6, t1 - t0), 0, 1));
        return Array.isArray(v0) ? v0.map((a, k) => lerp(a, v1[k], u)) : lerp(v0, v1, u);
      }
    }
    return keys[keys.length - 1][1];
  };
}

// A limb track: a list of keys { t, f, p, pole, aim, w } resolved to world space at time t.
export function limbTrack(keys) { return keys; }

const mirrorVec = (v, m) => [v[0] * m, v[1], v[2]];

/**
 * ctx: { m (+1 right-side action, -1 left), C (Vector3 contact), d (Vector3 push direction, unit), yaw, lock:{L,R} (Vector3|null), ground }
 * limb key: { t, f: 'g'|'b'|'w'|'lock'|'ball', p:[..], pole:[..], aim:{n:[..],face,fwd:[..]}, off? }
 */
export function resolveKey(k, ctx, actor, F, side) {
  const m = ctx.m;
  if (k.f === 'lock') {
    // planted support foot: under the hip, on the ground (the pelvis is stationary at the stand spot, so this is a world lock)
    const sx = side === 'L' ? 1 : -1;
    const p = actor.toWorld([sx * 0.14, actor.groundAnkle, k.z ?? -0.02], 'g', F);
    return { p, pole: V(0, 0, 1).applyQuaternion(F.yawQ), n: null };
  }
  if (k.f === 'ball') {
    const n = ctx.d.clone();
    const fwd = k.fwd ? actor.dirToWorld(mirrorVec(k.fwd, m), k.pf || 'g', F) : V(Math.sin(ctx.yaw), 0, Math.cos(ctx.yaw));
    let p;
    if (k.hand) { p = ctx.C.clone().add(V(0, -0.04, 0)).addScaledVector(V(Math.sin(ctx.yaw), 0, Math.cos(ctx.yaw)), -(k.off ?? 0.10)); if (k.lat) p.addScaledVector(V(Math.cos(ctx.yaw), 0, -Math.sin(ctx.yaw)), k.lat * m); }
    else if (k.kneeFoot) { p = ctx.C.clone().addScaledVector(ctx.d, -0.14).add(V(0, -0.36, 0)).addScaledVector(V(Math.sin(ctx.yaw), 0, Math.cos(ctx.yaw)), -0.14); }
    else p = actor.ankleForBall(side, ctx.C, n, fwd, k.face || 'instep');
    return { p, pole: k.pole ? actor.dirToWorld(mirrorVec(k.pole, m), k.pf || 'g', F) : V(0, 0, 1).applyQuaternion(F.yawQ), n: k.hand || k.kneeFoot ? null : n, face: k.face, fwd };
  }
  if (k.f === 'wd') {   // world point = contact + push direction * s + up * u (follow-through)
    const p = ctx.C.clone().addScaledVector(ctx.d, k.p[0]).add(V(0, k.p[1], 0));
    return { p, pole: k.pole ? actor.dirToWorld(mirrorVec(k.pole, m), 'g', F) : V(0, 0, 1).applyQuaternion(F.yawQ), n: ctx.d.clone(), face: k.face, fwd: null };
  }
  const pv = mirrorVec(k.p, m); if (k.f === 'g') pv[1] += actor.groundAnkle;
  const p = actor.toWorld(pv, k.f, F);
  const pole = k.pole ? actor.dirToWorld(mirrorVec(k.pole, m), k.pf || k.f, F) : V(0, 0, 1).applyQuaternion(F.yawQ);
  const n = k.aim ? actor.dirToWorld(mirrorVec(k.aim.n, m), k.f === 'g' ? 'g' : 'b', F) : null;
  return { p, pole, n, face: k.aim && k.aim.face, fwd: k.aim && k.aim.fwd ? actor.dirToWorld(mirrorVec(k.aim.fwd, m), 'g', F) : null };
}

export function sampleLimb(keys, t, ctx, actor, F, side) {
  if (!keys || !keys.length) return null;
  if (t <= keys[0].t) return resolveKey(keys[0], ctx, actor, F, side);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i];
      const u = (easeFns[b.e || 'io'] || easeFns.io)(clamp((t - a.t) / Math.max(1e-6, b.t - a.t), 0, 1));
      const ra = resolveKey(a, ctx, actor, F, side), rb = resolveKey(b, ctx, actor, F, side);
      const out = { p: ra.p.clone().lerp(rb.p, u), pole: ra.pole.clone().lerp(rb.pole, u).normalize(), n: null, face: rb.face || ra.face, fwd: null };
      if (ra.n && rb.n) out.n = ra.n.clone().lerp(rb.n, u).normalize(); else out.n = rb.n && u > 0.5 ? rb.n : ra.n;
      out.fwd = ra.fwd && rb.fwd ? ra.fwd.clone().lerp(rb.fwd, u) : (ra.fwd || rb.fwd);
      out.contact = !!(rb.n && b.f === 'ball' && u > 0.999);
      return out;
    }
  }
  return resolveKey(keys[keys.length - 1], ctx, actor, F, side);
}

// =====================================================================================================================
// Technique definitions. Each returns { channels } for a given ctx; the sampler (presenter) evaluates them at t.
// Channels: dy, ox/oz (pelvis offsets, body-left / forward), pitch, roll, yawAdd (deg), bend, side, twist (torso), pBend, pSide, pTwist (pelvis bone),
//           legR, legL, armR, armL (limb key lists; the "R"/"L" are the AUTHORED sides, mirrored for left actions), w (overall weight track)
// =====================================================================================================================
const stance = (x, t) => ({ t, f: 'g', p: [x, 0, 0], e: 'io' });     // y is filled by the actor (ground ankle height)

export const TECH = {};

// Reusable arm poses (authored for the kicking side = R). Balance arms stay relaxed and natural: slightly out, elbows bent.
const armsBalance = (t0, t1, tc, lift = 0) => ({
  armR: [{ t: t0, f: 'b', p: [-0.34, -0.08, 0.10], pole: [-0.5, -1, -0.2] }, { t: tc - 0.12, f: 'b', p: [-0.62, 0.22 + lift, 0.0], pole: [-0.5, -1, -0.3], e: 'io' }, { t: tc + 0.15, f: 'b', p: [-0.55, 0.12 + lift, 0.05], pole: [-0.5, -1, -0.3] }, { t: t1, f: 'b', p: [-0.34, -0.08, 0.10], pole: [-0.5, -1, -0.2] }],
  armL: [{ t: t0, f: 'b', p: [0.34, -0.08, 0.10], pole: [0.5, -1, -0.2] }, { t: tc - 0.12, f: 'b', p: [0.50, 0.15 + lift, 0.18], pole: [0.5, -1, -0.3], e: 'io' }, { t: tc + 0.15, f: 'b', p: [0.46, 0.05 + lift, 0.2], pole: [0.5, -1, -0.3] }, { t: t1, f: 'b', p: [0.34, -0.08, 0.10], pole: [0.5, -1, -0.2] }],
});

// ---------- inside of the foot, low ball (0.12..0.5) ---------------------------------------------------------------
TECH.foot = (ctx) => ({
  dur: [-0.55, 0.6],
  dy: track([[-0.55, 0], [-0.22, -0.10, 'io'], [0, -0.15 - (ctx.lunge || 0) * 0.15, 'io'], [0.22, -0.09, 'io'], [0.6, 0, 'io']]),
  bend: track([[-0.55, 0], [-0.2, 14], [0, 18], [0.25, 8], [0.6, 0]]),
  side: track([[-0.55, 0], [0, 6], [0.6, 0]]),
  legL: [{ t: -0.55, f: 'lock' }, { t: 0.6, f: 'lock' }],
  legR: [
    { t: -0.55, f: 'g', p: [-0.12, 0.0, 0.0], pole: [0, 0, 1] },
    { t: -0.22, f: 'g', p: [-0.20, 0.16, -0.18], pole: [-0.2, 0, 1], e: 'io' },
    { t: 0, f: 'ball', face: 'inside', pole: [-0.2, 0, 1], e: 'in' },
    { t: 0.2, f: 'wd', p: [0.16, 0.0], pole: [-0.2, 0, 1], face: 'inside', e: 'out' },
    { t: 0.6, f: 'g', p: [-0.12, 0.0, 0.0], pole: [0, 0, 1], e: 'io' },
  ],
});

// ---------- lunge save: a deep step and a long reach for a ball that is nearly out of reach ---------------------------------------
TECH.lunge = (ctx) => ({
  dur: [-0.6, 0.95], fadeIn: 0.22, fadeOut: 0.3,
  dy: track([[-0.6, 0], [-0.25, -0.16, 'io'], [0, -0.40, 'io'], [0.3, -0.36], [0.95, 0, 'io']]),
  oz: track([[-0.6, 0], [-0.1, 0.25, 'io'], [0.25, 0.30], [0.95, 0, 'io']]),
  bend: track([[-0.6, 0], [-0.15, 26], [0.05, 34], [0.35, 24], [0.95, 0]]),
  side: track([[-0.6, 0], [0, 8], [0.95, 0]]),
  legL: [G_(-0.6, 0.12), G_(-0.2, 0.15, -0.35, 0, 'io'), G_(0.35, 0.18, -0.55), G_(0.95, 0.12)],
  legR: [
    G_(-0.6, -0.12),
    { t: -0.2, f: 'g', p: [-0.2, 0.2, 0.3], pole: [-0.3, 0.2, 1], e: 'io' },
    { t: 0, f: 'ball', face: 'inside', pole: [-0.3, 0.2, 1], e: 'in' },
    { t: 0.2, f: 'wd', p: [0.14, 0.0], pole: [-0.3, 0.2, 1], face: 'inside', e: 'out' },
    G_(0.95, -0.12, 0, 0, 'io'),
  ],
  armR: [AB(-0.6, -0.34, -0.1, 0.1), AB(-0.15, -0.62, 0.0, -0.15, 'io'), AB(0.3, -0.58, -0.05, -0.1), AB(0.95, -0.34, -0.12, 0.1)],
  armL: [AB(-0.6, 0.34, -0.1, 0.1), AB(-0.15, 0.55, 0.28, 0.3, 'io'), AB(0.3, 0.5, 0.1, 0.25), AB(0.95, 0.34, -0.12, 0.1)],
  look: 1,
});

// ---------- inside of the raised foot (the classic set / volley), ball 0.78..1.08 ---------------------------------------
TECH.footHi = (ctx) => ({
  dur: [-0.6, 0.65],
  dy: track([[-0.6, 0], [-0.25, -0.05, 'io'], [0, 0.0, 'io'], [0.3, -0.04], [0.65, 0, 'io']]),
  ox: track([[-0.6, 0], [-0.1, 0.07], [0.3, 0.05], [0.65, 0]]),
  bend: track([[-0.6, 0], [-0.2, 4], [0, -4], [0.3, 4], [0.65, 0]]),
  side: track([[-0.6, 0], [-0.1, 10], [0.2, 8], [0.65, 0]]),
  pSide: track([[-0.6, 0], [-0.1, 5], [0.65, 0]]),
  legL: [{ t: -0.6, f: 'lock' }, { t: 0.65, f: 'lock' }],
  legR: [
    { t: -0.6, f: 'g', p: [-0.12, 0.0, 0.0], pole: [0, 0, 1] },
    { t: -0.28, f: 'g', p: [-0.22, 0.30, 0.18], pole: [-0.6, 0.3, 1], e: 'io' },
    { t: 0, f: 'ball', face: 'inside', pole: [-0.6, 0.3, 1], e: 'in' },
    { t: 0.2, f: 'wd', p: [0.14, 0.02], pole: [-0.6, 0.3, 1], face: 'inside', e: 'out' },
    { t: 0.65, f: 'g', p: [-0.12, 0.0, 0.0], pole: [0, 0, 1], e: 'io' },
  ],
  ...armsBalance(-0.6, 0.65, 0, 0.05),
});

// ---------- knee / thigh (0.5..0.78) ---------------------------------------------------------------------------------------
TECH.knee = (ctx) => ({
  dur: [-0.55, 0.6],
  dy: track([[-0.55, 0], [-0.2, -0.05], [0, -0.02], [0.3, -0.05], [0.6, 0]]),
  bend: track([[-0.55, 0], [-0.1, 6], [0, 8], [0.6, 0]]),
  side: track([[-0.55, 0], [-0.1, 6], [0.2, 5], [0.6, 0]]),
  legL: [{ t: -0.55, f: 'lock' }, { t: 0.6, f: 'lock' }],
  // the knee itself meets the ball: foot is placed so the knee (calf joint) sits at the contact point
  legR: [
    { t: -0.55, f: 'g', p: [-0.12, 0.0, 0.0], pole: [0, 0, 1] },
    { t: -0.2, f: 'b', p: [-0.14, -0.62, 0.20], pole: [-0.2, 0.2, 1], e: 'io' },
    { t: 0, f: 'ball', off: 0.075, kneeFoot: true, pole: [-0.2, 0.2, 1], e: 'in' },
    { t: 0.22, f: 'b', p: [-0.14, -0.55, 0.15], pole: [-0.2, 0.2, 1], e: 'out' },
    { t: 0.6, f: 'g', p: [-0.12, 0.0, 0.0], pole: [0, 0, 1], e: 'io' },
  ],
  ...armsBalance(-0.55, 0.6, 0, 0.0),
  fix: { bone: 'knee', side: 'R', off: 0.08 },
});

// ---------- chest cushion (1.08..1.48) ---------------------------------------------------------------------------------------
TECH.chest = (ctx) => ({
  dur: [-0.5, 0.6],
  dy: track([[-0.5, 0], [-0.15, -0.08], [0, -0.04], [0.2, -0.10], [0.6, 0]]),
  bend: track([[-0.5, 0], [-0.15, -10], [0, -16], [0.2, 6], [0.6, 0]]),
  legL: [{ t: -0.5, f: 'lock' }, { t: 0.6, f: 'lock' }],
  legR: [{ t: -0.5, f: 'g', p: [-0.14, 0, 0.0] }, { t: -0.1, f: 'g', p: [-0.16, 0, 0.12], e: 'io' }, { t: 0.6, f: 'g', p: [-0.14, 0, 0.0] }],
  armR: [{ t: -0.5, f: 'b', p: [-0.34, -0.08, 0.10], pole: [-0.5, -1, -0.2] }, { t: -0.12, f: 'b', p: [-0.62, 0.02, -0.12], pole: [-0.5, -1, -0.3], e: 'io' }, { t: 0.2, f: 'b', p: [-0.56, -0.04, 0.0], pole: [-0.5, -1, -0.3] }, { t: 0.6, f: 'b', p: [-0.34, -0.08, 0.10], pole: [-0.5, -1, -0.2] }],
  armL: [{ t: -0.5, f: 'b', p: [0.34, -0.08, 0.10], pole: [0.5, -1, -0.2] }, { t: -0.12, f: 'b', p: [0.62, 0.02, -0.12], pole: [0.5, -1, -0.3], e: 'io' }, { t: 0.2, f: 'b', p: [0.56, -0.04, 0.0], pole: [0.5, -1, -0.3] }, { t: 0.6, f: 'b', p: [0.34, -0.08, 0.10], pole: [0.5, -1, -0.2] }],
  fix: { bone: 'chest', off: 0.13 },
});

// ---------- header (1.48..1.95): a small hop and a nod into the ball ---------------------------------------------------------
TECH.head = (ctx) => {
  const lift = ctx.lift || 0;
  return {
    dur: [-0.5, 0.6],
    dy: track([[-0.5, 0], [-0.22, -0.14, 'io'], [-0.02, lift, 'out'], [0.12, lift * 0.6 + 0.02, 'in'], [0.34, -0.06, 'io'], [0.6, 0]]),
    bend: track([[-0.5, 0], [-0.22, 10], [-0.08, -20, 'io'], [0.02, 18, 'in'], [0.25, 6], [0.6, 0]]),
    legL: [{ t: -0.5, f: 'g', p: [0.12, 0, 0] }, { t: -0.22, f: 'g', p: [0.14, 0, 0] }, { t: -0.04, f: 'g', p: [0.12, lift * 0.85 + 0.03, -0.12], e: 'out' }, { t: 0.25, f: 'g', p: [0.12, 0.02, 0.0], e: 'io' }, { t: 0.6, f: 'g', p: [0.12, 0, 0] }],
    legR: [{ t: -0.5, f: 'g', p: [-0.12, 0, 0] }, { t: -0.22, f: 'g', p: [-0.14, 0, 0] }, { t: -0.04, f: 'g', p: [-0.12, lift * 0.85 + 0.03, -0.14], e: 'out' }, { t: 0.25, f: 'g', p: [-0.12, 0.02, 0.0], e: 'io' }, { t: 0.6, f: 'g', p: [-0.12, 0, 0] }],
    armR: [{ t: -0.5, f: 'b', p: [-0.34, -0.08, 0.10], pole: [-0.5, -1, -0.2] }, { t: -0.15, f: 'b', p: [-0.40, -0.05, -0.15], pole: [-0.5, -1, -0.3], e: 'io' }, { t: 0.05, f: 'b', p: [-0.55, 0.30, 0.10], pole: [-0.5, -1, -0.3], e: 'out' }, { t: 0.6, f: 'b', p: [-0.34, -0.08, 0.10], pole: [-0.5, -1, -0.2] }],
    armL: [{ t: -0.5, f: 'b', p: [0.34, -0.08, 0.10], pole: [0.5, -1, -0.2] }, { t: -0.15, f: 'b', p: [0.40, -0.05, -0.15], pole: [0.5, -1, -0.3], e: 'io' }, { t: 0.05, f: 'b', p: [0.55, 0.30, 0.10], pole: [0.5, -1, -0.3], e: 'out' }, { t: 0.6, f: 'b', p: [0.34, -0.08, 0.10], pole: [0.5, -1, -0.2] }],
    fix: { bone: 'head', off: 0.10 },
  };
};

// ---------------------------------------------------------------------------------------------------------------------
// Aerial attacks and the block. Timeline relative to the contact: take-off at -up, apex at +0.03, landing at +up+0.06.
// Body-frame (b) leg targets are relative to the pelvis; the body rotates (pitch / roll) about the pelvis as a whole.
// ---------------------------------------------------------------------------------------------------------------------
const B = (t, x, y, z, pole = [0, 0, 1], e) => ({ t, f: 'b', p: [x, y, z], pole, e });
const G_ = (t, x, z = 0, y = 0, e) => ({ t, f: 'g', p: [x, y, z], pole: [0, 0, 1], e });
const AB = (t, x, y, z, e) => ({ t, f: 'b', p: [x, y, z], pole: [Math.sign(x) * 0.5, -1, -0.3], e });

// SUNBACK: back to the net, scissor kick, the ball struck over the shoulder.
TECH.back = (ctx) => {
  const up = 0.42;
  return {
    dur: [-0.62, 0.8], fadeIn: 0.2, fadeOut: 0.3,
    yawAbs: track([[-0.62, 0], [-0.42, 0], [-0.2, 180, 'io'], [0.8, 180]]),
    dy: track([[-1.0, 0], [-0.55, -0.02], [-0.5, -0.14, 'io'], [-up, -0.06, 'out'], [-0.15, 0], [0.3, 0], [0.5, -0.16, 'io'], [0.8, 0, 'io']]),
    pitch: track([[-1.0, 0], [-up, 0], [-0.22, -28, 'io'], [0, -72, 'out'], [0.1, -80], [0.3, -42, 'io'], [0.5, -4, 'io'], [0.8, 0]]),
    roll: track([[-up, 0], [0, 10], [0.5, 0]]),
    bend: track([[-1.0, 0], [-0.5, 6], [-0.1, -6], [0.02, -14], [0.3, 8], [0.52, 16], [0.8, 0]]),
    twist: track([[-up, 0], [0, 12], [0.4, 0]]),
    legLW: track([[-1.0, 0], [-0.62, 0], [-0.5, 1]]), legRW: track([[-1.0, 0], [-0.62, 0], [-0.5, 1]]),
    legL: [G_(-0.55, 0.12, 0.0, 0), G_(-0.42, 0.14, 0.0, 0.0, 'out'), B(-0.27, 0.12, -0.28, 0.72, [0, 0, 1], 'io'), B(-0.04, 0.12, -0.62, 0.40, [0, 0, 1], 'io'), B(0.12, 0.12, -0.80, -0.12, [0, 0, 1], 'io'), B(0.3, 0.1, -0.78, 0.1, [0, 0, 1], 'io'), G_(0.48, 0.14, 0.04, 0.0, 'io'), G_(0.8, 0.12, 0)],
    legR: [G_(-0.55, -0.12, 0.0, 0), G_(-0.42, -0.14, 0.0, 0.0, 'out'), B(-0.25, -0.10, -0.80, -0.28, [0, 0, 1], 'io'), B(-0.08, -0.12, -0.55, 0.22, [-0.3, 0, 1], 'io'), { t: 0, f: 'ball', face: 'instep', pole: [-0.3, 0, 1], e: 'in' }, { t: 0.14, f: 'wd', p: [0.18, 0.0], pole: [-0.3, 0, 1], face: 'instep', e: 'out' }, B(0.3, -0.1, -0.74, 0.12, [0, 0, 1], 'io'), G_(0.5, -0.14, 0.04, 0.0, 'io'), G_(0.8, -0.12, 0)],
    armLW: track([[-1.0, 0], [-0.65, 0], [-0.5, 1]]), armRW: track([[-1.0, 0], [-0.65, 0], [-0.5, 1]]),
    armL: [AB(-0.5, 0.32, -0.28, -0.2), AB(-up, 0.40, 0.42, 0.20, 'out'), AB(-0.05, 0.62, 0.30, 0.30, 'io'), AB(0.15, 0.60, 0.05, 0.1), AB(0.45, 0.38, -0.2, 0.1), AB(0.8, 0.30, -0.15, 0.05)],
    armR: [AB(-0.5, -0.32, -0.28, -0.2), AB(-up, -0.40, 0.42, 0.20, 'out'), AB(-0.05, -0.58, -0.05, -0.15, 'io'), AB(0.15, -0.60, -0.10, 0.0), AB(0.45, -0.38, -0.2, 0.1), AB(0.8, -0.30, -0.15, 0.05)],
    look: 1,
  };
};

// SCISSOR: side-on to the net, body tilted away, the near leg whips over the top; no rotation of the body.
TECH.scissor = (ctx) => {
  const up = 0.46;
  return {
    dur: [-0.62, 0.85], fadeIn: 0.2, fadeOut: 0.3,
    yawAbs: track([[-0.62, 0], [-0.46, 0], [-0.24, 90, 'io'], [0.85, 90]]),
    dy: track([[-1.0, 0], [-0.58, -0.02], [-0.52, -0.14, 'io'], [-up, -0.06, 'out'], [-0.15, 0], [0.3, 0], [0.52, -0.16, 'io'], [0.85, 0, 'io']]),
    roll: track([[-1.0, 0], [-up, 0], [-0.22, -34, 'io'], [0, -68, 'out'], [0.1, -72], [0.3, -36, 'io'], [0.52, -4, 'io'], [0.85, 0]]),
    pitch: track([[-up, 0], [0, 14], [0.4, 6], [0.85, 0]]),
    bend: track([[-1.0, 0], [-0.5, 8], [-0.05, 0], [0.5, 14], [0.85, 0]]),
    legLW: track([[-1.0, 0], [-0.64, 0], [-0.52, 1]]), legRW: track([[-1.0, 0], [-0.64, 0], [-0.52, 1]]),
    legL: [G_(-0.58, 0.12), G_(-up, 0.14, 0, 0, 'out'), B(-0.25, 0.14, -0.78, 0.15), B(-0.02, 0.2, -0.78, -0.12), B(0.2, 0.15, -0.74, 0.1), G_(0.5, 0.14, 0.04, 0, 'io'), G_(0.85, 0.12)],
    legR: [G_(-0.58, -0.12), G_(-up, -0.14, 0, 0, 'out'), B(-0.26, -0.40, -0.55, -0.30, [0, 0, 1], 'io'), B(-0.08, -0.45, -0.45, 0.10, [-0.3, 0.2, 1], 'io'), { t: 0, f: 'ball', face: 'instep', pole: [-0.3, 0.2, 1], e: 'in' }, { t: 0.14, f: 'wd', p: [0.2, 0.0], pole: [-0.3, 0.2, 1], face: 'instep', e: 'out' }, B(0.32, -0.12, -0.74, 0.10), G_(0.52, -0.14, 0.04, 0, 'io'), G_(0.85, -0.12)],
    armLW: track([[-1.0, 0], [-0.66, 0], [-0.52, 1]]), armRW: track([[-1.0, 0], [-0.66, 0], [-0.52, 1]]),
    armL: [AB(-0.52, 0.32, -0.28, -0.1), AB(-up, 0.40, 0.45, 0.2, 'out'), AB(0, 0.70, 0.3, 0.05, 'io'), AB(0.2, 0.6, 0.1, 0.1), AB(0.85, 0.30, -0.15, 0.05)],
    armR: [AB(-0.52, -0.32, -0.28, -0.1), AB(-up, -0.40, 0.45, 0.2, 'out'), AB(0, -0.55, 0.15, 0.1, 'io'), AB(0.2, -0.45, 0.0, 0.1), AB(0.85, -0.30, -0.15, 0.05)],
    look: 1,
  };
};

// ROLL: forward flip towards the net, the other leg kicks the ball over the shoulder as the body turns over; tucks to land.
TECH.roll = (ctx) => {
  const up = 0.40;
  return {
    dur: [-0.62, 0.85], fadeIn: 0.2, fadeOut: 0.25,
    yawAbs: track([[-1.0, 0], [0.85, 0]]),
    dy: track([[-1.0, 0], [-0.55, -0.02], [-0.5, -0.14, 'io'], [-up, -0.05, 'out'], [0.3, 0], [0.5, -0.12, 'io'], [0.85, 0, 'io']]),
    pitch: track([[-1.0, 0], [-up, 0], [-0.22, 55, 'io'], [0, 150, 'io'], [0.14, 215, 'io'], [0.3, 300, 'io'], [0.5, 360, 'out'], [0.85, 360]]),
    roll: track([[-up, 0], [0, 14], [0.4, 0]]),
    bend: track([[-1.0, 0], [-0.5, 8], [-0.2, 30, 'io'], [0, 12], [0.2, 40, 'io'], [0.5, 10], [0.85, 0]]),
    legLW: track([[-1.0, 0], [-0.64, 0], [-0.5, 1]]), legRW: track([[-1.0, 0], [-0.64, 0], [-0.5, 1]]),
    legL: [G_(-0.55, 0.12), G_(-up, 0.14, 0, 0, 'out'), B(-0.2, 0.12, -0.55, 0.45), B(0.0, 0.14, -0.62, 0.30), B(0.16, 0.10, -0.38, 0.45, [0, 0, 1], 'io'), B(0.32, 0.12, -0.55, 0.2), G_(0.5, 0.14, 0.04, 0, 'io'), G_(0.85, 0.12)],
    legR: [G_(-0.55, -0.12), G_(-up, -0.14, 0, 0, 'out'), B(-0.2, -0.12, -0.40, -0.55, [0, 0, 1], 'io'), B(-0.07, -0.12, -0.62, -0.10, [-0.3, 0, 1], 'io'), { t: 0, f: 'ball', face: 'instep', pole: [-0.3, 0, 1], e: 'in' }, { t: 0.14, f: 'wd', p: [0.16, 0.0], pole: [-0.3, 0, 1], face: 'instep', e: 'out' }, B(0.28, -0.12, -0.40, 0.35), G_(0.5, -0.14, 0.04, 0, 'io'), G_(0.85, -0.12)],
    armLW: track([[-1.0, 0], [-0.66, 0], [-0.5, 1]]), armRW: track([[-1.0, 0], [-0.66, 0], [-0.5, 1]]),
    armL: [AB(-0.5, 0.32, -0.28, -0.1), AB(-up, 0.35, 0.5, 0.3, 'out'), AB(-0.1, 0.55, 0.25, 0.3), AB(0.12, 0.3, -0.15, 0.4, 'io'), AB(0.4, 0.3, -0.1, 0.3), AB(0.85, 0.30, -0.15, 0.05)],
    armR: [AB(-0.5, -0.32, -0.28, -0.1), AB(-up, -0.35, 0.5, 0.3, 'out'), AB(-0.1, -0.55, 0.25, 0.3), AB(0.12, -0.3, -0.15, 0.4, 'io'), AB(0.4, -0.3, -0.1, 0.3), AB(0.85, -0.30, -0.15, 0.05)],
    look: 1,
  };
};

// JUMP HEADER (attack): upright jump, legs folded behind, the neck and torso snap forward into the ball.
TECH.headA = (ctx) => {
  const up = 0.34;
  return {
    dur: [-0.62, 0.75], fadeIn: 0.2, fadeOut: 0.3,
    yawAbs: track([[-0.9, 0], [0.75, 0]]),
    dy: track([[-0.9, 0], [-0.5, -0.02], [-0.44, -0.14, 'io'], [-up, -0.05, 'out'], [0.3, 0], [0.45, -0.14, 'io'], [0.75, 0, 'io']]),
    bend: track([[-0.9, 0], [-0.44, 10], [-0.12, -22, 'io'], [0.03, 26, 'in'], [0.3, 14, 'io'], [0.45, 14], [0.75, 0]]),
    pitch: track([[-0.9, 0], [-up, 0], [-0.05, -6], [0.1, 8], [0.4, 0]]),
    legLW: track([[-0.9, 0], [-0.55, 0], [-0.44, 1]]), legRW: track([[-0.9, 0], [-0.55, 0], [-0.44, 1]]),
    legL: [G_(-0.5, 0.12), G_(-up, 0.14, 0, 0, 'out'), B(-0.12, 0.12, -0.50, -0.42), B(0.12, 0.12, -0.55, -0.30), B(0.3, 0.12, -0.74, 0.0), G_(0.45, 0.14, 0.04, 0, 'io'), G_(0.75, 0.12)],
    legR: [G_(-0.5, -0.12), G_(-up, -0.14, 0, 0, 'out'), B(-0.12, -0.12, -0.52, -0.40), B(0.12, -0.12, -0.58, -0.28), B(0.3, -0.12, -0.74, 0.0), G_(0.45, -0.14, 0.04, 0, 'io'), G_(0.75, -0.12)],
    armLW: track([[-0.9, 0], [-0.55, 0], [-0.44, 1]]), armRW: track([[-0.9, 0], [-0.55, 0], [-0.44, 1]]),
    armL: [AB(-0.44, 0.30, -0.25, -0.1), AB(-0.2, 0.55, 0.30, -0.1, 'out'), AB(0.02, 0.62, 0.12, 0.2), AB(0.3, 0.5, 0.0, 0.1), AB(0.75, 0.30, -0.15, 0.05)],
    armR: [AB(-0.44, -0.30, -0.25, -0.1), AB(-0.2, -0.55, 0.30, -0.1, 'out'), AB(0.02, -0.62, 0.12, 0.2), AB(0.3, -0.5, 0.0, 0.1), AB(0.75, -0.30, -0.15, 0.05)],
    fix: { bone: 'head', off: 0.17, span: 0.2 },
    look: 1,
  };
};

// FOOT SPIKE: a quick jump with a high front kick, the other leg tucked, instep driving the ball down.
TECH.spikeFoot = (ctx) => {
  const up = 0.32;
  return {
    dur: [-0.62, 0.75], fadeIn: 0.2, fadeOut: 0.3,
    yawAbs: track([[-0.9, 0], [0.75, 0]]),
    dy: track([[-0.9, 0], [-0.5, -0.02], [-0.42, -0.14, 'io'], [-up, -0.05, 'out'], [0.3, 0], [0.42, -0.14, 'io'], [0.75, 0, 'io']]),
    pitch: track([[-0.9, 0], [-up, 0], [-0.1, -14, 'io'], [0.03, -20], [0.3, -4], [0.5, 0]]),
    bend: track([[-0.9, 0], [-0.42, 8], [-0.1, -4], [0.1, 10], [0.42, 12], [0.75, 0]]),
    side: track([[-up, 0], [0, 10], [0.4, 0]]),
    legLW: track([[-0.9, 0], [-0.55, 0], [-0.42, 1]]), legRW: track([[-0.9, 0], [-0.55, 0], [-0.42, 1]]),
    legL: [G_(-0.5, 0.12), G_(-up, 0.14, 0, 0, 'out'), B(-0.1, 0.12, -0.55, -0.35), B(0.1, 0.12, -0.58, -0.2), B(0.3, 0.12, -0.74, 0.0), G_(0.42, 0.14, 0.04, 0, 'io'), G_(0.75, 0.12)],
    legR: [G_(-0.5, -0.12), G_(-up, -0.14, 0, 0, 'out'), B(-0.14, -0.14, -0.50, -0.30, [0, 0, 1], 'io'), { t: 0, f: 'ball', face: 'instep', pole: [-0.4, 0.2, 1], e: 'in' }, { t: 0.14, f: 'wd', p: [0.16, 0.0], pole: [-0.4, 0.2, 1], face: 'instep', e: 'out' }, B(0.3, -0.12, -0.72, 0.05), G_(0.42, -0.14, 0.04, 0, 'io'), G_(0.75, -0.12)],
    armLW: track([[-0.9, 0], [-0.55, 0], [-0.42, 1]]), armRW: track([[-0.9, 0], [-0.55, 0], [-0.42, 1]]),
    armL: [AB(-0.42, 0.30, -0.25, -0.1), AB(-0.15, 0.58, 0.28, 0.1, 'out'), AB(0.05, 0.66, 0.15, 0.2), AB(0.3, 0.5, 0.0, 0.1), AB(0.75, 0.30, -0.15, 0.05)],
    armR: [AB(-0.42, -0.30, -0.25, -0.1), AB(-0.15, -0.55, 0.20, -0.1, 'out'), AB(0.05, -0.60, 0.05, -0.05), AB(0.3, -0.5, 0.0, 0.1), AB(0.75, -0.30, -0.15, 0.05)],
    look: 1,
  };
};

// BLOCK: a standing jump at the net, one leg driven up to meet the ball with the sole / shin; arms out for balance.
TECH.block = (ctx) => {
  const up = 0.36;
  return {
    dur: [-0.62, 0.75], fadeIn: 0.2, fadeOut: 0.3,
    yawAbs: track([[-0.8, 0], [0.75, 0]]),
    dy: track([[-0.8, 0], [-0.52, -0.02], [-0.45, -0.14, 'io'], [-up, -0.04, 'out'], [0.3, 0], [0.42, -0.14, 'io'], [0.75, 0, 'io']]),
    pitch: track([[-0.8, 0], [-up, 0], [-0.1, -10, 'io'], [0.1, -8], [0.4, 0]]),
    roll: track([[-up, 0], [0, 8], [0.4, 0]]),
    bend: track([[-0.8, 0], [-0.45, 8], [-0.1, -6], [0.12, 4], [0.42, 12], [0.75, 0]]),
    legLW: track([[-0.8, 0], [-0.55, 0], [-0.45, 1]]), legRW: track([[-0.8, 0], [-0.55, 0], [-0.45, 1]]),
    legL: [G_(-0.5, 0.12), G_(-up, 0.14, 0, 0, 'out'), B(-0.1, 0.12, -0.62, -0.20), B(0.12, 0.12, -0.70, -0.10), G_(0.42, 0.14, 0.04, 0, 'io'), G_(0.75, 0.12)],
    legR: [G_(-0.5, -0.12), G_(-up, -0.14, 0, 0, 'out'), B(-0.14, -0.16, -0.50, 0.15, [-0.2, 0.3, 1], 'io'), { t: 0, f: 'ball', face: 'sole', pole: [-0.2, 0.3, 1], e: 'in' }, { t: 0.14, f: 'wd', p: [0.1, 0.0], pole: [-0.2, 0.3, 1], face: 'sole', e: 'out' }, B(0.3, -0.12, -0.72, 0.05), G_(0.42, -0.14, 0.04, 0, 'io'), G_(0.75, -0.12)],
    armLW: track([[-0.8, 0], [-0.55, 0], [-0.45, 1]]), armRW: track([[-0.8, 0], [-0.55, 0], [-0.45, 1]]),
    armL: [AB(-0.45, 0.30, -0.25, -0.1), AB(-0.15, 0.62, 0.25, -0.05, 'out'), AB(0.1, 0.62, 0.15, 0.0), AB(0.4, 0.45, -0.05, 0.1), AB(0.75, 0.30, -0.15, 0.05)],
    armR: [AB(-0.45, -0.30, -0.25, -0.1), AB(-0.15, -0.62, 0.25, -0.05, 'out'), AB(0.1, -0.62, 0.15, 0.0), AB(0.4, -0.45, -0.05, 0.1), AB(0.75, -0.30, -0.15, 0.05)],
    look: 1,
  };
};

// SERVE (tekong): planted support foot in the circle, high instep kick on the dropping ball.
TECH.serve = (ctx) => ({
  dur: [-0.95, 0.85], fadeIn: 0.3, fadeOut: 0.3,
  dy: track([[-0.95, 0], [-0.5, -0.07, 'io'], [-0.2, -0.02], [0, 0.0], [0.3, -0.04], [0.85, 0, 'io']]),
  ox: track([[-0.95, 0], [-0.2, 0.06], [0.3, 0.04], [0.85, 0]]),
  bend: track([[-0.95, 0], [-0.4, 8], [-0.12, -8], [0.02, -4], [0.3, 8], [0.85, 0]]),
  side: track([[-0.95, 0], [-0.2, 10], [0.1, 12], [0.85, 0]]),
  pSide: track([[-0.95, 0], [-0.2, 6], [0.85, 0]]),
  twist: track([[-0.4, 0], [-0.1, 8], [0.1, -4], [0.5, 0]]),
  legL: [{ t: -0.95, f: 'lock' }, { t: 0.85, f: 'lock' }],
  legR: [G_(-0.95, -0.12), B(-0.38, -0.14, -0.55, -0.50, [-0.2, 0.2, 1], 'io'), B(-0.14, -0.14, -0.50, -0.22, [-0.3, 0.2, 1], 'io'), { t: 0, f: 'ball', face: 'instep', pole: [-0.3, 0.2, 1], e: 'in' }, { t: 0.2, f: 'wd', p: [0.24, 0.12], pole: [-0.3, 0.2, 1], face: 'instep', e: 'out' }, B(0.45, -0.12, -0.66, 0.1, [0, 0, 1], 'io'), G_(0.85, -0.12, 0, 0, 'io')],
  armR: [AB(-0.95, -0.34, -0.12, 0.1), AB(-0.3, -0.62, 0.12, -0.05, 'io'), AB(0.1, -0.64, 0.18, -0.1), AB(0.4, -0.5, -0.05, 0.05), AB(0.85, -0.34, -0.12, 0.1)],
  armL: [AB(-0.95, 0.34, -0.12, 0.1), AB(-0.3, 0.52, 0.2, 0.25, 'io'), AB(0.1, 0.46, 0.30, 0.3), AB(0.4, 0.42, 0.0, 0.12), AB(0.85, 0.34, -0.12, 0.1)],
  look: 1,
});

// TOSS (feeder): underarm lob with both hands. ctx.C = release point of the ball, ctx.d = initial direction of the ball.
TECH.toss = (ctx) => {
  const H = (side, t, x, y, z, e) => ({ t, f: 'g', p: [x * side, y, z], pole: [side * 0.5, -1, -0.3], e });
  const mk = (side) => [H(side, -0.7, 0.10, 0.90, 0.28), H(side, -0.3, 0.12, 0.76, 0.18, 'io'), { t: 0, f: 'ball', hand: true, off: 0.10, lat: 0.075 * (side > 0 ? 1 : -1), pole: [side * 0.5, -1, -0.3], e: 'in' }, H(side, 0.18, 0.12, 1.85, 0.22, 'out'), H(side, 0.34, 0.16, 1.55, 0.28, 'io'), H(side, 0.62, 0.20, 0.95, 0.12, 'io')];
  return {
    dur: [-0.7, 0.65], fadeIn: 0.2, fadeOut: 0.25,
    dy: track([[-0.7, 0], [-0.3, -0.08, 'io'], [0, 0.0, 'in'], [0.3, 0.0], [0.6, 0]]),
    bend: track([[-0.7, 0], [-0.3, 8], [0, -4, 'in'], [0.3, -2], [0.6, 0]]),
    armR: mk(-1), armL: mk(1), armLW: () => 1, armRW: () => 1,
    look: 1,
  };
};

// ---------------------------------------------------------------------------------------------------------------------
// Evaluate a technique at time t (seconds relative to tc). Returns a pose for Actor.apply or null outside the window.
// ctx: { m, x, z, yaw, jy, pelvisBase (Vector3: where the base animation has the pelvis), H0, C, d, lock:{L,R}, ground, look (Vector3) }
// ---------------------------------------------------------------------------------------------------------------------
const D2R = Math.PI / 180;
export function evalPose(def, ctx, t, actor) {
  const m = ctx.m;
  const [a, b] = def.dur;
  if (t < a || t > b) return null;
  // blend weight: ease in over the first 0.18 s, out over the last 0.22 s
  const w = clamp(Math.min((t - a) / (def.fadeIn ?? 0.18), (b - t) / (def.fadeOut ?? 0.22)), 0, 1);
  const wi = easeFns.io(w);
  const g = (f, d = 0) => (def[f] ? def[f](t) : d);
  const dy = g('dy'), ox = g('ox') * m, oz = g('oz');
  const yawAdd = g('yawAdd') * m * D2R;
  let yaw;
  if (def.yawAbs) {
    const target = (ctx.yawT ?? ctx.yaw) + def.yawAbs(t) * m * D2R;
    let dlt = target - ctx.yaw; dlt = Math.atan2(Math.sin(dlt), Math.cos(dlt));
    yaw = ctx.yaw + dlt * wi;
  } else yaw = ctx.yaw + yawAdd * wi;
  const lat = V(Math.cos(ctx.yaw), 0, -Math.sin(ctx.yaw));      // body-left in world (yaw frame)
  const fwd = V(Math.sin(ctx.yaw), 0, Math.cos(ctx.yaw));
  const tgtPelvis = V(ctx.x, ctx.H0 + dy + ctx.jy, ctx.z).addScaledVector(lat, ox).addScaledVector(fwd, oz);
  const pelvis = ctx.pelvisBase.clone().lerp(tgtPelvis, wi);
  const wrap = (a) => { a = ((a + 180) % 360 + 360) % 360 - 180; return a; };
  const P = { pelvis, yaw, pitch: wrap(g('pitch')) * wi, roll: wrap(g('roll') * m) * wi, groundY: ctx.ground };
  P.torso = { bend: g('bend') * wi, side: g('side') * m * wi, twist: g('twist') * m * wi };
  P.pelvisTilt = { bend: g('pBend') * wi, side: g('pSide') * m * wi, twist: g('pTwist') * m * wi };
  const F = actor.frames(P);
  const sideK = m > 0 ? 'R' : 'L', sideO = m > 0 ? 'L' : 'R';
  P.legs = { L: null, R: null }; P.arms = { L: null, R: null };
  for (const [key, side, kind] of [['legR', sideK, 'legs'], ['legL', sideO, 'legs'], ['armR', sideK, 'arms'], ['armL', sideO, 'arms']]) {
    const keys = def[key];
    if (!keys) continue;
    const r = sampleLimb(keys, t, ctx, actor, F, side);
    if (!r) continue;
    const lw = def[key + 'W'] ? def[key + 'W'](t) : 1;
    if (lw <= 0) continue;
    const T = { p: [r.p.x, r.p.y, r.p.z], f: 'w', w: wi * lw, pole: [r.pole.x, r.pole.y, r.pole.z], pf: 'w', contact: r.contact };
    if (r.n) T.aim = { n: [r.n.x, r.n.y, r.n.z], face: r.face || 'instep', fwd: r.fwd ? [r.fwd.x, r.fwd.y, r.fwd.z] : null, w: wi * lw };
    P[kind][side] = T;
  }
  if (ctx.look) P.look = { target: ctx.look, w: def.look ?? 1 };
  if (def.fix) {
    const f = def.fix;
    const bw = clamp(1 - Math.abs(t) / (f.span ?? 0.22), 0, 1);
    const bodyF = V(Math.sin(yaw), 0, Math.cos(yaw));
    let target;
    if (f.bone === 'knee') target = ctx.C.clone().addScaledVector(ctx.d, -(f.off ?? 0.14));
    else target = ctx.C.clone();
    P.fix = { bone: f.bone, side: f.bone === 'knee' ? sideK : sideK, target, w: easeFns.io(bw) * wi, up: f.up };
  }
  P.w = wi;
  return P;
}
