// Offline app-icon render: the same models as the game (carved board, jade stone, beans), shot low and close against a designed
// dusk backdrop (stepped temple, torch bokeh), with a vertical depth-of-field blur, bloom and a grade.
// `node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store`.
import { board3d as B, THREE } from '../vendor3d/index.js';
import { buildBoard, makePiece, makeBean, goldMaterial, W, Y } from './models.js';
import { pieceUV } from '../src/boardview.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const S = SIZE, cv = (w = S, h = S) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const gl = cv();
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(S, S, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = num('exp', 1.0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const rig = B.lightingRig(scene, 'duskOutdoor', {
  renderer, shadow: 4096, extent: 5, background: false, fog: { color: 0x4a2250, near: 7, far: 16 }, target: [0, 0.4, 0],
  overrides: { key: 0xffb870, keyI: 1.15, keyPos: [-5, 4.5, 4.5], hemi: 0.16, hemiSky: 0xffc8a0, hemiGround: 0x241830, fill: 0x5a78e0, fillI: 0.5, rim: 0xa8c0ff, rimI: 3.0, rimPos: [5, 3, -4], exposure: 1.0, env: 0.25 },
});
scene.background = null;
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; scene.environmentIntensity = 0.28;

const board = buildBoard([1, null, 0, null]);
scene.add(board.group);
const T = Y.tile;
const put = (seat, u, v, o = {}) => {
  const p = makePiece(seat); p.position.set(W(u), T, W(v)); p.userData.rig.rotation.y = o.yaw ?? 0.5;
  p.scale.setScalar(o.s ?? 1.0); scene.add(p); return p;
};
const hero = pieceUV(2, 0, 1);                       // the jade stone on its gold-framed arm mouth
put(0, hero.x, hero.y, { s: 1.75, yaw: 0.3 });
const rp = pieceUV(2, 1, 4); put(1, rp.x, rp.y, { s: 1.35, yaw: 0.8 });   // a rival stone, out of focus behind
const beanSpots = [[hero.x + 1.05, hero.y + 0.12, 0.9, 0, true, 0], [hero.x + 0.72, hero.y - 0.5, 2.3, 0, false, 0], [hero.x - 1.0, hero.y + 0.2, 0.4, 0.45, true, 0.5]];
for (const [u, v, yaw, lift, up, tumble] of beanSpots) {
  const b = makeBean(); const g = new THREE.Group(); g.add(b.shadow, b.group); g.scale.setScalar(0.62);
  b.group.rotation.set(up ? 0 : Math.PI, 0, 0);
  g.position.set(W(u), T + 0.2 * 0.62 * 0.5 + lift * 0.5, W(v)); g.rotation.y = yaw;
  if (tumble) { b.group.rotation.x += tumble * 2.0; b.group.rotation.z = tumble * 1.1; b.shadow.position.y = (-lift * 0.5 - 0.062) / 0.62 + 0.01; }
  scene.add(g);
}
goldMaterial().emissive.set(0x8a5a0c); goldMaterial().emissiveIntensity = 0.3;
const camera = new THREE.PerspectiveCamera(num('fov', 30), 1, 0.2, 200);
const look = new THREE.Vector3(W(hero.x) + num('lx', 0.2), T + num('ly', 0.72), W(hero.y) + num('lz', 0.0));
const pitch = (num('pitch', 15) * Math.PI) / 180, dist = num('dist', 4.6), yaw = (num('yaw', 16) * Math.PI) / 180;
camera.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
camera.lookAt(look); camera.updateMatrixWorld();
// the warm pool of torchlight on the stone and a cool rim from behind
const pool = new THREE.PointLight(0xffa04a, 6, 9, 1.5); pool.position.set(W(hero.x) - 1.8, T + 1.4, W(hero.y) + 1.2); scene.add(pool);

renderer.setClearColor(0x000000, 0);
renderer.render(scene, camera);
const sharp = cv(); sharp.getContext('2d').drawImage(gl, 0, 0);

// ---- the designed backdrop: dusk sky, stepped temple silhouette, torch bokeh, stars
const back = cv(), k = back.getContext('2d');
const hz = S * 0.46;
let g = k.createLinearGradient(0, 0, 0, hz);
g.addColorStop(0, '#0b0724'); g.addColorStop(0.45, '#2b1356'); g.addColorStop(0.8, '#8a2c66'); g.addColorStop(1, '#f08a3c');
k.fillStyle = g; k.fillRect(0, 0, S, S);
g = k.createLinearGradient(0, hz, 0, S); g.addColorStop(0, '#5a2a4a'); g.addColorStop(1, '#120a1c'); k.fillStyle = g; k.fillRect(0, hz, S, S - hz);
let s = 29; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
for (let i = 0; i < 70; i++) { k.fillStyle = `rgba(255,240,220,${0.25 + 0.6 * r()})`; k.beginPath(); k.arc(S * r(), hz * 0.8 * r(), S * (0.0014 + 0.0018 * r()), 0, 6.3); k.fill(); }
// stepped temple (talud-tablero style tiers) with a lit doorway
const cx = S * 0.7, base = hz + S * 0.02;
k.fillStyle = '#1a0c2c';
const tiers = [[0.36, 0.05], [0.31, 0.05], [0.26, 0.05], [0.21, 0.05], [0.16, 0.05]];
let y = base;
tiers.forEach(([w, h]) => { k.fillRect(cx - (S * w) / 2, y - S * h, S * w, S * h); y -= S * h; });
k.fillRect(cx - S * 0.055, y - S * 0.055, S * 0.11, S * 0.055); k.fillRect(cx - S * 0.075, y - S * 0.07, S * 0.15, S * 0.015);
k.fillStyle = '#ffb860'; k.fillRect(cx - S * 0.016, y - S * 0.045, S * 0.032, S * 0.04);
const dg = k.createRadialGradient(cx, y - S * 0.03, 0, cx, y - S * 0.03, S * 0.12); dg.addColorStop(0, 'rgba(255,170,70,0.55)'); dg.addColorStop(1, 'rgba(255,170,70,0)'); k.fillStyle = dg; k.fillRect(cx - S * 0.15, y - S * 0.15, S * 0.3, S * 0.3);
// torch bokeh
k.save(); k.globalCompositeOperation = 'lighter';
for (const [bx, by, br, a] of [[0.12, 0.34, 0.07, 0.55], [0.26, 0.4, 0.05, 0.4], [0.9, 0.3, 0.06, 0.45], [0.46, 0.43, 0.035, 0.35], [0.04, 0.5, 0.05, 0.3]]) {
  const rg = k.createRadialGradient(S * bx, S * by, 0, S * bx, S * by, S * br); rg.addColorStop(0, `rgba(255,190,90,${a})`); rg.addColorStop(0.8, `rgba(255,140,40,${a * 0.5})`); rg.addColorStop(1, 'rgba(255,120,30,0)');
  k.fillStyle = rg; k.beginPath(); k.arc(S * bx, S * by, S * br, 0, 6.3); k.fill();
}
k.restore();
// blur the backdrop a little (it is far away)
const bb = cv(), bbx = bb.getContext('2d'); bbx.filter = `blur(${S * 0.006}px)`; bbx.drawImage(back, 0, 0);

// ---- composite: backdrop, depth-of-field on the 3D layer (far part blurred), bloom, grade
const blur = cv(), bx = blur.getContext('2d'); bx.filter = `blur(${S * 0.012}px)`; bx.drawImage(sharp, 0, 0); bx.filter = 'none';
const mask = cv(), mx = mask.getContext('2d'); mx.drawImage(blur, 0, 0); mx.globalCompositeOperation = 'destination-in';
const gm = mx.createLinearGradient(0, 0, 0, S); gm.addColorStop(0, 'rgba(0,0,0,1)'); gm.addColorStop(0.3, 'rgba(0,0,0,0.95)'); gm.addColorStop(0.5, 'rgba(0,0,0,0)'); gm.addColorStop(1, 'rgba(0,0,0,0)');
mx.fillStyle = gm; mx.fillRect(0, 0, S, S);
const out = cv(), x = out.getContext('2d');
x.drawImage(bb, 0, 0); x.drawImage(sharp, 0, 0); x.drawImage(mask, 0, 0);
const bl = cv(), bc = bl.getContext('2d'); bc.filter = `blur(${S * 0.02}px) brightness(1.1)`; bc.drawImage(out, 0, 0);
x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.2; x.drawImage(bl, 0, 0); x.restore();
const vg = x.createRadialGradient(S / 2, S * 0.5, S * 0.34, S / 2, S / 2, S * 0.78); vg.addColorStop(0, 'rgba(6,3,14,0)'); vg.addColorStop(1, 'rgba(6,3,14,0.7)');
x.fillStyle = vg; x.fillRect(0, 0, S, S);
x.save(); x.globalCompositeOperation = 'lighter';
for (let i = 0; i < 22; i++) {
  let px = S * (0.05 + 0.9 * r()), py = S * (0.1 + 0.5 * r());
  if (px > S * 0.22 && px < S * 0.66 && py > S * 0.28) px = S * (0.72 + 0.22 * r());
  const rad = S * (0.0016 + 0.0035 * r()), gg = x.createRadialGradient(px, py, 0, px, py, rad * 3);
  gg.addColorStop(0, 'rgba(255,214,140,0.95)'); gg.addColorStop(1, 'rgba(255,150,40,0)'); x.fillStyle = gg; x.beginPath(); x.arc(px, py, rad * 3, 0, 6.3); x.fill();
}
x.restore();
const fin = cv(), fx = fin.getContext('2d'); fx.filter = 'contrast(1.12) saturate(1.12)'; fx.drawImage(out, 0, 0);
const small = cv(1024, 1024), sx = small.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(fin, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
