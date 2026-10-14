// Krar Lyre 3D presenter. READS the game state / what the 2D layer asked to draw (src/v3.js), never writes the simulation.
// One WebGL canvas sits behind the kit's transparent 2D canvas. The 2D layer keeps drawing rings, popups, sparks, text and buttons on top; this layer
// draws the world and the instrument they are aligned to (same virtual units, perspective camera fitted so the z=0 plane maps 1:1 to the layout).
// Boot: the first frames are the flat 2D art (instant); the scene is built in slices (await tick) and compiled asynchronously, then crossfaded in.
// Fallback: no WebGL / context lost -> v3.on = false and every screen draws flat; context restored -> back to 3D without a reload.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { buildMaterials, buildLyre, updateLyre, buildBackdrop, buildMat, softDot } from './models.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048 },
  { name: 'medium', dpr: 1.5, shadow: 1024 },
  { name: 'low', dpr: 1, shadow: 0 },
];
const tick = () => new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));
const sig = (G) => [G.cx, G.barY, G.bowlCy, G.rx, G.ry, G.halfTop, G.botY, G.bridgeY, G.tailY].map((v) => Math.round(v * 2)).join(',');

export function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.autoClear = false; renderer.setClearColor(0x07201e, 1);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 1, 50, 6000);
  const ortho = new THREE.OrthographicCamera(0, 720, 0, -1560, 1, 4000); ortho.position.z = 1000;
  const world = new THREE.Group(); scene.add(world);
  let mats = null, backdrop = null;
  const lyres = new Map();          // sig -> { lyre, mat }
  let shown = null;
  let hemi, key, rim, fill, W = 0, H = 0, dprNow = 1, vw = 720, vh = 1560, clock = 0, lastT = 0, ema = 16, frames = 0, ready = false, fadeT = 0;

  function lights() {
    hemi = new THREE.HemisphereLight(0xfff0d0, 0x24352c, 0.45);
    key = new THREE.DirectionalLight(0xfff0d6, 2.1);
    rim = new THREE.DirectionalLight(0xffc27a, 2.4);
    fill = new THREE.DirectionalLight(0x8fe8d0, 0.7);
    key.castShadow = true; key.shadow.bias = -0.0006; key.shadow.normalBias = 1.2; key.shadow.radius = 3;
    scene.add(hemi, key, key.target, rim, rim.target, fill, fill.target);
  }
  function aimLights(G) {
    const c = new THREE.Vector3(G.cx, -(G.barY + G.botY) / 2, 0), s = Math.max(G.W, G.H);
    key.position.set(c.x - s * 0.55, c.y + s * 0.7, s * 1.1); key.target.position.copy(c);
    rim.position.set(c.x + s * 0.9, c.y + s * 0.15, -s * 0.9); rim.target.position.copy(c);
    fill.position.set(c.x + s * 0.8, c.y - s * 0.2, s * 0.8); fill.target.position.copy(c);
    const e = s * 0.95, sc = key.shadow.camera;
    sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 10; sc.far = s * 4; sc.updateProjectionMatrix();
    key.target.updateMatrixWorld();
  }
  function buildEnvMap() {
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    pm.dispose();
    scene.environment = t; scene.environmentIntensity = 0.38;
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0;
    if (t.shadow > 0) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    key.castShadow = t.shadow > 0;
    W = 0;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  function fitCamera(t) {
    const D = 2400, fov = (2 * Math.atan(vh / 2 / D) * 180) / Math.PI;
    camera.fov = fov; camera.aspect = vw / vh; camera.near = 100; camera.far = 6000;
    const dx = Math.sin(t * 0.21) * 22, dy = Math.cos(t * 0.17) * 10;
    camera.position.set(vw / 2 + dx, -vh / 2 + dy, D); camera.lookAt(vw / 2, -vh / 2, 0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    ortho.left = 0; ortho.right = vw; ortho.top = 0; ortho.bottom = -vh; ortho.updateProjectionMatrix();
  }
  function lyreFor(G) {
    const k = sig(G);
    let e = lyres.get(k);
    if (!e) {
      if (lyres.size >= 5) { const first = lyres.keys().next().value, o = lyres.get(first); world.remove(o.lyre.root, o.mat); disposeTree(o.lyre.root); disposeTree(o.mat); lyres.delete(first); }
      const lyre = buildLyre(G, mats), mat = buildMat(G, mats);
      lyre.root.visible = false; mat.visible = false; world.add(lyre.root, mat);
      e = { lyre, mat }; lyres.set(k, e);
    }
    return e;
  }
  function disposeTree(o) { o.traverse((n) => { if (n.geometry) n.geometry.dispose(); }); }

  function present(state, L, dt) {
    clock += dt; vw = L.w; vh = L.h;
    resize(); fitCamera(clock);
    const back = v3.back ?? { w: vw, h: vh, t: clock, pulse: 0, dim: 0 };
    backdrop.update(clock, vw, vh, { pulse: back.pulse, dim: back.dim * 0.9 + v3.dark });
    const want = v3.lyre;
    if (shown && (!want || sig(want.G) !== shown.sig)) { shown.e.lyre.root.visible = false; shown.e.mat.visible = false; shown = null; }
    if (want) {
      const e = lyreFor(want.G);
      if (!shown) { shown = { e, sig: sig(want.G) }; e.lyre.root.visible = true; e.mat.visible = true; aimLights(want.G); }
      updateLyre(e.lyre, { ...want.o, t: clock }, clock);
      rim.intensity = 2.4 + (want.o.glow ?? 0) * 0.8;
    }
    if (v3.fade < 1) { fadeT += dt; v3.fade = clamp(fadeT / 0.55, 0, 1); }
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(backdrop.scene, ortho);
    renderer.clearDepth();
    if (shown) renderer.render(scene, camera);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnvMap(); } catch (e) { /* no reflections, still playable */ }
    try { if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } } catch (e) { /* ignore */ }
    W = 0; resize(); fadeT = 0.4; v3.fade = 0.7; v3.on = ready;
  });

  // ---- staged build: every await yields a frame so the first interactive paint is never blocked
  async function init() {
    try {
      await tick(); mats = buildMaterials();
      await tick(); lights(); buildEnvMap(); applyTier();
      await tick(); backdrop = buildBackdrop(); softDot();
      await tick();
      // pre-build the title lyre (the first screen) with the same layout the game uses at this window size
      const short = Math.min(window.innerWidth, window.innerHeight) || 390, k = 720 / short;
      vw = Math.round(window.innerWidth * k); vh = Math.round(window.innerHeight * k);
      const L = layoutFor(vw, vh);
      if (L.title?.hero) { const e = lyreFor(L.title.hero); e.lyre.root.visible = true; e.mat.visible = true; aimLights(L.title.hero); backdrop.update(0, vw, vh, {}); resize(); fitCamera(0); }
      await tick();
      if (renderer.compileAsync) { try { await renderer.compileAsync(scene, camera); } catch (e) { /* compile lazily */ } }
      else { try { renderer.compile(scene, camera); } catch (e) { /* ignore */ } }
      for (const e of lyres.values()) { e.lyre.root.visible = false; e.mat.visible = false; }
      await tick();
      ready = true; lastT = performance.now(); fadeT = 0; v3.fade = 0; v3.on = true;
    } catch (e) { console.warn('3D init failed; 2D fallback', e); v3.on = false; canvas.remove(); }
  }
  init();

  return {
    ok: true, renderer, scene, camera,
    get ready() { return ready; },
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input?.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          if (!v3.on) { game.render(ctx, view); return; }
          const state = game.getState();
          const L = layoutFor(view?.width ?? 720, view?.height ?? 1560);
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.back = null; v3.lyre = null;
          v3.dark = state.scene && !['title', 'play', 'free', 'calib', 'songs', 'piece', 'result'].includes(state.scene) ? 0.3 : 0;
          ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
          game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
