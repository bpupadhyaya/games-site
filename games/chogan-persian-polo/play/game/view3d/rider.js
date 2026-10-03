// The rider: a stylised mannequin seated on the horse, left hand on the reins, right hand on the mallet. The seat and the
// strokes are authored with pose keys + IK targets (character space, metres, +Z forward, +X left, origin on the ground under the pelvis).
import { loadHuman, THREE } from '../vendor3d/index.js';
import { authorClips } from './clips.js';
import { FIG } from '../src/consts.js';

export const PELVIS_DROP = 0.865;          // root = saddle point minus this along the body's up axis (pelvis sits on the saddle)
export const STICK_LEN = 1.6;              // butt to mallet head centre

export function makeMallet() {
  // one mesh (one draw call): shaft, grip and head merged with vertex colours
  const parts = [[new THREE.CylinderGeometry(0.014, 0.011, STICK_LEN - 0.07, 8), 0, (STICK_LEN - 0.07) / 2, 0, 0, [0.78, 0.6, 0.35]],
    [new THREE.CylinderGeometry(0.02, 0.02, 0.26, 8), 0, 0.16, 0, 0, [0.16, 0.1, 0.07]],
    [new THREE.CylinderGeometry(0.034, 0.034, 0.2, 10), 0, STICK_LEN, 0, Math.PI / 2, [0.9, 0.85, 0.72]],
    // hand detail: a pommel cap, a wrapped grip band and the wrist cord loop that hangs from the handle
    [new THREE.SphereGeometry(0.03, 8, 6), 0, 0.02, 0, 0, [0.12, 0.08, 0.06]],
    [new THREE.CylinderGeometry(0.0235, 0.0235, 0.035, 8), 0, 0.31, 0, 0, [0.85, 0.74, 0.5]],
    [new THREE.TorusGeometry(0.075, 0.007, 5, 14), 0, 0.2, 0.045, Math.PI / 2 - 0.35, [0.78, 0.2, 0.15]]];
  const pos = [], nor = [], col = [], idx = [];
  let base = 0;
  for (const [geo, x, y, z, rx, c] of parts) {
    const m = new THREE.Matrix4().makeRotationX(rx); m.setPosition(x, y, z);
    const nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3();
    for (let i = 0; i < geo.attributes.position.count; i++) {
      v.fromBufferAttribute(geo.attributes.position, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(geo.attributes.normal, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); col.push(...c);
    }
    for (let i = 0; i < geo.index.count; i++) idx.push(geo.index.getX(i) + base);
    base += geo.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  mesh.name = 'mallet'; mesh.userData.sweet = STICK_LEN;
  return mesh;
}

export async function createRider(o = {}) {
  const h = await loadHuman({ character: o.female ? 'mannequin_f' : 'mannequin_m', kit: { top: o.top, bottoms: o.bottoms || '#efe9dc', socks: o.socks || '#2b1d15', shoes: '#2a1a12', trim: o.trim || '#f6f1e6' }, skin: o.skin || 'tan', hair: o.helmet || o.top, legs: 'long' });
  h.groundClamp = 'off'; h.footPlanting = false;
  h.root.scale.setScalar(FIG);
  if (o.lod) h.setLOD(o.lod);
  const mallet = makeMallet();
  h.attach(mallet, 'R', 'bat');
  authorClips(h);
  h.play('ride', { fade: 0 });
  h.addLayer('live', { mask: 'spine', additive: true });
  const ph = ((o.seed || 1) * 0.6180339) % 1;
  h.play('live', { layer: 'live', fade: 0, startPhase: ph, speed: 0.8 + ((o.seed || 1) % 4) * 0.12 });
  return { human: h, mallet };
}

// place a rider on a horse: root at the saddle, tilted with the body (pitch about X, roll about Z, heading about Y)
export function seatRider(r, hs, sad, pose) {
  const root = r.human.root;
  root.rotation.order = 'YZX';
  const ch = Math.cos(hs.heading), sh = Math.sin(hs.heading);
  const cp = Math.cos(sad.pitch), sp = Math.sin(sad.pitch), cr = Math.cos(sad.roll), sr = Math.sin(sad.roll);
  // body up axis in the heading frame: v=(0,1,0) -> Rx(-pitch) -> Rz(roll)
  const vx = -cp * sr, vy = cp * cr, vz = -sp;
  const px = (sad.x - vx * PELVIS_DROP) * FIG, py = (sad.y - vy * PELVIS_DROP) * FIG, pz = (sad.z - vz * PELVIS_DROP) * FIG;
  root.position.set(hs.x + px * ch + pz * sh, py, hs.z - px * sh + pz * ch);
  root.rotation.set(-sad.pitch, hs.heading, sad.roll);
}
