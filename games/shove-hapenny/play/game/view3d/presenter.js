// Shove Ha'penny 3D presenter. READS the simulation state (game.getState()) and the scene object the 2D layer hands to drawScene,
// never writes them. One WebGL canvas sits behind the kit's transparent 2D canvas: the pub (plank table, panelled wall, pendant lamp,
// horse brasses, dartboard, a pint), the oak-and-slate board with brass beds, real pennies with thickness and a reeded edge, chalk
// slots, dust, and a screen-space HUD scene (carved wood plaques, lacquered buttons) drawn in the same frame.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import * as LAY from '../src/layout.js';
import { layoutOf } from '../src/view.js';
import { frameFor } from '../src/menus.js';
import { bakedBoard, slotXY } from '../src/art.js';
import { R, BEDS, CHALKS, START_Y, WX0, WX1, WY0, WY1, bedOf } from '../src/sim.js';
import { XC, YC, FH, SH, T, COIN_Y, SLOT_Y, wx, wz, buildBoard, buildTable, buildWall, buildLamp, buildPint, buildSpares, makeCoin, coinMaterials, tex, CANVAS_HELP } from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048 },
  { name: 'medium', dpr: 1.5, shadow: 1024 },
  { name: 'low', dpr: 1, shadow: 0 },
];
const { cv } = CANVAS_HELP;

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
  const vig = B.vignette(document.body, { strength: 0.62, color: '6,3,1', inner: 0.5 });
  if (vig) { vig.style.position = 'fixed'; vig.style.zIndex = '0'; kitCanvas.parentElement.insertBefore(vig, kitCanvas); }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.autoClear = false;
  renderer.setClearColor(0x0a0604, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  await tick();
  // ---------------------------------------------------------------- scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0604, 1100, 2600);
  const camera = new THREE.PerspectiveCamera(30, 1, 20, 8000);
  const hemi = new THREE.HemisphereLight(0xffe2bc, 0x2c1c12, 0.75);
  const key = new THREE.DirectionalLight(0xffd6a0, 2.3); key.position.set(-140, 460, 240);
  const rim = new THREE.DirectionalLight(0xff9a54, 1.3); rim.position.set(260, 170, -320);
  const fill = new THREE.DirectionalLight(0x9db8ff, 0.5); fill.position.set(280, 150, 340);
  key.castShadow = true; Object.assign(key.shadow.camera, { left: -270, right: 270, top: 270, bottom: -270, near: 50, far: 1400 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6; key.shadow.radius = 3;
  const lampLight = new THREE.PointLight(0xffc27a, 1, 0, 2); lampLight.intensity = 30000; lampLight.position.set(0, 300, 0);
  scene.add(hemi, key, key.target, rim, fill, lampLight);

  const hud = new THREE.Scene();
  const hudCam = new THREE.PerspectiveCamera();
  const hudLight = new THREE.DirectionalLight(0xfff0d6, 1.6); hudLight.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0xffb070, 0.45); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe8cc, 0x20140a, 0.6), hudLight, hudFill);

  function buildEnvMap() {
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture;
    pm.dispose();
    scene.environment = t; scene.environmentIntensity = 0.55;
    hud.environment = t; hud.environmentIntensity = 0.3;
  }
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  await tick();
  // ---------------------------------------------------------------- world
  scene.add(buildTable());
  const wall = buildWall(); wall.position.set(0, 0, -620); scene.add(wall);
  const lamp = buildLamp(); lamp.position.set(0, 300, 0); scene.add(lamp);
  const pint = buildPint(); pint.position.set(150, 0, -262); pint.rotation.y = 0.6; scene.add(pint);
  const spares = buildSpares(); spares.position.set(-176, 0, -296); scene.add(spares);
  const pint2 = buildPint(); pint2.position.set(-170, 0, 262); pint2.rotation.y = 2; scene.add(pint2);

  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  const bake = bakedBoard();
  boardRoot.add(buildBoard(bake));
  // pool of lamp light on the slate (additive), drifting as the lamp sways
  const poolC = cv(256), px = poolC.getContext('2d'), pg = px.createRadialGradient(128, 128, 6, 128, 128, 128);
  pg.addColorStop(0, 'rgba(255,214,150,0.22)'); pg.addColorStop(0.5, 'rgba(255,170,90,0.07)'); pg.addColorStop(1, 'rgba(255,150,70,0)');
  px.fillStyle = pg; px.fillRect(0, 0, 256, 256);
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const poolQ = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: tex(poolC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  poolQ.scale.set(430, 1, 430); poolQ.position.y = SH + 0.5; poolQ.renderOrder = 1; boardRoot.add(poolQ);

  // blobs, rings
  const blobC = cv(128), bx = blobC.getContext('2d'), bg = bx.createRadialGradient(64, 64, 0, 64, 64, 64);
  bg.addColorStop(0, 'rgba(0,0,0,0.65)'); bg.addColorStop(0.6, 'rgba(0,0,0,0.25)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
  bx.fillStyle = bg; bx.fillRect(0, 0, 128, 128);
  const blobTex = tex(blobC);
  const ringC = cv(128), rx = ringC.getContext('2d'); rx.strokeStyle = '#fff'; rx.lineWidth = 9; rx.beginPath(); rx.arc(64, 64, 50, 0, TAU); rx.stroke();
  const ringTex = tex(ringC);

  await tick();
  // ---------------------------------------------------------------- coin pools
  const coinRoot = new THREE.Group(); boardRoot.add(coinRoot);
  const pools = [[], []]; let used = [0, 0];
  const shadowMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: false });
  const addCoin = (side) => {
    const g = new THREE.Group(), c = makeCoin(side);
    const sh = new THREE.Mesh(flat, shadowMat.clone()); sh.scale.set(R * 3.1, 1, R * 3.1); sh.position.y = SH + 0.12; sh.renderOrder = 2;
    const pip = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.5, 14), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })); pip.position.y = T / 2 + 0.3; pip.visible = false; c.add(pip);
    const dim = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.98, R * 0.98, 0.3, 40), new THREE.MeshBasicMaterial({ color: 0x120804, transparent: true, opacity: 0.5, depthWrite: false })); dim.position.y = T / 2 + 0.2; dim.visible = false; c.add(dim);
    g.add(sh, c); coinRoot.add(g); g.visible = false;
    return { g, c, sh, pip, dim };
  };
  function coin(x, y, side, o = {}) {
    const p = pools[side]; if (used[side] >= p.length) p.push(addCoin(side));
    const e = p[used[side]++], lift = o.lift || 0, s = o.scale ?? 1;
    e.g.visible = true;
    e.g.position.set(wx(x), 0, wz(y));
    e.c.position.y = COIN_Y + lift - (o.sink || 0);
    e.c.rotation.set(o.tilt || 0, o.yaw ?? ((x * 0.37 + y * 0.21) % TAU), o.roll || 0);
    e.c.scale.setScalar(s);
    e.sh.position.y = SH + 0.12;
    e.sh.visible = !o.noShadow && !(o.sink > 0);
    const sk = (lift > 0 ? 1 + lift * 0.05 : 1) * s;
    e.sh.scale.set(R * 3.1 * sk, 1, R * 3.1 * sk);
    e.sh.material.opacity = clamp(0.95 - lift * 0.05, 0.3, 1);
    e.pip.visible = !!o.pip; e.dim.visible = !!o.dead;
    return e;
  }
  // chalk coins in the slots
  const slotPool = []; let slotUsed = 0;
  function slotCoin(x, y, side, scale) {
    let e = slotPool[slotUsed];
    if (!e) { const c = makeCoin(side); coinRoot.add(c); e = { c, side }; slotPool[slotUsed] = e; }
    if (e.side !== side) { e.c.material = coinMaterials(side); e.side = side; }
    slotUsed++;
    e.c.visible = true; e.c.scale.setScalar(scale); e.c.position.set(wx(x), SLOT_Y + (T * scale) / 2, wz(y)); e.c.rotation.y = x * 0.9;
  }
  // translucent ghost coins (hint / aim preview)
  const ghosts = [];
  const ghostMats = [0, 1].map((s) => coinMaterials(s).map((m) => { const c = m.clone(); c.transparent = true; c.opacity = 0.5; c.depthWrite = false; return c; }));
  let ghostUsed = 0;
  function ghostAt(x, y, side) {
    let e = ghosts[ghostUsed];
    if (!e) { const c = makeCoin(side); c.castShadow = false; c.receiveShadow = false; coinRoot.add(c); e = { c, side }; ghosts[ghostUsed] = e; }
    e.c.material = ghostMats[side]; ghostUsed++;
    e.c.visible = true; e.c.position.set(wx(x), COIN_Y + 0.3, wz(y));
  }
  // rings (score pulse, hint marks)
  const ringPool = []; let ringUsed = 0;
  function ringAt(x, y, size, color, opacity, h = SH + 0.9) {
    let m = ringPool[ringUsed];
    if (!m) { m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; boardRoot.add(m); ringPool.push(m); }
    ringUsed++; m.visible = true; m.material.color.set(color); m.material.opacity = opacity; m.position.set(wx(x), h, wz(y)); m.scale.set(size, 1, size);
  }

  // chalk dust: tiny pale puffs behind a sliding coin
  const DUST_N = 90;
  const dust = new THREE.InstancedMesh(new THREE.SphereGeometry(0.8, 6, 5), new THREE.MeshBasicMaterial({ color: 0xf1ece0, transparent: true, opacity: 0.75, depthWrite: false, fog: false }), DUST_N);
  dust.frustumCulled = false; boardRoot.add(dust);
  const parts = []; let seed = 17;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function puff(x, y, vx, vy, n) {
    for (let i = 0; i < n; i++) parts.push({ x: wx(x) + (rnd() - 0.5) * 8, y: SH + 0.8 + rnd() * 1.5, z: wz(y) + (rnd() - 0.5) * 8, vx: vx * 0.2 + (rnd() - 0.5) * 16, vy: 5 + rnd() * 14, vz: vy * 0.2 + (rnd() - 0.5) * 16, life: 0, max: 0.55 + rnd() * 0.6, s: 0.5 + rnd() * 0.9 });
    if (parts.length > DUST_N) parts.splice(0, parts.length - DUST_N);
  }
  function stepDust(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt; p.vy -= 10 * dt; p.vx *= 0.97; p.vz *= 0.97;
      p.x += p.vx * dt; p.y += Math.max(0, p.vy) * dt * 0.6; p.z += p.vz * dt;
      if (p.life >= p.max) parts.splice(i, 1);
    }
    for (let i = 0; i < DUST_N; i++) {
      const p = parts[i];
      if (!p) _m.makeScale(0, 0, 0); else { const k = 1 - p.life / p.max; _p.set(p.x, p.y, p.z); _s.setScalar(p.s * (0.4 + k)); _m.compose(_p, _q, _s); }
      dust.setMatrixAt(i, _m);
    }
    dust.instanceMatrix.needsUpdate = true;
  }

  await tick();
  // ---------------------------------------------------------------- HUD plaques and buttons
  const slabCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = slabCache.get(k);
    if (!g) { if (slabCache.size > 150) { for (const v of slabCache.values()) v.dispose(); slabCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); slabCache.set(k, g); }
    return g;
  };
  const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, ...o });
  const woodHud = (() => { const w = B.woodCanvas(512, '#6b4220', '#2c170a', 9, { lines: 170 }); return phys('#ffffff', { map: tex(w.map, { repeat: [3, 3] }), roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.28 }); })();
  const leather = (() => { const c = cv(256), x = c.getContext('2d'), r = CANVAS_HELP.rng(4); x.fillStyle = '#2a190d'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 4000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,200,140,0.05)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); } return tex(c, { repeat: [2, 1] }); })();
  const paperTex = (() => { const c = cv(256), x = c.getContext('2d'), r = CANVAS_HELP.rng(8); x.fillStyle = '#f4ead0'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 3000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(120,90,40,0.06)' : 'rgba(255,255,255,0.18)'; x.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3); } return tex(c, { repeat: [2, 2] }); })();
  const hm = {
    brass: new THREE.MeshStandardMaterial({ color: '#d0a136', metalness: 0.9, roughness: 0.3, envMapIntensity: 2.4 }),
    card: new THREE.MeshStandardMaterial({ map: leather, color: '#ffffff', roughness: 0.85 }),
    cardOn: new THREE.MeshStandardMaterial({ map: leather, color: '#ffffff', roughness: 0.8, emissive: '#5a3410', emissiveIntensity: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ map: leather, color: '#9a8a7c', roughness: 0.85 }),
    paper: new THREE.MeshStandardMaterial({ map: paperTex, color: '#ffffff', roughness: 0.9 }),
    plain: phys('#f3e5bf', { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 }),
    primary: phys('#d2321f', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
    active: phys('#1f8196', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
    dkbtn: phys('#3a2517', { roughness: 0.34, clearcoat: 0.9, clearcoatRoughness: 0.14 }),
    disabled: phys('#a39a88', { roughness: 0.55, clearcoat: 0.3 }),
  };
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x080402, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  const hudPanels = [], hudButtons = [], ROT = Math.PI / 2;
  const flatQuad = new THREE.PlaneGeometry(1, 1);
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, woodHud), trim = new THREE.Mesh(flatQuad, hm.brass), inner = new THREE.Mesh(flatQuad, hm.card); g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p); }
    return p;
  }
  function placePanel(i, r, rad, kind) {
    const p = panelAt(i); p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -700, dep = 14, ins = kind === 'paper' ? 9 : 6;
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.6); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.5, Math.max(3, rad - ins), 2.2); p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    p.inner.material = hm[kind] || hm.card;
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(flatQuad, hm.plain), rimM = new THREE.Mesh(flatQuad, hm.brass); g.add(rimM, body); hud.add(g); b = { g, body, rim: rimM }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(18, r.h / 3), z = -400, dep = bt.pressed ? 8 : 18;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, rad - 2, 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.body.material = bt.k === 'primary' ? hm.primary : bt.k === 'active' ? hm.active : bt.k === 'dark' ? hm.dkbtn : bt.k === 'disabled' ? hm.disabled : hm.plain;
    b.g.position.set(0, bt.pressed ? -3 : 0, 0);
  }

  await tick();
  // ---------------------------------------------------------------- camera fitting
  let W = 1, H = 1, dprNow = 1, Lw = 720, Lh = 1280, hudW = 0, hudH = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  const corners = [];
  for (const x of [WX0, WX1]) for (const z of [WY0, WY1]) for (const y of [0, FH + 3]) corners.push(new THREE.Vector3(x - XC, y, z - YC));
  const tmp = new THREE.Vector3();
  function extents() {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of corners) { tmp.copy(c); boardRoot.localToWorld(tmp); tmp.project(camera); const sx = ((tmp.x + 1) / 2) * W, sy = ((1 - tmp.y) / 2) * H; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
    return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
  }
  // Fit the board's bounding box into rect (virtual units) at the given pitch; returns how much of the rect it fills.
  function fitCamera(rect, pitchDeg, fov, yawDeg = 0, lookY = 6) {
    const k = W / Lw, tw = rect.w * k, th = rect.h * k, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    let d = 900;
    const place = () => {
      camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    let e;
    for (let it = 0; it < 6; it++) { place(); e = extents(); d *= Math.max(e.w / tw, e.h / th); }
    place(); e = extents();
    const cxp = (e.x0 + e.x1) / 2, cyp = (e.y0 + e.y1) / 2, tx = (rect.x + rect.w / 2) * k, ty = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W, H, cxp - tx, cyp - ty, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    return Math.min(e.w / tw, e.h / th) / Math.max(e.w / tw, e.h / th);
  }
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3(), pv = new THREE.Vector3();
  v3.project = (wxx, wyy, lift = 0) => {
    pv.set(wx(wxx), SH + lift, wz(wyy)); boardRoot.localToWorld(pv); pv.project(camera);
    return { x: ((pv.x + 1) / 2) * Lw, y: ((1 - pv.y) / 2) * Lh };
  };
  v3.toWorld = (vx, vy) => {
    const ndcx = (vx / Lw) * 2 - 1, ndcy = 1 - (vy / Lh) * 2;
    ray.set(ndcx, ndcy, 0.5).unproject(camera).sub(camera.position).normalize();
    // intersect with the plane of the coin centres, in board space (so the board's turn is accounted for)
    orig.copy(camera.position); boardRoot.worldToLocal(orig);
    const d = ray.clone().add(camera.position); boardRoot.worldToLocal(d); d.sub(orig).normalize();
    let t = Math.abs(d.y) < 1e-5 ? 1e5 : (COIN_Y - orig.y) / d.y; if (t < 0) t = 1e5;
    hitV.copy(orig).addScaledVector(d, t);
    return { x: clamp(hitV.x + XC, WX0 - 200, WX1 + 200), y: clamp(hitV.z + YC, WY0 - 400, WY1 + 400) };
  };

  await tick();
  // ---------------------------------------------------------------- coin sprites for the 2D layer (HUD icons, menu art, Rules illustrations)
  function buildSprites() {
    const SP = 192, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(12, 1, 20, 600);
    const l1 = new THREE.DirectionalLight(0xfff0d8, 3.4); l1.position.set(-80, 220, 120);
    const l2 = new THREE.DirectionalLight(0xffb070, 1.2); l2.position.set(120, 60, -80);
    sc.add(new THREE.HemisphereLight(0xffe6c8, 0x4a3a2a, 1.0), l1, l2);
    sc.environment = scene.environment; sc.environmentIntensity = 0.7;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0);
    const wasShadow = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    for (const side of [0, 1]) {
      const c = makeCoin(side); c.rotation.y = side ? 0.4 : 0.9; sc.add(c);
      const d = (R / 0.86) / Math.tan((6 * Math.PI) / 180), p = (74 * Math.PI) / 180;
      cam.position.set(0, Math.sin(p) * d, Math.cos(p) * d); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
      renderer.clear(); renderer.render(sc, cam);
      const out = cv(SP); out.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sc.remove(c); v3.coinSprite[side] = out;
    }
    renderer.setClearColor(0x0a0604, 1);
    renderer.setPixelRatio(pr); renderer.setSize(szw, szh, false);
    renderer.shadowMap.enabled = wasShadow; W = 0;
  }

  await tick();
  // ---------------------------------------------------------------- frame
  let lastT = 0, clock = 0, frames = 0, ema = 16, mode = 'play', dustAcc = 0;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
  }

  function prepare(state) {
    LAY.syncSize(); resize();
    Lw = LAY.W; Lh = LAY.H;
    if (hudW !== Lw || hudH !== Lh) { hudW = Lw; hudH = Lh; setHudProjection(Lw, Lh); }
    const play = state.scene === 'play' && state.m;
    mode = play ? 'play' : 'bg';
    const land = Lw > Lh;
    if (play) {
      const L = layoutOf(state);
      boardRoot.rotation.y = L.rot ? -Math.PI / 2 : 0; boardRoot.updateMatrixWorld(true);
      // the tilt that fills the board's rectangle best (steeper for tall rectangles, lower for wide ones)
      let best = 72, bf = -1;
      for (const p of [72, 66, 60, 54, 48]) { const f = fitCamera(L.rect, p, 28, 0, 6); if (f > bf + 0.015) { bf = f; best = p; } }
      fitCamera(L.rect, best, 28, 0, 6);
    } else {
      const bl = LAY.bgLayout();
      boardRoot.rotation.y = bl.rot ? -Math.PI / 2 : 0; boardRoot.updateMatrixWorld(true);
      const sway = Math.sin(clock * 0.21) * 6;
      let rect = { x: 24, y: Lh * 0.36, w: Lw - 48, h: Lh * 0.62 };
      if (land) {
        rect = { x: 20, y: Lh * 0.1, w: Lw - 40, h: Lh * 0.86 };
        if (state.scene === 'title') { try { const fr = frameFor(state, 'title'); if (fr.hero) rect = { x: Math.max(8, fr.hero.x0), y: Lh * 0.36, w: Math.max(200, fr.hero.x1 - fr.hero.x0), h: Lh * 0.62 }; } catch (e) { /* keep default */ } }
      }
      fitCamera(rect, land ? 38 : 33, land ? 34 : 38, sway, 4);
    }
  }

  function boardContents(sc, dt) {
    for (const p of pools) for (const e of p) e.g.visible = false;
    for (const e of slotPool) if (e) e.c.visible = false;
    for (const e of ghosts) if (e) e.c.visible = false;
    for (const m of ringPool) m.visible = false;
    used = [0, 0]; slotUsed = 0; ghostUsed = 0; ringUsed = 0;
    if (!sc) return;
    const side = sc.side ?? 0;
    sc.table.forEach((c, i) => { coin(c.x, c.y, c.side, { pip: !!c.sc, dead: !c.sc && bedOf(c) < 0, yaw: ((i * 2.399) % TAU) }); });
    for (const d of sc.dead ?? []) {
      const k = clamp(d.t / d.max, 0, 1);
      coin(d.x + d.vx * k * 0.3, d.y + d.vy * k * 0.3, d.side, { lift: k * 10, scale: 1 - 0.5 * k, noShadow: true, tilt: k * 1.5 });
    }
    for (const f of sc.falls ?? []) {
      const k = clamp(f.t / f.max, 0, 1);
      coin(f.x, f.y, f.side, { sink: k * k * 90, scale: 1 - 0.3 * k, tilt: k * 1.3, roll: k * 0.7 });
    }
    if (sc.moving) {
      const m = sc.moving;
      coin(m.x, m.y, m.side, { lift: 0.25 });
      dustAcc += dt * 70;
      const n = Math.floor(dustAcc); dustAcc -= n;
      if (n > 0) puff(m.x, m.y, 0, 12, Math.min(3, n));
    }
    if (sc.ready) {
      const a = sc.aim, bob = Math.sin(clock * 3.1) * 0.5;
      coin(a.x, START_Y, side, { lift: 5 + bob, tilt: 0.06 });
      if (sc.readyGlow) ringAt(a.x, START_Y, R * 3.0 + Math.sin(clock * 4) * 1.5, '#ffe3a0', 0.5);
      if (sc.showAim && sc.ghost) ghostAt(sc.ghost.x, sc.ghost.y, side);
    }
    if (sc.hint && sc.hint.ghost) { ghostAt(sc.hint.ghost.x, sc.hint.ghost.y, side); ringAt(sc.hint.ghost.x, sc.hint.ghost.y, R * 3.3, '#ffd45a', 0.9); }
    // chalk slots
    for (let s = 0; s < (sc.sides ?? 2); s++) {
      for (let k = 0; k < BEDS; k++) {
        const n = Math.min(CHALKS, sc.chalks[s][k]), p = sc.pulse && sc.pulse[s] ? sc.pulse[s][k] : 0;
        for (let j = 0; j < n; j++) {
          const q = slotXY(s, k, j), live = p > 0 && j === n - 1;
          slotCoin(q.x, q.y, s, 0.46 + (live ? 0.18 * p : 0));
          if (live) ringAt(q.x, q.y, 18 + 14 * (1 - p), '#fff4d0', p, FH + 1.4);
        }
        if (n >= CHALKS) { const q = slotXY(s, k, 1); ringAt(q.x, q.y, 36, s === 0 ? '#ff9a4a' : '#9fd8ff', 0.55, FH + 1.0); }
      }
    }
  }

  function present(state, dt) {
    // lamp sway and light pool
    const sw = Math.sin(clock * 0.37), sw2 = Math.cos(clock * 0.29);
    lamp.visible = mode !== 'play';
    lamp.rotation.z = sw * 0.015; lamp.position.set(170 + sw * 6, 330, -190);
    lampLight.position.set(sw * 8, 300, sw2 * 6 - 20);
    lampLight.intensity = 30000 * (1 + 0.025 * Math.sin(clock * 11.3) + 0.015 * Math.sin(clock * 23.1));
    poolQ.position.x = sw * 16; poolQ.position.z = sw2 * 10;
    key.position.set(-140, 460, 240); key.target.position.set(0, 0, 0);
    boardContents(v3.scene, dt);
    stepDust(dt);
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p.r, p.rad, p.kind);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0;
    for (const b of v3.buttons) placeButton(n++, b);
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(Lw * 2, Lh * 2, 1); scrim.position.set(Lw / 2, -Lh / 2, -900);
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud, hudCam);
    void state;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnvMap(); } catch (e) { /* no reflections, still playable */ }
    W = 0; resize(); v3.on = true;
  });

  try {
    buildEnvMap(); applyTier(); buildSprites();
  } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; v3.coinSprite = [null, null]; return noop; }
  await tick();
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* first frame compiles instead */ }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, mode: () => mode,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.scrim = 0; v3.scene = null;
          try { prepare(state); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
