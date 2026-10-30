// Ddakji 3D presenter. READS the game (game.getState() and the table the 2D layer hands over in v3.table), never writes the sim.
// One WebGL canvas sits behind the kit's transparent 2D canvas. The three.js camera is built to project EXACTLY like the game's own
// camera (src/cam.js: same eye, tilt, focal scale and offset), so the 2D ghost, dust, labels and every tap line up with the 3D room
// and mat with no extra mapping. No WebGL or a lost context: v3.on = false and every screen draws the flat 2D art.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { tileToWorld } from '../src/art.js';
import { buildRoom, makeTile, setTilePat, setTileAlpha, disposeWorld } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x120b06);
  const root = new THREE.Group(); root.matrixAutoUpdate = false;                  // world (x right, y away, z up) -> three (x, z, -y)
  root.matrix.set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1); root.matrixWorldNeedsUpdate = true; scene.add(root);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80); camera.matrixAutoUpdate = false; root.add(camera);
  const hemi = new THREE.HemisphereLight(0xffe2b8, 0x3a2010, 0.5);
  const key = new THREE.SpotLight(0xffe0a8, 600, 0, 0.5, 0.95, 2);
  key.position.set(-2.4, -0.6, 7.2); key.target.position.set(0, 2.7, 0);
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.01; key.shadow.camera.near = 3; key.shadow.camera.far = 24; key.shadow.radius = 4;
  root.add(hemi, key, key.target);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.22; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  let room = buildRoom(root);
  await tick();

  // tiles: a small pool of holders, matrices set from the sim's tileToWorld
  const tiles = []; let used = 0;
  const useTile = () => { let h = tiles[used]; if (!h) { h = makeTile(); tiles.push(h); root.add(h); } used++; h.visible = true; return h; };
  const ex = new THREE.Vector3(), ey = new THREE.Vector3(), ez = new THREE.Vector3(), eo = new THREE.Vector3();
  function poseTile(h, t) {
    const o = tileToWorld(t, 0, 0, 0), a = tileToWorld(t, 1, 0, 0), b = tileToWorld(t, 0, 1, 0), c = tileToWorld(t, 0, 0, 1);
    ex.set(a.x - o.x, a.y - o.y, a.z - o.z); ey.set(b.x - o.x, b.y - o.y, b.z - o.z); ez.set(c.x - o.x, c.y - o.y, c.z - o.z); eo.set(o.x, o.y, o.z);
    h.matrix.makeBasis(ex, ey, ez).setPosition(eo); h.matrixWorldNeedsUpdate = true;
    setTilePat(h, t.pat); setTileAlpha(h, t.alpha ?? 1);
  }

  function applyTier() {
    const t = TIERS[tier]; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: identical to src/cam.js
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => Math.min(cssW(), cssH()) / 720;
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const R = new THREE.Vector3(1, 0, 0), U = new THREE.Vector3(), Z = new THREE.Vector3(), P = new THREE.Vector3();
  function placeCamera(cam, sx, sy) {
    const W = cssW(), H = cssH(), k = cpu(), S = cam.S * k, ox = cam.ox * k + offX() + sx, oy = cam.oy * k + offY() + sy, n = 0.1, f = 80;
    const SP = Math.sin(cam.phi), CP = Math.cos(cam.phi);
    Z.set(0, -CP, SP); U.set(0, SP, CP); P.set(cam.eye.x, cam.eye.y, cam.eye.z);      // camera looks along -Z: forward is (0, cos, -sin)
    camera.matrix.makeBasis(R, U, Z).setPosition(P); camera.matrixWorldNeedsUpdate = true;
    const e = camera.projectionMatrix.elements;
    e[0] = 2 * S / W; e[4] = 0; e[8] = 1 - 2 * ox / W; e[12] = 0;
    e[1] = 0; e[5] = 2 * S / H; e[9] = 2 * oy / H - 1; e[13] = 0;
    e[2] = 0; e[6] = 0; e[10] = -(f + n) / (f - n); e[14] = -2 * f * n / (f - n);
    e[3] = 0; e[7] = 0; e[11] = -1; e[15] = 0;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  // ---------------------------------------------------------------- frame
  let loseExt = null, game = null, lost = false, lastNow = 0, clock = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0;
  function pre() { v3.table = null; }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const tb = v3.table;
    used = 0;
    if (tb) {
      const sh = tb.shake ? tb.shake * 5 * cpu() : 0;
      placeCamera(tb.cam, sh ? Math.sin(tb.t * 70) * sh : 0, sh ? Math.cos(tb.t * 83) * sh * 0.8 : 0);
      for (const it of tb.tiles) poseTile(useTile(), it.t);
    }
    for (let i = used; i < tiles.length; i++) tiles[i].visible = false;
    room.userData.lamps.forEach((l, i) => { const f = 1 + 0.05 * Math.sin(clock * (3.2 + i * 1.1) + i) + 0.025 * Math.sin(clock * 9.3 + i * 2); l.userData.light.intensity = 14 * f; l.userData.halo.material.opacity = 0.5 + 0.08 * f; });
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    if (tb) renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.table = null; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); disposeWorld();
    for (const h of tiles) root.remove(h); tiles.length = 0; used = 0;
    root.remove(room); room = buildRoom(root);
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible';
  });
  await tick();
  try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();
  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    setTier(n) { tier = clamp(n | 0, 0, 2); applyTier(); },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return !!loseExt; },
    restoreContext() { loseExt?.restoreContext(); return !!loseExt; },
  };
}
