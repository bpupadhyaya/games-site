// Offline app-icon render (developer tool, not part of the game): open icon.html?size=2048 in headless Chrome with real WebGL; window.__icon() returns the
// PNG data URL (1024) and window.__iconJpeg() a JPEG, document.title becomes 'ready'. Same world as the game (world.js): one bold ink ring (an enso)
// written on a sheet of xuan paper on the indigo felt, the brush still wet at the end of the stroke, daylight through the paper window.
import * as THREE from '../vendor3d/three.js';
import { PW, PH, FELT_Y, PAPER_Y, LOOKS, deskMesh, feltMesh, paperMesh, brush, weight, lattice } from './world.js';
import { paperImage } from '../src/art.js';
import { synthSamples, paintSamples } from '../src/brush.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const L = LOOKS.day, scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1013);
scene.add(deskMesh(), feltMesh());
const paper = paperMesh(); scene.add(paper);
// the sheet: the game's own paper and the game's own brush, one big ring that thins out to a dry tip
const S = 2, c = document.createElement('canvas'); c.width = 600 * S; c.height = 800 * S; const g = c.getContext('2d');
const pimg = paperImage(600, 800, S, 7); g.drawImage(pimg, 0, 0, c.width, c.height);
const cx = num('cx', 300), cy = num('cy', 400), R = num('r', 190), a0 = num('a0', -2.35), sweep = num('sweep', 5.5), N = 40, path = [];
for (let i = 0; i <= N; i++) { const a = a0 + (i / N) * sweep; path.push([cx + Math.cos(a) * R * (1 + 0.035 * Math.sin(a * 2 + 1)), cy + Math.sin(a) * R * (1 + 0.035 * Math.cos(a * 3))]); }
const smp = synthSamples(path, 'pie', num('base', 112), { load: 1, k: 1 });
const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; const tg = t.getContext('2d'); tg.scale(S, S); paintSamples(tg, smp, 1, 4);
g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.97; g.drawImage(t, 0, 0); g.globalAlpha = 1;
const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
const pm = paper.userData.mat; pm.map = tex; pm.emissiveMap = tex; pm.emissiveIntensity = 0.3; pm.color.set(0xfff0d6); pm.needsUpdate = true;
const end = smp[smp.length - 1], tip = new THREE.Vector3((end.x / 600 - 0.5) * PW, PAPER_Y + 0.3, (end.y / 800 - 0.5) * PH);
const br = brush(); br.position.copy(tip); br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.5, 1, -0.2).normalize());
br.userData.hair.scale.set(1.2, 0.88, 1.2); scene.add(br);
// daylight through the paper window
const SUN = new THREE.Vector3(-0.62, 0.6, -0.5).normalize();
const sun = new THREE.DirectionalLight(L.sun, num('sun', 2.3)); sun.position.copy(SUN).multiplyScalar(130); sun.target.position.set(0, 0, 4);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05; Object.assign(sun.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44, near: 40, far: 260 });
const win = lattice(); win.position.copy(SUN).multiplyScalar(78).add(sun.target.position); win.lookAt(sun.target.position);
scene.add(sun, sun.target, new THREE.HemisphereLight(L.sky, L.ground, num('hemi', 0.8)));
const cam = new THREE.PerspectiveCamera(num('fov', 24), 1, 1, 800);
const tilt = num('tilt', 47) * Math.PI / 180, yaw = num('yaw', -8) * Math.PI / 180, dist = num('dist', 80), tgt = new THREE.Vector3(num('tx', 0.5), PAPER_Y, num('tz', 1));
cam.position.set(tgt.x + Math.sin(yaw) * Math.cos(tilt) * dist, tgt.y + Math.sin(tilt) * dist, tgt.z + Math.cos(yaw) * Math.cos(tilt) * dist); cam.lookAt(tgt);
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setPixelRatio(1); r.setSize(SIZE, SIZE, false); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = num('exp', 1.05);
r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
const pg = new THREE.PMREMGenerator(r); scene.environment = pg.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
r.render(scene, cam);
document.body.appendChild(r.domElement);
// compose 1024 square with a soft vignette (corners fall into the dark felt), opaque
const out = document.createElement('canvas'); out.width = out.height = 1024; const o = out.getContext('2d');
o.drawImage(r.domElement, 0, 0, 1024, 1024);
const vg = o.createRadialGradient(512, 500, 300, 512, 512, 780); vg.addColorStop(0, 'rgba(6,9,12,0)'); vg.addColorStop(1, `rgba(6,9,12,${num('vig', 0.72)})`); o.fillStyle = vg; o.fillRect(0, 0, 1024, 1024);
window.__icon = () => out.toDataURL('image/png');
window.__iconJpeg = () => out.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
