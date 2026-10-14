// Two real hands for the rub: ONE athlete mesh (real knuckles, tendons, nails, skin) drives both arms, so the cost is a single
// skinned model. Built on the morra hand module's finger poses. Presenter-only: it never touches the simulation.
//
//   const pair = await createHandPair(V3D, { skin, base });   scene.add(pair.object);
//   pair.pose(s, rubK, phase)   // s = how hard the palms press 0..1, rubK = -1..1 fore-aft rub (left forward / right back), phase = clock
//   pair.update(dt)
// Metres, shaft axis = +Y through the origin, hands either side (x), fingers pointing forward (-z is away from the player).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

export async function createHandPair(V3D, opts = {}) {
  const { loadHuman, THREE: T, FINGER_POSES, handQuat } = V3D;
  const human = await loadHuman({ character: 'athlete_m', skin: opts.skin || 'light', clips: 'base', ...(opts.base ? { base: opts.base } : {}) });
  const group = new T.Group(); group.add(human.root);
  // keep only the arms: triangles whose three vertices are dominated by an upper arm / forearm / hand / finger bone. The torso, legs and
  // head are never drawn, so the camera can sit at the player's eyes without a body in the way.
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const g = o.geometry, names = o.skeleton.bones.map((b) => b.name);
    const arm = names.map((n) => /_(UpperArm|Forearm|Hand|Finger)/.test(n) && !/Roll|Twist/.test(n) || /_Clavicle/.test(n) === false && /_(UpperArm|Forearm|Hand|Finger)/.test(n));
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count, dom = new Array(n);
    for (let v = 0; v < n; v++) { let bi = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; bi = si.getComponent(v, k); } } dom[v] = arm[bi]; }
    const idx = g.index.array, keep = [];
    for (let i = 0; i < idx.length; i += 3) if (dom[idx[i]] && dom[idx[i + 1]] && dom[idx[i + 2]]) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    g.setIndex(keep);
    if (!keep.length) o.visible = false;
  });
  human.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
  const FIST = FINGER_POSES.fist, REL = FINGER_POSES.flat, OPEN = FINGER_POSES.open;
  const names = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  const P = {
    L: { thumb: 0.3, index: 0.22, middle: 0.26, ring: 0.3, pinky: 0.34, spread: 0.0, thumbOut: 0.1 },
    R: { thumb: 0.3, index: 0.22, middle: 0.26, ring: 0.3, pinky: 0.34, spread: 0.0, thumbOut: 0.1 },
  };
  function fingers(side) {
    const p = P[side];
    const curl = names.map((n, f) => FIST.curl[f].map((c, k) => lerp(f === 0 ? OPEN.curl[0][k] : REL.curl[f][k], c, p[n])));
    const spread = names.map((n, f) => OPEN.spread[f] * -1.3 * p.spread * (f === 0 ? Math.max(p.thumbOut, 0.3) : 1 - p[n]));
    human.setFingers(side, { curl, spread }, { rate: 1000 });
  }
  const api = {
    object: group, human, P,
    setSkin(s) { human.setSkin(s); return api; },
    /** Put each wrist at a world point with the palm facing `palmDir` and the fingers along `fdir`; elbowHint bends the arm. */
    reach(side, wrist, palmDir, fdir, elbowHint) {
      human.setReach(side, wrist, { weight: 1, pole: elbowHint || null, quat: handQuat(human, side, palmDir, fdir) });
      fingers(side);
    },
    update(dt = 1 / 60) { human.update(dt); human.root.updateMatrixWorld(true); return api; },
    bone(name, out = new T.Vector3()) { return human.bonePosition(name, out); },
    dispose() { human.dispose?.(); },
  };
  api.clamp = clamp;
  return api;
}
