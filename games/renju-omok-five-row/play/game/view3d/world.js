// The lit 3D world for Five in a Row: a table-top goban (kaya block on carved legs, raised lacquer grid lines, straight grain),
// slate and shell stones at real size, turned mulberry stone bowls, and a linen-covered table under a warm lamp.
// Units are centimetres. Presentation only: nothing here reads or changes the simulation.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { WOODS, STONES } from '../src/art.js';

export const SX = 2.2, SZ = 2.37;          // grid spacing: 22 mm across, 23.7 mm toward the player (a real goban looks square when seated)
export const MARGIN = 1.05;                // board margin in cells (room for the coordinates)
export const T = 6.2, LEG = 3.4;           // block thickness and leg height
export const TOP = T + LEG;                // y of the playing surface
export const STONE_R = 1.05, STONE_H = 0.92;   // 21-22 mm diameter, 9 mm thick biconvex stones
export const BEVEL = 0.32;
const TAU = Math.PI * 2;
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const texOf = (c, srgb = true, aniso = 8) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };

export const boardSize = (n) => ({ w: (n - 1) * SX + 2 * MARGIN * SX, d: (n - 1) * SZ + 2 * MARGIN * SZ });
export const cross = (n, idx) => ({ x: ((idx % n) - (n - 1) / 2) * SX, z: (((idx / n) | 0) - (n - 1) / 2) * SZ });

// ---------------------------------------------------------------- the board top: grain, raised lines, star points, coordinates
const starPoints = (n) => (n === 15 ? [[3, 3], [11, 3], [3, 11], [11, 11], [7, 7]] : n === 19 ? [3, 9, 15].flatMap((x) => [3, 9, 15].map((y) => [x, y])) : [[n >> 1, n >> 1]]);
function paintTop(n, wood, coords, px) {
  const W = WOODS[wood] ?? WOODS.kaya, { w, d } = boardSize(n), fw = w - 2 * BEVEL, fd = d - 2 * BEVEL;
  const pw = px, ph = Math.round(px * fd / fw), k = pw / fw;
  const map = cv(pw, ph), bump = cv(pw, ph), m = map.getContext('2d'), b = bump.getContext('2d');
  // straight grain (masame) running toward the player: paint board3d's grain rotated a quarter turn
  const g = B.woodCanvas(1024, W.lo, W.mid, wood.length * 7 + 3, { lines: 190, knots: 0 });
  for (const [ctx, src] of [[m, g.map], [b, g.bump]]) { ctx.save(); ctx.translate(pw / 2, ph / 2); ctx.rotate(Math.PI / 2); ctx.drawImage(src, -ph / 2, -pw / 2, ph, pw); ctx.restore(); }
  // a few long dark growth lines and a soft warm/cool tone shift across the block
  for (let i = 0; i < 26; i++) {
    const x0 = hash(i, 3) * pw, amp = pw * 0.004 * (0.3 + hash(i, 4)), a = 0.04 + hash(i, 5) * 0.08;
    m.strokeStyle = `rgba(${W.grain},${a})`; m.lineWidth = 1 + hash(i, 6) * 3; m.beginPath();
    for (let y = 0; y <= ph; y += 16) { const x = x0 + Math.sin(y * 0.004 + i) * amp; y ? m.lineTo(x, y) : m.moveTo(x, y); }
    m.stroke();
  }
  let gr = m.createLinearGradient(0, 0, pw, ph); gr.addColorStop(0, 'rgba(255,240,205,0.10)'); gr.addColorStop(1, 'rgba(60,30,5,0.12)'); m.fillStyle = gr; m.fillRect(0, 0, pw, ph);
  // grid: lines are lacquer laid with a blade edge, slightly raised (bump) and a touch glossy
  const ox = (fw - (n - 1) * SX) / 2, oz = (fd - (n - 1) * SZ) / 2, X = (i) => (ox + i * SX) * k, Z = (j) => (oz + j * SZ) * k;
  const lw = Math.max(1.6, 0.085 * k), edge = lw * 1.9;
  for (const [ctx, col, extra] of [[m, W.line, 0], [b, '#ffffff', lw * 0.5]]) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'square';
    ctx.lineWidth = lw + extra; ctx.beginPath();
    for (let i = 0; i < n; i++) { ctx.moveTo(X(i), Z(0)); ctx.lineTo(X(i), Z(n - 1)); ctx.moveTo(X(0), Z(i)); ctx.lineTo(X(n - 1), Z(i)); }
    ctx.stroke(); ctx.lineWidth = edge + extra; ctx.strokeRect(X(0), Z(0), X(n - 1) - X(0), Z(n - 1) - Z(0));
    ctx.fillStyle = col; for (const [sx, sz] of starPoints(n)) { ctx.beginPath(); ctx.ellipse(X(sx), Z(sz), 0.2 * k + extra, 0.2 * k * (SZ / SX) * 0.93 + extra, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  b.globalCompositeOperation = 'source-over';
  if (coords) {
    const letters = 'ABCDEFGHJKLMNOPQRST', fs = 0.62 * k, my = oz * k * 0.52, mx = ox * k * 0.5;
    m.font = `700 ${fs}px "Cormorant Garamond", Georgia, serif`; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillStyle = `rgba(${W.grain},0.72)`;
    for (let i = 0; i < n; i++) { m.fillText(letters[i], X(i), my); m.fillText(letters[i], X(i), ph - my); m.fillText(String(n - i), mx, Z(i)); m.fillText(String(n - i), pw - mx, Z(i)); }
  }
  return { map: texOf(map), bump: texOf(bump, false), fw, fd };
}

// ---------------------------------------------------------------- materials
export function makeMaterials(wood, stones) {
  const W = WOODS[wood] ?? WOODS.kaya, P = STONES[stones] ?? STONES.slate, jade = stones === 'jade';
  const side = B.material('wood', { color: W.lo, color2: W.mid, seed: 11 + wood.length, size: 512 });
  side.clearcoat = 0; side.roughness = 0.5;
  const sidePhys = new THREE.MeshPhysicalMaterial({ map: side.map, bumpMap: side.bumpMap, bumpScale: 0.6, roughness: 0.46, clearcoat: 0.35, clearcoatRoughness: 0.35 });
  const legs = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(W.bevel).multiplyScalar(1.15), roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  // stones: black slate is honed, not polished (a soft satin sheen); white shell carries faint parallel growth bands
  const black = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(jade ? P.b1 : '#16181c'), roughness: jade ? 0.24 : 0.36, metalness: 0, clearcoat: jade ? 0.9 : 0.35, clearcoatRoughness: jade ? 0.08 : 0.3, sheen: 0, envMapIntensity: 1.1 });
  if (jade) { black.transmission = 0; black.emissive = new THREE.Color(P.b2); black.emissiveIntensity = 0.25; }
  const shell = cv(256), sx = shell.getContext('2d');
  sx.fillStyle = P.w1; sx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { const y = i * 6.4 + hash(i, 1) * 4; sx.fillStyle = hash(i, 2) < 0.5 ? 'rgba(255,255,255,0.10)' : `rgba(170,155,125,${0.025 + hash(i, 3) * 0.035})`; sx.fillRect(0, y, 256, 1.5 + hash(i, 4) * 3); }
  const white = new THREE.MeshPhysicalMaterial({ map: texOf(shell), color: 0xffffff, roughness: 0.28, clearcoat: 0.75, clearcoatRoughness: 0.12, sheen: 0.4, sheenColor: new THREE.Color('#fff4dc'), envMapIntensity: 1.0 });
  const bowl = new THREE.MeshPhysicalMaterial({ ...(() => { const m = B.material('darkWood', { color: '#5a2f15', color2: '#8a5129', seed: 21 }); return { map: m.map, bumpMap: m.bumpMap }; })(), bumpScale: 0.4, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.18, side: THREE.DoubleSide });
  const cloth = B.material('cloth', { color: '#2f3d46', color2: '#4a5a64', repeat: [36, 36], size: 256 });
  cloth.roughness = 0.95;
  return { side: sidePhys, legs, black, white, bowl, cloth };
}

// ---------------------------------------------------------------- stone geometry: a biconvex lens with a rounded edge; planar UVs
export function stoneGeometry(r = STONE_R, h = STONE_H, seg = 40) {
  const prof = [], N = 14;
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI / 2; prof.push([r * Math.pow(Math.sin(a), 0.7), -(h / 2) * Math.pow(Math.cos(a), 1.35)]); }
  for (let i = N - 1; i >= 0; i--) { const a = (i / N) * Math.PI / 2; prof.push([r * Math.pow(Math.sin(a), 0.7), (h / 2) * Math.pow(Math.cos(a), 1.35)]); }
  prof[0][0] = 0.0001; prof[prof.length - 1][0] = 0.0001;
  const g = B.lathe(prof, seg), pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * r) + 0.5, pos.getZ(i) / (2 * r) + 0.5);
  uv.needsUpdate = true; g.translate(0, h / 2, 0);
  return g;
}

// ---------------------------------------------------------------- the goban
export function buildBoard(n, wood, coords, mats, px) {
  const grp = new THREE.Group(), { w, d } = boardSize(n);
  const body = new THREE.Mesh(B.roundedBox(w, T, d, BEVEL, 4), mats.side); body.position.y = LEG + T / 2; body.castShadow = true; body.receiveShadow = true;
  const top = paintTop(n, wood, coords, px);
  const topMat = new THREE.MeshPhysicalMaterial({ map: top.map, bumpMap: top.bump, bumpScale: 0.9, roughness: 0.4, clearcoat: 0.32, clearcoatRoughness: 0.28 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(top.fw, top.fd), topMat); face.rotation.x = -Math.PI / 2; face.position.y = TOP + 0.002; face.receiveShadow = true;
  // kuchinashi legs (gardenia-fruit shape), set in from the corners
  const lp = [[0.01, 0], [1.6, 0], [2.4, 0.5], [2.9, 1.3], [2.95, 1.9], [2.6, 2.6], [2.0, 3.0], [1.4, LEG], [0.01, LEG]];
  const legGeo = B.lathe(lp, 20);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.Mesh(legGeo, mats.legs); l.position.set(sx * w * 0.3, 0, sz * d * 0.3); l.castShadow = true; grp.add(l); }
  grp.add(body, face);
  grp.userData = { w, d, n, top };
  return grp;
}

// ---------------------------------------------------------------- stone bowl (goke) with a heap of stones
export function buildBowl(black, mats, stoneGeo, seed) {
  const grp = new THREE.Group();
  const prof = [[0.01, 0], [3.9, 0], [4.2, 0.25], [5.4, 1.3], [6.3, 3.0], [6.55, 4.5], [6.25, 5.7], [5.7, 6.35], [5.35, 6.4], [5.15, 6.2], [5.55, 5.3], [5.75, 4.2], [5.3, 2.6], [4.2, 1.5], [0.01, 1.15]];
  const bowl = new THREE.Mesh(B.lathe(prof, 48), mats.bowl); bowl.castShadow = true; bowl.receiveShadow = true; grp.add(bowl);
  const N = 30, heap = new THREE.InstancedMesh(stoneGeo, black ? mats.black : mats.white, N), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const a = hash(i, seed) * TAU, rr = Math.sqrt(hash(i, seed + 1)) * 4.1, y = 1.4 + (1 - (rr / 4.6) ** 2) * 3.4 + hash(i, seed + 2) * 0.5;
    p.set(Math.cos(a) * rr, y, Math.sin(a) * rr); e.set((hash(i, seed + 3) - 0.5) * 0.9, a, (hash(i, seed + 4) - 0.5) * 0.9); q.setFromEuler(e); m.compose(p, q, s); heap.setMatrixAt(i, m);
  }
  heap.castShadow = true; heap.receiveShadow = true; grp.add(heap);
  return grp;
}

// ---------------------------------------------------------------- soft radial textures
export function radialTex(rgb, a, ring = 0, size = 128) {
  const c = cv(size), x = c.getContext('2d'), h = size / 2, g = x.createRadialGradient(h, h, 0, h, h, h);
  if (!ring) { g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.55, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  else { g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(ring - 0.2, `rgba(${rgb},0)`); g.addColorStop(ring, `rgba(${rgb},${a})`); g.addColorStop(Math.min(0.99, ring + 0.14), `rgba(${rgb},${a * 0.3})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  x.fillStyle = g; x.fillRect(0, 0, size, size); return texOf(c);
}
