// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): the wooden ken close up in the moonlit garden, the
// red lacquer ball seated on the spike, the big moon and the paper lantern glowing behind. No text. Sets window.__icon().
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { buildKen, buildBall, buildCord, buildGarden, buildLights, radialTex, HORIZON } from './world.js';

const q = new URLSearchParams(location.search), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x2a2a62, 900, 5200);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.4;
const L = buildLights(scene); L.moon.castShadow = true; L.moon.shadow.mapSize.set(4096, 4096); L.moon.intensity = num('moon', 2.0);
const garden = buildGarden(0); scene.add(garden.root);
const KX = 360, KY = 560, th = num('th', 0.16);
const ken = buildKen(), ball = buildBall(), cord = buildCord();
scene.add(ken, ball, cord);
ken.position.set(KX, -KY, 0); ken.rotation.z = -th;
// ball seated on the spike: ken-local (0, -46), hole towards the ken
const c = Math.cos(th), s = Math.sin(th), lx = 0, ly = -46;
ball.position.set(KX + lx * c - ly * s, -(KY + lx * s + ly * c), 0); ball.rotation.z = -Math.PI / 2 - th;
// the cord drapes from the string eye down the handle side and out of frame
const rp = { x: new Float32Array(15), y: new Float32Array(15) };
for (let i = 0; i < 15; i++) { const t = i / 14; rp.x[i] = KX + 8 + 70 * Math.sin(t * 2.2) * t; rp.y[i] = KY - 4 + 300 * t + 40 * Math.sin(t * Math.PI); }
cord.userData.update(rp);
// backdrop composed for the square: moon behind and right, lantern glow left, bamboo blurred at the edges
const cam = new THREE.PerspectiveCamera(num('fov', 27), 1, 20, 14000);
const tx = KX - 4, ty = -(KY + num('ty', 62));
cam.position.set(tx + num('cx', 70), ty + num('cy', 60), num('d', 700)); cam.lookAt(tx, ty, 0);
garden.moon.position.set(tx + 150, ty + 110, -900); garden.moon.scale.set(900, 900, 1);
garden.lan.position.set(tx - 420, -1000, -1300); garden.lan.scale.set(2.2, 2.2, 2.2);
garden.and.position.set(tx + 5000, -1000, -400);
garden.trunks.forEach((t, i) => { t.g.position.set(tx + (t.side < 0 ? -1 : 1) * (190 + i * 70), -1500, -600 - i * 120); });
garden.lanLight.intensity = 9e5; garden.andLight.intensity = 0;
const glow = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: radialTex('255,176,100', 0.35), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
glow.position.set(tx - 160, ty - 60, -300); scene.add(glow);
renderIcon({ scene, camera: cam, size, renderer, background: '#141a46', bloom: 0.1, vignette: 0.7, exposure: num('exp', 0.72) });
