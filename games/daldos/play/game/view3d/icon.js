// Offline app-icon render: the same models as the game (carved boat prow, lacquered spatula, notched stick) shot low against a designed
// lakeside dusk backdrop (lavvu, birch, fire bokeh), with depth-of-field, bloom and a grade. Opaque, full-bleed, no text.
import { board3d as B, THREE } from '../vendor3d/index.js';
import { buildBoard, makeSpatula, makeStick, Y, cellXZ } from './models.js';
const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const S = SIZE, cv = (w = S, h = S) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const gl = cv();
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(S, S, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = num('exp', 1.0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
B.lightingRig(scene, 'duskOutdoor', { renderer, shadow: 4096, extent: 5, background: false, fog: false, target: [3, 0.5, 0.5],
  overrides: { key: 0xffb870, keyI: 1.6, keyPos: [-4, 5, 6], hemi: 0.3, hemiSky: 0xffc8a0, hemiGround: 0x241830, fill: 0x6a88e8, fillI: 0.6, rim: 0xa8c0ff, rimI: 3.2, rimPos: [6, 3, -5], exposure: 1.0, env: 0.3 } });
scene.background = null;
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; scene.environmentIntensity = 0.3;

const board = buildBoard('pine'); scene.add(board.group);
const put = (side, row, col, o = {}) => {
  const p = makeSpatula(side), c = cellXZ(row, col);
  p.root.position.set(c.x + (o.dx || 0), Y.deck, c.z + (o.dz || 0)); p.root.rotation.y = o.yaw || 0; p.rig.rotation.x = o.lean ?? -0.25; p.rig.scale.setScalar(o.s || 1);
  p.setTurned(!!o.turned); p.shadow.position.set(c.x, Y.deck + 0.006, c.z + 0.05); p.shadow.scale.setScalar(o.s || 1); scene.add(p.root, p.shadow); return p;
};
put(0, 2, 6, { turned: true, s: 1.75, yaw: -0.25 });          // the hero: a red spatula that has turned over (gold star)
put(1, 1, 3, { s: 1.4, yaw: 0.3 });                           // a blue rival, out of focus
put(0, 2, 3, { s: 1.3, yaw: 0.2 });
const camera = new THREE.PerspectiveCamera(num('fov', 30), 1, 0.2, 200);
const look = new THREE.Vector3(3.5 + num('lx', -1.0), Y.deck + num('ly', 0.85), 1.6 + num('lz', 0));
const pitch = (num('pitch', 17) * Math.PI) / 180, dist = num("dist", 7.2), yaw = (num('yaw', 14) * Math.PI) / 180;
camera.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
camera.lookAt(look); camera.updateMatrixWorld();
const pool = new THREE.PointLight(0xffa04a, 2.2, 10, 1.5); pool.position.set(1.5, 2.2, 3.2); scene.add(pool);
renderer.setClearColor(0x000000, 0); renderer.render(scene, camera);
const sharp = cv(); sharp.getContext('2d').drawImage(gl, 0, 0);

// backdrop: dusk sky over a still lake, birch and a lavvu in silhouette, fire glow, bokeh
const back = cv(), k = back.getContext('2d'), hz = S * 0.42;
let g = k.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#0e1230'); g.addColorStop(0.5, '#4a2a62'); g.addColorStop(0.82, '#c4506a'); g.addColorStop(1, '#ffa45a');
k.fillStyle = g; k.fillRect(0, 0, S, S);
g = k.createLinearGradient(0, hz, 0, S); g.addColorStop(0, '#d98060'); g.addColorStop(0.25, '#6a3a5a'); g.addColorStop(1, '#140c1c'); k.fillStyle = g; k.fillRect(0, hz, S, S - hz);
let s = 31; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
for (let i = 0; i < 60; i++) { k.fillStyle = `rgba(255,240,230,${0.2 + 0.6 * r()})`; k.beginPath(); k.arc(S * r(), hz * 0.7 * r(), S * (0.0012 + 0.0016 * r()), 0, 6.3); k.fill(); }
k.fillStyle = '#1a1226'; k.beginPath(); k.moveTo(0, hz); for (let i = 0; i <= 40; i++) k.lineTo(S * i / 40, hz - S * (0.03 + 0.025 * Math.sin(i * 0.7) + 0.02 * Math.sin(i * 1.9))); k.lineTo(S, hz); k.fill();
// lavvu
const lx = S * 0.2, lb = hz + S * 0.01; k.fillStyle = '#120c1a'; k.beginPath(); k.moveTo(lx - S * 0.13, lb); k.lineTo(lx - S * 0.012, lb - S * 0.2); k.lineTo(lx + S * 0.012, lb - S * 0.2); k.lineTo(lx + S * 0.13, lb); k.fill();
k.strokeStyle = '#120c1a'; k.lineWidth = S * 0.006; for (const d of [-0.03, 0, 0.03]) { k.beginPath(); k.moveTo(lx + S * d * 0.4, lb - S * 0.19); k.lineTo(lx + S * d * 1.5, lb - S * 0.26); k.stroke(); }
let dg = k.createRadialGradient(lx, lb - S * 0.03, 0, lx, lb - S * 0.03, S * 0.06); dg.addColorStop(0, 'rgba(255,190,90,0.9)'); dg.addColorStop(1, 'rgba(255,150,50,0)'); k.fillStyle = dg; k.fillRect(lx - S * 0.08, lb - S * 0.1, S * 0.16, S * 0.14);
// birches
for (const [bx, bh] of [[0.46, 0.34], [0.58, 0.28], [0.9, 0.38]]) { k.fillStyle = '#d8d0c4'; k.fillRect(S * bx, hz - S * bh, S * 0.008, S * bh); k.fillStyle = 'rgba(214,170,60,0.85)'; for (let j = 0; j < 9; j++) { k.beginPath(); k.arc(S * bx + (r() - 0.5) * S * 0.07, hz - S * bh + r() * S * bh * 0.4, S * (0.012 + 0.012 * r()), 0, 6.3); k.fill(); } }
// lake reflection of the sky glow + ripples
k.save(); k.globalAlpha = 0.35; for (let i = 0; i < 14; i++) { k.fillStyle = '#ffd09a'; k.fillRect(S * (0.1 + 0.8 * r()), hz + S * (0.01 + 0.2 * r()), S * (0.05 + 0.15 * r()), S * 0.003); } k.restore();
k.save(); k.globalCompositeOperation = 'lighter';
for (const [bx, by, br, a] of [[0.1, 0.3, 0.07, 0.5], [0.34, 0.36, 0.05, 0.4], [0.82, 0.28, 0.06, 0.45], [0.66, 0.4, 0.035, 0.35], [0.05, 0.5, 0.05, 0.3]]) {
  const rg = k.createRadialGradient(S * bx, S * by, 0, S * bx, S * by, S * br); rg.addColorStop(0, `rgba(255,190,90,${a})`); rg.addColorStop(1, 'rgba(255,120,30,0)'); k.fillStyle = rg; k.beginPath(); k.arc(S * bx, S * by, S * br, 0, 6.3); k.fill();
}
k.restore();
const bb = cv(), bbx = bb.getContext('2d'); bbx.filter = `blur(${S * 0.007}px)`; bbx.drawImage(back, 0, 0);
const blur = cv(), bx = blur.getContext('2d'); bx.filter = `blur(${S * 0.014}px)`; bx.drawImage(sharp, 0, 0); bx.filter = 'none';
const mask = cv(), mx = mask.getContext('2d'); mx.drawImage(blur, 0, 0); mx.globalCompositeOperation = 'destination-in';
const gm = mx.createLinearGradient(0, 0, 0, S); gm.addColorStop(0, 'rgba(0,0,0,1)'); gm.addColorStop(0.3, 'rgba(0,0,0,0.9)'); gm.addColorStop(0.55, 'rgba(0,0,0,0)'); gm.addColorStop(1, 'rgba(0,0,0,0)');
mx.fillStyle = gm; mx.fillRect(0, 0, S, S);
const out = cv(), x = out.getContext('2d');
x.drawImage(bb, 0, 0); x.drawImage(sharp, 0, 0); x.drawImage(mask, 0, 0);
const bl = cv(), bc = bl.getContext('2d'); bc.filter = `blur(${S * 0.02}px) brightness(1.1)`; bc.drawImage(out, 0, 0);
x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.22; x.drawImage(bl, 0, 0); x.restore();
const vg = x.createRadialGradient(S / 2, S * 0.5, S * 0.34, S / 2, S / 2, S * 0.78); vg.addColorStop(0, 'rgba(8,4,16,0)'); vg.addColorStop(1, 'rgba(6,3,12,0.85)'); x.fillStyle = vg; x.fillRect(0, 0, S, S);
const fin = cv(), fx = fin.getContext('2d'); fx.filter = 'contrast(1.18) saturate(1.1) brightness(0.78)'; fx.drawImage(out, 0, 0);
const small = cv(1024, 1024), sx = small.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(fin, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
