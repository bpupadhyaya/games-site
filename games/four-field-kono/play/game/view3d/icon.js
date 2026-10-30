// Offline app-icon render (developer tool): web/icon.html?size=2048 draws the SAME models the game uses: a Jade stone mid-jump over an
// Ember stone on the hanji board, a blurred hanok backdrop of lit paper windows and silk lanterns, glow and vignette.
import * as THREE from '../vendor3d/three.js';
import { buildBoard, makeStone, TOP } from './models.js';
const SIZE = Number(new URLSearchParams(location.search).get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; document.body.appendChild(out); out.style.width = '1024px';
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.55;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; scene.environmentIntensity = 0.45; pm.dispose();
const key = new THREE.DirectionalLight(0xffdcae, 1.5); key.position.set(-4, 8, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
const rim = new THREE.DirectionalLight(0xffa860, 2.4); rim.position.set(5, 4, -6);
scene.add(new THREE.HemisphereLight(0xffe6c8, 0x2a1a10, 0.3), key, key.target, rim);
const board = buildBoard(4, 'hanji', false, 1); scene.add(board);
const P = (r, c) => ({ x: c - 2, z: r - 2 });
const put = (side, r, c, o = {}) => { const s = makeStone(side), p = P(r, c); s.position.set(p.x, TOP + (o.y || 0), p.z); s.rotation.y = o.yaw || 0; s.rotation.x = o.tx || 0; s.scale.setScalar(o.s || 1); scene.add(s); return s; };
put(1, 4, 0); put(1, 4, 1); put(1, 4, 3); put(1, 4, 4); put(2, 0, 0); put(2, 0, 1, { yaw: 1 }); put(2, 0, 3); put(2, 0, 4, { yaw: 2 });
put(2, 2, 2, { yaw: 0.4, s: 1.05 }); put(2, 3, 4, { yaw: 1.4 });
put(1, 4, 2); const hero = put(1, 2, 2, { y: 1.3, tx: 0.25, yaw: 0.6, s: 1.1 }); hero.position.z = P(2, 2).z + 0.5;
scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 100);
cam.position.set(0.5, 4.3, 5.7); cam.lookAt(0.1, 0.5, 0.2);
// backdrop: warm hanok interior, painted then blurred for depth of field
const bd = document.createElement('canvas'); bd.width = bd.height = SIZE; const b = bd.getContext('2d');
const g = b.createLinearGradient(0, 0, 0, SIZE); g.addColorStop(0, '#120804'); g.addColorStop(0.6, '#2c1608'); g.addColorStop(1, '#120804'); b.fillStyle = g; b.fillRect(0, 0, SIZE, SIZE);
for (const [x, w] of [[0.05, 0.28], [0.36, 0.28], [0.67, 0.28]]) { const gg = b.createLinearGradient(0, 0, 0, SIZE * 0.5); gg.addColorStop(0, '#a8742c'); gg.addColorStop(1, '#5a3010'); b.fillStyle = gg; b.fillRect(x * SIZE, SIZE * 0.04, w * SIZE, SIZE * 0.42); b.strokeStyle = '#2a1608'; b.lineWidth = SIZE * 0.008; for (let i = 0; i <= 4; i++) { b.beginPath(); b.moveTo((x + (w * i) / 4) * SIZE, SIZE * 0.04); b.lineTo((x + (w * i) / 4) * SIZE, SIZE * 0.46); b.stroke(); } for (let j = 0; j <= 6; j++) { b.beginPath(); b.moveTo(x * SIZE, SIZE * (0.04 + 0.07 * j)); b.lineTo((x + w) * SIZE, SIZE * (0.04 + 0.07 * j)); b.stroke(); } }
for (const [x, y, r, c] of [[0.18, 0.2, 0.09, '#ff5a30'], [0.82, 0.22, 0.1, '#3a74ff'], [0.5, 0.12, 0.07, '#ff5a30']]) { const rg = b.createRadialGradient(x * SIZE, y * SIZE, 0, x * SIZE, y * SIZE, r * SIZE * 1.8); rg.addColorStop(0, c); rg.addColorStop(0.45, c + 'aa'); rg.addColorStop(1, '#0000'); b.fillStyle = rg; b.beginPath(); b.arc(x * SIZE, y * SIZE, r * SIZE * 1.8, 0, 7); b.fill(); }
renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
const sub = document.createElement('canvas'); sub.width = sub.height = SIZE; sub.getContext('2d').drawImage(gl, 0, 0);
ctx.fillStyle = '#1a0e06'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.018}px)`; ctx.drawImage(bd, -SIZE * 0.03, -SIZE * 0.03, SIZE * 1.06, SIZE * 1.06); ctx.filter = 'none';
ctx.drawImage(sub, 0, 0);
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.014}px)`; ctx.globalAlpha = 0.25; ctx.drawImage(sub, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE * 0.5, SIZE * 0.36, SIZE * 0.1, SIZE * 0.5, SIZE * 0.5, SIZE * 0.72); v.addColorStop(0, 'rgba(8,3,1,0)'); v.addColorStop(0.55, 'rgba(8,3,1,0.55)'); v.addColorStop(1, 'rgba(8,3,1,0.9)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
window.__icon = () => out.toDataURL('image/png'); window.__iconJpeg = () => out.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
