// The thrower: a real athlete_m (view3d / Rocketbox) dressed as a Boyacá villager: a felt-and-straw sombrero, a striped wool ruana over
// the shoulders, plain linen shirt, dark trousers rolled at the calf and rope-soled alpargatas. He pitches an underarm throw with the
// weight carried onto the front foot. Cloth (the ruana hem) lags the body with a damped spring. Everything is simple shapes.
import { loadHuman, buildClip, addThrowClips, limbCapsuleGeometry, THREE, board3d as B } from '../vendor3d/index.js';

const along = (geo) => { geo.rotateZ(-Math.PI / 2); return geo; };           // cylinder axis Y -> +X (bone-local limb axis)
const mat = (c, r = 0.85, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

function stripeTexture(a, b, c) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d');
  x.fillStyle = a; x.fillRect(0, 0, 256, 64);
  const bands = [[0, 10, b], [14, 6, c], [26, 20, b], [50, 5, c], [58, 6, b]];
  for (const [y, h, col] of bands) { x.fillStyle = col; x.fillRect(0, y, 256, h); }
  for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(${(i * 7) % 2 ? '255,240,220' : '20,10,4'},${0.04 + ((i * 13) % 10) * 0.01})`; x.fillRect((i * 37) % 256, (i * 11) % 64, 1 + (i % 3), 1); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

export async function createThrower({ lod = 0 } = {}) {
  const h = await loadHuman({ character: 'athlete_m', kit: { top: '#ece5d2', bottoms: '#2a2723', socks: '#d8cdb0' }, skin: 'tan', hair: 'black', lod });
  addThrowClips(h);
  h.groundClamp = 'auto'; h.footPlanting = true;
  const Bn = h.bones, len = (n) => { const b = Bn[n]; return b ? (b.position.length() || 0.35) : 0.35; };
  const parts = [];
  const add = (bone, mesh) => { Bn[bone].add(mesh); parts.push(mesh); return mesh; };

  // trousers: long straight legs over the shorts, a cuff at the calf; alpargatas: cream rope soles
  for (const s of ['L', 'R']) {
    const tl = len(`Bip01_${s}_Calf`), th = len(`Bip01_${s}_Foot`) || 0.42;
    const thighLen = tl;                                                       // child of Thigh is Calf: its offset is the thigh length
    const trouser = new THREE.Mesh(along(limbCapsuleGeometry(0.117, 0.094, thighLen)), mat('#2d2a26', 0.9)); add(`Bip01_${s}_Thigh`, trouser);
    const calf = new THREE.Mesh(along(limbCapsuleGeometry(0.094, 0.074, th * 0.97)), mat('#2d2a26', 0.9)); add(`Bip01_${s}_Calf`, calf);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.096, 14, 10), mat('#2d2a26', 0.9)); add(`Bip01_${s}_Calf`, knee);
  }
  // ruana: a short wool cape over both shoulders, open at the front, with a cut-out neck; attached to the upper spine
  const ruanaTex = stripeTexture('#7a2a1e', '#d9c9a0', '#2a2a30');
  const ruanaMat = new THREE.MeshStandardMaterial({ map: ruanaTex, roughness: 0.95, side: THREE.DoubleSide });
  const ruana = new THREE.Group();
  const capeGeo = new THREE.CylinderGeometry(0.19, 0.29, 0.42, 28, 5, true, 0.85, Math.PI * 2 - 1.7);   // open to the front
  const cape = new THREE.Mesh(capeGeo, ruanaMat); cape.position.y = -0.15; cape.castShadow = true; ruana.add(cape);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.034, 8, 24), ruanaMat); collar.rotation.x = Math.PI / 2; collar.position.y = 0.05; ruana.add(collar);
  // spine bone local: +X up the body; the cape is built Y-up, so rotate it into the bone's frame and sit it at the shoulders
  ruana.rotation.z = -Math.PI / 2; ruana.position.set(0.1, 0, 0);
  Bn.Bip01_Spine2.add(ruana); parts.push(ruana);
  // sombrero: a straw crown with a dark band and a wide gently curved brim
  const hat = new THREE.Group();
  const straw = mat('#d8bf86', 0.8), band = mat('#1c1713', 0.7);
  const crown = new THREE.Mesh(B.lathe([[0, 0.135], [0.062, 0.135], [0.082, 0.12], [0.088, 0.05], [0.092, 0.0]], 28), straw); hat.add(crown);
  const brim = new THREE.Mesh(B.lathe([[0.09, 0.0], [0.17, -0.004], [0.24, 0.006], [0.27, 0.026], [0.27, 0.034], [0.24, 0.016], [0.17, 0.008], [0.09, 0.01]], 36), straw); hat.add(brim);
  const bandM = new THREE.Mesh(new THREE.CylinderGeometry(0.0905, 0.0925, 0.036, 24, 1, true), band); bandM.position.y = 0.022; hat.add(bandM);
  hat.rotation.z = -Math.PI / 2; hat.position.set(0.1, 0, 0); hat.rotation.x = 0.0;
  Bn.Bip01_Head.add(hat); parts.push(hat);
  for (const m of parts) m.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // the disc held in the right hand
  const hold = new THREE.Group(); Bn.Bip01_R_Hand.add(hold);

  // ---- the pitch: side-on, a deep bend, the arm swung back then forward in one pendulum, release low in front of the hip, a lunge onto the front foot
  const arm = (flex, abd = 6, fore = 10, tw = 0) => ({ R_UpperArm: { flex, abduct: abd, twist: tw }, R_Forearm: { flex: fore } });
  const stance = { Pelvis: { twist: -20, flex: 6, pos: [0, -0.05, 0] }, Spine1: { twist: -8, flex: 14 }, Spine2: { flex: 6 }, Neck: { flex: -10 }, Head: { flex: -4 },
    L_Thigh: { flex: 20, abduct: 3 }, L_Calf: { flex: 24 }, R_Thigh: { flex: -6 }, R_Calf: { flex: 16 }, ...arm(18, 6, 18), L_UpperArm: { flex: 20, abduct: 14 }, L_Forearm: { flex: 24 } };
  const back = { Pelvis: { twist: -30, flex: 12, pos: [0, -0.1, -0.03] }, Spine1: { twist: -16, flex: 22 }, Spine2: { flex: 8 }, Neck: { flex: -16 }, Head: { flex: -6 },
    L_Thigh: { flex: 26, abduct: 3 }, L_Calf: { flex: 34 }, R_Thigh: { flex: -4 }, R_Calf: { flex: 26 }, ...arm(-48, 8, 16), L_UpperArm: { flex: 34, abduct: 24 }, L_Forearm: { flex: 20 } };
  const release = { Pelvis: { twist: 16, flex: 18, pos: [0, -0.16, 0.14] }, Spine1: { twist: 14, flex: 30 }, Spine2: { flex: 10, twist: 8 }, Neck: { flex: -22 }, Head: { flex: -8 },
    L_Thigh: { flex: 52, abduct: 4 }, L_Calf: { flex: 38 }, R_Thigh: { flex: -22 }, R_Calf: { flex: 14 }, ...arm(56, 6, 6), L_UpperArm: { flex: -10, abduct: 38 }, L_Forearm: { flex: 14 } };
  const follow = { Pelvis: { twist: 24, flex: 14, pos: [0, -0.12, 0.17] }, Spine1: { twist: 20, flex: 20 }, Spine2: { flex: 6, twist: 10 }, Neck: { flex: -14 }, Head: { flex: -4 },
    L_Thigh: { flex: 44, abduct: 4 }, L_Calf: { flex: 30 }, R_Thigh: { flex: -16 }, R_Calf: { flex: 22 }, ...arm(104, 10, 22), L_UpperArm: { flex: 0, abduct: 44 }, L_Forearm: { flex: 12 } };
  const clip = buildClip(h, {
    name: 'tejo_pitch', duration: 1.9, base: 'idle', smoothTrunk: false, fingerHands: { R: 'ballGrip', L: 'relaxed' },
    keys: [
      { t: 0.00, pose: stance },
      { t: 0.55, ease: 'inOut', pose: back },
      { t: 0.85, ease: 'in', pose: release },
      { t: 1.15, ease: 'out', pose: follow },
      { t: 1.9, ease: 'inOut', pose: stance },
    ],
    events: { release: 0.85 },
  });
  h.addClip(clip);
  const ready = buildClip(h, {
    name: 'tejo_ready', duration: 2.4, loop: true, base: 'idle', smoothTrunk: false, fingerHands: { R: 'ballGrip', L: 'relaxed' },
    keys: [{ t: 0, pose: stance }, { t: 1.2, ease: 'inOut', pose: { ...stance, Spine1: { twist: -8, flex: 16 }, Pelvis: { twist: -20, flex: 7, pos: [0, -0.06, 0] } } }, { t: 2.4, ease: 'inOut', pose: stance }],
  });
  h.addClip(ready);
  h.play('tejo_ready', { fade: 0 });

  const T = { human: h, root: h.root, hold, clip, parts, ruana, cape, hat };
  // secondary motion: the cape hem and hat lag the torso (a damped spring on the torso's yaw rate)
  let lastYaw = 0, vel = 0, sway = 0, swayV = 0;
  T.update = (dt) => {
    h.update(dt);
    const q = Bn.Bip01_Spine2.getWorldQuaternion(new THREE.Quaternion()), e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    const rate = dt > 0 ? (e.y - lastYaw) / dt : 0; lastYaw = e.y;
    vel = rate * 0.15;
    swayV += (-sway * 60 - swayV * 9 + vel * 12) * dt; sway += swayV * dt; sway = Math.max(-0.35, Math.min(0.35, sway));
    cape.rotation.z = sway * 0.6; cape.rotation.x = -sway * 0.3;
  };
  return T;
}
