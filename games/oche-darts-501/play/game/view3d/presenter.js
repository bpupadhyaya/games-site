// Oche Darts 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: a sisal dartboard on a green baize backboard in a pub, steel-tip darts that fly in from the oche and stick with a wobble.
// The camera looks straight at the board, so the 2D layer's aim ring, highlights and score pops (drawn on top) line up with the 3D board
// exactly: the 2D layer reports where it would draw the board (v3.board, CSS px) and the camera is fitted to that circle every frame.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { BOARD, PX_PER_MM, AIM } from '../src/layout.js';
import { buildBoard, buildRoom, buildLights, buildDart, BOARD_MM } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1 }, { name: 'low', dpr: 1, shadow: 0, tex: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const DIST = 400;                                   // camera distance from the board face (mm)
const POOL = 8;

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1410);
  const camera = new THREE.PerspectiveCamera(30, 1, 20, 4000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const room = buildRoom(scene);
  await tick();
  let board = buildBoard(TIERS[tier].tex); scene.add(board);
  await tick();
  const pools = [0, 1].map((s) => Array.from({ length: POOL }, () => { const d = buildDart(s); scene.add(d); return d; }));
  const used = [0, 0];
  const take = (side) => { const p = pools[side ? 1 : 0], d = p[used[side ? 1 : 0]++]; return d && (d.visible = true, d); };

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  // Fit the camera so the board's 170 mm radius is exactly b.r CSS px, centred at (b.x, b.y).
  function place(b) {
    const W = cssW(), H = cssH(), pxmm = b.r / BOARD_MM, f = pxmm * DIST;
    camera.fov = 2 * Math.atan(H / 2 / f) * 180 / Math.PI; camera.aspect = W / H;
    camera.position.set(0, 0, DIST); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0);
    camera.setViewOffset(W, H, W / 2 - b.x, H / 2 - b.y, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }

  // ---- darts -----------------------------------------------------------------------------------------------------
  const E = new THREE.Euler(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
  const ease = (k) => k * k * (3 - 2 * k);
  function stuck(side, xm, ym, d, seed) {
    const g = take(side); if (!g) return;
    const age = d.age ?? 3, amp = d.amp ?? 0, wob = amp * Math.exp(-5.5 * age) * Math.sin(36 * age + (d.ph ?? 0));
    let z = 0, scale = 1;
    g.position.set(xm, ym, 0);
    const yaw = (hash(seed, 1) - 0.5) * 0.14 + wob * 0.35, pitch = 0.09 + hash(seed, 2) * 0.05 + wob * 0.55;
    E.set(pitch, yaw, hash(seed, 3) * 6.28, 'YXZ'); g.quaternion.setFromEuler(E);
    if (d.leave) { const k = ease(Math.min(1, d.leave / 0.45)); z = k * 150; g.position.y += k * 40; }
    if (d.fall) {
      const f = d.fall, a = f.age;
      g.position.x += f.vx * a / PX_PER_MM; g.position.y -= (f.vy * a + 600 * a * a) / PX_PER_MM; z = 30 * a;
      E.set(pitch + f.rot * a * 0.6, yaw, f.rot * a * 0.5, 'YXZ'); g.quaternion.setFromEuler(E);
    }
    g.position.z = z; g.scale.setScalar(scale);
    if (d.leave && d.leave > 0.5) g.visible = false;
  }
  function flying(f) {
    const g = take(f.side); if (!g) return;
    const k = Math.min(1, f.t / f.dur), e = k;     // straight-line flight, same easing family as the flat art
    const ex = (f.ex - BOARD.cx) / PX_PER_MM, ey = -(f.ey - BOARD.cy) / PX_PER_MM;
    const sx = (f.sx - BOARD.cx) / PX_PER_MM * 0.35, sy = -(f.sy - BOARD.cy) / PX_PER_MM * 0.55 - 30, sz = 380;
    const x = sx + (ex - sx) * e, y = sy + (ey - sy) * e + Math.sin(k * Math.PI) * 55, z = sz * (1 - e);
    g.position.set(x, y, z);
    V.set(ex - sx, ey - sy + (1 - 2 * k) * 55 * Math.PI * 0.0, -sz).normalize().negate();   // tail direction = opposite the velocity
    Q.setFromUnitVectors(Z, V); g.quaternion.copy(Q);
    g.scale.setScalar(1);
  }

  // ---- per frame -------------------------------------------------------------------------------------------------
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, last = null, clock = 0;
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), b = v3.board || last;
    if (v3.board) last = v3.board;
    if (b) place(b); else { camera.clearViewOffset(); }
    board.visible = !!v3.board; room.userData.frame.visible = state.scene === 'play';
    used[0] = used[1] = 0; for (const p of pools) for (const d of p) d.visible = false;
    if (v3.board) {
      if (state.scene === 'title') {
        (state.att?.darts ?? []).forEach((d, i) => stuck(d.side, d.x, -d.y, d, i + 11));
      } else if (state.scene === 'play') {
        state.darts.forEach((d, i) => stuck(d.side, (d.x - BOARD.cx) / PX_PER_MM, -(d.y - BOARD.cy) / PX_PER_MM, d, Math.round(d.x * 7 + d.y * 13) + i));
        if (state.flight) flying(state.flight);
      }
    }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); scene.remove(board); board.userData.dispose(); board = buildBoard(TIERS[tier].tex); scene.add(board);
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible';
  });

  await tick();
  try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; },
    post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
