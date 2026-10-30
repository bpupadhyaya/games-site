// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a low, close look across the carved board at dusk,
// a limestone pebble lifted out of its pocket at the moment it is sandwiched between two date stones, the lantern glow and the
// afterglow behind. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { TOP, pocketPos, restY, buildBoard, stoneGeos, stoneMaterials, buildRug, buildSand, buildSky, buildSilhouettes, buildLights, radialTex } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x6e4656, 500, 4000);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.18;
const L = buildLights(scene); L.lamp.shadow.mapSize.set(4096, 4096);
L.lamp.position.set(-30, 16, -8); L.lamp.target.position.set(4, 0, 6); L.lamp.intensity = 5200; L.glow.position.copy(L.lamp.position); L.moon.intensity = 0.15; L.rim.intensity = 2.4;
const rugM = buildRug(); rugM.material.color.setHex(0x9a8a7a);
const sky = buildSky(); sky.material.uniforms.uGlow.value = 0.7; scene.add(sky, buildSilhouettes(), buildSand({ quality: 1 }), rugM, buildBoard('sand', 2048));
const geos = stoneGeos(), mats = stoneMaterials('sand');
const put = (who, v, i, y, yaw, tx = 0, tz = 0, dx = 0) => { const c = pocketPos(i), m = new THREE.Mesh(geos[who][v], mats[who]); m.position.set(c.x + dx, y, c.z); m.rotation.set(tx, yaw, tz, 'YXZ'); m.castShadow = m.receiveShadow = true; scene.add(m); };
// a mid-game position (P = pebble, D = date stone); in the centre row a pebble lifts out, sandwiched between two date stones
const rows = ['P...D', '.D.P.', 'DPD.P', '.P.D.', 'D...P'];
rows.forEach((r, gy) => [...r].forEach((ch, gx) => { if (ch === '.') return; const i = gy * 5 + gx, w = ch === 'P' ? 1 : 2, lift = i === 11; put(w, i % 3, i, restY(w) + (lift ? 3.2 : 0), w === 2 ? 0.785 + (i % 3 - 1) * 0.15 : i * 1.7, lift ? 0.22 : 0, lift ? -0.15 : 0); }));
const pc = pocketPos(11);
const under = new THREE.PointLight(0xffc070, 120, 0, 2); under.position.set(pc.x, TOP + 0.9, pc.z); scene.add(under);
void radialTex;
// the lantern pool: a narrow warm cone on the board, the kilim and sand falling away into the dusk
L.lamp.position.set(-40, 46, -26); L.lamp.target.position.set(0, 0, 0); L.lamp.angle = 0.42; L.lamp.penumbra = 0.9; L.lamp.intensity = 12000; L.glow.intensity = 300; L.glow.position.copy(L.lamp.position);
L.hemi.intensity = 0.08; L.moon.intensity = 0.12; L.rim.intensity = 0.6;
const cam = new THREE.PerspectiveCamera(30, 1, 1, 12000);
const d = 121, yaw = Math.PI / 4, tilt = 50 * Math.PI / 180;
cam.position.set(Math.sin(yaw) * Math.cos(tilt) * d, TOP + Math.sin(tilt) * d, Math.cos(yaw) * Math.cos(tilt) * d); cam.lookAt(1.6, TOP - 2.5, 1.2);
renderIcon({ scene, camera: cam, size, renderer, background: '#1a1018', bloom: 0.12, vignette: 0.8, exposure: 0.9 });
