// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): the four yut sticks in the air above the crimson
// silk cushion, mid-tumble (two flat faces, two round backs), lantern light from above, the moonlit lattice doors glowing behind.
// No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { CUSHION, STICK, buildFloor, buildCushion, buildRoom, buildLights, stickKit, buildBoard, tokenKit, lx2x, ly2z, CLOTH_H, TOK_H } from './world.js';
import { POINTS } from '../src/layout.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x140d0a, 120, 420);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3;
const L = buildLights(scene); L.key.castShadow = true; L.key.shadow.mapSize.set(4096, 4096);
L.pool.position.set(-20, 130, 60); L.pool.target.position.set(0, 14, 16); L.pool.intensity = 3.2; L.pool.angle = 0.2; L.pool.penumbra = 0.9; L.key.intensity = 0.9; L.hemi.intensity = 0.22;
L.moon.intensity = 2.6; L.moon.position.set(10, 50, -160);
buildFloor(scene, 1); buildRoom(scene);
const board = buildBoard(2048); board.material.color.setScalar(0.4); scene.add(board);
const tk = tokenKit();
for (const [team, pos, n] of [[0, 21, 2], [1, 13, 1], [1, 7, 1], [0, 3, 1]]) for (let k = 0; k < n; k++) { const m = tk.make(team); const p = POINTS[pos]; m.position.set(lx2x(p.x), CLOTH_H + k * TOK_H, ly2z(p.y)); scene.add(m); }
scene.traverse((o) => { const m = o.material; if (!m || Array.isArray(m)) return; if (m.emissiveMap) { m.emissiveIntensity = 0.3; m.emissive.set(0x5a6c9c); m.color.set(0x141a28); } if (m.clearcoat) m.envMapIntensity = 0.15; });
void buildCushion;
const sk = stickKit();
// x, y (height), z, yaw, roll (0 = flat face up, PI = round back up), pitch
const poses = [[-7, 15.5, 17, 1.05, 0.35, 0.3], [-2.2, 22, 14.5, 0.45, 2.8, -0.2], [3.2, 19.5, 16.5, -0.3, -0.6, 0.32], [7.6, 14, 18, -0.95, 3.4, -0.18]];
poses.forEach(([x, y, z, yaw, roll, pitch], i) => { const m = sk.make(i === 1 ? 0 : i === 0 ? 1 : i); m.position.set(x, y, z); m.rotation.set(pitch, yaw, roll, 'YXZ'); m.scale.setScalar(0.88); scene.add(m); });
// soft contact shadows of the airborne sticks on the silk come from the key light; a faint warm glow under them
const cam = new THREE.PerspectiveCamera(38, 1, 1, 3000);
cam.position.set(1.5, 29, 58); cam.lookAt(0.5, 16, 15);
void CUSHION; void STICK;
renderIcon({ scene, camera: cam, size, renderer, background: '#1a100b', bloom: 0.14, vignette: 0.75, exposure: 0.82 });
