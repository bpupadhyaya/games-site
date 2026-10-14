// Lo Shu 3D presenter. It READS the simulation state (game.getState()) and what view.js records in v3 (stones, gauges, cells,
// plaques, buttons; virtual units); it never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas:
// the dusk terrace by the river, the turtle-shell board with carved sockets, jade and cinnabar tablets, glowing gauges, then the
// lacquered plaques/buttons (screen space), then the tablets in hand (tray and drag) on top of the plaques.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { buildScenery } from '../vendor3d/index.js';
import { v3 } from '../src/v3.js';
import { sceneBoard, gaugePos } from '../src/view.js';
import { linesFor } from '../src/engine.js';
import { LOOKS, mix } from '../src/ui.js';
import { buildBoard, disposeGroup, makeStone, styleStone, gaugeMaterial, buildTerrace, buildScreen, halo, STONE_R, SEAT_Y, TOP_Y } from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, fx: true },
  { name: 'medium', dpr: 1.5, shadow: 1024, fx: true },
  { name: 'low', dpr: 1, shadow: 0, fx: false },
];
const css = (c) => new THREE.Color(c);
const rgbaOf = (str) => {
  if (!str) return null;
  if (str[0] === '#') return { c: css(str), a: 1 };
  const m = str.match(/rgba?\(([^)]+)\)/); if (!m) return null;
  const p = m[1].split(',').map((v) => parseFloat(v));
  return { c: new THREE.Color(`rgb(${Math.round(p[0])},${Math.round(p[1])},${Math.round(p[2])})`), a: p[3] ?? 1 };
};

const tick = () => new Promise((r) => setTimeout(r, 0));   // yield so the flat title paints and stays interactive while the 3D scene builds
export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  try { await Promise.race([Promise.all([document.fonts.load('700 48px Cinzel'), document.fonts.load('700 40px Fredoka')]), new Promise((r) => setTimeout(r, 1500))]); } catch { /* fonts optional */ }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.autoClear = false;
  renderer.setClearColor(0x0b0d18, 1);

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  await tick();
  // ---------------------------------------------------------------- world scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 400);
  const rig = B.lightingRig(scene, 'duskOutdoor', {
    renderer, shadow: TIERS[tier].shadow, extent: 9, fog: { near: 34, far: 130 },
    overrides: { bg: 0x1a1830, fog: 0x3a2f4a, key: 0xffc890, keyI: 2.5, keyPos: [-5, 11, 7], hemiSky: 0xffd0b0, hemiGround: 0x2a2640, hemi: 0.38, fill: 0x7f9be0, fillI: 0.55, fillPos: [7, 5, 8], rim: 0x9fb4ff, rimI: 1.7, rimPos: [4, 6, -8], exposure: 1.0, env: 0.5 },
  });
  B.createEnvironment(renderer, scene, { intensity: 0.5 });
  for (const l of rig.group.children) l.layers.enable(1);
  const lantern = new THREE.PointLight(0xffa860, 14, 22, 1.7); lantern.position.set(-4.5, 4.2, 3.5); lantern.layers.enable(1); scene.add(lantern);

  const terrace = buildTerrace(); scene.add(terrace.group);
  const screenSet = buildScreen(); scene.add(screenSet);
  let scenery = null;
  try {
    scenery = buildScenery({ preset: 'riverbank', timeOfDay: 'dusk', quality: TIERS[tier].name === 'high' ? 'medium' : 'low', wind: 0.4, clouds: 0.6 });
    scenery.group.scale.setScalar(2.6); scenery.group.position.set(0, -2.6, -60); scene.add(scenery.group);
    if (scenery.ready && scenery.ready.catch) scenery.ready.catch(() => {});
  } catch (e) { console.warn('scenery unavailable', e); scenery = null; }

  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  let boardGrp = null, boardKey = '', curDims = null;
  const glowTex = halo('255,255,255', 128);
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,0.4)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 34, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.55, 'rgba(255,255,255,0.95)'); r.addColorStop(0.7, 'rgba(255,255,255,0.4)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();

  function dimsFor(sb) {
    const b = sb.b, s = b.s, fcx = b.x + b.w / 2, fcy = b.y + b.h / 2, n = sb.n;
    const d = { fw: b.w / s, fd: b.h / s, n, pan: sb.pan, grid: { cx: (b.gx + b.G / 2 - fcx) / s, cz: (b.gy + b.G / 2 - fcy) / s, size: b.G / s }, banner: null, gauges: [], fcx, fcy, s };
    if (!sb.pan && b.banner) d.banner = { x: (b.banner.x + b.banner.w / 2 - fcx) / s, z: (b.banner.y + b.banner.h / 2 - fcy) / s, w: b.banner.w / s, d: b.banner.h / s };
    if (b.gauges && b.gauges.r) for (const ln of linesFor(n, sb.pan)) { const p = gaugePos(b, sb.pan, ln); d.gauges.push({ id: ln.id, x: (p.x - fcx) / s, z: (p.y - fcy) / s, r: b.gauges.r / s }); }
    return d;
  }
  const dimsKey = (d, look) => [look, d.n, d.pan ? 1 : 0, d.fw.toFixed(2), d.fd.toFixed(2), d.grid.cx.toFixed(2), d.grid.cz.toFixed(2), d.grid.size.toFixed(2), d.banner ? 1 : 0, d.gauges.length].join('|');
  function ensureBoard(d, look) {
    const key = dimsKey(d, look);
    if (boardGrp && key === boardKey) { curDims = Object.assign(boardGrp.userData.dims, { fcx: d.fcx, fcy: d.fcy, s: d.s }); return; }
    if (boardGrp) { boardRoot.remove(boardGrp); disposeGroup(boardGrp); }
    boardGrp = buildBoard(d, look); boardRoot.add(boardGrp); boardKey = key; curDims = d;
    screenSet.position.set(0, 0, -(d.fd / 2 + 1.4));
    buildCellMarks(d);
  }

  // cell markers + gauge faces (dynamic parts of the board)
  const markRoot = new THREE.Group(); scene.add(markRoot);
  let cellMarks = [], gaugeMeshes = new Map();
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const mkQuad = (map, color, order) => { const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 })); m.renderOrder = order; return m; };
  function buildCellMarks(d) {
    for (const m of cellMarks) markRoot.remove(m.glow, m.ring, m.err);
    cellMarks = [];
    for (let i = 0; i < d.n * d.n; i++) {
      const glow = mkQuad(glowTex, 0xffd36b, 4), ring = mkQuad(ringTex, 0xffe9a0, 5), err = mkQuad(ringTex, 0xff5a46, 5);
      const sc = d.grid.size / d.n, X = d.grid.cx - d.grid.size / 2 + (i % d.n + 0.5) * sc, Z = d.grid.cz - d.grid.size / 2 + (Math.floor(i / d.n) + 0.5) * sc;
      for (const q of [glow, ring, err]) { q.position.set(X, SEAT_Y + 0.045, Z); q.scale.setScalar(sc); markRoot.add(q); }
      cellMarks.push({ glow, ring, err, X, Z });
    }
    for (const g of gaugeMeshes.values()) markRoot.remove(g.face, g.halo);
    gaugeMeshes = new Map();
    for (const g of d.gauges) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(g.r * 0.96, 40), gaugeMaterial(0, 'part', false)); face.rotation.x = -Math.PI / 2; face.position.set(g.x, SEAT_Y + 0.075, g.z);
      const hl = mkQuad(ringTex, 0xffd36b, 5); hl.position.set(g.x, SEAT_Y + 0.1, g.z); hl.scale.setScalar(g.r * 3);
      markRoot.add(face, hl); gaugeMeshes.set(g.id, { face, halo: hl, g, prevPulse: 0 });
    }
  }

  await tick();
  // ---------------------------------------------------------------- stones
  const stones = new Map();
  function stoneFor(v) {
    let st = stones.get(v);
    if (!st) {
      const group = makeStone(blobTex); scene.add(group);
      st = { group, x: 0, y: 0, z: 0, s: 1, init: false, fg: false, settleT: 9, ring: 0, lastCell: -2, landed: false };
      stones.set(v, st);
    }
    return st;
  }
  const setLayer = (grp, layer) => grp.traverse((o) => o.layers.set(layer));

  await tick();
  // ---------------------------------------------------------------- particles (instanced sparks)
  const NP = 120;
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 6, 5), sparkMat, NP);
  sparks.frustumCulled = false; scene.add(sparks);
  const parts = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(0xffffff);
  for (let i = 0; i < NP; i++) sparks.setColorAt(i, _c);
  function burst(x, y, z, n, col = '#ffd878', up = 1.8, spread = 1) {
    const c = css(col);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + i * 0.7, sp = (0.7 + ((i * 37) % 10) * 0.12) * spread;
      parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: up + ((i * 13) % 7) * 0.25, vz: Math.sin(a) * sp, life: 0, max: 0.55 + ((i * 7) % 5) * 0.1, c });
    }
    if (parts.length > NP) parts.splice(0, parts.length - NP);
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt; p.vy -= 6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < TOP_Y && p.vy < 0) { p.y = TOP_Y; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      if (p.life >= p.max) parts.splice(i, 1);
    }
    for (let i = 0; i < NP; i++) {
      const p = parts[i];
      if (!p) _m.makeScale(0, 0, 0); else { const k = 1 - p.life / p.max; _p.set(p.x, p.y, p.z); _s.setScalar(0.5 + k); _m.compose(_p, _q, _s); sparks.setColorAt(i, p.c); }
      sparks.setMatrixAt(i, _m);
    }
    sparks.instanceMatrix.needsUpdate = true; if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true;
  }

  await tick();
  // ---------------------------------------------------------------- HUD (screen space, virtual units, y down)
  const hud = new THREE.Scene();
  const hudCam = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000); hudCam.position.z = 600;
  hud.add(new THREE.HemisphereLight(0xfff2de, 0x403850, 0.55));
  const hudKey = new THREE.DirectionalLight(0xfff0d8, 2.4); hudKey.position.set(-500, 700, 900); hud.add(hudKey);
  const hudFill = new THREE.DirectionalLight(0x9fb4ff, 0.7); hudFill.position.set(600, -200, 500); hud.add(hudFill);
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x07080f, transparent: true, opacity: 0, depthWrite: false }));
  scrim.position.z = -900; scrim.renderOrder = -1; hud.add(scrim);
  const hudBack = new THREE.Group(); hud.add(hudBack);
  const hudClip = new THREE.Group(); hud.add(hudClip);
  const geoCache = new Map();
  function slabGeo(w, d, h, r, bevel) {
    const key = `${Math.round(w)}|${Math.round(d)}|${Math.round(h)}|${Math.round(r)}|${Math.round(bevel * 10)}`;
    let g = geoCache.get(key);
    if (!g) {
      const ww = Math.max(2, Math.round(w)), dd = Math.max(2, Math.round(d));
      g = B.slab(ww, dd, h, Math.min(r, ww / 2, dd / 2), Math.min(bevel, h / 2.2, ww / 2.2, dd / 2.2));
      geoCache.set(key, g);
      if (geoCache.size > 240) { const k = geoCache.keys().next().value; geoCache.get(k).dispose(); geoCache.delete(k); }
    }
    return g;
  }
  const matCache = new Map();
  const plaqueMat = (key, make) => { let m = matCache.get(key); if (!m) { m = make(); matCache.set(key, m); } return m; };
  const hudPool = []; let hudN = 0;
  function placePlaque(parent, r, z, thick, radius, bevel, mat) {
    let m = hudPool[hudN];
    if (!m) { m = new THREE.Mesh(slabGeo(10, 10, 4, 4, 1), mat); m.rotation.x = Math.PI / 2; hudPool.push(m); }
    hudN++; m.visible = true; parent.add(m);
    m.geometry = slabGeo(r.w, r.h, thick, radius, bevel); m.material = mat;
    m.position.set(r.x + r.w / 2, -(r.y + r.h / 2), z);
    return m;
  }
  function drawPlaques(state, pressed) {
    hudN = 0;
    for (const m of hudPool) { if (m.parent) m.parent.remove(m); m.visible = false; }
    const lk = state.prefs.look, T = LOOKS[lk] ?? LOOKS.jade;
    const base = T.dark ? mix(T.bg0, '#000000', 0.45) : mix(T.bg0, T.frame, 0.45);
    const baseMat = plaqueMat('base|' + lk, () => new THREE.MeshPhysicalMaterial({ color: css(base), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2, metalness: 0.05, envMapIntensity: 0.9 }));
    const rimMat = plaqueMat('rim|' + lk, () => new THREE.MeshStandardMaterial({ color: css(T.rim), metalness: 1, roughness: 0.32, envMapIntensity: 1.5 }));
    const items = [];
    for (const p of v3.panels) items.push({ k: 'p', o: p });
    for (const b of v3.buttons) items.push({ k: 'b', o: b });
    items.sort((a, b) => (a.o.z - b.o.z));
    let idx = 0;
    for (const it of items) {
      const o = it.o, parent = o.clip ? hudClip : hudBack, z = o.z * 60 + (idx++) * 0.05;
      if (o.clip) { const c = o.clip; if (o.r.y + o.r.h < c.y - 4 || o.r.y > c.y + c.h + 4) continue; }
      if (it.k === 'p') {
        const tn = rgbaOf(o.tint);
        if (o.z === 0.5) {   // a recess (socket, gauge seat, tray slot)
          const mat = plaqueMat('rec|' + o.tint, () => new THREE.MeshStandardMaterial({ color: tn ? tn.c : css('#050807'), roughness: 0.7, metalness: 0 }));
          placePlaque(parent, o.r, z, 3, o.radius, 1, mat);
          continue;
        }
        const mat = tn ? plaqueMat('pt|' + o.tint + lk, () => new THREE.MeshPhysicalMaterial({ color: css(mix(base, '#' + tn.c.getHexString(), tn.a)), roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 0.8 })) : baseMat;
        placePlaque(parent, { x: o.r.x - 2.5, y: o.r.y - 2.5, w: o.r.w + 5, h: o.r.h + 5 }, z, 7, o.radius + 2.5, 2.5, rimMat);
        placePlaque(parent, o.r, z + 0.01, 10, o.radius, 3, mat);
      } else {
        const pr = pressed && pressed.x >= o.r.x && pressed.x <= o.r.x + o.r.w && pressed.y >= o.r.y && pressed.y <= o.r.y + o.r.h && !o.disabled;
        const acc = o.kind === 'accent';
        const mat = acc
          ? plaqueMat('ba|' + lk, () => new THREE.MeshPhysicalMaterial({ color: css(T.accent), roughness: 0.28, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1, emissive: css(T.accent), emissiveIntensity: 0.08, envMapIntensity: 0.45 }))
          : plaqueMat('bs|' + lk, () => new THREE.MeshPhysicalMaterial({ color: css(T.dark ? mix(T.bg0, '#000000', 0.25) : mix(T.bg0, T.frame, 0.25)), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, metalness: 0.05, envMapIntensity: 0.9 }));
        const th = pr ? 5 : 12;
        if (o.active) placePlaque(parent, { x: o.r.x - 4, y: o.r.y - 4, w: o.r.w + 8, h: o.r.h + 8 }, z - 0.01, 8, o.radius + 4, 3, plaqueMat('act|' + lk, () => new THREE.MeshBasicMaterial({ color: css(T.good) })));
        placePlaque(parent, { x: o.r.x - 2, y: o.r.y - 2, w: o.r.w + 4, h: o.r.h + 4 }, z, 6, o.radius + 2, 2, rimMat);
        placePlaque(parent, { x: o.r.x + (pr ? 1.5 : 0), y: o.r.y + (pr ? 2 : 0), w: o.r.w, h: o.r.h }, z + 0.02, th, o.radius, 3.5, mat);
        if ((o.flash || 0) > 0) placePlaque(parent, o.r, z + 0.04 + th, 1, o.radius, 0.4, plaqueMat('fl', () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })));
      }
    }
  }
  const clipPlanes = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane()];

  await tick();
  // ---------------------------------------------------------------- camera
  let W = 1, H = 1, dprNow = 1, L_ = null, clock = 0, lastT = 0, frames = 0, ema = 16, calm = false;
  const tmp = new THREE.Vector3(), ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3();
  let corners = [];
  function fitCamera(rect, pitchDeg, fov, yawDeg = 0, fill = 1, lookY = 0.25) {
    const k = W / L_.w, tw = rect.w * k * fill, th = rect.h * k * fill, p = (pitchDeg * Math.PI) / 180, yw = (yawDeg * Math.PI) / 180;
    camera.fov = fov; camera.aspect = W / H; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const place = (d) => { camera.position.set(Math.sin(yw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yw) * Math.cos(p) * d); camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); };
    const extent = (d) => {
      place(d); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of corners) { tmp.copy(c).project(camera); const px = ((tmp.x + 1) / 2) * W, py = ((1 - tmp.y) / 2) * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
      return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    };
    let lo = 2, hi = 150;
    for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2, e = extent(mid); if (e.w > tw || e.h > th) lo = mid; else hi = mid; }
    const e = extent(hi), cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W, H, e.cx - cxp, e.cy - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z) => { tmp.set(x, y, z).project(camera); return { x: ((tmp.x + 1) / 2) * L_.w, y: ((1 - tmp.y) / 2) * L_.h }; };
  function unproject(vx, vy, planeY) {
    orig.copy(camera.position); ray.set((vx / L_.w) * 2 - 1, 1 - (vy / L_.h) * 2, 0.5).unproject(camera).sub(orig).normalize();
    const dy = ray.y || -1e-5, t = (planeY - orig.y) / dy; hitV.copy(orig).addScaledVector(ray, t);
    return { X: hitV.x, Z: hitV.z };
  }
  v3.proj = (vx, vy) => {
    if (!curDims || !L_) return { x: vx, y: vy, k: 1 };
    const d = curDims, X = (vx - d.fcx) / d.s, Z = (vy - d.fcy) / d.s, a = toVirt(X, SEAT_Y + 0.08, Z), b1 = toVirt(X - 0.5, SEAT_Y + 0.08, Z), b2 = toVirt(X + 0.5, SEAT_Y + 0.08, Z);
    return { x: a.x, y: a.y, k: Math.abs(b2.x - b1.x) / d.s };
  };
  v3.pick = (vx, vy) => {
    if (!curDims || !L_) return -1;
    const d = curDims, h = unproject(vx, vy, TOP_Y), sc = d.grid.size / d.n;
    const c = Math.floor((h.X - (d.grid.cx - d.grid.size / 2)) / sc), r = Math.floor((h.Z - (d.grid.cz - d.grid.size / 2)) / sc);
    if (c < 0 || c >= d.n || r < 0 || r >= d.n) return -1;
    return r * d.n + c;
  };

  await tick();
  // ---------------------------------------------------------------- frame
  const flashCell = new Map();
  const cellXZ = (i) => { const d = curDims, sc = d.grid.size / d.n; return { X: d.grid.cx - d.grid.size / 2 + (i % d.n + 0.5) * sc, Z: d.grid.cz - d.grid.size / 2 + (Math.floor(i / d.n) + 0.5) * sc }; };
  const lookOf = (state) => (LOOKS[state.prefs.look] ? state.prefs.look : 'jade');

  function prepare(state, L) {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
    L_ = L; calm = !!state.prefs.calm;
    const sc = state.scene; v3.scene = sc;
    let sb = sceneBoard(state, L.w, L.h), rect;
    const hasBoard = !!sb;
    if (!sb) {   // text screens: a small display board stands on the terrace behind the plaques
      const gs = Math.min(L.w, L.h) * 0.8, x0 = (L.w - gs) / 2, y0 = L.h * 0.1, pad = gs * 0.07, cs = (gs - 2 * pad) / 3;
      const b = { x: x0, y: y0, w: gs, h: gs, gx: x0 + pad, gy: y0 + pad, G: 3 * cs, s: cs, n: 3, bd: 0, banner: null, gauges: { r: 0 } };
      sb = { b, n: 3, pan: false, M: 15, scene: 'display', hero: true };
    }
    v3.board = hasBoard ? sb : null;
    const d = dimsFor(sb); ensureBoard(d, lookOf(state));
    corners = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, 0.62]) corners.push(new THREE.Vector3(sx * (d.fw / 2 + 0.2), y, sz * (d.fd / 2 + 0.2)));
    if (sb.scene === 'play' || sb.scene === 'over') {
      rect = { x: sb.b.x, y: sb.b.y, w: sb.b.w, h: sb.b.h };
      fitCamera(rect, L.land ? 54 : 60, 28, 0, 1);
    } else if (sb.scene === 'title') {
      rect = { x: sb.b.x - sb.b.w * 0.04, y: sb.b.y + sb.b.h * 0.5, w: sb.b.w * 1.08, h: sb.b.h * 0.5 };
      fitCamera(rect, L.land ? 24 : 21, 28, calm ? 0 : Math.sin(clock * 0.22) * 4, 1, 0.9);
    } else {
      rect = { x: L.w * 0.1, y: L.h * 0.02, w: L.w * 0.8, h: L.h * 0.34 };
      fitCamera(rect, 30, 30, calm ? 0 : Math.sin(clock * 0.15) * 7, 1);
    }
    scene.background = css((LOOKS[state.prefs.look] ?? LOOKS.jade).dark ? '#14122a' : '#3b3150');
    camera.layers.set(0);
  }

  const bounceEnv = (age) => (age < 0.45 ? Math.sin(age * TAU * 2.2) * Math.exp(-age * 7) * 0.09 : 0);
  function present(state, L, dt) {
    const T = LOOKS[state.prefs.look] ?? LOOKS.jade, look = lookOf(state), style = state.prefs.numerals;
    const showCells = !!v3.board;
    for (let i = 0; i < cellMarks.length; i++) {
      const cm = cellMarks[i], c = showCells ? v3.cells[i] : null;
      let k = c ? c.k : 0; const fl = flashCell.get(i) || 0; k = Math.max(k, fl);
      cm.glow.material.opacity = clamp(k * 0.55, 0, 0.9); cm.glow.material.color.set(fl > 0.1 ? '#fff0a0' : T.sel);
      const pulse = 0.5 + 0.5 * Math.sin(clock * 5);
      cm.ring.material.opacity = c && (c.sel || c.hover) ? 0.55 + pulse * 0.4 : 0; cm.ring.scale.setScalar((curDims.grid.size / curDims.n) * (1.15 + (c && c.hover ? 0.1 : 0)));
      cm.err.material.opacity = c && c.mistake ? 0.7 + pulse * 0.3 : 0;
    }
    for (const [i, v] of flashCell) { const nv = v - dt * 1.1; if (nv <= 0) flashCell.delete(i); else flashCell.set(i, nv); }
    // gauges
    const seen = new Set();
    if (v3.board && v3.board.scene !== 'title') for (const g of v3.gauges) {
      const gm = gaugeMeshes.get(g.id); if (!gm) continue; seen.add(g.id);
      gm.face.visible = true; gm.face.material = gaugeMaterial(g.M ? g.sum / g.M : 0, g.state, g.hot);
      const pulse = g.pulse || 0;
      gm.halo.material.opacity = g.state === 'ok' ? 0.5 + 0.3 * Math.sin(clock * 3) : pulse * 0.9; gm.halo.material.color.set(g.state === 'over' ? 0xff6b57 : 0xffd36b);
      if (pulse > 0.05 && gm.prevPulse <= 0.05 && g.state === 'ok') {
        burst(gm.g.x, SEAT_Y + 0.25, gm.g.z, 14, '#ffe27a', 1.6, 0.9);
        if (g.cells) for (const c of g.cells) { flashCell.set(c, 1); const { X, Z } = cellXZ(c); burst(X, TOP_Y + 0.15, Z, 6, '#ffd36b', 1.2, 0.5); }
      }
      gm.prevPulse = pulse;
    }
    for (const [id, gm] of gaugeMeshes) if (!seen.has(id)) { gm.face.visible = false; gm.halo.material.opacity = 0; gm.prevPulse = 0; }
    // stones
    const used = new Set();
    const wScale = (vx, vy) => { const a = unproject(vx, vy, 0.12).X, b = unproject(vx + 20, vy, 0.12).X; return Math.abs(b - a) / 20; };
    for (const e of v3.stones) {
      if (e.v === undefined || e.v === null || e.v < 0) continue;
      used.add(e.v);
      const st = stoneFor(e.v), g = st.group;
      styleStone(g, e.v, e.kind, look, e.style ?? style);
      let tx = 0, tz = 0, ty = 0, ts = 1, fg = false, omega = 15, lift = 0;
      if (e.where === 'cell' || e.where === 'ghost') {
        const p = cellXZ(e.cell); tx = p.X; tz = p.Z; ty = SEAT_Y; lift = (e.lift || 0) * 0.35;
        if (e.pop >= 0) lift += Math.sin(Math.PI * e.pop) * 0.12;
        ts = (e.appear !== undefined ? 0.2 + 0.8 * e.appear : 1);
        if (e.shake >= 0) tx += Math.sin(e.shake * 70) * 0.05 * (1 - e.shake / 0.4);
      } else {
        const p = unproject(e.x, e.y, e.where === 'drag' ? 0.7 : 0.02), ws = wScale(e.x, e.y);
        tx = p.X; tz = p.Z; ts = (e.r * ws) / STONE_R * (e.where === 'drag' ? 1.12 : 1); ty = e.where === 'drag' ? 0.5 : 0.02; lift = e.where === 'tray' ? (e.lift || 0) * 0.3 : 0;
        fg = true; omega = e.where === 'drag' ? 32 : 17;
      }
      if (!st.init) { st.x = tx; st.z = tz; st.y = ty; st.s = ts; st.init = true; st.fg = fg; st.landed = true; st.lastCell = e.where === 'cell' ? e.cell : -2; setLayer(g, fg ? 1 : 0); }
      const px = st.x, pz = st.z, a = 1 - Math.exp(-omega * dt);
      st.x += (tx - st.x) * a; st.z += (tz - st.z) * a; st.y += (ty - st.y) * (1 - Math.exp(-22 * dt)); st.s += (ts - st.s) * (1 - Math.exp(-20 * dt));
      const dist = Math.hypot(tx - st.x, tz - st.z), speed = Math.hypot(st.x - px, st.z - pz) / Math.max(dt, 1e-3);
      const air = e.where === 'ghost' ? 0 : clamp(dist * 0.33, 0, 0.7) + clamp(speed * 0.02, 0, 0.18);
      // pass: tablets in hand and in flight draw above the plaques; settled ones live in the board scene
      const wantFg = fg || (e.where === 'cell' && dist > 0.35);
      if (wantFg !== st.fg) { st.fg = wantFg; setLayer(g, wantFg ? 1 : 0); }
      // landing click: ring + puff + squash
      if (e.where === 'cell' && st.lastCell !== e.cell) { st.lastCell = e.cell; st.settleT = 0; st.landed = false; }
      if (e.where !== 'cell') { st.lastCell = -2; st.landed = false; }
      if (e.where === 'cell' && !st.landed && dist < 0.06) { st.landed = true; st.settleT = 0; st.ring = 1; if (!e.appear) burst(st.x, SEAT_Y + 0.14, st.z, 8, '#fff0b0', 0.9, 0.5); }
      st.settleT += dt; st.ring = Math.max(0, st.ring - dt * 2.2);
      const squash = e.where === 'cell' ? bounceEnv(st.settleT) : 0;
      const yy = st.y + air + lift + (e.where === 'drag' ? 0.2 + Math.sin(clock * 6) * 0.01 : 0) + Math.max(0, squash);
      g.visible = true; g.position.set(st.x, yy, st.z);
      const u = g.userData, sx = st.s * (1 + Math.max(0, -squash) * 0.4);
      u.pivot.scale.set(sx, st.s * (1 - Math.abs(squash) * 0.5), sx);
      u.pivot.rotation.set(e.where === 'drag' ? Math.sin(clock * 5) * 0.06 : 0, 0, e.where === 'drag' ? Math.cos(clock * 4) * 0.06 : 0);
      const h = yy - st.y;   // shadow stays on the surface below
      u.shadow.position.set(0, -h + 0.012, 0); u.shadow.scale.setScalar(STONE_R * 2.7 * st.s * (1 - clamp(h * 0.35, 0, 0.45)));
      u.shadow.material.opacity = 0.7 * (1 - clamp(h * 0.8, 0, 0.6)) * (e.where === 'ghost' ? 0.3 : 1);
      u.ring.position.y = -h + 0.012;
      u.ring.material.opacity = clamp((e.glow || 0) * 0.8 + st.ring * 0.9, 0, 1); u.ring.material.color.set(e.tint ? e.tint : T.sel); u.ring.scale.setScalar(st.s * (1 + st.ring * 0.25));
      const mat = u.body.material;
      mat.emissiveIntensity = 0.22 + clamp(e.glow || 0, 0, 1) * 0.35;
      u.body.visible = true; u.decal.visible = true;
      if (e.where === 'ghost') u.pivot.scale.multiplyScalar(0.96 + 0.04 * Math.sin(clock * 5));
    }
    for (const [v, st] of stones) if (!used.has(v)) { st.group.visible = false; st.landed = false; st.lastCell = -2; }
    screenSet.visible = !(v3.board && (v3.board.scene === 'play' || v3.board.scene === 'over'));
    // ambience
    const t = clock, vis = TIERS[tier].fx;
    lantern.intensity = 14 * (1 + (calm ? 0 : 0.06 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 13.1)));
    terrace.update(t, calm || !vis);
    if (scenery) scenery.update(dt, camera);
    stepParts(dt);
    // three passes: world, plaques, tablets in hand
    renderer.setViewport(0, 0, W, H);
    renderer.clear();
    renderer.shadowMap.autoUpdate = true;
    camera.layers.set(0); renderer.render(scene, camera);
    drawPlaques(state, v3.pressed);
    hudCam.left = 0; hudCam.right = L.w; hudCam.top = 0; hudCam.bottom = -L.h; hudCam.updateProjectionMatrix();
    const sc0 = state.scene, scr = sc0 === 'doc' || sc0 === 'settings' || sc0 === 'journey' || sc0 === 'free' || sc0 === 'stats' ? 0.8 : sc0 === 'over' ? 0.35 : sc0 === 'demo-limit' ? 0.6 : 0;
    scrim.scale.set(L.w * 1.2, L.h * 1.2, 1); scrim.position.set(L.w / 2, -L.h / 2, -900); scrim.material.opacity = scr; scrim.visible = scr > 0;
    hud.environment = scene.environment; hud.environmentIntensity = 0.22;
    renderer.clearDepth();
    hudClip.visible = false; hudBack.visible = true; renderer.render(hud, hudCam);
    if (hudClip.children.length) {
      let c = null; for (const p of v3.panels) if (p.clip) { c = p.clip; break; } if (!c) for (const p of v3.buttons) if (p.clip) { c = p.clip; break; }
      if (c) {
        clipPlanes[0].set(new THREE.Vector3(0, 1, 0), c.y + c.h); clipPlanes[1].set(new THREE.Vector3(0, -1, 0), -c.y);
        clipPlanes[2].set(new THREE.Vector3(1, 0, 0), -c.x); clipPlanes[3].set(new THREE.Vector3(-1, 0, 0), c.x + c.w);
        renderer.clippingPlanes = clipPlanes; hudBack.visible = false; hudClip.visible = true; renderer.render(hud, hudCam); renderer.clippingPlanes = [];
      }
    }
    renderer.clearDepth();
    const bg = scene.background; scene.background = null; renderer.shadowMap.autoUpdate = false;
    camera.layers.set(1); renderer.render(scene, camera); camera.layers.set(0);
    scene.background = bg; renderer.shadowMap.autoUpdate = true;
  }

  await tick();
  // ---------------------------------------------------------------- stone sprites for 2D contexts (journey, rules figures)
  function bakeSprites() {
    const SZ = 256, c2 = document.createElement('canvas'); c2.width = c2.height = SZ;
    let r2;
    try { r2 = new THREE.WebGLRenderer({ canvas: c2, antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { return; }
    r2.setPixelRatio(1); r2.setSize(SZ, SZ, false); r2.outputColorSpace = THREE.SRGBColorSpace; r2.toneMapping = THREE.ACESFilmicToneMapping; r2.toneMappingExposure = 0.9;
    const sc = new THREE.Scene(), e2 = B.createEnvironment(r2, sc, { intensity: 0.7 });
    const px = 100 / STONE_R, half = SZ / 2 / px, pitch = (55 * Math.PI) / 180;
    const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 40);
    cam.position.set(0, Math.sin(pitch) * 10, Math.cos(pitch) * 10); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
    const k = new THREE.DirectionalLight(0xfff0d6, 2.1); k.position.set(-3, 6, 5);
    const f = new THREE.DirectionalLight(0x9fc4ff, 0.9); f.position.set(5, 3, -2);
    sc.add(new THREE.HemisphereLight(0xfff0dc, 0x4a3a30, 0.6), k, f);
    for (const lookId of Object.keys(LOOKS)) {
      v3.sprites[lookId] = {};
      for (const kind of ['stone', 'given']) {
        const g = makeStone(blobTex); styleStone(g, 5, kind, lookId, 'digits'); g.userData.decal.visible = false; g.userData.shadow.visible = false; g.userData.ring.visible = false;
        sc.add(g); r2.setClearColor(0x000000, 0); r2.clear(); r2.render(sc, cam);
        const out = document.createElement('canvas'); out.width = out.height = SZ; out.getContext('2d').drawImage(c2, 0, 0); v3.sprites[lookId][kind] = out; sc.remove(g);
      }
    }
    e2.dispose(); r2.dispose(); try { r2.forceContextLoss(); } catch { /* ok */ }
  }

  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; rig.key.castShadow = t.shadow > 0;
    if (t.shadow) { rig.key.shadow.mapSize.set(t.shadow, t.shadow); if (rig.key.shadow.map) { rig.key.shadow.map.dispose(); rig.key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) { const m = o.material; if (Array.isArray(m)) m.forEach((x) => { x.needsUpdate = true; }); else m.needsUpdate = true; } });
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { W = 0; applyTier(); hud.environment = scene.environment; v3.on = true; });   // B.createEnvironment rebuilds scene.environment itself

  try { applyTier(); bakeSprites(); }
  catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  await tick();
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* first frame compiles instead */ }
  v3.on = true; v3.ready = true;

  return {
    ok: true, renderer, scene, camera, rig, terrace, stones, hud,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const vw = view?.width ?? 720, vh = view?.height ?? 1560, Lf = { w: vw, h: vh, land: vw >= vh };
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          try { prepare(state, Lf); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, Lf, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
