// Patolli 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: a lit temple courtyard at dusk with the carved cross board, sculpted stone pieces, glow rings and torches,
// plus a screen-space HUD scene (carved plaques, lacquered buttons, tumbling beans) drawn in the same frame.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import { board3d as B, THREE } from '../vendor3d/index.js';
import { v3, sprites } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { SPEEDS } from '../src/rulesdata.js';
import { HOME, LOOP, STEPS } from '../src/engine.js';
import { pieceUV, centreUV } from '../src/boardview.js';
import { buildBoard, buildCourtyard, makePiece, makeBean, makeTorch, updateTorch, textures, goldMaterial, W, Y } from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048 },
  { name: 'medium', dpr: 1.5, shadow: 1024 },
  { name: 'low', dpr: 1, shadow: 0 },
];
const HALF = 4.85;

const tick = () => new Promise((r) => setTimeout(r, 0));   // yield so the flat title paints and stays interactive while the 3D scene builds
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
  renderer.autoClear = false;
  renderer.setClearColor(0x120c1c, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  await tick();
  // ---------------------------------------------------------------- scenes, lights
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 260);
  const rig = B.lightingRig(scene, 'duskOutdoor', {
    renderer, shadow: TIERS[tier].shadow, extent: 7.5, background: false, fog: { color: 0x2c2036, near: 60, far: 150 },
    overrides: { key: 0xffc58a, keyI: 1.55, keyPos: [-6, 10, 8], hemi: 0.3, hemiSky: 0xffd0a8, hemiGround: 0x2a2030, fill: 0x6f8ff0, fillI: 0.55, rim: 0x8fa8ff, rimI: 1.6, rimPos: [6, 5, -8], exposure: 1.05, env: 0.3 },
  });
  scene.background = textures.sky();
  const hud = new THREE.Scene();
  const hudCam = new THREE.PerspectiveCamera();
  const hudKey = new THREE.DirectionalLight(0xfff0dc, 1.7); hudKey.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0x9db8ff, 0.45); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe2c0, 0x1c1620, 0.6), hudKey, hudFill);

  function buildEnvMap() {
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture;
    pm.dispose();
    scene.environment = t; scene.environmentIntensity = 0.3;
    hud.environment = t; hud.environmentIntensity = 0.16;
  }
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  await tick();
  // ---------------------------------------------------------------- world
  scene.add(buildCourtyard());
  const torches = [[-5.6, -5.4, 2.3], [5.6, -5.4, 2.3], [-6.1, 5.6, 1.1], [6.1, 5.6, 1.1]].map(([x, z, h]) => { const t = makeTorch(h); t.position.set(x, Y.floor, z); scene.add(t); return t; });
  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  let boardKey = '', boardObj = null;
  function ensureBoard(armSeat) {
    const key = (armSeat || [null, null, null, null]).join(',');
    if (key === boardKey && boardObj) return;
    if (boardObj) { boardRoot.remove(boardObj.group); boardObj.group.traverse((o) => { if (o.geometry && !o.userData.keep) { /* shared geos are memoised: leave */ } }); }
    boardObj = buildBoard(armSeat || [0, null, 1, null]); boardKey = key; boardRoot.add(boardObj.group);
  }
  const pieceRoot = new THREE.Group(); boardRoot.add(pieceRoot);
  const hlRoot = new THREE.Group(); boardRoot.add(hlRoot);
  const pieces = [[], [], [], []];
  const pieceAt = (seat, i) => {
    const pool = pieces[seat % 4];
    while (pool.length <= i) { const p = makePiece(seat); p.visible = false; pieceRoot.add(p); pool.push(p); }
    return pool[i];
  };
  // loose beans resting on the dais (title / setup)
  const looseBeans = [];
  for (let i = 0; i < 5; i++) { const b = makeBean(); b.group.scale.setScalar(0.6); const w = new THREE.Group(); w.add(b.shadow, b.group); b.shadow.scale.setScalar(0.5); boardRoot.add(w); looseBeans.push({ w, b }); }
  looseBeans.forEach((o, i) => {
    o.w.position.set(2.2 + i * 0.52 + (i % 2) * 0.1, Y.dais + 0.001, 5.45 + (i % 2) * 0.28);
    o.w.rotation.y = 0.5 + i * 1.7; o.b.group.position.y = 0.12 * 0.6;
    if (i % 2) o.b.group.rotation.x = Math.PI;
  });

  // glow rings
  const ringPool = [], glowPool = []; let ringN = 0, glowN = 0;
  const ringGeo = new THREE.PlaneGeometry(1, 1); ringGeo.rotateX(-Math.PI / 2);
  function ring(x, y, z, size, color, op, kind = 'ring') {
    const glow = kind === 'glow', pool = glow ? glowPool : ringPool, idx = glow ? glowN++ : ringN++;
    let m = pool[idx];
    if (!m) {
      m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: textures[kind](), transparent: true, depthWrite: false, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }));
      m.renderOrder = glow ? 2 : 3; hlRoot.add(m); pool.push(m);
    }
    m.visible = true; m.material.color.set(color); m.material.opacity = op; m.position.set(x, y, z); m.scale.set(size, 1, size);
  }

  // particles: sparks (additive) and dust (normal blend)
  const mkParts = (color, additive, n) => {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: additive ? 0.95 : 0.5, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, fog: false }), n);
    m.frustumCulled = false; scene.add(m); return { m, n, list: [] };
  };
  const sparks = mkParts(0xffe6a0, true, 80), dust = mkParts(0xc9b08a, false, 40), embers = mkParts(0xff9a40, true, 28);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  function burst(set, x, y, z, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + i * 0.7, sp = (o.sp ?? 1.0) * (0.6 + ((i * 37) % 10) * 0.08);
      set.list.push({ x, y, z, vx: Math.cos(a) * sp, vy: (o.up ?? 1.8) * (0.6 + ((i * 13) % 7) * 0.12), vz: Math.sin(a) * sp, life: 0, max: (o.life ?? 0.8) * (0.8 + ((i * 7) % 5) * 0.1), g: o.g ?? 5.2, s: o.s ?? 1 });
    }
    if (set.list.length > set.n) set.list.splice(0, set.list.length - set.n);
  }
  function stepSet(set, dt) {
    for (let i = set.list.length - 1; i >= 0; i--) {
      const p = set.list[i]; p.life += dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.life >= p.max) set.list.splice(i, 1);
    }
    for (let i = 0; i < set.n; i++) {
      const p = set.list[i];
      if (!p) tmpM.makeScale(0, 0, 0); else { const k = 1 - p.life / p.max; tmpP.set(p.x, p.y, p.z); tmpS.setScalar((0.45 + k) * p.s); tmpM.compose(tmpP, tmpQ, tmpS); }
      set.m.setMatrixAt(i, tmpM);
    }
    set.m.instanceMatrix.needsUpdate = true;
  }

  await tick();
  // ---------------------------------------------------------------- HUD plaques, buttons, beans
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 160) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const flatQuad = new THREE.PlaneGeometry(1, 1);
  const M = {};
  const paperCanvas = () => {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#fbf1d6'); g.addColorStop(0.5, '#f0e0b8'); g.addColorStop(1, '#e2cd9d'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    let s = 7; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 1400; i++) { x.fillStyle = r() < 0.5 ? 'rgba(120,80,30,0.05)' : 'rgba(255,255,255,0.08)'; x.fillRect(r() * S, r() * S, 1 + r() * 5, 1); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const initMats = () => {
    M.frame = B.material('darkWood', { color: '#4a2a16', color2: '#6b4126', seed: 15, repeat: [3, 3], roughness: 0.5 });
    M.brass = B.material('brass', {});
    M.slate = new THREE.MeshStandardMaterial({ color: '#1b232b', roughness: 0.82, metalness: 0.05 });
    M.slateDeep = new THREE.MeshStandardMaterial({ color: '#12181e', roughness: 0.88 });
    M.paper = new THREE.MeshStandardMaterial({ map: paperCanvas(), roughness: 0.85, metalness: 0 });
    M.paperOn = M.paper;
    const lac = (c, e) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, emissive: e || '#000', emissiveIntensity: e ? 0.5 : 0 });
    M.jade = lac('#13875a', '#05281a'); M.gold = lac('#e0a830', '#3a2604'); M.ivory = lac('#efe2c0'); M.danger = lac('#9a2e1c', '#2a0804'); M.lapis = lac('#2f62c4', '#08183a');
    M.btnQuiet = new THREE.MeshPhysicalMaterial({ color: '#2a3640', roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    M.btnGhost = new THREE.MeshPhysicalMaterial({ color: '#1c252d', roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.3 });
    M.btnOff = new THREE.MeshStandardMaterial({ color: '#171d23', roughness: 0.85 });
    M.dimBrass = new THREE.MeshStandardMaterial({ color: '#6a5a36', roughness: 0.5, metalness: 0.7 });
    M.hot = new THREE.MeshBasicMaterial({ color: '#ffd45a', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    M.ringCols = {};
  };
  const hudPanels = [], hudButtons = [];
  const ROT = Math.PI / 2;
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x07050c, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  const ringMat = (c) => (M.ringCols[c] ??= new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, emissive: c, emissiveIntensity: 0.45 }));
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, M.frame), trim = new THREE.Mesh(flatQuad, M.brass), inner = new THREE.Mesh(flatQuad, M.slate); g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p); }
    return p;
  }
  function placePanel(i, pn) {
    const p = panelAt(i), r = pn.r, rad = pn.rad; p.g.visible = true;
    const small = pn.kind === 'plateOn' || pn.kind === 'plateOff';
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = pn.ov ? -260 : -700, dep = small ? 9 : 14, ins = small ? 4 : (pn.kind === 'sheet' ? 8 : 7);
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.4, Math.max(4, rad - ins * 0.5), 1.4); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.4, Math.max(3, rad - ins), 2); p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    const on = pn.kind === 'plateOn' || pn.kind === 'sheet';
    p.inner.material = on ? M.paper : pn.kind === 'plateOff' ? M.slate : M.slateDeep;
    p.outer.material = small ? (pn.ring ? ringMat(pn.ring) : (on ? M.frame : M.frame)) : M.frame;
    p.trim.material = pn.ring && small ? M.brass : M.brass;
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), hot = new THREE.Mesh(flatQuad, M.hot), rim = new THREE.Mesh(flatQuad, M.brass), body = new THREE.Mesh(flatQuad, M.btnQuiet); g.add(hot, rim, body); hud.add(g); b = { g, hot, rim, body }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt, pressed) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(bt.rad ?? 16, r.h / 3), z = bt.ov ? -240 : -400, dep = pressed ? 7 : 16;
    const mat = { primary: M.jade, gold: M.gold, parch: M.ivory, danger: M.danger, sel: M.lapis, quiet: M.btnQuiet, ghost: M.btnGhost, disabled: M.btnOff }[bt.kind] ?? M.btnQuiet;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.rim.material = bt.kind === 'disabled' || bt.kind === 'ghost' ? M.dimBrass : M.brass;
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, Math.max(3, rad - 2), 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.body.material = mat;
    b.hot.visible = !!bt.hot;
    if (bt.hot) { b.hot.geometry = slabG(r.w + 14, r.h + 14, 2, rad + 6, 1); b.hot.rotation.x = ROT; b.hot.position.set(cx, cy, z - 6); }
    b.g.position.set(0, pressed ? -3 : 0, 0);
  }
  // HUD beans (real meshes, tumble with quaternions)
  const hudBeans = [];
  for (let i = 0; i < 5; i++) {
    const b = makeBean(); b.group.visible = false; b.group.traverse((o) => { o.castShadow = false; });
    const sh = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: textures.white(), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
    sh.visible = false; hud.add(b.group, sh); hudBeans.push({ b, sh });
  }
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), ax = new THREE.Vector3();
  const TILT = Math.PI * 0.34;

  await tick();
  // ---------------------------------------------------------------- sprites (HUD icons rendered from the same models)
  let W_ = 1, H_ = 1, dprNow = 1;
  function buildSprites() {
    const SP = 192, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(22, 1, 1, 60);
    const l1 = new THREE.DirectionalLight(0xfff2dc, 3.4); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0x9fc4ff, 1.0); l2.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a4256, 1.2), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.6;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = false;
    const shoot = (obj, dist, look, pitch) => {
      sc.add(obj); const p = (pitch * Math.PI) / 180;
      cam.position.set(0, look + Math.sin(p) * dist, Math.cos(p) * dist); cam.lookAt(0, look, 0); cam.updateMatrixWorld();
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sc.remove(obj); return c;
    };
    for (let s = 0; s < 4; s++) { const p = makePiece(s); p.userData.shadow.visible = false; p.rotation.y = 0.5; sprites.bead[s] = shoot(p, 3.9, 0.28, 30); }
    for (const marked of [true, false]) {
      const b = makeBean(); b.shadow.visible = false; const w = new THREE.Group(); w.add(b.group); w.rotation.x = 0.0;
      b.group.rotation.x = marked ? 0 : Math.PI; w.scale.setScalar(1.7); w.rotation.set(0.9, 0, 0);
      sprites.bean[marked ? 'on' : 'off'] = shoot(w, 3.2, 0, 8);
    }
    renderer.setClearColor(0x120c1c, 1);
    renderer.setPixelRatio(pr); renderer.setSize(szw, szh, false);
    renderer.shadowMap.enabled = TIERS[tier].shadow > 0;
    W_ = 0; sprites.ready = true;
  }

  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W_ || h !== H_ || dpr !== dprNow) { W_ = w; H_ = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  await tick();
  // ---------------------------------------------------------------- camera: board fitted to the layout rectangle, projection back to layout units
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  let L_ = null, hudW = 0, hudH = 0;
  function fitCamera(rect, pitchDeg, fov, yawDeg = 0, fill = 0.94) {
    const k = W_ / L_.w, targetW = rect.w * k * fill, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180, lookY = 0.3;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W_ / H_; camera.updateProjectionMatrix();
    let d = 22;
    const place = () => {
      camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    for (let it = 0; it < 6; it++) {
      place();
      const a = tmpV.set(-HALF, Y.dais, HALF).project(camera).x, b = tmpW.set(HALF, Y.dais, HALF).project(camera).x;
      d *= (((b - a) / 2) * W_) / targetW;
    }
    place();
    const c = tmpV.set(0, 0.2, 0).project(camera);
    const px0 = ((c.x + 1) / 2) * W_, py0 = ((1 - c.y) / 2) * H_, cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + (rect.h ?? rect.w) / 2) * k;
    camera.setViewOffset(W_, H_, px0 - cxp, py0 - cyp, W_, H_);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => { tmpV.set(x, y, z); boardRoot.localToWorld(tmpV); tmpV.project(camera); return { x: ((tmpV.x + 1) / 2) * L_.w, y: ((1 - tmpV.y) / 2) * L_.h }; };
  v3.cell = (u, v, h = 0) => (boardRoot.visible ? toVirt(W(u), Y.tile + h, W(v)) : { x: L_.w / 2, y: L_.h / 2 });

  await tick();
  // ---------------------------------------------------------------- per-screen state -> scene
  let clock = 0, lastVisKey = '', lastVis = null;
  const seenPops = new WeakSet();
  const hideAll = () => { for (const pool of pieces) for (const p of pool) p.visible = false; };
  function setPiece(p, x, y, z, o = {}) {
    p.visible = true; p.position.set(x, y, z);
    const rg = p.userData.rig, lift = o.lift || 0, s = (o.scale ?? 1) * 1.12, sq = o.squash || 0;
    rg.position.y = lift; rg.rotation.y = o.yaw || 0; rg.rotation.x = o.tilt || 0; rg.rotation.z = o.roll || 0;
    rg.scale.set(s * (1 + sq * 0.5), s * (1 - sq), s * (1 + sq * 0.5));
    const sh = p.userData.shadow; sh.scale.setScalar(s * (1 - clamp(lift * 0.25, 0, 0.45))); sh.material.opacity = 0.62 * (1 - clamp(lift * 0.35, 0, 0.6));
    sh.position.y = 0.004 + 0.0;
  }
  const tileY = (q) => (q >= 1 && q < HOME ? Y.tile : Y.tray);

  function heroScene(state, setup) {
    hideAll();
    const T = state.prefs?.calm ? 0 : clock;
    const seatsOn = heroArms;
    // stones walking the outline of the cross, two seats, each hopping with an arc
    let used = [0, 0, 0, 0];
    const seats = seatsOn.map((s) => s).filter((s) => s != null);
    seats.forEach((seat, k) => {
      const base = ((T * 1.3 + k * 16) % 32), n0 = Math.floor(base), u = base - n0;
      const a = loopUV(n0 % 32), b = loopUV((n0 + 1) % 32), e = ease(u);
      const pc = pieceAt(seat, used[seat]++);
      setPiece(pc, W(a.x + (b.x - a.x) * e), Y.tile, W(a.y + (b.y - a.y) * e), { lift: Math.sin(u * Math.PI) * 0.5, yaw: T * 0.4 + k });
      // the rest of this seat waits in its tray
      const arm = seatsOn.indexOf(seat);
      for (let j = 1; j < 4; j++) { const q = pieceUV(arm, j, 0), p2 = pieceAt(seat, used[seat]++); setPiece(p2, W(q.x), Y.tray, W(q.y), { yaw: j }); }
    });
  }
  let heroArms = [0, null, 1, null];
  let LOOPXY = null;
  const loopUV = (i) => { if (!LOOPXY) LOOPXY = Array.from({ length: 32 }, (_, k) => pieceUV(0, 0, k + 1)); return LOOPXY[i]; };

  function playScene(state) {
    const g = state.g; hideAll(); ringN = 0; glowN = 0;
    if (!g) return;
    ringN = 0; glowN = 0;
    const groups = new Map();
    g.players.forEach((pl) => pl.pieces.forEach((q, j) => {
      const vis = g.vis && g.vis.id === pl.id && g.vis.j === j;
      if (vis) return;
      if (q >= 1 && q < HOME) { const key = q <= LOOP ? `L${pl.arm}.${q}` : `S${pl.arm}-${q}`; const arr = groups.get(key) ?? []; arr.push(`${pl.id}.${j}`); groups.set(key, arr); }
    }));
    const used = [0, 0, 0, 0];
    const cur = g.players[g.cur], calm = state.prefs.calm;
    g.players.forEach((pl) => pl.pieces.forEach((q, j) => {
      const p = pieceAt(pl.seat, used[pl.seat]++);
      const vis = g.vis && g.vis.id === pl.id && g.vis.j === j ? g.vis : null;
      let x, z, y, lift = 0, sc = 1, yaw = pl.seat * 0.7 + j, squash = 0, tilt = 0, roll = 0;
      if (vis) {
        const a = pieceUV(pl.arm, j, vis.from), b = pieceUV(pl.arm, j, vis.to), u = ease(vis.u);
        x = W(a.x + (b.x - a.x) * u); z = W(a.y + (b.y - a.y) * u);
        const ya = tileY(vis.from), yb = vis.to >= HOME ? Y.tray : tileY(vis.to);
        y = ya + (yb - ya) * u;
        lift = Math.sin(Math.PI * vis.u) * (vis.k === 'fly' ? 1.7 : vis.k === 'slide' ? 0.22 : 0.52);
        if (vis.k === 'fly') { tilt = Math.sin(vis.u * Math.PI) * 0.7; roll = vis.u * 9; sc = 1.05 - 0.15 * vis.u; yaw += vis.u * 8; }
        else if (vis.u > 0.8) squash = Math.sin(((vis.u - 0.8) / 0.2) * Math.PI) * 0.12;
        if (vis.to >= HOME) sc = 1 - 0.5 * vis.u;
      } else {
        const uv = pieceUV(pl.arm, j, q); x = W(uv.x); z = W(uv.y); y = tileY(q);
        if (q >= HOME) sc = 0.5;
        else if (q >= 1) {
          const key = q <= LOOP ? `L${pl.arm}.${q}` : `S${pl.arm}-${q}`, grp = groups.get(key), idx = grp.indexOf(`${pl.id}.${j}`);
          if (grp.length > 1) { const ang = (idx / grp.length) * TAU + 0.8; x += Math.cos(ang) * 0.22; z += Math.sin(ang) * 0.22; sc = 0.8; }
          if (!calm && pl.id === g.cur && !g.over && !g.vis && g.phase !== 'throwing') lift += 0.02 + Math.sin(clock * 4 + j) * 0.018;
        }
      }
      setPiece(p, x, y, z, { lift, scale: sc, yaw, squash, tilt, roll });
    }));
    // dust where a hop lands; a burst where a captured stone is hurled
    const v = g.vis, key = v ? `${v.id}.${v.j}.${v.from}.${v.to}.${v.k}` : '';
    if (key !== lastVisKey) {
      if (lastVis && lastVis.u >= 0.85) {
        const b = pieceUV(g.players[lastVis.id].arm, lastVis.j, lastVis.to), yy = lastVis.to >= HOME ? Y.tray : tileY(lastVis.to);
        if (lastVis.k === 'hop' || lastVis.k === 'enter') burst(dust, W(b.x), yy + 0.05, W(b.y), 4, { sp: 0.5, up: 0.9, life: 0.5, g: 1.5, s: 1.1 });
        else if (lastVis.k === 'slide') burst(dust, W(b.x), yy + 0.05, W(b.y), 5, { sp: 0.6, up: 0.8, life: 0.55, g: 1.5 });
        else if (lastVis.k === 'fly') burst(dust, W(b.x), Y.tray + 0.1, W(b.y), 7, { sp: 0.7, up: 1.0, life: 0.6, g: 1.5, s: 1.2 });
      }
      if (v && v.k === 'fly' && v.u < 0.1) { const a = pieceUV(g.players[v.id].arm, v.j, v.from); burst(sparks, W(a.x), Y.tile + 0.3, W(a.y), 12, { sp: 1.6, up: 2.2, life: 0.7 }); burst(dust, W(a.x), Y.tile + 0.1, W(a.y), 8, { sp: 0.9, up: 1.4, life: 0.7, g: 2 }); }
      lastVisKey = key; lastVis = v ? { ...v } : null;
    } else if (v) lastVis = { ...v };
    // legal-move glow rings, selected path, landing square
    const dec = g.dec, human = !g.auto && cur.kind === 'human';
    const showSel = dec && (g.phase === 'decide' || g.phase === 'reveal' || g.phase === 'think');
    const pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(clock * 6);
    if (showSel) {
      const chosen = g.phase === 'decide' ? dec.sel : g.phase === 'reveal' ? dec.pick : -1;
      dec.moves.forEach((m, i) => {
        cur.pieces.forEach((q, j) => {
          if (q !== m.from) return;
          const uv = pieceUV(cur.arm, j, q), sel = i === chosen, y = tileY(q) + 0.012;
          ring(W(uv.x), y, W(uv.y), sel ? 1.5 : 1.3 + 0.08 * pulse, sel ? '#ffd23a' : '#46f0c0', sel ? 1 : 0.6 + 0.4 * pulse);
          if (sel) ring(W(uv.x), y + 0.002, W(uv.y), 1.7 + 0.2 * pulse, '#ffb020', 0.35, 'glow');
        });
      });
      if (chosen >= 0 && dec.moves[chosen]) {
        const m = dec.moves[chosen];
        for (let q = m.from + 1; q < m.to; q++) { const uv = pieceUV(cur.arm, m.j, q); ring(W(uv.x), tileY(q) + 0.012, W(uv.y), 0.55, '#ffc23a', 0.55, 'glow'); }
        const d = pieceUV(cur.arm, m.j, m.to), dy = (m.to >= HOME ? Y.tray : tileY(m.to)) + 0.012, col = m.cap ? '#ff7a5a' : m.boost ? '#7ffff0' : '#ffe27a';
        ring(W(d.x), dy, W(d.y), 1.4 + 0.1 * pulse, col, 1);
        ring(W(d.x), dy + 0.002, W(d.y), 1.6, col, 0.22 + 0.12 * pulse, 'glow');
      }
    }
    // reactions to pop-ups (captures, homes, traps, corner stones)
    for (const q of g.pops) {
      if (seenPops.has(q)) continue; seenPops.add(q);
      const pl = g.players[q.id], uv = q.p >= HOME ? centreUV : pieceUV(pl.arm, q.j, q.p), yy = q.p >= HOME ? Y.tile + 0.1 : Y.tile + 0.3;
      if (q.text === 'Home!') { burst(sparks, 0, Y.tile + 0.5, 0, 26, { sp: 2.2, up: 3.2, life: 1.0, s: 1.3 }); }
      else if (q.text === 'Captured!') { burst(sparks, W(uv.x), yy, W(uv.y), 16, { sp: 1.8, up: 2.4, life: 0.8 }); }
      else if (q.text === 'Trap!') { burst(embers, W(uv.x), yy, W(uv.y), 14, { sp: 0.9, up: 2.2, life: 1.0, g: 1.0 }); burst(dust, W(uv.x), yy, W(uv.y), 8, { sp: 0.8, up: 1.2, life: 0.7, g: 1.2 }); }
      else burst(sparks, W(uv.x), yy, W(uv.y), 14, { sp: 1.4, up: 2.4, life: 0.8 });
    }
  }

  function hideRings() { for (let i = ringN; i < ringPool.length; i++) ringPool[i].visible = false; for (let i = glowN; i < glowPool.length; i++) glowPool[i].visible = false; ringN = glowN = 0; }
  await tick();
  // ---------------------------------------------------------------- frame
  let lastT = 0, frames = 0, ema = 16, dtSim = 0.016;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; rig.key.castShadow = t.shadow > 0;
    if (t.shadow) { rig.key.shadow.mapSize.set(t.shadow, t.shadow); if (rig.key.shadow.map) { rig.key.shadow.map.dispose(); rig.key.shadow.map = null; } }
    torches.forEach((tr, i) => { tr.userData.light.visible = t.shadow > 0 || i < 2; });
    W_ = 0;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
  const emberTick = (dt, calm) => {
    if (!calm && embers.list.length < 14 && Math.random() < 0.5) {
      const t = torches[(Math.random() * 2) | 0], p = t.position;
      embers.list.push({ x: p.x + (Math.random() - 0.5) * 0.3, y: p.y + t.userData.h + 0.3, z: p.z + (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5) * 0.25, vy: 0.5 + Math.random() * 0.6, vz: (Math.random() - 0.5) * 0.25, life: 0, max: 1.8 + Math.random() * 1.6, g: -0.1, s: 0.5 });
    }
  };

  function prepare(state, L) {
    resize(); L_ = L;
    if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const sc = state.scene; v3.scene = sc;
    const land = L.land;
    let hero = null;
    if (sc === 'play') { const b = L.play.board; hero = { rect: { x: b.x, y: b.y, w: b.w, h: b.h }, pitch: land ? 52 : 50, fov: 36, yaw: 0, fill: 0.95 }; }
    else if (sc === 'title' || sc === 'setup' || sc === 'result') {
      const hr = v3.heroRect;
      if (hr) hero = { rect: hr, pitch: sc === 'title' ? 44 : 50, fov: 34, yaw: state.prefs.calm ? 0 : Math.sin(clock * 0.25) * 9, fill: 0.92 };
    }
    let armSeat = null;
    if (sc === 'play' && state.g) { armSeat = [null, null, null, null]; state.g.players.forEach((p) => { armSeat[p.arm] = p.seat; }); }
    else if (sc === 'title') armSeat = [0, null, 1, null];
    else if (sc === 'result') {
      const on = (state.result?.rows ?? []).map((r) => r.seat).sort((x, y) => x - y), arms = on.length === 2 ? [0, 2] : [0, 1, 2, 3];
      armSeat = [null, null, null, null]; on.forEach((sn, k) => { armSeat[arms[k] ?? k] = sn; });
      if (!on.length) armSeat = [0, null, 1, null];
    }
    else if (sc === 'setup') {
      const on = state.prefs.seats.map((s, i) => (s ? i : null)).filter((x) => x !== null), arms = on.length === 2 ? [0, 2] : [0, 1, 2, 3];
      armSeat = [null, null, null, null]; on.forEach((sn, k) => { armSeat[arms[k] ?? k] = sn; });
    }
    if (armSeat) heroArms = armSeat;
    if (hero && armSeat) {
      boardRoot.visible = true; ensureBoard(armSeat);
      fitCamera(hero.rect, hero.pitch, hero.fov, hero.yaw, hero.fill);
      if (sc === 'play') playScene(state); else { ringN = glowN = 0; heroScene(state, sc === 'setup'); }
      hideRings();
      looseBeans.forEach((o) => { o.w.visible = sc !== 'play'; });
    } else {
      // text screens: the courtyard alone, slowly drifting
      boardRoot.visible = false; ringN = glowN = 0; hideRings();
      fitCamera({ x: L.w * 0.1, y: L.h * 0.45, w: L.w * 0.8, h: L.w * 0.8 }, 34, 34, state.prefs.calm ? 0 : Math.sin(clock * 0.15) * 8, 0.9);
    }
  }

  const glintPhase = (calm) => { const gm = goldMaterial(); gm.emissive.set(0x8a5a0c); gm.emissiveIntensity = calm ? 0.2 : 0.18 + 0.16 * Math.sin(clock * 1.8); };
  function present(state, L, dt) {
    const calm = state.prefs.calm;
    torches.forEach((t, i) => updateTorch(t, clock, camera, calm, i * 1.7));
    emberTick(dt, calm);
    stepSet(sparks, dt); stepSet(dust, dt); stepSet(embers, dt);
    glintPhase(calm);
    // HUD
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0; const pr = v3.pressed;
    for (const b of v3.buttons) {
      const pressed = !!pr && pr.x >= b.r.x && pr.x <= b.r.x + b.r.w && pr.y >= b.r.y && pr.y <= b.r.y + b.r.h;
      placeButton(n++, b, pressed);
    }
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, -300);
    // beans in the actions panel
    const g = state.g, K = SPEEDS[state.prefs.speedIdx]?.k ?? 1;
    hudBeans.forEach((hb, i) => {
      const src = v3.beans[i];
      if (!src) { hb.b.group.visible = false; hb.sh.visible = false; return; }
      const r = src.r, size = Math.min(r.w * 0.96, r.h * 1.6), cx = r.x + r.w / 2, cy = -(r.y + r.h / 2);
      let spin = null, hop = 0;
      if (src.throwing && g) {
        const f = clamp(g.throwT / (0.9 * K), 0, 1);
        ax.set(0.7 + i * 0.12, 0.3 + (i % 2) * 0.5, 0.5 - i * 0.1).normalize();
        spin = qb.setFromAxisAngle(ax, (1 - ease(f)) * (5 + i * 1.3) * Math.PI);
        hop = Math.abs(Math.sin(f * Math.PI * (2.2 + i * 0.25))) * (1 - f) * 0.7;
      }
      const rest = qa.setFromAxisAngle(ax.set(1, 0, 0), src.marked ? 0 : Math.PI);
      const yaw = new THREE.Quaternion().setFromAxisAngle(ax.set(0, 1, 0), (i - 2) * 0.35 + (i % 2 ? 0.2 : -0.2));
      const q = new THREE.Quaternion().copy(yaw).multiply(rest);
      if (spin) q.premultiply(spin);
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(ax.set(1, 0, 0), TILT));
      hb.b.group.visible = true; hb.b.group.quaternion.copy(q); hb.b.group.scale.setScalar(size);
      hb.b.group.position.set(cx, cy + size * (0.12 + hop * 0.6), -300);
      hb.sh.visible = true; hb.sh.scale.set(size * 1.0, size * 0.42, 1); hb.sh.position.set(cx + size * 0.05, cy - size * 0.22, -310); hb.sh.material.opacity = 0.5 * (1 - hop * 0.85);
    });
    renderer.setViewport(0, 0, W_, H_);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud, hudCam);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; sprites.ready = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnvMap(); } catch (e) { /* no reflections, still playable */ }
    try { buildSprites(); } catch (e) { /* flat beads */ }
    W_ = 0; resize(); v3.on = true;
  });

  try {
    initMats(); buildEnvMap(); applyTier(); buildSprites();
  } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  await tick();
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* first frame compiles instead */ }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, v3,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const L = layoutFor(view?.width ?? 720, view?.height ?? 1560);
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt; dtSim = dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.beans.length = 0; v3.scrim = 0;
          // The camera is fitted first (the 2D layer asks for projected positions while it draws); on title / setup the hero
          // rectangle is the one the 2D layer reported last frame, so the first frame of a screen is one frame stale.
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          if (state.scene !== 'title' && state.scene !== 'setup' && state.scene !== 'result') v3.heroRect = null;
          game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
