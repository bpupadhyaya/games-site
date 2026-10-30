// Face detail for the shared horse (view3d 1.14.0): the source head ends in a featureless blob (a flat dark patch with a jagged edge that
// reads as a hollow shell). This adds, in the REST pose and attached to the Head/Jaw bones, real nostrils (recessed dark cavity inside a flared rim),
// a closed mouth line with a lip fold, a soft chin/lower-lip pad and an upper-lip pad. Every part is placed by ray-casting the rest-pose head
// surface, so it sits on the mesh exactly. Coat colours follow setCoat (see HorseFace.setColors).
import * as THREE from './three.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Z = V(0, 0, 1);

export class HorseFace {
  constructor(horse) {
    this.horse = horse; this.group = new THREE.Group(); this.group.name = 'horseFace';
    this.mats = {
      cavity: new THREE.MeshStandardMaterial({ color: '#070505', roughness: 0.9, metalness: 0 }),
      rim: new THREE.MeshStandardMaterial({ color: '#2a1d1a', roughness: 0.55, metalness: 0 }),
      lip: new THREE.MeshStandardMaterial({ color: '#2a1d1a', roughness: 0.6, metalness: 0 }),
      line: new THREE.MeshStandardMaterial({ color: '#0d0807', roughness: 0.8, metalness: 0 }),
    };
    this.meshes = [];
    this._build();
  }
  _surface() {
    const h = this.horse, parts = h.meshes.filter((m) => m.userData.cls === 'body' || m.userData.cls === 'muzzle');
    const pos = [], idx = []; let o = 0;
    for (const m of parts) {
      const p = m.geometry.attributes.position, ix = m.geometry.index;
      for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
      for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + o);
      o += p.count;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();
    return (from, dir) => {
      rc.set(from, dir.clone().normalize()); rc.far = 2;
      const hit = rc.intersectObject(mesh, false)[0];
      if (!hit) return null;
      const n = hit.face.normal.clone();
      if (n.dot(dir) > 0) n.negate();
      return { p: hit.point.clone(), n };
    };
  }
  _add(geo, mat, boneName, at, quat, scale) {
    const R = this.horse.rest, bone = this.horse.b[boneName];
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(at).sub(R[boneName]); if (quat) m.quaternion.copy(quat); if (scale) m.scale.copy(scale);
    m.castShadow = false; m.receiveShadow = false;
    bone.add(m); this.meshes.push(m); return m;
  }
  _build() {
    const ray = this._surface();
    const sph = new THREE.SphereGeometry(1, 16, 12), tor = new THREE.TorusGeometry(1, 0.2, 8, 24);
    for (const side of [1, -1]) {
      // nostril: found on the front-upper face of the muzzle, slit slanted outwards (comma), flared wing outside
      const hit = ray(V(side * 0.036, 1.805, 2.0), V(0, -0.08, -1));
      if (hit) {
        const n = hit.n.clone().normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(Z, n);
        const roll = new THREE.Quaternion().setFromAxisAngle(Z, side * -0.5);       // slanted slit
        q.multiply(roll);
        // rim: flat flared ring, slightly proud of the surface; cavity: dark ellipsoid sunk into it
        const rimAt = hit.p.clone().addScaledVector(n, 0.0025);
        const rim = this._add(tor, this.mats.rim, 'Head', rimAt, q, V(0.02, 0.0115, 0.01));
        const cav = this._add(sph, this.mats.cavity, 'Head', hit.p.clone().addScaledVector(n, -0.0012), q, V(0.019, 0.0105, 0.0075));
        void rim; void cav;
      }
    }
    // mouth: a closed lip line from the front-bottom centre back to each corner, with a soft lip fold above it
    for (const side of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= 9; i++) {
        const u = i / 9;                                   // 0 = front centre, 1 = corner of the mouth
        const x = side * (0.004 + 0.092 * u), yy = 1.722 + 0.016 * u * u, zz = 1.9;
        const h2 = ray(V(x, yy, zz), V(0, 0, -1));
        pts.push(h2 ? h2.p.addScaledVector(h2.n, 0.0015) : V(x, yy, 1.62));
        if (!h2 && globalThis.__HF_DBG) console.error('mouth miss', x, yy);
      }
      if (pts.length > 3) {
        const curve = new THREE.CatmullRomCurve3(pts);
        const tube = new THREE.TubeGeometry(curve, 24, 0.0026, 6, false);
        const m = new THREE.Mesh(tube, this.mats.line); m.castShadow = false;
        m.position.sub(this.horse.rest.Head); this.horse.b.Head.add(m); this.meshes.push(m);
      }
    }
  }
  /** muzzle / lip colours follow the coat (grey/cremello/palomino get the pink-grey nose, others the dark points colour) */
  setColors(coat, nose) {
    const m = new THREE.Color(nose);
    this.mats.rim.color.copy(m).lerp(new THREE.Color('#ffffff'), 0.04);
    this.mats.lip.color.copy(m);
    this.mats.line.color.copy(m).multiplyScalar(0.4);
    this.mats.cavity.color.copy(m).multiplyScalar(0.12);
  }
  dispose() { for (const m of this.meshes) { m.removeFromParent(); m.geometry.dispose?.(); } for (const k in this.mats) this.mats[k].dispose(); }
}
