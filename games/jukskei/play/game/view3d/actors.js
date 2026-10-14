// The people: one thrower (re-dressed for each side) whose arm is wound back by the swing bar and released exactly when the sim
// launches the pin, and a handful of spectators at the fence. Poses are authored on the Rocketbox rig with view3d's pose-to-pose
// keyframer (semantic bone offsets: flex / abduct / twist, degrees, character space: +Z forward, +X the avatar's left).
import { PIN_LEN } from '../src/sim.js';

const SKINS = ['light', 'tan', 'brown', 'deep'];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
export const FIG_X = -0.55;                    // where the thrower stands (matches the 2D art)

// ---- throwing poses: ready -> wound back (peak) -> release -> follow-through, per style (0 lob, 1 skim, 2 whirl) ------------------
// A pose is { Bone: { flex, abduct, twist, side, pos:[x,y,z] } }.
const READY = {
  Pelvis: { twist: -4, pos: [0, 0, 0] }, Spine: { flex: 3, twist: -3 }, Spine1: { flex: 2 }, Neck: { flex: -2 }, Head: { twist: 0 },
  R_UpperArm: { flex: 8, abduct: 6 }, R_Forearm: { flex: 24 }, L_UpperArm: { flex: 12, abduct: 8 }, L_Forearm: { flex: 20 },
  L_Thigh: { flex: 10, abduct: 3 }, L_Calf: { flex: 8 }, R_Thigh: { flex: -4, abduct: 2 }, R_Calf: { flex: 6 },
};
const STYLE = [
  { // Lob: an underarm swing that finishes high, the pin leaves above the shoulder line
    wind: { Pelvis: { twist: -10, pos: [0, -0.05, -0.07] }, Spine: { flex: 8, twist: -12 }, Spine1: { flex: 4, twist: -6 }, Neck: { flex: -4 },
      R_UpperArm: { flex: -84, abduct: 8 }, R_Forearm: { flex: 28 }, L_UpperArm: { flex: 60, abduct: 22 }, L_Forearm: { flex: 22 },
      L_Thigh: { flex: 22, abduct: 4 }, L_Calf: { flex: 12 }, R_Thigh: { flex: -8 }, R_Calf: { flex: 26 } },
    rel: { Pelvis: { twist: 8, pos: [0, -0.07, 0.15] }, Spine: { flex: 12, twist: 10 }, Spine1: { flex: 6, twist: 5 }, Neck: { flex: -6 },
      R_UpperArm: { flex: 104, abduct: 4 }, R_Forearm: { flex: 8 }, L_UpperArm: { flex: -26, abduct: 20 }, L_Forearm: { flex: 24 },
      L_Thigh: { flex: 38, abduct: 4 }, L_Calf: { flex: 34 }, R_Thigh: { flex: -16 }, R_Calf: { flex: 34 } },
    fol: { Pelvis: { twist: 14, pos: [0, -0.05, 0.2] }, Spine: { flex: 18, twist: 16 }, Spine1: { flex: 8, twist: 8 }, Neck: { flex: -8 },
      R_UpperArm: { flex: 150, abduct: 10 }, R_Forearm: { flex: 4 }, L_UpperArm: { flex: -10, abduct: 30 }, L_Forearm: { flex: 20 },
      L_Thigh: { flex: 30 }, L_Calf: { flex: 26 }, R_Thigh: { flex: -6 }, R_Calf: { flex: 22 } },
  },
  { // Skim: crouch low, a long low underarm swing, the pin leaves at hip height
    wind: { Pelvis: { twist: -8, pos: [0, -0.16, -0.06] }, Spine: { flex: 24, twist: -9 }, Spine1: { flex: 12, twist: -4 }, Neck: { flex: -14 },
      R_UpperArm: { flex: -76, abduct: 6 }, R_Forearm: { flex: 14 }, L_UpperArm: { flex: 40, abduct: 36 }, L_Forearm: { flex: 20 },
      L_Thigh: { flex: 46, abduct: 5 }, L_Calf: { flex: 50 }, R_Thigh: { flex: 22 }, R_Calf: { flex: 58 } },
    rel: { Pelvis: { twist: 6, pos: [0, -0.2, 0.2] }, Spine: { flex: 32, twist: 8 }, Spine1: { flex: 14, twist: 4 }, Neck: { flex: -20 },
      R_UpperArm: { flex: 60, abduct: 3 }, R_Forearm: { flex: 6 }, L_UpperArm: { flex: -20, abduct: 40 }, L_Forearm: { flex: 20 },
      L_Thigh: { flex: 58 }, L_Calf: { flex: 64 }, R_Thigh: { flex: -12 }, R_Calf: { flex: 44 } },
    fol: { Pelvis: { twist: 12, pos: [0, -0.18, 0.22] }, Spine: { flex: 34, twist: 14 }, Spine1: { flex: 16, twist: 6 }, Neck: { flex: -22 },
      R_UpperArm: { flex: 88, abduct: 8 }, R_Forearm: { flex: 4 }, L_UpperArm: { flex: -14, abduct: 44 }, L_Forearm: { flex: 20 },
      L_Thigh: { flex: 54 }, L_Calf: { flex: 58 }, R_Thigh: { flex: -8 }, R_Calf: { flex: 38 } },
  },
  { // Whirl: arm raised out and back, a quick flat sweep with a wrist snap
    wind: { Pelvis: { twist: -16, pos: [0, -0.07, -0.08] }, Spine: { flex: 5, twist: -20 }, Spine1: { flex: 3, twist: -10 }, Neck: { flex: -3 },
      R_UpperArm: { flex: -34, abduct: 72 }, R_Forearm: { flex: 74 }, L_UpperArm: { flex: 56, abduct: 40 }, L_Forearm: { flex: 20 },
      L_Thigh: { flex: 24, abduct: 4 }, L_Calf: { flex: 14 }, R_Thigh: { flex: -8 }, R_Calf: { flex: 28 } },
    rel: { Pelvis: { twist: 14, pos: [0, -0.07, 0.15] }, Spine: { flex: 10, twist: 18 }, Spine1: { flex: 5, twist: 9 }, Neck: { flex: -5 },
      R_UpperArm: { flex: 84, abduct: 40 }, R_Forearm: { flex: 6 }, L_UpperArm: { flex: -30, abduct: 22 }, L_Forearm: { flex: 26 },
      L_Thigh: { flex: 40 }, L_Calf: { flex: 34 }, R_Thigh: { flex: -16 }, R_Calf: { flex: 36 } },
    fol: { Pelvis: { twist: 24, pos: [0, -0.05, 0.2] }, Spine: { flex: 16, twist: 28 }, Spine1: { flex: 8, twist: 14 }, Neck: { flex: -8 },
      R_UpperArm: { flex: 60, abduct: 76 }, R_Forearm: { flex: 22 }, L_UpperArm: { flex: -16, abduct: 30 }, L_Forearm: { flex: 24 },
      L_Thigh: { flex: 30 }, L_Calf: { flex: 26 }, R_Thigh: { flex: -6 }, R_Calf: { flex: 24 } },
  },
];
const BONES = Object.keys(READY).concat(Object.keys(STYLE[0].wind).filter((b) => !(b in READY)));
const FIELDS = ['flex', 'abduct', 'twist', 'side'];
function mix(a, b, u) {
  const out = {};
  for (const bone of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const A = a[bone] || {}, B = b[bone] || {}, o = {};
    for (const f of FIELDS) { const x = A[f] || 0, y = B[f] || 0; if (x || y) o[f] = lerp(x, y, u); }
    const pa = A.pos || [0, 0, 0], pb = B.pos || [0, 0, 0];
    if (A.pos || B.pos) o.pos = [lerp(pa[0], pb[0], u), lerp(pa[1], pb[1], u), lerp(pa[2], pb[2], u)];
    out[bone] = o;
  }
  return out;
}
void BONES;

export function makePinProp(THREE, geo, material) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, material);
  m.rotation.z = Math.PI / 2;                     // long axis x -> +Y (the prop convention)
  m.position.y = PIN_LEN / 2;                     // handle end at the origin
  m.castShadow = true;
  g.add(m);
  g.userData.mesh = m;
  return g;
}

// ---- the thrower -----------------------------------------------------------------------------------------------------------------
export class Thrower {
  constructor(V3, h, pinProp) {
    this.V3 = V3; this.h = h; this.prop = pinProp;
    this.holding = false; this.mode = 'idle'; this.style = 0; this.lastThrowKey = null; this.rel = 0.25;
    this.yaw = Math.PI / 2; this.team = -1; this.lookKey = '';
    const { buildClip, ease } = V3;
    this.buildClip = buildClip; this.ease = ease;
    // the wind-up: scrubbed by the swing bar (time = progress), one clip per style
    this.wind = STYLE.map((s, i) => {
      const c = buildClip(h, { name: `wind${i}`, duration: 1, base: 'idle_relaxed', fingers: 'relaxed', keys: [{ t: 0, pose: READY }, { t: 1, pose: s.wind, ease: 'inOut' }] });
      h.addClip(c);
      return c.name;
    });
    h.play('idle_relaxed', { fade: 0 });
  }
  // build the throw clip from the pose the arm is in right now (swing progress u), releasing at `rel` seconds
  makeThrow(style, u, rel, windFirst = false) {
    const s = STYLE[style], ex = this.ease.inOut;
    const start = windFirst ? READY : mix(READY, s.wind, ex(clamp(u, 0, 1)));
    const name = `throw${style}`;
    const keys = [{ t: 0, pose: start }];
    if (windFirst) keys.push({ t: rel * 0.62, pose: s.wind, ease: 'inOut' });          // a slow draw-back, then the throw
    keys.push({ t: rel, pose: s.rel, ease: 'in' }, { t: rel + 0.28, pose: s.fol, ease: 'out' }, { t: rel + 0.75, pose: READY, ease: 'inOut' });
    const c = this.buildClip(this.h, { name, duration: rel + 0.75, base: 'idle_relaxed', fingers: 'relaxed', keys, events: { release: rel } });
    this.h.addClip(c);
    return name;
  }
  dress(look) {
    const key = `${look.skin}|${look.shirt}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.h.setKit({ top: look.shirt, bottoms: '#2d3550', socks: '#e6e1d2' });
    this.h.setSkin(SKINS[clamp(look.skin | 0, 0, 3)]);
  }
  setHolding(on, propMat) {
    if (on === this.holding && !propMat) return;
    this.holding = on;
    if (on) { if (propMat) this.prop.userData.mesh.material = propMat; this.h.attach(this.prop, 'R', 'bat', { slide: 0.055 }); this.prop.visible = true; }
    else { this.h.detach(this.prop); this.prop.visible = false; }
  }
}

// ---- the spectators ---------------------------------------------------------------------------------------------------------------
export const SPECTATORS = [
  // x along the lane, depth behind the fence (group units), facing, look
  { x: -3.2, d: 6.3, ch: 'athlete_m', skin: 'brown', hair: 'black', top: '#3a6f8a', bottoms: '#2d2f3a', cap: 0x7a5a30 },
  { x: -2.2, d: 5.7, ch: 'athlete_f', skin: 'tan', hair: 'black', top: '#b5483b', bottoms: '#2a3a55' },
  { x: 0.6, d: 6.6, ch: 'athlete_m', skin: 'light', hair: 'brown', top: '#d8c9a0', bottoms: '#4a4538', cap: 0x2f5d40 },
  { x: 2.4, d: 5.9, ch: 'athlete_f', skin: 'deep', hair: 'black', top: '#e0a52b', bottoms: '#355070' },
  { x: 7.0, d: 6.4, ch: 'athlete_m', skin: 'tan', hair: 'black', top: '#566e3d', bottoms: '#33302a', cap: 0x8a7a50 },
  { x: 13.5, d: 5.8, ch: 'athlete_f', skin: 'light', hair: 'ginger', top: '#6a8fc0', bottoms: '#3b3b44' },
  { x: 15.4, d: 6.5, ch: 'athlete_m', skin: 'brown', hair: 'black', top: '#9a3d2a', bottoms: '#2a2d36', cap: 0x30343c },
  { x: 'D-6.6', d: 6.2, ch: 'athlete_f', skin: 'tan', hair: 'brown', top: '#8a4fb0', bottoms: '#2d3550' },
  { x: 'D-4.9', d: 5.8, ch: 'athlete_m', skin: 'deep', hair: 'black', top: '#d9d5c8', bottoms: '#3a4258', cap: 0x6a3a2a },
  { x: 'D+3.0', d: 8.6, ch: 'athlete_m', skin: 'light', hair: 'black', top: '#2f9d8f', bottoms: '#2d2d34' },
  { x: 'D+5.5', d: 8.0, ch: 'athlete_f', skin: 'brown', hair: 'black', top: '#c8532f', bottoms: '#2f3a50' },
];
