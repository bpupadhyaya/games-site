// The 3D world for Tiger and Goat, all procedural (no bitmaps): a teak board with brass-inlaid lines and brass studs on a low stone dais in a
// moonlit bamboo clearing; carved tiger and goat figurines (a lacquered bust on a dark wood foot with a brass band, real thickness, face to the
// player). Units are centimetres; y is up; the board top is at y = TOP; grid row 0 is the far row (-z), column 0 the left.
import * as THREE from '../vendor3d/three.js';
import { board3d as B } from '../vendor3d/index.js';

export const S = 6;                    // spacing between points
export const HALF = 17;                // half the slab (34 x 34)
export const THICK = 3.2;
export const DAIS = 1.5;
export const TOP = DAIS + THICK;       // board surface
export const PR = 2.1;                 // figurine foot radius

const rnd = (s) => { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

export function gridPos(gx, gy) { return { x: (gx - 2) * S, z: (gy - 2) * S }; }
export function pointPos(i) { return gridPos(i % 5, Math.floor(i / 5)); }

export function radialTex(rgb = '255,255,255', a = 1) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}

// ------------------------------------------------------------------------------------------------ board woods (match the 2D look names)
const WOOD3 = {
  teak: { a: '#c08a46', b: '#8a5528', grain: 'rgba(60,26,4,', pale: 'rgba(255,220,160,', frame: 0x6a3d1d },
  walnut: { a: '#8a5a2c', b: '#55331a', grain: 'rgba(24,10,2,', pale: 'rgba(230,180,130,', frame: 0x3a200e },
  ash: { a: '#ead2a0', b: '#c9a56c', grain: 'rgba(120,88,48,', pale: 'rgba(255,248,225,', frame: 0x8a6a44 },
};
export const woodOf = (id) => WOOD3[id] || WOOD3.teak;

function faceMaps(id, size) {
  const W = woodOf(id), n = size, k = n / (2 * HALF), px = (cm) => (cm + HALF) * k, R = (cm) => cm * k;
  const c = canvas(n), x = c.getContext('2d'), b = canvas(n), y = b.getContext('2d'), r = rnd(7);
  const g = x.createLinearGradient(0, 0, n * 0.4, n); g.addColorStop(0, W.a); g.addColorStop(1, W.b); x.fillStyle = g; x.fillRect(0, 0, n, n);
  y.fillStyle = '#808080'; y.fillRect(0, 0, n, n);
  for (let i = 0; i < 280; i++) {
    const yy = r() * n, amp = 3 + r() * 11, ph = r() * 6, dark = r() < 0.45;
    x.strokeStyle = dark ? `${W.grain}${0.08 + r() * 0.16})` : `${W.pale}${0.03 + r() * 0.06})`;
    x.lineWidth = (0.6 + r() * (dark ? 2.6 : 1.4)) * n / 1024;
    x.beginPath();
    for (let xx = -10; xx <= n + 10; xx += n / 64) { const v = yy + Math.sin(xx / n * 6 + ph) * amp + Math.sin(xx / n * 19 + ph * 2) * amp * 0.3; xx < 0 ? x.moveTo(xx, v) : x.lineTo(xx, v); }
    x.stroke();
  }
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(30,12,0,${0.04 + r() * 0.1})`; x.fillRect(r() * n, r() * n, (0.6 + r()) * n / 1024, (1 + r() * 3) * n / 1024); }
  // engraved border rule
  x.strokeStyle = 'rgba(30,12,0,0.55)'; x.lineWidth = R(0.2); x.strokeRect(px(-HALF + 1.9), px(-HALF + 1.9), R(2 * HALF - 3.8), R(2 * HALF - 3.8));
  y.strokeStyle = '#3a3a3a'; y.lineWidth = R(0.3); y.strokeRect(px(-HALF + 1.9), px(-HALF + 1.9), R(2 * HALF - 3.8), R(2 * HALF - 3.8));
  // lines: the 5x5 grid plus the diagonals through the even points, carved as dark channels with a brass wire in them
  const gp = (v) => px((v - 2) * S), seg = [];
  for (let q = 0; q < 5; q++) { seg.push([0, q, 4, q], [q, 0, q, 4]); }
  for (let cc = 0; cc < 5; cc++) for (let rr = 0; rr < 5; rr++) if ((cc + rr) % 2 === 0) { if (cc + 1 < 5 && rr + 1 < 5) seg.push([cc, rr, cc + 1, rr + 1]); if (cc + 1 < 5 && rr - 1 >= 0) seg.push([cc, rr, cc + 1, rr - 1]); }
  const stroke = (cx, col, lw) => { cx.strokeStyle = col; cx.lineWidth = lw; cx.lineCap = 'round'; cx.beginPath(); for (const [a, bb, c2, d] of seg) { cx.moveTo(gp(a), gp(bb)); cx.lineTo(gp(c2), gp(d)); } cx.stroke(); };
  stroke(x, 'rgba(255,226,170,0.25)', R(0.62)); stroke(x, '#1e0d03', R(0.5)); stroke(x, '#c99a3c', R(0.17));
  stroke(y, '#1c1c1c', R(0.6));
  for (let i = 0; i < 25; i++) {
    const X = gp(i % 5), Y = gp(Math.floor(i / 5));
    x.fillStyle = 'rgba(14,5,0,0.8)'; x.beginPath(); x.arc(X, Y, R(1.3), 0, 7); x.fill();
    y.fillStyle = '#202020'; y.beginPath(); y.arc(X, Y, R(1.3), 0, 7); y.fill();
  }
  return { map: tex(c), bump: tex(b, false) };
}

export function buildBoard(woodId, size) {
  const grp = new THREE.Group(), W = woodOf(woodId), maps = faceMaps(woodId, size), own = [maps.map, maps.bump];
  // frame slab (rounded, real thickness) with a slightly proud face inside
  const frame = new THREE.Mesh(B.slab(2 * HALF, 2 * HALF, THICK, 1.6, 0.5), new THREE.MeshPhysicalMaterial({ color: W.frame, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.35 }));
  frame.position.y = DAIS; frame.castShadow = true; frame.receiveShadow = true; grp.add(frame);
  const faceGeo = B.slab(2 * HALF - 2.6, 2 * HALF - 2.6, 0.5, 0.8, 0.2);
  const face = new THREE.Mesh(faceGeo, new THREE.MeshPhysicalMaterial({ map: maps.map, bumpMap: maps.bump, bumpScale: 1.4, roughness: 0.36, clearcoat: 0.8, clearcoatRoughness: 0.28 }));
  face.position.y = TOP - 0.2; face.receiveShadow = true; face.castShadow = true;
  // remap uv of the face geometry to the full texture (slab uv spans 0..1 across its extent)
  { const f = (2 * HALF - 2.6) / (2 * HALF), uv = faceGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - 0.5) * f + 0.5, (uv.getY(i) - 0.5) * f + 0.5); }
  grp.add(face);
  // brass studs at the 25 points
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd2a23c, metalness: 1, roughness: 0.26, clearcoat: 0.3 });
  const stud = B.lathe([[0, 0], [1.05, 0], [1.1, 0.12], [0.95, 0.34], [0.6, 0.5], [0.0, 0.56]], 20);
  for (let i = 0; i < 25; i++) { const m = new THREE.Mesh(stud, brass), p = pointPos(i); m.position.set(p.x, TOP + 0.28, p.z); m.castShadow = false; m.receiveShadow = true; grp.add(m); }
  // brass corner caps
  const cap = B.lathe([[0, 0], [1.1, 0], [1.2, 0.2], [1.0, 0.7], [0.5, 0.95], [0, 1]], 16);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const m = new THREE.Mesh(cap, brass); m.position.set(sx * (HALF - 1.2), TOP - 0.2, sz * (HALF - 1.2)); m.castShadow = true; grp.add(m); }
  // stone dais
  const stone = new THREE.MeshStandardMaterial({ map: stoneTex(), color: 0xa7a89c, roughness: 0.9, metalness: 0 });
  const dais = new THREE.Mesh(B.slab(2 * HALF + 7, 2 * HALF + 7, DAIS, 1.2, 0.35), stone); dais.receiveShadow = true; dais.castShadow = true; grp.add(dais);
  own.push(stone.map);
  grp.userData.dispose = () => { own.forEach((t) => t.dispose()); faceGeo.dispose(); };
  return grp;
}

let stoneT = null;
function stoneTex() {
  if (stoneT) return stoneT;
  const n = 512, c = canvas(n), x = c.getContext('2d'), r = rnd(3);
  x.fillStyle = '#7d8174'; x.fillRect(0, 0, n, n);
  for (let i = 0; i < 1400; i++) { const v = 90 + r() * 90; x.fillStyle = `rgba(${v},${v + 4},${v - 6},${0.1 + r() * 0.2})`; x.beginPath(); x.arc(r() * n, r() * n, 1 + r() * 7, 0, 7); x.fill(); }
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(58,92,48,${0.04 + r() * 0.1})`; x.beginPath(); x.arc(r() * n, r() * n, 3 + r() * 14, 0, 7); x.fill(); }
  stoneT = tex(c); stoneT.wrapS = stoneT.wrapT = THREE.RepeatWrapping; return stoneT;
}

// ------------------------------------------------------------------------------------------------ the figurines
const SETCOL = {
  classic: { fur: '#e2862a', fur2: '#c76a1a', cream: '#f6ecd4', stripe: '#1a1008', nose: '#d9847a', eye: '#f4d34a', goat: '#e8d4a6', goat2: '#a88358', horn: '#f3ecd8', ring: '#7a7262', beard: '#e9dfc6', hoof: '#2a1b10' },
  snow: { fur: '#eef1f8', fur2: '#cfd6e6', cream: '#ffffff', stripe: '#343c52', nose: '#d9a0a6', eye: '#8fd0f0', goat: '#f4f2ee', goat2: '#d9d4cc', horn: '#c9ced8', ring: '#8b93a6', beard: '#ffffff', hoof: '#3a3a44' },
};
const FOOT = '#34200f', BAND = '#d2a23c';
const _o = new THREE.Object3D();
function part(list, geo, color, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0]) {
  _o.position.set(...p); _o.scale.set(...s); _o.rotation.set(...r); _o.updateMatrix();
  geo.applyMatrix4(_o.matrix); list.push({ geo, color: new THREE.Color(color) });
}
const sph = (rad, w = 24, h = 16) => new THREE.SphereGeometry(rad, w, h);
function seg(list, a, b, r0, r1, color) {          // tapered cylinder from point a to b
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 10); g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  const m = new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1)); g.applyMatrix4(m); list.push({ geo: g, color: new THREE.Color(color) });
}
function merge(list) {
  let n = 0; const gs = list.map(({ geo }) => { const g = geo.index ? geo.toNonIndexed() : geo; n += g.attributes.position.count; return g; });
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
  gs.forEach((g, i) => {
    if (!g.attributes.normal) g.computeVertexNormals();
    P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3);
    const c = list[i].color; for (let k = 0; k < g.attributes.position.count; k++) { C[(o + k) * 3] = c.r; C[(o + k) * 3 + 1] = c.g; C[(o + k) * 3 + 2] = c.b; }
    o += g.attributes.position.count;
  });
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  list.forEach((l) => l.geo.dispose()); gs.forEach((g) => g.dispose()); return out;
}
function footParts(list) {
  list.push({ geo: B.lathe([[0, 0], [2.1, 0], [2.18, 0.14], [2.1, 0.5], [1.75, 0.66], [1.42, 0.9], [0, 0.9]], 36), color: new THREE.Color(FOOT) });
  const t = new THREE.TorusGeometry(2.02, 0.12, 8, 36); t.rotateX(Math.PI / 2); t.translate(0, 0.42, 0); list.push({ geo: t, color: new THREE.Color(BAND) });
}

// a flat dark patch lying ON an ellipsoid (centre c, radii r), at azimuth u (from +z toward +x) and elevation v: stripes that hug the fur
function patch(list, color, c, r, u, v, len, wid, roll = 0) {
  const d = new THREE.Vector3(Math.cos(v) * Math.sin(u), Math.sin(v), Math.cos(v) * Math.cos(u));
  const n = new THREE.Vector3(d.x / r[0], d.y / r[1], d.z / r[2]).normalize();
  const k = 1 / Math.sqrt((d.x / r[0]) ** 2 + (d.y / r[1]) ** 2 + (d.z / r[2]) ** 2);
  const p = new THREE.Vector3(c[0] + d.x * k * 0.985, c[1] + d.y * k * 0.985, c[2] + d.z * k * 0.985);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n).premultiply(new THREE.Quaternion().setFromAxisAngle(n, roll));
  const g = new THREE.SphereGeometry(1, 12, 8); g.applyMatrix4(new THREE.Matrix4().compose(p, q, new THREE.Vector3(wid, len, 0.12)));
  list.push({ geo: g, color: new THREE.Color(color) });
}
// ---- quadruped figures. Local frame: forward = +x, up = +y, ground y = 0, left/right = +/-z. Centimetres at native size (tiger ~8 long, goat ~5).
const ell = (L, color, c, r, rot = [0, 0, 0]) => part(L, sph(1, 16, 12), color, c, r, rot);
const unit = (n) => { const l = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / l, n[1] / l, n[2] / l]; };
// a tapered line of fur / stripe drawn along directions `ns` (unit-sphere directions) over an ellipsoid (centre c, radii r)
function stripe(L, color, c, r, ns, w0, w1 = w0 * 0.35) {
  const P = ns.map((n) => { const u = unit(n); return [c[0] + r[0] * u[0], c[1] + r[1] * u[1], c[2] + r[2] * u[2]]; });
  for (let k = 0; k < P.length - 1; k++) {
    const t0 = k / (P.length - 1), t1 = (k + 1) / (P.length - 1);
    const A = new THREE.Vector3(...P[k]), Bv = new THREE.Vector3(...P[k + 1]), d = Bv.clone().sub(A), len = d.length(); if (len < 1e-4) continue;
    const g = new THREE.CylinderGeometry(w0 + (w1 - w0) * t1, w0 + (w1 - w0) * t0, len, 6); g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1))); L.push({ geo: g, color: new THREE.Color(color) });
  }
}
function limb(L, color, pts, r0, r1) {      // a chain of tapered segments with round joints
  for (let k = 0; k < pts.length - 1; k++) {
    const t0 = k / (pts.length - 1), t1 = (k + 1) / (pts.length - 1), a = r0 + (r1 - r0) * t0, b = r0 + (r1 - r0) * t1;
    seg(L, pts[k], pts[k + 1], a, b, color); ell(L, color, pts[k + 1], [b, b, b]);
  }
}
const meridian = (u, v0, v1, n = 7) => Array.from({ length: n }, (_, i) => { const v = v0 + ((v1 - v0) * i) / (n - 1); return [Math.cos(v) * Math.sin(u), Math.sin(v), Math.cos(v) * Math.cos(u)]; });

function tigerGeo(C) {
  const L = [], BC = [-0.1, 2.0, 0], BR = [2.25, 1.08, 0.95];
  ell(L, C.fur, BC, BR); ell(L, C.cream, [-0.05, 1.45, 0], [1.9, 0.62, 0.7]);
  ell(L, C.fur, [1.35, 2.05, 0], [1.05, 1.08, 0.9]); ell(L, C.fur, [-1.45, 2.0, 0], [1.0, 1.0, 0.86]);
  for (const s of [-1, 1]) {
    ell(L, C.fur, [1.25, 1.55, s * 0.62], [0.55, 0.85, 0.42]); ell(L, C.fur, [-1.5, 1.6, s * 0.7], [0.7, 0.85, 0.42]);
    limb(L, C.fur, [[1.25, 1.35, s * 0.55], [1.3, 0.8, s * 0.55], [1.45, 0.3, s * 0.52]], 0.4, 0.3);
    limb(L, C.fur, [[-1.45, 1.35, s * 0.6], [-1.75, 0.8, s * 0.58], [-1.5, 0.3, s * 0.54]], 0.42, 0.3);
    ell(L, C.cream, [1.6, 0.2, s * 0.52], [0.48, 0.22, 0.38]); ell(L, C.cream, [-1.4, 0.2, s * 0.56], [0.5, 0.22, 0.38]);
  }
  limb(L, C.fur, [[1.8, 2.25, 0], [2.5, 2.5, 0]], 0.78, 0.7);
  const HC = [3.0, 2.55, 0], HR = [0.9, 0.78, 0.84];
  ell(L, C.fur, HC, HR); ell(L, C.cream, [3.72, 2.35, 0], [0.5, 0.38, 0.5]);
  for (const s of [-1, 1]) {
    ell(L, C.cream, [3.78, 2.25, s * 0.26], [0.3, 0.24, 0.26]); ell(L, C.cream, [2.95, 2.2, s * 0.72], [0.55, 0.4, 0.34]);
    ell(L, C.fur, [2.7, 3.22, s * 0.58], [0.3, 0.36, 0.17]); ell(L, '#2a1812', [2.76, 3.2, s * 0.6], [0.2, 0.24, 0.1]);
    ell(L, C.eye, [3.62, 2.72, s * 0.4], [0.15, 0.13, 0.12]); ell(L, C.stripe, [3.73, 2.72, s * 0.42], [0.06, 0.1, 0.06]);
    stripe(L, C.stripe, HC, HR, [[0.82, 0.38, s * 0.3], [0.7, 0.45, s * 0.5], [0.52, 0.5, s * 0.66]], 0.07, 0.04);
    for (let k = 0; k < 3; k++) stripe(L, C.stripe, HC, HR, [[0.15 + k * 0.1, 0.15 - k * 0.2, s * 0.98], [0.5 + k * 0.1, 0.12 - k * 0.2, s * 0.85]], 0.075, 0.03);
  }
  ell(L, C.nose, [4.17, 2.45, 0], [0.12, 0.1, 0.16]);
  for (const z of [-0.22, 0, 0.22]) stripe(L, C.stripe, HC, HR, [[0.05, 1, z], [0.45, 0.9, z * 1.2], [0.75, 0.62, z * 1.1]], 0.075, 0.03);
  for (const side of [0, Math.PI]) for (const u of [-1.2, -0.85, -0.5, -0.15, 0.2, 0.55, 0.9]) {
    const uu = side + (side ? -u : u), top = 1.28 - Math.abs(u) * 0.18, bot = -0.05 - Math.abs(u) * 0.2;
    stripe(L, C.stripe, BC, BR, meridian(uu, top, bot, 6), 0.11, 0.035);
  }
  const tail = [[-2.35, 2.15, 0], [-3.0, 1.95, 0.15], [-3.55, 2.3, 0.3], [-3.7, 2.95, 0.3], [-3.45, 3.45, 0.2]];
  for (let k = 0; k < tail.length - 1; k++) { const t = k / 3; seg(L, tail[k], tail[k + 1], 0.26 - t * 0.04, 0.24 - t * 0.04, k % 2 || k === tail.length - 2 ? C.stripe : C.fur); ell(L, k % 2 ? C.stripe : C.fur, tail[k + 1], [0.24, 0.24, 0.24]); }
  return merge(L);
}

function goatGeo(C) {
  const L = [], BC = [0, 2.0, 0], BR = [1.55, 0.78, 0.64], fur2 = C.goat2;
  ell(L, C.goat, BC, BR); ell(L, C.goat, [-1.0, 2.0, 0], [0.75, 0.7, 0.58]); ell(L, C.goat, [0.95, 2.1, 0], [0.75, 0.74, 0.58]);
  stripe(L, fur2, BC, BR, [[-0.9, 0.62, 0], [-0.2, 0.9, 0], [0.5, 0.82, 0]], 0.12, 0.08);
  for (const s of [-1, 1]) {
    limb(L, C.goat, [[0.95, 1.55, s * 0.34], [1.0, 0.95, s * 0.32], [1.05, 0.28, s * 0.3]], 0.2, 0.12);
    limb(L, C.goat, [[-1.0, 1.55, s * 0.36], [-1.2, 1.0, s * 0.33], [-1.05, 0.28, s * 0.3]], 0.24, 0.12);
    for (const x of [1.05, -1.05]) seg(L, [x, 0.3, s * 0.3], [x, 0.0, s * 0.3], 0.15, 0.17, C.hoof);
    ell(L, fur2, [2.0, 3.28, s * 0.58], [0.22, 0.09, 0.46], [s * 0.35, 0, -0.12]);
    ell(L, C.eye, [2.42, 3.3, s * 0.3], [0.13, 0.12, 0.1]); ell(L, C.stripe, [2.5, 3.31, s * 0.33], [0.05, 0.03, 0.09]);
    const hp = [[2.2, 3.48, s * 0.17], [2.0, 3.95, s * 0.27], [1.65, 4.35, s * 0.38], [1.25, 4.55, s * 0.47], [0.9, 4.55, s * 0.52]];
    for (let k = 0; k < hp.length - 1; k++) { const t0 = k / 4, t1 = (k + 1) / 4; seg(L, hp[k], hp[k + 1], 0.2 * (1 - t0 * 0.7), 0.2 * (1 - t1 * 0.7), k % 2 ? C.ring : C.horn); }
  }
  limb(L, C.goat, [[1.15, 2.3, 0], [1.75, 2.95, 0]], 0.5, 0.36);
  ell(L, C.goat, [2.3, 3.1, 0], [0.66, 0.43, 0.38], [0, 0, -0.32]); ell(L, C.beard, [2.85, 2.9, 0], [0.42, 0.28, 0.3], [0, 0, -0.32]);
  ell(L, C.stripe, [3.2, 2.8, 0], [0.1, 0.08, 0.14]); seg(L, [2.85, 2.7, 0], [2.7, 2.1, 0], 0.11, 0.03, C.beard);
  seg(L, [-1.6, 2.35, 0], [-1.95, 2.85, 0], 0.15, 0.07, C.goat);
  return merge(L);
}

export function figurines(set = 'classic') {
  const C = SETCOL[set] || SETCOL.classic;
  return { T: tigerGeo(C), G: goatGeo(C) };
}
export function figMaterial() { return new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.0, clearcoat: 0.55, clearcoatRoughness: 0.3 }); }

// ------------------------------------------------------------------------------------------------ the clearing
function mossTex() {
  const n = 512, c = canvas(n), x = c.getContext('2d'), r = rnd(9);
  x.fillStyle = '#1d2c1c'; x.fillRect(0, 0, n, n);
  for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(${40 + r() * 40},${70 + r() * 50},${34 + r() * 30},${0.1 + r() * 0.2})`; x.beginPath(); x.arc(r() * n, r() * n, 1 + r() * 6, 0, 7); x.fill(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); return t;
}
export function buildClearing(scene) {
  const grp = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 48), new THREE.MeshStandardMaterial({ map: mossTex(), color: 0x9fb89a, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; grp.add(ground);
  // bamboo: instanced stalks with nodes
  const prof = []; const h = 150, nodes = 10;
  for (let i = 0; i <= nodes; i++) { const y = (i / nodes) * h, r = 1.5 * (1 - 0.35 * i / nodes); prof.push([r, y], [r + 0.22, y + 0.35], [r, y + 0.9]); }
  prof.unshift([0, 0]); prof.push([0, h]);
  const geo = B.lathe(prof, 10);
  const mat = new THREE.MeshStandardMaterial({ color: 0x5f8a3e, roughness: 0.55 });
  const rr = rnd(21), N = 70, inst = new THREE.InstancedMesh(geo, mat, N), m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    let a = rr() * Math.PI * 2, d = 58 + rr() * 120, x = Math.cos(a) * d, z = Math.sin(a) * d - 10; if (z > 0 && Math.abs(x) < 80) { z = -z - 20; } const s = 0.8 + rr() * 0.9;
    m4.compose(new THREE.Vector3(x, -2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rr() - 0.5) * 0.1, 0, (rr() - 0.5) * 0.1)), new THREE.Vector3(s, 0.9 + rr() * 0.8, s));
    inst.setMatrixAt(i, m4); inst.setColorAt(i, col.setHSL(0.24 + rr() * 0.05, 0.4, 0.22 + rr() * 0.12));
  }
  inst.castShadow = true; grp.add(inst);
  // leafy canopy silhouettes: dark planes high up
  const leafT = leafTex(), leafM = new THREE.MeshBasicMaterial({ map: leafT, transparent: true, depthWrite: false, fog: true, opacity: 0.85 });
  for (let i = 0; i < 26; i++) {
    const a = rr() * Math.PI * 2, d = 70 + rr() * 90, p = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), leafM);
    p.position.set(Math.cos(a) * d, 85 + rr() * 55, Math.sin(a) * d - 10); p.lookAt(0, 40, 30); p.rotation.z = (rr() - 0.5) * 0.8; grp.add(p);
  }
  // paper lanterns hanging by the dais
  const lanterns = [];
  for (const [x, y, z, hue] of [[-40, 26, -34, 0], [42, 28, -40, 1]]) {
    const L = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(3.2, 20, 14), new THREE.MeshBasicMaterial({ color: hue === 1 ? 0xffc27a : 0xffa860, fog: false })); body.scale.set(1, 1.25, 1); L.add(body);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: radialTex('255,170,90', 0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.name = 'halo'; L.add(halo);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 40, 4), new THREE.MeshBasicMaterial({ color: 0x241a10 })); cord.position.y = 23; L.add(cord);
    L.position.set(x, y, z); grp.add(L); lanterns.push(L);
  }
  // moon
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ map: radialTex('210,225,255', 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  moon.position.set(-90, 150, -230); moon.lookAt(0, 40, 40); grp.add(moon);
  // fireflies
  const FN = 70, fp = new Float32Array(FN * 3), seed = [];
  for (let i = 0; i < FN; i++) { seed.push([rr() * 6.28, rr() * 6.28, 0.4 + rr() * 0.8]); fp[i * 3] = (rr() - 0.5) * 120; fp[i * 3 + 1] = 4 + rr() * 30; fp[i * 3 + 2] = (rr() - 0.5) * 90 - 10; }
  const base = fp.slice(), fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const flies = new THREE.Points(fg, new THREE.PointsMaterial({ map: radialTex('220,255,150', 1), size: 2.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }));
  flies.frustumCulled = false; grp.add(flies);
  scene.add(grp);
  return {
    group: grp, lanterns,
    update(t, calm) {
      const a = fg.attributes.position.array;
      for (let i = 0; i < FN; i++) { const s = seed[i]; a[i * 3] = base[i * 3] + Math.sin(t * 0.3 * s[2] + s[0]) * 7; a[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.5 * s[2] + s[1]) * 3; a[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.27 * s[2] + s[0]) * 6; }
      fg.attributes.position.needsUpdate = true; flies.material.opacity = calm ? 0.5 : 0.65 + 0.3 * Math.sin(t * 1.7);
      lanterns.forEach((L, i) => { L.rotation.z = calm ? 0 : Math.sin(t * 0.6 + i * 2) * 0.03; const h = L.getObjectByName('halo'); h.material.opacity = 0.62 + (calm ? 0 : 0.1 * Math.sin(t * 3 + i)); });
    },
  };
}
function leafTex() {
  const c = canvas(256, 128), x = c.getContext('2d'), r = rnd(5);
  x.fillStyle = 'rgba(8,22,14,0.95)';
  for (let i = 0; i < 70; i++) { const px = r() * 256, py = r() * 128, a = (r() - 0.5) * 1.6; x.save(); x.translate(px, py); x.rotate(a); x.beginPath(); x.ellipse(0, 0, 3 + r() * 4, 22 + r() * 18, 0, 0, 7); x.fill(); x.restore(); }
  return tex(c);
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0x9db6e8, 0x1c2a1a, 0.45); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xbcd0ff, 1.15); sun.position.set(-36, 70, 36); sun.target.position.set(0, TOP, 0); scene.add(sun, sun.target);
  sun.shadow.camera.left = -34; sun.shadow.camera.right = 34; sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34; sun.shadow.camera.near = 10; sun.shadow.camera.far = 200; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  const warm = new THREE.PointLight(0xff9a50, 2400, 140, 1.7); warm.position.set(24, 26, 22); scene.add(warm);
  const warm2 = new THREE.PointLight(0xffb070, 1500, 120, 1.7); warm2.position.set(-30, 20, -12); scene.add(warm2);
  const rim = new THREE.DirectionalLight(0xffc890, 0.5); rim.position.set(30, 20, -50); scene.add(rim);
  return { hemi, sun, warm, warm2, rim };
}
