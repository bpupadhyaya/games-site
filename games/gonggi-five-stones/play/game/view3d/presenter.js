// Gonggi 3D presenter. READS what view.js asks for this frame (v3.want + the overlay canvas), never touches the game state.
// One WebGL canvas sits behind the kit's transparent 2D canvas: an ondol room floor of oiled paper in lattice-window light, a bojagi
// cloth, five glossy pebbles, a glass palm ring, a silk pouch, a brass bowl and a celadon cup. The routes, rings, trail and glows the
// flat art draws are painted (in world units) into an overlay texture that lies on the cloth, so they follow the tilted camera exactly;
// taps are projected onto the cloth (v3.pick), badges / floating labels are projected back to the screen (v3.proj).
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds and returns.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { U, CLOTH_W, CLOTH_D, CLOTH_Y, MARK_Y, STONE_R, STONE_H, w2x, w2z, floorMesh, clothMesh, stoneMesh, palmRing, brassBowl, celadonCup, pouch, latticeCookie, softDot, clearCaches } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, ov: 1.25, cloth: 2 }, { name: 'medium', dpr: 1.5, shadow: 1024, ov: 1, cloth: 1.6 }, { name: 'low', dpr: 1, shadow: 0, ov: 0.8, cloth: 1.2 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const PAD = 150;   // overlay margin around the cloth, world units (catch rings reach past the hem)

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search), noop = { ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return noop; }
  if (!renderer.getContext()) return noop;
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  // ---------------------------------------------------------------- scene, window light, room fill, environment
  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x160d09);
  scene.background = BG; scene.fog = new THREE.Fog(BG, 120, 300);
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
  // afternoon light through the hanji lattice door, upper left behind the cloth: warm, soft-edged, with the lattice's soft bars
  const sun = new THREE.SpotLight(0xffd2a0, 2.6, 0, 0.42, 0.8, 0);
  sun.position.set(-62, 96, -58); sun.target.position.set(4, 0, 4);
  sun.map = latticeCookie();
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
  Object.assign(sun.shadow.camera, { near: 60, far: 260 });
  const hemi = new THREE.HemisphereLight(0xcfd4ff, 0x4a2612, 0.22);
  const rim = new THREE.DirectionalLight(0xa9c0ff, 0.35); rim.position.set(70, 40, -90);
  const fill = new THREE.DirectionalLight(0xffe6c8, 0.18); fill.position.set(40, 70, 90);
  scene.add(sun, sun.target, hemi, rim, fill);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.35; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // ---------------------------------------------------------------- world
  const world = new THREE.Group(); scene.add(world);
  const floor = floorMesh(); world.add(floor); await tick();
  let cloth = clothMesh(TIERS[tier].cloth); world.add(cloth); await tick();
  const bowl = brassBowl(), cup = celadonCup(), bag = pouch(); world.add(bowl, cup, bag);
  bowl.position.set(CLOTH_W / 2 + 13, 0, -CLOTH_D / 2 + 6); cup.position.set(-CLOTH_W / 2 - 9, 0, -CLOTH_D / 2 + 14); bag.position.set(CLOTH_W / 2 + 9, 0, CLOTH_D / 2 - 7); bag.rotation.y = -0.5;
  // overlay: the flat art's marks in world units, lying on the cloth
  const ov = { canvas: document.createElement('canvas'), ctx: null, pad: PAD, k: 1 };
  let ovTex = null;
  const ovMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const ovMesh = new THREE.Mesh(new THREE.PlaneGeometry((660 + 2 * PAD) * U, (800 + 2 * PAD) * U), ovMat);
  ovMesh.rotation.x = -Math.PI / 2; ovMesh.position.set(0, MARK_Y, 0); ovMesh.renderOrder = 3; world.add(ovMesh);
  function sizeOverlay() {
    const k = TIERS[tier].ov; ov.k = k;
    ov.canvas = document.createElement('canvas'); ov.canvas.width = Math.round((660 + 2 * PAD) * k); ov.canvas.height = Math.round((800 + 2 * PAD) * k);
    ov.ctx = ov.canvas.getContext('2d');
    const old = ovTex; ovTex = new THREE.CanvasTexture(ov.canvas); ovTex.colorSpace = THREE.SRGBColorSpace; ovTex.anisotropy = 4; ovMat.map = ovTex; ovMat.needsUpdate = true; if (old) old.dispose();
    v3.ov = ov;
  }
  sizeOverlay();
  // pebbles and palms are pooled by colour
  const pools = new Map(), palms = [];
  const stoneFor = (id, n) => { let p = pools.get(id); if (!p) { p = []; pools.set(id, p); } while (p.length <= n) { const g = stoneMesh(id); world.add(g, g.userData.shadow); p.push(g); } return p[n]; };
  for (let i = 0; i < 5; i++) stoneFor(i, 0);
  const palmFor = (n) => { while (palms.length <= n) { const g = palmRing(); world.add(g, g.userData.shadow); palms.push(g); } return palms[n]; };
  palmFor(0);
  // dust motes drifting in the window light
  const DN = 90, dpos = new Float32Array(DN * 3), dseed = Array.from({ length: DN }, (_, i) => (i * 7.31) % 100);
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ map: softDot('255,232,196'), size: 0.42, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe2b8 }));
  dust.frustumCulled = false; scene.add(dust);
  function updateDust(t) {
    for (let i = 0; i < DN; i++) { const sd = dseed[i], u = ((t * 0.01 + sd * 0.137) % 1); dpos[i * 3] = -34 + ((sd * 37.1) % 60) + Math.sin(t * 0.3 + sd) * 2 - (1 - u) * 10; dpos[i * 3 + 1] = 2 + u * 34; dpos[i * 3 + 2] = -30 + ((sd * 53.7) % 54) + Math.cos(t * 0.23 + sd * 2) * 2; }
    dgeo.attributes.position.needsUpdate = true;
  }

  let vk = '';
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    vk = '';
  }
  applyTier();
  await tick();

  // ---------------------------------------------------------------- camera: yaw / elevation / fov per screen; distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 60, fov: 30, dist: 120, ox: 0, oy: 0, tx: 0, ty: CLOTH_Y, tz: 0 };
  let snapNext = true, lastKind = '';
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(-Math.sin(p.yaw * D2R), 0, -Math.cos(p.yaw * D2R)); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base, fillMode = 'min') {
    const p = { ...base, ox: 0, oy: 0, dist: 150 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 12; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const sx = rc.w / Math.max(1, bb.x1 - bb.x0), sy = rc.h / Math.max(1, bb.y1 - bb.y0), s = fillMode === 'max' ? Math.max(sx, sy) : Math.min(sx, sy);
      if (Math.abs(s - 1) < 0.0003) break;
      p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => meta.cssPerUnit || Math.min(cssW() / meta.width, cssH() / meta.height);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const hw = CLOTH_W / 2, hd = CLOTH_D / 2;
  const clothPts = (m = 0) => [[-hw - m, CLOTH_Y, -hd - m], [hw + m, CLOTH_Y, -hd - m], [-hw - m, CLOTH_Y, hd + m], [hw + m, CLOTH_Y, hd + m]];

  // screen (virtual units) -> world units on the cloth plane, and back
  let lost = false;
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -MARK_Y), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.pick = (x, y) => {
    if (!v3.on || lost) return null;
    const cx = x * cpu() + offX(), cy = y * cpu() + offY();
    ndc.set((cx / cssW()) * 2 - 1, -(cy / cssH()) * 2 + 1); ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x / U + 330, y: hit.z / U + 400 };
  };
  const pq = { x: 0, y: 0 };
  v3.proj = (x, y, z = 0) => { toCss(camera, w2x(x), MARK_Y + z * U, w2z(y), pq); return { x: (pq.x - offX()) / cpu(), y: (pq.y - offY()) / cpu() }; };

  // ---------------------------------------------------------------- per frame
  let lastNow = 0, clock = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, attached = false;
  const rest = CLOTH_Y + STONE_H * STONE_R * 0.8;
  function post() {
    if (!attached || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const want = v3.want || { kind: 'hero', rect: { x: 0, y: 0, w: meta.width, h: meta.height }, stones: [], hands: [] };
    const kind = want.kind;
    if (kind !== lastKind) { snapNext = true; lastKind = kind; }
    let goal;
    if (kind === 'play') {
      // a tilted camera (30 degrees off vertical) over the cloth, fitted to the free play area with the hem and a little floor showing
      const r = rectCss(want.rect), m = want.mode === 'wide' ? 0.03 : 0.02;
      const ri = { x: r.x + r.w * m, y: r.y + r.h * m, w: r.w * (1 - 2 * m), h: r.h * (1 - 2 * m) };
      goal = fit(ri, clothPts(0.6), { yaw: 0, tilt: 64, fov: 26, tx: 0, ty: CLOTH_Y, tz: 0 });
    } else {
      const r = rectCss(want.rect), t = clock;
      goal = fit(r, clothPts(want.tight ? 1 : 4), { yaw: -9 + 7 * Math.sin(t * TAU / 38), tilt: 44 + 4 * Math.sin(t * TAU / 23), fov: 30, tx: 0, ty: CLOTH_Y, tz: 1 });
    }
    const a = snapNext ? 1 : 1 - Math.exp(-dt * 5);
    for (const k of Object.keys(goal)) cur[k] += (goal[k] - cur[k]) * a;
    snapNext = false;
    place(camera, cur);
    scene.fog.near = cur.dist * 1.15; scene.fog.far = cur.dist * 3.2;

    // pebbles
    const used = new Map();
    for (const p of pools.values()) for (const g of p) { g.visible = false; g.userData.shadow.visible = false; }
    for (const s of want.stones || []) {
      if ((s.alpha ?? 1) < 0.3) continue;
      const n = used.get(s.id) || 0; used.set(s.id, n + 1);
      const g = stoneFor(s.id, n), z = Math.max(0, s.z) * U, sc = s.scale || 1;
      g.visible = true; g.position.set(w2x(s.x), rest + z + (sc - 1) * STONE_H * STONE_R, w2z(s.y));
      g.scale.setScalar(sc * (0.65 + 0.35 * Math.min(1, s.alpha ?? 1)));
      // lying pebbles keep their turn; a pebble in the air tumbles with its spin
      const air = clamp(z / 3, 0, 1);
      g.rotation.set(Math.sin(s.rot * 1.7) * 0.5 * air + 0.06 * Math.sin(s.id * 2.1), -s.rot, Math.cos(s.rot * 1.3) * 0.45 * air);
      const sh = g.userData.shadow; sh.visible = true;
      const k = 1 + z / 6; sh.scale.set(STONE_R * 3.1 * k * sc, STONE_R * 2.7 * k * sc, 1); sh.position.set(w2x(s.x) + z * 0.1, CLOTH_Y + 0.02, w2z(s.y) + z * 0.05);
      sh.material.opacity = 0.62 / (1 + z * 0.09);
    }
    // the glass palm ring
    palms.forEach((g) => { g.visible = false; g.userData.shadow.visible = false; });
    (want.hands || []).forEach((h, i) => {
      const g = palmFor(i), r = h.r * U;
      g.visible = true; g.position.set(w2x(h.x), CLOTH_Y + 1.15 + 0.15 * Math.sin(clock * 2.2 + i), w2z(h.y)); g.scale.set(r, r, r);
      g.userData.glass.emissiveIntensity = 0.12 + 0.5 * (h.glow || 0); g.userData.glass.opacity = 0.42 * (h.alpha ?? 1);
      const sh = g.userData.shadow; sh.visible = true; sh.scale.set(r * 2.6, r * 2.3, 1); sh.position.set(w2x(h.x) + 0.15, CLOTH_Y + 0.015, w2z(h.y) + 0.1);
    });
    // the overlay the 2D layer drew this frame
    ovTex.needsUpdate = true;
    dust.visible = !want.calm; if (dust.visible) updateDust(clock);
    const k = `${cssW()}x${cssH()}`; if (k !== vk) { vk = k; renderer.setSize(cssW(), cssH(), false); }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); sizeOverlay(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: the flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); clearCaches();
    sun.map = latticeCookie();
    world.remove(cloth); cloth.geometry.dispose(); cloth = clothMesh(TIERS[tier].cloth); world.add(cloth);
    applyTier(); sizeOverlay(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snapNext = true;
  });

  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera, sun,
    attach() { attached = true; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snapNext = true; },
    post,
    get tier() { return TIERS[tier].name; },
    get cam() { return { ...cur }; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
