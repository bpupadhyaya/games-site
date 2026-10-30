// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): close over the carved cedar board at dusk, a
// lacquered piece in the air leaping over a bone piece along a brass line, lit by the lantern beyond the frame. No text.
// Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { themeById } from '../src/art.js';
import { TOP, pointPos, buildBoard, pieceGeos, pieceMaterials, buildLights, radialTex } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const th = themeById('cedar');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x120a0c, 40, 110);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096); L.sun.intensity = 1.25; L.sun.position.set(-50, 60, -30); L.sun.position.set(-60, 70, -50); L.hemi.intensity = 0.12;
L.rim.intensity = 2.6; L.rim.color.set(0xffc890); L.rim.position.set(30, 25, -90);
const lamp = new THREE.PointLight(0xffa050, 700, 140, 1.5); lamp.position.set(-14, TOP + 22, -40); scene.add(lamp);
scene.add(buildBoard(th, 2048));
const geos = pieceGeos(), mats = pieceMaterials(th);
const put = (who, x, y, z, yaw = 0, tx = 0, tz = 0) => {
  for (const g of who === 2 ? [geos[2], geos.dia] : [geos[1]]) { const m = new THREE.Mesh(g, g === geos.dia ? mats.dia : mats[who]); m.position.set(x, y, z); m.rotation.set(tx, yaw, tz, 'YXZ'); m.castShadow = true; m.receiveShadow = true; scene.add(m); }
};
// the jumper leaves point 18 over 12 (bone) toward 6
const cells = { 12: 1, 7: 2, 2: 2, 11: 1, 16: 1, 8: 2 };
for (const [i, w] of Object.entries(cells)) { const p = pointPos(Number(i)); put(w, p.x, TOP, p.z, (i * 1.7) % 6.28); }
const a = pointPos(18), b = pointPos(6);
const arc = (u) => new THREE.Vector3(a.x + (b.x - a.x) * u, TOP + Math.sin(Math.PI * u) * 6.5, a.z + (b.z - a.z) * u);
const U = 0.5, j = arc(U);
put(2, j.x, j.y, j.z, 0.2, 0.3, -0.2);
// the path of the leap: a fading streak of warm light behind the piece
const pts = []; for (let i = 0; i <= 30; i++) pts.push(arc(0.04 + (U - 0.16) * i / 30));
const tc = document.createElement('canvas'); tc.width = 256; tc.height = 4; const tg = tc.getContext('2d'), gr = tg.createLinearGradient(0, 0, 256, 0);
gr.addColorStop(0, 'rgba(255,190,110,0)'); gr.addColorStop(1, 'rgba(255,224,150,0.9)'); tg.fillStyle = gr; tg.fillRect(0, 0, 256, 4);
const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
void (() => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.22, 8), new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
// a soft glow on the board where it will land
const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: radialTex('255,200,120', 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
glow.rotation.x = -Math.PI / 2; glow.position.set(b.x, TOP + 0.1, b.z); glow.material.opacity = 0.35; scene.add(glow);
// camera: low and close in front of the leap, looking along it
const cam = new THREE.PerspectiveCamera(32, 1, 1, 3000);
cam.position.set(j.x + 4.2, j.y + 3.2, j.z + 12.5); cam.lookAt(new THREE.Vector3(j.x - 0.2, j.y - 1.6, j.z - 2));
renderIcon({ scene, camera: cam, size, renderer, background: '#120a0c', bloom: 0.14, vignette: 0.7, exposure: 0.78 });
