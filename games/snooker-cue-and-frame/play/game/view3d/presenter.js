// Snooker 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent 2D
// canvas: a club snooker table with real cushions, pockets, glossy balls and a 3D cue, under one warm overhead lamp. The camera is the
// 2D layer's own pinhole (v3.cam, reported every frame in CSS px), so the aim guide, glow rings, score pops and every tap drawn or
// read by the 2D layer line up with the 3D table exactly. No WebGL, ?flat=1 or a lost context: v3.on = false and the flat art draws.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { TW, R, CUE } from '../src/sim.js';
import { interp, cueGap, holeOf } from '../src/view.js';
import { buildTable, buildRoom, buildLights, buildBall, buildCue } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, big: 1 }, { name: 'medium', dpr: 1.5, shadow: 1024, big: 1 }, { name: 'low', dpr: 1, shadow: 0, big: 0 }];
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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0806);
  scene.fog = new THREE.Fog(0x0a0806, 7, 16);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 60);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.3; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  // the table frame: x across, y away from the player, z up. world (camera frame): X right, Y up, Z toward the viewer.
  const frame = new THREE.Group(); frame.matrixAutoUpdate = false; scene.add(frame);
  buildRoom(frame);
  frame.add(lights.hemi, lights.key, lights.key.target, lights.fill);
  await tick();
  let table = buildTable(TIERS[tier].big); frame.add(table);
  await tick();
  const balls = [];
  for (let id = 0; id <= 21; id++) { const b = buildBall(id); b.visible = false; frame.add(b); balls[id] = b; }
  const cue = buildCue(); cue.visible = false; frame.add(cue);
  await tick();

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  let lastOrient = '';
  const MV = new THREE.Matrix4(), EX = new THREE.Vector3(), EY = new THREE.Vector3(), EZ = new THREE.Vector3(0, 1, 0);
  // Place the table frame and the camera so the pinhole matches the 2D layer's (f px focal length, principal point cx, cy).
  function place(c) {
    if (c.orient !== lastOrient) {
      lastOrient = c.orient;
      if (c.orient === 'h') { EX.set(0, 0, 1); EY.set(1, 0, 0); MV.makeBasis(EX, EY, EZ); MV.setPosition(0, 0, -TW); } else { EX.set(1, 0, 0); EY.set(0, 0, -1); MV.makeBasis(EX, EY, EZ); }
      frame.matrix.copy(MV); frame.matrixWorldNeedsUpdate = true; frame.updateMatrixWorld(true);
    }
    const W = cssW(), H = cssH(), s = Math.sin(c.phi), co = Math.cos(c.phi);
    camera.fov = 2 * Math.atan(H / 2 / c.f) * 180 / Math.PI; camera.aspect = W / H;
    camera.position.set(c.E[0], c.E[2], -c.E[1]); camera.up.set(0, co, -s);
    camera.lookAt(c.E[0], c.E[2] - s, -c.E[1] - co);
    camera.setViewOffset(W, H, W / 2 - c.cx, H / 2 - c.cy, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }

  const Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), Mk = new THREE.Vector3(), E = new THREE.Euler();
  function setBall(id, x, y, z, mark, scale = 1) {
    const b = balls[id]; if (!b) return; b.visible = true; b.position.set(x, y, z); b.scale.setScalar(scale);
    if (mark) { Mk.set(mark[0], mark[1], mark[2]); if (Mk.lengthSq() > 1e-6) { Mk.normalize(); Q.setFromUnitVectors(Y, Mk); b.quaternion.copy(Q); } }
  }
  function poseBalls(state) {
    for (const b of balls) b.visible = false;
    if (state.scene === 'play' && state.w) {
      const al = state.alpha ?? 1;
      for (const b of state.w.b) {
        if (b.on) {
          const p = interp(b, al); let sc = 1;
          if (b.respotted && b.rt !== undefined && b.rt < 0.5) sc = 0.3 + 1.4 * b.rt;
          setBall(b.id, p.x, p.y, R, [b.mx, b.my, b.mz], Math.min(1, sc));
        } else if (b.pt < 0.5 && b.pk >= 0 && !b.gone) {
          const hole = holeOf(b.pk), k = Math.min(1, b.pt / 0.42), e = k * k * (3 - 2 * k);
          setBall(b.id, b.x + (hole.x - b.x) * e, b.y + (hole.y - b.y) * e, R * (1 - 0.9 * e) - 0.12 * e, [b.mx, b.my, b.mz], 1);
        }
      }
    } else for (const b of state.attract ?? []) setBall(b.id, b.x, b.y, R, [b.mx ?? 0, b.my ?? 0, b.mz ?? 1]);
  }
  const CUE_LIFT = 0.22;
  function poseCue(state) {
    cue.visible = false;
    const w = state.w, c = w && w.b.find((b) => b.id === CUE);
    if (state.scene !== 'play' || !c || !c.on || state.ctl === 'roll' || state.ctl === 'verdict') return;
    if (state.phaseKind === 'place' && state.humanTurn) return;
    const a = state.aim.angle, gap = Math.max(0, cueGap(state)), dx = Math.cos(a), dy = Math.sin(a);
    // tip at gap behind the cue ball centre, butt raised: direction from the tip to the butt = (-dx, -dy, +rise)
    const len = 1.45, rise = CUE_LIFT / len * len;
    const dir = new THREE.Vector3(-dx * len, -dy * len, rise).normalize();
    cue.visible = true; cue.position.set(c.x - dx * gap, c.y - dy * gap, R);
    Q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir); cue.quaternion.copy(Q);
  }

  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, last = null;
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const c = v3.cam;
    if (!c) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible'; last = c;
    const state = game.getState();
    place(c); poseBalls(state); poseCue(state);
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); frame.remove(table); table.userData.dispose(); table = buildTable(TIERS[tier].big); frame.add(table);
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible';
  });

  await tick();
  try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();
  void last;

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; },
    post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
