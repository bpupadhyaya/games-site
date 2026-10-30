// Tiger and Goat 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js: pieces and
// marks), never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a teak board with brass lines and studs on a
// stone dais in a moonlit bamboo clearing, lacquered tiger and goat figurines. On the play screens the camera is fitted to the layout's board
// rectangle and v3.pts hands the 2D layer the live projection of the 25 board points, so taps, glows and animations line up with the 3D
// board. No WebGL or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { TOP, HALF, DAIS, pointPos, gridPos, radialTex, buildBoard, figurines, figMaterial, buildClearing, buildLights } from './world.js';

const D2R = Math.PI / 180, CAP = 44, SURF = TOP + 0.3;           // SURF: the playing surface (the inlaid face stands 0.3 above the frame)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1536 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const SCALE = { T: 1.0, G: 1.2 }, FACE = { T: -0.8, G: Math.PI + 0.8 };      // quadruped figures in 3/4 view (tigers face right, goats left)
const MARKCOL = { move: [0.05, 0.85, 0.78], jump: [0.95, 0.12, 0.08], hint: [0.3, 0.95, 0.2], cursor: [0.95, 1.0, 0.9], danger: [0.9, 0.05, 0.05] };

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
  scene.background = new THREE.Color(0x0a1a22);
  scene.fog = new THREE.Fog(0x0d2230, 90, 330);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 2000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.3; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const clearing = buildClearing(scene);
  await tick();

  // figurines (instanced; one geometry per piece set)
  const mat = figMaterial();
  let setId = 'classic', figs = figurines(setId);
  const inst = {};
  for (const k of ['T', 'G']) { const m = new THREE.InstancedMesh(figs[k], mat, CAP); m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); inst[k] = m; }
  function setSet(id) {
    if (id === setId) return; setId = id;
    const nf = figurines(id); for (const k of ['T', 'G']) { inst[k].geometry.dispose(); inst[k].geometry = nf[k]; } figs = nf;
  }
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), CAP);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  const ringC = document.createElement('canvas'); ringC.width = ringC.height = 128;
  { const x = ringC.getContext('2d'), g = x.createRadialGradient(64, 64, 30, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.15)'); g.addColorStop(0.74, 'rgba(255,255,255,1)'); g.addColorStop(0.86, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const ringT = new THREE.CanvasTexture(ringC); ringT.colorSpace = THREE.SRGBColorSpace;
  const marks = Array.from({ length: 40 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringT, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); return m; });
  const dustT = radialTex('226,214,190', 0.8);
  const dust = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, z) => { dust[dustI++ % dust.length].userData = { t: 0, x, z }; };

  const boards = new Map(); let board = null, boardKey = '', woodId = 'teak';
  function setWood(id) {
    const k = `${id}|${TIERS[tier].tex}`; if (k === boardKey) return;
    woodId = id; let b = boards.get(k); if (!b) { b = buildBoard(id, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b);
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.3 : 0.6;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    setWood(woodId);
  }
  applyTier();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 52, fov: 28, dist: 90, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
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
  const cpu = () => Math.min(cssW(), cssH()) / 720;
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });

  const E = HALF + 3.5;
  const BOARD_PTS = [[-HALF - 1, DAIS, -HALF - 1], [HALF + 1, DAIS, -HALF - 1], [-HALF - 1, DAIS, HALF + 1], [HALF + 1, DAIS, HALF + 1], [-14, TOP + 7, -14], [14, TOP + 7, -14]];
  const HERO_PTS = [[-14, TOP, 17], [15, TOP, 17], [-14, TOP + 15, 9], [15, TOP + 15, 9]];
  const WIN_PTS = [[-8, TOP, 14], [8, TOP, 14], [-8, TOP + 19, 12], [8, TOP + 19, 12]];
  const playCache = new Map();
  function playCam(rc) {
    const key = `${rc.x.toFixed(1)},${rc.y.toFixed(1)},${rc.w.toFixed(1)},${rc.h.toFixed(1)}|${cssW()}x${cssH()}`;
    let p = playCache.get(key);
    if (!p) { p = fit(rectCss(rc), BOARD_PTS, { yaw: 0, tilt: cssW() > cssH() ? 50 : 54, fov: 26, tx: 0, ty: TOP, tz: 0 }); playCache.set(key, p); if (playCache.size > 24) playCache.delete(playCache.keys().next().value); }
    return p;
  }

  const q0 = { x: 0, y: 0 };
  // board points and their spacing in virtual units, as the live camera sees them (the 2D layer's taps and animations use these)
  function updatePts() {
    const out = [];
    for (let i = 0; i < 25; i++) { const w = pointPos(i), v = virt(toCss(camera, w.x, TOP + 0.4, w.z, q0)); out.push({ x: v.x, y: v.y, s: 1 }); }
    v3.pts = out;
    const a = out[12], b = out[13], c = out[7]; v3.d = Math.min(Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(c.x - a.x, c.y - a.y)) || 60;
  }

  // ---------------------------------------------------------------- figurines
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const counts = { T: 0, G: 0 }; let nBlob = 0, clock = 0;
  const begin = () => { counts.T = counts.G = 0; nBlob = 0; };
  function put(k, x, y, z, yaw = 0, sc = 1, lean = 0, ground = SURF) {
    if (sc < 0.02 || counts[k] >= CAP) return;
    const s = sc * SCALE[k];
    _e.set(lean, yaw + FACE[k], 0, 'XYZ'); _q.setFromEuler(_e); _s.set(s, s, s); _p.set(x, y, z);
    inst[k].setMatrixAt(counts[k]++, _m.compose(_p, _q, _s));
    if (nBlob < CAP) { const lift = Math.max(0, y - ground), b = 5.2 * s * (1 + lift * 0.06); _p.set(x + 0.4 + lift * 0.3, ground + 0.06, z + 0.35 + lift * 0.25); _q.identity(); _s.set(b, 1, b); blobs.setMatrixAt(nBlob++, _m.compose(_p, _q, _s)); }
  }
  function end() { for (const k of ['T', 'G']) { inst[k].count = counts[k]; inst[k].instanceMatrix.needsUpdate = true; } blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true; }
  const REST = [0, 4, 20, 24];
  function drawPieces(list, md, winner) {
    begin();
    const br = Math.sin(clock * 1.2) * 0.04;
    if (md === 'title') {                         // two large figurines in front of the board, gently breathing
      put('T', -6.2, SURF, 12.5, -0.25 + Math.sin(clock * 0.5) * 0.05, 2.4 * (1 + br)); put('G', 7.4, SURF, 13.5, 0.3 + Math.sin(clock * 0.45) * 0.05, 2.4 * (1 - br));
    } else if (md === 'over') {
      if (winner === 'T' || winner === 'G') put(winner, 0, SURF, 14, (winner === 'T' ? -0.45 : 0.45) + Math.sin(clock * 0.6) * 0.18, 3.1 * (1 + br));
      else { put('T', -5, SURF, 14, -0.25, 2.3); put('G', 5.5, SURF, 14, 0.3, 2.3); }
    }
    if (md !== 'play') for (const i of REST) { const w = pointPos(i); put('T', w.x, SURF, w.z, 0); }
    for (const pc of list) {
      const w = gridPos(pc.gx, pc.gy), lift = (pc.lift || 0) * 2.1 + (pc.sel ? 0.8 : 0), y = SURF + lift, sc = pc.a ?? 1;
      put(pc.k, w.x, y, w.z, pc.sel ? Math.sin(clock * 3) * 0.05 : 0, sc, pc.lean || 0);
    }
    end();
  }
  function drawMarks(list) {
    let k = 0;
    for (const mk of list) {
      if (k >= marks.length) break;
      const m = marks[k++], w = gridPos(mk.gx, mk.gy), c = MARKCOL[mk.col] || MARKCOL.move, a = clamp(mk.a ?? 1, 0, 1);
      const s = mk.col === 'danger' ? 6.6 : mk.col === 'move' || mk.col === 'jump' ? 5.8 : 6.4;
      m.visible = true; m.position.set(w.x, SURF + 0.1, w.z); m.scale.set(s, 1, s);
      m.material.color.setRGB(c[0], c[1], c[2]); m.material.opacity = Math.min(1, a * 1.3);
    }
    for (; k < marks.length; k++) marks[k].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let loseExt = null, game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, mode = '', lastAnim = null, calm = false;
  function framing(state, L, t) {
    const sc = state.scene;
    if (sc === 'play' || sc === 'lesson' || (sc === 'puzzle' && state.pz.status !== 'making') || (sc === 'over' && L.over.drawBoard && false)) {
      const b = L.board, bw = b.head.x1 - b.head.x0, e = Math.min(cssW(), cssH()) >= 600 ? 0.1 * bw : 0.03 * bw;
      return { m: 'play', p: playCam({ x: b.head.x0 - e / 2, y: b.head.y0 - e / 2, w: bw + e, h: b.head.y1 - b.head.y0 + e }) };
    }
    if (sc === 'title' || sc === 'look' || sc === 'demo-limit' || sc === 'puzzle') {
      const H = sc === 'look' ? L.look.hero : L.title(!!state.saved).hero;
      const rc = { x: H.hx + 70 * H.sc, y: H.hy + 320 * H.sc, w: 580 * H.sc, h: 330 * H.sc };
      const base = { yaw: -6 + 5 * Math.sin(t * 6.283 / 30), tilt: 16 + 2 * Math.sin(t * 6.283 / 19), fov: 30, tx: 0, ty: TOP + 3, tz: 6 };
      return { m: 'title', p: fit(rectCss(rc), HERO_PTS, base) };
    }
    if (sc === 'over') {
      const O = L.over, rc = { x: O.tx + 150 * O.sc, y: O.ty + 290 * O.sc, w: 420 * O.sc, h: 330 * O.sc };
      return { m: 'over', p: fit(rectCss(rc), WIN_PTS, { yaw: -4 + 4 * Math.sin(t * 6.283 / 26), tilt: 15, fov: 30, tx: 0, ty: TOP + 3, tz: 8 }) };
    }
    const U = L.U, land = L.land;
    const base = { yaw: -22 + 5 * Math.sin(t * 6.283 / 40), tilt: 30, fov: 32, tx: 0, ty: TOP, tz: 0 };
    const r = land ? { x: U.x0 + U.w * 0.08, y: U.y0 + U.h * 0.2, w: U.w * 0.5, h: U.h * 0.62 } : { x: U.x0 + U.w * 0.06, y: U.y0 + U.h * 0.3, w: U.w * 0.88, h: U.h * 0.42 };
    return { m: 'env', p: fit(rectCss(r), BOARD_PTS, base) };
  }
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height);
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}|${L.mode}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    if (state.look) { setWood(state.look.wood); setSet(state.look.set); }
    calm = !!state.calm;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const goal = framing(state, L, clock);
    if (goal.m !== mode) { if (goal.m === 'play' || mode === '') snap = true; mode = goal.m; }
    const k = snap || goal.m === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(goal.p)) cur[key] += (goal.p[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    if (mode === 'play') updatePts(); else v3.pts = null;
    v3.pieces.length = 0; v3.marks.length = 0;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const st = game.getState(), an = st.anim;
    if (an && an.type === 'jump' && an.t / an.dur > 0.55 && lastAnim !== an) { lastAnim = an; const w = pointPos(an.to); puff(w.x, w.z); }
    if (!an) lastAnim = null;
    drawPieces(mode === 'play' ? v3.pieces : [], mode, st.game?.winner);
    drawMarks(mode === 'play' ? v3.marks : []);
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.6)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.6), s = (4 + f * 9);
      m.visible = true; m.position.set(u.x, SURF + 0.3 + f * 1.2, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.5 * (1 - f) * (1 - f);
    }
    clearing.update(clock, calm);
    clearing.lanterns.forEach((L) => { L.getObjectByName('halo').quaternion.copy(camera.quaternion); });
    const fl = 1 + (calm ? 0 : 0.05 * Math.sin(clock * 6.1) + 0.03 * Math.sin(clock * 11.3 + 1));
    lights.warm.intensity = 2400 * fl; lights.warm2.intensity = 1500 * fl;
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  let flatMode = false;       // the playing screens (play, lessons, puzzles) use the flat 2D board art: bigger, photoreal sprites; the 3D scene serves title, Look, result
  function setFlat(f) {
    if (f === flatMode) return; flatMode = f; if (lost) return;
    if (f) { v3.on = false; v3.pts = null; canvas.style.visibility = 'hidden'; } else { v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; }
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.pts = null; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const b of boards.values()) { if (board === b) scene.remove(b); b.userData.dispose(); } boards.clear(); board = null; boardKey = '';
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = !flatMode; canvas.style.visibility = flatMode ? 'hidden' : 'visible'; snap = true; playCache.clear();
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = !flatMode; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post, setFlat,
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
