// Ken and Ball 3D presenter. READS the sim (what the 2D layer hands over in v3.world each frame: the world, the rope nodes and the cup
// glow), never writes. One WebGL canvas sits behind the kit's transparent 2D canvas. The camera is frontal with an off-axis projection, so
// the toy plane (z = 0) maps exactly onto the 2D layer's world transform (v3.world.m): taps, drags and the Pop gesture land where they
// look. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the
// environment and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { buildKen, buildBall, buildCord, buildGarden, buildLights, far, HORIZON, CAM_D, FLOOR } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, leaf: 0 }, { name: 'medium', dpr: 1.5, shadow: 1024, leaf: 0 }, { name: 'low', dpr: 1, shadow: 0, leaf: 2 }];
const tick = () => new Promise((r) => setTimeout(r, 0));

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
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x4a4684, 2200, 15000);
  const camera = new THREE.PerspectiveCamera(30, 1, 40, 14000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const garden = buildGarden(TIERS[tier].leaf);
  scene.add(garden.root);
  await tick();
  const toy = new THREE.Group(); scene.add(toy);
  const ken = buildKen(), ball = buildBall(), cord = buildCord();
  toy.add(ken, ball, cord);
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.renderOrder = 1; blob.position.y = -FLOOR + 0.6; toy.add(blob);
  await tick();

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.moon.castShadow = t.shadow > 0;
    if (t.shadow) { lights.moon.shadow.mapSize.set(t.shadow, t.shadow); if (lights.moon.shadow.map) { lights.moon.shadow.map.dispose(); lights.moon.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  const cssW = () => kitCanvas.getBoundingClientRect().width || window.innerWidth, cssH = () => kitCanvas.getBoundingClientRect().height || window.innerHeight;
  // Default framing for screens without the toy on stage (menus, documents): the garden composed like the play screen.
  const defaultMap = (iw, ih) => { const s = Math.min(iw / 720, (ih * 0.58) / (FLOOR - HORIZON)); return { s, ox: iw / 2 - 360 * s, oy: ih * 0.24 - HORIZON * s }; };

  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, clock = 0, loseExt = null;
  function pre() { if (game && !lost) v3.world = null; }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const iw = cssW(), ih = cssH(), ratio = kitCanvas.width / iw || 1;
    const W = v3.world;
    let bg;
    if (W && W.stage) bg = { s: W.m.a / ratio, ox: W.m.e / ratio, oy: W.m.f / ratio }; else bg = defaultMap(iw, ih);
    // off-axis frustum: the plane z = 0 maps exactly onto the screen rectangle of the 2D world
    const xl = -bg.ox / bg.s, xr = (iw - bg.ox) / bg.s, yt = -bg.oy / bg.s, yb = (ih - bg.oy) / bg.s;
    const cx = (xl + xr) / 2, camY = -HORIZON, nr = 40, k = nr / CAM_D;
    camera.position.set(cx, camY, CAM_D); camera.rotation.set(0, 0, 0); camera.updateMatrixWorld(true);
    camera.projectionMatrix.makePerspective((xl - cx) * k, (xr - cx) * k, (-yt - camY) * k, (-yb - camY) * k, nr, 14000);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // the toy: placed through its own map when it is not the stage (title hero)
    if (W) {
      const kk = (W.m.a / ratio) / bg.s;
      toy.visible = true; toy.scale.set(kk, kk, kk);
      toy.position.set((W.m.e / ratio - bg.ox) / bg.s, -((W.m.f / ratio - bg.oy) / bg.s), 0);
      const w = W.w, kn = w.ken, b = w.ball;
      ken.position.set(kn.x, -kn.y, 0); ken.rotation.set(0, 0, -kn.th);
      ball.position.set(b.x, -b.y, 0); ball.rotation.set(0, 0, -b.a);
      cord.userData.update(W.rope);
      const gl = W.glow || {};
      for (const key of Object.keys(ken.userData.glows)) {
        const g = ken.userData.glows[key], v = gl[key] || 0, pulse = v > 0 ? 0.75 + 0.25 * Math.sin(clock * 6) : 0;
        g.halo.material.opacity = clamp(v * pulse, 0, 1) * 0.95; if (g.ringMat) g.ringMat.emissiveIntensity = v * 1.4;
      }
      const h = clamp((FLOOR - b.y) / 700, 0, 1), sz = 96 * (1.25 - 0.4 * (1 - h)) * (1 + 0.25 * h);
      blob.position.x = b.x; blob.position.z = 0; blob.scale.set(sz, sz * 0.5, 1); blob.material.opacity = 0.6 * (1 - 0.6 * h);
      blob.visible = b.y < FLOOR + 40;
    } else toy.visible = false;
    // the garden follows the screen edges and the moon sits at a fixed place on the screen
    const sx = (f) => xl + f * (xr - xl), sy = (f) => yt + f * (yb - yt);
    for (const t of garden.trunks) { const xs = t.side < 0 ? xl + t.off : xr - t.off; t.g.position.x = cx + (xs - cx) * (CAM_D - t.z) / CAM_D; }
    { const z = -6400, [mx, my] = far(cx, HORIZON, sx(0.74), clamp(sy(0.16), -300, HORIZON - 90), z), sc = 330 * (CAM_D - z) / CAM_D * 0.55; garden.moon.position.set(mx, -my, z); garden.moon.scale.set(sc * 3, sc * 3, 1); }
    { const z = -560, [lx] = far(cx, HORIZON, sx(0.8), 0, z); garden.lan.position.x = lx; }
    { const z = -180, [ax] = far(cx, HORIZON, sx(0.14), 0, z); garden.and.position.x = ax; }
    const f = 1 + 0.07 * Math.sin(clock * 7.3) + 0.04 * Math.sin(clock * 13.1 + 1.7) + 0.02 * Math.sin(clock * 23.7);
    garden.lanLight.intensity = 480000 * f; garden.andLight.intensity = 90000 * (2 - f);
    garden.halo.material.opacity = clamp(0.8 + (f - 1) * 1.4, 0, 1); garden.andHalo.material.opacity = clamp(0.75 + (1 - f) * 1.4, 0, 1);
    lights.moon.target.position.set(cx, -640, 0);
    renderer.setSize(iw, ih, false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); applyTier(); v3.on = true; canvas.style.visibility = 'visible'; });

  await tick();
  try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; canvas.style.visibility = 'visible'; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
