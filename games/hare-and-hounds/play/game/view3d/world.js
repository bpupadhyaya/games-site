// Hare and Hounds 3D world (presentation only; no game logic). Units are centimetres, y up.
// A carved oak hunt board on a great oak stump in a forest clearing; three painted hound carvings and one hare carving,
// sculpted at load time from smooth signed-distance shapes (surface nets), so the animals are organic, not glued primitives.
// Board axes: x = the three lanes (lane 0 left), z = the length (the hounds' end near the camera at +z, the hare's end far at -z).
import * as THREE from '../vendor3d/three.js';
import { AX, LAT, STEPS } from '../src/rules.js';

export const SP = 10;                                   // distance between neighbouring points
export const FIELD_W = 2 * SP + 15, FIELD_L = 4 * SP + 16, FRAME = 3.2;
export const BOARD_W = FIELD_W + 2 * FRAME, BOARD_L = FIELD_L + 2 * FRAME;
export const STUMP_Y = 40, BOARD_H = 3.4, TOP = STUMP_Y + BOARD_H;   // TOP = the playing field
export const BASE_R = 3.5;                             // a piece's turned plinth
export const pointW = (i) => ({ x: (LAT[i] - 1) * SP, z: (2 - AX[i]) * SP });
const TAU = Math.PI * 2;
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const lcg = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const texOf = (c, srgb = true, rep = null) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

// ------------------------------------------------------------------------------------------ themes
export const THEMES = {
  autumn: { fog: 0x6a5332, fogNear: 160, fogFar: 1100, bg: 0x5d4a2e, hemiSky: 0xffe0b0, hemiGround: 0x4a3018, hemi: 0.75, key: 0xffe4bc, keyI: 2.3, rim: 0xffb45a, rimI: 2.4, ground: ['#4a3219', '#6b4422', '#8a5a26'], leaves: [0xd2691e, 0xb5401c, 0xe0a030, 0x9c5a1c, 0xc8862a], fall: 'leaf', shaft: '255,196,120', exposure: 1.0 },
  winter: { fog: 0xaebdcc, fogNear: 140, fogFar: 950, bg: 0xa8b8c8, hemiSky: 0xe8f0ff, hemiGround: 0x8a96a6, hemi: 0.9, key: 0xf4f6ff, keyI: 2.1, rim: 0xffd9a8, rimI: 1.6, ground: ['#cfd9e4', '#e8eef5', '#b8c6d4'], leaves: [0x8a6a4a, 0x6e5238, 0xa08060], fall: 'snow', shaft: '255,240,220', exposure: 0.95, snow: true },
  night: { fog: 0x0d1626, fogNear: 120, fogFar: 760, bg: 0x0a1220, hemiSky: 0x5a78b8, hemiGround: 0x101010, hemi: 0.45, key: 0x9fb8ff, keyI: 1.2, rim: 0x7fa0ff, rimI: 1.3, ground: ['#1a2016', '#252c1c', '#2e2a1c'], leaves: [0x5a3a1c, 0x4a2e18, 0x6a4a22], fall: 'firefly', shaft: '140,170,255', exposure: 1.05, lantern: true },
};

// ------------------------------------------------------------------------------------------ textures
export function radialTex(rgb, a = 1, size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.5})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return texOf(c);
}
export function ringTex(size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(255,255,255,0.1)'); g.addColorStop(0.76, 'rgba(255,255,255,1)'); g.addColorStop(0.86, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size); return texOf(c);
}
function grain(x, w, h, c0, c1, seed, lines = 160, vertical = true) {
  const r = lcg(seed); x.fillStyle = c0; x.fillRect(0, 0, w, h);
  for (let i = 0; i < lines; i++) {
    const p = r() * (vertical ? w : h), amp = 2 + r() * 10, f = 0.002 + r() * 0.01, ph = r() * TAU;
    x.strokeStyle = r() < 0.5 ? c1 : 'rgba(0,0,0,0.18)'; x.globalAlpha = 0.08 + r() * 0.22; x.lineWidth = 0.6 + r() * 2.4; x.beginPath();
    for (let t = 0; t <= (vertical ? h : w); t += 8) { const o = p + Math.sin(t * f + ph) * amp + Math.sin(t * f * 3.1 + ph) * amp * 0.3; if (vertical) x.lineTo(o, t); else x.lineTo(t, o); }
    x.stroke();
  }
  x.globalAlpha = 1;
}
// the playing field: oak with pyrographed (burnt) lines, carved grooves, the burrow and the paw, small pines in the corners
function fieldCanvas(size) {
  const k = size / FIELD_W, w = size, h = Math.round(FIELD_L * k), c = cv(w, h), x = c.getContext('2d');
  const b = cv(w, h), bx = b.getContext('2d');                     // bump map: white = high
  grain(x, w, h, '#b88a52', 'rgba(110,64,26,0.9)', 11, 260);
  const shade = x.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, h * 0.7); shade.addColorStop(0, 'rgba(255,230,180,0.18)'); shade.addColorStop(1, 'rgba(60,30,8,0.32)');
  x.fillStyle = shade; x.fillRect(0, 0, w, h);
  bx.fillStyle = '#c8c8c8'; bx.fillRect(0, 0, w, h);
  const P = (i) => { const p = pointW(i); return [(p.x + FIELD_W / 2) * k, (p.z + FIELD_L / 2) * k]; };
  // border: a burnt double line
  x.strokeStyle = 'rgba(52,24,6,0.75)'; x.lineWidth = 0.18 * k; x.strokeRect(1.1 * k, 1.1 * k, w - 2.2 * k, h - 2.2 * k); x.lineWidth = 0.08 * k; x.strokeRect(1.6 * k, 1.6 * k, w - 3.2 * k, h - 3.2 * k);
  // pines burnt into the four corners
  const pine = (cx, cy, s) => { x.fillStyle = 'rgba(58,28,8,0.42)'; for (let t = 0; t < 3; t++) { x.beginPath(); const yy = cy - s * 0.25 * t; x.moveTo(cx, yy - s * 0.7); x.lineTo(cx + s * (0.55 - t * 0.12), yy); x.lineTo(cx - s * (0.55 - t * 0.12), yy); x.fill(); } x.fillRect(cx - s * 0.06, cy, s * 0.12, s * 0.2); };
  const ins = 4.6 * k; pine(ins, ins + 1.4 * k, 3.4 * k); pine(w - ins, ins + 1.4 * k, 3.4 * k); pine(ins, h - ins + 0.6 * k, 3.0 * k); pine(w - ins, h - ins + 0.6 * k, 3.0 * k);
  // the lines of the board: carved grooves (dark bed, a light lip on the far side) and in the bump map
  const seen = new Set();
  for (let i = 0; i < STEPS.length; i++) for (const j of STEPS[i]) {
    const key = Math.min(i, j) + '-' + Math.max(i, j); if (seen.has(key)) continue; seen.add(key);
    const [x0, y0] = P(i), [x1, y1] = P(j);
    x.lineCap = 'round';
    x.strokeStyle = 'rgba(255,226,170,0.35)'; x.lineWidth = 1.5 * k; x.beginPath(); x.moveTo(x0, y0 - 0.12 * k); x.lineTo(x1, y1 - 0.12 * k); x.stroke();
    x.strokeStyle = 'rgba(56,26,6,0.9)'; x.lineWidth = 0.95 * k; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
    x.strokeStyle = 'rgba(30,12,2,0.55)'; x.lineWidth = 0.4 * k; x.beginPath(); x.moveTo(x0, y0 + 0.1 * k); x.lineTo(x1, y1 + 0.1 * k); x.stroke();
    bx.lineCap = 'round'; bx.strokeStyle = '#303030'; bx.lineWidth = 1.0 * k; bx.beginPath(); bx.moveTo(x0, y0); bx.lineTo(x1, y1); bx.stroke();
  }
  // the points: dished cups (dark centre, a bright turned rim)
  for (let i = 0; i < 11; i++) {
    const [px, py] = P(i), r = 3.3 * k;
    const g = x.createRadialGradient(px, py - r * 0.2, r * 0.1, px, py, r); g.addColorStop(0, 'rgba(70,36,10,0.55)'); g.addColorStop(0.75, 'rgba(120,70,28,0.35)'); g.addColorStop(0.93, 'rgba(255,224,170,0.45)'); g.addColorStop(1, 'rgba(60,28,6,0.6)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
    const gb = bx.createRadialGradient(px, py, 0, px, py, r); gb.addColorStop(0, '#606060'); gb.addColorStop(0.85, '#9a9a9a'); gb.addColorStop(1, '#c8c8c8'); bx.fillStyle = gb; bx.beginPath(); bx.arc(px, py, r, 0, TAU); bx.fill();
  }
  // the hare's end: a burrow mouth with grass; the hounds' end: a paw print
  { const [px, py] = P(10); x.fillStyle = 'rgba(20,8,2,0.85)'; x.beginPath(); x.ellipse(px, py - 0.2 * k, 1.7 * k, 1.1 * k, 0, 0, TAU); x.fill(); x.strokeStyle = 'rgba(60,90,30,0.7)'; x.lineWidth = 0.14 * k; for (let a = -1.2; a <= 1.2; a += 0.3) { x.beginPath(); x.moveTo(px + Math.sin(a) * 1.8 * k, py - Math.cos(a) * 1.25 * k); x.lineTo(px + Math.sin(a) * 2.5 * k, py - Math.cos(a) * 1.9 * k); x.stroke(); } }
  { const [px, py] = P(0); x.fillStyle = 'rgba(52,24,6,0.7)'; x.beginPath(); x.ellipse(px, py + 0.5 * k, 0.9 * k, 0.75 * k, 0, 0, TAU); x.fill(); for (const [dx, dy] of [[-1, -0.7], [-0.36, -1.25], [0.36, -1.25], [1, -0.7]]) { x.beginPath(); x.ellipse(px + dx * k, py + dy * k, 0.33 * k, 0.42 * k, dx * 0.3, 0, TAU); x.fill(); } }
  return { map: texOf(c), bump: texOf(b, false) };
}
function barkCanvas(w, h, seed, c0 = '#3a2c20', c1 = '#5a4634') {
  const c = cv(w, h), x = c.getContext('2d'), r = lcg(seed); x.fillStyle = c0; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { const px = r() * w, wd = 3 + r() * 9; x.fillStyle = r() < 0.5 ? c1 : 'rgba(0,0,0,0.35)'; x.globalAlpha = 0.35 + r() * 0.4; x.beginPath(); let y = 0; x.moveTo(px, 0); while (y < h) { y += 10 + r() * 30; x.lineTo(px + (r() - 0.5) * 6, y); } x.lineTo(px + wd, h); x.lineTo(px + wd, 0); x.fill(); }
  for (let i = 0; i < 200; i++) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.globalAlpha = 0.5; x.fillRect(r() * w, r() * h, 1 + r() * 2, 6 + r() * 30); }
  x.globalAlpha = 1; return c;
}
function ringsCanvas(size, snow) {
  const c = cv(size), x = c.getContext('2d'), r = lcg(91), m = size / 2;
  x.fillStyle = '#9a7246'; x.fillRect(0, 0, size, size);
  for (let i = 60; i > 0; i--) { const rr = (i / 60) * m * 0.97; x.strokeStyle = i % 2 ? 'rgba(80,46,18,0.5)' : 'rgba(200,160,110,0.35)'; x.lineWidth = 1 + r() * 3; x.beginPath(); for (let a = 0; a <= TAU + 0.01; a += 0.06) { const w = rr * (1 + Math.sin(a * 3 + i) * 0.012 + (r() - 0.5) * 0.006); x.lineTo(m + Math.cos(a) * w, m + Math.sin(a) * w); } x.stroke(); }
  const gr = x.createRadialGradient(m, m, m * 0.85, m, m, m); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.9, 'rgba(60,34,14,0.8)'); gr.addColorStop(1, 'rgba(40,24,12,1)'); x.fillStyle = gr; x.fillRect(0, 0, size, size);
  x.strokeStyle = 'rgba(30,14,4,0.75)'; x.lineWidth = 3; for (let i = 0; i < 7; i++) { const a = r() * TAU, l = m * (0.3 + r() * 0.5); x.beginPath(); x.moveTo(m + Math.cos(a) * m * 0.95, m + Math.sin(a) * m * 0.95); x.lineTo(m + Math.cos(a + 0.03) * (m - l), m + Math.sin(a + 0.03) * (m - l)); x.stroke(); }
  if (snow) { for (let i = 0; i < 260; i++) { x.fillStyle = 'rgba(245,250,255,0.75)'; const a = r() * TAU, d = m * (0.7 + r() * 0.3); x.beginPath(); x.arc(m + Math.cos(a) * d, m + Math.sin(a) * d, 3 + r() * 8, 0, TAU); x.fill(); } }
  return c;
}
function groundCanvas(size, T) {
  const c = cv(size), x = c.getContext('2d'), r = lcg(5); x.fillStyle = T.snow ? T.ground[1] : T.ground[0]; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) { const g = x.createRadialGradient(r() * size, r() * size, 0, r() * size, r() * size, 40 + r() * 90); void g; x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,220,160,0.05)'; x.beginPath(); x.arc(r() * size, r() * size, 30 + r() * 80, 0, TAU); x.fill(); }
  for (let i = 0; i < 5200; i++) {
    const px = r() * size, py = r() * size, s = 2.5 + r() * 6.5, a = r() * TAU;
    x.save(); x.translate(px, py); x.rotate(a); x.globalAlpha = 0.5 + r() * 0.5;
    if (T.snow) { x.fillStyle = r() < 0.8 ? T.ground[1 + (i % 2)] : 'rgba(120,100,80,0.6)'; x.beginPath(); x.arc(0, 0, s * 0.45, 0, TAU); x.fill(); }
    else { const col = T.leaves[i % T.leaves.length]; x.fillStyle = `#${new THREE.Color(col).multiplyScalar(0.3 + r() * 0.45).getHexString()}`; x.beginPath(); x.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(-s, 0); x.lineTo(s, 0); x.stroke(); }
    x.restore();
  }
  x.globalAlpha = 1; return c;
}
function leafCanvas() {
  const c = cv(64), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 2); x.bezierCurveTo(56, 14, 58, 40, 32, 62); x.bezierCurveTo(6, 40, 8, 14, 32, 2); x.fill();
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(32, 4); x.lineTo(32, 60); x.stroke();
  x.lineWidth = 1; for (let i = 0; i < 4; i++) { const y = 16 + i * 10; x.beginPath(); x.moveTo(32, y + 6); x.lineTo(18, y); x.moveTo(32, y + 6); x.lineTo(46, y); x.stroke(); }
  return texOf(c);
}

// ------------------------------------------------------------------------------------------ materials
const std = (o) => new THREE.MeshStandardMaterial(o);
const brass = () => std({ color: 0xc89a48, metalness: 1, roughness: 0.32, envMapIntensity: 1.4 });
const copper = () => std({ color: 0xc87850, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 });
function woodMat(c0, c1, seed, rough = 0.55, rep = [1, 1]) { const c = cv(256, 512); grain(c.getContext('2d'), 256, 512, c0, c1, seed, 90); return std({ map: texOf(c, true, rep), roughness: rough, metalness: 0 }); }

// ------------------------------------------------------------------------------------------ the board
function roundRect(w, h, r) { const s = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2; s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); s.lineTo(x0 + w, y0 + h - r); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h); s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0); return s; }
export function buildBoard(texSize = 1024) {
  const g = new THREE.Group();
  const frameMat = woodMat('#4a2a14', 'rgba(150,90,40,0.8)', 3, 0.42, [1, 2]);
  // body: the frame (a rounded slab with the field cut out, bevelled) and the recessed field
  const outer = roundRect(BOARD_W, BOARD_L, 3.2), hole = roundRect(FIELD_W, FIELD_L, 1.2);
  const ring = outer.clone(); ring.holes.push(new THREE.Path(hole.getPoints(12).reverse()));
  const fg = new THREE.ExtrudeGeometry(ring, { depth: BOARD_H + 0.5 - 0.6, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 4, curveSegments: 12 });
  fg.rotateX(-Math.PI / 2); fg.translate(0, STUMP_Y, 0);
  const frame = new THREE.Mesh(fg, frameMat); frame.castShadow = true; frame.receiveShadow = true; g.add(frame);
  const tx = fieldCanvas(texSize);
  const fieldMat = std({ map: tx.map, bumpMap: tx.bump, bumpScale: 1.2, roughness: 0.62 });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, FIELD_L), fieldMat); field.rotation.x = -Math.PI / 2; field.position.y = TOP; field.receiveShadow = true; g.add(field);
  const under = new THREE.Mesh(new THREE.BoxGeometry(FIELD_W, BOARD_H - 0.2, FIELD_L), frameMat); under.position.y = STUMP_Y + (BOARD_H - 0.2) / 2; under.receiveShadow = true; g.add(under);
  // brass: a ring round every point, corner plates, a hanging ring at the hare's end
  const b = brass(), tor = new THREE.TorusGeometry(3.3, 0.16, 8, 40); tor.rotateX(Math.PI / 2);
  const rings = new THREE.InstancedMesh(tor, b, 11);
  for (let i = 0; i < 11; i++) { const p = pointW(i); rings.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, TOP + 0.05, p.z)); }
  rings.receiveShadow = true; g.add(rings);
  const plate = new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(5.2, 0); s.quadraticCurveTo(2.2, 0.9, 0.9, 2.2); s.quadraticCurveTo(0, 2.2 + 3, 0, 5.2); s.lineTo(0, 0); return s; })(), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
  plate.rotateX(-Math.PI / 2);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const m = new THREE.Mesh(plate, b); m.scale.set(-sx, 1, sz); m.position.set(sx * (BOARD_W / 2 - 0.7), TOP + 0.5 + 0.02, sz * (BOARD_L / 2 - 0.7)); m.castShadow = true; g.add(m);
  }
  g.userData.field = field;
  return g;
}

// ------------------------------------------------------------------------------------------ the clearing
export function buildClearing(scene, theme, quality = 1) {
  const T = THEMES[theme] ?? THEMES.autumn, g = new THREE.Group();
  // ground
  const gt = texOf(groundCanvas(1024, T), true, [11, 11]);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 48), std({ map: gt, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  // the stump: ring-cut top, bark sides flaring into roots
  const bark = barkCanvas(512, 256, 7), barkMat = std({ map: texOf(bark, true, [4, 1]), bumpMap: texOf(bark, false, [4, 1]), bumpScale: 2.5, roughness: 0.92 });
  const prof = [[0, 0], [62, 0], [60, 3], [56, 8], [54, 16], [53, 30], [52.5, STUMP_Y - 1.5], [51.5, STUMP_Y], [0, STUMP_Y]].map(([r, y]) => new THREE.Vector2(r, y));
  const sg = new THREE.LatheGeometry(prof, 48); const pos = sg.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), a = Math.atan2(z, x), r = Math.hypot(x, z); if (r < 1) continue; const wob = 1 + 0.035 * Math.sin(a * 5 + 1) + 0.02 * Math.sin(a * 11) + (y < 10 ? 0.12 * Math.max(0, Math.sin(a * 6)) ** 3 * (1 - y / 10) : 0); pos.setX(i, x * wob); pos.setZ(i, z * wob); }
  sg.computeVertexNormals();
  const stump = new THREE.Mesh(sg, barkMat); stump.castShadow = true; stump.receiveShadow = true; g.add(stump);
  const top = new THREE.Mesh(new THREE.CircleGeometry(52.2, 64), std({ map: texOf(ringsCanvas(1024, T.snow)), roughness: 0.8 }));
  const tp = top.geometry.attributes.position; for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), y = tp.getY(i), a = Math.atan2(y, x); const wob = 1 + 0.035 * Math.sin(a * 5 + 1) + 0.02 * Math.sin(a * 11); tp.setX(i, x * wob); tp.setY(i, y * wob); }
  top.rotation.x = -Math.PI / 2; top.position.y = STUMP_Y + 0.02; top.receiveShadow = true; g.add(top);
  // roots
  const rootGeo = new THREE.CylinderGeometry(1, 2.2, 1, 10, 1); rootGeo.translate(0, 0.5, 0);
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.4, len = 40 + hash(i, 4) * 40, m = new THREE.Mesh(rootGeo, barkMat); m.scale.set(4 + hash(i) * 3, len, 3.4 + hash(i, 2) * 2); m.position.set(Math.cos(a) * 50, 3, Math.sin(a) * 50); m.rotation.set(0, 0, 0); m.lookAt(Math.cos(a) * 200, -20, Math.sin(a) * 200); m.rotateX(Math.PI / 2); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  // trees round the clearing, fading into the haze
  const treeGeo = new THREE.CylinderGeometry(0.82, 1, 1, 14, 1, true); treeGeo.translate(0, 0.5, 0);
  const treeMat = std({ map: texOf(barkCanvas(256, 512, 19, '#2a2018', '#4a3a2a'), true, [2, 3]), roughness: 1 });
  const nT = quality ? 26 : 14;
  for (let i = 0; i < nT; i++) {
    const a = hash(i, 9) * TAU, d = 230 + hash(i, 3) * 620, r = 14 + hash(i, 5) * 26;
    const m = new THREE.Mesh(treeGeo, treeMat); m.scale.set(r, 1100, r); m.position.set(Math.cos(a) * d, -2, Math.sin(a) * d); m.rotation.y = hash(i, 7) * TAU; g.add(m);
  }
  // mushrooms and fallen leaves at the stump's foot
  const capGeo = new THREE.LatheGeometry([[0, 0], [3.2, 0.2], [3.4, 0.9], [2.6, 2.1], [1.2, 2.8], [0, 3]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
  const stemGeo = new THREE.CylinderGeometry(0.8, 1.1, 4, 10); stemGeo.translate(0, 2, 0);
  const capMat = std({ color: theme === 'night' ? 0x8a5a3a : 0xa0522d, roughness: 0.6 }), stemMat = std({ color: 0xe8dcc0, roughness: 0.8 });
  for (let i = 0; i < 6; i++) { const a = 0.9 + i * 0.32 + hash(i, 11) * 0.2, d = 57 + hash(i, 12) * 6, s = 0.6 + hash(i, 13) * 0.8, mg = new THREE.Group(); const st = new THREE.Mesh(stemGeo, stemMat), cp = new THREE.Mesh(capGeo, capMat); cp.position.y = 3.8; mg.add(st, cp); mg.scale.setScalar(s); mg.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); mg.rotation.z = (hash(i, 14) - 0.5) * 0.3; mg.traverse((o) => { o.castShadow = true; }); g.add(mg); }
  const leafT = leafCanvas(), leafGeo = new THREE.PlaneGeometry(4.2, 4.2, 2, 2); { const p = leafGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, (p.getX(i) ** 2) * 0.08); }
  leafGeo.rotateX(-Math.PI / 2);
  const leafMat = std({ map: leafT, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
  const nL = T.snow ? 30 : 140, leaves = new THREE.InstancedMesh(leafGeo, leafMat, nL), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  for (let i = 0; i < nL; i++) {
    const onStump = i < nL * 0.18, a = hash(i, 21) * TAU, d = onStump ? 40 + hash(i, 22) * 11 : 55 + hash(i, 22) ** 0.7 * 110;
    const y = onStump ? STUMP_Y + 0.15 + hash(i, 25) * 0.1 : 0.2 + hash(i, 25) * 0.4;
    e.set((hash(i, 23) - 0.5) * 0.4, hash(i, 24) * TAU, (hash(i, 26) - 0.5) * 0.4); q.setFromEuler(e); const s = 0.8 + hash(i, 27) * 0.9;
    M.compose(new THREE.Vector3(Math.cos(a) * d, y, Math.sin(a) * d), q, new THREE.Vector3(s, s, s)); leaves.setMatrixAt(i, M);
    leaves.setColorAt(i, col.setHex(T.leaves[i % T.leaves.length]).multiplyScalar(0.8 + hash(i, 28) * 0.4));
  }
  leaves.receiveShadow = true; g.add(leaves);
  // a copper hunting horn lying on the stump beside the board
  const horn = new THREE.Group(), hp = [[0.0, 0], [0.42, 0], [0.5, 0.4], [0.32, 1.2], [0.36, 2.0], [0.42, 8], [0.55, 14], [0.75, 18], [1.2, 21], [2.1, 22.6], [2.25, 22.8], [0, 22.8]].map(([r, y]) => new THREE.Vector2(r, y));
  const hb = new THREE.Mesh(new THREE.LatheGeometry(hp, 28), copper()); hb.castShadow = true; horn.add(hb);
  const mp = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 1.6, 16), std({ color: 0xd8d8d8, metalness: 1, roughness: 0.25 })); mp.position.y = 0.8; horn.add(mp);
  horn.rotation.set(Math.PI / 2, 0, -1.9); horn.position.set(BOARD_W / 2 + 6.5, STUMP_Y + 2.2, 4); g.add(horn);
  g.userData.horn = horn;
  // night: a hand lantern on the stump
  if (T.lantern) {
    const lg = new THREE.Group(), dark = std({ color: 0x1c1c1c, metalness: 0.8, roughness: 0.5 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 1, 16), dark); base.position.y = 0.5; lg.add(base);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 6, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd890, emissive: 0xffb050, emissiveIntensity: 2.2, transparent: true, opacity: 0.85 })); glass.position.y = 4; lg.add(glass);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 3.2, 2.4, 16), dark); cap.position.y = 8.2; lg.add(cap);
    const ringH = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.18, 6, 20), dark); ringH.position.y = 10; lg.add(ringH);
    lg.position.set(-BOARD_W / 2 - 8, STUMP_Y, -12); g.add(lg);
    const pl = new THREE.PointLight(0xffb060, 900, 140, 2); pl.position.set(-BOARD_W / 2 - 8, STUMP_Y + 5, -12); pl.castShadow = false; g.add(pl); g.userData.lantern = pl;
  }
  // light shafts slanting through the trees
  const shaftMat = new THREE.MeshBasicMaterial({ map: (() => { const c = cv(64, 256), x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, `rgba(${T.shaft},0)`); gr.addColorStop(0.5, `rgba(${T.shaft},1)`); gr.addColorStop(1, `rgba(${T.shaft},0)`); x.fillStyle = gr; x.fillRect(0, 0, 64, 256); const v = x.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.3, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)'); x.globalCompositeOperation = 'destination-in'; x.fillStyle = v; x.fillRect(0, 0, 64, 256); return texOf(c); })(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: theme === 'night' ? 0.08 : 0.16, side: THREE.DoubleSide, fog: false });
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(60 + i * 14, 700), shaftMat); m.position.set(-260 + i * 120, 260, -360 - i * 40); m.rotation.z = 0.42; m.rotation.y = 0.2; g.add(m); }
  scene.add(g);
  return g;
}

export function buildLights(scene, theme) {
  const T = THEMES[theme] ?? THEMES.autumn;
  const hemi = new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemi); scene.add(hemi);
  const key = new THREE.DirectionalLight(T.key, T.keyI); key.position.set(60, 140, 90); key.target.position.set(0, STUMP_Y, 0);
  key.castShadow = true; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
  const sc = key.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 40; sc.far = 320;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(T.rim, T.rimI); rim.position.set(-80, 60, -140); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.35); fill.position.set(-60, 40, 120); scene.add(fill);
  return { hemi, key, rim, fill };
}
export function applyTheme(scene, lights, theme) {
  const T = THEMES[theme] ?? THEMES.autumn;
  scene.background = new THREE.Color(T.bg); scene.fog = new THREE.Fog(T.fog, T.fogNear, T.fogFar);
  lights.hemi.color.setHex(T.hemiSky); lights.hemi.groundColor.setHex(T.hemiGround); lights.hemi.intensity = T.hemi;
  lights.key.color.setHex(T.key); lights.key.intensity = T.keyI; lights.rim.color.setHex(T.rim); lights.rim.intensity = T.rimI;
  return T;
}

// ------------------------------------------------------------------------------------------ sculpting: signed distances + surface nets
const ellipsoid = (c, r, rot) => { const m = rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)).invert().elements : null; return { t: 'e', c, r, m }; };
const cone = (a, b, r1, r2) => ({ t: 'c', a, b, r1, r2 });
function dist(p, s) {
  if (s.t === 'e') {
    let x = p[0] - s.c[0], y = p[1] - s.c[1], z = p[2] - s.c[2];
    if (s.m) { const e = s.m, X = e[0] * x + e[4] * y + e[8] * z, Y = e[1] * x + e[5] * y + e[9] * z, Z = e[2] * x + e[6] * y + e[10] * z; x = X; y = Y; z = Z; }
    const [a, b, c] = s.r, k0 = Math.hypot(x / a, y / b, z / c), k1 = Math.hypot(x / (a * a), y / (b * b), z / (c * c));
    return k1 < 1e-9 ? -Math.min(a, b, c) : (k0 * (k0 - 1)) / k1;
  }
  // round cone (Inigo Quilez)
  const { a, b, r1, r2 } = s, bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], l2 = bx * bx + by * by + bz * bz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const px = p[0] - a[0], py = p[1] - a[1], pz = p[2] - a[2], y = px * bx + py * by + pz * bz, z = y - l2;
  const xx = px * l2 - bx * y, xy = py * l2 - by * y, xz = pz * l2 - bz * y, x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2, k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
// parts: [{ s: shape, k: blend radius, col: [r,g,b] }]; paint(p, col) may recolour by position (markings)
// Async: yields to the browser every ~6 ms so building the pieces never blocks a frame (the title stays smooth while the 3D loads).
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
async function sculpt(parts, step, paint) {
  let t0 = now(); const breathe = async () => { if (now() - t0 > 6) { await new Promise((r) => setTimeout(r, 0)); t0 = now(); } };
  const f = (p) => { let d = 1e9; for (const q of parts) d = smin(d, dist(p, q.s), q.k ?? 0.3); return d; };
  // bounds from the shapes
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const { s } of parts) {
    const pts = s.t === 'e' ? [[s.c, Math.max(...s.r)]] : [[s.a, s.r1], [s.b, s.r2]];
    for (const [c, r] of pts) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], c[i] - r - 0.4); hi[i] = Math.max(hi[i], c[i] + r + 0.4); }
  }
  const n = lo.map((v, i) => Math.ceil((hi[i] - v) / step) + 1), [nx, ny, nz] = n, V = new Float32Array(nx * ny * nz), I = (i, j, k) => i + nx * (j + ny * k), p = [0, 0, 0];
  for (let k = 0; k < nz; k++) { for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { p[0] = lo[0] + i * step; p[1] = lo[1] + j * step; p[2] = lo[2] + k * step; V[I(i, j, k)] = f(p); } await breathe(); }
  const cid = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1), C = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k), P = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cs = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const v = V[I(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]; cs[c] = v; if (v < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of E) {
      if ((cs[a] < 0) === (cs[b] < 0)) continue;
      const t = cs[a] / (cs[a] - cs[b]);
      sx += (a & 1) + (((b & 1) - (a & 1)) * t); sy += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1)) * t); sz += ((a >> 2) & 1) + ((((b >> 2) & 1) - ((a >> 2) & 1)) * t); cnt++;
    }
    cid[C(i, j, k)] = P.length / 3;
    P.push(lo[0] + (i + sx / cnt) * step, lo[1] + (j + sy / cnt) * step, lo[2] + (k + sz / cnt) * step);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = V[I(i, j, k)] < 0, b = V[I(i + 1, j, k)] < 0; if (a !== b) quad(cid[C(i, j - 1, k - 1)], cid[C(i, j, k - 1)], cid[C(i, j, k)], cid[C(i, j - 1, k)], b); }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const a = V[I(i, j, k)] < 0, b = V[I(i, j + 1, k)] < 0; if (a !== b) quad(cid[C(i - 1, j, k - 1)], cid[C(i - 1, j, k)], cid[C(i, j, k)], cid[C(i, j, k - 1)], b); }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const a = V[I(i, j, k)] < 0, b = V[I(i, j, k + 1)] < 0; if (a !== b) quad(cid[C(i - 1, j - 1, k)], cid[C(i, j - 1, k)], cid[C(i, j, k)], cid[C(i - 1, j, k)], b); }
  // pull each vertex onto the surface, normals from the field's gradient, colours from the nearest part
  const nv = P.length / 3, N = new Float32Array(nv * 3), COL = new Float32Array(nv * 3), h = step * 0.35, q = [0, 0, 0], g = [0, 0, 0];
  const grad = (x, y, z) => { q[0] = x + h; q[1] = y; q[2] = z; const a = f(q); q[0] = x - h; const b = f(q); q[0] = x; q[1] = y + h; const c = f(q); q[1] = y - h; const d = f(q); q[1] = y; q[2] = z + h; const e = f(q); q[2] = z - h; const ff = f(q); g[0] = a - b; g[1] = c - d; g[2] = e - ff; return g; };
  for (let v = 0; v < nv; v++) {
    if ((v & 63) === 0) await breathe();
    let x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    for (let it = 0; it < 2; it++) { q[0] = x; q[1] = y; q[2] = z; const d = f(q); grad(x, y, z); const l2 = (g[0] ** 2 + g[1] ** 2 + g[2] ** 2) / (4 * h * h); if (l2 < 1e-8) break; const s = d / l2 / (2 * h); x -= g[0] * s; y -= g[1] * s; z -= g[2] * s; }
    P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
    grad(x, y, z); const l = Math.hypot(g[0], g[1], g[2]) || 1; N[v * 3] = g[0] / l; N[v * 3 + 1] = g[1] / l; N[v * 3 + 2] = g[2] / l;
    // colour: soft blend of the nearest parts
    q[0] = x; q[1] = y; q[2] = z; let wsum = 0; const c = [0, 0, 0];
    const ds = parts.map((pt) => dist(q, pt.s)), dm = Math.min(...ds);
    parts.forEach((pt, i) => { const w = Math.exp(-(ds[i] - dm) / 0.12); wsum += w; c[0] += pt.col[0] * w; c[1] += pt.col[1] * w; c[2] += pt.col[2] * w; });
    c[0] /= wsum; c[1] /= wsum; c[2] /= wsum;
    if (paint) paint(q, c, N.subarray(v * 3, v * 3 + 3));
    COL[v * 3] = c[0]; COL[v * 3 + 1] = c[1]; COL[v * 3 + 2] = c[2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.BufferAttribute(COL, 3));
  geo.setIndex(idx);
  // fix winding against the field normals (cheap and robust)
  const ix = geo.index.array;
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t], ix[t + 1], ix[t + 2]];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * (N[a * 3] + N[b * 3] + N[c * 3]) + fy * (N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1]) + fz * (N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2]) < 0) { ix[t + 1] = c; ix[t + 2] = b; }
  }
  geo.computeBoundingSphere();
  return geo;
}
const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const mix = (c, t, w) => { c[0] += (t[0] - c[0]) * w; c[1] += (t[1] - c[1]) * w; c[2] += (t[2] - c[2]) * w; };
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The hare, sitting up alert on its plinth, facing +z. ~8 cm to the ear tips. Ears are separate meshes so they can twitch.
export async function hareGeos(set = 'wild', step = 0.13) {
  const snow = set === 'snow';
  const fur = rgb(snow ? 0xf2f0ec : 0x7e5230), dark = rgb(snow ? 0xd8d4cc : 0x4e3018), belly = rgb(snow ? 0xffffff : 0xe8d4b4), white = rgb(0xf8f4ee), nose = rgb(0x6a4a40);
  const body = [
    { s: ellipsoid([0, 2.15, -0.7], [1.4, 1.7, 2.05], [-0.45, 0, 0]), k: 0, col: fur },
    { s: ellipsoid([0.95, 1.55, -1.05], [0.62, 1.15, 1.4], [-0.2, 0, 0]), k: 0.5, col: dark },
    { s: ellipsoid([-0.95, 1.55, -1.05], [0.62, 1.15, 1.4], [-0.2, 0, 0]), k: 0.5, col: dark },
    { s: ellipsoid([0.85, 0.32, 0.25], [0.42, 0.3, 1.45]), k: 0.35, col: fur },
    { s: ellipsoid([-0.85, 0.32, 0.25], [0.42, 0.3, 1.45]), k: 0.35, col: fur },
    { s: ellipsoid([0, 3.05, 0.65], [1.0, 1.25, 0.95], [0.3, 0, 0]), k: 0.7, col: belly },
    { s: cone([0.48, 2.7, 1.25], [0.5, 0.3, 1.65], 0.27, 0.2), k: 0.25, col: fur },
    { s: cone([-0.48, 2.7, 1.25], [-0.5, 0.3, 1.65], 0.27, 0.2), k: 0.25, col: fur },
    { s: ellipsoid([0.5, 0.22, 1.85], [0.26, 0.2, 0.42]), k: 0.2, col: fur },
    { s: ellipsoid([-0.5, 0.22, 1.85], [0.26, 0.2, 0.42]), k: 0.2, col: fur },
    { s: cone([0, 3.4, 0.55], [0, 4.25, 1.15], 0.85, 0.7), k: 0.6, col: fur },
    { s: ellipsoid([0, 4.45, 1.35], [0.82, 0.86, 1.12], [0.35, 0, 0]), k: 0.45, col: fur },
    { s: ellipsoid([0, 4.12, 2.2], [0.5, 0.5, 0.55]), k: 0.45, col: belly },
    { s: ellipsoid([0, 4.32, 2.66], [0.2, 0.16, 0.12]), k: 0.15, col: nose },
    { s: ellipsoid([0, 2.05, -2.75], [0.48, 0.48, 0.38]), k: 0.3, col: snow ? white : white },
  ];
  const paint = (p, c) => {
    // agouti: darker back, lighter flanks
    if (!snow) { const back = sstep(0.2, 1.2, p[1] - 1.8 - (p[2] < 0 ? 0 : p[2] * 0.6)) * sstep(-0.2, 0.8, 1 - Math.abs(p[0]) / 1.3); mix(c, dark, back * 0.75); }
    // the pale eye ring
    if (p[2] < -2.35 && p[1] > 2.2) mix(c, rgb(snow ? 0xe8e4dc : 0x1e1610), sstep(2.2, 2.45, p[1]));   // the scut is black on top
    for (const sx of [-1, 1]) { const d = Math.hypot(p[0] - sx * 0.66, p[1] - 4.62, p[2] - 1.72); if (d < 0.42) mix(c, belly, (1 - d / 0.42) * 0.9); }
  };
  const ear = async (sx) => {
    // an ear in its own frame: base at the origin, rising along +y, flattened in x, cupped forward
    return await sculpt([
      { s: ellipsoid([0, 1.7, 0], [0.24, 1.75, 0.5]), k: 0, col: fur },
      { s: ellipsoid([0, 0.4, 0.05], [0.3, 0.6, 0.45]), k: 0.4, col: fur },
    ], step * 0.8, (p, c, n) => { if (p[1] > 2.55) mix(c, rgb(0x14100c), sstep(2.55, 2.9, p[1])); if (p[2] > 0.1 && n[2] > 0.3) mix(c, rgb(snow ? 0xf0dcd4 : 0xc89a7a), 0.6); void sx; });
  };
  return { body: await sculpt(body, step, paint), ear: await ear(1), eye: new THREE.SphereGeometry(0.22, 14, 10), earPos: [[0.36, 4.95, 1.05], [-0.36, 4.95, 1.05]], eyePos: [[0.66, 4.62, 1.72], [-0.66, 4.62, 1.72]] };
}
// A seated foxhound (white, a black saddle, tan head and ears), facing +z. ~9.5 cm high. Tail separate (it wags).
export async function houndGeos(set = 'wild', step = 0.13) {
  const snow = set === 'snow';
  const white = rgb(0xf3eee4), tan = rgb(snow ? 0xe2c48e : 0xa85a1e), black = rgb(snow ? 0x9a8a78 : 0x1d1712), earC = rgb(snow ? 0xc8a070 : 0x6e3812), nose = rgb(0x111111);
  const parts = [
    { s: cone([0, 2.3, -1.25], [0, 4.4, 0.65], 1.45, 1.25), k: 0, col: white },
    { s: ellipsoid([1.02, 1.65, -1.0], [0.72, 1.3, 1.55], [-0.15, 0, 0]), k: 0.55, col: white },
    { s: ellipsoid([-1.02, 1.65, -1.0], [0.72, 1.3, 1.55], [-0.15, 0, 0]), k: 0.55, col: white },
    { s: ellipsoid([0.9, 0.34, 0.55], [0.46, 0.32, 0.85]), k: 0.35, col: white },
    { s: ellipsoid([-0.9, 0.34, 0.55], [0.46, 0.32, 0.85]), k: 0.35, col: white },
    { s: cone([0.68, 3.9, 1.0], [0.62, 0.42, 1.55], 0.52, 0.3), k: 0.35, col: white },
    { s: cone([-0.68, 3.9, 1.0], [-0.62, 0.42, 1.55], 0.52, 0.3), k: 0.35, col: white },
    { s: ellipsoid([0.62, 0.3, 1.82], [0.4, 0.3, 0.55]), k: 0.25, col: white },
    { s: ellipsoid([-0.62, 0.3, 1.82], [0.4, 0.3, 0.55]), k: 0.25, col: white },
    { s: ellipsoid([0, 4.2, 1.15], [1.0, 1.05, 0.85], [0.4, 0, 0]), k: 0.6, col: white },
    { s: cone([0, 4.6, 0.5], [0, 6.05, 1.1], 0.95, 0.68), k: 0.55, col: tan },
    { s: ellipsoid([0, 6.4, 1.2], [0.86, 0.8, 1.02]), k: 0.45, col: tan },
    { s: cone([0, 6.3, 1.85], [0, 6.0, 3.05], 0.55, 0.42), k: 0.4, col: white },
    { s: ellipsoid([0, 6.1, 3.3], [0.27, 0.22, 0.2]), k: 0.15, col: nose },
    { s: ellipsoid([1.0, 5.55, 1.15], [0.22, 1.25, 0.7], [0.15, 0, 0.22]), k: 0.08, col: earC },
    { s: ellipsoid([-1.0, 5.55, 1.15], [0.22, 1.25, 0.7], [0.15, 0, -0.22]), k: 0.08, col: earC },
  ];
  const paint = (p, c) => {
    // the black saddle over the back
    const sd = Math.hypot(p[0] / 1.7, (p[1] - 3.5) / 1.5, (p[2] + 0.8) / 1.7); if (p[1] > 2.3 && sd < 1.2) mix(c, black, sstep(1.2, 1.08, sd));
    // a white blaze up the forehead, tan cheeks
    if (p[1] > 5.6 && p[2] > 1.4 && Math.abs(p[0]) < 0.22 + (p[2] - 1.4) * 0.12) mix(c, white, 0.85);
    if (p[2] > 2.3 && p[1] < 5.9) mix(c, white, 0.6);
  };
  const tail = await sculpt([
    { s: cone([0, 0, 0], [0, 1.2, -0.75], 0.32, 0.27), k: 0, col: white },
    { s: cone([0, 1.2, -0.75], [0, 2.6, -0.6], 0.27, 0.16), k: 0.2, col: white },
  ], step * 0.8, (p, c) => { if (p[1] > 2.1) mix(c, white, 1); else mix(c, black, 0.25 * sstep(0.8, 0.2, p[1])); });
  return { body: await sculpt(parts, step, paint), tail, tailPos: [0, 2.0, -2.45], eye: new THREE.SphereGeometry(0.15, 12, 8), eyePos: [[0.47, 6.55, 1.86], [-0.47, 6.55, 1.86]] };
}
// the turned plinth every piece stands on (walnut for the hounds, pale ash for the hare), with a brass band
export function plinthGeo() {
  return new THREE.LatheGeometry([[0, 0], [BASE_R - 0.25, 0], [BASE_R, 0.22], [BASE_R, 0.55], [BASE_R - 0.18, 0.72], [BASE_R - 0.28, 0.82], [BASE_R - 0.4, 0.9], [0, 0.9]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
}
export const PLINTH_H = 0.9;
export function animalMaterial() { return new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.5, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffe8c8) }); }
export function eyeMaterial() { return new THREE.MeshPhysicalMaterial({ color: 0x120a06, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 }); }
// One piece: plinth + body (+ ears / tail on pivots). Returns a group with userData { ears, tail, body }.
export function makePiece(kind, G, mats) {
  const root = new THREE.Group(), lift = new THREE.Group(); root.add(lift);
  const pl = new THREE.Mesh(mats.plinthGeo, kind === 'H' ? mats.ash : mats.walnut); pl.castShadow = true; pl.receiveShadow = true; lift.add(pl);
  const band = new THREE.Mesh(mats.bandGeo, mats.brass); band.position.y = 0.38; lift.add(band);
  const body = new THREE.Group(); body.position.y = PLINTH_H - 0.12; lift.add(body);
  const sc = kind === 'H' ? 1.45 : 1.42; body.scale.setScalar(sc);
  const bm = new THREE.Mesh(G.body, mats.animal); bm.castShadow = true; bm.receiveShadow = true; body.add(bm);
  for (const e of G.eyePos) { const m = new THREE.Mesh(G.eye, mats.eye); m.position.set(...e); body.add(m); }
  const ud = { body, lift, ears: [], tail: null };
  if (kind === 'H') for (let i = 0; i < 2; i++) { const piv = new THREE.Group(); piv.position.set(...G.earPos[i]); piv.rotation.set(-0.38, 0, (i ? 1 : -1) * 0.2); const m = new THREE.Mesh(G.ear, mats.animal); m.castShadow = true; piv.add(m); body.add(piv); ud.ears.push(piv); }
  else { const piv = new THREE.Group(); piv.position.set(...G.tailPos); const m = new THREE.Mesh(G.tail, mats.animal); m.castShadow = true; piv.add(m); body.add(piv); ud.tail = piv; }
  root.userData = ud;
  return root;
}
export function pieceMats() {
  const walnut = woodMat('#3a2010', 'rgba(120,70,30,0.8)', 31, 0.38), ash = woodMat('#c9a674', 'rgba(140,100,60,0.7)', 32, 0.42);
  const band = new THREE.CylinderGeometry(BASE_R + 0.03, BASE_R + 0.03, 0.18, 40, 1, true);
  return { walnut, ash, brass: brass(), animal: animalMaterial(), eye: eyeMaterial(), plinthGeo: plinthGeo(), bandGeo: band };
}
