// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): close on the spirit bow with its single golden arrow
// over the carved stone platform, a huge moon behind, dark and bold. No text. Sets window.__icon() via renderIcon (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { makeMats, buildMoon, buildPlatform, buildCrystal, buildBow, buildConstruct, radialTex, GOLD } from './world.js';

const q = new URLSearchParams(location.search), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;
const mats = makeMats();
scene.add(new THREE.HemisphereLight(0x5a6ac0, 0x120a24, 0.4));
const key = new THREE.DirectionalLight(0xaebcff, num('key', 1.8)); key.position.set(5, 8, 7); scene.add(key);
const rim = new THREE.DirectionalLight(0xffb070, num('rim', 2.2)); rim.position.set(-6, 2, -8); scene.add(rim);
const gold = new THREE.PointLight(0xffd68c, 14, 30, 1); gold.position.set(0, 1.5, 5); scene.add(gold);
// backdrop: the big moon with its halo and a violet horizon glow
const moon = buildMoon(); moon.position.set(3.4, 4.0, -30); moon.scale.setScalar(num('moon', 3.4)); moon.children[0].material.color.setScalar(0.5); scene.add(moon);
const glow = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshBasicMaterial({ map: radialTex('90,60,170', 0.55, 256), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.set(0, -1, -35); scene.add(glow);
// the platform, tilted toward us, with the bow and arrow above it
const plat = buildPlatform(mats); plat.rotation.x = 0.5; plat.position.y = -2.45; plat.scale.setScalar(1.3); scene.add(plat);
const crystal = buildCrystal(mats); crystal.position.y = -3.2; scene.add(crystal);
const bow = buildBow(mats); bow.userData.setPull(num('pull', 0.15)); bow.position.set(0, num('by', 0.2), 0.3); bow.scale.setScalar(1.8); scene.add(bow);
bow.userData.glow.material.opacity = 0.6;
// a small ember construct far behind, to say what the arrow is for
void GOLD;
const cam = new THREE.PerspectiveCamera(num('fov', 34), 1, 0.5, 500);
cam.position.set(0, num('cy', -0.5), num('cz', 10)); cam.lookAt(0, num('ty', -0.7), 0);
renderIcon({ scene, camera: cam, size, renderer, background: '#04051a', bloom: 0.12, vignette: 0.85, exposure: num('exp', 0.85) });
