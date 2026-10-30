// Cornhole 3D presenter (game-owned). It ONLY READS what the 2D layer hands over each frame (scene.js `v3`); it never writes to the game.
// One WebGL canvas sits behind the kit's transparent 2D canvas. The 2D layer keeps every HUD, the mini board, the aim arcs, the landing
// rings, the pull handle, input and hit testing; this draws the lit backyard, the board and the bags with their shadows.
//
// Camera: the SAME pinhole the 2D scene uses (scene.js proj: eye 2.5 m high, 8.5 m behind the throwing line, no tilt, focal F, principal
// point (360, YH) in scene units). The 2D layer passes the live scene -> device transform, so every arc, ring and touch lands exactly where
// it did. Fallbacks: no WebGL / failed import -> not created (the 2D yard stays); context lost -> v3.on = false (2D yard), restored -> back.
import * as THREE from '../vendor3d/three.js';
import { v3, bagPose, frameFree, blendFrame } from '../src/scene.js';
import { BAG_HALF, BOARD_W, BOARD_L, BOARD_Z0, COS_A, surfaceH } from '../src/phys.js';
import { buildYard, makeBagKit, envScene, SUN_DIR, cvs, tex } from './yard.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048 },
  { name: 'medium', dpr: 1.5, shadow: 1024 },
  { name: 'low', dpr: 1, shadow: 0 },
];

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { ok: false };
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { console.warn('WebGL unavailable; 2D yard kept', e); return noop; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x0b1408, 1);
  renderer.autoClear = false;

  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));

  // ------------------------------------------------------------ scene and light: a backyard at golden hour
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf0d6a8, 40, 150);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  const hemi = new THREE.HemisphereLight(0xffe6c4, 0x5f7a3a, 0.62);
  const key = new THREE.DirectionalLight(0xffd29a, 2.7);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0xaebfff, 0.4); fill.position.set(3, 4, 6);
  scene.add(hemi, key, key.target, fill);
  function buildEnv() {
    const pm = new THREE.PMREMGenerator(renderer);
    if (scene.environment && scene.environment.dispose) { try { scene.environment.dispose(); } catch { /* lost */ } }
    scene.environment = pm.fromScene(envScene(), 0.02).texture;
    scene.environmentIntensity = 0.55;
    pm.dispose();
  }
  const nap = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const yard = await buildYard(TIERS[tier].name, nap);
  scene.add(yard.root);

  // ------------------------------------------------------------ bags (an index pool: bag i of this frame uses mesh i)
  const kit = makeBagKit();
  const blobTex = tex(cvs(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.5, 'rgba(0,0,0,0.5)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }));
  const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  const pool = [];
  function entry(i) {
    if (pool[i]) return pool[i];
    const mesh = new THREE.Mesh(kit.geo, kit.mats[0]); mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    const blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: 0x120a04, opacity: 0.4 })); blob.renderOrder = 2;
    scene.add(mesh, blob); return (pool[i] = { mesh, blob, side: 0 });
  }
  const e1 = new THREE.Vector3(), nn = new THREE.Vector3(), e2 = new THREE.Vector3(), mm = new THREE.Matrix4(), sc = new THREE.Matrix4();
  function placeBag(en, b) {
    let pose = bagPose(b);
    if (b.lf && b.sq > 0 && b.st !== 'free') pose = { ...pose, fr: blendFrame(pose.fr, frameFree(b.lf.yaw, b.lf.pitch), clamp(b.sq, 0, 1) ** 2) };
    const fr = pose.fr, sq = clamp(b.sq || 0, 0, 1);
    let c = pose.c.slice(), k = 1 + 0.1 * sq, th = 1 - 0.55 * sq;
    if (b.st === 'board' || b.st === 'hole' || b.st === 'ground') c = [c[0] + fr.n[0] * pose.lift, c[1] + fr.n[1] * pose.lift, c[2] + fr.n[2] * pose.lift];
    if (b.st === 'hole') {
      const f = clamp(b.fall || 0, 0, 1);
      if (f >= 1) { en.mesh.visible = false; en.blob.visible = false; return; }
      const drop = clamp((f - 0.15) / 0.85, 0, 1);
      k *= 1 - 0.45 * drop; c = [c[0], c[1] - 0.16 * drop * drop - 0.02 * f, c[2]]; th *= 1 + 0.35 * f;
    }
    en.mesh.visible = true;
    if (en.side !== b.side) { en.side = b.side; en.mesh.material = kit.mats[b.side === 1 ? 1 : 0]; }
    // sim (x, y, z) -> three (x, y, -z); the flip makes the frame left-handed, so e2 is negated to keep the matrix a proper rotation
    e1.set(fr.e1[0], fr.e1[1], -fr.e1[2]); nn.set(fr.n[0], fr.n[1], -fr.n[2]); e2.set(-fr.e2[0], -fr.e2[1], fr.e2[2]);
    mm.makeBasis(e1, nn, e2); mm.setPosition(c[0], c[1], -c[2]);
    sc.makeScale(k, th, k); mm.multiply(sc);
    en.mesh.matrix.copy(mm); en.mesh.matrixWorldNeedsUpdate = true;
    // soft contact shadow on whatever is below: the board if over it, else the lawn
    const over = Math.abs(c[0]) < BOARD_W / 2 && c[2] > BOARD_Z0 && c[2] < BOARD_Z0 + BOARD_L * COS_A, gy = over ? surfaceH(c[2]) : 0, h = Math.max(0, c[1] - gy - 0.02);
    const s = BAG_HALF * 2.1 * (1 + h * 0.5);
    en.blob.visible = b.st !== 'hole';
    en.blob.position.set(c[0] + 0.01 + h * 0.12, gy + 0.004, -(c[2] + 0.01 + h * 0.06)); en.blob.scale.set(s, 1, s);
    en.blob.material.opacity = clamp(0.5 - h * 0.12, 0.1, 0.5);
  }
  function syncBags(list) {
    let n = 0;
    if (list) for (const b of list) { if (b.st === 'rack') continue; placeBag(entry(n), b); n++; }
    for (let i = n; i < pool.length; i++) { pool[i].mesh.visible = false; pool[i].blob.visible = false; }
  }

  // ------------------------------------------------------------ camera: the 2D pinhole through the live transform
  let W = 0, H = 0, dprNow = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  function setPose(want) {
    const m = want.m, cam = want.cam, kr = kitCanvas.getBoundingClientRect(), r = kr.width / Math.max(1, kitCanvas.width);
    const k = cam.F * m.a * r, ox = (360 * m.a + m.e) * r + kr.left, oy = (cam.YH * m.d + m.f) * r + kr.top;
    camera.position.set(cam.x, cam.Hc, cam.D0); camera.up.set(0, 1, 0); camera.lookAt(cam.x, cam.Hc, cam.D0 - 10); camera.updateMatrixWorld(true);
    const n = 0.1, fa = 500;
    camera.projectionMatrix.set(
      (2 * k) / W, 0, -(2 * ox / W - 1), 0,
      0, (2 * k) / H, -(1 - 2 * oy / H), 0,
      0, 0, -(fa + n) / (fa - n), -(2 * fa * n) / (fa - n),
      0, 0, -1, 0,
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    return { r, kr };
  }

  // ------------------------------------------------------------ quality
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
  }

  // ------------------------------------------------------------ one frame
  let clock = 0, lastNow = performance.now(), ema = 16, frames = 0, slow = 0, lost = false, first = true;
  const shT = new THREE.Vector3();
  function frame() {
    const want = v3.want, bags = v3.bags; v3.want = null; v3.bags = null;
    if (lost) return;
    if (!want) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    resize();
    const now = performance.now(), raw = Math.max(0, (now - lastNow) / 1000), dt = Math.min(0.1, raw); lastNow = now;
    ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
    if (frames > 90 && ema > 32 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
    if (raw > 0.3 && frames > 2 && tier < TIERS.length - 1 && ++slow >= 2) { tier = TIERS.length - 1; applyTier(); frames = 0; slow = 0; }
    clock += dt;
    for (const s of yard.sway) { s.obj.rotation.z = Math.sin(clock * 0.6 + s.ph) * s.amp; s.obj.rotation.x = Math.cos(clock * 0.5 + s.ph) * s.amp * 0.6; }
    for (const g of yard.glows) g.pose(clock);
    syncBags(bags);
    const { r, kr } = setPose(want);
    // the sun: shadows fitted to the lane and the board
    shT.set(0, 0.1, -9.3);
    key.target.position.copy(shT); key.position.copy(shT).addScaledVector(SUN_DIR, 30); key.target.updateMatrixWorld();
    Object.assign(key.shadow.camera, { left: -4.5, right: 4.5, top: 7.5, bottom: -7.5, near: 5, far: 70 }); key.shadow.camera.updateProjectionMatrix();
    renderer.setScissorTest(false); renderer.clear();
    if (want.clip) { const c = want.clip; renderer.setScissorTest(true); renderer.setScissor(c.x * r + kr.left, H - (c.y + c.h) * r - kr.top, c.w * r, c.h * r); }
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    if (first) { first = false; canvas.style.opacity = '1'; }
    if (v3.on && v3.mix < 1) v3.mix = Math.min(1, v3.mix + Math.max(dt, 1 / 60) / 0.45);
  }

  // ------------------------------------------------------------ context loss
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.mix = 0; canvas.style.opacity = '0'; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnv(); } catch { /* still playable without reflections */ }
    lost = false; W = 0; first = true; v3.on = true; v3.mix = 0;
  });

  try {
    await nap(); buildEnv(); applyTier();
    await nap();
    const warm = entry(0); warm.mesh.visible = true; warm.mesh.matrix.identity();
    camera.position.set(0, 2.5, 8.5); camera.lookAt(0, 2, -9); camera.updateMatrixWorld(true);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    warm.mesh.visible = false;
    await nap();
  } catch (e) { console.warn('3D init failed; 2D yard kept', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  v3.on = true; v3.mix = 0;

  return {
    ok: true, frame,
    get tier() { return tier; },
    setTier(t) { tier = clamp(t, 0, TIERS.length - 1); applyTier(); },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); if (ext) { ext.loseContext(); setTimeout(() => ext.restoreContext(), 600); } return !!ext; },
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, tier: TIERS[tier].name, mix: v3.mix, on: v3.on }),
  };
}
