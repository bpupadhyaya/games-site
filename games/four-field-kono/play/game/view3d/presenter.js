// Four-Field Kono 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: the lit hanji board with sculpted river stones in a hanok room, and a screen-space HUD scene (carved wood
// plaques, lacquered buttons) drawn in the same frame. Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with
// the flat 2D art; context restored -> back to 3D without a reload.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { sprites } from '../src/art.js';
import { LESSONS } from '../src/content.js';
import { buildBoard, buildRoom, makeStone, canvasTex, blobCanvas, ringCanvas, outerOf, TOP, THICK } from './models.js';

const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, q: 1 },
  { name: 'medium', dpr: 1.5, shadow: 1024, q: 0.8 },
  { name: 'low', dpr: 1, shadow: 0, q: 0.5 },
];
const PLAY = new Set(['play', 'over', 'lesson']);

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
  renderer.setClearColor(0x1a100a, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- scene, room, lights
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 260);
  const room = buildRoom({ quality: TIERS[tier].q });
  scene.add(room.group);
  const rig = B.lightingRig(scene, 'warmIndoor', {
    renderer, shadow: TIERS[tier].shadow || 0, extent: 7, fog: { near: 20, far: 60 }, target: [0, 0, 0],
    overrides: { bg: 0x160d08, fog: 0x1a100a, keyPos: [-5.2, 10, 6.5], keyI: 2.7, hemi: 0.5, fillI: 0.45, rimI: 1.9, rimPos: [5, 4.5, -7], exposure: 1.1, env: 0.42 },
  });
  const key = rig.key, keyBase = rig.config.keyI;

  const hud = new THREE.Scene();
  const hudCam = new THREE.PerspectiveCamera();
  const hudLight = new THREE.DirectionalLight(0xffe9c8, 1.6); hudLight.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0xaec4ff, 0.4); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe6c8, 0x1a1208, 0.35), hudLight, hudFill);
  const env = B.createEnvironment(renderer, scene, { intensity: 0.42 });
  const syncHudEnv = () => { hud.environment = scene.environment; hud.environmentIntensity = 0.3; };
  syncHudEnv();
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  // ---------------------------------------------------------------- board + stones
  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  let boardGrp = null, bKey = '';
  function ensureBoard(N, paper, flip) {
    const k = `${N}|${paper}|${flip ? 1 : 0}|${TIERS[tier].q}`;
    if (k === bKey && boardGrp) return;
    if (boardGrp) { boardRoot.remove(boardGrp); boardGrp.userData.dispose(); }
    boardGrp = buildBoard(N, paper, flip, TIERS[tier].q); boardRoot.add(boardGrp); bKey = k; room.setLayout(N);
  }
  const pieceRoot = new THREE.Group(); boardRoot.add(pieceRoot);
  const hlRoot = new THREE.Group(); boardRoot.add(hlRoot);
  const blobTex = canvasTex(blobCanvas('0,0,0', 0.7), {});
  const glowTex = canvasTex(blobCanvas('255,255,255', 0.95), {});
  const ringTex = canvasTex(ringCanvas('255,255,255', 128, 0.72), {});
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);

  const newWrap = (side) => {
    const wrap = new THREE.Group(), model = makeStone(side);
    const shadow = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.75 }));
    shadow.position.y = 0.01; shadow.scale.setScalar(1.25); shadow.renderOrder = 1;
    wrap.add(shadow, model); wrap.userData = { model, shadow }; pieceRoot.add(wrap); wrap.visible = false; return wrap;
  };
  const pools = { 1: [], 2: [] }, freeDebris = { 1: [], 2: [] };
  function stoneAt(side, i) { const pool = pools[side]; while (pool.length <= i) pool.push(newWrap(side)); return pool[i]; }
  const hideAll = () => { for (const p of [pools[1], pools[2]]) for (const w of p) w.visible = false; };

  const hlPool = []; let hlN = 0;
  function hl(x, z, tx, color, opacity, size, y = TOP + 0.016) {
    let m = hlPool[hlN];
    if (!m) { m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; hlRoot.add(m); hlPool.push(m); }
    hlN++; m.visible = true; m.material.map = tx; m.material.color.set(color); m.material.opacity = opacity; m.position.set(x, y, z); m.scale.set(size, 1, size);
  }

  // sparks + dust puffs
  const NS = 56;
  const spark = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), NS);
  spark.frustumCulled = false; boardRoot.add(spark);
  const parts = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function burst(x, y, z, n, vy = 1.6, sp0 = 0.9) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + i * 0.7, sp = sp0 + ((i * 37) % 10) * 0.1;
      parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: vy + ((i * 13) % 7) * 0.25, vz: Math.sin(a) * sp, life: 0, max: 0.6 + ((i * 7) % 5) * 0.1 });
    }
    if (parts.length > NS) parts.splice(0, parts.length - NS);
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life += dt; p.vy -= 6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.life >= p.max || p.y < 0) parts.splice(i, 1); }
    for (let i = 0; i < NS; i++) {
      const p = parts[i];
      if (!p) _m.makeScale(0, 0, 0); else { const k = 1 - p.life / p.max; _p.set(p.x, p.y, p.z); _s.setScalar(0.5 + k); _m.compose(_p, _q, _s); }
      spark.setMatrixAt(i, _m);
    }
    spark.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- HUD plaques and lacquered buttons
  const hudPanels = [], hudButtons = [];
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 150) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const woodHud = B.material('darkWood', { color: '#5d3d24', color2: '#8a5c33', repeat: [3, 3], seed: 9 });
  const inkHud = new THREE.MeshStandardMaterial({ color: '#0a2326', roughness: 0.82, metalness: 0.05 });
  const inkOn = new THREE.MeshStandardMaterial({ color: '#14403c', roughness: 0.75, emissive: '#2a2410', emissiveIntensity: 0.9 });
  const inkDeep = new THREE.MeshStandardMaterial({ color: '#0a1b1f', roughness: 0.88 });
  const feltHud = new THREE.MeshStandardMaterial({ color: '#10343a', roughness: 0.95 });
  const brassHud = B.material('brass', { envIntensity: 1.4 });
  const lacq = (c, em) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.42, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.35, emissive: em, emissiveIntensity: 0.55 });
  const lacqJade = lacq('#12a373', '#0a5a3c'), lacqTeal = lacq('#0d6468', '#06353a'), lacqOn = lacq('#a67a24', '#4a3208'), lacqDim = lacq('#17353a', '#07161a');
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x050c0c, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) {
      const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, woodHud), trim = new THREE.Mesh(flatQuad, brassHud), inner = new THREE.Mesh(flatQuad, inkHud);
      g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p);
    }
    return p;
  }
  const ROT = Math.PI / 2;
  function placePanel(i, r, rad, kind) {
    const p = panelAt(i); p.g.visible = true;
    const cx0 = r.x + r.w / 2, cy0 = -(r.y + r.h / 2), z = -700, dep = kind === 'toast' ? 8 : 14, ins = kind === 'tray' ? 9 : 7;
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx0, cy0, z);
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.6); p.trim.rotation.x = ROT; p.trim.position.set(cx0, cy0, z);
    p.inner.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.5, Math.max(3, rad - ins), 2.2); p.inner.rotation.x = ROT; p.inner.position.set(cx0, cy0, z);
    p.inner.material = kind === 'plateOn' ? inkOn : kind === 'tray' ? feltHud : kind === 'doc' ? inkDeep : inkHud;
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(flatQuad, lacqTeal), rim = new THREE.Mesh(flatQuad, brassHud); g.add(rim, body); hud.add(g); b = { g, body, rim }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt, pressed) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx0 = r.x + r.w / 2, cy0 = -(r.y + r.h / 2), rad = Math.min(18, r.h / 3), z = -400, dep = pressed ? 8 : 18;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx0, cy0, z);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, rad - 2, 6); b.body.rotation.x = ROT; b.body.position.set(cx0, cy0, z);
    b.body.material = bt.dim ? lacqDim : bt.primary ? lacqJade : bt.on ? lacqOn : lacqTeal;
    b.g.position.set(0, pressed ? -3 : 0, 0);
  }

  // ---------------------------------------------------------------- camera fitting + picking
  let W = 1, H = 1, dprNow = 1, L_ = null, hudW = 0, hudH = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  let curN = 4, sgn = 1, gW = 5;
  const half = () => outerOf(curN) / 2;
  function fitCamera(rect, L, pitchDeg, fov, yawDeg = 0) {
    const HALF = half(), k = W / L.w, targetW = rect.w * k, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180, lookY = 0.2;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    let d = 22;
    const place = () => {
      camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    for (let it = 0; it < 5; it++) {
      place();
      const a = tmpV.set(-HALF, THICK, HALF).project(camera).x, b = tmpW.set(HALF, THICK, HALF).project(camera).x;
      d *= (((b - a) / 2) * W) / targetW;
    }
    place();
    const c = tmpV.set(0, THICK, 0).project(camera);
    const px0 = ((c.x + 1) / 2) * W, py0 = ((1 - c.y) / 2) * H, cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + (rect.h ?? rect.w) / 2) * k;
    camera.setViewOffset(W, H, px0 - cxp, py0 - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const cx = (i) => sgn * ((i % gW) - curN / 2), cz = (i) => sgn * (Math.floor(i / gW) - curN / 2);
  const toVirt = (x, y, z) => { tmpV.set(x, y, z); boardRoot.localToWorld(tmpV); tmpV.project(camera); return { x: ((tmpV.x + 1) / 2) * L_.w, y: ((1 - tmpV.y) / 2) * L_.h }; };
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3();
  function planeHit(vx, vy, y) {
    const ndcx = (vx / L_.w) * 2 - 1, ndcy = 1 - (vy / L_.h) * 2;
    orig.copy(camera.position); ray.set(ndcx, ndcy, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return null;
    const t = (y - orig.y) / ray.y; if (t < 0) return null;
    hitV.copy(orig).addScaledVector(ray, t); return hitV;
  }
  let occupied = [];
  v3.sq = (i) => toVirt(cx(i), TOP, cz(i));
  v3.pick = (vx, vy) => {
    if (!L_ || !boardGrp) return -1;
    let best = -1, bd = 1e9;
    const unit = Math.abs(toVirt(1, TOP, 0).x - toVirt(0, TOP, 0).x) || 50;
    for (const i of occupied) {
      const base = toVirt(cx(i), TOP + 0.02, cz(i)), top = toVirt(cx(i), TOP + 0.3, cz(i));
      const ex = base.x, ey = (base.y + top.y) / 2, ry = Math.abs(base.y - top.y) / 2 + unit * 0.2, rx = unit * 0.44;
      const dx = (vx - ex) / rx, dy = (vy - ey) / ry, dd = dx * dx + dy * dy;
      if (dd <= 1 && dd < bd) { bd = dd; best = i; }
    }
    if (best >= 0) return best;
    const h = planeHit(vx, vy, TOP); if (!h) return -1;
    const fx = sgn * h.x + curN / 2, fz = sgn * h.z + curN / 2, c = Math.round(fx), r = Math.round(fz);
    if (c < 0 || c > curN || r < 0 || r > curN || Math.hypot(fx - c, fz - r) > 0.72) return -1;
    return r * gW + c;
  };

  // ---------------------------------------------------------------- stone sprites for the 2D layer (plates, trays, diagrams)
  function buildSprites() {
    const SP = 256, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(14, 1, 0.5, 40);
    const l1 = new THREE.DirectionalLight(0xfff0d8, 3.4); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0xaec4ff, 1.0); l2.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xffe8cc, 0x4a3a2a, 1.1), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.55;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = false;
    for (const side of [1, 2]) {
      const st = makeStone(side); st.rotation.y = 0.5; sc.add(st);
      const p = (36 * Math.PI) / 180, d = 4.4;
      cam.position.set(0, 0.12 + Math.sin(p) * d, Math.cos(p) * d); cam.lookAt(0, 0.12, 0); cam.updateMatrixWorld();
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sprites.stone[side] = c; sc.remove(st);
    }
    renderer.setClearColor(0x1a100a, 1); renderer.setPixelRatio(pr); renderer.setSize(szw, szh, false);
    renderer.shadowMap.enabled = TIERS[tier].shadow > 0;
    W = 0; sprites.ready = true;
  }

  // ---------------------------------------------------------------- frame state
  let lastT = 0, clock = 0, frames = 0, ema = 16;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0; bKey = '';
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  let fdt = 0.016;
  const sm = new Map();                          // per board point: smoothed lift / tilt, so a stone eases up instead of snapping
  const ease1 = (key_, lift, tilt) => { let e = sm.get(key_); if (!e) { e = { lift, tilt }; sm.set(key_, e); } const k = 1 - Math.exp(-fdt * 16); e.lift += (lift - e.lift) * k; e.tilt += (tilt - e.tilt) * k; e.seen = clock; return e; };
  const rocks = new Map();                        // board index -> a stone settling after it landed (river stones rock on their curved base)
  const debris = [];                              // stones flicked off the board: they fly, skitter on the floor and spin down like a coin
  const seen = new WeakMap();                     // anim -> { landed, launched }
  function setStone(w, x, z, o = {}) {
    w.visible = true; w.position.set(x, TOP, z);
    const m = w.userData.model, sh = w.userData.shadow, lift = o.lift || 0;
    m.position.y = lift; m.rotation.set(o.tx || 0, o.yaw || 0, o.tz || 0, 'YXZ');
    const s = o.scale ?? 1; m.scale.set(s, s * (1 - (o.squash || 0)), s);
    sh.visible = true; sh.scale.setScalar(1.25 * s * (1 + lift * 0.5)); sh.material.opacity = 0.75 * (1 - clamp(lift * 0.9, 0, 0.7)); sh.position.set(lift * 0.25, 0.01, lift * 0.18);
  }
  const rockOf = (i) => {
    const r = rocks.get(i); if (!r) return { tx: 0, tz: 0 };
    const tau = clock - r.t; if (tau > 0.7) { rocks.delete(i); return { tx: 0, tz: 0 }; }
    const a = 0.2 * Math.exp(-tau * 6) * Math.sin(tau * 30);
    return { tx: a * r.ax, tz: a * r.az };
  };
  function launch(side, x0, z0, key_) {
    const h1 = hash(key_), h2 = hash(key_ + 9.3);
    let dx = x0, dz = z0; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; if (l < 0.01) { dx = 0; dz = -1; }
    if (L_ && PLAY.has(v3.scene) === false && dz > -0.2) dz = -0.2 - Math.abs(dz);   // the title demo flicks stones away from the camera
    const a = (h1 - 0.5) * 1.3, ca = Math.cos(a), sa = Math.sin(a), ndx = dx * ca - dz * sa, ndz = dx * sa + dz * ca;
    const D = Math.max(1.6, half() + 1.0 + h2 * 1.2 - (x0 * ndx + z0 * ndz));
    const T = 0.5, y0 = TOP + 0.1, g = 16, vy = (0 - y0 + 0.5 * g * T * T) / T;
    const w = freeDebris[side].pop() || newWrap(side);
    w.visible = true; w.userData.shadow.visible = false;
    debris.push({ side, x: x0, z: z0, y: y0, vx: ndx * D / T, vz: ndz * D / T, vy, t: 0, tl: -1, spin: (h1 > 0.5 ? 1 : -1) * (10 + h2 * 6), yaw: h1 * TAU, w });
  }
  function stepDebris(dt) {
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i]; d.t += dt;
      const m = d.w.userData.model;
      if (d.tl < 0) {
        d.vy -= 16 * dt; d.x += d.vx * dt; d.z += d.vz * dt; d.y += d.vy * dt;
        m.rotation.set(d.t * d.spin, d.yaw, d.t * d.spin * 0.6, 'YXZ'); d.w.position.set(d.x, d.y, d.z); m.position.y = 0;
        if (d.y <= 0) { d.y = 0; d.tl = d.t; d.vx *= 0.3; d.vz *= 0.3; d.vy = 1.4; burst(d.x, 0.05, d.z, 6, 0.8, 0.5); }
      } else {
        const tau = d.t - d.tl;
        if (tau < 0.25) { d.vy -= 16 * dt; d.y = Math.max(0, d.y + d.vy * dt); } else d.y = 0;
        d.x += d.vx * dt; d.z += d.vz * dt; d.vx *= 0.96; d.vz *= 0.96;
        const th = 0.5 * Math.exp(-tau * 2.0), ph = tau * (22 + tau * 14);       // spin-down: the wobble quickens as the tilt dies away
        m.rotation.set(Math.sin(ph) * th, d.yaw + tau * 9 * Math.exp(-tau * 2), Math.cos(ph) * th, 'YXZ');
        d.w.position.set(d.x, d.y, d.z);
        const fade = clamp((tau - 1.6) / 0.4, 0, 1); m.scale.setScalar(1 - fade);
        if (fade >= 1) { d.w.visible = false; m.scale.setScalar(1); freeDebris[d.side].push(d.w); debris.splice(i, 1); }
      }
    }
  }
  const clearDebris = () => { for (const d of debris) { d.w.visible = false; d.w.userData.model.scale.setScalar(1); freeDebris[d.side].push(d.w); } debris.length = 0; };

  function boardState(state) {
    const g = state.game, a = state.anim, over = state.scene === 'over', used = { 1: 0, 2: 0 };
    occupied = []; hideAll(); hlN = 0; gW = g.W;
    const take = (side) => stoneAt(side, used[side]++);
    const movingTo = a ? a.to : -1, dragging = state.drag && state.sel >= 0, idle = clock, calm = state.calm;
    for (let i = 0; i < g.board.length; i++) {
      const k = g.board[i]; if (!k || i === movingTo || (dragging && i === state.sel)) continue;
      occupied.push(i);
      const sel = state.sel === i && !a && !over, rk = rockOf(i);
      const e = ease1(i, sel ? 0.3 + (calm ? 0 : Math.sin(idle * 3) * 0.025) : 0, sel ? -0.12 : 0);
      setStone(take(k), cx(i), cz(i), { lift: e.lift, tx: e.tilt + rk.tx, tz: rk.tz, yaw: k === 1 ? 0.15 : -0.15 + (i % 5) * 0.4 });
    }
    if (a) {
      let sn = seen.get(a); if (!sn) { sn = { landed: 0, launched: 0 }; seen.set(a, sn); }
      const hops = a.path.length - 1;
      while (sn.landed < hops && a.t >= a.hop * (sn.landed + 1)) {
        const to = a.path[sn.landed + 1], fr = a.path[sn.landed];
        const dxx = cx(to) - cx(fr), dzz = cz(to) - cz(fr), l = Math.hypot(dxx, dzz) || 1;
        rocks.set(to, { t: clock, ax: dzz / l, az: -dxx / l });
        sn.landed++;
      }
      for (const [n, q] of a.caps.entries()) {
        const t0 = a.hop * (n + 1) - a.hop * 0.5, sx = cx(q), sz = cz(q);
        if (a.t < t0) {
          const rk = a.t > t0 - 0.12 ? Math.sin((a.t - (t0 - 0.12)) * 70) * 0.12 : 0;
          occupied.push(q); setStone(take(3 - a.side), sx, sz, { tx: rk, tz: -rk * 0.6, yaw: 0.2 });
        } else if (sn.launched <= n) {
          sn.launched = n + 1; launch(3 - a.side, sx, sz, q + a.to * 3 + g.moves);
          burst(sx, TOP + 0.3, sz, 14);
        }
      }
      const k = Math.min(hops - 1, Math.floor(a.t / a.hop)), f = clamp((a.t - k * a.hop) / a.hop, 0, 1), e = ease(f);
      const x0 = cx(a.path[k]), z0 = cz(a.path[k]), x1 = cx(a.path[k + 1]), z1 = cz(a.path[k + 1]), done = a.t >= a.glide;
      const jump = a.caps.length > 0, hx = x1 - x0, hz = z1 - z0, hl2 = Math.hypot(hx, hz) || 1;
      const x = done ? x1 : x0 + hx * e, z = done ? z1 : z0 + hz * e;
      const arc = done ? 0 : Math.sin(Math.PI * f) * (jump ? 0.7 : 0.2);
      const pitch = done ? 0 : Math.sin(Math.PI * f) * 0.28 * (jump ? 1 : 0.5);
      occupied.push(a.to);
      const rk = done ? rockOf(a.to) : { tx: 0, tz: 0 };
      setStone(take(a.side), x, z, { lift: arc + (done ? 0 : 0.02), tx: pitch * (hz / hl2) + rk.tx, tz: -pitch * (hx / hl2) + rk.tz, yaw: done ? 0 : e * (jump ? Math.PI : 0.4) });
      if (done && a.t < a.glide + 0.35 && !calm) { const ff = (a.t - a.glide) / 0.35; hl(x1, z1, ringTex, '#fff0cc', 0.8 * (1 - ff), 0.7 + ff * 1.4); }
    }
    if (dragging) {
      const h = planeHit(state.drag.x, state.drag.y, TOP + 0.45);
      const e = ease1('drag', 0.45, -0.1);
      if (h) setStone(take(g.board[state.sel] || g.turn), h.x, h.z, { lift: e.lift, tx: e.tilt });
    } else sm.delete('drag');
    const pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(clock * 5), isLesson = state.scene === 'lesson', last = a ? null : g.last;
    if (last && !isLesson && !over) for (const q of [last.from, last.to]) hl(cx(q), cz(q), glowTex, '#ffd25a', q === last.to ? 0.5 : 0.32, 1.15);
    if (isLesson && state.lesson && LESSONS[state.lesson.i].target !== undefined && !state.lesson.done) { const q = LESSONS[state.lesson.i].target; hl(cx(q), cz(q), ringTex, '#ff4a2a', 0.7 + 0.3 * pulse, 1.2); hl(cx(q), cz(q), glowTex, '#ff4a2a', 0.22 + 0.15 * pulse, 1.1); }
    if (state.sel >= 0 && !a && !over) {
      hl(cx(state.sel), cz(state.sel), glowTex, '#ffe27a', 0.5 + pulse * 0.25, 1.3);
      for (const m of state.selMoves) {
        const x = cx(m.to), z = cz(m.to);
        if (m.caps) { hl(x, z, ringTex, '#ff3a22', 0.8 + pulse * 0.2, 1.1); hl(x, z, glowTex, '#ff4a2a', 0.34 + pulse * 0.2, 1.0); }
        else { hl(x, z, glowTex, '#a8f0ff', 0.36 + pulse * 0.22, 0.5); hl(x, z, ringTex, '#c8f4ff', 0.6 + pulse * 0.25, 0.62); }
      }
    }
    if (state.hint && !a) {
      const p0 = state.hint.from, p1 = state.hint.to;
      for (const q of [p0, p1]) hl(cx(q), cz(q), ringTex, '#5af09a', 0.85 + pulse * 0.15, 1.2);
      const ax = cx(p0), az = cz(p0), bx = cx(p1), bz = cz(p1), n = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) * 2.2));
      for (let j = 1; j < n; j++) { const u = j / n; hl(ax + (bx - ax) * u, az + (bz - az) * u, glowTex, '#6dffa8', 0.55 + 0.3 * Math.sin(clock * 6 - j), 0.3); }
    }
    if (state.kb && !over) hl(cx(state.cursor), cz(state.cursor), ringTex, '#7dff9a', 1, 1.1);
    for (let i = hlN; i < hlPool.length; i++) hlPool[i].visible = false;
  }

  // title / documents: a looping demonstration on the real board (Jade jumps two Ember stones in one chain)
  const heroLaunched = new Map();
  function heroState(state) {
    const N = 4, T = state.calm ? 1.2 : clock % 9, used = { 1: 0, 2: 0 }, take = (s) => stoneAt(s, used[s]++);
    hideAll(); hlN = 0; occupied = [];
    const P = (r, c) => ({ x: c - N / 2, z: r - N / 2 });
    for (const [r, c, s] of [[4, 0, 1], [4, 4, 1], [4, 1, 1], [4, 3, 1], [0, 0, 2], [0, 4, 2], [0, 1, 2], [0, 3, 2]]) { const p = P(r, c); setStone(take(s), p.x, p.z, { yaw: s === 1 ? 0.2 : -0.2 + c * 0.5 }); }
    const h1 = [1.4, 2.0], h2 = [2.4, 3.0], cycle = Math.floor(clock / 9);
    for (const [e, hit, id] of [[P(3, 2), h1[1], 0], [P(1, 2), h2[1], 1]]) {
      const tHit = hit - 0.18;
      if (!state.calm && T >= tHit) { if (heroLaunched.get(id) !== cycle) { heroLaunched.set(id, cycle); launch(2, e.x, e.z, id + cycle * 3); burst(e.x, TOP + 0.3, e.z, 14); } }
      else setStone(take(2), e.x, e.z, { yaw: 0.3, tx: T > tHit - 0.12 ? Math.sin((T - tHit + 0.12) * 70) * 0.12 : 0 });
    }
    const p0 = P(4, 2), p1 = P(2, 2), p2 = P(0, 2);
    let x = p0.x, z = p0.z, lift = 0, yaw = 0, pitch = 0;
    const leg = (a, b, tt, t0, t1) => { const f = (tt - t0) / (t1 - t0), e = ease(f); x = a.x + (b.x - a.x) * e; z = a.z + (b.z - a.z) * e; lift = Math.sin(Math.PI * f) * 0.7; pitch = Math.sin(Math.PI * f) * 0.28; yaw = e * Math.PI; };
    if (T >= h1[0] && T < h1[1]) leg(p0, p1, T, h1[0], h1[1]);
    else if (T >= h1[1] && T < h2[0]) { x = p1.x; z = p1.z; yaw = Math.PI; }
    else if (T >= h2[0] && T < h2[1]) { leg(p1, p2, T, h2[0], h2[1]); yaw += Math.PI; }
    else if (T >= h2[1]) { x = p2.x; z = p2.z; yaw = 2 * Math.PI; }
    else if (T > 0.9) lift = clamp((T - 0.9) / 0.5, 0, 1) * 0.28;
    const landTau = T >= h2[1] ? T - h2[1] : T >= h1[1] && T < h2[0] ? T - h1[1] : 9;
    const rock = landTau < 0.7 && !state.calm ? 0.18 * Math.exp(-landTau * 6) * Math.sin(landTau * 30) : 0;
    setStone(take(1), x, z, { lift, tx: pitch + rock, yaw: 0.2 + yaw });
    if (!state.calm && T > 0.9 && T < h1[0]) hl(p0.x, p0.z, glowTex, '#ffe27a', 0.45, 1.3);
    for (let i = hlN; i < hlPool.length; i++) hlPool[i].visible = false;
  }

  // ----- phase 1: before the 2D UI draws (camera, pieces, projection used by the 2D badges and picking)
  function prepare(state, L) {
    resize(); L_ = L; if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const sc = state.scene; v3.scene = sc;
    const playing = PLAY.has(sc), n = playing ? state.game.n : 4;
    curN = n; gW = n + 1; sgn = state.flip && playing ? -1 : 1;
    ensureBoard(n, state.paper || 'hanji', playing && state.flip);
    if (sc === 'title' || sc === 'demo-limit') {
      const hr = v3.heroRect || { x: L.w * 0.1, y: L.h * 0.4, w: L.w * 0.8, h: L.w * 0.8 };
      fitCamera(hr, L, L.land ? 34 : 44, 32, state.calm ? 0 : Math.sin(clock * 0.2) * 4);
      heroState(state);
    } else if (sc === 'doc') {
      fitCamera({ x: L.w * 0.06, y: L.h * 0.3, w: L.w * 0.88, h: L.w * 0.88 }, L, 38, 34, state.calm ? 0 : Math.sin(clock * 0.15) * 7);
      heroState(state);
    } else {
      fitCamera({ x: L.board.x, y: L.board.y, w: L.board.S, h: L.board.S }, L, L.land ? 52 : 58, 28, 0);
      boardState(state);
    }
  }

  // ----- phase 2: after the 2D UI recorded its panels and buttons
  function present(state, L, dt) {
    const fl = room.update(clock, state.calm, dt);
    key.intensity = keyBase * (1 + fl * 1.6);
    stepDebris(dt); stepParts(dt);
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
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud, hudCam);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { syncHudEnv(); W = 0; bKey = ''; resize(); v3.on = true; });

  try {
    applyTier(); ensureBoard(4, 'hanji', false); buildSprites();
  } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  v3.on = true;

  let lastScene = '';
  return {
    ok: true, renderer, scene, camera, env,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const L = layoutFor(view?.width ?? 720, view?.height ?? 1560, state.flip, state.game.n);
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt; fdt = Math.max(dt, 0.001);
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          if (state.scene !== lastScene) { if (PLAY.has(state.scene) !== PLAY.has(lastScene)) { clearDebris(); rocks.clear(); } lastScene = state.scene; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.scrim = 0;
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
