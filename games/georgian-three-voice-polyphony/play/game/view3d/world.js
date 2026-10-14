// Three Voices: the 3D world (shared by the game presenter and the offline icon render).
// A village courtyard at dusk: stone arcade with the Caucasus behind it, a timber pergola with vines and iron lanterns, a long supra
// table with a wine horn, clay jug, bread and grapes, and three real 3D singers (view3d athlete rigs) in Georgian dress standing
// shoulder to shoulder behind it. Everything is procedural (canvas textures, lathe / loft / tube geometry): no image files.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { loadHuman } from '../vendor3d/index.js';

export const SINGERS = [
  { id: 'bass', x: -0.66, role: 'Bass', gender: 'm', skin: 'tan', hair: 'grey', col: '#f4a73c', coat: '#2b1a12', coat2: '#4a2c1c', inner: '#c8b38a', hat: 'papakha', beard: true, scale: 1.0 },
  { id: 'mid', x: 0, role: 'Middle', gender: 'm', skin: 'light', hair: 'black', col: '#ff6f86', coat: '#16130f', coat2: '#2a2520', inner: '#9a2a3a', hat: null, beard: false, scale: 1.02 },
  { id: 'top', x: 0.66, role: 'Top', gender: 'f', skin: 'tan', hair: 'brown', col: '#5fe0d2', coat: '#0f4a46', coat2: '#1d6a62', inner: '#e9dfc8', hat: 'veil', beard: false, scale: 1.0 },
];

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function tex(c, o = {}) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 4;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
}
export function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const tick = () => new Promise((r) => setTimeout(r, 0));

// ---- textures --------------------------------------------------------------------------------------------------------------------------
function stoneWallCanvas(W = 1024, H = 512, seed = 5) {
  const c = cv(W, H), x = c.getContext('2d'), r = rngOf(seed), bump = cv(W, H), bx = bump.getContext('2d');
  x.fillStyle = '#6b5d52'; x.fillRect(0, 0, W, H); bx.fillStyle = '#505050'; bx.fillRect(0, 0, W, H);
  const rows = 9, rh = H / rows;
  for (let j = 0; j < rows; j++) {
    let px = -r() * 80;
    while (px < W) {
      const w = 90 + r() * 120, tone = r();
      const base = tone < 0.33 ? [150, 128, 104] : tone < 0.66 ? [128, 112, 98] : [170, 142, 108];
      const k = 0.82 + r() * 0.3, col = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
      x.fillStyle = col; x.beginPath(); x.roundRect(px + 3, j * rh + 3, w - 6, rh - 6, 10); x.fill();
      const g = x.createLinearGradient(px, j * rh, px, j * rh + rh); g.addColorStop(0, 'rgba(255,230,190,0.22)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
      x.fillStyle = g; x.beginPath(); x.roundRect(px + 3, j * rh + 3, w - 6, rh - 6, 10); x.fill();
      bx.fillStyle = '#d0d0d0'; bx.beginPath(); bx.roundRect(px + 3, j * rh + 3, w - 6, rh - 6, 10); bx.fill();
      for (let n = 0; n < 40; n++) { x.fillStyle = r() < 0.5 ? 'rgba(255,240,210,0.07)' : 'rgba(30,18,10,0.1)'; x.fillRect(px + 6 + r() * (w - 12), j * rh + 6 + r() * (rh - 12), 2 + r() * 4, 2 + r() * 3); }
      px += w;
    }
  }
  return { map: c, bump };
}
function skyCanvas(W = 1024, H = 512) {
  const c = cv(W, H), x = c.getContext('2d'), r = rngOf(9);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#14123a'); g.addColorStop(0.35, '#3a2a62'); g.addColorStop(0.62, '#b0587a'); g.addColorStop(0.8, '#f0a064'); g.addColorStop(1, '#ffd08a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,248,230,${0.25 + r() * 0.5})`; x.fillRect(r() * W, r() * H * 0.4, 1 + r() * 1.5, 1 + r() * 1.5); }
  const ridge = (base, amp, col, seed) => {
    const q = rngOf(seed); x.fillStyle = col; x.beginPath(); x.moveTo(0, H);
    let y = base; for (let px = 0; px <= W; px += 8) { y += (q() - 0.5) * amp; y = Math.max(base - amp * 4, Math.min(base + amp * 3, y)); x.lineTo(px, y + Math.sin(px * 0.011 + seed) * amp * 1.8); }
    x.lineTo(W, H); x.closePath(); x.fill();
  };
  ridge(H * 0.62, 20, '#6a4a7a', 3); ridge(H * 0.72, 16, '#4a3568', 7); ridge(H * 0.82, 12, '#2a1f4a', 11);
  return c;
}
function leafCanvas(W = 128) {
  const c = cv(W), x = c.getContext('2d');
  x.translate(W / 2, W / 2);
  const g = x.createRadialGradient(0, -W * 0.1, 4, 0, 0, W * 0.5); g.addColorStop(0, '#6fa04a'); g.addColorStop(1, '#2d5a2a');
  x.fillStyle = g; x.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k / 10) * TAU, rr = k % 2 ? W * 0.28 : W * 0.46; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  x.closePath(); x.fill(); x.strokeStyle = 'rgba(20,50,20,0.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, W * 0.4); x.lineTo(0, -W * 0.4); x.stroke();
  return c;
}
function linenCanvas(W = 512, H = 256) {
  const c = cv(W, H), x = c.getContext('2d'), r = rngOf(31);
  x.fillStyle = '#efe6d2'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { x.fillStyle = r() < 0.5 ? 'rgba(120,100,70,0.06)' : 'rgba(255,255,255,0.12)'; x.fillRect(r() * W, r() * H, 1 + r() * 6, 1); }
  for (let i = 0; i < W; i += 6) { x.fillStyle = 'rgba(130,100,70,0.05)'; x.fillRect(i, 0, 1, H); }
  // embroidered band (red / black diamonds) at the lower edge
  x.fillStyle = '#7a1c24'; x.fillRect(0, H * 0.78, W, 6); x.fillStyle = '#1c1210'; x.fillRect(0, H * 0.78 + 10, W, 3);
  for (let i = 0; i < W; i += 22) { x.fillStyle = '#8c2430'; x.beginPath(); x.moveTo(i + 11, H * 0.82); x.lineTo(i + 20, H * 0.88); x.lineTo(i + 11, H * 0.94); x.lineTo(i + 2, H * 0.88); x.closePath(); x.fill(); }
  return c;
}
function furCanvas(W = 256, base = [60, 48, 40], seed = 3) {
  const c = cv(W), x = c.getContext('2d'), r = rngOf(seed);
  x.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; x.fillRect(0, 0, W, W);
  for (let i = 0; i < 4200; i++) {
    const k = (r() - 0.45) * 70, px = r() * W, py = r() * W;
    x.strokeStyle = `rgba(${Math.max(0, Math.min(255, base[0] + k)) | 0},${Math.max(0, Math.min(255, base[1] + k)) | 0},${Math.max(0, Math.min(255, base[2] + k)) | 0},0.8)`;
    x.lineWidth = 1 + r() * 1.5; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 7, py + 5 + r() * 9); x.stroke();
  }
  return c;
}
function mouthCanvas() {
  const c = cv(128), x = c.getContext('2d');
  const lip = x.createRadialGradient(64, 64, 20, 64, 64, 62); lip.addColorStop(0, '#7a2a2a'); lip.addColorStop(0.75, '#9a4a46'); lip.addColorStop(1, 'rgba(154,74,70,0)');
  x.fillStyle = lip; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#1c0707'; x.beginPath(); x.ellipse(64, 64, 42, 40, 0, 0, TAU); x.fill();
  x.fillStyle = '#e8e0d4'; x.beginPath(); x.ellipse(64, 40, 34, 11, 0, 0, TAU); x.fill();            // upper teeth
  x.fillStyle = 'rgba(180,70,70,0.9)'; x.beginPath(); x.ellipse(64, 92, 26, 12, 0, 0, TAU); x.fill();  // tongue
  return c;
}
export const blobCanvas = (rgb, a, size = 128) => { const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, size, size); return c; };

// ---- geometry --------------------------------------------------------------------------------------------------------------------------
// rings: [{ c: Vector3 centre, rx, rz }] stacked bottom to top, axes = world X (side) and Z (front).
function loft(rings, seg = 20, { colorFn = null } = {}) {
  const pos = [], idx = [], n = rings.length;
  for (const r of rings) for (let s = 0; s <= seg; s++) { const a = (s / seg) * TAU; pos.push(r.c.x + Math.cos(a) * r.rx, r.c.y, r.c.z + Math.sin(a) * r.rz); }
  for (let j = 0; j < n - 1; j++) for (let s = 0; s < seg; s++) { const a = j * (seg + 1) + s, b = a + seg + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  if (colorFn) {
    const col = [], c = new THREE.Color();
    for (let j = 0; j < n; j++) for (let sI = 0; sI <= seg; sI++) { const a = (sI / seg) * TAU, r = rings[j]; colorFn(c, Math.cos(a) * r.rx, Math.sin(a) * r.rz, r.c.y, j / (n - 1)); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  return g;
}
// An elliptical tube between two points (front = the direction the wide axis of the ellipse points to).
function tube(p0, p1, r0, r1, { front = V3(0, 0, 1), squash = 1, seg = 14, rings = 6, ext0 = 0, ext1 = 0 } = {}) {
  const a = p1.clone().sub(p0), len = a.length(); a.normalize();
  const f = front.clone().sub(a.clone().multiplyScalar(front.dot(a))).normalize(), s = new THREE.Vector3().crossVectors(a, f).normalize();
  const pos = [], idx = [], uv = [];
  const q0 = p0.clone().addScaledVector(a, -ext0), q1 = p1.clone().addScaledVector(a, ext1), L = len + ext0 + ext1;
  for (let j = 0; j <= rings; j++) {
    const t = j / rings, p = q0.clone().addScaledVector(a, L * t), rr = r0 + (r1 - r0) * Math.min(1, Math.max(0, (t * L - ext0) / len));
    for (let k = 0; k <= seg; k++) { const an = (k / seg) * TAU; pos.push(p.x + s.x * Math.cos(an) * rr + f.x * Math.sin(an) * rr * squash, p.y + s.y * Math.cos(an) * rr + f.y * Math.sin(an) * rr * squash, p.z + s.z * Math.cos(an) * rr + f.z * Math.sin(an) * rr * squash); uv.push(k / seg, t); }
  }
  void q1;
  for (let j = 0; j < rings; j++) for (let k = 0; k < seg; k++) { const i = j * (seg + 1) + k, i2 = i + seg + 1; idx.push(i, i + 1, i2, i + 1, i2 + 1, i2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Bake a rest-world geometry into a bone's local space and add it as a child.
function bakeTo(bone, geo, mat, o = {}) {
  bone.updateWorldMatrix(true, false);
  geo.applyMatrix4(new THREE.Matrix4().copy(bone.matrixWorld).invert());
  const m = new THREE.Mesh(geo, mat); m.castShadow = o.cast !== false; m.receiveShadow = true; m.frustumCulled = false; bone.add(m);
  return m;
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const wp = (bone) => bone.getWorldPosition(new THREE.Vector3());

// ---- materials -------------------------------------------------------------------------------------------------------------------------
export function makeMats() {
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
  const linenT = tex(linenCanvas(), { repeat: [2, 1] });
  return {
    silver: std('#d6d8dc', { metalness: 0.95, roughness: 0.28, envMapIntensity: 1.2 }),
    gold: std('#e0b04a', { metalness: 0.9, roughness: 0.3, envMapIntensity: 1.2 }),
    iron: std('#2a2624', { metalness: 0.8, roughness: 0.5 }),
    bone: std('#efe4c8', { roughness: 0.5 }),
    clay: std('#8a4a2c', { roughness: 0.62 }),
    linen: new THREE.MeshStandardMaterial({ map: linenT, color: '#c9bfae', roughness: 0.95 }),
    wine: new THREE.MeshPhysicalMaterial({ color: '#4a0614', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 }),
    grape: new THREE.MeshPhysicalMaterial({ color: '#3a1348', roughness: 0.3, clearcoat: 0.8 }),
    bread: std('#c58a46', { roughness: 0.8 }),
    leather: std('#2a1a10', { roughness: 0.55 }),
    cord: std('#b03030', { roughness: 0.8 }),
  };
}

// ---- the setting (wall, sky, pergola, lanterns, table and its props) ------------------------------------------------------------------
export function buildSetting(scene, { tier = 2 } = {}) {
  const M = makeMats(), G = new THREE.Group(); G.name = 'setting'; scene.add(G);
  const out = { group: G, lanterns: [], mats: M, fx: {} };
  // sky + mountains (a far plane, no fog)
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(90, 20), new THREE.MeshBasicMaterial({ map: tex(skyCanvas()), fog: false, toneMapped: false }));
  sky.position.set(0, 7.2, -14); G.add(sky);
  // the arcade wall with three arched openings that show the sky
  {
    const { map, bump } = stoneWallCanvas(1024, 512, 5);
    const W = 1536, H = 640, wc = cv(W, H), x = wc.getContext('2d');
    x.drawImage(map, 0, 0, W, H);
    const bc = cv(W, H), bx = bc.getContext('2d'); bx.drawImage(bump, 0, 0, W, H);
    const arches = [-0.31, 0, 0.31];
    for (const cxN of arches) {
      const cx = W / 2 + cxN * W, aw = 190, base = H * 0.96, top = H * 0.22;
      for (const ctx2 of [x, bx]) {
        ctx2.save(); ctx2.globalCompositeOperation = 'destination-out'; ctx2.beginPath(); ctx2.moveTo(cx - aw, base); ctx2.lineTo(cx - aw, top + aw); ctx2.arc(cx, top + aw, aw, Math.PI, 0); ctx2.lineTo(cx + aw, base); ctx2.closePath(); ctx2.fill(); ctx2.restore();
      }
    }
    const t = tex(wc), tb = tex(bc, { linear: true });
    const wallMat = new THREE.MeshStandardMaterial({ map: t, bumpMap: tb, bumpScale: 2.2, roughness: 0.92, transparent: false, alphaTest: 0.5, side: THREE.DoubleSide });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 4.0), wallMat); wall.position.set(0, 2.0, -2.2); wall.receiveShadow = true; wall.castShadow = false; G.add(wall);
    for (const dx of [-9.6, 9.6, -19.2, 19.2]) { const w2 = new THREE.Mesh(wall.geometry, wallMat); w2.position.set(dx, 2.0, -2.2); w2.receiveShadow = true; G.add(w2); }
    out.wall = wall;
    // arch piers with an ochre plaster face and timber lintel
    const lint = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.16, 0.34), B.material('darkWood', { color: '#2a170c', color2: '#4a2c16', repeat: [6, 1], seed: 4 })); lint.position.set(0, 3.9, -2.05); lint.castShadow = true; G.add(lint);
  }
  // courtyard floor: pale cobbles
  {
    const c = cv(512), x = c.getContext('2d'), r = rngOf(17); x.fillStyle = '#5a4c42'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) { const px = r() * 512, py = r() * 512, rr = 14 + r() * 18, k = 0.75 + r() * 0.5; x.fillStyle = `rgb(${130 * k | 0},${112 * k | 0},${96 * k | 0})`; x.beginPath(); x.ellipse(px, py, rr, rr * 0.8, r() * 3, 0, TAU); x.fill(); }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), new THREE.MeshStandardMaterial({ map: tex(c, { repeat: [20, 7] }), roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -2.5); floor.receiveShadow = true; G.add(floor);
  }
  // pergola: posts, beams and hanging vines with grapes
  {
    const wood = B.material('darkWood', { color: '#2a170c', color2: '#4a2c16', repeat: [1, 3], seed: 21 });
    for (const x of [-2.6, 2.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 3.0, 10), wood); p.position.set(x, 1.5, -0.9); p.castShadow = true; G.add(p); }
    for (const z of [-0.9, -1.6]) { const b = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.1, 0.12), wood); b.position.set(0, 3.0, z); b.castShadow = true; G.add(b); }
    for (let i = 0; i < 9; i++) { const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.9), wood); rafter.position.set(-2.4 + i * 0.6, 3.08, -1.25); rafter.castShadow = true; G.add(rafter); }
    const leafMat = new THREE.MeshStandardMaterial({ map: tex(leafCanvas()), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
    const n = tier >= 1 ? 90 : 40, leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.3), leafMat, n);
    const r = rngOf(8), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = V3(), ps = V3();
    for (let i = 0; i < n; i++) {
      ps.set((r() - 0.5) * 5.4, 2.55 + r() * 0.5, -0.8 - r() * 0.9); e.set((r() - 0.5) * 1.2 - 0.3, (r() - 0.5) * 3, (r() - 0.5) * 1.2); q.setFromEuler(e); sc.setScalar(0.7 + r() * 0.8); m4.compose(ps, q, sc); leaves.setMatrixAt(i, m4);
    }
    leaves.castShadow = false; G.add(leaves);
    for (let i = 0; i < 7; i++) {
      const gb = new THREE.Group(), gx = -2.2 + i * 0.72 + r() * 0.2; gb.position.set(gx, 2.55 - r() * 0.15, -0.95 - r() * 0.5);
      for (let k = 0; k < 14; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), M.grape); s.position.set((r() - 0.5) * 0.09, -k * 0.012 - Math.abs((r() - 0.5)) * 0.05, (r() - 0.5) * 0.09); gb.add(s); }
      G.add(gb);
    }
  }
  // iron lanterns (glass lit from inside) hanging from the pergola
  for (const [x, y, z] of [[-1.5, 2.35, -0.55], [1.5, 2.35, -0.55], [0, 2.5, -1.2]]) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 3.0 - y, 5), M.iron); chain.position.y = (3.0 - y) / 2 + 0.12; g.add(chain);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.1, 0.08, 6), M.iron); cap.position.y = 0.13; g.add(cap);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.2, 6, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
    g.add(glass);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff2c0', toneMapped: false })); g.add(flame);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.04, 6), M.iron); base.position.y = -0.12; g.add(base);
    for (let k = 0; k < 6; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.22, 0.008), M.iron); const a = (k / 6) * TAU; bar.position.set(Math.cos(a) * 0.066, 0, Math.sin(a) * 0.066); g.add(bar); }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(blobCanvas('255,200,120', 1, 128)), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.set(1.1, 1.1, 1); g.add(halo);
    G.add(g);
    out.lanterns.push({ g, halo, flame, glass, y0: y, x0: x, z0: z });
  }
  // the supra table: plank top, linen cloth to the floor
  {
    const topMat = B.material('wood', { color: '#6a4122', color2: '#a0683a', repeat: [4, 1], seed: 12 });
    const top = new THREE.Mesh(B.slab(6.0, 0.95, 0.05, 0.03, 0.01), topMat); top.position.set(0, 0.76, 0.78); top.castShadow = true; top.receiveShadow = true; G.add(top);
    const cloth = new THREE.Mesh(B.slab(5.9, 0.9, 0.012, 0.01, 0.004), M.linen); cloth.position.set(0, 0.812, 0.78); cloth.receiveShadow = true; G.add(cloth);
    const drape = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.62, 0.012), M.linen); drape.position.set(0, 0.5, 1.255); drape.castShadow = true; G.add(drape);
    // runner: embroidered stripe along the table
    const run = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.22), new THREE.MeshStandardMaterial({ color: '#7a1c24', roughness: 0.9 })); run.rotation.x = -Math.PI / 2; run.position.set(0, 0.8265, 0.78); G.add(run);
  }
  // props on the table
  {
    const ty = 0.826;
    // the wine horn (kantsi): a curved tube on a small wooden stand, silver rim and band
    const curve = new THREE.CatmullRomCurve3([V3(-0.2, 0.0, 0), V3(-0.08, -0.02, 0.02), V3(0.06, 0.05, 0.02), V3(0.18, 0.17, 0.0), V3(0.2, 0.24, -0.02)]);
    const horn = new THREE.Group();
    const hornMat = new THREE.MeshPhysicalMaterial({ color: '#d9c9a2', roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    const hg = new THREE.TubeGeometry(curve, 26, 0.03, 12); const hp = hg.attributes.position, tt = hg.parameters.tubularSegments + 1;
    for (let i = 0; i < hp.count; i++) { const ring = Math.floor(i / 13), k = 0.45 + 0.55 * (ring / (tt - 1)); const p = curve.getPoint(Math.min(1, ring / (tt - 1))); hp.setXYZ(i, p.x + (hp.getX(i) - p.x) * k, p.y + (hp.getY(i) - p.y) * k, p.z + (hp.getZ(i) - p.z) * k); }
    hg.computeVertexNormals();
    const body = new THREE.Mesh(hg, hornMat); body.castShadow = true; horn.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.008, 8, 18), M.silver); rim.position.copy(curve.getPoint(1)); const tg = curve.getTangent(1); rim.quaternion.setFromUnitVectors(V3(0, 0, 1), tg); horn.add(rim);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.007, 8, 18), M.silver); band.position.copy(curve.getPoint(0.55)); band.quaternion.setFromUnitVectors(V3(0, 0, 1), curve.getTangent(0.55)); horn.add(band);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), M.silver); tip.position.copy(curve.getPoint(0)); horn.add(tip);
    const stand = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 14, Math.PI), M.leather); stand.position.set(0.0, -0.005, 0.01); stand.rotation.y = Math.PI / 2; horn.add(stand);
    horn.position.set(-1.05, ty + 0.04, 0.6); horn.rotation.y = 0.35; G.add(horn);
    // clay jug (qvevri-shaped)
    const jug = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.07, 0], [0.12, 0.08], [0.14, 0.2], [0.1, 0.32], [0.045, 0.4], [0.05, 0.46], [0.065, 0.48], [0.05, 0.485]].map(([r, y]) => new THREE.Vector2(r, y)), 24), M.clay);
    jug.position.set(1.15, ty, 0.55); jug.castShadow = true; G.add(jug);
    // cups (wooden bowls) with wine
    for (const [x, z] of [[-0.45, 0.62], [0.35, 0.58], [0.7, 0.7], [-1.6, 0.7]]) {
      const cup = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.025, 0], [0.045, 0.012], [0.06, 0.045], [0.058, 0.05], [0.045, 0.02], [0.0, 0.01]].map(([r, y]) => new THREE.Vector2(r, y)), 18), B.material('wood', { color: '#4a2a14', color2: '#7a4a24', seed: 5 }));
      cup.position.set(x, ty, z); cup.castShadow = true; G.add(cup);
      const wine = new THREE.Mesh(new THREE.CircleGeometry(0.052, 18), M.wine); wine.rotation.x = -Math.PI / 2; wine.position.set(x, ty + 0.036, z); G.add(wine);
      (out.wines ||= []).push(wine);
    }
    // bread (shoti) and grapes
    for (const [x, z, ry] of [[0.0, 0.52, 0.2], [-0.78, 0.5, -0.4]]) {
      const shoti = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12), M.bread); shoti.scale.set(1.5, 0.38, 0.52); shoti.position.set(x, ty + 0.035, z); shoti.rotation.y = ry; shoti.castShadow = true; G.add(shoti);
    }
    const gr = rngOf(4);
    for (const [bx, bz] of [[0.95, 0.9], [-1.3, 0.95]]) {
      const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.12, 0.035], [0.14, 0.07], [0.13, 0.07], [0.1, 0.04], [0.0, 0.015]].map(([r, y]) => new THREE.Vector2(r, y)), 20), M.clay); bowl.position.set(bx, ty, bz); bowl.castShadow = true; G.add(bowl);
      for (let k = 0; k < 22; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), M.grape); const a = gr() * TAU, rr = gr() * 0.08; s.position.set(bx + Math.cos(a) * rr, ty + 0.06 + gr() * 0.05, bz + Math.sin(a) * rr); s.castShadow = true; G.add(s); }
    }
  }
  // dust motes / fireflies drifting in the lantern light
  {
    const n = 46, pos = new Float32Array(n * 3), r = rngOf(77);
    for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 6; pos[i * 3 + 1] = 0.9 + r() * 2.4; pos[i * 3 + 2] = -1.8 + r() * 3.0; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: tex(blobCanvas('255,226,150', 1, 32)), size: 0.07, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true }));
    pts.frustumCulled = false; G.add(pts); out.motes = pts;
  }
  return out;
}

// ---- the singers -----------------------------------------------------------------------------------------------------------------------
const lerpArr = (a, b, t) => a.map((r, i) => r.map((v, k) => v + (b[i][k] - v) * t));
export function fingerPose(FP, open01) {   // open01: 0 relaxed .. 1 open (custom pose accepted by human.setFingers)
  return { curl: lerpArr(FP.relaxed.curl, FP.open.curl, open01), spread: FP.relaxed.spread.map((v, i) => v + (FP.open.spread[i] - v) * open01) };
}

export async function buildSinger(scene, spec, { base, quality = 'high' } = {}) {
  const h = await loadHuman({ character: spec.gender === 'f' ? 'athlete_f' : 'athlete_m', skin: spec.skin, hair: spec.hair, kit: { top: spec.coat, bottoms: '#1a1410', socks: '#1a1410', shoes: '#120c08' }, ...(base ? { base } : {}), ...(quality === 'low' ? { lod: 'medium' } : {}) });
  scene.add(h.root);
  h.setPosition(spec.x, 0, 0); h.setFacing(0);
  h.root.scale.setScalar(spec.scale || 1);
  h.play('idle_relaxed' in h.clips ? 'idle_relaxed' : 'idle');
  h.update(0);
  h.root.updateMatrixWorld(true);
  const S = { spec, human: h, bones: h.bones, M: makeMats() };
  const b = (n) => h.bones['Bip01_' + n];
  const female = spec.gender === 'f';
  // --- key rest-world anchors (rest pose at load; character facing +Z, arms down)
  const sc = spec.scale || 1;
  const P = { pel: wp(b('Pelvis')), s1: wp(b('Spine1')), s2: wp(b('Spine2')), neck: wp(b('Neck')), head: wp(b('Head')), lSh: wp(b('L_UpperArm')), lEl: wp(b('L_Forearm')), lWr: wp(b('L_Hand')), rSh: wp(b('R_UpperArm')), rEl: wp(b('R_Forearm')), rWr: wp(b('R_Hand')) };
  const mats = {
    coat: B.material('cloth', { color: spec.coat, color2: spec.coat2, repeat: [3, 3], seed: 3 + SINGERS.indexOf(spec) }),
    inner: new THREE.MeshStandardMaterial({ color: spec.inner, roughness: 0.8 }),
    trim: new THREE.MeshStandardMaterial({ color: spec.col, roughness: 0.5, metalness: 0.2 }),
  };
  mats.coat.side = THREE.DoubleSide;
  // --- torso: a lofted coat from belt to collar
  const torso = [];
  const yAt = (f) => P.pel.y + f * (P.neck.y - P.pel.y);
  const prof = female
    ? [[-0.05, 0.150, 0.105], [0.06, 0.150, 0.104], [0.2, 0.140, 0.100], [0.38, 0.165, 0.118], [0.58, 0.185, 0.125], [0.8, 0.205, 0.112], [0.92, 0.16, 0.09], [0.99, 0.085, 0.07], [1.06, 0.056, 0.056]]
    : [[-0.05, 0.178, 0.126], [0.06, 0.182, 0.130], [0.22, 0.176, 0.126], [0.4, 0.198, 0.138], [0.6, 0.218, 0.142], [0.8, 0.238, 0.124], [0.92, 0.19, 0.10], [0.99, 0.10, 0.08], [1.06, 0.062, 0.062]];
  for (const [f, rx, rz] of prof) { const y = yAt(f), t = Math.min(1, Math.max(0, (y - P.pel.y) / (P.neck.y - P.pel.y))); torso.push({ c: V3(P.pel.x + (P.neck.x - P.pel.x) * t, y, P.pel.z - 0.005 + (P.neck.z - P.pel.z) * t), rx: rx * 1.0, rz }); }
  const cCoat = new THREE.Color(spec.coat), cInner = new THREE.Color(spec.inner), cTrim = new THREE.Color(spec.col);
  const tg = loft(torso, 64, { colorFn: (c, lx, lz, y, t) => {
    const front = lz > 0.0, hw = female ? 0.026 : 0.022;
    if (front && Math.abs(lx) < hw) c.copy(cInner);
    else if (front && Math.abs(lx) < hw + 0.011) c.copy(cTrim);
    else c.copy(cCoat);
    void t;
  } });
  const coatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide, bumpMap: mats.coat.bumpMap, bumpScale: 0.6 });
  S.coatMesh = bakeTo(b('Spine1'), tg, coatMat);
  // dress skirt for the woman (flares to the table top; hidden below it)
  if (female) {
    const sk = [[0.0, 0.15, 0.105], [-0.12, 0.2, 0.14], [-0.35, 0.3, 0.22], [-0.7, 0.42, 0.34]].map(([d, rx, rz]) => ({ c: V3(P.pel.x, P.pel.y + d, P.pel.z), rx, rz })).reverse();
    bakeTo(b('Pelvis'), loft(sk, 20), mats.coat);
  } else {
    const sk = [[0.03, 0.18, 0.13], [-0.12, 0.23, 0.17], [-0.34, 0.30, 0.23], [-0.58, 0.36, 0.28]].map(([d, rx, rz]) => ({ c: V3(P.pel.x, P.pel.y + d, P.pel.z), rx, rz })).reverse();
    bakeTo(b('Pelvis'), loft(sk, 20), mats.coat);
  }
  // standing collar round the neck base
  {
    const cy = P.neck.y - 0.045, rings = [0, 0.04, 0.085].map((d, j) => ({ c: V3(P.neck.x, cy + d, P.neck.z + 0.005), rx: (female ? 0.062 : 0.07) - j * 0.004, rz: (female ? 0.058 : 0.066) - j * 0.004 }));
    const m = bakeTo(b('Neck'), loft(rings, 24), new THREE.MeshStandardMaterial({ color: spec.inner, roughness: 0.7, side: THREE.DoubleSide }));
    m.castShadow = false;
  }
  // gazyrs: two rows of cartridge holders on the chest (ivory body, silver caps)
  if (!female) {
    const gz = new THREE.Group();
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const xx = side * (0.06 + i * 0.03), yy = yAt(0.64) - Math.abs(xx) * 0.12, cz = 0.138 * Math.sqrt(Math.max(0.05, 1 - (xx / 0.205) ** 2)) + 0.01;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.09, 8), new THREE.MeshStandardMaterial({ color: '#cbbd9a', roughness: 0.5 })); body.position.set(P.neck.x + xx, yy + 0.02, P.pel.z + cz); body.rotation.z = side * -0.1; body.rotation.y = side * -0.15 * Math.abs(xx) / 0.2; body.castShadow = true;
      const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.012, 8), S.M.silver); capT.position.y = 0.047; body.add(capT);
      const capB = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.012, 8), S.M.silver); capB.position.y = -0.047; body.add(capB);
      gz.add(body);
    }
    const sp1 = b('Spine1'); sp1.updateWorldMatrix(true, false); sp1.add(gz); gz.applyMatrix4(new THREE.Matrix4().copy(sp1.matrixWorld).invert());
  }
  // belt, silver plates and the kinjal (dagger) at the waist
  {
    const by = P.pel.y + 0.06, beltR = female ? 0.152 : 0.184;
    const belt = new THREE.Mesh(new THREE.TorusGeometry(1, 0.026, 8, 30), mats.inner); belt.material = S.M.leather; belt.scale.set(beltR, female ? 0.105 : 0.13, 1); belt.rotation.x = Math.PI / 2;
    belt.position.set(P.pel.x, by, P.pel.z); belt.castShadow = true;
    const bg = new THREE.Group(); bg.add(belt);
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.18 + i * 0.083); const plate = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.034, 0.008), S.M.silver); plate.position.set(P.pel.x + Math.cos(a) * beltR, by, P.pel.z + Math.sin(a) * (female ? 0.105 : 0.13) + 0.008); plate.rotation.y = -(a - Math.PI / 2) * 0.9; bg.add(plate); }
    const kin = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.008), S.M.silver); blade.position.y = -0.14; kin.add(blade);
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.1, 8), S.M.bone); hilt.position.y = 0.02; kin.add(hilt);
    kin.position.set(P.pel.x + 0.03, by - 0.02, P.pel.z + (female ? 0.12 : 0.145)); kin.rotation.z = 0.35; kin.rotation.x = -0.1; bg.add(kin);
    bg.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    // add into the Spine1 bone in rest-world form
    const sp = b('Spine1'); sp.add(bg); bg.applyMatrix4(new THREE.Matrix4().copy(sp.matrixWorld).invert());
  }
  // sleeves + shoulder caps + cuffs
  for (const side of ['L', 'R']) {
    const sh = P[side.toLowerCase() + 'Sh'], el = P[side.toLowerCase() + 'El'], wr = P[side.toLowerCase() + 'Wr'];
    const cap = new THREE.SphereGeometry(female ? 0.066 : 0.078, 14, 10); cap.translate(sh.x, sh.y - 0.005, sh.z);
    bakeTo(b(side + '_UpperArm'), cap, mats.coat);
    const up = tube(sh.clone().add(V3(0, 0.01, 0)), el, female ? 0.056 : 0.066, female ? 0.047 : 0.054, { ext1: 0.02, front: V3(0, 0, 1) });
    bakeTo(b(side + '_UpperArm'), up, mats.coat);
    const fo = tube(el, wr.clone().lerp(el, 0.12), female ? 0.047 : 0.054, female ? 0.040 : 0.045, { ext0: 0.02, front: V3(0, 0, 1) });
    bakeTo(b(side + '_Forearm'), fo, mats.coat);
    const cu = tube(wr.clone().lerp(el, 0.17), wr.clone().lerp(el, 0.06), female ? 0.043 : 0.048, female ? 0.043 : 0.048, { seg: 14, rings: 1, front: V3(0, 0, 1) });
    bakeTo(b(side + '_Forearm'), cu, S.M.gold, { cast: false });
  }
  // headgear + face hair
  const hb = b('Head');
  if (spec.hat === 'papakha') {
    const prof2 = [[0, 0], [0.106, 0], [0.114, 0.025], [0.118, 0.07], [0.112, 0.13], [0.092, 0.18], [0.05, 0.205], [0, 0.21]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(prof2, 28);
    g.rotateX(-0.06); g.translate(P.head.x, P.head.y + 0.115, P.head.z + 0.0);
    const fur = new THREE.MeshStandardMaterial({ map: tex(furCanvas(256, [42, 34, 30], 5), { repeat: [3, 2] }), roughness: 1, bumpMap: tex(furCanvas(256, [110, 110, 110], 9), { repeat: [3, 2], linear: true }), bumpScale: 1.2 });
    S.hat = bakeTo(hb, g, fur);
  } else if (spec.hat === 'veil') {
    // lechaki: a white veil falling from a gold band behind the head over the shoulders (swings with a damped lag)
    const piv = new THREE.Group(); const restPos = V3(P.head.x, P.head.y + 0.1, P.head.z - 0.03);
    const vg = new THREE.PlaneGeometry(0.30, 0.34, 8, 8), vp = vg.attributes.position;
    for (let i = 0; i < vp.count; i++) { const x = vp.getX(i), y = vp.getY(i); const u = (0.17 - y) / 0.34; vp.setXYZ(i, x * (1 + u * 0.5), y - 0.17, -0.085 - 0.07 * Math.sin(Math.min(1, u * 1.2) * Math.PI * 0.55) - Math.abs(x) * 0.25 * (1 - u * 0.5) + (Math.abs(x) > 0.1 ? 0.05 : 0)); }
    vg.computeVertexNormals();
    const vm = new THREE.Mesh(vg, new THREE.MeshStandardMaterial({ color: '#f2ede2', roughness: 0.9, side: THREE.DoubleSide })); vm.visible = false; piv.add(vm);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 28, Math.PI * 1.45), S.M.gold); band.rotation.set(Math.PI / 2 - 0.1, 0, Math.PI * 0.78); band.position.set(0, 0.0, 0.04); piv.add(band);
    const rest = restPos;
    const holder = new THREE.Group(); holder.add(piv); piv.position.set(0, 0, 0);
    hb.add(holder); holder.position.copy(hb.worldToLocal(rest)); holder.quaternion.copy(hb.getWorldQuaternion(new THREE.Quaternion()).invert());
    S.veil = piv;
  }
  if (spec.beard) {
    const fur = new THREE.MeshStandardMaterial({ map: tex(furCanvas(128, [150, 148, 144], 6), { repeat: [1, 1] }), roughness: 1 });
    const g = new THREE.SphereGeometry(1, 16, 12); g.scale(0.001, 0.001, 0.001);
    const mg = new THREE.TorusGeometry(0.036, 0.011, 6, 14, Math.PI); mg.rotateZ(Math.PI); mg.translate(P.head.x, P.head.y + 0.077, P.head.z + 0.093);
    bakeTo(hb, mg, fur, { cast: false });
  }
  // the mouth: opens with the sung vowel (a dark lipped ellipse placed on the face just proud of the skin)
  {
    const mat = new THREE.MeshBasicMaterial({ map: tex(mouthCanvas()), transparent: true, depthWrite: false, depthTest: !(new URLSearchParams(location.search).has('mdbg')), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.renderOrder = 6;
    const holder = new THREE.Group();
    holder.add(m);
    hb.updateWorldMatrix(true, false);
    holder.position.copy(hb.worldToLocal(V3(P.head.x, P.head.y + (female ? 0.024 : 0.029), P.head.z + (female ? 0.118 : 0.126))));
    holder.quaternion.copy(hb.getWorldQuaternion(new THREE.Quaternion()).invert());
    hb.add(holder);
    m.scale.set(0.001, 0.001, 1);
    S.mouth = m; S.mouthHolder = holder;
  }
  S.P = P; S.fp = null;
  return S;
}

// Everything under the stage: contact shadow blobs are cheap and read well on the cloth.
export function floorBlob(scene, x, z, r = 0.5) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(blobCanvas('0,0,0', 0.65, 64)), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.01, z); m.scale.set(r * 2, r * 2, 1); scene.add(m); return m;
}
export { tick, tex, cv, THREE, B };
