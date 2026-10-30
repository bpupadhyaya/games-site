// Sapo 3D presenter. READS what the 2D layer recorded this frame (src/r3.js: screen transform, clip, discs, hole flashes) and draws the
// lit cantina-patio scene behind the kit canvas with the SAME pinhole camera as src/scene.js (CAM), so the 2D HUD, aim arcs, sparks and
// every touch map exactly as before. No WebGL / context lost: r3.on = false and every screen draws its flat 2D art; restored: back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { r3 } from '../src/r3.js';
import { CAM } from '../src/scene.js';
import { HOLES } from '../src/phys.js';
import { buildTable, buildFrog, buildBridge, buildMill, makeDisc, buildRoom } from './models.js';

const TIERS = [{ dpr: 2, shadow: 2048 }, { dpr: 1.5, shadow: 1024 }, { dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));   // yield so the flat title paints and stays interactive while the scene builds

export async function createPresenter({ kitCanvas }) {
  const noop = { ok: false, wrap: (g) => g, adopt() {} };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas); kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.setClearColor(0x0b0705, 1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = 0;

  await tick();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, CAM.H, CAM.zc); camera.rotation.y = Math.PI; camera.updateMatrixWorld(true);
  const root = new THREE.Group(); root.scale.x = -1; scene.add(root);   // game coordinates are left-handed on screen (x right, z away)
  const X = (x) => -x;                                                   // light positions are given in three world coordinates

  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x2a1c18, 0.3);
  const key = new THREE.SpotLight(0xffd8a0, 6, 0, 0.5, 0.8, 2); key.position.set(X(0.12), 1.75, 0.05); key.target.position.set(0, 0, 0.5);
  key.castShadow = true; key.shadow.bias = -0.0003; key.shadow.normalBias = 0.003; key.shadow.radius = 3; key.shadow.camera.near = 0.6; key.shadow.camera.far = 4;
  const rim = new THREE.DirectionalLight(0x7f9cff, 0.9); rim.position.set(X(-1.2), 1.4, 2.2);
  const warm = new THREE.PointLight(0xffb060, 2.4, 0, 2); warm.position.set(0, 0.42, 1.2);
  const frogGlow = new THREE.PointLight(0xffd070, 0, 0, 2); frogGlow.position.set(0, 0.16, 0.6);
  scene.add(hemi, key, key.target, rim, warm, frogGlow);
  B.createEnvironment(renderer, scene, { intensity: 0.28 });   // rebuilds itself after a context restore

  await tick();
  const room = buildRoom(); root.add(room);
  await tick();
  root.add(buildTable());
  root.add(buildFrog());
  for (const h of [HOLES[2], HOLES[3]]) root.add(buildBridge(h));
  const mill = buildMill(); root.add(mill);
  await tick();

  const discRoot = new THREE.Group(); root.add(discRoot);
  const pools = [[], []], used = [0, 0];
  const discAt = (owner) => { const p = pools[owner]; if (used[owner] >= p.length) { const d = makeDisc(owner); discRoot.add(d); p.push(d); } return p[used[owner]++]; };
  const ringGeo = new THREE.RingGeometry(0.9, 1, 40); ringGeo.rotateX(-Math.PI / 2);
  const rings = HOLES.map(() => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffe08c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.visible = false; m.position.y = 0.012; root.add(m); return m; });
  const bulbs = room.userData.bulbs ?? [];

  let W = 0, H = 0, blank = false, slow = 0, last = 0, ema = 16;
  function applyTier() {
    const T = TIERS[tier];
    renderer.shadowMap.enabled = T.shadow > 0; key.castShadow = T.shadow > 0;
    if (T.shadow) { key.shadow.mapSize.set(T.shadow, T.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true; });
    W = 0;
  }
  const sz = () => { const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight)), dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr); if (w !== W || h !== H || renderer.getPixelRatio() !== dpr) { W = w; H = h; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); } };
  applyTier(); sz();

  const P = new THREE.Matrix4();
  function project(m) {
    const n = 0.1, f = 60, a = m.a, d = m.d, c0 = (2 * (a * CAM.cx + m.e)) / r3.cw - 1, c1 = 1 - (2 * (d * CAM.yh + m.f)) / r3.ch;
    P.set((2 * a * CAM.f) / r3.cw, 0, -c0, 0, 0, (2 * d * CAM.f) / r3.ch, -c1, 0, 0, 0, -(f + n) / (f - n), (-2 * f * n) / (f - n), 0, 0, -1, 0);
    camera.projectionMatrix.copy(P); camera.projectionMatrixInverse.copy(P).invert();
  }
  function frame() {
    if (!r3.on) return;
    sz();
    if (!r3.drawn) { if (!blank) { renderer.setScissorTest(false); renderer.clear(); blank = true; } return; }
    blank = false;
    const t = r3.t, now = performance.now();
    if (last) { ema = ema * 0.95 + (now - last) * 0.05; if (ema > 30 && tier < TIERS.length - 1) { if (++slow > 90) { tier++; slow = 0; applyTier(); } } else slow = 0; }
    last = now;
    project(r3.m);
    mill.userData.blades.rotation.y = -t * 0.9;
    bulbs.forEach((s, i) => { s.material.opacity = 0.78 + 0.12 * Math.sin(t * 2.3 + i * 1.7) + 0.05 * Math.sin(t * 7.1 + i); });
    warm.intensity = 2.4 + 0.2 * Math.sin(t * 1.3);
    used[0] = used[1] = 0;
    for (const d of r3.discs) { const m = discAt(d.owner); m.visible = true; m.position.set(d.x, d.y, d.z); m.rotation.y = -d.ang; }
    for (let o = 0; o < 2; o++) for (let i = used[o]; i < pools[o].length; i++) pools[o][i].visible = false;
    let g = 0;
    HOLES.forEach((h, i) => { const f = r3.flash && r3.flash[h.id], m = rings[i]; if (f > 0) { m.visible = true; m.scale.setScalar(h.R + 0.02 + (1 - f) * 0.07); m.material.opacity = f; if (h.id === 'mouth') g = f; } else m.visible = false; });
    frogGlow.intensity = g * 1.2;
    const k = window.innerWidth / r3.cw, kv = window.innerHeight / r3.ch, cp = r3.clipPx;
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, window.innerWidth, window.innerHeight); renderer.clear();   // dark outside the stage (letterbox)
    if (cp) renderer.setScissor(Math.max(0, cp.x * k), Math.max(0, window.innerHeight - (cp.y + cp.h) * kv), Math.max(1, cp.w * k), Math.max(1, cp.h * kv));
    renderer.render(scene, camera);
    r3.drawn = false; r3.clipPx = null;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); r3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { blank = false; W = 0; r3.on = true; });
  await tick();
  try { renderer.compile(scene, camera); } catch (e) { console.warn('shader precompile failed', e); }
  return {
    ok: true, canvas, renderer, scene,
    adopt() { r3.on = true; },
    wrap(game) { const r = game.render.bind(game); game.render = (ctx, view) => { r(ctx, view); frame(); }; return game; },
  };
}
