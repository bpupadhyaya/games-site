// One arm: a modelled woman's hand + forearm (handmesh.js, one surface meshed once and shared by both arms; the left is the right
// mirrored) inside a kimono sleeve. Used by the in-game hands and by the icon render so both look identical.
// The hand is rigid in its laid-flat pose; it is placed by its palm contact point (the middle of the palm's underside) so the palm and
// finger pads rest ON the mat, and a pat tips the fingers up from the wrist. The sleeve runs along the modelled forearm from a cuff
// a few centimetres above the wrist, with the hanging tamoto panel swinging against the wrist's motion.
import { buildHandGeometry, skinMaterial, nailMaterial } from './handmesh.js';
import * as B from '../vendor3d/board3d.js';

export const HAND_SCALE = 1.3 / 0.9;           // world units per metre (a cell is ~0.9 m) with hands drawn 1.3x for readability
const CUFF_S = 0.062;                            // the sleeve's cuff sits this far up the forearm from the wrist centre (m)

let shared = null;
function sharedHand(opts) {
  if (!shared) {
    shared = buildHandGeometry(opts).then((H) => {
      // the palm contact point: the middle of the palm at the lowest point of the palm + finger pads (hand frame, m)
      const P = H.geometry.attributes.position.array;
      let yMin = Infinity;
      for (let i = 0; i < P.length; i += 3) if (P[i] > 0.02 && P[i] < 0.19 && P[i + 1] < yMin) yMin = P[i + 1];
      H.contact = [0.06, yMin, 0.002];
      H.skinMat = skinMaterial(); H.nailMat = nailMaterial();
      return H;
    });
  }
  return shared;
}

export function furisodeTexture(THREE, base = '#8c1f3f') {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, S, S);
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

export async function createArm(THREE, side, { cloth = '#9a2a4a', voxel } = {}) {
  const H = await sharedHand(voxel ? { voxel } : {});
  const S = HAND_SCALE, mir = side === 'L' ? -1 : 1;
  // hand: own materials (fade per arm), shared geometry; the left hand mirrors the little-finger axis
  const skin = H.skinMat.clone(), nailM = H.nailMat.clone();
  skin.onBeforeCompile = H.skinMat.onBeforeCompile; skin.customProgramCacheKey = H.skinMat.customProgramCacheKey;
  const hand = new THREE.Group();
  const mesh = new THREE.Mesh(H.geometry, skin), nails = new THREE.Mesh(H.nailGeometry, nailM);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = nails.frustumCulled = false;
  hand.add(mesh, nails); hand.scale.set(S, S, S * mir);

  // sleeve: a tube from the cuff toward the elbow that closes in a soft dome, plus the hanging tamoto panel
  const clothTex = furisodeTexture(THREE, cloth);
  const silk = new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.62, metalness: 0, side: THREE.DoubleSide });
  const prof = [];
  // long enough that its far end (toward the shoulder) stays out of the play view; a soft taper closes it
  for (let i = 0; i <= 16; i++) { const u = i / 16; prof.push([0.068 + u * 0.05 + u * u * 0.02, -0.035 + u * 1.6]); }
  prof.push([0.13, 1.62], [0.1, 1.68], [0.05, 1.71], [0.0, 1.72]);
  const group = new THREE.Group();
  const tube = new THREE.Mesh(B.lathe(prof, 28), silk); tube.castShadow = true; tube.receiveShadow = true; group.add(tube);
  // the white under-kimono cuff, fitted round the oval forearm
  const r0 = H.armRadii(CUFF_S);
  const cuffMat = new THREE.MeshStandardMaterial({ color: 0xf6efe0, roughness: 0.55, side: THREE.DoubleSide });
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 8, 28), cuffMat);
  cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.03; cuff.scale.set((r0.rz + 0.008) * S, (r0.ry + 0.008) * S, 0.06); group.add(cuff);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), cuffMat);   // the inner sleeve between cuff and silk
  under.scale.set((r0.rz + 0.006) * S, 0.04, (r0.ry + 0.006) * S); under.position.y = -0.01; group.add(under);
  const tamoto = new THREE.Group();
  const panel = new THREE.Mesh(B.roundedBox(0.34, 0.5, 0.06, 0.025, 4), silk); panel.castShadow = true; panel.receiveShadow = true; panel.position.set(0, -0.22, 0);
  tamoto.add(panel);
  const hemEdge = new THREE.Mesh(B.roundedBox(0.343, 0.045, 0.063, 0.018, 3), new THREE.MeshStandardMaterial({ color: 0xe0b850, roughness: 0.5, metalness: 0.4 }));
  hemEdge.position.set(0, -0.45, 0); tamoto.add(hemEdge);
  // soft contact shadow under the palm and fingers (the shadow map is too coarse at hand size to ground the pads on the rush)
  const shCan = document.createElement('canvas'); shCan.width = shCan.height = 64; {
    const x = shCan.getContext('2d'), g = x.createRadialGradient(32, 32, 1, 32, 32, 31);
    g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.45, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  }
  const shTex = new THREE.CanvasTexture(shCan);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shTex, color: 0x1e0e04, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  shadow.scale.set(0.27 * S, 1, 0.12 * S); shadow.renderOrder = 1;
  const root = new THREE.Group(); root.add(group, tamoto, shadow);

  const st = { wrist: new THREE.Vector3(), prev: new THREE.Vector3(), swing: [0, 0, 0, 0], a: new THREE.Vector3(0, 1, 0) };
  const UP = new THREE.Vector3(0, 1, 0), C = new THREE.Vector3(H.contact[0], H.contact[1], H.contact[2] * mir).multiplyScalar(S);
  const q = new THREE.Quaternion(), qt = new THREE.Quaternion(), m4 = new THREE.Matrix4(), F = new THREE.Vector3(), Bk = new THREE.Vector3(), Zs = new THREE.Vector3();
  const O = new THREE.Vector3(), tmp = new THREE.Vector3(), swQ = new THREE.Quaternion(), swE = new THREE.Euler(), sw = new THREE.Quaternion(), swE2 = new THREE.Euler();
  const sd = side === 'L' ? -1 : 1;

  // Pose the arm: contact = world point under the middle of the palm (on the mat's top), fingers pointing along dirF (horizontal part),
  // tilt = radians the fingers tip up from the wrist (a pat), lift = world units the hand is raised.
  function pose(contact, { dirF = new THREE.Vector3(sd * 0.08, 0, -1), tilt = 0, lift = 0, dt = 1 / 60, clock = 0, surface = null } = {}) {
    F.set(dirF.x, 0, dirF.z).normalize(); Bk.copy(UP); Zs.crossVectors(F, Bk);
    m4.makeBasis(F, Bk, Zs); q.setFromRotationMatrix(m4);
    O.copy(C).applyQuaternion(q).negate().add(contact); O.y += lift;
    // the pat: the hand turns about the wrist's side-to-side axis, fingers up
    qt.setFromAxisAngle(Zs, tilt); q.premultiply(qt);
    hand.position.copy(O); hand.quaternion.copy(q);
    st.wrist.copy(O);
    // the forearm in the world (the modelled forearm is rigid with the hand); mirror its little-finger component for the left hand
    const a = st.a.set(H.forearm.axis.x, H.forearm.axis.y, H.forearm.axis.z * mir).applyQuaternion(q);
    group.position.copy(O).addScaledVector(a, CUFF_S * S);
    group.quaternion.setFromUnitVectors(UP, a);
    // tamoto hangs from the sleeve's middle, always toward world down, swinging with the wrist's motion
    tamoto.position.copy(O).addScaledVector(a, 0.66);
    const vx = (O.x - st.prev.x) / Math.max(dt, 1e-3), vz = (O.z - st.prev.z) / Math.max(dt, 1e-3);
    st.swing[1] += (-(vx * 0.4) - st.swing[0] * 30 - st.swing[1] * 5) * dt; st.swing[0] += st.swing[1] * dt;
    st.swing[3] += (-(vz * 0.4) - st.swing[2] * 30 - st.swing[3] * 5) * dt; st.swing[2] += st.swing[3] * dt;
    swQ.setFromEuler(swE.set(0, Math.atan2(a.x, a.z) - Math.PI / 2, 0));
    sw.setFromEuler(swE2.set(Math.max(-0.6, Math.min(0.6, -st.swing[2])) + 0.03 * Math.sin(clock * 1.3), 0, Math.max(-0.6, Math.min(0.6, st.swing[0])) + 0.02 * Math.sin(clock * 1.7)));
    tamoto.quaternion.copy(swQ).multiply(sw);
    // the contact shadow lies on the surface under the palm + fingers, fading as the hand rises
    const sy = surface == null ? contact.y : surface, h = Math.max(0, contact.y + lift - sy);
    shadow.position.copy(contact).addScaledVector(F, 0.035 * S); shadow.position.y = sy + 0.002;
    shadow.rotation.set(0, Math.atan2(-F.z, F.x), 0);
    shadow.material.opacity = shOp * Math.max(0, 1 - h / 0.14) * (1 - 0.35 * Math.min(1, Math.abs(tilt) / 0.3));
    st.prev.copy(O);
    return { wrist: O, a };
  }
  // world positions for measurement: wrist centre, a point 26 cm up the forearm (elbow), middle finger tip
  function joints() {
    const tip = tmp.set(H.tip.x * S, H.tip.y * S, H.tip.z * S * mir).applyQuaternion(hand.quaternion).add(hand.position).toArray();
    return { wrist: hand.position.toArray(), elbow: hand.position.clone().addScaledVector(st.a, 0.26 * S).toArray(), tip };
  }
  // fade the whole arm (skin + cloth) in or out: k 0..1
  const fadeMats = [skin, nailM];
  let shOp = 0.7;
  root.traverse((o) => { if (o.isMesh && !fadeMats.includes(o.material)) fadeMats.push(o.material); });
  let lastK = 1;
  function fade(k) {
    k = Math.max(0, Math.min(1, k));
    if (Math.abs(k - lastK) < 0.004) return;
    lastK = k;
    for (const m of fadeMats) { if (m === shadow.material) continue; m.transparent = k < 0.999; m.opacity = k; m.depthWrite = k > 0.5; }
    shOp = 0.7 * k;
  }
  function setVisible(v) { hand.visible = v; root.visible = v; }
  return { hand, root, object: hand, pose, joints, setVisible, fade, state: st, silk, stats: H.stats };
}
