// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a low look across the inlaid board by lamp light,
// the gold-hearted central rosette, a jet counter resting on it, a shell counter beside, and a pyramid die with its gold tip up in
// front. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { TOP, cellPos, buildBoard, pieceKit, dieKit, buildRoom, buildLights } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b0705, 60, 300);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.06;
const L = buildLights(scene); L.key.shadow.mapSize.set(4096, 4096); L.key.intensity = 2.2;
const room = buildRoom(scene); room.lamp.position.set(3, 0, -24); room.lamp.rotation.y = 2.4; room.lamp.updateMatrixWorld(true);
room.group.children.forEach((o) => { if (o.geometry && o.geometry.type === 'SphereGeometry') o.visible = false; });       // no loose beads in the icon
L.flameL.position.copy(room.lamp.localToWorld(room.flame.position.clone())); L.flameL.intensity = 140;
scene.add(buildBoard(1024));
const PK = pieceKit(), DK = dieKit();
const counter = (side, x, z, y, rx = 0, rz = 0) => { const g = new THREE.Group(); const b = new THREE.Mesh(PK.body, PK.sides[side].body), t = new THREE.Mesh(PK.cap, PK.sides[side].top); b.castShadow = true; g.add(b, t); g.position.set(x, y, z); g.rotation.set(rx, 0.6, rz); scene.add(g); return g; };
const ros = cellPos(1, 3), side = cellPos(2, 2);
counter(0, ros.x + 0.15, ros.z - 0.9, TOP);                         // a shell counter safe on the central rosette
counter(1, side.x, side.z, TOP);                                    // a jet counter waiting in the next lane
const die = DK.make(); die.quaternion.copy(DK.restQ(true, 2.2)); die.scale.setScalar(1.3);
{ const lo = Math.min(...DK.verts.map((v) => v.clone().applyQuaternion(die.quaternion).y)) * 1.3; die.position.set(ros.x - 2.6, TOP - lo, ros.z + 3.4); }
die.traverse((m) => { if (m.isMesh) m.castShadow = true; }); scene.add(die);
L.hemi.intensity = 0.28; L.fill.intensity = 0.15; L.key.position.set(26, 34, 14); L.key.intensity = 2.4; L.rim.intensity = 1.3;
const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 900);
cam.position.set(ros.x - 3.5, TOP + 7.5, ros.z + 15.5); cam.lookAt(ros.x - 1.0, TOP + 0.6, ros.z + 0.8);
renderIcon({ scene, camera: cam, size, renderer, background: '#140b06', bloom: 0.07, vignette: 0.6, exposure: 0.95 });
