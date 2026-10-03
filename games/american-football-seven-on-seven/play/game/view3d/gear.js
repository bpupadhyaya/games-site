// Football gear built from simple geometry and merged into ONE mesh per piece (vertex colours, one material): a helmet with a facemask that rides on the head
// bone, and shoulder pads (a yoke and two rounded caps) that ride on the chest bone. No logos, no numbers: only colour and shape.
// Sizes are in metres for the ~1.8 m mannequin. Presentation only.
import { THREE } from '../vendor3d/index.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// merge geometries (each already transformed) into one indexed BufferGeometry with a colour per vertex
function merge(parts) {
  const pos = [], nor = [], col = [], idx = [];
  let base = 0;
  for (const { geo, color } of parts) {
    const c = new THREE.Color(color);
    const p = geo.attributes.position, n = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
    const ix = geo.index;
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
const place = (geo, { p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0] } = {}) => {
  const m = new THREE.Matrix4().compose(V(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V(...s));
  return geo.clone().applyMatrix4(m);
};
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
let TUBE_LOW = false;
const tubeOf = (pts, r, seg = 8) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), TUBE_LOW ? Math.max(3, seg >> 1) : seg, r, TUBE_LOW ? 3 : 4, false);

// the bone's own frame expressed in its local space: left / up / forward of the AVATAR (see human.boneFrame)
function frameOf(human, name) {
  const f = human.boneFrame(name);
  const m = new THREE.Matrix4().makeBasis(f.left.clone().normalize(), f.up.clone().normalize(), f.fwd.clone().normalize());
  return { q: new THREE.Quaternion().setFromRotationMatrix(m), f };
}

/** helmet: shell (team colour), a stripe, ear flaps, a facemask of three bars. Returns { mesh, remove }. */
export function addFootballHelmet(human, { color = 0x2f6fd6, trim = 0xf2f2f2, mask = 0xdfe3e8, detail = 1 } = {}) {
  const head = human.bones.Bip01_Head;
  const { q, f } = frameOf(human, 'Head');
  const box = human.headBox;
  const c = box ? box.getCenter(V()) : V(0.07, 0, 0);
  const upExt = box ? Math.max(box.max.dot(f.up), box.min.dot(f.up)) : 0.2;
  const topPt = c.clone().addScaledVector(f.up, upExt - c.dot(f.up));
  const R = 0.128;
  TUBE_LOW = detail < 1;
  const parts = [];
  const sphere = (w, h) => new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI * 0.64);
  const hi = detail >= 1;
  parts.push({ geo: place(hi ? sphere(14, 9) : sphere(10, 6), { s: [R * 1.0, R * 1.0, R * 1.14] }), color });
  // a thin stripe over the crown (a flattened arc hugging the shell)
  if (hi) parts.push({ geo: place(new THREE.SphereGeometry(1, 14, 3, 0, Math.PI * 2, 0, 0.66 * Math.PI), { s: [R * 0.12, R * 1.012, R * 1.152] }), color: trim });
  // ear flaps
  for (const sx of [-1, 1]) parts.push({ geo: place(new THREE.SphereGeometry(0.052, hi ? 8 : 6, hi ? 6 : 4), { p: [sx * R * 0.93, -R * 0.38, 0.0], s: [0.45, 1.0, 1.0] }), color: shade(color, 0.82) });
  // facemask: two horizontal bars, one chin bar, two verticals meeting at the middle
  const Rm = R * 1.1;
  const arc = (el, a0, a1, n = 6) => { const pts = []; for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (i / (n - 1)); pts.push(V(Rm * Math.cos(el) * Math.sin(a), Rm * Math.sin(el), Rm * 1.12 * Math.cos(el) * Math.cos(a))); } return pts; };
  parts.push({ geo: tubeOf(arc(-0.30, -0.78, 0.78), 0.0048), color: mask });
  parts.push({ geo: tubeOf(arc(-0.56, -0.66, 0.66), 0.0048), color: mask });
  parts.push({ geo: tubeOf(arc(-0.86, -0.42, 0.42, 5), 0.0055), color: mask });
  for (const sx of [-0.18, 0.18]) { const pts = []; for (let i = 0; i < 5; i++) { const el = -0.26 - i * 0.15; pts.push(V(Rm * Math.cos(el) * Math.sin(sx * 2.0), Rm * Math.sin(el), Rm * 1.12 * Math.cos(el) * Math.cos(sx * 2.0))); } parts.push({ geo: tubeOf(pts, 0.0042, 6), color: mask }); }
  const geo = merge(parts);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.12 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.quaternion.copy(q);
  mesh.position.copy(topPt).addScaledVector(f.up, -R * 0.72 - 0.012);
  mesh.castShadow = false;
  head.add(mesh);
  return { mesh, mat, setColor(hex) { mat.userData.color = hex; }, remove() { head.remove(mesh); geo.dispose(); mat.dispose(); } };
}

/** shoulder pads: a yoke across the shoulders and two rounded caps, in the jersey colour; one mesh on the chest bone. */
export function addShoulderPads(human, { color = 0x2f6fd6, trim = 0xf2f2f2, detail = 1 } = {}) {
  const b = human.bones;
  const chest = b.Bip01_Spine2;
  human.root.updateMatrixWorld(true);
  const inv = chest.matrixWorld.clone().invert();
  const toLocal = (v) => v.clone().applyMatrix4(inv);
  const wL = b.Bip01_L_UpperArm.getWorldPosition(V()), wR = b.Bip01_R_UpperArm.getWorldPosition(V());
  const wC = chest.getWorldPosition(V());
  const lq = chest.getWorldQuaternion(new THREE.Quaternion()).invert();
  // build in WORLD rest pose (upright, facing +z), then express in the chest bone's space
  const parts = [];
  const mk = (geo, p, s, col, rot = [0, 0, 0]) => {
    const g = place(geo, { p, s, r: rot });
    g.applyMatrix4(new THREE.Matrix4().compose(V(), new THREE.Quaternion(), V(1, 1, 1)));
    const pos = g.attributes.position, nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) { const v = V(pos.getX(i), pos.getY(i), pos.getZ(i)); const l = toLocal(v); pos.setXYZ(i, l.x, l.y, l.z); const nn = V(nor.getX(i), nor.getY(i), nor.getZ(i)).applyQuaternion(lq).normalize(); nor.setXYZ(i, nn.x, nn.y, nn.z); }
    parts.push({ geo: g, color: col });
  };
  const sph = () => (detail >= 1 ? new THREE.SphereGeometry(1, 10, 7) : new THREE.SphereGeometry(1, 7, 5));
  const mid = wL.clone().add(wR).multiplyScalar(0.5);
  const half = wL.distanceTo(wR) / 2;
  // yoke: wide, flat, around the upper chest and back
  mk(sph(), [mid.x, mid.y + 0.015, wC.z + 0.0], [half * 1.02, 0.075, 0.135], color);
  // caps over each shoulder joint
  for (const [w, sx] of [[wL, 1], [wR, -1]]) mk(sph(), [w.x + sx * 0.02, w.y + 0.025, w.z], [0.088, 0.072, 0.108], shade(color, 1.08));
  const geo = merge(parts);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  chest.add(mesh);
  return { mesh, mat, remove() { chest.remove(mesh); geo.dispose(); mat.dispose(); } };
}

/** the ball: a prolate spheroid with white laces, built bigger than life on purpose so it reads on a phone: ONE mesh with vertex colours. */
export function buildFootball() {
  const parts = [];
  const body = new THREE.SphereGeometry(1, 12, 8); parts.push({ geo: place(body, { s: [0.105, 0.105, 0.165] }), color: 0x8a4a22 });
  parts.push({ geo: place(new THREE.BoxGeometry(0.014, 0.012, 0.12), { p: [0, 0.104, 0] }), color: 0xf4efe2 });
  for (const z of [-0.04, 0, 0.04]) parts.push({ geo: place(new THREE.BoxGeometry(0.05, 0.008, 0.008), { p: [0, 0.106, z] }), color: 0xf4efe2 });
  for (const z of [-0.105, 0.105]) parts.push({ geo: place(new THREE.TorusGeometry(0.095, 0.0055, 4, 12), { p: [0, 0, z], r: [0, Math.PI / 2, 0] }), color: 0xf4efe2 });
  const mesh = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  const g = new THREE.Group(); g.add(mesh);
  return g;
}
