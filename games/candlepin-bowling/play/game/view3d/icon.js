// Offline app-icon render (developer tool): the SAME alley, pins and ball the game uses, from a low camera behind the rolling ball.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { buildAlley, makePin, makeBall, PIN_CENTRE } from './models.js';
import { glowTexture } from './models.js';
import { PIN_XY, LANE } from '../src/sim.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
const gl = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; scene.environmentIntensity = 0.5; pm.dispose();
const al = buildAlley(q.get('alley') || 'harbor'); scene.add(al.root);
scene.fog = new THREE.Fog(0x070b18, 3.5, 11);
scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x1a1830, 0.3));
const key = new THREE.DirectionalLight(0xffe2b8, 1.25); key.position.set(-2.5, 3.2, -14.5); key.target.position.set(0, 0, -18.3);
key.castShadow = true; Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 14 }); key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x6fe8ff, 1.3); rim.position.set(3, 2, -22); rim.target.position.set(0, 0.2, -18.3); scene.add(rim, rim.target);
const warm = new THREE.PointLight(0xff8a30, 2.2, 7, 1.6); warm.position.set(0.9, 0.6, -17.0); scene.add(warm);
for (const [x, y] of PIN_XY) { const p = makePin(); p.root.position.set(x, PIN_CENTRE, -y); scene.add(p.root); p.shadow.position.set(x, 0.003, -y); scene.add(p.shadow); }
const ball = makeBall(); ball.root.position.set(-0.12, LANE.ballR, -16.95); ball.mesh.rotation.set(0.5, 0.4, 0.2); scene.add(ball.root, ball.shadow); ball.shadow.position.set(-0.12, 0.003, -16.95);
// a dark curtain wall with neon tubes and halos behind the rack (the pinsetter hood is too bright for an icon)
const wall = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ color: 0x0a0f22 })); wall.position.set(0, 1.2, -19.3); scene.add(wall);
for (const [c, y, h] of [[0x37e0d4, 0.62, 0.0], [0xff4fa3, 0.42, 0.0]]) {
  const t = new THREE.Mesh(new THREE.BoxGeometry(5, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); t.position.set(0, y, -19.25); scene.add(t);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.9), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,255,255,1)'), color: c, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); g.position.set(0, y, -19.22); scene.add(g);
  void h;
}
if (q.has('dbg')) al.root.traverse((o) => { if (o.isMesh && o.geometry.parameters && o.geometry.parameters.width >= 5 && o.geometry.parameters.width < 20) console.log('big', o.geometry.type, JSON.stringify(o.geometry.parameters), o.position.toArray()); });
scene.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 30), 1, 0.1, 80);
cam.position.set(Number(q.get('cx') || -0.02), Number(q.get('cy') || 0.14), -16.45); cam.lookAt(Number(q.get('lx') || 0.0), 0.2, -18.3);
B.renderIcon({ scene, camera: cam, size: SIZE, renderer, background: '#07101f', bloom: 0.14, vignette: 0.5, exposure: 0.8 });
