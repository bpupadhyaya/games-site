// Tatami 3D presenter. It READS the game state (game.getState()) and the room snapshot view.js records in v3.frame; it never writes
// game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a traditional room (shoji, tokonoma, low table, cushions,
// paper lamps, afternoon light with dust motes) around a dark timber floor on which real thick tatami mats are laid.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { theme } from '../src/ui.js';
import {
  TAU, MAT, clamp, ease, easeOut, rng, hash, softCanvas, strawTextures, heriTexture, plasterTexture, shojiTexture, scrollTexture, boardsTexture,
  makeMatGeos, buildRoomGeos, buildTeaSet, buildVase, buildZabuton, buildAndon,
} from './models.js';
import { createHands } from './hands.js';

const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, fx: 2 },
  { name: 'medium', dpr: 1.5, shadow: 1024, fx: 1 },
  { name: 'low', dpr: 1, shadow: 0, fx: 0 },
];

// Season looks: light, paper tint, straw / cloth colours, ambience particles.
const LOOKS3D = {
  spring: { key: 0xffe3cc, keyI: 3.2, hemiSky: 0xfff0f4, hemiGround: 0x4a3a30, hemi: 0.75, fill: 0xbcd0ff, fillI: 0.4, rim: 0xffd0b0, rimI: 1.2, bg: 0x1a1218, exposure: 1.02, shoji: '#fff1e8', glow: 0xffd8c8, straw: 0xc3bc7a, strawGiven: 0x9d9760, heri: '#1f2958', zab: 0xa83a54, vase: 'spring', fx: 'petal', fxColor: 0xffb8cc, silk: '#33406a', cloth: 0x7a2a45 },
  summer: { key: 0xfff0c8, keyI: 3.3, hemiSky: 0xeaffee, hemiGround: 0x2f3a2a, hemi: 0.75, fill: 0x9ad0ff, fillI: 0.4, rim: 0xd8ffd0, rimI: 1.1, bg: 0x0c1a16, exposure: 1.02, shoji: '#f2ffe6', glow: 0xd8ffc8, straw: 0xb3c070, strawGiven: 0x909d58, heri: '#173558', zab: 0x2a6a58, vase: 'summer', fx: 'firefly', fxColor: 0xf4ff9a, silk: '#1f4a54', cloth: 0x1f5a6a },
  autumn: { key: 0xffbc78, keyI: 3.5, hemiSky: 0xffdcae, hemiGround: 0x3a2518, hemi: 0.72, fill: 0xb8b8ff, fillI: 0.3, rim: 0xff9a60, rimI: 1.4, bg: 0x1c110a, exposure: 1.03, shoji: '#ffe8c2', glow: 0xffc080, straw: 0xc4b268, strawGiven: 0x9e8e4c, heri: '#43201a', zab: 0x8a3a1a, vase: 'autumn', fx: 'leaf', fxColor: 0xe0702a, silk: '#4a2a22', cloth: 0x8a3a1a },
  winter: { key: 0xdce8ff, keyI: 2.9, hemiSky: 0xdfeaff, hemiGround: 0x2a3042, hemi: 0.8, fill: 0xffd8a8, fillI: 0.5, rim: 0xcfe0ff, rimI: 1.2, bg: 0x0a1020, exposure: 1.05, shoji: '#eef4ff', glow: 0xdfe9ff, straw: 0xc2c28c, strawGiven: 0x9e9e68, heri: '#1c2c52', zab: 0x34508a, vase: 'winter', fx: 'snow', fxColor: 0xffffff, silk: '#2a3a62', cloth: 0x34508a },
};

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- scene, light
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 400);
  const rig = B.lightingRig(scene, 'warmIndoor', { renderer, shadow: TIERS[tier].shadow, extent: 9, fog: { near: 26, far: 80 }, target: [0, 0, 0] });
  rig.key.shadow.camera.far = 60; rig.key.shadow.bias = -0.0006;
  let env = null;
  const buildEnv = () => { try { if (!env) env = B.createEnvironment(renderer, scene, { intensity: 0.42 }); else env.rebuild(); } catch (e) { /* keep going without IBL */ } };

  const glowTex = softCanvas('255,255,255', 0.95), ringTex = softCanvas('255,255,255', 0.95, true);
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);

  // ---------------------------------------------------------------- materials
  const straw = strawTextures();
  const strawBase = { map: straw.map, bumpMap: straw.bump, bumpScale: 1.4, roughness: 0.82, metalness: 0 };
  const halfMap = straw.map.clone(); halfMap.needsUpdate = true;
  const halfBump = straw.bump.clone(); halfBump.needsUpdate = true;
  const mats = {
    full: [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ ...strawBase })),
    half: [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ ...strawBase, map: halfMap, bumpMap: halfBump })),
    given: new THREE.MeshStandardMaterial({ ...strawBase }),
    givenHalf: new THREE.MeshStandardMaterial({ ...strawBase, map: halfMap, bumpMap: halfBump }),
  };
  const heriMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.0 });
  const emblemMat = new THREE.MeshStandardMaterial({ color: 0xe8c060, roughness: 0.35, metalness: 0.8, emissive: 0x3a2a08 });
  const floorMat = new THREE.MeshPhysicalMaterial({ color: 0x2a190d, roughness: 0.38, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  const plaster = plasterTexture('#d9ccb0');
  const wallMat = new THREE.MeshStandardMaterial({ map: plaster.map, roughness: 0.95, color: 0xe6d6b4 });
  const capMat = new THREE.MeshPhysicalMaterial({ color: 0x3a2314, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const geos = makeMatGeos();

  // ---------------------------------------------------------------- the room under the mats
  const roomRoot = new THREE.Group(); scene.add(roomRoot);
  let roomKey = '', cols = 6, rows = 5, floorMesh = null, wallMesh = null, capMesh = null;
  const tiles = new Map();           // key -> entry
  const leaving = [];
  let primed = false;

  // ---------------------------------------------------------------- set dressing (built once, re-laid when the room size changes)
  const set = new THREE.Group(); scene.add(set);
  const outerTex = boardsTexture('#3e2918', '#58402a', 3);
  outerTex.map.repeat.set(30, 30); outerTex.bump.repeat.set(30, 30);
  const outerMat = new THREE.MeshStandardMaterial({ map: outerTex.map, bumpMap: outerTex.bump, bumpScale: 1.2, roughness: 0.55, metalness: 0 });
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), outerMat); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.002; outer.receiveShadow = true; set.add(outer);

  const wood = B.material('darkWood', { color: '#2c1a0f', color2: '#4a2c18', seed: 3 });
  const shojiTexA = shojiTexture(4, 2, { paper: '#fff6e4' }); shojiTexA.repeat.set(4, 1);
  const shojiMat = new THREE.MeshBasicMaterial({ map: shojiTexA, toneMapped: false, fog: false });
  function shojiWall(width, height) {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(width, height), shojiMat); paper.position.y = height / 2; g.add(paper);
    const beamT = new THREE.Mesh(new THREE.BoxGeometry(width, 0.28, 0.2), wood); beamT.position.set(0, height + 0.14, 0.05); beamT.castShadow = true; g.add(beamT);
    const beamB = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, 0.2), wood); beamB.position.set(0, 0.1, 0.06); g.add(beamB);
    const n = Math.round(width / 4.2);
    for (let i = 0; i <= n; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, height, 0.18), wood); p.position.set(-width / 2 + (i * width) / n, height / 2, 0.06); p.castShadow = true; g.add(p); }
    return g;
  }
  const backWall = shojiWall(40, 5.2); set.add(backWall);
  const leftWall = shojiWall(34, 5.2); leftWall.rotation.y = Math.PI / 2; set.add(leftWall);
  const rightWall = shojiWall(34, 5.2); rightWall.rotation.y = -Math.PI / 2; set.add(rightWall);

  // tokonoma: raised dais, recessed plaster panel, hanging scroll, vase
  const toko = new THREE.Group(); set.add(toko);
  const dais = new THREE.Mesh(B.slab(3.6, 1.7, 0.2, 0.05, 0.025), new THREE.MeshPhysicalMaterial({ color: 0x5a3a1e, roughness: 0.3, clearcoat: 0.7 })); dais.receiveShadow = true; dais.castShadow = true; toko.add(dais);
  const tokoBack = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.4, 0.1), new THREE.MeshStandardMaterial({ map: plaster.map, color: 0xb9a888, roughness: 1 })); tokoBack.position.set(0, 2.4, -0.82); tokoBack.receiveShadow = true; toko.add(tokoBack);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.5, 10), B.material('wood', { color: '#6a4a28', color2: '#8a6238', seed: 4 })); post.position.set(-1.9, 2.25, -0.1); post.castShadow = true; toko.add(post);
  const kamoi = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.22, 0.3), wood); kamoi.position.set(0, 4.5, -0.3); toko.add(kamoi);
  const scrollMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const scrollMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.85), scrollMat); scrollMesh.position.set(0.2, 2.65, -0.74); toko.add(scrollMesh);
  const scrollRod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8), wood); scrollRod.rotation.z = Math.PI / 2; scrollRod.position.set(0.2, 1.2, -0.72); toko.add(scrollRod);
  let vase = null;

  // low table with a tea set, two zabuton
  const table = new THREE.Group(); set.add(table);
  const tTop = new THREE.Mesh(B.lathe([[0, 0.34], [0.75, 0.34], [0.78, 0.36], [0.78, 0.4], [0.7, 0.42], [0, 0.42]], 32), B.material('lacquer', { color: '#2a120c', color2: '#4a1c12' })); tTop.castShadow = true; tTop.receiveShadow = true; table.add(tTop);
  const tLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.34, 14), wood); tLeg.position.y = 0.17; tLeg.castShadow = true; table.add(tLeg);
  const teaset = buildTeaSet(); teaset.position.set(0, 0.42, 0); teaset.scale.setScalar(0.85); table.add(teaset);
  const zabutons = [buildZabuton(0xa83a54), buildZabuton(0xa83a54)]; zabutons.forEach((z, i) => { z.position.set(i ? 1.3 : -1.3, 0.055, i ? 0.1 : -0.2); z.rotation.y = i ? 0.5 : -0.3; table.add(z); });
  const andons = [buildAndon(), buildAndon()]; andons.forEach((a) => set.add(a));
  // a neat stack of spare mats at the front of the room
  const spare = new THREE.Group(); set.add(spare);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(geos.fullCore, mats.full[i % 3]); m.position.set(0.03 * Math.sin(i * 2.1), 0.085 * i, 0.02 * i); m.rotation.y = 0.04 * Math.sin(i * 3.7); m.castShadow = true; m.receiveShadow = true;
    const h = new THREE.Mesh(geos.fullHeri, heriMat); h.position.copy(m.position); h.rotation.copy(m.rotation); h.receiveShadow = true; spare.add(m, h);
  }
  const lampLights = andons.map(() => { const l = new THREE.PointLight(0xffb866, 3.2, 8, 1.8); set.add(l); return l; });

  // light from the paper screen: a lattice-patterned spot so the afternoon sun falls in window panes across the room
  const sunTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); x.fillStyle = '#fff'; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) x.fillRect(30 + i * 160, 30 + j * 160, 140, 140); return new THREE.CanvasTexture(c); })();
  const sun = new THREE.SpotLight(0xfff0d0, 55, 60, 0.5, 0.35, 1.2);
  sun.castShadow = false; if ('map' in sun) sun.map = sunTex;
  set.add(sun, sun.target);

  // light shafts (additive soft beams) + dust motes
  const shaftTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,240,200,0.0)'); g.addColorStop(0.15, 'rgba(255,240,200,0.9)'); g.addColorStop(0.8, 'rgba(255,240,200,0.25)'); g.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 256); const h = x.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 64, 256); return new THREE.CanvasTexture(c); })();
  const shafts = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 11), new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide, color: 0xffe8b8 }));
    m.renderOrder = 4; set.add(m); shafts.push(m);
  }
  const NDUST = 90;
  const dust = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: glowTex, color: 0xfff0c8, size: 0.07, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  { const a = new Float32Array(NDUST * 3), r = rng(31); for (let i = 0; i < NDUST; i++) { a[i * 3] = (r() - 0.5) * 16; a[i * 3 + 1] = 0.3 + r() * 4; a[i * 3 + 2] = (r() - 0.5) * 12; } dust.geometry.setAttribute('position', new THREE.BufferAttribute(a, 3)); dust.userData.base = a.slice(); dust.frustumCulled = false; scene.add(dust); }
  const NFX = 70;
  const fxPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: glowTex, color: 0xffb8cc, size: 0.2, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true }));
  { const a = new Float32Array(NFX * 3), r = rng(5); for (let i = 0; i < NFX; i++) { a[i * 3] = (r() - 0.5) * 22; a[i * 3 + 1] = r() * 8; a[i * 3 + 2] = (r() - 0.5) * 16; } fxPts.geometry.setAttribute('position', new THREE.BufferAttribute(a, 3)); fxPts.userData.base = a.slice(); fxPts.frustumCulled = false; scene.add(fxPts); }
  // landing dust puffs (pooled)
  const NP = 70, puffs = [];
  const puffGeo = new THREE.BufferGeometry();
  puffGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  puffGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const puffPts = new THREE.Points(puffGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.22, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  puffPts.frustumCulled = false; scene.add(puffPts);
  const burst = (x, y, z, n, spread = 0.7, up = 0.5) => {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = (0.25 + Math.random()) * spread; puffs.push({ x, y, z, vx: Math.cos(a) * sp, vy: up * (0.2 + Math.random()), vz: Math.sin(a) * sp, life: 0, max: 0.45 + Math.random() * 0.4 }); }
    if (puffs.length > NP) puffs.splice(0, puffs.length - NP);
  };

  // ---------------------------------------------------------------- markers (rings / glows lying on the mats), ghost mats, gems
  const markRoot = new THREE.Group(); scene.add(markRoot);
  const markPool = []; let markN = 0;
  function markQuad(x, z, tex, color, op, sx, sz = sx, rot = 0, y = MAT.FLOOR + MAT.TH + 0.012) {
    let m = markPool[markN];
    if (!m) { m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); m.renderOrder = 6; markRoot.add(m); markPool.push(m); }
    markN++; m.visible = true; m.material.map = tex; m.material.color.set(color); m.material.opacity = clamp(op, 0, 1);
    m.position.set(x, y, z); m.scale.set(sx, 1, sz); m.rotation.y = rot;
  }
  const ghostMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const ghosts = { drag: new THREE.Mesh(geos.fullCore, ghostMat(0xffffff)), answer: new THREE.Mesh(geos.fullCore, ghostMat(0x3fe0a0)), wrong: new THREE.Mesh(geos.fullCore, ghostMat(0xff4a3a)) };
  for (const g of Object.values(ghosts)) { g.visible = false; g.renderOrder = 5; scene.add(g); }
  const gemGeo = new THREE.SphereGeometry(0.075, 14, 10), gemMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false });
  const gems = []; const gemRoot = new THREE.Group(); scene.add(gemRoot);

  // ---------------------------------------------------------------- looks
  let look = '', looks = LOOKS3D.spring;
  const heriCache = {};
  function applyLook(name) {
    look = LOOKS3D[name] ? name : 'spring'; looks = LOOKS3D[look]; v3.look = look;
    const c = looks;
    rig.key.color.setHex(c.key); rig.key.intensity = c.keyI; rig.key.position.set(-11, 7.5, 5);
    rig.fill.color.setHex(c.fill); rig.fill.intensity = c.fillI;
    rig.hemi.color.setHex(c.hemiSky); rig.hemi.groundColor.setHex(c.hemiGround); rig.hemi.intensity = c.hemi;
    rig.rim.color.setHex(c.rim); rig.rim.intensity = c.rimI; rig.rim.position.set(6, 5, -9);
    renderer.toneMappingExposure = c.exposure;
    scene.background = new THREE.Color(c.bg); scene.fog = new THREE.Fog(c.bg, 22, 70); renderer.setClearColor(c.bg, 1);
    const tones = [1, 0.88, 1.1];
    mats.full.forEach((m, i) => m.color.setHex(c.straw).multiplyScalar(tones[i]));
    mats.half.forEach((m, i) => m.color.setHex(c.straw).multiplyScalar(tones[i]));
    mats.given.color.setHex(c.strawGiven); mats.givenHalf.color.setHex(c.strawGiven);
    if (!heriCache[look]) heriCache[look] = heriTexture(c.heri, '#e0b850');
    heriMat.map = heriCache[look]; heriMat.needsUpdate = true;
    shojiMat.color.set(c.shoji);
    shafts.forEach((s) => s.material.color.setHex(c.glow));
    sun.color.setHex(c.key);
    scrollMat.map = scrollTexture(c.silk); scrollMat.needsUpdate = true;
    zabutons.forEach((z) => { z.material.color.setHex(c.zab); });
    if (vase) toko.remove(vase);
    vase = buildVase(c.vase); vase.position.set(-1.05, 0.2, 0.0); vase.scale.setScalar(0.95); toko.add(vase);
    fxPts.material.color.setHex(c.fxColor); fxPts.material.size = c.fx === 'snow' ? 0.14 : c.fx === 'firefly' ? 0.22 : 0.2;
    fxPts.material.blending = c.fx === 'firefly' ? THREE.AdditiveBlending : THREE.NormalBlending; fxPts.material.needsUpdate = true;
    buildEnv();
  }

  // ---------------------------------------------------------------- room geometry for the current puzzle
  function rebuildRoom(Bd, key) {
    roomKey = key; cols = Bd.w; rows = Bd.h;
    for (const e of tiles.values()) roomRoot.remove(e.grp);
    for (const l of leaving) roomRoot.remove(l.e.grp);
    tiles.clear(); leaving.length = 0; primed = false;
    for (const m of [floorMesh, wallMesh, capMesh]) if (m) { roomRoot.remove(m); m.geometry.dispose(); }
    const g = buildRoomGeos(Bd);
    floorMesh = g.floor ? new THREE.Mesh(g.floor, floorMat) : null;
    wallMesh = g.walls ? new THREE.Mesh(g.walls, wallMat) : null;
    capMesh = g.caps ? new THREE.Mesh(g.caps, capMat) : null;
    for (const m of [floorMesh, wallMesh, capMesh]) if (m) { m.castShadow = true; m.receiveShadow = true; roomRoot.add(m); }
    layoutSet();
  }
  function layoutSet() {
    const Ex = cols / 2 + 1.2, Ez = rows / 2 + 1.2;
    backWall.position.set(0, 0, -(Ez + 3.4));
    leftWall.position.set(-(Ex + 5.2), 0, 0);
    rightWall.position.set(Ex + 5.2, 0, 0);
    toko.position.set(-Ex * 0.25 - 0.3, 0.0, -(Ez + 3.4) + 1.0);
    table.position.set(Ex * 0.55 + 0.6, 0, -(Ez + 1.7));
    andons[0].position.set(-Ex - 1.6, 0, -(Ez + 1.6)); andons[1].position.set(Ex + 1.7, 0, Ez + 1.0);
    spare.position.set(Ex * 0.55 + 3.1, 0, -(Ez + 1.1)); spare.rotation.y = -0.12;
    lampLights.forEach((l, i) => l.position.set(andons[i].position.x, 0.8, andons[i].position.z));
    sun.position.set(-(Ex + 7.5), 8.5, -(Ez * 0.4)); sun.target.position.set(0, 0, 0);
    const kx = -(Ex + 4), ky = 5.5;
    shafts.forEach((s, i) => {
      const t0 = new THREE.Vector3(kx, ky - i * 0.4, -Ez * 0.9 + i * (Ez * 0.9)), t1 = new THREE.Vector3(-0.6 + i * 1.2, 0.0, -Ez * 0.4 + i * Ez * 0.55);
      const mid = t0.clone().lerp(t1, 0.5); s.position.copy(mid);
      const dir = t1.clone().sub(t0), len = dir.length();
      s.scale.set(1, len / 11, 1);
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    });
    const sh = rig.key.shadow.camera, ext = Math.max(cols, rows) / 2 + 9; sh.left = sh.bottom = -ext; sh.right = sh.top = ext; sh.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- camera fit + projection
  let W = 1, Hh = 1, dprNow = 1, VW = 720, VH = 1280, clock = 0, lastT = 0, frames = 0, ema = 16;
  const tmp = new THREE.Vector3(), ray = new THREE.Vector3(), cpos = new THREE.Vector3();
  function fitCamera(rect, pitchDeg, fov, yawDeg = 0, fill = 1) {
    const k = W / VW, tw = rect.w * k * fill, th = rect.h * k * fill, p = (pitchDeg * Math.PI) / 180, yw = (yawDeg * Math.PI) / 180;
    const Ex = cols / 2 + 0.34, Ez = rows / 2 + 0.34, lookY = 0.1, corners = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, MAT.WALL + 0.05]) corners.push(new THREE.Vector3(sx * Ex, y, sz * Ez));
    camera.fov = fov; camera.aspect = W / Hh; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const place = (d) => { camera.position.set(Math.sin(yw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yw) * Math.cos(p) * d); camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); };
    const extent = (d) => {
      place(d); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of corners) { tmp.copy(c).project(camera); const px = ((tmp.x + 1) / 2) * W, py = ((1 - tmp.y) / 2) * Hh; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
      return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    };
    let lo = 4, hi = 300;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2, e = extent(mid); if (e.w > tw || e.h > th) lo = mid; else hi = mid; }
    const e = extent(hi), cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W, Hh, e.cx - cxp, e.cy - cyp, W, Hh);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => { tmp.set(x, y, z).project(camera); return { x: ((tmp.x + 1) / 2) * VW, y: ((1 - tmp.y) / 2) * VH }; };
  v3.proj = (gx, gy, h = 0) => toVirt(gx - cols / 2, h, gy - rows / 2);
  v3.unit = () => Math.abs(toVirt(0.5, MAT.FLOOR + MAT.TH, 0).x - toVirt(-0.5, MAT.FLOOR + MAT.TH, 0).x);
  v3.unproj = (x, y) => {
    const ndx = (x / VW) * 2 - 1, ndy = 1 - (y / VH) * 2;
    ray.set(ndx, ndy, 0.5).unproject(camera); cpos.setFromMatrixPosition(camera.matrixWorld);
    ray.sub(cpos).normalize();
    const ph = MAT.FLOOR + MAT.TH * 0.5;
    if (Math.abs(ray.y) < 1e-5) return null;
    const t = (ph - cpos.y) / ray.y;
    if (t <= 0) return null;
    return { gx: cpos.x + ray.x * t + cols / 2, gy: cpos.z + ray.z * t + rows / 2 };
  };

  // geo: roomGeo (virtual units) or null; kind: 'play' | 'over' | 'title' | 'ambient'. opts.board = the board the room is built for.
  v3.fit = (geo, kind = 'play', opts = {}) => {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    if (w !== W || h !== Hh) { W = w; Hh = h; renderer.setPixelRatio(dprNow); renderer.setSize(w, h, false); }
    const calm = !!opts.calm, land = VW > VH;
    if (opts.board) { cols = opts.board.w; rows = opts.board.h; }
    const rect = geo ? (opts.rect || geo.area) : (opts.rect || { x: VW * 0.04, y: VH * 0.04, w: VW * 0.92, h: VH * 0.5 });
    const drift = kind === 'title' && !calm ? Math.sin(clock * 0.22) * 6 : kind === 'ambient' && !calm ? Math.sin(clock * 0.12) * 7 : 0;
    let pitch = kind === 'title' ? (land ? 26 : 25) : kind === 'ambient' ? 42 : (land ? 44 : 45);
    
    fitCamera(rect, pitch, kind === 'title' ? 30 : 32, drift, kind === 'title' ? 0.9 : 1);

    v3.geo = geo || null; v3.hit = geo ? rect : null;
  };

  // ---------------------------------------------------------------- tiles
  const BASEY = MAT.FLOOR;
  const matGroup = (tl, Bd) => {
    const half = tl.a === tl.b, stand = !half && tl.b === tl.a + Bd.w;
    const grp = new THREE.Group();
    const tone = Math.floor(hash(tl.a * 3.1 + tl.id) * 3);
    const core = new THREE.Mesh(half ? geos.halfCore : geos.fullCore, tl.given ? (half ? mats.givenHalf : mats.given) : (half ? mats.half : mats.full)[tone]);
    core.castShadow = true; core.receiveShadow = true; grp.add(core);
    const heri = new THREE.Mesh(half ? geos.halfHeri : geos.fullHeri, heriMat); heri.receiveShadow = true; grp.add(heri);
    if (tl.given) { const em = new THREE.Mesh(geos.emblem, emblemMat); em.position.y = MAT.TH - 0.002; grp.add(em); }
    const c = tl.a % Bd.w, r = Math.floor(tl.a / Bd.w);
    const cx = half ? c + 0.5 : stand ? c + 0.5 : c + 1, cz = half ? r + 0.5 : stand ? r + 1 : r + 0.5;
    const jit = hash(tl.a * 7.7 + 1) - 0.5;
    return { grp, core, heri, half, stand, x: cx - Bd.w / 2 + jit * 0.004, z: cz - Bd.h / 2 + (hash(tl.a * 3.3) - 0.5) * 0.004, yaw: (stand ? Math.PI / 2 : 0) + jit * 0.012, key: '', t: 99, delay: 0, landed: true };
  };
  function poseTile(e, t, win) {
    // t: seconds since placed (99 = at rest). Slide in, land with a soft pat, settle.
    let dy = 0, dz = 0, rx = 0, sy = 1;
    if (t < 3) {
      const u = clamp(t / 0.3, 0, 1), s = easeOut(u);
      dy = (1 - s) * 0.55; dz = (1 - s) * 0.5; rx = -(1 - s) * 0.2;
      if (t >= 0.3) { const q = t - 0.3; dy += Math.abs(Math.sin(q * 34)) * 0.032 * Math.exp(-q * 11); sy = 1 - 0.14 * Math.exp(-q * 16) * Math.cos(q * 20); }
    }
    let lift = 0;
    if (win > 0) lift = Math.max(0, Math.sin(clock * 5 - ((e.x + cols / 2) + (e.z + rows / 2)) * 0.7)) * 0.1;
    e.grp.position.set(e.x, BASEY + dy + lift, e.z + dz);
    e.grp.rotation.set(rx, e.yaw, 0, 'YXZ');
    e.grp.scale.set(1, sy, 1);
  }
  const hands = createHands({ THREE, scene, camera, renderer, burst, look: () => looks });

  function presentTiles(fr, dt) {
    const Bd = fr.B, win = fr.win || 0;
    const seen = new Set();
    let fresh = 0;
    let added = 0;
    for (const tl of Bd.tiles) { if (tl && !tiles.has(`${tl.id}:${tl.a}:${tl.b}:${tl.given ? 1 : 0}`)) added++; }
    const bulk = added >= 4;          // a whole batch appearing at once (resume, solve, preview) is shown laid, not animated
    for (const tl of Bd.tiles) {
      if (!tl) continue;
      const key = `${tl.id}:${tl.a}:${tl.b}:${tl.given ? 1 : 0}`;
      seen.add(key);
      if (!tiles.has(key)) {
        const e = matGroup(tl, Bd); e.key = key;
        if (primed && !bulk) { e.t = 0; e.landed = false; fresh++; }
        tiles.set(key, e); roomRoot.add(e.grp);
        if (primed && !bulk) hands.place(e, tl, Bd);
      }
    }
    let gone = 0;
    for (const [key, e] of tiles) if (!seen.has(key)) { tiles.delete(key); gone++; if (e.__bulk) continue; leaving.push({ e, t: 0 }); hands.cancel(e); }
    if (gone >= 4) { for (const l of leaving) roomRoot.remove(l.e.grp); leaving.length = 0; }
    for (const e of tiles.values()) {
      if (e.t < 90) e.t += dt;
      if (!e.landed && e.t >= 0.3) {
        e.landed = true;
        const len = e.half ? 0.5 : 1;
        burst(e.x, BASEY + MAT.TH, e.z, 8, 0.45, 0.35);
        for (const sd of [-1, 1]) burst(e.x + (e.stand ? 0 : sd * len), BASEY + MAT.TH, e.z + (e.stand ? sd * len : 0), 3, 0.35, 0.25);
      }
      poseTile(e, e.t, win);
    }
    for (let i = leaving.length - 1; i >= 0; i--) {
      const l = leaving[i]; l.t += dt;
      const u = clamp(l.t / 0.22, 0, 1);
      if (u >= 1) { roomRoot.remove(l.e.grp); leaving.splice(i, 1); continue; }
      l.e.grp.position.y = BASEY + ease(u) * 0.5; l.e.grp.scale.set(1 - 0.1 * u, 1 - u * 0.6, 1 - 0.1 * u);
      l.e.grp.rotation.set(0, l.e.yaw, ease(u) * 0.2);
    }
    primed = true;
  }

  function ghostOf(g, a, b, Bd, y) {
    const half = a === b, stand = !half && b === a + Bd.w, c = a % Bd.w, r = Math.floor(a / Bd.w);
    const cx = half ? c + 0.5 : stand ? c + 0.5 : c + 1, cz = half ? r + 0.5 : stand ? r + 1 : r + 0.5;
    g.geometry = half ? geos.halfCore : geos.fullCore;
    g.position.set(cx - Bd.w / 2, y, cz - Bd.h / 2); g.rotation.set(0, stand ? Math.PI / 2 : 0, 0); g.visible = true;
  }

  function presentMarks(fr) {
    const Bd = fr.B, pulse = 0.5 + 0.5 * Math.sin(clock * 5), top = BASEY + MAT.TH;
    const X = (c) => c - Bd.w / 2, Z = (r) => r - Bd.h / 2;
    for (const g of Object.values(ghosts)) g.visible = false;
    if (fr.hide) { gemRoot.visible = false; return; }
    gemRoot.visible = true;
    if (fr.ghost) {
      const g = fr.ghost; ghostOf(ghosts.drag, g.a, g.b, Bd, top + 0.07 + 0.02 * Math.sin(clock * 8));
      ghosts.drag.material.color.set(g.ok ? 0xfff6dc : 0xff4a3a); ghosts.drag.material.opacity = 0.42 + 0.12 * pulse;
    }
    const m = fr.marks;
    if (m) {
      const acc = theme().accent.length === 7 ? theme().accent : '#ffcf5a';
      if (m.cells) for (const c of m.cells) { const cx = X(c % Bd.w + 0.5), cz = Z(Math.floor(c / Bd.w) + 0.5); markQuad(cx, cz, ringTex, acc, 0.8 + 0.2 * pulse, 1.15 + 0.06 * pulse); markQuad(cx, cz, glowTex, '#ffe9a8', 0.25, 1.5); }
      if (m.answer) { ghostOf(ghosts.answer, m.answer.a, m.answer.b, Bd, top + 0.03); ghosts.answer.material.opacity = 0.3 + 0.2 * pulse; }
      if (m.wrong) { ghostOf(ghosts.wrong, m.wrong.a, m.wrong.b, Bd, top + 0.03); ghosts.wrong.material.opacity = 0.35 + 0.25 * pulse; }
    }
    // four-corner violations: glowing red marks with a small gem, a ring and a halo on the mats
    const pts = [...(fr.bad || []), ...((m && m.points) || [])];
    while (gems.length < pts.length) { const gm = new THREE.Mesh(gemGeo, gemMat); gems.push(gm); gemRoot.add(gm); }
    gems.forEach((gm, i) => {
      const v = pts[i]; gm.visible = !!v; if (!v) return;
      const x = X(v.c), z = Z(v.r), p2 = 0.5 + 0.5 * Math.sin(clock * 6 + i);
      gm.position.set(x, top + 0.06 + 0.012 * p2, z); gm.scale.setScalar(1 + 0.25 * p2); gm.rotation.y = clock * 2;
      markQuad(x, z, glowTex, '#ff3b30', 0.6 + 0.3 * p2, 1.1 + 0.15 * p2, undefined, 0, top + 0.015);
      markQuad(x, z, ringTex, '#ff7a5a', 0.9, 0.8 + 0.1 * p2, undefined, 0, top + 0.02);
    });
  }

  // ---------------------------------------------------------------- ambience
  function stepParts(dt) {
    for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 0.5 * dt; p.vx *= 0.96; p.vz *= 0.96; if (p.life >= p.max) puffs.splice(i, 1); }
    const pos = puffGeo.attributes.position, col = puffGeo.attributes.color;
    for (let i = 0; i < NP; i++) {
      const p = puffs[i];
      if (!p) { pos.setXYZ(i, 0, -50, 0); col.setXYZ(i, 0, 0, 0); continue; }
      const f = 1 - p.life / p.max;
      pos.setXYZ(i, p.x, p.y, p.z); col.setXYZ(i, 0.55 * f, 0.5 * f, 0.38 * f);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }
  function ambience(calm) {
    const t = clock, c = looks, fxl = TIERS[tier].fx;
    const da = dust.geometry.attributes.position, db = dust.userData.base, sp = calm ? 0.3 : 1;
    for (let i = 0; i < da.count; i++) {
      da.array[i * 3] = db[i * 3] + Math.sin(t * 0.15 * sp + i) * 0.5;
      da.array[i * 3 + 1] = db[i * 3 + 1] + Math.sin(t * 0.2 * sp + i * 2.3) * 0.25;
      da.array[i * 3 + 2] = db[i * 3 + 2] + Math.cos(t * 0.13 * sp + i * 1.7) * 0.5;
    }
    da.needsUpdate = true; dust.material.opacity = 0.55 + 0.3 * Math.sin(t * 0.7);
    dust.visible = fxl >= 1;
    shafts.forEach((s, i) => { s.material.opacity = (0.075 + 0.04 * Math.sin(t * 0.35 + i * 1.7)) * (fxl >= 1 ? 1 : 0.5); });
    const a = fxPts.geometry.attributes.position, b = fxPts.userData.base, kind = c.fx;
    const Ex = cols / 2 + 3;
    for (let i = 0; i < a.count; i++) {
      const bx = b[i * 3] * (Ex / 8), by = b[i * 3 + 1], bz = b[i * 3 + 2];
      if (kind === 'firefly') {
        a.array[i * 3] = bx + Math.sin(t * 0.4 + i) * 0.9; a.array[i * 3 + 1] = 0.5 + (by % 3.4) + Math.sin(t * 0.7 + i * 3) * 0.3; a.array[i * 3 + 2] = bz + Math.cos(t * 0.35 + i) * 0.9;
      } else {
        const speed = kind === 'snow' ? 0.18 : kind === 'leaf' ? 0.32 : 0.25, fall = (t * (speed + (i % 5) * 0.03) * (calm ? 0.4 : 1) + by) % 8;
        a.array[i * 3] = bx + Math.sin(t * 0.6 + i) * (kind === 'snow' ? 0.4 : 0.9) + fall * 0.15; a.array[i * 3 + 1] = 8 - fall; a.array[i * 3 + 2] = bz + Math.cos(t * 0.5 + i * 2) * 0.6;
      }
    }
    a.needsUpdate = true;
    fxPts.visible = fxl >= 1;
    fxPts.material.opacity = kind === 'firefly' ? 0.5 + 0.4 * Math.sin(t * 2.1) : 0.85;
    const flick = calm ? 1 : 1 + 0.08 * Math.sin(t * 7.1) + 0.05 * Math.sin(t * 12.3 + 1);
    lampLights.forEach((l, i) => { l.intensity = (fxl >= 1 ? 3.2 : 1.8) * flick * (i ? 0.9 : 1); });
    scrollMesh.rotation.z = calm ? 0 : Math.sin(t * 0.8) * 0.004;
    rig.key.intensity = c.keyI * (calm ? 1 : 1 + 0.02 * Math.sin(t * 0.6));
  }

  // ---------------------------------------------------------------- frame
  function present(state, dt) {
    const fr = v3.frame, calm = !!(state.prefs && state.prefs.calm);
    markN = 0;
    const want = state.prefs && LOOKS3D[state.prefs.look] ? state.prefs.look : 'spring';
    if (want !== look) applyLook(want);
    const Bd = fr ? fr.B : (v3.ambientBoard || null);
    if (Bd) {
      const key = `${Bd.w}x${Bd.h}:${Array.from(Bd.room).join('')}`;
      if (key !== roomKey) rebuildRoom(Bd, key);
    }
    roomRoot.visible = !!Bd;
    if (fr && Bd) {
      presentTiles(fr, dt);
      for (const e of tiles.values()) e.grp.visible = !fr.hide;
      presentMarks(fr);
      hands.update(dt, clock, { fr, BASEY, cols, rows, calm });
    } else { for (const g of Object.values(ghosts)) g.visible = false; gemRoot.visible = false; hands.hide(); }
    stepParts(dt);
    ambience(calm);
    for (let i = markN; i < markPool.length; i++) markPool[i].visible = false;
    renderer.setViewport(0, 0, W, Hh);
    renderer.render(scene, camera);
  }

  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; rig.key.castShadow = t.shadow > 0;
    if (t.shadow) { rig.key.shadow.mapSize.set(t.shadow, t.shadow); if (rig.key.shadow.map) { rig.key.shadow.map.dispose(); rig.key.shadow.map = null; } }
    dprNow = Math.min(window.devicePixelRatio || 1, t.dpr); W = 0;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    W = 0;
    try { applyTier(); look = ''; } catch (err) { /* ignore */ }   // look = '' rebuilds the look-dependent textures and the environment next frame
    v3.on = true;
  });

  try { applyLook('spring'); applyTier(); layoutSet(); }
  catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  v3.on = true;
  const origFit = v3.fit;
  v3.fit = (geo, kind, opts) => { try { origFit(geo, kind, opts); } catch (e) { console.warn('3D fit failed', e); v3.on = false; } };

  return {
    ok: true, renderer, scene, camera, rig, hands,
    wrap(game) {
      return Object.assign({}, game, {
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          VW = view?.width ?? 720; VH = view?.height ?? 1280;
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.frame = null;
          game.render(ctx, view);
          try { present(state, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
