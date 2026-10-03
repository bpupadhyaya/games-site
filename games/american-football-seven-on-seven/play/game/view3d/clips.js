// Football clips, authored with buildClip on top of the shared base library (nothing in vendor3d is edited).
// Character space: +Z is the way the player faces, +X is his LEFT. Metres. Hands and feet that must meet something in the world (the ball, an opponent's
// body) are NOT keyed here: the presenter puts them there each frame with human.setReach, so the picture always agrees with the simulation.
import { buildClip, addThrowClips } from '../vendor3d/index.js';

export const CLIP_NAMES = [];

export function addFootballClips(human) {
  addThrowClips(human);
  const make = (spec) => { const c = buildClip(human, { group: 'football', ...spec }); human.addClip(c); if (!CLIP_NAMES.includes(spec.name)) CLIP_NAMES.push(spec.name); return c; };
  const loop = (name, dur, pose0, pose1, o = {}) => make({ name, duration: dur, loop: true, base: 'rest', fingers: 'relaxed', keys: [{ t: 0, pose: pose0 }, { t: dur / 2, pose: pose1, ease: 'inOut' }, { t: dur, pose: pose0, ease: 'inOut' }], ...o });

  // ---- stances ------------------------------------------------------------------------------------------------------------------------------------
  // lineman: a deep crouch, weight forward, one hand near the ground, the other on the knee, head up
  const lineA = (k = 0) => ({
    Pelvis: { pos: [0, -0.2 - 0.008 * k, 0.07], flex: 14 }, R_Thigh: { flex: 58 + 2 * k, abduct: 8 }, L_Thigh: { flex: 62 + 2 * k, abduct: 8 }, R_Calf: { flex: 74 }, L_Calf: { flex: 78 },
    Spine: { flex: 10 }, Spine1: { flex: 14 }, Spine2: { flex: 8 + k }, Neck: { flex: -34 }, Head: { flex: -6 },
    R_UpperArm: { flex: 52, abduct: 8 }, R_Forearm: { flex: 24 }, L_UpperArm: { flex: 22, abduct: 22 }, L_Forearm: { flex: 74 },
  });
  loop('ft_stance_line', 2.0, lineA(0), lineA(1));
  // two-point stance for defenders and linebackers: knees bent, one foot forward, hands apart and ready
  const defA = (k = 0) => ({
    Pelvis: { pos: [0, -0.12 - 0.006 * k, 0.03] }, R_Thigh: { flex: 30 + 2 * k, abduct: 6 }, L_Thigh: { flex: 12 + 2 * k, abduct: 6 }, R_Calf: { flex: 38 }, L_Calf: { flex: 28 },
    Spine: { flex: 6 }, Spine1: { flex: 8 }, Spine2: { flex: 4 }, Neck: { flex: -14 }, Head: { flex: -4 },
    R_UpperArm: { flex: 34, abduct: 30 }, R_Forearm: { flex: 52 }, L_UpperArm: { flex: 28, abduct: 34 }, L_Forearm: { flex: 58 }, R_Hand: { rot: [0, 0, -12] }, L_Hand: { rot: [0, 0, -12] },
  });
  loop('ft_stance_def', 1.7, defA(0), defA(1));
  // receiver: a slightly lower athletic stance, one foot back, weight on the front foot, hands loose
  const recA = (k = 0) => ({
    Pelvis: { pos: [0, -0.07 - 0.005 * k, 0.03] }, R_Thigh: { flex: 22, abduct: 5 }, L_Thigh: { flex: -6 + 2 * k, abduct: 5 }, R_Calf: { flex: 26 }, L_Calf: { flex: 22 },
    Spine: { flex: 5 }, Spine1: { flex: 8 }, Spine2: { flex: 3 }, Neck: { flex: -10 },
    R_UpperArm: { flex: 20, abduct: 16 }, R_Forearm: { flex: 46 }, L_UpperArm: { flex: 8, abduct: 20 }, L_Forearm: { flex: 52 },
  });
  loop('ft_stance_rec', 1.9, recA(0), recA(1));
  // quarterback in the shotgun: feet apart, knees soft, hands out in front waiting for the snap
  const qbA = (k = 0) => ({
    Pelvis: { pos: [0, -0.09 - 0.005 * k, 0.02] }, R_Thigh: { flex: 22, abduct: 9 }, L_Thigh: { flex: 22, abduct: 9 }, R_Calf: { flex: 30 }, L_Calf: { flex: 30 },
    Spine: { flex: 6 }, Spine1: { flex: 8 }, Spine2: { flex: 4 }, Neck: { flex: -12 },
    R_UpperArm: { flex: 34, abduct: 10 }, R_Forearm: { flex: 38 }, L_UpperArm: { flex: 34, abduct: 10 }, L_Forearm: { flex: 38 },
  });
  loop('ft_stance_qb', 1.8, qbA(0), qbA(1), { fingers: 'open' });
  // centre over the ball: deep bend, back flat, both hands down on the ball
  const cA = (k = 0) => ({
    Pelvis: { pos: [0, -0.22, 0.12], flex: 18 }, R_Thigh: { flex: 66, abduct: 12 }, L_Thigh: { flex: 66, abduct: 12 }, R_Calf: { flex: 76 }, L_Calf: { flex: 76 },
    Spine: { flex: 12 }, Spine1: { flex: 14 + k }, Spine2: { flex: 10 }, Neck: { flex: -40 }, Head: { flex: -8 },
    R_UpperArm: { flex: 64, abduct: 6 }, R_Forearm: { flex: 12 }, L_UpperArm: { flex: 64, abduct: 6 }, L_Forearm: { flex: 12 },
  });
  loop('ft_stance_c', 2.0, cA(0), cA(1));
  // tackled and getting up use the base library clips (fall, getup); a lying idle for the pile-up
  // backpedal: short, quick steps backwards with the chest forward and the knees bent (the player faces the quarterback while he drops)
  const bp = (ph) => {
    const s = Math.sin(ph * Math.PI * 2), c = Math.cos(ph * Math.PI * 2);
    return {
      Pelvis: { pos: [0, -0.12 + 0.015 * Math.abs(c), -0.01] }, R_Thigh: { flex: 18 + 22 * s }, L_Thigh: { flex: 18 - 22 * s }, R_Calf: { flex: 46 + 30 * Math.max(0, -s) }, L_Calf: { flex: 46 + 30 * Math.max(0, s) },
      Spine: { flex: 5 }, Spine1: { flex: 8 }, Spine2: { flex: 4 }, Neck: { flex: -8 }, R_UpperArm: { flex: 26 - 18 * s, abduct: 22 }, L_UpperArm: { flex: 26 + 18 * s, abduct: 22 }, R_Forearm: { flex: 72 }, L_Forearm: { flex: 72 },
    };
  };
  { const N = 8, dur = 0.64, keys = []; for (let i = 0; i <= N; i++) keys.push({ t: (i / N) * dur, pose: bp(i / N), ease: 'linear' }); make({ name: 'ft_backpedal', duration: dur, loop: true, base: 'rest', keys, fingers: 'relaxed', speed: 2.4, events: { footL: 0.16, footR: 0.48 } }); }

  // ---- blocking and rushing: two bodies leaning into each other; the hands are placed on the other chest by the presenter ----------------------------
  const blk = (k) => ({
    Pelvis: { pos: [0, -0.15 + 0.004 * k, 0.1 + 0.02 * k] }, R_Thigh: { flex: 42 + 3 * k, abduct: 7 }, L_Thigh: { flex: 34 - 3 * k, abduct: 7 }, R_Calf: { flex: 56 }, L_Calf: { flex: 50 },
    Spine: { flex: 8 }, Spine1: { flex: 12 + 2 * k }, Spine2: { flex: 7 }, Neck: { flex: -22 },
    R_UpperArm: { flex: 66, abduct: 8 }, R_Forearm: { flex: 58 }, L_UpperArm: { flex: 66, abduct: 8 }, L_Forearm: { flex: 58 },
  });
  loop('ft_block', 0.9, blk(0), blk(1), { fingers: 'open' });
  const rush = (k) => ({
    Pelvis: { pos: [0, -0.13 + 0.004 * k, 0.1 + 0.025 * k] }, R_Thigh: { flex: 36 + 3 * k, abduct: 8 }, L_Thigh: { flex: 26 - 3 * k, abduct: 8 }, R_Calf: { flex: 50 }, L_Calf: { flex: 44 },
    Spine: { flex: 6 }, Spine1: { flex: 10 + 2 * k }, Spine2: { flex: 6 }, Neck: { flex: -18 },
    R_UpperArm: { flex: 80, abduct: 12 }, R_Forearm: { flex: 36 }, L_UpperArm: { flex: 80, abduct: 12 }, L_Forearm: { flex: 36 },
  });
  loop('ft_rush', 0.8, rush(0), rush(1), { fingers: 'open' });

  // ---- hands up and ready for a pass: the receiver's reach, played over the run as an additive layer ---------------------------------------------------
  make({ name: 'ft_lean_l', duration: 0.5, base: 'rest', grounded: false, keys: [{ t: 0, pose: {} }, { t: 0.5, pose: { Pelvis: { side: 8, pos: [0.03, -0.04, 0] }, Spine1: { side: 12 }, Spine2: { side: 6 }, Neck: { side: -8 } }, ease: 'out' }] });
  make({ name: 'ft_lean_r', duration: 0.5, base: 'rest', grounded: false, keys: [{ t: 0, pose: {} }, { t: 0.5, pose: { Pelvis: { side: -8, pos: [-0.03, -0.04, 0] }, Spine1: { side: -12 }, Spine2: { side: -6 }, Neck: { side: 8 } }, ease: 'out' }] });
  // a stumble after a missed tackle: the body pitches forward and recovers
  make({
    name: 'ft_stumble', duration: 0.9, base: 'jog_slow', fingers: 'open',
    keys: [{ t: 0, pose: {} }, { t: 0.25, pose: { Spine1: { flex: 22 }, Spine2: { flex: 10 }, Neck: { flex: -14 }, R_UpperArm: { flex: 40, abduct: 40 }, L_UpperArm: { flex: 40, abduct: 40 }, Pelvis: { pos: [0, -0.1, 0.08] } }, ease: 'out' }, { t: 0.9, pose: {}, ease: 'inOut' }],
  });
  // the dive for a tackle that misses: arms out, body low (the presenter rotates the whole body about the pelvis)
  make({ name: 'ft_dive', duration: 0.5, base: 'rest', fingers: 'open', grounded: false, keys: [{ t: 0, pose: {} }, { t: 0.25, pose: { Spine1: { flex: 14 }, R_UpperArm: { flex: 150, abduct: 12 }, L_UpperArm: { flex: 150, abduct: 12 }, R_Thigh: { flex: -10 }, L_Thigh: { flex: -16 } }, ease: 'out' }] });
  // a tackled player lying after the whistle: face down, arms by the head, a slow breath
  const lie = (k) => ({ Pelvis: { pos: [0, 0, 0] }, Spine1: { flex: 6 + k }, Neck: { flex: 14 }, R_UpperArm: { flex: 125, abduct: 20 }, L_UpperArm: { flex: 125, abduct: 20 }, R_Forearm: { flex: 70 }, L_Forearm: { flex: 70 } });
  loop('ft_lie', 3.0, lie(0), lie(2), { grounded: false });
  // a short additive breath / weight-shift for every idle player
  const live = (u) => ({
    Pelvis: { pos: [0.035 * Math.sin(u * 6.283), 0.012 * Math.abs(Math.sin(u * 12.566)) - 0.005, 0.005 * Math.sin(u * 6.283 + 1)], side: 2.2 * Math.sin(u * 6.283) },
    Spine1: { twist: 4 * Math.sin(u * 6.283 + 0.7), side: -1.6 * Math.sin(u * 6.283), flex: 1.4 * Math.sin(u * 12.566) }, Spine2: { flex: 1.1 * Math.sin(u * 12.566 + 0.5), twist: 1.8 * Math.sin(u * 6.283 + 1.4) },
    Head: { side: 2.4 * Math.sin(u * 6.283 + 2), twist: 2.6 * Math.sin(u * 6.283 + 0.3) },
    R_UpperArm: { flex: 2.6 * Math.sin(u * 12.566 + 0.4), abduct: 1.8 * Math.sin(u * 6.283 + 1) }, L_UpperArm: { flex: 2.6 * Math.sin(u * 12.566 + 2.6), abduct: 1.8 * Math.sin(u * 6.283 + 3) },
    R_Forearm: { flex: 3.4 * Math.sin(u * 6.283 + 2) }, L_Forearm: { flex: 3.4 * Math.sin(u * 6.283 + 4.2) },
  });
  { const LN = 16, lk = []; for (let i = 0; i <= LN; i++) lk.push({ t: (i / LN) * 2.8, pose: live(i / LN), ease: 'linear' }); make({ name: 'ft_live', duration: 2.8, loop: true, base: 'rest', keys: lk, grounded: false }); }
}
