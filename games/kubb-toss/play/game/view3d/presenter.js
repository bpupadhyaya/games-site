// Kubb 3D presenter (game-owned). It ONLY READS what the 2D layer hands over each frame (scene.js `v3.want`: the live scene -> device transform and the
// scene state S); it never writes to the game. One WebGL canvas sits behind the kit's transparent 2D canvas. The 2D layer keeps every HUD, button, the
// aim rings, paths and labels, the pull handle, input and hit testing; this draws the lit lawn, scenery, blocks, king, batons and thrower stands.
//
// Camera: the SAME pinhole the 2D scene uses (scene.js CAM: 8 m high, 3.5 m behind the near baseline, 50 degrees down, focal F, principal point
// (360, yc) in scene units). The 2D layer passes the live transform, so every ring, path and touch lands exactly where it did.
// Fallbacks: no WebGL / failed import -> not created (the 2D lawn stays); context lost -> v3.on = false (2D lawn), restored -> back.
import * as THREE from '../vendor3d/three.js';
import { v3, CAM, poseOf } from '../src/scene.js';
import { matOf, KUBB, KING, BATON } from '../src/phys.js';
import { tossPose } from '../src/view.js';
import { buildYard, makePieceKit, makeKingCrown, makeBaton, makeStand, envScene, SUN_DIR, cvs, tex } from './yard.js';

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
  catch (e) { console.warn('WebGL unavailable; 2D lawn kept', e); return noop; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x0a120a, 1);
  renderer.autoClear = false;
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));

  // ------------------------------------------------------------ scene and light: a long evening on the lawn
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfd3a6, 17, 52);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 200);
  const hemi = new THREE.HemisphereLight(0xfff0d0, 0x4f7a3a, 0.7);
  const key = new THREE.DirectionalLight(0xffe2ae, 2.5);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0xb6c8ff, 0.35); fill.position.set(3, 4, 6);
  scene.add(hemi, key, key.target, fill);
  function buildEnv() {
    const pm = new THREE.PMREMGenerator(renderer);
    if (scene.environment && scene.environment.dispose) { try { scene.environment.dispose(); } catch { /* lost */ } }
    scene.environment = pm.fromScene(envScene(), 0.02).texture;
    scene.environmentIntensity = 0.5;
    pm.dispose();
  }
  const nap = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const yard = await buildYard(TIERS[tier].name, nap);
  scene.add(yard.root);

  // ------------------------------------------------------------ pieces (index pools per kind and team)
  const kit = makePieceKit();
  const blobTex = tex(cvs(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.5, 'rgba(0,0,0,0.5)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }));
  const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  const mkBlob = () => { const b = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: 0x0c2a10, opacity: 0.4 })); b.renderOrder = 2; b.visible = false; scene.add(b); return b; };
  const pools = { kubb0: [], kubb1: [], baton0: [], baton1: [], fade: [], king: [], stand0: [], stand1: [] };
  const entry = (name, i, make) => pools[name][i] || (pools[name][i] = make());
  const mkKubb = (t) => () => { const m = new THREE.Mesh(kit.kubb[t].geo, kit.kubb[t].mats); m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); return { o: m, blob: mkBlob() }; };
  const mkFade = () => { const mats = kit.kubb[0].mats.map((x) => x.clone()); mats.forEach((x) => { x.transparent = true; }); const m = new THREE.Mesh(kit.kubb[0].geo, mats); m.matrixAutoUpdate = false; scene.add(m); return { o: m, blob: mkBlob(), team: 0 }; };
  const mkKing = () => { const m = new THREE.Mesh(kit.king.geo, kit.king.mats); m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; m.add(makeKingCrown(kit)); scene.add(m); return { o: m, blob: mkBlob() }; };
  const mkBat = (t) => () => { const g = makeBaton(kit, t); g.matrixAutoUpdate = false; g.children.forEach((c) => { c.matrixAutoUpdate = true; }); scene.add(g); return { o: g, blob: mkBlob() }; };
  const mkStand = (t) => () => { const g = makeStand(kit, t); scene.add(g); return { o: g }; };
  const mm = new THREE.Matrix4(), bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3(), ps = new THREE.Vector3();
  const T = (R, c, out) => out.set(R[c], R[6 + c], -R[3 + c]);   // a sim local axis (matrix column c) as a three vector: (x, z, -y)
  // sim pose -> three matrix. kind: 'box' (sim local z is the long axis, three Y) or 'baton' (sim local x is the axis, three Y)
  function place(en, kind, p, q, scale) {
    const R = matOf(q);
    if (kind === 'box') { T(R, 0, bx); T(R, 2, by); T(R, 1, bz).negate(); } else { T(R, 1, bx); T(R, 0, by); T(R, 2, bz).negate(); }
    mm.makeBasis(bx, by, bz); mm.setPosition(p[0], p[2], -p[1]);
    en.o.matrix.copy(mm); en.o.matrixWorldNeedsUpdate = true; en.o.visible = true;
    return mm;
  }
  function blobAt(en, p, w, h) {
    const lift = Math.max(0, p[2] - h), s = w * 2.2 * (1 + lift * 0.4);
    en.blob.visible = tier === TIERS.length - 1; if (!en.blob.visible) return;
    en.blob.position.set(p[0] + 0.05 + lift * 0.15, 0.006, -(p[1] + 0.07 + lift * 0.2)); en.blob.scale.set(s, 1, s * 1.1); en.blob.material.opacity = clamp(0.5 - lift * 0.14, 0.1, 0.5);
  }
  const used = {};
  const take = (name, make) => { const i = used[name] = (used[name] || 0) + 1; return entry(name, i - 1, make); };
  function syncScene(S) {
    for (const k of Object.keys(used)) used[k] = 0;
    const w = S && S.world;
    if (w) for (const b of w.bodies) {
      const ps_ = poseOf(b, S.alpha);
      if (b.kind === 'baton') { const en = take('baton' + (b.team === 1 ? 1 : 0), mkBat(b.team === 1 ? 1 : 0)); place(en, 'baton', ps_.p, ps_.q); blobAt(en, ps_.p, BATON.r * 3, BATON.r); }
      else if (b.kind === 'king') { const en = take('king', mkKing); place(en, 'box', ps_.p, ps_.q); blobAt(en, ps_.p, KING.w, KING.h / 2); }
      else { const t = b.team === 1 ? 1 : 0, en = take('kubb' + t, mkKubb(t)); place(en, 'box', ps_.p, ps_.q); blobAt(en, ps_.p, KUBB.w, KUBB.h / 2); }
    }
    if (S) for (const f of S.fades || []) {
      const en = take('fade', mkFade), t = f.team === 1 ? 1 : 0; if (en.team !== t) { en.team = t; en.o.material = kit.kubb[t].mats.map((x) => { const c = x.clone(); c.transparent = true; return c; }); }
      const a = clamp(1 - f.t / 0.6, 0, 1); en.o.material.forEach((x) => { x.opacity = a; }); en.o.castShadow = false; place(en, 'box', f.p, f.q); en.blob.visible = false;
    }
    if (S && S.tossAnim) {
      const a = S.tossAnim, ps_ = tossPose(a, S.alpha), t = a.team === 1 ? 1 : 0, en = take('kubb' + t, mkKubb(t));
      place(en, 'box', ps_.p, ps_.q); blobAt(en, ps_.p, KUBB.w, KUBB.h / 2);
    }
    const stands = new Set();
    if (S && S.showPaddles) for (const pd of S.paddles || []) {
      const t = pd.team === 1 ? 1 : 0, en = take('stand' + t, mkStand(t)), g = en.o; stands.add(g);
      const sc = pd.scale ?? 1; g.visible = true; g.position.set(pd.x, 0, -pd.y); g.scale.setScalar(sc);
      g.userData.tilt.rotation.z = -(pd.lean * 0.4 + 0.08); g.userData.tilt.visible = !!pd.held;
    }
    for (const [name, list] of Object.entries(pools)) for (let i = used[name] || 0; i < list.length; i++) { list[i].o.visible = false; if (list[i].blob) list[i].blob.visible = false; }
  }

  // ------------------------------------------------------------ camera: the 2D pinhole through the live transform
  let W = 0, H = 0, dprNow = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  const sinP = Math.sin(CAM.pitch), cosP = Math.cos(CAM.pitch);
  function setPose(want) {
    const m = want.m, kr = kitCanvas.getBoundingClientRect(), r = kr.width / Math.max(1, kitCanvas.width);
    const k = CAM.F * m.a * r, ox = (360 * m.a + m.e) * r + kr.left, oy = (CAM.yc * m.d + m.f) * r + kr.top;
    camera.position.set(0, CAM.ch, CAM.cb); camera.up.set(0, 1, 0); camera.lookAt(0, CAM.ch - sinP * 10, CAM.cb - cosP * 10); camera.updateMatrixWorld(true);
    const n = 0.5, fa = 200;
    camera.projectionMatrix.set(
      (2 * k) / W, 0, -(2 * ox / W - 1), 0,
      0, (2 * k) / H, -(1 - 2 * oy / H), 0,
      0, 0, -(fa + n) / (fa - n), -(2 * fa * n) / (fa - n),
      0, 0, -1, 0,
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    return { r, kr };
  }

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
    const want = v3.want; v3.want = null;
    if (lost) return;
    if (!want) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    resize();
    const now = performance.now(), raw = Math.max(0, (now - lastNow) / 1000), dt = Math.min(0.1, raw); lastNow = now;
    ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
    if (frames > 90 && ema > 32 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
    if (raw > 0.3 && frames > 2 && tier < TIERS.length - 1 && ++slow >= 2) { tier = TIERS.length - 1; applyTier(); frames = 0; slow = 0; }
    clock += dt;
    syncScene(want.S);
    const { r, kr } = setPose(want);
    shT.set(0, 0, -3.2);
    key.target.position.copy(shT); key.position.copy(shT).addScaledVector(SUN_DIR, 30); key.target.updateMatrixWorld();
    Object.assign(key.shadow.camera, { left: -4.6, right: 4.6, top: 6.2, bottom: -6.2, near: 5, far: 70 }); key.shadow.camera.updateProjectionMatrix();
    renderer.setScissorTest(false); renderer.clear();
    if (want.clip) { const c = want.clip; renderer.setScissorTest(true); renderer.setScissor(c.x * r + kr.left, H - (c.y + c.h) * r - kr.top, c.w * r, c.h * r); }
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    if (first) { first = false; canvas.style.opacity = '1'; }
    if (v3.on && v3.mix < 1) v3.mix = Math.min(1, v3.mix + Math.max(dt, 1 / 60) / 0.45);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.mix = 0; canvas.style.opacity = '0'; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnv(); } catch { /* still playable without reflections */ }
    lost = false; W = 0; first = true; v3.on = true; v3.mix = 0;
  });

  try {
    await nap(); buildEnv(); applyTier();
    await nap();
    const warm = [entry('kubb0', 0, mkKubb(0)), entry('kubb1', 0, mkKubb(1)), entry('king', 0, mkKing), entry('baton0', 0, mkBat(0)), entry('baton1', 0, mkBat(1)), entry('stand0', 0, mkStand(0)), entry('stand1', 0, mkStand(1))];
    for (const w of warm) { w.o.visible = true; if (w.o.matrixAutoUpdate === false) w.o.matrix.identity(); }
    camera.position.set(0, CAM.ch, CAM.cb); camera.lookAt(0, 0, -4); camera.updateMatrixWorld(true);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    for (const w of warm) w.o.visible = false;
    await nap();
  } catch (e) { console.warn('3D init failed; 2D lawn kept', e); return noop; }
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
