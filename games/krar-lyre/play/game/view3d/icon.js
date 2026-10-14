// Offline app-icon render (developer tool, not part of the game): draws the SAME lyre the game uses (models.js) in a lit 3D scene, turned a little
// toward the viewer, in front of the same dawn, with depth of field on the backdrop, glow, vignette and sparkles. window.__icon() returns a PNG dataURL.
import * as THREE from '../vendor3d/three.js';
import { lyreFor } from '../src/layout.js';
import { buildMaterials, buildLyre, updateLyre, buildBackdrop, buildMat } from './models.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048), V = 1024;
const out = document.createElement('canvas'); out.width = out.height = SIZE; document.body.appendChild(out);
out.style.width = '1024px'; out.style.height = '1024px';
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const snap = () => { const c = document.createElement('canvas'); c.width = c.height = SIZE; c.getContext('2d').drawImage(gl, 0, 0); return c; };

// 1. backdrop (blurred later for depth of field)
const bd = buildBackdrop(); bd.update(7.3, V, V, { dim: 0 });
const oc = new THREE.OrthographicCamera(0, V, 0, -V, 1, 4000); oc.position.z = 1000;
renderer.setClearColor(0x07201e, 1); renderer.clear(); renderer.render(bd.scene, oc);
const backdrop = snap();

// 2. subject
const mats = buildMaterials();
const G = lyreFor(120, 36, 784, 952);
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.42; pm.dispose();
const pivot = new THREE.Group(); pivot.position.set(G.cx, -(G.barY + G.botY) / 2, 0); scene.add(pivot);
const lyre = buildLyre(G, mats), mat = buildMat(G, mats);
const inner = new THREE.Group(); inner.position.set(-pivot.position.x, -pivot.position.y, 0); inner.add(lyre.root, mat); pivot.add(inner);
pivot.rotation.y = Number(q.get('yaw') ?? -0.3); pivot.rotation.x = Number(q.get('pitch') ?? 0.06);
const vib = [0, 0.0, 0.55, 0, 0.8, 0, 0.35]; updateLyre(lyre, { vib, glow: 0.3, t: 1.234 }, 1.234);
const s = Math.max(G.W, G.H), c = pivot.position;
const key = new THREE.DirectionalLight(0xfff0d6, 2.2); key.position.set(c.x - s * 0.6, c.y + s * 0.8, s * 1.0); key.target.position.copy(c); key.castShadow = true;
Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 10, far: s * 4 }); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = 1.2; key.shadow.radius = 4;
const rim = new THREE.DirectionalLight(0xffb868, 3.0); rim.position.set(c.x + s * 0.9, c.y + s * 0.2, -s * 0.8); rim.target.position.copy(c);
const fill = new THREE.DirectionalLight(0x8fe8d0, 0.8); fill.position.set(c.x + s * 0.8, c.y - s * 0.2, s * 0.8); fill.target.position.copy(c);
scene.add(new THREE.HemisphereLight(0xfff0d0, 0x24352c, 0.42), key, key.target, rim, rim.target, fill, fill.target);
scene.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow || false; } });
const D = 2400, cam = new THREE.PerspectiveCamera((2 * Math.atan(V / 2 / D) * 180) / Math.PI, 1, 100, 6000);
cam.position.set(V / 2, -V / 2, D); cam.lookAt(V / 2, -V / 2, 0);
renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
const subject = snap();

// 3. composite
ctx.fillStyle = '#07201e'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.010}px)`; ctx.drawImage(backdrop, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
const g = ctx.createRadialGradient(SIZE * 0.5, SIZE * 0.5, SIZE * 0.05, SIZE * 0.5, SIZE * 0.5, SIZE * 0.55);
g.addColorStop(0, 'rgba(255,214,150,0.30)'); g.addColorStop(0.55, 'rgba(255,170,90,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.drawImage(subject, 0, 0);
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.012}px)`; ctx.globalAlpha = 0.3; ctx.drawImage(subject, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.4, SIZE / 2, SIZE / 2, SIZE * 0.78);
v.addColorStop(0, 'rgba(2,12,10,0)'); v.addColorStop(1, 'rgba(2,12,10,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const star = (x, y, r, a) => { ctx.save(); ctx.translate(x * SIZE, y * SIZE); ctx.globalAlpha = a; ctx.fillStyle = '#fff6dc'; ctx.beginPath();
  for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.18 : r; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); };
star(0.16, 0.18, SIZE * 0.026, 0.9); star(0.86, 0.26, SIZE * 0.018, 0.8); star(0.74, 0.1, SIZE * 0.012, 0.7);
window.__icon = () => out.toDataURL('image/png');
