// Offline app-icon render (developer tool, not shipped in play): loads web/icon.html?size=2048, draws the SAME models the game uses
// (models.js) into the toy-maker's room, composites a blurred backdrop (depth of field), glow, vignette and sparkles, and exposes the
// finished canvas as window.__icon() (PNG data URL) for the capture script.
import * as THREE from '../vendor3d/three.js';
import { makeDoll, buildSet, glowTexture } from './models.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048), V = 1024, D = 2300;
const out = document.createElement('canvas'); out.width = out.height = SIZE; document.body.appendChild(out);
out.style.width = '1024px'; out.style.height = '1024px';
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const snap = () => { const c = document.createElement('canvas'); c.width = c.height = SIZE; c.getContext('2d').drawImage(gl, 0, 0); return c; };

function lights(scene, gy, withShadow) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.32; pm.dispose();
  const hemi = new THREE.HemisphereLight(0xfff1d6, 0x7a4a2a, 0.5);
  const key = new THREE.DirectionalLight(0xffe2b0, 1.9); key.position.set(180, -gy + 700, 900); key.target.position.set(V / 2, -gy + 300, 0);
  const rim = new THREE.DirectionalLight(0xffb96a, 2.0); rim.position.set(V / 2 + 700, -gy + 500, -500); rim.target.position.set(V / 2, -gy + 300, 0);
  const fill = new THREE.DirectionalLight(0xbfd8ff, 0.35); fill.position.set(V + 500, -gy + 100, 700); fill.target.position.set(V / 2, -gy + 300, 0);
  if (withShadow) { key.castShadow = true; Object.assign(key.shadow.camera, { left: -700, right: 700, top: 800, bottom: -300, near: 100, far: 2800 }); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0006; key.shadow.normalBias = 1.2; key.shadow.radius = 4; }
  scene.add(hemi, key, key.target, rim, rim.target, fill, fill.target);
}
const GY = 868;
const cam = new THREE.PerspectiveCamera((2 * Math.atan(V / (2 * D)) * 180) / Math.PI, 1, 20, 5000);
cam.position.set(V / 2, -V / 2, D); cam.lookAt(V / 2, -V / 2, 0);

function placeDoll(m, cx, R, th, lag, z) {
  const U = m.userData; m.scale.setScalar(R); m.position.set(cx + R * th, -(GY - R), z); m.rotation.z = -th;
  U.torso.rotation.z = th * 0.35; U.head.rotation.z = -lag; U.head.rotation.x = 0.1; U.plume.rotation.z = lag * 0.6;
}

// ---- pass 1: the whole set with two supporting dolls, blurred later for depth of field
const s1 = new THREE.Scene(); lights(s1, GY, true);
const set1 = buildSet(); s1.add(set1.group);
set1.layout(V, V, D, { S: { x: 0, y: 0, w: V, h: V }, gy: GY, fh: 180, R: 170 });
set1.update(3.1, 0.7, false);
const a = makeDoll(0, 0, 3), b = makeDoll(3, 1, 3);
placeDoll(a, 215, 118, -0.16, 0.08, -150); placeDoll(b, 815, 118, 0.18, -0.08, -150);
s1.add(a, b);
s1.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
renderer.setClearColor(0xf1d8a6, 1); renderer.clear(); renderer.render(s1, cam);
const backdrop = snap();

// ---- pass 2: the hero doll over a transparent background, with a shadow catcher on the shelf
const s2 = new THREE.Scene(); lights(s2, GY, true);
const hero = makeDoll(1, 0, 3); placeDoll(hero, 512, 150, 0.09, 0.07, 20); s2.add(hero);
hero.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
const set2 = buildSet(); set2.layout(V, V, D, { S: { x: 0, y: 0, w: V, h: V }, gy: GY, fh: 180, R: 170 });
set2.group.children.forEach((c) => { c.visible = set2.shelfParts.includes(c); });
s2.add(set2.group);
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture('30,8,2'), transparent: true, opacity: 0.55, depthWrite: false }));
blob.rotation.x = -Math.PI / 2; blob.position.set(512 + 150 * 0.09, -GY + 1.5, 20); blob.scale.set(150 * 3.0, 150 * 1.2, 1); s2.add(blob);
renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(s2, cam);
const subject = snap();

// ---- composite
const k = SIZE / V;
ctx.fillStyle = '#1a0a06'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.0065}px)`; ctx.drawImage(backdrop, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
// warm halo behind the hero
const g = ctx.createRadialGradient(SIZE * 0.5, SIZE * 0.5, SIZE * 0.04, SIZE * 0.5, SIZE * 0.5, SIZE * 0.5);
g.addColorStop(0, 'rgba(255,226,160,0.34)'); g.addColorStop(0.6, 'rgba(255,170,80,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.drawImage(subject, 0, 0);
// bloom
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.012}px)`; ctx.globalAlpha = 0.22; ctx.drawImage(subject, 0, 0); ctx.restore();
// vignette
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.4, SIZE / 2, SIZE / 2, SIZE * 0.78);
v.addColorStop(0, 'rgba(40,10,0,0)'); v.addColorStop(1, 'rgba(40,10,0,0.5)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
// sparkles
const star = (x, y, r, al) => { ctx.save(); ctx.translate(x * SIZE, y * SIZE); ctx.globalAlpha = al; ctx.fillStyle = '#fff6dc'; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const ang = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.18 : r; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); };
star(0.2, 0.2, SIZE * 0.02, 0.85); star(0.8, 0.14, SIZE * 0.014, 0.75); star(0.12, 0.55, SIZE * 0.012, 0.6);
void k;
window.__icon = () => out.toDataURL('image/png');
document.title = 'ready';
