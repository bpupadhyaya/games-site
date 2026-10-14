// Kantha Running Stitch Quilt: 3D presenter. It only READS the game state; view.js describes the scene each frame (v3.frame) and this
// file turns the description into a lit WebGL scene behind the transparent kit canvas. The play camera is the SAME pure function the
// layout uses for input and the 2D overlays (src/v3.js clothCamera), so taps, colour marks, the cost chip and sparks land on the 3D cloth.
// No WebGL, or a lost context -> v3.on = false and the flat art draws; a restored context brings the scene back without a reload.
import * as THREE from '../vendor3d/three.js';
import { v3, clothCamera, cameraFromParams, parOf, UNIT } from '../src/v3.js';
import { createClothView } from './clothview.js';
import { buildFloor, buildSpool, setSpoolWound, buildScissors, buildThimble, buildThreadBox, buildPetals } from './props.js';
import { createNeedleHand } from './hand.js';
import { texOf, glowCanvas, clamp, lerp, hash } from './tex.js';

const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, q: 2 }, { name: 'medium', dpr: 1.5, shadow: 1024, q: 1 }, { name: 'low', dpr: 1, shadow: 0, q: 0 }];
const D2R = Math.PI / 180;

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x1a0d06, 1);
  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')) | 0, 0, TIERS.length - 1);

  // ---- the scene ----------------------------------------------------------------------------------------------------------------------
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1c0f07, 1.5, 3.6);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 8);
  const view = createClothView({ tier: TIERS[tier].q, size: 10, withNeedle: true });
  scene.add(view.group);
  const floor = buildFloor(TIERS[tier].q); scene.add(floor);

  const hemi = new THREE.HemisphereLight(0xfff0dc, 0x3a2112, 0.7);
  const key = new THREE.DirectionalLight(0xffe2b4, 2.1);
  const KEY = new THREE.Vector3(-0.66, 0.54, 0.4);
  key.position.copy(KEY); key.target.position.set(0, 0, 0);
  key.castShadow = true; Object.assign(key.shadow.camera, { left: -0.42, right: 0.42, top: 0.42, bottom: -0.42, near: 0.2, far: 2.6 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.0012; key.shadow.radius = 3;
  const rim = new THREE.DirectionalLight(0x9fd0ff, 0.8); rim.position.set(0.5, 0.45, -0.7);
  const fill = new THREE.DirectionalLight(0xffc89a, 0.5); fill.position.set(0.6, 0.35, 0.8);
  scene.add(hemi, key, key.target, rim, fill);

  // an invisible window frame between the lamp and the cloth: it only casts its shadow (soft bars falling on the corners)
  const occ = new THREE.Group();
  {
    const mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.01), mat); m.position.set(x, y, 0); m.castShadow = true; occ.add(m); };
    bar(0.04, 1.2, -0.4, 0); bar(1.2, 0.04, 0, 0.4);
    occ.position.copy(KEY).normalize().multiplyScalar(0.62); occ.lookAt(0, 0, 0);
    scene.add(occ);
  }

  // table props (visible on the menus and the result: the spool is where the working thread comes from)
  const props = new THREE.Group(); scene.add(props);
  const spool = buildSpool('#b52a2c', { h: 0.04, r: 0.0125 }); spool.position.set(0.23, -0.0105, -0.27); spool.rotation.z = 0; props.add(spool);
  const scissors = buildScissors(); scissors.position.set(0.3, -0.0098, 0.16); scissors.rotation.y = 0.5; props.add(scissors);
  const thimble = buildThimble(); thimble.position.set(-0.25, -0.0105, 0.22); props.add(thimble);
  const box = buildThreadBox(); box.position.set(-0.3, -0.0105, -0.2); box.rotation.y = -0.25; props.add(box);
  const petals = buildPetals(16, 5); petals.position.set(0.05, -0.0095, 0.3); props.add(petals);
  const petals2 = buildPetals(10, 9); petals2.position.set(-0.18, -0.0095, -0.3); props.add(petals2);

  // dust motes in the lamp light
  const NM = 28, mp = new Float32Array(NM * 3), mphase = new Float32Array(NM);
  for (let i = 0; i < NM; i++) { mp[i * 3] = (hash(i, 1) - 0.5) * 0.7; mp[i * 3 + 1] = hash(i, 2) * 0.3 + 0.02; mp[i * 3 + 2] = (hash(i, 3) - 0.5) * 0.7; mphase[i] = hash(i, 4) * 6.28; }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: texOf(glowCanvas(32, [255, 236, 190]), { wrap: false }), size: 0.01, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }));
  motes.frustumCulled = false; scene.add(motes);

  let hand = null, showMotes = false;
  if (!qs.has('nohand')) createNeedleHand(scene).then((h) => { hand = h; applyTier(); }).catch((e) => console.warn('hand unavailable', e));

  // ---- environment map ------------------------------------------------------------------------------------------------------------------
  function buildEnv() {
    const pm = new THREE.PMREMGenerator(renderer);
    const tex = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    pm.dispose(); scene.environment = tex; scene.environmentIntensity = 0.45;
    if (bakeScene) { bakeScene.environment = tex; bakeScene.environmentIntensity = 0.45; }
    if (spoolScene) { spoolScene.environment = tex; spoolScene.environmentIntensity = 0.6; }
  }

  // ---- size / tiers -------------------------------------------------------------------------------------------------------------------------
  let W = 1, H = 1, dprNow = 1, LW = 720, LH = 1280;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    if (hand) hand.setShadow(t.shadow > 0);
    motes.visible = t.q > 0 && showMotes;
    W = 0;
    scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
  }

  // ---- camera ---------------------------------------------------------------------------------------------------------------------------
  function applyCamera(c) {
    const p = parOf(c);
    const cc = cameraFromParams(p, LW, LH);
    camera.position.set(cc.C[0], cc.C[1], cc.C[2]);
    camera.up.set(0, 1, 0); camera.lookAt(p.T[0], p.T[1], p.T[2]);
    camera.fov = (p.fov * 180) / Math.PI; camera.aspect = cc.aspect; camera.near = 0.05; camera.far = 8;
    camera.updateProjectionMatrix();
    const e = camera.projectionMatrix.elements;   // NDC' = s * NDC + o
    e[0] *= cc.s; e[4] *= cc.s; e[8] = e[8] * cc.s - cc.ox; e[12] *= cc.s;
    e[1] *= cc.s; e[5] *= cc.s; e[9] = e[9] * cc.s - cc.oy; e[13] *= cc.s;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  // ---- the gauge spool (a small lit scene drawn into the HUD gauge rectangle) -----------------------------------------------------------
  const spoolScene = new THREE.Scene();
  spoolScene.background = new THREE.Color(0x2b160a);
  const spoolCam = new THREE.PerspectiveCamera(24, 1, 0.02, 2);
  const gSpool = buildSpool('#b52a2c', { h: 0.05, r: 0.016 });
  {
    spoolScene.add(new THREE.HemisphereLight(0xfff0dc, 0x3a2112, 1.0));
    const kl = new THREE.DirectionalLight(0xffe2b4, 2.6); kl.position.set(-0.4, 0.7, 0.5); spoolScene.add(kl);
    const rl = new THREE.DirectionalLight(0x9fd0ff, 0.8); rl.position.set(0.5, 0.3, -0.5); spoolScene.add(rl);
    gSpool.rotation.z = 0.5; spoolScene.add(gSpool);
  }
  let spoolSpin = 0, lastFrac = 1, spoolSlot = -1;
  function renderSpool(g, T, dt) {
    if (!g) return;
    if (spoolSlot !== g.slot || gSpool.userData.T !== T) { gSpool.userData.mat.color.set(T.thread[g.slot % T.thread.length]); spoolSlot = g.slot; gSpool.userData.T = T; }
    setSpoolWound(gSpool, g.frac);
    spoolSpin += (lastFrac - g.frac) * 14; lastFrac = g.frac;
    gSpool.rotation.y = 0.6 + spoolSpin + Math.sin(clock * 0.5) * 0.04;
    const sx = W / LW, sy = H / LH;
    const x = Math.round(g.x * sx), y = Math.round((LH - g.y - g.h) * sy), w = Math.max(1, Math.round(g.w * sx)), h = Math.max(1, Math.round(g.h * sy));
    spoolCam.aspect = w / h; spoolCam.updateProjectionMatrix();
    const d = 0.2 / Math.min(1, spoolCam.aspect);
    spoolCam.position.set(0, 0.025 + 0.08 * d / 0.2, 0.17 * d / 0.2 * 1.2); spoolCam.lookAt(0, 0.022, 0);
    renderer.setScissorTest(true); renderer.setScissor(x, y, w, h); renderer.setViewport(x, y, w, h);
    renderer.render(spoolScene, spoolCam);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
    void dt;
  }

  // ---- baked sprites for the flat screens: figures on the text pages, quilt tiles ------------------------------------------------------
  let bakeScene = null, bakeView = null, bakeFloor = null, bakeCam = null;
  const baked = new Map(), queue = [], queued = new Set();
  function ensureBake() {
    if (bakeScene) return;
    bakeScene = new THREE.Scene();
    bakeView = createClothView({ tier: 0, size: 10, withNeedle: true });
    bakeScene.add(bakeView.group);
    bakeFloor = buildFloor(0); bakeScene.add(bakeFloor);
    const hl = new THREE.HemisphereLight(0xfff0dc, 0x3a2112, 1.0);
    const kl = new THREE.DirectionalLight(0xffe2b4, 2.6); kl.position.set(-0.42, 0.78, 0.38);
    const rl = new THREE.DirectionalLight(0xffc89a, 0.6); rl.position.set(0.6, 0.35, 0.8);
    bakeScene.add(hl, kl, rl);
    bakeCam = new THREE.PerspectiveCamera(28, 1, 0.05, 8);
    bakeScene.environment = scene.environment; bakeScene.environmentIntensity = 0.45;
  }
  v3.bake = (key, frameFn, size = 256) => {
    const hit = baked.get(key);
    if (hit) return hit;
    if (!queued.has(key)) { queued.add(key); queue.push({ key, frameFn, size }); }
    return null;
  };
  function runBake() {
    const job = queue.shift();
    if (!job) return;
    queued.delete(job.key);
    try {
      ensureBake();
      const S = job.size, fr = job.frameFn();
      const cam = clothCamera(fr.rect, fr.size, S, S, { pitch: 60 * D2R });
      const p = parOf(cam), cc = cameraFromParams(p, S, S);
      bakeCam.position.set(cc.C[0], cc.C[1], cc.C[2]); bakeCam.up.set(0, 1, 0); bakeCam.lookAt(p.T[0], p.T[1], p.T[2]);
      bakeCam.fov = (p.fov * 180) / Math.PI; bakeCam.aspect = 1; bakeCam.updateProjectionMatrix();
      const e = bakeCam.projectionMatrix.elements;
      e[0] *= cc.s; e[4] *= cc.s; e[8] = e[8] * cc.s - cc.ox; e[12] *= cc.s;
      e[1] *= cc.s; e[5] *= cc.s; e[9] = e[9] * cc.s - cc.oy; e[13] *= cc.s;
      bakeCam.projectionMatrixInverse.copy(bakeCam.projectionMatrix).invert();
      bakeView.apply(fr, 0.05, 0); bakeView.cloth.settle(); bakeView.apply(fr, 0.05, 0);
      const pr = renderer.getPixelRatio();
      renderer.setPixelRatio(1);
      renderer.setScissorTest(true); renderer.setScissor(0, 0, S, S); renderer.setViewport(0, 0, S, S);
      const prevShadow = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
      renderer.clear(true, true, true);
      renderer.render(bakeScene, bakeCam);
      renderer.shadowMap.enabled = prevShadow;
      const out = document.createElement('canvas'); out.width = out.height = S;
      const src = renderer.domElement;
      out.getContext('2d').drawImage(src, 0, src.height - S, S, S, 0, 0, S, S);
      renderer.setScissorTest(false);
      renderer.setPixelRatio(pr); W = 0;
      baked.set(job.key, out);
    } catch (e) { console.warn('bake failed', e); baked.set(job.key, null); }
  }

  // ---- state ------------------------------------------------------------------------------------------------------------------------------
  let clock = 0, lastT = 0, frames = 0, ema = 16, inited = false;
  const dirV = new THREE.Vector3(0.6, 0, 0.8), dWant = new THREE.Vector3(), gripV = new THREE.Vector3(), backH = new THREE.Vector3();
  const handDir = { v: new THREE.Vector3(0.6, 0, 0.8) };

  function present(game, view_, dt) {
    const fr = v3.frame;
    LW = view_?.width ?? 720; LH = view_?.height ?? 1280;
    resize();
    if (!fr) return;
    const T = fr.T;
    // camera: the layout's own cloth camera (play, result); the menus drift slowly and look from a lower angle
    let opt = {};
    if (fr.hero) opt = { pitch: 46 * D2R, yaw: fr.calm ? 0 : Math.sin(clock * 0.2) * 0.1 };
    else if (fr.backdrop) opt = { pitch: 52 * D2R, yaw: Math.sin(clock * 0.1) * 0.08 };
    const cam = clothCamera(fr.rect, fr.size, LW, LH, opt);
    applyCamera(cam);
    props.visible = !!fr.props || !!fr.hero;
    showMotes = props.visible; motes.visible = showMotes && TIERS[tier].q > 0;
    if (props.visible) {
      // the working thread comes from the spool on the table
      spool.userData.mat.color.set(T.thread[(view.out.slot ?? 0) % T.thread.length]);
      setSpoolWound(spool, 0.55);
    }
    // floor tint follows the look (cool for indigo, warm for ivory)
    floor.visible = true;
    const out = view.apply(fr, dt, clock);
    // motes drift upward
    if (motes.visible) {
      const a = moteGeo.attributes.position;
      for (let i = 0; i < NM; i++) {
        a.array[i * 3 + 1] += dt * (0.004 + 0.004 * Math.sin(mphase[i] + clock)); if (a.array[i * 3 + 1] > 0.3) a.array[i * 3 + 1] = 0.02;
        a.array[i * 3] += Math.sin(clock * 0.4 + mphase[i]) * dt * 0.004;
      }
      a.needsUpdate = true;
    }
    // hand: order is stage/human update first (inside hand.update), then props are read from the posed bones
    if (hand) {
      const nd = out.needle, want = !!(nd && fr.hand && !fr.done);
      if (want || hand.shown > 0.01) {
        const n = view.nstate;
        backH.copy(n.dir).setY(0); if (backH.lengthSq() < 1e-6) backH.set(0.6, 0, 0.8); backH.normalize();
        dWant.copy(backH).multiplyScalar(0.55).add(tmpBias).normalize();
        handDir.v.lerp(dWant, 1 - Math.exp(-dt * 5)).normalize();
        gripV.copy(n.tip).addScaledVector(n.dir, 0.032);
        const wig = Math.sin(clock * 9) * 0.5;
        hand.update(gripV, handDir.v, want, dt, wig);
      }
    }
    // live frame
    renderer.setViewport(0, 0, W, H);
    renderer.setScissorTest(false);
    runBake();   // may borrow a corner of the canvas; the main frame is drawn after it
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    if (v3.gauge) renderSpool(v3.gauge, T, dt);
    inited = true;
  }
  const tmpBias = new THREE.Vector3(0.75, 0, 0.66);

  // ---- context loss ------------------------------------------------------------------------------------------------------------------------
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnv(); } catch { /* reflections only */ }
    baked.clear(); queue.length = 0; queued.clear();
    W = 0; applyTier(); resize(); v3.on = true;
  });

  try { buildEnv(); applyTier(); resize(); } catch (e) { console.warn('3D init failed; flat fallback', e); canvas.remove(); v3.on = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, view,
    get hand() { return hand; },
    get tier() { return tier; },
    setTier(t) { tier = clamp(t, 0, 2); applyTier(); },
    wrap(game) {
      return Object.assign({}, game, {
        render(ctx, view_) {
          if (!v3.on) { game.render(ctx, view_); return; }
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt; v3.t = clock;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          game.render(ctx, view_);
          try { present(game, view_, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
