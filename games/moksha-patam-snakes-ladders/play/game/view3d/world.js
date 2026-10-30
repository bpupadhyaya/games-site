// Everything the Snakes & Ladders 3D scene is made of, all procedural: a hand-painted cotton cloth with soft folds, carved bamboo
// ladders lashed with cord, glazed clay serpents, bell-shaped lacquer pawns with brass finials, teak dice with brass pips, a woven
// dice tray and a dark teak table. Units: 1 canonical board unit = 0.1 world unit, so the 668-unit board is 66.8 across.
import * as THREE from '../vendor3d/three.js';
import { material, roundedBox, lathe, pieceProfile, mergeGeos, slab } from '../vendor3d/board3d.js';
import { drawBoard, setArtRes, snakePath, SNAKE_PAL } from '../src/art.js';
import { BOARD_X, BOARD_Y, BOARD_SIZE, squareXY } from '../src/layout.js';

export const K = 0.1, BW = BOARD_SIZE * K, BCX = BOARD_X + BOARD_SIZE / 2, BCY = BOARD_Y + BOARD_SIZE / 2;
export const toW = (cx, cy) => ({ x: (cx - BCX) * K, z: (cy - BCY) * K });
export const hgt = (x, z) => 0.07 * Math.sin(x * 0.17 + z * 0.1 + 0.6) + 0.05 * Math.sin(z * 0.23 - x * 0.07 + 1.3) + 0.02 * Math.sin(x * 0.5 + z * 0.43);
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const sRGB = (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

export function clothTexture(size) {
  const c = cv(size), x = c.getContext('2d');
  x.fillStyle = '#e9d3a0'; x.fillRect(0, 0, size, size);
  x.save(); x.scale(size / BOARD_SIZE, size / BOARD_SIZE); x.translate(-BOARD_X, -BOARD_Y); setArtRes(x);
  drawBoard(x, { ladders: [], snakes: [], kind: 'empty' }); x.restore();
  return sRGB(new THREE.CanvasTexture(c));
}
function weaveBump(size = 256) {
  const c = cv(size), x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < size; i += 4) { x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(i, 0, 2, size); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, i, size, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14); return t;
}
export function buildCloth(texSize) {
  const g = new THREE.PlaneGeometry(BW, BW, 64, 64); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, hgt(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map: clothTexture(texSize), roughness: 1, metalness: 0, bumpMap: weaveBump(), bumpScale: 0.12 });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true;
  // the cloth has a little thickness: a darker edge slab under it
  const edge = new THREE.Mesh(roundedBox(BW + 0.5, 0.3, BW + 0.5, 0.12), new THREE.MeshStandardMaterial({ color: 0xc9ad78, roughness: 1 })); edge.position.y = -0.55; edge.receiveShadow = true;
  const grp = new THREE.Group(); grp.add(mesh, edge); return grp;
}
export function buildTable() {
  const m = material('darkWood', { repeat: [6, 6], size: 512 });
  const t = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), m); t.rotation.x = -Math.PI / 2; t.position.y = -0.72; t.receiveShadow = true; return t;
}

// ---- creatures -------------------------------------------------------------------------------------------------------------
const rng = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const c3 = (h) => new THREE.Color(h);
function serpent(pts, pal, seed) {
  const N = pts.length - 1, M = 12, pos = [], nor = [], col = [], idx = [];
  const P = pts.map((q) => { const w = toW(q.x, q.y); return new THREE.Vector3(w.x, 0, w.z); });
  const rAt = (t) => 0.32 + 0.82 * Math.pow(1 - t, 0.72) + (t < 0.07 ? -0.18 * (1 - t / 0.07) : 0);
  const body = c3(pal.body), belly = c3(pal.belly), mark = c3(pal.mark).lerp(c3(pal.body), 0.45), tmp = new THREE.Color();
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = P[Math.max(0, i - 1)], b = P[Math.min(N, i + 1)];
    const tan = new THREE.Vector3().subVectors(b, a).setY(0).normalize(), nrm = new THREE.Vector3(-tan.z, 0, tan.x);
    const r = rAt(t), cy = hgt(P[i].x, P[i].z) + r * 0.85 + 0.16 * Math.sin(t * 25 + seed);
    const band = Math.floor(t * N / 2.4) % 3 === 1;
    for (let j = 0; j <= M; j++) {
      const ph = (j / M) * Math.PI * 2, cs = Math.cos(ph), sn = Math.sin(ph);
      pos.push(P[i].x + nrm.x * cs * r * 1.08, cy + sn * r * 0.9, P[i].z + nrm.z * cs * r * 1.08);
      nor.push(nrm.x * cs, sn, nrm.z * cs);
      tmp.copy(sn < -0.45 ? belly : sn > 0.35 && band ? mark : body); if (sn > 0.3 && !band) tmp.lerp(c3(pal.dark), 0.18);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.25 });
  const grp = new THREE.Group(), m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; grp.add(m);
  // head: a flattened glazed sphere facing away from the body, two glossy eyes and a tiny forked tongue
  const dir = new THREE.Vector3().subVectors(P[0], P[Math.min(N, 3)]).setY(0).normalize(), yaw = Math.atan2(dir.x, dir.z);
  const hh = new THREE.Group(); hh.position.set(P[0].x + dir.x * 0.5, hgt(P[0].x, P[0].z) + 0.95, P[0].z + dir.z * 0.5); hh.rotation.y = yaw;
  const hd = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat.clone()); hd.material.vertexColors = false; hd.material.color = body; hd.scale.set(1.22, 0.86, 1.55); hd.castShadow = true; hh.add(hd);
  const eyeM = new THREE.MeshPhysicalMaterial({ color: 0x0a0806, roughness: 0.1, clearcoat: 1 });
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), eyeM); e.position.set(sx * 0.62, 0.34, 0.78); hh.add(e); const hl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(sx * 0.62 + 0.05, 0.42, 0.9); hh.add(hl); }
  const tg = new THREE.Mesh(roundedBox(0.12, 0.05, 0.9, 0.02, 2), new THREE.MeshStandardMaterial({ color: 0xc2272d, roughness: 0.6 })); tg.position.set(0, -0.12, 1.9); hh.add(tg);
  grp.add(hh); return grp;
}
export function buildCreatures(board) {
  const grp = new THREE.Group();
  board.snakes.forEach((s, i) => { const a = squareXY(s.from), b = squareXY(s.to); grp.add(serpent(snakePath(a, b, s.from + s.to), SNAKE_PAL[(s.from + i) % SNAKE_PAL.length], s.from)); });
  // ladders: bamboo rails with rungs and cord lashings, as instanced meshes
  const rails = [], rungs = [], lashes = [];
  board.ladders.forEach((l) => {
    const a = toW(...Object.values(squareXY(l.from))), b = toW(...Object.values(squareXY(l.to)));
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, px = -uz, pz = ux, hw = 1.3;
    for (const sd of [-1, 1]) rails.push({ x: (a.x + b.x) / 2 + px * hw * sd, z: (a.z + b.z) / 2 + pz * hw * sd, len, ux, uz });
    const n = Math.max(3, Math.floor(len / 2.7));
    for (let k = 0; k <= n; k++) { const t = (k + 0.5) / (n + 1), x = a.x + dx * t, z = a.z + dz * t; rungs.push({ x, z, px, pz }); for (const sd of [-1, 1]) lashes.push({ x: x + px * hw * sd, z: z + pz * hw * sd, ux, uz }); }
  });
  const Y = new THREE.Vector3(0, 1, 0), M = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  const mk = (geo, mat, list, f) => { const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); list.forEach((o, i) => { f(o); M.compose(ps, q, sc); im.setMatrixAt(i, M); }); im.count = list.length; im.castShadow = im.receiveShadow = true; im.frustumCulled = false; grp.add(im); };
  const bam = new THREE.MeshStandardMaterial({ color: 0xd9b35f, roughness: 0.5 }), bam2 = new THREE.MeshStandardMaterial({ color: 0xc89a45, roughness: 0.55 }), cord = new THREE.MeshStandardMaterial({ color: 0x6e3f1e, roughness: 0.9 });
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  mk(cyl, bam, rails, (o) => { q.setFromUnitVectors(Y, new THREE.Vector3(o.ux, 0, o.uz)); sc.set(0.34, o.len, 0.34); ps.set(o.x, hgt(o.x, o.z) + 0.5, o.z); });
  mk(cyl, bam2, rungs, (o) => { q.setFromUnitVectors(Y, new THREE.Vector3(o.px, 0, o.pz)); sc.set(0.2, 2.7, 0.2); ps.set(o.x, hgt(o.x, o.z) + 0.62, o.z); });
  mk(cyl, cord, lashes, (o) => { q.setFromUnitVectors(Y, new THREE.Vector3(o.ux, 0, o.uz)); sc.set(0.45, 0.42, 0.45); ps.set(o.x, hgt(o.x, o.z) + 0.55, o.z); });
  return grp;
}
export function disposeGroup(g) { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }

// ---- pawns, dice, tray -------------------------------------------------------------------------------------------------------
export function makePawn(hex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(lathe(pieceProfile('bell', 2.05, 5.2), 36), new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 }));
  const brass = new THREE.MeshStandardMaterial({ color: 0xd6a94a, metalness: 1, roughness: 0.28 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.78, 18, 14), brass); ball.position.y = 5.75;
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.14, 8, 28), brass); band.rotation.x = Math.PI / 2; band.position.y = 0.7;
  for (const o of [body, ball, band]) { o.castShadow = true; o.receiveShadow = true; g.add(o); }
  g.userData.body = body; return g;
}
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
// +y 1, -y 6, +x 2, -x 5, +z 3, -z 4 (opposite faces sum to 7)
const FACES = [[1, [0, 1, 0]], [6, [0, -1, 0]], [2, [1, 0, 0]], [5, [-1, 0, 0]], [3, [0, 0, 1]], [4, [0, 0, -1]]];
export function makeDie() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(roundedBox(1, 1, 1, 0.13, 6), new THREE.MeshPhysicalMaterial({ color: 0xb23a22, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.2 }));
  body.castShadow = body.receiveShadow = true; g.add(body);
  const parts = [], base = new THREE.CylinderGeometry(0.085, 0.085, 0.03, 18), M = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  for (const [v, n] of FACES) {
    const nv = new THREE.Vector3(...n); q.setFromUnitVectors(Y, nv);
    const u = Math.abs(n[1]) ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), w = new THREE.Vector3().crossVectors(nv, u);
    for (const [a, b] of PIPS[v]) { const p = nv.clone().multiplyScalar(0.502).addScaledVector(u, a * 0.25).addScaledVector(w, b * 0.25); M.compose(p, q, new THREE.Vector3(1, 1, 1)); parts.push({ geo: base, m: M.clone() }); }
  }
  const pips = new THREE.Mesh(mergeGeos(parts), new THREE.MeshStandardMaterial({ color: 0xf0cf72, metalness: 1, roughness: 0.25 })); g.add(pips);
  return g;
}
// orientation that brings face `v` to the top
const UP = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [0, 0, Math.PI / 2], 5: [0, 0, -Math.PI / 2], 3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0] };
export const upQuat = (v) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...(UP[v] || UP[1])));

export function buildTray(w, d) {
  const g = new THREE.Group(), wood = material('darkWood', { repeat: [2, 1], size: 512 }), brass = material('brass', {});
  const t = 1.5, h = 1.2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w - t, d - t), new THREE.MeshStandardMaterial({ color: 0x2a3a78, roughness: 1, bumpMap: weaveBump(), bumpScale: 0.6 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.04; floor.receiveShadow = true; g.add(floor);
  for (const [sx, sz, ww, dd] of [[0, -1, w, t], [0, 1, w, t], [-1, 0, t, d - 2 * t], [1, 0, t, d - 2 * t]]) {
    const r = new THREE.Mesh(roundedBox(ww, h, dd, 0.25, 3), wood); r.position.set(sx * (w - t) / 2, h / 2 - 0.1, sz * (d - t) / 2); r.castShadow = r.receiveShadow = true; g.add(r);
    const b = new THREE.Mesh(roundedBox(sx ? 0.22 : ww - 0.4, 0.12, sz ? 0.22 : dd - 0.4, 0.04, 2), brass); b.position.set(r.position.x, h - 0.06, r.position.z); g.add(b);
  }
  return g;
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffe9c8, 0x2a1a10, 0.7); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b8, 1.15); sun.position.set(-34, 90, 42); sun.target.position.set(0, 0, 10); scene.add(sun, sun.target);
  sun.shadow.camera.left = -62; sun.shadow.camera.right = 62; sun.shadow.camera.top = 62; sun.shadow.camera.bottom = -62; sun.shadow.camera.near = 20; sun.shadow.camera.far = 220; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  const rim = new THREE.DirectionalLight(0xff9a55, 0.5); rim.position.set(60, 30, -50); scene.add(rim);
  return { hemi, sun, rim };
}
export function radialTex(rgb = '255,255,255', a = 1) {
  const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return sRGB(new THREE.CanvasTexture(c));
}
