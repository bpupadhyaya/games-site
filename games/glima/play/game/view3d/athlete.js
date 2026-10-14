// One glima athlete: a real 3D person (Rocketbox athlete, tinted kit) with the traditional leather waist belt and the two thigh loops,
// plus the authored stance / fall / cheer poses. The presenter scrubs one number per pose (weight, fall, joy) and places the hands on the
// rival's belt and thigh loop, and the feet, with IK; the sim stays the authority on everything.
//
// Pose numbers are degrees (semantic: flex + = forward, side + = to the avatar's left, twist + = turn left; thigh flex + = knee forward).
const D2R = Math.PI / 180;

export async function loadAthlete(V3, spec) {
  const { loadHuman, buildClip, THREE } = V3;
  const { character = 'athlete_m', kit, skin = 'tan', hair = 'brown', lod = 0, scale = 1 } = spec;
  const h = await loadHuman({ character, kit: { top: kit.top, bottoms: kit.bottoms, socks: kit.socks || '#f2f2ea' }, skin, hair, lod });
  h.groundClamp = 'off'; h.footPlanting = false;
  const A = { h, THREE, character, scale, gear: {}, clips: {} };
  const mat = (c, r = 0.55, m = 0.0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const leather = mat(spec.leather || 0x8a5a2e, 0.62), leatherDk = mat(0x5a3a1c, 0.7), brass = mat(0xd9b24a, 0.32, 0.85), stitch = mat(0xe8d9a8, 0.8);

  // ---- the belt: a wide leather band round the waist (a flattened ring), a brass buckle and a tail, in the pelvis frame
  h.root.updateMatrixWorld(true);
  const worldQ = (n) => h.bones[`Bip01_${n}`].getWorldQuaternion(new THREE.Quaternion());
  const worldP = (n) => h.bones[`Bip01_${n}`].getWorldPosition(new THREE.Vector3());
  A.rest = { pelvis: worldP('Pelvis'), spine: worldP('Spine'), spine1: worldP('Spine1'), thighL: worldP('L_Thigh'), calfL: worldP('L_Calf') };
  const ringGroup = (bone, y, rx, rz, hgt, thick, mats, fz = 0) => {
    // y: world height of the ring centre in the rest pose; the group is world-aligned in the rest pose so the numbers are plain metres
    const g = new THREE.Group();
    const pos = bone.getWorldPosition(new THREE.Vector3());
    const q = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    g.quaternion.copy(q);
    g.position.set(0, 0, 0);
    const off = new THREE.Vector3(0, y - pos.y, fz).applyQuaternion(q);   // bone-local offset of the ring centre
    g.position.copy(off);
    // an open elliptical tube (outer face, inner face), so the band has a visible leather inside as well
    const geo = new THREE.CylinderGeometry(1, 1, hgt, 40, 1, true);
    const m = new THREE.Mesh(geo, mats); m.scale.set(rx + thick, 1, rz + thick); m.castShadow = true; m.material = mats;
    mats.side = THREE.DoubleSide;
    g.add(m);
    bone.add(g);
    return g;
  };
  try {
    // waist belt: about 0.07 m wide, a little above the hip bone, torso cross-section ~0.30 x 0.20 m at that height
    const pel = h.bones.Bip01_Pelvis;
    const beltY = A.rest.pelvis.y + 0.15;
    const g = ringGroup(pel, beltY, 0.172, 0.148, 0.075, 0.012, leather, 0.0);
    const edge = ringGroup(pel, beltY, 0.172, 0.148, 0.077, 0.0125, leatherDk, 0.0); void edge;
    // brass buckle at the front (character +Z) and a tail end
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.062, 0.014), brass);
    const q = pel.getWorldQuaternion(new THREE.Quaternion()).invert();
    const fwdLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    buckle.quaternion.copy(q); buckle.position.copy(new THREE.Vector3(0, beltY - A.rest.pelvis.y, 0).applyQuaternion(q)).addScaledVector(fwdLocal, 0.152);
    buckle.castShadow = true; pel.add(buckle);
    A.gear.belt = g;
    // thigh loops: a strap round each thigh, a hand-width wide, about a third of the thigh length down from the hip, square to the thigh axis
    for (const s of ['L', 'R']) {
      const th = h.bones[`Bip01_${s}_Thigh`], cf = h.bones[`Bip01_${s}_Calf`];
      const axis = cf.position.clone(), L = axis.length(); axis.normalize();
      const loop = ringGroup(th, 0, 0.088, 0.092, 0.06, 0.011, leather);
      loop.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
      loop.position.copy(axis).multiplyScalar(L * 0.3);
      A.gear[`loop${s}`] = loop;
    }
    void stitch;
  } catch (e) { console.warn('glima belt', e); }

  // ---- poses
  const mk = (s2) => { const cl = buildClip(h, s2); h.addClip(cl); A.clips[s2.name] = cl; return cl; };
  const arm = (flex, abd, fore, tw = 0) => ({ L_UpperArm: { flex, abduct: abd, twist: tw }, R_UpperArm: { flex, abduct: abd, twist: -tw }, L_Forearm: { flex: fore }, R_Forearm: { flex: fore } });
  // u: 0 weight on the athlete's LEFT foot .. 1 on the RIGHT foot. All numbers are the athlete's own left/right.
  const stance = (u, o = {}) => {
    const k = u * 2 - 1;              // -1 left .. +1 right
    const left = Math.max(0, -k), right = Math.max(0, k);
    return {
      Pelvis: { pos: [-k * 0.07, -0.03 - 0.02 * Math.abs(k), 0.0], flex: 8, side: -k * 6, twist: o.twist ?? 0 },
      Spine: { flex: 2, side: 9 + k * 3 }, Spine1: { flex: 2, side: 9 + k * 3 }, Spine2: { flex: 2, side: 9 + k * 3 },
      Neck: { flex: -6, side: -k * 2, twist: o.neck ?? -10 }, Head: { flex: -2, twist: o.head ?? -6 },
      L_Thigh: { flex: 20 + 10 * right, abduct: 6 }, R_Thigh: { flex: 20 + 10 * left, abduct: 6 },
      L_Calf: { flex: 26 + 12 * right }, R_Calf: { flex: 26 + 12 * left },
      ...arm(34, 14, 62, 6),
    };
  };
  A.stance = stance;
  mk({ name: 'gl_stance', duration: 1.0, base: 'idle', smoothTrunk: false, fingers: 'relaxed', keys: [{ t: 0, pose: stance(0) }, { t: 0.5, ease: 'inOut', pose: stance(0.5) }, { t: 1.0, ease: 'inOut', pose: stance(1) }] });
  // soft sit-down: the knees give, the hips drop and go back, the hands come down to catch the ground
  const sit = {
    Pelvis: { pos: [0, -0.76, -0.30], flex: -18, side: 0, twist: 0 },
    Spine: { flex: -8 }, Spine1: { flex: -8 }, Spine2: { flex: -6 },
    Neck: { flex: 6 }, Head: { flex: 4 },
    L_Thigh: { flex: 118, abduct: 12 }, R_Thigh: { flex: 118, abduct: 12 }, L_Calf: { flex: 112 }, R_Calf: { flex: 112 },
    ...arm(-34, 22, 8, 0),
  };
  const sitHalf = { ...sit, Pelvis: { pos: [0, -0.28, -0.1], flex: 4 }, L_Thigh: { flex: 62, abduct: 10 }, R_Thigh: { flex: 62, abduct: 10 }, L_Calf: { flex: 78 }, R_Calf: { flex: 78 }, ...arm(30, 30, 30, 0) };
  mk({ name: 'gl_sit', duration: 1.0, base: 'idle', smoothTrunk: false, fingers: 'open', keys: [{ t: 0, pose: stance(0.5) }, { t: 0.45, ease: 'inOut', pose: sitHalf }, { t: 1.0, ease: 'out', pose: sit }] });
  // the winner stands tall and raises both arms a little; the hold is released
  const cheer1 = { ...stance(0.5), Pelvis: { pos: [0, -0.01, 0], flex: 0 }, L_Thigh: { flex: 6 }, R_Thigh: { flex: 6 }, L_Calf: { flex: 8 }, R_Calf: { flex: 8 }, Neck: { flex: -10, twist: 0 }, Head: { flex: -4, twist: 0 }, ...arm(150, -30, 12, 0) };
  mk({ name: 'gl_cheer', duration: 1.0, base: 'idle', smoothTrunk: false, fingers: 'open', keys: [{ t: 0, pose: stance(0.5) }, { t: 1.0, ease: 'out', pose: cheer1 }] });
  h.root.scale.setScalar(scale);
  h.play('gl_stance', { fade: 0 });
  return A;
}

// scrub a clip to a time (the sim decides the number, the clip only gives the shape)
export function setBase(h, name, opts = {}) { const cur = h.layers.base.current; if (!cur || cur.clip.name !== name || cur.target === 0) h.play(name, { fade: 0.15, ...opts }); return h.layers.base.current; }
export function scrub(h, name, time, fade = 0.12) { const tr = setBase(h, name, { fade, loop: false }); if (tr) { tr.speed = 0; tr.time = time; } }
export { D2R };
