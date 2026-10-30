// Dame 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js: pieces and marks in
// cell units), never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a carved board with a strip-woven
// border on a woven cloth, on a planked table in lantern light, with bottle-cap or turned-wood pieces. On the play screens the camera
// is fitted to the layout's board rectangle; v3.proj / v3.unproj convert between the 2D layer's cell units and the screen through the
// live camera, so taps, marks and counts line up with what is on screen. No WebGL, ?flat=1 or a lost context: v3.on = false and every
// screen draws the flat 2D art; a restored context rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor, host } from '../src/layout.js';
import { TOP, BASE, CELL, H, half, cellWorld, radialTex, buildBoard, capGeo, pieceMaterials, setPieceSet, buildTable, buildLights } from './world.js';

const D2R = Math.PI / 180, CAP = 48;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1536 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const REST = TOP + 0.02;
const MARK_COL = { dot: '#ffe27a', ring: '#ffe27a', square: '#7dff9a', glow: '#fff2c0', cursor: '#7dff9a' };

// 3x3 homography taking 4 source points to 4 destination points (a plane seen through a perspective camera is exactly this)
function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let i = 0; i < 8; i++) {
    let p = i; for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < 8; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const h = new Array(8);
  for (let i = 7; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < 8; c++) s -= A[i][c] * h[c]; h[i] = s / A[i][i]; }
  return h;
}

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

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120a05);
  scene.fog = new THREE.Fog(0x120a05, 190, 520);
  const camera = new THREE.PerspectiveCamera(26, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.5; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const table = buildTable(scene);
  await tick();
  let set = 'caps';
  const mats = pieceMaterials(set);
  const geoMan = capGeo(false, 'caps'), geoKing = capGeo(true, 'caps'), geoManW = capGeo(false, 'wood'), geoKingW = capGeo(true, 'wood');
  const meshes = {};
  for (const side of [1, -1]) for (const king of [0, 1]) {
    const m = new THREE.InstancedMesh(king ? geoKing : geoMan, mats[`${side}|${king}`], CAP); m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); meshes[`${side}|${king}`] = m;
  }
  const applySetGeo = () => { for (const side of [1, -1]) for (const king of [0, 1]) meshes[`${side}|${king}`].geometry = set === 'wood' ? (king ? geoKingW : geoManW) : (king ? geoKing : geoMan); };
  // a few loose caps on the table, front left
  const loose = [];
  for (const [side, x, z, ry, y, rx] of [[1, -46, 30, 0.4, 0, 0], [-1, -41, 38, 1.1, 0, 0], [1, -52, 40, 2.0, 0, 0], [-1, -30, 46, 0.2, 0, 0], [1, -42, 33, 0.8, 0.5, 0]]) {
    const m = new THREE.Mesh(geoMan, mats[`${side}|0`]); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.castShadow = true; m.receiveShadow = true; scene.add(m); loose.push(m);
  }
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('20,8,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), CAP * 4);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const TEX = {
    dot: mk((x) => { x.fillStyle = 'rgba(40,24,6,0.55)'; x.beginPath(); x.arc(64, 64, 40, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 33, 0, 7); x.fill(); }),
    ring: mk((x) => { x.strokeStyle = 'rgba(40,24,6,0.5)'; x.lineWidth = 15; x.beginPath(); x.arc(64, 64, 48, 0, 7); x.stroke(); x.strokeStyle = '#fff'; x.lineWidth = 9; x.beginPath(); x.arc(64, 64, 48, 0, 7); x.stroke(); }),
    glow: radialTex('255,255,255', 1),
    square: mk((x) => { x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(6, 6, 116, 116); x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(6, 6, 116, 116); }),
  };
  const marks = Array.from({ length: 140 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: TEX.dot, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); return m; });

  // boards are cached per wood, size and texture size
  const boards = new Map(); let board = null, boardKey = '', boardN = 10, woodId = 'teak';
  function setBoard(id, n) {
    const k = `${id}|${n}|${TIERS[tier].tex}`; if (k === boardKey) return;
    woodId = id; boardN = n;
    let b = boards.get(k); if (!b) { b = buildBoard(id, n, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.32 : 0.6;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    boardKey = ''; setBoard(woodId, boardN);
  }
  applyTier();

  // ---------------------------------------------------------------- camera
  const cur = { yaw: 0, tilt: 58, fov: 24, dist: 120, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
  let snap = true, viewKey = '';
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), Hh = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / Hh; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, Hh, p.ox, p.oy, W, Hh); else cam.clearViewOffset();
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
  const boardPts = (n) => { const B = half(n); return [[-B, TOP, -B], [B, TOP, -B], [-B, BASE, B + 0.5], [B, BASE, B + 0.5]]; };
  const playCache = new Map();
  function playCam(rc, n) {
    const key = `${rc.x.toFixed(1)},${rc.y.toFixed(1)},${rc.w.toFixed(1)},${rc.h.toFixed(1)}|${cssW()}x${cssH()}|${cpu().toFixed(4)}|${n}`;
    let p = playCache.get(key);
    if (!p) {
      const land = cssW() > cssH();
      p = fit(rectCss(rc), boardPts(n), { yaw: 0, tilt: land ? 60 : 62, fov: 24, tx: 0, ty: TOP, tz: 0 });
      playCache.set(key, p); if (playCache.size > 24) playCache.delete(playCache.keys().next().value);
    }
    return p;
  }

  // The board plane (y = TOP) as the live camera sees it, as a homography world (x, z) <-> virtual units, recomputed once per frame after
  // the camera is placed. proj/unproj speak the 2D layer's cell units.
  let Hf = null, Hi = null;
  const q0 = { x: 0, y: 0 };
  function updateH() {
    const n = boardN, g = [[-1, -1], [n + 1, -1], [n + 1, n + 1], [-1, n + 1]], src = [], dst = [];
    for (const [a, b] of g) { const w = cellWorld(a, b, n); src.push([w.x, w.z]); const v = virt(toCss(camera, w.x, TOP, w.z, q0)); dst.push([v.x, v.y]); }
    Hf = homography(src, dst); Hi = homography(dst, src);
  }
  const ap = (h, x, y) => { const d = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d]; };
  v3.proj = (cx, cy) => { if (!Hf) updateH(); const w = cellWorld(cx, cy, boardN), p = ap(Hf, w.x, w.z); return { x: p[0], y: p[1] }; };
  v3.unproj = (x, y) => { if (!Hi) updateH(); const p = ap(Hi, x, y); return { cx: p[0] / CELL + boardN / 2, cy: p[1] / CELL + boardN / 2 }; };

  // ---------------------------------------------------------------- pieces
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), cnt = {};
  let nBlob = 0, clock = 0;
  function drawPieces(list, n) {
    for (const k of Object.keys(meshes)) cnt[k] = 0; nBlob = 0;
    for (const pc of list) {
      const key = `${pc.side}|${pc.king ? 1 : 0}`, m = meshes[key]; if (!m || cnt[key] >= CAP) continue;
      const sc = pc.s ?? 1; if (sc < 0.02) continue;
      const w = cellWorld(pc.cx, pc.cy, n), lift = (pc.lift || 0) * 2.6, y = REST + lift;
      _q.identity(); _s.set(sc, sc, sc); _p.set(w.x, y, w.z); _m.compose(_p, _q, _s); m.setMatrixAt(cnt[key]++, _m);
      const bs = R2 * 2.9 * sc * (1 + lift * 0.1), kk = pc.king ? 1.08 : 1;
      _p.set(w.x + 0.35 + lift * 0.3, TOP + 0.03, w.z + 0.3 + lift * 0.24); _q.identity(); _s.set(bs * kk, 1, bs * kk); if (nBlob < CAP * 4) blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s));
    }
    for (const k of Object.keys(meshes)) { meshes[k].count = cnt[k]; meshes[k].instanceMatrix.needsUpdate = true; }
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
  }
  const R2 = 1.72;
  const col = new THREE.Color();
  function drawMarks(list, n) {
    let k = 0;
    for (const m of list) {
      if (k >= marks.length) break;
      const q = marks[k++], w = cellWorld(m.cx, m.cy, n), kind = m.kind, a = clamp(m.a ?? 1, 0, 1);
      const r = (kind === 'dot' ? 0.75 : kind === 'glow' ? 2.6 : kind === 'square' ? 2.0 : kind === 'cursor' ? 2.0 : 1.95) * (m.r ?? 1);
      q.visible = true; q.position.set(w.x, TOP + (kind === 'glow' ? 0.08 : 0.06), w.z); q.scale.set(r * 2, 1, r * 2);
      q.material.map = kind === 'dot' ? TEX.dot : kind === 'glow' ? TEX.glow : kind === 'square' || kind === 'cursor' ? TEX.square : TEX.ring;
      col.set(m.color || MARK_COL[kind] || '#fff'); q.material.color.copy(col); q.material.opacity = a;
      q.material.blending = kind === 'glow' ? THREE.AdditiveBlending : THREE.NormalBlending; q.renderOrder = kind === 'glow' ? 3 : 2;
    }
    for (; k < marks.length; k++) marks[k].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let loseExt = null;
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, mode = '';
  function framing(state, L, t) {
    const n = state.game.n;
    if (['play', 'over'].includes(state.scene)) {
      const b = L.board, e = 4;
      return { m: 'play', n, p: playCam({ x: b.x - e, y: b.y - e, w: b.s + 2 * e, h: (b.h ?? b.s) + 2 * e }, n) };
    }
    if ((state.scene === 'title') && v3.hero) {
      const base = { yaw: -5 + 4 * Math.sin(t * Math.PI * 2 / 34), tilt: 52 + 2.5 * Math.sin(t * Math.PI * 2 / 21), fov: 28, tx: 0, ty: TOP, tz: 0 };
      return { m: 'title', n: 8, p: fit(rectCss(v3.hero), boardPts(8), base) };
    }
    // documents and menus without a board slot: the table, the board at rest on its cloth
    const U = L.U, land = L.land;
    const base = { yaw: -14 + 4 * Math.sin(t * Math.PI * 2 / 40), tilt: 34, fov: 34, tx: 0, ty: TOP, tz: 0 };
    const r = land ? { x: U.x0 + U.w * 0.06, y: U.y0 + U.h * 0.18, w: U.w * 0.5, h: U.h * 0.64 } : { x: U.x0 + U.w * 0.1, y: U.y0 + U.h * 0.3, w: U.w * 0.8, h: U.h * 0.4 };
    return { m: 'env', n: 8, p: fit(rectCss(r), boardPts(8), base) };
  }
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height);
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}|${L.key}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    const goal = framing(state, L, clock);
    v3.n = goal.n;
    const wantWood = state.wood === 'ebony' ? 'ebony' : 'teak';
    if (wantWood !== woodId || goal.n !== boardN) setBoard(wantWood, goal.n);
    const wantSet = state.set === 'wood' ? 'wood' : 'caps';
    if (wantSet !== set) { set = wantSet; setPieceSet(mats, set); applySetGeo(); }
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    if (goal.m !== mode) { if (goal.m === 'play' || mode === '') snap = true; mode = goal.m; }
    const k = snap || goal.m === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal.p)) cur[key] += (goal.p[key] - cur[key]) * k;
    snap = false;
    place(camera, cur); updateH();
    v3.pieces.length = 0; v3.marks.length = 0;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    drawPieces(mode === 'env' ? [] : v3.pieces, boardN);
    drawMarks(mode === 'env' ? [] : v3.marks, boardN);
    // lantern flicker
    const fl = 1 + 0.06 * Math.sin(clock * 9.1) + 0.04 * Math.sin(clock * 15.7 + 1.3);
    table.userData.light.intensity = 2600 * fl; table.userData.flame.scale.set(0.8, 1.7 * fl, 0.8);
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.3); v3.fade = fadeIn; canvas.style.opacity = String(fadeIn); }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; host.c3 = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const b of boards.values()) { if (board === b) scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = '';
    setPieceSet(mats, set); applyTier(); fadeIn = 0; v3.fade = 0; canvas.style.opacity = '0'; v3.on = true; host.c3 = true; canvas.style.visibility = 'visible'; snap = true; playCache.clear();
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; host.c3 = true; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.opacity = '0'; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
