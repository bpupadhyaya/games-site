// Offline app-icon render (developer tool, not part of the game): open icon.html?size=2048 in headless Chrome with real WebGL; the result
// is window.__icon (PNG data URL, 1024). Same world as the game (world.js): a rice-flour kolam on the damp granite doorstep in low morning
// sun, the last stretch of the line still being laid, flour trickling onto its tip. One subject, raking light, soft falloff.
import * as THREE from '../vendor3d/three.js';
import * as B3 from '../vendor3d/board3d.js';
import { PITCH, SLAB_H, SLAB_M, lookOf, slabMesh, floorMesh, wetMesh, paintFlour, MARGIN, softDot } from './world.js';
import { puzzleById } from '../src/puzzles.js';
import { patternSeq } from '../src/boardview.js';
import { tipOf } from './presenter.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const L = lookOf('stone'), scene = new THREE.Scene(); scene.background = new THREE.Color(L.bg); scene.fog = new THREE.Fog(L.bg, num('fn', 160), num('ff', 420));
const puz = puzzleById(q.get('p') || 'p1-5'), Bd = puz.B, seq = patternSeq(Bd, puz.sol), upTo = seq.length - num('left', 0.45);
const sw = (Bd.bounds.w + SLAB_M * 2) * PITCH, sd = (Bd.bounds.h + SLAB_M * 2) * PITCH;
scene.add(floorMesh('earth'));
const slab = slabMesh(sw, sd, { ...L, slab: [q.get('sc') ? '#' + q.get('sc') : '#1f1e1e', '#2a2928'] }); scene.add(slab);
const wet = wetMesh(sw * 0.96, sd * 0.96); wet.position.y = SLAB_H + 0.01; scene.add(wet);
const s = 260, c = document.createElement('canvas'); c.width = Math.round((Bd.bounds.w + MARGIN * 2) * s); c.height = Math.round((Bd.bounds.h + MARGIN * 2) * s);
paintFlour(c, Bd, [[seq, 0, upTo]], s, { wk: num('wk', 1.7), dk: 1.3, grain: num('grain', 0.45), scatter: num('scat', 0.5) });
const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
const fm = new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 2, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: num('em', 0.3), transparent: true, roughness: 0.95, depthWrite: false, color: L.powder });
const fl = new THREE.Mesh(new THREE.PlaneGeometry((Bd.bounds.w + MARGIN * 2) * PITCH, (Bd.bounds.h + MARGIN * 2) * PITCH), fm); fl.rotation.x = -Math.PI / 2; fl.position.y = SLAB_H + 0.04; fl.receiveShadow = true; scene.add(fl);
// flour trickling onto the tip
const tp = tipOf(seq, upTo), tx = (tp[0] - Bd.cx) * PITCH, tz = (tp[1] - Bd.cy) * PITCH, N = 260, pos = new Float32Array(N * 3);
for (let i = 0; i < N; i++) { const u = i / N, y = 22 * (1 - u * u), sp = 0.05 + (1 - y / 22) * 0.35; pos[i * 3] = tx + Math.sin(i * 12.9) * sp; pos[i * 3 + 1] = SLAB_H + 0.2 + y; pos[i * 3 + 2] = tz + Math.cos(i * 7.3) * sp; }
const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
scene.add(new THREE.Points(g, new THREE.PointsMaterial({ map: softDot('255,252,244'), size: num('gs', 0.5), transparent: true, depthWrite: false, color: 0xfffaf0 })));
const sun = new THREE.SpotLight(q.has('warm') ? 0xffb874 : L.sun, num('sun', 3.4), 0, 0.5, 1, 0); sun.position.set(num('lx', -230), num('ly', 150), num('lz', -190)); sun.target.position.set(4, 0, 6);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003; sun.shadow.radius = 5; Object.assign(sun.shadow.camera, { near: 150, far: 800 });
const rim = new THREE.DirectionalLight(0xa8c0ff, num('rim', 0.5)); rim.position.set(120, 60, 140);
scene.add(sun, sun.target, rim, new THREE.HemisphereLight(L.sky, L.ground, num('hemi', 0.45)));
const cam = new THREE.PerspectiveCamera(num('fov', 30), 1, 1, 2000);
const yaw = num('yaw', 45) * Math.PI / 180, tilt = num('tilt', 58) * Math.PI / 180, dist = num('dist', 118);
const tgt = new THREE.Vector3(num('tx', 0), SLAB_H, num('tz', 1));
cam.position.set(tgt.x + Math.sin(yaw) * Math.cos(tilt) * dist, tgt.y + Math.sin(tilt) * dist, tgt.z + Math.cos(yaw) * Math.cos(tilt) * dist); cam.lookAt(tgt);
const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = num('env', 0.3);
B3.renderIcon({ scene, camera: cam, size: SIZE, background: L.bg, bloom: num('bloom', 0.14), vignette: num('vig', 0.55), renderer: r, exposure: num('exp', 1.0) });
