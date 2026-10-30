// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a close, low view of the limestone board corner with
// its zellige border, an ink-blue ceramic disc and an ivory one mid-turn on the stone field. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { TOP, DH, DR, CELL, gridPos, buildBoard, discGeo, discMaterials, buildLights } from './world.js';

const q = new URLSearchParams(location.search), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096); L.sun.intensity = 2.4; L.sun.position.set(-40, 70, 50); L.hemi.intensity = 0.35;
L.sun.shadow.camera.left = -24; L.sun.shadow.camera.right = 24; L.sun.shadow.camera.top = 24; L.sun.shadow.camera.bottom = -24;
const board = buildBoard('midnight', 8, 2048); scene.add(board);
board.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
const geo = discGeo(), mats = discMaterials('gloss');
const put = (x, y, z, rx, yaw) => { const m = new THREE.Mesh(geo, mats); m.position.set(x, y, z); m.rotation.set(rx, yaw, 0, 'YXZ'); m.castShadow = true; m.receiveShadow = true; scene.add(m); };
const R = TOP + DH / 2 + 0.03, p = (c, r) => gridPos(c, r, 8, false);
const a = p(5, 5), b = p(6, 5), c = p(5, 6), d = p(6, 6);
put(a.x, R, a.z, 0, 0.4); put(b.x, R, b.z, Math.PI, 1.1); put(c.x, R + 0.1, c.z, Math.PI, 2); put(d.x, R + 2.6, d.z, Math.PI * 0.62, 0.7);
const cam = new THREE.PerspectiveCamera(num('fov', 30), 1, 0.5, 3000);
const t = p(5.5, 5.4); cam.position.set(t.x + 2, TOP + num('cy', 15), t.z + num('cz', 15)); cam.lookAt(new THREE.Vector3(t.x + 0.3, TOP, t.z - 0.8));
renderIcon({ scene, camera: cam, size, renderer, background: '#c9a76e', bloom: 0.08, vignette: 0.5, exposure: num('exp', 0.85) });
void CELL; void DR;
