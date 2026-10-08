// The athlete: a lifelike Rocketbox figure in a polo, a kilt and boots, plus the authored clips for carrying the caber, the heave, the stone put and the
// weight swing. Hands are put on the props with per-frame reach targets, so the picture always agrees with the simulation.
import { addKilt } from './props.js';

export async function loadAthlete(V3, { character = 'athlete_m', lod = 0 } = {}) {
  const { loadHuman, buildClip, THREE } = V3;
  const female = character === 'athlete_f';
  const h = await loadHuman({
    character,
    kit: female ? { top: '#e6dfcc', bottoms: '#2a2c33', socks: '#d9d2bf' } : { top: '#e7e1cf', bottoms: '#2a2c33', socks: '#cfc7b3' },
    skin: female ? 'light' : 'tan', hair: female ? 'brown' : 'ginger', lod,
  });
  h.groundClamp = 'auto'; h.footPlanting = true;
  const kilt = addKilt(THREE, h);
  const A = { h, kilt, THREE, ready: true, clips: {} };

  const carryPose = { Spine: { flex: -3 }, Spine1: { flex: -7 }, Neck: { flex: 8 }, Pelvis: { pos: [0, -0.04, 0] }, L_Thigh: { flex: 6, abduct: 5 }, R_Thigh: { flex: 6, abduct: 5 }, L_Calf: { flex: 12 }, R_Calf: { flex: 12 } };
  const mk = (spec) => { const c = buildClip(h, spec); h.addClip(c); A.clips[spec.name] = c; return c; };
  mk({ name: 'a_carry', base: 'idle', inherit: true, keys: [{ t: 0, pose: carryPose }], fingers: 'relaxed' });
  mk({ name: 'a_walk', base: 'walk', inherit: true, keys: [{ t: 0, pose: { Spine1: { flex: -6 }, Neck: { flex: 6 } } }], fingers: 'relaxed' });
  mk({ name: 'a_jog', base: 'jog', inherit: true, keys: [{ t: 0, pose: { Spine1: { flex: -6 }, Neck: { flex: 6 } } }], fingers: 'relaxed' });
  mk({ name: 'a_sprint', base: 'sprint', inherit: true, keys: [{ t: 0, pose: { Spine1: { flex: -5 }, Neck: { flex: 6 } } }], fingers: 'relaxed' });
  // the heave: crouch (scrubbed with the sweep), then an explosive extension with the arms thrown up
  mk({
    name: 'a_heave', duration: 1.4, base: { clip: 'idle', time: 0.3 },
    keys: [
      { t: 0, pose: carryPose },
      { t: 0.5, ease: 'inOut', pose: { L_UpperArm: { flex: 55, abduct: 14 }, R_UpperArm: { flex: 55, abduct: 14 }, L_Forearm: { flex: 70 }, R_Forearm: { flex: 70 }, Pelvis: { pos: [0, -0.3, -0.08] }, Spine: { flex: 8 }, Spine1: { flex: 14 }, Neck: { flex: -6 }, L_Thigh: { flex: 62, abduct: 8 }, R_Thigh: { flex: 62, abduct: 8 }, L_Calf: { flex: 108 }, R_Calf: { flex: 108 } } },
      { t: 0.68, ease: 'out', pose: { L_UpperArm: { flex: 150, abduct: 22 }, R_UpperArm: { flex: 150, abduct: 22 }, L_Forearm: { flex: 15 }, R_Forearm: { flex: 15 }, Pelvis: { pos: [0, 0.03, 0.06] }, Spine: { flex: -6 }, Spine1: { flex: -22 }, Neck: { flex: -4 }, L_Thigh: { flex: 3, abduct: 6 }, R_Thigh: { flex: 3, abduct: 6 }, L_Calf: { flex: 4 }, R_Calf: { flex: 4 } } },
      { t: 1.0, ease: 'inOut', pose: { L_UpperArm: { flex: 90, abduct: 30 }, R_UpperArm: { flex: 90, abduct: 30 }, Pelvis: { pos: [0, -0.02, 0.1] }, Spine: { flex: 2 }, Spine1: { flex: -8 }, L_Thigh: { flex: 14 }, R_Thigh: { flex: 14 }, L_Calf: { flex: 22 }, R_Calf: { flex: 22 } } },
      { t: 1.4, ease: 'inOut', pose: { L_UpperArm: { flex: 8, abduct: 8 }, R_UpperArm: { flex: 8, abduct: 8 }, L_Forearm: { flex: 12 }, R_Forearm: { flex: 12 }, Pelvis: { pos: [0, 0, 0] }, Spine: { flex: 0 }, Spine1: { flex: 0 }, L_Thigh: { flex: 4 }, R_Thigh: { flex: 4 }, L_Calf: { flex: 6 }, R_Calf: { flex: 6 } } },
    ],
    events: { extend: 0.68 }, fingers: 'open',
  });
  // the stone put (right-handed, standing, side-on): ready, wind-up (scrubbed with the power), then the thrust
  const ready = { Pelvis: { pos: [0, -0.1, 0], twist: -18 }, Spine: { twist: -10 }, Spine1: { twist: -22, flex: 4 }, Head: { twist: 25 }, L_Thigh: { flex: 18, abduct: 16 }, R_Thigh: { flex: 22, abduct: 14 }, L_Calf: { flex: 34 }, R_Calf: { flex: 40 } };
  mk({
    name: 'a_put', duration: 1.2, base: { clip: 'ready_stance', time: 0.6 },
    keys: [
      { t: 0, pose: ready },
      { t: 0.4, ease: 'inOut', pose: { Pelvis: { pos: [0, -0.22, -0.05], twist: -30 }, Spine: { twist: -16, flex: 6 }, Spine1: { twist: -32, flex: 10 }, Head: { twist: 34 }, L_Thigh: { flex: 40, abduct: 20 }, R_Thigh: { flex: 52, abduct: 16 }, L_Calf: { flex: 70 }, R_Calf: { flex: 86 } } },
      { t: 0.62, ease: 'in', pose: { Pelvis: { pos: [0, 0.0, 0.1], twist: 14 }, Spine: { twist: 10, flex: -4 }, Spine1: { twist: 26, flex: -12 }, Head: { twist: -18 }, L_Thigh: { flex: 10, abduct: 16 }, R_Thigh: { flex: 4, abduct: 12 }, L_Calf: { flex: 14 }, R_Calf: { flex: 8 } } },
      { t: 1.2, ease: 'out', pose: { Pelvis: { pos: [0, -0.04, 0.12], twist: 20 }, Spine1: { twist: 30, flex: 6 }, Head: { twist: -10 }, L_Thigh: { flex: 20, abduct: 14 }, R_Thigh: { flex: 18, abduct: 12 }, L_Calf: { flex: 30 }, R_Calf: { flex: 26 } } },
    ],
    events: { release: 0.62 }, fingers: 'ballGrip',
  });
  // the weight: legs wide and bent, body turning with the arm
  mk({
    name: 'a_spin', duration: 1.0, loop: true, base: { clip: 'ready_stance', time: 0.5 },
    keys: [{ t: 0, pose: { Pelvis: { pos: [0, -0.14, 0] }, Spine1: { flex: 8 }, L_Thigh: { flex: 30, abduct: 22 }, R_Thigh: { flex: 30, abduct: 22 }, L_Calf: { flex: 52 }, R_Calf: { flex: 52 } } }, { t: 1.0, pose: { Pelvis: { pos: [0, -0.14, 0] }, Spine1: { flex: 8 }, L_Thigh: { flex: 30, abduct: 22 }, R_Thigh: { flex: 30, abduct: 22 }, L_Calf: { flex: 52 }, R_Calf: { flex: 52 } } }],
    fingers: 'fist',
  });
  mk({
    name: 'a_toss', duration: 1.1, base: { clip: 'ready_stance', time: 0.5 },
    keys: [
      { t: 0, pose: { Pelvis: { pos: [0, -0.14, 0] }, Spine1: { flex: 8 }, L_Thigh: { flex: 30, abduct: 22 }, R_Thigh: { flex: 30, abduct: 22 }, L_Calf: { flex: 52 }, R_Calf: { flex: 52 } } },
      { t: 0.25, ease: 'out', pose: { Pelvis: { pos: [0, 0.02, 0.04] }, Spine1: { flex: -26 }, Neck: { flex: -10 }, L_Thigh: { flex: 4, abduct: 10 }, R_Thigh: { flex: 4, abduct: 10 }, L_Calf: { flex: 6 }, R_Calf: { flex: 6 } } },
      { t: 1.1, ease: 'inOut', pose: { Pelvis: { pos: [0, -0.03, 0] }, Spine1: { flex: -8 }, L_Thigh: { flex: 14 }, R_Thigh: { flex: 14 }, L_Calf: { flex: 22 }, R_Calf: { flex: 22 } } },
    ],
    fingers: 'open',
  });
  h.play('a_carry', { fade: 0 });
  return A;
}
