// Offline app-icon render (developer tool): the SAME quilt, thread, needle and hand the game uses, close up, with a shallow depth of
// field, a soft bloom and a vignette. Exposes window.__icon for tools/render-icon.mjs (?size=2048 renders at 2048, downsampled to 1024).
import * as THREE from '../vendor3d/three.js';
import { patch, sewPoint } from '../src/engine.js';
import { dashesFor } from '../src/art.js';
import { LOOKS } from '../src/ui.js';
import { UNIT } from '../src/v3.js';
import { createClothView } from './clothview.js';
import { buildFloor, buildSpool } from './props.js';
import { createNeedleHand } from './hand.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; document.body.appendChild(out);
out.style.width = '1024px'; out.style.height = '1024px';
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = Number(q.get('exp') || 0.72);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.localClippingEnabled = true;
renderer.setClearColor(0x1a0d06, 1);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1c0f07, 1.2, 3.2);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5; pm.dispose();
const LOOK = q.get('look') || 'indigo', T = LOOKS[LOOK];
const view = createClothView({ tier: 2, size: 10, withNeedle: true });
scene.add(view.group);
scene.add(buildFloor(2));
scene.add(new THREE.HemisphereLight(0xfff0dc, 0x3a2112, 0.75));
const key = new THREE.DirectionalLight(0xffe0b0, 2.5); key.position.set(-0.62, 0.5, 0.42); key.target.position.set(0, 0, 0);
key.castShadow = true; key.shadow.mapSize.set(4096, 4096); Object.assign(key.shadow.camera, { left: -0.3, right: 0.3, top: 0.3, bottom: -0.3, near: 0.2, far: 2.6 });
key.shadow.bias = -0.0003; key.shadow.normalBias = 0.001; key.shadow.radius = 3;
const rim = new THREE.DirectionalLight(0x9fd0ff, 0.9); rim.position.set(0.5, 0.45, -0.7);
scene.add(key, key.target, rim);
const spool = buildSpool('#b52a2c', { h: 0.04, r: 0.0125 }); spool.position.set(0.17, -0.0105, -0.2); scene.add(spool);

// the frame: five rows of kantha running stitch, the middle one half sewn with the needle in it
const mkRun = (i, color, pts) => {
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const run = { i, name: 'row', color, closed: false, pts, cum, len: cum[cum.length - 1], opts: [] };
  run.opts.push({ run: i, s0: 0, dir: 1, from: pts[0], to: pts[pts.length - 1], end: 'first' });
  return run;
};
const rowY = [2.0, 3.9, 5.8, 7.5, 9.0], rowC = LOOK === 'indigo' ? [3, 2, 0, 2, 3] : [1, 2, 0, 1, 2];
const runs = rowY.map((y, i) => { const pts = []; for (let k = 0; k <= 70; k++) { const x = 0.9 + (8.2 * k) / 70; pts.push([x, y + 0.22 * Math.sin((x * 6.283) / 4 + i * 0.9)]); } return mkRun(i, rowC[i], pts); });
const fr = { kind: 'cloth', size: 10, rect: { x: 0, y: 0, w: 1, h: 1 }, T, look: LOOK, key: 'icon|rows', runs, sewn: [], targets: [], chalk: [], floats: [], markers: [], needle: null, hand: true, puck: 1, done: false, t: 0, calm: true, scene: 'title', props: true };
const cur = 2, partial = Number(q.get('u') || 0.66);
runs.forEach((run, ri) => {
  if (ri === cur) {
    const u = run.len * partial;
    fr.sewn.push({ id: `${ri}:0`, dashes: dashesFor(run, 0), upTo: u, slot: run.color, run, ri }); fr.targets.push([ri, partial]);
    fr.chalk.push({ dashes: dashesFor(run, 0), tint: T.thread[run.color], ri, glow: false });
    const p = sewPoint(run, run.opts[0], u), p0 = sewPoint(run, run.opts[0], Math.max(0, u - 0.05)), p1 = sewPoint(run, run.opts[0], Math.min(run.len, u + 0.25));
    fr.needle = { x: p[0], y: p[1], ang: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), slot: run.color, mode: 'sew' };
  } else if (ri < cur) { fr.sewn.push({ id: `${ri}:0`, dashes: dashesFor(run, 0), upTo: 1e9, slot: run.color, run, ri }); fr.targets.push([ri, 1]); }
  else fr.chalk.push({ dashes: dashesFor(run, 0), tint: T.thread[run.color], ri, glow: false });
});
for (let i = 0; i < 90; i++) view.apply(fr, 1 / 30, 0);
view.cloth.settle(); for (let i = 0; i < 20; i++) view.apply(fr, 1 / 30, 0);

const hand = await createNeedleHand(scene, { skin: q.get('skin') || '#8c5b40' });
const n = view.nstate, d = new THREE.Vector3(0.75, 0, 0.66).normalize();
const grip = n.tip.clone().addScaledVector(n.dir, 0.032);
for (let i = 0; i < 30; i++) hand.update(grip, d, true, 0.05, 0, n.dir, 0.0015);
hand.setShadow(true);

const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 30), 1, 0.02, 6);
const tgt = new THREE.Vector3(Number(q.get('tx') || n.tip.x * 0.55), Number(q.get('ty') || 0.0), Number(q.get('tz') || n.tip.z * 0.55));
const yaw = Number(q.get('yaw') || -0.2), pitch = Number(q.get('pitch') || 0.74), dist = Number(q.get('dist') || 0.56);
cam.position.set(tgt.x + Math.sin(yaw) * Math.cos(pitch) * dist, tgt.y + Math.sin(pitch) * dist, tgt.z + Math.cos(yaw) * Math.cos(pitch) * dist);
cam.lookAt(tgt);
function render() {
  renderer.setViewport(0, 0, SIZE, SIZE); renderer.clear(true, true, true); renderer.render(scene, cam);
  const c = document.createElement('canvas'); c.width = c.height = SIZE; c.getContext('2d').drawImage(gl, 0, 0); return c;
}
const sharp = render();
ctx.fillStyle = '#1a0d06'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.010}px)`; ctx.drawImage(sharp, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
// keep the middle sharp (shallow depth of field), the edges soft
const m = document.createElement('canvas'); m.width = m.height = SIZE; const mx = m.getContext('2d');
mx.drawImage(sharp, 0, 0); mx.globalCompositeOperation = 'destination-in';
const mg = mx.createRadialGradient(SIZE * 0.5, SIZE * 0.5, SIZE * 0.3, SIZE * 0.5, SIZE * 0.5, SIZE * 0.66);
mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(0.6, 'rgba(0,0,0,0.92)'); mg.addColorStop(1, 'rgba(0,0,0,0.1)');
mx.fillStyle = mg; mx.fillRect(0, 0, SIZE, SIZE);
ctx.drawImage(m, 0, 0);
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.014}px)`; ctx.globalAlpha = 0.18; ctx.drawImage(sharp, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.4, SIZE / 2, SIZE / 2, SIZE * 0.78);
v.addColorStop(0, 'rgba(12,5,2,0)'); v.addColorStop(1, 'rgba(12,5,2,0.5)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
window.__icon = () => {
  const s = document.createElement('canvas'); s.width = s.height = 1024; const x = s.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(out, 0, 0, 1024, 1024);
  return s.toDataURL('image/png');
};
window.__iconJpeg = () => { const s = document.createElement('canvas'); s.width = s.height = 1024; const x = s.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(out, 0, 0, 1024, 1024); return s.toDataURL('image/jpeg', 0.93); };
document.title = 'ready';
void UNIT;
