// Simple procedural props with the grip convention human.attach() expects:
// the prop's +Y is its long axis, origin at the butt/centre, units metres.
import * as THREE from './three.js';

export function makeCricketBat({ wood = 0xd9b27a, handle = 0x222831 } = {}) {
  const g = new THREE.Group(); g.name = 'bat';
  const w = new THREE.MeshStandardMaterial({ color: wood, roughness: 0.55 });
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.28, 12), new THREE.MeshStandardMaterial({ color: handle, roughness: 0.8 }));
  h.position.y = 0.14;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.56, 0.04), w); blade.position.y = 0.56;
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.55, 0.055), w); spine.position.y = 0.56;
  g.add(h, blade, spine); g.userData.sweet = 0.56; g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function makeBall({ radius = 0.036, color = 0xa3151b, segments = 20 } = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.round(segments * 0.7)), new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
  m.castShadow = true; m.name = 'ball';
  return m;
}

export function makeStumps({ spacing = 0.1, height = 0.71, color = 0xe8dcc0 } = {}) {
  const g = new THREE.Group(); g.name = 'stumps';
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  for (let i = -1; i <= 1; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, height, 10), mat); s.position.set(i * spacing, height / 2, 0); s.castShadow = true; g.add(s); }
  return g;
}

export function makeStick({ length = 1.0, radius = 0.012, color = 0x8a5a2b } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  m.position.y = length / 2; const g = new THREE.Group(); g.add(m); m.castShadow = true;
  return g;
}
