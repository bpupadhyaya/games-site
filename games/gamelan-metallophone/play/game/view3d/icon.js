// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a low, close look along the bronze keys of the
// metallophone, one key just struck and glowing, the padded mallet lifting off it, the big gong glowing in the lamplit dark behind.
// No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { KEY_Y, GONG_R, materials, buildGender, buildGong, buildGayor, buildMallet, buildHall, buildLights, radialTex, warmEnvScene } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0504);
scene.fog = new THREE.Fog(0x0c0403, 260, 900);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(warmEnvScene(), 0.03).texture; scene.environmentIntensity = 1;
const L = buildLights(scene); L.key.castShadow = true; L.key.shadow.mapSize.set(4096, 4096);
const M = materials();
buildHall(scene, M, { quality: 1 });
const g = buildGender(5, M); scene.add(g.group);
// the struck key: warm glow from inside the bronze and a halo on its surface
const hot = g.keys[2]; hot.mat.emissive.set(0xff9a40); hot.mat.emissiveIntensity = 0.3;
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,190,110', 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, toneMapped: false }));
halo.position.set(hot.x, KEY_Y + 2, 2); halo.scale.set(20, 20, 1); halo.material.opacity = 0.4; scene.add(halo);
g.keys[1].mat.emissive.set(0xff9a40); g.keys[1].mat.emissiveIntensity = 0.08;
// the mallet a few centimetres above the struck key, rising
const m = buildMallet(M); m.group.position.set(hot.x + 0.6, KEY_Y + 4.5, 2.5); m.head.rotation.set(1.15, 0.25, 0, 'YXZ'); scene.add(m.group);
// the big gong behind, softly lit
const st = buildGayor(GONG_R.gong, M), gg = buildGong('gong', M); gg.group.position.y = st.hangY - st.pivot.position.y; st.pivot.add(gg.group);
st.group.position.set(-27, 0, -112); st.group.rotation.y = 0.5; scene.add(st.group);
gg.mat.emissive.set(0xff8a30); gg.mat.emissiveIntensity = 0.05;
const gl = new THREE.PointLight(0xffb070, 22000, 400, 2); gl.position.set(-20, 120, -80); scene.add(gl);
// camera: low at the player's side, looking along the keys toward the gong
const cam = new THREE.PerspectiveCamera(38, 1, 2, 3000);
cam.position.set(38, KEY_Y + 44, 62); cam.lookAt(new THREE.Vector3(-8, KEY_Y + 14, -30));
renderIcon({ scene, camera: cam, size, renderer, background: '#0c0504', bloom: 0.2, vignette: 0.55, exposure: 0.85 });
