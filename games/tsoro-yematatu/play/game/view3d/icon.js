// Offline app-icon render (developer tool, not part of the game): `node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store`
// loads this page in headless Chrome. The SUBJECT is the same scene the game builds (world.js: carved board, striped stones, the left line
// just completed in glowing gold) rendered with a transparent background, then composed over a painted dusk backdrop (sun, hills, baobab,
// granary, bokeh) with bloom, a contact shadow and a vignette. Output window.__icon() / __iconJpeg().
import { board3d as B, THREE } from '../vendor3d/index.js';
import { variantOf } from '../src/rules.js';
import { TOP, ptXZ, makeStone, buildBoard } from './world.js';

const q = new URLSearchParams(location.search), P = (k, d) => Number(q.get(k) ?? d);
const SIZE = P('size', 2048);
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = P('exp', 0.78);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
B.lightingRig(scene, 'duskOutdoor', { renderer, shadow: 2048, extent: 4.6, background: false, fog: false, overrides: { keyPos: [-6.5, 7.5, 5.5], keyI: 2.6, key: 0xffb060, hemi: 0.5, hemiSky: 0xffd9b0, hemiGround: 0x4a2a30, rimI: 2.6, rim: 0xff9a6a, rimPos: [5, 4, -7], fillI: 0.5, fill: 0x9ab0ff, exposure: 0.95 } });
B.createEnvironment(renderer, scene, { intensity: 0.42 });
renderer.toneMappingExposure = P('exp', 0.78);

const V = variantOf('classic'), board = buildBoard(q.get('kind') || 'basalt', 'classic'); scene.add(board.group);
const SY = TOP + 0.025;
const place = (side, i, o = {}) => {
  const w = makeStone(side, 'pebble'), p = ptXZ(V, i); w.position.set(p.x, SY, p.z); w.userData.model.scale.setScalar(o.scale || 1.22);
  w.userData.model.position.y = o.lift || 0; w.userData.model.rotation.y = o.yaw || 0; scene.add(w); return w;
};
place(1, 0, { lift: 0.14, yaw: 0.25 }); place(1, 1, { lift: 0.2, yaw: -0.4 }); place(1, 4, { lift: 0.14, yaw: 0.6 });
place(2, 3, { yaw: 0.4 }); place(2, 5, { yaw: -0.2 }); place(2, 6, { yaw: 0.9 });
board.inlays[0].material.emissiveIntensity = 2.8;                      // line 0 is [0,1,4]
const gc = document.createElement('canvas'); gc.width = gc.height = 128;
{ const x = gc.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
const gt = new THREE.CanvasTexture(gc);
const glowM = (c, o) => new THREE.MeshBasicMaterial({ map: gt, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
for (const i of [0, 1, 4]) { const p = ptXZ(V, i), m = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), glowM(0xffc860, 0.6)); m.rotation.x = -Math.PI / 2; m.position.set(p.x, SY + 0.03, p.z); scene.add(m); }
{ const a = ptXZ(V, 0), b = ptXZ(V, 4), len = Math.hypot(b.x - a.x, b.z - a.z), ang = Math.atan2(-(b.z - a.z), b.x - a.x);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.8), glowM(0xffd070, 0.5)); m.rotation.x = -Math.PI / 2; m.rotation.z = ang; m.position.set((a.x + b.x) / 2, SY + 0.04, (a.z + b.z) / 2); scene.add(m);
  const sp = new THREE.SphereGeometry(0.03, 8, 6), sm = new THREE.MeshBasicMaterial({ color: 0xffe9a8, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false });
  for (let k = 0; k < 30; k++) { const t = (k * 0.618) % 1, p = ptXZ(V, [0, 1, 4][k % 3]); const s = new THREE.Mesh(sp, sm); s.position.set(p.x + Math.sin(k * 2.1) * 0.55, SY + 0.45 + t * 1.5, p.z + Math.cos(k * 1.7) * 0.4); s.scale.setScalar(0.4 + (k % 4) * 0.25); scene.add(s); } }

const cam = new THREE.PerspectiveCamera(P('fov', 22), 1, 0.5, 200);
const pitch = P('pitch', 41) * Math.PI / 180, dist = P('dist', 18), yaw = P('yaw', -9) * Math.PI / 180, look = [P('lx', 0), P('ly', 0.25), P('lz', 0.15)];
cam.position.set(look[0] + Math.sin(yaw) * Math.cos(pitch) * dist, look[1] + Math.sin(pitch) * dist, look[2] + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(...look);
renderer.render(scene, cam);
const subject = document.createElement('canvas'); subject.width = subject.height = SIZE; subject.getContext('2d').drawImage(gl, 0, 0);

// ---- painted dusk backdrop
const out = document.createElement('canvas'); out.width = out.height = SIZE; document.body.appendChild(out); out.style.width = '1024px'; out.style.height = '1024px';
const x = out.getContext('2d'), S = SIZE, TAU = Math.PI * 2;
const bg = x.createLinearGradient(0, 0, 0, S);
bg.addColorStop(0, '#1d1240'); bg.addColorStop(0.16, '#4a2468'); bg.addColorStop(0.3, '#a8406a'); bg.addColorStop(0.42, '#f07a48'); bg.addColorStop(0.52, '#ffb860'); bg.addColorStop(0.6, '#ffd890'); bg.addColorStop(0.61, '#7a3a36'); bg.addColorStop(1, '#241018');
x.fillStyle = bg; x.fillRect(0, 0, S, S);
const sun = x.createRadialGradient(S * 0.5, S * 0.52, 0, S * 0.5, S * 0.52, S * 0.5);
sun.addColorStop(0, 'rgba(255,252,225,1)'); sun.addColorStop(0.1, 'rgba(255,238,170,0.95)'); sun.addColorStop(0.28, 'rgba(255,180,90,0.5)'); sun.addColorStop(1, 'rgba(255,120,60,0)');
x.fillStyle = sun; x.fillRect(0, 0, S, S);
x.filter = `blur(${S * 0.004}px)`;
const rnd = (() => { let s = 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
x.fillStyle = '#4a2a5a'; x.beginPath(); x.moveTo(0, S * 0.62); for (let i = 0; i <= 40; i++) x.lineTo((i / 40) * S, S * (0.5 - 0.06 * Math.sin(i * 0.5) - 0.04 * Math.sin(i * 1.3 + 1))); x.lineTo(S, S * 0.62); x.fill();
x.fillStyle = '#2a1636';
const tree = (px, h, w) => { x.beginPath(); x.moveTo(px - S * 0.006, S * 0.58); x.lineTo(px - S * 0.003, S * 0.58 - h); x.lineTo(px + S * 0.003, S * 0.58 - h); x.lineTo(px + S * 0.006, S * 0.58); x.fill(); x.beginPath(); x.ellipse(px, S * 0.58 - h, w, w * 0.2, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(px + w * 0.5, S * 0.58 - h + w * 0.18, w * 0.55, w * 0.14, 0, 0, TAU); x.fill(); };
tree(S * 0.1, S * 0.17, S * 0.1); tree(S * 0.88, S * 0.2, S * 0.12); tree(S * 0.2, S * 0.1, S * 0.06);
const granary = (px, s) => { x.fillRect(px - s, S * 0.58 - s * 1.5, s * 2, s * 1.5); x.beginPath(); x.moveTo(px - s * 1.4, S * 0.58 - s * 1.45); x.lineTo(px, S * 0.58 - s * 2.9); x.lineTo(px + s * 1.4, S * 0.58 - s * 1.45); x.fill(); };
granary(S * 0.78, S * 0.032); granary(S * 0.3, S * 0.022);
x.filter = 'none';
// bokeh
for (let k = 0; k < 26; k++) { const px = rnd() * S, py = S * (0.12 + rnd() * 0.45), r = S * (0.012 + rnd() * 0.03); x.fillStyle = `rgba(255,${200 + Math.floor(rnd() * 50)},${120 + Math.floor(rnd() * 80)},${0.05 + rnd() * 0.09})`; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); }
// dusty warm ground glow under the board + soft contact shadow
const sh = x.createRadialGradient(S * 0.5, S * 0.66, S * 0.05, S * 0.5, S * 0.66, S * 0.52); sh.addColorStop(0, 'rgba(10,4,8,0.75)'); sh.addColorStop(0.6, 'rgba(10,4,8,0.35)'); sh.addColorStop(1, 'rgba(10,4,8,0)');
x.fillStyle = sh; x.save(); x.translate(0, S * 0.1); x.scale(1, 0.85); x.fillRect(0, 0, S, S); x.restore();
// depth of field: soften the backdrop a touch more
x.filter = `blur(${S * 0.006}px)`; x.drawImage(out, 0, 0); x.filter = 'none';
x.drawImage(subject, 0, 0);
x.save(); x.globalCompositeOperation = 'lighter'; x.filter = `blur(${S * 0.014}px)`; x.globalAlpha = 0.34; x.drawImage(subject, 0, 0); x.restore();
const vg = x.createRadialGradient(S / 2, S / 2, S * 0.4, S / 2, S / 2, S * 0.76); vg.addColorStop(0, 'rgba(20,6,10,0)'); vg.addColorStop(1, 'rgba(20,6,10,0.55)'); x.fillStyle = vg; x.fillRect(0, 0, S, S);
const star = (px, py, r, a) => { x.save(); x.translate(px * S, py * S); x.globalAlpha = a; x.fillStyle = '#fff6dc'; x.beginPath(); for (let k = 0; k < 8; k++) { const an = (k / 8) * TAU - Math.PI / 2, rr = k % 2 ? r * 0.16 : r; x.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } x.closePath(); x.fill(); x.restore(); };
star(0.2, 0.3, S * 0.03, 0.9); star(0.3, 0.2, S * 0.018, 0.7);
const small = document.createElement('canvas'); small.width = small.height = 1024; const sx = small.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
