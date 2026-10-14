// The throwers: real 3D people (view3d athlete rigs) doing a one-handed overhead axe throw, authored pose-to-pose with hand and foot IK.
// A real throw: square to the board, weight on the back foot, the axe lifted from the chest to behind the head (elbow high, the free arm
// pointing at the target for balance), a step onto the front foot as the hips open, the arm whips up and over, the wrist snaps at the release
// at head height, and the arm follows through toward the board with the trail foot coming up. The presenter scrubs ONE clip so the release
// meets the sim's launch: the wind-up follows the finger, the forward swing runs when the finger lets go.
export const T_COIL = 0.42;       // clip time of the full wind-up (axe behind the head)
export const T_REL = 0.64;        // clip time of the release (the swing from the wind-up takes RELEASE_DELAY seconds)
export const T_END = 1.9;         // end of the follow-through (back at the ready stance)
export const RELEASE_DELAY = 0.26;

const READY = {
  Pelvis: { twist: -4, pos: [0, -0.04, 0.0] }, Spine: { flex: 4, twist: -3 }, Spine1: { flex: 3 }, Spine2: { flex: 2 }, Neck: { flex: -4 }, Head: { flex: -2, twist: 3 },
  R_UpperArm: { flex: 28, abduct: 12 }, R_Forearm: { flex: 82 }, L_UpperArm: { flex: 30, abduct: 18 }, L_Forearm: { flex: 70 },
  L_Thigh: { flex: 12, abduct: 4 }, L_Calf: { flex: 14 }, R_Thigh: { flex: -4, abduct: 5 }, R_Calf: { flex: 8 },
};
const COIL = {
  Pelvis: { twist: -12, pos: [0, -0.07, -0.08] }, Spine: { flex: -6, twist: -10 }, Spine1: { flex: -6 }, Spine2: { flex: -5 }, Neck: { flex: -2 }, Head: { flex: 0, twist: 10 },
  R_UpperArm: { flex: 145, abduct: 24 }, R_Forearm: { flex: 105 }, L_UpperArm: { flex: 60, abduct: 38 }, L_Forearm: { flex: 20 },
  L_Thigh: { flex: 14, abduct: 4 }, L_Calf: { flex: 16 }, R_Thigh: { flex: 6, abduct: 5 }, R_Calf: { flex: 20 },
};
const REL = {
  Pelvis: { twist: 18, pos: [0, -0.16, 0.20] }, Spine: { flex: 22, twist: 14 }, Spine1: { flex: 14 }, Spine2: { flex: 8 }, Neck: { flex: -10 }, Head: { flex: -6, twist: -8 },
  R_UpperArm: { flex: 150, abduct: 8 }, R_Forearm: { flex: 22 }, L_UpperArm: { flex: -10, abduct: 52 }, L_Forearm: { flex: 24 },
  L_Thigh: { flex: 42, abduct: 4 }, L_Calf: { flex: 44 }, R_Thigh: { flex: -12, abduct: 5 }, R_Calf: { flex: 10 },
};
const FOL = {
  Pelvis: { twist: 24, pos: [0, -0.12, 0.26] }, Spine: { flex: 28, twist: 18 }, Spine1: { flex: 16 }, Spine2: { flex: 8 }, Neck: { flex: -12 }, Head: { flex: -8, twist: -12 },
  R_UpperArm: { flex: 85, abduct: 22 }, R_Forearm: { flex: 18 }, L_UpperArm: { flex: -24, abduct: 44 }, L_Forearm: { flex: 30 },
  L_Thigh: { flex: 44, abduct: 4 }, L_Calf: { flex: 46 }, R_Thigh: { flex: -4, abduct: 5 }, R_Calf: { flex: 26 },
};
const FOOT_L = [0.12, 0.065, 0.14], FOOT_R = [-0.14, 0.065, -0.14];

// C1 path through control points (cubic Hermite, finite-difference tangents, zero speed at rests), sampled at 60 Hz
function smoothPath(points, step = 1 / 60) {
  const n = points.length, tan = points.map((p, i) => {
    if (i === 0 || i === n - 1 || p.rest) return [0, 0, 0];
    const a = points[i - 1], b = points[i + 1], dt = b.t - a.t;
    return [0, 1, 2].map((k) => (b.pos[k] - a.pos[k]) / dt);
  });
  const out = [];
  for (let t = 0; t <= points[n - 1].t + 1e-6; t += step) {
    let i = 0; while (i < n - 2 && t > points[i + 1].t) i++;
    const a = points[i], b = points[i + 1], h = b.t - a.t, u = Math.min(1, Math.max(0, (t - a.t) / h));
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
    out.push({ t, pos: [0, 1, 2].map((k) => h00 * a.pos[k] + h10 * h * tan[i][k] + h01 * b.pos[k] + h11 * h * tan[i + 1][k]), ease: 'linear' });
  }
  return out;
}

export class Thrower {
  constructor(V3, h, name = 'throw') {
    this.V3 = V3; this.h = h;
    const { buildClip } = V3;
    const S = h.info && h.info.height ? h.info.height / 1.74 : 1;
    const sc = (arr) => arr.map((k) => ({ ...k, pos: k.pos.map((v) => v * S) }));
    const spec = (nm, extra) => ({ name: nm, base: { clip: 'idle_relaxed', time: 0 }, fingers: 'relaxed', fingerHands: { R: 'batGrip', L: 'relaxed' }, grounded: true, ...extra });
    const T1 = T_REL + 0.2, T2 = T_REL + 0.52;
    const throwSpec = (nm) => spec(nm, {
      fps: 60, duration: T_END, events: { release: T_REL, coil: T_COIL },
      keys: [
        { t: 0, pose: READY },
        { t: T_COIL, pose: COIL, ease: 'inOut' },
        { t: T_REL, pose: REL, ease: 'in' },
        { t: T1, pose: FOL, ease: 'out' },
        { t: T2, pose: FOL, ease: 'inOut' },
        { t: T_END, pose: READY, ease: 'inOut' },
      ],
      ik: {
        R_Foot: { keys: sc(smoothPath([{ t: 0, pos: FOOT_R }, { t: T_COIL, pos: [-0.14, 0.065, -0.2] }, { t: T_REL, pos: [-0.12, 0.065, -0.1] }, { t: T1, pos: [-0.12, 0.2, 0.06] }, { t: T2, pos: [-0.12, 0.12, 0.02] }, { t: T_END, pos: FOOT_R }])), pole: sc([{ t: 0, pos: [-0.25, 0.5, 0.9] }]) },
        L_Foot: { keys: sc(smoothPath([{ t: 0, pos: FOOT_L }, { t: T_COIL, pos: [0.12, 0.065, 0.12] }, { t: T_REL - 0.08, pos: [0.14, 0.12, 0.3] }, { t: T_REL, pos: [0.14, 0.065, 0.42] }, { t: T2, pos: [0.14, 0.065, 0.42] }, { t: T_END, pos: FOOT_L }])), pole: sc([{ t: 0, pos: [0.22, 0.5, 0.9] }]) },
        R_Hand: {
          keys: sc(smoothPath([
            { t: 0, pos: [-0.2, 1.2, 0.32] },
            { t: T_COIL * 0.5, pos: [-0.2, 1.56, 0.04] },
            { t: T_COIL, pos: [-0.1, 1.86, -0.24], rest: true },
            { t: T_COIL + 0.07, pos: [-0.12, 1.92, 0.06] },
            { t: T_REL - 0.04, pos: [-0.14, 1.86, 0.5] },
            { t: T_REL, pos: [-0.14, 1.78, 0.62] },
            { t: T_REL + 0.08, pos: [-0.1, 1.6, 0.72] },
            { t: T1, pos: [-0.04, 1.34, 0.7] },
            { t: T2, pos: [0.02, 1.22, 0.58] },
            { t: T_END, pos: [-0.2, 1.2, 0.32] },
          ])),
          pole: sc(smoothPath([{ t: 0, pos: [-0.9, 1.1, -0.1] }, { t: T_COIL, pos: [-0.9, 1.9, -0.7] }, { t: T_REL, pos: [-0.8, 1.5, 0.1] }, { t: T1, pos: [-0.55, 0.85, -0.1] }, { t: T_END, pos: [-0.9, 1.1, -0.1] }], 1 / 30)),
        },
        L_Hand: {
          keys: sc(smoothPath([
            { t: 0, pos: [0.0, 1.16, 0.34] },
            { t: T_COIL, pos: [0.32, 1.52, 0.52], rest: true },
            { t: T_REL, pos: [0.44, 1.3, 0.2] },
            { t: T1, pos: [0.42, 1.12, -0.05] },
            { t: T_END, pos: [0.0, 1.16, 0.34] },
          ])),
          pole: sc([{ t: 0, pos: [0.9, 1.0, 0.0] }, { t: T_END, pos: [0.9, 1.0, 0.0] }]),
        },
      },
    });
    this.clipName = (() => { const c = buildClip(h, throwSpec(name)); h.addClip(c); return c.name; })();
    h.play(this.clipName, { fade: 0, loop: false });
  }
}
