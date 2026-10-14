// Offline app-icon render: the game's own 3D scene (reclining player, flicked stream, bronze stand) from a close camera. node tools/render-icon.mjs
import { THREE, board3d as B } from '../vendor3d/index.js';
import { buildWorld } from './world.js';
import { HAND } from '../src/sim.js';
const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true;
const world = await buildWorld({ renderer, tier: 'high', withExtras: false });
for (const d of world.decor) d.visible = false;
world.handles.kline.userData.headboard.visible = false; world.handles.bolster.visible = false;
const s = { x: 150, h: 92, r: 16, rm: 22 };
world.setTargets({ kind: 'stands', stands: [s] });
const drops = [];
for (let k = 0; k < 10; k++) { const t = 0.03 + k * 0.026, v = 515, a = 0.7; drops.push({ x: HAND.x + Math.cos(a) * v * t, y: HAND.y + Math.sin(a) * v * t - 490 * t * t, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 980 * t, size: 1.9 }); }
const fr = { charge: 0, snap: 0.7, tilt: 0.5, loaded: true, hand: { x: 0, y: 34 }, look: { x: 1.5, y: 1 }, drops, stands: [{ pose: { x: s.x, y: s.h, rot: 0.05 }, ring: 0, glow: 0 }] };
for (let i = 0; i < 20; i++) world.update(1 / 30, fr);
world.camera.aspect = 1;
world.setView({ ox: SIZE / 2, cx: 8, cy: 58, my: SIZE * 0.52, s: SIZE / 165 }, SIZE, SIZE, { shear: 0.17 });
renderer.setSize(SIZE, SIZE, false);
world.camera.updateProjectionMatrix = () => {};   // keep the oblique projection set by world.setView
B.renderIcon({ scene: world.scene, camera: world.camera, size: SIZE, renderer, background: '#120a06', bloom: 0.25, vignette: 0.45, exposure: 1.0 });
