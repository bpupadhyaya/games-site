// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): close over a corner of the carved teak board at
// night, a shell-white stone gliding round the brass and jade loops toward a red lacquer stone, lit by the oil lamp beyond the
// frame. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { themeById } from '../src/art.js';
import { TOP, gridPos, buildBoard, pieceGeos, pieceMaterials, buildLights, radialTex } from './world.js';

const q = new URLSearchParams(location.search), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d), size = Number(q.get('size') || 2048);
const th = themeById(q.get('theme') || 'teak');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x07080c, 22, 60);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.4;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096); L.sun.intensity = num("sun", 1.2); L.sun.position.set(-30, 40, 40); L.hemi.intensity = 0.12;
L.sun.shadow.camera.left = -30; L.sun.shadow.camera.right = 30; L.sun.shadow.camera.top = 30; L.sun.shadow.camera.bottom = -30;
L.rim.intensity = num("rim", 0.4); L.rim.color.set(0xffb070); L.rim.position.set(-30, 18, -60);
const lamp = new THREE.PointLight(0xffa050, num('lamp', 60), 200, 1.6); lamp.position.set(-2, TOP + 12, 6); scene.add(lamp);
scene.add(buildBoard(th, 2048));
const geos = pieceGeos(), mats = pieceMaterials(th);
const put = (who, x, y, z, yaw = 0, tx = 0, tz = 0) => {
  for (const g of who === 2 ? [geos[2], geos.gold] : [geos[1]]) { const m = new THREE.Mesh(g, g === geos.gold ? mats.gold : mats[who]); m.position.set(x, y, z); m.rotation.set(tx, yaw, tz, 'YXZ'); m.castShadow = true; m.receiveShadow = true; scene.add(m); }
};
// the picture: a red lacquer stone on the crossing of two circuits, the brass and jade lines running away from it into the dark, a shell
// stone gliding round a loop in the distance behind it with a glowing trail
const hero = gridPos(1, 2);
put(2, hero.x, TOP, hero.z, 0.4);
for (const [c, r, y] of [[2, 1, 1.1], [0, 3, 0.2]]) { const p = gridPos(c, r); put(2, p.x, TOP, p.z, y); }
const loop = (ang, k = 2, cx = 0, cy = 0) => gridPos(cx + k * Math.cos(ang), cy + k * Math.sin(ang));
const A0 = Math.PI * 0.5, A1 = Math.PI * 1.62;
const w = loop(A1, 2); put(1, w.x, TOP + 0.5, w.z, 0.3, 0.12, -0.1);
const pts = [];
for (let i = 0; i <= 80; i++) { const ang = A0 + (A1 - A0) * (i / 80), p = loop(ang, 2); pts.push(new THREE.Vector3(p.x, TOP + 0.34, p.z)); }
const tc = document.createElement('canvas'); tc.width = 256; tc.height = 4; const tg = tc.getContext('2d'), gr = tg.createLinearGradient(0, 0, 256, 0);
gr.addColorStop(0, 'rgba(255,225,160,0)'); gr.addColorStop(1, 'rgba(255,240,200,0.95)'); tg.fillStyle = gr; tg.fillRect(0, 0, 256, 4);
const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
const trail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.28, 8), new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
if (q.has('trail')) scene.add(trail);
const glow = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: radialTex('255,210,140', 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
glow.rotation.x = -Math.PI / 2; glow.position.set(w.x, TOP + 0.1, w.z); glow.material.opacity = 0.35; scene.add(glow);
const cam = new THREE.PerspectiveCamera(num('fov', 30), 1, 0.5, 3000);
cam.position.set(num('cx', hero.x + 3.2), TOP + num('cy', 5.2), num('cz', hero.z + 9.5)); cam.lookAt(new THREE.Vector3(num('tx', hero.x - 2.2), TOP + num('ty', 0.5), num('tz', hero.z - 5.5)));
renderIcon({ scene, camera: cam, size, renderer, background: '#07080c', bloom: 0.16, vignette: 0.75, exposure: num('exp', 0.7) });
