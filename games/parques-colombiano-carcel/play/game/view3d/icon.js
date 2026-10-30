// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a low, close look across the lacquered board at its
// raised corona, four turned pawns (one per colour) around it and a pair of ivory dice, in warm late sun. No text.
// Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { BT, R0, buildBoard, pawnKit, dieKit, faceQuat, buildLights } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096);
Object.assign(L.sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 40, far: 600 });
L.sun.position.set(-0.75, 0.5, 0.55).normalize().multiplyScalar(260); L.sun.intensity = 2.6; L.rim.intensity = 2.4; L.rim.color.set(0xffa860); L.hemi.intensity = 0.14; L.fill.intensity = 0.12; scene.environmentIntensity = 0.28;
const B = buildBoard(2048); B.fences.forEach((f) => { f.visible = false; }); scene.add(B.group);
const kit = pawnKit();
const put = (a, x, z, s = 1, ry = 0) => { const g = kit.make(a, false); g.position.set(x, R0, z); g.scale.setScalar(s); g.rotation.y = ry; scene.add(g); return g; };
put(0, -17, 16, 1.5); put(1, 17, 13, 1.5); put(2, 0, -14, 1.4); put(3, -38, -8, 1.2);
const dk = dieKit(), die = (x, z, s, f, ry) => { const m = new THREE.Mesh(dk.geo, dk.mats); m.scale.setScalar(s); m.position.set(x, R0 + s / 2, z); m.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry).multiply(faceQuat(f)); m.castShadow = true; m.receiveShadow = true; scene.add(m); };
die(-2, 34, 8, 5, 0.5); die(12, 36, 8, 3, -0.4);
const cam = new THREE.PerspectiveCamera(30, 1, 1, 2000);
cam.position.set(0, R0 + 36, 128); cam.lookAt(0, R0 + 7, 2);
renderIcon({ scene, camera: cam, size, renderer, background: '#090503', bloom: 0.3, vignette: 0.95, exposure: 0.62 });
