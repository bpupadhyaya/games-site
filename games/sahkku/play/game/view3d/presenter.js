// Sáhkku 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: the board scene (lit board, sculpted pieces, snow/aurora environment, perspective camera fitted to the layout's
// board rectangle) and a screen-space HUD scene (plaques, lacquered buttons, tumbling dice) drawn in the same frame.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { sprites } from '../src/art.js';
import { RING, CROSS, CENTRE, GATES, CAMP } from '../src/rules.js';
import { makeHerder, makeKing, makeDie, dieMaterials, blankMaterials, dieUp, buildBoard, buildEnvironment, buildBackdrop, cellX, cellZ, TILE_TOP, HALF, mat, WOOD3, phys } from './models.js';
import { slab } from './geo.js';
import { tex, blobCanvas, ringCanvas, woodCanvas, feltCanvas } from './mats.js';

const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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
  renderer.toneMappingExposure = 1.08;
  renderer.autoClear = false;
  renderer.setClearColor(0x050a1c, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- scenes
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0e2c42, 14, 60);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 260);
  const env = buildEnvironment();
  scene.add(env.group);
  const backdrop = buildBackdrop();

  const hemi = new THREE.HemisphereLight(0x9fc4ff, 0x2a2f4a, 0.9);
  const key = new THREE.DirectionalLight(0xfff0d6, 2.4); key.position.set(-5, 11, 7);
  const rim = new THREE.DirectionalLight(0x6fffd0, 1.4); rim.position.set(7, 5, -9);
  const fill = new THREE.DirectionalLight(0x9db8ff, 0.55); fill.position.set(6, 4, 8);
  key.castShadow = true; Object.assign(key.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 1, far: 40 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
  scene.add(hemi, key, key.target, rim, fill);

  const hud = new THREE.Scene();
  const hudCam = new THREE.PerspectiveCamera();
  const hudLight = new THREE.DirectionalLight(0xfff4e0, 1.5); hudLight.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0x9db8ff, 0.4); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xbcd0ff, 0x1a2242, 0.55), hudLight, hudFill);

  function buildEnvMap() {
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture;
    pm.dispose();
    scene.environment = t; scene.environmentIntensity = 0.42;
    hud.environment = t; hud.environmentIntensity = 0.3;
  }
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  // ---------------------------------------------------------------- the board (rebuilt when the wood changes)
  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  let boardGrp = null, boardWood = null;
  function ensureBoard(wood) {
    if (boardWood === wood && boardGrp) return;
    if (boardGrp) boardRoot.remove(boardGrp);
    boardGrp = buildBoard(WOOD3[wood] ? wood : 'birch', CAMP, GATES, CENTRE, RING, CROSS);
    boardRoot.add(boardGrp); boardWood = wood;
  }
  const pieceRoot = new THREE.Group(); boardRoot.add(pieceRoot);
  const hlRoot = new THREE.Group(); boardRoot.add(hlRoot);

  const blobTex = tex(blobCanvas('0,0,0', 0.6), {});
  const glowTex = tex(blobCanvas('255,255,255', 0.95), {});
  const ringTex = tex(ringCanvas('255,255,255', 128, 0.72), {});
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);

  // ---------------------------------------------------------------- piece pools
  let style = 'four';
  const herders = [[], []], kings = {};
  function herderAt(side, i) {
    const pool = herders[side];
    while (pool.length <= i) {
      const wrap = new THREE.Group(), model = makeHerder(side, style);
      const shadow = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 }));
      shadow.position.y = 0.012; shadow.renderOrder = 1;
      wrap.add(shadow, model); wrap.userData = { model, shadow, kind: 'man' }; pieceRoot.add(wrap); wrap.visible = false; pool.push(wrap);
    }
    return pool[i];
  }
  function kingFor(owner) {
    const k = String(owner);
    if (!kings[k]) {
      const wrap = new THREE.Group(), model = makeKing(owner);
      const shadow = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 }));
      shadow.position.y = 0.012; shadow.renderOrder = 1;
      wrap.add(shadow, model); wrap.userData = { model, shadow, kind: 'king' }; pieceRoot.add(wrap); wrap.visible = false; kings[k] = wrap;
    }
    return kings[k];
  }
  function setStyle(s) {
    if (s === style) return; style = s;
    for (const p of herders) { for (const w of p) pieceRoot.remove(w); p.length = 0; }
  }
  const hlPool = []; let hlN = 0;
  function hl(x, z, tx, color, opacity, size, y = TILE_TOP + 0.014) {
    let m = hlPool[hlN];
    if (!m) { m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; hlRoot.add(m); hlPool.push(m); }
    hlN++; m.visible = true; m.material.map = tx; m.material.color.set(color); m.material.opacity = opacity; m.position.set(x, y, z); m.scale.set(size, 1, size);
  }
  const spark = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 48);
  spark.frustumCulled = false; boardRoot.add(spark);
  const parts = []; let burstFor = null;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function burst(x, y, z, n) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + i * 0.7, sp = 0.9 + ((i * 37) % 10) * 0.1;
      parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: 1.6 + ((i * 13) % 7) * 0.25, vz: Math.sin(a) * sp, life: 0, max: 0.8 + ((i * 7) % 5) * 0.1 });
    }
    if (parts.length > 48) parts.splice(0, parts.length - 48);
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt; p.vy -= 5.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.life >= p.max) parts.splice(i, 1);
    }
    for (let i = 0; i < 48; i++) {
      const p = parts[i];
      if (!p) _m.makeScale(0, 0, 0); else { const k = 1 - p.life / p.max; _p.set(p.x, p.y, p.z); _s.setScalar(0.5 + k); _m.compose(_p, _q, _s); }
      spark.setMatrixAt(i, _m);
    }
    spark.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- HUD plaques, buttons, dice
  const hudPanels = [], hudButtons = [];
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 150) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const woodHud = mat('hudwood', () => { const w = woodCanvas(512, '#6a4524', '#2e1a0b', 9, { lines: 160 }); return phys('#ffffff', { map: tex(w.map, { repeat: [3, 3] }), roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 }); });
  const slateHud = mat('hudslate', () => new THREE.MeshStandardMaterial({ color: '#16264a', roughness: 0.78, metalness: 0.05 }));
  const slateOn = mat('hudslateon', () => new THREE.MeshStandardMaterial({ color: '#2a4a8c', roughness: 0.7, metalness: 0.05, emissive: '#10244c', emissiveIntensity: 0.7 }));
  const slateDeep = mat('hudslatedeep', () => new THREE.MeshStandardMaterial({ color: '#0d1733', roughness: 0.85 }));
  const feltHud = mat('hudfelt', () => new THREE.MeshStandardMaterial({ map: tex(feltCanvas(256, ['#244268', '#0e1c38']), { repeat: [2, 1] }), roughness: 0.95 }));
  const brassHud = mat('hudbrass', () => new THREE.MeshStandardMaterial({ color: '#c9962f', metalness: 0.85, roughness: 0.32 }));
  const lacqRed = mat('hudred', () => phys('#d2402a', { roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1 }));
  const lacqBlue = mat('hudblue', () => phys('#27467f', { roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.12 }));
  const lacqBlueOn = mat('hudblueon', () => phys('#3f72bd', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, emissive: '#10244c', emissiveIntensity: 0.6 }));
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x030614, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);

  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) {
      const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, woodHud), trim = new THREE.Mesh(flatQuad, brassHud), inner = new THREE.Mesh(flatQuad, slateHud);
      g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p);
    }
    return p;
  }
  // slab() rises along +y from the XZ plane; the HUD looks along -z, so rotate the slab to rise toward the camera (+z)
  const ROT = Math.PI / 2;
  function placePanel(i, r, rad, kind) {
    const p = panelAt(i); p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -700, dep = kind === 'toast' ? 8 : 14, ins = kind === 'tray' ? 9 : 6;
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.6); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.5, Math.max(3, rad - ins), 2.2); p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    p.inner.material = kind === 'plateOn' ? slateOn : kind === 'tray' ? feltHud : kind === 'doc' ? slateDeep : slateHud;
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(flatQuad, lacqBlue), rim = new THREE.Mesh(flatQuad, brassHud); g.add(rim, body); hud.add(g); b = { g, body, rim }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt, pressed) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(18, r.h / 3), z = -400, dep = pressed ? 8 : 18;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, rad - 2, 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.body.material = bt.primary ? lacqRed : bt.on ? lacqBlueOn : lacqBlue;
    b.g.position.set(0, pressed ? -3 : 0, 0);
  }
  const dice = [];
  let diceDim = null;
  const dimMats = () => dieMaterials().map((m) => { const c = m.clone(); c.color.set('#8d8d8d'); return c; });
  for (let i = 0; i < 4; i++) {
    const d = makeDie(); d.visible = false; hud.add(d);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.7 })); sh.visible = false; hud.add(sh);
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); ring.visible = false; hud.add(ring);
    dice.push({ g: d, sh, ring });
  }

  // ---------------------------------------------------------------- camera fitting
  let W = 1, H = 1, dprNow = 1, L_ = null, hudW = 0, hudH = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) {
      W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
      camera.aspect = w / h;
    }
  }
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  function fitCamera(rect, L, pitchDeg, fov, yawDeg = 0) {
    const k = W / L.w, targetW = rect.w * k, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180, lookY = 0.25;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    let d = 22;
    const place = () => {
      camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    for (let it = 0; it < 5; it++) {
      place();
      const a = tmpV.set(-HALF, 0, HALF).project(camera).x, b = tmpW.set(HALF, 0, HALF).project(camera).x;
      d *= (((b - a) / 2) * W) / targetW;
    }
    place();
    const c = tmpV.set(0, 0.1, 0).project(camera);
    const px0 = ((c.x + 1) / 2) * W, py0 = ((1 - c.y) / 2) * H, cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + (rect.h ?? rect.w) / 2) * k;
    camera.setViewOffset(W, H, px0 - cxp, py0 - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => {
    tmpV.set(x, y, z); boardRoot.localToWorld(tmpV); tmpV.project(camera);
    return { x: ((tmpV.x + 1) / 2) * L_.w, y: ((1 - tmpV.y) / 2) * L_.h };
  };
  v3.sq = (i) => toVirt(cellX(i), TILE_TOP, cellZ(i));
  let occupied = [];
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3();
  v3.pick = (vx, vy) => {
    if (!L_ || !boardGrp) return -1;
    let best = -1, bd = 1e9;
    const unit = Math.abs(toVirt(1, TILE_TOP, 0).x - toVirt(0, TILE_TOP, 0).x) || 50;
    for (const i of occupied) {
      const base = toVirt(cellX(i), TILE_TOP + 0.04, cellZ(i)), top = toVirt(cellX(i), TILE_TOP + 0.95, cellZ(i));
      const cx = base.x, cy = (base.y + top.y) / 2, ry = Math.abs(base.y - top.y) / 2 + unit * 0.1, rx = unit * 0.36;
      const dx = (vx - cx) / rx, dy = (vy - cy) / ry, dd = dx * dx + dy * dy;
      if (dd <= 1 && dd < bd) { bd = dd; best = i; }
    }
    if (best >= 0) return best;
    const ndcx = (vx / L_.w) * 2 - 1, ndcy = 1 - (vy / L_.h) * 2;
    orig.copy(camera.position); ray.set(ndcx, ndcy, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return -1;
    const t = (TILE_TOP - orig.y) / ray.y; if (t < 0) return -1;
    hitV.copy(orig).addScaledVector(ray, t); boardRoot.worldToLocal(hitV);
    const c = Math.floor(hitV.x + 3.5), r = Math.floor(hitV.z + 3.5);
    if (c < 0 || c > 6 || r < 0 || r > 6) return -1;
    return r * 7 + c;
  };

  // ---------------------------------------------------------------- sprites: the same models rendered once to canvases for the 2D layer
  function buildSprites() {
    const SP = 256, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(14, 1, 1, 60);
    const l1 = new THREE.DirectionalLight(0xfff2dc, 3.2); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0x9fc4ff, 1.1); l2.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a4256, 1.1), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.5;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = false;
    const shoot = (obj, lookY, dist, pitch = 16) => {
      sc.add(obj); const p = (pitch * Math.PI) / 180;
      cam.position.set(0, lookY + Math.sin(p) * dist, Math.cos(p) * dist); cam.lookAt(0, lookY, 0); cam.updateMatrixWorld();
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sc.remove(obj); return c;
    };
    for (const st of ['four', 'round']) for (const p of [0, 1]) { const h = makeHerder(p, st); h.rotation.y = 0.3; sprites.herder[`${p}|${st}`] = shoot(h, 0.52, 11.5); }
    for (const o of [-1, 0, 1]) { const k = makeKing(o); k.rotation.y = 0.2; sprites.king[String(o)] = shoot(k, 0.72, 15); }
    for (const v of [0, 1, 2, 3, 'blank']) {
      const d = makeDie(); d.quaternion.copy(dieUp(v === 'blank' ? 4 : v));
      const wrap = new THREE.Group(); wrap.add(d); wrap.rotation.set(0.62, -0.5, 0); wrap.scale.setScalar(0.9);
      sprites.die[v] = shoot(wrap, 0, 8.5, 0);
    }
    renderer.setSize(1024, 1024, false);
    for (const wood of Object.keys(WOOD3)) {
      const bg = new THREE.Group(), b = buildBoard(wood, CAMP, GATES, CENTRE, RING, CROSS); bg.add(b);
      const top = new THREE.Scene(); top.add(bg); top.environment = scene.environment; top.environmentIntensity = 0.5;
      const a = new THREE.DirectionalLight(0xfff2dc, 3.0); a.position.set(-3, 9, 2); const c2 = new THREE.DirectionalLight(0xaac4ff, 0.8); c2.position.set(4, 5, 5);
      top.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a4256, 1.0), a, c2);
      const tc = new THREE.PerspectiveCamera(10, 1, 1, 200), dist = HALF / Math.tan((5 * Math.PI) / 180);
      tc.position.set(0, dist, 0.0001); tc.lookAt(0, 0, 0); tc.updateMatrixWorld();
      renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(top, tc);
      const c = document.createElement('canvas'); c.width = c.height = 1024; c.getContext('2d').drawImage(renderer.domElement, 0, 0, 1024, 1024);
      sprites.board[wood] = c;
    }
    renderer.setClearColor(0x050a1c, 1);
    renderer.setPixelRatio(pr); renderer.setSize(szw, szh, false);
    renderer.shadowMap.enabled = TIERS[tier].shadow > 0;
    W = 0;
    sprites.ready = true;
  }

  // ---------------------------------------------------------------- frame
  let lastT = 0, clock = 0, frames = 0, ema = 16, flipYaw = 0;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  function setPiece(w, x, z, o = {}) {
    w.visible = true; w.position.set(x, TILE_TOP, z);
    const m = w.userData.model, sh = w.userData.shadow, lift = o.lift || 0, s = o.scale ?? 1, sq = o.squash || 0;
    m.position.y = lift; m.rotation.y = flipYaw + (o.yaw || 0) + (o.spin || 0); m.rotation.x = o.tilt || 0;
    m.scale.set(s * (1 + sq * 0.5), s * (1 - sq), s * (1 + sq * 0.5));
    const base = w.userData.kind === 'king' ? 1.35 : 1.0;
    sh.scale.setScalar(base * s * (1 - clamp(lift * 0.3, 0, 0.45)));
    sh.material.opacity = 0.8 * (1 - clamp(lift * 0.4, 0, 0.6));
  }
  const pieceOff = (k, n) => (n === 1 ? [0, 0, 1] : n === 2 ? [[-0.2, 0.0], [0.2, 0.0]][k].concat(0.82) : [[-0.24, 0.12], [0.24, 0.12], [0, -0.14]][k % 3].concat(0.74));
  const hideAll = () => { for (const p of herders) for (const w of p) w.visible = false; for (const k of Object.values(kings)) k.visible = false; };

  function boardState(state) {
    const g = state.game, a = state.anim, over = state.scene === 'over', used = [0, 0], idle = clock;
    occupied = []; hideAll(); hlN = 0;
    const takeH = (side) => herderAt(side, used[side]++);
    const skipMan = a && (a.kind === 'man' || a.kind === 'wake') ? { p: a.p, to: a.to } : null, skipKing = a && a.kind === 'king' ? a.to : -1;
    for (let i = 0; i < 49; i++) {
      const arr = [];
      for (let p = 0; p < 2; p++) { let n = g.men[p][i]; if (skipMan && skipMan.p === p && skipMan.to === i) n -= 1; for (let k = 0; k < n; k++) arr.push({ t: 'man', p }); }
      if (a && a.cap && a.to === i && a.t < a.glide) arr.push({ t: 'man', p: 1 - a.p });
      const flipPending = a && a.flip && a.to === i && a.t < a.glide;
      if (g.king.cell === i && skipKing !== i && !(a && a.kind !== 'king' && a.flip && a.to === i && a.t < a.glide)) arr.push({ t: 'king', owner: g.king.owner });
      else if (flipPending) arr.push({ t: 'king', owner: g.king.owner === a.p ? (a.p === 0 ? 1 : 0) : g.king.owner });
      if (!arr.length) continue;
      occupied.push(i);
      const n = arr.length, sel = state.scene === 'play' && state.sel === i;
      arr.forEach((pc, k) => {
        const off = pieceOff(k, n), x = cellX(i) + (off[0] || 0), z = cellZ(i) + (off[1] || 0), sc = off[2] ?? 1;
        if (pc.t === 'king') setPiece(kingFor(pc.owner), x, z, { scale: sc * 0.95, lift: Math.sin(idle * 1.4) * 0.012, yaw: Math.sin(idle * 0.5) * 0.12 });
        else setPiece(takeH(pc.p), x, z, { scale: sc, lift: sel && state.selKind === 'man' && k === 0 ? 0.16 + Math.sin(idle * 3) * 0.02 : 0, yaw: pc.p === 0 ? 0.15 : -0.15 });
      });
    }
    if (a && a.cap && a.t >= a.glide) {
      const f = clamp((a.t - a.glide) / 0.6, 0, 1);
      setPiece(takeH(1 - a.p), cellX(a.to), cellZ(a.to), { lift: ease(f) * 1.5, scale: 1.05 - 0.55 * ease(f), spin: ease(f) * 7, tilt: ease(f) * 0.5 });
      if (burstFor !== a) { burstFor = a; burst(cellX(a.to), TILE_TOP + 0.4, cellZ(a.to), 18); }
    }
    if (a && a.flip && a.t >= a.glide && burstFor !== a) { burstFor = a; burst(cellX(a.to), TILE_TOP + 0.5, cellZ(a.to), 14); }
    if (a) {
      const pts = [a.kind === 'wake' ? CAMP[a.p] : a.from, ...a.path];
      const f = clamp(a.t / a.glide, 0, 1), segs = pts.length - 1;
      let x, z, lift = 0;
      if (segs <= 0) { x = cellX(pts[0]); z = cellZ(pts[0]); lift = f < 1 ? Math.sin(Math.PI * f) * 0.75 : 0; }
      else {
        const u = f * segs, k = Math.min(segs - 1, Math.floor(u)), e = ease(u - k);
        x = cellX(pts[k]) + (cellX(pts[k + 1]) - cellX(pts[k])) * e; z = cellZ(pts[k]) + (cellZ(pts[k + 1]) - cellZ(pts[k])) * e; lift = f < 1 ? Math.sin(Math.PI * (u - k)) * 0.5 + 0.2 : 0;
      }
      const settle = a.t > a.glide ? Math.exp(-(a.t - a.glide) * 10) * Math.cos((a.t - a.glide) * 28) * 0.12 : 0;
      if (a.kind === 'king') setPiece(kingFor(g.king.owner), x, z, { lift, squash: settle, scale: 0.95 });
      else setPiece(takeH(a.p), x, z, { lift, squash: settle, scale: a.kind === 'wake' ? 0.6 + 0.4 * Math.min(1, f * 3) : 1 });
      if (a.t > a.glide && a.t < a.glide + 0.5) { const ff = (a.t - a.glide) / 0.5; hl(cellX(a.to), cellZ(a.to), ringTex, '#e8f4ff', 0.9 * (1 - ff), 0.8 + ff * 1.6); }
    }
    const me = g.turn, pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(clock * 5);
    const mine = !state.autoMode && g.phase === 'move' && !a && !state.rollAnim && !over && (state.two || me === state.humanSide);
    const last = a ? null : g.last;
    if (last && !over) { if (last.from >= 0) hl(cellX(last.from), cellZ(last.from), glowTex, '#ffd25a', 0.34, 1.05); hl(cellX(last.to), cellZ(last.to), glowTex, '#ffd25a', 0.45, 1.1); }
    if (mine && state.sel < 0 && state.selKind !== 'wake') {
      const seen = new Set();
      for (const m of state.viewMoves || []) if (m.from >= 0 && !seen.has(m.from) && (state.dieFilter < 0 || g.dice[state.dieFilter] === m.val)) { seen.add(m.from); hl(cellX(m.from), cellZ(m.from), ringTex, '#6dffa8', 0.45 + pulse * 0.4, 1.12); }
    }
    if (mine && state.sel >= 0) hl(cellX(state.sel), cellZ(state.sel), glowTex, '#ffe27a', 0.55 + pulse * 0.25, 1.25);
    if (mine) for (const m of state.selMoves || []) {
      const x = cellX(m.to), z = cellZ(m.to);
      if (m.cap) { hl(x, z, ringTex, '#ff3a22', 0.8 + pulse * 0.2, 1.16); hl(x, z, glowTex, '#ff4a2a', 0.3 + pulse * 0.2, 1.05); }
      else if (m.flip) { hl(x, z, ringTex, '#ffc828', 0.8 + pulse * 0.2, 1.16); hl(x, z, glowTex, '#ffd24a', 0.3 + pulse * 0.2, 1.05); }
      else { hl(x, z, glowTex, '#9fe0ff', 0.34 + pulse * 0.2, 0.46); hl(x, z, ringTex, '#bfeaff', 0.55 + pulse * 0.25, 0.56); }
    }
    if (state.hint && !a) {
      for (const q of [state.hint.from, state.hint.to]) if (q >= 0) hl(cellX(q), cellZ(q), ringTex, '#5af09a', 0.85 + pulse * 0.15, 1.25);
      if (state.hint.kind === 'wake') hl(cellX(CAMP[me]), cellZ(CAMP[me]), ringTex, '#5af09a', 0.9, 1.3);
    }
    if (mine && g.phase === 'move' && state.viewMoves?.some((m) => m.kind === 'wake') && state.sel !== CAMP[me]) hl(cellX(CAMP[me]), cellZ(CAMP[me]), ringTex, '#ffec96', 0.45 + pulse * 0.4, 1.2);
    if (state.kb && !over) hl(cellX(state.cursor), cellZ(state.cursor), ringTex, '#7dff9a', 1, 1.1);
    for (let i = hlN; i < hlPool.length; i++) hlPool[i].visible = false;
  }

  // the title / documents backdrop: a looping demonstration on the real board
  function heroState(state) {
    const T = state.calm ? 2.2 : state.t % 9, cell = (r, c) => r * 7 + c, used = [0, 0];
    const lerp = (a, b, f) => ({ x: cellX(a) + (cellX(b) - cellX(a)) * f, z: cellZ(a) + (cellZ(b) - cellZ(a)) * f });
    hideAll(); hlN = 0; occupied = [];
    const f1 = ease(clamp((T - 1) / 1.4, 0, 1)), f2 = ease(clamp((T - 4) / 1.4, 0, 1));
    const put = (s, x, z, o) => setPiece(herderAt(s, used[s]++), x, z, o);
    const at = (c) => ({ x: cellX(c), z: cellZ(c) });
    if (T < 2.4) { const p = at(cell(0, 4)); put(1, p.x, p.z, { yaw: -0.2, scale: T > 2.2 ? 1 - ((T - 2.2) / 0.2) * 0.7 : 1 }); }
    for (const c of [cell(6, 3), cell(5, 5), cell(1, 5)]) { const p = at(c); put(1, p.x, p.z, { yaw: -0.2 }); }
    for (const c of [cell(6, 0), cell(4, 0)]) { const p = at(c); put(0, p.x, p.z, { yaw: 0.2 }); }
    const kp = at(CENTRE); setPiece(kingFor(T < 5.4 ? -1 : 0), kp.x, kp.z, { scale: 0.98, lift: Math.sin(clock * 1.4) * 0.012, yaw: Math.sin(clock * 0.5) * 0.15 });
    { const p = lerp(cell(0, 1), cell(0, 4), f1); put(0, p.x, p.z, { yaw: 0.2, lift: f1 > 0 && f1 < 1 ? Math.sin(Math.PI * f1) * 0.7 : 0 }); }
    if (T > 3.2) { const p = lerp(cell(1, 3), CENTRE, f2); put(0, p.x, p.z, { yaw: 0.2, lift: f2 > 0 && f2 < 1 ? Math.sin(Math.PI * f2) * 0.7 : 0 }); }
    const mark = (k, t0, x, z) => { if (T > t0 && T < t0 + 0.15 && burstFor !== k + Math.floor(state.t / 9)) { burstFor = k + Math.floor(state.t / 9); burst(x, TILE_TOP + 0.4, z, 14); } };
    mark('c', 2.35, cellX(cell(0, 4)), cellZ(cell(0, 4))); mark('k', 5.4, 0, 0);
    for (let i = hlN; i < hlPool.length; i++) hlPool[i].visible = false;
  }

  // ----- phase 1: before the 2D UI draws (camera, pieces, projection used by the 2D badges and picking)
  function prepare(state, L) {
    resize(); L_ = L; if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const wood = state.wood && WOOD3[state.wood] ? state.wood : 'birch';
    ensureBoard(wood); setStyle(state.style === 'round' ? 'round' : 'four');
    const playing = state.scene === 'play' || state.scene === 'over';
    boardRoot.rotation.y = state.flip && playing ? Math.PI : 0; flipYaw = -boardRoot.rotation.y;
    const sc = state.scene; v3.scene = sc;
    if (sc === 'title' || sc === 'demo-limit') {
      const hr = v3.heroRect || { x: L.w * 0.1, y: L.h * 0.4, w: L.w * 0.8, h: L.w * 0.8 };
      fitCamera(hr, L, L.land ? 34 : 30, 40, state.calm ? 0 : Math.sin(clock * 0.2) * 5);
      heroState(state);
    } else if (sc === 'doc') {
      fitCamera({ x: L.w * 0.06, y: L.h * 0.3, w: L.w * 0.88, h: L.w * 0.88 }, L, 34, 34, state.calm ? 0 : Math.sin(clock * 0.15) * 7);
      heroState(state);
    } else {
      fitCamera({ x: L.board.x, y: L.board.y, w: L.board.S, h: L.board.S }, L, L.land ? 50 : 47, 30, 0);
      boardState(state);
    }
  }

  // ----- phase 2: after the 2D UI recorded its panels, buttons and dice slots
  function present(state, L, dt) {
    env.updateSnow(clock, state.calm); backdrop.update(clock, L.w, L.h, state.calm);
    key.position.set(-5.2, 11, 7.5); key.target.position.set(0, 0, 0);
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
    const showDice = state.scene === 'play', g = state.game;
    if (!diceDim) diceDim = dimMats();
    for (let i = 0; i < 4; i++) {
      const D = dice[i], r = L.dice[i];
      if (!showDice || !r) { D.g.visible = D.sh.visible = D.ring.visible = false; continue; }
      const size = r.w * 0.86, cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rolling = state.rollAnim, hasDice = g.dice.length === 4;
      let v = hasDice ? g.dice[i] : 4, hop = 0, spinQ = null;
      if (rolling) {
        const f = clamp(rolling.t / rolling.dur, 0, 1); v = g.dice[i];
        spinQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0.7 + i * 0.1, 0.5, 0.4).normalize(), (1 - ease(f)) * (6 + i) * Math.PI);
        hop = Math.abs(Math.sin(f * Math.PI * 2.2)) * (1 - f) * 0.55;
      }
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5 + i * 0.9).multiply(dieUp(v));
      if (spinQ) q.premultiply(spinQ);
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.82));
      const usedDie = hasDice && (g.used[i] || g.phase !== 'move') && !rolling;
      D.g.visible = true; D.g.quaternion.copy(q); D.g.scale.setScalar(size * 0.72);
      D.g.position.set(cx, cy + size * (0.06 + hop * 0.6), -330 + size * 0.4);
      D.g.children[0].material = !hasDice && !rolling ? blankMaterials() : usedDie ? diceDim : dieMaterials();
      D.sh.visible = true; D.sh.scale.set(size * 1.05, size * 0.5, 1); D.sh.position.set(cx + size * 0.04, cy - size * 0.36, -340); D.sh.material.opacity = 0.6 * (1 - hop * 0.8);
      const selDie = state.dieFilter === i;
      D.ring.visible = selDie; if (selDie) { D.ring.scale.set(size * 1.5, size * 1.5, 1); D.ring.position.set(cx, cy, -345); D.ring.material.color.set('#ffb020'); }
    }
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(backdrop.scene, hudCam);
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud, hudCam);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnvMap(); } catch (e) { /* no reflections, still playable */ }
    W = 0; resize(); v3.on = true;
  });

  try {
    buildEnvMap(); applyTier(); ensureBoard('birch'); buildSprites();
  } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
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
          v3.panels.length = 0; v3.buttons.length = 0; v3.scrim = 0;
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
