// Store icon, rendered offline from the game's own 3D models (icon.html?size=2048): the robin on its oak twig, wings lifting as a
// slingshot stone streaks past, low golden sun and soft out-of-focus leaves behind. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { buildBird, poseBird, buildStone, treeMats, radialTex, skyMaterial } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
scene.add(new THREE.HemisphereLight('#ffe9c8', '#3e5a2a', 1.0));
const sun = new THREE.DirectionalLight('#ffd9a0', 3.2); sun.position.set(-4, 3, 4); scene.add(sun);
const rim = new THREE.DirectionalLight('#ffc070', 3.0); rim.position.set(3, 2.5, -5); scene.add(rim);
// backdrop: a warm evening sky gradient with the sun low on the left, behind soft-focus leaves
const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMaterial());
const su = sky.material.uniforms; su.uHorizon.value = -0.2; su.uTop.value.set('#2f6fb8'); su.uMid.value.set('#7fb6d8'); su.uLow.value.set('#ffc878'); su.uSun.value.set(0.16, 0.34); su.uSunCol.value.set('#ffe2a8'); su.uAspect.value = 1;
sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
// bokeh leaves: blurred discs of green and gold light far behind
const bok = radialTex('255,255,255', 1);
for (let i = 0; i < 46; i++) {
  const h = (n) => (Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1, a = Math.abs(h(1)), b = Math.abs(h(2)), c = Math.abs(h(3));
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bok, transparent: true, depthWrite: false, opacity: 0.18 + c * 0.3, color: c < 0.35 ? '#ffd98a' : c < 0.7 ? '#7fbf5a' : '#3e7f3a' }));
  const r = 30 + b * 60; sp.scale.set(r, r, 1); sp.position.set(-260 + a * 520, -160 + b * 380 * (a < 0.3 ? 0.4 : 1), -380 - c * 100); scene.add(sp);
}
// the twig the robin grips: oak bark, a knot and a leaf spray
const mats = treeMats();
const twig = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 8.5, 260, 14), mats.bark); twig.rotation.z = Math.PI / 2 - 0.12; twig.position.set(-30, -68, 0); scene.add(twig);
// the robin, wings lifting: about to flit
const bird = buildBird(); bird.position.set(-14, -8, 0); bird.rotation.y = -0.75; bird.scale.setScalar(1.75);
poseBird(bird, { flying: false, open: 0.32, tilt: 0.08 });
scene.add(bird);
// the stone streaking past with a motion trail
const stone = buildStone(3); stone.scale.setScalar(9); stone.position.set(66, 72, 30); scene.add(stone);
const tc = document.createElement('canvas'); tc.width = 256; tc.height = 8; const tg = tc.getContext('2d'), gr = tg.createLinearGradient(0, 0, 256, 0);
gr.addColorStop(0, 'rgba(255,240,210,0)'); gr.addColorStop(1, 'rgba(255,245,225,0.85)'); tg.fillStyle = gr; tg.fillRect(0, 0, 256, 8);
const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push(new THREE.Vector3(230 - u * 162, 116 - u * 43, 30)); }
scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 3.2, 8), new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
const cam = new THREE.PerspectiveCamera(34, 1, 1, 4000);
cam.position.set(30, 10, 330); cam.lookAt(14, 12, 0);
renderIcon({ scene, camera: cam, size, renderer, background: '#2a4a6a', bloom: 0.14, vignette: 0.42, exposure: 0.95 });
