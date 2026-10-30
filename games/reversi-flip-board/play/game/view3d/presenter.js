// Reversi 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js: discs and marks),
// never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a limestone board with a zellige border on a
// striped rug in a sunlit courtyard, with thick two-glaze ceramic discs that really turn over. On the play screens the camera is fitted
// to the layout's board rectangle, and v3.pt / v3.hit hand the 2D layer the projection of the tilted board, so taps, hint counts and
// marks line up with what is on screen. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a
// restored context rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor, host } from '../src/layout.js';
import { TOP, BASE, DH, DR, CELL, half, gridPos, cellPos, radialTex, buildBoard, discGeo, discMaterials, setDiscStyle, buildCourtyard, buildLights } from './world.js';

const D2R = Math.PI / 180, CAP = 72;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sm = (k) => k * k * (3 - 2 * k);
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1536 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const REST = TOP + DH / 2 + 0.03;
const THEMES_OK = new Set(['emerald', 'midnight', 'wine']);
const MARK_COL = { dot: '#e8a21c', chosen: '#2fbf6a', ring: '#e8a21c', last: '#ffd24a', cursor: '#38d27a', glow: '#fff2c0', target: '#e8a21c' };

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.86;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9d3b0);
  scene.fog = new THREE.Fog(0xe9d3b0, 260, 700);
  const camera = new THREE.PerspectiveCamera(26, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.5; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  buildCourtyard(scene);
  await tick();
  const geo = discGeo();
  let style = 'gloss';
  const mats = discMaterials(style);
  const disc = new THREE.InstancedMesh(geo, mats, CAP); disc.castShadow = true; disc.receiveShadow = true; disc.count = 0; disc.frustumCulled = false; scene.add(disc);
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('30,12,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), CAP);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  // marks: light and paint lying on the board surface (hints, last move, lesson target)
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const TEX = {
    dot: mk((x) => { x.fillStyle = 'rgba(40,24,6,0.55)'; x.beginPath(); x.arc(64, 64, 40, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 33, 0, 7); x.fill(); }),
    ring: mk((x) => { x.strokeStyle = 'rgba(40,24,6,0.5)'; x.lineWidth = 15; x.beginPath(); x.arc(64, 64, 48, 0, 7); x.stroke(); x.strokeStyle = '#fff'; x.lineWidth = 9; x.beginPath(); x.arc(64, 64, 48, 0, 7); x.stroke(); }),
    glow: radialTex('255,255,255', 1),
    square: mk((x) => { x.fillStyle = 'rgba(255,255,255,0.45)'; x.fillRect(10, 10, 108, 108); x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(10, 10, 108, 108); }),
  };
  const marks = Array.from({ length: 80 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: TEX.dot, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); return m; });

  // boards are cached per theme, size and texture size
  const boards = new Map(); let board = null, boardKey = '', boardN = 8, themeId = 'emerald';
  function setBoard(id, n) {
    const k = `${id}|${n}|${TIERS[tier].tex}`; if (k === boardKey) return;
    themeId = id; boardN = n;
    let b = boards.get(k); if (!b) { b = buildBoard(id, n, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.3 : 0.6;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    boardKey = ''; setBoard(themeId, boardN);
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 62, fov: 24, dist: 120, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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
  const boardPts = (n) => { const B = half(n); return [[-B, TOP, -B], [B, TOP, -B], [-B, BASE, B + 0.4], [B, BASE, B + 0.4]]; };
  const playCache = new Map();
  function playCam(rc, n) {
    const key = `${rc.x.toFixed(1)},${rc.y.toFixed(1)},${rc.w.toFixed(1)},${rc.h.toFixed(1)}|${cssW()}x${cssH()}|${cpu().toFixed(4)}|${n}`;
    let p = playCache.get(key);
    if (!p) {
      const land = cssW() > cssH();
      p = fit(rectCss(rc), boardPts(n), { yaw: 0, tilt: land ? 50 : 56, fov: 24, tx: 0, ty: TOP, tz: 0 });
      playCache.set(key, p); if (playCache.size > 24) playCache.delete(playCache.keys().next().value);
    }
    return p;
  }

  // The board plane (y = TOP) as the live camera sees it: a homography world (x, z) -> virtual units, recomputed once per frame after the
  // camera is placed, so taps, counts and marks use exactly what is on screen.
  let H8 = null;
  const q0 = { x: 0, y: 0 };
  function updateH() {
    const g = [[-2, -2], [boardN + 1, -2], [boardN + 1, boardN + 1], [-2, boardN + 1]], src = [], dst = [];
    for (const [a, b] of g) { const w = gridPos(a, b, boardN, false); src.push([w.x, w.z]); const v = virt(toCss(camera, w.x, TOP, w.z, q0)); dst.push([v.x, v.y]); }
    H8 = homography(src, dst);
  }
  const apply = (x, z) => { const h = H8, d = h[6] * x + h[7] * z + 1; return [(h[0] * x + h[1] * z + h[2]) / d, (h[3] * x + h[4] * z + h[5]) / d]; };
  const cellScr = (i) => {
    const n = boardN, f = v3.flip, c = i % n, r = Math.floor(i / n), w = gridPos(c, r, n, f), p = apply(w.x, w.z);
    const a = apply(w.x + CELL / 2, w.z), b = apply(w.x - CELL / 2, w.z), e = apply(w.x, w.z - CELL / 2), g = apply(w.x, w.z + CELL / 2);
    return { x: p[0], y: p[1], sx: Math.hypot(a[0] - b[0], a[1] - b[1]) / 2, sy: Math.hypot(g[0] - e[0], g[1] - e[1]) / 2 };
  };
  v3.pt = (i) => { if (!H8) updateH(); return cellScr(i); };
  v3.hit = (px, py) => {
    if (!H8) updateH();
    let best = -1, bd = 0.62;
    for (let i = 0; i < boardN * boardN; i++) { const c = cellScr(i), d = Math.hypot((px - c.x) / (c.sx * 2), (py - c.y) / (c.sy * 2)); if (d < bd) { bd = d; best = i; } }
    return best;
  };

  // ---------------------------------------------------------------- discs
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  let nDisc = 0, nBlob = 0, clock = 0;
  function put(x, y, z, rotX, yaw, sc = 1, ground = TOP) {
    if (nDisc >= CAP || sc < 0.01) return;
    _e.set(rotX, yaw, 0, 'YXZ'); _q.setFromEuler(_e); _s.set(sc, sc, sc); _p.set(x, y, z);
    _m.compose(_p, _q, _s); disc.setMatrixAt(nDisc++, _m);
    const lift = Math.max(0, y - REST), s = DR * 2.9 * sc * (1 + lift * 0.08);
    _p.set(x + 0.3 + lift * 0.28, ground + 0.03, z + 0.26 + lift * 0.22); _q.identity(); _s.set(s, 1, s); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s));
  }
  function drawDiscs(list) {
    nDisc = 0; nBlob = 0;
    for (const pc of list) {
      const w = cellPos(pc.i, v3.n, v3.flip), a = pc.a, sc = pc.sc ?? 1, yaw = hash(pc.i, 3) * 6.283;
      let y = REST, rot = pc.who === 1 ? 0 : Math.PI, s = sc;
      if (a && a.kind === 'place') {
        const e = sm(clamp(a.k, 0, 1)), age = a.age ?? 0;
        y = REST + (1 - e) * 7 + (e >= 1 ? Math.abs(Math.sin(age * 16)) * 0.32 * Math.exp(-age * 7) : 0); s = sc * (0.82 + 0.18 * e);
        rot = (pc.who === 1 ? 0 : Math.PI) + (1 - e) * 0.5;
      } else if (a && a.kind === 'flip') {
        const f = clamp(a.k, 0, 1), e = sm(f);
        rot = (a.from === 1 ? 0 : Math.PI) + e * Math.PI;
        y = REST + Math.sin(Math.PI * f) * 3.4 * (a.high ?? 1);
      } else if (a && a.kind === 'lift') { y = REST + (a.k ?? 0) * 1.1 + Math.sin(clock * 4) * 0.12; }
      put(w.x, y, w.z, rot, yaw, s, TOP);
    }
    disc.count = nDisc; disc.instanceMatrix.needsUpdate = true;
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
  }
  const col = new THREE.Color();
  function drawMarks(list) {
    let k = 0;
    const occ = new Set(v3.pieces.filter((p) => !p.a || p.a.kind !== 'place').map((p) => p.i));
    for (const m of list) {
      if (k >= marks.length || m.i < 0 || m.i >= v3.n * v3.n) continue;
      const q = marks[k++], w = cellPos(m.i, v3.n, v3.flip), kind = m.kind, a = clamp(m.a ?? 1, 0, 1);
      const r = (kind === 'dot' ? 0.9 : kind === 'chosen' ? 1.35 : kind === 'last' ? 0.42 : kind === 'glow' ? 2.6 : kind === 'cursor' ? 1.95 : 1.75) * (m.r ?? 1);
      let y = TOP + 0.06;
      if (kind === 'last') y = REST + DH / 2 + 0.05; else if (kind === 'glow') y = REST + DH / 2 + 0.02; else if ((kind === 'ring') && occ.has(m.i)) y = REST + DH / 2 + 0.05;
      q.visible = true; q.position.set(w.x, y, w.z); q.scale.set(r * 2, 1, r * 2);
      q.material.map = kind === 'dot' || kind === 'chosen' || kind === 'last' ? TEX.dot : kind === 'glow' ? TEX.glow : kind === 'cursor' ? TEX.square : TEX.ring;
      col.set(MARK_COL[kind] || '#fff'); q.material.color.copy(col); q.material.opacity = a;
      q.renderOrder = kind === 'last' || kind === 'glow' ? 4 : 2;
      q.material.blending = kind === 'glow' ? THREE.AdditiveBlending : THREE.NormalBlending;
    }
    for (; k < marks.length; k++) marks[k].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let loseExt = null;
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, mode = '';
  function framing(state, L, t) {
    const n = state.game.n;
    if (['play', 'auto', 'lesson', 'over'].includes(state.scene)) {
      const b = L.board, e = 8;
      return { m: 'play', n, p: playCam({ x: b.x - e, y: b.y - e, w: b.S + 2 * e, h: b.h + 2 * e }, n) };
    }
    if ((state.scene === 'title' || state.scene === 'demo-limit') && v3.hero) {
      const base = { yaw: -5 + 4 * Math.sin(t * Math.PI * 2 / 34), tilt: 50 + 2.5 * Math.sin(t * Math.PI * 2 / 21), fov: 28, tx: 0, ty: TOP, tz: 0 };
      return { m: 'title', n: 8, p: fit(rectCss(v3.hero), boardPts(8), base) };
    }
    // documents and menus without a board slot: the courtyard, the board at rest on its rug
    const U = L.U, land = L.land;
    const base = { yaw: -16 + 4 * Math.sin(t * Math.PI * 2 / 40), tilt: 32, fov: 34, tx: 0, ty: TOP, tz: 0 };
    const r = land ? { x: U.x0 + U.w * 0.06, y: U.y0 + U.h * 0.18, w: U.w * 0.5, h: U.h * 0.64 } : { x: U.x0 + U.w * 0.1, y: U.y0 + U.h * 0.3, w: U.w * 0.8, h: U.h * 0.4 };
    return { m: 'env', n: 8, p: fit(rectCss(r), boardPts(8), base) };
  }
  const START = (() => { const a = new Array(64).fill(0); a[27] = 2; a[36] = 2; a[28] = 1; a[35] = 1; return a; })();
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height, state.flip, state.game.n);
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}|${L.layoutKind}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    const goal = framing(state, L, clock);
    v3.n = goal.n; v3.flip = state.scene === 'title' ? false : Boolean(L.flip);
    const wantTheme = THEMES_OK.has(state.cloth) ? state.cloth : 'emerald';
    if (wantTheme !== themeId || goal.n !== boardN) setBoard(wantTheme, goal.n);
    if (state.style && state.style !== style) { style = state.style; setDiscStyle(mats, style); }
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
    const list = v3.pieces.length || mode === 'play' || mode === 'title' ? v3.pieces : START.map((who, i) => (who ? { who, i } : null)).filter(Boolean);
    drawDiscs(list);
    drawMarks(mode === 'env' ? [] : v3.marks);
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; host.c3 = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const b of boards.values()) { if (board === b) scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = '';
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; host.c3 = true; canvas.style.visibility = 'visible'; snap = true; playCache.clear();
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; host.c3 = true; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
