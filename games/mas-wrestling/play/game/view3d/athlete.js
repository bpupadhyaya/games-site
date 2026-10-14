// One seated athlete: a real 3D person (view3d Rocketbox avatar) posed from the simulation's own numbers every frame.
// No clips are played. A custom pose layer writes the sitting body (pelvis on the mat, trunk pitch, head, thighs, calves, shoulders); hands are
// reached to grips on the stick and feet are braced flat against the block with the library's IK and contact helpers.
//
// LEGS (v1.1.0, owner: "they look like broken legs"): the old pre-pose put the thighs 28 deg BELOW horizontal, so the IK knee plane was
// "knee down" and the knees folded backwards / splayed through the floor. Now the hip and knee angles are SOLVED from the real leg lengths
// (law of cosines) for the wanted knee flexion, the thigh/calf offsets are written from that solution (knee ABOVE the hip-ankle line, always
// flexing the right way) and the IK only refines the last millimetres. The hips slide on the mat: legs straighten on a pull, bend when drawn in.
// Presentation only: it reads the sim state handed in by the presenter and never writes back. Smooth: every drive value is eased.
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Metres. The athlete's own frame: +Z forward (toward the rival), +X the athlete's left, +Y up.
export const GEOM = {
  matY: 0.045,           // the top of the mat above the floor
  faceX: 0.055,          // the block's face from the middle of the block
  ankleH: 0.085,         // ankle height above the mat with the heel on it and the sole flat on the block
  hipH: 0.105,           // hip joint above the mat when seated flat
  stickY: 0.50,          // stick height above the floor
  stickDraw: 0.2,        // stick travel for a full draw
  grip: [0.11, 0.30],    // the two hands: distance from the stick centre toward the athlete
  stickHalf: 0.62,
  kneeMin: 5, kneeMax: 60,   // knee flexion range used while seated (deg); the human range is 0..140
};

export async function createAthlete(V3, o) {
  const { THREE, loadHuman, CLIP_BONES, semanticRot, FINGER_POSES } = V3;
  const h = await loadHuman({ character: o.character || 'athlete_m', kit: o.kit, skin: o.skin, hair: o.hair, quality: o.quality || 'high' });
  const side = o.side | 0;                       // 0: left of the screen (faces +X), 1: right (faces -X)
  const dir = side === 0 ? 1 : -1;
  h.groundClamp = 'off';
  h.footPlanting = false;
  h.comfortTilt = 0;
  h.setFacing(side === 0 ? Math.PI / 2 : -Math.PI / 2);

  const idx = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);
  const BONES = ['Pelvis', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'L_Clavicle', 'R_Clavicle', 'L_UpperArm', 'R_UpperArm', 'L_Forearm', 'R_Forearm', 'L_Thigh', 'R_Thigh', 'L_Calf', 'R_Calf'];
  const bi = Object.fromEntries(BONES.map((n) => [n, idx(n)]));
  const off = Object.fromEntries(BONES.map((n) => [n, { flex: 0, side: 0, twist: 0, abduct: 0, rot: [0, 0, 0] }]));
  const ph = h.pelvisHeight;
  const e = new THREE.Euler(0, 0, 0, 'XYZ'), qo = new THREE.Quaternion(), qb = new THREE.Quaternion();
  let pelvisY = 0;   // pelvis height above the floor (metres), written to the pose each evaluation
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // measured once: leg segment lengths, arm length, torso length (pelvis to shoulder)
  h.root.position.set(0, 0, 0); h.root.updateMatrixWorld(true);
  const bp = (n) => h.bonePosition(n, V());
  const LEG = { l1: bp('L_Thigh').distanceTo(bp('L_Calf')), l2: bp('L_Calf').distanceTo(bp('L_Foot')) };
  const ARM = bp('L_UpperArm').distanceTo(bp('L_Forearm')) + bp('L_Forearm').distanceTo(bp('L_Hand'));
  const TORSO = Math.max(0.3, bp('L_UpperArm').y - bp('Pelvis').y);   // shoulder height above the pelvis when upright

  // The pose layer: appended after the (empty) base layer, so the rest pose is its input.
  const layer = {
    name: 'seat', maskName: 'custom', mask: null, additive: false, weight: 1, tracks: [],
    get current() { return null; }, play() {}, stop() {}, setWeight() {}, update() {},
    evaluate(out) {
      for (const n of BONES) {
        const r = semanticRot(n, off[n]), i = bi[n];
        if (!(r[0] || r[1] || r[2])) continue;
        qb.set(out.q[i * 4], out.q[i * 4 + 1], out.q[i * 4 + 2], out.q[i * 4 + 3]);
        qo.setFromEuler(e.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, 'XYZ'));
        qb.multiply(qo);
        out.q[i * 4] = qb.x; out.q[i * 4 + 1] = qb.y; out.q[i * 4 + 2] = qb.z; out.q[i * 4 + 3] = qb.w;
      }
      out.p[1] += (pelvisY - ph) / ph;
      return true;
    },
  };
  h.layerList.push(layer);

  // smoothed drive values (exponential springs toward the sim's numbers; the sim ticks at 60 Hz, the picture may run faster)
  const S = { lean: 0.2, rise: 0, dig: 0, effort: 0, pull: 0, up: 0, st: 1, joy: 0, lose: 0, shake: 0, knee: 15, hipX: 0.97, slideV: 0, adv: 0, pitch: 10, bias: 0 };
  const info = { kneeFlex: 0, hipFlex: 0, reach: 1, slide: 0 };
  let hipXPrev = null;

  // fingers: wrap the rod (hand3d 'gripRod' preset math: curl each finger from the relaxed pose toward the fist)
  const FIST = FINGER_POSES.fist, REL = FINGER_POSES.flat, OPEN = FINGER_POSES.open;
  const FN = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  function gripPose(k) {
    const w = [0.45 + 0.35 * k, 0.62 + 0.3 * k, 0.66 + 0.3 * k, 0.7 + 0.28 * k, 0.74 + 0.25 * k];
    const curl = FN.map((n, f) => FIST.curl[f].map((c, i) => lerp(f === 0 ? OPEN.curl[0][i] : REL.curl[f][i], c, clamp(w[f], 0, 1))));
    return { curl, spread: OPEN.spread.map(() => 0) };
  }
  let fingerKey = -1;

  /**
   * p: { lean, rise, dig, shake, joy, lose, m, b, u, st, stick: { c: {x,y}, dir: {x,y} }, foe, t, adv }
   * adv: how far this athlete is winning the draw (-1 drawn toward the block .. +1 pulled the stick to me).
   */
  function pose(p, dt) {
    const k = (rate) => 1 - Math.exp(-dt * rate);
    S.lean += (p.lean - S.lean) * k(10);
    S.rise += (p.rise - S.rise) * k(9);
    S.dig += (p.dig - S.dig) * k(10);
    S.effort += (p.m - S.effort) * k(9);
    S.pull += (p.b - S.pull) * k(12);
    S.up += (p.u - S.up) * k(12);
    S.st += (p.st - S.st) * k(5);
    S.joy += (p.joy - S.joy) * k(5);
    S.lose += (p.lose - S.lose) * k(4);
    S.adv += ((p.adv || 0) - S.adv) * k(3.2);
    S.shake = p.shake;
    const t = p.t;
    const effort = S.effort, tired = 1 - clamp(S.st / 0.45, 0, 1);
    const lift = clamp(S.rise, 0, 1);
    const pull = clamp(S.pull, 0, 1);

    // ---- legs: wanted knee flexion (deg). Nearly straight while braced and pulling; bends when the stick is drawn toward the block, when
    // the athlete sinks or is lifted. Eased with a slow spring so the hips SLIDE on the mat instead of snapping.
    let kneeWant = 15 - 9 * pull * (1 - lift) - 5 * clamp(S.adv, 0, 1) + 26 * clamp(-S.adv, 0, 1) + 14 * S.dig + 12 * lift + 4 * tired * (1 - S.joy);
    kneeWant += (S.shake ? Math.sin(t * 53 + side) * 1.2 * S.shake : 0) + Math.sin(t * 6.8 + side * 2) * 0.5 * effort;   // quads trembling under load
    kneeWant = clamp(kneeWant, GEOM.kneeMin, GEOM.kneeMax);
    S.knee += (kneeWant - S.knee) * k(6.5);
    const knee = S.knee;

    // ---- where the ankles are: sole flat on the block face, heel on the mat (rises when the athlete is lifted)
    const ankleY = GEOM.matY + GEOM.ankleH + 0.20 * Math.max(0, lift - 0.5) / 0.5;
    const hipY = GEOM.matY + GEOM.hipH + 0.30 * lift;
    const ankleX = GEOM.faceX + 0.075;           // the foot is vertical: the ankle sits ~7.5 cm behind the sole plane
    const { l1, l2 } = LEG;
    const d = Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos((180 - knee) * D2R));   // hip-ankle distance for this knee flexion
    const dy = ankleY - hipY;
    const dh = Math.sqrt(Math.max(0.01, d * d - dy * dy));
    const hipX = ankleX + dh;
    S.hipX = hipX;
    pelvisY = hipY;
    h.root.position.set(dir * -hipX, 0, 0);
    h.root.updateMatrixWorld(true);
    if (hipXPrev !== null && dt > 0) S.slideV += ((hipX - hipXPrev) / dt - S.slideV) * k(10);
    hipXPrev = hipX;
    info.slide = S.slideV;

    // hip flexion from the same triangle: elevation of the hip->ankle line + the angle between the thigh and that line
    const ang = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)) * R2D;
    const lineEl = Math.atan2(dy, dh) * R2D;
    const thighEl = lineEl + ang;                // the knee is ABOVE the line

    // ---- trunk: pitch (deg, + forward toward the stick). The hands are on the stick, so the trunk leans as far as the arms need: pulling hard
    // stretches the arms and sits the body back, relaxing lets the elbows bend.
    const sgn = side === 0 ? -1 : 1;
    const gm = (GEOM.grip[0] + GEOM.grip[1]) / 2;
    const hx = p.stick ? p.stick.c.x + p.stick.dir.x * sgn * gm : dir * -0.2, hy = p.stick ? p.stick.c.y + p.stick.dir.y * sgn * gm : GEOM.stickY;
    const frac = clamp(0.78 + 0.2 * pull + 0.04 * S.up - 0.1 * S.dig, 0.7, 0.99);
    const want = ARM * frac;
    let pitch = 10, best = 1e9;
    for (let a = -32; a <= 50; a += 1) {
      const ar = a * D2R, sx = dir * -hipX + dir * Math.sin(ar) * TORSO, sy = hipY + Math.cos(ar) * TORSO;
      const err = Math.abs(Math.hypot(hx - sx, hy - sy) - want);
      if (err < best) { best = err; pitch = a; }
    }
    S.pitch += (pitch - S.pitch) * k(9);
    pitch = S.pitch + 8 * tired * (1 - S.joy) + 24 * S.lose - 14 * S.joy + 4 * S.dig;
    const breath = Math.sin(t * (2.1 + 1.7 * effort) + side) * (0.5 + 1.8 * effort);
    pitch += breath * 0.8 + (S.shake ? Math.sin(t * 61) * 1.1 * S.shake : 0);
    const pelvisTilt = pitch * 0.2;
    const spineEach = (pitch - pelvisTilt) / 3;
    off.Pelvis.flex = pelvisTilt;
    off.Spine.flex = spineEach; off.Spine1.flex = spineEach; off.Spine2.flex = spineEach;
    off.Spine.twist = off.Spine1.twist = off.Spine2.twist = Math.sin(t * 1.3 + side) * 1.0 + (S.shake ? Math.sin(t * 47) * 1.2 * S.shake : 0);
    off.Spine1.side = off.Spine2.side = (side ? -1 : 1) * 2.0 * S.up;
    off.Neck.flex = -0.30 * pitch - 5 * effort + 9 * tired + 14 * S.lose;
    off.Head.flex = -0.36 * pitch - 4 * effort + 6 * tired + 9 * S.lose + 5 * S.joy;
    off.Head.twist = Math.sin(t * 0.9 + side * 2) * 1.3;
    off.L_Clavicle.rot = [0, 0, 0]; off.R_Clavicle.rot = [0, 0, 0];

    // ---- legs: write the SOLVED hip and knee angles (thigh flex + = knee forward; 90 deg is a thigh lying forward on the mat). The pelvis tilt
    // rotates the thighs too, so take it out.
    // closed loop: the measured knee elevation of the last frame corrects the pre-pose (the rig's own rest angles are not exactly 90 deg)
    {
      const hp = bp('L_Thigh'), kp = bp('L_Calf');
      const meas = Math.atan2(kp.y - hp.y, Math.abs(kp.x - hp.x)) * R2D;
      if (info.primed) S.bias = clamp(S.bias + clamp(thighEl - meas, -6, 6) * 0.35, -25, 25);
      info.primed = true;
    }
    const thighFlex = 90 + thighEl - pelvisTilt + S.bias;
    off.L_Thigh.flex = off.R_Thigh.flex = thighFlex;
    off.L_Thigh.abduct = off.R_Thigh.abduct = 1.5;
    off.L_Calf.flex = off.R_Calf.flex = knee;
    info.kneeFlex = knee; info.hipFlex = thighFlex;

    // ---- arms (preposed before IK so the elbows hang outward and down)
    const celebrate = S.joy;
    off.L_UpperArm.flex = off.R_UpperArm.flex = lerp(48, 118, celebrate);
    off.L_UpperArm.abduct = off.R_UpperArm.abduct = lerp(14, 58, celebrate);
    off.L_Forearm.flex = off.R_Forearm.flex = lerp(30, 14, celebrate);

    // fingers: wrap tighter as the effort rises
    const gk = clamp(0.35 + 0.65 * effort, 0, 1);
    const key = Math.round(gk * 20) + (S.joy > 0.5 ? 100 : 0);
    if (key !== fingerKey) { fingerKey = key; if (S.joy > 0.5) h.setFingers('both', 'fist'); else h.setFingers('both', gripPose(gk)); }

    // the face: where the head looks
    if (p.foe) h.lookAt(p.foe, { weight: 0.55, maxYaw: 0.5, maxPitch: 0.4 }); else h.lookAt(null);

    // ---- feet braced on the block face (sole flat, toes up); hip and knee are already posed, the IK only refines
    const faceX = dir * -GEOM.faceX;
    const lat = V(1, 0, 0).applyQuaternion(h.root.quaternion);   // the avatar's left in world
    for (const s of ['L', 'R']) {
      const zz = (s === 'L' ? 1 : -1) * 0.105;
      const world = V(faceX, ankleY + 0.035, 0).addScaledVector(lat, zz);
      const n = V(-dir, 0, 0), fwd = V(0, 1, 0);
      const fq = V3.footQuat(h, s, n, fwd, 'sole');
      const ankle = V3.ankleForBall(h, s, world, n, fwd, 'sole', 0.0);
      ankle.y = ankleY; ankle.x = dir * -ankleX;
      h.setReachFoot(s, ankle, 1, fq);
    }

    // ---- hands on the stick
    info.reach = 1;
    if (p.stick) {
      const st = p.stick, hold = 1 - celebrate;
      GEOM.grip.forEach((dd, i) => {
        const hand = i === 0 ? 'R' : 'L';
        const c = V(st.c.x + st.dir.x * sgn * dd, st.c.y + st.dir.y * sgn * dd, 0);
        const inward = V(0, 0, 0).addScaledVector(lat, hand === 'L' ? -1 : 1);
        const sd = V(st.dir.x * dir, st.dir.y * dir, 0);
        const n = inward.clone().multiplyScalar(Math.cos(0.65)).add(V(0, -Math.sin(0.65), 0)).normalize();
        const fx = V().crossVectors(sd, n).normalize().multiplyScalar(hand === 'L' ? 1 : -1);
        const sol = V3.solvePalmBall(h, hand, c, n, fx, 0.018);
        if (!sol.reachable) info.reach = 0;
        const pole = V(h.root.position.x, 0.3, 0).addScaledVector(lat, hand === 'L' ? 0.75 : -0.75).add(V(dir * 0.1, 0.0, 0));
        h.setReach(hand, sol.wrist, { weight: hold, quat: sol.quat, pole });
      });
    } else { h.setReach('L', null); h.setReach('R', null); }
  }

  // joint log for the anatomy gate (degrees): knee flexion (0..140, never negative), shin-foot angle, which side of the leg line the knee is on
  function joints() {
    h.root.updateMatrixWorld(true);
    const out = {};
    for (const s of ['L', 'R']) {
      const hip = bp(`${s}_Thigh`), kn = bp(`${s}_Calf`), an = bp(`${s}_Foot`), toe = bp(`${s}_Toe0`);
      const a = hip.clone().sub(kn).normalize(), b = an.clone().sub(kn).normalize();
      const kneeInt = Math.acos(clamp(a.dot(b), -1, 1)) * R2D;
      const shin = kn.clone().sub(an).normalize(), foot = toe.clone().sub(an).normalize();
      const ankle = Math.acos(clamp(shin.dot(foot), -1, 1)) * R2D;
      const t = clamp(hip.distanceTo(kn) / Math.max(1e-6, hip.distanceTo(kn) + kn.distanceTo(an)), 0, 1);
      const lineY = lerp(hip.y, an.y, t);
      out[s] = { hip: hip.toArray(), knee: kn.toArray(), ankle: an.toArray(), toe: toe.toArray(), kneeFlex: 180 - kneeInt, ankleAngle: ankle, kneeAbove: kn.y - lineY, legLen: hip.distanceTo(kn) + kn.distanceTo(an), reach: hip.distanceTo(an) };
    }
    return out;
  }

  return { h, root: h.root, pose, side, dir, S, info, joints, LEG, ARM };
}
