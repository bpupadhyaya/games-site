// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): one big cobalt enamel die (five up) and a marble and
// a wenge checker on the blue and cream lacquered points, in low island sun against deep night blue. No text.
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { pointGeom } from '../src/layout.js';
import { wx, wz, FY, radialTex, buildBoard, checkerKit, diceKit, buildLights } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x050c1c, 22, 46);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3;
const L = buildLights(scene); L.key.shadow.mapSize.set(4096, 4096);
scene.add(buildBoard(2));
const CK = checkerKit(), DK = diceKit();
const g = pointGeom(19), px = wx(g.edge + g.dir * 70), pz = wz(g.y);
const put = (s, x, z) => { const c = CK.make(); const M = CK.mats.marble[s]; c.children[0].material = M.body; c.children[1].material = M.top; c.position.set(x, FY, z); c.rotation.y = x; scene.add(c); return c; };
put(1, px - 5.6, pz + 1.2); put(0, px + 4.6, pz - 5.2); put(0, px + 5.0, pz - 5.3).position.y = FY + 0.8;
const die = DK.make(true); die.scale.setScalar(2.4);
die.quaternion.copy(DK.restQ(5, 1.1)); die.position.set(px, FY + 1.6 * 2.4 / 2, pz + 0.6); scene.add(die);
{ const b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9, 64), transparent: true, depthWrite: false, opacity: 0.75 })); b.rotation.x = -Math.PI / 2; b.scale.set(6.6, 6.6, 1); b.position.set(px + 0.5, FY + 0.02, pz + 0.9); scene.add(b); }
L.key.position.set(-34, 26, -8); L.key.intensity = 3.4; L.rim.intensity = 1.8; L.rim.position.set(30, 14, -40); L.hemi.intensity = 0.05; L.fill.intensity = 0.03; scene.environmentIntensity = 0.1;
const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
cam.position.set(px + 13, FY + 15, pz + 19); cam.lookAt(px - 0.4, FY + 1.5, pz - 0.6);
renderIcon({ scene, camera: cam, size, renderer, background: '#050c1c', bloom: 0.12, vignette: 0.8, exposure: 0.95 });
