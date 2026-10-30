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
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; scene.environmentIntensity = 0.22;
scene.add(new THREE.HemisphereLight(0xffe2bc, 0x2c1c12, 0.22));
const key = new THREE.DirectionalLight(0xffc27a, 1.6); key.color.set(0xffd6a0); key.position.set(-60, 120, 60); key.castShadow = true;
Object.assign(key.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 20, far: 900 }); key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.5; key.shadow.radius = 4;
const rim = new THREE.DirectionalLight(0xff8a40, 2.2); rim.position.set(220, 120, -200);
scene.add(key, key.target, rim, buildTable());
// pub-lamp glow: a warm point light and a soft additive halo over the hero coin
const lamp = new THREE.PointLight(0xffb458, 9000, 0, 2); lamp.position.set(-8, 70, -40); scene.add(lamp);
{ const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,200,120,0.5)'); g.addColorStop(0.35, 'rgba(255,150,60,0.28)'); g.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.scale.set(150, 150, 1); sp.position.set(-30, 60, -90); scene.add(sp); }
const root = new THREE.Group(); root.rotation.y = -Math.PI / 2 + 0.35; scene.add(root);
root.add(buildBoard(bakedBoard()));
// hero: a copper penny mid-slide across the brass beds, a silver one tucked in a bed, chalk dust behind
const hero = makeCoin(0); hero.scale.setScalar(2.5); hero.position.set(wx(100), SH + T * 0.85 + 2, wz(150)); hero.rotation.y = 0.5; root.add(hero);
const other = makeCoin(1); other.scale.setScalar(2.0); other.position.set(wx(135), SH + T * 0.85, wz(95)); other.rotation.y = 2.2; root.add(other);
const dm = new THREE.MeshBasicMaterial({ color: 0xf4efe2, transparent: true, opacity: 0.28 });
for (let i = 0; i < 26; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.5 + (i % 5) * 0.16, 8, 6), dm); s.position.set(wx(100 + Math.sin(i * 2.1) * 9), SH + 1.5 + (i % 7) * 1.1, wz(168 + i * 1.9)); root.add(s); }
scene.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
const cam = new THREE.PerspectiveCamera(30, 1, 10, 3000);
cam.position.set(Number(q.get('cx') || 54), Number(q.get('cy') || 52), Number(q.get('cz') || 100)); cam.lookAt(Number(q.get('lx') || -2), SH, Number(q.get('lz') || -20));
B.renderIcon({ scene, camera: cam, size: SIZE, renderer, bloom: 0.3, vignette: 0.75, exposure: 1.0, background: '#120a05' });
