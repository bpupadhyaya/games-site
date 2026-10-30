// Store icon, rendered from the game's own 3D world (open icon.html at 1024x1024; the page sets document.title = 'READY').
// One subject: a glazed tile with a red flag pin, under the desk lamp, with printed numbers on the opened wells around it.
import * as THREE from '../vendor3d/three.js';
import { C, TILE_H, cellPos, tileGeo, tileMat, flagGeos, clothMat, brassMat, digitAtlas, digitGeo, buildTray, buildDesk, buildLights } from './world.js';

await document.fonts.load('700 64px "Fredoka"');
const S = Number(new URLSearchParams(location.search).get('s') || 1024);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(S, S); document.body.appendChild(renderer.domElement);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.82;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x061a1e); scene.fog = new THREE.Fog(0x061a1e, 40, 110);
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35;
const L = buildLights(scene); L.lamp.castShadow = true; L.lamp.shadow.mapSize.set(2048, 2048);
L.lamp.position.set(-34, 40, -6); L.lamp.target.position.set(0, 0, 0); L.lamp.intensity = 5200; L.lamp.angle = 0.42; L.lamp.penumbra = 0.9; L.hemi.intensity = 0.18; L.fill.intensity = 0.1; L.rim.intensity = 1.6; L.rim.position.set(30, 25, -60);
const desk = buildDesk(scene); desk.leather.color.set('#2b5a5c'); desk.chart.visible = false;
const tray = buildTray(5); tray.userData.floor.color.set('#fbf3df'); scene.add(tray);
const tm = tileMat(); tm.color.set('#0f9a96');
const tg = tileGeo();
const hidden = [6, 7, 8, 12, 13, 3, 1];
for (const i of hidden) { const p = cellPos(5, i), m = new THREE.Mesh(tg, tm); m.position.set(p.x, 0, p.z); m.castShadow = m.receiveShadow = true; scene.add(m); }
const atlas = digitAtlas(), NUM = { 11: [1, '#1565c0'], 16: [1, '#1565c0'], 17: [2, '#2e7d32'], 18: [3, '#c62828'], 10: [1, '#1565c0'], 15: [1, '#1565c0'], 22: [1, '#1565c0'], 23: [2, '#2e7d32'], 14: [2, '#2e7d32'] };
for (const [i, [d, col]] of Object.entries(NUM)) { const p = cellPos(5, Number(i)), m = new THREE.Mesh(digitGeo(d, 3.0), new THREE.MeshStandardMaterial({ map: atlas, transparent: true, color: col, roughness: 0.55, depthWrite: false })); m.position.set(p.x, 0.03, p.z + 0.05); scene.add(m); }
// the flag on the centre tile, larger than in play
const fg = flagGeos(), flag = new THREE.Group(), p = cellPos(5, 12);
const metal = new THREE.Mesh(fg.metal, brassMat()); metal.castShadow = true;
const pos = fg.pen.attributes.position; for (let k = 0; k < pos.count; k++) { const u = pos.getX(k) / 2.6; pos.setZ(k, Math.sin(u * 4 - 1.2) * 0.22 * u); } fg.pen.computeVertexNormals();
const pen = new THREE.Mesh(fg.pen, clothMat()); pen.castShadow = true; pen.position.set(-0.42, 2.42, 0);
flag.add(metal, pen); flag.position.set(p.x, TILE_H, p.z); flag.rotation.y = 0.45; flag.scale.setScalar(1.55); scene.add(flag);
const cam = new THREE.PerspectiveCamera(30, 1, 1, 400);
const target = new THREE.Vector3(p.x + 0.6, 3.1, p.z + 0.2);
const el = 28 * Math.PI / 180, az = -20 * Math.PI / 180, dist = 16.5;
cam.position.set(target.x + Math.sin(az) * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + Math.cos(az) * Math.cos(el) * dist); cam.lookAt(target);
renderer.render(scene, cam);
requestAnimationFrame(() => { renderer.render(scene, cam); document.title = 'READY'; });
