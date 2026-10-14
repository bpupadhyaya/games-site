// Offline app-icon render (developer tool, not part of the shipped game flow): builds the lienzo scene at dusk with the real charro,
// the shared horse3d and the rope, then board3d.renderIcon() writes store/icon.png + icon.svg (see platform/view3d/tools/render-icon.mjs).
import { createStage, THREE, board3d as B } from '../vendor3d/index.js';
import { createHorse } from './horse.js';
import { createCharroRig } from './charro.js';
import { createLasso } from './rope.js';
import { buildGround, contactShadow, paintSky } from './scenery.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const px = Number(q.get('px') || 0.0), cam = (q.get('cam') || '').split(',').map(Number);
const canvas = document.getElementById('c');
const stage = createStage({ canvas, quality: 'high', dprCap: 1, transparent: false, shadows: true, lighting: 'evening', shadowSize: 9, fov: 34 });
const { scene, camera, renderer } = stage;
const L = stage.lights;
L.hemi.color.set('#ffd9b0'); L.hemi.groundColor.set('#6a4a30'); L.hemi.intensity = 0.32;
L.key.color.set('#ffb766'); L.key.intensity = 4.8;
L.rim.color.set('#9fb8ff'); L.rim.intensity = 1.1;
stage._shadowOffset = new THREE.Vector3(-8, 5.5, 6);
if (scene.environment) scene.environmentIntensity = 0.16;
const sh = L.key.shadow; if (sh) { Object.assign(sh.camera, { left: -6, right: 6, top: 4, bottom: -4, near: 1, far: 40 }); sh.camera.updateProjectionMatrix(); sh.mapSize.set(4096, 4096); }

// backdrop: the same painted dusk sky + sierra as the arena, on a distant billboard (wide field of view, so no photo is magnified)
const bgCv = document.createElement('canvas'); bgCv.width = 2048; bgCv.height = 1024;
paintSky(bgCv.getContext('2d'), 2048, 1024, 1024 * 0.62, 1024 * 0.62);
{ const g = bgCv.getContext('2d'); g.globalCompositeOperation = 'soft-light'; const w = g.createLinearGradient(0, 0, 0, 640); w.addColorStop(0, 'rgba(255,120,70,0.75)'); w.addColorStop(1, 'rgba(255,200,120,0.5)'); g.fillStyle = w; g.fillRect(0, 0, 2048, 700); g.globalCompositeOperation = 'source-over'; }
const bgTex = new THREE.CanvasTexture(bgCv); bgTex.colorSpace = THREE.SRGBColorSpace;
const bg = new THREE.Mesh(new THREE.PlaneGeometry(240, 120), new THREE.MeshBasicMaterial({ map: bgTex, toneMapped: false, fog: false }));
bg.position.set(0, 1.15 + 0.12 * 120, -90); scene.add(bg);
scene.fog = new THREE.Fog('#f2b98a', 14, 120);
const scen = { update() {} };
const ground = buildGround(); ground.position.set(0, 0, -2.5); scene.add(ground);
{ const far = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), new THREE.MeshBasicMaterial({ color: '#e0b27e', fog: true })); far.rotation.x = -Math.PI / 2; far.position.set(0, -0.02, -150); scene.add(far); }

const horse = await createHorse({ quality: 'high' });
horse.root.position.set(1.9, 0, -1.7); horse.root.rotation.y = Math.PI;       // runs toward the left of the icon
scene.add(horse.root);
horse.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
for (let i = 0; i < 150; i++) horse.update({ dt: 1 / 60, speed: i < 90 ? Math.min(8.5, i * 0.12) : 8.5, head: 0 });
{ const cs = contactShadow(2.6, 0.9, 0.55); cs.position.set(1.8, 0.004, -1.7); scene.add(cs); }

const rig = await createCharroRig();
stage.add(rig.human);
rig.human.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
const yaw = Math.PI / 2 - 0.55;
rig.place(-0.55, 1.3, yaw);
for (let i = 0; i < 4; i++) rig.pose({ arm: -1.25, lean: 0.0, step: 0, crouch: 0, circle: 1 }, 0.3 + i * 0.016, 0.016);
{ const cs = contactShadow(0.9, 0.5, 0.6); cs.position.set(-0.55, 0.004, 1.3); scene.add(cs); }

const lasso = createLasso({ quality: 'high' }); scene.add(lasso.root); lasso.setScale(40);
const hand = rig.hand(new THREE.Vector3());
const neck = horse.neckPoint(new THREE.Vector3());
lasso.update([{ type: 'flight', u: 0.78, size: 0.8, spin: 0.6, target: neck, caught: true, axis: new THREE.Vector3(-0.6, 0.6, 0.2).normalize() }], hand, 0.4, { yaw, charro: { x: -0.55, z: 1.3 }, gate: 0 });

const c = cam.length === 3 && cam.every(Number.isFinite) ? cam : [0.55, 1.1, 4.9];
camera.fov = 50; camera.near = 0.5; camera.far = 400;
camera.position.set(c[0], c[1], c[2]); camera.lookAt(0.5 + px, 1.2, 0);
camera.updateProjectionMatrix();
scen.update(0, camera);
B.renderIcon({ scene, camera, size, renderer, background: '#1a1030', bloom: 0.18, vignette: 0.42, exposure: 0.95 });
