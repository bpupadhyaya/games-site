// Tab 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js: stones, rings, sockets,
// sticks), never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: the carved board, two yard trays and the
// felt mat on a kilim in a Bedouin tent at night. On the play screens the camera is fitted to the union of the layout's rectangles and the
// presenter hands the 2D layer a projection of that table (v3.play) so taps, stone routes and particles line up. No WebGL or a lost context:
// v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { playLayout, titleLayout } from '../src/layout.js';
import { TEXT_SCALES } from '../src/ui.js';
import { themeById } from '../src/art.js';
import { COLS, ROWS, N, cellOf, isSafe, sqOf } from '../src/rules.js';
import { SQ, BW, BH, TOP, SR, buildBoard, stoneGeos, stoneMaterials, setStoneTheme, buildStick, axisLift, buildTray, buildSocketPlate, buildMat, buildTent, buildLantern, buildLights, radialTex, ringTex, cellTex } from './world.js';

const D2R = Math.PI / 180, CAP = 64, FELT = 0.66, ENV_Z = -BH / 2 - 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const LANTERN = { x: -36, z: -22 };
const colCache = new Map();
function parseCol(s) {
  let c = colCache.get(s); if (c) return c;
  const m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  else { const n = (String(s).match(/[\d.]+/g) || ['255', '255', '255']).slice(0, 3).map(Number); c = n.map((v) => v / 255); }
  colCache.set(s, c); return c;
}
function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
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
const hap = (h, x, y) => { const d = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d]; };
// the position shown on the menu and the documents (path positions per side)
const DEMO = [[4, 9, 12, 20], [22, 17, 8]];
const REST_FLATS = [false, true, false, true];

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden;opacity:0;transition:opacity .5s ease';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  document.body.style.background = '#0d0907';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d18);
  scene.fog = new THREE.Fog(0x0d1020, 260, 900);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  buildTent(scene);
  await tick();
  const lantern = buildLantern(); lantern.position.set(LANTERN.x, 0.4, LANTERN.z); scene.add(lantern);

  let themeId = 'sand', th = themeById('sand');
  const geoStone = stoneGeos(), mats = stoneMaterials(th);
  const inst = {};
  for (const k of [1, 2]) { const m = new THREE.InstancedMesh(geoStone, mats[k], CAP); m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; m.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(m); inst[k] = m; }
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const ringT = ringTex(), cellT = cellTex(), discT = radialTex('255,255,255', 1);
  const marks = Array.from({ length: 48 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); return m; });
  const sockets = Array.from({ length: 16 }, () => { const m = buildSocketPlate(SR * 0.95); m.visible = false; scene.add(m); return m; });

  const rigObjs = { board: null, mat: null, trays: [], sticks: [] };
  let rigKey = '', stickL = 12;
  const disposeObj = (o) => { if (!o) return; scene.remove(o); o.traverse((q) => { q.geometry?.dispose?.(); if (q.material) [].concat(q.material).forEach((m) => { m.map?.dispose?.(); m.bumpMap?.dispose?.(); m.dispose(); }); }); };
  function buildRig(id) {
    th = themeById(id); themeId = id;
    disposeObj(rigObjs.board); disposeObj(rigObjs.mat); rigObjs.trays.forEach(disposeObj); rigObjs.sticks.forEach(disposeObj);
    rigObjs.mat = null; rigObjs.trays = []; rigObjs.sticks = [];
    rigObjs.board = buildBoard(th, { cellOf, isSafe, N }); scene.add(rigObjs.board);
    setStoneTheme(mats, th); rigKey = '';
  }
  buildRig('sand');
  // mat, trays and sticks follow the layout's rectangles
  function sizeRig(W) {
    const t0 = W.tray[0], t1 = W.tray[1], key = `${themeId}|${W.mat.w.toFixed(1)}x${W.mat.d.toFixed(1)}|${t0 ? t0.w.toFixed(1) + 'x' + t0.d.toFixed(1) : '-'}|${t1 ? t1.w.toFixed(1) + 'x' + t1.d.toFixed(1) : '-'}`;
    if (key === rigKey) return; rigKey = key;
    disposeObj(rigObjs.mat); rigObjs.trays.forEach(disposeObj); rigObjs.sticks.forEach(disposeObj); rigObjs.trays = []; rigObjs.sticks = [];
    rigObjs.mat = buildMat(W.mat.w, W.mat.d, th); scene.add(rigObjs.mat);
    for (const t of W.tray) { if (!t) { rigObjs.trays.push(null); continue; } const tr = buildTray(t.w, t.d, th); scene.add(tr); rigObjs.trays.push(tr); }
    stickL = clamp(W.mat.d * 0.66, 8, 20);
    for (let i = 0; i < 4; i++) { const s = buildStick(stickL, th); scene.add(s); rigObjs.sticks.push(s); }
  }

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera
  const cur = { yaw: 0, tilt: 58, fov: 24, dist: 120, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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
    for (let it = 0; it < 10; it++) {
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
  const rectPts = (r, y = TOP) => [[r.x0, y, r.z0], [r.x1, y, r.z0], [r.x0, y, r.z1], [r.x1, y, r.z1]];

  // ---- the play screens: the world rectangles follow the layout (1 unit = sc cm), the camera is fitted to their union
  let play = null, playKey = '';
  const q0 = { x: 0, y: 0 };
  function buildPlay(lay) {
    const sc = BW / lay.board.w, bcx = lay.board.x + lay.board.w / 2, bcy = lay.board.y + lay.board.h / 2;
    const toW = (vx, vy) => [(vx - bcx) * sc, (vy - bcy) * sc];
    const wr = (r) => { const [x0, z0] = toW(r.x, r.y), [x1, z1] = toW(r.x + r.w, r.y + r.h); return { x0, z0, x1, z1, w: x1 - x0, d: z1 - z0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 }; };
    const mi = { x: lay.mat.x, y: lay.mat.y + Math.min(26, lay.mat.h * 0.14), w: lay.mat.w, h: lay.mat.h - Math.min(26, lay.mat.h * 0.14) };
    const W = { sc, toW, board: wr(lay.board), yt: wr(lay.yardTop), yb: wr(lay.yardBottom), mat: wr(mi) };
    W.tray = [W.yt, W.yb];
    const rs = [lay.yardTop, lay.board, lay.mat, lay.yardBottom];
    const U = { x0: Math.min(...rs.map((r) => r.x)), y0: Math.min(...rs.map((r) => r.y)), x1: Math.max(...rs.map((r) => r.x + r.w)), y1: Math.max(...rs.map((r) => r.y + r.h)) };
    const rc = rectCss({ x: U.x0, y: U.y0, w: U.x1 - U.x0, h: U.y1 - U.y0 });
    const pts = []; for (const r of [W.yt, W.yb, W.mat, W.board]) pts.push(...rectPts(r));
    const land = cssW() > cssH();
    const cam = fit(rc, pts, { yaw: 0, tilt: land ? 54 : 76, fov: 24, tx: 0, ty: TOP, tz: 0 });
    return { W, cam, lay };
  }
  let Hf = null, Hi = null, hKey = 0;
  function updateH(P) {
    const W = P.W, xs = [W.mat.x0, W.mat.x1, W.yt.x0, W.yt.x1, W.board.x0, W.board.x1], zs = [W.yt.z0, W.yb.z1, W.mat.z1, W.mat.z0];
    const x0 = Math.min(...xs) - 6, x1 = Math.max(...xs) + 6, z0 = Math.min(...zs) - 6, z1 = Math.max(...zs) + 6;
    const src = [], dst = [];
    for (const [a, b] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) { src.push([a, b]); const v = virt(toCss(camera, a, TOP, b, q0)); dst.push([v.x, v.y]); }
    Hf = homography(src, dst); Hi = homography(dst, src); hKey++;
  }
  const proj = (x, z) => hap(Hf, x, z), unproj = (x, y) => hap(Hi, x, y);
  const cellW = (c, r, flip) => { const x = (c - (COLS - 1) / 2) * SQ, z = (1.5 - r) * SQ; return flip ? [-x, -z] : [x, z]; };
  const sqW = (sq, flip) => { const { r, c } = cellOf(sq); return cellW(c, r, flip); };
  function makeGeo(flip) {
    const [rx, rz] = proj(SQ / 2, 0), [lx, lz] = proj(-SQ / 2, 0), [tx, tz] = proj(0, -SQ / 2), [bx, bz] = proj(0, SQ / 2);
    const u = (Math.hypot(rx - lx, rz - lz) + Math.hypot(bx - tx, bz - tz)) / 2;
    const cs = [proj(-BW / 2, -BH / 2), proj(BW / 2, -BH / 2), proj(BW / 2, BH / 2), proj(-BW / 2, BH / 2)];
    const gx = Math.min(...cs.map((c) => c[0])), gy = Math.min(...cs.map((c) => c[1]));
    const sqXY = (sq) => proj(...sqW(sq, flip));
    const hitSq = (x, y) => {
      const [wx, wz] = unproj(x, y), X = flip ? -wx : wx, Z = flip ? -wz : wz;
      const c = Math.floor(X / SQ + COLS / 2), r = Math.floor(-Z / SQ + ROWS / 2);
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
      return r * COLS + (r % 2 === 0 ? c : COLS - 1 - c);
    };
    const exitXY = (p) => { const row = p === 0 ? ROWS - 1 : 0, x = -(SQ * COLS / 2 + (BW - SQ * COLS) / 4), z = (1.5 - row) * SQ; return proj(flip ? -x : x, flip ? -z : z); };
    return { x: gx, y: gy, w: Math.max(...cs.map((c) => c[0])) - gx, h: Math.max(...cs.map((c) => c[1])) - gy, m: u * 0.3, s: u, u, d: u * 0.72, flip, sqXY, hitSq, exitXY, p3: true, key: `3d${hKey}` };
  }
  function makeLay(P) {
    const lay = { ...P.lay }, W = P.W;
    const bbox = (r) => { const cs = [proj(r.x0, r.z0), proj(r.x1, r.z0), proj(r.x1, r.z1), proj(r.x0, r.z1)]; const x = Math.min(...cs.map((c) => c[0])), y = Math.min(...cs.map((c) => c[1])); return { x, y, w: Math.max(...cs.map((c) => c[0])) - x, h: Math.max(...cs.map((c) => c[1])) - y }; };
    const mk = (orig, wr, withSlots) => {
      const b = bbox(wr);
      if (withSlots) b.slot = (n, k) => {
        const slotS = Math.min(96, (orig.w - 40) / n), total = slotS * n, x0 = orig.x + (orig.w - total) / 2, d = Math.min(slotS * 0.8, 50, Math.max(28, orig.h - 52));
        const [wx, wz] = W.toW(x0 + (k + 0.5) * slotS, orig.y + orig.h - 8 - d / 2), p = proj(wx, wz), e = proj(wx + d * W.sc * 0.5, wz), f = proj(wx - d * W.sc * 0.5, wz);
        return [p[0], p[1], Math.hypot(e[0] - f[0], e[1] - f[1]) * 0.86];
      };
      return b;
    };
    lay.yardTop = mk(P.lay.yardTop, W.yt, true); lay.yardBottom = mk(P.lay.yardBottom, W.yb, true); lay.mat = mk(P.lay.mat, W.mat, false);
    lay.rects = { ...P.lay.rects, yardTop: lay.yardTop, yardBottom: lay.yardBottom, mat: lay.mat };
    lay.mat.at = (x, y) => proj(W.mat.x0 + x * W.mat.w, W.mat.z0 + y * W.mat.d);
    return lay;
  }

  // ---------------------------------------------------------------- stones, rings, sockets, sticks
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  const counts = { 1: 0, 2: 0 };
  const hash = (a) => { let h = Math.imul(a | 0, 374761393); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  function put(who, x, y, z, yaw, sc = 1, glow = 0, dim = 1) {
    if (sc < 0.01 || counts[who] >= CAP) return;
    _e.set(0, yaw, 0, 'YXZ'); _q.setFromEuler(_e); _s.set(sc, sc, sc); _p.set(x, y, z);
    inst[who].setMatrixAt(counts[who], _m.compose(_p, _q, _s));
    const k = dim * (1 + glow * 0.55); inst[who].setColorAt(counts[who], _c.setRGB(k, k, k));
    counts[who]++;
  }
  function drawPieces(list, geo, playing) {
    counts[1] = counts[2] = 0;
    if (playing) {
      for (const pc of list) {
        const [wx, wz] = unproj(pc.x, pc.y), sc = ((pc.d / geo.u) * SQ / (2 * SR)) * (pc.scale ?? 1) * (1 + 0.1 * (pc.lift ?? 0));
        put(pc.who, wx, TOP + 0.04 + (pc.lift ?? 0) * 2.4, wz, hash(Math.round(pc.x * 3 + pc.y * 7)) * 6.28, sc, pc.glow ?? 0, pc.alpha ?? 1);
      }
    } else {
      DEMO.forEach((a, p) => a.forEach((x, i) => { const [wx, wz] = sqW(sqOf(p, x), false); put(p + 1, wx, TOP + 0.04, wz + ENV_Z, hash(i + p * 9) * 6.28); }));
    }
    for (const k of [1, 2]) { inst[k].count = counts[k]; inst[k].instanceMatrix.needsUpdate = true; if (inst[k].instanceColor) inst[k].instanceColor.needsUpdate = true; }
  }
  function drawMarks(list, geo) {
    let k = 0;
    for (const mk of list) {
      if (k >= marks.length) break;
      const m = marks[k++], [wx, wz] = unproj(mk.x, mk.y), s = (mk.r * 2 / geo.u) * SQ * (mk.kind === 'cell' ? 1.0 : 1.18);
      m.visible = true; m.position.set(wx, TOP + 0.14, wz); m.scale.set(s, 1, s);
      m.material.map = mk.kind === 'cell' ? cellT : mk.kind === 'disc' ? discT : ringT;
      const [cr, cg, cb] = parseCol(mk.col), a = clamp(mk.a ?? 1, 0, 1) * (mk.kind === 'disc' ? 1.1 : 1);
      m.material.color.setRGB(cr * cr * a * 1.3, cg * cg * a * 1.3, cb * cb * a * 1.3);
    }
    for (; k < marks.length; k++) marks[k].visible = false;
  }
  function drawSockets(list, geo) {
    let k = 0;
    for (const s of list) { if (k >= sockets.length) break; const m = sockets[k++], [wx, wz] = unproj(s.x, s.y); m.visible = true; m.position.set(wx, 1.96, wz); const r = (s.d / geo.u) * SQ / 2 / (SR * 0.95) * 1.08; m.scale.set(r, 1, r); }
    for (; k < sockets.length; k++) sockets[k].visible = false;
  }
  const _sq = new THREE.Quaternion(), _sy = new THREE.Quaternion(), _ax = new THREE.Vector3(0, 1, 0), _az = new THREE.Vector3(0, 0, 1);
  function drawSticks(list, M) {
    const pose = list || REST_FLATS.map((f, i) => ({ x: 0.5 + (i - 1.5) * 0.22, y: 0.5, z: 0, yaw: (i % 2 === 0 ? -1 : 1) * 0.1, roll: f ? Math.PI : 0 }));
    rigObjs.sticks.forEach((s, i) => {
      const p = pose[i]; if (!p) { s.visible = false; return; }
      s.visible = true;
      s.position.set(M.cx + (p.x - 0.5) * M.w, FELT + axisLift(p.roll) + p.z * stickL * 0.9, M.cz + (p.y - 0.5) * M.d);
      _sy.setFromAxisAngle(_ax, -p.yaw); _sq.setFromAxisAngle(_az, p.roll); s.quaternion.copy(_sy).multiply(_sq);
    });
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, clock = 0, mode = '';
  const ENV_W = { sc: 1, mat: { x0: -22, x1: 22, z0: 2, z1: 20, w: 44, d: 18, cx: 0, cz: 11 }, tray: [null, null] };
  function framing(state, t) {
    const sc = state.scene;
    if ((sc === 'play' || sc === 'auto') && state.match) {
      const lay = playLayout(TEXT_SCALES[state.textIdx] ?? 1), key = `${lay.w}x${lay.h}|${state.textIdx}|${lay.board.x},${lay.board.y},${lay.board.w}|${cssW()}x${cssH()}|${cpu().toFixed(4)}|${lay.mat.x},${lay.mat.y}|${lay.yardTop.y}`;
      if (key !== playKey || !play) { play = buildPlay(lay); playKey = key; snap = true; }
      return { m: 'play', p: play.cam };
    }
    const TL = titleLayout(), land = meta.width > meta.height;
    const y0 = (TL.tagY || 300) + 26, rc = TL.menu && !land ? { x: 12, y: y0, w: meta.width - 24, h: Math.max(160, TL.menu.y - 6 - y0) } : TL.mat ? { x: TL.mat.x - 10, y: TL.mat.y - 16, w: TL.mat.w + 20, h: TL.mat.h + 74 } : { x: meta.width * 0.1, y: meta.height * 0.25, w: meta.width * 0.8, h: meta.height * 0.3 };
    const pts = [[-BW / 2, TOP, ENV_Z - BH / 2], [BW / 2, TOP, ENV_Z - BH / 2], [-24, FELT, 21], [24, FELT, 21], [LANTERN.x - 7, 26, LANTERN.z], [LANTERN.x + 7, 0, LANTERN.z + 8]];
    const base = { yaw: -6 + 5 * Math.sin(t * Math.PI * 2 / 34), tilt: (land ? 40 : 42) + 2 * Math.sin(t * Math.PI * 2 / 21), fov: 28, tx: 0, ty: TOP, tz: 0 };
    return { m: sc === 'title' && !state.overlay ? 'title' : 'env', p: fit(rectCss(rc), pts, base) };
  }
  function pre() {
    if (!game || lost) return;
    const state = game.getState();
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}`; if (vk !== viewKey) { viewKey = vk; snap = true; playKey = ''; }
    if (state.theme && state.theme !== themeId) buildRig(state.theme);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const goal = framing(state, clock);
    if (goal.m !== mode) { if (goal.m === 'play' || mode === 'play' || mode === '') snap = true; mode = goal.m; }
    const k = snap || goal.m === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal.p)) cur[key] += (goal.p[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    if (mode === 'play') { updateH(play); v3.play = { lay: makeLay(play), geo: (f) => makeGeo(Boolean(f)) }; } else v3.play = null;
    v3.pieces.length = 0; v3.marks.length = 0; v3.sockets.length = 0; v3.sticks = null; v3.trayActive = -1;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const playing = mode === 'play', W = playing ? play.W : ENV_W;
    sizeRig(W);
    lantern.position.set(playing ? -62 : LANTERN.x, 0.4, playing ? -46 : LANTERN.z);
    rigObjs.board.rotation.y = playing && v3.flip ? Math.PI : 0;
    rigObjs.board.position.set(0, 0, playing ? 0 : ENV_Z);
    rigObjs.mat.position.set(W.mat.cx, 0, W.mat.cz);
    rigObjs.trays.forEach((t, i) => { if (!t) return; t.position.set(W.tray[i].cx, 0, W.tray[i].cz); t.userData.rim.material.opacity = v3.trayActive === i ? 0.22 + 0.12 * Math.sin(clock * 4) : 0; });
    const geo = playing ? makeGeo(Boolean(v3.flip)) : { u: 60 };
    drawPieces(playing ? v3.pieces : [], geo, playing);
    drawMarks(playing ? v3.marks : [], geo); drawSockets(playing ? v3.sockets : [], geo);
    drawSticks(v3.sticks, W.mat);
    const f = 1 + 0.06 * Math.sin(clock * 7.3) + 0.04 * Math.sin(clock * 13.1 + 1.7) + 0.02 * Math.sin(clock * 23.7);
    lantern.userData.light.intensity = 2200 * f; lantern.userData.halo.material.opacity = clamp(0.8 + (f - 1) * 1.4, 0, 1); lantern.userData.flame.scale.set(0.8 * (2 - f), 1.6 * f, 0.8 * (2 - f));
    lantern.userData.halo.lookAt(camera.position);
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.play = null; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); buildRig(themeId); applyTier(); snap = true; playKey = ''; v3.on = true; canvas.style.visibility = 'visible';
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; canvas.style.visibility = 'visible'; requestAnimationFrame(() => { canvas.style.opacity = '1'; }); snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
  };
}
