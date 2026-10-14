// Offline icon render (developer tool): the SAME plaster wall, pigment cells, painter's hand and compound the game uses, framed close at
// golden hour: the hand brushes the last red cell of a stepped diamond. icon.html?size=2048[&cam=x,y,z&at=x,y,z&fov=n] -> window.__icon().
import { THREE } from '../vendor3d/index.js';
import { createWall, CELL } from './wall.js';
import { createWorld } from './world.js';
import { createPainter } from './hand.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE; document.body.appendChild(canvas);
canvas.style.width = '1024px'; canvas.style.height = '1024px';
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.88;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.localClippingEnabled = true;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xe0b98a, 28, 110);
const camera = new THREE.PerspectiveCamera(Number(q.get('fov') || 40), 1, 0.05, 300);
const world = createWorld({ quality: 'high', camera }); scene.add(world.group);
const wall = createWall({ quality: 'high' }); scene.add(wall.group);
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5; pm.dispose();
const hemi = new THREE.HemisphereLight(0xcfd8ff, 0x7a4a2a, 0.55);
const sun = new THREE.DirectionalLight(0xffa24a, 3.4); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 1, far: 40 }); sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.05; sun.shadow.radius = 3;
const rim = new THREE.DirectionalLight(0xffd7a0, 1.1); rim.position.set(6, 6, -4);
const fill = new THREE.DirectionalLight(0xa6b8ff, 0.35); fill.position.set(5, 3, 8);
scene.add(hemi, sun, sun.target, rim, fill);

// a stepped diamond: black outline, red ring, white heart; one red cell is still being painted
const W = 5, H = 5;
const pat = [0, 0, 2, 0, 0, 0, 2, 3, 2, 0, 2, 3, 1, 3, 2, 0, 2, 3, 2, 0, 0, 0, 2, 0, 0];
const open = 7;   // the cell under the brush (row 1, col 2) is bare
const cells = pat.slice(); cells[open] = 0;
const wallObj = { W, H, N: W * H, kind: 'quad', p: 0, cfg: { seed: 31 }, elder: pat.map((_, i) => i % W < 3 && Math.floor(i / W) < 3), target: pat, init: cells, cap: [0, 9, 9, 9] };
world.setPanel(W, H);
const panelY = world.panelInfo.y;
wall.group.position.set(0, panelY, 0);
const cx = ((open % W) + 0.5 - W / 2) * CELL, cy = panelY + (H / 2 - Math.floor(open / W) - 0.5) * CELL;

const run = async () => {
  const sunDir = new THREE.Vector3(-0.62, 0.38, 0.68).normalize();
  sun.position.copy(sunDir).multiplyScalar(14).add(new THREE.Vector3(0, panelY, 0)); sun.target.position.set(0, panelY, 0);
  const pos = (q.get('cam') || `${cx - 0.5},${cy + 0.15},1.3`).split(',').map(Number), at = (q.get('at') || `${cx + 0.08},${cy - 0.15},0.05`).split(',').map(Number);
  camera.position.set(...pos); camera.lookAt(...at); camera.updateMatrixWorld();
  const painter = await createPainter({ scene });
  const f = { wall: wallObj, cells, glaze: null, guide: false, hintIdx: null, wrong: null, cursor: null, drops: [], drips: null, damp: 0 };
  for (let i = 0; i < 40; i++) { wall.sync(f, 0.05, 30 + i * 0.05); world.update(0.05, camera, true); if (painter) painter.update({ x: cx, y: cy }, 0.05, i * 0.05, { color: 3 }); }
  await world.scenery?.ready?.catch(() => {});
  for (let i = 0; i < 12; i++) { world.update(0.05, camera, true); if (painter) painter.update({ x: cx, y: cy }, 0.05, 3 + i * 0.05, { color: 3 }); }
  if (q.has('dbg') && painter) { const t = painter.tip; console.log('painter', painter.hand.object.visible, t.x, t.y, t.z, JSON.stringify(painter.dbg && Object.fromEntries(Object.entries(painter.dbg).map(([k, v]) => [k, [v.x, v.y, v.z].map((n) => +n.toFixed(2))])))); }
  renderer.render(scene, camera);
  // finish: soft bloom + vignette composited in 2D
  const out = document.createElement('canvas'); out.width = out.height = SIZE; const x = out.getContext('2d');
  x.drawImage(canvas, 0, 0);
  x.save(); x.globalCompositeOperation = 'lighter'; x.filter = `blur(${SIZE * 0.012}px)`; x.globalAlpha = 0.18; x.drawImage(canvas, 0, 0); x.restore();
  const v = x.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.32, SIZE / 2, SIZE / 2, SIZE * 0.78); v.addColorStop(0, 'rgba(30,12,2,0)'); v.addColorStop(1, 'rgba(30,12,2,0.55)'); x.fillStyle = v; x.fillRect(0, 0, SIZE, SIZE);
  window.__icon = () => out.toDataURL('image/png');
  window.__iconJpeg = () => out.toDataURL('image/jpeg', 0.93);
  document.title = 'ready';
};
run().catch((e) => { console.error(e); document.title = 'error'; });
