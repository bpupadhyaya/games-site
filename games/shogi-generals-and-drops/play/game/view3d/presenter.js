// Shogi 3D presenter. READS what the 2D layer put into src/v3.js this frame (pieces, marks, the rectangle the board is fitted to),
// never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a thick kaya board on a vermilion tray on
// sunlit tatami, with real wedge-shaped koma. The camera is fitted to the layout's rectangle; v3.toCanon / v3.toScreen hand the 2D
// layer the exact projection of the tilted board, so taps and marks line up with what is on screen. No WebGL, ?flat=1 or a lost
// context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { host } from '../src/layout.js';
import { spriteOf, spriteGen, sizeOf } from '../src/pieces.js';
import { BOARD_W, TOP, SLAB_W, PLINTH_W, radialTex, buildBoard, buildRoom, buildLights, pieceGeometry, sideMaterial, topMaterial } from './world.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1536 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const MARK_COL = { dot: '#ffe08a', ring: '#e23a2c', sel: '#ffd24a', last: '#e08a2a', check: '#ff3b2a', hint: '#ffd24a', chosen: '#9be8ff', lesson: '#d8372b', cursor: '#ffffff' };

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
const applyH = (h, x, y) => { const d = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d]; };

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.8;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9d2a8);
  scene.fog = new THREE.Fog(0xd9d2a8, 320, 900);
  const camera = new THREE.PerspectiveCamera(24, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.5; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  buildRoom(scene);
  await tick();

  // ---- the koma: a pool per (type, side, turned, label, language, sprite generation), so a promotion or a capture just takes another
  const sideMat = sideMaterial();
  const mats = new Map(), pool = new Map(), used = new Map();
  const topOf = (pc) => {
    const spr = spriteOf(pc.t, pc.owner, pc.rot, pc.label, pc.lang), key = `${spriteGen()}|${pc.t}|${pc.owner}|${pc.rot}|${pc.label || ''}|${pc.lang}`;
    let m = mats.get(key);
    if (!m) {
      const c = document.createElement('canvas'); c.width = 152; c.height = 166; const x = c.getContext('2d');
      if (spr) { if (pc.rot) { x.translate(152, 166); x.rotate(Math.PI); } x.drawImage(spr, 0, 0, 152, 166); } else { x.fillStyle = '#e8c98a'; x.fillRect(0, 0, 152, 166); }
      m = topMaterial(c); mats.set(key, m);
    }
    return { key, m };
  };
  const take = (pc, kw) => {
    const { key, m } = topOf(pc), k = `${key}|${sizeOf(pc.t)}|${kw.toFixed(4)}`; let arr = pool.get(k); if (!arr) pool.set(k, (arr = []));
    const n = used.get(k) || 0; used.set(k, n + 1);
    if (n >= arr.length) { const mesh = new THREE.Mesh(pieceGeometry(sizeOf(pc.t), kw), [sideMat, m]); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); arr.push(mesh); }
    const g = arr[n]; g.visible = true; return g;
  };
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const rr = (x, a, b, w, h, r) => { x.beginPath(); x.roundRect(a, b, w, h, r); };
  const TEX = {
    dot: mk((x) => { const g = x.createRadialGradient(64, 64, 2, 64, 64, 44); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 44, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 17, 0, 7); x.fill(); }),
    ring: mk((x) => { rr(x, 10, 10, 108, 108, 14); x.fillStyle = 'rgba(255,255,255,0.28)'; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 9; x.stroke(); }),
    glow: radialTex('255,255,255', 1),
    square: mk((x) => { x.fillStyle = 'rgba(255,255,255,0.45)'; x.fillRect(4, 4, 120, 120); x.strokeStyle = '#fff'; x.lineWidth = 9; x.strokeRect(5, 5, 118, 118); }),
    soft: mk((x) => { x.fillStyle = '#fff'; x.fillRect(4, 4, 120, 120); }),
    line: mk((x) => { x.fillStyle = '#fff'; for (let i = 0; i < 128; i += 26) x.fillRect(i, 50, 16, 28); }),
    circle: mk((x) => { x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = 17; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.stroke(); x.strokeStyle = '#fff'; x.lineWidth = 8; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.stroke(); }),
    dash: mk((x) => { x.strokeStyle = '#fff'; x.lineWidth = 8; x.setLineDash([16, 12]); x.strokeRect(8, 8, 112, 112); }),
  };
  const marks = Array.from({ length: 64 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: TEX.dot, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); return m; });

  const boards = new Map(); let board = null, boardKey = '';
  function setBoard(n, flip, lang) {
    const k = `${n}|${flip ? 1 : 0}|${lang}|${TIERS[tier].tex}`; if (k === boardKey) return;
    let b = boards.get(k);
    if (!b) { b = buildBoard(n, flip, lang, TIERS[tier].tex); boards.set(k, b); if (boards.size > 6) { const [k0, b0] = boards.entries().next().value; if (b0 !== b && b0 !== board) { b0.userData.dispose(); boards.delete(k0); } } }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    boardKey = ''; if (board) { scene.remove(board); board = null; } setBoard(v3.n || 9, v3.flip, v3.lang);
  }
  applyTier();

  // ---- camera: elevation / fov per screen, distance and an off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 52, fov: 22, dist: 120, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2); p.bw = bb.x1 - bb.x0;
    return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });
  const HW = SLAB_W / 2, HP = PLINTH_W / 2, PH = 8;
  // the plinth, the board and the tops of the far men (so nothing on the back rank is cut off)
  const boardPts = [[-HP, 0, HP], [HP, 0, HP], [-HP, 2.6, -HP], [HP, 2.6, -HP], [-BOARD_W / 2, TOP + PH, -BOARD_W / 2], [BOARD_W / 2, TOP + PH, -BOARD_W / 2], [-HW, TOP, HW], [HW, TOP, HW]];
  const playCache = new Map();
  // highest elevation (most top-down, easiest to read) that still lets the board use the full width of the rectangle
  function playCam(rc, land) {
    const key = `${rc.x.toFixed(1)},${rc.y.toFixed(1)},${rc.w.toFixed(1)},${rc.h.toFixed(1)}|${cssW()}x${cssH()}|${cpu().toFixed(4)}`;
    let p = playCache.get(key);
    if (!p) {
      const r = rectCss(rc);
      for (let el = land ? 56 : 58; el >= 34; el -= 3) { p = fit(r, boardPts, { yaw: 0, tilt: el, fov: 22, tx: 0, ty: TOP, tz: 0 }); if (p.bw >= r.w * 0.985) break; }
      playCache.set(key, p); if (playCache.size > 24) playCache.delete(playCache.keys().next().value);
    }
    return p;
  }

  // The board plane (y = TOP) as the live camera sees it: canonical board units <-> virtual screen units, a homography recomputed once
  // per frame after the camera is placed, so taps and marks use exactly what is on screen.
  let Hf = null, Hi = null;
  const q0 = { x: 0, y: 0 };
  const WC = () => BOARD_W / (v3.n || 9);                                  // world size of one cell
  const w2c = (wx, wz) => [v3.gcx + (wx / WC()) * v3.cell, v3.gcy + (wz / WC()) * v3.cell], c2w = (cx, cy) => [((cx - v3.gcx) / v3.cell) * WC(), ((cy - v3.gcy) / v3.cell) * WC()];
  function updateH() {
    const g = [[-HW, -HW], [HW, -HW], [HW, HW], [-HW, HW]], sc = [], cn = [];
    for (const [a, b] of g) { const v = virt(toCss(camera, a, TOP, b, q0)); sc.push([v.x, v.y]); cn.push(w2c(a, b)); }
    Hf = homography(cn, sc); Hi = homography(sc, cn);
  }
  v3.toScreen = (cx, cy) => { if (!Hf) updateH(); const p = applyH(Hf, cx, cy); return { x: p[0], y: p[1] }; };
  v3.toCanon = (sx, sy) => { if (!Hi) updateH(); const p = applyH(Hi, sx, sy); return { x: p[0], y: p[1] }; };

  // ---- the koma
  const _col = new THREE.Color();
  function drawPieces(list) {
    for (const arr of pool.values()) for (const g of arr) g.visible = false;
    used.clear();
    const kw = (WC() * 0.48) / 68;
    for (const pc of list) {
      const [wx, wz] = c2w(pc.x, pc.y), g = take(pc, kw);
      g.position.set(wx, TOP + 0.03 + (pc.lift || 0) * 4.2, wz); g.rotation.set(pc.lift ? (pc.rot ? 0.07 : -0.07) * pc.lift : 0, pc.rot ? Math.PI : 0, 0, 'YXZ');
    }
  }
  function drawMarks(list) {
    let k = 0; const wc = WC();
    for (const m of list) {
      if (k >= marks.length) break;
      const q = marks[k++], [wx, wz] = c2w(m.x, m.y), kind = m.kind, a = clamp(m.a ?? 1, 0, 1);
      q.visible = true; q.material.opacity = a; q.material.blending = THREE.NormalBlending; q.rotation.y = 0;
      _col.set(MARK_COL[kind] || '#fff'); q.material.color.copy(_col);
      let r = wc * 0.95, y = TOP + 0.08, map = TEX.dot;
      if (kind === 'dot') { r = wc * 0.8; map = TEX.dot; }
      else if (kind === 'ring') { r = wc * 0.98; map = TEX.ring; y += 0.01; }
      else if (kind === 'sel') { r = wc * 0.98; map = TEX.square; }
      else if (kind === 'last') { r = wc * 0.98; map = TEX.soft; q.material.opacity = a * 0.4; }
      else if (kind === 'check') { r = wc * 1.7; map = TEX.glow; q.material.blending = THREE.AdditiveBlending; y += 0.02; }
      else if (kind === 'chosen') { r = wc * 0.95; map = TEX.circle; y += 0.02; }
      else if (kind === 'lesson') { r = wc * 0.98; map = TEX.ring; }
      else if (kind === 'cursor') { r = wc * 0.92; map = TEX.dash; y += 0.02; }
      else if (kind === 'hint') {
        const [x2, z2] = c2w(m.x2, m.y2), dx = x2 - wx, dz = z2 - wz, len = Math.hypot(dx, dz);
        q.material.map = TEX.line; q.position.set((wx + x2) / 2, y + 0.03, (wz + z2) / 2); q.scale.set(len, 1, wc * 0.18); q.rotation.y = -Math.atan2(dz, dx); continue;
      }
      q.material.map = map; q.position.set(wx, y, wz); q.scale.set(r, 1, r);
    }
    for (; k < marks.length; k++) marks[k].visible = false;
  }

  // ---- per frame (called once, after the 2D layer has drawn and filled v3.frame / pieces / marks)
  let loseExt = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, mode = '', snap = true, viewKey = '', clock = 0;
  function post() {
    if (lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const fr = v3.frame;
    if (!fr) { canvas.style.visibility = 'hidden'; mode = ''; return; }          // a text page: the flat backdrop is drawn, nothing to render
    canvas.style.visibility = 'visible';
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}`; if (vk !== viewKey) { viewKey = vk; snap = true; playCache.clear(); }
    setBoard(v3.n || 9, v3.flip, v3.lang);
    let goal;
    if (fr.mode === 'title') goal = fit(rectCss(fr.rect), boardPts, { yaw: -6 + 5 * Math.sin(clock * 0.18), tilt: 40 + 2 * Math.sin(clock * 0.12), fov: 26, tx: 0, ty: TOP, tz: 0 });
    else goal = playCam(fr.rect, cssW() > cssH());
    if (fr.mode !== mode) { snap = true; mode = fr.mode; }
    const k = snap || fr.mode === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of ['yaw', 'tilt', 'fov', 'dist', 'ox', 'oy', 'tx', 'ty', 'tz']) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur); updateH();
    drawPieces(v3.pieces); drawMarks(v3.marks);
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; host.c3 = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const b of boards.values()) { if (board === b) scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = '';
    for (const m of mats.values()) { if (m.map) m.map.dispose(); m.dispose(); } mats.clear(); for (const arr of pool.values()) for (const g of arr) scene.remove(g); pool.clear();
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; host.c3 = true; canvas.style.visibility = 'visible'; snap = true; playCache.clear();
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();
  return {
    ok: true, renderer, scene, camera, post,
    attach() { host.c3 = true; v3.on = true; v3.fade = 0; fadeIn = 0; snap = true; },
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
