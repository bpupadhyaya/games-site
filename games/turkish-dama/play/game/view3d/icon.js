// Offline app-icon render (developer tool, not part of the game): node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store
// Draws the SAME models the game uses (models.js): the inlaid board and a crowned ivory king at the end of a capture chain, a ruby man
// tumbling off the board, the tea glass and mosaic lamps in soft focus behind. Tilt-shift depth of field, bloom, vignette, glints.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { TOP, buildBoard, buildTable, buildTeaSet, buildLamp, makePiece } from './models.js';

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
const rig = B.lightingRig(scene, 'warmIndoor', { renderer, shadow: 4096, extent: 6, target: [0, 0.4, 0.4], fog: { near: 12, far: 40 },
  overrides: { bg: 0x120a06, fog: 0x150b06, key: 0xffd7a0, keyI: 2.9, keyPos: [-4, 8, 5], hemi: 0.18, fillI: 0.18, fill: 0xffe0b8, fillPos: [6, 3, 6], rim: 0xffb070, rimI: 3.0, rimPos: [6, 4, -6], rim2: 0x7fe6dc, rim2I: 1.4, exposure: 0.8, env: 0.16 } });
B.createEnvironment(renderer, scene, { intensity: 0.16 });

scene.add(buildTable());
const board = buildBoard('iznik'); scene.add(board);
const put = (side, king, x, z, o = {}) => { const g = makePiece(side, king, 'classic'); g.position.set(x, o.y ?? TOP, z); g.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); g.scale.setScalar(o.s || 1); scene.add(g); return g; };
// the hero: an ivory king that has just flown the length of the column; a ruby man flung off the board, one already clattered onto the rug
const KX = 0.5, KZ = 0.5;
put(1, true, KX, KZ, { ry: 0.4 });
put(2, false, -2.0, 1.1, { y: TOP + 1.1, rx: 0.9, rz: -0.7, ry: 0.4, s: 0.9 });
put(2, false, -4.9, 2.7, { y: 0.0, rx: 1.45, rz: 0.3, ry: 0.8 });
for (const [x, z] of [[-0.5, -1.5], [1.5, -1.5], [2.5, -0.5], [-1.5, -0.5], [0.5, -2.5], [-2.5, -1.5], [2.5, -2.5], [-1.5, -3.5], [1.5, -3.5]]) put(2, false, x, z);
for (const [x, z] of [[-1.5, 2.5], [2.5, 1.5], [0.5, 3.5], [3.5, 3.5]]) put(1, false, x, z);
// brass sparks hanging in the air above the king
const sparkG = new THREE.SphereGeometry(0.03, 8, 6), sparkM = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(sparkG, sparkM), a = i * 2.4, r = 0.5 + (i % 7) * 0.12; m.position.set(KX + Math.cos(a) * r, TOP + 0.9 + (i % 9) * 0.12, KZ + Math.sin(a) * r * 0.7); m.scale.setScalar(0.35 + (i % 4) * 0.3); scene.add(m); }
// the tea glass behind, soft focus, and two lamps
const tea = buildTeaSet(); tea.scale.setScalar(3.2); tea.position.set(1.6, 0.006, -6.1); scene.add(tea);
const glow = (x, y, z, s, col, op) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x2 = c.getContext('2d'), g = x2.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x2.fillStyle = g; x2.fillRect(0, 0, 128, 128);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set(x, y, z); sp.scale.setScalar(s); scene.add(sp); };
glow(KX, 1.2, KZ, 2.4, 0xffd070, 0.3); glow(-3.0, 0.5, -7.5, 9, 0xff9a50, 0.5); glow(7.0, 0.8, -4.0, 8, 0x70e0ff, 0.35);

const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 26), 1, 0.5, 200);
const pitch = (Number(q.get('pitch') || 31) * Math.PI) / 180, yaw = (Number(q.get('yaw') || -18) * Math.PI) / 180, dist = Number(q.get('dist') || 6.3);
const tgt = new THREE.Vector3(Number(q.get('tx') || 1.0), Number(q.get('ty') || 0.62), Number(q.get('tz') || -0.45));
cam.position.set(tgt.x + Math.sin(yaw) * Math.cos(pitch) * dist, tgt.y + Math.sin(pitch) * dist, tgt.z + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(tgt);

renderer.render(scene, cam);
const snap = document.createElement('canvas'); snap.width = snap.height = SIZE; snap.getContext('2d').drawImage(gl, 0, 0);

// ---- composite: tilt-shift depth of field (blurred copy under, sharp copy masked to a horizontal band), bloom, vignette, glints
ctx.fillStyle = '#0a0503'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.011}px)`; ctx.drawImage(snap, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
{
  const sharp = document.createElement('canvas'); sharp.width = sharp.height = SIZE; const sx = sharp.getContext('2d');
  sx.drawImage(snap, 0, 0); sx.globalCompositeOperation = 'destination-in';
  const m = sx.createLinearGradient(0, 0, 0, SIZE); m.addColorStop(0, 'rgba(0,0,0,0.15)'); m.addColorStop(0.18, 'rgba(0,0,0,0.5)'); m.addColorStop(0.3, 'rgba(0,0,0,1)'); m.addColorStop(0.84, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0.5)');
  sx.fillStyle = m; sx.fillRect(0, 0, SIZE, SIZE); ctx.drawImage(sharp, 0, 0);
}
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.016}px)`; ctx.globalAlpha = 0.12; ctx.drawImage(snap, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE * 0.52, SIZE * 0.34, SIZE / 2, SIZE / 2, SIZE * 0.78); v.addColorStop(0, 'rgba(10,4,0,0)'); v.addColorStop(1, 'rgba(10,4,0,0.62)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const star = (x, y, r, a) => { ctx.save(); ctx.translate(x * SIZE, y * SIZE); ctx.globalAlpha = a; ctx.fillStyle = '#fff4d0'; ctx.beginPath(); for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.16 : r; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); };
star(0.55, 0.3, SIZE * 0.032, 0.95); star(0.3, 0.2, SIZE * 0.018, 0.7); star(0.78, 0.5, SIZE * 0.016, 0.6);

const small = document.createElement('canvas'); small.width = small.height = 1024; const sm = small.getContext('2d'); sm.imageSmoothingQuality = 'high'; sm.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
