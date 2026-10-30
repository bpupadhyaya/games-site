// Offline app-icon render (developer tool, not part of the game): node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store
// Draws the SAME models the game uses (models.js, arm.js + handmesh.js): two tatami mats laid in a staggered joint on a dark timber floor and a third mat
// being pressed into place by two modelled hands (palms flat on the rush) in crimson kimono sleeves, in front of lit shoji and a tokonoma. Tilt-shift depth of field, bloom, vignette.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { createArm } from './arm.js';
import { MAT, rng, softCanvas, strawTextures, heriTexture, plasterTexture, shojiTexture, scrollTexture, boardsTexture, makeMatGeos, buildVase, buildAndon } from './models.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; out.style.cssText = 'width:1024px;height:1024px'; document.body.appendChild(out);
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const rig = B.lightingRig(scene, 'warmIndoor', { renderer, shadow: 4096, extent: 7, target: [0, 0, 0.6], fog: { near: 18, far: 60 },
  overrides: { bg: 0x1a1218, fog: 0x2a1c22, key: 0xffdcb4, keyI: 4.2, keyPos: [-6, 3.6, 3.4], hemiSky: 0xfff0dc, hemiGround: 0x4a3a30, hemi: 0.9, fill: 0xcfdcff, fillI: 0.5, fillPos: [6, 3, 6], rim: 0xffc890, rimI: 2.6, rimPos: [5, 4, -5], exposure: 1.02, env: 0.65 } });
{ const env = B.createEnvironment(renderer, scene, { intensity: 0.5 }); }
const glow = (x, y, z, s, col, op) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softCanvas('255,255,255', 1, false, 128), color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set(x, y, z); sp.scale.setScalar(s); scene.add(sp); return sp; };

// floor + backdrop: shoji wall glowing with afternoon light, tokonoma with scroll and vase
const bt = boardsTexture('#2a1a0e', '#43301e', 3); bt.map.repeat.set(10, 10); bt.bump.repeat.set(10, 10);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: bt.map, bumpMap: bt.bump, bumpScale: 1.2, roughness: 0.42 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const wood = B.material('darkWood', { color: '#2c1a0f', color2: '#4a2c18', seed: 3 });
const st = shojiTexture(4, 2, { paper: '#fff0dc' }); st.repeat.set(2, 1);
const shoji = new THREE.Mesh(new THREE.PlaneGeometry(22, 6.5), new THREE.MeshBasicMaterial({ map: st, color: 0xffefd0, toneMapped: false, fog: false })); shoji.position.set(1.5, 3.0, -3.4); scene.add(shoji);
for (let i = -4; i <= 4; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 6.5, 0.2), wood); p.position.set(1.5 + i * 2.5, 3.25, -5.1); p.castShadow = true; scene.add(p); }
const plaster = plasterTexture('#d9ccb0');
const tokoBack = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5, 0.1), new THREE.MeshStandardMaterial({ map: plaster.map, color: 0xa89878, roughness: 1 })); tokoBack.position.set(-3.1, 2.5, -4.6); scene.add(tokoBack);
const dais = new THREE.Mesh(B.slab(3.6, 1.6, 0.22, 0.05, 0.025), new THREE.MeshPhysicalMaterial({ color: 0x4a2e18, roughness: 0.3, clearcoat: 0.7 })); dais.position.set(-3.1, 0, -3.9); dais.castShadow = true; dais.receiveShadow = true; scene.add(dais);
const scrollTex = scrollTexture('#33406a');
const scrollM = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.85), new THREE.MeshStandardMaterial({ map: scrollTex, roughness: 0.7 })); scrollM.position.set(-2.8, 2.55, -4.5); scene.add(scrollM);
const vase = buildVase('spring'); vase.position.set(-3.9, 0.22, -3.9); vase.scale.setScalar(1.0); scene.add(vase);
for (const [x, z] of [[4.4, -3.2], [-5.2, -1.4]]) { const a = buildAndon(); a.position.set(x, 0, z); scene.add(a); const l = new THREE.PointLight(0xffb866, 6, 9, 1.6); l.position.set(x, 0.8, z); scene.add(l); glow(x, 0.7, z, 2.6, 0xffc070, 0.55); }
glow(-4, 5.2, -5, 12, 0xffd7a0, 0.55); glow(5, 4.5, -5, 10, 0xffc890, 0.4);

// mats
const straw = strawTextures(), geos = makeMatGeos();
const strawMat = (c) => new THREE.MeshStandardMaterial({ map: straw.map, bumpMap: straw.bump, bumpScale: 1.4, roughness: 0.8, color: c });
const heriMat = new THREE.MeshStandardMaterial({ map: heriTexture('#1f2958', '#e0b850'), roughness: 0.5 });
const emblemMat = new THREE.MeshStandardMaterial({ color: 0xe8c060, roughness: 0.35, metalness: 0.8, emissive: 0x3a2a08 });
function mat(x, z, y, ry = 0, rx = 0, rz = 0, color = 0xc9c27f, given = false) {
  const g = new THREE.Group(), c = new THREE.Mesh(geos.fullCore, strawMat(color)); c.castShadow = true; c.receiveShadow = true;
  const h = new THREE.Mesh(geos.fullHeri, heriMat); h.receiveShadow = true; g.add(c, h);
  if (given) { const e = new THREE.Mesh(geos.emblem, emblemMat); e.position.y = MAT.TH - 0.002; g.add(e); }
  g.position.set(x, y, z); g.rotation.set(rx, ry, rz, 'YXZ'); scene.add(g); return g;
}
const Y0 = 0;
mat(-2.3, -0.5, Y0, 0, 0, 0, 0xcfc884, true);             // laid, far row
mat(-0.3, -0.5, Y0, 0, 0, 0, 0xbab36f);
mat(1.7, -0.5, Y0, 0, 0, 0, 0xc9c27c);
mat(-3.3, 0.5, Y0, 0, 0, 0, 0xc4bd78);                    // laid, near row (a staggered joint, never four corners)
mat(0.7, 0.5, Y0, 0, 0, 0, 0xcfc884, true);
const held = mat(-1.3, 0.5, Y0 + 0.1, 0.0, 0.0, 0.07, 0xd8d190);   // the mat being slid and set down into the gap, still a hair above the floor

// the two modelled hands press the mat's raised end from the right, palms flat on the rush, kimono sleeves trailing out of the frame
held.updateMatrixWorld(true);
for (const side of ['R', 'L']) {
  const arm = await createArm(THREE, side, { cloth: '#8c1f3f', voxel: Number(q.get('voxel') || 0.13) });
  scene.add(arm.object, arm.root); (window.__arms ||= []).push(arm);
  const contact = held.localToWorld(new THREE.Vector3(Number(q.get('hx') || 0.8), MAT.TH + 0.002, side === 'R' ? -0.25 : 0.25));
  arm.state.prev.copy(contact);
  arm.pose(contact, { dirF: new THREE.Vector3(-1, 0, side === 'R' ? 0.1 : -0.1), tilt: -0.07 + Number(q.get('tilt') || 0), dt: 1 / 30 });
  for (let i = 0; i < 40; i++) arm.pose(contact, { dirF: new THREE.Vector3(-1, 0, side === 'R' ? 0.1 : -0.1), tilt: -0.07 + Number(q.get('tilt') || 0), dt: 1 / 30, clock: 1 });
}

// motes
const r = rng(9);
for (let i = 0; i < 26; i++) glow(-4 + r() * 8, 0.4 + r() * 3.4, -2 + r() * 5, 0.12 + r() * 0.12, 0xfff0c0, 0.8);
for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.06, 6), new THREE.MeshBasicMaterial({ color: 0xffb8cc, side: THREE.DoubleSide })); m.position.set(-3 + r() * 6, 0.5 + r() * 3, -2 + r() * 4); m.rotation.set(r() * 3, r() * 3, r() * 3); scene.add(m); }

const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 34), 1, 0.3, 200);
const tgt = new THREE.Vector3(Number(q.get('tx') || -0.7), Number(q.get('ty') || 0.2), Number(q.get('tz') || 0.45));
const pos = new THREE.Vector3(Number(q.get('cx') || -0.3), Number(q.get('cy') || 0.95), Number(q.get('cz') || 2.1));
cam.position.copy(pos); cam.lookAt(tgt);

renderer.render(scene, cam);
const snap = document.createElement('canvas'); snap.width = snap.height = SIZE; snap.getContext('2d').drawImage(gl, 0, 0);

// composite: tilt-shift depth of field, bloom, vignette, a glint
ctx.fillStyle = '#0a0612'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.010}px)`; ctx.drawImage(snap, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
{
  const sharp = document.createElement('canvas'); sharp.width = sharp.height = SIZE; const sx = sharp.getContext('2d');
  sx.drawImage(snap, 0, 0); sx.globalCompositeOperation = 'destination-in';
  const m = sx.createLinearGradient(0, 0, 0, SIZE); m.addColorStop(0, 'rgba(0,0,0,0.0)'); m.addColorStop(0.28, 'rgba(0,0,0,0.7)'); m.addColorStop(0.42, 'rgba(0,0,0,1)'); m.addColorStop(0.95, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0.8)');
  sx.fillStyle = m; sx.fillRect(0, 0, SIZE, SIZE); ctx.drawImage(sharp, 0, 0);
}
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.018}px)`; ctx.globalAlpha = 0.16; ctx.drawImage(snap, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE * 0.52, SIZE * 0.36, SIZE / 2, SIZE / 2, SIZE * 0.78); v.addColorStop(0, 'rgba(8,2,6,0)'); v.addColorStop(1, 'rgba(6,2,4,0.7)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);

const small = document.createElement('canvas'); small.width = small.height = 1024; const sm = small.getContext('2d'); sm.imageSmoothingQuality = 'high'; sm.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
