// Thanjavur Dancing Doll 3D presenter. It only READS what the 2D painters record in src/v3.js (never the simulation, never writes back).
// One WebGL canvas sits behind the kit's transparent 2D canvas: the toy-maker's room and the clay dolls are a real lit scene whose
// perspective camera is fitted so the plane the dolls stand on maps 1:1 to the layout's virtual units (the 2D rails, tags, HUD and
// buttons drawn on top line up exactly). Boot is flat 2D; the 3D set is built in slices and crossfaded in. Fallbacks: no WebGL or a
// lost context -> v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the environment map and returns.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { makeDoll, makeGhost, buildSet, blobTexture, glowTexture, WALL_Z } from './models.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 1024 }, { name: 'medium', dpr: 1.5, shadow: 512 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));

export async function createPresenter({ kitCanvas }) {
  const noop = { wrap: (g) => g, ok: false, build: async () => {} };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0;transition:opacity .35s ease';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.setClearColor(0xf4ddb0, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : 0;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 20, 6000);

  const hemi = new THREE.HemisphereLight(0xfff1d6, 0x7a4a2a, 0.45);
  const key = new THREE.DirectionalLight(0xffe2b0, 1.15); key.castShadow = true; key.shadow.bias = -0.0006; key.shadow.normalBias = 1.2; key.shadow.radius = 5;
  const rim = new THREE.DirectionalLight(0xffc880, 0.8);
  scene.add(hemi, key, key.target, rim, rim.target);
  function buildEnvMap() {
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose();
    scene.environment = t; scene.environmentIntensity = 0.3;
  }

  let set = null, ready = false;
  const slots = [], ghosts = [], blobs = [], glows = [];
  let blobTex = null, flatQuad = null;
  const keyOf = (o) => `${o.ch ?? 0}|${o.variant ?? 0}|${o.paint ?? 3}`;

  function ensureSlots(n) {
    while (blobs.length < n) {
      const b = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.9, fog: false }));
      b.rotation.x = -Math.PI / 2; b.renderOrder = 1; scene.add(b); blobs.push(b);
      const gsp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('255,214,90'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
      scene.add(gsp); glows.push(gsp);
      slots.push({ key: '', g: null, plume: 0, plumeV: 0 });
      const gh = makeGhost(); gh.visible = false; scene.add(gh); ghosts.push(gh);
    }
  }
  let builtThisFrame = 0;
  function dollFor(i, o) {
    const s = slots[i], k = keyOf(o);
    if (s.key !== k) {
      if (builtThisFrame >= 1 && s.g) return s;       // spread model builds over frames
      builtThisFrame++;
      if (s.g) { scene.remove(s.g); s.g.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose()); }); }
      s.g = makeDoll(o.ch ?? 0, o.variant ?? 0, o.paint ?? 3); s.key = k; scene.add(s.g);
    }
    return s;
  }

  let W = 0, H = 0, vw = 0, vh = 0, dprNow = 0, laidKey = '';
  function resize(w, h) {
    const cw = window.innerWidth, ch = window.innerHeight, dpr = Math.min(TIERS[tier].dpr, window.devicePixelRatio || 1);
    if (cw !== W || ch !== H || dpr !== dprNow) { W = cw; H = ch; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(cw, ch, false); }
    if (w !== vw || h !== vh) { vw = w; vh = h; camera.aspect = w / h; }
  }
  function applyTier() {
    const sh = TIERS[tier].shadow; renderer.shadowMap.enabled = sh > 0; key.castShadow = sh > 0;
    if (sh > 0) { key.shadow.mapSize.set(sh, sh); key.shadow.map?.dispose(); key.shadow.map = null; }
    W = 0;
    scene.traverse((m) => { if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => { x.needsUpdate = true; }); });
  }

  // ---- doll sprites: a lit 3D render of one doll as a 2D image, for the level grid, result card and Rules figures.
  // Rendered into a corner of the main canvas on black and on white (two-pass matte gives true alpha), copied out, cached.
  const SPW = 224, SPH = 476;
  let spScene = null, spCam = null;
  const spCache = new Map();
  let spBudget = 0;
  const grab = (cv) => { const c = document.createElement('canvas'); c.width = SPW; c.height = SPH; const g = c.getContext('2d', { willReadFrequently: true }); const pr = renderer.getPixelRatio(); g.drawImage(cv, 0, cv.height - SPH, SPW, SPH, 0, 0, SPW, SPH); void pr; return g.getImageData(0, 0, SPW, SPH); };
  function spriteFor(ch, variant, paint) {
    const k = `${ch}|${variant}|${paint}`;
    const hit = spCache.get(k); if (hit) return hit;
    if (!ready || spBudget <= 0 || renderer.domElement.height < SPH || renderer.domElement.width < SPW) return null;
    spBudget--;
    if (!spScene) {
      spScene = new THREE.Scene(); spScene.environment = scene.environment; spScene.environmentIntensity = 0.3;
      spScene.add(new THREE.HemisphereLight(0xfff1d6, 0x7a4a2a, 0.55));
      const kl = new THREE.DirectionalLight(0xffe2b0, 1.5); kl.position.set(-3, 5, 6); spScene.add(kl);
      const rl = new THREE.DirectionalLight(0xffc880, 0.9); rl.position.set(4, 3, -4); spScene.add(rl);
      spCam = new THREE.OrthographicCamera(-1.6, 1.6, 5.7, -1.1, 0.1, 40); spCam.position.set(0, 2.2, 14); spCam.lookAt(0, 2.2, 0);
    }
    const m = makeDoll(ch, variant, paint); spScene.add(m);
    const pr = renderer.getPixelRatio(), sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    renderer.setScissorTest(true); renderer.setViewport(0, 0, SPW / pr, SPH / pr); renderer.setScissor(0, 0, SPW / pr, SPH / pr);
    spScene.background = new THREE.Color(0x000000); renderer.render(spScene, spCam); const onBlack = grab(renderer.domElement);
    spScene.background = new THREE.Color(0xffffff); renderer.render(spScene, spCam); const onWhite = grab(renderer.domElement);
    spScene.background = null; renderer.setScissorTest(false); renderer.setViewport(0, 0, renderer.domElement.width / pr, renderer.domElement.height / pr);
    renderer.shadowMap.enabled = sm;
    spScene.remove(m); m.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((x) => x.dispose()); });
    const c = document.createElement('canvas'); c.width = SPW; c.height = SPH;
    const g = c.getContext('2d'), out = g.createImageData(SPW, SPH), d = out.data, bk = onBlack.data, wh = onWhite.data;
    for (let i = 0; i < d.length; i += 4) {
      // alpha = 1 - (white - black) / 255 per channel (use the mean); colour = black / alpha
      const a = Math.max(0, Math.min(1, 1 - ((wh[i] - bk[i]) + (wh[i + 1] - bk[i + 1]) + (wh[i + 2] - bk[i + 2])) / 765));
      if (a < 0.004) { d[i + 3] = 0; continue; }
      d[i] = Math.min(255, bk[i] / a); d[i + 1] = Math.min(255, bk[i + 1] / a); d[i + 2] = Math.min(255, bk[i + 2] / a); d[i + 3] = a * 255;
    }
    g.putImageData(out, 0, 0);
    spCache.set(k, c);
    return c;
  }
  v3.sprite = (ch, variant, paint) => (v3.on ? spriteFor(ch, variant, paint) : null);

  let clock = 0, lastT = performance.now(), ema = 16, frames = 0;

  function present(view, dt) {
    const w = view?.width ?? 720, h = view?.height ?? 1280;
    resize(w, h);
    const st = v3.stage;
    if (!st) { renderer.render(scene, camera); return; }
    const dolls = v3.dolls.filter((d) => !d.o.ghost), gh = v3.dolls.filter((d) => d.o.ghost);
    const R0 = dolls.length ? dolls[0].R : Math.max(40, st.S.w / 8);
    // camera: the z = 0 plane maps 1:1 to virtual units
    const D = Math.max(w, h) * 1.9;
    camera.fov = (2 * Math.atan(h / (2 * D)) * 180) / Math.PI; camera.far = D + WALL_Z + 1200;
    camera.updateProjectionMatrix();
    const shake = st.shake || 0;
    camera.position.set(w / 2 - shake, -h / 2, D); camera.lookAt(w / 2 - shake, -h / 2, 0);
    const lk = `${Math.round(w)}x${Math.round(h)}|${Math.round(st.S.x)},${Math.round(st.S.y)},${Math.round(st.S.w)},${Math.round(st.S.h)}|${Math.round(st.gy)}|${Math.round(st.fh)}|${Math.round(R0)}`;
    if (lk !== laidKey) { laidKey = lk; set.layout(w, h, D, { S: st.S, gy: st.gy, fh: st.fh, R: R0 }); }
    set.update(clock, clamp(st.lamp || 0, 0, 1) * 0.6 + (v3.scene === 'play' ? 0.0 : 0.15), v3.calm);
    // lights follow the stage
    const cx = st.S.x + st.S.w / 2;
    key.position.set(cx - st.S.w * 0.55, -st.gy + h * 0.55, 900); key.target.position.set(cx, -st.gy + R0, 0);
    const sx = Math.max(st.S.w, h * 0.5) * 0.75;
    Object.assign(key.shadow.camera, { left: -sx, right: sx, top: h * 0.45, bottom: -h * 0.2, near: 100, far: 2600 }); key.shadow.camera.updateProjectionMatrix();
    rim.position.set(cx + st.S.w * 0.5, -st.gy + h * 0.5, -500); rim.target.position.set(cx, -st.gy + R0, 0);

    builtThisFrame = 0;
    ensureSlots(Math.max(3, dolls.length));
    for (let i = 0; i < slots.length; i++) {
      const d = dolls[i], s = slots[i], b = blobs[i], gl = glows[i];
      if (!d) { if (s.g) s.g.visible = false; b.visible = false; gl.material.opacity = 0; continue; }
      const o = d.o, R = d.R;
      dollFor(i, o);
      if (!s.g) { b.visible = false; continue; }
      const th = o.th ?? 0, lag = o.lag ?? 0, torso = o.torso ?? lag * 0.4;
      const U = s.g.userData;
      s.g.visible = true; s.g.scale.setScalar(R);
      const zs = dolls.length > 1 ? (i % 2 ? -0.42 : 0.42) * R : 0;   // staggered rows: dolls pass in front of / behind each other, never through
      s.g.position.set(d.cx + R * th, -(d.gy - R), zs);
      s.g.rotation.z = -th;
      U.torso.rotation.z = -torso;
      U.head.rotation.z = -lag; U.head.rotation.x = clamp(lag * 0.45, -0.35, 0.35);
      // hat plume / bun: a lagging spring on the head's motion (secondary motion)
      const target = -lag * 0.8; s.plumeV += (target - s.plume) * 60 * dt; s.plumeV *= Math.exp(-6 * dt); s.plume += s.plumeV * dt;
      U.plume.rotation.z = clamp(s.plume, -0.5, 0.5);
      const tap = clamp((o.tap ?? 0) * 3, 0, 1);
      U.bodyMat.emissive.setRGB(0.9 * tap, 0.62 * tap, 0.1 * tap); U.bodyMat.emissiveIntensity = tap > 0.01 ? 0.7 : 0;
      // contact shadow follows the contact point and spreads as the doll leans
      b.visible = true; b.position.set(d.cx + R * th, -d.gy + 1.2, zs);
      b.scale.set(R * (2.5 + Math.abs(th) * 1.3), R * 1.2, 1);
      gl.material.opacity = clamp((o.glow ?? 0) * 0.55, 0, 0.7); gl.position.set(d.cx + R * th, -(d.gy - R * 1.6), zs - R * 0.8); gl.scale.setScalar(R * 7.5);
    }
    const gz = dolls.map((_, i) => (dolls.length > 1 ? (i % 2 ? -0.42 : 0.42) * dolls[i].R : 0));
    for (let i = 0; i < ghosts.length; i++) {
      const d = gh[i], g = ghosts[i];
      if (!d) { g.visible = false; continue; }
      const o = d.o, R = d.R, th = o.th ?? 0, lag = o.lag ?? 0;
      g.visible = true; g.scale.setScalar(R * 1.04); g.position.set(d.cx + R * th, -(d.gy - R), gz[i] ?? 0); g.rotation.z = -th;
      g.userData.torso.rotation.z = -lag * 0.4; g.userData.head.rotation.z = -lag;
      const a = clamp(o.alpha ?? 0.5, 0, 1); g.userData.hullMat.opacity = 0.35 + a * 0.6;
    }
    renderer.render(scene, camera);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnvMap(); } catch (err) { /* no reflections, still playable */ }
    applyTier(); W = 0; laidKey = ''; v3.on = ready;
  });

  let building = null;
  async function build() {
    if (building) return building;
    if (qs.has('shot')) canvas.style.transition = 'none';
    building = (async () => {
      try {
        await tick(); buildEnvMap(); applyTier();
        await tick(); blobTex = blobTexture(); flatQuad = new THREE.PlaneGeometry(1, 1);
        set = buildSet(); scene.add(set.group);
        await tick(); ensureSlots(3);
        set.layout(720, 1280, 2400, { S: { x: 0, y: 0, w: 720, h: 1100 }, gy: 900, fh: 120, R: 110 });
        camera.position.set(360, -640, 2400); camera.fov = (2 * Math.atan(1280 / 4800) * 180) / Math.PI; camera.aspect = 720 / 1280; camera.updateProjectionMatrix();
        const probe = makeDoll(0, 0, 3); probe.position.set(360, -800, 0); probe.scale.setScalar(110); scene.add(probe);
        await tick();
        if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
        scene.remove(probe);
        await tick();
        ready = true; v3.on = true; canvas.style.opacity = '1';
      } catch (e) { console.warn('3D build failed; staying on the 2D art', e); v3.on = false; ready = false; canvas.remove(); }
    })();
    return building;
  }
  return {
    ok: true, renderer, scene, camera, build, get ready() { return ready; },
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) { const p = input?.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null; return game.update(dt, input); },
        render(ctx, view) {
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          if (!v3.on) { game.render(ctx, view); return; }
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 120 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          const w = view?.width ?? 720, h = view?.height ?? 1280;
          ctx.clearRect(0, 0, w, h);
          spBudget = 3;
          game.render(ctx, view);
          try { present(view, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
