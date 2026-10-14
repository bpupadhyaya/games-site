// Offline app-icon render (developer tool, not part of the game): node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store
// Draws the SAME models the game uses (models.js): two mossy stone islands joined by a rope-and-plank bridge over a dusk pond, a
// stone lantern glowing, a pine, koi below, the torii and mountains in the haze. Tilt-shift depth of field, bloom, vignette, glints.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { LOOKS3D, makeParts, makePlankGeo, makePostGeo, makeRopeGeo, buildPine, buildToro, buildKoi, buildTorii, buildBlossom, waterNormal, softCanvas, skyTexture, ridgeTexture, TAU, rng } from './models.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; out.style.cssText = 'width:1024px;height:1024px'; document.body.appendChild(out);
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const look = { ...LOOKS3D.dusk, water: 0x2aa0b4, keyI: 3.4, hemi: 0.7, exposure: 0.95 };
const scene = new THREE.Scene();
const rig = B.lightingRig(scene, 'duskOutdoor', { renderer, shadow: 4096, extent: 7, target: [0, 0.2, 0], fog: { near: 34, far: 130 },
  overrides: { bg: look.fog, fog: look.fog, key: 0xffb88a, keyI: 3.6, keyPos: [-6, 4.5, -5], hemiSky: 0xffb0c8, hemiGround: 0x2a2040, hemi: 0.7, fill: 0x8aa8ff, fillI: 1.0, fillPos: [4, 3, 8], rim: 0xffd0a0, rimI: 1.4, rimPos: [6, 4, -6], exposure: 0.95, env: 0.6 } });

// sky + ridges + torii
const skyMat = new THREE.MeshBasicMaterial({ map: skyTexture(look), side: THREE.BackSide, fog: false, depthWrite: false });
scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), skyMat));
{ const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), new THREE.MeshBasicMaterial({ map: skyMat.map, side: THREE.BackSide }))); scene.environment = pm.fromScene(es, 0.03).texture; scene.environmentIntensity = 0.7; pm.dispose(); }
[-60, -80, -110].forEach((z, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(300, 46 + i * 10), new THREE.MeshBasicMaterial({ map: ridgeTexture(look.ridge[i], look.haze, 3 + i * 5, 0.55 - i * 0.08), transparent: true, fog: false, depthWrite: false })); m.position.set(-8 + i * 12, 10 + i * 3, z); scene.add(m); });
const glow = (x, y, z, s, col, op) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softCanvas('255,255,255', 1, false, 128), color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set(x, y, z); sp.scale.setScalar(s); scene.add(sp); return sp; };
glow(-14, 7, -70, 60, 0xffa060, 0.75); glow(0.3, 3.0, -60, 16, 0xffd9a0, 0.7);
const torii = buildTorii(look); torii.scale.setScalar(0.7); torii.position.set(0.3, 0, -22);
torii.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.envMapIntensity = 0.25; if (o.material.color && o.material.color.r > 0.5) o.material.color.set('#b3220f'); } }); scene.add(torii);

// water
const nm = waterNormal(); nm.repeat.set(10, 10);
const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshPhysicalMaterial({ color: look.water, roughness: 0.06, metalness: 0, normalMap: nm, normalScale: new THREE.Vector2(0.32, 0.32), clearcoat: 0.7, envMapIntensity: 1.8, transparent: true, opacity: 0.92 }));
water.rotation.x = -Math.PI / 2; water.receiveShadow = true; scene.add(water);
const bed = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: look.bed })); bed.rotation.x = -Math.PI / 2; bed.position.y = -0.7; scene.add(bed);

// islands
const parts = makeParts(look);
const stone = B.material('stone', { color: '#4e5a58', color2: '#8a928c', seed: 12 }), moss = new THREE.MeshStandardMaterial({ color: 0x4f9a3c, roughness: 0.95, emissive: 0x143a0c, emissiveIntensity: 0.6 });
const plaqueM = new THREE.MeshStandardMaterial({ color: 0xf6e7bd, roughness: 0.55 }), rimM = B.material('brass', { color: '#b88a3a', color2: '#e8c070' });
function island(x, z, s, ry, doneColor = null, plaque = true) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = ry;
  for (const [geo, mat] of [[parts.rock, stone], [parts.moss, moss], ...(plaque ? [[parts.plaque, doneColor ? new THREE.MeshStandardMaterial({ color: doneColor, roughness: 0.5 }) : plaqueM], [parts.plaqueRim, rimM]] : [])]) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  scene.add(g); return g;
}
const IX = 1.55, S = 1.9;
island(-IX, 0, S, 0.4, null, false); island(IX, 0, S, 2.1, 0x7fcf9a, true);
// pine on the left island, lantern on the right one
const pine = buildPine(1.0, 7); pine.position.set(-IX - 0.1 * S, 0.34, -0.12 * S); pine.scale.setScalar(1.05); scene.add(pine);
const toro = buildToro(0xffc070, 0.95); toro.position.set(IX + 0.36 * S, 0.3, -0.3 * S); scene.add(toro);
const lanternGlow = glow(IX + 0.36 * S, 0.3 + 1.2, -0.3 * S, 2.4, 0xffc070, 0.7);
const lantLight = new THREE.PointLight(0xffb060, 9, 7, 1.6); lantLight.position.copy(lanternGlow.position); scene.add(lantLight);


// the bridge: a gently humped plank deck with rope rails and posts
const woodM = B.material('wood', { color: '#8e5a2a', color2: '#b98445', seed: 8 }), postM = B.material('darkWood', { color: '#4a2a16' }), ropeM = new THREE.MeshStandardMaterial({ color: 0xe0c890, roughness: 0.9 });
const x0 = -IX + 0.5 * S * 0.62, x1 = IX - 0.5 * S * 0.62, n = 15, deckY = 0.4, hump = 0.16, W = 0.7;
const plank = makePlankGeo();
for (let i = 0; i < n; i++) {
  const u = (i + 0.5) / n, x = x0 + u * (x1 - x0), y = deckY + hump * Math.sin(Math.PI * u), slope = hump * Math.PI * Math.cos(Math.PI * u) / (x1 - x0);
  const m = new THREE.Mesh(plank, woodM); m.position.set(x, y, 0); m.rotation.z = Math.atan(slope); m.scale.set((x1 - x0) / n * 0.86, 1.4, W); m.castShadow = true; m.receiveShadow = true; scene.add(m);
}
const rope = makeRopeGeo(), K = 14;
for (const sd of [-1, 1]) {
  const z = sd * W / 2; let pr = null;
  for (let k = 0; k <= K; k++) {
    const u = k / K, x = x0 + u * (x1 - x0), y = deckY + hump * Math.sin(Math.PI * u) + 0.4 - 0.05 * Math.sin(Math.PI * u), cur = new THREE.Vector3(x, y, z);
    if (pr) { const d = cur.clone().sub(pr), m = new THREE.Mesh(rope, ropeM); m.position.copy(pr).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.clone().normalize()); m.scale.set(d.length(), 2.2, 2.2); m.castShadow = true; scene.add(m); }
    pr = cur;
  }
  for (const u of [0, 0.25, 0.5, 0.75, 1]) { const m = new THREE.Mesh(makePostGeo(), postM); m.position.set(x0 + u * (x1 - x0), deckY + hump * Math.sin(Math.PI * u) - 0.06, z); m.scale.set(1.5, 1.55, 1.5); m.castShadow = true; scene.add(m); }
}
// koi under the bridge, lily pads, ripples round the islands
const k1 = buildKoi('#ff7a2a', '#ffffff'); k1.position.set(-0.4, -0.28, 1.5); k1.rotation.y = -0.5; k1.scale.setScalar(1.9); scene.add(k1);
const k2 = buildKoi('#f4f0e6', '#e8402a'); k2.position.set(0.9, -0.3, 2.3); k2.rotation.y = 2.6; k2.scale.setScalar(1.7); scene.add(k2);
const lily = new THREE.MeshStandardMaterial({ color: 0x4f9a50, roughness: 0.7, side: THREE.DoubleSide }), r = rng(5);
for (let i = 0; i < 9; i++) { const g = new THREE.CircleGeometry(0.34, 18, 0.35, TAU - 0.5); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, lily); m.position.set(-3.4 + r() * 6.8, 0.012, 0.8 + r() * 2.8); m.rotation.y = r() * 6; m.scale.setScalar(0.8 + r()); scene.add(m); }
const ringTex = softCanvas('255,255,255', 0.9, true, 128);
for (const [x, z, s] of [[-IX, 0, 3.4], [IX, 0, 3.4], [0.2, 2.0, 1.6], [-1.6, 2.7, 1.2]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); m.scale.setScalar(s * 0.8); scene.add(m); }
// mist bands and drifting petals
for (const [x, y, z, s, op] of [[-6, 0.5, -9, 16, 0.45], [5, 0.7, -14, 20, 0.5], [0, 0.4, -5, 14, 0.25]]) glow(x, y, z, s, 0xffd8c0, op);
const petalGeo = new THREE.CircleGeometry(0.07, 6), petalM = new THREE.MeshBasicMaterial({ color: 0xffc4d4, side: THREE.DoubleSide });
for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(petalGeo, petalM); m.position.set(-3.5 + r() * 7, 0.3 + r() * 2.2, -3 + r() * 2.4); m.rotation.set(r() * 3, r() * 3, r() * 3); m.scale.set(1 + r(), 1.4, 1); scene.add(m); }
// fireflies
const flyM = new THREE.MeshBasicMaterial({ color: 0xfff0a0 });
for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), flyM); m.position.set(-3 + r() * 6, 0.5 + r() * 1.7, -2 + r() * 3.2); scene.add(m); glow(m.position.x, m.position.y, m.position.z, 0.35, 0xfff0a0, 0.7); }

const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 34), 1, 0.3, 500);
const pitch = (Number(q.get('pitch') || 10) * Math.PI) / 180, yaw = (Number(q.get('yaw') || 6) * Math.PI) / 180, dist = Number(q.get('dist') || 8.6);
const tgt = new THREE.Vector3(Number(q.get('tx') || 0.1), Number(q.get('ty') || 0.9), Number(q.get('tz') || 0));
cam.position.set(tgt.x + Math.sin(yaw) * Math.cos(pitch) * dist, tgt.y + Math.sin(pitch) * dist, tgt.z + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(tgt);

renderer.render(scene, cam);
const snap = document.createElement('canvas'); snap.width = snap.height = SIZE; snap.getContext('2d').drawImage(gl, 0, 0);

// ---- composite: tilt-shift depth of field, bloom, vignette, glints
ctx.fillStyle = '#0a0612'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.012}px)`; ctx.drawImage(snap, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
{
  const sharp = document.createElement('canvas'); sharp.width = sharp.height = SIZE; const sx = sharp.getContext('2d');
  sx.drawImage(snap, 0, 0); sx.globalCompositeOperation = 'destination-in';
  const m = sx.createLinearGradient(0, 0, 0, SIZE); m.addColorStop(0, 'rgba(0,0,0,0.1)'); m.addColorStop(0.22, 'rgba(0,0,0,0.55)'); m.addColorStop(0.36, 'rgba(0,0,0,1)'); m.addColorStop(0.78, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0.45)');
  sx.fillStyle = m; sx.fillRect(0, 0, SIZE, SIZE); ctx.drawImage(sharp, 0, 0);
}
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.018}px)`; ctx.globalAlpha = 0.16; ctx.drawImage(snap, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE * 0.52, SIZE * 0.36, SIZE / 2, SIZE / 2, SIZE * 0.78); v.addColorStop(0, 'rgba(8,2,16,0)'); v.addColorStop(1, 'rgba(8,2,16,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const star = (x, y, r2, a) => { ctx.save(); ctx.translate(x * SIZE, y * SIZE); ctx.globalAlpha = a; ctx.fillStyle = '#fff4d0'; ctx.beginPath(); for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r2 * 0.16 : r2; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); };
star(0.735, 0.38, SIZE * 0.03, 0.9); star(0.3, 0.3, SIZE * 0.016, 0.6);

const small = document.createElement('canvas'); small.width = small.height = 1024; const sm = small.getContext('2d'); sm.imageSmoothingQuality = 'high'; sm.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
