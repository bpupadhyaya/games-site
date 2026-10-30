// The paper-cutting desk as a lit 3D scene: a walnut desk, a self-healing cutting mat with a printed grid, steel scissors, a bone folder,
// a red seal chop with its ink pad, a tea cup and offcuts, plus the paper itself (every face of the fold engine as a lit, shadow-casting,
// double-sided mesh with the cuts baked in as real holes). Units are sheet units (the whole sheet is about 1 x 1). World axes (three.js):
// X = sheet x, Y = up (sheet z), Z = sheet y (towards the viewer on screen). No people, no hands.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

export const MAT_H = 0.07;
const canvas2 = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, { repeat, srgb = true, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
};
export const radialTex = (rgb, a = 1) => {
  const c = canvas2(128), g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, `rgba(${rgb},${a})`); r.addColorStop(0.5, `rgba(${rgb},${a * 0.35})`); r.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const hash = (n) => { let h = Math.imul(Math.floor(n) ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ------------------------------------------------------------------------------------------------ lights
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffe6c8, 0x1a0c08, 0.12); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e6, 1.0);          // the desk lamp's key: upper left, behind the paper (shadows fall to the viewer's right)
  sun.position.set(-3.2, 5.4, -2.6); sun.target.position.set(0, 0, 0);
  sun.shadow.camera.left = -3.6; sun.shadow.camera.right = 3.6; sun.shadow.camera.top = 3.6; sun.shadow.camera.bottom = -3.6; sun.shadow.camera.near = 1; sun.shadow.camera.far = 16;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.006; sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const lamp = new THREE.PointLight(0xffb36e, 26, 14, 1.5); lamp.position.set(-1.9, 2.4, -1.4); scene.add(lamp);   // warm pool of lantern light
  const rim = new THREE.DirectionalLight(0xffb070, 0.18); rim.position.set(3, 2, 3); scene.add(rim);
  return { hemi, sun, lamp, rim };
}

// ------------------------------------------------------------------------------------------------ desk
function deskTexture(size) {
  const c = canvas2(size), g = c.getContext('2d');
  const planks = 7, ph = size / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph, base = 16 + hash(p * 13) * 12;
    g.fillStyle = `rgb(${base + 34},${base + 12},${base - 2})`; g.fillRect(0, y0, size, ph);
    for (let i = 0; i < 90; i++) {                                    // grain
      const y = y0 + hash(p * 977 + i) * ph, a = 0.05 + hash(p * 31 + i * 3) * 0.1, w = 0.6 + hash(i + p) * 1.8;
      g.strokeStyle = hash(i * 7 + p) < 0.5 ? `rgba(20,8,2,${a})` : `rgba(255,190,120,${a * 0.5})`; g.lineWidth = w;
      g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= size; x += size / 8) g.lineTo(x, y + Math.sin(x * 0.01 + p * 2 + i) * 2.2); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, y0, size, 2.5);   // seam
    g.fillStyle = 'rgba(255,200,140,0.07)'; g.fillRect(0, y0 + 3, size, 1.5);
  }
  return c;
}

// ------------------------------------------------------------------------------------------------ the cutting mat
function matTexture(color, dark, px = 1024) {
  const c = canvas2(px), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, px, px);
  const n = 40, cell = px / n;
  g.strokeStyle = dark ? 'rgba(255,230,190,0.16)' : 'rgba(80,52,28,0.2)'; g.lineWidth = 1.2;
  for (let i = 0; i <= n; i++) {
    const t = i % 5 === 0; g.globalAlpha = t ? 1 : 0.5; g.lineWidth = t ? 2 : 1;
    g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, px); g.moveTo(0, i * cell); g.lineTo(px, i * cell); g.stroke();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 700; i++) {                                    // fine speckle: a printed, slightly worn surface
    g.fillStyle = hash(i) < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    g.fillRect(hash(i * 3 + 1) * px, hash(i * 3 + 2) * px, 2 + hash(i) * 5, 1);
  }
  g.strokeStyle = dark ? 'rgba(255,230,190,0.28)' : 'rgba(90,50,24,0.32)'; g.lineWidth = 3;     // diagonal guide and quarter circle
  g.beginPath(); g.moveTo(0, px); g.lineTo(px, 0); g.stroke();
  g.beginPath(); g.arc(0, px, px * 0.5, -Math.PI / 2, 0); g.stroke();
  return c;
}
const matCache = new Map();
export function matMaterial(color, dark) {
  const key = `${color}|${dark}`; let m = matCache.get(key); if (m) return m;
  m = new THREE.MeshStandardMaterial({ map: tex(matTexture(color, dark)), roughness: 0.72, metalness: 0, bumpMap: tex(matTexture('#808080', false, 256), { srgb: false }), bumpScale: 0.25 });
  m.envMapIntensity = 0.5; matCache.set(key, m); if (matCache.size > 8) matCache.delete(matCache.keys().next().value);
  return m;
}
export function buildMat() {
  const g = new THREE.Group();
  const geo = B.slab(1, 1, MAT_H, 0.06, 0.018, { uvScale: 1 });
  const top = new THREE.Mesh(geo, matMaterial('#f4ecd9', false)); top.castShadow = true; top.receiveShadow = true;
  g.add(top); g.userData.mesh = top; return g;
}

// ------------------------------------------------------------------------------------------------ props
const steel = () => { const m = new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 0.95, roughness: 0.28 }); m.envMapIntensity = 1.4; return m; };
const lacquer = (c) => { const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 }); m.envMapIntensity = 0.9; return m; };
const shadowOn = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

function scissors() {
  const g = new THREE.Group(), st = steel();
  const blade = (side) => {
    const s = new THREE.Shape(); const L = 0.78;
    s.moveTo(0, -0.03); s.lineTo(L, -0.004); s.lineTo(L + 0.02, 0.012); s.lineTo(L * 0.2, 0.05); s.lineTo(-0.1, 0.045); s.lineTo(-0.1, -0.03); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2);                       // lie flat: shape x along +X, shape y towards -Z
    const m = new THREE.Mesh(geo, st); m.rotation.y = side * 0.13; m.position.y = side > 0 ? 0.017 : 0; return m;
  };
  g.add(blade(1), blade(-1));
  for (const side of [1, -1]) {                       // finger rings
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.026, 12, 28), lacquer(0xb3201a));
    ring.rotation.x = -Math.PI / 2; ring.scale.set(1, 1.28, 1);
    ring.position.set(-0.30, 0.025 + (side > 0 ? 0.017 : 0), side * -0.12); ring.rotation.z = 0;
    g.add(ring);
    const nk = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.035), st); nk.position.set(-0.19, 0.018 + (side > 0 ? 0.017 : 0), side * -0.05); nk.rotation.y = side * 0.5; g.add(nk);
  }
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 16), lacquer(0xd9a441)); pivot.position.set(0.02, 0.02, 0); g.add(pivot);
  return shadowOn(g);
}
function boneFolder() {
  const m = B.material('ivory', {}); const g = new THREE.Group();
  const geo = B.roundedBox(0.95, 0.03, 0.15, 0.014, 4);
  const b = new THREE.Mesh(geo, m); b.position.y = 0.016; g.add(b);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), m); tip.scale.set(1, 0.2, 1); tip.position.set(0.47, 0.016, 0); g.add(tip);
  return shadowOn(g);
}
function sealChop() {
  const g = new THREE.Group();
  const red = lacquer(0xa3191a);
  const body = new THREE.Mesh(B.lathe([[0.0, 0], [0.105, 0], [0.105, 0.02], [0.1, 0.26], [0.085, 0.3], [0.0, 0.31]], 32), red); g.add(body);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.022, 32), B.material('brass', {})); ring.position.y = 0.115; g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.016, 32), B.material('brass', {})); ring2.position.y = 0.04; g.add(ring2);
  return shadowOn(g);
}
function inkPad() {
  const g = new THREE.Group();
  const tin = new THREE.Mesh(B.lathe([[0, 0], [0.26, 0], [0.265, 0.02], [0.265, 0.075], [0.25, 0.085], [0.0, 0.085]], 40), B.material('brass', { color: '#8a5a2b' })); g.add(tin);
  const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.012, 40), lacquer(0xc21f1a)); ink.position.y = 0.083; g.add(ink);
  return shadowOn(g);
}
function teaCup() {
  const g = new THREE.Group(); const cel = new THREE.MeshPhysicalMaterial({ color: 0x9fc9b3, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }); cel.envMapIntensity = 0.9;
  const saucer = new THREE.Mesh(B.lathe([[0, 0.0], [0.2, 0.0], [0.27, 0.035], [0.27, 0.045], [0.2, 0.012], [0, 0.012]], 40), cel); g.add(saucer);
  const cup = new THREE.Mesh(B.lathe([[0, 0.012], [0.07, 0.012], [0.09, 0.03], [0.14, 0.17], [0.145, 0.185], [0.135, 0.185], [0.0, 0.05]], 40), cel); cup.position.y = 0.01; g.add(cup);
  const tea = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.004, 32), new THREE.MeshStandardMaterial({ color: 0x6b3a12, roughness: 0.12 })); tea.position.y = 0.15; g.add(tea);
  return shadowOn(g);
}
function offcut(c, i) {
  const s = new THREE.Shape(); const n = 3 + (i % 3);
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + hash(i * 5 + k) * 0.5, r = 0.07 + hash(i * 11 + k) * 0.1; const x = Math.cos(a) * r, y = Math.sin(a) * r; k ? s.lineTo(x, y) : s.moveTo(x, y); }
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
  return shadowOn(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide })));
}
// Everything that stands on the desk, relative to the desk top (y = 0). Positions are chosen for the default view; the set follows the camera target.
export function buildSet(tier = 0) {
  const g = new THREE.Group();
  const dt = deskTexture(tier > 1 ? 512 : 1024);
  const wood = new THREE.MeshStandardMaterial({ map: tex(dt, { repeat: [3, 3] }), roughness: 0.52, metalness: 0 }); wood.envMapIntensity = 0.55;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), wood); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.position.y = -0.001; g.add(floor);
  const P = g.userData.props = { scissors: scissors(), folder: boneFolder(), pad: inkPad(), chop: sealChop(), cup: teaCup(), scraps: [] };
  g.add(P.scissors, P.folder, P.pad, P.chop, P.cup);
  [[0xd32f20, 0.3], [0xe8b238, 1.2], [0xd32f20, 2.0], [0xf4ecd9, 0.6]].forEach(([c, r], i) => { const o = offcut(c, i); o.rotation.y = r; P.scraps.push(o); g.add(o); });
  layoutProps(g, 0, 0, 1.4, 1.4);
  return g;
}

// Props are arranged round the mat (centre cx, cz; size mw x md in sheet units) so the picture is composed the same way in portrait,
// landscape and on tablets, whatever the screen shape: scissors lying at one edge, the bone folder along the other, the seal and
// its ink pad at a far corner, a cup beyond, offcuts on the wood.
export function layoutProps(set, cx, cz, mw, md) {
  const P = set.userData.props, k = Math.max(0.55, Math.min(1, mw / 1.5)), hw = mw / 2, hd = md / 2;
  const put = (o, x, z, ry, sc = k) => { o.position.set(cx + x, 0, cz + z); o.rotation.y = ry; o.scale.setScalar(sc); };
  put(P.scissors, hw + 0.04 * k, hd * 0.35, -1.25);
  put(P.folder, -hw - 0.1 * k, -hd * 0.15, 1.58, k * 0.9);
  put(P.pad, hw + 0.3 * k, -hd * 0.68, 0, k);
  put(P.chop, hw + 0.3 * k, -hd * 0.68, 0, k);
  P.chop.position.y = 0.085 * k;
  put(P.cup, -hw - 0.34 * k, hd * 0.72, 0.4, k);
  P.scraps.forEach((o, i) => { o.position.set(cx + (i % 2 ? hw : -hw) + (i < 2 ? 0.3 : 0.22) * (i % 2 ? 1 : -1) * k, 0.002 + i * 0.002, cz + (i < 2 ? -1 : 1) * (hd * 0.4 + 0.1 * i)); o.scale.setScalar(k); });
}

// ------------------------------------------------------------------------------------------------ the paper
// Pool of face meshes. Each face is a convex polygon in sheet space with a 3D pose (pts3); front and back are two meshes on one
// geometry (front texture on the side the sheet's front looks at, back texture on the other), so both sides are lit and shadow-cast.
const MAXV = 16;
export class PaperStack {
  constructor() { this.group = new THREE.Group(); this.slots = []; this.mats = new WeakMap(); this.texes = new WeakMap(); this.top = -1e9; }
  slot(i) {
    let s = this.slots[i]; if (s) return s;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXV * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(MAXV * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(MAXV * 2), 2));
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array((MAXV - 2) * 3), 1));
    const f = new THREE.Mesh(geo, null), b = new THREE.Mesh(geo, null);
    for (const m of [f, b]) { m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; this.group.add(m); }
    s = { geo, f, b, nrm: new Float32Array(MAXV * 3) }; this.slots[i] = s; return s;
  }
  texOf(c) {
    if (!c) return null; let t = this.texes.get(c);
    if (!t) { t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.flipY = true; this.texes.set(c, t); }
    return t;
  }
  matsFor(paper, hi) {
    let e = this.mats.get(paper); if (e) return e;
    const mk = (side, c) => { const m = new THREE.MeshStandardMaterial({ map: this.texOf(c), color: c ? 0xffffff : (side === THREE.BackSide ? paper.backColor : paper.base), roughness: 0.86, metalness: 0, side, shadowSide: THREE.DoubleSide }); if (paper.baked) { m.alphaTest = 0.42; m.alphaToCoverage = hi; } m.envMapIntensity = 0.45; return m; };
    e = { front: mk(THREE.FrontSide, paper.front), back: mk(THREE.BackSide, paper.back) }; this.mats.set(paper, e); return e;
  }
  // job = { faces, paper, cam: { cx, cy, roll } }; returns the lowest z (so the mat can sit just under the paper)
  update(job, hi = true) {
    const { faces, paper, cam } = job, cr = Math.cos(cam.roll || 0), sr = Math.sin(cam.roll || 0), cx = cam.cx, cy = cam.cy;
    const ms = this.matsFor(paper, hi); let used = 0, minZ = 0, maxLift = 0;
    for (const F of faces) {
      const n = Math.min(F.pts3.length, MAXV); if (n < 3) continue;
      const s = this.slot(used++), pos = s.geo.attributes.position, uv = s.geo.attributes.uv, nor = s.geo.attributes.normal, idx = s.geo.index;
      // sheet-space basis at the face: d = a Eu + b Ev -> (a, b) = sheet-space offset of a vertex from the face centre
      const eu = F.Eu, ev = F.Ev, uu = eu[0] * eu[0] + eu[1] * eu[1] + eu[2] * eu[2], vv = ev[0] * ev[0] + ev[1] * ev[1] + ev[2] * ev[2], uvd = eu[0] * ev[0] + eu[1] * ev[1] + eu[2] * ev[2];
      const det = uu * vv - uvd * uvd || 1e-9;
      const zoff = (F.z || 0) * 0.004 + (F.moving ? 0.014 : 0);
      for (let j = 0; j < n; j++) {
        const p = F.pts3[j], dx = p[0] - F.c3[0], dy = p[1] - F.c3[1], dz = p[2] - F.c3[2];
        const bu = dx * eu[0] + dy * eu[1] + dz * eu[2], bv = dx * ev[0] + dy * ev[1] + dz * ev[2];
        const a = (bu * vv - bv * uvd) / det, b = (bv * uu - bu * uvd) / det;
        uv.setXY(j, F.uv[0] + a + 0.5, 0.5 - (F.uv[1] + b));
        const x = cx + (p[0] - cx) * cr - (p[1] - cy) * sr, y = cy + (p[0] - cx) * sr + (p[1] - cy) * cr, z = p[2] + zoff;
        pos.setXYZ(j, x, z, y); if (z < minZ) minZ = z; if (z > maxLift) maxLift = z;
      }
      // front normal = Eu x Ev (sheet axes), rolled with the paper, in three.js axes
      let nx = eu[1] * ev[2] - eu[2] * ev[1], ny = eu[2] * ev[0] - eu[0] * ev[2], nz = eu[0] * ev[1] - eu[1] * ev[0]; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const rx = nx * cr - ny * sr, ry = nx * sr + ny * cr;
      // triangle fan, ordered so the geometric normal (three.js right-handed cross product) agrees with the front normal
      const x0 = pos.getX(0), y0 = pos.getY(0), z0 = pos.getZ(0);
      const e1 = [pos.getX(1) - x0, pos.getY(1) - y0, pos.getZ(1) - z0], e2 = [pos.getX(2) - x0, pos.getY(2) - y0, pos.getZ(2) - z0];
      const gx = e1[1] * e2[2] - e1[2] * e2[1], gy = e1[2] * e2[0] - e1[0] * e2[2], gz = e1[0] * e2[1] - e1[1] * e2[0];
      const same = gx * rx + gy * nz + gz * ry >= 0;      // three axes: (X, Y, Z) = (rx, nz, ry)
      const ia = idx.array; let k = 0;
      for (let t = 1; t < n - 1; t++) { if (same) { ia[k++] = 0; ia[k++] = t; ia[k++] = t + 1; } else { ia[k++] = 0; ia[k++] = t + 1; ia[k++] = t; } }
      for (let j = 0; j < n; j++) nor.setXYZ(j, rx, nz, ry);
      idx.needsUpdate = true; pos.needsUpdate = true; uv.needsUpdate = true; nor.needsUpdate = true;
      s.geo.setDrawRange(0, k);
      s.f.visible = s.b.visible = true; s.f.material = ms.front; s.b.material = ms.back;
      // the back mesh renders the other side: flip its index winding by drawing the same triangles with BackSide material (normals negated by the shader for back faces)
    }
    for (let i = used; i < this.slots.length; i++) this.slots[i].f.visible = this.slots[i].b.visible = false;
    this.top = minZ; return { minZ, maxLift };
  }
}
