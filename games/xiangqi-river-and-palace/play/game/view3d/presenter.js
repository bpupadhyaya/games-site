// Xiangqi 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent 2D
// canvas: a slate table at night, a red cloth runner, the carved board and turned pieces with real thickness, two paper lamps. The camera
// is fitted to the layout's board rectangle (play) or hero rectangle (title); the 2D HUD, glows and taps line up with the tilted board
// through v3.at / v3.pick. No WebGL or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context
// rebuilds the environment and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor, pointXY, D } from '../src/layout.js';
import { BLACK, newGame } from '../src/rules.js';
import { CX, CY, BW, BD, TOP, PR, PT, toWorld, fromWorld, buildBoard, buildRoom, makePiece, clearPieceCaches, radialTex, ringTex } from './world.js';

const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const BOARD_SCENES = new Set(['play', 'lesson', 'puzzle', 'autoplay']);
const kindOf = (sc) => (sc === 'lesson' ? 'lesson' : sc === 'puzzle' ? 'puzzle' : sc === 'autoplay' ? 'auto' : 'play');

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07100f); scene.fog = new THREE.Fog(0x07100f, 1500, 4200);
  const camera = new THREE.PerspectiveCamera(30, 1, 10, 9000);
  const hemi = new THREE.HemisphereLight(0xffe2c0, 0x1a0f0c, 0.5);
  const key = new THREE.SpotLight(0xffe2b8, 1.3e7, 0, 0.62, 0.7, 2);
  key.position.set(-380, 1250, 520); key.target.position.set(0, 0, 0);
  key.shadow.bias = -0.0008; key.shadow.normalBias = 1.2; key.shadow.camera.near = 600; key.shadow.camera.far = 2600;
  const moon = new THREE.DirectionalLight(0x8fc4d8, 0.35); moon.position.set(700, 500, -900);
  scene.add(hemi, key, key.target, moon);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.2; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const room = buildRoom(scene);
  await tick();

  // marks (glows, dots) as additive light lying on the board
  const quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
  const glowT = radialTex('255,255,255', 0.9), rT = ringTex();
  const marks = Array.from({ length: 48 }, () => { const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; });
  const blobs = Array.from({ length: 48 }, () => { const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.55 })); m.renderOrder = 1; m.visible = false; scene.add(m); return m; });

  // board (cached per theme + language) and the piece pool
  let board = null, boardKey = '', pieceKey = '';
  const pool = new Map();   // p -> { list: [], used: n }
  const bag = new THREE.Group(); scene.add(bag);
  function setLook(theme, lang) {
    const bk = `${theme}|${lang}`;
    if (bk !== boardKey) {
      if (board) { scene.remove(board); board.userData.dispose(); }
      board = buildBoard(theme, lang); scene.add(board); boardKey = bk;
      for (const e of pool.values()) for (const g of e.list) bag.remove(g);
      pool.clear(); pieceKey = bk;
    }
  }
  const use = (p, theme, lang) => {
    let e = pool.get(p); if (!e) { e = { list: [], used: 0 }; pool.set(p, e); }
    let g = e.list[e.used]; if (!g) { g = makePiece(p, theme, lang); e.list.push(g); bag.add(g); }
    e.used++; g.visible = true; return g;
  };
  const resetPool = () => { for (const e of pool.values()) { e.used = 0; for (const g of e.list) g.visible = false; } };
  let nBlob = 0, nMark = 0;
  const putBlob = (x, z, s, a) => { if (nBlob >= blobs.length) return; const b = blobs[nBlob++]; b.visible = true; b.position.set(x, TOP + 0.5, z); b.scale.set(s, 1, s); b.material.opacity = a; };
  function placePiece(g, cx, cy, lift = 0, sc = 1, spin = 0) {
    const w = toWorld(cx, cy); g.position.set(w.x, TOP + lift, w.z); g.scale.setScalar(sc); g.rotation.order = 'YXZ'; g.rotation.set(0, spin, 0);
    putBlob(w.x + lift * 0.5 + 3, w.z + lift * 0.7 + 5, PR * 2.5 * sc * (1 + lift * 0.01), 0.5 - Math.min(0.3, lift * 0.008));
  }
  function applyTier() {
    const t = TIERS[tier]; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera
  const cur = { yaw: 0, tilt: 54, fov: 28, dist: 1800, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
  let snap = true, viewKey = '';
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz); cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 1800 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 6; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => Math.min(cssW(), cssH()) / 720;
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });

  // v3 hooks for the 2D layer
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  v3.at = (cx, cy, lift = 0) => {
    const w = toWorld(cx, cy), bl = v3.bl, v = virt(toCss(camera, w.x, TOP + lift, w.z, { x: 0, y: 0 }));
    toCss(camera, w.x - D / 2, TOP + lift, w.z, pa); toCss(camera, w.x + D / 2, TOP + lift, w.z, pb);
    const k = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu() / D / (bl ? bl.s : 1);
    return bl ? { x: (v.x - bl.ox) / bl.s, y: (v.y - bl.oy) / bl.s, k } : { x: v.x, y: v.y, k };
  };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TOP + PT * 0.5)), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.pick = (vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2); ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null; return fromWorld(hit.x, hit.z);
  };

  // ---------------------------------------------------------------- frame
  let loseExt = null, game = null, lost = false, lastNow = 0, clock = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, wasBoard = null, lastCap = null;
  const opening = { board: newGame().board };
  const edge = (x) => x * x * (3 - 2 * x);
  const gl = [];   // (reused) nothing
  const BODY_PTS = [[-BW / 2, TOP, -BD / 2], [BW / 2, TOP, -BD / 2], [-BW / 2, TOP, BD / 2], [BW / 2, TOP, BD / 2], [-BW / 2, TOP + 26, -BD / 2], [BW / 2, TOP + 26, -BD / 2]];
  function framing(state, L) {
    const board = BOARD_SCENES.has(state.scene);
    if (board) {
      const BL = L.board(kindOf(state.scene)), r = BL.boardRect, rc = rectCss({ x: r.x, y: r.y, w: r.w, h: r.h });
      return fit(rc, BODY_PTS, { yaw: 0, tilt: L.wide ? 58 : 58, fov: 28, tx: 0, ty: TOP, tz: 0 });
    }
    const calm = state.calm, t = state.t, drift = calm ? 0 : 1;
    const pts = [[-340, TOP, -330], [340, TOP, -330], [-340, TOP, 330], [340, TOP, 330], [-330, TOP + 120, 230], [330, TOP + 120, 230]];
    const base = { yaw: 9 * Math.sin(t * Math.PI * 2 / 34) * drift, tilt: 30 + 2 * Math.sin(t * Math.PI * 2 / 21) * drift, fov: 32, tx: 0, ty: TOP + 20, tz: 0 };
    let rc;
    if (state.scene === 'title') { const TL = L.title(!!state.saved), hr = TL.hero; rc = rectCss({ x: hr.x, y: Math.max(0, host0() ), w: 720 * hr.s, h: 520 * hr.s }); }
    else rc = rectCss({ x: 0, y: 0, w: L.w, h: L.h * 0.55 });
    return fit(rc, pts, base);
  }
  const host0 = () => 0;
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height), isB = BOARD_SCENES.has(state.scene);
    const vk = `${cssW()}x${cssH()}|${L.key}|${state.scene}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (wasBoard !== isB) { wasBoard = isB; snap = true; }
    const goal = framing(state, L), now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1), k = snap || isB ? 1 : 1 - Math.exp(-dt * 5);
    for (const key2 of Object.keys(goal)) cur[key2] += (goal[key2] - cur[key2]) * k;
    snap = false; camera.near = Math.max(10, cur.dist * 0.05); camera.far = cur.dist * 8; scene.fog.near = cur.dist * 1.9; scene.fog.far = cur.dist * 4.2; place(camera, cur);
    v3.marks.length = 0;
    if (isB) { const BL = L.board(kindOf(state.scene)); v3.bl = { ox: BL.ox, oy: BL.oy, s: BL.s }; } else v3.bl = null;
  }
  function setStart(g, theme, lang) { /* title hero: the opening position stands on the board */ }
  function stand(g, theme, lang, flip, state) {
    const a = state.anim, calm = state.calm, T = state.t;
    const moving = a && (a.type === 'move' || a.type === 'refuse') ? a : null, dragSq = state.drag && state.drag.moved ? state.drag.sq : -1;
    for (let s = 0; s < 90; s++) {
      const p = g.board[s]; if (!p) continue;
      if (moving && a.type === 'move' && s === a.to) continue;
      if (moving && a.type === 'refuse' && s === a.from) continue;
      if (s === dragSq) continue;
      const q = pointXY(s, flip), sel = s === state.sel, bob = sel && !calm ? Math.sin(T * 5) * 1.6 : 0;
      placePiece(use(p, theme, lang), q.x, q.y, sel ? 15 + bob : 0, sel ? 1.04 : 1);
    }
    if (moving && a.type === 'move' && a.cap) { const f = Math.min(1, a.t / a.dur); if (f < 0.98) { const q = pointXY(a.to, flip), e = Math.max(0, (f - 0.62) / 0.36); placePiece(use(a.cap, theme, lang), q.x, q.y, e * 46, Math.max(0.05, 1 - e * 0.8), e * 3); } }
    if (moving) {
      const f = Math.min(1, a.t / a.dur), from = pointXY(a.from, flip), to = pointXY(a.to, flip);
      if (a.type === 'move') {
        const e = edge(f), x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e, lift = Math.sin(Math.PI * f) * 30, set = f > 0.88 && !calm ? Math.sin((f - 0.88) / 0.12 * Math.PI) * 1.2 : 0;
        placePiece(use(a.p, theme, lang), x, y, lift + set);
      } else {
        const reach = 0.55, out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = edge(out) * reach, shake = calm ? 0 : f >= 0.38 && f < 0.64 ? Math.sin(f * 110) * 5 : 0;
        placePiece(use(a.p, theme, lang), from.x + (to.x - from.x) * e + shake, from.y + (to.y - from.y) * e, 6 * Math.sin(Math.PI * Math.min(1, f * 1.1)));
      }
    }
    if (dragSq >= 0) placePiece(use(g.board[dragSq], theme, lang), state.drag.x, state.drag.y - 46, 26, 1.08);
  }
  function drawMarks(list) {
    let k = 0;
    for (const mk of list) {
      if (k >= marks.length) break; const m = marks[k++], w = toWorld(mk.x, mk.y), s = mk.r * 2;
      m.visible = true; m.position.set(w.x, TOP + 0.9 + (mk.kind === 'dot' ? 0.2 : 0), w.z); m.scale.set(s, 1, s);
      m.material.map = mk.kind === 'ring' ? rT : glowT;
      const [cr, cg, cb] = mk.rgb.split(',').map((v) => Number(v) / 255); m.material.color.setRGB(cr * cr * 0.5, cg * cg * 0.5, cb * cb * 0.5); m.material.opacity = clamp(mk.a, 0, 1);
    }
    for (; k < marks.length; k++) marks[k].visible = false;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), isB = BOARD_SCENES.has(state.scene), lang = state.lang === 'en' ? 'en' : 'zh', theme = state.set, bt = state.board;
    setLook(bt, lang); resetPool(); nBlob = 0;
    const flip = state.human === BLACK && !state.two && state.scene === 'play';
    if (isB) stand(state.g, theme, lang, flip, state);
    else {
      // title and reference pages: the opening position, and on the title two big generals facing each other across the river
      stand(opening, theme, lang, false, { anim: null, drag: null, sel: -1, calm: true, t: 0 });
      if (state.scene === 'title') {
        // two big generals stand on edge in the foreground, facing the viewer, the opening position on the board behind them
        const bob = state.calm ? 0 : Math.sin(state.t * 1.4) * 2.5, sc = 1.75, th = 1.18;
        [[1, 235, 0.32, bob], [-1, 485, -0.32, -bob]].forEach(([p, x, yaw, b]) => {
          const g = use(p, theme, lang), w = toWorld(x, 905); g.scale.setScalar(sc); g.rotation.order = 'YXZ'; g.rotation.set(th, yaw, 0);
          g.position.set(w.x, TOP + PR * Math.sin(th) * sc + 1.5 + b, w.z); putBlob(w.x + 6, w.z + 14, PR * 3.2, 0.45);
        });
      }
    }
    for (; nBlob < blobs.length; nBlob++) blobs[nBlob].visible = false;
    drawMarks(isB ? v3.marks : []);
    const lampsU = room.userData.lamps; lampsU.forEach((l, i) => { const f = 1 + 0.06 * Math.sin(clock * (4.2 + i * 1.3) + i) + 0.03 * Math.sin(clock * 11 + i * 2); l.userData.light.intensity = 2.2e5 * f; l.userData.halo.material.opacity = 0.7 + 0.1 * f; l.rotation.z = state.calm ? 0 : Math.sin(clock * 1.2 + i * 2) * 0.012; });
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.bl = null; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); clearPieceCaches(); if (board) { scene.remove(board); board = null; } boardKey = ''; for (const e of pool.values()) for (const g of e.list) bag.remove(g); pool.clear();
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });
  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();
  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    setTier(n) { tier = clamp(n | 0, 0, 2); applyTier(); },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return !!loseExt; },
    restoreContext() { loseExt?.restoreContext(); return !!loseExt; },
  };
}
