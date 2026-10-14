// Offline app-icon render (developer tool, not part of the game): headless Chrome loads web/icon.html?size=2048. It builds a hero scene
// from the SAME models the game uses (the lead husky and the team charging under the aurora, the sled behind) and exposes window.__icon().
import { THREE } from '../vendor3d/index.js';
import { prepLeg } from '../src/sim.js';
import { RACES, DOGS } from '../src/consts.js';
import { buildWorld, groundY } from './world.js';
import { makeDog } from './dog.js';
import { makeSled } from './sled.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3; pm.dispose();
const world = buildWorld({ quality: 'high' }); scene.add(world.group);
const L = prepLeg({ ...RACES[1].legs[0], hill: 0 }, 0);
world.setLeg(L, 0, { isLast: true });
const key = new THREE.DirectionalLight(0xbfd2ff, 2.4); key.position.set(10, 12, 14); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 }); key.shadow.bias = -0.0004;
const rim = new THREE.DirectionalLight(0x7affd8, 1.0); rim.position.set(-10, 6, -12);
const hemi = new THREE.HemisphereLight(0x7a96e8, 0x1a2848, 0.9);
const warm = new THREE.PointLight(0xffa860, 26, 14, 1.6); warm.position.set(43.2, 1.8, 3.4);
scene.add(key, key.target, rim, hemi, warm);
world.applyLook(0, 'clear', { scene, key, hemi, rim, keyDir: new THREE.Vector3(), set exposure(v) { renderer.toneMappingExposure = v; } });
key.position.set(48, 5, 7); key.intensity = 3.0; key.color.set('#ffd2a0'); hemi.intensity = 0.55; hemi.color.set('#ffd8e8'); hemi.groundColor.set('#8fa6d8'); rim.color.set('#9fc4ff'); rim.intensity = 1.3; rim.position.set(30, 5, -10); renderer.toneMappingExposure = 0.95; warm.intensity = 0;
const u = world.skyMat.uniforms; u.uTime.value = 7; u.sunDir.value.set(0.55, 0.16, -0.8).normalize();
world.snow.visible = false;
// the team: lead pair large in the foreground in a gallop, the rest behind
const place = (i, x, z, ph) => {
  const d = makeDog(DOGS[i], { harness: '#e0683a' }); d.root.position.set(x, groundY(L, x), z); d.root.rotation.y = 0.0; scene.add(d.root);
  d.update({ v: 9, phase: ph, pose: 'run', e: 0.9, t: 0, dt: 0.016, ph0: i, happy: true });
  return d;
};
const lead = place(0, 40, 0.3, 0.18); place(1, 37.4, -0.9, 0.42); place(2, 34.4, 0.1, 0.6);
lead.root.scale.setScalar(1.0);
const sled = makeSled(); sled.position.set(31.5, groundY(L, 31.5), 0); scene.add(sled);
const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 2400);
cam.position.set(43.6, 0.8, 3.4); cam.lookAt(40.45, 0.95, 0); cam.fov = 32; cam.updateProjectionMatrix();
key.target.position.set(40, 0, 0);
world.sky.position.copy(cam.position);
renderer.render(scene, cam);
const out = document.createElement('canvas'); out.width = out.height = 1024;
const c = out.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(cv, 0, 0, 1024, 1024);
const vg = c.createRadialGradient(512, 512, 330, 512, 512, 740); vg.addColorStop(0, 'rgba(4,10,30,0)'); vg.addColorStop(1, 'rgba(4,10,30,0.55)'); c.fillStyle = vg; c.fillRect(0, 0, 1024, 1024);
document.body.appendChild(out); out.style.width = '512px';
window.__icon = () => out.toDataURL('image/png');
document.title = 'ready';
