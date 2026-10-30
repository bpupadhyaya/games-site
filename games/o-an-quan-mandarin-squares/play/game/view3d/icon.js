// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a polished jade mandarin stone with its gold band
// sitting in the carved half-round square of the clay board, small pebbles heaped against it, one pebble in the air over the next
// square, low warm light from the left and a dark clay field fading to black. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { CELLS, slotPos } from '../src/art.js';
import { TOP, BASE_TOP, PEB_H, wx, wz, buildBoard, pieceKit, stoneColors, radialTex } from './world.js';

const q = new URLSearchParams(location.search), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d), size = Number(q.get('size') || 2048);
const theme = q.get('theme') || 'lacquer';
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x070302, 26, 70);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.22;
const sun = new THREE.DirectionalLight(0xffc790, num('sun', 2.8)); sun.position.set(-26, 22, 30); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 5, far: 120 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0x9fb6ff, num('rim', 0.9)); rim.position.set(20, 14, -34); scene.add(rim);
scene.add(new THREE.HemisphereLight(0x6a3a24, 0x120604, 0.25));
const board = buildBoard(theme, 2048); scene.add(board);
const kit = pieceKit(theme), cols = stoneColors(theme);
const put = (geo, mat, x, y, z, sx = 1, sy = 1, ry = 0, tilt = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sx); m.rotation.set(tilt, ry, 0, 'YXZ'); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
const peb = (cell, k, hasQ, lift = 0, h = 0, seed = k + cell * 53) => {
  const [lx, ly] = slotPos(cell, k, hasQ), mat = kit.mat.clone(); mat.color.copy(cols[seed % cols.length]).multiplyScalar(0.85);
  put(kit.geos[seed % 3], mat, wx(lx), BASE_TOP + PEB_H * 1.1 + h + lift, wz(ly), 1.2, 1, seed * 1.7);
};
// the mandarin stone in the left half-round square, with a ring of pebbles
const c0 = CELLS[0], qx = wx(c0.cx), qz = wz(c0.cy);
const qs = num('qs', 1.25);
const grp = new THREE.Group(); grp.position.set(qx, BASE_TOP + 0.02, qz + num('qz', 1.0)); grp.scale.setScalar(qs);
for (const [g, m] of [[kit.qBody, kit.qMat], [kit.ringG, kit.gold], [kit.knobG, kit.gold], [kit.band, kit.gold]]) { const mm = new THREE.Mesh(g, m); mm.castShadow = true; mm.receiveShadow = true; grp.add(mm); }
scene.add(grp);
for (const [dx, dz, sd] of [[-0.4, -4.6, 12]]) { const mat = kit.mat.clone(); mat.color.copy(cols[sd % cols.length]).multiplyScalar(0.85); put(kit.geos[sd % 3], mat, qx + dx, BASE_TOP + PEB_H * 1.1, qz + dz + 1.0, 1.15, 1, sd); }
for (let k = 0; k < 6; k++) peb(1, k, false, 0, k > 3 ? 0.6 : k > 1 ? 0.3 : 0);
peb(1, 9, false, 4.6, 0, 77);
const glow = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: radialTex('255,190,110', 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
glow.rotation.x = -Math.PI / 2; glow.position.set(qx + 1, TOP + 0.4, qz); glow.material.opacity = 0.25; scene.add(glow);
const cam = new THREE.PerspectiveCamera(num('fov', 30), 1, 0.5, 400);
cam.position.set(num('cx', qx + 1.6), num('cy', TOP + 9), num('cz', qz + 17)); cam.lookAt(new THREE.Vector3(num('tx', qx + 1.0), num('ty', BASE_TOP + 1.8), num('tz', qz + 1.0)));
renderIcon({ scene, camera: cam, size, renderer, background: '#070302', bloom: 0.14, vignette: 0.8, exposure: num('exp', 0.8) });
