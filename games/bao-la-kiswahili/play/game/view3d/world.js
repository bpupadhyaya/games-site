// Bao la Kiswahili 3D world (units: centimetres). A carved teak bao board with chain-carved borders, brass inlay and a square brass-rimmed
// nyumba, lying on a printed kanga cloth on the coral-stone floor of a Swahili-coast veranda: a carved Zanzibar door with brass studs
// behind, a lime-washed coral wall, and late sun falling through a lattice screen so the lattice pattern lies on the cloth.
// Everything is procedural (canvas textures + analytic geometry): no image files. Shared by the presenter and the icon page.
import * as THREE from '../vendor3d/three.js';
import { colOf, rowIsFront, NYUMBA } from '../src/rules.js';

export const PITCH2D = 78;                       // 2D column pitch (virtual units) the layout uses
export const COLW = 8.6, WROW = 11;              // pit spacing along / across the board (cm)
export const SX = COLW / PITCH2D;                // world cm per 2D unit along the board
export const TOP = 5.2;                          // height of the board's playing face above the floor
export const RIM = TOP - 0.3;                    // the recessed playing surface
export const PIT_RW = 3.25, PIT_D = 2.0;         // pit radius / depth
export const SEED_R = 1.04;                      // a seed ~1.8 cm across
export const TRAY_H = 5.4, TRAY_Z = 2.5 * WROW, TRAY_HW = 300 * SX;
export const HX = 352 * SX, HZ = TRAY_Z + TRAY_H / 2 + 3.6;   // half size of the board
export const BOARD_Y = 0.14;                     // the board lies on the cloth
export const SUN_DIR = new THREE.Vector3(-0.78, 0.6, 0.2).normalize();
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi + seed * 131, yi), b = hash(xi + 1 + seed * 131, yi), c = hash(xi + seed * 131, yi + 1), d = hash(xi + 1 + seed * 131, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, seed, oct = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i); f *= 2.03; a *= 0.5; } return s; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- geometry of the game's rows, in world cm
export const pitWorld = (p, r) => {
  const c = colOf(r), front = rowIsFront(r);
  return p === 0 ? { x: (c - 3.5) * COLW, z: (front ? 0.5 : 1.5) * WROW } : { x: (3.5 - c) * COLW, z: (front ? -0.5 : -1.5) * WROW };
};
export const trayWorld = (p) => ({ x: 0, z: p === 0 ? TRAY_Z : -TRAY_Z });
// group-space point of the flat layout (geometry g = GEOMS[...]) -> world x, z
export function localToWorld(lx, ly, g) {
  const Y = g.ROW_Y, mid = (Y.nFront + Y.sFront) / 2, sp = Y.sFront - Y.nFront;
  return { x: (lx - 360) * SX, z: (ly - mid) * WROW / sp };
}
export const PITS = []; for (let p = 0; p < 2; p++) for (let r = 0; r < 16; r++) PITS.push({ p, r, ...pitWorld(p, r), sq: r === NYUMBA });

// ---------------------------------------------------------------- the board
export const WOODS3 = {
  teak: { face: ['#8d5628', '#a46a34', '#80501f'], edge: ['#5e3517', '#74441d', '#4a2a11'], grain: [40, 18, 4], side: '#4a2a11', rough: 0.5 },
  ebony: { face: ['#42291a', '#573826', '#3b2415'], edge: ['#2c1b11', '#38241a', '#20140c'], grain: [10, 6, 2], side: '#22160e', rough: 0.42 },
};
const sdBox = (x, z, hx, hz, r) => { const qx = Math.abs(x) - (hx - r), qz = Math.abs(z) - (hz - r); return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r; };
const INNER = { hx: HX - 3.4, hz: HZ - 3.3 };

// height of the carved face at world (x, z) relative to the board origin
function boardHeight(x, z) {
  let h = TOP;
  const dEdge = Math.min(HX - Math.abs(x), HZ - Math.abs(z));
  if (dEdge < 1.1) { const t = 1 - dEdge / 1.1; h -= 1.1 * t * t; }
  h -= 0.3 * sstep(0.5, -0.1, sdBox(x, z, INNER.hx, INNER.hz, 1.2) + 0.25) * 1;           // recessed playing surface
  // trays (long stores)
  for (const tz of [-TRAY_Z, TRAY_Z]) {
    const sd = sdBox(x, z - tz, TRAY_HW, TRAY_H / 2, 2.2);
    if (sd < 0.4) h -= 1.5 * sstep(0.35, -0.9, sd);
  }
  for (let i = 0; i < PITS.length; i++) {
    const P = PITS[i], dx = x - P.x, dz = z - P.z;
    if (Math.abs(dx) > 4.3 || Math.abs(dz) > 4.3) continue;
    const d = (P.sq ? Math.pow(Math.pow(Math.abs(dx), 4) + Math.pow(Math.abs(dz), 4), 0.25) / 1.04 : Math.hypot(dx, dz)) / PIT_RW;
    if (d < 1.0) { const u = 1 - d * d; h -= PIT_D * Math.pow(u, 0.85); }
    else if (d < 1.16) h += 0.06 * Math.sin((d - 1) / 0.16 * Math.PI);
  }
  return h;
}

function paintBoardTextures(woodKey, W) {
  const WD = WOODS3[woodKey] || WOODS3.teak, H = Math.round(W * HZ / HX), ppc = W / (2 * HX), r = lcg(31);
  const col = canvas(W, H), c = col.getContext('2d'), bump = canvas(W, H), b = bump.getContext('2d');
  const X = (x) => (x + HX) * ppc, Z = (z) => (z + HZ) * ppc;
  // ground: edge wood everywhere, lighter playing face inside
  const fillGrad = (ctx, cols, x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]); ctx.fillStyle = g; };
  fillGrad(c, WD.edge, 0, 0, W, H); c.fillRect(0, 0, W, H);
  const rrect = (ctx, x, y, w, h, rad) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); };
  c.save(); rrect(c, X(-INNER.hx), Z(-INNER.hz), 2 * INNER.hx * ppc, 2 * INNER.hz * ppc, 1.2 * ppc); fillGrad(c, WD.face, X(-INNER.hx), Z(-INNER.hz), X(INNER.hx), Z(INNER.hz)); c.fill(); c.restore();
  b.fillStyle = 'rgb(128,128,128)'; b.fillRect(0, 0, W, H);
  // plank seams + grain, across the whole board (runs along the board's length)
  const [gr, gg, gb] = WD.grain;
  for (let k = 0; k < 520; k++) {
    const y0 = r() * H, amp = 1 + r() * 5, ph = r() * 6, len = (0.4 + r() * 0.6) * W, x0 = r() * (W - len), a = 0.05 + r() * 0.22;
    c.strokeStyle = r() < 0.7 ? `rgba(${gr},${gg},${gb},${a})` : `rgba(255,214,160,${0.03 + r() * 0.07})`; c.lineWidth = 0.7 + r() * 2.4;
    b.strokeStyle = r() < 0.5 ? 'rgba(90,90,90,0.30)' : 'rgba(170,170,170,0.22)'; b.lineWidth = c.lineWidth * 0.8;
    c.beginPath(); b.beginPath();
    for (let x = 0; x <= len; x += 24) { const y = y0 + Math.sin(x / 110 + ph) * amp + Math.sin(x / 37 + ph * 2) * 0.9; x ? (c.lineTo(x0 + x, y), b.lineTo(x0 + x, y)) : (c.moveTo(x0 + x, y), b.moveTo(x0 + x, y)); }
    c.stroke(); b.stroke();
  }
  for (const zz of [-HZ * 0.34, HZ * 0.34]) { c.fillStyle = 'rgba(20,8,2,0.5)'; c.fillRect(0, Z(zz) - 1.2, W, 2.4); b.fillStyle = 'rgba(40,40,40,0.8)'; b.fillRect(0, Z(zz) - 2, W, 4); }   // plank seams
  // chain-carved border (links of Zanzibar-door carving) and a pale line inside it
  const chain = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 0.95), a = Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = X(x0 + (x1 - x0) * t), y = Z(z0 + (z1 - z0) * t);
      c.save(); c.translate(x, y); c.rotate(a);
      c.strokeStyle = 'rgba(255,214,150,0.30)'; c.lineWidth = 0.14 * ppc; c.beginPath(); c.ellipse(0.04 * ppc, 0.07 * ppc, 0.5 * ppc, 0.27 * ppc, 0, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(18,7,1,0.85)'; c.lineWidth = 0.15 * ppc; c.beginPath(); c.ellipse(0, 0, 0.5 * ppc, 0.27 * ppc, 0, 0, TAU); c.stroke();
      b.save(); b.translate(x, y); b.rotate(a); b.strokeStyle = 'rgba(40,40,40,0.95)'; b.lineWidth = 0.2 * ppc; b.beginPath(); b.ellipse(0, 0, 0.5 * ppc, 0.27 * ppc, 0, 0, TAU); b.stroke(); b.restore();
      c.restore();
    }
  };
  const cz = HZ - 1.75, cx = HX - 1.75;
  chain(-HX + 3.2, -cz, HX - 3.2, -cz); chain(-HX + 3.2, cz, HX - 3.2, cz); chain(-cx, -HZ + 3.2, -cx, HZ - 3.2); chain(cx, -HZ + 3.2, cx, HZ - 3.2);
  // pits: burnished, darker, with a faint worn ring; the nyumba square
  for (const P of PITS) {
    const u = X(P.x), v = Z(P.z), R = PIT_RW * ppc;
    c.save(); c.translate(u, v);
    const g = c.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.28); g.addColorStop(0, 'rgba(18,7,1,0.55)'); g.addColorStop(0.78, 'rgba(24,10,2,0.45)'); g.addColorStop(0.92, 'rgba(255,225,170,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; if (P.sq) { c.beginPath(); c.roundRect(-R * 1.22, -R * 1.22, R * 2.44, R * 2.44, R * 0.4); } else { c.beginPath(); c.arc(0, 0, R * 1.28, 0, TAU); }
    c.fill(); c.restore();
  }
  for (const tz of [-TRAY_Z, TRAY_Z]) {
    const g = c.createLinearGradient(0, Z(tz - TRAY_H / 2), 0, Z(tz + TRAY_H / 2)); g.addColorStop(0, 'rgba(10,3,0,0.7)'); g.addColorStop(0.5, 'rgba(34,14,4,0.45)'); g.addColorStop(1, 'rgba(10,3,0,0.7)');
    c.fillStyle = g; rrect(c, X(-TRAY_HW), Z(tz - TRAY_H / 2), 2 * TRAY_HW * ppc, TRAY_H * ppc, 2.2 * ppc); c.fill();
  }
  // sunlit sheen across the face
  const sh = c.createRadialGradient(X(-HX * 0.5), Z(-HZ * 0.4), 10, X(0), Z(0), W * 0.62); sh.addColorStop(0, 'rgba(255,225,160,0.14)'); sh.addColorStop(1, 'rgba(255,225,160,0)'); c.fillStyle = sh; c.fillRect(0, 0, W, H);
  const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { map: mk(col, true), bump: mk(bump, false) };
}

export function buildBoard(woodKey = 'teak', texW = 2048) {
  const g = new THREE.Group(), WD = WOODS3[woodKey] || WOODS3.teak;
  const segX = Math.round(2 * HX / 0.36), segZ = Math.round(2 * HZ / 0.36);
  const geo = new THREE.PlaneGeometry(2 * HX, 2 * HZ, segX, segZ); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, boardHeight(x, z)); uv.setXY(i, (x + HX) / (2 * HX), 0.5 - z / (2 * HZ)); }
  geo.computeVertexNormals();
  const tex = paintBoardTextures(woodKey, texW);
  const mat = new THREE.MeshPhysicalMaterial({ map: tex.map, bumpMap: tex.bump, bumpScale: 1.4, roughness: WD.rough, metalness: 0, clearcoat: 0.28, clearcoatRoughness: 0.4, envMapIntensity: 0.55 });
  const top = new THREE.Mesh(geo, mat); top.castShadow = true; top.receiveShadow = true; g.add(top);
  // the body of the board under the bevel
  const sideC = canvas(256), sx = sideC.getContext('2d'), r = lcg(8); sx.fillStyle = WD.side; sx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { sx.strokeStyle = r() < 0.7 ? 'rgba(10,4,0,0.35)' : 'rgba(255,200,140,0.10)'; sx.lineWidth = 0.6 + r() * 1.8; const y = r() * 256; sx.beginPath(); sx.moveTo(0, y); for (let x = 0; x <= 256; x += 16) sx.lineTo(x, y + Math.sin(x * 0.05 + i) * 2); sx.stroke(); }
  const st = new THREE.CanvasTexture(sideC); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(4, 1); st.colorSpace = THREE.SRGBColorSpace;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2 * HX - 0.02, TOP - 1.12, 2 * HZ - 0.02), new THREE.MeshStandardMaterial({ map: st, roughness: 0.55, envMapIntensity: 0.4 }));
  body.position.y = (TOP - 1.12) / 2 - 0.4; body.castShadow = true; body.receiveShadow = true; g.add(body);
  // brass: inlay line down the middle with diamonds, rims on the two nyumba, studs
  const brass = new THREE.MeshStandardMaterial({ color: 0xe0b04a, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.5 });
  const line = new THREE.Mesh(new THREE.BoxGeometry(2 * INNER.hx - 4, 0.16, 0.36), brass); line.position.y = RIM + 0.02; line.castShadow = true; g.add(line);
  const dia = new THREE.BoxGeometry(0.95, 0.16, 0.95), dm = new THREE.InstancedMesh(dia, brass, 9), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0));
  for (let i = 0; i < 9; i++) dm.setMatrixAt(i, m4.compose(new THREE.Vector3(-(INNER.hx - 2) + (2 * INNER.hx - 4) * (i + 0.5) / 9, RIM + 0.03, 0), q, new THREE.Vector3(1, 1, 1)));
  dm.castShadow = true; g.add(dm);
  const ringShape = (hs, rad) => { const s = new THREE.Shape(); s.moveTo(-hs + rad, -hs); s.lineTo(hs - rad, -hs); s.quadraticCurveTo(hs, -hs, hs, -hs + rad); s.lineTo(hs, hs - rad); s.quadraticCurveTo(hs, hs, hs - rad, hs); s.lineTo(-hs + rad, hs); s.quadraticCurveTo(-hs, hs, -hs, hs - rad); s.lineTo(-hs, -hs + rad); s.quadraticCurveTo(-hs, -hs, -hs + rad, -hs); return s; };
  const outer = ringShape(3.72, 1.0); outer.holes.push(new THREE.Path(ringShape(3.4, 0.8).getPoints(16).reverse()));
  const ringGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.2, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 10 }); ringGeo.rotateX(-Math.PI / 2);
  for (const p of [0, 1]) { const P = pitWorld(p, NYUMBA), m = new THREE.Mesh(ringGeo, brass); m.position.set(P.x, RIM - 0.02, P.z); m.castShadow = true; g.add(m); }
  const studG = new THREE.SphereGeometry(1, 14, 10), studs = [];
  for (const sx_ of [-1, 1]) for (const sz of [-1, 1]) studs.push([sx_ * (HX - 1.55), sz * (HZ - 1.55), 0.62]);
  for (let i = 1; i < 6; i++) for (const sz of [-1, 1]) studs.push([-HX + 2 * HX * i / 6, sz * (HZ - 0.55), 0.24]);
  const sm = new THREE.InstancedMesh(studG, brass, studs.length);
  studs.forEach(([x, z, s], i) => sm.setMatrixAt(i, m4.compose(new THREE.Vector3(x, boardHeight(x, z) + s * 0.1, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.55, s))));
  sm.castShadow = true; g.add(sm);
  g.position.y = BOARD_Y;
  g.userData.dispose = () => { geo.dispose(); mat.dispose(); tex.map.dispose(); tex.bump.dispose(); };
  return g;
}

// ---------------------------------------------------------------- seeds (three sets), where a seed rests in a pit
export const SEEDSETS3 = ['mbono', 'cowries', 'amber'];
export function seedKit(set) {
  const geo = new THREE.SphereGeometry(1, 24, 16);
  const p = geo.attributes.position;
  if (set === 'cowries') { geo.rotateZ(Math.PI / 2); for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * SEED_R * 1.22, p.getY(i) * SEED_R * 0.82, p.getZ(i) * SEED_R * 0.86); }
  else for (let i = 0; i < p.count; i++) { const k = 1 + (fbm(p.getX(i) * 2 + 3, p.getZ(i) * 2 + p.getY(i), 4, 2) - 0.5) * 0.12; p.setXYZ(i, p.getX(i) * SEED_R * k, p.getY(i) * SEED_R * (set === 'amber' ? 0.98 : 0.92) * k, p.getZ(i) * SEED_R * k); }
  geo.computeVertexNormals();
  const r = lcg(set.length * 91), tc = canvas(256), tx = tc.getContext('2d');
  let mat;
  if (set === 'cowries') {
    const gr = tx.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#fbf3df'); gr.addColorStop(0.5, '#f1dfb4'); gr.addColorStop(1, '#d9bd88'); tx.fillStyle = gr; tx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 160; i++) { tx.fillStyle = `rgba(150,110,60,${0.04 + r() * 0.08})`; tx.beginPath(); tx.arc(r() * 256, r() * 256, 1 + r() * 5, 0, TAU); tx.fill(); }
    tx.strokeStyle = '#5a3a1c'; tx.lineWidth = 7; tx.lineCap = 'round'; tx.beginPath(); tx.moveTo(128, 30); tx.quadraticCurveTo(122, 128, 128, 226); tx.stroke();   // the slit (u = 0.5)
    tx.lineWidth = 2.2; for (let y = 64; y < 200; y += 18) { tx.beginPath(); tx.moveTo(119, y); tx.lineTo(137, y + 1); tx.stroke(); }
    const t = new THREE.CanvasTexture(tc); t.colorSpace = THREE.SRGBColorSpace;
    mat = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 1.1 });
  } else if (set === 'amber') {
    mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x3a1500, emissiveIntensity: 0.9, envMapIntensity: 1.7 });
  } else {
    tx.fillStyle = '#7e8786'; tx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 700; i++) { tx.fillStyle = r() < 0.5 ? `rgba(40,52,52,${0.1 + r() * 0.25})` : `rgba(235,240,235,${0.05 + r() * 0.15})`; tx.beginPath(); tx.arc(r() * 256, r() * 256, 0.6 + r() * 3, 0, TAU); tx.fill(); }
    const t = new THREE.CanvasTexture(tc); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    mat = new THREE.MeshPhysicalMaterial({ map: t, color: 0xffffff, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.22, envMapIntensity: 1.0 });
  }
  return { geo, mat };
}
const TINTS = { mbono: [0xffffff, 0xe6ebe8, 0xcfd8d5, 0xf4f1e6], cowries: [0xffffff, 0xf6ecd6, 0xeadcb8, 0xfff8ea], amber: [0xffb54a, 0xff9d2a, 0xffc766, 0xf08a1e] };
export const tintOf = (set, v) => new THREE.Color(TINTS[set][v % 4]);
// resting place of seed k in a pit (stable: adding a seed never moves the others); offsets from the pit centre, y relative to RIM
const LAYERS = [[0, 0, 0], ...Array.from({ length: 6 }, (_, i) => [2.0, i * TAU / 6, 0]), ...Array.from({ length: 5 }, (_, i) => [1.3, i * TAU / 5 + 0.5, 1.6]), ...Array.from({ length: 3 }, (_, i) => [0.8, i * TAU / 3 + 0.2, 2.9]), [0, 0, 3.9]];
export function seedSlot(key, k) {
  let rad, a, lift;
  if (k < LAYERS.length) { [rad, a, lift] = LAYERS[k]; a += key * 1.3; }
  else { const j = k - LAYERS.length; rad = 0.9 + ((j * 7) % 5) * 0.4; a = j * 2.3999 + key; lift = 3.4 + Math.floor(j / 7) * 0.9; }
  const jx = (hash(key, k * 3 + 1) - 0.5) * 0.28, jz = (hash(key, k * 3 + 2) - 0.5) * 0.28;
  const x = Math.cos(a) * rad + jx, z = Math.sin(a) * rad + jz, u = Math.min(1, Math.hypot(x, z) / PIT_RW);
  return { x, z, y: RIM - PIT_D * (1 - u * u) * 0.9 + SEED_R * 0.82 + lift, rot: hash(key, k) * TAU, tx: (hash(key, k + 40) - 0.5) * 1.2, tz: (hash(key, k + 80) - 0.5) * 1.2, v: (k * 5 + key) % 4 };
}

// ---------------------------------------------------------------- the veranda
function paintKanga(W, H) {
  const c = canvas(W, H), x = c.getContext('2d'), r = lcg(11), ppc = W / 124;
  x.fillStyle = '#1b2d52'; x.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 3) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,20'},${0.02 + r() * 0.04})`; x.fillRect(0, y, W, 1.4); }
  for (let xx = 0; xx < W; xx += 3) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,20'},${0.02 + r() * 0.04})`; x.fillRect(xx, 0, 1.4, H); }
  const leaf = (px, py, s, rot, fill, line) => {
    x.save(); x.translate(px, py); x.rotate(rot); x.scale(s, s); x.beginPath(); x.moveTo(0, -26); x.bezierCurveTo(22, -14, 24, 14, 0, 26); x.bezierCurveTo(-16, 14, -14, -8, 0, -26); x.closePath();
    x.fillStyle = fill; x.fill(); x.strokeStyle = line; x.lineWidth = 2; x.stroke(); x.beginPath(); x.moveTo(0, -16); x.quadraticCurveTo(7, 0, 0, 16); x.lineWidth = 1.6; x.stroke(); x.beginPath(); x.arc(0, 0, 3.2, 0, TAU); x.fillStyle = line; x.fill(); x.restore();
  };
  const fills = [['#e0a93a', '#7d4d10'], ['#d2553a', '#6e1f12'], ['#f2e4c0', '#8a6a3a']], B = 13 * ppc, sc = ppc / 4.2; let k = 0;
  const q0 = 0.5; for (let y = B + 30 * sc * q0; y < H - B - 10; y += 118 * sc * q0, k++) {
    for (let xx = B + (k % 2) * 45 * sc * q0 + 44 * sc * q0; xx < W - B; xx += 90 * sc * q0) { const f = fills[(k + Math.floor(xx / (90 * sc * q0))) % 3]; leaf(xx, y, 0.82 * sc * q0, (k % 2 ? 0.5 : -0.5) * 0.4 + ((xx / (90 * sc * q0)) % 2 ? 0.25 : -0.25), f[0], f[1]); }
    x.fillStyle = 'rgba(246,231,196,0.6)'; for (let xx = B + 8; xx < W - B; xx += 24 * sc * q0) { x.beginPath(); x.arc(xx, y + 59 * sc * q0, 2.4 * sc * q0, 0, TAU); x.fill(); }
  }
  const border = (rot, len, w, depth) => {
    x.save(); x.translate(w, depth); x.rotate(rot);
    const g = x.createLinearGradient(0, 0, 0, B); g.addColorStop(0, '#d2553a'); g.addColorStop(1, '#a93a26'); x.fillStyle = g; x.fillRect(0, 0, len, B);
    x.fillStyle = '#f6e7c4'; x.fillRect(0, B * 0.12, len, B * 0.05); x.fillRect(0, B * 0.84, len, B * 0.05);
    const tw = 30 * sc; for (let xx = 0; xx < len + tw; xx += tw) { x.beginPath(); x.moveTo(xx, B * 0.8); x.lineTo(xx + tw / 2, B * 0.22); x.lineTo(xx + tw, B * 0.8); x.closePath(); x.fill(); }
    x.fillStyle = '#1a2b4d'; for (let xx = tw / 2; xx < len + tw; xx += tw) { x.beginPath(); x.arc(xx, B * 0.55, 4 * sc, 0, TAU); x.fill(); }
    x.restore();
  };
  border(0, W, 0, 0); border(0, W, 0, H - B); border(Math.PI / 2, H, B, 0); border(Math.PI / 2, H, W, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function paintStone(size) {
  const c = canvas(size), x = c.getContext('2d'), r = lcg(21), S = size / 3;           // 3 x 3 slabs
  x.fillStyle = '#7d6e58'; x.fillRect(0, 0, size, size);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const v = 0.9 + hash(i, j * 5) * 0.2, ox = i * S + 5, oy = j * S + 5, w = S - 10, h = S - 10;
    x.fillStyle = `rgb(${Math.round(205 * v)},${Math.round(190 * v)},${Math.round(160 * v)})`; x.beginPath(); x.roundRect(ox, oy, w, h, 14); x.fill();
    const g = x.createRadialGradient(ox + w * 0.4, oy + h * 0.4, 10, ox + w / 2, oy + h / 2, w * 0.75); g.addColorStop(0, 'rgba(255,240,210,0.18)'); g.addColorStop(1, 'rgba(60,40,20,0.16)'); x.fillStyle = g; x.fill();
  }
  for (let i = 0; i < 6500; i++) { const px = r() * size, py = r() * size, s = 0.5 + r() * r() * 3; x.fillStyle = r() < 0.6 ? `rgba(70,52,34,${0.12 + r() * 0.3})` : `rgba(255,248,230,${0.08 + r() * 0.2})`; x.beginPath(); x.ellipse(px, py, s, s * (0.5 + r() * 0.5), r() * 3, 0, TAU); x.fill(); }
  for (let i = 0; i < 90; i++) { const px = r() * size, py = r() * size; x.strokeStyle = `rgba(110,90,66,${0.1 + r() * 0.15})`; x.lineWidth = 0.8; x.beginPath(); x.arc(px, py, 3 + r() * 9, r() * 6, r() * 6 + 2.5); x.stroke(); }   // fossil whorls
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 7); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function paintWall(W, H) {
  const c = canvas(W, H), x = c.getContext('2d'), r = lcg(5);
  x.fillStyle = '#d9c4a0'; x.fillRect(0, 0, W, H);
  const bh = H / 8;
  for (let j = 0; j < 8; j++) for (let i = -1; i < 8; i++) {
    const bw = W / 6.5, ox = i * bw + (j % 2) * bw / 2, v = 0.93 + hash(i, j + 9) * 0.12;
    x.fillStyle = `rgb(${Math.round(222 * v)},${Math.round(200 * v)},${Math.round(160 * v)})`; x.fillRect(ox + 3, j * bh + 3, bw - 6, bh - 6);
  }
  for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '90,66,40' : '255,248,232'},${0.04 + r() * 0.1})`; x.beginPath(); x.arc(r() * W, r() * H, 0.6 + r() * 3.2, 0, TAU); x.fill(); }
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(60,32,10,0.0)'); g.addColorStop(1, 'rgba(60,32,10,0.28)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function paintDoor(W, H) {
  const c = canvas(W, H), x = c.getContext('2d'), r = lcg(14);
  const bump = canvas(W, H), b = bump.getContext('2d'); b.fillStyle = 'rgb(128,128,128)'; b.fillRect(0, 0, W, H);
  const wood = x.createLinearGradient(0, 0, W, 0); wood.addColorStop(0, '#4a2810'); wood.addColorStop(0.5, '#5e3416'); wood.addColorStop(1, '#41230d'); x.fillStyle = wood; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i++) { const px = r() * W; x.strokeStyle = r() < 0.7 ? `rgba(14,5,0,${0.1 + r() * 0.25})` : `rgba(230,170,110,${0.04 + r() * 0.08})`; x.lineWidth = 0.6 + r() * 1.6; x.beginPath(); x.moveTo(px, 0); for (let y = 0; y <= H; y += 24) x.lineTo(px + Math.sin(y * 0.02 + i) * 3, y); x.stroke(); }
  const panel = (px, py, w, h) => {
    x.fillStyle = 'rgba(0,0,0,0.38)'; x.fillRect(px - 5, py - 5, w + 10, h + 10); x.fillStyle = 'rgba(255,214,150,0.35)'; x.fillRect(px - 5, py + h + 3, w + 10, 3);
    const g = x.createLinearGradient(px, py, px + w, py + h); g.addColorStop(0, '#6a3c18'); g.addColorStop(1, '#4f2b10'); x.fillStyle = g; x.fillRect(px, py, w, h);
    b.fillStyle = 'rgb(165,165,165)'; b.fillRect(px, py, w, h); b.strokeStyle = 'rgb(60,60,60)'; b.lineWidth = 10; b.strokeRect(px - 5, py - 5, w + 10, h + 10);
  };
  // two columns of panels, and a carved lintel band
  const pw = W * 0.4, gap = W * 0.06, x0 = (W - 2 * pw - gap) / 2;
  const rows = [[H * 0.18, H * 0.2], [H * 0.42, H * 0.2], [H * 0.66, H * 0.26]];
  for (const [py, ph] of rows) for (let i = 0; i < 2; i++) panel(x0 + i * (pw + gap), py, pw, ph);
  const chain = (y0) => { for (let px = 14; px < W - 8; px += 26) { x.strokeStyle = 'rgba(14,5,0,0.85)'; x.lineWidth = 3.2; x.beginPath(); x.ellipse(px, y0, 11, 6, 0, 0, TAU); x.stroke(); x.strokeStyle = 'rgba(255,214,150,0.35)'; x.lineWidth = 1.6; x.beginPath(); x.ellipse(px + 1, y0 + 1.5, 11, 6, 0, 0, TAU); x.stroke(); } };
  chain(H * 0.05); chain(H * 0.11); chain(H * 0.6);
  // brass studs in a pyramid pattern on the upper panels
  for (const [py, ph] of rows.slice(0, 2)) for (let i = 0; i < 2; i++) {
    const cx = x0 + i * (pw + gap) + pw / 2, cy = py + ph / 2;
    for (let yy = -2; yy <= 2; yy++) for (let xx = -3; xx <= 3; xx++) {
      if (Math.abs(xx) + Math.abs(yy) * 1.6 > 3.2) continue;
      const sx = cx + xx * pw * 0.12, sy = cy + yy * ph * 0.17, rad = 7.5, g = x.createRadialGradient(sx - 2, sy - 3, 1, sx, sy, rad);
      g.addColorStop(0, '#fff0b0'); g.addColorStop(0.5, '#d9a93c'); g.addColorStop(1, '#6d4a10'); x.fillStyle = 'rgba(0,0,0,0.45)'; x.beginPath(); x.arc(sx + 2, sy + 3, rad, 0, TAU); x.fill(); x.fillStyle = g; x.beginPath(); x.arc(sx, sy, rad, 0, TAU); x.fill();
    }
  }
  // iron-brass ring handle on the lower panel
  x.strokeStyle = '#c99a36'; x.lineWidth = 7; x.beginPath(); x.arc(x0 + pw + gap / 2, H * 0.72, 22, 0, TAU); x.stroke();
  x.fillStyle = '#d9a93c'; x.beginPath(); x.arc(x0 + pw + gap / 2, H * 0.72, 9, 0, TAU); x.fill();
  const mk = (cv, s) => { const t = new THREE.CanvasTexture(cv); if (s) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { map: mk(c, true), bump: mk(bump, false) };
}
function paintLattice(S) {
  const c = canvas(S), x = c.getContext('2d');
  x.clearRect(0, 0, S, S); x.strokeStyle = '#3a1f0c'; x.lineWidth = S * 0.035; x.lineCap = 'butt';
  const n = 6, d = S / n;
  x.strokeRect(S * 0.02, S * 0.02, S * 0.96, S * 0.96);
  for (let i = -n; i <= 2 * n; i++) { x.beginPath(); x.moveTo(i * d, 0); x.lineTo(i * d + S, S); x.stroke(); x.beginPath(); x.moveTo(i * d, S); x.lineTo(i * d + S, 0); x.stroke(); }
  x.fillStyle = '#2d1708'; for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { x.beginPath(); x.arc(i * d, j * d, S * 0.028, 0, TAU); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

export function buildVeranda(scene, { quality = 1 } = {}) {
  const g = new THREE.Group(); scene.add(g);
  // coral-stone floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map: paintStone(1024), roughness: 0.92, bumpMap: null, color: 0xd9cfbd }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  // a pool of light: the floor and cloth fall away into warm shade toward the edges of the view
  { const pc = canvas(256), px = pc.getContext('2d'), gr = px.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(12,6,2,0)'); gr.addColorStop(0.3, 'rgba(12,6,2,0)'); gr.addColorStop(0.62, 'rgba(12,6,2,0.42)'); gr.addColorStop(1, 'rgba(12,6,2,0.8)'); px.fillStyle = gr; px.fillRect(0, 0, 256, 256);
    const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace; const pool = new THREE.Mesh(new THREE.PlaneGeometry(430, 430), new THREE.MeshBasicMaterial({ map: pt, transparent: true, depthWrite: false, fog: false })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.55; pool.renderOrder = 1; g.add(pool); }
  // the kanga cloth under the board, slightly rumpled
  const kw = 124, kd = 104, kt = paintKanga(1792, 1504), cg = new THREE.PlaneGeometry(kw, kd, 110, 92); cg.rotateX(-Math.PI / 2);
  const cp = cg.attributes.position; for (let i = 0; i < cp.count; i++) { const px = cp.getX(i), pz = cp.getZ(i), e = Math.min(kw / 2 - Math.abs(px), kd / 2 - Math.abs(pz)); cp.setY(i, 0.12 + fbm(px * 0.07, pz * 0.07, 3, 3) * 0.3 * Math.min(1, e / 6)); }
  cg.computeVertexNormals();
  const cloth = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: kt, roughness: 0.93, envMapIntensity: 0.25 })); cloth.receiveShadow = true; g.add(cloth);
  // lime-washed coral wall with a carved Zanzibar door behind the north side
  const wallZ = -92, wall = new THREE.Mesh(new THREE.PlaneGeometry(520, 300), new THREE.MeshStandardMaterial({ map: paintWall(1024, 768), roughness: 0.95, color: 0xf4e6cc })); wall.position.set(0, 150, wallZ); wall.receiveShadow = true; g.add(wall);
  const dt = paintDoor(512, 1024), DW = 92, DH = 190, dx = 34;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), new THREE.MeshStandardMaterial({ map: dt.map, bumpMap: dt.bump, bumpScale: 2.4, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.5 }));
  door.position.set(dx, DH / 2, wallZ + 1.6); door.receiveShadow = true; g.add(door);
  const frameM = new THREE.MeshStandardMaterial({ color: 0x4d2a12, roughness: 0.55, envMapIntensity: 0.4 });
  const box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameM); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  box(10, DH + 12, 7, dx - DW / 2 - 4, (DH + 12) / 2, wallZ + 3); box(10, DH + 12, 7, dx + DW / 2 + 4, (DH + 12) / 2, wallZ + 3); box(DW + 28, 12, 8, dx, DH + 6, wallZ + 3.4);
  box(DW + 36, 8, 22, dx, 4, wallZ + 12);              // coral-stone threshold step
  // lattice screen on the left, the sun comes through it
  const lt = paintLattice(256); lt.repeat.set(3, 1.5);
  const lat = new THREE.Mesh(new THREE.PlaneGeometry(220, 110), new THREE.MeshStandardMaterial({ map: lt, alphaTest: 0.5, transparent: false, side: THREE.DoubleSide, roughness: 0.7 }));
  lat.rotation.y = Math.PI / 2; lat.position.set(-98, 78, -20); lat.castShadow = quality > 0; g.add(lat);
  const lat2 = new THREE.Mesh(new THREE.PlaneGeometry(220, 60), new THREE.MeshStandardMaterial({ color: 0xd8c6a2, roughness: 0.95 })); lat2.rotation.y = Math.PI / 2; lat2.position.set(-98.5, 15, -20); g.add(lat2);
  const lat3 = new THREE.Mesh(new THREE.PlaneGeometry(220, 120), new THREE.MeshStandardMaterial({ color: 0xd8c6a2, roughness: 0.95 })); lat3.rotation.y = Math.PI / 2; lat3.position.set(-98.5, 190, -20); g.add(lat3);
  // dust motes drifting in the light
  const N = 90, pg = new THREE.BufferGeometry(), pa = new Float32Array(N * 3), r = lcg(77);
  for (let i = 0; i < N; i++) { pa[i * 3] = (r() - 0.5) * 120; pa[i * 3 + 1] = 4 + r() * 60; pa[i * 3 + 2] = (r() - 0.5) * 90; }
  pg.setAttribute('position', new THREE.BufferAttribute(pa, 3));
  const sp = canvas(64), sx = sp.getContext('2d'), sg = sx.createRadialGradient(32, 32, 0, 32, 32, 32); sg.addColorStop(0, 'rgba(255,230,180,0.9)'); sg.addColorStop(1, 'rgba(255,200,120,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 64, 64);
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.55, map: new THREE.CanvasTexture(sp), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false }));
  dust.frustumCulled = false; g.add(dust);
  return { group: g, dust, cloth };
}

// Late sun through the lattice (shadows), sky fill, warm bounce from the stone, a rim from the door side.
export function buildLights(scene) {
  const sun = new THREE.DirectionalLight(0xffc088, 3.1); sun.position.copy(SUN_DIR).multiplyScalar(190); sun.target.position.set(0, 0, 0);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 40, far: 420 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04; sun.shadow.radius = 2.5;
  const hemi = new THREE.HemisphereLight(0x9aa8d0, 0x8a5c3a, 0.55);
  const fill = new THREE.DirectionalLight(0xffd2a8, 0.4); fill.position.set(60, 80, 120);
  const rim = new THREE.DirectionalLight(0xff9a60, 0.8); rim.position.set(40, 40, -140);
  scene.add(sun, sun.target, hemi, fill, rim);
  return { sun, hemi, fill, rim };
}

// Soft radial texture for contact blobs, dust and glow marks.
export function radialTex(rgb = '0,0,0', a = 1, inner = 0) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 64 * inner, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${inner ? 0 : a})`); if (inner) g.addColorStop(Math.min(0.95, inner + 0.12), `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
