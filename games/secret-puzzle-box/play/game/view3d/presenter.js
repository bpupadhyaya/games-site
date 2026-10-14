// Secret Puzzle Box 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: the craftsman's desk with the yosegi box (a tilted perspective camera fitted to the layout's face rectangle),
// a screen-space HUD scene (carved wood plaques and lacquered buttons the 2D layer reports through src/v3.js) and, on the Rules
// pages, small box figures drawn into scissored viewports. The 2D layer only draws text, icons and badges and keeps all hit-testing.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; restored -> back to 3D, no reload.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { v3 } from '../src/v3.js';
import { LOOKS } from '../src/ui.js';
import { playLayout, overLayout } from '../src/layout.js';
import { facePanels, faceMeta, titleHero, heroItems } from '../src/view.js';
import { buildFace, buildOpenBox, buildDesk, disposeLookCache, ENV, FRAME_TOP, BODY_BOTTOM, PANEL_TOP } from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (f) => f * f * (3 - 2 * f);
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048 },
  { name: 'medium', dpr: 1.5, shadow: 1024 },
  { name: 'low', dpr: 1, shadow: 0 },
];

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  const noop = { wrap: (g) => g, ok: false };
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.autoClear = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- scene, camera, lights
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 260);
  B.createEnvironment(renderer, scene, { intensity: 0.42 });
  const rig = B.lightingRig(scene, 'warmIndoor', { renderer, shadow: TIERS[tier].shadow, extent: 8.5, target: [0, 0, 0], background: true, fog: { near: 26, far: 70 }, overrides: { keyI: 3.0, keyPos: [-5.5, 11, 6], rimI: 1.6, hemi: 0.5, exposure: 1.05 } });
  const sceneRoot = new THREE.Group(); scene.add(sceneRoot);
  const pivot = new THREE.Group(); pivot.position.y = -0.55; sceneRoot.add(pivot);        // the box turns about its middle
  const boxRig = new THREE.Group(); boxRig.position.y = 0.55; pivot.add(boxRig);
  let desk = null, deskLook = null;
  const faces = new Map();
  let openBox = null;

  // ---------------------------------------------------------------- HUD (screen space): two layers, free and scissored to a scroll body
  const makeHud = () => {
    const sc = new THREE.Scene();
    const key = new THREE.DirectionalLight(0xfff0d8, 1.25); key.position.set(-500, 800, 1000);
    const fill = new THREE.DirectionalLight(0x9db8ff, 0.35); fill.position.set(700, -300, 600);
    sc.add(new THREE.HemisphereLight(0xffe8c8, 0x1a1008, 0.4), key, fill);
    sc.environmentIntensity = 0.35;
    return { scene: sc, panels: [], buttons: [] };
  };
  const hudA = makeHud(), hudB = makeHud();
  const hudCam = new THREE.PerspectiveCamera();
  const setHudProjection = (Wp, Hp) => { const n = 1, f = 2200, m = hudCam.projectionMatrix; m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1); hudCam.projectionMatrixInverse.copy(m).invert(); };
  const flatQuad = new THREE.PlaneGeometry(1, 1);
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 200) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, Math.max(1, rad), bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  // vignette: a dark radial falloff over the whole scene, under the plaques
  const vigC = document.createElement('canvas'); vigC.width = vigC.height = 256;
  { const x = vigC.getContext('2d'), g = x.createRadialGradient(128, 128, 70, 128, 128, 190); g.addColorStop(0, 'rgba(6,2,0,0)'); g.addColorStop(1, 'rgba(6,2,0,0.6)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
  const vigTex = new THREE.CanvasTexture(vigC); vigTex.colorSpace = THREE.SRGBColorSpace;
  const vignette = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: vigTex, transparent: true, depthWrite: false, fog: false }));
  hudA.scene.add(vignette);

  let hudLook = null, HM = null;
  function hudMaterials(id) {
    if (hudLook === id && HM) return HM;
    if (HM) for (const m of Object.values(HM)) m.dispose?.();
    const T = LOOKS[id] ?? LOOKS.cherry, E = ENV[id] ?? ENV.cherry, dark = T.dark;
    const wood = dark
      ? B.material('darkWood', { color: id === 'ebony' ? '#1c242d' : '#3a1d10', color2: id === 'ebony' ? '#34414f' : '#5e3319', seed: 6, repeat: [2, 2], physical: true })
      : B.material('wood', { color: '#c79a5c', color2: '#ecd09b', seed: 6, repeat: [2, 2], physical: true });
    wood.clearcoat = 0.6; wood.clearcoatRoughness = 0.25;
    const lac = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: o.rough ?? 0.34, metalness: o.metal ?? 0, clearcoat: o.coat ?? 1, clearcoatRoughness: o.cr ?? 0.1, emissive: o.em ?? 0x000000, emissiveIntensity: o.emi ?? 0 });
    const lc = document.createElement('canvas'); lc.width = lc.height = 256; const lx = lc.getContext('2d');
    lx.fillStyle = dark ? (id === 'ebony' ? '#0f151c' : '#1f0e09') : '#f6ead0'; lx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) { lx.fillStyle = Math.random() < 0.5 ? 'rgba(255,230,190,0.035)' : 'rgba(0,0,0,0.12)'; lx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); }
    const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace; lt.wrapS = lt.wrapT = THREE.RepeatWrapping; lt.repeat.set(4, 4);
    HM = {
      wood,
      brass: new THREE.MeshStandardMaterial({ color: T.brass, metalness: 0.85, roughness: 0.3 }),
      brassHi: new THREE.MeshStandardMaterial({ color: T.brassHi, metalness: 0.7, roughness: 0.28, emissive: T.brass, emissiveIntensity: 0.35 }),
      leather: new THREE.MeshStandardMaterial({ map: lt, roughness: 0.92 }),
      leatherHi: new THREE.MeshStandardMaterial({ color: dark ? (id === 'ebony' ? '#18212b' : '#2c130c') : '#fff6df', roughness: 0.9 }),
      felt: new THREE.MeshStandardMaterial({ color: E.mat, roughness: 1 }),
      plate: lac(T.plate0, { rough: 0.45, coat: 0.7 }),
      plateOff: lac(dark ? '#2a1a14' : '#c9bd9c', { rough: 0.7, coat: 0.2 }),
      solid: lac(dark ? (id === 'ebony' ? '#222b36' : '#2c140d') : '#e9cf9c'),
      solidOn: lac(dark ? (id === 'ebony' ? '#34506a' : '#6a3a22') : '#f6dea8', { em: T.accent, emi: 0.28 }),
      accent: lac(T.accent, { rough: 0.3, metal: 0.25, em: T.accent, emi: 0.12 }),
      card: lac(dark ? '#2a120e' : '#fff6e2', { rough: 0.5, coat: 0.6 }),
    };
    hudLook = id;
    return HM;
  }
  function panelObj(layer, i) {
    let p = layer.panels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad), trim = new THREE.Mesh(flatQuad), inner = new THREE.Mesh(flatQuad); g.add(outer, trim, inner); layer.scene.add(g); p = { g, outer, trim, inner }; layer.panels.push(p); }
    return p;
  }
  const ROT = Math.PI / 2;   // slab() rises along +y; the HUD looks along -z, so rotate it to rise toward the camera
  function placePanel(layer, i, p, M) {
    const o = panelObj(layer, i), r = p.r, z = -700;
    o.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), kind = p.kind, small = Math.min(r.w, r.h) < 90;
    const dep = kind === 'toast' ? 9 : small ? 8 : 13, ins = kind === 'fig' || kind === 'doc' ? 7 : small ? 4 : 6;
    let inner = M.leather, outerM = M.wood, trimM = M.brass;
    if (kind === 'tile') inner = M.plate;
    else if (kind === 'tileDone') { inner = M.plate; trimM = M.brassHi; }
    else if (kind === 'tileOff') inner = M.plateOff;
    else if (kind === 'card') { inner = M.card; trimM = M.brassHi; }
    else if (kind === 'coach' || kind === 'toast') { inner = M.leatherHi; trimM = M.brassHi; }
    else if (kind === 'row') inner = M.leatherHi;
    else if (kind === 'fig') inner = M.felt;
    else if (kind === 'sign') { inner = M.leatherHi; trimM = M.brassHi; }
    const rad = Math.min(p.rad, r.h / 2 - 1, r.w / 2 - 1);
    o.outer.material = outerM; o.trim.material = trimM; o.inner.material = inner;
    o.outer.geometry = slabG(r.w, r.h, dep, rad, 5); o.outer.rotation.x = ROT; o.outer.position.set(cx, cy, z);
    o.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(3, rad - ins * 0.5), 1.4); o.trim.rotation.x = ROT; o.trim.position.set(cx, cy, z);
    o.inner.geometry = slabG(r.w - ins * 2.1, r.h - ins * 2.1, dep + 2.5, Math.max(2, rad - ins), 2); o.inner.rotation.x = ROT; o.inner.position.set(cx, cy, z);
  }
  function buttonObj(layer, i) {
    let b = layer.buttons[i];
    if (!b) { const g = new THREE.Group(), rim = new THREE.Mesh(flatQuad), body = new THREE.Mesh(flatQuad); g.add(rim, body); layer.scene.add(g); b = { g, rim, body }; layer.buttons.push(b); }
    return b;
  }
  function placeButton(layer, i, bt, pressed, M) {
    if (bt.kind === 'ghost') { const b0 = layer.buttons[i]; if (b0) b0.g.visible = false; return; }
    const b = buttonObj(layer, i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(bt.rad ?? 16, r.h / 2.6), z = -600, dep = pressed ? 7 : 15;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, rad - 2, 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.body.material = bt.kind === 'accent' ? M.accent : bt.active ? M.solidOn : M.solid;
    b.rim.material = bt.active || bt.kind === 'accent' ? M.brassHi : M.brass;
    b.g.position.set(0, pressed ? -3 : 0, 0);
    b.g.scale.setScalar(1 + (bt.flash || 0) * 0.02);
  }

  // ---------------------------------------------------------------- camera fitting + projection
  let W = 1, H = 1, dprNow = 1, L_ = null, hudW = 0, hudH = 0, frameDt = 0.016;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const tmp = new THREE.Vector3();
  const boxPts = (cw, ch, yTop, yBot) => { const a = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.push(new THREE.Vector3(sx * cw / 2, yTop, sz * ch / 2), new THREE.Vector3(sx * cw / 2, yBot, sz * ch / 2)); return a; };
  // Fit `pts` (world points) into `rect` (virtual px) with a camera at pitch/yaw looking at (0, lookY, 0).
  function fitCamera(rect, pts, pitchDeg, fov, yawDeg, lookY = -0.3) {
    const k = W / L_.w, tw = rect.w * k, th = rect.h * k, tcx = (rect.x + rect.w / 2) * k, tcy = (rect.y + rect.h / 2) * k;
    const p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180;
    camera.fov = fov; camera.aspect = W / H; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const place = (d) => { camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d); camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); };
    const measure = () => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of pts) { tmp.copy(c).project(camera); const px = ((tmp.x + 1) / 2) * W, py = ((1 - tmp.y) / 2) * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
      return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    };
    let lo = 3, hi = 220;
    for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; place(mid); const m = measure(); if (m.w <= tw && m.h <= th) hi = mid; else lo = mid; }
    place(hi);
    const m = measure();
    camera.setViewOffset(W, H, m.cx - tcx, m.cy - tcy, W, H); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const rayO = new THREE.Vector3(), rayD = new THREE.Vector3();
  function setPlaneMapping(cx, cy, S) {
    v3.proj = (lx, ly, h = 0) => {
      tmp.set((lx - cx) / S, h, (ly - cy) / S); boxRig.localToWorld(tmp); tmp.project(camera);
      return { x: ((tmp.x + 1) / 2) * L_.w, y: ((1 - tmp.y) / 2) * L_.h };
    };
    v3.unproj = (vx, vy) => {
      rayO.copy(camera.position); rayD.set((vx / L_.w) * 2 - 1, 1 - (vy / L_.h) * 2, 0.5).unproject(camera).sub(rayO).normalize();
      const y = PANEL_TOP + 0.05; if (Math.abs(rayD.y) < 1e-5) return { x: vx, y: vy };
      const t = (y - rayO.y) / rayD.y; if (t <= 0) return { x: vx, y: vy };
      tmp.copy(rayO).addScaledVector(rayD, t); boxRig.worldToLocal(tmp);
      return { x: cx + tmp.x * S, y: cy + tmp.z * S };
    };
  }

  // ---------------------------------------------------------------- sparks
  const spark = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 64);
  spark.frustumCulled = false; sceneRoot.add(spark);
  const parts = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function burst(x, y, z, n, up = 1.6) {
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + i * 0.7, sp = 0.8 + ((i * 37) % 10) * 0.11; parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: up + ((i * 13) % 7) * 0.25, vz: Math.sin(a) * sp, life: 0, max: 0.7 + ((i * 7) % 5) * 0.1 }); }
    if (parts.length > 64) parts.splice(0, parts.length - 64);
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life += dt; p.vy -= 5.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.life >= p.max) parts.splice(i, 1); }
    for (let i = 0; i < 64; i++) {
      const p = parts[i];
      if (!p) _m.makeScale(0, 0, 0); else { const kk = 1 - p.life / p.max; _p.set(p.x, p.y, p.z); _s.setScalar(0.5 + kk); _m.compose(_p, _q, _s); }
      spark.setMatrixAt(i, _m);
    }
    spark.instanceMatrix.needsUpdate = true;
  }
  const seenSparks = new WeakSet();

  // ---------------------------------------------------------------- content per look
  function ensureLook(id) {
    const T = LOOKS[id] ?? LOOKS.cherry, E = ENV[id] ?? ENV.cherry;
    if (deskLook === id && desk) return;
    if (desk) { sceneRoot.remove(desk.group); desk.dispose(); }
    for (const f of faces.values()) { boxRig.remove(f.group); f.dispose(); } faces.clear();
    for (const f of figFaces.values()) { figRoot.remove(f.group); f.dispose(); } figFaces.clear();
    if (openBox) { sceneRoot.remove(openBox.group); openBox.dispose(); openBox = null; }
    disposeLookCache();
    desk = buildDesk(id, T); sceneRoot.add(desk.group); deskLook = id;
    scene.background = new THREE.Color(E.bg); scene.fog.color.setHex(E.bg);
    rig.key.color.setHex(id === 'ebony' ? 0xdfe8ff : 0xffd9a8); rig.rim.color.setHex(id === 'ebony' ? 0x8fb8ff : 0xffb27a);
    hudMaterials(id);
  }
  function faceFor(spec, id, key) {
    let f = faces.get(key);
    if (!f) { f = buildFace(spec, LOOKS[id] ?? LOOKS.cherry, id, { shadows: TIERS[tier].shadow > 0 }); f.group.visible = false; boxRig.add(f.group); faces.set(key, f); }
    return f;
  }
  const showOnly = (f) => { for (const o of faces.values()) o.group.visible = o === f; };
  function specOf(P, face) {
    const Bx = P.B, ids = [], laneSteps = [], goals = [];
    for (let i = 0; i < Bx.n; i++) if (Bx.face[i] === face) { ids.push(i); laneSteps.push(Bx.k[i] - 1); goals.push(Bx.goal[i]); }
    return { lanes: ids.length, steps: Math.max(...laneSteps), laneSteps, vertical: face === 1, ids, goals };
  }
  const heroSpec = { lanes: 3, steps: 2, laneSteps: [2, 2, 2], vertical: false, ids: [3, 8, 12], goals: [2, 2, 2] };
  const specKey = (s) => `${s.vertical ? 'v' : 'h'}|${s.laneSteps.join(',')}|${s.ids.join(',')}|${s.goals.join(',')}`;

  // ---------------------------------------------------------------- frame
  let lastT = 0, clock = 0, frames = 0, ema = 16, lastWinBurst = 0, sceneKind = 'title';
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; rig.key.castShadow = t.shadow > 0;
    if (t.shadow) { rig.key.shadow.mapSize.set(t.shadow, t.shadow); if (rig.key.shadow.map) { rig.key.shadow.map.dispose(); rig.key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  // ----- phase 1: before the 2D UI draws (camera, models, projection used by the 2D badges and picking)
  function prepare(state, L) {
    resize(); L_ = L;
    if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const look = LOOKS[state.prefs.look] ? state.prefs.look : 'cherry';
    ensureLook(look);
    const sc = state.scene; v3.scene = sc; sceneKind = sc;
    v3.unproj = null; v3.proj = null; v3.figure = null; v3.open = null; v3.hero = null;
    pivot.rotation.set(0, 0, 0); boxRig.position.set(0, 0.55, 0);
    const calm = !!state.prefs.calm;
    if (openBox) openBox.group.visible = false;
    if (sc === 'play' && state.P) {
      const P = state.P, Bx = P.B, fm = faceMeta(Bx, P.face), coach = !!(state.hint || state.auto.on);
      const PL = playLayout(L.w, L.h, fm.lanes, fm.T, fm.vertical, Bx.faces, coach), G = PL.face, turn = state.turn;
      const k = turn ? clamp(turn.t / turn.dur, 0, 1) : 0, faceNow = turn && k < 0.5 ? turn.from : P.face;
      const spec = specOf(P, faceNow);
      const f = faceFor(spec, look, `${look}|${Bx.n}|${Bx.goal.join('')}|${specKey(spec)}`); showOnly(f);
      // fit the RESTING box (the new face has the same footprint class) into the layout's area; the plane mapping follows the layout face box
      const G0 = PL.face, rest = faceFor(specOf(P, P.face), look, `${look}|${Bx.n}|${Bx.goal.join('')}|${specKey(specOf(P, P.face))}`);
      fitCamera(PL.area, boxPts(rest.dims.cw, rest.dims.ch, FRAME_TOP + 0.1, BODY_BOTTOM), PL.land ? 58 : 60, 28, 0);
      setPlaneMapping(G0.box.x + G0.box.w / 2, G0.box.y + G0.box.h / 2, G0.S);
      if (turn) { const a = k < 0.5 ? -ease(k * 2) : ease((1 - k) * 2); pivot.rotation.x = a; boxRig.position.y = 0.55 + Math.sin(k * Math.PI) * 0.5; }
      f.update(facePanels(state, faceNow), clock, { win: P.done ? 1 : 0, dt: frameDt });
      let n = 0, ax = 0, ay = 0;
      for (const sp of state.sparks) if (!seenSparks.has(sp)) { seenSparks.add(sp); ax += sp.x; ay += sp.y; n++; }
      if (n) burst((ax / n - (G.box.x + G.box.w / 2)) / G.S, PANEL_TOP + 0.1, (ay / n - (G.box.y + G.box.h / 2)) / G.S, 14);
      if (P.done && clock - lastWinBurst > 0.22) { lastWinBurst = clock; const l = Math.floor(clock * 3) % f.spec.lanes, c = f.centre(l, f.spec.goals[l]); burst(c.x, PANEL_TOP + 0.2, c.z, 8, 2.2); }
    } else if (sc === 'over' && state.result) {
      for (const o of faces.values()) o.group.visible = false;
      if (!openBox) { openBox = buildOpenBox(LOOKS[look], look); sceneRoot.add(openBox.group); }
      openBox.group.visible = true;
      const O = overLayout(L.w, L.h), d = openBox.dims;
      fitCamera(O.field, boxPts(d.W + 1.2, d.D + 1.4, d.H + 3.1, 0), 36, 30, Math.sin(clock * 0.3) * 7, d.H * 0.75);
      openBox.update(clamp(state.sceneT / 1.6, 0, 1), state.result.keep, clock, camera);
    } else {
      // menus and pages: the hero box (three lanes sliding) behind the plaques
      const f = faceFor(heroSpec, look, `${look}|hero`); showOnly(f);
      let rect, pitch = 50;
      const yaw = Math.sin(clock * 0.18) * (calm ? 0 : 8);
      if (sc === 'title' || sc === 'demo-limit') rect = titleHero(L.w, L.h).fr;
      else { rect = { x: L.w * 0.14, y: L.h * 0.05, w: L.w * 0.72, h: L.h * 0.32 }; pitch = 54; }
      fitCamera(rect, boxPts(f.dims.cw, f.dims.ch, FRAME_TOP + 0.1, BODY_BOTTOM), pitch, 30, yaw);
      f.update(heroItems(clock), clock, { win: 0, dt: frameDt });
    }
    desk.update(clock, camera, calm);
  }

  // ----- figure (Rules / How to Play pages): a small box in a scissored viewport
  const figScene = new THREE.Scene();
  const figCam = new THREE.PerspectiveCamera(26, 1, 0.5, 120);
  figScene.add(new THREE.HemisphereLight(0xffe6c8, 0x2a1a10, 0.75));
  const figKey = new THREE.DirectionalLight(0xffd9a8, 3.0); figKey.position.set(-4, 9, 5); figScene.add(figKey);
  const figRim = new THREE.DirectionalLight(0xffb27a, 1.2); figRim.position.set(5, 3, -5); figScene.add(figRim);
  const figRoot = new THREE.Group(); figScene.add(figRoot);
  const figFaces = new Map();
  function renderFigure(fg) {
    const look = deskLook, T = LOOKS[look], sp = fg.spec;
    const spec = { lanes: sp.lanes, steps: sp.steps, laneSteps: sp.panels.map((p) => p.steps), vertical: !!sp.vertical, ids: sp.panels.map((p) => p.id), goals: sp.panels.map((p) => p.goal) };
    const key = `${look}|fig|${specKey(spec)}`;
    let f = figFaces.get(key);
    if (!f) { f = buildFace(spec, T, look, { shadows: false }); figRoot.add(f.group); figFaces.set(key, f); }
    for (const o of figFaces.values()) o.group.visible = o === f;
    f.update(sp.panels.map((p, i) => ({ lane: i, vis: p.vis, lift: 0, shake: p.shake || 0, holder: !!p.holder, hint: false, focus: false, arrow: p.arrow || 0 })), clock, { win: 0, dt: frameDt });
    const k = W / L_.w, r = fg.r, dims = f.dims;
    figScene.environment = scene.environment; figScene.environmentIntensity = 0.45;
    const vw = Math.max(2, r.w * k), vh = Math.max(2, r.h * k);
    figCam.aspect = vw / vh; figCam.updateProjectionMatrix();
    const pts = boxPts(dims.cw, dims.ch, 0.1, BODY_BOTTOM), pitch = 62 * Math.PI / 180;
    const place = (d) => { figCam.position.set(0, -0.3 + Math.sin(pitch) * d, Math.cos(pitch) * d); figCam.lookAt(0, -0.3, 0); figCam.updateMatrixWorld(); figCam.updateProjectionMatrix(); };
    let lo = 3, hi = 120;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2; place(mid);
      let ok = true; for (const c of pts) { tmp.copy(c).project(figCam); if (Math.abs(tmp.x) > 0.93 || Math.abs(tmp.y) > 0.93) { ok = false; break; } }
      if (ok) hi = mid; else lo = mid;
    }
    place(hi);
    const x = Math.round(r.x * k), y = Math.round(H - (r.y + r.h) * k), w = Math.round(vw), h = Math.round(vh);
    let cx = x, cy = y, cw = w, ch = h;
    if (fg.clip) { const c = fg.clip, x0 = Math.max(x, Math.round(c.x * k)), x1 = Math.min(x + w, Math.round((c.x + c.w) * k)), yt = Math.round(H - (c.y + c.h) * k), yb = Math.round(H - c.y * k), y0 = Math.max(y, yt), y1 = Math.min(y + h, yb); cx = x0; cw = x1 - x0; cy = y0; ch = y1 - y0; }
    if (cw <= 0 || ch <= 0) return;
    renderer.setViewport(x, y, w, h); renderer.setScissor(cx, cy, cw, ch); renderer.setScissorTest(true);
    renderer.clearDepth(); renderer.render(figScene, figCam);
    renderer.setScissorTest(false);
  }

  // ----- phase 2: after the 2D UI recorded its panels and buttons
  function present(L, dt) {
    const M = hudMaterials(deskLook);
    rig.key.position.set(-5.5, 11, 6); rig.key.target.position.set(0, 0, 0);
    stepParts(dt);
    vignette.scale.set(L.w * 1.02, L.h * 1.02, 1); vignette.position.set(L.w / 2, -L.h / 2, -940);
    hudA.scene.environment = scene.environment; hudB.scene.environment = scene.environment;
    const free = [], scrolled = [], fb = [], sb = [];
    for (const p of v3.panels) (p.clip ? scrolled : free).push(p);
    for (const b of v3.buttons) (b.clip ? sb : fb).push(b);
    const pr = v3.pressed, isPressed = (b) => !!pr && pr.x >= b.r.x && pr.x <= b.r.x + b.r.w && pr.y >= b.r.y && pr.y <= b.r.y + b.r.h;
    const fill = (layer, ps, bs) => {
      ps.forEach((p, i) => placePanel(layer, i, p, M)); for (let i = ps.length; i < layer.panels.length; i++) layer.panels[i].g.visible = false;
      bs.forEach((b, i) => placeButton(layer, i, b, isPressed(b), M)); for (let i = bs.length; i < layer.buttons.length; i++) layer.buttons[i].g.visible = false;
    };
    fill(hudA, free, fb); fill(hudB, scrolled, sb);
    renderer.setViewport(0, 0, W, H); renderer.setScissorTest(false);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hudA.scene, hudCam);
    if (scrolled.length || sb.length) {
      const c = (scrolled[0] || sb[0]).clip, k = W / L.w;
      renderer.setScissor(Math.round(c.x * k), Math.round(H - (c.y + c.h) * k), Math.round(c.w * k), Math.round(c.h * k)); renderer.setScissorTest(true);
      renderer.clearDepth(); renderer.render(hudB.scene, hudCam); renderer.setScissorTest(false);
    }
    if (v3.figure) { renderFigure(v3.figure); renderer.setViewport(0, 0, W, H); }
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { W = 0; resize(); applyTier(); v3.on = true; });

  try { applyTier(); ensureLook('cherry'); } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, tierName: () => TIERS[tier].name, setTier(t) { tier = clamp(t, 0, TIERS.length - 1); applyTier(); },
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const L = { w: view?.width ?? 720, h: view?.height ?? 1560 };
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt; frameDt = dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.scrim = 0;
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
