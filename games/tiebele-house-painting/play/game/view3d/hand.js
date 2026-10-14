// The painter's hand: a real 3D right hand (view3d athlete rig through hand3d.js) holding a chicken-feather brush, with brass wrist bangles
// and an indigo cloth cuff. It comes in from the lower right in front of the wall, the brush tip follows the stroke with a critically
// damped spring (frame-rate independent), presses into the plaster, and the hand drifts out of view between strokes.
import * as V3D from '../vendor3d/index.js';
import { createHand } from './hand3d.js';

const { THREE } = V3D;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);

function featherTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  x.clearRect(0, 0, 64, 256);
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#6b4a2a'); g.addColorStop(0.5, '#caa070'); g.addColorStop(1, '#f1e1c0');
  // vane: an elongated leaf with barbs
  x.fillStyle = g; x.beginPath(); x.moveTo(32, 4);
  x.bezierCurveTo(60, 50, 62, 170, 32, 252); x.bezierCurveTo(2, 170, 4, 50, 32, 4); x.fill();
  x.strokeStyle = 'rgba(70,44,20,0.5)'; x.lineWidth = 1.2;
  for (let y = 20; y < 244; y += 5) { const k = Math.sin((y / 256) * Math.PI), w = 26 * k; x.beginPath(); x.moveTo(32, y); x.lineTo(32 - w, y + 18); x.moveTo(32, y); x.lineTo(32 + w, y + 18); x.stroke(); }
  x.strokeStyle = '#4a3018'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(32, 0); x.lineTo(32, 256); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function createPainter({ scene }) {
  let hand;
  try { hand = await createHand(V3D, { side: 'R', skin: new URLSearchParams(location.search).get('skin') || 'deep', character: new URLSearchParams(location.search).get('char') || 'athlete_m', preset: 'pinch' }); } catch (e) { console.warn('painter hand load failed', e); return null; }
  hand.object.visible = false;
  hand.object.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; } });
  scene.add(hand.object);
  hand.setPreset('pinch', { thumb: 0.55, index: 0.48, middle: 0.5, ring: 0.62, pinky: 0.7, spread: 0.1 });
  // everything behind the forearm is clipped; the cloth cuff hides the cut
  const clip = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  hand.object.traverse((o) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.clippingPlanes = [clip]; m.needsUpdate = true; }); } });
  const cloth = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#26397a'; x.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 3000; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)'; x.fillRect(Math.random() * 128, Math.random() * 256, 1, 4); }
    // woven strip bands at the cuff only (v = 0 is the wrist end): cream and ochre
    x.fillStyle = '#efe2c0'; x.fillRect(0, 250, 128, 6); x.fillStyle = '#d7a13a'; x.fillRect(0, 238, 128, 5); x.fillStyle = '#efe2c0'; x.fillRect(0, 228, 128, 3);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide });
  })();
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.056, 1.4, 28, 1, true), cloth); sleeve.castShadow = true; sleeve.visible = false; scene.add(sleeve);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 8, 24), new THREE.MeshStandardMaterial({ color: '#efe2c0', roughness: 0.9 })); cuff.visible = false; scene.add(cuff);
  const bangleM = new THREE.MeshStandardMaterial({ color: '#d9a640', metalness: 0.95, roughness: 0.28, envMapIntensity: 1.6 });
  const bangles = [0, 1, 2].map((k) => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.0305, 0.0042, 8, 26), bangleM); m.castShadow = true; m.visible = false; scene.add(m); return m; });
  // the brush: quill + feather vane (two crossed planes) + the loaded pigment tip
  const brush = new THREE.Group(); brush.visible = false; scene.add(brush);
  const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0046, 0.17, 8), new THREE.MeshStandardMaterial({ color: '#e8d8b0', roughness: 0.6 }));
  quill.rotation.x = Math.PI / 2; quill.position.z = -0.085; quill.castShadow = true;
  const ft = featherTexture();
  const vaneM = new THREE.MeshStandardMaterial({ map: ft, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.85 });
  for (const rz of [0, Math.PI / 2.3]) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.11), vaneM); v.rotation.x = Math.PI / 2; v.rotation.y = rz; v.position.z = -0.042; v.castShadow = true; brush.add(v);
  }
  const loadM = new THREE.MeshStandardMaterial({ color: '#f3ecd8', roughness: 0.55 });
  const load = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 9), loadM); load.scale.set(0.9, 0.9, 2.1); load.position.z = -0.008; brush.add(quill, load);
  const flick = { t: 0 };

  hand.human.root.position.set(0, 0, 0); hand.human.root.updateMatrixWorld(true);
  const shoulder0 = hand.human.bonePosition('R_UpperArm', new THREE.Vector3()).clone();
  const UP = new THREE.Vector3(0, 1, 0), u = new THREE.Vector3(), shoulderW = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
  const wrist = new THREE.Vector3(), dir = new THREE.Vector3(), elbow = new THREE.Vector3(), tipBone = new THREE.Vector3(), err = new THREE.Vector3(), palmDir = new THREE.Vector3();
  const tipNow = new THREE.Vector3(), tipVel = new THREE.Vector3(), target = new THREE.Vector3();
  const FINGER_LEN = 0.168, GRIP_BACK = 0.075;
  let presence = 0, presT = 0, started = false, hold = 0, press = 0, color = 1;
  const approachBase = new THREE.Vector3(-0.72, 0.42, -0.55).normalize(), approachFlat = new THREE.Vector3(-0.9, 0.12, -0.42).normalize();
  let flat = 0;

  const ARM = ['R_Clavicle', 'R_UpperArm', 'R_Forearm', 'R_Hand'], filt = new Map();
  const shoulderLP = new THREE.Vector3();
  const corr = new THREE.Vector3();   // learned offset between the commanded wrist and the pinch point: converges smoothly over frames, no inner loop
  function pose(t, lift, sway) {
    dir.copy(approachBase).lerp(approachFlat, flat); dir.x += sway * 0.05; dir.y += (1 - press) * 0.1; dir.normalize();
    palmDir.set(-0.15, -0.45, -0.88).normalize();
    wrist.copy(t).addScaledVector(dir, -(GRIP_BACK + FINGER_LEN)).add(corr);
    shoulderW.copy(wrist).addScaledVector(dir, -0.36).add(new THREE.Vector3(0.0, -0.06, 0.12));
    hand.human.root.position.copy(shoulderW).sub(shoulder0); hand.human.root.updateMatrixWorld(true);
    elbow.copy(wrist).add(new THREE.Vector3(0.3, -0.34, 0.18));
    hand.place({ wrist, fingers: dir, palmDir, elbowHint: elbow }); hand.update(0.03);
    // low-pass the solved arm rotations across frames (the IK solver carries ~0.5 degree of frame-to-frame noise)
    for (const n of ARM) {
      const bn = hand.human.bones[`Bip01_${n}`]; if (!bn) continue;
      let f = filt.get(n);
      if (!f || !started) { f = bn.quaternion.clone(); filt.set(n, f); } else { f.slerp(bn.quaternion, 0.35); bn.quaternion.copy(f); }
    }
    hand.human.root.updateMatrixWorld(true);
    // where did the pinch point land? nudge the learned offset toward the grip point (slowly: no frame-to-frame jitter)
    hand.human.bonePosition('R_Finger12', tipBone); tipBone.addScaledVector(dir, 0.012);
    err.copy(t).addScaledVector(dir, -GRIP_BACK).sub(tipBone);
    const el = err.length();
    if (el > 0.05) err.setLength(0.05);
    if (el > 0.004) corr.addScaledVector(err, 0.06); if (corr.length() > 0.12) corr.setLength(0.12);
    u.copy(shoulderW).sub(wrist).normalize();
    clip.normal.copy(u).negate(); clip.constant = u.dot(wrist) + 0.27;
    sleeve.position.copy(wrist).addScaledVector(u, 0.12 + 0.7); sleeve.quaternion.setFromUnitVectors(UP, u); sleeve.visible = !window.__dbgNoSleeve;
    cuff.position.copy(wrist).addScaledVector(u, 0.12); cuff.quaternion.setFromUnitVectors(Z, u); cuff.visible = !window.__dbgNoSleeve;
    bangles.forEach((b, k) => { b.position.copy(wrist).addScaledVector(u, 0.035 + k * 0.012); b.quaternion.setFromUnitVectors(Z, u); b.visible = true; });
    // brush tip exactly at the target, its axis along the hand's direction (a touch steeper while pressing)
    brush.position.copy(t).addScaledVector(dir, 0.0); brush.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir.clone().negate());
    brush.visible = true;
    api.dbg = { wrist: wrist.clone(), dir: dir.clone(), shoulder: shoulderW.clone(), t: t.clone(), u: u.clone() };
  }

  const api = {
    hand, brush, tip: new THREE.Vector3(),
    // tip: {x,y,z?} world point on the wall or null; color: pigment id loaded on the brush; delta: seconds
    update(tip, dt, clock, o = {}) {
      const want = tip ? 1 : 0;
      hold = tip ? 0.45 : Math.max(0, hold - dt);
      const goal = (want || hold > 0) ? 1 : 0;
      presT += clamp(goal - presT, -dt * 1.5, dt * 2.2);   // seconds-scale ramps: the hand glides in and out, never snaps
      presence = ease(clamp(presT, 0, 1));
      color = o.color || color; flat = o.flat ? 1 : 0;
      loadM.color.set(color === 1 ? '#f3ecd8' : color === 2 ? '#2b2420' : color === 3 ? '#a8442a' : '#f3ecd8');
      if (presence < 0.02) { hand.object.visible = false; sleeve.visible = false; cuff.visible = false; brush.visible = false; bangles.forEach((b) => { b.visible = false; }); started = false; return; }
      if (tip) {
        target.set(tip.x, tip.y, 0.012);
        if (!started) { tipNow.copy(target); tipVel.set(0, 0, 0); started = true; }
        // exact critically damped spring toward the target (stable at any frame rate)
        const w = o.raw ? 1e4 : 24, ex = Math.exp(-w * dt);
        for (const k of ['x', 'y', 'z']) {
          const e = tipNow[k] - target[k], tmp = (tipVel[k] + w * e) * dt;
          tipNow[k] = target[k] + (e + tmp) * ex; tipVel[k] = (tipVel[k] - w * tmp) * ex;
        }
        press += (1 - press) * clamp(dt * 14, 0, 1);
      } else press += (0 - press) * clamp(dt * 8, 0, 1);
      // lifted away between strokes: hover off the wall toward the lower right
      const away = (1 - ease(presence));
      const hover = (1 - ease(press)) * 0.06 + away * 0.18;
      const t = new THREE.Vector3(tipNow.x + away * 0.5, tipNow.y - away * 0.42, 0.012 + hover + away * 0.12);
      pose(t, 1 - press, Math.sin(clock * 1.7) * (1 - press));
      api.tip.set(tipNow.x, tipNow.y, 0.012);
      hand.object.visible = true;
    },
    get speed() { return tipVel.length(); },
  };
  return api;
}
