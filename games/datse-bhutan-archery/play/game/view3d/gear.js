// Bamboo bow, string and feather-fletched arrows. Local frames: the bow stands along +Y with the string side towards +Z; an arrow lies along +Z with its nock at the origin.
// Static parts are merged into one vertex-coloured mesh each (few draw calls).
import { mergeInto } from './world.js';
const col = (THREE, c) => { const k = new THREE.Color(c); return [k.r, k.g, k.b]; };
const place = (THREE, geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)); return m; };

export function makeBow(THREE) {
  const g = new THREE.Group(), L = 0.8, I = new THREE.Matrix4();
  const pts = []; for (let i = 0; i <= 20; i++) { const y = -L + (2 * L * i) / 20, k = y / L; pts.push(new THREE.Vector3(0, y, 0.11 * (k * k))); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const parts = [{ geo: new THREE.TubeGeometry(curve, 24, 0.014, 5, false), matrix: I, color: col(THREE, 0xb98d45) }, { geo: new THREE.CylinderGeometry(0.02, 0.02, 0.26, 7), matrix: I, color: col(THREE, 0x4a2a16) }];
  for (const s of [-1, 1]) parts.push({ geo: new THREE.CylinderGeometry(0.018, 0.018, 0.04, 7), matrix: place(THREE, null, 0, s * 0.3, 0.11 * (0.3 / L) ** 2), color: col(THREE, 0xc23a2a) });
  const body = new THREE.Mesh(mergeInto(THREE, parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 })); g.add(body);
  const tipTop = new THREE.Vector3(0, L, 0.11), tipBot = new THREE.Vector3(0, -L, 0.11);
  // the string: one mesh of two crossed ribbons per half, rebuilt from the tips and the nock point each frame
  const sg = new THREE.BufferGeometry(), sp = new Float32Array(16 * 3), idx = [];
  for (let r = 0; r < 4; r++) idx.push(r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 1, r * 4 + 3, r * 4 + 2);
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setIndex(idx);
  const str = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xece4cf, side: THREE.DoubleSide })); str.frustumCulled = false; g.add(str);
  const W = 0.0045;
  const ribbon = (r, a, b, ox, oz) => sp.set([a.x - ox, a.y, a.z - oz, a.x + ox, a.y, a.z + oz, b.x - ox, b.y, b.z - oz, b.x + ox, b.y, b.z + oz], r * 12);
  g.userData.tips = [tipTop, tipBot];
  g.userData.setNock = (p) => { ribbon(0, tipTop, p, W, 0); ribbon(1, tipTop, p, 0, W); ribbon(2, p, tipBot, W, 0); ribbon(3, p, tipBot, 0, W); sg.attributes.position.needsUpdate = true; };
  g.userData.setNock(new THREE.Vector3(0, 0, 0.11));
  return g;
}
export function makeArrow(THREE, { shaft = 0xd8b46a, fletch = 0xf2f0e6, len = 0.92 } = {}) {
  const g = new THREE.Group();
  const parts = [
    { geo: new THREE.CylinderGeometry(0.0055, 0.0055, len, 5), matrix: place(THREE, null, 0, 0, len / 2, Math.PI / 2), color: col(THREE, shaft) },
    { geo: new THREE.CylinderGeometry(0, 0.009, 0.05, 5), matrix: place(THREE, null, 0, 0, len + 0.02, Math.PI / 2), color: col(THREE, 0x6d6d70) },
    { geo: new THREE.CylinderGeometry(0.007, 0.007, 0.012, 5), matrix: place(THREE, null, 0, 0, 0, Math.PI / 2), color: col(THREE, 0xc23a2a) },
  ];
  for (let i = 0; i < 3; i++) { const a = (i * Math.PI * 2) / 3; parts.push({ geo: new THREE.PlaneGeometry(0.014, 0.12), matrix: place(THREE, null, -Math.sin(a) * 0.011, Math.cos(a) * 0.011, 0.07, Math.PI / 2, 0, a), color: col(THREE, fletch) }); }
  const m = new THREE.Mesh(mergeInto(THREE, parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide })); g.add(m);
  g.userData.len = len;
  return g;
}
