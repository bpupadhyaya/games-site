// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a close, low view along the top row of the carved
// board, three light men standing in a row (a mill) with a brass bar glowing under them, dark men beside, a candle flame blooming
// behind. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { TOP, MR, pointWorld, buildBoard, manGeo, manMaterials, buildLights, buildCandle, radialTex } from './world.js';

const q = new URLSearchParams(location.search), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a0503, 60, 200);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096); L.sun.intensity = num('sun', 1.6); L.sun.position.set(-30, 40, 40); L.hemi.intensity = 0.25;
L.sun.shadow.camera.left = -30; L.sun.shadow.camera.right = 30; L.sun.shadow.camera.top = 30; L.sun.shadow.camera.bottom = -30; L.rim.intensity = 0.5;
scene.add(buildBoard('oak', 2048));
// plank table beyond the board
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x3a2312, roughness: 0.7 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const geo = manGeo(), mats = manMaterials('boxwood');
const put = (side, i, y = 0, yaw = 0, dx = 0, dz = 0) => { const m = new THREE.Mesh(geo, mats[side]); const w = pointWorld(i); m.position.set(w.x + dx, TOP + y, w.z + dz); m.rotation.y = yaw; m.castShadow = true; m.receiveShadow = true; scene.add(m); };
// outer ring top row = points 0, 1, 2 (left to right, far side)
put(0, 0, 0, 0.3); put(0, 1, 0, 1.2); put(0, 2, 0, 2.1);
put(1, 23, 0, 0.6); put(1, 9, 0, 1.0); put(1, 8, 0, 2); put(0, 15, 0, 1.5);
const bar = new THREE.Mesh(new THREE.BoxGeometry(2 * Math.abs(pointWorld(2).x) + 2.4, 0.26, 0.5), new THREE.MeshStandardMaterial({ color: 0xe9bb5e, metalness: 1, roughness: 0.25, emissive: 0xffa31a, emissiveIntensity: 1.2 }));
bar.position.set(0, TOP + 0.14, pointWorld(0).z); scene.add(bar);
const halo = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: radialTex('255,190,90', 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
halo.rotation.x = -Math.PI / 2; halo.position.set(0, TOP + 0.2, pointWorld(0).z); halo.material.opacity = 0.55; scene.add(halo);
const c = buildCandle(); c.position.set(num('kx', 6), 0, num('kz', -36)); c.scale.setScalar(1.15); scene.add(c); c.userData.light.intensity = 2600;
const lamp = new THREE.PointLight(0xffa860, 60, 120, 1.6); lamp.position.set(-8, TOP + 14, 10); scene.add(lamp);
const cam = new THREE.PerspectiveCamera(num('fov', 36), 1, 0.5, 3000);
cam.position.set(num('cx', -25), TOP + num('cy', 9), num('cz', pointWorld(0).z + 20)); cam.lookAt(new THREE.Vector3(num('tx', 0), TOP + num('ty', 1.5), num('tz', pointWorld(0).z - 0.5)));
renderIcon({ scene, camera: cam, size, renderer, background: '#0a0503', bloom: 0.2, vignette: 0.7, exposure: num('exp', 0.55) });
