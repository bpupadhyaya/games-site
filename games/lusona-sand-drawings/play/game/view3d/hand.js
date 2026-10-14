// The drawing hand: a real 3D right hand (view3d athlete rig, via hand3d.js) whose index finger presses into the sand and draws the
// groove of the tile being turned. It approaches from the near side, the fingertip follows the arc with a damped spring, pressure
// dips the finger into the sand, and the hand lifts away when the stroke is done.
import * as V3D from '../vendor3d/index.js';
import { createHand } from './hand3d.js';

const { THREE } = V3D;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);

export async function createFinger({ scene, renderer }) {
  let hand;
  try { hand = await createHand(V3D, { side: 'R', skin: 'brown', character: 'athlete_m', preset: 'point' }); } catch (e) { console.warn('hand load failed', e); return null; }
  hand.object.visible = false;
  hand.object.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; } });
  scene.add(hand.object);
  hand.setPreset('point', { index: 0.08, thumb: 0.7 });
  // everything behind the forearm is clipped; a cloth sleeve (an elder's tunic cuff) hides the cut
  const clip = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  hand.object.traverse((o) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.clippingPlanes = [clip]; m.needsUpdate = true; }); } });
  const sleeveMat = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#9a3f1c'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 128; i += 16) { x.fillStyle = i % 32 ? '#e3b25a' : '#2b3f78'; x.fillRect(0, i + 5, 128, 4); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide }); })();
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.7, 20, 1, true), sleeveMat);
  sleeve.castShadow = true; sleeve.visible = false; scene.add(sleeve);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.011, 8, 22), new THREE.MeshStandardMaterial({ color: '#efe2c0', roughness: 0.9 }));
  cuff.visible = false; scene.add(cuff);
  hand.human.root.position.set(0, 0, 0); hand.human.root.updateMatrixWorld(true);
  const shoulder0 = hand.human.bonePosition('R_UpperArm', new THREE.Vector3()).clone();
  const UP = new THREE.Vector3(0, 1, 0), u = new THREE.Vector3(), shoulderW = new THREE.Vector3();

  const tipNow = new THREE.Vector3(), tipVel = new THREE.Vector3(), home = new THREE.Vector3();
  const wrist = new THREE.Vector3(), dir = new THREE.Vector3(), tipBone = new THREE.Vector3(), err = new THREE.Vector3(), elbow = new THREE.Vector3();
  let presence = 0, started = false, hold = 0, press = 0;
  const FINGER_LEN = 0.168;   // wrist to index fingertip, metres

  function pose(target, lift, camera) {
    // approach from the lower right of the view (camera side), fingers pointing away and down into the sand
    const toCam = api.approach ? api.approach.clone().normalize() : camera ? new THREE.Vector3(camera.position.x - target.x, 0, camera.position.z - target.z).normalize() : new THREE.Vector3(0, 0, 1);
    const side = new THREE.Vector3(toCam.z, 0, -toCam.x);             // to the camera's right
    const horiz = toCam.clone().multiplyScalar(-1).addScaledVector(side, 0.55).normalize();   // fingers point away and a little left
    const pitch = 0.36 + lift * 0.2;                                 // radians below horizontal
    dir.set(horiz.x * Math.cos(pitch), -Math.sin(pitch), horiz.z * Math.cos(pitch)).normalize();
    wrist.copy(target).addScaledVector(dir, -FINGER_LEN);
    elbow.copy(wrist).addScaledVector(side, 0.35).add(new THREE.Vector3(0, 0.12, 0)).addScaledVector(toCam, 0.45);
    // seat the shoulder behind and above the wrist so the arm reaches naturally (the body itself is clipped away)
    shoulderW.copy(wrist).addScaledVector(toCam, 0.5).addScaledVector(side, 0.12); shoulderW.y = wrist.y + 0.3;
    hand.human.root.position.copy(shoulderW).sub(shoulder0);
    hand.human.root.updateMatrixWorld(true);
    for (let k = 0; k < 2; k++) {
      hand.place({ wrist, palmDown: true, fingers: dir, elbowHint: elbow });
      hand.update(0.03);
      hand.human.bonePosition('R_Finger12', tipBone);
      tipBone.addScaledVector(dir, 0.016);
      err.copy(target).sub(tipBone);
      wrist.add(err);
    }
    hand.place({ wrist, palmDown: true, fingers: dir, elbowHint: elbow });
    hand.update(0.03);
    // clip plane + sleeve follow the forearm axis (wrist -> shoulder)
    u.copy(shoulderW).sub(wrist).normalize();
    clip.normal.copy(u).negate(); clip.constant = u.dot(wrist) + (window.__dbgClip ?? 0.3);
    sleeve.position.copy(wrist).addScaledVector(u, 0.13 + 0.35); sleeve.quaternion.setFromUnitVectors(UP, u); sleeve.visible = !window.__dbgNoSleeve;
    cuff.position.copy(wrist).addScaledVector(u, 0.13); cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), u); cuff.visible = !window.__dbgNoSleeve;
  }

  const api = {
    hand, approach: null,
    update(tip, dt, clock, camera) {
      const want = tip ? 1 : 0;
      hold = tip ? 0.25 : Math.max(0, hold - dt);
      presence += (((want || hold > 0) ? 1 : 0) - presence) * clamp(dt * (want ? 9 : 5), 0, 1);
      if (presence < 0.02) { hand.object.visible = false; sleeve.visible = false; cuff.visible = false; started = false; return; }
      if (tip) {
        const target = new THREE.Vector3(tip.x, 0.03, tip.z);
        if (!started) { tipNow.copy(target).add(new THREE.Vector3(0.06, 0.07, 0.1)); tipVel.set(0, 0, 0); started = true; }
        // smooth follow (frame-rate independent)
        tipNow.lerp(target, 1 - Math.exp(-dt * 20));
        home.copy(tipNow);
        press += (1 - press) * clamp(dt * 12, 0, 1);
      } else press += (0 - press) * clamp(dt * 8, 0, 1);
      // lifted off between strokes: hover above the last point
      const hover = (1 - ease(press)) * 0.075 + (1 - ease(presence)) * 0.12;
      const t = new THREE.Vector3(home.x, 0.03 + hover, home.z);
      if (!tip) t.add(new THREE.Vector3(0.0, 0, 0));
      pose(t, 1 - press, camera);
      hand.object.visible = true;
    },
  };
  return api;
}
