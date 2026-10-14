// Takoyaki Flip Stall 3D models. Pure scene construction (no sim access). Units: 1 = one mould pitch of the pan (about 5.5 cm).
// Real sizes: ball 4-4.6 cm (R 0.42), mould 4.5 cm, pan 1.5 cm thick cast iron, picks 20 cm, ladle 18 cm, bottles 14-18 cm.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

export const TAU = Math.PI * 2;
export const MOULD_R = 0.43, PAN_T = 0.3, BALL_R = 0.42;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
export const canvasTex = (c, { srgb = true, repeat, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};
export const blobCanvas = (rgb = '0,0,0', a = 0.6, size = 128) => {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.55, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
};
export const ringCanvas = (rgb = '255,255,255', size = 128, inner = 0.7) => {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, size * 0.5 * inner * 0.75, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(inner, `rgba(${rgb},0.95)`); g.addColorStop(Math.min(0.97, inner + 0.16), `rgba(${rgb},0.35)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
};
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), u), L(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), u), v),
    L(L(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), u), L(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), u), v), w);
}

// ------------------------------------------------------------------------------------------------ materials
const matCache = {};
export function mats() {
  if (matCache.ready) return matCache;
  const m = matCache; m.ready = true;
  m.iron = new THREE.MeshPhysicalMaterial({ color: '#8a8a92', roughness: 0.52, metalness: 0.78, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.9 });
  m.steel = new THREE.MeshStandardMaterial({ color: '#8d9097', roughness: 0.42, metalness: 0.92, envMapIntensity: 0.8 });
  m.lip = new THREE.MeshStandardMaterial({ color: '#3a3b40', roughness: 0.34, metalness: 0.9, envMapIntensity: 0.7 });
  m.stove = new THREE.MeshPhysicalMaterial({ color: '#33343a', roughness: 0.42, metalness: 0.8, clearcoat: 0.4, clearcoatRoughness: 0.35, envMapIntensity: 0.7 });
  m.brass = B.material('brass', { envIntensity: 1.4 });
  m.wood = B.material('darkWood', { color: '#2e1c11', color2: '#4b2e1a', repeat: [4, 3], seed: 14, size: 512 });
  m.darkWood = B.material('darkWood', { color: '#3a2214', color2: '#5a3820', repeat: [3, 1], seed: 5 });
  m.paper = new THREE.MeshStandardMaterial({ color: '#f1e6c9', roughness: 0.85 });
  m.ceramic = new THREE.MeshPhysicalMaterial({ color: '#efe9dc', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.8 });
  m.batter = new THREE.MeshPhysicalMaterial({ color: '#e2c887', roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.18, sheen: 0.25, sheenColor: new THREE.Color('#ffe2a0'), sheenRoughness: 0.6, envMapIntensity: 0.4 });
  m.cooked = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.4 });
  m.burnt = new THREE.MeshStandardMaterial({ color: '#1d130c', roughness: 0.8 });
  m.pick = new THREE.MeshStandardMaterial({ color: '#d9dce2', roughness: 0.22, metalness: 1, envMapIntensity: 1.3 });
  m.rubber = new THREE.MeshStandardMaterial({ color: '#22252b', roughness: 0.6 });
  m.sauce = new THREE.MeshPhysicalMaterial({ color: '#3a1708', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1 });
  m.mayo = new THREE.MeshPhysicalMaterial({ color: '#f6efd8', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  m.aonori = new THREE.MeshStandardMaterial({ color: '#3d7a2a', roughness: 0.85 });
  m.bonito = new THREE.MeshStandardMaterial({ color: '#e7c08a', roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.93 });
  return m;
}

// ------------------------------------------------------------------------------------------------ counter planks (waxed dark walnut)
function counterCanvas() {
  const w = 2048, h = 1024, c = cv(w, h), x = c.getContext('2d'), r = lcg(41), rc = cv(w, h), rx = rc.getContext('2d');
  x.fillStyle = '#2a190e'; x.fillRect(0, 0, w, h);
  rx.fillStyle = 'rgb(120,120,120)'; rx.fillRect(0, 0, w, h);
  const n = 9, ph = h / n;
  for (let i = 0; i < n; i++) {
    const tone = 0.75 + r() * 0.5, y0 = i * ph;
    const g = x.createLinearGradient(0, y0, 0, y0 + ph);
    g.addColorStop(0, `rgb(${Math.round(70 * tone)},${Math.round(42 * tone)},${Math.round(24 * tone)})`); g.addColorStop(0.5, `rgb(${Math.round(84 * tone)},${Math.round(52 * tone)},${Math.round(30 * tone)})`); g.addColorStop(1, `rgb(${Math.round(64 * tone)},${Math.round(38 * tone)},${Math.round(22 * tone)})`);
    x.fillStyle = g; x.fillRect(0, y0, w, ph);
    for (let k = 0; k < 70; k++) {
      const yy = y0 + r() * ph, l = 200 + r() * 900, xx = r() * w;
      x.strokeStyle = `rgba(${r() < 0.5 ? '20,10,4' : '150,100,60'},${0.04 + r() * 0.07})`; x.lineWidth = 0.6 + r() * 1.6;
      x.beginPath(); x.moveTo(xx, yy); x.bezierCurveTo(xx + l * 0.3, yy + (r() - 0.5) * 6, xx + l * 0.7, yy + (r() - 0.5) * 6, xx + l, yy + (r() - 0.5) * 4); x.stroke();
    }
    if (r() < 0.5) { const kx = r() * w, ky = y0 + ph * (0.3 + r() * 0.4); const gg = x.createRadialGradient(kx, ky, 1, kx, ky, 26); gg.addColorStop(0, 'rgba(10,5,2,0.7)'); gg.addColorStop(1, 'rgba(10,5,2,0)'); x.fillStyle = gg; x.fillRect(kx - 30, ky - 30, 60, 60); }
    x.fillStyle = 'rgba(0,0,0,0.65)'; x.fillRect(0, y0, w, 3);                       // seam between boards
    x.fillStyle = 'rgba(255,220,170,0.07)'; x.fillRect(0, y0 + 3, w, 2);
    for (let j = 0; j < 2; j++) { const cx = r() * w; x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(cx, y0, 3, ph); }
    rx.fillStyle = `rgb(${Math.round(90 + r() * 70)},0,0)`; rx.fillRect(0, y0, w, ph);
  }
  // spilled oil and scorch near the middle, wiped streaks
  for (let k = 0; k < 14; k++) { const px = w * 0.3 + r() * w * 0.4, py = r() * h, rr = 40 + r() * 120; const gg = x.createRadialGradient(px, py, 0, px, py, rr); gg.addColorStop(0, 'rgba(10,5,0,0.22)'); gg.addColorStop(1, 'rgba(10,5,0,0)'); x.fillStyle = gg; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  return { map: c, rough: rc };
}

// ------------------------------------------------------------------------------------------------ cast-iron pan
function ironCanvas(W, D, seed = 4) {
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = lcg(seed), rc = cv(S), rx = rc.getContext('2d');
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#34343a'); g.addColorStop(0.5, '#27272c'); g.addColorStop(1, '#1d1d22');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  rx.fillStyle = 'rgb(128,128,128)'; rx.fillRect(0, 0, S, S);
  // seasoning: oil swirls and brush marks
  for (let k = 0; k < 90; k++) {
    const px = r() * S, py = r() * S, a = r() * TAU, l = 40 + r() * 160;
    x.strokeStyle = `rgba(${r() < 0.5 ? '90,60,30' : '10,10,12'},${0.05 + r() * 0.09})`; x.lineWidth = 3 + r() * 14; x.lineCap = 'round';
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + (r() - 0.5) * 50, py + Math.sin(a) * l * 0.5 + (r() - 0.5) * 50, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    rx.strokeStyle = `rgba(${r() < 0.5 ? 70 : 190},${r() < 0.5 ? 70 : 190},0,0.12)`; rx.lineWidth = x.lineWidth; rx.beginPath(); rx.moveTo(px, py); rx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); rx.stroke();
  }
  for (let k = 0; k < 9000; k++) { const v = r() < 0.5 ? 255 : 0; x.fillStyle = `rgba(${v},${v},${v},${0.012 + r() * 0.03})`; x.fillRect(r() * S, r() * S, 1 + r() * 2.5, 1 + r() * 2.5); }
  // casting pits
  for (let k = 0; k < 260; k++) { x.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.25})`; x.beginPath(); x.arc(r() * S, r() * S, 0.8 + r() * 2.2, 0, TAU); x.fill(); }
  // oil film pools (low roughness)
  for (let k = 0; k < 20; k++) { const px = r() * S, py = r() * S, rr = 30 + r() * 90, gg = rx.createRadialGradient(px, py, 0, px, py, rr); gg.addColorStop(0, 'rgba(0,0,0,0.4)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); rx.fillStyle = gg; rx.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  void W; void D;
  return { map: c, rough: rc };
}

export function buildPan(cols, rows, quality = 1) {
  const M = mats(), g = new THREE.Group(), W = cols + 0.55, D = rows + 0.55;
  const shape = new THREE.Shape();
  const rad = 0.34, hx = W / 2, hz = D / 2;
  shape.moveTo(-hx + rad, -hz); shape.lineTo(hx - rad, -hz); shape.absarc(hx - rad, -hz + rad, rad, -Math.PI / 2, 0, false);
  shape.lineTo(hx, hz - rad); shape.absarc(hx - rad, hz - rad, rad, 0, Math.PI / 2, false);
  shape.lineTo(-hx + rad, hz); shape.absarc(-hx + rad, hz - rad, rad, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hx, -hz + rad); shape.absarc(-hx + rad, -hz + rad, rad, Math.PI, Math.PI * 1.5, false);
  const centers = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c - (cols - 1) / 2, z = r - (rows - 1) / 2; centers.push({ x, z });
    const h = new THREE.Path(); h.absarc(x, -z, MOULD_R, 0, TAU, true); shape.holes.push(h);   // shape y = -z after the rotation below
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: PAN_T - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: quality > 0.6 ? 28 : 16 });
  geo.rotateX(-Math.PI / 2);          // extrude +z becomes +y; shape y becomes -z
  geo.translate(0, -(PAN_T - 0.03), 0);
  const t = ironCanvas(W, D), map = canvasTex(t.map), rmap = canvasTex(t.rough, { srgb: false });
  for (const tx of [map, rmap]) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(1 / W, 1 / D); tx.offset.set(0.5, 0.5); }
  // ExtrudeGeometry UVs are the shape x,y: after the rotate they are still (x, -z) values. offset centres them.
  const topMat = new THREE.MeshPhysicalMaterial({ map, roughnessMap: rmap, bumpMap: rmap, bumpScale: 1.2, color: '#d6d6dc', roughness: 1, metalness: 0.7, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 1 });
  const body = new THREE.Mesh(geo, [topMat, M.iron]);
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  // bowls: concave hemispheres under each hole
  const prof = [];
  for (let i = 0; i <= 14; i++) { const a = (i / 14) * (Math.PI / 2); prof.push([Math.sin(a) * MOULD_R, -Math.cos(a) * MOULD_R * 0.98 + 0.0]); }
  prof.reverse();                     // top lip (r = R, y = 0) down to the bottom
  const bowlGeo = B.lathe(prof.map(([r, y]) => [r, y]).reverse(), quality > 0.6 ? 36 : 22);
  { const p = bowlGeo.attributes.position, col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const d = clamp01(1 + p.getY(i) / MOULD_R); const v = 0.18 + 0.82 * d * d; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v; } bowlGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const moulds = [];
  centers.forEach((p, i) => {
    const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, color: '#2a2a30', roughness: 0.3, metalness: 0.7, clearcoat: 0.9, clearcoatRoughness: 0.18, envMapIntensity: 0.7, side: THREE.DoubleSide, emissive: new THREE.Color('#ff6a20'), emissiveIntensity: 0 });
    const bowl = new THREE.Mesh(bowlGeo, mat); bowl.position.set(p.x, -0.0, p.z); bowl.receiveShadow = true; g.add(bowl);
    // polished lip ring where the ball meets the iron
    const lip = new THREE.Mesh(new THREE.TorusGeometry(MOULD_R, 0.028, 8, quality > 0.6 ? 36 : 20), M.steel); lip.rotation.x = Math.PI / 2; lip.position.set(p.x, 0.012, p.z); g.add(lip);
    moulds.push({ x: p.x, z: p.z, mat, i });
  });
  // handles
  for (const s of [-1, 1]) {
    const h = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.7, 14), M.iron); bar.rotation.z = Math.PI / 2; bar.position.x = s * (W / 2 + 0.7); h.add(bar);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 1.2, 16), M.darkWood); grip.rotation.z = Math.PI / 2; grip.position.x = s * (W / 2 + 1.75); h.add(grip);
    h.position.y = -0.1; h.traverse((o) => { if (o.isMesh) { o.castShadow = true; } }); g.add(h);
  }
  g.userData = { W, D, moulds, dispose() { geo.dispose(); map.dispose(); rmap.dispose(); topMat.dispose(); bowlGeo.dispose(); moulds.forEach((m) => m.mat.dispose()); } };
  return g;
}

// ------------------------------------------------------------------------------------------------ the ball
let ballBase = null;
function ballBaseGeo(seg) {
  if (ballBase && ballBase.seg === seg) return ballBase;
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
  const ang = new Float32Array(n), nz = new Float32Array(n), e = 0.02;
  const f = (x, y, z) => vnoise(x * 3.1, y * 3.1, z * 3.1) * 0.6 + vnoise(x * 7.7 + 3, y * 7.7, z * 7.7) * 0.4;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), v = f(x, y, z);
    const gx = (f(x + e, y, z) - v) / e, gy = (f(x, y + e, z) - v) / e, gz = (f(x, y, z + e) - v) / e, A = 0.05;
    const r = 1 + (v - 0.5) * A * 2;
    pos.setXYZ(i, x * r, y * r, z * r);
    const nx = x - gx * A * 0.7, ny = y - gy * A * 0.7, nzv = z - gz * A * 0.7, l = Math.hypot(nx, ny, nzv) || 1;
    nor.setXYZ(i, nx / l, ny / l, nzv / l);
    ang[i] = Math.atan2(y, z); nz[i] = v;
  }
  ballBase = { seg, geo: g, ang, nz };
  return ballBase;
}
const _c = new THREE.Color(), _c2 = new THREE.Color();
const colorCache = new Map();
const STOPS3 = [[0, '#f3e5bc'], [0.28, '#ebca84'], [0.5, '#dfa64c'], [0.7, '#c98131'], [0.9, '#a95f1f'], [1.1, '#7c4013'], [1.28, '#46200a'], [1.45, '#1c0e06']];
const stopCols = STOPS3.map(([v, c]) => [v, new THREE.Color(c)]);
const colOf = (q) => {
  const k = Math.round(q * 40); let c = colorCache.get(k);
  if (!c) {
    const v = k / 40; c = new THREE.Color();
    if (v <= 0) c.copy(stopCols[0][1]);
    else if (v >= 1.45) c.copy(stopCols[stopCols.length - 1][1]);
    else for (let i = 1; i < stopCols.length; i++) if (v <= stopCols[i][0]) { c.copy(stopCols[i - 1][1]).lerp(stopCols[i][1], (v - stopCols[i - 1][0]) / (stopCols[i][0] - stopCols[i - 1][0])); break; }
    colorCache.set(k, c);
  }
  return c;
};

let smoothG = null;
const smoothSphere = () => smoothG || (smoothG = new THREE.SphereGeometry(1, 36, 26));
// one ball: a vertex-coloured sphere whose four quarters carry the sim's doneness; rotation about X shows the bottom quarter.
export function makeBall(quality = 1) {
  const M = mats(), base = ballBaseGeo(quality > 0.6 ? 40 : 24), geo = base.geo.clone();
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(base.ang.length * 3), 3));
  const mesh = new THREE.Mesh(geo, M.cooked); mesh.castShadow = true; mesh.receiveShadow = true;
  const raw = new THREE.Mesh(smoothSphere(), M.batter); raw.castShadow = true; raw.receiveShadow = true;
  const burnt = new THREE.Mesh(base.geo, M.burnt); burnt.castShadow = true;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 28), M.batter); disc.rotation.x = -Math.PI / 2;   // thin batter pool in the bowl
  const skirt = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshStandardMaterial({ color: '#f1e1ae', roughness: 0.4, transparent: true, opacity: 0.6, depthWrite: false })); skirt.rotation.x = -Math.PI / 2;
  const root = new THREE.Group(), spin = new THREE.Group();   // spin carries the rotation, root the lift / squash
  spin.add(mesh, raw, burnt); root.add(spin, disc, skirt);
  const st = { key: '' };
  function paint(q, hs) {
    const c = geo.attributes.color, a = base.ang, nz = base.nz;
    const cols = [colOf(q[0]), colOf(q[1]), colOf(q[2]), colOf(q[3])];
    for (let i = 0; i < a.length; i++) {
      const s = a[i] / (Math.PI / 2) + 0.5, k = Math.floor(s), gpos = s - k;
      const k0 = ((k % 4) + 4) % 4;
      let ca = cols[k0];
      if (gpos < 0.18) { const w = 0.5 + 0.5 * smooth(0, 0.18, gpos); _c.copy(cols[(k0 + 3) % 4]).lerp(ca, w); ca = _c; }
      else if (gpos > 0.82) { const w = 0.5 * smooth(0.82, 1, gpos); _c.copy(ca).lerp(cols[(k0 + 1) % 4], w); ca = _c; }
      const sh = 0.86 + nz[i] * 0.3 + (hs > 1.2 ? 0.0 : 0);
      c.setXYZ(i, ca.r * sh, ca.g * sh, ca.b * sh);
    }
    c.needsUpdate = true;
  }
  return { root, spin, mesh, raw, burnt, disc, skirt, paint, st, dispose() { geo.dispose(); disc.geometry.dispose(); skirt.geometry.dispose(); skirt.material.dispose(); } };
}

// ------------------------------------------------------------------------------------------------ fillings (visible in the batter before the first flip)
export function makeFilling(id, seed = 1) {
  const g = new THREE.Group(), r = lcg(seed * 977 + id.length * 31);
  const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; };
  if (id === 'cheese') {
    const mat = new THREE.MeshPhysicalMaterial({ color: '#ffcb3a', roughness: 0.35, clearcoat: 0.5 });
    for (let k = 0; k < 4; k++) { const m = mk(new THREE.BoxGeometry(0.2, 0.14, 0.2), mat); m.position.set((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5); m.rotation.y = r() * 3; g.add(m); }
  } else if (id === 'corn') {
    const mat = new THREE.MeshPhysicalMaterial({ color: '#ffd23f', roughness: 0.3, clearcoat: 0.8 });
    for (let k = 0; k < 9; k++) { const m = mk(new THREE.SphereGeometry(0.075, 10, 8), mat); m.scale.y = 1.2; m.position.set((r() - 0.5) * 0.62, 0, (r() - 0.5) * 0.62); g.add(m); }
  } else if (id === 'mushroom') {
    const cap = new THREE.MeshStandardMaterial({ color: '#b98a5a', roughness: 0.6 }), stem = new THREE.MeshStandardMaterial({ color: '#efe1c8', roughness: 0.7 });
    for (let k = 0; k < 3; k++) {
      const gg = new THREE.Group(), c = mk(new THREE.SphereGeometry(0.17, 12, 8, 0, TAU, 0, Math.PI / 2), cap), s = mk(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8), stem); s.position.y = -0.06; gg.add(c, s);
      gg.position.set((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5); gg.rotation.set((r() - 0.5) * 0.7, r() * 3, (r() - 0.5) * 0.7); g.add(gg);
    }
  } else if (id === 'onion') {
    const mat = new THREE.MeshStandardMaterial({ color: '#7bd646', roughness: 0.55 });
    for (let k = 0; k < 8; k++) { const m = mk(new THREE.TorusGeometry(0.075 + r() * 0.03, 0.028, 6, 12), mat); m.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.8, r() * 3, 0); m.position.set((r() - 0.5) * 0.62, 0, (r() - 0.5) * 0.62); g.add(m); }
  }
  return g;
}

// ------------------------------------------------------------------------------------------------ tools
export function makeLadle() {
  const M = mats(), g = new THREE.Group();
  const cup = new THREE.Mesh(B.lathe([[0, 0], [0.12, -0.02], [0.24, 0.04], [0.33, 0.16], [0.36, 0.3], [0.33, 0.3], [0.3, 0.17], [0.21, 0.07], [0.1, 0.02], [0, 0.01]].map(([r, y]) => [r, y - 0.18]), 28), M.steel);
  cup.material = M.steel.clone(); cup.material.side = THREE.DoubleSide; cup.castShadow = true;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.9, 10), M.darkWood); handle.rotation.z = Math.PI / 2; handle.position.set(1.7, 0.18, 0); handle.rotation.set(0, 0, Math.PI / 2 - 0.35); handle.castShadow = true;
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), M.steel); shank.rotation.z = Math.PI / 2 - 0.5; shank.position.set(0.55, 0.07, 0);
  g.add(cup, shank, handle);
  // batter in the cup
  const fill = new THREE.Mesh(new THREE.CircleGeometry(0.31, 20), M.batter); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.04; g.add(fill);
  return g;
}
export function makePicks() {
  const M = mats(), g = new THREE.Group();
  for (const s of [-1, 1]) {
    const p = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 3.6, 8), M.pick); shaft.rotation.x = Math.PI / 2; shaft.position.z = -1.8;
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.022, 0.45, 8), M.pick); tip.rotation.x = Math.PI / 2; tip.position.z = -3.8;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.pick); cap.position.z = 0.02;
    p.add(shaft, tip, cap); p.userData.side = s; p.children.forEach((c) => { c.castShadow = true; });
    g.add(p);
  }
  return g;
}

// ------------------------------------------------------------------------------------------------ served ball (sauce, mayo, aonori, bonito flakes that dance in the heat)
export function makeServed(seed = 1) {
  const M = mats(), g = new THREE.Group(), r = lcg(seed * 53 + 7);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), new THREE.MeshPhysicalMaterial({ color: '#d9923a', roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.35 }));
  ball.castShadow = true; g.add(ball);
  // sauce: a glossy glaze over the upper cap
  const glaze = new THREE.Mesh(new THREE.SphereGeometry(1.012, 28, 12, 0, TAU, 0, 1.15), M.sauce); glaze.rotation.x = 0.35; g.add(glaze);
  // mayo: a zigzag tube across the glaze
  const pts = [];
  for (let k = 0; k <= 12; k++) { const u = k / 12 - 0.5, x = u * 1.5, z = (k % 2 ? 0.2 : -0.2) * (1 - Math.abs(u) * 0.9) + 0.0; const y = Math.sqrt(Math.max(0.02, 1 - x * x - z * z)) * 1.035; pts.push(new THREE.Vector3(x, y, z)); }
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.055, 8), M.mayo); tube.rotation.x = 0.35; g.add(tube);
  // aonori specks
  for (let k = 0; k < 24; k++) {
    const a = r() * TAU, e = r() * 0.9, y = Math.cos(e), rr = Math.sin(e), p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.05), M.aonori);
    p.position.set(Math.cos(a) * rr * 1.03, y * 1.03 + 0.0, Math.sin(a) * rr * 1.03); p.lookAt(p.position.clone().multiplyScalar(2)); g.add(p);
  }
  // bonito flakes: thin curled strips standing on the top, swaying in the rising heat
  const flakes = [];
  for (let k = 0; k < 9; k++) {
    const geo = new THREE.PlaneGeometry(0.34, 0.12, 6, 1), f = new THREE.Mesh(geo, M.bonito);
    f.userData = { base: geo.attributes.position.array.slice(), ph: r() * TAU, sp: 0.8 + r() * 0.9, amp: 0.25 + r() * 0.3 };
    const a = r() * TAU, e = r() * 0.55;
    f.position.set(Math.cos(a) * Math.sin(e) * 0.98, Math.cos(e) * 1.0 + 0.04, Math.sin(a) * Math.sin(e) * 0.98);
    f.rotation.set(-Math.PI / 2 + (r() - 0.5) * 1.0, a, (r() - 0.5) * 1.2);
    g.add(f); flakes.push(f);
  }
  function update(t, k = 1) {
    for (const f of flakes) {
      const u = f.userData, p = f.geometry.attributes.position, a = u.base;
      for (let i = 0; i < p.count; i++) {
        const x = a[i * 3], y = a[i * 3 + 1];
        const w = Math.sin(t * 2.2 * u.sp + u.ph + x * 6) * 0.07 * u.amp * k * (0.4 + (x + 0.17) * 3);
        p.setXYZ(i, x, y, a[i * 3 + 2] + w + (x + 0.17) * (x + 0.17) * 1.6 * u.amp);
      }
      p.needsUpdate = true;
      f.rotation.z += Math.sin(t * 1.6 * u.sp + u.ph) * 0.002 * k;
    }
  }
  g.userData = { update, ball };
  return g;
}

// ------------------------------------------------------------------------------------------------ paper boat for the result screen / hero
export function makeBoat(n = 6) {
  const M = mats(), g = new THREE.Group();
  const boat = new THREE.Mesh(B.slab(Math.max(3.2, n * 0.62), 2.0, 0.55, 0.3, 0.12), M.paper); boat.position.y = -0.55; boat.castShadow = true; boat.receiveShadow = true; g.add(boat);
  const inner = new THREE.Mesh(B.slab(Math.max(3.2, n * 0.62) - 0.3, 1.7, 0.1, 0.25, 0.04), new THREE.MeshStandardMaterial({ color: '#cdb68a', roughness: 0.9 })); inner.position.y = -0.03; g.add(inner);
  const balls = [];
  const per = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const row = i < per ? 0 : 1, col = row ? i - per : i, cnt = row ? n - per : per;
    const s = makeServed(i + 3), x = (col - (cnt - 1) / 2) * 1.12 + (row ? 0.3 : 0), z = row ? 0.5 : -0.45;
    s.position.set(x, 0.42, z); s.scale.setScalar(0.5); s.rotation.y = i * 1.3; g.add(s); balls.push(s);
  }
  // wooden skewer
  const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 6), M.wood); sk.rotation.set(0.1, 0, Math.PI / 2 - 0.15); sk.position.set(0.3, 0.98, 0.1); g.add(sk);
  g.userData = { balls, update(t) { balls.forEach((b, i) => b.userData.update(t + i * 0.7, 1)); } };
  return g;
}

// ------------------------------------------------------------------------------------------------ the stall around the pan
function norenCanvas() {
  const w = 512, h = 256, c = cv(w, h), x = c.getContext('2d');
  x.fillStyle = '#1e2f56'; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 200; k++) { x.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.03})`; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1); }
  x.fillStyle = '#e9e3d0'; x.fillRect(0, 0, w, 14); x.fillRect(0, h - 14, w, 14);
  x.font = '800 92px "Barlow Condensed", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#f2ecd8';
  x.fillText('TAKOYAKI', w / 2, h / 2 + 2);
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, h); x.stroke(); }
  return c;
}
function bokehCanvas() { return blobCanvas('255,255,255', 1, 64); }

export const COUNTER_Y = -PAN_T - 0.02;
export function buildStall({ cols = 4, rows = 3, quality = 1 } = {}) {
  const M = mats(), g = new THREE.Group();
  const W = cols + 0.55, D = rows + 0.55, counterY = COUNTER_Y;
  // counter and steel surround
  const ct = counterCanvas(), cMap = canvasTex(ct.map), cRough = canvasTex(ct.rough, { srgb: false });
  const counterMat = new THREE.MeshPhysicalMaterial({ map: cMap, roughnessMap: cRough, roughness: 1, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.6, color: '#ffffff' });
  const counter = new THREE.Mesh(B.roundedBox(34, 0.6, 15, 0.1, 3), [counterMat, counterMat, counterMat, counterMat, counterMat, counterMat]);
  const cuv = counter.geometry.attributes.uv; for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i), cuv.getY(i)); counter.position.set(0, counterY - 0.3, -2.2); counter.receiveShadow = true; counter.castShadow = true; g.add(counter);
  // folded towel (tenugui), oil pot with brush, pick caddy near the cook
  const towel = new THREE.Mesh(B.roundedBox(1.7, 0.18, 1.0, 0.07, 3), new THREE.MeshStandardMaterial({ color: '#d9d4c4', roughness: 0.95 }));
  towel.position.set(-(W / 2 + 3.3), counterY + 0.09, D / 2 + 0.5); towel.rotation.y = 0.35; towel.castShadow = true; g.add(towel);
  const stripe = new THREE.Mesh(B.roundedBox(1.72, 0.04, 0.26, 0.02, 2), new THREE.MeshStandardMaterial({ color: '#1e2f56', roughness: 0.9 })); stripe.position.copy(towel.position); stripe.position.y += 0.1; stripe.rotation.y = 0.35; g.add(stripe);
  // far row: batter bowl, sauce, mayo, aonori, bonito
  const farZ = -(D / 2 + 1.9), props = new THREE.Group(); g.add(props);
  const bowlX = -(W / 2 + 0.4);
  const bowl = new THREE.Mesh(B.lathe([[0, 0], [0.7, 0], [0.9, 0.12], [1.15, 0.7], [1.2, 0.95], [1.12, 0.95], [1.05, 0.7], [0.82, 0.22], [0, 0.18]], 36), M.ceramic); bowl.material = M.ceramic.clone(); bowl.material.side = THREE.DoubleSide;
  bowl.position.set(bowlX, counterY, farZ); bowl.castShadow = true; props.add(bowl);
  const bat = new THREE.Mesh(new THREE.CircleGeometry(1.0, 28), M.batter); bat.rotation.x = -Math.PI / 2; bat.position.set(bowlX, counterY + 0.78, farZ); props.add(bat);
  const bottle = (x, bodyC, capC, h = 2.7, r = 0.42) => {
    const b = new THREE.Group();
    const body = new THREE.Mesh(B.lathe([[0, 0], [r * 0.95, 0], [r, 0.12], [r, h * 0.62], [r * 0.7, h * 0.78], [r * 0.3, h * 0.88], [r * 0.3, h * 0.94], [0, h * 0.94]], 24), new THREE.MeshPhysicalMaterial({ color: bodyC, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }));
    body.castShadow = true; b.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.3, 0.42, 12), new THREE.MeshStandardMaterial({ color: capC, roughness: 0.4 }));
    cap.position.y = h * 0.94 + 0.2; b.add(cap);
    b.position.set(x, counterY, farZ - 0.1); return b;
  };
  props.add(bottle(bowlX + 2.6, '#4a1f0d', '#d8c9a8'));          // sauce
  props.add(bottle(bowlX + 3.7, '#efe7d2', '#c2342a'));           // mayo
  const shaker = new THREE.Mesh(B.lathe([[0, 0], [0.4, 0], [0.42, 1.1], [0.36, 1.2], [0, 1.2]], 20), new THREE.MeshPhysicalMaterial({ color: '#3d7a2a', roughness: 0.3, clearcoat: 0.8 }));
  shaker.position.set(bowlX + 4.8, counterY, farZ); shaker.castShadow = true; props.add(shaker);
  const jarLid = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.16, 18), M.steel); jarLid.position.set(bowlX + 4.8, counterY + 1.28, farZ); props.add(jarLid);
  const bag = new THREE.Mesh(B.roundedBox(1.1, 1.4, 0.5, 0.18, 3), new THREE.MeshStandardMaterial({ color: '#c9a56a', roughness: 0.85 })); bag.position.set(bowlX + 6.2, counterY + 0.7, farZ); bag.rotation.y = -0.2; bag.castShadow = true; props.add(bag);
  // stall frame: posts, beam, noren and paper lanterns
  const postX = (W / 2 + 7.2), postZ = -(D / 2 + 5);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(B.roundedBox(0.7, 16, 0.7, 0.08, 2), M.darkWood); p.position.set(s * postX, 6, postZ); p.castShadow = true; g.add(p); }
  const beam = new THREE.Mesh(B.roundedBox(postX * 2 + 1.2, 0.8, 0.8, 0.1, 2), M.darkWood); beam.position.set(0, 13.2, postZ); g.add(beam);
  const norenTex = canvasTex(norenCanvas());
  const noren = [];
  for (let k = 0; k < 4; k++) {
    const w = 4.4, gx = (k - 1.5) * (w + 0.12), cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.6, 10, 6), new THREE.MeshStandardMaterial({ map: norenTex, roughness: 0.95, side: THREE.DoubleSide }));
    const uvs = cloth.geometry.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 0.25 + k * 0.25, uvs.getY(i));
    cloth.position.set(gx, 10.5, postZ + 0.5); cloth.userData = { base: cloth.geometry.attributes.position.array.slice(), k }; g.add(cloth); noren.push(cloth);
  }
  // lanterns on the beam
  const lanterns = [];
  const lantern = (x, y, z, col, em, k) => {
    const gr = new THREE.Group(); gr.position.set(x, y, z);
    const body = new THREE.Mesh(B.lathe([[0, -0.9], [0.3, -0.9], [0.62, -0.55], [0.78, 0], [0.62, 0.55], [0.3, 0.9], [0, 0.9]], 24), new THREE.MeshStandardMaterial({ color: col, emissive: em, emissiveIntensity: 1.7, roughness: 0.7 }));
    gr.add(body);
    for (const yy of [0.92, -0.92]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 16), new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.6 })); cap.position.y = yy; gr.add(cap); }
    for (let r = -2; r <= 2; r++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.7 - Math.abs(r) * 0.08, 0.012, 4, 24), new THREE.MeshBasicMaterial({ color: '#2a0a06' })); rib.rotation.x = Math.PI / 2; rib.position.y = r * 0.34; gr.add(rib); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(blobCanvas('255,170,90', 0.95, 128)), color: em, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.scale.setScalar(6); gr.add(glow);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.0, 5), new THREE.MeshBasicMaterial({ color: '#2a1a10' })); cord.position.y = 2.4; gr.add(cord);
    g.add(gr); lanterns.push({ gr, glow, ph: k * 1.9 });
  };
  lantern(-postX + 2.2, 11.2, postZ + 1.6, '#c8281f', '#ff6a30', 0);
  lantern(postX - 2.2, 11.4, postZ + 1.6, '#c8281f', '#ff6a30', 1);
  lantern(-3.2, 11.0, postZ + 1.2, '#f0b340', '#ffd070', 2);
  lantern(3.6, 11.1, postZ + 1.2, '#f0b340', '#ffd070', 3);
  // far street: bokeh of lights and dark stalls
  const bokeh = [], bt = canvasTex(bokehCanvas());
  const bl = lcg(91);
  for (let k = 0; k < 46; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bt, color: ['#ffb060', '#ff7a4a', '#ffe0a0', '#8ab4ff', '#ff9f6a'][k % 5], transparent: true, opacity: 0.2 + bl() * 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sp.position.set((bl() - 0.5) * 70, 2 + bl() * 12, -22 - bl() * 20); sp.scale.setScalar(1.4 + bl() * 3.2); g.add(sp); bokeh.push(sp);
  }
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(120, 50), new THREE.MeshBasicMaterial({ color: '#0d0709', fog: false })); backdrop.position.set(0, 8, -40); g.add(backdrop);
  // warm light spill on the counter
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), new THREE.MeshBasicMaterial({ map: canvasTex(blobCanvas('255,190,110', 0.55, 128)), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  spill.rotation.x = -Math.PI / 2; spill.position.set(0, counterY + 0.012, -1); g.add(spill);
  // flame glow under the pan edge (gas burner)
  const flame = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.2, 1.6), new THREE.MeshBasicMaterial({ map: canvasTex(blobCanvas('255,120,40', 1, 128)), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  flame.position.set(0, -0.2, D / 2 + 0.7); g.add(flame);
  return {
    group: g, lanterns, noren, flame, bokeh,
    update(t, calm, flameLvl = 1) {
      const k = calm ? 0.4 : 1;
      for (const L of lanterns) { L.gr.rotation.z = Math.sin(t * 0.9 + L.ph) * 0.05 * k; L.gr.rotation.x = Math.cos(t * 0.7 + L.ph) * 0.03 * k; L.glow.material.opacity = 0.58 + 0.12 * Math.sin(t * 7.3 + L.ph * 3) * k; }
      for (const c of noren) {
        const p = c.geometry.attributes.position, a = c.userData.base;
        for (let i = 0; i < p.count; i++) { const y = a[i * 3 + 1], hang = (2.3 - y) / 4.6; p.setZ(i, a[i * 3 + 2] + Math.sin(t * 1.3 + c.userData.k * 1.1 + a[i * 3] * 0.5 + y * 0.4) * 0.08 * hang * hang * 4 * k); }
        p.needsUpdate = true;
      }
      flame.material.opacity = (0.28 + 0.2 * flameLvl) * (0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 5.3));
    },
  };
}
