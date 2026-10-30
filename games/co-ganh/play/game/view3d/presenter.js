// Co Ganh 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: the board scene (lacquered board, two-sided turn-over pieces, lantern-lit courtyard, camera fitted to the
// layout's board rectangle) and a screen-space HUD scene (carved plaques, lacquered buttons, real pieces for the plates) drawn in the
// same frame. Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { sprites } from '../src/art.js';
import { LESSONS } from '../src/content.js';
import { buildBoard, makePiece, buildEnvironment, LOOKS, N, HALF, PANEL_TOP, REST_Y, HT, R_PIECE, cellX, cellZ } from './world.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (f) => f * f * (3 - 2 * f);
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const flipAngle = (v) => (v === 1 ? 0 : Math.PI);        // piece rotation.x that shows side v (1 Red, 2 Jade) on top

function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function radial(rgb, a, size = 128, ring = 0) {
  const c = cv(size), x = c.getContext('2d'), m = size / 2, g = x.createRadialGradient(m, m, 0, m, m, m);
  if (!ring) { g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  else { g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(ring - 0.18, `rgba(${rgb},0)`); g.addColorStop(ring, `rgba(${rgb},${a})`); g.addColorStop(Math.min(0.99, ring + 0.12), `rgba(${rgb},${a * 0.25})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
}
const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

const tick = () => new Promise((r) => setTimeout(r, 0));   // yield so the flat title paints and stays interactive while the 3D scene builds
export async function createPresenter({ kitCanvas, quality = 'high' }) {
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  const noop = { wrap: (g) => g, ok: false };
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.autoClear = false; renderer.setClearColor(0x07141a, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  await tick();
  // ---------------------------------------------------------------- the world
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07141a);
  scene.fog = new THREE.Fog(0x07141a, 20, 56);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 200);
  const env = buildEnvironment(); scene.add(env.group);
  const hemi = new THREE.HemisphereLight(0x8fb4bc, 0x2a1810, 0.32);
  const key = new THREE.DirectionalLight(0xffd9a8, 2.3); key.position.set(-4.5, 9, 6.5); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -4.6, right: 4.6, top: 4.6, bottom: -4.6, near: 2, far: 30 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  const rim = new THREE.DirectionalLight(0x6fe0d4, 1.2); rim.position.set(6, 5, -8);
  const fill = new THREE.DirectionalLight(0xffa86a, 0.5); fill.position.set(7, 3, 6);
  scene.add(hemi, key, key.target, rim, fill);

  const hud = new THREE.Scene();
  const hudCam = new THREE.PerspectiveCamera();
  const hudKey = new THREE.DirectionalLight(0xfff0d8, 1.25); hudKey.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0x8fd8d0, 0.5); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xbfe6e0, 0x24150c, 0.45), hudKey, hudFill);

  function buildEnvMap() {
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; pm.dispose();
    scene.environment = t; scene.environmentIntensity = 0.38;
    hud.environment = t; hud.environmentIntensity = 0.14;
  }
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  await tick();
  // ---------------------------------------------------------------- board + pieces
  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  let boardGrp = null, boardKind = null;
  function ensureBoard(kind) {
    if (boardKind === kind && boardGrp) return;
    if (boardGrp) { boardRoot.remove(boardGrp); boardGrp.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    boardGrp = buildBoard(LOOKS[kind] ? kind : 'paper'); boardRoot.add(boardGrp); boardKind = kind;
  }
  const pieceRoot = new THREE.Group(); boardRoot.add(pieceRoot);
  const hlRoot = new THREE.Group(); boardRoot.add(hlRoot);
  const blobTex = tex(radial('0,0,0', 0.7)), glowTex = tex(radial('255,255,255', 0.95)), ringTex = tex(radial('255,255,255', 0.95, 128, 0.78)), ringThin = tex(radial('255,255,255', 1, 128, 0.9));
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  let style = 'lacquer';
  const pieces = [];
  function pieceAt(i) {
    while (pieces.length <= i) {
      const wrap = new THREE.Group(), model = makePiece(style), spin = new THREE.Group();
      const sh = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 }));
      sh.position.y = PANEL_TOP + 0.014; sh.renderOrder = 1; sh.scale.setScalar(1.05);
      spin.add(model); wrap.add(sh, spin); wrap.userData = { model, spin, sh }; pieceRoot.add(wrap); wrap.visible = false; pieces.push(wrap);
    }
    return pieces[i];
  }
  function setStyle(s) {
    if (s === style) return; style = s;
    for (const w of pieces) pieceRoot.remove(w);
    pieces.length = 0;
  }
  const hlPool = []; let hlN = 0;
  function hl(x, z, t, color, opacity, size, y = PANEL_TOP + 0.02) {
    let m = hlPool[hlN];
    if (!m) { m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; hlRoot.add(m); hlPool.push(m); }
    hlN++; m.visible = true; m.material.map = t; m.material.color.set(color); m.material.opacity = opacity; m.position.set(x, y, z); m.scale.set(size, 1, size);
  }
  const spark = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 64);
  spark.frustumCulled = false; boardRoot.add(spark);
  const parts = []; const burstSeen = new WeakMap();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function burst(x, y, z, n, up = 1.6, spread = 0.9) {
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + i * 0.7, sp = spread * (0.6 + ((i * 37) % 10) * 0.07); parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: up * (0.6 + ((i * 13) % 7) * 0.12), vz: Math.sin(a) * sp, life: 0, max: 0.5 + ((i * 7) % 5) * 0.1 }); }
    if (parts.length > 64) parts.splice(0, parts.length - 64);
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life += dt; p.vy -= 5.4 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.life >= p.max || p.y < PANEL_TOP) parts.splice(i, 1); }
    for (let i = 0; i < 64; i++) { const p = parts[i]; if (!p) _m.makeScale(0, 0, 0); else { _p.set(p.x, p.y, p.z); _s.setScalar(0.4 + (1 - p.life / p.max)); _m.compose(_p, _q, _s); } spark.setMatrixAt(i, _m); }
    spark.instanceMatrix.needsUpdate = true;
  }

  await tick();
  // ---------------------------------------------------------------- HUD: carved plaques, lacquered buttons, real pieces
  const hudPanels = [], hudButtons = [], hudIcons = [];
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 150) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const hm = {};
  const phys = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, ...o });
  hm.wood = B.material('darkWood', { color: '#4a2a14', color2: '#7a4a24', repeat: [3, 3] });
  hm.brass = new THREE.MeshStandardMaterial({ color: '#d4a038', metalness: 0.88, roughness: 0.3 });
  hm.slate = new THREE.MeshStandardMaterial({ color: '#103840', roughness: 0.8, metalness: 0.05 });
  hm.slateOn = new THREE.MeshStandardMaterial({ color: '#145058', roughness: 0.7, emissive: '#0a3a40', emissiveIntensity: 0.8 });
  hm.doc = new THREE.MeshStandardMaterial({ color: '#0d3239', roughness: 0.85 });
  hm.toast = phys('#0a2a31', { roughness: 0.5, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  hm.banner = phys('#b3231a', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  hm.red = phys('#b81d0f', { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  hm.teal = phys('#16595a', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  hm.amber = phys('#b8822a', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, emissive: '#3a2506', emissiveIntensity: 0.5 });
  hm.dim = phys('#27403f', { roughness: 0.5, clearcoat: 0.4 });
  hm.rimDim = new THREE.MeshStandardMaterial({ color: '#7a6330', metalness: 0.6, roughness: 0.45 });
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x020b0d, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, hm.wood), trim = new THREE.Mesh(flatQuad, hm.brass), inner = new THREE.Mesh(flatQuad, hm.slate); g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p); }
    return p;
  }
  const ROT = Math.PI / 2;
  function placePanel(i, pn) {
    const p = panelAt(i), r = pn.r, rad = pn.rad, kind = pn.kind; p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -1000 + i * 17, dep = kind === 'toast' ? 8 : 14, ins = kind === 'toast' || kind === 'banner' ? 4 : 7;
    p.g.position.set(cx, cy, z); p.g.scale.set(1, clamp(pn.a, 0.02, 1), 1);
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT;
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.4); p.trim.rotation.x = ROT;
    p.inner.geometry = slabG(r.w - ins * 2.4, r.h - ins * 2.4, dep + 2.6, Math.max(3, rad - ins), 2.2); p.inner.rotation.x = ROT;
    p.inner.material = kind === 'plateOn' ? hm.slateOn : kind === 'doc' ? hm.doc : kind === 'toast' ? hm.toast : kind === 'banner' ? hm.banner : hm.slate;
    p.trim.material = kind === 'plateOn' || kind === 'banner' ? hm.brass : hm.rimDim;
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(flatQuad, hm.teal), rimM = new THREE.Mesh(flatQuad, hm.brass); g.add(rimM, body); hud.add(g); b = { g, body, rim: rimM }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt, pressed) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(18, r.h / 3), dep = pressed ? 8 : 18;
    b.g.position.set(cx, cy - (pressed ? 3 : 0), -400);
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT;
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, rad - 2, 6); b.body.rotation.x = ROT;
    b.body.material = bt.dim ? hm.dim : bt.primary ? hm.red : bt.on ? hm.amber : hm.teal;
    b.rim.material = bt.dim ? hm.rimDim : hm.brass;
  }
  function iconAt(i) {
    let ic = hudIcons[i];
    if (!ic) {
      const g = new THREE.Group(), tilt = new THREE.Group(), flip = new THREE.Group(), model = makePiece(style);
      flip.add(model); tilt.add(flip); g.add(tilt);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.6 }));
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd27a }));
      hud.add(g, sh, gl); ic = { g, tilt, flip, model, sh, gl, style }; hudIcons.push(ic);
    }
    if (ic.style !== style) { ic.flip.remove(ic.model); ic.model = makePiece(style); ic.flip.add(ic.model); ic.style = style; }
    return ic;
  }
  function placeIcon(i, it, t) {
    const ic = iconAt(i), size = it.size, sc = size / (2 * R_PIECE);
    ic.g.visible = ic.sh.visible = true; ic.gl.visible = it.glow > 0;
    const cx = it.x, cy = -it.y, lift = (it.lift || 0) * size * 0.5;
    ic.g.position.set(cx, cy + lift * 0.4, -450); ic.g.scale.setScalar(sc);
    ic.tilt.rotation.set(1.06 + Math.sin(t * 1.3 + i) * 0.03, 0, Math.sin(t * 0.9 + i * 2) * 0.05);
    ic.flip.rotation.x = flipAngle(it.side);
    ic.model.rotation.y = it.spin || 0;
    ic.sh.position.set(cx + size * 0.03, cy - size * 0.18, -470); ic.sh.scale.set(size * 1.0, size * 0.42, 1); ic.sh.material.opacity = 0.55 * (1 - clamp(lift / size, 0, 0.6));
    if (it.glow > 0) { ic.gl.position.set(cx, cy, -480); ic.gl.scale.set(size * 1.9, size * 1.9, 1); ic.gl.material.opacity = 0.55 * it.glow; }
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
  // Fits the camera so the board's near edge is rect.w wide (virtual units) and the board's centre sits at the rect's centre.
  function fitCamera(rect, L, pitchDeg, fov, yawDeg = 0) {
    const k = W / L.w, targetW = rect.w * k, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180, lookY = 0.2;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    let d = 20;
    const place = () => { camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d); camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); };
    for (let it = 0; it < 6; it++) {
      place();
      const a = tmpV.set(-HALF, 0.38, HALF).project(camera).x, b = tmpW.set(HALF, 0.38, HALF).project(camera).x;
      d *= (((b - a) / 2) * W) / targetW;
    }
    place();
    const c = tmpV.set(0, 0.2, 0).project(camera);
    const px0 = ((c.x + 1) / 2) * W, py0 = ((1 - c.y) / 2) * H, cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + (rect.h ?? rect.w) / 2) * k;
    camera.setViewOffset(W, H, px0 - cxp, py0 - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => { tmpV.set(x, y, z); boardRoot.localToWorld(tmpV); tmpV.project(camera); return { x: ((tmpV.x + 1) / 2) * L_.w, y: ((1 - tmpV.y) / 2) * L_.h }; };
  v3.sq = (i) => toVirt(cellX(i), PANEL_TOP + 0.1, cellZ(i));
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3();
  function unproj(vx, vy, yPlane = PANEL_TOP + HT) {
    if (!L_) return null;
    const ndcx = (vx / L_.w) * 2 - 1, ndcy = 1 - (vy / L_.h) * 2;
    orig.copy(camera.position); ray.set(ndcx, ndcy, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return null;
    const t = (yPlane - orig.y) / ray.y; if (t < 0) return null;
    hitV.copy(orig).addScaledVector(ray, t); boardRoot.worldToLocal(hitV);
    return { x: hitV.x, z: hitV.z };
  }
  v3.unproj = unproj;
  v3.pick = (vx, vy) => {
    if (!L_ || !boardGrp) return -1;
    const h = unproj(vx, vy); if (!h) return -1;
    const c = Math.floor(h.x + N / 2), r = Math.floor(h.z + N / 2);
    if (c < 0 || c > N - 1 || r < 0 || r > N - 1) return -1;
    return r * N + c;
  };

  await tick();
  // ---------------------------------------------------------------- sprites: the same pieces rendered once for the 2D diagrams
  function buildSprites() {
    const SP = 192, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(14, 1, 1, 60);
    const l1 = new THREE.DirectionalLight(0xfff0d8, 3.0); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0x9fe0d8, 1.0); l2.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xdfeee8, 0x4a3a30, 1.0), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.5;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = false;
    for (const st of ['lacquer', 'ink']) for (const v of [1, 2]) {
      const mdl = makePiece(st), wrap = new THREE.Group(); wrap.add(mdl); mdl.rotation.x = flipAngle(v); wrap.rotation.x = 0.95; sc.add(wrap);
      cam.position.set(0, 0.3, 6.2); cam.lookAt(0, 0.0, 0); cam.updateMatrixWorld();
      renderer.clear(); renderer.render(sc, cam);
      const c = cv(SP); c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP); sprites.piece[`${v}|${st}`] = c; sc.remove(wrap);
    }
    renderer.setClearColor(0x07141a, 1); renderer.setPixelRatio(pr); renderer.setSize(szw, szh, false);
    renderer.shadowMap.enabled = TIERS[tier].shadow > 0; W = 0; sprites.ready = true;
  }

  await tick();
  // ---------------------------------------------------------------- frame
  let lastT = 0, clock = 0, frames = 0, ema = 16;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
  const yawOf = (i) => (((i * 37) % 11) - 5) * 0.045;
  // lays one piece at board x,z: rx = rotation about x (0 Red up, PI Jade up, between = turning over)
  function setPiece(w, x, z, o = {}) {
    w.visible = true; w.position.set(x, 0, z);
    const { spin, sh } = w.userData, lift = o.lift || 0, sc = o.scale ?? 1;
    spin.position.y = REST_Y + lift; spin.scale.set(sc, sc * (1 - (o.squash || 0)), sc);
    w.userData.model.rotation.set(o.rx ?? 0, o.yaw ?? 0, o.rz ?? 0);
    const s = sc * (1 - clamp(lift * 0.25, 0, 0.4)) * 1.05; sh.scale.set(s, 1, s);
    sh.material.opacity = 0.8 * (1 - clamp(lift * 0.5, 0, 0.7));
  }
  const hideAll = () => { for (const w of pieces) w.visible = false; };
  let burstKey = null;

  function boardState(state) {
    const g = state.game, a = state.anim, over = state.scene === 'over', calm = state.calm, scn = state.scene;
    hideAll(); hlN = 0; let used = 0;
    const take = () => pieceAt(used++);
    const pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(clock * 5);
    const dragging = !!state.drag && state.sel >= 0 && !a;
    const dragPos = dragging ? unproj(state.drag.x, state.drag.y - 20) : null;
    const forced = state.must && state.must.size && !a && !over && !state.autoMode && (state.two || g.turn === state.humanSide) && state.sel < 0 ? state.must : null;
    for (let i = 0; i < N * N; i++) {
      const v = g.board[i]; if (!v) continue;
      if (a && i === a.to) continue;
      if (dragging && state.sel === i) continue;
      const x = cellX(i), z = cellZ(i), fk = a ? a.flips.indexOf(i) : -1;
      if (fk >= 0) {
        const f = (a.t - (a.flipAt + fk * a.gap)) / a.flipDur, old = 3 - a.side, w = take();
        if (f <= 0) setPiece(w, x, z, { rx: flipAngle(old), yaw: yawOf(i) });
        else if (f < 1) {
          const e = calm ? (f < 0.5 ? 0 : 1) : ease(f), dir = flipAngle(a.side) - flipAngle(old);
          setPiece(w, x, z, { rx: flipAngle(old) + dir * e, lift: calm ? 0 : Math.sin(Math.PI * f) * 0.66, yaw: yawOf(i) + Math.sin(f * Math.PI) * 0.35, scale: 1 + Math.sin(Math.PI * f) * 0.08 });
          let sk = burstSeen.get(a); if (!(sk instanceof Set)) { sk = new Set(); burstSeen.set(a, sk); }
          if (!sk.has(fk)) { sk.add(fk); burst(x, PANEL_TOP + 0.28, z, 10, 1.9, 0.9); }
          hl(x, z, ringTex, a.kinds[fk] === 'trap' ? '#ff8a50' : '#ffe08a', 0.9 * (1 - f), 0.7 + 1.5 * f);
        } else {
          const since = a.t - (a.flipAt + fk * a.gap) - a.flipDur, rock = since < 0.4 ? Math.exp(-since * 9) * Math.cos(since * 30) * 0.1 : 0;
          setPiece(w, x, z, { rx: flipAngle(a.side), yaw: yawOf(i), rz: rock });
        }
        continue;
      }
      const sel = state.sel === i && !over;
      const lift = sel ? 0.34 + (calm ? 0 : Math.sin(clock * 3) * 0.035) : 0;
      setPiece(take(), x, z, { rx: flipAngle(v), yaw: yawOf(i), lift, rz: sel && !calm ? Math.sin(clock * 2.2) * 0.05 : 0 });
      if (sel) hl(x, z, glowTex, '#ffd27a', 0.5 + pulse * 0.25, 1.35);
      if (forced && forced.has(i)) hl(x, z, ringTex, '#ffcd5a', 0.55 + 0.4 * pulse, 1.25);
    }
    // the moving piece: lifts, arcs over one step, lands with a little rock and a puff of sparks
    if (a) {
      const p0 = a.path[0], p1 = a.path[1], f = clamp(a.t / a.hop, 0, 1), e = ease(f);
      const x = cellX(p0) + (cellX(p1) - cellX(p0)) * e, z = cellZ(p0) + (cellZ(p1) - cellZ(p0)) * e;
      const landed = a.t >= a.glide, since = a.t - a.glide;
      const lift = landed ? Math.max(0, 0.18 * Math.exp(-since * 14) * Math.abs(Math.cos(since * 22))) : Math.sin(Math.PI * f) * 0.5 + 0.2 * (1 - f);
      setPiece(take(), x, z, { rx: flipAngle(a.val), yaw: yawOf(p0) + (yawOf(p1) - yawOf(p0)) * e, lift, rz: landed ? Math.exp(-since * 8) * Math.cos(since * 26) * 0.12 : 0, squash: landed && since < 0.1 ? 0.1 * (1 - since / 0.1) : 0 });
      if (landed && !burstSeen.has(a)) { burstSeen.set(a, 'landed'); burst(cellX(p1), PANEL_TOP + 0.05, cellZ(p1), 7, 0.9, 0.7); }
      if (landed && since < 0.5) hl(cellX(p1), cellZ(p1), ringTex, '#fff2c8', 0.7 * (1 - since / 0.5), 0.9 + since * 1.6);
    }
    if (dragging && dragPos) { setPiece(take(), dragPos.x, dragPos.z, { rx: flipAngle(g.board[state.sel] || g.turn), lift: 0.6, scale: 1.06 }); hl(dragPos.x, dragPos.z, glowTex, '#ffd27a', 0.7, 1.4); }
    // markers: last move, legal points (a ring and a bead; gold ring where a step flips), the hint, a lesson target, the keyboard cursor
    const last = a ? null : g.last;
    if (last && last.flips && scn !== 'lesson' && !over) for (const q of [last.from, last.to]) hl(cellX(q), cellZ(q), glowTex, '#ffd25a', 0.4, 1.05);
    if (scn === 'lesson' && state.lesson && !state.lesson.done) { const tg = LESSONS[state.lesson.i].target; if (tg !== undefined) hl(cellX(tg), cellZ(tg), ringTex, '#ff5a3a', 0.6 + 0.4 * pulse, 1.2); }
    if (state.sel >= 0 && !a && !over) {
      for (const m of state.selMoves) {
        const x = cellX(m.to), z = cellZ(m.to);
        if (m.caps) { hl(x, z, ringTex, '#ffbe28', 0.8 + pulse * 0.2, 1.22); hl(x, z, glowTex, '#ffc83a', 0.3 + pulse * 0.2, 1.05); }
        else { hl(x, z, glowTex, '#b8ffe0', 0.4 + pulse * 0.25, 0.5); hl(x, z, ringTex, '#d6fff0', 0.6 + pulse * 0.3, 0.62); }
      }
    }
    if (state.hint && !a) for (const q of [state.hint.from, state.hint.to]) hl(cellX(q), cellZ(q), ringTex, '#5af09a', 0.8 + pulse * 0.2, 1.3);
    if (state.kb && !over && scn !== 'lesson') hl(cellX(state.cursor), cellZ(state.cursor), ringThin, '#7dff9a', 1, 1.12);
    for (let i = hlN; i < hlPool.length; i++) hlPool[i].visible = false;
  }

  // the title / documents backdrop: a looping flank-and-flip demonstration on the real board
  const HERO_STILL = [[4, 0, 1], [4, 3, 1], [4, 4, 1], [0, 1, 1], [1, 0, 1], [0, 3, 2], [0, 4, 2], [1, 4, 2]];
  function heroState(state) {
    const calm = state.calm, T = state.frozen ? 2.6 : calm ? 1.2 : state.t % 9;
    hideAll(); hlN = 0; let used = 0;
    const pc = (r, c, ang, o = {}) => setPiece(pieceAt(used++), c - 2, r - 2, { rx: ang, yaw: yawOf(r * 5 + c), ...o });
    const op = T < 0.5 ? T / 0.5 : T > 7.6 ? Math.max(0, 1 - (T - 7.6) / 0.7) : 1, sc = 0.2 + 0.8 * ease(op);
    const t1 = 1.3, t1e = 1.8, fa = 1.95, fb = 2.12, t2 = 3.8, t2e = 4.3, fc = 4.45;
    for (const [r, c, s] of HERO_STILL) pc(r, c, flipAngle(s), { scale: sc });
    const turn = (r, c, t0, v0, v1, extra = {}) => {
      const f = (T - t0) / 0.5;
      if (f > 0 && f < 1) {
        const e = calm ? (f < 0.5 ? 0 : 1) : ease(f);
        pc(r, c, flipAngle(v0) + (flipAngle(v1) - flipAngle(v0)) * e, { lift: calm ? 0 : Math.sin(Math.PI * f) * 0.66, scale: sc, yaw: yawOf(r * 5 + c) + Math.sin(f * Math.PI) * 0.35, ...extra });
        const k2 = `hf${r}${c}${Math.floor(state.t / 9)}`;
        if (burstKey !== k2 && f > 0.4) { burstKey = k2; burst(c - 2, PANEL_TOP + 0.28, r - 2, 10, 1.9, 0.9); }
        hl(c - 2, r - 2, ringTex, '#ffe08a', 0.9 * (1 - f), 0.7 + 1.5 * f);
      } else pc(r, c, flipAngle(f >= 1 ? v1 : v0), { scale: sc, ...extra });
    };
    turn(0, 0, fc, 2, 1); turn(2, 3, fb, 2, 1);
    if (T < t2) turn(2, 1, fa, 2, 1);
    else { const f = clamp((T - t2) / (t2e - t2), 0, 1), e = ease(f); setPiece(pieceAt(used++), -1, 0 + (-1 - 0) * e, { rx: 0, lift: Math.sin(Math.PI * f) * 0.5, scale: sc, yaw: yawOf(11) }); }
    { // the first mover: (3,2) -> (2,2)
      let lift = 0, z = 1;
      if (T >= 0.6 && T < t1) { lift = clamp((T - 0.6) / 0.5, 0, 1) * 0.35; hl(0, 1, glowTex, '#ffd27a', 0.55, 1.35); }
      if (T >= t1 && T <= t1e) { const f = ease((T - t1) / (t1e - t1)); z = 1 - f; lift = Math.sin(Math.PI * f) * 0.5; } else if (T > t1e) z = 0;
      setPiece(pieceAt(used++), 0, z, { rx: 0, lift, yaw: yawOf(17), scale: sc });
    }
    for (let i = hlN; i < hlPool.length; i++) hlPool[i].visible = false;
  }

  await tick();
  // ----- phase 1: before the 2D UI draws (camera, pieces, projection used by the 2D badges and by picking)
  function prepare(state, L) {
    resize(); L_ = L; if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    ensureBoard(LOOKS[state.board] ? state.board : 'paper'); setStyle(state.style === 'ink' ? 'ink' : 'lacquer');
    const sc = state.scene, playing = sc === 'play' || sc === 'over' || sc === 'lesson';
    boardRoot.rotation.y = state.flip && playing ? Math.PI : 0;
    v3.scene = sc;
    if (sc === 'title' || sc === 'demo-limit' || sc === 'doc') {
      const hr = (sc === 'doc' ? null : v3.heroRect) || { x: L.w * 0.06, y: L.h * 0.3, w: L.w * 0.88, h: L.w * 0.7 };
      const tw = Math.min(hr.w * 0.97, (hr.h / 0.78) * 0.99);
      fitCamera({ x: hr.x + hr.w / 2 - tw / 2, y: hr.y, w: tw, h: hr.h }, L, L.land ? 40 : 42, 36, state.calm ? 0 : Math.sin(clock * 0.2) * 5);
      heroState(state);
    } else {
      const b = L.board;
      fitCamera({ x: b.x, y: b.y, w: b.S, h: b.S }, L, L.land ? 50 : 47, 32, 0);
      boardState(state);
    }
  }

  await tick();
  // ----- phase 2: after the 2D UI recorded its panels, buttons and piece icons
  function present(state, L, dt) {
    env.update(clock, state.calm);
    key.position.set(-4.5, 9, 6.5); key.target.position.set(0, 0, 0);
    stepParts(dt);
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0; const pr = v3.pressed;
    for (const b of v3.buttons) {
      const pressed = !!pr && pr.x >= b.r.x && pr.x <= b.r.x + b.r.w && pr.y >= b.r.y && pr.y <= b.r.y + b.r.h && !b.dim;
      placeButton(n++, b, pressed);
    }
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    n = 0; for (const it of v3.icons) placeIcon(n++, it, clock);
    for (let i = n; i < hudIcons.length; i++) { hudIcons[i].g.visible = hudIcons[i].sh.visible = hudIcons[i].gl.visible = false; }
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, -1100);
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud, hudCam);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnvMap(); } catch (e) { /* no reflections, still playable */ }
    W = 0; resize(); v3.on = true;
  });

  try { buildEnvMap(); applyTier(); ensureBoard('paper'); buildSprites(); } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  await tick();
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* first frame compiles instead */ }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, v3,
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
          v3.panels.length = 0; v3.buttons.length = 0; v3.icons.length = 0; v3.scrim = 0;
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
