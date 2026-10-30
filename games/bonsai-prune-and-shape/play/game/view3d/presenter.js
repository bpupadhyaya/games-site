// Bonsai 3D presenter. READS the game (game.getState() and what view.js registered this frame in src/v3.js), never writes game state.
// One WebGL canvas sits behind the kit's transparent 2D canvas; view.js cuts a window in its paper where the tree stage is, and this file
// renders the stage into exactly that rectangle. The camera looks straight at the tree plane (z = 0) with a very small field of view and
// the 2D camera's own centre and zoom, so the 2D tools (snip, pinch, wire), rings and hints stay aligned with what is on screen. Lit
// tapered bark, wire coils, buds, foliage clouds, a glazed pot and a shoji wall that catches the tree's shadow make the depth real.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { geo } from '../src/tree.js';
import { SPECIES } from '../src/species.js';
import { leafState, room } from '../src/art.js';
import { rgbLin, hash, leafTex, buildWall, buildShelf, buildPot, buildBark, buildWires, limbDepth, barkTex } from './world.js';

const D2R = Math.PI / 180, FOV = 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, det: 2, seg: 72 }, { name: 'medium', dpr: 1.5, shadow: 1024, det: 1, seg: 56 }, { name: 'low', dpr: 1, shadow: 0, det: 1, seg: 40 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const CAPF = 1700;

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xefe6d4, 1);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 200, 30000);
  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x6a4a30, 0.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.3); sun.castShadow = true; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6; scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5); fill.position.set(400, 150, 900); scene.add(fill);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.35; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const wall = buildWall(); scene.add(wall);
  const shelf = buildShelf(); scene.add(shelf);
  await tick();

  // pots are built on demand and cached per kind and tier
  const pots = new Map(); let potNow = null;
  function showPot(pot) {
    const key = `${pot.id}|${tier}`; let g = pots.get(key);
    if (!g) { g = buildPot(pot, tier); pots.set(key, g); scene.add(g); }
    if (potNow && potNow !== g) potNow.visible = false;
    g.visible = true; potNow = g;
    const feet = pot.kind !== 'slab' && pot.kind !== 'tall' ? 6 : 0;
    g.position.y = 0; shelf.position.y = -pot.d - feet;
  }

  // the tree: bark + wires (rebuilt when the tree changes), foliage and buds (instanced, refreshed every frame)
  const barkMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: barkTex(), bumpMap: barkTex(), bumpScale: 1.4, roughness: 0.88, side: THREE.DoubleSide });
  const barkMesh = new THREE.Mesh(new THREE.BufferGeometry(), barkMat); barkMesh.castShadow = true; barkMesh.receiveShadow = true; barkMesh.frustumCulled = false; scene.add(barkMesh);
  const wireMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.32, side: THREE.DoubleSide });
  const wireMesh = new THREE.Mesh(new THREE.BufferGeometry(), wireMat); wireMesh.castShadow = true; wireMesh.frustumCulled = false; wireMesh.visible = false; scene.add(wireMesh);
  const budGeo = new THREE.SphereGeometry(1, 8, 6);
  const buds = new THREE.InstancedMesh(budGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), 260); buds.castShadow = true; buds.frustumCulled = false; buds.count = 0; scene.add(buds);
  const lumpy = (det) => { const g = new THREE.SphereGeometry(1, det === 2 ? 18 : 11, det === 2 ? 13 : 8), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.2 * (hash(Math.round(x * 50), Math.round(y * 50) + Math.round(z * 90)) - 0.5); p.setXYZ(i, x * k, y * k, z * k); } g.computeVertexNormals(); return g; };
  let foliage = null, foliageSp = '', foliageTier = -1;
  const cores = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 9), new THREE.MeshStandardMaterial({ roughness: 0.9 }), 300); cores.castShadow = true; cores.receiveShadow = true; cores.frustumCulled = false; cores.count = 0; scene.add(cores);
  function foliageFor(spId) {
    if (foliage && foliageSp === spId && foliageTier === tier) return foliage;
    if (foliage) { scene.remove(foliage); foliage.geometry.dispose(); foliage.material.map?.dispose(); foliage.material.dispose(); }
    const sp = SPECIES[spId], t = leafTex(sp.leaf);
    const mat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 });
    foliage = new THREE.InstancedMesh(lumpy(TIERS[tier].det), mat, CAPF); foliage.castShadow = true; foliage.receiveShadow = true; foliage.frustumCulled = false; foliage.count = 0;
    scene.add(foliage); foliageSp = spId; foliageTier = tier; return foliage;
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
  let builtFor = null, builtV = -1, zs = null, wireSig = '';

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    for (const g of pots.values()) g.visible = false; potNow = null; foliageTier = -1;
  }
  applyTier();

  const cpu = () => meta.cssPerUnit || (Math.min(window.innerWidth, window.innerHeight) / 720);
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  let clock = 0, lastNow = 0, frameAvg = 16, slow = 0, game = null, lost = false;

  function updateTree(st) {
    const { T, pot } = st, G = geo(T), sp = SPECIES[T.species];
    if (builtFor !== T || builtV !== T.v) {
      zs = limbDepth(T, pot.d);
      barkMesh.geometry = buildBark(T, sp, zs, barkMesh.geometry);
      builtFor = T; builtV = T.v; wireSig = '';
    }
    const sig = T.limbs.map((L) => (L.wire ? `${L.id}:${L.wire.s}:${L.wire.bite ? 1 : 0}` : '')).join('|') + T.v;
    if (sig !== wireSig) {
      wireSig = sig;
      const g = buildWires(T, zs, wireMesh.geometry);
      if (g) { wireMesh.geometry = g; wireMesh.visible = true; } else wireMesh.visible = false;
    }
    // foliage clouds
    const ls = st.leaf ?? leafState(sp, st.yt), fm = foliageFor(T.species);
    let n = 0, nc = 0;
    if (ls.full >= 0.04) {
      const fs = Math.pow(ls.full, 0.7), base = [ls.col[0], ls.col[1], ls.col[2]];
      for (const p of G.pads) {
        const L = G.by.get(p.limb), back = L.ord > 0 && L.id % 3 === 0, r = p.r * fs * (p.soft ? 0.78 : 1);
        const tint = p.soft && ls.new > 0.05 ? [base[0] + (190 - base[0]) * 0.45 * ls.new, base[1] + (220 - base[1]) * 0.45 * ls.new, base[2] + (120 - base[2]) * 0.45 * ls.new] : base;
        const zl = zs.get(L.id), z0 = zl[Math.min(p.seg + 1, zl.length - 1)];
        if (nc < 300) { _p.set(p.x, -p.y - r * 0.05, z0); _q.identity(); _s.set(r * 0.62, r * 0.42, r * 0.62); cores.setMatrixAt(nc, _m.compose(_p, _q, _s)); cores.setColorAt(nc, rgbLin(tint, 0.34 * (back ? 0.8 : 1))); nc++; }
        const k = r > 30 ? 6 : 5;
        for (let j = 0; j < k && n < CAPF; j++) {
          const h1 = hash(p.limb * 13 + p.seg, j), h2 = hash(p.limb * 7 + p.seg, j + 40), h3 = hash(j, p.limb + p.seg * 5);
          const ang = h1 * 6.283, rad = j === 0 ? 0 : r * (0.38 + 0.22 * h2), sz = r * (j === 0 ? 0.92 : 0.62 + 0.18 * h3);
          _p.set(p.x + Math.cos(ang) * rad, -p.y + Math.sin(ang) * rad * 0.5 + r * 0.04, z0 + Math.sin(ang * 1.7 + j) * rad * 0.6 + (back ? -4 : 3));
          _q.setFromEuler(_e.set(h1 * 6, h2 * 6, h3 * 6)); _s.set(sz * 1.12, sz * 0.74, sz * 1.0);
          fm.setMatrixAt(n, _m.compose(_p, _q, _s));
          const v = (back ? 0.74 : 1) * (0.88 + 0.24 * h3);
          fm.setColorAt(n, rgbLin(tint, v));
          n++;
        }
      }
    }
    cores.count = nc; cores.instanceMatrix.needsUpdate = true; if (cores.instanceColor) cores.instanceColor.needsUpdate = true;
    fm.count = n; fm.instanceMatrix.needsUpdate = true; if (fm.instanceColor) fm.instanceColor.needsUpdate = true;
    // buds
    let nb = 0; const s = Math.min(3, Math.floor(st.yt / 8)), bc = rgbLin(s === 0 ? [176, 210, 110] : [214, 190, 150]);
    for (const L of T.limbs) L.segs.forEach((sg, i) => {
      if (!sg.b || nb >= 260) return;
      const p = L.g.pts[i + 1], a = L.g.ang[i] + sg.bs * 1.15, zl = zs.get(L.id), r = 1.9 + (st.pulse || 0) * 1.4 + (s === 3 ? 0.6 : 0);
      _p.set(p.x + Math.cos(a) * (sg.th * 0.45 + 2), -(p.y + Math.sin(a) * (sg.th * 0.45 + 2)), zl[Math.min(i + 1, zl.length - 1)] + sg.th * 0.4);
      _q.identity(); _s.set(r, r * 1.25, r); buds.setMatrixAt(nb, _m.compose(_p, _q, _s)); buds.setColorAt(nb, bc); nb++;
    });
    buds.count = nb; buds.instanceMatrix.needsUpdate = true; if (buds.instanceColor) buds.instanceColor.needsUpdate = true;
  }

  function post() {
    if (!game || lost) return;
    const st = v3.stage;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    if (!st) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    const W = cssW(), H = cssH(), c = cpu(), offX = (W - meta.width * c) / 2, offY = (H - meta.height * c) / 2;
    const rc = { x: st.rect.x * c + offX, y: st.rect.y * c + offY, w: st.rect.w * c, h: st.rect.h * c };
    showPot(st.pot);
    updateTree(st);
    // season: wall tint and light colour follow the year
    const R = room(st.yt);
    wall.userData.wall.material.color.copy(rgbLin(R.wall));
    sun.color.copy(rgbLin(R.light));
    // camera: looks at the tree plane through the 2D camera's centre; the visible height is the rectangle's height in world units
    const k = st.cam.k, visH = st.rect.h / k, visW = visH * rc.w / rc.h;
    const dist = (visH / 2) / Math.tan(FOV * D2R / 2), yaw = (st.sway || 0) * Math.sin(clock * 0.35) * D2R, pitch = (st.sway ? 4 : 3) * D2R;
    const tx = st.cam.cx, ty = -st.cam.cy;
    camera.aspect = rc.w / rc.h; camera.fov = FOV;
    camera.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * dist, ty + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.up.set(0, 1, 0); camera.lookAt(tx, ty, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    // the sun: up-left of the viewer; its shadow frustum follows the visible region
    const E = Math.max(visW, visH) * 0.62;
    sun.position.set(tx - 0.62 * 1400, ty + 0.9 * 1400, 1.25 * 1400); sun.target.position.set(tx, ty, 0); sun.target.updateMatrixWorld();
    const sc = sun.shadow.camera; if (sc.right !== E) { sc.left = -E; sc.right = E; sc.top = E; sc.bottom = -E; sc.near = 200; sc.far = 4000; sc.updateProjectionMatrix(); }
    renderer.setSize(W, H, false);
    renderer.setViewport(rc.x, H - rc.y - rc.h, rc.w, rc.h); renderer.setScissor(rc.x, H - rc.y - rc.h, rc.w, rc.h); renderer.setScissorTest(true);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slow > 90) { tier++; slow = 0; frameAvg = 16; applyTier(); } } else slow = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv();
    for (const g of pots.values()) { scene.remove(g); g.userData.dispose(); } pots.clear(); potNow = null; foliage = null; foliageSp = ''; builtFor = null;
    applyTier(); v3.on = true;
  });
  return {
    ok: true,
    attach(g) { game = g; v3.on = true; },
    post,
    get tier() { return tier; },
  };
}
