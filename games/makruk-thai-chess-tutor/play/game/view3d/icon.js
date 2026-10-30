// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): the gilded Ma (the carved horse head, the most
// recognisable makruk piece) lifted just above the jade-and-gold board, the Ruby Khun standing dark behind it, lit from behind by
// the dusk window. The rest of the board falls away soft. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { TOP, sqPos, buildBoard, buildLights, makePieceSlot, dressPiece } from './world.js';
import { startBoard } from '../src/rules.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x120a06, 24, 90);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.18;
const L = buildLights(scene); L.key.castShadow = true; L.key.shadow.mapSize.set(4096, 4096);
L.key.position.set(-30, 40, 50); L.key.intensity = 1.2; L.rim.position.set(20, 50, -60); L.rim.intensity = 1.2; L.fill.intensity = 0.25; L.hemi.intensity = 0.14; L.lamp.intensity = 0;
const spot = new THREE.SpotLight(0xffe6c0, 650, 90, 0.2, 0.8, 2); spot.position.set(-16, TOP + 24, 34); scene.add(spot, spot.target);
L.key.shadow.camera.left = -40; L.key.shadow.camera.right = 40; L.key.shadow.camera.top = 40; L.key.shadow.camera.bottom = -40;
scene.add(buildBoard('jade', false, 2048));
// a warm glow far behind
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 120, 8, 128, 128, 150); g.addColorStop(0, '#7a4a22'); g.addColorStop(0.3, '#2a140a'); g.addColorStop(0.7, '#0a0504'); g.addColorStop(1, '#080402'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(260, 200), new THREE.MeshBasicMaterial({ map: t, fog: false })); bd.position.set(0, 40, -90); scene.add(bd);
}
const put = (p, x, y, z, yaw = 0, tx = 0, tz = 0, sc = 1) => { const g = makePieceSlot(); dressPiece(g, p); g.position.set(x, y, z); g.rotation.set(tx, yaw, tz, 'YXZ'); g.scale.setScalar(sc); g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(g); };
const b = startBoard(), hero = 5 + 8 * 0 + 0;   // Ma on f1? the gold Ma starts on b1 / g1: square 6 (g1) is the right-hand one
for (let s = 0; s < 64; s++) if (b[s] && s !== 6 && s > 7) { const p = sqPos(s, false); put(b[s], p.x, TOP, p.z, (s * 0.37) % 0.1 - 0.05); }
const home = sqPos(6, false);
put(b[1], sqPos(1, false).x, TOP, sqPos(1, false).z, 0.02);
for (const s of [0, 2, 3, 4, 5, 7]) { const p = sqPos(s, false); put(b[s], p.x, TOP, p.z, 0.03); }
spot.target.position.set(home.x, TOP + 2, home.z);
put(4, home.x - 0.6, TOP + 2.4, home.z - 0.2, 0.35, 0.28, -0.05, 1.55);
const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
cam.position.set(home.x - 4, TOP + 12, home.z + 27); cam.lookAt(home.x - 0.6, TOP + 3.4, home.z - 2.0);
renderIcon({ scene, camera: cam, size, renderer, background: '#120a06', bloom: 0.18, vignette: 0.85, exposure: 0.62 });
void hero;
