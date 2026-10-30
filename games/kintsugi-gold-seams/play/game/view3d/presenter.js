// Kintsugi 3D presenter. READS what view.js registered this frame in src/v3.js (the vessel, where every shard is, the gold laid so far,
// and the 2D camera), never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas. The 3D camera looks straight
// down the bench with the 2D camera's exact scale and centre, so the guides, hint rings and every finger hit-test stay on the shards.
// Real lit scene: dark walnut bench, charcoal hemp mending cloth, thick glazed shards with a chamfered clay edge that cast soft shadows,
// stack on each other and lift under the finger, and raised gold seams that catch a slow lamp. No WebGL, ?flat=1 or a lost context:
// v3.on = false and every screen draws the flat 2D art as before.
import * as THREE from '../vendor3d/three.js';
import { v3, shardKey } from '../src/v3.js';
import { meta } from '../src/game.js';
import { bakedPiece, drawCracks, drawGold } from '../src/art.js';
import { buildBench, shardGeometry, bakeTexture, makeGoldDecal, SHARD_T } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ dpr: 2, shadow: 2048, phys: true }, { dpr: 1.5, shadow: 1024, phys: true }, { dpr: 1, shadow: 0, phys: false }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const D = 1100;           // camera height above the bench (world units); far enough that a lifted shard shifts only a few units sideways

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x120c08, 1);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 100, 4000);
  camera.matrixAutoUpdate = false; camera.matrixWorldAutoUpdate = false;
  const hemi = new THREE.HemisphereLight(0xffe9cf, 0x2a1a10, 0.38); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2bd, 1.7); sun.castShadow = true; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.2; sun.shadow.radius = 5; scene.add(sun, sun.target);
  const lamp = new THREE.PointLight(0xffc98a, 0.9, 0, 0); scene.add(lamp);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();
  const bench = buildBench(); scene.add(bench);
  await tick();

  // ---- shards: one mesh per (vessel, piece), built when the 2D layer has baked the piece art -------------------------------------
  const meshes = new Map();          // key -> { mesh, tex, y }
  let curId = null;
  const capMat = (tex) => (TIERS[tier].phys
    ? new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.46, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.25, envMapIntensity: 0.6 })
    : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0 }));
  const sideMat = () => new THREE.MeshStandardMaterial({ color: 0xd8c29c, roughness: 0.86, metalness: 0 });
  function dropMeshes(keepId) {
    for (const [k, o] of meshes) if (!keepId || !k.startsWith(keepId + '#')) { scene.remove(o.mesh); o.mesh.geometry.dispose(); o.tex.dispose(); o.mesh.material.forEach((m) => m.dispose()); meshes.delete(k); v3.ready.delete(k); }
  }
  function ensureMeshes(V) {
    if (curId !== V.def.id) { dropMeshes(V.def.id); curId = V.def.id; if (gold) { gold.tex.dispose(); gold = null; goldMesh.visible = false; } }
    let built = 0;
    for (let i = 0; i < V.pieces.length && built < 3; i++) {
      const key = shardKey(V, i); if (meshes.has(key)) continue;
      const b = bakedPiece(V, i, true); if (!b) continue;
      const tex = bakeTexture(b.c), mesh = new THREE.Mesh(shardGeometry(V.pieces[i], b), [capMat(tex), sideMat()]);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
      meshes.set(key, { mesh, tex, y: 0, hasPos: false }); v3.ready.add(key); built++;
    }
  }

  // ---- gold seams: a decal over the assembled vessel (cracks under raised gold) --------------------------------------------------
  let gold = null;
  const goldMat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.3, color: 0xd9ac55, emissive: 0xffffff, emissiveIntensity: 0.12, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const goldMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), goldMat); goldMesh.rotation.x = -Math.PI / 2; goldMesh.renderOrder = 5; goldMesh.visible = false; scene.add(goldMesh);
  function updateGold(V, G) {
    if (!gold) { gold = makeGoldDecal(V); goldMat.map = gold.tex; goldMat.emissiveMap = gold.tex; goldMat.needsUpdate = true; goldMesh.scale.set(gold.w, gold.h, 1); goldMesh.position.set(gold.x0 + gold.w / 2, SHARD_T + 0.5, gold.y0 + gold.h / 2); }
    if (gold.sig !== G.sig) {
      gold.sig = G.sig; const g = gold.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, gold.cv.width, gold.cv.height);
      g.setTransform(gold.S, 0, 0, gold.S, -gold.x0 * gold.S, -gold.y0 * gold.S);
      drawCracks(g, V, G.crack ?? 0.6); drawGold(g, V, G.Q, 0, false); gold.tex.needsUpdate = true;
    }
    goldMesh.visible = true;
  }

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    for (const o of meshes.values()) { o.mesh.material[0].dispose(); o.mesh.material[0] = capMat(o.tex); }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  const cpu = () => meta.cssPerUnit || (Math.min(window.innerWidth, window.innerHeight) / 720);
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const M4 = new THREE.Matrix4(), M4i = new THREE.Matrix4();
  let lastNow = 0, frameAvg = 16, slow = 0, game = null, lost = false, clock = 0;

  // straight-down camera whose scale at the bench plane equals the 2D camera: world (x, z) -> screen (ax + (x - wx) k, ay + (z - wz) k)
  function setCamera(c3, W, H, c, offX, offY) {
    const f = c3.k * c * D, px = c3.ax * c + offX, py = c3.ay * c + offY;
    M4.set(1, 0, 0, -c3.wx, 0, 0, -1, c3.wy, 0, 1, 0, -D, 0, 0, 0, 1);
    camera.matrixWorldInverse.copy(M4); camera.matrixWorld.copy(M4i.copy(M4).invert());
    const n = 100, fa = 4000;
    camera.projectionMatrix.set(2 * f / W, 0, -(2 * px / W - 1), 0, 0, 2 * f / H, -(1 - 2 * py / H), 0, 0, 0, -(fa + n) / (fa - n), -2 * fa * n / (fa - n), 0, 0, -1, 0);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  function updateScene(sc, dt) {
    const V = sc.V; ensureMeshes(V);
    // stack heights: a shard that overlaps another one sits on top of it (placed shards lie flat at 0)
    const order = sc.pieces.slice().sort((p, q) => (p.z ?? 0) - (q.z ?? 0)), ys = new Map();
    for (const p of order) {
      let y = 0;
      for (const [j, yj] of ys) { const o = sc.pieces.find((e) => e.i === j); if (o && !o.placed && !p.placed && Math.hypot(o.x - p.x, o.y - p.y) < V.pieces[j].r + V.pieces[p.i].r - 10) y = Math.max(y, yj + SHARD_T + 1); }
      ys.set(p.i, y);
    }
    for (const p of sc.pieces) {
      const o = meshes.get(shardKey(V, p.i)); if (!o) continue;
      const ty = ys.get(p.i) + (p.lift || 0) * 22;
      o.y = o.hasPos ? o.y + (ty - o.y) * Math.min(1, dt * 14) : ty; o.hasPos = true;
      o.mesh.position.set(p.x, o.y, p.y); o.mesh.rotation.set(0, -p.a, 0); o.mesh.visible = true;
    }
    if (sc.gold) updateGold(V, sc.gold); else goldMesh.visible = false;
  }

  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    canvas.style.visibility = 'visible';
    const W = cssW(), H = cssH(), c = cpu(), offX = (W - meta.width * c) / 2, offY = (H - meta.height * c) / 2;
    const sc = v3.scene;
    for (const o of meshes.values()) o.mesh.visible = false;
    let c3;
    if (sc) { c3 = sc.cam; updateScene(sc, dt); } else { goldMesh.visible = false; c3 = { k: 1, ax: meta.width / 2, ay: meta.height / 2, wx: 500, wy: 500 }; }
    setCamera(c3, W, H, c, offX, offY);
    const cl = bench.userData.cloth, m = sc && sc.mat;
    cl.visible = !!m;
    let E = 700;
    if (m) { cl.scale.set(m.w / c3.k, m.h / c3.k, 1); cl.position.set(c3.wx + (m.x + m.w / 2 - c3.ax) / c3.k, -0.6, c3.wy + (m.y + m.h / 2 - c3.ay) / c3.k); E = clamp(Math.max(m.w, m.h) / c3.k * 0.62, 420, 1500); }
    const tx = c3.wx, tz = c3.wy;
    sun.position.set(tx - 520, 900, tz - 360); sun.target.position.set(tx, 0, tz); sun.target.updateMatrixWorld();
    const scm = sun.shadow.camera; if (scm.right !== E) { scm.left = -E; scm.right = E; scm.top = E; scm.bottom = -E; scm.near = 100; scm.far = 2600; scm.updateProjectionMatrix(); }
    lamp.position.set(tx + Math.cos(clock * 0.35) * 300, 260, tz + Math.sin(clock * 0.35) * 220 - 80);
    renderer.setSize(W, H, false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slow > 90) { tier++; slow = 0; frameAvg = 16; applyTier(); } } else slow = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.ready.clear(); canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; dropMeshes(); curId = null; if (gold) { gold.tex.dispose(); gold = null; } goldMesh.visible = false; buildEnv(); applyTier(); v3.on = true;
  });
  return { ok: true, attach(g) { game = g; v3.on = true; }, post, get tier() { return tier; } };
}
