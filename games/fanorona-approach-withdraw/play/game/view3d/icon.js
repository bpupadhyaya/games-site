// Store icon, rendered from the game's own 3D world (icon.html, 1024 x 1024, opaque). One subject: a dark stone closing on a row of
// ivory stones on the carved board, lit from behind by the low sun, baobab silhouettes in the haze.
import * as THREE from '../vendor3d/three.js';
import { TOP, pointW, buildBoard, buildScenery, buildLights, stoneMats, makeStone, radialTex, FOG } from './world.js';
import { themeOf } from '../src/art.js';
import { idx } from '../src/rules.js';

const S = 1024, canvas = document.createElement('canvas'); canvas.width = canvas.height = S; document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(S, S, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.7;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x7a3a20, 300, 2200);
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3;
const L = buildLights(scene); L.key.shadow.mapSize.set(4096, 4096); L.key.intensity = 3.4; L.hemi.intensity = 0.28; L.fill.intensity = 0.25; L.rim.intensity = 4; L.key.position.set(-60, 30, -140);
const T = themeOf('rosewood'); scene.add(buildScenery()); scene.add(buildBoard(T, 2048));
const M = stoneMats(T), put = (side, r, c, dy = 0, dx = 0) => { const o = makeStone(side, M), w = pointW(idx(r, c)); o.position.set(w.x + dx, TOP + 0.02 + dy, w.z); o.scale.setScalar(1.0); scene.add(o); return o; };
for (const c of [2, 3, 5, 6]) put(1, 0, c); put(1, 1, 4); put(1, 1, 3); put(2, 2, 4, 3.0, 0); put(2, 3, 3); put(2, 3, 5); put(2, 2, 2);
scene.traverse((o) => { if (o.isMesh) o.castShadow = true; });
const glow = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshBasicMaterial({ map: radialTex('255,170,70', 0.9, 256), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
glow.position.set(0, TOP + 12, -90); glow.material.opacity = 0.45; scene.add(glow);
const cam = new THREE.PerspectiveCamera(34, 1, 1, 4000); cam.position.set(5, TOP + 11, 50); cam.lookAt(0, TOP + 8.5, -8); glow.lookAt(cam.position);
renderer.render(scene, cam);
const out = document.createElement('canvas'); out.width = out.height = S; const x = out.getContext('2d');
x.drawImage(canvas, 0, 0);
x.globalCompositeOperation = 'screen'; x.filter = 'blur(16px)'; x.globalAlpha = 0.25; x.drawImage(canvas, 0, 0); x.filter = 'none'; x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
const g = x.createRadialGradient(S / 2, S * 0.5, S * 0.22, S / 2, S / 2, S * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(14,3,6,0.85)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
canvas.replaceWith(out); out.style.cssText = 'display:block;width:1024px;height:1024px';
window.__icon = out.toDataURL('image/png'); window.__iconDone = true; document.title = 'icon done';
