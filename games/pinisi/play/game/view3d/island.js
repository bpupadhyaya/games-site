// Islands as real lit terrain: sand beach, jungle canopy, palms with swaying fronds, stilt houses with thatched roofs, jetties, a volcano.
// One merged mesh per island with vertex colours and a per-vertex sway weight (the material bends fronds/leaves in the wind).
import { THREE } from '../vendor3d/index.js';
import { TAU, clamp, lerp, smooth, hash1, fbm2, mergeParts, mat4 } from './util.js';
import { islandRadius } from './sea.js';

const { MeshStandardMaterial, Mesh, Group, BufferGeometry, Float32BufferAttribute, Color, CylinderGeometry, BoxGeometry, SphereGeometry } = THREE;
const CylinderGeo = CylinderGeometry;

const SAND = new Color('#f0dcab'), SAND2 = new Color('#d9bd82'), WET = new Color('#bfa670');
const GREENS = ['#2f7d4f', '#3b8f55', '#2a6e45', '#4a9d5a', '#1f5a3a'].map((c) => new Color(c));
const ROCK = new Color('#7a6a58'), ASH = new Color('#5a4a42');

export function islandMaterial(uni) {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWindT = uni.uWindT; sh.uniforms.uWindK = uni.uWindK;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSway; uniform float uWindT; uniform float uWindK;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float sw = aSway * uWindK;
        transformed.x += sin(uWindT * 1.7 + position.x * 0.9 + position.z * 0.6) * 0.07 * sw;
        transformed.z += cos(uWindT * 1.3 + position.z * 0.8 + position.x * 0.5) * 0.06 * sw;
        transformed.y += sin(uWindT * 2.3 + position.x * 1.7) * 0.025 * sw;`);
  };
  return m;
}

// terrain height at world offset (dx, dz) from the island centre
export function makeTerrain(R, seed, kind) {
  const vol = kind === 'volcano', hill = vol ? 0 : 1.6 + 1.2 * hash1(seed);
  const outline = (th) => islandRadius(R, seed, th);
  const height = (dx, dz) => {
    const th = Math.atan2(dz / 0.82, dx), r = Math.hypot(dx, dz / 0.82), Ro = outline(th), q = r / Ro;
    if (q >= 1.45) return -0.6;
    const t = 1 - q;                                         // 0 shore .. 1 centre
    let h;
    if (t <= 0) h = -0.5 * smooth(0, 0.45, -t) - 0.02;      // underwater slope
    else {
      const beach = smooth(0, 0.18, t) * 0.34;
      const rise = smooth(0.12, 0.85, t);
      const bumps = (fbm2(dx * 0.22 + seed, dz * 0.22, seed, 3) - 0.35) * 1.9;
      h = beach + rise * (hill + bumps * 0.9);
      if (vol) { const cone = Math.pow(smooth(0.0, 0.9, t), 1.35); h = beach + cone * 7.4; if (t > 0.86) h -= (t - 0.86) * 9.5; }
    }
    return h;
  };
  return { outline, height };
}

function terrainGeo(R, seed, kind) {
  const { height } = makeTerrain(R, seed, kind), vol = kind === 'volcano';
  const NR = 22, NT = 56, pos = [], col = [], nor = [], idx = [], sway = [];
  for (let i = 0; i <= NR; i++) for (let j = 0; j <= NT; j++) {
    const th = (j % NT) / NT * TAU, Ro = islandRadius(R, seed, th), q = (i / NR) * 1.42, r = q * Ro;
    const dx = Math.cos(th) * r, dz = Math.sin(th) * r * 0.82, h = height(dx, dz);
    pos.push(dx, h, dz); nor.push(0, 1, 0); sway.push(0);
    const t = 1 - q, n = fbm2(dx * 0.6, dz * 0.6, seed + 3, 3);
    let c;
    if (t <= 0) c = WET.clone().lerp(SAND2, smooth(-0.15, 0, t));
    else if (t < 0.17) c = SAND.clone().lerp(SAND2, n * 0.5).lerp(new Color('#6fa35a'), smooth(0.1, 0.17, t));
    else {
      c = GREENS[Math.floor(n * 4.99) % 5].clone().lerp(GREENS[(Math.floor(n * 4.99) + 1) % 5], 0.5);
      if (vol) c = ASH.clone().lerp(ROCK, n).lerp(GREENS[0], smooth(0.5, 0.2, t) * 0.8);
      c.multiplyScalar(0.8 + 0.4 * h / 3);
    }
    col.push(c.r, c.g, c.b);
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NT; j++) { const a = i * (NT + 1) + j, b = a + 1, c = a + NT + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.setAttribute('aSway', new Float32BufferAttribute(sway, 1)); g.setIndex(idx);
  g.computeVertexNormals();
  void vol;
  return g;
}

// ---- props -----------------------------------------------------------------------------------------------------------------------------
export function palmParts(x, y, z, h, seed, lean = 0.2) {
  const parts = [], trunkC = new Color('#7a5a38'), frondC = new Color('#2f8a4a');
  const ang = hash1(seed * 3.3) * TAU, lx = Math.cos(ang) * lean, lz = Math.sin(ang) * lean;
  const seg = 5;
  for (let s = 0; s < seg; s++) {
    const t0 = s / seg, t1 = (s + 1) / seg, geo = new CylinderGeo(0.06 * (1 - t1 * 0.4), 0.075 * (1 - t0 * 0.4), h / seg * 1.02, 6);
    const cx = x + lx * h * (t0 + t1) / 2 * (t0 + t1) / 2 * 1.2, cz = z + lz * h * ((t0 + t1) / 2) ** 2 * 1.2;
    const m = mat4(cx, y + (t0 + t1) / 2 * h, cz, 0, 1, 1, 1, lz * (t0 + t1) * 0.4, -lx * (t0 + t1) * 0.4);
    parts.push({ geo, m, color: trunkC.clone().multiplyScalar(0.8 + 0.4 * hash1(seed + s)), sway: t1 * 0.25 });
  }
  const topX = x + lx * h * 1.2, topZ = z + lz * h * 1.2;
  const nF = 7;
  for (let f = 0; f < nF; f++) {
    const a = f / nF * TAU + hash1(seed + f * 1.3) * 0.5, len = h * (0.62 + 0.18 * hash1(seed + f)), droop = 0.9 + 0.5 * hash1(seed * 2 + f);
    // frond: 3 quads arching outward and down
    const prev = [topX, y + h, topZ];
    for (let k = 1; k <= 3; k++) {
      const t = k / 3, ox = Math.cos(a) * len * t, oz = Math.sin(a) * len * t, oy = Math.sin(t * 1.6) * len * 0.28 - t * t * len * 0.5 * droop;
      const cur = [topX + ox, y + h + oy, topZ + oz];
      const dx = cur[0] - prev[0], dy = cur[1] - prev[1], dz = cur[2] - prev[2], L = Math.hypot(dx, dy, dz);
      const geo = new BoxGeometry(L, 0.012, len * 0.22 * (1 - t * 0.55));
      const m = mat4((prev[0] + cur[0]) / 2, (prev[1] + cur[1]) / 2, (prev[2] + cur[2]) / 2, -Math.atan2(dz, dx), 1, 1, 1, 0, Math.atan2(dy, Math.hypot(dx, dz)));
      parts.push({ geo, m, color: frondC.clone().multiplyScalar(0.75 + 0.5 * hash1(seed + f * 7 + k)), sway: 0.6 + t });
      prev[0] = cur[0]; prev[1] = cur[1]; prev[2] = cur[2];
    }
  }
  return parts;
}
export function hutParts(x, y, z, rot, s = 1) {
  const parts = [], wood = new Color('#8a6038'), thatch = new Color('#c8aa62');
  const add = (geo, m, color, sway = 0) => parts.push({ geo, m, color, sway });
  const m0 = (px, py, pz, sx = 1, sy = 1, sz = 1) => { // local -> world with rotation about Y
    const c = Math.cos(rot), sn = Math.sin(rot); return mat4(x + (px * c + pz * sn) * s, y + py * s, z + (-px * sn + pz * c) * s, rot, sx * s, sy * s, sz * s);
  };
  for (const [px, pz] of [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]]) add(new CylinderGeo(0.05, 0.05, 0.8, 5), m0(px, 0.35, pz), wood);
  add(new BoxGeometry(1.25, 0.08, 1.05), m0(0, 0.78, 0), wood);
  add(new BoxGeometry(1.1, 0.55, 0.9), m0(0, 1.08, 0), new Color('#b88a56'));
  const roof = new CylinderGeometry(0, 1.0, 0.8, 4, 1); roof.rotateY(Math.PI / 4);
  add(roof, m0(0, 1.7, 0, 1.0, 1, 0.85), thatch);
  return parts;
}
function jettyParts(x, y, z, dirX, dirZ, len) {
  const parts = [], wood = new Color('#7a5836'), ang = Math.atan2(dirZ, dirX);
  const px = x + dirX * len / 2, pz = z + dirZ * len / 2;
  parts.push({ geo: new BoxGeometry(len, 0.08, 0.7), m: mat4(px, y + 0.38, pz, -ang, 1, 1, 1), color: wood.clone().multiplyScalar(1.2), sway: 0 });
  for (let k = 0; k <= len; k += 1.2) for (const sd of [-0.3, 0.3]) {
    const qx = x + dirX * k - dirZ * sd, qz = z + dirZ * k + dirX * sd;
    parts.push({ geo: new CylinderGeo(0.05, 0.05, 1.0, 5), m: mat4(qx, y + 0.0, qz), color: wood, sway: 0 });
  }
  return parts;
}
function canopyParts(x, y, z, r, seed) {
  const c = GREENS[Math.floor(hash1(seed) * 4.99)].clone().multiplyScalar(0.85 + 0.3 * hash1(seed + 1));
  return [{ geo: new SphereGeometry(1, 7, 5), m: mat4(x, y + r * 0.45, z, hash1(seed) * 3, r, r * 0.8, r), color: c, sway: 0.5 }];
}

// ---- island builder ----------------------------------------------------------------------------------------------------------------------
// opts: { R (radius in world units), seed, kind: 'port'|'islet'|'volcano', village, jetty (angle rad toward the sea), yard }
export function buildIsland(opts, material) {
  const { R, seed, kind = 'islet' } = opts;
  const { height, outline } = makeTerrain(R, seed, kind);
  const terr = terrainGeo(R, seed, kind);
  const parts = [{ geo: terr, m: mat4(0, 0, 0), color: 0xffffff, raw: true }];
  const place = (q0, q1, count, fn, salt) => {
    for (let i = 0; i < count; i++) {
      const th = hash1(seed * 7.7 + i * 1.9 + salt) * TAU, q = lerp(q0, q1, hash1(seed * 3.1 + i * 5.3 + salt));
      const dx = Math.cos(th) * outline(th) * q, dz = Math.sin(th) * outline(th) * q * 0.82, h = height(dx, dz);
      if (h < 0.1) continue;
      fn(dx, h, dz, i);
    }
  };
  const vol = kind === 'volcano', nPalm = Math.round(R * (vol ? 0.7 : 1.15)), nCan = Math.round(R * (vol ? 0.5 : 1.6));
  place(0.12, 0.62, nCan, (dx, h, dz, i) => { parts.push(...canopyParts(dx, h - 0.1, dz, 0.9 + 0.8 * hash1(seed + i), seed * 10 + i)); }, 11);
  place(0.55, 0.88, nPalm, (dx, h, dz, i) => { parts.push(...palmParts(dx, h, dz, 2.0 + 1.1 * hash1(seed + i * 3), seed * 100 + i, 0.18 + 0.12 * hash1(i + seed))); }, 5);
  if (kind === 'port') {
    const nH = 3 + Math.round(hash1(seed + 9) * 2), baseAng = opts.jetty ?? 0;
    for (let i = 0; i < nH; i++) {
      const th = baseAng + (i - (nH - 1) / 2) * 0.55 + (hash1(seed + i) - 0.5) * 0.3, q = 0.5 + 0.12 * hash1(seed * 2 + i);
      const dx = Math.cos(th) * outline(th) * q, dz = Math.sin(th) * outline(th) * q * 0.82, h = Math.max(0.25, height(dx, dz));
      parts.push(...hutParts(dx, h - 0.1, dz, -th + Math.PI / 2, 0.9));
    }
    const th = baseAng, jx = Math.cos(th) * outline(th) * 0.8, jz = Math.sin(th) * outline(th) * 0.8 * 0.82;
    parts.push(...jettyParts(jx, 0, jz, Math.cos(th), Math.sin(th), 3.4));
  }
  // merge, writing the sway attribute
  const merged = (() => {
    const pos = [], nor = [], col = [], sw = [], idx = []; let base = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    for (const p of parts) {
      const g = p.geo, pa = g.attributes.position, na = g.attributes.normal, ca = p.raw ? g.attributes.color : null, sa = p.raw ? g.attributes.aSway : null;
      const m = p.m; nm.getNormalMatrix(m); const c = new Color(p.color ?? 0xffffff);
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
        if (na) { v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); } else nor.push(0, 1, 0);
        if (ca) col.push(ca.getX(i), ca.getY(i), ca.getZ(i)); else col.push(c.r, c.g, c.b);
        sw.push(sa ? sa.getX(i) : (p.sway ?? 0));
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base); else for (let i = 0; i < pa.count; i++) idx.push(i + base);
      base += pa.count;
    }
    const o = new BufferGeometry();
    o.setAttribute('position', new Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new Float32BufferAttribute(nor, 3));
    o.setAttribute('color', new Float32BufferAttribute(col, 3)); o.setAttribute('aSway', new Float32BufferAttribute(sw, 1)); o.setIndex(idx);
    return o;
  })();
  const mesh = new Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true;
  const g = new Group(); g.add(mesh);
  g.userData = { height, outline, R, kind };
  void mergeParts; void clamp;
  return g;
}
