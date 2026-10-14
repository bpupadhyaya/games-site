// The thrower: a real 3D person (view3d athlete rig) in a lakeside crouch, authored with the pose-to-pose keyframer + hand IK.
// A skip throw, as skimmers actually do it: crouch low beside the water, stone pinched between thumb and a curled forefinger, coil
// back from the hips, drop the throwing arm low and sweep it flat, flick the wrist at the release so the stone spins, follow
// through across the body, the free arm out for balance. The presenter scrubs the clip so the release meets the sim's launch.
const R = (a, b) => [a, b];
export const T_COIL = 0.42;         // clip time of the full coil (the pull gauge scrubs 0 .. T_COIL)
export const T_REL = 0.64;          // clip time of the release (the sweep from the coil takes the sim's WINDUP seconds)
export const T_END = 1.95;          // end of the follow-through (back at the ready crouch)

const READY = {
  Pelvis: { twist: -6, pos: [0, -0.46, 0.0] }, Spine: { flex: 26, twist: -4 }, Spine1: { flex: 12 }, Spine2: { flex: 4 }, Neck: { flex: -14 }, Head: { flex: -8, twist: 6 },
  R_UpperArm: { flex: 8, abduct: 14 }, R_Forearm: { flex: 26 }, L_UpperArm: { flex: 22, abduct: 26 }, L_Forearm: { flex: 34 },
  L_Thigh: { flex: 54, abduct: 7 }, L_Calf: { flex: 78 }, R_Thigh: { flex: 30, abduct: 10 }, R_Calf: { flex: 58 },
};
const COIL = {
  Pelvis: { twist: -34, pos: [0, -0.50, -0.03] }, Spine: { flex: 30, twist: -26 }, Spine1: { flex: 12 }, Spine2: { flex: 4 }, Neck: { flex: -18 }, Head: { flex: -8, twist: 22 },
  R_UpperArm: { flex: -30, abduct: 40 }, R_Forearm: { flex: 22 }, L_UpperArm: { flex: 50, abduct: 30 }, L_Forearm: { flex: 24 },
  L_Thigh: { flex: 48, abduct: 7 }, L_Calf: { flex: 68 }, R_Thigh: { flex: 24, abduct: 10 }, R_Calf: { flex: 48 },
};
const REL = {
  Pelvis: { twist: 12, pos: [0, -0.58, 0.10] }, Spine: { flex: 38, twist: 10 }, Spine1: { flex: 18 }, Spine2: { flex: 8 }, Neck: { flex: -22 }, Head: { flex: -10, twist: -6 },
  R_UpperArm: { flex: 38, abduct: 52 }, R_Forearm: { flex: 6 }, L_UpperArm: { flex: -12, abduct: 52 }, L_Forearm: { flex: 20 },
  L_Thigh: { flex: 56, abduct: 6 }, L_Calf: { flex: 82 }, R_Thigh: { flex: 18, abduct: 10 }, R_Calf: { flex: 54 },
};
const FOL = {
  Pelvis: { twist: 36, pos: [0, -0.42, 0.08] }, Spine: { flex: 26, twist: 28 }, Spine1: { flex: 10 }, Spine2: { flex: 4 }, Neck: { flex: -14 }, Head: { flex: -6, twist: -22 },
  R_UpperArm: { flex: 60, abduct: 20 }, R_Forearm: { flex: 24 }, L_UpperArm: { flex: -34, abduct: 40 }, L_Forearm: { flex: 30 },
  L_Thigh: { flex: 44, abduct: 6 }, L_Calf: { flex: 62 }, R_Thigh: { flex: 22, abduct: 10 }, R_Calf: { flex: 42 },
};
const FOOT_R = [-0.24, 0.065, -0.12], FOOT_L = [0.19, 0.065, 0.04];   // planted ankles (character space, metres)
// A C1 path through control points (cubic Hermite, finite-difference tangents, zero speed at the ends and where `rest` is set), sampled
// at 60 Hz so the IK target has continuous velocity (no ease-type kinks at the key times).
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
const ARM = (S) => (arr) => arr.map((k) => ({ ...k, pos: k.pos.map((v) => v * S) }));

export class Thrower {
  constructor(V3, h) {
    this.V3 = V3; this.h = h;
    const { buildClip } = V3;
    const S = h.info && h.info.height ? h.info.height / 1.74 : 1;
    const sc = ARM(S);
    const spec = (name, extra) => ({
      name, base: { clip: 'idle_relaxed', time: 0 }, fingers: 'relaxed', fingerHands: { R: 'pinch', L: 'relaxed' }, grounded: true, ...extra,
    });
    const throwSpec = (name) => spec(name, {
      fps: 60, duration: T_END, events: { release: T_REL, coil: T_COIL },
      keys: [
        { t: 0, pose: READY },
        { t: T_COIL, pose: COIL, ease: 'inOut' },
        { t: T_REL, pose: REL, ease: 'in' },
        { t: T_REL + 0.30, pose: FOL, ease: 'out' },
        { t: T_END, pose: READY, ease: 'inOut' },
      ],
      ik: {
        R_Foot: { keys: sc([{ t: 0, pos: FOOT_R }]), pole: sc([{ t: 0, pos: [-0.25, 0.5, 0.9] }]) },
        L_Foot: { keys: sc([{ t: 0, pos: FOOT_L }]), pole: sc([{ t: 0, pos: [0.22, 0.5, 0.9] }]) },
        R_Hand: {
          keys: sc(smoothPath([
            { t: 0, pos: [-0.30, 0.64, 0.26] },
            { t: T_COIL * 0.5, pos: [-0.46, 0.76, -0.14] },
            { t: T_COIL, pos: [-0.70, 0.84, -0.52], rest: true },
            { t: T_COIL + 0.09, pos: [-0.74, 0.60, -0.30] },
            { t: T_REL - 0.05, pos: [-0.62, 0.40, 0.30] },
            { t: T_REL, pos: [-0.46, 0.34, 0.66] },
            { t: T_REL + 0.09, pos: [-0.20, 0.46, 0.84] },
            { t: T_REL + 0.28, pos: [0.14, 0.78, 0.66] },
            { t: T_REL + 0.62, pos: [-0.10, 0.84, 0.36] },
            { t: T_END, pos: [-0.30, 0.64, 0.26] },
          ])),
          pole: sc(smoothPath([{ t: 0, pos: [-0.9, 0.5, 0.0] }, { t: T_COIL, pos: [-1.1, 0.9, -0.5] }, { t: T_REL, pos: [-0.9, 0.5, 0.2] }, { t: T_REL + 0.4, pos: [-0.9, 0.7, 0.3] }, { t: T_END, pos: [-0.9, 0.5, 0.0] }], 1 / 30)),
        },
        L_Hand: {
          keys: sc(smoothPath([
            { t: 0, pos: [0.30, 0.74, 0.24] },
            { t: T_COIL, pos: [0.50, 0.98, 0.42], rest: true },
            { t: T_REL, pos: [0.62, 0.86, 0.12] },
            { t: T_REL + 0.30, pos: [0.50, 0.78, -0.18] },
            { t: T_END, pos: [0.30, 0.74, 0.24] },
          ])),
          pole: sc([{ t: 0, pos: [0.9, 0.5, 0.0] }, { t: T_END, pos: [0.9, 0.5, 0.0] }]),
        },
      },
    });
    this.clipNames = ['skipA', 'skipB'].map((n) => { const c = buildClip(h, throwSpec(n)); h.addClip(c); return c.name; });
    const idle = buildClip(h, spec('skipIdle', {
      base: 'idle_relaxed', inherit: true, loop: true, keys: [{ t: 0, pose: READY }],
      ik: {
        R_Hand: [{ t: 0, pos: sc([{ pos: [-0.30, 0.64, 0.26] }])[0].pos }], L_Hand: [{ t: 0, pos: sc([{ pos: [0.30, 0.74, 0.24] }])[0].pos }],
        R_Foot: { keys: sc([{ t: 0, pos: FOOT_R }]), pole: sc([{ t: 0, pos: [-0.25, 0.5, 0.9] }]) }, L_Foot: { keys: sc([{ t: 0, pos: FOOT_L }]), pole: sc([{ t: 0, pos: [0.22, 0.5, 0.9] }]) },
      },
    }));
    h.addClip(idle);
    h.play('skipA', { fade: 0, loop: false });
    this.mode = 'idle'; this.which = 0;
  }
}
