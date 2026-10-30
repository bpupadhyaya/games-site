// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a low, close look along the near row of a carved dark
// acacia board, three pits heaped with seeds, the zig-zag carved band along the front edge, one seed in the air with a trail of light.
// No text. Sets window.__icon() (PNG data URL) and window.__iconJpeg().
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { RIM, BOARD_Y, PITS, buildBoard, seedKit, seedSlot, buildLights } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048), theme = q.get('theme') || 'acacia';
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.25;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096);
Object.assign(L.sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 20, far: 300 });
L.sun.position.set(-0.8, 0.42, 0.55).normalize().multiplyScalar(160); L.sun.intensity = 3.0; L.sun.color.set(0xffe2b8);
L.rim.intensity = 1.1; L.rim.color.set(0xffb070); L.hemi.intensity = 0.16; L.fill.intensity = 0.08;
const board = buildBoard(theme, 2048); scene.add(board);
const kit = seedKit(theme), put = (x, y, z, rot, tx, tz, v) => {
  const m = new THREE.Mesh(kit.geo, kit.mat.clone()); m.material.color.copy(kit.tint(v)); m.position.set(x, y, z); m.rotation.set(tx, rot, tz, 'YXZ'); m.castShadow = true; m.receiveShadow = true; scene.add(m);
};
const fill = (i, n) => { const P = PITS[i]; for (let k = 0; k < n; k++) { const s = seedSlot(i, k); put(P.x + s.x, BOARD_Y + s.y, P.z + s.z, s.rot, s.tx, s.tz, s.v); } };
fill(13, 5); fill(14, 15); fill(15, 7); fill(16, 3); fill(9, 4); fill(10, 2);
// a seed in the air over the next pit, with a fading streak of light behind it
const A = PITS[14], B = PITS[15], u = 0.55;
const from = { x: A.x + 1.0, y: BOARD_Y + RIM + 6.4, z: A.z }, to = { x: B.x - 0.3, y: BOARD_Y + RIM + 1.6, z: B.z };
const at = (t) => new THREE.Vector3(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t * t + Math.sin(Math.PI * t) * 2.2, from.z + (to.z - from.z) * t);
const jp = at(u); put(jp.x, jp.y, jp.z, 0.6, 0.3, -0.2, 2);
const pts = []; for (let i = 0; i <= 30; i++) pts.push(at(0.02 + (u - 0.07) * i / 30));
const tc = document.createElement('canvas'); tc.width = 256; tc.height = 4; const tg = tc.getContext('2d'), gr = tg.createLinearGradient(0, 0, 256, 0);
gr.addColorStop(0, 'rgba(255,200,110,0)'); gr.addColorStop(1, 'rgba(255,232,170,0.95)'); tg.fillStyle = gr; tg.fillRect(0, 0, 256, 4);
const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.2, 8), new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
const cam = new THREE.PerspectiveCamera(32, 1, 1, 900);
cam.position.set(A.x - 13, BOARD_Y + RIM + 19, A.z + 25); cam.lookAt(A.x + 3.4, BOARD_Y + RIM + 0.4, A.z - 2.2);
renderIcon({ scene, camera: cam, size, renderer, background: '#0a0d14', bloom: 0.2, vignette: 0.95, exposure: 0.5 });
