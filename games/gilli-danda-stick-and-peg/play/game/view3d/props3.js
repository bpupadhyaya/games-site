// The two props: the danda (a smooth wooden stick, origin at the butt, +Y along it to the tip) and the gilli (a small spindle pointed at both ends, long axis X).
import { THREE } from '../vendor3d/index.js';

const BoxG = THREE.BoxGeometry;
export const BufferGeometry = Object.getPrototypeOf(BoxG.prototype).constructor;
export const Attr = new BoxG().attributes.position.constructor;
const srgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

/** Surface of revolution about +Y from a profile [{ y, r, c }] (c = css colour); seg radial segments. */
export function lathe(profile, seg = 20) {
  const pos = [], nor = [], col = [], idx = [];
  const n = profile.length;
  for (let i = 0; i < n; i++) {
    const p = profile[i], q = profile[Math.min(n - 1, i + 1)], o = profile[Math.max(0, i - 1)];
    const dy = q.y - o.y, dr = q.r - o.r, len = Math.hypot(dy, dr) || 1, ny = -dr / len, nr = dy / len;
    const c = srgb(p.c ?? '#d9b27a');
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2, s = Math.sin(a), co = Math.cos(a);
      pos.push(s * p.r, p.y, co * p.r); nor.push(s * nr, ny, co * nr); col.push(c[0], c[1], c[2]);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) {
    const a = i * (seg + 1) + k, b = a + 1, c2 = a + seg + 1, d = c2 + 1;
    idx.push(a, c2, b, b, c2, d);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Attr(new Float32Array(pos), 3)); g.setAttribute('normal', new Attr(new Float32Array(nor), 3)); g.setAttribute('color', new Attr(new Float32Array(col), 3));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx), 1));
  return g;
}

export function buildDanda({ wood = '#d4a35f', wrap = '#a8352a', dark = '#8a5a28' } = {}) {
  const prof = [
    { y: -0.012, r: 0.001, c: wrap }, { y: -0.008, r: 0.013, c: wrap }, { y: 0.0, r: 0.0165, c: wrap }, { y: 0.1, r: 0.0155, c: wrap }, { y: 0.22, r: 0.0150, c: wrap },
    { y: 0.225, r: 0.0150, c: dark }, { y: 0.23, r: 0.0146, c: wood }, { y: 0.45, r: 0.0150, c: wood }, { y: 0.66, r: 0.0158, c: wood }, { y: 0.735, r: 0.0150, c: wood }, { y: 0.75, r: 0.0100, c: wood }, { y: 0.756, r: 0.001, c: dark },
  ];
  const mesh = new THREE.Mesh(lathe(prof, 18), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 }));
  mesh.castShadow = true;
  const g = new THREE.Group(); g.add(mesh); g.name = 'danda';
  return g;
}

/** The gilli: scale enlarges it for visibility from a distance. Long axis X. */
export function buildGilli(scale = 1) {
  const L = 0.13 * scale, R = 0.0175 * scale;
  const prof = [
    { y: -L / 2, r: 0.0006, c: '#a87a3a' }, { y: -L / 2 + 0.006 * scale, r: R * 0.34, c: '#c79a55' }, { y: -L * 0.3, r: R * 0.82, c: '#e0b672' }, { y: -L * 0.1, r: R, c: '#ecc886' },
    { y: L * 0.1, r: R, c: '#ecc886' }, { y: L * 0.3, r: R * 0.82, c: '#e0b672' }, { y: L / 2 - 0.006 * scale, r: R * 0.34, c: '#c79a55' }, { y: L / 2, r: 0.0006, c: '#a87a3a' },
  ];
  const mesh = new THREE.Mesh(lathe(prof, 14), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: 0x3a2a12, emissiveIntensity: 0.55 }));
  mesh.rotation.z = Math.PI / 2;                       // long axis along X
  mesh.castShadow = false;
  const g = new THREE.Group(); g.add(mesh); g.name = 'gilli';
  g.userData.radius = R; g.userData.len = L;
  return g;
}
