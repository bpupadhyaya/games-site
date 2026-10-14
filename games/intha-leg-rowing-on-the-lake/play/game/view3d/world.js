// Intha Leg Rowing: 3D world builders. World frame: x = s (metres along the channel), z = n (across, + is the rower's right), y up, water at y = 0.
// Everything here is presentation: it reads the course (courses.js) and builds lit geometry; the simulation never sees it.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { centreAt, halfWidthAt } from '../src/courses.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const hash = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7 + 7.3) * 43758.5453; return x - Math.floor(x); };
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, o = {}) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
}
function rngOf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const col = (h) => new THREE.Color(h);

// ---- procedural textures ------------------------------------------------------------------------------------------------------------
// Water normal map: a few octaves of soft ripples (height field -> normals). Tileable by construction (periodic sines + wrapped noise).
export function waterNormalTexture(size = 256) {
  const hgt = new Float32Array(size * size), r = rngOf(5);
  const waves = [];
  for (let i = 0; i < 12; i++) waves.push({ kx: Math.round(1 + r() * 6) * (r() < 0.5 ? -1 : 1), ky: Math.round(1 + r() * 6), a: 0.3 + r() * 0.7, p: r() * TAU });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    for (const w of waves) v += w.a / (1 + Math.hypot(w.kx, w.ky) * 0.18) * Math.sin(((w.kx * x + w.ky * y) / size) * TAU + w.p);
    hgt[y * size + x] = v;
  }
  const c = cv(size), g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const xl = hgt[y * size + ((x + size - 1) % size)], xr = hgt[y * size + ((x + 1) % size)], yu = hgt[((y + size - 1) % size) * size + x], yd = hgt[((y + 1) % size) * size + x];
    let nx = (xl - xr) * 0.9, ny = (yu - yd) * 0.9, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * size + x) * 4; img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { linear: true, repeat: [1, 1] });
}
function soilCanvas(base = '#4d3a22', speck = '#2a1d0e', seed = 4, size = 256) {
  const c = cv(size), g = c.getContext('2d'), r = rngOf(seed);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2400; i++) { g.fillStyle = r() < 0.5 ? speck : 'rgba(255,230,180,0.12)'; g.globalAlpha = 0.25 + r() * 0.4; g.fillRect(r() * size, r() * size, 1 + r() * 3, 1 + r() * 3); }
  g.globalAlpha = 1; return c;
}
function leafCanvas(a = '#79b53a', b = '#3f8a2c', seed = 8, size = 128) {
  const c = cv(size), g = c.getContext('2d'), r = rngOf(seed);
  const gr = g.createRadialGradient(size * 0.4, size * 0.4, 4, size / 2, size / 2, size * 0.7); gr.addColorStop(0, a); gr.addColorStop(1, b);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(230,255,170,0.35)'; g.lineWidth = 1.2;
  for (let i = 0; i < 24; i++) { g.beginPath(); g.moveTo(size / 2, size / 2); g.lineTo(size / 2 + Math.cos(i / 24 * TAU) * size, size / 2 + Math.sin(i / 24 * TAU) * size); g.stroke(); }
  for (let i = 0; i < 300; i++) { g.fillStyle = r() < 0.5 ? 'rgba(20,50,10,0.18)' : 'rgba(220,255,160,0.14)'; g.fillRect(r() * size, r() * size, 2, 2); }
  return c;
}
export function blobTexture(rgb = '255,255,255', a = 1, size = 64) {
  const c = cv(size), g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.45, `rgba(${rgb},${a * 0.4})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return tex(c);
}

function plankCanvas(base = '#b8722f', seed = 3, size = 256) {
  const c = cv(size), g = c.getContext('2d'), r = rngOf(seed * 13 + 5);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  const shade = (a) => { g.fillStyle = a; };
  for (let i = 0; i < 9; i++) {                       // planks running along the hull (u axis = the texture's x axis)
    const y = (i * size) / 9;
    g.fillStyle = `rgba(${r() < 0.5 ? '255,235,200' : '30,12,0'},${0.04 + r() * 0.1})`; g.fillRect(0, y, size, size / 9);
    g.fillStyle = 'rgba(25,10,0,0.55)'; g.fillRect(0, y, size, 2);
    for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(40,18,4,${0.1 + r() * 0.2})`; g.lineWidth = 1; g.beginPath(); const yy = y + 4 + r() * (size / 9 - 8); g.moveTo(0, yy); g.bezierCurveTo(size * 0.3, yy + r() * 4 - 2, size * 0.7, yy + r() * 4 - 2, size, yy + r() * 2 - 1); g.stroke(); }
  }
  shade('rgba(0,0,0,0)');
  return c;
}
function netCanvas(size = 128) {
  const c = cv(size), g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,246,222,0.95)'; g.lineWidth = 3; g.lineCap = 'round';
  const n = 4, st = size / n;
  for (let i = -n; i <= n; i++) { g.beginPath(); g.moveTo(i * st, 0); g.lineTo(i * st + size, size); g.stroke(); g.beginPath(); g.moveTo(i * st + size, 0); g.lineTo(i * st, size); g.stroke(); }
  return c;
}
// ---- small mesh helpers --------------------------------------------------------------------------------------------------------------
const std = (color, rough = 0.7, metal = 0, o = {}) => new THREE.MeshStandardMaterial({ color: col(color), roughness: rough, metalness: metal, ...o });
export function cyl(r0, r1, h, seg, mat) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, seg), mat); m.castShadow = true; m.receiveShadow = true; return m; }
export function between(a, b, r, mat, seg = 6) {                 // a cylinder from world point a to b
  const d = new THREE.Vector3().subVectors(b, a), L = d.length() || 1e-3;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.scale.set(1, L, 1);
  m.castShadow = true; return m;
}
function strip(points, width, y, mat, side = 0) {                 // ribbon along the channel: points [[x,z]...], offsets from a polyline
  const pos = [], uv = [], idx = [];
  points.forEach((p, i) => {
    const n = points[Math.min(points.length - 1, i + 1)], q = points[Math.max(0, i - 1)];
    let dx = n[0] - q[0], dz = n[1] - q[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const nx = -dz, nz = dx;
    pos.push(p[0] + nx * width[0], y, p[1] + nz * width[0], p[0] + nx * width[1], y, p[1] + nz * width[1]);
    uv.push(i * 0.25, 0, i * 0.25, 1);
    if (i < points.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}

// ---- the boat -------------------------------------------------------------------------------------------------------------------------
// Local frame: +x bow, +z the rower's right (starboard), y up, water at 0. Length 5.45 m (stern -2.55 .. bow 2.9), beam 0.92 m.
export function hullGeometry() {
  const NX = 30, NT = 12, pos = [], idx = [], uv = [];
  const halfW = (x) => (x < 0.1 ? 0.30 + 0.16 * ss(-2.55, -1.1, x) : 0.46 * Math.pow(Math.max(0, 1 - ((x - 0.1) / 2.8) ** 2), 0.55));
  const gun = (x) => 0.38 + 0.5 * Math.pow(Math.max(0, (x - 1.15) / 1.75), 2.2) + 0.22 * Math.pow(Math.max(0, (-x - 2.0) / 0.55), 2);
  const keel = (x) => -0.1 + 0.42 * Math.pow(Math.max(0, (x - 0.9) / 2.0), 2) + 0.12 * Math.pow(Math.max(0, (-x - 1.8) / 0.75), 2);
  for (let i = 0; i <= NX; i++) {
    const x = -2.55 + (5.45 * i) / NX, w = halfW(x), top = gun(x), bot = keel(x);
    for (let j = 0; j <= NT; j++) {
      const t = (j / NT) * 2 - 1, a = Math.abs(t);
      pos.push(x, bot + (top - bot) * Math.pow(a, 1.3), w * t);
      uv.push(i / NX * 3, j / NT);
    }
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NT; j++) { const a = i * (NT + 1) + j, b = a + 1, c = a + NT + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  g.userData = { halfW, gun, keel };
  return g;
}
let _hull = null;
export function makeBoat(look, o = {}) {
  _hull ||= hullGeometry();
  const grp = new THREE.Group(), model = new THREE.Group(); grp.add(model);
  const wood = new THREE.MeshStandardMaterial({ map: tex(plankCanvas(look.hull, 3 + (o.seed || 0)), { repeat: [1, 1] }), roughness: 0.55, metalness: 0.0, side: THREE.DoubleSide });
  const hull = new THREE.Mesh(_hull, wood); hull.castShadow = true; hull.receiveShadow = true; model.add(hull);
  const { halfW, gun } = _hull.userData;
  // gunwale rail (a tube along the rim) in the trim colour, and the thwarts
  const rimMat = std(look.trim, 0.5, 0.05);
  for (const sgn of [-1, 1]) {
    const pts = []; for (let x = -2.55; x <= 2.9001; x += 0.2) pts.push(new THREE.Vector3(x, gun(x) + 0.01, sgn * halfW(x)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.028, 6), rimMat); m.castShadow = true; model.add(m);
  }
  // floor boards (a flat slab inside) and the raised stern platform where the rower stands
  const floor = new THREE.Mesh(B.slab(2.3, 0.44, 0.04, 0.02, 0.01), B.material('wood', { color: '#d1a468', color2: '#e8c288', repeat: [4, 1], seed: 9 }));
  floor.position.set(-0.3, 0.13, 0); floor.receiveShadow = true; model.add(floor);
  const plat = new THREE.Mesh(B.slab(0.85, 0.5, 0.05, 0.03, 0.015), B.material('wood', { color: '#e0b676', color2: '#f0cd96', repeat: [1, 1], seed: 11 }));
  plat.position.set(-1.8, 0.13, 0.02); plat.castShadow = true; plat.receiveShadow = true; model.add(plat);
  // the oarlock post (a short stake with a lashing) on the right gunwale at the stern
  const post = cyl(0.026, 0.03, 0.46, 8, std('#8a6234', 0.8)); post.position.set(-1.9, 0.5, 0.36); model.add(post);
  const lash = cyl(0.04, 0.04, 0.05, 10, std('#d8c9a0', 0.9)); lash.position.set(-1.9, 0.7, 0.36); model.add(lash);
  // catch basket + the fish in it, bow bundle
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.2, 14, 1, true), std('#a47a3c', 0.9, 0, { side: THREE.DoubleSide }));
  basket.position.set(0.3, 0.14, -0.14); basket.castShadow = true; model.add(basket);
  const fishMat = std('#dfeaee', 0.3, 0.4);
  const fishes = [];
  for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), fishMat); f.scale.set(1.5, 0.45, 0.5); f.position.set(0.24 + i * 0.03, 0.24 + (i % 2) * 0.03, -0.16 + (i % 3) * 0.05); f.rotation.y = i * 1.3; f.visible = false; model.add(f); fishes.push(f); }
  const bundle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.6, 10), std('#b08a4a', 0.9)); bundle.rotation.z = Math.PI / 2; bundle.position.set(1.5, 0.3, 0.08); model.add(bundle);
  // the oar: a pivot at the post; the shaft runs out to the right and down to the blade
  const oarPivot = new THREE.Group(); oarPivot.position.set(-1.9, 0.64, 0.36); model.add(oarPivot);
  const shaft = cyl(0.026, 0.026, 1, 8, std('#d9b672', 0.55)); shaft.geometry.rotateZ(Math.PI / 2); oarPivot.add(shaft);
  const blade = new THREE.Mesh(B.roundedBox(0.72, 0.2, 0.03, 0.012, 3), std('#a07a40', 0.6)); blade.castShadow = true; oarPivot.add(blade);
  // the net: bamboo cone frame + netting, held on a pole
  const net = new THREE.Group(); model.add(net);
  const ribs = new THREE.Group(); model.add(ribs);
  const netTex = tex(netCanvas(128), { repeat: [10, 3] });
  const netMat = new THREE.MeshBasicMaterial({ map: netTex, color: 0xffffff, transparent: true, opacity: 0.9, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 1, 1, 24, 4, true), netMat); net.add(cone);
  const ringMat = std('#d9b672', 0.6);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(1, 0.028, 6, 36), ringMat); mouth.rotation.x = Math.PI / 2; net.add(mouth);
  const rib = []; for (let i = 0; i < 8; i++) { const m = cyl(0.014, 0.014, 1, 4, ringMat); ribs.add(m); rib.push(m); }
  const poleMat = std('#cdb070', 0.55);
  const pole = cyl(0.022, 0.03, 1, 6, poleMat); model.add(pole);
  const glow = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 48), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, depthWrite: false })); glow.rotation.x = Math.PI / 2; net.add(glow);
  // a drop shadow tint under the hull on the water
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.9), new THREE.MeshBasicMaterial({ map: blobTexture('0,20,30', 0.65, 64), transparent: true, depthWrite: false }));
  wet.rotation.x = -Math.PI / 2; wet.position.set(0.25, 0.008, 0.05); wet.renderOrder = 1; grp.add(wet);
  return { group: grp, model, oarPivot, shaft, blade, net, cone, mouth, rib, pole, glow, fishes, netMat, look, wet };
}

// ---- the lake: banks, floating gardens, stilt houses, reeds, lotus, hyacinth, fences, gates, stakes, finish -----------------------------------
export function buildLake(C, THEME, quality = 'high') {
  const root = new THREE.Group(); root.name = 'lake';
  const L = C.length, th = THEME;
  const rnd = rngOf(C.seed * 7 + 1);
  const step = 1.5, s0 = -26, s1 = L + 34, path = [];
  for (let s = s0; s <= s1; s += step) path.push([s, centreAt(C, Math.max(0, Math.min(L, s)))]);
  const edge = (side) => path.map(([s]) => [s, centreAt(C, clamp(s, 0, L)) + side * halfWidthAt(C, clamp(s, 0, L))]);
  const soilMap = tex(soilCanvas(th.soil, '#1c1208', C.seed, 256), { repeat: [1, 1] });
  const soilMat = new THREE.MeshStandardMaterial({ map: soilMap, color: 0xffffff, roughness: 0.95 });
  const bed1 = new THREE.MeshStandardMaterial({ color: col(th.bed), roughness: 0.9 }), bed2 = new THREE.MeshStandardMaterial({ color: col(th.bed2), roughness: 0.9 });
  const matEdge = new THREE.MeshStandardMaterial({ color: 0x8aa84a, roughness: 0.9 });
  const bushGeo = new THREE.SphereGeometry(1, 7, 5), fruitGeo = new THREE.SphereGeometry(1, 6, 4);
  const bushes = [], fruits = [], stakes = [];
  const NB = quality === 'low' ? 2 : 3;
  for (const side of [-1, 1]) {
    const e = path.map(([s]) => { const sc = clamp(s, 0, L); return [s, centreAt(C, sc) + side * (halfWidthAt(C, sc) + 0.0)]; });
    // soil mat under everything (a raised floating garden 9 m wide) and its green lip
    const far = NB * 2.0 + 1.6;
    const soil = strip(e, side > 0 ? [0.05, far] : [-0.05, -far], 0.2, soilMat); root.add(soil);
    const lip = strip(e, side > 0 ? [-0.25, 0.3] : [0.25, -0.3], 0.18, matEdge); root.add(lip);
    for (let j = 0; j < NB; j++) {
      const a = 0.5 + j * 2.0, b = a + 1.55;
      const bed = strip(e, side > 0 ? [a, b] : [-a, -b], 0.27, (j + (side > 0 ? 1 : 0)) % 2 ? bed2 : bed1); root.add(bed);
      for (let r = 0; r < 2; r++) {
        const off = a + 0.5 + r * 0.6, sp = 0.78;
        for (let s = s0; s < s1; s += sp) {
          const k = Math.round(s / sp), ss0 = s + hash(k, j * 3 + r + side) * 0.2, sc = clamp(ss0, 0, L);
          const n = centreAt(C, sc) + side * (halfWidthAt(C, sc) + off);
          const rad = 0.25 + 0.07 * hash(k, r + j * 5);
          bushes.push([ss0, n, rad, hash(k, 9 + j)]);
          const hf = hash(k, 40 + j + r * 5);
          if (hf > 0.72) fruits.push([ss0 + 0.1, n + 0.06, rad * 0.9, hf > 0.9]);
        }
      }
      for (let s = s0; s < s1; s += 4.4) {
        const k = Math.round(s / 4.4), ss0 = s + hash(k, j + side) * 1.2, sc = clamp(ss0, 0, L);
        stakes.push([ss0, centreAt(C, sc) + side * (halfWidthAt(C, sc) + a + 1.55 + 0.1), 0.9 + 0.5 * hash(k, j)]);
      }
    }
  }
  // instanced bushes (varying greens) + fruit + bamboo stakes
  const bushMat = new THREE.MeshStandardMaterial({ map: tex(leafCanvas('#8fcf5a', '#4f8f36', C.seed + 3, 128), { repeat: [2, 1] }), color: 0xffffff, roughness: 0.9 });
  const bm = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length); const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), c1 = new THREE.Color();
  bushes.forEach((b, i) => {
    tmp.compose(new THREE.Vector3(b[0], 0.28 + b[2] * 0.42, b[1]), q, new THREE.Vector3(b[2] * 1.05, b[2] * 0.68, b[2] * 1.05));
    bm.setMatrixAt(i, tmp); c1.set(b[3] < 0.5 ? '#4f9a3a' : '#69b349').offsetHSL((b[3] - 0.5) * 0.05, 0, (b[3] - 0.5) * 0.12); bm.setColorAt(i, c1);
  });
  bm.castShadow = quality !== 'low'; bm.receiveShadow = true; root.add(bm);
  const fm = new THREE.InstancedMesh(fruitGeo, std('#ffffff', 0.4), fruits.length);
  fruits.forEach((f, i) => { tmp.compose(new THREE.Vector3(f[0], 0.3 + f[2] * 0.75, f[1]), q, new THREE.Vector3(0.075, 0.075, 0.075)); fm.setMatrixAt(i, tmp); c1.set(f[3] ? '#e8452c' : '#f4c64a'); fm.setColorAt(i, c1); });
  root.add(fm);
  const stakeG = new THREE.CylinderGeometry(0.035, 0.04, 1, 6);
  const sm = new THREE.InstancedMesh(stakeG, std('#c9a15a', 0.75), stakes.length);
  stakes.forEach((s, i) => { tmp.compose(new THREE.Vector3(s[0], 0.2 + s[2] / 2, s[1]), q, new THREE.Vector3(1, s[2], 1)); sm.setMatrixAt(i, tmp); });
  sm.castShadow = quality !== 'low'; root.add(sm);

  // reeds along the mat edge
  const reedMat = new THREE.MeshStandardMaterial({ color: 0x78a43a, roughness: 0.8, side: THREE.DoubleSide });
  const reeds = [];
  for (const side of [-1, 1]) for (let s = s0; s < s1; s += 2.1) {
    const k = Math.round(s / 2.1), h = hash(k, side + 9);
    if (h < 0.4) continue;
    const ss0 = s + h * 1.4, sc = clamp(ss0, 0, L), n = centreAt(C, sc) + side * (halfWidthAt(C, sc) + 0.1);
    reeds.push([ss0, n, side, h]);
  }
  const reedGeo = new THREE.CylinderGeometry(0.0, 0.03, 1, 4, 1);
  const rm = new THREE.InstancedMesh(reedGeo, reedMat, reeds.length * 5);
  let ri = 0;
  reeds.forEach((r) => { for (let q2 = 0; q2 < 5; q2++) {
    const a = (q2 - 2) * 0.3 + hash(ri, 3) * 0.2, hgt = 0.9 + 0.7 * hash(ri, 5);
    const e = new THREE.Euler(side0(r[2]) * a * 0.9, 0, (hash(ri, 2) - 0.5) * 0.4); q.setFromEuler(e);
    tmp.compose(new THREE.Vector3(r[0] + (hash(ri, 6) - 0.5) * 0.3, 0.2 + hgt / 2, r[1] + r[2] * 0.1), q, new THREE.Vector3(1, hgt, 1)); rm.setMatrixAt(ri++, tmp); } });
  root.add(rm);

  // stilt houses and moored boats, every ~58 m on each side
  const houseWall = B.material('wood', { color: '#8a6236', color2: '#b88a52', repeat: [2, 1], seed: 21 });
  const roofMat = std('#a08a52', 0.95), stiltMat = std('#5c4020', 0.9);
  for (const side of [-1, 1]) for (let k = Math.floor(s0 / 58); k <= Math.ceil(s1 / 58); k++) {
    const h = hash(k, side * 3 + 1), s = k * 58 + 8 + h * 30, sc = clamp(s, 0, L), n = centreAt(C, sc) + side * (halfWidthAt(C, sc) + 4.6 + h * 1.4);
    const g = new THREE.Group(); g.position.set(s, 0, n); g.rotation.y = (hash(k, 77) - 0.5) * 0.4;
    for (const [dx, dz] of [[-1.3, -0.95], [1.3, -0.95], [-1.3, 0.95], [1.3, 0.95]]) { const p = cyl(0.07, 0.07, 1.6, 6, stiltMat); p.position.set(dx, 0.45, dz); g.add(p); }
    const deck = new THREE.Mesh(B.slab(3.2, 2.4, 0.08, 0.03, 0.01), houseWall); deck.position.set(0, 1.12, 0); deck.castShadow = true; g.add(deck);
    const body = new THREE.Mesh(B.roundedBox(2.6, 1.3, 1.9, 0.04, 2), houseWall); body.position.set(0, 1.82, 0); body.castShadow = true; body.receiveShadow = true; g.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 1.9, 1.1, 4, 1), roofMat); roof.rotation.y = Math.PI / 4; roof.scale.set(1.2, 1, 0.9); roof.position.set(0, 3.0, 0); roof.castShadow = true; g.add(roof);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd790 })); win.position.set(0, 1.9, 0.96); g.add(win);
    root.add(g);
    if (h > 0.4) { const bs = s + 11, bsc = clamp(bs, 0, L); const mb = makeBoat({ hull: '#8a5a2e', trim: '#c99557' }, { seed: k }); mb.model.scale.set(0.7, 0.7, 0.7); mb.group.position.set(bs, 0, centreAt(C, bsc) + side * (halfWidthAt(C, bsc) + 0.9)); mb.group.rotation.y = (hash(k, 3) - 0.5) * 0.3 + (side > 0 ? 0 : 0); mb.oarPivot.visible = false; mb.net.visible = false; mb.pole.visible = false; mb.wet.visible = false; root.add(mb.group); }
  }
  void side0;

  // lotus pads and flowers
  const padTex = tex(leafCanvas('#7cc04a', '#2f7a30', 5, 128));
  const padGeo = new THREE.CircleGeometry(1, 20); padGeo.rotateX(-Math.PI / 2);
  const padMat = new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.6, side: THREE.DoubleSide });
  const pads = [], flowers = [];
  for (const side of [-1, 1]) for (let s = s0; s < s1; s += 7.3) {
    const k = Math.round(s / 7.3), h = hash(k, side * 5 + 2);
    if (h < 0.3) continue;
    const n1 = 2 + Math.floor(h * 4);
    for (let i = 0; i < n1; i++) {
      const ss0 = s + h * 4 + (hash(k, i) - 0.5) * 1.6, sc = clamp(ss0, 0, L), n = centreAt(C, sc) + side * (halfWidthAt(C, sc) - 0.5 - hash(k, 8 + side + i) * 1.3);
      pads.push([ss0, n, 0.3 + 0.2 * hash(k, i + 11), hash(k, i + 20) * TAU]);
      if (hash(k, i + 30) > 0.78) flowers.push([ss0, n]);
    }
  }
  const padM = new THREE.InstancedMesh(padGeo, padMat, pads.length);
  pads.forEach((p, i) => { q.setFromEuler(new THREE.Euler(0, p[3], 0)); tmp.compose(new THREE.Vector3(p[0], 0.012, p[1]), q, new THREE.Vector3(p[2], 1, p[2])); padM.setMatrixAt(i, tmp); });
  padM.receiveShadow = true; root.add(padM);
  const flowGeo = new THREE.SphereGeometry(1, 8, 5);
  const flM = new THREE.InstancedMesh(flowGeo, std('#ffc6dc', 0.5), flowers.length);
  flowers.forEach((f, i) => { tmp.compose(new THREE.Vector3(f[0], 0.07, f[1]), q.identity(), new THREE.Vector3(0.1, 0.07, 0.1)); flM.setMatrixAt(i, tmp); });
  root.add(flM);

  // hyacinth mats
  const hyG = new THREE.Group(); root.add(hyG);
  const hyMat = new THREE.MeshStandardMaterial({ map: tex(leafCanvas('#a2d85c', '#3c8a2c', 12, 128)), roughness: 0.55, side: THREE.DoubleSide });
  const hyGeo = new THREE.CircleGeometry(1, 14); hyGeo.rotateX(-Math.PI / 2);
  const hyInst = [], bloomInst = [];
  for (const h of C.hyac) for (let i = 0; i < 26; i++) {
    const a = hash(h.s * 3 + i) * TAU, d = Math.sqrt(hash(h.s * 5 + i * 3 + 1)) * h.r;
    hyInst.push([h.s + Math.cos(a) * d, h.n + Math.sin(a) * d, 0.32 + hash(i + h.s) * 0.28, a, hash(i, h.s)]);
    if (i % 4 === 0) bloomInst.push([h.s + Math.cos(a) * d, h.n + Math.sin(a) * d]);
  }
  const hyM = new THREE.InstancedMesh(hyGeo, hyMat, hyInst.length || 1); hyM.count = hyInst.length;
  hyInst.forEach((p, i) => { q.setFromEuler(new THREE.Euler((hash(i, 4) - 0.5) * 0.25, p[3], (hash(i, 5) - 0.5) * 0.25)); tmp.compose(new THREE.Vector3(p[0], 0.035 + p[4] * 0.03, p[1]), q, new THREE.Vector3(p[2], 1, p[2] * 0.88)); hyM.setMatrixAt(i, tmp); });
  hyM.receiveShadow = true; hyG.add(hyM);
  const blM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), std('#c9a8f4', 0.5), bloomInst.length || 1); blM.count = bloomInst.length;
  bloomInst.forEach((p, i) => { tmp.compose(new THREE.Vector3(p[0], 0.14, p[1]), q.identity(), new THREE.Vector3(0.1, 0.13, 0.1)); blM.setMatrixAt(i, tmp); });
  hyG.add(blM);

  // fence posts where the channel pinches
  const fenceMat = std('#b78a4a', 0.8), railMat = std('#8a6636', 0.8);
  for (const f of C.fences) for (const side of [-1, 1]) {
    const pts = [];
    for (let s = f.s0 - 3; s <= f.s1 + 3.001; s += 0.85) {
      const sc = clamp(s, 0, L), n = centreAt(C, sc) + side * (halfWidthAt(C, sc) - 0.12), hgt = 1.0 + 0.25 * hash(Math.round(s * 7), side);
      const p = cyl(0.07, 0.085, hgt + 0.3, 7, fenceMat); p.position.set(s, hgt / 2 - 0.15, n); root.add(p);
      pts.push(new THREE.Vector3(s, 0.45, n)); pts.push(new THREE.Vector3(s, 0.85, n));
    }
    for (const lvl of [0, 1]) { const cp = pts.filter((_, i) => i % 2 === lvl); const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), cp.length * 3, 0.035, 5), railMat); m.castShadow = true; root.add(m); }
  }

  // swell markers: posts with pennants at the near end
  const swellG = [];
  for (const w of C.swells) {
    for (const side of [-1, 1]) {
      const n = centreAt(C, w.s0) + side * (halfWidthAt(C, w.s0) - 0.5);
      const post = cyl(0.05, 0.06, 1.7, 7, std('#e8c06a', 0.6)); post.position.set(w.s0, 0.85, n); root.add(post);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.36), new THREE.MeshStandardMaterial({ color: 0x3aa6d6, side: THREE.DoubleSide, roughness: 0.7 }));
      flag.position.set(w.s0 - 0.42, 1.5, n - side * 0.0); root.add(flag); swellG.push(flag);
    }
  }
  // swell crests: pooled thin ribbons that travel along the swell band
  const crestMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
  const crests = [];
  for (const w of C.swells) for (let k = 0; k < 8; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 1), crestMat.clone()); m.rotation.x = -Math.PI / 2; m.position.y = 0.045; m.renderOrder = 2; root.add(m); crests.push({ m, w, k });
  }

  // gates: two buoy poles with pennants + a dashed line between them
  const gateObjs = C.gates.map((g) => {
    const grp = new THREE.Group(); grp.position.set(g.s, 0, g.n);
    const mk = (z, colr) => {
      const pole = cyl(0.05, 0.06, 1.5, 8, std('#d0b070', 0.6)); pole.position.set(0, 0.7, z); grp.add(pole);
      const bu = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), std(colr, 0.35, 0.05)); bu.position.set(0, 0.05, z); bu.castShadow = true; grp.add(bu);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42), new THREE.MeshStandardMaterial({ color: col(colr), side: THREE.DoubleSide, roughness: 0.7 })); flag.position.set(-0.45, 1.3, z); grp.add(flag);
      return { bu, flag };
    };
    const a = mk(-g.gap / 2, '#e8452c'), b = mk(g.gap / 2, '#f4f4f4');
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, g.gap - 0.4), lineMat); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.04, 0); line.renderOrder = 2; grp.add(line);
    root.add(grp);
    return { g, grp, flags: [a.flag, b.flag], lineMat };
  });
  // fishing stakes
  const stakeObjs = C.stakes.map((st) => {
    const grp = new THREE.Group(); grp.position.set(st.s, 0, st.n);
    const p = cyl(0.1, 0.13, 2.1, 8, std('#a9824a', 0.8)); p.position.y = 0.85; grp.add(p);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), std('#7a5a30', 0.8)); cap.position.y = 1.95; grp.add(cap);
    const foam = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.34, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); foam.rotation.x = -Math.PI / 2; foam.position.y = 0.03; grp.add(foam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.46, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; grp.add(ring);
    root.add(grp);
    return { grp, ring, foam, st };
  });
  // start line + finish pier
  {
    const hw = halfWidthAt(C, 0), mk = (x, z, c) => { const p = cyl(0.06, 0.08, 1.8, 8, std('#d0b070', 0.6)); p.position.set(x, 0.85, z); root.add(p); const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), std(c, 0.4)); b.position.set(x, 0.05, z); root.add(b); };
    mk(0.4, -hw + 0.3, '#e8452c'); mk(0.4, hw - 0.3, '#e8452c');
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, hw * 2 - 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false })); dash.rotation.x = -Math.PI / 2; dash.position.set(0.4, 0.045, 0); dash.renderOrder = 2; root.add(dash);
    const cen = centreAt(C, L), fhw = halfWidthAt(C, L) + 5;
    const buoyM = [std('#ffffff', 0.4), std('#222222', 0.4)];
    for (let q2 = -fhw, i = 0; q2 <= fhw; q2 += 0.7, i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), buoyM[i % 2]); b.position.set(L, 0.04, cen + q2); root.add(b); }
    const deck = new THREE.Mesh(B.slab(9, fhw * 2 + 12, 0.3, 0.05, 0.02), B.material('wood', { color: '#8a5a2e', color2: '#b27a3a', repeat: [2, 4], seed: 31 }));
    deck.position.set(L + 3.4 + 4.5, 0.12, cen); deck.castShadow = true; deck.receiveShadow = true; root.add(deck);
    for (let q2 = -fhw - 5; q2 <= fhw + 5; q2 += 3) { const p = cyl(0.12, 0.14, 1.6, 8, std('#5c4020', 0.9)); p.position.set(L + 3.4, -0.1, cen + q2); root.add(p); }
    const poleL = cyl(0.08, 0.1, 3.2, 8, std('#d8c9a0', 0.7)); poleL.position.set(L, 1.5, cen - fhw); root.add(poleL);
    const poleR = cyl(0.08, 0.1, 3.2, 8, std('#d8c9a0', 0.7)); poleR.position.set(L, 1.5, cen + fhw); root.add(poleR);
    const bunt = [];
    for (let q2 = -fhw + 0.6, i = 0; q2 < fhw - 0.3; q2 += 1.2, i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshStandardMaterial({ color: ['#e8452c', '#ffd45a', '#3aa6d6', '#ffffff'][i % 4], side: THREE.DoubleSide, roughness: 0.7 }));
      f.position.set(L - 0.3, 2.8 - Math.sin(((q2 + fhw) / (fhw * 2)) * Math.PI) * 0.35, cen + q2); root.add(f); bunt.push(f);
    }
    root.userData.bunting = bunt;
  }
  // a faint dark ribbon over the channel: deeper water
  {
    const deepMat = new THREE.MeshBasicMaterial({ color: col(th.deep), transparent: true, opacity: 0.32, depthWrite: false });
    const wid = path.map(([s]) => halfWidthAt(C, clamp(s, 0, L)) * 0.8);
    const deepGeo = strip(path, [-4, 4], 0.006, deepMat).geometry;
    // widen per sample
    const p = deepGeo.attributes.position;
    path.forEach(([s, c], i) => { p.setZ(i * 2, c - wid[i]); p.setZ(i * 2 + 1, c + wid[i]); p.setX(i * 2, s); p.setX(i * 2 + 1, s); });
    p.needsUpdate = true; const deep = new THREE.Mesh(deepGeo, deepMat); deep.renderOrder = 0; root.add(deep);
  }
  root.userData.gates = gateObjs; root.userData.stakes = stakeObjs; root.userData.swellFlags = swellG; root.userData.crests = crests;
  return root;
}
function side0(x) { return x; }

// ---- shoal fish (instanced) ----------------------------------------------------------------------------------------------------------------
export function makeFishPool(max = 160) {
  const g = new THREE.SphereGeometry(0.1, 8, 5);
  const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.55 }), max);
  m.frustumCulled = false; m.count = 0; return m;
}
