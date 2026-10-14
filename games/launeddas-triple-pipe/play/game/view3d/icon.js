// Offline app-icon render (developer tool): headless Chrome loads web/icon.html?size=2048, builds the hero scene from the SAME models
// the game uses (three bound cane pipes, the leather reservoir, the stone tower and low sun at dusk), renders it with bloom and a
// vignette and exposes window.__icon. No text, full-bleed square.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { buildPipes, buildBackdrop } from './models.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3; pm.dispose();
scene.add(new THREE.HemisphereLight(0xffd2a8, 0x2a1426, 0.35));
const key = new THREE.DirectionalLight(0xffc890, 1.0); key.position.set(-500, 700, 900); scene.add(key);
const rim = new THREE.DirectionalLight(0xff9a50, 1.5); rim.position.set(900, 150, -500); scene.add(rim);
const fill = new THREE.DirectionalLight(0x7aa6ff, 0.5); fill.position.set(-900, -200, 600); scene.add(fill);

const W = 720, H = 720, FOV = 34, D = (H / 2) / Math.tan((FOV / 2) * Math.PI / 180);
const camera = new THREE.PerspectiveCamera(FOV, 1, 20, 6000);
camera.position.set(W / 2, -H / 2, D); camera.lookAt(W / 2, -H / 2, 0);
const sAt = (z) => (D + Math.abs(z)) / D;
const place = (o, xv, yv, z) => { const s = sAt(z); o.position.set(W / 2 + (xv - W / 2) * s, -H / 2 + (H / 2 - yv) * s, z); };

const bd = buildBackdrop(); scene.add(bd);
const bo = bd.userData, hy = 600;
const sk = sAt(-1400), yTop = -H / 2 + (H / 2 + 0.12 * H) * sk, yHor = -H / 2 + (H / 2 - hy) * sk;
bo.sky.scale.set(W * sk * 1.2, yTop - yHor, 1); bo.sky.position.set(W / 2, (yTop + yHor) / 2, -1400);
bo.stars.scale.set(W * sk / 2 * 1.1, -(yTop - yHor) * 0.9 / 0.6, 1); bo.stars.position.set(W / 2, yTop - (yTop - yHor) * 0.12, -1390);
const sun = Math.max(W, H) * 1.2 * sAt(-1300);
bo.sun.scale.set(sun, sun, 1); place(bo.sun, W * 0.74, hy - 20, -1300);
bo.disc.scale.setScalar(52 * sAt(-1290)); place(bo.disc, W * 0.74, hy + 6, -1290);
bo.hills[0].scale.set(W * sAt(-1100) / 2 * 1.2, H * 0.34 * sAt(-1100), 1); place(bo.hills[0], W / 2, hy - 6, -1100);
bo.hills[1].scale.set(W * sAt(-700) / 2 * 1.2, H * 0.3 * sAt(-700), 1); place(bo.hills[1], W / 2, hy - 2, -700);
const tw = 190, th = tw * 1.5;
bo.tower.scale.set(tw * sAt(-240), th * sAt(-240), tw * sAt(-240)); place(bo.tower, 70, hy + 2, -240);
bo.tower2.scale.set(tw * 0.58 * sAt(-270), th * 0.6 * sAt(-270), tw * 0.58 * sAt(-270)); place(bo.tower2, 215, hy + 2, -270);
bo.ground.scale.set(W * 1.4, 400, 1); place(bo.ground, W / 2, hy + 200, -20);
// motes
const mp = bo.mote.geometry.attributes.position, sd = bo.mote.userData.seed;
for (let i = 0; i < bo.mote.userData.n; i++) mp.setXYZ(i, sd[i * 3] * W, -(40 + sd[i * 3 + 1] * (hy - 80)), 0);
mp.needsUpdate = true;

const pipes = buildPipes(); scene.add(pipes);
const k = 1.42; pipes.scale.set(k, k, k); pipes.position.set(W / 2 + 55, -(H / 2 + 5), 0);
pipes.rotation.y = -0.18; pipes.rotation.x = -0.05; pipes.rotation.z = 0.05;
const m = pipes.userData;
[0, 3].forEach((l) => { m.holes[l].lit.material.opacity = 0.95; m.holes[l].glow.material.opacity = 0.9; m.holes[l].glow.scale.setScalar(1.15); });
m.glow[0].material.opacity = 0.7; m.glow[2].material.opacity = 0.8;
m.rings.forEach((r, i) => { const ph = (i + 0.4) / 3.2; r.scale.setScalar(24 + ph * 80); r.material.opacity = (1 - ph) * 0.6; });
m.bag.scale.set(46, 44, 40); m.bag.position.set(0, -(326 - 46 * 0.35 - 190), 14); m.bagGlow.scale.setScalar(1);

const res = B.renderIcon({ scene, camera, size: SIZE, background: '#150d09', bloom: 0.28, vignette: 0.4, renderer, exposure: 0.85 });
void res;
