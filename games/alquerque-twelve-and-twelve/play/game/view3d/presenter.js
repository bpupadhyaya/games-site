// Alquerque 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js: pieces and
// rings), never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a carved cedar board with brass in
// its channels, on a woven rug in a courtyard at dusk. On the play screens the camera is fitted to the layout's board rectangle and
// v3.geo hands the 2D layer the projected points, so taps, arrows and capture marks line up with the tilted board. No WebGL,
// ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { lay, playLayout } from '../src/layout.js';
import { TEXT_SCALES } from '../src/ui.js';
import { themeById } from '../src/art.js';
import { S as SP, HALF, TOP, PR, pointPos, radialTex, buildBoard, pieceGeos, pieceMaterials, setPieceTheme, buildBowl, buildLantern, buildCourtyard, buildLights } from './world.js';

const D2R = Math.PI / 180, CAP = 40;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sm = (k) => k * k * (3 - 2 * k);
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1024 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const SETTLE = 0.32;
const START = 'OOOOO/OOOOO/OO.XX/XXXXX/XXXXX'.replace(/\//g, '').split('').map((c) => (c === 'X' ? 1 : c === 'O' ? 2 : 0));
// where the bowls and the lantern stand (cm); bowl 0 sits by the bottom player, bowl 1 by the top player
const BOWL = [{ x: 33, z: 21 }, { x: -33, z: -19 }], LANTERN = { x: -36, z: -32 };

const colCache = new Map();
function parseCol(s) {
  let c = colCache.get(s); if (c) return c;
  const m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  else { const n = (s.match(/[\d.]+/g) || ['255', '255', '255']).slice(0, 3).map(Number); c = n.map((v) => v / 255); }
  colCache.set(s, c); return c;
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1420);
  scene.fog = new THREE.Fog(0x1c1622, 260, 1100);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 5000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  buildCourtyard(scene);
  await tick();
  const lantern = buildLantern(); lantern.position.set(LANTERN.x, 0.6, LANTERN.z); scene.add(lantern);
  BOWL.forEach((b, k) => { const g = buildBowl(k ? '#1f5a8a' : '#245f7a'); g.position.set(b.x, 0.6, b.z); g.rotation.y = k * 1.3; scene.add(g); });
  await tick();
  const geos = pieceGeos();
  let th = themeById('cedar'), themeId = 'cedar';
  const mats = pieceMaterials(th);
  const inst = {};
  for (const k of ['1', '2', 'dia']) { const m = new THREE.InstancedMesh(geos[k], mats[k], CAP); m.castShadow = k !== 'dia'; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); inst[k] = m; }
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), CAP);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  // rings and discs: light lying on the board surface (under the pieces)
  const ringC = document.createElement('canvas'); ringC.width = ringC.height = 128;
  { const x = ringC.getContext('2d'), g = x.createRadialGradient(64, 64, 30, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.15)'); g.addColorStop(0.74, 'rgba(255,255,255,1)'); g.addColorStop(0.86, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const ringT = new THREE.CanvasTexture(ringC); ringT.colorSpace = THREE.SRGBColorSpace;
  const discT = radialTex('255,255,255', 1);
  const marks = Array.from({ length: 48 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); return m; });
  // dust: a puff of fine grit where a jumping piece lands
  const dustT = radialTex('230,205,170', 0.8);
  const dust = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, z, s = 1) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, z, s }; };

  // boards are cached per theme and texture size
  const boards = new Map(); let board = null, boardKey = '';
  function setTheme(id) {
    const k = `${id}|${TIERS[tier].tex}`; if (k === boardKey) return;
    th = themeById(id); themeId = id;
    let b = boards.get(k); if (!b) { b = buildBoard(th, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
    setPieceTheme(mats, th);
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

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 60, fov: 30, dist: 120, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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

  // the play camera for a board rectangle: the whole board (and its front edge) fills the rectangle's width
  const B = HALF - 0.2;
  const BOARD_PTS = [[-B, TOP, -B], [B, TOP, -B], [-B, TOP, B], [B, TOP, B], [-B, 0.6, B + 0.5], [B, 0.6, B + 0.5]];
  const playCache = new Map();
  function playCam(x, y, side) {
    const key = `${x},${y},${side}|${cssW()}x${cssH()}|${cpu().toFixed(4)}`;
    let c = playCache.get(key);
    if (!c) {
      const land = cssW() > cssH();
      const p = fit(rectCss({ x, y, w: side, h: side }), BOARD_PTS, { yaw: 0, tilt: land ? 58 : 62, fov: 26, tx: 0, ty: TOP, tz: 0 });
      place(fitCam, p);
      const proj = (flip) => Array.from({ length: 25 }, (_, i) => { const w = pointPos(i, flip), q = virt(toCss(fitCam, w.x, TOP, w.z)); return [q.x, q.y]; });
      const pf = proj(false), pt = proj(true);
      const u = (Math.hypot(pf[13][0] - pf[11][0], pf[13][1] - pf[11][1]) / 2 + Math.hypot(pf[17][0] - pf[7][0], pf[17][1] - pf[7][1]) / 2) / 2;
      c = { p, centers: [pf, pt], u };
      playCache.set(key, c); if (playCache.size > 24) playCache.delete(playCache.keys().next().value);
    }
    return c;
  }
  v3.geo = (x, y, side, flip) => {
    const c = playCam(x, y, side);
    return { x, y, side, m: side * 0.115, u: c.u, centers: c.centers[flip ? 1 : 0], d: c.u * 0.64, cell: c.u, flip: Boolean(flip), p3: true };
  };

  // ---------------------------------------------------------------- pieces
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const counts = {}; let nBlob = 0;
  const dbg = qs.has('dev') ? [] : null;               // dev only: every piece placed this frame (motion checks)
  const begin = () => { for (const k in inst) counts[k] = 0; nBlob = 0; if (dbg) dbg.length = 0; };
  function put(who, x, y, z, yaw, tx = 0, tz = 0, sc = 1, sy = 1) {
    if (sc < 0.01) return;
    const key = String(who), m = inst[key]; if (counts[key] >= CAP) return;
    _e.set(tx, yaw, tz, 'YXZ'); _q.setFromEuler(_e); _s.set(sc, sc * sy, sc); _p.set(x, y, z);
    _m.compose(_p, _q, _s); m.setMatrixAt(counts[key]++, _m);
    if (dbg) dbg.push([who, x, y, z]);
    if (who === 2) inst.dia.setMatrixAt(counts.dia++, _m);
    if (nBlob < CAP) {
      const lift = Math.max(0, y - TOP), s = PR * 2.6 * sc * (1 + lift * 0.08), ground = lift > 12 ? 0.62 : TOP + 0.03;
      _p.set(x + 0.35 + lift * 0.25, ground, z + 0.3 + lift * 0.2); _q.identity(); _s.set(s, 1, s); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s));
    }
  }
  function end() {
    for (const k in inst) { inst[k].count = counts[k]; inst[k].instanceMatrix.needsUpdate = true; }
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
  }
  const yawOf = (i, who) => (who === 2 ? (hash(i, 7) - 0.5) * 0.5 : hash(i, 41) * 6.283);
  // prisoners in a bowl: a small heap, the first ones on the bottom
  const bowlSpot = (k, n) => { const b = BOWL[k], a = n * 2.39996, r = n < 6 ? 2.6 + (n % 2) * 1.6 : 4.3, ly = n < 6 ? 0 : n < 11 ? 1.1 : 2; return { x: b.x + Math.cos(a) * r * (n ? 1 : 0.2), y: 0.6 + 1.5 + ly + (n < 6 ? 0 : 0.4), z: b.z + Math.sin(a) * r * (n ? 1 : 0.2), tx: (hash(n, 3) - 0.5) * 0.5, tz: (hash(n, 5) - 0.5) * 0.5 }; };
  const bowlOf = (captor, flip) => ((captor === 1) !== Boolean(flip) ? 0 : 1);

  let clock = 0;
  const flyingPrev = new Map(), settled = new Map();
  function drawPieces(list) {
    begin();
    const onBoard = { 1: 0, 2: 0 }, inFlight = { 1: 0, 2: 0 };
    let flip = false;
    const seen = new Set();
    for (const pc of list) {
      flip = Boolean(pc.flip);
      const sc = pc.sc ?? 1;
      if (pc.cap != null) {
        // a captured piece: waits until the jumper has passed, then is lifted off and set in the captor's bowl
        inFlight[pc.who]++;
        const w = pointPos(pc.i, pc.flip), bk = bowlOf(pc.who === 1 ? 2 : 1, pc.flip), dst = bowlSpot(bk, 0);
        const e = sm(clamp(pc.cap, 0, 1)), b = BOWL[bk];
        put(pc.who, w.x + (b.x - w.x) * e, TOP + Math.sin(Math.PI * e) * 14 + (dst.y - TOP) * e, w.z + (b.z - w.z) * e, yawOf(pc.i, pc.who) + e * 2.2, e * 0.9, e * 0.4, sc * (1 - 0.15 * Math.sin(Math.PI * e)));
        continue;
      }
      onBoard[pc.who]++;
      const w = pointPos(pc.i, pc.flip);
      const key = `${pc.i}`; seen.add(key);
      if (pc.a) {
        const f = pointPos(pc.a.from, pc.flip), k = clamp(pc.a.k, 0, 1), e = sm(k), jump = pc.a.kind === 'jump';
        const dx = w.x - f.x, dz = w.z - f.z, L = Math.hypot(dx, dz) || 1;
        const lift = jump ? Math.sin(Math.PI * e) * 5.2 : Math.sin(Math.PI * k) * 0.9;
        const lean = (jump ? 0.38 : 0.12) * Math.sin(Math.PI * e) * (e < 0.5 ? 1 : -0.7);
        put(pc.who, f.x + dx * e, TOP + lift, f.z + dz * e, yawOf(pc.a.from, pc.who), (dz / L) * lean, -(dx / L) * lean, sc);
        flyingPrev.set(key, jump);
        continue;
      }
      if (flyingPrev.has(key)) { const jump = flyingPrev.get(key); flyingPrev.delete(key); settled.set(key, { t0: clock, amp: jump ? 1 : 0.45 }); if (jump) puff(w.x, w.z, 1); }
      let y = TOP, tx = 0, sy = 1;
      const st = settled.get(key);
      if (st) {
        const s = (clock - st.t0) / SETTLE;
        if (s >= 1) settled.delete(key);
        else { const d = (1 - s) * (1 - s); y += Math.abs(Math.sin(s * Math.PI * 2)) * 0.35 * d * st.amp; sy = 1 - Math.sin(Math.min(1, s * 4) * Math.PI) * 0.07 * st.amp; tx = Math.sin(s * Math.PI * 4) * 0.07 * d * st.amp; }
      }
      if (pc.sel) y += 1.6 + Math.sin(clock * 4) * 0.25;
      put(pc.who, w.x, y, w.z, yawOf(pc.i, pc.who), tx, 0, sc, sy);
    }
    for (const k of flyingPrev.keys()) if (!seen.has(k)) flyingPrev.delete(k);
    // the bowls: each holds the pieces its owner has taken
    for (const who of [1, 2]) {
      const n = clamp(12 - onBoard[who] - inFlight[who], 0, 12), bk = bowlOf(who === 1 ? 2 : 1, flip);
      for (let j = 0; j < n; j++) { const s = bowlSpot(bk, j); put(who, s.x, s.y, s.z, hash(j, who) * 6.28, s.tx, s.tz, 1); }
    }
    end();
  }
  function drawMarks(list) {
    let k = 0;
    const occ = new Set(v3.pieces.filter((p) => p.cap == null && !p.a).map((p) => `${p.i}|${p.flip ? 1 : 0}`));
    for (const mk of list) {
      if (k >= marks.length || mk.i < 0 || mk.i >= 25) continue;
      const m = marks[k++], w = pointPos(mk.i, mk.flip);
      let r = mk.r * 0.64 * SP * 1.05;
      if (!mk.fill && occ.has(`${mk.i}|${mk.flip ? 1 : 0}`)) r = Math.max(r, PR * 1.32);
      const s = r * 2 * (mk.fill ? 1.35 : 1.18);
      m.visible = true; m.position.set(w.x, TOP + 0.08, w.z); m.scale.set(s, 1, s);
      m.material.map = mk.fill ? discT : ringT;
      const [cr, cg, cb] = parseCol(mk.col), a = clamp(mk.a ?? 1, 0, 1) * (mk.fill ? 1.1 : 1);
      m.material.color.setRGB(cr * cr * a * 1.3, cg * cg * a * 1.3, cb * cb * a * 1.3);
    }
    for (; k < marks.length; k++) marks[k].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, mode = '';
  function framing(state, L) {
    const t = clock;
    if ((state.scene === 'play' || state.scene === 'auto') && state.match) {
      const P = playLayout(TEXT_SCALES[state.textIdx] ?? 1);
      return { m: 'play', p: playCam(P.board.x, P.board.y, P.board.side).p };
    }
    if (state.scene === 'title' && L.title.board) {
      const T = L.title.board;
      const base = { yaw: -14 + 7 * Math.sin(t * Math.PI * 2 / 34), tilt: 38 + 3 * Math.sin(t * Math.PI * 2 / 21), fov: 30, tx: 0, ty: TOP, tz: 0 };
      const pts = [[-HALF, TOP, -HALF], [HALF, TOP, -HALF], [-HALF, 0.6, HALF], [HALF, 0.6, HALF]];
      // the tilted board is wider than tall: let it use the whole width of the title column
      const w = Math.max(T.side, Math.min(L.title.maxW, T.side * 1.5));
      return { m: 'title', p: fit(rectCss({ x: L.title.cx - w / 2, y: T.y, w, h: T.side }), pts, base) };
    }
    // documents and menus without a board slot: the courtyard, the board at rest under the lantern
    const U = L.U, land = L.wide;
    const base = { yaw: -22 + 5 * Math.sin(t * Math.PI * 2 / 40), tilt: 30, fov: 32, tx: 0, ty: TOP, tz: 0 };
    const pts = [[-HALF, TOP, -HALF], [HALF, TOP, -HALF], [-HALF, 0.6, HALF], [HALF, 0.6, HALF], [LANTERN.x, 24, LANTERN.z]];
    const r = land ? { x: U.x0 + U.w * 0.08, y: U.y0 + U.h * 0.18, w: U.w * 0.5, h: U.h * 0.66 } : { x: U.x0 + U.w * 0.06, y: U.y0 + U.h * 0.34, w: U.w * 0.88, h: U.h * 0.4 };
    return { m: 'env', p: fit(rectCss(r), pts, base) };
  }
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = lay();
    const vk = `${cssW()}x${cssH()}|${L.key}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (state.theme && state.theme !== themeId) setTheme(state.theme);
    const goal = framing(state, L);
    if (goal.m !== mode) { if (goal.m === 'play' || mode === '') snap = true; mode = goal.m; }
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap || goal.m === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal.p)) cur[key] += (goal.p[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    v3.pieces.length = 0; v3.marks.length = 0;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    // screens without a board in play show the starting position at rest
    const list = v3.pieces.length || mode === 'play' ? v3.pieces : START.map((who, i) => (who ? { who, i } : null)).filter(Boolean);
    drawPieces(list);
    drawMarks(mode === 'play' ? v3.marks : []);
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.6)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.6), s = (2.6 + f * 7) * u.s;
      m.visible = true; m.position.set(u.x, TOP + 0.15 + f * 0.6, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.5 * (1 - f) * (1 - f);
    }
    // the lantern breathes: a slow flicker of the flame
    const fl = 1 + 0.05 * Math.sin(clock * 7.3) + 0.035 * Math.sin(clock * 13.1 + 1.7) + 0.02 * Math.sin(clock * 23.7);
    lantern.userData.light.intensity = 3200 * fl; lantern.userData.glass.emissiveIntensity = 2.4 * fl; lantern.userData.halo.material.opacity = clamp(0.85 + (fl - 1) * 1.2, 0, 1);
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

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    get puts() { return dbg; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
