// Rider clips authored on the mannequin rig: seat variants (upright, forward, deep), the overhand javelin throw (wind-up, release at the
// contact key, follow-through) and the lean off the saddle. Everything is pose keys + IK targets (character space, metres: +Z forward,
// +X the rider's LEFT, origin on the ground under the pelvis, 0.895 m up). The throw clip's `contact` event is the RELEASE; the
// presenter retimes it so the release lands on the sim's release tick.
import { buildClip } from '../vendor3d/index.js';
export const REIN_HAND = [0.10, 1.02, 0.42];
export const TC = 12 / 60;                  // the throw clip releases 12 sim ticks after its start (WIND_TICKS)

const SEAT_LEGS = { L_Thigh: { flex: 80, abduct: 14 }, R_Thigh: { flex: 80, abduct: 14 }, L_Calf: { flex: 96 }, R_Calf: { flex: 96 } };
// feet and the rein hand are placed by horse3d (stirrup treads, rein target); clips only pose the trunk and the throwing arm
const IK = {};
const REIN_IK = () => ({});
const FEET_IK = {};
// carry: javelin held low at the right side, tip forward and slightly up
const CARRY = { grip: [-0.26, 1.02, 0.22], dir: [0.12, 0.34, 0.93] };

export function authorClips(h) {
  const add = (spec) => { const c = buildClip(h, { grounded: false, fingers: 'relaxed', ...spec }); h.addClip(c); return c; };
  const seatPose = (extra = {}) => ({ ...SEAT_LEGS, ...extra });
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

  // live layer: slow additive sway of the back, shoulders and head
  add({ name: 'live', duration: 3, loop: true, base: 'rest', keys: [
    { t: 0, pose: { Spine: { flex: 0, side: 0, twist: 0 }, Spine1: { flex: 0, side: 0, twist: 0 }, Spine2: { flex: 0, side: 0, twist: 0 }, Neck: { flex: 0, twist: 0 }, Head: { flex: 0, side: 0, twist: 0 } } },
    { t: 0.75, pose: { Spine: { side: 1.6, twist: 1.0, flex: 0.6 }, Spine1: { side: 1.4, twist: 1.4, flex: 0.9 }, Spine2: { side: 1.0, twist: 1.0, flex: 1.2 }, Neck: { flex: 1.5, twist: -1.5 }, Head: { flex: -1.0, side: -1.2, twist: -2.0 } }, ease: 'inOut' },
    { t: 1.5, pose: { Spine: { side: 0.2, twist: -0.8, flex: 1.2 }, Spine1: { side: 0.4, twist: -1.2, flex: 1.6 }, Spine2: { side: 0.2, twist: -1.0, flex: 2.0 }, Neck: { flex: 0.5, twist: 1.5 }, Head: { flex: 0.8, side: 0.8, twist: 2.4 } }, ease: 'inOut' },
    { t: 2.25, pose: { Spine: { side: -1.4, twist: 0.6, flex: 0.4 }, Spine1: { side: -1.2, twist: 0.9, flex: 0.6 }, Spine2: { side: -1.0, twist: 0.7, flex: 0.8 }, Neck: { flex: 1.0, twist: -0.5 }, Head: { flex: -0.5, side: 1.0, twist: -1.0 } }, ease: 'inOut' },
    { t: 3, pose: { Spine: { side: 0, twist: 0, flex: 0 }, Spine1: { side: 0, twist: 0, flex: 0 }, Spine2: { side: 0, twist: 0, flex: 0 }, Neck: { flex: 0, twist: 0 }, Head: { flex: 0, side: 0, twist: 0 } } },
  ], smoothTrunk: false });

  // ---- the throw: carry -> cocked back beside the head (0.12 s) -> arm snaps forward and the stick leaves the hand at TC -> follows
  // through across the body -> back to carry. The lean of the trunk mirrors a real overhand throw.
  const cock = seatPose({ Spine: { twist: -14, side: -4, flex: -2 }, Spine1: { twist: -18, side: -5, flex: -3 }, Spine2: { twist: -16, side: -4, flex: -3 }, Pelvis: { flex: 8 } });
  const rel = seatPose({ Spine: { twist: 8, side: 2, flex: 8 }, Spine1: { twist: 12, side: 3, flex: 10 }, Spine2: { twist: 10, side: 3, flex: 10 }, Pelvis: { flex: 10 } });
  const fol = seatPose({ Spine: { twist: 18, side: 2, flex: 14 }, Spine1: { twist: 20, side: 3, flex: 16 }, Spine2: { twist: 16, side: 3, flex: 16 }, Pelvis: { flex: 10 } });
  add({
    name: 'throw', duration: 0.95, base: 'ride',
    keys: [
      { t: 0 },
      { t: 0.09, pose: cock, ease: 'out' },
      { t: TC, pose: rel, ease: 'in' },
      { t: 0.45, pose: fol, ease: 'out' },
      { t: 0.95, pose: seatPose({ Spine: { twist: 0, side: 0, flex: 3 }, Spine1: { twist: 0, side: 0, flex: 3 }, Spine2: { twist: 0, side: 0, flex: 2 }, Pelvis: { flex: 8 } }), ease: 'inOut' },
    ],
    ik: IK, events: { contact: TC },
    prop: [
      { t: 0, ...CARRY },
      { t: 0.09, grip: [-0.34, 1.50, -0.30], dir: [0.10, 0.40, 0.91], ease: 'out' },
      { t: TC, grip: [-0.22, 1.92, 0.55], dir: [0.10, 0.34, 0.93], ease: 'in' },
      { t: 0.45, grip: [0.05, 1.20, 0.62], dir: [0.30, -0.30, 0.90], ease: 'out' },
      { t: 0.95, ...CARRY, ease: 'inOut' },
    ],
  });

  // ---- the lean: the rider drops off the saddle to one side and hangs along the horse, holding on with the reins hand
  const leanTo = (name, s) => add({
    name, duration: 0.7, base: 'ride',
    keys: [
      { t: 0 },
      { t: 0.14, pose: seatPose({ Pelvis: { side: s * 18, flex: 14, pos: [s * 0.1, -0.06, 0] }, Spine: { side: s * 26, flex: 16 }, Spine1: { side: s * 30, flex: 16 }, Spine2: { side: s * 24, flex: 12 }, Neck: { flex: -6, side: s * -14 }, Head: { flex: -4, side: s * -16 } }), ease: 'out' },
      { t: 0.5, pose: seatPose({ Pelvis: { side: s * 18, flex: 14, pos: [s * 0.1, -0.06, 0] }, Spine: { side: s * 26, flex: 16 }, Spine1: { side: s * 30, flex: 16 }, Spine2: { side: s * 24, flex: 12 }, Neck: { flex: -6, side: s * -14 }, Head: { flex: -4, side: s * -16 } }) },
      { t: 0.7, pose: seatPose({ Spine: { side: 0, flex: 3 }, Spine1: { side: 0, flex: 3 }, Spine2: { side: 0, flex: 2 }, Pelvis: { flex: 8, side: 0, pos: [0, 0, 0] }, Neck: { flex: -6, side: 0 }, Head: { flex: -4, side: 0 } }), ease: 'inOut' },
    ],
    ik: IK,
    prop: [{ t: 0, ...CARRY }, { t: 0.14, grip: [-0.30, 0.80, 0.30], dir: [0.10, 0.10, 0.99], ease: 'out' }, { t: 0.5, grip: [-0.30, 0.80, 0.30], dir: [0.10, 0.10, 0.99] }, { t: 0.7, ...CARRY, ease: 'inOut' }],
  });
  leanTo('lean_L', 1); leanTo('lean_R', -1);
}
