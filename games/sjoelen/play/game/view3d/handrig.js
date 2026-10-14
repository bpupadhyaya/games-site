// A realistic right hand + forearm (view3d athlete mesh via hand3d.js) reaching to a world point, used by the presenter and the icon.
// The body is cut away with clipping planes (everything behind the wrist and outside a tube around the forearm) and the stump is
// covered with a shirt sleeve, so only a hand and forearm come in from the player's side of the table.
const HAND_SCALE = 25;                                   // 1 m = 25 world units (a disc is 4.8 cm = 1.2 units)
const SKINS = ['light', 'tan'];
const SLEEVES = [0x2f4f8f, 0x6a3d22];

export async function loadHandRig(THREE, V3D, createHand, i = 0, opts = {}) {
  const h = await createHand(V3D, { side: 'R', skin: opts.skin || SKINS[i], character: 'athlete_m', preset: 'flat' });
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), tube = [0, 1, 2, 3].map(() => new THREE.Plane(new THREE.Vector3(1, 0, 0), 0));
  h.object.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { m.clippingPlanes = [plane, ...tube]; m.needsUpdate = true; } } });
  h.object.scale.setScalar(HAND_SCALE); h.object.visible = false;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.16, 18, 20, 1, true), new THREE.MeshStandardMaterial({ color: opts.sleeve ?? SLEEVES[i], roughness: 0.9, side: THREE.DoubleSide }));
  sleeve.visible = false; sleeve.castShadow = true;
  h.object.updateMatrixWorld(true);
  const shoulder = h.human.bonePosition('R_UpperArm', new THREE.Vector3());
  return { h, plane, tube, sleeve, shoulder, x: 92, y: 560, hh: 3.4, vis: 0, fingers: { thumb: 0.1, index: 0, middle: 0, ring: 0, pinky: 0, spread: 0.2, thumbOut: 0.3 } };
}

const _e = (T) => new T.Vector3();
let tmp = null;
/** wrist/fwd in WORLD units; fwd = horizontal direction the fingers point; dip = how far the fingers tilt down; side = +1/-1 elbow side. */
export function poseHand(THREE, Hd, wrist, fwd, dip, side, dt = 1 / 60, iters = 4) {
  if (!tmp) tmp = { w: _e(THREE), e: _e(THREE), s: _e(THREE), n: _e(THREE), t: _e(THREE), f: _e(THREE), up: new THREE.Vector3(0, 1, 0), el: _e(THREE), q: _e(THREE) };
  const { e, s, n, t, f, up, el } = tmp, obj = Hd.h.object;
  Hd.h.setPose(Hd.fingers);
  obj.traverse((o) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (m.clippingPlanes?.[0] !== Hd.plane) { m.clippingPlanes = [Hd.plane, ...Hd.tube]; m.needsUpdate = true; } } });
  const fingers = fwd.clone().multiplyScalar(0.95).addScaledVector(up, -0.3 - dip).normalize();
  const yaw = Math.atan2(fwd.x, fwd.z);
  // body placed so the shoulder sits behind and above the wrist (a relaxed reach), torso facing the way the fingers point
  s.copy(Hd.shoulder).applyAxisAngle(up, yaw);
  t.copy(wrist).addScaledVector(fwd, -9.5).addScaledVector(up, 7.5).sub(s);
  obj.rotation.set(0, yaw, 0); obj.position.copy(t); obj.updateMatrixWorld(true);
  el.copy(wrist).addScaledVector(fwd, -6).addScaledVector(up, 2).add(new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(4.5 * side));
  Hd.h.place({ wrist: wrist.clone(), palmDown: true, fingers, elbowHint: el.clone() });
  Hd.h.update(dt, iters);
  Hd.h.human.bonePosition('R_Hand', e); Hd.h.human.bonePosition('R_Forearm', s);
  n.copy(e).sub(s).normalize();
  t.copy(e).addScaledVector(n, -0.19 * HAND_SCALE);
  Hd.plane.setFromNormalAndCoplanarPoint(n, t);
  Hd.sleeve.position.copy(t).addScaledVector(n, -8.9);
  Hd.sleeve.quaternion.setFromUnitVectors(up, n);
  // keep only a tube around the forearm and hand: the torso and the other arm are cut away
  s.crossVectors(n, up); if (s.lengthSq() < 1e-4) s.set(1, 0, 0); s.normalize();
  f.crossVectors(s, n).normalize();
  const sides = [[s, 1, 2.3], [s, -1, 2.3], [f, 1, 4.2], [f, -1, 4.2]];
  for (let q = 0; q < 4; q++) { const [ax, sg, w] = sides[q]; tmp.q.copy(ax).multiplyScalar(-sg); t.copy(e).addScaledVector(ax, sg * w); Hd.tube[q].setFromNormalAndCoplanarPoint(tmp.q, t); }
}
