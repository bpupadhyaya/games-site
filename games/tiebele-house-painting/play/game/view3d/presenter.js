// Tiebele 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: the compound scene (painted wall, courtyard, rain, painter's hand) and a screen-space HUD scene (plaster plaques, clay buttons,
// lathe-turned pigment pots) drawn in the same frame under the 2D text.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; restored -> back to 3D.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { v3 } from '../src/v3.js';
import { buildWall } from '../src/sim.js';
import { createWall, CELL, hash, bandCanvas } from './wall.js';
import { createWorld } from './world.js';
import { createPainter } from './hand.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048 },
  { name: 'medium', dpr: 1.5, shadow: 1024 },
  { name: 'low', dpr: 1, shadow: 0 },
];
const HERO = { kind: 'mirrorV', W: 6, H: 4, colors: [1, 2, 3], given: 0, slack: 0.1, seed: 4242 };
const PIGHEX = { 1: '#f3ecd8', 2: '#2c2420', 3: '#b2452a' };

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const qs = new URLSearchParams(location.search);
  const noop = { wrap: (g) => g, ok: false };
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('keep') });
  } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.autoClear = false; renderer.setClearColor(0x2a1a10, 1);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- scene, lights
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.2, 400);
  scene.fog = new THREE.Fog(0xe0b98a, 28, 110);
  const world = createWorld({ quality: TIERS[tier].name, camera });
  scene.add(world.group);
  const wall = createWall({ quality: TIERS[tier].name });
  scene.add(wall.group);
  const hemi = new THREE.HemisphereLight(0xcfd8ff, 0x7a4a2a, 0.62);
  const sun = new THREE.DirectionalLight(0xffa850, 3.0); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 40 });
  sun.shadow.bias = -0.0009; sun.shadow.normalBias = 0.07; sun.shadow.radius = 3;
  const rim = new THREE.DirectionalLight(0xffd7a0, 0.9); rim.position.set(6, 6, -4);
  const fill = new THREE.DirectionalLight(0x9fb4ff, 0.42); fill.position.set(5, 3, 8);
  scene.add(hemi, sun, sun.target, rim, fill);
  const SUN_DIR = new THREE.Vector3(-0.56, 0.4, 0.72).normalize();

  // screen-space HUD scenes: `hud` full screen, `hudS` scissored to a scrolling body
  function makeHud() {
    const s = new THREE.Scene();
    const l1 = new THREE.DirectionalLight(0xfff0d6, 1.9); l1.position.set(-500, 800, 1000);
    const l2 = new THREE.DirectionalLight(0xffc890, 0.55); l2.position.set(700, -300, 600);
    s.add(new THREE.HemisphereLight(0xffe8c8, 0x2a1a10, 0.75), l1, l2);
    return { scene: s, panels: [], buttons: [] };
  }
  const hud = makeHud(), hudS = makeHud();
  const hudCam = new THREE.PerspectiveCamera();
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }
  function buildEnvMap() {
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    pm.dispose();
    scene.environment = t; scene.environmentIntensity = 0.42;
    for (const h of [hud, hudS]) { h.scene.environment = t; h.scene.environmentIntensity = 0.5; }
  }

  // ---------------------------------------------------------------- HUD plaques / buttons / pots
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 200) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const plasterCanvas = (c0, seed) => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = c0; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) { const k = hash(i, seed); x.fillStyle = k < 0.5 ? `rgba(255,244,220,${0.06 + k * 0.2})` : `rgba(70,36,14,${0.05 + (k - 0.5) * 0.25})`; x.fillRect(hash(i, 2) * 256, hash(i, 3) * 256, 1 + hash(i, 4) * 3, 1 + hash(i, 5) * 2); }
    for (let i = 0; i < 24; i++) { const px = hash(i, 8, seed) * 256, py = hash(i, 9, seed) * 256, r = 30 + hash(i, 10) * 50; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, hash(i, 11) < 0.5 ? 'rgba(255,230,190,0.18)' : 'rgba(90,48,20,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.004, 0.004); return t;
  };
  const plasterTex = plasterCanvas('#d7b184', 3);
  const dimTex = plasterCanvas('#6f4e36', 5);
  const M = {
    plaster: new THREE.MeshStandardMaterial({ map: plasterTex, bumpMap: plasterTex, bumpScale: 1.2, roughness: 0.92, color: 0xffffff }),
    plasterDark: new THREE.MeshStandardMaterial({ map: dimTex, bumpMap: dimTex, bumpScale: 1.0, roughness: 0.95, color: 0xffffff }),
    ochre: new THREE.MeshStandardMaterial({ color: '#c47a2c', roughness: 0.62, metalness: 0.0 }),
    ochreHi: new THREE.MeshStandardMaterial({ color: '#e0a95a', roughness: 0.5 }),
    umber: new THREE.MeshStandardMaterial({ color: '#27160c', roughness: 0.96 }),
    umberSoft: new THREE.MeshStandardMaterial({ color: '#3a2316', roughness: 0.96 }),
    lime: new THREE.MeshStandardMaterial({ color: '#efe3c4', roughness: 0.9 }),
    stoneDim: new THREE.MeshStandardMaterial({ color: '#4a4038', roughness: 0.85 }),
  };
  const colCache = new Map();
  const phys = (color, o = {}) => { const k = color + JSON.stringify(o); let m = colCache.get(k); if (!m) { m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.28, ...o }); colCache.set(k, m); } return m; };
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x120a04, transparent: true, opacity: 0, depthWrite: false }));
  hud.scene.add(scrim);
  const ROT = Math.PI / 2;
  const Zback = -700, Zfront = -450, Zbtn = -400;

  function panelAt(h, i) {
    let p = h.panels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, M.plaster), trim = new THREE.Mesh(flatQuad, M.ochre), inner = new THREE.Mesh(flatQuad, M.umber); g.add(outer, trim, inner); h.scene.add(g); p = { g, outer, trim, inner }; h.panels.push(p); }
    return p;
  }
  function placePanel(h, i, e) {
    const p = panelAt(h, i), r = e.r, rad = e.rad; p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = e.front ? Zfront : Zback, dep = e.kind === 'title' ? 20 : 14, ins = clamp(Math.min(r.w, r.h) * 0.075, 5, 10);
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.trim.geometry = slabG(r.w - ins * 1.15, r.h - ins * 1.15, dep + 1.6, Math.max(4, rad - ins * 0.5), 1.6); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.6, Math.max(3, rad - ins), 2.4); p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    p.outer.material = e.kind === 'dim' ? M.plasterDark : M.plaster; p.trim.material = e.kind === 'title' ? M.ochreHi : M.ochre;
    p.inner.material = e.kind === 'light' ? M.lime : e.kind === 'soft' ? M.umberSoft : M.umber;
  }
  function buttonAt(h, i) {
    let b = h.buttons[i];
    if (!b) { const g = new THREE.Group(), rimM = new THREE.Mesh(flatQuad, M.ochre), body = new THREE.Mesh(flatQuad, M.umber); g.add(rimM, body); h.scene.add(g); b = { g, body, rim: rimM }; h.buttons.push(b); }
    return b;
  }
  const BTN = {
    primary: ['#e6b05c', 0.44], active: ['#b5452b', 0.5], dark: ['#3d2618', 0.6], plain: ['#6a3f26', 0.52], disabled: ['#4a382c', 0.95],
    chipPaint: ['#c4782a', 0.5], chipRain: ['#3f6c9c', 0.45], chipRepair: ['#6f8f3c', 0.5],
  };
  function placeButton(h, i, e, pressed) {
    const b = buttonAt(h, i), r = e.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(18, r.h / 3), z = Zbtn, dis = e.kind === 'disabled', dep = dis ? 7 : pressed ? 8 : 17;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, rad - 2, 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    const [col, rough] = BTN[e.kind] || BTN.plain;
    b.body.material = phys(col, { roughness: rough, clearcoat: dis ? 0 : 0.5, emissive: e.kind === 'primary' ? '#7a4a10' : e.kind === 'active' ? '#5a1408' : '#000000', emissiveIntensity: 0.2 });
    b.rim.material = dis ? M.stoneDim : e.kind === 'primary' ? M.ochreHi : M.ochre;
    b.g.position.set(0, pressed ? -3 : 0, 0);
  }

  // pigment pots: lathe-turned clay with a painted frieze and a glossy pool of pigment that really sits at the fill level
  const potProfile = [[0.0, 0.0], [0.22, 0.0], [0.31, 0.035], [0.41, 0.15], [0.47, 0.32], [0.46, 0.5], [0.37, 0.67], [0.27, 0.79], [0.25, 0.87], [0.3, 0.925], [0.31, 0.97], [0.285, 1.0],
    [0.235, 0.975], [0.215, 0.9], [0.245, 0.75], [0.3, 0.5], [0.3, 0.22], [0.0, 0.16]];
  const innerR = (y) => { const pts = [[0.16, 0.0], [0.22, 0.3], [0.5, 0.3], [0.75, 0.245], [0.9, 0.215]]; for (let i = 1; i < pts.length; i++) if (y <= pts[i][0]) { const a = pts[i - 1], b = pts[i], t = (y - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t; } return 0.215; };
  const potTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#6c3418'); g.addColorStop(0.45, '#b4653a'); g.addColorStop(1, '#8a4524'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) { x.fillStyle = hash(i, 1) < 0.5 ? 'rgba(255,220,170,0.12)' : 'rgba(40,16,4,0.16)'; x.fillRect(hash(i, 2) * 256, hash(i, 3) * 256, 1.5, 1.5); }
    x.fillStyle = '#2a1a12'; x.fillRect(0, 150, 256, 7); x.fillRect(0, 205, 256, 7);
    for (let k = 0; k < 10; k++) { x.fillStyle = '#f1e7cc'; x.beginPath(); x.moveTo(k * 25.6, 205); x.lineTo(k * 25.6 + 12.8, 160); x.lineTo(k * 25.6 + 25.6, 205); x.closePath(); x.fill(); x.fillStyle = '#8c2d18'; x.beginPath(); x.arc(k * 25.6 + 12.8, 181, 3.4, 0, TAU); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
  })();
  const potGeo = new THREE.LatheGeometry(potProfile.map(([r, y]) => new THREE.Vector2(r, y)), 40);
  const potMat = new THREE.MeshPhysicalMaterial({ map: potTex, roughness: 0.62, clearcoat: 0.35, clearcoatRoughness: 0.4, side: THREE.DoubleSide, envMapIntensity: 0.9 });
  const potMatDim = potMat.clone(); potMatDim.color.setRGB(0.5, 0.46, 0.44);
  const discGeo = new THREE.CircleGeometry(1, 36); discGeo.rotateX(-Math.PI / 2);
  const rippleGeo = new THREE.RingGeometry(0.82, 1, 36); rippleGeo.rotateX(-Math.PI / 2);
  const pots = [];
  function potAt(i) {
    let p = pots[i];
    if (!p) {
      const g = new THREE.Group(), tilt = new THREE.Group(), body = new THREE.Mesh(potGeo, potMat);
      const pigM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.45 });
      const disc = new THREE.Mesh(discGeo, pigM);
      const ripM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      const ripple = new THREE.Mesh(rippleGeo, ripM);
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.74, 40), new THREE.MeshBasicMaterial({ color: 0xffe3a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.set(0, 0.45, -0.6);
      tilt.add(body, disc, ripple); g.add(tilt, halo); hud.scene.add(g);
      p = { g, tilt, body, disc, pigM, ripple, ripM, halo, lift: 0, rip: 0, lastSel: false };
      pots[i] = p;
    }
    return p;
  }
  function placePot(i, e, dt, t) {
    const p = potAt(i), r = e.r; p.g.visible = true;
    const wide = r.w > r.h * 1.35;
    const s = wide ? Math.min(r.h * 0.9, r.w * 0.36) : Math.min(r.w * 1.0, r.h * 0.68);
    const cx = wide ? r.x + r.w * 0.27 : r.x + r.w * 0.5, cy = wide ? r.y + r.h * 0.5 : r.y + r.h * 0.38;
    p.lift += ((e.sel ? 1 : 0) - p.lift) * clamp(dt * 12, 0, 1);
    if (e.sel && !p.lastSel) p.rip = 1; p.lastSel = e.sel;
    if (e.dip) p.rip = Math.max(p.rip, 0.8);
    p.rip = Math.max(0, p.rip - dt * 1.4);
    p.g.position.set(cx, -(cy + s * 0.42) + p.lift * s * 0.08, Zbtn - 5);
    p.g.scale.setScalar(s);
    p.tilt.rotation.set(0.72 + p.lift * 0.14, 0.35 + Math.sin(t * 0.7 + i) * 0.015, 0);
    p.body.material = e.locked ? potMatDim : potMat;
    const lvl = 0.26 + 0.6 * clamp(e.fill, 0, 1);
    p.disc.position.y = lvl; p.disc.scale.setScalar(innerR(lvl) * 0.97);
    p.disc.visible = e.fill > 0.001;
    p.pigM.color.set(PIGHEX[e.color] || '#fff');
    p.pigM.emissive.set(e.locked ? '#000000' : PIGHEX[e.color] || '#000'); p.pigM.emissiveIntensity = e.locked ? 0 : 0.03;
    p.ripple.position.y = lvl + 0.002; p.ripple.scale.setScalar(innerR(lvl) * (0.3 + (1 - p.rip) * 0.9)); p.ripM.opacity = p.rip * 0.6;
    p.ripM.color.set(e.color === 2 ? '#8d7a6c' : '#ffffff');
    p.halo.material.opacity = 0;
    p.halo.scale.setScalar(0.9);
  }

  // ---------------------------------------------------------------- particles (dust, splashes, sparkles)
  const PN = 160, _c0 = new THREE.Color(1, 1, 1);
  const pm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), PN);
  pm.frustumCulled = false; scene.add(pm);
  for (let i = 0; i < PN; i++) pm.setColorAt(i, _c0);
  const parts = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  function emit(x, y, z, n, o = {}) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, sp = (o.speed ?? 0.5) * (0.4 + Math.random() * 0.9);
      parts.push({ x, y, z, vx: Math.cos(a) * sp * (o.sx ?? 1), vy: (o.up ?? 0.3) * (0.4 + Math.random()), vz: Math.abs(Math.sin(a)) * sp * (o.sz ?? 0.8), life: 0, max: (o.life ?? 0.7) * (0.6 + Math.random() * 0.7), col: o.col || '#fff', size: (o.size ?? 1) * (0.6 + Math.random() * 0.9), g: o.g ?? 3.2 });
    }
    if (parts.length > PN) parts.splice(0, parts.length - PN);
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.life >= p.max) parts.splice(i, 1);
    }
    for (let i = 0; i < PN; i++) {
      const p = parts[i];
      if (!p) { _m.makeScale(0, 0, 0); pm.setMatrixAt(i, _m); continue; }
      const k = 1 - p.life / p.max; _p.set(p.x, p.y, p.z); _s.setScalar(p.size * (0.4 + 0.8 * k)); _m.compose(_p, _q, _s); pm.setMatrixAt(i, _m);
      _c.set(p.col); pm.setColorAt(i, _c);
    }
    pm.instanceMatrix.needsUpdate = true; if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- rain streaks + falling droplets
  const RN = 240;
  const rainMat = new THREE.MeshBasicMaterial({ color: 0xd2e6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.006, 0.55, 0.006), rainMat, RN); rain.frustumCulled = false; scene.add(rain);
  const rdrop = Array.from({ length: RN }, (_, i) => ({ x: hash(i, 1), y: hash(i, 2), z: 0.15 + hash(i, 3) * 2.4, sp: 6 + hash(i, 4) * 3.5 }));
  const dropMesh = Array.from({ length: 14 }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), new THREE.MeshPhysicalMaterial({ color: 0xd8ecff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.92, emissive: 0x7fb0ff, emissiveIntensity: 0.35 }));
    m.scale.set(0.9, 1.6, 0.9); m.visible = false; scene.add(m); return m;
  });
  const dropTrail = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.5), new THREE.MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })); m.visible = false; scene.add(m); return m; });

  // ---------------------------------------------------------------- camera mapping
  let W = 1, H = 1, dprNow = 1, hudW = 0, hudH = 0, L_ = { w: 720, h: 1280 };
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const FOV = 22;
  let mapU = 0.004, mapXc = 0, mapYc = 0;
  // exact frontal mapping: the wall grid (cs virtual units per cell) lands exactly on its 2D rect; world x/y per virtual unit is u
  function frontalCamera(rect, panelY, Wc, Hc) {
    const u = CELL / rect.cs, gcx = rect.x + (Wc * rect.cs) / 2, gcy = rect.y + (Hc * rect.cs) / 2;
    const xc = (L_.w / 2 - gcx) * u, yc = panelY - (L_.h / 2 - gcy) * u;
    const d = (L_.h * u) / 2 / Math.tan((FOV * Math.PI) / 360);
    camera.clearViewOffset(); camera.fov = FOV; camera.aspect = W / H; camera.near = Math.max(0.2, d * 0.2); camera.far = d * 6 + 80; camera.updateProjectionMatrix();
    camera.position.set(xc, yc, d); camera.up.set(0, 1, 0); camera.lookAt(xc, yc, 0); camera.updateMatrixWorld();
    mapU = u; mapXc = xc; mapYc = yc;
  }
  const tmpV = new THREE.Vector3();
  // orbit camera that fits the wall's frame into a virtual-unit rect (the hero on the title screen)
  function orbitCamera(rect, hw, hh, panelY, yawDeg, pitchDeg, fov, shrink = 1) {
    const k = W / L_.w, tw = rect.w * k * shrink, th = rect.h * k * shrink, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.near = 0.3; camera.far = 300; camera.up.set(0, 1, 0); camera.updateProjectionMatrix();
    const corners = [[-hw, -hh, 0], [hw, -hh, 0], [hw, hh, 0], [-hw, hh, 0]];
    let d = 8, bb = null;
    const place = () => {
      camera.position.set(Math.sin(yaw) * Math.cos(p) * d, panelY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(0, panelY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of corners) { tmpV.set(c[0], c[1] + panelY, c[2]).project(camera); const px = ((tmpV.x + 1) / 2) * W, py = ((1 - tmpV.y) / 2) * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
      bb = { x0, x1, y0, y1 };
    };
    for (let it = 0; it < 7; it++) { place(); d *= Math.max((bb.x1 - bb.x0) / tw, (bb.y1 - bb.y0) / th); }
    place();
    const cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W, H, (bb.x0 + bb.x1) / 2 - cxp, (bb.y0 + bb.y1) / 2 - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  // pointer (virtual units) -> world point on the wall plane under the exact frontal camera
  const pointToWorld = (vx, vy) => ({ x: mapXc + (vx - L_.w / 2) * mapU, y: mapYc - (vy - L_.h / 2) * mapU });

  // ---------------------------------------------------------------- per-frame state
  let lastT = 0, clock = 0, frames = 0, ema = 16, painter = null, handReady = false;
  createPainter({ scene }).then((p) => { painter = p; handReady = !!p; }).catch((e) => { console.warn('hand unavailable', e); });
  let heroWall = null, heroT = 0, heroCells = null;
  let lastRun = null, prevCells = null, prevDropSt = new Map();
  let damp = 0, stormK = 0, curW = 0, curH = 0;

  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
  }
  const cellWorld = (wallObj, i, panelY) => ({ x: ((i % wallObj.W) + 0.5 - wallObj.W / 2) * CELL, y: panelY + (wallObj.H / 2 - Math.floor(i / wallObj.W) - 0.5) * CELL });

  function prepare(state, L, dt) {
    resize(); L_ = L;
    if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const sc = v3.scene, run = state.run, playing = sc === 'play' && run;
    let view = v3.wallView; const ph = playing ? run.ph : 'paint';
    // title / menus: the hero wall paints itself (the painter's hand moves cell by cell)
    let heroDemoTip = null;
    if (!view) {
      if (!heroWall) { heroWall = buildWall(HERO); heroCells = heroWall.init.slice(); }
      heroT += dt; if (qs.has('dev') && window.__dbgHeroT !== undefined) heroT = window.__dbgHeroT;
      const need = [];
      for (let i = 0; i < heroWall.N; i++) if (!heroWall.elder[i] && heroWall.target[i] > 0) need.push(i);
      const per = 0.85, total = need.length * per, cyc = total + 4.5, tt = heroT % cyc;
      const shown = Math.min(need.length, Math.floor(tt / per));
      heroCells = heroWall.init.slice();
      for (let k = 0; k < shown; k++) heroCells[need[k]] = heroWall.target[need[k]];
      if (tt < total) heroDemoTip = need[Math.min(need.length - 1, shown)];
      view = { wall: heroWall, cells: heroCells, glaze: null, guide: false, hintIdx: null, wrong: null, cursor: null };
    }
    const wallObj = view.wall;
    if (curW !== wallObj.W || curH !== wallObj.H) { curW = wallObj.W; curH = wallObj.H; world.setPanel(wallObj.W, wallObj.H); }
    const panelY = world.panelInfo.y;
    wall.group.position.set(0, panelY, 0);

    // dampness and storm light
    const raining = ph === 'rain', repairing = ph === 'repair';
    const tgtStorm = raining ? 1 : repairing ? 0.2 : 0, tgtDamp = raining ? 1 : repairing ? 0.55 : 0;
    stormK += (tgtStorm - stormK) * clamp(dt * (raining ? 1.6 : 0.7), 0, 1);
    damp += (tgtDamp - damp) * clamp(dt * (raining ? 0.7 : 0.18), 0, 1);
    world.storm = stormK;
    sun.intensity = 3.0 * (1 - 0.82 * stormK); sun.color.setRGB(1, 0.66 + 0.1 * stormK, 0.31 + 0.45 * stormK);
    hemi.intensity = 0.62 * (1 - 0.15 * stormK) + 0.1 * stormK; hemi.color.setRGB(0.81 - 0.2 * stormK, 0.85 - 0.12 * stormK, 1);
    renderer.toneMappingExposure = 0.92 - 0.12 * stormK;
    scene.fog.color.setRGB(0.88 - 0.35 * stormK, 0.72 - 0.25 * stormK, 0.54 - 0.12 * stormK);
    sun.position.copy(SUN_DIR).multiplyScalar(14).add(tmpV.set(0, panelY, 0)); sun.target.position.set(0, panelY, 0);
    const ext = Math.max(wallObj.W, wallObj.H) * CELL * 0.5 + 1.4;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext }); sun.shadow.camera.updateProjectionMatrix();
    world.leafGroup.position.set(0, panelY, 0).addScaledVector(SUN_DIR, 4.2);
    world.leafGroup.lookAt(tmpV.copy(world.leafGroup.position).addScaledVector(SUN_DIR, -1));

    // wall sync
    const f = {
      wall: wallObj, cells: view.cells, glaze: view.glaze, guide: view.guide, hintIdx: view.hintIdx, hintColor: view.hintColor, wrong: view.wrong, cursor: view.cursor,
      drops: [], drips: playing ? run.drips : null, damp,
    };
    if (playing && run.rain && run.ph === 'rain') {
      for (const d of run.rain.drops) if (d.st === 'warn') f.drops.push({ i: d.i, k: clamp((run.rain.t - d.t0) / d.warn, 0, 1) });
    }
    wall.sync(f, dt, clock);

    // events from cell diffs (paint dust, wipes) and drop states (shield, wash)
    if (playing) {
      if (lastRun !== run) { lastRun = run; prevCells = run.cells.slice(); prevDropSt = new Map(); }
      for (let i = 0; i < run.cells.length; i++) {
        if (run.cells[i] !== prevCells[i]) {
          const p = cellWorld(wallObj, i, panelY), c = run.cells[i];
          if (c) emit(p.x, p.y, 0.03, 3, { speed: 0.18, up: 0.12, life: 0.45, col: c === 1 ? '#f3ecd8' : c === 2 ? '#8d7a6c' : '#d9794e', size: 0.5, g: 1.5, sz: 0.4 });
          else if (prevCells[i] && run.ph !== 'rain') emit(p.x, p.y, 0.03, 4, { speed: 0.25, up: 0.1, life: 0.5, col: '#e8c9a0', size: 0.55, g: 1.2 });
          prevCells[i] = run.cells[i];
        }
      }
      if (run.rain) for (const d of run.rain.drops) {
        if (prevDropSt.get(d) !== d.st) {
          prevDropSt.set(d, d.st);
          const p = cellWorld(wallObj, d.i, panelY);
          if (d.st === 'shield') emit(p.x, p.y, 0.05, 12, { speed: 0.9, up: 0.9, life: 0.7, col: '#ffd86a', size: 0.7, g: 1.8 });
          else if (d.st === 'washed') { emit(p.x, p.y, 0.05, 16, { speed: 0.9, up: 0.5, life: 0.8, col: '#cfe6ff', size: 0.8, g: 4 }); emit(p.x, p.y - 0.02, 0.05, 10, { speed: 0.4, up: -0.1, life: 1.0, col: '#9a6a44', size: 1.0, g: 2 }); }
          else if (d.st === 'done') emit(p.x, p.y, 0.05, 6, { speed: 0.5, up: 0.4, life: 0.5, col: '#cfe6ff', size: 0.6, g: 4 });
        }
      }
    } else { lastRun = null; prevCells = null; }

    // camera
    const rect = v3.wallRect;
    if ((sc === 'play' || sc === 'result') && rect) frontalCamera(rect, panelY, wallObj.W, wallObj.H);
    else {
      const hr = v3.heroRect || { x: L.w * 0.06, y: L.h * 0.05, w: L.w * 0.88, h: L.h * 0.4 };
      const hw = wallObj.W * CELL / 2 + 0.55, hh = wallObj.H * CELL / 2 + 0.65;
      if (sc === 'title') orbitCamera(hr, hw, hh, panelY + 0.5, 12 * Math.sin(clock * 0.13), 6 + 2 * Math.sin(clock * 0.17), 32, 0.98);
      else orbitCamera({ x: L.w * 0.1, y: L.h * 0.08, w: L.w * 0.8, h: L.h * 0.4 }, hw, hh, panelY, 10 * Math.sin(clock * 0.1), 6, 30, 0.9);
    }

    if (qs.has('dev') && window.__dbgCam) { const c = window.__dbgCam; camera.clearViewOffset(); camera.fov = c.fov || 30; camera.near = 0.05; camera.far = 300; camera.updateProjectionMatrix(); if (c.rel && painter) { const t = painter.tip; camera.position.set(t.x + c.rel[0], t.y + c.rel[1], t.z + c.rel[2]); camera.lookAt(t.x + (c.at ? c.at[0] : 0), t.y + (c.at ? c.at[1] : 0), t.z + (c.at ? c.at[2] : 0)); } else { camera.position.set(...c.pos); camera.lookAt(...c.look); } camera.updateMatrixWorld(); }
    // falling droplets and the storm's streaks
    const halfH = camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    const yTop = camera.position.y + halfH + 0.2;
    let nd = 0;
    if (playing && run.rain && run.ph === 'rain') {
      for (const d of run.rain.drops) {
        if (d.st !== 'warn' || nd >= dropMesh.length) continue;
        const k = clamp((run.rain.t - d.t0) / d.warn, 0, 1), p = cellWorld(wallObj, d.i, panelY), yS = Math.min(yTop, p.y + 4.5), y = yS + (p.y - yS) * k * k;
        const m = dropMesh[nd], tr = dropTrail[nd]; m.visible = tr.visible = true; m.position.set(p.x, y, 0.1); tr.position.set(p.x, y + 0.3, 0.098); tr.scale.set(1, 0.4 + k, 1);
        nd++;
      }
    }
    for (let i = nd; i < dropMesh.length; i++) { dropMesh[i].visible = false; dropTrail[i].visible = false; }
    rainMat.opacity = 0.5 * stormK;
    rain.visible = stormK > 0.02;
    if (rain.visible) {
      const hw = halfH * camera.aspect + 1.2, hh = halfH + 0.6;
      for (let i = 0; i < RN; i++) {
        const r = rdrop[i]; r.y -= r.sp * dt / (2 * hh); if (r.y < 0) r.y += 1;
        _p.set(camera.position.x + (r.x - 0.5) * 2 * hw, camera.position.y + (r.y - 0.5) * 2 * hh, r.z);
        _q.setFromAxisAngle(tmpV.set(0, 0, 1), 0.12); _s.setScalar(1 + r.z * 0.25); _m.compose(_p, _q, _s); rain.setMatrixAt(i, _m);
      }
      rain.instanceMatrix.needsUpdate = true;
    }

    // the hand
    if (painter) {
      let tip = null, color = playing ? run.sel : 1;
      if (playing) {
        if (v3.stroke && !run.watch && mapU) { tip = pointToWorld(v3.stroke.x, v3.stroke.y); color = v3.stroke.color || run.sel; }
        else if (run.watch && run.ai && run.ph !== 'rain' && run.ph !== 'verdict') {
          const ai = run.ai;
          if (ai.plan && ai.plan.idx && ai.plan.idx.length && (ai.ph === 'act' || ai.ph === 'reveal')) {
            const idx = ai.ph === 'act' ? ai.plan.idx[Math.min(ai.plan.idx.length - 1, ai.k)] : ai.plan.idx[0];
            const p = cellWorld(wallObj, idx, panelY); if (ai.ph === 'act') tip = { x: p.x, y: p.y }; color = ai.plan.color || color;
          }
        }
      } else if (heroDemoTip != null) { const p = cellWorld(wallObj, heroDemoTip, panelY); tip = { x: p.x, y: p.y }; color = heroWall.target[heroDemoTip]; }
      if (!(qs.has('dev') && window.__dbgManualHand)) painter.update(tip, dt, clock, { color, flat: !playing });
    }
  }

  function scissorRect(c) {
    const k = W / L_.w;
    return { x: Math.round(c.x * k * dprNow), y: Math.round((H - (c.y + c.h) * k) * dprNow), w: Math.round(c.w * k * dprNow), h: Math.round(c.h * k * dprNow) };
  }
  function present(state, L, dt) {
    world.update(dt, camera, false);
    stepParts(dt);
    const pr = v3.pressed, hitBtn = (e) => !!pr && pr.x >= e.r.x && pr.x <= e.r.x + e.r.w && pr.y >= e.r.y && pr.y <= e.r.y + e.r.h && e.kind !== 'disabled';
    let n = 0, ns = 0, clipR = null;
    for (const e of v3.panels) { if (e.clip) { clipR = e.clip; placePanel(hudS, ns++, e); } else placePanel(hud, n++, e); }
    for (let i = n; i < hud.panels.length; i++) hud.panels[i].g.visible = false;
    for (let i = ns; i < hudS.panels.length; i++) hudS.panels[i].g.visible = false;
    n = 0; let nb = 0;
    for (const e of v3.buttons) { if (e.clip) { clipR = e.clip; placeButton(hudS, nb++, e, hitBtn(e)); } else placeButton(hud, n++, e, hitBtn(e)); }
    for (let i = n; i < hud.buttons.length; i++) hud.buttons[i].g.visible = false;
    for (let i = nb; i < hudS.buttons.length; i++) hudS.buttons[i].g.visible = false;
    v3.pots.forEach((e, i) => placePot(i, e, dt, clock));
    for (let i = v3.pots.length; i < pots.length; i++) if (pots[i]) pots[i].g.visible = false;
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, -520);
    renderer.setViewport(0, 0, W, H);
    renderer.setScissorTest(false);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud.scene, hudCam);
    if (clipR && (ns > 0 || nb > 0)) {
      const s = scissorRect(clipR);
      renderer.clearDepth();
      renderer.setScissorTest(true); renderer.setScissor(s.x, s.y, s.w, s.h);
      renderer.render(hudS.scene, hudCam);
      renderer.setScissorTest(false);
    }
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnvMap(); } catch (e) { /* no reflections, still playable */ }
    try { wall.rebuild(); } catch (e) { /* repaint on next frame */ }
    W = 0; resize(); v3.on = true;
  });

  try { buildEnvMap(); applyTier(); } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, wall, world,
    get handReady() { return handReady; },
    get painter() { return painter; },
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
          v3.panels.length = 0; v3.buttons.length = 0; v3.pots.length = 0; v3.scrim = 0; v3.wallRect = null; v3.heroRect = null; v3.wallView = null; v3.stroke = null; v3.clip = null;
          game.render(ctx, view);
          if (qs.has('dev') && window.__dbgNoUI) { v3.panels.length = 0; v3.buttons.length = 0; v3.pots.length = 0; ctx.clearRect(0, 0, L.w, L.h); }
          const now = performance.now(), dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          try { prepare(state, L, dt); present(state, L, dt); } catch (e) { console.warn('3D frame failed', e); v3.on = false; }
        },
      });
    },
  };
}
