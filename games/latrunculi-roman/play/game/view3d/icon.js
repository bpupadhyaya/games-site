// Store icon, rendered from the game's own 3D world (icon.html): the Jet dux, close and low, on the marble tabula by lamp light,
// two ivory soldiers closing in from the sides out of focus. Sets window.__iconDone when the 1024 px frame is drawn.
import * as THREE from '../vendor3d/three.js';
import { FACE_Y, cellPos, buildBoard, pieceGeos, pieceMaterials, buildRoom, buildLights } from './world.js';

const S = 1024;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(S, S); document.body.appendChild(renderer.domElement);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0605); scene.fog = new THREE.Fog(0x080504, 26, 70);
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3;
const L = buildLights(scene); L.key.castShadow = true; L.key.shadow.mapSize.set(2048, 2048);
L.key.intensity = 0.6; L.fill.intensity = 0.0; L.hemi.intensity = 0.14; L.rim.intensity = 0.5;
const room = buildRoom(scene, { quality: 1 });
for (const f of room.flames) f.visible = false; for (const h of room.halos) h.visible = false;
scene.add(buildBoard('nero', false, 1024));
const g = pieceGeos(), m = pieceMaterials();
const put = (geo, mat, x, z, yaw = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, FACE_Y, z); o.rotation.y = yaw; o.castShadow = o.receiveShadow = true; scene.add(o); return o; };
// the ivory dux on e4 (square 36) with its gilt band, two jet soldiers closing in on d4 / f4 in the half-dark
const c = cellPos(36), l = cellPos(35), r = cellPos(37);
for (const [geo, mat] of [[g.dux, m[1]], [g.band, m.gold], [g.stud, m.gold]]) put(geo, mat, c.x, c.z, 0.3);
put(g.sol, m[2], l.x - 0.3, l.z + 0.2, 0.1); put(g.sol, m[2], r.x + 0.3, r.z - 0.1, 0.9);
// lamp light from behind right: a warm rim on the dome and a long pool of light on the black marble
const lampP = new THREE.Vector3(c.x + 16, FACE_Y + 7, c.z - 22);
const rimL = new THREE.PointLight(0xffa456, 380, 120, 1.5); rimL.position.copy(lampP); scene.add(rimL);
const keyL = new THREE.SpotLight(0xffd7a0, 420, 80, 0.42, 0.8, 1.4); keyL.position.set(c.x - 10, FACE_Y + 28, c.z + 14); keyL.target.position.set(c.x, FACE_Y, c.z); keyL.castShadow = true; scene.add(keyL, keyL.target);
// the lamp itself, out of focus far behind: a soft warm disc
const bokeh = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.35, 'rgba(255,170,80,0.75)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const cam = new THREE.PerspectiveCamera(32, 1, 1, 1000);
cam.position.set(c.x - 7.2, FACE_Y + 7.4, c.z + 12.2); cam.lookAt(c.x + 1.6, FACE_Y + 1.3, c.z - 2.2);
const bk = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: bokeh, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
bk.position.set(c.x + 12, FACE_Y + 8.5, c.z - 26); bk.quaternion.copy(cam.quaternion); scene.add(bk);
renderer.render(scene, cam);
// vignette in 2D on top
const out = document.createElement('canvas'); out.width = out.height = S; const x = out.getContext('2d');
x.drawImage(renderer.domElement, 0, 0);
const v = x.createRadialGradient(S * 0.5, S * 0.46, S * 0.3, S * 0.5, S * 0.5, S * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
x.fillStyle = v; x.fillRect(0, 0, S, S);
renderer.domElement.remove(); document.body.appendChild(out); out.id = 'icon';
window.__iconDone = true;
