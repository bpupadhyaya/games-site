// Store icon scene (developer tool, not part of the game): the real 3D kid in a clean kick under the band ball, over the game's own alley backdrop.
import { drawBackdrop, drawChungi } from './src/art.js';
import { createStage, loadHuman, THREE } from './vendor3d/index.js';
const q = new URLSearchParams(location.search);
const P = { s: +(q.get('s') || 430), kx: +(q.get('kx') || -0.15), yaw: +(q.get('yaw') || 1.35), side: q.get('side') || 'R', by: +(q.get('by') || 0.62), bx: +(q.get('bx') || 0.62) };
const N = 2048, k = N / 1024, s = P.s * k, floorY = 905 * k, cx = 480 * k;
const bg = document.getElementById('bg'), ctx = bg.getContext('2d');
const cam = { s, floorY, gy: floorY - 0.05 * s, cx, camY: 0, stage: { x: 0, y: 0, w: N, h: N }, X: (x) => cx + x * s, Y: (y) => floorY - 0.05 * s - y * s };
drawBackdrop(ctx, N, N, cam, 2.6, 1.0, 0.2);
// shallow depth of field + vignette over the backdrop
ctx.filter = 'blur(' + 5 * k + 'px)'; ctx.drawImage(bg, 0, 0); ctx.filter = 'none';
{ const g = ctx.createRadialGradient(N / 2, N * 0.55, N * 0.3, N / 2, N * 0.55, N * 0.78); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,6,30,0.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, N, N); }
// contact shadow of the kid
ctx.fillStyle = 'rgba(20,8,24,0.45)'; ctx.beginPath(); ctx.ellipse(cx + P.kx * s, floorY + 0.02 * s, 0.5 * s, 0.1 * s, 0, 0, 7); ctx.fill();
const bx = P.kx + P.bx, by = P.by;
// ball: real size (R = 0.05 m, drawn 1.3x) with a warm glow so it stays readable at 60 px
const ball = { x: bx, y: by, vx: 2, vy: 3, sq: 0, sqA: 0, ang: 0.6 };
const tuft = []; for (let i = 0; i < 7; i++) tuft.push({ x: bx - 0.09 * (i + 1) - 0.0, y: by - 0.07 * (i + 1) * 0.6 });
{ const gr = 0.75 * s, g = ctx.createRadialGradient(cam.X(bx), cam.Y(by), 0, cam.X(bx), cam.Y(by), gr); g.addColorStop(0, 'rgba(255,240,190,0.95)'); g.addColorStop(0.3, 'rgba(255,210,120,0.45)'); g.addColorStop(1, 'rgba(255,170,90,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cam.X(bx), cam.Y(by), gr, 0, 7); ctx.fill(); }
drawChungi(ctx, cam, ball, tuft, 0, 1.0, true);
// 3D kid
const canvas = document.getElementById('fg');
const stage = createStage({ canvas, quality: 'high', dprCap: 1, lighting: 'evening', mode: 'manual', shadows: false, transparent: true, preserveDrawingBuffer: true });
const camr = stage.camera; stage.scene.fog = null; stage.scene.background = null;
camr.updateProjectionMatrix = () => {};
stage.setLighting('evening', { exposure: 1.05, hemi: 1.0, hemiSky: 0xffe3cf, hemiGround: 0x7a5a6a, key: 0xffd9b0, keyI: 2.1, rim: 0xb9a4ff, rimI: 0.9 });
stage.setSky(null, null);
try { stage.renderer.setClearColor(0x000000, 0); } catch {}
stage.renderer.setPixelRatio(1); stage.renderer.setSize(N, N, false);
camr.position.set(0, 0, 0); camr.quaternion.identity(); camr.updateMatrixWorld(true);
camr.projectionMatrix.set(2 * s / N, 0, 0, 2 * cx / N - 1, 0, 2 * s / N, 0, 1 - 2 * floorY / N, 0, 0, -1 / 20, 0, 0, 0, 0, 1);
camr.projectionMatrixInverse.copy(camr.projectionMatrix).invert();
const h = await loadHuman({ character: 'athlete_m', kit: { top: '#f4c030', bottoms: '#2a3d8f', socks: '#f2f2f2', shoes: '#fafafa' }, skin: 'tan', hair: 'black', scale: 0.97, lod: 0, quality: 'high' });
h.groundClamp = 'auto'; h.turnRate = 0; h.footPlanting = true;
stage.add(h); stage.track(h);
h.setFacing(P.yaw); h.setPosition(P.kx, 0, 0); h.play('ready_stance', { fade: 0 });
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const other = P.side === 'R' ? 'L' : 'R';
for (let i = 0; i < 90; i++) {
  h.setReachFoot(P.side, V(bx - 0.03, Math.max(0.1, by - 0.09), 0), 1);
  h.lookAt(V(bx, by, 0.5), { weight: 0.85, maxYaw: 1.1, maxPitch: 0.8 });
  stage.update(1 / 60, { renderNow: false });
}
stage.render();
window.__ready = true; document.title = 'READY';
