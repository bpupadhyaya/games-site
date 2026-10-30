// Offline app-icon render (developer tool, not part of the game): web/icon.html?size=2048 draws the SAME sky, bamboo grove, rotor and
// hands the game uses, with a shallow depth of field on the backdrop, glow and a vignette, and exposes the finished canvas as
// window.__icon (dataURL) for tools/render-icon.mjs.
import * as THREE from '../vendor3d/three.js';
import { createWorld, createSky, RIGS } from './world.js';
import { createToy, COPTER_SCALE } from './toy.js';
import { makeConditions, seeded } from '../src/sim.js';
import { PALS } from '../src/art.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048), SCENE = Number(q.get('scene') || 0), ROTOR = Number(q.get('rotor') || 0);
const out = document.createElement('canvas'); out.width = out.height = SIZE; out.style.width = out.style.height = '1024px'; document.body.appendChild(out);
const g2 = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = Number(q.get('exp') || 1.0);
renderer.autoClear = false; renderer.localClippingEnabled = true;
const pm = new THREE.PMREMGenerator(renderer);
const env = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose();

const snap = () => { const c = document.createElement('canvas'); c.width = c.height = SIZE; c.getContext('2d').drawImage(gl, 0, 0); return c; };

// ---- backdrop: the game's world seen from just above the grass
const worldScene = new THREE.Scene(); worldScene.environment = env;
const world = createWorld({ quality: 1 }); worldScene.add(world.group);
const sky = createSky();
const cond = makeConditions(SCENE, seeded(Number(q.get('seed') || 7)));
world.setScene(SCENE); world.setCond(cond);
const FIT = Number(q.get('fit') || 64), ppm = SIZE / FIT, g0 = 1.0, camY = g0 + Number(q.get('cy') || 7);
const ws = { cond, parts: [], f: null, cam: { x: Number(q.get('cx') || 0), y: camY } };
world.update(Number(q.get('t') || 3), ws, { x: ws.cam.x, y: ws.cam.y, sunX: 0 });
const hzRow = SIZE * Number(q.get('hz') || 0.62);
const fovV = 22, visH = SIZE / ppm, D = visH / 2 / Math.tan((fovV * Math.PI) / 360);
const wcam = new THREE.PerspectiveCamera(fovV, 1, 6, D + 3600);
wcam.position.set(ws.cam.x, ws.cam.y - (hzRow - SIZE / 2) / ppm, D); wcam.setViewOffset(SIZE, SIZE, 0, SIZE / 2 - hzRow, SIZE, SIZE); wcam.updateProjectionMatrix(); wcam.updateMatrixWorld(true);
worldScene.fog = new THREE.Fog(new THREE.Color(`rgb(${PALS[SCENE].haze})`), D + 60, D + 1500);
worldScene.environmentIntensity = RIGS[SCENE].env;
sky.setScene(SCENE); sky.mat.uniforms.uRes.value.set(SIZE, SIZE); sky.mat.uniforms.uT.value = 1; sky.mat.uniforms.uHorizon.value = hzRow / SIZE;
// put the sun behind the rotor
sky.mat.uniforms.uSun.value.set(Number(q.get('sx') || 0.5), Number(q.get('sy') || 0.34)); sky.mat.uniforms.uSunR.value = 0.075;
renderer.setClearColor(0x000000, 1); renderer.setViewport(0, 0, SIZE, SIZE); renderer.clear();
renderer.render(sky.scene, sky.cam); renderer.render(worldScene, wcam);
const backdrop = snap();

// ---- subject: rotor and two hands (first-person), transparent
const toyScene = new THREE.Scene(); toyScene.environment = env; toyScene.environmentIntensity = 0.4;
const toy = await createToy({ skin: q.get('skin') || 'tan' });
toyScene.add(toy.root);
const hemi = new THREE.HemisphereLight(0xfff2dc, 0x3a5a3a, 0.45), key = new THREE.DirectionalLight(0xffe2b0, 2.6), rim = new THREE.DirectionalLight(0x9fe0ff, 2.2), fill = new THREE.DirectionalLight(0xffd8b0, 0.6);
key.position.set(-3, 5, -3); rim.position.set(4, 4, 5); fill.position.set(3, 1, -4);
toyScene.add(hemi, key, rim, fill);
toy.pose({ rotor: ROTOR, rev: Number(q.get('rev') || 0.5), s: Number(q.get('s') || 0.9), tilt: 0, wob: 0.04, wobPh: 1.1, rub: Number(q.get('rub') || 0.3), press: 1, hands: 1, release: 0, t: 0, roll: 0 }, 1 / 30);
for (let i = 0; i < 6; i++) toy.pose({ rotor: ROTOR, rev: Number(q.get('rev') || 0.5), s: Number(q.get('s') || 0.9), tilt: 0, wob: 0.04, wobPh: 1.1, rub: Number(q.get('rub') || 0.3), press: 1, hands: 1, release: 0, t: 0, roll: 0 }, 1 / 30);
const tcam = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
const dir = new THREE.Vector3(Number(q.get('dx') || 0), Number(q.get('dy') || 0.58), Number(q.get('dz') || -0.81)).normalize();
const dist = Number(q.get('d') || 4.8), sizePx = SIZE * Number(q.get('span') || 0.64);
const fpx = (sizePx * dist) / COPTER_SCALE;
tcam.fov = (2 * Math.atan(SIZE / (2 * fpx)) * 180) / Math.PI; tcam.position.copy(dir).multiplyScalar(dist); tcam.lookAt(0, -0.25, 0); tcam.updateProjectionMatrix(); tcam.updateMatrixWorld(true);
const hubNdc = new THREE.Vector3(0, 0, 0).project(tcam);
const tx = Number(q.get('hx') || 0.5) * 2 - 1, ty = 1 - Number(q.get('hy') || 0.36) * 2;
tcam.projectionMatrix.elements[8] -= tx - hubNdc.x; tcam.projectionMatrix.elements[9] -= ty - hubNdc.y; tcam.projectionMatrixInverse.copy(tcam.projectionMatrix).invert();
renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(toyScene, tcam);
const subject = snap();

// ---- composite: blurred backdrop (depth of field), glow, subject, vignette
g2.fillStyle = '#000'; g2.fillRect(0, 0, SIZE, SIZE);
g2.save(); g2.filter = `blur(${Math.round(SIZE / 150)}px)`; g2.drawImage(backdrop, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); g2.restore();
// warm light behind the rotor
const sx = Number(q.get('sx') || 0.5) * SIZE, sy = Number(q.get('sy') || 0.34) * SIZE;
let gr = g2.createRadialGradient(sx, sy, SIZE * 0.02, sx, sy, SIZE * 0.62); gr.addColorStop(0, 'rgba(255,236,170,0.32)'); gr.addColorStop(0.4, 'rgba(255,196,110,0.08)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
g2.globalCompositeOperation = 'lighter'; g2.fillStyle = gr; g2.fillRect(0, 0, SIZE, SIZE); g2.globalCompositeOperation = 'source-over';
// subject shadow-lift: glow
g2.save(); g2.filter = `blur(${Math.round(SIZE / 60)}px)`; g2.globalAlpha = 0.16; g2.globalCompositeOperation = 'lighter'; g2.drawImage(subject, 0, 0); g2.restore();
g2.drawImage(subject, 0, 0);
gr = g2.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.35, SIZE / 2, SIZE / 2, SIZE * 0.78); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(2,10,6,0.55)');
g2.fillStyle = gr; g2.fillRect(0, 0, SIZE, SIZE);

window.__icon = () => out.toDataURL('image/png');
window.__iconJpeg = () => out.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
