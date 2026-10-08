// A procedural pose layer for the table-tennis athletes. It runs AFTER human.update(dt): it anchors the pelvis (crouch, lean), turns
// the torso (bend, side, twist), plants both feet with two-bone IK (feet are locked to the floor and take small shuffle steps),
// and solves both arms with two-bone IK against world targets, with elbow pole vectors and an ABSOLUTE hand orientation so the
// paddle face points where the stroke goes. If a hand target is farther than the arm can reach, the whole body is shifted toward
// it so the paddle still meets the ball point exactly. Everything here is presentation: it reads the published state only.
import { THREE } from '../vendor3d/index.js';
import { solveTwoBone } from '../vendor3d/rig.js';

const T = THREE;
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const Q = () => new T.Quaternion();
const UP = V(0, 1, 0);
const D2R = Math.PI / 180;
const _q = Q(), _q2 = Q();

function rotateBoneWorld(bone, q) {
  bone.parent.getWorldQuaternion(_q);
  bone.getWorldQuaternion(_q2).premultiply(q);
  bone.quaternion.copy(_q.invert().multiply(_q2));
  bone.updateWorldMatrix(false, true);
}
function setBoneWorldQuat(bone, q) {
  bone.parent.getWorldQuaternion(_q);
  bone.quaternion.copy(_q.invert().multiply(q));
  bone.updateWorldMatrix(false, true);
}

export class Actor {
  constructor(human) {
    this.h = human;
    const b = human.bones, g = (n) => b[`Bip01_${n}`];
    this.b = {
      pelvis: g('Pelvis'), spine: g('Spine'), spine1: g('Spine1'), spine2: g('Spine2'), neck: g('Neck'), head: g('Head'),
      L: { up: g('L_UpperArm'), fore: g('L_Forearm'), hand: g('L_Hand'), thigh: g('L_Thigh'), calf: g('L_Calf'), foot: g('L_Foot') },
      R: { up: g('R_UpperArm'), fore: g('R_Forearm'), hand: g('R_Hand'), thigh: g('R_Thigh'), calf: g('R_Calf'), foot: g('R_Foot') },
    };
    human.root.updateMatrixWorld(true);
    this.rest = {};
    for (const s of ['L', 'R']) {
      const B = this.b[s];
      this.rest[s] = { ankleY: B.foot.getWorldPosition(V()).y, footQ: B.foot.getWorldQuaternion(Q()), armLen: this._len(B.up, B.fore, B.hand), legLen: this._len(B.thigh, B.calf, B.foot) };
    }
    this.out = { shift: 0, handErr: 0 };
  }
  _len(a, m, e) { const pa = a.getWorldPosition(V()), pm = m.getWorldPosition(V()), pe = e.getWorldPosition(V()); return pa.distanceTo(pm) + pm.distanceTo(pe); }

  /**
   * P = { yaw (rad), x, z (pelvis position on the floor), crouch (m), torso: {bend, side, twist} (deg, body frame: + bend leans forward,
   *       + side leans to the body's left, + twist turns left), feet: { L: Vector3|null, R: Vector3|null },
   *       arms: { R: {p: Vector3, hq: Quaternion|null, pole: Vector3 (direction, world), w}, L: {...} } }
   */
  apply(P) {
    const h = this.h, root = h.root, B = this.b;
    const yawQ = Q().setFromAxisAngle(UP, P.yaw);
    this.out.shift = 0;
    const run = (dx, dz) => {
      root.quaternion.copy(yawQ); root.position.set(0, 0, 0); root.updateMatrixWorld(true);
      const pw = B.pelvis.getWorldPosition(V());
      root.position.set(P.x + dx - pw.x, -P.crouch, P.z + dz - pw.z);
      root.updateMatrixWorld(true);
      const axL = V(1, 0, 0).applyQuaternion(yawQ), axU = UP, axF = V(0, 0, 1).applyQuaternion(yawQ);
      const rot = (bone, ax, deg) => { if (Math.abs(deg) > 1e-4) rotateBoneWorld(bone, Q().setFromAxisAngle(ax, deg * D2R)); };
      const tr = P.torso;
      if (tr) for (const [bone, f] of [[B.spine, 0.30], [B.spine1, 0.38], [B.spine2, 0.32]]) { rot(bone, axL, (tr.bend || 0) * f); rot(bone, axF, -(tr.side || 0) * f); rot(bone, axU, (tr.twist || 0) * f); }
      root.updateMatrixWorld(true);
    };
    run(0, 0);
    // reach fix: if the striking hand is beyond the arm's length, move the whole body toward the target
    const A = P.arms && P.arms.R;
    if (A && A.w > 0.5) {
      const sh = B.R.up.getWorldPosition(V()), maxA = this.rest.R.armLen * 0.97, dd = sh.distanceTo(A.p);
      if (dd > maxA) {
        const d = A.p.clone().sub(sh); d.y = 0;
        const need = Math.min(0.32, dd - maxA);
        if (d.lengthSq() > 1e-6) { d.normalize().multiplyScalar(need); this.out.shift = need; run(d.x, d.z); }
      }
    }
    // legs: planted feet
    for (const s of ['L', 'R']) {
      const tgt = P.feet && P.feet[s];
      if (!tgt) continue;
      const Bs = B[s], hip = Bs.thigh.getWorldPosition(V());
      const fwd = V(0, 0, 1).applyQuaternion(yawQ), left = V(1, 0, 0).applyQuaternion(yawQ);
      const mid = hip.clone().add(tgt).multiplyScalar(0.5);
      const pole = mid.add(fwd.multiplyScalar(0.55)).add(left.multiplyScalar(s === 'L' ? 0.08 : -0.08));
      solveTwoBone(Bs.thigh, Bs.calf, Bs.foot, tgt, { weight: 1, pole });
      setBoneWorldQuat(Bs.foot, yawQ.clone().multiply(this.rest[s].footQ));
    }
    root.updateMatrixWorld(true);
    // arms
    for (const s of ['R', 'L']) {
      const a = P.arms && P.arms[s];
      if (!a || a.w <= 0) continue;
      const Bs = B[s], sh = Bs.up.getWorldPosition(V());
      const mid = sh.clone().add(a.p).multiplyScalar(0.5);
      solveTwoBone(Bs.up, Bs.fore, Bs.hand, a.p, { weight: a.w, pole: mid.add(a.pole.clone().normalize().multiplyScalar(0.6)) });
      if (a.hq) h._setHandWorld(s, this._limitWrist(s, a.hq));
    }
    root.updateMatrixWorld(true);
    this.out.handErr = P.arms && P.arms.R ? B.R.hand.getWorldPosition(V()).distanceTo(P.arms.R.p) : 0;
  }

  // keep the wrist inside human limits: the hand axis may not bend more than `max` radians away from the forearm axis
  _limitWrist(s, hq) {
    const fr = this.h.fingers[s];
    if (!fr || !fr.ok) return hq;
    const B = this.b[s];
    const fa = B.hand.getWorldPosition(V()).sub(B.fore.getWorldPosition(V())).normalize();
    const fd = fr.fingerDir.clone().normalize().applyQuaternion(hq);
    const ang = fa.angleTo(fd), max = 1.05;       // about 60 degrees (flexion, extension and deviation combined)
    if (ang <= max) return hq;
    const target = fa.clone().lerp(fd, max / ang).normalize();
    // rotate hq so its finger axis becomes `target`
    return Q().setFromUnitVectors(fd, target).multiply(hq);
  }
}
