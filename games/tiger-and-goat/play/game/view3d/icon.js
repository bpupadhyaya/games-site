// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a lacquered tiger figurine, face to the viewer, on the
// teak board with its brass studs, a goat figurine beside it, a warm paper lantern glowing in the bamboo behind. No text.
// Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { TOP, buildBoard, buildClearing, buildLights, figurines, figMaterial } from './world.js';

const q = new URLSearchParams(location.search), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x08141a, 60, 260);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096); L.sun.intensity = num('sun', 1.1); L.rim.intensity = 1.6; L.rim.position.set(30, 25, -30);
L.warm.position.set(14, 14, 20); L.warm.intensity = num('warm', 0);
const clearing = buildClearing(scene); clearing.update(2, true);
scene.add(buildBoard('teak', 2048));
const geos = figurines('classic'), mat = figMaterial();
const put = (k, x, z, yaw, s) => { const m = new THREE.Mesh(geos[k], mat); m.position.set(x, TOP + 0.3, z); m.rotation.y = yaw; m.scale.setScalar(s); m.castShadow = true; m.receiveShadow = true; scene.add(m); };
put('T', -1.0, 7, 0.18, 3.1);
put('G', 8.6, -2, -0.45, 2.7);
put('T', -11, -8, 0.5, 1.4);
const cam = new THREE.PerspectiveCamera(num('fov', 28), 1, 0.5, 3000);
cam.position.set(num('cx', 1.5), TOP + num('cy', 8), num('cz', 56)); cam.lookAt(new THREE.Vector3(num('tx', 2.4), TOP + num('ty', 8.4), num('tz', 4)));
renderIcon({ scene, camera: cam, size, renderer, background: '#08141a', bloom: 0.22, vignette: 0.85, exposure: num('exp', 0.6) });
