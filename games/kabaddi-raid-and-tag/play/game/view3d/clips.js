// Kabaddi clips, authored with buildClip + IK on top of the shared base library (nothing in vendor3d is edited).
// Character space: +Z is the way the player faces, +X is his LEFT. Hand/foot IK keys may point at named WORLD targets that the
// choreographer sets every frame from the other player's body ('tA' primary contact, 'tL'/'tR' for two-handed holds, 'tF' a foot
// target): the sim owns where the contact is, the clip only says how the body gets there. Every contact clip has an `events.contact`
// and is started with playTimed(name, 'contact', eta) so contact lands exactly on the sim's time.
import { buildClip } from '../vendor3d/index.js';

export const CLIP_NAMES = [];

export function addKabaddiClips(human) {
  const S = human.info && human.info.height ? human.info.height / 1.74 : 1;      // IK targets scale with the body (1.74 m = athlete_f)
  const P = (a) => a.map((v) => v * S);
  const ik = (arr) => arr.map((k) => ({ ...k, pos: k.pos ? P(k.pos) : undefined, off: k.off ? P(k.off) : undefined }));
  const make = (spec) => { const c = buildClip(human, { group: 'kabaddi', ...spec }); human.addClip(c); if (!CLIP_NAMES.includes(spec.name)) CLIP_NAMES.push(spec.name); return c; };

  // ---- stances (loops) -------------------------------------------------------------------------------------------------------------------
  // Raider: low, weight on the balls of the feet, a gentle bounce, one hand forward and one back, eyes up.
  const raidStance = (a, o = {}) => ({
    Pelvis: { pos: [0, -0.02 - 0.03 * a, 0.02] }, R_Thigh: { flex: 12 + 7 * a }, R_Calf: { flex: 12 + 12 * a }, L_Thigh: { flex: 22 + 7 * a, abduct: 4 }, L_Calf: { flex: 20 + 12 * a },
    Spine: { flex: 6 }, Spine1: { flex: 8, twist: -4 }, Spine2: { flex: 4, twist: -3 }, Neck: { flex: -8 }, Head: { flex: -4 },
    R_UpperArm: { flex: 34, abduct: 14 }, R_Forearm: { flex: 58 }, L_UpperArm: { flex: 14, abduct: 24 }, L_Forearm: { flex: 62 }, R_Hand: { rot: [0, 0, -28] }, L_Hand: { rot: [0, 0, -28] }, ...o,
  });
  make({
    name: 'k_raid_stance', duration: 0.8, loop: true, base: 'ready_stance', fingers: 'relaxed',
    keys: [{ t: 0, pose: raidStance(0) }, { t: 0.4, pose: raidStance(1), ease: 'inOut' }, { t: 0.8, pose: raidStance(0), ease: 'inOut' }],
  });
  const hands0 = (kL, kR) => ({
    L_Hand: { keys: ik(kL), pole: [{ t: 0, pos: [0.8, 0.85, 0.15] }, { t: 3, pos: [0.8, 0.85, 0.15] }] },
    R_Hand: { keys: ik(kR), pole: [{ t: 0, pos: [-0.8, 0.85, 0.15] }, { t: 3, pos: [-0.8, 0.85, 0.15] }] },
  });
  const defStance = (a) => ({
    Pelvis: { pos: [0, -0.04 - 0.025 * a, 0] }, R_Thigh: { flex: 10 + 6 * a, abduct: 10 }, R_Calf: { flex: 12 + 10 * a }, L_Thigh: { flex: 10 + 6 * a, abduct: 10 }, L_Calf: { flex: 12 + 10 * a },
    Spine: { flex: 6 }, Spine1: { flex: 8 }, Spine2: { flex: 4 }, Neck: { flex: -8 }, Head: { flex: -4 },
    R_UpperArm: { flex: 40, abduct: 44 }, R_Forearm: { flex: 62 }, L_UpperArm: { flex: 40, abduct: 44 }, L_Forearm: { flex: 62 }, R_Hand: { rot: [0, 0, -40] }, L_Hand: { rot: [0, 0, -40] },
  });
  make({
    name: 'k_def_stance', duration: 1.0, loop: true, base: 'ready_stance', fingers: 'relaxed',
    keys: [{ t: 0, pose: defStance(0) }, { t: 0.5, pose: defStance(1), ease: 'inOut' }, { t: 1.0, pose: defStance(0), ease: 'inOut' }],
    // hands held out in front, apart, elbows bent and out: the IK puts the hands where a defender keeps them (the elbow follows the pole)
    ik: hands0([{ t: 0, pos: [0.34, 1.0, 0.42] }, { t: 0.5, pos: [0.34, 0.95, 0.44], ease: 'inOut' }, { t: 1.0, pos: [0.34, 1.0, 0.42], ease: 'inOut' }], [{ t: 0, pos: [-0.34, 1.0, 0.42] }, { t: 0.5, pos: [-0.34, 0.95, 0.44], ease: 'inOut' }, { t: 1.0, pos: [-0.34, 1.0, 0.42], ease: 'inOut' }]),
  });

  // ---- the raider's moves ------------------------------------------------------------------------------------------------------------------
  // Hand touch: a long step in and a long reach with the right hand to the target, a short hold, then back to the stance.
  const lunge = (f) => ({
    Pelvis: { pos: [0, -0.05 - 0.07 * f, 0.02 + 0.3 * f] }, R_Thigh: { flex: 14 + 34 * f }, R_Calf: { flex: 14 + 8 * f }, L_Thigh: { flex: 22 - 38 * f }, L_Calf: { flex: 20 - 6 * f },
    Spine: { flex: 6 + 5 * f }, Spine1: { flex: 8 + 8 * f, twist: -4 - 16 * f }, Spine2: { flex: 4 + 5 * f, twist: -3 - 12 * f }, Neck: { flex: -8 - 6 * f },
  });
  const rest = { ...raidStance(0), ...lunge(0) };
  make({
    name: 'k_hand_touch', duration: 1.4, base: 'ready_stance', fingers: 'relaxed',
    keys: [
      { t: 0, pose: rest },
      { t: 0.3, pose: { ...lunge(0.45), R_UpperArm: { flex: 60, abduct: 14 }, R_Forearm: { flex: 40 }, L_UpperArm: { flex: 8, abduct: 34 }, L_Forearm: { flex: 46 } }, ease: 'inOut' },
      { t: 0.55, pose: { ...lunge(1), R_UpperArm: { flex: 84, abduct: 8 }, R_Forearm: { flex: 6 }, L_UpperArm: { flex: -30, abduct: 42 }, L_Forearm: { flex: 30 } }, ease: 'out' },
      { t: 0.85, pose: { ...lunge(0.9), R_UpperArm: { flex: 78, abduct: 10 }, R_Forearm: { flex: 12 } }, ease: 'inOut' },
      { t: 1.4, pose: rest, ease: 'inOut' },
    ],
    ik: { R_Hand: { keys: ik([{ t: 0, pos: [-0.2, 0.98, 0.34] }, { t: 0.3, pos: [-0.18, 1.1, 0.7], ease: 'out' }, { t: 0.55, target: 'tA', ease: 'out' }, { t: 0.85, target: 'tA', off: [0, 0.02, -0.03] }, { t: 1.4, pos: [-0.2, 0.98, 0.34], ease: 'inOut' }]), pole: [{ t: 0, pos: [-0.7, 1.1, 0.2] }, { t: 1.4, pos: [-0.7, 1.1, 0.2] }] } },
    events: { contact: 0.55, peak: 0.55 },
  });

  // Toe touch: lean back, arms out for balance, the right leg swings forward and the toe taps the target.
  const toeBody = (f) => ({
    Pelvis: { pos: [0, -0.03 - 0.05 * f, 0.02 + 0.04 * f], side: 4 * f }, L_Thigh: { flex: 18 + 10 * f }, L_Calf: { flex: 22 + 10 * f }, R_Thigh: { flex: 12 + 62 * f }, R_Calf: { flex: 12 - 4 * f },
    Spine: { flex: 6 - 14 * f }, Spine1: { flex: 8 - 16 * f, twist: -4 - 6 * f }, Spine2: { flex: 4 - 8 * f }, Neck: { flex: -8 + 6 * f },
    R_UpperArm: { flex: 20 - 10 * f, abduct: 14 + 46 * f }, R_Forearm: { flex: 40 - 20 * f }, L_UpperArm: { flex: 14 - 4 * f, abduct: 24 + 48 * f }, L_Forearm: { flex: 50 - 24 * f },
  });
  make({
    name: 'k_toe_touch', duration: 1.4, base: 'ready_stance', fingers: 'relaxed',
    keys: [{ t: 0, pose: { ...raidStance(0), ...toeBody(0) } }, { t: 0.3, pose: toeBody(0.5), ease: 'inOut' }, { t: 0.55, pose: toeBody(1), ease: 'out' }, { t: 0.85, pose: toeBody(0.9), ease: 'inOut' }, { t: 1.4, pose: { ...raidStance(0), ...toeBody(0) }, ease: 'inOut' }],
    ik: { R_Foot: { keys: ik([{ t: 0, pos: [-0.12, 0.08, 0.1] }, { t: 0.3, pos: [-0.12, 0.45, 0.5], ease: 'out' }, { t: 0.55, target: 'tF', ease: 'out' }, { t: 0.85, target: 'tF', off: [0, 0.03, -0.04] }, { t: 1.4, pos: [-0.12, 0.08, 0.1], ease: 'inOut' }]), weight: [{ t: 0, v: 0 }, { t: 0.2, v: 1 }, { t: 1.0, v: 1 }, { t: 1.4, v: 0 }] } },
    events: { contact: 0.55, peak: 0.55 },
  });

  // Feints: a shoulder drop and a weight shift to one side, a short step, back to the stance. No contact.
  const feint = (name, k) => {
    const sw = (f) => ({
      Pelvis: { pos: [0.03 * k * f, -0.06 * f, 0.03 * f], side: 8 * k * f }, Spine1: { twist: (-4 + 26 * k) * f - 4 * (1 - f), side: 12 * k * f, flex: 12 }, Spine2: { twist: 14 * k * f, side: 6 * k * f },
      Neck: { twist: -8 * k * f }, L_Thigh: { flex: 22 + 8 * f, abduct: 4 + (k > 0 ? 16 : 0) * f }, R_Thigh: { flex: 12 + 8 * f, abduct: 10 * (k < 0 ? 1.6 : 0) * f },
      R_UpperArm: { flex: 34 + 10 * f, abduct: 14 + 10 * f }, L_UpperArm: { flex: 14 + 10 * f, abduct: 24 + 10 * f },
    });
    make({ name, duration: 1.0, base: 'ready_stance', fingers: 'relaxed', keys: [{ t: 0, pose: { ...raidStance(0), ...sw(0) } }, { t: 0.3, pose: { ...raidStance(0), ...sw(1) }, ease: 'out' }, { t: 0.55, pose: { ...raidStance(0), ...sw(1) }, ease: 'inOut' }, { t: 1.0, pose: { ...raidStance(0), ...sw(0) }, ease: 'inOut' }], events: { peak: 0.3 } });
  };
  feint('k_feint_l', 1); feint('k_feint_r', -1);

  // Bonus reach: a long stride over the bonus line with the right foot, upright, left arm out for balance, then back.
  const bonus = (f) => ({
    Pelvis: { pos: [0, -0.06 - 0.1 * f, 0.02 + 0.32 * f] }, R_Thigh: { flex: 12 + 52 * f }, R_Calf: { flex: 12 + 4 * f }, L_Thigh: { flex: 22 - 34 * f }, L_Calf: { flex: 20 + 4 * f },
    Spine: { flex: 6 }, Spine1: { flex: 8 + 4 * f }, Spine2: { flex: 4 }, R_UpperArm: { flex: 30 - 10 * f, abduct: 14 + 30 * f }, L_UpperArm: { flex: 14 + 10 * f, abduct: 24 + 40 * f },
  });
  make({
    name: 'k_bonus_reach', duration: 1.6, base: 'ready_stance', fingers: 'relaxed',
    keys: [{ t: 0, pose: { ...raidStance(0), ...bonus(0) } }, { t: 0.4, pose: bonus(0.6), ease: 'inOut' }, { t: 0.7, pose: bonus(1), ease: 'out' }, { t: 1.0, pose: bonus(1), ease: 'inOut' }, { t: 1.6, pose: { ...raidStance(0), ...bonus(0) }, ease: 'inOut' }],
    ik: { R_Foot: { keys: ik([{ t: 0, pos: [-0.12, 0.08, 0.1] }, { t: 0.4, pos: [-0.12, 0.3, 0.5], ease: 'out' }, { t: 0.7, target: 'tF', ease: 'out' }, { t: 1.0, target: 'tF' }, { t: 1.6, pos: [-0.12, 0.08, 0.1], ease: 'inOut' }]), weight: [{ t: 0, v: 0 }, { t: 0.2, v: 1 }, { t: 1.1, v: 1 }, { t: 1.6, v: 0 }] } },
    events: { contact: 0.7, peak: 0.7 },
  });

  // Running touch: the sprint with the right arm thrown out to tag the defender as the raider passes.
  make({
    name: 'k_run_touch', duration: 1.0, base: 'sprint', fingers: 'relaxed',
    keys: [{ t: 0, pose: { Spine1: { flex: 6 } } }, { t: 0.3, pose: { Spine1: { flex: 12, twist: -10 }, Spine2: { twist: -8 } }, ease: 'inOut' }, { t: 0.5, pose: { Spine1: { flex: 14, twist: -18 }, Spine2: { twist: -14 } }, ease: 'out' }, { t: 1.0, pose: { Spine1: { flex: 6 } }, ease: 'inOut' }],
    ik: { R_Hand: { keys: ik([{ t: 0, pos: [-0.3, 1.05, 0.3] }, { t: 0.3, pos: [-0.55, 1.2, 0.45], ease: 'out' }, { t: 0.5, target: 'tA', ease: 'out' }, { t: 0.7, target: 'tA', off: [0, 0.02, -0.1] }, { t: 1.0, pos: [-0.3, 1.05, 0.3], ease: 'inOut' }]), pole: [{ t: 0, pos: [-0.8, 1.0, 0.0] }, { t: 1.0, pos: [-0.8, 1.0, 0.0] }], weight: [{ t: 0, v: 0 }, { t: 0.2, v: 1 }, { t: 0.8, v: 1 }, { t: 1.0, v: 0 }] } },
    events: { contact: 0.5, peak: 0.5 },
  });

  // ---- the defence's answers ---------------------------------------------------------------------------------------------------------------
  // Lunge at a touch or a feint: a step toward the raider and both hands reaching out to grab.
  const dl = (f) => ({
    Pelvis: { pos: [0, -0.06 - 0.05 * f, 0.02 + 0.22 * f] }, R_Thigh: { flex: 10 + 30 * f, abduct: 10 }, R_Calf: { flex: 12 + 8 * f }, L_Thigh: { flex: 10 - 12 * f, abduct: 10 }, L_Calf: { flex: 12 },
    Spine: { flex: 6 + 6 * f }, Spine1: { flex: 8 + 12 * f }, Spine2: { flex: 4 + 6 * f }, Neck: { flex: -8 - 4 * f },
    R_UpperArm: { flex: 22 + 46 * f, abduct: 38 - 20 * f }, R_Forearm: { flex: 38 - 20 * f }, L_UpperArm: { flex: 22 + 46 * f, abduct: 38 - 20 * f }, L_Forearm: { flex: 38 - 20 * f },
  });
  make({ name: 'k_def_lunge', duration: 1.1, base: 'ready_stance', fingers: 'relaxed', keys: [{ t: 0, pose: dl(0) }, { t: 0.4, pose: dl(0.5), ease: 'inOut' }, { t: 0.6, pose: dl(1), ease: 'out' }, { t: 0.8, pose: dl(0.8), ease: 'inOut' }, { t: 1.1, pose: dl(0), ease: 'inOut' }], events: { contact: 0.6 } });
  // Hold ground / step back out of reach, hands up.
  const db = (f) => ({
    Pelvis: { pos: [0, -0.05 - 0.02 * f, -0.18 * f] }, R_Thigh: { flex: 10 - 6 * f, abduct: 10 }, L_Thigh: { flex: 10 + 6 * f, abduct: 10 }, R_Calf: { flex: 12 }, L_Calf: { flex: 12 + 6 * f },
    Spine: { flex: 6 - 5 * f }, Spine1: { flex: 8 - 6 * f }, Neck: { flex: -8 },
    R_UpperArm: { flex: 22 - 14 * f, abduct: 38 + 14 * f }, R_Forearm: { flex: 38 - 14 * f }, L_UpperArm: { flex: 22 - 14 * f, abduct: 38 + 14 * f }, L_Forearm: { flex: 38 - 14 * f },
  });
  make({ name: 'k_def_back', duration: 1.1, base: 'ready_stance', fingers: 'relaxed', keys: [{ t: 0, pose: db(0) }, { t: 0.35, pose: db(1), ease: 'out' }, { t: 0.8, pose: db(1), ease: 'inOut' }, { t: 1.1, pose: db(0), ease: 'inOut' }], events: { contact: 0.4 } });

  // ---- the holds --------------------------------------------------------------------------------------------------------------------------
  // Each answer is a pair: an approach clip that ends (event `contact`) with both hands on the raider, and a short loop that keeps the
  // hold (a gentle strain, nobody is thrown or hurt). The hand targets are set from the raider's body each frame: 'tL' / 'tR'.
  const hands = (kL, kR) => ({
    L_Hand: { keys: ik(kL), pole: [{ t: 0, pos: [0.95, 0.8, 0.2] }, { t: 3, pos: [0.95, 0.8, 0.2] }] },
    R_Hand: { keys: ik(kR), pole: [{ t: 0, pos: [-0.95, 0.8, 0.2] }, { t: 3, pos: [-0.95, 0.8, 0.2] }] },
  });
  const wrapPose = (f, deep) => ({
    Pelvis: { pos: [0, -0.06 - deep * f, 0.02 + 0.2 * f] }, R_Thigh: { flex: 10 + (44 + deep * 60) * f, abduct: 10 }, L_Thigh: { flex: 10 + (44 + deep * 60) * f, abduct: 10 },
    R_Calf: { flex: 12 + (50 + deep * 80) * f }, L_Calf: { flex: 12 + (50 + deep * 80) * f },
    Spine: { flex: 6 + 12 * f }, Spine1: { flex: 8 + (26 + deep * 20) * f }, Spine2: { flex: 4 + (10 + deep * 10) * f }, Neck: { flex: -8 - (24 + deep * 20) * f }, Head: { flex: -4 - 6 * f },
  });
  const holdPair = (name, deep, tz) => {
    const L0 = [0.28, 0.9, 0.35], R0 = [-0.28, 0.9, 0.35];
    make({
      name: `${name}_in`, duration: 0.7, base: 'ready_stance', fingers: 'relaxed',
      keys: [{ t: 0, pose: { ...defStance(0), ...wrapPose(0, deep) } }, { t: 0.35, pose: wrapPose(0.55, deep), ease: 'inOut' }, { t: 0.7, pose: wrapPose(1, deep), ease: 'out' }],
      ik: hands([{ t: 0, pos: [0.3, 0.95, 0.3] }, { t: 0.35, pos: L0, ease: 'out' }, { t: 0.7, target: 'tL', ease: 'out' }], [{ t: 0, pos: [-0.3, 0.95, 0.3] }, { t: 0.35, pos: R0, ease: 'out' }, { t: 0.7, target: 'tR', ease: 'out' }]),
      events: { contact: 0.7 },
    });
    make({
      name: `${name}_hold`, duration: 1.0, loop: true, base: 'ready_stance', fingers: 'fist',
      keys: [{ t: 0, pose: wrapPose(1, deep) }, { t: 0.5, pose: { ...wrapPose(1, deep), Pelvis: { pos: [0, -0.06 - deep - 0.012, 0.22] } }, ease: 'inOut' }, { t: 1.0, pose: wrapPose(1, deep), ease: 'inOut' }],
      ik: hands([{ t: 0, target: 'tL' }, { t: 1.0, target: 'tL' }], [{ t: 0, target: 'tR' }, { t: 1.0, target: 'tR' }]),
    });
  };
  holdPair('k_def_thigh', 0.0); holdPair('k_def_ankle', 0.3);
  // After a failed hold: the defender grabs air, stumbles a step forward and recovers.
  make({
    name: 'k_def_miss', duration: 1.1, base: 'ready_stance', fingers: 'relaxed',
    keys: [{ t: 0, pose: wrapPose(1, 0) }, { t: 0.35, pose: { ...wrapPose(0.7, 0), Spine1: { flex: 40 } }, ease: 'out' }, { t: 1.1, pose: { ...defStance(0), ...wrapPose(0, 0) }, ease: 'inOut' }],
    ik: hands([{ t: 0, target: 'tL' }, { t: 0.3, pos: [0.3, 0.7, 0.5], ease: 'out' }, { t: 1.1, pos: [0.3, 0.95, 0.3], ease: 'inOut' }], [{ t: 0, target: 'tR' }, { t: 0.3, pos: [-0.3, 0.7, 0.5], ease: 'out' }, { t: 1.1, pos: [-0.3, 0.95, 0.3], ease: 'inOut' }]),
    events: { peak: 0.35 },
  });
  // The raider who has been stopped: weight pulled back, hands up and open, a small steadying rock.
  const held = (a) => ({
    Pelvis: { pos: [0, -0.03, -0.06 - 0.01 * a] }, R_Thigh: { flex: 2 }, L_Thigh: { flex: 2 }, R_Calf: { flex: 4 }, L_Calf: { flex: 4 },
    Spine: { flex: -4 }, Spine1: { flex: -6 + 2 * a }, Spine2: { flex: -4 }, Neck: { flex: 4 },
    R_UpperArm: { flex: 18 + 6 * a, abduct: 66 }, R_Forearm: { flex: 34 }, L_UpperArm: { flex: 18 + 6 * a, abduct: 66 }, L_Forearm: { flex: 34 },
  });
  make({ name: 'k_held', duration: 1.0, loop: true, base: 'ready_stance', fingers: 'relaxed', keys: [{ t: 0, pose: held(0) }, { t: 0.5, pose: held(1), ease: 'inOut' }, { t: 1.0, pose: held(0), ease: 'inOut' }] });

  // A side defender of a chain tackle: leans in sideways and hugs the raider's hip, hands side by side (the chain is held by the lead defender).
  const sidePose = (f) => ({
    Pelvis: { pos: [0, -0.07 - 0.07 * f, 0.02 + 0.14 * f] }, R_Thigh: { flex: 10 + 34 * f, abduct: 10 }, L_Thigh: { flex: 10 + 34 * f, abduct: 10 }, R_Calf: { flex: 12 + 36 * f }, L_Calf: { flex: 12 + 36 * f },
    Spine: { flex: 6 + 8 * f }, Spine1: { flex: 8 + 20 * f }, Spine2: { flex: 4 + 8 * f }, Neck: { flex: -8 - 20 * f }, Head: { flex: -4 - 4 * f },
  });
  make({
    name: 'k_def_side_in', duration: 0.7, base: 'ready_stance', fingers: 'relaxed',
    keys: [{ t: 0, pose: { ...defStance(0), ...sidePose(0) } }, { t: 0.35, pose: sidePose(0.55), ease: 'inOut' }, { t: 0.7, pose: sidePose(1), ease: 'out' }],
    ik: hands([{ t: 0, pos: [0.3, 0.95, 0.3] }, { t: 0.35, pos: [0.28, 0.95, 0.45], ease: 'out' }, { t: 0.7, target: 'tL', ease: 'out' }], [{ t: 0, pos: [-0.3, 0.95, 0.3] }, { t: 0.35, pos: [-0.28, 0.95, 0.45], ease: 'out' }, { t: 0.7, target: 'tR', ease: 'out' }]),
    events: { contact: 0.7 },
  });
  make({
    name: 'k_def_side_hold', duration: 1.0, loop: true, base: 'ready_stance', fingers: 'fist',
    keys: [{ t: 0, pose: sidePose(1) }, { t: 0.5, pose: { ...sidePose(1), Pelvis: { pos: [0, -0.15, 0.16] } }, ease: 'inOut' }, { t: 1.0, pose: sidePose(1), ease: 'inOut' }],
    ik: hands([{ t: 0, target: 'tL' }, { t: 1.0, target: 'tL' }], [{ t: 0, target: 'tR' }, { t: 1.0, target: 'tR' }]),
  });
  // Block: arms spread wide, low and ready: nothing is touched, the way home is shut.
  const blk = (f) => ({
    Pelvis: { pos: [0, -0.06 - 0.06 * f, 0.02] }, R_Thigh: { flex: 10 + 16 * f, abduct: 14 + 10 * f }, L_Thigh: { flex: 10 + 16 * f, abduct: 14 + 10 * f }, R_Calf: { flex: 12 + 16 * f }, L_Calf: { flex: 12 + 16 * f },
    Spine1: { flex: 8 + 4 * f }, Neck: { flex: -8 },
    R_UpperArm: { flex: 22 - 8 * f, abduct: 38 + 52 * f }, R_Forearm: { flex: 38 - 24 * f }, L_UpperArm: { flex: 22 - 8 * f, abduct: 38 + 52 * f }, L_Forearm: { flex: 38 - 24 * f },
  });
  make({ name: 'k_def_block_in', duration: 0.6, base: 'ready_stance', fingers: 'relaxed', keys: [{ t: 0, pose: { ...defStance(0), ...blk(0) } }, { t: 0.6, pose: blk(1), ease: 'out' }], events: { contact: 0.6 } });
  make({ name: 'k_def_block_hold', duration: 1.0, loop: true, base: 'ready_stance', fingers: 'relaxed', keys: [{ t: 0, pose: blk(1) }, { t: 0.5, pose: { ...blk(1), Pelvis: { pos: [0, -0.135, 0.02] } }, ease: 'inOut' }, { t: 1.0, pose: blk(1), ease: 'inOut' }] });
  // Touched: a defender who has been tagged steps back and lifts his hands to say so.
  const tch = (f) => ({
    Pelvis: { pos: [0, -0.05 + 0.03 * f, -0.14 * f] }, R_Thigh: { flex: 10 - 4 * f }, L_Thigh: { flex: 10 - 4 * f }, Spine1: { flex: 8 - 10 * f }, Spine: { flex: 6 - 4 * f }, Neck: { flex: -8 },
    R_UpperArm: { flex: 22 + 30 * f, abduct: 38 + 20 * f }, R_Forearm: { flex: 38 + 40 * f }, L_UpperArm: { flex: 22 + 30 * f, abduct: 38 + 20 * f }, L_Forearm: { flex: 38 + 40 * f },
  });
  make({ name: 'k_def_touched', duration: 1.2, base: 'ready_stance', fingers: 'relaxed', keys: [{ t: 0, pose: tch(0) }, { t: 0.3, pose: tch(1), ease: 'out' }, { t: 0.9, pose: tch(1), ease: 'inOut' }, { t: 1.2, pose: tch(0), ease: 'inOut' }] });

  // ---- live stances: four defender variants and two raider variants, each its own loop, so no two players hold the same pose -----------------
  // Asymmetric on purpose: one hand ahead and higher, the other lower and closer, different elbow bend and wrist angle on each side.
  const defVar = [
    // wide and low
    (a) => ({ Pelvis: { pos: [0, -0.11 - 0.02 * a, 0] }, R_Thigh: { flex: 22 + 5 * a, abduct: 20 }, L_Thigh: { flex: 26 + 5 * a, abduct: 18 }, R_Calf: { flex: 28 + 8 * a }, L_Calf: { flex: 32 + 8 * a }, Neck: { flex: -16 }, Head: { flex: -9 }, Spine1: { flex: 6, twist: -5 }, Spine2: { flex: 4, side: 2 },
      R_UpperArm: { flex: 30, abduct: 34 }, R_Forearm: { flex: 20 }, L_UpperArm: { flex: 14, abduct: 44 }, L_Forearm: { flex: 38 }, R_Hand: { rot: [0, 0, -24] }, L_Hand: { rot: [0, 0, -16] } }),
    // narrow and upright
    (a) => ({ Pelvis: { pos: [0, -0.03 - 0.015 * a, 0] }, R_Thigh: { flex: 10 + 4 * a, abduct: 4 }, L_Thigh: { flex: 12 + 4 * a, abduct: 5 }, R_Calf: { flex: 12 + 6 * a }, L_Calf: { flex: 14 + 6 * a }, Neck: { flex: -16 }, Head: { flex: -9 }, Spine1: { flex: 2, twist: 4 }, Spine2: { flex: 2, side: -3 },
      R_UpperArm: { flex: 16, abduct: 46 }, R_Forearm: { flex: 36 }, L_UpperArm: { flex: 32, abduct: 32 }, L_Forearm: { flex: 24 }, R_Hand: { rot: [0, 0, -18] }, L_Hand: { rot: [0, 0, -26] } }),
    // one foot forward
    (a) => ({ Pelvis: { pos: [0, -0.06 - 0.02 * a, 0.03] }, R_Thigh: { flex: 28 + 5 * a, abduct: 8 }, L_Thigh: { flex: 4 + 3 * a, abduct: 12 }, R_Calf: { flex: 24 + 6 * a }, L_Calf: { flex: 12 + 6 * a }, Neck: { flex: -16 }, Head: { flex: -9 }, Spine1: { flex: 4, twist: -7 }, Spine2: { flex: 4, twist: -3 },
      R_UpperArm: { flex: 26, abduct: 40 }, R_Forearm: { flex: 14 }, L_UpperArm: { flex: 12, abduct: 36 }, L_Forearm: { flex: 44 }, R_Hand: { rot: [0, 0, -28] }, L_Hand: { rot: [0, 0, -20] } }),
    // half crouch, hands up near the chest
    (a) => ({ Pelvis: { pos: [0, -0.08 - 0.02 * a, 0] }, R_Thigh: { flex: 18 + 5 * a, abduct: 12 }, L_Thigh: { flex: 24 + 5 * a, abduct: 10 }, R_Calf: { flex: 24 + 8 * a }, L_Calf: { flex: 30 + 8 * a }, Neck: { flex: -16 }, Head: { flex: -9 }, Spine1: { flex: 10, twist: 5 }, Spine2: { flex: 6, side: 3 },
      R_UpperArm: { flex: 18, abduct: 48 }, R_Forearm: { flex: 22 }, L_UpperArm: { flex: 28, abduct: 38 }, L_Forearm: { flex: 30 }, R_Hand: { rot: [0, 0, -20] }, L_Hand: { rot: [0, 0, -24] } }),
  ];
  const durs = [1.0, 1.25, 0.9, 1.1];
  defVar.forEach((f, i) => make({ name: `k_def_stance_${i}`, duration: durs[i], loop: true, base: 'ready_stance', fingers: 'relaxed', keys: [{ t: 0, pose: f(0) }, { t: durs[i] / 2, pose: f(1), ease: 'inOut' }, { t: durs[i], pose: f(0), ease: 'inOut' }] }));
  const raidVar = [
    (a) => ({ ...raidStance(a), R_Hand: { rot: [6, 0, -6] }, L_Hand: { rot: [-4, 0, 8] } }),
    (a) => ({ ...raidStance(a, { R_UpperArm: { flex: 20, abduct: 22 }, R_Forearm: { flex: 70 }, L_UpperArm: { flex: 40, abduct: 18 }, L_Forearm: { flex: 52 } }), Pelvis: { pos: [0, -0.05 - 0.03 * a, 0.02] }, R_Hand: { rot: [-5, 0, 8] }, L_Hand: { rot: [7, 0, -5] } }),
  ];
  raidVar.forEach((f, i) => make({ name: `k_raid_stance_${i}`, duration: 0.8 + 0.1 * i, loop: true, base: 'ready_stance', fingers: 'relaxed', keys: [{ t: 0, pose: f(0) }, { t: (0.8 + 0.1 * i) / 2, pose: f(1), ease: 'inOut' }, { t: 0.8 + 0.1 * i, pose: f(0), ease: 'inOut' }] }));
  // additive life: breathing, side-to-side weight shift, torso sway and a head that drifts, played on its own layer at a different speed and phase per player
  const live = (u) => ({
    Pelvis: { pos: [0.045 * Math.sin(u * 6.283), 0.016 * Math.abs(Math.sin(u * 12.566)) - 0.006, 0.006 * Math.sin(u * 6.283 + 1)], side: 2.5 * Math.sin(u * 6.283) },
    Spine1: { twist: 5 * Math.sin(u * 6.283 + 0.7), side: -2 * Math.sin(u * 6.283), flex: 1.5 * Math.sin(u * 12.566) },
    Spine2: { flex: 1.2 * Math.sin(u * 12.566 + 0.5), twist: 2 * Math.sin(u * 6.283 + 1.4) },
    Head: { side: 3 * Math.sin(u * 6.283 + 2), twist: 3 * Math.sin(u * 6.283 + 0.3) },
    R_UpperArm: { flex: 3 * Math.sin(u * 12.566 + 0.4), abduct: 2 * Math.sin(u * 6.283 + 1) }, L_UpperArm: { flex: 3 * Math.sin(u * 12.566 + 2.6), abduct: 2 * Math.sin(u * 6.283 + 3) },
    R_Forearm: { flex: 4 * Math.sin(u * 6.283 + 2) }, L_Forearm: { flex: 4 * Math.sin(u * 6.283 + 4.2) },
  });
  const LN = 16, lk = []; for (let i = 0; i <= LN; i++) lk.push({ t: (i / LN) * 2.8, pose: live(i / LN), ease: 'linear' });
  make({ name: 'k_live', duration: 2.8, loop: true, base: 'rest', keys: lk, grounded: false });
  // anticipation: the defender sets his weight, drops a little, lifts the hands toward the raider; played once and held, its layer weight follows the raider's distance
  make({ name: 'k_react', duration: 0.5, base: 'rest', grounded: false, keys: [{ t: 0, pose: { Pelvis: { pos: [0, 0, 0] } } }, { t: 0.5, pose: {
    Pelvis: { pos: [0, -0.04, 0.03] }, Spine1: { flex: 7 }, Spine2: { flex: 3 }, Neck: { flex: -4 }, R_Thigh: { flex: 6 }, L_Thigh: { flex: 8 }, R_Calf: { flex: 8 }, L_Calf: { flex: 10 },
    R_UpperArm: { flex: 14, abduct: 8 }, L_UpperArm: { flex: 20, abduct: 6 }, R_Forearm: { flex: -4 }, L_Forearm: { flex: -6 } }, ease: 'out' }] });
}
