// Kharbaga 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: the lamplit board scene (carved board, sculpted pucks, market rug, brass lanterns, drifting embers, perspective
// camera fitted to the layout's board rectangle) and a screen-space HUD scene (carved plaques, lacquered buttons) drawn in the same frame.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import { board3d as B, THREE } from '../vendor3d/index.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { sprites } from '../src/art.js';
import { NC, OUT, HALF, TILE_TOP, FH, cellX, cellZ, buildBoard, makePiece, buildEnvironment, glowTexture } from './models.js';

const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048 },
  { name: 'medium', dpr: 1.5, shadow: 1024 },
  { name: 'low', dpr: 1, shadow: 0 },
];

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
  renderer.setClearColor(0x160c07, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  await tick();
  // ---------------------------------------------------------------- scenes
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
  const envM = buildEnvironment();
  scene.add(envM.group);
  const envMap = B.createEnvironment(renderer, scene, { intensity: 0.35 });
  const rig = B.lightingRig(scene, 'warmIndoor', {
    renderer, shadow: TIERS[tier].shadow, extent: 5.4, fog: { near: 16, far: 46 },
    overrides: { bg: 0x120a06, fog: 0x1a0f08, hemi: 0.5, hemiSky: 0xffdcae, hemiGround: 0x4a2c1c, keyI: 2.7, key: 0xffd2a0, keyPos: [-4.6, 9.5, 6.2], rimI: 1.5, rim: 0xffa868, rimPos: [5, 4.5, -6], fillI: 0.35, exposure: 1.12 },
  });
  const key = rig.key;

  const hud = new THREE.Scene();
  const hudCam = new THREE.PerspectiveCamera();
  const hudLight = new THREE.DirectionalLight(0xfff0d8, 1.7); hudLight.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0xffb27a, 0.5); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe2bc, 0x2a1810, 0.6), hudLight, hudFill);
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  await tick();
  // ---------------------------------------------------------------- the board (rebuilt when the board kind changes)
  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  const boards = {};
  let boardKind = null;
  function ensureBoard(kind) {
    if (boardKind === kind) return;
    for (const k of Object.keys(boards)) boards[k].visible = false;
    if (!boards[kind]) { boards[kind] = buildBoard(kind); boardRoot.add(boards[kind]); }
    boards[kind].visible = true; boardKind = kind;
  }
  const pieceRoot = new THREE.Group(); boardRoot.add(pieceRoot);
  const hlRoot = new THREE.Group(); boardRoot.add(hlRoot);

  await tick();
  // ---------------------------------------------------------------- piece pools
  let style = 'stone';
  const pools = {};                              // `${v}` -> [wrap]
  const used = {};
  function wrapFor(v, k) {
    const pool = pools[v] || (pools[v] = []);
    while (pool.length <= k) {
      const wrap = new THREE.Group(), model = makePiece(v & 1 ? 1 : 2, style, v > 2);
      const sh = B.contactShadow(0.62, 0.62); wrap.add(sh, model);
      wrap.userData = { model, shadow: sh, v }; pieceRoot.add(wrap); wrap.visible = false; pool.push(wrap);
    }
    return pool[k];
  }
  function setStyle(s) {
    if (s === style) return; style = s;
    for (const k of Object.keys(pools)) { for (const w of pools[k]) pieceRoot.remove(w); pools[k].length = 0; }
  }
  const hideAll = () => { for (const k of Object.keys(pools)) for (const w of pools[k]) w.visible = false; for (const k of Object.keys(used)) used[k] = 0; };
  const ids = new WeakMap(); let idn = 0;
  const aid = (a) => { let v = ids.get(a); if (!v) { v = ++idn; ids.set(a, v); } return v; };
  function put(v, x, z, o = {}) {
    const k = used[v] || 0; used[v] = k + 1;
    const w = wrapFor(v, k); w.visible = true; w.position.set(x, TILE_TOP, z);
    const m = w.userData.model, sh = w.userData.shadow, lift = o.lift || 0, s = o.scale ?? 1, sq = o.squash || 0;
    m.position.y = lift; m.rotation.y = flipYaw + (o.yaw || 0) + (o.spin || 0); m.rotation.x = o.tilt || 0; m.rotation.z = o.roll || 0;
    m.scale.set(s * (1 + sq * 0.5), s * (1 - sq), s * (1 + sq * 0.5));
    sh.scale.setScalar(s * (1 - clamp(lift * 0.35, 0, 0.45))); sh.material.opacity = 0.62 * (1 - clamp(lift * 0.5, 0, 0.6));
    return w;
  }

  await tick();
  // ---------------------------------------------------------------- highlights: glowing inlay rings + soft pools
  const ringPools = new Map(), blobPool = []; let ringUse = new Map(), blobN = 0;
  const glowTex = glowTexture('255,255,255', 0.95);
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  function ring(x, z, color, size, op = 1, y = TILE_TOP + 0.012) {
    let pool = ringPools.get(color); if (!pool) { pool = []; ringPools.set(color, pool); }
    const n = ringUse.get(color) || 0; ringUse.set(color, n + 1);
    let m = pool[n];
    if (!m) { m = B.glowRing(0.5, color); m.material.fog = false; hlRoot.add(m); pool.push(m); }
    m.visible = true; m.position.set(x, y, z); m.scale.setScalar(size); m.material.opacity = clamp(op, 0, 1);
    return m;
  }
  function pool(x, z, color, size, op, y = TILE_TOP + 0.008) {
    let m = blobPool[blobN++];
    if (!m) { m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; hlRoot.add(m); blobPool.push(m); }
    m.visible = true; m.material.color.set(color); m.material.opacity = op; m.position.set(x, y, z); m.scale.set(size, 1, size);
  }
  const hlBegin = () => { ringUse = new Map(); blobN = 0; };
  const hlEnd = () => { for (const [c, p] of ringPools) { const n = ringUse.get(c) || 0; for (let i = n; i < p.length; i++) p[i].visible = false; } for (let i = blobN; i < blobPool.length; i++) blobPool[i].visible = false; };

  await tick();
  // ---------------------------------------------------------------- particles: gold sparks and sand chips
  const MAXP = 90;
  const sparkMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe3a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), MAXP);
  const chipMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.035, 0.05), new THREE.MeshStandardMaterial({ color: 0xd8b57a, roughness: 1 }), MAXP);
  sparkMesh.frustumCulled = chipMesh.frustumCulled = false; boardRoot.add(sparkMesh, chipMesh);
  const sparks = [], chips = []; const keys = new Set();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
  const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  let rseed = 1;
  function burst(x, y, z, n, kind = 'both') {
    for (let i = 0; i < n; i++) {
      const a = rnd(rseed++) * TAU, sp = 0.7 + rnd(rseed++) * 1.2;
      if (kind !== 'chips') sparks.push({ x, y, z, vx: Math.cos(a) * sp, vy: 1.6 + rnd(rseed++) * 1.6, vz: Math.sin(a) * sp, life: 0, max: 0.6 + rnd(rseed++) * 0.5 });
      if (kind !== 'sparks') chips.push({ x, y: y - 0.1, z, vx: Math.cos(a) * sp * 0.9, vy: 1.1 + rnd(rseed++) * 1.3, vz: Math.sin(a) * sp * 0.9, life: 0, max: 0.7 + rnd(rseed++) * 0.4, rx: rnd(rseed++) * 6, rs: 4 + rnd(rseed++) * 8 });
    }
    if (sparks.length > MAXP) sparks.splice(0, sparks.length - MAXP);
    if (chips.length > MAXP) chips.splice(0, chips.length - MAXP);
  }
  function stepParts(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.life += dt; p.vy -= 4.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.life >= p.max) sparks.splice(i, 1); }
    for (let i = chips.length - 1; i >= 0; i--) { const p = chips[i]; p.life += dt; p.vy -= 6.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rx += p.rs * dt; if (p.life >= p.max || p.y < TILE_TOP - 0.02) chips.splice(i, 1); }
    for (let i = 0; i < MAXP; i++) {
      const p = sparks[i];
      if (!p) _m.makeScale(0, 0, 0); else { const k = 1 - p.life / p.max; _p.set(p.x, p.y, p.z); _s.setScalar(0.5 + k); _m.compose(_p, _q.identity(), _s); }
      sparkMesh.setMatrixAt(i, _m);
      const c = chips[i];
      if (!c) _m.makeScale(0, 0, 0); else { _p.set(c.x, c.y, c.z); _s.setScalar(1 - c.life / c.max * 0.5); _q.setFromEuler(_e.set(c.rx, c.rx * 0.7, 0)); _m.compose(_p, _q, _s); }
      chipMesh.setMatrixAt(i, _m);
    }
    sparkMesh.instanceMatrix.needsUpdate = chipMesh.instanceMatrix.needsUpdate = true;
  }
  const once = (k) => { if (keys.has(k)) return false; keys.add(k); if (keys.size > 60) keys.delete(keys.values().next().value); return true; };

  await tick();
  // ---------------------------------------------------------------- HUD plaques and buttons (carved walnut, brass inlay, leather)
  const hudPanels = [], hudButtons = [];
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 150) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const walnut = B.material('darkWood', { color: '#5a3318', color2: '#2e1809', repeat: [3, 3], size: 512, seed: 7 });
  const brassM = B.material('brass', { color: '#c79a3a', color2: '#f0d27a', seed: 3 });
  const grain = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128); for (let k = 0; k < 2600; k++) { x.fillStyle = 'rgba(0,0,0,0.07)'; x.fillRect(Math.floor(Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 128), Math.floor(Math.abs(Math.sin(k * 78.233) * 24634.6345) % 128), 2, 2); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 3); return t; })();
  const leather = (c, em) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, map: grain }); if (em) { m.emissive = new THREE.Color(em); m.emissiveIntensity = 0.6; } return m; };
  const leatherN = leather('#3a2214'), leatherOn = leather('#55321a', '#1c0e04'), leatherDoc = leather('#2c170c'), leatherToast = leather('#241209');
  const lacq = (c, em) => { const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.25 }); if (em) { m.emissive = new THREE.Color(em); m.emissiveIntensity = 0.5; } return m; };
  const lacqPrimary = lacq('#c8461c', '#3a1005'), lacqNormal = lacq('#3e2415'), lacqOn = lacq('#7a5a1c', '#2a1c05');
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x0a0503, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  const ROT = Math.PI / 2;
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) {
      const g = new THREE.Group(), outer = new THREE.Mesh(flat, walnut), trim = new THREE.Mesh(flat, brassM), inner = new THREE.Mesh(flat, leatherN);
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
    p.inner.material = kind === 'plateOn' ? leatherOn : kind === 'doc' ? leatherDoc : kind === 'toast' ? leatherToast : leatherN;
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
  function fitCamera(rect, L, pitchDeg, fov, yawDeg = 0) {
    const k = W / L.w, targetW = rect.w * k, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180, lookY = 0.2;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    let d = 20;
    const place = () => {
      camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    for (let it = 0; it < 5; it++) {
      place();
      const a = tmpV.set(-HALF, 0.1, HALF).project(camera).x, b = tmpW.set(HALF, 0.1, HALF).project(camera).x;
      d *= (((b - a) / 2) * W) / targetW;
    }
    place();
    if (scene.fog) { scene.fog.near = d + 7; scene.fog.far = d + 38; }
    const c = tmpV.set(0, 0.1, 0).project(camera);
    const px0 = ((c.x + 1) / 2) * W, py0 = ((1 - c.y) / 2) * H, cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + (rect.h ?? rect.w) / 2) * k;
    camera.setViewOffset(W, H, px0 - cxp, py0 - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => { tmpV.set(x, y, z); boardRoot.localToWorld(tmpV); tmpV.project(camera); return { x: ((tmpV.x + 1) / 2) * L_.w, y: ((1 - tmpV.y) / 2) * L_.h }; };
  v3.sq = (i) => toVirt(cellX(i), TILE_TOP, cellZ(i));
  let occupied = [];
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3();
  function planePoint(vx, vy, y) {
    const ndcx = (vx / L_.w) * 2 - 1, ndcy = 1 - (vy / L_.h) * 2;
    orig.copy(camera.position); ray.set(ndcx, ndcy, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return null;
    const t = (y - orig.y) / ray.y; if (t < 0) return null;
    hitV.copy(orig).addScaledVector(ray, t); boardRoot.worldToLocal(hitV); return hitV;
  }
  v3.pick = (vx, vy) => {
    if (!L_) return -1;
    let best = -1, bd = 1e9;
    const unit = Math.abs(toVirt(1, TILE_TOP, 0).x - toVirt(0, TILE_TOP, 0).x) || 50;
    for (const i of occupied) {
      const base = toVirt(cellX(i), TILE_TOP + 0.02, cellZ(i)), top = toVirt(cellX(i), TILE_TOP + 0.5, cellZ(i));
      const cx = base.x, cy = (base.y + top.y) / 2, ry = Math.abs(base.y - top.y) / 2 + unit * 0.2, rx = unit * 0.46;
      const dx = (vx - cx) / rx, dy = (vy - cy) / ry, dd = dx * dx + dy * dy;
      if (dd <= 1 && dd < bd) { bd = dd; best = i; }
    }
    if (best >= 0) return best;
    const h = planePoint(vx, vy, TILE_TOP); if (!h) return -1;
    const c = Math.floor(h.x + NC / 2), r = Math.floor(h.z + NC / 2);
    if (c < 0 || c >= NC || r < 0 || r >= NC) return -1;
    return r * NC + c;
  };
  // where a dragged piece is drawn: under the finger, a little above the tile plane
  v3.drag = (vx, vy) => { const h = planePoint(vx, vy, TILE_TOP + 0.3); return h ? { x: h.x, z: h.z } : null; };

  await tick();
  // ---------------------------------------------------------------- sprites: the same pucks rendered once for the 2D layer (plates, trays, result card, diagrams)
  function buildSprites() {
    const SP = 256, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(13, 1, 1, 60);
    const l1 = new THREE.DirectionalLight(0xfff0d8, 3.3); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0xffa868, 1.3); l2.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xffe6c4, 0x5a3a28, 1.15), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.6;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0);
    const smap = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    for (const st of ['stone', 'clay']) for (const v of [1, 2, 3, 4]) {
      const m = makePiece(v & 1 ? 1 : 2, st, v > 2), grp = new THREE.Group(); grp.add(m); grp.rotation.y = 0.35; sc.add(grp);
      const dist = 8.4, pitch = (27 * Math.PI) / 180, ty = v > 2 ? 0.28 : 0.2;
      cam.position.set(0, ty + Math.sin(pitch) * dist, Math.cos(pitch) * dist); cam.lookAt(0, ty, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sc.remove(grp);
      sprites.piece[`${v}|${st}`] = c;
      if (!sprites.anchor) { const b = new THREE.Vector3(0, 0, 0).project(cam); sprites.anchor = { x: (b.x + 1) / 2, y: (1 - b.y) / 2, span: 2 * dist * Math.tan((13 * Math.PI) / 360) }; }
    }
    renderer.setClearColor(0x160c07, 1);
    renderer.setPixelRatio(pr); renderer.setSize(szw, szh, false);
    renderer.shadowMap.enabled = smap;
    W = 0;
    sprites.ready = true;
  }

  await tick();
  // ---------------------------------------------------------------- frame
  let lastT = 0, clock = 0, frames = 0, ema = 16, flipYaw = 0;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  const pos3 = (i) => ({ x: cellX(i), z: cellZ(i) });
  function boardState(state) {
    const g = state.game, a = state.anim, over = state.scene === 'over', lesson = state.scene === 'lesson', idle = clock;
    occupied = []; hideAll(); hlBegin();
    const sel = state.sel;
    const dragging = state.drag && sel >= 0;
    const forced = state.must && state.must.size && !a && !over && !state.autoMode && (state.two || g.turn === state.humanSide) && sel < 0 ? state.must : null;
    const movingTo = a ? a.to : -1;
    for (let i = 0; i < NC * NC; i++) {
      const v = g.board[i]; if (!v || (a && i === movingTo)) continue;
      if (a && a.caps.includes(i) && a.capVals) continue;
      occupied.push(i);
      if (dragging && i === sel) continue;
      let lift = 0, o = {};
      if (sel === i && !a && !over) lift = 0.22 + (state.calm ? 0 : Math.sin(idle * 3) * 0.035);
      if (over && g.winner && g.winner !== 3 && (v & 1 ? 1 : 2) === g.winner && !state.calm) lift = Math.abs(Math.sin(idle * 3.2 + i * 0.7)) * 0.22;
      o.lift = lift; o.yaw = (i * 0.37) % 0.6 - 0.3;
      if (v > 2) o.lift += Math.sin(idle * 1.5 + i) * 0.008;
      put(v, cellX(i), cellZ(i), o);
      if (sel === i && !a && !over) pool(cellX(i), cellZ(i), '#ffe08a', 1.5, 0.45 + 0.2 * Math.sin(idle * 5));
      if (forced && forced.has(i)) ring(cellX(i), cellZ(i), '#ffc552', 1.08 + (state.calm ? 0 : Math.sin(idle * 4) * 0.04), 0.95);
    }
    if (a && a.caps.length) {
      a.caps.forEach((q, n) => {
        const tk = (n + 0.5) * a.hop, v = a.capVals[n], x = cellX(q), z = cellZ(q);
        occupied.push(q);
        if (a.t < tk) { put(v, x, z, {}); return; }
        const f = (a.t - tk) / 0.55; if (f >= 1) return;
        if (once(`cap${aid(a)}|${q}|${n}`)) burst(x, TILE_TOP + 0.3, z, 12, 'both');
        const e = ease(f);
        put(v, x, z, { lift: e * 1.2, scale: 1.08 - 0.4 * e, spin: e * 6, tilt: e * 0.9 * (q % 2 ? 1 : -1) });
        if (f < 0.3) ring(x, z, '#ff8a4a', 0.9 + f * 2, 0.9 * (1 - f / 0.3));
      });
    }
    if (a) {
      const pts = a.path.map(pos3), h = Math.min(a.hops - 1, Math.floor(a.t / a.hop)), f = clamp((a.t - h * a.hop) / a.hop, 0, 1), e = ease(f);
      const p0 = pts[h], p1 = pts[h + 1], x = p0.x + (p1.x - p0.x) * e, z = p0.z + (p1.z - p0.z) * e, dist = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      const landed = a.t >= a.glide, hopLift = Math.sin(Math.PI * f) * (a.caps.length ? 0.8 : 0.4 + Math.min(0.3, dist * 0.08)) + 0.1 * (1 - f);
      const since = a.t - a.glide, settle = landed ? Math.exp(-since * 11) * Math.cos(since * 30) * 0.16 : 0;
      const crown = landed && a.valTo !== a.valFrom, val = landed ? a.valTo : a.valFrom, pe = pts[a.hops];
      put(val, landed ? pe.x : x, landed ? pe.z : z, { lift: landed ? Math.max(0, settle * 0.6) : hopLift, squash: landed ? settle * 0.5 : 0, roll: landed && !state.calm ? Math.exp(-since * 8) * Math.cos(since * 24) * 0.13 : 0, scale: crown && !state.calm ? 1 + 0.14 * Math.sin(clamp(since / 0.4, 0, 1) * Math.PI) : 1 });
      occupied.push(a.to);
      if (!landed) {
        pool(x, z, '#ffd98a', 1.35, 0.5);
        if (!state.calm) { sparks.push({ x, y: TILE_TOP + hopLift + 0.25, z, vx: 0, vy: 0.2, vz: 0, life: 0, max: 0.35 }); if (sparks.length > MAXP) sparks.shift(); }
        // an arc of light over the hop: a few fading beads from the start to the landing
        for (let k = 1; k <= 4; k++) { const u = k / 5; if (u > f) break; const bx = p0.x + (p1.x - p0.x) * u, bz = p0.z + (p1.z - p0.z) * u, by = Math.sin(Math.PI * u) * (a.caps.length ? 0.8 : 0.5); pool(bx, bz, '#ffcf7a', 0.28 + by * 0.1, 0.4 * (1 - (f - u)), TILE_TOP + by * 0.9 + 0.1); }
      } else {
        if (once(`land${aid(a)}`)) burst(pe.x, TILE_TOP + 0.12, pe.z, a.caps.length ? 8 : 4, 'chips');   // a puff of sand and chips off the tile
        if (since < 0.5) { const ff = since / 0.5; ring(pe.x, pe.z, '#fff0c0', 0.8 + ff * 1.8, 0.9 * (1 - ff)); }
        if (crown && since < 0.9) { if (once(`crown${aid(a)}`)) burst(pe.x, TILE_TOP + 0.55, pe.z, 18, 'sparks'); const ff = since / 0.9; ring(pe.x, pe.z, '#ffd24a', 0.9 + ff * 2.2, 1 - ff); }
      }
    }
    // dragged piece follows the finger
    if (dragging) {
      const dp = v3.drag(state.drag.x, state.drag.y);
      if (dp) { put(g.board[sel] || g.turn, dp.x, dp.z, { lift: 0.45 }); pool(dp.x, dp.z, '#ffe08a', 1.7, 0.4); }
    }
    // highlights
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(clock * 5);
    const last = a ? null : g.last;
    if (last && !lesson) for (const q of [last.from, last.to]) pool(cellX(q), cellZ(q), '#ffd26a', 1.05, 0.3);
    if (sel >= 0 && !a && !over) for (const m of state.selMoves || []) {
      const x = cellX(m.to), z = cellZ(m.to);
      if (m.caps) { ring(x, z, '#ff4a26', 1.0 + pulse * 0.06, 0.8 + pulse * 0.2); pool(x, z, '#ff5a30', 1.1, 0.3 + pulse * 0.2); }
      else { ring(x, z, '#ffe08a', 0.62 + pulse * 0.05, 0.75 + pulse * 0.25); pool(x, z, '#ffd36a', 0.7, 0.35 + pulse * 0.15); }
    }
    if (state.hint && !a) for (const q of [state.hint.from, state.hint.to]) { ring(cellX(q), cellZ(q), '#5af09a', 1.1, 0.9); pool(cellX(q), cellZ(q), '#5af09a', 1.2, 0.35 + pulse * 0.2); }
    for (const mk of v3.marks) ring(cellX(mk.i), cellZ(mk.i), mk.color || '#ff6a3a', 1.05 + pulse * 0.06, 0.8 + pulse * 0.2);
    if (state.kb && !over) ring(cellX(state.cursor), cellZ(state.cursor), '#7dff9a', 1.1, 1);
    // the winning moment: a fountain of gold from the middle of the board
    if (over && g.winner && !state.calm && Math.floor(clock * 14) !== boardState.lastTick) { boardState.lastTick = Math.floor(clock * 14); burst((Math.random() - 0.5) * 2.4, TILE_TOP + 0.1, (Math.random() - 0.5) * 2.4, 1, 'sparks'); }
    hlEnd();
  }

  // the title / documents backdrop: a looping demonstration on the real board
  function heroState(state) {
    const T = state.frozen ? 2.35 : state.calm ? 1.2 : state.t % 8, cell = (r, c) => r * NC + c;
    hideAll(); hlBegin(); occupied = [];
    const lerp = (A, Bq, f) => ({ x: cellX(A) + (cellX(Bq) - cellX(A)) * f, z: cellZ(A) + (cellZ(Bq) - cellZ(A)) * f });
    const h1a = 1.2, h1b = 1.7, h2a = 2.1, h2b = 2.6, h3a = 3.3, h3b = 3.8, resetT = 6.4;
    const op = T < 0.5 ? T / 0.5 : T > resetT ? Math.max(0, 1 - (T - resetT) / 0.6) : 1;
    const sc = (0.25 + 0.75 * ease(op));
    const still = [[3, 3, 1], [3, 4, 1], [0, 4, 2], [0, 3, 2], [1, 4, 2], [4, 1, 1], [4, 3, 1], [4, 4, 1], [0, 0, 2], [2, 4, 2]];
    for (const [r, c, v] of still) { const p = pos3(cell(r, c)); put(v, p.x, p.z, { scale: sc, yaw: (r * 5 + c) * 0.31 % 0.5 - 0.25 }); }
    for (const [r, c, t0] of [[2, 0, h1b], [1, 1, h2b]]) {
      const p = pos3(cell(r, c)), f = (T - t0 + 0.2) / 0.55;
      if (T < t0 - 0.2) put(2, p.x, p.z, { scale: sc }); else if (f < 1 && f >= 0) { const e = ease(f); put(2, p.x, p.z, { lift: e * 1.1, scale: 1.08 - 0.4 * e, spin: e * 6, tilt: e * 0.8 }); if (once(`h${r}${c}${Math.floor(state.t / 8)}`)) burst(p.x, TILE_TOP + 0.3, p.z, 10, 'both'); }
    }
    const stops = [cell(3, 0), cell(1, 0), cell(1, 2), cell(0, 2)], times = [[0, 0], [h1a, h1b], [h2a, h2b], [h3a, h3b]];
    let pos = pos3(stops[0]), lift = T > 0.6 && T < h1a ? clamp((T - 0.6) / 0.5, 0, 1) * 0.3 : 0;
    for (let k = 1; k < stops.length; k++) {
      const [t0, t1] = times[k];
      if (T >= t0 && T <= t1) { const f = ease((T - t0) / (t1 - t0)); pos = lerp(stops[k - 1], stops[k], f); lift = Math.sin(Math.PI * f) * 0.8; }
      else if (T > t1) pos = pos3(stops[k]);
    }
    const crowned = T > h3b;
    put(crowned ? 3 : 1, pos.x, pos.z, { lift, scale: sc * (crowned && T < h3b + 0.25 ? 1 + 0.12 * Math.sin((T - h3b) / 0.25 * Math.PI) : 1) });
    if (T > 0.6 && T < h1a) pool(pos.x, pos.z, '#ffd98a', 1.5, 0.5);
    if (crowned && T < h3b + 0.6) { const f = (T - h3b) / 0.6; ring(pos.x, pos.z, '#ffd24a', 0.9 + f * 2, 1 - f); if (once(`crown${Math.floor(state.t / 8)}`)) burst(pos.x, TILE_TOP + 0.5, pos.z, 16, 'sparks'); }
    hlEnd();
  }

  await tick();
  // ----- phase 1: before the 2D UI draws (camera, pieces, projection used by the 2D badges and picking)
  function prepare(state, L) {
    resize(); L_ = L; if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    ensureBoard(state.board && ['sand', 'dusk', 'rose'].includes(state.board) ? state.board : 'sand'); setStyle(state.style === 'clay' ? 'clay' : 'stone');
    const sc = state.scene, playing = sc === 'play' || sc === 'over' || sc === 'lesson';
    boardRoot.rotation.y = state.flip && playing ? Math.PI : 0; flipYaw = -boardRoot.rotation.y;
    v3.scene = sc;
    if (sc === 'title' || sc === 'demo-limit') {
      const hr = v3.heroRect || { x: L.w * 0.1, y: L.h * 0.4, w: L.w * 0.8, h: L.w * 0.8 };
      fitCamera(hr, L, L.land ? 40 : 36, 38, state.calm ? 0 : Math.sin(clock * 0.2) * 6);
      heroState(state);
    } else if (sc === 'doc') {
      fitCamera({ x: L.w * 0.06, y: L.h * 0.28, w: L.w * 0.88, h: L.w * 0.88 }, L, 38, 34, state.calm ? 0 : Math.sin(clock * 0.15) * 7);
      heroState(state);
    } else {
      fitCamera({ x: L.board.x, y: L.board.y, w: L.board.S, h: L.board.S }, L, L.land ? 50 : 46, 30, 0);
      boardState(state);
    }
  }

  await tick();
  // ----- phase 2: after the 2D UI recorded its panels and buttons
  function present(state, L, dt) {
    envM.update(clock, state.calm);
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
    // scene.environment is rebuilt by B.createEnvironment; rebuild our sprites' reference too
    try { envMap.rebuild(); } catch (e) { /* no reflections, still playable */ }
    W = 0; resize(); v3.on = true;
  });

  try {
    applyTier(); ensureBoard('sand'); buildSprites();
  } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  await tick();
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* first frame compiles instead */ }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera,
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
          v3.panels.length = 0; v3.buttons.length = 0; v3.marks.length = 0; v3.scrim = 0;
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
