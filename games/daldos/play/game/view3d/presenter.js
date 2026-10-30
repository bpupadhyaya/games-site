// Daldøs 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: a lakeside Sámi siida at dusk (lavvu, birch, reindeer, campfire, pennants) with the carved boat board, lacquered spatulas,
// glow rings and a screen-space HUD scene (carved plaques, lacquered buttons, the throwing stick) drawn in the same frame.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import { board3d as B, THREE, buildScenery } from '../vendor3d/index.js';
import { v3, sprites } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { spot, HOME, OUT_END } from '../src/rules.js';
import { buildBoard, buildPlatform, makeSpatula, makeStick, makeBirch, makeLavvu, makeReindeer, makePennants, makeFire, textures, cellXZ, DP, Y } from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const smooth = (f) => f * f * (3 - 2 * f);
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, scenery: 'high' },
  { name: 'medium', dpr: 1.5, shadow: 1024, scenery: 'medium' },
  { name: 'low', dpr: 1, shadow: 0, scenery: 'low' },
];
const HALF = 5.95;                                      // board half length incl. the prow curls (camera fit)
const EX = { x: 4.65, z: 0 };                          // where a spatula leaves the board
const HARBOUR = [{ x: -4.7, z: 2.7 }, { x: 4.7, z: -2.7 }];

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
  renderer.setClearColor(0x15202c, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  await tick();
  // ---------------------------------------------------------------- scenes and lights
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
  const rig = B.lightingRig(scene, 'duskOutdoor', {
    renderer, shadow: TIERS[tier].shadow, extent: 8.5, background: false, fog: { color: 0x3a3447, near: 70, far: 190 },
    overrides: { key: 0xffc28a, keyI: 1.7, keyPos: [-7, 11, 9], hemi: 0.42, hemiSky: 0xffd9b8, hemiGround: 0x3a3028, fill: 0x7d98ee, fillI: 0.5, rim: 0x9db4ff, rimI: 1.5, rimPos: [7, 5, -9], exposure: 1.05, env: 0.32 },
  });
  scene.background = new THREE.Color(0x2a2a3c);
  const hud = new THREE.Scene();
  const hudCam = new THREE.PerspectiveCamera();
  const hudKey = new THREE.DirectionalLight(0xfff0dc, 1.8); hudKey.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0x9db8ff, 0.45); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe6c8, 0x241a14, 0.65), hudKey, hudFill);

  let envTex = null;
  function buildEnvMap() {
    const pm = new THREE.PMREMGenerator(renderer);
    envTex = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture;
    pm.dispose();
    scene.environment = envTex; scene.environmentIntensity = 0.32;
    hud.environment = envTex; hud.environmentIntensity = 0.18;
  }
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  await tick();
  // ---------------------------------------------------------------- world
  let sc = null;
  try {
    // the clean riverbank layers (sky, panorama, grass, lake, birch band, trees); the loud props (fence, flower patches) are left out
    sc = buildScenery({
      timeOfDay: 'dusk', quality: TIERS[tier].scenery, wind: 0.5, culture: 'north-european',
      layers: [{ t: 'sky', id: 'sky-golden' }, { t: 'backdrop', id: 'bd-riverbank', mix: ['bd-meadow-day'] }, { t: 'ground', id: 'gr-grass', size: 160, repeat: 18 },
        { t: 'water', id: 'gr-river', x: 0, z: -34, w: 400, d: 30, shimmer: 1 }, { t: 'band', id: 'band-birch', r: 70, h: 13, arc: [-170, -10] },
        { t: 'cutouts', id: 'tr-broad-tree', count: 4, r: [22, 40], arc: [-155, -25], scale: [5, 9], seed: 6, sway: 0.8 }],
    });
    scene.add(sc.group);
    sc.ready.then(() => sc.group.traverse((o) => {
      const m = o.material; if (!m || !m.map) return;
      if (m.isMeshLambertMaterial) m.color.multiply(new THREE.Color(0.40, 0.43, 0.52));          // dusk: the grass goes cool and dark
      else if (m.isMeshBasicMaterial && !m.blending) m.color.multiply(new THREE.Color(0.66, 0.68, 0.9));
    })).catch((e) => console.warn('scenery failed', e));
  } catch (e) { console.warn('scenery unavailable', e); sc = null; }
  const platform = buildPlatform(); scene.add(platform);
  const lavvu = makeLavvu(); lavvu.position.set(-7.4, 0, -9.4); lavvu.rotation.y = 0.5; scene.add(lavvu);
  const doorLight = new THREE.PointLight(0xffa850, 4, 9, 1.8); doorLight.position.set(-6.6, 1.2, -6.7); scene.add(doorLight);
  const fire = makeFire(); fire.position.set(6.2, 0, -6.8); scene.add(fire);
  const birches = [[-13.5, -4.5, 6.4], [-6.5, -14, 7.2], [11.5, -9.5, 6.8], [14.5, -3, 6], [1.5, -15.5, 7.4], [-15.5, -11, 6.9], [8.2, -14, 6.2]].map(([x, z, h], i) => { const b = makeBirch(i + 1, h); b.position.set(x, 0, z); scene.add(b); return b; });
  const deer = [[-3.2, -9.5, 0.6, 1], [8.6, -7.8, -2.2, 2], [-12.5, -7.5, 2.4, 3]].map(([x, z, ry, s]) => { const d = makeReindeer(s); d.position.set(x, 0, z); d.rotation.y = ry; scene.add(d); return d; });
  const pennants = makePennants(); pennants.position.set(0, 0, -7.6); scene.add(pennants);
  const sticksWorld = makeStick(); sticksWorld.scale.setScalar(2.5); sticksWorld.visible = false; scene.add(sticksWorld);

  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  let boardWood = '', boardObj = null;
  function ensureBoard(wood) {
    if (boardObj && boardWood === wood) return;
    if (boardObj) boardRoot.remove(boardObj.group);
    boardObj = buildBoard(wood); boardWood = wood; boardRoot.add(boardObj.group);
  }
  const pieceRoot = new THREE.Group(); boardRoot.add(pieceRoot);
  const hlRoot = new THREE.Group(); boardRoot.add(hlRoot);
  const pools = [[], []]; let poolStyle = 'painted';
  const pieceAt = (side, i) => {
    const pool = pools[side];
    while (pool.length <= i) { const p = makeSpatula(side, poolStyle); p.root.visible = false; p.shadow.visible = false; pieceRoot.add(p.root); pieceRoot.add(p.shadow); pool.push(p); }
    return pool[i];
  };
  function rebuildPieces(style) {
    for (const pool of pools) { for (const p of pool) { pieceRoot.remove(p.root); pieceRoot.remove(p.shadow); } pool.length = 0; }
    poolStyle = style;
  }

  // glow rings
  const ringPool = [], glowPool = []; let ringN = 0, glowN = 0;
  const ringGeo = new THREE.PlaneGeometry(1, 1); ringGeo.rotateX(-Math.PI / 2);
  function ring(x, y, z, size, color, op, kind = 'ring') {
    const glow = kind === 'glow', pool = glow ? glowPool : ringPool, idx = glow ? glowN++ : ringN++;
    let m = pool[idx];
    if (!m) {
      m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: textures[glow ? 'glow' : 'ring'](), transparent: true, depthWrite: false, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }));
      m.renderOrder = glow ? 2 : 3; hlRoot.add(m); pool.push(m);
    }
    m.visible = true; m.material.color.set(color); m.material.opacity = op; m.position.set(x, y, z); m.scale.set(size, 1, size * 1.04);
  }
  function hideRings() { for (let i = ringN; i < ringPool.length; i++) ringPool[i].visible = false; for (let i = glowN; i < glowPool.length; i++) glowPool[i].visible = false; ringN = glowN = 0; }

  // particles: sparks and embers (additive), dust, smoke and breath (normal blend)
  const mkParts = (color, additive, n, op = 0.5) => {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: additive ? 0.95 : op, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, fog: false }), n);
    m.frustumCulled = false; scene.add(m); return { m, n, list: [] };
  };
  const sparks = mkParts(0xffe6a0, true, 90), dust = mkParts(0xd7c4a0, false, 50, 0.5), embers = mkParts(0xff9a40, true, 40), smoke = mkParts(0xcfc8c0, false, 40, 0.16), breath = mkParts(0xf2f6ff, false, 30, 0.2);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  function burst(set, x, y, z, n, o = {}, local = true) {
    if (local) { tmpP.set(x, y, z); boardRoot.localToWorld(tmpP); x = tmpP.x; y = tmpP.y; z = tmpP.z; }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + i * 0.7, sp = (o.sp ?? 1.0) * (0.6 + ((i * 37) % 10) * 0.08);
      set.list.push({ x, y, z, vx: Math.cos(a) * sp, vy: (o.up ?? 1.8) * (0.6 + ((i * 13) % 7) * 0.12), vz: Math.sin(a) * sp, life: 0, max: (o.life ?? 0.8) * (0.8 + ((i * 7) % 5) * 0.1), g: o.g ?? 5.2, s: o.s ?? 1, grow: o.grow ?? 0 });
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
      if (!p) tmpM.makeScale(0, 0, 0); else { const k = 1 - p.life / p.max; tmpP.set(p.x, p.y, p.z); tmpS.setScalar((0.45 + k + p.grow * (1 - k)) * p.s); tmpM.compose(tmpP, tmpQ, tmpS); }
      set.m.setMatrixAt(i, tmpM);
    }
    set.m.instanceMatrix.needsUpdate = true;
  }

  await tick();
  // ---------------------------------------------------------------- HUD: plaques, buttons, the throwing stick
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 160) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const flatQuad = new THREE.PlaneGeometry(1, 1);
  const M = {};
  const leatherCanvas = (c0, c1, seed = 7) => {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, 0, S, S);
    let s = seed; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 1600; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,225,170,0.05)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const barkPaper = () => {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#d9c9a4'); g.addColorStop(1, '#c2ae82'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    let s = 3; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(90,60,30,${0.05 + r() * 0.12})`; x.fillRect(r() * S, r() * S, 20 + r() * 80, 1 + r() * 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const initMats = () => {
    M.frame = B.material('darkWood', { color: '#4a2a16', color2: '#6b4126', seed: 15, repeat: [3, 3], roughness: 0.5 });
    M.brass = B.material('brass', {});
    M.weave = new THREE.MeshStandardMaterial({ map: textures.weave(), roughness: 0.85 });
    M.leather = new THREE.MeshStandardMaterial({ map: leatherCanvas('#3a2415', '#241509'), roughness: 0.85 });
    M.leatherOn = new THREE.MeshStandardMaterial({ map: leatherCanvas('#573518', '#35200e', 11), roughness: 0.8 });
    M.bark = new THREE.MeshStandardMaterial({ map: leatherCanvas('#24454c', '#18323a', 19), roughness: 0.95 });
    const lac = (c, e) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, emissive: e || '#000', emissiveIntensity: e ? 0.5 : 0 });
    M.red = lac('#c7321c', '#3a0904'); M.blue = lac('#2562b8', '#071a3a'); M.teal = lac('#2a8a8e', '#062a2c');
    M.btnQuiet = lac('#5a3a20', '#150a04'); M.btnOff = new THREE.MeshStandardMaterial({ color: '#2a1c12', roughness: 0.9 });
    M.dimBrass = new THREE.MeshStandardMaterial({ color: '#6a5a36', roughness: 0.5, metalness: 0.7 });
    M.hot = new THREE.MeshBasicMaterial({ color: '#ffd45a', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    M.side = [M.red, M.blue];
  };
  const hudPanels = [], hudButtons = [];
  const ROT = Math.PI / 2;
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x07090c, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, M.frame), trim = new THREE.Mesh(flatQuad, M.brass), inner = new THREE.Mesh(flatQuad, M.leather); g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p); }
    return p;
  }
  function placePanel(i, pn) {
    const p = panelAt(i), r = pn.r, rad = pn.rad; p.g.visible = true;
    const small = pn.kind === 'plateOn' || pn.kind === 'plateOff';
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = pn.ov ? -260 : -700, dep = small ? 9 : 14, ins = small ? 5 : 7;
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.4, Math.max(4, rad - ins * 0.5), 1.4); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.4, r.h - ins * 2.4, dep + 2.4, Math.max(3, rad - ins), 2); p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    p.inner.material = pn.kind === 'tray' ? M.bark : pn.kind === 'plateOn' ? M.leatherOn : M.leather;
    p.outer.material = small && pn.kind === 'plateOn' ? M.side[pn.side ?? 0] : M.frame;
    p.trim.material = pn.kind === 'sheet' || pn.kind === 'over' || pn.kind === 'card' ? M.weave : M.brass;
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), hot = new THREE.Mesh(flatQuad, M.hot), rim = new THREE.Mesh(flatQuad, M.brass), body = new THREE.Mesh(flatQuad, M.btnQuiet); g.add(hot, rim, body); hud.add(g); b = { g, hot, rim, body }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt, pressed) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(bt.rad ?? 16, r.h / 3), z = bt.ov ? -240 : -400, dep = pressed ? 7 : 16;
    const mat = { primary: M.red, on: M.teal, quiet: M.btnQuiet, disabled: M.btnOff }[bt.kind] ?? M.btnQuiet;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.rim.material = bt.kind === 'disabled' ? M.dimBrass : M.brass;
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, Math.max(3, rad - 2), 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.body.material = mat;
    b.hot.visible = !!bt.hot;
    if (bt.hot) { b.hot.geometry = slabG(r.w + 14, r.h + 14, 2, rad + 6, 1); b.hot.rotation.x = ROT; b.hot.position.set(cx, cy, z - 6); }
    b.g.position.set(0, pressed ? -3 : 0, 0);
  }
  // the HUD stick: a real mesh that tumbles with real rotation and hops, and settles with the right notched face up
  const hudStick = (() => { const outer = new THREE.Group(), inner = makeStick(); outer.add(inner); outer.visible = false; hud.add(outer); inner.traverse((o) => { o.castShadow = false; }); return { outer, inner }; })();
  const stickShadow = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: textures.white(), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
  stickShadow.visible = false; hud.add(stickShadow);

  await tick();
  // ---------------------------------------------------------------- sprites (pictures of the same models for plates, result card, Rules)
  let W_ = 1, H_ = 1, dprNow = 1;
  function buildSprites() {
    const SP = 192, sc2 = new THREE.Scene(), cam = new THREE.PerspectiveCamera(24, 1, 1, 60);
    const l1 = new THREE.DirectionalLight(0xfff2dc, 3.2); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0x9fc4ff, 1.0); l2.position.set(5, 3, -2);
    sc2.add(new THREE.HemisphereLight(0xcfe0ff, 0x5a4a3c, 1.3), l1, l2);
    sc2.environment = envTex; sc2.environmentIntensity = 0.7;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = false;
    const grab = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(renderer.domElement, 0, 0, w, h); return c; };
    renderer.setSize(SP, SP, false);
    for (let s = 0; s < 2; s++) for (const turned of [false, true]) {
      const p = makeSpatula(s); p.shadow.visible = false; p.setTurned(turned);
      p.rig.rotation.x = -0.7;
      sc2.add(p.root); cam.position.set(0, 1.9, 5.2); cam.lookAt(0, 0.5, 0); cam.updateMatrixWorld();
      renderer.clear(); renderer.render(sc2, cam); sprites.spatula[s][turned ? 1 : 0] = grab(SP, SP); sc2.remove(p.root);
    }
    // the board, straight from above
    const o = new THREE.OrthographicCamera(-5.7, 5.7, 2.0, -2.0, 0.1, 40); o.position.set(0, 12, 0.001); o.lookAt(0, 0, 0); o.updateMatrixWorld();
    const sb = buildBoard('pine'); sc2.add(sb.group);
    renderer.setSize(1140, 400, false); renderer.clear(); renderer.render(sc2, o); sprites.board = grab(1140, 400); sc2.remove(sb.group);
    // the stick, every value
    const stick = makeStick(); stick.scale.setScalar(2.6);
    const oc = new THREE.OrthographicCamera(-1.5, 1.5, 0.45, -0.45, 0.1, 20); oc.position.set(0, 8, 2.6); oc.lookAt(0, 0, 0.1);
    sc2.add(stick); renderer.setSize(600, 180, false);
    for (let v = 1; v <= 4; v++) { stick.rotation.x = -(v - 1) * Math.PI / 2; renderer.clear(); renderer.render(sc2, oc); sprites.stick[v] = grab(600, 180); }
    renderer.setClearColor(0x15202c, 1);
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
  // ---------------------------------------------------------------- camera: the board fitted to the layout rectangle; projection back to layout units
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  let L_ = null;
  function placeCam(d, p, yaw, lookY) {
    camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
    camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  }
  // Largest pitch (most top-down) that still fits the board's height in the rectangle; width fitted exactly.
  function fitCamera(rect, o = {}) {
    const k = W_ / L_.w, fill = o.fill ?? 0.97, yaw = ((o.yaw ?? 0) * Math.PI) / 180, lookY = 0.45;
    camera.fov = o.fov ?? 32; camera.clearViewOffset(); camera.aspect = W_ / H_; camera.updateProjectionMatrix();
    const targetW = rect.w * k * fill, targetH = rect.h * k;
    let best = null;
    for (const pd of o.pitches ?? [62, 56, 50, 45, 40, 36]) {
      const p = (pd * Math.PI) / 180; let d = 24;
      for (let it = 0; it < 5; it++) {
        placeCam(d, p, yaw, lookY);
        const a = tmpV.set(-(o.half ?? HALF), Y.deck, 0).project(camera).x, b = tmpW.set(o.half ?? HALF, Y.deck, 0).project(camera).x;
        d *= (((b - a) / 2) * W_) / targetW;
      }
      placeCam(d, p, yaw, lookY);
      const t1 = tmpV.set(0, Y.deck, 1.95).project(camera).y, t2 = tmpW.set(0, Y.deck, -1.95).project(camera).y;
      best = { d, p, hh: ((t2 - t1) / 2) * H_ };
      if (best.hh <= targetH * 0.98) break;
    }
    if (best.hh > targetH) best.d *= best.hh / targetH;
    placeCam(best.d, best.p, yaw, lookY);
    const c = tmpV.set(0, Y.deck, 0).project(camera);
    const px0 = ((c.x + 1) / 2) * W_, py0 = ((1 - c.y) / 2) * H_, cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W_, H_, px0 - cxp, py0 - cyp, W_, H_);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  // The boat standing up the screen (portrait): the camera looks along the board's long axis (quarter turn), the board's box is fitted
  // into the rectangle, the steepest pitch that still gives the biggest board wins.
  function fitCameraUp(rect, o = {}) {
    const k = W_ / L_.w, lookY = 0.45, yaw = (o.yaw ?? -90) * Math.PI / 180, hx = o.half ?? 5.5, hz = 1.95;
    camera.fov = o.fov ?? 30; camera.clearViewOffset(); camera.aspect = W_ / H_; camera.updateProjectionMatrix();
    const tw = rect.w * k * (o.fill ?? 0.98), th = rect.h * k * (o.fill ?? 0.98), cs = [];
    for (const x of [-hx, hx]) for (const y of [Y.deck - 0.4, Y.deck + 0.5]) for (const z of [-hz, hz]) cs.push([x, y, z]);
    const box = () => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y, z] of cs) { tmpV.set(x, y, z).project(camera); const px = ((tmpV.x + 1) / 2) * W_, py = ((1 - tmpV.y) / 2) * H_; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); } return { x0, x1, y0, y1 }; };
    const cands = [];
    for (const pd of o.pitches ?? [74, 68, 62, 56, 50]) {
      const p = (pd * Math.PI) / 180; let d = 24;
      for (let it = 0; it < 8; it++) { placeCam(d, p, yaw, lookY); const b = box(); d *= Math.max((b.x1 - b.x0) / tw, (b.y1 - b.y0) / th); }
      placeCam(d, p, yaw, lookY); cands.push({ d, p });
    }
    const near = Math.min(...cands.map((c) => c.d)), best = cands.find((c) => c.d <= near * 1.03);
    placeCam(best.d, best.p, yaw, lookY);
    const b = box(), cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W_, H_, (b.x0 + b.x1) / 2 - cxp, (b.y0 + b.y1) / 2 - cyp, W_, H_);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  // a free camera for the text screens: the siida, slowly drifting
  function sceneCamera(t, calm) {
    camera.clearViewOffset(); camera.fov = 36; camera.aspect = W_ / H_;
    const a = calm ? 0 : Math.sin(t * 0.12) * 0.12;
    camera.position.set(Math.sin(a) * 17, 4.6, Math.cos(a) * 17); camera.lookAt(0, 2.6, -8); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => { tmpV.set(x, y, z); boardRoot.localToWorld(tmpV); tmpV.project(camera); return { x: ((tmpV.x + 1) / 2) * L_.w, y: ((1 - tmpV.y) / 2) * L_.h }; };
  v3.cell = (row, col, h = 0) => { const c = cellXZ(row, col); return boardRoot.visible ? toVirt(c.x, Y.deck + h, c.z) : { x: L_.w / 2, y: L_.h / 2 }; };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -Y.deck), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.pick = (x, y) => {
    if (!boardRoot.visible || !L_) return null;
    ndc.set((x / L_.w) * 2 - 1, 1 - (y / L_.h) * 2); ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    boardRoot.worldToLocal(hit);
    const col = Math.floor(hit.x + 4), row = Math.floor(hit.z / DP + 1.5);
    return col >= 0 && col < 8 && row >= 0 && row < 3 ? { row, col } : null;
  };

  await tick();
  // ---------------------------------------------------------------- per-screen state -> scene
  let clock = 0;
  const landed = new WeakSet();
  const hideAll = () => { for (const pool of pools) for (const p of pool) { p.root.visible = false; p.shadow.visible = false; } };
  const used = [0, 0];
  const cellPos = (side, step) => { const c = spot(side, step); if (!c) return null; const p = cellXZ(c.row, c.col); return { x: p.x, z: p.z }; };
  function setPiece(side, x, z, o = {}) {
    const p = pieceAt(side, used[side]++), rg = p.rig;
    p.root.visible = true; p.shadow.visible = true; p.root.position.set(x, Y.deck, z);
    const lift = o.lift || 0, s = o.scale ?? 1, sq = o.squash || 0;
    rg.position.y = lift + 0.005;
    p.root.rotation.y = o.yaw || 0;
    rg.rotation.set(-0.7 + (o.tilt || 0), o.flipAng || 0, o.roll || 0);
    rg.scale.set(s * (1 + sq * 0.5), s * (1 - sq), s * (1 + sq * 0.5));
    p.setTurned(!!o.turned);
    p.shadow.position.set(x, Y.deck + 0.006, z + 0.05); p.shadow.scale.setScalar(s * (1 - clamp(lift * 0.3, 0, 0.5))); p.shadow.material.opacity = 0.55 * (1 - clamp(lift * 0.45, 0, 0.7));
    return p;
  }
  const flipAngle = (f) => f * Math.PI;          // a half turn about the vertical axis; both faces share one design, so the swap at the midpoint is invisible
  const flight = (from, to, f, lift) => { const e = smooth(clamp(f, 0, 1)); return { x: from.x + (to.x - from.x) * e, z: from.z + (to.z - from.z) * e, lift: f > 0 && f < 1 ? Math.sin(Math.PI * f) * lift : 0 }; };

  function heroScene(state) {
    hideAll(); used[0] = used[1] = 0;
    const T = state.calm ? 2.6 : state.t % 9.5, p = (r, c) => { const q = cellXZ(r, c); return { x: q.x, z: q.z }; };
    const f1 = ease(clamp((T - 1.2) / 1.3, 0, 1)), f2 = ease(clamp((T - 4.6) / 1.2, 0, 1));
    if (T < 2.6) setPiece(1, p(1, 3).x, p(1, 3).z, { turned: true });
    else if (T < 3.5) { const f = (T - 2.6) / 0.9, q = p(1, 3); setPiece(1, q.x + f * 1.4, q.z - f * 0.4, { turned: true, lift: Math.sin(f * Math.PI) * 1.1 + f * 0.8, tilt: f * 2.4, roll: f * 3, scale: 1 - 0.5 * f }); }
    setPiece(1, p(0, 5).x, p(0, 5).z, {});
    setPiece(0, p(2, 2).x, p(2, 2).z, {});
    const a0 = flight(p(1, 5), p(1, 3), f1, 0.8); setPiece(0, a0.x, a0.z, { turned: true, lift: a0.lift });
    const b0 = flight(p(2, 6), p(1, 7), f2, 0.8), fl = f2 > 0.05 && f2 < 0.95 ? f2 : null;
    setPiece(0, b0.x, b0.z, { turned: f2 > 0.5, lift: b0.lift, flipAng: fl !== null ? flipAngle(fl) : 0 });
    // the stick drops onto the hide at the start of each move and tumbles to a stop
    const fs = T < 1.2 ? T / 1.2 : T > 4 && T < 4.6 ? (T - 4) / 0.6 : -1, sv = T < 4 ? 2 : 1;
    sticksWorld.visible = true;
    const drop = fs >= 0 && fs < 1 && !state.calm;
    sticksWorld.position.set(-1.6, 0.12 + (drop ? Math.abs(Math.sin(fs * Math.PI * 2.2)) * (1 - fs) * 0.9 : 0), 3.15);
    sticksWorld.rotation.set(-(sv - 1) * Math.PI / 2 + (drop ? (1 - fs) * 9 : 0), drop ? (1 - fs) * 0.6 : 0.08, 0);
  }

  function playScene(state) {
    const g = state.game, a = state.anim, calm = state.calm, over = state.scene === 'over';
    hideAll(); used[0] = used[1] = 0;
    sticksWorld.visible = false;
    if (!g) return;
    const me = g.turn, pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(clock * 5);
    const mine = !state.autoMode && g.phase === 'move' && !a && !state.rollAnim && !over && (state.two || me === state.humanSide);
    const ms = state.viewMoves || [];
    const selM = mine && state.sel >= 0 ? ms.find((m) => m.from === state.sel) : null;
    const ry = Y.deck + 0.012;
    const items = [];
    for (let side = 0; side < 2; side++) {
      const seen = new Map();
      for (const st of g.pieces[side]) if (st > 0 && st < HOME) seen.set(st, (seen.get(st) || 0) + 1);
      for (const [st, n0] of seen) {
        let n = n0;
        if (a && a.side === side && a.to === st && a.t < a.dur) n -= 1;
        if (n <= 0 && !(a && a.cap && a.side !== side && 25 - a.to === st && a.t < a.glide)) continue;
        items.push({ side, st, n });
      }
    }
    if (a && a.cap && a.t < a.glide) { const rs = 25 - a.to, rside = 1 - a.side; if (!items.some((i) => i.side === rside && i.st === rs)) items.push({ side: rside, st: rs, n: 1 }); }
    for (const it of items) {
      const { side, st, n } = it, c = cellPos(side, st); if (!c) continue;
      for (let k = 0; k < n; k++) {
        const ox = n === 2 ? (k === 0 ? -0.2 : 0.2) : 0, sc2 = n === 2 ? 0.82 : 1;
        const selected = mine && side === me && state.sel === st && k === 0;
        const lift = selected ? 0.34 + (calm ? 0 : Math.sin(clock * 3) * 0.04) : 0;
        setPiece(side, c.x + ox, c.z, { turned: st > OUT_END, scale: sc2, lift });
      }
    }
    // rings
    const last = g.last && !a && !over ? cellPos(g.last.side, g.last.to) : null;
    if (last) ring(last.x, ry, last.z, 0.98, '#ffd36e', 0.4);
    if (mine && !selM) for (const m of ms) { if (m.from === 0) continue; const c = cellPos(me, m.from); if (c) ring(c.x, ry, c.z, 1.0 + 0.06 * pulse, '#6dffa0', 0.55 + pulse * 0.4); }
    if (selM) {
      if (selM.from > 0) { const c = cellPos(me, selM.from); ring(c.x, ry, c.z, 1.12, '#ffe27a', 1); ring(c.x, ry + 0.002, c.z, 1.5 + 0.2 * pulse, '#ffb020', 0.4, 'glow'); }
      const dest = selM.home ? EX : cellPos(me, selM.to);
      const col = selM.cap ? '#ff5a3a' : selM.turn || selM.home ? '#ffc828' : '#f0fcff';
      ring(dest.x, ry, dest.z, 1.05 + 0.08 * pulse, col, 0.95);
      ring(dest.x, ry + 0.002, dest.z, 1.6, col, 0.25 + 0.15 * pulse, 'glow');
    }
    if (state.hint && !a) for (const q of [state.hint.from, state.hint.to]) { if (q <= 0 || q >= HOME) continue; const c = cellPos(state.hint.side, q); ring(c.x, ry, c.z, 1.05, '#5ae696', 0.95); ring(c.x, ry + 0.002, c.z, 1.55, '#5ae696', 0.28 + 0.12 * pulse, 'glow'); }
    // the captured spatula is knocked clear after the landing
    if (a && a.cap && a.t >= a.glide) {
      const f = clamp((a.t - a.glide) / 0.7, 0, 1), c = cellPos(a.side, a.to), sg = a.side ? -1 : 1;
      if (f < 1) setPiece(1 - a.side, c.x + f * 1.6 * sg, c.z + sg * f * 1.4, { turned: true, lift: Math.sin(f * Math.PI) * 1.2 + f * 0.6, tilt: f * 3.2, roll: f * 4, scale: 1.05 - 0.55 * f, yaw: f * 5 });
    }
    // the moving piece: lift, arc, settle, squash
    if (a) {
      const from = a.from === 0 ? HARBOUR[a.side] : cellPos(a.side, a.from);
      const to = a.to >= HOME ? EX : cellPos(a.side, a.to);
      const f = clamp(a.t / a.glide, 0, 1), e = smooth(f);
      const x = from.x + (to.x - from.x) * e, z = from.z + (to.z - from.z) * e;
      let lift = f < 1 ? Math.sin(Math.PI * f) * (0.55 + 0.08 * a.v) + 0.14 : 0, squash = 0;
      if (f >= 1 && a.to < HOME) { const s = clamp((a.t - a.glide) / 0.3, 0, 1); lift = Math.abs(Math.sin(s * Math.PI * 2)) * 0.1 * (1 - s) * (1 - s); squash = 0.12 * Math.max(0, 1 - s * 4); }
      const flipF = a.turn && f > 0.2 && f < 0.85 ? (f - 0.2) / 0.65 : null;
      const turnedNow = a.turn ? (flipF !== null ? flipF > 0.5 : f >= 0.85) : a.to > OUT_END;
      let sc2 = a.from === 0 ? 0.7 + 0.3 * Math.min(1, f * 3) : 1;
      if (a.home && f > 0.55) { const h = (f - 0.55) / 0.45; sc2 *= 1 - h; lift += h * 0.8; }
      setPiece(a.side, x, z, { turned: turnedNow, lift, squash, scale: Math.max(0.02, sc2), flipAng: flipF !== null ? flipAngle(flipF) : 0, yaw: Math.sin(f * Math.PI) * 0.25 * (a.side ? -1 : 1) });
    }
    // effects, once per landing
    if (a && a.t >= a.glide && !landed.has(a)) {
      landed.add(a);
      const c = a.to >= HOME ? EX : cellPos(a.side, a.to);
      if (a.cap) { burst(sparks, c.x, ry + 0.3, c.z, 18, { sp: 1.9, up: 2.6, life: 0.8 }); burst(dust, c.x, ry + 0.1, c.z, 10, { sp: 0.9, up: 1.2, life: 0.7, g: 1.4, grow: 1 }); }
      else if (a.home) burst(sparks, c.x, ry + 0.5, c.z, 26, { sp: 2.2, up: 3.2, life: 1.0, s: 1.2 });
      else burst(dust, c.x, ry + 0.06, c.z, 6, { sp: 0.55, up: 0.9, life: 0.55, g: 1.5, grow: 1 });
      if (a.turn) burst(sparks, c.x, ry + 0.35, c.z, 20, { sp: 1.6, up: 2.2, life: 0.9 });
    }
    if (a && a.turn && a.t >= a.glide) { const ff = clamp((a.t - a.glide) / 0.7, 0, 1), c = cellPos(a.side, a.to); ring(c.x, ry + 0.01, c.z, 1 + 2.2 * ff, '#ffd76a', 0.7 * (1 - ff), 'glow'); }
  }

  await tick();
  // ---------------------------------------------------------------- frame
  let lastT = 0, frames = 0, ema = 16;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; rig.key.castShadow = t.shadow > 0;
    if (t.shadow) { rig.key.shadow.mapSize.set(t.shadow, t.shadow); if (rig.key.shadow.map) { rig.key.shadow.map.dispose(); rig.key.shadow.map = null; } }
    W_ = 0;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
  function ambient(dt, calm) {
    // campfire: flames flicker, the light wanders (it moves the shadows on the board), embers and smoke rise
    const t = clock, fl = fire.userData;
    fl.flames.forEach((f, i) => { const k = 1 + (calm ? 0 : 0.14 * Math.sin(t * (9 + i * 3) + i) + 0.07 * Math.sin(t * 23 + i * 2)); f.scale.set(k, k, k); f.rotation.y += dt * 2; });
    fl.light.intensity = 6.2 + (calm ? 0 : Math.sin(t * 11) * 0.9 + Math.sin(t * 27) * 0.6);
    fl.light.position.x = calm ? 0 : Math.sin(t * 5.3) * 0.12;
    doorLight.intensity = 3.6 + (calm ? 0 : Math.sin(t * 7 + 1) * 0.5);
    if (!calm) {
      if (embers.list.length < 22 && Math.random() < 0.5) embers.list.push({ x: 6.2 + (Math.random() - 0.5) * 0.3, y: 1.0, z: -6.8 + (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5) * 0.4, vy: 0.8 + Math.random() * 0.9, vz: (Math.random() - 0.5) * 0.4, life: 0, max: 1.5 + Math.random() * 1.4, g: -0.15, s: 0.5, grow: 0 });
      if (smoke.list.length < 14 && Math.random() < 0.1) smoke.list.push({ x: -7.4 + (Math.random() - 0.5) * 0.2, y: 4.5, z: -9.4, vx: 0.3 + Math.random() * 0.2, vy: 0.5 + Math.random() * 0.3, vz: 0.05, life: 0, max: 5 + Math.random() * 2, g: -0.02, s: 4, grow: 2.5 });
    }
    // birch and pennants move with the wind; reindeer graze, flick a tail and breathe out a little fog
    const w = calm ? 0 : 1;
    birches.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.6 + b.userData.sway) * 0.012 * w; b.rotation.x = Math.cos(t * 0.5 + i) * 0.008 * w; });
    pennants.userData.flags.forEach((f, i) => { f.rotation.z = Math.sin(t * 2.4 + i * 0.7) * 0.25 * w; f.rotation.x = Math.sin(t * 1.7 + i * 1.3) * 0.35 * w; });
    deer.forEach((d, i) => {
      const u = d.userData, dip = 0.5 + 0.5 * Math.sin(t * 0.35 + u.ph);
      u.neck.rotation.z = -0.15 - dip * 0.75 * w; u.head.rotation.z = -0.1 - dip * 0.55 * w;
      u.tail.position.y = 0.945 + Math.sin(t * 3 + u.ph) * 0.02 * w;
      if (!calm && i === 0 && Math.random() < dt * 0.4) { const m = d.localToWorld(new THREE.Vector3(1.3, 0.7, 0)); burst(breath, m.x, m.y, m.z, 3, { sp: 0.12, up: 0.18, life: 2.0, g: -0.05, s: 3, grow: 2.2 }, false); }
    });
    stepSet(sparks, dt); stepSet(dust, dt); stepSet(embers, dt); stepSet(smoke, dt); stepSet(breath, dt);
  }

  function prepare(state, L) {
    resize(); L_ = L;
    setHudProjection(L.w, L.h);
    const sc3 = state.scene; v3.scene = sc3;
    if (state.style !== poolStyle) rebuildPieces(state.style);
    ensureBoard(state.wood || 'pine');
    boardRoot.rotation.y = (sc3 === 'play' || sc3 === 'over') && L.flip ? Math.PI : 0;
    ringN = glowN = 0;
    if (sc3 === 'play' || sc3 === 'over') {
      boardRoot.visible = true;
      const b = L.board; if (L.vertical) fitCameraUp({ x: b.x, y: b.y, w: b.w, h: b.h }); else fitCamera({ x: b.x, y: b.y, w: b.w, h: b.h }, { fill: 0.97, pitches: L.land ? [60, 54, 48, 42] : [62, 57, 52, 46, 40, 36], fov: 32, half: L.land ? undefined : 5.2 });
      playScene(state);
    } else if ((sc3 === 'title' || sc3 === 'demo-limit') && v3.heroRect) {
      boardRoot.visible = true;
      const hr = v3.heroRect; fitCamera({ x: hr.x, y: hr.y + hr.h * 0.16, w: hr.w, h: hr.h * 0.84 }, { fill: 0.98, pitches: [34, 30, 26], half: L_.land ? undefined : 5.2, yaw: state.calm ? 0 : Math.sin(clock * 0.2) * 7, fov: 34 });
      heroScene(state);
    } else {
      boardRoot.visible = false; hideAll(); sticksWorld.visible = false; sceneCamera(clock, state.calm);
    }
    hideRings();
    if (boardRoot.visible) { const a = v3.cell(1, 3), b2 = v3.cell(1, 4); v3.cw = Math.max(20, Math.hypot(b2.x - a.x, b2.y - a.y)); }
  }

  function present(state, L, dt) {
    const calm = state.calm;
    sc?.update(dt, camera);
    ambient(dt, calm);
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
    // the stick in the tray: real rotation and a hop while it is thrown, then the right notched face up
    const st = v3.stick;
    if (st && st.r) {
      const r = st.r, size = Math.min(r.w * 1.08, r.h * 4.2), cx = r.x + r.w / 2, cy = -(r.y + r.h * 0.5);
      const spinning = st.spin > 0 && st.spin < 1, f = spinning ? st.spin : 1, v = st.value || 1;
      const turns = spinning ? 5.25 * (1 - ease(f)) * TAU : 0, hop = spinning ? Math.abs(Math.sin(f * Math.PI * 2.6)) * (1 - f) * size * 0.28 : 0;
      hudStick.outer.visible = true; hudStick.outer.scale.setScalar(size * (st.blank && !spinning ? 0.96 : 1));
      hudStick.outer.position.set(cx, cy + size * 0.05 + hop, -300);
      hudStick.outer.rotation.set(0, 0, spinning ? Math.sin(f * 14) * (1 - f) * 0.22 : 0);
      hudStick.inner.rotation.set(1.05 - (st.blank && !spinning ? 0 : (v - 1) * Math.PI / 2) + turns, 0, 0);
      stickShadow.visible = true; stickShadow.scale.set(size, size * 0.2, 1); stickShadow.position.set(cx + size * 0.03, cy - size * 0.09, -312);
      stickShadow.material.opacity = 0.55 * (1 - clamp(hop / (size * 0.28), 0, 1) * 0.7);
    } else { hudStick.outer.visible = false; stickShadow.visible = false; }
    renderer.setViewport(0, 0, W_, H_);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud, hudCam);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; sprites.ready = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnvMap(); } catch (e) { /* no reflections, still playable */ }
    try { buildSprites(); } catch (e) { /* flat spatulas */ }
    W_ = 0; resize(); v3.on = true;
  });

  try {
    initMats(); buildEnvMap(); applyTier(); buildSprites();
  } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  await tick();
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* first frame compiles instead */ }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, v3, sc,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const L = layoutFor(view?.width ?? 720, view?.height ?? 1560, state.flip);
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.stick = null; v3.scrim = 0;
          // The camera is fitted first (the 2D layer asks for projected positions while it draws). On the title screen the hero
          // rectangle is the one the 2D layer reported last frame, so the first frame of that screen is one frame stale.
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          if (state.scene !== 'title' && state.scene !== 'demo-limit') v3.heroRect = null;
          game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
