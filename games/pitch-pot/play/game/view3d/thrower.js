// The thrower: a skinned athlete in a long court robe with wide sleeves, a sash and a topknot. The right hand holds the arrow at the sim's HAND point (IK),
// the left hand carries the arrows still to throw. Walks (distance-driven stride) between the line and the waiting spot when the turn changes.
// Presentation only: the sim owns every position; nothing here is read back.
import { loadHuman } from '../vendor3d/index.js';
import * as THREE from '../vendor3d/three.js';

const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const cvs = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const brocadeCache = new Map();
function brocade(top, trim) {
  const key = top + trim; if (brocadeCache.has(key)) return brocadeCache.get(key);
  const c = cvs(256, 256), g = c.getContext('2d');
  g.fillStyle = top; g.fillRect(0, 0, 256, 256);
  // woven twill sheen
  for (let i = -256; i < 256; i += 4) { g.strokeStyle = `rgba(255,255,255,${0.025 + hash(i) * 0.03})`; g.lineWidth = 1; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); }
  // cloud-scroll medallions
  g.strokeStyle = trim; g.globalAlpha = 0.55; g.lineWidth = 3;
  for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
    const ox = x + ((y / 64) % 2) * 32 + 32, oy = y + 32;
    g.beginPath(); g.arc(ox, oy, 9, 0, TAU); g.moveTo(ox + 9, oy); g.arc(ox + 14, oy, 5, Math.PI, TAU * 1.5); g.moveTo(ox - 9, oy); g.arc(ox - 14, oy, 5, 0, Math.PI * 1.5, true); g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  brocadeCache.set(key, t); return t;
}

function robeGeo(rTop, rBot, len) {
  // pleated long skirt: soft vertical folds that deepen toward the hem
  const g = new THREE.CylinderGeometry(rTop, rBot, len, 40, 8, true), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x), k = (len / 2 - y) / len;
    const w = 1 + 0.05 * k * Math.sin(a * 11 + 0.6) + 0.1 * k * k;
    p.setXYZ(i, x * w, y, z * w);
    uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 3);
  }
  g.computeVertexNormals(); return g;
}

export async function createThrower({ g = 'm', kit = { top: '#b3271f', trim: '#f2c14e' }, skin = 'tan', hair = 'black', quality = 'high' }) {
  const h = await loadHuman({ character: g === 'f' ? 'athlete_f' : 'athlete_m', kit: { top: kit.top, bottoms: kit.top, socks: '#f2f2f2' }, skin, hair, quality, castShadow: true });
  h.groundClamp = 'auto'; h.turnRate = 5;
  const root = new THREE.Group();
  const col = new THREE.Color(kit.top);
  // ---- robe ---------------------------------------------------------------------------------------------------------------------------
  const tex = brocade(kit.top, kit.trim);
  const len = 0.96;
  const robeMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72, metalness: 0.05, side: THREE.DoubleSide });
  const robe = new THREE.Mesh(robeGeo(0.2, 0.31, len), robeMat); robe.castShadow = true;
  const robeGrp = new THREE.Group(); robeGrp.add(robe); robe.position.y = -len / 2 + 0.06;
  const trimMat = new THREE.MeshStandardMaterial({ color: kit.trim, roughness: 0.45, metalness: 0.3 });
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.318, 0.1, 40, 1, true), trimMat); hem.material.side = THREE.DoubleSide; hem.position.y = -len + 0.11; robeGrp.add(hem);
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.215, 0.12, 28), new THREE.MeshStandardMaterial({ color: kit.trim, roughness: 0.5 })); sash.position.y = 0.1; robeGrp.add(sash);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), trimMat); knot.position.set(0, 0.08, 0.2); robeGrp.add(knot);
  const tail1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.012), trimMat); tail1.position.set(0.04, -0.12, 0.205); tail1.rotation.z = 0.12; robeGrp.add(tail1);
  // wrap collar: a V of trim down the chest, attached to the chest bone each frame
  const collar = new THREE.Group();
  const cl = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.36, 0.02), trimMat); cl.position.set(-0.05, -0.12, 0); cl.rotation.z = -0.4; collar.add(cl);
  const cr = cl.clone(); cr.position.x = 0.05; cr.rotation.z = 0.4; collar.add(cr);
  root.add(robeGrp, collar);
  // ---- sleeves (wide, flaring to the cuff) --------------------------------------------------------------------------------------------
  const sg = new THREE.CylinderGeometry(1, 1.5, 1, 14, 1, true); sg.translate(0, 0.5, 0);
  const sleeves = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.DoubleSide }), 4);
  sleeves.frustumCulled = false; sleeves.castShadow = true;
  const cuffs = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1, true), new THREE.MeshStandardMaterial({ color: kit.trim, roughness: 0.45, side: THREE.DoubleSide }), 2);
  cuffs.frustumCulled = false;
  root.add(sleeves, cuffs);
  // topknot with a pin, on the head bone
  const knotHair = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshStandardMaterial({ color: '#15100d', roughness: 0.5 }));
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6), new THREE.MeshStandardMaterial({ color: '#d8a54a', metalness: 0.9, roughness: 0.3 })); pin.rotation.z = Math.PI / 2;
  const topknot = new THREE.Group(); topknot.add(knotHair, pin); root.add(topknot);
  // arrows still to throw, held in the left hand
  const bundle = new THREE.Group(); root.add(bundle);
  const T = { h, root, robeGrp, sleeves, cuffs, topknot, collar, bundle, g, kit, vel: V(), pos: V(), tgt: V(), spd: 0, swing: 0, idleT: Math.random() * 0, sway: V() };
  root.add(h.root); h.root.visible = true;
  return T;
}

const up = V(0, 1, 0), tq = new THREE.Quaternion(), tm = new THREE.Matrix4(), ta = V(), tb = V(), tc = V(), td = V(), ts = V();
export function updateSleeves(T) {
  const { h } = T, sc = h.scale || 1;
  const put = (mesh, i, p0, p1, r0) => { td.copy(p1).sub(p0); const len = td.length(); if (len < 1e-4) return; td.multiplyScalar(1 / len); tq.setFromUnitVectors(up, td); ts.set(r0, len, r0); tm.compose(p0, tq, ts); mesh.setMatrixAt(i, tm); };
  let k = 0;
  for (const side of ['L', 'R']) {
    const a = h.arms[side]; a.upper.getWorldPosition(ta); a.mid.getWorldPosition(tb); a.end.getWorldPosition(tc);
    const sh = ta.clone(), el = tb.clone(), wr = tc.clone();
    sh.addScaledVector(td.copy(sh).sub(el).normalize(), 0.05 * sc); put(T.sleeves, k++, sh, el, 0.066 * sc); put(T.sleeves, k++, el, wr, 0.068 * sc);
  }
  T.sleeves.instanceMatrix.needsUpdate = true;
  // cuffs: a trim ring at each wrist
  for (const [i, side] of [[0, 'L'], [1, 'R']]) {
    const a = h.arms[side]; a.mid.getWorldPosition(tb); a.end.getWorldPosition(tc);
    td.copy(tc).sub(tb); const len = td.length(); td.multiplyScalar(1 / Math.max(1e-4, len)); tq.setFromUnitVectors(up, td);
    ta.copy(tc).addScaledVector(td, -0.07 * sc); ts.set(0.09 * sc, 0.06 * sc, 0.09 * sc); tm.compose(ta, tq, ts); T.cuffs.setMatrixAt(i, tm);
  }
  T.cuffs.instanceMatrix.needsUpdate = true;
}
export function followBody(T, dt, vel) {
  const { h } = T;
  h.bonePosition('Pelvis', ta);
  T.robeGrp.position.set(ta.x, ta.y + 0.06, ta.z); T.robeGrp.rotation.y = h.root.rotation.y;
  // hem lags behind the stride: lean the skirt against the velocity (secondary motion), spring-damped
  T.sway.x += ((-vel.x * 0.18) - T.sway.x) * Math.min(1, dt * 7); T.sway.z += ((-vel.z * 0.18) - T.sway.z) * Math.min(1, dt * 7);
  T.robeGrp.rotation.x = T.sway.z; T.robeGrp.rotation.z = -T.sway.x;
  h.bonePosition('Spine2', tb); T.collar.position.set(tb.x, tb.y + 0.02, tb.z); T.collar.rotation.y = h.root.rotation.y; T.collar.translateZ(0.11);
  h.bonePosition('Head', tc); T.topknot.position.set(tc.x, tc.y + 0.13, tc.z); T.topknot.rotation.y = h.root.rotation.y; T.topknot.translateZ(-0.04);
  updateSleeves(T);
}
export { V };
