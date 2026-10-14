// The rider: a real athlete_m from view3d dressed as a village cirit player: felt kavuk with a wound turban, linen shirt with full sleeves,
// a coloured waistcoat (the kit top), a sash, wide salvar trousers and tall leather boots. He sits on a horse3d horse (Ottoman tack) with
// the reins in the left hand and a blunt poplar javelin in the right; a round target standard stands on a staff behind the saddle.
// Cloth ends (sash, turban tail) are verlet ribbons so they stream and flutter with the pace.
import { loadHuman, THREE } from '../vendor3d/index.js';
import { authorClips } from './clips.js';
import { FIG } from '../src/consts.js';

export const JAV_LEN = 1.15;

const toLin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
// merge parts [geo, x, y, z, rx, rz, colour] into one vertex-coloured mesh (one draw call)
export function mergeParts(parts, roughness = 0.75, extra = {}) {
  const pos = [], nor = [], col = [], idx = [];
  let base = 0;
  for (const [geo, x, y, z, rx, rz, c] of parts) {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx || 0, 0, rz || 0)); m.setPosition(x, y, z);
    const nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3();
    for (let i = 0; i < geo.attributes.position.count; i++) {
      v.fromBufferAttribute(geo.attributes.position, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(geo.attributes.normal, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); col.push(...c);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) idx.push(geo.index.getX(i) + base);
    base += geo.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness, ...extra }));
}

// ---- the javelin: a turned poplar stick in segments so it can flex (whip) when it is thrown --------------------------------------------
let woodTex = null;
function wood() {
  if (woodTex) return woodTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = '#d9b97c'; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 36; i++) { x.fillStyle = `rgba(${110 + (i * 17) % 40},${72 + (i * 11) % 30},34,${0.12 + (i % 5) * 0.03})`; x.fillRect((i * 29) % 64, 0, 1 + (i % 3), 256); }
  woodTex = new THREE.CanvasTexture(c); woodTex.colorSpace = THREE.SRGBColorSpace; woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  return woodTex;
}
const SEGS = 6;
// a Group, +Y butt to tip, origin at the butt. userData.flex(a) bends it (whip), userData.segs are the segments.
export function makeJavelin(ribbon = '#d0342c', scale = 1) {
  const g = new THREE.Group(); g.name = 'javelin';
  const L = JAV_LEN, sl = L / SEGS;
  const woodMat = new THREE.MeshStandardMaterial({ map: wood(), roughness: 0.62, metalness: 0 });
  const wrapMat = new THREE.MeshStandardMaterial({ color: '#4a2a14', roughness: 0.9 });
  const ribMat = new THREE.MeshStandardMaterial({ color: ribbon, roughness: 0.7 });
  const bandMat = new THREE.MeshStandardMaterial({ color: '#f3ead2', roughness: 0.7 });
  const segs = [];
  let parent = g;
  for (let i = 0; i < SEGS; i++) {
    const r0 = 0.0215 - (i / SEGS) * 0.005, r1 = 0.0215 - ((i + 1) / SEGS) * 0.005;
    const s = new THREE.Group(); s.position.y = i === 0 ? 0 : sl;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, sl, 10, 1), i === 0 ? wrapMat : woodMat); m.position.y = sl / 2; s.add(m);
    if (i === 0) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0225, 10, 8), woodMat); cap.scale.y = 0.7; s.add(cap); }
    if (i === 1) { const rb = new THREE.Mesh(new THREE.CylinderGeometry(r0 + 0.004, r0 + 0.004, 0.05, 10), ribMat); rb.position.y = sl * 0.45; s.add(rb); const b2 = new THREE.Mesh(new THREE.CylinderGeometry(r0 + 0.003, r0 + 0.003, 0.012, 10), bandMat); b2.position.y = sl * 0.45 + 0.04; s.add(b2); }
    if (i === 4) { const rb = new THREE.Mesh(new THREE.CylinderGeometry(r0 + 0.003, r0 + 0.003, 0.04, 10), ribMat); rb.position.y = sl * 0.5; s.add(rb); }
    if (i === SEGS - 1) { const tip = new THREE.Mesh(new THREE.SphereGeometry(r1 + 0.001, 10, 8), woodMat); tip.position.y = sl; tip.scale.y = 0.8; s.add(tip); }
    parent.add(s); segs.push(s); parent = s;
  }
  g.scale.setScalar(scale);
  g.userData.segs = segs;
  g.userData.flex = (a) => { for (let i = 1; i < SEGS; i++) segs[i].rotation.z = (a / (SEGS - 1)) * (0.4 + i / SEGS); };
  return g;
}
// the spare sticks in the left hand: up to 3 in a loose fan
export function makeBundle(ribbon) {
  const g = new THREE.Group(); g.name = 'bundle';
  for (let i = 0; i < 3; i++) { const j = makeJavelin(ribbon, 0.95); j.position.set((i - 1) * 0.05, 0, 0); j.rotation.z = (i - 1) * 0.07; j.rotation.x = (i - 1) * 0.03; g.add(j); }
  return g;
}
// the target standard: a staff behind the saddle with a round painted target set at an angle so it reads from the side AND from behind.
export function makeShield(cloth, trim) {
  const rim = toLin('#4a2c17'), c1 = toLin(cloth), c2 = toLin(trim || '#f3ead2'), c3 = toLin('#e0a526'), wood = toLin('#7a4f2c');
  const cyl = (r, h, seg = 28) => new THREE.CylinderGeometry(r, r, h, seg);
  const Y = 1.86, R = 0.4;
  return () => {
    const staff = mergeParts([[cyl(0.021, Y, 8), 0, Y / 2, 0, 0, 0, wood], [new THREE.SphereGeometry(0.04, 10, 8), 0, Y + 0.4, 0, 0, 0, c3]], 0.7);
    const disc = mergeParts([
      [cyl(R, 0.05), 0, Y, 0, 0, Math.PI / 2, rim], [cyl(R * 0.86, 0.085), 0, Y, 0, 0, Math.PI / 2, c1],
      [cyl(R * 0.62, 0.095), 0, Y, 0, 0, Math.PI / 2, c2], [cyl(R * 0.38, 0.105), 0, Y, 0, 0, Math.PI / 2, c1], [cyl(R * 0.18, 0.115), 0, Y, 0, 0, Math.PI / 2, c3],
    ], 0.7);
    disc.rotation.y = 0.75;
    const g = new THREE.Group(); g.add(staff, disc);
    return g;
  };
}

// ---- costume parts --------------------------------------------------------------------------------------------------------------------
const along = (geo) => { geo.rotateZ(-Math.PI / 2); return geo; };            // cylinder axis Y -> +X (bone-local limb axis)
function tube(len, r0, r1, color, rough = 0.85, seg = 14) {
  const m = new THREE.Mesh(along(new THREE.CylinderGeometry(r1, r0, len, seg, 1)), new THREE.MeshStandardMaterial({ color, roughness: rough }));
  m.position.x = len / 2; return m;
}
function dress(h, K, o) {
  const B = h.bones, childLen = (n) => { const b = B[n]; return b ? b.position.length() || 0.4 : 0.4; };
  const out = [];
  const add = (bone, mesh) => { B[bone].add(mesh); out.push(mesh); return mesh; };
  const shirt = o.shirt || '#f2ecdc', boot = o.boot || '#2a1a12', pants = K.bottoms;
  for (const s of ['L', 'R']) {
    const tl = childLen(`Bip01_${s}_Calf`), cl = childLen(`Bip01_${s}_Foot`) || 0.42;
    // salvar: a full bag over the thigh, gathered under the knee
    const bag = new THREE.Mesh(along(new THREE.SphereGeometry(1, 16, 12)), new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 }));
    bag.scale.set(tl * 0.55, 0.125, 0.13); bag.position.x = tl * 0.5; bag.userData.pants = true; add(`Bip01_${s}_Thigh`, bag);
    // tall boot
    const bt = tube(cl * 0.86, 0.064, 0.058, boot, 0.5); bt.position.x = cl * 0.5 + cl * 0.05; add(`Bip01_${s}_Calf`, bt);
    // the boot closes over the trainer: an ellipsoid from the ankle along the foot, in dark leather
    const sole = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: boot, roughness: 0.5 }));
    const toe = B[`Bip01_${s}_Toe0`] ? B[`Bip01_${s}_Toe0`].position : { x: 0.1, y: 0.136 };
    const fLen = Math.hypot(toe.x, toe.y) * 1.55, ang = Math.atan2(toe.y, toe.x);
    sole.scale.set(fLen * 0.62, 0.062, 0.07); sole.position.set(Math.cos(ang) * fLen * 0.42 + 0.01, Math.sin(ang) * fLen * 0.42, 0); sole.rotation.z = ang;
    add(`Bip01_${s}_Foot`, sole);
    // linen sleeves
    const ul = childLen(`Bip01_${s}_Forearm`), fl = childLen(`Bip01_${s}_Hand`) || 0.26;
    add(`Bip01_${s}_UpperArm`, tube(ul * 0.96, 0.062, 0.057, shirt, 0.9));
    add(`Bip01_${s}_Forearm`, tube(fl * 0.94, 0.057, 0.05, shirt, 0.9));
  }
  // sash (kusak): a band round the waist in the team colour (pelvis bone local +X is up the body, like the head bone)
  const sashMat = new THREE.MeshStandardMaterial({ color: K.cloth, roughness: 0.8, side: THREE.DoubleSide });
  const sash = new THREE.Mesh(along(new THREE.CylinderGeometry(0.17, 0.18, 0.15, 20, 1, true)), sashMat);
  sash.position.set(0.1, 0, 0); add('Bip01_Pelvis', sash);
  // kavuk (felt cap) and turban roll
  const cap = new THREE.Group();
  const felt = new THREE.MeshStandardMaterial({ color: K.cap, roughness: 0.95 }), wrap = new THREE.MeshStandardMaterial({ color: o.turban || '#efe6cf', roughness: 0.85 });
  const k = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.1, 0.17, 18), felt); k.position.y = 0.1; cap.add(k);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.082, 0.012, 18), felt); top.position.y = 0.19; cap.add(top);
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.108 - i * 0.004, 0.03 - i * 0.003, 10, 28), wrap); t.rotation.x = Math.PI / 2; t.position.y = 0.025 + i * 0.045; t.scale.set(1, 1.05, 0.9); cap.add(t);
  }
  cap.rotation.z = -Math.PI / 2; cap.position.set(0.1, 0, -0.01);
  B.Bip01_Head.add(cap); out.push(cap);
  return { parts: out, cap, sash };
}

// ---- cloth ribbons: a verlet chain drawn as a camera-facing strip ---------------------------------------------------------------------
export class Streamer {
  constructor({ n = 6, len = 0.7, width = 0.09, color = '#b3262e', taper = 0.6, drag = 0.9 }) {
    this.n = n; this.seg = len / (n - 1); this.p = []; this.v = []; this.w = width; this.taper = taper; this.drag = drag; this.init = false;
    for (let i = 0; i < n; i++) { this.p.push(new THREE.Vector3()); this.v.push(new THREE.Vector3()); }
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(35048));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    const nor = new Float32Array(n * 2 * 3); for (let i = 0; i < n * 2; i++) nor[i * 3 + 1] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    this.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.name = 'streamer';
    this.tmp = new THREE.Vector3(); this.s = new THREE.Vector3(); this.d = new THREE.Vector3();
  }
  // anchor: world point it hangs from; wind: world velocity of the air relative to the cloth (m/s, opposite the rider's motion)
  step(dt, anchor, wind, camPos, t) {
    const { p, v, n } = this;
    if (!this.init) { for (let i = 0; i < n; i++) p[i].set(anchor.x, anchor.y - i * this.seg, anchor.z); this.init = true; }
    dt = Math.min(dt, 1 / 30);
    p[0].copy(anchor);
    for (let i = 1; i < n; i++) {
      v[i].y -= 9.8 * 0.28 * dt;
      v[i].x += wind.x * this.drag * dt * 5; v[i].y += wind.y * this.drag * dt * 5; v[i].z += wind.z * this.drag * dt * 5;
      v[i].x += Math.sin(t * 17 + i * 1.7) * 0.9 * dt; v[i].y += Math.sin(t * 13 + i * 2.3) * 0.7 * dt;
      v[i].multiplyScalar(Math.exp(-3.2 * dt));
      p[i].addScaledVector(v[i], dt);
    }
    for (let k = 0; k < 2; k++) for (let i = 1; i < n; i++) {
      this.d.subVectors(p[i], p[i - 1]); const l = this.d.length() || 1e-4;
      this.d.multiplyScalar((l - this.seg) / l);
      p[i].sub(this.d);
    }
    for (let i = 0; i < n; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
      this.d.subVectors(b, a).normalize();
      this.tmp.subVectors(camPos, p[i]);
      this.s.crossVectors(this.d, this.tmp); if (this.s.lengthSq() < 1e-8) this.s.set(1, 0, 0); this.s.normalize();
      const hw = this.w * (1 - (i / (n - 1)) * (1 - this.taper)) * 0.5;
      this.pos.set([p[i].x - this.s.x * hw, p[i].y - this.s.y * hw, p[i].z - this.s.z * hw, p[i].x + this.s.x * hw, p[i].y + this.s.y * hw, p[i].z + this.s.z * hw], i * 6);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
  setColor(c) { this.mesh.material.color.set(c); }
  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.removeFromParent(); }
}

export async function createRider(o = {}) {
  const kit = { top: o.top, bottoms: o.bottoms || '#2d2a4a', socks: o.socks || '#2b1d15', shoes: '#2a1a12', trim: o.trim || '#f6f1e6' };
  const h = await loadHuman({ character: 'athlete_m', kit, skin: o.skin || 'tan', hair: o.hair || 'black', legs: 'long' });
  h.groundClamp = 'off'; h.footPlanting = false;
  h.root.scale.setScalar(FIG);
  if (o.lod) h.setLOD(o.lod);
  const K = { top: o.top, bottoms: o.bottoms || '#2d2a4a', cap: o.cap || '#efe6cf', cloth: o.cloth || o.top, trim: o.trim };
  const costume = dress(h, K, o);
  const jav = makeJavelin(o.cloth || o.top);
  h.attach(jav, 'R', 'bat', { slide: 0.55 });
  const bundle = makeBundle(o.cloth || o.top);
  h.attach(bundle, 'L', 'bat', { slide: 0.5 });
  authorClips(h);
  const shield = makeShield(o.cloth || o.top, o.trim)();
  shield.position.set(0, 0.05, -0.38); shield.rotation.x = -0.1;
  h.root.add(shield);
  return { human: h, jav, bundle, shields: [shield], costume, kit: K, o };
}
