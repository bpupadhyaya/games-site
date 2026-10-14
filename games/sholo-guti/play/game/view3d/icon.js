// Offline app-icon render (developer tool, not part of the game): node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store
// Draws the SAME models the game uses (models.js): an ivory river pebble caught mid-jump over an indigo glazed stone on the chalk lattice, a
// stone flicked away, chalk dust, the courtyard with oil lamps and thatch in soft focus. Tilt-shift depth of field, bloom, vignette, glints.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { buildScenery } from '../vendor3d/scenery3d.js';
import { TOP, buildBoard, buildMat, buildWorld, makePiece, softTex } from './models.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; out.style.cssText = 'width:1024px;height:1024px'; document.body.appendChild(out);
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const rig = B.lightingRig(scene, 'duskOutdoor', { renderer, shadow: 4096, extent: 7, target: [0, 0.4, 0], fog: { near: 9, far: 34 },
  overrides: { bg: 0x241532, fog: 0x2c1a36, hemiSky: 0x9a8ac8, hemiGround: 0x3a2620, hemi: 0.34, key: 0xffb464, keyI: 3.0, keyPos: [-4.5, 5.5, 4.5], fill: 0x6a7ed8, fillI: 0.32, fillPos: [6, 3, 6], rim: 0xffa050, rimI: 3.2, rimPos: [6, 3.2, -6], rim2: 0xff7ac0, rim2I: 1.0, exposure: 0.78, env: 0.26 } });
B.createEnvironment(renderer, scene, { intensity: 0.3 });

const world = buildWorld({ fx: true }); scene.add(world.group); world.update(2.4, false, true); world.warm.forEach((l) => { l.intensity = 1.2; });
const root = new THREE.Group(); scene.add(root); root.add(buildMat());
const board = buildBoard('clay'); root.add(board);
const put = (side, x, z, o = {}) => { const g = makePiece(side, false, 'classic'); g.position.set(x, o.y ?? TOP, z); g.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); g.scale.setScalar(o.s || 1); scene.add(g); return g; };
// the hero: an ivory pebble at the top of a jump over an indigo stone; one indigo stone flicked off, spinning in the air; the army blurred behind
put(1, 0.3, -0.35, { y: TOP + 1.0, ry: 0.5, rz: 0.14, rx: 0.1, s: 1.0 });
put(2, -0.2, 0.2, { ry: 0.3, s: 1.0 });
put(2, 1.7, -1.4, { y: TOP + 0.7, rx: 0.9, rz: -0.6, ry: 0.4, s: 1.0 });
put(2, -1.1, -0.9, { ry: 0.2 }); put(2, 0.5, -2.1, { ry: 0.9 }); put(2, -2.1, -2.0, {});
put(1, -1.4, 2.1, {}); put(1, 1.6, 1.7, {});
// shadow of the jumper on the board and dust where the first stone was lifted
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: softTex('0,0,0', 0.9), transparent: true, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.set(0.5, TOP + 0.03, -0.1); scene.add(blob);
const puffM = (x, y, z, s, o) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex('255,246,230', 1, 128), transparent: true, opacity: o, depthWrite: false })); sp.position.set(x, y, z); sp.scale.setScalar(s); scene.add(sp); };
puffM(-0.5, TOP + 0.1, 0.55, 0.9, 0.5); puffM(-0.2, TOP + 0.18, 0.45, 0.6, 0.4); puffM(-0.75, TOP + 0.16, 0.4, 0.55, 0.35);
const sparkG = new THREE.SphereGeometry(0.014, 8, 6), sparkM = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(sparkG, sparkM), a = i * 2.4, r = 0.5 + (i % 7) * 0.12; m.position.set(0.05 + Math.cos(a) * r * 0.8, TOP + 0.25 + (i % 9) * 0.12, 0.5 + Math.sin(a) * r * 0.5); m.scale.setScalar(0.35 + (i % 4) * 0.3); scene.add(m); }

// a golden glint trail along the arc of the jump (from where the pebble left the board)
{ const gt = softTex('255,214,120', 1, 64);
  for (let i = 0; i < 14; i++) { const u = i / 13, x = -1.3 + u * 1.6, z = 0.6 - u * 0.95, y = TOP + 0.08 + Math.sin(Math.PI * Math.min(1, u * 1.05)) * 0.95;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, transparent: true, opacity: 0.25 + u * 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set(x, y, z); sp.scale.setScalar(0.07 + u * 0.14); scene.add(sp); } }
// a string of warm lights far behind (bokeh once the depth of field is applied)
{ const bt = softTex('255,200,120', 1, 64);
  for (let i = 0; i < 16; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bt, color: i % 4 === 0 ? 0xffe9b0 : 0xffa24a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set(-8 + i * 1.1, 1.6 + Math.sin(i * 1.7) * 0.6, -9); sp.scale.setScalar(0.7 + (i % 3) * 0.35); scene.add(sp); } }
// the far courtyard: dusk sky and rice fields behind the wall (awaited so the render is complete)
const sc = buildScenery({ layers: [{ t: 'sky', id: 'sky-golden' }, { t: 'backdrop', id: 'bd-rice' }, { t: 'band', id: 'band-fields', r: 70, h: 11, arc: [-170, -10] }], timeOfDay: 'dusk', quality: 'high', wind: 0 });
sc.group.position.y = -0.02; scene.add(sc.group);
try { await sc.ready; } catch (e) { console.warn('scenery', e); }
sc.update(0, null);

const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 22), 1, 0.5, 260);
const pitch = (Number(q.get('pitch') || 24) * Math.PI) / 180, yaw = (Number(q.get('yaw') || -14) * Math.PI) / 180, dist = Number(q.get('dist') || 7.0);
const tgt = new THREE.Vector3(Number(q.get('tx') || 0.2), Number(q.get('ty') || 0.85), Number(q.get('tz') || -0.2));
cam.position.set(tgt.x + Math.sin(yaw) * Math.cos(pitch) * dist, tgt.y + Math.sin(pitch) * dist, tgt.z + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(tgt);
sc.update(0, cam);

renderer.render(scene, cam);
const snap = document.createElement('canvas'); snap.width = snap.height = SIZE; snap.getContext('2d').drawImage(gl, 0, 0);

// ---- composite: tilt-shift depth of field (blurred copy under, sharp copy masked to a horizontal band), bloom, vignette, glints
ctx.fillStyle = '#1a0c08'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.012}px)`; ctx.drawImage(snap, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
{
  const sharp = document.createElement('canvas'); sharp.width = sharp.height = SIZE; const sx = sharp.getContext('2d');
  sx.drawImage(snap, 0, 0); sx.globalCompositeOperation = 'destination-in';
  const m = sx.createLinearGradient(0, 0, 0, SIZE); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.18, 'rgba(0,0,0,0.3)'); m.addColorStop(0.36, 'rgba(0,0,0,1)'); m.addColorStop(0.66, 'rgba(0,0,0,1)'); m.addColorStop(0.88, 'rgba(0,0,0,0.35)'); m.addColorStop(1, 'rgba(0,0,0,0.1)');
  sx.fillStyle = m; sx.fillRect(0, 0, SIZE, SIZE); ctx.drawImage(sharp, 0, 0);
}
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.016}px)`; ctx.globalAlpha = 0.14; ctx.drawImage(snap, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE * 0.5, SIZE * 0.34, SIZE / 2, SIZE / 2, SIZE * 0.78); v.addColorStop(0, 'rgba(14,4,0,0)'); v.addColorStop(1, 'rgba(14,4,0,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const star = (x, y, r, a) => { ctx.save(); ctx.translate(x * SIZE, y * SIZE); ctx.globalAlpha = a; ctx.fillStyle = '#fff4d0'; ctx.beginPath(); for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.16 : r; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); };
star(0.5, 0.36, SIZE * 0.03, 0.9); star(0.34, 0.5, SIZE * 0.016, 0.6); star(0.72, 0.58, SIZE * 0.014, 0.5);

const small = document.createElement('canvas'); small.width = small.height = 1024; const sm = small.getContext('2d'); sm.imageSmoothingQuality = 'high'; sm.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
