// Small procedural-geometry helpers for the 3D arena (presentation only): lofted bodies, noise textures, a rope tube.
// three.js comes from the vendored view3d layer; nothing here touches the game simulation.
import { THREE } from '../vendor3d/index.js';

const { BufferGeometry, Float32BufferAttribute, Vector3, Color } = THREE;
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
export const col = (hex) => new Color(hex);

const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
function at(st, u, key) {
  const n = st.length, i = clamp(Math.floor(u), 0, n - 2), t = u - i;
  const g = (j) => { const s = st[clamp(j, 0, n - 1)]; return s[key] ?? 0; };
  return cr(g(i - 1), g(i), g(i + 1), g(i + 2), t);
}
/** station values (x, y, z, ry, rz) at parameter u in [0, n-1] */
export function station(st, u) { return { x: at(st, u, 'x'), y: at(st, u, 'y'), z: at(st, u, 'z'), ry: at(st, u, 'ry'), rz: at(st, u, 'rz') }; }

/**
 * Loft an elliptical tube through stations [{x,y,z?,ry,rz}] (centres + radii; ry is along N = side x tangent, rz along `side`).
 * Returns a BufferGeometry with normals; opts.color(u01, theta, pos) -> Color gives vertex colours; rounded end caps by default.
 */
export function loft(stations, o = {}) {
  const rings = o.rings ?? 40, seg = o.seg ?? 14, side = (o.side ? new Vector3(...o.side) : new Vector3(0, 0, 1)).normalize();
  const caps = o.caps ?? 3, n = stations.length;
  const pos = [], idx = [], colors = [], uvs = [];
  const T = new Vector3(), N = new Vector3(), S = new Vector3(), tmp = new Vector3();
  const list = [];
  for (let r = 0; r <= rings; r++) list.push(r / rings * (n - 1));
  const ringData = list.map((u) => station(stations, u));
  const ringList = [];
  const pushRing = (c, ry, rz, u01, Tv, Nv, Sv) => ringList.push({ c, ry, rz, u01, T: Tv.clone(), N: Nv.clone(), S: Sv.clone() });
  const frames = ringData.map((d, i) => {
    const a = ringData[Math.max(0, i - 1)], b = ringData[Math.min(ringData.length - 1, i + 1)];
    T.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
    N.crossVectors(side, T).normalize();
    S.crossVectors(T, N).normalize();
    return { T: T.clone(), N: N.clone(), S: S.clone() };
  });
  if (caps) for (let k = caps; k >= 1; k--) {
    const f = frames[0], d = ringData[0], ang = (k / caps) * Math.PI / 2, rs = Math.cos(ang) + 0.02, rm = Math.max(d.ry, d.rz);
    pushRing(new Vector3(d.x, d.y, d.z).addScaledVector(f.T, -Math.sin(ang) * rm * 0.85), d.ry * rs, d.rz * rs, 0, f.T, f.N, f.S);
  }
  ringData.forEach((d, i) => pushRing(new Vector3(d.x, d.y, d.z), d.ry, d.rz, i / rings, frames[i].T, frames[i].N, frames[i].S));
  if (caps) for (let k = 1; k <= caps; k++) {
    const f = frames[frames.length - 1], d = ringData[ringData.length - 1], ang = (k / caps) * Math.PI / 2, rs = Math.cos(ang) + 0.02, rm = Math.max(d.ry, d.rz);
    pushRing(new Vector3(d.x, d.y, d.z).addScaledVector(f.T, Math.sin(ang) * rm * 0.85), d.ry * rs, d.rz * rs, 1, f.T, f.N, f.S);
  }
  const R = ringList.length;
  ringList.forEach((rg, i) => {
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * TAU, cs = Math.cos(th), sn = Math.sin(th);
      tmp.copy(rg.c).addScaledVector(rg.S, rg.rz * cs).addScaledVector(rg.N, rg.ry * sn);
      pos.push(tmp.x, tmp.y, tmp.z);
      uvs.push(i / (R - 1), j / seg);
      if (o.color) { const c = o.color(rg.u01, th, tmp, rg); colors.push(c.r, c.g, c.b); }
    }
  });
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + (j + 1) % seg, c = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg;
    idx.push(a, c, b, b, c, d);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  if (o.color) g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.rings = ringList;
  return g;
}

/** a point on the loft surface: x along the first station axis (stations must be monotonic in x), angle th, pushed out by `off` metres */
export function surfacePoint(stations, x, th, off = 0, out = new Vector3(), side = [0, 0, 1]) {
  const n = stations.length; let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (stations[m].x <= x) lo = m; else hi = m; }
  const u0 = lo, f = (x - stations[lo].x) / Math.max(1e-6, stations[hi].x - stations[lo].x);
  let u = u0 + f;
  for (let it = 0; it < 4; it++) { const s = station(stations, u); u += (x - s.x) / Math.max(0.2, (stations[hi].x - stations[lo].x)); u = clamp(u, 0, n - 1); }
  const d = station(stations, u), e = station(stations, Math.min(n - 1, u + 0.05)), dd = station(stations, Math.max(0, u - 0.05));
  const T = new Vector3(e.x - dd.x, e.y - dd.y, e.z - dd.z).normalize(), S0 = new Vector3(...side).normalize();
  const N = new Vector3().crossVectors(S0, T).normalize(), S = new Vector3().crossVectors(T, N).normalize();
  const cs = Math.cos(th), sn = Math.sin(th);
  const nx = N.clone().multiplyScalar(sn / Math.max(1e-3, d.ry)), sx = S.clone().multiplyScalar(cs / Math.max(1e-3, d.rz));
  const nrm = nx.add(sx).normalize();
  out.set(d.x, d.y, d.z).addScaledVector(S, d.rz * cs).addScaledVector(N, d.ry * sn).addScaledVector(nrm, off);
  return out;
}

// ---- canvas textures --------------------------------------------------------------------------------------------------------------
const doc = () => globalThis.document;
export function canvasTex(w, h, paint, { repeat = null, srgb = true, aniso = 4 } = {}) {
  const c = doc().createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}
export function noiseFill(ctx, w, h, amp, seed = 1, grain = 1) {
  const r = rng(seed), img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y += grain) for (let x = 0; x < w; x += grain) {
    const n = (r() - 0.5) * amp;
    for (let yy = 0; yy < grain && y + yy < h; yy++) for (let xx = 0; xx < grain && x + xx < w; xx++) {
      const i = ((y + yy) * w + x + xx) * 4; d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** A rope as a tube along a polyline, updated in place every frame (no allocation). */
export class RopeMesh {
  constructor(maxPts = 64, radial = 7, material) {
    this.max = maxPts; this.radial = radial;
    const pos = new Float32Array(maxPts * radial * 3), uv = new Float32Array(maxPts * radial * 2), idx = [];
    for (let i = 0; i < maxPts - 1; i++) for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
      idx.push(a, c, b, b, c, d);
    }
    const g = new BufferGeometry();
    this.posAttr = new Float32BufferAttribute(pos, 3); this.uvAttr = new Float32BufferAttribute(uv, 2);
    this.posAttr.setUsage?.(THREE.DynamicDrawUsage ?? 35048);
    g.setAttribute('position', this.posAttr); g.setAttribute('uv', this.uvAttr); g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false; this.mesh.castShadow = true;
    this._T = new Vector3(); this._N = new Vector3(); this._B = new Vector3(); this._up = new Vector3(0, 1, 0);
    this.count = 0;
  }
  /** pts: array of Vector3 (>= 2), radius in metres (number or fn(i/(n-1))), twist: texture repeats per metre */
  set(pts, radius, twist = 14, closed = false) {
    const n = Math.min(pts.length, this.max), R = this.radial, p = this.posAttr.array, uv = this.uvAttr.array;
    if (n < 2) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    let len = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const T = this._T.subVectors(b, a);
      if (closed && n > 2) { const aa = pts[(i - 1 + n) % n], bb = pts[(i + 1) % n]; T.subVectors(bb, aa); }
      if (T.lengthSq() < 1e-10) T.set(1, 0, 0); T.normalize();
      const ref = Math.abs(T.y) > 0.9 ? this._B.set(1, 0, 0) : this._up;
      const N = this._N.crossVectors(ref, T).normalize(), B = this._B.crossVectors(T, N).normalize();
      const r = typeof radius === 'function' ? radius(i / (n - 1)) : radius;
      if (i > 0) len += pts[i].distanceTo(pts[i - 1]);
      for (let j = 0; j < R; j++) {
        const th = (j / R) * TAU, c = Math.cos(th) * r, s = Math.sin(th) * r, k = (i * R + j) * 3;
        p[k] = pts[i].x + N.x * c + B.x * s; p[k + 1] = pts[i].y + N.y * c + B.y * s; p[k + 2] = pts[i].z + N.z * c + B.z * s;
        const q = (i * R + j) * 2; uv[q] = len * twist; uv[q + 1] = j / R;
      }
    }
    // collapse unused rings onto the last used one
    for (let i = n; i < this.max; i++) for (let j = 0; j < R; j++) { const k = (i * R + j) * 3, s = ((n - 1) * R + j) * 3; p[k] = p[s]; p[k + 1] = p[s + 1]; p[k + 2] = p[s + 2]; }
    this.posAttr.needsUpdate = true; this.uvAttr.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.count = n;
  }
}
