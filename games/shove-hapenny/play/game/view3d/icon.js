// Offline app-icon render (developer tool): the same board and pennies as the game, one hero coin sliding with dust, lamp light.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { setCanvasFactory, bakedBoard } from '../src/art.js';
import { buildBoard, buildTable, makeCoin, SH, T, wx, wz, FH } from './models.js';
setCanvasFactory((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const gl = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x120a05); scene.fog = new THREE.Fog(0x120a05, 500, 1100);
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; scene.environmentIntensity = 0.7;
scene.add(new THREE.HemisphereLight(0xffe2bc, 0x2c1c12, 0.7));
const key = new THREE.DirectionalLight(0xffd6a0, 3.0); key.color.set(0xffd6a0); key.position.set(-120, 260, 160); key.castShadow = true;
Object.assign(key.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 20, far: 900 }); key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.5; key.shadow.radius = 4;
const rim = new THREE.DirectionalLight(0xff8a40, 2.2); rim.position.set(220, 120, -200);
scene.add(key, key.target, rim, buildTable());
const root = new THREE.Group(); root.rotation.y = -Math.PI / 2 + 0.35; scene.add(root);
root.add(buildBoard(bakedBoard()));
// hero: a copper penny mid-slide across the brass beds, a silver one tucked in a bed, chalk dust behind
const hero = makeCoin(0); hero.scale.setScalar(1.7); hero.position.set(wx(100), SH + T * 0.85 + 2, wz(150)); hero.rotation.y = 0.5; root.add(hero);
const other = makeCoin(1); other.scale.setScalar(1.7); other.position.set(wx(135), SH + T * 0.85, wz(95)); other.rotation.y = 2.2; root.add(other);
const dm = new THREE.MeshBasicMaterial({ color: 0xf4efe2, transparent: true, opacity: 0.55 });
for (let i = 0; i < 40; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.9 + (i % 5) * 0.25, 8, 6), dm); s.position.set(wx(100 + Math.sin(i * 2.1) * 9), SH + 1.5 + (i % 7) * 1.1, wz(168 + i * 1.9)); root.add(s); }
scene.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
const cam = new THREE.PerspectiveCamera(30, 1, 10, 3000);
cam.position.set(Number(q.get('cx') || 60), Number(q.get('cy') || 60), Number(q.get('cz') || 120)); cam.lookAt(Number(q.get('lx') || -10), SH, Number(q.get('lz') || -20));
B.renderIcon({ scene, camera: cam, size: SIZE, renderer, bloom: 0.25, vignette: 0.45, exposure: 1.15, background: '#120a05' });
