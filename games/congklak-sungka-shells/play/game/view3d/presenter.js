// Congklak 3D presenter. READS the game state after every 2D frame and never writes to it. One WebGL canvas sits behind the
// kit's transparent 2D canvas: a carved teak congklak boat (hollowed houses and storehouse troughs, rounded oiled lip, brass and
// mother-of-pearl inlays, curled prow horns) lying on a batik cloth on a teak floor, glossy cowries (or saga seeds / pebbles)
// as instanced meshes, warm key + cool fill + rim light with soft shadows. The 2D canvas keeps every menu, HUD and text.
// The board is the same canonical 720 x 1560 board the rules and 2D art use: 1 unit = 0.01 world units (about 0.75 mm).
// Fallbacks: no WebGL / build failure -> v3.on stays false (flat 2D art); context lost -> v3.on = false; restored -> 3D again.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { layoutFor, posXY, STORE_BOX } from '../src/layout.js';
import { STORE } from '../src/rules.js';
import { woodTex, floorTex, batikTex, cowrieTex, ringTex, blobTex, charTex } from './mats.js';

const K = 0.01, CX = 360, CY = 798, TAU = Math.PI * 2;
const wx = (x) => (x - CX) * K, wz = (y) => (y - CY) * K;
const PR = 0.44, WALL = 0.37, LIP = 0.09, BOT = -0.36;               // house radius at the lip, wall radius, bowl floor
const HL = 4.75, HW = 2.02;                                          // hull half length / half width
const SR = [0.86, 0.4], SZ = [wz(STORE_BOX[0].y + 43), wz(STORE_BOX[1].y + 43)];   // store trough radii; z of [own, opponent's]
const SLAB = 0.72, BEV = 0.08, PLINTH = 0.2, FLOOR = -(SLAB + BEV * 2) - PLINTH;
const ease = (f) => f * f * (3 - 2 * f), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hw = (z, inset = 0) => { const a = Math.abs(z) / (HL - inset * 0.9); return a >= 1 ? 0 : Math.max(0, HW * Math.pow(1 - a ** 4, 0.8) - inset); };
const bowlY = (r) => BOT + (-LIP - BOT) * Math.pow(clamp(r / WALL, 0, 1), 2.2);
const TIERS = [{ dpr: 2, shadow: 2048 }, { dpr: 1.5, shadow: 1024 }, { dpr: 1, shadow: 0 }];
const yieldNow = () => new Promise((r) => setTimeout(r, 0));

function hullShape(inset = 0, n = 120) {
  const pts = [], L = HL - inset * 0.9;
  for (let i = 0; i <= n; i++) { const z = -L + (2 * L * i) / n; pts.push(new THREE.Vector2(hw(z, inset), -z)); }
  for (let i = n - 1; i > 0; i--) { const z = -L + (2 * L * i) / n; pts.push(new THREE.Vector2(-hw(z, inset), -z)); }
  return pts;
}
// a solid with the shape's outline in the XZ plane, top face at y = top (ExtrudeGeometry extrudes along +z; turn it so +z -> +y)
function extrudeUp(shape, depth, bevel, top, segs = 4) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: segs, curveSegments: 28 });
  g.rotateX(-Math.PI / 2); g.translate(0, top - depth - bevel, 0); g.computeVertexNormals();
  return g;
}

export async function createPresenter({ kitCanvas, icon = false }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: icon }); }
  catch (e) { console.warn('WebGL unavailable; 2D art stays', e); return null; }
  if (!renderer.getContext()) return null;
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '2';
  const vig = document.createElement('div');
  vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;transition:opacity .4s;background:radial-gradient(ellipse at 50% 46%, rgba(8,6,20,0) 55%, rgba(8,6,20,0.55) 100%)';
  kitCanvas.parentElement.insertBefore(vig, kitCanvas);

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const qs = new URLSearchParams(location.search);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : 0;

  // ---------------------------------------------------------------- scene, light, environment
  const scene = new THREE.Scene();
  const BG = 0x17142a;
  scene.background = new THREE.Color(BG); scene.fog = new THREE.Fog(BG, 16, 34);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 80);
  const hemi = new THREE.HemisphereLight(0xffe6c8, 0x3a2c38, 0.8);
  const key = new THREE.DirectionalLight(0xffd6a0, 3.1); key.position.set(-6, 7, 2.5);
  key.castShadow = true; Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 2, far: 24 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  const fill = new THREE.DirectionalLight(0x9fb4ff, 0.55); fill.position.set(6, 4, 6);
  const rim = new THREE.DirectionalLight(0xffa860, 1.6); rim.position.set(4, 3.5, -8);
  scene.add(hemi, key, key.target, fill, rim);
  B.createEnvironment(renderer, scene, { intensity: 0.6 });
  let lastW = 0, lastH = 0;
  const applyTier = () => {
    const tt = TIERS[tier];
    key.castShadow = tt.shadow > 0;
    if (tt.shadow) { key.shadow.mapSize.set(tt.shadow, tt.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    lastW = 0;
  };
  await yieldNow();

  // ---------------------------------------------------------------- floor and batik cloth
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.62, metalness: 0, color: 0x9a8a80 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR - 0.01; floor.receiveShadow = true; scene.add(floor);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 12.6), new THREE.MeshStandardMaterial({ map: batikTex(), roughness: 0.95, metalness: 0 }));
  cloth.rotation.x = -Math.PI / 2; cloth.position.y = FLOOR; cloth.receiveShadow = true;
  const clothRoot = new THREE.Group(); clothRoot.add(cloth); scene.add(clothRoot);
  await yieldNow();

  // ---------------------------------------------------------------- the board
  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  const woods = {
    teak: { c0: '#5e2f14', c1: '#9c5e32', pit: 0xb09080, plinth: 0x3a1f10 },
    dark: { c0: '#3a1a0c', c1: '#74402a', pit: 0xb09888, plinth: 0x1c0d06 },
  };
  const woodMats = {};
  const woodMat = (name) => {
    if (woodMats[name]) return woodMats[name];
    const w = woods[name] || woods.teak, tx = woodTex(w.c0, w.c1, name === 'dark' ? 11 : 7);
    const top = new THREE.MeshPhysicalMaterial({ map: tx.map, bumpMap: tx.bump, bumpScale: 0.6, roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.32, envMapIntensity: 0.9, side: THREE.DoubleSide });
    const pit = new THREE.MeshStandardMaterial({ map: tx.map, bumpMap: tx.bump, bumpScale: 0.4, color: w.pit, roughness: 0.62, side: THREE.DoubleSide, envMapIntensity: 0.55 });
    const plinth = new THREE.MeshStandardMaterial({ map: tx.map, color: w.plinth, roughness: 0.55 });
    return (woodMats[name] = { top, pit, plinth });
  };
  const shape = new THREE.Shape(hullShape(0));
  const houses = [];
  for (let i = 0; i < 15; i++) { if (i === 7) continue; const p = posXY(i); houses.push({ i, x: wx(p.x), z: wz(p.y) }); }
  for (const h of houses) { const path = new THREE.Path(); path.absarc(h.x, -h.z, PR, 0, TAU, true); shape.holes.push(path); }
  for (const z of SZ) { const path = new THREE.Path(); path.absellipse(0, -z, SR[0], SR[1], 0, TAU, true, 0); shape.holes.push(path); }
  const slabGeo = extrudeUp(shape, SLAB, BEV, 0);
  await yieldNow();
  const plinthGeo = extrudeUp(new THREE.Shape(hullShape(0.22)), PLINTH - 0.04, 0.03, -(SLAB + BEV * 2), 2);
  // house bowls: a short wall continuing the slab's hole, then a rounded floor
  const prof = []; for (let k = 0; k <= 10; k++) { const r = WALL * Math.sin((k / 10) * Math.PI / 2); prof.push([r, bowlY(r)]); }
  prof.push([WALL * 0.999, -LIP + 0.02], [WALL * 0.999, -BEV - 0.02]);
  const bowlGeo = B.lathe(prof, 36);
  const slabMesh = new THREE.Mesh(slabGeo); slabMesh.castShadow = slabMesh.receiveShadow = true;
  const plinthMesh = new THREE.Mesh(plinthGeo); plinthMesh.castShadow = plinthMesh.receiveShadow = true;
  const bowls = new THREE.InstancedMesh(bowlGeo, undefined, houses.length + 2); bowls.receiveShadow = true;
  {
    const m = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
    houses.forEach((h, n) => { bowls.setMatrixAt(n, m.compose(p.set(h.x, 0, h.z), q, s.set(1, 1, 1))); });
    SZ.forEach((z, n) => { bowls.setMatrixAt(houses.length + n, m.compose(p.set(0, 0, z), q, s.set((SR[0] - 0.07) / WALL, 1.08, (SR[1] - 0.07) / WALL))); });
  }
  // prow horns: the curling carved scroll the 2D board has at each end, standing up
  const horn = new THREE.Shape();
  { const S = 0.0145, P = (x, y) => [x * S, -y * S];
    horn.moveTo(...P(-26, 4)); horn.bezierCurveTo(...P(-30, -26), ...P(-6, -44), ...P(24, -38)); horn.bezierCurveTo(...P(46, -34), ...P(50, -14), ...P(34, -12));
    horn.bezierCurveTo(...P(22, -10), ...P(16, -22), ...P(26, -26)); horn.bezierCurveTo(...P(4, -28), ...P(6, -8), ...P(26, 4)); horn.closePath(); }
  const hornGeo = new THREE.ExtrudeGeometry(horn, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 24 });
  hornGeo.translate(-0.25, 0, -0.15); hornGeo.computeVertexNormals();
  const horns = [];
  for (const d of [-1, 1]) { const m = new THREE.Mesh(hornGeo); m.position.set(0, -0.2, d * (HL + 0.3)); m.rotation.y = d < 0 ? Math.PI / 2 : -Math.PI / 2; m.castShadow = m.receiveShadow = true; horns.push(m); }
  // inlays: a brass band inside the rim, a carved dark groove, mother-of-pearl diamonds down the centre and pearl studs at the prows
  const band = (a, b) => { const s = new THREE.Shape(hullShape(a)); s.holes.push(new THREE.Path(hullShape(b).reverse())); return s; };
  const brassGeo = new THREE.ShapeGeometry(band(0.13, 0.165), 2); brassGeo.rotateX(-Math.PI / 2);
  const grooveGeo = new THREE.ShapeGeometry(band(0.27, 0.29), 2); grooveGeo.rotateX(-Math.PI / 2);
  const brass = new THREE.Mesh(brassGeo, new THREE.MeshStandardMaterial({ color: 0xd9a845, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.6 })); brass.position.y = 0.003; brass.receiveShadow = true;
  const groove = new THREE.Mesh(grooveGeo, new THREE.MeshStandardMaterial({ color: 0x1a0904, roughness: 0.9 })); groove.position.y = 0.002;
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xf4ead6, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0.6, iridescenceIOR: 1.6, envMapIntensity: 1.3 });
  const diamond = B.inlay([[0.055, 0], [0, 0.1], [-0.055, 0], [0, -0.1]], 0.01);
  const inlays = new THREE.Group();
  for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(diamond, pearl); m.position.set(0, 0, wz(posXY(i).y - 43)); m.receiveShadow = true; inlays.add(m); }
  const stud = new THREE.SphereGeometry(0.09, 20, 10, 0, TAU, 0, Math.PI / 2); stud.scale(1, 0.45, 1);
  for (const d of [-1, 1]) { const m = new THREE.Mesh(stud, pearl); m.position.set(0, 0, d * (HL - 0.75)); inlays.add(m); }
  const lineLen = wz(posXY(0).y + 28) - wz(posXY(6).y - 28);
  const centreLine = new THREE.Mesh(new THREE.PlaneGeometry(0.018, lineLen), new THREE.MeshStandardMaterial({ color: 0x1e0c04, roughness: 0.9 }));
  centreLine.rotation.x = -Math.PI / 2; centreLine.position.set(0, 0.002, (wz(posXY(0).y + 28) + wz(posXY(6).y - 28)) / 2);
  boardRoot.add(slabMesh, plinthMesh, bowls, ...horns, brass, groove, inlays, centreLine);
  let woodNow = null;
  const setWood = (name) => {
    if (woodNow === name) return; woodNow = name; const m = woodMat(name);
    slabMesh.material = m.top; plinthMesh.material = m.plinth; bowls.material = m.pit; horns.forEach((h) => { h.material = m.top; });
  };
  setWood('teak');
  await yieldNow();

  // ---------------------------------------------------------------- shells / seeds / pebbles (instanced, one draw call per set)
  const MAXS = 160;
  const cowGeo = new THREE.SphereGeometry(1, 24, 16);
  { const a = cowGeo.attributes.position; for (let i = 0; i < a.count; i++) { const x = a.getX(i), y = a.getY(i), k = 1 - 0.28 * x * x; a.setXYZ(i, x, (y < 0 ? y * 0.38 : y * 0.92) * k, a.getZ(i) * (1 - 0.18 * x * x)); } cowGeo.scale(0.15, 0.085, 0.1); cowGeo.translate(0, 0.036, 0); cowGeo.computeVertexNormals(); }
  const sagaGeo = new THREE.SphereGeometry(1, 18, 12); sagaGeo.scale(0.085, 0.066, 0.075); sagaGeo.translate(0, 0.05, 0);
  const pebGeo = new THREE.SphereGeometry(1, 16, 10);
  { const a = pebGeo.attributes.position; for (let i = 0; i < a.count; i++) { const x = a.getX(i), y = a.getY(i), z = a.getZ(i), n = 1 + 0.09 * Math.sin(x * 5.1 + z * 3.3) + 0.06 * Math.sin(y * 7 + x * 2); a.setXYZ(i, x * n, (y < 0 ? y * 0.6 : y) * n, z * n); } pebGeo.scale(0.12, 0.07, 0.1); pebGeo.translate(0, 0.04, 0); pebGeo.computeVertexNormals(); }
  const sets = {
    cowries: new THREE.InstancedMesh(cowGeo, new THREE.MeshPhysicalMaterial({ map: cowrieTex(), roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1 }), MAXS),
    saga: new THREE.InstancedMesh(sagaGeo, new THREE.MeshPhysicalMaterial({ color: 0xc8261a, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 }), MAXS),
    pebbles: new THREE.InstancedMesh(pebGeo, B.material('stone', { roughness: 0.5 }), MAXS),
  };
  const tints = {
    cowries: ['#f4e9d6', '#eadbbd', '#e2cfa8', '#f0e2c8', '#dccab0'],
    saga: ['#ffffff', '#f0dcdc', '#ffe8e0', '#e8d0d0'],
    pebbles: ['#e4ded4', '#b9c2c4', '#d9c9b6', '#aeb6c8', '#c8c0b8'],
  };
  for (const [name, m] of Object.entries(sets)) {
    m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; boardRoot.add(m);
    const c = new THREE.Color(); for (let i = 0; i < MAXS; i++) m.setColorAt(i, c.set(tints[name][(i * 7) % tints[name].length]));
  }
  await yieldNow();

  // ---------------------------------------------------------------- glows, ripples, burnt plugs, sparks, dust
  const quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
  const rTex = ringTex(), bTex = blobTex();
  const ringPool = [], ripplePool = [];
  const ringAt = (pool, i, tex) => {
    let m = pool[i];
    if (!m) { m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; boardRoot.add(m); pool.push(m); }
    m.material.map = tex; m.visible = true; return m;
  };
  const plugMat = new THREE.MeshStandardMaterial({ map: charTex(false), roughness: 0.95, emissive: 0xff5a1e, emissiveIntensity: 0.5, emissiveMap: charTex(true) });
  const plugGeo = new THREE.CylinderGeometry(WALL + 0.02, WALL - 0.04, 0.14, 32); plugGeo.translate(0, -0.08, 0);
  const plugs = new THREE.InstancedMesh(plugGeo, plugMat, 14); plugs.count = 0; plugs.receiveShadow = true; plugs.castShadow = true; boardRoot.add(plugs);
  const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 60);
  sparks.count = 0; sparks.frustumCulled = false; boardRoot.add(sparks);
  const handShadow = [0, 1].map(() => { const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: bTex, color: 0x000000, transparent: true, depthWrite: false, opacity: 0.4 })); m.renderOrder = 2; m.visible = false; boardRoot.add(m); return m; });
  // dust motes drifting in the warm light (menu only)
  const moteN = 70, motePos = new Float32Array(moteN * 3), moteSeed = [];
  for (let i = 0; i < moteN; i++) { const r = Math.sin(i * 12.9898 + 1) * 43758.5453, f = r - Math.floor(r); moteSeed.push([f, (f * 7.3) % 1, (f * 13.7) % 1]); }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ size: 0.06, map: bTex, color: 0xffe0a8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  motes.frustumCulled = false; scene.add(motes);
  await yieldNow();

  // ---------------------------------------------------------------- shell placement (all derived from counts: stable per house + index)
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), TQ = new THREE.Quaternion(), E = new THREE.Euler(), Vp = new THREE.Vector3(), Vs = new THREE.Vector3(1, 1, 1), AX = new THREE.Vector3();
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  function houseSlot(pit, k, out) {
    const layer = Math.floor(k / 8), i = k % 8, r = 0.25 * Math.sqrt((i + 0.5) / 8) + (layer % 2) * 0.03, a = i * 2.39996 + pit * 1.1 + layer * 0.9;
    out.x = Math.cos(a) * r; out.z = Math.sin(a) * r; out.y = bowlY(r) + layer * 0.075;
    out.yaw = hash(pit, k) * TAU; out.tilt = layer ? (hash(k, pit) - 0.5) * 0.5 : Math.atan(((-LIP - BOT) * 2.2 * Math.pow(r / WALL, 1.2)) / WALL) * 0.8; out.ax = a; out.flip = hash(pit + 3, k) < 0.34;
    return out;
  }
  function storeSlot(pl, k, out) {
    const per = 26, layer = Math.floor(k / per), i = k % per, f = Math.sqrt((i + 0.5) / per), a = i * 2.39996 + layer * 1.3 + pl;
    const x = Math.cos(a) * f * (SR[0] - 0.2), z = Math.sin(a) * f * (SR[1] - 0.13), rn = Math.min(1, Math.hypot(x / (SR[0] - 0.07), z / (SR[1] - 0.07)));
    out.x = x; out.z = SZ[pl] + z; out.y = BOT * 1.08 + (-LIP - BOT * 1.08) * Math.pow(rn, 2.2) + layer * 0.07; out.yaw = hash(pl + 9, k) * TAU; out.tilt = (hash(k, pl + 5) - 0.5) * 0.4; out.ax = a; out.flip = hash(pl, k + 1) < 0.2;
    return out;
  }
  const S0 = {}, S1 = {};
  let mesh = sets.cowries, nInst = 0;
  function put(x, y, z, yaw, tilt, ax, flip, scale = 1, spin = 0) {
    if (nInst >= MAXS) return;
    E.set(flip ? Math.PI : 0, yaw + spin, 0, 'YXZ'); Q.setFromEuler(E);
    if (tilt) { TQ.setFromAxisAngle(AX.set(-Math.sin(ax), 0, Math.cos(ax)), tilt); Q.premultiply(TQ); }
    M4.compose(Vp.set(x, y + (flip ? 0.075 : 0), z), Q, Vs.set(scale, scale, scale)); mesh.setMatrixAt(nInst++, M4);
  }
  const housePos = (pos) => { if (pos === 7 || pos === 15) return { x: 0, z: SZ[pos === 15 ? 0 : 1] }; const p = posXY(pos); return { x: wx(p.x), z: wz(p.y) }; };

  // ---------------------------------------------------------------- camera framing (fitted to a screen rectangle; smoothed between scenes)
  const corners = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-0.4, 0.62]) corners.push(new THREE.Vector3(sx * (HW + 0.05), y, sz * (HL + 0.7)));
  const tv = new THREE.Vector3(), dir = new THREE.Vector3(), pts = corners.map((c) => c.clone()), cam = { rect: null, pitch: 60, yaw: 0, by: 0, init: false };
  let Lw = 720, Lh = 1560;
  function fit(rect, pitch, yaw, by) {
    const p = (pitch * Math.PI) / 180, y = (yaw * Math.PI) / 180;
    camera.aspect = Lw / Lh; camera.clearViewOffset(); camera.updateProjectionMatrix();
    boardRoot.rotation.y = by; clothRoot.rotation.y = by; boardRoot.updateMatrixWorld(true);
    dir.set(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p));
    corners.forEach((c, i) => pts[i].copy(c).applyMatrix4(boardRoot.matrixWorld));
    let box = null;
    const at = (d) => {
      camera.position.copy(dir).multiplyScalar(d); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of pts) { tv.copy(c).project(camera); const sx = (tv.x + 1) / 2 * Lw, sy = (1 - tv.y) / 2 * Lh; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
      box = { x0, x1, y0, y1 }; return x1 - x0 <= rect.w && y1 - y0 <= rect.h;
    };
    let lo = 2, hi = 200; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (at(m)) hi = m; else lo = m; }
    at(hi);
    scene.fog.near = hi * 0.85; scene.fog.far = hi * 2.4;
    camera.setViewOffset(Lw, Lh, (box.x0 + box.x1) / 2 - (rect.x + rect.w / 2), (box.y0 + box.y1) / 2 - (rect.y + rect.h / 2), Lw, Lh);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.12), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.toBoard = (sx, sy) => {
    ndc.set((sx / Lw) * 2 - 1, 1 - (sy / Lh) * 2); ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return { x: -9999, y: -9999 };
    boardRoot.worldToLocal(hit); return { x: hit.x / K + CX, y: hit.z / K + CY };
  };
  v3.toScreen = (x, y, h = 0) => { tv.set(wx(x), h * K, wz(y)); boardRoot.localToWorld(tv); tv.project(camera); return { x: (tv.x + 1) / 2 * Lw, y: (1 - tv.y) / 2 * Lh }; };
  v3.houseScreen = (pos) => { const p = posXY(pos); return v3.toScreen(p.x, p.y, 0); };

  // ---------------------------------------------------------------- per-frame
  const handBorn = new WeakMap(), SPK = [], menuCounts = new Array(16).fill(7); menuCounts[7] = 0; menuCounts[15] = 0;
  let lost = false, shown = false, clock = performance.now(), t = 0, slowN = 0, frameN = 0, sparkKey = null;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; lastW = 0; if (shown) v3.on = true; });

  function frame(state, view, override = null) {
    if (lost || !state) return;
    const now = performance.now(), dt = Math.min(0.05, (now - clock) / 1000); clock = now; t += dt;
    // auto quality: after a warm-up, drop one tier when most frames run long (slow phones)
    if (t > 3 && !override) { frameN++; if (dt > 0.026) slowN++; if (frameN >= 120) { if (slowN > 70 && tier < 2) { tier++; applyTier(); } frameN = 0; slowN = 0; } }
    const W = Math.max(1, Math.floor(window.innerWidth)), H = Math.max(1, Math.floor(window.innerHeight));
    if (!override && (W !== lastW || H !== lastH)) { lastW = W; lastH = H; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr)); renderer.setSize(W, H, false); }
    Lw = view?.width ?? 720; Lh = view?.height ?? 1560;
    const L = layoutFor(Lw, Lh), sc = state.scene, calm = state.calm;
    const boardScene = sc === 'play' || sc === 'over' || sc === 'lesson' || sc === 'puzzle' || sc === 'round' || sc === 'auto';
    setWood(state.wood);
    const setName = state.seeds in sets ? state.seeds : 'cowries';
    for (const [name, m] of Object.entries(sets)) m.visible = name === setName;
    mesh = sets[setName];

    // framing: the board fills its layout rectangle on board screens; on the menu it lies across the hero area and drifts slowly
    let rect, pitch, yaw = 0, by = 0;
    if (override) ({ rect, pitch, yaw, by } = override);
    else if (boardScene) { rect = L.boardRect; pitch = L.wide ? 40 : 60; }
    else {
      const T = L.titleRows(!!state.saved), h = (sc === 'title' || sc === 'demo-limit') ? T.hero : { x: L.U.x0, y: L.U.y0, w: L.U.w, h: L.U.h };
      rect = L.wide ? { x: h.x + h.w * 0.02, y: h.y + h.h * 0.38, w: h.w * 0.96, h: h.h * 0.6 } : { x: h.x - h.w * 0.04, y: h.y + h.h * 0.4, w: h.w * 1.08, h: h.h * 0.6 };
      pitch = 30 + (calm ? 0 : Math.sin(t * 0.09) * 2.5); yaw = 8 + (calm ? 0 : Math.sin(t * 0.13) * 7); by = Math.PI / 2;
    }
    if (!cam.init || override) Object.assign(cam, { rect: { ...rect }, pitch, yaw, by, init: true });
    const kk = 1 - Math.exp(-dt * (boardScene ? 7 : 4));
    for (const f of ['x', 'y', 'w', 'h']) cam.rect[f] += (rect[f] - cam.rect[f]) * kk;
    cam.pitch += (pitch - cam.pitch) * kk; cam.yaw += (yaw - cam.yaw) * kk; cam.by += (by - cam.by) * kk;
    if (Math.abs(cam.by - by) < 0.0005) cam.by = by;
    fit(cam.rect, cam.pitch, cam.yaw, cam.by);
    { const a = v3.toScreen(310, 798), b = v3.toScreen(410, 798); v3.unit = Math.hypot(b.x - a.x, b.y - a.y) / 100; }

    // shells
    nInst = 0;
    const g = state.game, A = boardScene ? state.anim : null;
    const sb = override?.counts ?? (boardScene ? state.shown : menuCounts);
    const burnt = boardScene ? g.burnt : null;
    const cap = A && A.cap, flyFrom = cap ? [cap.e.pos, cap.e.from] : [];
    const fall = A ? Math.max(0.07, Math.min(0.16, A.sd * 0.9)) : 0.1;
    for (const h of houses) {
      const n = sb[h.i]; if (!n || (burnt && burnt[h.i]) || flyFrom.includes(h.i)) continue;
      const ld = A ? A.lastDrop[h.i] : undefined;
      for (let k = 0; k < n; k++) {
        houseSlot(h.i, k, S0);
        let y = S0.y, x = h.x + S0.x, z = h.z + S0.z;
        if (ld !== undefined && k === n - 1 && !calm) {                          // the shell just dropped: falls from the hand, bounces, settles
          const u = (A.tt - ld) / fall;
          if (u < 1) { const e = u * u; y = 0.5 + (S0.y - 0.5) * e; x = h.x + S0.x * e; z = h.z + S0.z * e; }
          else if (A.tt - ld - fall < 0.2) { const s = (A.tt - ld - fall) / 0.2; y += Math.abs(Math.sin(s * Math.PI * 1.5)) * 0.035 * (1 - s); }
        }
        put(x, y, z, S0.yaw, S0.tilt, S0.ax, S0.flip);
      }
    }
    for (const pl of [0, 1]) {
      const n = sb[STORE[pl]], ld = A ? A.lastDrop[STORE[pl]] : undefined;
      for (let k = 0; k < n; k++) {
        storeSlot(pl, k, S0); let y = S0.y;
        if (ld !== undefined && k === n - 1 && !calm) { const u = (A.tt - ld) / fall; if (u < 1) y = 0.5 + (S0.y - 0.5) * u * u; }
        put(S0.x, y, S0.z, S0.yaw, S0.tilt, S0.ax, S0.flip);
      }
    }
    // the sowing hands: a small heap of shells hovering over the house being sown, hopping house to house
    for (const pl of [0, 1]) {
      const hd = A && A.hands[pl], sh = handShadow[pl];
      if (!hd || hd.n <= 0) { sh.visible = false; continue; }
      if (!handBorn.has(hd)) handBorn.set(hd, t);
      const born = clamp((t - handBorn.get(hd)) / 0.18, 0, 1), hop = calm ? 0 : Math.sin(Math.PI * Math.min(1, A.timer / A.sd)) * 0.16;
      const cx = wx(hd.x), cz = wz(hd.y), cy = -0.1 + 0.85 * ease(born) + hop, m = Math.min(hd.n, 9);
      for (let k = 0; k < m; k++) { const a = k * 2.39996 + pl, r = 0.065 * Math.sqrt(k); put(cx + Math.cos(a) * r, cy + (k > 4 ? 0.05 : 0) - r * 0.4, cz + Math.sin(a) * r, k * 1.7 + t * 0.6, 0.35, a, k % 4 === 3); }
      sh.visible = true; sh.position.set(cx + 0.05, 0.012, cz + 0.04); sh.scale.set(0.55 + cy * 0.3, 1, 0.45 + cy * 0.25); sh.material.opacity = Math.max(0.1, 0.42 - cy * 0.25);
    }
    // a capture: both houses' shells arc over into the storehouse, with a burst of sparks from the captured house
    if (cap) {
      const f = Math.min(1, cap.t / Math.max(0.01, cap.dur)), pl = cap.e.p; let j = 0;
      for (const pos of flyFrom) {
        const hp = housePos(pos), cnt = sb[pos];
        for (let k = 0; k < cnt; k++, j++) {
          houseSlot(pos, k, S0); storeSlot(pl, sb[STORE[pl]] + j, S1);
          const lag = Math.min(0.35, j * 0.02), u = ease(clamp((f - lag) / (1 - lag), 0, 1));
          put(hp.x + S0.x + (S1.x - hp.x - S0.x) * u, S0.y + (S1.y - S0.y) * u + Math.sin(Math.PI * u) * 0.9, hp.z + S0.z + (S1.z - hp.z - S0.z) * u, S0.yaw, S0.tilt * (1 - u), S0.ax, S0.flip, 1, u * 5);
        }
      }
      if (sparkKey !== cap && !calm) { sparkKey = cap; const p = housePos(cap.e.from); for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU, sp = 0.8 + (i % 5) * 0.15; SPK.push({ x: p.x, y: 0.05, z: p.z, vx: Math.cos(a) * sp, vy: 1.4 + (i % 7) * 0.2, vz: Math.sin(a) * sp, life: 0, max: 0.6 + (i % 4) * 0.1 }); } }
    }
    mesh.count = nInst; mesh.instanceMatrix.needsUpdate = true;
    let ns = 0;
    for (let i = SPK.length - 1; i >= 0; i--) { const p = SPK[i]; p.life += dt; p.vy -= 4.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.life >= p.max || p.y < -0.2) SPK.splice(i, 1); }
    for (const p of SPK) { if (ns >= 60) break; M4.compose(Vp.set(p.x, p.y, p.z), Q.identity(), Vs.setScalar(0.4 + (1 - p.life / p.max))); sparks.setMatrixAt(ns++, M4); }
    sparks.count = ns; sparks.instanceMatrix.needsUpdate = true;

    // burnt houses: charred plugs with a faint ember glow
    let np = 0;
    if (burnt) for (const h of houses) if (burnt[h.i]) { M4.compose(Vp.set(h.x, 0, h.z), Q.identity(), Vs.set(1, 1, 1)); plugs.setMatrixAt(np++, M4); }
    plugs.count = np; plugs.instanceMatrix.needsUpdate = true; plugMat.emissiveIntensity = 0.45 + (calm ? 0 : 0.2 * Math.sin(t * 2.2));

    // glows (marks published by view.js), the keyboard cursor, landing ripples
    let nr = 0;
    for (const r of ringPool) r.visible = false;
    if (boardScene) {
      for (const mk of v3.marks || []) {
        const hp = housePos(mk.pos), [r, gg, bb] = mk.rgb.split(',').map(Number), a = clamp(mk.a, 0, 1);
        const m = ringAt(ringPool, nr++, rTex); m.material.color.setRGB(r / 255, gg / 255, bb / 255); m.material.opacity = a;
        const s = PR * 2.7 * (1 + (calm ? 0 : 0.04 * Math.sin(t * 5))); m.position.set(hp.x, 0.012, hp.z); m.scale.set(s, 1, s);
        const m2 = ringAt(ringPool, nr++, bTex); m2.material.color.setRGB(r / 255, gg / 255, bb / 255); m2.material.opacity = a * 0.4; m2.position.set(hp.x, BOT + 0.04, hp.z); m2.scale.set(PR * 1.7, 1, PR * 1.7);
      }
      if (v3.kb >= 0) { const hp = housePos(v3.kb), m = ringAt(ringPool, nr++, rTex); m.material.color.setRGB(0.5, 1, 0.6); m.material.opacity = 1; m.position.set(hp.x, 0.014, hp.z); m.scale.set(PR * 3, 1, PR * 3); }
    }
    let nrip = 0;
    for (const r of ripplePool) r.visible = false;
    if (A && !calm) for (const pos in A.lastDrop) {
      const age = A.tt - A.lastDrop[pos] - fall;
      if (age < 0 || age > 0.42) continue;
      const hp = housePos(Number(pos)), f = age / 0.42, m = ringAt(ripplePool, nrip++, rTex);
      m.material.color.setRGB(1, 0.9, 0.72); m.material.opacity = 0.5 * (1 - f); m.position.set(hp.x, BOT + 0.07 + f * 0.1, hp.z); const s = PR * (0.6 + 1.3 * f); m.scale.set(s, 1, s);
    }
    // dust motes in the warm light, menu only
    motes.visible = !boardScene && !calm && !override;
    if (motes.visible) {
      for (let i = 0; i < moteN; i++) { const [a, b, c] = moteSeed[i], ph = (t * (0.02 + a * 0.03) + c) % 1; motePos[i * 3] = (a - 0.5) * 9 + Math.sin(t * 0.3 + i) * 0.2; motePos[i * 3 + 1] = -0.4 + ph * 3.2; motePos[i * 3 + 2] = (b - 0.5) * 5 + Math.cos(t * 0.25 + i) * 0.2; }
      moteGeo.attributes.position.needsUpdate = true;
    }
    renderer.render(scene, camera);
    if (!shown && !override) { shown = true; v3.on = true; canvas.style.transition = 'opacity .38s ease-out'; vig.style.opacity = '1'; requestAnimationFrame(() => { canvas.style.opacity = '1'; }); window.__v3At = performance.now(); }
  }

  // Store icon (developer tool: index.html?icon=1): one heaped house of glossy cowries in the carved teak boat, a shell falling in,
  // low warm light; rendered from this same scene at 2048 and downsampled (board3d.renderIcon sets window.__icon).
  function renderStoreIcon() {
    const counts = menuCounts.slice(); counts[2] = 13; counts[1] = 9; counts[3] = 8; counts[15] = 22;
    const st = { scene: 'title', calm: true, wood: 'dark', seeds: 'cowries', game: { burnt: [] }, saved: null };
    frame(st, { width: 1024, height: 1024 }, { rect: { x: 0, y: 0, w: 1024, h: 1024 }, pitch: 40, yaw: 0, by: 0, counts });
    motes.visible = false; scene.fog.near = 6; scene.fog.far = 16;
    const v = Number(new URLSearchParams(location.search).get('iconv') || 2), hp = housePos(2);
    put(hp.x + 0.1, 0.42, hp.z + 0.05, 0.7, 0.45, 1.2, false, 1.05);
    mesh.count = nInst; mesh.instanceMatrix.needsUpdate = true;
    let tgt = new THREE.Vector3(hp.x, -0.12, hp.z + 0.02), p = (52 * Math.PI) / 180, y = (-24 * Math.PI) / 180, dd = 2.7;
    if (v === 2) { boardRoot.rotation.y = clothRoot.rotation.y = 0.78; boardRoot.updateMatrixWorld(true); tgt = new THREE.Vector3(0.15, -0.25, 0.2); p = (44 * Math.PI) / 180; y = 0; dd = 9.4; key.intensity = 3.6; hemi.intensity = 1.0; }
    camera.clearViewOffset(); camera.fov = 36; camera.aspect = 1; camera.updateProjectionMatrix(); camera.position.set(tgt.x + Math.sin(y) * Math.cos(p) * dd, tgt.y + Math.sin(p) * dd, tgt.z + Math.cos(y) * Math.cos(p) * dd); camera.lookAt(tgt);
    key.position.set(-3.5, 4.2, -1.5); rim.position.set(3, 2.2, -5); rim.intensity = 2.4; renderer.shadowMap.needsUpdate = true;
    return B.renderIcon({ scene, camera, size: 2048, renderer, background: '#160c12', bloom: 0.2, vignette: 0.5, exposure: 1.06 });
  }

  applyTier();
  return { frame, renderer, scene, camera, canvas, renderStoreIcon, get tier() { return tier; } };
}
