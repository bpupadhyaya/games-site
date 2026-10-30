// Makruk 3D presenter. READS the game state (game.getState() + what view.js publishes in v3.frame / v3.marks), never writes it.
// One WebGL canvas sits behind the kit's transparent 2D canvas: a makruk board on a low teak table in a dusk-lit teak house. The camera
// is fitted to the layout's board rectangle (play / Learn / Watch & Learn) or hero rectangle (menu), so the 2D HUD, taps and labels line
// up with the tilted board through v3.proj / v3.unproj. No WebGL, ?flat=1 or a lost context: v3.on = false and the flat 2D art draws.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { GX, GY, SQ, FRAME } from '../src/layout.js';
import { C, TOP, BX, TX, TZ, MAT_H, TABLE_TOP, sqPos, height, buildBoard, buildRoom, buildProps, buildLights, makePieceSlot, dressPiece, radialTex, markTextures } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (f) => f * f * (3 - 2 * f);
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1024 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const BOARD_SCENES = new Set(['play', 'auto', 'learn']);
const POOL = 40;

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  try { await Promise.race([document.fonts.load('700 40px "Cormorant Garamond"', 'ABCDEFGH12345678'), new Promise((r) => setTimeout(r, 2500))]); } catch { /* paint with what is there */ }
  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a0f08);
  scene.fog = new THREE.Fog(0x2a160a, 260, 900);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.5; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const room = buildRoom(scene, { quality: tier < 2 ? 1 : 0 });
  await tick();
  const props = buildProps(); scene.add(props.group);
  props.bowl.position.set(-(TX + 24), MAT_H, 12); props.box.position.set(TX + 26, MAT_H, -16); props.box.rotation.y = 0.35;
  props.cup.position.set(TX - 3.8, TABLE_TOP, -TZ + 4);

  const pieces = Array.from({ length: POOL }, () => { const g = makePieceSlot(); g.visible = false; g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(g); return g; });
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ map: radialTex('20,10,4', 0.85), transparent: true, depthWrite: false, opacity: 0.55 });
  const blobs = Array.from({ length: POOL }, () => { const m = new THREE.Mesh(flatQuad, blobMat.clone()); m.renderOrder = 1; m.visible = false; scene.add(m); return m; });
  const MT = markTextures();
  const marksPool = Array.from({ length: 96 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: MT.glow, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); return m; });
  const dustT = radialTex('255,236,200', 0.8);
  const dust = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 3; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, z, s = 1, y = TOP) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, z, s, y }; };
  const moteN = 120, moteGeo = new THREE.BufferGeometry(), moteP = new Float32Array(moteN * 3), moteSeed = [];
  for (let i = 0; i < moteN; i++) moteSeed.push([hash(i, 1), hash(i, 2), hash(i, 3)]);
  moteGeo.setAttribute('position', new THREE.BufferAttribute(moteP, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: radialTex('255,230,190', 1, 64), size: 0.9, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.frustumCulled = false; scene.add(motes);

  const boards = new Map(); let board = null, boardKey = '';
  function setBoard(theme, flip) {
    const k = `${theme}|${flip ? 1 : 0}|${TIERS[tier].tex}`; if (k === boardKey) return;
    let b = boards.get(k); if (!b) { b = buildBoard(theme, flip, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera
  const cur = { yaw: 0, tilt: 58, fov: 30, dist: 120, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
  let snap = true, viewKey = '';
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 140 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 7; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });

  // ---------------------------------------------------------------- v3 hooks for the 2D layer (flat layout point <-> tilted board)
  const flatToWorld = (x, y) => ({ x: ((x - GX) / SQ - 4) * C, z: ((y - GY) / SQ - 4) * C });
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  v3.proj = (x, y, lift = 0) => {
    const w = flatToWorld(x, y), yy = TOP + lift;
    const p = virt(toCss(camera, w.x, yy, w.z, { x: 0, y: 0 }));
    toCss(camera, w.x - C / 2, yy, w.z, pa); toCss(camera, w.x + C / 2, yy, w.z, pb);
    p.k = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu() / SQ; return p;
  };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.unproj = (vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: GX + (hit.x / C + 4) * SQ, y: GY + (hit.z / C + 4) * SQ };
  };

  // ---------------------------------------------------------------- pieces and marks
  let nP = 0, nB = 0, nM = 0;
  function put(p, x, y, z, yaw, o = {}) {
    if (nP >= POOL || !p) return;
    const t = Math.abs(p), g = pieces[nP++];
    dressPiece(g, p, o.alpha ?? 1);
    g.position.set(x, y, z); g.rotation.set(o.tx || 0, yaw, o.tz || 0, 'YXZ'); g.scale.setScalar(o.sc ?? 1); g.visible = true;
    if (nB < POOL) {
      const base = o.base ?? TOP, lift = Math.max(0, y - base), b = blobs[nB++], s = (t === 1 || t === 7 ? 2.6 : 3.6) * (1 + lift * 0.1) * (o.sc ?? 1);
      b.position.set(x + 0.2 + lift * 0.25, base + 0.03, z + 0.3 + lift * 0.3); b.scale.set(s, 1, s); b.visible = true;
      b.material.opacity = 0.6 * (1 - Math.min(0.7, lift * 0.12)) * (o.alpha ?? 1);
    }
  }
  const markRGB = new THREE.Color();
  function mark(x, z, kind, rgb, size, a, y = TOP + 0.05, add = true) {
    if (nM >= marksPool.length) return;
    const m = marksPool[nM++], key = kind + add;
    if (m.userData.k !== key) { m.material.map = MT[kind] || MT.glow; m.material.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending; m.material.needsUpdate = true; m.userData.k = key; }
    const [r, g, b] = rgb.split(',').map((v) => Number(v) / 255); markRGB.setRGB(r, g, b, THREE.SRGBColorSpace); m.material.color.copy(markRGB);
    m.material.opacity = clamp(a, 0, 1); m.position.set(x, y, z); m.scale.set(size, 1, size); m.visible = true;
  }

  let clock = 0, lastSig = '', lastAnim = null, dtNow = 0; const impacts = [];
  const yawJit = (s) => (hash(s, 41) - 0.5) * 0.12;
  const posJit = (s, k) => (hash(s, k) - 0.5) * 0.22;
  function drawPieces(F, calm) {
    const flip = F.flip, b = F.board, a = F.anim;
    const sig = a ? `${a.from}|${a.to}` : '';
    if (sig !== lastSig) { if (lastAnim && !calm) { const q = sqPos(lastAnim.to, flip); puff(q.x, q.z, 1); impacts.push({ x: q.x, z: q.z, t: 0 }); } lastSig = sig; lastAnim = a; }
    for (let i = impacts.length - 1; i >= 0; i--) { const im = impacts[i]; im.t += dtNow; const f = im.t / 0.38; if (f >= 1) { impacts.splice(i, 1); continue; } mark(im.x, im.z, 'ring', '255,230,170', C * (0.9 + f * 1.2), 0.5 * (1 - f) * (1 - f), TOP + 0.04, true); }
    const dragSq = F.drag && F.drag.moved ? F.drag.sq : -1;
    const victimGone = a && a.t > a.slide;
    for (let s = 0; s < 64; s++) {
      const p = b[s]; if (!p) continue;
      if (a && s === a.from) continue;
      if (s === dragSq) continue;
      const q = sqPos(s, flip); let y = TOP, tx = 0, alpha, sc = 1;
      if (a && a.to === s) { if (victimGone) { const k = ease(clamp((a.t - a.slide) / a.pop, 0, 1)); sc = Math.max(0.05, 1 - k); alpha = 1 - k * 0.8; y += k * 1.4; } }
      if (a && a.to === s && a.t > a.slide && !a.cap) continue;
      if (s === F.sel) { y += 1.0 + (calm ? 0 : Math.sin(F.t * 5) * 0.16); tx = flip ? -0.08 : 0.08; }
      put(p, q.x + posJit(s, 3), y, q.z + posJit(s, 5), yawJit(s), { tx, alpha, sc });
    }
    if (a) {
      const A = sqPos(a.from, flip), Bq = sqPos(a.to, flip), kk = clamp(a.t / a.slide, 0, 1), e = ease(kk), up = Math.pow(Math.sin(Math.PI * kk), 1.35);
      const dx = Bq.x - A.x, dz = Bq.z - A.z, L = Math.hypot(dx, dz) || 1, lean = calm ? 0 : 0.2 * Math.sin(TAU * kk) * (kk < 0.5 ? 1 : 0.6);
      const type = a.promo && kk > 0.98 ? 7 : a.type;
      put(a.side * type, A.x + dx * e, TOP + up * (calm ? 1.2 : 3.2), A.z + dz * e, yawJit(a.from), { tx: (dz / L) * lean, tz: -(dx / L) * lean });
    }
    if (dragSq >= 0) { const w = flatToWorld(F.drag.x, F.drag.y - 40); put(b[dragSq], w.x, TOP + 2.4, w.z, 0, { tx: flip ? -0.1 : 0.1 }); }
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0;
  function framing(state) {
    const t = state.t, drift = state.calm ? 0 : 1, land = cssW() > cssH() * 1.1;
    if (BOARD_SCENES.has(state.scene)) {
      const rc = rectCss({ x: GX - FRAME, y: GY - FRAME, w: SQ * 8 + FRAME * 2, h: SQ * 8 + FRAME * 2 });
      const pts = [[-BX, TOP, -BX], [BX, TOP, -BX], [-BX, TOP, BX], [BX, TOP, BX], [-BX, TABLE_TOP, BX + 0.2], [BX, TABLE_TOP, BX + 0.2]];
      return fit(rc, pts, { yaw: 0, tilt: land ? 56 : 60, fov: 28, tx: 0, ty: TOP, tz: 0 });
    }
    if (state.scene === 'title' && v3.hero) {
      const base = { yaw: -20 + 6 * Math.sin(t * TAU / 34) * drift, tilt: 38 + 2 * Math.sin(t * TAU / 23) * drift, fov: 34, tx: 0, ty: TOP * 0.8, tz: 0 };
      return fit(rectCss(v3.hero), [[-BX, TOP, -BX], [BX, TOP, -BX], [-BX, TOP, BX], [BX, TOP, BX], [-BX, TABLE_TOP - 6, BX]], base);
    }
    const base = { yaw: -30 + 5 * Math.sin(t * TAU / 40) * drift, tilt: 22 + 2 * Math.sin(t * TAU / 29) * drift, fov: 36, tx: 0, ty: TOP * 0.7, tz: 0 };
    const rc = { x: cssW() * 0.15, y: cssH() * 0.4, w: cssW() * 0.7, h: cssH() * 0.4 };
    return fit(rc, [[-BX, TOP, -BX], [BX, TOP, -BX], [-BX, TABLE_TOP - 6, BX], [BX, TABLE_TOP - 6, BX]], base);
  }
  let wasBoard = null;
  function pre() {
    if (!game || lost) return;
    const state = game.getState();
    const isB = BOARD_SCENES.has(state.scene);
    const vk = `${cssW()}x${cssH()}|${state.scene}|${GX}|${GY}|${SQ}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (wasBoard !== isB) { wasBoard = isB; snap = true; }
    const goal = framing(state);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap || isB ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    v3.marks.length = 0; v3.frame = null;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt; dtNow = dt;
    const F = v3.frame || { board: null, theme: 'teak', flip: false, calm: false, t: clock };
    v3.frame = F;
    const calm = F.calm;
    setBoard(F.theme || 'teak', !!F.flip);
    nP = 0; nB = 0; nM = 0;
    if (F.board) drawPieces(F, calm);
    for (const mk of v3.marks) {
      if (mk.sq === undefined || mk.sq < 0 || mk.sq > 63) continue;
      const q = sqPos(mk.sq, F.flip); mark(q.x, q.z, mk.kind, mk.rgb, C * mk.s, mk.a, TOP + (mk.y ?? 0.05), mk.add !== false);
    }
    for (let i = nP; i < POOL; i++) pieces[i].visible = false;
    for (let i = nB; i < POOL; i++) blobs[i].visible = false;
    for (let i = nM; i < marksPool.length; i++) marksPool[i].visible = false;
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.55)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.55), s = (2.2 + f * 5.5) * u.s;
      m.visible = true; m.position.set(u.x, u.y + 0.1 + f * 0.6, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.5 * (1 - f) * (1 - f);
    }
    motes.visible = !calm;
    if (!calm) {
      for (let i = 0; i < moteN; i++) {
        const [a, b, c] = moteSeed[i], ph = clock * (0.02 + a * 0.03) + c * 10;
        moteP[i * 3] = -70 + a * 110 + Math.sin(ph * 2.1) * 4; moteP[i * 3 + 1] = 8 + ((b * 90 + clock * (0.6 + c)) % 90); moteP[i * 3 + 2] = -90 + c * 120 + Math.cos(ph * 1.7) * 4;
      }
      moteGeo.attributes.position.needsUpdate = true;
      room.lanterns.forEach((L, i) => { L.rotation.z = Math.sin(clock * 0.6 + i) * 0.015; });
      lights.lamp.intensity = 900 * (1 + 0.04 * Math.sin(clock * 3.1) + 0.03 * Math.sin(clock * 7.3));
    }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const b of boards.values()) { scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = '';
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });

  await tick();
  setBoard('teak', false); await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
