// Hashi 3D presenter. It READS the game state (game.getState()) and the board snapshot that view.js records in v3.frame; it never
// writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a dusk garden pond with mossy stone islands, plank
// bridges with rope rails, koi, mist and lanterns. The 2D layer draws only the carved numerals, plaques and buttons on top.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3, DECK_Y } from '../src/v3.js';
import { theme } from '../src/ui.js';
import { islandStatus, remAll } from '../src/hashi.js';
import {
  TAU, clamp, ease, rng, hash, LOOKS3D, waterNormal, softCanvas, skyTexture, ridgeTexture, makeParts, makePlankGeo, makePostGeo, makeRopeGeo,
  buildKoi, buildSurround, buildLilyPad,
} from './models.js';

const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, fx: 2 },
  { name: 'medium', dpr: 1.5, shadow: 1024, fx: 1 },
  { name: 'low', dpr: 1, shadow: 0, fx: 0 },
];
const MAXI = 130, MAXP = 4200, MAXR = 3000, MAXPOST = 900;

const tick = () => new Promise((r) => setTimeout(r, 0));   // yield so the flat title paints and stays interactive while the 3D scene builds
export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  await tick();
  // ---------------------------------------------------------------- scene, light, sky
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 700);
  const rig = B.lightingRig(scene, 'duskOutdoor', { renderer, shadow: TIERS[tier].shadow, extent: 12, fog: { near: 30, far: 140 }, overrides: { bg: 0x9ccad2, fog: 0x9ccad2 } });
  rig.key.shadow.camera.far = 80;
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), skyMat); sky.renderOrder = -10; scene.add(sky);
  const ridges = [-140, -180, -230].map((z, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(560, 60 + i * 14), new THREE.MeshBasicMaterial({ transparent: true, fog: false, depthWrite: false }));
    m.position.set(0, 14 + i * 4, z); m.renderOrder = -9 + i; scene.add(m); return m;
  });
  const glowTex = softCanvas('255,255,255', 0.95), ringTex = softCanvas('255,255,255', 0.95, true), haloTex = softCanvas('255,236,200', 0.9, false, 256);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.9 }));
  sun.position.set(-80, 24, -260); sun.scale.setScalar(170); sun.renderOrder = -8; scene.add(sun);
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);

  // image-based light from our own sky (so water and lacquer reflect the garden, not a room)
  function buildEnv() {
    try {
      const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
      es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), new THREE.MeshBasicMaterial({ map: skyMat.map, side: THREE.BackSide })));
      if (scene.environment && scene.environment.dispose) { try { scene.environment.dispose(); } catch { /* context lost */ } }
      scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
    } catch (e) { /* keep going without IBL */ }
  }

  await tick();
  // ---------------------------------------------------------------- water
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x1f98a6, roughness: 0.07, metalness: 0.0, transparent: true, opacity: 0.8, normalMap: waterNormal(), normalScale: new THREE.Vector2(0.28, 0.28), clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 1.6 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), waterMat); water.rotation.x = -Math.PI / 2; water.renderOrder = 1; water.receiveShadow = true; scene.add(water);

  await tick();
  // ---------------------------------------------------------------- state
  let look = 'lagoon', looks = LOOKS3D.lagoon, surround = null, surH = 0, surLook = '', H = 4.5;
  const parts = makeParts(LOOKS3D.lagoon);
  const stone = B.material('stone', { color: '#6a6f63', color2: '#a8a496', seed: 12 });
  const mossM = new THREE.MeshStandardMaterial({ roughness: 0.95, color: 0x6aa856 });
  const plaqueM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.0 });
  const rimM = B.material('brass', { color: '#b88a3a', color2: '#e8c070' });
  const trunkM = B.material('darkWood', { color: '#4a3020' });
  const pineM = new THREE.MeshStandardMaterial({ color: 0x2f6a3a, roughness: 0.85 });
  const canopyM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const lanternStone = B.material('stone', { color: '#8a8a82', color2: '#b6b2a6', seed: 4 });
  const lanternGlowM = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  const mk = (geo, mat, n, cast = true) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
  const I = {
    rock: mk(parts.rock, stone, MAXI), moss: mk(parts.moss, mossM, MAXI, false), plaque: mk(parts.plaque, plaqueM, MAXI), rim: mk(parts.plaqueRim, rimM, MAXI, false),
    trunk: mk(parts.trunk, trunkM, MAXI), pine: mk(parts.pine, pineM, MAXI), canopy: mk(parts.canopy, canopyM, MAXI), rocks: mk(parts.rockSmall, stone, MAXI * 2),
    lstone: mk(parts.lanternBase, lanternStone, MAXI), lbox: mk(parts.lanternBox, lanternStone, MAXI), lroof: mk(parts.lanternRoof, lanternStone, MAXI), lglow: mk(new THREE.BoxGeometry(0.07, 0.06, 0.07), lanternGlowM, MAXI, false),
  };
  const plankMat = B.material('wood', { color: '#8e5a2a', color2: '#b98445', seed: 8 });
  const postMat = B.material('darkWood', { color: '#4a2a16' });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 0.9 });
  const planks = mk(makePlankGeo(), plankMat, MAXP), posts = mk(makePostGeo(), postMat, MAXPOST), ropes = mk(makeRopeGeo(), ropeMat, MAXR, false);
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x3fe0b8, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const ghost = mk(makePlankGeo(), ghostMat, 600, false);
  const white = new THREE.Color(1, 1, 1);

  // markers (rings / glows on the water), ripples, droplets
  const markRoot = new THREE.Group(); scene.add(markRoot);
  const markPool = []; let markN = 0;
  function markQuad(x, z, tex, color, op, sx, sz = sx, rot = 0, y = 0.03) {
    let m = markPool[markN];
    if (!m) { m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); m.renderOrder = 3; markRoot.add(m); markPool.push(m); }
    markN++; m.visible = true; m.material.map = tex; m.material.color.set(color); m.material.opacity = clamp(op, 0, 1);
    m.position.set(x, y, z); m.scale.set(sx, 1, sz); m.rotation.y = rot;
  }
  const ripples = [];
  const NP = 90, drops = [];
  const dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, fog: false }), NP);
  dropMesh.frustumCulled = false; scene.add(dropMesh);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _dir = new THREE.Vector3(), _x = new THREE.Vector3(1, 0, 0);
  const burst = (x, y, z, n, up = 1.6, spread = 0.9) => {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = (0.3 + Math.random()) * spread; drops.push({ x, y, z, vx: Math.cos(a) * sp, vy: up * (0.6 + Math.random() * 0.7), vz: Math.sin(a) * sp, life: 0, max: 0.55 + Math.random() * 0.3 }); }
    if (drops.length > NP) drops.splice(0, drops.length - NP);
  };
  const ripple = (x, z, size = 0.7, life = 0.8, op = 0.7) => { ripples.push({ x, z, size, life: 0, max: life, op }); if (ripples.length > 40) ripples.shift(); };

  // ambience: koi, lily pads, mist, petals, fireflies
  const koi = [];
  [['#ff7a2a', '#ffffff'], ['#f4f0e6', '#ff5a2a'], ['#ffb02a', '#e8e0d0'], ['#e8402a', '#222222']].forEach(([c, s], i) => { const k = buildKoi(c, s); k.position.y = -0.3; scene.add(k); koi.push({ g: k, ph: i * 1.7, sp: 0.16 + i * 0.03 }); });
  const lilies = new THREE.InstancedMesh(buildLilyPad(0.3), new THREE.MeshStandardMaterial({ color: 0x4f9a50, roughness: 0.7, side: THREE.DoubleSide }), 14); lilies.frustumCulled = false; scene.add(lilies);
  const mist = []; for (let i = 0; i < 9; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, fog: false })); sp.renderOrder = 5; scene.add(sp); mist.push(sp); }
  const NPET = 60, petals = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: glowTex, color: 0xffd0dc, size: 0.16, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true }));
  { const a = new Float32Array(NPET * 3), r = rng(5); for (let i = 0; i < NPET; i++) { a[i * 3] = (r() - 0.5) * 30; a[i * 3 + 1] = r() * 9; a[i * 3 + 2] = (r() - 0.5) * 26; } petals.geometry.setAttribute('position', new THREE.BufferAttribute(a, 3)); petals.userData.base = a.slice(); petals.frustumCulled = false; scene.add(petals); }
  const NFF = 40, flies = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: glowTex, color: 0xfff0a0, size: 0.2, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  { const a = new Float32Array(NFF * 3), r = rng(9); for (let i = 0; i < NFF; i++) { a[i * 3] = (r() - 0.5) * 24; a[i * 3 + 1] = 0.5 + r() * 2.6; a[i * 3 + 2] = (r() - 0.5) * 20; } flies.geometry.setAttribute('position', new THREE.BufferAttribute(a, 3)); flies.userData.base = a.slice(); flies.frustumCulled = false; scene.add(flies); }
  const buoys = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: glowTex, color: 0xffffff, size: 0.13, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  buoys.frustumCulled = false; buoys.position.y = 0.025; scene.add(buoys);

  await tick();
  // ---------------------------------------------------------------- looks
  function applyLook(name) {
    look = LOOKS3D[name] ? name : 'lagoon'; looks = LOOKS3D[look]; v3.look = look;
    const c = looks;
    rig.key.color.setHex(c.key); rig.key.intensity = c.keyI; rig.key.position.set(...c.keyPos);
    rig.fill.color.setHex(c.fill); rig.fill.intensity = c.fillI;
    rig.hemi.color.setHex(c.hemiSky); rig.hemi.groundColor.setHex(c.hemiGround); rig.hemi.intensity = c.hemi;
    rig.rim.color.setHex(c.key); rig.rim.intensity = 0.9; rig.rim.position.set(6, 6, -8);
    renderer.toneMappingExposure = c.exposure;
    scene.fog = new THREE.Fog(c.fog, c.fogNear, c.fogFar); renderer.setClearColor(c.fog, 1);
    scene.environmentIntensity = c.env;
    if (skyMat.map) skyMat.map.dispose();
    skyMat.map = skyTexture(c); skyMat.needsUpdate = true;
    ridges.forEach((m, i) => { if (m.material.map) m.material.map.dispose(); m.material.map = ridgeTexture(c.ridge[i], c.haze, 3 + i * 5, 0.5 - i * 0.08); m.material.needsUpdate = true; });
    sun.material.color.set(look === 'night' ? 0xcfe0ff : look === 'dusk' ? 0xffb07a : 0xfff0c0); sun.material.opacity = look === 'night' ? 0.55 : 0.9;
    waterMat.color.setHex(c.water);
    mossM.color.set(c.moss);
    canopyM.color.set(0xffffff);
    petals.material.color.set(c.petal); petals.visible = TIERS[tier].fx >= 1 && look !== 'night';
    flies.visible = c.firefly > 0 && TIERS[tier].fx >= 1;
    lanternGlowM.color.set(look === 'chart' ? 0xffe0a0 : 0xffc070);
    mist.forEach((m) => m.material.color.set(c.haze));
    buildEnv();
    setSurround(true);
  }
  function setSurround(force) {
    const h = Math.round(H * 100) / 100;
    if (!force && surround && surH === h && surLook === look) return;
    if (surround) { scene.remove(surround.root); surround.dispose(); }
    surround = buildSurround(h, looks); scene.add(surround.root); surH = h; surLook = look;
    const w = 2 * h + 0.4; water.scale.set(w, w, 1);
    const sc = rig.key.shadow.camera; sc.left = sc.bottom = -(h + 6); sc.right = sc.top = h + 6; sc.updateProjectionMatrix();
    const r = rng(77);
    for (let i = 0; i < 14; i++) { const side = i % 4, u = (r() - 0.5) * 2 * (h - 0.8), off = h - 0.35 - r() * 0.15; const x = side < 2 ? u : (side === 2 ? -off : off), z = side === 0 ? -off : side === 1 ? off : u; _p.set(x, 0.012, z); _q.setFromEuler(_e.set(0, r() * 6, 0)); _s.setScalar(0.7 + r() * 0.8); _m.compose(_p, _q, _s); lilies.setMatrixAt(i, _m); }
    lilies.instanceMatrix.needsUpdate = true;
    mist.forEach((m, i) => { const a = (i / mist.length) * TAU; m.position.set(Math.cos(a) * (h + 3.5), 0.5 + (i % 3) * 0.35, Math.sin(a) * (h + 3.5)); m.scale.set(9 + (i % 4) * 2, 3.2, 1); m.userData.a = a; });
  }

  await tick();
  // ---------------------------------------------------------------- camera fit (square sea box into a virtual rect) + projection
  let W = 1, Hh = 1, dprNow = 1, VW = 720, VH = 1280, clock = 0, lastT = 0, frames = 0, ema = 16;
  let board = { pw: 9, ph: 9 };
  const tmp = new THREE.Vector3();
  function fitCamera(rect, pitchDeg, fov, yawDeg = 0, fill = 1, hh = H, lookY = 0.1) {
    const k = W / VW, tw = rect.w * k * fill, th = rect.h * k * fill, p = (pitchDeg * Math.PI) / 180, yw = (yawDeg * Math.PI) / 180, E = hh + 0.55;
    const corners = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-0.05, 0.4]) corners.push(new THREE.Vector3(sx * E, y, sz * E));
    camera.fov = fov; camera.aspect = W / Hh; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const place = (d) => { camera.position.set(Math.sin(yw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yw) * Math.cos(p) * d); camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); };
    const extent = (d) => {
      place(d); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of corners) { tmp.copy(c).project(camera); const px = ((tmp.x + 1) / 2) * W, py = ((1 - tmp.y) / 2) * Hh; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
      return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    };
    let lo = 4, hi = 400;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2, e = extent(mid); if (e.w > tw || e.h > th) lo = mid; else hi = mid; }
    const e = extent(hi), cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W, Hh, e.cx - cxp, e.cy - cyp, W, Hh);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => { tmp.set(x, y, z).project(camera); return { x: ((tmp.x + 1) / 2) * VW, y: ((1 - tmp.y) / 2) * VH }; };
  v3.proj = (ix, iy, h = 0) => toVirt(ix + 0.5 - board.pw / 2, h, iy + 0.5 - board.ph / 2);
  v3.unit = () => Math.abs(toVirt(0.5, 0, 0).x - toVirt(-0.5, 0, 0).x);

  // geo: board geometry (virtual units) or null; kind: 'play' | 'over' | 'title' | 'ambient'
  v3.setBoard = (geo, kind = 'play', opts = {}) => {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    if (w !== W || h !== Hh) { W = w; Hh = h; renderer.setPixelRatio(dprNow); renderer.setSize(w, h, false); }
    const calm = !!opts.calm, land = VW > VH;
    if (geo) {
      board = { pw: geo.pw, ph: geo.ph }; H = Math.max(3, geo.size / (2 * geo.s));
      setSurround(false);
      v3.geo = geo;
      const drift = kind === 'title' && !calm ? Math.sin(clock * 0.2) * 5 : 0;
      const rect = opts.rect || geo.rect;
      // a taller rect (portrait play) raises the camera so the pond uses the free height; otherwise a classic three-quarter view
      let pitch = kind === 'title' ? (land ? 40 : 38) : (land ? 54 : 56);
      if (kind !== 'title' && rect.h > rect.w * 1.02) pitch = clamp((Math.asin(clamp(rect.h / rect.w * 0.9, 0.5, 1)) * 180) / Math.PI, 56, 68);
      fitCamera(rect, pitch, kind === 'title' ? 32 : 28, drift, kind === 'title' ? 0.96 : 1, H);
      v3.hit = rect;
    } else {
      board = { pw: 9, ph: 9 }; H = 4.5; setSurround(false); v3.geo = null; v3.hit = null;
      const drift = calm ? 0 : Math.sin(clock * 0.12) * 7;
      fitCamera(opts.rect || { x: VW * 0.1, y: VH * 0.05, w: VW * 0.8, h: VH * 0.5 }, 38, 32, drift, 1, H);
    }
  };

  await tick();
  // ---------------------------------------------------------------- per-puzzle bridge animation state
  const bs = new Map();   // edge -> { n, from, t }
  let lastSt = null, bridgeSig = '';
  const decorOf = (P, i) => {
    const h = hash(P.str.length * 7.31 + P.isl[i].x * 3.7 + P.isl[i].y * 5.3 + i * 1.7 + P.n);
    return h < 0.38 ? 0 : h < 0.56 ? 1 : h < 0.7 ? 2 : h < 0.82 ? 3 : h < 0.91 ? 4 : 5;   // none, pine, lantern, bonsai, blossom, rocks
  };
  const decorPlace = (P, i) => { const ang = -Math.PI / 2 + (hash(i * 3.3 + P.n) - 0.5) * 1.7 - 0.5, rad = 0.33; return { x: Math.cos(ang) * rad, z: Math.sin(ang) * rad, yaw: hash(i + 9) * TAU }; };
  function setInst(mesh, idx, x, y, z, sx, sy, sz, ry = 0) { _p.set(x, y, z); _q.setFromEuler(_e.set(0, ry, 0)); _s.set(sx, sy, sz); _m.compose(_p, _q, _s); mesh.setMatrixAt(idx, _m); }

  function presentIslands(fr, calm) {
    const { P, st, o } = fr, T = theme(), fx = o.fx || {}, n = Math.min(P.n, MAXI);
    const cnt = { pine: 0, canopy: 0, rocks: 0, lstone: 0, trunk: 0 };
    const cs = { open: new THREE.Color(T.sand), full: new THREE.Color(T.done).lerp(white, 0.1), over: new THREE.Color(T.err).lerp(new THREE.Color(T.sand), 0.35) };
    for (let i = 0; i < n; i++) {
      const isl = P.isl[i], X = isl.x + 0.5 - board.pw / 2, Z = isl.y + 0.5 - board.ph / 2;
      const pw = fx.pop ? fx.pop[i] : 0, sh = fx.shake ? fx.shake[i] : 0, wv = fx.wave ? fx.wave[i] : 99;
      const kp0 = pw > 0 && pw < 0.3 ? 1 + 0.22 * Math.sin((Math.PI * pw) / 0.3) : 1, dx = sh > 0 && sh < 0.4 ? Math.sin(sh * 60) * 0.037 * (1 - sh / 0.4) : 0;
      const wl = wv > 0 && wv < 0.55 ? Math.sin((Math.PI * wv) / 0.55) : 0;
      const bob = calm ? 0 : Math.sin(clock * 0.9 + i * 1.7) * 0.006, selUp = o.sel === i ? 0.035 : 0;
      const y = 0.13 * wl + selUp + bob, x = X + dx;
      const kp = kp0 * 1.22;
      setInst(I.rock, i, x, y, Z, kp, 1, kp, hash(i + 3) * TAU);
      setInst(I.moss, i, x, y, Z, kp, 1, kp, hash(i + 5) * TAU);
      setInst(I.plaque, i, x, y, Z, kp, 1, kp, 0);
      setInst(I.rim, i, x, y, Z, kp, 1, kp, 0);
      const stt = islandStatus(P, st.br, i), status = o.check === 'off' && stt === 'over' ? 'open' : stt;
      I.plaque.setColorAt(i, cs[status] || cs.open);
      const type = decorOf(P, i), d = decorPlace(P, i);
      if (type === 1) { setInst(I.trunk, cnt.trunk++, x + d.x, y + 0.14, Z + d.z, 0.7, 0.5, 0.7); setInst(I.pine, cnt.pine++, x + d.x, y + 0.17, Z + d.z, 0.78 * kp, 0.82 * kp, 0.78 * kp, d.yaw); }
      else if (type === 3) { setInst(I.trunk, cnt.trunk++, x + d.x, y + 0.14, Z + d.z, 0.6, 0.5, 0.6); const j = cnt.canopy++; setInst(I.canopy, j, x + d.x, y + 0.42, Z + d.z, 0.85 * kp, 0.85 * kp, 0.85 * kp, d.yaw); I.canopy.setColorAt(j, _c.set(looks.moss).lerp(white.clone().multiplyScalar(0.35), 0.15)); }
      else if (type === 4) { setInst(I.trunk, cnt.trunk++, x + d.x, y + 0.14, Z + d.z, 0.8, 0.62, 0.8); const j = cnt.canopy++; setInst(I.canopy, j, x + d.x, y + 0.5, Z + d.z, kp, kp, kp, d.yaw); I.canopy.setColorAt(j, _c.set(looks.canopy[(i + 1) % 3])); }
      else if (type === 5) { for (let q = 0; q < 2; q++) setInst(I.rocks, cnt.rocks++, x + d.x + (q ? 0.1 : -0.05), y + 0.15, Z + d.z + (q ? -0.04 : 0.04), 0.9 - q * 0.3, 0.9 - q * 0.2, 0.9 - q * 0.3, i + q); }
      else if (type === 2) { const j = cnt.lstone++, sc = 0.78 * kp; setInst(I.lstone, j, x + d.x, y + 0.15, Z + d.z, sc, sc, sc); setInst(I.lbox, j, x + d.x, y + 0.15 + 0.265 * sc, Z + d.z, sc, sc, sc); setInst(I.lroof, j, x + d.x, y + 0.15, Z + d.z, sc, sc, sc); setInst(I.lglow, j, x + d.x, y + 0.15 + 0.27 * sc, Z + d.z, sc, sc, sc); }
    }
    I.rock.count = I.moss.count = I.plaque.count = I.rim.count = n;
    I.trunk.count = cnt.trunk; I.pine.count = cnt.pine; I.canopy.count = cnt.canopy; I.rocks.count = cnt.rocks;
    I.lstone.count = I.lbox.count = I.lroof.count = I.lglow.count = cnt.lstone;
    for (const k of Object.keys(I)) { I[k].instanceMatrix.needsUpdate = true; if (I[k].instanceColor) I[k].instanceColor.needsUpdate = true; }
    const pulse = 0.5 + 0.5 * Math.sin(clock * 4.5);
    for (let i = 0; i < n; i++) {
      const isl = P.isl[i], X = isl.x + 0.5 - board.pw / 2, Z = isl.y + 0.5 - board.ph / 2, stt = islandStatus(P, st.br, i);
      if (stt === 'full') { const gl = 0.5 + 0.5 * Math.sin(clock * 1.6 + i); markQuad(X, Z, glowTex, '#ffe9a8', (0.3 + 0.18 * gl) * (look === 'chart' ? 0.7 : 1), 1.15, 1.15, 0, 0.05); }
      if (stt === 'over' && o.check !== 'off') markQuad(X, Z, ringTex, '#ff5a4a', 0.9, 1.15, 1.15, 0, 0.05);
      if (o.focus && o.focus.has(i)) { markQuad(X, Z, ringTex, '#3fe0b8', 0.75 + 0.25 * pulse, 1.25 + 0.06 * pulse, 1.25 + 0.06 * pulse, 0, 0.05); markQuad(X, Z, glowTex, '#3fe0b8', 0.25, 1.3, 1.3, 0, 0.045); }
      if (o.sel === i) { markQuad(X, Z, ringTex, '#ffd24a', 1, 1.18 + 0.05 * pulse, 1.18 + 0.05 * pulse, 0, 0.055); markQuad(X, Z, glowTex, '#ffd24a', 0.35 + 0.15 * pulse, 1.4, 1.4, 0, 0.05); }
    }
  }

  // bridges: planks, posts and ropes are three instanced meshes rebuilt when counts / tint / animation change
  function laneLayout(P, e, lane, count) {
    const a = P.isl[P.ea[e]], b = P.isl[P.eb[e]], ax = a.x + 0.5 - board.pw / 2, az = a.y + 0.5 - board.ph / 2, bx = b.x + 0.5 - board.pw / 2, bz = b.y + 0.5 - board.ph / 2;
    const d = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / d, dz = (bz - az) / d, off = count === 1 ? 0 : (lane ? 0.2 : -0.2), width = count === 1 ? 0.4 : 0.24;
    return { ax, az, dx, dz, px: -dz, pz: dx, d, off, width, yaw: Math.atan2(-dz, dx), s0: 0.33, s1: d - 0.33 };
  }
  function presentBridges(fr, dt) {
    const { P, st, o } = fr, T = theme();
    if (lastSt !== st || bs.size !== P.E) { bs.clear(); for (let e = 0; e < P.E; e++) bs.set(e, { n: st.br[e], from: st.br[e], t: 99 }); lastSt = st; }
    let anim = false;
    const rem = remAll(P, st.br);
    for (let e = 0; e < P.E; e++) {
      const r = bs.get(e), n = st.br[e];
      if (n !== r.n) {
        const lo = laneLayout(P, e, 0, 1), mx = lo.ax + lo.dx * lo.d / 2, mz = lo.az + lo.dz * lo.d / 2;
        if (n > r.n) { r.from = r.n; r.t = 0; } else { r.from = n; r.t = 99; ripple(mx, mz, 1.1, 0.9, 0.8); burst(mx, 0.1, mz, 7, 1.4, 0.7); }
        r.n = n;
      }
      if (r.t < 3) { r.t += dt; anim = true; }
    }
    const badSet = new Set();
    if (o.check && o.check !== 'off') for (let e = 0; e < P.E; e++) { const n = st.br[e]; if (n && ((o.check === 'check' && o.sol && n > o.sol[e]) || rem[P.ea[e]] < 0 || rem[P.eb[e]] < 0)) badSet.add(e); }
    if (o.fx && o.fx.blink && o.fx.blink.t < 0.5) badSet.add(o.fx.blink.e);
    const sig = st.br.join('') + '|' + [...badSet].join(',') + '|' + P.str + '|' + look;
    if (!anim && sig === bridgeSig) return;
    bridgeSig = sig;
    let pi = 0, qi = 0, ri = 0;
    const err = new THREE.Color(T.err), reveal = 0.42;
    const putRope = (x0, y0, z0, x1, y1, z1) => {
      if (ri >= MAXR) return;
      _a.set(x0, y0, z0); _b.set(x1, y1, z1); _dir.subVectors(_b, _a); const len = _dir.length(); if (len < 1e-4) return;
      _p.copy(_a).addScaledVector(_dir, 0.5); _q.setFromUnitVectors(_x, _dir.normalize()); _s.set(len, 1, 1); _m.compose(_p, _q, _s); ropes.setMatrixAt(ri++, _m);
    };
    for (let e = 0; e < P.E; e++) {
      const r = bs.get(e), n = st.br[e]; if (!n) continue;
      const tint = badSet.has(e) ? err : white;
      for (let lane = 0; lane < n; lane++) {
        const L = laneLayout(P, e, lane, n), len = L.s1 - L.s0, m = Math.max(3, Math.round(len / 0.19)), isNew = lane >= r.from && r.t < 3, t = isNew ? r.t : 99;
        const f = clamp(t / reveal, 0, 1);
        for (let i = 0; i < m; i++) {
          if (pi >= MAXP) break;
          const u = (i + 0.5) / m, a0 = t - (i / m) * reveal; if (a0 < 0) continue;
          const drop = 1 - ease(clamp(a0 / 0.14, 0, 1)), sag = 0.032 * Math.sin(Math.PI * u), jit = hash(e * 31 + lane * 7 + i) - 0.5;
          const sOff = L.s0 + u * len, x = L.ax + L.dx * sOff + L.px * L.off, z = L.az + L.dz * sOff + L.pz * L.off;
          _p.set(x, DECK_Y - 0.02 - sag + drop * 0.24 + jit * 0.004, z); _q.setFromEuler(_e.set(0, L.yaw + jit * 0.05, drop * 0.3 * (i % 2 ? 1 : -1))); const sc = 0.75 + 0.25 * ease(1 - drop);
          _s.set(len / m * 0.88 * sc, 1, L.width * (0.96 + jit * 0.06)); _m.compose(_p, _q, _s); planks.setMatrixAt(pi, _m); planks.setColorAt(pi, tint); pi++;
          if (isNew && a0 < dt * 1.5 + 0.001 && i % 2 === 0) { ripple(x, z, 0.5, 0.6, 0.55); if (i === m - 1 || i === 0) burst(x, 0.08, z, 3, 1.1, 0.5); }
        }
        if (isNew && t >= reveal - dt * 1.5 && t < reveal + dt * 1.5 + 0.06) { const x = L.ax + L.dx * L.s1 + L.px * L.off, z = L.az + L.dz * L.s1 + L.pz * L.off; burst(x, 0.1, z, 6, 1.6, 0.8); ripple(x, z, 0.9, 0.8, 0.7); }
        const sides = n === 1 ? [-1, 1] : [lane ? 1 : -1];
        for (const sd of sides) {
          const lx = L.off + sd * L.width / 2, K = 7, ph = DECK_Y - 0.02;
          _q.identity(); _s.set(1, 1, 1);
          if (qi < MAXPOST) { _p.set(L.ax + L.dx * L.s0 + L.px * lx, ph - 0.02, L.az + L.dz * L.s0 + L.pz * lx); _m.compose(_p, _q, _s); posts.setMatrixAt(qi++, _m); }
          if (f >= 0.999 && qi < MAXPOST) { _p.set(L.ax + L.dx * L.s1 + L.px * lx, ph - 0.02, L.az + L.dz * L.s1 + L.pz * lx); _m.compose(_p, _q, _s); posts.setMatrixAt(qi++, _m); }
          if (f > 0.02) {
            let pr = null;
            for (let k = 0; k <= K; k++) {
              const u = (k / K) * f, sOff = L.s0 + u * len, sagY = 0.05 * Math.sin(Math.PI * (k / K));
              const cur = [L.ax + L.dx * sOff + L.px * lx, ph + 0.235 - sagY, L.az + L.dz * sOff + L.pz * lx];
              if (pr) putRope(pr[0], pr[1], pr[2], cur[0], cur[1], cur[2]);
              pr = cur;
            }
          }
        }
      }
    }
    planks.count = pi; posts.count = qi; ropes.count = ri;
    planks.instanceMatrix.needsUpdate = true; posts.instanceMatrix.needsUpdate = true; ropes.instanceMatrix.needsUpdate = true;
    if (planks.instanceColor) planks.instanceColor.needsUpdate = true;
  }

  function presentGhosts(fr) {
    const { P, o } = fr; let gi = 0;
    if (o.ghost) for (const [e, n] of o.ghost) for (let lane = 0; lane < n; lane++) {
      const L = laneLayout(P, e, lane, n), len = L.s1 - L.s0, m = Math.max(3, Math.round(len / 0.19));
      for (let i = 0; i < m && gi < 600; i++) { const u = (i + 0.5) / m, sOff = L.s0 + u * len; _p.set(L.ax + L.dx * sOff + L.px * L.off, DECK_Y + 0.025, L.az + L.dz * sOff + L.pz * L.off); _q.setFromEuler(_e.set(0, L.yaw, 0)); _s.set(len / m * 0.88, 1.2, L.width); _m.compose(_p, _q, _s); ghost.setMatrixAt(gi++, _m); }
    }
    ghost.count = gi; ghost.instanceMatrix.needsUpdate = true; ghostMat.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(clock * 5));
    if (o.targets) for (const e of o.targets) {
      const L = laneLayout(P, e, 0, 1), len = L.s1 - L.s0, K = Math.max(3, Math.round(len / 0.32));
      for (let k = 0; k < K; k++) { const ph = (clock * 1.4 + k * 0.5) % 2, a = 0.35 + 0.55 * Math.max(0, 1 - Math.abs(ph - 1) * 1.2), sOff = L.s0 + ((k + 0.5) / K) * len; markQuad(L.ax + L.dx * sOff, L.az + L.dz * sOff, glowTex, '#fff2c0', a, 0.22, 0.22, 0, 0.045); }
    }
  }

  await tick();
  // ---------------------------------------------------------------- frame
  function stepParts(dt) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const p = drops[i]; p.life += dt; p.vy -= 5.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.01 && p.vy < 0) { ripple(p.x, p.z, 0.22, 0.4, 0.4); drops.splice(i, 1); continue; }
      if (p.life >= p.max) drops.splice(i, 1);
    }
    for (let i = 0; i < NP; i++) {
      const p = drops[i];
      if (!p) _m.makeScale(0, 0, 0); else { _p.set(p.x, p.y, p.z); _s.setScalar(1 - 0.4 * (p.life / p.max)); _q.identity(); _m.compose(_p, _q, _s); }
      dropMesh.setMatrixAt(i, _m);
    }
    dropMesh.instanceMatrix.needsUpdate = true;
    for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.life += dt; if (r.life >= r.max) { ripples.splice(i, 1); continue; } const f = r.life / r.max, sz = r.size * (0.3 + 0.9 * f); markQuad(r.x, r.z, ringTex, '#ffffff', r.op * (1 - f) * (1 - f), sz, sz, 0, 0.02); }
  }

  function ambience(calm) {
    const t = clock, c = looks, fxl = TIERS[tier].fx;
    const n1 = waterMat.normalMap; n1.offset.x = (t * (calm ? 0.002 : 0.012)) % 1; n1.offset.y = (t * (calm ? 0.0015 : 0.008)) % 1; n1.repeat.set(Math.max(2, surH * 0.45), Math.max(2, surH * 0.45));
    const caust = surround && surround.root.getObjectByName('caustic'); if (caust && caust.material.map) { caust.material.map.offset.set((t * 0.015) % 1, (t * 0.01) % 1); caust.material.opacity = (look === 'chart' ? 0.16 : 0.24) * (0.8 + 0.2 * Math.sin(t * 0.8)); }
    koi.forEach((k, i) => {
      k.g.visible = fxl >= 1 || i < 2;
      const sp = k.sp * (calm ? 0.4 : 1), a = t * sp + k.ph, R = Math.max(1.6, surH - 0.7);
      const x = Math.cos(a) * R * (0.5 + 0.35 * Math.sin(a * 0.31 + k.ph)), z = Math.sin(a * 1.13) * R * 0.75;
      const nx = -Math.sin(a) * R * 0.6, nz = Math.cos(a * 1.13) * R * 0.85;
      k.g.position.set(x, -0.3 - 0.04 * Math.sin(a * 2), z); k.g.rotation.y = Math.atan2(-nz, nx);
      k.g.userData.tail.rotation.y = Math.sin(t * 5 + i) * 0.45;
    });
    const flick = calm ? 1 : 1 + 0.12 * Math.sin(t * 7.1) + 0.07 * Math.sin(t * 12.3 + 1);
    lanternGlowM.color.set(look === 'chart' ? 0xffe0a0 : 0xffc070).multiplyScalar(0.8 + 0.25 * flick * c.glow + 0.2);
    if (surround) for (const tr of surround.toros) { const g = tr.userData.glow; if (g) g.material.color.set(look === 'chart' ? 0xffe0a0 : 0xffb860).multiplyScalar(0.75 + 0.3 * flick * Math.min(1.3, c.glow + 0.2)); }
    mist.forEach((m, i) => { const a = m.userData.a + (calm ? 0 : t * 0.01 * (i % 2 ? 1 : -1)); m.position.x = Math.cos(a) * (surH + 3.5 + Math.sin(t * 0.1 + i) * 0.8); m.position.z = Math.sin(a) * (surH + 3.5); m.material.opacity = (look === 'chart' ? 0.16 : 0.22) * (fxl >= 1 ? 1 : 0.5); });
    if (petals.visible) { const a = petals.geometry.attributes.position, b = petals.userData.base, k = surH / 4.5 + 0.6; for (let i = 0; i < a.count; i++) { const fall = (t * (0.25 + (i % 5) * 0.04) + b[i * 3 + 1]) % 9; a.array[i * 3] = b[i * 3] * k + Math.sin(t * 0.6 + i) * 0.7; a.array[i * 3 + 1] = 9 - fall; a.array[i * 3 + 2] = b[i * 3 + 2] * k + Math.cos(t * 0.5 + i * 2) * 0.6; } a.needsUpdate = true; }
    if (flies.visible) { const a = flies.geometry.attributes.position, b = flies.userData.base, k = surH / 4.5 + 0.5; for (let i = 0; i < a.count; i++) { a.array[i * 3] = b[i * 3] * k + Math.sin(t * 0.4 + i) * 0.8; a.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * 0.7 + i * 3) * 0.3; a.array[i * 3 + 2] = b[i * 3 + 2] * k + Math.cos(t * 0.35 + i) * 0.8; } flies.material.opacity = 0.55 + 0.4 * Math.sin(t * 2.2); a.needsUpdate = true; }
    rig.key.intensity = c.keyI * (calm ? 1 : 1 + 0.015 * Math.sin(t * 0.7));
  }

  function lattice(fr) {
    const key = fr ? fr.P.str : 'none';
    if (buoys.userData.key === key) return;
    buoys.userData.key = key;
    const pos = [];
    if (fr) { const P = fr.P; for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.at[y * P.w + x] < 0) pos.push(x + 0.5 - board.pw / 2, 0, y + 0.5 - board.ph / 2); }
    buoys.geometry.dispose(); buoys.geometry = new THREE.BufferGeometry(); buoys.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  }

  function present(state, dt) {
    const fr = v3.frame, calm = !!(state.prefs && state.prefs.calm);
    markN = 0;
    const want = state.prefs && LOOKS3D[state.prefs.look] ? state.prefs.look : 'lagoon';
    if (want !== look) applyLook(want);
    const show = !!fr && !state.paused;
    for (const k of Object.keys(I)) I[k].visible = show;
    planks.visible = posts.visible = ropes.visible = ghost.visible = show; buoys.visible = !!fr;
    if (show) { presentIslands(fr, calm); presentBridges(fr, dt); presentGhosts(fr); } else { bridgeSig = ''; lastSt = null; }
    lattice(fr);
    stepParts(dt);
    ambience(calm);
    for (let i = markN; i < markPool.length; i++) markPool[i].visible = false;
    renderer.setViewport(0, 0, W, Hh);
    renderer.render(scene, camera);
  }

  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; rig.key.castShadow = t.shadow > 0;
    if (t.shadow) { rig.key.shadow.mapSize.set(t.shadow, t.shadow); if (rig.key.shadow.map) { rig.key.shadow.map.dispose(); rig.key.shadow.map = null; } }
    dprNow = Math.min(window.devicePixelRatio || 1, t.dpr); W = 0;
    petals.visible = t.fx >= 1 && look !== 'night'; flies.visible = looks.firefly > 0 && t.fx >= 1;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { W = 0; try { buildEnv(); applyTier(); } catch (err) { /* ignore */ } v3.on = true; });

  try { applyLook('lagoon'); applyTier(); }
  catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  await tick();
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* first frame compiles instead */ }
  v3.on = true;
  v3.fit = (geo, kind, opts) => { try { v3.setBoard(geo, kind, opts); } catch (e) { console.warn('3D fit failed', e); v3.on = false; } };

  return {
    ok: true, renderer, scene, camera, rig,
    wrap(game) {
      return Object.assign({}, game, {
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          VW = view?.width ?? 720; VH = view?.height ?? 1280;
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.frame = null;
          game.render(ctx, view);
          try { present(state, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
