// Offline app-icon render (developer tool): the SAME world and singers the game uses, a close three-quarter framing of the three
// singers mid-song with the lantern light behind them, composited with bloom + vignette. Exposes window.__icon for tools/render-icon.mjs.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { FINGER_POSES } from '../vendor3d/index.js';
import { SINGERS, buildSetting, buildSinger, fingerPose, cv, blobCanvas, tex } from './world.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048), TAU = Math.PI * 2;
const gl = cv(SIZE);
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a1230); scene.fog = new THREE.Fog(0x2a1c36, 9, 26);
B.createEnvironment(renderer, scene, { intensity: 0.5 });
const hemi = new THREE.HemisphereLight(0x9a88c8, 0x3a2418, 0.6);
const key = new THREE.DirectionalLight(0xffc890, 2.8); key.position.set(-3, 3.6, 4.2); key.target.position.set(0, 1.5, 0); key.castShadow = true;
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -1, near: 1, far: 18 }); key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
const rim = new THREE.DirectionalLight(0xffb070, 3.2); rim.position.set(3.5, 3, -4); rim.target.position.set(0, 1.5, 0);
const rim2 = new THREE.DirectionalLight(0x8aa4ff, 1.4); rim2.position.set(-4, 2.6, -3);
scene.add(hemi, key, key.target, rim, rim.target, rim2);
const warm = new THREE.PointLight(0xffa860, 9, 7, 1.6); warm.position.set(0, 2.5, -0.9); scene.add(warm);

const world = buildSetting(scene, { tier: 2 });
const FP = FINGER_POSES;
for (const spec of SINGERS) {
  const S = await buildSinger(scene, spec, {});
  const h = S.human, i = SINGERS.indexOf(spec), sx = spec.x, sh = 1.38;
  const arm = (side, x, y, z, pole) => h.setReach(side, { x, y, z }, { weight: 1, pole });
  if (i === 0) { arm('L', sx + 0.5, sh, -0.13, { x: sx + 0.35, y: 1.15, z: -0.55 }); arm('R', sx - 0.2, 1.16, 0.18, { x: sx - 0.45, y: 1.0, z: -0.15 }); }
  if (i === 1) { arm('L', sx + 0.5, sh, -0.13, { x: sx + 0.35, y: 1.15, z: -0.55 }); arm('R', sx - 0.5, sh, -0.13, { x: sx - 0.35, y: 1.15, z: -0.55 }); }
  if (i === 2) { arm('R', sx - 0.5, sh, -0.13, { x: sx - 0.35, y: 1.15, z: -0.55 }); arm('L', sx + 0.16, 1.56, 0.26, { x: sx + 0.5, y: 1.3, z: -0.25 }); }
  h.setFingers('L', fingerPose(FP, i === 2 ? 0.8 : 0.3)); h.setFingers('R', fingerPose(FP, i === 0 ? 0.8 : 0.3));
  h.lookAt({ x: [0.2, 0.0, -0.3][i] * 3, y: 1.62, z: 3 }, { weight: 0.8, maxYaw: 0.7, maxPitch: 0.4 });
  for (let n = 0; n < 40; n++) h.update(1 / 60);
  S.mouth.visible = true; S.mouth.scale.set([0.04, 0.026, 0.034][i], [0.034, 0.03, 0.03][i], 1);
  h.root.updateMatrixWorld(true); h.limbSanity();
}
// lantern halos
for (const l of world.lanterns) { l.halo.scale.setScalar(2.2); }

const cam = new THREE.PerspectiveCamera(25, 1, 0.1, 80);
cam.position.set(0.0, 2.05, 4.5); cam.lookAt(0, 1.38, 0);
renderer.setClearColor(0x000000, 0); renderer.render(scene, cam);
const subject = cv(SIZE); subject.getContext('2d').drawImage(gl, 0, 0);
const out = cv(SIZE), ctx = out.getContext('2d'); document.body.appendChild(out); out.style.width = '1024px'; out.style.height = '1024px';
ctx.drawImage(subject, 0, 0);
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.016}px)`; ctx.globalAlpha = 0.16; ctx.drawImage(subject, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.34, SIZE / 2, SIZE / 2, SIZE * 0.74); v.addColorStop(0, 'rgba(10,4,0,0)'); v.addColorStop(1, 'rgba(8,3,10,0.7)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const fin = cv(1024), fx = fin.getContext('2d'); fx.imageSmoothingQuality = 'high'; fx.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => fin.toDataURL('image/png'); window.__iconJpeg = () => fin.toDataURL('image/jpeg', 0.93);
void blobCanvas; void tex; void TAU;
document.title = 'ready';
