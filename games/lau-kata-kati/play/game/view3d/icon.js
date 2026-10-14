// Offline app-icon render from the game's own 3D scene (node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store).
import { board3d as B, THREE } from '../vendor3d/index.js';
import { buildBoard, makePiece, makeLantern, makeLeaf, glowTexture, TOP, PTS } from './models.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const canvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
B.createEnvironment(renderer, scene, { intensity: 0.5 });
B.lightingRig(scene, 'duskOutdoor', { renderer, shadow: 4096, extent: 5, fog: { near: 12, far: 30 },
  overrides: { bg: 0x2a1a3a, fog: 0x7a3a4a, key: 0xffc58a, keyI: 1.5, keyPos: [-4, 5.5, 4.5], rim: 0xff9a5a, rimI: 2.6, rimPos: [4.5, 3, -5], fill: 0x7a90e8, fillI: 0.5, hemi: 0.3, hemiSky: 0xffd0a8, hemiGround: 0x3a2a40, exposure: 0.85 } });

const board = buildBoard('indigo'); scene.add(board);
// the reed mat, plainly woven, so the board floats in a warm field
const mat = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#3a2630', roughness: 1 }));
mat.rotation.x = -Math.PI / 2; mat.position.y = 0.0; mat.receiveShadow = true; scene.add(mat);

const put = (side, x, z, o = {}) => {
  const g = new THREE.Group(), m = makePiece(side, o.style || 'classic');
  const sh = B.contactShadow(0.62, 0.7); g.add(sh, m);
  g.position.set(x, TOP + (o.y || 0), z); m.rotation.y = o.yaw || 0; m.rotation.z = o.roll || 0; m.rotation.x = o.tilt || 0; if (o.s) m.scale.setScalar(o.s);
  sh.scale.setScalar((o.s || 1) * (1 - Math.min(0.4, (o.y || 0) * 0.3))); sh.material.opacity = 0.7 * (1 - Math.min(0.55, (o.y || 0) * 0.5));
  scene.add(g); return g;
};
// the moment of a jump on the hourglass: the gold patch is over the waist, mid-hop; ruby men behind it in the far triangle, gold men in the near one
put(1, 0.0, 1.35, { y: 0.55, s: 1.8, yaw: 0.5, tilt: -0.14 });
put(2, 0.0, 0.0, { s: 1.35, yaw: 0.2, tilt: 0.0 });
for (const i of [4, 6, 8, 2]) { const p = PTS[i]; put(2, p[0], p[1], { s: 1.25, yaw: i * 0.9 }); }
for (const i of [13, 15, 17]) { const p = PTS[i]; put(1, p[0], p[1], { s: 1.25, yaw: i * 0.7 }); }
// legal-move rings on the cloth, and a glow under the hopping piece
for (const [x, z, r, c, op] of [[0.0, 1.35, 1.5, '#ffd36a', 0.5], [0.0, -1.0, 0.6, '#ff6a3a', 0.8]]) { const g = B.glowRing(r, c); g.position.set(x, TOP + 0.016, z); g.material.opacity = op; scene.add(g); }
// lanterns either side of the waist give the bokeh and the warm rim
for (const [x, z, s, i] of [[-4.4, -3.6, 2.3, 3.6], [4.6, -4.2, 2.5, 3.2]]) {
  const l = makeLantern(); l.position.set(x, 0, z); l.scale.setScalar(s); scene.add(l);
  const pl = new THREE.PointLight(0xffa24a, i, 14, 1.6); pl.position.set(x, 1.2 * s, z); scene.add(pl);
}
// big soft out-of-focus lantern glows far behind (depth of field)
for (const [x, y, z, sc, rgb, op] of [[-6.5, 2.5, -4, 3.6, '255,170,80', 0.55], [6.8, 3.2, -5, 4.4, '255,140,70', 0.5], [-3.0, 1.0, -7, 2.4, '255,200,110', 0.45], [4.0, 0.6, -6, 2.0, '210,255,130', 0.3], [0.5, 4.5, -8, 3.0, '255,120,90', 0.35]]) {
  const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(rgb, 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: op, fog: false })); b.position.set(x, y, z); b.scale.setScalar(sc); scene.add(b);
}
// marigold petals and fireflies drifting in the dusk
const dust = new THREE.Group();
for (let i = 0; i < 80; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(i % 3 ? '255,205,110' : '210,255,120', 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 + (i % 5) * 0.12, fog: false }));
  const a = i * 2.399; s.position.set(Math.cos(a) * (3.5 + (i % 9) * 0.4), 0.3 + (i * 0.37) % 3.2, Math.sin(a) * (2.0 + (i % 7) * 0.5)); s.scale.setScalar(0.07 + (i % 4) * 0.07); dust.add(s);
}
scene.add(dust);
const petalM = new THREE.MeshStandardMaterial({ color: 0xff9a1c, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x5a2400, emissiveIntensity: 0.6 });
const pg = new THREE.CircleGeometry(0.14, 8); pg.scale(1, 1.5, 1);
for (const [x, y, z, rx, ry] of [[3.7, 0.3, 1.8, 0.7, 0.5], [-3.9, 0.5, -1.9, 1.1, 0.3], [2.6, 0.9, 2.9, 0.4, 1.2], [-2.7, 1.2, 1.5, 0.9, 0.8], [1.0, 1.6, -0.3, 0.6, 0.1]]) { const m = new THREE.Mesh(pg, petalM); m.position.set(x, y, z); m.rotation.set(rx, ry, 0.4); scene.add(m); }

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
camera.position.set(0.0, 6.4, 8.4); camera.lookAt(0.0, 0.2, -0.3);
B.renderIcon({ scene, camera, size: SIZE, renderer, exposure: 0.95, background: '#2a1a3a', bloom: 0.38, vignette: 0.62 });
document.title = 'READY';
