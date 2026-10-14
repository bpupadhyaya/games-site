// Offline app-icon render from the game's own 3D scene (node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store).
import { board3d as B, THREE } from '../vendor3d/index.js';
import { buildBoard, makePiece, makeLantern, glowTexture, TILE_TOP, cellX, cellZ } from './models.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const canvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
B.createEnvironment(renderer, scene, { intensity: 0.4 });
B.lightingRig(scene, 'warmIndoor', { renderer, shadow: 4096, extent: 5, fog: { near: 9, far: 24 },
  overrides: { bg: 0x1a0d07, fog: 0x2a140a, key: 0xffd2a0, keyI: 1.35, keyPos: [-3.5, 5.5, 4.5], rim: 0xffa050, rimI: 1.8, rimPos: [4, 3, -5], hemi: 0.22, exposure: 0.78 } });

const board = buildBoard('sand'); scene.add(board);
const rug = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), B.material('cloth', { color: '#2a120c', color2: '#4a1c10', repeat: [30, 30], size: 256 }));
rug.rotation.x = -Math.PI / 2; rug.position.y = -0.02; rug.receiveShadow = true; scene.add(rug);

const put = (v, i, o = {}) => {
  const g = new THREE.Group(), m = makePiece(v & 1 ? 1 : 2, o.style || 'stone', v > 2);
  const sh = B.contactShadow(0.64, 0.7); g.add(sh, m);
  g.position.set(o.x ?? cellX(i), TILE_TOP + (o.y || 0), o.z ?? cellZ(i)); m.rotation.y = o.yaw || 0; if (o.s) m.scale.setScalar(o.s);
  scene.add(g); return g;
};
// the moment of a chain: the crowned dark Master stands in front, two light men have just been taken behind it
put(3, 0, { x: -0.15, z: 1.75, yaw: 0.5, s: 1.4 });
put(2, 0, { x: -1.0, z: 0.5, yaw: 0.2 }); put(2, 0, { x: 1.05, z: 0.45, yaw: 0.8 });
put(1, 0, { x: -2.05, z: 1.15, yaw: 0.3 }); put(1, 0, { x: 1.95, z: 1.25, yaw: 1.1 });
put(2, 0, { x: 0.0, z: -0.6, yaw: 0.4 }); put(1, 0, { x: -1.95, z: -0.55, yaw: 0.9 }); put(2, 0, { x: 2.0, z: -0.55, yaw: 0.1 });
// legal-move glow rings and the lamp glow under the Master
for (const [x, z, r, c] of [[-0.15, 1.75, 0.9, '#ffd36a'], [-1.1, 1.05, 0.5, '#ffe08a'], [0.95, 1.05, 0.5, '#ffe08a']]) { const g = B.glowRing(r, c); g.position.set(x, TILE_TOP + 0.012, z); g.material.opacity = 0.5; g.scale.setScalar(1.1); scene.add(g); }
// lanterns behind the board give the bokeh and the warm rim
for (const [x, z, s] of [[-3.3, -3.0, 1.4], [3.6, -3.4, 1.6], [0.3, -4.6, 1.2]]) {
  const l = makeLantern(); l.position.set(x, 0, z); l.scale.setScalar(s); scene.add(l);
  const pl = new THREE.PointLight(0xffa24a, 2.2, 12, 1.8); pl.position.set(x, 0.9 * s, z); scene.add(pl);
}
const embers = new THREE.Group();
for (let i = 0; i < 60; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('255,200,120', 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 + (i % 5) * 0.12, fog: false })); const a = i * 2.399; s.position.set(Math.cos(a) * (1 + (i % 7) * 0.7), 0.4 + (i * 0.37) % 3.2, Math.sin(a) * (0.5 + (i % 5) * 0.7) - 0.5); s.scale.setScalar(0.06 + (i % 4) * 0.05); embers.add(s); }
scene.add(embers);

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
camera.position.set(2.3, 3.5, 7.2); camera.lookAt(-0.05, 0.9, 0.7);
const res = B.renderIcon({ scene, camera, size: SIZE, renderer, exposure: 0.82, background: '#1a0d07', bloom: 0.3, vignette: 0.55 });
document.title = 'READY';
