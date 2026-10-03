// Props that are not skinned: the three-sided bat (origin at the butt, +Y along the bat, one flat side facing +Z) and the hard rubber ball.
// Three.js here is the vendored subset, so BufferGeometry and attributes are reached through instances.
import { THREE } from '../vendor3d/index.js';
import { BALL_R } from '../src/core.js';

const BoxG = THREE.BoxGeometry;
export const BufferGeometry = Object.getPrototypeOf(BoxG.prototype).constructor;
export const Attr = new BoxG().attributes.position.constructor;
export const Attr16 = new BoxG().index.constructor;
const srgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const V = THREE.Vector3;

// Bat profile: [y along the bat, circumradius of the triangular section, colour]. A flat side has its centre r/2 from the axis.
const PROFILE = (rope, wood, tip) => [
  [0.000, 0.0200, rope], [0.020, 0.0235, rope], [0.255, 0.0235, rope],
  [0.270, 0.0290, wood], [0.340, 0.0480, wood], [0.420, 0.0600, wood], [0.640, 0.0680, wood], [0.800, 0.0700, wood], [0.840, 0.0640, tip],
];

export function buildBat({ wood = '#d9b27a', rope = '#3a2a1c', tip = '#b88a52' } = {}) {
  const prof = PROFILE(srgb(rope), srgb(wood), srgb(tip));
  const pos = [], nor = [], col = [], idx = [];
  const ring = (r) => [0, 1, 2].map((k) => { const th = Math.PI + (k * 2 * Math.PI) / 3; return [r * Math.sin(th), r * Math.cos(th)]; });
  const tri = (a, b, c, color) => {
    const n = new V().subVectors(new V(...b), new V(...a)).cross(new V().subVectors(new V(...c), new V(...a))).normalize();
    const base = pos.length / 3;
    for (const p of [a, b, c]) { pos.push(...p); nor.push(n.x, n.y, n.z); col.push(...color); }
    idx.push(base, base + 1, base + 2);
  };
  for (let i = 0; i < prof.length - 1; i++) {
    const [y0, r0, c0] = prof[i], [y1, r1, c1] = prof[i + 1];
    const A = ring(r0), B = ring(r1);
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3;
      // side k: between vertex k and k2; flat side facing +Z is k = 1 (vertices at angles 300 and 60 degrees)
      const lit = k === 1 ? 1.08 : 0.94;
      const c = [c1[0] * lit, c1[1] * lit, c1[2] * lit];
      const a = [A[k][0], y0, A[k][1]], b = [A[k2][0], y0, A[k2][1]], cc = [B[k2][0], y1, B[k2][1]], d = [B[k][0], y1, B[k][1]];
      tri(a, d, b, c); tri(b, d, cc, c);
    }
  }
  // end caps
  const top = prof[prof.length - 1], bot = prof[0];
  const T = ring(top[1]), Bt = ring(bot[1]);
  tri([T[0][0], top[0], T[0][1]], [T[2][0], top[0], T[2][1]], [T[1][0], top[0], T[1][1]], top[2]);
  tri([Bt[0][0], bot[0], Bt[0][1]], [Bt[1][0], bot[0], Bt[1][1]], [Bt[2][0], bot[0], Bt[2][1]], bot[2]);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Attr(new Float32Array(pos), 3));
  geo.setAttribute('normal', new Attr(new Float32Array(nor), 3));
  geo.setAttribute('color', new Attr(new Float32Array(col), 3));
  geo.setIndex(new Attr16(new Uint16Array(idx), 1));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 }));
  mesh.castShadow = false;
  const g = new THREE.Group(); g.add(mesh); g.name = 'bat';
  return g;
}

// ONE mesh (one draw call): a bright rubber ball with a pale band and a dark seam line painted into the vertex colours.
export function buildBall(scale = 1) {
  const r = BALL_R * scale;
  const geo = new THREE.SphereGeometry(r, 20, 14);
  const base = srgb('#f2641f'), band = srgb('#fff1d6'), dark = srgb('#b8340e');
  const P = geo.attributes.position, col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i) / r, x = P.getX(i) / r;
    const inBand = Math.abs(y) < 0.2;
    const edge = Math.abs(Math.abs(y) - 0.2) < 0.05;
    const c = inBand ? band : edge ? dark : (x > 0 ? base : [base[0] * 0.95, base[1] * 0.95, base[2] * 0.95]);
    col.set(c, i * 3);
  }
  geo.setAttribute('color', new Attr(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, emissive: 0x331005, emissiveIntensity: 0.6 }));
  const g = new THREE.Group(); g.add(mesh); g.name = 'ball'; g.userData.radius = r;
  return g;
}
