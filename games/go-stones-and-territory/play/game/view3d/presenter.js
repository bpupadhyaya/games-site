// Go 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js: stones and marks),
// never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a thick kaya goban, slate and shell stones,
// two go-ke bowls with lids, on tatami in front of a glowing shoji screen. On the play screens the camera is fitted to the layout's
// board rectangle and v3 hands the 2D layer a projection of the tilted board (pt / hit), so taps, the aim cross-hair and the
// coordinate tag line up with the 3D crossings. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D
// art; a restored context rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layout, titleLay } from '../src/layout.js';
import { SIDE, HALF, TOP, LEG, STONE_H, BOWL_X, BOWL_Z, spacing, stoneRadius, pointXZ, radialTex, markTextures, buildBoard, stoneGeo, stoneMaterials, buildBowl, buildRoom, buildLights, lidCentre, bowlCentre } from './world.js';

const D2R = Math.PI / 180, CAP = 520;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sm = (k) => k * k * (3 - 2 * k);
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1536 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const FALL = 0.2, SETTLE = 0.36;
// the position shown on menus and documents (a 9 x 9 opening)
const ENV = [[40, 1], [22, 2], [58, 1], [50, 2], [23, 1], [31, 2], [41, 1], [32, 2], [33, 1], [24, 2], [42, 1], [49, 2]];
const colCache = new Map();
function parseCol(s) {
  let c = colCache.get(s); if (c) return c;
  const m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  else { const n = (String(s).match(/[\d.]+/g) || ['255', '255', '255']).slice(0, 3).map(Number); c = n.map((v) => v / 255); }
  colCache.set(s, c); return c;
}

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
const applyH = (h, x, z) => { const d = h[6] * x + h[7] * z + 1; return [(h[0] * x + h[1] * z + h[2]) / d, (h[3] * x + h[4] * z + h[5]) / d]; };

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2112);
  scene.fog = new THREE.Fog(0x3a2d18, 190, 620);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.42; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const room = buildRoom(scene);
  await tick();
  const bowlGroups = [1, 2].map((k) => { const b = buildBowl(k), c = bowlCentre(k); b.position.set(c.x, 0, c.z); scene.add(b); return b; });
  const geo = stoneGeo(), mats = stoneMaterials();
  const inst = {};
  for (const k of ['1', '2', 'g1', 'g2']) { const m = new THREE.InstancedMesh(geo, mats[k], CAP); m.castShadow = !k.startsWith('g'); m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); inst[k] = m; }
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.4 }), CAP);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  const MT = markTextures();
  const marks = Array.from({ length: 128 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: MT.ring, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; });
  // a puff of fine dust where a stone is lifted off
  const dustT = radialTex('236,214,170', 0.8);
  const dust = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, y, z, s = 1) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, y, z, s }; };

  // boards are cached per size, wood and texture size
  const boards = new Map(); let board = null, boardKey = '', themeId = 'kaya', curN = 9, Rs = stoneRadius(9);
  function setBoard(n, theme) {
    const k = `${n}|${theme}|${TIERS[tier].tex}`; if (k === boardKey) return;
    let b = boards.get(k); if (!b) { b = buildBoard(n, theme, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b); curN = n; themeId = theme; Rs = stoneRadius(n);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.22 : 0.5;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    setBoard(curN, themeId);
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 52, fov: 26, dist: 120, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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
    const p = { ...base, ox: 0, oy: 0, dist: 150 }, q = { x: 0, y: 0 }; let bb = null;
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

  const B = HALF + 0.3;
  const BOARD_PTS = [[-B, TOP, -B], [B, TOP, -B], [-B, TOP, B], [B, TOP, B], [-B, LEG + 3, B + 0.8], [B, LEG + 3, B + 0.8]];
  const bowlPts = () => {
    const a = bowlCentre(1), b = bowlCentre(2), ex = 4.6;
    return [[a.x - ex, 0, a.z + ex], [b.x + ex, 0, b.z + ex], [a.x - ex, 0, a.z - ex], [b.x + ex, 0, b.z - ex], [a.x - ex, 4.6, a.z], [b.x + ex, 4.6, b.z]];
  };
  const playCache = new Map();
  function playCam(rc) {
    const key = `${rc.x},${rc.y},${rc.w},${rc.h}|${cssW()}x${cssH()}|${cpu().toFixed(4)}|${SIDE.on}`;
    let p = playCache.get(key);
    if (!p) {
      p = fit(rectCss(rc), BOARD_PTS.concat(bowlPts()), { yaw: 0, tilt: 68, fov: 24, tx: 0, ty: TOP, tz: 0 });
      playCache.set(key, p); if (playCache.size > 24) playCache.delete(playCache.keys().next().value);
    }
    return p;
  }
  const PLAY_PTS = BOARD_PTS.concat(bowlPts());
  const placeBowls = () => bowlGroups.forEach((b, i) => { const c = bowlCentre(i + 1); b.position.set(c.x, 0, c.z); });

  // The board plane (y = TOP) as the live camera sees it, as a homography world (x, z) -> virtual units and back. Recomputed once per
  // frame after the camera is placed, so taps, rings and the aim cross-hair use exactly what is on screen.
  let H8 = null, HI = null;
  const q0 = { x: 0, y: 0 };
  function updateH() {
    const g = [[-HALF, -HALF], [HALF, -HALF], [HALF, HALF], [-HALF, HALF]], src = [], dst = [];
    for (const [a, b] of g) { src.push([a, b]); const v = virt(toCss(camera, a, TOP, b, q0)); dst.push([v.x, v.y]); }
    H8 = homography(src, dst); HI = homography(dst, src);
  }
  v3.ptc = (n, c, r) => { if (!H8) updateH(); const d = spacing(n); return applyH(H8, (c - (n - 1) / 2) * d, (r - (n - 1) / 2) * d); };
  v3.pt = (n, i) => v3.ptc(n, i % n, Math.floor(i / n));
  v3.u = (n) => { const m = (n - 1) / 2, a = v3.ptc(n, m, m), b = v3.ptc(n, m + 1, m), c = v3.ptc(n, m, m + 1); return (Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - a[0], c[1] - a[1])) / 2; };
  v3.hit = (n, x, y) => {
    if (!HI) updateH();
    const [wx, wz] = applyH(HI, x, y), d = spacing(n), c = wx / d + (n - 1) / 2, r = wz / d + (n - 1) / 2;
    if (c < -0.9 || r < -0.9 || c > n - 0.1 || r > n - 0.1) return -1;
    return clamp(Math.round(r), 0, n - 1) * n + clamp(Math.round(c), 0, n - 1);
  };

  // ---------------------------------------------------------------- stones
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const counts = {}; let nBlob = 0;
  const begin = () => { for (const k in inst) counts[k] = 0; nBlob = 0; };
  function put(key, x, y, z, yaw, o = {}) {
    const m = inst[key]; if (!m || counts[key] >= CAP) return;
    const sc = (o.sc ?? 1) * (o.r ?? Rs); if (sc < 0.01) return;
    _e.set(o.tx ?? 0, yaw, o.tz ?? 0, 'YXZ'); _q.setFromEuler(_e); _s.set(sc, sc * (o.sy ?? 1), sc); _p.set(x, y, z);
    _m.compose(_p, _q, _s); m.setMatrixAt(counts[key]++, _m);
    if (nBlob < CAP && !key.startsWith('g')) {
      const g0 = o.ground ?? TOP, lift = Math.max(0, y - g0), s = (o.r ?? Rs) * 2.5 * (o.sc ?? 1) * (1 + lift * 0.07);
      _p.set(x + 0.18 + lift * 0.18, g0 + 0.035, z + 0.2 + lift * 0.2); _q.identity(); _s.set(s, 1, s); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s));
    }
  }
  function end() {
    for (const k in inst) { inst[k].count = counts[k]; inst[k].instanceMatrix.needsUpdate = true; }
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
  }
  const yawOf = (i, who) => hash(i, who * 17) * 6.283;

  let clock = 0;
  let known = new Set(), sig = '';
  const lidSeen = { 1: 0, 2: 0 }, bornAt = new Map(), lidAt = new Map(), capSeen = new Set();
  function drawBowlHeaps() {
    // the bowls on the floor, heaped with the stones not yet played
    for (const k of [1, 2]) {
      const c = bowlCentre(k);
      for (let j = 0; j < 20; j++) {
        const a = hash(j, k) * 6.283 + j * 2.4, d = Math.sqrt(hash(j, k + 9)) * 3.4, layer = j < 12 ? 0 : 1, dd = (layer ? d * 0.6 : d) * 0.6;
        put(String(k), c.x + Math.cos(a) * dd, 1.3 + layer * 0.4, c.z + Math.sin(a) * dd, hash(j, k + 3) * 6.28, { r: 0.64, tx: (hash(j, 5) - 0.5) * 0.3, tz: (hash(j, 6) - 0.5) * 0.3, ground: 0.9 });
      }
    }
  }
  function drawPrisoners() {
    // each side's lid holds the stones it has taken: Black's lid the white ones and the other way round
    for (const k of [1, 2]) {
      const c = lidCentre(k), cnt = Math.min(v3.caps[k] || 0, 40), enemy = k === 1 ? 2 : 1;
      if (cnt > lidSeen[k] && lidSeen[k] > 0 || (cnt > lidSeen[k] && cnt <= 3)) for (let j = lidSeen[k]; j < cnt; j++) lidAt.set(`${k}|${j}`, clock);
      lidSeen[k] = cnt;
      for (let j = 0; j < cnt; j++) {
        const ring = j < 7 ? 0 : j < 18 ? 1 : 2, idx = ring === 0 ? j : ring === 1 ? j - 7 : j - 18, per = ring === 0 ? 7 : ring === 1 ? 11 : 22;
        const a = (idx / per) * 6.283 + ring * 0.7, d = (ring === 0 ? (cnt > 1 ? 1.6 : 0) : ring === 1 ? 2.5 : 3.2) * 0.62;
        let y = 0.5 + (ring === 2 ? 0.3 : 0), tx = 0;
        const born = lidAt.get(`${k}|${j}`);
        if (born != null) { const s = (clock - born) / SETTLE; if (s >= 1) lidAt.delete(`${k}|${j}`); else if (s < 0.4) y += (1 - s / 0.4) * 3.5; else tx = Math.sin(s * 12) * 0.05 * (1 - s); }
        put(String(enemy), c.x + Math.cos(a) * d, y, c.z + Math.sin(a) * d, hash(j, k) * 6.28, { r: 0.66, tx, ground: 0.4 });
      }
    }
  }
  function drawPieces(list, mode) {
    begin();
    const keysNow = new Set(), fresh = [];
    for (const pc of list) { if (!pc.ghost && !pc.dead && pc.cap == null) { const key = `${pc.i}|${pc.who}`; keysNow.add(key); if (!known.has(key)) fresh.push(key); } }
    const silent = fresh.length > 3 || sig !== `${mode}|${curN}`;
    sig = `${mode}|${curN}`;
    if (!silent) for (const key of fresh) bornAt.set(key, clock);
    known = keysNow;
    const capNow = new Set();
    for (const pc of list) {
      const w = pointXZ(curN, pc.i), sc = pc.sc ?? 1, key = `${pc.i}|${pc.who}`, yaw = yawOf(pc.i, pc.who);
      if (pc.ghost) { put(`g${pc.who}`, w.x, TOP + Rs * (0.9 + 0.12 * Math.sin(clock * 5)), w.z, yaw, { sc }); continue; }
      if (pc.dead) { put(`g${pc.who}`, w.x, TOP + 0.01, w.z, yaw, { sc }); continue; }
      if (pc.cap != null) {
        // a captured stone is lifted off the board, turns and is gone
        const e = sm(clamp(pc.cap, 0, 1)); capNow.add(key);
        if (!capSeen.has(key)) { capSeen.add(key); puff(w.x, TOP + 0.1, w.z, 0.9); }
        put(String(pc.who), w.x, TOP + e * Rs * 4.5, w.z, yaw + e * 3, { sc: sc * (1 - e * e), tx: e * 0.6 });
        continue;
      }
      let y = TOP + 0.005, tx = 0, tz = 0, sy = 1, s2 = sc;
      const born = bornAt.get(key);
      if (born != null) {
        const t = clock - born;
        if (t < FALL) { const k = t / FALL; y += (1 - k * k) * Rs * 3.2; s2 *= 1 + (1 - k) * 0.06; }
        else if (t < FALL + SETTLE) { const s = (t - FALL) / SETTLE, d = (1 - s) * (1 - s); y += Math.abs(Math.sin(s * Math.PI * 2)) * Rs * 0.28 * d; sy = 1 - Math.sin(Math.min(1, s * 4) * Math.PI) * 0.1; tx = Math.sin(s * Math.PI * 4) * 0.07 * d; tz = Math.cos(s * Math.PI * 3) * 0.04 * d; }
        else bornAt.delete(key);
      }
      put(String(pc.who), w.x, y, w.z, yaw, { sc: s2, sy, tx, tz });
    }
    for (const k of [...bornAt.keys()]) if (!keysNow.has(k)) bornAt.delete(k);
    for (const k of [...capSeen]) if (!capNow.has(k)) capSeen.delete(k);
    const showBowls = mode !== 'title'; bowlGroups.forEach((b) => { b.visible = showBowls; });
    if (showBowls) { drawBowlHeaps(); drawPrisoners(); }
    end();
  }
  function drawMarks(list) {
    let k = 0;
    for (const mk of list) {
      if (k >= marks.length || mk.i < 0) continue;
      const m = marks[k++], w = pointXZ(curN, mk.i), s = mk.r * Rs * 2;
      m.visible = true; m.position.set(w.x, mk.top ? TOP + Rs * STONE_H + 0.03 : TOP + 0.045, w.z); m.scale.set(s, 1, s);
      m.material.map = MT[mk.kind] || MT.ring;
      const [cr, cg, cb] = parseCol(mk.col), a = clamp(mk.a ?? 1, 0, 1);
      m.material.color.setRGB(cr * cr, cg * cg, cb * cb); m.material.opacity = a;
    }
    for (; k < marks.length; k++) marks[k].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, mode = '';
  function framing(state, t) {
    const L = layout(), sc = state.scene;
    if (sc === 'play' || sc === 'autoplay' || sc === 'lesson' || sc === 'puzzle') {
      return { m: 'play', n: state.g.n, p: playCam(L.play.stage) };
    }
    if (sc === 'title') {
      const T = titleLay(!!state.saved);
      if (T.board) {
        const b = T.board, base = { yaw: -7 + 5 * Math.sin(t * Math.PI * 2 / 34), tilt: 40 + 2.5 * Math.sin(t * Math.PI * 2 / 21), fov: 28, tx: 0, ty: TOP, tz: 0 };
        return { m: 'title', n: 9, p: fit(rectCss({ x: b.x - 12, y: b.y - 10, w: b.size + 24, h: b.size + 20 }), BOARD_PTS, base) };
      }
    }
    // documents, menus and a title without room for the hero board: the room, the goban at rest under the window light
    const land = L.mode === 'wide', W = L.w, H = L.h;
    const base = { yaw: -16 + 5 * Math.sin(t * Math.PI * 2 / 40), tilt: 30, fov: 32, tx: 0, ty: TOP, tz: 0 };
    const r = land ? { x: W * 0.06, y: H * 0.18, w: W * 0.5, h: H * 0.62 } : { x: W * 0.06, y: H * 0.3, w: W * 0.88, h: H * 0.42 };
    return { m: 'env', n: sc === 'setup' ? state.setup.n : 9, p: fit(rectCss(r), PLAY_PTS, base) };
  }
  function pre() {
    if (!game || lost) return;
    const state = game.getState();
    const vk = `${cssW()}x${cssH()}|${layout().key}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const sideNow = !!(layout().play.sideBowls && ['play', 'autoplay', 'lesson', 'puzzle'].includes(state.scene));
    if (sideNow !== SIDE.on) { SIDE.on = sideNow; placeBowls(); }
    const goal = framing(state, clock);
    if (goal.n !== curN || state.prefs.theme !== themeId) setBoard(goal.n, state.prefs.theme);
    v3.theme = themeId; v3.n = goal.n;
    if (goal.m !== mode) { if (goal.m === 'play' || mode === '') snap = true; mode = goal.m; }
    const k = snap || goal.m === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal.p)) cur[key] += (goal.p[key] - cur[key]) * k;
    snap = false;
    place(camera, cur); updateH();
    v3.pieces.length = 0; v3.marks.length = 0; v3.hero = mode === 'title';
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const list = mode === 'env' ? ENV.map(([i, who]) => ({ who, i })) : v3.pieces;
    drawPieces(list, mode);
    drawMarks(mode === 'play' ? v3.marks : []);
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.6)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.6), s = (2 + f * 6) * u.s;
      m.visible = true; m.position.set(u.x, u.y + f * 0.6, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.4 * (1 - f) * (1 - f);
    }
    // the paper lamp breathes
    const f = 1 + 0.03 * Math.sin(clock * 2.1) + 0.02 * Math.sin(clock * 5.3 + 1.7);
    room.userData.lamp.halo.material.opacity = clamp(0.8 * f, 0, 1);
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const b of boards.values()) { if (board === b) scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = '';
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true; playCache.clear();
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();
  // build the other two board sizes while the player is still on the menu
  const warm = async () => { for (const n of [13, 19]) { await tick(); await tick(); if (!lost) { const k = `${n}|${themeId}|${TIERS[tier].tex}`; if (!boards.has(k)) boards.set(k, buildBoard(n, themeId, TIERS[tier].tex)); } } };

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; setTimeout(warm, 1500); },
    pre, post,
    get tier() { return TIERS[tier].name; },
  };
}
