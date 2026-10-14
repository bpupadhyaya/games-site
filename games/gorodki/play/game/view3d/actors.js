// The thrower: a real 3D person (view3d athlete rig) in winter clothes, with the throwing arm wound back and released exactly when the
// simulation launches the bat. Poses are authored with view3d's pose-to-pose keyframer (semantic bone offsets: flex / abduct / twist,
// degrees, character space: +Z forward, +X the avatar's left). Nothing here writes back to the game.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;

// ready -> wound back (peak) -> release -> follow-through, per style: 0 lob (drive), 1 skim (sweep), 2 whirl (smash)
const READY = {
  Pelvis: { twist: -4, pos: [0, 0, 0] }, Spine: { flex: 3, twist: -3 }, Spine1: { flex: 2 }, Neck: { flex: -2 }, Head: { twist: 0 },
  R_UpperArm: { flex: 8, abduct: 6 }, R_Forearm: { flex: 24 }, L_UpperArm: { flex: 12, abduct: 8 }, L_Forearm: { flex: 20 },
  L_Thigh: { flex: 10, abduct: 3 }, L_Calf: { flex: 8 }, R_Thigh: { flex: -4 }, R_Calf: { flex: 6 },
};
const STYLE = [
  { // Drive: a full underarm swing that finishes high
    wind: { Pelvis: { twist: -10, pos: [0, -0.05, 0] }, Spine: { flex: 8, twist: -12 }, Spine1: { flex: 4, twist: -6 }, Neck: { flex: -4 },
      R_UpperArm: { flex: -84, abduct: 8 }, R_Forearm: { flex: 28 }, L_UpperArm: { flex: 60, abduct: 22 }, L_Forearm: { flex: 22 },
      L_Thigh: { flex: 22, abduct: 4 }, L_Calf: { flex: 12 }, R_Thigh: { flex: -6 }, R_Calf: { flex: 10 } },
    rel: { Pelvis: { twist: 8, pos: [0, -0.07, 0] }, Spine: { flex: 12, twist: 10 }, Spine1: { flex: 6, twist: 5 }, Neck: { flex: -6 },
      R_UpperArm: { flex: 104, abduct: 4 }, R_Forearm: { flex: 8 }, L_UpperArm: { flex: -26, abduct: 20 }, L_Forearm: { flex: 24 },
      L_Thigh: { flex: 38, abduct: 4 }, L_Calf: { flex: 34 }, R_Thigh: { flex: -6 }, R_Calf: { flex: 10 } },
    fol: { Pelvis: { twist: 14, pos: [0, -0.05, 0] }, Spine: { flex: 18, twist: 16 }, Spine1: { flex: 8, twist: 8 }, Neck: { flex: -8 },
      R_UpperArm: { flex: 150, abduct: 10 }, R_Forearm: { flex: 4 }, L_UpperArm: { flex: -10, abduct: 30 }, L_Forearm: { flex: 20 },
      L_Thigh: { flex: 30 }, L_Calf: { flex: 26 }, R_Thigh: { flex: -6 }, R_Calf: { flex: 10 } },
  },
  { // Sweep: crouch low, a long low swing, the bat leaves at hip height
    wind: { Pelvis: { twist: -8, pos: [0, -0.16, 0] }, Spine: { flex: 24, twist: -9 }, Spine1: { flex: 12, twist: -4 }, Neck: { flex: -14 },
      R_UpperArm: { flex: -76, abduct: 6 }, R_Forearm: { flex: 14 }, L_UpperArm: { flex: 40, abduct: 36 }, L_Forearm: { flex: 20 },
      L_Thigh: { flex: 46, abduct: 5 }, L_Calf: { flex: 50 }, R_Thigh: { flex: 6 }, R_Calf: { flex: 10 } },
    rel: { Pelvis: { twist: 6, pos: [0, -0.2, 0] }, Spine: { flex: 32, twist: 8 }, Spine1: { flex: 14, twist: 4 }, Neck: { flex: -20 },
      R_UpperArm: { flex: 60, abduct: 3 }, R_Forearm: { flex: 6 }, L_UpperArm: { flex: -20, abduct: 40 }, L_Forearm: { flex: 20 },
      L_Thigh: { flex: 58 }, L_Calf: { flex: 64 }, R_Thigh: { flex: -6 }, R_Calf: { flex: 10 } },
    fol: { Pelvis: { twist: 12, pos: [0, -0.18, 0] }, Spine: { flex: 34, twist: 14 }, Spine1: { flex: 16, twist: 6 }, Neck: { flex: -22 },
      R_UpperArm: { flex: 88, abduct: 8 }, R_Forearm: { flex: 4 }, L_UpperArm: { flex: -14, abduct: 44 }, L_Forearm: { flex: 20 },
      L_Thigh: { flex: 54 }, L_Calf: { flex: 58 }, R_Thigh: { flex: -6 }, R_Calf: { flex: 10 } },
  },
  { // Smash: arm raised out and back, a hard flat sweep with a wrist snap
    wind: { Pelvis: { twist: -16, pos: [0, -0.07, 0] }, Spine: { flex: 5, twist: -20 }, Spine1: { flex: 3, twist: -10 }, Neck: { flex: -3 },
      R_UpperArm: { flex: -34, abduct: 72 }, R_Forearm: { flex: 74 }, L_UpperArm: { flex: 56, abduct: 40 }, L_Forearm: { flex: 20 },
      L_Thigh: { flex: 24, abduct: 4 }, L_Calf: { flex: 14 }, R_Thigh: { flex: -6 }, R_Calf: { flex: 10 } },
    rel: { Pelvis: { twist: 14, pos: [0, -0.07, 0] }, Spine: { flex: 10, twist: 18 }, Spine1: { flex: 5, twist: 9 }, Neck: { flex: -5 },
      R_UpperArm: { flex: 84, abduct: 40 }, R_Forearm: { flex: 6 }, L_UpperArm: { flex: -30, abduct: 22 }, L_Forearm: { flex: 26 },
      L_Thigh: { flex: 40 }, L_Calf: { flex: 34 }, R_Thigh: { flex: -6 }, R_Calf: { flex: 10 } },
    fol: { Pelvis: { twist: 24, pos: [0, -0.05, 0] }, Spine: { flex: 16, twist: 28 }, Spine1: { flex: 8, twist: 14 }, Neck: { flex: -8 },
      R_UpperArm: { flex: 60, abduct: 76 }, R_Forearm: { flex: 22 }, L_UpperArm: { flex: -16, abduct: 30 }, L_Forearm: { flex: 24 },
      L_Thigh: { flex: 30 }, L_Calf: { flex: 26 }, R_Thigh: { flex: -6 }, R_Calf: { flex: 10 } },
  },
];
export const STYLE_INDEX = { drive: 0, sweep: 1, smash: 2 };
export const WIND_DUR = 0.55;           // the sim's WIND_T (seconds from Throw to release)
export const FOLLOW_DUR = 1.1;         // release -> back to the ready stance

export class Thrower {
  constructor(V3, h, bat) {
    this.V3 = V3; this.h = h; this.bat = bat;
    this.holding = false; this.mode = 'idle'; this.key = ''; this.lookKey = '';
    const { buildClip } = V3;
    this.buildClip = buildClip;
    // one throw clip per style: ready -> wind-back (0..WIND_DUR*0.62) -> hold -> release at WIND_DUR -> follow-through -> ready.
    // The clip is scrubbed by the presenter (time = seconds since the throw began), so it always meets the sim's release.
    this.throwClips = STYLE.map((s, i) => {
      const c = buildClip(h, {
        name: `gthrow${i}`, duration: WIND_DUR + FOLLOW_DUR, base: 'idle_relaxed', fingers: 'relaxed', events: { release: WIND_DUR },
        keys: [
          { t: 0, pose: READY },
          { t: WIND_DUR * 0.58, pose: s.wind, ease: 'inOut' },
          { t: WIND_DUR, pose: s.rel, ease: 'inOut' },
          { t: WIND_DUR + 0.38, pose: s.fol, ease: 'inOut' },
          { t: WIND_DUR + FOLLOW_DUR, pose: READY, ease: 'inOut' },
        ],
      });
      h.addClip(c);
      return c.name;
    });
    // the aiming stance: a slow breathing weight shift is the idle clip itself
    h.play('idle_relaxed', { fade: 0 });
  }
  setHolding(on) {
    if (on === this.holding) return;
    this.holding = on;
    if (on) { this.h.attach(this.bat, 'R', 'bat', { slide: 0.07 }); this.bat.visible = true; }
    else { this.h.detach(this.bat); this.bat.visible = false; }
  }
}
