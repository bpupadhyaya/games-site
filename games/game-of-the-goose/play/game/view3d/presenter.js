// Game of the Goose 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: a candlelit Renaissance table with the spiral board (raised painted spaces, turned pawns with goose finials,
// small animated geese) and a screen-space HUD scene (parchment / leather plaques, lacquered buttons, tumbling dice).
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { sprites, drawDesk } from '../src/art.js';
import { drawBoard } from '../src/boardview.js';
import { SPOT, TILE_W, TILE_H, GARDEN_R } from '../src/board.js';
import { FINAL, ROADS, kindOf } from '../src/engine.js';
import { SPEEDS } from '../src/rulesdata.js';
import { makeGoose, poseGoose, makePawn, makeProp, makeCandle, makeInkwell, makeSeal, MAT, PLAYER_HEX } from './models.js';

const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048 },
  { name: 'medium', dpr: 1.5, shadow: 1024 },
  { name: 'low', dpr: 1, shadow: 0 },
];
export const PLATE = 10, HALF = 5.7, RW = PLATE * 0.455, TILE_TOP = 0.095;
const TS = Math.min(TILE_W, TILE_H) * RW;
const spotW = (n) => (n >= FINAL ? { x: 0, z: 0 } : { x: SPOT[n].x * RW, z: SPOT[n].y * RW });

function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, o = {}) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); } return t; }
function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function parchCanvas(size, a = '#f7ecc8', b = '#dcc48f', seed = 3) {
  const c = cv(size), x = c.getContext('2d'), r = rngOf(seed);
  const g = x.createRadialGradient(size * 0.4, size * 0.35, size * 0.05, size / 2, size / 2, size * 0.75); g.addColorStop(0, a); g.addColorStop(1, b);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 1800; i++) { x.fillStyle = r() < 0.5 ? 'rgba(120,80,30,0.05)' : 'rgba(255,255,240,0.08)'; x.fillRect(r() * size, r() * size, 1 + r() * 3, 1 + r() * 3); }
  for (let i = 0; i < 5; i++) { const gx = r() * size, gy = r() * size, gr = size * (0.06 + r() * 0.12), gg = x.createRadialGradient(gx, gy, 0, gx, gy, gr); gg.addColorStop(0, 'rgba(140,96,40,0.18)'); gg.addColorStop(1, 'rgba(140,96,40,0)'); x.fillStyle = gg; x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2); }
  const v = x.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.72); v.addColorStop(0, 'rgba(90,50,10,0)'); v.addColorStop(1, 'rgba(90,50,10,0.35)'); x.fillStyle = v; x.fillRect(0, 0, size, size);
  return c;
}
function leatherCanvas(size, base = '#3b2416', seed = 9) {
  const c = cv(size), x = c.getContext('2d'), r = rngOf(seed);
  const g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, '#4a2f1b'); g.addColorStop(0.5, base); g.addColorStop(1, '#2a180d'); x.fillStyle = g; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 3500; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,220,170,0.05)' : 'rgba(0,0,0,0.1)'; x.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2); }
  return c;
}
function blobCanvas(rgb, a, size = 128) { const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, size, size); return c; }
function pipFace(v, size = 128) {
  const c = cv(size), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#e8d8ac'); x.fillStyle = g; x.fillRect(0, 0, size, size);
  const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
  for (const [px, py] of P) {
    const cx = size / 2 + px * size * 0.25, cy = size / 2 + py * size * 0.25, rad = size * (v === 1 ? 0.15 : 0.095);
    const pg = x.createRadialGradient(cx - rad * 0.3, cy - rad * 0.3, 1, cx, cy, rad); pg.addColorStop(0, v === 1 ? '#c8463a' : '#4a3426'); pg.addColorStop(1, v === 1 ? '#6a1612' : '#140a04');
    x.fillStyle = pg; x.beginPath(); x.arc(cx, cy, rad, 0, TAU); x.fill();
  }
  return c;
}
const DIE_FACE = [3, 4, 1, 6, 2, 5];                        // +x -x +y -y +z -z
const FACE_N = { 3: [1, 0, 0], 4: [-1, 0, 0], 1: [0, 1, 0], 6: [0, -1, 0], 2: [0, 0, 1], 5: [0, 0, -1] };

const tick = () => new Promise((r) => setTimeout(r, 0));   // yield to the browser so the flat title paints and stays interactive while the 3D scene builds
export async function createPresenter({ kitCanvas, quality = 'high' }) {
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  const noop = { wrap: (g) => g, ok: false };
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.autoClear = false;
  renderer.setClearColor(0x120a05, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  await tick();
  // ---------------------------------------------------------------- the scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120a05);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 120);
  const rig = B.lightingRig(scene, 'warmIndoor', { renderer, shadow: TIERS[tier].shadow || 0, extent: 8, background: false, fog: false, target: [0, 0, 0],
    overrides: { keyPos: [-5.5, 11, 6], keyI: 3.3, hemi: 0.5, hemiGround: 0x3a2412, fillI: 0.45, rimI: 1.6, rimPos: [6, 5, -8], exposure: 0.95, env: 0.4 } });
  const key = rig.key;
  const envHandle = B.createEnvironment(renderer, scene, { intensity: 0.4 });
  const candleLight = new THREE.PointLight(0xffa860, 14, 16, 1.6); candleLight.position.set(-3.8, 2.2, -8.0); scene.add(candleLight);

  const hud = new THREE.Scene();
  const hudCam = new THREE.PerspectiveCamera();
  const hudLight = new THREE.DirectionalLight(0xfff0d6, 1.6); hudLight.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0xffc890, 0.45); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe6c8, 0x2a1a10, 0.6), hudLight, hudFill);
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  await tick();
  // ---------------------------------------------------------------- table, board frame, plate
  const table = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), B.material('darkWood', { color: '#2a170c', color2: '#4a2c16', repeat: [7, 7], seed: 11, size: 512 }));
  table.material.color.set('#8a6a52'); table.rotation.x = -Math.PI / 2; table.position.y = -0.3; table.receiveShadow = true; scene.add(table);
  const boardG = new THREE.Group(); scene.add(boardG);
  const base = new THREE.Mesh(B.slab(HALF * 2 + 0.7, HALF * 2 + 0.7, 0.3, 0.3, 0.08), B.material('darkWood', { color: '#34200f', color2: '#573419', repeat: [2, 2], seed: 21 }));
  base.position.y = -0.3; boardG.add(base);
  const frameMat = B.material('wood', { color: '#7a4a22', color2: '#b27a3a', repeat: [3, 1], seed: 8 });
  const brassMat = MAT.brass();
  for (const [x, z, w, d] of [[0, -HALF - 0.28, HALF * 2 + 1.2, 0.62], [0, HALF + 0.28, HALF * 2 + 1.2, 0.62], [-HALF - 0.28, 0, 0.62, HALF * 2], [HALF + 0.28, 0, 0.62, HALF * 2]]) {
    const f = new THREE.Mesh(B.slab(w, d, 0.2, 0.12, 0.06), frameMat); f.position.set(x, 0, z); f.castShadow = f.receiveShadow = true; boardG.add(f);
  }
  const inl = new THREE.Group(); boardG.add(inl);
  for (const [x, z, w, d] of [[0, -HALF - 0.02, HALF * 2 + 0.1, 0.05], [0, HALF + 0.02, HALF * 2 + 0.1, 0.05], [-HALF - 0.02, 0, 0.05, HALF * 2], [HALF + 0.02, 0, 0.05, HALF * 2]]) {
    const s = new THREE.Mesh(B.slab(w, d, 0.215, 0.02, 0.01), brassMat); s.position.set(x, 0, z); inl.add(s);
  }
  // gilded corner studs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), brassMat); s.position.set(sx * (HALF + 0.28), 0.24, sz * (HALF + 0.28)); s.castShadow = true; boardG.add(s);
  }
  await tick();
  const plateCanvas = cv(2048);
  const plateTex = tex(plateCanvas);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(PLATE, PLATE), new THREE.MeshStandardMaterial({ map: plateTex, color: '#e2cc9c', roughness: 0.82, metalness: 0 }));
  plate.rotation.x = -Math.PI / 2; plate.position.y = 0.004; plate.receiveShadow = true; boardG.add(plate);
  function paintPlate() {
    const was = v3.on; v3.on = false;
    const x = plateCanvas.getContext('2d'); x.clearRect(0, 0, 2048, 2048);
    try { drawBoard(x, { x: 0, y: 0, w: 2048, h: 2048 }, { base: true, noNumbers: true, t: 0 }); } catch (e) { console.warn('plate paint', e); }
    v3.on = was; plateTex.needsUpdate = true;
  }
  paintPlate();
  if (document.fonts?.ready) document.fonts.ready.then(paintPlate);

  // ---------------------------------------------------------------- the 62 raised spaces + props
  const tiles = [], geese = [], propsRoot = new THREE.Group(); boardG.add(propsRoot);
  const tileGeo = B.slab(TILE_W * RW * 0.97, TILE_H * RW * 0.97, TILE_TOP, 0.1, 0.03);
  const gooseFor = {};
  async function buildTiles() {
    const { drawTile, drawPicture } = await import('../src/art.js');
    const W = 192;
    for (let n = 1; n < FINAL; n++) {
      if (n % 8 === 0) await tick();
      const kind = kindOf(n), c = cv(W, W), x = c.getContext('2d');
      drawTile(x, n, W / 2, W / 2, W - 10, W - 10, 0, kind);
      x.strokeStyle = '#c99a2e'; x.lineWidth = 6; x.beginPath(); x.roundRect(3, 3, W - 6, W - 6, 26); x.stroke();
      if (kind === 'road') { x.fillStyle = 'rgba(143,42,34,0.0)'; }
      const t = tex(c);
      const m = new THREE.MeshPhysicalMaterial({ map: t, color: '#ecdcb4', roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3 });
      const mesh = new THREE.Mesh(tileGeo, m);
      const p = spotW(n);
      mesh.position.set(p.x, 0, p.z); mesh.rotation.y = -SPOT[n].ang; mesh.castShadow = true; mesh.receiveShadow = true;
      boardG.add(mesh); tiles[n] = mesh;
      if (kind === 'goose') {
        const gs = makeGoose(); gs.scale.setScalar(0.95); gs.position.set(p.x, TILE_TOP, p.z); gs.rotation.y = (n % 2 ? 0.7 : -2.3) + n * 0.05; propsRoot.add(gs); geese.push({ n, g: gs }); gooseFor[n] = gs;
      } else if (kind !== 'plain' && kind !== 'start' && kind !== 'garden') {
        const pr = makeProp(kind); pr.position.set(p.x, TILE_TOP, p.z); pr.scale.setScalar(1.0); pr.rotation.y = kind === 'bridge' || kind === 'inn' ? 0.1 : 0; propsRoot.add(pr);
      }
    }
    void drawPicture;
  }
  await tick();
  // garden: brass-rimmed raised disc with the great goose
  const garden = new THREE.Group(); boardG.add(garden);
  const gr = GARDEN_R * RW;
  const gRim = new THREE.Mesh(new THREE.TorusGeometry(gr + 0.03, 0.06, 10, 48), brassMat); gRim.rotation.x = Math.PI / 2; gRim.position.y = 0.05; gRim.castShadow = true; garden.add(gRim);
  const bigGoose = makeGoose(); bigGoose.scale.setScalar(1.7); bigGoose.position.set(0, 0.0, 0); garden.add(bigGoose);
  const startFlag = new THREE.Group(); { const sp = spotW(0); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), MAT.wood()); pole.position.y = 0.45; const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.28), new THREE.MeshStandardMaterial({ color: '#a8342a', side: THREE.DoubleSide, roughness: 0.8 })); cloth.position.set(0.24, 0.76, 0); startFlag.add(pole, cloth); startFlag.position.set(sp.x, 0, sp.z); startFlag.userData.cloth = cloth; pole.castShadow = true; boardG.add(startFlag); }

  // roads (variant): cream cord arcs over the spaces with an arrowhead
  const roadG = [];
  for (const r of ROADS) {
    const a = spotW(r.from), b = spotW(r.to), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
    let nx = -dz / len, nz = dx / len; if (mx * nx + mz * nz < 0) { nx = -nx; nz = -nz; }
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(a.x, TILE_TOP + 0.05, a.z), new THREE.Vector3(mx + nx * len * 0.3, TILE_TOP + 0.55, mz + nz * len * 0.3), new THREE.Vector3(b.x, TILE_TOP + 0.05, b.z)]);
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#f4e6bd', roughness: 0.7, emissive: '#000000' });
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 28, 0.035, 8), mat));
    const tan = c.getTangent(1);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.13, 0.3, 10), mat); head.position.copy(c.getPoint(1)).addScaledVector(tan, -0.12);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan); g.add(head);
    g.visible = false; boardG.add(g); roadG.push({ g, mat, from: r.from });
  }

  await tick();
  // ---------------------------------------------------------------- table props: candle, inkwell + quill, seal, motes
  const candle = makeCandle(); candle.position.set(-3.8, -0.3, -8.3); scene.add(candle);
  const flameTex = tex(blobCanvas('255,200,110', 1, 64));
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  flame.scale.set(0.7, 1.0, 1); flame.position.set(-3.8, 1.25, -8.3); scene.add(flame);
  const ink = makeInkwell(); ink.position.set(3.7, -0.3, -8.2); ink.rotation.y = 0.6; scene.add(ink);
  const seal = makeSeal(); seal.position.set(3.4, -0.3, 8.4); seal.rotation.y = -0.3; scene.add(seal);
  const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 3.0, 20), new THREE.MeshStandardMaterial({ map: tex(parchCanvas(256)), roughness: 0.9 })); scroll.rotation.z = Math.PI / 2; scroll.rotation.y = 0.5; scroll.position.set(-3.2, -0.02, 8.6); scroll.castShadow = true; scene.add(scroll);
  const motes = (() => {
    const n = 40, pos = new Float32Array(n * 3), r = rngOf(77);
    for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 18; pos[i * 3 + 1] = r() * 8; pos[i * 3 + 2] = (r() - 0.5) * 18; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ map: tex(blobCanvas('255,226,170', 0.9, 32)), size: 0.22, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    p.frustumCulled = false; scene.add(p); return p;
  })();

  // ---------------------------------------------------------------- pieces, rings, feathers
  const pawnPool = [];
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobTex = tex(blobCanvas('0,0,0', 0.7));
  function pawnAt(i) {
    while (pawnPool.length <= i) {
      const wrap = new THREE.Group();
      const shadow = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 }));
      shadow.position.y = 0.012; shadow.scale.setScalar(0.95); shadow.renderOrder = 1;
      const model = makePawn(i); wrap.add(shadow, model); wrap.userData = { model, shadow, seat: i, settle: 0, was: false }; wrap.visible = false; scene.add(wrap); pawnPool.push(wrap);
    }
    return pawnPool[i];
  }
  const ringPool = {}; const ringUsed = {};
  function ring(color, x, z, scale, op) {
    const pool = ringPool[color] ?? (ringPool[color] = []), k = ringUsed[color] ?? 0; ringUsed[color] = k + 1;
    let m = pool[k];
    if (!m) { m = B.glowRing(0.6, color); m.renderOrder = 3; boardG.add(m); pool.push(m); }
    m.visible = true; m.position.set(x, TILE_TOP + 0.02, z); m.scale.setScalar(scale); m.material.opacity = op;
  }
  const featherGeo = new THREE.PlaneGeometry(0.16, 0.5); const featherMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', side: THREE.DoubleSide, roughness: 0.6, transparent: true });
  const feathers = new THREE.InstancedMesh(featherGeo, featherMat, 60); feathers.frustumCulled = false; scene.add(feathers);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const hash = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------------------------------------------------------------- HUD plaques, buttons, dice
  const hudPanels = [], hudButtons = [], geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 150) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.12, ...o });
  const woodHud = B.material('darkWood', { color: '#4a2a14', color2: '#7a4a24', repeat: [2, 2], seed: 31 });
  const signWood = B.material('wood', { color: '#8a5528', color2: '#c28a46', repeat: [3, 1], seed: 41 });
  const parchM = new THREE.MeshStandardMaterial({ map: tex(parchCanvas(512)), roughness: 0.92 });
  const parchHiM = new THREE.MeshStandardMaterial({ map: tex(parchCanvas(512, '#fff6d8', '#ecd8a0', 5)), roughness: 0.85, emissive: '#3a2406', emissiveIntensity: 0.35 });
  const leatherM = new THREE.MeshStandardMaterial({ map: tex(leatherCanvas(512)), roughness: 0.85 });
  const insetM = new THREE.MeshStandardMaterial({ color: '#1a0f08', roughness: 0.9 });
  const BTN = {
    primary: phys('#9a2c22', { emissive: '#3a0a06', emissiveIntensity: 0.4 }), gold: phys('#e3ae3f', { metalness: 0.4, roughness: 0.3 }),
    parch: phys('#efdfb8'), quiet: phys('#5a3a22', { clearcoat: 0.6 }), ghost: phys('#3e2616', { clearcoat: 0.5 }), on: phys('#2f7a6e'),
    disabled: phys('#2a1d14', { clearcoat: 0.2 }), danger: phys('#6a1a1a'),
  };
  const ROT = Math.PI / 2;
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x0a0503, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  const vigC = cv(256), vx = vigC.getContext('2d'), vg = vx.createRadialGradient(128, 128, 60, 128, 128, 182);
  vg.addColorStop(0, 'rgba(8,3,0,0)'); vg.addColorStop(1, 'rgba(8,3,0,0.62)'); vx.fillStyle = vg; vx.fillRect(0, 0, 256, 256);
  const vig = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(vigC), transparent: true, depthWrite: false })); hud.add(vig);
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(new THREE.BufferGeometry(), woodHud), trim = new THREE.Mesh(new THREE.BufferGeometry(), brassMat), inner = new THREE.Mesh(new THREE.BufferGeometry(), parchM); g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p); }
    return p;
  }
  function placePanel(i, r, rad, kind) {
    const p = panelAt(i); p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -700, dep = kind === 'inset' ? 4 : 14, ins = kind === 'inset' ? 0 : kind === 'sign' ? 12 : 7;
    if (kind === 'inset') {
      p.outer.visible = false; p.trim.visible = false;
      p.inner.geometry = slabG(r.w, r.h, 6, rad, 2); p.inner.material = insetM; p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
      return;
    }
    p.outer.visible = p.trim.visible = true;
    p.outer.material = kind === 'sign' ? signWood : woodHud;
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.6); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.8, Math.max(3, rad - ins), 2.2); p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    p.inner.material = kind === 'parch' ? parchM : kind === 'cur' ? parchHiM : kind === 'sign' ? leatherM : leatherM;
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BufferGeometry(), BTN.quiet), rim = new THREE.Mesh(new THREE.BufferGeometry(), brassMat); g.add(rim, body); hud.add(g); b = { g, body, rim }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt, pressed) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(bt.rad ?? 18, r.h / 2 - 1), z = -400, dep = pressed ? 8 : 18;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, Math.max(2, rad - 3), 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.body.material = BTN[bt.kind] ?? BTN.ghost;
    b.g.position.set(0, pressed ? -3 : 0, 0);
  }
  const dieGeo = B.roundedBox(1, 1, 1, 0.16, 5);
  const dieMats = DIE_FACE.map((v) => new THREE.MeshPhysicalMaterial({ map: tex(pipFace(v)), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
  const dice = [];
  for (let i = 0; i < 2; i++) {
    const d = new THREE.Mesh(dieGeo, dieMats); d.visible = false; hud.add(d);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.7 })); sh.visible = false; hud.add(sh);
    dice.push({ d, sh });
  }
  const restQ = (v, i) => {
    const n = FACE_N[v] ?? FACE_N[2];
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...n), new THREE.Vector3(0, 0, 1));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.35 + i * 0.9));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5));
    return q;
  };

  // ---------------------------------------------------------------- camera fitting
  let W = 1, H = 1, dprNow = 1, L_ = null, hudW = 0, hudH = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  function fitCamera(rect, L, pitchDeg, fov, yawDeg = 0) {
    const k = W / L.w, targetW = rect.w * k, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180, lookY = 0.1;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    let d = 24;
    const place = () => {
      camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    for (let it = 0; it < 5; it++) {
      place();
      const a = tmpV.set(-HALF, 0, HALF).project(camera).x, b = tmpW.set(HALF, 0, HALF).project(camera).x;
      d *= (((b - a) / 2) * W) / targetW;
    }
    place();
    const c = tmpV.set(0, 0, 0).project(camera);
    const px0 = ((c.x + 1) / 2) * W, py0 = ((1 - c.y) / 2) * H, cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + (rect.h ?? rect.w) / 2) * k;
    camera.setViewOffset(W, H, px0 - cxp, py0 - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  v3.sq = (n, ox = 0, oz = 0) => {
    if (!L_) return null;
    const p = spotW(Math.min(n, FINAL));
    tmpV.set(p.x + ox * TS, TILE_TOP, p.z + oz * TS).project(camera);
    const a = { x: ((tmpV.x + 1) / 2) * L_.w, y: ((1 - tmpV.y) / 2) * L_.h };
    tmpW.set(p.x + 1, TILE_TOP, p.z).project(camera);
    return { x: a.x, y: a.y, k: Math.abs(((tmpW.x + 1) / 2) * L_.w - a.x) || 50 };
  };

  // ---------------------------------------------------------------- sprites: the same pawns rendered once to canvases for the 2D layer
  function buildSprites() {
    const SP = 256, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(14, 1, 1, 60);
    const l1 = new THREE.DirectionalLight(0xfff2dc, 3.2); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0xffc890, 1.1); l2.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xfff0dc, 0x4a3a2c, 1.1), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.5;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0);
    const sh = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    for (let s = 0; s < 6; s++) {
      const m = makePawn(s); m.rotation.y = -0.3; sc.add(m);
      cam.position.set(0, 0.5 + Math.sin(0.28) * 8.6, Math.cos(0.28) * 8.6); cam.lookAt(0, 0.52, 0); cam.updateMatrixWorld();
      renderer.clear(); renderer.render(sc, cam);
      const c = cv(SP); c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sprites.pawn[s] = c; sc.remove(m);
    }
    renderer.setClearColor(0x120a05, 1);
    renderer.setPixelRatio(pr); renderer.setSize(szw, szh, false); renderer.shadowMap.enabled = sh;
    W = 0; sprites.ready = true;
  }

  // ---------------------------------------------------------------- frame
  let lastT = 0, clock = 0, frames = 0, ema = 16;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
  const spd = (st) => SPEEDS[st.prefs?.speedIdx ?? 0]?.k ?? 1;

  function placePawn(w, x, z, o = {}) {
    w.visible = true; w.position.set(x, TILE_TOP, z);
    const m = w.userData.model, sh = w.userData.shadow, lift = o.lift || 0, sq = o.squash || 0, s = o.scale ?? 1;
    m.position.y = lift; m.rotation.y = o.yaw ?? 0; m.rotation.z = o.tilt || 0;
    m.scale.set(s * (1 + sq * 0.5), s * (1 - sq), s * (1 + sq * 0.5));
    sh.scale.setScalar(0.95 * s * (1 - clamp(lift * 0.35, 0, 0.45)));
    sh.material.opacity = 0.75 * (1 - clamp(lift * 0.5, 0, 0.6));
  }
  let ringsHidden = 0;
  function resetRings() { for (const k of Object.keys(ringUsed)) ringUsed[k] = 0; }
  function hideRings() { for (const [k, pool] of Object.entries(ringPool)) for (let i = ringUsed[k] ?? 0; i < pool.length; i++) pool[i].visible = false; ringsHidden++; }

  function pawnsFromState(state, dt) {
    const g = state.g; if (!g) return;
    const groups = new Map();
    g.players.forEach((p) => { if (!p.vis) { const a = groups.get(p.pos) ?? []; a.push(p.id); groups.set(p.pos, a); } });
    g.players.forEach((p) => {
      const w = pawnAt(p.seat), U = w.userData, isCur = p.id === g.cur && !g.over;
      let x, z, lift = 0, tilt = 0, squash = 0;
      if (p.vis) {
        const a = spotW(p.vis.from), b = spotW(p.vis.to), u = ease(p.vis.u);
        if (!U.hop) { U.hop = true; U.offx = (U.sx ?? a.x) - a.x; U.offz = (U.sz ?? a.z) - a.z; }       // leave the stack offset smoothly
        x = a.x + U.offx * (1 - u) + (b.x - a.x) * u; z = a.z + U.offz * (1 - u) + (b.z - a.z) * u;
        const arc = p.vis.k === 'leap' ? 1.1 : p.vis.k === 'slide' ? 0.18 : 0.38;
        lift = Math.sin(Math.PI * p.vis.u) * arc; tilt = Math.sin(Math.PI * p.vis.u) * 0.18; U.was = true; U.settle = 0;
      } else {
        U.hop = false;
        const grp = groups.get(p.pos) ?? [p.id], idx = Math.max(0, grp.indexOf(p.id)), n = grp.length, c = spotW(p.pos);
        let ox = 0, oz = 0;
        if (n > 1) { const a = (idx / n) * TAU + 0.6; ox = Math.cos(a) * TS * 0.3; oz = Math.sin(a) * TS * 0.22; }
        if (p.pos === 0) { ox = (idx - (n - 1) / 2) * TS * 0.5; oz = TS * 0.12; }
        if (p.pos >= FINAL) { const a = (idx / Math.max(1, n)) * TAU; ox = Math.cos(a) * 0.95; oz = Math.sin(a) * 0.95; }
        x = c.x + ox; z = c.z + oz;
        if (U.was) { U.settle += dt; const s = U.settle; squash = Math.exp(-s * 9) * Math.cos(s * 26) * 0.12; lift = Math.max(0, Math.exp(-s * 8) * Math.abs(Math.sin(s * 14)) * 0.12); if (s > 0.6) { U.was = false; U.settle = 0; } }
        else if (isCur && !state.prefs.calm) lift = 0.05 + Math.sin(clock * 4) * 0.035;
        if (isCur) ring('#f1c25a', x, z, 0.9 + Math.sin(clock * 4) * 0.05, 0.85);
      }
      // the sim steps in ticks, the screen in frames: critically damped smoothing removes the tick/frame beat (no 0,10,0,10 stutter)
      if (U.sx !== undefined && dt > 0) {
        const kx = 1 - Math.exp(-dt / 0.06); x = U.sx + (x - U.sx) * kx; z = U.sz + (z - U.sz) * kx;
        const kl = 1 - Math.exp(-dt / 0.04); lift = (U.sl ?? lift) + (lift - (U.sl ?? lift)) * kl;
      }
      U.sl = lift;
      U.sx = x; U.sz = z;
      const gooseLook = isCur ? Math.sin(clock * 1.3) * 0.5 : 0;
      poseGoose(U.model.userData.goose, clock + p.seat, 0, gooseLook);
      placePawn(w, x, z, { lift, tilt, squash, scale: 1.3, yaw: p.seat * 0.5 });
    });
    for (let i = g.players.length; i < pawnPool.length; i++) pawnPool[i].visible = false;
  }

  function heroPawns(state, dt) {
    const T = state.t || clock;
    const seats = [[0, null], [1, 17], [2, 36], [3, 52]];
    seats.forEach(([seat, fixed]) => {
      const w = pawnAt(seat);
      let pos = fixed ?? ((T * 2.0) % 62) + 1;
      const n0 = Math.floor(pos), u = pos - n0, a = spotW(n0), b = spotW(Math.min(FINAL - 1, n0 + 1));
      const hop = fixed === null ? Math.sin(Math.PI * u) * 0.35 : 0;
      placePawn(w, a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u, { lift: hop, yaw: seat * 0.6, scale: 1.3 });
      poseGoose(w.userData.model.userData.goose, clock + seat, 0, 0);
    });
    for (let i = 4; i < pawnPool.length; i++) pawnPool[i].visible = false;
    void dt;
  }

  function animateGeese(state) {
    const g = state.g, pops = g ? g.pops : [];
    for (const e of geese) {
      let flap = 0;
      for (const q of pops) if (q.n === e.n && q.fx === 'feather') flap = Math.max(flap, clamp(1 - q.age / 1.2, 0, 1));
      poseGoose(e.g, clock * (0.8 + (e.n % 3) * 0.15) + e.n, state.prefs?.calm ? 0 : flap, 0.2 * Math.sin(e.n));
    }
    let bigFlap = 0;
    if (g) { for (const q of g.pops) if (q.n === FINAL) bigFlap = Math.max(bigFlap, clamp(1 - q.age / 1.4, 0, 1)); bigFlap = Math.max(bigFlap, g.flap * 0.6); }
    else if (!state.prefs?.calm && (state.t % 6) < 0.8) bigFlap = 0.8 - (state.t % 6);
    bigGoose.rotation.y = clock * 0.25;
    poseGoose(bigGoose, clock, bigFlap, 0);
  }

  function updateFeathers(state) {
    const g = state.g; let k = 0;
    if (g && !state.prefs?.calm) {
      for (const q of g.pops) {
        if (q.fx !== 'feather') continue;
        const c = spotW(q.n), u = q.age / 1.4;
        for (let i = 0; i < 7 && k < 60; i++, k++) {
          const a = hash(i * 3 + q.n) * TAU, d = TS * (0.2 + u * (0.7 + hash(i + 5) * 0.8));
          _p.set(c.x + Math.cos(a) * d, TILE_TOP + 0.4 + u * 1.2 - u * u * 0.9 + hash(i) * 0.3, c.z + Math.sin(a) * d);
          _e.set(a + u * 3, a * 2 + u * 5, 0.5 + Math.sin(u * 9 + i)); _q.setFromEuler(_e);
          _s.setScalar(clamp(1.3 - u, 0.01, 1)); _m.compose(_p, _q, _s); feathers.setMatrixAt(k, _m);
        }
      }
    }
    for (; k < 60; k++) { _m.makeScale(0, 0, 0); feathers.setMatrixAt(k, _m); }
    feathers.instanceMatrix.needsUpdate = true;
  }

  // ----- phase 1: before the 2D UI draws (camera + projection used by the number labels and pops)
  function prepare(state, L) {
    resize(); L_ = L; if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const sc = state.scene, calm = !!state.prefs?.calm;
    if (sc === 'play') {
      const P = L.play; let r = { x: P.board.x, y: P.board.y, w: P.board.w, h: P.board.h };
      if (!L.land) {      // use all the room between the players strip and the narrator (the tilted board is shorter than it is wide)
        const top = P.players.y + P.players.h + 4, bot = P.narrator.y - 4, w = Math.min(L.S.w - 8, Math.max(P.board.w, (bot - top) / 0.95));
        r = { x: L.S.x + (L.S.w - w) / 2, y: top + (bot - top - w) / 2, w, h: w };
      }
      fitCamera(r, L, 58, 38, 0);
    }
    else if (sc === 'title') {
      const hr = v3.heroRect || { x: L.w * 0.05, y: L.h * 0.3, w: L.w * 0.9, h: L.w * 0.9 };
      fitCamera(hr, L, L.land ? 42 : 52, 34, calm ? 0 : Math.sin(clock * 0.18) * 7);
    } else fitCamera({ x: L.w * 0.04, y: L.h * 0.28, w: L.w * 0.92, h: L.w * 0.92 }, L, 38, 34, calm ? 0 : Math.sin(clock * 0.12) * 6);
  }

  // ----- phase 2: after the 2D UI recorded its panels, buttons and dice slots
  function present(state, L, dt) {
    const sc = state.scene, g = state.g, calm = !!state.prefs?.calm;
    key.position.set(-5.5, 11, 6); key.target.position.set(0, 0, 0);
    // candle flicker
    const fl = 0.85 + 0.15 * Math.sin(clock * 11) + 0.08 * Math.sin(clock * 23.7 + 1.3);
    candleLight.intensity = 13 * fl; flame.scale.set(0.62 * (0.9 + 0.1 * fl), 0.95 * fl, 1);
    startFlag.userData.cloth.rotation.y = Math.sin(clock * 2.3) * 0.35;
    // motes
    { const p = motes.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * 0.12; if (y > 8) y = 0; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(clock * 0.3 + i) * dt * 0.05); } p.needsUpdate = true; }
    resetRings();
    if (sc === 'play' && g) { pawnsFromState(state, dt); }
    else heroPawns(state, dt);
    animateGeese(state); updateFeathers(state);
    // highlighted spaces (move targets, the choice at Reveal, a hint)
    if (sc === 'play') {
      for (const h of v3.hi) {
        const c = spotW(h.n === FINAL ? FINAL : h.n), pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(clock * 6 + h.n);
        const big = h.n === FINAL ? 2.1 : 1.0;
        ring(h.strong ? '#ffe9a0' : '#f1c25a', c.x, c.z, (h.strong ? 1.15 : 1) * big * (1 + pulse * 0.05), 0.7 + 0.3 * pulse);
      }
    }
    hideRings();
    // roads variant
    const rd = v3.roads;
    for (const r of roadG) {
      r.g.visible = !!(rd && rd.on && sc === 'play');
      const act = rd && rd.active === r.from;
      r.mat.color.set(act ? '#d8453a' : '#f4e6bd'); r.mat.emissive.set(act ? '#6a1208' : '#000000');
    }
    // HUD
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p.r, p.rad, p.kind);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0; const pr = v3.pressed;
    for (const b of v3.buttons) {
      const pressed = !!pr && pr.x >= b.r.x && pr.x <= b.r.x + b.r.w && pr.y >= b.r.y && pr.y <= b.r.y + b.r.h;
      placeButton(n++, b, pressed);
    }
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    vig.scale.set(L.w * 1.5, L.h * 1.5, 1); vig.position.set(L.w / 2, -L.h / 2, -790);
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, -760);
    // dice: tumble for real, land on the thrown faces
    const showDice = sc === 'play' && g;
    for (let i = 0; i < 2; i++) {
      const D = dice[i], slot = v3.dice.find((s) => s.i === i);
      if (!showDice || !slot) { D.d.visible = D.sh.visible = false; continue; }
      const r = slot.r, size = r.w * 0.8, cx = r.x + r.w / 2, cy = -(r.y + r.h / 2);
      const rolling = g.phase === 'rolling' && g.rolling;
      const val = g.rolled ? g.dice[i] : [3, 4][i];
      let q = restQ(val, i), hop = 0;
      if (rolling) {
        const f = clamp(g.rollT / (0.85 * spd(state)), 0, 1);
        const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0.7 + i * 0.2, 0.55, 0.35).normalize(), (1 - ease(f)) * (7 + i * 2) * Math.PI);
        q = spin.multiply(q);
        hop = Math.abs(Math.sin(f * Math.PI * 2.4)) * (1 - f) * 0.6;
      }
      D.d.visible = true; D.d.quaternion.copy(q); D.d.scale.setScalar(size);
      D.d.position.set(cx, cy + size * (0.04 + hop * 0.7), -330 + size * 0.5);
      D.sh.visible = true; D.sh.scale.set(size * 1.1, size * 0.5, 1); D.sh.position.set(cx + size * 0.05, cy - size * 0.42, -340); D.sh.material.opacity = 0.6 * (1 - hop * 0.8);
    }
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    hud.environment = scene.environment; hud.environmentIntensity = 0.3;
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud, hudCam);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; sprites.ready = sprites.ready; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { envHandle.rebuild(); } catch (err) { /* no reflections, still playable */ }
    W = 0; resize(); v3.on = true;
  });

  try {
    applyTier(); await tick(); await buildTiles(); await tick(); buildSprites(); await tick();
    // Compile every shader program up front (parallel, off the main thread) so the first 3D frame is not a multi-hundred-ms stall.
    pawnAt(5); pawnPool.forEach((w) => { w.visible = true; });
    fitCamera({ x: 0, y: 0, w: 720, h: 720 }, { w: 720 }, 50, 30);
    try { await renderer.compileAsync(scene, camera); await renderer.compileAsync(hud, hudCam); } catch (e) { /* first frame compiles instead */ }
    pawnPool.forEach((w) => { w.visible = false; });
  } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, rig,
    probe: () => pawnPool.filter((w) => w.visible).map((w) => ({ seat: w.userData.seat, x: w.position.x, y: w.position.y + w.userData.model.position.y, z: w.position.z })),
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const L = layoutFor(view?.width ?? 720, view?.height ?? 1560);
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += state.g?.paused ? 0 : dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.dice.length = 0; v3.hi = []; v3.scrim = 0;
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
void drawDesk;
void PLAYER_HEX;
