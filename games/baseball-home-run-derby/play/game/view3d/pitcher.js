// The pitcher (a right-hander). A pose is a pure function of tau = seconds relative to the release (negative = set, leg lift, stride; positive =
// follow-through) and the sim's release point, so the ball leaves the hand exactly where and when the sim says.
// World frame: the pitcher stands on the mound at z = -PITCH_Z facing +z (the plate); yaw 0 = facing the plate; left = +x.
//
// Phases: SET (ball in the glove at the belt) -> LEG LIFT (front knee to the belt, hands at the chest, coiled side-on) -> STRIDE (front foot reaches
// toward the plate, hands break: glove arm out, throwing arm back) -> FOOT PLANT and ARM ACCELERATION (hips open, elbow leads, hand over the top)
// -> RELEASE (the sim's release point) -> FOLLOW-THROUGH (arm sweeps across to the left knee, trunk folds, back leg swings through) -> field ready.
import { quatFromBasis } from './rig.js';
import { V3, Quat, D2R, clamp, lerp, smooth, UP, ramp, rampL, fvec, lvec, comb, norm, nlerp, K } from './util3.js';

export const WINDUP = 1.5;
const ARM = 0.60;

export function pitcherPose(ctx, rig, out = {}) {
  const tau = ctx.tau, rel = ctx.rel, mound = ctx.mound, s = 1;
  const zr = rel.z;                                     // world z of the release point
  const z0 = ctx.z0;                                    // world z of the rubber
  const A = rig.ankleH + mound;                         // ankle height on the rubber
  const gA = rig.ankleH + 0.10;                         // ankle height at the plant (the mound slopes away)
  // ---- body line and root path (world z) ------------------------------------------------------------------------------------------------------
  const zPel = K(tau, [[-1.5, z0 - 0.02], [-1.0, z0 - 0.06], [-0.55, z0 - 0.04], [-0.3, z0 + 0.35], [-0.12, z0 + 1.15], [0, z0 + 1.55], [0.15, z0 + 1.75], [0.4, z0 + 1.9], [1.0, z0 + 1.95]]);
  const xPel = rel.x + 0.20;                            // the throwing shoulder sits 0.2 m outside the pelvis
  const yPel = K(tau, [[-1.5, mound + 0.90], [-1.1, mound + 0.89], [-0.7, mound + 0.92], [-0.5, mound + 0.90], [-0.3, mound + 0.85], [-0.1, 0.10 + 0.83], [0.1, 0.10 + 0.80], [0.4, 0.10 + 0.84], [1.0, 0.10 + 0.9]]);
  const yawP = K(tau, [[-1.5, 0], [-1.1, -4], [-0.75, -50], [-0.4, -82], [-0.2, -82], [-0.1, -45], [0, 8], [0.2, 32], [0.5, 22], [1.0, 8]]) * D2R;
  const yawS = K(tau, [[-1.5, 0], [-0.4, -6], [-0.15, -30], [-0.03, -5], [0.05, 18], [0.2, 20], [0.5, 8], [1.0, 0]]) * D2R;
  const pitch = K(tau, [[-1.5, 3], [-1.0, 2], [-0.6, -5], [-0.3, 2], [-0.1, 14], [0, 30], [0.12, 52], [0.3, 46], [0.7, 22], [1.0, 8]]) * D2R;
  const roll = K(tau, [[-0.5, 0], [-0.15, 8], [-0.02, -4], [0.1, -10], [0.4, -4], [1.0, 0]]) * D2R;
  const pelvisPos = new V3(xPel, yPel, zPel);
  // ---- feet ----------------------------------------------------------------------------------------------------------------------------------------
  // front (left) foot: on the rubber, lifts to the belt, reaches out and plants
  const lf0 = new V3(xPel + 0.12, A, z0 + 0.02);
  const plant = new V3(rel.x + 0.30, gA, z0 + 1.78);
  let lf, lfYaw = 0, lfPitch = 0;
  if (tau < -1.05) lf = lf0.clone();
  else if (tau < -0.55) { const u = smooth(ramp(tau, -1.05, -0.6)); lf = lf0.clone().lerp(new V3(xPel + 0.04, A + 0.88, z0 + 0.22), u); lfYaw = -0.7 * u; lfPitch = -0.5 * u; }
  else if (tau < -0.12) { const u = ramp(tau, -0.55, -0.12); const pk = new V3(xPel + 0.04, A + 0.88, z0 + 0.22); lf = pk.clone().lerp(plant, smooth(u)); lf.y = lerp(pk.y, gA, smooth(Math.pow(u, 1.5))) + 0.10 * Math.sin(Math.PI * u); lfYaw = lerp(-0.7, -0.25, u); lfPitch = lerp(-0.5, -0.25, u); }
  else { lf = plant.clone(); lfYaw = -0.25 + 0.2 * ramp(tau, -0.1, 0.4); }
  // back (right) foot: pivots on the rubber, heel rising, then swings through
  const rf0 = new V3(xPel - 0.14, A, z0 - 0.05);
  let rf = rf0.clone(), rfYaw = -0.4 * ramp(tau, -1.1, -0.6), rfPitch = 0;
  if (tau > -0.14) { rfPitch = 0.7 * ramp(tau, -0.14, 0.06); }
  if (tau > 0.06) { const u = smooth(ramp(tau, 0.06, 0.34)); rf = rf0.clone().lerp(new V3(rel.x + 0.0, gA, z0 + 1.6), u); rf.y = lerp(A, gA, u) + 0.20 * Math.sin(Math.PI * u); rfPitch = 0.7 * (1 - u); rfYaw = lerp(-0.4, 0.1, u); }
  const kneeL = lf.clone().add(new V3(0.0, 0.55, 0.55)); kneeL.x += 0.1;
  const kneeR = rf.clone().add(new V3(-0.15, 0.5, 0.5));
  const spec = {
    x: pelvisPos.x, z: pelvisPos.z, yaw: yawP, y: 0,
    pelvis: { pos: pelvisPos, yaw: 0 },
    spine: { yaw: yawS, pitch, roll },
    feet: { L: { p: lf, yaw: lfYaw, pitch: lfPitch, pole: kneeL, w: 1 }, R: { p: rf, yaw: rfYaw, pitch: rfPitch, pole: kneeR, w: 1 } },
    hands: {}, fingers: { R: 'ballGrip', L: 'relaxed' },
    head: { target: new V3(0, 1.1, 0), weight: 1, maxYaw: 1.5, maxPitch: 0.7 },
  };
  out.spec = spec; out.psiC = yawP + yawS; out.pelvisPos = pelvisPos;
  return out;
}

/** Arms: called once the torso is posed (so the shoulder positions are real). Writes spec.hands. */
export function pitcherArms(ctx, rig, st) {
  const tau = ctx.tau, rel = ctx.rel;
  const sr = rig.arm.R.up.getWorldPosition(new V3()), sl = rig.arm.L.up.getWorldPosition(new V3());
  const head = rig.head.getWorldPosition(new V3());
  const arm = (rig.len.upperArm + rig.len.foreArm) * 0.985;
  const psi = st.psiC, f = fvec(psi), l = lvec(psi);
  const fwd = new V3(0, 0, 1);
  // chest point where the hands meet during the lift
  const chest = sr.clone().lerp(sl, 0.5).addScaledVector(f, 0.20).addScaledVector(UP, -0.28);
  const belt = sr.clone().lerp(sl, 0.5).addScaledVector(f, 0.22).addScaledVector(UP, -0.62);
  // throwing arm: swing angle beta from vertical-up in the plane of the throw
  const beta = K(tau, [[-0.30, -118], [-0.20, -108], [-0.10, -70], [-0.04, -25], [0, 14], [0.06, 42], [0.16, 88], [0.30, 128], [0.55, 150]]) * D2R;
  const sway = new V3(-0.05, 0, 0);
  const swing = sr.clone().addScaledVector(fwd, Math.sin(beta) * arm).addScaledVector(UP, Math.cos(beta) * arm).add(sway.clone().multiplyScalar(Math.cos(beta)));
  const cocked = sr.clone().addScaledVector(fwd, -0.38).addScaledVector(UP, -0.05).addScaledVector(new V3(-1, 0, 0), 0.12);
  let handR;
  if (tau < -0.62) handR = tau < -1.0 ? belt.clone() : belt.clone().lerp(chest, smooth(ramp(tau, -1.0, -0.65)));
  else if (tau < -0.36) handR = chest.clone().lerp(sr.clone().addScaledVector(fwd, -0.15).addScaledVector(UP, -0.62), smooth(ramp(tau, -0.62, -0.36)));       // hands break: ball hand drops
  else if (tau < -0.30) handR = sr.clone().addScaledVector(fwd, -0.15).addScaledVector(UP, -0.62).lerp(cocked, smooth(ramp(tau, -0.36, -0.30)));
  else handR = swing.clone();
  if (tau >= -0.36 && tau < -0.30) { /* the break into the swing plane */ }
  if (tau >= -0.30 && tau < -0.12) handR.lerp(cocked.clone().addScaledVector(UP, 0.0), 0.0);
  // exact release: the ball centre is the sim's release point at tau = 0
  const fr = rig.h.fingers.R;
  const ballLocal = fr.knuckle.clone().multiplyScalar(0.45).addScaledVector(fr.palmDir, 0.038);
  const relW = rel.clone();
  const F = norm(new V3(0, 1, 0.45)), Pw = norm(new V3(0, -0.5, 1));
  const Qrel = handBasis(fr, F, Pw);
  const relHand = relW.clone().sub(ballLocal.clone().applyQuaternion(Qrel));
  const wFix = ramp(tau, -0.09, -0.005) * (1 - ramp(tau, 0.0, 0.07));
  const rTarget = handR.clone().lerp(relHand, wFix);
  const elbowR = sr.clone().addScaledVector(new V3(-1, 0, 0), 0.5).addScaledVector(fwd, -0.1).add(new V3(0, -0.05, 0));
  const hands = {};
  hands.R = { p: rTarget, pole: elbowR, q: tau > -0.12 && tau < 0.08 ? Qrel : null, clav: 1, fix: tau > -0.08 && tau < 0.02 ? { local: ballLocal, world: relW, k: ramp(tau, -0.08, -0.01) } : null };
  // glove arm: with the ball hand during the lift, then out toward the plate, then tucked at the chest at release and down after
  const aim = sl.clone().addScaledVector(fwd, 0.50).addScaledVector(UP, 0.18).addScaledVector(new V3(0.12, 0, 0), 1);
  const tuck = sl.clone().addScaledVector(f, 0.18).addScaledVector(UP, -0.28);
  const down = sl.clone().addScaledVector(new V3(0.05, 0, 0.1), 1).addScaledVector(UP, -0.50);
  let handL;
  if (tau < -0.62) handL = tau < -1.0 ? belt.clone().addScaledVector(l, 0.0) : belt.clone().lerp(chest, smooth(ramp(tau, -1.0, -0.65)));
  else if (tau < -0.12) handL = chest.clone().lerp(aim, smooth(ramp(tau, -0.55, -0.28)));
  else if (tau < 0.12) handL = aim.clone().lerp(tuck, smooth(ramp(tau, -0.12, 0.0)));
  else handL = tuck.clone().lerp(down, smooth(ramp(tau, 0.12, 0.5)));
  hands.L = { p: handL, pole: sl.clone().addScaledVector(new V3(1, 0, 0), 0.4).addScaledVector(UP, -0.1), q: null, clav: 1 };
  st.spec.hands = hands;
  return st;
}

function handBasis(fr, F, P) {
  const fl = fr.fingerDir.clone().normalize(), pl = fr.palmDir.clone().normalize();
  const cl = fl.clone().cross(pl).normalize();
  const fw = F.clone().normalize(), pw0 = P.clone().sub(fw.clone().multiplyScalar(P.dot(fw))).normalize();
  const cw = fw.clone().cross(pw0).normalize();
  const qLocal = quatFromBasis(fl, pl, cl);
  const qWorld = quatFromBasis(fw, pw0, cw);
  return qWorld.multiply(qLocal.invert());
}
export { handBasis };
