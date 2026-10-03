// Pelota strokes: forehand, backhand, low scoop and high punch, for a bare hand or a paddle. Authored as pose tracks plus world-space IK for the
// striking arm: at the contact time (tc) the palm (or the paddle face) is exactly where the sim says the ball is, facing the way the ball
// leaves. Pelvis, torso, planted feet and the balance arm are keyed relative to the contact so weight transfer reads naturally.
import { THREE } from '../vendor3d/index.js';
import { easeFns } from './actor.js';
import { BR } from '../src/consts.js';
import { PADDLE } from './court.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
const D2R = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1], [t1, v1, e] = keys[i];
        const u = (easeFns[e || 'io'] || easeFns.io)(clamp((t - t0) / Math.max(1e-6, t1 - t0), 0, 1));
        return lerp(v0, v1, u);
      }
    }
    return keys[keys.length - 1][1];
  };
}
// a vector track: keys [t, Vector3, ease]
function vtrack(keys) {
  return (t, out = V()) => {
    if (t <= keys[0][0]) return out.copy(keys[0][1]);
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1], [t1, v1, e] = keys[i];
        const u = (easeFns[e || 'io'] || easeFns.io)(clamp((t - t0) / Math.max(1e-6, t1 - t0), 0, 1));
        return out.copy(v0).lerp(v1, u);
      }
    }
    return out.copy(keys[keys.length - 1][1]);
  };
}

export const SWING_SPAN = [-0.34, 0.5];

/**
 * Build the definition of a stroke. sw = the sim's swing record; m = +1 right-handed, -1 left-handed.
 * Returns an object of tracks that evalSwing samples at t (seconds relative to the contact).
 */
export function strokeDef(sw, m, equip) {
  const C = V(sw.cp.x, sw.cp.y, sw.cp.z);
  const dd = sw.d ? V(sw.d.x, sw.d.y, sw.d.z) : V(0.0, 0.12, 1);
  dd.normalize();
  const dh = V(dd.x, 0, dd.z); if (dh.lengthSq() < 1e-6) dh.set(0, 0, 1); dh.normalize();
  const upv = V(0, 1, 0);
  const left = V(dh.z, 0, -dh.x).negate();                  // perpendicular to the shot direction, pointing to the avatar's right when it faces dh... (see below)
  // body-left for an avatar facing along dh: yaw frame gives left = (cos yaw, 0, -sin yaw) with yaw = atan2(dh.x, dh.z)
  const yawD = Math.atan2(dh.x, dh.z);
  const leftB = V(Math.cos(yawD), 0, -Math.sin(yawD));
  void left;
  const tech = sw.kind === 'lob' && sw.tech !== 'high' ? 'low' : sw.tech, fast = sw.kind === 'drive' || sw.kind === 'power';
  const back = !!sw.back;
  // ---- the hand path (world): wind-up, contact, follow-through
  const wind = C.clone().addScaledVector(dh, -(fast ? 0.4 : 0.3)).addScaledVector(leftB, (back ? 1 : -1) * m * 0.14);
  const fol = C.clone().addScaledVector(dd, fast ? 0.42 : 0.3).addScaledVector(leftB, (back ? -1 : 1) * m * 0.02);
  const mid1 = C.clone().addScaledVector(dh, -0.2).addScaledVector(leftB, (back ? 1 : -1) * m * 0.06);
  if (tech === 'low') { wind.y = Math.max(0.12, C.y - 0.1); wind.addScaledVector(dh, -0.04); fol.y = C.y + 0.38; mid1.y = C.y - 0.1; }
  else if (tech === 'high') { wind.y = C.y + 0.32; fol.y = C.y - 0.22; fol.addScaledVector(dh, 0.05); mid1.y = C.y + 0.12; }
  else { wind.y = C.y + 0.06; fol.y = C.y + 0.16; mid1.y = C.y + 0.02; }
  const tw = fast ? 0.14 : 0.19;                              // wind-up peak time before contact (a drop shot is slower and smoother)
  const fin = fol.clone().addScaledVector(leftB, (back ? -1 : 1) * m * 0.14); fin.y = fol.y - 0.08;
  if (tech === 'high') { fol.y = C.y - 0.3; fol.addScaledVector(dh, -0.1); fin.y = C.y - 0.7; fin.copy(fin.clone().lerp(C, 0.0)).addScaledVector(dh, -0.15); }
  const rest = C.clone().addScaledVector(dh, 0.12).addScaledVector(leftB, (back ? -1 : 1) * m * 0.1); rest.y = tech === 'high' ? Math.max(0.8, C.y - 0.85) : Math.max(0.65, C.y - 0.45);   // the arm comes back down beside the hip
  const handPath = vtrack([[-0.34, wind.clone().add(V(0, -0.05, 0)), 'io'], [-tw, wind, 'io'], [-tw * 0.45, mid1, 'in'], [0, C, 'lin'], [tech === 'high' ? 0.09 : fast ? 0.13 : 0.2, fol, 'out'], [tech === 'high' ? 0.2 : fast ? 0.26 : 0.3, fin, 'io'], [tech === 'high' ? 0.4 : 0.5, rest, 'io']]);
  // ---- hand orientation: the palm faces the way the ball leaves; fingers up (ground strokes) or forward (scoop)
  const n = dd.clone();
  const fdTrack = (t, out) => {
    // fingers point up and slightly forward at contact; during the swing they trail
    const fd = tech === 'low' ? dh.clone().multiplyScalar(0.8).add(V(0, 0.45, 0)) : tech === 'high' ? V(0, 0.9, 0).addScaledVector(dh, -0.35) : V(0, 0.85, 0).addScaledVector(dh, 0.25);
    return out.copy(fd);
  };
  // ---- body tracks (mirrored for lefties through m)
  const shoulderDrop = clamp(1.42 - (C.y + 0.45), 0, 0.95);      // how far the shoulder must come down to reach a low ball
  const dyU = Math.min(0.36, shoulderDrop * 0.75);                  // knees bend for most of it ...
  const bendLow = Math.min(32, Math.acos(clamp(1 - (shoulderDrop - dyU) / 0.55, 0.3, 1)) / D2R);
  const twistK = sw.kind === 'lob' || sw.kind === 'drop' ? 0.5 : 1;                 // soft underhand shots turn the trunk less   // ... and the trunk leans for the rest
  const lowAmt = dyU / 1.2;
  const hiAmt = clamp((C.y - 1.35) * 0.5, 0, 0.3);
  const sgn = (back ? -1 : 1);                                // a backhand coils the other way
  const def = {
    C, dd, dh, tech, back, m, fast,
    handPath, n, fdTrack,
    dy: track([[-0.34, -0.1], [-0.16, -0.12 - Math.min(0.2, lowAmt * 0.6), 'io'], [0, -0.12 - Math.min(0.24, lowAmt * 1.2), 'io'], [0.18, -0.1 - Math.min(0.18, lowAmt * 0.8), 'io'], [0.5, -0.1, 'io']]),
    oz: track([[-0.34, 0], [-0.14, -0.07, 'io'], [0.02, 0.07, 'out'], [0.2, 0.1], [0.5, 0, 'io']]),
    bend: track([[-0.34, 0], [-0.14, 4 + bendLow * 0.8 - hiAmt * 20, 'io'], [0, 6 + bendLow - hiAmt * 30, 'io'], [0.2, 8 + bendLow * 0.6, 'io'], [0.5, 0, 'io']]),
    side: track([[-0.34, 0], [0, sgn * 5 * m + 0, 'io'], [0.5, 0, 'io']]),
    twist: track([[-0.34, 0], [-tw, -sgn * 30 * twistK, 'io'], [0.0, sgn * 6 * twistK, 'out'], [fast ? 0.15 : 0.22, sgn * 30 * twistK, 'out'], [0.5, 0, 'io']]),
    pTwist: track([[-0.34, 0], [-tw, -sgn * 12, 'io'], [0.0, sgn * 4, 'out'], [0.2, sgn * 12], [0.5, 0, 'io']]),
    dur: [-0.34, 0.5],
    // the balance arm (non-hitting): out and slightly forward, counter-swinging
    balance: vtrack([[-0.34, V(0.36, -0.14, 0.06), 'io'], [-tw, V(0.5, 0.0, 0.14), 'io'], [0.1, V(0.5, -0.06, 0.02), 'io'], [0.5, V(0.36, -0.14, 0.06), 'io']]),
    equip,
  };
  return def;
}

// foot positions (world) for a stance: front foot forward on the non-hitting side, back foot behind on the hitting side
export function stanceFeet(S, yaw, m, back) {
  const me = (back ? -1 : 1) * m;
  const f = V(Math.sin(yaw), 0, Math.cos(yaw)), l = V(Math.cos(yaw), 0, -Math.sin(yaw));
  const front = V(S.x, 0, S.z).addScaledVector(f, 0.12).addScaledVector(l, 0.14 * me);
  const rear = V(S.x, 0, S.z).addScaledVector(f, -0.08).addScaledVector(l, -0.14 * me);
  // for me = +1 (right-hander forehand) the left foot (l positive) is in front
  return me > 0 ? { L: front, R: rear } : { L: rear, R: front };
}

const _fd = V(), _hp = V();
/**
 * Evaluate a stroke at t (seconds from the contact). ctx = { x, z, jy, pelvisBase, H0, yaw (body yaw, world), feet:{L,R}, look (Vector3), palm: palm info of the hitting hand }.
 * Returns the pose P for Actor.apply, or null outside the stroke's duration.
 */
export function evalSwing(def, ctx, t, actor) {
  const [a, b] = def.dur;
  if (t < a || t > b) return null;
  const w = clamp(Math.min((t - a) / 0.17, (b - t) / 0.2), 0, 1), wi = easeFns.io(w);
  const m = def.m;
  const dy = def.dy(t), oz = def.oz(t);
  const yaw = ctx.yaw;
  const fwd = V(Math.sin(yaw), 0, Math.cos(yaw)), lat = V(Math.cos(yaw), 0, -Math.sin(yaw));
  const tgtPelvis = V(ctx.x, ctx.H0 + dy, ctx.z).addScaledVector(fwd, oz);
  const pelvis = ctx.pelvisBase.clone().lerp(tgtPelvis, wi);
  const P = { pelvis, yaw, pitch: 0, roll: 0, groundY: 0 };
  P.torso = { bend: def.bend(t) * wi, side: def.side(t) * wi, twist: def.twist(t) * m * wi };
  P.pelvisTilt = { bend: 0, side: 0, twist: def.pTwist(t) * m * wi };
  const F = actor.frames(P);
  const sideH = m > 0 ? 'R' : 'L', sideO = m > 0 ? 'L' : 'R';
  // planted feet (world): the actor solves two-bone IK to these points; weight fades in as the player arrives
  const legW = clamp((t + 0.26) / 0.1, 0, 1) * clamp((b - t) / 0.18, 0, 1);
  const mkLeg = (s) => { const p = ctx.feet[s]; return { p: [p.x, actor.groundAnkle, p.z], f: 'w', w: legW * wi, pole: [fwd.x, 0.15, fwd.z], pf: 'w' }; };
  P.legs = { L: mkLeg('L'), R: mkLeg('R') };
  // the hitting arm: palm (or paddle face) on the ball
  const hp = def.handPath(t, _hp);
  const n = def.n.clone();
  // blend the palm normal from "toward the target side" at wind-up to the shot direction at contact and back
  const fd = def.fdTrack(t, _fd).clone().addScaledVector(n, -def.fdTrack(t, _fd).dot(n)).normalize();
  const palmC = ctx.palm[sideH];                                   // { c: local palm centre (Vector3), n: local palm normal, f: local finger dir }
  // hand world orientation Q that maps (palm normal -> n, fingers -> fd)
  const Qh = alignFrame(palmC.n, palmC.f, n, fd);
  // palm point wanted at hp (for a paddle: the face centre is palmToFace beyond the palm along the fingers)
  const face = def.equip === 'paddle' ? PADDLE.palmToFace : 0;
  const thick = def.equip === 'paddle' ? PADDLE.faceThick : 0.012;
  const palmWanted = hp.clone().addScaledVector(n, -(BR * 0 + (t > -0.02 ? 0 : 0))).addScaledVector(n, 0);
  void palmWanted;
  // the path keys describe the BALL-side contact point; the palm sits behind it by the ball radius and the palm thickness
  const palmPt = hp.clone().addScaledVector(n, -(BR + thick)).addScaledVector(fd, -face);
  const handBone = palmPt.clone().sub(palmC.c.clone().applyQuaternion(Qh));
  const handW = wi;
  const poleW = V(lat.x * -m * 0.5, -1, lat.z * -m * 0.5).addScaledVector(fwd, -0.3);
  P.arms = { L: null, R: null };
  P.arms[sideH] = { p: [handBone.x, handBone.y, handBone.z], f: 'w', w: handW, pole: [poleW.x, poleW.y, poleW.z], pf: 'w', hq: Qh, hw: handW * clamp(1 - (t - 0.05) / 0.2, 0, 1), noShift: t < -0.07 };
  // balance arm in the body frame
  const bv = def.balance(t);
  const bs = m > 0 ? 1 : -1;                                       // balance arm = other side
  P.arms[sideO] = { p: [bv.x * bs, bv.y, bv.z], f: 'b', w: wi, pole: [bs * 0.5, -1, -0.2], pf: 'b' };
  if (ctx.look) P.look = { target: ctx.look, w: 1 };
  P.w = wi;
  return P;
}

// orientation that maps unit vector a1 -> b1 and (a2 projected) -> b2 (all in bone-local a, world b)
export function alignFrame(a1, a2, b1, b2) {
  const A1 = a1.clone().normalize();
  const A2 = a2.clone().sub(A1.clone().multiplyScalar(a2.dot(A1))).normalize();
  const A3 = A1.clone().cross(A2);
  const B1 = b1.clone().normalize();
  const B2 = b2.clone().sub(B1.clone().multiplyScalar(b2.dot(B1))).normalize();
  const B3 = B1.clone().cross(B2);
  const mA = new THREE.Matrix4().makeBasis(A1, A2, A3), mB = new THREE.Matrix4().makeBasis(B1, B2, B3);
  const R = mB.multiply(mA.clone().transpose());
  return new THREE.Quaternion().setFromRotationMatrix(R);
}
