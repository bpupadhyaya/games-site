// Shagai 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js: riders and
// bones), never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas and is drawn in two passes:
//   1. the steppe at golden hour with the winding felt trail, the stations and the riders' bone-horses, seen from a tilted camera
//      that is fitted to the layout's trail rectangle;
//   2. (play screens) the felt rug on a dark table with the four ankle bones, seen from its own tilted camera, clipped to the
//      layout's mat rectangle.
// Each camera hands the 2D layer a projection (v3.tp / v3.mp) so labels, rings, particles and the tap on a bone line up with what
// is on screen. No WebGL or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds.
import * as THREE from '../vendor3d/three.js';
import { v3, slotPos } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { buildLights, buildSteppe, buildTrail, buildTable, boneGeometry, boneMaterials, boneMats4, makeToken, radialTex, U, BONE_S, TABLE } from './world.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const RUG_TOP = 0.2, BONE_CY = RUG_TOP + BONE_S * 0.6;
const MID = { x: 360, y: 1157 };                       // canonical centre of the felt mat
const matXZ = (x, y) => [(x - MID.x) * U, (y - MID.y) * U];

function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
  for (let i = 0; i < 8; i++) {
    let p = i; for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < 8; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const h = new Array(8);
  for (let i = 7; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < 8; c++) s -= A[i][c] * h[c]; h[i] = s / A[i][i]; }
  return h;
}
const applyH = (h, x, z) => { const d = h[6] * x + h[7] * z + 1; return [(h[0] * x + h[1] * z + h[2]) / d, (h[3] * x + h[4] * z + h[5]) / d]; };

export async function createPresenter({ kitCanvas, dev = false }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFShadowMap; renderer.autoClear = false;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  // ---------------------------------------------------------------- scene 1: steppe + trail + riders
  const sceneT = new THREE.Scene();
  const [sk, skx] = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; return [c, c.getContext('2d')]; })();
  { const g = skx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#1f5fae'); g.addColorStop(0.45, '#6fa6d8'); g.addColorStop(0.8, '#cfdbd0'); g.addColorStop(1, '#f1dcaa'); skx.fillStyle = g; skx.fillRect(0, 0, 4, 256); }
  const skyTex = new THREE.CanvasTexture(sk); skyTex.colorSpace = THREE.SRGBColorSpace;
  sceneT.background = skyTex; renderer.toneMappingExposure = 0.92; sceneT.fog = new THREE.Fog(0xc9d6b6, 150, 700);
  const camT = new THREE.PerspectiveCamera(26, 1, 2, 3000);
  const lightsT = buildLights(sceneT);
  lightsT.sun.target.position.set(36, 0, 58); lightsT.sun.position.set(36 - 38, 66, 58 + 40);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; sceneT.environment = env; sceneM.environment = env; sceneT.environmentIntensity = 0.3; sceneM.environmentIntensity = 0.35; pm.dispose(); } catch { /* no IBL */ } };
  const sceneM = new THREE.Scene();
  buildEnv();
  await tick();
  buildSteppe(sceneT, tier === 0 ? 1 : tier === 1 ? 0.6 : 0.3);
  await tick();
  sceneT.add(buildTrail());
  await tick();

  // ---------------------------------------------------------------- scene 2: the table
  const camM = new THREE.PerspectiveCamera(24, 1, 2, 800);
  const lightsM = buildLights(sceneM);
  sceneM.children.find((o) => o.isHemisphereLight).intensity = 0.7;
  lightsM.sun.position.set(-28, 52, 24); lightsM.sun.intensity = 3.0; lightsM.sun.target.position.set(0, 0, 0);
  lightsM.sun.shadow.camera.left = -42; lightsM.sun.shadow.camera.right = 42; lightsM.sun.shadow.camera.top = 30; lightsM.sun.shadow.camera.bottom = -30;
  const warm = new THREE.PointLight(0xffc27a, 650, 0, 2); warm.position.set(24, 22, 8); sceneM.add(warm);
  sceneM.add(buildTable());
  const boneGeo = boneGeometry(), bMats = boneMaterials(), faceMats = boneMats4(bMats, [0, 1, 2, 3]);
  const glowT = radialTex('255,214,110', 1);
  const bones = [0, 1, 2, 3].map(() => {
    const m = new THREE.Mesh(boneGeo, faceMats); m.castShadow = m.receiveShadow = true; m.visible = false; sceneM.add(m);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.rotation.x = -Math.PI / 2; gl.visible = false; gl.renderOrder = 2; sceneM.add(gl);
    return { m, gl };
  });
  await tick();

  // ---------------------------------------------------------------- riders
  const ivory = new THREE.MeshPhysicalMaterial({ color: 0xefe2bf, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  const tokGeo = boneGeometry(), tokens = [0, 1, 2, 3].map((i) => { const g = makeToken(i, tokGeo, ivory); g.visible = false; sceneT.add(g); return g; });
  const ringT = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 34, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(255,255,255,0.2)'); g.addColorStop(0.78, 'rgba(255,255,255,1)'); g.addColorStop(0.9, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const turnRing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe08a })); turnRing.rotation.x = -Math.PI / 2; turnRing.visible = false; turnRing.renderOrder = 2; sceneT.add(turnRing);
  await tick();

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0;
    for (const L of [lightsT, lightsM]) {
      L.sun.castShadow = t.shadow > 0;
      if (t.shadow) { L.sun.shadow.mapSize.set(t.shadow, t.shadow); if (L.sun.shadow.map) { L.sun.shadow.map.dispose(); L.sun.shadow.map = null; } }
    }
    for (const s of [sceneT, sceneM]) s.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- cameras
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const _v = new THREE.Vector3(), _t = new THREE.Vector3();
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
    for (let it = 0; it < 8; it++) {
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

  const TRAIL_PTS = [[4.8, 0, 29.0], [67.2, 0, 29.0], [4.8, 0, 89.0], [67.2, 0, 89.0], [9.6, 5.6, 85], [9.6, 5.6, 33]];
  const RUG_PTS = [[-31, RUG_TOP, -14.1], [31, RUG_TOP, -14.1], [-31, RUG_TOP, 14.1], [31, RUG_TOP, 14.1], [-30, 8, 0], [30, 8, 0]];
  const trailCache = new Map(), matCache = new Map();
  const curT = { yaw: 0, tilt: 50, fov: 26, dist: 120, ox: 0, oy: 0, tx: 36, ty: 0, tz: 59 }, curM = { ...curT, tx: 0, tz: 0, tilt: 52, fov: 24 };
  let bandT = { s: 1, tx: 0, ty: 0 }, bandM = { s: 1, tx: 0, ty: 0 }, matRect = null, snap = true, viewKey = '', mode = '';
  const tmp = { x: 0, y: 0 };
  function fitTrail(rc, t) {
    const key = `${rc.x.toFixed(1)},${rc.y.toFixed(1)},${rc.w.toFixed(1)},${rc.h.toFixed(1)}|${cssW()}x${cssH()}|${(t.yaw).toFixed(2)}|${t.tilt.toFixed(2)}`;
    let p = trailCache.get(key); if (!p) { p = fit(rc, TRAIL_PTS, { yaw: t.yaw, tilt: t.tilt, fov: 26, tx: 36, ty: 0, tz: 59 }); trailCache.set(key, p); if (trailCache.size > 40) trailCache.delete(trailCache.keys().next().value); }
    return p;
  }
  function fitMat(rc) {
    const key = `${rc.x.toFixed(1)},${rc.y.toFixed(1)},${rc.w.toFixed(1)},${rc.h.toFixed(1)}|${cssW()}x${cssH()}`;
    let p = matCache.get(key);
    if (!p) { const s = 0.965, r2 = { x: rc.x + rc.w * (1 - s) / 2, y: rc.y + rc.h * 0.25, w: rc.w * s, h: rc.h * 0.73 }; p = fit(r2, RUG_PTS, { yaw: 0, tilt: 52, fov: 24, tx: 0, ty: 0, tz: 0 }); matCache.set(key, p); if (matCache.size > 40) matCache.delete(matCache.keys().next().value); }
    return p;
  }
  // projections handed to the 2D layer: world point -> the band's own canonical frame
  const frame = (B, q) => { const v = virt(q); return [(v.x - B.tx) / B.s, (v.y - B.ty) / B.s]; };
  v3.tp = (x, y, h = 0) => frame(bandT, toCss(camT, x * U, 0.45 + h * U, y * U, tmp));
  v3.mp = (x, y, h = 0) => { const [X, Z] = matXZ(x, y); return frame(bandM, toCss(camM, X, BONE_CY + h * U, Z, tmp)); };
  let Hm = null;
  function updateMatH() {
    const cs = [[36, 1016], [684, 1016], [684, 1298], [36, 1298]], src = [], dst = [];
    for (const [x, y] of cs) { const [X, Z] = matXZ(x, y); const q = toCss(camM, X, BONE_CY, Z, tmp); const f = frame(bandM, q); src.push(f); dst.push([x, y]); }
    Hm = homography(src, dst);
  }
  v3.minv = (bx, by) => (Hm ? applyH(Hm, bx, by) : [bx, by]);

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, clock = 0, fadeIn = 0, frameAvg = 16, slowFrames = 0;
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height), sc = state.scene;
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}|${L.mode}|${sc}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    const playing = sc === 'play' || sc === 'autoplay' || sc === 'over' || sc === 'autoplay-over';
    const t = clock; let rcT, drift = { yaw: 0, tilt: 60 };
    if (playing) { bandT = L.play.trail; bandM = L.play.mat; rcT = L.play.trail.r; mode = 'play'; }
    else if (sc === 'title') { bandT = L.title.trail; bandM = { s: 1, tx: 0, ty: 0 }; rcT = L.title.trail.r; mode = 'title'; drift = { yaw: 4.5 * Math.sin(t * Math.PI * 2 / 30), tilt: 60 + 1.8 * Math.sin(t * Math.PI * 2 / 19) }; }
    else { bandT = { s: 1, tx: 0, ty: 0 }; bandM = bandT; const U0 = L.U; rcT = { x: U0.x0 + U0.w * 0.04, y: U0.y0 + U0.h * 0.12, w: U0.w * 0.92, h: U0.h * 0.76 }; mode = 'env'; drift = { yaw: 5 * Math.sin(t * Math.PI * 2 / 40), tilt: 60 }; }
    const goalT = fitTrail(rectCss(rcT), drift);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap || mode === 'play' ? 1 : 1 - Math.exp(-dt * 5);
    for (const key of Object.keys(goalT)) curT[key] += (goalT[key] - curT[key]) * k;
    place(camT, curT);
    if (mode === 'play') { matRect = rectCss(L.play.mat.r); const gm = fitMat(matRect); for (const key of Object.keys(gm)) curM[key] = gm[key]; place(camM, curM); updateMatH(); } else matRect = null;
    snap = false;
    v3.tokens.length = 0; v3.bones.length = 0; v3.mode = mode;
  }
  const bq = new THREE.Euler();
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    // riders
    tokens.forEach((g) => { g.visible = false; }); turnRing.visible = false;
    for (const tk of v3.tokens) {
      const g = tokens[tk.i]; if (!g) continue;
      const sp = slotPos(tk.s, tk.k, tk.n), lift = (tk.lift || 0) * U;
      g.visible = true; g.scale.setScalar(1.3); g.position.set(sp.x * U, 0.42 + lift, sp.y * U); g.rotation.y = -sp.ang + (tk.fly ? clock * 6 : 0);
      g.rotation.z = tk.moving ? Math.sin(clock * 16) * 0.09 : 0; g.rotation.x = tk.moving ? Math.sin(clock * 11) * 0.05 : 0;
      g.userData.body.position.y = 2.1 + (tk.win ? Math.abs(Math.sin(clock * 6)) * 0.5 : 0);
      if (tk.turn) { const p = 0.5 + 0.5 * Math.sin(clock * 4), s = 5 + p * 0.5; turnRing.visible = true; turnRing.position.set(sp.x * U, 0.5, sp.y * U); turnRing.scale.set(s, 1, s); turnRing.material.opacity = 0.6 + 0.4 * p; }
    }
    // bones
    bones.forEach((b) => { b.m.visible = false; b.gl.visible = false; });
    for (const bn of v3.bones) {
      const b = bones[bn.i]; if (!b) continue;
      const [X, Z] = matXZ(bn.x, bn.y), roll = bn.roll != null ? bn.roll : bn.face;
      b.m.visible = true; b.m.position.set(X, RUG_TOP + BONE_S * 0.6 + (bn.lift || 0) * U * 0.42, Z); bq.set(-roll * Math.PI / 2, -bn.rot, 0, 'YXZ'); b.m.rotation.copy(bq); b.m.scale.setScalar(1.2 * (bn.k || 1));
      if (bn.hold) { const p = 0.5 + 0.5 * Math.sin(clock * 4 + bn.i); b.gl.visible = true; b.gl.position.set(X, RUG_TOP + 0.05, Z); b.gl.scale.set(15, 1, 12); b.gl.material.opacity = 0.65 + 0.3 * p; b.gl.rotation.z = bq.y; }
    }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    const W = cssW(), H = cssH();
    renderer.setSize(W, H, false); renderer.setViewport(0, 0, W, H); renderer.setScissorTest(false);
    renderer.clear(); renderer.render(sceneT, camT);
    if (matRect) {
      renderer.setScissorTest(true); renderer.setScissor(Math.floor(matRect.x), Math.floor(H - matRect.y - matRect.h), Math.ceil(matRect.w), Math.ceil(matRect.h));
      renderer.setClearColor(0x24160c, 1); renderer.clear(); renderer.render(sceneM, camM); renderer.setScissorTest(false);
    }
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true; trailCache.clear(); matCache.clear();
  });
  await tick();
  place(camT, curT); try { renderer.compile(sceneT, camT); renderer.compile(sceneM, camM); } catch { /* compiled lazily */ }
  await tick();
  void TABLE;
  let loseExt = null;
  return {
    ok: true,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { if (!dev) return false; loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { if (dev) loseExt?.restoreContext(); },
  };
}
