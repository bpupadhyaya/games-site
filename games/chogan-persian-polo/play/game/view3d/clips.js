// Rider clips authored on the mannequin rig: seat variants (upright, forward, deep), mallet wind-ups and strikes for both sides and for a
// back-hand, and hooks. Everything is pose keys + IK targets (character space, metres: +Z forward, +X the rider's LEFT, origin on the ground
// under the pelvis, which is 0.895 m up). The strikes carry a `prop` track whose contact key puts the mallet head's sweet spot on the
// world target `contact` (the ball), so the picture meets the ball exactly where the sim says, on the sim's contact tick.
import { buildClip } from '../vendor3d/index.js';
export const REIN_HAND = [0.10, 1.02, 0.42];

export const TC = 10 / 60;                  // strike clips reach contact 10 sim ticks after their start
const SEAT_LEGS = { L_Thigh: { flex: 72, abduct: 16 }, R_Thigh: { flex: 72, abduct: 16 }, L_Calf: { flex: 84 }, R_Calf: { flex: 84 } };
const FOOT = (s) => [0.36 * s, 0.30, 0.06];
const FEET_IK = {
  L_Foot: { keys: [{ t: 0, pos: FOOT(1) }], pole: [{ t: 0, pos: [0.5, 0.7, 0.9] }] },
  R_Foot: { keys: [{ t: 0, pos: FOOT(-1) }], pole: [{ t: 0, pos: [-0.5, 0.7, 0.9] }] },
};
const REIN_IK = (lift = 0) => ({ L_Hand: { keys: [{ t: 0, pos: [REIN_HAND[0], REIN_HAND[1] + lift, REIN_HAND[2]] }], pole: [{ t: 0, pos: [0.45, 0.8, 0.1] }] } });
const IK = { ...REIN_IK(), ...FEET_IK };
const CARRY = { grip: [-0.24, 0.98, 0.24], dir: [-0.28, -0.62, 0.74] };

export function authorClips(h) {
  const add = (spec) => { const c = buildClip(h, { grounded: false, fingers: 'relaxed', ...spec }); h.addClip(c); return c; };
  const seatPose = (extra = {}) => ({ ...SEAT_LEGS, ...extra });
  // ---- seats: upright at a walk, forward at speed, deep over the neck at a gallop
  const mk = (name, lean, headFlex) => add({
    name, duration: 2, loop: true, base: 'rest',
    keys: [
      { t: 0, pose: seatPose({ Pelvis: { flex: 8 + lean * 0.35 }, Spine: { flex: 3 + lean * 0.3 }, Spine1: { flex: 3 + lean * 0.3 }, Spine2: { flex: 2 + lean * 0.3 }, Neck: { flex: headFlex }, Head: { flex: headFlex * 0.6 } }) },
      { t: 1, pose: { Spine1: { flex: 4.5 + lean * 0.3 }, Neck: { flex: headFlex - 1 } }, ease: 'inOut' },
      { t: 2, pose: { Spine1: { flex: 3 + lean * 0.3 }, Neck: { flex: headFlex } }, ease: 'inOut' },
    ],
    ik: { ...REIN_IK(-0.05 * lean / 10), ...FEET_IK }, prop: [{ t: 0, ...CARRY, grip: [CARRY.grip[0], CARRY.grip[1] - 0.02 * lean / 10, CARRY.grip[2] + 0.04 * lean / 10] }],
  });
  mk('ride', 0, -6); mk('ride_fast', 12, -10); mk('ride_deep', 24, -14);

  // ---- live layer: a slow additive sway of the back, shoulders and head (breathing, weight shift, small asymmetry), one cycle of 3 s
  add({ name: 'live', duration: 3, loop: true, base: 'rest', keys: [
    { t: 0, pose: { Spine: { flex: 0, side: 0, twist: 0 }, Spine1: { flex: 0, side: 0, twist: 0 }, Spine2: { flex: 0, side: 0, twist: 0 }, Neck: { flex: 0, twist: 0 }, Head: { flex: 0, side: 0, twist: 0 } } },
    { t: 0.75, pose: { Spine: { side: 1.6, twist: 1.0, flex: 0.6 }, Spine1: { side: 1.4, twist: 1.4, flex: 0.9 }, Spine2: { side: 1.0, twist: 1.0, flex: 1.2 }, Neck: { flex: 1.5, twist: -1.5 }, Head: { flex: -1.0, side: -1.2, twist: -2.0 } }, ease: 'inOut' },
    { t: 1.5, pose: { Spine: { side: 0.2, twist: -0.8, flex: 1.2 }, Spine1: { side: 0.4, twist: -1.2, flex: 1.6 }, Spine2: { side: 0.2, twist: -1.0, flex: 2.0 }, Neck: { flex: 0.5, twist: 1.5 }, Head: { flex: 0.8, side: 0.8, twist: 2.4 } }, ease: 'inOut' },
    { t: 2.25, pose: { Spine: { side: -1.4, twist: 0.6, flex: 0.4 }, Spine1: { side: -1.2, twist: 0.9, flex: 0.6 }, Spine2: { side: -1.0, twist: 0.7, flex: 0.8 }, Neck: { flex: 1.0, twist: -0.5 }, Head: { flex: -0.5, side: 1.0, twist: -1.0 } }, ease: 'inOut' },
    { t: 3, pose: { Spine: { side: 0, twist: 0, flex: 0 }, Spine1: { side: 0, twist: 0, flex: 0 }, Spine2: { side: 0, twist: 0, flex: 0 }, Neck: { flex: 0, twist: 0 }, Head: { flex: 0, side: 0, twist: 0 } }, ease: 'inOut' },
  ], smoothTrunk: false });

  // ---- strikes. Each: wind-up clip (carry -> top, held), strike clip (top -> contact at TC -> follow-through -> carry)
  const top = (side) => side === 'R'
    ? { pose: seatPose({ Spine: { twist: -10, side: -3, flex: 4 }, Spine1: { twist: -12, side: -3, flex: 4 }, Spine2: { twist: -10, side: -3, flex: 3 }, Pelvis: { flex: 8 } }), prop: { grip: [-0.40, 1.52, -0.18], dir: [-0.30, 0.62, -0.72] } }
    : { pose: seatPose({ Spine: { twist: 5, side: 4, flex: 4 }, Spine1: { twist: 6, side: 4, flex: 4 }, Spine2: { twist: 5, side: 4, flex: 3 }, Pelvis: { flex: 8 } }), prop: { grip: [-0.10, 1.66, 0.02], dir: [-0.05, 0.78, -0.55] } };
  const backTop = { pose: seatPose({ Spine: { twist: 14, side: -2, flex: 6 }, Spine1: { twist: 16, side: -2, flex: 6 }, Spine2: { twist: 14, side: -2, flex: 4 }, Pelvis: { flex: 8 } }), prop: { grip: [-0.30, 1.50, 0.40], dir: [-0.25, 0.55, 0.78] } };
  const windUp = (name, T) => add({ name, duration: 0.24, base: 'ride', keys: [{ t: 0 }, { t: 0.24, pose: T.pose, ease: 'out' }], ik: IK, prop: [{ t: 0, ...CARRY }, { t: 0.24, ...T.prop, ease: 'out' }] });
  windUp('wind_R', top('R')); windUp('wind_L', top('L')); windUp('wind_B', backTop);

  const strike = (name, T, contactPose, contactDir, follow) => add({
    name, duration: 0.8, base: 'ride',
    keys: [
      { t: 0, pose: T.pose },
      { t: TC, pose: contactPose, ease: 'in' },
      { t: 0.36, pose: follow.pose, ease: 'out' },
      { t: 0.8, pose: seatPose({ Spine: { twist: 0, side: 0, flex: 3 }, Spine1: { twist: 0, side: 0, flex: 3 }, Spine2: { twist: 0, side: 0, flex: 2 }, Pelvis: { flex: 8 } }), ease: 'inOut' },
    ],
    ik: IK, events: { contact: TC },
    prop: [{ t: 0, ...T.prop }, { t: TC, sweet: 'contact', dir: contactDir, ease: 'in' }, { t: 0.36, ...follow.prop, ease: 'out' }, { t: 0.8, ...CARRY, ease: 'inOut' }],
  });
  const lean = (side, twist, flex, pel = 8) => seatPose({
    Spine: { twist: twist / 3, side: side / 3, flex: flex / 3 }, Spine1: { twist: twist / 3, side: side / 3, flex: flex / 3 }, Spine2: { twist: twist / 3, side: side / 3, flex: flex / 3 },
    Pelvis: { flex: pel, side: side * 0.1 },
  });
  strike('strike_R', top('R'), lean(-50, -2, 28), [-0.45, -0.86, 0.22], { pose: lean(-12, 24, 6), prop: { grip: [-0.12, 1.40, 0.55], dir: [0.15, 0.45, 0.88] } });
  strike('strike_L', top('L'), lean(100, 50, 100), [0.42, -0.86, 0.25], { pose: lean(10, 26, 8), prop: { grip: [0.15, 1.40, 0.55], dir: [0.25, 0.45, 0.85] } });
  strike('strike_B', backTop, lean(-44, 18, 8), [-0.50, -0.84, -0.20], { pose: lean(-10, 20, 4), prop: { grip: [-0.40, 1.30, -0.30], dir: [-0.20, 0.35, -0.9] } });

  // ---- hook: the mallet comes up and sweeps out across the opponent's stick; contact key at TC (the sim's hook window opens HOOK_WIN[0] ticks in)
  const hook = (name, side) => add({
    name, duration: 0.6, base: 'ride',
    keys: [{ t: 0 }, { t: 0.14, pose: seatPose({ Spine: { twist: -side * 4, side: -side * 6 }, Spine1: { twist: -side * 4, side: -side * 6 }, Spine2: { twist: -side * 4, side: -side * 6 } }), ease: 'out' }, { t: 0.26, pose: seatPose({ Spine: { twist: side * 6, side: -side * 14 }, Spine1: { twist: side * 6, side: -side * 14 }, Spine2: { twist: side * 6, side: -side * 14 } }), ease: 'in' }, { t: 0.6, pose: seatPose({}), ease: 'inOut' }],
    ik: IK, events: { contact: 0.26 },
    prop: [{ t: 0, ...CARRY }, { t: 0.14, grip: [-0.30 * side, 1.30, 0.20], dir: [-0.4 * side, 0.85, 0.2], ease: 'out' }, { t: 0.26, grip: [-0.45 * side, 1.12, 0.35], dir: [-0.8 * side, -0.25, 0.5], ease: 'in' }, { t: 0.6, ...CARRY, ease: 'inOut' }],
  });
  hook('hook_R', 1); hook('hook_L', -1);
  // a knocked-back mallet (after being hooked): the stick is flung wide and the rider recovers
  add({
    name: 'hooked', duration: 0.7, base: 'ride',
    keys: [{ t: 0 }, { t: 0.12, pose: seatPose({ Spine: { twist: -8, side: -5 }, Spine1: { twist: -8, side: -5 }, Spine2: { twist: -8, side: -5 } }), ease: 'out' }, { t: 0.7, pose: seatPose({}), ease: 'inOut' }],
    ik: IK, prop: [{ t: 0, ...CARRY }, { t: 0.12, grip: [-0.40, 1.15, 0.30], dir: [-0.75, 0.2, 0.62], ease: 'out' }, { t: 0.7, ...CARRY, ease: 'inOut' }],
  });
}
