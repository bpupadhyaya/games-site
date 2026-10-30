// Store icon, rendered from the game's own 3D world (open icon.html; the page sets document.title = 'READY').
// One subject: a carved dark Nguni cow on the corner of the sandstone board, lit from behind by the low sun at dusk.
import * as THREE from '../vendor3d/three.js';
import { HALF, SP, cowGeometry, cowMaterial, buildSlab, buildWorld, buildLights, pointXZ } from './world.js';

const S = Number(new URLSearchParams(location.search).get('s') || 1024);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(S, S); document.body.appendChild(renderer.domElement);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2a1020); scene.fog = new THREE.Fog(0x7a3040, 120, 900);
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.12;
const env = buildWorld(scene); env.pot.visible = false;
const L = buildLights(scene, env.sun); L.sun.castShadow = true; L.sun.shadow.mapSize.set(2048, 2048);
L.sun.intensity = 2.6; L.rim.intensity = 1.2; L.fill.intensity = 0.75; L.hemi.intensity = 0.6;
scene.add(buildSlab());
// the hero cow, on the near-left outer corner point, almost in profile against the low sun, head turned a little toward us
env.kraal.visible = false;
const p = pointXZ(6), cow = new THREE.Mesh(cowGeometry(1), cowMaterial()); cow.castShadow = cow.receiveShadow = true;
cow.position.set(p.x, 0, p.z); cow.rotation.y = 0.12; scene.add(cow);
const q = pointXZ(14), c2 = new THREE.Mesh(cowGeometry(2), cowMaterial()); c2.position.set(q.x, 0, q.z); c2.rotation.y = 2.9; c2.castShadow = true; scene.add(c2);
// a warm back light that rims the horns and the back, and a soft front fill so the hide still reads
const back = new THREE.SpotLight(0xffa860, 5200, 0, 0.5, 0.8, 1.5); back.position.set(p.x - 25, 75, p.z - 45); back.target = cow; scene.add(back);
L.fill.intensity = 1.1; L.fill.position.set(p.x + 60, 30, p.z + 80);
const cam = new THREE.PerspectiveCamera(32, 1, 1, 4000);
const target = new THREE.Vector3(p.x + 0.2, 3.4, p.z), sd = env.sun;
const dist = 15.5;
cam.position.set(target.x - sd.x * dist, target.y + 0.9, target.z - sd.z * dist); cam.lookAt(target.x, target.y + 0.9, target.z);
void HALF; void SP;
renderer.render(scene, cam);
requestAnimationFrame(() => { renderer.render(scene, cam); document.title = 'READY'; });
