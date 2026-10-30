// Store icon, rendered from the game's own world (open web/icon.html at 1024 x 1024 and screenshot it; not shipped in the game flow).
// One clear subject: an ivory 6 caught mid-hop beside an ebony 12 it is about to take (6 : 12 = 1 : 2), gold leaf in the air, candlelight.
import * as THREE from '../vendor3d/three.js';
import { S, TOP, PH, sqPos, buildBoard, pieceGeos, pieceMaterials, numberMaterial, buildDesk, buildLights, radialTex } from './world.js';
import { mk, ROUND, TRI } from '../src/rules.js';

await document.fonts.load('700 40px "Cormorant Garamond"');
const W = 1024, renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, W); document.body.appendChild(renderer.domElement);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x120a08); scene.fog = new THREE.Fog(0x120a08, 60, 160);
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.4;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(2048, 2048);
L.sun.shadow.camera.left = -30; L.sun.shadow.camera.right = 30; L.sun.shadow.camera.top = 30; L.sun.shadow.camera.bottom = -30; L.sun.position.set(-40, 80, 30); L.sun.target.position.set(0, 0, 20);
const desk = buildDesk(scene); scene.add(buildBoard(2048));
const geos = pieceGeos(), mats = pieceMaterials();
const piece = (side, shape, val, x, y, z, rx = 0, rz = 0, yaw = side === 1 ? 0 : Math.PI) => {
  const g = new THREE.Group(), G = geos[shape];
  const b = new THREE.Mesh(G.body, mats[side]); b.castShadow = true; b.receiveShadow = true;
  const i = new THREE.Mesh(G.inlay, mats.gold); const d = new THREE.Mesh(G.decal, numberMaterial(side, val)); d.rotation.y = -yaw;
  g.add(b, i, d); g.position.set(x, y, z); g.rotation.set(rx, yaw, rz, 'YXZ'); scene.add(g); return g;
};
const at = (r, c) => sqPos(r * 8 + c);
const p12 = at(9, 3), p6 = at(10, 3);
piece(2, ROUND, 12, p12.x, TOP, p12.z);
piece(1, ROUND, 6, p6.x - 2.0, TOP + 3.6, p6.z + 0.4, 0.5, 0.2);
const back = [[7, 1, 2, TRI, 18], [7, 5, 2, ROUND, 9]];
for (const [r, c, s, sh, v] of back) { const p = at(r, c); piece(s, sh, v, p.x, TOP, p.z); }
// shadow blob under the hopping piece, gold flakes, a glow ring where it will land
const blob = new THREE.Mesh(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.7), transparent: true, depthWrite: false })); blob.position.set(p6.x - 1.2, TOP + 0.03, p6.z + 1.2); scene.add(blob);
const ring = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTex('255,200,90', 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); ring.position.set(p12.x, TOP + 0.05, p12.z); scene.add(ring);
const fm = new THREE.MeshStandardMaterial({ color: 0xf2cf6a, metalness: 1, roughness: 0.25, side: THREE.DoubleSide, envMapIntensity: 2.4 });
for (let k = 0; k < 16; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), fm); const a = k * 2.4; f.position.set(p12.x + Math.cos(a) * (2 + (k % 4)), TOP + PH + 1 + (k % 5) * 0.8, p12.z + Math.sin(a) * (1.5 + (k % 3))); f.rotation.set(a, a * 1.3, a * 0.7); scene.add(f); }
const cam = new THREE.PerspectiveCamera(30, 1, 1, 500);
cam.position.set(p12.x + 4.6, TOP + 17, p12.z + 16.4); cam.lookAt(p12.x - 1.2, TOP + 1.6, p12.z + 1.4);
// warm key from the candle side
const key = new THREE.PointLight(0xffb060, 900, 90, 2); key.position.set(p12.x - 9, TOP + 13, p12.z - 4); scene.add(key);
L.hemi.intensity = 0.25; L.sun.intensity = 1.5; scene.fog = new THREE.Fog(0x120a08, 30, 70);
const rimL = new THREE.PointLight(0xffd29a, 500, 60, 2); rimL.position.set(p12.x + 8, TOP + 6, p12.z - 10); scene.add(rimL);
void desk;
renderer.render(scene, cam);
document.title = 'ready';
