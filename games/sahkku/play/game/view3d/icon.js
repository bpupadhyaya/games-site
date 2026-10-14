// Offline app-icon render (developer tool, not part of the game): `node` + headless Chrome load web/icon.html?size=2048,
// this script draws the SAME models the game uses (models.js) into a 3D scene, composites a blurred aurora backdrop behind it
// (depth-of-field), glow, vignette and sparkles, and exposes the finished canvas as window.__icon (dataURL) for the capture script.
import * as THREE from '../vendor3d/three.js';
import { makeHerder, makeKing, makeDie, dieUp, buildBoard, buildBackdrop, TILE_TOP } from './models.js';
import { RING, CROSS, CENTRE, GATES, CAMP } from '../src/rules.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; document.body.appendChild(out);
out.style.width = '1024px'; out.style.height = '1024px';
const ctx = out.getContext('2d');

const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.72;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

function ortho(W, H) {
  const c = new THREE.PerspectiveCamera(); const n = 1, f = 2200;
  c.projectionMatrix.set(2 / W, 0, 0, -1, 0, 2 / H, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
  c.projectionMatrixInverse.copy(c.projectionMatrix).invert(); return c;
}
const snap = (target) => { const c = document.createElement('canvas'); c.width = c.height = SIZE; c.getContext('2d').drawImage(gl, 0, 0); return c; };

// ---- 1. backdrop: aurora sky at 1024x1024 virtual units, blurred for depth of field
const bd = buildBackdrop();
bd.update(7.3, 1024, 1024, false);
renderer.setClearColor(0x03060f, 1); renderer.clear();
renderer.render(bd.scene, ortho(1024, 1024));
const backdrop = snap();

// ---- 2. subject scene (transparent)
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; scene.environmentIntensity = 0.5; pm.dispose();
const key = new THREE.DirectionalLight(0xffe0b0, 1.9); key.position.set(-5, 8, 7); key.castShadow = true;
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 }); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
const rim = new THREE.DirectionalLight(0x72ffd6, 2.2); rim.position.set(6, 4, -7);
const rim2 = new THREE.DirectionalLight(0xb48cff, 1.6); rim2.position.set(-7, 3, -5);
const fill = new THREE.DirectionalLight(0x9db8ff, 0.7); fill.position.set(7, 3, 6);
scene.add(new THREE.HemisphereLight(0x7fa0ff, 0x2a2238, 0.35), key, key.target, rim, rim2, fill);

const board = buildBoard('birch', CAMP, GATES, CENTRE, RING, CROSS);
board.position.set(-0.0, 0, 0); scene.add(board);
const cx = (i) => (i % 7) - 3, cz = (i) => Math.floor(i / 7) - 3;
// hero: the white reindeer king on the star, a red herder beside and the sun die in front
const king = makeKing(-1); king.position.set(cx(CENTRE), TILE_TOP, cz(CENTRE)); king.scale.setScalar(1.45); king.userData.body.rotation.y = -1.15; scene.add(king);
// golden ring under the king
const ringG = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 10, 48), new THREE.MeshStandardMaterial({ color: '#ffd24a', metalness: 0.9, roughness: 0.25, emissive: '#6a4400', emissiveIntensity: 0.6 }));
ringG.rotation.x = Math.PI / 2; ringG.scale.setScalar(1.45); ringG.position.set(cx(CENTRE), TILE_TOP + 0.18, cz(CENTRE)); scene.add(ringG);
const herder = makeHerder(0, 'four'); herder.position.set(cx(CENTRE) + 1.5, TILE_TOP, cz(CENTRE) + 1.3); herder.rotation.y = -0.5; herder.scale.setScalar(1.05); scene.add(herder);
const die = makeDie(); die.scale.setScalar(0.62); die.position.set(cx(CENTRE) - 1.5, TILE_TOP + 0.31, cz(CENTRE) + 1.3); die.quaternion.copy(dieUp(0)); die.rotateY(0.6); scene.add(die);
scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 26), 1, 0.5, 100);
const pitch = (Number(q.get('pitch') || 20) * Math.PI) / 180, dist = Number(q.get('dist') || 9), look = [Number(q.get('lx') || 0.1), Number(q.get('ly') || 1.0), 0];
cam.position.set(look[0] + 0, look[1] + Math.sin(pitch) * dist, Math.cos(pitch) * dist); cam.lookAt(look[0], look[1], 0);
renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
const subject = snap();

// ---- 3. composite
ctx.fillStyle = '#04070f'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.012}px)`; ctx.drawImage(backdrop, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
// soft warm glow behind the subject
const g = ctx.createRadialGradient(SIZE * 0.5, SIZE * 0.52, SIZE * 0.05, SIZE * 0.5, SIZE * 0.52, SIZE * 0.5);
g.addColorStop(0, 'rgba(255,214,150,0.34)'); g.addColorStop(0.5, 'rgba(120,200,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.drawImage(subject, 0, 0);
// bloom: the subject again, blurred, added
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.014}px)`; ctx.globalAlpha = 0.38; ctx.drawImage(subject, 0, 0); ctx.restore();
// vignette
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.38, SIZE / 2, SIZE / 2, SIZE * 0.78);
v.addColorStop(0, 'rgba(2,4,14,0)'); v.addColorStop(1, 'rgba(2,4,14,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
// four-point sparkles
const star = (x, y, r, a) => { ctx.save(); ctx.translate(x * SIZE, y * SIZE); ctx.globalAlpha = a; ctx.fillStyle = '#fff6dc'; ctx.beginPath();
  for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.18 : r; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); };
star(0.2, 0.2, SIZE * 0.028, 0.9); star(0.82, 0.3, SIZE * 0.02, 0.8); star(0.7, 0.14, SIZE * 0.014, 0.7); star(0.12, 0.62, SIZE * 0.016, 0.7);
window.__icon = () => out.toDataURL('image/png');
document.title = 'ready';
