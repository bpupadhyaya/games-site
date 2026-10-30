// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a close, low view of a carved marble slab on dark
// slate, a bronze cross and a verdigris nought either side of a lit centre cross. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { themeById, boardGeo } from '../src/art.js';
import { TOP, SIDE, buildBoard, buildTable, pieceGeos, pieceMaterials, buildLights, setEnv } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const th = themeById(q.get('theme') || 'marble');
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
const L = buildLights(scene); setEnv(scene, L, th); scene.background = null; scene.fog = new THREE.Fog(0x0a0806, 60, 160);
L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096); L.sun.position.set(-26, 38, 30); L.sun.intensity = 1.5; L.hemi.intensity = 0.18;
scene.add(buildTable(th)); scene.add(buildBoard(th, 'classic', 2048));
const geos = pieceGeos(), mats = pieceMaterials(th), wg = boardGeo('classic', -SIDE / 2, -SIDE / 2, SIDE);
const put = (who, i, yaw = 0, lift = 0) => {
  const m = new THREE.Mesh(geos[who], mats[who]); const [x, z] = wg.centers[i]; m.scale.setScalar(wg.d * (who === 1 && i === 4 ? 1.6 : 1.1)); m.position.set(x, TOP + lift, z); m.rotation.y = yaw; m.castShadow = true; m.receiveShadow = true; scene.add(m);
};
put(1, 4, 0.05); put(2, 1, 0.3); put(1, 0, 0.1); put(2, 6, 1); put(1, 8, -0.1);
const cam = new THREE.PerspectiveCamera(32, 1, 1, 3000);
cam.position.set(-4, 19, 33); cam.lookAt(new THREE.Vector3(0, TOP + 0.6, -3));
renderIcon({ scene, camera: cam, size, renderer, background: '#0a0806', bloom: 0.12, vignette: 0.85, exposure: 0.5 });
