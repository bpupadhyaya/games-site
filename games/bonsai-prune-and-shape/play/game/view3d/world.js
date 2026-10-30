// Static and generated 3D parts for Bonsai: textures, shoji wall, shelf, glazed pots, mossy soil, the tapered bark of every limb, copper
// wire coils and foliage clouds. World convention: x as in the 2D tree, y = -(2D y) (up), z = depth toward the viewer. Pure builders;
// they read the tree, never change it.
import * as THREE from '../vendor3d/three.js';

export const rgbLin = (c, k = 1) => new THREE.Color().setRGB(Math.min(1, c[0] * k / 255), Math.min(1, c[1] * k / 255), Math.min(1, c[2] * k / 255), THREE.SRGBColorSpace);
export const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function lcg(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function tex(c, rep = null, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }

// ---------------------------------------------------------------- textures
export function paperTex() {   // washi: warm white with long fibres
  const c = cv(512, 512), g = c.getContext('2d'), r = lcg(5);
  g.fillStyle = '#f6efe0'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1400; i++) { g.strokeStyle = `rgba(${150 + r() * 60 | 0},${120 + r() * 50 | 0},${80 + r() * 40 | 0},${0.05 + r() * 0.09})`; g.lineWidth = 0.6 + r() * 0.8; const x = r() * 512, y = r() * 512, a = r() * 6.28, l = 6 + r() * 24; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  return tex(c, [14, 7]);
}
export function woodTex(dark = 1) {
  const c = cv(512, 128), g = c.getContext('2d'), r = lcg(11);
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#a77a4e'); gr.addColorStop(1, '#6e4a2c'); g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${30 + r() * 30 | 0},${16 + r() * 16 | 0},8,${0.12 + r() * 0.2})`; g.lineWidth = 0.7 + r() * 1.6; const y = r() * 128; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(150, y + (r() - 0.5) * 8, 330, y + (r() - 0.5) * 8, 512, y + (r() - 0.5) * 4); g.stroke(); }
  if (dark < 1) { g.fillStyle = `rgba(20,10,4,${1 - dark})`; g.fillRect(0, 0, 512, 128); }
  return tex(c, [6, 1]);
}
export function barkTex() {
  const c = cv(128, 256), g = c.getContext('2d'), r = lcg(23);
  g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 160; i++) { const x = r() * 128, l = 20 + r() * 70, y = r() * 256, v = r() < 0.55 ? 60 + r() * 50 : 200 + r() * 55; g.strokeStyle = `rgba(${v | 0},${v | 0},${v | 0},${0.25 + r() * 0.4})`; g.lineWidth = 1 + r() * 2.4; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (r() - 0.5) * 6, y + l / 3, x + (r() - 0.5) * 6, y + l * 0.66, x + (r() - 0.5) * 4, y + l); g.stroke(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export function mossTex() {
  const c = cv(256, 256), g = c.getContext('2d'), r = lcg(31);
  g.fillStyle = '#4b5a2a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${70 + r() * 70 | 0},${100 + r() * 80 | 0},${30 + r() * 40 | 0},${0.4 + r() * 0.5})`; g.beginPath(); g.arc(r() * 256, r() * 256, 1 + r() * 3.2, 0, 7); g.fill(); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(30,24,10,${0.2 + r() * 0.3})`; g.beginPath(); g.arc(r() * 256, r() * 256, 1 + r() * 2, 0, 7); g.fill(); }
  return tex(c);
}
export function speckTex() {
  const c = cv(128, 128), g = c.getContext('2d'), r = lcg(41);
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) { const v = 90 + r() * 120; g.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},0.8)`; g.beginPath(); g.arc(r() * 128, r() * 128, 0.5 + r() * 1.3, 0, 7); g.fill(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// leaf scatter: opaque grey leaves on a transparent ground (alpha-tested on the foliage shells, so light and shadow pass between the leaves);
// the grey is multiplied by the instance colour
export function leafTex(kind) {
  const c = cv(512, 512), g = c.getContext('2d'), r = lcg(kind.length * 97 + 3);
  const n = kind === 'needle' ? 1500 : kind === 'scale' ? 1100 : kind === 'maple' ? 300 : 800;
  for (let i = 0; i < n; i++) {
    const x = r() * 512, y = r() * 512, a = r() * 6.283, v = 110 + r() * 145 | 0;
    g.fillStyle = g.strokeStyle = `rgb(${v},${v},${v})`;
    for (const ox of (x < 40 ? [0, 512] : x > 472 ? [0, -512] : [0])) {
      g.save(); g.translate(x + ox, y); g.rotate(a);
      if (kind === 'needle') { g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(60, 0); g.stroke(); }
      else if (kind === 'scale') { g.lineWidth = 7.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(22, 0); g.stroke(); g.lineWidth = 4.5; g.beginPath(); g.moveTo(9, 0); g.lineTo(19, 9); g.stroke(); }
      else if (kind === 'maple') { g.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? 10 : 28, ang = k * Math.PI / 5; g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } g.closePath(); g.fill(); g.fillRect(-1, 0, 18, 2.4); }
      else { g.beginPath(); g.ellipse(0, 0, 22, 11, 0, 0, 7); g.fill(); }
      g.restore();
    }
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.2); return t;
}

// ---------------------------------------------------------------- shoji wall with a real kumiko lattice (shadow-casting bars)
export function buildWall() {
  const grp = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(7000, 3600), new THREE.MeshStandardMaterial({ map: paperTex(), roughness: 1, metalness: 0 }));
  wall.position.set(0, 500, -92); wall.receiveShadow = true; grp.add(wall);
  const CW = 118, nx = Math.ceil(7000 / CW), ny = 22, bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x8a6240, roughness: 0.7, map: woodTex(), }), nx + ny);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(); let k = 0;
  for (let i = 0; i < nx; i++) { p.set(-3500 + i * CW, 500, -89); s.set(4.2, 3600, 5); bars.setMatrixAt(k++, m.compose(p, q, s)); }
  for (let j = 0; j < ny; j++) { p.set(0, -1500 + j * CW * 1.15, -89); s.set(7000, 4.2, 5); bars.setMatrixAt(k++, m.compose(p, q, s)); }
  bars.castShadow = true; bars.receiveShadow = true; bars.frustumCulled = false; grp.add(bars);
  grp.userData.wall = wall;
  return grp;
}

// ---------------------------------------------------------------- shelf
export function buildShelf() {
  const grp = new THREE.Group(), wood = woodTex();
  const top = new THREE.Mesh(new THREE.BoxGeometry(7000, 20, 150), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 }));
  top.position.set(0, -10, -28); top.castShadow = true; top.receiveShadow = true; grp.add(top);
  const front = new THREE.Mesh(new THREE.BoxGeometry(7000, 3000, 150), new THREE.MeshStandardMaterial({ map: woodTex(0.3), roughness: 0.8 }));
  front.position.set(0, -20 - 1500, -28); front.receiveShadow = true; front.castShadow = true; grp.add(front);
  return grp;
}

// ---------------------------------------------------------------- pots
const PROF = {
  rect: { n: 5, zf: 0.5, pts: [[0, 1], [0.74, 1], [0.84, 0.94], [0.9, 0.7], [0.96, 0.3], [1, 0.05]], bands: false },
  oval: { n: 2, zf: 0.5, pts: [[0, 1], [0.55, 1], [0.8, 0.93], [0.96, 0.56], [1, 0.1]], bands: false },
  round: { n: 2, zf: 0.45, pts: [[0, 1], [0.45, 1], [0.85, 0.92], [1, 0.5], [0.98, 0.07]], bands: false },
  tall: { n: 2.4, zf: 0.5, pts: [[0, 1], [0.6, 1], [0.76, 0.93], [0.84, 0.5], [0.9, 0.05]], bands: true },
  drum: { n: 2, zf: 0.5, pts: [[0, 1], [0.82, 1], [0.93, 0.92], [0.97, 0.5], [1, 0.05]], bands: true },
  slab: { n: 4, zf: 0.6, pts: [[0, 1], [0.94, 1], [1, 0.8], [1, 0.05]], bands: false },
};
// A closed solid of revolution with a superellipse cross-section: rings of (rx fraction of h, y) -> geometry
export function sweep(rings, h, zf, n, segs = 72, colorAt = null, planar = false, flip = false) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const e = 2 / n;
  rings.forEach(([rf, y], ri) => {
    for (let s = 0; s <= segs; s++) {
      const th = (s / segs) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      const x = Math.sign(c) * Math.pow(Math.abs(c), e) * rf * h, z = Math.sign(sn) * Math.pow(Math.abs(sn), e) * rf * h * zf;
      pos.push(x, y, z); uv.push(planar ? x / (h * 2) + 0.5 : (s / segs) * 3, planar ? z / (h * 2 * zf) + 0.5 : -y / 30);
      if (colorAt) { const k = colorAt(ri, y); col.push(k.r, k.g, k.b); }
    }
  });
  for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < segs; s++) { const a = r * (segs + 1) + s, b = a + 1, c = a + segs + 1, d = c + 1; if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colorAt) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const nn = g.attributes.normal;
  for (let r = 0; r < rings.length; r++) { const a = r * (segs + 1), b = a + segs; const x = nn.getX(a) + nn.getX(b), y = nn.getY(a) + nn.getY(b), z = nn.getZ(a) + nn.getZ(b), l = Math.hypot(x, y, z) || 1; nn.setXYZ(a, x / l, y / l, z / l); nn.setXYZ(b, x / l, y / l, z / l); }
  return g;
}
export function buildPot(pot, tier) {
  const P = PROF[pot.kind] || PROF.rect, h = pot.w / 2, d = pot.d, grp = new THREE.Group();
  const gc = pot.glaze, rc = pot.rim;
  // outer wall bottom -> lip, lip top, inner wall down to the soil
  const outer = P.pts.map(([rf, f]) => [rf, -d * f]).reverse().reverse();      // from bottom (f=1) to the rim (f~0.05)
  const rings = [];
  const bottom = outer.map(([rf, y]) => [rf, y]);
  bottom.forEach((p) => rings.push(p));
  const rt = bottom[bottom.length - 1][0];
  rings.push([rt + 0.012, -d * 0.03], [rt + 0.012, 0], [rt - 0.045, 0], [rt - 0.05, -2], [rt - 0.06, -7]);
  // densify so the glaze bands and curvature are smooth
  const dense = [];
  for (let i = 0; i < rings.length - 1; i++) { const [a, b] = [rings[i], rings[i + 1]], k = Math.max(1, Math.ceil(Math.hypot((b[0] - a[0]) * h, b[1] - a[1]) / 9)); for (let j = 0; j < k; j++) dense.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); }
  dense.push(rings[rings.length - 1]);
  const gcol = rgbLin(gc), rcol = rgbLin(rc), drip = rgbLin(gc, 0.62), tmp = new THREE.Color();
  const colorAt = (ri, y) => {
    const f = Math.min(1, Math.max(0, -y / d));
    if (y > -d * 0.06 || y > -1) return rcol;
    if (P.bands && ((f > 0.1 && f < 0.17) || (f > 0.82 && f < 0.88))) return rcol;
    return tmp.copy(gcol).lerp(drip, Math.pow(f, 2.2));
  };
  const geo = sweep(dense, h, P.zf, P.n, tier === 2 ? 40 : 72, (ri, y) => colorAt(ri, y).clone());
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.28, bumpMap: speckTex(), bumpScale: 0.6 });
  const body = new THREE.Mesh(geo, mat); body.castShadow = true; body.receiveShadow = true; grp.add(body);
  // feet
  if (pot.kind !== 'slab' && pot.kind !== 'tall') for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 30), new THREE.MeshStandardMaterial({ color: rgbLin(gc, 0.55), roughness: 0.6 })); f.position.set(sx * h * 0.64, -d - 3, 0); f.castShadow = true; grp.add(f); }
  // soil + moss + pebbles
  const soilRings = [[0, -0.5], [0.3, -1.4], [0.62, -2.6], [rt - 0.07, -4.2], [rt - 0.075, -9]];
  const soil = new THREE.Mesh(sweep(soilRings, h, P.zf, P.n, 48, null, true, true), new THREE.MeshStandardMaterial({ map: mossTex(), roughness: 1 }));
  soil.receiveShadow = true; soil.castShadow = false; grp.add(soil);
  const r = lcg(pot.w * 7 + pot.d), stones = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshStandardMaterial({ color: 0x8f8678, roughness: 0.9, flatShading: true }), 9), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), pp = new THREE.Vector3(), ss = new THREE.Vector3();
  for (let i = 0; i < 9; i++) { const a = r() * 6.283, rf = 0.25 + r() * 0.6; const x = Math.cos(a) * rf * (rt - 0.1) * h, z = Math.sin(a) * rf * (rt - 0.1) * h * P.zf, sz = 1.8 + r() * 2.2; pp.set(x, -2.4 - rf * 1.6 + sz * 0.15, z); q.setFromEuler(new THREE.Euler(r(), r() * 6, r())); ss.set(sz, sz * 0.55, sz * 0.8); stones.setMatrixAt(i, mm.compose(pp, q, ss)); }
  stones.castShadow = true; grp.add(stones);
  grp.userData = { h, d, zf: P.zf, dispose: () => grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); }) };
  return grp;
}

// ---------------------------------------------------------------- limbs
class Buf {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  get count() { return this.p.length / 3; }
  geometry(old) {
    const g = old && old.isBufferGeometry ? old : new THREE.BufferGeometry();
    const set = (name, arr, sz) => { const a = g.getAttribute(name); if (a && a.array.length === arr.length) { a.array.set(arr); a.needsUpdate = true; } else g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(arr), sz)); };
    set('position', this.p, 3); set('normal', this.n, 3); set('uv', this.uv, 2); set('color', this.c, 3);
    const need = this.i.length, cur = g.index;
    if (cur && cur.array.length === need) { cur.array.set(this.i); cur.needsUpdate = true; } else g.setIndex(new THREE.BufferAttribute(new Uint32Array(this.i), 1));
    g.computeBoundingSphere(); return g;
  }
}
const RAD = 9;
// centres: [{x,y,z}], radii: [], colour: (i) -> [r,g,b] linear, uvScale: texture repeat along the limb
function tube(buf, C, R, col, vScale, cap, capCol) {
  const n = C.length; if (n < 2) return;
  const base = buf.count; let dist = 0;
  let n1x = 1, n1y = 0, n1z = 0;
  for (let i = 0; i < n; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    // n1 = in-plane perpendicular; n2 = tangent x n1
    let ax = -ty, ay = tx, az = 0; const al = Math.hypot(ax, ay) || 1; if (al < 1e-4) { ax = n1x; ay = n1y; az = n1z; } else { ax /= al; ay /= al; } n1x = ax; n1y = ay; n1z = az;
    const bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax;
    if (i) dist += Math.hypot(C[i].x - C[i - 1].x, C[i].y - C[i - 1].y, C[i].z - C[i - 1].z);
    const cc = col(i);
    for (let k = 0; k <= RAD; k++) {
      const ph = (k / RAD) * Math.PI * 2, cs = Math.cos(ph), sn = Math.sin(ph);
      const nx = ax * cs + bx * sn, ny = ay * cs + by * sn, nz = az * cs + bz * sn;
      buf.p.push(C[i].x + nx * R[i], C[i].y + ny * R[i], C[i].z + nz * R[i]); buf.n.push(nx, ny, nz); buf.uv.push(k / RAD * 1.5, dist * vScale); buf.c.push(cc[0], cc[1], cc[2]);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < RAD; k++) { const a = base + i * (RAD + 1) + k, b = a + 1, c = a + RAD + 1, d = c + 1; buf.i.push(a, b, c, b, d, c); }
  if (cap) {
    const e = n - 1, cb = buf.count, o = base + e * (RAD + 1);
    const a = C[e - 1], b = C[e]; let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    buf.p.push(b.x + tx * 0.3, b.y + ty * 0.3, b.z + tz * 0.3); buf.n.push(tx, ty, tz); buf.uv.push(0.5, dist * vScale); buf.c.push(capCol[0], capCol[1], capCol[2]);
    for (let k = 0; k < RAD; k++) { const idx = buf.count; buf.p.push(buf.p[(o + k) * 3], buf.p[(o + k) * 3 + 1], buf.p[(o + k) * 3 + 2]); buf.n.push(tx, ty, tz); buf.uv.push(0.5, dist * vScale); buf.c.push(capCol[0], capCol[1], capCol[2]); void idx; }
    for (let k = 0; k < RAD; k++) buf.i.push(cb, cb + 1 + ((k + 1) % RAD), cb + 1 + k);
  }
}
// Catmull-Rom through the limb's skeleton points, `sub` samples per segment
function sampleLimb(P, sub, i0 = 0, i1 = P.length - 1) {
  const out = [];
  for (let i = i0; i < i1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let j = 0; j < sub; j++) {
      const t = j / sub, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z), seg: i, t });
    }
  }
  const e = P[i1]; out.push({ x: e.x, y: e.y, z: e.z, seg: i1 - 1, t: 1 });
  return out;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// z (depth) of every skeleton point: back branches sit behind the trunk, others in front, and anything hanging below the shelf top comes
// forward so a cascade passes in front of the shelf. Pure function of the tree.
export function limbDepth(T, potD) {
  const zs = new Map();
  for (const L of T.limbs) {
    const n = L.g.pts.length, back = L.ord > 0 && L.id % 3 === 0;
    let z0 = 0;
    if (L.par >= 0) { const pz = zs.get(L.par); if (pz) z0 = pz[Math.min(L.at + 1, pz.length - 1)]; }
    const dz = L.ord === 0 ? 0 : (hash(L.id) - 0.5) * 30 + (back ? -16 : 7), arr = new Array(n);
    for (let i = 0; i < n; i++) { const t = i / Math.max(1, n - 1); arr[i] = z0 + dz * Math.pow(t, 0.8) + (L.ord === 0 ? Math.sin(i * 0.9 + L.id) * 3 : 0); }
    for (let i = 0; i < n; i++) arr[i] += 54 * smooth(potD - 6, potD + 40, L.g.pts[i].y);
    zs.set(L.id, arr);
  }
  return zs;
}
const limbR = (L, i) => (i < L.segs.length ? L.segs[i].th : L.segs[L.segs.length - 1].th * 0.55) * 0.5;
export function buildBark(T, sp, zs, old) {
  const buf = new Buf(), bark = sp.bark, twig = sp.twig;
  for (const L of T.limbs) {
    const P = L.g.pts.map((p, i) => ({ x: p.x, y: -p.y, z: zs.get(L.id)[i] })), n = L.segs.length;
    const C = sampleLimb(P, 3);
    const R = C.map((c) => { let r = limbR(L, c.seg) * (1 - c.t) + limbR(L, c.seg + 1) * c.t; if (L.ord === 0) { const dd = Math.hypot(c.x, c.y); r *= 1 + 1.1 * Math.exp(-dd / 11); } return Math.max(0.85, r); });
    const thick = L.ord === 0 || L.segs[0].th > 3.4, base = thick ? bark : mixc(bark, twig, 0.55);
    const lin = (c) => { const k = rgbLin(c); return [k.r, k.g, k.b]; };
    const green = L.tip && T.t < 20, nC = C.length;
    const col = (i) => {
      const v = 0.86 + 0.28 * hash(L.id * 31 + (i >> 1)), c = mixc(base, [255, 236, 200], 0.04);
      const gt = green ? Math.max(0, (i - (nC - 1 - 3)) / 3) : 0;
      return lin(gt > 0 ? mixc(c, [160, 196, 92], gt * 0.85) : [c[0] * v, c[1] * v, c[2] * v]);
    };
    const scarCol = (L.scar && L.cm) ? lin([232, 206, 160]) : lin([base[0] * 0.7, base[1] * 0.7, base[2] * 0.7]);
    tube(buf, C, R, col, 0.04, true, scarCol);
    void n;
  }
  // surface roots (nebari) fanning out of the trunk foot
  const trunk = T.limbs[0], th = trunk.segs[0].th, nr = 7;
  for (let k = 0; k < nr; k++) {
    const a = (k / nr) * Math.PI * 2 + hash(k, 7) * 0.5, len = th * (2.4 + hash(k, 9) * 1.6), C = [], R = [];
    for (let j = 0; j <= 6; j++) { const f = j / 6; C.push({ x: Math.cos(a) * len * f * 1.0, y: 1.5 - 3.2 * f - 0.3, z: Math.sin(a) * len * f * 0.5 }); R.push(Math.max(0.7, th * 0.5 * 0.62 * (1 - f * 0.78))); }
    const k0 = rgbLin(bark, 0.78); tube(buf, C, R, () => [k0.r, k0.g, k0.b], 0.04, true, [k0.r, k0.g, k0.b]);
  }
  return buf.geometry(old);
}
export function buildWires(T, zs, old) {
  const buf = new Buf(); let any = false;
  for (const L of T.limbs) {
    const w = L.wire; if (!w) continue; any = true;
    const a = w.s, b = Math.min(L.segs.length, w.s + 3 + 1);
    if (b <= a) continue;
    const P = L.g.pts.map((p, i) => ({ x: p.x, y: -p.y, z: zs.get(L.id)[i] })), D = sampleLimb(P, 11, a, b);
    // helix round the limb
    const C = [], R = [], th = Math.max(...L.segs.slice(a, b).map((s) => s.th), 1.5);
    let dist = 0, prev = null;
    for (let i = 0; i < D.length; i++) {
      const c = D[i], q = D[Math.min(D.length - 1, i + 1)], p0 = D[Math.max(0, i - 1)];
      let tx = q.x - p0.x, ty = q.y - p0.y, tz = q.z - p0.z; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let ax = -ty, ay = tx, az = 0; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
      const bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax;
      if (prev) dist += Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z); prev = c;
      const ph = dist / (4.4 + th * 0.5) * Math.PI * 2, rr = th * 0.5 + 0.9, cs = Math.cos(ph), sn = Math.sin(ph);
      C.push({ x: c.x + (ax * cs + bx * sn) * rr, y: c.y + (ay * cs + by * sn) * rr, z: c.z + (az * cs + bz * sn) * rr }); R.push(0.8);
    }
    const k = w.bite ? rgbLin([200, 90, 70]) : rgbLin([226, 146, 74]);
    tube(buf, C, R, () => [k.r, k.g, k.b], 0.2, true, [k.r, k.g, k.b]);
  }
  return any ? buf.geometry(old) : null;
}
