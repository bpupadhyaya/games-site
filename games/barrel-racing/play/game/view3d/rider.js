// The rider: a real athlete rig (view3d) tinted as a barrel racer (western shirt, jeans, boots; the felt hat, saddle and reins come from horse3d's
// attachRider), a short quirt in the right hand and a neckerchief that flutters. The horse itself is the shared horse3d.
import { loadHuman, THREE } from '../vendor3d/index.js';
import { merge, lin } from './field.js';
import { FIG } from '../src/consts.js';

export const PELVIS_DROP = 0.90;          // root = saddle point minus this along the body's up axis (pelvis sits on the saddle)

const T = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// a short braided quirt: leather handle, plaited shaft, a flat popper. +Y butt to tip, origin at the butt.
export function makeQuirt(color = '#5a3418') {
  const parts = [
    { geo: new THREE.CylinderGeometry(0.019, 0.017, 0.2, 8), matrix: T(0, 0.1, 0), color: lin('#2b1a0e') },
    { geo: new THREE.CylinderGeometry(0.012, 0.01, 0.55, 8), matrix: T(0, 0.47, 0), color: lin(color) },
    { geo: new THREE.BoxGeometry(0.05, 0.16, 0.006), matrix: T(0, 0.82, 0, 0, 0, 0.06), color: lin('#3b2412') },
    { geo: new THREE.SphereGeometry(0.02, 8, 6), matrix: T(0, 0.0, 0), color: lin('#2b1a0e') },
  ];
  const m = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  m.name = 'quirt';
  return m;
}


// a neckerchief: a ribbon strip knotted at the throat that trails back on the wind of the ride (CPU, 7 segments, verlet-like lag)
export function makeKerchief(color = '#c8372d') {
  const N = 8, w = 0.075;
  const pos = new Float32Array(N * 2 * 3), idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(35048));
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
  m.frustumCulled = false; m.name = 'kerchief';
  const pts = Array.from({ length: N }, () => new THREE.Vector3());
  const v = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
  let init = false;
  // anchor: world point at the throat; wind: world vector the cloth streams along (opposite the travel) with its length 0..1 as strength
  m.userData.update = (anchor, wind, dt, t) => {
    const K = m.userData.k || FIGK, seg = 0.075 * K;
    if (!init) { for (const p of pts) p.copy(anchor); init = true; }
    pts[0].copy(anchor);
    for (let i = 1; i < N; i++) {
      const p = pts[i], q = pts[i - 1];
      // follow the previous point with gravity and the wind, flutter grows along the strip
      tmp.copy(wind).multiplyScalar(dt * 5 * (0.4 + i * 0.12));
      p.add(tmp); p.y -= dt * 0.9 * (1 - Math.min(0.9, wind.length() * 0.12));
      p.x += Math.sin(t * 17 + i * 1.7) * 0.012 * wind.length(); p.y += Math.cos(t * 21 + i * 1.3) * 0.010 * wind.length();
      v.copy(p).sub(q); const L = v.length() || 1; p.copy(q).addScaledVector(v, seg / L);
    }
    for (let i = 0; i < N; i++) {
      const a = pts[i], b = pts[Math.min(N - 1, i + 1)], c = pts[Math.max(0, i - 1)];
      v.copy(b).sub(c).normalize(); side.crossVectors(v, up); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize().multiplyScalar(w * FIGK * (0.55 + i * 0.12));
      pos.set([a.x - side.x, a.y - side.y, a.z - side.z, a.x + side.x, a.y + side.y, a.z + side.z], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
  };
  return m;
}
const FIGK = FIG;

// the rider's body on a horse3d horse: tinted barrel-racer kit, quirt in the right hand
export async function createRider(o = {}) {
  const h = await loadHuman({ character: o.female === false ? 'athlete_m' : 'athlete_f', top: 'long', kit: { top: o.top, bottoms: o.bottoms || '#2f4a78', socks: o.socks || '#2b1d15', shoes: '#2a1a12' }, skin: o.skin || 'tan', hair: o.hair || 'brown' });
  h.groundClamp = 'off'; h.footPlanting = false;
  h.root.scale.setScalar(FIG);
  if (o.lod !== undefined) h.setLOD(o.lod);
  const quirt = makeQuirt();
  try { h.attach(quirt, 'R', 'bat', { slide: 0.15 }); } catch (e) { console.warn('quirt', e); }
  return { human: h, quirt, kit: o };
}
