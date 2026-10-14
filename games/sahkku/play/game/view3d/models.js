// Sculpted models: herders, the reindeer king, dice, the board and the environment. World units: one board cell = 1.
import * as THREE from '../vendor3d/three.js';
import { lathe, slab, roundedBox, flatPoly, starPoints, merge, M4 } from './geo.js';
import { woodCanvas, feltCanvas, bandRingCanvas, dieFaceCanvas, snowCanvas, rugCanvas, blobCanvas, tex } from './mats.js';

const TAU = Math.PI * 2;
export const TILE_TOP = 0.27;                       // y of the top of a track tile
export const SIDES = [
  { main: '#cf3526', dark: '#7d1810', light: '#f58a6c', trim: '#ffd24a' },
  { main: '#2c63cf', dark: '#143a86', light: '#8fb8ff', trim: '#ffd24a' },
];
export const WOOD3 = {
  birch: { frame: ['#8a5a30', '#5a3418'], tile: ['#ecc98a', '#c79a56'], tile2: ['#dfb87a', '#b88a48'], felt: ['#1f3260', '#0c1530'] },
  spruce: { frame: ['#5e3c1f', '#2d1a0a'], tile: ['#efdcb0', '#cdb27a'], tile2: ['#dec590', '#b79a62'], felt: ['#2a4048', '#0f1a20'] },
  rowan: { frame: ['#7e3d2e', '#3a1710'], tile: ['#f4dfc4', '#d8b48e'], tile2: ['#e7c9a4', '#c39a72'], felt: ['#40203a', '#1c0c1a'] },
};

const matCache = new Map();
export function mat(key, make) { let m = matCache.get(key); if (!m) { m = make(); matCache.set(key, m); } return m; }
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
// The shared three bundle has no MeshPhysicalMaterial: lacquer/clearcoat is approximated with low roughness + the environment map.
export const phys = (color, o = {}) => {
  const { clearcoat, clearcoatRoughness, ...rest } = o;
  const r = rest.roughness ?? 0.5;
  return new THREE.MeshStandardMaterial({ color, metalness: 0, ...rest, roughness: clearcoat ? Math.max(0.16, r * (1 - clearcoat * 0.45)) : r });
};
export const M = {
  gold: () => mat('gold', () => std('#e2b14a', { metalness: 0.85, roughness: 0.28 })),
  brass: () => mat('brass', () => std('#b98a35', { metalness: 0.8, roughness: 0.38 })),
  skin: () => mat('skin', () => phys('#e8b88a', { roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 })),
  dark: () => mat('dark', () => std('#241a12', { roughness: 0.5 })),
  leather: () => mat('leather', () => std('#4a2a14', { roughness: 0.55 })),
  wool: () => mat('wool', () => std('#e6ecfa', { roughness: 0.9 })),
  woolShade: () => mat('woolShade', () => std('#d3dcef', { roughness: 0.95 })),
  bone: () => mat('bone', () => phys('#efe2ba', { roughness: 0.5, clearcoat: 0.2 })),
  hoof: () => mat('hoof', () => std('#30343f', { roughness: 0.4 })),
  base: () => mat('base', () => phys('#6b4423', { roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.35 })),
  cloth: (c) => mat('cloth' + c, () => std(c, { roughness: 0.82 })),
  lacq: (c) => mat('lacq' + c, () => phys(c, { roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 })),
};
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}

// ---------------------------------------------------------------- herder
const geoCache = new Map();
const G = (key, make) => { let g = geoCache.get(key); if (!g) { g = make(); geoCache.set(key, g); } return g; };

export function makeHerder(side, style = 'four') {
  const S = SIDES[side], gr = new THREE.Group(), body = new THREE.Group(); gr.add(body);
  const cloth = M.cloth(S.main), trim = M.gold();
  body.add(mesh(G('h-base', () => lathe([[0, 0], [0.31, 0], [0.335, 0.025], [0.335, 0.06], [0.3, 0.085], [0.25, 0.095], [0, 0.095]], 28)), M.base()));
  body.add(mesh(G('h-robe', () => lathe([[0.001, 0.09], [0.27, 0.09], [0.285, 0.12], [0.265, 0.24], [0.23, 0.38], [0.185, 0.5], [0.165, 0.58], [0.185, 0.625], [0.15, 0.665], [0.085, 0.69], [0.001, 0.7]], 32)), cloth));
  body.add(mesh(G('h-hem', () => lathe([[0.268, 0.115], [0.292, 0.115], [0.294, 0.125], [0.288, 0.17], [0.27, 0.172]], 32)), trim));
  body.add(mesh(G('h-hem2', () => lathe([[0.255, 0.2], [0.265, 0.2], [0.262, 0.215], [0.25, 0.215]], 32)), M.cloth(S.light)));
  body.add(mesh(G('h-belt', () => lathe([[0.215, 0.335], [0.245, 0.335], [0.245, 0.385], [0.2, 0.385]], 32)), M.leather()));
  const buckle = mesh(box(0.07, 0.07, 0.03), trim, 0, 0.36, 0.245); body.add(buckle);
  body.add(mesh(G('h-collar', () => lathe([[0.1, 0.62], [0.19, 0.6], [0.2, 0.635], [0.17, 0.665], [0.1, 0.675]], 32)), trim));
  // arms and mittens
  for (const sgn of [-1, 1]) {
    const arm = mesh(G('h-arm', () => new THREE.CapsuleGeometry(0.052, 0.17, 4, 10)), cloth, sgn * 0.215, 0.5, 0.06);
    arm.rotation.z = -sgn * 0.42; arm.rotation.x = -0.25; body.add(arm);
    body.add(mesh(G('h-hand', () => new THREE.SphereGeometry(0.052, 12, 10)), M.skin(), sgn * 0.285, 0.395, 0.12));
  }
  // head
  const head = mesh(G('h-head', () => new THREE.SphereGeometry(0.118, 24, 18)), M.skin(), 0, 0.8, 0); body.add(head);
  body.add(mesh(G('h-nose', () => new THREE.SphereGeometry(0.02, 8, 6)), mat('skin2', () => std('#d99a70', { roughness: 0.6 })), 0, 0.785, 0.118));
  for (const sgn of [-1, 1]) {
    body.add(mesh(G('h-eye', () => new THREE.SphereGeometry(0.0155, 8, 6)), M.dark(), sgn * 0.043, 0.812, 0.108));
    body.add(mesh(G('h-cheek', () => new THREE.SphereGeometry(0.028, 8, 6)), mat('cheek', () => std('#e58a6c', { roughness: 0.7, transparent: true, opacity: 0.55 })), sgn * 0.075, 0.775, 0.085));
  }
  // cap
  if (style === 'four') {
    body.add(mesh(G('h-band', () => lathe([[0.118, 0.855], [0.138, 0.855], [0.138, 0.9], [0.122, 0.9]], 28)), trim));
    body.add(mesh(G('h-crown', () => lathe([[0.001, 0.93], [0.12, 0.9], [0.13, 0.93], [0.1, 0.965], [0.001, 0.975]], 28)), cloth));
    for (let k = 0; k < 4; k++) {
      const ph = k * (Math.PI / 2) + Math.PI / 4, hg = new THREE.Group(); hg.rotation.y = ph; hg.position.set(0, 0.945, 0);
      const horn = mesh(G('h-horn', () => new THREE.CylinderGeometry(0.058, 0.032, 0.17, 12)), cloth, 0.085, 0.045, 0); horn.rotation.z = -0.95;
      const tip = mesh(G('h-tip', () => new THREE.SphereGeometry(0.036, 10, 8)), trim, 0.165, 0.115, 0);
      hg.add(horn, tip); body.add(hg);
    }
  } else {
    body.add(mesh(G('h-band', () => lathe([[0.118, 0.855], [0.138, 0.855], [0.138, 0.9], [0.122, 0.9]], 28)), trim));
    body.add(mesh(G('h-dome', () => { const p = []; for (let i = 0; i <= 8; i++) { const t = (i / 8) * Math.PI / 2; p.push([Math.max(0.001, Math.cos(t) * 0.138), 0.9 + Math.sin(t) * 0.1]); } return lathe(p, 28); }), cloth));
    body.add(mesh(G('h-pom', () => new THREE.SphereGeometry(0.034, 10, 8)), trim, 0, 1.0, 0));
  }
  gr.userData.body = body; gr.userData.height = 1.06;
  return gr;
}

// ---------------------------------------------------------------- reindeer king
function tube(points, r, material) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve, 16, r, 8, false), material);
}
export function makeKing(owner) {
  const col = owner < 0 ? '#3fb4c8' : SIDES[owner].main, gr = new THREE.Group(), body = new THREE.Group(); gr.add(body);
  const wool = M.wool(), cloth = M.cloth(col);
  body.add(mesh(G('k-base', () => lathe([[0, 0], [0.4, 0], [0.43, 0.03], [0.43, 0.07], [0.38, 0.1], [0, 0.1]], 32)), M.base()));
  const ring = mesh(G('k-ring', () => lathe([[0.36, 0.1], [0.4, 0.1], [0.4, 0.125], [0.36, 0.125]], 32)), owner < 0 ? mat('kring', () => phys('#cfe0ff', { roughness: 0.2, metalness: 0.6 })) : M.lacq(col));
  body.add(ring);
  const torso = mesh(G('k-torso', () => new THREE.SphereGeometry(0.5, 28, 20)), wool, 0, 0.5, 0); torso.scale.set(0.36, 0.2, 0.2); body.add(torso);
  const chest = mesh(G('k-chest', () => new THREE.SphereGeometry(0.5, 20, 14)), wool, 0.2, 0.52, 0); chest.scale.set(0.28, 0.34, 0.3); body.add(chest);
  const rump = mesh(G('k-rump', () => new THREE.SphereGeometry(0.5, 20, 14)), wool, -0.2, 0.5, 0); rump.scale.set(0.3, 0.34, 0.34); body.add(rump);
  for (const [lx, lz] of [[0.19, 0.1], [0.19, -0.1], [-0.2, 0.1], [-0.2, -0.1]]) {
    body.add(mesh(G('k-leg', () => new THREE.CylinderGeometry(0.036, 0.046, 0.38, 10)), M.woolShade(), lx, 0.3, lz));
    body.add(mesh(G('k-hoof', () => new THREE.CylinderGeometry(0.044, 0.05, 0.06, 10)), M.hoof(), lx, 0.13, lz));
  }
  const neck = mesh(G('k-neck', () => new THREE.CylinderGeometry(0.07, 0.115, 0.34, 14)), wool, 0.31, 0.7, 0); neck.rotation.z = -0.55; body.add(neck);
  const head = mesh(G('k-head', () => new THREE.SphereGeometry(0.5, 20, 16)), wool, 0.43, 0.83, 0); head.scale.set(0.26, 0.2, 0.17); head.rotation.z = -0.25; body.add(head);
  const muz = mesh(G('k-muz', () => new THREE.SphereGeometry(0.5, 14, 10)), M.hoof(), 0.555, 0.785, 0); muz.scale.set(0.12, 0.1, 0.1); body.add(muz);
  for (const sgn of [-1, 1]) {
    body.add(mesh(G('k-eye', () => new THREE.SphereGeometry(0.018, 8, 6)), M.dark(), 0.47, 0.86, sgn * 0.075));
    const ear = mesh(G('k-ear', () => new THREE.CylinderGeometry(0.0, 0.04, 0.12, 8)), M.woolShade(), 0.36, 0.95, sgn * 0.1); ear.rotation.x = sgn * 0.9; ear.rotation.z = 0.2; body.add(ear);
    const ant = new THREE.Group(); const s = sgn;
    ant.add(tube([[0.36, 0.93, s * 0.06], [0.31, 1.04, s * 0.14], [0.22, 1.16, s * 0.2], [0.13, 1.3, s * 0.2]], 0.021, M.bone()));
    ant.add(tube([[0.3, 1.05, s * 0.14], [0.36, 1.12, s * 0.2], [0.42, 1.2, s * 0.22]], 0.015, M.bone()));
    ant.add(tube([[0.22, 1.16, s * 0.2], [0.27, 1.27, s * 0.24], [0.24, 1.37, s * 0.25]], 0.014, M.bone()));
    ant.add(tube([[0.17, 1.23, s * 0.2], [0.08, 1.2, s * 0.26], [0.0, 1.22, s * 0.3]], 0.013, M.bone()));
    ant.add(tube([[0.13, 1.3, s * 0.2], [0.07, 1.4, s * 0.2], [0.09, 1.46, s * 0.2]], 0.012, M.bone()));
    body.add(ant);
  }
  const blanket = mesh(G('k-blanket', () => slab(0.36, 0.46, 0.05, 0.06, 0.02, { seg: 2 })), cloth, -0.02, 0.585, 0); blanket.rotation.z = 0; body.add(blanket);
  const bt = mesh(G('k-btrim', () => slab(0.045, 0.5, 0.05, 0.015, 0.01, { seg: 2 })), M.gold(), 0.17, 0.585, 0); body.add(bt);
  const bt2 = mesh(G('k-btrim', () => slab(0.045, 0.5, 0.05, 0.015, 0.01, { seg: 2 })), M.gold(), -0.21, 0.585, 0); body.add(bt2);
  const collar = mesh(G('k-collar', () => new THREE.TorusGeometry(0.095, 0.028, 8, 20)), M.lacq(col), 0.275, 0.72, 0); collar.rotation.y = Math.PI / 2; collar.rotation.x = 0; collar.rotation.z = 0; collar.rotation.set(0, Math.PI / 2, 0.55); body.add(collar);
  const tail = mesh(G('k-tail', () => new THREE.SphereGeometry(0.05, 10, 8)), wool, -0.38, 0.58, 0); body.add(tail);
  body.rotation.y = -1.0;
  gr.userData.body = body; gr.userData.height = 1.45;
  return gr;
}

// ---------------------------------------------------------------- dice
const FACE_KEYS = [1, 2, 3, 'sun', 'sun', 1];       // +x, -x, +y, -y, +z, -z
let dieMats = null, blankMats = null;
export function blankMaterials() {
  if (!blankMats) blankMats = FACE_KEYS.map(() => phys('#ffffff', { map: tex(dieFaceCanvas('?'), { srgb: true }), roughness: 0.42, clearcoat: 0.55 }));
  return blankMats;
}
export function dieMaterials() {
  if (!dieMats) dieMats = FACE_KEYS.map((k) => { const t = tex(dieFaceCanvas(k), { srgb: true }); return phys('#ffffff', { map: t, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.25 }); });
  return dieMats;
}
export function makeDie() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(G('die', () => roundedBox(1, 0.16, 6)), dieMaterials()); m.castShadow = true; m.receiveShadow = true; g.add(m);
  return g;
}
// orientation (quaternion) that puts the face of value v on +y. 0..3, or 4 = the '?' face
export function dieUp(v) {
  const q = new THREE.Quaternion();
  if (v === 3) return q;
  if (v === 1) return q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  if (v === 2) return q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
  if (v === 0) return q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
  return q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
}

// ---------------------------------------------------------------- board
// cell index i = r * 7 + c  ->  local x, z (board centred, cell = 1). Rows grow towards +z (the near edge for the Red player).
export const cellX = (i) => (i % 7) - 3;
export const cellZ = (i) => Math.floor(i / 7) - 3;
const FRAME_W = 0.5;
export const HALF = 3.5 + FRAME_W;

function tileMaterial(woodKey, alt, tint) {
  return mat(`tile|${woodKey}|${alt}|${tint || ''}`, () => {
    const w = WOOD3[woodKey], cols = alt ? w.tile2 : w.tile, wc = woodCanvas(256, cols[0], cols[1], alt ? 41 : 17, { lines: 70, knots: 1 });
    const m = phys(tint ? new THREE.Color('#ffffff').lerp(new THREE.Color(tint), 0.55) : '#ffffff', { map: tex(wc.map), bumpMap: tex(wc.bump, { srgb: false }), bumpScale: 0.6, roughness: 0.52, clearcoat: 0.35, clearcoatRoughness: 0.4 });
    return m;
  });
}
function frameMaterials(woodKey) {
  return mat('frame|' + woodKey, () => {
    const w = WOOD3[woodKey], wc = woodCanvas(1024, w.frame[0], w.frame[1], 5, { lines: 220, knots: 3 });
    const t = tex(wc.map), b = tex(wc.bump, { srgb: false });
    return phys('#ffffff', { map: t, bumpMap: b, bumpScale: 1.2, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  });
}

export function buildBoard(woodKey, camps, gates, centre, ring, cross) {
  const grp = new THREE.Group(), w = WOOD3[woodKey] || WOOD3.birch, fm = frameMaterials(woodKey);
  const baseTop = 0.03, frameTop = 0.15;
  // solid base under everything, then four mitred frame strips (real joinery look), a felt well between them
  const baseM = new THREE.Mesh(G('b-base', () => slab(HALF * 2, HALF * 2, 0.5, 0.34, 0.1, { seg: 4, per: 7 })), fm);
  baseM.position.y = baseTop - 0.5; baseM.castShadow = baseM.receiveShadow = true; grp.add(baseM);
  const fw = FRAME_W, fh = frameTop - baseTop;
  const strip = (len, x, z, rotY) => {
    const m = new THREE.Mesh(G(`b-strip${len}`, () => slab(len, fw, fh + 0.02, 0.08, 0.05, { seg: 3, per: 3 })), fm);
    m.position.set(x, baseTop - 0.02, z); m.rotation.y = rotY; m.castShadow = m.receiveShadow = true; grp.add(m);
  };
  strip(HALF * 2, 0, -(HALF - fw / 2), 0); strip(HALF * 2, 0, HALF - fw / 2, 0);
  strip(HALF * 2 - 2 * fw + 0.04, -(HALF - fw / 2), 0, Math.PI / 2); strip(HALF * 2 - 2 * fw + 0.04, HALF - fw / 2, 0, Math.PI / 2);
  // woven band inlaid in the frame
  const bandM = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), new THREE.MeshStandardMaterial({ map: tex(bandRingCanvas(1024), {}), transparent: true, roughness: 0.55, depthWrite: false }));
  bandM.rotation.x = -Math.PI / 2; bandM.position.y = frameTop + 0.004; bandM.receiveShadow = true; grp.add(bandM);
  const wellW = 7.0;
  const felt = new THREE.Mesh(new THREE.PlaneGeometry(wellW, wellW), mat('felt|' + woodKey, () => std('#ffffff', { map: tex(feltCanvas(512, w.felt)), roughness: 0.96 })));
  felt.rotation.x = -Math.PI / 2; felt.position.y = baseTop + 0.002; felt.receiveShadow = true; grp.add(felt);
  const wellY = baseTop;
  // tiles
  const tileGeo = G('tile', () => slab(0.9, 0.9, TILE_TOP - wellY, 0.13, 0.06, { seg: 3, bottom: false }));
  const place = (i, material) => { const m = new THREE.Mesh(tileGeo, material); m.position.set(cellX(i), wellY, cellZ(i)); m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
  ring.forEach((i, k) => place(i, tileMaterial(woodKey, k % 2 === 1)));
  cross.forEach((i) => place(i, tileMaterial(woodKey, true)));
  place(centre, tileMaterial(woodKey, false));
  camps.forEach((i, p) => { place(i, tileMaterial(woodKey, false, SIDES[p].main)); });
  // inlays: brass diamonds on the four gates, an enamel eight-point star in the centre, ivory tent triangles on the camps
  const inlayY = TILE_TOP + 0.01;
  const diamond = G('inl-diamond', () => slab(0.34, 0.34, 0.03, 0.02, 0.01, { seg: 2, bottom: false }));
  for (const i of gates) { const m = new THREE.Mesh(diamond, M.gold()); m.position.set(cellX(i), TILE_TOP - 0.005, cellZ(i)); m.rotation.y = Math.PI / 4; m.castShadow = true; grp.add(m); }
  const starG = G('inl-star', () => flatPoly(starPoints(8, 0.4, 0.17, Math.PI / 8), 0));
  const star = new THREE.Mesh(starG, mat('enamel', () => phys('#b3281b', { roughness: 0.25, clearcoat: 1, side: THREE.DoubleSide }))); star.position.set(cellX(centre), inlayY, cellZ(centre)); star.receiveShadow = true; grp.add(star);
  const starRing = new THREE.Mesh(G('inl-ring', () => lathe([[0.405, 0], [0.43, 0], [0.43, 0.02], [0.405, 0.02]], 40)), M.gold());
  starRing.position.set(cellX(centre), TILE_TOP - 0.005, cellZ(centre)); grp.add(starRing);
  const tri = G('inl-tri', () => flatPoly([[0, -0.3], [0.28, 0.24], [-0.28, 0.24]], 0));
  camps.forEach((i, p) => {
    const m = new THREE.Mesh(tri, mat('tent' + p, () => phys('#fbf1d8', { roughness: 0.45, clearcoat: 0.5, side: THREE.DoubleSide })));
    m.position.set(cellX(i), inlayY, cellZ(i)); grp.add(m);
    const edge = new THREE.Mesh(G('inl-triring', () => lathe([[0.37, 0], [0.4, 0], [0.4, 0.02], [0.37, 0.02]], 4)), M.lacq(SIDES[p].main));
    void edge;
  });
  grp.userData.wellY = wellY;
  return grp;
}

// ---------------------------------------------------------------- environment
export function buildEnvironment(THREEq = THREE) {
  const grp = new THREE.Group(), T = THREEq;
  // snow field: a ring mesh whose vertex alpha fades to nothing at the far edge, so the screen-space sky shows through
  const snowT = tex(snowCanvas(512), { repeat: [10, 10] });
  const rg = new T.RingGeometry(0.01, 60, 56, 18);
  { const p = rg.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getY(i)), t = Math.min(1, Math.max(0, (r - 8) / 15)), al = 1 - t * t * (3 - 2 * t);
      cols.push(1, 1, 1, al);
    }
    rg.setAttribute('color', new T.Float32BufferAttribute(cols, 4)); }
  const ground = new T.Mesh(rg, new T.MeshStandardMaterial({ map: snowT, color: '#5b78a8', roughness: 0.9, metalness: 0, vertexColors: true, transparent: true, depthWrite: true }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.55; ground.receiveShadow = true; grp.add(ground);
  // woven rug under the board
  const rug = new T.Mesh(G('rug', () => slab(11.4, 11.4, 0.1, 0.5, 0.04, { seg: 2 })), new T.MeshStandardMaterial({ map: tex(rugCanvas(1024)), roughness: 0.95 }));
  rug.position.y = -0.46; rug.receiveShadow = true; rug.castShadow = true; grp.add(rug);
  // spruce trees: behind and beside the rug only (never between the camera and the board)
  const treeGeo = G('tree', () => merge([
    { geo: lathe([[0.001, 0.0], [1.0, 0.0], [0.5, 1.1], [0.8, 1.1], [0.35, 2.1], [0.6, 2.1], [0.001, 3.2]], 10), m: M4(0, 0.5, 0) },
    { geo: lathe([[0.0001, 0], [0.16, 0], [0.16, 0.6], [0.0001, 0.6]], 6), m: M4(0, 0, 0) },
  ]));
  const NT = 46;
  const trees = new T.InstancedMesh(treeGeo, new T.MeshStandardMaterial({ color: '#173f35', roughness: 0.9, flatShading: true }), NT);
  { const mm = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3();
    for (let i = 0; i < NT; i++) {
      const a = Math.PI * (1.05 + (i / NT) * 0.9) + ((i * 0.37) % 0.2), ring = i % 3, r = 17 + ring * 6 + ((i * 7.31) % 4), sc = 0.9 + ((i * 3.7) % 1.2) + ring * 0.3;
      p.set(Math.cos(a) * r * 1.3, -0.55, Math.sin(a) * r + 2); s.set(sc, sc * (1 + (i % 4) * 0.1), sc); mm.compose(p, q, s); trees.setMatrixAt(i, mm);
    } }
  trees.castShadow = false; grp.add(trees);
  // falling snow
  const flakes = new T.InstancedMesh(new T.SphereGeometry(0.045, 5, 4), new T.MeshBasicMaterial({ color: '#f4f9ff', transparent: true, opacity: 0.85, fog: false }), 140);
  const fl = []; for (let i = 0; i < 140; i++) fl.push({ x: ((i * 7.13) % 18) - 9, y: (i * 3.71) % 11, z: ((i * 5.17) % 16) - 9, s: 0.5 + ((i * 1.7) % 1), ph: i });
  const _m = new T.Matrix4();
  const updateSnow = (t, calm) => {
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i], y = calm ? f.y : ((f.y - t * (0.45 + f.s * 0.35)) % 11 + 11) % 11;
      _m.makeTranslation(f.x + (calm ? 0 : Math.sin(t * 0.6 + f.ph) * 0.4), y + 0.1, f.z); flakes.setMatrixAt(i, _m);
    }
    flakes.instanceMatrix.needsUpdate = true;
  };
  updateSnow(0, false);
  grp.add(flakes);
  return { group: grp, updateSnow, snowT };
}

// Screen-space night sky (virtual units, y up like the HUD): gradient, stars, animated aurora ribbons, two mountain ridges.
export function buildBackdrop() {
  const sc = new THREE.Scene();
  const mk = (geo, o) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false, ...o })); m.frustumCulled = false; sc.add(m); return m; };
  // gradient quad: 4 stacked bands (positions refreshed per size)
  const bandCols = [[0.012, 0.025, 0.07], [0.03, 0.09, 0.2], [0.07, 0.24, 0.34], [0.15, 0.42, 0.44], [0.09, 0.2, 0.3]];
  const gp = new Float32Array(bandCols.length * 2 * 3), gc = new Float32Array(bandCols.length * 2 * 3), gi = [];
  bandCols.forEach((c, i) => { for (let k = 0; k < 2; k++) gc.set(c, (i * 2 + k) * 3); });
  for (let i = 0; i < bandCols.length - 1; i++) { const a = i * 2; gi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setAttribute('color', new THREE.BufferAttribute(gc, 3)); gg.setIndex(gi);
  const sky = mk(gg, {}); sky.renderOrder = 0;
  // stars
  const NS = 110, stars = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 5, 4), new THREE.MeshBasicMaterial({ color: '#e6f0ff', depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 }), NS);
  stars.frustumCulled = false; stars.renderOrder = 1; sc.add(stars);
  // aurora ribbons
  const ribbons = [], NR = 3, SEG = 40;
  for (let r = 0; r < NR; r++) {
    const pos = new Float32Array((SEG + 1) * 2 * 3), col = new Float32Array((SEG + 1) * 2 * 3), idx = [];
    for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    const m = mk(g, { transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); m.renderOrder = 2;
    ribbons.push({ g, col: [[0.25, 1.0, 0.62], [0.35, 0.7, 1.0], [0.75, 0.42, 1.0]][r], ph: r * 2.1, y: [0.2, 0.16, 0.12][r], h: [0.3, 0.26, 0.22][r] });
  }
  // mountains
  const ridges = [];
  for (let r = 0; r < 2; r++) {
    const N = 36, pos = new Float32Array((N + 1) * 2 * 3), col = new Float32Array((N + 1) * 2 * 3), idx = [];
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    const m = mk(g, {}); m.renderOrder = 3 + r; ridges.push({ g, N, r });
  }
  let sized = '';
  function layout(W, H) {
    const k = `${W}x${H}`; if (k === sized) return; sized = k;
    // bands: top (y=0) .. bottom, in y-up coordinates
    const ys = [0, 0.3, 0.52, 0.66, 1.0];
    ys.forEach((f, i) => { const y = -f * H; gp.set([0, y, -900, W, y, -900], i * 6); });
    gg.attributes.position.needsUpdate = true;
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (let i = 0; i < NS; i++) {
      const x = ((i * 0.6180339 * 7.31) % 1) * W, y = -(0.02 + ((i * 0.4142 * 3.9) % 1) * 0.52) * H, sz = 0.8 + ((i * 1.7) % 1) * 1.6;
      p.set(x, y, -800); s.set(sz, sz, sz); m.compose(p, q, s); stars.setMatrixAt(i, m);
    }
    stars.instanceMatrix.needsUpdate = true;
    for (const rd of ridges) {
      const pa = rd.g.attributes.position.array, ca = rd.g.attributes.color.array, base = [0.57, 0.62][rd.r], amp = [0.07, 0.045][rd.r];
      for (let i = 0; i <= rd.N; i++) {
        const u = i / rd.N, x = u * W, n = Math.abs(Math.sin(u * (9 + rd.r * 5) + rd.r * 1.7) * Math.cos(u * 4.3 + rd.r)) * 0.75 + 0.25 * Math.abs(Math.sin(u * 31 + rd.r * 3));
        const yt = -(base - n * amp) * H;
        pa.set([x, yt, -700 + rd.r, x, -H * 1.05, -700 + rd.r], i * 6);
        const top = rd.r === 0 ? [0.1, 0.2, 0.34] : [0.04, 0.09, 0.17], bot = rd.r === 0 ? [0.04, 0.09, 0.18] : [0.02, 0.05, 0.1];
        ca.set(top, i * 6); ca.set(bot, i * 6 + 3);
      }
      rd.g.attributes.position.needsUpdate = true; rd.g.attributes.color.needsUpdate = true;
    }
  }
  function update(t, W, H, calm) {
    layout(W, H);
    for (const r of ribbons) {
      const pa = r.g.attributes.position.array, ca = r.g.attributes.color.array, n = pa.length / 6 - 1, tt = calm ? 0 : t;
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = u * W, y0 = -(r.y + 0.04 * Math.sin(u * 6 + tt * 0.25 + r.ph) + 0.015 * Math.sin(u * 15 + tt * 0.5)) * H;
        const hh = r.h * H * (0.55 + 0.45 * Math.sin(u * 4.5 + tt * 0.3 + r.ph * 2));
        const e = Math.sin(u * Math.PI), k = 0.62 * e * (0.7 + 0.3 * Math.sin(u * 23 + tt * 0.7));
        pa.set([x, y0, -500, x, y0 - hh, -500], i * 6);
        ca[i * 6] = r.col[0] * 0.0; ca[i * 6 + 1] = r.col[1] * 0.0; ca[i * 6 + 2] = r.col[2] * 0.0;       // lower edge fades to nothing
        ca[i * 6 + 3] = 0; ca[i * 6 + 4] = 0; ca[i * 6 + 5] = 0;
        // top edge bright, bottom edge dark: swap so the bright edge is the top of the curtain
        ca[i * 6] = r.col[0] * k; ca[i * 6 + 1] = r.col[1] * k; ca[i * 6 + 2] = r.col[2] * k;
      }
      r.g.attributes.position.needsUpdate = true; r.g.attributes.color.needsUpdate = true;
    }
  }
  return { scene: sc, update };
}

export { blobCanvas };
