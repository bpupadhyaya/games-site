// Limb anatomy: measurement + runtime sanity clamp for the Rocketbox "Bip01" athletes.
//   measureLimbs(human)      -> per-frame joint angles (knee/elbow flexion, foot yaw vs knee plane, wrist, finger, bone lengths)
//   limbIssues(m, ref)       -> list of { code, side, sev: 'warn'|'severe', value } for ONE measured frame
//   limbSanity(human, opts)  -> runtime clamp: call AFTER every IK/pose override and BEFORE props are attached/rendered.
//                               Fixes inverted/hyperextended knees+elbows (bends the limb the right way, keeps the end point),
//                               foot yaw twisted away from the knee plane, wrist breaking past its range. Idempotent, cheap.
// No THREE import: positions are read from matrixWorld.elements so tools can run it in any page that has the Human.
// Axis convention (view3d): avatar faces +Z, avatar's LEFT is +X, Y up.

const SIDES = ['L', 'R'];
const D2R = Math.PI / 180;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b)))));

function wp(b) { const e = b.matrixWorld.elements; return [e[12], e[13], e[14]]; }

// ---- joint decomposition from LOCAL bone rotations (pose/orientation independent) ----
// A joint's rotation relative to its rest rotation is split into: flexion about the hinge axis (signed), swing off that axis,
// and twist about the bone's long axis. Hinge axes are calibrated per rig once from the rest pose (which way does the shin / hand go).
function ctors(h) { const Q = h.root.quaternion.constructor, V = h.root.position.constructor; return { Q, V }; }
function relQ(h, bone, name, C) {
  const i = CB.indexOf(name), r = h.restPose.q;
  const rest = new C.Q(r[i * 4], r[i * 4 + 1], r[i * 4 + 2], r[i * 4 + 3]);
  return rest.invert().multiply(bone.quaternion);   // delta in the bone's rest-local frame (post-multiplied)
}
const CB = ['Bip01_Pelvis', 'Bip01_Spine', 'Bip01_Spine1', 'Bip01_Spine2', 'Bip01_Neck', 'Bip01_Head', 'Bip01_L_Clavicle', 'Bip01_L_UpperArm', 'Bip01_L_Forearm', 'Bip01_L_Hand', 'Bip01_R_Clavicle', 'Bip01_R_UpperArm', 'Bip01_R_Forearm', 'Bip01_R_Hand', 'Bip01_L_Thigh', 'Bip01_L_Calf', 'Bip01_L_Foot', 'Bip01_L_Toe0', 'Bip01_R_Thigh', 'Bip01_R_Calf', 'Bip01_R_Foot', 'Bip01_R_Toe0'];

function qAxisAngle(q) { let w = Math.max(-1, Math.min(1, q.w)); let a = 2 * Math.acos(Math.abs(w)); const s = Math.sqrt(1 - w * w) || 1; const sg = w < 0 ? -1 : 1; return { a, x: sg * q.x / s, y: sg * q.y / s, z: sg * q.z / s }; }
/** signed rotation of q about unit axis `ax` (swing-twist), radians in (-pi, pi] */
function twistAbout(q, ax) { const sg = q.w < 0 ? -1 : 1; const p = sg * (q.x * ax.x + q.y * ax.y + q.z * ax.z); return 2 * Math.atan2(p, Math.abs(q.w)); }

/** Calibrate hinge axes (bone-local) on first use. Returns { knee: Vector3, elbow: Vector3, legAxis: Vector3, armAxis: Vector3 } for side L (R mirrored by the rig). */
function calibrate(h) {
  if (h._limbCal) return h._limbCal;
  const C = ctors(h), { Q, V } = C;
  const saved = CB.map((n) => h.bones[n].quaternion.clone());
  const pel = h.pelvis.position.clone();
  h._applyRest(); h.root.updateMatrixWorld(true);
  const cal = {};
  for (const s of SIDES) {
    const out = {};
    const lat = new V(); const fwdW = new V(0, 0, 1).applyQuaternion(h.root.getWorldQuaternion(new Q())), upW = new V(0, 1, 0);
    for (const [name, mid, end, want, key] of [['knee', `Bip01_${s}_Calf`, `Bip01_${s}_Foot`, fwdW.clone().negate(), 'k'], ['elbow', `Bip01_${s}_Forearm`, `Bip01_${s}_Hand`, fwdW.clone(), 'e']]) {
      const b = h.bones[mid], e = h.bones[end]; const q0 = b.quaternion.clone();
      const pm = new V(), p0 = e.getWorldPosition(new V()); b.getWorldPosition(pm);
      let best = null;
      for (const ax of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) for (const sg of [1, -1]) {
        b.quaternion.copy(q0).multiply(new Q().setFromAxisAngle(new V(...ax), 0.6 * sg)); h.root.updateMatrixWorld(true);
        const d = e.getWorldPosition(new V()).sub(p0);
        // bending a hinge moves the end point in the bend direction; pick the candidate that moves it most toward `want`
        const sc = d.dot(want) - Math.abs(d.y) * 0.2;
        if (!best || sc > best.sc) best = { sc, ax: new V(...ax).multiplyScalar(sg) };
      }
      b.quaternion.copy(q0); h.root.updateMatrixWorld(true);
      out[name] = best.ax;
      // the same axis expressed in the UPPER bone's frame (thigh / upper arm): the hinge is attached to it, so its world direction follows the hip / shoulder
      const upper = b.parent;
      const axW = best.ax.clone().applyQuaternion(b.getWorldQuaternion(new Q()));
      out[name + 'Up'] = axW.applyQuaternion(upper.getWorldQuaternion(new Q()).invert());
    }
    cal[s] = out;
  }
  CB.forEach((n, i) => h.bones[n].quaternion.copy(saved[i])); h.pelvis.position.copy(pel); h.root.updateMatrixWorld(true);
  h._limbCal = cal; return cal;
}

/** Limb angles for one frame (radians), from local bone rotations + world joint positions (for bone lengths). */
export function measureLimbs(h, { update = true } = {}) {
  const C = ctors(h);
  const cal = calibrate(h);
  if (update) h.root.updateMatrixWorld(true);
  const B = h.bones, P = (n) => wp(B[`Bip01_${n}`]);
  const out = { sides: {} };
  const e = h.root.matrixWorld.elements;
  out.rootPos = [e[12], e[13], e[14]];
  for (const s of SIDES) {
    const hip = P(`${s}_Thigh`), knee = P(`${s}_Calf`), ank = P(`${s}_Foot`), toe = P(`${s}_Toe0`);
    const sh = P(`${s}_UpperArm`), el = P(`${s}_Forearm`), wr = P(`${s}_Hand`);
    const foot = relQ(h, B[`Bip01_${s}_Foot`], `Bip01_${s}_Foot`, C), hand = relQ(h, B[`Bip01_${s}_Hand`], `Bip01_${s}_Hand`, C);
    const thigh = relQ(h, B[`Bip01_${s}_Thigh`], `Bip01_${s}_Thigh`, C);
    // hinge flexion from geometry: the bend plane of the limb vs the hinge axis carried by the upper bone (world)
    const hingeOf = (upperBone, axisUp, a, b2, c2) => {
      const u = sub(b2, a), v = sub(c2, b2);
      const q = upperBone.getWorldQuaternion(new C.Q());
      const hw = axisUp.clone().applyQuaternion(q);
      const hwv = [hw.x, hw.y, hw.z];
      const cr = cross(u, v), crl = len(cr);
      const flex = Math.atan2(dot(cr, hwv), dot(u, v));            // signed angle about the hinge
      const ang = Math.atan2(crl, dot(u, v));                        // unsigned bend
      // how far the bend plane normal is from the hinge axis (0 = a clean hinge)
      const off = crl > 1e-5 && ang > 0.17 ? Math.acos(Math.min(1, Math.abs(dot(cr, hwv)) / crl)) : 0;
      return { flex, off };
    };
    const kh = hingeOf(B[`Bip01_${s}_Thigh`], cal[s].kneeUp, hip, knee, ank);
    const eh = hingeOf(B[`Bip01_${s}_UpperArm`], cal[s].elbowUp, sh, el, wr);
    const kneeFlex = kh.flex, offKnee = kh.off, elbowFlex = eh.flex, offElbow = eh.off;
    // toe-out: the foot should point perpendicular to the knee hinge axis (angle of the foot direction out of that plane)
    const kq = B[`Bip01_${s}_Thigh`].getWorldQuaternion(new C.Q());
    const kax = cal[s].kneeUp.clone().applyQuaternion(kq);
    const fdir = norm(sub(toe, ank));
    const toeOut = Math.asin(Math.max(-1, Math.min(1, dot(fdir, [kax.x, kax.y, kax.z]))));
    const fore = relQ(h, B[`Bip01_${s}_Forearm`], `Bip01_${s}_Forearm`, C);
    const total = (q) => qAxisAngle(q).a;
    // off-hinge part: what is left of the mid-bone rotation after removing the hinge (varus/valgus/twist the knee/elbow cannot do)
    // twist about each bone's long axis: bone-local direction to its child (rest)
    const longAxis = (bone) => { const c = bone.children.find((k) => k.isBone) || null; if (!c) return new C.V(0, 1, 0); return c.position.clone().normalize(); };
    const hipTwist = twistAbout(thigh, longAxis(B[`Bip01_${s}_Thigh`]));
    const forearmTwist = twistAbout(fore, longAxis(B[`Bip01_${s}_Forearm`]));
    const wristTotal = total(hand), footTotal = total(foot);
    // wrist bend (swing of the hand relative to the forearm, twist removed): angle between forearm axis and hand axis
    const kn = P(`${s}_Finger2`);
    const wristBend = angle(sub(wr, el), sub(kn, wr));
    // finger flexion actually applied by the FingerRig (radians, max over joints); posed by name/curl presets, so overcurl = a bad preset
    let fingerMax = 0;
    const fr = h.fingers && h.fingers[s];
    if (fr && fr.pose) for (const row of fr.pose.curl) for (const v of row) fingerMax = Math.max(fingerMax, Math.abs(v));
    out.sides[s] = {
      hip, knee, ank, toe, sh, el, wr,
      kneeFlex, elbowFlex, offKnee, offElbow, toeOut, hipTwist, forearmTwist, wristBend, wristTotal, footTotal, fingerMax,
      thighLen: len(sub(knee, hip)), shinLen: len(sub(ank, knee)), upLen: len(sub(el, sh)), faLen: len(sub(wr, el)),
    };
  }
  return out;
}

export const LIMIT = {   // tuned so the shared clip library (visually verified) has no severe findings except genuine pose extremes
  kneeHyperWarn: -12 * D2R, kneeHyperSevere: -22 * D2R,
  elbowHyperWarn: -25 * D2R, elbowHyperSevere: -45 * D2R,
  offWarn: 50 * D2R, offSevere: 75 * D2R,            // knee bend plane vs its hinge (only judged when bent > 30 deg)
  toeOutWarn: 40 * D2R, toeOutSevere: 60 * D2R,      // foot direction out of the knee's plane
  hipTwistWarn: 70 * D2R, hipTwistSevere: 100 * D2R,
  forearmTwistWarn: 110 * D2R, forearmTwistSevere: 150 * D2R,
  wristWarn: 65 * D2R, wristSevere: 90 * D2R,
  footWarn: 80 * D2R, footSevere: 115 * D2R,
  fingerWarn: 125 * D2R, fingerSevere: 150 * D2R,
  lenDriftWarn: 0.03, lenDriftSevere: 0.08,
};

/** Issues for one measured frame. `ref` = restLengths(m) for drift, optional. */
export function limbIssues(m, ref = null) {
  const L = LIMIT, out = [];
  const add = (code, side, sev, value) => out.push({ code, side, sev, value: +(+value).toFixed(3) });
  const deg = (r) => r / D2R;
  const band = (code, s, v, w, sv) => { const a = Math.abs(v); if (a > sv) add(code, s, 'severe', deg(v)); else if (a > w) add(code, s, 'warn', deg(v)); };
  for (const s of SIDES) {
    const j = m.sides[s];
    if (j.kneeFlex < L.kneeHyperSevere) add('knee-inverted', s, 'severe', deg(j.kneeFlex)); else if (j.kneeFlex < L.kneeHyperWarn) add('knee-hyperext', s, 'warn', deg(j.kneeFlex));
    if (j.elbowFlex < L.elbowHyperWarn && j.elbowFlex > -1.6) add('elbow-reversed', s, 'warn', deg(j.elbowFlex));
    if (Math.abs(j.kneeFlex) > 0.52) band('knee-twisted', s, j.offKnee, L.offWarn, L.offSevere);
    band('foot-toe-out', s, j.toeOut, L.toeOutWarn, L.toeOutSevere);
    band('hip-twist', s, j.hipTwist, L.hipTwistWarn, L.hipTwistSevere);
    band('forearm-twist', s, j.forearmTwist, L.forearmTwistWarn, L.forearmTwistSevere);
    band('ankle-range', s, j.footTotal, L.footWarn, L.footSevere);
    band('wrist-bend', s, j.wristBend, L.wristWarn, L.wristSevere);
    band('finger-curl', s, j.fingerMax, L.fingerWarn, L.fingerSevere);
    if (ref) for (const [k, n] of [['thighLen', 'thigh'], ['shinLen', 'shin'], ['upLen', 'upperarm'], ['faLen', 'forearm']]) {
      const d = Math.abs(j[k] / ref[s][k] - 1);
      if (d > L.lenDriftSevere) add(`${n}-length`, s, 'severe', d); else if (d > L.lenDriftWarn) add(`${n}-length`, s, 'warn', d);
    }
  }
  return out;
}

export function restLengths(m) {
  const r = {};
  for (const s of SIDES) { const j = m.sides[s]; r[s] = { thighLen: j.thighLen, shinLen: j.shinLen, upLen: j.upLen, faLen: j.faLen }; }
  return r;
}

// ------------------------------------------------------------------ runtime clamp
/**
 * Fix limbs that ended up anatomically wrong after clips + IK + presenter overrides. Safe to call every frame; cheap
 * (one measure, corrections only when a limit is crossed; a sane pose is left untouched). Human.update() already runs it at
 * the end of its post pass (human.limbSanityOn = false disables); call `human.limbSanity()` again yourself if you move bones AFTER update().
 *   knees:    hyperextension removed (rotated back about the hinge axis), shin plane pulled back toward the hinge
 *   feet:     toe-out beyond ~35 deg rotated back about the shin axis; ankle range limited
 *   hips / forearms: axial twist beyond range pulled back to the limit (no inverted foot, no candy-wrapper)
 *   wrists:   total bend limited (blends toward the rest relation)
 * opts: { knees, feet, hips, forearms, wrists } set false to skip a family. Returns the number of corrections applied.
 */
export function limbSanity(h, opts = {}) {
  const { update = true } = opts;
  const C = ctors(h);
  const cal = calibrate(h);
  let n = 0;
  const restQ = (name) => { const i = CB.indexOf(name), r = h.restPose.q; return new C.Q(r[i * 4], r[i * 4 + 1], r[i * 4 + 2], r[i * 4 + 3]); };
  const longAxis = (bone) => { const c = bone.children.find((k) => k.isBone); return c ? c.position.clone().normalize() : new C.V(0, 1, 0); };
  const rotateWorld = (bone, axisW, ang) => {   // rotate `bone` (and its children) by ang about a WORLD axis, keeping its position
    const pq = bone.parent.getWorldQuaternion(new C.Q());
    const wq = bone.getWorldQuaternion(new C.Q());
    const nq = new C.Q().setFromAxisAngle(axisW, ang).multiply(wq);
    bone.quaternion.copy(pq.invert().multiply(nq));
    bone.updateMatrixWorld(true);
  };
  if (update) h.root.updateMatrixWorld(true);
  let m = measureLimbs(h, { update: false });
  for (const s of SIDES) {
    const j = m.sides[s];
    const thigh = h.bones[`Bip01_${s}_Thigh`], calf = h.bones[`Bip01_${s}_Calf`], foot = h.bones[`Bip01_${s}_Foot`];
    if (opts.hips !== false && Math.abs(j.hipTwist) > LIMIT.hipTwistWarn) {
      const rel = relQ(h, thigh, `Bip01_${s}_Thigh`, C), ex = j.hipTwist - Math.sign(j.hipTwist) * LIMIT.hipTwistWarn;
      thigh.quaternion.copy(restQ(`Bip01_${s}_Thigh`).multiply(new C.Q().setFromAxisAngle(longAxis(thigh), -ex).multiply(rel))); n++;
      thigh.updateMatrixWorld(true);
      m = measureLimbs(h, { update: false });
    }
    const jj = m.sides[s];
    if (opts.knees !== false && jj.kneeFlex < LIMIT.kneeHyperWarn) {
      const hw = cal[s].kneeUp.clone().applyQuaternion(thigh.getWorldQuaternion(new C.Q())).normalize();
      // flex < 0: bent backwards. Rotate the shin about the hinge by -flex (+ a degree of margin) so the leg is straight, not reversed
      rotateWorld(calf, hw, -jj.kneeFlex + 0.02); n++;
    }
    if (opts.feet !== false) {
      const kax = cal[s].kneeUp.clone().applyQuaternion(thigh.getWorldQuaternion(new C.Q())).normalize();
      const dirOf = () => { const e = (b) => { const w = b.matrixWorld.elements; return new C.V(w[12], w[13], w[14]); }; return e(h.bones[`Bip01_${s}_Toe0`]).sub(e(foot)).normalize(); };
      foot.updateMatrixWorld(true); h.bones[`Bip01_${s}_Toe0`].updateMatrixWorld(true);
      const co = dirOf().dot(kax), lim = Math.sin(LIMIT.toeOutWarn * 0.85);
      if (Math.abs(co) > Math.sin(LIMIT.toeOutWarn)) {
        const ex = Math.asin(Math.max(-1, Math.min(1, co))) - Math.sign(co) * Math.asin(lim);
        const e = (b) => { const w = b.matrixWorld.elements; return new C.V(w[12], w[13], w[14]); };
        const shin = e(foot).sub(e(calf)).normalize();
        rotateWorld(foot, shin, ex);
        h.bones[`Bip01_${s}_Toe0`].updateMatrixWorld(true);
        if (Math.abs(dirOf().dot(kax)) > Math.abs(co)) { rotateWorld(foot, shin, -2 * ex); h.bones[`Bip01_${s}_Toe0`].updateMatrixWorld(true); }
        n++;
      }
    }
  }
  m = measureLimbs(h, { update: false });
  for (const s of SIDES) {
    const j = m.sides[s];
    const untwist = (name, bone, tw, lim) => {
      if (Math.abs(tw) <= lim) return;
      const rel = relQ(h, bone, name, C), ax = longAxis(bone);
      const excess = tw - Math.sign(tw) * lim;
      bone.quaternion.copy(restQ(name).multiply(new C.Q().setFromAxisAngle(ax, -excess).multiply(rel))); bone.updateMatrixWorld(true); n++;
    };
    if (opts.forearms !== false) untwist(`Bip01_${s}_Forearm`, h.bones[`Bip01_${s}_Forearm`], j.forearmTwist, LIMIT.forearmTwistWarn);
    const shrink = (name, bone, tot, lim) => {
      if (tot <= lim) return;
      const rel = relQ(h, bone, name, C);
      bone.quaternion.copy(restQ(name).multiply(new C.Q().slerp(rel, lim / tot))); bone.updateMatrixWorld(true); n++;
    };
    if (opts.feet !== false) shrink(`Bip01_${s}_Foot`, h.bones[`Bip01_${s}_Foot`], j.footTotal, LIMIT.footWarn);
    if (opts.wrists !== false) shrink(`Bip01_${s}_Hand`, h.bones[`Bip01_${s}_Hand`], j.wristTotal, LIMIT.wristWarn * 1.6);
  }
  if (n) h.root.updateMatrixWorld(true);
  return n;
}
