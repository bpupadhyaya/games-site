// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): the green Cho general (楚), the biggest tile of a
// janggi set, held up just above its palace as it is about to be put down, lit from behind by the daylight of the paper doors.
// The board and the other pieces fall away soft behind it. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { TOP, sqPos, pieceGeo, pieceFaceMat, buildBoard, buildLights } from './world.js';
import { startBoard } from '../src/rules.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
await Promise.race([document.fonts.load('700 40px "Janggi Serif"', '楚漢士象馬車包卒兵將棋'), new Promise((r) => setTimeout(r, 3000))]);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x3a200e, 22, 95);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.12;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096);
L.sun.position.set(-40, 45, -60); L.sun.intensity = 1.0; L.rim.position.set(25, 22, -80); L.rim.intensity = 3.4; L.fill.intensity = 0.35; L.fill.position.set(-20, 30, 90); L.hemi.intensity = 0.16;
// a warm key on the hero piece only (a lamp-like spot from the front left)
const key = new THREE.SpotLight(0xffd9a0, 700, 80, 0.14, 0.85, 2); key.position.set(-14, TOP + 26, 30); scene.add(key, key.target);
L.sun.shadow.camera.left = -40; L.sun.shadow.camera.right = 40; L.sun.shadow.camera.top = 40; L.sun.shadow.camera.bottom = -40;
scene.add(buildBoard('hanji', 'ko', 2048));
// the glow of the paper doors far behind: a soft blurred lattice
{
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
  const g = x.createRadialGradient(256, 230, 20, 256, 256, 330); g.addColorStop(0, '#ffe7b8'); g.addColorStop(0.4, '#c77a34'); g.addColorStop(1, '#1e0e06'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i++) { const bx = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * 512, by = 60 + (Math.sin(i * 78.233) * 12345.678 % 1 + 1) % 1 * 300, br = 10 + (i % 5) * 7; const bg = x.createRadialGradient(bx, by, 0, bx, by, br); bg.addColorStop(0, 'rgba(255,226,170,0.55)'); bg.addColorStop(0.7, 'rgba(255,200,120,0.25)'); bg.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = bg; x.beginPath(); x.arc(bx, by, br, 0, Math.PI * 2); x.fill(); }
  x.filter = 'blur(7px)'; x.strokeStyle = 'rgba(70,36,14,0.55)'; x.lineWidth = 9;
  for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 512); x.stroke(); }
  for (let j = 1; j < 8; j++) { x.beginPath(); x.moveTo(0, j * 64); x.lineTo(512, j * 64); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(260, 200), new THREE.MeshBasicMaterial({ map: t, fog: false }));
  bd.position.set(0, 40, -90); scene.add(bd);
}
const put = (p, x, y, z, yaw = 0, tx = 0, tz = 0) => { const m = new THREE.Mesh(pieceGeo(Math.abs(p)), pieceFaceMat(p, 'boxwood', 'ko', 1024)); m.position.set(x, y, z); m.rotation.set(tx, yaw, tz, 'YXZ'); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
const b = startBoard('inner', 'inner');
for (let s = 0; s < 90; s++) if (b[s] && s !== 85 && s < 72) { const p = sqPos(s); put(b[s], p.x, TOP, p.z, (s * 0.37) % 0.08 - 0.04); }
// the hero: the Cho general lifted over its palace, face turned to us
const home = sqPos(85); key.target.position.set(home.x, TOP + 2, home.z);
put(1, home.x + 0.4, TOP + 2.6, home.z - 0.6, 0.12, 0.78, -0.1);
const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
cam.position.set(home.x + 2.2, TOP + 7.2, home.z + 14.5); cam.lookAt(home.x + 0.3, TOP + 3.0, home.z - 1.2);
renderIcon({ scene, camera: cam, size, renderer, background: '#2a160a', bloom: 0.22, vignette: 0.7, exposure: 0.74 });
