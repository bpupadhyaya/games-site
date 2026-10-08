// Contact helpers generalised from the games' local code: (1) a ball-foot contact solver, (2) named body-surface points + limb reach for paired
// contacts (tackles, tags, holds), (3) body capsules and a penetration check/resolver, (4) an airborne whole-body rotation (flips, rolls, spins).
// The SIM decides when and between whom; these only make the pictures meet on the surfaces without passing through each other.
import * as THREE from './three.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
const UP = V(0, 1, 0);

// ------------------------------------------------------------------ ball-foot contact
// Foot sole frame (rest pose, in the FOOT bone's local space): fwd = toes, up = top of the foot, left = the avatar's left.
function soleFrame(h, s) { return h._sole[s]; }   // captured from the rest pose when the human is built: independent of the root's orientation
// surface point of a foot face relative to the ankle, in sole axes (metres), and the face's outward direction in sole axes
function faceGeom(side, face) {
  const sgn = side === 'R' ? 1 : -1;
  if (face === 'inside') return { s: [0.06, 0, 0.04 * sgn], n: [0, 0, sgn] };       // [fwd, up, left]
  if (face === 'outside') return { s: [0.06, 0, -0.04 * sgn], n: [0, 0, -sgn] };
  if (face === 'sole') return { s: [0, -0.06, 0], n: [0, -1, 0] };
  return { s: [0.09, 0.06, 0], n: [0, 1, 0] };                                       // instep
}
function basisQ(a, b) {
  const x = a.clone().normalize(), z = x.clone().cross(b).normalize(), y = z.clone().cross(x).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** World rotation of the foot bone so that `face` ('instep'|'inside'|'outside'|'sole') points along n with the toes towards fwd. */
export function footQuat(h, side, n, fwd, face = 'instep') {
  const S = soleFrame(h, side), g = faceGeom(side, face);
  const loc = S.fwd.clone().multiplyScalar(g.n[0]).addScaledVector(S.up, g.n[1]).addScaledVector(S.left, g.n[2]).normalize();
  const nn = n.clone().normalize(), f2 = fwd.clone().addScaledVector(nn, -fwd.dot(nn));
  if (f2.lengthSq() < 1e-6) f2.set(1, 0, 0);
  f2.normalize();
  const a2 = S.fwd.clone().addScaledVector(loc, -S.fwd.dot(loc));
  if (a2.lengthSq() < 1e-6) a2.copy(S.up).addScaledVector(loc, -S.up.dot(loc));
  return basisQ(nn, f2).multiply(basisQ(loc, a2.normalize()).invert());
}
const faceOffsetLocal = (h, side, face) => { const S = soleFrame(h, side), g = faceGeom(side, face); return S.fwd.clone().multiplyScalar(g.s[0] * (h.scale || 1)).addScaledVector(S.up, g.s[1] * (h.scale || 1)).addScaledVector(S.left, g.s[2] * (h.scale || 1)); };

/** World position of the contact surface of a foot face (for verification, or to pick the face closest to the ball). */
export function footContactPoint(h, side, face = 'instep') {
  const f = h.bones[`Bip01_${side}_Foot`];
  return f.getWorldPosition(V()).add(faceOffsetLocal(h, side, face).applyQuaternion(f.getWorldQuaternion(Q())));
}

/** Where the ankle must be so that `face` touches a ball of `radius` centred at C, when the foot is oriented by footQuat(side, n, fwd, face). */
export function ankleForBall(h, side, C, n, fwd, face = 'instep', radius = 0.08) {
  const q = footQuat(h, side, n, fwd, face);
  const off = faceOffsetLocal(h, side, face).applyQuaternion(q).addScaledVector(n.clone().normalize(), radius);
  return C.clone().sub(off);
}

/**
 * Full kick/touch solve: orients the foot, puts the ankle where the face meets the ball, returns { ankle, quat, point } (does not move bones).
 * Typical use each frame near the contact tick:  const k = solveFootBall(h,'R',ball.position,dirOfBallFlight, fwd,'instep'); h.setReachFoot('R', k.ankle, w, k.quat)
 */
export function solveFootBall(h, side, ballCenter, n, fwd, face = 'instep', radius = 0.08) {
  const quat = footQuat(h, side, n, fwd, face), ankle = ankleForBall(h, side, ballCenter, n, fwd, face, radius);
  return { ankle, quat, point: ballCenter.clone().addScaledVector(n.clone().normalize(), -radius) };
}

// ------------------------------------------------------------------ paired-contact points on a body
const mid = (a, b, k = 0.5) => a.clone().lerp(b, k);
const flat = (a, b) => { const d = b.clone().sub(a); d.y = 0; const l = d.length() || 1; return d.multiplyScalar(1 / l); };

/**
 * Named points on the SURFACE of human `B` (the one being touched), facing the other body `from` (a Human or a world point):
 * 'shoulderL|R', 'chest', 'back', 'waist', 'hip', 'thighL|R', 'shinL|R', 'ankleL|R', 'head', 'handL|R'. Returns a world Vector3.
 */
export function bodyPoint(B, name, from = null) {
  const p = (n) => B.bonePosition(n, V());
  const fromP = from && from.root ? from.bonePosition('Pelvis', V()) : from;
  const dir = fromP ? flat(p('Pelvis'), fromP) : V(0, 0, 1).applyQuaternion(B.root.getWorldQuaternion(Q()));   // horizontal direction from B towards the other body
  const side = V().crossVectors(UP, dir);                                                                    // B's left as seen from the other body
  const sd = name.slice(-1) === 'L' || name.slice(-1) === 'R' ? name.slice(-1) : null;
  const base = sd ? name.slice(0, -1) : name;
  const sgn = sd === 'L' ? 1 : -1;
  switch (base) {
    case 'shoulder': { const q = p(`${sd}_UpperArm`); q.y += 0.1; return q.addScaledVector(dir, 0.03); }
    case 'chest': return p('Spine2').addScaledVector(dir, 0.15);
    case 'back': return p('Spine2').addScaledVector(dir, -0.15);
    case 'waist': return p('Spine').addScaledVector(dir, 0.15);
    case 'hip': return p('Pelvis').addScaledVector(dir, 0.12);
    case 'thigh': return mid(p(`${sd}_Thigh`), p(`${sd}_Calf`), 0.3).addScaledVector(dir, 0.085).addScaledVector(side, 0.0);
    case 'shin': return mid(p(`${sd}_Calf`), p(`${sd}_Foot`), 0.35).addScaledVector(dir, 0.065);
    case 'ankle': return mid(p(`${sd}_Calf`), p(`${sd}_Foot`), 0.8).addScaledVector(dir, 0.04);
    case 'head': return p('Head').add(V(0, 0.1, 0));
    case 'hand': return p(`${sd}_Hand`);
    default: throw new Error(`view3d contact: unknown body point "${name}"`);
  }
  void sgn;
}

// ------------------------------------------------------------------ capsules + penetration
const SEGS = [
  ['Pelvis', 'Spine', 0.17, 'pelvis'], ['Spine', 'Spine1', 0.17, 'abdomen'], ['Spine1', 'Spine2', 0.17, 'chest'], ['Spine2', 'Neck', 0.15, 'chest2'], ['Neck', 'Head', 0.065, 'neck'],
  ['L_Clavicle', 'L_UpperArm', 0.05, 'L shoulder'], ['R_Clavicle', 'R_UpperArm', 0.05, 'R shoulder'], ['L_UpperArm', 'L_Forearm', 0.05, 'L upper arm'], ['R_UpperArm', 'R_Forearm', 0.05, 'R upper arm'],
  ['L_Forearm', 'L_Hand', 0.04, 'L forearm'], ['R_Forearm', 'R_Hand', 0.04, 'R forearm'], ['L_Thigh', 'L_Calf', 0.085, 'L thigh'], ['R_Thigh', 'R_Calf', 0.085, 'R thigh'],
  ['L_Calf', 'L_Foot', 0.06, 'L calf'], ['R_Calf', 'R_Foot', 0.06, 'R calf'], ['L_Foot', 'L_Toe0', 0.045, 'L foot'], ['R_Foot', 'R_Toe0', 0.045, 'R foot'],
];
function segDist(p1, q1, p2, q2) {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) { s = t = 0; } else if (a <= 1e-9) { s = 0; t = Math.min(1, Math.max(0, f / e)); } else {
    const c = d1.dot(r);
    if (e <= 1e-9) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else {
      const b = d1.dot(d2), den = a * e - b * b;
      s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
}
/** Body capsules in world space: [{a: Vector3, b: Vector3, r, name}]. */
export function capsulesOf(h) {
  const out = [], p = (n) => h.bonePosition(n, V());
  for (const [a, b, r, name] of SEGS) out.push({ a: p(a), b: p(b), r, name });
  const hd = p('Head'); out.push({ a: hd.clone().add(V(0, 0.06, 0)), b: hd.clone().add(V(0, 0.1, 0)), r: 0.1, name: 'head' });
  for (const s of ['L', 'R']) { const f = p(`${s}_Forearm`), w = p(`${s}_Hand`); const d = w.clone().sub(f).normalize(); out.push({ a: w, b: w.clone().addScaledVector(d, 0.1), r: 0.04, name: `${s} hand` }); }
  return out;
}
/** Deepest overlap (metres, positive = penetrating) between two humans and the limbs involved. ignore: [[nameA, nameB]] pairs allowed to touch (e.g. the tagging hand). */
export function penetration(hA, hB, { ignore = [] } = {}) {
  const A = capsulesOf(hA), B = capsulesOf(hB);
  let worst = { depth: -9, a: '', b: '' };
  for (const x of A) for (const y of B) {
    if (ignore.some(([i, j]) => (x.name === i && y.name === j) || (x.name === j && y.name === i))) continue;
    const depth = (x.r + y.r) - segDist(x.a, x.b, y.a, y.b);
    if (depth > worst.depth) worst = { depth, a: x.name, b: y.name };
  }
  return worst;
}
/**
 * Pushes the two roots apart horizontally until the deepest overlap is below `tolerance` (a few iterations). Moves `move`: 'both' | 'a' | 'b'.
 * Call after the poses are updated for the frame; returns the remaining depth.
 */
export function resolvePenetration(hA, hB, { move = 'both', tolerance = 0.005, ignore = [], iterations = 6 } = {}) {
  let w = penetration(hA, hB, { ignore });
  for (let i = 0; i < iterations && w.depth > tolerance; i++) {
    const d = flat(hA.root.position, hB.root.position), push = w.depth - tolerance + 0.002;
    const ka = move === 'b' ? 0 : move === 'a' ? 1 : 0.5, kb = move === 'a' ? 0 : move === 'b' ? 1 : 0.5;
    hA.root.position.addScaledVector(d, -push * ka); hB.root.position.addScaledVector(d, push * kb);
    hA.root.updateMatrixWorld(true); hB.root.updateMatrixWorld(true);
    w = penetration(hA, hB, { ignore });
  }
  return w;
}

// ------------------------------------------------------------------ airborne whole-body rotation
/**
 * Rotates the WHOLE body (flip / roll / spin) about the pelvis and puts the pelvis at a world position. yaw about Y, then pitch about the body's left axis
 * (+ = lean forward), then roll about its forward axis (degrees). Call it every frame after human.update(dt) while airborne, before reading bone positions; pass null to
 * return to the upright body. Ground clamp / foot planting are suspended while it is active.
 *   rotateBody(h, { pelvis: Vector3, yaw: radians, pitch: deg, roll: deg })
 */
export function rotateBody(h, o) {
  if (!o) { h._airborne = false; h.root.quaternion.setFromAxisAngle(UP, h.facing); h.model.position.y = 0; h.root.updateMatrixWorld(true); return; }
  h._airborne = true;
  const D = Math.PI / 180;
  const q = Q().setFromAxisAngle(UP, o.yaw ?? h.facing).multiply(Q().setFromAxisAngle(V(1, 0, 0), (o.pitch || 0) * D)).multiply(Q().setFromAxisAngle(V(0, 0, 1), (o.roll || 0) * D));
  h.root.quaternion.copy(q); h.model.position.y = 0;
  h.root.position.set(0, 0, 0); h.root.updateMatrixWorld(true);
  const pw = h.bonePosition('Pelvis', V());
  h.root.position.copy(o.pelvis).sub(pw); h.root.updateMatrixWorld(true);
}

// ------------------------------------------------------------------ palms, forearms and reach (hands: volleyball, basketball, pelota, handball ...)
// Hand frame (from the finger rig, hand-local): fingerDir = wrist -> fingertips, palmDir = out of the palm. Palm surface = the middle of the palm pushed out by the palm thickness.
const palmThick = (h) => (h.info.kind === 'mannequin' ? 0.03 : 0.021);
const PALM_FRAC = 0.5;                                                   // palm centre = this fraction of the way from the wrist to the index knuckle
export const FOREARM_R = { mannequin: 0.043, athlete: 0.036 };

/** World position of the palm surface point (the point that touches a ball). */
export function palmPoint(h, side) {
  const fr = h.fingers[side], hand = h.bones[`Bip01_${side}_Hand`]; hand.updateWorldMatrix(true, false);
  return hand.localToWorld(fr.knuckle.clone().multiplyScalar(PALM_FRAC).addScaledVector(fr.palmDir, palmThick(h)));
}
/** World direction out of the palm, and along the fingers. */
export function palmFrame(h, side) {
  const fr = h.fingers[side], q = h.bones[`Bip01_${side}_Hand`].getWorldQuaternion(Q());
  return { n: fr.palmDir.clone().applyQuaternion(q), f: fr.fingerDir.clone().applyQuaternion(q) };
}
/** World point on the SURFACE of the forearm, `frac` of the way from the wrist to the elbow, on the side facing world direction n. */
export function forearmPoint(h, side, n, frac = 0.42) {
  const w = h.bonePosition(`${side}_Hand`, V()), e = h.bonePosition(`${side}_Forearm`, V()), nn = n.clone().normalize();
  const ax = e.clone().sub(w).normalize(); const perp = nn.addScaledVector(ax, -nn.dot(ax)).normalize();
  return w.lerp(e, frac).addScaledVector(perp, (h.info.kind === 'mannequin' ? FOREARM_R.mannequin : FOREARM_R.athlete) * (h.scale || 1));
}
/** Hand orientation (world quaternion of the hand bone) so the palm faces along n with the fingers along fx. */
export function handQuat(h, side, n, fx) {
  const fr = h.fingers[side], nn = n.clone().normalize();
  const f = fx.clone().addScaledVector(nn, -fx.dot(nn)); if (f.lengthSq() < 1e-6) f.set(0, 1, 0).addScaledVector(nn, -nn.y); f.normalize();
  const bas = (a, b) => { const x = a.clone().normalize(), z = new THREE.Vector3().crossVectors(x, b).normalize(), y = new THREE.Vector3().crossVectors(z, x); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); };
  const local = bas(fr.fingerDir, fr.palmDir), world = bas(f, nn);
  return world.multiply(local.invert());
}
/**
 * Where the WRIST (hand bone) must be, and how the hand must be oriented, so the palm surface touches a ball of `radius` centred at C with the palm facing along n
 * (the ball sits on the palm's outer side) and the fingers along fx. Feed it to human.setReach(side, wrist, { weight, quat }) around the contact tick.
 * Returns { wrist, quat, point, reachable } (point = the ball surface point the palm touches; reachable = the exact wrist target is within the arm's reach from where the human stands now: if false, move the player or pick another palm normal).
 */
export function solvePalmBall(h, side, C, n, fx, radius = 0.105) {
  const nn = n.clone().normalize(), quat = handQuat(h, side, nn, fx), fr = h.fingers[side];
  const q = quat.clone();
  const off = fr.knuckle.clone().multiplyScalar(PALM_FRAC).addScaledVector(fr.palmDir, palmThick(h)).multiplyScalar(h.scale || 1).applyQuaternion(q);
  const point = C.clone().addScaledVector(nn, -radius);
  const wrist = point.clone().sub(off);
  const sh = h.bonePosition(`${side}_UpperArm`, V()), el = h.bonePosition(`${side}_Forearm`, V()), wr0 = h.bonePosition(`${side}_Hand`, V());
  const arm = sh.distanceTo(el) + el.distanceTo(wr0), d = sh.distanceTo(wrist);
  return { wrist, quat, point, reachable: d <= arm * 0.985 && d >= 0.1 * (h.scale || 1), shoulderDistance: d, armLength: arm };   // reachable: the WRIST target is within the arm's length from this shoulder
}
/**
 * Reach envelope of one arm for a stand spot: { shoulder, radius, minRadius, canReach(point, { ballRadius }) }. radius = arm length + palm reach: a palm can touch a ball
 * centred closer than radius + ballRadius to the shoulder. `at` (Vector3): ask as if the human stood there (same facing) instead of where it is now; `lift`: extra shoulder height (a jump).
 */
export function reachEnvelope(h, side, { at = null, lift = 0 } = {}) {
  const sh = h.bonePosition(`${side}_UpperArm`, V()), el = h.bonePosition(`${side}_Forearm`, V()), wr = h.bonePosition(`${side}_Hand`, V());
  const arm = sh.distanceTo(el) + el.distanceTo(wr);
  const fr = h.fingers[side];
  const palm = fr.knuckle.clone().multiplyScalar(PALM_FRAC).length() * (h.scale || 1) + palmThick(h) * (h.scale || 1);
  const shoulder = sh.clone(); if (at) shoulder.add(at.clone().sub(h.root.position)); shoulder.y += lift;
  const radius = (arm + palm) * 0.985, minRadius = 0.12 * (h.scale || 1);
  return { shoulder, radius, minRadius, armLength: arm, canReach: (p, { ballRadius = 0.105 } = {}) => { const d = shoulder.distanceTo(p); return d <= radius + ballRadius * 0.9 && d >= minRadius; } };
}
