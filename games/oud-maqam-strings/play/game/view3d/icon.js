// Store icon, rendered offline from the game's own 3D oud (icon.html?size=2048): one bold subject, the whole oud lying diagonally,
// its carved rose catching a warm lamp, on dark teal cloth with a soft pool of light. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { materials, buildOud, oudShadow, radialTex } from './world.js';
import { HERO } from './presenter.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.25;
const M = materials();
// cloth under the instrument: dark teal, lit in a warm pool
const cloth = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x123a40, roughness: 0.95 }));
cloth.rotation.x = -Math.PI / 2; cloth.receiveShadow = true; scene.add(cloth);
const oud = buildOud(HERO, M, 1), root = new THREE.Group(); root.add(oud.group); scene.add(root);
oud.group.position.set(-(HERO.Lneck + HERO.Lbody) / 2 - 4, oud.dep + 0.3, 0);
oud.group.add(oudShadow(HERO, oud.dep + 0.3));
root.rotation.y = 0.8 + Math.PI;
for (const s of oud.strings) s.uni.uAmp.value = 0;
const hemi = new THREE.HemisphereLight(0x3a7a80, 0x140804, 0.35); scene.add(hemi);
const key = new THREE.SpotLight(0xffd29a, 1.9, 0, 0.42, 0.9, 0); key.position.set(-70, 170, 40); key.target.position.set(-6, 0, 8);
key.castShadow = true; key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.05; scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x7fe0d6, 0.9); rim.position.set(120, 60, -140); scene.add(rim);
// a warm glow inside the rose, as if the lamp shone through it
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,200,120', 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35, toneMapped: false }));
glow.scale.set(40, 40, 1); scene.add(glow);
root.updateMatrixWorld(true);
const rp = new THREE.Vector3(oud.rU, 1, 0).applyMatrix4(oud.group.matrixWorld); glow.position.copy(rp);
const cam = new THREE.PerspectiveCamera(30, 1, 2, 3000);
cam.position.set(-12, 146, 96); cam.lookAt(new THREE.Vector3(-5, 4, 2));
renderIcon({ scene, camera: cam, size, renderer, background: '#081a1e', bloom: 0.22, vignette: 0.6, exposure: 1.0 });
