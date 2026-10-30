// Shagai 3D world: everything is procedural (lit geometry + small canvas textures), no bitmaps. One unit = 10 canonical 2D units
// (the trail is laid out exactly in the 2D game's canonical coordinates, x -> x*U, y -> z*U), so the sim, the stations and the tap
// mapping stay the ones the 2D game already uses.
import * as THREE from '../vendor3d/three.js';
import { PATH_LEN, STEP, pathPoint, stationXY } from '../src/layout.js';
import { FINISH, TILES } from '../src/rules.js';
import { RIDER, RIDER_LIGHT, RIDER_DARK, FACE_COL, drawFaceIcon, drawTileIcon, mix, lcg } from '../src/art.js';

export const U = 0.1;
export const BONE_L = 9.4, BONE_S = 5.0;     // ankle bone: 9.4 long, 5.0 square section (units)
export const TABLE = { rugW: 62, rugD: 28.2 };
const TAU = Math.PI * 2;
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, rep, aniso = 4) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } t.anisotropy = aniso; return t; };
export function radialTex(rgb, a = 1) {
  const [c, x] = cv(128, 128), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------- the ankle bone
// a box with every vertex pushed out to a rounded shape (true bevels), pinched at the waist, ends flared: a shagai
export function boneGeometry(L = BONE_L, S = BONE_S, r = 1.25) {
  const g = new THREE.BoxGeometry(L, S, S, 18, 8, 8), p = g.attributes.position, n = g.attributes.normal;
  const hx = L / 2 - r, hs = S / 2 - r, v = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    q.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hs, Math.min(hs, v.y)), Math.max(-hs, Math.min(hs, v.z)));
    const d = v.clone().sub(q); if (d.lengthSq() > 1e-9) d.normalize(); else d.set(0, 1, 0);
    v.copy(q).addScaledVector(d, r);
    const t = v.x / (L / 2), w = 1 - 0.14 * (1 - t * t) * (1 - t * t) + 0.04 * Math.abs(t);   // waist
    v.y *= w; v.z *= w * 0.98;
    p.setXYZ(i, v.x, v.y, v.z); n.setXYZ(i, d.x, d.y * 1, d.z);
  }
  g.computeBoundingSphere(); return g;
}
// side materials: +x,-x ends, then the four long sides in the order [+y, +z, -y, -z] (see presenter: roll k brings side k on top)
export function faceTexture(face) {
  const [c, x] = cv(512, 288), r = lcg(41 + face * 7);
  const g = x.createLinearGradient(0, 0, 0, 288); g.addColorStop(0, '#fbf3dc'); g.addColorStop(0.5, '#f0e4c4'); g.addColorStop(1, '#d8c79c');
  x.fillStyle = g; x.fillRect(0, 0, 512, 288);
  for (let k = 0; k < 700; k++) { x.fillStyle = r() < 0.5 ? 'rgba(130,95,45,0.13)' : 'rgba(255,255,255,0.28)'; x.fillRect(r() * 512, r() * 288, 1.5 + r() * 2, 1.5 + r() * 2); }
  for (let k = 0; k < 14; k++) { x.strokeStyle = 'rgba(140,105,55,0.12)'; x.lineWidth = 1; x.beginPath(); const y0 = r() * 288; x.moveTo(0, y0); x.bezierCurveTo(170, y0 + (r() - 0.5) * 30, 340, y0 + (r() - 0.5) * 30, 512, y0 + (r() - 0.5) * 20); x.stroke(); }
  x.beginPath(); x.ellipse(256, 144, 196, 112, 0, 0, TAU); x.fillStyle = mix(FACE_COL[face], '#ffffff', 0.72); x.fill();
  x.strokeStyle = mix(FACE_COL[face], '#ffffff', 0.3); x.lineWidth = 6; x.stroke();
  x.beginPath(); x.ellipse(256, 144, 180, 98, 0, 0, TAU); x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 2; x.stroke();
  x.save(); x.scale(1.25, 1); drawFaceIcon(x, face, 256 / 1.25, 148, 92, FACE_COL[face], true); x.restore();
  return tex(c, null, 8);
}
export function boneMaterials() {
  const end = new THREE.MeshPhysicalMaterial({ color: 0xefe2bf, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const side = [0, 1, 2, 3].map((f) => new THREE.MeshPhysicalMaterial({ map: faceTexture(f), roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.35 }));
  return { end, side };
}
export const boneMatList = (m, f) => [m.end, m.end, m.side[f], m.side[(f + 1) % 4], m.side[f], m.side[(f + 3) % 4]];   // roll-sides (ordering fixed up in the presenter by face)
// all four sides on one bone: [+x, -x, +y, -y, +z, -z] = [end, end, A, C, B, D] where roll k shows side k = [+y, +z, -y, -z]
export const boneMats4 = (m, faces) => [m.end, m.end, m.side[faces[0]], m.side[faces[2]], m.side[faces[1]], m.side[faces[3]]];

// ---------------------------------------------------------------- a rider's bone-horse: ivory bone on a coloured felt coaster
export function makeToken(i, geo, mats) {
  const g = new THREE.Group(), felt = new THREE.MeshStandardMaterial({ color: RIDER[i], roughness: 0.92 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.0, 0.3, 40), new THREE.MeshStandardMaterial({ color: RIDER_DARK[i], roughness: 0.85 })); rim.position.y = 0.15; rim.castShadow = rim.receiveShadow = true; g.add(rim);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 0.32, 40), new THREE.MeshStandardMaterial({ color: RIDER_LIGHT[i], roughness: 0.9 })); top.position.y = 0.2; top.castShadow = true; g.add(top);
  const body = new THREE.Group(); body.position.y = 2.1; g.add(body);
  const bone = new THREE.Mesh(geo, mats); bone.scale.setScalar(0.66); bone.castShadow = bone.receiveShadow = true; bone.rotation.x = 0; body.add(bone);
  const sad = new THREE.Mesh(boneGeometry(2.3, 3.5, 0.95), felt); sad.scale.set(1, 1, 1); sad.position.y = 0.02; sad.castShadow = true; body.add(sad);
  const stripe = new THREE.MeshStandardMaterial({ color: 0xfff6dc, roughness: 0.7 });
  for (const dx of [-0.95, 0.95]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.56, 3.56), stripe); s.position.set(dx, 0.02, 0); body.add(s); }
  g.userData.body = body; g.userData.top = top;
  return g;
}

// ---------------------------------------------------------------- textures
function grassTexture() {
  const [c, x] = cv(512, 512), r = lcg(5);
  const g = x.createLinearGradient(0, 0, 512, 512); g.addColorStop(0, '#9ab85a'); g.addColorStop(0.5, '#a7bd62'); g.addColorStop(1, '#93ae52'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 26; k++) { const px = r() * 512, py = r() * 512, rad = 40 + r() * 80, pg = x.createRadialGradient(px, py, 2, px, py, rad); const f = r() < 0.5; pg.addColorStop(0, f ? 'rgba(110,160,60,0.30)' : 'rgba(215,190,110,0.26)'); pg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = pg; for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { x.save(); x.translate(ox, oy); x.fillRect(px - rad, py - rad, rad * 2, rad * 2); x.restore(); } }
  for (let k = 0; k < 7000; k++) { const px = r() * 512, py = r() * 512, l = 3 + r() * 7, a = -1.57 + (r() - 0.5) * 1.1; x.strokeStyle = r() < 0.5 ? 'rgba(55,90,25,0.32)' : 'rgba(240,230,150,0.28)'; x.lineWidth = 1 + r(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  return tex(c, [18, 18], 8);
}
function sandTexture() {
  const [c, x] = cv(256, 256), r = lcg(9);
  x.fillStyle = '#d6bb82'; x.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 2600; k++) { x.fillStyle = r() < 0.5 ? 'rgba(120,85,40,0.25)' : 'rgba(255,245,210,0.32)'; x.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
  for (let k = 0; k < 40; k++) { x.fillStyle = 'rgba(95,68,34,0.3)'; x.beginPath(); x.ellipse(r() * 256, r() * 256, 1.5 + r() * 2.5, 1 + r() * 1.5, r() * 3, 0, TAU); x.fill(); }
  return tex(c, null, 8);
}
function woodTexture() {
  const [c, x] = cv(1024, 512), r = lcg(13);
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#3a2315'); g.addColorStop(0.5, '#4a2d1a'); g.addColorStop(1, '#33200f'); x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  for (let k = 0; k < 150; k++) { const y0 = r() * 512; x.strokeStyle = r() < 0.5 ? 'rgba(15,6,0,0.35)' : 'rgba(150,100,55,0.16)'; x.lineWidth = 0.6 + r() * 2; x.beginPath(); x.moveTo(0, y0); x.bezierCurveTo(300, y0 + (r() - 0.5) * 18, 700, y0 + (r() - 0.5) * 18, 1024, y0 + (r() - 0.5) * 10); x.stroke(); }
  for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, k * 85 + 84, 1024, 2); }
  return tex(c, null, 8);
}
export function rugTexture() {
  const W = 1536, H = Math.round(W * TABLE.rugD / TABLE.rugW), [c, x] = cv(W, H), r = lcg(23);
  x.fillStyle = '#7d1f1f'; x.fillRect(0, 0, W, H);
  const b = H * 0.13;                                           // border band
  const g = x.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.55); g.addColorStop(0, '#2d6fb8'); g.addColorStop(1, '#163c78');
  x.fillStyle = g; x.fillRect(b, b, W - 2 * b, H - 2 * b);
  for (let k = 0; k < 9000; k++) { const px = r() * W, py = r() * H, a = r() * TAU, l = 3 + r() * 6; x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,10,40,0.14)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  // ram-horn scroll row in the border (cream on madder red), drawn as paired spirals
  const spiral = (cx, cy, rad, dir) => { x.beginPath(); for (let t = 0; t <= 1; t += 0.03) { const a = t * 5.2 * dir, rr = rad * (1 - t * 0.9); const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; t ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); };
  x.strokeStyle = '#f1d79a'; x.lineWidth = b * 0.09; x.lineCap = 'round';
  const step = b * 1.35;
  for (let px = b + step * 0.7; px < W - b; px += step) { spiral(px, b * 0.5, b * 0.3, 1); spiral(px + step * 0.45, b * 0.5, b * 0.3, -1); spiral(px, H - b * 0.5, b * 0.3, -1); spiral(px + step * 0.45, H - b * 0.5, b * 0.3, 1); }
  for (let py = b + step * 0.7; py < H - b; py += step) { spiral(b * 0.5, py, b * 0.3, 1); spiral(W - b * 0.5, py, b * 0.3, -1); }
  x.strokeStyle = 'rgba(241,215,154,0.95)'; x.lineWidth = 5; x.setLineDash([22, 14]); x.strokeRect(b + 14, b + 14, W - 2 * b - 28, H - 2 * b - 28); x.setLineDash([]);
  x.strokeStyle = '#f1d79a'; x.lineWidth = 6; x.strokeRect(b, b, W - 2 * b, H - 2 * b); x.strokeStyle = '#f1d79a'; x.lineWidth = 5; x.strokeRect(5, 5, W - 10, H - 10);
  // a soft dark medallion hint under the bones
  const m = x.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, H * 0.42); m.addColorStop(0, 'rgba(8,24,60,0.35)'); m.addColorStop(1, 'rgba(8,24,60,0)'); x.fillStyle = m; x.fillRect(b, b, W - 2 * b, H - 2 * b);
  return tex(c, null, 8);
}
function tileTexture(kind) { const [c, x] = cv(128, 128); x.translate(64, 64); drawTileIcon(x, kind, 0, 0, 2.9); return tex(c); }
function checkerTexture() { const [c, x] = cv(128, 64); for (let a = 0; a < 8; a++) for (let b = 0; b < 4; b++) { x.fillStyle = (a + b) % 2 ? '#1c1410' : '#fff8e6'; x.fillRect(a * 16, b * 16, 16, 16); } return tex(c); }

// ---------------------------------------------------------------- steppe, trail, gers
export function buildLights(scene, { shadow = true } = {}) {
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x7a6a3a, 0.85));
  const sun = new THREE.DirectionalLight(0xffe2b0, 3.3); sun.position.set(-34, 62, 8 + 36); sun.castShadow = shadow;
  sun.shadow.camera.left = -52; sun.shadow.camera.right = 52; sun.shadow.camera.top = 52; sun.shadow.camera.bottom = -52; sun.shadow.camera.near = 5; sun.shadow.camera.far = 220; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target); return { sun };
}
function ger(s = 1, door = 0x9d2f2a) {
  const g = new THREE.Group(), wall = new THREE.MeshStandardMaterial({ color: 0xf2ead2, roughness: 0.9 }), roof = new THREE.MeshStandardMaterial({ color: 0xfbf6e6, roughness: 0.85 }), red = new THREE.MeshStandardMaterial({ color: door, roughness: 0.7 });
  const w = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.5, 2.7, 28), wall); w.position.y = 1.35; g.add(w);
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0, 5.1, 2.5, 28), roof); r.position.y = 2.7 + 1.25; g.add(r);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.3, 28), red); band.position.y = 2.7; g.add(band);
  const d = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.7, 1.2), red); d.position.set(4.45, 0.85, 0); g.add(d);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.4, 12), red); cap.position.y = 5.3; g.add(cap);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.scale.setScalar(s); return g;
}
// a painted far horizon standing behind the trail: sky, sun, clouds, three ridges and a few felt tents (like the 2D steppe)
function backdropTexture() {
  const W = 2048, H = 640, [c, x] = cv(W, H), r = lcg(11), hz = 470;
  const g = x.createLinearGradient(0, 0, 0, hz + 40); g.addColorStop(0, '#0d3a80'); g.addColorStop(0.45, '#2f7fc8'); g.addColorStop(0.85, '#9cc7e6'); g.addColorStop(1, '#f6d9a4'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const sun = x.createRadialGradient(1500, 330, 6, 1500, 330, 300); sun.addColorStop(0, 'rgba(255,248,214,0.95)'); sun.addColorStop(0.2, 'rgba(255,224,150,0.55)'); sun.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = sun; x.fillRect(0, 0, W, H);
  x.fillStyle = '#fff6d8'; x.beginPath(); x.arc(1500, 330, 30, 0, TAU); x.fill();
  for (let k = 0; k < 20; k++) { const cx = r() * W, cy = 90 + r() * 200, w = 160 + r() * 240; x.fillStyle = `rgba(255,255,255,${0.12 + r() * 0.14})`; for (let q = 0; q < 4; q++) { x.beginPath(); x.ellipse(cx + (q - 1.5) * w * 0.24, cy + Math.sin(q * 2) * 8, w * 0.26, 16 + r() * 8, 0, 0, TAU); x.fill(); } }
  const ridge = (base, amp, col, seed, step) => { const q = lcg(seed); x.fillStyle = col; x.beginPath(); x.moveTo(0, H); let y = base; for (let px = 0; px <= W + step; px += step) { y = base - amp * (0.25 + 0.75 * q()); x.lineTo(px, y); } x.lineTo(W, H); x.closePath(); x.fill(); };
  ridge(hz - 90, 90, '#6d8fb6', 5, 120); ridge(hz - 40, 56, '#4f7b6a', 9, 90); ridge(hz + 6, 30, '#6f8d4a', 21, 60);
  const tent = (px, py, s) => { x.save(); x.translate(px, py); x.scale(s, s); x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.ellipse(2, 2, 44, 6, 0, 0, TAU); x.fill(); x.fillStyle = '#f2ead2'; x.fillRect(-34, -22, 68, 22); x.fillStyle = '#fbf6e6'; x.beginPath(); x.moveTo(-38, -21); x.quadraticCurveTo(0, -64, 38, -21); x.closePath(); x.fill(); x.fillStyle = '#9d2f2a'; x.fillRect(-36, -21, 72, 3); x.fillRect(-7, -17, 14, 17); x.restore(); };
  [[260, 1], [350, 0.75], [880, 0.9], [1180, 0.7], [1700, 1], [1840, 0.8]].forEach(([px, s]) => tent(px, hz + 14, s * 1.4));
  x.globalCompositeOperation = 'destination-out'; const f = x.createLinearGradient(0, hz - 60, 0, H); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = f; x.fillRect(0, hz - 60, W, H); x.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildSteppe(scene, tierTex = 1) {
  const gt = grassTexture();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(420, 131), new THREE.MeshBasicMaterial({ map: backdropTexture(), fog: false, toneMapped: false, transparent: true })); back.position.set(36, 42, 12); scene.add(back);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ map: gt, color: 0xd5dcb4, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(36, -0.02, 60); ground.receiveShadow = true; scene.add(ground);
  const hills = new THREE.Group(), hr = lcg(31);
  const hillMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, fog: true });
  [[-90, -150, 70, 0x6d8fb6], [20, -190, 90, 0x5b82ab], [150, -160, 80, 0x6d8fb6], [250, -120, 60, 0x4f7b6a], [-190, -90, 60, 0x4f7b6a], [60, -80, 50, 0x6f8d4a]].forEach(([x, z, r, c]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12), hillMat(c)); m.scale.set(1.9, 0.24 + hr() * 0.1, 1); m.position.set(x, -2, z); hills.add(m); });
  scene.add(hills);
  const gers = new THREE.Group();
  // tufts and flowers around the trail (instanced, tiny)
  const tuft = new THREE.InstancedMesh(new THREE.CylinderGeometry(0, 0.1, 0.9, 4), new THREE.MeshStandardMaterial({ color: 0x78993f, roughness: 1 }), Math.round(1300 * tierTex)), m4 = new THREE.Matrix4(), col = new THREE.Color();
  let n = 0; const rr = lcg(77);
  for (; n < tuft.count; n++) { const x = -14 + rr() * 100, z = 4 + rr() * 100; if (insideRoad(x, z, 4.2)) { n--; tuft.count--; continue; } m4.compose(new THREE.Vector3(x, 0.35, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rr() - 0.5) * 0.4, rr() * 6, (rr() - 0.5) * 0.4)), new THREE.Vector3(1, 0.7 + rr(), 1)); tuft.setMatrixAt(n, m4); tuft.setColorAt(n, col.setHSL(0.2 + rr() * 0.07, 0.4, 0.3 + rr() * 0.2)); }
  tuft.castShadow = false; scene.add(tuft);
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), Math.round(260 * tierTex)); const cols = [0xfffbe8, 0xffe27a, 0xd7a8ff, 0xffb0b0];
  for (let k = 0; k < fl.count; k++) { let x, z; do { x = -10 + rr() * 90; z = 6 + rr() * 98; } while (insideRoad(x, z, 4.2)); m4.compose(new THREE.Vector3(x, 0.22, z), new THREE.Quaternion(), new THREE.Vector3(1, 0.8, 1)); fl.setMatrixAt(k, m4); fl.setColorAt(k, col.setHex(cols[k % 4])); }
  scene.add(fl);
  return { ground, gers };
}
const roadPts = []; for (let s = 0; s <= PATH_LEN; s += 20) { const p = pathPoint(s); roadPts.push([p.x * U, p.y * U]); }
function insideRoad(x, z, w) { for (const [a, b] of roadPts) if (Math.hypot(a - x, b - z) < w) return true; return false; }

export function buildTrail() {
  const grp = new THREE.Group();
  // the raised felt-and-sand road: one ribbon with a rounded cross-section
  const samples = []; for (let s = -STEP * 0.6; s <= PATH_LEN + STEP * 0.6; s += 3) samples.push(s);
  const ribbon = (prof, mat) => {
    const pos = [], uv = [], idx = [], w = prof[prof.length - 1][0] * 2;
    samples.forEach((s) => { const p = pathPoint(s), nx = -Math.sin(p.ang), nz = Math.cos(p.ang); prof.forEach(([o, h]) => { pos.push(p.x * U + nx * o, h, p.y * U + nz * o); uv.push(s * U / 9, (o + w / 2) / w); }); });
    const P = prof.length; for (let si = 0; si < samples.length - 1; si++) for (let pi = 0; pi < P - 1; pi++) { const a = si * P + pi, b = a + 1, c = a + P, d = c + 1; idx.push(a, c, b, b, c, d); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rg.setIndex(idx); rg.computeVertexNormals();
    const m = new THREE.Mesh(rg, mat); m.receiveShadow = true; m.castShadow = true; grp.add(m);
  };
  ribbon([[-3.9, 0], [-3.7, 0.22], [-3.3, 0.3], [3.3, 0.3], [3.7, 0.22], [3.9, 0]], new THREE.MeshStandardMaterial({ color: 0x6a4524, roughness: 0.95, side: THREE.DoubleSide }));   // the dark felt bank
  const st = sandTexture(); st.wrapS = st.wrapT = THREE.RepeatWrapping;
  ribbon([[-3.15, 0.28], [-2.95, 0.4], [-2.6, 0.46], [2.6, 0.46], [2.95, 0.4], [3.15, 0.28]], new THREE.MeshStandardMaterial({ map: st, color: 0xe9c690, roughness: 0.95, side: THREE.DoubleSide }));
  // station stamps (ring + dimple) and the four special felt patches
  const stampMat = new THREE.MeshStandardMaterial({ color: 0xc2a26a, roughness: 1 }), ringMat = new THREE.MeshStandardMaterial({ color: 0x8a6a36, roughness: 0.9 });
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1.5, 0.09, 6, 28), ringMat, FINISH), dimples = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.45, 1.45, 0.05, 28), stampMat, FINISH), m4 = new THREE.Matrix4(); let n = 0;
  for (let i = 1; i < FINISH; i++) { if (TILES[i]) continue; const p = stationXY(i); m4.makeRotationX(Math.PI / 2); m4.setPosition(p.x * U, 0.45, p.y * U); rings.setMatrixAt(n, m4); m4.makeTranslation(p.x * U, 0.42, p.y * U); dimples.setMatrixAt(n, m4); n++; }
  rings.count = dimples.count = n; rings.receiveShadow = dimples.receiveShadow = true; grp.add(rings, dimples);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xf4e4b8, roughness: 0.5, metalness: 0.2 });
  for (const [i, kind] of Object.entries(TILES)) {
    const p = stationXY(Number(i)), t = tileTexture(kind), side = new THREE.MeshStandardMaterial({ color: { wind: 0x2f86d6, burrow: 0x5a3f26, stream: 0x1f6fb0, camp: 0xd79a3a }[kind], roughness: 0.9 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.2, 40), [side, new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }), side]); m.position.set(p.x * U, 0.52, p.y * U); m.rotation.y = -Math.PI / 2; m.castShadow = m.receiveShadow = true; grp.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.1, 8, 40), rimMat); ring.rotation.x = Math.PI / 2; ring.position.set(p.x * U, 0.62, p.y * U); grp.add(ring);
    if (kind === 'burrow') { const hole = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0x120a05 })); hole.rotation.x = -Math.PI / 2; hole.position.set(p.x * U, 0.63, p.y * U + 0.3); grp.add(hole); }
  }
  // start line: a white post with red bands on each side of the trail, a painted line
  const s0 = stationXY(0), white = new THREE.MeshStandardMaterial({ color: 0xfff8e6, roughness: 0.6 }), red = new THREE.MeshStandardMaterial({ color: 0x9d2f2a, roughness: 0.6 });
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 6.0), white); line.position.set(s0.x * U, 0.45, s0.y * U); grp.add(line);
  for (const dz of [-3.5, 3.5]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.2, 12), white); post.position.set(s0.x * U, 1.6, s0.y * U + dz); post.castShadow = true; grp.add(post); for (let b = 0; b < 3; b++) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.45, 12), red); band.position.set(s0.x * U, 0.9 + b * 0.8, s0.y * U + dz); grp.add(band); } }
  // finish: two carved posts and a chequered banner across the trail, a gold pennant
  const f = stationXY(FINISH), wood = new THREE.MeshStandardMaterial({ color: 0x5b3a1c, roughness: 0.7 }), chk = new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.6 });
  for (const dz of [-3.6, 3.6]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 5.2, 14), wood); post.position.set(f.x * U, 2.6, f.y * U + dz); post.castShadow = true; grp.add(post); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe8a823, roughness: 0.35, metalness: 0.6 })); knob.position.set(f.x * U, 5.3, f.y * U + dz); knob.castShadow = true; grp.add(knob); }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 7.2), chk); banner.position.set(f.x * U, 4.4, f.y * U); banner.castShadow = true; grp.add(banner);
  const flag = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.55, 1.8, 3), new THREE.MeshStandardMaterial({ color: 0xe8a823, roughness: 0.6 })); flag.rotation.z = -Math.PI / 2; flag.position.set(f.x * U - 1.2, 5.4, f.y * U + 3.6); grp.add(flag);
  const fl2 = flag.clone(); fl2.material = new THREE.MeshStandardMaterial({ color: 0xd9432f, roughness: 0.6 }); fl2.position.z = f.y * U - 3.6; grp.add(fl2);
  return grp;
}

// ---------------------------------------------------------------- the table: a felt rug on dark wood
export function buildTable() {
  const g = new THREE.Group();
  const wt = woodTexture(); wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
  const wood = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.55, metalness: 0.05 })); wood.rotation.x = -Math.PI / 2; wood.position.y = -0.3; wood.receiveShadow = true; g.add(wood);
  const rug = new THREE.Mesh(new THREE.BoxGeometry(TABLE.rugW, 0.5, TABLE.rugD), [new THREE.MeshStandardMaterial({ color: 0x7d1f1f, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0x7d1f1f, roughness: 1 }), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0x3a0f0f }), new THREE.MeshStandardMaterial({ color: 0x7d1f1f, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0x7d1f1f, roughness: 1 })]);
  rug.position.y = -0.05; rug.receiveShadow = true; rug.castShadow = true; g.add(rug);
  return g;
}
