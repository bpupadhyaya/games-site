// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): the carved star board at dusk, close and low, a
// pounamu stone lifted on its way into the putahi, the low sun and sea behind. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { TOP, pointW, restY, buildBoard, stoneGeos, stoneMaterials, buildHeadland, buildLights, SUN_DIR } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9a8c80, 1500, 16000);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096);
const sunDir = new THREE.Vector3(-1, 0.42, -0.35).normalize();          // the sun low over the sea, behind the board
L.sun.position.copy(sunDir).multiplyScalar(220); L.sun.intensity = 3.2; L.fill.intensity = 1.1;
const land = buildHeadland(scene, { quality: 1 }); land.sky.material.uniforms.uSun.value.copy(sunDir);
scene.add(buildBoard(2048));
// the icon keeps the eye on the board: the mat a shade darker (evening shade) so the star's silhouette stands out at 60 px
land.group.traverse((o) => { if (o.geometry?.type === 'BoxGeometry' && Array.isArray(o.material)) o.material[2].color.setHex(0x8f7656); });
const geos = stoneGeos(), mats = stoneMaterials();
const put = (kind, v, x, y, z, yaw, tx = 0, tz = 0) => { const m = new THREE.Mesh(geos[kind][v % 3], mats[kind]); m.position.set(x, y, z); m.rotation.set(tx, yaw, tz, 'YXZ'); m.castShadow = true; m.receiveShadow = true; scene.add(m); };
// a mid-game position: the pounamu stone on point 3 is lifted on its way into the empty putahi
const board = [1, 2, 1, 0, 1, 2, 1, 2, 0];
board.forEach((k, i) => { if (!k) return; const c = pointW(i); put(k, i, c.x, restY(), c.z, i * 1.9); });
const from = pointW(3), u = 0.62, lift = 5.5;
put(2, 1, from.x * (1 - u), restY() + lift, from.z * (1 - u), 0.4, 0.12, 0.25);
const sh = new THREE.Mesh(new THREE.CircleGeometry(3.6, 32), new THREE.MeshBasicMaterial({ color: 0x1a0800, transparent: true, opacity: 0.35, depthWrite: false }));
sh.rotation.x = -Math.PI / 2; sh.position.set(from.x * (1 - u) + 1.5, TOP + 0.05, from.z * (1 - u) + 1.5); scene.add(sh);
void SUN_DIR;
const cam = new THREE.PerspectiveCamera(52, 1, 1, 12000);
cam.position.set(0, TOP + 70, 40); cam.lookAt(new THREE.Vector3(0, TOP - 1, -0.5));
renderIcon({ scene, camera: cam, size, renderer, background: '#1a2e33', bloom: 0.1, vignette: 0.85, exposure: 0.95 });
