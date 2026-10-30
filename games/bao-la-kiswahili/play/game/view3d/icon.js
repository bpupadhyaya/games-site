// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a close, low-sun look at the brass-rimmed nyumba of a
// carved teak bao board, heaped with seeds, one seed in the air over the next pit with a trail of light. No text.
// Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { RIM, BOARD_Y, buildBoard, seedKit, seedSlot, tintOf, pitWorld, buildLights } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048), set = q.get('seeds') || 'cowries';
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.22;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096);
Object.assign(L.sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 20, far: 400 });
L.sun.position.set(-0.85, 0.34, 0.3).normalize().multiplyScalar(190); L.sun.intensity = 3.0; L.rim.intensity = 2.2; L.rim.color.set(0xffa860); L.hemi.intensity = 0.16; L.fill.intensity = 0.1;
const board = buildBoard(q.get('wood') || 'ebony', 2048); scene.add(board);
const kit = seedKit(set), put = (x, y, z, rot, tx, tz, v) => {
  const m = new THREE.Mesh(kit.geo, kit.mat.clone()); if (m.material.color) m.material.color.copy(tintOf(set, v)); m.position.set(x, y, z); m.rotation.set(tx, rot, tz, 'YXZ'); m.castShadow = true; m.receiveShadow = true; scene.add(m);
};
const N = pitWorld(0, 4), E = pitWorld(0, 5), W = pitWorld(0, 3);        // the nyumba (south player), its neighbours
const fill = (P, n, key) => { for (let k = 0; k < n; k++) { const s = seedSlot(key, k); put(P.x + s.x, BOARD_Y + s.y, P.z + s.z, s.rot, s.tx, s.tz, s.v); } };
fill(N, 17, 4); fill(E, 3, 5); fill(W, 2, 3);
// a seed in the air, dropping toward the next pit, with a fading streak of light behind it
const u = 0.5, from = { x: N.x + 1.2, y: BOARD_Y + RIM + 5.2, z: N.z - 0.2 }, to = { x: E.x - 0.4, y: BOARD_Y + RIM + 0.4, z: E.z };
const at = (t) => new THREE.Vector3(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t * t + Math.sin(Math.PI * t) * 1.6, from.z + (to.z - from.z) * t);
const jp = at(u); put(jp.x, jp.y, jp.z, 0.6, 0.3, -0.2, 1);
const pts = []; for (let i = 0; i <= 30; i++) pts.push(at(0.02 + (u - 0.08) * i / 30));
const tc = document.createElement('canvas'); tc.width = 256; tc.height = 4; const tg = tc.getContext('2d'), gr = tg.createLinearGradient(0, 0, 256, 0);
gr.addColorStop(0, 'rgba(255,190,100,0)'); gr.addColorStop(1, 'rgba(255,226,160,0.95)'); tg.fillStyle = gr; tg.fillRect(0, 0, 256, 4);
const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.18, 8), new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
const cam = new THREE.PerspectiveCamera(30, 1, 1, 900);
cam.position.set(N.x - 6.5, BOARD_Y + RIM + 12.5, N.z + 21); cam.lookAt(N.x + 2.4, BOARD_Y + RIM + 1.4, N.z - 0.5);
renderIcon({ scene, camera: cam, size, renderer, background: '#140b06', bloom: 0.2, vignette: 0.85, exposure: 0.5 });
