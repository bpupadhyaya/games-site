// Pond Hockey Slide 3D presenter (game-owned). It ONLY READS what the 2D layer hands over (v3.frame: where the pond sits on the
// screen and which world to show); it never writes to the game. One WebGL canvas sits behind the kit's transparent 2D canvas; the
// 2D layer keeps all text, HUD, input, hit testing, aim guides and particles.
//
// Camera: straight above the pond, looking down, with a pinhole whose ground-plane scale is exactly the 2D layout's (L.s px per
// world unit, principal point at the pond centre, turned by L.rot in landscape). So every 2D guide, ring and touch lands on the
// 3D pond exactly, while height (skaters, banks, trees) gives real parallax and lit, shadowed 3D shapes.
// Fallbacks: no WebGL / init failure -> not created (the painted 2D pond stays); context lost -> v3.on = false (2D pond),
// restored -> rebuilt environment, crossfade back to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { LOOKS } from '../src/art.js';
import { HW, HH } from '../src/sim.js';
import { buildRink, envScene } from './rink.js';
import { makeSkater, makePuck } from './skater.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const CAM_D = 1700;   // camera height above the ice, world units (higher = flatter, less parallax)

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { ok: false };
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('keep') }); }
  catch (e) { console.warn('WebGL unavailable; 2D pond kept', e); return noop; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x46657f, 1);

  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8aa6bf, CAM_D + 350, CAM_D + 1500);
  const camera = new THREE.PerspectiveCamera(40, 1, 100, 6000);
  const hemi = new THREE.HemisphereLight(0xcfe2ff, 0xe4edf8, 0.5);
  const key = new THREE.DirectionalLight(0xffe0b4, 2.3);
  key.shadow.bias = -0.0006; key.shadow.normalBias = 1.2; key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0xa8c4ff, 0.35); fill.position.set(0, 1000, 0);
  const goalLight = new THREE.PointLight(0xffd36a, 0, 700, 1.4); goalLight.position.set(0, 40, 0);
  scene.add(hemi, key, key.target, fill, goalLight);
  function buildEnv() {
    const pm = new THREE.PMREMGenerator(renderer);
    if (scene.environment && scene.environment.dispose) { try { scene.environment.dispose(); } catch { /* lost */ } }
    scene.environment = pm.fromScene(envScene(), 0.03).texture; scene.environmentIntensity = 0.5; pm.dispose();
  }
  const nap = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const rink = await buildRink(TIERS[tier].name, nap);
  scene.add(rink.root);

  // ------------------------------------------------------------ people and puck, by sim id
  const actors = new Map();
  function actorFor(b) {
    let a = actors.get(b.id);
    if (!a) { a = b.kind === 'puck' ? makePuck() : makeSkater(LOOKS[b.side * 3 + b.idx], b.idx); scene.add(a.root); actors.set(b.id, a); }
    return a;
  }

  // ------------------------------------------------------------ camera
  let W = 0, H = 0, dprNow = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  function setPose(f) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    camera.position.set(0, CAM_D, 0); camera.up.set(-s, 0, -c); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    const n = 100, fa = 6000, Wv = f.vw, Hv = f.vh, k = f.s * CAM_D, ox = f.cx, oy = f.cy;
    camera.projectionMatrix.set(
      (2 * k) / Wv, 0, -(2 * ox / Wv - 1), 0,
      0, (2 * k) / Hv, -(1 - 2 * oy / Hv), 0,
      0, 0, -(fa + n) / (fa - n), -(2 * fa * n) / (fa - n),
      0, 0, -1, 0,
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // the low sun comes from the screen's upper left whatever the pond's turn
    const vx = -0.62, vy = -0.5, wx = c * vx + s * vy, wy = -s * vx + c * vy, el = 0.8;
    key.target.position.set(0, 0, 0); key.position.set(wx * 900 * Math.cos(el) * 1.2, 900 * Math.sin(el), wy * 900 * Math.cos(el) * 1.2); key.target.updateMatrixWorld();
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    const e = 330 + (HW - 255); Object.assign(key.shadow.camera, { left: -e - 40, right: e + 40, top: HH + 150, bottom: -(HH + 150), near: 200, far: 2200 }); key.shadow.camera.updateProjectionMatrix();
    W = 0; scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
  }

  // ------------------------------------------------------------ one frame
  let lastNow = performance.now(), ema = 16, frames = 0, slow = 0, lost = false, first = true;
  function frame(f) {
    if (lost) return;
    if (!f) { canvas.style.opacity = '0'; return; }
    resize();
    const now = performance.now(), raw = Math.max(0, (now - lastNow) / 1000), dt = Math.min(0.1, raw); lastNow = now;
    ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
    if (frames > 90 && ema > 32 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
    if (raw > 0.3 && frames > 2 && tier < TIERS.length - 1 && ++slow >= 2) { tier = TIERS.length - 1; applyTier(); frames = 0; slow = 0; }
    const w = f.w, seen = new Set();
    for (const b of w.bodies) { const a = actorFor(b); a.update(b, f.t); a.root.visible = true; seen.add(b.id); }
    for (const [id, a] of actors) if (!seen.has(id)) a.root.visible = false;
    rink.setDrifts(w.snow); rink.setTrails(f.trails);
    const fl = Math.max(f.flash0, f.flash1);
    rink.iceMat.emissiveIntensity = f.glow * 0.22;
    goalLight.intensity = fl * 60000; goalLight.position.set(0, 60, f.flash0 > f.flash1 ? -HH + 20 : HH - 20);
    for (const g of rink.goals) { const k = g.sy < 0 ? f.flash0 : f.flash1; g.net.opacity = 0.9; g.net.color.setRGB(1, 1 - 0.1 * k, 1 - 0.45 * k); }
    setPose(f);
    renderer.render(scene, camera);
    if (first) { first = false; window.__first3d = window.__first3d || performance.now(); }
    canvas.style.opacity = '1';
    if (v3.on && v3.mix < 1) v3.mix = Math.min(1, v3.mix + Math.max(dt, 1 / 60) / 0.45);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.mix = 0; canvas.style.opacity = '0'; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnv(); } catch { /* still playable without reflections */ }
    lost = false; W = 0; first = true; v3.on = true; v3.mix = 0;
  });

  try {
    await nap(); buildEnv(); applyTier();
    // create every skater and the puck now and compile every shader before the first visible frame
    for (let side = 0; side < 2; side++) for (let idx = 0; idx < 3; idx++) { await nap(); actorFor({ id: `s${side}${idx}`, kind: 'skater', side, idx }); }
    actorFor({ id: 'puck', kind: 'puck' });
    camera.position.set(0, CAM_D, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    for (const a of actors.values()) a.root.visible = true;
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    for (const a of actors.values()) a.root.visible = false;
    await nap();
  } catch (e) { console.warn('3D init failed; 2D pond kept', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  v3.on = true; v3.mix = 0;

  const loseExt = renderer.getContext().getExtension('WEBGL_lose_context');   // fetched now: it cannot be fetched while lost
  return {
    ok: true, renderer, scene, camera, THREE, rink, frame,
    get tier() { return tier; },
    setTier(t) { tier = clamp(t, 0, TIERS.length - 1); applyTier(); },
    loseContext() { if (loseExt) loseExt.loseContext(); return !!loseExt; },
    restoreContext() { if (loseExt) loseExt.restoreContext(); return !!loseExt; },
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, tier: TIERS[tier].name, mix: v3.mix, on: v3.on }),
  };
}
