// Offline app-icon render (node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store): the real balance, a cast fish weight and a heap of gold dust.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import * as MD from './models.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
await document.fonts.load('400 40px "Dela Gothic One"').catch(() => {});
const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
const scene = new THREE.Scene();
B.createEnvironment(renderer, scene, { intensity: 0.5 });
scene.add(new THREE.HemisphereLight(0xffd8b0, 0x2a1a3a, 0.6));
const key = new THREE.DirectionalLight(0xffdca8, 2.6); key.position.set(-3, 4, 5); key.castShadow = true;
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 }); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
const rim = new THREE.DirectionalLight(0x9db8ff, 1.4); rim.position.set(4, 3, -4);
scene.add(key, rim);

// backdrop: blurred woven cloth + warm glow
const wallTex = new THREE.CanvasTexture(MD.kenteCanvas(1024, 1024, 4, 'dusk')); wallTex.colorSpace = THREE.SRGBColorSpace;
const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: wallTex, color: 0xb8a0d0 })); wall.position.set(0, 0, -3.2); scene.add(wall);
const glow = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(MD.glowCanvas('255,190,100', 128, 1)), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
glow.position.set(-1.6, 0.9, -2.8); glow.material.opacity = 0.55; scene.add(glow);
// table + runner
const table = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 5), MD.M.wood()); table.position.set(0, -1.3, -0.4); table.material = table.material.clone(); table.material.color.setHex(0xa09088); table.receiveShadow = true; scene.add(table);
const rt = new THREE.CanvasTexture(MD.runnerCanvas(9)); rt.colorSpace = THREE.SRGBColorSpace;
const runner = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.02, 1.1), new THREE.MeshStandardMaterial({ map: rt, roughness: 0.9, color: 0xc8b8a0 })); runner.position.set(0, -0.79, 0.1); runner.receiveShadow = true; scene.add(runner);

// balance (beam half length 1)
const ang = 0.09, piv = [0, 1.15], bal = MD.makeBalance(); scene.add(bal);
const u = bal.userData, pillarH = 1.75;
bal.position.set(piv[0], piv[1], 0);
u.pillar.scale.set(1, pillarH, 1); u.pillar.position.set(0, -pillarH, 0);
u.base.scale.set(0.72, 0.72, 0.72 * 0.7); u.base.position.set(0, -(pillarH + 0.13), 0);
u.beam.rotation.z = ang; u.beam.add(u.needle); u.needle.position.set(0, 0, 0.07); u.needle.rotation.z = ang;
bal.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
const ends = [[-Math.cos(ang), piv[1] - Math.sin(ang)], [Math.cos(ang), piv[1] + Math.sin(ang)]], chain = 1.0, dw = 0.6;
const centres = ends.map((e) => [e[0], e[1] - chain]);
centres.forEach((c, s) => {
  const pan = MD.makePan(); pan.position.set(c[0], c[1], 0); pan.scale.set(dw, dw * 0.35, dw); scene.add(pan);
  const hook = [ends[s][0], ends[s][1] - 0.07, 0];
  for (const lg of [[c[0] - dw, c[1], 0], [c[0] + dw, c[1], 0], [c[0], c[1], -dw * 0.95], [c[0], c[1], dw * 0.95]]) { const l = MD.makeLink(MD.M.brassOld()); MD.placeLink(l, hook, lg, 0.012); scene.add(l); }
});
// gold heap in the left pan
{
  const c = centres[0], hh = 0.36, wd = 0.5, floorY = c[1] - 0.02, gold = MD.M.gold();
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold); mound.position.set(c[0], floorY, 0.0); mound.scale.set(wd, hh, wd * 0.8); mound.castShadow = true; scene.add(mound);
  const g = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 300; i++) {
    const a = MD.hash(i, 7) * Math.PI * 2, r = Math.sqrt(MD.hash(i, 17)) * 0.95, x = Math.cos(a) * r * wd, z = Math.sin(a) * r * wd * 0.8, k = Math.max(0, 1 - r * r);
    const m = new THREE.Mesh(g, gold); m.position.set(c[0] + x, floorY + hh * Math.pow(k, 0.8) * 1.0 + 0.012, z); m.scale.setScalar(0.015 * (0.6 + 0.8 * MD.hash(i, 5))); m.castShadow = true; scene.add(m);
  }
}
// cast weights in the right pan: the fish and the sun disc
{
  const c = centres[1], f = MD.makeWeight(2, { numerals: true }); f.scale.setScalar(0.62); f.position.set(c[0] - 0.16, c[1] - 0.02, 0.12); f.rotation.y = 0.12; scene.add(f);
  const d = MD.makeWeight(1, { numerals: true }); d.scale.setScalar(0.5); d.position.set(c[0] + 0.26, c[1] - 0.02, -0.12); d.rotation.y = -0.15; scene.add(d);
  f.traverse((o) => { if (o.isMesh) { o.castShadow = true; } }); d.traverse((o) => { if (o.isMesh) o.castShadow = true; });
}
const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 50);
camera.position.set(0.0, 1.0, 5.5); camera.lookAt(0, 0.12, 0);
renderer.shadowMap.type = THREE.PCFShadowMap;
B.renderIcon({ scene, camera, size, renderer, background: '#140a24', bloom: 0.28, vignette: 0.5, exposure: 0.95 });
