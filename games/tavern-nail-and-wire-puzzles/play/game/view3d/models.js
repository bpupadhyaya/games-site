// Tavern Nail and Wire Puzzles: procedural 3D models and textures (no image files). Coordinates: the game's lattice (x, y, z) maps to
// three.js (x, y, -z) so the picture matches the flat renderer's handedness exactly.
import * as THREE from '../vendor3d/three.js';

export const TUBE = 0.165;
const TAU = Math.PI * 2;
export const hash = (a, b = 0, c = 0) => { const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return v - Math.floor(v); };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const col = (h) => new THREE.Color(h);

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { repeat = [1, 1], aniso = 4, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- oak bar-top (covers 24 x 24 lattice units; planks run along x)
export function oakCanvas(size = 2048) {
  const c = mkCanvas(size, size), g = c.getContext('2d');
  const planks = 4, ph = size / planks;
  for (let i = 0; i < planks; i++) {
    const y0 = i * ph, tone = hash(i, 3);
    const base = [96 + tone * 34, 58 + tone * 20, 28 + tone * 11];
    const gr = g.createLinearGradient(0, y0, 0, y0 + ph);
    gr.addColorStop(0, `rgb(${base[0] * 0.86 | 0},${base[1] * 0.86 | 0},${base[2] * 0.86 | 0})`);
    gr.addColorStop(0.5, `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`);
    gr.addColorStop(1, `rgb(${base[0] * 0.8 | 0},${base[1] * 0.8 | 0},${base[2] * 0.8 | 0})`);
    g.fillStyle = gr; g.fillRect(0, y0, size, ph);
    // long grain lines with a slow wobble (tileable in x: whole periods)
    for (let k = 0; k < 70; k++) {
      const yy = y0 + hash(i, k, 1) * ph, amp = 3 + hash(i, k, 2) * 9, per = 1 + Math.floor(hash(i, k, 3) * 3), ph0 = hash(i, k, 4) * TAU;
      g.beginPath();
      for (let x = 0; x <= size; x += 32) { const yv = yy + Math.sin((x / size) * TAU * per + ph0) * amp; if (x) g.lineTo(x, yv); else g.moveTo(x, yv); }
      g.lineWidth = 0.6 + hash(i, k, 5) * 2.2;
      g.strokeStyle = hash(i, k, 6) > 0.45 ? `rgba(30,14,4,${0.1 + hash(i, k, 7) * 0.2})` : `rgba(255,214,150,${0.04 + hash(i, k, 8) * 0.07})`;
      g.stroke();
    }
    // knots
    for (let k = 0; k < 2; k++) {
      if (hash(i, k, 9) < 0.45) continue;
      const kx = hash(i, k, 10) * size, ky = y0 + ph * (0.25 + hash(i, k, 11) * 0.5);
      for (let r = 5; r > 0; r--) { g.beginPath(); g.ellipse(kx, ky, r * 9, r * 4.2, 0, 0, TAU); g.strokeStyle = `rgba(28,12,3,${0.12 + r * 0.05})`; g.lineWidth = 2; g.stroke(); }
      g.beginPath(); g.ellipse(kx, ky, 12, 6, 0, 0, TAU); g.fillStyle = 'rgba(30,12,2,0.8)'; g.fill();
    }
    // plank seam
    g.fillStyle = 'rgba(8,3,0,0.85)'; g.fillRect(0, y0, size, 5);
    g.fillStyle = 'rgba(255,220,160,0.12)'; g.fillRect(0, y0 + 5, size, 3);
    // butt joints
    const bx = hash(i, 20) * size;
    g.fillStyle = 'rgba(8,3,0,0.8)'; g.fillRect(bx, y0, 4, ph);
    // dowel pegs near joints
    for (const dy of [0.2, 0.8]) { g.beginPath(); g.arc(bx + 26, y0 + ph * dy, 7, 0, TAU); g.fillStyle = 'rgba(20,8,1,0.7)'; g.fill(); g.beginPath(); g.arc(bx + 24, y0 + ph * dy - 1, 4, 0, TAU); g.fillStyle = 'rgba(150,98,50,0.7)'; g.fill(); }
  }
  // ring stains from tankards and a spilled bloom; scratches
  const stain = (x, y, r, a) => {
    for (let w = 0; w < 3; w++) { g.beginPath(); g.arc(x, y, r - w * 2, 0, TAU); g.strokeStyle = `rgba(22,9,2,${a * (1 - w * 0.3)})`; g.lineWidth = 7 - w * 2; g.stroke(); }
    const rg = g.createRadialGradient(x, y, r * 0.2, x, y, r); rg.addColorStop(0, 'rgba(20,8,0,0)'); rg.addColorStop(1, `rgba(20,8,0,${a * 0.25})`);
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  };
  stain(size * 0.22, size * 0.3, 130, 0.5); stain(size * 0.27, size * 0.34, 125, 0.4); stain(size * 0.74, size * 0.7, 140, 0.45); stain(size * 0.55, size * 0.12, 100, 0.35); stain(size * 0.12, size * 0.82, 120, 0.4);
  g.lineCap = 'round';
  for (let k = 0; k < 90; k++) {
    const x = hash(k, 40) * size, y = hash(k, 41) * size, a = (hash(k, 42) - 0.5) * 0.7, l = 20 + hash(k, 43) * 90;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.strokeStyle = hash(k, 44) > 0.5 ? 'rgba(255,220,170,0.09)' : 'rgba(10,4,0,0.2)'; g.lineWidth = 1 + hash(k, 45) * 1.3; g.stroke();
  }
  // candle wax drip + dark soot patch
  g.beginPath(); g.ellipse(size * 0.86, size * 0.2, 60, 38, 0.3, 0, TAU); g.fillStyle = 'rgba(236,224,190,0.5)'; g.fill();
  return c;
}

// hammered-iron bump: short facets and pits, tileable
export function hammerCanvas(size = 256) {
  const c = mkCanvas(size, size), g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
  for (let k = 0; k < 260; k++) {
    const x = hash(k, 1) * size, y = hash(k, 2) * size, r = 5 + hash(k, 3) * 16, a = hash(k, 4) * Math.PI, v = 70 + hash(k, 5) * 120;
    g.save(); g.translate(x, y); g.rotate(a);
    const gr = g.createLinearGradient(-r, 0, r, 0); gr.addColorStop(0, `rgb(${v | 0},${v | 0},${v | 0})`); gr.addColorStop(1, `rgb(${(255 - v) | 0},${(255 - v) | 0},${(255 - v) | 0})`);
    g.fillStyle = gr; g.globalAlpha = 0.5; g.beginPath(); g.ellipse(0, 0, r, r * 0.45, 0, 0, TAU); g.fill(); g.restore();
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) if (dx || dy) { /* wrap handled by drawing near-edge duplicates */ }
  }
  for (let k = 0; k < 600; k++) { g.fillStyle = `rgba(${hash(k, 9) > 0.5 ? 255 : 0},${hash(k, 9) > 0.5 ? 255 : 0},${hash(k, 9) > 0.5 ? 255 : 0},0.12)`; g.fillRect(hash(k, 7) * size, hash(k, 8) * size, 1 + hash(k, 6) * 3, 1); }
  return c;
}

// small ring/dot guides for the lattice
export function dotsCanvas(size = 64) {
  const c = mkCanvas(size, size), g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  const cx = size / 2, rg = g.createRadialGradient(cx, cx, 0, cx, cx, size * 0.07);
  rg.addColorStop(0, 'rgba(0,0,0,0.7)'); rg.addColorStop(0.6, 'rgba(0,0,0,0.4)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(cx, cx, size * 0.07, 0, TAU); g.fill();
  return c;
}
export function blobCanvas(rgb = '0,0,0', a = 0.6, size = 128) {
  const c = mkCanvas(size, size), g = c.getContext('2d');
  const rg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  rg.addColorStop(0, `rgba(${rgb},${a})`); rg.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); rg.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = rg; g.fillRect(0, 0, size, size);
  return c;
}

// ---------------------------------------------------------------- materials
const METAL = {
  iron: { color: '#6a707a', metalness: 0.92, roughness: 0.48, bump: 0.9, emissive: '#000000' },
  brass: { color: '#d8a43a', metalness: 1, roughness: 0.27, bump: 0.55, emissive: '#000000' },
  copper: { color: '#c7683a', metalness: 1, roughness: 0.3, bump: 0.6, emissive: '#000000' },
  steel: { color: '#c9d2dc', metalness: 1, roughness: 0.2, bump: 0.35, emissive: '#000000' },
};
export const METAL_IDS = Object.keys(METAL);
let hammer = null;
const matCache = new Map();
export function metalMat(id, glow = 0) {
  const key = `${id}|${glow}`;
  let m = matCache.get(key);
  if (!m) {
    const d = METAL[id] ?? METAL.iron;
    hammer ??= tex(hammerCanvas(256), { srgb: false, aniso: 4 });
    m = new THREE.MeshStandardMaterial({ color: col(d.color), metalness: d.metalness, roughness: d.roughness, bumpMap: hammer, bumpScale: d.bump * 2.2, envMapIntensity: 1.15 });
    if (glow) { m.emissive = col('#ffb347'); m.emissiveIntensity = 0.4; m.userData.sel = true; }
    matCache.set(key, m);
  }
  return m;
}
export function pulseSel(v) { for (const m of matCache.values()) if (m.userData.sel) m.emissiveIntensity = v; }
export function disposeMaterials() { for (const m of matCache.values()) m.dispose(); matCache.clear(); hammer = null; }

// ---------------------------------------------------------------- wire tubes
const V = (x, y, z) => new THREE.Vector3(x, y, -z);
// polyline with rounded corners (fillet radius rf, sampled), closed or open; points are lattice [x,y,z]
export function pathPoints(pts, closed, rf = 0.3) {
  const n = pts.length, out = [];
  const P = pts.map((p) => V(p[0], p[1], p[2]));
  const ends = closed ? 0 : 1;
  for (let i = 0; i < n; i++) {
    const p = P[i];
    if (!closed && (i === 0 || i === n - 1)) { out.push(p.clone()); continue; }
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
    const da = a.clone().sub(p), db = b.clone().sub(p), la = da.length(), lb = db.length();
    if (la < 1e-6 || lb < 1e-6) continue;
    da.divideScalar(la); db.divideScalar(lb);
    if (Math.abs(da.dot(db)) > 0.999) { out.push(p.clone()); continue; }   // straight through
    const r = Math.min(rf, la * 0.45, lb * 0.45);
    const s = p.clone().addScaledVector(da, r), e = p.clone().addScaledVector(db, r);
    for (let k = 0; k <= 6; k++) { const t = k / 6, u = 1 - t; out.push(new THREE.Vector3(u * u * s.x + 2 * u * t * p.x + t * t * e.x, u * u * s.y + 2 * u * t * p.y + t * t * e.y, u * u * s.z + 2 * u * t * p.z + t * t * e.z)); }
  }
  void ends;
  // drop duplicates
  const cl = [];
  for (const q of out) if (!cl.length || cl[cl.length - 1].distanceToSquared(q) > 1e-8) cl.push(q);
  if (closed && cl.length > 1 && cl[0].distanceToSquared(cl[cl.length - 1]) < 1e-8) cl.pop();
  return cl;
}
// a tube along points with parallel-transport frames; u = around, v = length (one texture tile per 0.9 units)
export function tubeGeo(points, closed, radius = TUBE, radial = 14) {
  const n = points.length, m = closed ? n + 1 : n;
  const pos = new Float32Array(m * (radial + 1) * 3), nor = new Float32Array(pos.length), uv = new Float32Array(m * (radial + 1) * 2);
  const tang = (i) => {
    const a = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    return b.clone().sub(a).normalize();
  };
  let T = tang(0), N = Math.abs(T.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  N = N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();
  let len = 0;
  for (let j = 0; j < m; j++) {
    const i = j % n, p = points[i];
    if (j > 0) len += p.distanceTo(points[(j - 1) % n]);
    const Tn = tang(i);
    if (j > 0) {   // transport the normal onto the new tangent
      const ax = T.clone().cross(Tn);
      if (ax.lengthSq() > 1e-10) { ax.normalize(); const ang = Math.acos(clamp(T.dot(Tn), -1, 1)); N.applyAxisAngle(ax, ang); }
    }
    T = Tn;
    const B = T.clone().cross(N).normalize();
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * TAU, c = Math.cos(a), s = Math.sin(a);
      const nx = N.x * c + B.x * s, ny = N.y * c + B.y * s, nz = N.z * c + B.z * s, o = (j * (radial + 1) + k);
      pos[o * 3] = p.x + nx * radius; pos[o * 3 + 1] = p.y + ny * radius; pos[o * 3 + 2] = p.z + nz * radius;
      nor[o * 3] = nx; nor[o * 3 + 1] = ny; nor[o * 3 + 2] = nz;
      uv[o * 2] = k / radial; uv[o * 2 + 1] = len / 0.9;
    }
  }
  const idx = [];
  for (let j = 0; j < m - 1; j++) for (let k = 0; k < radial; k++) {
    const a = j * (radial + 1) + k, b = (j + 1) * (radial + 1) + k;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const shapeIds = new WeakMap(); let shapeN = 0;
const geoCache = new Map();
// Build the meshes of one shape in orientation o (rotation matrix rows from wire.js ROT): returns a Group (local origin = grip point)
export function buildPiece(def, rotM, kind, metal, glow) {
  const g = new THREE.Group();
  const mat = metalMat(metal, glow);
  const rot = (p) => rotM ? [rotM[0] * p[0] + rotM[1] * p[1] + rotM[2] * p[2], rotM[3] * p[0] + rotM[4] * p[1] + rotM[5] * p[2], rotM[6] * p[0] + rotM[7] * p[1] + rotM[8] * p[2]] : p;
  let id = shapeIds.get(def); if (!id) { id = ++shapeN; shapeIds.set(def, id); }
  const okey = `${id}|${rotM ? rotM.join() : 'I'}`;
  let parts = geoCache.get(okey);
  if (!parts) {
    parts = [];
    for (const path of def.paths) {
      const pts = path.pts.map(rot);
      if (pts.length === 1) { parts.push({ kind: 'ball', p: V(...pts[0]) }); continue; }
      const closed = !!path.closed, ps = pathPoints(pts, closed);
      if (ps.length < 2) continue;
      parts.push({ kind: 'tube', geo: tubeGeo(ps, closed), closed, ends: closed ? null : [ps[0], ps[ps.length - 1], ps[1], ps[ps.length - 2]] });
    }
    if (geoCache.size > 120) geoCache.clear();
    geoCache.set(okey, parts);
  }
  for (const part of parts) {
    if (part.kind === 'ball') { const m = new THREE.Mesh(sphere(TUBE * 1.5), mat); m.position.copy(part.p); m.castShadow = m.receiveShadow = true; g.add(m); continue; }
    const m = new THREE.Mesh(part.geo, mat); m.castShadow = m.receiveShadow = true; g.add(m);
    if (part.ends) {
      const [a, b, a2, b2] = part.ends;
      for (const [e, nb, head] of [[a, a2, kind === 'nail'], [b, b2, false]]) {
        const cap = new THREE.Mesh(sphere(TUBE), mat); cap.position.copy(e); cap.castShadow = true; g.add(cap);
        if (head) {
          const dir = e.clone().sub(nb).normalize();
          const hd = new THREE.Mesh(nailHead(), mat); hd.position.copy(e).addScaledVector(dir, 0.02);
          hd.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); hd.castShadow = hd.receiveShadow = true; g.add(hd);
        }
      }
    }
  }
  return g;
}
let _sph = new Map(), _head = null;
function sphere(r) { let s = _sph.get(r); if (!s) { s = new THREE.SphereGeometry(r, 14, 10); _sph.set(r, s); } return s; }
function nailHead() { return (_head ??= new THREE.CylinderGeometry(TUBE * 2.5, TUBE * 1.9, TUBE * 0.9, 18)); }

// ---------------------------------------------------------------- bar-top room: floor, props, candle
export function buildBar() {
  const root = new THREE.Group();
  const oak = tex(oakCanvas(2048), { repeat: [8.3333, 8.3333], aniso: 8 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x9c8672, map: oak, bumpMap: oak, bumpScale: 1.4, roughness: 0.5, metalness: 0.0, envMapIntensity: 0.5 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);
  // lattice guide dots
  const dots = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ map: tex(dotsCanvas(64), { repeat: [20, 20], srgb: true }), transparent: true, depthWrite: false, opacity: 0.55 }));
  dots.rotation.x = -Math.PI / 2; dots.position.y = 0.006; dots.renderOrder = 1; root.add(dots);

  // props, in units of the lattice (1 unit ~ 2.4 cm): tankard, candlestick, loose nails, coins
  const props = new THREE.Group(); root.add(props);
  const pewter = new THREE.MeshStandardMaterial({ color: '#b3b9bf', metalness: 1, roughness: 0.3, envMapIntensity: 1.1 });
  const pewterDark = new THREE.MeshStandardMaterial({ color: '#7e858c', metalness: 1, roughness: 0.4, envMapIntensity: 1 });
  const brass = metalMat('brass'), iron = metalMat('iron');
  const lat = (profile, mat, seg = 36) => { const m = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat); m.castShadow = m.receiveShadow = true; return m; };
  // tankard
  const tank = new THREE.Group();
  tank.add(lat([[0, 0], [1.55, 0], [1.62, 0.12], [1.5, 0.3], [1.36, 3.9], [1.42, 4.0], [1.42, 4.12], [1.3, 4.12], [1.3, 3.96], [0, 3.96]], pewter));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.17, 10, 24, Math.PI * 1.15), pewterDark); handle.position.set(1.4, 2.1, 0); handle.rotation.set(0, 0, -Math.PI * 0.575); handle.castShadow = true; tank.add(handle);
  const lid = new THREE.Group(); lid.add(lat([[0, 0], [1.5, 0], [1.54, 0.12], [1.3, 0.28], [0.3, 0.42], [0.2, 0.62], [0, 0.66]], pewterDark)); lid.position.set(0, 4.12, 0); lid.rotation.z = 0.5; lid.position.x = -0.1; tank.add(lid);
  const beer = new THREE.Mesh(new THREE.CircleGeometry(1.29, 28), new THREE.MeshStandardMaterial({ color: '#c88a1a', roughness: 0.2, emissive: '#5a3200', emissiveIntensity: 0.4 })); beer.rotation.x = -Math.PI / 2; beer.position.y = 3.6; tank.add(beer);
  tank.position.set(-2.2, 0, 1.2); tank.userData = { slot: 'L' }; props.add(tank);
  // candlestick + candle + flame
  const cs = new THREE.Group();
  cs.add(lat([[0, 0], [1.4, 0], [1.5, 0.12], [1.25, 0.28], [0.5, 0.5], [0.34, 0.9], [0.5, 1.25], [0.3, 1.5], [0.32, 2.6], [0.62, 2.78], [0.9, 3.0], [0.8, 3.22], [0.5, 3.1], [0, 3.1]], brass));
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 2.6, 18), new THREE.MeshStandardMaterial({ color: '#efe3c0', roughness: 0.6, emissive: '#7a5a20', emissiveIntensity: 0.35 })); candle.position.y = 3.1 + 1.3; candle.castShadow = true; cs.add(candle);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), new THREE.MeshBasicMaterial({ color: '#150a05' })); wick.position.y = 3.1 + 2.7; cs.add(wick);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(flameCanvas(), { srgb: true }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  flame.scale.set(1.5, 2.3, 1); flame.position.y = 3.1 + 3.55; cs.add(flame);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(blobCanvas('255,170,70', 0.8, 128)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.scale.set(9, 9, 1); glow.position.y = 3.1 + 3.4; cs.add(glow);
  const light = new THREE.PointLight(0xffa23c, 90, 34, 1.7); light.position.y = 3.1 + 3.6; cs.add(light);
  cs.position.set(2.6, 0, -0.4); cs.userData = { slot: 'R', flame, glow, light }; props.add(cs);
  // loose nails + coins
  const nailG = new THREE.CylinderGeometry(0.09, 0.09, 2.3, 8), headG = new THREE.CylinderGeometry(0.24, 0.17, 0.1, 14);
  for (let k = 0; k < 3; k++) {
    const n = new THREE.Group(), s = new THREE.Mesh(nailG, iron), h = new THREE.Mesh(headG, iron); s.rotation.z = Math.PI / 2; h.rotation.z = Math.PI / 2; h.position.x = 1.17; s.castShadow = h.castShadow = true;
    n.add(s, h); n.position.set(0, 0.12, 0); n.userData = { slot: 'N' + k }; props.add(n);
  }
  const coinG = new THREE.CylinderGeometry(0.5, 0.5, 0.08, 22);
  for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(coinG, brass); c.castShadow = true; c.userData = { slot: 'C' + k }; props.add(c); }
  root.userData = { props, floor, dots, tank, cs };
  return root;
}
function flameCanvas() {
  const c = mkCanvas(64, 128), g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 84, 2, 32, 80, 56);
  rg.addColorStop(0, 'rgba(255,250,220,1)'); rg.addColorStop(0.25, 'rgba(255,205,90,0.95)'); rg.addColorStop(0.6, 'rgba(255,120,20,0.45)'); rg.addColorStop(1, 'rgba(255,60,0,0)');
  g.save(); g.translate(32, 0); g.scale(0.55, 1); g.translate(-32, 0); g.fillStyle = rg; g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(50, 40, 62, 70, 32, 124); g.bezierCurveTo(2, 70, 14, 40, 32, 4); g.fill(); g.restore();
  return c;
}
