// Authored hurling clips (pose-to-pose bone offsets + a hurley track in character space: +Z forward, +X the avatar's LEFT, metres).
// Contact keys use `sweet: 'contact'`: the presenter puts the world ball position into human.setTarget('contact', p) every frame and retimes the
// clip with playTimed so the bas meets the ball exactly at the simulation's contact time. The right hand is the top hand (grip 0.19 m from the butt).
import { buildClip } from '../vendor3d/index.js';
import { CLIP_SPECS } from './clipspecs.js';

const n = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const K = (t, grip, dir, roll, ease) => ({ t, grip, dir: n(dir), roll, ease });
const S = (t, dir, roll, ease) => ({ t, sweet: 'contact', dir: n(dir), roll, ease });

export const CARRY = { grip: [-0.26, 0.97, 0.3], dir: [0.12, -0.5, 0.86], roll: 0 };
const CARRY_KEY = { grip: [-0.26, 0.97, 0.3], dir: [0.12, -0.5, 0.86], roll: 0 };

// Data-driven act clips (so the dev optimiser can adjust the numbers): pose keys use `crouch: 0..1` (knee bend + lowered pelvis) plus semantic bone offsets,
// prop keys are { t, grip, dir, roll } (character space) or { t, sweet: 'contact', dir, roll } where the bas meets the ball.
const crouchPose = (a) => ({ Pelvis: { pos: [0, -0.11 * a, 0.05 * a], flex: 10 * a }, L_Thigh: { flex: 32 * a }, R_Thigh: { flex: 32 * a }, L_Calf: { flex: 50 * a }, R_Calf: { flex: 50 * a } });
function expandPose(p) {
  const { crouch, ...rest } = p;
  const out = crouch !== undefined ? crouchPose(crouch) : {};
  for (const [bone, v] of Object.entries(rest)) out[bone] = { ...(out[bone] || {}), ...v, ...(bone === 'Pelvis' && out.Pelvis && v.pos === undefined ? { pos: out.Pelvis.pos } : {}) };
  return out;
}
const ZERO = { crouch: 0, Spine1: { twist: 0, flex: 0 }, Head: { twist: 0 }, L_UpperArm: { flex: 0, abduct: 0 } };
export { CLIP_SPECS };
// small deterministic variations so no two players stand the same: arm placement and a slow, individual breathing / sway loop
const seeded = (i) => { let s = (i * 2654435761 + 12345) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
export function buildHurlClips(h, specs = CLIP_SPECS, seed = 0) {
  const rnd = seeded(seed + 1);
  const armL = { flex: 2 + rnd() * 12, abduct: 4 + rnd() * 10 }, foreL = 8 + rnd() * 26, pelSide = (rnd() - 0.5) * 6;
  const base = (name, clip, extra = {}) => {
    const c = buildClip(h, { name, base: clip, inherit: true, keys: [{ t: 0 }], prop: [K(0, CARRY.grip, CARRY.dir, CARRY.roll), K(99, CARRY.grip, CARRY.dir, CARRY.roll)], fingers: 'relaxed', ...extra });
    h.addClip(c);
    return c;
  };
  base('h_idle', 'ready_stance', { keys: [{ t: 0, pose: { L_UpperArm: armL, L_Forearm: { flex: foreL }, Pelvis: { side: pelSide }, Head: { side: (rnd() - 0.5) * 6 } } }] }); base('h_walk', 'walk'); base('h_jog', 'jog'); base('h_sprint', 'sprint');
  // carrying the ball on the bas (solo run): the sweet spot follows a point just under the ball
  const solo = (name, clip) => { const c = buildClip(h, { name, base: clip, inherit: true, keys: [{ t: 0 }], prop: [S(0, [0.05, 0.12, 0.99], 0), S(99, [0.05, 0.12, 0.99], 0)], fingers: 'relaxed' }); h.addClip(c); };
  solo('h_solo_idle', 'ready_stance'); solo('h_solo_walk', 'walk'); solo('h_solo_jog', 'jog'); solo('h_solo_sprint', 'sprint');

  // acts from the data (a keeper's dive is the hook swing while the sim throws the body sideways)
  const all = { ...specs };
  for (const [name, sp] of Object.entries(all)) {
    h.addClip(buildClip(h, {
      name, duration: sp.duration, base: { clip: 'ready_stance', time: 0.4 },
      keys: sp.keys.map((k) => (k.pose ? { t: k.t, ease: k.ease, pose: expandPose(k.pose) } : { t: k.t })),
      prop: sp.prop.map((k) => (k.sweet ? S(k.t, k.dir, k.roll, k.ease) : K(k.t, k.grip, k.dir, k.roll, k.ease))),
      events: { contact: sp.contact }, fingers: 'batGrip',
    }));
  }

  // ---- the hand-pass: the free (left) hand strikes the ball tossed in front while the hurley stays low in the right hand
  h.addClip(buildClip(h, {
    name: 'h_pass', duration: 0.95, base: { clip: 'ready_stance', time: 0.4 },
    keys: [
      { t: 0.0 },
      { t: 0.14, pose: expandPose({ crouch: 0.25, Spine1: { twist: -22 }, Pelvis: { twist: -10 }, L_UpperArm: { flex: 20, abduct: 30 } }), ease: 'inOut' },
      { t: 0.26, pose: expandPose({ crouch: 0.3, Spine1: { twist: 14 }, Pelvis: { twist: 8 }, L_UpperArm: { flex: 55, abduct: 5 } }), ease: 'in' },
      { t: 0.95, pose: expandPose(ZERO), ease: 'inOut' },
    ],
    prop: [K(0, CARRY.grip, CARRY.dir, 0), K(99, CARRY.grip, CARRY.dir, 0)],
    ik: { L_Hand: { keys: [{ t: 0, pos: [0.25, 1.05, 0.35] }, { t: 0.14, pos: [0.2, 1.2, 0.2], ease: 'inOut' }, { t: 0.26, target: 'contact', ease: 'in' }, { t: 0.5, pos: [0.3, 1.15, 0.45], ease: 'out' }, { t: 0.95, pos: [0.25, 1.0, 0.3] }] } },
    events: { contact: 0.26 }, fingers: 'open',
  }));

  // live layer: slow additive breathing, weight shift, head drift and a loosely swinging free arm; each player has its own period and phase
  const D = 2.6 + rnd() * 2.2, ph = rnd();
  const w = (a) => (rnd() - 0.5) * 2 * a;
  const key = (t, f) => ({ t, ease: 'inOut', pose: { Spine1: { flex: f * 1.4, side: f * w(1.2), twist: w(2) }, Spine2: { flex: f * 0.8 }, Head: { twist: w(7), side: w(2), flex: f * 1.5 }, L_UpperArm: { flex: w(4), abduct: w(3) }, L_Forearm: { flex: w(5) } } });
  const k0 = key(0, 0), k1 = key(D * 0.25, 1), k2 = key(D * 0.5, 0.2), k3 = key(D * 0.75, -0.6);
  h.addLayer('live', { mask: 'upper', additive: true });
  h.addClip(buildClip(h, { name: 'h_live', duration: D, base: 'rest', loop: true, keys: [k0, k1, k2, k3, { ...k0, t: D }] }));
  h.play('h_live', { layer: 'live', loop: true, startPhase: ph, fade: 0 });
}
