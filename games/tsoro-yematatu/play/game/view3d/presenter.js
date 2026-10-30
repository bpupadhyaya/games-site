// Tsoro Yematatu 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: the lit courtyard scene (carved board, striped stones, dusk sky, lamp, fireflies) and a screen-space HUD scene
// (carved plaques, lacquered buttons) drawn in the same frame. The 2D layer only draws text, badges and hit-testing.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import { board3d as B, THREE } from '../vendor3d/index.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { sprites } from '../src/art.js';
import { variantOf } from '../src/rules.js';
import { LESSONS } from '../src/content.js';
import { TOP, ptXZ, makeStone, stoneHeight, STONE_R, buildBoard, buildSky, buildCourtyard } from './world.js';

const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const SY = TOP + 0.025;                               // y a stone rests on (the terrace)
const HALF = 3.05;

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  const noop = { wrap: (g) => g, ok: false };
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.autoClear = false; renderer.setClearColor(0x2a1a2a, 1); renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd89a62, 16, 66);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 500);
  const sky = buildSky(); scene.add(sky.group);
  const yard = buildCourtyard(); scene.add(yard.group);
  const rig = B.lightingRig(scene, 'duskOutdoor', { renderer, shadow: TIERS[tier].shadow, extent: 6.6, background: false, fog: false, target: [0, 0, 0], overrides: { keyPos: [-7.5, 7.6, 5.2], keyI: 3.0, key: 0xffb468, hemi: 0.5, rimI: 1.8, fillI: 0.45, exposure: 0.9 } });
  const env = B.createEnvironment(renderer, scene, { intensity: 0.45 });
  const key = rig.key;

  const hud = new THREE.Scene(), hudCam = new THREE.PerspectiveCamera();
  const hudKey = new THREE.DirectionalLight(0xffe8c8, 1.5); hudKey.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0xa8c0ff, 0.4); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe4c0, 0x1a2a2a, 0.6), hudKey, hudFill);
  const setHudProjection = (Wp, Hp) => { const n = 1, f = 2200, m = hudCam.projectionMatrix; m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1); hudCam.projectionMatrixInverse.copy(m).invert(); };

  // ---------------------------------------------------------------- board (rebuilt when kind / variant change)
  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  let boardObj = null, boardKey = '';
  const ensureBoard = (kind, variant) => {
    const k = `${kind}|${variant}`; if (k === boardKey && boardObj) return;
    if (boardObj) { boardRoot.remove(boardObj.group); boardObj.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    boardObj = buildBoard(kind, variant); boardRoot.add(boardObj.group); boardKey = k;
  };
  const pieceRoot = new THREE.Group(); boardRoot.add(pieceRoot);
  const hlRoot = new THREE.Group(); boardRoot.add(hlRoot);

  const mkTex = (draw, s = 128) => { const c = document.createElement('canvas'); c.width = c.height = s; draw(c.getContext('2d'), s); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const glowTex = mkTex((x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
  const ringTex = mkTex((x, s) => { const g = x.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.62, 'rgba(255,255,255,0.95)'); g.addColorStop(0.8, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);

  // ---------------------------------------------------------------- stone pools
  let style = 'pebble';
  const pools = [[], [], []];                          // by side (1, 2); [0] unused
  const stoneAt = (side, i) => {
    const pool = pools[side];
    while (pool.length <= i) { const w = makeStone(side, style); w.visible = false; pieceRoot.add(w); pool.push(w); }
    return pool[i];
  };
  const setStyle = (s) => { if (s === style) return; style = s; for (const p of pools) { for (const w of p) pieceRoot.remove(w); p.length = 0; } };
  const hlPool = []; let hlN = 0;
  function hl(x, z, tx, color, opacity, size, y = SY + 0.014) {
    let m = hlPool[hlN];
    if (!m) { m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; hlRoot.add(m); hlPool.push(m); }
    hlN++; m.visible = true; m.material.map = tx; m.material.color.set(color); m.material.opacity = opacity; m.position.set(x, y, z); m.scale.set(size, 1, size);
  }

  // sparks (gold, additive) + dust puffs (earthy, normal blending), instanced
  const sparkMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe3a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 96);
  const dustMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe0c196, transparent: true, opacity: 0.38, depthWrite: false }), 48);
  sparkMesh.frustumCulled = dustMesh.frustumCulled = false; boardRoot.add(sparkMesh, dustMesh);
  const sparks = [], dusts = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const burst = (x, y, z, n, up = 1.6) => { for (let i = 0; i < n; i++) { const a = (i / n) * TAU + i * 0.7, sp = 0.6 + ((i * 37) % 10) * 0.1; sparks.push({ x, y, z, vx: Math.cos(a) * sp, vy: up + ((i * 13) % 7) * 0.25, vz: Math.sin(a) * sp, life: 0, max: 0.7 + ((i * 7) % 5) * 0.12 }); } if (sparks.length > 96) sparks.splice(0, sparks.length - 96); };
  const puff = (x, z, n = 9) => { for (let i = 0; i < n; i++) { const a = (i / n) * TAU + i * 1.3, sp = 0.5 + ((i * 29) % 7) * 0.1; dusts.push({ x: x + Math.cos(a) * 0.3, y: SY + 0.05, z: z + Math.sin(a) * 0.3, vx: Math.cos(a) * sp, vy: 0.28 + ((i * 11) % 5) * 0.06, vz: Math.sin(a) * sp, life: 0, max: 0.55 + ((i * 7) % 4) * 0.1 }); } if (dusts.length > 48) dusts.splice(0, dusts.length - 48); };
  function stepParts(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.life += dt; p.vy -= 4.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.life >= p.max) sparks.splice(i, 1); }
    for (let i = dusts.length - 1; i >= 0; i--) { const p = dusts[i]; p.life += dt; p.vx *= 1 - 2.2 * dt; p.vz *= 1 - 2.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.life >= p.max) dusts.splice(i, 1); }
    for (let i = 0; i < 96; i++) { const p = sparks[i]; if (!p) _m.makeScale(0, 0, 0); else { _p.set(p.x, p.y, p.z); _s.setScalar(0.5 + (1 - p.life / p.max)); _m.compose(_p, _q, _s); } sparkMesh.setMatrixAt(i, _m); }
    for (let i = 0; i < 48; i++) { const p = dusts[i]; if (!p) _m.makeScale(0, 0, 0); else { const f = p.life / p.max; _p.set(p.x, p.y, p.z); _s.setScalar(0.5 + f * 1.8); if (f > 0.7) _s.multiplyScalar(1 - (f - 0.7) / 0.3); _m.compose(_p, _q, _s); } dustMesh.setMatrixAt(i, _m); }
    sparkMesh.instanceMatrix.needsUpdate = dustMesh.instanceMatrix.needsUpdate = true;
  }
  // fireflies and golden dust in the low sun
  const FN = 70, fpos = new Float32Array(FN * 3), fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const fmat = new THREE.PointsMaterial({ color: 0xffe9a0, size: 0.1, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false, map: glowTex });
  const flies = new THREE.Points(fgeo, fmat); flies.frustumCulled = false; scene.add(flies);
  const fseed = Array.from({ length: FN }, (_, i) => ({ a: (i * 2.399) % TAU, r: 2.4 + ((i * 7) % 11) * 0.55, h: 0.5 + ((i * 13) % 9) * 0.3, s: 0.15 + ((i * 5) % 7) * 0.05, p: i * 0.7 }));
  function stepFlies(t, calm) {
    for (let i = 0; i < FN; i++) {
      const f = fseed[i], a = f.a + t * f.s * (calm ? 0.2 : 1), r = f.r + Math.sin(t * 0.4 + f.p) * 0.6;
      fpos[i * 3] = Math.sin(a) * r; fpos[i * 3 + 1] = f.h + Math.sin(t * 0.8 + f.p) * 0.35 + (i % 3 === 0 ? ((t * 0.15 + f.p) % 3) * 0.3 : 0); fpos[i * 3 + 2] = Math.cos(a * 0.9) * r;
    }
    fgeo.attributes.position.needsUpdate = true; fmat.opacity = 0.55 + 0.3 * Math.sin(t * 2.1);
  }

  // ---------------------------------------------------------------- HUD plaques and buttons
  const hudPanels = [], hudButtons = [], geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 150) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const M = {};
  const mats = () => {
    M.wood = B.material('darkWood', { color: '#4a2c16', color2: '#7a4a26', repeat: [3, 3], seed: 11 });
    M.brass = B.material('brass', { color: '#c8962e', color2: '#ffe08a' });
    M.slate = B.material('stone', { color: '#10302b', color2: '#1f4f47', repeat: [2, 1], seed: 4, roughness: 0.6 });
    M.slateOn = B.material('stone', { color: '#245a50', color2: '#3f8f80', repeat: [2, 1], seed: 4, roughness: 0.5 }); M.slateOn.emissive = new THREE.Color('#0c3a33'); M.slateOn.emissiveIntensity = 0.6;
    M.deep = new THREE.MeshStandardMaterial({ color: '#10221f', roughness: 0.88, emissive: '#06201c', emissiveIntensity: 0.5 });
    M.tray = B.material('felt', { color: '#16403a', color2: '#0c2824', repeat: [2, 1] });
    M.card = new THREE.MeshStandardMaterial({ color: '#14302c', roughness: 0.85, emissive: '#082420', emissiveIntensity: 0.5 });
    M.btn = B.material('lacquer', { color: '#1c6f68' }); M.btnOn = B.material('lacquer', { color: '#8e7424' }); M.btnPrimary = B.material('lacquer', { color: '#ffc23a' }); M.btnPrimary.emissive = new THREE.Color('#8a5a08'); M.btnPrimary.emissiveIntensity = 0.7;
  };
  mats();
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x030c0c, transparent: true, opacity: 0, depthWrite: false })); hud.add(scrim);
  const panelAt = (i) => {
    let p = hudPanels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, M.brass), trim = new THREE.Mesh(flatQuad, M.wood), inner = new THREE.Mesh(flatQuad, M.slate); g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p); }
    return p;
  };
  const ROT = Math.PI / 2;
  function placePanel(i, r, rad, kind) {
    const p = panelAt(i); p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -700, dep = kind === 'toast' ? 8 : 14, ins = kind === 'tray' ? 12 : 10;
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.trim.geometry = slabG(r.w - ins * 1.8, r.h - ins * 1.8, dep + 1.5, Math.max(4, rad - ins * 0.9), 1.6); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.6, r.h - ins * 2.6, dep + 2.5, Math.max(3, rad - ins * 1.2), 2.2); p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    p.inner.material = kind === 'plateOn' ? M.slateOn : kind === 'tray' ? M.tray : kind === 'doc' ? M.deep : kind === 'card' ? M.card : M.slate;
  }
  const buttonAt = (i) => {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(flatQuad, M.btn), rim = new THREE.Mesh(flatQuad, M.brass); g.add(rim, body); hud.add(g); b = { g, body, rim }; hudButtons.push(b); }
    return b;
  };
  function placeButton(i, bt, pressed) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(18, r.h / 3), z = -400, dep = pressed ? 8 : 18;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, rad - 2, 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.body.material = bt.primary ? M.btnPrimary : bt.on ? M.btnOn : M.btn;
    b.g.position.set(0, pressed ? -3 : 0, 0);
  }

  // ---------------------------------------------------------------- camera fitting (board's near edge == the layout's board width)
  let W = 1, H = 1, dprNow = 1, L_ = null, hudW = 0, hudH = 0, pitchNow = 47;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight)), dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  function fitCamera(rect, L, pitchDeg, fov, yawDeg = 0, zoom = 1) {
    const k = W / L.w, targetW = rect.w * k * zoom, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180, lookY = 0.3;
    pitchNow = pitchDeg;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    let d = 22;
    const place = () => { camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d); camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); };
    for (let it = 0; it < 5; it++) { place(); const a = tmpV.set(-HALF, 0.2, HALF).project(camera).x, b = tmpW.set(HALF, 0.2, HALF).project(camera).x; d *= (((b - a) / 2) * W) / targetW; }
    place();
    const c = tmpV.set(0, 0.2, 0).project(camera);
    const px0 = ((c.x + 1) / 2) * W, py0 = ((1 - c.y) / 2) * H, cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + (rect.h ?? rect.w) / 2) * k;
    camera.setViewOffset(W, H, px0 - cxp, py0 - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => { tmpV.set(x, y, z); boardRoot.localToWorld(tmpV); tmpV.project(camera); return { x: ((tmpV.x + 1) / 2) * L_.w, y: ((1 - tmpV.y) / 2) * L_.h }; };
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3();
  const planeHit = (vx, vy, y) => {                     // virtual point -> board-local x,z on plane height y
    const ndcx = (vx / L_.w) * 2 - 1, ndcy = 1 - (vy / L_.h) * 2;
    orig.copy(camera.position); ray.set(ndcx, ndcy, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return null; const t = (y - orig.y) / ray.y; if (t < 0) return null;
    hitV.copy(orig).addScaledVector(ray, t); boardRoot.worldToLocal(hitV); return { x: hitV.x, z: hitV.z };
  };
  v3.pick = (vx, vy) => {                               // nearest point, measured on the board plane (same reach as the 2D squareAt: 0.66 cell)
    if (!L_ || !boardObj) return -1;
    const h = planeHit(vx, vy, SY); if (!h) return -1;
    const V = boardObj.V; let best = -1, bd = 0.9 * 0.9;
    for (let i = 0; i < V.n; i++) { const p = ptXZ(V, i), d = (p.x - h.x) ** 2 + (p.z - h.z) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  };

  // ---------------------------------------------------------------- sprites: stones rendered once for the 2D layer (plates, trays, result card)
  function buildSprites() {
    const SP = 256, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(14, 1, 1, 60);
    const l1 = new THREE.DirectionalLight(0xfff0d8, 3.0); l1.position.set(-3, 6, 5); const l2 = new THREE.DirectionalLight(0xa8c4ff, 1.0); l2.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xffe8d0, 0x4a4040, 1.2), l1, l2); sc.environment = scene.environment; sc.environmentIntensity = 0.5;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = false;
    sprites.stone = {};
    for (const st of ['pebble', 'ring']) for (const side of [1, 2]) {
      const s = makeStone(side, st); s.userData.shadow.visible = false; sc.add(s);
      const p = (34 * Math.PI) / 180, dist = 6.2, ly = 0.17; cam.position.set(0, ly + Math.sin(p) * dist, Math.cos(p) * dist); cam.lookAt(0, ly, 0); cam.updateMatrixWorld();
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sc.remove(s); sprites.stone[`${side}|${st}`] = c;
    }
    renderer.setClearColor(0x2a1a2a, 1); renderer.setPixelRatio(pr); renderer.setSize(szw, szh, false);
    renderer.shadowMap.enabled = TIERS[tier].shadow > 0; W = 0; sprites.ready = true;
  }

  // ---------------------------------------------------------------- frame
  let lastT = 0, clock = 0, frames = 0, ema = 16;
  function applyTier() {
    const t = TIERS[tier]; renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
  const wobble = new Map();                               // point -> clock time its stone last touched down
  let lastAnim = null, burstFor = null;
  const hideAll = () => { for (const p of pools) for (const w of p) w.visible = false; };
  function setStone(w, x, z, o = {}) {
    w.visible = true; w.position.set(x, SY, z);
    const m = w.userData.model, sh = w.userData.shadow, lift = o.lift || 0, s = o.scale ?? 1, sq = o.squash || 0;
    m.position.y = lift; m.rotation.set(o.tiltX || 0, o.yaw || 0, o.tiltZ || 0); m.scale.set(s * (1 + sq * 0.5), s * (1 - sq), s * (1 + sq * 0.5));
    sh.scale.setScalar(s * (1 - clamp(lift * 0.22, 0, 0.45))); sh.material.opacity = 0.62 * (1 - clamp(lift * 0.28, 0, 0.6));
  }
  const wob = (i, o) => {                                 // rocking on a rounded base after touching down
    const t0 = wobble.get(i); if (t0 === undefined) return;
    const age = clock - t0; if (age > 0.9) { wobble.delete(i); return; }
    const amp = Math.exp(-age * 5.5) * 0.16, ph = i * 1.7;
    o.tiltX = (o.tiltX || 0) + Math.sin(age * 22 + ph) * amp; o.tiltZ = (o.tiltZ || 0) + Math.cos(age * 22 + ph) * amp * 0.8;
  };

  function boardState(state) {
    const g = state.game, a = state.anim, V = variantOf(g.variant), over = state.scene === 'over', isLesson = state.scene === 'lesson';
    const used = [0, 0, 0]; hideAll(); hlN = 0;
    const take = (side) => stoneAt(side, used[side]++);
    const dragging = state.drag && state.sel >= 0, movingTo = a ? a.to : -1;
    const wl = g.winner && g.winner !== 3 && g.line && !a ? g.line : null, wf = wl ? Math.min(1, state.scene === 'over' ? 1 : state.winT / 0.35) : 0;
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(clock * 5);
    for (let i = 0; i < V.n; i++) {
      const v = g.board[i]; if (!v || (i === movingTo && a)) continue;
      if (dragging && i === state.sel) continue;
      const p = ptXZ(V, i), sel = state.sel === i, inLine = wl && wl.includes(i);
      let lift = sel ? 0.22 + (state.calm ? 0 : Math.sin(clock * 3) * 0.03) : 0;
      if (inLine && !state.calm) lift = 0.14 + 0.08 * Math.sin(clock * 5 + i);
      const o = { lift, yaw: v === 1 ? 0.3 : -0.3 + i * 0.4, scale: V.pieceScale / 1.0 * 0.92 }; wob(i, o);
      setStone(take(v), p.x, p.z, o);
      if (sel || inLine) hl(p.x, p.z, glowTex, inLine ? '#ffd25a' : '#ffe27a', 0.5 + pulse * 0.3, 1.5);
    }
    if (a) {
      const f = clamp(a.t / a.dur, 0, 1), p1 = ptXZ(V, a.to), o = { scale: V.pieceScale * 0.92, yaw: a.side === 1 ? 0.3 : -0.3 };
      if (a.kind === 'drop') {                              // dropped from above, spinning slightly, landing with a squash
        const e = f * f, h = (1 - e) * 3.0 * (state.calm ? 0.4 : 1);
        o.lift = h; o.tiltX = (1 - e) * 0.5; o.tiltZ = -(1 - e) * 0.35; o.yaw += (1 - e) * 1.4;
        if (f > 0.9) o.squash = 0.12 * Math.sin(((f - 0.9) / 0.1) * Math.PI);
        setStone(take(a.side), p1.x, p1.z, o);
        hl(p1.x, p1.z, ringTex, '#fff0c8', 0.35 * f, 1.0 + (1 - f) * 0.8);
      } else {
        const p0 = ptXZ(V, a.from), r = B.pieceMoveAt({ x: p0.x, y: 0, z: p0.z }, { x: p1.x, y: 0, z: p1.z }, a.t, { duration: a.dur, lift: 0.7, bounce: 0, settle: 0 });
        o.lift = r.y; o.tiltX = Math.sin(f * Math.PI) * 0.18; o.yaw += f * 0.6;
        setStone(take(a.side), r.x, r.z, o);
      }
      lastAnim = { to: a.to, kind: a.kind };
    } else if (lastAnim) {                                  // the stone just touched down: puff of dust, a rock, a ring
      const p = ptXZ(V, lastAnim.to);
      if (!state.calm || true) { wobble.set(lastAnim.to, clock); puff(p.x, p.z, lastAnim.kind === 'drop' ? 10 : 6); }
      hl(p.x, p.z, ringTex, '#fff0c8', 0.7, 1.7);
      lastAnim = null;
    }
    // a dragged stone follows the finger, lifted
    if (dragging) { const h = planeHit(state.drag.x, state.drag.y - L_.cell * 0.1, SY + 0.5); if (h) setStone(take(g.board[state.sel] || g.turn), h.x, h.z, { lift: 0.5, scale: V.pieceScale * 0.98, yaw: 0.4 }); }
    // markers
    const last = a ? null : g.last;
    if (last && !isLesson && !g.winner) for (const q of [last.from, last.to]) { if (q < 0) continue; const p = ptXZ(V, q); hl(p.x, p.z, ringTex, '#ffd66e', 0.55, 1.15); }
    const myTurn = !over && !a && !g.winner && (state.autoMode ? false : (isLesson || state.two || g.turn === state.humanSide));
    const dropping = g.placed[g.turn] < V.stones;
    if (myTurn && dropping && !state.hint) for (let i = 0; i < V.n; i++) if (!g.board[i]) { const p = ptXZ(V, i); hl(p.x, p.z, glowTex, '#ffecaa', 0.28 + pulse * 0.2, 0.62); }
    if (isLesson && state.lesson && !state.lesson.done && LESSONS[state.lesson.i].target !== undefined) { const p = ptXZ(V, LESSONS[state.lesson.i].target); hl(p.x, p.z, ringTex, '#ff5a34', 0.7 + 0.3 * pulse, 1.25); hl(p.x, p.z, glowTex, '#ff4a2a', 0.3 + 0.2 * pulse, 1.1); }
    if (state.marks && myTurn && !isLesson && state.threat && state.threat.size) for (const i of state.threat) { if (g.board[i]) continue; const p = ptXZ(V, i); hl(p.x, p.z, ringTex, '#ff3a22', 0.7 + pulse * 0.3, 1.2); hl(p.x, p.z, glowTex, '#ff4a2a', 0.22 + pulse * 0.16, 1.05); }
    if (state.sel >= 0 && !a && !over) {
      const sp = ptXZ(V, state.sel); hl(sp.x, sp.z, glowTex, '#ffe27a', 0.5 + pulse * 0.25, 1.5);
      for (const m of state.selMoves) { const p = ptXZ(V, m.to); hl(p.x, p.z, ringTex, '#fff8d6', 0.75 + pulse * 0.25, 1.1); hl(p.x, p.z, glowTex, '#ffec96', 0.3 + pulse * 0.2, 0.9); }
    }
    if (state.hint && !a) for (const q of [state.hint.from, state.hint.to]) { if (q < 0) continue; const p = ptXZ(V, q); hl(p.x, p.z, ringTex, '#5af09a', 0.85 + pulse * 0.15, 1.2); hl(p.x, p.z, glowTex, '#5af09a', 0.25 + pulse * 0.2, 1.1); }
    if (state.kb && !over) { const p = ptXZ(V, state.cursor); hl(p.x, p.z, ringTex, '#7dff9a', 1, 1.15); }
    // the winning line: gold wire ignites from the first stone to the last, a ribbon of light, sparks at each stone
    boardObj.inlays.forEach((m, li) => { m.material.emissiveIntensity = 0.12 + 0.05 * Math.sin(clock * 1.5 + li); });
    if (wl) {
      const p0 = ptXZ(V, wl[0]), p2 = ptXZ(V, wl[2]), li = V.lines.findIndex((l) => l.includes(wl[0]) && l.includes(wl[2]));
      if (li >= 0) boardObj.inlays[li].material.emissiveIntensity = 2.4 * wf + 0.8 * Math.sin(clock * 7);
      const ang = Math.atan2(p2.z - p0.z, p2.x - p0.x), len = Math.hypot(p2.x - p0.x, p2.z - p0.z), t = state.scene === 'over' ? 9 : state.winT;
      const run = clamp(t / 0.5, 0, 1);
      hl((p0.x + p0.x + (p2.x - p0.x) * run) / 2, (p0.z + p0.z + (p2.z - p0.z) * run) / 2, glowTex, '#ffd25a', 0.55 + 0.25 * Math.sin(clock * 6), 1 + len * run * 0.6);
      for (let k = 0; k < 6; k++) { const u = (k + 0.5) / 6 * run; hl(p0.x + (p2.x - p0.x) * u, p0.z + (p2.z - p0.z) * u, glowTex, '#fff2c0', 0.7, 0.9); }
      if (burstFor !== g.line && state.scene !== 'over') { burstFor = g.line; for (const q of wl) { const pp = ptXZ(V, q); burst(pp.x, SY + 0.3, pp.z, 14, 2.2); } }
      if (!state.calm && state.scene !== 'over' && Math.floor(clock * 10) % 4 === 0) for (const q of wl) { const pp = ptXZ(V, q); if (((Math.floor(clock * 10) + q) % 3) === 0) burst(pp.x, SY + 0.35, pp.z, 2, 1.2); }
      void ang;
    } else if (burstFor && !g.winner) burstFor = null;
    for (let i = hlN; i < hlPool.length; i++) hlPool[i].visible = false;
  }

  // the title / documents backdrop: the classic triangle playing its demonstration, forever
  function heroState(state) {
    const V = variantOf('classic'), T = state.frozen || state.calm ? 6.2 : state.t % 10, used = [0, 0, 0];
    hideAll(); hlN = 0;
    const seq = [[0, 1, 0.5], [2, 2, 1.1], [1, 1, 1.7], [3, 2, 2.3], [5, 1, 2.9], [6, 2, 3.5]], DROP = 0.4, SLIDE = [5, 4, 4.6, 5.1];
    const resetT = 8.4, fadeOp = T > resetT ? Math.max(0, 1 - (T - resetT) / 0.6) : 1;
    const put = (side, x, z, o) => { const w = stoneAt(side, used[side]++); setStone(w, x, z, { scale: 0.95 * (0.4 + 0.6 * fadeOp) * 1, ...o }); w.userData.shadow.material.opacity *= fadeOp; };
    for (const [i, side, t0] of seq) {
      if (T < t0) continue; if (i === SLIDE[0] && T >= SLIDE[2]) continue;
      const f = clamp((T - t0) / DROP, 0, 1), p = ptXZ(V, i);
      put(side, p.x, p.z, { lift: (1 - f * f) * 3.0, tiltX: (1 - f) * 0.4, yaw: side === 1 ? 0.3 : -0.3 + (1 - f) * 1.2, squash: f > 0.9 && f < 1 ? 0.1 : 0 });
      if (f >= 1 && f < 1.0001) { /* touchdown handled below */ }
      const age = T - t0 - DROP; if (age > 0 && age < 0.9) { const amp = Math.exp(-age * 5.5) * 0.16; const w = pools[side][used[side] - 1]; w.userData.model.rotation.x += Math.sin(age * 22 + i) * amp; w.userData.model.rotation.z += Math.cos(age * 22 + i) * amp * 0.8; }
      if (age > 0 && age < 0.05 && burstFor !== `h${i}${Math.floor(state.t / 10)}`) { burstFor = `h${i}${Math.floor(state.t / 10)}`; puff(p.x, p.z, 8); }
    }
    if (T >= SLIDE[2]) {
      const f = clamp((T - SLIDE[2]) / (SLIDE[3] - SLIDE[2]), 0, 1), p0 = ptXZ(V, SLIDE[0]), p1 = ptXZ(V, SLIDE[1]), r = B.pieceMoveAt({ x: p0.x, y: 0, z: p0.z }, { x: p1.x, y: 0, z: p1.z }, f, { duration: 1, lift: 0.7, bounce: 0, settle: 0 });
      put(1, r.x, r.z, { lift: r.y, tiltX: Math.sin(f * Math.PI) * 0.18, yaw: 0.3 + f * 0.6 });
    }
    const won = T > SLIDE[3] + 0.1 && T < resetT + 0.4;
    boardObj.inlays.forEach((m, li) => { m.material.emissiveIntensity = 0.12; });
    if (won) {
      const li = V.lines.findIndex((l) => l.includes(0) && l.includes(4)), tt = T - SLIDE[3];
      if (li >= 0) boardObj.inlays[li].material.emissiveIntensity = 2.2 * clamp(tt / 0.3, 0, 1) * fadeOp + 0.6 * Math.sin(clock * 7);
      for (const q of [0, 1, 4]) { const p = ptXZ(V, q); hl(p.x, p.z, glowTex, '#ffd25a', 0.7 * fadeOp, 1.5); }
      if (burstFor !== `w${Math.floor(state.t / 10)}`) { burstFor = `w${Math.floor(state.t / 10)}`; for (const q of [0, 1, 4]) { const p = ptXZ(V, q); burst(p.x, SY + 0.3, p.z, 12, 2.0); } }
    }
    for (let i = hlN; i < hlPool.length; i++) hlPool[i].visible = false;
  }

  function prepare(state, L) {
    resize(); L_ = L; if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const sc = state.scene; v3.scene = sc;
    const kind = ['granite', 'soap', 'copper'].includes(state.board) ? state.board : 'granite';
    const hero = sc === 'title' || sc === 'demo-limit' || sc === 'doc';
    ensureBoard(kind, hero ? 'classic' : state.game.variant); setStyle(state.style === 'ring' ? 'ring' : 'pebble');
    boardRoot.rotation.y = 0;
    if (sc === 'title' || sc === 'demo-limit') {
      const hr = v3.heroRect || { x: L.w * 0.1, y: L.h * 0.4, w: L.w * 0.8, h: L.w * 0.8 };
      fitCamera(hr, L, L.land ? 16 : 15, 44, state.calm ? 0 : Math.sin(clock * 0.2) * 5); heroState(state);
    } else if (sc === 'doc') {
      fitCamera({ x: L.w * 0.06, y: L.h * 0.3, w: L.w * 0.88, h: L.w * 0.88 }, L, 32, 34, state.calm ? 0 : Math.sin(clock * 0.15) * 7); heroState(state);
    } else {
      fitCamera({ x: L.board.x, y: L.board.y, w: L.board.S, h: L.board.S }, L, L.land ? 60 : 64, 30, 0, L.playZoom || 1); boardState(state);   // zoomed so the triangle (not the slab) fills the width; the slab rim runs off the screen edges
    }
  }
  function present(state, L, dt) {
    yard.update(clock, state.calm); stepFlies(clock, state.calm); stepParts(dt);
    rig.key.target.position.set(0, 0, 0);
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p.r, p.rad, p.kind);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0; const pr = v3.pressed;
    for (const b of v3.buttons) { const pressed = !!pr && pr.x >= b.r.x && pr.x <= b.r.x + b.r.w && pr.y >= b.r.y && pr.y <= b.r.y + b.r.h; placeButton(n++, b, pressed); }
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, -1000);
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud, hudCam);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { try { env.rebuild(); mats(); } catch (e) { /* no reflections, still playable */ } W = 0; resize(); v3.on = true; });

  try { applyTier(); ensureBoard('granite', 'classic'); buildSprites(); }
  catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) { const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null; return game.update(dt, input); },
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
