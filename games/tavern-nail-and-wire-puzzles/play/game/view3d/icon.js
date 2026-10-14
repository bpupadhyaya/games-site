// Offline app-icon render (developer tool, not shipped logic): draws the SAME models the game uses, with the real hand, into one 3D scene,
// composites a blurred copy for depth of field, glow and a vignette, and exposes window.__icon for tools/render-icon.mjs.
import * as THREE from '../vendor3d/three.js';
import { buildBar, buildPiece } from './models.js';
import { createHands } from './hands.js';
import { LEVELS, replay } from '../src/levels.js';
import { ROT } from '../src/wire.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; document.body.appendChild(out);
out.style.width = '1024px'; out.style.height = '1024px';
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = Number(q.get('exp') || 0.95);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x0a0502, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b0603, 30, 90);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.7; pm.dispose();
const bar = buildBar(); scene.add(bar);
const key = new THREE.DirectionalLight(0xffd29a, 2.4); key.position.set(-9, 14, 9); key.castShadow = true;
Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 60 }); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
const rim = new THREE.DirectionalLight(0xffb866, 2.2); rim.position.set(8, 5, -10);
scene.add(new THREE.HemisphereLight(0xffd9a8, 0x1a0e06, 0.4), key, key.target, rim);

// the puzzle: a level mid-solution, frame in iron, loose pieces in brass and copper
const lv = LEVELS[Math.min(LEVELS.length - 1, Number(q.get('lv') || 9))], rp = replay(lv);
const st = rp.states[Math.min(rp.n, Math.max(0, Math.floor(rp.n * Number(q.get('t') || 0.45)))) ];
const group = new THREE.Group(); scene.add(group);
const add = (def, pose, metal, kind) => { const g = buildPiece(def, ROT[pose.o], kind, metal, 0); g.position.set(pose.x, pose.y, -pose.z); group.add(g); };
add(lv.puzzle.frame, { o: 0, x: 0, y: 0, z: 0 }, 'iron', 'frame');
lv.puzzle.loose.forEach((l, i) => add(l.shape, st[i], ['brass', 'copper', 'steel'][i % 3], l.kind));
scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
// bar floor under the frame
const fb = (() => { let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const path of lv.puzzle.frame.paths) for (const p of path.pts) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[a]); hi[a] = Math.max(hi[a], p[a]); } return { lo, hi }; })();
const c = [(fb.lo[0] + fb.hi[0]) / 2, (fb.lo[1] + fb.hi[1]) / 2, (fb.lo[2] + fb.hi[2]) / 2];
const matY = fb.lo[1] - 2.7;
bar.position.set(c[0], matY, -c[2]);
bar.userData.dots.visible = false;
const { cs, tank } = bar.userData;
cs.position.set(Number(q.get('cx') || 6.5), 0, -Number(q.get('cz') || 9)); tank.position.set(-9, 0, -12); tank.rotation.y = 0.7; tank.visible = !q.has('notank');
for (const o of bar.userData.props.children) if (o.userData.slot && /^[NC]/.test(o.userData.slot)) o.visible = false;
cs.userData.flame.scale.set(1.5, 2.4, 1);

// camera: three-quarter, slightly above, centred on the puzzle
const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 30), 1, 1, 400);
const yaw = Number(q.get('yaw') || 0.55), pitch = Number(q.get('pitch') || 0.42), dist = Number(q.get('dist') || 25);
const target = new THREE.Vector3(c[0] + Number(q.get('tx') || 0), c[1] + Number(q.get('ty') || 0.4), -c[2]);
cam.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
cam.lookAt(target);
key.target.position.copy(target);

// the hand pinches the ring's top from behind
const handScene = new THREE.Scene();
handScene.environment = scene.environment; handScene.environmentIntensity = 0.6;
const hKey = new THREE.DirectionalLight(0xffd29a, 2.4); hKey.position.copy(key.position);
handScene.add(hKey, hKey.target, new THREE.HemisphereLight(0xffd9a8, 0x2a1608, 0.9));
const hands = await createHands(handScene);
// grip point: the first loose piece's top
const gp = new THREE.Vector3(st[0].x, st[0].y + Number(q.get('gy') || 1.2), -st[0].z);
const camFlat = cam.position.clone();
const noHand = q.has('nohand');
for (let i = 0; i < 12; i++) hands.update(gp, camFlat, !noHand, 0.1, 0);
hands.hand.human.update(0);

function render() {
  renderer.setViewport(0, 0, SIZE, SIZE);
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  if (!noHand) { renderer.autoClear = false; renderer.clippingPlanes = hands.planes; renderer.render(handScene, cam); renderer.clippingPlanes = []; renderer.autoClear = true; }
  const c2 = document.createElement('canvas'); c2.width = c2.height = SIZE; c2.getContext('2d').drawImage(gl, 0, 0); return c2;
}
const sharp = render();

// composite: sharp centre over a blurred copy (shallow depth of field), warm glow, bloom, vignette
ctx.fillStyle = '#0a0502'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.014}px)`; ctx.drawImage(sharp, -SIZE * 0.03, -SIZE * 0.03, SIZE * 1.06, SIZE * 1.06); ctx.filter = 'none';
const m = document.createElement('canvas'); m.width = m.height = SIZE; const mx = m.getContext('2d');
mx.drawImage(sharp, 0, 0);
mx.globalCompositeOperation = 'destination-in';
const mg = mx.createRadialGradient(SIZE * 0.5, SIZE * 0.42, SIZE * 0.3, SIZE * 0.5, SIZE * 0.45, SIZE * 0.62);
mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(0.62, 'rgba(0,0,0,0.92)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
mx.fillStyle = mg; mx.fillRect(0, 0, SIZE, SIZE);
ctx.drawImage(m, 0, 0);
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.016}px)`; ctx.globalAlpha = 0.34; ctx.drawImage(sharp, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.36, SIZE / 2, SIZE / 2, SIZE * 0.78);
v.addColorStop(0, 'rgba(6,2,0,0)'); v.addColorStop(1, 'rgba(6,2,0,0.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const tg = ctx.createLinearGradient(0, 0, 0, SIZE * 0.34); tg.addColorStop(0, 'rgba(6,2,0,0.85)'); tg.addColorStop(1, 'rgba(6,2,0,0)'); ctx.fillStyle = tg; ctx.fillRect(0, 0, SIZE, SIZE * 0.34);
window.__icon = () => out.toDataURL('image/png');
document.title = 'ready';
