// Offline app-icon render (developer tool): the same santoor model the game uses, seen at an angle on the carpet, two glowing mallets,
// marigold petals, warm lamp bokeh behind. Exposes window.__icon() / __iconJpeg() and sets document.title = 'ready'.
import { THREE, B, TAU, cv, makeMats, buildSantoor, buildMallet, petalGeometry, rngOf } from './models.js';
const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const gl = cv(SIZE);
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
B.createEnvironment(renderer, scene, { intensity: 0.45 });
const M = makeMats();
const key = new THREE.DirectionalLight(0xffd9a6, 3.0); key.position.set(-700, -500, 900); key.castShadow = true;
key.shadow.mapSize.set(4096, 4096); Object.assign(key.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 100, far: 3000 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6;
const rim = new THREE.DirectionalLight(0x7fe6d8, 1.8); rim.position.set(900, 900, 500);
scene.add(new THREE.HemisphereLight(0xffe2bc, 0x3a1e12, 0.6), key, key.target, rim);
const lamp = new THREE.PointLight(0xffa860, 900, 2000, 1); lamp.position.set(-420, -260, 160); scene.add(lamp);
// carpet
M.carpetTex.repeat.set(4, 4); M.carpetBump.repeat.set(4, 4);
const cm = M.carpet.clone(); cm.color.set('#4a3c3a'); const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), cm); carpet.receiveShadow = true; scene.add(carpet);
// instrument (rotated a little so the zigzag reads)
const hb = 240, len = 640, rh = len / 8, m = 16, half = (ly) => hb + (hb * 0.62 - hb) * Math.min(1, Math.max(0, ly / len));
const S = buildSantoor({ hb, len, rh, m, half }, M);
const ss = Array.from({ length: 16 }, () => ({ vib: 0, ph: 0, glow: 0 }));
ss[9].vib = 0.8; ss[9].glow = 1; ss[9].ph = 2; ss[4].glow = 0.6; ss[4].vib = 0.4; ss[4].ph = 1;
S.update(ss, new Set([6, 11]), null, 0);
const inst = new THREE.Group(); inst.add(S.group); S.group.position.set(0, -len / 2, 0); inst.rotation.z = 0.42; scene.add(inst);
// glowing spots (n = 9 right, 4 left) as bright lacquer discs
const disc = (x, y, c) => { const d = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, clearcoat: 1, roughness: 0.2 })); d.scale.set(26, 26, 11); d.position.set(x, y - len / 2, S.Hb + 8); S.group.add(d); };
const pt = (n) => { const c = n >> 1, ly = (c + 0.5) * rh; return [(n & 1 ? 1 : -1) * half(ly) * 0.54, ly]; };
{ const [x, y] = pt(9); disc(x, y, '#35d6c0'); const [x2, y2] = pt(4); disc(x2, y2, '#ffb347'); }
// mallets
const mal = (side, n) => { const g = buildMallet(side, M); const [x, y] = pt(n); const wrap = new THREE.Group(); wrap.add(g); g.scale.setScalar(1.25); g.rotation.set(0, -0.55, side ? 0.5 : Math.PI - 0.5 + 0.0, 'ZYX'); g.userData.glow.material.opacity = 0.35; wrap.position.set(x, y - len / 2, S.Hb + 14); S.group.add(wrap); return g; };
mal(1, 9); mal(0, 4);
// petals
const pg = petalGeometry(), r = rngOf(7);
for (let i = 0; i < 26; i++) { const p = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: ['#f2a33a', '#ff8a2a', '#ffc24a'][i % 3], side: THREE.DoubleSide, roughness: 0.6, emissive: '#3a1400', emissiveIntensity: 0.4 })); const a = r() * TAU, d = 300 + r() * 380; p.position.set(Math.cos(a) * d * 0.9, Math.sin(a) * d * 0.7, 2); p.rotation.z = r() * TAU; p.scale.set(18, 36, 1); p.castShadow = true; scene.add(p); }
const cam = new THREE.PerspectiveCamera(30, 1, 100, 6000), pitch = (Number(q.get('pitch') || 52) * Math.PI) / 180, dist = Number(q.get('dist') || 1420);
cam.position.set(0, -Math.cos(pitch) * dist, Math.sin(pitch) * dist); cam.up.set(0, 0, 1); cam.lookAt(30, -5, 10);
scene.background = null; renderer.setClearColor(0x000000, 0); renderer.render(scene, cam);
const subject = cv(SIZE); subject.getContext('2d').drawImage(gl, 0, 0);
// backdrop: warm lamp bokeh behind, glow, vignette
const out = cv(SIZE), ctx = out.getContext('2d');
const bg = ctx.createRadialGradient(SIZE * 0.4, SIZE * 0.35, SIZE * 0.05, SIZE / 2, SIZE / 2, SIZE * 0.8); bg.addColorStop(0, '#6a2a14'); bg.addColorStop(0.5, '#2e0f10'); bg.addColorStop(1, '#0c0506');
ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE);
let sd = 5; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
ctx.globalCompositeOperation = 'lighter';
for (let i = 0; i < 24; i++) { const x = rnd() * SIZE, y = rnd() * SIZE, rr = SIZE * (0.02 + rnd() * 0.05), g = ctx.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, `rgba(255,${150 + rnd() * 70 | 0},70,${0.18 + rnd() * 0.25})`); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
ctx.globalCompositeOperation = 'source-over';
ctx.drawImage(subject, 0, 0);
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.014}px)`; ctx.globalAlpha = 0.14; ctx.drawImage(subject, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.32, SIZE / 2, SIZE / 2, SIZE * 0.75); v.addColorStop(0, 'rgba(8,2,2,0)'); v.addColorStop(1, 'rgba(6,2,4,0.82)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const fin = cv(1024), fx = fin.getContext('2d'); fx.imageSmoothingQuality = 'high'; fx.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => fin.toDataURL('image/png'); window.__iconJpeg = () => fin.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
