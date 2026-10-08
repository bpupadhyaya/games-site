// The batter. A pose is a pure function of (time since release, the swing the sim accepted, the contact point) so pause, replay and screenshots
// are exact. Everything is authored for a RIGHT-hander in the world frame (x right, y up, -z toward the pitcher) and mirrored for a left-hander at
// the very end (positions, yaws, orientations; the top/bottom hand swap).
//
// Timeline: stance (bat waggle) -> from the release the weight loads back and the front foot strides toward the pitcher (planted before the swing can
// start) -> the player lifts the finger (ts): LAUNCH (hips and hands drive, 0.11 s) -> CONTACT at tc (the sweet spot of the barrel is exactly on the
// ball) -> FOLLOW-THROUGH (bat wraps around the front shoulder) -> finish and watch.
import { quatFromBasis } from './rig.js';
import { V3, D2R, clamp, lerp, smooth, UP, ramp, rampL, fvec, lvec, comb, norm, nlerp, spline } from './util3.js';

export const BAT = { len: 0.84, sweet: 0.64, gripC: 0.19, face: 0.0 };       // metres from the knob: barrel centre; grip centre (bottom hand)
export const PIVOT = { x: -0.74, z: 0.22 };                                    // feet centre in the sim frame (canonical right-hander)
const PSI0 = 100 * D2R;                                                        // stance chest yaw: facing the plate, a little open to the pitcher
const PEL_H = 0.80;
const REACH = BAT.sweet - BAT.gripC;                                           // grip centre to the ball on the barrel

export function shoulderRel(th) {
  const w1 = 0.28 * th, w2 = 0.62 * th;
  return { up: 0.12 + 0.153 * Math.cos(w1) + 0.153 * Math.cos(w2) + 0.107 * Math.cos(th), fwd: 0.153 * Math.sin(w1) + 0.153 * Math.sin(w2) + 0.107 * Math.sin(th) };
}

/** Pelvis position, height and trunk lean so that the wrist H can be reached (arm slightly bent) with the chest facing psiC. */
function fitBody(H, psiC, lean) {
  const R = 0.50, lat = 0.20;
  let y = PEL_H, th = lean;
  const fC = fvec(psiC), lC = lvec(psiC);
  for (let it = 0; it < 8; it++) {
    const dy = (y + shoulderRel(th).up) - H.y;
    if (dy > R * 0.9) { if (y > 0.54) y = Math.max(0.54, y - (dy - R * 0.9)); else th = Math.min(0.72, th + 0.1); }
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

/** The bat at the instant of contact: the sweet spot at N, axis nearly level with the attack angle alpha, sweeping at yaw phi. */
function contactPose(N, phi, alpha) {
  const a = new V3(Math.cos(alpha) * Math.sin(phi), Math.sin(alpha), Math.cos(alpha) * Math.cos(phi)).normalize();
  const n = gs(new V3(Math.cos(phi + Math.PI / 2) * 0.0 + Math.sin(phi - Math.PI / 2), 0.1, Math.cos(phi - Math.PI / 2)), a);
  const G = N.clone().addScaledVector(a, -REACH);
  return { G, a, n };
}

/**
 * ctx: { hand, ft, T, idleT, sw: { ts, tc, kind, dt, loft } | null, N (world contact point, sim-x already multiplied by hand? no: world), loftNow, batProp,
 *        after: { t, hr, big } | null, resting }
 * returns { spec, bat: { G, a, n }, info }
 */
export function batterPose(ctx, rig, out = {}) {
  const hand = ctx.hand;
  const mv = (v) => (hand < 0 ? new V3(-v.x, v.y, v.z) : v);          // canonical -> world (mirror for a left-hander)
  const unmv = mv;                                                      // the mirror is its own inverse
  const ft = ctx.ft, T = ctx.T, sw = ctx.sw;
  const B0 = new V3(PIVOT.x, 0, -PIVOT.z);
  const psi0 = PSI0, f0 = fvec(psi0), l0 = lvec(psi0);
  const Nc = unmv(ctx.N);                                               // contact point in the canonical frame
  const tau = sw ? ft - sw.tc : -9;                                     // seconds relative to contact
  const swingDur = 0.11;
  const tLaunch = sw ? sw.tc - swingDur : 9;                            // ft at which the hips start (the finger lift)
  const strideEnd = Math.min(0.42, T * 0.62);
  const sP = ft < 0 ? 0 : ramp(ft, 0.10, strideEnd);                    // 0 stance -> 1 loaded and planted

  // ---- the contact pose ------------------------------------------------------------------------------------------------------------------
  const loft = sw ? sw.loft : 24;
  const alpha = clamp((loft - 8) * 0.55, -4, 24) * D2R;                // uppercut angle follows the lift you asked for
  const dt = sw ? sw.dt : 0;
  const late = clamp(dt / 0.08, -1.2, 1.2);                            // + late (deep), - early (out in front)
  const phi0 = (92 - late * 16) * D2R;                                  // sweep direction of the barrel at contact (90 = across the plate)
  const psiC0 = (146 - late * 26) * D2R;
  const Cn = contactPose(Nc, phi0, alpha);
  // wrist (bottom hand origin) for this bat pose: the hand bone sits slightly outside the grip centre; use the grip centre as the target and let the prop offset fix the rest
  const fit = fitBody(Cn.G, psiC0, 20 * D2R);
  const reachMove = fit.pelXZ.clone().sub(B0.clone().addScaledVector(l0, 0.0)); reachMove.y = 0;
  const maxShift = 0.55; if (reachMove.length() > maxShift) reachMove.setLength(maxShift);
  const planted = B0.clone().add(new V3(0, 0, 0)).addScaledVector(l0, 0.22);                 // after the stride the pelvis has moved toward the pitcher
  const target = planted.clone().lerp(B0.clone().add(reachMove), 0.65);
  // pelvis path: stance -> load (a touch back) -> stride (forward) -> swing (forward and around)
  const loadBack = new V3().addScaledVector(l0, -0.07);
  const swingMove = sw ? ramp(tau, -swingDur, 0) : 0;
  let pelXZ = B0.clone();
  pelXZ.addScaledVector(loadBack, ramp(ft, 0.0, 0.14) * (1 - sP * 0.6));
  pelXZ.add(target.clone().sub(B0).multiplyScalar(0.55 * sP + 0.45 * swingMove * (sw ? 1 : 0)));
  pelXZ.y = 0;
  const pelY = lerp(PEL_H, lerp(0.78, fit.y, 1), 0.35 * sP + 0.65 * swingMove) + (ft < 0 ? Math.sin(ctx.idleT * 1.7) * 0.006 : 0) - 0.02 * sP;
  const th = lerp(14 * D2R, lerp(18 * D2R, fit.th, 1), 0.3 * sP + 0.7 * swingMove);

  // ---- chest / hips -----------------------------------------------------------------------------------------------------------------------
  const psiLoad = psi0 - 8 * D2R * sP;                                  // coil a little closed while loading
  let psi = psiLoad, hip = 0;
  if (sw) {
    if (tau < 0) psi = lerp(psiLoad, psiC0, smooth(ramp(tau, -swingDur, 0)) ** 0.9);
    else psi = lerp(psiC0, 205 * D2R, smooth(ramp(tau, 0, 0.30)));
    hip = tau < 0 ? ramp(tau, -swingDur - 0.02, 0) * 0.75 : lerp(0.75, 1, ramp(tau, 0, 0.2));
  }
  const pelvisYawW = (sw ? (psi - psiLoad) * hip * 0.9 : -8 * D2R * sP * 0);   // the pelvis leads the chest
  const spineLag = sw ? (tau < 0 ? -0.18 * (1 - ramp(tau, -swingDur - 0.02, 0)) : 0.28 * ramp(tau, 0, 0.22)) : 0;

  // ---- the bat -----------------------------------------------------------------------------------------------------------------------------
  const pelW = new V3(pelXZ.x, pelY, pelXZ.z);
  const at = (psi_, f, u, l, base = pelW) => new V3(base.x, 0, base.z).add(comb(psi_, f, 0, l)).setY(u);
  // stance: hands by the rear shoulder, bat leaning back about 25 degrees (waggle) ; load: hands a little further back
  const wag = ft < 0 ? Math.sin(ctx.idleT * 3.2) * 0.012 : 0;
  const stanceG = at(psiLoad, 0.10 + wag, 1.40, -0.20), stanceA = norm(comb(psiLoad, 0.10, 1.0, -0.55 + wag * 4));
  const loadG = at(psiLoad, 0.00, 1.46, -0.32), loadA = norm(comb(psiLoad, 0.12, 1.0, -0.42));
  const preK = ft < 0 ? 0 : ramp(ft, 0.05, strideEnd);
  let G = stanceG.clone().lerp(loadG, preK), a = nlerp(stanceA, loadA, preK), n = norm(comb(psiLoad, 0.5, 0.2, 0.85));
  let info = { tau, sP };
  if (sw) {
    const swingG = (psi_, f, u, l) => at(psi_, f, u, l);
    // body-frame keys for the hands: launch (load), drive, contact (from the ball), extend, finish
    const Gc = Cn.G.clone();
    // hands at contact relative to the planted pelvis in the chest frame at psiC0, then reused at later chest yaws so the bat stays a rigid arm-length from the body
    const rel = Gc.clone().sub(new V3(pelW.x, 0, pelW.z)).setY(0);
    const fC = rel.dot(fvec(psiC0)), lC = rel.dot(lvec(psiC0));
    const tauKeys = [-swingDur, -0.05, 0, 0.09, 0.2, 0.36, 0.6];
    const gp = [
      loadG.clone(),
      swingG(psi, lerp(0.0, fC, 0.55), lerp(1.40, Gc.y + 0.12, 0.7), lerp(-0.30, lC, 0.7)),
      Gc.clone(),
      swingG(psi, fC + 0.05, Gc.y + 0.10, lC + 0.28),
      swingG(psi, 0.30, Math.max(1.25, Gc.y + 0.25), 0.40),
      swingG(psi, 0.18, 1.58, 0.28),
      swingG(psi, 0.14, 1.52, 0.22),
    ];
    if (tau < 0) {
      const u = ramp(tau, -swingDur, 0);
      const base = spline(tauKeys.slice(0, 3), [gp[0], gp[1], gp[2]], tau);
      G = base;
      void u;
    } else G = spline(tauKeys.slice(2), gp.slice(2), tau);
    // the grip centre is anchored to the world contact point at tau = 0 (gp[2]); keep the world position exactly there at contact
    // axis keys (world vectors): barrel trailing back, level through the ball, then wrapping around the front shoulder
    const acKey = Cn.a.clone();
    const aK = [
      loadA.clone(),
      norm(comb(psiLoad + 0.5, 0.15, 0.30, -0.95)),
      acKey,
      norm(new V3(Math.cos(alpha + 0.1) * Math.sin(phi0 + 0.9), Math.sin(alpha + 0.12), Math.cos(alpha + 0.1) * Math.cos(phi0 + 0.9))),
      norm(new V3(Math.sin(phi0 + 1.9) * 0.6, 0.65, Math.cos(phi0 + 1.9) * 0.6)),
      norm(comb(psi, -0.55, 0.78, 0.30)),
      norm(comb(psi, -0.60, 0.70, 0.35)),
    ];
    let seg = 0; for (let i = 0; i < tauKeys.length - 2; i++) if (tau > tauKeys[i + 1]) seg = i + 1;
    const t0 = tauKeys[seg], t1 = tauKeys[seg + 1], k = tau <= tauKeys[0] ? 0 : smooth(clamp((tau - t0) / (t1 - t0), 0, 1));
    const eased = (tau < 0) ? Math.pow(clamp((tau - t0) / (t1 - t0), 0, 1), 1.6) : k;
    a = tau <= tauKeys[0] ? loadA.clone() : nlerp(aK[seg], aK[Math.min(aK.length - 1, seg + 1)], eased);
    n = gs(norm(new V3(Math.sin(phi0 - 1.57), 0.1, Math.cos(phi0 - 1.57))), a);
    info = { tau, sP, psi, hip, Gc, fC, lC };
  }

  // ---- feet --------------------------------------------------------------------------------------------------------------------------------------
  const frontBase = B0.clone().addScaledVector(l0, 0.30).addScaledVector(f0, -0.02), rearBase = B0.clone().addScaledVector(l0, -0.30).addScaledVector(f0, 0.02);
  const strideVec = l0.clone().multiplyScalar(0.34).addScaledVector(f0, 0.04);
  const uF = ft < 0 ? 0 : ramp(ft, 0.12, strideEnd);
  const frontFoot = frontBase.clone().addScaledVector(strideVec, smooth(uF));
  frontFoot.y = rig.ankleH + 0.16 * Math.sin(Math.PI * clamp((ft - 0.12) / (strideEnd - 0.12), 0, 1)) * (ft > 0 && ft < strideEnd ? 1 : 0);
  const pivot = sw ? ramp(tau, -0.04, 0.26) : 0;
  const rearFoot = rearBase.clone().addScaledVector(l0, 0.02 * sP).addScaledVector(f0, 0.0);
  rearFoot.y = rig.ankleH;
  const heelUp = 0.62 * pivot;
  const rearAnkle = rearFoot.clone(); rearAnkle.y = rig.ankleH * Math.cos(heelUp) + 0.125 * Math.sin(heelUp);
  const rearYaw = psi0 + (sw ? (psi - psiLoad) * 0.55 * ramp(tau, -0.06, 0.2) : 0);
  const frontYaw = psi0 + 0.18 * uF + (sw ? (psi - psiLoad) * 0.15 : 0);
  const kneePole = (foot, yaw) => foot.clone().addScaledVector(fvec(yaw), 0.55).setY(0.5);

  // ---- head: the ball, then the contact spot, then the ball in the air ----------------------------------------------------------------------
  let look = ctx.ball ? unmv(ctx.ball) : new V3(0, 1.7, -17);
  if (sw && tau > -0.03 && tau < 0.16) look = Nc.clone().add(new V3(0, -0.03, 0));
  if (ctx.after && ctx.after.look) look = unmv(ctx.after.look);

  // ---- hands -------------------------------------------------------------------------------------------------------------------------------------
  const bottom = hand > 0 ? 'R' : 'L';
  const gq = ctx.batProp.quaternion.clone(), gp0 = ctx.batProp.position.clone();
  const Gm = mv(G), am = mv(a), nm = mv(n);
  const xb = am.clone().cross(nm).normalize();
  const Qbat = quatFromBasis(xb, am, nm);
  const Qh = Qbat.clone().multiply(gq.clone().invert());
  const butt = Gm.clone().addScaledVector(am, -BAT.gripC);
  const handPos = butt.clone().sub(gp0.clone().applyQuaternion(Qh));
  const chestL = lvec(psi);
  const shoulderC = pelW.clone().setY(pelW.y + 0.55);
  const elbowB = shoulderC.clone().addScaledVector(chestL, -0.30).addScaledVector(fvec(psi), 0.10).addScaledVector(UP, -0.35);

  const frontSide = hand > 0 ? 'L' : 'R', rearSide = hand > 0 ? 'R' : 'L';
  const spec = {
    x: mv(pelW).x, z: pelW.z, yaw: hand > 0 ? psi0 : -psi0,
    pelvis: { pos: mv(pelW), yaw: hand > 0 ? (psiLoad - psi0) + pelvisYawW : -((psiLoad - psi0) + pelvisYawW) },
    spine: { yaw: hand > 0 ? spineLag : -spineLag, pitch: th, roll: 0 },
    feet: {},
    hands: { [bottom]: { p: handPos, q: Qh, pole: mv(elbowB), clav: 1 } },
    head: { target: mv(look), weight: 1, maxYaw: 1.6, maxPitch: 0.9 },
    fingers: { L: 'batGrip', R: 'batGrip' },
  };
  spec.feet[frontSide] = { p: mv(frontFoot), yaw: hand > 0 ? frontYaw : -frontYaw, pitch: 0, pole: mv(kneePole(frontFoot, frontYaw)) };
  spec.feet[rearSide] = { p: mv(rearAnkle), yaw: hand > 0 ? rearYaw : -rearYaw, pitch: heelUp, pole: mv(kneePole(rearFoot, rearYaw)) };
  out.spec = spec; out.bat = { G: Gm, a: am, n: nm, butt }; out.info = info;
  return out;
}
