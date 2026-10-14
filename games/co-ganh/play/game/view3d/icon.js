// Offline app-icon render (developer tool, not part of the game): `node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store`.
// Draws the SAME world the game uses (world.js): the lacquered board with a Jade piece caught mid turn-over between two Red pieces in the
// lantern-lit courtyard, then a tilt-shift depth of field (lanterns melt into bokeh), glow, vignette and sparkles. Result: window.__icon.
import * as THREE from '../vendor3d/three.js';
import { buildBoard, makePiece, buildEnvironment, PANEL_TOP, REST_Y } from './world.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; document.body.appendChild(out);
out.style.width = '1024px'; out.style.height = '1024px';
const ctx = out.getContext('2d');

const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = Number(q.get('exp') || 0.8);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x07141a, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07141a); scene.fog = new THREE.Fog(0x07141a, 22, 60);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; scene.environmentIntensity = 0.4; pm.dispose();
const env = buildEnvironment(); scene.add(env.group);
// pull the lanterns forward and low so they read as warm bokeh behind the board
const LP = [[-2.7, 1.9, -2.7, 1.5], [2.5, 2.3, -3.3, 1.4], [0.1, 3.1, -4.4, 1.1], [-4.7, 1.5, -4.6, 1.3], [4.7, 1.7, -4.9, 1.3]];
env.lanterns.forEach((l, i) => { const p = LP[i] || LP[0]; l.grp.position.set(p[0], p[1], p[2]); l.grp.scale.setScalar(p[3]); });
env.update(5.3, false);
env.lanterns.forEach((l) => { l.pl.intensity *= 0.22; });
const key = new THREE.DirectionalLight(0xffd9a8, 2.9); key.position.set(-4.5, 7, 5.5); key.castShadow = true;
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 }); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
const rim = new THREE.DirectionalLight(0x6fe0d4, 1.6); rim.position.set(5, 4, -7);
const rim2 = new THREE.DirectionalLight(0xffb070, 1.0); rim2.position.set(-6, 3, -4);
scene.add(new THREE.HemisphereLight(0x9fc4c8, 0x2a1810, 0.4), key, key.target, rim, rim2);

const board = buildBoard('paper'); scene.add(board);
const live = [];
const put = (side, x, z, o = {}) => {
  const m = makePiece('lacquer'), w = new THREE.Group();
  m.rotation.set(o.rx ?? (side === 1 ? 0 : Math.PI), o.yaw ?? 0, o.rz ?? 0); m.position.y = REST_Y + (o.lift || 0);
  m.scale.setScalar(o.s || 1); w.add(m); w.position.set(x, 0, z); scene.add(w); live.push(w); return w;
};
const S = 1.0;
// hero: one big red lacquer piece with the gold flower, a jade piece caught mid turn-over beside it, two more small pieces behind
put(1, 0.1, 0.45, { yaw: 0.35, s: 1.9 });
put(2, -1.75, -0.35, { rx: Math.PI * 1.28, lift: 0.7, yaw: 0.3, s: 1.2 });
put(1, 1.9, -0.9, { yaw: -0.3, s: 1.0 }); put(2, -0.2, -1.6, { yaw: 0.2, s: 1.0 });
const sg = new THREE.SphereGeometry(0.035, 8, 6), sm = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
for (let i = 0; i < 22; i++) { const a = i * 2.4, r = 1.35 + (i % 5) * 0.2, m = new THREE.Mesh(sg, sm); m.position.set(Math.cos(a) * r, PANEL_TOP + 0.12 + (i % 7) * 0.1, Math.sin(a) * r); m.scale.setScalar(0.6 + (i % 4) * 0.35); scene.add(m); }
const ringC = document.createElement('canvas'); ringC.width = ringC.height = 256; { const x = ringC.getContext('2d'), g = x.createRadialGradient(128, 128, 20, 128, 128, 128); g.addColorStop(0, 'rgba(255,200,90,0)'); g.addColorStop(0.62, 'rgba(255,205,100,0.9)'); g.addColorStop(0.8, 'rgba(255,170,60,0.25)'); g.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
const rt = new THREE.CanvasTexture(ringC); rt.colorSpace = THREE.SRGBColorSpace;
const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), new THREE.MeshBasicMaterial({ map: rt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45 }));
ring.rotation.x = -Math.PI / 2; ring.position.set(-1.75, PANEL_TOP + 0.02, -0.35); scene.add(ring); live.push(ring);
scene.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });

const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 26), 1, 0.5, 100);
const pitch = (Number(q.get('pitch') || 21) * Math.PI) / 180, yaw = (Number(q.get('yaw') || 12) * Math.PI) / 180, dist = Number(q.get('dist') || 6.3);
const look = [Number(q.get('lx') || 0), Number(q.get('ly') || 0.62), Number(q.get('lz') || 0.3)];
cam.position.set(look[0] + Math.sin(yaw) * Math.cos(pitch) * dist, look[1] + Math.sin(pitch) * dist, look[2] + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(look[0], look[1], look[2]);
renderer.render(scene, cam);
const sharp = document.createElement('canvas'); sharp.width = sharp.height = SIZE; sharp.getContext('2d').drawImage(gl, 0, 0);
// pass B: the world without the pieces (it gets the depth of field); pass C: the pieces alone on transparent (kept sharp)
live.forEach((o) => { o.visible = false; });
renderer.render(scene, cam);
const bgOnly = document.createElement('canvas'); bgOnly.width = bgOnly.height = SIZE; bgOnly.getContext('2d').drawImage(gl, 0, 0);
live.forEach((o) => { o.visible = true; }); board.visible = false; env.group.visible = false; scene.background = null; scene.fog = null; renderer.setClearColor(0x000000, 0);
renderer.render(scene, cam);
const piecesOnly = document.createElement('canvas'); piecesOnly.width = piecesOnly.height = SIZE; piecesOnly.getContext('2d').drawImage(gl, 0, 0);

// ---- tilt-shift: the far half is blurred (lantern bokeh), the board stays sharp towards the camera, the pieces stay sharp
const blur = document.createElement('canvas'); blur.width = blur.height = SIZE;
{ const b = blur.getContext('2d'); b.filter = `blur(${SIZE * 0.011}px)`; b.drawImage(bgOnly, -SIZE * 0.03, -SIZE * 0.03, SIZE * 1.06, SIZE * 1.06); b.filter = 'none';
  b.globalCompositeOperation = 'destination-in'; const m = b.createLinearGradient(0, 0, 0, SIZE); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.35, 'rgba(0,0,0,0.95)'); m.addColorStop(0.55, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,0)'); b.fillStyle = m; b.fillRect(0, 0, SIZE, SIZE); }
ctx.drawImage(bgOnly, 0, 0); ctx.drawImage(blur, 0, 0); ctx.drawImage(piecesOnly, 0, 0);
// bloom: bright parts again, blurred and added
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.016}px) brightness(1.1)`; ctx.globalAlpha = 0.26; ctx.drawImage(sharp, 0, 0); ctx.restore();
// darken the far wall so the subject pops
const dk = ctx.createLinearGradient(0, 0, 0, SIZE); dk.addColorStop(0, 'rgba(3,10,12,0.78)'); dk.addColorStop(0.45, 'rgba(3,10,12,0.35)'); dk.addColorStop(0.62, 'rgba(3,10,12,0)'); ctx.fillStyle = dk; ctx.fillRect(0, 0, SIZE, SIZE);
// vignette
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.36, SIZE / 2, SIZE / 2, SIZE * 0.78);
v.addColorStop(0, 'rgba(2,8,10,0)'); v.addColorStop(1, 'rgba(2,8,10,0.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
// four-point sparkles
const star = (x, y, r, a) => { ctx.save(); ctx.translate(x * SIZE, y * SIZE); ctx.globalAlpha = a; ctx.fillStyle = '#fff6dc'; ctx.beginPath();
  for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.16 : r; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); };
star(0.55, 0.34, SIZE * 0.035, 0.95); star(0.7, 0.5, SIZE * 0.016, 0.8); star(0.3, 0.45, SIZE * 0.014, 0.7);
window.__icon = () => out.toDataURL('image/png');
window.__iconJpeg = () => { const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(out, 0, 0, 1024, 1024); return c.toDataURL('image/jpeg', 0.93); };
document.title = 'ready';
