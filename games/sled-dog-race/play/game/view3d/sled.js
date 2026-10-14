// The dog sled (ash basket sled on plastic-shod runners, sled bag, bow handlebar, claw brake) and the musher who stands on its runner tails.
// Sled frame: +x forward (toward the dogs), +y up, +z toward the camera. Origin = the ground under the middle of the basket.
import { THREE } from '../vendor3d/index.js';

const cyl = (a, b, r, mat, seg = 8) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true; return m;
};

export function makeSled({ bagColor = '#2a6fb5' } = {}) {
  const g = new THREE.Group(); g.name = 'sled';
  const ash = new THREE.MeshStandardMaterial({ color: '#c79a5e', roughness: 0.62 });
  const dark = new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.7 });
  const runnerM = new THREE.MeshStandardMaterial({ color: '#1d2430', roughness: 0.35, metalness: 0.2 });
  const steel = new THREE.MeshStandardMaterial({ color: '#aeb7c4', roughness: 0.3, metalness: 0.85 });
  const bagM = new THREE.MeshStandardMaterial({ color: bagColor, roughness: 0.75 });
  const rope = new THREE.MeshStandardMaterial({ color: '#e8e0cf', roughness: 0.9 });
  for (const z of [0.3, -0.3]) {
    // runner: long, with the upturned tip at the front
    const pts = [[-2.05, 0.03], [-1.2, 0.03], [0.6, 0.03], [1.25, 0.04], [1.5, 0.12], [1.62, 0.27]].map(([x, y]) => new THREE.Vector3(x, y, z));
    const run = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.028, 8), runnerM); run.castShadow = true; g.add(run);
    const brk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.055), steel); brk.position.set(-1.98, 0.035, z); g.add(brk);
    // stanchions to the rail
    for (const x of [-1.0, -0.4, 0.2, 0.8, 1.3]) g.add(cyl([x, 0.05, z], [x, 0.34 + (x > 1 ? 0.05 : 0), z], 0.017, ash));
    // side rail curving up at the front
    const rp = [[-1.15, 0.34], [-0.3, 0.34], [0.8, 0.34], [1.35, 0.42], [1.6, 0.58]].map(([x, y]) => new THREE.Vector3(x, y, z * 0.92));
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp), 20, 0.022, 8), ash); rail.castShadow = true; g.add(rail);
    // handlebar upright, leaning back
    g.add(cyl([-1.15, 0.34, z * 0.93], [-1.45, 1.05, z * 0.8], 0.022, ash));
    // brace from the runner tail to the upright
    g.add(cyl([-1.9, 0.06, z], [-1.4, 0.7, z * 0.8], 0.014, dark));
  }
  // handlebar bow
  g.add(cyl([-1.45, 1.05, 0.24], [-1.45, 1.05, -0.24], 0.024, ash));
  // runner-tail platform plank
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.025, 0.62), dark); plank.position.set(-1.7, 0.1, 0); plank.castShadow = true; g.add(plank);
  // basket slats
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.58), ash); s.position.set(-1.0 + i * 0.28, 0.33, 0); s.castShadow = true; g.add(s); }
  // sled bag (padded canvas) with a lashing
  const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.35, 6, 14), bagM); bag.rotation.z = Math.PI / 2; bag.scale.set(1, 1, 1.0); bag.position.set(0.1, 0.5, 0); bag.castShadow = true; g.add(bag);
  for (const x of [-0.35, 0.2, 0.7]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.012, 6, 20), rope); r.rotation.y = Math.PI / 2; r.position.set(x, 0.5, 0); r.scale.set(1, 1, 1); g.add(r); }
  // claw brake: a bar with two steel claws, hinged at the rear; rotates down with the brake
  const brake = new THREE.Group(); brake.position.set(-1.45, 0.3, 0);
  brake.add(cyl([0, 0, 0.27], [0, 0, -0.27], 0.02, steel));
  for (const z of [0.15, -0.15]) brake.add(cyl([0, 0, z], [-0.22, -0.22, z], 0.016, steel));
  brake.add(cyl([-0.22, -0.22, 0.15], [-0.22, -0.22, -0.15], 0.016, steel));
  g.add(brake);
  // gangline attachment: a bridle at the front
  g.userData = { brake, bag, hitch: new THREE.Vector3(1.8, 0.45, 0) };
  return g;
}

// A whole-body wave of snow behind the runners is made by the presenter's particle pool.
