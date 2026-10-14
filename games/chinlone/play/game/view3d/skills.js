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
// Chinlone touches as pose-to-pose key data plus world-space contact solving. Authored for a RIGHT-side action;
// left-side actions are mirrored (x -> -x, lateral angles negated). Times are seconds relative to the contact (tc = 0).
// Frames: 'g' yaw-only frame on the ground under the pelvis, 'b' body frame at the pelvis, 'ball' the contact solution,
// 'wd' a follow-through point along the push direction.
// Channels: dy, ox/oz (pelvis offsets), pitch, roll, yawAdd / yawAbs (deg), bend, side, twist (torso), pBend, pSide, pTwist,
//           legR, legL, armR, armL (limb key lists; "R"/"L" are the AUTHORED sides, mirrored for left actions), W tracks.
// =====================================================================================================================
export const TECH = {};
const G_ = (t, x, z = 0, y = 0, e) => ({ t, f: 'g', p: [x, y, z], pole: [0, 0, 1], e });
const B = (t, x, y, z, pole = [0, 0, 1], e) => ({ t, f: 'b', p: [x, y, z], pole, e });
const AB = (t, x, y, z, e) => ({ t, f: 'b', p: [x, y, z], pole: [Math.sign(x) * 0.5, -1, -0.3], e });
const stance = (t0, t1, y0 = 0) => [G_(t0, 0.12, 0, y0), G_(t1, 0.12, 0, y0)];

// Balance arms: relaxed, slightly out, elbows bent. lift raises them a touch around the contact.
const armsBalance = (t0, t1, tc, lift = 0) => ({
  armR: [AB(t0, -0.34, -0.08, 0.10), AB(tc - 0.14, -0.58, 0.20 + lift, 0.0, 'io'), AB(tc + 0.16, -0.52, 0.10 + lift, 0.05), AB(t1, -0.34, -0.08, 0.10)],
  armL: [AB(t0, 0.34, -0.08, 0.10), AB(tc - 0.14, 0.52, 0.16 + lift, 0.16, 'io'), AB(tc + 0.16, 0.46, 0.06 + lift, 0.18), AB(t1, 0.34, -0.08, 0.10)],
});

// ---------- inside of the foot, low ball ----------------------------------------------------------------------------
TECH.foot = () => ({
  dur: [-0.6, 0.65],
  dy: track([[-0.6, 0], [-0.22, -0.08, 'io'], [0, -0.12, 'io'], [0.22, -0.07, 'io'], [0.65, 0, 'io']]),
  bend: track([[-0.6, 0], [-0.2, 12], [0, 15], [0.25, 6], [0.65, 0]]),
  side: track([[-0.6, 0], [0, 6], [0.65, 0]]),
  legL: [{ t: -0.6, f: 'lock' }, { t: 0.65, f: 'lock' }],
  legR: [
    G_(-0.6, -0.12),
    { t: -0.24, f: 'g', p: [-0.20, 0.16, -0.16], pole: [-0.2, 0, 1], e: 'io' },
    { t: 0, f: 'ball', face: 'inside', pole: [-0.2, 0, 1], e: 'in' },
    { t: 0.2, f: 'wd', p: [0.16, 0.0], pole: [-0.2, 0, 1], face: 'inside', e: 'out' },
    G_(0.65, -0.12, 0, 0, 'io'),
  ],
  ...armsBalance(-0.6, 0.65, 0, 0.0),
  look: 1,
});

// ---------- knee: the raised thigh meets the ball ---------------------------------------------------------------------
TECH.knee = () => ({
  dur: [-0.6, 0.65],
  dy: track([[-0.6, 0], [-0.2, -0.05], [0, -0.02], [0.3, -0.05], [0.65, 0]]),
  bend: track([[-0.6, 0], [-0.1, 6], [0, 8], [0.65, 0]]),
  side: track([[-0.6, 0], [-0.1, 6], [0.2, 5], [0.65, 0]]),
  legL: [{ t: -0.6, f: 'lock' }, { t: 0.65, f: 'lock' }],
  legR: [
    G_(-0.6, -0.12),
    { t: -0.2, f: 'b', p: [-0.14, -0.62, 0.20], pole: [-0.2, 0.2, 1], e: 'io' },
    { t: 0, f: 'ball', off: 0.075, kneeFoot: true, pole: [-0.2, 0.2, 1], e: 'in' },
    { t: 0.22, f: 'b', p: [-0.14, -0.55, 0.15], pole: [-0.2, 0.2, 1], e: 'out' },
    G_(0.65, -0.12, 0, 0, 'io'),
  ],
  ...armsBalance(-0.6, 0.65, 0, 0.0),
  fix: { bone: 'knee', off: 0.08 },
  look: 1,
});

// ---------- back-heel: spin to face away, flick the ball backwards over the lifted heel ------------------------------
TECH.heel = () => ({
  dur: [-0.78, 0.9], fadeIn: 0.26, fadeOut: 0.36,
  yawAbs: track([[-0.78, 0], [-0.55, 0], [-0.22, 180, 'io'], [0.38, 180], [0.82, 0, 'io']]),
  dy: track([[-0.78, 0], [-0.3, -0.05], [0, -0.04], [0.4, -0.04], [0.9, 0]]),
  bend: track([[-0.78, 0], [-0.2, 10], [0, 16], [0.3, 8], [0.9, 0]]),
  side: track([[-0.3, 0], [0, -4], [0.9, 0]]),
  legL: [{ t: -0.78, f: 'lock' }, { t: 0.9, f: 'lock' }],
  legR: [
    G_(-0.78, -0.12),
    G_(-0.32, -0.12, 0, 0),
    { t: -0.1, f: 'b', p: [-0.12, -0.62, -0.42], pole: [0, -0.4, 1], e: 'io' },
    { t: 0, f: 'ball', face: 'sole', pole: [0, -0.4, 1], e: 'in' },
    { t: 0.16, f: 'wd', p: [0.10, 0.04], pole: [0, -0.4, 1], face: 'sole', e: 'out' },
    B(0.4, -0.12, -0.7, -0.1, [0, 0, 1], 'io'),
    G_(0.9, -0.12, 0, 0, 'io'),
  ],
  armR: [AB(-0.78, -0.34, -0.08, 0.1), AB(-0.3, -0.58, 0.18, 0.0, 'io'), AB(0.1, -0.56, 0.1, -0.05), AB(0.9, -0.34, -0.08, 0.1)],
  armL: [AB(-0.78, 0.34, -0.08, 0.1), AB(-0.3, 0.62, 0.30, 0.1, 'io'), AB(0.1, 0.56, 0.20, 0.1), AB(0.9, 0.34, -0.08, 0.1)],
  look: 0.7,
});

// ---------- neck roll: bow forward, the ball settles on the nape and rolls off as the body rises ---------------------------
TECH.neck = () => ({
  dur: [-0.65, 0.85],
  dy: track([[-0.65, 0], [-0.25, -0.05], [0, -0.07], [0.35, -0.03], [0.85, 0]]),
  bend: track([[-0.65, 0], [-0.25, 10], [0, 26, 'io'], [0.22, 34, 'io'], [0.5, 8, 'io'], [0.85, 0]]),
  pBend: track([[-0.65, 0], [0, 6], [0.85, 0]]),
  legL: [G_(-0.65, 0.13), G_(0.85, 0.13)],
  legR: [G_(-0.65, -0.13), G_(0.85, -0.13)],
  armR: [AB(-0.65, -0.34, -0.08, 0.1), AB(-0.25, -0.70, 0.12, 0.0, 'io'), AB(0.3, -0.62, 0.2, 0.05), AB(0.85, -0.34, -0.08, 0.1)],
  armL: [AB(-0.65, 0.34, -0.08, 0.1), AB(-0.25, 0.70, 0.12, 0.0, 'io'), AB(0.3, 0.62, 0.2, 0.05), AB(0.85, 0.34, -0.08, 0.1)],
  fix: { bone: 'nape', off: 0, span: 0.3 },
  look: 0.4,
});

// ---------- shoulder roll: lean away, the ball rolls over the raised shoulder ----------------------------------------------
TECH.shoulder = () => ({
  dur: [-0.65, 0.85],
  dy: track([[-0.65, 0], [-0.25, -0.04], [0, -0.05], [0.35, -0.02], [0.85, 0]]),
  side: track([[-0.65, 0], [-0.2, 10], [0, 18, 'io'], [0.3, -4, 'io'], [0.85, 0]]),
  twist: track([[-0.65, 0], [0, -12], [0.3, 6], [0.85, 0]]),
  bend: track([[-0.65, 0], [0, 6], [0.85, 0]]),
  legL: [G_(-0.65, 0.13), G_(0.85, 0.13)],
  legR: [G_(-0.65, -0.13), G_(0.85, -0.13)],
  armR: [AB(-0.65, -0.34, -0.08, 0.1), AB(-0.2, -0.30, -0.30, -0.1, 'io'), AB(0.3, -0.34, -0.2, 0.0), AB(0.85, -0.34, -0.08, 0.1)],
  armL: [AB(-0.65, 0.34, -0.08, 0.1), AB(-0.2, 0.72, 0.28, 0.05, 'io'), AB(0.3, 0.60, 0.18, 0.05), AB(0.85, 0.34, -0.08, 0.1)],
  fix: { bone: 'shoulder', off: 0, span: 0.3 },
  look: 0.5,
});
void stance;

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
