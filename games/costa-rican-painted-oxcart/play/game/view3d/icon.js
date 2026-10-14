// Offline app-icon render (developer tool, not part of the game): headless Chrome loads web/icon.html?size=2048. It builds a hero
// scene from the SAME models the game uses: a painted Sarchi-style oxcart wheel standing on a highland road at golden hour, the
// painted cart side panel behind it, lit by a low sun with a long cast shadow, over a painted-sky / coffee-hill backdrop with
// depth-of-field haze. Exposes window.__icon() / __iconJpeg() and sets document.title = 'ready'.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import * as M from './models.js';
import { stockWheels, stockPanel } from '../src/art.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048), TAU = Math.PI * 2;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const gl = cv(SIZE);
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = Number(q.get('exp') || 1.0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.32; pm.dispose();
const HORIZON = 0xb9c98a;
scene.fog = new THREE.Fog(HORIZON, 24, 150);
const sun = new THREE.DirectionalLight(0xffd9a6, 3.6); sun.position.set(-6, 6.0, 7.5); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
const sky = new THREE.HemisphereLight(0xcfe6ff, 0x8a7a48, 0.55);
const rim = new THREE.DirectionalLight(0xffc27a, 2.0); rim.position.set(7, 3, -6);
scene.add(sun, sun.target, sky, rim);

const cvs = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tx = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; return t; };
// field: grass with mown stripes
const gc = cvs(512), gx = gc.getContext('2d');
for (let i = 0; i < 16; i++) { gx.fillStyle = i % 2 ? '#5fb04a' : '#52a041'; gx.fillRect(0, i * 32, 512, 32); }
for (let i = 0; i < 6000; i++) { gx.fillStyle = i % 2 ? 'rgba(255,255,200,0.08)' : 'rgba(10,50,10,0.12)'; gx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 2 + Math.random() * 4); }
const field = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: tx(gc, [8, 8]), roughness: 0.95 }));
field.rotation.x = -Math.PI / 2; field.position.y = -0.002; field.receiveShadow = true; scene.add(field);
// the dirt road running away to the hills, with two wheel ruts
const rc = cvs(512, 1024), rx = rc.getContext('2d');
{ const g = rx.createLinearGradient(0, 0, 512, 0); g.addColorStop(0, '#a87a48'); g.addColorStop(0.5, '#c79a62'); g.addColorStop(1, '#a87a48'); rx.fillStyle = g; rx.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 9000; i++) { rx.fillStyle = i % 2 ? 'rgba(255,235,190,0.12)' : 'rgba(60,30,8,0.16)'; rx.fillRect(Math.random() * 512, Math.random() * 1024, 1 + Math.random() * 3, 1 + Math.random() * 3); }
  rx.fillStyle = 'rgba(70,40,14,0.28)'; rx.fillRect(150, 0, 22, 1024); rx.fillRect(340, 0, 22, 1024);
  rx.fillStyle = 'rgba(120,150,60,0.55)'; rx.fillRect(0, 0, 18, 1024); rx.fillRect(494, 0, 18, 1024); }
const road = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 140), new THREE.MeshStandardMaterial({ map: tx(rc, [1, 14]), roughness: 0.96 }));
road.rotation.x = -Math.PI / 2; road.position.set(0.3, 0.0, -60); road.receiveShadow = true; scene.add(road);
// coffee bushes in rows and tall poplars, instanced, receding to the hills
const bushG = new THREE.SphereGeometry(0.5, 10, 8), bushM = new THREE.MeshStandardMaterial({ color: 0x2f8a46, roughness: 0.8 });
const nb = 420, bushes = new THREE.InstancedMesh(bushG, bushM, nb), m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
let bi = 0;
for (let r = 0; r < 14 && bi < nb; r++) for (let i = 0; i < 30 && bi < nb; i++) {
  const side = i % 2 ? 1 : -1, x = side * (4.6 + Math.floor(i / 2) * 0.0 + (r % 3) * 1.3 + Math.random() * 0.5) + (r > 4 ? side * (r - 4) * 1.4 : 0), z = -4 - r * 3.4 - Math.random() * 1.2;
  const sz = 0.9 + Math.random() * 0.5; pos.set(x + (i >> 1) * side * 0.0, 0.3 * sz, z); scl.set(sz, 0.7 * sz, sz); m4.compose(pos, quat, scl); bushes.setMatrixAt(bi++, m4);
}
bushes.castShadow = true; scene.add(bushes);
const treeM = new THREE.MeshStandardMaterial({ color: 0x2c7a3a, roughness: 0.85 });
for (let i = 0; i < 26; i++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), treeM); const side = i % 2 ? 1 : -1; t.scale.set(0.8, 3.2 + Math.random() * 1.6, 0.8); t.position.set(side * (6 + Math.random() * 12), 2.0, -8 - i * 3.5); t.castShadow = true; scene.add(t); }
// far hills as big soft domes
for (const [x, z, r, c] of [[-20, -75, 22, 0x4a9a6a], [14, -85, 26, 0x5aa87a], [-4, -100, 30, 0x78b890], [34, -70, 18, 0x4a9a6a]]) { const h = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 14), new THREE.MeshStandardMaterial({ color: c, roughness: 1 })); h.scale.y = 0.5; h.position.set(x, -r * 0.18, z); scene.add(h); }

function paint(pc, colourOf) {
  for (const c of pc.cells) {
    const col = colourOf(c.c);
    c.mesh.material = col ? M.paintMat(col) : M.bareMat(c.id);
    if (c.petal) { c.petal.visible = !!col; if (col) c.petal.material = M.petalMat(col); }
    if (c.dot) c.dot.visible = !!col;
  }
}
const PAL = ['red', 'yellow', 'blue', 'green', 'orange'];
// the wheel, standing upright on the road, turned to show its tyre; resting on the ground
const W = stockWheels()[1], wheel = M.buildPiece(W.P);
paint(wheel, (c) => (c.shape === 'disc' ? 'green' : PAL[(c.sector + c.ring * 2 + (c.ring % 2 ? 1 : 0)) % 5]));
const wheelRig = new THREE.Group(); wheelRig.add(wheel.group); wheel.group.rotation.x = Math.PI / 2;
wheelRig.position.set(0.35, 1.03, 0.4); wheelRig.rotation.y = -0.72; wheelRig.scale.setScalar(1.0);
scene.add(wheelRig);
// painted cart side panel standing behind the wheel, left
const PN = stockPanel(), panel = M.buildPiece(PN.P);
const PP = ['red', 'blue', 'yellow', 'green', 'orange'];
paint(panel, (c) => PP[(c.sector * 2 + c.ring * 3 + (c.sector >> 2)) % 5]);
const panelRig = new THREE.Group(); panelRig.add(panel.group); panel.group.rotation.x = Math.PI / 2;
panelRig.scale.setScalar(0.44); panelRig.position.set(-2.7, 0.62, -1.7); panelRig.rotation.y = 0.55;
scene.add(panelRig);
// a brush resting by the wheel and a pot of red paint, both at real size relative to the wheel (wheel ~80 cm: brush ~25 cm)
const br = M.buildBrush('#f8c623'); br.position.set(0.55, 0, 1.75); br.rotation.y = -0.5; br.scale.setScalar(0.5); scene.add(br);
const jar = M.buildJar(); jar.scale.set(0.3, 0.34, 0.3); jar.position.set(-1.25, 0, 1.2); jar.userData.paint.material = M.paintMat('red'); scene.add(jar);

const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 30), 1, 0.5, 260);
const look = [0.0, 1.0, 0.0], pitch = (Number(q.get('pitch') || 7) * Math.PI) / 180, dist = Number(q.get('dist') || 7.6), yaw = (Number(q.get('yaw') || 0) * Math.PI) / 180;
cam.position.set(look[0] + Math.sin(yaw) * Math.cos(pitch) * dist, look[1] + Math.sin(pitch) * dist, look[2] + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(...look);
cam.updateMatrixWorld();
renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
const subject = cv(SIZE); subject.getContext('2d').drawImage(gl, 0, 0);

// ---- backdrop painted behind: sky and sun haze (the hills, road and bushes are real 3D), then the subject, bloom and vignette
const hy = (() => { const v = new THREE.Vector3(0, 0, -150).project(cam); return ((1 - v.y) / 2) * SIZE; })();
const out = cv(SIZE), x = out.getContext('2d');
const sk = x.createLinearGradient(0, 0, 0, hy + SIZE * 0.05); sk.addColorStop(0, '#2f7fd0'); sk.addColorStop(0.5, '#7fc0ee'); sk.addColorStop(1, '#ffe6b0');
x.fillStyle = sk; x.fillRect(0, 0, SIZE, SIZE);
{ const g = x.createRadialGradient(SIZE * 0.2, hy - SIZE * 0.03, 0, SIZE * 0.2, hy - SIZE * 0.03, SIZE * 0.55); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.2, 'rgba(255,225,150,0.6)'); g.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = g; x.fillRect(0, 0, SIZE, SIZE); }
for (const [cx, cy, s2] of [[0.66, 0.14, 1], [0.86, 0.24, 0.7], [0.4, 0.08, 0.6]]) { for (let i = 0; i < 7; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, SIZE * 0.07 * s2); g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.save(); x.translate(SIZE * cx + (i - 3) * SIZE * 0.035 * s2, SIZE * cy + Math.sin(i * 1.7) * SIZE * 0.015); x.scale(1.6, 0.7); x.fillStyle = g; x.beginPath(); x.arc(0, 0, SIZE * 0.07 * s2, 0, TAU); x.fill(); x.restore(); } }
x.drawImage(subject, 0, 0);
x.save(); x.globalCompositeOperation = 'lighter'; x.filter = `blur(${SIZE * 0.012}px)`; x.globalAlpha = 0.28; x.drawImage(subject, 0, 0); x.restore();
{ const g = x.createRadialGradient(SIZE / 2, SIZE * 0.5, SIZE * 0.4, SIZE / 2, SIZE / 2, SIZE * 0.78); g.addColorStop(0, 'rgba(20,8,0,0)'); g.addColorStop(1, 'rgba(20,8,0,0.45)'); x.fillStyle = g; x.fillRect(0, 0, SIZE, SIZE); }
const small = cv(1024), sx = small.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(out, 0, 0, 1024, 1024);
document.body.appendChild(small);
globalThis.__icon = () => small.toDataURL('image/png'); globalThis.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
