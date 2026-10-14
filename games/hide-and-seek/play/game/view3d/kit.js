// Small helpers shared by the props, the places and the children: cached materials, mesh shorthands, canvas textures and a
// sway-able cloth plane. Everything is procedural (no image files); safe to call many times.
import { THREE, board3d as B } from '../vendor3d/index.js';

export { THREE, B };
const TAU = Math.PI * 2;
let seedState = 1;
export const rngSeed = (s) => { seedState = (s >>> 0) || 1; };
export const rnd = () => { seedState = (Math.imul(seedState, 1664525) + 1013904223) >>> 0; return seedState / 4294967296; };
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const matCache = new Map();
export function mat(color, o = {}) {
  const key = `${color}|${o.rough ?? 0.8}|${o.metal ?? 0}|${o.emissive ?? ''}|${o.ei ?? 0}|${o.side ?? 0}|${o.flat ? 1 : 0}|${o.opacity ?? 1}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, flatShading: !!o.flat, side: o.side ? THREE.DoubleSide : THREE.FrontSide });
    if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
    if (o.opacity != null && o.opacity < 1) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
    matCache.set(key, m);
  }
  return m;
}
export const wood = (c0 = '#8a5a34', c1 = '#a8703f', o = {}) => B.material('wood', { color: c0, color2: c1, repeat: o.repeat || [1, 1], seed: o.seed ?? 3, roughness: o.rough ?? 0.7, size: 256 });
export const darkWood = (c0 = '#4a2a16', c1 = '#6b4126', o = {}) => B.material('darkWood', { color: c0, color2: c1, repeat: o.repeat || [1, 1], seed: o.seed ?? 5, size: 256 });
export const stoneM = (c0 = '#8c8578', c1 = '#b9b2a2', o = {}) => B.material('stone', { color: c0, color2: c1, repeat: o.repeat || [1, 1], seed: o.seed ?? 9, size: 256 });
export const clayM = (c0 = '#a8573a', c1 = '#c97c55', o = {}) => B.material('clay', { color: c0, color2: c1, repeat: o.repeat || [1, 1], seed: o.seed ?? 4, size: 256 });
export const clothM = (c0, c1, o = {}) => B.material('cloth', { color: c0, color2: c1 || c0, repeat: o.repeat || [2, 2], seed: o.seed ?? 1, size: 256, roughness: 0.95 });

export function cv(w, h) { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function canvasTex(w, h, draw, { repeat = null, srgb = true, aniso = 4 } = {}) {
  const c = cv(w, h); draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}

export function put(parent, mesh, x = 0, y = 0, z = 0, ry = 0) {
  mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
export const rbox = (w, h, d, r, m) => new THREE.Mesh(B.roundedBox(w, h, d, r, 3), m);
export const cyl = (rt, rb, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
export const sph = (r, m, ws = 16, hs = 12) => new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m);
export const lathe = (profile, m, seg = 28) => new THREE.Mesh(B.lathe(profile, seg), m);
export const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
// a tube along points [[x,y,z],...]
export function tube(points, r, m, seg = 24, rad = 8) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  return new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, rad, false), m);
}
// a rock: a jittered low-poly sphere (deterministic)
export function rock(r, m, seed = 1, squash = 0.7) {
  rngSeed(seed * 977);
  const g = new THREE.SphereGeometry(r, 10, 8), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.82 + rnd() * 0.36, y = p.getY(i);
    p.setXYZ(i, p.getX(i) * k, y * k * squash, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
}
// a cloth plane hanging from y = 0 down to -h, with a vertex-wave sway (CPU, small)
export function clothPlane(w, h, m, { sx = 8, sy = 10 } = {}) {
  const g = new THREE.PlaneGeometry(w, h, sx, sy);
  g.translate(0, -h / 2, 0);
  const base = g.attributes.position.array.slice();
  const mesh = new THREE.Mesh(g, m);
  mesh.userData.sway = (t, amp = 0.08, ph = 0, speed = 2.2) => {
    const p = g.attributes.position, a = p.array;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], hang = clamp(-y / h, 0, 1);
      a[i * 3 + 2] = Math.sin(t * speed + ph + x * 3.1 + y * 2.3) * amp * hang + Math.sin(t * speed * 0.53 + ph * 1.7) * amp * 0.6 * hang * hang;
      a[i * 3] = base[i * 3] + Math.sin(t * speed * 0.8 + ph + y * 1.5) * amp * 0.25 * hang;
    }
    p.needsUpdate = true;
  };
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
export function disposeObject(o) {
  o.traverse((c) => { if (c.geometry) c.geometry.dispose(); });
}
export { TAU };
