// Offline app-icon render (developer tool, not part of the game): node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store
// Draws the SAME models the game uses (models.js): a pale beech disc mid-slide down the long board toward the brass-plated arches,
// a real hand just letting go of it, the brown-cafe table in soft focus with candle bokeh. Tilt-shift depth of field, bloom, vignette.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import * as V3D from '../vendor3d/index.js';
import { createHand } from './hand3d.js';
import { loadHandRig, poseHand } from './handrig.js';
import { buildBoard, buildWorld, makeDisc, softTex, WX, WZ, BOARD_HALF_X } from './models.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
await document.fonts.load("100px 'Dela Gothic One'").catch(() => {});
const out = document.createElement('canvas'); out.width = out.height = SIZE; out.style.cssText = 'width:1024px;height:1024px'; document.body.appendChild(out);
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const rig = B.lightingRig(scene, 'warmIndoor', { renderer, shadow: 4096, extent: 18, target: [0, 0, 0], fog: { near: 30, far: 90 },
  overrides: { bg: 0x120a06, fog: 0x1a0f08, hemiSky: 0xffe2b8, hemiGround: 0x3a2412, hemi: 0.3, key: 0xffd49a, keyI: 2.6, keyPos: [-10, 7, 7], fill: 0x9db4ff, fillI: 0.3, fillPos: [8, 6, 8], rim: 0xffa860, rimI: 2.6, rimPos: [5, 5, -14], exposure: 0.9, env: 0.45 } });
rig.key.shadow.camera.far = 60;
const lamp = new THREE.SpotLight(0xffd9a0, 520, 70, 0.62, 0.9, 1.7); lamp.position.set(0, 20, -4); lamp.target.position.set(0, 0, -1); scene.add(lamp, lamp.target);
B.createEnvironment(renderer, scene, { intensity: 0.5 });
const world = buildWorld({ fx: true }); scene.add(world.group); world.update(2.4, false, true);
world.setLayout(false);
const board = buildBoard(); scene.add(board);
for (let k = 0; k < 4; k++) { board.getObjectByName(`plate${k}`).rotation.x = 0.1; }
// a candle further back for warm bokeh, and a string of lights far behind
{ const bt = softTex('255,200,120', 1, 64);
  for (let i = 0; i < 18; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bt, color: i % 4 === 0 ? 0xffe9b0 : 0xffa24a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set(-14 + i * 1.7, 3.2 + Math.sin(i * 1.7) * 1.4, -30); sp.scale.setScalar(1.6 + (i % 3) * 0.9); scene.add(sp); } }

const put = (side, x, y, o = {}) => { const d = makeDisc(side); d.position.set(WX(x), o.lift ?? 0, WZ(y)); d.rotation.set(o.rx || 0, o.ry ?? 0.3, o.rz || 0); scene.add(d); return d; };
// the hero disc mid-slide with its powder wake; two more near the arches, one dark
put(0, 100, 222, { lift: 0.02, ry: 0.5 });
put(1, 40, 60, { ry: 1.1 }); put(0, 150, 100, { ry: 2.0 }); put(1, 122, 32, { ry: 0.2 });
{ const t = softTex('255,248,230', 0.9, 128);
  for (let i = 0; i < 16; i++) { const u = i / 15, sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0.4 * (1 - u), depthWrite: false })); sp.position.set(WX(104) + Math.sin(i * 1.7) * 0.25 * u, 0.12 + u * 0.2, WZ(225 + u * 110)); sp.scale.setScalar(0.6 + u * 1.4); scene.add(sp); } }
// the hand that has just let go
const hd = await loadHandRig(THREE, V3D, createHand, 0);
scene.add(hd.h.object, hd.sleeve);
hd.h.object.visible = true; hd.sleeve.visible = true;
hd.fingers = { thumb: 0.15, index: 0.02, middle: 0.02, ring: 0.05, pinky: 0.08, spread: 0.55, thumbOut: 0.7 };
poseHand(THREE, hd, new THREE.Vector3(WX(Number(q.get('hx') || 60)), Number(q.get('hh') || 1.5), WZ(Number(q.get('hy') || 300))), new THREE.Vector3(Number(q.get('hf') || 0.45), 0, -1).normalize(), 0.55, 1, 1 / 60, 40);

const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 36), 1, 0.5, 220);
const tgt = new THREE.Vector3(Number(q.get('tx') || 0.1), Number(q.get('ty') || 0.6), Number(q.get('tz') || -2.6));
cam.position.set(Number(q.get('cx') || 1.6), Number(q.get('cy') || 5.8), Number(q.get('cz') || 12.4)); cam.lookAt(tgt);
renderer.render(scene, cam);
const snap = document.createElement('canvas'); snap.width = snap.height = SIZE; snap.getContext('2d').drawImage(gl, 0, 0);

// ---- composite: tilt-shift depth of field (blurred copy under, sharp copy masked to a horizontal band), bloom, vignette, glints
ctx.fillStyle = '#1a0c08'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.016}px)`; ctx.drawImage(snap, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
{
  const sharp = document.createElement('canvas'); sharp.width = sharp.height = SIZE; const sx = sharp.getContext('2d');
  sx.drawImage(snap, 0, 0); sx.globalCompositeOperation = 'destination-in';
  const m = sx.createLinearGradient(0, 0, 0, SIZE); m.addColorStop(0, 'rgba(0,0,0,0.05)'); m.addColorStop(0.16, 'rgba(0,0,0,0.5)'); m.addColorStop(0.34, 'rgba(0,0,0,1)'); m.addColorStop(0.74, 'rgba(0,0,0,1)'); m.addColorStop(0.92, 'rgba(0,0,0,0.4)'); m.addColorStop(1, 'rgba(0,0,0,0.12)');
  sx.fillStyle = m; sx.fillRect(0, 0, SIZE, SIZE); ctx.drawImage(sharp, 0, 0);
}
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.016}px)`; ctx.globalAlpha = 0.16; ctx.drawImage(snap, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE * 0.5, SIZE * 0.34, SIZE / 2, SIZE / 2, SIZE * 0.78); v.addColorStop(0, 'rgba(14,4,0,0)'); v.addColorStop(1, 'rgba(14,4,0,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const star = (x, y, r, a) => { ctx.save(); ctx.translate(x * SIZE, y * SIZE); ctx.globalAlpha = a; ctx.fillStyle = '#fff4d0'; ctx.beginPath(); for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.16 : r; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); };
if (q.get('stars') === '1') { star(Number(q.get('s1x') || 0.5), Number(q.get('s1y') || 0.3), SIZE * 0.026, 0.8); }

const small = document.createElement('canvas'); small.width = small.height = 1024; const sm = small.getContext('2d'); sm.imageSmoothingQuality = 'high'; sm.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
void BOARD_HALF_X;
