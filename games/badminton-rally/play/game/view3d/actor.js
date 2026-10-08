// Procedural pose layer (adapted for badminton strokes). Runs AFTER human.update(dt): it anchors the pelvis in the world (so the body can
// jump, lean and somersault about it), turns the torso, solves both legs and both arms with two-bone IK against explicit
// world / body-frame targets, and aims the feet at the ball. The simulation owns where and when the ball is touched; this layer
// only makes a believable body reach that exact point at that exact moment.
import { THREE } from '../vendor3d/index.js';
import { solveTwoBone } from '../vendor3d/rig.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
const D2R = Math.PI / 180;
const UP = V(0, 1, 0);

export const easeFns = {
  lin: (x) => x,
  in: (x) => x * x,
  out: (x) => 1 - (1 - x) * (1 - x),
  io: (x) => x * x * (3 - 2 * x),
  io2: (x) => x * x * x * (x * (x * 6 - 15) + 10),
  snap: (x) => x * x * x,
};

// world-space rotation of a bone about its own joint (parent chain keeps following)
const _qp = Q(), _qw = Q(), _qr = Q();
export function rotateBoneWorld(bone, qDelta) {
  bone.parent.getWorldQuaternion(_qp);
  bone.getWorldQuaternion(_qw);
  _qr.copy(qDelta).multiply(_qw);
  bone.quaternion.copy(_qp.invert().multiply(_qr));
  bone.updateWorldMatrix(false, true);
}
export function setBoneWorldQuat(bone, q) {
  bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(q));
  bone.updateWorldMatrix(false, true);
}

export class Actor {
  constructor(human) {
    this.h = human;
    const b = human.bones;
    const g = (n) => b[`Bip01_${n}`];
    this.b = {
      pelvis: g('Pelvis'), spine: g('Spine'), spine1: g('Spine1'), spine2: g('Spine2'), neck: g('Neck'), head: g('Head'),
      L: { clav: g('L_Clavicle'), up: g('L_UpperArm'), fore: g('L_Forearm'), hand: g('L_Hand'), thigh: g('L_Thigh'), calf: g('L_Calf'), foot: g('L_Foot'), toe: g('L_Toe0') },
      R: { clav: g('R_Clavicle'), up: g('R_UpperArm'), fore: g('R_Forearm'), hand: g('R_Hand'), thigh: g('R_Thigh'), calf: g('R_Calf'), foot: g('R_Foot'), toe: g('R_Toe0') },
    };
    // rest-pose calibration (root at identity, rest pose written by the Human constructor)
    human.root.updateMatrixWorld(true);
    this.rest = {};
    for (const s of ['L', 'R']) {
      const f = this.b[s].foot, fq = f.getWorldQuaternion(Q()), inv = fq.clone().invert();
      this.rest[s] = {
        sole: { fwd: V(0, 0, 1).applyQuaternion(inv), up: V(0, 1, 0).applyQuaternion(inv), left: V(1, 0, 0).applyQuaternion(inv) },
        ankleY: f.getWorldPosition(V()).y,
        legLen: this._len(this.b[s].thigh, this.b[s].calf, f),
        armLen: this._len(this.b[s].up, this.b[s].fore, this.b[s].hand),
      };
    }
    this._restQ = new Map([this.b.spine2, this.b.head].map((bn) => [bn, bn.getWorldQuaternion(Q())]));
    this.pelvisRest = this.b.pelvis.getWorldPosition(V());
    this.headRest = this.b.head.getWorldPosition(V());
    this.groundAnkle = Math.max(this.rest.L.ankleY, this.rest.R.ankleY);
    this.lock = { L: null, R: null };      // world positions of planted feet
    this.lockW = { L: 0, R: 0 };
    this.lookTarget = V(); this.lookW = 0;
    this.out = { contact: V() };
    this._bodyQ = Q();
    this.out.shift = 0;
  }
  lockFallback(side) { const p = this.b[side].foot.getWorldPosition(V()); p.y = this.groundAnkle; return p; }
  _len(a, m, e) { const pa = a.getWorldPosition(V()), pm = m.getWorldPosition(V()), pe = e.getWorldPosition(V()); return pa.distanceTo(pm) + pm.distanceTo(pe); }

  /** Frames used by pose keys. g = yaw only, origin on the ground under the pelvis. b = yaw*pitch*roll, origin at the pelvis. */
  frames(P) {
    const yawQ = Q().setFromAxisAngle(UP, P.yaw);
    const bq = yawQ.clone().multiply(Q().setFromAxisAngle(V(1, 0, 0), (P.pitch || 0) * D2R)).multiply(Q().setFromAxisAngle(V(0, 0, 1), (P.roll || 0) * D2R));
    return { yawQ, bq, pelvis: P.pelvis.clone(), ground: V(P.pelvis.x, P.groundY ?? 0, P.pelvis.z) };
  }
  toWorld(vec, frame, F) {
    if (frame === 'w') return V(vec[0], vec[1], vec[2]);
    if (frame === 'b') return V(vec[0], vec[1], vec[2]).applyQuaternion(F.bq).add(F.pelvis);
    return V(vec[0], vec[1], vec[2]).applyQuaternion(F.yawQ).add(F.ground);   // 'g'
  }
  dirToWorld(vec, frame, F) {
    if (frame === 'w') return V(vec[0], vec[1], vec[2]);
    return V(vec[0], vec[1], vec[2]).applyQuaternion(frame === 'b' ? F.bq : F.yawQ);
  }

  /**
   * P = {
   *  pelvis: Vector3 (world position of the pelvis), yaw, pitch, roll (deg), groundY,
   *  torso: {bend, side, twist} (deg, body frame; + bend = lean forward, + side = lean to the body's left, + twist = turn left),
   *  pelvisTilt: {bend, side, twist}  (the pelvis bone itself, deg),
   *  legs: { L: T|null, R: T|null },  arms: { L: T|null, R: T|null }
   *  look: {target: Vector3, w} | null, headAdd: {pitch, yaw}
   * }
   * T (limb target) = { p: [x,y,z], f: 'g'|'b'|'w', w: 0..1, pole: [x,y,z] (frame f), aim: {n: [..] (direction the contact surface faces, frame f), face: 'instep'|'inside'|'sole', fwd: [..]} , pf: 'g'|'b'|'w' }
   */
  _run(P) {
    const h = this.h, root = h.root, B = this.b;
    // 1. anchor: rotate the whole body about the pelvis and place the pelvis at P.pelvis
    const F = this.frames(P);
    this.out.shift = 0;
    root.quaternion.copy(F.bq);
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    const pw = B.pelvis.getWorldPosition(V());
    root.position.copy(P.pelvis).sub(pw);
    root.updateMatrixWorld(true);
    // 2. torso: pelvis tilt then spine, about body-frame axes
    const axX = V(1, 0, 0).applyQuaternion(F.bq), axY = V(0, 1, 0).applyQuaternion(F.bq), axZ = V(0, 0, 1).applyQuaternion(F.bq);
    const rot = (bone, ax, deg) => { if (Math.abs(deg) > 1e-4) rotateBoneWorld(bone, Q().setFromAxisAngle(ax, deg * D2R)); };
    const pt = P.pelvisTilt;
    if (pt) { rot(B.pelvis, axX, pt.bend || 0); rot(B.pelvis, axZ, -(pt.side || 0)); rot(B.pelvis, axY, pt.twist || 0); }
    const tr = P.torso;
    if (tr) {
      for (const [bone, f] of [[B.spine, 0.30], [B.spine1, 0.38], [B.spine2, 0.32]]) {
        rot(bone, axX, (tr.bend || 0) * f); rot(bone, axZ, -(tr.side || 0) * f); rot(bone, axY, (tr.twist || 0) * f);
      }
    }
    root.updateMatrixWorld(true);
    // head first (it turns the upper chest a little), so the arms are solved on the final shoulders
    if (P.look && P.look.w > 0) this._look(P.look.target, P.look.w, P.headAdd, F);
    root.updateMatrixWorld(true);
    // 3. legs
    for (const s of ['L', 'R']) {
      const T = P.legs && P.legs[s];
      if (!T || T.w <= 0) { this.lockW[s] = 0; continue; }
      this._solveLeg(s, T, F, P);
    }
    // 4. arms
    for (const s of ['L', 'R']) {
      const T = P.arms && P.arms[s];
      if (!T || T.w <= 0) continue;
      this._solveArm(s, T, F);
    }
    root.updateMatrixWorld(true);
  }

  // --- snapshot of the animated pose (so the pose can be solved twice when a contact bone needs a body shift)
  snapshot() {
    const bones = [this.b.pelvis, this.b.spine, this.b.spine1, this.b.spine2, this.b.neck, this.b.head];
    for (const s of ['L', 'R']) bones.push(this.b[s].clav, this.b[s].up, this.b[s].fore, this.b[s].hand, this.b[s].thigh, this.b[s].calf, this.b[s].foot, this.b[s].toe);
    this._snap = bones.map((b) => ({ b, q: b.quaternion.clone(), p: b.position.clone() }));
  }
  restore() { for (const e of this._snap) { e.b.quaternion.copy(e.q); e.b.position.copy(e.p); } }
  /** P.fix = { bone: 'knee'|'chest'|'head', side, target: Vector3 (where that point must be at contact), w, up } */
  apply(P, dt) {
    this.snapshot();
    this._run(P);
    const fx = P.fix;
    if (fx && fx.w > 0.02) {
      let pel = P.pelvis.clone();
      for (let it = 0; it < 3; it++) {
        const cur = this._fixPoint(fx);
        const err = fx.target.clone().sub(cur);
        const len = err.length();
        this.out.fixErr = len;
        if (len < 0.004) break;
        err.multiplyScalar(Math.min(1, 0.4 / Math.max(len, 1e-6)) * fx.w);
        pel = pel.add(err);
        this.restore();
        this._run({ ...P, pelvis: pel });
      }
      this.out.fixErr = fx.target.distanceTo(this._fixPoint(fx));
    }
  }
  _fixPoint(fx) {
    const B = this.b;
    if (fx.bone === 'knee') return B[fx.side].calf.getWorldPosition(V());
    const bone = fx.bone === 'chest' ? B.spine2 : B.head;
    const off = fx.bone === 'chest' ? (this._chestLocal ??= this._localOffset(B.spine2, V(0, -0.03, 0.205))) : (this._headLocal ??= this._localOffset(B.head, V(0, 0.16, 0.147)));
    return bone.getWorldPosition(V()).add(off.clone().applyQuaternion(bone.getWorldQuaternion(Q())));
  }
  // an offset given in the REST (world-aligned) frame, converted into the bone's local frame (uses the rest pose captured at construction)
  _localOffset(bone, worldOffset) { return worldOffset.clone().applyQuaternion(this._restQ.get(bone).clone().invert()); }

  _solveLeg(s, T, F, P) {
    const B = this.b[s];
    let tgt = this.toWorld(T.p, T.f || 'g', F);
    let hip = B.thigh.getWorldPosition(V());
    // reach fix: if the target is farther than the leg can stretch, move the whole body towards it (contact stays exact)
    const maxL = this.rest[s].legLen * 0.985, dist = hip.distanceTo(tgt);
    if (dist > maxL && T.w > 0.5) {
      const shift = tgt.clone().sub(hip).normalize().multiplyScalar(Math.min(0.4, dist - maxL) * T.w);
      this.h.root.position.add(shift); this.h.root.updateMatrixWorld(true);
      hip = B.thigh.getWorldPosition(V());
      this.out.shift = (this.out.shift || 0) + shift.length();
    }
    const pole = T.pole ? this.dirToWorld(T.pole, T.pf || T.f || 'g', F) : V(0, 0, 1).applyQuaternion(F.yawQ);
    // bend direction: a point in front of the knee line
    const mid = hip.clone().add(tgt).multiplyScalar(0.5);
    const poleP = mid.clone().add(pole.clone().multiplyScalar(0.6));
    solveTwoBone(B.thigh, B.calf, B.foot, tgt, { weight: T.w, pole: poleP });
    // foot orientation
    if (T.aim) this._aimFoot(s, T, F);
  }
  /** Orientation of the foot bone so that the chosen face of the foot points along n, toes along fwd (both world, unit-ish). */
  footQuat(s, n, fwd, face) {
    const R = this.rest[s];
    n = n.clone().normalize();
    const f2 = fwd.clone().sub(n.clone().multiplyScalar(fwd.dot(n)));
    if (f2.lengthSq() < 1e-6) f2.set(1, 0, 0);
    f2.normalize();
    let loc;
    if (face === 'inside') loc = R.sole.left.clone().multiplyScalar(s === 'R' ? 1 : -1);
    else if (face === 'outside') loc = R.sole.left.clone().multiplyScalar(s === 'R' ? -1 : 1);
    else if (face === 'sole') loc = R.sole.up.clone().negate();
    else loc = R.sole.up.clone();
    const a1 = loc.normalize();
    const a2 = R.sole.fwd.clone().sub(a1.clone().multiplyScalar(R.sole.fwd.dot(a1))).normalize();
    return basisQ(n, f2).multiply(basisQ(a1, a2).invert());
  }
  /** Where the ankle must be so that the given face of the foot touches a ball centred at C. */
  ankleForBall(s, C, n, fwd, face) {
    const R = this.rest[s];
    const q = this.footQuat(s, n, fwd, face);
    let off;           // ball centre relative to the ankle, in foot-local coordinates
    if (face === 'inside') off = R.sole.fwd.clone().multiplyScalar(0.06).add(R.sole.left.clone().multiplyScalar((s === 'R' ? 1 : -1) * 0.122));
    else if (face === 'outside') off = R.sole.fwd.clone().multiplyScalar(0.06).add(R.sole.left.clone().multiplyScalar((s === 'R' ? -1 : 1) * 0.122));
    else if (face === 'sole') off = R.sole.up.clone().multiplyScalar(-0.14);
    else off = R.sole.fwd.clone().multiplyScalar(0.09).add(R.sole.up.clone().multiplyScalar(0.142));
    return C.clone().sub(off.applyQuaternion(q));
  }
  /** World position of the contact surface of the given foot face (the point that touches the ball surface), for verification. */
  footContactPoint(s, face) {
    const R = this.rest[s], f = this.b[s].foot;
    let off;
    if (face === 'inside') off = R.sole.fwd.clone().multiplyScalar(0.06).add(R.sole.left.clone().multiplyScalar((s === 'R' ? 1 : -1) * 0.122));
    else if (face === 'outside') off = R.sole.fwd.clone().multiplyScalar(0.06).add(R.sole.left.clone().multiplyScalar((s === 'R' ? -1 : 1) * 0.122));
    else if (face === 'sole') off = R.sole.up.clone().multiplyScalar(-0.14);
    else off = R.sole.fwd.clone().multiplyScalar(0.09).add(R.sole.up.clone().multiplyScalar(0.142));
    return f.getWorldPosition(V()).add(off.applyQuaternion(f.getWorldQuaternion(Q())));
  }
  _aimFoot(s, T, F) {
    const B = this.b[s];
    const fwd = T.aim.fwd ? this.dirToWorld(T.aim.fwd, T.f || 'g', F) : V(0, 0, 1).applyQuaternion(F.yawQ);
    const n = this.dirToWorld(T.aim.n, T.f || 'g', F);
    const q = this.footQuat(s, n, fwd, T.aim.face || 'instep');
    const aw = T.aim.w ?? 1;
    const cur = B.foot.getWorldQuaternion(Q());
    setBoneWorldQuat(B.foot, cur.slerp(q, aw));
  }
  _solveArm(s, T, F) {
    const B = this.b[s];
    const tgt = this.toWorld(T.p, T.f || 'b', F);
    const sh = B.up.getWorldPosition(V());
    const pole = T.pole ? this.dirToWorld(T.pole, T.pf || T.f || 'b', F) : V(0, -1, -0.3).applyQuaternion(F.bq);
    const mid = sh.clone().add(tgt).multiplyScalar(0.5);
    const poleP = mid.clone().add(pole.clone().multiplyScalar(0.6));
    solveTwoBone(B.up, B.fore, B.hand, tgt, { weight: T.w, pole: poleP });
    if (T.hq) { /* optional absolute hand orientation not used */ }
  }
  _look(target, w, add, F) {
    const B = this.b;
    if (!this._headFwdLocal) this._initHead();
    const hp = B.head.getWorldPosition(V());
    const dir = target.clone().sub(hp).normalize();
    const chestFwd = V(0, 0, 1).applyQuaternion(F.bq);
    const ang = chestFwd.angleTo(dir);
    let d = dir;
    if (ang > 1.2) d = chestFwd.clone().lerp(dir, 1.2 / ang).normalize();
    const cur = this._headFwdLocal.clone().applyQuaternion(B.head.getWorldQuaternion(Q()));
    const full = Q().setFromUnitVectors(cur, d);
    const part = (f) => Q().slerp(full, f * w);
    rotateBoneWorld(B.spine2, part(0.12));
    rotateBoneWorld(B.neck, part(0.35));
    const cur2 = this._headFwdLocal.clone().applyQuaternion(B.head.getWorldQuaternion(Q()));
    rotateBoneWorld(B.head, Q().setFromUnitVectors(cur2, d).slerp(Q(), 1 - w));
  }
  _initHead() { this._headFwdLocal = this.h.look.fwdLocal.clone(); }
}

// quaternion whose rotation maps (1,0,0)->a (normalised), and (0,1,0)-ish -> perpendicular part of b; i.e. an orthonormal basis (a, y, z)
function basisQ(a, b) {
  const x = a.clone().normalize();
  const z = x.clone().cross(b).normalize();   // a x b
  const y = z.clone().cross(x).normalize();
  // rotation matrix with columns x,y,z -> quaternion
  const m00 = x.x, m10 = x.y, m20 = x.z, m01 = y.x, m11 = y.y, m21 = y.z, m02 = z.x, m12 = z.y, m22 = z.z;
  const tr = m00 + m11 + m22;
  const q = new THREE.Quaternion();
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q.set((m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s); }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q.set(0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s); }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q.set((m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s); }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q.set((m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s); }
  return q.normalize();
}
