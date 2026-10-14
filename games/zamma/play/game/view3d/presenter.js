// Zamma 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: a dusk-lit dune scene with the carved sand board and lathed stones, plus a screen-space HUD scene
// (carved plaques, lacquered buttons). The 2D layer draws text, badges and hit-testing.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import { board3d as B } from '../vendor3d/index.js';
import { v3, sprites } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { sideOf, isSultan, nOf, VARIANTS } from '../src/rules.js';
import { LESSONS } from '../src/content.js';
import { FT, ST, boardSize, buildBoard, makeStone, buildEnvironment } from './models.js';
import { tex, blobCanvas, ringCanvas, furrowCanvas, sparkCanvas, skyCanvas } from './mats.js';

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
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.autoClear = false;
  renderer.setClearColor(0x2a1830, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- scene, light, environment
  const scene = new THREE.Scene();
  const skyTex = tex(skyCanvas(), {}); scene.background = skyTex;
  scene.fog = new THREE.Fog(0x5a2e44, 13, 40);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 220);
  const env = buildEnvironment(); scene.add(env.group);
  const hemi = new THREE.HemisphereLight(0xffc9a0, 0x2c2040, 0.26);
  const key = new THREE.DirectionalLight(0xffa456, 2.9); key.position.set(-10, 3.7, 4);
  const rim = new THREE.DirectionalLight(0x86a0ff, 1.9); rim.position.set(7, 5, -9);
  const fill = new THREE.DirectionalLight(0xa08cff, 0.28); fill.position.set(6, 4, 9);
  key.castShadow = true; Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 46 });
  key.shadow.camera.updateProjectionMatrix(); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  scene.add(hemi, key, key.target, rim, fill);
  const sunGlow = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshBasicMaterial({ map: tex(blobCanvas('255,170,90', 0.9, 256), {}), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sunGlow.position.set(-9, 3.5, -30); scene.add(sunGlow);

  const hud = new THREE.Scene();
  const hudCam = new THREE.PerspectiveCamera();
  const hudLight = new THREE.DirectionalLight(0xffe2b8, 1.7); hudLight.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0x9aa8ff, 0.4); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffd8b0, 0x2a1a3a, 0.6), hudLight, hudFill);
  let envHandle = null;
  function syncEnv() { hud.environment = scene.environment; hud.environmentIntensity = 0.16; }
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  // ---------------------------------------------------------------- board (cached per size / surface)
  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  const boards = new Map(); let boardGrp = null, boardKey = '', curN = 5;
  function ensureBoard(n, alq, wood) {
    const k = `${n}|${alq ? 1 : 0}|${wood}`;
    if (k === boardKey && boardGrp) return;
    if (boardGrp) boardRoot.remove(boardGrp);
    let b = boards.get(k);
    if (!b) { b = buildBoard(wood, n, alq); boards.set(k, b); if (boards.size > 6) { const old = boards.keys().next().value; boards.delete(old); } }
    boardGrp = b; boardKey = k; curN = n; boardRoot.add(b);
  }
  const pieceRoot = new THREE.Group(); boardRoot.add(pieceRoot);
  const hlRoot = new THREE.Group(); boardRoot.add(hlRoot);
  const glowTex = tex(blobCanvas('255,255,255', 0.95), {}), ringTex = tex(ringCanvas('255,255,255', 128, 0.72), {});
  const blobTex = tex(blobCanvas('0,0,0', 0.7), {}), sparkTex = tex(sparkCanvas(), {}), furrowTex = tex(furrowCanvas(), {});
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);

  // ---------------------------------------------------------------- stone pools
  let style = 'stone';
  const pools = new Map();
  function take(side, king) {
    const key2 = `${style}|${side}|${king ? 1 : 0}`;
    let p = pools.get(key2); if (!p) { p = { list: [], used: 0 }; pools.set(key2, p); }
    if (p.used >= p.list.length) {
      const wrap = new THREE.Group(), model = makeStone(side, style, king);
      const shadow = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8, fog: false }));
      shadow.position.y = 0.012; shadow.renderOrder = 1;
      wrap.add(shadow, model); wrap.userData = { model, shadow, king }; pieceRoot.add(wrap); p.list.push(wrap);
    }
    return p.list[p.used++];
  }
  function setStyle(s) { if (s === style) return; style = s; for (const p of pools.values()) { for (const w of p.list) pieceRoot.remove(w); } pools.clear(); }
  function resetPools() { for (const p of pools.values()) { p.used = 0; } }
  function hideUnused() { for (const p of pools.values()) for (let i = 0; i < p.list.length; i++) p.list[i].visible = i < p.used; }
  function setPiece(w, x, z, o = {}) {
    w.visible = true; w.position.set(x, ST + (o.y || 0), z);
    const m = w.userData.model, sh = w.userData.shadow, lift = o.lift || 0, s = o.scale ?? 1, sq = o.squash || 0;
    m.position.y = lift; m.rotation.set(o.tiltX || 0, o.yaw || 0, o.tiltZ || 0); m.scale.set(s * (1 + sq * 0.5), s * (1 - sq), s * (1 + sq * 0.5));
    sh.scale.setScalar(0.95 * s * (1 + clamp(lift, 0, 1) * 0.35)); sh.material.opacity = 0.8 * (1 - clamp(lift * 1.1, 0, 0.55)) * (o.fade ?? 1);
    sh.position.set(lift * 0.35, 0.012 - (o.y || 0), lift * -0.18);
  }

  // ---------------------------------------------------------------- highlights, grains, sparks, furrows, ripples
  const hlPool = []; let hlN = 0;
  function hl(x, z, tx, color, opacity, size, y = ST + 0.012) {
    let m = hlPool[hlN];
    if (!m) { m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; hlRoot.add(m); hlPool.push(m); }
    hlN++; m.visible = true; m.material.map = tx; m.material.color.set(color); m.material.opacity = opacity; m.position.set(x, y, z); m.scale.set(size, 1, size);
  }
  const NG = 80, NS = 48;
  const grains = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.03, 0.04), new THREE.MeshStandardMaterial({ color: '#e0c48a', roughness: 0.95 }), NG);
  grains.frustumCulled = false; grains.castShadow = true; boardRoot.add(grains);
  const sparks = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), NS);
  sparks.frustumCulled = false; boardRoot.add(sparks);
  const gp = [], sp = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
  const grainBurst = (x, y, z, n, power = 1, dx = 0, dz = 0) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + i * 1.9, v = (0.5 + ((i * 37) % 10) * 0.08) * power;
      gp.push({ x, y, z, vx: Math.cos(a) * v + dx, vy: 0.8 + ((i * 13) % 7) * 0.18, vz: Math.sin(a) * v + dz, rx: i, rv: 6 + (i % 5) * 3, life: 0, max: 0.55 + ((i * 7) % 5) * 0.09 });
    }
    if (gp.length > NG) gp.splice(0, gp.length - NG);
  };
  const sparkBurst = (x, y, z, n) => {
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + i * 0.7, v = 0.9 + ((i * 37) % 10) * 0.1; sp.push({ x, y, z, vx: Math.cos(a) * v, vy: 1.4 + ((i * 13) % 7) * 0.22, vz: Math.sin(a) * v, life: 0, max: 0.7 + ((i * 7) % 5) * 0.1 }); }
    if (sp.length > NS) sp.splice(0, sp.length - NS);
  };
  function stepParts(dt) {
    for (let i = gp.length - 1; i >= 0; i--) {
      const p = gp[i]; p.life += dt; p.vy -= 5.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < ST + 0.015) { p.y = ST + 0.015; p.vy *= -0.15; p.vx *= 0.5; p.vz *= 0.5; }
      if (p.life >= p.max) gp.splice(i, 1);
    }
    for (let i = 0; i < NG; i++) {
      const p = gp[i];
      if (!p) _m.makeScale(0, 0, 0); else { _p.set(p.x, p.y, p.z); _q.setFromEuler(_e.set(p.rx + p.life * p.rv, p.rx * 2, p.life * p.rv * 0.6)); const k = 1 - Math.max(0, (p.life - p.max * 0.7) / (p.max * 0.3)); _s.setScalar(0.7 + 0.8 * (i % 3) / 2 * k); _m.compose(_p, _q, _s); }
      grains.setMatrixAt(i, _m);
    }
    grains.instanceMatrix.needsUpdate = true;
    for (let i = sp.length - 1; i >= 0; i--) { const p = sp[i]; p.life += dt; p.vy -= 4.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.life >= p.max) sp.splice(i, 1); }
    for (let i = 0; i < NS; i++) {
      const p = sp[i];
      if (!p) _m.makeScale(0, 0, 0); else { _p.set(p.x, p.y, p.z); const k = 1 - p.life / p.max; _q.copy(camera.quaternion); _s.setScalar(0.5 + k * 1.4); _m.compose(_p, _q, _s); }
      sparks.setMatrixAt(i, _m);
    }
    sparks.instanceMatrix.needsUpdate = true;
  }
  const furrows = []; const furrowMeshes = [];
  function furrowMesh(i) {
    let m = furrowMeshes[i];
    if (!m) { m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: furrowTex, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 1; hlRoot.add(m); furrowMeshes[i] = m; }
    return m;
  }
  function drawFurrows() {
    for (let i = furrows.length - 1; i >= 0; i--) if (furrows[i].dead !== null && clock - furrows[i].dead > 2.2) furrows.splice(i, 1);
    furrows.forEach((f, i) => {
      const m = furrowMesh(i), dx = f.x1 - f.x0, dz = f.z1 - f.z0, len = Math.hypot(dx, dz);
      m.visible = len > 0.05; m.position.set((f.x0 + f.x1) / 2, ST + 0.008, (f.z0 + f.z1) / 2); m.rotation.y = -Math.atan2(dz, dx);
      m.scale.set(len + 0.1, 1, 0.34); m.material.opacity = f.dead === null ? 0.85 : Math.max(0, 0.85 * (1 - (clock - f.dead) / 2.2));
    });
    for (let i = furrows.length; i < furrowMeshes.length; i++) if (furrowMeshes[i]) furrowMeshes[i].visible = false;
  }
  const fired = new WeakMap();
  const fireOnce = (a, id) => { let s = fired.get(a); if (!s) { s = new Set(); fired.set(a, s); } if (s.has(id)) return false; s.add(id); return true; };

  // ---------------------------------------------------------------- HUD plaques and buttons (screen space)
  const hudPanels = [], hudButtons = [], geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 160) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const woodHud = B.material('darkWood', { color: '#5a3a1e', color2: '#2e1a0b', repeat: [3, 3], seed: 11 });
  const brassHud = B.material('brass', { roughness: 0.3 });
  const feltOf = (c0, c1, emissive) => { const m = B.material('cloth', { color: c0, color2: c1, repeat: [5, 3], seed: 5, roughness: 0.95 }); if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 0.55; } return m; };
  const innerMats = { plate: feltOf('#24140a', '#33200f'), plateOn: feltOf('#2c200c', '#423012', '#2a1a04'), doc: feltOf('#180d06', '#24140a'), toast: feltOf('#0e0703', '#1a0e06'), tray: feltOf('#2a1c0c', '#3a2812') };
  const lacq = (c, o = {}) => B.material('lacquer', { color: c, ...o });
  const btnMats = { primary: lacq('#0c857d', { envIntensity: 0.4 }), normal: lacq('#5a2a12', { envIntensity: 0.4 }), on: lacq('#126660', { envIntensity: 0.4 }), dim: lacq('#2c1c14', { roughness: 0.5, envIntensity: 0.3 }) };
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x0c0508, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  const ROT = Math.PI / 2;
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, woodHud), trim = new THREE.Mesh(flatQuad, brassHud), inner = new THREE.Mesh(flatQuad, innerMats.plate); g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p); }
    return p;
  }
  function placePanel(i, r, rad, kind) {
    const p = panelAt(i); p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -700, dep = kind === 'toast' ? 8 : 14, ins = kind === 'toast' ? 5 : kind === 'tray' ? 9 : 11;
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.6); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.5, Math.max(3, rad - ins), 2.2); p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    p.inner.material = innerMats[kind] || innerMats.plate;
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(flatQuad, btnMats.normal), rimM = new THREE.Mesh(flatQuad, brassHud); g.add(rimM, body); hud.add(g); b = { g, body, rim: rimM }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt, pressed) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(18, r.h / 3), z = -400, dep = pressed ? 8 : 18;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 8, r.h - 8, dep, rad - 2, 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.body.material = bt.dim ? btnMats.dim : bt.primary ? btnMats.primary : bt.on ? btnMats.on : btnMats.normal;
    b.g.position.set(0, pressed ? -3 : 0, 0);
  }

  // ---------------------------------------------------------------- camera
  let W = 1, H = 1, dprNow = 1, L_ = null, hudW = 0, hudH = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  function fitCamera(rect, L, pitchDeg, fov, yawDeg = 0) {
    const half = boardSize(curN) / 2, k = W / L.w, targetW = rect.w * k, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180, lookY = 0.1;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    let d = 22;
    const place = () => {
      camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    for (let it = 0; it < 5; it++) {
      place();
      const a = tmpV.set(-half, FT, half).project(camera).x, b = tmpW.set(half, FT, half).project(camera).x;
      d *= (((b - a) / 2) * W) / targetW;
    }
    place();
    scene.fog.near = d * 1.02 + 1; scene.fog.far = d * 1.02 + 24;
    const c = tmpV.set(0, 0.1, 0).project(camera);
    const px0 = ((c.x + 1) / 2) * W, py0 = ((1 - c.y) / 2) * H, cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + (rect.h ?? rect.w) / 2) * k;
    camera.setViewOffset(W, H, px0 - cxp, py0 - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => { tmpV.set(x, y, z).project(camera); return { x: ((tmpV.x + 1) / 2) * L_.w, y: ((1 - tmpV.y) / 2) * L_.h }; };
  let flip = false;
  const cellXZ = (i) => {
    const n = curN, m = n - 1, r = (i / n) | 0, c = i % n, rr = flip ? m - r : r, cc = flip ? m - c : c;
    return { x: cc - m / 2, z: rr - m / 2 };
  };
  v3.sq = (i, h = 0) => { const q = cellXZ(i); return toVirt(q.x, ST + h, q.z); };
  let occupied = [];
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3();
  const groundAt = (vx, vy, y = ST) => {
    const ndcx = (vx / L_.w) * 2 - 1, ndcy = 1 - (vy / L_.h) * 2;
    orig.copy(camera.position); ray.set(ndcx, ndcy, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return null;
    const t = (y - orig.y) / ray.y; if (t < 0) return null;
    return hitV.copy(orig).addScaledVector(ray, t);
  };
  v3.pick = (vx, vy) => {
    if (!L_) return -1;
    const n = curN; let best = -1, bd = 1e9;
    for (const i of occupied) {
      const q = cellXZ(i), base = toVirt(q.x, ST + 0.04, q.z), top = toVirt(q.x, ST + 0.5, q.z);
      const cx = base.x, cy = (base.y + top.y) / 2, ry = Math.abs(base.y - top.y) / 2 + v3.unit * 0.12, rx = v3.unit * 0.4;
      const dx = (vx - cx) / rx, dy = (vy - cy) / ry, dd = dx * dx + dy * dy;
      if (dd <= 1 && dd < bd) { bd = dd; best = i; }
    }
    if (best >= 0 && bd <= 0.6) return best;
    const h = groundAt(vx, vy); if (!h) return best;
    const cc = Math.floor(h.x + n / 2), rr = Math.floor(h.z + n / 2);
    if (cc < 0 || cc >= n || rr < 0 || rr >= n) return best;
    return (flip ? n - 1 - rr : rr) * n + (flip ? n - 1 - cc : cc);
  };

  // ---------------------------------------------------------------- sprites: the stones rendered once for the 2D plates and trays
  function buildSprites() {
    const SP = 256, sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-0.775, 0.775, 0.775, -0.775, 0.1, 20);
    const l1 = new THREE.DirectionalLight(0xfff0d8, 3.0); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0xaab8ff, 1.0); l2.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xfff0e0, 0x5a4a5a, 1.1), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.7;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = false;
    const pitch = (24 * Math.PI) / 180, yT = 0.133 / Math.cos(pitch);
    cam.position.set(0, yT + Math.sin(pitch) * 6, Math.cos(pitch) * 6); cam.lookAt(0, yT, 0); cam.updateMatrixWorld();
    const keep = style;
    for (const st of ['stone', 'glaze']) for (const side of [1, 2]) for (const king of [false, true]) {
      const m = makeStone(side, st, king); m.rotation.y = 0.35; sc.add(m);
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sprites.stone[`${side}|${st}|${king ? 1 : 0}`] = c; sc.remove(m);
    }
    style = keep;
    renderer.setClearColor(0x2a1830, 1);
    renderer.setPixelRatio(pr); renderer.setSize(szw, szh, false);
    renderer.shadowMap.enabled = TIERS[tier].shadow > 0;
    W = 0; sprites.ready = true;
  }

  // ---------------------------------------------------------------- frame
  let lastT = 0, clock = 0, frames = 0, ema = 16;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  function boardState(state, L) {
    const g = state.game, a = state.anim, over = state.scene === 'over', N = curN, idle = clock;
    occupied = []; resetPools(); hlN = 0;
    const movingTo = a ? a.to : -1, dragging = !!(state.drag && state.sel >= 0);
    for (let i = 0; i < N * N; i++) {
      const k = g.board[i]; if (!k || i === movingTo || (dragging && i === state.sel)) continue;
      occupied.push(i);
      const q = cellXZ(i), king = isSultan(k), sel = state.sel === i;
      setPiece(take(sideOf(k), king), q.x, q.z, { lift: sel ? 0.2 + (state.calm ? 0 : Math.sin(idle * 3) * 0.025) : 0, yaw: (i * 0.7) % 6.28 });
    }
    const dirOf = (k) => {   // direction of the jump that took victim k, for the tumble
      const p0 = cellXZ(a.path[Math.min(k, a.path.length - 2)]), p1 = cellXZ(a.path[Math.min(k + 1, a.path.length - 1)]);
      const dx = p1.x - p0.x, dz = p1.z - p0.z, l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l };
    };
    if (a) {
      for (let k = 0; k < a.caps.length; k++) {
        const qi = a.caps[k], v = a.capVals[k], q = cellXZ(qi), tj = (k + 1) * a.segDur - a.segDur * 0.5;
        if (a.t < tj) { occupied.push(qi); setPiece(take(sideOf(v), isSultan(v)), q.x, q.z, { yaw: (qi * 0.7) % 6.28 }); }
        else {
          const f = clamp((a.t - tj) / 0.7, 0, 1);
          if (fireOnce(a, 'c' + k)) { grainBurst(q.x, ST + 0.12, q.z, 14, 1.2); sparkBurst(q.x, ST + 0.3, q.z, 6); }
          if (f < 1) {
            const d = dirOf(k), side = k % 2 ? 1 : -1, e = f;
            setPiece(take(sideOf(v), isSultan(v)), q.x + d.x * e * 1.5 - d.z * side * e * 0.5, q.z + d.z * e * 1.5 + d.x * side * e * 0.5,
              { lift: Math.sin(Math.PI * Math.min(1, e * 1.15)) * 0.95, scale: 1 - 0.6 * e * e, tiltX: e * 9 * d.z, tiltZ: -e * 9 * d.x, fade: 1 - e });
          }
        }
      }
      // the moving stone, landing to landing along its path
      const segs = a.path.length - 1, s = Math.min(segs - 1, Math.floor(a.t / a.segDur)), f = clamp((a.t - s * a.segDur) / a.segDur, 0, 1), e = ease(f);
      const p0 = cellXZ(a.path[s]), p1 = cellXZ(a.path[s + 1]);
      const x = p0.x + (p1.x - p0.x) * e, z = p0.z + (p1.z - p0.z) * e, jump = a.caps.length > 0;
      const gliding = a.t < a.glide;
      const arc = jump ? 0.55 : 0.12 + Math.min(0.2, Math.hypot(p1.x - p0.x, p1.z - p0.z) * 0.04);
      const pick0 = s === 0 ? 1 - ease(clamp(a.t / (a.segDur * 0.3), 0, 1)) : 0;
      const t2 = a.t - a.glide;
      const settle = !gliding ? Math.exp(-t2 * 11) * Math.cos(t2 * 30) : 0;
      const lift = gliding ? Math.sin(Math.PI * f) * arc + 0.16 * (s === 0 ? 1 - f : 0.5) : Math.max(0, settle * 0.1);
      const crowned = a.promote && !gliding;
      const pop = crowned && !state.calm ? 1 + 0.2 * Math.sin(clamp(t2 / 0.35, 0, 1) * Math.PI) : 1;
      setPiece(take(a.side, a.king || crowned), x, z, { lift, squash: !gliding ? settle * 0.1 : 0, scale: pop, tiltX: gliding ? (p1.z - p0.z) * 0.18 * Math.sin(Math.PI * f) : 0, tiltZ: gliding ? -(p1.x - p0.x) * 0.18 * Math.sin(Math.PI * f) : 0 });
      void pick0;
      // sand: a furrow behind a sliding stone, grains kicked up at every landing
      if (!jump && gliding) {
        const id = 'f' + s; let fr = furrows.find((q) => q.a === a && q.id === id);
        if (!fr) { fr = { a, id, x0: p0.x, z0: p0.z, x1: p0.x, z1: p0.z, dead: null }; furrows.push(fr); }
        fr.x1 = x; fr.z1 = z;
        if (!state.calm && f > 0.1 && f < 0.95 && Math.floor(a.t * 40) !== Math.floor((a.t - 0.016) * 40)) grainBurst(x - (p1.x - p0.x) * 0.1, ST + 0.03, z - (p1.z - p0.z) * 0.1, 1, 0.5, -(p1.x - p0.x) * 0.5, -(p1.z - p0.z) * 0.5);
      }
      for (const fr of furrows) if (fr.a === a && fr.dead === null && fr.id !== 'f' + s) fr.dead = clock - 0.1;
      for (let k = 1; k <= segs; k++) if (a.t >= k * a.segDur - 0.001 && fireOnce(a, 'l' + k)) { const q = cellXZ(a.path[k]); grainBurst(q.x, ST + 0.05, q.z, k === segs ? 10 : 6, 0.9); }
      if (!gliding && fireOnce(a, 'end')) { for (const fr of furrows) if (fr.a === a && fr.dead === null) fr.dead = clock; }
      if (a.promote && !gliding && fireOnce(a, 'crown')) { const q = cellXZ(a.to); sparkBurst(q.x, ST + 0.45, q.z, 16); grainBurst(q.x, ST + 0.1, q.z, 8, 1.2); }
      if (!gliding && a.t < a.glide + 0.5) { const ff = (a.t - a.glide) / 0.5, q = cellXZ(a.to); hl(q.x, q.z, ringTex, a.promote ? '#ffe9a0' : '#fff1d2', 0.75 * (1 - ff), 0.8 + ff * (a.promote ? 2.2 : 1.4)); }
      if (a.promote && !gliding && !state.calm) { const q = cellXZ(a.to); hl(q.x, q.z, glowTex, '#ffd25a', 0.5 * (1 - clamp(t2 / 0.8, 0, 1)), 1.8); }
    } else { for (const fr of furrows) if (fr.dead === null) fr.dead = clock; }
    // markers
    const mine = !a && !over && !state.autoMode && !g.winner && (state.scene === 'lesson' || state.two || g.turn === state.humanSide);
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(clock * 5);
    const last = a ? null : g.last;
    if (last && state.scene !== 'lesson') for (const qi of [last.from, ...last.path]) { const q = cellXZ(qi); hl(q.x, q.z, glowTex, '#ffd470', 0.36, 1.0); }
    if (state.scene === 'lesson' && LESSONS[state.lesson.i].target !== undefined && !state.lesson.done) { const q = cellXZ(LESSONS[state.lesson.i].target); hl(q.x, q.z, ringTex, '#ff5030', 0.6 + 0.4 * pulse, 1.05); hl(q.x, q.z, glowTex, '#ff5030', 0.25 + 0.15 * pulse, 1.1); }
    if (mine && state.forced && state.sel < 0) for (const qi of state.movers) { const q = cellXZ(qi); hl(q.x, q.z, ringTex, '#38e0d0', 0.55 + pulse * 0.4, 1.1); }
    if (state.sel >= 0 && !a && !over) {
      const sq = cellXZ(state.sel); hl(sq.x, sq.z, glowTex, '#ffe27a', 0.5 + pulse * 0.25, 1.3);
      const pts = [state.sel, ...state.pre];
      for (let i = 0; i < pts.length - 1; i++) { const p0 = cellXZ(pts[i]), p1 = cellXZ(pts[i + 1]); const steps = 5; for (let j = 1; j < steps; j++) hl(p0.x + (p1.x - p0.x) * j / steps, p0.z + (p1.z - p0.z) * j / steps, glowTex, '#ff5a38', 0.5, 0.3); }
      for (const qi of state.pre) { const q = cellXZ(qi); hl(q.x, q.z, glowTex, '#ff5a38', 0.45, 0.9); }
      for (const m of state.selMoves) {
        const q = cellXZ(m.to);
        if (m.caps) { hl(q.x, q.z, ringTex, '#ff3a22', 0.8 + pulse * 0.2, 1.05); hl(q.x, q.z, glowTex, '#ff4a2a', 0.3 + pulse * 0.2, 1.0); }
        else { hl(q.x, q.z, glowTex, '#fff0b0', 0.4 + pulse * 0.2, 0.5); hl(q.x, q.z, ringTex, '#ffe9a0', 0.6 + pulse * 0.3, 0.62); }
      }
    }
    if (state.hint && !a) for (const qi of [state.hint.from, ...(state.hint.path || [state.hint.to])]) { const q = cellXZ(qi); hl(q.x, q.z, glowTex, '#40e0a0', 0.35 + pulse * 0.2, 1.1); hl(q.x, q.z, ringTex, '#5af09a', 0.9, 1.1); }
    if (state.kb && !over) { const q = cellXZ(state.cursor); hl(q.x, q.z, ringTex, '#7dff9a', 1, 1.0); }
    if (dragging) { const h = groundAt(state.drag.x, state.drag.y - 20, ST + 0.35); if (h) setPiece(take(sideOf(g.board[state.sel]) || g.turn, isSultan(g.board[state.sel])), clamp(h.x, -N / 2, N / 2), clamp(h.z, -N / 2, N / 2), { lift: 0.35, tiltX: 0.1 }); }
    hideUnused();
    for (let i = hlN; i < hlPool.length; i++) hlPool[i].visible = false;
  }

  // the title / documents backdrop: a looping demonstration on a small board (the same script as the 2D hero)
  function heroState(state) {
    const T = state.calm ? 3.2 : (state.t + 2.7) % 9, at = (r, c) => ({ x: c - 2, z: r - 2 });
    resetPools(); hlN = 0; occupied = []; flip = false;
    const lerp = (A, Bp, f) => ({ x: A.x + (Bp.x - A.x) * f, z: A.z + (Bp.z - A.z) * f });
    const op = T < 0.5 ? T / 0.5 : T > 6.4 ? Math.max(0, 1 - (T - 6.4) / 0.6) : 1;
    const fixed = [[1, 0, 2], [0, 1, 2], [4, 0, 1], [4, 4, 1], [3, 4, 1]], victims = [[3, 2, 1.9], [1, 3, 2.45]];
    for (const [r, c, s2] of fixed) { const p = at(r, c); setPiece(take(s2, false), p.x, p.z, { scale: op, yaw: r + c, fade: op }); }
    victims.forEach(([r, c, tc], k) => {
      const p = at(r, c), f = (T - tc) / 0.7;
      if (T < tc) setPiece(take(2, false), p.x, p.z, { scale: op, yaw: r * c, fade: op });
      else if (f < 1) { const d = k ? 1 : -1; setPiece(take(2, false), p.x + d * f * 1.2, p.z - f * 1.4, { lift: Math.sin(Math.PI * Math.min(1, f * 1.15)) * 0.9, scale: 1 - 0.6 * f * f, tiltX: f * 8, tiltZ: f * 5 * d, fade: 1 - f }); }
    });
    const A = at(4, 1), Bp = at(2, 3), C = at(0, 3);
    let pos = A, lift = 0;
    if (T < 1.4) { pos = A; lift = clamp((T - 0.9) / 0.5, 0, 1) * 0.16; }
    else if (T < 1.9) { const f = ease((T - 1.4) / 0.5); pos = lerp(A, Bp, f); lift = 0.16 + Math.sin(Math.PI * f) * 0.5; }
    else if (T < 1.95) { pos = Bp; lift = 0.16; }
    else if (T < 2.45) { const f = ease((T - 1.95) / 0.5); pos = lerp(Bp, C, f); lift = 0.16 + Math.sin(Math.PI * f) * 0.5; }
    else { pos = C; lift = Math.max(0, 0.16 * (1 - (T - 2.45) / 0.3)); }
    const crowned = T > 2.55;
    setPiece(take(1, crowned), pos.x, pos.z, { lift: lift * op + (crowned && !state.calm ? Math.sin(clock * 1.6) * 0.01 : 0), scale: crowned && T < 2.9 ? 1 + 0.18 * Math.sin((T - 2.55) / 0.35 * Math.PI) : 1, fade: op });
    const cyc = Math.floor((state.t + 2.7) / 9);
    if (T > 2.55 && T < 2.7 && !state.calm && fireOnce(heroAnim, 'k' + cyc)) { sparkBurst(C.x, ST + 0.45, C.z, 16); grainBurst(C.x, ST + 0.1, C.z, 8, 1.2); }
    if (T > 1.9 && T < 1.97 && !state.calm && fireOnce(heroAnim, 'a' + cyc)) grainBurst(Bp.x, ST + 0.1, Bp.z, 8, 1);
    if (crowned && T < 3.3) hl(C.x, C.z, glowTex, '#ffd25a', 0.55 * (1 - (T - 2.55) / 0.75), 1.9);
    hideUnused();
    for (let i = hlN; i < hlPool.length; i++) hlPool[i].visible = false;
    for (const fr of furrows) if (fr.dead === null) fr.dead = clock;
  }
  const heroAnim = {};

  function prepare(state, L) {
    resize(); L_ = L; if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const wood = state.wood || 'sand', sc = state.scene;
    const playing = sc === 'play' || sc === 'over' || sc === 'lesson';
    const variant = VARIANTS[state.game.variant];
    if (playing) { ensureBoard(variant.n, variant.alq, wood); flip = !!state.flip; } else { ensureBoard(5, false, wood); flip = false; }
    setStyle(state.style === 'glaze' ? 'glaze' : 'stone');
    const drift = state.calm ? 0 : Math.sin(clock * 0.22) * 6;
    if (sc === 'title' || sc === 'demo-limit') {
      const hr = v3.heroRect || { x: L.w * 0.1, y: L.h * 0.4, w: L.w * 0.8, h: L.w * 0.8 };
      fitCamera(hr, L, L.land ? 42 : 52, 36, drift);
      heroState(state);
    } else if (sc === 'doc') {
      fitCamera({ x: L.w * 0.05, y: L.h * 0.36, w: L.w * 0.9, h: L.w * 0.9 }, L, 38, 36, drift);
      heroState(state);
    } else {
      fitCamera({ x: L.board.x, y: L.board.y, w: L.board.S, h: L.board.S }, L, L.land ? 54 : 52, 28, 0);
      boardState(state, L);
    }
    v3.unit = Math.abs(toVirt(0.5, ST, 0).x - toVirt(-0.5, ST, 0).x) || 50;
  }

  function present(state, L, dt) {
    const flick = state.calm ? 0 : 1 + Math.sin(clock * 2.1) * 0.025 + Math.sin(clock * 5.3) * 0.012;
    key.intensity = 2.9 * flick;
    key.position.set(-10, 3.7, 4); key.target.position.set(0, 0, 0);
    sunGlow.material.opacity = 0.9; sunGlow.quaternion.copy(camera.quaternion);
    stepParts(dt); drawFurrows(); syncEnv();
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p.r, p.rad, p.kind);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0; const pr = v3.pressed;
    for (const b of v3.buttons) {
      const pressed = !!pr && pr.x >= b.r.x && pr.x <= b.r.x + b.r.w && pr.y >= b.r.y && pr.y <= b.r.y + b.r.h;
      placeButton(n++, b, pressed);
    }
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, -1000);
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud, hudCam);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    // B.createEnvironment rebuilds scene.environment itself; the board textures and sprites are CanvasTextures and re-upload.
    W = 0; resize(); v3.on = true;
  });

  try {
    envHandle = B.createEnvironment(renderer, scene, { intensity: 0.22 });
    applyTier(); ensureBoard(5, false, 'sand'); syncEnv(); buildSprites();
  } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  void envHandle;
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
          const L = layoutFor(view?.width ?? 720, view?.height ?? 1560, state.flip, nOf(state.game.variant));
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
