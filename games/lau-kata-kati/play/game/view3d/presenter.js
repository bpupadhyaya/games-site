// Lau Kata Kati 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: the dusk-lit scene (quilted kantha-cloth hourglass board on a teak platform, padded cloth patches, reed mat,
// hurricane lantern, bottle gourds, fireflies, a village dusk behind; perspective camera fitted to the layout's board rectangle) and a
// screen-space HUD scene (quilted plaques, lacquered buttons) drawn in the same frame.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import { board3d as B, THREE, buildScenery } from '../vendor3d/index.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { sprites } from '../src/art.js';
import { PTS, TOP, buildBoard, makePiece, buildEnvironment, glowTexture, PAL3 } from './models.js';

const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, scn: 'medium' },
  { name: 'medium', dpr: 1.5, shadow: 1024, scn: 'low' },
  { name: 'low', dpr: 1, shadow: 0, scn: 'low' },
];
const SCN_SCALE = Number(new URLSearchParams(location.search).get('ss') || 0.65);

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
  renderer.setClearColor(0x1a1022, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  await tick();
  // ---------------------------------------------------------------- scenes
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 260);
  const envM = buildEnvironment();
  scene.add(envM.group);
  const envMap = B.createEnvironment(renderer, scene, { intensity: 0.5 });
  const rig = B.lightingRig(scene, 'duskOutdoor', {
    renderer, shadow: TIERS[tier].shadow, extent: 6.2, fog: { near: 30, far: 90 },
    overrides: { bg: 0x6c5a78, fog: 0xc7907a, hemi: 0.5, hemiSky: 0xffd6b0, hemiGround: 0x4a3a30, keyI: 2.1, key: 0xffc58a, keyPos: [-7.5, 8.5, 5.5], rimI: 1.4, rim: 0xff9a6a, rimPos: [6, 4, -7], fill: 0x8aa0e8, fillI: 0.45, exposure: 0.95, env: 0.45 },
  });
  const key = rig.key;

  // the village dusk behind the mat (shared scenery kit), scaled so a board unit is about 0.1 m
  const scnRoot = new THREE.Group(); scnRoot.scale.setScalar(SCN_SCALE); scnRoot.position.y = -0.12; scene.add(scnRoot);
  let scenery = null;
  // a Bengal village at dusk: paddy fields and tree line beyond, thatched huts and haystacks behind the mat, packed earth underfoot
  const LAYERS = (sky, ground) => [
    { t: 'sky', id: sky }, { t: 'backdrop', id: 'bd-rice' },
    { t: 'ground', id: ground, size: 160, repeat: 30 },
    { t: 'band', id: 'band-fields', r: 85, h: 12 },
    { t: 'cutouts', id: 'st-thatch-stilt-house', count: 3, r: [36, 48], arc: [-150, -30], scale: [7, 9], seed: 2 },
    { t: 'cutouts', id: 'st-wood-house', count: 2, r: [44, 54], arc: [-150, -30], scale: [8, 9], seed: 5 },
    { t: 'cutouts', id: 'tr-broad-tree', count: 4, r: [30, 52], scale: [6, 9], seed: 13, sway: 0.8, arc: [-160, -20] },
    { t: 'scatter', kind: 'haystack', count: 4, r: [20, 30], seed: 4, arc: [-150, -30] },
  ];
  const loadScenery = () => {
    try {
      const opts = { timeOfDay: qs.get('tod') || 'dusk', season: 'summer', quality: TIERS[tier].scn, wind: 0.5, clouds: 0.6 };
      if (qs.has('scn')) opts.preset = qs.get('scn'); else { opts.layers = LAYERS(qs.get('sky') || 'sky-golden', qs.get('ground') || 'gr-paddy'); opts.culture = 'south-asian'; }
      const s = buildScenery(opts);
      s.ready.then(() => { scnRoot.add(s.group); scenery = s; }).catch((e) => console.warn('scenery failed', e));
    } catch (e) { console.warn('scenery unavailable', e); }
  };
  if (!qs.has('noscn')) loadScenery();

  const hud = new THREE.Scene();
  const hudCam = new THREE.PerspectiveCamera();
  const hudLight = new THREE.DirectionalLight(0xfff0e0, 1.7); hudLight.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0xffa88a, 0.5); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe2cc, 0x241830, 0.65), hudLight, hudFill);
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  await tick();
  // ---------------------------------------------------------------- the board (rebuilt when the cloth changes) and its orientation
  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  const boards = {}; let boardKind = null;
  function ensureBoard(kind) {
    if (boardKind === kind) return;
    for (const k of Object.keys(boards)) boards[k].visible = false;
    if (!boards[kind]) { boards[kind] = buildBoard(kind); boardRoot.add(boards[kind]); }
    boards[kind].visible = true; boardKind = kind;
  }
  const viewS = { rot: false, flip: false };
  // board units -> world: the layout lays the board on its side (rot) and/or half way round (flip); positions follow it exactly
  const pos3 = (i) => { const p = PTS[i]; let x = viewS.rot ? p[1] : p[0], z = viewS.rot ? p[0] : p[1]; if (viewS.flip) { x = -x; z = -z; } return { x, z }; };
  const boardYaw = () => (viewS.rot ? Math.PI / 2 : 0) + (viewS.flip ? Math.PI : 0);
  const pieceRoot = new THREE.Group(); scene.add(pieceRoot);
  const hlRoot = new THREE.Group(); scene.add(hlRoot);

  await tick();
  // ---------------------------------------------------------------- piece pools
  let style = 'classic';
  const pools = {}; const used = {};
  function wrapFor(side, k) {
    const pool = pools[side] || (pools[side] = []);
    while (pool.length <= k) {
      const wrap = new THREE.Group(), model = makePiece(side, style);
      const sh = B.contactShadow(0.5, 0.62); wrap.add(sh, model);
      wrap.userData = { model, shadow: sh }; pieceRoot.add(wrap); wrap.visible = false; pool.push(wrap);
    }
    return pool[k];
  }
  function setStyle(s) {
    if (s === style) return; style = s;
    for (const k of Object.keys(pools)) { for (const w of pools[k]) pieceRoot.remove(w); pools[k].length = 0; }
  }
  // critically-damped-ish lift per point so selection / winner hops never pop
  const liftS = new Map();
  const lift2 = (key, target, dt) => { let v = liftS.get(key) ?? 0; v += (target - v) * Math.min(1, dt * 14); liftS.set(key, v); return v; };
  const hideAll = () => { for (const k of Object.keys(pools)) for (const w of pools[k]) w.visible = false; for (const k of Object.keys(used)) used[k] = 0; };
  const ids = new WeakMap(); let idn = 0;
  const aid = (a) => { let v = ids.get(a); if (!v) { v = ++idn; ids.set(a, v); } return v; };
  function put(side, x, z, o = {}) {
    const k = used[side] || 0; used[side] = k + 1;
    const w = wrapFor(side, k); w.visible = true; w.position.set(x, TOP, z);
    const m = w.userData.model, sh = w.userData.shadow, lift = o.lift || 0, s = o.scale ?? 1, sq = o.squash || 0;
    m.position.y = lift; m.rotation.y = (o.yaw || 0) + (o.spin || 0); m.rotation.x = o.tilt || 0; m.rotation.z = o.roll || 0;
    m.scale.set(s * (1 + sq * 0.5), s * (1 - sq), s * (1 + sq * 0.5));
    sh.scale.setScalar(s * (1 - clamp(lift * 0.35, 0, 0.45))); sh.material.opacity = 0.6 * (1 - clamp(lift * 0.5, 0, 0.6));
    return w;
  }

  await tick();
  // ---------------------------------------------------------------- highlights: glowing rings + soft pools
  const ringPools = new Map(), blobPool = []; let ringUse = new Map(), blobN = 0;
  const glowTex = glowTexture('255,255,255', 0.95);
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  function ring(x, z, color, size, op = 1, y = TOP + 0.014) {
    let pool = ringPools.get(color); if (!pool) { pool = []; ringPools.set(color, pool); }
    const n = ringUse.get(color) || 0; ringUse.set(color, n + 1);
    let m = pool[n];
    if (!m) { m = B.glowRing(0.5, color); m.material.fog = false; hlRoot.add(m); pool.push(m); }
    m.visible = true; m.position.set(x, y, z); m.scale.setScalar(size); m.material.opacity = clamp(op, 0, 1);
    return m;
  }
  function pool(x, z, color, size, op, y = TOP + 0.01) {
    let m = blobPool[blobN++];
    if (!m) { m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; hlRoot.add(m); blobPool.push(m); }
    m.visible = true; m.material.color.set(color); m.material.opacity = op; m.position.set(x, y, z); m.scale.set(size, 1, size);
  }
  const hlBegin = () => { ringUse = new Map(); blobN = 0; };
  const hlEnd = () => { for (const [c, p] of ringPools) { const n = ringUse.get(c) || 0; for (let i = n; i < p.length; i++) p[i].visible = false; } for (let i = blobN; i < blobPool.length; i++) blobPool[i].visible = false; };

  await tick();
  // ---------------------------------------------------------------- particles: gold sparks, loose thread ends and cotton fluff, marigold petals
  const MAXP = 90;
  const sparkMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe3a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), MAXP);
  const threadMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.014, 0.022), new THREE.MeshStandardMaterial({ color: 0xfff1d2, roughness: 1 }), MAXP);
  const petalGeo = new THREE.CircleGeometry(0.11, 8); petalGeo.scale(1, 1.5, 1);
  const petalMesh = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ color: 0xff9a1c, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x6a2a00, emissiveIntensity: 0.55 }), MAXP);
  sparkMesh.frustumCulled = threadMesh.frustumCulled = petalMesh.frustumCulled = false; scene.add(sparkMesh, threadMesh, petalMesh);
  const sparks = [], threads = [], petals = []; const keys = new Set();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
  const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  let rseed = 1;
  function burst(x, y, z, n, kind = 'both') {
    for (let i = 0; i < n; i++) {
      const a = rnd(rseed++) * TAU, sp = 0.6 + rnd(rseed++) * 1.1;
      if (kind === 'sparks' || kind === 'both') sparks.push({ x, y, z, vx: Math.cos(a) * sp, vy: 1.4 + rnd(rseed++) * 1.5, vz: Math.sin(a) * sp, life: 0, max: 0.6 + rnd(rseed++) * 0.5 });
      if (kind === 'threads' || kind === 'both') threads.push({ x, y: y - 0.05, z, vx: Math.cos(a) * sp * 0.8, vy: 0.9 + rnd(rseed++) * 1.1, vz: Math.sin(a) * sp * 0.8, life: 0, max: 0.8 + rnd(rseed++) * 0.5, rx: rnd(rseed++) * 6, rs: 3 + rnd(rseed++) * 7, ry: a });
      if (kind === 'petals') petals.push({ x, y, z, vx: Math.cos(a) * sp * 0.7, vy: 1.6 + rnd(rseed++) * 1.6, vz: Math.sin(a) * sp * 0.7, life: 0, max: 1.6 + rnd(rseed++) * 0.9, rx: rnd(rseed++) * 6, rs: 2 + rnd(rseed++) * 4, ph: rnd(rseed++) * 6 });
    }
    if (sparks.length > MAXP) sparks.splice(0, sparks.length - MAXP);
    if (threads.length > MAXP) threads.splice(0, threads.length - MAXP);
    if (petals.length > MAXP) petals.splice(0, petals.length - MAXP);
  }
  function stepParts(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.life += dt; p.vy -= 4.4 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.life >= p.max) sparks.splice(i, 1); }
    for (let i = threads.length - 1; i >= 0; i--) { const p = threads[i]; p.life += dt; p.vy -= 3.2 * dt; p.vx *= 1 - 1.2 * dt; p.vz *= 1 - 1.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rx += p.rs * dt; if (p.life >= p.max || p.y < TOP - 0.02) threads.splice(i, 1); }
    for (let i = petals.length - 1; i >= 0; i--) { const p = petals[i]; p.life += dt; p.vy -= 1.7 * dt; if (p.vy < -0.45) p.vy = -0.45; p.x += (p.vx + Math.sin(p.life * 3 + p.ph) * 0.5) * dt; p.y += p.vy * dt; p.z += (p.vz + Math.cos(p.life * 2.6 + p.ph) * 0.5) * dt; p.rx += p.rs * dt; if (p.life >= p.max || p.y < TOP - 0.02) petals.splice(i, 1); }
    for (let i = 0; i < MAXP; i++) {
      const p = sparks[i];
      if (!p) _m.makeScale(0, 0, 0); else { const k = 1 - p.life / p.max; _p.set(p.x, p.y, p.z); _s.setScalar(0.5 + k); _m.compose(_p, _q.identity(), _s); }
      sparkMesh.setMatrixAt(i, _m);
      const c = threads[i];
      if (!c) _m.makeScale(0, 0, 0); else { _p.set(c.x, c.y, c.z); _s.setScalar(1 - c.life / c.max * 0.4); _q.setFromEuler(_e.set(c.rx, c.ry, c.rx * 0.6)); _m.compose(_p, _q, _s); }
      threadMesh.setMatrixAt(i, _m);
      const f = petals[i];
      if (!f) _m.makeScale(0, 0, 0); else { _p.set(f.x, f.y, f.z); _s.setScalar(1 - Math.max(0, f.life / f.max - 0.7) * 3); _q.setFromEuler(_e.set(-Math.PI / 2 + Math.sin(f.rx) * 0.9, f.rx * 0.5, Math.cos(f.rx * 0.8) * 0.8)); _m.compose(_p, _q, _s); }
      petalMesh.setMatrixAt(i, _m);
    }
    sparkMesh.instanceMatrix.needsUpdate = threadMesh.instanceMatrix.needsUpdate = petalMesh.instanceMatrix.needsUpdate = true;
  }
  const once = (k) => { if (keys.has(k)) return false; keys.add(k); if (keys.size > 60) keys.delete(keys.values().next().value); return true; };

  await tick();
  // ---------------------------------------------------------------- HUD plaques and buttons (teak frame, brass line, quilted cloth)
  const hudPanels = [], hudButtons = [];
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 150) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const teak = B.material('darkWood', { color: '#5a3216', color2: '#8a5226', repeat: [3, 3], size: 512, seed: 7 });
  const brassM = B.material('brass', { color: '#c79a3a', color2: '#f0d27a', seed: 3 });
  const quilt = (c0, c1, em) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'); x.fillStyle = c0; x.fillRect(0, 0, 256, 256);
    for (let p = 0; p < 256; p += 4) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(p, 0, 1, 256); x.fillStyle = 'rgba(0,0,0,0.07)'; x.fillRect(0, p, 256, 1); }
    x.strokeStyle = c1; x.lineWidth = 2.4; x.setLineDash([7, 8]); x.lineCap = 'round';
    for (let r = 10; r < 256; r += 21) { x.beginPath(); for (let s = -8; s <= 264; s += 12) { const o = Math.sin(s * 0.06 + r * 0.1) * 3; if (s === -8) x.moveTo(s, r + o); else x.lineTo(s, r + o); } x.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 3); t.anisotropy = 4;
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, metalness: 0 });
    if (em) { m.emissive = new THREE.Color(em); m.emissiveIntensity = 0.6; }
    return m;
  };
  const clothN = quilt('#202e6e', 'rgba(255,241,210,0.28)'), clothOn = quilt('#6a2420', 'rgba(255,230,190,0.32)', '#2a0a08'), clothDoc = quilt('#161f55', 'rgba(255,241,210,0.18)'), clothToast = quilt('#12183f', 'rgba(255,241,210,0.14)');
  const lacq = (c, em) => { const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.18, envMapIntensity: 0.3 }); if (em) { m.emissive = new THREE.Color(em); m.emissiveIntensity = 0.5; } return m; };
  const lacqPrimary = lacq('#d23a30', '#3a0a06'), lacqNormal = lacq('#27388a', '#080c24'), lacqOn = lacq('#8a3028', '#2a0a08');
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x0a0618, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  const ROT = Math.PI / 2;
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) {
      const g = new THREE.Group(), outer = new THREE.Mesh(flat, teak), trim = new THREE.Mesh(flat, brassM), inner = new THREE.Mesh(flat, clothN);
      g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p);
    }
    return p;
  }
  function placePanel(i, r, rad, kind) {
    const p = panelAt(i); p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -700, dep = kind === 'toast' ? 8 : 14, ins = kind === 'doc' ? 10 : 7;
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.6); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.5, Math.max(3, rad - ins), 2.2); p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    p.inner.material = kind === 'plateOn' ? clothOn : kind === 'doc' ? clothDoc : kind === 'toast' ? clothToast : clothN;
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(flat, lacqNormal), rim = new THREE.Mesh(flat, brassM); g.add(rim, body); hud.add(g); b = { g, body, rim }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt, pressed) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(18, r.h / 3), z = -400, dep = pressed ? 8 : 18;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, rad - 2, 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.body.material = bt.primary ? lacqPrimary : bt.on ? lacqOn : lacqNormal;
    b.g.position.set(0, pressed ? -3 : 0, 0);
  }

  await tick();
  // ---------------------------------------------------------------- camera fitting
  let W = 1, H = 1, dprNow = 1, L_ = null, hudW = 0, hudH = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  // rect = the board's rectangle in virtual units (cloth width w, depth h); fit its width, and its height if that is the tighter limit
  function fitCamera(rect, L, pitchDeg, fov, yawDeg = 0) {
    const k = W / L.w, targetW = (rect.w + 10) * k, targetH = rect.h * k * 1.04, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180, lookY = 0.15;
    const hx = (viewS.rot ? 3.6 : 3.05) + 0.2, hz = (viewS.rot ? 3.05 : 3.6) + 0.2;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    let d = 24;
    const place = () => {
      camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    for (let it = 0; it < 6; it++) {
      place();
      const a = tmpV.set(-hx, 0.1, hz).project(camera), b = tmpW.set(hx, 0.1, hz).project(camera);
      const wNow = ((b.x - a.x) / 2) * W;
      const fz = tmpV.set(0, 0.1, -hz).project(camera), nz = tmpW.set(0, 0.1, hz).project(camera);
      const hNow = ((fz.y - nz.y) / 2) * H;
      d *= Math.max(wNow / targetW, hNow / targetH);
    }
    place();
    if (scene.fog) { scene.fog.near = d + 20; scene.fog.far = d + 70; }
    const c0 = tmpV.set(0, 0.1, 0).project(camera);
    const px0 = ((c0.x + 1) / 2) * W, py0 = ((1 - c0.y) / 2) * H, cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + (rect.h ?? rect.w) / 2) * k;
    camera.setViewOffset(W, H, px0 - cxp, py0 - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => { tmpV.set(x, y, z); tmpV.project(camera); return { x: ((tmpV.x + 1) / 2) * L_.w, y: ((1 - tmpV.y) / 2) * L_.h }; };
  v3.sq = (i) => { const p = pos3(i); return toVirt(p.x, TOP, p.z); };
  let occupied = new Set();
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3();
  function planePoint(vx, vy, y) {
    const ndcx = (vx / L_.w) * 2 - 1, ndcy = 1 - (vy / L_.h) * 2;
    orig.copy(camera.position); ray.set(ndcx, ndcy, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return null;
    const t = (y - orig.y) / ray.y; if (t < 0) return null;
    hitV.copy(orig).addScaledVector(ray, t); return hitV;
  }
  v3.pick = (vx, vy) => {
    if (!L_) return -1;
    let best = -1, bd = 1e9;
    const c0 = pos3(0), c1 = pos3(1), v0 = toVirt(c0.x, TOP, c0.z), v1 = toVirt(c1.x, TOP, c1.z);
    const unit = Math.hypot(v1.x - v0.x, v1.y - v0.y) / Math.max(0.3, Math.hypot(c1.x - c0.x, c1.z - c0.z)) || 50;
    for (let i = 0; i < PTS.length; i++) {
      const p = pos3(i), base = toVirt(p.x, TOP + 0.02, p.z);
      let cx = base.x, cy = base.y, ry = unit * 0.34;
      if (occupied.has(i)) { const top = toVirt(p.x, TOP + 0.4, p.z); cy = (base.y + top.y) / 2; ry = Math.abs(base.y - top.y) / 2 + unit * 0.28; }
      const rx = unit * 0.42, dx = (vx - cx) / rx, dy = (vy - cy) / ry, dd = dx * dx + dy * dy;
      if (dd <= 1 && dd < bd) { bd = dd; best = i; }
    }
    if (best >= 0) return best;
    const h = planePoint(vx, vy, TOP); if (!h) return -1;
    let nb = -1, nd = 0.5 * 0.5;
    for (let i = 0; i < PTS.length; i++) { const p = pos3(i), d2 = (p.x - h.x) ** 2 + (p.z - h.z) ** 2; if (d2 < nd) { nd = d2; nb = i; } }
    return nb;
  };
  v3.drag = (vx, vy) => { const h = planePoint(vx, vy, TOP + 0.3); return h ? { x: h.x, z: h.z } : null; };

  await tick();
  // ---------------------------------------------------------------- sprites: the same patches rendered once for the 2D layer (plates, trays, result card, diagrams)
  function buildSprites() {
    const SP = 256, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(13, 1, 1, 60);
    const l1 = new THREE.DirectionalLight(0xfff0e0, 3.1); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0xffa080, 1.2); l2.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xffe6d0, 0x4a3050, 1.2), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.7;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0);
    const smap = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    for (const st of ['classic', 'bead']) for (const side of [1, 2]) {
      const m = makePiece(side, st), grp = new THREE.Group(); grp.add(m); grp.rotation.y = 0.35; sc.add(grp);
      const dist = 8.4, pitch = (30 * Math.PI) / 180, ty = st === 'bead' ? 0.17 : 0.1;
      cam.position.set(0, ty + Math.sin(pitch) * dist, Math.cos(pitch) * dist); cam.lookAt(0, ty, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sc.remove(grp);
      sprites.piece[`${side}|${st}`] = c;
      if (!sprites.anchor) { const b = new THREE.Vector3(0, 0, 0).project(cam); sprites.anchor = { x: (b.x + 1) / 2, y: (1 - b.y) / 2, span: 2 * dist * Math.tan((13 * Math.PI) / 360) }; }
    }
    renderer.setClearColor(0x1a1022, 1);
    renderer.setPixelRatio(pr); renderer.setSize(szw, szh, false);
    renderer.shadowMap.enabled = smap;
    W = 0;
    sprites.ready = true;
  }

  await tick();
  // ---------------------------------------------------------------- frame
  let lastT = 0, clock = 0, frames = 0, ema = 16;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  let frameDt = 0.016, traceBuf = null;
  function boardState(state) {
    const g = state.game, a = state.anim, over = state.scene === 'over', lesson = state.scene === 'lesson', idle = clock;
    occupied = new Set(); hideAll(); hlBegin();
    const sel = state.sel, dragging = state.drag && sel >= 0, movingTo = a ? a.to : -1;
    for (let i = 0; i < PTS.length; i++) {
      const v = g.board[i]; if (!v || i === movingTo) { liftS.delete(i); continue; }
      occupied.add(i);
      if (dragging && i === sel) continue;
      const p = pos3(i);
      let tl = 0;
      if (sel === i && !a && !over) tl = 0.2 + (state.calm ? 0 : Math.sin(idle * 3) * 0.03);
      if (over && g.winner && g.winner !== 3 && v === g.winner && !state.calm) tl = Math.abs(Math.sin(idle * 3.2 + i * 0.7)) * 0.24;
      const lift = lift2(i, tl, frameDt);
      put(v, p.x, p.z, { lift, yaw: (i * 0.77) % 1.0 });
      if (sel === i && !a && !over) pool(p.x, p.z, '#ffe08a', 1.35, 0.45 + 0.2 * Math.sin(idle * 5));
    }
    if (a && a.caps.length) {
      a.caps.forEach((q, n) => {
        const t0 = a.segT * (n + 0.55), p = pos3(q), side = 3 - a.side;
        occupied.add(q);
        if (a.t < t0) { put(side, p.x, p.z, { yaw: (q * 0.77) % 1.0 }); return; }
        const f = (a.t - t0) / 0.55; if (f >= 1) return;
        if (once(`cap${aid(a)}|${q}|${n}`)) burst(p.x, TOP + 0.2, p.z, 10, 'both');
        const e = ease(f);
        put(side, p.x, p.z, { lift: e * 1.1, scale: 1.05 - 0.4 * e, spin: e * 7, tilt: e * 0.9 * (q % 2 ? 1 : -1), yaw: (q * 0.77) % 1.0 });
        if (f < 0.3) ring(p.x, p.z, '#ff8a4a', 0.8 + f * 2, 0.9 * (1 - f / 0.3));
      });
    }
    if (a) {
      const segs = Math.max(1, a.path.length - 1), u = clamp(a.t / a.segT, 0, segs), k = Math.min(segs - 1, Math.floor(u)), f = u - k, e = ease(f);
      const p0 = pos3(a.path[k]), p1 = pos3(a.path[k + 1]);
      const x = p0.x + (p1.x - p0.x) * e, z = p0.z + (p1.z - p0.z) * e, dist = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      const landed = a.t >= a.glide, since = a.t - a.glide;
      const hopLift = Math.sin(Math.PI * e) * (a.jump ? 0.85 : 0.32 + Math.min(0.25, dist * 0.08)) + (k === 0 ? 0.2 * (1 - e) : 0);   // lift follows the eased plan position: zero vertical speed at take-off and touch-down
      const settle = landed ? Math.exp(-since * 9) * Math.sin(since * 26) * 0.16 : 0;
      const pe = pos3(a.to);
      // the padded patch compresses on landing and rocks as it settles; in flight it tilts a little along its path
      const dir = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      if (traceBuf) traceBuf.push({ t: clock, x: landed ? pe.x : x, z: landed ? pe.z : z, y: landed ? Math.max(0, -settle) * 0.5 : hopLift, sq: landed ? settle * 0.6 : 0, yaw: dir, at: a.t });
      put(a.side, landed ? pe.x : x, landed ? pe.z : z, { lift: landed ? Math.max(0, -settle) * 0.5 : hopLift, squash: landed ? settle * 0.6 : 0, roll: landed && !state.calm ? Math.exp(-since * 8) * Math.sin(since * 24) * 0.12 : 0, tilt: !landed && !state.calm ? Math.sin(Math.PI * f) * 0.18 : 0, yaw: dir });
      occupied.add(a.to);
      if (!landed) {
        pool(x, z, '#ffd98a', 1.2, 0.5);
        if (!state.calm) { sparks.push({ x, y: TOP + hopLift + 0.2, z, vx: 0, vy: 0.2, vz: 0, life: 0, max: 0.35 }); if (sparks.length > MAXP) sparks.shift(); }
        for (let b = 1; b <= 4; b++) { const uu = b / 5; if (uu > f) break; const bx = p0.x + (p1.x - p0.x) * uu, bz = p0.z + (p1.z - p0.z) * uu, by = Math.sin(Math.PI * uu) * (a.jump ? 0.85 : 0.4); pool(bx, bz, '#ffcf7a', 0.26 + by * 0.1, 0.4 * (1 - (f - uu)), TOP + by * 0.9 + 0.1); }
      } else {
        if (once(`land${aid(a)}`)) burst(pe.x, TOP + 0.1, pe.z, a.caps.length ? 7 : 3, 'threads');   // loose thread ends and fluff puff out of the cloth
        if (since < 0.5) { const ff = since / 0.5; ring(pe.x, pe.z, '#fff0c0', 0.7 + ff * 1.6, 0.9 * (1 - ff)); }
      }
    }
    if (dragging) {
      const dp = v3.drag(state.drag.x, state.drag.y);
      if (dp) { put(g.board[sel] || g.turn, dp.x, dp.z, { lift: 0.4 }); pool(dp.x, dp.z, '#ffe08a', 1.5, 0.4); }
    }
    // highlights
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(clock * 5);
    const last = a ? null : g.last;
    if (last && !lesson) for (const q of [last.from, last.to]) { const p = pos3(q); pool(p.x, p.z, '#ffd26a', 1.0, 0.3); }
    if (sel >= 0 && !a && !over) for (const m of state.selMoves || []) {
      const p = pos3(m.to);
      if (m.caps) { ring(p.x, p.z, '#ff4a26', 0.95 + pulse * 0.06, 0.8 + pulse * 0.2); pool(p.x, p.z, '#ff5a30', 1.05, 0.3 + pulse * 0.2); }
      else { ring(p.x, p.z, '#ffe08a', 0.62 + pulse * 0.05, 0.75 + pulse * 0.25); pool(p.x, p.z, '#ffd36a', 0.7, 0.35 + pulse * 0.15); }
    }
    if (state.hint && !a) for (const q of [state.hint.from, state.hint.to]) { const p = pos3(q); ring(p.x, p.z, '#5af09a', 1.05, 0.9); pool(p.x, p.z, '#5af09a', 1.15, 0.35 + pulse * 0.2); }
    for (const mk of v3.marks) { const p = pos3(mk.i); ring(p.x, p.z, mk.color || '#ff6a3a', 1.0 + pulse * 0.06, 0.8 + pulse * 0.2); }
    if (state.kb && !over) { const p = pos3(state.cursor); ring(p.x, p.z, '#7dff9a', 1.05, 1); }
    // the winning moment: marigold petals fall over the board
    if (over && g.winner && !state.calm && Math.floor(clock * 9) !== boardState.lastTick) { boardState.lastTick = Math.floor(clock * 9); burst((Math.random() - 0.5) * 4, TOP + 2.2, (Math.random() - 0.5) * 4, 1, 'petals'); if (boardState.lastTick % 3 === 0) burst((Math.random() - 0.5) * 2.4, TOP + 0.2, (Math.random() - 0.5) * 2.4, 1, 'sparks'); }
    hlEnd();
  }

  // the title / documents backdrop: a looping demonstration on the real board (Gold jumps twice in one turn: 14 -> 0 -> 5)
  function heroState(state) {
    const T = state.frozen ? 3.2 : state.calm ? 3.2 : state.t % 7.4;
    hideAll(); hlBegin(); occupied = new Set();
    const op = T < 0.5 ? T / 0.5 : T > 6.8 ? Math.max(0, 1 - (T - 6.8) / 0.6) : 1, sc = 0.25 + 0.75 * ease(op);
    const gold = [12, 13, 15, 16, 17, 18], ruby = [1, 3, 4, 6, 7, 8, 9];
    for (const i of gold) { const p = pos3(i); put(1, p.x, p.z, { scale: sc, yaw: (i * 0.77) % 1.0 }); }
    for (const i of ruby) { const p = pos3(i); put(2, p.x, p.z, { scale: sc, yaw: (i * 0.77) % 1.0 }); }
    const t1 = 1.3, t2 = 2.2, seg = 0.8;
    for (const [q, tc] of [[11, t1 + seg * 0.55], [2, t2 + seg * 0.55]]) {
      const p = pos3(q);
      if (T < tc) put(2, p.x, p.z, { scale: sc, yaw: (q * 0.77) % 1.0 });
      else { const f = (T - tc) / 0.55; if (f < 1) { const e = ease(f); put(2, p.x, p.z, { lift: e * 1.0, scale: 1.05 - 0.4 * e, spin: e * 7, tilt: e * 0.8 }); if (once(`h${q}${Math.floor(state.t / 7.4)}`)) burst(p.x, TOP + 0.2, p.z, 9, 'both'); } }
    }
    const A = pos3(14), B1 = pos3(0), C = pos3(5);
    let x = A.x, z = A.z, lift = 0, f;
    if (T >= t1 && T < t2) { f = clamp((T - t1) / seg, 0, 1); const e = ease(f); x = A.x + (B1.x - A.x) * e; z = A.z + (B1.z - A.z) * e; lift = Math.sin(Math.PI * f) * 0.85; }
    else if (T >= t2) { f = clamp((T - t2) / seg, 0, 1); const e = ease(f); x = B1.x + (C.x - B1.x) * e; z = B1.z + (C.z - B1.z) * e; lift = Math.sin(Math.PI * f) * 0.85; }
    else lift = T > 0.8 ? clamp((T - 0.8) / 0.4, 0, 1) * 0.35 : 0;
    put(1, x, z, { lift, scale: sc, yaw: 0.4 });
    if (T > 0.8 && T < t1) pool(x, z, '#ffd98a', 1.4, 0.5);
    if (T >= t2 + seg && T < t2 + seg + 0.6) { const ff = (T - t2 - seg) / 0.6; ring(C.x, C.z, '#ffd24a', 0.8 + ff * 2, 1 - ff); if (once(`hw${Math.floor(state.t / 7.4)}`)) burst(C.x, TOP + 0.3, C.z, 14, 'sparks'); }
    hlEnd();
  }

  await tick();
  // ----- phase 1: before the 2D UI draws (camera, pieces, projection used by the 2D badges and picking)
  function prepare(state, L) {
    resize(); L_ = L; if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const kind = PAL3[state.wood] ? state.wood : 'indigo';
    ensureBoard(kind); setStyle(state.style === 'bead' ? 'bead' : 'classic');
    const sc = state.scene, playing = sc === 'play' || sc === 'over' || sc === 'lesson';
    viewS.rot = playing ? !!L.rot : true; viewS.flip = playing ? !!state.flip : false;
    boardRoot.rotation.y = boardYaw();
    v3.scene = sc;
    if (sc === 'title' || sc === 'demo-limit') {
      const hr = v3.heroRect || { x: L.w * 0.08, y: L.h * 0.4, w: L.w * 0.84, h: L.w * 0.5 };
      fitCamera(hr, L, L.land ? 40 : 38, 36, state.calm ? 0 : Math.sin(clock * 0.2) * 7);
      heroState(state);
    } else if (sc === 'doc') {
      fitCamera({ x: L.w * 0.06, y: L.h * 0.3, w: L.w * 0.88, h: L.w * 0.55 }, L, 40, 34, state.calm ? 0 : Math.sin(clock * 0.15) * 8);
      heroState(state);
    } else {
      const b = L.board;
      fitCamera({ x: b.x, y: b.y, w: b.w, h: b.h }, L, L.land ? 52 : (viewS.rot ? 54 : 60), 30, 0);
      boardState(state);
    }
  }

  await tick();
  // ----- phase 2: after the 2D UI recorded its panels and buttons
  const camLocal = { position: { x: 0, z: 0 } };
  function present(state, L, dt) {
    envM.update(clock, state.calm);
    if (scenery) { camLocal.position.x = camera.position.x / SCN_SCALE; camLocal.position.z = camera.position.z / SCN_SCALE; scenery.update(state.calm ? 0 : dt, camLocal); }
    stepParts(dt);
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p.r, p.rad, p.kind);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0; const pr = v3.pressed;
    for (const b of v3.buttons) {
      const pressed = !!pr && pr.x >= b.r.x && pr.x <= b.r.x + b.r.w && pr.y >= b.r.y && pr.y <= b.r.y + b.r.h;
      placeButton(n++, b, pressed);
    }
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, -520);
    hud.environment = scene.environment; hud.environmentIntensity = 0.3;
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud, hudCam);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { envMap.rebuild(); } catch (e) { /* no reflections, still playable */ }
    W = 0; resize(); v3.on = true;
  });

  try {
    applyTier(); ensureBoard('indigo'); buildSprites();
  } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  await tick();
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* first frame compiles instead */ }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, get scenery() { return scenery; },
    startTrace() { traceBuf = []; }, stopTrace() { const t = traceBuf; traceBuf = null; return t; },
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
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt; frameDt = dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.marks.length = 0; v3.scrim = 0;
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
