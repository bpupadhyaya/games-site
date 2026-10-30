// Offline app-icon render (developer tool): node dev/render-icon.mjs --root web --page icon.html?size=2048 --out store
// The SAME models as the game: the turtle-shell board at dusk, the centre stone lifted off in a glow, painted screen and moon behind.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { buildBoard, buildScreen, makeStone, styleStone, halo, SEAT_Y, TOP_Y } from './models.js';

await Promise.race([document.fonts.load('700 48px Cinzel'), new Promise((r) => setTimeout(r, 2000))]);
const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; out.style.cssText = 'width:1024px;height:1024px'; document.body.appendChild(out);
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const rig = B.lightingRig(scene, 'duskOutdoor', { renderer, shadow: 4096, extent: 5, target: [0, 0.4, 0], fog: { near: 20, far: 60 },
  overrides: { bg: 0x07080c, fog: 0x07080c, key: 0xffc080, keyI: 3.2, keyPos: [-4, 7, 5], hemi: 0.3, fill: 0x7f9be0, fillI: 0.5, rim: 0xa8bcff, rimI: 2.4, rimPos: [5, 4, -5], exposure: 1.0, env: 0.5 } });
B.createEnvironment(renderer, scene, { intensity: 0.5 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.8 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const dims = { fw: 3.9, fd: 3.9, n: 3, pan: false, grid: { cx: 0, cz: 0, size: 3 }, banner: null, gauges: [] };
scene.add(buildBoard(dims, 'jade'));
const vals = [4, 9, 2, 3, 5, 7, 8, 1, 6];
vals.forEach((v, i) => {
  const g = makeStone(null); g.userData.shadow.visible = false; styleStone(g, v, i % 2 === 0 ? 'given' : 'stone', 'jade', i === 4 ? 'dots' : 'digits');
  const X = (i % 3) - 1, Z = Math.floor(i / 3) - 1; g.position.set(X, SEAT_Y, Z); g.userData.ring.visible = false;
  if (i === 4) { g.position.set(0.0, 1.55, 0.1); g.userData.pivot.rotation.set(-0.5, 0.3, 0.1); g.userData.pivot.scale.setScalar(1.25); g.userData.body.material.emissiveIntensity = 0.5; }
  scene.add(g);
});
const glow = (x, y, z, s, col, op) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo('255,255,255', 128), color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set(x, y, z); sp.scale.setScalar(s); scene.add(sp); };
glow(0.0, 1.6, 0.1, 4.2, 0xffc060, 0.55);
const sg = new THREE.SphereGeometry(0.03, 8, 6), sm = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
for (let i = 0; i < 34; i++) { const m = new THREE.Mesh(sg, sm), a = i * 2.4, r = 0.35 + (i % 8) * 0.14; m.position.set(0.05 + Math.cos(a) * r, 1.3 + (i % 11) * 0.12, 0.2 + Math.sin(a) * r * 0.7); m.scale.setScalar(0.4 + (i % 4) * 0.3); scene.add(m); }
const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 100);
const pitch = (38 * Math.PI) / 180, dist = 9.2, tgt = new THREE.Vector3(0, 0.9, 0.1);
cam.position.set(tgt.x + Math.sin(-0.12) * Math.cos(pitch) * dist, tgt.y + Math.sin(pitch) * dist, tgt.z + Math.cos(pitch) * dist); cam.lookAt(tgt);
renderer.render(scene, cam);
const snap = document.createElement('canvas'); snap.width = snap.height = SIZE; snap.getContext('2d').drawImage(gl, 0, 0);
ctx.fillStyle = '#0a0612'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.012}px)`; ctx.drawImage(snap, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
{ const sh = document.createElement('canvas'); sh.width = sh.height = SIZE; const sx = sh.getContext('2d'); sx.drawImage(snap, 0, 0); sx.globalCompositeOperation = 'destination-in';
  const m = sx.createLinearGradient(0, 0, 0, SIZE); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.3, 'rgba(0,0,0,0.9)'); m.addColorStop(0.5, 'rgba(0,0,0,1)'); m.addColorStop(0.9, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0.5)'); sx.fillStyle = m; sx.fillRect(0, 0, SIZE, SIZE); ctx.drawImage(sh, 0, 0); }
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.016}px)`; ctx.globalAlpha = 0.14; ctx.drawImage(snap, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE * 0.5, SIZE * 0.35, SIZE / 2, SIZE / 2, SIZE * 0.78); v.addColorStop(0, 'rgba(8,4,16,0)'); v.addColorStop(1, 'rgba(8,4,16,0.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const small = document.createElement('canvas'); small.width = small.height = 1024; const sm2 = small.getContext('2d'); sm2.imageSmoothingQuality = 'high'; sm2.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
