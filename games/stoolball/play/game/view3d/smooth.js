// Pose smoothing by inertialization. The shared rig evaluates clips and then solves IK in the same frame; when a clip starts or stops,
// or an IK target engages, a joint can jump in ONE frame (the arms hand-off of a throw, a catch reach, a prop track). This module watches
// each joint's TARGET stream (what the rig just produced); when the target jumps by much more than its recent per-frame change it
// captures the difference as an offset and lets that offset die away with a critically damped spring, so the displayed joint keeps its
// last velocity and glides into the new pose. Outside of a jump the offset is zero and the joint is shown exactly as posed: no lag, so
// contact and release times stay exactly on the simulation's times.
// Order every frame: stage.update(dt, { renderNow: false }) -> filter.apply(dt) -> stage.render().
const BONES = ['Pelvis', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'L_Clavicle', 'R_Clavicle', 'L_UpperArm', 'R_UpperArm', 'L_Forearm', 'R_Forearm', 'L_Hand', 'R_Hand',
  'L_Thigh', 'R_Thigh', 'L_Calf', 'R_Calf', 'L_Foot', 'R_Foot'];

const ARMS = new Set(['L_UpperArm', 'R_UpperArm', 'L_Forearm', 'R_Forearm', 'L_Hand', 'R_Hand']);
export function createPoseFilter(h, THREE, { omega = 11, jumpFactor = 1.9, minJump = 0.055, armRate = 0 } = {}) {
  const Q = THREE.Quaternion, V = THREE.Vector3;
  const joints = [];
  for (const n of BONES) {
    const b = h.bones[`Bip01_${n}`]; if (!b) continue;
    joints.push({ n, b, tp: new Q(), o: new Q(), ov: new V(), avg: 0.02, init: false, out: new Q(), sm: new Q(), arm: ARMS.has(n) });
  }
  const dq = new Q(), t1 = new Q(), axis = new V(), ex = new Q();
  // rotate quaternion by the small rotation vector r (|r| = angle)
  const expQ = (r, out) => { const a = r.length(); if (a < 1e-9) return out.set(0, 0, 0, 1); axis.copy(r).multiplyScalar(1 / a); return out.setFromAxisAngle(axis, a); };
  const logQ = (q, out) => { // q (w >= 0) -> rotation vector
    let { x, y, z, w } = q; if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
    const s = Math.sqrt(x * x + y * y + z * z); if (s < 1e-9) return out.set(0, 0, 0);
    const a = 2 * Math.atan2(s, w); return out.set(x / s * a, y / s * a, z / s * a);
  };
  const lv = new V(), lv2 = new V();
  const F = {
    pops: 0,
    joints,
    armRate,                       // > 0: a light exponential low-pass on the arms (the hand-on-prop solver dithers by a centimetre)
    reset() { for (const j of joints) { j.init = false; j.o.identity(); j.ov.set(0, 0, 0); } },
    apply(dt) {
      if (!(dt > 0)) { for (const j of joints) if (j.init) j.b.quaternion.copy(j.out); return; }
      for (const j of joints) {
        const t = j.b.quaternion;                     // the pose the rig just produced
        if (!j.init) { j.tp.copy(t); j.o.identity(); j.ov.set(0, 0, 0); j.init = true; j.out.copy(t); continue; }
        // how far did the target itself move this frame?
        dq.copy(t).multiply(t1.copy(j.tp).invert()); logQ(dq, lv); const delta = lv.length();
        if (delta > Math.max(minJump, jumpFactor * j.avg + 0.02)) {
          // jump: keep showing what we showed last frame: o' * t = previous output  =>  o' = out_prev * t^-1
          j.o.copy(j.out).multiply(t1.copy(t).invert()); F.pops++;
        } else j.avg = j.avg * 0.9 + delta * 0.1;
        j.tp.copy(t);
        // critically damped decay of the offset towards identity (exact over small substeps)
        const steps = Math.max(1, Math.ceil(dt / 0.008)), h2 = dt / steps;
        logQ(j.o, lv);                                // offset as a rotation vector
        for (let s = 0; s < steps; s++) {
          lv2.copy(lv).multiplyScalar(-omega * omega).addScaledVector(j.ov, -2 * omega);
          j.ov.addScaledVector(lv2, h2); lv.addScaledVector(j.ov, h2);
        }
        if (lv.length() < 1e-4 && j.ov.length() < 1e-3) { j.o.identity(); j.ov.set(0, 0, 0); lv.set(0, 0, 0); } else expQ(lv, j.o);
        j.out.copy(j.o).multiply(t); j.out.normalize();
        if (j.arm && F.armRate > 0) { const k = 1 - Math.exp(-F.armRate * dt); if (!j.smInit) { j.sm.copy(j.out); j.smInit = true; } else j.sm.slerp(j.out, k); j.b.quaternion.copy(j.sm); }
        else { j.smInit = false; j.b.quaternion.copy(j.out); }
      }
    },
  };
  return F;
}
