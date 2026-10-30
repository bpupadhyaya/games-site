// crowd3d: ONE shared, realistic, instanced crowd for every Arcforge 3D game (stands, circles, sidewalks, free areas).
//
//   import { createCrowd3d } from './vendor3d/index.js';
//   const crowd = createCrowd3d(stage, {
//     stands: [{ center: [0, 0, -20], yaw: 0, rows: 8, perRow: 30, width: 34, rise: 0.42, rowDepth: 0.85, curve: 0.5 }],
//     count: 300, seed: 7, culture: 'central_asian', quality: 'medium', cold: true });
//   // every frame, with the SIM dt (never the wall clock):
//   crowd.update(dt);                       // stage.camera is used for LOD / culling
//   crowd.react('cheer', { origin: [x, 0, z], radius: 25 });   // 'cheer' | 'gasp' | 'groan' | 'flag' | 'ovation'
//   crowd.setExcitement(0.7);               // 0..1 idle energy (more clapping, waving, bouncing)
//
// How it works (read before changing anything):
// * Every person is an instance of ONE merged mesh (head, hair styles, hats, scarf, torso, sleeves, arms, legs, shoes, props
//   are all in the geometry; variants are switched on per instance in the vertex shader). The whole skeleton pose
//   (idle: breathe / shift weight / clap / wave / point / lean / film with a phone / walk, and the reactions) is computed
//   in the vertex shader from per-instance parameters and the shared time uniform, so animation costs no CPU at all.
//   three.js cannot instance SKINNED meshes; this procedural rig is the instancing-friendly equivalent.
// * Three levels of detail, each its own InstancedMesh: near (full figure, face texture, ~2.5k tris), mid (same figure at
//   low segment counts), far (tiny prism people, still with hair/hat/clothing colours). A CPU pass (frustum + distance
//   culling, pixel-height LOD, near cap per quality tier) rebuckets the people when the camera or the crowd changed.
// * Faces, brows, beards and fabric weaves come from small procedural DataTextures (no image files, no DOM needed).
//   Culture packs give plausible clothing / hat / hair / skin distributions; nothing is copied from any artwork.
import * as THREE from './three.js';

// ------------------------------------------------------------------------------------------------ utilities
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hex(s) { const n = parseInt(String(s).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const packRGB = (r, g, b) => Math.round(Math.max(0, Math.min(255, r))) + Math.round(Math.max(0, Math.min(255, g))) * 256 + Math.round(Math.max(0, Math.min(255, b))) * 65536;
const jitter = (c, r, k) => c.map((v) => v * (1 + (r() - 0.5) * 2 * k));
function pick(r, table) { // table: [[value, weight], ...]
  let sum = 0; for (const [, w] of table) sum += w;
  let x = r() * sum; for (const [v, w] of table) { x -= w; if (x <= 0) return v; }
  return table[table.length - 1][0];
}

// ------------------------------------------------------------------------------------------------ culture packs
// skin ids: fair, tan, olive, brown, dark, east. hair styles: 0 bald 1 crop 2 side-part 3 long 4 bun 5 curly 6 ponytail.
// hats: 0 none 1 cap 2 brimmed 3 beanie 4 turban/wrap 5 headscarf 6 conical straw 7 fur 8 skullcap.
// garments: 0 t-shirt 1 jacket (long sleeves) 2 long coat/robe 3 dress. patterns: 0 woven 1 stripes 2 plaid 3 knit.
const SKIN = {
  fair: ['#f3d3b6', '#ecc6a4', '#e3b48f', '#f0cdb0'], tan: ['#d9a77c', '#cf9a6c', '#c58b5c', '#bd8456'],
  olive: ['#d2a678', '#c79a6c', '#bc8d60', '#caa07a'], brown: ['#a06a45', '#925d3b', '#85523a', '#98643f'],
  dark: ['#5d3b27', '#4d3020', '#3f281b', '#6a4630'], east: ['#f1d2ab', '#e8c39a', '#dcb089', '#efcda6'],
};
const HAIRC = {
  black: '#16110e', dkbrown: '#2a1b12', brown: '#4a3122', chestnut: '#6a432b', blond: '#c9aa6a', lblond: '#dcc794',
  red: '#8b4a28', grey: '#8d8b88', white: '#d2cfca',
};
const C = (o) => o;
export const CULTURES = {
  central_asian: C({
    skin: [['east', 3], ['olive', 3], ['tan', 2]], hair: [['black', 6], ['dkbrown', 3], ['brown', 1]],
    hats: [[0, 5], [8, 2.5], [7, 1.5], [2, 1], [1, 1]], womenHat: [[5, 3], [0, 3], [8, 1]],
    garment: [[0, 2], [1, 4], [2, 2.5]], womanGarment: [[3, 5], [1, 2]],
    top: ['#7a2a24', '#23364f', '#a8863a', '#3b5a3a', '#d8cfc0', '#5a2d46', '#8c5a2b', '#2d4a52'], bottom: ['#22262c', '#3a3329', '#2a3342', '#4a4036'],
    scarf: 0.25, patterns: [[0, 4], [1, 1], [2, 1]], flag: ['#c8202a', '#1f6fb4', '#2a9a58'],
  }),
  mediterranean: C({
    skin: [['olive', 5], ['fair', 3], ['tan', 2]], hair: [['dkbrown', 5], ['black', 3], ['brown', 2], ['grey', 1]],
    hats: [[0, 8], [1, 1], [2, 0.8]], womenHat: [[0, 8], [2, 1]],
    garment: [[0, 5], [1, 3], [2, 0.3]], womanGarment: [[3, 4], [0, 4], [1, 2]],
    top: ['#f1ede4', '#2a5a8f', '#b8452c', '#2f6a5a', '#d9b25a', '#8a2a3a', '#e8dcc0', '#364a6a'], bottom: ['#23304a', '#c8b89a', '#2b2b2f', '#5a4a38'],
    scarf: 0.12, patterns: [[0, 5], [1, 2]], flag: ['#1f5fae', '#d62b2b', '#f2f2f2'],
  }),
  east_asian: C({
    skin: [['east', 8], ['fair', 1]], hair: [['black', 9], ['dkbrown', 1]],
    hats: [[0, 8], [1, 1.2], [3, 0.8], [6, 0.4]], womenHat: [[0, 8], [1, 1]],
    garment: [[0, 3], [1, 5], [2, 1]], womanGarment: [[1, 4], [3, 3], [0, 2]],
    top: ['#1f2a3a', '#cfc8b8', '#8b2c3a', '#3a6a5a', '#e7e0d0', '#4a4f8a', '#a84a3a', '#2c2c30'], bottom: ['#1c1f26', '#3a3f4a', '#c0b8a8', '#2a2a2a'],
    scarf: 0.12, patterns: [[0, 5], [1, 1.5], [2, 0.7]], flag: ['#c8202a', '#e8c030', '#1f5fae'],
  }),
  south_asian: C({
    skin: [['tan', 3], ['brown', 4], ['olive', 1.5], ['dark', 1]], hair: [['black', 8], ['dkbrown', 2]],
    hats: [[0, 6], [4, 2], [1, 1], [8, 0.6]], womenHat: [[0, 6], [5, 1]],
    garment: [[0, 2], [1, 3], [2, 3]], womanGarment: [[3, 6], [1, 1]],
    top: ['#e07a1f', '#b3203a', '#1f7a8a', '#e8d9a0', '#7a2a7a', '#2f7a3a', '#f0efe6', '#c8a020', '#d03a7a'], bottom: ['#2a2a30', '#d8d0bc', '#3a4a6a', '#6a3a2a'],
    scarf: 0.2, patterns: [[0, 3], [1, 2], [2, 1.5]], flag: ['#e07a1f', '#1f8a3a', '#1f3fae'],
  }),
  african: C({
    skin: [['dark', 6], ['brown', 4]], hair: [['black', 10]],
    hats: [[0, 6], [4, 1.5], [1, 1], [8, 0.8]], womenHat: [[4, 3.5], [0, 4]],
    garment: [[0, 3], [1, 3], [2, 2]], womanGarment: [[3, 5], [1, 2]],
    top: ['#e8a020', '#c8202a', '#1f7a3a', '#1f5fae', '#f0e8d0', '#7a2a8a', '#e85a8a', '#2a2a2a'], bottom: ['#2a2f3a', '#d8c8a0', '#4a2a2a', '#1f3a5a'],
    scarf: 0.1, patterns: [[2, 3], [1, 3], [0, 2]], flag: ['#1f8a3a', '#e8c020', '#c8202a'],
  }),
  american_rural: C({
    skin: [['fair', 5], ['tan', 2.5], ['brown', 1.5], ['dark', 1]], hair: [['brown', 4], ['blond', 3], ['chestnut', 2], ['dkbrown', 2], ['grey', 1.5], ['black', 1]],
    hats: [[0, 4], [1, 4.5], [2, 2.5], [3, 0.6]], womenHat: [[0, 6], [1, 2], [2, 1]],
    garment: [[0, 4], [1, 5], [2, 0.5]], womanGarment: [[0, 4], [1, 3], [3, 2]],
    top: ['#2a4a7a', '#8a2a2a', '#c8b898', '#3a5a3a', '#e8e0d0', '#5a3a2a', '#1f2a3a', '#b86a2a'], bottom: ['#2a3f66', '#3a4a6e', '#4a3f30', '#202328', '#6a5a40'],
    scarf: 0.06, patterns: [[2, 4], [0, 4], [1, 1]], flag: ['#1f3fae', '#c8202a', '#f2f2f2'],
  }),
  european_village: C({
    skin: [['fair', 8], ['olive', 1.5]], hair: [['brown', 4], ['dkbrown', 3], ['blond', 2], ['grey', 2], ['chestnut', 2], ['red', 0.6]],
    hats: [[0, 6], [1, 2], [3, 1.2], [2, 0.8]], womenHat: [[0, 7], [3, 1.5], [5, 0.3]],
    garment: [[1, 6], [0, 2], [2, 1.5]], womanGarment: [[1, 4], [3, 3], [2, 1.5]],
    top: ['#5a4a38', '#2a3a2a', '#7a2a2a', '#3a4a5a', '#8a7a60', '#cfc8b8', '#4a3a50', '#6a6a60'], bottom: ['#2a2a2e', '#3a3228', '#4a4a50', '#5a4a38'],
    scarf: 0.3, patterns: [[0, 4], [3, 2], [2, 2]], flag: ['#c8202a', '#1f4a9a', '#f0f0f0'],
  }),
  middle_eastern: C({
    skin: [['olive', 4], ['tan', 3], ['brown', 2], ['fair', 1]], hair: [['black', 6], ['dkbrown', 4], ['grey', 1]],
    hats: [[0, 5], [8, 2.5], [4, 1.2], [1, 0.8]], womenHat: [[5, 6], [0, 2]],
    garment: [[2, 4], [1, 3], [0, 2]], womanGarment: [[3, 5], [2, 3]],
    top: ['#f0ebdd', '#e5dcc2', '#c9bfa5', '#23262c', '#6a5a46', '#d9d0b8', '#304a5a', '#7a2a2a'], bottom: ['#2a2a2e', '#d8cfb8', '#4a3f30', '#23304a'],
    scarf: 0.15, patterns: [[0, 6], [1, 1.5]], flag: ['#c8202a', '#1f7a3a', '#101010'],
  }),
  latin_american: C({
    skin: [['tan', 4], ['brown', 3], ['olive', 2], ['fair', 1], ['dark', 1]], hair: [['black', 6], ['dkbrown', 4], ['brown', 1.5]],
    hats: [[0, 5], [1, 3.5], [2, 1.8]], womenHat: [[0, 7], [1, 1.5], [2, 1]],
    garment: [[0, 6], [1, 2], [2, 0.3]], womanGarment: [[0, 4], [3, 3], [1, 2]],
    top: ['#f2c814', '#1f5fae', '#c8202a', '#1f8a4a', '#f0f0f0', '#e07a1f', '#2a2a2a', '#7a2a8a'], bottom: ['#23304a', '#2a2a2e', '#c8b89a', '#1f3a5a'],
    scarf: 0.05, patterns: [[0, 4], [1, 4], [2, 1]], flag: ['#f2c814', '#1f5fae', '#c8202a'],
  }),
  nordic: C({
    skin: [['fair', 10]], hair: [['blond', 4], ['lblond', 2], ['brown', 3], ['chestnut', 1.5], ['red', 1], ['grey', 1.5]],
    hats: [[0, 4], [3, 4], [1, 1], [7, 0.4]], womenHat: [[0, 4], [3, 4]],
    garment: [[1, 8], [2, 1.5], [0, 1]], womanGarment: [[1, 7], [2, 1.5], [3, 1]],
    top: ['#1f2f4a', '#8a8f98', '#a02a2a', '#2f4a3a', '#d0cdc4', '#3a3f4a', '#6a4a30', '#c07a30'], bottom: ['#23262c', '#2c3a4a', '#4a4a4f', '#3a3228'],
    scarf: 0.55, patterns: [[3, 4], [0, 3], [1, 1]], flag: ['#c8202a', '#1f4a9a', '#e8c020'],
  }),
};

// ------------------------------------------------------------------------------------------------ quality tiers
const QUALITY = {
  low:    { maxNear: 24,  nearPx: 150, midPx: 38, maxDist: 70, seg: 8,  midSeg: 6, farSeg: 5, puffs: 0,  blobs: true,  every: 3, face: false },
  medium: { maxNear: 60,  nearPx: 110, midPx: 26, maxDist: 110, seg: 11, midSeg: 7, farSeg: 5, puffs: 24, blobs: true,  every: 2, face: true },
  high:   { maxNear: 120, nearPx: 80,  midPx: 20, maxDist: 150, seg: 14, midSeg: 8, farSeg: 6, puffs: 60, blobs: true,  every: 1, face: true },
};

// ------------------------------------------------------------------------------------------------ geometry builder
// All parts are modelled standing, facing +Z, metres, origin between the feet. Vertex attribute aJ = (joint, kind, variant, material).
// joints: 0 root/torso 1 head 2 upperArmL 3 foreArmL 4 upperArmR 5 foreArmR 6 thighL 7 thighR 8 calfL 9 calfR   (L = +X)
// kinds: 0 body 1 hair 2 hat 3 scarf 4 flag 5 phone 6 skirt/coat
// materials: 0 skin 1 hair 2 top 3 bottom 4 shoe 5 hat 6 scarf 7 flag 9 phone 10 screen 11 sleeve 12 calf 13 face 14 pole
function makeBuilder() {
  const P = [], N = [], I = [], J = [];
  let start = 0;
  const b = {
    /** rings: [{ y, rx, rz, cx?, cz? }] bottom to top. Closed by pole rings at both ends. */
    tube(rings, seg, o = {}) {
      const { joint = 0, kind = 0, vari = 0, mat = 0, ox = 0, oy = 0, oz = 0, twoSided = false, openTop = false, openBottom = false } = o;
      const rs = rings.slice();
      if (!openBottom) rs.unshift({ ...rs[0], rx: 0, rz: 0 });
      if (!openTop) rs.push({ ...rs[rs.length - 1], rx: 0, rz: 0 });
      const base = P.length / 3;
      let cxm = 0, cym = 0, czm = 0;
      for (const r of rs) {
        for (let k = 0; k < seg; k++) {
          const a = (k / seg) * Math.PI * 2;
          const x = (r.cx || 0) + ox + r.rx * Math.sin(a), y = r.y + oy, z = (r.cz || 0) + oz + r.rz * Math.cos(a);
          P.push(x, y, z); N.push(0, 0, 0); J.push(joint, kind, vari, mat);
          cxm += x; cym += y; czm += z;
        }
      }
      const n = rs.length * seg; cxm /= n; cym /= n; czm /= n;
      const tris = [];
      for (let i = 0; i < rs.length - 1; i++) {
        for (let k = 0; k < seg; k++) {
          const k1 = (k + 1) % seg;
          const v00 = base + i * seg + k, v01 = base + i * seg + k1, v10 = base + (i + 1) * seg + k, v11 = base + (i + 1) * seg + k1;
          tris.push([v00, v01, v10], [v01, v11, v10]);
        }
      }
      for (const t of tris) {
        const [a, bb, c] = t;
        const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
        const ux = P[bb * 3] - ax, uy = P[bb * 3 + 1] - ay, uz = P[bb * 3 + 2] - az;
        const vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const len = Math.hypot(nx, ny, nz);
        if (len < 1e-12) continue;                     // degenerate (pole fans) : no triangle, no normal
        if (!twoSided) {                                // orient away from the part centre
          const d = nx * (ax - cxm) + ny * (ay - cym) + nz * (az - czm);
          if (d < 0) { I.push(a, c, bb); nx = -nx; ny = -ny; nz = -nz; } else I.push(a, bb, c);
        } else { I.push(a, bb, c, a, c, bb); }
        for (const v of t) { N[v * 3] += nx / len; N[v * 3 + 1] += ny / len; N[v * 3 + 2] += nz / len; }
      }
    },
    ellipsoid(cx, cy, cz, rx, ry, rz, seg, rings, o = {}) {
      const rs = [];
      for (let i = 1; i < rings; i++) {
        const t = -Math.PI / 2 + (i / rings) * Math.PI;
        rs.push({ y: cy + ry * Math.sin(t), rx: rx * Math.cos(t), rz: rz * Math.cos(t), cx, cz });
      }
      b.tube(rs, seg, { ...o, openTop: false });
    },
    build() {
      const g = new THREE.BufferGeometry();
      const nrm = new Float32Array(N.length);
      for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; nrm[i] = N[i] / l; nrm[i + 1] = N[i + 1] / l; nrm[i + 2] = N[i + 2] / l; }
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      g.setAttribute('aJ', new THREE.BufferAttribute(new Float32Array(J), 4));
      g.setIndex(new THREE.BufferAttribute(new Uint16Array(I), 1));
      return g;
    },
    triangles() { return I.length / 3; },
  };
  return b;
}

/** The merged person. level: 'near' | 'mid' | 'far' picks segment counts and which small details exist. */
function buildPersonGeometry(level, seg, natural = false) {
  const b = makeBuilder();
  const near = level === 'near', far = level === 'far';
  const S = seg, S2 = natural ? seg : Math.max(5, Math.round(seg * 0.7));   // natural look: limbs as round as the trunk (no prism arms)
  // torso (top)
  b.tube([
    { y: 0.84, rx: 0.150, rz: 0.098 }, { y: 0.97, rx: 0.146, rz: 0.090 }, { y: 1.09, rx: 0.158, rz: 0.098 },
    { y: 1.22, rx: 0.182, rz: 0.108, cz: 0.008 }, { y: 1.34, rx: 0.200, rz: 0.100 }, { y: 1.42, rx: 0.172, rz: 0.088 }, { y: 1.47, rx: 0.075, rz: 0.062 },
  ], S, { joint: 0, mat: 2 });
  // hips (bottom)
  b.tube([{ y: 0.74, rx: 0.160, rz: 0.104 }, { y: 0.84, rx: 0.164, rz: 0.104 }, { y: 0.92, rx: 0.152, rz: 0.098 }], S, { joint: 0, mat: 3 });
  // neck (skin)
  b.tube([{ y: 1.44, rx: 0.052, rz: 0.054, cz: 0.004 }, { y: 1.57, rx: 0.048, rz: 0.05, cz: 0.008 }], far ? 4 : S2, { joint: 1, mat: 0 });
  // head (face material, planar face UV is computed in the fragment shader from object position)
  b.tube([
    { y: 1.515, rx: 0.036, rz: 0.040, cz: 0.036 }, { y: 1.55, rx: 0.068, rz: 0.074, cz: 0.022 }, { y: 1.60, rx: 0.088, rz: 0.096, cz: 0.010 },
    { y: 1.66, rx: 0.097, rz: 0.104 }, { y: 1.72, rx: 0.091, rz: 0.099 }, { y: 1.765, rx: 0.066, rz: 0.078 },
  ], far ? 6 : S, { joint: 1, mat: 13 });
  if (!far) {
    if (near) {
      b.ellipsoid(0, 1.628, 0.1, 0.017, 0.028, 0.026, 7, 5, { joint: 1, mat: 0 });                    // nose
      b.ellipsoid(0.099, 1.645, -0.005, 0.012, 0.03, 0.018, 6, 4, { joint: 1, mat: 0 });                // ears
      b.ellipsoid(-0.099, 1.645, -0.005, 0.012, 0.03, 0.018, 6, 4, { joint: 1, mat: 0 });
    }
  }
  // arms: upper (top sleeve), fore (sleeve or skin), hand (skin, joint of the forearm)
  for (const [side, jU, jF] of [[1, 2, 3], [-1, 4, 5]]) {
    const x = side * 0.222;
    b.tube([{ y: 1.12, rx: 0.042, rz: 0.044 }, { y: 1.26, rx: 0.048, rz: 0.050 }, { y: 1.39, rx: 0.056, rz: 0.058 }], far ? 4 : S2, { joint: jU, mat: 2, ox: x });
    b.tube([{ y: 0.87, rx: 0.031, rz: 0.034 }, { y: 1.0, rx: 0.037, rz: 0.040 }, { y: 1.12, rx: 0.043, rz: 0.044 }], far ? 4 : S2, { joint: jF, mat: 11, ox: x });
    if (!far) b.ellipsoid(0, 0.81, 0.005, 0.032, 0.062, 0.02, 6, 4, { joint: jF, mat: 0, ox: x });
  }
  // legs: thigh (bottom), calf (bottom or skin), shoe
  for (const [side, jT, jC] of [[1, 6, 8], [-1, 7, 9]]) {
    const x = side * 0.088;
    b.tube([{ y: 0.46, rx: 0.060, rz: 0.066 }, { y: 0.68, rx: 0.075, rz: 0.082 }, { y: 0.91, rx: 0.085, rz: 0.090 }], far ? 4 : S2, { joint: jT, mat: 3, ox: x });
    b.tube([{ y: 0.09, rx: 0.040, rz: 0.044 }, { y: 0.26, rx: 0.052, rz: 0.058, cz: -0.006 }, { y: 0.48, rx: 0.062, rz: 0.066 }], far ? 4 : S2, { joint: jC, mat: 12, ox: x });
    b.tube([{ y: 0.0, rx: 0.046, rz: 0.115, cz: 0.045 }, { y: 0.05, rx: 0.048, rz: 0.115, cz: 0.045 }, { y: 0.095, rx: 0.042, rz: 0.06, cz: 0.0 }], far ? 4 : S2, { joint: jC, mat: 4, ox: x });
  }
  // hair styles (kind 1)
  const hs = far ? 5 : S;
  const cap = (k, sy = 0, up = 0) => [
    { y: 1.585 + sy, rx: 0.094 * k, rz: 0.088 * k, cz: -0.036 }, { y: 1.64 + sy, rx: 0.100 * k, rz: 0.098 * k, cz: -0.022 }, { y: 1.70 + up, rx: 0.098 * k, rz: 0.106 * k, cz: -0.012 },
    { y: 1.745 + up, rx: 0.086 * k, rz: 0.098 * k, cz: -0.012 }, { y: 1.785 + up, rx: 0.056 * k, rz: 0.075 * k, cz: -0.012 },
  ];
  b.tube(cap(1.07), hs, { joint: 1, kind: 1, vari: 1, mat: 1, openBottom: true });                               // 1 crop
  b.tube(cap(1.095), hs, { joint: 1, kind: 1, vari: 2, mat: 1, openBottom: true });  // 2 side part (a little fuller)
  b.tube(cap(1.08), hs, { joint: 1, kind: 1, vari: 3, mat: 1, openBottom: true });                               // 3 long: cap + curtain
  b.tube([{ y: 1.26, rx: 0.088, rz: 0.040, cz: -0.095 }, { y: 1.45, rx: 0.100, rz: 0.050, cz: -0.095 }, { y: 1.62, rx: 0.108, rz: 0.062, cz: -0.075 }], hs, { joint: 1, kind: 1, vari: 3, mat: 1 });
  b.tube(cap(1.07), hs, { joint: 1, kind: 1, vari: 4, mat: 1, openBottom: true });                               // 4 bun
  b.ellipsoid(0, 1.775, -0.07, 0.048, 0.044, 0.046, Math.max(6, S2), 5, { joint: 1, kind: 1, vari: 4, mat: 1 });
  b.tube([{ y: 1.56, rx: 0.10, rz: 0.10, cz: -0.05 }, { y: 1.64, rx: 0.12, rz: 0.115, cz: -0.03 }, { y: 1.70, rx: 0.135, rz: 0.135, cz: -0.02 }, { y: 1.77, rx: 0.12, rz: 0.12, cz: -0.02 }, { y: 1.83, rx: 0.08, rz: 0.08, cz: -0.02 }], hs, { joint: 1, kind: 1, vari: 5, mat: 1, openBottom: true });   // 5 curly
  b.tube(cap(1.07), hs, { joint: 1, kind: 1, vari: 6, mat: 1, openBottom: true });                               // 6 ponytail
  b.tube([{ y: 1.43, rx: 0.026, rz: 0.026, cz: -0.115 }, { y: 1.58, rx: 0.036, rz: 0.034, cz: -0.115 }, { y: 1.72, rx: 0.03, rz: 0.03, cz: -0.1 }], Math.max(5, S2 - 1), { joint: 1, kind: 1, vari: 6, mat: 1 });
  // hats (kind 2)
  const brim = (r, y, t, cz = 0) => [{ y, rx: r, rz: r, cz }, { y: y + t, rx: r * 0.98, rz: r * 0.98, cz }];
  b.tube(cap(1.10, 0.0, 0.0).slice(1).map((r, i) => (i === 0 ? { ...r, y: 1.672 } : r)), hs, { joint: 1, kind: 2, vari: 1, mat: 5, openBottom: true });       // 1 cap
  b.tube([{ y: 1.693, rx: 0.095, rz: 0.17, cz: 0.1 }, { y: 1.70, rx: 0.095, rz: 0.17, cz: 0.1 }], hs, { joint: 1, kind: 2, vari: 1, mat: 5, twoSided: true });  // cap peak
  b.tube([...brim(0.23, 1.675, 0.012), { y: 1.70, rx: 0.108, rz: 0.108 }, { y: 1.78, rx: 0.100, rz: 0.100 }, { y: 1.80, rx: 0.08, rz: 0.08 }], hs + 4, { joint: 1, kind: 2, vari: 2, mat: 5, openBottom: true });   // 2 brimmed
  b.tube([{ y: 1.64, rx: 0.108, rz: 0.108, cz: -0.01 }, { y: 1.72, rx: 0.113, rz: 0.113, cz: -0.01 }, { y: 1.80, rx: 0.096, rz: 0.096, cz: -0.01 }, { y: 1.86, rx: 0.04, rz: 0.04, cz: -0.01 }], hs, { joint: 1, kind: 2, vari: 3, mat: 5, openBottom: true }); // 3 beanie
  b.tube([{ y: 1.66, rx: 0.118, rz: 0.122 }, { y: 1.72, rx: 0.145, rz: 0.150 }, { y: 1.79, rx: 0.135, rz: 0.140 }, { y: 1.84, rx: 0.085, rz: 0.09 }], hs, { joint: 1, kind: 2, vari: 4, mat: 5, openBottom: true });          // 4 turban
  b.tube([{ y: 1.46, rx: 0.115, rz: 0.115, cz: -0.02 }, { y: 1.58, rx: 0.115, rz: 0.115, cz: -0.025 }, { y: 1.66, rx: 0.113, rz: 0.113, cz: -0.012 }, { y: 1.74, rx: 0.106, rz: 0.113, cz: -0.012 }, { y: 1.795, rx: 0.07, rz: 0.088, cz: -0.012 }], hs, { joint: 1, kind: 2, vari: 5, mat: 5, openBottom: true });                          // 5 headscarf
  b.tube([{ y: 1.69, rx: 0.2, rz: 0.2 }, { y: 1.74, rx: 0.14, rz: 0.14 }, { y: 1.80, rx: 0.07, rz: 0.07 }, { y: 1.9, rx: 0.012, rz: 0.012 }], hs + 2, { joint: 1, kind: 2, vari: 6, mat: 5, openBottom: true });       // 6 conical
  b.tube([{ y: 1.67, rx: 0.115, rz: 0.118, cz: -0.005 }, { y: 1.74, rx: 0.135, rz: 0.138, cz: -0.005 }, { y: 1.82, rx: 0.125, rz: 0.128, cz: -0.005 }, { y: 1.86, rx: 0.1, rz: 0.1, cz: -0.005 }], hs, { joint: 1, kind: 2, vari: 7, mat: 5, openBottom: true });  // 7 fur hat
  b.tube([{ y: 1.7, rx: 0.1, rz: 0.1 }, { y: 1.75, rx: 0.095, rz: 0.098 }, { y: 1.795, rx: 0.07, rz: 0.075 }], hs, { joint: 1, kind: 2, vari: 8, mat: 5, openBottom: true });                                           // 8 skullcap
  // scarf (kind 3): neck wrap + tail on the chest
  b.tube([{ y: 1.40, rx: 0.098, rz: 0.1, cz: 0.005 }, { y: 1.47, rx: 0.1, rz: 0.102, cz: 0.005 }, { y: 1.53, rx: 0.088, rz: 0.09, cz: 0.01 }], S2, { joint: 0, kind: 3, mat: 6, openTop: true, openBottom: true });
  b.tube([{ y: 1.12, rx: 0.045, rz: 0.012, cz: 0.108 }, { y: 1.3, rx: 0.052, rz: 0.014, cz: 0.108 }, { y: 1.4, rx: 0.056, rz: 0.016, cz: 0.1 }], 6, { joint: 0, kind: 3, mat: 6 });
  // dress / long coat skirts (kind 6, variants: 1 dress, 2 long coat)
  b.tube([{ y: 0.40, rx: 0.255, rz: 0.19 }, { y: 0.62, rx: 0.215, rz: 0.158 }, { y: 0.82, rx: 0.172, rz: 0.115 }, { y: 0.92, rx: 0.16, rz: 0.104 }], S, { joint: 0, kind: 6, vari: 1, mat: 2, openBottom: true, openTop: true });
  b.tube([{ y: 0.46, rx: 0.2, rz: 0.15 }, { y: 0.68, rx: 0.188, rz: 0.14 }, { y: 0.84, rx: 0.17, rz: 0.118 }, { y: 0.93, rx: 0.16, rz: 0.106 }], S, { joint: 0, kind: 6, vari: 2, mat: 2, openBottom: true, openTop: true });
  // props: a flag on a pole and a phone, modelled at the right hand (origin) and placed by the shader
  if (!far) {
    b.tube([{ y: -0.15, rx: 0.011, rz: 0.011 }, { y: 0.55, rx: 0.011, rz: 0.011 }, { y: 1.1, rx: 0.009, rz: 0.009 }], 5, { joint: 0, kind: 4, mat: 14 });
    b.tube([{ y: 0.0, rx: 0.045, rz: 0.012 }, { y: 0.14, rx: 0.045, rz: 0.012 }], 4, { joint: 0, kind: 5, mat: 9, twoSided: true, oy: -0.02 });
    b.tube([{ y: 0.0, rx: 0.036, rz: 0.001, cz: 0.012 }, { y: 0.11, rx: 0.036, rz: 0.001, cz: 0.012 }], 4, { joint: 0, kind: 5, mat: 10, twoSided: true, oy: -0.005 });
  }
  const g = b.build();
  g.userData.tris = b.triangles();
  return g;
}

// the flag cloth is a flat grid, built separately (twoSided quads) and merged by index offsets
function addFlagCloth(g) {
  const nx = 6, ny = 3, w = 0.42, h = 0.3, y0 = 0.82;
  const pos = [], idx = [], aj = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { pos.push(0.012 + (i / nx) * w, y0 + (j / ny) * h, 0); aj.push(0, 4, 0, 7); }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, b, c, b, d, c, a, c, b, b, c, d);
  }
  const base = g.attributes.position.count;
  const merge = (name, add, size) => { const old = g.attributes[name].array; const arr = new Float32Array(old.length + add.length); arr.set(old); arr.set(add, old.length); g.setAttribute(name, new THREE.BufferAttribute(arr, size)); };
  merge('position', pos, 3);
  const nrm = []; for (let i = 0; i < pos.length / 3; i++) nrm.push(0, 0, 1);
  merge('normal', nrm, 3); merge('aJ', aj, 4);
  const oldIdx = g.index.array; const ni = new Uint16Array(oldIdx.length + idx.length); ni.set(oldIdx); for (let i = 0; i < idx.length; i++) ni[oldIdx.length + i] = idx[i] + base;
  g.setIndex(new THREE.BufferAttribute(ni, 1));
  g.userData.tris += idx.length / 3;
  return g;
}

// ------------------------------------------------------------------------------------------------ procedural textures
function makeFaceTextures() {
  const CELL = 128, W = CELL * 4;
  const ov = new Uint8Array(W * W * 4), mk = new Uint8Array(W * W * 4);
  const r = rng(90210);
  const IRIS = [[0.16, 0.09, 0.05], [0.22, 0.13, 0.07], [0.28, 0.2, 0.1], [0.22, 0.32, 0.26], [0.28, 0.4, 0.58], [0.3, 0.3, 0.32]];
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let face = 0; face < 16; face++) {
    const cx0 = (face % 4) * CELL, cy0 = Math.floor(face / 4) * CELL;
    const eyeX = 0.155 + r() * 0.04, eyeY = 0.52 + r() * 0.03, eyeW = 0.062 + r() * 0.022, eyeH = 0.024 + r() * 0.008;
    const iris = IRIS[Math.floor(r() * IRIS.length)];
    const browY = eyeY + 0.07 + r() * 0.03, browT = 0.007 + r() * 0.008, browA = r() * 0.03;
    const mouthY = 0.215 + r() * 0.03, mouthW = 0.1 + r() * 0.04, lip = 0.006 + r() * 0.01;
    const beard = r() < 0.34 ? (r() < 0.5 ? 1 : 2) : 0;                       // 1 stubble/short, 2 full + moustache
    const old = r() < 0.2, glasses = r() < 0.14, rosy = 0.04 + r() * 0.06, squint = r() * 0.4;
    for (let py = 0; py < CELL; py++) for (let px = 0; px < CELL; px++) {
      const u = px / (CELL - 1), v = py / (CELL - 1);
      const xm = Math.abs(u - 0.5);                                           // symmetric distance from centre
      let R = 0.9, G = 0.7, B = 0.6, A = 0, hair = 0, brow = 0;
      const put = (cr, cg, cb, a) => { const k = a * (1 - A); R = (R * A + cr * k) / Math.max(1e-6, A + k); G = (G * A + cg * k) / Math.max(1e-6, A + k); B = (B * A + cb * k) / Math.max(1e-6, A + k); A += k; };
      // NOTE: put() composites UNDER what is already there, so the most important layers come first.
      const ex = (xm - eyeX) / eyeW, ey = (v - eyeY) / eyeH;
      const almond = ex * ex + ey * ey * (1 + 0.5 * Math.abs(ex));
      // glasses rims
      if (glasses) {
        const gx = (xm - eyeX) / (eyeW * 1.5), gy = (v - eyeY) / (eyeH * 3.0);
        put(0.05, 0.05, 0.06, 0.9 * sm(0.09, 0.0, Math.abs(Math.sqrt(gx * gx + gy * gy) - 1)));
        if (xm < 0.06) put(0.05, 0.05, 0.06, 0.9 * sm(0.012, 0.0, Math.abs(v - eyeY - 0.015)));
      }
      // mouth
      const my = (v - mouthY), mx = xm / mouthW;
      if (mx < 1) {
        const curve = (1 - mx * mx) * 0.012;
        put(0.2, 0.06, 0.05, 0.85 * sm(0.0035, 0.0, Math.abs(my - curve * 0.4)) * sm(1.0, 0.85, mx));            // mouth line
        put(0.58, 0.28, 0.27, 0.62 * sm(lip * 1.8, 0.0, Math.abs(my + 0.008 - curve * 0.3)) * sm(1.0, 0.7, mx));   // lips
      }
      // lids, pupil, iris, eye white
      put(0.06, 0.03, 0.025, 0.7 * sm(0.012, 0.0, Math.abs(ey - (-1.12 - squint * 0.2)) * eyeH) * sm(1.15, 0.7, Math.abs(ex)));
      put(0.08, 0.04, 0.03, 0.2 * sm(0.012, 0.0, Math.abs(ey - 1.25) * eyeH) * sm(1.0, 0.6, Math.abs(ex)));
      if (almond < 1) {
        const ir = Math.hypot(xm - eyeX, (v - eyeY) * 1.0) / (eyeH * 1.05);
        if (ir < 0.5) put(0.02, 0.02, 0.02, 1);
        if (ir < 1) put(iris[0], iris[1], iris[2], 0.98 * sm(1.0, 0.85, ir));
        put(0.9, 0.88, 0.85, 0.96 * sm(1.0, 0.8, almond));
      }
      // nostrils and nose sides
      put(0.12, 0.04, 0.04, 0.55 * sm(0.022, 0.0, Math.hypot(xm - 0.045, v - 0.335)));
      put(0.15, 0.06, 0.05, 0.2 * sm(0.03, 0.0, Math.abs(xm - 0.07)) * sm(0.2, 0.34, v) * sm(0.55, 0.42, v));
      put(0.2, 0.08, 0.07, 0.16 * sm(0.09, 0.0, Math.hypot(xm, v - 0.30)) * sm(0.0, 0.05, 0.30 - v));
      // soft shading: eye sockets, brow ridge, temples, face sides, under lip, cheeks
      put(0.05, 0.02, 0.02, 0.10 * sm(0.09, 0.0, Math.abs(v - (eyeY + 0.035))) * sm(0.24, 0.08, xm));
      put(0.05, 0.02, 0.02, 0.10 * sm(0.07, 0.0, Math.abs(v - (eyeY - 0.065))) * sm(0.28, 0.1, xm));
      put(0.05, 0.02, 0.02, 0.1 * sm(0.03, 0, Math.abs(my + 0.045)) * sm(0.7, 0.2, mx));
      put(0.05, 0.02, 0.02, 0.10 * sm(0.22, 0.30, xm) * sm(0.15, 0.4, v));
      put(0.78, 0.35, 0.3, rosy * sm(0.11, 0.0, Math.hypot(xm - 0.2, v - 0.37)));
      if (old) put(0.2, 0.08, 0.06, 0.12 * sm(0.5, 0.2, Math.abs(((v - 0.82) * 38) % 1 - 0.5)) * sm(0.28, 0.1, xm) * sm(0.7, 0.8, v));
      // masks: R beard, G brows
      let bm = 0;
      if (beard) {
        const jaw = sm(0.34, 0.2, v) * sm(0.34, 0.22, xm) + sm(0.42, 0.25, v) * sm(0.38, 0.3, xm) * (beard === 2 ? 0.8 : 0.0);
        const noise = 0.65 + 0.35 * Math.sin(px * 1.7 + py * 2.3) * Math.sin(px * 0.9 - py * 1.3);
        const mouthHole = sm(0.0, 0.02, Math.abs(my) - lip * 0.8) * sm(0.0, 0.2, mx - 1 + 0.4 > 0 ? 0.0 : 1.0);
        bm = jaw * (beard === 2 ? 0.92 : 0.45 + 0.1 * noise) * (beard === 2 ? 1 : noise);
        if (beard === 2) bm = Math.max(bm, 0.9 * sm(0.03, 0.0, Math.abs(v - (mouthY + 0.045))) * sm(0.15, 0.08, xm));      // moustache
        bm *= 1 - 0.95 * sm(lip * 1.4, 0.0, Math.abs(my + 0.004)) * sm(1.0, 0.6, mx) * (beard === 2 ? 0 : 1);
        if (v > 0.4) bm *= sm(0.5, 0.4, v);
      }
      const bw = 0.5 * browT / 0.02;
      const by = browY + browA * (0.5 - xm * 2) + (xm - 0.16) * 0.09;
      const bd = Math.abs(v - by) / (browT * 1.3);
      brow = sm(1, 0.3, bd) * sm(0.27, 0.2, xm) * sm(0.05, 0.09, xm + 0.0) * (0.75 + 0.25 * bw);
      const i = ((cy0 + py) * W + cx0 + px) * 4;
      ov[i] = R * 255; ov[i + 1] = G * 255; ov[i + 2] = B * 255; ov[i + 3] = Math.min(1, A) * 255;
      mk[i] = Math.min(1, bm) * 255; mk[i + 1] = Math.min(1, brow) * 255; mk[i + 2] = 0; mk[i + 3] = 255;
    }
  }
  const mkTex = (data) => { const t = new THREE.DataTexture(data, W, W); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };
  return { face: mkTex(ov), mask: mkTex(mk) };
}

function makeFabricTexture() {
  const CELL = 64, W = CELL * 2, d = new Uint8Array(W * W * 4);
  const r = rng(4242);
  const noise = new Float32Array(CELL * CELL); for (let i = 0; i < noise.length; i++) noise[i] = r();
  for (let pat = 0; pat < 4; pat++) {
    const ox = (pat % 2) * CELL, oy = Math.floor(pat / 2) * CELL;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const n = noise[y * CELL + x];
      let v = 0.8 + n * 0.12;
      if (pat === 0) v *= 0.96 + 0.04 * (((x >> 1) + (y >> 1)) & 1);                    // plain weave
      else if (pat === 1) v *= 0.8 + 0.2 * ((x >> 3) & 1);                       // stripes
      else if (pat === 2) v *= (0.8 + 0.2 * ((x >> 4) & 1)) * (0.85 + 0.15 * ((y >> 4) & 1)) * 1.1; // plaid
      else v *= 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(x * Math.PI / 2));                   // knit ribs
      v = Math.min(1, v);
      const i = ((oy + y) * W + ox + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v * 255; d[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(d, W, W);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

function makeBlobTexture(white = 0) {
  const S = 32, d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const rr = Math.hypot((x + 0.5) / S - 0.5, (y + 0.5) / S - 0.5) * 2;
    const a = Math.max(0, 1 - rr); const v = a * a * (3 - 2 * a);
    const i = (y * S + x) * 4; d[i] = d[i + 1] = d[i + 2] = white; d[i + 3] = v * 255;
  }
  const t = new THREE.DataTexture(d, S, S); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
}

// ------------------------------------------------------------------------------------------------ the material (Lambert + injected pose / variant / face shader)
const GLSL_COMMON = /* glsl */`
attribute vec4 aJ;
attribute vec4 iCol0; attribute vec4 iCol1; attribute vec4 iK; attribute vec4 iL; attribute vec4 iM; attribute vec4 iR;
uniform float uTime; uniform float uExcite;
varying vec3 vCol; varying vec3 vP; varying float vMat; varying float vFace; varying float vPat; varying float vCloth; varying vec3 vHair; varying vec3 vEmit; varying vec3 vFlag;
float gFlL, gFlR, gAbL, gAbR, gElL, gElR, gLean, gSway, gTwist, gNod, gThL, gThR, gKnL, gKnR, gSeat, gBob;
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rotZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
vec3 unpackCol(float f){
  float b = floor(f/65536.); float g = floor((f-b*65536.)/256.); float r = f-b*65536.-g*256.;
  return pow(vec3(r,g,b)/255., vec3(2.2));
}
void setupPose(){
  float ph = iM.y, sp = iM.z, idle = iM.x, wk = iM.w, t = uTime, ex = uExcite;
  gSeat = iL.x;
  gFlL = 0.03*sin(t*0.9*sp+ph); gFlR = 0.03*sin(t*0.8*sp+ph+1.0);
  gAbL = 0.10; gAbR = 0.10; gElL = 0.14; gElR = 0.14;
  gLean = 0.0; gSway = 0.0; gBob = 0.004*sin(t*1.7*sp+ph);
  gTwist = 0.38*sin(t*0.31*sp+ph*1.7)*(0.6+0.4*sin(t*0.13+ph));
  gNod = 0.05*sin(t*0.5+ph);
  gThL = 0.0; gThR = 0.0; gKnL = 0.0; gKnR = 0.0;
  if (idle > 0.5 && idle < 1.5) { gSway = 0.03*sin(t*0.45*sp+ph); gLean = 0.025*sin(t*0.33+ph); }
  else if (idle < 2.5) {
    float s = 0.5+0.5*sin(t*(6.0+3.0*ex)*sp+ph);
    gFlL = 1.0; gFlR = 1.0; gAbL = -0.18+0.14*s; gAbR = gAbL; gElL = 1.15+0.2*(1.0-s); gElR = gElL;
  } else if (idle < 3.5) {
    gFlR = 2.45; gAbR = 0.55; gElR = 0.55+0.6*sin(t*7.0*sp+ph); gTwist += 0.2;
  } else if (idle < 4.5) {
    gFlR = 1.5; gAbR = 0.04; gElR = 0.12+0.05*sin(t*4.0+ph); gTwist = 0.22; gLean = 0.05;
  } else if (idle < 5.5) {
    gLean = 0.1+0.04*sin(t*0.7+ph); gTwist = 0.5*sin(t*0.5+ph); gFlL = 0.55; gElL = 1.3; gAbL = -0.05;
  } else if (idle < 6.5) {
    gFlR = 1.4; gElR = 1.75; gAbR = -0.12; gNod = 0.08; gTwist = 0.0;
  } else {
    float w = t*wk+ph;
    gThL = 0.36*sin(w); gThR = -gThL;
    gKnL = max(0.0, -sin(w-0.9))*0.75; gKnR = max(0.0, sin(w-0.9))*0.75;
    gFlL = -0.32*sin(w); gFlR = 0.32*sin(w); gElL = 0.2; gElR = 0.2;
    gBob = abs(sin(w))*0.03; gSway = 0.0;
  }
#ifdef CROWD_NATURAL
  {
    // every person carries a personal posture (slouch, lean, head tilt, weight on one leg) and, when idle, one of a few rest poses
    float h1 = fract(sin(ph*12.9898)*43758.5453), h2 = fract(sin(ph*78.233)*24634.63), h3 = fract(sin(ph*39.425)*11317.1);
    gLean += mix(0.01, 0.08, h1) + gSeat*mix(0.05, 0.16, h2);
    gSway += (h2 - 0.5)*0.07;
    gNod += (h3 - 0.5)*0.16 + gSeat*0.05;
    gTwist += 0.28*sin(t*0.17*sp + ph*3.1)*step(0.45, h2);          // now and then look along the stand
    gBob += 0.003*sin(t*1.5*sp + ph);                              // breathing
    if (idle < 1.5) {
      float pose = floor(h3*5.0);
      if (gSeat > 0.5) {
        if (pose < 1.0)      { gFlL = 0.75; gFlR = 0.75; gElL = 0.75; gElR = 0.75; gAbL = -0.16; gAbR = -0.16; }     // hands in the lap
        else if (pose < 2.0) { gFlL = 0.55; gFlR = 0.55; gElL = 0.55; gElR = 0.55; gAbL = 0.04; gAbR = 0.04; gLean += 0.12; }  // forearms on the knees
        else if (pose < 3.0) { gFlL = 0.6; gElL = 1.45; gAbL = -0.34; gFlR = 0.55; gElR = 1.55; gAbR = -0.34; }      // arms folded
        else if (pose < 4.0) { gFlR = 0.8; gElR = 0.7; gAbR = -0.12; gFlL = 0.15; gAbL = 0.2; gElL = 0.35; gSway += 0.04; }  // one hand on the knee
        else { gFlL = 0.7; gElL = 1.9; gAbL = -0.2; gNod += 0.12; gTwist *= 0.4; }                                 // chin on the hand
        gElL += 0.04*sin(t*0.6*sp + ph); gElR += 0.04*sin(t*0.55*sp + ph + 2.0);
      } else {
        if (pose < 1.0)      { gFlL = 0.6; gElL = 1.45; gAbL = -0.34; gFlR = 0.55; gElR = 1.55; gAbR = -0.34; }      // arms folded
        else if (pose < 2.0) { gFlL = -0.12; gFlR = -0.12; gElL = 0.45; gElR = 0.45; gAbL = 0.06; gAbR = 0.06; }     // hands clasped behind
        else if (pose < 3.0) { gFlR = 0.35; gElR = 1.1; gAbR = -0.15; gFlL = 0.05; gElL = 0.3; }                      // one hand at the chest
        else { gElL = 0.32 + 0.05*sin(t*0.5+ph); gElR = 0.3; gAbL = 0.06; gAbR = 0.07; }                             // relaxed, elbows soft
      }
    }
  }
#endif
  // reactions (type, start, duration, amplitude), staggered by the CPU
  float ru = (t - iR.y)/max(iR.z, 0.001);
  float env = (ru > 0.0 && ru < 1.0) ? min(1.0, sin(3.14159*ru)*1.8) : 0.0;
  float k = env*iR.w;
  if (env > 0.001) {
    float rt = iR.x;
    if (rt < 1.5) {
      float pump = 0.5+0.5*sin(t*9.0*sp+ph*3.0);
      gFlL = mix(gFlL, 2.75+0.3*pump, k); gFlR = mix(gFlR, 2.75+0.3*(1.0-pump), k);
      gAbL = mix(gAbL, 0.3, k); gAbR = mix(gAbR, 0.3, k);
      gElL = mix(gElL, 0.3+0.4*pump, k); gElR = mix(gElR, 0.3+0.4*(1.0-pump), k);
      gBob += k*0.07*abs(sin(t*7.0*sp+ph*2.0)); gNod = mix(gNod, -0.3, k); gTwist *= 1.0-k;
    } else if (rt < 2.5) {
      gFlL = mix(gFlL, 1.5, k); gFlR = mix(gFlR, 1.5, k); gAbL = mix(gAbL, -0.3, k); gAbR = mix(gAbR, -0.3, k);
      gElL = mix(gElL, 2.4, k); gElR = mix(gElR, 2.4, k); gLean = mix(gLean, -0.12, k); gNod = mix(gNod, -0.2, k);
    } else if (rt < 3.5) {
      gFlL = mix(gFlL, 1.95, k); gFlR = mix(gFlR, 1.8, k); gElL = mix(gElL, 2.5, k); gElR = mix(gElR, 2.2, k);
      gAbL = mix(gAbL, 0.0, k); gAbR = mix(gAbR, 0.1, k); gNod = mix(gNod, 0.6, k); gLean = mix(gLean, 0.16, k); gTwist *= 1.0-k;
    } else if (rt < 4.5) {
      gFlR = mix(gFlR, 2.65, k); gAbR = mix(gAbR, 0.45+0.3*sin(t*4.0*sp+ph), k); gElR = mix(gElR, 0.3, k);
      gFlL = mix(gFlL, 2.4, k*0.5); gAbL = mix(gAbL, 0.3, k*0.5); gBob += k*0.03*abs(sin(t*5.0+ph));
    } else {
      gSeat = gSeat*(1.0-smoothstep(0.0, 0.35, env));
      float s = 0.5+0.5*sin(t*8.0*sp+ph);
      gFlL = mix(gFlL, 1.05, k); gFlR = mix(gFlR, 1.05, k); gAbL = mix(gAbL, -0.2+0.14*s, k); gAbR = mix(gAbR, -0.2+0.14*s, k);
      gElL = mix(gElL, 1.2, k); gElR = mix(gElR, 1.2, k); gNod = mix(gNod, -0.1, k);
    }
  }
}
// joint pose: returns the posed position, rotates the normal in place
vec3 poseJoint(vec3 p, inout vec3 n, float J){
  if (J < 0.5) { return p; }
  if (J < 1.5) {
    vec3 hp = vec3(0.0, 1.50, 0.0); mat3 R = rotY(gTwist)*rotX(-gNod);
    n = R*n; return hp + R*(p-hp);
  }
  if (J < 5.5) {
    bool left = (J < 3.5);
    bool fore = (J > 2.5 && J < 3.5) || J > 4.5;
    float side = left ? 1.0 : -1.0;
    float fl = left ? gFlL : gFlR, ab = left ? gAbL : gAbR, el = left ? gElL : gElR;
    vec3 sh = vec3(side*0.222, 1.40, 0.0), eb = vec3(side*0.222, 1.12, 0.0);
    mat3 Ra = rotZ(side*ab)*rotX(-fl);
    if (fore) { mat3 Re = rotX(-el); p = eb + Re*(p-eb); n = Re*n; }
    n = Ra*n; return sh + Ra*(p-sh);
  }
  bool lleft = (J < 6.5) || (J > 7.5 && J < 8.5);
  float sd = lleft ? 1.0 : -1.0;
  float th = (lleft ? gThL : gThR) + 1.5*gSeat, kn = (lleft ? gKnL : gKnR) + 1.5*gSeat;
  vec3 hip = vec3(sd*0.088, 0.90, 0.0), kne = vec3(sd*0.088, 0.48, 0.0);
  if (J > 7.5) { mat3 Rk = rotX(kn); p = kne + Rk*(p-kne); n = Rk*n; }
  mat3 Rt = rotX(-th); n = Rt*n; return hip + Rt*(p-hip);
}
// whole upper body: lean about the hips, then sit / bob
vec3 poseBody(vec3 p, inout vec3 n, float J){
  if (J < 5.5) {
    vec3 hc = vec3(0.0, 0.90, 0.0); mat3 R = rotX(-gLean)*rotZ(gSway);
    p = hc + R*(p-hc); n = R*n;
  }
  p.y += gBob - 0.42*gSeat;
  return p;
}
`;

const GLSL_VERT_MAIN = /* glsl */`
setupPose();
float J = aJ.x, Kd = aJ.y, V = aJ.z, M = aJ.w;
bool cull = false;
float hairS = iK.x, hatS = iK.y, garm = iK.z, prop = iK.w;
if (Kd > 0.5 && Kd < 1.5) { cull = abs(V - hairS) > 0.5 || hairS < 0.5 || hatS > 3.5 && hatS < 5.5 || hatS > 6.5 && hatS < 7.5; }
else if (Kd < 2.5 && Kd > 1.5) { cull = abs(V - hatS) > 0.5; }
else if (Kd < 3.5 && Kd > 2.5) { cull = iL.z < 0.5; }
else if (Kd < 4.5 && Kd > 3.5) { cull = abs(prop - 1.0) > 0.5; }
else if (Kd < 5.5 && Kd > 4.5) { cull = abs(prop - 2.0) > 0.5; }
else if (Kd > 5.5) { cull = !((V < 1.5 && abs(garm - 3.0) < 0.5) || (V > 1.5 && abs(garm - 2.0) < 0.5)); }
vec3 skin = unpackCol(iCol0.x), hair = unpackCol(iCol0.y), top = unpackCol(iCol0.z), bottom = unpackCol(iCol0.w);
vec3 hatc = unpackCol(iCol1.x), scarfc = unpackCol(iCol1.y), flagc = unpackCol(iCol1.z);
vec3 col = skin;
vEmit = vec3(0.0); vCloth = 0.0; vFlag = flagc;
float shortSleeve = step(garm, 0.5);                    // t-shirt: forearms bare
float shorts = iL.w;
if (M < 0.5 || M > 12.5 && M < 13.5) col = skin;
else if (M < 1.5) col = hair;
else if (M < 2.5) { col = top; vCloth = 1.0; }
else if (M < 3.5) { col = bottom; vCloth = 1.0; }
else if (M < 4.5) col = mix(vec3(0.02,0.018,0.016), vec3(0.2,0.16,0.12), fract(iM.y*3.7));
else if (M < 5.5) { col = hatc; vCloth = 1.0; }
else if (M < 6.5) { col = scarfc; vCloth = 1.0; }
else if (M < 7.5) col = flagc;
else if (M < 9.5) col = vec3(0.012);
else if (M < 10.5) { col = vec3(0.08,0.12,0.2); vEmit = vec3(0.35,0.5,0.75); }
else if (M < 11.5) { col = mix(skin, top, 1.0-shortSleeve); vCloth = 1.0-shortSleeve; }
else if (M < 12.5) { col = mix(bottom, skin, shorts); vCloth = 1.0-shorts; }
else col = vec3(0.12,0.08,0.05);
if (M > 13.5) col = vec3(0.13,0.09,0.05);
#ifdef CROWD_NATURAL
if (vCloth > 0.5 || (M > 4.5 && M < 6.5)) { float cl = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(cl), col, 0.66) * 0.9; }   // real fabrics: less toy-saturated
#endif
vCol = col; vMat = M; vHair = hair; vFace = iCol1.w; vPat = iL.y;
vP = position;
vec3 q = position; vec3 nn = objectNormal;
if (Kd > 3.5 && Kd < 5.5) {                 // props: ride the right hand, stay upright
  vec3 hn = vec3(0.0);
  vec3 h = poseJoint(vec3(-0.222, 0.82, 0.03), hn, 5.0);
  h = poseBody(h, hn, 5.0);
  vec3 pp = position;
  if (Kd < 4.5) {                           // flag cloth waves, stronger away from the pole
    float w = max(position.x, 0.0);
    pp.z += sin(uTime*(5.0+2.0*uExcite)+w*14.0+iM.y)*0.05*w*6.0*(0.4+0.6*(1.0));
    pp.y += sin(uTime*3.0+w*9.0)*0.012*w*4.0;
    vP = vec3(position.x, position.y, 0.0);
    float swy = 0.07*sin(uTime*2.3+iM.y);
    pp = rotZ(swy)*pp;
  } else {
    pp = rotX(-0.35)*pp;
  }
  q = h + pp;
  nn = objectNormal;
} else {
  q = poseJoint(q, nn, J);
  q = poseBody(q, nn, J);
}
if (cull) q = vec3(0.0);
gTransformedPos = q;
objectNormal = normalize(nn);
`;

function patchMaterial(mat, uniforms, natural = false) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const def = natural ? '#define CROWD_NATURAL\n' : '';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${def}${GLSL_COMMON}\nvec3 gTransformedPos;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${GLSL_VERT_MAIN}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = gTransformedPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nif (dot(gTransformedPos, gTransformedPos) == 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
${def}uniform sampler2D uFace; uniform sampler2D uMask; uniform sampler2D uFab; uniform float uFaceOn;
varying vec3 vCol; varying vec3 vP; varying float vMat; varying float vFace; varying float vPat; varying float vCloth; varying vec3 vHair; varying vec3 vEmit; varying vec3 vFlag;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 c = vCol;
  float m = vMat;
  if (m > 12.5 && m < 13.5) {
    float fr = smoothstep(-0.02, 0.05, vP.z);
    if (uFaceOn > 0.5) {
      vec2 fuv = clamp(vec2(0.5 + vP.x/0.215, (vP.y - 1.50)/0.29), 0.01, 0.99);
      vec2 cell = vec2(mod(vFace, 4.0), floor(vFace/4.0));
      vec2 uv = (cell + fuv)/4.0;
      vec4 ov = texture2D(uFace, uv); vec2 mk = texture2D(uMask, uv).rg;
      c = mix(c, ov.rgb, ov.a*fr);
      c = mix(c, vHair*0.9, mk.r*fr*0.85);
      c = mix(c, vHair*0.55, mk.g*fr);
    }
    c *= mix(1.0, 0.82, smoothstep(0.1, -0.1, vP.z));      // back of the head sits in shade
  }
  if (vCloth > 0.01) {
    vec2 pc = vec2(mod(vPat, 2.0), floor(vPat/2.0));
    vec2 w = fract(vec2((vP.x + vP.z)*9.0, vP.y*9.0));
    float f = texture2D(uFab, (pc + w)*0.5).r;
    c *= mix(1.0, f*1.18, 0.45*vCloth);
  }
  if (m > 0.5 && m < 1.5) {
    float st = 0.78 + 0.22*sin(atan(vP.x, vP.z + 0.02)*55.0 + vP.y*9.0);
    c *= st * mix(0.72, 1.12, smoothstep(1.60, 1.80, vP.y));
  }
  if (m < 0.5 && vP.y > 1.43 && vP.y < 1.58) c *= mix(0.74, 1.0, smoothstep(1.46, 1.57, vP.y));
  if (m > 6.5 && m < 7.5) {
    float band = mod(floor(vP.x/0.14), 3.0);
    c = (band > 0.5 && band < 1.5) ? vec3(0.8) : vFlag;
  }
  // hem trim on long garments, belly shade low on the body
  if (m > 1.5 && m < 2.5 && vP.y < 0.62 && vP.y > 0.3) c = mix(c, c*0.55+vec3(0.05,0.03,0.0), smoothstep(0.52, 0.4, vP.y));
#ifdef CROWD_NATURAL
  // soft occlusion: legs and feet sit in the shade of the body and the bench, the trunk's flanks under the arms are darker
  c *= mix(0.68, 1.0, smoothstep(0.02, 0.75, vP.y));
  if (vP.y > 0.85 && vP.y < 1.38) c *= 1.0 - 0.16*smoothstep(0.11, 0.19, abs(vP.x))*step(abs(vP.x), 0.205);
  if (m < 0.5 || (m > 12.5 && m < 13.5)) c *= vec3(1.04, 0.99, 0.95);   // skin: a touch of warmth (light scattered under the skin)
#endif
  diffuseColor.rgb = c;
}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vEmit;');
  };
  mat.customProgramCacheKey = () => (natural ? 'crowd3d-v1-natural' : 'crowd3d-v1');
}

// ------------------------------------------------------------------------------------------------ the crowd
const REACTIONS = { cheer: 1, gasp: 2, groan: 3, flag: 4, wave: 4, ovation: 5 };
const DEF_DUR = { cheer: 2.6, gasp: 1.6, groan: 2.2, flag: 3.2, wave: 3.2, ovation: 4.0 };

/**
 * createCrowd3d(stageOrScene, options)
 *  layouts (any mix): stands: [{ center:[x,y,z], yaw, rows, perRow, width, rise, rowDepth, curve, focus:[x,y,z], fill }]
 *                     rows:   [{ from:[x,y,z], to:[x,y,z], count, face:[x,y,z]|yaw, seated }]
 *                     ring:   { center:[x,y,z], radius, rows, rowGap, count, arc:[a0,a1], seated, face:'in'|'out' }
 *                     free:   { area:[x0,z0,x1,z1], y, count, walkers (fraction), avoid:(x,z)=>bool, face:[x,y,z]|yaw }
 *  count: cap on the number of people (default: everything the layouts hold). seed, culture (a name or an array of names), quality:'low'|'medium'|'high'.
 *  options: cold (breath fog), props:{flag,phone,child} probabilities, flagColors, excitement, reaction:{spread,speed}, camera, viewportHeight, blobShadows.
 */
export function createCrowd(stageOrScene, opts = {}) {
  const scene = stageOrScene.scene || stageOrScene;
  const getCamera = () => opts.camera || stageOrScene.camera;
  let quality = QUALITY[opts.quality] ? opts.quality : 'medium';
  let Q = QUALITY[quality];
  const rand = rng(opts.seed ?? 1);
  const cultures = Array.isArray(opts.culture) ? opts.culture : [opts.culture || 'european_village'];
  const group = new THREE.Group(); group.name = 'crowd3d'; scene.add(group);

  // ---------------- layout -> raw slots
  const slots = [];                       // { x,y,z, yaw, seated, walker?, scale?, child?:true }
  const faceYaw = (x, z, f, yawDefault) => {
    if (Array.isArray(f)) return Math.atan2(f[0] - x, f[2] - z);
    if (typeof f === 'number') return f;
    return yawDefault;
  };
  for (const s of opts.stands || []) {
    const c = s.center || [0, 0, 0], yaw = s.yaw || 0, rows = s.rows || 6, per = s.perRow || 24, width = s.width || per * 0.55;
    const rise = s.rise ?? 0.4, depth = s.rowDepth ?? 0.85, curve = s.curve || 0, fill = s.fill ?? 0.88, standing = s.standing ?? 0.08;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    for (let r = 0; r < rows; r++) for (let k = 0; k < per; k++) {
      if (rand() > fill) continue;
      const u = per > 1 ? k / (per - 1) - 0.5 : 0;
      let lx = u * width + (rand() - 0.5) * 0.12, lz = -r * depth + (rand() - 0.5) * 0.1, ly = r * rise;
      let ang = 0;
      if (curve) { const R = width / Math.max(0.01, curve); ang = u * width / R; const rr = R - lz; lx = Math.sin(ang) * rr * 1.0; lz = -(R - Math.cos(ang) * rr) + 0; lz = Math.cos(ang) * rr - R; }
      const wx = c[0] + lx * cs + lz * sn, wz = c[2] - lx * sn + lz * cs;
      let y = c[1] + ly;
      const face = s.focus ? faceYaw(wx, wz, s.focus, yaw) : yaw - ang * 0.9;
      slots.push({ x: wx, y, z: wz, yaw: face + (rand() - 0.5) * 0.35, seated: rand() > standing ? 1 : 0 });
    }
  }
  for (const s of opts.rows || []) {
    const n = s.count || 10;
    for (let k = 0; k < n; k++) {
      const u = n > 1 ? k / (n - 1) : 0.5;
      const x = s.from[0] + (s.to[0] - s.from[0]) * u + (rand() - 0.5) * 0.15, y = s.from[1] + (s.to[1] - s.from[1]) * u, z = s.from[2] + (s.to[2] - s.from[2]) * u + (rand() - 0.5) * 0.15;
      const dx = s.to[0] - s.from[0], dz = s.to[2] - s.from[2];
      const defYaw = Math.atan2(dz, dx) + Math.PI / 2;
      slots.push({ x, y, z, yaw: faceYaw(x, z, s.face, defYaw) + (rand() - 0.5) * 0.3, seated: s.seated ? 1 : 0 });
    }
  }
  if (opts.ring) {
    const s = opts.ring, c = s.center || [0, 0, 0], R = s.radius || 8, rows = s.rows || 2, gap = s.rowGap ?? 0.8;
    const a0 = s.arc ? s.arc[0] : 0, a1 = s.arc ? s.arc[1] : Math.PI * 2;
    for (let r = 0; r < rows; r++) {
      const rr = R + r * gap, n = Math.max(3, Math.round((s.count || 30) / rows * (1 + r * 0.12)));
      for (let k = 0; k < n; k++) {
        const a = a0 + ((k + rand() * 0.5) / n) * (a1 - a0);
        const x = c[0] + Math.sin(a) * rr, z = c[2] + Math.cos(a) * rr;
        const inward = Math.atan2(c[0] - x, c[2] - z);
        slots.push({ x, y: c[1], z, yaw: (s.face === 'out' ? inward + Math.PI : inward) + (rand() - 0.5) * 0.5, seated: s.seated ? 1 : 0 });
      }
    }
  }
  if (opts.free) {
    const s = opts.free, [x0, z0, x1, z1] = s.area, n = s.count || 30, y = s.y || 0;
    let made = 0, guard = 0;
    while (made < n && guard++ < n * 30) {
      const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0);
      if (s.avoid && s.avoid(x, z)) continue;
      const sl = { x, y, z, yaw: faceYaw(x, z, s.face, rand() * Math.PI * 2), seated: 0 };
      if (rand() < (s.walkers || 0)) {
        const dir = s.walkDir || [1, 0, 0];
        const len = s.walkLength || 14;
        const dl = Math.hypot(dir[0], dir[2]) || 1;
        const ux = dir[0] / dl, uz = dir[2] / dl;
        const sgn = rand() < 0.5 ? 1 : -1;
        sl.walker = { ax: x - ux * len * rand() * sgn, az: z - uz * len * rand() * sgn, ux: ux * sgn, uz: uz * sgn, len, t: 0, speed: 0.9 + rand() * 0.7 };
        sl.walker.t = rand();
        sl.yaw = Math.atan2(sl.walker.ux, sl.walker.uz);
      }
      slots.push(sl); made++;
    }
  }
  if (opts.points) for (const p of opts.points) slots.push({ x: p.x, y: p.y || 0, z: p.z, yaw: p.yaw || 0, seated: p.seated ? 1 : 0 });
  // cap by count (keep a seeded random subset, close to uniform)
  let chosen = slots;
  if (opts.count && opts.count < slots.length) {
    const order = slots.map((s, i) => [rand(), i]).sort((a, b) => a[0] - b[0]).slice(0, opts.count).map((v) => v[1]).sort((a, b) => a - b);
    chosen = order.map((i) => slots[i]);
  }

  // ---------------- people (static attributes)
  const people = [];
  const flagCols = (opts.flagColors || []).map(hex);
  const pr = { flag: 0.05, phone: 0.08, child: 0.04, ...(opts.props || {}) };
  const hairTable = (c) => c.hair.map(([k, w]) => [hex(HAIRC[k]), w]);
  const makePerson = (slot, child) => {
    const r = rand;
    const cul = CULTURES[pick(r, cultures.map((n) => [n, 1]))] || CULTURES.european_village;
    const woman = r() < 0.5;
    const kid = !!child || r() < (opts.kids ?? 0.1);
    const skinK = pick(r, cul.skin);
    const skinC = hex(SKIN[skinK][Math.floor(r() * SKIN[skinK].length)]);
    const age = r();
    let hairC = pick(r, hairTable(cul));
    if (age > 0.82) hairC = pick(r, [[hex(HAIRC.grey), 5], [hex(HAIRC.white), 2], [hairC, 1]]);
    let hairStyle = woman ? pick(r, [[3, 4], [6, 2], [4, 2], [2, 1.5], [5, skinK === 'dark' || skinK === 'brown' ? 2.5 : 0.7], [1, 0.6]]) : pick(r, [[1, 5], [2, 3], [0, 0.7], [5, skinK === 'dark' ? 2 : 0.4]]);
    if (kid) hairStyle = pick(r, [[1, 2], [6, 1.5], [3, 1], [2, 1]]);
    let hat = pick(r, woman ? cul.womenHat : cul.hats);
    if (kid && r() < 0.6) hat = 0;
    let garment = pick(r, woman ? cul.womanGarment : cul.garment);
    if (opts.cold) { if (garment === 0) garment = 1; if (r() < 0.55 && hat === 0) hat = pick(r, [[3, 4], [7, 1], [1, 1]]); }
    const soften = (c) => { const g = (c[0] + c[1] + c[2]) / 3; return c.map((v) => v * 0.82 + g * 0.18); };
    const top = soften(jitter(hex(cul.top[Math.floor(r() * cul.top.length)]), r, 0.14));
    const bottom = jitter(hex(cul.bottom[Math.floor(r() * cul.bottom.length)]), r, 0.1);
    const hatC = r() < 0.5 ? top.map((v) => v * 0.8) : hex(cul.top[Math.floor(r() * cul.top.length)]);
    const scarfOn = (opts.cold ? r() < 0.55 : r() < cul.scarf) ? 1 : 0;
    const scarfC = hex(cul.top[Math.floor(r() * cul.top.length)]);
    const prop = r() < pr.flag ? 1 : r() < pr.phone ? 2 : 0;
    const flagC = flagCols.length ? flagCols[Math.floor(r() * flagCols.length)] : hex(cul.flag[Math.floor(r() * cul.flag.length)]);
    const shorts = (!opts.cold && garment === 0 && !woman && r() < 0.18) ? 1 : 0;
    const seated = slot.seated;
    const idleTable = seated
      ? [[0, 3], [1, 3], [2, 1 + 2 * (opts.excitement || 0)], [5, 1.5], [6, 0.8], [3, 0.4]]
      : [[0, 3], [1, 3], [2, 1 + 2 * (opts.excitement || 0)], [3, 0.5], [4, 0.5], [5, 1.5], [6, 0.8]];
    let idle = pick(r, idleTable);
    if (prop === 2 && r() < 0.7) idle = 6;
    if (prop === 1 && idle !== 0 && idle !== 1) idle = 1;
    const walkSpeed = slot.walker ? 3.4 + slot.walker.speed * 0.6 : 0;
    if (slot.walker) idle = 7;
    const sc = kid ? 0.62 + r() * 0.16 : (woman ? 0.93 : 1.0) * (0.95 + r() * 0.1);
    const wide = (kid ? 0.78 : (woman ? 0.9 : 1.0)) * (0.92 + r() * 0.18);
    const p = {
      slot, x: slot.x, y: slot.y, z: slot.z, yaw: slot.yaw, scale: sc, wide, kid,
      col0: [packRGB(...jitter(skinC, r, 0.05)), packRGB(...hairC), packRGB(...top), packRGB(...bottom)],
      col1: [packRGB(...hatC), packRGB(...scarfC), packRGB(...flagC), Math.floor(r() * 16)],
      k: [hairStyle, hat, garment === 3 && !woman ? 2 : garment, prop],
      l: [seated, Math.floor(pick(r, cul.patterns)), scarfOn, shorts],
      m: [idle, r() * 6.283, 0.8 + r() * 0.45, walkSpeed],
      react: [0, -999, 1, 0],
      walker: slot.walker || null,
      mood: r(),
    };
    return p;
  };
  for (const s of chosen) {
    const p = makePerson(s, false); people.push(p);
    if (!s.walker && !s.seated && people.length < (opts.count || 1e9) && rand() < pr.child) {
      const kidSlot = { x: s.x, y: s.y + 1.07 * p.scale, z: s.z, yaw: s.yaw, seated: 1 };
      const kp = makePerson(kidSlot, true);
      kp.scale = 0.55; kp.wide = 0.7; kp.l[0] = 1; kp.m[0] = pick(rand, [[2, 2], [3, 1], [1, 2]]); kp.k[3] = 0; kp.l[2] = 0;
      people.push(kp);
    }
  }
  const N = people.length;

  // ---------------- GPU resources
  // look: 'classic' (default, unchanged since 1.8.0) | 'natural' (1.12.0 opt-in: round limbs, personal posture + rest poses, look-around,
  // muted fabrics, soft height occlusion; same draw calls, ~+35% near / +20% mid triangles)
  const NATURAL = opts.look === 'natural';
  const tex = makeFaceTextures(); const fab = makeFabricTexture();
  const timeU = { value: 0 }, exciteU = { value: opts.excitement || 0 };
  const uniforms = { uTime: timeU, uExcite: exciteU, uFace: { value: tex.face }, uMask: { value: tex.mask }, uFab: { value: fab }, uFaceOn: { value: Q.face ? 1 : 0 } };
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
  patchMaterial(material, uniforms, NATURAL);
  const IBA = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 1).instanceMatrix.constructor;

  function makeLevel(level, seg) {
    const g = level === 'far' ? buildPersonGeometry('far', seg, NATURAL) : buildPersonGeometry(level, NATURAL && level === 'near' ? seg + 3 : seg, NATURAL);
    if (level !== 'far') addFlagCloth(g);
    const bufs = {};
    for (const name of ['iCol0', 'iCol1', 'iK', 'iL', 'iM', 'iR']) {
      const a = new IBA(new Float32Array(Math.max(1, N) * 4), 4); a.usage = 35048; g.setAttribute(name, a); bufs[name] = a;
    }
    const mesh = new THREE.InstancedMesh(g, material, Math.max(1, N));
    mesh.instanceMatrix.usage = 35048;
    mesh.frustumCulled = false; mesh.count = 0; mesh.name = `crowd3d-${level}`;
    group.add(mesh);
    return { level, mesh, g, bufs, count: 0, tris: g.userData.tris };
  }
  let near = makeLevel('near', Q.seg), mid = makeLevel('mid', Q.midSeg), far = makeLevel('far', Q.farSeg);
  const LEVELS = [near, mid, far];

  // blob shadows + breath puffs
  const blobTex = makeBlobTexture();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.42, fog: true });
  const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(blobGeo, blobMat, Math.max(1, N));
  blobs.frustumCulled = false; blobs.count = 0; blobs.renderOrder = -1; blobs.visible = opts.blobShadows !== false && Q.blobs;
  group.add(blobs);
  const puffTex = makeBlobTexture(255);
  const puffMat = new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0.0, color: 0xffffff, fog: true });
  puffMat.opacity = 0.55;
  const maxPuffs = QUALITY.high.puffs;
  const puffGeo = new THREE.PlaneGeometry(1, 1);
  const puffs = new THREE.InstancedMesh(puffGeo, puffMat, maxPuffs);
  puffs.frustumCulled = false; puffs.count = 0; puffs.visible = !!opts.cold;
  group.add(puffs);

  // ---------------- state
  let time = 0, frame = 0, dirty = true, lastSig = NaN, excitement = opts.excitement || 0;
  const react = { spread: 0.7, speed: 18, ...(opts.reaction || {}) };
  const hasWalkers = people.some((p) => p.walker);
  const stat = { people: N, near: 0, mid: 0, far: 0, culled: 0, drawCalls: 0, triangles: 0 };
  const tmpInv = new THREE.Matrix4();
  const camQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  const cand = [];

  function writeMatrix(arr, o, x, y, z, yaw, sx, sy, sz) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    arr[o] = c * sx; arr[o + 1] = 0; arr[o + 2] = -s * sx; arr[o + 3] = 0;
    arr[o + 4] = 0; arr[o + 5] = sy; arr[o + 6] = 0; arr[o + 7] = 0;
    arr[o + 8] = s * sz; arr[o + 9] = 0; arr[o + 10] = c * sz; arr[o + 11] = 0;
    arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
  }
  function put(lv, i, p) {
    const n = lv.count++;
    writeMatrix(lv.mesh.instanceMatrix.array, n * 16, p.x, p.y, p.z, p.yaw, p.scale * p.wide, p.scale, p.scale * p.wide);
    const b = lv.bufs;
    b.iCol0.array.set(p.col0, n * 4); b.iCol1.array.set(p.col1, n * 4); b.iK.array.set(p.k, n * 4);
    b.iL.array.set(p.l, n * 4); b.iM.array.set(p.m, n * 4); b.iR.array.set(p.react, n * 4);
  }
  function pass(camera, vh) {
    camera.updateMatrixWorld();
    tmpInv.copy(camera.matrixWorld).invert();
    const e = tmpInv.elements;
    const tanH = Math.tan((camera.fov * Math.PI / 180) / 2), asp = camera.aspect || 1;
    const projScale = vh / (2 * tanH);
    cand.length = 0;
    let culled = 0;
    for (let i = 0; i < N; i++) {
      const p = people[i];
      const hx = p.x, hy = p.y + 0.9 * p.scale, hz = p.z;
      const vx = e[0] * hx + e[4] * hy + e[8] * hz + e[12];
      const vy = e[1] * hx + e[5] * hy + e[9] * hz + e[13];
      const vz = e[2] * hx + e[6] * hy + e[10] * hz + e[14];
      const depth = -vz;
      if (depth < 0.2 || depth > Q.maxDist) { culled++; p._lv = -1; continue; }
      const half = 1.1 * p.scale;
      const lim = depth * tanH;
      if (Math.abs(vy) - half > lim * 1.05 || Math.abs(vx) - half > lim * asp * 1.05) { culled++; p._lv = -1; continue; }
      const px = 1.78 * p.scale * projScale / depth;
      p._px = px; p._depth = depth; p._lv = px >= Q.nearPx ? 0 : px >= Q.midPx ? 1 : 2;
      if (px < 1.2) { culled++; p._lv = -1; continue; }
      cand.push(p);
    }
    // cap the near set: keep the closest, demote the rest to mid
    let nNear = 0;
    for (const p of cand) if (p._lv === 0) nNear++;
    if (nNear > Q.maxNear) {
      const list = cand.filter((p) => p._lv === 0).sort((a, b) => a._depth - b._depth);
      for (let k = Q.maxNear; k < list.length; k++) list[k]._lv = 1;
    }
    near.count = mid.count = far.count = 0;
    let nb = 0;
    const barr = blobs.instanceMatrix.array;
    for (const p of cand) {
      put(LEVELS[p._lv], 0, p);
      if (p._lv < 2 && blobs.visible) { const s = 0.62 * p.scale * (p.kid ? 0.8 : 1.0); writeMatrix(barr, nb * 16, p.x, p.y + 0.02, p.z, 0, s * 1.15, 1, s * 1.15); nb++; }
    }
    blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
    for (const lv of LEVELS) {
      lv.mesh.count = lv.count; lv.mesh.instanceMatrix.needsUpdate = true;
      for (const k in lv.bufs) lv.bufs[k].needsUpdate = true;
    }
    stat.near = near.count; stat.mid = mid.count; stat.far = far.count; stat.culled = culled;
    stat.drawCalls = (near.count ? 1 : 0) + (mid.count ? 1 : 0) + (far.count ? 1 : 0) + (nb ? 1 : 0) + (puffs.count ? 1 : 0);
    stat.triangles = near.count * near.tris * 0.55 + mid.count * mid.tris * 0.55 + far.count * far.tris * 0.55;   // culled variants are degenerate: ~45% of the buffer is skipped
  }

  function updatePuffs(camera) {
    if (!opts.cold || !Q.puffs) { puffs.count = 0; return; }
    camera.getWorldQuaternion(camQ);
    let n = 0;
    const mP = puffs.instanceMatrix.array;
    // the closest people breathe out on their own rhythm
    const list = [];
    for (const p of people) if (p._lv === 0) list.push(p);
    list.sort((a, b) => a._depth - b._depth);
    for (let i = 0; i < list.length && n < Q.puffs; i++) {
      const p = list[i];
      const per = 3.3 + p.mood * 1.2, u = ((time + p.mood * 10) % per) / per;
      if (u > 0.4) continue;
      const k = u / 0.4;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      const hy = p.y + (1.58 - 0.42 * p.l[0]) * p.scale;
      const dist = 0.14 + k * 0.35;
      tmpV.set(p.x + fx * dist * p.scale, hy + k * 0.22, p.z + fz * dist * p.scale);
      const s = (0.07 + k * 0.28) * p.scale * (1 - k * 0.55);
      tmpS.set(s, s, s);
      tmpM.compose(tmpV, camQ, tmpS);
      tmpM.toArray(mP, n * 16);
      n++;
    }
    puffs.count = n; puffs.instanceMatrix.needsUpdate = true;
  }

  const api = {
    group, people, quality: () => quality,
    /** Advance the crowd by the SIM dt (seconds). Pass the camera if the stage has none. */
    update(dt, camera) {
      time += dt; timeU.value = time; frame++;
      const cam = camera || getCamera();
      if (!cam) return api;
      if (hasWalkers) {
        for (const p of people) {
          const w = p.walker; if (!w) continue;
          w.t += w.speed * dt / w.len; if (w.t > 1) w.t -= 1;
          p.x = w.ax + w.ux * w.len * w.t; p.z = w.az + w.uz * w.len * w.t;
        }
        dirty = true;
      }
      const m = cam.matrixWorld.elements; cam.updateMatrixWorld();
      const sig = m[12] * 3.1 + m[13] * 5.3 + m[14] * 7.7 + m[0] * 11 + m[2] * 13 + m[8] * 17 + m[10] * 19 + cam.fov * 0.7 + (cam.aspect || 1) * 0.31;
      if (dirty || sig !== lastSig || frame % (Q.every * 20) === 0) {
        if (dirty || frame % Q.every === 0) {
          const vh = opts.viewportHeight || (stageOrScene.renderer ? stageOrScene.renderer.domElement.height / stageOrScene.renderer.getPixelRatio() : 800);
          pass(cam, vh); lastSig = sig; dirty = false;
        }
      }
      updatePuffs(cam);
      return api;
    },
    /**
     * Trigger a collective reaction. kind: 'cheer' | 'gasp' | 'groan' | 'flag' | 'ovation'.
     * opts: { intensity 0..1, duration s, origin:[x,y,z] + radius (people farther away do not react) , spread (stagger s), where:(person)=>bool }
     */
    react(kind, o = {}) {
      const type = REACTIONS[kind]; if (!type) throw new Error(`crowd3d: unknown reaction "${kind}"`);
      const dur = o.duration || DEF_DUR[kind], inten = o.intensity ?? 1, spread = o.spread ?? react.spread;
      for (const p of people) {
        if (o.where && !o.where(p)) continue;
        let delay = p.mood * spread;
        if (o.origin) {
          const d = Math.hypot(p.x - o.origin[0], p.z - o.origin[2]);
          if (o.radius && d > o.radius) continue;
          delay += d / react.speed;
        }
        if (type === 4 && p.k[3] !== 1 && p.mood > 0.5 + 0.4 * inten) continue;            // only some people join a flag wave
        p.react = [type, time + delay, dur * (0.85 + 0.3 * p.mood), inten * (0.65 + 0.35 * p.mood)];
      }
      dirty = true; return api;
    },
    clearReactions() { for (const p of people) p.react = [0, -999, 1, 0]; dirty = true; return api; },
    /** 0..1: more clapping / waving and quicker idle motion. */
    setExcitement(v) {
      excitement = Math.max(0, Math.min(1, v)); exciteU.value = excitement;
      return api;
    },
    setQuality(name) {
      if (!QUALITY[name]) return api;
      quality = name; Q = QUALITY[name]; uniforms.uFaceOn.value = Q.face ? 1 : 0; blobs.visible = opts.blobShadows !== false && Q.blobs;
      dirty = true; return api;
    },
    setCold(v) { opts.cold = !!v; puffs.visible = !!v; return api; },
    stats() { return { ...stat, time }; },
    /** Person count per level of the last pass. */
    levels() { return { near: stat.near, mid: stat.mid, far: stat.far }; },
    invalidate() { dirty = true; return api; },
    dispose() {
      scene.remove(group);
      for (const lv of LEVELS) { lv.g.dispose(); lv.mesh.dispose?.(); }
      blobs.dispose?.(); puffs.dispose?.(); material.dispose(); tex.face.dispose(); tex.mask.dispose(); fab.dispose(); blobTex.dispose();
    },
  };
  return api;
}
export { createCrowd as createCrowd3d };
