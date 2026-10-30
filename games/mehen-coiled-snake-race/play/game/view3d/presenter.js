// Mehen 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js: lions, marbles,
// lit cells), never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a round limestone board with the
// coiled snake carved in relief, on a scribe's bench in a lamp-lit tomb workshop. On the play screens the camera is fitted to the
// layout's board rectangle and v3.proj hands the 2D layer a projection of the tilted board (so taps, trails and the dashed path line up
// with the 3D board). No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context
// rebuilds the scene and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { titleFrame, playFrame } from '../src/layout.js';
import { TEXT_SCALES } from '../src/ui.js';
import { themeById } from '../src/art.js';
import { TRACK } from '../src/rules.js';
import { D, HS, Y0, R_EDGE, wx, wz, radialTex, buildHeights, buildMaps, buildDisc, buildCellMarks, makeLion, makeMarble, buildWorkshop, buildLights } from './world.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const hashStr = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return Math.abs(h); };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 640 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 512 }, { name: 'low', dpr: 1, shadow: 0, tex: 384 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const colCache = new Map();
function parseCol(s) {
  let c = colCache.get(s); if (c) return c;
  const m = /^#([0-9a-f]{6})$/i.exec(s);
  c = m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255) : (s.match(/[\d.]+/g) || ['255', '255', '255']).slice(0, 3).map((v) => Number(v) / 255);
  colCache.set(s, c); return c;
}
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

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
  scene.background = new THREE.Color(0x060a14);
  scene.fog = new THREE.Fog(0x0a1020, 150, 520);
  const camera = new THREE.PerspectiveCamera(28, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const shop = buildWorkshop(scene);
  const { lamp, dust, dustBase } = shop.userData;
  await tick();

  // ---------------------------------------------------------------- the board (heights once, maps and disc per stone)
  let H = null, board = null, boardKey = '', marks = null, building = false;
  const boards = new Map();
  const texN = () => TIERS[tier].tex;
  async function ensureBoard(stone) {
    const key = `${stone}|${texN()}`;
    if (key === boardKey || building) return;
    building = true;
    try {
      if (!H) { H = await buildHeights(texN(), tick); marks = buildCellMarks(H); scene.add(marks); }
      let b = boards.get(key);
      if (!b) { const maps = await buildMaps(H, stone, tick); b = buildDisc(H, maps); boards.set(key, b); }
      if (board) scene.remove(board);
      board = b; boardKey = key; scene.add(b);
    } finally { building = false; }
  }
  await ensureBoard(themeById(v3.theme).stone);
  await tick();

  // ---------------------------------------------------------------- lions, marbles, shadows, dust
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5, fog: false });
  const lionPool = [];
  const slots = new Map();           // id -> { lion, blob, yaw, x, y, z, moving, settle }
  const marblePool = Array.from({ length: 6 }, () => { const m = makeMarble(); m.visible = false; scene.add(m); return m; });
  const dustT = radialTex('226,214,190', 0.8);
  const puffs = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let puffI = 0;
  const puff = (x, y, z) => { const m = puffs[puffI++ % puffs.length]; m.userData = { t: 0, x, y, z }; };
  function takeLion(q) {
    let l = lionPool.find((p) => !p.userData.used && p.userData.q === q);
    if (!l) { l = makeLion(q); scene.add(l); lionPool.push(l); }
    l.userData.used = true; return l;
  }

  // ---------------------------------------------------------------- camera
  const cur = { yaw: 0, tilt: 56, fov: 28, dist: 80, ox: 0, oy: 0, tx: 0, ty: Y0, tz: 0 };
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

  const RAD = R_EDGE * D, TOPY = Y0 + 0.4;
  const DISC_PTS = [...Array.from({ length: 20 }, (_, k) => [Math.cos(k / 20 * Math.PI * 2) * RAD, TOPY, Math.sin(k / 20 * Math.PI * 2) * RAD]), [-RAD, 0.5, RAD * 0.2], [RAD, 0.5, RAD * 0.2], [0, 0.5, RAD + 0.5]];
  const playCache = new Map();
  function playCam(rc) {
    const key = `${rc.x},${rc.y},${rc.w}|${cssW()}x${cssH()}|${cpu().toFixed(4)}`;
    let p = playCache.get(key);
    if (!p) { p = fit(rectCss(rc), DISC_PTS, { yaw: 0, tilt: cssW() > cssH() ? 52 : 54, fov: 28, tx: 0, ty: Y0, tz: 0 }); playCache.set(key, p); if (playCache.size > 24) playCache.delete(playCache.keys().next().value); }
    return p;
  }

  // The board plane as the live camera sees it: homography unit square -> virtual units. v3.proj / v3.key change only when the camera moves.
  let H8 = null, projKey = '';
  const q0 = { x: 0, y: 0 }, PLANE_Y = Y0 + 0.2 * HS;
  function updateH() {
    const src = [[0, 0], [1, 0], [1, 1], [0, 1]], dst = [];
    for (const [a, b] of src) { const v = virt(toCss(camera, wx(a), PLANE_Y, wz(b), q0)); dst.push([v.x, v.y]); }
    const h = homography(src, dst), k = h.map((n) => n.toFixed(4)).join(',');
    if (k !== projKey) { projKey = k; H8 = h; v3.key++; }
    v3.proj = (x, y) => { const d = H8[6] * x + H8[7] * y + 1; return [(H8[0] * x + H8[1] * y + H8[2]) / d, (H8[3] * x + H8[4] * y + H8[5]) / d]; };
  }

  // ---------------------------------------------------------------- per frame
  let clock = 0, game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, mode = '', frame = 0;
  function framing(state, t) {
    const w = state.size[0], h = state.size[1];
    if ((state.scene === 'play' || state.scene === 'auto') && state.match) {
      const P = playFrame(w, h, TEXT_SCALES[state.textIdx] ?? 1, state.match.n), s = P.board.side;
      return { m: 'play', p: playCam({ x: P.board.x + s * 0.035, y: P.board.y - s * 0.1, w: s * 0.93, h: s * 1.2 }) };
    }
    if (state.scene === 'title' && !state.overlay && v3.hero) {
      const hr = v3.hero, base = { yaw: -7 + 7 * Math.sin(t * Math.PI * 2 / 36), tilt: 47 + 3 * Math.sin(t * Math.PI * 2 / 23), fov: 28, tx: 0, ty: Y0, tz: 0 };
      return { m: 'title', p: fit(rectCss({ x: hr.x - hr.w * 0.02, y: hr.y - hr.h * 0.06, w: hr.w * 1.04, h: hr.h * 1.12 }), DISC_PTS, base) };
    }
    // documents and menus: the bench at rest, the board half in view, the lamp burning
    const F = titleFrame(w, h), U = F.U, land = w > h * 1.1;
    const base = { yaw: -18 + 5 * Math.sin(t * Math.PI * 2 / 40), tilt: 34, fov: 32, tx: 0, ty: Y0, tz: 0 };
    const pts = [...DISC_PTS, [-27, 5, 7]];
    const r = land ? { x: U.x0 + U.w * 0.06, y: U.y0 + U.h * 0.2, w: U.w * 0.5, h: U.h * 0.62 } : { x: U.x0 + U.w * 0.06, y: U.y0 + U.h * 0.3, w: U.w * 0.88, h: U.h * 0.42 };
    return { m: 'env', p: fit(rectCss(r), pts, base) };
  }
  function pre() {
    if (!game || lost) return;
    const state = game.getState();
    const vk = `${cssW()}x${cssH()}|${state.size.join('x')}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (state.theme) { const th = themeById(state.theme); v3.theme = th.id; if (th.stone !== boardKey.split('|')[0]) ensureBoard(th.stone); }
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const goal = framing(state, clock);
    if (goal.m !== mode) { if (goal.m === 'play' || mode === '') snap = true; mode = goal.m; }
    const k = snap || goal.m === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal.p)) cur[key] += (goal.p[key] - cur[key]) * k;
    snap = false;
    place(camera, cur); updateH();
    v3.lions.length = 0; v3.marbles.length = 0; v3.marks.length = 0;
  }

  function drawMarks() {
    if (!marks) return;
    const cells = marks.userData.cells;
    for (const c of cells) { c.fill.visible = false; c.line.visible = false; }
    for (const mk of v3.marks) {
      const c = cells[clamp(mk.cell, 0, TRACK)]; if (!c) continue;
      const [r, g, b] = parseCol(mk.col);
      if (mk.fill > 0.001) { c.fill.visible = true; c.fill.material.color.setRGB(r * r, g * g, b * b); c.fill.material.opacity = clamp(mk.fill * 2.2, 0, 0.8); }
      if (mk.line > 0.001) { c.line.visible = true; c.line.material.color.setRGB(r * r * 1.4, g * g * 1.4, b * b * 1.4); c.line.material.opacity = clamp(mk.line, 0, 1); }
    }
  }
  function drawLions(dt) {
    for (const l of lionPool) l.userData.used = false;
    const seen = new Set();
    for (const it of v3.lions) {
      let s = slots.get(it.id);
      const x = wx(it.ux), z = wz(it.uy), ground = H ? H.floorAt(it.ux, it.uy) : Y0;
      if (!s || s.lion.userData.q !== it.q % 6) {
        if (s) { s.lion.visible = false; scene.remove(s.blob); }
        s = { lion: takeLion(it.q % 6), blob: new THREE.Mesh(flatQuad, blobMat), x, z, y: ground, yaw: -(it.ang ?? 0), settle: 9, moving: false, ph: hash(hashStr(String(it.id))) * 6.28 };
        s.blob.renderOrder = 1; scene.add(s.blob); slots.set(it.id, s);
      }
      seen.add(it.id); s.lion.userData.used = true;
      // positions follow the 2D layer's animation exactly (it already eases); a big jump (new turn, capture sent home) snaps
      const jump = Math.hypot(x - s.x, z - s.z) > 6, kx = it.moving ? 1 : 1 - Math.exp(-dt * 22);
      s.x = jump ? x : s.x + (x - s.x) * kx; s.z = jump ? z : s.z + (z - s.z) * kx;
      const wantYaw = -(it.ang ?? 0);
      s.yaw = jump ? wantYaw : s.yaw + angDiff(s.yaw, wantYaw) * (1 - Math.exp(-dt * (it.moving ? 14 : 9)));
      if (s.moving && !it.moving) { s.settle = 0; puff(s.x, ground + 0.1, s.z); }
      s.moving = Boolean(it.moving);
      s.y += (ground - s.y) * (1 - Math.exp(-dt * 20));
      let lift = (it.lift ?? 0) * 2.2;
      if (s.settle < 0.35) { s.settle += dt; const e = s.settle / 0.35, d = (1 - e) * (1 - e); lift += Math.abs(Math.sin(e * Math.PI * 2)) * 0.45 * d; }
      const L = s.lion, a = it.alpha ?? 1, sc = (it.scale ?? 1) * 1.0, breathe = 1 + 0.014 * Math.sin(clock * 1.9 + s.ph);
      L.visible = a > 0.02; L.position.set(s.x, s.y + 0.04 + lift, s.z); L.rotation.set(0, s.yaw, it.moving ? -0.05 : 0);
      L.scale.set(sc, sc * breathe, sc);
      const U = L.userData, dim = it.dim ? 0.45 : 1;
      U.bodyM.color.copy(U.base).multiplyScalar(dim); U.maneM.color.copy(U.mane).multiplyScalar(dim);
      const gl = clamp(it.glow ?? 0, 0, 1) * 0.55;
      for (const m of [U.bodyM, U.maneM]) { m.emissive.copy(U.glow); m.emissiveIntensity = gl; }
      const ghost = Boolean(it.ghost) || a < 0.99;
      for (const m of [U.bodyM, U.maneM, U.goldM, U.darkM]) { m.transparent = ghost; m.opacity = a; }
      for (const m of U.parts) m.castShadow = !ghost;
      s.blob.visible = a > 0.02 && !it.ghost;
      s.blob.position.set(s.x + 0.12 + lift * 0.25, s.y + 0.06, s.z + 0.1 + lift * 0.2);
      const bs = 5.2 * sc * (1 + lift * 0.08); s.blob.scale.set(bs, 1, bs); blobMat.opacity = renderer.shadowMap.enabled ? 0.28 : 0.55;
    }
    for (const [id, s] of [...slots]) if (!seen.has(id)) { s.lion.visible = false; s.lion.userData.used = false; scene.remove(s.blob); slots.delete(id); }
  }
  function drawMarbles() {
    let k = 0;
    for (const m of v3.marbles) {
      if (k >= marblePool.length) break;
      const mm = marblePool[k++], ground = H ? H.floorAt(m.ux, m.uy) : Y0;
      mm.visible = (m.alpha ?? 1) > 0.02; mm.position.set(wx(m.ux), ground + 0.64 + (m.lift ?? 0), wz(m.uy)); mm.rotation.set(m.rot * 0.7, m.rot, m.rot * 0.3);
      mm.scale.setScalar(clamp(m.alpha ?? 1, 0.01, 1));
    }
    for (; k < marblePool.length; k++) marblePool[k].visible = false;
  }

  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt; frame++;
    drawMarks(); drawLions(dt); drawMarbles();
    for (const m of puffs) {
      const u = m.userData; if (!(u.t <= 0.55)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.55), s = (1.5 + f * 4.5);
      m.visible = true; m.position.set(u.x, u.y + 0.2 + f * 0.6, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.4 * (1 - f) * (1 - f);
    }
    // the lamp breathes; dust motes drift through its light
    const f = 1 + 0.07 * Math.sin(clock * 7.3) + 0.04 * Math.sin(clock * 13.1 + 1.7) + 0.02 * Math.sin(clock * 23.7);
    lamp.userData.light.intensity = 1500 * f; lamp.userData.halo.material.opacity = clamp(0.8 + (f - 1) * 1.4, 0, 1); lamp.userData.flame.scale.set(0.8 * (2 - f), 1.9 * f, 0.8 * (2 - f));
    const dp = dust.geometry.attributes.position;
    for (let i = 0; i < dp.count; i++) dp.setXYZ(i, dustBase[i * 3] + Math.sin(clock * 0.2 + i) * 2, dustBase[i * 3 + 1] + ((clock * 0.8 + i * 1.7) % 12), dustBase[i * 3 + 2] + Math.cos(clock * 0.17 + i * 2) * 2);
    dp.needsUpdate = true;
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.moon.castShadow = t.shadow > 0;
    if (t.shadow) { lights.moon.shadow.mapSize.set(t.shadow, t.shadow); if (lights.moon.shadow.map) { lights.moon.shadow.map.dispose(); lights.moon.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true; playCache.clear();
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
  };
}
