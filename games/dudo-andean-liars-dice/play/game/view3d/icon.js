// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): the leather cacho lifted off a woven aguayo cloth
// under a warm lamp, five carved bone dice just tumbled out, the ace in front. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { FACE_UP, diceMaterials, dieGeometry, makeCup, clothMaterials, buildTable, buildLights } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0c0705, 90, 200);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.2;
const L = buildLights(scene); L.lamp.castShadow = true; L.lamp.shadow.mapSize.set(4096, 4096);
L.lamp.position.set(-25, 150, 30); L.lamp.target.position.set(0, 0, -2); L.lamp.intensity = 5200; L.lamp.angle = 0.3; L.lamp.penumbra = 1; L.rim.intensity = 1.6; L.rim.position.set(50, 40, -90);
buildTable(scene, 0);
// the cloth: plain woven field with a patterned band running across behind the dice
const cm = clothMaterials('aguayo');
const plane = (w, d, mat, x, z, y, rep) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rep[0], uv.getY(i) * rep[1]); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; };
plane(140, 90, cm.field, 0, 0, 0.2, [140 / 16, 90 / 16]);
plane(140, 9, cm.band, 0, -16, 0.3, [140 / 36, 1]);
plane(140, 9, cm.band, 0, 38, 0.3, [140 / 36, 1]);
// dice: tumbled out in a loose arc, the ace facing up in front
const geo = dieGeometry(), mats = diceMaterials('aguayo'), S = 7.2;
const put = (face, x, z, yaw, lift = 0, tx = 0, tz = 0) => {
  const m = new THREE.Mesh(geo, mats); m.scale.setScalar(S);
  const qq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(FACE_UP[face]);
  if (tx || tz) qq.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tx, 0, tz)));
  m.quaternion.copy(qq); m.position.set(x, S / 2 + lift, z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
};
put(1, 1, 9, 0.35);
put(5, -10, 3, -0.4);
put(6, 11, 1, 0.9);
put(3, 3, -6, 1.3, 5.5, 0.7, 0.4);       // still in the air
put(1, -4, -11, 0.2, 0, 0, 0);
// the cup, lifted and tipped back, mouth toward the dice
const cup = makeCup('aguayo');
cup.scale.set(19, 22, 19); cup.position.set(-12, 9, -20); cup.rotation.set(-0.62, 0.55, 0.3, 'YXZ'); scene.add(cup);
const cam = new THREE.PerspectiveCamera(34, 1, 1, 2000);
cam.position.set(8, 38, 58); cam.lookAt(-2, 7, -7);
renderIcon({ scene, camera: cam, size, renderer, background: '#140a06', bloom: 0.1, vignette: 0.55, exposure: 0.92 });
