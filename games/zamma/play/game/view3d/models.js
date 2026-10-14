// Zamma 3D models: the carved sand board, lathed stones with brass inlay, the Sultan, dune environment. Pure construction, no state.
import * as THREE from '../vendor3d/three.js';
import { board3d as B } from '../vendor3d/index.js';
import { SURFACES } from '../src/art.js';
import { sandCanvases, bandCanvas, groundCanvases, tex } from './mats.js';

export const FT = 0.42, ST = 0.2, PL = 0.07;        // frame top, sand top, plinth height (world units, one cell = 1)
export const FRAME_W = 0.45;
const cache = new Map();
const memo = (k, fn) => { let v = cache.get(k); if (!v) { v = fn(); cache.set(k, v); } return v; };

// ------------------------------------------------------------------ board
export function boardSize(n) { return n + 1.1; }
export function buildBoard(surface, n, alq) {
  const pal = SURFACES[surface] || SURFACES.sand, S = boardSize(n), g = new THREE.Group();
  const frameMat = B.material('clay', { color: pal.frame[2], color2: pal.frame[1], repeat: [2, 2], seed: 12, roughness: 0.88 });
  const plinthMat = B.material('clay', { color: pal.edge[1], color2: pal.edge[0], repeat: [2, 2], seed: 21, roughness: 0.92 });
  const add = (geo, mat, x, y, z, cast = true, recv = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; g.add(m); return m; };
  add(B.slab(S + 0.16, S + 0.16, PL, 0.12, 0.035), plinthMat, 0, 0, 0);
  const t = FT - PL, hw = FRAME_W, inner = n + 0.2;
  const bar = (w, d, x, z) => add(B.slab(w, d, t, 0.05, 0.05), frameMat, x, PL, z);
  bar(S, hw, 0, -(inner / 2 + hw / 2)); bar(S, hw, 0, inner / 2 + hw / 2);
  bar(hw, inner, -(inner / 2 + hw / 2), 0); bar(hw, inner, inner / 2 + hw / 2, 0);
  // the playing surface: sand with scratched lines (colour + furrow bump)
  const sc = sandCanvases(pal, n, alq, 3);
  const sand = new THREE.MeshStandardMaterial({ map: tex(sc.map, { flipY: false }), bumpMap: tex(sc.bump, { srgb: false, flipY: false }), bumpScale: 2.2, roughness: 0.96, metalness: 0, color: 0xd9ccb8 });
  sand.envMapIntensity = 0.5;
  add(B.slab(inner, inner, ST - PL, 0.02, 0.012), sand, 0, PL, 0, false, true);
  // carved band on the frame top
  const band = new THREE.MeshStandardMaterial({ map: tex(bandCanvas(pal, n), {}), transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const bp = new THREE.Mesh(new THREE.PlaneGeometry(S, S), band); bp.rotation.x = -Math.PI / 2; bp.position.y = FT + 0.004; bp.receiveShadow = true; g.add(bp);
  g.userData = { S, n, ST, FT };
  return g;
}

// ------------------------------------------------------------------ stones
const R = 0.4, H = 0.2;
const STONES = {
  stone: { 1: { color: '#2b2824', color2: '#58534b', roughness: 0.46, seed: 4 }, 2: { color: '#d8c79b', color2: '#f4ead0', roughness: 0.55, seed: 9 } },
  glaze: { 1: { color: '#2a4aa8', color2: '#4a6cd0', lacquer: true }, 2: { color: '#dc8a3c', color2: '#f2b46a', lacquer: true } },
};
const bodyMat = (style, side) => memo(`b|${style}|${side}`, () => {
  const d = (STONES[style] || STONES.stone)[side];
  return d.lacquer ? B.material('lacquer', { color: d.color, roughness: 0.2 }) : B.material('stone', d);
});
const brassMat = () => memo('brass', () => B.material('brass', { roughness: 0.28, envIntensity: 2.6 }));
const manProfile = () => memo('mp', () => {
  const r = R, h = H;
  return [[0, 0], [0.9 * r, 0], [r, 0.035], [r, 0.6 * h], [0.94 * r, 0.86 * h], [0.84 * r, h], [0.74 * r, h], [0.72 * r, 0.9 * h], [0.64 * r, 0.9 * h], [0.62 * r, h], [0.5 * r, 1.04 * h], [0.25 * r, 1.08 * h], [0, 1.09 * h]];
});
const tierProfile = () => memo('tp', () => {
  const r = R * 0.64, h = 0.17;
  return [[0, 0], [r * 1.02, 0], [r * 1.02, 0.06], [r, 0.2 * h], [r, 0.75 * h], [0.9 * r, h], [0.5 * r, 1.12 * h], [0, 1.16 * h]];
});
// a man: one lathed disc with a V-groove and a brass inlay ring (the "incised ring" of the 2D art)
export function makeStone(side, style, king) {
  const grp = new THREE.Group(), body = bodyMat(style, side), brass = brassMat();
  grp.add(B.piece(manProfile(), body, 48));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.68, 0.014, 8, 48), brass); ring.rotation.x = Math.PI / 2; ring.position.y = H * 0.915; ring.castShadow = true; grp.add(ring);
  if (!king) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), brass); dot.scale.y = 0.45; dot.position.y = H * 1.08; grp.add(dot);
    grp.userData.top = H * 1.1;
  } else {
    const up = B.piece(tierProfile(), body, 40); up.position.y = H * 1.04; grp.add(up);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.655, R * 0.655, 0.045, 36), brass); band.position.y = H * 1.04 + 0.1; band.castShadow = true; grp.add(band);
    const topY = H * 1.04 + 0.17 * 1.16;
    const star = new THREE.Mesh(B.inlay(B.starPoints(8, R * 0.46, R * 0.2), 0.03), brass); star.position.y = topY - 0.012; star.castShadow = true; grp.add(star);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 10), brass); fin.position.y = topY + 0.045; fin.castShadow = true; grp.add(fin);
    const crownRing = new THREE.Mesh(new THREE.TorusGeometry(R * 0.78, 0.016, 8, 48), brass); crownRing.rotation.x = Math.PI / 2; crownRing.position.y = H * 0.5; grp.add(crownRing);
    grp.userData.top = topY + 0.1;
  }
  return grp;
}

// ------------------------------------------------------------------ the dusk desert
export function buildEnvironment() {
  const g = new THREE.Group();
  const gc = groundCanvases(512);
  const gm = new THREE.MeshStandardMaterial({ map: tex(gc.map, { repeat: [8, 8] }), bumpMap: tex(gc.bump, { srgb: false, repeat: [8, 8] }), bumpScale: 3.5, roughness: 0.97, metalness: 0, color: 0xa89a8c });
  const geo = new THREE.PlaneGeometry(44, 44, 132, 132); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, RG = 19;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    const k = Math.max(0, Math.min(1, (r - 8.5) / 9));
    const dune = Math.sin(x * 0.42 + z * 0.2) * 0.9 + Math.sin(x * 0.19 - z * 0.45 + 1.3) * 1.1 + 2.4;
    let y = -0.02 + k * k * dune * (z < 0 ? 1.5 : 0.8) + Math.sin(x * 2.1 + z * 1.7) * 0.012 * (1 - k);
    if (r > RG) y -= (r - RG) * 3.5;
    p.setY(i, y);
  }
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, gm); ground.receiveShadow = true; g.add(ground);
  // pebbles and a few brass-bright flecks scattered round the board
  const peb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 7, 5), new THREE.MeshStandardMaterial({ color: '#8a6b4a', roughness: 0.9 }), 46);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  let s = 31; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, r = 6.2 + rnd() * 9, k = 0.5 + rnd() * 1.4;
    pos.set(Math.cos(a) * r, 0.02, Math.sin(a) * r * 0.8); sc.set(k, k * 0.55, k * (0.7 + rnd() * 0.5)); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6);
    m.compose(pos, q, sc); peb.setMatrixAt(i, m);
  }
  peb.castShadow = true; peb.receiveShadow = true; g.add(peb);
  return { group: g, ground };
}
