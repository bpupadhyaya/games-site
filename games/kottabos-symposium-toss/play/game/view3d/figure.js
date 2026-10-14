// The symposiast: a real 3D man (view3d athlete_m) reclining on his left side on a klinē, propped on the left elbow, in a himation draped over
// the hips and one shoulder, an ivy wreath on his head, the kylix hanging from the right index finger. The presenter drives only two things:
// where the cup is (the sim's hand point) and how far the wrist is cocked (charge) or snapped. Everything else is idle life: breathing, a slow
// weight shift, the head following the cup / target, the free hand settling.
//
// Frame: the figure's holder lies on its left side (character +Y -> world +x along the couch, character +X (left) -> world -y), rolled a little
// onto its back so the chest shows to the viewer, and yawed so the legs recede into the room.
export const FIG = {
  yaw: -58,             // degrees about world y: the couch axis points toward the viewer by this much at the head end
  roll: 8,              // degrees about the couch axis: chest rolls toward the ceiling (negative) or the viewer
  pos: [-0.78, 0.40, -0.30],   // pelvis centre on the couch (metres): x along the room, y up, z toward the viewer
};

export async function createFigure(V3, o = {}) {
  const { THREE, loadHuman, buildClip } = V3;
  const kit = { top: '#efe3c4', bottoms: '#8a2f22', socks: '#8a2f22', shoes: '#7a2a1e', ...(o.kit || {}) };
  const human = await loadHuman({ character: o.character || 'athlete_m', kit, skin: o.skin || 'tan', hair: o.hair || 'brown', lod: o.lod });
  human.groundClamp = 'off'; human.footPlanting = false;
  const holder = new THREE.Group(); holder.add(human.root);
  holder.name = 'symposiast';

  const P = { ...FIG, ...(o.fig || {}) };
  const ph = human.pelvisHeight;
  // lying frame: first lie on the left side (z -90), then roll about world x, then yaw about world y
  const place = () => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2));
    q.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((P.roll * Math.PI) / 180, 0, 0)));
    q.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (P.yaw * Math.PI) / 180, 0)));
    holder.quaternion.copy(q);
    holder.position.set(P.pos[0], P.pos[1], P.pos[2]);
    holder.updateMatrixWorld(true);
  };
  place();

  const BASE = { clip: 'idle_relaxed', time: 0.6 };
  const J = o.pose || {};
  const pose = {
    Pelvis: { pos: [0, -(ph - 0.10), 0], twist: 0, side: 0, flex: 0, ...(J.Pelvis || {}) },
    Spine: { flex: -4, side: -14, twist: 3, ...(J.Spine || {}) },
    Spine1: { flex: -4, side: -14, twist: 3, ...(J.Spine1 || {}) },
    Spine2: { flex: -2, side: -12, twist: 3, ...(J.Spine2 || {}) },
    Neck: { flex: 22, side: -10, twist: -4, ...(J.Neck || {}) },
    Head: { flex: 16, side: -12, twist: -10, ...(J.Head || {}) },
    L_Thigh: { flex: 6, abduct: 3, ...(J.L_Thigh || {}) }, L_Calf: { flex: 10, ...(J.L_Calf || {}) },
    R_Thigh: { flex: 34, abduct: 4, twist: 0, ...(J.R_Thigh || {}) }, R_Calf: { flex: 52, ...(J.R_Calf || {}) },
    L_UpperArm: { flex: 40, abduct: 20, ...(J.L_UpperArm || {}) }, L_Forearm: { flex: 90, ...(J.L_Forearm || {}) },
    R_UpperArm: { flex: 20, abduct: 20, ...(J.R_UpperArm || {}) }, R_Forearm: { flex: 70, ...(J.R_Forearm || {}) },
  };
  const clip = buildClip(human, { name: 'recline', duration: 1, base: BASE, grounded: false, keys: [{ t: 0, pose }, { t: 1 }] });
  human.addClip(clip);
  human.play('recline', { fade: 0, loop: true });
  const cur = human.layers.base.current; if (cur) { cur.speed = 0; cur.time = 0; }

  // live layers (additive): breathing, slow weight shift
  const TRUNK = ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'L_Clavicle', 'R_Clavicle'];
  const addLive = (name, dur, keys) => {
    human.addClip(buildClip(human, { name, duration: dur, base: BASE, grounded: false, keys }));
    const layer = human.addLayer(name, { mask: TRUNK, additive: true, weight: 1 });
    human.play(name, { layer: name, fade: 0, loop: true });
    return layer;
  };
  addLive('breath', 4.4, [{ t: 0 }, { t: 1.8, pose: { Spine2: { flex: -2.4 }, Neck: { flex: 0.8 }, L_Clavicle: { rot: [0, 0, 2.2] }, R_Clavicle: { rot: [0, 0, -2.2] } }, ease: 'inOut' }, { t: 3.1, pose: { Spine2: { flex: -2.0 } } }, { t: 4.4, pose: { Spine2: { flex: 0 }, Neck: { flex: 0 }, L_Clavicle: { rot: [0, 0, 0] }, R_Clavicle: { rot: [0, 0, 0] } }, ease: 'inOut' }]);
  addLive('shift', 9.1, [{ t: 0 }, { t: 4, pose: { Spine1: { twist: 2.2, side: 1.2 }, Head: { side: -1.6, twist: 1.5 } }, ease: 'inOut' }, { t: 9.1, pose: { Spine1: { twist: 0, side: 0 }, Head: { side: 0, twist: 0 } }, ease: 'inOut' }]);

  return { human, holder, place, P, pose };
}
