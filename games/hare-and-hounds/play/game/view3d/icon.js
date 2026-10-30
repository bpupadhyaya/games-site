// Store icon, rendered from the game's own 3D world (icon.html, 1024 x 1024, opaque). One subject: the hare carving sitting up
// alert on its point of the oak board, ears high, lit from behind by the low autumn sun, a hound's carving soft in the haze behind.
import * as THREE from '../vendor3d/three.js';
import { TOP, pointW, buildBoard, buildClearing, buildLights, applyTheme, hareGeos, houndGeos, makePiece, pieceMats, radialTex } from './world.js';

const S = 1024, canvas = document.createElement('canvas'); canvas.width = canvas.height = S; document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(2); renderer.setSize(S / 2, S / 2, false); renderer.setSize(S, S, false); renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3;
const L = buildLights(scene, 'autumn'); applyTheme(scene, L, 'autumn');
scene.fog = new THREE.Fog(0x24180c, 40, 260); scene.background = new THREE.Color(0x24180c);
L.key.shadow.mapSize.set(4096, 4096); L.key.intensity = 0.8; L.key.position.set(90, 120, 60); L.rim.intensity = 7; L.rim.color.setHex(0xffb050); L.rim.position.set(-60, 50, -110); L.hemi.intensity = 0.4; L.fill.intensity = 0.25;
buildClearing(scene, 'autumn', 1);
scene.add(buildBoard(2048));
const mats = pieceMats();
const hp = pointW(5);
const hare = makePiece('H', await hareGeos('wild', 0.06), mats); hare.position.set(hp.x, TOP + 0.05, hp.z); hare.rotation.y = 0.41 - 1.05; scene.add(hare);
for (const e of hare.userData.ears) e.rotation.x = -0.25;
const hp2 = pointW(7), hound = makePiece('D', await houndGeos('wild', 0.08), mats); hound.position.set(hp2.x, TOP + 0.05, hp2.z); hound.rotation.y = Math.atan2(hp.x - hp2.x, hp.z - hp2.z); void hound;
scene.traverse((o) => { if (o.isMesh) o.castShadow = true; });
// warm halo of sun behind the hare
const glow = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ map: radialTex('255,200,120', 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
glow.position.set(hp.x - 22, TOP + 22, hp.z - 60); glow.scale.setScalar(0.75); glow.material.opacity = 0.75; scene.add(glow);
const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 2000);
cam.position.set(hp.x + 10.2, TOP + 5.2, hp.z + 22.5); cam.lookAt(hp.x - 0.6, TOP + 5.3, hp.z - 1);
glow.lookAt(cam.position);
// out-of-focus specks of sunlit leaves floating in the haze
for (let i = 0; i < 26; i++) { const r = (i * 0.618) % 1, q = (i * 0.383) % 1, m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex(i % 3 ? '255,190,110' : '255,230,170', 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.25 + 0.35 * q })); const d = 60 + 140 * r; m.position.set(hp.x - 70 + 150 * q, TOP + 5 + 50 * ((i * 0.27) % 1), hp.z - d); const sc = 2 + d * 0.035; m.scale.set(sc, sc, 1); m.lookAt(cam.position); scene.add(m); }
renderer.render(scene, cam);
// vignette + a touch of warm bloom
const out = document.createElement('canvas'); out.width = out.height = S; const x = out.getContext('2d');
x.drawImage(canvas, 0, 0);
x.globalCompositeOperation = 'screen'; x.filter = 'blur(18px)'; x.globalAlpha = 0.28; x.drawImage(canvas, 0, 0); x.filter = 'none'; x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
const g = x.createRadialGradient(S / 2, S * 0.45, S * 0.32, S / 2, S / 2, S * 0.76); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,8,0,0.6)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
canvas.replaceWith(out); out.style.cssText = 'display:block;width:1024px;height:1024px';
window.__icon = out.toDataURL('image/png'); window.__iconDone = true; document.title = 'icon done';
