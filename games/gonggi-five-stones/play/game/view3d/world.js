// Gonggi 3D world: an ondol room floor of oiled jangpan paper, a bojagi patchwork cloth, five glossy pebbles, the glass palm ring,
// a brass bowl and a celadon cup, and the lattice-window light. Everything is procedural (canvas textures, lathe/sphere geometry).
// Units: centimetres. One game world unit (the flat art's 660 x 800 cloth) = U cm, so the cloth is 33 x 40 cm and a pebble 2.4 cm.
import * as THREE from '../vendor3d/three.js';
// 3D pebble colours: the same five families as the flat art (ivory, slate, rose, jade, amber), richer for lit, glossy stones
const STONE_PAL = [
  { hi: '#fffaf0', mid: '#ece0c6', lo: '#b9a684', dot: 'rgba(120,96,60,0.4)' },
  { hi: '#9fc2f2', mid: '#3f6cbc', lo: '#1f3a78', dot: 'rgba(16,30,70,0.45)' },
  { hi: '#ffc0c8', mid: '#de546c', lo: '#8e2238', dot: 'rgba(90,20,36,0.4)' },
  { hi: '#aef0cf', mid: '#2ea377', lo: '#145c42', dot: 'rgba(10,50,34,0.4)' },
  { hi: '#ffe2a0', mid: '#e7a127', lo: '#99600e', dot: 'rgba(90,50,8,0.4)' },
];

export const U = 0.05;                 // cm per world unit
export const CLOTH_W = 660 * U, CLOTH_D = 800 * U;
export const CLOTH_Y = 0.32;           // cloth top (folded ramie, ~3 mm)
export const MARK_Y = CLOTH_Y + 0.05;  // the overlay (routes, rings) lies just above the cloth
export const STONE_R = 24 * U * 1.12;  // 1.34 cm: the 2.4 cm pebble drawn 1.12x for phone legibility
export const STONE_H = 0.64;           // height / width of a pebble (they are flattened)
export const w2x = (x) => (x - 330) * U;
export const w2z = (y) => (y - 400) * U;

const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const texOf = (c, srgb = true, rep = null) => {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
};

// soft round dot (contact shadows, dust)
const dots = new Map();
export function softDot(rgb = '0,0,0', size = 128) {
  if (dots.has(rgb)) return dots.get(rgb);
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.45, `rgba(${rgb},0.55)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = texOf(c); dots.set(rgb, t); return t;
}
export function clearCaches() { dots.clear(); }

// ---------------------------------------------------------------- the ondol floor: oiled jangpan paper sheets, honey-amber and glossy
export function floorMesh() {
  const N = 1024, c = cv(N), x = c.getContext('2d'), b = cv(N), y = b.getContext('2d'), r = rnd(7);
  // one tile = 3 x 3 sheets of 40 cm (the texture repeats every 120 cm)
  const S = N / 3;
  y.fillStyle = '#808080'; y.fillRect(0, 0, N, N);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const v = r() * 0.14 - 0.07;
    const g = x.createLinearGradient(i * S, j * S, (i + 1) * S, (j + 1) * S);
    const base = [150 + v * 110, 92 + v * 80, 38 + v * 40];
    g.addColorStop(0, `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`); g.addColorStop(1, `rgb(${(base[0] - 16) | 0},${(base[1] - 14) | 0},${(base[2] - 8) | 0})`);
    x.fillStyle = g; x.fillRect(i * S, j * S, S, S);
  }
  // paper fibres
  for (let k = 0; k < 2600; k++) {
    const px = r() * N, py = r() * N, l = 6 + r() * 28, a = r() * Math.PI;
    x.strokeStyle = `rgba(${r() < 0.5 ? '230,180,110' : '110,58,18'},${0.03 + r() * 0.04})`; x.lineWidth = 0.5 + r() * 0.6;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    y.strokeStyle = `rgba(${r() < 0.5 ? '160,160,160' : '100,100,100'},0.4)`; y.lineWidth = 1; y.beginPath(); y.moveTo(px, py); y.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); y.stroke();
  }
  // oil mottling
  for (let k = 0; k < 90; k++) { const px = r() * N, py = r() * N, rr = 30 + r() * 120, g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, `rgba(110,52,12,${0.05 + r() * 0.07})`); g.addColorStop(1, 'rgba(110,52,12,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  // the overlapped seams: a darker band with a bright lip (each sheet laps over the next by ~1 cm)
  for (let i = 0; i <= 3; i++) {
    const p = i * S;
    x.fillStyle = 'rgba(92,44,10,0.38)'; x.fillRect(p - 6, 0, 10, N); x.fillRect(0, p - 6, N, 10);
    x.fillStyle = 'rgba(255,214,140,0.22)'; x.fillRect(p + 4, 0, 2, N); x.fillRect(0, p + 4, N, 2);
    y.fillStyle = '#b4b4b4'; y.fillRect(p - 6, 0, 10, N); y.fillRect(0, p - 6, N, 10);
    y.fillStyle = '#5a5a5a'; y.fillRect(p + 4, 0, 3, N); y.fillRect(0, p + 4, N, 3);
  }
  const SZ = 600, rep = SZ / 120;
  const mat = new THREE.MeshStandardMaterial({ map: texOf(c, true, [rep, rep]), bumpMap: texOf(b, false, [rep, rep]), bumpScale: 0.5, roughness: 0.42, metalness: 0, envMapIntensity: 0.18 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(SZ, SZ), mat);
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; m.position.set(0, 0, -SZ * 0.25);
  return m;
}

// ---------------------------------------------------------------- the bojagi cloth: pieced ramie patches, flat seams, running stitches
const PATCH_COLS = [0, 205, 440, 660], PATCH_ROWS = [0, 175, 330, 520, 665, 800];
const PATCH_COL = [
  ['#2f3f86', '#cf5a30', '#22766f'],
  ['#d39c3a', '#efe0c0', '#7f3f74'],
  ['#22766f', '#2f3f86', '#cf5a30'],
  ['#bb4560', '#22766f', '#d39c3a'],
  ['#efe0c0', '#7f3f74', '#2f3f86'],
];
export function paintCloth(k = 2) {
  const W = 660 * k, H = 800 * k, c = cv(W, H), x = c.getContext('2d'), b = cv(W, H), y = b.getContext('2d'), r = rnd(11);
  x.scale(k, k); y.scale(k, k);
  y.fillStyle = '#7a7a7a'; y.fillRect(0, 0, 660, 800);
  for (let ri = 0; ri < 5; ri++) for (let ci = 0; ci < 3; ci++) {
    const x0 = PATCH_COLS[ci], x1 = PATCH_COLS[ci + 1], y0 = PATCH_ROWS[ri], y1 = PATCH_ROWS[ri + 1];
    x.fillStyle = PATCH_COL[ri][ci]; x.fillRect(x0, y0, x1 - x0, y1 - y0);
    // slight dye unevenness
    for (let n = 0; n < 6; n++) { const px = x0 + r() * (x1 - x0), py = y0 + r() * (y1 - y0), rr = 40 + r() * 80, g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.save(); x.beginPath(); x.rect(x0, y0, x1 - x0, y1 - y0); x.clip(); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); x.restore(); }
  }
  // ramie weave: fine warp and weft, slubs
  x.lineWidth = 0.6;
  for (let yy = 1; yy < 800; yy += 2.2) { x.strokeStyle = `rgba(255,255,255,${0.025 + r() * 0.03})`; x.beginPath(); x.moveTo(0, yy); x.lineTo(660, yy); x.stroke(); y.strokeStyle = 'rgba(150,150,150,0.5)'; y.beginPath(); y.moveTo(0, yy); y.lineTo(660, yy); y.stroke(); }
  for (let xx = 1; xx < 660; xx += 2.2) { x.strokeStyle = `rgba(0,0,0,${0.03 + r() * 0.03})`; x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, 800); x.stroke(); y.strokeStyle = 'rgba(90,90,90,0.4)'; y.beginPath(); y.moveTo(xx, 0); y.lineTo(xx, 800); y.stroke(); }
  for (let n = 0; n < 220; n++) { const yy = r() * 800, xx = r() * 660, l = 10 + r() * 40; x.strokeStyle = 'rgba(255,250,235,0.08)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + l, yy); x.stroke(); }
  // flat-felled seams: a raised ridge with a shadow line and a light lip, running stitches either side
  const seamV = PATCH_COLS.slice(1, -1), seamH = PATCH_ROWS.slice(1, -1);
  const ridge = (vert, p) => {
    if (vert) { x.fillStyle = 'rgba(20,10,8,0.30)'; x.fillRect(p + 2, 0, 3, 800); x.fillStyle = 'rgba(255,248,226,0.30)'; x.fillRect(p - 3, 0, 3, 800); y.fillStyle = '#d8d8d8'; y.fillRect(p - 4, 0, 7, 800); y.fillStyle = '#f2f2f2'; y.fillRect(p - 2, 0, 3, 800); }
    else { x.fillStyle = 'rgba(20,10,8,0.30)'; x.fillRect(0, p + 2, 660, 3); x.fillStyle = 'rgba(255,248,226,0.30)'; x.fillRect(0, p - 3, 660, 3); y.fillStyle = '#d8d8d8'; y.fillRect(0, p - 4, 660, 7); y.fillStyle = '#f2f2f2'; y.fillRect(0, p - 2, 660, 3); }
  };
  seamV.forEach((p) => ridge(true, p)); seamH.forEach((p) => ridge(false, p));
  const stitch = (x0, y0, x1, y1) => {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(L / 13), dx = (x1 - x0) / L, dy = (y1 - y0) / L;
    for (let i = 0; i < n; i++) {
      const s = i * 13 + (r() - 0.5) * 1.2, ax = x0 + dx * s, ay = y0 + dy * s;
      x.strokeStyle = 'rgba(250,238,210,0.9)'; x.lineWidth = 2; x.lineCap = 'round'; x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax + dx * 7, ay + dy * 7); x.stroke();
      y.strokeStyle = '#ffffff'; y.lineWidth = 2.4; y.beginPath(); y.moveTo(ax, ay); y.lineTo(ax + dx * 7, ay + dy * 7); y.stroke();
    }
  };
  seamV.forEach((p) => { stitch(p - 8, 6, p - 8, 794); stitch(p + 9, 6, p + 9, 794); });
  seamH.forEach((p) => { stitch(6, p - 8, 654, p - 8); stitch(6, p + 9, 654, p + 9); });
  // hem: a rolled edge, stitched
  x.strokeStyle = 'rgba(20,10,8,0.35)'; x.lineWidth = 4; x.strokeRect(2, 2, 656, 796);
  stitch(12, 12, 648, 12); stitch(648, 12, 648, 788); stitch(648, 788, 12, 788); stitch(12, 788, 12, 12);
  return { map: c, bump: b };
}
export function clothMesh(k = 2) {
  const { map, bump } = paintCloth(k);
  const nx = 66, nz = 80, geo = new THREE.PlaneGeometry(CLOTH_W, CLOTH_D, nx, nz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, hw = CLOTH_W / 2, hd = CLOTH_D / 2;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), pz = pos.getZ(i);
    const e = Math.min(hw - Math.abs(px), hd - Math.abs(pz));                       // distance to the edge
    const roll = e < 0.9 ? Math.sin((e / 0.9) * Math.PI / 2) : 1;                  // the hem rolls down to the floor
    const wr = 0.05 * Math.sin(px * 0.9 + pz * 0.35) * Math.sin(pz * 0.6 - px * 0.2) * (1 - roll * 0.6);   // tiny wrinkles, mostly near the hem
    pos.setY(i, 0.04 + (CLOTH_Y - 0.06) * roll + Math.min(0, wr) + (e < 3 ? -0.03 * (1 - e / 3) : 0));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ map: texOf(map), bumpMap: texOf(bump, false), bumpScale: 0.9, roughness: 0.82, metalness: 0, sheen: 0.18, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xd8c0a0), envMapIntensity: 0.2 });
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- pebbles: glossy, slightly irregular, mottled, five colours
function stoneCanvas(P, seed) {
  const N = 256, c = cv(N), x = c.getContext('2d'), r = rnd(seed);
  x.fillStyle = P.mid; x.fillRect(0, 0, N, N);
  // drawn three times side by side so the texture wraps round the pebble without a seam (blobs stay clear of the poles)
  const wrap = (f) => { for (const dx of [-N, 0, N]) { x.save(); x.translate(dx, 0); f(); x.restore(); } };
  for (let k = 0; k < 40; k++) { const px = r() * N, py = 30 + r() * (N - 60), rr = 10 + r() * 40, hi = r() < 0.5, al = 0.18 + r() * 0.2; wrap(() => { const g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, hi ? P.hi : P.lo); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = al; x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }); }
  x.globalAlpha = 1;
  for (let k = 0; k < 34; k++) { const px = r() * N, py = 40 + r() * (N - 80), rr = 0.6 + r() * 1.5, col = r() < 0.75 ? P.dot : 'rgba(255,255,255,0.35)'; wrap(() => { x.fillStyle = col; x.beginPath(); x.arc(px, py, rr, 0, Math.PI * 2); x.fill(); }); }
  return c;
}
const stoneGeos = [], stoneMats = [];
export function stoneMesh(id) {
  const i = id % 5;
  if (!stoneGeos[i]) {
    const g = new THREE.SphereGeometry(1, 40, 28), p = g.attributes.position, r = rnd(31 + i * 17), a = [r() * 6, r() * 6, r() * 6];
    for (let k = 0; k < p.count; k++) {
      const vx = p.getX(k), vy = p.getY(k), vz = p.getZ(k);
      const n = 1 + 0.03 * Math.sin(vx * 2.3 + a[0]) * Math.cos(vz * 2.1 + a[1]) + 0.018 * Math.sin(vy * 3 + vx * 1.6 + a[2]);
      const flat = vy < 0 ? 0.82 : 1;                                              // a flatter underside so it sits
      p.setXYZ(k, vx * n * 1.07 * STONE_R, vy * n * STONE_H * STONE_R * flat, vz * n * 0.93 * STONE_R);
    }
    // ellipsoid normals (the same on both sides of the UV seam, so no shading line)
    const nr = g.attributes.normal, ax = 1.07 * STONE_R, az = 0.93 * STONE_R, nv = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) { const ay = STONE_H * STONE_R * (p.getY(k) < 0 ? 0.82 : 1); nv.set(p.getX(k) / (ax * ax), p.getY(k) / (ay * ay), p.getZ(k) / (az * az)).normalize(); nr.setXYZ(k, nv.x, nv.y, nv.z); }
    stoneGeos[i] = g;
    const P = STONE_PAL[i];
    stoneMats[i] = new THREE.MeshPhysicalMaterial({ map: texOf(stoneCanvas(P, 5 + i * 13)), roughness: 0.4, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.9, transparent: false });
  }
  const m = new THREE.Mesh(stoneGeos[i], stoneMats[i]); m.castShadow = true; m.receiveShadow = true;
  const grp = new THREE.Group(); grp.add(m);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softDot('20,8,4'), transparent: true, opacity: 0.55, depthWrite: false, color: 0xffffff }));
  sh.rotation.x = -Math.PI / 2; sh.renderOrder = 2;
  grp.userData = { body: m, shadow: sh };
  return grp;
}
export const stoneMaterial = (id) => stoneMats[id % 5];

// ---------------------------------------------------------------- the palm: a clear glass ring with a warm core (no drawn hand)
export function palmRing() {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xfff6e6, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.42, envMapIntensity: 1.6, emissive: 0xffd9a0, emissiveIntensity: 0.12, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.085, 18, 72), glass); ring.rotation.x = Math.PI / 2; ring.renderOrder = 4;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 8, 72), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })); lip.rotation.x = Math.PI / 2; lip.position.y = 0.07; lip.renderOrder = 5;
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softDot('20,8,4'), transparent: true, opacity: 0.22, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.renderOrder = 2;
  g.add(ring, lip); g.userData = { ring, lip, glass, shadow: sh };
  return g;
}

// ---------------------------------------------------------------- props: brass yugi bowl, celadon cup
const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
export function brassBowl() {
  const g = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a64a, metalness: 1, roughness: 0.24, envMapIntensity: 1.3 });
  const prof = [[0, 0], [3.2, 0], [3.4, 0.3], [3.2, 0.6], [5.6, 2.6], [7.0, 5.4], [7.2, 6.2], [7.0, 6.3], [6.7, 5.6], [5.4, 3.0], [3.0, 1.0], [0, 0.9]];
  const m = new THREE.Mesh(lathe(prof), brass); m.castShadow = true; m.receiveShadow = true; g.add(m);
  return g;
}
export function celadonCup() {
  const g = new THREE.Group();
  const glaze = new THREE.MeshPhysicalMaterial({ color: 0x8fb5a0, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.9 });
  const prof = [[0, 0], [2.0, 0], [2.1, 0.5], [2.0, 0.7], [3.2, 2.2], [4.0, 4.6], [4.15, 5.4], [3.95, 5.45], [3.75, 4.7], [3.0, 2.4], [1.8, 1.2], [0, 1.1]];
  const m = new THREE.Mesh(lathe(prof), glaze); m.castShadow = true; m.receiveShadow = true; g.add(m);
  return g;
}
// a silk pouch (jumeoni) the stones are kept in: a gathered, rounded bag with a drawstring knot and tassel
export function pouch() {
  const g = new THREE.Group();
  const silk = new THREE.MeshPhysicalMaterial({ color: 0xb8323a, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0xffc2b0), sheenRoughness: 0.35, envMapIntensity: 0.5 });
  const prof = [[0, 0], [2.4, 0.15], [4.2, 1.0], [4.9, 2.6], [4.6, 4.2], [3.0, 5.4], [1.3, 6.0], [1.0, 6.6], [1.6, 7.6], [1.2, 7.9], [0, 7.8]];
  const geo = lathe(prof, 48), p = geo.attributes.position;
  for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), y = p.getY(k), a = Math.atan2(z, x), pleat = 1 + (y > 4.6 ? 0.12 : 0.03) * Math.sin(a * 9); p.setX(k, x * pleat); p.setZ(k, z * pleat * 0.86); }
  geo.computeVertexNormals();
  const bag = new THREE.Mesh(geo, silk); bag.castShadow = true; bag.receiveShadow = true; bag.rotation.z = 0.08; g.add(bag);
  const cord = new THREE.MeshStandardMaterial({ color: 0xe0b44a, roughness: 0.5, metalness: 0.2 });
  const knot = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.2, 10, 24), cord); knot.rotation.y = 0.6; knot.position.set(0.3, 6.5, 0); knot.castShadow = true; g.add(knot);
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.55, 3.2, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xe0b44a, roughness: 0.8, side: THREE.DoubleSide }));
  tassel.position.set(2.2, 1.2, 1.4); tassel.rotation.set(0.2, 0, -1.35); tassel.castShadow = true; g.add(tassel);
  return g;
}

// the window lattice (changsal) the light passes through: bright panes, soft dark bars
export function latticeCookie() {
  const N = 512, c = cv(N), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
  const g = x.createRadialGradient(N / 2, N / 2, N * 0.1, N / 2, N / 2, N * 0.5); g.addColorStop(0, '#fff'); g.addColorStop(0.75, '#fff'); g.addColorStop(1, '#000');
  x.fillStyle = g; x.fillRect(0, 0, N, N);
  x.filter = 'blur(5px)';
  x.fillStyle = 'rgba(0,0,0,0.78)';
  const step = N / 7;
  for (let i = 1; i < 7; i++) { x.fillRect(i * step - 5, 0, 10, N); x.fillRect(0, i * step - 5, N, 10); }
  x.filter = 'none';
  const t = texOf(c); return t;
}
