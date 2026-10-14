// Offline app-icon render: the SAME models the game uses. One golden ball with sauce, mayo, aonori and bonito flakes lifted on two picks
// above the cast-iron pan, two more balls in their moulds, steam, warm lantern bokeh behind. No text.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import * as M3 from './models.js';
const SIZE = Number(new URLSearchParams(location.search).get('size') || 2048);
const scene = new THREE.Scene();
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.72;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; scene.environmentIntensity = 0.4; pm.dispose();
const key = new THREE.DirectionalLight(0xffdcae, 2.1); key.position.set(-6, 12, 8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 40 }); key.shadow.bias = -0.0006;
const rim = new THREE.DirectionalLight(0xff9a50, 2.2); rim.position.set(5, 5, -8);
scene.add(new THREE.HemisphereLight(0xffe6c8, 0x2a1a10, 0.55), key, rim);
const stall = M3.buildStall({ cols: 4, rows: 3 }); scene.add(stall.group);
const pan = M3.buildPan(3, 2, 1); scene.add(pan);
const M = M3.mats();
const put = (i, q, b, sc = 0.4) => {
  const ball = M3.makeBall(1), mo = pan.userData.moulds[i];
  ball.raw.visible = false; ball.burnt.visible = false; ball.disc.visible = false; ball.skirt.visible = false;
  ball.paint(q, 1); ball.spin.rotation.set((b + 1) * Math.PI / 2, 0.3 * i, 0);
  ball.root.position.set(mo.x, 0.04, mo.z); ball.root.scale.setScalar(sc); scene.add(ball.root);
};
put(0, [0.8, 0.85, 0.75, 0.9], 0); put(1, [0.9, 0.8, 0.85, 0.8], 1); put(2, [0.85, 0.9, 0.8, 0.85], 2); put(3, [0.8, 0.85, 0.9, 0.75], 3); put(5, [0.9, 0.8, 0.8, 0.85], 0);
// the hero ball: finished takoyaki with sauce, mayo, aonori and bonito flakes, in its mould, turned by two picks
const served = M3.makeServed(4); served.scale.setScalar(0.52); served.position.set(0, 0.1, 0.5); served.rotation.set(0.2, 0.4, 0); scene.add(served);
served.userData.update(2.2, 1.3);
const picks = M3.makePicks(); scene.add(picks);
const dir = new THREE.Vector3(-0.78, -0.42, -0.3).normalize(), tip = new THREE.Vector3(0.42, 0.42, 0.5);
picks.position.copy(tip).addScaledVector(dir, -3.8); picks.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
picks.children.forEach((p, i) => { p.rotation.y = (i ? 1 : -1) * 0.1; });
// steam
const st = M3.canvasTex(M3.blobCanvas('255,255,255', 0.9, 64), {});
for (let k = 0; k < 14; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, color: 0xffffff, transparent: true, opacity: 0.1 + 0.06 * (k % 3), depthWrite: false })); sp.position.set(-0.6 + (k * 0.37) % 1.4, 1.2 + k * 0.17, 0.2 - (k % 4) * 0.2); sp.scale.setScalar(0.9 + k * 0.1); scene.add(sp); }
scene.traverse((o) => { if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; } });
const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 100);
cam.position.set(-0.7, 3.4, 5.4); cam.lookAt(0.1, 0.45, 0.2);
window.__ready = true;
B.renderIcon({ scene, camera: cam, size: SIZE, renderer, background: '#0d0709', bloom: 0.35, vignette: 0.55, exposure: 0.72 });
