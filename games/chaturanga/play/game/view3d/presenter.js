// Chaturanga 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: palace courtyard, carved board and sculpted pieces; the 2D layer draws text, badges and buttons on top.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; restored -> back to 3D, no reload.
import { board3d as B, THREE } from '../vendor3d/index.js';
import { v3, sprites } from '../src/v3.js';
import { applyLayout, W, H, BOARD, LAY, titleRows } from '../src/layout.js';
import { buildPiece, buildBoard, buildCourt, buildRug, buildLamp, buildDiya, mats, glowTexture, dotTexture, squareGlowTexture, TILE_TOP, BOARD_W, BOARD_LOOKS, PIECE_H } from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const BACK = [4, 2, 3, 5, 6, 3, 2, 4];     // a..h : Ratha Ashva Gaja Mantri Raja Gaja Ashva Ratha
const EMPTY = new Array(64).fill(0);
export const START_BOARD = (() => { const b = new Array(64).fill(0); for (let f = 0; f < 8; f++) { b[f] = BACK[f]; b[8 + f] = 1; b[48 + f] = -1; b[56 + f] = -BACK[f]; } return b; })();
const LIFT = { 1: 0.42, 2: 0.95, 3: 0.85, 4: 0.28, 5: 0.5, 6: 0.55 };

export async function createPresenter({ kitCanvas, meta, quality = 'high' }) {
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
  renderer.setClearColor(0x120804, 1);

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(16, 1, 1, 600);
  let rig, env, boardGrp = null, boardLook = '', rug = null;
  mats();
  const root = new THREE.Group(); scene.add(root);
  const pieceRoot = new THREE.Group(); scene.add(pieceRoot);
  const markRoot = new THREE.Group(); scene.add(markRoot);
  const fxRoot = new THREE.Group(); scene.add(fxRoot);

  // ------------------------------------------------------------ set dressing and lights
  const court = buildCourt(); scene.add(court);
  const flames = [];
  const glowT = glowTexture('255,190,100'), flameT = glowTexture('255,235,170', 96);
  function addLamp(x, z, tall) {
    const l = tall ? buildLamp(2.4) : buildDiya();
    l.group.position.set(x, 0, z); scene.add(l.group);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameT, color: 0xffcf80, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.scale.set(0.55, 0.8, 1); sp.position.set(x, l.flameY + 0.18, z); scene.add(sp);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0xff9a40, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    halo.scale.set(3.2, 3.2, 1); halo.position.set(x, l.flameY + 0.2, z); scene.add(halo);
    const pl = new THREE.PointLight(0xff9a48, 14, 16, 2); pl.position.set(x, l.flameY + 0.25, z); scene.add(pl);
    flames.push({ sp, halo, pl, base: tall ? 16 : 9, ph: x * 1.7 + z });
  }
  addLamp(-5.8, -5.6, true); addLamp(5.8, -5.6, true);
  addLamp(-5.4, 3.9, false); addLamp(5.4, 3.9, false);
  // drifting dust motes in the lamp light
  const MOTES = 90, moteGeo = new THREE.BufferGeometry(), motePos = new Float32Array(MOTES * 3), moteSeed = [];
  { let s = 7; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < MOTES; i++) { motePos[i * 3] = r() * 16 - 8; motePos[i * 3 + 1] = 0.5 + r() * 4.5; motePos[i * 3 + 2] = r() * 14 - 6; moteSeed.push(r() * 6); } }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: glowT, size: 0.2, color: 0xffd9a0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  motes.frustumCulled = false; scene.add(motes);

  function buildLights() {
    if (rig) rig.dispose();
    rig = B.lightingRig(scene, 'warmIndoor', {
      renderer, shadow: TIERS[tier].shadow, extent: 6.2, fog: { near: 140, far: 330 }, target: [0, 0.3, 0],
      overrides: { bg: 0x150a06, fog: 0x2a140c, hemiSky: 0xffd8b0, hemiGround: 0x3a1a10, hemi: 0.5, key: 0xffd2a0, keyI: 2.5, keyPos: [-5, 11, 7], fill: 0xc9b4ff, fillI: 0.4, fillPos: [7, 4, 6], rim: 0xff8c52, rimI: 1.7, rimPos: [4, 5, -8], exposure: 1.05, env: 0.38 },
    });
  }
  env = B.createEnvironment(renderer, scene, { intensity: 0.4 });
  buildLights();

  let CW = 0, CH = 0;
  function resize(force) {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    if (!force && w === CW && h === CH) return;
    CW = w; CH = h; renderer.setSize(w, h, false); camera.aspect = w / h;
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(t.dpr, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = t.shadow > 0;
    if (rig) {
      rig.key.castShadow = t.shadow > 0;
      if (t.shadow) { rig.key.shadow.mapSize.set(t.shadow, t.shadow); if (rig.key.shadow.map) { rig.key.shadow.map.dispose(); rig.key.shadow.map = null; } }
    }
    scene.traverse((o) => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.needsUpdate = true; }); });
    resize(true);
  }

  // ------------------------------------------------------------ camera fit + projection
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  // Place the board so its near edge is `nearW` virtual px wide and its centre sits at virtual (cx, cy).
  function fit(cx, cy, nearW, pitchDeg, yawDeg, lookY = TILE_TOP, fov = 15) {
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = CW / CH;
    const k = CW / W, target = nearW * k, p = (pitchDeg * Math.PI) / 180, yw = (yawDeg * Math.PI) / 180, hw = BOARD_W / 2;
    let d = 40;
    const place = () => {
      camera.position.set(Math.sin(yw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yw) * Math.cos(p) * d);
      camera.lookAt(0, lookY, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    };
    for (let i = 0; i < 6; i++) {
      place();
      const a = tmpV.set(-hw, TILE_TOP, hw).project(camera), b = tmpW.set(hw, TILE_TOP, hw).project(camera);
      d *= (Math.abs(b.x - a.x) / 2 * CW) / target;
    }
    place();
    const c = tmpV.set(0, TILE_TOP, 0).project(camera);
    const px0 = ((c.x + 1) / 2) * CW, py0 = ((1 - c.y) / 2) * CH;
    camera.setViewOffset(CW, CH, px0 - cx * k, py0 - cy * k, CW, CH);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }
  const project = (x, y, z) => { tmpV.set(x, y, z).project(camera); return { x: ((tmpV.x + 1) / 2) * W, y: ((1 - tmpV.y) / 2) * H }; };
  const cellX = (s, flip) => ((flip ? 7 - (s & 7) : s & 7) - 3.5);
  const cellZ = (s, flip) => (flip ? (s >> 3) - 3.5 : 3.5 - (s >> 3));
  let curFlip = false, occupied = [];
  v3.pt = project;
  v3.sq = (s) => project(cellX(s, curFlip), TILE_TOP, cellZ(s, curFlip));
  const ray = new THREE.Vector3(), orig = new THREE.Vector3();
  function planePoint(vx, vy, y) {
    const ndcx = (vx / W) * 2 - 1, ndcy = 1 - (vy / H) * 2;
    orig.copy(camera.position); ray.set(ndcx, ndcy, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return null;
    const t = (y - orig.y) / ray.y; if (t < 0) return null;
    return { x: orig.x + ray.x * t, z: orig.z + ray.z * t };
  }
  v3.pick = (vx, vy) => {
    if (!v3.on) return -1;
    let best = -1, bz = -1e9;
    const unit = Math.abs(project(1, TILE_TOP, 0).x - project(0, TILE_TOP, 0).x) || 40;
    for (const e of occupied) {
      const base = project(e.x, TILE_TOP + 0.05, e.z), top = project(e.x, TILE_TOP + (PIECE_H[e.type] || 1) * 0.85, e.z);
      const cx = base.x, cy = (base.y + top.y) / 2, ry = Math.abs(base.y - top.y) / 2 + unit * 0.08, rx = unit * 0.4;
      const dx = (vx - cx) / rx, dy = (vy - cy) / ry;
      if (dx * dx + dy * dy <= 1 && e.z > bz) { bz = e.z; best = e.s; }
    }
    if (best >= 0) return best;
    const q = planePoint(vx, vy, TILE_TOP); if (!q) return -1;
    const f = Math.floor(q.x + 4), r = Math.floor(q.z + 4);
    if (f < 0 || f > 7 || r < 0 || r > 7) return -1;
    return curFlip ? (r * 8 + (7 - f)) : ((7 - r) * 8 + f);
  };

  // ------------------------------------------------------------ pieces (pooled)
  const pool = new Map(), used = new Map();
  function takePiece(type, side) {
    const key = `${type}:${side}`;
    let list = pool.get(key); if (!list) { list = []; pool.set(key, list); }
    const n = used.get(key) || 0; used.set(key, n + 1);
    if (n < list.length) { list[n].visible = true; return list[n]; }
    const w = new THREE.Group(), mesh = buildPiece(type, side);
    const sh = B.contactShadow(0.46, 0.55); sh.name = 'sh';
    w.add(mesh, sh); pieceRoot.add(w); list.push(w); return w;
  }
  function placePiece(type, side, x, y, z, o = {}) {
    const w = takePiece(type, side), face = (o.flip ? -side : side) > 0 ? 0 : Math.PI;
    w.position.set(x, TILE_TOP + y, z);
    w.rotation.set(o.tilt || 0, face + (o.yaw || 0), o.roll || 0);
    const sc = o.scale ?? 1;
    w.scale.set(sc, sc * (o.sy ?? 1), sc);
    const sh = w.getObjectByName('sh');
    sh.position.set(0, -y + 0.004, 0); sh.scale.setScalar(clamp(1 - y * 0.3, 0.5, 1) * (o.shadowK ?? 1));
    sh.material.opacity = clamp(0.6 - y * 0.35, 0.15, 0.6) * (o.alpha ?? 1);
    return w;
  }
  function resetPieces() {
    for (const [key, list] of pool) { const n = used.get(key) || 0; for (let i = n; i < list.length; i++) list[i].visible = false; }
    used.clear();
  }

  // ------------------------------------------------------------ markers
  const dotTex = dotTexture(), sqTex = squareGlowTexture();
  const planeGeo = new THREE.PlaneGeometry(1, 1); planeGeo.rotateX(-Math.PI / 2);
  function pooled(make) {
    const items = []; let n = 0;
    return {
      get() { if (n < items.length) return items[n++]; const m = make(); markRoot.add(m); items.push(m); n++; return m; },
      reset() { for (const m of items) m.visible = false; n = 0; },
      show(m) { m.visible = true; return m; },
    };
  }
  const dotsP = pooled(() => { const m = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 3; return m; });
  const glowP = pooled(() => { const m = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: sqTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 2; return m; });
  const ringGold = pooled(() => B.glowRing(0.5, '#ffd36a')), ringRed = pooled(() => B.glowRing(0.5, '#ff4a36')), ringWhite = pooled(() => B.glowRing(0.5, '#ffffff'));
  const arrowP = pooled(() => {
    const g = new THREE.Group();
    const gold = new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.96, depthWrite: false, toneMapped: false });
    const edge = new THREE.MeshBasicMaterial({ color: 0x2a0c04, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
    const hg = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0.5, 0), new THREE.Vector2(-0.5, 0.5), new THREE.Vector2(-0.5, -0.5)])); hg.rotateX(-Math.PI / 2);
    const mk = (geo, mat, name, ro) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.renderOrder = ro; g.add(m); return m; };
    mk(planeGeo, edge, 'oshaft', 3); mk(hg, edge, 'ohead', 3); mk(planeGeo, gold, 'shaft', 4); mk(hg, gold, 'head', 4);
    return g;
  });
  // corner brackets (the square a piece just arrived on) and a dashed ring (the square it left)
  const bracketTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.lineCap = 'round'; x.lineJoin = 'round';
    for (const [w, a] of [[16, 0.35], [8, 1]]) { x.lineWidth = w; x.strokeStyle = `rgba(255,255,255,${a})`; const m = 12, L = 34;
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const cx = sx > 0 ? m : 128 - m, cy = sy > 0 ? m : 128 - m; x.beginPath(); x.moveTo(cx + sx * L, cy); x.lineTo(cx, cy); x.lineTo(cx, cy + sy * L); x.stroke(); } }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const dashTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 6; x.lineCap = 'round'; x.setLineDash([14, 12]);
    x.beginPath(); x.arc(64, 64, 46, 0, TAU); x.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const brackP = pooled(() => { const m = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: bracketTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 4; return m; });
  const dashP = pooled(() => { const m = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: dashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 4; return m; });
  function bracket(x, z, color, a = 1, s = 1.0) { const m = brackP.show(brackP.get()); m.position.set(x, TILE_TOP + 0.02, z); m.scale.setScalar(s); m.material.color.setHex(color); m.material.opacity = a; return m; }
  function dashed(x, z, color, a = 1, s = 1.0) { const m = dashP.show(dashP.get()); m.position.set(x, TILE_TOP + 0.02, z); m.scale.setScalar(s); m.material.color.setHex(color); m.material.opacity = a; return m; }
  function ring(p, x, z, r, a = 1) { const m = p.show(p.get()); m.position.set(x, TILE_TOP + 0.014, z); m.scale.setScalar(r * 2); m.material.opacity = a; return m; }
  function square(x, z, a, color = 0xffd36a, s = 1.0) { const m = glowP.show(glowP.get()); m.position.set(x, TILE_TOP + 0.01, z); m.scale.setScalar(s); m.material.opacity = a; m.material.color.setHex(color); return m; }
  function arrow(ax, az, bx, bz, k = 1) {
    const len = Math.hypot(bx - ax, bz - az); if (len < 0.5) return;
    const g = arrowP.show(arrowP.get()), hl = 0.5, sl = Math.max(0.1, len - 0.36 - hl * 0.55), sw = 0.17 * k, hw = 0.62 * k;
    g.position.set(ax, TILE_TOP + 0.03, az); g.rotation.set(0, Math.atan2(-(bz - az), bx - ax), 0);
    const set = (n, sx, sz, px) => { const o = g.getObjectByName(n); o.scale.set(sx, 1, sz); o.position.set(px, 0, 0); };
    const sx0 = 0.34 + sl / 2, hx = 0.34 + sl + hl * 0.42;
    set('oshaft', sl + 0.12, sw + 0.1, sx0); set('ohead', hl + 0.14, hw + 0.12, hx); set('shaft', sl, sw, sx0); set('head', hl, hw, hx);
    g.children.forEach((c) => { c.material.opacity = c.name[0] === 'o' ? 0.5 * k : 0.97 * k; });
  }

  // ------------------------------------------------------------ effects: sparks, dust, rings
  let rs = 12345; const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
  const FXN = 80, fx = [], bursts = [];
  const dustTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(215,185,145,0.9)'); g.addColorStop(1, 'rgba(215,185,145,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  for (let i = 0; i < FXN; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.visible = false; fxRoot.add(s); fx.push({ s, life: 0, max: 1, v: new THREE.Vector3(), kind: 0, size: 0.2 });
  }
  function emit(kind, x, y, z, vx, vy, vz, life, size, color) {
    const p = fx.find((e) => e.life <= 0); if (!p) return;
    p.kind = kind; p.life = p.max = life; p.size = size; p.v.set(vx, vy, vz);
    p.s.position.set(x, y, z); p.s.visible = true;
    p.s.material.map = kind === 1 ? dustTex : glowT; p.s.material.blending = kind === 1 ? THREE.NormalBlending : THREE.AdditiveBlending;
    p.s.material.color.setHex(color); p.s.material.needsUpdate = true;
  }
  function burstAt(x, z, side) {
    for (let i = 0; i < 18; i++) { const a = rnd() * TAU, sp = 1.3 + rnd() * 2.6; emit(0, x, TILE_TOP + 0.35, z, Math.cos(a) * sp, 2.2 + rnd() * 2.2, Math.sin(a) * sp, 0.55 + rnd() * 0.4, 0.14 + rnd() * 0.14, side > 0 ? (i % 2 ? 0xfff0c0 : 0xffd27a) : (i % 2 ? 0xff6a4a : 0xffb060)); }
    for (let i = 0; i < 6; i++) { const a = rnd() * TAU; emit(1, x + Math.cos(a) * 0.15, TILE_TOP + 0.12, z + Math.sin(a) * 0.15, Math.cos(a) * 0.7, 0.35 + rnd() * 0.4, Math.sin(a) * 0.7, 0.7, 0.55, 0xc8a878); }
    const r = B.glowRing(0.5, '#ffd36a'); r.position.set(x, TILE_TOP + 0.02, z); fxRoot.add(r); bursts.push({ t: 0, ring: r });
  }
  function puff(x, z) { for (let i = 0; i < 5; i++) { const a = rnd() * TAU; emit(1, x + Math.cos(a) * 0.2, TILE_TOP + 0.06, z + Math.sin(a) * 0.2, Math.cos(a) * 0.55, 0.25, Math.sin(a) * 0.55, 0.5, 0.34, 0xcfb089); } }
  function stepFx(dt) {
    for (const p of fx) {
      if (p.life <= 0) continue;
      p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; }
      const k = 1 - p.life / p.max;
      if (p.kind === 0) { p.v.y -= 9 * dt; p.s.scale.setScalar(p.size * (1 - k * 0.5)); p.s.material.opacity = 1 - k; }
      else { p.v.multiplyScalar(Math.max(0, 1 - 1.8 * dt)); p.s.scale.setScalar(p.size * (1 + k * 1.6)); p.s.material.opacity = 0.55 * (1 - k); }
      p.s.position.addScaledVector(p.v, dt);
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.t += dt; const k = b.t / 0.6;
      if (k >= 1) { fxRoot.remove(b.ring); bursts.splice(i, 1); continue; }
      b.ring.scale.setScalar(1 + k * 2.4); b.ring.material.opacity = (1 - k) * 0.9;
    }
  }

  // ------------------------------------------------------------ sprites for the 2D layer
  function buildSprites() {
    const SP = 256, sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1.1, 1.1, 1.1, -1.1, 0.1, 30);
    sc.add(new THREE.HemisphereLight(0xfff0dc, 0x6a4a38, 1.05));
    const l1 = new THREE.DirectionalLight(0xfff0d8, 2.8); l1.position.set(-3, 6, 5);
    const l2 = new THREE.DirectionalLight(0xffb27a, 1.2); l2.position.set(4, 3, -4);
    sc.add(l1, l2); sc.environment = scene.environment; sc.environmentIntensity = 0.45;
    const p = (24 * Math.PI) / 180, lookY = 0.92;
    cam.position.set(0, lookY + Math.sin(p) * 10, Math.cos(p) * 10); cam.lookAt(0, lookY, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const pr = renderer.getPixelRatio(), prevShadow = renderer.shadowMap.enabled;
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = false;
    for (const side of [1, -1]) for (let type = 1; type <= 6; type++) {
      const g = buildPiece(type, side); g.rotation.y += 0.2; sc.add(g);
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sprites.img[`${type}:${side}`] = c; sc.remove(g);
    }
    renderer.setPixelRatio(pr); renderer.setClearColor(0x120804, 1); renderer.shadowMap.enabled = prevShadow;
    CW = 0; resize(true);
    sprites.ready = true;
  }

  // ------------------------------------------------------------ board + per-frame update
  function ensureBoard(look) {
    if (!BOARD_LOOKS[look]) look = 'sandal';
    if (boardLook === look && boardGrp) return;
    if (boardGrp) { root.remove(boardGrp); boardGrp.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    if (rug) { root.remove(rug); rug.geometry.dispose(); rug.material.map.dispose(); rug.material.dispose(); }
    boardGrp = buildBoard(look); root.add(boardGrp);
    rug = buildRug(look); root.add(rug);
    boardLook = look;
  }

  let clock = 0, rec = null, capKey = '', mode = 'ambient';
  const modeOf = (sc) => (sc === 'play' || sc === 'auto' || sc === 'learn' ? 'board' : sc === 'title' ? 'hero' : 'ambient');

  function prepare(state) {
    resize(false);
    applyLayout(meta.width, meta.height);
    mode = modeOf(state.scene);
    if (boardGrp) boardGrp.visible = mode !== 'ambient';   // reading pages and menus show the empty lamp-lit courtyard
    court.position.z = mode === 'hero' ? 5.5 : 0;   // the arcade steps forward behind the title board
    v3.scene = state.scene;
    ensureBoard(state.theme);
    curFlip = mode === 'board' ? !!state.flip : false;
    const yawD = Math.sin(clock * 0.22) * 4;
    if (mode === 'board') fit(BOARD.x + BOARD.w / 2, BOARD.y + BOARD.h / 2 + BOARD.h * (LAY.land ? 0.03 : 0.0), BOARD.w * 0.985, LAY.land ? 56 : 59, 0);
    else if (mode === 'hero') {
      const R = titleRows(!!state.saved, state.textIdx >= 3), s = R.heroScale;
      fit(R.heroCx, R.heroTop + 285 * s, 500 * s, 29, yawD * 1.5, TILE_TOP + 0.6);
    } else fit(W / 2, H * 0.4, Math.min(W * 0.95, H * 0.7), 42, yawD * 2, TILE_TOP + 0.4);
  }

  function present(state, dt) {
    clock += dt;
    for (const f of flames) {
      const fl = 1 + 0.1 * Math.sin(clock * 9.1 + f.ph) + 0.07 * Math.sin(clock * 15.7 + f.ph * 2.3) + 0.05 * Math.sin(clock * 3.3 + f.ph);
      f.pl.intensity = f.base * fl; f.sp.scale.set(0.5 * (0.9 + 0.12 * Math.sin(clock * 11 + f.ph)), 0.78 * fl, 1); f.halo.material.opacity = 0.42 + 0.14 * fl;
    }
    { const a = moteGeo.attributes.position; for (let i = 0; i < MOTES; i++) { a.array[i * 3 + 1] += dt * (0.05 + (i % 5) * 0.012); a.array[i * 3] += Math.sin(clock * 0.3 + moteSeed[i]) * dt * 0.06; if (a.array[i * 3 + 1] > 5) a.array[i * 3 + 1] = 0.5; } a.needsUpdate = true; }

    resetPieces(); occupied = [];
    dotsP.reset(); glowP.reset(); ringGold.reset(); ringRed.reset(); ringWhite.reset(); arrowP.reset(); brackP.reset(); dashP.reset();
    const isBoard = mode === 'board', board = isBoard ? state.vb : mode === 'hero' ? START_BOARD : EMPTY, flip = curFlip, an = isBoard ? state.anim : null, idle = !isBoard;
    const mvKey = state.g ? state.g.moves : 0;
    if (an) {
      const key = `${an.from}>${an.to}:${mvKey}`;
      if (!rec || rec.key !== key) rec = { from: an.from, to: an.to, type: an.type, side: an.side, promo: an.promo, cap: an.cap, t: 0, key, puffed: false };
      rec.t = an.t;
    } else if (rec) { rec.t += dt; if (rec.t > 0.34 + 0.32) rec = null; }
    if (!isBoard) rec = null;
    const slide = an ? an.slide : 0.34;
    const dragSq = isBoard && state.drag && state.drag.moved ? state.drag.sq : -1, hide = an ? an.from : -1;
    for (let s = 0; s < 64; s++) {
      const p = board[s]; if (!p || s === hide || s === dragSq) continue;
      if (rec && !an && s === rec.to) continue;
      const type = p > 0 ? p : -p, side = p > 0 ? 1 : -1, x = cellX(s, flip), z = cellZ(s, flip);
      let o = { flip }, y = 0;
      if (idle) { y = Math.max(0, Math.sin(clock * 2.1 - (s & 7) * 0.7 - (s >> 3) * 0.4)) * 0.05; o.yaw = Math.sin(clock * 0.8 + s) * 0.05; }
      if (isBoard && state.sel === s) y = 0.17 + 0.03 * Math.sin(clock * 5);
      if (an && an.cap && s === an.to && an.t > slide) {
        // the taken piece is knocked off its square: arc up, spin, shrink, with a spark burst
        const k = clamp((an.t - slide) / Math.max(0.01, an.pop || 0.4), 0, 1), dir = Math.sign(cellX(an.to, flip) - cellX(an.from, flip)) || 1;
        placePiece(type, side, x + dir * k * 0.7, Math.sin(k * Math.PI) * 0.9 + k * 0.1, z, { flip, scale: 1 - k * 0.55, roll: -dir * k * 2.3, yaw: k * 2, alpha: 1 - k });
        const ck = `${an.from}>${an.to}:${mvKey}`;
        if (capKey !== ck) { capKey = ck; burstAt(x, z, -an.side); }
        continue;
      }
      placePiece(type, side, x, y, z, o);
      occupied.push({ s, x, z, type });
    }
    if (rec) {
      const a = { x: cellX(rec.from, flip), y: 0, z: cellZ(rec.from, flip) }, b = { x: cellX(rec.to, flip), y: 0, z: cellZ(rec.to, flip) };
      const r = B.pieceMoveAt(a, b, rec.t, { duration: slide, lift: LIFT[rec.type] || 0.5, bounce: 0.1, settle: 0.3 });
      const kk = clamp(rec.t / slide, 0, 1), type = rec.promo && kk > 0.98 ? 5 : rec.type;
      const pop = rec.promo && rec.t > slide ? 1 + 0.2 * Math.sin(clamp((rec.t - slide) / 0.3, 0, 1) * Math.PI) : 1;
      const lean = kk < 1 ? Math.sin(Math.PI * kk) * 0.16 : 0, dx = b.x - a.x, dz = b.z - a.z;
      const ts = Math.max(0, rec.t - slide), wob = Math.sin(ts * 24) * 0.12 * Math.exp(-ts * 7) * Math.max(0, (PIECE_H[type] || 1) - 0.75);   // a tall carved piece rocks on landing
      placePiece(type, rec.side, r.x, r.y, r.z, { flip, scale: pop * (1 + Math.sin(Math.PI * kk) * 0.04), sy: r.squash, tilt: -lean * Math.sign(dz) + wob * Math.sign(dz || 1), roll: lean * 0.6 * Math.sign(dx) + wob * 0.6 });
      if (!rec.puffed && rec.t >= slide) { rec.puffed = true; if (!rec.cap) puff(b.x, b.z); }
      if (rec.t >= slide) occupied.push({ s: rec.to, x: b.x, z: b.z, type });
    }
    if (dragSq >= 0) {
      const p = state.vb[dragSq], d = state.drag, q = planePoint(d.x, d.y - 26, TILE_TOP + 0.5);
      if (q) placePiece(Math.abs(p), p > 0 ? 1 : -1, clamp(q.x, -4, 4), 0.5, clamp(q.z, -4, 4), { flip, scale: 1.08 });
      else placePiece(Math.abs(p), p > 0 ? 1 : -1, cellX(dragSq, flip), 0.4, cellZ(dragSq, flip), { flip });
    }

    if (isBoard) {
      const X = (s) => cellX(s, flip), Z = (s) => cellZ(s, flip), pulse = 0.5 + 0.5 * Math.sin(clock * 5);
      if (state.trail && !state.reveal) {
        const tf = state.trail.from, tt = state.trail.to;
        square(X(tf), Z(tf), 0.2, 0xb9d6ff); dashed(X(tf), Z(tf), 0xd9ecff, 0.9, 0.86);
        square(X(tt), Z(tt), 0.46, 0xffc94a); bracket(X(tt), Z(tt), 0xffd24a, 0.75 + 0.25 * pulse, 1.02);
        arrow(X(tf), Z(tf), X(tt), Z(tt), 0.55);
      }
      if (state.checkSq >= 0) square(X(state.checkSq), Z(state.checkSq), 0.55 + 0.35 * pulse, 0xff3020, 1.6);
      if (state.danger && state.threatSet) for (const s of state.threatSet) ring(ringRed, X(s), Z(s), 0.46 + pulse * 0.03, 0.55 + 0.3 * pulse);
      if (state.sel >= 0) { square(X(state.sel), Z(state.sel), 0.7); ring(ringGold, X(state.sel), Z(state.sel), 0.5, 0.95); }
      for (const tg of state.targets || []) {
        const x = X(tg.to), z = Z(tg.to);
        if (tg.cap) { square(x, z, 0.4, 0xff4030); ring(ringRed, x, z, 0.47 + pulse * 0.03, 0.95); }
        else { const m = dotsP.show(dotsP.get()); m.position.set(x, TILE_TOP + 0.016, z); m.scale.setScalar(0.5 + pulse * 0.06); m.material.opacity = 0.85 + 0.1 * pulse; }
        if (tg.promo) ring(ringGold, x, z, 0.36, 0.9);
      }
      const rv = state.reveal;
      if (rv) {
        for (const s of rv.movable) ring(ringWhite, X(s), Z(s), 0.46, 0.5);
        ring(ringGold, X(rv.from), Z(rv.from), 0.5, 1);
        for (const tg of rv.targets) { if (tg.to !== rv.to) ring(ringWhite, X(tg.to), Z(tg.to), tg.cap ? 0.42 : 0.2, 0.7); }
        square(X(rv.to), Z(rv.to), 0.42, 0xffc94a); bracket(X(rv.to), Z(rv.to), 0xffd24a, 0.8 + 0.2 * pulse, 1.02); dashed(X(rv.from), Z(rv.from), 0xffffff, 0.9, 0.9);
        arrow(X(rv.from), Z(rv.from), X(rv.to), Z(rv.to));
      }
      if (state.hint) {
        const h = state.hint; ring(ringGold, X(h.from), Z(h.from), 0.5, 1);
        square(X(h.to), Z(h.to), 0.4, 0xffc94a); bracket(X(h.to), Z(h.to), 0xffd24a, 0.8 + 0.2 * pulse, 1.02);
        arrow(X(h.from), Z(h.from), X(h.to), Z(h.to));
      }
      if (state.kb && state.cursor >= 0) ring(ringWhite, X(state.cursor), Z(state.cursor), 0.5, 0.9);
    }
    stepFx(dt);
    renderer.setViewport(0, 0, CW, CH);
    renderer.render(scene, camera);
  }

  // ------------------------------------------------------------ boot
  let ema = 16, frames = 0, lastT = performance.now();
  try { resize(true); applyTier(); ensureBoard('sandal'); buildSprites(); }
  catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { env.rebuild(); } catch (e) { /* no reflections, still playable */ }
    CW = 0; resize(true); canvas.style.visibility = 'visible'; v3.on = true;
  });
  v3.on = true;
  window.addEventListener('resize', () => resize(false));

  return {
    ok: true, renderer, scene, camera, mode: () => mode,
    wrap(game) {
      return Object.assign({}, game, {
        render(ctx, view) {
          if (!v3.on) { game.render(ctx, view); return; }
          const state = game.getState();
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          try { prepare(state); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
