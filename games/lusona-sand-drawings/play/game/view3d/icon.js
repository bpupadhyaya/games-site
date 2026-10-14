// Offline icon render (developer tool): the SAME sand bed, pebbles, hand and courtyard the game uses, framed close at golden hour.
// icon.html?size=2048[&cam=...] -> window.__icon() returns a PNG dataURL.
import { THREE } from '../vendor3d/index.js';
import { createSand, CELL } from './sand.js';
import { createWorld } from './world.js';
import { createFinger } from './hand.js';
import { findSingle, seeded } from '../src/mirror.js';
import { LOOKS } from '../src/ui.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE; document.body.appendChild(canvas);
canvas.style.width = '1024px'; canvas.style.height = '1024px';
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xd9b080, 9, 40);
const camera = new THREE.PerspectiveCamera(Number(q.get('fov') || 32), 1, 0.05, 300);
const world = createWorld({ quality: 'high', camera }); scene.add(world.group);
const sand = createSand({ quality: 'ultra' }); scene.add(sand.group);
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45; pm.dispose();
const hemi = new THREE.HemisphereLight(0xcfd8ff, 0x6a3c20, 0.5);
const sun = new THREE.DirectionalLight(0xff9a3a, 2.6); sun.position.set(-3.2, 1.05, 1.5); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -1.8, right: 1.8, top: 1.8, bottom: -1.8, near: 0.3, far: 14 }); sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.008; sun.shadow.radius = 2;
const rim = new THREE.DirectionalLight(0xffe0b0, 2.2); rim.position.set(3.5, 2.5, -4);
const fill = new THREE.DirectionalLight(0x9fb4ff, 0.5); fill.position.set(3, 2.5, 4);
scene.add(hemi, sun, sun.target, rim, fill);
const cfg = findSingle(4, 4, seeded(5), 'turn') || new Array(16).fill(0);
const look = LOOKS.sand;
const run = async () => {
  const pos = (q.get('pos') || '-0.32,0.5,0.72').split(',').map(Number), at = (q.get('at') || '0.02,0.03,0.0').split(',').map(Number);
  camera.position.set(...pos); camera.lookAt(...at); camera.updateMatrixWorld();
  const finger = await createFinger({ scene, renderer }); finger.approach = new THREE.Vector3(0.75, 0, 0.55);
  const tip = { drawing: true, x: Number(q.get('tx') || 0.0), z: Number(q.get('tz') || 0.05) };
  for (let i = 0; i < 40; i++) { sand.sync({ W: 4, H: 4, cfg, locked: null, struts: false, hintCell: -1, focus: -1, win: true, lookObj: look, calm: true, snap: true }, 0.05, 1.0 + i * 0.05); finger.update(tip, 0.05, i * 0.05, camera); world.update(0.05, camera, false); }
  await world.ready.catch(() => {});
  for (let i = 0; i < 20; i++) { world.update(0.05, camera, false); finger.update(tip, 0.05, i, camera); sand.sync({ W: 4, H: 4, cfg, locked: null, struts: false, hintCell: -1, focus: -1, win: true, lookObj: look, calm: true, snap: true }, 0.05, 2 + i * 0.05); }
  renderer.render(scene, camera);
  // finish: warm bloom + vignette composited in 2D
  const out = document.createElement('canvas'); out.width = out.height = SIZE; const x = out.getContext('2d');
  x.drawImage(canvas, 0, 0);
  x.save(); x.globalCompositeOperation = 'lighter'; x.filter = `blur(${SIZE * 0.012}px)`; x.globalAlpha = 0.22; x.drawImage(canvas, 0, 0); x.restore();
  const v = x.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.3, SIZE / 2, SIZE / 2, SIZE * 0.78); v.addColorStop(0, 'rgba(30,12,2,0)'); v.addColorStop(1, 'rgba(30,12,2,0.62)'); x.fillStyle = v; x.fillRect(0, 0, SIZE, SIZE);
  window.__icon = () => out.toDataURL('image/png');
  document.title = 'ready';
};
run().catch((e) => { console.error(e); document.title = 'error'; });
