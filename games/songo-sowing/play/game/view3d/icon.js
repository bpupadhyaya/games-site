// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a close, low look along the near row of the carved board,
// three houses heaped with glass trade beads, lamp light from the left, deep dark all round. No text. Sets window.__icon() / __iconJpeg().
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { TALL } from '../src/layout.js';
import { TOPY, toWorld, seedSlot, seedKit, buildBoard, buildSetting, buildLights } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048), wood = q.get('wood') || 'camwood', set = q.get('set') || 'glass';
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.22;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096);
Object.assign(L.sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 20, far: 300 });
L.sun.position.set(-0.75, 0.5, 0.45).normalize().multiplyScalar(160); L.sun.intensity = 2.4; L.sun.color.set(0xffd9a0);
L.rim.intensity = 1.5; L.rim.color.set(0xff9248); L.hemi.intensity = 0.12; L.fill.intensity = 0.05;
const board = buildBoard(TALL, wood, 2048); scene.add(board);
const set3 = buildSetting(scene, TALL, { quality: 1 }); set3.pl.intensity = 900; set3.motes.visible = false;
const kit = seedKit(set), put = (x, y, z, rot, tx, tz, v) => {
  const m = new THREE.Mesh(kit.geo, kit.mat.clone()); m.material.color.copy(kit.tint(v)); m.position.set(x, y, z); m.rotation.set(tx, rot, tz, 'YXZ'); m.castShadow = true; m.receiveShadow = true; scene.add(m);
};
const pitR = TALL.pitR * 0.1, P = (i) => { const p = TALL.pit(i); return toWorld(TALL, p.x, p.y); };
const fill = (i, n) => { const c = P(i); for (let k = 0; k < n; k++) { const s = seedSlot(i, k, pitR); put(c.x + s.x, s.y, c.z + s.z, s.rot, s.tx, s.tz, s.v); } };
for (let i = 0; i < 14; i++) fill(i, i === 9 ? 17 : i === 4 ? 8 : 5);
const A = P(9), B = P(8), u = 0.5, from = { x: A.x + 2.6, y: TOPY + 8.4, z: A.z + 0.6 }, to = { x: B.x, y: TOPY + 4.0, z: B.z };
const at = (t) => new THREE.Vector3(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t * t + Math.sin(Math.PI * t) * 2.6, from.z + (to.z - from.z) * t);
const jp = at(u); put(jp.x, jp.y, jp.z, 0.6, 0.3, -0.2, 2);
const pts = []; for (let i = 0; i <= 30; i++) pts.push(at(0.02 + (u - 0.07) * i / 30));
const tc = document.createElement('canvas'); tc.width = 256; tc.height = 4; const tg = tc.getContext('2d'), gr = tg.createLinearGradient(0, 0, 256, 0);
gr.addColorStop(0, 'rgba(255,200,110,0)'); gr.addColorStop(1, 'rgba(255,232,170,0.95)'); tg.fillStyle = gr; tg.fillRect(0, 0, 256, 4);
const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.24, 8), new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
const cam = new THREE.PerspectiveCamera(30, 1, 1, 900), yaw = -13 * Math.PI / 180, tilt = 47 * Math.PI / 180, dist = 162;
cam.position.set(Math.sin(yaw) * Math.cos(tilt) * dist + 3, Math.sin(tilt) * dist, Math.cos(yaw) * Math.cos(tilt) * dist + 3); cam.lookAt(3.2, 0, 3);
renderIcon({ scene, camera: cam, size, renderer, background: '#04080a', bloom: 0.3, vignette: 0.9, exposure: 0.6 });
