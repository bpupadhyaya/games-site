// The bowler. A pose is a pure function of tau = seconds relative to the release (negative = run-up, bound and delivery stride,
// positive = follow-through) and the sim's release point, so the ball leaves the hand exactly where and when the sim says.
//
// Phases (fast, side-on): run-up (mocap sprint, speed-matched) -> take-off -> BOUND (knee of the leading leg high, ball at the chin
// in both hands, front arm up towards the batter) -> back-foot landing and COIL (side-on, chest to the side, head over the front
// shoulder, bowling arm cocked back) -> DELIVERY STRIDE (front foot braced) -> DELIVERY (bowling arm sweeps a full vertical arc past
// the ear, release at the top at the sim's point; the other arm pulled down and tucked) -> FOLLOW-THROUGH (trunk folds forward, arm
// across to the opposite hip, trailing leg swings through, two or three strides off the pitch) -> walk back.
// World frame: canonical (x = off side, bowler end at -z, the bowler faces +z = the batter). Yaw 0 = facing the batter.
import { quatFromBasis } from './rig.js';
import { V3, Quat, D2R, clamp, lerp, smooth, UP, ramp, rampL, fvec, lvec, comb, norm, nlerp, K, kV } from './util3.js';

export const VARIANTS = {
  // key times relative to the release (s)
  sideOn: { id: 'sideOn', run: 'sprint', vmax: 7.0, accel: 0.32, Tj: -0.40, Ta: -0.29, Tb: -0.16, Tf: -0.04, scale: 1.09, stride: 1.45, coil: -78, grip: 'seamGrip', up: 0.14 },
  frontOn: { id: 'frontOn', run: 'sprint', vmax: 7.0, accel: 0.32, Tj: -0.40, Ta: -0.29, Tb: -0.16, Tf: -0.04, scale: 1.09, stride: 1.35, coil: -22, grip: 'seamGrip', up: 0.12 },
  spin: { id: 'spin', run: 'jog', vmax: 4.0, accel: 0.25, Tj: -0.31, Ta: -0.22, Tb: -0.13, Tf: -0.035, scale: 1.0, stride: 0.95, coil: -40, grip: 'offBreak', up: 0.06 },
};

const ARM = 0.60;     // shoulder to the ball in the hand at full stretch (scaled by the avatar)

/**
 * ctx: { tau, variant, rel: V3 (release point, canonical world), L (pitch length), pt (time in the pre-delivery phases), idle (seconds, for sway),
 *        mode: 'mark' | 'run' | 'flight' | 'walk', walkT, legsFromMocap... }
 * rig: Rig of the bowler (root scale already set to variant.scale).
 */
export function bowlerPose(ctx, rig, out = {}) {
  const V = ctx.variant, s = ctx.scale ?? V.scale;
  const tau = ctx.tau;
  const rel = ctx.rel;
  const zr = -rel.z;                                // release z in sim terms (distance from the striker's stumps)
  const xl = rel.x + 0.20 * s;                       // body line: the bowling shoulder sits 0.2 m to the right of the pelvis (-x)
  const Tj = V.Tj, Ta = V.Ta, Tb = V.Tb, Tf = V.Tf;
  // geometry of the delivery stride (sim z)
  const zff = zr - 0.30 * s, zbf = zff + V.stride * s;
  const D2 = (t) => ramp(t, -1e9, 1e9);
  void D2;

  // ---------------- root path (sim z) --------------------------------------------------------------------------------------------------
  const runT = ctx.runT, tauStart = -runT;
  const vmax = V.vmax, ta = V.accel;
  const distRun = (t) => { const x = Math.max(0, t - tauStart); return vmax * (x < ta ? (x * x * (3 * ta - 2 * x) / (ta * ta * 3) * 0 + x - (x - x * x * (3 - 2 * x / ta) / ta) * 0 ) : 0); };
  void distRun;
  // run distance as the integral of v(t) = vmax * smoothstep(x/ta)
  const runDist = (x) => {
    if (x <= 0) return 0;
    if (x >= ta) return vmax * (ta / 2 + (x - ta));
    const u = x / ta;
    return vmax * ta * (u * u * u - 0.5 * u * u * u * u);
  };
  const DJ = runDist(Tj - tauStart);                      // distance run before take-off
  // pelvis z at take-off: the bound carries the body to the back-foot landing
  const zPelJ = zbf + 1.38 * s;                           // at take-off (behind the landing spot)
  const zMark = zPelJ + DJ;                               // run-up start
  const markX = xl;
  // follow-through: 3-4 short decelerating steps, one foot always on the ground; sim z of each foot as a function of tau
  const FT = {
    L: [[0.0, 0.30], [0.40, 1.55], [0.82, 3.0]],       // [landing time, distance past the release z (m)]
    R: [[0.20, 0.95], [0.60, 2.3], [1.02, 3.55]],
  };
  const stepFoot = (plants, from, tau2, hold, h) => {   // returns { d, lift } for tau2 >= the first leave time
    let d = from, lift = 0, t0 = -9;
    for (const [tl, dl] of plants) {
      const tLeave = Math.max(t0, tl - hold);
      if (tau2 < tLeave) break;
      if (tau2 < tl) { const u = (tau2 - tLeave) / (tl - tLeave); d = from + (dl - from) * smooth(u); lift = h * Math.sin(Math.PI * u); return { d, lift }; }
      from = dl; d = dl; t0 = tl;
    }
    return { d, lift };
  };
  // pelvis in the IK segment
  const pelZ = tau > 0.0 ? (() => {
    const l = stepFoot(FT.L, 0.30, tau, 0.26, 0.2), r = stepFoot(FT.R, -(zbf - zr), tau, 0.215, 0.24);
    return zr - (l.d + r.d) / 2 - 0.0 + 0.0;
  })() : kV(tau, [
    [Tj, new V3(0, 0, zPelJ)], [Ta, new V3(0, 0, lerp(zPelJ, zbf, 0.50))], [Tb, new V3(0, 0, zbf - 0.02 * s)], [Tf, new V3(0, 0, zr + 0.26 * s)], [0, new V3(0, 0, zr + 0.21)],
    [0.12, new V3(0, 0, zr - 0.30 * s)], [0.30, new V3(0, 0, zr - 1.05 * s)], [0.6, new V3(0, 0, zr - 2.0 * s)], [1.2, new V3(0, 0, zr - 3.2 * s)],
  ]).z;

  // ---------------- what the body does -------------------------------------------------------------------------------------------------------
  const H0 = rig.ankleH0 * s + 0.795 * s * 0.995 + 0.0;          // pelvis height with straight legs
  const hk = (t) => K(t, [[Tj, 0.9], [Ta, 0.98], [Tb, 0.90], [Tf, 0.84], [0, 0.87], [0.12, 0.83], [0.3, 0.83], [0.7, 0.85], [1.2, 0.87]]) * s;
  const yawP = K(tau, [[Tj, -8], [Ta, V.coil * 0.55], [Tb, V.coil], [Tf, V.coil * 0.62], [0, -10], [0.12, 28], [0.3, 12], [0.7, 0]]) * D2R;
  const yawS = K(tau, [[Tj, 0], [Ta, V.coil * 0.12], [Tb, V.coil * 0.2], [Tf, -4], [0, 26], [0.12, 14], [0.4, 0]]) * D2R;
  const pitch = K(tau, [[Tj, 7], [Ta, -9], [Tb, 1], [Tf, 16], [0, 36], [0.12, 56], [0.3, 48], [0.7, 20], [1.2, 6]]) * D2R * (V.id === 'spin' ? 0.55 : 1);
  const roll = K(tau, [[Tj, 0], [Ta, 2], [Tb, 5], [Tf, -6], [0, -13], [0.12, -6], [0.4, 0]]) * D2R;
  const xBody = xl + (tau > 0 ? 1.7 * smooth(tau / 1.3) : 0);
  // body line for the bound slightly towards the batter's leg side to keep the ball on its line; kept straight here
  const pelvisPos = new V3(xBody, hk(tau), -pelZ);

  // ---------------- feet ---------------------------------------------------------------------------------------------------------------------
  const A = rig.ankleH;
  const L = { x: xBody + 0.09 * s, z: 0 };
  // back (right) foot: take-off from the run line, trails during the bound, lands side-on at zbf, pivots, then swings through
  const rfPlant = new V3(xl - 0.16 * s, A, -zbf);
  const rPush = new V3(xl - 0.10 * s, A, -(zPelJ + 0.05));
  let rf, rfYaw, rfPitch = 0;
  if (tau < Tb) {
    const u = rampL(tau, Tj, Tb);
    rf = rPush.clone().lerp(rfPlant, smooth(u)); rf.y = A + 0.20 * Math.sin(Math.PI * Math.pow(u, 0.9)) * (1 - 0.15 * u);
    rfYaw = lerp(-0.3, V.coil * D2R, smooth(u)); rfPitch = (1 - u) * 0.6;
  } else if (tau < -0.015) {
    rf = rfPlant.clone(); rfYaw = V.coil * D2R * (1 - 0.6 * ramp(tau, Tf, 0.04)); rfPitch = 0.5 * ramp(tau, -0.06, -0.015);
  } else {
    // trailing leg swings through and lands ahead of the front foot, then alternate short steps
    const sw = stepFoot(FT.R, -(zbf - zr), tau, 0.215, 0.26);
    rf = new V3(xBody - 0.2 * s, A + sw.lift, -(zr - sw.d)); rfYaw = lerp(V.coil * D2R * 0.4, 0, ramp(tau, 0, 0.3)); rfPitch = sw.lift > 0 ? 0.5 : 0;
  }
  // front (left) foot: knee drive in the bound, reaches and lands heel first on a braced leg, stays planted, then steps through
  const lfLand = new V3(xl + 0.10 * s, A, -zff);
  let lf, lfYaw, lfPitch = 0;
  if (tau < Tf) {
    const u = rampL(tau, Tj, Tf);
    const apex = new V3(xl + 0.08 * s, A + 0.32 * s, -(zPelJ - 0.45 * s));            // knee high, shin hanging
    const reach = new V3(xl + 0.10 * s, A + 0.22 * s, -(zff + 0.55 * s));
    if (u < 0.45) { const k = smooth(u / 0.45); lf = new V3(xl + 0.07 * s, A + 0.1, -(zPelJ + 0.05)).lerp(apex, k); }
    else { const k = smooth((u - 0.45) / 0.55); lf = apex.clone().lerp(lfLand, k); lf.y = lerp(apex.y, A, k) + 0.12 * Math.sin(Math.PI * k) * 0.6; }
    lfYaw = lerp(0, -0.3, u); lfPitch = u < 0.9 ? -0.35 * (1 - u) : (1 - u) * -0.6;   // toes up on the way in (heel strike)
    void reach;
  } else {
    const st = stepFoot(FT.L, 0.30, tau, 0.26, 0.2);
    lf = new V3(lfLand.x + (xBody - xl) - 0.05, A + st.lift, -(zr - st.d));
    lfYaw = -0.3 + 0.3 * ramp(tau, 0, 0.3); lfPitch = st.lift > 0 ? 0.25 : 0;
  }

  // knee poles (knees point along the toes)
  const kneeR = rf.clone().add(new V3(Math.sin(rfYaw), 0.5, Math.cos(rfYaw)).multiplyScalar(0.6)); kneeR.y = rf.y + 0.45;
  const kneeL = lf.clone().add(new V3(Math.sin(lfYaw), 0, Math.cos(lfYaw)).multiplyScalar(0.6)); kneeL.y = lf.y + 0.5;

  // ---------------- arms ---------------------------------------------------------------------------------------------------------------------
  // shoulders (estimated from the pelvis and trunk) -- the real shoulder is measured after the torso is posed (see `after`)
  const psiC = yawP + yawS;
  const spec = {
    x: pelvisPos.x, z: pelvisPos.z, yaw: yawP,
    pelvis: { pos: pelvisPos, yaw: 0 },
    spine: { yaw: yawS, pitch, roll },
    feet: { L: { p: lf, yaw: lfYaw, pitch: lfPitch, pole: kneeL, w: ctx.wLegs }, R: { p: rf, yaw: rfYaw, pitch: rfPitch, pole: kneeR, w: ctx.wLegs } },
    hands: {},
    fingers: { R: V.grip, L: 'relaxed' },
  };
  // release geometry: the bowling hand at tau = 0 is the ball at the sim's release point
  out.spec = spec; out.psiC = psiC; out.pelvisPos = pelvisPos; out.release = rel;
  out.timing = { Tj, Ta, Tb, Tf, zMark, markX, runDist, DJ, tauStart, zbf, zff, s };
  return out;
}

/** Arms: called once the torso is posed (so the shoulder positions are real). Writes spec.hands. */
export function bowlerArms(ctx, rig, st) {
  const V = ctx.variant, s = ctx.scale ?? V.scale, tau = ctx.tau;
  const R = rig.arm.R, Lh = rig.arm.L;
  const sr = R.up.getWorldPosition(new V3()), sl = Lh.up.getWorldPosition(new V3());
  const head = rig.head.getWorldPosition(new V3());
  const rel = ctx.rel;
  const arm = (rig.len.upperArm + rig.len.foreArm) * s * 0.985;
  const Tj = V.Tj, Ta = V.Ta, Tb = V.Tb, Tf = V.Tf;
  const f = fvec(st.psiC), l = lvec(st.psiC);
  const fwd = new V3(0, 0, 1);
  // ---- bowling (right) arm: ball position path
  // swing angle beta from vertical-up: -150 (behind and below) ... 0 (release, vertical) ... +150 (down in front)
  const beta = K(tau, [[Tb - 0.02, -128], [Tf, -66], [-0.02, -20], [0, 0], [0.06, 40], [0.16, 110], [0.30, 150], [0.55, 168]]) * D2R;
  const plane = fwd.clone();                                   // the arm swings in the plane containing the line of delivery
  const sway = new V3(-0.04, 0, 0);                            // the arm leans a touch out at the top
  const swing = sr.clone().addScaledVector(plane, Math.sin(beta) * arm).addScaledVector(UP, Math.cos(beta) * arm).add(sway.clone().multiplyScalar(Math.cos(beta)));
  // gather: the ball at the chin, both hands together, in front of the chest (bound / coil)
  const chin = head.clone().addScaledVector(fvec(st.psiC + 0.0), 0.20).add(new V3(0, -0.15, 0));
  const gatherR = chin.clone().addScaledVector(l, -0.03);
  // cocked: hand behind and above the shoulder with the elbow high (the "ball showing" pose)
  const cocked = sr.clone().addScaledVector(fwd, -0.30 * s).addScaledVector(UP, 0.12 * s).addScaledVector(new V3(-1, 0, 0), 0.10 * s);
  let handR;
  if (tau < Ta) {
    const u = rampL(tau, Tj - 0.10, Ta);
    handR = chin.clone().lerp(gatherR, 0).add(new V3(0, 0.0, 0));
  } else handR = gatherR;
  const wGatherIn = ramp(tau, Tj - 0.16, Tj + 0.02);          // blend from the run-up arm swing into the gather
  // between the gather and the swing
  let target;
  if (tau < Tb - 0.02) {
    const k = ramp(tau, Ta, Tb - 0.02);
    const cockedPos = sr.clone().addScaledVector(fwd, -0.32 * s).addScaledVector(UP, -0.10 * s).addScaledVector(new V3(-1, 0, 0), 0.12 * s);
    target = gatherR.clone().lerp(cockedPos, k);
  } else target = swing;
  // ---- release exactness: at tau = 0 the ball IS the sim's release point
  const relW = rel.clone();
  const tRel = ramp(tau, -0.07, 0) * (1 - ramp(tau, 0, 0.05));
  // the ball centre rides in the fingers: hand = ball - hand-space offset (set below once the grip is known)
  const ballLocal = rig.h.fingers.R.knuckle.clone().multiplyScalar(0.45).addScaledVector(rig.h.fingers.R.palmDir, 0.038);
  // desired hand orientation at release: fingers up and a little forward, palm facing the target
  const F = norm(new V3(0, 1, 0.5)), Pw = norm(new V3(0, -0.5, 1));
  const Qrel = handBasis(rig.h.fingers.R, F, Pw);
  const relHand = relW.clone().sub(ballLocal.clone().multiplyScalar(s).applyQuaternion(Qrel));
  // positions: swing path corrected so its release point lands on relHand
  const swingAdj = swing.clone().add(relHand.clone().sub(sr.clone().addScaledVector(plane, 0).addScaledVector(UP, arm).add(sway)).multiplyScalar(ramp(tau, -0.12, 0) * (1 - ramp(tau, 0, 0.10))));
  const useSwing = tau >= Tb - 0.02;
  const rTarget = useSwing ? swingAdj : target;
  const rq = tau > -0.10 && tau < 0.10 ? new Quat().copy(Qrel).slerp(new Quat(), 0) : null;
  const elbowR = sr.clone().addScaledVector(new V3(-1, 0, 0), 0.5 * s).addScaledVector(fwd, -0.2 * s).add(new V3(0, -0.1, 0));
  const hands = {};
  const wR = ramp(tau, Tj - 0.16, Tj + 0.02);
  hands.R = { p: rTarget, pole: elbowR, q: tau > -0.12 && tau < 0.08 ? Qrel : null, w: wR, clav: 1, fix: tau > -0.09 && tau < 0.03 ? { local: ballLocal, world: relW, k: ramp(tau, -0.09, -0.01) } : null };
  // ---- front (left) arm
  const fa = K(tau, [[Tj, 0], [Ta, 1], [Tb, 1], [Tf, 0.55], [0, 0], [0.12, 0], [0.4, 0]]);
  const aimLine = sl.clone().addScaledVector(fwd, 0.50 * s).addScaledVector(UP, 0.30 * s).addScaledVector(new V3(0.15, 0, 0), s);   // points up and at the batter
  const tuck = sl.clone().add(new V3(0.0, -0.30 * s, 0.0)).addScaledVector(fwd, 0.14 * s).addScaledVector(l.clone().multiplyScalar(-1), 0.02);
  const swingBack = sl.clone().addScaledVector(fwd, -0.30 * s).addScaledVector(UP, -0.28 * s).add(new V3(0.12, 0, 0));
  let handL;
  if (tau < Tf) handL = gatherR.clone().lerp(aimLine, ramp(tau, Tj, Ta));
  else if (tau < 0.0) handL = aimLine.clone().lerp(tuck, ramp(tau, Tf, -0.005));
  else handL = tuck.clone().lerp(swingBack, ramp(tau, 0, 0.18));
  const elbowL = sl.clone().addScaledVector(new V3(1, 0, 0), 0.4 * s).addScaledVector(UP, -0.1 * s);
  hands.L = { p: handL, pole: elbowL, q: null, w: wR, clav: 1 };
  st.spec.hands = hands;
  st.spec.armTelemetry = { sr, relHand, Qrel, ballLocal };
  return st;
}

/** hand orientation from the world direction of the fingers (F) and the palm normal (P). */
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
