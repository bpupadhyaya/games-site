// Offline app-icon render: a crowned Basalt Sultan beside a Limestone man on the scratched sand board at dusk. Same models as the game.
import * as THREE from '../vendor3d/three.js';
import { board3d as B } from '../vendor3d/index.js';
import { buildBoard, buildEnvironment, makeStone, ST } from './models.js';
import { tex, skyCanvas } from './mats.js';
const SIZE = Number(new URLSearchParams(location.search).get('size') || 2048);
const cv = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
const r = new THREE.WebGLRenderer({ canvas: cv(SIZE), antialias: true, alpha: true, preserveDrawingBuffer: true });
r.setPixelRatio(1); r.setSize(SIZE, SIZE, false);
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; r.setClearColor(0x000000, 0);
const sc = new THREE.Scene();
const env = B.createEnvironment(r, sc, { intensity: 0.3 });
const board = buildBoard('sand', 5, false); sc.add(board);
const e = buildEnvironment(); sc.add(e.group);
sc.fog = new THREE.Fog(0x5a2e44, 8, 22);
sc.add(new THREE.HemisphereLight(0xffc9a0, 0x2c2040, 0.3));
const key = new THREE.DirectionalLight(0xffa456, 3.4); key.position.set(-8, 3.4, 4.5); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 40 }); key.shadow.camera.updateProjectionMatrix(); key.shadow.normalBias = 0.02;
const rim = new THREE.DirectionalLight(0x86a0ff, 2.6); rim.position.set(6, 4, -8);
sc.add(key, key.target, rim);
const place = (m, x, z, ry = 0, s = 1) => { m.position.set(x, ST, z); m.rotation.y = ry; m.scale.setScalar(s); sc.add(m); };
const sultan = makeStone(1, 'stone', true); place(sultan, -0.1, 0.9, 0.4, 2.0);
place(makeStone(2, 'stone', false), 1.25, -0.3, 0.2, 1.7);
place(makeStone(1, 'stone', false), -1.3, -0.2, 0.9, 1.7);
const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 80);
cam.position.set(0.5, 1.9, 6.0); cam.lookAt(0.0, 0.85, 0.0);
const q = new URLSearchParams(location.search);
{ cam.position.set(Number(q.get('cx') || 0.5), Number(q.get('cy') || 3.2), Number(q.get('cz') || 4.6)); cam.fov = Number(q.get('fov') || 30); cam.updateProjectionMatrix(); cam.lookAt(Number(q.get('lx') || 0), Number(q.get('ly') || 0.5), Number(q.get('lz') || 0.5)); }
// backdrop pass: sky + dunes, blurred (shallow depth of field)
const bg = new THREE.Scene(); bg.background = tex(skyCanvas(), {}); bg.add(e.group.clone());
// compose
const out = cv(SIZE), x = out.getContext('2d');
sc.background = null;
r.clear(); r.render(sc, cam);
const subject = document.createElement('canvas'); subject.width = subject.height = SIZE; subject.getContext('2d').drawImage(r.domElement, 0, 0);
// backdrop: render the same scene with the sky as background, then blur it
sc.background = tex(skyCanvas(), {});
r.clear(); r.render(sc, cam);
x.filter = `blur(${SIZE * 0.012}px)`; x.drawImage(r.domElement, 0, 0); x.filter = 'none';
// subject sharp on top of the blurred scene, with a soft bloom
x.drawImage(subject, 0, 0);
x.save(); x.globalCompositeOperation = 'lighter'; x.filter = `blur(${SIZE * 0.016}px)`; x.globalAlpha = 0.22; x.drawImage(subject, 0, 0); x.restore();
const g = x.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.4, SIZE / 2, SIZE / 2, SIZE * 0.75); g.addColorStop(0, 'rgba(10,4,16,0)'); g.addColorStop(1, 'rgba(10,4,16,0.5)');
x.fillStyle = g; x.fillRect(0, 0, SIZE, SIZE);
const small = cv(1024), sx = small.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
