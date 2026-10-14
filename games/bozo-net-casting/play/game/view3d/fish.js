// Fish of the Niger as small lofted bodies with fins, one InstancedMesh per species (vertex colours: back / belly / fins).
const SHAPES = [
  { h: 0.2, w: 0.13, snout: 0, dorsal: 0.16, tail: 0.2 },    // tilapia: deep, round
  { h: 0.14, w: 0.09, snout: 0, dorsal: 0.1, tail: 0.24 },   // silver alestes: slim
  { h: 0.2, w: 0.12, snout: 0, dorsal: 0.14, tail: 0.2 },    // labeo
  { h: 0.14, w: 0.2, snout: 0, dorsal: 0.1, tail: 0.14 },    // catfish: wide, flat head
  { h: 0.2, w: 0.12, snout: 0.05, dorsal: 0.14, tail: 0.2 }, // bony-tongue
  { h: 0.12, w: 0.09, snout: 0.16, dorsal: 0.2, tail: 0.18 },// elephantfish: long snout, long dorsal
  { h: 0.16, w: 0.1, snout: 0, dorsal: 0.14, tail: 0.24 },   // tigerfish
  { h: 0.22, w: 0.14, snout: 0, dorsal: 0.2, tail: 0.22 },   // nile perch
];
export function buildFishGeo(THREE, sp, spec) {
  const S = SHAPES[spec] || SHAPES[0];
  const back = new THREE.Color(sp.col[0]), belly = new THREE.Color(sp.col[1]), fin = new THREE.Color(sp.col[2]);
  const pos = [], col = [], idx = [];
  const NS = 12, NA = 8;
  for (let i = 0; i <= NS; i++) {
    const s = i / NS;                       // 0 nose .. 1 tail root
    const x = 0.5 - s * 0.78 + (s < 0.18 ? S.snout * (1 - s / 0.18) : 0);
    const prof = Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, s * 0.92 + 0.04), 0.72)), 0.85) * (1 - 0.5 * s * s);
    const ry = S.h * 0.5 * Math.max(0.03, prof), rz = S.w * 0.5 * Math.max(0.03, prof) * (i < 3 ? 1.1 : 1);
    for (let a = 0; a < NA; a++) {
      const th = (a / NA) * Math.PI * 2, y = Math.cos(th) * ry, z = Math.sin(th) * rz;
      pos.push(x, y, z);
      const k = (Math.cos(th) + 1) / 2;       // 1 on the back
      const c = belly.clone().lerp(back, Math.pow(k, 0.8)); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < NS; i++) for (let a = 0; a < NA; a++) { const A = i * NA + a, B = i * NA + (a + 1) % NA, C = A + NA, D = B + NA; idx.push(A, C, B, B, C, D); }
  const addTri = (p0, p1, p2, c) => { const b = pos.length / 3; pos.push(...p0, ...p1, ...p2); for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b); idx.push(b, b + 1, b + 2, b, b + 2, b + 1); };
  const tx = 0.5 - 0.78;
  addTri([tx, 0, 0], [tx - S.tail * 1.3, S.tail * 0.9, 0], [tx - S.tail * 0.95, 0, 0], fin);
  addTri([tx, 0, 0], [tx - S.tail * 0.95, 0, 0], [tx - S.tail * 1.3, -S.tail * 0.9, 0], fin);
  addTri([0.18, S.h * 0.42, 0], [-0.22, S.h * 0.38, 0], [-0.08, S.h * 0.42 + S.dorsal, 0], fin);
  addTri([0.12, -S.h * 0.4, 0], [-0.04, -S.h * 0.4, 0], [-0.1, -S.h * 0.4 - S.dorsal * 0.6, 0], fin);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}
export function createFish(THREE, SPECIES, cap = 80) {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  const meshes = SPECIES.map((sp, i) => {
    const m = new THREE.InstancedMesh(buildFishGeo(THREE, sp, i), mat, cap);
    m.count = 0; m.frustumCulled = false; m.renderOrder = 4;
    m.instanceMatrix.setUsage?.(35048);
    m.setColorAt(0, new THREE.Color(1, 1, 1)); return m;
  });
  return { meshes, mat, cap };
}
