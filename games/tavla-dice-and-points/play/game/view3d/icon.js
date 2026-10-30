// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): one big ivory die, three faces lit by the
// coffeehouse window, resting on the walnut tavla case at the edge of a veneer point, two checkers soft behind it. No text.
// Sets window.__icon() (PNG data URL) through board3d.renderIcon.
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { pointGeom } from '../src/layout.js';
import { wx, wz, FY, CT, radialTex, buildBoard, checkerKit, diceKit, buildRoom, buildLights } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x140b06, 40, 140);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3;
const L = buildLights(scene); L.key.shadow.mapSize.set(4096, 4096);
buildRoom(scene); scene.add(buildBoard(2));
const CK = checkerKit(), DK = diceKit();
const g = pointGeom(19), px = wx(g.edge + g.dir * 70), pz = wz(g.y);
const put = (s, x, z, y = FY) => { const c = CK.make(); const M = CK.mats.classic[s]; c.children[0].material = M.body; c.children[1].material = M.top; c.position.set(x, y, z); c.rotation.y = x; scene.add(c); return c; };
put(1, px - 4.2, pz - 4.6); put(1, px - 0.6, pz - 4.6); put(0, px + 3.2, pz - 4.4);
const die = DK.make(true); die.scale.setScalar(2.3);
die.quaternion.copy(DK.restQ(5, 1.2)); die.position.set(px, FY + 1.55 * 2.3 / 2, pz + 0.6); scene.add(die);
{ const b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9, 64), transparent: true, depthWrite: false, opacity: 0.75 })); b.rotation.x = -Math.PI / 2; b.scale.set(6.2, 6.2, 1); b.position.set(px + 0.5, FY + 0.02, pz + 0.9); scene.add(b); }
L.key.position.set(-34, 30, -6); L.key.intensity = 2.6; L.rim.intensity = 1.6; L.rim.position.set(30, 14, -40); L.hemi.intensity = 0.18; L.fill.intensity = 0.12; scene.environmentIntensity = 0.22;
const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
cam.position.set(px + 9, FY + 9.5, pz + 11.5); cam.lookAt(px - 0.6, FY + 1.5, pz - 0.6);
void CT;
renderIcon({ scene, camera: cam, size, renderer, background: '#160c06', bloom: 0.1, vignette: 0.78, exposure: 0.92 });
