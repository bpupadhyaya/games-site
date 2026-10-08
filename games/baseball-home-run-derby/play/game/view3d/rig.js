// Target-driven pose engine on top of the vendored Human. Every frame a presenter hands it a plain "pose spec"
// in WORLD coordinates (pelvis position, torso twist/lean, foot and hand targets, head look target). The base clip
// (a mocap loop or a frozen stance frame) supplies the natural spine curve and fingers; legs and arms are solved by
// two-bone IK, so contact points (foot on the ground, bat at the ball, ball in the hand) are exact by construction.
// Nothing here advances a clock: the same spec always gives the same pose (pause, replay and screenshots just work).
import { THREE } from '../vendor3d/index.js';
import { solveTwoBone } from '../vendor3d/rig.js';

export const V3 = THREE.Vector3;
export const Quat = THREE.Quaternion;
const Matrix4 = new THREE.Group().matrix.constructor;
const _m = new Matrix4();

const UP = new V3(0, 1, 0);
const qa = new Quat(), qb = new Quat(), qc = new Quat(), qd = new Quat();
const va = new V3(), vb = new V3(), vc = new V3(), vd = new V3();

export const D2R = Math.PI / 180;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };

/** Quaternion from three orthonormal axes (columns). */
export function quatFromBasis(x, y, z, out = new Quat()) { _m.makeBasis(x, y, z); return out.setFromRotationMatrix(_m); }

/** Yaw (about +Y) quaternion. Avatar facing = (sin yaw, 0, cos yaw). */
export function yawQ(a, out = new Quat()) { return out.setFromAxisAngle(UP, a); }
export const facingVec = (yaw, out = new V3()) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
export const leftVec = (yaw, out = new V3()) => out.set(Math.cos(yaw), 0, -Math.sin(yaw));

function rotWorld(bone, qDelta) {
  bone.parent.getWorldQuaternion(qa);
  bone.getWorldQuaternion(qb);
  qc.copy(qDelta).multiply(qb);
  bone.quaternion.copy(qa.invert().multiply(qc));
  bone.updateWorldMatrix(false, true);
}

export function setWorldQuat(bone, q) {
  bone.parent.getWorldQuaternion(qa);
  bone.quaternion.copy(qa.invert().multiply(q));
  bone.updateWorldMatrix(false, true);
}

const BONE = {
  pelvis: 'Bip01_Pelvis', spine: 'Bip01_Spine', spine1: 'Bip01_Spine1', spine2: 'Bip01_Spine2', neck: 'Bip01_Neck', head: 'Bip01_Head',
};

export class Rig {
  constructor(h) {
    this.h = h;
    const b = h.bones;
    this.b = b;
    h.footPlanting = false; h.groundClamp = 'off'; h.lookAt(null);
    this.pelvis = b.Bip01_Pelvis; this.spineChain = [b.Bip01_Spine, b.Bip01_Spine1, b.Bip01_Spine2];
    this.neck = b.Bip01_Neck; this.head = b.Bip01_Head;
    this.arm = { L: { clav: b.Bip01_L_Clavicle, up: b.Bip01_L_UpperArm, fore: b.Bip01_L_Forearm, hand: b.Bip01_L_Hand }, R: { clav: b.Bip01_R_Clavicle, up: b.Bip01_R_UpperArm, fore: b.Bip01_R_Forearm, hand: b.Bip01_R_Hand } };
    this.leg = { L: { thigh: b.Bip01_L_Thigh, calf: b.Bip01_L_Calf, foot: b.Bip01_L_Foot, toe: b.Bip01_L_Toe0 }, R: { thigh: b.Bip01_R_Thigh, calf: b.Bip01_R_Calf, foot: b.Bip01_R_Foot, toe: b.Bip01_R_Toe0 } };
    // rest-pose facts (root at identity): flat foot orientation, limb lengths, ankle height
    const sp = { pos: h.root.position.clone(), rot: h.root.rotation.y };
    h.root.position.set(0, 0, 0); h.root.rotation.y = 0;
    h._writePose(h.restPose, true);
    h.root.updateMatrixWorld(true);
    this.footRestQ = { L: this.leg.L.foot.getWorldQuaternion(new Quat()), R: this.leg.R.foot.getWorldQuaternion(new Quat()) };
    const P = (o) => o.getWorldPosition(new V3());
    this.len = {
      thigh: P(this.leg.L.thigh).distanceTo(P(this.leg.L.calf)), calf: P(this.leg.L.calf).distanceTo(P(this.leg.L.foot)),
      upperArm: P(this.arm.L.up).distanceTo(P(this.arm.L.fore)), foreArm: P(this.arm.L.fore).distanceTo(P(this.arm.L.hand)),
    };
    { const hq = this.head.getWorldQuaternion(new Quat()).invert(); this.headFwdLocal = new V3(0, 0, 1).applyQuaternion(hq); this.headUpLocal = new V3(0, 1, 0).applyQuaternion(hq); }
    this.ankleH0 = Math.max(0.06, P(this.leg.L.foot).y);
    this.toeFwd = P(this.leg.L.toe).sub(P(this.leg.L.foot)); // ankle -> toe-bone offset at rest (character space)
    this.footLen = { heel: 0.09, toe: 0.17 };
    h.root.position.copy(sp.pos); h.root.rotation.y = sp.rot;
    this.tracks = new Map();
    this.noLower = true;   // only clips played without foot IK may be lowered onto the ground (fielders, keeper)
    this.ground = 0;
    this.lastErr = { foot: { L: 0, R: 0 }, hand: { L: 0, R: 0 } };
  }

  /** Ankle height above the ground for a flat foot, scaled with the avatar's size. */
  get ankleH() { return this.ankleH0 * this.h.root.scale.x; }

  /** Set the base pose from one or more weighted clips: [{clip, time, w}] (w sums to 1). */
  setBase(list) {
    const layer = this.h.layers.base;
    const out = [];
    for (const it of list) {
      let tr = this.tracks.get(it.clip);
      if (!tr) {
        const clip = this.h.getClip(it.clip);
        tr = { clip, time: 0, speed: 0, loop: false, weight: 1, target: 1, fadeRate: Infinity, rate: 1, rateTarget: 1, warp: null, done: false, onDone: null, lastT: -1, finished: false };
        this.tracks.set(it.clip, tr);
      }
      const d = tr.clip.dur;
      tr.time = tr.clip.loop ? (((it.time % d) + d) % d) : clamp(it.time, 0, d);
      tr.weight = tr.target = it.w ?? 1;
      if (tr.weight > 0) out.push(tr);
    }
    layer.tracks = out;
    this.h._applyClipFingers(out[out.length - 1].clip);
  }

  /** The whole pose. spec fields are all optional except x,z,yaw. Angles in radians, positions in world metres. */
  solve(spec, dt = 1 / 120) {
    const h = this.h, root = h.root;
    root.position.set(spec.x, spec.y ?? 0, spec.z); root.rotation.y = spec.yaw; h.facing = spec.yaw;
    if (spec.fingers) { for (const s of ['L', 'R']) if (spec.fingers[s]) h.setFingers(s, spec.fingers[s], { rate: 1000 }); }
    h.update(dt);
    root.updateMatrixWorld(true);
    const yaw = spec.yaw;
    // --- pelvis
    const pv = spec.pelvis;
    if (pv) {
      if (pv.pos) { this.pelvis.getWorldPosition(va); vb.copy(pv.pos).sub(va).multiplyScalar(pv.w ?? 1); this._movePelvis(vb); }
      if (pv.yaw || pv.pitch || pv.roll) this._rotFrame(this.pelvis, yaw, pv.yaw || 0, pv.pitch || 0, pv.roll || 0);
    }
    // --- spine
    const sp = spec.spine;
    if (sp && (sp.yaw || sp.pitch || sp.roll)) {
      const w = sp.w || [0.28, 0.34, 0.38];
      const yawN = yaw + (pv?.yaw || 0);
      for (let i = 0; i < 3; i++) this._rotFrame(this.spineChain[i], yawN, (sp.yaw || 0) * w[i], (sp.pitch || 0) * w[i], (sp.roll || 0) * w[i]);
    }
    // --- head and neck first: the look-at also turns spine2, which carries the shoulders and arms
    if (spec.head) this._head(spec.head, yaw + (pv?.yaw || 0));
    // --- legs (before arms: the arms hang off the torso, which the legs do not move)
    if (spec.feet) for (const s of ['L', 'R']) if (spec.feet[s]) this._foot(s, spec.feet[s]);
    // --- arms (a presenter can derive the targets from the real shoulder positions once the torso is posed)
    if (spec.arms) spec.hands = spec.arms(this, spec) || spec.hands;
    if (spec.hands) for (const s of ['L', 'R']) if (spec.hands[s]) this._hand(s, spec.hands[s]);
    if (spec.after) spec.after(this);
    this.groundFix();
    root.updateMatrixWorld(true);
  }

  /** Lift the whole body so no toe is below the ground (instant: the vendored clamp eases over time, which a stateless pose cannot use). */
  groundFix() {
    const h = this.h; h.model.position.y = 0; h.root.updateMatrixWorld(true);
    let lo = Infinity;
    for (const s of ['L', 'R']) { this.leg[s].toe.getWorldPosition(vb); lo = Math.min(lo, vb.y); }
    const need = 0.006 + this.ground - lo;
    const cur = h.layers.base.current;
    const grounded = !cur || cur.clip.grounded !== false;
    if (need > 0) { h.model.position.y = need; h.root.updateMatrixWorld(true); }
    else if (need < 0 && grounded && !this.noLower) { h.model.position.y = Math.max(-0.25, need); h.root.updateMatrixWorld(true); }
  }

  /** Clamp both wrists to a human range (used after the second hand of a two-handed grip is placed). */
  limitWrists() { for (const s of ['L', 'R']) { const wl = this.h.wrists[s]; wl.twist = 1.45; wl.swing = 1.95; wl.apply(); this.arm[s].hand.updateWorldMatrix(false, true); } }

  _movePelvis(deltaW) {
    const p = this.pelvis;
    p.updateWorldMatrix(true, false);
    p.getWorldPosition(va);
    vc.copy(va).add(deltaW);
    p.parent.worldToLocal(vc);
    p.position.copy(vc);
    p.updateWorldMatrix(false, true);
  }

  // rotate bone by yaw (about world up), pitch (forward lean about the frame's left axis) and roll (about the frame's forward axis); frame = avatar yaw
  _rotFrame(bone, frameYaw, y, p, r) {
    const f = facingVec(frameYaw, vd), l = leftVec(frameYaw, vc);
    qd.identity();
    const q1 = new Quat().setFromAxisAngle(UP, y);
    const q2 = new Quat().setFromAxisAngle(l, p);
    const q3 = new Quat().setFromAxisAngle(f, r);
    qd.copy(q1).multiply(q2).multiply(q3);
    rotWorld(bone, qd);
  }

  _foot(side, t) {
    const L = this.leg[side];
    const target = t.p.clone();
    // foot orientation: yaw (toe direction) and heel lift pitch about the avatar-left axis
    const yawQ_ = new Quat().setFromAxisAngle(UP, t.yaw ?? 0);
    const lat = new V3(Math.cos(t.yaw ?? 0), 0, -Math.sin(t.yaw ?? 0));
    const pitchQ = new Quat().setFromAxisAngle(lat, t.pitch || 0);
    const fq = pitchQ.multiply(yawQ_).multiply(this.footRestQ[side]);
    const w = t.w ?? 1;
    if (w < 1) { L.foot.getWorldPosition(vb); target.copy(vb.clone().lerp(target, w)); L.foot.getWorldQuaternion(qa); fq.copy(qa).slerp(fq, w); }
    solveTwoBone(L.thigh, L.calf, L.foot, target, { pole: t.pole || null });
    setWorldQuat(L.foot, fq);
    // never let the toe go through the ground (a raised heel needs the ankle a little higher)
    L.toe.getWorldPosition(vb);
    if (vb.y < 0.008 + this.ground) {
      target.y += 0.008 + this.ground - vb.y;
      solveTwoBone(L.thigh, L.calf, L.foot, target, { pole: t.pole || null });
      setWorldQuat(L.foot, fq);
    }
    const e = L.foot.getWorldPosition(vb).distanceTo(target);
    this.lastErr.foot[side] = e;
  }

  /** Arm IK. t = { p: V3 target for the wrist, pole: V3 elbow hint, q: Quat desired hand world orientation (optional), clav: 0..1 } */
  _hand(side, t) {
    const A = this.arm[side];
    let target = t.p || A.hand.getWorldPosition(new V3());
    A.up.getWorldPosition(va);
    // shoulder girdle follows long reaches (clavicle), a little
    const reach = this.len.upperArm + this.len.foreArm;
    const d = va.distanceTo(target);
    const clav = t.clav ?? 1;
    if (clav > 0) {
      A.clav.getWorldPosition(vb);
      const need = clamp(d - reach * 0.62, 0, 0.16) * 0.5 * clav;
      const lift = clamp((target.y - va.y) * 0.10, -0.03, 0.06) * clav;
      vc.copy(target).sub(va); vc.y = 0; if (vc.lengthSq() > 1e-8) vc.normalize();
      vd.copy(va).addScaledVector(vc, need); vd.y += lift;
      const q = new Quat().setFromUnitVectors(va.clone().sub(vb).normalize(), vd.clone().sub(vb).normalize());
      rotWorld(A.clav, q);
    }
    const w = t.w ?? 1;
    let q = t.q;
    if (w < 1) { A.hand.getWorldPosition(vb); target = vb.clone().lerp(target, w); if (q) q = A.hand.getWorldQuaternion(new Quat()).slerp(q, w); }
    solveTwoBone(A.up, A.fore, A.hand, target, { pole: t.pole || null });
    if (q) this._handOrient(A, q);
    if (t.fix) {   // make a point in hand space (the ball in the fingers) land exactly on a world point
      for (let it = 0; it < 4; it++) {
        const pt = t.fix.local.clone().applyMatrix4(A.hand.matrixWorld);
        const err = t.fix.world.clone().sub(pt).multiplyScalar(t.fix.k ?? 1);
        if (err.length() < 0.002) break;
        target = target.clone().add(err);
        solveTwoBone(A.up, A.fore, A.hand, target, { pole: t.pole || null });
        if (q) this._handOrient(A, q);
      }
    }
    // keep every wrist inside a human range (candy-wrapper and snapped-back wrists are never allowed)
    { const wl = this.h.wrists[side]; wl.twist = 1.45; wl.swing = 1.95; wl.apply(); A.hand.updateWorldMatrix(false, true); }
    this.lastErr.hand[side] = A.hand.getWorldPosition(vb).distanceTo(target);
  }

  _handOrient(A, q) {
    // forearm roll (pronation/supination) takes most of the twist so the wrist never candy-wraps
    A.hand.getWorldQuaternion(qa);
    qb.copy(q).multiply(qc.copy(qa).invert()); // delta world
    A.hand.getWorldPosition(vb); A.fore.getWorldPosition(va);
    vc.copy(vb).sub(va).normalize();
    const w = qb.w < 0 ? -1 : 1;
    const sx = qb.x * w, sy = qb.y * w, sz = qb.z * w, cw = qb.w * w;
    const tw = 2 * Math.atan2(sx * vc.x + sy * vc.y + sz * vc.z, cw);
    const roll = clamp(tw * 0.8, -1.7, 1.7);
    rotWorld(A.fore, new Quat().setFromAxisAngle(vc.clone(), roll));
    setWorldQuat(A.hand, q);
  }

  // The vendored LookAt builds its target vector with a call that drops its arguments (platform request), so the
  // head/neck/chest look-at is done here: clamp the gaze to the avatar frame, then spread the turn over spine2/neck/head.
  _head(t, frameYaw) {
    if (t.target) {
      const w = t.weight ?? 1, maxYaw = t.maxYaw ?? 1.5, maxPitch = t.maxPitch ?? 0.8;
      this.head.getWorldPosition(va);
      const d = vc.copy(t.target).sub(va).normalize();
      const dirYaw = Math.atan2(d.x, d.z);
      let rel = dirYaw - frameYaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const relC = clamp(rel, -maxYaw, maxYaw);
      const pitch = clamp(Math.asin(clamp(d.y, -1, 1)), -maxPitch, maxPitch);
      const wantYaw = frameYaw + relC;
      const want = new V3(Math.sin(wantYaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(wantYaw) * Math.cos(pitch));
      const fl = this.headFwdLocal;
      const cur = () => fl.clone().applyQuaternion(this.head.getWorldQuaternion(qa));
      const ident = new Quat();
      const part = (c, f) => ident.clone().slerp(new Quat().setFromUnitVectors(c, want), f * w);
      rotWorld(this.spineChain[2], part(cur(), 0.15));
      rotWorld(this.neck, part(cur(), 0.35 / 0.85));
      rotWorld(this.head, part(cur(), 1));
      if (t.level !== false) this._levelHead(want);
    }
    if (t.tilt) { this._rotFrame(this.head, frameYaw, 0, 0, t.tilt); }
  }

  // keep the horizon level: remove head roll about the gaze axis (the minimal rotations above can leave a tilt)
  _levelHead(gaze) {
    const up = this.headUpLocal.clone().applyQuaternion(this.head.getWorldQuaternion(qa));
    const g = gaze.clone().normalize();
    const flat = new V3(0, 1, 0).addScaledVector(g, -g.y).normalize();
    const upP = up.addScaledVector(g, -up.dot(g)).normalize();
    const ang = Math.atan2(upP.clone().cross(flat).dot(g), upP.dot(flat));
    rotWorld(this.head, new Quat().setFromAxisAngle(g, clamp(ang, -0.5, 0.5)));
  }

  worldOf(boneName, out = new V3()) { this.b[boneName].getWorldPosition(out); return out; }
}
