// Offline app-icon render (developer tool, not part of the game): headless Chrome loads web/icon.html?size=2048. It builds a hero
// scene from the SAME models the game uses (a great white goose on the gilded Garden, dice, a pawn, the spiral board, candlelit table),
// renders it with shadows, composites a blurred candle-bokeh backdrop (depth of field), bloom and vignette, and exposes window.__icon.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { drawBoard } from '../src/boardview.js';
import { drawTile } from '../src/art.js';
import { SPOT, TILE_W, TILE_H, GARDEN_R } from '../src/board.js';
import { FINAL, kindOf } from '../src/engine.js';
import { makeGoose, poseGoose, makePawn, makeProp, MAT } from './models.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
await document.fonts.load('700 40px Cinzel').catch(() => {});
const RW = 4.55, TILE_TOP = 0.095, TAU = Math.PI * 2;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

const gl = cv(SIZE);
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = Number(q.get('exp') || 0.62);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.22; pm.dispose();
const key = new THREE.DirectionalLight(0xffd9a0, 0.45); key.position.set(-5, 8, 7); key.castShadow = true;
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 }); key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
const rim = new THREE.DirectionalLight(0x7fe6d8, 2.6); rim.position.set(6, 5, -8);
const rim2 = new THREE.DirectionalLight(0xfff0d0, 1.2); rim2.position.set(-7, 4, -6);
const fill = new THREE.DirectionalLight(0xb8c8ff, 0.5); fill.position.set(7, 3, 6);
scene.fog = new THREE.Fog(0x1a0d05, Number(q.get('fogN') || 9), Number(q.get('fogF') || 17));
scene.add(new THREE.HemisphereLight(0xffe6c8, 0x3a2412, 0.12), key, key.target, rim, rim2, fill);
const warm = new THREE.PointLight(0xffa860, 6, 12, 1.5); warm.position.set(-3.5, 3.0, 3.2); scene.add(warm);
const spot = new THREE.SpotLight(0xffe2b0, 330, 0, 0.62, 0.85, 2); spot.position.set(-3.2, 8.5, 5.2); spot.target.position.set(0.4, 0.6, 0.4); spot.castShadow = true; spot.shadow.mapSize.set(4096, 4096); spot.shadow.bias = -0.0003; spot.shadow.normalBias = 0.03; scene.add(spot, spot.target);

// table + board
const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), B.material('darkWood', { color: '#2a170c', color2: '#4a2c16', repeat: [6, 6], seed: 11 }));
table.material.color.set('#8a6a52'); table.rotation.x = -Math.PI / 2; table.position.y = -0.3; table.receiveShadow = true; scene.add(table);
const HALF = 5.7, PLATE = 10;
const base = new THREE.Mesh(B.slab(HALF * 2 + 0.7, HALF * 2 + 0.7, 0.3, 0.3, 0.08), B.material('darkWood', { color: '#34200f', color2: '#573419', repeat: [2, 2], seed: 21 })); base.position.y = -0.3; base.receiveShadow = true; scene.add(base);
const plateC = cv(2048); { const x = plateC.getContext('2d'); drawBoard(x, { x: 0, y: 0, w: 2048, h: 2048 }, { base: true, noNumbers: true, bare: true, t: 0 }); }
const plate = new THREE.Mesh(new THREE.PlaneGeometry(PLATE, PLATE), new THREE.MeshStandardMaterial({ map: tex(plateC), color: '#6f5738', roughness: 0.82 }));
plate.rotation.x = -Math.PI / 2; plate.position.y = 0.004; plate.receiveShadow = true; scene.add(plate);
const tileGeo = B.slab(TILE_W * RW * 0.97, TILE_H * RW * 0.97, TILE_TOP, 0.1, 0.03);
for (let n = 1; n < FINAL; n++) {
  const kind = kindOf(n), W = 192, c = cv(W), x = c.getContext('2d');
  drawTile(x, n, W / 2, W / 2, W - 10, W - 10, 0, kind);
  x.strokeStyle = '#c99a2e'; x.lineWidth = 6; x.beginPath(); x.roundRect(3, 3, W - 6, W - 6, 26); x.stroke();
  const m = new THREE.Mesh(tileGeo, new THREE.MeshPhysicalMaterial({ map: tex(c), color: '#8f7650', roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3 }));
  m.position.set(SPOT[n].x * RW, 0, SPOT[n].y * RW); m.rotation.y = -SPOT[n].ang; m.castShadow = m.receiveShadow = true; scene.add(m);
  if (kind !== 'plain' && kind !== 'goose' && kind !== 'road' && kind !== 'skeleton' && kind !== 'prison' && kind !== 'maze' && kind !== 'start' && kind !== 'garden') { const p = makeProp(kind); p.position.set(SPOT[n].x * RW, TILE_TOP, SPOT[n].y * RW); scene.add(p); }
}
const gr = GARDEN_R * RW;
const rimT = new THREE.Mesh(new THREE.TorusGeometry(gr + 0.03, 0.07, 12, 56), MAT.brass()); rimT.rotation.x = Math.PI / 2; rimT.position.y = 0.05; rimT.castShadow = true; scene.add(rimT);
// hero: the great white goose, wings half-spread, head up
const goose = makeGoose(); goose.scale.setScalar(Number(q.get('gs') || 3.5)); goose.position.set(0.0, 0.0, -0.1); goose.rotation.y = -0.35; scene.add(goose);
poseGoose(goose, 1.2, 0.0, 0.0);
goose.userData.wings[0].rotation.x = -0.95; goose.userData.wings[1].rotation.x = 0.95;
goose.userData.wings[0].rotation.y = 0.35; goose.userData.wings[1].rotation.y = -0.35;
goose.userData.neck.rotation.z = -0.1;
// dice (ivory, real pips) and a red pawn
const pip = (v) => { const c = cv(128), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#e8d8ac'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
  for (const [px, py] of P) { x.fillStyle = v === 1 ? '#a8342a' : '#2a1a10'; x.beginPath(); x.arc(64 + px * 32, 64 + py * 32, v === 1 ? 19 : 12, 0, TAU); x.fill(); } return c; };
const pawn0 = 0; const dmats = [3, 4, 1, 6, 2, 5].map((v) => new THREE.MeshPhysicalMaterial({ map: tex(pip(v)), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.15 }));
void dmats; void pawn0;

const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 30), 1, 0.5, 100);
const pitch = (Number(q.get('pitch') || 22) * Math.PI) / 180, dist = Number(q.get('dist') || 10), look = [Number(q.get('lx') || 0), Number(q.get('ly') || 0.85), Number(q.get('lz') || 0)];
cam.position.set(look[0] + Math.sin(0) * dist, look[1] + Math.sin(pitch) * dist, look[2] + Math.cos(pitch) * dist); cam.lookAt(...look);
renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
const subject = cv(SIZE); subject.getContext('2d').drawImage(gl, 0, 0);

// ---- composite: candle-lit bokeh behind, glow, bloom, vignette
const out = cv(SIZE); document.body.appendChild(out); out.style.width = '1024px'; out.style.height = '1024px';
const ctx = out.getContext('2d');
const bg = ctx.createLinearGradient(0, 0, 0, SIZE); bg.addColorStop(0, '#1b0d05'); bg.addColorStop(0.55, '#3a1d0b'); bg.addColorStop(1, '#120803');
ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE);
let sd = 11; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
ctx.globalCompositeOperation = 'lighter';
for (let i = 0; i < 26; i++) { const x = rnd() * SIZE, y = rnd() * SIZE * 0.6, r = SIZE * (0.02 + rnd() * 0.05), g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,${150 + rnd() * 70 | 0},70,${0.25 + rnd() * 0.3})`); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
const cg = ctx.createRadialGradient(SIZE * 0.22, SIZE * 0.2, 0, SIZE * 0.22, SIZE * 0.2, SIZE * 0.4); cg.addColorStop(0, 'rgba(255,190,100,0.55)'); cg.addColorStop(1, 'rgba(255,140,60,0)'); ctx.fillStyle = cg; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.globalCompositeOperation = 'source-over';
ctx.filter = `blur(${SIZE * 0.012}px)`; ctx.drawImage(out, 0, 0); ctx.filter = 'none';
ctx.drawImage(subject, 0, 0);
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.014}px)`; ctx.globalAlpha = 0.12; ctx.drawImage(subject, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.3, SIZE / 2, SIZE / 2, SIZE * 0.72); v.addColorStop(0, 'rgba(10,4,0,0)'); v.addColorStop(1, 'rgba(6,3,8,0.78)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const star = (x, y, r, a) => { ctx.save(); ctx.translate(x * SIZE, y * SIZE); ctx.globalAlpha = a; ctx.fillStyle = '#fff3d0'; ctx.beginPath();
  for (let k = 0; k < 8; k++) { const ang = (k / 8) * TAU - Math.PI / 2, rr = k % 2 ? r * 0.16 : r; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); };
star(0.2, 0.2, SIZE * 0.026, 0.9); star(0.84, 0.24, SIZE * 0.018, 0.8); star(0.7, 0.1, SIZE * 0.012, 0.7);
const fin = cv(1024), fx = fin.getContext('2d'); fx.imageSmoothingQuality = 'high'; fx.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => fin.toDataURL('image/png'); window.__iconJpeg = () => fin.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
