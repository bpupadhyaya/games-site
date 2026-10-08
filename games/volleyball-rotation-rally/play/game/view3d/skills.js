// Volleyball skills as pose-to-pose key data plus world-space contact solving (adapted from the takraw pose layer).
// All authored numbers are for the unscaled rig and multiplied by the body scale ctx.K. Times are seconds relative to the sim's contact time (tc = 0).
// Frames: 'g' yaw-only frame on the ground under the pelvis, 'b' body frame at the pelvis, 'w' world, 'c' = the contact solution (hands / forearms).
import { THREE } from '../vendor3d/index.js';
import { easeFns, PALM_X, PALM_OFF, FORE_R } from './actor.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
import { BR } from '../src/consts.js';
export const BALL_R = BR;
const FORE_FRAC = 0.15;   // where along the forearm (from the wrist) the ball sits

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

// ---- limb key resolution -------------------------------------------------------------------------------------------------------
// limb key: { t, f: 'g'|'b'|'w'|'lock'|'c', p: [x,y,z], pole: [x,y,z], e, aim?: { n: [..], fx: [..] } (frame f), mode ('c' only) }
const sc = (v, K) => [v[0] * K, v[1] * K, v[2] * K];
function shoulderMid(actor) { return actor.b.L.up.getWorldPosition(V()).add(actor.b.R.up.getWorldPosition(V())).multiplyScalar(0.5); }

export function resolveKey(k, ctx, actor, F, side) {
  const K = ctx.K;
  if (k.f === 'lock') {
    const sx = side === 'L' ? 1 : -1;
    const p = actor.toWorld([sx * (k.x ?? 0.14) * K, actor.groundAnkle, (k.z ?? -0.02) * K], 'g', F);
    return { p, pole: V(0, 0, 1).applyQuaternion(F.yawQ), aim: null };
  }
  if (k.f === 'c') return resolveContact(k, ctx, actor, F, side);
  if (k.f === 'w') {
    return { p: V(k.p[0], k.p[1], k.p[2]), pole: k.pole ? actor.dirToWorld(k.pole, 'w', F) : V(0, 0, 1), aim: null };
  }
  const pv = sc(k.p, K); if (k.f === 'g') pv[1] += actor.groundAnkle;
  const p = actor.toWorld(pv, k.f, F);
  const pole = k.pole ? actor.dirToWorld(k.pole, k.pf || k.f, F) : V(0, 0, 1).applyQuaternion(F.yawQ);
  let aim = null;
  if (k.aim) aim = { n: actor.dirToWorld(k.aim.n, k.f === 'g' ? 'g' : 'b', F), fx: actor.dirToWorld(k.aim.fx, k.f === 'g' ? 'g' : 'b', F) };
  return { p, pole, aim };
}

// The contact solution: where the wrist must be (and how the hand is turned) so that the palm / forearm touches the ball at C.
function resolveContact(k, ctx, actor, F, side) {
  const K = ctx.K, S = side === 'L' ? 1 : -1;
  const n = ctx.n.clone();
  const P = ctx.C.clone().addScaledVector(n, -BALL_R).addScaledVector(ctx.d, k.along ?? 0).add(V(0, k.up ?? 0, 0));
  const sh = shoulderMid(actor);
  const a = P.clone().sub(sh).normalize();
  let lat = n.clone().cross(a); if (lat.lengthSq() < 1e-4) lat = V(0, 1, 0).cross(a); if (lat.lengthSq() < 1e-6) lat.set(1, 0, 0); lat.normalize();   // in the contact plane, so both hands / forearms lie on it
  let fx;
  let W;
  if (k.mode === 'fore2') {
    const lenF = actor.foreLen[side] ?? 0.27;
    const A = P.clone().addScaledVector(n, -FORE_R * K).addScaledVector(lat, S * 0.03 * K);
    W = A.addScaledVector(a, (k.frac ?? FORE_FRAC) * lenF);
    fx = a.clone();
    return { p: W, pole: k.pole ? actor.dirToWorld(k.pole, 'b', F) : V(S * 0.5, -1, -0.3), aim: { n: n.clone(), fx }, contact: true };
  }
  if (k.mode === 'palm2') {
    fx = k.fx ? V(k.fx[0], k.fx[1], k.fx[2]).applyQuaternion(F.bq) : a.clone();
    const Pi = P.clone().addScaledVector(lat, S * (k.gap ?? 0.035) * K);
    const Ci = Pi.clone().addScaledVector(n, BALL_R);
    W = actor.wristForPalm(Ci, n, fx.clone().sub(n.clone().multiplyScalar(fx.dot(n))).normalize(), BALL_R, K);
    return { p: W, pole: k.pole ? actor.dirToWorld(k.pole, 'b', F) : V(S * 0.6, -0.4, -0.2), aim: { n: n.clone(), fx }, contact: true };
  }
  // single palm
  fx = k.fx ? V(k.fx[0], k.fx[1], k.fx[2]).applyQuaternion(F.bq) : a.clone();
  fx = fx.sub(n.clone().multiplyScalar(fx.dot(n))); if (fx.lengthSq() < 1e-6) fx.set(0, 1, 0); fx.normalize();
  W = actor.wristForPalm(P.clone().addScaledVector(n, BALL_R), n, fx, BALL_R, K);
  return { p: W, pole: k.pole ? actor.dirToWorld(k.pole, 'b', F) : V(S * 0.5, -0.6, -0.4), aim: { n: n.clone(), fx }, contact: true };
}

export function sampleLimb(keys, t, ctx, actor, F, side) {
  if (!keys || !keys.length) return null;
  if (t <= keys[0].t) return resolveKey(keys[0], ctx, actor, F, side);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i];
      const u = (easeFns[b.e || 'io'] || easeFns.io)(clamp((t - a.t) / Math.max(1e-6, b.t - a.t), 0, 1));
      const ra = resolveKey(a, ctx, actor, F, side), rb = resolveKey(b, ctx, actor, F, side);
      const out = { p: ra.p.clone().lerp(rb.p, u), pole: ra.pole.clone().lerp(rb.pole, u).normalize(), aim: null, contact: false };
      if (ra.aim && rb.aim) out.aim = { n: ra.aim.n.clone().lerp(rb.aim.n, u).normalize(), fx: ra.aim.fx.clone().lerp(rb.aim.fx, u).normalize() };
      else if (rb.aim && u > 0.4) out.aim = { n: rb.aim.n.clone(), fx: rb.aim.fx.clone(), w: (u - 0.4) / 0.6 };
      else if (ra.aim && u < 0.6) out.aim = { n: ra.aim.n.clone(), fx: ra.aim.fx.clone(), w: 1 - u / 0.6 };
      out.contact = !!(rb.contact && u > 0.999);
      return out;
    }
  }
  return resolveKey(keys[keys.length - 1], ctx, actor, F, side);
}

// ===================================================================================================================================
// Technique definitions: each returns { channels } for a ctx; evalPose samples them. Channels: dy, ox, oz (pelvis offsets), pitch, roll,
// yawAdd (deg), bend, side, twist (torso), pBend, pSide, pTwist (pelvis), legL, legR, armL, armR (key lists), legLW, ... (limb weight tracks), w, fix.
// ===================================================================================================================================
export const TECH = {};
const G_ = (t, x, z = 0, y = 0, e, pole = [0, 0, 1]) => ({ t, f: 'g', p: [x, y, z], pole, e });
const B_ = (t, x, y, z, pole = [0, 0, 1], e) => ({ t, f: 'b', p: [x, y, z], pole, e });
const AB = (t, x, y, z, e, pole) => ({ t, f: 'b', p: [x, y, z], pole: pole || [Math.sign(x || 1) * 0.5, -1, -0.3], e });
const AP = (t, x, y, z, pole, e) => ({ t, f: 'b', p: [x, y, z], pole, e });

// ---------- forearm pass (platform), ball 0.4 .. 1.3 -------------------------------------------------------------------------------
TECH.bump = (ctx) => {
  const lg = ctx.lunge || 0;
  const VP = { W: 0.26, KO: 0.5, A: 1.2, B: 0.6, O: 0.06, BEND: 38 };   // stance width, knee-out, crouch offset / limit (world ball height), pelvis forward, torso lean
  const dyc = clamp(ctx.cy / ctx.K - VP.A, -VP.B, 0);       // the lower the ball, the deeper the knees bend
  return {
    dur: [-0.62, 0.72], fadeIn: 0.22, fadeOut: 0.3,
    dy: track([[-0.62, 0], [-0.30, dyc * 0.6], [-0.05, dyc], [0.22, dyc * 0.7], [0.72, 0]]),
    oz: track([[-0.62, 0], [-0.05, VP.O], [0.3, 0.05], [0.72, 0]]),
    bend: track([[-0.62, 0], [-0.25, 20], [0, VP.BEND + 8 * lg], [0.25, 14], [0.72, 0]]),
    legL: [G_(-0.62, 0.15, 0.0), G_(-0.3, VP.W, 0.10, 0, undefined, [VP.KO, 0, 1]), G_(0.3, VP.W, 0.10, 0, undefined, [VP.KO, 0, 1]), G_(0.72, 0.15)],
    legR: [G_(-0.62, -0.15, 0.0), G_(-0.3, -VP.W, -0.12, 0, undefined, [-VP.KO, 0, 1]), G_(0.3, -VP.W, -0.12, 0, undefined, [-VP.KO, 0, 1]), G_(0.72, -0.15)],
    armL: [AB(-0.62, 0.34, -0.1, 0.1), AP(-0.32, 0.10, -0.20, 0.30, [0.6, -1, -0.3]), { t: 0, f: 'c', mode: 'fore2', pole: [0.6, -1, -0.2], e: 'io' }, { t: 0.14, f: 'c', mode: 'fore2', along: 0.10, up: 0.06, pole: [0.6, -1, -0.2], e: 'out' }, AP(0.40, 0.42, -0.05, 0.28, [0.8, -1, -0.2], 'io'), AB(0.72, 0.34, -0.1, 0.1)],
    armR: [AB(-0.62, -0.34, -0.1, 0.1), AP(-0.32, -0.10, -0.20, 0.30, [-0.6, -1, -0.3]), { t: 0, f: 'c', mode: 'fore2', pole: [-0.6, -1, -0.2], e: 'io' }, { t: 0.14, f: 'c', mode: 'fore2', along: 0.10, up: 0.06, pole: [-0.6, -1, -0.2], e: 'out' }, AP(0.40, -0.42, -0.05, 0.28, [-0.8, -1, -0.2], 'io'), AB(0.72, -0.34, -0.1, 0.1)],
    look: 1,
    fix: { bone: 'fores', frac: FORE_FRAC, span: 0.22, spanAfter: 0.4 },
  };
};
// ---------- low dig: a deep step and a long reach, ball 0.12 .. 0.46 ----------------------------------------------------------------
TECH.dig = (ctx) => ({
  dur: [-0.62, 0.8], fadeIn: 0.22, fadeOut: 0.3,
  dy: track([[-0.62, 0], [-0.25, -0.22], [-0.02, clamp(ctx.cy - 1.30 * ctx.K / 1.25, -0.9, -0.2)], [0.3, -0.34], [0.8, 0]]),
  oz: track([[-0.62, 0], [-0.1, 0.20], [0.3, 0.26], [0.8, 0]]),
  bend: track([[-0.62, 0], [-0.2, 30], [0, 40], [0.3, 28], [0.8, 0]]),
  side: track([[-0.62, 0], [0, 6], [0.8, 0]]),
  legL: [G_(-0.62, 0.15, 0.0), G_(-0.2, 0.18, 0.42), G_(0.3, 0.18, 0.46), G_(0.8, 0.15)],
  legR: [G_(-0.62, -0.15, 0.0), G_(-0.2, -0.22, -0.32), G_(0.3, -0.22, -0.32), G_(0.8, -0.15)],
  armL: [AB(-0.62, 0.34, -0.1, 0.1), AP(-0.3, 0.10, -0.35, 0.40, [0.6, -1, -0.3]), { t: 0, f: 'c', mode: 'fore2', pole: [0.6, -1, -0.2], e: 'io' }, { t: 0.2, f: 'c', mode: 'fore2', along: 0.10, up: 0.08, pole: [0.6, -1, -0.2], e: 'out' }, AB(0.8, 0.34, -0.1, 0.1)],
  armR: [AB(-0.62, -0.34, -0.1, 0.1), AP(-0.3, -0.10, -0.35, 0.40, [-0.6, -1, -0.3]), { t: 0, f: 'c', mode: 'fore2', pole: [-0.6, -1, -0.2], e: 'io' }, { t: 0.2, f: 'c', mode: 'fore2', along: 0.10, up: 0.08, pole: [-0.6, -1, -0.2], e: 'out' }, AB(0.8, -0.34, -0.1, 0.1)],
  look: 1,
  fix: { bone: 'fores', frac: FORE_FRAC, span: 0.22 },
});
// ---------- dive: a low forward dig for a ball out of lunge reach. The body goes forward and down, one knee near the floor, forearms out, then rolls up. ----
TECH.dive = (ctx) => {
  const ov = clamp(ctx.over || 0.4, 0.05, 1.6);
  return {
    dur: [-0.7, 1.25], fadeIn: 0.25, fadeOut: 0.4,
    dy: track([[-0.7, 0], [-0.3, -0.25], [-0.04, -0.52, 'in'], [0.25, -0.60], [0.55, -0.56], [0.9, -0.25, 'io'], [1.25, 0]]),
    oz: track([[-0.7, 0], [-0.3, 0.45 * ov], [-0.03, 0.97 * ov, 'in'], [0.3, ov], [0.9, 0.25 * ov], [1.25, 0]]),
    bend: track([[-0.7, 0], [-0.25, 35], [0, 62], [0.35, 66], [0.9, 30], [1.25, 0]]),
    legL: [G_(-0.7, 0.15, 0.0), G_(-0.2, 0.20, 0.40), G_(0.3, 0.18, 0.2, 0, 'out'), G_(0.9, 0.16, 0.05), G_(1.25, 0.15)],
    legR: [G_(-0.7, -0.15, 0.0), G_(-0.2, -0.22, -0.40), G_(0.3, -0.20, -0.5, 0.04), G_(0.9, -0.18, -0.1), G_(1.25, -0.15)],
    armL: [AB(-0.7, 0.34, -0.1, 0.1), AP(-0.3, 0.10, -0.40, 0.45, [0.6, -1, -0.3]), { t: 0, f: 'c', mode: 'fore2', pole: [0.6, -1, -0.2], e: 'io' }, { t: 0.25, f: 'c', mode: 'fore2', along: 0.2, up: 0.0, pole: [0.6, -1, -0.2], e: 'out' }, AB(1.25, 0.34, -0.1, 0.1)],
    armR: [AB(-0.7, -0.34, -0.1, 0.1), AP(-0.3, -0.10, -0.40, 0.45, [-0.6, -1, -0.3]), { t: 0, f: 'c', mode: 'fore2', pole: [-0.6, -1, -0.2], e: 'io' }, { t: 0.25, f: 'c', mode: 'fore2', along: 0.2, up: 0.0, pole: [-0.6, -1, -0.2], e: 'out' }, AB(1.25, -0.34, -0.1, 0.1)],
    look: 1,
    fix: { bone: 'fores', frac: FORE_FRAC, span: 0.2 },
  };
};
// ---------- overhand set, ball 1.95 .. 2.65 ----------------------------------------------------------------------------------------
TECH.over = (ctx) => {
  const back = ctx.back ? 1 : 0;
  return {
    dur: [-0.55, 0.62], fadeIn: 0.2, fadeOut: 0.28,
    dy: track([[-0.55, 0], [-0.22, -0.08], [0, -0.01], [0.2, -0.04], [0.62, 0]]),
    bend: track([[-0.55, 0], [-0.2, 4], [0, back ? -22 : -6], [0.2, back ? -8 : 2], [0.62, 0]]),
    legL: [G_(-0.55, 0.15, 0.04), G_(0.62, 0.15, 0.04)],
    legR: [G_(-0.55, -0.15, -0.06), G_(0.62, -0.15, -0.06)],
    armL: [AB(-0.55, 0.34, -0.1, 0.1), AP(-0.3, 0.16, 0.36, 0.30, [0.7, -1, -0.2]), AP(-0.12, 0.15, 0.80, 0.34, [0.7, -0.6, -0.1]), { t: 0, f: 'c', mode: 'palm2', pole: [0.7, -0.4, -0.1], e: 'io' }, { t: 0.16, f: 'c', mode: 'palm2', along: 0.12, pole: [0.7, -0.4, -0.1], e: 'out' }, AP(0.34, 0.16, 0.5, 0.2, [0.7, -1, -0.2]), AB(0.62, 0.34, -0.1, 0.1)],
    armR: [AB(-0.55, -0.34, -0.1, 0.1), AP(-0.3, -0.16, 0.36, 0.30, [-0.7, -1, -0.2]), AP(-0.12, -0.15, 0.80, 0.34, [-0.7, -0.6, -0.1]), { t: 0, f: 'c', mode: 'palm2', pole: [-0.7, -0.4, -0.1], e: 'io' }, { t: 0.16, f: 'c', mode: 'palm2', along: 0.12, pole: [-0.7, -0.4, -0.1], e: 'out' }, AP(0.34, -0.16, 0.5, 0.2, [-0.7, -1, -0.2]), AB(0.62, -0.34, -0.1, 0.1)],
    look: 1,
    fix: { bone: 'palms', span: 0.2 },
  };
};

// ---------- spike family (jump, cocked right arm, palm strike). ctx.ts / ctx.tl: take-off and landing relative to the contact. -----
const spikeBody = (ctx, soft) => {
  const ts = ctx.ts ?? -0.36, tl = ctx.tl ?? 0.38;
  return {
    dy: track([[ts - 0.35, 0], [ts - 0.12, -0.12, 'io'], [ts, -0.02, 'out'], [tl, 0, 'in'], [tl + 0.12, -0.12, 'io'], [tl + 0.4, 0, 'io']]),
    bend: track([[ts - 0.4, 0], [ts - 0.1, 8], [-0.22, -10, 'io'], [-0.05, -2], [0.0, 2], [0.1, soft ? 14 : 24, 'in'], [tl, 12], [tl + 0.2, 10], [tl + 0.5, 0]]),
    twist: track([[ts - 0.2, 0], [-0.18, soft ? -18 : -30, 'io'], [-0.02, -6], [0.08, soft ? 10 : 18, 'in'], [tl, 6], [tl + 0.4, 0]]),
    side: track([[-0.24, 0], [-0.04, soft ? 6 : 10, 'io'], [0.2, 4], [tl + 0.4, 0]]),
  };
};
TECH.spike = (ctx) => {
  const ts = ctx.ts ?? -0.36, tl = ctx.tl ?? 0.38, soft = ctx.shot === 'roll';
  return {
    dur: [ts - 0.72, tl + 0.5], fadeIn: 0.2, fadeOut: 0.3,
    ...spikeBody(ctx, soft),
    legL: [G_(ts - 0.7, 0.15, 0.0), G_(ts - 0.6, 0.15, 0.0), G_(ts - 0.5, 0.15, -0.05, 0.0), G_(ts - 0.4, 0.16, 0.36, 0.16, 'out'), G_(ts - 0.28, 0.16, 0.42, 0.0, 'in'), G_(ts - 0.16, 0.17, 0.14), G_(ts - 0.02, 0.14, 0.0, 0, 'out'), B_(-0.2, 0.12, -0.80, -0.14), B_(0.0, 0.12, -0.82, -0.32), B_(tl - 0.1, 0.12, -0.80, -0.16), G_(tl, 0.14, 0.04, 0, 'in'), G_(tl + 0.5, 0.15)],
    legR: [G_(ts - 0.7, -0.15, 0.0), G_(ts - 0.6, -0.15, 0.30, 0.14, 'out'), G_(ts - 0.5, -0.15, 0.36, 0.0, 'in'), G_(ts - 0.4, -0.16, 0.0, 0.0), G_(ts - 0.28, -0.16, -0.05), G_(ts - 0.16, -0.17, -0.12), G_(ts - 0.02, -0.14, 0.0, 0, 'out'), B_(-0.2, -0.12, -0.80, -0.20), B_(0.0, -0.12, -0.84, -0.40), B_(tl - 0.1, -0.12, -0.80, -0.16), G_(tl, -0.14, 0.04, 0, 'in'), G_(tl + 0.5, -0.15)],
    legLW: track([[ts - 0.72, 0], [ts - 0.62, 1]]), legRW: track([[ts - 0.72, 0], [ts - 0.62, 1]]),
    oz: track([[ts - 0.7, 0], [ts - 0.16, 0.2], [0.2, 0.22], [tl + 0.3, 0]]),
    armR: [AB(ts - 0.5, -0.34, -0.15, -0.1), AP(ts - 0.14, -0.36, -0.28, -0.34, [-0.5, -1, -0.3], 'io'), AP(ts + 0.04, -0.28, 0.45, 0.02, [-0.8, 0.3, -0.5], 'out'), AP(-0.17, -0.20, 0.66, -0.32, [-0.9, 0.6, -0.4], 'io'), AP(-0.07, -0.20, 0.86, -0.04, [-0.9, 0.4, -0.4], 'in'), { t: 0, f: 'c', mode: 'palm', pole: [-0.9, 0.2, -0.3], e: 'in' }, { t: 0.14, f: 'c', mode: 'palm', along: soft ? 0.18 : 0.26, up: -0.30, pole: [-0.8, -0.2, -0.3], e: 'out' }, AP(0.3, -0.18, 0.10, 0.28, [-0.6, -1, -0.2], 'io'), AB(tl + 0.5, -0.34, -0.12, 0.05)],
    armL: [AB(ts - 0.5, 0.34, -0.15, -0.1), AP(ts - 0.14, 0.34, -0.28, -0.34, [0.5, -1, -0.3], 'io'), AP(-0.22, 0.30, 0.78, 0.30, [0.5, -0.4, -0.2], 'out'), AP(-0.02, 0.26, 0.84, 0.30, [0.5, -0.2, -0.2]), AP(0.16, 0.22, 0.30, 0.22, [0.5, -1, -0.2], 'io'), AB(tl + 0.5, 0.34, -0.12, 0.05)],
    look: 1,
    fix: { bone: 'palm', side: 'R', span: 0.14 },
  };
};
TECH.tip = (ctx) => {
  const ts = ctx.ts ?? -0.3, tl = ctx.tl ?? 0.3;
  return {
    dur: [ts - 0.45, tl + 0.5], fadeIn: 0.2, fadeOut: 0.3,
    dy: track([[ts - 0.3, 0], [ts - 0.1, -0.10, 'io'], [ts, -0.02, 'out'], [tl, 0, 'in'], [tl + 0.1, -0.1, 'io'], [tl + 0.35, 0, 'io']]),
    bend: track([[ts - 0.3, 0], [-0.1, -6], [0, 8, 'in'], [tl, 8], [tl + 0.4, 0]]),
    legL: [G_(ts - 0.45, 0.15, 0.0), G_(ts - 0.02, 0.14, 0.0, 0, 'out'), B_(-0.1, 0.12, -0.84, -0.1), B_(tl - 0.06, 0.12, -0.84, -0.1), G_(tl, 0.14, 0.04, 0, 'in'), G_(tl + 0.5, 0.15)],
    legR: [G_(ts - 0.45, -0.15, 0.0), G_(ts - 0.02, -0.14, 0.0, 0, 'out'), B_(-0.1, -0.12, -0.84, -0.14), B_(tl - 0.06, -0.12, -0.84, -0.14), G_(tl, -0.14, 0.04, 0, 'in'), G_(tl + 0.5, -0.15)],
    legLW: track([[ts - 0.45, 0], [ts - 0.28, 1]]), legRW: track([[ts - 0.45, 0], [ts - 0.28, 1]]),
    armR: [AB(ts - 0.45, -0.34, -0.15, -0.1), AP(ts, -0.3, 0.5, 0.15, [-0.7, 0.2, -0.4], 'out'), AP(-0.1, -0.2, 0.8, 0.25, [-0.7, 0.2, -0.3], 'io'), { t: 0, f: 'c', mode: 'palm', pole: [-0.7, 0.0, -0.3], e: 'in' }, { t: 0.14, f: 'c', mode: 'palm', along: 0.08, up: -0.05, pole: [-0.7, 0.0, -0.3], e: 'out' }, AB(tl + 0.5, -0.34, -0.12, 0.05)],
    armL: [AB(ts - 0.45, 0.34, -0.15, -0.1), AP(ts, 0.3, 0.5, 0.15, [0.5, -0.5, -0.2], 'out'), AP(-0.05, 0.3, 0.6, 0.28, [0.5, -0.5, -0.2]), AB(tl + 0.5, 0.34, -0.12, 0.05)],
    look: 1,
    fix: { bone: 'palm', side: 'R', span: 0.12 },
  };
};
// ---------- block: both arms straight up over the net ------------------------------------------------------------------------------
TECH.block = (ctx) => {
  const ts = ctx.ts ?? -0.33, tl = ctx.tl ?? 0.37;
  return {
    dur: [ts - 0.4, tl + 0.5], fadeIn: 0.18, fadeOut: 0.3,
    dy: track([[ts - 0.4, 0], [ts - 0.1, -0.14, 'io'], [ts, -0.02, 'out'], [tl, 0, 'in'], [tl + 0.1, -0.14, 'io'], [tl + 0.4, 0, 'io']]),
    bend: track([[ts - 0.4, 0], [ts - 0.1, 8], [0, -2], [tl, 4], [tl + 0.4, 0]]),
    legL: [G_(ts - 0.4, 0.15, 0.0), G_(ts - 0.02, 0.15, 0.0, 0, 'out'), B_(0, 0.13, -0.90, -0.04), B_(tl - 0.05, 0.13, -0.90, -0.04), G_(tl, 0.15, 0.0, 0, 'in'), G_(tl + 0.5, 0.15)],
    legR: [G_(ts - 0.4, -0.15, 0.0), G_(ts - 0.02, -0.15, 0.0, 0, 'out'), B_(0, -0.13, -0.90, -0.04), B_(tl - 0.05, -0.13, -0.90, -0.04), G_(tl, -0.15, 0.0, 0, 'in'), G_(tl + 0.5, -0.15)],
    legLW: track([[ts - 0.4, 0], [ts - 0.2, 1]]), legRW: track([[ts - 0.4, 0], [ts - 0.2, 1]]),
    armL: [AB(ts - 0.4, 0.34, -0.1, 0.1), AP(ts - 0.1, 0.24, 0.45, 0.28, [0.7, -0.8, -0.2], 'io'), AP(ts + 0.1, 0.20, 0.95, 0.12, [0.7, -0.4, -0.2], 'out'), { t: -0.0, f: 'c', mode: 'palm2', pole: [0.7, -0.3, -0.2], e: 'io' }, { t: 0.18, f: 'c', mode: 'palm2', along: 0.1, pole: [0.7, -0.3, -0.2], e: 'out' }, AP(tl, 0.22, 0.9, 0.1, [0.7, -0.4, -0.2], 'io'), AB(tl + 0.5, 0.34, -0.1, 0.1)],
    armR: [AB(ts - 0.4, -0.34, -0.1, 0.1), AP(ts - 0.1, -0.24, 0.45, 0.28, [-0.7, -0.8, -0.2], 'io'), AP(ts + 0.1, -0.20, 0.95, 0.12, [-0.7, -0.4, -0.2], 'out'), { t: -0.0, f: 'c', mode: 'palm2', pole: [-0.7, -0.3, -0.2], e: 'io' }, { t: 0.18, f: 'c', mode: 'palm2', along: 0.1, pole: [-0.7, -0.3, -0.2], e: 'out' }, AP(tl, -0.22, 0.9, 0.1, [-0.7, -0.4, -0.2], 'io'), AB(tl + 0.5, -0.34, -0.1, 0.1)],
    look: 1,
    fix: { bone: 'palms', span: 0.16 },
  };
};
// ---------- serve: left hand tosses (released at ctx.tr), right palm strikes. Float: standing. Jump: take-off + spike swing. --------------
const tossArm = (ctx, jump) => {
  const tr = ctx.tr ?? -0.95, T = ctx.toss;
  return [AB(tr - 0.35, 0.30, -0.12, 0.12), AP(tr - 0.12, 0.14, 0.12, 0.34, [0.6, -1, -0.2], 'io'), T ? { t: tr, f: 'w', p: [T.x, T.y, T.z], pole: [0.6, -0.5, -0.2], e: 'out' } : AP(tr, 0.14, 0.7, 0.34, [0.6, -0.6, -0.2], 'out'), T ? { t: tr + 0.12, f: 'w', p: [T.x, T.y + 0.14, T.z], pole: [0.6, -0.5, -0.2], e: 'out' } : AP(tr + 0.12, 0.14, 0.82, 0.36, [0.6, -0.6, -0.2], 'out'), AP(Math.max(tr + 0.4, -0.3), 0.22, 0.6, 0.30, [0.5, -0.8, -0.2], 'io'), AP(jump ? 0.2 : 0.18, 0.24, 0.1, 0.22, [0.5, -1, -0.2], 'io'), AB(jump ? 0.7 : 0.7, 0.34, -0.12, 0.05)];
};
TECH.serveF = (ctx) => {
  const tr = ctx.tr ?? -0.95;
  return {
    dur: [tr - 0.4, 0.78], fadeIn: 0.25, fadeOut: 0.3,
    dy: track([[tr - 0.4, 0], [tr + 0.1, -0.03], [-0.25, -0.08, 'io'], [0, -0.02, 'out'], [0.25, -0.04], [0.78, 0]]),
    oz: track([[tr - 0.4, 0], [-0.2, 0.0], [0, 0.1], [0.3, 0.12], [0.78, 0]]),
    bend: track([[tr - 0.4, 0], [-0.4, -4], [-0.15, -14, 'io'], [0, 6, 'in'], [0.3, 10], [0.78, 0]]),
    twist: track([[-0.5, 0], [-0.15, -24, 'io'], [0, 10, 'in'], [0.3, 4], [0.78, 0]]),
    side: track([[-0.3, 0], [-0.1, -6], [0.1, 3], [0.78, 0]]),
    legL: [G_(tr - 0.4, 0.15, 0.0), G_(-0.3, 0.15, 0.22), G_(0.4, 0.15, 0.22), G_(0.78, 0.15)],
    legR: [G_(tr - 0.4, -0.15, 0.0), G_(-0.3, -0.16, -0.18), G_(0.4, -0.16, -0.18), G_(0.78, -0.15)],
    armL: tossArm(ctx, false),
    armR: [AB(tr - 0.4, -0.30, -0.12, 0.1), AP(-0.55, -0.30, 0.45, -0.1, [-0.7, 0.2, -0.4], 'io'), AP(-0.22, -0.22, 0.62, -0.30, [-0.9, 0.5, -0.4], 'io'), AP(-0.08, -0.20, 0.86, -0.04, [-0.9, 0.4, -0.4], 'in'), { t: 0, f: 'c', mode: 'palm', pole: [-0.9, 0.2, -0.3], e: 'in' }, { t: 0.1, f: 'c', mode: 'palm', along: 0.08, pole: [-0.8, 0.0, -0.3], e: 'out' }, AP(0.34, -0.2, 0.2, 0.3, [-0.6, -1, -0.2], 'io'), AB(0.78, -0.34, -0.12, 0.05)],
    look: 1,
    fix: { bone: 'palm', side: 'R', span: 0.14 },
  };
};
TECH.serveJ = (ctx) => {
  const tr = ctx.tr ?? -1.15, ts = ctx.ts ?? -0.34, tl = ctx.tl ?? 0.38;
  return {
    dur: [Math.min(tr - 0.4, ts - 0.5), tl + 0.5], fadeIn: 0.25, fadeOut: 0.3,
    ...spikeBody({ ts, tl }, false),
    oz: track([[ts - 0.1, 0], [ts + 0.05, 0.08], [-0.1, 0.42], [0.0, 0.5], [0.2, 0.5], [tl, 0.3], [tl + 0.3, 0]]),
    legL: [G_(ts - 0.5, 0.15, 0.0), G_(ts - 0.16, 0.17, 0.14), G_(ts - 0.02, 0.14, 0.0, 0, 'out'), B_(-0.2, 0.12, -0.80, -0.14), B_(0.0, 0.12, -0.82, -0.32), B_(tl - 0.1, 0.12, -0.80, -0.16), G_(tl, 0.14, 0.04, 0, 'in'), G_(tl + 0.5, 0.15)],
    legR: [G_(ts - 0.5, -0.15, 0.0), G_(ts - 0.16, -0.17, -0.12), G_(ts - 0.02, -0.14, 0.0, 0, 'out'), B_(-0.2, -0.12, -0.80, -0.20), B_(0.0, -0.12, -0.84, -0.40), B_(tl - 0.1, -0.12, -0.80, -0.16), G_(tl, -0.14, 0.04, 0, 'in'), G_(tl + 0.5, -0.15)],
    legLW: track([[ts - 0.5, 0], [ts - 0.3, 1]]), legRW: track([[ts - 0.5, 0], [ts - 0.3, 1]]),
    armL: tossArm(ctx, true),
    armR: [AB(tr - 0.4, -0.30, -0.12, 0.1), AP(ts - 0.14, -0.36, -0.28, -0.34, [-0.5, -1, -0.3], 'io'), AP(ts + 0.04, -0.28, 0.45, 0.02, [-0.8, 0.3, -0.5], 'out'), AP(-0.17, -0.20, 0.66, -0.32, [-0.9, 0.6, -0.4], 'io'), AP(-0.07, -0.20, 0.86, -0.04, [-0.9, 0.4, -0.4], 'in'), { t: 0, f: 'c', mode: 'palm', pole: [-0.9, 0.2, -0.3], e: 'in' }, { t: 0.14, f: 'c', mode: 'palm', along: 0.26, up: -0.30, pole: [-0.8, -0.2, -0.3], e: 'out' }, AP(0.3, -0.18, 0.10, 0.28, [-0.6, -1, -0.2], 'io'), AB(tl + 0.5, -0.34, -0.12, 0.05)],
    look: 1,
    fix: { bone: 'palm', side: 'R', span: 0.14 },
  };
};

// ---------------------------------------------------------------------------------------------------------------------
// Evaluate a technique at time t (seconds relative to tc). Returns a pose for Actor.apply or null outside the window.
// ctx: { m, K, x, z, yaw, jy, pelvisBase, H0, C, n, d, lock, ground, look, ts, tl, tr, toss, shot, back, lunge }
// ---------------------------------------------------------------------------------------------------------------------
const D2R = Math.PI / 180;
export function evalPose(def, ctx, t, actor) {
  const K = ctx.K;
  const [a, b] = def.dur;
  if (t < a || t > b) return null;
  const w = clamp(Math.min((t - a) / (def.fadeIn ?? 0.18), (b - t) / (def.fadeOut ?? 0.22)), 0, 1);
  const wi = easeFns.io(w);
  const g = (f, d = 0) => (def[f] ? def[f](t) : d);
  const dy = g('dy') * K, ox = g('ox') * K, oz = g('oz') * K;
  const yaw = ctx.yaw + g('yawAdd') * D2R * wi;
  const lat = V(Math.cos(ctx.yaw), 0, -Math.sin(ctx.yaw));
  const fwd = V(Math.sin(ctx.yaw), 0, Math.cos(ctx.yaw));
  const tgtPelvis = V(ctx.x, ctx.H0 + dy + ctx.jy, ctx.z).addScaledVector(lat, ox).addScaledVector(fwd, oz);
  const pelvis = ctx.pelvisBase.clone().lerp(tgtPelvis, wi);
  const wrap = (v) => ((v + 180) % 360 + 360) % 360 - 180;
  const P = { pelvis, yaw, pitch: wrap(g('pitch')) * wi, roll: wrap(g('roll')) * wi, groundY: ctx.ground };
  P.torso = { bend: g('bend') * wi, side: g('side') * wi, twist: g('twist') * wi };
  P.pelvisTilt = { bend: g('pBend') * wi, side: g('pSide') * wi, twist: g('pTwist') * wi };
  const F = actor.frames(P);
  P.legs = { L: null, R: null }; P.arms = { L: null, R: null };
  for (const [key, side, kind] of [['legR', 'R', 'legs'], ['legL', 'L', 'legs'], ['armR', 'R', 'arms'], ['armL', 'L', 'arms']]) {
    const keys = def[key];
    if (!keys) continue;
    const r = sampleLimb(keys, t, ctx, actor, F, side);
    if (!r) continue;
    const lw = def[key + 'W'] ? def[key + 'W'](t) : 1;
    if (lw <= 0) continue;
    const T = { p: [r.p.x, r.p.y, r.p.z], f: 'w', w: wi * lw, pole: [r.pole.x, r.pole.y, r.pole.z], pf: 'w', contact: r.contact };
    if (r.aim && kind === 'arms') T.handAim = { n: [r.aim.n.x, r.aim.n.y, r.aim.n.z], fx: [r.aim.fx.x, r.aim.fx.y, r.aim.fx.z], f: 'w', w: wi * lw * (r.aim.w ?? 1) };
    P[kind][side] = T;
  }
  if (ctx.look) P.look = { target: ctx.look, w: def.look ?? 1 };
  if (def.fix) {
    const f = def.fix;
    const bw = clamp(1 - (t < 0 ? -t / (f.span ?? 0.22) : t / (f.spanAfter ?? f.span ?? 0.22)), 0, 1);
    const target = ctx.C.clone().addScaledVector(ctx.n, -BALL_R);
    P.fix = { bone: f.bone, side: f.side, frac: f.frac, n: ctx.n, scale: K, target, w: easeFns.io(bw) * wi, up: f.up };
  }
  P.w = wi;
  return P;
}
export { PALM_X, PALM_OFF, FORE_R };
