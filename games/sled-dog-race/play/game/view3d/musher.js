// The musher: a real 3D person (view3d athlete) in a parka and cap, standing on the runner tails with both hands on the handlebar.
// Clips are authored with buildClip + IK (feet on the plank, hands on the bar, knees always forward): ride, pedal (a kick off the snow
// with the right foot, looped), brake (deeper stance, weight back), wave (finish). The presenter crossfades between them (0.25 s).
import { loadHuman, buildClip } from '../vendor3d/index.js';

const AY = 0.10;     // ankle height of a flat foot
const BAR = [0.22, 0.97, 0.42];   // handlebar in character space (x = avatar's left), relative to the plank top

export async function loadMusher(V3, { quality = 'high', top = '#c8402a', trim = '#f2e6d0' } = {}) {
  const h = await loadHuman({ character: 'athlete_m', kit: { top, bottoms: '#27303f', socks: '#e8e4da', shoes: '#2b2118', trim }, skin: 'light', hair: 'brown', top: 'long' });
  h.lodAuto = false;   // full detail always: the musher is close to the camera
  h.groundClamp = 'off'; h.footPlanting = false;
  const body = ({ lean, hip, y = -0.06, z = 0, neck = -10, twist = 0, side = 0 }) => ({
    Pelvis: { pos: [0, y, z], flex: hip, twist: twist * 0.3, side },
    Spine: { flex: (lean - hip) / 3, twist: twist * 0.3, side: side * 0.3 }, Spine1: { flex: (lean - hip) / 3, twist: twist * 0.4 }, Spine2: { flex: (lean - hip) / 3, twist: twist * 0.3 },
    Neck: { flex: neck }, Head: { flex: -6 },
  });
  const legs = (t, c, ab = 6) => ({ L_Thigh: { flex: t, abduct: ab }, R_Thigh: { flex: t, abduct: ab }, L_Calf: { flex: c }, R_Calf: { flex: c } });
  const arms = (f = 38, ab = 8, el = 30) => ({ L_UpperArm: { flex: f, abduct: ab }, R_UpperArm: { flex: f, abduct: ab }, L_Forearm: { flex: el }, R_Forearm: { flex: el } });
  const K = (t, pose, ease = 'inOut') => ({ t, pose, ease });
  const kneePole = (x, t) => ({ t, pos: [x, 0.5, 1.4] });
  const elbPole = (x, t) => ({ t, pos: [x * 2.4, 0.9, -0.1] });
  const handKeys = (x, kk) => kk.map((k) => ({ ...k, pos: k.pos || [x, BAR[1], BAR[2]] }));
  const lf = (kk) => ({ keys: kk, pole: [kneePole(0.28, 0), kneePole(0.28, 1)] });
  const rf = (kk) => ({ keys: kk, pole: [kneePole(-0.28, 0), kneePole(-0.28, 1)] });
  const barHands = (dur) => ({
    L_Hand: { keys: [{ t: 0, pos: [BAR[0], BAR[1], BAR[2]] }, { t: dur, pos: [BAR[0], BAR[1], BAR[2]] }], pole: [elbPole(0.22, 0), elbPole(0.22, dur)] },
    R_Hand: { keys: [{ t: 0, pos: [-BAR[0], BAR[1], BAR[2]] }, { t: dur, pos: [-BAR[0], BAR[1], BAR[2]] }], pole: [elbPole(-0.22, 0), elbPole(-0.22, dur)] },
  });
  void handKeys;
  // ride: relaxed crouch on the plank, small sway
  const rideA = { ...body({ lean: 16, hip: 14 }), ...legs(20, 32), ...arms() };
  const rideB = { ...body({ lean: 18, hip: 16, y: -0.075, side: 1.5 }), ...legs(23, 36), ...arms() };
  h.addClip(buildClip(h, {
    name: 'm_ride', duration: 2.0, loop: true, base: 'rest', fingers: 'relaxed',
    keys: [K(0, rideA), K(1.0, rideB), K(2.0, rideA)],
    ik: { L_Foot: lf([{ t: 0, pos: [0.15, AY, 0.04] }, { t: 2, pos: [0.15, AY, 0.04] }]), R_Foot: rf([{ t: 0, pos: [-0.15, AY, -0.14] }, { t: 2, pos: [-0.15, AY, -0.14] }]), ...barHands(2.0) },
  }));
  // pedal: the right foot reaches ahead to the snow, plants, and pushes back hard; the body dips and leans into the push
  const D = 1.0;
  const pA = { ...body({ lean: 20, hip: 18, y: -0.07 }), ...legs(22, 38), ...arms() };
  const pB = { ...body({ lean: 28, hip: 24, y: -0.13, z: 0.04, twist: -6 }), ...legs(30, 50), ...arms(42, 8, 34) };
  const pC = { ...body({ lean: 34, hip: 28, y: -0.15, z: 0.06, twist: 8 }), ...legs(32, 56), ...arms(46, 8, 38) };
  h.addClip(buildClip(h, {
    name: 'm_pedal', duration: D, loop: true, base: 'rest', fingers: 'relaxed',
    keys: [K(0, pA), K(0.3, pB), K(0.7, pC), K(1.0, pA)],
    ik: {
      L_Foot: lf([{ t: 0, pos: [0.15, AY, 0.04] }, { t: 1, pos: [0.15, AY, 0.04] }]),
      R_Foot: rf([
        { t: 0.0, pos: [-0.15, AY, -0.14] }, { t: 0.18, pos: [-0.17, AY + 0.2, 0.2], ease: 'out' }, { t: 0.32, pos: [-0.2, AY - 0.1, 0.46], ease: 'in' },
        { t: 0.7, pos: [-0.2, AY - 0.1, -0.5], ease: 'linear' }, { t: 0.86, pos: [-0.17, AY + 0.12, -0.36], ease: 'out' }, { t: 1.0, pos: [-0.15, AY, -0.14], ease: 'inOut' },
      ]),
      ...barHands(D),
    },
  }));
  // brake: weight back, deeper knees, the brake foot pressing down behind
  const brk = { ...body({ lean: 4, hip: 18, y: -0.12, z: -0.05, neck: -4 }), ...legs(30, 52), ...arms(34, 8, 36) };
  h.addClip(buildClip(h, {
    name: 'm_brake', duration: 1.0, loop: true, base: 'rest', fingers: 'relaxed',
    keys: [K(0, brk), K(1, brk)],
    ik: { L_Foot: lf([{ t: 0, pos: [0.16, AY, 0.0] }, { t: 1, pos: [0.16, AY, 0.0] }]), R_Foot: rf([{ t: 0, pos: [-0.16, AY + 0.02, -0.3] }, { t: 1, pos: [-0.16, AY + 0.02, -0.3] }]), ...barHands(1) },
  }));
  // wave: right arm up, a relaxed lean, left hand stays on the bar
  const wv = (s) => ({ ...body({ lean: 6, hip: 8, y: -0.03, neck: -2 }), ...legs(10, 16), L_UpperArm: { flex: 38, abduct: 8 }, L_Forearm: { flex: 30 }, R_UpperArm: { flex: 150, abduct: 20 + s }, R_Forearm: { flex: 20 + s * 0.8 } });
  h.addClip(buildClip(h, {
    name: 'm_wave', duration: 1.2, loop: true, base: 'rest', fingers: 'relaxed',
    keys: [K(0, wv(-12)), K(0.3, wv(14)), K(0.6, wv(-12)), K(0.9, wv(14)), K(1.2, wv(-12))],
    ik: { L_Foot: lf([{ t: 0, pos: [0.15, AY, 0.04] }, { t: 1.2, pos: [0.15, AY, 0.04] }]), R_Foot: rf([{ t: 0, pos: [-0.15, AY, -0.1] }, { t: 1.2, pos: [-0.15, AY, -0.1] }]),
      L_Hand: { keys: [{ t: 0, pos: [BAR[0], BAR[1], BAR[2]] }, { t: 1.2, pos: [BAR[0], BAR[1], BAR[2]] }], pole: [elbPole(0.22, 0), elbPole(0.22, 1.2)] } },
  }));
  h.play('m_ride', { fade: 0 });
  return h;
}
