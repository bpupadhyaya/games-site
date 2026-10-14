// Menko 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: a lit verandah at dusk with the wooden play tray, thick printed card discs, a child's hand that slams them, the air-pressure
// flips, dust and floor shake; plus a screen-space HUD scene (carved plaques, lacquered buttons) drawn in the same frame.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws the flat 2D art; context restored -> back to 3D, no reload.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { layoutOf, aimVisible } from '../src/view.js';
import { R as DR_UNITS, COVER, FLOOR, DESIGNS, scatterRadius } from '../src/sim.js';
import {
  U, HALF, DR, TH, cv, canvasTex, blobCanvas, ringCanvas, dashCanvas, solidRing, makeDisc, setDiscFace, buildTray, buildRoom,
} from './models.js';
import { createSceneExtras } from './extras.js';

const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, q: 1, kids: 'medium' },
  { name: 'medium', dpr: 1.5, shadow: 1024, q: 0.8, kids: 'low' },
  { name: 'low', dpr: 1, shadow: 0, q: 0.5, kids: null },
];
const wx = (fx) => (fx - FLOOR / 2) * U, wz = (fy) => (fy - FLOOR / 2) * U;

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
  renderer.setClearColor(0x120a14, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  await tick();
  // ---------------------------------------------------------------- scene, room, lights
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 220);
  const room = buildRoom({ quality: TIERS[tier].q });
  scene.add(room.group);
  const rig = B.lightingRig(scene, 'warmIndoor', {
    renderer, shadow: TIERS[tier].shadow || 0, extent: 6.2, fog: { near: 26, far: 80 }, target: [0, 0, 0],
    overrides: { bg: 0x120a14, fog: 0x1a1020, keyPos: [-5.5, 9.5, 6], keyI: 2.1, hemi: 0.42, fillI: 0.4, rimI: 1.7, rimPos: [6, 5, -7], exposure: 0.95, env: 0.35 },
  });
  const key = rig.key, keyBase = rig.config.keyI;

  const hud = new THREE.Scene();
  const hudCam = new THREE.PerspectiveCamera();
  const hudLight = new THREE.DirectionalLight(0xffe9c8, 1.7); hudLight.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0xaec4ff, 0.45); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe6c8, 0x1a1208, 0.4), hudLight, hudFill);
  const env = B.createEnvironment(renderer, scene, { intensity: 0.45 });
  const syncHudEnv = () => { hud.environment = scene.environment; hud.environmentIntensity = 0.32; };
  syncHudEnv();
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  await tick();
  // ---------------------------------------------------------------- tray + discs + effect pools
  const worldRoot = new THREE.Group(); scene.add(worldRoot);          // shaken on a slam
  let tray = null, trayQ = '';
  function ensureTray() {
    const k = `${TIERS[tier].q}`;
    if (tray && trayQ === k) return;
    if (tray) { worldRoot.remove(tray); tray.userData.dispose(); }
    tray = buildTray(TIERS[tier].q); worldRoot.add(tray); trayQ = k;
  }
  const discRoot = new THREE.Group(); worldRoot.add(discRoot);
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobTex = canvasTex(blobCanvas('0,0,0', 0.8));
  const softTex = canvasTex(blobCanvas('255,255,255', 0.95));
  const ringTex = canvasTex(ringCanvas('255,255,255', 128, 0.72));
  const sparkTex = (() => { const c = cv(64), x = c.getContext('2d'); x.translate(32, 32); const g = x.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,240,200,0.7)'); g.addColorStop(1, 'rgba(255,220,150,0)'); x.fillStyle = g; x.fillRect(-32, -32, 64, 64); x.fillStyle = '#fff'; x.fillRect(-1.5, -30, 3, 60); x.fillRect(-30, -1.5, 60, 3); return canvasTex(c); })();
  const dashRed = canvasTex(dashCanvas('255,96,70', 26, 256, 0.6, 0.034)), dashGreen = canvasTex(dashCanvas('110,255,170', 20, 256, 0.35, 0.04));
  const ringWhite = canvasTex(solidRing('255,255,255')), ringGold = canvasTex(solidRing('255,214,110', 256, 0.04));

  let frameNo = 0;
  const mkShadow = () => { const s = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.7, fog: false })); s.renderOrder = 1; return s; };
  const newDisc = (d, s) => { const g = new THREE.Group(), m = makeDisc(d, s), sh = mkShadow(); sh.position.y = 0.006; g.add(sh, m); g.userData = { m, sh }; discRoot.add(g); g.visible = false; return g; };
  const live = new Map();                         // key -> { g, used }
  function disc(key_, d, s) {
    let e = live.get(key_);
    if (!e) { e = { g: newDisc(d, s), used: 0 }; live.set(key_, e); }
    else setDiscFace(e.g.userData.m, d, s);
    e.used = frameNo; e.g.visible = true;
    return e.g;
  }
  // place a disc: floor units x,y; lift in world units; tilt (pitch about X, roll about Z), yaw; flip angle about a horizontal axis.
  // The card turns about its own centre (TH/2 above its bottom), so the group is offset to keep that centre where it should be.
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _ax = new THREE.Vector3(), _c = new THREE.Vector3(), _e = new THREE.Euler();
  function orient(m, lift, tx, tz, yaw, flip, axis) {
    _e.set(tx || 0, yaw || 0, tz || 0, 'YXZ'); _q.setFromEuler(_e);
    if (flip) { _ax.set(Math.cos(axis || 0), 0, Math.sin(axis || 0)); _q2.setFromAxisAngle(_ax, flip); _q.premultiply(_q2); }
    m.quaternion.copy(_q);
    _c.set(0, TH / 2, 0).applyQuaternion(_q);
    // keep the lowest point of a tilted card on (or above) the floor
    const rise = Math.abs(Math.sin(tx || 0)) * DR * 0.9 + Math.abs(Math.sin(tz || 0)) * DR * 0.9 + (flip ? Math.abs(Math.sin(flip)) * DR * 0.9 : 0);
    m.position.y = lift + TH / 2 - _c.y + rise;
  }
  function put(g, x, y, o = {}) {
    const lift = o.lift || 0, sc = o.scale ?? 1;
    g.position.set(wx(x), 0, wz(y));
    const m = g.userData.m, sh = g.userData.sh;
    orient(m, lift, o.tx, o.tz, o.yaw, o.flip, o.axis); m.scale.setScalar(sc);
    sh.visible = true;
    const h = m.position.y + (o.shadowLift || 0);
    sh.scale.setScalar(DR * 2.7 * sc * (1 + h * 0.3)); sh.material.opacity = (o.shadow ?? 0.7) * clamp(1 - h * 0.4, 0.15, 1);
    sh.position.set(h * 0.28, 0.006, h * 0.2);
  }

  // effect pools -----------------------------------------------------------------------------------
  const fxRoot = new THREE.Group(); worldRoot.add(fxRoot);
  const mkPool = (n, make) => { const a = []; for (let i = 0; i < n; i++) { const m = make(); m.visible = false; fxRoot.add(m); a.push(m); } return { a, n: 0 }; };
  const poolRing = mkPool(18, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; return m; });
  const poolDust = mkPool(90, () => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 4; return m; });
  const poolSpark = mkPool(40, () => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 5; return m; });
  const poolStreak = mkPool(40, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: softTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; return m; });
  const poolMark = mkPool(40, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; return m; });
  const take = (p) => { const m = p.a[p.n % p.a.length]; p.n++; m.visible = true; return m; };
  const resetPools = () => { for (const p of [poolRing, poolDust, poolSpark, poolStreak, poolMark]) { p.n = 0; for (const m of p.a) m.visible = false; } };
  const colOf = (s) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s || ''); return m ? (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]) : 0xffffff; };
  function mark(x, y, tex, color, op, radiusUnits, yy = 0.012) {
    const m = take(poolMark); m.material.map = tex; m.material.color.set(color); m.material.opacity = op; m.position.set(wx(x), yy, wz(y)); m.scale.set(radiusUnits * U * 2 / 0.92, 1, radiusUnits * U * 2 / 0.92);
  }
  // 3D-only dust: a puff of fine card-dust kicked up where a disc lands (clock-driven, visual only)
  const puffs = [];
  function addPuff(x, y, n, spd, up = 0.5, size = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + hash(i + x) * 1.2, s = spd * (0.5 + hash(i * 3 + y));
      puffs.push({ x: wx(x), y: 0.05, z: wz(y), vx: Math.cos(a) * s, vy: up * (0.4 + hash(i * 7 + x)), vz: Math.sin(a) * s, t: 0, max: 0.7 + hash(i * 5) * 0.6, size: size * (0.7 + hash(i * 11 + y) * 0.8) });
    }
    if (puffs.length > 70) puffs.splice(0, puffs.length - 70);
  }
  function stepPuffs(dt) {
    for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 0.92; p.vz *= 0.92; p.vy *= 0.94; if (p.t >= p.max) puffs.splice(i, 1); }
    for (const p of puffs) {
      const k = p.t / p.max, s = take(poolDust);
      s.position.set(p.x, p.y, p.z); const sc = p.size * (0.5 + k * 1.5); s.scale.set(sc, sc, 1);
      s.material.color.set(0xfff0d0); s.material.opacity = 0.34 * (1 - k) * (1 - k);
    }
  }

  await tick();
  // ---------------------------------------------------------------- HUD plaques and lacquered buttons
  const hudPanels = [], hudButtons = [];
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 150) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const woodHud = B.material('darkWood', { color: '#4a2a14', color2: '#7a4a24', repeat: [3, 3], seed: 9 });
  const brassHud = B.material('brass', { envIntensity: 1.4 });
  const std = (c, r = 0.8, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0.04, ...o });
  const inks = {
    paper: std('#f3e8cb', 0.92, { emissive: '#6a5530', emissiveIntensity: 0.45 }), dark: std('#12183a', 0.85), plate: std('#161d44', 0.8),
    plateOn: std('#f6edd2', 0.9, { emissive: '#7a6232', emissiveIntensity: 0.5 }), felt: std('#0c1330', 0.95), chip: std('#232c5a', 0.82),
    chipOn: std('#4a4026', 0.75, { emissive: '#4a3a10', emissiveIntensity: 0.6 }), toast: std('#0a0e26', 0.9),
  };
  const trims = { vermilion: std('#d9432a', 0.4, { metalness: 0.2 }), indigo: std('#3d78d8', 0.4, { metalness: 0.2 }), gold: brassHud };
  const lacq = (c, em, op = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, metalness: 0.04, clearcoat: 0.7, clearcoatRoughness: 0.18, envMapIntensity: 0.4, emissive: em, emissiveIntensity: 0.55, ...op });
  const btnMats = {
    primary: lacq('#e0432c', '#6a1608'), active: lacq('#1d8aa8', '#073a48'), dark: lacq('#242d5e', '#0a1030'), plain: lacq('#f1e5c3', '#4a3a18', { roughness: 0.55 }),
    disabled: lacq('#bdbcc6', '#202030', { emissiveIntensity: 0.1 }),
  };
  const btnRim = { primary: std('#7a1d12', 0.5), active: std('#0e4c60', 0.5), dark: std('#10163a', 0.5), plain: std('#8a7442', 0.5), disabled: std('#74737f', 0.6) };
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x05030a, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  const ROT = Math.PI / 2;
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) {
      const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, woodHud), trim = new THREE.Mesh(flatQuad, brassHud), inner = new THREE.Mesh(flatQuad, inks.dark);
      g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p);
    }
    return p;
  }
  function placePanel(i, pn) {
    const r = pn.r, rad = pn.rad, kind = pn.kind, p = panelAt(i); p.g.visible = true;
    const cx0 = r.x + r.w / 2, cy0 = -(r.y + r.h / 2), z = -700, small = kind === 'chip' || kind === 'chipOn' || kind === 'toast';
    const dep = small ? 8 : 14, ins = small ? 5 : kind === 'felt' ? 7 : 8;
    p.outer.geometry = slabG(r.w, r.h, dep, rad, small ? 3 : 5); p.outer.rotation.x = ROT; p.outer.position.set(cx0, cy0, z);
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(3, rad - ins * 0.5), 1.4); p.trim.rotation.x = ROT; p.trim.position.set(cx0, cy0, z);
    p.inner.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.5, Math.max(2, rad - ins), 2); p.inner.rotation.x = ROT; p.inner.position.set(cx0, cy0, z);
    p.inner.material = inks[kind] || inks.dark;
    p.trim.material = kind === 'plateOn' ? (pn.team === 1 ? trims.indigo : trims.vermilion) : kind === 'chipOn' ? trims.gold : brassHud;
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(flatQuad, btnMats.dark), rim = new THREE.Mesh(flatQuad, btnRim.dark); g.add(rim, body); hud.add(g); b = { g, body, rim }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx0 = r.x + r.w / 2, cy0 = -(r.y + r.h / 2), rad = Math.min(20, r.h / 3), z = -400, dep = bt.pressed ? 7 : 17;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx0, cy0, z); b.rim.material = btnRim[bt.kind] || btnRim.dark;
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, rad - 2, 6); b.body.rotation.x = ROT; b.body.position.set(cx0, cy0, z); b.body.material = btnMats[bt.kind] || btnMats.dark;
    b.g.position.set(0, bt.pressed ? -3 : 0, 0);
  }

  await tick();
  // ---------------------------------------------------------------- camera fitting, projection, picking
  let W = 1, H = 1, dprNow = 1, L_ = null, hudW = 0, hudH = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  function fitCamera(rect, L, pitchDeg, fov, yawDeg = 0, lookY = 0.1) {
    const k = W / L.w, targetW = rect.w * k, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180;
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
    const c = tmpV.set(0, 0.05, 0).project(camera);
    const px0 = ((c.x + 1) / 2) * W, py0 = ((1 - c.y) / 2) * H, cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + (rect.h ?? rect.w) / 2) * k;
    camera.setViewOffset(W, H, px0 - cxp, py0 - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => { tmpV.set(x, y, z); tmpV.project(camera); return { x: ((tmpV.x + 1) / 2) * L_.w, y: ((1 - tmpV.y) / 2) * L_.h }; };
  v3.proj = (fx, fy, h = 0) => (L_ ? toVirt(wx(fx), h, wz(fy)) : { x: 0, y: 0 });
  v3.scale = (fx, fy) => { const a = v3.proj(fx, fy), b = v3.proj(fx + 100, fy); return Math.abs(b.x - a.x) / 100 || 0.5; };
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3();
  function planeHit(vx, vy, y) {
    const ndcx = (vx / L_.w) * 2 - 1, ndcy = 1 - (vy / L_.h) * 2;
    orig.copy(camera.position); ray.set(ndcx, ndcy, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return null;
    const t = (y - orig.y) / ray.y; if (t < 0) return null;
    hitV.copy(orig).addScaledVector(ray, t); return hitV;
  }
  v3.toFloor = (vx, vy) => { if (!L_) return null; const h = planeHit(vx, vy, TH); if (!h) return null; return { x: h.x / U + FLOOR / 2, y: h.z / U + FLOOR / 2 }; };
  const toHud = (vx, vy) => { const h = planeHit(vx, vy, 1.4); return h ? h.clone() : null; };

  await tick();
  // ---------------------------------------------------------------- lit disc sprites for the 2D layer (chips, score cards, collection)
  const sprCache = new Map();
  function buildSprites() {
    const SP = 192, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(16, 1, 0.5, 40);
    const l1 = new THREE.DirectionalLight(0xfff0d8, 3.2); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0xaec4ff, 0.9); l2.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xffe8cc, 0x4a3a2a, 1.2), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.6;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = false;
    const sh = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.55, depthWrite: false })); sh.scale.setScalar(DR * 2.5); sh.position.set(0.05, -0.03, 0.05); sc.add(sh);
    const pitch = (46 * Math.PI) / 180, dist = 6.0;
    for (let d = 0; d < DESIGNS.length; d++) for (let s = 0; s < 2; s++) {
      const m = makeDisc(d, s); sc.add(m);
      cam.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist); cam.lookAt(0, TH * 0.5, 0); cam.updateMatrixWorld();
      cam.fov = (2 * Math.atan(DR / 0.4 / dist) * 180) / Math.PI; cam.updateProjectionMatrix();
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sprCache.set(d * 2 + s, c); sc.remove(m);
    }
    renderer.setClearColor(0x120a14, 1); renderer.setPixelRatio(pr); renderer.setSize(szw, szh, false);
    renderer.shadowMap.enabled = TIERS[tier].shadow > 0;
    W = 0;
  }
  v3.sprites = (d, s) => sprCache.get(d * 2 + (s ? 1 : 0)) || null;

  await tick();
  // ---------------------------------------------------------------- extras: the kids on the veranda, the hand
  const extras = await createSceneExtras({ THREE, renderer, scene, camera, worldRoot, tier: () => TIERS[tier], U });

  await tick();
  // ---------------------------------------------------------------- frame state
  let lastT = 0, clock = 0, frames = 0, ema = 16;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0; trayQ = '';
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    if (extras.setQuality) extras.setQuality(t.kids);
  }

  const cs = new Map();                          // per-card seeds (phase of the rattle)
  const stateOf = (id) => { let s = cs.get(id); if (!s) { s = { ph: hash(id) * 6.28 }; cs.set(id, s); } return s; };
  const seenAct = new WeakMap();                 // act -> { impact, lands }
  let shakeT = -9, shakeAmp = 0, impactAt = null, impactTime = -9;

  // where does the score card of `side` sit in the world (a point above the tray the discs fly to)?
  function cardTarget(L, side) {
    const r = L && L.cards && L.cards[side]; if (!r) return { x: 0, y: 1.6, z: HALF + 3 };
    const h = toHud(r.x + r.w / 2, r.y + r.h / 2); return h ? { x: h.x, y: 1.5, z: h.z } : { x: 0, y: 1.6, z: HALF + 3 };
  }

  function drawCards(floor, inPlay) {
    const rattle = clock - impactTime;
    for (const c of floor.cards) {
      const g = disc(`c${c.id}`, c.d, c.side), st = stateOf(c.id);
      let lift = 0, tx = 0, tz = 0;
      if (c.pop > 0) { const k = 1 - c.pop / 0.3; lift = Math.sin(k * Math.PI) * 0.2; tx = Math.sin(k * 14) * 0.1 * (1 - k); tz = Math.cos(k * 11) * 0.08 * (1 - k); }
      // a nearby slam rattles the cards on the floor (air pressure + the thump)
      if (inPlay && impactAt && rattle >= 0 && rattle < 0.9) {
        const dd = Math.hypot(c.x - impactAt.x, c.y - impactAt.y) * U, a = Math.exp(-dd / 1.8) * Math.exp(-rattle * 5);
        lift += Math.abs(Math.sin(rattle * 40 + st.ph)) * 0.05 * a; tx += Math.sin(rattle * 36 + st.ph) * 0.07 * a; tz += Math.cos(rattle * 31 + st.ph) * 0.07 * a;
      }
      put(g, c.x, c.y, { lift, tx, tz, yaw: c.spin || 0 });
    }
  }

  let holder = null, extrasWarned = false;
  function drawAct(state, L) {
    const a = state.act; if (!a) return;
    let sn = seenAct.get(a); if (!sn) { sn = { impact: false, lands: new Set() }; seenAct.set(a, sn); }
    const side = a.side, dirZ = side === 0 ? 1 : -1;       // the hand comes in from the player's edge of the tray
    if (a.phase === 'fly' && a.out === null) {
      // wind-up (the hand lifts and tilts back), then the slam: accelerate down onto the aim point with the leading edge first
      const k = clamp(a.t / a.flyDur, 0, 1), w = clamp(k / 0.22, 0, 1), f = clamp((k - 0.22) / 0.78, 0, 1), e = Math.pow(f, 1.7);
      const sx = a.to.x, sy = a.to.y + dirZ * 70;
      const hgt = k < 0.22 ? 1.9 + 0.8 * Math.sin(w * Math.PI / 2) : 2.7 * (1 - e) + 0.012;
      const fx = sx + (a.to.x - sx) * e, fy = sy + (a.to.y - sy) * e;
      const g = disc('fly', a.d, side);
      put(g, fx, fy, { lift: hgt, tx: dirZ * (k < 0.22 ? 0.18 * w : -0.34 * (1 - e)), yaw: a.spin });
      holder = { x: fx, y: fy, h: hgt + TH, side, held: true };
    }
    if (!a.out) return;
    const land = a.out.land || a.out.card;
    if (!sn.impact) {
      sn.impact = true; impactAt = { x: land.x, y: land.y }; impactTime = clock;
      if (a.out.kind === 'lay') { shakeT = clock; shakeAmp = 0.02; addPuff(land.x, land.y, 7, 0.8, 0.4, 0.4); }
      else { shakeT = clock; shakeAmp = 0.05 + 0.07 * (a.power || 0.5); addPuff(land.x, land.y, 16, 1.5 + 1.2 * (a.power || 0.5), 0.9, 0.55); }
    }
    if (a.out.kind === 'slam' && a.out.cover) {
      const k = a.t - a.impactAt, tgt = cardTarget(L, 1 - a.side), out = clamp((k - 0.9) / 0.6, 0, 1), e = ease(out);
      const g = disc('cover', a.d, side);
      const cx = wx(a.out.land.x), cz = wz(a.out.land.y);
      g.position.set(cx + (tgt.x - cx) * e, 0, cz + (tgt.z - cz) * e);
      const m = g.userData.m, topY = TH * 1.0 + 0.04;               // lands on top of the rival card
      orient(m, topY + (tgt.y - topY) * e + Math.sin(out * Math.PI) * 0.5 + (k < 0.25 ? Math.sin((k / 0.25) * Math.PI) * 0.12 : 0), 0, 0, a.spin, 0, 0);
      m.scale.setScalar(1 - out * 0.5);
      g.userData.sh.visible = out < 0.3; g.userData.sh.scale.setScalar(DR * 2.7); g.userData.sh.position.set(0, 0.006, 0);
    }
    for (const f of a.out.flips || []) {
      const k = a.t - a.impactAt - f.delay;
      const g = disc(`f${f.card.id}`, f.card.d, f.card.side);
      const dx = f.card.x - a.out.land.x, dy = f.card.y - a.out.land.y, dl = Math.hypot(dx, dy) || 1;
      const axis = Math.atan2(dx / dl, dy / dl) + Math.PI / 2;           // flip about the axis perpendicular to the gust
      if (k < 0) {
        const pre = clamp((k + 0.2) / 0.2, 0, 1), tilt = Math.sin(pre * Math.PI * 0.5) * 0.3;   // the near edge starts to lift in the air
        put(g, f.card.x, f.card.y, { yaw: f.card.spin, flip: tilt, axis });
        continue;
      }
      const flipT = clamp(k / 0.78, 0, 1), fly = clamp((k - 1.0) / 0.6, 0, 1);
      const ang = Math.PI * (0.3 + 0.7 * ease(flipT));
      const lift = Math.sin(flipT * Math.PI) * 0.95;
      let rockTx = 0;
      if (k > 0.78 && k < 1.1) { const tt = k - 0.78; rockTx = Math.sin(tt * 38) * 0.14 * Math.exp(-tt * 9); }
      if (k > 0.76 && !sn.lands.has(f.card.id)) { sn.lands.add(f.card.id); addPuff(f.card.x, f.card.y, 7, 0.9, 0.5, 0.4); }
      const drift = ease(flipT) * 0.24;
      const bx = f.card.x + (dx / dl) * drift * 100, by = f.card.y + (dy / dl) * drift * 100;
      if (fly > 0) {
        const tgt = cardTarget(L, a.side), e = ease(fly), sx0 = wx(bx), sz0 = wz(by);
        g.position.set(sx0 + (tgt.x - sx0) * e, 0, sz0 + (tgt.z - sz0) * e);
        const m = g.userData.m;
        orient(m, 0.02 + (tgt.y - 0.02) * e + Math.sin(fly * Math.PI) * 0.4, 0, 0, f.card.spin, Math.PI, 0); m.scale.setScalar(1 - fly * 0.5);
        g.userData.sh.visible = fly < 0.4; g.userData.sh.position.set(0, 0.006, 0);
      } else put(g, bx, by, { yaw: f.card.spin, flip: ang, axis, lift, tx: rockTx });
    }
  }

  // aim markers (rings on the floor): the same conditions the 2D layer used for its overlay
  function drawAim(state) {
    if (!aimVisible(state)) return;
    const m = state.m, side = m.turn, hand = m.hands[side], d = hand[state.aim.hi]; if (d === undefined) return;
    const a = state.aim, pulse = 0.5 + 0.5 * Math.sin(clock * 5);
    if (state.kind === 'slam') {
      for (const c of m.floor.cards) if (c.side !== side) mark(c.x, c.y, dashRed, 0xff6a4a, 0.85, COVER * DR_UNITS, 0.02);
      if (state.hint && state.hint.kind === 'slam') mark(state.hint.x, state.hint.y, dashGreen, 0x6dffa8, 0.95, scatterRadius(state.hint.power, DESIGNS[state.hint.d].w), 0.021);
      const s = state.preview ? state.preview.s : scatterRadius(a.power, DESIGNS[d].w);
      mark(a.x, a.y, ringWhite, 0xffffff, 0.8 + pulse * 0.15, s, 0.022);
      mark(a.x, a.y, softTex, 0xffe9b0, 0.12, s, 0.019);
      mark(a.x, a.y, ringGold, 0xffd46a, 0.9, DR_UNITS * 0.78, 0.024);
    } else {
      mark(a.x, a.y, state.layBad ? ringWhite : ringGold, state.layBad ? 0xff7a5a : 0xffd46a, 0.95, DR_UNITS * 1.02, 0.024);
      mark(a.x, a.y, softTex, state.layBad ? 0xff6a4a : 0xffe9b0, 0.18, DR_UNITS * 1.3, 0.02);
    }
  }

  // the game's particles (floor units): rings of gust, streaks of air, dust motes, sparkles
  function drawParts(parts) {
    for (const q of parts) {
      const k = 1 - q.t / q.max; if (k <= 0) continue;
      if (q.kind === 1) {
        const e = 1 - k, m = take(poolRing), s = q.size * (0.15 + 0.85 * (1 - Math.pow(1 - e, 2)));
        m.material.color.set(colOf(q.col)); m.material.opacity = k * 0.8; m.position.set(wx(q.x), 0.03 + e * 0.1, wz(q.y)); m.scale.set(s * U * 2, 1, s * U * 2);
      } else if (q.kind === 2) {
        const m = take(poolStreak), len = (14 + 14 * k) * U * 2, ang = Math.atan2(q.vy, q.vx);
        m.material.opacity = k * 0.7; m.position.set(wx(q.x), 0.08 + (1 - k) * 0.1, wz(q.y)); m.rotation.set(0, -ang, 0); m.scale.set(len, 1, 0.045);
      } else if (q.kind === 0) {
        const s = take(poolDust), sz = q.size * U * 3 * (0.5 + 0.5 * k);
        s.position.set(wx(q.x), 0.1 + (1 - k) * 0.35, wz(q.y)); s.scale.set(sz, sz, 1); s.material.color.set(0xf4e2bc); s.material.opacity = 0.7 * k;
      } else if (q.kind === 3) {
        const s = take(poolSpark), sz = q.size * U * 4.5 * (0.4 + 0.6 * k);
        s.position.set(wx(q.x), 0.3 + (1 - k) * 0.5, wz(q.y)); s.scale.set(sz, sz, 1); s.material.color.set(colOf(q.col)); s.material.opacity = k; s.material.rotation = q.t * 5;
      }
    }
  }

  await tick();
  // ---------------------------------------------------------------- scenes
  const worldFor = (state) => (((state.scene === 'play' || state.scene === 'result') && state.m) ? state.m.floor : state.att ? state.att.floor : { cards: [] });
  function prepare(state, L) {
    resize(); L_ = L;
    if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const sc = state.scene; v3.scene = sc;
    ensureTray();
    const drift = Math.sin(clock * 0.17) * 3.5, land = L.w > L.h;
    let view = 'menu';
    if (sc === 'play' && state.m) {
      const pl = layoutOf(state), F = pl.floor;
      fitCamera({ x: F.x, y: F.y, w: F.size, h: F.size }, L, pl.land ? 50 : 52, 28, 0); view = 'play';
    } else if (sc === 'result' && state.m) {
      const size = Math.min(L.w, L.h) * 0.86, cy = land ? L.h / 2 : L.h * 0.62;
      fitCamera({ x: (L.w - size) / 2, y: cy - size / 2, w: size, h: size }, L, 44, 30, drift); view = 'result';
    } else if (sc === 'title') {
      const cw = clamp(Math.round(L.w * 0.36), 420, 560), xcol = L.w - 28 - cw;
      if (land) { const s = Math.min(xcol - 30, L.h * 0.86), hx = xcol / 2; fitCamera({ x: hx - s / 2, y: L.h * 0.56 - s / 2, w: s, h: s }, L, 42, 30, drift); }
      else { const s = L.w * 1.0; fitCamera({ x: (L.w - s) / 2, y: L.h * 0.6 - s / 2, w: s, h: s }, L, 40, 30, drift); }
      view = 'title';
    } else {
      const s = Math.min(L.w, L.h) * (land ? 0.95 : 1.05);
      fitCamera({ x: (L.w - s) / 2, y: L.h * 0.55 - s / 2, w: s, h: s }, L, 44, 30, drift);
    }
    v3.view = view;
  }

  await tick();
  // ----- phase 2: after the 2D UI recorded its panels and buttons
  function present(state, L, dt) {
    frameNo++;
    const fl = room.update(clock, state.calm, dt);
    key.intensity = keyBase * (1 + fl * 1.4);
    resetPools();
    const floor = worldFor(state), play = state.scene === 'play' && !!state.m;
    drawCards(floor, play || state.scene === 'result');
    holder = null;
    if (play) {
      drawAct(state, L); drawAim(state); drawParts(state.parts);
      const m = state.m;
      if (!state.act && !m.over && (aimVisible(state) || (state.think && state.think.phase === 'aim'))) {
        // the hand holds the disc it is about to slam, a little behind the aim point on the player's edge
        const hi = state.aim.hi, d = m.hands[m.turn][hi];
        if (d !== undefined) { const g = disc('held', d, m.turn), dir = m.turn === 0 ? 1 : -1; put(g, state.aim.x, state.aim.y + dir * 70, { lift: 1.9 + Math.sin(clock * 2.2) * 0.04, tx: dir * 0.1, yaw: clock * 0.3 }); }
      }
    }
    else if (state.att) drawParts(state.att.parts);
    try { extras.frame({ state, dt, clock, play, floor, camera, holder, aim: play && aimVisible(state), view: v3.view }); } catch (e) { if (!extrasWarned) { extrasWarned = true; console.warn('3D extras failed', e && e.stack); } }
    for (const e of live.values()) if (e.used !== frameNo) e.g.visible = false;
    stepPuffs(dt);
    // floor shake on a slam
    const st = clock - shakeT;
    if (st >= 0 && st < 0.5) { const a = shakeAmp * Math.exp(-st * 9); worldRoot.position.set(Math.sin(st * 70) * a * 0.6, Math.abs(Math.sin(st * 55)) * a * 0.5, Math.cos(st * 61) * a * 0.4); } else worldRoot.position.set(0, 0, 0);
    // HUD
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0;
    for (const b of v3.buttons) placeButton(n++, b);
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, -900);
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud, hudCam);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { syncHudEnv(); W = 0; trayQ = ''; resize(); v3.on = true; });

  try {
    applyTier(); ensureTray(); buildSprites();
  } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; v3.sprites = null; return noop; }
  await tick();
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* first frame compiles instead */ }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, env, extras,
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
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
          const simDt = state.paused && state.scene === 'play' ? 0 : dt; clock += simDt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.scrim = 0;
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e && e.stack); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, L, simDt); } catch (e) { console.warn('3D present failed', e && e.stack); v3.on = false; }
        },
      });
    },
  };
}
