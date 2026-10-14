// Offline app-icon render (developer tool): the SAME models as the game. A lacquered paper lantern mid-descent beside a glowing ink
// trail on the washi scroll, a lacquer prize bowl with sweets below, shoji light behind in soft focus.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { LOOKS, LAMP } from '../src/ui.js';
import { buildRoom, makeLantern, makeBowl, paperTexture, glowTexture } from './models.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; out.style.cssText = 'width:1024px;height:1024px'; document.body.appendChild(out);
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const T = LOOKS.indigo, scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0d24);
const WW = 1000, HH = 1000;
scene.add(new THREE.HemisphereLight(0x93a2ff, 0x2a1a30, 0.6));
const key = new THREE.DirectionalLight(0xffd9a0, 1.9); key.position.set(-420, 520, 900); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -700, right: 700, top: 700, bottom: -700, near: 100, far: 2400 }); key.shadow.bias = -0.0005; key.shadow.normalBias = 1.2; scene.add(key);
const rim = new THREE.DirectionalLight(0x6f8cff, 1.4); rim.position.set(400, 200, -300); scene.add(rim);
B.createEnvironment(renderer, scene, { intensity: 0.3 });
scene.add(buildRoom(T, WW, HH));
// scroll paper plane + rails + rungs (a 3-line ladder, one rung)
const pm = paperTexture(T.paper);
const paper = new THREE.Mesh(new THREE.PlaneGeometry(760, 900), new THREE.MeshStandardMaterial({ map: pm.map, bumpMap: pm.bump, bumpScale: 0.6, roughness: 0.9, emissive: new THREE.Color(T.paper), emissiveIntensity: 0.14 }));
paper.position.set(0, 0, 0); paper.receiveShadow = true; scene.add(paper);
const frame = new THREE.Mesh(B.roundedBox(820, 960, 10, 6, 2), new THREE.MeshStandardMaterial({ color: 0x6a4d12, roughness: 0.6, metalness: 0.2 })); frame.position.z = -6; frame.castShadow = true; scene.add(frame);
const railM = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#b8a778'), roughness: 0.4, clearcoat: 0.5 });
const XS = [-230, 0, 230];
for (const x of XS) { const r = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 940, 18), railM); r.position.set(x, 0, 16); r.castShadow = r.receiveShadow = true; scene.add(r); }
const rungM = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#e8a93a'), roughness: 0.3, clearcoat: 1 });
const rung = (x0, x1, y) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(17, x1 - x0 - 34, 6, 14), rungM); m.rotation.z = Math.PI / 2; m.position.set((x0 + x1) / 2, y, 22); m.castShadow = true; scene.add(m); };
rung(-230, 0, 120); rung(0, 230, -110);
// glowing trail (additive sprites) down the path of the red lantern: from the top, over the rung, down
const gt = glowTexture();
const sp = (x, y, z, s, c, o) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.position.set(x, y, z); m.scale.setScalar(s); scene.add(m); };
const path = []; for (let y = 440; y > 120; y -= 14) path.push([-230, y]); for (let x = -230; x < 0; x += 14) path.push([x, 120]); for (let y = 120; y > 330 * -1; y -= 14) path.push([0, y]);
path.forEach(([x, y], i) => { const f = i / path.length; sp(x, y, 30, 90, 0xff4a2c, 0.1 + 0.35 * f); sp(x, y, 32, 40, 0xffb090, 0.1 + 0.35 * f); });
// hero lantern at the end of the trail, big; bowl below with sweets
const lan = makeLantern(LAMP, 0); lan.position.set(0, -180, 70); lan.scale.setScalar(130); lan.rotation.z = -0.1; scene.add(lan);
lan.userData.halo.material.opacity = 0.6; lan.userData.halo.scale.setScalar(5); lan.userData.bodyMat.emissiveIntensity = 0.55;
const bowl = makeBowl(LAMP, 1); bowl.position.set(0, -400, 120); bowl.scale.setScalar(140); bowl.rotation.x = 0.4; scene.add(bowl);
bowl.userData.glow.material.opacity = 0.6;
const l2 = makeLantern(LAMP, 3); l2.position.set(-230, 330, 60); l2.scale.setScalar(90); scene.add(l2);
const l3 = makeLantern(LAMP, 2); l3.position.set(230, 330, 60); l3.scale.setScalar(90); scene.add(l3);
const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 38), 1, 20, 6000);
cam.position.set(Number(q.get('cx') || 0), Number(q.get('cy') || -30), Number(q.get('dist') || 1750)); cam.lookAt(0, -80, 0);
renderer.render(scene, cam);
const snap = document.createElement('canvas'); snap.width = snap.height = SIZE; snap.getContext('2d').drawImage(gl, 0, 0);
ctx.drawImage(snap, 0, 0);
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.014}px)`; ctx.globalAlpha = 0.25; ctx.drawImage(snap, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.4, SIZE / 2, SIZE / 2, SIZE * 0.78); v.addColorStop(0, 'rgba(2,4,14,0)'); v.addColorStop(1, 'rgba(2,4,14,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const small = document.createElement('canvas'); small.width = small.height = 1024; const sm = small.getContext('2d'); sm.imageSmoothingQuality = 'high'; sm.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
