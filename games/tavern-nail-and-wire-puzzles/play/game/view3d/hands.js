// A real hand (view3d athlete mesh, finger rig) pinching the selected wire from behind and above, like someone across the bar reaching in.
// Presenter-only: it reads where the grip point is and follows it. Scale: 1 lattice unit = 2.4 cm.
import * as V3D from '../vendor3d/index.js';
import { createHand } from './hand3d.js';

const T = V3D.THREE;
const UNIT = 0.024;                      // metres per lattice unit
export async function createHands(handScene) {
  const hand = await createHand(V3D, { side: 'R', skin: 'light', character: 'athlete_m', preset: 'pinch' });
  hand.human.setKit({ top: '#d8ccaa', trim: '#d8ccaa' });   // a linen shirt sleeve
  const root = new T.Group();
  root.scale.setScalar(1 / UNIT);
  root.add(hand.object);
  handScene.add(root);
  const plane = new T.Plane(new T.Vector3(0, 0, 1), 0), floorCut = new T.Plane(new T.Vector3(0, 1, 0), 0);
  hand.object.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false; } });
  root.visible = false;
  const sh = new T.Vector3(), wrist = new T.Vector3(), cur = new T.Vector3(), tmp = new T.Vector3(), fwd = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  let shown = 0, have = false;
  return {
    hand, plane, floorCut, planes: [plane, floorCut], root,
    // pivot: three.js world point of the grip; camPos: camera position; want: bool
    update(pivot, camPos, want, dt, curl = 0) {
      shown = Math.max(0, Math.min(1, shown + (want ? 1 : -1) * dt * 4));
      root.visible = shown > 0.01;
      if (!root.visible) { have = false; return; }
      fwd.set(pivot.x - camPos.x, 0, pivot.z - camPos.z); if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
      const e = shown * shown * (3 - 2 * shown), back = 5.4 + (1 - e) * 9, rise = 2.6 + (1 - e) * 4;
      tmp.copy(pivot).addScaledVector(fwd, back); tmp.y += rise;
      if (!have) { cur.copy(tmp); have = true; } else cur.lerp(tmp, 1 - Math.exp(-dt * 18));
      wrist.copy(cur);
      const fingers = fwd.clone().multiplyScalar(-1); fingers.y = -0.45; fingers.normalize();
      // stand the body behind the grip (facing the camera) so the right shoulder is a forearm's length behind the wrist
      root.rotation.y = Math.atan2(-fwd.x, -fwd.z);
      root.position.set(0, 0, 0); root.updateMatrixWorld(true);
      hand.human.bonePosition('R_UpperArm', sh);
      const want3 = tmp.copy(wrist).addScaledVector(fwd, 0.46 / UNIT); want3.y += 0.14 / UNIT;
      root.position.copy(want3).sub(sh); root.updateMatrixWorld(true);
      hand.setPose({ thumb: 0.42 + curl * 0.2, index: 0.5 + curl * 0.2, middle: 0.4, ring: 0.5, pinky: 0.55, spread: 0.15, thumbOut: 0.35 });
      hand.place({ wrist, palmDown: true, fingers, elbowHint: wrist.clone().addScaledVector(fwd, 10).add(new T.Vector3(3, 3, 0)) });
      // clip the rest of the body: keep only ~30 cm of forearm behind the wrist
      plane.normal.copy(fwd).multiplyScalar(-1);
      tmp.copy(wrist).addScaledVector(fwd, 0.31 / UNIT);
      plane.constant = -plane.normal.dot(tmp);
      floorCut.constant = -(pivot.y - 1.2);
      hand.human.setReach('R', wrist, { weight: 1, pole: null });
      hand.update(dt);
    },
    dispose() { handScene.remove(root); hand.dispose(); },
  };
}
