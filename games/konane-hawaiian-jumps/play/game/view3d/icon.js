// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): a low look across the papamū at golden hour, a
// basalt pebble in the air jumping over a coral pebble, the sea and the low sun behind. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { TOP, cupPos, restY, buildRock, stoneGeos, stoneMaterials, buildBeach, buildLights, buildBowl } from './world.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd88a6a, 700, 4800);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35;
const L = buildLights(scene); L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096);
const sunDir = new THREE.Vector3(0.18, 0.13, -1).normalize();           // the sun a hand above the sea, behind the jumping stone
L.sun.position.copy(sunDir).multiplyScalar(160); L.sun.intensity = 3.6; L.rim.intensity = 1.4;
const beach = buildBeach(scene, { quality: 1 }); beach.sky.material.uniforms.uSun.value.copy(sunDir); beach.sky.material.uniforms.uGlow.value = 0.55;
const n = 6, rock = buildRock(n, 2048); scene.add(rock);
const geos = stoneGeos(), mats = stoneMaterials();
// a mid-game position (B = basalt, W = coral, . = empty cup); the jumper leaves cup (2,4) over (2,3) into (2,2), away from the viewer
const rows = ['BW.WBW', 'W.WB.B', 'BW.WBW', 'W.W.WB', 'BW..BW', 'WBWBWB'];
const put = (kind, v, x, y, z, yaw, tx = 0, tz = 0) => { const m = new THREE.Mesh(geos[kind][v % 3], mats[kind]); m.position.set(x, y, z); m.rotation.set(tx, yaw, tz, 'YXZ'); m.castShadow = true; m.receiveShadow = true; scene.add(m); };
rows.forEach((r, gy) => [...r].forEach((ch, gx) => { if (ch === '.') return; const c = cupPos(n, gy * n + gx); put(ch === 'B' ? 1 : 2, gx + gy, c.x, restY(), c.z, (gx * 1.7 + gy * 2.3) % 6.28); }));
const from = cupPos(n, 3 * n + 1), to = cupPos(n, 3 * n + 3), R0 = restY();
const arc = (u) => new THREE.Vector3(from.x + (to.x - from.x) * u, R0 + Math.sin(Math.PI * u) * 4.2, from.z + (to.z - from.z) * u);
const U = 0.62, jp = arc(U), jx = jp.x, jy = jp.y, jz = jp.z;
put(1, 1, jx, jy, jz, 0.3, 0.05, -0.28);
// the path of the jump: a fading streak of light behind the stone
const pts = []; for (let i = 0; i <= 30; i++) pts.push(arc(0.06 + (U - 0.14) * i / 30));
const tc = document.createElement('canvas'); tc.width = 256; tc.height = 4; const tg = tc.getContext('2d'), gr = tg.createLinearGradient(0, 0, 256, 0);
gr.addColorStop(0, 'rgba(255,200,120,0)'); gr.addColorStop(1, 'rgba(255,226,160,0.9)'); tg.fillStyle = gr; tg.fillRect(0, 0, 256, 4);
const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
const trail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.16, 8), new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
scene.add(trail);
// camera: low, behind the jumper's start cup, looking along the jump toward the sun
const cam = new THREE.PerspectiveCamera(36, 1, 1, 9000);
const tgt = new THREE.Vector3(jx + 0.6, jy - 1.2, jz - 3);
cam.position.set(jx - 2.5, TOP + 4.4, jz + 16); cam.lookAt(tgt);
void buildBowl;
renderIcon({ scene, camera: cam, size, renderer, background: '#2a1a22', bloom: 0.12, vignette: 0.5, exposure: 0.8 });
