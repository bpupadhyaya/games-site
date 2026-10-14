// Props of the sewing scene: teak floor, steel needle with an eye, wound spool, scissors, thimble, thread box, French-knot beads.
// All procedural, metres, y up. Shadows on for everything that is big enough to matter.
import * as THREE from '../vendor3d/three.js';
import { texOf, woodCanvas, twistCanvas, mk, hash, TAU, glowCanvas } from './tex.js';

const V2 = (a) => a.map(([r, y]) => new THREE.Vector2(r, y));
const shadowed = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

let twistTex = null;
export const threadTexture = () => twistTex || (twistTex = texOf(twistCanvas(64), { aniso: 4, srgb: false }));

// ---- floor -------------------------------------------------------------------------------------------------------------------------------------
export function buildFloor(tier) {
  const c = woodCanvas({ w: tier ? 1024 : 512, h: tier ? 1024 : 512, planks: 6, base: [96, 58, 30], seed: 5 });
  const t = texOf(c, { repeat: [2.2, 2.2], aniso: 8 });
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.72, metalness: 0.02, envMapIntensity: 0.4 });
  const g = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2), m);
  g.position.y = -0.0105; g.receiveShadow = true;
  return g;
}

// ---- needle ------------------------------------------------------------------------------------------------------------------------------------
// Local +X is the needle's axis: the tip at the origin, the eye at x = LEN. ~6 cm, drawn at 1.3x thickness so it reads at phone size.
export const NEEDLE_LEN = 0.062;
export function buildNeedle() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8c2d0, metalness: 1, roughness: 0.2, envMapIntensity: 2.2, emissive: 0x1a1f28 });
  const R = 0.0011;
  const prof = V2([[0.00002, 0], [R * 0.45, 0.0035], [R * 0.9, 0.012], [R, 0.026], [R, 0.05], [R * 1.05, 0.055]]);
  const shaft = new THREE.Mesh(new THREE.LatheGeometry(prof, 12).rotateZ(-Math.PI / 2), steel);
  g.add(shaft);
  // the head: a flat plate with an oval eye
  const s = new THREE.Shape(), L = 0.0105, Wd = 0.0021;
  s.moveTo(0, -Wd / 2); s.lineTo(L - Wd / 2, -Wd / 2); s.absarc(L - Wd / 2, 0, Wd / 2, -Math.PI / 2, Math.PI / 2, false); s.lineTo(0, Wd / 2); s.lineTo(0, -Wd / 2);
  const hole = new THREE.Path(); hole.absellipse(L * 0.62, 0, L * 0.26, Wd * 0.2, 0, TAU, false);
  s.holes.push(hole);
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: R * 1.6, bevelEnabled: true, bevelThickness: 0.00012, bevelSize: 0.00012, bevelSegments: 1, curveSegments: 10 }), steel);
  plate.position.set(0.0505, 0, -R * 0.8);
  g.add(plate);
  g.userData.eye = new THREE.Vector3(0.0505 + L * 0.62, 0, 0);
  return shadowed(g);
}

// ---- spool of thread ---------------------------------------------------------------------------------------------------------------------------
export function buildSpool(color = '#b52a2c', { h = 0.04, r = 0.0125, wound = 1 } = {}) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xcaa466, roughness: 0.55, metalness: 0 });
  const fl = V2([[0.004, 0], [r, 0], [r, 0.0015], [0.0075, 0.0022], [0.0075, h - 0.0022], [r, h - 0.0015], [r, h], [0.004, h]]);
  g.add(new THREE.Mesh(new THREE.LatheGeometry(fl, 28), wood));
  const rw = 0.0078 + (r - 0.0092) * wound;
  const tm = threadTexture().clone(); tm.repeat.set(10, 1); tm.needsUpdate = true;
  const th = new THREE.MeshStandardMaterial({ color, map: tm, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(rw, rw, h - 0.0045, 28, 1, true), th);
  body.position.y = h / 2; g.add(body);
  g.userData.wound = body; g.userData.mat = th; g.userData.h = h; g.userData.r0 = 0.0078; g.userData.r1 = r - 0.0016;
  return shadowed(g);
}
export function setSpoolWound(g, f) {
  const r = g.userData.r0 + (g.userData.r1 - g.userData.r0) * Math.max(0.02, Math.min(1, f));
  g.userData.wound.scale.set(r / g.userData.wound.geometry.parameters.radiusTop, 1, r / g.userData.wound.geometry.parameters.radiusTop);
}

// ---- scissors ---------------------------------------------------------------------------------------------------------------------------------
export function buildScissors() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xcfd5de, metalness: 1, roughness: 0.28, envMapIntensity: 1.3 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc79a3c, metalness: 0.9, roughness: 0.32, envMapIntensity: 1.2 });
  const blade = (sign) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0.085, sign * 0.0016); s.lineTo(0.092, sign * 0.0006); s.lineTo(0.0, sign * 0.0072); s.lineTo(0, 0);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.0014, bevelEnabled: false }), steel);
    return m;
  };
  const bladeA = blade(1), bladeB = blade(-1);
  const pa = new THREE.Group(); pa.add(bladeA); pa.rotation.y = 0.2;
  const pb = new THREE.Group(); pb.add(bladeB); pb.rotation.y = -0.2;
  // each blade continues into a handle ring behind the pivot
  const ring = () => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0023, 8, 28), brass); r.rotation.x = Math.PI / 2; return r; };
  const ra = ring(), rb = ring();
  ra.position.set(-0.026, 0.0007, 0.012); rb.position.set(-0.026, 0.0007, -0.012);
  const arm = (sgn) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.03, 8).rotateZ(Math.PI / 2), brass); m.position.set(-0.012, 0.0007, sgn * 0.006); return m; };
  g.add(pa, pb, ra, rb, arm(1), arm(-1));
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.0032, 12), brass); pivot.position.set(0.001, 0.0007, 0); g.add(pivot);
  g.rotation.x = 0; g.scale.setScalar(1);
  // blades lie flat: rotate the shape plane (xy) into the table plane (xz)
  for (const b of [bladeA, bladeB]) b.rotation.x = Math.PI / 2;
  return shadowed(g);
}

// ---- thimble -------------------------------------------------------------------------------------------------------------------------------------
export function buildThimble() {
  const dots = mk(128); const dg = dots.getContext('2d'); dg.fillStyle = '#808080'; dg.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { dg.beginPath(); dg.arc(8 + x * 16 + (y % 2) * 8, 8 + y * 16, 3.6, 0, TAU); dg.fillStyle = '#202020'; dg.fill(); }
  const bt = texOf(dots, { repeat: [6, 2], aniso: 4, srgb: false });
  const m = new THREE.MeshStandardMaterial({ color: 0xcfa24a, metalness: 0.95, roughness: 0.34, bumpMap: bt, bumpScale: 1.4, envMapIntensity: 1.3 });
  const prof = V2([[0.0098, 0], [0.0104, 0.0016], [0.0095, 0.0032], [0.0092, 0.012], [0.0078, 0.0175], [0.0042, 0.0205], [0.0001, 0.0212]]);
  const t = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), m);
  const inner = new THREE.Mesh(new THREE.LatheGeometry(V2([[0.0001, 0.02], [0.0036, 0.0192], [0.0074, 0.0165], [0.0088, 0.012], [0.0092, 0.0035], [0.0098, 0.0001]]), 24), new THREE.MeshStandardMaterial({ color: 0x6a4b18, roughness: 0.6, side: THREE.BackSide }));
  const g = new THREE.Group(); g.add(t, inner);
  return shadowed(g);
}

// ---- a small wooden thread box with spools and marigold petals --------------------------------------------------------------------------------
export function buildThreadBox() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b3a1c, roughness: 0.6, metalness: 0.02 });
  const bx = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); m.position.set(x, y, z); return m; };
  g.add(bx(0.11, 0.003, 0.07, 0, 0.0015, 0), bx(0.11, 0.022, 0.003, 0, 0.011, 0.0335), bx(0.11, 0.022, 0.003, 0, 0.011, -0.0335), bx(0.003, 0.022, 0.07, 0.0535, 0.011, 0), bx(0.003, 0.022, 0.07, -0.0535, 0.011, 0));
  const cols = ['#b52a2c', '#2b4fa2', '#d99a14', '#2d8a5b', '#f0e8d4'];
  cols.forEach((c, i) => { const s = buildSpool(c, { h: 0.034, r: 0.0105 }); s.rotation.z = Math.PI / 2; s.position.set(-0.044 + i * 0.022, 0.0135, ((i * 37) % 7 - 3) * 0.003); s.rotation.y = i * 0.1; g.add(s); });
  return shadowed(g);
}
export function buildPetals(n = 14, seed = 3) {
  const g = new THREE.Group();
  const gl = new THREE.Shape(); gl.absellipse(0, 0, 0.0085, 0.0045, 0, TAU);
  const geo = new THREE.ShapeGeometry(gl, 8).rotateX(-Math.PI / 2);
  for (let i = 0; i < n; i++) {
    const col = hash(i, seed, 1) > 0.5 ? 0xf08a1c : 0xf2b21f;
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, side: THREE.DoubleSide }));
    const a = hash(i, seed, 2) * TAU, d = 0.02 + hash(i, seed, 3) * 0.05;
    m.position.set(Math.cos(a) * d, 0.0008, Math.sin(a) * d * 0.7); m.rotation.y = hash(i, seed, 4) * TAU; m.rotation.z = (hash(i, seed, 5) - 0.5) * 0.3;
    m.receiveShadow = true; g.add(m);
  }
  return g;
}

// ---- French-knot beads and eyelets ---------------------------------------------------------------------------------------------------------------------
// A knot: a wrapped bead (round, slightly waisted) sitting on a tiny ring of thread. r in metres.
export function knotGeometry(r) {
  const prof = V2([[0.0001, 0], [r * 0.7, r * 0.05], [r * 1.0, r * 0.5], [r * 0.78, r * 0.95], [r * 0.82, r * 1.25], [r * 0.5, r * 1.6], [r * 0.0001, r * 1.7]]);
  return new THREE.LatheGeometry(prof, 14);
}
export function eyeletGeometry(r) {
  return new THREE.TorusGeometry(r * 0.82, r * 0.28, 8, 20).rotateX(-Math.PI / 2);
}
export { glowCanvas };
