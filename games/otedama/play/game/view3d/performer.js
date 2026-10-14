// The performer: a seated woman (seiza) in a plain cotton kimono, cupped palms up. Shared by the game presenter and the icon renderer.
import { dressKimono } from './garment.js';

export const HAND_Y = 0.5, HAND_Z = 0.3;     // metres: height of a resting bag above the floor (seated), and how far in front of the body
export const CUP = { curl: [[0.34, 0.40, 0.26], [0.42, 0.48, 0.30], [0.46, 0.52, 0.32], [0.50, 0.56, 0.34], [0.52, 0.58, 0.36]], spread: [0.10, 0.10, 0.03, -0.05, -0.12] };

export async function createPerformer(V3, stage) {
  const { loadHuman, buildClip } = V3;
  const human = await loadHuman({ character: 'athlete_f', kit: { top: '#e9ddc2', bottoms: '#1f3270', socks: '#e9e2d0', shoes: '#e9e2d0' }, skin: 'light', hair: 'black' });
  stage.add(human); stage.track(human);
  human.groundClamp = 'off'; human.footPlanting = false;
  human.setPosition(0, 0, 0); human.setFacing(0);
  human.setFingers('L', CUP); human.setFingers('R', CUP);

  // pelvis on the heels, thighs forward, shins folded back with the insteps on the floor, upright spine, relaxed shoulders
  const sit = HAND_Y - 0.36;                                           // pelvis height above the floor: sets where the lap is
  const BASE = { clip: 'idle_relaxed', time: 0.6 };
  const seated = buildClip(human, { name: 'seiza', duration: 1, base: BASE, grounded: false, keys: [{
    t: 0, pose: {
      Pelvis: { pos: [0, -(human.pelvisHeight - sit), -0.02] },
      L_Thigh: { flex: 88, abduct: 6 }, R_Thigh: { flex: 88, abduct: 6 },
      L_Calf: { flex: 150 }, R_Calf: { flex: 150 }, L_Foot: { rot: [0, 0, -80] }, R_Foot: { rot: [0, 0, -80] },
      Spine: { flex: -2 }, Spine1: { flex: 0 }, Spine2: { flex: 2 }, Neck: { flex: -4 }, Head: { flex: 2 },
      L_UpperArm: { flex: 22, abduct: 8 }, R_UpperArm: { flex: 22, abduct: 8 }, L_Forearm: { flex: 70 }, R_Forearm: { flex: 70 },
    },
  }, { t: 1 }] });
  human.addClip(seated);
  human.play('seiza', { fade: 0, loop: true });
  const cur = human.layers.base.current; if (cur) { cur.speed = 0; cur.time = 0; }
  human.update(0);
  // live layers: slow breathing (always on) and weight-driven trunk motion the presenter blends by hand (lean to the tossing side, a dip on a catch)
  const TRUNK = ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'L_Clavicle', 'R_Clavicle'];
  const live = {};
  const additive = (name, dur, keys, loop) => {
    human.addClip(buildClip(human, { name, duration: dur, base: BASE, grounded: false, keys }));
    const layer = human.addLayer(name, { mask: TRUNK, additive: true, weight: loop ? 1 : 0 });
    human.play(name, { layer: name, fade: 0, loop: !!loop, startTime: loop ? 0 : dur * 0.999 });
    if (!loop) { const t = layer.current; if (t) t.speed = 0; }
    live[name] = layer; return layer;
  };
  additive('breath', 4.6, [{ t: 0 }, { t: 1.9, pose: { Spine2: { flex: -2.2 }, Neck: { flex: 0.8 }, L_Clavicle: { rot: [0, 0, 2.2] }, R_Clavicle: { rot: [0, 0, -2.2] } }, ease: 'inOut' }, { t: 3.3, pose: { Spine2: { flex: -2.0 }, Neck: { flex: 0.6 } } }, { t: 4.6, pose: { Spine2: { flex: 0 }, Neck: { flex: 0 }, L_Clavicle: { rot: [0, 0, 0] }, R_Clavicle: { rot: [0, 0, 0] } }, ease: 'inOut' }], true);
  additive('sway', 7.3, [{ t: 0 }, { t: 3.2, pose: { Spine1: { side: 2.2, twist: 1.2 }, Head: { side: -1.4, twist: -0.8 } }, ease: 'inOut' }, { t: 7.3, pose: { Spine1: { side: 0, twist: 0 }, Head: { side: 0, twist: 0 } }, ease: 'inOut' }], true);
  additive('leanL', 1, [{ t: 0 }, { t: 1, pose: { Spine1: { side: 5.5, twist: 4.5 }, Head: { side: -3.5 } } }]);
  additive('leanR', 1, [{ t: 0 }, { t: 1, pose: { Spine1: { side: -5.5, twist: -4.5 }, Head: { side: 3.5 } } }]);
  additive('dip', 1, [{ t: 0 }, { t: 1, pose: { Spine1: { flex: 4.5 }, Neck: { flex: -1.5 }, L_Clavicle: { rot: [0, 0, 1.5] }, R_Clavicle: { rot: [0, 0, -1.5] } } }]);
  human.live = live;
  try { human.kimono = dressKimono(V3, human); } catch (e) { console.warn('kimono failed', e); }
  return human;
}
