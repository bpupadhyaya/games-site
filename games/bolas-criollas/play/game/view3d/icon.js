// Offline app-icon render (developer tool): node tools/render-icon.mjs --root web --page "icon.html?size=2048" --out store
// The SAME models as the game: glossy marbled-resin bolas and the mingo on the packed-earth cancha, low sun, palms and string lights
// out of focus behind. Composite: sharp foreground over a blurred copy (depth of field), bloom, vignette.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { buildGround, buildBoards, buildBall, buildPalm, buildBunting, softTexture } from './models.js';
import { R_BALL, R_MINGO } from '../src/sim.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; out.style.cssText = 'width:1024px;height:1024px'; document.body.appendChild(out);
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const sk = document.createElement('canvas'); sk.width = 16; sk.height = 512; { const x = sk.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#1c1846'); g.addColorStop(0.3, '#5a3a86'); g.addColorStop(0.55, '#c8587a'); g.addColorStop(0.75, '#f59a5a'); g.addColorStop(1, '#ffd89a'); x.fillStyle = g; x.fillRect(0, 0, 16, 512); }
const skyTex = new THREE.CanvasTexture(sk); skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;
const rig = B.lightingRig(scene, 'duskOutdoor', { renderer, shadow: 4096, extent: 3.2, target: [3.2, 0, 0], fog: false, background: false,
  overrides: { key: 0xffb070, keyI: 2.3, keyPos: [-1.5, 1.2, 2.2], hemi: 0.3, hemiSky: 0xffc8a8, hemiGround: 0x4a3030, fill: 0x7a90ff, fillI: 0.6, rim: 0xffe0b0, rimI: 2.2, rimPos: [9, 1.4, -4], exposure: 0.62, env: 0.4 } });
B.createEnvironment(renderer, scene, { intensity: 0.55 });
const ground = buildGround({ patches: [{ kind: 'hard', u: 3.2, v: 0.15, ru: 1.7, rv: 1.0 }, { kind: 'loose', u: 5.2, v: -0.55, ru: 1.4, rv: 0.8 }] });
scene.add(ground);
scene.add(buildBoards());
const put = (team, kind, x, z, y = null) => { const r = kind === 'mingo' ? R_MINGO : R_BALL, b = buildBall(team, kind, r); b.position.set(x, y ?? r, z); b.rotation.set(x * 3 + 1, z * 5 + 2, x + z); scene.add(b); return b; };
put(1, 'ball', 2.95, 0.12); put(0, 'ball', 3.28, -0.17); put(0, 'ball', 3.12, 0.36); put(1, 'ball', 3.9, -0.38); put(0, 'mingo', 3.58, 0.06);
// palms and string lights far behind, out of focus
for (const [x, z, h, s, l] of [[-0.4, -3.0, 7.5, 1, 0.6], [7.2, -3.6, 8.4, 2, -0.5], [10, -3.4, 6.8, 3, 0.5]]) { const p = buildPalm(h, s, l); p.position.set(x, 0, z); p.rotation.y = s * 1.3; scene.add(p); }
const glow = softTexture('255,255,255', 0.95);
for (let i = 0; i < 22; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: i % 3 ? 0xffd58a : 0xffa860, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sp.position.set(-0.2 + i * 0.5, 1.5 + Math.abs(Math.sin(i * 0.9)) * 0.45, -3.0); sp.scale.setScalar(0.45 + (i % 4) * 0.12); scene.add(sp);
}
const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd8a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
sun.position.set(6.5, 1.2, -9); sun.scale.setScalar(9); scene.add(sun);
const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 27), 1, 0.05, 200);
const pos = [Number(q.get('cx') || 2.15), Number(q.get('cy') || 0.2), Number(q.get('cz') || 0.5)], tgt = [Number(q.get('tx') || 3.35), 0.13, 0.02];
cam.position.set(...pos); cam.lookAt(...tgt);
renderer.render(scene, cam);
const snap = document.createElement('canvas'); snap.width = snap.height = SIZE; snap.getContext('2d').drawImage(gl, 0, 0);
ctx.fillStyle = '#0a0503'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.012}px)`; ctx.drawImage(snap, -SIZE * 0.03, -SIZE * 0.03, SIZE * 1.06, SIZE * 1.06); ctx.filter = 'none';
{ const sharp = document.createElement('canvas'); sharp.width = sharp.height = SIZE; const sx = sharp.getContext('2d'); sx.drawImage(snap, 0, 0); sx.globalCompositeOperation = 'destination-in';
  const m = sx.createLinearGradient(0, 0, 0, SIZE); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.36, 'rgba(0,0,0,1)'); m.addColorStop(0.94, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0.5)'); sx.fillStyle = m; sx.fillRect(0, 0, SIZE, SIZE); ctx.drawImage(sharp, 0, 0); }
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.016}px)`; ctx.globalAlpha = 0.16; ctx.drawImage(snap, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE * 0.56, SIZE * 0.36, SIZE / 2, SIZE / 2, SIZE * 0.78); v.addColorStop(0, 'rgba(10,4,0,0)'); v.addColorStop(1, 'rgba(10,4,0,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const small = document.createElement('canvas'); small.width = small.height = 1024; const sm2 = small.getContext('2d'); sm2.imageSmoothingQuality = 'high'; sm2.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
