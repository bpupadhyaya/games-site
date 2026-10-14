// One arm: a real human hand + forearm (view3d athlete rig through hand3d.js) inside a kimono sleeve. Used by the in-game hands and by the
// icon render so both look identical. The rest of the body is clipped away with a box of clipping planes around the wrist.
import * as V3D from '../vendor3d/index.js';
import { createHand } from './hand3d.js';
import * as B from '../vendor3d/board3d.js';

export const HAND_SCALE = 1.3 / 0.9;           // world units per metre (a cell is ~0.9 m) with hands drawn 1.3x for readability

export function furisodeTexture(THREE, base = '#8c1f3f') {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, base); g.addColorStop(1, base); x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < S; i += 4) x.fillRect(i, 0, 2, S);       // silk twill
  let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 16; k++) {                                                             // little cherry blossoms
    const cx = r() * S, cy = r() * S * 0.8, rr = 6 + r() * 6;
    for (const dx of [-S, 0, S]) {
      x.fillStyle = 'rgba(255,236,240,0.88)';
      for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; x.beginPath(); x.arc(cx + dx + Math.cos(a) * rr * 0.8, cy + Math.sin(a) * rr * 0.8, rr * 0.55, 0, 7); x.fill(); }
      x.fillStyle = '#e0b850'; x.beginPath(); x.arc(cx + dx, cy, rr * 0.28, 0, 7); x.fill();
    }
  }
  x.fillStyle = '#e0b850'; x.fillRect(0, S * 0.88, S, S * 0.04);
  x.fillStyle = 'rgba(255,245,225,0.95)'; x.fillRect(0, S * 0.94, S, S * 0.06);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export async function createArm(THREE, side, { skin = 'light', cloth = '#9a2a4a' } = {}) {
  const hand = await createHand(V3D, { side, skin, character: 'athlete_f', preset: 'flat' });
  hand.object.scale.setScalar(HAND_SCALE);
  const planes = [0, 1, 2, 3, 4, 5].map(() => new THREE.Plane(new THREE.Vector3(1, 0, 0), 0));
  hand.human.root.traverse((o) => {
    if (!o.isMesh) return;
    // the loader caches materials across humans: give this arm its own so its clipping planes are its own
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.clippingPlanes = planes; });
    o.frustumCulled = false;
  });

  // sleeve: a tube from the wrist toward the elbow that closes in a soft dome, plus the hanging tamoto panel
  const clothTex = furisodeTexture(THREE, cloth);
  const silk = new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.62, metalness: 0, side: THREE.DoubleSide });
  const prof = [];
  for (let i = 0; i <= 12; i++) { const u = i / 12; prof.push([0.086 + u * 0.03 + u * u * 0.035, -0.035 + u * 1.05]); }
  prof.push([0.152, 1.02], [0.125, 1.07], [0.075, 1.1], [0.0, 1.115]);
  const group = new THREE.Group();
  const tube = new THREE.Mesh(B.lathe(prof, 28), silk); tube.castShadow = true; tube.receiveShadow = true; group.add(tube);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.015, 8, 28), new THREE.MeshStandardMaterial({ color: 0xf6efe0, roughness: 0.55 }));
  cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.035; group.add(cuff);
  const tamoto = new THREE.Group();
  const panel = new THREE.Mesh(B.roundedBox(0.34, 0.5, 0.06, 0.025, 4), silk); panel.castShadow = true; panel.receiveShadow = true; panel.position.set(0, -0.22, 0);
  tamoto.add(panel);
  const hemEdge = new THREE.Mesh(B.roundedBox(0.343, 0.045, 0.063, 0.018, 3), new THREE.MeshStandardMaterial({ color: 0xe0b850, roughness: 0.5, metalness: 0.4 }));
  hemEdge.position.set(0, -0.45, 0); tamoto.add(hemEdge);
  const root = new THREE.Group(); root.add(group, tamoto);

  const st = { wrist: new THREE.Vector3(), prev: new THREE.Vector3(), swing: [0, 0, 0, 0], a: new THREE.Vector3(0, 1, 0), pole: new THREE.Vector3() };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), swQ = new THREE.Quaternion(), swE = new THREE.Euler();
  const UP = new THREE.Vector3(0, 1, 0), NEG_UP = new THREE.Vector3(0, -1, 0);
  const sd = side === 'L' ? -1 : 1;

  // Pose the arm: wrist target (world units), palm down, fingers pointing along dirF. press 0..1 flattens the fingers. iterations: IK passes.
  function pose(wrist, { dirF = new THREE.Vector3(sd * 0.08, -0.12, -1), press = 0, pat = 0, dt = 1 / 60, iters = 3, clock = 0, shoulder = null } = {}) {
    const hum = hand.human;
    st.wrist.copy(wrist);
    const sh0 = hum.bonePosition(`${side}_UpperArm`, tmpA).clone();
    const so = shoulder || tmpC.set(sd * 0.16, 0.42, 0.5);
    const want = tmpB.set(wrist.x + so.x, wrist.y + so.y, wrist.z + so.z);
    hand.object.position.add(want.sub(sh0));
    hand.object.updateMatrixWorld(true);
    dirF = dirF.clone().normalize();
    const q = V3D.handQuat(hum, side, NEG_UP, dirF);
    st.pole.set(wrist.x + so.x * 2.2, wrist.y + so.y * 0.6, wrist.z + so.z * 0.9);
    hum.setReach(side, wrist, { weight: 1, pole: st.pole, quat: q });
    const curl = 0.28 * (1 - press) + 0.1 * pat;
    hand.setPose({ thumb: 0.18 + 0.2 * (1 - press), index: curl * 0.7, middle: curl * 0.8, ring: curl * 0.95, pinky: curl * 1.1, spread: 0.18 + 0.12 * (1 - press), thumbOut: 0.35 });
    for (let k = 0; k < iters; k++) hum.update(dt / iters);
    hum.root.updateMatrixWorld(true);
    const w = hum.bonePosition(`${side}_Hand`, tmpA).clone(), el = hum.bonePosition(`${side}_Forearm`, tmpB).clone();
    const a = el.sub(w).normalize();
    st.a.copy(a);
    // keep a box of the wrist's neighbourhood (fingers forward, a short bit of forearm back), cut everything else of the body away
    const u = new THREE.Vector3().crossVectors(a, UP); if (u.lengthSq() < 1e-4) u.set(1, 0, 0); u.normalize();
    const v = new THREE.Vector3().crossVectors(a, u).normalize();
    const set = (i, n, d) => { planes[i].normal.copy(n); planes[i].constant = d; };       // visible where n.p + d >= 0
    set(0, a.clone().negate(), a.dot(w) + 0.12);   // beyond the cuff toward the elbow
    set(1, a.clone(), -a.dot(w) + 0.42);            // far beyond the fingertips
    set(2, u.clone(), -u.dot(w) + 0.2); set(3, u.clone().negate(), u.dot(w) + 0.2);
    set(4, v.clone(), -v.dot(w) + 0.2); set(5, v.clone().negate(), v.dot(w) + 0.2);
    group.position.copy(w).addScaledVector(a, 0.0);
    group.quaternion.setFromUnitVectors(UP, a);
    // tamoto hangs from the sleeve's middle, always toward world down, swinging with the wrist's motion
    const mid = w.clone().addScaledVector(a, 0.62);
    tamoto.position.copy(mid);
    const vx = (wrist.x - st.prev.x) / Math.max(dt, 1e-3), vz = (wrist.z - st.prev.z) / Math.max(dt, 1e-3);
    st.swing[1] += (-(vx * 0.4) - st.swing[0] * 30 - st.swing[1] * 5) * dt; st.swing[0] += st.swing[1] * dt;
    st.swing[3] += (-(vz * 0.4) - st.swing[2] * 30 - st.swing[3] * 5) * dt; st.swing[2] += st.swing[3] * dt;
    // the hanging panel is aligned with the arm's horizontal direction and always hangs toward world down, swinging sideways and along
    const yaw = Math.atan2(-a.z, a.x) * 1 + 0, hq = swQ.setFromEuler(swE.set(0, Math.atan2(a.x, a.z) - Math.PI / 2, 0));
    const sw = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.max(-0.6, Math.min(0.6, -st.swing[2])) + 0.03 * Math.sin(clock * 1.3), 0, Math.max(-0.6, Math.min(0.6, st.swing[0])) + 0.02 * Math.sin(clock * 1.7)));
    tamoto.quaternion.copy(hq).multiply(sw);
    st.prev.copy(wrist);
    return { wrist: w, a };
  }
  // fade the whole arm (skin + cloth) in or out: k 0..1
  const fadeMats = [];
  hand.human.root.traverse((o) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => fadeMats.push(m)); });
  root.traverse((o) => { if (o.isMesh) fadeMats.push(o.material); });
  let lastK = 1;
  function fade(k) {
    k = Math.max(0, Math.min(1, k));
    if (Math.abs(k - lastK) < 0.004) return;
    lastK = k;
    for (const m of fadeMats) { m.transparent = k < 0.999; m.opacity = k; m.depthWrite = k > 0.5; }
  }
  function setVisible(v) { hand.object.visible = v; root.visible = v; }
  return { hand, root, object: hand.object, pose, setVisible, fade, state: st, silk };
}
