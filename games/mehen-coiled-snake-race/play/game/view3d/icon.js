// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): close over the head of the coiled snake carved in dark
// stone, its two gold eyes catching the lamp, a lapis lion crouched in the first coil. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { Y0, wx, wz, buildHeights, buildMaps, buildDisc, makeLion, buildLights } from './world.js';
import { CELL_PTS } from '../src/geo.js';

const q = new URLSearchParams(location.search), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05070d, 40, 120);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3;
const L = buildLights(scene); L.moon.castShadow = true; L.moon.shadow.mapSize.set(4096, 4096); L.moon.intensity = num('moon', 2.4); L.hemi.intensity = 0.5;
L.moon.position.set(-24, 22, 18); L.moon.shadow.camera.left = -20; L.moon.shadow.camera.right = 20; L.moon.shadow.camera.top = 20; L.moon.shadow.camera.bottom = -20;
L.rim.color.set(0xffb070); L.rim.intensity = num('rim', 1.3); L.rim.position.set(30, 10, -18);
const lamp = new THREE.PointLight(0xffa050, num('lamp', 900), 0, 2); lamp.position.set(-12, Y0 + 9, 14); scene.add(lamp);
const H = await buildHeights(1024, null), maps = await buildMaps(H, q.get('stone') || 'basalt', null);
scene.add(buildDisc(H, maps));
// the lion sits in the first coil, facing along the snake toward the head
const c = CELL_PTS[num('cell', 22)], lion = makeLion(0);
lion.position.set(wx(c.x), H.floorAt(c.x, c.y) + 0.04, wz(c.y)); lion.rotation.y = -c.ang; lion.scale.setScalar(1.15); scene.add(lion);
const cam = new THREE.PerspectiveCamera(num('fov', 34), 1, 0.5, 400);
cam.position.set(num('cx', 0), Y0 + num('cy', 21), num('cz', 17)); cam.lookAt(new THREE.Vector3(num('tx', 0), Y0 + num('ty', 0.6), num('tz', -2.6)));
renderIcon({ scene, camera: cam, size, renderer, background: '#05070d', bloom: 0.18, vignette: 0.7, exposure: num('exp', 0.95) });
