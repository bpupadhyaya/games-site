// Noughts & Crosses 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js: marks,
// the winning line, the rectangle the board belongs in), never writes game state. One WebGL canvas sits behind the kit's transparent 2D
// canvas: a carved slab (marble, boxwood or night glass) on a stone, felt or glass table, with extruded crosses and turned noughts.
// On the play screens and the title the camera is fitted to the layout's board rectangle and v3.geo hands the 2D layer the projected
// cell centres, so taps, rings and hints line up with the tilted board. No WebGL, ?flat=1 or a lost context: v3.on = false and every
// screen draws the flat 2D art; a restored context rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { themeById, boardGeo } from '../src/art.js';
import { DROP_T, SLIDE_T } from '../src/match.js';
import { SIDE, TOP, ENV, boardKind, buildBoard, buildTable, buildLamp, buildLights, setEnv, pieceGeos, pieceMaterials, setPieceTheme, radialTex, barTex } from './world.js';

const D2R = Math.PI / 180, CAP = 24;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1536 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const SETTLE = 0.3;

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 2, 4000);
  const lights = buildLights(scene);
  const buildEnvMap = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); } catch { /* no IBL */ } };
  buildEnvMap();
  await tick();
  const geos = pieceGeos();
  let th = themeById('marble'), themeId = 'marble';
  const mats = pieceMaterials(th);
  const mkInst = (g, m, cap) => { const im = new THREE.InstancedMesh(g, m, cap); im.castShadow = true; im.receiveShadow = true; im.count = 0; im.frustumCulled = false; im.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(im); return im; };
  const inst = { 1: mkInst(geos[1], mats[1], CAP), 2: mkInst(geos[2], mats[2], CAP) };
  const ghost = { 1: mkInst(geos[1], mats.g1, 2), 2: mkInst(geos[2], mats.g2, 2) };
  for (const k of [1, 2]) ghost[k].castShadow = false;
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), CAP * 2 + 4);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  // winning bars: light lying on the board
  const barT = barTex();
  const bars = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: barT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; });
  // a puff of fine dust where a mark lands
  const dustT = radialTex('230,215,190', 0.8);
  const dust = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, z, s) => { dust[dustI++ % dust.length].userData = { t: 0, x, z, s }; };

  // boards and tables are cached per theme (and board kind / texture size)
  const boards = new Map(), tables = new Map(); let board = null, boardKey = '', table = null, tableKey = '', lamp = null;
  let kindNow = 'classic';
  function setLook(id, kind) {
    const bk = `${id}|${kind}|${TIERS[tier].tex}`;
    if (id !== themeId || !table) {
      th = themeById(id); themeId = id;
      let t = tables.get(id); if (!t) { t = buildTable(th); tables.set(id, t); }
      if (table) scene.remove(table); table = t; scene.add(t);
      setEnv(scene, lights, th); renderer.toneMappingExposure = ENV[th.kind].exp; setPieceTheme(mats, th);
      if (lamp) { scene.remove(lamp); lamp = null; }
      if (th.kind === 'marble') { lamp = buildLamp(); lamp.position.set(-SIDE / 2 - 12, 0, -SIDE / 2 - 2); lamp.rotation.y = 0.5; scene.add(lamp); }
    }
    if (bk !== boardKey) {
      let b = boards.get(bk); if (!b) { b = buildBoard(th, kind, TIERS[tier].tex); boards.set(bk, b); }
      if (board) scene.remove(board); board = b; boardKey = bk; scene.add(b);
    }
    v3.theme = id;
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.28 : 0.55;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    boardKey = ''; setLook(themeId, kindNow);
  }
  setLook('marble', 'classic'); applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 56, fov: 26, dist: 120, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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

  const H = SIDE / 2;
  const BOARD_PTS = [[-H, TOP, -H], [H, TOP, -H], [-H, TOP, H], [H, TOP, H], [-H, 0, H + 0.4], [H, 0, H + 0.4]];
  const playCache = new Map();
  function playCam(rc) {
    const key = `${rc.x},${rc.y},${rc.w},${rc.h}|${cssW()}x${cssH()}|${cpu().toFixed(4)}`;
    let p = playCache.get(key);
    if (!p) { p = fit(rectCss(rc), BOARD_PTS, { yaw: 0, tilt: cssW() > cssH() ? 50 : 55, fov: 26, tx: 0, ty: TOP, tz: 0 }); playCache.set(key, p); if (playCache.size > 24) playCache.delete(playCache.keys().next().value); }
    return p;
  }

  // ---------------------------------------------------------------- the projected board the 2D layer plays on (centres, spacing, hit test)
  const wgeo = new Map();
  const worldGeo = (mode) => { const k = boardKind(mode); let g = wgeo.get(k); if (!g) { g = boardGeo(k, -H, -H, SIDE); wgeo.set(k, g); } return g; };
  let frameId = 0; const geoCache = new Map(); const q0 = { x: 0, y: 0 };
  v3.geo = (mode, x, y, side) => {
    const k = boardKind(mode), ck = `${k}|${frameId}`; let g = geoCache.get(ck);
    if (g) return g;
    geoCache.clear();
    const w = worldGeo(k), n = w.n, centers = w.centers.map(([wx, wz]) => { const v = virt(toCss(camera, wx, TOP, wz, q0)); return [v.x, v.y]; });
    const sx = (centers[n - 1][0] - centers[0][0]) / (n - 1), sy = (centers[n * (n - 1)][1] - centers[0][1]) / (n - 1);
    // horizontal and vertical spacing along the middle row / column (the board is seen from a tilted, perspective camera)
    const mid = Math.floor(n / 2), ax = Math.hypot(centers[mid * n + n - 1][0] - centers[mid * n][0], centers[mid * n + n - 1][1] - centers[mid * n][1]) / (n - 1);
    const ay = Math.hypot(centers[n * (n - 1) + mid][0] - centers[mid][0], centers[n * (n - 1) + mid][1] - centers[mid][1]) / (n - 1);
    void sx; void sy;
    const cell = ax, kk = ay / ax;
    // the cell whose screen ellipse is nearest to (px, py); -1 when none is close enough
    const hit = (px, py) => {
      let best = -1, bd = 1.12;
      for (let i = 0; i < centers.length; i++) { const d = Math.hypot((px - centers[i][0]) / (cell * 0.5 + 4), (py - centers[i][1]) / (cell * kk * 0.5 + 4)); if (d < bd) { bd = d; best = i; } }
      return best;
    };
    g = { x, y, side, m: 0, cell, n, centers, mode: k, d: cell * (k === 'terni' ? 0.5 : 0.7), k: kk, hit, p3: true };
    geoCache.set(ck, g); return g;
  };

  // ---------------------------------------------------------------- marks
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  const counts = { 1: 0, 2: 0, g1: 0, g2: 0 }; let nBlob = 0;
  const ease3 = (u) => 1 - (1 - u) ** 3;
  let clock = 0; const landed = new Map();
  function put(pc, wg) {
    const [cx, cz] = wg.centers[pc.i], d = wg.d, sc = d * (pc.scale ?? 1);
    if (sc < 0.02) return;
    let x = cx, z = cz, y = TOP, rx = 0, rz = 0, sy = 1, yaw = (hash(pc.i, pc.who * 17) - 0.5) * 0.22 + (pc.who === 2 ? hash(pc.i, 5) * 3 : 0), ground = TOP, lift = 0;
    const a = pc.a;
    if (a && a.kind === 'drop') {
      const t = Math.max(0, a.t), k = clamp(t / DROP_T, 0, 1);
      lift = d * 1.05 * (1 - k) * (1 - k);
      rx = (1 - k) * 0.28 * (pc.who === 1 ? 1 : -1); yaw += (1 - k) * 1.1;
      if (t >= DROP_T) { const s = (t - DROP_T) / SETTLE; if (s < 1) { const dd = (1 - s) * (1 - s); lift += Math.abs(Math.sin(s * Math.PI * 2)) * d * 0.1 * dd; sy = 1 - Math.sin(Math.min(1, s * 4) * Math.PI) * 0.1 * (1 - s); } }
      y += lift; if (t >= DROP_T * 0.9 && t < DROP_T * 0.9 + 0.05) puff(cx, cz, d * 0.45);
    } else if (a && a.kind === 'slide' && a.from >= 0) {
      const t = Math.max(0, a.t), k = clamp(t / SLIDE_T, 0, 1), e = k * k * (3 - 2 * k), [fx, fz] = wg.centers[a.from];
      x = fx + (cx - fx) * e; z = fz + (cz - fz) * e; lift = Math.sin(k * Math.PI) * d * 0.5; y += lift;
      rx = Math.sin(k * Math.PI) * 0.1;
    }
    if (pc.lift) { lift += pc.lift * d * 0.45; y += pc.lift * d * 0.45; }
    if (pc.ghost) { const i = pc.who === 1 ? 'g1' : 'g2', m = ghost[pc.who]; if (counts[i] >= 2) return; _e.set(0, yaw, 0, 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(sc, sc, sc)); m.setMatrixAt(counts[i]++, _m); return; }
    const m = inst[pc.who]; if (!m || counts[pc.who] >= CAP) return;
    const idx = counts[pc.who]++;
    _e.set(rx, yaw, rz, 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(sc, sc * sy, sc)); m.setMatrixAt(idx, _m);
    const b = clamp(pc.alpha ?? 1, 0, 1) * (1 + (pc.glow ?? 0) * 0.42); m.setColorAt(idx, _c.setRGB(b, b, b));
    if (nBlob < blobs.instanceMatrix.count) { const g = Math.max(0, lift), s = sc * 1.25 * (1 + g * 0.05); blobs.setMatrixAt(nBlob++, _m.compose(_p.set(x + 0.18 + g * 0.18, ground + 0.03, z + 0.16 + g * 0.14), _q.identity(), _s.set(s, 1, s))); }
  }
  function drawPieces(list) {
    counts[1] = counts[2] = counts.g1 = counts.g2 = 0; nBlob = 0;
    for (const pc of list) { const wg = worldGeo(pc.mode ?? v3.mode); if (pc.i >= 0 && pc.i < wg.centers.length) put(pc, wg); }
    for (const k of [1, 2]) { inst[k].count = counts[k]; inst[k].instanceMatrix.needsUpdate = true; if (inst[k].instanceColor) inst[k].instanceColor.needsUpdate = true; }
    for (const k of [1, 2]) { ghost[k].count = counts[`g${k}`]; ghost[k].instanceMatrix.needsUpdate = true; }
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
  }
  function drawWin(w, mode) {
    let k = 0;
    if (w && w.k > 0.001) {
      const wg = worldGeo(mode), [r, g, b] = w.col.split(',').map((v) => Number(v) / 255), n = wg.n, L = w.line;
      const segs = L.length === 4 && L[1] - L[0] === 1 && L[2] - L[0] === n ? [[L[0], L[1]], [L[1], L[3]], [L[3], L[2]], [L[2], L[0]]] : [[L[0], L[L.length - 1]]];
      const e = 1 - (1 - clamp(w.k, 0, 1)) ** 3;
      for (const [i0, i1] of segs) {
        if (k >= bars.length) break;
        const a = wg.centers[i0], bb = wg.centers[i1], dx = bb[0] - a[0], dz = bb[1] - a[1], len = Math.hypot(dx, dz), ext = wg.cell * 0.34;
        const total = (len + ext * 2) * e, m = bars[k++], ux = dx / (len || 1), uz = dz / (len || 1);
        m.visible = true; m.rotation.set(0, -Math.atan2(dz, dx), 0);
        m.position.set(a[0] - ux * ext + ux * total / 2, TOP + 0.2 + (wg.d * 0.17) * 0.5, a[1] - uz * ext + uz * total / 2);
        m.scale.set(Math.max(0.01, total), 1, wg.cell * 0.5);
        m.material.color.setRGB(r * 0.85, g * 0.85, b * 0.85); m.material.opacity = 0.9;
      }
    }
    for (; k < bars.length; k++) bars[k].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, mode = '';
  function framing(t) {
    const W = cssW(), Hh = cssH();
    if (v3.view === 'play' && v3.rect) return { m: 'play', p: playCam(v3.rect) };
    if (v3.view === 'title' && v3.rect) {
      const base = { yaw: -7 + 5 * Math.sin(t * Math.PI * 2 / 30), tilt: 45 + 2.5 * Math.sin(t * Math.PI * 2 / 19), fov: 27, tx: 0, ty: TOP, tz: 0 };
      // the hero slot is the flat board's square; the tilted board is fitted a little larger so it fills the space above the menu
      const r = v3.rect, g = Math.min(1.7, 700 / Math.max(1, r.w)), w = r.w * g, h = r.h * g * 0.92;
      return { m: 'title', p: fit(rectCss({ x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2 - r.h * 0.05, w, h }), BOARD_PTS, base) };
    }
    const base = { yaw: -22 + 6 * Math.sin(t * Math.PI * 2 / 40), tilt: 32, fov: 32, tx: 0, ty: TOP, tz: 0 };
    return { m: 'env', p: fit({ x: W * 0.1, y: Hh * 0.28, w: W * 0.8, h: Hh * 0.4 }, BOARD_PTS, base) };
  }
  function pre() {
    if (!game || lost) return;
    frameId++;
    const state = game.getState();
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    const want = state.theme || 'marble', mk = state.match ? state.match.mode : 'classic';
    kindNow = boardKind(mk); if (want !== themeId || `${themeId}|${kindNow}|${TIERS[tier].tex}` !== boardKey) setLook(want, kindNow);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const goal = framing(clock);
    if (goal.m !== mode) { if (goal.m === 'play' || mode === '' || mode === 'play') snap = true; mode = goal.m; }
    const k = snap || goal.m === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal.p)) cur[key] += (goal.p[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    v3.pieces.length = 0; v3.win = null;
  }
  const _bill = new THREE.Vector3();
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    // screens without a board in play show an empty board at rest
    const showMode = v3.pieces.length ? v3.pieces[0].mode ?? v3.mode : (mode === 'play' ? v3.mode : 'classic');
    drawPieces(v3.pieces);
    drawWin(v3.win, v3.mode === 'terni' || v3.mode === 'quad' ? v3.mode : (mode === 'title' ? 'classic' : v3.mode));
    void showMode;
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.5)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.5), s = (1.5 + f * 3.5) * u.s;
      m.visible = true; m.position.set(u.x, TOP + 0.15 + f * 0.4, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.3 * (1 - f) * (1 - f);
    }
    if (lamp) {
      // the flame and halo are only drawn where the camera can see them well (title, documents); the light always burns
      for (const c of lamp.children) if (!c.isLight) c.visible = mode !== 'play';
      const f = 1 + 0.06 * Math.sin(clock * 7.3) + 0.04 * Math.sin(clock * 13.1 + 1.7) + 0.02 * Math.sin(clock * 23.7), u = lamp.userData;
      u.light.intensity = (mode === 'play' ? 300 : 900) * f; u.halo.material.opacity = clamp(0.8 + (f - 1) * 1.4, 0, 1); u.flame.scale.set(0.9 * (2 - f), 1.1 * f, 1);
      for (const s of [u.flame, u.halo]) { s.getWorldPosition(_bill); s.lookAt(camera.position); }
    }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnvMap();
    for (const b of boards.values()) { if (board === b) scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = '';
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true; playCache.clear();
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
  };
}
