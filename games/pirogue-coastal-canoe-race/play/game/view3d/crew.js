// A paddler: a lifelike Rocketbox figure sitting on the thwart facing the bow. The torso folds and twists through the stroke (authored
// clip scrubbed by the sim's stroke clock), the arms are solved onto the paddle's two grips each frame (IK), the legs sit braced in
// the hull. Character space: +Y up, +Z forward (toward the bow), +X = the paddler's LEFT.
const D = 1.7;   // clip length in "stroke units": 0..1 drive, 1..1.7 recovery (the same clock the 2D art uses: tSince / 0.34)

export async function loadPaddler(V3, { character = 'athlete_m', skin = 'brown', hair = 'black', top = '#f0a81c', bottoms = '#1d3552', lod = 0 } = {}) {
  const { loadHuman, buildClip } = V3;
  const h = await loadHuman({ character, kit: { top, bottoms, socks: '#e9eef2' }, skin, hair, lod });
  h.groundClamp = 'off'; h.footPlanting = false;
  const clips = {};
  // seated base: hips on the thwart, thighs forward, knees up, feet braced on the hull floor; arms are IK driven so the clip only carries a soft guess
  const seat = { Pelvis: { pos: [0, -0.5, -0.02] }, L_Thigh: { flex: 68, abduct: 8 }, R_Thigh: { flex: 68, abduct: 8 }, L_Calf: { flex: 78 }, R_Calf: { flex: 78 } };
  const arms = (f) => ({ L_UpperArm: { flex: f, abduct: 14 }, R_UpperArm: { flex: f, abduct: 14 }, L_Forearm: { flex: 60 }, R_Forearm: { flex: 60 } });
  // paddling on the right (+1): catch = reach forward and out to the right, finish = upright and slightly back with the blade at the hip
  for (const side of [1, -1]) {
    const tw = (v) => -side * v;            // + twist = to the paddler's left; paddling right means turning right (negative)
    const catchP = { ...seat, ...arms(50), Pelvis: { pos: [0, -0.5, -0.02], twist: tw(8), flex: 6 }, Spine: { flex: 8, twist: tw(10) }, Spine1: { flex: 8, twist: tw(10) }, Spine2: { flex: 6, twist: tw(8) }, Neck: { flex: -14 }, Head: { flex: -6 } };
    const midP = { ...seat, ...arms(30), Pelvis: { pos: [0, -0.5, -0.02], twist: tw(-3), flex: 0 }, Spine: { flex: -2, twist: tw(-4) }, Spine1: { flex: -1, twist: tw(-4) }, Spine2: { flex: 0, twist: tw(-4) }, Neck: { flex: -2 }, Head: { flex: 0 } };
    const finP = { ...seat, ...arms(18), Pelvis: { pos: [0, -0.5, -0.04], twist: tw(-6), flex: -4 }, Spine: { flex: -4, twist: tw(-8) }, Spine1: { flex: -3, twist: tw(-8) }, Spine2: { flex: -2, twist: tw(-6) }, Neck: { flex: 4 }, Head: { flex: 2 } };
    const c = buildClip(h, {
      name: `pg_stroke_${side > 0 ? 'R' : 'L'}`, duration: D, base: 'idle', smoothTrunk: false, fingers: 'fist',
      keys: [
        { t: 0, pose: catchP },
        { t: 0.34, ease: 'inOut', pose: midP },
        { t: 1.0, ease: 'out', pose: finP },
        { t: 1.35, ease: 'inOut', pose: midP },
        { t: D, ease: 'inOut', pose: catchP },
      ],
    });
    h.addClip(c); clips[side] = c;
  }
  return { h, clips, D };
}
export { D as STROKE_LEN };
