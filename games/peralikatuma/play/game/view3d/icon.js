// Offline app-icon render (developer tool): node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store
// The SAME models as the game: a crowned ruby star mid-chain on the carved board, sapphires thrown off, brass lamp glowing behind.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { TOP, buildBoard, buildFloor, buildLamp, buildFlower, flameTexture, makePiece } from './models.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; out.style.cssText = 'width:1024px;height:1024px'; document.body.appendChild(out);
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const rig = B.lightingRig(scene, 'duskOutdoor', { renderer, shadow: 4096, extent: 7, target: [0, 0.4, 0], fog: { near: 20, far: 60 },
  overrides: { bg: 0x2a1626, fog: 0x4a2a30, key: 0xffd09a, keyI: 2.6, keyPos: [-4, 8, 5], hemi: 0.35, hemiSky: 0xffc9a0, fillI: 0.3, rimI: 2.6, rim: 0xffa060, rimPos: [6, 4, -6], exposure: 0.72, env: 0.2 } });
B.createEnvironment(renderer, scene, { intensity: 0.25 });
scene.add(buildFloor());
scene.add(buildBoard('satin'));
const put = (code, x, z, o = {}) => { const g = makePiece(code, 'faceted'); g.position.set(x, o.y ?? TOP, z); g.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); g.scale.setScalar(o.s || 1); scene.add(g); return g; };
put(3, 0.0, 0.2, { ry: 0.3, s: 1.25 });
put(2, -1.0, 1.0); put(2, 1.0, 1.0); put(2, -1.0, -1.0); put(2, 1.0, -1.0, { y: TOP + 0.9, rx: 0.8, rz: -0.6, s: 0.95 }); put(2, 0, -2.0); put(2, -2, 0);
put(1, 2.0, 2.0); put(1, 0, 2.0); put(1, -2.0, 2.0); put(1, 2.0, 0.0); put(1, -3, 1);
put(1, 1.0, 3.0);
const fl = buildFlower(); fl.position.set(-3.6, TOP + 0.05, 3.2); fl.scale.setScalar(1.6); scene.add(fl);
// the lamp behind, in soft focus, with a flame
const lamp = buildLamp(); lamp.position.set(-1.5, 0, -6.5); lamp.scale.setScalar(2.1); scene.add(lamp);
const glow = (x, y, z, s, col, op, tex) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x2 = c.getContext('2d'), g = x2.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x2.fillStyle = g; x2.fillRect(0, 0, 128, 128);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex || new THREE.CanvasTexture(c), color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set(x, y, z); sp.scale.setScalar(s); scene.add(sp); };
glow(-1.5, 5.2, -6.5, 8, 0xff9a50, 0.8); glow(0, 1.2, 0.2, 2.6, 0xffd070, 0.35);
const fp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); fp.position.set(-1.5, 5.3 + 0.0, -6.5); fp.scale.set(0.7, 1.3, 1); scene.add(fp);
const sg = new THREE.SphereGeometry(0.03, 8, 6), sm = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(sg, sm), a = i * 2.4, r = 0.5 + (i % 7) * 0.14; m.position.set(Math.cos(a) * r, TOP + 0.8 + (i % 9) * 0.13, 0.2 + Math.sin(a) * r * 0.7); m.scale.setScalar(0.4 + (i % 4) * 0.3); scene.add(m); }
const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 30), 1, 0.5, 200);
const pitch = (Number(q.get('pitch') || 36) * Math.PI) / 180, yaw = (Number(q.get('yaw') || -10) * Math.PI) / 180, dist = Number(q.get('dist') || 11);
const tgt = new THREE.Vector3(0, 0.7, 0.2);
cam.position.set(tgt.x + Math.sin(yaw) * Math.cos(pitch) * dist, tgt.y + Math.sin(pitch) * dist, tgt.z + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(tgt);
renderer.render(scene, cam);
const snap = document.createElement('canvas'); snap.width = snap.height = SIZE; snap.getContext('2d').drawImage(gl, 0, 0);
ctx.fillStyle = '#0a0503'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.01}px)`; ctx.drawImage(snap, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
{ const sharp = document.createElement('canvas'); sharp.width = sharp.height = SIZE; const sx = sharp.getContext('2d'); sx.drawImage(snap, 0, 0); sx.globalCompositeOperation = 'destination-in';
  const m = sx.createLinearGradient(0, 0, 0, SIZE); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.3, 'rgba(0,0,0,1)'); m.addColorStop(0.92, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0.6)'); sx.fillStyle = m; sx.fillRect(0, 0, SIZE, SIZE); ctx.drawImage(sharp, 0, 0); }
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.016}px)`; ctx.globalAlpha = 0.14; ctx.drawImage(snap, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE * 0.55, SIZE * 0.36, SIZE / 2, SIZE / 2, SIZE * 0.78); v.addColorStop(0, 'rgba(10,4,0,0)'); v.addColorStop(1, 'rgba(10,4,0,0.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const small = document.createElement('canvas'); small.width = small.height = 1024; const sm2 = small.getContext('2d'); sm2.imageSmoothingQuality = 'high'; sm2.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
