// Offline app-icon render (developer tool, not part of the shipped game flow): the ivory elephant with its howdah on a carved
// uncheckered sandalwood dais with brass inlay, in front of the palace arch at sunset with oil lamps. Same models as the game.
//   node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store
import { board3d as B, THREE } from './vendor3d/index.js';
import { buildPiece, buildCourt, buildLamp, mats, glowTexture, TILE_TOP } from './view3d/models.js';

const q = new URLSearchParams(location.search), size = +(q.get('size') || 2048);
const num = (k, d) => (q.has(k) ? +q.get(k) : d);
const canvas = document.createElement('canvas'); document.getElementById('stage').appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
B.createEnvironment(renderer, scene, { intensity: 0.4 });
const M = mats();
const court = buildCourt(); court.position.z = num('wall', 12);
const dim = num('dim', 0.45); scene.add(court);
{ // a deeper dusk behind the ivory: indigo above, crimson and a warm halo behind the elephant
  const c = document.createElement('canvas'); c.width = 512; c.height = 320; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, '#05061a'); g.addColorStop(0.5, '#1c0b2e'); g.addColorStop(0.85, '#5a1a1c'); g.addColorStop(1, '#8a3418');
  x.fillStyle = g; x.fillRect(0, 0, 512, 320);
  const h = x.createRadialGradient(256, 190, 4, 256, 190, 190); h.addColorStop(0, 'rgba(255,150,60,0.55)'); h.addColorStop(0.4, 'rgba(230,100,50,0.4)'); h.addColorStop(1, 'rgba(200,60,40,0)');
  x.fillStyle = h; x.fillRect(0, 0, 512, 320);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  court.traverse((o) => { if (o.material && o.material.isMeshBasicMaterial && o.material.map) { o.material.map = t; o.material.color.setScalar(dim); o.material.needsUpdate = true; } });
}

// the dais: a carved plinth carrying a 3x3 patch of the board, brass inlay and studs
const dais = new THREE.Group(); scene.add(dais);
const wood = B.material('darkWood', { color: '#4a2410', color2: '#7a4526', seed: 17, size: 512 });
const foot = new THREE.Mesh(B.slab(4.6, 4.6, 0.16, 0.4, 0.07), wood); foot.castShadow = foot.receiveShadow = true; dais.add(foot);
const top = new THREE.Mesh(B.slab(4.2, 4.2, 0.22, 0.3, 0.06), wood); top.position.y = 0.16; top.castShadow = top.receiveShadow = true; dais.add(top);
const matA = B.material('wood', { color: '#c58b46', color2: '#e3b373', seed: 5, size: 256 }), matB = B.material('darkWood', { color: '#2b1a12', color2: '#43291b', seed: 9, size: 256 });
const tile = B.slab(0.97, 0.97, 0.1, 0.025, 0.02);
for (let r = 0; r < 3; r++) for (let f = 0; f < 3; f++) {
  const m = new THREE.Mesh(tile, matA); m.position.set((f - 1) * 1.0, 0.38 - 0.0, (r - 1) * 1.0); m.castShadow = m.receiveShadow = true; dais.add(m);
}
const ring = (w, wd) => { const s = new THREE.Shape([[-w, -w], [w, -w], [w, w], [-w, w]].map(([x, z]) => new THREE.Vector2(x, z))); s.holes.push(new THREE.Path([[-w + wd, -w + wd], [-w + wd, w - wd], [w - wd, w - wd], [w - wd, -w + wd]].map(([x, z]) => new THREE.Vector2(x, z)))); return B.inlay(s, 0.03, { bevel: 0.004 }); };
const i1 = new THREE.Mesh(ring(1.55, 0.07), M.brass); i1.position.y = 0.46; dais.add(i1);
const i2 = new THREE.Mesh(ring(1.95, 0.05), M.brass); i2.position.y = 0.37; dais.add(i2);
for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), M.brass); s.position.set(sx * 2.0, 0.4, sz * 2.0); s.scale.y = 0.7; dais.add(s); }
const topY = 0.48;

// the hero
const hero = buildPiece(3, 1);
hero.scale.multiplyScalar(num('s', 1.5)); hero.rotation.y += Math.PI + num('turn', 0.5); hero.position.set(0, topY, 0.1);
scene.add(hero);
const rug = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x5a1520, roughness: 0.95 })); rug.rotation.x = -Math.PI / 2; rug.position.y = -0.01; rug.receiveShadow = true; scene.add(rug);

// lights: warm key from the front left, strong sunset rim behind, lamps
const rig = B.lightingRig(scene, 'warmIndoor', {
  renderer, shadow: 4096, extent: 5, fog: { near: 20, far: 70 }, target: [0, 1.0, 0],
  overrides: { bg: 0x150a06, fog: 0x3a1a10, hemiSky: 0xffd8b0, hemiGround: 0x3a1a10, hemi: 0.3, key: 0xffdcb0, keyI: 2.4, keyPos: [-5, 6, 8], fill: 0xb7c4ff, fillI: 0.3, fillPos: [7, 3, 6], rim: 0xffa050, rimI: 3.4, rimPos: [4, 4, -7], exposure: 0.92, env: 0.3 },
});
const gl = glowTexture('255,190,100'), fl = glowTexture('255,235,170', 96);
for (const [x, z, tall] of [[-3.6, -1.4, true], [3.7, -1.2, true]]) {
  const l = buildLamp(tall ? 2.5 : 1.6); l.group.position.set(x, 0, z); scene.add(l.group);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fl, color: 0xffcf80, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); s.scale.set(0.8, 1.2, 1); s.position.set(x, l.flameY + 0.25, z); scene.add(s);
  const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: gl, color: 0xff9a40, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); h.scale.set(4.5, 4.5, 1); h.position.set(x, l.flameY + 0.25, z); scene.add(h);
}

const camera = new THREE.PerspectiveCamera(num('fov', 24), 1, 0.5, 200);
const dist = num('dist', 7), pitch = (num('pitch', 8) * Math.PI) / 180, yaw = (num('yaw', -5) * Math.PI) / 180;
const look = new THREE.Vector3(num('lx', 0.45), num('ly', 1.7), num('lz', 0));
camera.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
camera.lookAt(look);
const res = B.renderIcon({ scene, camera, size, renderer, background: '#1a0a06', bloom: 0.22, vignette: num('vig', 1.3), exposure: num('exp', 0.85) });
const c = document.createElement('canvas'); c.width = c.height = 1024; document.getElementById('stage').replaceChildren(c);
c.getContext('2d').drawImage(res.canvas, 0, 0, 1024, 1024);
document.title = 'READY';
