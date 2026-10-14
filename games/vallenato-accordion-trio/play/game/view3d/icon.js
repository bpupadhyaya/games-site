// Offline app-icon render (developer tool, not shipped in play): web/icon.html?size=2048 builds a hero scene from the SAME models the
// game uses (lacquer accordion with pleated bellows, the caja in front, a guacharaca), a warm patio with bokeh string lights, and
// renders it through board3d.renderIcon (bloom + vignette), exposing window.__icon.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { makeAccordion, makeCaja, makeGuacharaca, mats } from './models.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
const TAU = Math.PI * 2;
const gl = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
B.createEnvironment(renderer, scene, { intensity: 0.35 });
scene.add(new THREE.HemisphereLight(0xffe2c0, 0x0a2a2e, 0.3));
const key = new THREE.DirectionalLight(0xffe0b8, 2.6); key.position.set(-3, 5, 6); key.castShadow = true;
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 }); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004;
const rim = new THREE.DirectionalLight(0x7fe3c2, 2.6); rim.position.set(4, 3, -4);
const warm = new THREE.PointLight(0xff9a50, 14, 12, 1.4); warm.position.set(2.5, 1.6, 2.5);
scene.add(key, rim, warm);
const M = mats();

// floor: dark wood
const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.75, 0.2, 64), new THREE.MeshStandardMaterial({ color: '#4a2a14', roughness: 0.55, metalness: 0.1 })); floor.position.y = -0.75; floor.receiveShadow = true; scene.add(floor);
const brassRing = new THREE.Mesh(new THREE.TorusGeometry(3.62, 0.05, 8, 80), M.brass); brassRing.rotation.x = Math.PI / 2; brassRing.position.y = -0.64; scene.add(brassRing);
// accordion, stood on its end boxes' long side, 3/4 view
const acc = makeAccordion(2.9); acc.position.set(0.0, -0.14, -0.5); acc.rotation.set(0.1, -0.42, 0.04); acc.userData.setOpen(0.62);
acc.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(acc);
// caja in front, tilted toward the viewer
const caja = makeCaja(0.62, 1.0); caja.position.set(-0.85, -0.2, 1.6); caja.rotation.set(-0.8, 0.45, 0); caja.userData.tumFx.material.opacity = 0.0;
caja.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(caja);
// guacharaca leaning on the right
const gua = makeGuacharaca(1.35, 0.18); gua.position.set(0.95, -0.5, 1.8); gua.rotation.set(0.1, -0.5, 0.18); gua.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(gua);

const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 60);
cam.position.set(0.0, 2.2, 8.4); cam.lookAt(0.0, -0.1, 0.3);

// bokeh backdrop composited behind the subject
const bgC = document.createElement('canvas'); bgC.width = bgC.height = SIZE; const x = bgC.getContext('2d');
const g = x.createLinearGradient(0, 0, 0, SIZE); g.addColorStop(0, '#04141a'); g.addColorStop(0.55, '#0e4a50'); g.addColorStop(1, '#2a2a1c'); x.fillStyle = g; x.fillRect(0, 0, SIZE, SIZE);
let sd = 7; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
x.globalCompositeOperation = 'lighter';
const cols = ['255,209,102', '255,138,92', '127,227,194', '255,233,184'];
for (let i = 0; i < 40; i++) { const bx = rnd() * SIZE, by = rnd() * SIZE * 0.62, r = SIZE * (0.018 + rnd() * 0.05), gg = x.createRadialGradient(bx, by, 0, bx, by, r); const c = cols[i % 4]; gg.addColorStop(0, `rgba(${c},${0.35 + rnd() * 0.4})`); gg.addColorStop(0.8, `rgba(${c},0.18)`); gg.addColorStop(1, `rgba(${c},0)`); x.fillStyle = gg; x.fillRect(bx - r, by - r, r * 2, r * 2); }
const wg = x.createRadialGradient(SIZE * 0.5, SIZE * 1.0, 0, SIZE * 0.5, SIZE, SIZE * 0.7); wg.addColorStop(0, 'rgba(255,130,60,0.5)'); wg.addColorStop(1, 'rgba(255,90,60,0)'); x.fillStyle = wg; x.fillRect(0, 0, SIZE, SIZE);
x.globalCompositeOperation = 'source-over'; x.filter = `blur(${SIZE * 0.008}px)`; x.drawImage(bgC, 0, 0); x.filter = 'none';

// render subject (transparent) then composite over the backdrop
renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
const out = document.createElement('canvas'); out.width = out.height = SIZE; const ox = out.getContext('2d');
ox.drawImage(bgC, 0, 0); ox.drawImage(gl, 0, 0);
ox.save(); ox.globalCompositeOperation = 'lighter'; ox.filter = `blur(${SIZE * 0.014}px)`; ox.globalAlpha = 0.18; ox.drawImage(gl, 0, 0); ox.restore();
const v = ox.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.34, SIZE / 2, SIZE / 2, SIZE * 0.76); v.addColorStop(0, 'rgba(2,8,12,0)'); v.addColorStop(1, 'rgba(2,8,12,0.6)'); ox.fillStyle = v; ox.fillRect(0, 0, SIZE, SIZE);
const fin = document.createElement('canvas'); fin.width = fin.height = 1024; const fx = fin.getContext('2d'); fx.imageSmoothingQuality = 'high'; fx.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => fin.toDataURL('image/png'); window.__iconJpeg = () => fin.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
void TAU; void B;
