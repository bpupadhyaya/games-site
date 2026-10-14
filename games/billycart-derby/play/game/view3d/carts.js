// Real 3D billycarts, drivers and spectators (presentation only: it reads numbers the 2D scene already has and never writes back).
//
// The shared view3d layer supplies the people (athlete_m / athlete_f), the stage and the IK; this file dresses them (racing overalls, gloves,
// boots, a hard-shell helmet), builds each cart from the player's real build (wheel type, frame, steering, brake, ballast), seats the driver
// with both hands on the ropes (or the wheel) and both feet on the front axle, and renders one cart at a time into a small transparent
// off-screen WebGL canvas that src/art.js composites into the 2D road scene (globalThis.__cart3d). Spectators are rendered once per
// (variety, animation frame, size) and cached as small bitmaps, so a crowd costs almost nothing after warm-up.
import { createStage, loadHuman, Clip, CLIP_BONES, semanticRot, THREE } from '../vendor3d/index.js';

const { Vector3, Quaternion, Euler, Matrix4 } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const strHash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003; return h; };
const MAX_POOL = 7;

// picture regions (metres in the image plane, origin = the cart's ground point under the rear axle)
export const REGION_BACK = { x0: -1.25, y0: -0.12, w: 2.9, h: 2.75 };
export const REGION_SIDE = { x0: -1.9, y0: -0.1, w: 3.6, h: 2.1 };
const DARK = '#1c2230';

const LOOKS = [
  { skin: 'light', hair: 'brown' }, { skin: 'tan', hair: 'black' }, { skin: 'light', hair: 'blond' }, { skin: 'brown', hair: 'black' },
  { skin: 'light', hair: 'ginger' }, { skin: 'tan', hair: 'brown' }, { skin: 'deep', hair: 'black' }, { skin: 'light', hair: 'grey' },
];
const FEM_NAMES = new Set(['Tilly', 'Dot', 'Ange', 'Josie', 'Marnie', 'Poppy', 'Ruby', 'Kez', 'Lou', 'Mia', 'Ella', 'Jess', 'Abby', 'Sam', 'Nell', 'Bec', 'Chloe', 'Yasmin', 'Zoe']);

// ---------------------------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------------------
// Winter clothes by repainting the body texture. Every triangle of the skinned body is classed by the bone that moves it most (arm, hand, leg, foot);
// those pixels become light cloth (with the fold shading of the original) and are routed to the kit's top / bottoms / socks tint channels, so
// setKit() colours them. The shared vendored textures stay untouched (a canvas copy per person).
function dress(human) {
  const N = 1024;
  const cls = (name) => (/_(UpperArm|Forearm)$/.test(name) ? 1 : /_(Hand|Finger)/.test(name) ? 3 : /_(Thigh|Calf)$/.test(name) ? 2 : /_(Foot|Toe)/.test(name) ? 3 : /(Clavicle|Spine\d?|Pelvis)$/.test(name) ? 4 : 0);
  const cv = () => { const c = globalThis.document.createElement('canvas'); c.width = c.height = N; return c; };
  const bodyMats = human.mats.filter((m) => m.userData.kind === 'body' && m.map && m.userData.tint);
  if (!bodyMats.length) return;
  const layers = [null, cv(), cv(), cv(), cv()];       // 1 sleeves (top channel), 2 trousers (bottoms channel), 3 gloves + boots (socks channel)
  const gs = layers.map((c) => (c ? c.getContext('2d') : null));
  for (const g of gs) if (g) { g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 2.2; g.lineJoin = 'round'; }
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => bodyMats.includes(m))) return;
    const geo = o.geometry, ix = geo.index, uv = geo.attributes.uv, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    if (!ix || !uv || !si || !sw) return;
    const bones = o.skeleton.bones;
    const vc = new Uint8Array(uv.count);
    for (let v = 0; v < uv.count; v++) {
      const acc = [0, 0, 0, 0, 0];
      for (let k = 0; k < 4; k++) acc[cls(bones[si.getComponent(v, k)].name)] += sw.getComponent(v, k);
      let best = 0; for (let c = 1; c < 5; c++) if (acc[c] > acc[best]) best = c;
      vc[v] = acc[best] > 0.5 ? best : 0;
    }
    const a = ix.array;
    for (let t = 0; t < a.length; t += 3) {
      const c0 = vc[a[t]], c1 = vc[a[t + 1]], c2 = vc[a[t + 2]];
      const nz = [c0, c1, c2].filter((x) => x).sort();
      const c = c0 === c1 || c0 === c2 ? c0 : c1 === c2 ? c1 : nz.length ? nz[0] : 0;     // a triangle that straddles three classes goes to the lowest (arm first)
      if (!c) continue;
      const g = gs[c];
      g.beginPath();
      g.moveTo(uv.getX(a[t]) * N, uv.getY(a[t]) * N); g.lineTo(uv.getX(a[t + 1]) * N, uv.getY(a[t + 1]) * N); g.lineTo(uv.getX(a[t + 2]) * N, uv.getY(a[t + 2]) * N);
      g.closePath(); g.fill(); g.stroke();
    }
  });
  const read = (img) => { const c = cv(); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N); return { c, g, d: g.getImageData(0, 0, N, N) }; };
  const texOf = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
  const L = layers.map((c, i) => (c ? gs[i].getImageData(0, 0, N, N).data : null));
  for (const m of bodyMats) {
    const u = m.userData.tint;
    const A = read(m.map.image), M = read(u.tMask.value.image), K = read(u.tSkin.value.image);
    const a = A.d.data, mk = M.d.data, sk = K.d.data;
    for (let i = 0; i < a.length; i += 4) {
      let c = 0;
      for (let k = 1; k < 4; k++) if (L[k][i + 3] > 110) { c = k; break; }
      if (!c && L[4][i + 3] > 110 && sk[i] > 90) c = 1;             // bare skin on the shoulders and back: the jacket
      if (!c) continue;
      const lum = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
      // soft cloth shading from the original's folds and muscle shadow, kept inside a narrow band so the kit colour reads clean
      const g = clamp(226 + (lum - 150) * 0.3, 170, 250);
      a[i] = g; a[i + 1] = g; a[i + 2] = g; a[i + 3] = 255;
      sk[i] = 0; mk[i] = 0; mk[i + 1] = 0; mk[i + 2] = 0;
      if (c === 1) mk[i] = 255; else if (c === 2) mk[i + 1] = 255; else mk[i + 2] = 255;
    }
    A.g.putImageData(A.d, 0, 0); M.g.putImageData(M.d, 0, 0); K.g.putImageData(K.d, 0, 0);
    m.map = texOf(A.c, true); u.tMask.value = texOf(M.c, false); u.tSkin.value = texOf(K.c, false);
    m.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Geometry helpers: parts are merged per material so a whole cart is a couple of dozen draw calls.
const _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), _s = new Vector3(1, 1, 1);
const mat4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'XYZ')), _s.set(sx, sy, sz));

class Bucket {
  constructor() { this.m = new Map(); }
  add(mat, geo, m) { let a = this.m.get(mat); if (!a) this.m.set(mat, (a = [])); a.push([geo, m]); }
  box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) { this.add(mat, new THREE.BoxGeometry(w, h, d), mat4(x, y, z, rx, ry, rz)); }
  // a cylinder along `axis` ('x'|'y'|'z')
  cyl(mat, r0, r1, len, x, y, z, axis = 'y', seg = 14, open = false) {
    const g = new THREE.CylinderGeometry(r0, r1, len, seg, 1, open);
    const m = axis === 'x' ? mat4(x, y, z, 0, 0, Math.PI / 2) : axis === 'z' ? mat4(x, y, z, Math.PI / 2, 0, 0) : mat4(x, y, z);
    this.add(mat, g, m);
  }
  sphere(mat, r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 14) { this.add(mat, new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), mat4(x, y, z, 0, 0, 0, sx, sy, sz)); }
  // a torus whose axis is x (a wheel tyre), z (a steering wheel) or y
  torus(mat, R, r, x, y, z, axis = 'x', seg = 28, tube = 10, sx = 1, sy = 1, sz = 1) {
    const g = new THREE.TorusGeometry(R, r, tube, seg);
    const m = axis === 'x' ? mat4(x, y, z, 0, Math.PI / 2, 0, sx, sy, sz) : axis === 'y' ? mat4(x, y, z, Math.PI / 2, 0, 0, sx, sy, sz) : mat4(x, y, z, 0, 0, 0, sx, sy, sz);
    this.add(mat, g, m);
  }
  // a rod between two points
  rod(mat, a, b, r, seg = 8) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 1e-6;
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(dx / len, dy / len, dz / len));
    this.add(mat, g, new Matrix4().compose(new Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new Vector3(1, 1, 1)));
  }
  group() {
    const g = new THREE.Group();
    for (const [mat, list] of this.m) {
      let nv = 0, ni = 0;
      for (const [geo] of list) { nv += geo.attributes.position.count; ni += geo.index ? geo.index.count : geo.attributes.position.count; }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
      let vo = 0, io = 0;
      const nm = new THREE.Matrix3();
      for (const [geo, m] of list) {
        const p = geo.attributes.position, n = geo.attributes.normal;
        nm.getNormalMatrix(m);
        const v = new Vector3();
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(m); pos.set([v.x, v.y, v.z], (vo + i) * 3);
          v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (vo + i) * 3);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) idx[io + i] = geo.index.getX(i) + vo; else for (let i = 0; i < p.count; i++) idx[io + i] = i + vo;
        vo += p.count; io += geo.index ? geo.index.count : p.count;
        geo.dispose();
      }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); bg.setIndex(new THREE.BufferAttribute(idx, 1));
      const mesh = new THREE.Mesh(bg, mat); mesh.frustumCulled = false; g.add(mesh);
    }
    this.m.clear();
    return g;
  }
}

const std = (color, rough = 0.7, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

function plateTexture(num, body, accent) {
  const c = globalThis.document.createElement('canvas'); c.width = 192; c.height = 144;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f2e4'; g.fillRect(0, 0, 192, 144);
  g.fillStyle = accent; g.fillRect(0, 0, 192, 22); g.fillRect(0, 122, 192, 22);
  g.fillStyle = '#16181c'; g.font = '900 96px system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(num || ''), 96, 74);
  g.strokeStyle = '#16181c'; g.lineWidth = 6; g.strokeRect(3, 3, 186, 138);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---- wheels (axle along x, centre at the origin) ----
const WHEEL = { pram: { R: 0.215, W: 0.055 }, spoke: { R: 0.31, W: 0.065 }, pneu: { R: 0.345, W: 0.15 }, racer: { R: 0.175, W: 0.085 } };
function buildWheel(type, M) {
  const { R, W } = WHEEL[type] || WHEEL.spoke, B = new Bucket();
  if (type === 'pram') {
    B.torus(M.rubber, R - 0.02, 0.022, 0, 0, 0, 'x', 32, 10);
    B.torus(M.chrome, R - 0.045, 0.008, 0, 0, 0, 'x', 28, 6);
    B.cyl(M.chrome, 0.03, 0.03, W + 0.03, 0, 0, 0, 'x', 12);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; B.rod(M.chrome, [0, 0, 0], [0, Math.cos(a) * (R - 0.05), Math.sin(a) * (R - 0.05)], 0.0035, 4); }
  } else if (type === 'spoke') {
    B.torus(M.woodDark, R - 0.04, 0.028, 0, 0, 0, 'x', 32, 8, 1.15, 1, 1);          // felloe
    B.cyl(M.iron, R - 0.004, R - 0.004, W, 0, 0, 0, 'x', 32, true);                     // iron tyre band
    B.cyl(M.iron, R - 0.02, R - 0.02, W * 0.96, 0, 0, 0, 'x', 32, true);
    B.cyl(M.wood, 0.05, 0.05, W + 0.07, 0, 0, 0, 'x', 14);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; B.rod(M.wood, [0, Math.cos(a) * 0.045, Math.sin(a) * 0.045], [0, Math.cos(a) * (R - 0.06), Math.sin(a) * (R - 0.06)], 0.013, 6); }
  } else if (type === 'pneu') {
    B.torus(M.rubber, R - 0.075, 0.078, 0, 0, 0, 'x', 32, 14, 1.0, 1, 1);
    for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2, rr = R + 0.002; B.box(M.rubberLug, W * 0.7, 0.014, 0.03, 0, Math.cos(a) * rr, Math.sin(a) * rr, a, 0, 0); }
    B.cyl(M.rimLight, R - 0.13, R - 0.13, W * 0.55, 0, 0, 0, 'x', 28);
    B.cyl(M.chrome, 0.05, 0.05, W * 0.8, 0, 0, 0, 'x', 14);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; B.rod(M.rubberLug, [W * 0.32, 0, 0], [W * 0.32, Math.cos(a) * (R - 0.17), Math.sin(a) * (R - 0.17)], 0.01, 5); }
  } else {            // bearing racers: small hard wheels, a bright disc and a steel hub
    B.cyl(M.rubberHard, R, R, W, 0, 0, 0, 'x', 32);
    B.cyl(M.disc, R * 0.78, R * 0.78, W + 0.012, 0, 0, 0, 'x', 28);
    B.cyl(M.chrome, 0.03, 0.03, W + 0.05, 0, 0, 0, 'x', 12);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; B.box(M.rubber, W + 0.02, 0.05, 0.05, 0, Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, a, 0, 0); }
  }
  const g = B.group();
  g.userData.R = R; g.userData.W = W;
  return g;
}

// ---- the cart ----
// Cart space: x to the left of the driver (so the screen's left from behind), y up, z forward; origin on the ground under the rear axle.
function buildCart(o) {
  const body = o.color || '#2f7de0', accent = o.accent || '#ffd36a', type = WHEEL[o.wheels] ? o.wheels : 'spoke';
  const frame = ['plank', 'box', 'beam'].includes(o.frame) ? o.frame : 'box', steer = o.steer || 'pivot', brake = o.brake || 'heel';
  const M = {
    body: std(body, 0.5, 0.05), bodyDark: std(new THREE.Color(body).multiplyScalar(0.62), 0.6, 0.05), trim: std(accent, 0.45, 0.05),
    wood: std('#b57c43', 0.78), woodDark: std('#7d5128', 0.82), woodPale: std('#d9a566', 0.8),
    iron: std('#3a3f47', 0.45, 0.7), steel: std('#aeb7c1', 0.3, 0.85), chrome: std('#dfe5ec', 0.2, 0.95),
    rubber: std('#1c1e22', 0.85), rubberLug: std('#0f1013', 0.9), rubberHard: std('#2b2f36', 0.5, 0.2), rimLight: std('#d6d2c4', 0.55), disc: std('#e9f1fa', 0.35, 0.3),
    cushion: std('#262c38', 0.9), rope: std('#e6d6a8', 0.95), sack: std('#b99a68', 0.95), light: std('#ff2f24', 0.4, 0, { emissive: '#ff2f24', emissiveIntensity: 0 }),
    grip: std('#16181c', 0.9), plate: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, map: plateTexture(o.num, body, accent) }),
  };
  const wd = WHEEL[type], R = wd.R, root = new THREE.Group(), fr = { M };
  const WB = frame === 'plank' ? 1.42 : frame === 'box' ? 1.3 : 1.22;
  const HW = 0.5 + (type === 'pneu' ? 0.03 : 0);
  const DY = R + 0.06;                                // deck height (top of the floorboard / plank)
  const front = WB + 0.28, rear = -0.18;
  const B = new Bucket();

  // rear axle
  B.box(M.woodDark, 2 * HW - wd.W, 0.07, 0.08, 0, R, 0);
  B.cyl(M.iron, 0.02, 0.02, 2 * HW + 0.06, 0, R, 0, 'x', 8);
  // floor / chassis
  if (frame === 'plank') {
    B.box(M.body, 0.34, 0.05, front - rear, 0, DY - 0.025, (front + rear) / 2);
    B.box(M.trim, 0.016, 0.052, front - rear, 0.172, DY - 0.025, (front + rear) / 2); B.box(M.trim, 0.016, 0.052, front - rear, -0.172, DY - 0.025, (front + rear) / 2);
    B.box(M.woodDark, 0.5, 0.05, 0.06, 0, DY - 0.07, 0.0); B.box(M.woodDark, 0.5, 0.05, 0.06, 0, DY - 0.07, 0.7);
    B.box(M.body, 0.34, 0.34, 0.04, 0, DY + 0.17, -0.1);                       // seat back
    B.box(M.trim, 0.34, 0.04, 0.045, 0, DY + 0.35, -0.1);
  } else if (frame === 'box') {
    const L = front - rear, cz = (front + rear) / 2;
    B.box(M.body, 0.72, 0.04, L, 0, DY - 0.02, cz);
    for (const s of [-1, 1]) { B.box(M.body, 0.04, 0.22, L, s * 0.34, DY + 0.1, cz); B.box(M.trim, 0.05, 0.035, L + 0.01, s * 0.34, DY + 0.215, cz); }
    B.box(M.body, 0.72, 0.18, 0.04, 0, DY + 0.08, front);                       // front panel
    B.box(M.trim, 0.74, 0.03, 0.05, 0, DY + 0.18, front);
    B.box(M.body, 0.72, 0.5, 0.045, 0, DY + 0.25, rear + 0.02);                 // back board
    B.box(M.trim, 0.74, 0.04, 0.055, 0, DY + 0.5, rear + 0.02);
    B.box(M.woodDark, 0.5, 0.04, 0.07, 0, DY - 0.06, 0.1); B.box(M.woodDark, 0.5, 0.04, 0.07, 0, DY - 0.06, WB - 0.05);
  } else {
    const L = front - rear, cz = (front + rear) / 2;
    for (const s of [-1, 1]) { B.box(M.woodPale, 0.09, 0.13, L, s * 0.24, DY - 0.065, cz); B.box(M.woodDark, 0.095, 0.02, L, s * 0.24, DY - 0.13, cz); }
    for (const z of [rear + 0.1, 0.45, WB - 0.1, front - 0.08]) B.box(M.wood, 0.66, 0.06, 0.1, 0, DY - 0.03, z);
    B.box(M.body, 0.72, 0.045, 0.62, 0, DY + 0.02, 0.28);                          // seat platform
    B.box(M.body, 0.76, 0.55, 0.05, 0, DY + 0.275, rear + 0.04);                    // tall back board
    B.box(M.trim, 0.78, 0.05, 0.06, 0, DY + 0.55, rear + 0.04);
    B.box(M.body, 0.04, 0.2, 0.62, 0.38, DY + 0.12, 0.28); B.box(M.body, 0.04, 0.2, 0.62, -0.38, DY + 0.12, 0.28);
    B.box(M.trim, 0.05, 0.03, 0.63, 0.38, DY + 0.23, 0.28); B.box(M.trim, 0.05, 0.03, 0.63, -0.38, DY + 0.23, 0.28);
    B.rod(M.iron, [0.0, DY - 0.1, 0.1], [0.0, DY - 0.1, WB], 0.015);
  }
  const seatTop = DY + (frame === 'plank' ? 0.05 : frame === 'box' ? 0.045 : 0.07);
  const cushionH = 0.06;
  B.box(M.cushion, frame === 'plank' ? 0.3 : 0.5, cushionH, 0.42, 0, seatTop + cushionH / 2 - 0.02, 0.32);
  fr.seatTop = seatTop + cushionH - 0.02; fr.seatZ = 0.34; fr.WB = WB; fr.DY = DY; fr.R = R; fr.HW = HW; fr.front = front; fr.rear = rear; fr.frame = frame; fr.steer = steer;

  // number plate on the back board
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.255), M.plate);
  const backZ = frame === 'plank' ? -0.125 : rear - 0.005;
  plate.position.set(0, DY + (frame === 'plank' ? 0.16 : 0.25), backZ - 0.025 - (frame === 'beam' ? 0.02 : 0));
  plate.rotation.y = Math.PI;                                                        // faces backward (-z)
  root.add(plate);
  // brake light on the back board
  const lampY = DY + (frame === 'plank' ? 0.31 : 0.43);
  B.box(M.light, 0.16, 0.05, 0.02, 0, lampY, backZ - 0.03 - (frame === 'beam' ? 0.02 : 0));

  // ballast sack(s): where the weight sits
  const bal = o.bal || 0;
  if (bal !== 0) {
    const n = Math.min(2, Math.abs(bal));
    for (let i = 0; i < n; i++) {
      const z = bal < 0 ? front - 0.3 - i * 0.02 : rear - 0.17 - i * 0.02, x = (i - (n - 1) / 2) * 0.28;
      B.sphere(M.sack, 0.15, x, DY + 0.1 + (bal < 0 ? 0 : 0.0), z, 1.0, 0.62, 0.9, 14);
    }
    if (bal > 0) { B.box(M.woodDark, 0.6, 0.04, 0.34, 0, DY + 0.0, rear - 0.12); }
  }
  // pennant pole at the back corner
  B.rod(M.steel, [-0.34, DY + 0.1, rear + 0.02], [-0.34, DY + 1.55, rear + 0.02], 0.009);
  B.sphere(M.chrome, 0.018, -0.34, DY + 1.56, rear + 0.02);
  root.add(B.group());

  // pennant (cloth ribbon, waved each frame)
  const pn = 6, pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((pn + 1) * 2 * 3), 3));
  const pi = []; for (let i = 0; i < pn; i++) { const a = i * 2; pi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } pg.setIndex(pi);
  const flag = new THREE.Mesh(pg, std(accent === '#ffffff' ? '#ffd36a' : accent, 0.85, 0, { side: THREE.DoubleSide }));
  flag.frustumCulled = false; root.add(flag); fr.flag = flag; fr.flagBase = [-0.34, DY + 1.55, rear + 0.02];

  // rear wheels
  fr.rw = [];
  for (const s of [1, -1]) { const w = buildWheel(type, M); w.position.set(s * HW, R, 0); root.add(w); fr.rw.push(w); }

  // front axle assembly (steers)
  const FA = new THREE.Group(); FA.position.set(0, R, WB);
  { const Bf = new Bucket();
    Bf.box(M.woodDark, 2 * HW - 0.1, 0.075, 0.09, 0, 0, 0);
    Bf.cyl(M.iron, 0.02, 0.02, 2 * HW + 0.06, 0, 0, 0, 'x', 8);
    Bf.cyl(M.iron, 0.04, 0.04, 0.16, 0, 0.09, 0, 'y', 12);                     // kingpin bolt head
    Bf.box(M.iron, 0.14, 0.02, 0.18, 0, 0.055, 0);
    FA.add(Bf.group()); }
  fr.fw = [];
  for (const s of [1, -1]) { const w = buildWheel(type, M); w.position.set(s * HW, 0, 0); FA.add(w); fr.fw.push(w); }
  root.add(FA); fr.FA = FA;

  // steering: ropes from the hands to the axle ends, or a small wheel on a column (tie-rod rack)
  fr.ropes = new Bucket();
  fr.ropeMat = M.rope;
  fr.ropeMeshes = [];
  if (steer === 'tie') {
    const SW = new THREE.Group(); SW.position.set(0, seatTop + 0.4, 0.82); SW.rotation.x = -0.9;
    { const Bs = new Bucket();
      Bs.torus(M.grip, 0.14, 0.017, 0, 0, 0, 'z', 28, 8);
      Bs.cyl(M.steel, 0.026, 0.026, 0.05, 0, 0, 0, 'z', 10);
      Bs.rod(M.steel, [0, 0, 0], [0.14, 0, 0], 0.01, 5); Bs.rod(M.steel, [0, 0, 0], [-0.14, 0, 0], 0.01, 5); Bs.rod(M.steel, [0, 0, 0], [0, -0.14, 0], 0.01, 5);
      SW.add(Bs.group()); }
    root.add(SW); fr.SW = SW;
    const Bc = new Bucket();
    Bc.rod(M.steel, [0, seatTop + 0.4 - 0.0, 0.82], [0, DY, WB - 0.1], 0.016, 8);
    Bc.rod(M.steel, [-HW + 0.06, R, WB + 0.02], [HW - 0.06, R, WB + 0.02], 0.008, 6);
    root.add(Bc.group());
  }
  // brake
  if (brake === 'lever') {
    const LV = new THREE.Group(); LV.position.set(-0.44, Math.max(DY + 0.14, 2 * R + 0.06), 0.12);
    { const Bl = new Bucket();
      Bl.rod(M.wood, [0, 0, 0], [0, 0.42, -0.04], 0.017, 8);
      Bl.cyl(M.grip, 0.024, 0.024, 0.13, 0, 0.47, -0.05, 'y', 10);
      Bl.rod(M.steel, [0, 0, 0], [0, -0.005, -0.3], 0.011, 6);
      Bl.box(M.rubber, 0.07, 0.035, 0.12, 0, -0.02, -0.33);
      LV.add(Bl.group()); }
    root.add(LV); fr.LV = LV;
    const Bp = new Bucket(); Bp.cyl(M.iron, 0.03, 0.03, 0.12, -0.44, LV.position.y, 0.12, 'x', 10); root.add(Bp.group());
  } else {
    const DR = new THREE.Group(); DR.position.set(0, DY - 0.05, rear + 0.02);
    { const Bd = new Bucket();
      Bd.box(M.woodDark, 0.09, 0.05, 0.62, 0, 0, -0.3);
      Bd.box(M.rubber, 0.3, 0.05, 0.2, 0, -0.012, -0.62);
      DR.add(Bd.group()); }
    root.add(DR); fr.DR = DR;
  }
  root.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
  fr.root = root;
  fr.dispose = () => { root.traverse((m) => { if (m.isMesh) m.geometry.dispose(); }); for (const k of Object.keys(M)) { if (M[k].map) M[k].map.dispose(); M[k].dispose(); } };
  return fr;
}

// ---- helmet and cap ----
function headFrame(human) {
  const f = human.boneFrame('Head');
  const m4 = new Matrix4().makeBasis(f.left.clone().normalize(), f.up.clone().normalize(), f.fwd.clone().normalize());
  const q = new Quaternion().setFromRotationMatrix(m4);
  const box = human.headBox;
  const c = box ? box.getCenter(new Vector3()) : new Vector3(0.07, 0, 0);
  const upExt = box ? Math.max(box.max.dot(f.up), box.min.dot(f.up)) : 0.2;
  const top = c.clone().addScaledVector(f.up, upExt - c.dot(f.up));
  return { f, q, top, c };
}
function addHelmet(human, hex) {
  const head = human.bones.Bip01_Head, { f, q, top } = headFrame(human);
  const g = new THREE.Group(); g.quaternion.copy(q);
  const R = 0.135;
  g.position.copy(top).addScaledVector(f.up, -0.045).addScaledVector(f.fwd, -0.012);
  const shell = std(hex, 0.28, 0.1), dark = std('#15181d', 0.7), light = std('#f4f6f8', 0.4);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.6), shell); dome.scale.set(1.0, 0.9, 1.12); g.add(dome);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.995, 0.012, 8, 32), dark); rim.rotation.x = Math.PI / 2; rim.position.y = -R * 0.31 * 0.9; rim.scale.set(0.95, 1.12, 1); rim.scale.x = 0.95; g.add(rim);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(R * 1.005, 0.018, 8, 24, Math.PI), light); stripe.scale.set(0.0001 + 0.12, 0.9, 1.12); stripe.rotation.y = Math.PI / 2; g.add(stripe);
  const peak = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.9, R * 0.95, 0.012, 20, 1, false, -0.9, 1.8), dark); peak.position.set(0, -R * 0.38, R * 0.62); peak.scale.set(1, 1, 0.7); g.add(peak);
  head.add(g);
  return { g, shell };
}
function addCap(human, hex, brim) {
  const head = human.bones.Bip01_Head, { f, q, top } = headFrame(human);
  const g = new THREE.Group(); g.quaternion.copy(q);
  const R = 0.12;
  g.position.copy(top).addScaledVector(f.up, -0.03).addScaledVector(f.fwd, -0.015);
  const m = std(hex, 0.85), dark = std('#2a2118', 0.9);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), m); dome.scale.set(1.0, 0.82, 1.1); g.add(dome);
  if (brim === 'sun') { const b = new THREE.Mesh(new THREE.CylinderGeometry(R * 2.0, R * 2.0, 0.008, 28), std(hex, 0.9)); b.position.y = -R * 0.3; g.add(b); }
  else { const b = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.05, R * 1.2, 0.01, 20, 1, false, -1.0, 2.0), dark); b.position.set(0, -R * 0.28, R * 0.78); b.scale.set(1, 1, 0.85); g.add(b); }
  head.add(g);
  return { g, m };
}

// ---------------------------------------------------------------------------------------------------------------------------------
class Driver {
  constructor(human, who) {
    this.h = human; this.who = who;
    this.clip = new Clip({ name: 'pose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
    human.addClip(this.clip);
    human.groundClamp = 'off'; human.footPlanting = false;
    this.restQ = new Float32Array(human.restPose.q);
    this.e = new Euler(); this.qa = new Quaternion(); this.qb = new Quaternion();
    this.ph = human.pelvisHeight;
    human.play(this.clip, { fade: 0 });
    this.used = 0; this.cart = null; this.cartKey = '';
    this.s = { t: null, kb: 0, u: 0, sh: 0 };
  }
  writePose(offs, pel) {
    const q = this.clip.quats;
    q.set(this.restQ);
    for (const n in offs) {
      const i = bi(n); if (i < 0) continue;
      const r = semanticRot(`Bip01_${n}`, offs[n]);
      this.qa.set(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]);
      this.qb.setFromEuler(this.e.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, 'XYZ'));
      this.qa.multiply(this.qb);
      q[i * 4] = this.qa.x; q[i * 4 + 1] = this.qa.y; q[i * 4 + 2] = this.qa.z; q[i * 4 + 3] = this.qa.w;
    }
    this.clip.pelvis[0] = pel[0] / this.ph; this.clip.pelvis[1] = pel[1] / this.ph; this.clip.pelvis[2] = pel[2] / this.ph;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
export async function createCarts({ quality = 'medium', base } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: false, lighting: 'day', fov: 14 });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  const cam = stage.camera;
  cam.near = 0.5; cam.far = 80;
  const api = { stage, quality, ok: true, lost: false, pool: new Map(), loading: new Map(), clock: 0, bad: new Set(), specs: new Map(), specLoading: new Set(), cache: new Map(), cacheHits: 0, renders: 0 };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; fitted.key = ''; });
  const renderer = stage.renderer;
  const up = new Vector3(0, 1, 0);
  const v = new Vector3();

  const LIGHT = { hemi: 0.78, keyI: 2.5, rimI: 1.3 };
  stage.setLighting('day', LIGHT); stage.setSky(null, null);

  // Camera that maps the metre rectangle `reg` (image plane through the target) onto the canvas, and lands the world origin on its row / column.
  const fitted = { key: '' };
  function frameCamera(reg, devW, devH, c) {
    renderer.setPixelRatio(1); renderer.setSize(devW, devH, false);
    cam.aspect = devW / devH;
    const tgt = new Vector3(0, reg.y0 + reg.h / 2, 0.6);
    let pos;
    if (c.pos) pos = new Vector3(...c.pos);
    else { const D = c.dist, yaw = c.yaw || 0, p = c.pitch || 0; pos = new Vector3(tgt.x + D * Math.sin(yaw) * Math.cos(p), tgt.y + D * Math.sin(p), tgt.z - D * Math.cos(yaw) * Math.cos(p)); }
    const D = pos.distanceTo(tgt);
    cam.fov = 2 * Math.atan(reg.h / 2 / D) / D2R;
    cam.position.copy(pos); cam.lookAt(tgt);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    // shift the projection so world (0,0,0) lands at region-plane (0,0)
    const p0 = new Vector3(0, 0, 0).project(cam);
    const wantX = 2 * (0 - reg.x0) / reg.w - 1, wantY = 2 * (0 - reg.y0) / reg.h - 1;
    const e = cam.projectionMatrix.elements;
    e[8] -= (wantX - p0.x); e[9] -= (wantY - p0.y);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  function render(reg, devW, devH, c) {
    const key = `${reg.x0},${reg.y0},${reg.w},${reg.h},${devW},${devH},${c.pos ? c.pos.join('/') : `${c.dist}/${(c.yaw || 0).toFixed(3)}/${(c.pitch || 0).toFixed(3)}`}`;
    if (fitted.key !== key || renderer.domElement.width !== devW) { frameCamera(reg, devW, devH, c); fitted.key = key; }
    stage.render();
    return renderer.domElement;
  }

  // ---- creation (lazy, one driver per racer name) ----
  async function make(who, o) {
    const fem = FEM_NAMES.has(who);
    const look = LOOKS[strHash(who) % LOOKS.length];
    const human = await loadHuman({ character: fem ? 'athlete_f' : 'athlete_m', base, kit: { top: o.shirt || '#f2b53f', bottoms: '#2a3446', socks: DARK }, skin: look.skin, hair: look.hair });
    dress(human);
    human.setKit({ top: o.shirt || '#f2b53f', bottoms: '#2a3446', socks: DARK });
    const d = new Driver(human, who);
    d.helmet = addHelmet(human, o.helmet || '#d33b2f');
    d.fem = fem;
    stage.add(human);
    d.unit = new THREE.Group(); stage.scene.add(d.unit); d.unit.add(human.root);
    human.root.visible = false; d.unit.visible = false;
    d.ropes = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 1, 6), std('#e6d6a8', 0.95)); m.frustumCulled = false; d.unit.add(m); return m; });
    return d;
  }
  function get(who, o) {
    let r = api.pool.get(who);
    if (r) return r;
    if (!api.loading.has(who) && !api.bad.has(who)) {
      const pr = make(who, o).then((dd) => {
        api.pool.set(who, dd); api.loading.delete(who);
        while (api.pool.size > MAX_POOL) {
          let old = null; for (const [k, x] of api.pool) if (k !== who && (!old || x.used < old[1].used)) old = [k, x];
          if (!old) break;
          const x = old[1]; stage.scene.remove(x.unit); if (x.cart) x.cart.dispose();
          x.h.root.traverse((m) => { if (m.isMesh && m.geometry) m.geometry.dispose(); });
          api.pool.delete(old[0]);
        }
      }).catch((e) => { api.loading.delete(who); api.bad.add(who); console.warn('3D driver failed to load', who, String((e && e.stack) || e)); });
      api.loading.set(who, pr);
    }
    return null;
  }
  const hideAll = () => {
    for (const x of api.pool.values()) x.unit.visible = false;
    for (const x of api.specs.values()) x.h.root.visible = false;
  };

  const GRIP = { curl: [[0.7, 0.8, 0.4], [1.0, 1.25, 0.8], [1.05, 1.3, 0.85], [1.1, 1.35, 0.9], [1.1, 1.35, 0.9]], spread: [0, 0, 0, 0, 0] };

  // ---- pose one driver in one cart from the 2D scene's numbers ----
  function pose(d, o, dt) {
    const S = d.s, h = d.h, C = d.cart;
    const k = dt > 0 ? 1 - Math.exp(-dt / 0.09) : 1;
    S.kb = lerp(S.kb, o.brakeOn ? 1 : 0, k);
    S.u = lerp(S.u, clamp(o.u || 0, -1, 1), k);
    const sp = clamp((o.v || 0) / 14, 0, 1), kb = sstep(S.kb), u = S.u;
    const jolt = Math.sin((o.t || 0) * 38) * clamp(o.rough || 0, 0, 1) * 0.012;
    const ST = C.seatTop;
    const sf = lerp(10 + 8 * sp, -6, kb);                       // trunk flex: leaning in to speed, back on the brake
    const offs = {
      Pelvis: { flex: 2, side: -u * 2 }, Spine: { flex: sf * 0.3, side: -u * 3 }, Spine1: { flex: sf * 0.35, side: -u * 4 }, Spine2: { flex: sf * 0.35, side: -u * 4 },
      Neck: { flex: -sf * 0.5 + 6, side: u * 3 }, Head: { flex: -sf * 0.5 + 2, twist: 0, side: u * 2 },
      L_Thigh: { flex: 84, abduct: 10 }, R_Thigh: { flex: 84, abduct: 10 }, L_Calf: { flex: 70 }, R_Calf: { flex: 70 },
      L_UpperArm: { flex: 40, abduct: 22 }, R_UpperArm: { flex: 40, abduct: 22 }, L_Forearm: { flex: 55 }, R_Forearm: { flex: 55 },
    };
    h.root.position.set(0, 0, C.seatZ);
    h.root.rotation.y = 0; h.facing = 0;
    d.writePose(offs, [0, ST + 0.075 - d.ph + jolt, 0]);
    // feet on the front deck, either side of the steering
    const fy = C.DY + 0.015 + h._ankleRest, fz = C.WB - 0.2 + (C.frame === 'beam' ? 0.0 : 0.04);
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      v.set(sx * 0.17, fy, fz);
      h.setReachFoot(side, v, 1, h._restQ[`${side}_Foot`].clone());
    }
    h.setReach('L', null); h.setReach('R', null);
    h.update(1 / 60);
    // hands: on the ropes (rope, pivot), or on the wheel (tie-rod); the right hand goes to the lever while the brake is pulled
    const hy = ST + 0.40, hz = C.seatZ + 0.48;
    const hands = {};
    if (C.steer === 'tie') {
      const a = -u * 1.0, cx = 0, cy = C.SW.position.y, cz = C.SW.position.z;
      const px = Math.cos(a) * 0.14, py = Math.sin(a) * 0.14 * Math.cos(C.SW.rotation.x), pz = Math.sin(a) * 0.14 * Math.sin(-C.SW.rotation.x) * 0.0;
      hands.L = new Vector3(cx + px, cy + py - 0.0, cz + pz); hands.R = new Vector3(cx - px, cy - py, cz - pz);
      // keep the hands on the rim, forward of the chest
      hands.L.z -= 0.0; hands.R.z -= 0.0;
    } else {
      hands.L = new Vector3(0.2 + u * 0.03, hy - u * 0.0, hz); hands.R = new Vector3(-0.2 + u * 0.03, hy, hz);
    }
    if (C.LV) {
      const top = new Vector3(0, 0.47, -0.05).applyAxisAngle(new Vector3(1, 0, 0), C.LV.rotation.x).add(C.LV.position);
      hands.R.lerp(top, kb);
    }
    for (const side of ['L', 'R']) {
      const t = hands[side], sx = side === 'L' ? 1 : -1;
      const pole = new Vector3(sx * 0.7, t.y - 0.18, (C.seatZ + t.z) / 2 - 0.05);
      h.setReach(side, t, { weight: 1, pole });
      h.setFingers(side, GRIP);
    }
    h.update(0);
    S.t = o.t ?? 0;
    return hands;
  }

  // ---- animate the cart parts ----
  function animateCart(d, o, dt) {
    const C = d.cart, S = d.s;
    const spin = (o.spin || 0) * 0.45;
    for (const w of C.rw) w.rotation.x = spin / C.R;
    for (const w of C.fw) w.rotation.x = spin / C.R;
    const ang = clamp(-S.u, -1, 1) * 0.46;
    C.FA.rotation.y = ang;
    if (C.SW) C.SW.rotation.z = clamp(-S.u, -1, 1) * 1.0;
    const kb = sstep(S.kb);
    if (C.LV) C.LV.rotation.x = lerp(0.12, -0.42, kb);
    if (C.DR) C.DR.visible = kb > 0.06;
    if (C.DR) C.DR.rotation.x = lerp(0.08, -Math.asin(clamp((C.DR.position.y - 0.04) / 0.62, 0, 0.95)), kb);       // the drag pad swings down onto the road
    for (const m of C.root.children) if (m.material && m.material.emissive) m.material.emissiveIntensity = 0;
    C.M.light.emissiveIntensity = kb > 0.4 ? 1.6 : 0.0;
    C.M.light.color.set(kb > 0.4 ? '#ff4a3a' : '#7a1a14');
    // pennant: a ribbon streaming back and fluttering
    const pos = C.flag.geometry.attributes.position, bx = C.flagBase, t = o.t || 0, sp = clamp((o.v || 0) / 12, 0, 1);
    const N = 6, len = 0.5 + 0.12 * sp;
    for (let i = 0; i <= N; i++) {
      const s = i / N, hgt = lerp(0.19, 0.0, s);
      const x = bx[0] - s * 0.42 + Math.sin(t * 9 - s * 5) * 0.03 * s * (0.4 + sp), z = bx[2] - s * len * 0.8;
      const y = bx[1] - 0.04 - 0.05 * s * (1 - sp) + Math.sin(t * 11 - s * 6) * 0.02 * s;
      pos.setXYZ(i * 2, x, y + hgt * 0.5, z); pos.setXYZ(i * 2 + 1, x, y - hgt * 0.5, z);
    }
    pos.needsUpdate = true;
    void dt;
  }
  function updateRopes(d, hands) {
    const C = d.cart;
    if (C.steer === 'tie') { for (const r of d.ropes) r.visible = false; return; }
    const ang = C.FA.rotation.y, c = Math.cos(ang), s = Math.sin(ang);
    const HW = C.HW - 0.07;
    [1, -1].forEach((sx, i) => {
      // axle end in cart space after the steering rotation about the kingpin (0, R, WB)
      const ex = sx * HW * c, ez = C.WB - sx * HW * s * 0 + (-sx * HW * s);
      const a = new Vector3(ex, C.R + 0.04, ez), b = hands[sx === 1 ? 'L' : 'R'];
      const dir = new Vector3().subVectors(b, a), len = dir.length();
      const m = d.ropes[i]; m.visible = true;
      m.position.copy(a).addScaledVector(dir, 0.5); m.scale.set(1, len, 1);
      m.quaternion.setFromUnitVectors(up, dir.normalize());
    });
  }

  // ---- the public draw: ctx is in the cart's local frame (origin = ground under the rear axle, y down), u px per metre at that point ----
  const cost = { ema: 0, n: 0 };
  api.drawCart = function (ctx, o, u, custom) {
    if (api.lost || stage.contextLost) return false;
    const who = o.who || 'You';
    const d = get(who, o);
    api.clock++;
    if (!d) return !api.bad.has(who);
    const t0 = globalThis.performance.now();
    d.used = api.clock;
    const key = [o.color, o.accent, o.wheels, o.frame, o.steer, o.brake, o.bal || 0, o.num || ''].join('|');
    if (d.cartKey !== key) {
      if (d.cart) { d.unit.remove(d.cart.root); d.cart.dispose(); }
      d.cart = buildCart(o); d.cartKey = key; d.unit.add(d.cart.root);
    }
    const side = o.mode === 'side';
    const m = ctx.getTransform(), ppu = Math.hypot(m.a, m.b);
    const reg = (custom && custom.region) || (side ? REGION_SIDE : REGION_BACK);
    const devW = clamp(Math.round(reg.w * u * ppu), 80, (custom && custom.maxW) || 900), devH = Math.round(devW * reg.h / reg.w);
    if (o.shirt && d.shirt !== o.shirt) { d.shirt = o.shirt; d.h.setKit({ top: o.shirt }); }
    if (o.helmet && d.helmetHex !== o.helmet) { d.helmetHex = o.helmet; d.helmet.shell.color.set(o.helmet); }
    hideAll();
    d.h.root.visible = true; d.unit.visible = true;
    d.unit.rotation.set(0, 0, 0); d.unit.position.set(0, 0, 0);
    let dt = d.s.t === null ? 0 : (o.t || 0) - d.s.t;
    if (!(dt >= 0 && dt < 0.25)) dt = 0;
    animateCart(d, o, dt);            // steering / lever first: the hands read them
    const hands = pose(d, o, dt);
    updateRopes(d, hands);
    // the whole cart yaws about the middle of the wheelbase (relative to the camera) and bounces a touch on rough ground
    const yaw = clamp(-(o.psi || 0) * 0.5, -0.6, 0.6), cz = d.cart.WB / 2;
    d.unit.rotation.y = yaw;
    d.unit.position.set(0, Math.max(0, Math.sin((o.t || 0) * 52) * (o.rough || 0) * 0.012), 0);
    v.set(0, 0, -cz).applyAxisAngle(up, yaw); d.unit.position.x += v.x; d.unit.position.z += v.z + cz;
    if (side) { d.unit.rotation.y = 0; d.unit.position.set(0, 0, -cz); }
    let c;
    if (custom && custom.cam) c = custom.cam;
    else if (side) c = { dist: 14, yaw: -Math.PI / 2, pitch: 5 * D2R };
    else {
      const z = clamp(o.z || 4.2, 3.4, 60), ch = clamp(o.camH || 2.2, 0.9, 4), ty = REGION_BACK.y0 + REGION_BACK.h / 2;
      c = { pos: [0, ch, -z], dist: 0 };
      void ty;
    }
    const cvs = render(reg, devW, devH, c);
    ctx.drawImage(cvs, reg.x0 * u, -(reg.y0 + reg.h) * u, reg.w * u, reg.h * u);
    const ms = globalThis.performance.now() - t0;
    cost.ema = cost.n ? cost.ema * 0.95 + ms * 0.05 : ms; cost.n++;
    if (cost.n > 150 && cost.ema > 7 && api.quality !== 'low') { api.quality = 'low'; stage.setQuality('low'); }
    return true;
  };

  // ---- spectators: two people re-coloured and re-posed, each frame cached as a small bitmap ----
  const SPEC_REGION = { x0: -0.9, y0: -0.05, w: 1.8, h: 2.35 };
  const SPEC_CAM = { dist: 14, yaw: 18 * D2R, pitch: 4 * D2R };
  const SHIRTS = ['#e2573b', '#3aa6d8', '#f2b53f', '#9a62d6', '#3cc78f', '#f4f4f0', '#e87aa0', '#2f7de0'];
  const TROUSERS = ['#2c3947', '#4b3b2c', '#37445a', '#5a4a3a', '#2a2f38', '#6b5a48'];
  const HATC = ['#e8d9a8', '#d33b2f', '#2f7de0', '#f4f4f0', '#3a7a4a', '#c9a050'];
  function spec(fem) {
    const key = fem ? 'f' : 'm';
    const r = api.specs.get(key);
    if (r) return r;
    if (!api.specLoading.has(key) && !api.bad.has('spec' + key)) {
      api.specLoading.add(key);
      loadHuman({ character: fem ? 'athlete_f' : 'athlete_m', base, kit: { top: '#d6423a', bottoms: '#2c3947', socks: DARK }, skin: 'light', hair: 'brown' })
        .then((human) => {
          dress(human);
          const dd = new Driver(human, 'spec' + key);
          dd.cap = addCap(human, '#e8d9a8', 'cap'); dd.sun = addCap(human, '#e8d9a8', 'sun');
          stage.add(human); human.root.visible = false;
          api.specs.set(key, dd); api.specLoading.delete(key);
        }).catch((e) => { api.specLoading.delete(key); api.bad.add('spec' + key); console.warn('3D spectator failed to load', String((e && e.stack) || e)); });
    }
    return null;
  }
  let specBudget = 0, specStamp = 0;
  const SIZES = [40, 64, 96, 144, 208];
  function renderSpec(fem, v, f, hBucket) {
    const r = spec(fem);
    if (!r) return null;
    hideAll();
    const hh = r.h;
    const kid = v % 5 === 2;
    const sh = SHIRTS[v % SHIRTS.length], tr = TROUSERS[(v * 3) % TROUSERS.length], look = LOOKS[(v * 5 + 1) % LOOKS.length];
    hh.setKit({ top: sh, bottoms: tr, socks: DARK });
    hh.setSkin(look.skin); hh.setHair(look.hair);
    const hatKind = v % 4 === 1 ? 'sun' : v % 4 === 3 ? 'cap' : 'none';
    r.cap.g.visible = hatKind === 'cap'; r.sun.g.visible = hatKind === 'sun';
    r.cap.m.color.set(HATC[v % HATC.length]); r.sun.m.color.set(HATC[(v + 2) % HATC.length]);
    hh.root.visible = true;
    hh.root.scale.setScalar(kid ? 0.72 : 1);
    const a = (f / 12) * Math.PI * 2;
    const raise1 = 0.5 + 0.5 * Math.sin(a), raise2 = 0.5 + 0.5 * Math.sin(a + 2.1 + (v % 3));
    const bob = Math.abs(Math.sin(a)) * 0.03;
    hh.root.position.set(0, 0, 0);
    const yaw = api.debugYaw ?? 0.62;                          // facing the road, a little toward the distance
    hh.root.rotation.y = yaw; hh.facing = yaw;
    const cheer = v % 3 !== 0;
    const dbg = api.debugArm;
    r.writePose({
      Pelvis: { flex: 2 }, Spine: { flex: -3 + 3 * raise1, side: 3 * (raise1 - raise2) }, Neck: { flex: -6 }, Head: { flex: -4 },
      L_Thigh: { flex: 4 + bob * 120, abduct: 4 }, R_Thigh: { flex: 4 + bob * 120, abduct: 4 }, L_Calf: { flex: 6 + bob * 160 }, R_Calf: { flex: 6 + bob * 160 },
      L_UpperArm: dbg ? { flex: dbg[0], abduct: dbg[1], twist: dbg[2] || 0 } : cheer ? { flex: 10 + 40 * raise1, abduct: 30 + 105 * raise1 } : { flex: 8, abduct: 12 }, L_Forearm: cheer ? { flex: 25 + 25 * raise1 } : { flex: 30 },
      R_UpperArm: cheer ? { flex: 10 + 40 * raise2, abduct: 30 + 105 * raise2 } : { flex: 8, abduct: 12 }, R_Forearm: cheer ? { flex: 25 + 25 * raise2 } : { flex: 30 },
    }, [0, -bob * 0.4, 0]);
    hh.setReachFoot('L', null); hh.setReachFoot('R', null); hh.setReach('L', null); hh.setReach('R', null);
    hh.setFingers('L', cheer ? 'open' : 'relaxed'); hh.setFingers('R', cheer ? 'open' : 'relaxed');
    hh.update(1 / 60); hh.update(0);
    const devH = hBucket, devW = Math.round(devH * SPEC_REGION.w / SPEC_REGION.h);
    const cvs = render(SPEC_REGION, devW, devH, SPEC_CAM);
    const out = globalThis.document.createElement('canvas'); out.width = devW; out.height = devH;
    out.getContext('2d').drawImage(cvs, 0, 0);
    hh.root.visible = false;
    api.renders++;
    return out;
  }
  // x, y: the person's feet; h: pixel height of an adult. Returns true when drawn (false: the caller draws its 2D figure).
  api.person = function (ctx, x, y, h, vv, ph, t, cheer = 1, side = 1) {
    if (api.lost || stage.contextLost || h < 14) return false;
    const m = ctx.getTransform(), ppu = Math.hypot(m.a, m.b);
    const want = (SPEC_REGION.h / 1.75) * h * ppu;
    let hb = SIZES[SIZES.length - 1]; for (const s of SIZES) if (s >= want * 0.9) { hb = s; break; }
    const fem = vv % 2 === 1, vk = vv % 24;
    const frame = Math.floor(((((t * 6 + ph) / (Math.PI * 2)) % 1) + 1) % 1 * 12);
    const key = `${fem ? 1 : 0}|${vk}|${frame}|${hb}`;
    let bmp = api.cache.get(key);
    if (bmp) { api.cache.delete(key); api.cache.set(key, bmp); api.cacheHits++; }
    else {
      const now = globalThis.performance.now();
      if (now - specStamp > 16) { specStamp = now; specBudget = 3; }
      if (specBudget <= 0) return false;
      specBudget--;
      bmp = renderSpec(fem, vk, frame, hb);
      if (!bmp) return !api.bad.has('spec' + (fem ? 'f' : 'm')) && false;
      api.cache.set(key, bmp);
      if (api.cache.size > 420) api.cache.delete(api.cache.keys().next().value);
    }
    const s = h / 1.75;
    ctx.save();
    ctx.translate(x, y);
    if (side < 0) ctx.scale(-1, 1);
    ctx.drawImage(bmp, SPEC_REGION.x0 * s, -(SPEC_REGION.y0 + SPEC_REGION.h) * s, SPEC_REGION.w * s, SPEC_REGION.h * s);
    ctx.restore();
    void cheer;
    return true;
  };
  api.preload = (who, o = {}) => { get(who, o); spec(false); spec(true); };
  return api;
}
