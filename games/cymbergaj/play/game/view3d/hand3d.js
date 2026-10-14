// hand3d.js: a realistic human hand + forearm for three.js, backed by the view3d athlete mesh (Rocketbox skinned model: real knuckles,
// tendons, nails, skin texture) and its finger rig. One file, no game imports: pass the view3d API in.
//
//   import * as V3D from './vendor3d/index.js';          // { loadHuman, THREE, FINGER_POSES, handQuat, palmFrame }
//   import { createHand } from './hand3d.js';
//   const hand = await createHand(V3D, { side: 'R', skin: 'light'|'tan'|'brown'|'deep'|'original', character: 'athlete_m', base: '<assets url>' });
//   scene.add(hand.object);                              // THREE.Group; hand.human is the underlying view3d Human (shoulder is in the group)
//   hand.setPreset('fist' | 'open' | 'flat' | 'point' | 'pinch' | 'cup' | 'gripRod' | 'count0'..'count5');
//   hand.setPose({ thumb, index, middle, ring, pinky: 0..1 curl each (0 straight, 1 fist), spread: 0..1, thumbOut: 0..1 });
//   hand.place({ wrist: Vector3, palmDown?: true, fingers?: Vector3 (direction), elbowHint?: Vector3 });   // reaches the hand to a world point/orientation
//   hand.gripCylinder({ radius, axis, center, from, thumbSide })                                     // wrap the fingers around a rod
//   hand.update(dt)  // call after changing pose / place (and every frame if you animate); hand.setSkin(name); hand.dispose()
// Hide the rest of the athlete body with a clipping plane or by framing (hand.clipBehindWrist(renderer, distance) does the plane).
// Bake recipe (used by Morra): render count0..count5 per skin from above with a soft warm key, then use the sprites in 2D.
const lerp = (a, b, t) => a + (b - a) * t;
const PRESETS = {
  fist: { thumb: 1, index: 1, middle: 1, ring: 1, pinky: 1, spread: 0, thumbOut: 0 },
  open: { thumb: 0, index: 0.05, middle: 0.05, ring: 0.05, pinky: 0.05, spread: 0.7, thumbOut: 1 },
  flat: { thumb: 0.1, index: 0, middle: 0, ring: 0, pinky: 0, spread: 0.2, thumbOut: 0.3 },
  point: { thumb: 0.9, index: 0, middle: 1, ring: 1, pinky: 1, spread: 0, thumbOut: 0 },
  pinch: { thumb: 0.45, index: 0.55, middle: 0.35, ring: 0.3, pinky: 0.25, spread: 0.2, thumbOut: 0.2 },
  cup: { thumb: 0.3, index: 0.4, middle: 0.4, ring: 0.4, pinky: 0.4, spread: 0.2, thumbOut: 0.5 },
  gripRod: { thumb: 0.45, index: 0.7, middle: 0.72, ring: 0.74, pinky: 0.76, spread: 0, thumbOut: 0.1 },
};
for (let n = 0; n <= 5; n++) PRESETS['count' + n] = { thumb: n === 5 ? 0 : 1, index: n >= 1 ? 0 : 1, middle: n >= 2 ? 0 : 1, ring: n >= 3 ? 0 : 1, pinky: n >= 4 ? 0 : 1, spread: 0.55, thumbOut: n === 5 ? 1 : 0 };

export async function createHand(V3D, opts = {}) {
  const { loadHuman, THREE: T, FINGER_POSES, handQuat, palmFrame } = V3D;
  const side = opts.side === 'L' ? 'L' : 'R';
  const human = await loadHuman({ character: opts.character || 'athlete_m', skin: opts.skin || 'light', clips: 'base', ...(opts.kit ? { kit: opts.kit } : {}), ...(opts.hair ? { hair: opts.hair } : {}), ...(opts.base ? { base: opts.base } : {}) });
  const FIST = FINGER_POSES.fist, REL = FINGER_POSES.flat;
  const pose = { ...PRESETS.open };
  let place = null, grip = null;
  const group = new T.Group(); group.add(human.root);
  human.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const names = ['thumb', 'index', 'middle', 'ring', 'pinky'];

  function applyFingers() {
    const curl = names.map((n, f) => FIST.curl[f].map((c, k) => lerp(f === 0 ? FINGER_POSES.open.curl[0][k] : REL.curl[f][k], c, pose[n])));
    // fingers fan out when straight: scale the rig's own "open" spread by the spread amount (sign is the rig's convention)
    const spread = names.map((n, f) => FINGER_POSES.open.spread[f] * (-1.3) * pose.spread * (f === 0 ? Math.max(pose.thumbOut, 0.3) : 1 - pose[n]));
    human.setFingers(side, { curl, spread }, { rate: 1000 });
  }
  function setPose(p) { for (const k of Object.keys(pose)) if (p[k] !== undefined) pose[k] = Math.max(0, Math.min(1, p[k])); applyFingers(); return api; }
  function setPreset(name, extra = {}) { if (!PRESETS[name]) throw new Error('unknown hand preset ' + name); return setPose({ ...PRESETS[name], ...extra }); }

  // Reach the wrist to a world point with the palm down and fingers along `fingers`; the elbow bends toward elbowHint.
  function placeHand({ wrist, palmDown = true, fingers = new T.Vector3(0, 0, 1), elbowHint = null, palmDir = null } = {}) {
    place = { wrist: wrist.clone(), q: handQuat(human, side, palmDir || new T.Vector3(0, palmDown ? -1 : 1, 0), fingers), pole: elbowHint };
    return api;
  }
  function gripCylinder({ radius = 0.012, axis = new T.Vector3(0, 1, 0), center = new T.Vector3(), from = new T.Vector3(0, 0, 1), thumbSide = 1 } = {}) {
    // knuckle row along the rod, palm toward it; the back of the hand faces `from`. Metres.
    const ax = axis.clone().normalize(), z = from.clone().sub(ax.clone().multiplyScalar(from.dot(ax))).normalize();
    const palmN = z.clone().negate();
    const fdir = new T.Vector3().crossVectors(z, ax).normalize().multiplyScalar(thumbSide);
    setPreset('gripRod', { index: Math.min(1, 0.55 + 0.05 / Math.max(radius, 0.01) * 0.2) });
    place = { wrist: center.clone().addScaledVector(z, radius + 0.025).addScaledVector(fdir, -0.04), q: handQuat(human, side, palmN, fdir), pole: null };
    return api;
  }
  function update(dt = 0.03, iters = 40) {
    if (place) for (let i = 0; i < iters; i++) { human.setReach(side, place.wrist, { weight: 1, pole: place.pole, quat: place.q }); human.update(dt); }
    else human.update(dt);
    human.root.updateMatrixWorld(true);
    return api;
  }
  function clipBehindWrist(renderer, dist = 0.15, dir = new T.Vector3(0, 0, 1)) {
    const w = human.bonePosition(`${side}_Hand`, new T.Vector3());
    renderer.clippingPlanes = [new T.Plane(dir.clone().normalize(), -w.dot(dir.clone().normalize()) + dist)];
  }
  const api = {
    object: group, human, setPose, setPreset, place: placeHand, gripCylinder, update, clipBehindWrist,
    setSkin(s) { human.setSkin(s); return api; },
    wristPosition(out = new T.Vector3()) { return human.bonePosition(`${side}_Hand`, out); },
    PRESETS, get pose() { return { ...pose }; },
    dispose() { human.dispose?.(); },
  };
  setPreset(opts.preset || 'open');
  return api;
}
export const HAND_PRESETS = Object.keys(PRESETS);
