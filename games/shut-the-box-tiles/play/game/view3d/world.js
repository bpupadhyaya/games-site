// The 3D world for Shut the Box, all procedural (no bitmaps). Units are centimetres, y is up. Three separate pieces, each drawn by its own
// camera so every one can be fitted to the rectangle the 2D layout gives it: (1) the TAVERN TABLE (aged plank top, pewter tankard, candle),
// (2) the BOX (a chunky carved cabinet lined with oxblood velvet, bone / jade / amber tiles that turn over like coins and land face-down
// as dark lacquer with the number engraved in gold), (3) the DICE TRAY (walnut rim, velvet floor, two rounded cubes with real pips).
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

export const TW = 4.4, TH = 5.7;                  // one tile cell (cm)
export const FLOOR = 1.0, WALL = 2.3, RIM = 1.5;  // lining height, wall height, wall thickness
export const TILE_Y = FLOOR + 0.56;               // top surface of a resting tile (tile is 0.52 thick)
export const DIE = 1;                             // unit cube; scaled by the presenter

const BOXES = { oak: ['#b27a40', '#8a5628'], walnut: ['#8a5a3c', '#5f3a24'], ebony: ['#4a4540', '#2e2a27'] };
const TILES = { bone: ['#fbf3dc', '#e6d6a8', '#2a180c'], jade: ['#d9f0dc', '#9fcaa8', '#0f2a1b'], amber: ['#ffe9b3', '#f0b85a', '#3a1d05'] };
const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };

// ---------------------------------------------------------------- textures
const numCache = new Map();
export function numberTex(num, style, back) {          // face numeral (ink on a clear ground) or engraved gold on the lacquer back
  const k = `${num}|${style}|${back ? 1 : 0}`; let t = numCache.get(k); if (t) return t;
  const c = cvs(160, 200), x = c.getContext('2d'), ink = (TILES[style] || TILES.bone)[2];
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${num > 9 ? 104 : 130}px Cinzel, Georgia, serif`;
  if (back) { x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillText(String(num), 81, 104); x.fillStyle = 'rgba(233,189,90,0.62)'; x.fillText(String(num), 80, 102); }
  else { x.fillStyle = 'rgba(255,255,255,0.75)'; x.fillText(String(num), 81, 104); x.fillStyle = ink; x.fillText(String(num), 80, 102); }
  t = tex(c); numCache.set(k, t); return t;
}
export function clearNumberTex() { for (const t of numCache.values()) t.dispose(); numCache.clear(); }
let glowT = null;
function glowTex() {
  if (glowT) return glowT;
  const c = cvs(128, 160), x = c.getContext('2d');
  x.strokeStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 14; x.lineWidth = 7; x.beginPath(); x.roundRect(14, 14, 100, 132, 16); x.stroke(); x.stroke();
  glowT = tex(c); return glowT;
}
let blobT = null;
function blobTex() {
  if (blobT) return blobT;
  const c = cvs(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.55, 'rgba(0,0,0,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  blobT = tex(c); return blobT;
}
const blob = (w, d, op = 0.55) => { const m = mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, opacity: op, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 1; return m; };

const pipsCache = new Map();
function dieFace(v, red) {
  const k = `${v}${red ? 'r' : 'i'}`; let t = pipsCache.get(k); if (t) return t;
  const c = cvs(128, 128), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 128, 128);
  if (red) { g.addColorStop(0, '#e24a3a'); g.addColorStop(1, '#a3161a'); } else { g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#e6d8b4'); }
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
  for (const [px, py] of P) { const cx = 64 + px * 31, cy = 64 + py * 31, rg = x.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 13); rg.addColorStop(0, red ? '#fff' : '#6a4a30'); rg.addColorStop(1, red ? '#f3e4d6' : '#1c0f06'); x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, 13, 0, 6.2832); x.fill(); }
  t = tex(c); pipsCache.set(k, t); return t;
}
// BoxGeometry face order +x -x +y -y +z -z; opposite faces sum to 7. FACE_N[v] = outward normal of the face that shows v.
export const FACE_V = [3, 4, 1, 6, 2, 5];
export const FACE_N = { 3: [1, 0, 0], 4: [-1, 0, 0], 1: [0, 1, 0], 6: [0, -1, 0], 2: [0, 0, 1], 5: [0, 0, -1] };
export function buildDie(red, size) {
  const mats = FACE_V.map((v) => { const m = new THREE.MeshPhysicalMaterial({ map: dieFace(v, red), roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.12 }); m.envMapIntensity = 0.9; return m; });
  const g = new THREE.Group(), cube = mesh(B.roundedBox(size, size, size, size * 0.17, 5), mats); g.add(cube);
  const sh = blob(size * 2.6, size * 2.6, 0.55); sh.name = 'shadow'; g.add(sh); g.userData.cube = cube; g.userData.shadow = sh; g.userData.size = size;
  return g;
}
export function disposeDieMaps() { for (const t of pipsCache.values()) t.dispose(); pipsCache.clear(); }

// ---------------------------------------------------------------- the box
export function buildBox(n, cols, rows, boxKey, tileKey, texSize = 512) {
  const root = new THREE.Group(), parts = [], bk = BOXES[boxKey] || BOXES.oak, tk = TILES[tileKey] || TILES.bone;
  const Wi = cols * TW + 0.9, Di = rows * TH + 0.9, Wo = Wi + RIM * 2, Do = Di + RIM * 2;
  const wood = B.material('wood', { color: bk[0], color2: bk[1], size: texSize, seed: 11, repeat: [2, 2] }); wood.roughness = 0.5; parts.push(wood);
  const velvet = B.material('cloth', { color: '#5c101f', color2: '#7d1c30', size: Math.min(256, texSize), repeat: [Math.max(2, cols * 2), Math.max(2, rows * 2)], roughness: 1 }); parts.push(velvet);
  const brass = B.material('brass'); parts.push(brass);
  // shadow on the table
  const sb = blob(Wo * 1.5, Do * 1.5, 0.7); sb.position.set(0.5, -0.02, 0.9); root.add(sb);
  // frame: four carved bars over a solid floor, brass corner caps, a thin brass inlay line round the opening
  const bar = (w, d, x, z) => root.add(mesh(B.roundedBox(w, WALL, d, 0.5, 4), wood, x, WALL / 2, z));
  bar(Wo, RIM, 0, -Do / 2 + RIM / 2); bar(Wo, RIM, 0, Do / 2 - RIM / 2); bar(RIM, Di, -Wo / 2 + RIM / 2, 0); bar(RIM, Di, Wo / 2 - RIM / 2, 0);
  root.add(mesh(B.roundedBox(Wo, FLOOR + 0.2, Do, 0.5, 4), wood, 0, (FLOOR + 0.2) / 2 - 0.2 + 0.2, 0));
  const lining = mesh(new THREE.PlaneGeometry(Wi, Di), velvet, 0, FLOOR + 0.01, 0); lining.rotation.x = -Math.PI / 2; root.add(lining);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) root.add(mesh(B.roundedBox(1.5, 0.35, 1.5, 0.3, 3), brass, sx * (Wo / 2 - 0.85), WALL + 0.08, sz * (Do / 2 - 0.85)));
  for (const [w, d, x, z] of [[Wi + 0.2, 0.18, 0, -Di / 2 - 0.1], [Wi + 0.2, 0.18, 0, Di / 2 + 0.1], [0.18, Di + 0.2, -Wi / 2 - 0.1, 0], [0.18, Di + 0.2, Wi / 2 + 0.1, 0]]) root.add(mesh(new THREE.BoxGeometry(w, 0.12, d), brass, x, WALL + 0.01, z));
  // tiles
  const top = B.slab(TW - 0.4, TH - 0.4, 0.26, 0.55, 0.1), bot = B.slab(TW - 0.4, TH - 0.4, 0.26, 0.55, 0.1);
  const topBase = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(tk[1]).lerp(new THREE.Color(tk[0]), 0.55), roughness: 0.36, clearcoat: 0.8, clearcoatRoughness: 0.18 }); parts.push(topBase);
  const backM = new THREE.MeshPhysicalMaterial({ color: 0x2a0c10, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }); parts.push(backM);
  const decalG = new THREE.PlaneGeometry(TW - 1.1, (TW - 1.1) * 1.25), glowG = new THREE.PlaneGeometry(TW + 0.4, TH + 0.4), pinG = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 14);
  const tiles = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols, inRow = r === rows - 1 ? n - r * cols : cols;
    const cx = (c - (inRow - 1) / 2) * TW, cz = (r - (rows - 1) / 2) * TH;
    const piv = new THREE.Group(); piv.position.set(cx, FLOOR + 0.3, cz);
    const tm = topBase.clone();
    const tp = mesh(top, tm, 0, 0, 0), bt = mesh(bot, backM, 0, 0, 0); bt.rotation.x = Math.PI; bt.position.y = 0;   // lower half: the slab mirrored so its bevel faces down
    const nm = new THREE.MeshStandardMaterial({ map: numberTex(i + 1, tileKey, false), transparent: true, roughness: 0.55, depthWrite: false, polygonOffsetFactor: -2, polygonOffset: true });
    const nu = mesh(decalG, nm, 0, 0.262, 0.15); nu.rotation.x = -Math.PI / 2;
    const bm = new THREE.MeshStandardMaterial({ map: numberTex(i + 1, tileKey, true), transparent: true, roughness: 0.4, metalness: 0.2, depthWrite: false, polygonOffsetFactor: -2, polygonOffset: true });
    const nb = mesh(decalG, bm, 0, -0.262, 0.15); nb.rotation.x = Math.PI / 2;
    const pin = mesh(pinG, brass, 0, 0.3, -TH * 0.36), pin2 = mesh(pinG, brass, 0, -0.3, -TH * 0.36);
    piv.add(tp, bt, nu, nb, pin, pin2);
    const gm = new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
    const gl = mesh(glowG, gm, cx, FLOOR + 0.62, cz); gl.rotation.x = -Math.PI / 2; gl.renderOrder = 3;
    const ts = blob(TW * 1.5, TH * 1.4, 0.5); ts.position.set(cx + 0.25, FLOOR + 0.03, cz + 0.4);
    root.add(piv, gl, ts);
    tiles.push({ base: tm.color.clone(), piv, tm, gm, gl, ts, cx, cz, num: i + 1, nm, bm });
  }
  // the cell centres of the standing slots, used by the presenter to project tap rectangles
  root.userData = { Wo, Do, Wi, Di, cols, rows, n, tiles, parts, dispose() { root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); tiles.forEach((t) => { t.tm.dispose(); t.nm.dispose(); t.bm.dispose(); t.gm.dispose(); }); } };
  return root;
}

// ---------------------------------------------------------------- the dice tray
export function buildTray(W, D, texSize = 512) {
  const root = new THREE.Group(), wood = B.material('darkWood', { size: texSize, seed: 21, repeat: [2, 1] }), brass = B.material('brass');
  const velvet = B.material('cloth', { color: '#6a1424', color2: '#8a2236', size: 256, repeat: [Math.max(2, Math.round(W / 3)), Math.max(2, Math.round(D / 3))], roughness: 1 });
  const sb = blob(W * 1.4, D * 1.7, 0.7); sb.position.set(0.4, -0.02, 0.8); root.add(sb);
  const T = 1.1, H = 1.5;
  root.add(mesh(B.roundedBox(W + T * 2, 0.9, D + T * 2, 0.4, 4), wood, 0, 0.35, 0));
  for (const [w, d, x, z] of [[W + T * 2, T, 0, -D / 2 - T / 2], [W + T * 2, T, 0, D / 2 + T / 2], [T, D, -W / 2 - T / 2, 0], [T, D, W / 2 + T / 2, 0]]) root.add(mesh(B.roundedBox(w, H, d, 0.4, 4), wood, x, H / 2, z));
  const floor = mesh(new THREE.PlaneGeometry(W, D), velvet, 0, 0.82, 0); floor.rotation.x = -Math.PI / 2; root.add(floor);
  for (const [w, d, x, z] of [[W + 0.1, 0.12, 0, -D / 2], [W + 0.1, 0.12, 0, D / 2], [0.12, D, -W / 2, 0], [0.12, D, W / 2, 0]]) root.add(mesh(new THREE.BoxGeometry(w, 0.1, d), brass, x, H + 0.01, z));
  root.userData.dispose = () => root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  return root;
}

// ---------------------------------------------------------------- the tavern table
export function buildTable(texSize = 1024) {
  const root = new THREE.Group();
  const planks = B.material('darkWood', { size: texSize, seed: 8, repeat: [3, 3], color: '#2e190d', color2: '#4a2c17' });
  const floor = mesh(new THREE.PlaneGeometry(220, 220), planks, 0, 0, 0); floor.rotation.x = -Math.PI / 2; root.add(floor);
  const pewter = new THREE.MeshStandardMaterial({ color: 0xb9bcc2, metalness: 1, roughness: 0.3 }), brass = B.material('brass');
  // pewter tankard with a hinged lid and a handle
  const tank = new THREE.Group();
  tank.add(mesh(B.lathe([[0, 0], [3.2, 0], [3.3, 0.3], [3.0, 9.2], [3.15, 9.4], [3.15, 9.7], [0, 9.7]], 40), pewter));
  tank.add(mesh(B.lathe([[2.9, 8.9], [2.9, 9.7], [2.5, 9.7]], 40), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.6, side: THREE.DoubleSide })));
  const handle = mesh(new THREE.TorusGeometry(2.1, 0.45, 10, 24, Math.PI * 1.15), pewter, 3.7, 4.8, 0); handle.rotation.z = -Math.PI * 0.62; tank.add(handle);
  tank.position.set(-36, 0, -24); root.add(tank); root.userData.tank = tank;
  // candle in a brass stick, with a flame light
  const candle = new THREE.Group();
  candle.add(mesh(B.lathe([[0, 0], [3.4, 0], [3.4, 0.5], [1.0, 1.0], [0.8, 4.5], [1.7, 4.8], [1.7, 5.1], [0, 5.1]], 32), brass));
  candle.add(mesh(new THREE.CylinderGeometry(0.95, 0.95, 9, 20), new THREE.MeshStandardMaterial({ color: 0xf1e6c8, roughness: 0.6 }), 0, 9.6, 0));
  const flame = mesh(new THREE.SphereGeometry(0.6, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffd27a }), 0, 14.7, 0); flame.scale.set(0.7, 1.5, 0.7); candle.add(flame);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: blobTex(), color: 0xffb24a, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.set(11, 11, 1); halo.position.set(0, 14.7, 0); candle.add(halo);
  candle.position.set(38, 0, -26); root.add(candle);
  const lamp = new THREE.PointLight(0xffa955, 500, 120, 1.6); lamp.position.set(38, 16, -22); root.add(lamp);
  root.userData.candle = candle; root.userData.flame = flame; root.userData.halo = halo; root.userData.lamp = lamp;
  root.userData.dispose = () => root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  return root;
}
