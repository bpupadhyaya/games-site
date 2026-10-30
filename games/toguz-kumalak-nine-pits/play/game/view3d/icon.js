// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a low look along the bottom row of the carved
// board, the nearest pit heaped with river-stone kumalak and one more pebble dropping into it, daylight from the shanyrak falling
// across the wood, a tuz flag beyond. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { TOP, pitWorld, pitSlot, kazanSlot, buildBoard, pebbleGeos, pebbleMaterials, TINT3, buildYurt, buildLights, buildTuz, SUN_DIR } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2a1d16);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.32;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096); L.sun.intensity = num('sun', 3.4);
Object.assign(L.sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40 }); L.sun.shadow.camera.updateProjectionMatrix();
buildYurt(scene, { quality: 1 });
scene.add(buildBoard('walnut', 2048, 2.4));
const geos = pebbleGeos(), mats = pebbleMaterials(), set = q.get('set') || 'stones';
const put = (o, dy = 0, extra = 0) => { const m = new THREE.Mesh(geos[o.g], mats[set]); m.material = mats[set].clone(); m.material.color.setHex(TINT3[set][o.v]).multiplyScalar(0.92 + 0.16 * ((o.v * 7 + o.g) % 3) / 2); m.position.set(o.x, o.y + dy, o.z); m.rotation.set(o.tx + extra, o.yaw, o.tz, 'YXZ'); m.castShadow = true; m.receiveShadow = true; scene.add(m); };
const pits = [9, 4, 7, 3, 12, 6, 2, 15, 5, 11, 8, 0, 13, 9, 14, 3, 10, 7];
pits.forEach((n, i) => { for (let k = 0; k < n; k++) put(pitSlot(i, k)); });
for (let k = 0; k < 40; k++) put(kazanSlot(0, k));
for (let k = 0; k < 34; k++) put(kazanSlot(1, k));
const T = buildTuz(1), tw = pitWorld(11); T.position.set(tw.x, 0, tw.z); scene.add(T);
// the focus pit and a pebble falling into it
const F = num('pit', 7), fw = pitWorld(F), top = pitSlot(F, pits[F]);
put({ ...top, y: top.y + num('drop', 2.6), tx: 0.5 }, 0, 0.3);
const cam = new THREE.PerspectiveCamera(num('fov', 34), 1, 1, 3000);
cam.position.set(fw.x + num('cx', -6), TOP + num('cy', 9.5), fw.z + num('cz', 13)); cam.lookAt(fw.x + num('lx', 1.5), TOP + num('ly', 0), fw.z + num('lz', -2));
void SUN_DIR;
renderIcon({ scene, camera: cam, size, renderer, background: '#2a1a12', bloom: 0.12, vignette: 0.45, exposure: num('exp', 0.85) });
