// The striker. A pose is a pure function of (phase, time inside it, the tap, the swing the sim accepted, the gilli) so pause, replay and screenshots are exact.
// Everything is authored in the WORLD frame (x right, y up, -z down the field; sim z maps to -z) for a RIGHT-handed striker holding the danda in his right hand.
//
// Timeline: stance (tip of the danda hovers over the end of the gilli and swings with the pendulum) -> the press: the tip strikes the end (the gilli flips) ->
// the danda lifts and cocks back over the right shoulder while the gilli hangs -> the player presses (ts): the arm drives round and the sweet spot of the
// danda meets the gilli exactly at tc -> follow-through across the body -> relax and watch.
import { quatFromBasis } from './rig.js';
import { V3, D2R, clamp, lerp, smooth, UP, ramp, fvec, lvec, comb, norm, nlerp } from './util3.js';

export const DANDA_LEN = 0.75, SWEET = 0.60, GRIP_C = 0.16;
const REACH = SWEET - GRIP_C;
const OPEN = 0.78;                  // how far the chest is turned toward the right of the aim line (side-on stance)
const PEL_H = 0.80;
export const P0 = { x: -0.30, z: 0.86 };   // stance pelvis position on the ground (world)

export function shoulderRel(th) {
  const w1 = 0.28 * th, w2 = 0.62 * th;
  return { up: 0.12 + 0.153 * Math.cos(w1) + 0.153 * Math.cos(w2) + 0.107 * Math.cos(th), fwd: 0.153 * Math.sin(w1) + 0.153 * Math.sin(w2) + 0.107 * Math.sin(th) };
}

/** Pelvis position, height and trunk lean so that the wrist H can be reached (arm slightly bent) with the chest facing psiC. */
function fitBody(H, psiC, lean, R = 0.5, lat = 0.20) {
  let y = PEL_H, th = lean;
  const fC = fvec(psiC), lC = lvec(psiC);
  for (let it = 0; it < 10; it++) {
    const dy = (y + shoulderRel(th).up) - H.y;
    if (dy > R * 0.9) { if (y > 0.5) y = Math.max(0.5, y - (dy - R * 0.9)); else th = Math.min(0.95, th + 0.1); }
    else if (dy < -R * 0.7) { th = Math.max(0.05, th - 0.1); y = Math.min(0.9, y + 0.03); }
  }
  const sr = shoulderRel(th);
  const dy = (y + sr.up) - H.y;
  const h2 = Math.sqrt(Math.max(0.0009, R * R - dy * dy));
  const shoulderXZ = new V3(H.x, 0, H.z).addScaledVector(fC, -h2);
  const pelXZ = shoulderXZ.clone().addScaledVector(fC, -sr.fwd).addScaledVector(lC, lat);
  return { pelXZ, y, th };
}

const gs = (n, a) => { const v = n.clone().addScaledVector(a, -n.dot(a)); if (v.lengthSq() < 1e-6) v.set(0, 0, -1); return v.normalize(); };
const lerpV = (a, b, t) => a.clone().lerp(b, t);

/**
 * c = { phase, pend, pt (time in phase), fp (flip clock, -1 before the flip), tap: { pend, kind } | null, tIdeal, sw: { ts, tc, q, kind, dy } | null,
 *       tau (seconds since contact, else -9), aim (radians, + right), gilli: V3 | null (world), N: V3 (world contact point of the sweet spot), lookAfter: V3 | null,
 *       idleT, dandaProp }
 * returns { spec, danda: { G, a, n, butt }, info }
 */
export function strikerPose(c, rig, out = {}) {
  const aim = c.aim ?? 0;
  const psiA = Math.PI - aim, psi0 = psiA - OPEN;
  const f0 = fvec(psi0), l0 = lvec(psi0);
  const fp = c.fp, sw = c.sw, tau = c.tau;
  const idle = c.idleT ?? 0;
  const breathe = Math.sin(idle * 1.9) * 0.006;
  const base = new V3(P0.x, 0, P0.z);

  // ---- the pendulum tip while waiting (and through the press) -------------------------------------------------------------------------------
  const endX = 0.07;
  let pend = c.phase === 'tap' ? c.pend : 1;
  if (c.phase === 'ready') pend = 1;
  const pendX = endX + pend * 0.19, pendY = 0.035 + 0.12 * Math.abs(pend) * Math.abs(pend);
  let tipX = pendX, tipY = pendY, tipZ = 0;
  const pressed = c.tap && fp >= 0;
  const missed = c.tap && c.tap.kind === 'miss';
  if (c.tap && (c.phase === 'result' || fp >= 0 || missed)) {
    const px = endX + c.tap.pend * 0.19;
    const t = missed ? c.pt : fp;
    if (missed) { tipX = px; tipY = lerp(0.035 + 0.12 * c.tap.pend * c.tap.pend, 0.02, smooth(t / 0.07)); }
    else { const k = smooth(t / 0.05); tipX = lerp(px, endX, k); tipY = lerp(0.035 + 0.12 * c.tap.pend * c.tap.pend, 0.025, k); }
  }
  // a stance pose: grip centre G and axis a from the tip
  const aPre = norm(comb(psiA, 0.5, -0.86, 0.12));
  const tip = new V3(tipX, tipY, tipZ);
  const GPre = tip.clone().addScaledVector(aPre, -(DANDA_LEN - GRIP_C));

  // ---- the cocked backswing --------------------------------------------------------------------------------------------------------------------
  const cockWag = Math.sin(idle * 3.1) * 0.01;
  const pelCock = base.clone().addScaledVector(l0, -0.05);
  const GCock = new V3(pelCock.x, 0, pelCock.z).add(comb(psi0, 0.10, 0, -0.34 + cockWag)).setY(1.30 + breathe);
  const aCock = norm(comb(psi0, -0.45, 0.62, -0.62));
  const risen = pressed ? ramp(fp, 0.07, 0.30) : 0;

  // ---- contact -----------------------------------------------------------------------------------------------------------------------------------
  const N = c.N ?? new V3(0.2, 0.86, 0);
  const alpha = clamp(((c.loft ?? 31) - 14) * 0.5, -10, 22) * D2R;
  const psiD = Math.PI - (c.aimSw ?? aim);
  const aC = norm(new V3(Math.cos(psiD) * Math.cos(alpha), Math.sin(alpha), -Math.sin(psiD) * Math.cos(alpha)));   // levelish, pointing along the avatar's left of the aim line
  const GC = N.clone().addScaledVector(aC, -REACH);
  const psiC = psiD - 0.22 - (sw ? clamp((sw.dt ?? 0) / 0.08, -1, 1) * 0.28 : 0);        // chest facing at contact (a little open), early/late turns it
  const fit = fitBody(GC, psiC, 22 * D2R);
  const move = new V3(fit.pelXZ.x - base.x, 0, fit.pelXZ.z - base.z); if (move.length() > 0.5) move.setLength(0.5);
  const pelC = base.clone().add(move);

  // ---- blend the pose ---------------------------------------------------------------------------------------------------------------------------
  let G, a, psi = psi0, th, pelXZ = base.clone(), pelY, lookT;
  const hold = (t) => { const k = ramp(t, 0.07, 0.30); return { G: lerpV(GPre, GCock, k), a: nlerp(aPre, aCock, k) }; };
  if (!pressed && !sw) {
    G = GPre; a = aPre;
    th = 36 * D2R; pelY = 0.70 + breathe;
    pelXZ = base.clone().addScaledVector(f0, 0.06);
  } else {
    const h = hold(Math.max(0, fp));
    G = h.G; a = h.a;
    th = lerp(36, 14, risen) * D2R; pelY = lerp(0.70, 0.79, risen) + breathe;
    pelXZ = base.clone().addScaledVector(f0, lerp(0.06, 0, risen));
    psi = lerp(psi0, psi0 + 0.0, risen);
  }
  let pelW = new V3(pelXZ.x, pelY, pelXZ.z);
  let pelYawRel = 0, spineLag = 0;
  let leftHand;
  const handStance = () => new V3(pelW.x, 0, pelW.z).add(comb(psi0, 0.15, 0, 0.28)).setY(pelW.y + 0.28);
  leftHand = handStance();
  const T = {};
  if (sw) {
    const ts = sw.ts, tc = sw.tc, u = clamp((fp - ts) / (tc - ts), 0, 1);
    const startH = hold(ts), startY = lerp(0.70, 0.79, ramp(ts, 0.07, 0.30));
    if (tau < 0 && fp >= ts) {
      const e = Math.pow(u, 1.7);
      G = lerpV(startH.G, GC, e); a = nlerp(startH.a, aC, e);
      const k = smooth(u);
      pelW = new V3(lerp(base.x, pelC.x, k), lerp(startY, fit.y, k), lerp(base.z, pelC.z, k));
      psi = lerp(psi0, psiC, Math.pow(u, 0.9)); th = lerp(14 * D2R, fit.th, k);
      spineLag = -0.2 * (1 - k); pelYawRel = (psi - psi0) * 0.0;
      leftHand = lerpV(new V3(pelW.x, 0, pelW.z).add(comb(psi, 0.3, 0, 0.3)).setY(1.15), new V3(pelW.x, 0, pelW.z).add(comb(psi, -0.05, 0, 0.5)).setY(1.0), k);
    } else if (tau >= 0) {
      const GF = new V3(pelC.x, 0, pelC.z).add(comb(psiD, 0.10, 0, 0.18)).setY(1.50), aF = norm(comb(psiD, -0.5, 0.72, 0.42));
      const k = smooth(tau / 0.42), k2 = ramp(tau, 0.25, 0.9);
      const aMid = nlerp(aC, norm(comb(psiD, 0.35, 0.45, 0.8)), smooth(tau / 0.16));
      G = lerpV(GC, GF, k); a = tau < 0.16 ? aMid : nlerp(aMid, aF, smooth((tau - 0.16) / 0.3));
      pelW = new V3(pelC.x, lerp(fit.y, 0.82, k2), pelC.z);
      psi = lerp(psiC, psiD + 0.45, smooth(tau / 0.5)); th = lerp(fit.th, 8 * D2R, k2);
      spineLag = 0.3 * k;
      leftHand = new V3(pelW.x, 0, pelW.z).add(comb(psi, -0.05, 0, 0.55)).setY(lerp(1.0, 0.8, k2));
    }
  }
  // the pelvis turns ahead of the chest; the chest's yaw relative to the root (psi0) is carried by the pelvis + spine
  const chestRel = psi - psi0;
  pelYawRel = chestRel * 0.55; const spineYaw = chestRel * 0.45 + spineLag;

  // ---- feet -------------------------------------------------------------------------------------------------------------------------------------------
  const fwdFoot = base.clone().addScaledVector(l0, 0.20).addScaledVector(f0, 0.14), rearFoot = base.clone().addScaledVector(l0, -0.20).addScaledVector(f0, -0.10);
  const stepK = sw ? ramp(fp, sw.ts - 0.02, sw.tc) : 0;
  const frontFoot = fwdFoot.clone().addScaledVector(fvec(psiD), 0.10 * stepK).addScaledVector(l0, 0.04 * stepK);
  frontFoot.y = rig.ankleH + (sw ? 0.05 * Math.sin(Math.PI * clamp(stepK, 0, 1)) : 0);
  const pivot = sw ? ramp(tau, -0.05, 0.3) : 0;
  const rf = rearFoot.clone(); rf.y = rig.ankleH;
  const heelUp = 0.55 * pivot;
  const rearAnkle = rf.clone(); rearAnkle.y = rig.ankleH * Math.cos(heelUp) + 0.125 * Math.sin(heelUp);
  const kneePole = (foot, yaw) => foot.clone().addScaledVector(fvec(yaw), 0.55).setY(0.5);

  // ---- head ---------------------------------------------------------------------------------------------------------------------------------------
  let look = c.gilli ? c.gilli.clone() : new V3(0.05, 0.05, 0);
  if (sw && tau > 0.1 && c.lookAfter) look = c.lookAfter.clone();
  if (c.phase === 'result' && c.lookAfter) look = c.lookAfter.clone();

  // ---- right hand on the danda -------------------------------------------------------------------------------------------------------------------
  const n = gs(norm(new V3(Math.sin(psi + 1.57), 0.15, Math.cos(psi + 1.57))), a);
  const xb = a.clone().cross(n).normalize();
  const Qbat = quatFromBasis(xb, a, n);
  const gq = c.dandaProp.quaternion.clone(), gp0 = c.dandaProp.position.clone();
  const Qh = Qbat.clone().multiply(gq.clone().invert());
  const butt = G.clone().addScaledVector(a, -GRIP_C);
  const handPos = butt.clone().sub(gp0.clone().applyQuaternion(Qh));
  const shoulderC = new V3(pelW.x, pelW.y + 0.55, pelW.z);
  const elbowR = shoulderC.clone().addScaledVector(lvec(psi), -0.32).addScaledVector(fvec(psi), -0.05).addScaledVector(UP, -0.30);
  const elbowL = shoulderC.clone().addScaledVector(lvec(psi), 0.32).addScaledVector(fvec(psi), 0.05).addScaledVector(UP, -0.34);

  const spec = {
    x: pelW.x, z: pelW.z, yaw: psi0,
    pelvis: { pos: pelW, yaw: pelYawRel },
    spine: { yaw: spineYaw, pitch: th, roll: 0 },
    feet: {
      L: { p: frontFoot, yaw: psi0 + 0.12 + (sw ? (psi - psi0) * 0.3 * ramp(tau, -0.1, 0.2) : 0), pitch: 0, pole: kneePole(frontFoot, psi0) },
      R: { p: rearAnkle, yaw: psi0 - 0.18 + (sw ? (psi - psi0) * 0.5 * ramp(tau, -0.06, 0.2) : 0), pitch: heelUp, pole: kneePole(rf, psi0) },
    },
    hands: { R: { p: handPos, q: Qh, pole: elbowR, clav: 1 }, L: { p: leftHand, pole: elbowL, clav: 0.6 } },
    head: { target: look, weight: 1, maxYaw: 1.5, maxPitch: 0.9 },
    fingers: { L: 'relaxed', R: 'batGrip' },
  };
  out.spec = spec; out.danda = { G, a, n, butt }; out.info = { psi, pelW, th, fit, aC, GC, N, T };
  return out;
}

const mx = (v) => (v ? new V3(-v.x, v.y, v.z) : v);
/** The context of the mirror-image world (x -> -x): a left-hander is the right-handed pose solved here and then drawn through a mirror (see director.js). */
export function mirrorCtx(c) {
  return { ...c, aim: -(c.aim ?? 0), aimSw: c.aimSw == null ? c.aimSw : -c.aimSw, gilli: mx(c.gilli), N: mx(c.N), lookAfter: mx(c.lookAfter) };
}
