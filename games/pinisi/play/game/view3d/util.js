// Small helpers shared by the Pinisi 3D scene files: seeded noise, geometry merging with vertex colours, canvas textures.
import { THREE } from '../vendor3d/index.js';

const { BufferGeometry, Float32BufferAttribute, Matrix4, Vector3, Color, CanvasTexture, SRGBColorSpace, RepeatWrapping } = THREE;

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const hash1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const hash2 = (a, b) => hash1(a * 57.3 + b * 91.7 + 13.1);
export function rngOf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// 2D value noise (deterministic) used by terrain and textures.
export function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (i, j) => hash2(xi + i + seed * 17, yi + j + seed * 31);
  return lerp(lerp(h(0, 0), h(1, 0), u), lerp(h(0, 1), h(1, 1), u), v);
}
export function fbm2(x, y, seed = 0, oct = 4) { let a = 0.5, s = 0, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i); f *= 2.03; a *= 0.5; } return s; }

export const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function texOf(c, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// Merge geometries (each optionally transformed by a Matrix4 and tinted by a colour) into ONE geometry with a colour attribute.
// parts: [{ geo, m?: Matrix4, color?: hex|THREE.Color, jitter?: 0..1 (random tint per part) }]
export function mergeParts(parts) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  let base = 0;
  const v = new Vector3(), nm = new THREE.Matrix3();
  for (const p of parts) {
    const g = p.geo.index ? p.geo : p.geo; const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
    const m = p.m || new Matrix4(); nm.getNormalMatrix(m);
    const c = new Color(p.color ?? 0xffffff);
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      if (na) { v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); } else nor.push(0, 1, 0);
      uv.push(ua ? ua.getX(i) : 0, ua ? ua.getY(i) : 0);
      const k = p.vcol ? p.vcol(i, pa) : null;
      col.push(k ? k.r : c.r, k ? k.g : c.g, k ? k.b : c.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
    else for (let i = 0; i < pa.count; i++) idx.push(i + base);
    base += pa.count;
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  out.setAttribute('color', new Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  return out;
}

export const mat4 = (x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => {
  const m = new Matrix4(), e = new THREE.Euler(rx, ry, rz, 'YXZ');
  m.compose(new Vector3(x, y, z), new THREE.Quaternion().setFromEuler(e), new Vector3(sx, sy, sz));
  return m;
};
