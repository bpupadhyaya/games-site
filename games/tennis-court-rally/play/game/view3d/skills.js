// Tennis strokes: forehand, backhand, volley, low scoop, overhead and serve. Authored as pose tracks plus world-space IK for the striking arm: at
// the contact time (tc) the centre of the string bed is exactly where the sim says the ball is (behind it by the ball radius), facing the way the
// ball leaves. Pelvis, torso, planted feet and the balance arm are keyed relative to the contact so weight transfer reads naturally.
import { THREE } from '../vendor3d/index.js';
import { easeFns } from './actor.js';
import { BR } from '../src/consts.js';
import { RACKET } from './court.js';

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

// per-kind lift: wind-up height, early and late follow-through height (m relative to the contact), face roll in degrees (+ closes the face)
const LIFT = {
  drive: { wu: -0.3, f1: 0.38, f2: 0.85, roll: 24, tw: 0.17, fol: 0.6 },
  slice: { wu: 0.3, f1: -0.08, f2: 0.15, roll: -22, tw: 0.2, fol: 0.5 },
  drop: { wu: 0.12, f1: -0.05, f2: 0.2, roll: -30, tw: 0.22, fol: 0.3 },
  lob: { wu: -0.45, f1: 0.7, f2: 1.0, roll: -10, tw: 0.2, fol: 0.55 },
  volley: { wu: 0.02, f1: -0.04, f2: 0.12, roll: -14, tw: 0.12, fol: 0.32 },
};

/**
 * Build the definition of a stroke. sw = the sim's swing record; m = +1 right-handed, -1 left-handed.
 */
export function strokeDef(sw, m, equip) {
  const C = V(sw.cp.x, sw.cp.y, sw.cp.z);
  const dd = sw.d ? V(sw.d.x, sw.d.y, sw.d.z) : V(0, 0.1, sw.cp.z < 0 ? 1 : -1);
  dd.normalize();
  const dh = V(dd.x, 0, dd.z); if (dh.lengthSq() < 1e-6) dh.set(0, 0, sw.cp.z < 0 ? 1 : -1); dh.normalize();
  const yawD = Math.atan2(dh.x, dh.z);
  const leftB = V(Math.cos(yawD), 0, -Math.sin(yawD));
  const tech = sw.tech, back = !!sw.back, serve = tech === 'serve';
  const kind = tech === 'vol' ? 'volley' : (sw.kind === 'serve1' || sw.kind === 'serve2' ? 'drive' : sw.kind);
  const L = LIFT[kind] || LIFT.drive;
  const hs = (back ? 1 : -1) * m;                                    // the racket hand is on this side (times leftB) of the shot direction
  const lat = -hs;                                                   // the racket head leans to this side
  const P = (a, h, u) => C.clone().addScaledVector(dh, a).addScaledVector(leftB, hs * h).addScaledVector(V(0, 1, 0), u);
  const D = (a, l, u) => dh.clone().multiplyScalar(a).addScaledVector(leftB, lat * l).addScaledVector(V(0, 1, 0), u).normalize();
  let handPath, fdTrack, nTrack, tw = L.tw;
  const rollAxis = leftB;
  const rotN = (deg) => dd.clone().applyQuaternion(Q().setFromAxisAngle(rollAxis, deg * D2R));
  if (serve) {
    tw = 0.2;
    handPath = vtrack([[-0.34, P(-0.1, 0.12, -0.95), 'io'], [-0.2, P(-0.6, 0.12, -1.7), 'io'], [-0.08, P(-0.3, 0.08, -0.55), 'in'], [0, C, 'lin'], [0.1, P(0.3, -0.25, -0.4), 'out'], [0.22, P(0.4, -0.6, -1.3), 'io'], [0.5, P(0.1, 0.1, -1.9), 'io']]);
    fdTrack = vtrack([[-0.34, D(-0.1, 0.1, 1), 'io'], [-0.2, D(-0.6, 0.2, -0.3), 'io'], [-0.08, D(-0.2, 0.1, 0.8), 'io'], [0, D(0.0, 0.0, 1), 'lin'], [0.12, D(0.5, 0.3, 0.4), 'out'], [0.25, D(0.3, 0.8, -0.3), 'io'], [0.5, D(0, 0.2, -0.9), 'io']]);
    nTrack = vtrack([[-0.34, dd.clone(), 'io'], [-0.2, rotN(-50), 'io'], [0, dd.clone(), 'lin'], [0.15, rotN(60), 'out'], [0.5, rotN(80), 'io']]);
  } else if (tech === 'high') {
    tw = 0.18;
    handPath = vtrack([[-0.34, P(-0.2, 0.1, -0.9), 'io'], [-0.18, P(-0.5, 0.15, -1.3), 'io'], [-0.06, P(-0.25, 0.1, -0.4), 'in'], [0, C, 'lin'], [0.1, P(0.3, -0.25, -0.35), 'out'], [0.24, P(0.3, -0.6, -1.0), 'io'], [0.5, P(0.1, 0.1, -1.5), 'io']]);
    fdTrack = vtrack([[-0.34, D(-0.1, 0.1, 1), 'io'], [-0.18, D(-0.7, 0.2, 0.0), 'io'], [0, D(0, 0, 1), 'lin'], [0.12, D(0.5, 0.3, 0.3), 'out'], [0.3, D(0.2, 0.8, -0.4), 'io'], [0.5, D(0, 0.2, -0.9), 'io']]);
    nTrack = vtrack([[-0.34, dd.clone(), 'io'], [-0.18, rotN(-40), 'io'], [0, dd.clone(), 'lin'], [0.2, rotN(55), 'out'], [0.5, rotN(70), 'io']]);
  } else {
    const low = tech === 'low';
    const lowK = low ? 0.85 : 1;
    const wind = P(-0.85 * lowK, 0.7, L.wu), mid = P(-0.38, 0.28, L.wu * 0.45), r0 = P(-0.45, 0.45, L.wu * 0.5);
    const f1 = P(L.fol, -0.15, L.f1), f2 = P(0.12, -0.78, L.f2), rest = P(0.2, 0.2, -0.25);
    const keys = [[-0.34, r0, 'io'], [-tw, wind, 'io'], [-tw * 0.4, mid, 'in'], [0, C, 'lin'], [0.14, f1, 'out'], [0.29, f2, 'io'], [0.5, rest, 'io']];
    for (const k of keys) k[1].y = Math.max(0.18, k[1].y);
    handPath = vtrack(keys);
    const cUp = low ? 0.35 : 0.75;
    fdTrack = vtrack([[-0.34, D(-0.1, 0.8, 0.55), 'io'], [-tw, D(-0.85, 0.35, 0.35), 'io'], [0, D(0.0, 0.66, cUp), 'lin'], [0.14, D(0.1, 0.95, 0.2), 'out'], [0.29, D(-0.5, 0.6, 0.55), 'io'], [0.5, D(0, 0.8, 0.5), 'io']]);
    nTrack = vtrack([[-0.34, dd.clone(), 'io'], [-tw, rotN(L.roll * 1.2), 'io'], [0, dd.clone(), 'lin'], [0.16, rotN(-L.roll * 1.3), 'out'], [0.5, rotN(-L.roll * 0.6), 'io']]);
  }
  // ---- body tracks (mirrored for lefties through m)
  const shoulderDrop = clamp(1.42 - (C.y + 0.1 - (serve ? 0 : 0.35)), 0, 0.95);
  const dyU = Math.min(0.36, shoulderDrop * 0.75);
  const bendLow = tech === 'low' ? Math.min(34, Math.acos(clamp(1 - (shoulderDrop - dyU) / 0.55, 0.3, 1)) / D2R) : 0;
  const lowAmt = dyU / 1.2;
  const sgn = back ? -1 : 1;
  const twistK = tech === 'vol' ? 0.4 : kind === 'drop' ? 0.5 : 1;
  const def = {
    C, dd, dh, tech, back, m, serve, kind,
    handPath, nTrack, fdTrack,
    dy: serve ? track([[-0.34, -0.06], [-0.2, -0.26, 'io'], [-0.03, 0.1, 'out'], [0.12, 0.0, 'io'], [0.5, -0.05, 'io']])
      : tech === 'vol' ? track([[-0.34, -0.12], [-0.1, -0.18, 'io'], [0, -0.18], [0.2, -0.12], [0.5, -0.1]])
        : track([[-0.34, -0.06], [-0.16, -0.09 - Math.min(0.2, lowAmt * 0.6), 'io'], [0, -0.08 - Math.min(0.24, lowAmt * 1.2), 'io'], [0.18, -0.06 - Math.min(0.18, lowAmt * 0.8), 'io'], [0.5, -0.06, 'io']]),
    oz: serve ? track([[-0.34, 0], [-0.1, -0.06, 'io'], [0.04, 0.16, 'out'], [0.3, 0.1], [0.5, 0, 'io']])
      : track([[-0.34, 0], [-0.14, -0.07, 'io'], [0.02, 0.09, 'out'], [0.2, 0.12], [0.5, 0, 'io']]),
    bend: serve ? track([[-0.34, 2], [-0.14, -12, 'io'], [0.02, 14, 'out'], [0.2, 26, 'io'], [0.5, 0, 'io']])
      : track([[-0.34, 0], [-0.14, 4 + bendLow * 0.8, 'io'], [0, 6 + bendLow, 'io'], [0.2, 8 + bendLow * 0.6, 'io'], [0.5, 0, 'io']]),
    side: serve ? track([[-0.34, 0], [-0.14, -8 * m, 'io'], [0.03, 10 * m, 'out'], [0.5, 0, 'io']]) : track([[-0.34, 0], [0, sgn * 5 * m, 'io'], [0.5, 0, 'io']]),
    twist: serve ? track([[-0.34, 0], [-0.18, -sgn * 42, 'io'], [0.02, sgn * 8, 'out'], [0.22, sgn * 38, 'out'], [0.5, 0, 'io']])
      : track([[-0.34, 0], [-tw, -sgn * 38 * twistK, 'io'], [0.0, sgn * 6 * twistK, 'out'], [0.2, sgn * 36 * twistK, 'out'], [0.5, 0, 'io']]),
    pTwist: track([[-0.34, 0], [-tw, -sgn * 15, 'io'], [0.0, sgn * 4, 'out'], [0.2, sgn * 14, 'io'], [0.5, 0, 'io']]),
    dur: [-0.34, 0.5],
    // the balance arm (non-hitting): out and slightly forward, counter-swinging; a serve tosses with it first
    balance: serve ? vtrack([[-0.34, V(0.25, 1.15, 0.2), 'io'], [-0.14, V(0.28, 1.0, 0.3), 'io'], [0.05, V(0.3, 0.3, 0.2), 'io'], [0.5, V(0.34, -0.14, 0.06), 'io']])
      : vtrack([[-0.34, V(0.36, -0.14, 0.06), 'io'], [-tw, V(0.55, 0.0, 0.16), 'io'], [0.1, V(0.5, -0.06, 0.02), 'io'], [0.5, V(0.36, -0.14, 0.06), 'io']]),
    equip,
  };
  return def;
}

// foot positions (world) for a stance: front foot forward on the non-hitting side, back foot behind on the hitting side
export function stanceFeet(S, yaw, m, back) {
  const me = (back ? -1 : 1) * m;
  const f = V(Math.sin(yaw), 0, Math.cos(yaw)), l = V(Math.cos(yaw), 0, -Math.sin(yaw));
  const front = V(S.x, 0, S.z).addScaledVector(f, 0.14).addScaledVector(l, 0.17 * me);
  const rear = V(S.x, 0, S.z).addScaledVector(f, -0.1).addScaledVector(l, -0.17 * me);
  return me > 0 ? { L: front, R: rear } : { L: rear, R: front };
}

const _fd = V(), _n = V(), _hp = V();
/**
 * Evaluate a stroke at t (seconds from the contact). ctx = { x, z, pelvisBase, H0, yaw (body yaw, world), feet:{L,R}, look (Vector3), palm: palm info of the hitting hand }.
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
  const legW = clamp((t + 0.26) / 0.1, 0, 1) * clamp((b - t) / 0.18, 0, 1);
  const mkLeg = (s) => { const p = ctx.feet[s]; return { p: [p.x, actor.groundAnkle, p.z], f: 'w', w: legW * wi, pole: [fwd.x, 0.15, fwd.z], pf: 'w' }; };
  P.legs = { L: mkLeg('L'), R: mkLeg('R') };
  // the hitting arm: the string bed on the ball
  const hp = def.handPath(t, _hp);
  const n = def.nTrack(t, _n).clone().normalize();
  const fd = def.fdTrack(t, _fd).clone();
  fd.addScaledVector(n, -fd.dot(n)); if (fd.lengthSq() < 1e-6) fd.set(0, 1, 0); fd.normalize();
  const palmC = ctx.palm[sideH];
  const Qh = alignFrame(palmC.n, palmC.f, n, fd);
  const face = RACKET.palmToFace, thick = RACKET.faceThick;
  // the path keys describe the BALL-side point of the string bed; the palm sits behind it by the ball radius and the strings' thickness, and `face` back along the racket
  const palmPt = hp.clone().addScaledVector(n, -(BR * (0.4 + 0.6 * Math.exp(-((t / 0.06) ** 2))) + thick)).addScaledVector(fd, -face);
  const handBone = palmPt.clone().sub(palmC.c.clone().applyQuaternion(Qh));
  const handW = wi;
  const poleW = V(lat.x * -m * 0.5, -1, lat.z * -m * 0.5).addScaledVector(fwd, -0.3);
  P.arms = { L: null, R: null };
  P.arms[sideH] = { p: [handBone.x, handBone.y, handBone.z], f: 'w', w: handW, pole: [poleW.x, poleW.y, poleW.z], pf: 'w', hq: Qh, hw: handW * clamp(1 - (t - 0.3) / 0.2, 0, 1), noShift: t < -0.07 };
  const bv = def.balance(t);
  const bs = m > 0 ? 1 : -1;
  P.arms[sideO] = { p: [bv.x * bs, bv.y, bv.z], f: 'b', w: wi, pole: [bs * 0.5, -1, -0.2], pf: 'b', noShift: true };
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
