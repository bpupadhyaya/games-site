// Offline app-icon render (developer tool): web/icon.html?size=2048 draws the SAME models the game uses: a vermilion printed disc caught
// mid-flip over an indigo one on the woven rush mat, dust ring from the slam, blurred lantern-lit veranda behind, glow and vignette.
import * as THREE from '../vendor3d/three.js';
import { makeDisc, buildTray, TH } from './models.js';
const SIZE = Number(new URLSearchParams(location.search).get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; document.body.appendChild(out); out.style.width = '1024px';
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.62;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; scene.environmentIntensity = 0.25; pm.dispose();
const key = new THREE.DirectionalLight(0xffdcae, 1.3); key.position.set(-3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
const rim = new THREE.DirectionalLight(0xffa860, 2.2); rim.position.set(4, 3, -5);
scene.add(new THREE.HemisphereLight(0xffe6c8, 0x2a1a10, 0.4), key, key.target, rim);
const tray = buildTray(1); scene.add(tray);
const qp = new URLSearchParams(location.search);
const A = makeDisc(14, 1); A.position.set(0.7, 0, 0.55); A.rotation.y = 0.5; A.scale.setScalar(1.7); scene.add(A);          // indigo cherry blossom resting on the mat
const Bd = makeDisc(0, 0);                                                                          // vermilion rising sun, flipping over in the air
Bd.position.set(-0.55, 1.15, 0.05); Bd.rotation.set(0.85, 0.35, 0.12); Bd.scale.setScalar(1.9); scene.add(Bd);
const C = makeDisc(20, 0); C.position.set(-2.4, 0, 1.5); C.rotation.y = -0.4; C.scale.setScalar(1.5); scene.add(C);
scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
// dust ring where the slam landed
const dust = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.15, 64), new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
dust.visible = false;
const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 100);
cam.position.set(0.0, 2.7, 4.2); cam.lookAt(-0.35, 0.65, 0.3);
// backdrop: dusk veranda with lantern bokeh and a lit shoji, painted then blurred for depth of field
const bd = document.createElement('canvas'); bd.width = bd.height = SIZE; const b = bd.getContext('2d');
const g = b.createLinearGradient(0, 0, 0, SIZE); g.addColorStop(0, '#1c1840'); g.addColorStop(0.5, '#6a3a40'); g.addColorStop(1, '#2a160c'); b.fillStyle = g; b.fillRect(0, 0, SIZE, SIZE);
b.fillStyle = '#ffd98c'; b.fillRect(SIZE * 0.08, SIZE * 0.04, SIZE * 0.84, SIZE * 0.3);
b.strokeStyle = '#2a1608'; b.lineWidth = SIZE * 0.01; for (let i = 0; i <= 8; i++) { b.beginPath(); b.moveTo(SIZE * (0.08 + 0.105 * i), SIZE * 0.04); b.lineTo(SIZE * (0.08 + 0.105 * i), SIZE * 0.34); b.stroke(); } for (let j = 0; j <= 4; j++) { b.beginPath(); b.moveTo(SIZE * 0.08, SIZE * (0.04 + 0.075 * j)); b.lineTo(SIZE * 0.92, SIZE * (0.04 + 0.075 * j)); b.stroke(); }
for (const [x, y, r, c] of [[0.16, 0.2, 0.1, '#ff5a30'], [0.84, 0.22, 0.11, '#ff7a30'], [0.5, 0.1, 0.08, '#ff5a30'], [0.3, 0.36, 0.06, '#ffb060'], [0.72, 0.38, 0.07, '#ffb060']]) { const rg = b.createRadialGradient(x * SIZE, y * SIZE, 0, x * SIZE, y * SIZE, r * SIZE * 1.8); rg.addColorStop(0, c); rg.addColorStop(0.45, c + 'aa'); rg.addColorStop(1, '#0000'); b.fillStyle = rg; b.beginPath(); b.arc(x * SIZE, y * SIZE, r * SIZE * 1.8, 0, 7); b.fill(); }
renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
const sub = document.createElement('canvas'); sub.width = sub.height = SIZE; sub.getContext('2d').drawImage(gl, 0, 0);
// the tray fills the lower part of the frame: paint it straight, only the far backdrop is blurred behind the transparent area
ctx.fillStyle = '#1a0e06'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.02}px)`; ctx.drawImage(bd, -SIZE * 0.03, -SIZE * 0.03, SIZE * 1.06, SIZE * 1.06); ctx.filter = 'none';
ctx.drawImage(sub, 0, 0);
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.014}px)`; ctx.globalAlpha = 0.22; ctx.drawImage(sub, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.4, SIZE / 2, SIZE / 2, SIZE * 0.78); v.addColorStop(0, 'rgba(10,4,2,0)'); v.addColorStop(1, 'rgba(10,4,2,0.5)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
window.__icon = () => out.toDataURL('image/png'); window.__iconJpeg = () => out.toDataURL('image/jpeg', 0.93);
document.title = 'ready'; void TH; void qp;
