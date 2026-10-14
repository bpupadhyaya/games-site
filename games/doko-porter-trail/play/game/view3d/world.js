// The Himalayan hillside as a real 3D place: sky dome, snow ranges, terraced hills with stone risers, the trail ribbon, stone steps,
// a suspension bridge over a gorge, rest platforms (chautara) under a big tree, the village at the end, rhododendron, pines, mist,
// rain and wind. Everything is a pure function of the trail and the clock; nothing here touches the sim.
//
// World frame: +x is along the trail (metres from the start), +y is up (metres, = the sim's ground height), the trail's centre line is
// z = 0, uphill (the mountain) is -z, the valley is +z (toward the camera).
import { THREE, board3d as B } from '../vendor3d/index.js';
import { groundY, segAt, K } from '../src/engine.js';
import { skyAt } from '../src/scene.js';
import { clamp, lerp, smooth, hash, hash2, noise, fbm, noise2, rngOf, detailTexture, terraceTexture, stoneTexture, softTexture, cloudTexture, waterTexture, TAU, shadeHex } from './art.js';

const { Vector3, Color } = THREE;
const mat = (c, rough = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, ...extra });
const PATH_HALF = 0.85;
const LEDGE_Z0 = 10.4;                        // the mule track runs along z = -10.4
const CH = 20, DX = 0.5;                      // terrain chunk length (m) and column spacing
const ZROWS = (() => {
  const z = [];
  const run = (a, b, s) => { for (let v = a; v < b - 1e-6; v += s) z.push(+v.toFixed(3)); };
  run(-56, -22, 4); run(-22, -9, 1.0); run(-9, -2.4, 0.4); run(-2.4, 2.4, 0.4); run(2.4, 9, 0.4); run(9, 21, 1.0); run(21, 51, 3); z.push(51);
  return z;
})();

// ---- terraces: heights relative to the trail ---------------------------------------------------------------------------------
function terraceStack(x, seed, up) {
  // returns cumulative offsets and rises for 9 terraces at this x
  const o = [], r = [];
  let acc = up ? 0.55 : 0.5;
  for (let k = 0; k < 9; k++) {
    const w = (up ? 2.5 + 0.55 * k : 2.1 + 0.62 * k) * (0.78 + 0.5 * noise(x * 0.045 + k * 7.3, seed));
    const rise = (up ? 1.15 : 1.0) * (0.75 + 0.9 * noise(x * 0.04 + k * 13.1, seed + 5));
    acc += w; o.push(acc); r.push(rise);
  }
  return { o, r };
}
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// u >= 0: distance from the trail's edge (metres). Up: terraces climb; down: terraces fall to the river.
function terraceHeight(st, u, up, x) {
  let e = 0; const RW = up ? 0.3 : 0.36;
  const wob = (noise(x * 0.11 + u * 0.05, up ? 17 : 29) - 0.5) * 0.9;     // walls meander along the hill
  for (let k = 0; k < 9; k++) e += st.r[k] * sstep(st.o[k] - RW + wob, st.o[k] + RW + wob, u);
  const tilt = up ? 0.035 : 0.04;                                     // terrace tops lean a little with the hill
  const beyond = Math.max(0, u - st.o[8]);
  return up ? e + tilt * Math.min(u, 30) + beyond * 0.5 : -(e + tilt * Math.min(u, 30) + beyond * 0.48);
}

export function buildWorld({ stage, quality = 'medium', trailRef }) {
  const scene = stage.scene;
  const group = new THREE.Group(); group.name = 'doko-world'; scene.add(group);
  const W = { group, trail: null, theme: 0, windV: 0.3, wind: 0.5, rain: false };
  const detail = terraceTexture();
  const low = quality === 'low', high = quality === 'high';

  // ---- terrain height field ---------------------------------------------------------------------------------------------------
  const bridges = () => (W.trail ? W.trail.segs.filter((s) => s.t === 'bridge') : []);
  const colCache = new Map();
  function column(x) {
    const key = Math.round(x * 2);
    let c = colCache.get(key);
    if (!c) {
      if (colCache.size > 400) colCache.clear();
      c = { T: groundY(W.trail, x), up: terraceStack(x, 3, true), dn: terraceStack(x, 9, false), G: 0 };
      for (const b of bridges()) {
        const a = b.x0, e = b.x1;
        if (x > a - 0.2 && x < e + 0.2) c.G = Math.max(c.G, 15 * sstep(a - 0.1, a + 2.2, x) * (1 - sstep(e - 2.2, e + 0.1, x)));
      }
      colCache.set(key, c);
    }
    return c;
  }
  function heightAt(x, z) {
    const c = column(x);
    let e;
    if (Math.abs(z) <= PATH_HALF) e = 0;
    else if (z < 0) e = terraceHeight(c.up, -z - PATH_HALF, true, x);
    else {
      const v = z - PATH_HALF;
      e = terraceHeight(c.dn, v, false, x);
      if (z > 44) e += (z - 44) * 0.9;           // the far bank of the valley
    }
    // the mule track: a second ledge higher on the hill, graded flat across so people and mules can walk it
    const dl = Math.abs(z + LEDGE_Z0);
    if (dl < 1.9) {
      const L = 4.6 + 0.9 * (fbm(x * 0.03, 41) - 0.5);
      const w = 1 - sstep(0.9, 1.9, dl);
      e = lerp(e, L, w);
    }
    return c.T + e - c.G + (fbm(x * 0.35 + z * 0.21, 7) - 0.5) * 0.08;
  }
  W.heightAt = heightAt;
  W.trailY = (x) => groundY(W.trail, x);

  // ---- terrain chunks -----------------------------------------------------------------------------------------------------------
  const terrMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, map: detail });
  const chunks = new Map();
  const PALETTE = [
    ['#5f9a45', '#7fb050', '#b3a54c', '#548f3f', '#a0ae4e', '#78a84c'],      // green valley: rice, millet, maize
    ['#c2a845', '#b09a3c', '#8fa642', '#bba556', '#a88a34', '#98a84a'],      // harvest golds
    ['#8f9a6d', '#7e8b62', '#a9a276', '#8a8f6a', '#b4ac86', '#738060'],      // high dry hills
  ];
  const STONE = ['#8a8070', '#9a9080', '#7a7264'];
  const PATH_C = ['#cdb184', '#c2a578', '#d4bb8e'];
  const tmpC = new Color();
  function buildChunk(ci) {
    const x0 = ci * CH, nx = Math.round(CH / DX) + 1, nz = ZROWS.length;
    const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), idx = [];
    const H = new Float32Array(nx * nz);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = x0 + i * DX, z = ZROWS[j], y = heightAt(x, z), n = i * nz + j;
      H[n] = y; pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z;
      uv[n * 2] = x * 0.22; uv[n * 2 + 1] = (z * 0.9 + y * 1.3) * 0.32;
    }
    const pal = PALETTE[W.theme] || PALETTE[0], tr = W.trail;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const n = i * nz + j, x = x0 + i * DX, z = ZROWS[j];
      // slope from neighbours
      const iN = Math.min(nx - 1, i + 1), iP = Math.max(0, i - 1), jN = Math.min(nz - 1, j + 1), jP = Math.max(0, j - 1);
      const dzx = (H[iN * nz + j] - H[iP * nz + j]) / ((iN - iP) * DX || 1), dzz = (H[i * nz + jN] - H[i * nz + jP]) / ((ZROWS[jN] - ZROWS[jP]) || 1);
      const steep = clamp((Math.hypot(dzx, dzz) - 0.55) / 1.6, 0, 1);
      // terrace index drives the crop colour
      const band = Math.floor((H[n] - column(x).T + 40) / 1.2), ci2 = Math.abs(Math.floor(hash2(band, Math.floor(x / 9)) * pal.length)) % pal.length;
      tmpC.set(pal[ci2]);
      const g = 0.86 + 0.28 * noise2(x * 0.6, z * 0.6, 4);
      tmpC.multiplyScalar(g);
      const far = clamp((Math.abs(z) - 12) / 40, 0, 1);
      if (z < -8) tmpC.lerp(new Color('#4f7a45'), 0.25 + far * 0.35);                  // forest cover higher up
      if (z > 30) tmpC.lerp(new Color('#4c8f68'), clamp((z - 30) / 20, 0, 0.6));
      const stone = new Color(STONE[Math.floor(hash2(i + ci * 100, j) * 3)]);
      tmpC.lerp(stone, steep * 0.92);
      // the trail itself: packed earth, paler in the middle where feet fall, flagstones on a rest platform
      const az = Math.abs(z);
      if (az < PATH_HALF + 0.55) {
        const s = tr ? segAt(tr, x) : null;
        const isRest = s && s.t === 'rest' && x >= s.x0 - 0.2 && x <= s.x1 + 0.2;
        const pc = new Color(isRest ? '#b9b2a2' : PATH_C[Math.floor(hash2(i + ci * 100, 3) * 3)]);
        pc.multiplyScalar(0.92 + 0.12 * noise2(x * 1.6, z * 3, 8));
        const w = 1 - sstep(PATH_HALF - 0.15, PATH_HALF + 0.55, az);
        tmpC.lerp(pc, w);
      }
      const dl = Math.abs(z + LEDGE_Z0);
      if (dl < 1.5) { const pc = new Color('#bda27a'); pc.multiplyScalar(0.9 + 0.15 * noise2(x * 1.4, z * 2, 12)); tmpC.lerp(pc, 1 - sstep(0.6, 1.5, dl)); }
      col[n * 3] = tmpC.r; col[n * 3 + 1] = tmpC.g; col[n * 3 + 2] = tmpC.b;
    }
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nz - 1; j++) {
      const a = i * nz + j, b = (i + 1) * nz + j, c = (i + 1) * nz + j + 1, d = i * nz + j + 1;
      idx.push(a, d, b, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, terrMat); mesh.receiveShadow = true; mesh.frustumCulled = true;
    geo.computeBoundingSphere();
    group.add(mesh);
    const ch = { mesh, extras: [] };
    scatter(ch, ci, x0);
    return ch;
  }

  // ---- scatter: trees, bushes, houses, grass tufts, stones per chunk -----------------------------------------------------------------
  // shared geometries: leaf / trunk / bloom meshes per plant kind, vertex-coloured (dark under the canopy, light on top, mottled)
  const G = {};
  const blobGeo = (r, ws, hs, seed) => {
    const g = new THREE.SphereGeometry(r, ws, hs), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.82 + 0.34 * noise2(p.getX(i) * 3.1 + seed, p.getY(i) * 3.3 + p.getZ(i) * 2.1, 5 + seed);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  };
  function finish(parts, { y0 = 0, y1 = 1, dark = 0.55, light = 1.1, seed = 0, warm = 0.0 } = {}) {
    const g = B.mergeGeos(parts), p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), t = clamp((y - y0) / (y1 - y0), 0, 1), n = noise2(p.getX(i) * 2.3 + p.getZ(i) * 1.1, y * 2.6, seed + 3);
      const k = lerp(dark, light, t) * (0.8 + 0.4 * n);
      col[i * 3] = k * (1 + warm * t); col[i * 3 + 1] = k; col[i * 3 + 2] = k * (1 - warm * 0.5 * t);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }
  function geoOf(kind) {
    if (G[kind]) return G[kind];
    const M = new THREE.Matrix4();
    const mk = (geo, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0) => ({ geo, m: M.clone().compose(new Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ry), new Vector3(sx, sy, sz)) });
    const cone = (r, h, y, seg = 9) => { const g = new THREE.CylinderGeometry(0.0001, r, h, seg); g.translate(0, y + h / 2, 0); return g; };
    const out = {};
    if (kind === 'pine') {
      out.trunk = finish([mk(new THREE.CylinderGeometry(0.1, 0.17, 1.6, 6), 0, 0.8, 0)], { y0: 0, y1: 1.6, dark: 0.7, light: 1 });
      const parts = [];
      for (let i = 0; i < 6; i++) { const r = 1.25 - i * 0.18; parts.push(mk(cone(r, 1.5, 0.9 + i * 0.85, 10), 0, 0, 0, 1 + 0.06 * Math.sin(i * 2), 1, 1 - 0.05 * Math.cos(i * 3), i * 0.7)); }
      out.leaf = finish(parts, { y0: 0.9, y1: 5.6, dark: 0.5, light: 1.15, seed: 2 });
    } else if (kind === 'broad') {
      out.trunk = finish([mk(new THREE.CylinderGeometry(0.1, 0.22, 2.4, 7), 0, 1.2, 0), mk(new THREE.CylinderGeometry(0.05, 0.1, 1.4, 5), 0.35, 2.4, 0.1, 1, 1, 1), mk(new THREE.CylinderGeometry(0.05, 0.1, 1.2, 5), -0.35, 2.3, -0.1, 1, 1, 1)], { y0: 0, y1: 3, dark: 0.7, light: 1.0 });
      const parts = [], S = [[0, 3.1, 0, 1.15], [0.95, 2.7, 0.35, 0.85], [-0.95, 2.8, -0.3, 0.9], [0.2, 3.9, -0.3, 0.8], [0.5, 2.2, -0.7, 0.6], [-0.55, 2.3, 0.7, 0.65], [0.1, 3.3, 0.9, 0.7], [-0.2, 3.5, -0.9, 0.7]];
      S.forEach(([x, y, z, r], i) => parts.push(mk(blobGeo(r, 9, 7, i), x, y, z, 1, 0.86, 1)));
      out.leaf = finish(parts, { y0: 1.8, y1: 4.6, dark: 0.5, light: 1.2, seed: 7, warm: 0.12 });
    } else if (kind === 'bush') {
      const parts = [], S = [[0, 0.5, 0, 0.62], [0.5, 0.4, 0.2, 0.46], [-0.48, 0.36, -0.2, 0.44], [0.1, 0.38, -0.5, 0.4], [-0.1, 0.78, 0.1, 0.38]];
      S.forEach(([x, y, z, r], i) => parts.push(mk(blobGeo(r, 8, 6, i + 4), x, y, z, 1.1, 0.8, 1)));
      out.leaf = finish(parts, { y0: 0, y1: 1.1, dark: 0.45, light: 1.1, seed: 11 });
      // blooms: small clusters over the top and sides
      const bp = [];
      for (let i = 0; i < 16; i++) { const a = i * 2.39, rr = 0.2 + 0.4 * ((i * 7) % 5) / 5, yy = 0.55 + 0.35 * Math.sin(i * 1.7) ** 2; bp.push(mk(new THREE.SphereGeometry(0.1, 5, 4), Math.cos(a) * rr * 1.1, yy, Math.sin(a) * rr, 1, 0.8, 1)); }
      out.bloom = finish(bp, { y0: 0.3, y1: 1.1, dark: 0.85, light: 1.1, seed: 13 });
    } else if (kind === 'tuft') {
      const parts = [];
      for (let i = 0; i < 7; i++) {
        const bl = new THREE.CylinderGeometry(0.0001, 0.02, 0.17 + (i % 3) * 0.06, 3); bl.translate(0, 0.09, 0);
        parts.push({ geo: bl, m: new THREE.Matrix4().compose(new Vector3((i - 3) * 0.025, 0, ((i * 7) % 3 - 1) * 0.03), new THREE.Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (i - 3) * 0.2), new Vector3(1, 1, 1)) });
      }
      out.leaf = finish(parts, { y0: 0, y1: 0.3, dark: 0.55, light: 1.1, seed: 17 });
    } else if (kind === 'stone') {
      out.leaf = finish([mk(blobGeo(0.1, 6, 5, 3), 0, 0.03, 0, 1.4, 0.55, 1)], { y0: 0, y1: 0.1, dark: 0.8, light: 1.0 });
    } else if (kind === 'flower') {
      const bl = new THREE.CylinderGeometry(0.003, 0.006, 0.16, 3); bl.translate(0, 0.08, 0);
      out.leaf = finish([{ geo: bl, m: M.clone() }], { dark: 0.6, light: 0.9 });
      out.bloom = finish([mk(new THREE.SphereGeometry(0.035, 5, 4), 0, 0.17, 0)], { dark: 1, light: 1 });
    }
    G[kind] = out;
    return out;
  }
  const LEAFMAT = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.92 });
  const TRUNKMAT = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, vertexColors: true, roughness: 0.95 });
  const BLOOMMAT = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.6 });
  const GREENS = ['#2f6a3a', '#2a5f38', '#3a7a42', '#27583a'], LEAF = ['#4f9a44', '#5aa84c', '#3f8a46', '#6aaa50'], FLOW = ['#e0405a', '#ee5a74', '#d8324a', '#f2849a', '#f4e4d0'];
  function scatter(ch, ci, x0) {
    const rnd = rngOf(ci * 7919 + 13 + W.seed * 17), tr = W.trail;
    const lists = { pine: [], bush: [], broad: [], tuft: [], stone: [], flower: [] };
    const dummy = new THREE.Object3D();
    const place = (kind, x, z, s, y0, tint) => { const y = heightAt(x, z); lists[kind].push({ x, y: y + (y0 || 0), z, s, tint, r: rnd() * TAU }); };
    // forest and shrubs on the hill above the trail and on the slopes below. Nothing tall stands between the camera and the trail:
    // on the valley side only low plants grow near the path, and the trees stand well below it.
    const nTree = low ? 40 : high ? 130 : 90;
    for (let k = 0; k < nTree; k++) {
      const x = x0 + rnd() * CH, side = rnd() < 0.7 ? -1 : 1;
      const z = side < 0 ? -(3.2 + Math.pow(rnd(), 1.3) * 40) : 3.4 + Math.pow(rnd(), 1.2) * 30;
      if (Math.abs(z + LEDGE_Z0) < 2.2) continue;                                // keep the mule track clear
      const sl = Math.abs(heightAt(x + 0.8, z) - heightAt(x - 0.8, z)) / 1.6;
      if (sl > 0.5) continue;
      if (side > 0 && heightAt(x, z) > column(x).T - 2.4) continue;              // valley-side trees only well below the path
      const t = rnd();
      if (z < -16 || (z > 12 && t < 0.5)) place('pine', x, z, 0.7 + rnd() * 0.8, 0, GREENS[Math.floor(rnd() * 4)]);
      else if (t < 0.5) place('broad', x, z, 0.7 + rnd() * 0.7, 0, LEAF[Math.floor(rnd() * 4)]);
      else place('bush', x, z, 0.6 + rnd() * 0.8, 0, W.theme === 2 ? '#7a8a58' : (rnd() < 0.5 ? '#d8445e' : '#3f8a46'));
    }
    // rhododendron shrubs beside the trail (red blooms), kept low
    const nB = low ? 8 : 20;
    for (let k = 0; k < nB; k++) {
      const x = x0 + rnd() * CH, side = rnd() < 0.75 ? -1 : 1, z = side * (1.6 + rnd() * 2.2);
      const sl = Math.abs(heightAt(x + 0.5, z) - heightAt(x - 0.5, z)) / 1.0; if (sl > 0.4) continue;
      place('bush', x, z, side < 0 ? 0.42 + rnd() * 0.5 : 0.28 + rnd() * 0.22, 0, rnd() < 0.7 ? '#d8324a' : '#f2849a');
    }
    const nT = low ? 60 : high ? 220 : 140;
    for (let k = 0; k < nT; k++) {
      const x = x0 + rnd() * CH, z = (rnd() - 0.5) * 12;
      if (Math.abs(z) < 0.5) continue;
      const sl = Math.abs(heightAt(x + 0.3, z) - heightAt(x - 0.3, z)) / 0.6; if (sl > 0.35) continue;
      place('tuft', x, z, 0.8 + rnd() * 0.9, 0, rnd() < 0.5 ? '#6ea84a' : '#8fbf58');
    }
    for (let k = 0; k < (low ? 40 : 110); k++) {
      const x = x0 + rnd() * CH, z = (rnd() - 0.5) * 3.4;
      place('stone', x, z, 0.35 + rnd() * 0.8, 0.0, rnd() < 0.5 ? '#9a9080' : '#b3a998');
    }
    for (let k = 0; k < (low ? 30 : 90); k++) {
      const x = x0 + rnd() * CH, z = (rnd() < 0.5 ? -1 : 1) * (1.0 + rnd() * 5);
      const sl = Math.abs(heightAt(x + 0.3, z) - heightAt(x - 0.3, z)) / 0.6; if (sl > 0.35) continue;
      place('flower', x, z, 0.8 + rnd() * 0.6, 0, FLOW[Math.floor(rnd() * FLOW.length)]);
    }
    const BASE = { pine: '#3a7a44', broad: '#5aa84c', bush: '#3f8a46', tuft: '#7fb552', stone: '#a79d8c', flower: '#4f8a3c' };
    for (const kind of Object.keys(lists)) {
      const L = lists[kind]; if (!L.length) continue;
      const geos = geoOf(kind);
      for (const part of ['leaf', 'trunk', 'bloom']) {
        if (!geos[part]) continue;
        const m = part === 'leaf' ? LEAFMAT : part === 'trunk' ? TRUNKMAT : BLOOMMAT;
        const im = new THREE.InstancedMesh(geos[part], m, L.length);
        im.castShadow = (kind === 'pine' || kind === 'broad') && !low; im.receiveShadow = false;
        L.forEach((o, i) => {
          dummy.position.set(o.x, o.y, o.z); dummy.rotation.set(0, o.r, 0); dummy.scale.set(o.s, o.s * (0.9 + 0.2 * hash(i)), o.s); dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
          // leaf colour: the tint the placer asked for, except shrubs and flowers whose tint is the BLOOM colour
          const isBloomTint = (kind === 'bush' || kind === 'flower');
          const c = part === 'bloom' ? o.tint : part === 'trunk' ? '#8a6a4a' : (isBloomTint ? (kind === 'bush' ? BASE.bush : BASE.flower) : o.tint || BASE[kind]);
          im.setColorAt(i, tmpC.set(c));
        });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.frustumCulled = false; im.userData.kind = kind; im.visible = !(W.hideTrees && (kind === 'pine' || kind === 'broad' || kind === 'flower'));
        group.add(im); ch.extras.push(im);
      }
    }
    // far hill houses on terraces (instanced boxes + roofs) and the occasional smoking chimney
    const houses = [];
    for (let k = 0; k < 4; k++) {
      const x = x0 + 2 + rnd() * (CH - 4), z = rnd() < 0.7 ? -(7 + rnd() * 26) : 10 + rnd() * 20;
      if (hash2(ci, k) < 0.3) continue;
      const sl = Math.abs(heightAt(x + 1.5, z) - heightAt(x - 1.5, z)) / 3; if (sl > 0.25) continue;
      houses.push({ x, z, y: heightAt(x, z), s: 0.5 + rnd() * 0.35, r: (rnd() - 0.5) * 0.6 });
    }
    for (const hs of houses) { const hm = makeHouse(hs.s, hash(Math.round(hs.x * 10))); hm.position.set(hs.x, hs.y - 0.1, hs.z); hm.rotation.y = hs.r + (hs.z < 0 ? 0 : Math.PI); group.add(hm); ch.extras.push(hm); }
  }
  // a hill house: whitewashed upper walls, ochre plinth, slate roof with an overhang, small wooden windows
  const houseMats = {};
  function makeHouse(s = 1, seed = 0) {
    const g = new THREE.Group();
    const m = (k, c, r = 0.9) => houseMats[k] || (houseMats[k] = mat(c, r));
    const wall = new THREE.Mesh(B.roundedBox(4.4, 2.2, 3.4, 0.05, 2), m('wall', '#efe6d2'));
    wall.position.y = 1.1 + 0.55; g.add(wall);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.1, 3.5), m('plinth', '#b9684a'));
    plinth.position.y = 0.55; g.add(plinth);
    const roofGeo = new THREE.CylinderGeometry(0.0001, 1, 1, 4, 1); roofGeo.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeo, m('roof', hash(seed * 3) < 0.5 ? '#5d6b7e' : '#6f7a8c', 0.8));
    roof.scale.set(3.8, 1.4, 2.6); roof.position.y = 2.75 + 0.7; g.add(roof);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.06), m('win', '#3a2a1c'));
    for (const wx of [-1.3, 1.3]) { const w = win.clone(); w.position.set(wx, 1.9, 1.72); g.add(w); }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.06), m('door', '#7a4a24'));
    door.position.set(0, 0.7, 1.75); g.add(door);
    g.scale.setScalar(s);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  W.makeHouse = makeHouse;

  // ---- trail features per segment -------------------------------------------------------------------------------------------------
  const segObjs = new Map();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: stoneTexture('#a29888'), roughness: 0.95 });
  const woodMat = mat('#7a5230', 0.8);
  function buildSeg(s) {
    const o = { group: new THREE.Group(), update: null };
    group.add(o.group);
    const T = (x) => groundY(W.trail, x);
    if (s.t === 'steps') {
      // stone treads: top at the ramp's height, riser faces dropping to the step below
      const n = s.jolts.length, L = K.STEP_LEN;
      const treads = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stoneMat, n);
      const dummy = new THREE.Object3D();
      for (let k = 0; k < n; k++) {
        const xm = s.x0 + (k + 0.5) * L, top = T(xm) + 0.012, rise = Math.max(0.08, Math.tan(s.slope) * L);
        const h = 0.38 + rise;
        dummy.position.set(xm, top - h / 2, 0); dummy.scale.set(L * 0.98, h, 1.55 + (hash(k) - 0.5) * 0.12); dummy.rotation.set(0, (hash(k + 4) - 0.5) * 0.02, 0); dummy.updateMatrix();
        treads.setMatrixAt(k, dummy.matrix);
      }
      treads.castShadow = true; treads.receiveShadow = true; treads.frustumCulled = false; o.group.add(treads);
      // retaining stones along the uphill edge
      const wallG = new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0, 0.9, 0.3), stoneMat);
      wallG.position.set((s.x0 + s.x1) / 2, (T(s.x0) + T(s.x1)) / 2 + 0.2, -0.95);
      wallG.rotation.z = Math.atan2(T(s.x1) - T(s.x0), s.x1 - s.x0);
      wallG.castShadow = true; o.group.add(wallG);
    } else if (s.t === 'rest') {
      // chautara: a raised flagstone platform with a seat, a big broad-leaf tree, a water-pot stone
      const len = s.x1 - s.x0, cx = (s.x0 + s.x1) / 2, y = T(cx);
      const plat = new THREE.Mesh(B.roundedBox(len, 0.36, 3.2, 0.05, 2), stoneMat);
      plat.position.set(cx, y - 0.16, -0.2); plat.castShadow = true; plat.receiveShadow = true; o.group.add(plat);
      const seat = new THREE.Mesh(B.roundedBox(len * 0.34, 0.5, 0.8, 0.05, 2), stoneMat);
      seat.position.set(cx - len * 0.12, y + 0.3, -1.55); seat.castShadow = true; o.group.add(seat);
      const back = new THREE.Mesh(B.roundedBox(len * 0.34, 0.7, 0.2, 0.04, 2), stoneMat);
      back.position.set(cx - len * 0.12, y + 0.85, -1.85); o.group.add(back);
      // the tree
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(B.lathe([[0.0001, 0], [0.55, 0], [0.4, 0.7], [0.3, 2.6], [0.5, 4.0], [0.0001, 4.1]], 12), mat('#5a3c22', 0.95));
      trunk.castShadow = true; tree.add(trunk);
      const lm = [mat('#2f6a3a', 0.9), mat('#3f8a46', 0.9), mat('#58a85a', 0.9)];
      [[0, 6.4, 0, 3.2], [2.8, 5.6, 0.8, 2.4], [-2.8, 5.8, -0.6, 2.5], [0.6, 7.6, -0.6, 2.2], [1.6, 4.6, 1.4, 1.8], [-1.8, 4.8, 1.0, 1.9]].forEach(([x, yy, z, r], i) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), lm[i % 3]); b.position.set(x, yy, z); b.scale.y = 0.8; b.castShadow = true; tree.add(b);
      });
      tree.position.set(cx + len * 0.28, y - 0.3, -3.0);
      o.group.add(tree);
      // a stack of firewood and a spare basket for dressing
      for (let i = 0; i < 6; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 7), mat('#7a5230')); lg.rotation.z = Math.PI / 2; lg.position.set(cx + len * 0.4, y + 0.06 + Math.floor(i / 3) * 0.13, -1.25 + (i % 3) * 0.14); o.group.add(lg); }
    } else if (s.t === 'bridge') {
      buildBridge(o, s);
    }
    return o;
  }
  // suspension bridge: stone-and-timber towers, two catenary cables, hangers, plank deck that sways with the sim's bridge sway
  function buildBridge(o, s) {
    const x0 = s.x0, x1 = s.x1, y0 = s.y0, len = x1 - x0;
    const towerM = mat('#6a4a28', 0.85);
    const side = [-0.85, 0.85], postZ = [-1.2, 1.2];
    for (const xx of [x0 + 0.1, x1 - 0.1]) {
      for (const zz of postZ) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.7, 0.2), towerM); post.position.set(xx, y0 + 0.75, zz); post.castShadow = true; o.group.add(post);
        const foot = new THREE.Mesh(B.roundedBox(0.9, 0.5, 0.9, 0.05, 2), stoneMat); foot.position.set(xx, y0 - 0.1, zz); foot.castShadow = true; o.group.add(foot);
      }
    }
    const nPl = Math.max(8, Math.round(len / 0.3));
    const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.07, 1.5), mat('#a8793e', 0.85), nPl);
    planks.castShadow = true; planks.frustumCulled = false; o.group.add(planks);
    const beamsL = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.1, 0.1), towerM, 2);
    // cables and hangers
    const nC = 26;
    const cabM = new THREE.MeshStandardMaterial({ color: 0x2c1f14, roughness: 0.8, side: THREE.DoubleSide });
    const cables = side.map(() => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nC * 2 * 3), 3)); const idx = []; for (let i = 0; i < nC - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } geo.setIndex(idx); const m = new THREE.Mesh(geo, cabM); m.frustumCulled = false; o.group.add(m); return m; });
    const rails = side.map(() => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nC * 2 * 3), 3)); const idx = []; for (let i = 0; i < nC - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } geo.setIndex(idx); const m = new THREE.Mesh(geo, cabM); m.frustumCulled = false; o.group.add(m); return m; });
    const nH = Math.floor(len / 0.9);
    const hang = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), mat('#2c1f14'), nH * 2); hang.frustumCulled = false; o.group.add(hang);
    const dummy = new THREE.Object3D();
    o.update = (sway, t) => {
      const lat = clamp(sway * 0.22, -0.9, 0.9), vsw = clamp(sway * 0.05, -0.25, 0.25);
      const deckAt = (u) => ({ y: y0 - 0.05 + Math.sin(Math.PI * u) * (-0.25 + vsw) - 0.0, z: Math.sin(Math.PI * u) * lat });
      for (let i = 0; i < nPl; i++) {
        const u = (i + 0.5) / nPl, d = deckAt(u);
        dummy.position.set(x0 + u * len, d.y, d.z); dummy.rotation.set(0, 0, 0); dummy.rotation.x = Math.cos(Math.PI * u) * lat * 0.12; dummy.scale.set(1, 1, 1); dummy.updateMatrix(); planks.setMatrixAt(i, dummy.matrix);
      }
      planks.instanceMatrix.needsUpdate = true;
      const wr = (mesh, zs, yFn) => {
        const p = mesh.geometry.attributes.position.array;
        for (let i = 0; i < nC; i++) {
          const u = i / (nC - 1), d = deckAt(u), y = yFn(u, d);
          const x = x0 + u * len, z = zs + d.z * 1.0;
          p[i * 6] = x; p[i * 6 + 1] = y - 0.03; p[i * 6 + 2] = z; p[i * 6 + 3] = x; p[i * 6 + 4] = y + 0.03; p[i * 6 + 5] = z;
        }
        mesh.geometry.attributes.position.needsUpdate = true;
      };
      side.forEach((zs, k) => {
        wr(cables[k], zs, (u, d) => y0 + 1.65 - Math.sin(Math.PI * u) * 0.8 + d.y - y0 + 0.0);
        wr(rails[k], zs, (u, d) => d.y + 1.05);
      });
      let hn = 0;
      for (let i = 0; i < nH; i++) {
        const u = (i + 0.7) / (nH + 0.4);
        for (let k = 0; k < 2; k++) {
          const zs = side[k], d = deckAt(u), top = y0 + 1.65 - Math.sin(Math.PI * u) * 0.8 + d.y - y0, bot = d.y + 1.05;
          dummy.position.set(x0 + u * len, (top + bot) / 2, zs + d.z); dummy.scale.set(1, Math.max(0.05, top - bot), 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); hang.setMatrixAt(hn++, dummy.matrix);
        }
      }
      hang.instanceMatrix.needsUpdate = true;
    };
    o.update(0, 0);
    // gorge river far below
    const rv = new THREE.Mesh(new THREE.PlaneGeometry(len + 14, 60), new THREE.MeshStandardMaterial({ map: waterTexture(), color: 0xffffff, roughness: 0.25, metalness: 0.0, transparent: true, opacity: 0.92 }));
    rv.rotation.x = -Math.PI / 2; rv.position.set((x0 + x1) / 2, y0 - 14.2, 0);
    rv.material.map = waterTexture(); o.group.add(rv); o.water = rv;
  }
  // the village: houses climbing the hill, a shop with an awning, smoke, bunting; and the arrival "gate"
  let village = null;
  function buildVillage(x) {
    const g = new THREE.Group(); group.add(g);
    const y = groundY(W.trail, x);
    const spots = [[8, -4.5, 0.2], [16, -6.5, -0.15], [26, -4.8, 0.1], [12, -12.5, 0.0], [24, -13, 0.3], [34, -10, -0.1], [20, 5.5, Math.PI], [32, 6.5, Math.PI + 0.2], [5, 7.5, Math.PI - 0.15]];
    spots.forEach(([dx, z, r], i) => {
      const h = makeHouse(1.05 + (i % 3) * 0.12, i);
      const hy = Math.max(heightAt(x + dx, z) - 0.1, groundY(W.trail, x + dx) - 0.1);
      h.position.set(x + dx, hy, z); h.rotation.y = r; g.add(h);
    });
    // the shop: a timber frame with a striped awning right at the end of the path
    const sx = x + 1.8, sz = -3.1, sy = y;
    const posts = [[0, 0], [3.2, 0]].map(([px]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.4, 0.16), woodMat); p.position.set(sx + px, sy + 1.2, sz + 1.2); p.castShadow = true; g.add(p); return p; });
    void posts;
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 0.12), mat('#e8dcc0', 0.9)); back.position.set(sx + 1.6, sy + 1.2, sz - 0.2); back.castShadow = true; g.add(back);
    for (let k = 0; k < 8; k++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.04, 1.7), mat(k % 2 ? '#f2e6c8' : '#c9473a', 0.9));
      st.position.set(sx - 0.1 + k * 0.43 + 0.2, sy + 2.5, sz + 0.65); st.rotation.x = -0.18; st.castShadow = true; g.add(st);
    }
    const counter = new THREE.Mesh(B.roundedBox(3.2, 0.9, 0.7, 0.05, 2), mat('#8a6030', 0.8)); counter.position.set(sx + 1.6, sy + 0.45, sz + 0.55); counter.castShadow = true; g.add(counter);
    // sacks and baskets on the counter and ground
    for (let i = 0; i < 5; i++) {
      const sk = new THREE.Mesh(B.roundedBox(0.4, 0.3, 0.26, 0.09, 3), mat(['#e6d8b0', '#c9a45a', '#f1eee6'][i % 3], 0.95)); sk.position.set(sx + 0.5 + i * 0.5, sy + 1.05, sz + 0.55); sk.castShadow = true; g.add(sk);
    }
    for (let i = 0; i < 3; i++) {
      const bk = new THREE.Mesh(B.lathe([[0.0001, 0], [0.12, 0], [0.2, 0.36], [0.22, 0.4]], 16), mat('#c99a52', 0.9, { side: THREE.DoubleSide })); bk.position.set(sx + 3.9 + i * 0.5, sy, sz + 1.7 + (i % 2) * 0.3); bk.castShadow = true; g.add(bk);
    }
    // bunting between the shop and a post: plain pennants, warm and muted colours
    g.userData.bunting = makeBunting(g, new Vector3(sx - 0.2, sy + 2.6, sz + 1.5), new Vector3(sx + 7.5, sy + 3.0, sz + 2.2), 9);
    // chimney smoke
    g.userData.smoke = [];
    for (const dx of [8, 26]) for (let k = 0; k < 6; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('235,235,235', 0.55), transparent: true, depthWrite: false, opacity: 0.4 }));
      sp.userData = { bx: x + dx + 0.7, by: Math.max(heightAt(x + dx, dx === 8 ? -4.5 : -4.8), 0) + 5.4, bz: dx === 8 ? -4.5 : -4.8, k };
      g.add(sp); g.userData.smoke.push(sp);
    }
    // the arrival arch: two posts and a banner-free timber lintel
    const ax = x - 0.5;
    for (const zz of [-1.1, 1.1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.9, 0.22), woodMat); p.position.set(ax, y + 1.45, zz); p.castShadow = true; g.add(p); }
    const lint = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 2.7), woodMat); lint.position.set(ax, y + 2.95, 0); g.add(lint);
    g.userData.x = x;
    return g;
  }
  function makeBunting(parent, a, b, n) {
    const cols = ['#e7d7b3', '#c96a45', '#e0a63a', '#c98a9a', '#8fa6a0', '#d9c9a0'];
    const g = new THREE.Group(); parent.add(g);
    const cord = [];
    const flags = [];
    for (let i = 0; i < n; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.14, 0, 0, 0.14, 0, 0, 0, -0.34, 0]), 3)); geo.setIndex([0, 1, 2]); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.9, side: THREE.DoubleSide })); g.add(m); flags.push(m);
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: 0x4a3a2a })); g.add(line);
    g.userData = { a, b, flags, line, n };
    cord.push(line);
    return g;
  }
  function stepBunting(bg, t, wind) {
    const { a, b, flags, n, line } = bg.userData;
    const pts = [];
    for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push(new Vector3(lerp(a.x, b.x, u), lerp(a.y, b.y, u) - Math.sin(Math.PI * u) * 0.5, lerp(a.z, b.z, u))); }
    line.geometry.setFromPoints(pts);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, f = flags[i];
      f.position.set(lerp(a.x, b.x, u), lerp(a.y, b.y, u) - Math.sin(Math.PI * u) * 0.5 - 0.02, lerp(a.z, b.z, u));
      f.rotation.set(Math.sin(t * 3 + i * 1.7) * 0.25 * (0.4 + wind), Math.sin(t * 2.1 + i) * 0.35 * (0.3 + wind), Math.sin(t * 3.7 + i * 2.3) * 0.18 * (0.3 + wind));
    }
  }

  // ---- distant mountains: layered ridges of vertex-coloured ridge strips with haze ---------------------------------------------------
  const ridgeMat = (haze) => new THREE.ShaderMaterial({
    uniforms: { uHaze: { value: new Color('#cfe0ee') }, uAmt: { value: haze }, uLight: { value: new Color(1, 1, 1) } },
    vertexShader: 'attribute vec3 color; varying vec3 vC; varying float vH; void main(){ vC=color; vH=position.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uHaze; uniform float uAmt; uniform vec3 uLight; varying vec3 vC; varying float vH; void main(){ vec3 c=vC*uLight; c=mix(c,uHaze,uAmt); gl_FragColor=vec4(c,1.0); }',
  });
  const ridges = [];
  const RIDGE = [
    { z: -230, base: -60, amp: 230, f: 0.0042, seed: 11, haze: 0.22, snow: 120, col: ['#4f6f50', '#6b8566'], par: 0.985 },
    { z: -360, base: -70, amp: 360, f: 0.0031, seed: 31, haze: 0.34, snow: 150, col: ['#5f7688', '#8196ad'], par: 0.992 },
    { z: -520, base: -90, amp: 560, f: 0.0022, seed: 57, haze: 0.46, snow: 140, col: ['#7589ab', '#a3b5d0'], par: 0.996 },
  ];
  function buildRidge(R, cx) {
    const span = 900, step = 12, nx = Math.round(span / step) + 1, rows = 14;
    const pos = new Float32Array(nx * rows * 3), col = new Float32Array(nx * rows * 3), idx = [];
    const cA = new Color(R.col[0]), cB = new Color(R.col[1]), snow = new Color('#f4f8ff'), rock = new Color('#8a8e98'), c = new Color();
    for (let i = 0; i < nx; i++) {
      const wx = cx - span / 2 + i * step;                       // world x of this column (noise is sampled in world x * par so ridges drift slowly)
      const nxw = wx * R.par;
      const peak = (0.28 + 0.9 * Math.pow(fbm(nxw * R.f * 3.2, R.seed), 1.25)) * R.amp * 0.8;
      for (let j = 0; j < rows; j++) {
        const v = j / (rows - 1);                               // 0 at the base, 1 at the crest
        const y = R.base + (peak - R.base) * v;
        const zFold = (noise(nxw * 0.02 + j * 3, R.seed + 3) - 0.5) * 40 * (1 - v);
        const n = i * rows + j;
        pos[n * 3] = wx; pos[n * 3 + 1] = y; pos[n * 3 + 2] = R.z + zFold - (1 - v) * 60 * 0 + v * 30;
        const snowLine = R.base + (R.amp * 0.42);
        c.copy(cA).lerp(cB, v);
        if (y > snowLine) { const k = clamp((y - snowLine) / (R.amp * 0.12), 0, 1) * (0.7 + 0.3 * noise(nxw * 0.08 + j, R.seed + 9)); c.lerp(snow, k); }
        else if (y > snowLine - R.amp * 0.2) c.lerp(rock, 0.45 * noise(nxw * 0.1 + j * 0.7, R.seed + 5));
        const shade = 0.78 + 0.35 * noise(nxw * 0.05 + j * 2.3, R.seed + 13);
        c.multiplyScalar(shade);
        col[n * 3] = c.r; col[n * 3 + 1] = c.g; col[n * 3 + 2] = c.b;
      }
    }
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < rows - 1; j++) { const a = i * rows + j, b = (i + 1) * rows + j, d = i * rows + j + 1, e = (i + 1) * rows + j + 1; idx.push(a, b, d, b, e, d); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, R.mat); m.frustumCulled = false; m.renderOrder = -5;
    return m;
  }
  for (const R of RIDGE) { R.mat = ridgeMat(R.haze); R.cx = null; R.mesh = null; ridges.push(R); }

  // ---- sky dome, sun, stars, clouds -----------------------------------------------------------------------------------------------------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new Color('#3d84da') }, uHor: { value: new Color('#bfe1ff') }, uGlow: { value: new Color('#fff1c8') }, uSun: { value: new Vector3(0, 0.5, -0.5) }, uStars: { value: 0 }, uSunAmt: { value: 1 } },
    vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uTop,uHor,uGlow,uSun; uniform float uStars,uSunAmt; varying vec3 vD; float h(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); } void main(){ float t=clamp(vD.y*1.25+0.05,0.0,1.0); vec3 c=mix(uHor,uTop,pow(t,0.7)); float s=max(dot(vD,normalize(uSun)),0.0); c+=uGlow*pow(s,6.0)*0.28*uSunAmt+uGlow*pow(s,200.0)*1.4*uSunAmt; if(vD.y>0.0&&uStars>0.0){ vec3 q=floor(vD*220.0); float r=h(q); if(r>0.9965) c+=vec3(1.0)*uStars*(r-0.9965)*220.0; } gl_FragColor=vec4(c,1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 14), skyMat); sky.renderOrder = -20; sky.frustumCulled = false; scene.add(sky);
  // clouds: soft cards drifting along the ranges
  const clouds = [];
  for (let i = 0; i < (low ? 5 : 9); i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, opacity: 0.5, fog: false }));
    const r = hash(i * 17); sp.userData = { bx: (r - 0.5) * 900, y: 160 + hash(i * 3) * 160, z: -420 - hash(i * 5) * 200, sp: 2 + hash(i) * 2.5, s: 220 + hash(i * 7) * 200 };
    sp.scale.set(sp.userData.s, sp.userData.s * 0.4, 1); scene.add(sp); clouds.push(sp);
  }
  // mist banks in the valley
  const mists = [];
  for (let i = 0; i < (low ? 4 : 8); i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('255,250,240', 0.5), transparent: true, depthWrite: false, opacity: 0.38, fog: false }));
    sp.userData = { bx: i * 18, z: 18 + hash(i) * 28, y: -5 - hash(i * 3) * 8, sp: 0.4 + hash(i * 5) * 0.5, s: 38 + hash(i * 7) * 30 };
    sp.scale.set(sp.userData.s, sp.userData.s * 0.28, 1); scene.add(sp); mists.push(sp);
  }
  // river in the valley
  let river = null;
  function ensureRiver() {
    if (river) return;
    river = new THREE.Mesh(new THREE.PlaneGeometry(260, 9, 1, 1), new THREE.MeshStandardMaterial({ map: waterTexture(), roughness: 0.3, metalness: 0, transparent: true, opacity: 0.94 }));
    river.rotation.x = -Math.PI / 2; river.material.map = waterTexture(); river.material.map.repeat.set(40, 2); scene.add(river);
  }
  // wind-driven particles: dust and leaves; rain streaks
  const rainN = low ? 120 : 260;
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rainN * 6), 3));
  const rainLines = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xcfe0f2, transparent: true, opacity: 0.5, fog: false }));
  rainLines.frustumCulled = false; rainLines.visible = false; scene.add(rainLines);
  const rainSeed = Array.from({ length: rainN }, (_, i) => [hash(i * 3), hash(i * 5 + 1), hash(i * 7 + 2), 0.7 + hash(i) * 0.6]);
  const leaves = [];
  for (let i = 0; i < (low ? 8 : 18); i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), new THREE.MeshBasicMaterial({ color: i % 3 ? '#5aa84c' : '#d8a03a', side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    scene.add(m); leaves.push({ m, ph: hash(i * 3) * TAU, x: hash(i) * 14 - 4, y: hash(i + 9) * 3, z: hash(i + 5) * 6 - 3, v: 0.6 + hash(i + 3) });
  }

  // ---- public API ---------------------------------------------------------------------------------------------------------------------
  W.seed = 0;
  W.setTrail = (trail, theme = 0) => {
    W.trail = trail; W.theme = theme; W.seed = trail.seed ?? 0;
    colCache.clear();
    for (const [, c] of chunks) { group.remove(c.mesh); c.mesh.geometry.dispose(); for (const e of c.extras) { group.remove(e); e.geometry?.dispose?.(); e.dispose?.(); } }
    chunks.clear();
    for (const [, s] of segObjs) group.remove(s.group);
    segObjs.clear();
    if (village) { group.remove(village); village = null; }
    for (const R of ridges) { if (R.mesh) { scene.remove(R.mesh); R.mesh.geometry.dispose(); R.mesh = null; R.cx = null; } }
    ensureRiver();
    W.version = (W.version || 0) + 1;
  };
  let lastUpdateX = -1e9;
  W.update = (dt, v) => {
    // v: { x (camera focus), t, f, sway, wind, rain, gustDir, gustAmt, hint }
    const tr = W.trail; if (!tr) return;
    const x = v.x;
    // chunks around the focus
    const c0 = Math.floor((x - 40) / CH), c1 = Math.floor((x + 90) / CH);
    let built = 0;
    for (let c = c0; c <= c1 && built < 2; c++) if (!chunks.has(c)) { chunks.set(c, buildChunk(c)); built++; }
    for (const [c, ch] of chunks) if (c < c0 - 1 || c > c1 + 1) { group.remove(ch.mesh); ch.mesh.geometry.dispose(); for (const e of ch.extras) { group.remove(e); e.geometry?.dispose?.(); e.dispose?.(); } chunks.delete(c); }
    // segment features in range
    for (const s of tr.segs) {
      if (s.t !== 'steps' && s.t !== 'rest' && s.t !== 'bridge') continue;
      const inR = s.x1 > x - 40 && s.x0 < x + 90;
      if (inR && !segObjs.has(s.x0)) segObjs.set(s.x0, buildSeg(s));
      else if (!inR && segObjs.has(s.x0)) { group.remove(segObjs.get(s.x0).group); segObjs.delete(s.x0); }
    }
    for (const [x0, o] of segObjs) if (o.update) o.update(v.sway || 0, v.t);
    if (!tr.endless && tr.goal !== undefined && x > tr.goal - 70 && !village) village = buildVillage(tr.goal);
    if (village) {
      stepBunting(village.userData.bunting, v.t, v.wind ?? 0.3);
      for (const sp of village.userData.smoke) {
        const u = sp.userData, p = ((v.t * 0.18 + u.k / 6) % 1);
        sp.position.set(u.bx + p * 2.2 * (0.4 + (v.wind ?? 0.3)), u.by + p * 4.5, u.bz); const sz = 0.7 + p * 2.8; sp.scale.set(sz, sz, 1); sp.material.opacity = 0.38 * (1 - p);
      }
    }
    // ridges follow the focus (re-centred every 140 m)
    for (const R of ridges) {
      const cx = Math.round(x / 140) * 140;
      if (R.cx !== cx) { if (R.mesh) { scene.remove(R.mesh); R.mesh.geometry.dispose(); } R.mesh = buildRidge(R, cx); R.cx = cx; scene.add(R.mesh); }
    }
    // sky
    const s = skyAt(v.f);
    skyMat.uniforms.uTop.value.set(s.top); skyMat.uniforms.uHor.value.set(s.hor); skyMat.uniforms.uGlow.value.set(s.glow);
    skyMat.uniforms.uStars.value = s.stars;
    const df = clamp(v.f / 1.15, 0, 1), az = lerp(-1.1, 1.1, df), el = 0.1 + Math.sin(df * Math.PI) * 0.78;
    const sunDir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el) * 0.6 + 0.35).normalize();
    skyMat.uniforms.uSun.value.copy(sunDir); skyMat.uniforms.uSunAmt.value = v.f < 1.12 ? 1 : 0;
    W.sky = s; W.sunDir = sunDir;
    const cam = stage.camera.position;
    sky.position.copy(cam);
    const haze = new Color(s.hor).lerp(new Color(s.top), 0.55).lerp(new Color('#b9cce6'), 0.35);
    const light = new Color(1.05, 1.05, 1.08).multiplyScalar(0.4 + 0.65 * s.light);
    if (s.light < 0.7) light.lerp(new Color('#6a6fb0'), (0.7 - s.light) * 0.9);
    for (const R of ridges) { R.mat.uniforms.uHaze.value.copy(haze); R.mat.uniforms.uLight.value.copy(light); if (R.mesh) R.mesh.position.set(0, 0, 0); }
    for (const c of clouds) { const u = c.userData; c.position.set(cam.x + ((u.bx + v.t * u.sp) % 900) - 450, u.y, cam.z + u.z); c.material.opacity = (0.22 + 0.4 * s.light) * (v.rain ? 0.9 : 1); c.material.color.copy(haze).lerp(new Color(1, 1, 1), 0.5 + 0.3 * s.light); }
    // river and mist
    const rx = x;
    const ry = heightAt(rx, 46) - 0.3;
    river.position.set(rx, ry, 47.5); river.material.map.offset.x = -v.t * 0.02;
    river.material.color.copy(light);
    for (const m of mists) { const u = m.userData; m.position.set(x + ((u.bx + v.t * u.sp * 2) % 150) - 60, ry + 9 + u.y + 6, u.z); m.material.opacity = (v.rain ? 0.5 : 0.28) * (0.5 + 0.5 * s.light); }
    // lights follow the sky
    const L = stage.lights;
    L.key.color.set(s.glow).lerp(new Color('#fff4e0'), 0.35); L.key.intensity = 0.4 + 2.9 * s.light;
    L.hemi.color.set(s.top).lerp(new Color(1, 1, 1), 0.4); L.hemi.groundColor.set('#5a4a38'); L.hemi.intensity = 0.55 + 0.7 * s.light;
    L.rim.color.set(s.hor); L.rim.intensity = 0.4 + 0.9 * s.light;
    stage._shadowOffset.set(-sunDir.x * 14, 6 + sunDir.y * 12, sunDir.z * 14 + 4);
    const fogC = new Color(s.hor).lerp(new Color(s.top), 0.15).multiplyScalar(0.55 + 0.45 * s.light);
    if (!scene.fog) scene.fog = new THREE.Fog(fogC.getHex(), 40, 190);
    scene.fog.color.copy(fogC); scene.fog.near = v.rain ? 14 : 38; scene.fog.far = v.rain ? 90 : 210 + (1 - s.light) * -50;
    scene.background = null;
    // rain
    rainLines.visible = !!v.rain;
    if (v.rain) {
      const p = rainGeo.attributes.position.array;
      for (let i = 0; i < rainN; i++) {
        const r = rainSeed[i];
        const px = cam.x - 6 + r[0] * 24, pz = cam.z - 14 + r[2] * 16;
        const py = cam.y + 6 - ((r[1] * 12 + v.t * (16 * r[3])) % 12) + 1;
        p[i * 6] = px; p[i * 6 + 1] = py; p[i * 6 + 2] = pz; p[i * 6 + 3] = px - 0.1 - (v.wind ?? 0.3) * 0.2; p[i * 6 + 4] = py + 0.55; p[i * 6 + 5] = pz;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    for (const lf of leaves) {
      const g = (v.gustAmt || 0) * (v.gustDir || 1);
      lf.x += (0.6 + 2 * Math.abs(g)) * lf.v * dt * Math.sign(g || 1); lf.y += Math.sin(v.t * 2 + lf.ph) * 0.3 * dt - 0.15 * dt;
      if (lf.x > 14 || lf.x < -10) lf.x = g < 0 ? 12 : -8;
      if (lf.y < 0) lf.y = 3;
      lf.m.position.set(v.x + lf.x, v.fy + 0.4 + lf.y, lf.z + 1.5); lf.m.rotation.set(v.t * 2 + lf.ph, v.t * 1.3, 0);
      lf.m.visible = !!(v.gustAmt > 0.05) || (v.wind ?? 0) > 0.55;
    }
  };
  W.setTreesHidden = (on) => { W.hideTrees = on; for (const [, c] of chunks) for (const e of c.extras) if (e.userData && (e.userData.kind === 'pine' || e.userData.kind === 'broad' || e.userData.kind === 'flower')) e.visible = !on; };
  W.dispose = () => { scene.remove(group); };
  return W;
}
