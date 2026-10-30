// O An Quan 3D presenter. READS what the 2D layer asks for each frame (src/v3.js: stones, marks, the hand, the camera request) and never
// writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a red-brown clay board with carved pits on a sedge
// mat on a village veranda in morning light. The camera is fitted to the rectangle the layout reserves for the board; v3.geo hands the
// 2D layer a projection of the tilted board plane (board units <-> screen units, both ways) so taps, counts and arrows line up with
// the 3D pits. No WebGL or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene.
import * as THREE from '../vendor3d/three.js';
import { v3, TRAY } from '../src/v3.js';
import { meta } from '../src/game.js';
import { BW, BH, CELLS } from '../src/art.js';
import { K, TOP, BASE_TOP, MAT_Y, wx, wz, PEB_H, radialTex, buildBoard, buildMarks, buildTray, pieceKit, stoneColors, buildLights, buildSet } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1792 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1280 }, { name: 'low', dpr: 1, shadow: 0, tex: 768 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const D2R = Math.PI / 180, CAP = 140, TRAY_FLOOR = 1.0, POOL = 8;
const colCache = new Map();
function parseCol(s) {
  let c = colCache.get(s); if (c) return c;
  const m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).concat(1);
  else { const n = (s.match(/[\d.]+/g) || ['255', '255', '255', '1']).map(Number); c = [n[0] / 255, n[1] / 255, n[2] / 255, n[3] ?? 1]; }
  colCache.set(s, c); return c;
}
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
const applyH = (h, x, y) => { const d = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d]; };

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4a2f1c);
  scene.fog = new THREE.Fog(0x4a2f1c, 160, 520);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.3; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const set = buildSet(scene); scene.add(set);
  await tick();
  let themeId = 'lacquer', kit = pieceKit(themeId), cols = stoneColors(themeId);
  const inst = kit.geos.map((g) => { const m = new THREE.InstancedMesh(g, kit.mat, CAP); m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); return m; });
  const quans = Array.from({ length: POOL }, () => {
    const gp = new THREE.Group(), b = new THREE.Mesh(kit.qBody, kit.qMat), rg = new THREE.Mesh(kit.ringG, kit.gold), kn = new THREE.Mesh(kit.knobG, kit.gold), bd = new THREE.Mesh(kit.band, kit.gold);
    [b, rg, kn, bd].forEach((m) => { m.castShadow = true; m.receiveShadow = true; gp.add(m); }); gp.visible = false; scene.add(gp); return gp;
  });
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flat, new THREE.MeshBasicMaterial({ map: radialTex('20,6,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), CAP + 16);
  blobs.renderOrder = 2; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  const marks = buildMarks(); marks.forEach((m) => { scene.add(m.ring); scene.add(m.fill); });
  const trays = [buildTray(themeId, 2), buildTray(themeId, 1)]; trays.forEach((t) => scene.add(t));

  // boards are cached per theme and texture size
  const boards = new Map(); let board = null, boardKey = '';
  function setTheme(id) {
    const k = `${id}|${TIERS[tier].tex}`; if (k === boardKey) return;
    themeId = id; v3.theme = id;
    let b = boards.get(k); if (!b) { b = buildBoard(id, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
    kit.setTheme(id); cols = stoneColors(id);
    trays.forEach((t) => scene.remove(t)); trays.forEach((t) => t.userData.dispose()); trays[0] = buildTray(id, 2); trays[1] = buildTray(id, 1); trays.forEach((t) => scene.add(t));
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.32 : 0.6;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    setTheme(themeId);
  }
  applyTier();

  // ---------------------------------------------------------------- camera
  const cur = { yaw: 0, tilt: 55, fov: 26, dist: 90, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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
    const p = { ...base, ox: 0, oy: 0, dist: 120 }, q = { x: 0, y: 0 }; let bb = null;
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
  const BWc = BW * K / 2 - 0.2, BHc = BH * K / 2 - 0.2, TY = TRAY.h * K;
  const BOARD_PTS = [[-BWc, TOP, -BHc], [BWc, TOP, -BHc], [-BWc, TOP, BHc], [BWc, TOP, BHc], [-BWc, MAT_Y, BHc + 0.4], [BWc, MAT_Y, BHc + 0.4]];
  const TRAY_PTS = [[-BWc, TOP, -BHc - (TRAY.gap + TRAY.h) * K], [BWc, TOP, -BHc - (TRAY.gap + TRAY.h) * K], [-BWc, MAT_Y, BHc + (TRAY.gap + TRAY.h) * K], [BWc, MAT_Y, BHc + (TRAY.gap + TRAY.h) * K]];
  void TY;
  const playCache = new Map();
  function playCam(rc, withTrays) {
    const key = `${rc.x.toFixed(1)},${rc.y.toFixed(1)},${rc.w.toFixed(1)},${rc.h.toFixed(1)}|${cssW()}x${cssH()}|${cpu().toFixed(4)}|${withTrays}`;
    let p = playCache.get(key);
    if (!p) {
      const land = cssW() > cssH();
      p = fit(rectCss(rc), withTrays ? BOARD_PTS.concat(TRAY_PTS) : BOARD_PTS, { yaw: 0, tilt: withTrays ? 58 : land ? 52 : 50, fov: 26, tx: 0, ty: TOP, tz: 0 });
      playCache.set(key, p); if (playCache.size > 24) playCache.delete(playCache.keys().next().value);
    }
    return p;
  }

  // ---------------------------------------------------------------- board plane <-> screen
  let Hf = null, Hi = null, hKey = 0;
  const q0 = { x: 0, y: 0 };
  function updateH() {
    const g = [[-60, -60], [BW + 60, -60], [BW + 60, BH + 60], [-60, BH + 60]], src = [], dst = [];
    for (const [a, b] of g) { src.push([a, b]); const v = virt(toCss(camera, wx(a), TOP, wz(b), q0)); dst.push([v.x, v.y]); }
    Hf = homography(src, dst); Hi = homography(dst, src); hKey++;
  }
  v3.geo = () => {
    if (!Hf) updateH();
    const toScreen = (lx, ly) => applyH(Hf, lx, ly), toLocal = (sx, sy) => applyH(Hi, sx, sy);
    const cs = [toScreen(0, 0), toScreen(BW, 0), toScreen(BW, BH), toScreen(0, BH)];
    const xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]), x = Math.min(...xs), y = Math.min(...ys);
    const a = toScreen(BW / 2 - 50, BH / 2), b = toScreen(BW / 2 + 50, BH / 2), c = toScreen(BW / 2, BH / 2 - 50), d = toScreen(BW / 2, BH / 2 + 50);
    const sx = Math.hypot(b[0] - a[0], b[1] - a[1]) / 100, sy = Math.hypot(d[0] - c[0], d[1] - c[1]) / 100;
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, sc: (sx + sy) / 2, sx, sy, toLocal, toScreen, p3: true, key: `3d${hKey}` };
  };

  // ---------------------------------------------------------------- stones
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  const counts = [0, 0, 0]; let nBlob = 0, nQ = 0;
  const begin = () => { counts[0] = counts[1] = counts[2] = 0; nBlob = 0; nQ = 0; };
  function blob(x, y, z, s, a = 1) { if (nBlob >= CAP + 16) return; _p.set(x + 0.18, y + 0.04, z + 0.16); _q.identity(); _s.set(s * 1.5, 1, s * 1.5 * a); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s)); }
  function pebble(x, y, z, seed, sc = 1, sy = 1, tilt = 0, shadow = null) {
    const v = Math.floor(hash(seed, 1) * 3) % 3, i = counts[v]; if (i >= CAP) return;
    const s = (1.1 + hash(seed, 2) * 0.16) * sc;
    _e.set(tilt, hash(seed, 3) * 6.28, 0, 'YXZ'); _q.setFromEuler(_e); _s.set(s, s * sy, s * (0.92 + hash(seed, 4) * 0.12)); _p.set(x, y, z);
    inst[v].setMatrixAt(i, _m.compose(_p, _q, _s));
    const c = cols[Math.floor(hash(seed, 7) * cols.length) % cols.length]; _c.copy(c).multiplyScalar(0.92 + hash(seed, 8) * 0.12); inst[v].setColorAt(i, _c);
    counts[v]++;
    if (shadow !== null) blob(x, shadow, z, s * 1.1);
  }
  function quan(x, y, z, sc = 1, glow = 0) { if (nQ >= POOL) return; const g = quans[nQ++]; g.visible = true; g.position.set(x, y, z); g.scale.setScalar(sc * 1.15 * (1 + glow * 0.02)); g.rotation.y = 0.6; }
  function endStones() { inst.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;  }); for (let i = nQ; i < POOL; i++) quans[i].visible = false; blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true; }

  let clock = 0;
  function drawStones() {
    begin();
    const byCell = new Map(), trayMap = new Map();
    for (const s of v3.stones) {
      if (s.cell !== undefined) { let a = byCell.get(s.cell); if (!a) byCell.set(s.cell, a = []); a.push(s); }
    }
    // resting stones in a pit: stack by overlap so a heap has real depth
    for (const [cell, arr] of byCell) {
      arr.sort((a, b) => a.k - b.k);
      const hs = [];
      for (let i = 0; i < arr.length; i++) {
        const a = arr[i]; let h = 0;
        if (a.kind === 'd') for (let j = 0; j < i; j++) { const b = arr[j]; if (b.kind !== 'd') { if (Math.hypot(a.x - b.x, a.y - b.y) * K < 2.6) h = Math.max(h, hs[j] + 1.4); continue; } const d = Math.hypot(a.x - b.x, a.y - b.y) * K; if (d < 2.05) h = Math.max(h, hs[j] + 0.62 * (1 - d / 2.4) + 0.5); }
        hs[i] = Math.min(h, 4.4);
        const x = wx(a.x), z = wz(a.y), hop = (a.lift || 0) * K, base = BASE_TOP + (a.kind === 'q' ? 0.02 : PEB_H * 1.1) + hs[i];
        if (a.kind === 'q') quan(x, base + hop, z, 1, a.glow || 0);
        else { const sq = hop > 0.01 ? 1 : 1; pebble(x, base + hop, z, a.seed, 1, sq, hop > 0.05 ? 0.12 : 0, hop > 0.02 ? base : null); }
      }
      void cell;
    }
    void trayMap;
    for (const s of v3.stones) {
      if (s.cell !== undefined) continue;
      const x = wx(s.x), z = wz(s.y);
      if (s.tray) { const y = TRAY_FLOOR + (s.kind === 'q' ? 0 : PEB_H * 1.1 + s.layer * 0.95); if (s.kind === 'q') quan(x, TRAY_FLOOR + 0.02, z, 0.86); else pebble(x, y, z, s.seed, 0.92); continue; }
      const lift = (s.lift || 0) * K;
      if (s.kind === 'q') { const y = (s.fly ? 2.7 : TOP + 0.2) + lift; quan(x, y, z, s.scale ?? 1); blob(x, MAT_Y + 0.5, z, 2.4); }
      else { const y = (s.fly ? 2.7 : TOP + 0.5) + lift; pebble(x, y, z, s.seed, s.scale ?? 1, 1, 0.2 * Math.sin(clock * 9 + s.seed)); blob(x, TOP + 0.05, z, 1.1 * (1 + lift * 0.1)); }
    }
    endStones();
  }
  function drawMarks() {
    let used = new Set();
    for (const mk of v3.marks) {
      const m = marks[mk.cell]; if (!m) continue;
      const [r, g, b, al] = parseCol(mk.col), a = clamp((mk.a ?? 1) * al, 0, 1.2), t = mk.fill ? m.fill : m.ring;
      const k = mk.fill ? 0.3 : 1.0; // additive glow: the fill is only a tint, the ring is the clear mark
      t.visible = true; t.material.color.setRGB(r * r * a * k, g * g * a * k, b * b * a * k); t.material.opacity = 1;
      const sc = 1 + (mk.grow || 0) * 0.012; if (!mk.fill) { t.scale.set(sc, 1, sc); t.position.x = wx(CELLS[mk.cell].cx) * (1 - sc); t.position.z = wz(CELLS[mk.cell].cy) * (1 - sc); }
      used.add(t);
    }
    for (const m of marks) { if (!used.has(m.ring)) m.ring.visible = false; if (!used.has(m.fill)) m.fill.visible = false; }
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, mode = '', shown = false;
    function goalFor(req, t) {
    const W = cssW(), H = cssH(), land = W > H;
    if (req && req.mode === 'play') return { m: 'play', p: playCam(req.rect, req.trays) };
    if (req && req.mode === 'title') {
      const base = { yaw: -7 + 5 * Math.sin(t * Math.PI * 2 / 36), tilt: 45 + 2.5 * Math.sin(t * Math.PI * 2 / 23), fov: 28, tx: 0, ty: TOP, tz: 0 };
      return { m: 'title', p: fit(rectCss(req.rect), BOARD_PTS, base) };
    }
    const base = { yaw: -18 + 5 * Math.sin(t * Math.PI * 2 / 40), tilt: 34, fov: 34, tx: 0, ty: TOP, tz: 0 };
    const rc = land ? { x: W * 0.05, y: H * 0.14, w: W * 0.5, h: H * 0.6 } : { x: W * 0.06, y: H * 0.16, w: W * 0.88, h: H * 0.36 };
    return { m: 'env', p: fit(rc, BOARD_PTS.concat([[-46, 6, 13]]), base) };
  }
  function pre() {
    if (!game || lost) return;
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const req = v3.req; v3.req = null;
    if (v3.theme !== themeId) setTheme(v3.theme);
    const goal = goalFor(req, clock);
    if (goal.m !== mode) { if (goal.m === 'play' || mode === '') snap = true; mode = goal.m; }
    const k = snap || goal.m === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal.p)) cur[key] += (goal.p[key] - cur[key]) * k;
    snap = false;
    place(camera, cur); updateH();
    v3.stones.length = 0; v3.marks.length = 0; v3.hand = null; curReq = req;
  }
  let curReq = null;
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    trays.forEach((t) => { t.visible = mode === 'play' && Boolean(curReq && curReq.trays); });
    drawStones(); drawMarks();
    set.userData.update(clock);
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    if (!shown) { shown = true; kitCanvas.style.transition = 'opacity .35s'; kitCanvas.style.opacity = '1'; }
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv();
    for (const b of boards.values()) { if (board === b) scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = '';
    applyTier(); v3.on = true; canvas.style.visibility = 'visible'; snap = true; playCache.clear(); shown = false; kitCanvas.style.opacity = '0';
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; snap = true; canvas.style.visibility = 'visible'; kitCanvas.style.opacity = '0'; shown = false; v3.on = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
  };
}
