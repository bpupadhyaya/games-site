// Procedural rig features layered on top of the sampled clips: fingers, wrist limits,
// two-bone IK, head look-at. All of them are pure functions of the bones' current pose.
import * as THREE from './three.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();

// ------------------------------------------------------------------ fingers
// [proximal, middle, distal] flexion in radians for thumb, index, middle, ring, little.
const REL = [[0.20, 0.25, 0.10], [0.22, 0.30, 0.20], [0.30, 0.40, 0.25], [0.38, 0.48, 0.30], [0.45, 0.55, 0.35]];
const FIST = [[0.5, 0.7, 0.5], [1.25, 1.55, 1.0], [1.30, 1.65, 1.05], [1.35, 1.70, 1.10], [1.40, 1.75, 1.15]];
const scale = (a, k) => a.map((r) => r.map((v) => v * k));
const lerpA = (a, b, t) => a.map((r, i) => r.map((v, j) => v + (b[i][j] - v) * t));

export const FINGER_POSES = {
  relaxed: { curl: REL, spread: [0.0, 0.03, 0.0, -0.03, -0.07] },
  open: { curl: [[0.0, 0.05, 0.0], [-0.04, 0.03, 0.02], [-0.04, 0.03, 0.02], [-0.04, 0.03, 0.02], [-0.04, 0.03, 0.02]], spread: [0.10, 0.14, 0.03, -0.08, -0.17] },
  fist: { curl: FIST, spread: [0, 0, 0, 0, 0] },
  // wrapped around a ~3 cm handle: not a full fist, thumb closes over the fingers
  batGrip: { curl: [[0.55, 0.62, 0.35], [1.02, 1.28, 0.78], [1.08, 1.34, 0.82], [1.12, 1.38, 0.85], [1.12, 1.38, 0.85]], spread: [0.0, 0.0, 0.0, 0.0, 0.0] },
  // cupped around a ball
  ballGrip: { curl: [[0.30, 0.35, 0.22], [0.55, 0.62, 0.38], [0.62, 0.70, 0.42], [0.66, 0.74, 0.46], [0.70, 0.76, 0.48]], spread: [0.10, 0.10, 0.02, -0.05, -0.12] },
  point: { curl: [REL[0], [0.02, 0.04, 0.02], FIST[2], FIST[3], FIST[4]], spread: [0, 0, 0, 0, 0] },
  pinch: { curl: [[0.45, 0.45, 0.25], [0.55, 0.62, 0.35], REL[2], REL[3], REL[4]], spread: [0, 0, 0, 0, 0] },
  // ball grips (see the grip chart): seam-up fast grip, off-break, leg-break, and a fielder's throw grip
  seamGrip: { curl: [[0.50, 0.55, 0.35], [0.38, 0.42, 0.26], [0.34, 0.40, 0.24], [0.95, 1.05, 0.7], [1.05, 1.15, 0.75]], spread: [0.05, 0.02, -0.05, -0.03, -0.1] },
  offBreak: { curl: [[0.45, 0.50, 0.30], [0.80, 0.92, 0.52], [0.52, 0.60, 0.34], [0.92, 1.0, 0.62], [0.95, 1.05, 0.68]], spread: [0.10, 0.12, -0.02, -0.04, -0.08] },
  legBreak: { curl: [[0.40, 0.46, 0.28], [0.46, 0.52, 0.30], [0.50, 0.56, 0.32], [0.95, 1.05, 0.66], [1.05, 1.12, 0.72]], spread: [0.08, 0.04, -0.02, -0.12, -0.14] },
  throwGrip: { curl: [[0.45, 0.50, 0.30], [0.50, 0.56, 0.34], [0.50, 0.56, 0.34], [0.58, 0.64, 0.38], [0.85, 0.95, 0.60]], spread: [0.08, 0.04, 0.0, -0.04, -0.1] },
  flat: { curl: [[0.0, 0.0, 0.0], [0, 0.0, 0.0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], spread: [0, 0, 0, 0, 0] },
};
export function blendFingerPose(a, b, t) { return { curl: lerpA(a.curl, b.curl, t), spread: a.spread.map((v, i) => v + (b.spread[i] - v) * t) }; }
export function scaleFingerPose(p, k) { return { curl: scale(p.curl, k), spread: p.spread }; }

const SIGN = { L: -1, R: 1 };

export class FingerRig {
  /** bones: map name->Bone (sanitised names). Must be called in the REST pose. */
  constructor(bones, side) {
    this.side = side;
    this.ok = false;
    const hand = bones[`Bip01_${side}_Hand`];
    const chains = [0, 1, 2, 3, 4].map((f) => [`Bip01_${side}_Finger${f}`, `Bip01_${side}_Finger${f}1`, `Bip01_${side}_Finger${f}2`].map((n) => bones[n]));
    if (!hand || chains.some((c) => c.some((b) => !b))) return;
    hand.updateWorldMatrix(true, true);
    const wp = (b) => b.getWorldPosition(V());
    const dirIdx = wp(chains[1][1]).sub(wp(chains[1][0])).normalize();
    const across = wp(chains[4][0]).sub(wp(chains[1][0])).normalize();
    const n = V().crossVectors(dirIdx, across).normalize();
    const handQi = hand.getWorldQuaternion(Q()).invert();
    this.hand = hand;
    this.bones = [];
    this.nLocal = n.clone().applyQuaternion(handQi);
    chains.forEach((chain, f) => chain.forEach((b, k) => {
      const child = chain[k + 1] || null;
      const d = child ? wp(child).sub(wp(b)).normalize() : wp(b).sub(wp(chain[k - 1])).normalize();
      const axisW = V().crossVectors(d, n).normalize();
      const q = b.getWorldQuaternion(Q());
      const qi = q.clone().invert();
      this.bones.push({ b, f, k, restQ: b.quaternion.clone(), axis: axisW.applyQuaternion(qi), nAxis: n.clone().applyQuaternion(qi), dirW: d.clone(), qi, self: false });
    }));
    // geometry the grip presets need, all in hand-local space (metres)
    this.knuckle = wp(chains[1][0]).sub(wp(hand)).applyQuaternion(handQi);
    this.across = across.clone().applyQuaternion(handQi); // index -> little finger direction
    this.fingerDir = dirIdx.clone().applyQuaternion(handQi);
    // palm side = the direction the fingertips travel when the hand closes (measured, no handedness guesswork)
    const tip = chains[2][2];
    const saved = chains.flat().map((b) => b.quaternion.clone());
    const p0 = wp(tip);
    for (const fb of this.bones) if (fb.f > 0) fb.b.quaternion.copy(fb.restQ).multiply(new THREE.Quaternion().setFromAxisAngle(fb.axis, FIST[fb.f][fb.k] * SIGN[side]));
    hand.updateWorldMatrix(true, true);
    const delta = wp(tip).sub(p0).applyQuaternion(handQi).normalize();
    chains.flat().forEach((b, i) => b.quaternion.copy(saved[i]));
    hand.updateWorldMatrix(true, true);
    this.palmDir = this.nLocal.clone().multiplyScalar(Math.sign(delta.dot(this.nLocal)) || 1);
    this._fitThumb(chains[0], n, across, dirIdx, wp, handQi);
    this.pose = blendFingerPose(FINGER_POSES.relaxed, FINGER_POSES.relaxed, 0);
    this.target = FINGER_POSES.relaxed;
    this.ok = true;
  }

  // The thumb folds across the palm about a different axis than the other fingers. Instead of guessing the geometry,
  // try the candidate axes per joint and keep the one that brings the thumb tip closest to the palm centre.
  _fitThumb(chain, n, across, dirIdx, wp, handQi) {
    const hand = this.hand;
    const target = this.knuckle.clone().multiplyScalar(0.5).addScaledVector(this.nLocal.clone().multiplyScalar(Math.sign(0)), 0);
    // palm centre point on the palm surface (slightly towards the palm side, which is measured later in this constructor)
    const palmSide = this._palmSide || this.nLocal;
    const tip = chain[2];
    const local = () => hand.worldToLocal(wp(tip));
    const q = new THREE.Quaternion();
    const thumb = this.bones.filter((fb) => fb.f === 0);
    for (const fb of thumb) {
      let best = null;
      const cands = [];
      for (const w of [V().crossVectors(fb.dirW, n), V().crossVectors(fb.dirW, across), V().crossVectors(fb.dirW, dirIdx), n.clone(), across.clone(), dirIdx.clone()]) {
        if (w.lengthSq() < 1e-8) continue;
        w.normalize();
        for (const sg of [1, -1]) cands.push(w.clone().multiplyScalar(sg).applyQuaternion(fb.qi));
      }
      for (const ax of cands) {
        fb.b.quaternion.copy(fb.restQ).multiply(q.setFromAxisAngle(ax, 0.6));
        hand.updateWorldMatrix(true, true);
        const p = local();
        // want: tip towards the palm centre, i.e. close to the middle of the index knuckle line and slightly palm-side (either sign: both are scored, the better wins)
        const d1 = p.distanceTo(target);
        if (!best || d1 < best.d) best = { d: d1, ax };
      }
      fb.b.quaternion.copy(fb.restQ);
      fb.axis = best.ax.clone(); fb.self = true;
      fb.b.quaternion.copy(fb.restQ).multiply(q.setFromAxisAngle(best.ax, 0.35)); hand.updateWorldMatrix(true, true);
    }
    for (const fb of thumb) fb.b.quaternion.copy(fb.restQ);
    hand.updateWorldMatrix(true, true);
  }

  setTarget(pose) { this.target = pose; }

  step(dt, rate = 12) {
    const k = Math.min(1, dt * rate);
    this.pose = blendFingerPose(this.pose, this.target, k);
  }

  apply() {
    if (!this.ok) return;
    const s0 = SIGN[this.side];
    const { curl, spread } = this.pose;
    const q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
    for (const fb of this.bones) {
      const s = fb.self ? 1 : s0;
      fb.b.quaternion.copy(fb.restQ).multiply(q.setFromAxisAngle(fb.axis, curl[fb.f][fb.k] * s));
      if (fb.k === 0 && spread[fb.f]) fb.b.quaternion.multiply(q2.setFromAxisAngle(fb.nAxis, spread[fb.f] * s0));
    }
  }
}

// ------------------------------------------------------------------ wrist limits
// Real wrists twist ~+-80 deg in total across forearm+wrist; retargeted mocap sometimes violates it
// (candy-wrapper wrists). We clamp twist about the forearm axis and the swing relative to the rest relation.
export class WristLimiter {
  constructor(bones, side, { twist = 0.62, swing = 0.95 } = {}) {
    this.hand = bones[`Bip01_${side}_Hand`];
    this.fore = this.hand?.parent;
    this.twist = twist; this.swing = swing;
    this.rest = this.hand ? this.hand.quaternion.clone() : null;
    this.axis = this.hand ? this.hand.position.clone().normalize() : null;
    this._d = Q(); this._t = Q(); this._sw = Q(); this._i = Q();
  }

  /** Twist/swing of a hand orientation given RELATIVE to the forearm (quaternion in forearm space). */
  measureRel(rel) {
    const { _d: d, _t: t, _sw: sw, _i: inv, axis } = this;
    d.copy(this.rest).invert().multiply(rel);
    if (d.w < 0) { d.x *= -1; d.y *= -1; d.z *= -1; d.w *= -1; }
    const dd = d.x * axis.x + d.y * axis.y + d.z * axis.z;
    t.set(axis.x * dd, axis.y * dd, axis.z * dd, d.w).normalize();
    sw.copy(d).multiply(inv.copy(t).invert());
    return { twist: Math.abs(2 * Math.atan2(dd, d.w)), swing: 2 * Math.acos(Math.min(1, Math.abs(sw.w))) };
  }

  /** Raw twist/swing (radians) of the hand relative to its rest relation, before limiting. */
  measure() {
    const h = this.hand; if (!h) return { twist: 0, swing: 0 };
    const { _d: d, _t: t, _sw: sw, _i: inv, axis } = this;
    d.copy(this.rest).invert().multiply(h.quaternion);
    if (d.w < 0) { d.x *= -1; d.y *= -1; d.z *= -1; d.w *= -1; }
    const dd = d.x * axis.x + d.y * axis.y + d.z * axis.z;
    t.set(axis.x * dd, axis.y * dd, axis.z * dd, d.w).normalize();
    sw.copy(d).multiply(inv.copy(t).invert());
    return { twist: Math.abs(2 * Math.atan2(dd, d.w)), swing: 2 * Math.acos(Math.min(1, Math.abs(sw.w))) };
  }

  apply() {
    const h = this.hand; if (!h) return;
    const { _d: d, _t: t, _sw: sw, _i: inv, axis } = this;
    d.copy(this.rest).invert().multiply(h.quaternion);
    if (d.w < 0) { d.x *= -1; d.y *= -1; d.z *= -1; d.w *= -1; }
    const dd = d.x * axis.x + d.y * axis.y + d.z * axis.z;
    t.set(axis.x * dd, axis.y * dd, axis.z * dd, d.w).normalize();
    sw.copy(d).multiply(inv.copy(t).invert());
    let twist = 2 * Math.atan2(dd, d.w);
    let changed = false;
    if (Math.abs(twist) > this.twist) { twist = Math.sign(twist) * this.twist; t.setFromAxisAngle(axis, twist); changed = true; }
    const sa = 2 * Math.acos(Math.min(1, Math.abs(sw.w)));
    if (sa > this.swing) {
      const ax = V().set(sw.x, sw.y, sw.z).normalize();
      if (sw.w < 0) ax.negate();
      sw.setFromAxisAngle(ax, this.swing); changed = true;
    }
    if (changed) h.quaternion.copy(this.rest).multiply(sw.multiply(t));
  }
}

// ------------------------------------------------------------------ two-bone IK
const _a = V(), _b = V(), _c = V(), _ab = V(), _nb = V(), _perp = V(), _dir = V(), _bc = V(), _tmp = V();
const _qw = Q(), _qp = Q(), _qr = Q();

function rotateBoneWorld(bone, qDelta) {
  // newWorld = qDelta * world ; local = inv(parentWorld) * newWorld
  bone.parent.getWorldQuaternion(_qp);
  bone.getWorldQuaternion(_qw);
  _qr.copy(qDelta).multiply(_qw);
  bone.quaternion.copy(_qp.invert().multiply(_qr));
  bone.updateWorldMatrix(false, true);
}

/**
 * Bend `upper`/`mid` so that `end` (child of mid, e.g. ankle or wrist) reaches `target` (world position).
 * The bend direction follows the pose the animation already had (natural knee/elbow), or `pole` if given.
 * Returns the reach fraction (1 = reached). weight blends towards the solved pose.
 */
export function solveTwoBone(upper, mid, end, target, { weight = 1, pole = null, softness = 0.995 } = {}) {
  if (weight <= 0) return 0;
  upper.getWorldPosition(_a); mid.getWorldPosition(_b); end.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  _dir.subVectors(target, _a);
  const dist = Math.max(1e-4, _dir.length());
  _dir.divideScalar(dist);
  const maxd = (l1 + l2) * softness;
  const d = Math.min(dist, maxd);
  // bend plane hint
  _perp.copy(pole ? _tmp.subVectors(pole, _a) : _ab.subVectors(_b, _a));
  _perp.addScaledVector(_dir, -_perp.dot(_dir));
  if (_perp.lengthSq() < 1e-8) _perp.set(0, 0, 1).addScaledVector(_dir, -_dir.z);
  _perp.normalize();
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  _nb.copy(_a).addScaledVector(_dir, l1 * cosA).addScaledVector(_perp, l1 * sinA);
  // rotate upper: (b - a) -> (nb - a)
  const qa = new THREE.Quaternion().setFromUnitVectors(_ab.subVectors(_b, _a).normalize(), _tmp.subVectors(_nb, _a).normalize());
  if (weight < 1) qa.slerp(new THREE.Quaternion(), 1 - weight);
  rotateBoneWorld(upper, qa);
  // rotate mid: (c - b) -> (target' - b), target' = a + dir*d
  mid.getWorldPosition(_b); end.getWorldPosition(_c);
  const tgt = _tmp.copy(_a).addScaledVector(_dir, d);
  const qb = new THREE.Quaternion().setFromUnitVectors(_bc.subVectors(_c, _b).normalize(), tgt.sub(_b).normalize());
  if (weight < 1) qb.slerp(new THREE.Quaternion(), 1 - weight);
  rotateBoneWorld(mid, qb);
  return d / dist;
}

// ------------------------------------------------------------------ look at
export class LookAt {
  constructor(bones, rootGetter) {
    this.neck = bones.Bip01_Neck; this.head = bones.Bip01_Head; this.spine2 = bones.Bip01_Spine2;
    this.target = null; this.weight = 0; this._w = 0;
    this.maxYaw = 1.2; this.maxPitch = 0.7;
    this.rootGetter = rootGetter;
    // head forward axis in head-local space (avatar faces +Z at rest)
    this.head.updateWorldMatrix(true, false);
    const rootQ = rootGetter().getWorldQuaternion(Q());
    this.fwdLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(rootQ).applyQuaternion(this.head.getWorldQuaternion(Q()).invert());
    this.yaw = 0; this.pitch = 0;
  }

  apply(dt) {
    const tw = this.target ? 1 : 0;
    this._w += (tw - this._w) * Math.min(1, dt * 6);
    const w = this._w * this.weight;
    if (w < 1e-3 || !this.target) return;
    const root = this.rootGetter();
    const rq = root.getWorldQuaternion(Q());
    const hp = this.head.getWorldPosition(V());
    const dirW = V().subVectors(this.target, hp).normalize();
    const dirL = dirW.clone().applyQuaternion(rq.clone().invert()); // in avatar space, +Z forward
    let yaw = Math.atan2(dirL.x, dirL.z);
    let pitch = Math.asin(Math.max(-1, Math.min(1, dirL.y)));
    yaw = Math.max(-this.maxYaw, Math.min(this.maxYaw, yaw));
    pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, pitch));
    const want = V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).applyQuaternion(rq);
    const cur = this.fwdLocal.clone().applyQuaternion(this.head.getWorldQuaternion(Q()));
    const full = new THREE.Quaternion().setFromUnitVectors(cur, want);
    const part = (f) => new THREE.Quaternion().slerp(full, f * w);
    // distribute: spine2 15%, neck 35%, head 50% (applied top-down so parents move children)
    rotateBoneWorld(this.spine2, part(0.15));
    rotateBoneWorld(this.neck, part(0.35 / 0.85));
    const cur2 = this.fwdLocal.clone().applyQuaternion(this.head.getWorldQuaternion(Q()));
    rotateBoneWorld(this.head, new THREE.Quaternion().setFromUnitVectors(cur2, want).slerp(new THREE.Quaternion(), 1 - w));
  }
}
