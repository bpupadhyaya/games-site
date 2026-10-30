// Jack and Boule 3D presenter. READS the game (game.getState() and what the 2D layer drew this frame, src/v3.js), never writes it.
// One WebGL canvas sits behind the kit's transparent 2D canvas. The camera is a perspective camera built to match cam.js project()
// exactly, so every tap, aim guide, ring and particle drawn by the 2D layer lands on the 3D pitch. No WebGL or a lost context:
// v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { CAM } from '../src/cam.js';
import { palOf } from '../src/art.js';
import { buildGround, buildBorders, buildSling, buildBackdrop, buildLights, makeBoule, makeJack, radialTex, R_B, R_J } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ dpr: 2, shadow: 2048, tex: 1536 }, { dpr: 1.5, shadow: 1024, tex: 1024 }, { dpr: 1, shadow: 0, tex: 768 }];
const tick = () => new Promise((r) => setTimeout(r, 0));

export async function createPresenter({ kitCanvas, dev = false }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.8;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe9d8b4, 1500, 4200);
  const camera = new THREE.PerspectiveCamera(30, 1, 20, 9000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.03).texture; pm.dispose(); scene.environmentIntensity = 0.55; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // ---- per pitch: ground + backdrop + borders, cached per terrain seed and texture size
  const pitches = new Map(); let pitch = null, pitchKey = '';
  function setPitch(T) {
    const k = `${T.id}:${T.seed}|${TIERS[tier].tex}`; if (k === pitchKey) return;
    let p = pitches.get(k);
    if (!p) {
      const group = new THREE.Group(), ground = buildGround(T, TIERS[tier].tex), back = buildBackdrop(T), borders = buildBorders(palOf(T));
      group.add(ground, back, borders);
      p = { group, ground, T }; pitches.set(k, p);
      if (pitches.size > 3) { const [k0, p0] = pitches.entries().next().value; pitches.delete(k0); scene.remove(p0.group); p0.ground.userData.dispose(); }
    }
    if (pitch) scene.remove(pitch.group);
    pitch = p; pitchKey = k; scene.add(p.group);
    const P = palOf(T); scene.fog.color.set(P.skyB);
    scene.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow && TIERS[tier].shadow > 0; } });
  }
  const sling = buildSling(); scene.add(sling);
  const blobT = radialTex('20,10,4', 0.75);
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const mkBlob = () => { const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 1; scene.add(m); return m; };
  // ---- balls
  const nodes = new Map();      // ball id -> { g, blob, last: [x, y] }
  const held = { boule: [makeBoule(0), makeBoule(1)], jack: makeJack(), blob: mkBlob() };
  for (const g of [...held.boule, held.jack]) { g.visible = false; scene.add(g); }
  const _q = new THREE.Quaternion(), _ax = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
  function nodeFor(b) {
    let n = nodes.get(b.id);
    if (!n) { const g = b.k ? makeJack() : makeBoule(b.team); scene.add(g); n = { g, blob: mkBlob(), last: [b.x, b.y], spin: 0 }; nodes.set(b.id, n); g.quaternion.setFromEuler(new THREE.Euler(b.id * 1.7, b.id * 2.3, 0)); }
    return n;
  }
  function syncBalls(w) {
    const seen = new Set();
    for (const b of w.balls) {
      seen.add(b.id); const n = nodeFor(b);
      const alpha = b.out ? Math.max(0, 1 - b.fade) : 1, y3 = b.z + b.r;
      n.g.position.set(b.x, y3, -b.y); n.g.scale.setScalar(Math.max(0.01, alpha)); n.g.visible = true;
      // rolling: turn about the horizontal axis perpendicular to the travel direction
      const dx = b.x - n.last[0], dy = b.y - n.last[1], dist = Math.hypot(dx, dy);
      if (dist > 1e-4 && dist < 60) { _d.set(dx, 0, -dy).normalize(); _ax.crossVectors(_up, _d); _q.setFromAxisAngle(_ax.normalize(), dist / b.r); n.g.quaternion.premultiply(_q); }
      n.last[0] = b.x; n.last[1] = b.y;
      const lift = Math.max(0, b.z), s = b.r * 2.9 * (1 + lift * 0.02) * alpha;
      n.blob.position.set(b.x + 1.2 + lift * 0.35, 0.25, -b.y - 1.0 - lift * 0.3); n.blob.scale.set(s, 1, s); n.blob.material.opacity = (0.8 - Math.min(0.5, lift * 0.012)) * alpha; n.blob.visible = true;
    }
    for (const [id, n] of nodes) if (!seen.has(id)) { scene.remove(n.g); scene.remove(n.blob); n.blob.material.dispose(); nodes.delete(id); }
  }
  function clearBalls() { for (const [id, n] of nodes) { scene.remove(n.g); scene.remove(n.blob); n.blob.material.dispose(); nodes.delete(id); } }
  // the boule or jack in the sling pouch, placed where the 2D layer drew the band tip (ray through the stage point onto the sling plane)
  function syncHeld() {
    for (const g of [...held.boule, held.jack]) g.visible = false;
    held.blob.visible = false;
    const h = v3.held; if (!h || !stage) return;
    const { CB, CH, COS, SIN, F } = CAM, fwd = CB - 4, sv = h.sy - stage.cy, sh = h.sx - stage.cam.w / 2;
    const up = (fwd * (sv * COS + F * SIN)) / (sv * SIN - F * COS), d = fwd * COS - up * SIN;
    const x = (sh * d) / F, z = up + CH;
    const g = h.jack ? held.jack : held.boule[h.team];
    g.position.set(x, z, 4); g.visible = true; g.scale.setScalar(h.jack ? 1.5 : 1);
    held.blob.visible = true; held.blob.position.set(x + 1, 0.3, 3); const k = (h.jack ? R_J : R_B) * 2.6 * (1 + Math.max(0, z) * 0.01); held.blob.scale.set(k, 1, k); held.blob.material.opacity = Math.max(0.15, 0.7 - z * 0.012);
  }

  // ---- the camera: exactly cam.js project() for the live stage
  let stage = null;
  function placeCamera(L) {
    const { CB, CH, COS, SIN, F, SY0 } = CAM, S = L.stage, C = L.cam, CXs = C.w / 2, CYs = C.cy - SY0;
    const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
    const cpu = meta.cssPerUnit || Math.min(W, H) / 720, offX = (W - meta.width * cpu) / 2, offY = (H - meta.height * cpu) / 2;
    const u = (cx) => ((cx - offX) / cpu - S.tx) / S.f - S.ox - CXs;
    const v = (cy) => CYs - ((cy - offY) / cpu - S.ty) / S.f;
    const n = 20;
    camera.position.set(0, CH, CB);
    camera.up.set(0, 1, 0); camera.lookAt(0, CH - SIN, CB - COS);
    camera.projectionMatrix.makePerspective((u(0) * n) / F, (u(W) * n) / F, (v(0) * n) / F, (v(H) * n) / F, camera.near, camera.far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld(true);
    stage = { cy: CYs, cam: C };
  }

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, clock = 0, loseExt = null;
  function pre() { if (!game || lost) return; v3.world = null; }
  function post() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(state.size?.[0] ?? meta.width, state.size?.[1] ?? meta.height);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    placeCamera(L);
    const w = v3.world;
    if (w) { setPitch(w.terrain); syncBalls(w); }
    syncHeld();
    renderer.setSize(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight), false);
    renderer.render(scene, camera);
    if (canvas.style.visibility !== 'visible') canvas.style.visibility = 'visible';
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; pitchKey = ''; applyTier(); } } else slowFrames = 0;
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv();
    for (const p of pitches.values()) { scene.remove(p.group); p.ground.userData.dispose(); } pitches.clear(); pitch = null; pitchKey = ''; clearBalls();
    applyTier(); v3.on = true; canvas.style.visibility = 'visible';
  });
  await tick();
  placeCamera(layoutFor(meta.width, meta.height));
  return {
    ok: true, renderer, scene, camera, pre, post,
    attach(g) { game = g; v3.on = true; },
    get tier() { return tier; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
    project: (x, y, z) => { const p = new THREE.Vector3(x, z, -y).project(camera); return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight }; },
  };
}
