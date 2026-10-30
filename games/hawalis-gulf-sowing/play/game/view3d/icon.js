// Store icon, rendered from the game's own 3D world (icon.html, 1024 x 1024, opaque). One subject: a carved hole heaped with pearls,
// a pearl dropping into it, brass studs in the warm window light, the Sadu band and the far rows falling away into the room.
import * as THREE from '../vendor3d/three.js';
import { TOP, PR, holeW, seedSlot, buildBoard, buildRoom, buildDallah, buildLights, pearlGeos, pearlMaterial, pearlTone, radialTex } from './world.js';

const S = 1024, canvas = document.createElement('canvas'); canvas.width = canvas.height = S; document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(S, S, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2a1810); scene.fog = new THREE.Fog(0x2a160c, 22, 85);
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6;
const L = buildLights(scene); L.sun.shadow.mapSize.set(4096, 4096); L.sun.shadow.normalBias = 0.05; L.sun.position.set(-40, 45, -30); L.sun.intensity = 3.2; L.hemi.intensity = 0.45; L.rim.intensity = 1.4; L.rim.position.set(-20, 20, -60);
const sc = L.sun.shadow.camera; sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32;
buildRoom(scene, { quality: 1 });
scene.add(buildBoard('dhow', 2048));
const d = buildDallah(); d.position.set(-40, 0, -34); d.rotation.y = 0.8; d.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(d);
const geos = pearlGeos(), mat = pearlMaterial();
const HERO = 23;
const put = (seed, x, y, z) => { const m = new THREE.Mesh(geos[seed % 3], mat.clone()); m.material.color = pearlTone(seed); m.position.set(x, y, z); m.rotation.set(seed, seed * 2, 0); m.castShadow = true; m.receiveShadow = true; scene.add(m); };
for (let i = 0; i < 28; i++) { const n = i === HERO ? 12 : i === 22 || i === 24 ? 4 : 2; for (let k = 0; k < n; k++) { const p = seedSlot(i, k); put(i * 53 + k, p.x, p.y, p.z); } }
// the pearl dropping in, with a soft light under it
const h = holeW(HERO); put(7, h.x + 2.6, TOP + 5.0, h.z + 3.4);
const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: radialTex('255,214,140', 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
glow.rotation.x = -Math.PI / 2; glow.position.set(h.x, TOP - 0.6, h.z); glow.material.opacity = 0.35; scene.add(glow);
const pl = new THREE.PointLight(0xffd29a, 5, 30, 2); pl.position.set(h.x + 3, TOP + 8, h.z + 6); scene.add(pl);
const cam = new THREE.PerspectiveCamera(34, 1, 0.5, 600);
cam.position.set(h.x + 9, TOP + 8.5, h.z + 13); cam.lookAt(h.x - 1.6, TOP + 1.6, h.z - 3.5);
renderer.render(scene, cam);
// vignette
const out = document.createElement('canvas'); out.width = out.height = S; const x = out.getContext('2d');
x.drawImage(canvas, 0, 0); const g = x.createRadialGradient(S / 2, S * 0.48, S * 0.3, S / 2, S / 2, S * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,4,0,0.55)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
canvas.replaceWith(out); out.style.cssText = 'display:block;width:1024px;height:1024px';
window.__icon = out.toDataURL('image/png'); window.__iconDone = true;
void PR;
