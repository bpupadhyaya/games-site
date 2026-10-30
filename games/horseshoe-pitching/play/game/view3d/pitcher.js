// A pitcher: a real 3D athlete with an underhand horseshoe pitch authored as ONE clip over a progress value p in 0..1, scrubbed by the
// presenter from the sim's arm angle (so the arm in the picture IS the arm on the gauge):
//   p 0.00 ready (shoe held low, weight even)      p 0.30 wound up (arm back, crouch, eyes on the stake)
//   p 0.62 release (arm +56 degrees, left foot planted, weight forward)     p 0.72 follow-through (arm up at the stake, back foot trails)
//   p 1.00 ready again (the left foot steps back).
// Feet are IK-planted at fixed character-space points, so nothing skates: the planted foot is the same point for the whole stride.
export const P_READY = 0, P_WIND = 0.3, P_REL = 0.62, P_FOLLOW = 0.74;

export async function loadPitcher(V3, { character = 'athlete_m', kit, skin = 'tan', hair = 'brown', left = false } = {}) {
  const { loadHuman, buildClip } = V3;
  // full detail ALWAYS (no LOD sets, no tier swaps in the simplified hands/shoulders) and a long top (no tank armhole edge): the athlete is seen close up.
  const h = await loadHuman({ character, kit, skin, hair, top: 'long' });
  h.lodAuto = false;
  h.groundClamp = 'off'; h.footPlanting = false;
  const A = { h, ready: true, p: 0, pv: 0 };
  // mirror for a left-hander is not needed: both rivals throw right-handed
  const arm = (R, L) => ({
    R_UpperArm: { flex: R[0], abduct: R[1], twist: R[3] || 0 }, R_Forearm: { flex: R[2] },
    L_UpperArm: { flex: L[0], abduct: L[1], twist: L[3] || 0 }, L_Forearm: { flex: L[2] },
  });
  // body(): torso lean split over pelvis (hips hinge) and spine, head kept level toward the stake
  const body = ({ lean, hip, y, z, neck, twist = 0, side = 0, arms }) => ({
    Pelvis: { pos: [0, y, z], flex: hip, twist: twist * 0.3, side },
    Spine: { flex: (lean - hip) / 3, twist: twist * 0.3, side: side * 0.3 }, Spine1: { flex: (lean - hip) / 3, twist: twist * 0.4 }, Spine2: { flex: (lean - hip) / 3, twist: twist * 0.3 },
    Neck: { flex: neck }, Head: { flex: -4 },
    ...arms,
  });
  // leg bend is left to the foot IK: the thigh/calf offsets only choose the knee direction (forward)
  const legs = (t, c) => ({ L_Thigh: { flex: t, abduct: 4 }, R_Thigh: { flex: t, abduct: 4 }, L_Calf: { flex: c }, R_Calf: { flex: c } });
  const K = (t, pose, ease = 'inOut') => ({ t, pose, ease });
  const ready = { ...body({ lean: 24, hip: 12, y: -0.05, z: 0.0, neck: -16, arms: arm([-6, 5, 16], [4, 10, 22]) }), ...legs(20, 36) };
  const wind = { ...body({ lean: 38, hip: 22, y: -0.08, z: -0.04, neck: -26, twist: -10, arms: arm([-51, 3, 4], [20, 24, 40, -10]) }), ...legs(24, 46) };
  const rel = { ...body({ lean: 46, hip: 26, y: -0.12, z: 0.2, neck: -34, twist: 14, side: -3, arms: arm([53, 2, 3], [-12, 30, 36, 10]) }), ...legs(30, 46) };
  const fol = { ...body({ lean: 50, hip: 28, y: -0.10, z: 0.24, neck: -36, twist: 22, side: -4, arms: arm([76, 4, 6], [-18, 34, 34, 12]) }), ...legs(26, 40) };
  const end = { ...body({ lean: 26, hip: 12, y: -0.05, z: 0.04, neck: -18, twist: 2, arms: arm([-6, 5, 16], [4, 10, 22]) }), ...legs(20, 36) };
  // foot targets (character space: +X is the avatar's left, +Z forward); ankle height 0.10 standing flat
  const AY = 0.10;
  const lf = [
    { t: 0.00, pos: [0.13, AY, 0.06] }, { t: 0.30, pos: [0.13, AY, 0.06] },
    { t: 0.42, pos: [0.14, AY + 0.12, 0.32], ease: 'out' }, { t: 0.56, pos: [0.15, AY, 0.52], ease: 'inOut' },
    { t: 0.80, pos: [0.15, AY, 0.52] }, { t: 0.90, pos: [0.14, AY + 0.07, 0.30], ease: 'inOut' }, { t: 1.0, pos: [0.13, AY, 0.06], ease: 'out' },
  ];
  const rf = [
    { t: 0.00, pos: [-0.14, AY, -0.06] }, { t: 0.55, pos: [-0.14, AY, -0.08] },
    { t: 0.74, pos: [-0.14, AY + 0.05, -0.12], ease: 'inOut' }, { t: 0.86, pos: [-0.14, AY, -0.08], ease: 'inOut' }, { t: 1.0, pos: [-0.14, AY, -0.06] },
  ];
  // knee pole vectors: the knee always points forward and slightly out over the toes, never inward or backward
  const pole = (x) => [0, 1].map((i) => ({ t: i, pos: [x, 0.55, 1.4] }));
  const ikL = { keys: lf, pole: pole(0.28) }, ikR = { keys: rf, pole: pole(-0.28) };
  const clip = buildClip(h, {
    name: 'hs_pitch', duration: 1.0, base: 'rest', fingers: 'relaxed',
    keys: [K(0, ready), K(P_WIND, wind, 'linear'), K(P_REL, rel, 'linear'), K(P_FOLLOW, fol, 'linear'), K(1, end, 'inOut')],
    ik: { L_Foot: ikL, R_Foot: ikR },
  });
  h.addClip(clip);
  h.play('hs_pitch', { fade: 0, loop: false });
  const tr = () => h.layers.base.current;
  A.setP = (p) => { const t = tr(); if (t) { t.speed = 0; t.time = Math.max(0, Math.min(0.999, p)) * clip.dur; } };
  // a held shoe: the shoe's right arm lies across the palm (fingers curl under the bar, thumb pinned on top), open end pointing out
  // past the little finger, the closed bend hanging forward of the fist. Frame measured from the hand's own finger rig.
  const GRIP = { curl: [[0.62, 0.55, 0.30], [0.95, 1.05, 0.62], [1.0, 1.1, 0.66], [1.05, 1.12, 0.7], [1.05, 1.15, 0.72]], spread: [0.02, 0.02, 0.0, -0.02, -0.04] };
  A.GRIP = GRIP;
  A.attachShoe = (obj, { zs = -1, arm = 1, lift = 0.012, slide = 0.04 } = {}) => {
    const fr = h.fingers.R, THREE = V3.THREE;
    const across = fr.across.clone().normalize(), up = fr.palmDir.clone().normalize();
    const z = across.clone().multiplyScalar(-zs);                       // the arm's open end points along -Z of the shoe
    const x = new THREE.Vector3().crossVectors(up, z).normalize();      // shoe X (lateral)
    const zc = new THREE.Vector3().crossVectors(x, up).normalize();
    const m = new THREE.Matrix4().makeBasis(x, up, zc);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    const centre = fr.knuckle.clone().multiplyScalar(0.55).addScaledVector(fr.palmDir, lift).addScaledVector(across, slide * zs * -1);
    const local = new THREE.Vector3(arm * 0.0665, 0.0085, -0.05).applyQuaternion(q);
    const pos = centre.sub(local);
    h.attach(obj, 'R', { pos: pos.toArray(), quat: q.toArray(), pose: GRIP });
    h.setFingers('R', GRIP);
  };
  return A;
}
