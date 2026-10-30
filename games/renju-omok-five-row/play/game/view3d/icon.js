// Offline app-icon render (developer tool, not part of the game): open icon.html?size=2048 in headless Chrome with real WebGL; the result
// is window.__icon (PNG data URL, 1024). Same world as the game (world.js): a low look across the goban at five black slate stones in a
// diagonal row, the fifth still dropping into place, white shell stones around, warm lamp, soft depth falloff.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { TOP, STONE_R, cross, makeMaterials, stoneGeometry, buildBoard, radialTex } from './world.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1116); scene.fog = new THREE.Fog(0x0b1116, num('fn', 24), num('ff', 70));
const mats = makeMaterials('kaya', 'slate');
const table = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mats.cloth); table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);
const board = buildBoard(15, 'kaya', false, mats, 2048); board.traverse((o) => { if (o.isMesh) o.receiveShadow = true; }); scene.add(board);
const lamp = new THREE.SpotLight(0xffd2a0, num('lamp', 3.8), 0, 0.42, 0.9, 0); lamp.position.set(num('lx', -10), num('ly', 60), num('lz', 50)); lamp.target.position.set(0, TOP, 0);
lamp.castShadow = true; lamp.shadow.mapSize.set(4096, 4096); lamp.shadow.bias = -0.0002; lamp.shadow.normalBias = 0.02; lamp.shadow.radius = 5; Object.assign(lamp.shadow.camera, { near: 40, far: 200 });
const rim = new THREE.DirectionalLight(0x9fb8ff, num('rim', 1.4)); rim.position.set(num('rx', -70), num('ry', 20), num('rz', -40));
scene.add(lamp, lamp.target, rim, new THREE.HemisphereLight(0xe8d8c0, 0x20160e, 0.3));
const geo = stoneGeometry(STONE_R, 0.92, 64);
const put = (black, idx, lift = 0, tilt = 0) => { const c = cross(15, idx), m = new THREE.Mesh(geo, black ? mats.black : mats.white); m.position.set(c.x, TOP + lift, c.z); m.rotation.set(-tilt, idx * 1.7, tilt * 0.4); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
const halo = radialTex('255,214,120', 0.9), quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
const five = [12 * 15 + 7, 11 * 15 + 8, 10 * 15 + 9, 9 * 15 + 10, 8 * 15 + 11];
five.forEach((i, k) => {
  const last = k === 4; put(true, i, last ? num('lift', 2.2) : 0, last ? 0.22 : 0);
  const c = cross(15, i), h = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: last ? 0.35 : 0.5 }));
  h.position.set(c.x, TOP + 0.02, c.z); h.scale.set(STONE_R * 4.4, 1, STONE_R * 4.4); scene.add(h);
});
for (const i of [12 * 15 + 8, 10 * 15 + 10, 11 * 15 + 6, 9 * 15 + 8, 6 * 15 + 9, 8 * 15 + 9]) put(false, i);
// the dropping stone's shadow on the wood
const c5 = cross(15, five[4]), blob = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.8), transparent: true, depthWrite: false, opacity: 0.5 })); blob.position.set(c5.x + 0.6, TOP + 0.02, c5.z + 0.6); blob.scale.set(3.6, 1, 3.6); scene.add(blob);
const mid = cross(15, five[2]);
const cam = new THREE.PerspectiveCamera(num('fov', 30), 1, 1, 500);
const yaw = num('yaw', -30) * Math.PI / 180, tilt = num('tilt', 26) * Math.PI / 180, dist = num('dist', 25);
const tgt = new THREE.Vector3(mid.x + num('tx', 0), TOP + 0.6, mid.z + num('tz', 0));
cam.position.set(tgt.x + Math.sin(yaw) * Math.cos(tilt) * dist, tgt.y + Math.sin(tilt) * dist, tgt.z + Math.cos(yaw) * Math.cos(tilt) * dist); cam.lookAt(tgt);
const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; scene.environmentIntensity = num('env', 0.12);
await document.fonts.ready;
B.renderIcon({ scene, camera: cam, size: SIZE, background: '#0b1116', bloom: num('bloom', 0.12), vignette: num('vig', 0.55), renderer: r, exposure: num('exp', 0.9) });
