// Offline app-icon render (developer tool, not part of the game): open icon.html?size=2048 in headless Chrome with real WebGL; the result
// is window.__icon() (PNG data URL, 1024). Same world as the game (world.js): a low look along a rank of the kaya shogi-ban at the
// sandwich - two dark koma closing on two pale ones - the closing piece just landing with a warm flash, paper-lamp light, tatami behind.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { TOP, SX, makeMaterials, buildBoard, buildFloor, komaGeometry, komaMaterials, sqPos, radialTex } from './world.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const faces = q.get('faces') || 'jp';
await document.fonts.load('700 40px "Cormorant Garamond"');
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x120c08); scene.fog = new THREE.Fog(0x120c08, num('fn', 30), num('ff', 95));
const mats = makeMaterials('kaya');
scene.add(buildFloor(mats));
const board = buildBoard('kaya', mats, 2048); board.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; } }); scene.add(board);
const lamp = new THREE.SpotLight(0xffd6a6, num('lamp', 5), 0, num('cone', 0.42), 0.8, 0); lamp.position.set(num('lx', -22), num('ly', 60), num('lz', 40)); lamp.target.position.set(num('ltx', 0), TOP, num('ltz', 0));
lamp.castShadow = true; lamp.shadow.mapSize.set(4096, 4096); lamp.shadow.bias = -0.0003; lamp.shadow.normalBias = 0.02; lamp.shadow.radius = 5; Object.assign(lamp.shadow.camera, { near: 30, far: 160 });
const rim = new THREE.DirectionalLight(0xa9c2ff, num('rim', 1.6)); rim.position.set(num('rx', 60), num('ry', 25), num('rz', -50));
scene.add(lamp, lamp.target, rim, new THREE.HemisphereLight(0xf2e2c4, 0x2a1c10, 0.25));
const geo = komaGeometry(0.075);
const blob = radialTex('0,0,0', 0.9), glow = radialTex('255,214,120', 0.95), quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
const put = (side, i, o = {}) => {
  const c = sqPos(i), m = new THREE.Mesh(geo, komaMaterials(side, q.get('style') || 'classic', faces, false));
  m.position.set(c.x + (o.dx || 0), TOP + (o.lift || 0), c.z); m.rotation.set(o.leanX || 0, (side === 2 ? Math.PI : 0) + (o.yaw || 0), o.leanZ || 0, 'YXZ');
  m.castShadow = m.receiveShadow = true; scene.add(m);
  const b = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, opacity: 0.5 })); b.position.set(c.x + 0.3, TOP + 0.01, c.z + 0.3); b.scale.set(3, 1, 3.3); scene.add(b);
  return m;
};
const row = 4;
put(1, row * 9 + 2, { yaw: 0.03 }); put(2, row * 9 + 3, { yaw: -0.04 }); put(2, row * 9 + 4, { yaw: 0.05 });
put(1, row * 9 + 5, { lift: num('lift', 0.7), leanZ: 0.12, dx: num('mdx', 0.5) });
for (const [i, s] of [[1 * 9 + 6, 2], [7 * 9 + 1, 1], [0 * 9 + 2, 2]].slice(0, num('extras', 3))) put(s, i);
const g = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: num('glow', 0.75) }));
const gc = sqPos(row * 9 + 4); g.position.set(gc.x - SX * 0.5, TOP + 0.02, gc.z); g.scale.set(SX * 4.6, 1, SX * 2.6); scene.add(g);
const mid = sqPos(row * 9 + 3.5 | 0);
const cam = new THREE.PerspectiveCamera(num('fov', 30), 1, 1, 600);
const yaw = num('yaw', 28) * Math.PI / 180, tilt = num('tilt', 24) * Math.PI / 180, dist = num('dist', 22);
const tgt = new THREE.Vector3(mid.x + num('tx', 1.2), TOP + num('ty', 0.4), mid.z + num('tz', 0));
cam.position.set(tgt.x + Math.sin(yaw) * Math.cos(tilt) * dist, tgt.y + Math.sin(tilt) * dist, tgt.z + Math.cos(yaw) * Math.cos(tilt) * dist); cam.lookAt(tgt);
const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; scene.environmentIntensity = num('env', 0.18);
B.renderIcon({ scene, camera: cam, size: SIZE, background: '#120c08', bloom: num('bloom', 0.14), vignette: num('vig', 0.5), renderer: r, exposure: num('exp', 1.0) });
