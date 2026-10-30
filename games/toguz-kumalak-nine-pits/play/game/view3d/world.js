// Toguz Kumalak 3D world (units: centimetres). A carved wooden toguz kumalak board on a felt shyrdak rug inside a yurt: the kerege
// lattice wall, red uyk roof poles running up to the shanyrak crown, daylight falling through the crown onto the board, chests and
// folded quilts along the wall. Everything is procedural (canvas textures + analytic geometry): no image files. Shared by the
// presenter and the icon page.
//
// The board follows the flat art's canonical layout exactly (layout.js: pits at pitPos, kazans at TRAY, the middle band at MID_Y):
// canonical (cx, cy) -> world (x, z) = ((cx - 360) * U, (cy - 750) * U), so every 2D overlay (counts, labels) lines up by projection.
import * as THREE from '../vendor3d/three.js';
import { RX, RY, FRAME, TRAY, MID_Y, pitPos } from '../src/layout.js';
import { numberOf } from '../src/rules.js';

export const U = 0.1;                       // cm per canonical unit: the board is 70 x 80 cm, a pit 6 x 8.4 cm
export const TOP = 4.2;                     // height of the playing face above the rug
export const PIT_D = 2.3, KAZ_D = 1.5;      // carved depths
export const PEB = { rx: 0.86, ry: 0.5, rz: 0.78 };  // a kumalak: a flat, rounded river pebble ~1.7 x 1.6 x 1.0 cm
export const SUN_DIR = new THREE.Vector3(-0.3, 1, 0.33).normalize();   // daylight through the shanyrak (the board sits off the yurt's centre)
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
export const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi + seed * 131, yi), b = hash(xi + 1 + seed * 131, yi), c = hash(xi + seed * 131, yi + 1), d = hash(xi + 1 + seed * 131, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, seed, oct = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i); f *= 2.03; a *= 0.5; } return s; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } t.anisotropy = 8; return t; };

export const toWorld = (cx, cy) => ({ x: (cx - 360) * U, z: (cy - 750) * U });
export const pitWorld = (i) => { const p = pitPos(i); return toWorld(p.x, p.y); };
const BX0 = FRAME.x, BY0 = FRAME.y, BW = FRAME.w, BH = FRAME.h;               // canonical board rect
export const BOARD = { w: BW * U, d: BH * U, x0: (BX0 - 360) * U, z0: (BY0 - 750) * U };

// ---- the board's carved face as a height field over canonical coordinates -------------------------------------------
const PRX = RX * U, PRZ = RY * U;
const kazRect = (T) => ({ x0: (T.x - 360) * U, z0: (T.y - 750) * U, w: T.w * U, d: T.h * U });
const KAZ = [kazRect(TRAY.bottom), kazRect(TRAY.top)];                      // index = player (0 bottom, 1 top)
// signed distance inside a rounded rect (positive inside)
const rrIn = (x, z, r, rad) => { const cx = r.x0 + r.w / 2, cz = r.z0 + r.d / 2, hx = r.w / 2 - rad, hz = r.d / 2 - rad, qx = Math.abs(x - cx) - hx, qz = Math.abs(z - cz) - hz; return rad - (Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0)); };
const BRECT = { x0: BOARD.x0, z0: BOARD.z0, w: BOARD.w, d: BOARD.d };
// a pit's depth at normalised radius u: a round-bottomed bowl whose wall rolls smoothly over into the face (no hard lip)
function bowl(u) { const t = Math.min(1, u / 1.08); return PIT_D * (1 - t * t * (3 - 2 * t)) * (1 - 0.12 * u * u); }
export function faceHeight(x, z) {
  const e = rrIn(x, z, BRECT, 4.2);
  let h = TOP;
  // the raised frame round the recessed playing face (2.6 cm wide, 0.45 high, rounded both sides)
  const s = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  h += 0.45 * s(0, 0.7, e) * (1 - s(2.2, 2.9, e));
  // pits: smooth oval bowls with a softened lip
  for (let i = 0; i < 18; i++) {
    const p = pitWorld(i), dx = (x - p.x) / PRX, dz = (z - p.z) / PRZ; if (Math.abs(dx) > 1.2 || Math.abs(dz) > 1.2) continue;
    const d2 = dx * dx + dz * dz;
    h -= bowl(Math.sqrt(d2));
  }
  // kazans: long troughs, flat-bottomed, rounded walls
  for (const K of KAZ) {
    const k = rrIn(x, z, K, K.d / 2 * 0.98); if (k <= -0.3) continue;
    if (k > 0) h -= KAZ_D * s(0, 1.6, k); else h += 0.07 * Math.sin((k + 0.3) / 0.3 * Math.PI);
  }
  return h;
}
export const pitFloor = (i, dx = 0, dz = 0) => TOP - bowl(Math.sqrt((dx / PRX) ** 2 + (dz / PRZ) ** 2));

function paintGrain(x, w, h, WD, r, k = 1) {
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, WD.face[0]); g.addColorStop(0.5, WD.face[1]); g.addColorStop(1, WD.face[2]);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let n = 0; n < 420 * k; n++) {
    const y0 = r() * h, amp = 2 + r() * 9, ph = r() * 6, fq = 60 + r() * 140;
    x.strokeStyle = r() < 0.7 ? `rgba(${WD.grain[0]},${WD.grain[1]},${WD.grain[2]},${0.05 + r() * 0.12})` : `rgba(255,232,190,${0.03 + r() * 0.06})`;
    x.lineWidth = 0.6 + r() * 2.4; x.beginPath();
    for (let xx = 0; xx <= w; xx += 16) { const y = y0 + Math.sin(xx / fq + ph) * amp + Math.sin(xx / 23 + ph * 3) * 0.8; xx ? x.lineTo(xx, y) : x.moveTo(xx, y); }
    x.stroke();
  }
  // a few knots / medullary flecks
  for (let n = 0; n < 26 * k; n++) { x.fillStyle = `rgba(${WD.grain[0]},${WD.grain[1]},${WD.grain[2]},${0.08 + r() * 0.1})`; x.beginPath(); x.ellipse(r() * w, r() * h, 6 + r() * 30, 1 + r() * 3, 0, 0, TAU); x.fill(); }
}
function hornPath(x, cx, cy, s) {
  for (const side of [1, -1]) {
    x.beginPath();
    for (let t = 0; t <= 1.0001; t += 0.04) { const r = s * 0.9 * (1 - t * 0.9), a = Math.PI - t * 2.1 * TAU, px = cx + side * (s * 0.9 + Math.cos(a) * r), py = cy - Math.sin(a) * r; t === 0 ? x.moveTo(px, py) : x.lineTo(px, py); }
    x.stroke();
  }
}
export const WOOD3 = {
  walnut: { face: ['#7a4c2a', '#94603a', '#6e4426'], grain: [34, 16, 6], pit: 'rgba(32,14,4,', side: '#4a2b17', rough: 0.42 },
  birch: { face: ['#d6b383', '#e6c899', '#c9a573'], grain: [120, 80, 40], pit: 'rgba(96,58,24,', side: '#a7804f', rough: 0.48 },
};
// colour + bump for the face, painted in canonical units (S px per unit)
function faceTextures(wood, size) {
  const WD = WOOD3[wood] || WOOD3.walnut, S = size / BW, w = size, h = Math.round(BH * S), r = lcg(wood.length * 31 + 7);
  const col = canvas(w, h), x = col.getContext('2d'), bump = canvas(w, h), b = bump.getContext('2d');
  paintGrain(x, w, h, WD, r, 1);
  b.fillStyle = '#808080'; b.fillRect(0, 0, w, h);
  const P = (cx, cy) => [(cx - BX0) * S, (cy - BY0) * S];
  // darker oiled edge band of the frame, worn lighter where hands rest
  x.save(); x.strokeStyle = 'rgba(30,12,2,0.35)'; x.lineWidth = 26 * S; x.beginPath(); x.roundRect(13 * S, 13 * S, w - 26 * S, h - 26 * S, 30 * S); x.stroke(); x.restore();
  // pits: polished dark bowls, a pale worn lip, carved number on the middle side
  for (let i = 0; i < 18; i++) {
    const p = pitPos(i), [u, v] = P(p.x, p.y);
    const g = x.createRadialGradient(u, v, 2, u, v, RY * S * 1.05); g.addColorStop(0, WD.pit + '0.55)'); g.addColorStop(0.75, WD.pit + '0.42)'); g.addColorStop(1, WD.pit + '0)');
    x.fillStyle = g; x.beginPath(); x.ellipse(u, v, RX * S * 1.05, RY * S * 1.05, 0, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,226,170,0.22)'; x.lineWidth = 2.4 * S; x.beginPath(); x.ellipse(u, v, RX * S * 1.06, RY * S * 1.06, 0, 0, TAU); x.stroke();
    const top = i >= 9, ny = top ? p.y + RY + 20 : p.y - RY - 8;
    const [nu, nv] = P(p.x, ny);
    x.font = `700 ${Math.round(17 * S)}px Georgia, "Times New Roman", serif`; x.textAlign = 'center';
    x.fillStyle = 'rgba(255,236,196,0.35)'; x.fillText(String(numberOf(i)), nu + 0.8 * S, nv + 1.2 * S);
    x.fillStyle = 'rgba(28,10,2,0.78)'; x.fillText(String(numberOf(i)), nu, nv);
    b.font = x.font; b.textAlign = 'center'; b.fillStyle = '#3a3a3a'; b.fillText(String(numberOf(i)), nu, nv);
  }
  // kazans: darker, smoother troughs ringed by brass studs (studs are real geometry, see buildBoard)
  for (const T of [TRAY.top, TRAY.bottom]) {
    const [u, v] = P(T.x, T.y);
    x.fillStyle = WD.pit + '0.42)'; x.beginPath(); x.roundRect(u, v, T.w * S, T.h * S, T.h * S / 2); x.fill();
    x.strokeStyle = 'rgba(255,226,170,0.2)'; x.lineWidth = 2.4 * S; x.stroke();
  }
  // the middle band: a bone inlay with madder ram's-horn scrolls and diamonds (koshkar muiz)
  { const [u, v] = P(BX0 + 52, MID_Y - 17), sw = (BW - 104) * S, sh = 34 * S;
    x.fillStyle = 'rgba(20,8,2,0.6)'; x.beginPath(); x.roundRect(u - 3 * S, v - 3 * S, sw + 6 * S, sh + 6 * S, 12 * S); x.fill();
    const ig = x.createLinearGradient(0, v, 0, v + sh); ig.addColorStop(0, '#efdfb8'); ig.addColorStop(1, '#cdb483'); x.fillStyle = ig; x.beginPath(); x.roundRect(u, v, sw, sh, 9 * S); x.fill();
    for (let k = 0; k < 300; k++) { x.fillStyle = `rgba(120,96,60,${0.05 + r() * 0.08})`; x.fillRect(u + r() * sw, v + r() * sh, 1 + r() * 8 * S, 0.6 * S); }
    b.fillStyle = '#9a9a9a'; b.beginPath(); b.roundRect(u, v, sw, sh, 9 * S); b.fill();
    x.strokeStyle = '#7a2a1c'; x.lineWidth = 2.6 * S; x.lineCap = 'round'; b.strokeStyle = '#5a5a5a'; b.lineWidth = 2.6 * S; b.lineCap = 'round';
    for (let cx = BX0 + 92; cx < BX0 + BW - 72; cx += 70) { const [hu, hv] = P(cx, MID_Y); hornPath(x, hu, hv, 10 * S); hornPath(b, hu, hv, 10 * S); }
    for (let cx = BX0 + 127; cx < BX0 + BW - 72; cx += 70) { const [du, dv] = P(cx, MID_Y), d = 8 * S; x.fillStyle = '#7a2a1c'; x.beginPath(); x.moveTo(du, dv - d); x.lineTo(du + d, dv); x.lineTo(du, dv + d); x.lineTo(du - d, dv); x.closePath(); x.fill(); }
  }
  // carved flow arrows (the sowing direction), cut into the wood
  for (const [yy, dir] of [[MID_Y - 40, -1], [MID_Y + 40, 1]]) for (let cx = 190; cx <= 530; cx += 38) {
    const [u, v] = P(cx, yy), d = 8 * S;
    for (const [c, col2, lw] of [[x, 'rgba(255,224,170,0.3)', 4.2], [x, 'rgba(36,14,3,0.7)', 3], [b, '#404040', 3.4]]) {
      c.strokeStyle = col2; c.lineWidth = lw * S; c.lineJoin = 'round'; c.lineCap = 'round';
      const o = col2.startsWith('rgba(255') ? 1.2 * S : 0;
      c.beginPath(); c.moveTo(u - dir * d + o, v - d + o); c.lineTo(u + dir * d + o, v + o); c.lineTo(u - dir * d + o, v + d + o); c.stroke();
    }
  }
  // corner inlays: bone and madder diamonds
  for (const [cx, cy] of [[BX0 + 20, BY0 + 20], [BX0 + BW - 20, BY0 + 20], [BX0 + 20, BY0 + BH - 20], [BX0 + BW - 20, BY0 + BH - 20]]) {
    const [u, v] = P(cx, cy), d = (rr, c2) => { x.fillStyle = c2; x.beginPath(); x.moveTo(u, v - rr * S); x.lineTo(u + rr * S, v); x.lineTo(u, v + rr * S); x.lineTo(u - rr * S, v); x.closePath(); x.fill(); };
    d(11, 'rgba(15,6,2,0.7)'); d(9, '#ecd9b0'); d(5.5, '#a83a26'); d(2, '#ecd9b0');
  }
  // fine grain in the bump map
  const bd = b.getImageData(0, 0, w, h), a = bd.data;
  for (let j = 0; j < h; j++) { const row = Math.sin(j * 0.9 + Math.sin(j * 0.031) * 6) * 5; for (let i = 0; i < w; i++) { const k = (j * w + i) * 4, n = (hash(i, j) - 0.5) * 8 + row; a[k] = a[k + 1] = a[k + 2] = Math.max(0, Math.min(255, a[k] + n)); } }
  b.putImageData(bd, 0, 0);
  return { map: tex(col, true), bump: tex(bump, false) };
}

// The whole board: a rounded slab (extruded, bevelled) with the carved face on top and brass studs round the kazans.
export function buildBoard(wood = 'walnut', texSize = 1024, segK = 1) {
  const WD = WOOD3[wood] || WOOD3.walnut, g = new THREE.Group();
  const bev = 0.9, sw = BOARD.w - 2 * bev, sd = BOARD.d - 2 * bev, rad = 4.2 - bev;
  const sh = new THREE.Shape(), x0 = -sw / 2, z0 = -sd / 2;
  sh.moveTo(x0 + rad, z0); sh.lineTo(x0 + sw - rad, z0); sh.quadraticCurveTo(x0 + sw, z0, x0 + sw, z0 + rad); sh.lineTo(x0 + sw, z0 + sd - rad); sh.quadraticCurveTo(x0 + sw, z0 + sd, x0 + sw - rad, z0 + sd);
  sh.lineTo(x0 + rad, z0 + sd); sh.quadraticCurveTo(x0, z0 + sd, x0, z0 + sd - rad); sh.lineTo(x0, z0 + rad); sh.quadraticCurveTo(x0, z0, x0 + rad, z0);
  const foot = 0.5, SK = PIT_D + 0.5, depth = TOP - SK - foot - 2 * bev;        // the slab's top sits below the pit floors; the carved face plate covers it
  const body = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 10 });
  body.rotateX(Math.PI / 2); body.translate(0, TOP - SK - bev, 0);    // extrude ran along +z: now it runs downward from the face plate
  const sideC = canvas(512, 128), sx = sideC.getContext('2d'); paintGrain(sx, 512, 128, { face: [WD.side, WD.side, WD.side], grain: WD.grain }, lcg(3), 0.4);
  const sideT = tex(sideC, true, [0.05, 0.2]);
  const bodyM = new THREE.MeshPhysicalMaterial({ map: sideT, roughness: WD.rough + 0.08, clearcoat: 0.35, clearcoatRoughness: 0.45, envMapIntensity: 0.6 });
  const bodyMesh = new THREE.Mesh(body, bodyM); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; g.add(bodyMesh);
  // carved face (height field)
  const fw = sw, fd = sd, segX = Math.round(230 * segK), segZ = Math.round(262 * segK);
  const face = new THREE.PlaneGeometry(fw, fd, segX, segZ); face.rotateX(-Math.PI / 2);
  const pos = face.attributes.position, uv = face.attributes.uv;
  // the plate's outline follows the slab's rounded corners; its outermost ring of vertices drops to the slab top (a short wall)
  const FR = { x0: -fw / 2, z0: -fd / 2, w: fw, d: fd }, hx = fw / 2 - rad, hz = fd / 2 - rad;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), z = pos.getZ(i);
    const d = rrIn(x, z, FR, rad);
    if (d < 0.02) { const qx = Math.max(-hx, Math.min(hx, x)), qz = Math.max(-hz, Math.min(hz, z)), L = Math.hypot(x - qx, z - qz) || 1; if (d < 0) { x = qx + (x - qx) / L * rad; z = qz + (z - qz) / L * rad; } pos.setXYZ(i, x, TOP - SK - 0.02, z); }
    else pos.setY(i, faceHeight(x, z) - (d < 0.35 ? (1 - d / 0.35) ** 2 * 0.3 : 0));
    uv.setXY(i, (x - BOARD.x0) / BOARD.w, 1 - (z - BOARD.z0) / BOARD.d);
  }
  face.computeVertexNormals();
  const t = faceTextures(wood, texSize);
  const faceM = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.2, roughness: WD.rough + 0.08, clearcoat: 0.28, clearcoatRoughness: 0.45, envMapIntensity: 0.6 });
  const faceMesh = new THREE.Mesh(face, faceM); faceMesh.receiveShadow = true; faceMesh.castShadow = true; g.add(faceMesh);
  // brass studs round the kazans
  const studG = new THREE.SphereGeometry(0.32, 12, 6, 0, TAU, 0, Math.PI / 2);
  const studM = new THREE.MeshStandardMaterial({ color: 0xd2a246, metalness: 1, roughness: 0.32, envMapIntensity: 1.3 });
  const pts = [];
  for (const T of [TRAY.top, TRAY.bottom]) {
    for (let cx = T.x + 30; cx <= T.x + T.w - 30; cx += 22) for (const cy of [T.y - 7, T.y + T.h + 7]) pts.push([cx, cy]);
    for (const cx of [T.x - 7, T.x + T.w + 7]) pts.push([cx, T.y + T.h / 2]);
  }
  const studs = new THREE.InstancedMesh(studG, studM, pts.length), m4 = new THREE.Matrix4();
  pts.forEach(([cx, cy], k) => { const w2 = toWorld(cx, cy); m4.makeTranslation(w2.x, faceHeight(w2.x, w2.z) - 0.05, w2.z); studs.setMatrixAt(k, m4); });
  studs.castShadow = true; g.add(studs);
  g.userData.dispose = () => { body.dispose(); bodyM.dispose(); sideT.dispose(); face.dispose(); faceM.dispose(); t.map.dispose(); t.bump.dispose(); };
  return g;
}

// ---- kumalak (the pebbles): three shapes, three sets of materials (river stones, bone, turquoise), tinted per instance --------
export function pebbleGeos() {
  const out = [];
  for (let v = 0; v < 3; v++) {
    const g = new THREE.SphereGeometry(1, 22, 14), p = g.attributes.position, sx = 1 + v * 0.05, sz = 0.97 - v * 0.04;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nn = (fbm(x * 1.3 + v * 7, z * 1.3 + y * 1.1, 40 + v, 3) - 0.5) * 2, k = 1 + nn * 0.1;
      const yy = y * (1 - 0.18 * y * y);                      // flatter top and bottom: a waterworn disc, not an egg
      p.setXYZ(i, x * PEB.rx * sx * k, yy * PEB.ry * (y < 0 ? 0.85 : 1) * (1 + nn * 0.05), z * PEB.rz * sz * k);
    }
    g.computeVertexNormals(); out.push(g);
  }
  return out;
}
export const TINT3 = {
  stones: [0xbab2a0, 0x9e8566, 0x7f8c88, 0x9c6549],
  bone: [0xfff3da, 0xf6e4bd, 0xeedbb2, 0xfff8ea],
  turquoise: [0x52c7b6, 0x4bb0d0, 0x63c69d, 0x5bbcc2],
};
export function pebbleMaterials() {
  const r = lcg(77);
  const speck = canvas(128), sx = speck.getContext('2d'); sx.fillStyle = '#ffffff'; sx.fillRect(0, 0, 128, 128);
  for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) { const n = 0.82 + 0.3 * fbm(i / 18, j / 18, 3, 4); sx.fillStyle = `rgba(${255 * n | 0},${250 * n | 0},${240 * n | 0},1)`; sx.fillRect(i, j, 1, 1); }
  for (let i = 0; i < 700; i++) { const gv = 120 + r() * 100; sx.fillStyle = `rgba(${gv},${gv - 6},${gv - 14},${0.15 + r() * 0.3})`; sx.fillRect(r() * 128, r() * 128, 0.6 + r() * 0.8, 0.6 + r() * 0.8); }
  for (let i = 0; i < 4; i++) { sx.strokeStyle = 'rgba(255,255,255,0.7)'; sx.lineWidth = 1.5 + r() * 2; sx.beginPath(); sx.moveTo(0, r() * 128); sx.bezierCurveTo(40, r() * 128, 80, r() * 128, 128, r() * 128); sx.stroke(); }
  const boneC = canvas(128), bx = boneC.getContext('2d'); bx.fillStyle = '#ffffff'; bx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 70; i++) { bx.strokeStyle = `rgba(150,120,80,${0.08 + r() * 0.14})`; bx.lineWidth = 0.6 + r() * 1.4; const y = r() * 128; bx.beginPath(); bx.moveTo(0, y); bx.quadraticCurveTo(64, y + (r() - 0.5) * 10, 128, y + (r() - 0.5) * 6); bx.stroke(); }
  const turC = canvas(128), tx2 = turC.getContext('2d'); tx2.fillStyle = '#ffffff'; tx2.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i++) { tx2.strokeStyle = `rgba(${40 + r() * 40},${46 + r() * 30},${36 + r() * 20},${0.4 + r() * 0.4})`; tx2.lineWidth = 0.6 + r() * 1.4; tx2.beginPath(); let px = r() * 128, py = r() * 128; tx2.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 40; py += (r() - 0.5) * 40; tx2.lineTo(px, py); } tx2.stroke(); }
  const T = (c) => tex(c, true, [1, 1]);
  return {
    stones: new THREE.MeshPhysicalMaterial({ map: T(speck), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.9 }),
    bone: new THREE.MeshPhysicalMaterial({ map: T(boneC), roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xfff0d0), clearcoat: 0.15, envMapIntensity: 0.8 }),
    turquoise: new THREE.MeshPhysicalMaterial({ map: T(turC), roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 1.0 }),
  };
}

// ---- where pebble k rests (stable: adding a pebble never moves the others) ----------------------------------------------
const PIT_CAPS = [7, 9, 11, 12];
export function pitSlot(pit, k) {
  let layer = 0, j = k, cap = PIT_CAPS[0];
  while (j >= cap) { j -= cap; layer++; cap = PIT_CAPS[Math.min(layer, PIT_CAPS.length - 1)]; }
  const rf = Math.min(0.92, 0.6 + layer * 0.12), a = j * 2.399963 + pit * 1.1 + layer * 1.3, rr = Math.sqrt((j + 0.5) / cap) * rf;
  const dx = Math.cos(a) * rr * PRX * 0.78, dz = Math.sin(a) * rr * PRZ * 0.78, p = pitWorld(pit);
  const y = pitFloor(pit, dx, dz) + PEB.ry * 0.85 + layer * PEB.ry * 1.35;
  return { x: p.x + dx, y, z: p.z + dz, yaw: hash(pit * 97 + k, 3) * TAU, tx: (hash(pit, k + 5) - 0.5) * (0.2 + layer * 0.35), tz: (hash(k, pit + 9) - 0.5) * (0.2 + layer * 0.35), v: (k * 5 + pit) % 4, g: (k + pit) % 3 };
}
const KAZ_CAPS = [30, 26, 22, 18, 16, 14, 12, 10, 8, 6];
export function kazanSlot(pl, k) {
  let layer = 0, j = k, cap = KAZ_CAPS[0];
  while (j >= cap && layer < KAZ_CAPS.length - 1) { j -= cap; layer++; cap = KAZ_CAPS[layer]; }
  const K = KAZ[pl], cx = (TRAY.bottom.x + 408 - 360) * U, cz = K.z0 + K.d / 2, rf = 1 - layer * 0.085;
  const a = j * 2.399963 + layer * 0.7 + pl, rr = Math.sqrt((j + 0.5) / cap) * rf;
  return { x: cx + Math.cos(a) * rr * 13, y: TOP - KAZ_D + PEB.ry * 0.85 + layer * PEB.ry * 1.15 + (1 - rr) * layer * 0.25 + (j >= cap ? (j - cap) * 0.05 : 0), z: cz + Math.sin(a) * rr * 3.9, yaw: hash(k, 61 + pl) * TAU, tx: (hash(k, 7) - 0.5) * 0.5, tz: (hash(k, 8) - 0.5) * 0.5, v: (k * 3 + pl) % 4, g: k % 3 };
}

// ---- the yurt (kiyiz uy) ------------------------------------------------------------------------------------------------
function rugTexture() {
  // a shyrdak: felt mosaic, madder red field, cream ram's-horn medallions, an indigo and ochre border
  const w = 1024, h = 1200, c = canvas(w, h), x = c.getContext('2d'), r = lcg(19);
  x.fillStyle = '#e8d6b2'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#23305c'; x.beginPath(); x.roundRect(30, 30, w - 60, h - 60, 60); x.fill();
  x.fillStyle = '#a5321f'; x.beginPath(); x.roundRect(110, 110, w - 220, h - 220, 40); x.fill();
  x.lineWidth = 16; x.lineCap = 'round'; x.lineJoin = 'round';
  // border: running horn scrolls in cream on indigo
  x.strokeStyle = '#efe0bd';
  for (let k = 70; k < w - 60; k += 82) { hornPath(x, k, 70, 22); hornPath(x, k, h - 70, 22); }
  for (let k = 150; k < h - 120; k += 82) { x.save(); x.translate(70, k); x.rotate(Math.PI / 2); hornPath(x, 0, 0, 22); x.restore(); x.save(); x.translate(w - 70, k); x.rotate(Math.PI / 2); hornPath(x, 0, 0, 22); x.restore(); }
  // field: medallions of four horns round a diamond
  const med = (cx, cy, s) => {
    x.strokeStyle = '#f1e2bf'; x.lineWidth = 14 * s;
    for (let q = 0; q < 4; q++) { x.save(); x.translate(cx, cy); x.rotate(q * Math.PI / 2); hornPath(x, 0, -64 * s, 30 * s); x.restore(); }
    x.fillStyle = '#e0a63a'; x.beginPath(); x.moveTo(cx, cy - 36 * s); x.lineTo(cx + 36 * s, cy); x.lineTo(cx, cy + 36 * s); x.lineTo(cx - 36 * s, cy); x.closePath(); x.fill();
    x.fillStyle = '#23305c'; x.beginPath(); x.moveTo(cx, cy - 16 * s); x.lineTo(cx + 16 * s, cy); x.lineTo(cx, cy + 16 * s); x.lineTo(cx - 16 * s, cy); x.closePath(); x.fill();
  };
  for (const [cx, cy] of [[w / 2, 330], [w / 2, h - 330], [300, h / 2], [w - 300, h / 2]]) med(cx, cy, 1);
  med(w / 2, h / 2, 1.4);
  // felt: fibres, slight mottling, stitched outlines
  const d = x.getImageData(0, 0, w, h), a = d.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (j * w + i) * 4, n = 0.86 + 0.14 * fbm(i / 40, j / 40, 4, 3) + (hash(i, j) - 0.5) * 0.1; a[k] *= n; a[k + 1] *= n; a[k + 2] *= n; }
  x.putImageData(d, 0, 0);
  x.setLineDash([6, 8]); x.strokeStyle = 'rgba(250,236,200,0.45)'; x.lineWidth = 2.5; x.beginPath(); x.roundRect(118, 118, w - 236, h - 236, 36); x.stroke(); x.beginPath(); x.roundRect(38, 38, w - 76, h - 76, 56); x.stroke();
  for (let i = 0; i < 1400; i++) { x.strokeStyle = `rgba(255,240,210,${0.04 + r() * 0.06})`; x.lineWidth = 1; const px = r() * w, py = r() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 14, py + (r() - 0.5) * 14); x.stroke(); }
  return tex(c, true);
}
function feltTexture(base, seed, rep) {
  const s = 256, c = canvas(s), x = c.getContext('2d'), img = x.createImageData(s, s), [R, G, B] = base;
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const k = (j * s + i) * 4, n = 0.84 + 0.2 * fbm(i / 24, j / 24, seed, 3) + (hash(i + seed, j) - 0.5) * 0.12; img.data[k] = R * n; img.data[k + 1] = G * n; img.data[k + 2] = B * n; img.data[k + 3] = 255; }
  x.putImageData(img, 0, 0); return tex(c, true, rep);
}
function latticeTexture() {
  // kerege: red-ochre willow slats crossing on the diagonal over white felt, tied with leather at each crossing
  const w = 512, h = 256, c = canvas(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d9ccb0'); g.addColorStop(1, '#bfae8c'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.lineCap = 'butt';
  for (const dir of [1, -1]) for (let k = -h; k < w + h; k += 32) {
    x.strokeStyle = 'rgba(40,14,6,0.35)'; x.lineWidth = 9; x.beginPath(); x.moveTo(k + 2, 2); x.lineTo(k + dir * h + 2, h + 2); x.stroke();
    x.strokeStyle = '#a3421f'; x.lineWidth = 7; x.beginPath(); x.moveTo(k, 0); x.lineTo(k + dir * h, h); x.stroke();
    x.strokeStyle = 'rgba(255,200,150,0.35)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(k - 2, 0); x.lineTo(k + dir * h - 2, h); x.stroke();
  }
  for (let i = 0; i < w; i += 32) for (let j = 0; j < h; j += 32) { x.fillStyle = '#5a3418'; x.beginPath(); x.arc(i + 16, j + 16, 3.4, 0, TAU); x.fill(); x.beginPath(); x.arc(i, j, 3.4, 0, TAU); x.fill(); }
  return tex(c, true, [12, 1]);
}
function hangingTexture(seed) {
  // a tus kiiz: embroidered wall hanging, a dark felt ground with bright horn scrolls and a border
  const w = 256, h = 320, c = canvas(w, h), x = c.getContext('2d'), r = lcg(seed);
  const grounds = ['#2a1b3c', '#1f3550', '#5a1c1a'], fg = ['#e9b04a', '#e8d6b0', '#d5553a', '#5bb0a0'];
  x.fillStyle = grounds[seed % 3]; x.fillRect(0, 0, w, h);
  x.strokeStyle = fg[0]; x.lineWidth = 6; x.strokeRect(12, 12, w - 24, h - 24);
  x.lineWidth = 7; x.lineCap = 'round';
  for (let k = 0; k < 3; k++) { x.strokeStyle = fg[(k + seed) % 4]; hornPath(x, w / 2, 80 + k * 80, 34 - k * 4); }
  for (let k = 20; k < w - 20; k += 22) { x.fillStyle = fg[(k / 22 | 0) % 4]; x.beginPath(); x.arc(k + 4, h - 22, 4, 0, TAU); x.fill(); }
  for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.05})`; x.fillRect(r() * w, r() * h, 2, 2); }
  return tex(c, true);
}
const R_YURT = 330, WALL_H = 150, CROWN_R = 62, CROWN_Y = 360;
export function buildYurt(scene, { quality = 1 } = {}) {
  // the yurt is centred under its crown; the board sits off-centre so the light through the crown falls on it
  const g = new THREE.Group(); scene.add(g); g.position.set(-SUN_DIR.x / SUN_DIR.y * CROWN_Y, 0, -SUN_DIR.z / SUN_DIR.y * CROWN_Y);
  const near = new THREE.Group(); scene.add(near);              // things placed round the board (absolute coordinates)
  // floor: felt over the ground, then the shyrdak under the board
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R_YURT + 5, 64), new THREE.MeshStandardMaterial({ map: feltTexture([112, 84, 60], 5, [14, 14]), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const rugG = new THREE.PlaneGeometry(150, 176, 1, 1); rugG.rotateX(-Math.PI / 2);
  const rug = new THREE.Mesh(rugG, new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.98 })); rug.position.y = 0.25; rug.receiveShadow = true; near.add(rug);
  // the kerege wall: lattice on the inside, felt behind it
  const wallG = new THREE.CylinderGeometry(R_YURT, R_YURT, WALL_H, 96, 1, true);
  const wall = new THREE.Mesh(wallG, new THREE.MeshStandardMaterial({ map: latticeTexture(), roughness: 0.9, side: THREE.BackSide }));
  wall.position.y = WALL_H / 2; wall.receiveShadow = true; g.add(wall);
  // the roof: felt cone inside, uyk poles in red ochre from the wall head to the crown
  const roofG = new THREE.CylinderGeometry(CROWN_R, R_YURT, CROWN_Y - WALL_H, 96, 1, true);
  const roof = new THREE.Mesh(roofG, new THREE.MeshStandardMaterial({ map: feltTexture([200, 184, 150], 9, [10, 3]), roughness: 1, side: THREE.BackSide }));
  roof.position.y = WALL_H + (CROWN_Y - WALL_H) / 2; g.add(roof);
  const NP = 72, pole = new THREE.CylinderGeometry(1.4, 1.8, 1, 8); pole.translate(0, 0.5, 0);
  const poles = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: 0xa8401f, roughness: 0.55 }), NP), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < NP; i++) {
    const a = i / NP * TAU, A = new THREE.Vector3(Math.cos(a) * (R_YURT - 4), WALL_H, Math.sin(a) * (R_YURT - 4)), B = new THREE.Vector3(Math.cos(a) * (CROWN_R + 2), CROWN_Y - 3, Math.sin(a) * (CROWN_R + 2));
    const d = B.clone().sub(A), L = d.length(); q.setFromUnitVectors(up, d.normalize()); m4.compose(A, q, new THREE.Vector3(1, L, 1)); poles.setMatrixAt(i, m4);
  }
  g.add(poles);
  // the band (bau) round the wall head: a woven strip
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R_YURT - 3, R_YURT - 3, 14, 96, 1, true), new THREE.MeshStandardMaterial({ map: hangingTexture(1), roughness: 0.9, side: THREE.BackSide }));
  band.material.map.wrapS = THREE.RepeatWrapping; band.material.map.repeat.set(30, 0.3); band.position.y = WALL_H - 10; g.add(band);
  // the shanyrak: a heavy wooden ring with the crossed, bent kulduresh bars, and the bright sky above it
  const crown = new THREE.Group(); crown.position.y = CROWN_Y;
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a4a22, roughness: 0.6 });
  crown.add(new THREE.Mesh(new THREE.TorusGeometry(CROWN_R, 4, 10, 48).rotateX(Math.PI / 2), wood));
  for (const rot of [0, Math.PI / 2]) for (const off of [-24, 0, 24]) {
    const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16 * 2 - 1, half = Math.sqrt(CROWN_R * CROWN_R - off * off); pts.push(new THREE.Vector3(t * half, 16 * (1 - t * t), off)); }
    const bar = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 1.8, 6), wood); bar.rotation.y = rot; crown.add(bar);
  }
  const sky = new THREE.Mesh(new THREE.CircleGeometry(CROWN_R, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xdcecff, fog: false }));
  sky.position.y = 22; crown.add(sky); g.add(crown);
  // the light shaft falling from the crown: a soft additive column
  const shaftC = canvas(64, 256), sx = shaftC.getContext('2d'), sg = sx.createLinearGradient(0, 0, 0, 256); sg.addColorStop(0, 'rgba(255,244,220,0.5)'); sg.addColorStop(1, 'rgba(255,230,190,0.02)');
  sx.fillStyle = sg; sx.fillRect(0, 0, 64, 256); const eg = sx.createLinearGradient(0, 0, 64, 0); eg.addColorStop(0, 'rgba(0,0,0,1)'); eg.addColorStop(0.3, 'rgba(0,0,0,0)'); eg.addColorStop(0.7, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,1)'); sx.globalCompositeOperation = 'destination-out'; sx.fillStyle = eg; sx.fillRect(0, 0, 64, 256);
  const shaftG = new THREE.CylinderGeometry(CROWN_R * 0.9, CROWN_R * 1.15, CROWN_Y, 32, 1, true);
  const shaft = new THREE.Mesh(shaftG, new THREE.MeshBasicMaterial({ map: tex(shaftC, true), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.32, fog: false }));
  // the column runs from the board up to the crown along the light
  const tilt = new THREE.Group(); tilt.quaternion.setFromUnitVectors(up, SUN_DIR); tilt.add(shaft);
  const shaftLen = CROWN_Y / SUN_DIR.y; shaft.scale.set(1, shaftLen / CROWN_Y, 1); shaft.position.set(0, shaftLen / 2, 0);
  near.add(tilt);
  // motes drifting in the light
  const moteC = canvas(32), mx = moteC.getContext('2d'), mg = mx.createRadialGradient(16, 16, 0, 16, 16, 16); mg.addColorStop(0, 'rgba(255,248,230,1)'); mg.addColorStop(1, 'rgba(255,248,230,0)'); mx.fillStyle = mg; mx.fillRect(0, 0, 32, 32);
  const NM = 70, mp = new Float32Array(NM * 3), rm = lcg(8);
  for (let i = 0; i < NM; i++) { const t = rm() * 0.9, a = rm() * TAU, rr = Math.sqrt(rm()) * CROWN_R * 0.9; mp[i * 3] = SUN_DIR.x / SUN_DIR.y * t * 300 + Math.cos(a) * rr; mp[i * 3 + 1] = t * 300 + 6; mp[i * 3 + 2] = SUN_DIR.z / SUN_DIR.y * t * 300 + Math.sin(a) * rr; }
  const mg2 = new THREE.BufferGeometry(); mg2.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(mg2, new THREE.PointsMaterial({ map: tex(moteC, true), size: 1.1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7, fog: false }));
  near.add(motes);
  // furnishings along the wall: painted chests with stacked quilts (zhuk), wall hangings, a low table with bowls
  const chestC = canvas(256, 128), cx = chestC.getContext('2d'); cx.fillStyle = '#7a2c18'; cx.fillRect(0, 0, 256, 128); cx.strokeStyle = '#e2b25a'; cx.lineWidth = 5; cx.strokeRect(10, 10, 236, 108); cx.lineWidth = 4; hornPath(cx, 128, 64, 30); hornPath(cx, 60, 64, 16); hornPath(cx, 196, 64, 16);
  const chestM = new THREE.MeshStandardMaterial({ map: tex(chestC, true), roughness: 0.5, metalness: 0.05 });
  const quiltCols = [0xb8352a, 0x2f5f8a, 0xe0b04a, 0x3e8a6a, 0x8a2f5a, 0xd8c8a8];
  const put = (o, a, dist, y = 0) => { o.position.set(Math.cos(a) * dist, y, Math.sin(a) * dist); o.lookAt(0, y, 0); g.add(o); return o; };
  for (const a of [-Math.PI / 2 - 0.1, -Math.PI / 2 + 0.55, -Math.PI / 2 - 0.75]) {
    const zh = new THREE.Group(), chest = new THREE.Mesh(new THREE.BoxGeometry(110, 50, 50), chestM); chest.position.y = 25; chest.castShadow = true; chest.receiveShadow = true; zh.add(chest);
    let y = 50; const rq = lcg(Math.round(a * 100) + 50);
    for (let k = 0; k < 6; k++) { const hgt = 7 + rq() * 4, qm = new THREE.Mesh(new THREE.BoxGeometry(104 - rq() * 6, hgt, 46), new THREE.MeshStandardMaterial({ color: quiltCols[(k + Math.round(a * 10)) % 6], map: feltTexture([255, 255, 255], k + 20, [2, 1]), roughness: 0.95 })); qm.position.set((rq() - 0.5) * 3, y + hgt / 2, 0); qm.castShadow = quality > 0; qm.receiveShadow = true; zh.add(qm); y += hgt; }
    put(zh, a, R_YURT - 34);
  }
  for (const [a, y, sc] of [[-Math.PI / 2 + 1.25, 70, 1], [-Math.PI / 2 - 1.3, 72, 1.1], [-Math.PI / 2 + 2.0, 74, 0.9], [-Math.PI / 2 - 2.05, 70, 1]]) {
    const hang = new THREE.Mesh(new THREE.PlaneGeometry(64 * sc, 80 * sc), new THREE.MeshStandardMaterial({ map: hangingTexture(Math.round(a * 7) & 7), roughness: 0.95, side: THREE.DoubleSide }));
    put(hang, a, R_YURT - 6, y);
  }
  // a low round table (dastarkhan) with tea bowls, off to one side
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 3, 40), new THREE.MeshPhysicalMaterial({ color: 0x6e3a1c, roughness: 0.4, clearcoat: 0.5 })); top.position.y = 22; top.castShadow = true; top.receiveShadow = true; table.add(top);
  for (let k = 0; k < 4; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 21, 8), top.material); leg.position.set(Math.cos(k * TAU / 4 + 0.8) * 24, 10.5, Math.sin(k * TAU / 4 + 0.8) * 24); table.add(leg); }
  const bowlP = []; for (let i = 0; i <= 10; i++) { const t = i / 10; bowlP.push(new THREE.Vector2(2.4 + Math.sin(t * Math.PI / 2) * 3.8, t * 4.4)); }
  const bowlM = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.25, side: THREE.DoubleSide });
  for (const [bx2, bz] of [[-10, 6], [8, -9], [12, 10]]) { const b = new THREE.Mesh(new THREE.LatheGeometry(bowlP, 24), bowlM); b.position.set(bx2, 23.5, bz); b.castShadow = true; table.add(b); }
  table.position.set(-118, 0, 34); table.rotation.y = 0.4; near.add(table);
  // a pair of soft floor cushions (korpe) beside the board
  const cushion = (col, x, z, ry) => { const c = new THREE.Mesh(new THREE.BoxGeometry(46, 6, 54, 1, 1, 1), new THREE.MeshStandardMaterial({ color: col, map: feltTexture([255, 255, 255], 31, [2, 2]), roughness: 0.95 })); c.position.set(x, 3.3, z); c.rotation.y = ry; c.castShadow = quality > 0; c.receiveShadow = true; near.add(c); };
  return { group: g, near, motes, shaft, crown };
}

// Lights: daylight through the crown (shadows), sky fill from above, warm felt bounce, a cool rim from the door side.
export function buildLights(scene) {
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.0); sun.position.copy(SUN_DIR).multiplyScalar(260); sun.target.position.set(0, 0, 0);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 100, far: 420 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  const hemi = new THREE.HemisphereLight(0xdfe6ff, 0x8a5a3a, 0.65);
  const fill = new THREE.PointLight(0xffa860, 900, 600, 1.6); fill.position.set(-140, 90, 90);
  const rim = new THREE.DirectionalLight(0xbcd4ff, 0.55); rim.position.set(80, 60, -160);
  scene.add(sun, sun.target, hemi, fill, rim);
  return { sun, hemi, fill, rim };
}
// Soft radial texture for contact blobs.
export function radialTex(rgb = '0,0,0', a = 1) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// A tuz marker: a felt inlay in the owner's colour lying in the pit and a small carved stick with a felt flag.
export function buildTuz(owner) {
  const g = new THREE.Group(), col = owner === 0 ? 0xb4432c : 0x23918c;
  const disk = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, map: feltTexture([255, 255, 255], 40 + owner, [1, 1]) }));
  disk.scale.set(PRX * 0.82, 1, PRZ * 0.82); disk.position.y = TOP - PIT_D + 0.12; disk.receiveShadow = true; g.add(disk);
  const ringC = canvas(128), rx = ringC.getContext('2d'); rx.setLineDash([10, 8]); rx.strokeStyle = 'rgba(250,236,200,0.95)'; rx.lineWidth = 5; rx.beginPath(); rx.arc(64, 64, 52, 0, TAU); rx.stroke();
  const stitch = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex(ringC, true), transparent: true, depthWrite: false }));
  stitch.scale.copy(disk.scale); stitch.position.y = disk.position.y + 0.03; g.add(stitch);
  const staff = new THREE.Group(); staff.position.set(-0.4, TOP - PIT_D + 0.1, 1.2); g.add(staff);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 6.4, 8), new THREE.MeshStandardMaterial({ color: 0x6a4424, roughness: 0.55 })); stick.position.y = 3.2; stick.castShadow = true; staff.add(stick);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: 1, roughness: 0.3 })); knob.position.y = 6.5; staff.add(knob);
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.quadraticCurveTo(1.6, -0.2, 3.2, -0.9); fs.quadraticCurveTo(1.6, -1.5, 0, -2.4); fs.lineTo(0, 0);
  const flagG = new THREE.ShapeGeometry(fs, 12); const fp = flagG.attributes.position; flagG.userData.base = Float32Array.from(fp.array);
  const flag = new THREE.Mesh(flagG, new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, side: THREE.DoubleSide, map: feltTexture([255, 255, 255], 44, [1, 1]) }));
  flag.position.set(0.15, 6.2, 0); flag.castShadow = true; staff.add(flag);
  staff.scale.setScalar(1); flag.scale.setScalar(1.45);
  g.userData = { staff, flag, disk, stitch };
  return g;
}
export function waveFlag(flag, t, amp) {
  const p = flag.geometry.attributes.position, b = flag.geometry.userData.base;
  for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(x * 1.4 - t * 5) * 0.28 * amp * x / 3.2); }
  p.needsUpdate = true;
}
