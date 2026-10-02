// The batter. A pose is a pure function of (ball time, swing, shot) so pause, replay and screenshots are exact.
// Everything is authored for a RIGHT-hander in the canonical world (x = off side, bowler at -z, camera at +z) and mirrored for
// a left-hander at the very end (positions, yaws, orientations; the top/bottom hand swap).
//
// Timeline (ft = flight time since release; tC = the ball reaches the bat plane, T_c = the bat meets it, tau = ft - T_c):
//   stance -> backlift from the release (peak by the bounce; bat ~130 deg from vertical over the rear shoulder) -> trigger movement
//   (the body moves to the line of the ball; planted 70 ms before it arrives) -> downswing -> the sweet spot is at the ball on the
//   contact frame -> follow-through -> settle. The body placement is a function of the ball only (batters commit their feet before
//   they choose the shot); the swing and the body turn are a function of the sim's swing.
import { quatFromBasis } from './rig.js';
import { V3, D2R, clamp, lerp, smooth, UP, ramp, rampL, fvec, lvec, comb, norm, nlerp, spline } from './util3.js';

export const BAT = { len: 0.85, sweet: 0.58, gripC: 0.16, face: 0.026 };   // metres along the bat: sweet spot; grip centre; face plane offset from the centre line
export const PIVOT = { x: -0.5, z: 0.05 };                                  // stance pivot (sim frame, feet centre)
const PSI0 = 105 * D2R;                                                      // stance yaw: chest to the off side, a little open to the bowler
const PEL_H = 0.83;
const wrapTo = (a, ref) => { let d = a - ref; d = Math.atan2(Math.sin(d), Math.cos(d)); return ref + d; };

/** Shot families from the swipe angle (sim degrees: 0 straight, + off side) and the ball. */
export function familyOf(sw, d) {
  if (!sw || sw.kind === 'block') return sw ? 'block' : 'drive';
  const a = sw.angle;
  const lc = d ? d.lengthClass : 'good';
  const shortBall = lc === 'short' || lc === 'bouncer';
  if (a <= -118 || a >= 118) return 'glance';
  if (a < -62) return shortBall || a < -80 ? 'pull' : 'flick';
  if (a > 62) return 'cut';
  return shortBall && Math.abs(a) > 25 ? (a < 0 ? 'pull' : 'cut') : 'drive';
}

/** Right-shoulder offset from the pelvis for a total trunk pitch th (the pitch is spread over the three spine joints). */
export function shoulderRel(th) {
  const w1 = 0.28 * th, w2 = 0.62 * th;
  return { up: 0.12 + 0.153 * Math.cos(w1) + 0.153 * Math.cos(w2) + 0.107 * Math.cos(th), fwd: 0.153 * Math.sin(w1) + 0.153 * Math.sin(w2) + 0.107 * Math.sin(th) };
}

/** Pelvis position, height and trunk lean so that the wrist H can be reached (arm slightly bent) with the chest facing psiC. */
function fitBody(H, psiC, lean) {
  const R = 0.53, lat = 0.21;
  let y = PEL_H, th = lean;
  const fC = fvec(psiC), lC = lvec(psiC);
  for (let it = 0; it < 6; it++) {
    const dy = (y + shoulderRel(th).up) - H.y;
    if (dy > R * 0.92) { if (y > 0.68) y = Math.max(0.68, y - (dy - R * 0.92)); else th = Math.min(0.9, th + 0.1); }
    else if (dy < -R * 0.75) { th = Math.max(0.05, th - 0.1); y = Math.min(0.92, y + 0.03); }
  }
  const sr = shoulderRel(th);
  const dy = (y + sr.up) - H.y;
  const h2 = Math.sqrt(Math.max(0.0009, R * R - dy * dy));
  const shoulderXZ = new V3(H.x, 0, H.z).addScaledVector(fC, -h2);
  const pelXZ = shoulderXZ.clone().addScaledVector(fC, -sr.fwd).addScaledVector(lC, lat);
  return { pelXZ, y, th };
}

const FAM = {
  //          dist: contact in front of the chest   turn: [at contact, at the finish] fraction of the way to the shot   lean: forward lean at contact (deg)
  drive: { dist: 0.46, turn: [0.5, 0.92], lean: 12, back: false },
  block: { dist: 0.40, turn: [0.12, 0.2], lean: 14, back: false },
  cut: { dist: 0.52, turn: [0.05, 0.25], lean: -2, back: true },
  pull: { dist: 0.40, turn: [0.60, 0.98], lean: -4, back: true },
  flick: { dist: 0.44, turn: [0.5, 0.9], lean: 4, back: false },
  glance: { dist: 0.44, turn: [0.3, 0.55], lean: 6, back: false },
};

/**
 * ctx: { hand, ft, tC, tB, lenClass, sw, fam, N (canonical world contact point), ball {vis,p}, phase, tr, idleT, batProp, release, resting }
 * returns { spec (for Rig.solve), bat: { G, a, n, butt }, info }
 */
export function batterPose(ctx, rig, out = {}) {
  const hand = ctx.hand;
  const mv = (v) => (hand < 0 ? new V3(-v.x, v.y, v.z) : v);
  const ft = ctx.ft, tC = ctx.tC, sw = ctx.sw, N = ctx.N;
  const fam = ctx.fam || 'drive', F = FAM[fam] || FAM.drive;
  const back = F.back || ctx.lenClass === 'short' || ctx.lenClass === 'bouncer';
  const B0 = new V3(PIVOT.x, 0, -(ctx.pivotZ ?? PIVOT.z));
  const psi0 = PSI0, f0 = fvec(psi0), l0 = lvec(psi0);

  // ---------------- timing anchors ------------------------------------------------------------------------------------------------
  const T_c = sw ? sw.T_c : tC;
  const tau = ft - T_c;
  const tStart = sw ? clamp(sw.tCommit - T_c, -0.2, -0.05) : -0.12;       // downswing start (a human swipe is committed 50 ms before contact)
  const tPlant = tC - 0.07, tStride = tPlant - 0.30;
  const tBL1 = Math.max(0.22, Math.min(ctx.tB > 0 ? ctx.tB : tC * 0.55, tC - 0.30));    // backlift peak
  const sP = ft < 0 ? 0 : ramp(ft, tStride, tPlant);                       // trigger movement 0 -> 1

  // ---------------- where the body must be: fitted so the bottom hand can reach the contact pose ---------------------------------------
  const swFit = sw || { kind: 'swing', angle: 20, power: 0.7, elev: 4, resKind: 'hit', e: 0 };
  const famFit = sw ? fam : 'drive';
  const FF = FAM[famFit];
  const Cf = contactPose(ctx, swFit, famFit, N);
  const shotYawFit = wrapTo(Math.PI - swFit.angle * D2R, psi0);
  const turnKfit = 0.6 + 0.4 * clamp(swFit.power, 0.1, 1);
  const psiCfit = psi0 + clamp(shotYawFit - psi0, -1.7, 1.7) * FF.turn[0] * turnKfit;
  const gqN = ctx.batProp.quaternion, gpN = ctx.batProp.position;
  const wristOf = (C) => {   // the bottom-hand wrist (hand bone origin) for a bat pose, in actual world coordinates
    const Gm_ = mv(C.G), am_ = mv(C.a), nm_ = mv(C.n);
    const Q_ = quatFromBasis(am_.clone().cross(nm_).normalize(), am_, nm_).multiply(gqN.clone().invert());
    return Gm_.clone().addScaledVector(am_, -BAT.gripC).sub(gpN.clone().applyQuaternion(Q_));
  };
  const fit = fitBody(mv(wristOf(Cf)), psiCfit, (16 + FF.lean) * D2R);
  const reachable = N.x > -0.95 && N.x < 1.45 && N.y < 2.0;
  const stancePel = B0.clone().addScaledVector(f0, -0.03);
  let target = fit.pelXZ.clone();
  target.x = clamp(target.x, -0.95, 1.15); target.z = clamp(target.z, -0.55, 0.2);
  const share = reachable ? 1 : 0.35;                                       // an out-of-reach ball is left alone with a smaller shuffle
  const move = new V3().subVectors(target, stancePel); move.y = 0;
  const plant = stancePel.clone().addScaledVector(move, share * 0.92);
  const arrive = share * (0.92 * sP + 0.08 * (sw ? ramp(tau, tStart, 0) : 0));
  const pelXZ = stancePel.clone().addScaledVector(move, arrive);

  // ---------------- feet --------------------------------------------------------------------------------------------------------------
  const sFoot = (a, b) => ramp(ft, a, b);
  const frontPlant = plant.clone().addScaledVector(l0, 0.26).addScaledVector(f0, 0.05);
  const rearPlant = plant.clone().addScaledVector(l0, -0.26).addScaledVector(f0, -0.04);
  const frontBase = B0.clone().addScaledVector(l0, 0.27).addScaledVector(f0, 0.04);
  const rearBase = B0.clone().addScaledVector(l0, -0.27).addScaledVector(f0, -0.04);
  // the leading foot goes first and lands; the other follows with a short delay
  const uF = sFoot(tStride, tPlant), uR = sFoot(tStride + 0.05, tPlant + 0.02);
  const frontFoot = back ? frontBase.clone().lerp(frontPlant.clone().addScaledVector(l0, -0.12), uF) : frontBase.clone().lerp(frontPlant, uF);
  const rearFoot = rearBase.clone().lerp(back ? rearPlant.clone().addScaledVector(l0, -0.06) : rearPlant, uR);
  const arc = (a, b, h) => h * Math.sin(Math.PI * clamp((ft - a) / (b - a), 0, 1));
  const lenMove = move.length() * share;
  frontFoot.y = rig.ankleH + arc(tStride, tPlant, Math.min(0.14, 0.04 + lenMove * 0.09));
  rearFoot.y = rig.ankleH + arc(tStride + 0.05, tPlant + 0.02, Math.min(0.12, 0.03 + lenMove * 0.07));

  // ---------------- body turn -------------------------------------------------------------------------------------------------------
  const shotYaw = sw ? wrapTo(Math.PI - sw.angle * D2R, psi0) : psi0;
  const dYaw = clamp(shotYaw - psi0, -1.7, 1.7);
  const power = sw ? clamp(sw.power, 0.1, 1) : 0.5;
  const turnK = 0.6 + 0.4 * power;
  const tcF = F.turn[0], tfF = F.turn[1];
  const hipP = sw ? (tau < 0 ? ramp(tau, tStart - 0.02, 0) * tcF : tcF + (tfF - tcF) * ramp(tau, 0, 0.26)) : 0;
  const pelvisYaw = dYaw * hipP * turnK;
  const shLag = sw ? (tau < 0 ? -0.12 * (1 - ramp(tau, tStart - 0.02, 0)) : 0.30 * ramp(tau, 0, 0.2)) * (fam === 'block' ? 0.2 : 1) : 0;
  const spineYaw = shLag;
  const psiChest = psi0 + pelvisYaw + spineYaw;
  const psiPel = psi0 + pelvisYaw;

  // ---------------- pelvis height, lean ------------------------------------------------------------------------------------------------
  const pelY = lerp(PEL_H, fit.y, arrive);
  const pel = pelXZ.clone().setY(pelY);
  const lean0 = 9 * D2R;
  const leanFit = fit.th - 0;
  const spinePitch = lerp(lean0, leanFit, arrive) + (back ? -2 * D2R * sP : 0);
  const leanTail = sw ? -(1 - ramp(tau, 0.12, 0.5)) * 0 : 0;
  const spineSide = sw ? ((fam === 'drive' ? 5 : fam === 'cut' ? -5 : fam === 'pull' ? 8 : 0) * D2R) * ramp(tau, tStart, 0.1) * (1 - ramp(tau, 0.2, 0.5)) : 0;
  void leanTail;

  // ---------------- the bat ----------------------------------------------------------------------------------------------------------------
  const bat = batPath(ctx, { tau, tStart, T_c, psiChest, fam, sw, ft, tBL1, B0, pel, N });

  // feet orientation: toes along the stance direction; the rear foot pivots with the hips and the heel rises in the follow-through
  const pivotRear = sw ? ramp(tau, -0.02, 0.28) : 0;
  const rearYaw = psi0 + pelvisYaw * 0.5;
  const frontYaw = psi0 + 0.14 * uF + (sw ? pelvisYaw * 0.12 : 0);
  const heelUp = back ? 0.35 * pivotRear : 0.55 * pivotRear;
  const anklePos = (foot, th) => { const a = foot.clone(); a.y = (th > 0 ? rig.ankleH * Math.cos(th) + 0.125 * Math.sin(th) : foot.y) + (th > 0 ? foot.y - rig.ankleH : 0); return a; };
  const rearAnkle = anklePos(rearFoot, heelUp);
  const frontAnkle = frontFoot.clone();
  const kneePole = (foot, yaw) => foot.clone().addScaledVector(fvec(yaw), 0.5).setY(0.55);

  // head: eyes on the ball until contact, then on the contact spot (head still), then the ball again
  let look = ctx.ball && ctx.ball.vis ? ctx.ball.p.clone() : (ctx.release || new V3(0, 1.9, -19.2));
  if (sw && tau > -0.02 && tau < 0.30) look = N.clone().add(new V3(0, -0.05, 0));

  // ---------------- hands --------------------------------------------------------------------------------------------------------------------
  const bottom = hand > 0 ? 'R' : 'L';
  const batNode = ctx.batProp;
  const gq = batNode.quaternion.clone(), gp = batNode.position.clone();
  const Gm = mv(bat.G), am = mv(bat.a), nm = mv(bat.n);
  const xb = am.clone().cross(nm).normalize();
  const Qbat = quatFromBasis(xb, am, nm);
  const Qh = Qbat.clone().multiply(gq.clone().invert());
  const butt = Gm.clone().addScaledVector(am, -BAT.gripC);
  const handPos = butt.clone().sub(gp.clone().applyQuaternion(Qh));
  const chestL = lvec(psiChest);
  const shoulderC = pel.clone().setY(pel.y + 0.55);
  // elbow hint: out and down, away from the chest line
  const elbowB = shoulderC.clone().addScaledVector(chestL, -0.38).addScaledVector(fvec(psiChest), 0.05).addScaledVector(UP, -0.30);

  const frontSide = hand > 0 ? 'L' : 'R', rearSide = hand > 0 ? 'R' : 'L';
  const spec = {
    x: mv(pel).x, z: pel.z, yaw: hand > 0 ? psi0 : -psi0,
    pelvis: { pos: mv(pel), yaw: hand > 0 ? pelvisYaw : -pelvisYaw },
    spine: { yaw: hand > 0 ? spineYaw : -spineYaw, pitch: spinePitch, roll: hand > 0 ? spineSide : -spineSide },
    feet: {},
    hands: { [bottom]: { p: handPos, q: Qh, pole: mv(elbowB), clav: 1 } },
    head: { target: mv(look), weight: 1, maxYaw: 1.6, maxPitch: 0.9 },
    fingers: { L: 'batGrip', R: 'batGrip' },
  };
  spec.feet[frontSide] = { p: mv(frontAnkle), yaw: hand > 0 ? frontYaw : -frontYaw, pitch: 0, pole: mv(kneePole(frontFoot, frontYaw)) };
  spec.feet[rearSide] = { p: mv(rearAnkle), yaw: hand > 0 ? rearYaw : -rearYaw, pitch: heelUp, pole: mv(kneePole(rearFoot, rearYaw)) };
  out.spec = spec;
  out.bat = { G: Gm, a: am, n: nm, butt, sC: Cf.sC };
  out.info = { tau, T_c, fam, sP, pelvisYaw, psiChest, target, move, back };
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Bat path: grip centre G, axis a (butt -> tip) and face normal n as functions of time (canonical right-hander frame).
function batPath(ctx, P) {
  const { tau, tStart, psiChest, fam, sw, ft, tBL1, B0, pel, N } = P;
  const psi0 = PSI0;
  const pel0 = B0.clone().setY(0);
  // body-frame helper: point at (f, up, l) from the pelvis centre in the chest frame at yaw psi
  const at = (psi, f, u, l, origin = pel) => new V3(origin.x, 0, origin.z).add(comb(psi, f, 0, l)).setY(u);
  // stance: bat grounded behind the rear toes, hands in front of the front thigh
  // stance: the toe of the bat rests on the ground just behind the toes of the back foot, the handle leans a little towards the body,
  // hands low in front of the front thigh with soft elbows, blade face to the bowler (never poking out past the front pad)
  const sBase = pel0.clone().addScaledVector(fvec(psi0), -0.03);
  const sG = at(psi0, 0.15, 0.68, 0.10, sBase), sT = at(psi0, 0.09, 0.02, -0.14, sBase);
  const S = { G: sG, a: norm(sT.clone().sub(sG)), n: norm(new V3(0, 0.05, -1)) };
  // backlift: bat up and back over the rear shoulder (~130 deg from vertical), hands at chest height
  const K = { G: at(psiChest, 0.24, 1.02, -0.10), a: norm(comb(psiChest, 0.20, 0.64, -0.74)), n: norm(comb(psiChest, 0.45, 0.2, 0.86)) };
  // the bat is picked up straight (handle up, hands rising in front of the chest), then cocked back over the rear shoulder
  const M = { G: at(psiChest, 0.22, 1.0, 0.02), a: norm(comb(psiChest, 0.0, 0.92, -0.38)), n: norm(comb(psiChest, 0.35, 0.3, 0.88)) };
  const pre = (u) => {
    const e = clamp(u, 0, 1);
    if (e < 0.5) { const k = smooth(e * 2); return { G: S.G.clone().lerp(M.G, k), a: nlerp(S.a, M.a, k), n: nlerp(S.n, M.n, k) }; }
    const k = smooth((e - 0.5) * 2);
    return { G: M.G.clone().lerp(K.G, k), a: nlerp(M.a, K.a, k), n: nlerp(M.n, K.n, k) };
  };
  const resting = ctx.resting;
  const u = rampL(ft, 0.02, tBL1);
  let st = resting ? { G: S.G.clone().add(new V3(0, Math.max(0, Math.sin((ctx.idleT || 0) * 5.2)) * 0.03, 0)), a: S.a.clone(), n: S.n.clone() } : pre(u);
  if (!sw) {
    const gone = ctx.phase === 'result' ? rampL(ctx.tr || 0, 0.1, 0.8) : 0;
    return { G: st.G.clone().lerp(S.G, smooth(gone)), a: nlerp(st.a, S.a, smooth(gone)), n: nlerp(st.n, S.n, smooth(gone)) };
  }
  const C = contactPose(ctx, sw, fam, N);
  if (tau < 0) {
    const start = pre(rampL(P.T_c + tStart, 0.02, tBL1));
    const uu = clamp((tau - tStart) / (0 - tStart), 0, 1);
    const e = Math.pow(uu, 1.7);
    const mid = start.G.clone().lerp(C.G, 0.55).add(new V3(0, 0.10, 0));
    const q1 = (1 - e) * (1 - e), q2 = 2 * (1 - e) * e, q3 = e * e;
    const G = start.G.clone().multiplyScalar(q1).addScaledVector(mid, q2).addScaledVector(C.G, q3);
    const midA = nlerp(start.a, C.a, 0.5).addScaledVector(UP, -0.15).normalize();
    const a = e < 0.5 ? nlerp(start.a, midA, smooth(e * 2)) : nlerp(midA, C.a, smooth((e - 0.5) * 2));
    const n = nlerp(start.n, C.n, smooth(e));
    return { G, a, n: gs(n, a) };
  }
  const keys = followKeys(fam, psiChest, B0, pel, C);
  const ts = [0, ...keys.t], gsK = [C.G, ...keys.G], as = [C.a, ...keys.a];
  const G = spline(ts, gsK, tau);
  let i = 0; while (i < ts.length - 2 && tau > ts[i + 1]) i++;
  const k = smooth(clamp((tau - ts[i]) / (ts[i + 1] - ts[i]), 0, 1));
  const a = nlerp(as[i], as[Math.min(as.length - 1, i + 1)], k);
  return { G, a, n: gs(C.n.clone(), a) };
}

function gs(n, a) { const v = n.clone().addScaledVector(a, -n.dot(a)); if (v.lengthSq() < 1e-6) v.set(0, 0, -1); return v.normalize(); }

/** The bat at the instant of contact: sweet spot on the ball, face to the outgoing direction (an edge: the edge meets it). */
function contactPose(ctx, sw, fam, N) {
  const phi = sw.angle * D2R, elev = clamp(sw.elev || 0, 0, 60) * D2R;
  const out = new V3(Math.cos(elev) * Math.sin(phi), Math.sin(elev), -Math.cos(elev) * Math.cos(phi));
  const inn = new V3(0, -0.1, 1).normalize();
  let n = out.clone().sub(inn); if (n.lengthSq() < 1e-6) n.set(0, 0, -1); n.normalize();
  if (sw.kind === 'block') n.set(0, 0.12, -1).normalize();
  const hAim = new V3(n.x, 0, n.z).normalize();
  const high = clamp((N.y - 0.9) / 0.9, 0, 1);                    // the higher the ball, the flatter the bat
  let a;
  switch (fam) {
    case 'pull': case 'flick': a = norm(new V3(hAim.z, 0, -hAim.x).multiplyScalar(-1).addScaledVector(UP, -0.55 + 0.4 * high)); break;
    case 'cut': a = norm(new V3(-hAim.z, 0, hAim.x).addScaledVector(UP, -1.6 + 0.6 * high)); break;
    case 'glance': a = norm(new V3(0, -1, 0).addScaledVector(hAim, 0.1)); break;
    case 'block': a = norm(new V3(0, -0.98, 0).addScaledVector(hAim, -0.20)); break;
    default: a = norm(new V3(0, -0.98 + 0.5 * high, 0).addScaledVector(hAim, -0.22)); break;
  }
  n = gs(n, a);
  let edge = 0;
  if (sw.resKind === 'edge') edge = (sw.e > 0 ? 1 : -1) * 0.052;
  const xAxis = a.clone().cross(n).normalize();
  // ball centre at N touches the face: the face plane is BAT.face in front of the centre line, the ball radius further out
  const centreLine = N.clone().addScaledVector(n, -(0.0365 + BAT.face)).addScaledVector(xAxis, -edge);
  const sC = contactAlong(N);
  const G = centreLine.clone().addScaledVector(a, -(sC - BAT.gripC));
  return { G, a, n, sC };
}

/** Where on the blade the ball is met: the middle for a half-volley, further down towards the toe for a yorker. */
export const contactAlong = (N) => lerp(0.76, BAT.sweet, smooth(clamp(N.y / 0.55, 0, 1)));

function followKeys(fam, psiChest, B0, pel, C) {
  const at = (f, u, l) => new V3(pel.x, 0, pel.z).add(comb(psiChest, f, 0, l)).setY(u);
  const dir = (f, u, l) => norm(comb(psiChest, f, u, l));
  switch (fam) {
    case 'pull': case 'flick':
      return { t: [0.07, 0.18, 0.34, 0.6], G: [at(0.20, 1.20, 0.25), at(0.0, 1.38, 0.0), at(-0.05, 1.40, 0.15), at(0.25, 1.05, 0.2)], a: [dir(0.2, 0.2, 0.9), dir(-0.5, 0.3, 0.7), dir(-0.6, 0.6, 0.3), dir(0.2, -0.3, 0.8)] };
    case 'cut':
      return { t: [0.07, 0.18, 0.34, 0.6], G: [at(0.40, 1.05, 0.1), at(0.50, 1.00, -0.05), at(0.40, 1.05, 0.0), at(0.25, 1.0, 0.1)], a: [dir(0.6, -0.1, 0.2), dir(0.8, 0.2, 0.2), dir(0.5, 0.4, 0.2), dir(0.2, -0.5, 0.5)] };
    case 'glance':
      return { t: [0.07, 0.18, 0.34, 0.6], G: [at(0.30, 0.95, 0.25), at(0.28, 1.0, 0.3), at(0.28, 1.0, 0.3), at(0.25, 1.0, 0.2)], a: [dir(0.2, -0.3, 0.9), dir(0.1, -0.1, 1.0), dir(0.1, 0.0, 0.95), dir(0.2, -0.5, 0.7)] };
    case 'block':
      return { t: [0.07, 0.2, 0.4, 0.7], G: [at(0.34, 0.86, 0.22), at(0.36, 0.84, 0.24), at(0.34, 0.84, 0.22), at(0.30, 0.8, 0.1)], a: [dir(0.15, -0.98, 0.1), dir(0.2, -0.97, 0.1), dir(0.2, -0.97, 0.1), dir(-0.1, -0.97, 0.1)] };
    default: // drive: through the line, then high over the front shoulder
      return { t: [0.06, 0.16, 0.32, 0.62], G: [at(0.52, 0.98, 0.45), at(0.42, 1.18, 0.6), at(0.22, 1.50, 0.55), at(0.30, 1.05, 0.30)], a: [dir(0.8, 0.3, 0.4), dir(0.2, 0.9, 0.2), dir(-0.5, 0.65, 0.45), dir(0.2, -0.3, 0.8)] };
  }
}
