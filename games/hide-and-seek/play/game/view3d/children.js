// Six real 3D children (view3d athletes with a CHILD body: shorter legs and arms, shorter neck, bigger head, rounder proportions
// through bone scales; plus clothes and accessories built from simple shapes). Locomotion is distance driven: the stride phase comes
// from the ground actually covered, the facing follows the velocity, and a figure that is asked to be somewhere far away runs there at
// a child's speed instead of sliding. Nothing here ever writes to the sim.
import { THREE, B, mat, clothM, put, box, rbox, cyl, sph, lathe, rngSeed, rnd, TAU, clamp } from './kit.js';
import { loadHuman, buildClip } from '../vendor3d/index.js';
import { buildKidHead, hideAdultHead } from './kidhead.js';

export const CH = 0.74;            // 1.80 m athlete -> about 1.30 m child (a seven to nine year old)
const VMAX = 5.6;                   // m/s, a child at a full sprint
const ACC = 16;                     // m/s^2

// proportions of a child relative to the scaled adult: shorter legs/arms, short neck, larger rounder head, small hands/feet
const PROP = {
  Bip01_L_Thigh: [0.8, 1.0, 1.0], Bip01_R_Thigh: [0.8, 1.0, 1.0],
  Bip01_L_UpperArm: [0.8, 1.0, 1.0], Bip01_R_UpperArm: [0.8, 1.0, 1.0],
  Bip01_Neck: [0.6, 1.0, 1.0],
  Bip01_L_Foot: [1.1, 1.05, 1.05], Bip01_R_Foot: [1.1, 1.05, 1.05],
  Bip01_L_Hand: [0.95, 1, 1], Bip01_R_Hand: [0.95, 1, 1],
  Bip01_Spine: [1.12, 1.0, 1.04], Bip01_Spine1: [1.12, 1.0, 1.02], Bip01_Spine2: [1.08, 1.0, 1.02],
};

// clothes and hair per look (matches art.js KIDS order): kind of top accessory, backpack, skirt, hair style
export const OUTFITS = [
  { cap: '#2d5aa8', pack: null, skirt: null, hair: 'short', shoes: '#f2efe6' },
  { cap: null, pack: null, skirt: '#5a4a8c', hair: 'pigtails', ribbon: '#e8453a', shoes: '#3a2a22' },
  { cap: null, pack: '#2f7ac0', skirt: null, hair: 'short', shoes: '#c8362a' },
  { cap: null, pack: null, skirt: '#8a2c3a', hair: 'bun', ribbon: '#f0c24a', shoes: '#f2efe6' },
  { cap: null, pack: null, skirt: null, hair: 'beanie', beanie: ['#d8453a', '#f1e6c8'], shoes: '#2a3a5a', headHair: 'short' },
  { cap: null, pack: '#e8b53a', skirt: null, hair: 'pony', ribbon: '#2f9c8a', shoes: '#f2efe6' },
];

function authorClips(h) {
  // counting with both hands over the eyes, elbows forward, forehead lowered, a slow breath
  h.addClip(buildClip(h, { name: 'eyes', duration: 2.4, base: 'idle', keys: [
    { t: 0, pose: { Spine1: { flex: 8 }, Neck: { flex: 22 }, Head: { flex: 14 },
      L_UpperArm: { flex: 70, abduct: -14, twist: 24 }, R_UpperArm: { flex: 70, abduct: -14, twist: -24 }, L_Forearm: { flex: 124 }, R_Forearm: { flex: 124 } } },
    { t: 1.2, pose: { Spine1: { flex: 10 }, Neck: { flex: 24 }, Head: { flex: 16 } }, ease: 'inOut' },
    { t: 2.4, pose: { Spine1: { flex: 8 }, Neck: { flex: 22 }, Head: { flex: 14 } }, ease: 'inOut' },
  ], fingers: 'flat' }));
  // peeking round the edge of a hiding place: hands on the edge, leaning in, the head turning slowly to look about
  h.addClip(buildClip(h, { name: 'peek', duration: 3, base: 'idle', keys: [
    { t: 0, pose: { Spine1: { flex: 12, side: 6 }, Neck: { flex: -6, twist: 14 }, Head: { flex: -4, twist: 10, side: 4 },
      L_UpperArm: { flex: 38, abduct: 14 }, R_UpperArm: { flex: 38, abduct: 14 }, L_Forearm: { flex: 58 }, R_Forearm: { flex: 58 } } },
    { t: 1.5, pose: { Spine1: { flex: 13, side: 8 }, Neck: { twist: -16 }, Head: { twist: -12, side: -4 } }, ease: 'inOut' },
    { t: 3, pose: { Spine1: { flex: 12, side: 6 }, Neck: { twist: 14 }, Head: { twist: 10, side: 4 } }, ease: 'inOut' },
  ], fingers: 'relaxed' }));
  // a cheer: both arms up in a V, small bounces, the arms pumping
  h.addClip(buildClip(h, { name: 'cheer2', duration: 0.8, base: 'idle', keys: [
    { t: 0, pose: { Pelvis: { pos: [0, 0, 0] }, Spine1: { flex: -4 }, Head: { flex: -10 }, L_Thigh: { flex: 4 }, R_Thigh: { flex: 4 },
      L_UpperArm: { flex: 10, abduct: 148 }, R_UpperArm: { flex: 10, abduct: 148 }, L_Forearm: { flex: 14 }, R_Forearm: { flex: 14 } } },
    { t: 0.2, pose: { Pelvis: { pos: [0, 0.05, 0] }, L_UpperArm: { abduct: 158 }, R_UpperArm: { abduct: 158 }, L_Calf: { flex: 4 }, R_Calf: { flex: 4 } }, ease: 'out' },
    { t: 0.4, pose: { Pelvis: { pos: [0, 0, 0] }, L_UpperArm: { abduct: 145 }, R_UpperArm: { abduct: 145 }, L_Calf: { flex: 22 }, R_Calf: { flex: 22 }, L_Thigh: { flex: 14 }, R_Thigh: { flex: 14 } }, ease: 'in' },
    { t: 0.6, pose: { Pelvis: { pos: [0, 0.05, 0] }, L_UpperArm: { abduct: 158 }, R_UpperArm: { abduct: 158 }, L_Calf: { flex: 4 }, R_Calf: { flex: 4 }, L_Thigh: { flex: 4 }, R_Thigh: { flex: 4 } }, ease: 'out' },
    { t: 0.8, pose: { Pelvis: { pos: [0, 0, 0] }, L_UpperArm: { abduct: 148 }, R_UpperArm: { abduct: 148 } }, ease: 'in' },
  ], fingers: 'open' }));
  // caught out: a startled lean back with both hands up, then settles
  h.addClip(buildClip(h, { name: 'startle', duration: 0.9, base: 'idle', keys: [
    { t: 0, pose: {} },
    { t: 0.18, pose: { Spine1: { flex: -10 }, Head: { flex: -10 }, L_UpperArm: { flex: 30, abduct: 70 }, R_UpperArm: { flex: 30, abduct: 70 }, L_Forearm: { flex: 70 }, R_Forearm: { flex: 70 }, L_Thigh: { flex: -8 }, R_Thigh: { flex: 6 } }, ease: 'out' },
    { t: 0.9, pose: { Spine1: { flex: -3 }, L_UpperArm: { flex: 20, abduct: 120 }, R_UpperArm: { flex: 20, abduct: 120 }, L_Forearm: { flex: 30 }, R_Forearm: { flex: 30 } }, ease: 'inOut' },
  ], fingers: 'open' }));
}

function childProportions(h) {
  for (const [n, s] of Object.entries(PROP)) { const b = h.bones[n]; if (b) b.scale.set(s[0], s[1], s[2]); }
}

// attach a mesh group to a bone with a given local frame (up, forward, left taken from the rest pose) and offsets in metres
function boneFrames(h) {
  const out = {};
  h.root.updateMatrixWorld(true);
  for (const n of ['Head', 'Spine2', 'Pelvis']) {
    const b = h.bones[`Bip01_${n}`]; if (!b) continue;
    const inv = b.getWorldQuaternion(new THREE.Quaternion()).invert();
    out[n] = { up: new THREE.Vector3(0, 1, 0).applyQuaternion(inv), fwd: new THREE.Vector3(0, 0, 1).applyQuaternion(inv), left: new THREE.Vector3(1, 0, 0).applyQuaternion(inv) };
  }
  return out;
}
function attach(h, boneName, mesh, { up = 0, fwd = 0, left = 0, rot = null } = {}) {
  const b = h.bones[`Bip01_${boneName}`]; if (!b) return null;
  const f = h.frames[boneName];
  const pos = f.up.clone().multiplyScalar(up).addScaledVector(f.fwd, fwd).addScaledVector(f.left, left);
  // basis: mesh +x = left, +y = up, +z = forward  ->  bone-local quaternion
  const m = new THREE.Matrix4().makeBasis(f.left.clone().normalize(), f.up.clone().normalize(), f.fwd.clone().normalize());
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  const holder = new THREE.Group(); holder.position.copy(pos); holder.quaternion.copy(q);
  if (rot) holder.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])));
  holder.add(mesh); b.add(holder);
  return holder;
}

// a tapered cloth tube along a bone toward its child bone (local), from fraction f0 to f1 of the bone length
function sleeve(h, boneName, childName, color, f0, f1, r0, r1, rough = 0.9) {
  const b = h.bones[boneName], c = h.bones[childName]; if (!b || !c) return null;
  const len = c.position.length(), dir = c.position.clone().normalize();
  const g = new THREE.CylinderGeometry(r1, r0, len * (f1 - f0), 16, 1, true);
  const m = new THREE.Mesh(g, mat(color, { rough, side: 1 }));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  m.quaternion.copy(q); m.position.copy(dir).multiplyScalar(len * (f0 + f1) / 2); m.castShadow = true;
  // hem ring
  const hem = new THREE.Mesh(new THREE.TorusGeometry(r1, 0.007, 5, 16), mat(color, { rough }));
  hem.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))); hem.position.copy(dir).multiplyScalar(len * f1);
  const grp = new THREE.Group(); grp.add(m, hem); b.add(grp); return grp;
}

function dressUp(h, look, o) {
  const parts = [];
  // short sleeves and baggy shorts make the adult mesh read as a child in an ordinary t-shirt
  for (const s of ['L', 'R']) {
    sleeve(h, `Bip01_${s}_UpperArm`, `Bip01_${s}_Forearm`, look.shirt, -0.06, 0.5, 0.05, 0.055);
    { const b = h.bones[`Bip01_${s}_UpperArm`]; const cap = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 10), mat(look.shirt, { rough: 0.9 })); cap.scale.set(1, 1, 1); cap.castShadow = true; b.add(cap); }
    if (!o.skirt) sleeve(h, `Bip01_${s}_Thigh`, `Bip01_${s}_Calf`, look.pants, 0.0, 0.72, 0.1, 0.112);
  }
  const hairM = mat(look.hair, { rough: 0.55 });
  const sc = 1 / 1.0;
  const H = h.kidHead;      // head group: +y up, +z forward, centred on the skull (units: bone metres, scaled by the group)
  if (o.cap) {
    const cap = new THREE.Group(), m = mat(o.cap, { rough: 0.7 });
    put(cap, new THREE.Mesh(new THREE.SphereGeometry(0.128, 22, 14, 0, TAU, 0, Math.PI * 0.5), m), 0, 0.045, -0.004).scale.set(1, 1.0, 1.04);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.012, 20, 1, false, -Math.PI * 0.45, Math.PI * 0.9), m);
    brim.rotation.y = Math.PI / 2; brim.position.set(0, 0.05, 0.1); brim.scale.set(1, 1, 1.0); cap.add(brim);
    put(cap, new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), mat('#f1ece0', { rough: 0.8 })), 0, 0.172, 0);
    H.add(cap); parts.push(cap);
  }
  if (o.hair === 'pigtails' || o.hair === 'pony' || o.hair === 'bun') {
    const hairM2 = mat(look.hair, { rough: 0.5 });
    const rib = mat(o.ribbon, { rough: 0.5 });
    if (o.hair === 'pigtails') {
      for (const s of [-1, 1]) {
        const tl = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.15, 4, 10), hairM2); tl.position.set(s * 0.138, -0.02, -0.01); tl.rotation.z = s * 0.2; tl.castShadow = true; H.add(tl);
        put(H, sph(0.03, rib, 8, 6), s * 0.13, 0.065, -0.01);
      }
    } else if (o.hair === 'pony') {
      const tl = new THREE.Mesh(new THREE.CapsuleGeometry(0.033, 0.19, 4, 10), hairM2); tl.position.set(0, -0.0, -0.17); tl.rotation.x = -0.35; tl.castShadow = true; H.add(tl);
      put(H, sph(0.032, rib, 8, 6), 0, 0.085, -0.13);
    } else {
      put(H, sph(0.06, hairM2, 12, 8), 0, 0.15, -0.05); put(H, sph(0.035, rib, 8, 6), 0, 0.11, -0.04);
    }
  }
  if (o.hair === 'beanie') {
    const bn = new THREE.Group();
    put(bn, new THREE.Mesh(new THREE.SphereGeometry(0.13, 22, 14, 0, TAU, 0, Math.PI * 0.5), mat(o.beanie[0], { rough: 0.95 })), 0, 0.045, -0.003).scale.set(1, 1.05, 1.03);
    put(bn, new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.133, 0.05, 22, 1, true), mat(o.beanie[1], { rough: 0.95, side: 1 })), 0, 0.045, -0.003);
    put(bn, sph(0.04, mat(o.beanie[1], { rough: 0.95 }), 8, 6), 0, 0.2, 0);
    H.add(bn); parts.push(bn);
  }
  if (o.pack) {
    const pk = new THREE.Group();
    put(pk, rbox(0.26, 0.3, 0.14, 0.05, mat(o.pack, { rough: 0.7 })), 0, 0, 0);
    put(pk, rbox(0.2, 0.14, 0.05, 0.02, mat('#222', { rough: 0.6 })), 0, -0.04, -0.085);
    for (const s of [-1, 1]) put(pk, box(0.035, 0.3, 0.02, mat('#222', { rough: 0.7 })), s * 0.08, 0.02, 0.075);
    attach(h, 'Spine2', pk, { up: 0.04, fwd: -0.13, left: 0 }); parts.push(pk);
  }
  let skirt = null;
  if (o.skirt) {
    skirt = new THREE.Group();
    put(skirt, lathe([[0.15, 0.05], [0.18, -0.02], [0.225, -0.14], [0.25, -0.27], [0.245, -0.28], [0.215, -0.15], [0.17, -0.03], [0.15, 0.05]], mat(o.skirt, { rough: 0.9, side: 1 }), 28), 0, 0, 0);
    attach(h, 'Pelvis', skirt, { up: 0.0, fwd: 0, left: 0 }); parts.push(skirt);
  }
  return { parts, skirt };
}

export async function createChildren({ stage, looks, base, quality = 'medium', rig = 'athlete' }) {
  const out = [];
  for (let i = 0; i < looks.length; i++) {
    const K = looks[i], O = OUTFITS[i % OUTFITS.length];
    const h = await loadHuman({
      character: K.long ? `${rig}_f` : `${rig}_m`, base, quality: quality === 'low' ? 'low' : quality, lod: quality === 'low' ? 'medium' : 0,
      kit: { top: K.shirt, bottoms: K.pants, socks: '#f2efe6', shoes: O.shoes }, skin: K.skin, hair: K.hair,
    });
    h.groundClamp = 'auto';
    h.frames = boneFrames(h);
    h.root.scale.setScalar(CH);
    childProportions(h);
    authorClips(h);
    hideAdultHead(h);
    const head = buildKidHead({ ...K, iris: K.iris }, { hair: O.headHair || O.hair });
    attach(h, 'Head', head, { up: 0.088, fwd: 0.0, left: 0 });
    h.kidHead = head;
    const dress = dressUp(h, K, O);
    stage.add(h);
    h.root.visible = false;
    const sh = B.contactShadow(0.42, 0.35); h.root.add(sh); sh.scale.setScalar(1 / CH);
    out.push(new Child(h, i, dress, sh));
  }
  return out;
}

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

class Child {
  constructor(h, id, dress, shadow) {
    this.h = h; this.id = id; this.dress = dress; this.shadow = shadow;
    this.x = 0; this.z = 0; this.vx = 0; this.vz = 0; this.yaw = 0; this.have = false; this.clip = ''; this.speed = 0;
    this.cmd = null; this.t = 0; this.pose = ''; this.log = null;
  }
  // cmd: { X, Z, pose, faceX, faceZ, visible }
  set(cmd) { this.cmd = cmd; }
  update(dt, cam, frozen = false) {
    const h = this.h, c = this.cmd;
    if (!c || !c.visible) { h.root.visible = false; this.have = false; this.speed = 0; return; }
    h.root.visible = true;
    if (!this.have || c.snap) { this.x = c.X; this.z = c.Z; this.vx = this.vz = 0; this.have = true; this.yaw = this.faceYaw(c, cam); this.speed = 0; }
    dt = Math.max(0, Math.min(dt, 0.05));
    if (!frozen && dt > 0) {
      // speed-limited chase with smooth start and arrival
      const dx = c.X - this.x, dz = c.Z - this.z, d = Math.hypot(dx, dz);
      const want = d < 0.4 ? Math.max(Math.min(VMAX, d * 7.5), 0.45) : Math.min(VMAX, d * 7.5);
      const wx = d > 1e-4 ? dx / d * want : 0, wz = d > 1e-4 ? dz / d * want : 0;
      const ax = wx - this.vx, az = wz - this.vz, al = Math.hypot(ax, az), lim = ACC * dt;
      if (al > lim) { this.vx += ax / al * lim; this.vz += az / al * lim; } else { this.vx = wx; this.vz = wz; }
      this.x += this.vx * dt; this.z += this.vz * dt;
      if (d < 0.05 && Math.hypot(this.vx, this.vz) < 0.7) { this.x = c.X; this.z = c.Z; this.vx = this.vz = 0; }
    }
    this.speed = Math.hypot(this.vx, this.vz);
    const moving = this.speed > 0.12;
    // facing: velocity heading while moving, the requested point (or the camera, three-quarter) when standing
    let target = moving ? Math.atan2(this.vx, this.vz) : this.faceYaw(c, cam);
    const dy = wrapA(target - this.yaw), rate = moving ? 15 : 5.5;
    this.yaw += dy * (1 - Math.exp(-rate * dt));
    // clip choice
    let clip, fade = 0.22;
    if (moving) {
      const eq = this.speed / CH;            // the speed an adult-sized figure would have: the clips are authored for adults
      if (eq < 2.3) {
        // slow shuffle / start / arrival: the walk cycle slowed to the ground speed (cadence follows the distance covered)
        h.ensure('walk', { fade: 0.2, loop: true });
        h.setSpeed(clamp(eq / 1.4, 0.25, 1.7)); clip = 'walk';
      } else clip = h.locomote(eq, { fade: 0.22 });
    } else {
      const pose = c.pose;
      clip = pose === 'cheer' ? 'cheer2' : pose === 'crouch' ? 'crouch_idle' : pose === 'eyes' ? 'eyes' : pose === 'peek' ? 'peek' : pose === 'startle' ? 'startle' : (this.id % 2 ? 'idle_relaxed' : 'idle');
      h.ensure(clip, { fade, loop: pose !== 'startle' });
    }
    this.clip = clip;
    h.root.position.set(this.x, h.root.position.y, this.z);
    h.setFacing(this.yaw);
    if (this.dress.skirt) this.dress.skirt.rotation.x = clamp(this.speed * 0.045, 0, 0.3);
    this.shadow.visible = true;
  }
  faceYaw(c, cam) {
    if (c.faceX != null) return Math.atan2(c.faceX - this.x, c.faceZ - this.z);
    // toward the camera, turned a little so the face reads in three-quarter view
    const a = Math.atan2(cam[0] - this.x, cam[2] - this.z);
    return a + (this.id % 2 ? 0.5 : -0.5);
  }
}
export { Child };
