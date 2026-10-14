// Offline app-icon render (developer tool, not part of the game): headless Chrome loads web/icon.html?size=2048. One subject: a real
// open hand (the view3d athlete hand mesh, palm up) presenting a gold ring with a faceted gem, in front of the same lit majlis the game
// uses (pointed-arch niche with a night sky, hanging brass lanterns, patterned carpet). The room is rendered separately and softened
// (shallow depth of field), then the subject is composited with bloom and a vignette. Exposes window.__icon().
import * as V3D from '../vendor3d/index.js';
import * as B from '../vendor3d/board3d.js';
import { createHand } from '../vendor3d/hand3d.js';
import { buildRoom, makeRing3d } from './room.js';

const T = V3D.THREE, q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const nums = (k, d) => (q.has(k) ? q.get(k).split(',').map(Number) : d);
const gl = cv(SIZE);
const renderer = new T.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = Number(q.get('exp') || 1.0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;

// ---------------- the room (backdrop)
const roomScene = new T.Scene();
B.createEnvironment(renderer, roomScene, { intensity: 0.6 });
const U = buildRoom(roomScene, { carpet: q.get('carpet') || 'garnet', shadows: false });
roomScene.environmentIntensity = 0.6;
const rcam = new T.PerspectiveCamera(Number(q.get('rfov') || 40), 1, 0.5, 80);
const rp = nums('rpos', [0, 1.7, 4.2]), rl = nums('rlook', [0, 2.3, -5]);
rcam.position.set(...rp); rcam.lookAt(...rl);
roomScene.fog = new T.Fog(0x120a2a, 22, 44);
renderer.setClearColor(0x120a2a, 1); renderer.render(roomScene, rcam);
const roomImg = cv(SIZE); roomImg.getContext('2d').drawImage(gl, 0, 0);

// ---------------- the subject
const scene = new T.Scene();
B.createEnvironment(renderer, scene, { intensity: 0.5 });
scene.environmentIntensity = 0.45;
scene.add(new T.HemisphereLight(0xffe8c8, 0x7a2a22, 0.28));
const key = new T.DirectionalLight(0xffd8a0, Number(q.get('key') || 1.7)); key.position.set(-0.7, 1.6, 1.0); key.target.position.set(0.2, 1.05, 0.4); key.castShadow = true;
Object.assign(key.shadow.camera, { left: -0.4, right: 0.4, top: 0.4, bottom: -0.4, near: 0.1, far: 6 }); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004;
const rim = new T.DirectionalLight(0xffb060, 1.8); rim.position.set(0.8, 0.9, -1.2); rim.target.position.set(0.2, 1.05, 0.4);
const fill = new T.DirectionalLight(0xff9a78, 0.8); fill.position.set(0.7, -0.4, 0.8);
scene.add(key, key.target, rim, rim.target, fill);
const WX = 0.2, WY = 1.05, WZ = 0.42;
const hand = await createHand(V3D, { side: 'R', skin: q.get('skin') || 'tan', character: 'athlete_m', base: './assets3d/' });
scene.add(hand.object);
const fdir = new T.Vector3(...nums('fdir', [0.55, 0.2, 0.8])).normalize();
hand.setPreset('open', { spread: Number(q.get('spread') || 0.22), thumbOut: 0.6, index: 0.2, middle: 0.22, ring: 0.27, pinky: 0.34 });
hand.place({ wrist: new T.Vector3(WX, WY, WZ), palmDown: false, fingers: fdir, elbowHint: new T.Vector3(0.6, -0.4, -0.3) });
hand.update(0); hand.update(0.016);
const w = hand.wristPosition(new T.Vector3());
hand.clipBehindWrist(renderer, Number(q.get('clip') || 0.02), fdir.clone());
// the ring stands on the palm, gem toward the viewer
const ring = makeRing3d(); const rs = Number(q.get('rs') || 0.0205);
const palm = w.clone().addScaledVector(fdir, 0.085).add(new T.Vector3(0, 0.012, 0));
ring.scale.setScalar(rs); ring.position.copy(palm).add(new T.Vector3(0, rs * 0.55, 0)); ring.rotation.set(0.35, -0.5 + Number(q.get('ry') || 0), 0.05);
scene.add(ring);
// soft contact shadow of the ring on the skin
const cs = B.contactShadow(rs * 0.9, 0.5); cs.position.copy(palm).add(new T.Vector3(0, 0.004, 0)); scene.add(cs);
const ctr = palm.clone().add(new T.Vector3(...nums('off', [0.0, 0.0, 0.0])));
const cam = new T.PerspectiveCamera(Number(q.get('fov') || 26), 1, 0.05, 20);
const cd = nums('cam', [-0.1, 0.38, 0.4]); cam.position.copy(ctr).add(new T.Vector3(...cd)); cam.lookAt(ctr.x + 0.02, ctr.y, ctr.z - 0.02);
renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
const subject = cv(SIZE); subject.getContext('2d').drawImage(gl, 0, 0);

// ---------------- composite: shallow depth of field, warm glow, bloom, vignette
const out = cv(SIZE), ctx = out.getContext('2d');
ctx.fillStyle = '#120a2a'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.022}px)`; ctx.drawImage(roomImg, -SIZE * 0.05, -SIZE * 0.05, SIZE * 1.1, SIZE * 1.1); ctx.filter = 'none';
ctx.fillStyle = `rgba(14,6,40,${Number(q.get('dim') || 0.5)})`; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.globalCompositeOperation = 'lighter';
{ let sd = 17; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let i = 0; i < 22; i++) { const x = rnd() * SIZE, y = rnd() * SIZE * 0.55, r = SIZE * (0.018 + rnd() * 0.04), g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,${170 + rnd() * 60 | 0},90,${0.35 + rnd() * 0.3})`); g.addColorStop(0.8, 'rgba(255,150,70,0.12)'); g.addColorStop(1, 'rgba(255,150,70,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); } }
const g1 = ctx.createRadialGradient(SIZE * 0.5, SIZE * 0.62, 0, SIZE * 0.5, SIZE * 0.62, SIZE * 0.5); g1.addColorStop(0, 'rgba(255,170,90,0.28)'); g1.addColorStop(1, 'rgba(255,140,60,0)'); ctx.fillStyle = g1; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.globalCompositeOperation = 'source-over';
ctx.drawImage(subject, 0, 0);
{ const p = ring.position.clone().add(new T.Vector3(0, rs * 0.7, 0)).project(cam), gx = (p.x * 0.5 + 0.5) * SIZE, gy = (1 - (p.y * 0.5 + 0.5)) * SIZE;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, SIZE * 0.2); g.addColorStop(0, 'rgba(120,220,255,0.55)'); g.addColorStop(0.3, 'rgba(255,200,110,0.22)'); g.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
  // a four-point star on the gem
  ctx.translate(gx, gy); ctx.globalAlpha = 0.9; ctx.fillStyle = '#e8fbff'; for (const a of [0, Math.PI / 2]) { ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-SIZE * 0.07, 0); ctx.quadraticCurveTo(0, SIZE * 0.004, SIZE * 0.07, 0); ctx.quadraticCurveTo(0, -SIZE * 0.004, -SIZE * 0.07, 0); ctx.fill(); }
  ctx.restore(); }
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.012}px)`; ctx.globalAlpha = Number(q.get('bloom') || 0.16); ctx.drawImage(subject, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.32, SIZE / 2, SIZE / 2, SIZE * 0.74); v.addColorStop(0, 'rgba(6,2,16,0)'); v.addColorStop(1, 'rgba(6,2,16,0.7)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
document.body.appendChild(out); out.style.width = '1024px'; out.style.height = '1024px';
const fin = cv(1024), fx = fin.getContext('2d'); fx.imageSmoothingQuality = 'high'; fx.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => fin.toDataURL('image/png'); window.__iconJpeg = () => fin.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
