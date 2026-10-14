// Offline app-icon render from the game's own 3D models (node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store):
// the bronze touhu vase on its rush mat, two arrows already lodged and a third dropping in, the thrower's red wide sleeve and open hand just past the
// release, in front of a dark lacquered screen with warm lantern bokeh, over a polished board floor that mirrors the vase.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { makeVase, makeArrow, makeMat, makeLantern } from './models.js';
import { boardsTexture, glowTex } from './world.js';
import { createThrower, followBody } from './thrower.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const canvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
B.createEnvironment(renderer, scene, { intensity: 0.5 });
B.lightingRig(scene, 'duskOutdoor', { renderer, shadow: 4096, extent: 2.2, fog: false, target: [0, 0.35, 0],
  overrides: { bg: 0x1a0d09, key: 0xffcf90, keyI: 3.6, keyPos: [-1.6, 3.2, 3.4], hemi: 0.22, hemiSky: 0xffd9a8, hemiGround: 0x2a1a10, fill: 0x8fa8e0, fillI: 0.25, rim: 0xffa860, rimI: 3.2, rimPos: [2.5, 1.8, -2.5], exposure: 0.9, env: 0.42 } });
scene.background = new THREE.Color('#1a0d09');

// ---- floor: polished boards, with a mirrored vase and arrows under a semi-transparent surface --------------------------------------------------------
const bt = boardsTexture(); bt.repeat.set(2.4, 1.1);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshPhysicalMaterial({ map: bt, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2, transparent: true, opacity: 0.7, color: '#e8c8a8' }));
floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.5); floor.receiveShadow = true; floor.renderOrder = 5; scene.add(floor);

// ---- backdrop screen and bokeh --------------------------------------------------------------------------------------------------------------------
const c = document.createElement('canvas'); c.width = 8; c.height = 256; { const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#4a1a10'); g.addColorStop(0.5, '#8a2c18'); g.addColorStop(1, '#3a120a'); x.fillStyle = g; x.fillRect(0, 0, 8, 256); }
const ct = new THREE.CanvasTexture(c); ct.colorSpace = THREE.SRGBColorSpace;
const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: ct })); wall.position.set(0, 2.6, -2.6); scene.add(wall);
const gl = glowTex();
const bokeh = (x, y, z, s, col, a) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gl, color: col, transparent: true, opacity: a, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set(x, y, z); sp.scale.setScalar(s); scene.add(sp); };
for (let i = 0; i < 16; i++) { const h = (n) => { const v = Math.sin(n * 91.7 + i * 13.3) * 4375.5; return v - Math.floor(v); }; bokeh(-1.5 + h(1) * 2.4, 0.35 + h(2) * 1.3, -2.1 - h(3) * 0.8, 0.35 + h(4) * 0.7, i % 3 ? 0xff9a4a : 0xffc070, 0.35 + h(5) * 0.35); }
for (const [x, y, s2] of [[-0.75, 1.0, 0.9], [0.45, 1.05, 1.0]]) { const l = makeLantern('#b8301c'); l.traverse((o) => { if (o.material && o.material.emissiveIntensity) o.material.emissiveIntensity = 0.45; }); l.position.set(x, y, -1.9); l.scale.setScalar(s2 * 0.8); scene.add(l); bokeh(x, y, -1.8, 1.5 * s2, 0xff7a30, 0.5); }

bokeh(0.02, 0.5, -0.5, 1.5, 0xffb060, 0.45);

// ---- the subject -----------------------------------------------------------------------------------------------------------------------------------
const group = new THREE.Group(); scene.add(group);
const vase = makeVase(); vase.rotation.y = 0.5; group.add(vase);
const mat = makeMat(0.6, 0.5); group.add(mat);
const put = (side, x, y, th, roll = 0, z = 0) => { const a = makeArrow(side); a.position.set(x, y, z); a.rotation.set(roll, 0, th, 'ZYX'); group.add(a); return a; };
put(1, 0.012, 0.33, -1.44, 0.4, 0.012); put(0, -0.03, 0.30, -1.66, 2.0, -0.012);          // lodged
const flyer = put(0, -0.14, 0.7, -0.62, 0.8, 0.02);                                      // dropping in
put(1, -0.25, 0.03, 0.05, 1.2, 0.2);                                                      // one that bounced out and lies on the mat
void flyer;

// the thrower: the same robed rig as the game, mostly out of frame; the wide sleeve and the open hand just past the release enter from the left
const T = await createThrower({ g: 'm', kit: { top: '#a9281c', trim: '#f2c14e' }, skin: 'tan', hair: 'black', quality: 'high' });
group.add(T.root);
const h = T.h;
h.setPosition(-0.96, 0, 0.0); h.setFacing(Math.PI / 2 - 0.1); h.groundClamp = 'off'; h.footPlanting = false; h.play('idle'); h.update(0.016);
const sh = h.bonePosition('R_UpperArm', new THREE.Vector3());
h.setReach('R', new THREE.Vector3(-0.36, 0.74, 0.04), { weight: 1, pole: new THREE.Vector3(sh.x - 0.05, sh.y - 0.8, sh.z + 0.3) });
h.setFingers('R', 'open');
for (let i = 0; i < 8; i++) h.update(0.016);
followBody(T, 0.016, new THREE.Vector3());
// mirrored copies under the floor give the reflection
const mir = new THREE.Group(); mir.scale.y = -1; scene.add(mir);
const mv = makeVase(); mv.rotation.y = 0.5; mir.add(mv);
{ const a = makeArrow(0); a.position.set(-0.03, 0.30, -0.012); a.rotation.set(2.0, 0, -1.66, 'ZYX'); mir.add(a); const b2 = makeArrow(1); b2.position.set(0.012, 0.33, 0.012); b2.rotation.set(0.4, 0, -1.44, 'ZYX'); mir.add(b2); }
mir.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

const camera = new THREE.PerspectiveCamera(24, 1, 0.5, 60);
const tgt = new THREE.Vector3(-0.1, 0.46, 0.0), dist = 2.5, yaw = 0.36, pitch = 0.1;
camera.position.set(tgt.x + Math.sin(yaw) * Math.cos(pitch) * dist, tgt.y + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
camera.lookAt(tgt);
scene.updateMatrixWorld(true);
B.renderIcon({ scene, camera, size: SIZE, renderer, exposure: 0.92, background: '#1a0d09', bloom: 0.32, vignette: 0.55 });
document.title = 'READY';
