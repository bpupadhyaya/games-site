// The steel horseshoe, at real size (about 18 cm across, 4.5 cm bar, 1.7 cm thick; the sim's U is the same outline). Built once and shared:
// local axes are lateral = X, along the open end = -Z (away from the pitcher when heading is 0), thickness = +Y from 0.
// Painted team colour over bare steel: the heel calks and the edges show the metal.
import { CL, HALF_T, TIP } from '../src/sim.js';

export const SHOE_T = 0.017;

export function createShoeKit(THREE) {
  const RO = CL + HALF_T, RI = CL - HALF_T;
  const shape = new THREE.Shape();
  shape.moveTo(-RO, TIP);
  shape.lineTo(-RO, 0);
  for (let i = 1; i <= 20; i++) { const a = Math.PI + (Math.PI * i) / 20; shape.lineTo(RO * Math.cos(a), RO * Math.sin(a)); }
  shape.lineTo(RO, TIP);
  shape.lineTo(RI, TIP);
  shape.lineTo(RI, 0);
  for (let i = 19; i >= 0; i--) { const a = Math.PI + (Math.PI * i) / 20; shape.lineTo(RI * Math.cos(a), RI * Math.sin(a)); }
  shape.lineTo(-RI, TIP);
  shape.closePath();
  // three nail holes down each arm and one at the heel of the closed end, the way a forged shoe has them
  const hole = (x, y, r = 0.0042) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); shape.holes.push(p); };
  for (const s of [-1, 1]) { hole(s * CL, 0.062); hole(s * CL, 0.032); hole(s * CL * Math.cos(0.5), -CL * Math.sin(0.5) * 0.98 + 0.0); }
  const geoP = new THREE.ExtrudeGeometry(shape, { depth: SHOE_T - 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0028, bevelSegments: 2, curveSegments: 24 });
  geoP.rotateX(-Math.PI / 2);                 // shape (x, y, depth) -> (x, depth, -y): along +y becomes -Z, depth up
  geoP.translate(0, 0.003, 0);
  geoP.computeVertexNormals();
  // heel calks: small raised blocks at the arm tips (forged shoes have them), steel
  const calk = new THREE.BoxGeometry(0.043, 0.011, 0.02);
  const calkL = calk.clone().translate(-CL, SHOE_T + 0.0015, -(TIP - 0.012));
  const calkR = calk.clone().translate(CL, SHOE_T + 0.0015, -(TIP - 0.012));
  // toe calk: a short ridge on the closed end
  const toe = new THREE.BoxGeometry(0.05, 0.009, 0.014).translate(0, SHOE_T + 0.0005, CL + 0.002);
  toe.rotateY(0);
  return { geoP, calkL, calkR, toe, RO, RI };
}

// canvas-free steel material: bump comes from a tiny DataTexture of fine scratches
function scratchTexture(THREE, seed = 7) {
  const N = 64, data = new Uint8Array(N * N * 4);
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N * N; i++) { const v = 150 + Math.floor(rnd() * 80); data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255; }
  for (let k = 0; k < 90; k++) { // scratches
    let x = Math.floor(rnd() * N), y = Math.floor(rnd() * N); const l = 4 + Math.floor(rnd() * 14), dx = rnd() > 0.5 ? 1 : 0, dy = 1 - dx;
    for (let j = 0; j < l; j++) { const i = (((y + j * dy) % N) * N + ((x + j * dx) % N)) * 4; data[i] = data[i + 1] = data[i + 2] = 60 + Math.floor(rnd() * 60); }
  }
  const t = new THREE.DataTexture(data, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.needsUpdate = true; t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function createShoeMaterials(THREE, teams) {
  const bump = scratchTexture(THREE);
  const steel = new THREE.MeshStandardMaterial({ color: 0xe6ebf0, metalness: 0.95, roughness: 0.16, bumpMap: bump, bumpScale: 0.25, envMapIntensity: 1.8 });
  const paint = teams.map((c) => new THREE.MeshPhysicalMaterial({ color: c.main, metalness: 0.5, roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.28, bumpMap: bump, bumpScale: 0.5, envMapIntensity: 1.1 }));
  return { steel, paint, bump };
}

// one shoe object: painted body + steel calks. Origin at the centre of the closed end's arc (= the sim's (x, v) point).
export function makeShoe(THREE, kit, mats, team) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(kit.geoP, mats.paint[team]);
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  for (const geo of [kit.calkL, kit.calkR, kit.toe]) { const m = new THREE.Mesh(geo, mats.steel); m.castShadow = true; g.add(m); }
  g.userData.body = body;
  return g;
}
