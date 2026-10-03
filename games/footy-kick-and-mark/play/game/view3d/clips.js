// Footy clips, authored with buildClip + IK on top of the shared base library (nothing in vendor3d is edited).
// Character space: +Z is the way the player faces, +X is his LEFT (so the right foot / hand have negative x). Every clip that touches
// the ball has an `events.contact` and is started with playTimed(name, 'contact', eta) so contact lands exactly on the sim's time.
// Hand and foot IK keys may point at named WORLD targets that the presenter sets each frame (the sim owns where contacts are).
import { buildClip } from '../vendor3d/index.js';

export const CLIP_NAMES = [];

export function addFootyClips(human) {
  const S = human.info && human.info.height ? human.info.height / 1.74 : 1;
  const P = (a) => a.map((v) => v * S);
  const ik = (arr) => arr.map((k) => ({ ...k, pos: k.pos ? P(k.pos) : undefined, off: k.off ? P(k.off) : undefined }));
  const make = (spec) => { const c = buildClip(human, { group: 'footy', ...spec }); human.addClip(c); if (!CLIP_NAMES.includes(spec.name)) CLIP_NAMES.push(spec.name); return c; };
  const poleR = [{ t: 0, pos: [-0.7, 1.0, 0.1] }, { t: 3, pos: [-0.7, 1.0, 0.1] }], poleL = [{ t: 0, pos: [0.7, 1.0, 0.1] }, { t: 3, pos: [0.7, 1.0, 0.1] }];

  // ---- run cycles with the ball held in both hands at the chest (the base jog / sprint loops, hands pumping a little with each stride)
  const runBall = (name, base, o) => {
    const R = [], L = [];
    for (let i = 0; i <= 4; i++) { const t = i / 4, ph = Math.sin(t * Math.PI * 4) * o.bob; R.push({ t, pos: [-0.17, o.y + ph, o.z] }); L.push({ t, pos: [0.17, o.y - 0.03 - ph, o.z + 0.02] }); }
    const dur = human.getClip(base).dur, sc2 = (arr) => ik(arr.map((k) => ({ ...k, t: k.t * dur })));
    make({ name, base, inherit: true, duration: dur, loop: true, group: 'locomotion', grounded: true, fingers: 'ballGrip', fingerHands: { R: 'ballGrip', L: 'ballGrip' }, keys: [{ t: 0 }],
      ik: { R_Hand: { keys: sc2(R), pole: [{ t: 0, pos: P([-0.6, 1.0, 0.0]) }, { t: dur, pos: P([-0.6, 1.0, 0.0]) }] }, L_Hand: { keys: sc2(L), pole: [{ t: 0, pos: P([0.6, 1.0, 0.0]) }, { t: dur, pos: P([0.6, 1.0, 0.0]) }] } } });
  };
  runBall('run_ball_jog', 'jog', { y: 1.22, z: 0.3, bob: 0.025 });
  runBall('run_ball_sprint', 'sprint', { y: 1.26, z: 0.26, bob: 0.035 });

  // ---- drop punt (right foot): carry, two-handed hold at the right hip, step, backswing, the foot meets the ball falling in front of the right leg, follow-through
  make({
    name: 'f_kick', duration: 1.0, base: 'idle', grounded: false, fingers: 'ballGrip', fingerHands: { R: 'ballGrip', L: 'ballGrip' },
    keys: [
      { t: 0.00, pose: { Pelvis: { pos: [0, -0.02, 0], twist: 0 }, Spine1: { flex: 6 }, L_Thigh: { flex: 6 }, R_Thigh: { flex: 6 } } },
      { t: 0.10, pose: { Pelvis: { pos: [0, -0.04, 0.05], twist: -5 }, Spine1: { flex: 0, twist: -4 }, L_Thigh: { flex: 16 }, L_Calf: { flex: 26 }, R_Thigh: { flex: -16 }, R_Calf: { flex: 34 } }, ease: 'inOut' },
      { t: 0.23, pose: { Pelvis: { pos: [0, -0.06, 0.08], twist: -9 }, Spine1: { flex: -5, twist: -8 }, L_Thigh: { flex: 20 }, L_Calf: { flex: 30 }, R_Thigh: { flex: -40 }, R_Calf: { flex: 92 } }, ease: 'inOut' },
      { t: 0.34, pose: { Pelvis: { pos: [0, -0.05, 0.12], twist: 6 }, Spine1: { flex: 4, twist: 8 }, L_Thigh: { flex: 18 }, L_Calf: { flex: 26 }, R_Thigh: { flex: 62 }, R_Calf: { flex: 8 } }, ease: 'in' },
      { t: 0.52, pose: { Pelvis: { pos: [0, -0.02, 0.14], twist: 14 }, Spine1: { flex: 10, twist: 14 }, L_Thigh: { flex: 12 }, L_Calf: { flex: 14 }, R_Thigh: { flex: 92 }, R_Calf: { flex: 4 } }, ease: 'out' },
      { t: 0.80, pose: { Pelvis: { pos: [0, -0.04, 0.08], twist: 6 }, Spine1: { flex: 8, twist: 6 }, L_Thigh: { flex: 20 }, L_Calf: { flex: 22 }, R_Thigh: { flex: 30 }, R_Calf: { flex: 40 } }, ease: 'inOut' },
      { t: 1.00, pose: { Pelvis: { pos: [0, -0.02, 0.02], twist: 0 }, Spine1: { flex: 6, twist: 0 }, L_Thigh: { flex: 6 }, R_Thigh: { flex: 6 }, L_Calf: { flex: 4 }, R_Calf: { flex: 4 } }, ease: 'inOut' },
    ],
    ik: {
      R_Hand: { keys: ik([{ t: 0, pos: [-0.14, 0.95, 0.4] }, { t: 0.08, pos: [-0.14, 0.88, 0.42] }, { t: 0.16, pos: [-0.5, 1.0, 0.3], ease: 'out' }, { t: 0.34, pos: [-0.56, 1.15, 0.15], ease: 'inOut' }, { t: 0.6, pos: [-0.4, 1.1, 0.2], ease: 'inOut' }, { t: 1.0, pos: [-0.2, 0.92, 0.1], ease: 'inOut' }]), pole: poleR },
      L_Hand: { keys: ik([{ t: 0, pos: [0.14, 0.95, 0.4] }, { t: 0.08, pos: [0.12, 0.88, 0.42] }, { t: 0.2, pos: [0.5, 1.2, 0.2], ease: 'out' }, { t: 0.4, pos: [0.62, 1.22, 0.1], ease: 'inOut' }, { t: 0.7, pos: [0.5, 1.1, 0.1], ease: 'inOut' }, { t: 1.0, pos: [0.22, 0.92, 0.1], ease: 'inOut' }]), pole: poleL },
    },
    events: { contact: 0.34, release: 0.08 },
  });

  // ---- handball: ball in the left hand, the right fist strikes it forward
  make({
    name: 'f_handball', duration: 0.8, base: 'idle', fingers: 'ballGrip', fingerHands: { R: 'fist', L: 'ballGrip' },
    keys: [
      { t: 0.00, pose: { Pelvis: { twist: 0, pos: [0, -0.02, 0] }, Spine1: { flex: 6 } } },
      { t: 0.09, pose: { Pelvis: { twist: -12, pos: [0, -0.04, 0.02] }, Spine1: { twist: -14, flex: 6 }, L_Thigh: { flex: 10 }, R_Thigh: { flex: 4 } }, ease: 'inOut' },
      { t: 0.20, pose: { Pelvis: { twist: 8, pos: [0, -0.05, 0.08] }, Spine1: { twist: 12, flex: 10 }, L_Thigh: { flex: 22 }, L_Calf: { flex: 16 }, R_Thigh: { flex: -6 } }, ease: 'in' },
      { t: 0.36, pose: { Pelvis: { twist: 10, pos: [0, -0.03, 0.08] }, Spine1: { twist: 8, flex: 8 }, L_Thigh: { flex: 12 } }, ease: 'out' },
      { t: 0.80, pose: { Pelvis: { twist: 0, pos: [0, -0.02, 0.02] }, Spine1: { twist: 0, flex: 6 }, L_Thigh: { flex: 6 } }, ease: 'inOut' },
    ],
    ik: {
      L_Hand: { keys: ik([{ t: 0, pos: [0.16, 1.0, 0.38] }, { t: 0.2, target: 'hold', off: [0, -0.1, 0] }, { t: 0.3, pos: [0.3, 1.0, 0.3], ease: 'out' }, { t: 0.8, pos: [0.22, 0.92, 0.1], ease: 'inOut' }]), pole: poleL },
      R_Hand: { keys: ik([{ t: 0, pos: [-0.14, 1.0, 0.36] }, { t: 0.09, pos: [-0.34, 1.0, 0.0], ease: 'inOut' }, { t: 0.20, target: 'strike', ease: 'in' }, { t: 0.34, pos: [-0.18, 1.05, 0.7], ease: 'out' }, { t: 0.8, pos: [-0.22, 0.92, 0.1], ease: 'inOut' }]), pole: poleR },
    },
    events: { contact: 0.20 },
  });

  // ---- jump (mark, spoil, tap): crouch, spring, hands overhead, tuck, land. The body rises with the sim's jump height; the hands are steered to the ball by the presenter.
  make({
    name: 'f_jump', duration: 0.7, base: 'idle', grounded: false, fingers: 'open',
    keys: [
      { t: 0.00, pose: { Pelvis: { pos: [0, -0.04, 0] }, Spine1: { flex: 6 }, R_Thigh: { flex: 8 }, L_Thigh: { flex: 8 }, R_Calf: { flex: 14 }, L_Calf: { flex: 14 } } },
      { t: 0.10, pose: { Pelvis: { pos: [0, -0.16, 0.03] }, Spine1: { flex: 14 }, R_Thigh: { flex: 52 }, L_Thigh: { flex: 52 }, R_Calf: { flex: 74 }, L_Calf: { flex: 74 } }, ease: 'inOut' },
      { t: 0.20, pose: { Pelvis: { pos: [0, 0.04, 0.04] }, Spine1: { flex: -4 }, R_Thigh: { flex: 6 }, L_Thigh: { flex: 6 }, R_Calf: { flex: 8 }, L_Calf: { flex: 8 } }, ease: 'out' },
      { t: 0.32, pose: { Pelvis: { pos: [0, 0.02, 0.02] }, Spine1: { flex: -8 }, R_Thigh: { flex: 34 }, L_Thigh: { flex: 14 }, R_Calf: { flex: 54 }, L_Calf: { flex: 34 } }, ease: 'inOut' },
      { t: 0.50, pose: { Pelvis: { pos: [0, 0.0, 0.02] }, Spine1: { flex: -2 }, R_Thigh: { flex: 14 }, L_Thigh: { flex: 10 }, R_Calf: { flex: 22 }, L_Calf: { flex: 20 } }, ease: 'in' },
      { t: 0.62, pose: { Pelvis: { pos: [0, -0.14, 0.03] }, Spine1: { flex: 12 }, R_Thigh: { flex: 46 }, L_Thigh: { flex: 46 }, R_Calf: { flex: 66 }, L_Calf: { flex: 66 } }, ease: 'out' },
      { t: 0.70, pose: { Pelvis: { pos: [0, -0.04, 0] }, Spine1: { flex: 6 }, R_Thigh: { flex: 8 }, L_Thigh: { flex: 8 }, R_Calf: { flex: 14 }, L_Calf: { flex: 14 } }, ease: 'inOut' },
    ],
    ik: {
      R_Hand: { keys: ik([{ t: 0, pos: [-0.2, 0.9, 0.2] }, { t: 0.1, pos: [-0.3, 0.8, -0.05] }, { t: 0.22, pos: [-0.13, 2.0, 0.2], ease: 'out' }, { t: 0.5, pos: [-0.13, 2.05, 0.2] }, { t: 0.66, pos: [-0.3, 1.1, 0.2], ease: 'in' }, { t: 0.7, pos: [-0.2, 0.9, 0.2] }]), pole: [{ t: 0, pos: [-0.8, 1.2, 0.0] }, { t: 3, pos: [-0.8, 1.2, 0.0] }] },
      L_Hand: { keys: ik([{ t: 0, pos: [0.2, 0.9, 0.2] }, { t: 0.1, pos: [0.3, 0.8, -0.05] }, { t: 0.22, pos: [0.13, 2.0, 0.2], ease: 'out' }, { t: 0.5, pos: [0.13, 2.05, 0.2] }, { t: 0.66, pos: [0.3, 1.1, 0.2], ease: 'in' }, { t: 0.7, pos: [0.2, 0.9, 0.2] }]), pole: [{ t: 0, pos: [0.8, 1.2, 0.0] }, { t: 3, pos: [0.8, 1.2, 0.0] }] },
    },
    events: { peak: 0.32, contact: 0.32 },
  });

  // ---- tackle: step in, hands reach round the carrier's waist (targets tL, tR set from his body), then hold
  const lunge = (f) => ({
    Pelvis: { pos: [0, -0.06 - 0.1 * f, 0.02 + 0.24 * f] }, R_Thigh: { flex: 8 + 44 * f }, L_Thigh: { flex: 8 - 18 * f }, R_Calf: { flex: 14 + 20 * f }, L_Calf: { flex: 14 + 22 * f },
    Spine: { flex: 6 + 6 * f }, Spine1: { flex: 8 + 18 * f }, Spine2: { flex: 4 + 8 * f }, Neck: { flex: -8 - 10 * f },
  });
  make({
    name: 'f_tackle', duration: 0.9, base: 'ready_stance', grounded: false, fingers: 'open',
    keys: [{ t: 0, pose: lunge(0) }, { t: 0.12, pose: lunge(0.5), ease: 'inOut' }, { t: 0.22, pose: lunge(1), ease: 'out' }, { t: 0.9, pose: lunge(1), ease: 'inOut' }],
    ik: {
      L_Hand: { keys: ik([{ t: 0, pos: [0.3, 1.0, 0.3] }, { t: 0.12, pos: [0.5, 1.1, 0.5], ease: 'out' }, { t: 0.22, target: 'tL', ease: 'out' }, { t: 0.9, target: 'tL' }]), pole: poleL },
      R_Hand: { keys: ik([{ t: 0, pos: [-0.3, 1.0, 0.3] }, { t: 0.12, pos: [-0.5, 1.1, 0.5], ease: 'out' }, { t: 0.22, target: 'tR', ease: 'out' }, { t: 0.9, target: 'tR' }]), pole: poleR },
    },
    events: { contact: 0.22 },
  });
  make({
    name: 'f_wrap', duration: 1.0, loop: true, base: 'ready_stance', grounded: false, fingers: 'fist',
    keys: [{ t: 0, pose: lunge(1) }, { t: 0.5, pose: { ...lunge(1), Pelvis: { pos: [0, -0.17, 0.27] } }, ease: 'inOut' }, { t: 1.0, pose: lunge(1), ease: 'inOut' }],
    ik: {
      L_Hand: { keys: ik([{ t: 0, target: 'tL' }, { t: 1.0, target: 'tL' }]), pole: poleL },
      R_Hand: { keys: ik([{ t: 0, target: 'tR' }, { t: 1.0, target: 'tR' }]), pole: poleR },
    },
  });
  // a tackle that does not hold: grabs at air, stumbles on, recovers
  make({
    name: 'f_miss', duration: 0.9, base: 'ready_stance', grounded: false, fingers: 'open',
    keys: [{ t: 0, pose: lunge(1) }, { t: 0.3, pose: { ...lunge(0.8), Spine1: { flex: 42 }, Pelvis: { pos: [0, -0.2, 0.34] } }, ease: 'out' }, { t: 0.9, pose: lunge(0), ease: 'inOut' }],
    ik: {
      L_Hand: { keys: ik([{ t: 0, pos: [0.5, 1.1, 0.5] }, { t: 0.3, pos: [0.4, 0.9, 0.75], ease: 'out' }, { t: 0.9, pos: [0.3, 1.0, 0.3], ease: 'inOut' }]), pole: poleL },
      R_Hand: { keys: ik([{ t: 0, pos: [-0.5, 1.1, 0.5] }, { t: 0.3, pos: [-0.4, 0.9, 0.75], ease: 'out' }, { t: 0.9, pos: [-0.3, 1.0, 0.3], ease: 'inOut' }]), pole: poleR },
    },
  });
  // the carrier who has been stopped: upright, weight back, the ball hugged to the chest, a small steadying rock
  const held = (a) => ({ Pelvis: { pos: [0, -0.03, -0.05 - 0.01 * a] }, Spine: { flex: -2 }, Spine1: { flex: -3 + 2 * a }, Spine2: { flex: -2 }, Neck: { flex: 2 }, R_Thigh: { flex: 4 }, L_Thigh: { flex: 4 }, R_Calf: { flex: 8 }, L_Calf: { flex: 8 } });
  make({
    name: 'f_held', duration: 1.0, loop: true, base: 'ready_stance', fingers: 'ballGrip',
    keys: [{ t: 0, pose: held(0) }, { t: 0.5, pose: held(1), ease: 'inOut' }, { t: 1.0, pose: held(0), ease: 'inOut' }],
    ik: { R_Hand: { keys: ik([{ t: 0, pos: [-0.12, 1.28, 0.26] }, { t: 1, pos: [-0.12, 1.28, 0.26] }]), pole: poleR }, L_Hand: { keys: ik([{ t: 0, pos: [0.12, 1.28, 0.26] }, { t: 1, pos: [0.12, 1.28, 0.26] }]), pole: poleL } },
  });

  // ---- gather: stoop to a ball on the ground (hands to the world target 'ball'), scoop it up to the chest
  const stoop = (f) => ({ Pelvis: { pos: [0, -0.52 * f, 0.14 * f] }, R_Thigh: { flex: 92 * f + 8 }, L_Thigh: { flex: 52 * f + 8 }, R_Calf: { flex: 125 * f + 14 }, L_Calf: { flex: 62 * f + 14 }, Spine: { flex: 20 * f + 6 }, Spine1: { flex: 62 * f + 8 }, Spine2: { flex: 20 * f + 4 }, Neck: { flex: -34 * f - 8 }, Head: { flex: -14 * f } });
  make({
    name: 'f_gather', duration: 0.6, base: 'idle', grounded: false, fingers: 'open',
    keys: [{ t: 0, pose: stoop(0.2) }, { t: 0.13, pose: stoop(1), ease: 'out' }, { t: 0.4, pose: stoop(0.3), ease: 'inOut' }, { t: 0.6, pose: stoop(0), ease: 'inOut' }],
    ik: {
      R_Hand: { keys: ik([{ t: 0, pos: [-0.2, 0.7, 0.45] }, { t: 0.13, target: 'ball', off: [0, 0, 0], ease: 'out' }, { t: 0.4, pos: [-0.13, 1.05, 0.35], ease: 'inOut' }, { t: 0.6, pos: [-0.14, 1.1, 0.34], ease: 'inOut' }]), pole: poleR },
      L_Hand: { keys: ik([{ t: 0, pos: [0.2, 0.7, 0.45] }, { t: 0.13, target: 'ball2', off: [0, 0, 0], ease: 'out' }, { t: 0.4, pos: [0.13, 1.05, 0.35], ease: 'inOut' }, { t: 0.6, pos: [0.14, 1.1, 0.34], ease: 'inOut' }]), pole: poleL },
    },
    events: { contact: 0.13 },
  });


  // ---- goal celebrations, authored here (two variants): A = both arms thrown up with two hops; B = a right fist pump, then a left, with a body twist and a bounce
  const celebPoleR = [{ t: 0, pos: [-0.75, 1.3, -0.1] }, { t: 2.4, pos: [-0.75, 1.3, -0.1] }], celebPoleL = [{ t: 0, pos: [0.75, 1.3, -0.1] }, { t: 2.4, pos: [0.75, 1.3, -0.1] }];
  const hop = (t, y, th, c) => ({ t, pose: { Pelvis: { pos: [0, y, 0.0] }, Spine1: { flex: -6 + th }, Spine2: { flex: -4 }, Neck: { flex: -6 }, L_Thigh: { flex: c }, R_Thigh: { flex: c }, L_Calf: { flex: c * 1.6 }, R_Calf: { flex: c * 1.6 } }, ease: 'inOut' });
  make({
    name: 'f_celebrate_a', duration: 2.4, base: 'idle', grounded: false, fingers: 'open',
    keys: [{ t: 0, pose: { Pelvis: { pos: [0, -0.02, 0] }, Spine1: { flex: 4 } } }, hop(0.18, -0.12, 6, 30), hop(0.38, 0.06, -8, 4), hop(0.62, -0.1, 4, 26), hop(0.82, 0.07, -8, 4), hop(1.1, -0.03, -4, 10), hop(1.7, -0.03, -2, 8), { t: 2.4, pose: { Pelvis: { pos: [0, -0.02, 0] }, Spine1: { flex: 6 } }, ease: 'inOut' }],
    ik: {
      R_Hand: { keys: ik([{ t: 0, pos: [-0.2, 0.9, 0.2] }, { t: 0.2, pos: [-0.45, 1.25, 0.15], ease: 'out' }, { t: 0.4, pos: [-0.38, 2.05, 0.05], ease: 'out' }, { t: 0.62, pos: [-0.46, 1.95, 0.05], ease: 'inOut' }, { t: 0.84, pos: [-0.36, 2.1, 0.05], ease: 'inOut' }, { t: 1.6, pos: [-0.4, 1.98, 0.08], ease: 'inOut' }, { t: 2.4, pos: [-0.2, 0.92, 0.1], ease: 'inOut' }]), pole: celebPoleR },
      L_Hand: { keys: ik([{ t: 0, pos: [0.2, 0.9, 0.2] }, { t: 0.2, pos: [0.45, 1.25, 0.15], ease: 'out' }, { t: 0.4, pos: [0.38, 2.05, 0.05], ease: 'out' }, { t: 0.62, pos: [0.46, 1.95, 0.05], ease: 'inOut' }, { t: 0.84, pos: [0.36, 2.1, 0.05], ease: 'inOut' }, { t: 1.6, pos: [0.4, 1.98, 0.08], ease: 'inOut' }, { t: 2.4, pos: [0.2, 0.92, 0.1], ease: 'inOut' }]), pole: celebPoleL },
    },
  });
  make({
    name: 'f_celebrate_b', duration: 2.4, base: 'idle', grounded: false, fingers: 'fist',
    keys: [{ t: 0, pose: { Pelvis: { pos: [0, -0.02, 0] } } },
      { t: 0.25, pose: { Pelvis: { pos: [0, -0.08, 0.02], twist: -10 }, Spine1: { twist: -14, flex: 4 }, L_Thigh: { flex: 18 }, R_Thigh: { flex: 10 }, L_Calf: { flex: 24 }, R_Calf: { flex: 14 } }, ease: 'inOut' },
      { t: 0.5, pose: { Pelvis: { pos: [0, 0.04, 0.02], twist: 8 }, Spine1: { twist: 12, flex: -4 }, L_Thigh: { flex: 4 }, R_Thigh: { flex: 4 } }, ease: 'out' },
      { t: 0.9, pose: { Pelvis: { pos: [0, -0.08, 0.02], twist: 10 }, Spine1: { twist: 14, flex: 4 }, R_Thigh: { flex: 18 }, L_Thigh: { flex: 10 }, R_Calf: { flex: 24 }, L_Calf: { flex: 14 } }, ease: 'inOut' },
      { t: 1.15, pose: { Pelvis: { pos: [0, 0.04, 0.02], twist: -8 }, Spine1: { twist: -12, flex: -4 }, L_Thigh: { flex: 4 }, R_Thigh: { flex: 4 } }, ease: 'out' },
      { t: 1.7, pose: { Pelvis: { pos: [0, -0.04, 0], twist: 0 }, Spine1: { twist: 0, flex: 2 } }, ease: 'inOut' }, { t: 2.4, pose: { Pelvis: { pos: [0, -0.02, 0], twist: 0 }, Spine1: { flex: 6 } }, ease: 'inOut' }],
    ik: {
      R_Hand: { keys: ik([{ t: 0, pos: [-0.2, 0.9, 0.2] }, { t: 0.25, pos: [-0.3, 1.3, 0.2], ease: 'inOut' }, { t: 0.5, pos: [-0.3, 2.0, 0.15], ease: 'out' }, { t: 0.7, pos: [-0.3, 1.5, 0.2], ease: 'inOut' }, { t: 0.95, pos: [-0.3, 2.05, 0.15], ease: 'out' }, { t: 1.3, pos: [-0.28, 1.2, 0.25], ease: 'inOut' }, { t: 2.4, pos: [-0.2, 0.92, 0.1], ease: 'inOut' }]), pole: celebPoleR },
      L_Hand: { keys: ik([{ t: 0, pos: [0.2, 0.9, 0.2] }, { t: 0.5, pos: [0.3, 1.1, 0.25], ease: 'inOut' }, { t: 0.9, pos: [0.3, 1.3, 0.2], ease: 'inOut' }, { t: 1.15, pos: [0.3, 2.0, 0.15], ease: 'out' }, { t: 1.45, pos: [0.3, 1.5, 0.2], ease: 'inOut' }, { t: 1.7, pos: [0.3, 2.05, 0.15], ease: 'out' }, { t: 2.1, pos: [0.25, 1.2, 0.2], ease: 'inOut' }, { t: 2.4, pos: [0.2, 0.92, 0.1], ease: 'inOut' }]), pole: celebPoleL },
    },
  });

  // ---- stances and life ------------------------------------------------------------------------------------------------------
  const stance = (a, v) => ({
    Pelvis: { pos: [0, -0.04 - 0.02 * a - 0.03 * v, 0] }, R_Thigh: { flex: 10 + 5 * a + 6 * v, abduct: 6 + 3 * v }, L_Thigh: { flex: 12 + 5 * a + 4 * v, abduct: 5 }, R_Calf: { flex: 14 + 8 * a + 8 * v }, L_Calf: { flex: 16 + 8 * a + 6 * v },
    Spine: { flex: 4 }, Spine1: { flex: 8 + 2 * v, twist: (v - 1) * 3 }, Spine2: { flex: 4 }, Neck: { flex: -8 }, Head: { flex: -4 },
    R_UpperArm: { flex: 20 + 6 * v, abduct: 22 + 6 * v }, R_Forearm: { flex: 40 + 8 * v }, L_UpperArm: { flex: 14 + 4 * v, abduct: 26 - 4 * v }, L_Forearm: { flex: 46 - 6 * v },
  });
  for (let v = 0; v < 3; v++) { const d = 0.9 + 0.15 * v; make({ name: `f_stance_${v}`, duration: d, loop: true, base: 'ready_stance', fingers: 'relaxed', keys: [{ t: 0, pose: stance(0, v) }, { t: d / 2, pose: stance(1, v), ease: 'inOut' }, { t: d, pose: stance(0, v), ease: 'inOut' }] }); }
  const live = (u) => ({
    Pelvis: { pos: [0.04 * Math.sin(u * 6.283), 0.014 * Math.abs(Math.sin(u * 12.566)) - 0.005, 0.006 * Math.sin(u * 6.283 + 1)], side: 2.5 * Math.sin(u * 6.283) },
    Spine1: { twist: 4 * Math.sin(u * 6.283 + 0.7), side: -2 * Math.sin(u * 6.283), flex: 1.5 * Math.sin(u * 12.566) },
    Spine2: { flex: 1.2 * Math.sin(u * 12.566 + 0.5), twist: 2 * Math.sin(u * 6.283 + 1.4) },
    Head: { side: 3 * Math.sin(u * 6.283 + 2), twist: 3 * Math.sin(u * 6.283 + 0.3) },
    R_UpperArm: { flex: 3 * Math.sin(u * 12.566 + 0.4), abduct: 2 * Math.sin(u * 6.283 + 1) }, L_UpperArm: { flex: 3 * Math.sin(u * 12.566 + 2.6), abduct: 2 * Math.sin(u * 6.283 + 3) },
    R_Forearm: { flex: 4 * Math.sin(u * 6.283 + 2) }, L_Forearm: { flex: 4 * Math.sin(u * 6.283 + 4.2) },
  });
  const LN = 16, lk = []; for (let i = 0; i <= LN; i++) lk.push({ t: (i / LN) * 2.8, pose: live(i / LN), ease: 'linear' });
  make({ name: 'f_live', duration: 2.8, loop: true, base: 'rest', keys: lk, grounded: false });
}
