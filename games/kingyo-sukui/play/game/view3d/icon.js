// Offline app-icon render (developer tool): the SAME stall, goldfish, poi and hand the game uses, close up, with depth of field,
// bloom and a vignette. Exposes window.__icon for tools/render-icon.mjs.
import * as THREE from '../vendor3d/three.js';
import { buildStall, applyLook } from './stall.js';
import { createFish } from './fish.js';
import { createPoi } from './poi.js';
import { createPoiHand } from './hand.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; document.body.appendChild(out);
out.style.width = '1024px'; out.style.height = '1024px';
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = Number(q.get('exp') || 1.05);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45; pm.dispose();
const stall = buildStall({ tier: 2 });
scene.add(stall.root);
const L = applyLook(stall, Number(q.get('look') || 2));
renderer.setClearColor(L.bg, 1); scene.fog = new THREE.Fog(L.fog, 3, 9);
stall.key.castShadow = true; stall.key.shadow.mapSize.set(4096, 4096);
Object.assign(stall.key.shadow.camera, { left: -0.4, right: 0.4, top: 0.4, bottom: -0.4 });
stall.key.position.set(-0.5, 1.6, 0.7); stall.key.target.position.set(0, 0, 0);
stall.waterMat.uniforms.uTime.value = 3.1; stall.causMat.uniforms.uTime.value = 3.1;
stall.waterMat.uniforms.uKeyDir.value.copy(stall.key.position);
stall.lanterns.slice(0, 3).forEach((g, i) => { stall.lp[i].copy(g.position); stall.lc[i].setRGB(1, 0.6, 0.3).multiplyScalar(0.6); });
// the tub is shifted so the subject sits near the middle of the frame
const fishes = [];
const place = (k, x, z, h, len, ph, y = -0.05) => { const f = createFish(k, 2); f.pose(len, ph, 0.3, 0); f.group.position.set(x, y, z); f.group.rotation.y = -h; scene.add(f.group); fishes.push(f); return f; };
place(1, -0.07, -0.1, 2.5, 0.1, 1.0); place(0, 0.12, -0.05, 0.4, 0.092, 2.2); place(4, -0.15, 0.1, -2.2, 0.085, 0.4); place(5, 0.16, 0.14, 3.6, 0.1, 1.5); place(3, 0.02, -0.2, 1.6, 0.09, 2.7);
// the poi lifts a calico goldfish out of the water, paper soaked and sagging
const poi = createPoi(); scene.add(poi.group);
poi.set(0.8, 0.9, 0.55, 3, 1);
poi.group.position.set(0.0, 0.07, 0.02); poi.group.rotation.set(0, 0.2, 0); poi.group.rotateX(-0.28);
poi.group.updateMatrixWorld(true);
poi.paper.renderOrder = 3;
const carried = createFish(1, 2); carried.pose(0.095, 1.7, 0.5, 1); scene.add(carried.group);
{ const p = new THREE.Vector3(0.004, -0.012, 0.0); poi.group.localToWorld(p); carried.group.position.copy(p); carried.group.rotation.set(0.1, -0.6, 0.3); }
// water drops falling from the paper
const dm = new THREE.MeshStandardMaterial({ color: 0xdff4ff, roughness: 0.05, transparent: true, opacity: 0.8 });
for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.003 + (i % 3) * 0.0012, 10, 8), dm); s.position.set(-0.06 + i * 0.016, 0.05 - (i % 4) * 0.018, 0.04 + Math.sin(i) * 0.04); scene.add(s); }
// rings on the water under the poi
stall.rip[0].set(0.0, 0.02, 0.25, 1.2); stall.rip[1].set(0.01, 0.0, 0.5, 1.0); stall.rip[2].set(-0.02, 0.05, 0.1, 0.8);

const hand = await createPoiHand(scene, { skin: 'light' });
const gp = new THREE.Vector3(0, 0, 0.0); poi.group.localToWorld(gp.set(0, 0.012, 0.074 + 0.13));
const dir = new THREE.Vector3(0, 0, 1);
for (let i = 0; i < 6; i++) hand.update(gp, dir, true, 0.2, 0);
hand.setShadow(true);

const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 34), 1, 0.02, 30);
const tgt = new THREE.Vector3(Number(q.get('tx') || 0.0), Number(q.get('ty') || 0.03), Number(q.get('tz') || 0.07));
const yaw = Number(q.get('yaw') || 3.45), pitch = Number(q.get('pitch') || 0.5), dist = Number(q.get('dist') || 0.5);
cam.position.set(tgt.x + Math.sin(yaw) * Math.cos(pitch) * dist, tgt.y + Math.sin(pitch) * dist, tgt.z + Math.cos(yaw) * Math.cos(pitch) * dist);
cam.lookAt(tgt);
function render() {
  renderer.setViewport(0, 0, SIZE, SIZE); renderer.clear(true, true, true); renderer.render(scene, cam);
  const c = document.createElement('canvas'); c.width = c.height = SIZE; c.getContext('2d').drawImage(gl, 0, 0); return c;
}
const sharp = render();
ctx.fillStyle = '#10103a'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.012}px)`; ctx.drawImage(sharp, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
const m = document.createElement('canvas'); m.width = m.height = SIZE; const mx = m.getContext('2d');
mx.drawImage(sharp, 0, 0); mx.globalCompositeOperation = 'destination-in';
const mg = mx.createRadialGradient(SIZE * 0.5, SIZE * 0.5, SIZE * 0.28, SIZE * 0.5, SIZE * 0.5, SIZE * 0.62);
mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(0.65, 'rgba(0,0,0,0.9)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
mx.fillStyle = mg; mx.fillRect(0, 0, SIZE, SIZE);
ctx.drawImage(m, 0, 0);
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.014}px)`; ctx.globalAlpha = 0.22; ctx.drawImage(sharp, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.4, SIZE / 2, SIZE / 2, SIZE * 0.78);
v.addColorStop(0, 'rgba(8,6,30,0)'); v.addColorStop(1, 'rgba(8,6,30,0.5)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
window.__icon = () => out.toDataURL('image/png');
document.title = 'ready';
